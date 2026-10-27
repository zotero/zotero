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
 * Scores how well an item answers a query: any term can match and the
 * evidence adds up, so an item missing a word still ranks, below one that
 * has them all. Two kinds of text are scored by different rules:
 *
 * - Short texts -- an item's fields, creators, tags, its notes and
 *   annotations -- are matched through the data tables, with no index of
 *   their own, and scored by weighted coverage: the share of the query's
 *   terms a text carries, each term weighed by its rarity across the
 *   library's items and by the kind of text it matched in, so a title or a
 *   creator counts for more than a note (see KIND_FACTORS). Consecutive
 *   query words found together earn extra, as a phrase.
 * - Documents -- attachment fulltext -- are scored by FTS5's BM25 over the
 *   content index: parseQuery() breaks the query into terms and
 *   buildExpression() joins them into one OR expression. BM25 weighs a
 *   term by rarity, saturates repetition and discounts length; a document
 *   counts only where the query's terms occur close together (see
 *   buildProximityExpression()), and raw BM25 is divided by the most the
 *   expression could earn (see _getCeiling()) to give a 0-1 share.
 *
 * A document's share counts for less than a full short-text match (see
 * KIND_FACTORS), so a paper by Smith from 2019 outranks every paper that
 * cites "Smith 2019" in its text, however often. An item carrying both
 * kinds of evidence combines them, as does a parent with a matching child.
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
	// 'covid疫情' splits into a word and a run.
	const TOKEN_RE = new RegExp(
		`(?<cjk>[${CJK_CLASS}]+)|(?<word>(?:(?![${CJK_CLASS}])[\\p{L}\\p{N}])+)`,
		'gu'
	);
	// What a match in each kind of text is worth, as a share of a full match:
	// a title, a creator, a year or a tag names the work, an abstract or a
	// venue describes it, an annotation marks it. A document -- an
	// attachment's text, or a note, which can be as long -- only talks
	// about the query's words, so it can outrank an item naming some of
	// them, never one naming them all. A term matched in several kinds
	// counts by the best of them.
	const KIND_FACTORS = {
		title: 1,
		creator: 1,
		year: 1,
		tag: 1,
		citationKey: 1,
		publication: 0.9,
		abstract: 0.8,
		annotation: 0.7,
		content: 0.7,
		note: 0.7,
		field: 0.6
	};
	// What a consecutive pair of query words found together in one text is
	// worth, as a multiple of a word -- the ratio buildExpression() uses
	const PAIR_WEIGHT = 1 / 3;
	// BM25 as FTS5's bm25() computes it: the standard k1 and b, and the
	// floor it puts under a non-positive idf (a term in over half the corpus)
	const FTS5_K1 = 1.2;
	const FTS5_B = 0.75;
	const FTS5_MIN_IDF = 1e-6;
	// An excerpt's width in characters: wide enough to read a match in
	// context, narrow enough to fit on a row
	const EXCERPT_WINDOW = 200;

	// The index documents are scored against, per term family: a word table
	// and a CJK 2-gram table over the same documents
	const CONTENT_TABLES = { word: 'fulltextContent', cjk: 'fulltextContentCJK' };

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
	 * - a word: { type: 'word', text, prefix }. A word the query wrote a
	 *   trailing asterisk after is flagged `prefix` and matches the word's
	 *   completions. Inside quotes an asterisk is literal text.
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
	 * on its own and with an asterisk, the exact form wins.
	 *
	 * @param {String} queryText
	 * @return {Object[]}
	 */
	this.parseQuery = function (queryText) {
		if (!queryText) {
			return [];
		}
		let parts = Zotero.SearchConditions.parseSearchString(queryText);
		let terms = [];
		for (let part of parts) {
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
				terms.push({ type: 'phrase', text: words.join(' '), tokens: words });
				continue;
			}
			for (let match of matches) {
				if (match.groups.cjk) {
					terms.push({
						type: 'cjk',
						text: match.groups.cjk,
						bigrams: _getBigrams(match.groups.cjk)
					});
				}
				else {
					terms.push({
						type: 'word',
						text: match.groups.word,
						// An asterisk the query wrote after the word, which
						// TOKEN_RE leaves out of the token itself
						prefix: !part.inQuotes
							&& normalized[match.index + match[0].length] === '*'
					});
				}
			}
		}
		let deduped = new Map();
		for (let term of terms) {
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
	 * for beyond the words themselves -- with the word terms repeated to
	 * keep those phrases from deciding the ranking on their own.
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
			// Times each word is repeated against one occurrence of each phrase.
			// A repeat counts again in BM25, the only way to weigh terms in an
			// expression; unrepeated, an accidental adjacency ("change adaptation"
			// in "climate change adaptation in bangladesh") outweighs the words.
			const WORD_REPETITION = 3;
			let words = terms.filter(term => term.type == 'word');
			for (let term of terms) {
				if (term.type == 'word') {
					pieces.push({
						match: '"' + term.text + '"' + (term.prefix ? '*' : ''),
						repetitions: WORD_REPETITION
					});
				}
				else if (term.type == 'phrase') {
					pieces.push({ match: '"' + term.text + '"', repetitions: 1 });
				}
			}
			// Consecutive query words, as the query wrote them. A pair whose
			// second word carries an asterisk matches its completions too.
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
	 * The FTS5 expression a document matches only where enough of a query's
	 * terms occur within a window of each other: a NEAR group over the
	 * required number of the family's terms, one group per way of choosing
	 * them, joined with OR. Callers pass the terms BM25 scores with, so a
	 * word the corpus is full of isn't required.
	 *
	 * @param {Object[]} terms - Terms from parseQuery()
	 * @param {String} family - 'word' or 'cjk', as for buildExpression()
	 * @return {String|null} - Null when the family has fewer than two terms,
	 *     which have nothing to be close to
	 */
	this.buildProximityExpression = function (terms, family) {
		// Tokens the terms may span: about a page
		const WINDOW = 200;
		// Share of the terms the window must hold: all of them up to three,
		// so a short query gets the words it names; a longer one may miss one
		const COVERAGE = 0.75;
		// Terms past this are ignored, bounding the number of groups
		const MAX_TERMS = 8;
		let matches = terms
			.filter(term => (term.type == 'cjk') == (family == 'cjk'))
			.slice(0, MAX_TERMS)
			.map(_termMatch);
		if (matches.length < 2) {
			return null;
		}
		let required = Math.ceil(matches.length * COVERAGE);
		return _combinations(matches, required)
			.map(group => 'NEAR(' + group.join(' ') + ', ' + WINDOW + ')')
			.join(' OR ');
	};

	/**
	 * Score a given set of items by how well their text answers a query.
	 *
	 * An item's short texts -- its fields, creators and tags, a note's or an
	 * annotation's text -- are scored by weighted coverage (see
	 * _scoreShortTexts()): the share of the query they carry, where a term
	 * is worth its rarity across the library and the kind of text it was
	 * found in. An attachment's fulltext is a document, scored by BM25 as a
	 * share of what the query could earn (see _scoreDocuments()) and worth
	 * less than a full short-text match (see KIND_FACTORS). An item with
	 * both kinds of evidence combines them, and a matched item whose child
	 * matched too combines the child's best score with its own. Items below
	 * SCORE_FLOOR aren't matches and aren't returned.
	 *
	 * @param {String} queryText
	 * @param {Number[]} itemIDs - Candidate item IDs to score
	 * @param {Object} [options]
	 * @param {Function} [options.shouldCancel] - Checked between stages;
	 *     return true to abandon scoring with a ScoringCancelledError
	 * @return {Promise<Object>} - { scores, matches }: scores maps itemID ->
	 *     score (0-1, higher is better); matches maps each scored itemID ->
	 *     where the query matched it: { fields, creators, tags, note,
	 *     annotation, content, terms } -- Sets of fieldIDs, creator
	 *     positions and tagIDs, whether its note, annotation or fulltext
	 *     matched, and the terms its short texts were scored with, for
	 *     marking them (see findHighlightRanges())
	 */
	this.scoreItemIDs = async function (queryText, itemIDs, { shouldCancel } = {}) {
		// Scores below this aren't matches and aren't returned: the share of
		// the query an item has to carry. Provisional until tuned against a
		// real library.
		const SCORE_FLOOR = 0.05;
		let scores = new Map();
		let matches = new Map();
		let terms = this.parseQuery(queryText);
		if (!itemIDs.length || !terms.length) {
			return { scores, matches };
		}
		let checkCancel = () => {
			if (shouldCancel && shouldCancel()) {
				throw new this.ScoringCancelledError();
			}
		};
		let candidates = new Set(itemIDs);
		let shortTexts = await _scoreShortTexts(terms, itemIDs, checkCancel);
		let documents = await _scoreDocuments(terms, candidates, checkCancel);
		let own = new Map();
		let records = new Map();
		for (let [itemID, { score, record }] of shortTexts) {
			own.set(itemID, score);
			records.set(itemID, record);
		}
		for (let [itemID, share] of documents) {
			own.set(itemID, _either(own.get(itemID) || 0, share * KIND_FACTORS.content));
			let record = records.get(itemID) || _newMatchRecord();
			record.content = true;
			records.set(itemID, record);
		}
		// A child's evidence joins its top-level item's own. A parent with no
		// evidence of its own is left to inherit the child's rank from the
		// consumer, so it shows as placed by the child rather than matched.
		let childBest = new Map();
		for (let [itemID, score] of own) {
			let item = Zotero.Items.get(itemID);
			let top = item ? item.topLevelItem.id : itemID;
			if (top != itemID && own.has(top)) {
				childBest.set(top, Math.max(childBest.get(top) || 0, score));
			}
		}
		for (let [top, best] of childBest) {
			own.set(top, _either(own.get(top), best));
		}
		for (let [itemID, score] of own) {
			if (score >= SCORE_FLOOR) {
				scores.set(itemID, score);
				matches.set(itemID, records.get(itemID));
			}
		}
		return { scores, matches };
	};

	/**
	 * Where given terms match in a text, for marking a field's text where it
	 * is shown: merged, non-overlapping [start, end) pairs, in text order.
	 * The terms are matched the way short texts are scored -- a word as a
	 * whole token, or by its completions when the query wrote an asterisk
	 * after it -- so a mark explains a score.
	 *
	 * @param {Object[]} terms - Terms as scoreItemIDs() records them
	 * @param {String} text
	 * @return {Array[]}
	 */
	this.findHighlightRanges = function (terms, text) {
		if (!terms?.length || !text) {
			return [];
		}
		return _mergeRanges(_findTermMatches(text, terms).map(m => [m.start, m.end]));
	};

	/**
	 * Excerpts of an item's own text around the places a query matches, for
	 * showing why the item ranks. Each excerpt names its source -- per the
	 * item's type: 'title', 'abstract', 'creator', 'tag', 'date' and
	 * 'publication' for a regular item, 'content' for a file attachment's
	 * extracted fulltext, 'note' or 'annotation' -- and carries the matched
	 * character ranges within its text, for highlighting. Long texts are cut
	 * to windows around their densest clusters of matches, marked with
	 * ellipses where they cut; excerpts showing the most of the query come
	 * first. An item whose own text matches nothing gets no excerpts.
	 *
	 * Only the terms BM25 can score with are shown (see _getScoringTerms()),
	 * so an excerpt points at what actually ranked the item. Each excerpt's
	 * `strength` is the share of those terms it shows, so excerpts can be
	 * ordered against other relevance evidence for the item.
	 *
	 * @param {String} queryText
	 * @param {Number} itemID
	 * @param {Object} [options]
	 * @param {Number} [options.limit=5] - Most excerpts to return; Infinity
	 *     for every excerpt the item's matches cut into
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
	 * Where to quote a text from to show the query in it: the sentence where
	 * the query's distinct terms weigh the most by rarity, the first on a
	 * tie. A sentence longer than `longSentence` also comes with the `line`
	 * of it to quote: the run of whole words at least `width` long where the
	 * terms weigh the most, its matches nearest its middle on a tie.
	 *
	 * @param {String} queryText
	 * @param {String} text
	 * @param {Object[]} sentences - The text's sentences, each { start, end }
	 * @param {Object} options
	 * @param {Number} options.longSentence
	 * @param {Number} options.width
	 * @return {Promise<Object|null>} - { sentence, line }, `line` being
	 *     { start, end, startsSentence } and only for a long sentence, or null
	 *     when no sentence says the query
	 */
	this.pickQuote = async function (queryText, text, sentences, { longSentence, width }) {
		let terms = await _getScoringTerms(this.parseQuery(queryText));
		if (!terms.length || !text) {
			return null;
		}
		let matches = _findTermMatches(text, terms).sort((a, b) => a.start - b.start);
		let sentence = _heaviestSentence(matches, sentences);
		if (!sentence) {
			return null;
		}
		if (sentence.end - sentence.start <= longSentence) {
			return { sentence };
		}
		return { sentence, line: _heaviestLine(text, matches, sentence, width) };
	};

	/**
	 * How much of a query each of the given texts carries, on the same 0-1
	 * scale as scoreItemIDs(): each text's BM25 score over the terms BM25 can
	 * score with, divided by what a text about nothing but the query could
	 * earn.
	 *
	 * For weighing passages of one document against each other, where the
	 * texts are in hand but not in an index of their own. Term rarity is
	 * counted over the given texts themselves: within a document, the
	 * discriminating term is the one rare there. A query word the whole
	 * document is about appears in every passage, so it says nothing about
	 * which passage answers the query -- however rare it is in the corpus
	 * that surfaced the document. Length is normalized against the texts'
	 * own average, so a passage is long or short relative to its siblings.
	 *
	 * @param {String} queryText
	 * @param {String[]} texts
	 * @return {Promise<Number[]>} - A 0-1 score for each text, in order
	 */
	this.scoreTexts = async function (queryText, texts) {
		let none = texts.map(() => 0);
		let parsed = this.parseQuery(queryText);
		if (!parsed.length || !texts.length) {
			return none;
		}
		let terms = await _getScoringTerms(parsed);
		if (!terms.length) {
			return none;
		}
		let lengths = texts.map(text => (text || '').length);
		let averageLength = lengths.reduce((sum, length) => sum + length, 0) / texts.length;
		if (!averageLength) {
			return none;
		}
		let counts = texts.map((text) => {
			let perText = new Map();
			for (let match of _findTermMatches(text || '', terms)) {
				perText.set(match.term, (perText.get(match.term) || 0) + 1);
			}
			return perText;
		});
		// The smoothed BM25 idf (the +1 keeps it positive), so a term in
		// every text still separates texts of one and of many occurrences a
		// little
		let weighted = terms.map((term) => {
			let df = counts.reduce((sum, perText) => sum + (perText.has(term) ? 1 : 0), 0);
			return {
				term,
				idf: Math.log(1 + (texts.length - df + 0.5) / (df + 0.5))
			};
		});
		let ceiling = weighted.reduce((sum, entry) => sum + entry.idf, 0) * (FTS5_K1 + 1);
		return texts.map((text, i) => {
			if (!text) {
				return 0;
			}
			let score = 0;
			for (let { term, idf } of weighted) {
				let tf = counts[i].get(term) || 0;
				if (!tf) {
					continue;
				}
				score += idf * tf * (FTS5_K1 + 1)
					/ (tf + FTS5_K1 * (1 - FTS5_B + FTS5_B * lengths[i] / averageLength));
			}
			return Math.min(1, score / ceiling);
		});
	};

	// Every way of choosing `size` of the items, in order
	function _combinations(items, size) {
		if (size == 0) {
			return [[]];
		}
		let groups = [];
		items.forEach((item, i) => {
			for (let rest of _combinations(items.slice(i + 1), size - 1)) {
				groups.push([item, ...rest]);
			}
		});
		return groups;
	}

	// The FTS5 MATCH expression matching one term, as buildExpression() writes
	// it, for counting the documents a term is in
	function _termMatch(term) {
		return term.type == 'cjk'
			? (term.bigrams ? '"' + term.bigrams + '"' : '"' + term.text + '"*')
			: '"' + term.text + '"' + (term.prefix ? '*' : '');
	}

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

	// The scoring terms of the last query asked about. Deciding them costs a
	// document-frequency count per term per index, and every matched item asks
	// the same question about the same query.
	let _scoringTermsCache = null;

	// The terms BM25 can score with, of a query's terms (see
	// _computeScoringTerms()), kept for the query last asked about
	async function _getScoringTerms(terms) {
		let key = terms.map(
			term => term.type + '\u0000' + term.text + '\u0000' + !!term.prefix
		).join('\u0001');
		if (_scoringTermsCache && _scoringTermsCache.key === key) {
			return _scoringTermsCache.scoring;
		}
		let scoring = await _computeScoringTerms(terms);
		_scoringTermsCache = { key, scoring };
		return scoring;
	}

	// The terms that move a document's score: FTS5 floors the idf of a term
	// in more than about half a corpus (FTS5_MIN_IDF), so such a term
	// separates nothing and isn't a reason an item matched. One that still
	// separates documents in the content index is kept, weighted by its
	// smoothed idf there.
	async function _computeScoringTerms(terms) {
		let scoring = [];
		for (let term of terms) {
			let table = CONTENT_TABLES[term.type == 'cjk' ? 'cjk' : 'word'];
			let corpusSize = await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM ftindex." + table);
			if (!corpusSize) {
				continue;
			}
			let df = Math.min(corpusSize, await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM ftindex." + table
					+ " WHERE " + table + " MATCH ?",
				[_termMatch(term)]
			));
			if (Math.log((corpusSize - df + 0.5) / (df + 0.5)) > 0) {
				scoring.push({
					...term,
					weight: Math.log(1 + (corpusSize - df + 0.5) / (df + 0.5))
				});
			}
		}
		// A query of nothing but corpus-filling words separates nothing
		// anywhere, and has only its own terms to point at
		return scoring.length ? scoring : terms;
	}

	//
	// Documents
	//

	// Score the candidate documents in the content index: each family's
	// expression is asked once, for every document matching any of the
	// query's terms, and reports BM25's own ranking, which a document only
	// keeps where the query's terms occur close together (see
	// buildProximityExpression()). The ranking is returned as a fraction of
	// what the query could earn (see _getCeiling()), so it reads as the
	// share of the query a document carries: rarer terms move it most, a
	// document missing a term forfeits that term's share, and repetition
	// beyond the point where a text is clearly about a term adds nothing.
	//
	// @return {Promise<Map>} - rowid -> share, the best across the families
	async function _scoreDocuments(terms, candidates, checkCancel) {
		let shares = new Map();
		let scoring = await _getScoringTerms(terms);
		for (let [family, table] of Object.entries(CONTENT_TABLES)) {
			checkCancel();
			let built = Zotero.Lexical.buildExpression(terms, family);
			if (!built) {
				continue;
			}
			// The MATCH runs unconstrained and the candidate filter is
			// applied here: a full scan for a common term costs
			// milliseconds, while constraining the same MATCH to a rowid
			// set makes FTS5 evaluate the expression per row, which at
			// library scale costs seconds.
			let rows = await Zotero.DB.queryAsync(
				"SELECT rowid, bm25(" + table + ") AS score FROM ftindex." + table
					+ " WHERE " + table + " MATCH ?",
				[built.expression]
			);
			rows = rows.map(row => ({ rowid: row.rowid, rank: row.score }))
				.filter(row => candidates.has(row.rowid));
			if (!rows.length) {
				continue;
			}
			let proximity = Zotero.Lexical.buildProximityExpression(scoring, family);
			if (proximity) {
				let close = new Set(await Zotero.DB.columnQueryAsync(
					"SELECT rowid FROM ftindex." + table
						+ " WHERE " + table + " MATCH ?",
					[proximity]
				));
				rows = rows.filter(row => close.has(row.rowid));
				if (!rows.length) {
					continue;
				}
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
				let share = Math.min(1, -row.rank / scale);
				if (!(shares.get(row.rowid) >= share)) {
					shares.set(row.rowid, share);
				}
			}
		}
		return shares;
	}

	// Two pieces of evidence for one item, combined: each fills the share of
	// doubt the other leaves, so both together beat either alone and never
	// exceed 1
	function _either(a, b) {
		return 1 - (1 - a) * (1 - b);
	}

	//
	// Short texts
	//

	// A word that reads as a year, which the date fields match exactly
	function _isYearTerm(term) {
		return term.type == 'word' && /^[12]\d{3}$/.test(term.text);
	}

	function _newMatchRecord() {
		return {
			fields: new Set(),
			creators: new Set(),
			tags: new Set(),
			note: false,
			annotation: false,
			content: false,
			// The terms the short texts were scored with, for marking the
			// same matches the score counted
			terms: null
		};
	}

	// Score the candidates' short texts by weighted coverage. A term's weight
	// is its smoothed BM25 idf over the library's top-level items: an item
	// reached through any kind of text -- its own fields, its creators and
	// tags, a child note or annotation -- counts once, so the weight says
	// how selective the term is in this library whatever kind it matched.
	// Terms in over half the items separate nothing and are left out,
	// unless every term is one. A text's score is the summed weight of the
	// terms it carries, each by the factor of the best kind it matched in,
	// over the summed weight of the query; a consecutive pair of query
	// words found together in one text adds PAIR_WEIGHT of a word, with
	// the same allowance in the denominator, so a full score needs the
	// pairs too. No length term: a title or an abstract is as long as it
	// is.
	//
	// @return {Promise<Map>} - itemID -> { score, record }, the record being
	//     where the item matched (see scoreItemIDs())
	async function _scoreShortTexts(terms, itemIDs, checkCancel) {
		let results = new Map();
		let libraryIDs = _getLibraryIDs(itemIDs);
		if (!libraryIDs.length) {
			return results;
		}
		let candidates = new Set(itemIDs);
		let poolSize = await _getPoolSize(libraryIDs);
		let lookups = [];
		for (let term of terms) {
			checkCancel();
			lookups.push(await _lookupShortTexts(term, libraryIDs));
		}
		let weighted = terms.map((term, i) => {
			let df = _countTopLevel(lookups[i].keys());
			return {
				term,
				hits: lookups[i],
				idf: Math.log(1 + (poolSize - df + 0.5) / (df + 0.5)),
				separates: Math.log((poolSize - df + 0.5) / (df + 0.5)) > 0
			};
		});
		let scoring = weighted.filter(entry => entry.separates);
		if (!scoring.length) {
			scoring = weighted;
		}
		// Consecutive query words, as the query wrote them
		let pairs = [];
		for (let i = 0; i < scoring.length - 1; i++) {
			let [a, b] = [scoring[i], scoring[i + 1]];
			if (a.term.type == 'word' && b.term.type == 'word') {
				pairs.push({
					first: i,
					second: i + 1,
					phrase: a.term.text + ' ' + b.term.text,
					idf: (a.idf + b.idf) / 2
				});
			}
		}
		let ceiling = scoring.reduce((sum, entry) => sum + entry.idf, 0)
			+ PAIR_WEIGHT * pairs.reduce((sum, pair) => sum + pair.idf, 0);
		if (!ceiling) {
			return results;
		}
		let scoringTerms = scoring.map(entry => entry.term);
		// Per candidate: the kinds each term matched in, and the texts
		// matched per kind, for finding the pairs in them
		let matched = new Map();
		for (let [i, entry] of scoring.entries()) {
			for (let [itemID, hit] of entry.hits) {
				if (!candidates.has(itemID)) {
					continue;
				}
				let item = matched.get(itemID);
				if (!item) {
					item = {
						kinds: new Map(),
						texts: new Map(),
						record: { ..._newMatchRecord(), terms: scoringTerms }
					};
					matched.set(itemID, item);
				}
				item.kinds.set(i, _bestKind(hit.kinds));
				for (let [kind, texts] of hit.texts) {
					let known = item.texts.get(kind) || new Set();
					for (let text of texts) {
						known.add(text);
					}
					item.texts.set(kind, known);
				}
				_mergeMatchRecord(item.record, hit.record);
			}
		}
		for (let [itemID, item] of matched) {
			let earned = 0;
			for (let [i, kind] of item.kinds) {
				earned += scoring[i].idf * KIND_FACTORS[kind];
			}
			for (let pair of pairs) {
				if (!item.kinds.has(pair.first) || !item.kinds.has(pair.second)) {
					continue;
				}
				let kind = _bestKind([...item.texts]
					.filter(([, texts]) => [...texts].some(text => _countPhrase(text, pair.phrase)))
					.map(([kind]) => kind));
				if (kind) {
					earned += PAIR_WEIGHT * pair.idf * KIND_FACTORS[kind];
				}
			}
			results.set(itemID, { score: Math.min(1, earned / ceiling), record: item.record });
		}
		return results;
	}

	// The kind worth the most of those given, or null for none
	function _bestKind(kinds) {
		let best = null;
		for (let kind of kinds) {
			if (!best || KIND_FACTORS[kind] > KIND_FACTORS[best]) {
				best = kind;
			}
		}
		return best;
	}

	function _mergeMatchRecord(into, from) {
		for (let key of ['fields', 'creators', 'tags']) {
			for (let value of from[key]) {
				into[key].add(value);
			}
		}
		into.note = into.note || from.note;
		into.annotation = into.annotation || from.annotation;
	}

	// The libraries the candidates are in, from the loaded items: the
	// candidates come from a view, whose items are loaded
	function _getLibraryIDs(itemIDs) {
		let libraryIDs = new Set();
		for (let itemID of itemIDs) {
			let item = Zotero.Items.get(itemID);
			if (item) {
				libraryIDs.add(item.libraryID);
			}
		}
		return [...libraryIDs];
	}

	// The number of top-level items in the libraries -- what a term's
	// document frequency is counted against
	async function _getPoolSize(libraryIDs) {
		return Zotero.DB.valueQueryAsync(
			"SELECT COUNT(*) FROM items WHERE libraryID IN (" + libraryIDs.join(',') + ") "
				+ "AND itemTypeID<>? "
				+ "AND itemID NOT IN (SELECT itemID FROM itemAttachments WHERE parentItemID IS NOT NULL) "
				+ "AND itemID NOT IN (SELECT itemID FROM itemNotes WHERE parentItemID IS NOT NULL)",
			[Zotero.ItemTypes.getID('annotation')]
		);
	}

	// How many distinct top-level items a set of matched items reaches
	function _countTopLevel(itemIDs) {
		let topLevel = new Set();
		for (let itemID of itemIDs) {
			let item = Zotero.Items.get(itemID);
			topLevel.add(item ? item.topLevelItem.id : itemID);
		}
		return topLevel.size;
	}

	function _normalize(text) {
		return Zotero.Utilities.Internal.normalizeForSearch(text || '') || '';
	}

	// The LIKE pattern finding a term's text anywhere in a value: the coarse
	// filter the data tables answer, refined by matching the term properly
	// in the values returned
	function _likePattern(text) {
		return '%' + text.replace(/[\\%_]/g, '\\$&') + '%';
	}

	// The kind of short text a field is, or 'year' when a year term starts
	// a date field's value. Null when a date field holds something else.
	let _fieldKinds = null;
	function _fieldKind(fieldID, term, value) {
		if (!_fieldKinds) {
			let kinds = new Map();
			let name = (fieldName, kind) => kinds.set(Zotero.ItemFields.getID(fieldName), kind);
			let base = (fieldName, kind) => {
				name(fieldName, kind);
				for (let id of Zotero.ItemFields.getTypeFieldsFromBase(fieldName) || []) {
					kinds.set(id, kind);
				}
			};
			base('title', 'title');
			base('publicationTitle', 'publication');
			base('date', 'date');
			name('shortTitle', 'publication');
			name('abstractNote', 'abstract');
			name('citationKey', 'citationKey');
			_fieldKinds = kinds;
		}
		let kind = _fieldKinds.get(fieldID) || 'field';
		if (kind == 'date') {
			return _isYearTerm(term) && value.startsWith(term.text) ? 'year' : null;
		}
		return kind;
	}

	// Every item in the libraries a term matches in a short text, with what
	// it matched. The data tables are asked with LIKE for the term's text
	// anywhere in a value -- the index they have -- and each returned value
	// is then matched the way the term matches (a word as a whole token, or
	// by its completions after an asterisk), against its normalized form.
	// Notes go through the note index's own
	// predicate, which handles notes edited since they were indexed, and
	// are read back as their searchable text; terms the note index can't
	// answer don't search notes, as the quick search doesn't.
	//
	// @return {Promise<Map>} - itemID -> { kinds, texts, record }: the kinds
	//     matched, the normalized texts matched per kind, and the match
	//     record (see scoreItemIDs())
	async function _lookupShortTexts(term, libraryIDs) {
		let hits = new Map();
		let hit = (itemID) => {
			let entry = hits.get(itemID);
			if (!entry) {
				entry = { kinds: new Set(), texts: new Map(), record: _newMatchRecord() };
				hits.set(itemID, entry);
			}
			return entry;
		};
		let add = (itemID, kind, text) => {
			let entry = hit(itemID);
			entry.kinds.add(kind);
			let texts = entry.texts.get(kind) || new Set();
			texts.add(text);
			entry.texts.set(kind, texts);
			return entry;
		};
		let matches = text => _countTerm(term, _scanText(text)) > 0;
		let inLibraries = "I.libraryID IN (" + libraryIDs.join(',') + ")";
		let pattern = _likePattern(term.text);

		let rows = await Zotero.DB.queryAsync(
			"SELECT ID.itemID, ID.fieldID, COALESCE(IDV.valueNormalized, IDV.value) AS value "
				+ "FROM itemData ID JOIN itemDataValues IDV USING (valueID) "
				+ "JOIN items I USING (itemID) "
				+ "WHERE " + inLibraries + " "
				+ "AND COALESCE(IDV.valueNormalized, IDV.value) LIKE ? ESCAPE '\\'",
			[pattern]
		);
		for (let row of rows) {
			let value = _normalize(String(row.value));
			let kind = _fieldKind(row.fieldID, term, value);
			if (!kind || (kind != 'year' && !matches(value))) {
				continue;
			}
			add(row.itemID, kind, value).record.fields.add(row.fieldID);
		}

		rows = await Zotero.DB.queryAsync(
			"SELECT IC.itemID, IC.orderIndex, "
				+ "COALESCE(C.firstNameNormalized, C.firstName) AS firstName, "
				+ "COALESCE(C.lastNameNormalized, C.lastName) AS lastName "
				+ "FROM itemCreators IC JOIN creators C USING (creatorID) "
				+ "JOIN items I USING (itemID) "
				+ "WHERE " + inLibraries + " "
				+ "AND (COALESCE(C.lastNameNormalized, C.lastName) LIKE ? ESCAPE '\\' "
				+ "OR COALESCE(C.firstNameNormalized, C.firstName) LIKE ? ESCAPE '\\')",
			[pattern, pattern]
		);
		for (let row of rows) {
			let name = _normalize([row.firstName, row.lastName].filter(Boolean).join(' '));
			if (!matches(name)) {
				continue;
			}
			add(row.itemID, 'creator', name).record.creators.add(row.orderIndex);
		}

		rows = await Zotero.DB.queryAsync(
			"SELECT IT.itemID, IT.tagID, COALESCE(T.nameNormalized, T.name) AS name "
				+ "FROM itemTags IT JOIN tags T USING (tagID) JOIN items I USING (itemID) "
				+ "WHERE " + inLibraries + " "
				+ "AND COALESCE(T.nameNormalized, T.name) LIKE ? ESCAPE '\\'",
			[pattern]
		);
		for (let row of rows) {
			let name = _normalize(row.name);
			if (!matches(name)) {
				continue;
			}
			add(row.itemID, 'tag', name).record.tags.add(row.tagID);
		}

		rows = await Zotero.DB.queryAsync(
			"SELECT IA.itemID, COALESCE(IA.textNormalized, IA.text) AS text, "
				+ "COALESCE(IA.commentNormalized, IA.comment) AS comment "
				+ "FROM itemAnnotations IA JOIN items I USING (itemID) "
				+ "WHERE " + inLibraries + " "
				+ "AND (COALESCE(IA.textNormalized, IA.text) LIKE ? ESCAPE '\\' "
				+ "OR COALESCE(IA.commentNormalized, IA.comment) LIKE ? ESCAPE '\\')",
			[pattern, pattern]
		);
		for (let row of rows) {
			for (let text of [row.text, row.comment]) {
				text = _normalize(text);
				if (text && matches(text)) {
					add(row.itemID, 'annotation', text).record.annotation = true;
				}
			}
		}

		if (term.type != 'word' || Zotero.FullText.canSearchNotes(term.text)) {
			let noteIDs = await _lookupNotes(term, libraryIDs, pattern);
			if (noteIDs.length) {
				let texts = await Zotero.FullText.getNoteSearchTexts(noteIDs);
				for (let [itemID, text] of texts) {
					if (!text || !matches(text)) {
						continue;
					}
					add(itemID, 'note', text).record.note = true;
				}
			}
		}
		return hits;
	}

	// The notes in the libraries whose text may contain a term: by the note
	// index's predicate, or by a scan of the stored notes while the index
	// is still being built. A note the index has no record of at all -- not
	// even the stale marker a save writes -- is scanned as stored too.
	async function _lookupNotes(term, libraryIDs, pattern) {
		let noteMatch = await Zotero.FullText.getNoteContentSQL(term.text);
		// The predicate names itemID unqualified, so no join
		let sql = "SELECT itemID FROM itemNotes WHERE itemID IN "
			+ "(SELECT itemID FROM items WHERE libraryID IN (" + libraryIDs.join(',') + ")) AND ";
		let scan = "note LIKE ? ESCAPE '\\'";
		if (noteMatch) {
			return Zotero.DB.columnQueryAsync(
				sql + "(" + noteMatch.sql + " OR (itemID NOT IN "
					+ "(SELECT itemID FROM ftindex.fulltextNoteIndexState) AND " + scan + "))",
				[...noteMatch.params, pattern]
			);
		}
		return Zotero.DB.columnQueryAsync(sql + scan, [pattern]);
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
	// source names excerpts report: a regular item's title, abstract,
	// creators, tags, date and venue, a note's plain text, an annotation's
	// passage and comment, a file attachment's extracted fulltext from its
	// cache file
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
			for (let creator of item.getCreators()) {
				let name = [creator.firstName, creator.lastName].filter(Boolean).join(' ');
				if (name) {
					sources.push({ source: 'creator', text: name });
				}
			}
			for (let { tag } of item.getTags()) {
				sources.push({ source: 'tag', text: tag });
			}
			let date = item.getField('date');
			if (date) {
				sources.push({ source: 'date', text: date });
			}
			let publication = item.getField('publicationTitle', false, true);
			if (publication) {
				sources.push({ source: 'publication', text: publication });
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
			// bounds; nothing can show it, so drop it
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

	// How much of the query text[start, end) says: the summed weights of the
	// distinct terms matched wholly inside it
	function _termWeight(matches, start, end) {
		let weights = new Map();
		for (let match of matches) {
			if (match.start >= start && match.end <= end) {
				weights.set(match.term.text, match.term.weight ?? 1);
			}
		}
		let sum = 0;
		for (let weight of weights.values()) {
			sum += weight;
		}
		return sum;
	}

	// The sentence where the query's terms weigh the most, the first on a
	// tie, or null when none holds a match
	function _heaviestSentence(matches, sentences) {
		let best = null;
		let bestWeight = 0;
		for (let sentence of sentences) {
			let weight = _termWeight(matches, sentence.start, sentence.end);
			if (weight > bestWeight) {
				best = sentence;
				bestWeight = weight;
			}
		}
		return best;
	}

	// The run of whole words at least `width` long in a sentence where the
	// query's terms weigh the most, the one with its matches nearest its
	// middle on a tie
	function _heaviestLine(text, matches, sentence, width) {
		let words = [...text.slice(sentence.start, sentence.end).matchAll(/\S+/g)].map((word) => {
			let start = sentence.start + word.index;
			return { start, end: start + word[0].length };
		});
		let best = null;
		for (let i = 0, j = 0; i < words.length; i++) {
			j = Math.max(j, i);
			while (j < words.length && words[j].end - words[i].start < width) {
				j++;
			}
			// Runs from later words fall short of the width
			if (j == words.length) {
				break;
			}
			let start = words[i].start;
			let end = words[j].end;
			let inside = matches.filter(match => match.start >= start && match.end <= end);
			let weight = _termWeight(inside, start, end);
			let offset = inside.length
				? Math.abs((inside[0].start + inside[inside.length - 1].end) - (start + end)) / 2
				: Infinity;
			if (!best || weight > best.weight || (weight == best.weight && offset < best.offset)) {
				best = { start, end, weight, offset };
			}
		}
		if (!best) {
			return { start: sentence.start, end: sentence.end, startsSentence: true };
		}
		return { start: best.start, end: best.end, startsSentence: best.start == sentence.start };
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
