/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2026 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org

    This file is part of Zotero.

    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.

    ***** END LICENSE BLOCK *****
*/

/**
 * Zotero.Lexical -- ranked lexical search over the library's own text.
 *
 * Scores how well a text answers a query rather than whether it contains every
 * word of it: any term can match, and the score accumulates the evidence, so a
 * document about owl migration in Norway still scores for "owl migration in the
 * united states" -- below the documents that cover all of it.
 *
 * The ranking is FTS5's own BM25, asked one question per index rather than one
 * per query term. parseQuery() breaks a query into terms, buildExpression()
 * assembles them into a single OR expression, and the index scores every
 * document against it in one pass. BM25 already weighs a term by how rare it is
 * in the corpus it indexes, saturates repetition, and discounts long documents,
 * so a term filling half the library moves a score barely at all -- no
 * stoplist, no weights of our own, nothing curated by hand.
 *
 * Two things the query asks for that a bag of words wouldn't:
 *
 * - Adjacency. Consecutive query words are added to the expression as phrase
 *   terms, so a text saying "special education" earns above one with the words
 *   scattered. A phrase is rarer than either of its words, so BM25 would let it
 *   decide the ranking by itself; the word terms are repeated
 *   ADJACENCY_REPETITION times to hold it to a share of the score.
 * - Where the words landed. A title names a work and an abstract summarizes it,
 *   so the item-text index is scored with per-column weights (see
 *   COLUMN_WEIGHTS), which is BM25's own mechanism for the same idea.
 *
 * Raw BM25 is unbounded and its scale shifts with the query, so it can't be
 * shown or compared as it stands. Every score is divided by the most the
 * expression could earn, which BM25's shape makes calculable from the terms'
 * inverse document frequencies alone (see _getCeiling()). What's left is a 0-1
 * reading of how strongly a document carries the query, weighted toward its
 * rarer terms: a document missing a term forfeits that term's share, and the
 * top of the range belongs to a text about nothing else.
 *
 * Scores from the two indexes are comparable because both are that same
 * fraction, and because BM25 normalizes each by its own corpus's typical
 * document length -- the reason a one-line title and a 400-page PDF can be read
 * on one scale at all.
 */
Zotero.Lexical = new function () {
	// CJK scripts (Han/Hiragana/Katakana/Hangul), the same set the full-text
	// index routes to its 2-gram tables (see fulltext.js): the word tokenizer
	// sees an unspaced CJK run as a single token, so runs are matched by
	// their bigrams instead
	const CJK_CLASS = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}';
	// The tokens of a normalized query part, in text order: a CJK run, or a
	// word token as the index's unicode61 tokenizer produces them -- a run of
	// letters and digits, with everything else a separator. The lookahead
	// keeps CJK characters (which are also \p{L}) out of word tokens, so
	// 'covid疫情' splits into a word and a run rather than reading as one word.
	const TOKEN_RE = new RegExp(
		`(?<cjk>[${CJK_CLASS}]+)|(?<word>(?:(?![${CJK_CLASS}])[\\p{L}\\p{N}])+)`,
		'gu'
	);
	// How many times a word term is repeated in the expression, against one
	// occurrence of each adjacency phrase (see buildExpression()). BM25 sums a
	// contribution per term in the expression and counts a repeat again, which
	// is the only way to weigh one term against another in it. A phrase can
	// only match texts that match both its words, so it is always the rarer
	// term and BM25 would otherwise let it decide the ranking: unrepeated, an
	// accidental adjacency straddling two concepts ("change adaptation" in
	// "climate change adaptation in bangladesh") outweighs what the query is
	// about. Repetition trades adjacency for coverage smoothly, and this is
	// the point on that curve where a query's words still decide it.
	const ADJACENCY_REPETITION = 3;
	// What a match in each column of the item-text index is worth, in the
	// order the index declares them (see fulltext.js): a title names the work,
	// an abstract summarizes it, everything else speaks with equal voice.
	// Passed to bm25(), which spends them on how fast a match approaches the
	// ceiling rather than on the ceiling itself, so a weight can favour a
	// column without letting it score above a full match.
	const COLUMN_WEIGHTS = { title: 2, abstract: 1.3, note: 1, annotation: 2 };
	// The indexes a query is scored against: the attachment content index and
	// the item-text index, each with the CJK 2-gram table covering the same
	// documents, and the item-text tables' columns in declaration order
	const SOURCES = [
		{ word: 'fulltextContent', cjk: 'fulltextContentCJK', columns: null },
		{
			word: 'fulltextItemText',
			cjk: 'fulltextItemTextCJK',
			columns: ['title', 'abstract', 'note', 'annotation']
		}
	];

	/**
	 * Thrown when scoring is abandoned via the shouldCancel callback -- e.g.
	 * because a newer query superseded the one being scored
	 */
	this.ScoringCancelledError = class extends Error {
		constructor(message = 'Scoring cancelled') {
			super(message);
			this.name = 'LexicalScoringCancelledError';
		}
	};

	/**
	 * Parse a query into terms.
	 *
	 * A term is the thing that matches (or doesn't) in one text:
	 * - a word: { type: 'word', text, prefix }. The query's trailing word is
	 *   flagged `prefix` while it's still being typed (no space or quote
	 *   after it yet), so it matches its completions.
	 * - a quoted phrase: { type: 'phrase', text, tokens } -- multiple words
	 *   matched adjacently, as typed.
	 * - a CJK run: { type: 'cjk', text, bigrams } -- matched contiguously via
	 *   the 2-gram index, so quoting adds nothing it doesn't already have.
	 *   `bigrams` is null for a single character, which has none.
	 * A part mixing scripts splits into word and run terms, and a quoted
	 * part mixing scripts splits the same way, since neither index side
	 * covers it whole.
	 *
	 * A repeated term counts once: repeating a word in the query isn't more
	 * evidence about the texts it matches. When the same word appears both
	 * mid-query and as the trailing prefix, the exact form wins.
	 *
	 * @param {String} queryText
	 * @return {Object[]}
	 */
	this.parseQuery = function (queryText) {
		if (!queryText) {
			return [];
		}
		// Mid-word means the query ends in a word character; a space, a
		// closing quote, or punctuation after the word means it's finished
		let endsMidWord = /[\p{L}\p{N}]$/u.test(queryText);
		let parts = Zotero.SearchConditions.parseSearchString(queryText);
		let terms = [];
		for (let i = 0; i < parts.length; i++) {
			let part = parts[i];
			let fromLastPart = i == parts.length - 1;
			let normalized = Zotero.Utilities.Internal.normalizeForSearch(part.text);
			if (!normalized) {
				continue;
			}
			let matches = [...normalized.matchAll(TOKEN_RE)];
			if (!matches.length) {
				continue;
			}
			let words = matches.filter(m => m.groups.word).map(m => m.groups.word);
			let hasCJK = matches.some(m => m.groups.cjk);
			if (part.inQuotes && words.length > 1 && !hasCJK) {
				terms.push({
					type: 'phrase',
					text: words.join(' '),
					tokens: words,
					fromLastPart,
					quoted: true
				});
				continue;
			}
			for (let match of matches) {
				if (match.groups.cjk) {
					terms.push({
						type: 'cjk',
						text: match.groups.cjk,
						bigrams: _getBigrams(match.groups.cjk),
						fromLastPart,
						quoted: part.inQuotes
					});
				}
				else {
					terms.push({
						type: 'word',
						text: match.groups.word,
						prefix: false,
						fromLastPart,
						quoted: part.inQuotes
					});
				}
			}
		}
		// The trailing word of an unquoted query is the one still being
		// typed. A quoted trailing part is exact by declaration.
		if (terms.length && endsMidWord) {
			let last = terms[terms.length - 1];
			if (last.type == 'word' && last.fromLastPart && !last.quoted) {
				last.prefix = true;
			}
		}
		let deduped = new Map();
		for (let term of terms) {
			delete term.fromLastPart;
			delete term.quoted;
			let key = term.type + '\n' + term.text;
			let existing = deduped.get(key);
			if (!existing || (existing.prefix && !term.prefix)) {
				deduped.set(key, term);
			}
		}
		return [...deduped.values()];
	};

	/**
	 * The FTS5 expression that scores a query's terms against one index
	 * family, and the pieces it was built from.
	 *
	 * Every term is joined with OR, so any of them can match and BM25 sums
	 * what each contributes. The word family additionally carries a phrase
	 * term for each consecutive pair of query words -- what the query asked
	 * for beyond the words themselves -- and repeats each word term
	 * ADJACENCY_REPETITION times to keep those phrases from deciding the
	 * ranking on their own.
	 *
	 * Terms are all letters and digits (parseQuery tokenized them), so
	 * quoting them into FTS phrases needs no escaping.
	 *
	 * @param {Object[]} terms - Terms from parseQuery()
	 * @param {String} family - 'word' for the word-tokenized indexes, 'cjk'
	 *     for the 2-gram indexes
	 * @return {Object|null} - { expression, pieces }, where pieces are
	 *     { match, repetitions } for building a ceiling against; null when the
	 *     query has nothing for this family
	 */
	this.buildExpression = function (terms, family) {
		let pieces = [];
		if (family == 'cjk') {
			for (let term of terms) {
				if (term.type == 'cjk') {
					// A single character has no bigram of its own, so it's
					// matched against every bigram starting with it
					pieces.push({
						match: term.bigrams
							? '"' + term.bigrams + '"'
							: '"' + term.text + '"*',
						repetitions: 1
					});
				}
			}
		}
		else {
			let words = terms.filter(term => term.type == 'word');
			for (let term of terms) {
				if (term.type == 'word') {
					pieces.push({
						match: '"' + term.text + '"' + (term.prefix ? '*' : ''),
						repetitions: ADJACENCY_REPETITION
					});
				}
				else if (term.type == 'phrase') {
					pieces.push({ match: '"' + term.text + '"', repetitions: 1 });
				}
			}
			// Consecutive query words, as the query wrote them. A pair whose
			// second word is still being typed matches its completions too.
			for (let i = 0; i < words.length - 1; i++) {
				pieces.push({
					match: '"' + words[i].text + ' ' + words[i + 1].text + '"'
						+ (words[i + 1].prefix ? '*' : ''),
					repetitions: 1
				});
			}
		}
		if (!pieces.length) {
			return null;
		}
		let expression = pieces
			.flatMap(piece => Array(piece.repetitions).fill(piece.match))
			.join(' OR ');
		return { expression, pieces };
	};

	/**
	 * Score a given set of items by how well their text answers a query.
	 *
	 * Each index is asked once, for every document matching any of the query's
	 * terms, and reports BM25's own ranking. A score is that ranking as a
	 * fraction of what the query could earn (see _getCeiling()), so it reads
	 * as the share of the query a document carries: rarer terms move it most,
	 * a document missing a term forfeits that term's share, and repetition
	 * beyond the point where a text is clearly about a term adds nothing.
	 * An item's score is its best across the indexes, and items below
	 * SCORE_FLOOR aren't matches and aren't returned.
	 *
	 * Notes edited since their last index update, and notes not indexed yet,
	 * can't be scored from the index at all; their current text is read and
	 * read generously (see _scoreUnindexedNotes()), so a note just typed is
	 * findable.
	 *
	 * @param {String} queryText
	 * @param {Number[]} itemIDs - Candidate item IDs to score
	 * @param {Object} [options]
	 * @param {Function} [options.shouldCancel] - Checked between indexes;
	 *     return true to abandon scoring with a ScoringCancelledError
	 * @return {Promise<Map>} - itemID -> score (0-1, higher is better)
	 */
	this.scoreItemIDs = async function (queryText, itemIDs, { shouldCancel } = {}) {
		// Scores below this aren't matches and aren't returned: measured
		// against what the query could earn, this is the share of it a
		// document has to carry. Provisional until tuned against a real
		// library.
		const SCORE_FLOOR = 0.05;
		let scores = new Map();
		if (!itemIDs.length) {
			return scores;
		}
		let terms = this.parseQuery(queryText);
		if (!terms.length) {
			return scores;
		}
		let checkCancel = () => {
			if (shouldCancel && shouldCancel()) {
				throw new this.ScoringCancelledError();
			}
		};
		let candidates = new Set(itemIDs);
		let best = new Map();
		let keep = (itemID, fraction) => {
			if (!(best.get(itemID) >= fraction)) {
				best.set(itemID, fraction);
			}
		};
		for (let source of SOURCES) {
			for (let family of ['word', 'cjk']) {
				checkCancel();
				let built = this.buildExpression(terms, family);
				if (!built) {
					continue;
				}
				let table = source[family];
				// CJK 2-grams are indexed into the same columns as the words
				let weights = source.columns
					? source.columns.map(column => COLUMN_WEIGHTS[column])
					: null;
				let bm25 = weights
					? 'bm25(' + table + ', ' + weights.join(', ') + ')'
					: 'bm25(' + table + ')';
				// The MATCH runs unconstrained and the candidate filter is
				// applied here: a full scan for a common term costs
				// milliseconds, while constraining the same MATCH to a rowid
				// set makes FTS5 evaluate the expression per row, which at
				// library scale costs seconds.
				let rows = await Zotero.DB.queryAsync(
					"SELECT rowid, " + bm25 + " AS score FROM ftindex." + table
						+ " WHERE " + table + " MATCH ?",
					[built.expression]
				);
				rows = rows.map(row => ({ rowid: row.rowid, rank: row.score }))
					.filter(row => candidates.has(row.rowid));
				if (!rows.length) {
					continue;
				}
				let ceiling = await _getCeiling(built.pieces, table);
				// rank is negative, better more negative. The ceiling normally
				// bounds it, but a query whose every term is past FTS5's idf
				// floor is scored entirely in clamped units the ceiling can
				// only approximate, so the strongest document stands in where
				// it falls short and the fractions stay inside 0-1.
				let scale = Math.max(ceiling, ...rows.map(row => -row.rank));
				if (!scale) {
					continue;
				}
				for (let row of rows) {
					keep(row.rowid, Math.min(1, -row.rank / scale));
				}
			}
		}
		checkCancel();
		for (let [itemID, fraction] of await _scoreUnindexedNotes(terms, itemIDs)) {
			keep(itemID, fraction);
		}
		for (let [itemID, fraction] of best) {
			if (fraction >= SCORE_FLOOR) {
				scores.set(itemID, fraction);
			}
		}
		return scores;
	};

	/**
	 * Excerpts of an item's own text around the places a query matches, for
	 * showing why the item ranks. Each excerpt names its source -- per the
	 * item's type: 'title' and 'abstract' for a regular item, 'content' for a
	 * file attachment's extracted fulltext, 'note' or 'annotation' -- and
	 * carries the matched character ranges within its text, for highlighting.
	 * Long texts are cut to windows around their densest clusters of matches,
	 * marked with ellipses where they cut; excerpts showing the most of the
	 * query come first. An item whose own text matches nothing gets no
	 * excerpts.
	 *
	 * Only the terms BM25 can score with are shown (see _getScoringTerms()),
	 * so an excerpt points at what actually ranked the item rather than at
	 * every word of the query. Each excerpt's `strength` is the share of those
	 * terms it shows, so excerpts can be ordered against other relevance
	 * evidence for the item.
	 *
	 * @param {String} queryText
	 * @param {Number} itemID
	 * @param {Object} [options]
	 * @param {Number} [options.limit=5] - Most excerpts to return
	 * @return {Promise<Object[]>} - [{ source, text, ranges, strength }],
	 *     with ranges an array of [start, end) pairs into the excerpt's text
	 */
	this.getMatchingExcerpts = async function (queryText, itemID, { limit = 5 } = {}) {
		let terms = await _getScoringTerms(this.parseQuery(queryText));
		if (!terms.length) {
			return [];
		}
		let item = await Zotero.Items.getAsync(itemID);
		if (!item) {
			return [];
		}
		let excerpts = [];
		for (let { source, text } of await _getSourceTexts(item)) {
			excerpts.push(..._excerptSource(source, text, terms, limit));
		}
		// The most of the query first, so excerpts explain in the order the
		// index would have scored them
		excerpts.sort((a, b) => b.shown - a.shown);
		return excerpts.slice(0, limit).map(({ source, text, ranges, shown }) => ({
			source,
			text,
			ranges,
			strength: shown / terms.length
		}));
	};

	/**
	 * The character ranges where a query matches within given texts, for
	 * highlighting matches in text obtained elsewhere -- the same ranges
	 * getMatchingExcerpts() marks in the excerpts it cuts itself, and likewise
	 * only for the terms BM25 can score with (see _getScoringTerms()). One
	 * entry per input text, each an array of merged, non-overlapping
	 * [start, end) pairs, empty when the text matches nothing.
	 *
	 * @param {String} queryText
	 * @param {String[]} texts
	 * @return {Promise<Array[]>}
	 */
	this.findMatchRanges = async function (queryText, texts) {
		let terms = await _getScoringTerms(this.parseQuery(queryText));
		return texts.map((text) => {
			if (!terms.length || !text) {
				return [];
			}
			return _mergeRanges(
				_findTermMatches(text, terms).map(m => [m.start, m.end])
			);
		});
	};

	/**
	 * The most an expression could score against an index: the sum of its
	 * terms' inverse document frequencies, counted the way FTS5 counts them.
	 *
	 * BM25 scores a term as its idf times a ratio that climbs toward K1 + 1 as
	 * a document repeats the term, so (K1 + 1) times the sum of the idfs is
	 * the score of a document that is about nothing but the query. Dividing by
	 * it turns an unbounded ranking into the share of the query a document
	 * carries, on one scale across indexes and queries alike. A repeated term
	 * counts each time, since BM25 scores it each time.
	 *
	 * One occurrence of every term in an average-length document reaches
	 * 1 / (K1 + 1) of this, so a plain full match reads as somewhat under
	 * half; the band above it belongs to texts that keep returning to the
	 * query's terms.
	 *
	 * @param {Object[]} pieces - buildExpression()'s pieces
	 * @param {String} table - The ftindex FTS5 table the expression runs against
	 * @return {Promise<Number>}
	 */
	async function _getCeiling(pieces, table) {
		// The floor FTS5 puts under an inverse document frequency. Its BM25
		// uses the unsmoothed idf, ln((N - df + 0.5) / (df + 0.5)), which
		// turns negative once a term is in more than about half the
		// documents; FTS5 clamps it here rather than let a term score against
		// a document for containing it. Mirrored so a ceiling is built from
		// the same numbers the index scored with.
		const FTS5_MIN_IDF = 1e-6;
		// FTS5's BM25 saturation constant, and the (K1 + 1) factor its
		// numerator carries: a term's contribution is
		// idf * tf * (K1 + 1) / (tf + K1 * (1 - B + B * D / avgdl)), so it
		// approaches (K1 + 1) * idf rather than idf as a document repeats the
		// term. A ceiling that left the factor out would sit below what a
		// document can actually score, and the strongest documents would all
		// read as a perfect match.
		const FTS5_K1 = 1.2;
		let corpusSize = await Zotero.DB.valueQueryAsync(
			"SELECT COUNT(*) FROM ftindex." + table);
		let ceiling = 0;
		for (let piece of pieces) {
			let df = await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM ftindex." + table
					+ " WHERE " + table + " MATCH ?",
				[piece.match]
			);
			df = Math.max(0, Math.min(df, corpusSize));
			ceiling += piece.repetitions * Math.max(
				FTS5_MIN_IDF,
				Math.log((corpusSize - df + 0.5) / (df + 0.5))
			);
		}
		return ceiling * (FTS5_K1 + 1);
	}

	// The terms BM25 can score with, of a query's terms. FTS5 floors the
	// inverse document frequency of a term in more than about half a corpus
	// (see FTS5_MIN_IDF), which is its way of saying the term separates
	// nothing there -- so such a term moves no score, and pointing at it as a
	// reason an item matched would be pointing at nothing. A term still
	// telling documents apart in either index is kept, since that's the index
	// its score came from.
	async function _getScoringTerms(terms) {
		let scoring = [];
		for (let term of terms) {
			let tables = term.type == 'cjk'
				? SOURCES.map(source => source.cjk)
				: SOURCES.map(source => source.word);
			let match = term.type == 'cjk'
				? (term.bigrams ? '"' + term.bigrams + '"' : '"' + term.text + '"*')
				: '"' + term.text + '"' + (term.prefix ? '*' : '');
			for (let table of tables) {
				let corpusSize = await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM ftindex." + table);
				if (!corpusSize) {
					continue;
				}
				let df = await Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM ftindex." + table
						+ " WHERE " + table + " MATCH ?",
					[match]
				);
				if (Math.log((corpusSize - Math.min(df, corpusSize) + 0.5)
						/ (Math.min(df, corpusSize) + 0.5)) > 0) {
					scoring.push(term);
					break;
				}
			}
		}
		// A query of nothing but corpus-filling words separates nothing
		// anywhere, and has only its own terms to point at
		return scoring.length ? scoring : terms;
	}

	// Notes whose index entries can't be trusted -- edited since their last
	// index update, or not indexed yet -- scored from their current text.
	// There are no corpus statistics for text the index hasn't seen, so a term
	// the text contains is read at full strength: the share of the query's
	// terms a note contains is its score. That reads a just-edited note as
	// generously as the query allows, which is the right way to be wrong about
	// the note the user was last working in.
	async function _scoreUnindexedNotes(terms, itemIDs) {
		let fractions = new Map();
		let noteIDs = await Zotero.FullText.getStaleOrUnindexedNoteIDs(itemIDs);
		if (!noteIDs.length) {
			return fractions;
		}
		let texts = await Zotero.FullText.getNoteSearchTexts(noteIDs);
		for (let [itemID, text] of texts) {
			if (!text) {
				continue;
			}
			let scan = _scanText(text);
			let present = terms.filter(term => _countTerm(term, scan)).length;
			if (present) {
				fractions.set(itemID, present / terms.length);
			}
		}
		return fractions;
	}

	// A CJK run's overlapping 2-grams, joined with spaces -- built the same
	// way the index builds them (see getCJKBigrams() in fulltext.js), which
	// is what makes them match. Null for a single character, which has none.
	function _getBigrams(run) {
		if (run.length < 2) {
			return null;
		}
		let bigrams = [];
		for (let i = 0; i < run.length - 1; i++) {
			bigrams.push(run.substr(i, 2));
		}
		return bigrams.join(' ');
	}

	// A text prepared for term counting: its token stream (word tokens and
	// CJK runs, in text order) and the normalized text itself, which is what
	// CJK terms and phrases match against
	function _scanText(text) {
		let tokens = [];
		for (let match of text.matchAll(TOKEN_RE)) {
			tokens.push(match.groups.cjk || match.groups.word);
		}
		return { text, tokens };
	}

	// Occurrences of a term in a scanned text, counted the way the indexes
	// match it: a word as a whole token (a prefix term by its completions), a
	// CJK run contiguously, a phrase literally (see _countPhrase())
	function _countTerm(term, scan) {
		if (term.type == 'cjk') {
			let count = 0;
			let index = scan.text.indexOf(term.text);
			while (index != -1) {
				count++;
				index = scan.text.indexOf(term.text, index + term.text.length);
			}
			return count;
		}
		if (term.type == 'phrase') {
			return _countPhrase(scan.text, term.text);
		}
		if (term.prefix) {
			return scan.tokens.filter(token => token.startsWith(term.text)).length;
		}
		return scan.tokens.filter(token => token === term.text).length;
	}

	// Occurrences of a phrase in normalized text: literal, except that
	// whitespace and hyphen runs separate the phrase's words interchangeably
	// -- extraction layout and compound styling vary them -- matching the
	// collapse the content verification applies (see findTextInString() in
	// fulltext.js). Word boundaries hold at both ends, so a phrase never
	// starts or ends inside a longer word.
	function _countPhrase(text, phrase) {
		let collapsed = text.replace(/[\s-]+/g, ' ');
		let count = 0;
		let index = collapsed.indexOf(phrase);
		while (index != -1) {
			let before = index > 0 ? collapsed[index - 1] : '';
			let after = collapsed[index + phrase.length] || '';
			if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) {
				count++;
			}
			index = collapsed.indexOf(phrase, index + 1);
		}
		return count;
	}

	// The texts an item can match a query in, per its type, labeled with the
	// source names excerpts report: a regular item's title and abstract, a
	// note's plain text, an annotation's passage and comment, a file
	// attachment's extracted fulltext from its cache file
	async function _getSourceTexts(item) {
		let sources = [];
		if (item.isAnnotation()) {
			for (let text of [item.annotationText, item.annotationComment]) {
				if (text) {
					sources.push({ source: 'annotation', text });
				}
			}
		}
		else if (item.isNote()) {
			let note = item.getNote();
			if (note) {
				let parserUtils = Cc["@mozilla.org/parserutils;1"]
					.getService(Ci.nsIParserUtils);
				let text = parserUtils.convertToPlainText(note,
					Ci.nsIDocumentEncoder.OutputRaw, 0);
				if (text) {
					sources.push({ source: 'note', text });
				}
			}
		}
		else if (item.isFileAttachment()) {
			let cacheFile = Zotero.FullText.getItemCacheFile(item).path;
			if (await IOUtils.exists(cacheFile)) {
				let text = await Zotero.File.getContentsAsync(cacheFile);
				if (text) {
					sources.push({ source: 'content', text });
				}
			}
		}
		else if (item.isRegularItem()) {
			let title = item.getField('title', false, true);
			if (title) {
				// Titles can carry the supported formatting tags; the excerpt
				// shows -- and locates matches in -- the visible text
				sources.push({
					source: 'title',
					text: title.replace(Zotero.Utilities.Internal._searchFormattingTagRE, '')
				});
			}
			let abstract = item.getField('abstractNote');
			if (abstract) {
				sources.push({ source: 'abstract', text: abstract });
			}
		}
		return sources;
	}

	// Cut a source text into up to `limit` excerpts around its term matches,
	// each window greedily covering the most distinct terms not yet shown.
	// Returns [{ source, text, ranges, shown }], where ranges are [start, end)
	// pairs relative to the excerpt's text and shown is how many distinct
	// terms the excerpt shows, for ordering excerpts across sources.
	function _excerptSource(source, text, terms, limit) {
		let matches = _findTermMatches(text, terms);
		let excerpts = [];
		let remaining = matches;
		while (remaining.length && excerpts.length < limit) {
			let best = null;
			for (let i = 0; i < remaining.length; i++) {
				let bounds = _windowBounds(text, remaining, i);
				let inside = matches.filter(
					m => m.start >= bounds.start && m.end <= bounds.end
				);
				let shown = new Set(inside.map(m => m.term)).size;
				if (!best || shown > best.shown) {
					best = { bounds, inside, shown };
				}
			}
			excerpts.push(_makeExcerpt(source, text, best));
			let left = remaining.filter(
				m => m.start < best.bounds.start || m.end > best.bounds.end
			);
			// A match wider than the window sits outside every window's
			// bounds; nothing can show it, so drop it rather than loop on it
			if (left.length == remaining.length) {
				left = remaining.slice(1);
			}
			remaining = left;
		}
		return excerpts;
	}

	// The window that shows the run of matches starting at matches[first]:
	// EXCERPT_WINDOW characters holding that match and as many of the
	// following ones as fit, centered on them, clamped to the text, and
	// nudged outward (a little) so it doesn't cut into a word
	function _windowBounds(text, matches, first) {
		// An excerpt's width in characters: wide enough to read a match in
		// context, narrow enough that several excerpts fit in a details pane
		const EXCERPT_WINDOW = 200;
		let anchor = matches[first];
		let last = anchor;
		for (let i = first + 1; i < matches.length; i++) {
			if (matches[i].end - anchor.start > EXCERPT_WINDOW) {
				break;
			}
			last = matches[i];
		}
		let slack = Math.max(0, EXCERPT_WINDOW - (last.end - anchor.start));
		let start = Math.max(0, anchor.start - Math.floor(slack / 2));
		let end = Math.min(text.length, start + EXCERPT_WINDOW);
		start = Math.max(0, Math.min(start, end - EXCERPT_WINDOW));
		let budget = 20;
		while (start > 0 && budget-- && !/\s/.test(text[start - 1])) {
			start--;
		}
		budget = 20;
		while (end < text.length && budget-- && !/\s/.test(text[end])) {
			end++;
		}
		return { start, end };
	}

	// One excerpt: the window's text with ellipses where it cuts into the
	// source, and its matches as merged ranges relative to that text
	function _makeExcerpt(source, text, { bounds, inside, shown }) {
		let prefix = bounds.start > 0 ? '…' : '';
		let suffix = bounds.end < text.length ? '…' : '';
		let ranges = _mergeRanges(inside.map(
			m => [m.start - bounds.start + prefix.length, m.end - bounds.start + prefix.length]
		));
		return {
			source,
			text: prefix + text.slice(bounds.start, bounds.end) + suffix,
			ranges,
			shown
		};
	}

	// Sorted, non-overlapping [start, end) ranges: overlapping and touching
	// input ranges (a word matched by two terms, say) merge into one
	function _mergeRanges(ranges) {
		ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
		let merged = [];
		for (let range of ranges) {
			let previous = merged[merged.length - 1];
			if (previous && range[0] <= previous[1]) {
				previous[1] = Math.max(previous[1], range[1]);
			}
			else {
				merged.push([range[0], range[1]]);
			}
		}
		return merged;
	}

	// Where each term matches in a text, as [{ start, end, term }] in text
	// order. Matching mirrors _countTerm() -- whole tokens for words, token
	// prefixes for prefix terms (highlighted as the whole token), contiguous
	// runs for CJK, literal collapsed phrases -- but runs over a normalized
	// copy that maps every position back to the original text, so the ranges
	// mark the text as written (case, diacritics and typographic variants
	// intact).
	function _findTermMatches(text, terms) {
		let { normalized, map } = _mapNormalized(text);
		let matches = [];
		let words = terms.filter(term => term.type == 'word');
		if (words.length) {
			let tokens = [...normalized.matchAll(TOKEN_RE)]
				.map(match => ({ text: match.groups.word, index: match.index }));
			for (let token of tokens) {
				if (!token.text) {
					continue;
				}
				for (let term of words) {
					if (term.prefix ? token.text.startsWith(term.text) : token.text === term.text) {
						matches.push({
							start: map[token.index],
							end: map[token.index + token.text.length],
							term
						});
					}
				}
			}
		}
		for (let term of terms) {
			if (term.type == 'cjk') {
				let index = normalized.indexOf(term.text);
				while (index != -1) {
					matches.push({
						start: map[index],
						end: map[index + term.text.length],
						term
					});
					index = normalized.indexOf(term.text, index + term.text.length);
				}
			}
			else if (term.type == 'phrase') {
				matches.push(..._findPhraseMatches(normalized, map, term));
			}
		}
		matches.sort((a, b) => a.start - b.start || a.end - b.end);
		return matches;
	}

	// A normalized copy of a text (see normalizeForSearch()) with a map from
	// every normalized position -- including one past the end -- back to the
	// original position it came from, so normalized match offsets translate
	// to ranges over the original text. Normalization is applied per
	// character, which matches the whole-string form except across character
	// boundaries (a base letter and a following combining mark fold the same
	// either way); a rare divergence costs a highlight, never a match.
	function _mapNormalized(text) {
		let normalized = '';
		let map = [];
		let position = 0;
		for (let char of text) {
			// ASCII normalizes to its own lowercase, so skip the full pipeline
			let folded = char.codePointAt(0) < 128
				? char.toLowerCase()
				: (Zotero.Utilities.Internal.normalizeForSearch(char) || '');
			for (let i = 0; i < folded.length; i++) {
				map.push(position);
			}
			normalized += folded;
			position += char.length;
		}
		map.push(text.length);
		return { normalized, map };
	}

	// Phrase occurrences located the way _countPhrase() counts them --
	// whitespace and hyphen runs interchangeable, word boundaries at both
	// ends -- with each occurrence mapped from the collapsed text through the
	// normalized text back to original positions
	function _findPhraseMatches(normalized, map, term) {
		let collapsed = '';
		let collapsedMap = [];
		let i = 0;
		while (i < normalized.length) {
			collapsedMap.push(i);
			if (/[\s-]/.test(normalized[i])) {
				collapsed += ' ';
				do {
					i++;
				}
				while (i < normalized.length && /[\s-]/.test(normalized[i]));
			}
			else {
				collapsed += normalized[i];
				i++;
			}
		}
		collapsedMap.push(normalized.length);
		let matches = [];
		let index = collapsed.indexOf(term.text);
		while (index != -1) {
			let before = index > 0 ? collapsed[index - 1] : '';
			let after = collapsed[index + term.text.length] || '';
			if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) {
				// A phrase ends on a word character, so the last collapsed
				// character is a single normalized one and its exclusive end
				// is the next normalized position
				let start = map[collapsedMap[index]];
				let end = map[collapsedMap[index + term.text.length - 1] + 1];
				matches.push({ start, end, term });
			}
			index = collapsed.indexOf(term.text, index + 1);
		}
		return matches;
	}
};
