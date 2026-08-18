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
 * Zotero.BestMatch -- the engine behind best-match search: scoring a set of
 * items by relevance to a query. The lexical engine (Zotero.Lexical) always
 * scores; when a semantic model is enabled (Zotero.Embeddings), both engines
 * score and their rankings are fused with Reciprocal Rank Fusion, so an item
 * can match by its words, by its meaning, or -- ranking highest -- by both.
 * The facade owns everything a consumer would otherwise need engine
 * knowledge for: what counts as an empty query, how results map onto the
 * relevance bar, and what the failure modes are.
 */
Zotero.BestMatch = new function () {
	// The constant in a Reciprocal Rank Fusion contribution, 1 / (RRF_K +
	// rank): high enough that a handful of rank positions in one engine
	// can't drown out the other engine's opinion entirely
	const RRF_K = 60;

	//
	// Errors
	//

	/**
	 * Thrown when scoring is abandoned via the shouldCancel callback -- e.g.
	 * because a newer query superseded the one being scored
	 */
	this.ScoringCancelledError = class extends Error {
		constructor(message = 'Scoring cancelled') {
			super(message);
			this.name = 'BestMatchScoringCancelledError';
		}
	};

	// The semantic engine joins the ranking whenever a model is enabled; the
	// lexical engine always ranks
	function _useSemantic() {
		return Zotero.Embeddings.isEnabled();
	}

	/**
	 * Whether a query has anything for best-match search to rank by. The
	 * lexical engine needs at least one scoring unit; failing that, the
	 * semantic engine can embed any text its normalization leaves standing,
	 * when a model is enabled. Callers treat a query that fails this as no
	 * active search.
	 *
	 * @param {String} queryText
	 * @return {Boolean}
	 */
	this.isSearchableQuery = function (queryText) {
		if (Zotero.Lexical.parseQuery(queryText || '').length) {
			return true;
		}
		return _useSemantic() && !!Zotero.Embeddings.normalizeQuery(queryText || '');
	};

	/**
	 * Score a given set of items by relevance to a query. Items that aren't
	 * matches by any active engine's standards aren't returned. Scores are
	 * 0-1 against what a perfect answer to the query could show, so one
	 * number both orders the items and sizes their relevance bars -- an item
	 * never displays as more relevant than one ranked above it.
	 *
	 * With a semantic model enabled, both engines score concurrently and
	 * their results fuse (see _fuse()). A semantic index that isn't ready --
	 * mid-build or mid-model-switch -- drops the semantic engine from the
	 * query instead of failing it, leaving the lexical scores alone.
	 *
	 * @param {String} queryText
	 * @param {Number[]} itemIDs - Candidate item IDs to score
	 * @param {Object} [options]
	 * @param {Function} [options.shouldCancel] - Checked between scoring
	 *     stages; return true to abandon scoring with a ScoringCancelledError
	 * @return {Promise<Map>} - itemID -> score (0-1, higher is more relevant)
	 * @throws {Zotero.BestMatch.ScoringCancelledError}
	 */
	this.scoreItemIDs = async function (queryText, itemIDs, options = {}) {
		try {
			// A query the semantic engine can't embed ranks lexically alone
			if (!_useSemantic() || !Zotero.Embeddings.normalizeQuery(queryText || '')) {
				return await Zotero.Lexical.scoreItemIDs(queryText, itemIDs, options);
			}
			// Both engines score the same candidates concurrently. allSettled
			// rather than all, so one engine's failure still leaves the
			// other's rejection observed rather than unhandled
			let [lexical, semantic] = await Promise.allSettled([
				Zotero.Lexical.scoreItemIDs(queryText, itemIDs, options),
				Zotero.Embeddings.scoreItemIDs(queryText, itemIDs, options)
			]);
			if (lexical.status == 'rejected') {
				throw lexical.reason;
			}
			if (semantic.status == 'rejected') {
				if (semantic.reason instanceof Zotero.Embeddings.IndexNotReadyError) {
					Zotero.debug("Semantic index not ready -- ranking lexically: "
						+ semantic.reason.message);
					return lexical.value;
				}
				throw semantic.reason;
			}
			return _fuse(lexical.value, semantic.value);
		}
		catch (e) {
			if (e instanceof Zotero.Embeddings.ScoringCancelledError
					|| e instanceof Zotero.Lexical.ScoringCancelledError) {
				throw new this.ScoringCancelledError(e.message);
			}
			throw e;
		}
	};

	/**
	 * Excerpts showing why an item matches a query, for the item pane's
	 * search-results section: the union of both engines' evidence, so an
	 * item ranked by either kind of match -- or both -- explains itself.
	 *
	 * The lexical engine's excerpts around the query's literal matches (see
	 * Zotero.Lexical.getMatchingExcerpts()) are always collected; they carry
	 * a source name and highlight ranges. With a semantic model enabled, the
	 * item's most similar indexed chunks join them (see
	 * Zotero.Embeddings.getMatchingChunks()), carrying document locations --
	 * with the query's literal matches highlighted within their text too, so
	 * a chunk that's both similar and a literal hit tells both at once. A
	 * lexical fulltext excerpt whose match a shown chunk already covers is
	 * dropped as redundant; one from a passage no chunk surfaced stays.
	 *
	 * Entries are ordered by the strength of the evidence they show, each on
	 * its engine's 0-1 display scale, and capped at the limit together. A
	 * semantic index that isn't ready contributes nothing, leaving the
	 * lexical excerpts alone.
	 *
	 * @param {String} queryText
	 * @param {Number} itemID
	 * @param {Object} [options]
	 * @param {Number} [options.limit=5] - Most entries to return
	 * @return {Promise<Object[]>} - Entries with `text`, `ranges`, and
	 *     `strength`, plus chunk location fields or a lexical `source`
	 */
	this.getMatchingExcerpts = async function (queryText, itemID, options = {}) {
		let limit = options.limit ?? 5;
		let excerpts = await Zotero.Lexical.getMatchingExcerpts(queryText, itemID, options);
		if (!_useSemantic() || !Zotero.Embeddings.normalizeQuery(queryText || '')) {
			return excerpts;
		}
		let chunks = [];
		try {
			chunks = await Zotero.Embeddings.getMatchingChunks(queryText, itemID, options);
			// Only fulltext chunks carry their own text; item-level matches
			// have nothing to excerpt
			chunks = chunks.filter(chunk => chunk.text);
		}
		catch (e) {
			if (!(e instanceof Zotero.Embeddings.IndexNotReadyError)) {
				throw e;
			}
		}
		if (!chunks.length) {
			return excerpts;
		}
		let ranges = await Zotero.Lexical.findMatchRanges(
			queryText, chunks.map(chunk => chunk.text));
		chunks = chunks.map((chunk, i) => ({
			...chunk,
			ranges: ranges[i],
			strength: Zotero.Embeddings.getScoreFraction(chunk.score)
		}));
		excerpts = excerpts.filter(
			excerpt => excerpt.source != 'content' || !_coveredByChunk(excerpt, chunks));
		return [...chunks, ...excerpts]
			.sort((a, b) => (b.strength || 0) - (a.strength || 0))
			.slice(0, limit);
	};

	// Whether a lexical fulltext excerpt's matched evidence already appears
	// inside one of the semantic chunks being shown, making a separate card
	// for it redundant. Tested on the excerpt's first match with a little
	// surrounding context -- enough to place the passage, not just the word
	// -- with whitespace runs collapsed, since the two texts come from the
	// same extraction but may break lines differently.
	function _coveredByChunk(excerpt, chunks) {
		if (!excerpt.ranges.length) {
			return false;
		}
		let [start, end] = excerpt.ranges[0];
		let probe = excerpt.text
			.slice(Math.max(0, start - 20), Math.min(excerpt.text.length, end + 20))
			// The context slice can reach the excerpt's own ellipsis marks,
			// which the chunk's text doesn't contain
			.replace(/…/g, '')
			.replace(/\s+/g, ' ');
		return chunks.some(chunk => chunk.text.replace(/\s+/g, ' ').includes(probe));
	}

	// Fuse the two engines' scores with strength-weighted Reciprocal Rank
	// Fusion: an item's fused score sums fraction / (RRF_K + rank) over the
	// engines that matched it, where fraction is that engine's own 0-1
	// measure of the evidence -- the lexical score, or the semantic score on
	// the model's display band. Rank rewards agreement between the engines
	// without calibrating their scales against each other; the fraction
	// keeps the reward proportionate to what each engine actually found.
	// Pure reciprocal ranks would be blind to that magnitude in both
	// directions: a pair of barely-above-floor matches would buy the full
	// agreement bonus, and a strong match only one engine can see -- a
	// paraphrase without the query's words, say -- would cap at half however
	// good it is. Fused scores are normalized against the best possible sum
	// (full-strength evidence at rank 1 in both engines) to keep them 0-1.
	// Within an engine, tied scores share a rank, so fusion is deterministic
	// however a map orders its entries.
	function _fuse(lexicalScores, semanticScores) {
		let engines = [
			[lexicalScores, score => Math.min(1, Math.max(0, score))],
			[semanticScores, score => Zotero.Embeddings.getScoreFraction(score)]
		];
		let scores = new Map();
		for (let [engineScores, toFraction] of engines) {
			let rankOfScore = new Map(
				[...new Set(engineScores.values())]
					.sort((a, b) => b - a)
					.map((score, i) => [score, i + 1])
			);
			for (let [itemID, score] of engineScores) {
				let sum = scores.get(itemID) || 0;
				scores.set(itemID,
					sum + toFraction(score) / (RRF_K + rankOfScore.get(score)));
			}
		}
		let ceiling = 2 / (RRF_K + 1);
		for (let [itemID, sum] of scores) {
			scores.set(itemID, sum / ceiling);
		}
		return scores;
	}
};
