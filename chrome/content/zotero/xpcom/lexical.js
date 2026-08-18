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
 * Scores how well a text answers a query rather than whether it contains
 * every word of it: any term can match, and a score accumulates the
 * evidence, so a document about owl migration in Norway still scores for
 * "owl migration in the united states" -- below the documents that cover
 * all of it.
 *
 * parseQuery() breaks a query into scoring units (words, quoted phrases,
 * CJK runs), and analyzeQuery() weighs each unit by how rare it is in the
 * user's own corpus, so that in "fall of communism", "communism" is what
 * mostly decides a score, "fall" counts a little, and "of" barely at all --
 * no stoplist, nothing curated by hand. Consecutive informative words also
 * form weighted pair units, so a text saying "special education" outscores
 * one that has the words scattered.
 *
 * The statistics behind the weights are document frequencies counted across
 * both of ftindex's word-level corpora (see Zotero.FullText): attachment
 * content and item text (titles, abstracts, notes, annotations). One count
 * per term over everything, so a term's rarity is a property of the library
 * -- a word filling every document stays cheap when it turns up in an
 * annotation, and a library with few attachments still measures rarity from
 * its items' own text.
 *
 * The match side reports which of a set of items contain which units:
 * matchContent() asks the attachment content index, and matchFields(),
 * matchNotes(), and matchAnnotations() ask the item-text index's columns. A
 * match is presence -- strength 1 -- where text is short enough that
 * containing a unit says everything (titles, abstracts, annotations);
 * notes and documents, whose lengths vary too much for that, are graded by
 * saturated, length-normalized term frequency. Quoted phrases are matched
 * literally everywhere: the indexes only prove a phrase's words adjacent,
 * so phrase matches are verified against the stored text.
 *
 * scoreItemIDs() assembles the score: each unit contributes its weight
 * times the best evidence for it across an item's sources, summed and
 * normalized against the query's ceiling -- 1 is a full-strength match on
 * everything the query asked -- with a floor below which an item isn't a
 * match at all.
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
	// BM25's term-frequency shape: K1 sets how quickly repetition saturates,
	// B how much a long text discounts each occurrence (see
	// _saturatedStrength())
	const K1 = 1.2;
	const B = 0.75;
	// A unit is informative -- worth retrieving by -- when it carries at
	// least this share of the query's best unit's weight. Relative rather
	// than absolute, so "of" next to "communism" is dropped while a query of
	// nothing but common words keeps its best word and still returns results.
	const INFORMATIVE_WEIGHT_FRACTION = 0.2;
	// What a full-strength match in each source is worth relative to a
	// full-strength content match: a title names the work, an abstract
	// summarizes it, everything else speaks with equal voice
	const SOURCE_BOOSTS = {
		title: 2,
		abstract: 1.3,
		content: 1,
		note: 1,
		annotation: 1
	};
	// Normalized scores below this aren't matches and aren't returned: with
	// scores measured against the query's ceiling, this is the share of what
	// the query asked for that an item has to show. Provisional until tuned
	// against a real library.
	const SCORE_FLOOR = 0.05;
	// An item whose evidence is a single matched unit is a match only when
	// that unit carries at least this share of the query's informative
	// weight. Relative, so it adapts per query: for "fall of ussr", an item
	// with just the dominant "ussr" is a match, while the crowd of items
	// with just "fall" -- a minor share of what was asked -- is not.
	const LONE_UNIT_WEIGHT_FRACTION = 0.5;
	// An excerpt's width in characters (see getMatchingExcerpts()): wide
	// enough to read a match in context, narrow enough that several excerpts
	// fit in a details pane
	const EXCERPT_WINDOW = 200;

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
	 * Parse a query into scoring units.
	 *
	 * A unit is the thing that matches (or doesn't) in one text and earns
	 * its weight toward a score:
	 * - a word: { type: 'word', text, prefix }. The query's trailing word is
	 *   flagged `prefix` while it's still being typed (no space or quote
	 *   after it yet), so it matches its completions.
	 * - a quoted phrase: { type: 'phrase', text, tokens } -- multiple words
	 *   matched adjacently, as typed.
	 * - a CJK run: { type: 'cjk', text, bigrams } -- matched contiguously via
	 *   the 2-gram index, so quoting adds nothing it doesn't already have.
	 *   `bigrams` is null for a single character, which has none.
	 * A part mixing scripts splits into word and run units, and a quoted
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
		let units = [];
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
				units.push({
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
					units.push({
						type: 'cjk',
						text: match.groups.cjk,
						bigrams: _getBigrams(match.groups.cjk),
						fromLastPart,
						quoted: part.inQuotes
					});
				}
				else {
					units.push({
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
		if (units.length && endsMidWord) {
			let last = units[units.length - 1];
			if (last.type == 'word' && last.fromLastPart && !last.quoted) {
				last.prefix = true;
			}
		}
		let deduped = new Map();
		for (let unit of units) {
			delete unit.fromLastPart;
			delete unit.quoted;
			let key = unit.type + '\n' + unit.text;
			let existing = deduped.get(key);
			if (!existing || (existing.prefix && !unit.prefix)) {
				deduped.set(key, unit);
			}
		}
		return [...deduped.values()];
	};

	/**
	 * The scoring units of a query (see parseQuery()), each weighted by how
	 * rare it is in the corpus. A score built from these accumulates the
	 * weights of the units a text matches, so matching "communism" moves a
	 * score far more than matching "fall".
	 *
	 * Consecutive informative words additionally form pair units
	 * ({ type: 'pair', text, tokens, prefix }), matched as the two words
	 * adjacent in order: "special education" asks for more than its words
	 * scattered through a text, and a text with the words adjacent earns the
	 * pair's weight on top of theirs. A pair is weighted by its own rarity --
	 * an incidental adjacency ("united states") is common and weighs little,
	 * a meaningful one is rare and can outweigh its words -- and a pair
	 * matching nothing in the corpus is dropped, since a unit no text can
	 * earn would only dilute every score. A pair inherits the trailing
	 * word's prefix matching, so a query still being typed pairs too.
	 *
	 * @param {String} queryText
	 * @return {Promise<Object[]>} - parseQuery()'s units followed by any pair
	 *     units, each with:
	 *     df - documents in the corpus matching the unit
	 *     weight - what a match on this unit contributes to a score
	 *     informative - whether the unit carries enough of the query's
	 *         weight to be worth retrieving by (see
	 *         INFORMATIVE_WEIGHT_FRACTION); the best-weighted unit always
	 *         is, and pairs always are, being made of informative words
	 */
	this.analyzeQuery = async function (queryText) {
		let units = this.parseQuery(queryText);
		if (!units.length) {
			return units;
		}
		let corpusSize = await this.getCorpusSize();
		for (let unit of units) {
			unit.df = await this.getDocumentFrequency(unit);
			unit.weight = _idf(unit.df, corpusSize);
		}
		let maxWeight = Math.max(...units.map(unit => unit.weight));
		for (let unit of units) {
			unit.informative = unit.weight >= maxWeight * INFORMATIVE_WEIGHT_FRACTION;
		}
		for (let pair of _getAdjacentPairs(units)) {
			pair.df = await this.getDocumentFrequency(pair);
			if (!pair.df) {
				continue;
			}
			pair.weight = _idf(pair.df, corpusSize);
			pair.informative = true;
			units.push(pair);
		}
		return units;
	};

	/**
	 * Number of documents the term statistics are measured against: every
	 * attachment, item, note, and annotation recorded in the full-text
	 * index's state tables -- including ones indexed with no text, which are
	 * real documents that happen to contain nothing.
	 *
	 * @return {Promise<Number>}
	 */
	this.getCorpusSize = async function () {
		return (await Zotero.DB.valueQueryAsync(
			"SELECT COUNT(*) FROM ftindex.fulltextIndexState"
		)) + (await Zotero.DB.valueQueryAsync(
			"SELECT COUNT(*) FROM ftindex.fulltextItemTextState"
		)) + (await Zotero.DB.valueQueryAsync(
			"SELECT COUNT(*) FROM ftindex.fulltextNoteIndexState"
		));
	};

	/**
	 * How many documents match a unit: the `df` behind its weight, counted
	 * across both word-level corpora -- attachment content and item text --
	 * whose ID spaces are disjoint, so the sum counts nothing twice. Counted
	 * the way the unit will be matched: a prefix word against every
	 * completion, a phrase by adjacent occurrence, a CJK run by its
	 * contiguous bigrams.
	 *
	 * A single-character CJK unit has no bigram of its own, so its count is
	 * approximated by prefix-matching the bigrams that start with it. That
	 * undercounts a character that only ends runs, which overstates its
	 * weight -- rarer reads as more important, the safe direction to be wrong.
	 *
	 * @param {Object} unit - A unit from parseQuery()
	 * @return {Promise<Number>}
	 */
	this.getDocumentFrequency = async function (unit) {
		let clause = _getMatchClause(unit);
		let df = 0;
		for (let table of [clause.contentTable, clause.itemTextTable]) {
			df += await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM ftindex." + table
					+ " WHERE " + table + " MATCH ?",
				[clause.match]
			);
		}
		return df;
	};

	/**
	 * Which of the given items' indexed attachment content contains which
	 * units, and how strongly relative to each other. For a one-unit
	 * expression the index's rank is a constant times BM25's saturated,
	 * length-normalized term frequency, so ranks compare documents exactly;
	 * the constant itself is unknowable, so the strongest match anchors 1 and
	 * the rest scale under it. A document that keeps returning to a term
	 * outranks one that mentions it once in passing -- but strengths are
	 * relative to the candidates at hand, so a lone weak match still reads
	 * as 1.
	 *
	 * A phrase's index match only proves its words adjacent -- the index
	 * ignores what separates them -- so phrase matches are verified against
	 * the stored document text and only literal occurrences count. A pair
	 * unit means exactly that adjacency, so it counts as the index answers,
	 * unverified.
	 *
	 * Only items with a row in the content index (indexed attachments) can
	 * match; everything else is simply absent from the result.
	 *
	 * @param {Object[]} units - Units from parseQuery()
	 * @param {Integer[]} itemIDs
	 * @return {Promise<Map>} - itemID -> Map(unit -> strength)
	 */
	this.matchContent = async function (units, itemIDs) {
		let strengths = new Map();
		if (!units.length || !itemIDs.length) {
			return strengths;
		}
		for (let unit of units) {
			let clause = _getMatchClause(unit);
			let matched = await _probe(clause.contentTable, clause.match, itemIDs);
			if (!matched.length) {
				continue;
			}
			if (unit.type == 'phrase') {
				let verified = new Set(
					(await Zotero.FullText.findTextInItems(
						matched.map(row => row.rowid), unit.text
					)).map(x => x.id)
				);
				matched = matched.filter(row => verified.has(row.rowid));
				if (!matched.length) {
					continue;
				}
			}
			// rank is negative, better more negative, so the best is the
			// minimum and every ratio against it lands in (0, 1]
			let best = Math.min(...matched.map(row => row.rank));
			for (let row of matched) {
				_addStrength(strengths, row.rowid, unit,
					best ? row.rank / best : 1);
			}
		}
		return strengths;
	};

	/**
	 * Which of the given items' titles and abstracts contain which units,
	 * reported per column. A match is presence (strength 1): a title or
	 * abstract is short enough that containing a unit says everything.
	 * Titles cover the type-specific title fields (caseName, subject,
	 * nameOfAct) along with `title` itself. Phrase matches are verified
	 * literally against the stored field values; pair matches count as the
	 * index answers, unverified.
	 *
	 * Items without a matching title or abstract are simply absent from the
	 * respective result.
	 *
	 * @param {Object[]} units - Units from parseQuery()
	 * @param {Integer[]} itemIDs
	 * @return {Promise<Object>} - { title: Map(itemID -> Map(unit ->
	 *     strength)), abstract: Map(itemID -> Map(unit -> strength)) }
	 */
	this.matchFields = async function (units, itemIDs) {
		let result = { title: new Map(), abstract: new Map() };
		if (!units.length || !itemIDs.length) {
			return result;
		}
		for (let unit of units) {
			let clause = _getMatchClause(unit);
			for (let column of ['title', 'abstract']) {
				let matched = (await _probe(
					clause.itemTextTable, column + ':' + clause.match, itemIDs
				)).map(row => row.rowid);
				if (!matched.length) {
					continue;
				}
				if (unit.type == 'phrase') {
					matched = await _verifyFieldPhrase(unit, column, matched);
				}
				for (let itemID of matched) {
					_addStrength(result[column], itemID, unit, 1);
				}
			}
		}
		return result;
	};

	/**
	 * Which of the given items' note text contains which units, and how
	 * strongly. Notes range from a line to a chapter, so strength is BM25's
	 * saturated, length-normalized term frequency (see _saturatedStrength()):
	 * a note that keeps returning to a term outranks one that mentions it
	 * once in passing.
	 *
	 * The index answers which notes are worth reading: text is fetched only
	 * for notes whose note column matches a unit, plus notes whose index
	 * entries can't be trusted -- edited since their last index update, or
	 * not indexed yet -- whose current text is always read. Phrases count
	 * only literally (see _countPhrase()).
	 *
	 * Items without matching note text are simply absent from the result.
	 *
	 * @param {Object[]} units - Units from parseQuery()
	 * @param {Integer[]} itemIDs
	 * @return {Promise<Map>} - itemID -> Map(unit -> strength)
	 */
	this.matchNotes = async function (units, itemIDs) {
		let strengths = new Map();
		if (!units.length || !itemIDs.length) {
			return strengths;
		}
		let fetchIDs = new Set(await Zotero.FullText.getStaleOrUnindexedNoteIDs(itemIDs));
		for (let unit of units) {
			let clause = _getMatchClause(unit);
			let matched = await _probe(
				clause.itemTextTable, 'note:' + clause.match, itemIDs);
			for (let row of matched) {
				fetchIDs.add(row.rowid);
			}
		}
		if (!fetchIDs.size) {
			return strengths;
		}
		let texts = await Zotero.FullText.getNoteSearchTexts([...fetchIDs]);
		if (!texts.size) {
			return strengths;
		}
		// Length normalization needs the typical note length. The note index
		// knows it; without one yet, the notes at hand stand in for the
		// population.
		let avgLength = await Zotero.DB.valueQueryAsync(
			"SELECT AVG(LENGTH(text)) FROM ftindex.noteText"
		);
		if (!avgLength) {
			let lengths = [...texts.values()].map(text => text.length);
			avgLength = (lengths.reduce((sum, length) => sum + length, 0)
				/ (lengths.length || 1)) || 1;
		}
		for (let [itemID, text] of texts) {
			if (!text) {
				continue;
			}
			let scan = _scanText(text);
			for (let unit of units) {
				let tf = _countUnit(unit, scan);
				if (tf) {
					_addStrength(strengths, itemID, unit,
						_saturatedStrength(tf, text.length, avgLength));
				}
			}
		}
		return strengths;
	};

	/**
	 * Which of the given items' annotation text -- the passage an annotation
	 * marks together with its comment -- contains which units. A match is
	 * presence (strength 1): an annotation is short enough that containing a
	 * unit says everything. Phrase matches are verified literally against
	 * the stored annotation text; pair matches count as the index answers,
	 * unverified.
	 *
	 * Items without matching annotation text are simply absent from the
	 * result.
	 *
	 * @param {Object[]} units - Units from parseQuery()
	 * @param {Integer[]} itemIDs
	 * @return {Promise<Map>} - itemID -> Map(unit -> strength)
	 */
	this.matchAnnotations = async function (units, itemIDs) {
		let strengths = new Map();
		if (!units.length || !itemIDs.length) {
			return strengths;
		}
		for (let unit of units) {
			let clause = _getMatchClause(unit);
			let matched = (await _probe(
				clause.itemTextTable, 'annotation:' + clause.match, itemIDs
			)).map(row => row.rowid);
			if (!matched.length) {
				continue;
			}
			if (unit.type == 'phrase') {
				matched = await _verifyAnnotationPhrase(unit, matched);
			}
			for (let itemID of matched) {
				_addStrength(strengths, itemID, unit, 1);
			}
		}
		return strengths;
	};

	/**
	 * Score a given set of items by how well their text answers a query.
	 *
	 * Any informative unit can match (see analyzeQuery()); each contributes
	 * its weight times the best evidence for it across the item's sources --
	 * title, abstract, attachment content, notes, annotations, boosted per
	 * source (see SOURCE_BOOSTS) -- so the same word in two places counts
	 * once, at its strongest. The sum is normalized against the query's
	 * ceiling (every informative unit at full strength in the best-boosted
	 * source): 1 is a full-strength match on everything the query asked,
	 * partial coverage lands proportionally lower, dominated by the rare
	 * units. Items below SCORE_FLOOR aren't matches and aren't returned.
	 *
	 * An item matching a single unit of a multi-unit query is a match only
	 * when that unit dominates the query (see LONE_UNIT_WEIGHT_FRACTION):
	 * an item with only the query's minor word says little about what was
	 * asked, however it scores.
	 *
	 * Units too common to be informative play no part: they neither gate nor
	 * move a score.
	 *
	 * @param {String} queryText
	 * @param {Number[]} itemIDs - Candidate item IDs to score
	 * @param {Object} [options]
	 * @param {Function} [options.shouldCancel] - Checked between matching
	 *     stages; return true to abandon scoring with a ScoringCancelledError
	 * @return {Promise<Map>} - itemID -> score (0-1, higher is better)
	 */
	this.scoreItemIDs = async function (queryText, itemIDs, { shouldCancel } = {}) {
		let scores = new Map();
		if (!itemIDs.length) {
			return scores;
		}
		let checkCancel = () => {
			if (shouldCancel && shouldCancel()) {
				throw new this.ScoringCancelledError();
			}
		};
		let units = (await this.analyzeQuery(queryText))
			.filter(unit => unit.informative);
		if (!units.length) {
			return scores;
		}
		checkCancel();
		let content = await this.matchContent(units, itemIDs);
		checkCancel();
		let fields = await this.matchFields(units, itemIDs);
		checkCancel();
		let notes = await this.matchNotes(units, itemIDs);
		checkCancel();
		let annotations = await this.matchAnnotations(units, itemIDs);
		checkCancel();

		// Best boosted evidence per item per unit, across all sources
		let evidence = new Map();
		let sources = [
			[fields.title, SOURCE_BOOSTS.title],
			[fields.abstract, SOURCE_BOOSTS.abstract],
			[content, SOURCE_BOOSTS.content],
			[notes, SOURCE_BOOSTS.note],
			[annotations, SOURCE_BOOSTS.annotation]
		];
		for (let [strengths, boost] of sources) {
			for (let [itemID, unitStrengths] of strengths) {
				for (let [unit, strength] of unitStrengths) {
					_addStrength(evidence, itemID, unit, boost * strength);
				}
			}
		}

		let maxBoost = Math.max(...Object.values(SOURCE_BOOSTS));
		let totalWeight = units.reduce((sum, unit) => sum + unit.weight, 0);
		let ceiling = totalWeight * maxBoost;
		if (!ceiling) {
			return scores;
		}
		for (let [itemID, unitStrengths] of evidence) {
			if (unitStrengths.size == 1) {
				let [unit] = unitStrengths.keys();
				if (unit.weight < LONE_UNIT_WEIGHT_FRACTION * totalWeight) {
					continue;
				}
			}
			let raw = 0;
			for (let [unit, strength] of unitStrengths) {
				raw += unit.weight * strength;
			}
			let score = raw / ceiling;
			if (score >= SCORE_FLOOR) {
				scores.set(itemID, score);
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
	 * Long texts are cut to windows around their densest clusters of
	 * informative matches, marked with ellipses where they cut; excerpts
	 * covering the most match weight come first. An item whose own text
	 * matches nothing informative gets no excerpts.
	 *
	 * Each excerpt's `strength` is the boosted weight of the matches it
	 * shows as a 0-1 fraction of the query's ceiling -- the same scale
	 * scoreItemIDs() scores on -- so excerpts can be ordered against other
	 * relevance evidence for the item.
	 *
	 * @param {String} queryText
	 * @param {Number} itemID
	 * @param {Object} [options]
	 * @param {Number} [options.limit=5] - Most excerpts to return
	 * @return {Promise<Object[]>} - [{ source, text, ranges, strength }],
	 *     with ranges an array of [start, end) pairs into the excerpt's text
	 */
	this.getMatchingExcerpts = async function (queryText, itemID, { limit = 5 } = {}) {
		let units = (await this.analyzeQuery(queryText))
			.filter(unit => unit.informative);
		if (!units.length) {
			return [];
		}
		let item = await Zotero.Items.getAsync(itemID);
		if (!item) {
			return [];
		}
		let excerpts = [];
		for (let { source, text } of await _getSourceTexts(item)) {
			excerpts.push(..._excerptSource(source, text, units, limit));
		}
		// The most match weight first, boosted the way scoring boosts the
		// source, so excerpts explain in the order their matches scored
		excerpts.sort((a, b) => b.coverage - a.coverage);
		let maxBoost = Math.max(...Object.values(SOURCE_BOOSTS));
		let ceiling = units.reduce((sum, unit) => sum + unit.weight, 0) * maxBoost;
		return excerpts.slice(0, limit).map(({ source, text, ranges, coverage }) => ({
			source,
			text,
			ranges,
			strength: ceiling ? Math.min(1, coverage / ceiling) : 0
		}));
	};

	/**
	 * The character ranges where a query matches within given texts, for
	 * highlighting matches in text obtained elsewhere -- the same ranges
	 * getMatchingExcerpts() marks in the excerpts it cuts itself. One entry
	 * per input text, each an array of merged, non-overlapping [start, end)
	 * pairs, empty when the text matches nothing informative.
	 *
	 * @param {String} queryText
	 * @param {String[]} texts
	 * @return {Promise<Array[]>}
	 */
	this.findMatchRanges = async function (queryText, texts) {
		let units = (await this.analyzeQuery(queryText))
			.filter(unit => unit.informative);
		return texts.map((text) => {
			if (!units.length || !text) {
				return [];
			}
			return _mergeRanges(
				_findUnitMatches(text, units).map(m => [m.start, m.end])
			);
		});
	};

	// The pair units of a unit list (see analyzeQuery()): one for each
	// consecutive pair of informative words, matching the two adjacent in
	// order. A pair whose second word is the query's trailing prefix matches
	// that word's completions the same way the word itself does.
	function _getAdjacentPairs(units) {
		let pairs = [];
		for (let i = 0; i < units.length - 1; i++) {
			let a = units[i];
			let b = units[i + 1];
			if (a.type != 'word' || b.type != 'word'
					|| !a.informative || !b.informative) {
				continue;
			}
			pairs.push({
				type: 'pair',
				text: a.text + ' ' + b.text,
				tokens: [a.text, b.text],
				prefix: b.prefix
			});
		}
		return pairs;
	}

	// The MATCH expression that finds a unit, with the content and item-text
	// tables (word or CJK pair) it runs against. Unit text is all letters
	// and digits (parseQuery tokenized it), so quoting it into an FTS phrase
	// needs no escaping.
	//
	// A quoted phrase and an adjacency pair probe the same way -- their words
	// adjacent in order -- but differ downstream: a phrase promises literal
	// occurrence and is verified against stored text, while a pair means
	// exactly what the index answers, tokens adjacent whatever separated them.
	function _getMatchClause(unit) {
		if (unit.type == 'cjk') {
			return {
				match: unit.bigrams
					? '"' + unit.bigrams + '"'
					: '"' + unit.text + '"*',
				contentTable: 'fulltextContentCJK',
				itemTextTable: 'fulltextItemTextCJK'
			};
		}
		return {
			match: unit.type == 'phrase'
				? '"' + unit.text + '"'
				: '"' + unit.text + '"' + (unit.prefix ? '*' : ''),
			contentTable: 'fulltextContent',
			itemTextTable: 'fulltextItemText'
		};
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

	// Smoothed BM25 inverse document frequency:
	//
	//     ln(1 + (N - df + 0.5) / (df + 0.5))
	//
	// the standard measure of how much information a term carries, and the
	// whole term-importance mechanism: no stoplist, just counting.
	// - df = 0 -- a term in no indexed document (a typo, or a word from text
	//   we haven't indexed) -- gets the query's maximum: unseen reads as
	//   rare reads as important
	// - df = N -- a term in everything ("the") -- approaches zero
	// - N = 0 -- nothing indexed to measure against -- gives every unit the
	//   same ln(2), so ranking degrades to term coverage
	function _idf(df, corpusSize) {
		// The single-CJK-character approximation and an index mid-write can
		// disagree slightly with the row count
		df = Math.max(0, Math.min(df, corpusSize));
		return Math.log(1 + (corpusSize - df + 0.5) / (df + 0.5));
	}

	// The requested candidates matching an FTS expression. Each row carries
	// the index's rank for the expression, for callers that grade matches
	// against each other; callers that only need membership read the rowids.
	//
	// The MATCH runs unconstrained and the candidate filter is applied here:
	// a full scan for a common term costs milliseconds, while constraining
	// the same MATCH to a rowid set makes FTS5 evaluate the expression per
	// row, which at library scale costs seconds.
	async function _probe(table, match, itemIDs) {
		let candidates = new Set(itemIDs);
		let rows = await Zotero.DB.queryAsync(
			"SELECT rowid, rank FROM ftindex." + table
				+ " WHERE " + table + " MATCH ?",
			[match]
		);
		return rows.filter(row => candidates.has(row.rowid));
	}

	// Of the given items, those whose stored field text (title-family fields
	// or the abstract) literally contains a phrase unit
	async function _verifyFieldPhrase(unit, column, itemIDs) {
		let fieldIDs = column == 'title'
			? [
				Zotero.ItemFields.getID('title'),
				...Zotero.ItemFields.getTypeFieldsFromBase('title')
			]
			: [Zotero.ItemFields.getID('abstractNote')];
		let verified = [];
		let chunkSize = 500;
		for (let i = 0; i < itemIDs.length; i += chunkSize) {
			let chunk = itemIDs.slice(i, i + chunkSize);
			let rows = await Zotero.DB.queryAsync(
				"SELECT itemID, value FROM itemData "
					+ "JOIN itemDataValues USING (valueID) "
					+ "WHERE fieldID IN (" + fieldIDs.join(',') + ") "
					+ "AND itemID IN (" + chunk.map(() => '?').join(',') + ")",
				chunk
			);
			for (let row of rows) {
				let normalized = Zotero.Utilities.Internal.normalizeForSearch(row.value);
				if (normalized && _countPhrase(normalized, unit.text)) {
					verified.push(row.itemID);
				}
			}
		}
		return verified;
	}

	// Of the given annotations, those whose passage and comment literally
	// contain a phrase unit
	async function _verifyAnnotationPhrase(unit, itemIDs) {
		let verified = [];
		let chunkSize = 500;
		for (let i = 0; i < itemIDs.length; i += chunkSize) {
			let chunk = itemIDs.slice(i, i + chunkSize);
			let rows = await Zotero.DB.queryAsync(
				"SELECT itemID, text, comment FROM itemAnnotations "
					+ "WHERE itemID IN (" + chunk.map(() => '?').join(',') + ")",
				chunk
			);
			for (let row of rows) {
				let normalized = Zotero.Utilities.Internal.normalizeForSearch(
					[row.text, row.comment].filter(Boolean).join(' ')
				);
				if (normalized && _countPhrase(normalized, unit.text)) {
					verified.push(row.itemID);
				}
			}
		}
		return verified;
	}

	// A text prepared for unit counting: its token stream (word tokens and
	// CJK runs, in text order) and the normalized text itself, which is what
	// CJK units and phrases match against
	function _scanText(text) {
		let tokens = [];
		for (let match of text.matchAll(TOKEN_RE)) {
			tokens.push(match.groups.cjk || match.groups.word);
		}
		return { text, tokens };
	}

	// Occurrences of a unit in a scanned text, counted the way the indexes
	// match the unit: a word as a whole token (a prefix unit by its
	// completions), a CJK run contiguously, a phrase literally (see
	// _countPhrase()), a pair as its words on adjacent tokens -- whatever
	// separated them, which is all the index's adjacency means
	function _countUnit(unit, scan) {
		if (unit.type == 'cjk') {
			let count = 0;
			let index = scan.text.indexOf(unit.text);
			while (index != -1) {
				count++;
				index = scan.text.indexOf(unit.text, index + unit.text.length);
			}
			return count;
		}
		if (unit.type == 'phrase') {
			return _countPhrase(scan.text, unit.text);
		}
		if (unit.type == 'pair') {
			let [first, second] = unit.tokens;
			let count = 0;
			for (let i = 0; i < scan.tokens.length - 1; i++) {
				if (scan.tokens[i] === first && (unit.prefix
					? scan.tokens[i + 1].startsWith(second)
					: scan.tokens[i + 1] === second)) {
					count++;
				}
			}
			return count;
		}
		if (unit.prefix) {
			return scan.tokens.filter(token => token.startsWith(unit.text)).length;
		}
		return scan.tokens.filter(token => token === unit.text).length;
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

	// BM25's saturated, length-normalized term frequency, mapped onto (0, 1):
	//
	//     tf / (tf + K1 * (1 - B + B * length / avgLength))
	//
	// One occurrence in an average-length text lands around 0.45, repetition
	// approaches 1, and each occurrence counts for less in a longer text.
	// Lengths are in characters on both sides of the ratio, which is all the
	// ratio needs.
	function _saturatedStrength(tf, length, avgLength) {
		return tf / (tf + K1 * (1 - B + B * (length / avgLength)));
	}

	// Record a unit's strength for an item, keeping the strongest when the
	// same unit matches an item more than once (e.g., in two title fields)
	function _addStrength(strengths, itemID, unit, strength) {
		let unitStrengths = strengths.get(itemID);
		if (!unitStrengths) {
			unitStrengths = new Map();
			strengths.set(itemID, unitStrengths);
		}
		let previous = unitStrengths.get(unit);
		if (previous === undefined || strength > previous) {
			unitStrengths.set(unit, strength);
		}
	}

	// The texts an item can match a query in, per its type, labeled with the
	// source names scoring boosts by (see SOURCE_BOOSTS): a regular item's
	// title and abstract, a note's plain text, an annotation's passage and
	// comment, a file attachment's extracted fulltext from its cache file
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

	// Cut a source text into up to `limit` excerpts around its unit matches,
	// each window greedily covering the most distinct-unit weight not yet
	// shown. Returns [{ source, text, ranges, coverage }], where ranges are
	// [start, end) pairs relative to the excerpt's text and coverage is the
	// boosted weight the excerpt shows, for ordering excerpts across sources.
	function _excerptSource(source, text, units, limit) {
		let matches = _findUnitMatches(text, units);
		let excerpts = [];
		let remaining = matches;
		while (remaining.length && excerpts.length < limit) {
			let best = null;
			for (let i = 0; i < remaining.length; i++) {
				let bounds = _windowBounds(text, remaining, i);
				let inside = matches.filter(
					m => m.start >= bounds.start && m.end <= bounds.end
				);
				let weight = [...new Set(inside.map(m => m.unit))]
					.reduce((sum, unit) => sum + unit.weight, 0);
				if (!best || weight > best.weight) {
					best = { bounds, inside, weight };
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
	function _makeExcerpt(source, text, { bounds, inside, weight }) {
		let prefix = bounds.start > 0 ? '…' : '';
		let suffix = bounds.end < text.length ? '…' : '';
		let ranges = _mergeRanges(inside.map(
			m => [m.start - bounds.start + prefix.length, m.end - bounds.start + prefix.length]
		));
		return {
			source,
			text: prefix + text.slice(bounds.start, bounds.end) + suffix,
			ranges,
			coverage: weight * SOURCE_BOOSTS[source]
		};
	}

	// Sorted, non-overlapping [start, end) ranges: overlapping and touching
	// input ranges (a word matched by two units, say) merge into one
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

	// Where each unit matches in a text, as [{ start, end, unit }] in text
	// order. Matching mirrors _countUnit() -- whole tokens for words, token
	// prefixes for prefix units (highlighted as the whole token), adjacent
	// tokens for pairs (highlighted as one span), contiguous runs for CJK,
	// literal collapsed phrases -- but runs over a normalized copy that maps
	// every position back to the original text, so the ranges mark the text
	// as written (case, diacritics and typographic variants intact).
	function _findUnitMatches(text, units) {
		let { normalized, map } = _mapNormalized(text);
		let matches = [];
		let words = units.filter(unit => unit.type == 'word');
		let pairs = units.filter(unit => unit.type == 'pair');
		if (words.length || pairs.length) {
			let tokens = [...normalized.matchAll(TOKEN_RE)]
				.map(match => ({ text: match.groups.word, index: match.index }));
			for (let token of tokens) {
				if (!token.text) {
					continue;
				}
				for (let unit of words) {
					if (unit.prefix ? token.text.startsWith(unit.text) : token.text === unit.text) {
						matches.push({
							start: map[token.index],
							end: map[token.index + token.text.length],
							unit
						});
					}
				}
			}
			for (let unit of pairs) {
				let [first, second] = unit.tokens;
				for (let i = 0; i < tokens.length - 1; i++) {
					let a = tokens[i];
					let b = tokens[i + 1];
					if (a.text === first && b.text && (unit.prefix
						? b.text.startsWith(second)
						: b.text === second)) {
						matches.push({
							start: map[a.index],
							end: map[b.index + b.text.length],
							unit
						});
					}
				}
			}
		}
		for (let unit of units) {
			if (unit.type == 'cjk') {
				let index = normalized.indexOf(unit.text);
				while (index != -1) {
					matches.push({
						start: map[index],
						end: map[index + unit.text.length],
						unit
					});
					index = normalized.indexOf(unit.text, index + unit.text.length);
				}
			}
			else if (unit.type == 'phrase') {
				matches.push(..._findPhraseMatches(normalized, map, unit));
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
	function _findPhraseMatches(normalized, map, unit) {
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
		let index = collapsed.indexOf(unit.text);
		while (index != -1) {
			let before = index > 0 ? collapsed[index - 1] : '';
			let after = collapsed[index + unit.text.length] || '';
			if (!/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after)) {
				// A phrase ends on a word character, so the last collapsed
				// character is a single normalized one and its exclusive end
				// is the next normalized position
				let start = map[collapsedMap[index]];
				let end = map[collapsedMap[index + unit.text.length - 1] + 1];
				matches.push({ start, end, unit });
			}
			index = collapsed.indexOf(unit.text, index + 1);
		}
		return matches;
	}
};
