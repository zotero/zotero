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

	function _hasPreviews(itemID) {
		return !!Zotero.Items.get(itemID)?.isFileAttachment?.();
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
	 * @return {Promise<Object>} - { scores, matches }: scores maps
	 *     itemID -> score (0-1, higher is more relevant); matches says which
	 *     items each engine can show match excerpts in, as { lexical,
	 *     semantic } Sets of itemIDs (see getMatchingExcerpts()). Every
	 *     lexical match has excerpts to show; a semantic match does only
	 *     when a previewable chunk carries it (see
	 *     Zotero.Embeddings.scoreItemIDs()). An engine that didn't rank
	 *     contributes an empty Set.
	 * @throws {Zotero.BestMatch.ScoringCancelledError}
	 */
	this.scoreItemIDs = async function (queryText, itemIDs, options = {}) {
		try {
			// Temporary, for testing: the bestMatchEngine pref pins scoring to
			// one engine instead of the hybrid default
			let engine = Zotero.Prefs.get('search.bestMatchEngine');
			if (engine == 'semantic') {
				let semantic = await Zotero.Embeddings.scoreItemIDs(queryText, itemIDs, options);
				return {
					// On the model's display band, so scores are 0-1 like the
					// other modes'
					scores: new Map([...semantic.scores].map(
						([itemID, score]) => [itemID, Zotero.Embeddings.getScoreFraction(score)]
					)),
					matches: { lexical: new Set(), semantic: semantic.previewableIDs }
				};
			}
			// A query the semantic engine can't embed ranks lexically alone
			if (engine == 'lexical' || !_useSemantic()
					|| !Zotero.Embeddings.normalizeQuery(queryText || '')) {
				let scores = await Zotero.Lexical.scoreItemIDs(queryText, itemIDs, options);
				return {
					scores,
					matches: { lexical: new Set(scores.keys()), semantic: new Set() }
				};
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
					return {
						scores: lexical.value,
						matches: {
							lexical: new Set(lexical.value.keys()),
							semantic: new Set()
						}
					};
				}
				throw semantic.reason;
			}
			return {
				scores: _fuse(lexical.value, semantic.value.scores),
				matches: {
					lexical: new Set(lexical.value.keys()),
					semantic: semantic.value.previewableIDs
				}
			};
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
	 * A best-match search session: one query's scoring pass plus the
	 * previews explaining its matches, derived on demand.
	 *
	 * score() ranks candidates and synchronously builds a pending preview
	 * per matched item that has anything to show, with no I/O. request()
	 * names the items whose previews are wanted next; each call replaces
	 * the last, so only what is still wanted gets derived, and repeating a
	 * request is free. Derivation runs one item at a time, each waiting
	 * first for a moment when the main thread has nothing else to do. An
	 * item's entries arrive all at once -- both engines' evidence, merged,
	 * deduplicated and ordered by strength (see getMatchingExcerpts()) --
	 * and onUpdate reports each item whose preview settled; consumers read
	 * them back with getPreviews(). A disposed session derives nothing and
	 * never calls onUpdate.
	 */
	this.Session = class {
		constructor(queryText) {
			// Called with the itemIDs whose previews settled since the last
			// call, from filling or from a failed derivation
			this.onUpdate = null;
			this._queryText = queryText;
			this._previews = new Map();
			this._queue = [];
			this._inFlight = new Set();
			this._pumping = false;
			this._disposed = false;
			this._scoreGeneration = 0;
		}

		get queryText() {
			return this._queryText;
		}

		/**
		 * Score candidates for this session's query (see
		 * Zotero.BestMatch.scoreItemIDs()) and rebuild the preview set from
		 * the engines' match sets, synchronously and with no I/O once
		 * scoring resolves: a pending preview for every item a preview is
		 * shown for that some engine can show match excerpts in. Items still
		 * matched keep their settled previews -- a re-score doesn't drop
		 * derived text -- and items no longer matched lose theirs. A scoring
		 * pass superseded by a newer one on the same session leaves the
		 * previews to the newer pass.
		 *
		 * @param {Number[]} itemIDs - Candidate item IDs to score
		 * @param {Object} [options] - Passed through to scoreItemIDs()
		 * @return {Promise<Map>} - itemID -> score, as scoreItemIDs() returns
		 * @throws {Zotero.BestMatch.ScoringCancelledError}
		 */
		async score(itemIDs, options = {}) {
			let generation = ++this._scoreGeneration;
			let { scores, matches } = await Zotero.BestMatch.scoreItemIDs(
				this._queryText, itemIDs, options);
			if (this._disposed || generation != this._scoreGeneration) {
				return scores;
			}
			let previews = new Map();
			for (let itemID of new Set([...matches.lexical, ...matches.semantic])) {
				if (!_hasPreviews(itemID)) {
					continue;
				}
				let existing = this._previews.get(itemID);
				if (existing && existing.state != 'pending') {
					previews.set(itemID, existing);
					continue;
				}
				previews.set(itemID, {
					state: 'pending',
					entries: [],
					lexical: matches.lexical.has(itemID),
					semantic: matches.semantic.has(itemID)
				});
			}
			this._previews = previews;
			return scores;
		}

		/**
		 * The preview to show for an item, or null when there's nothing to
		 * show: no preview for it (see _hasPreviews()), or one that derived
		 * nothing after all. Passed to consumers as a bare function, so it's
		 * bound to its session.
		 *
		 * @param {Number} itemID
		 * @return {Object|null} - { state, entries }: state is 'pending'
		 *     (placeholder) or 'filled'; entries are the derived entries
		 *     (see getMatchingExcerpts()), each with a `key` unique within
		 *     the preview and stable for as long as the preview stays filled
		 */
		getPreviews = (itemID) => {
			let preview = this._previews.get(itemID);
			return preview && preview.state != 'empty' ? preview : null;
		};

		/**
		 * Derive previews for a small batch of items immediately.
		 *
		 * @param {Number[]} itemIDs
		 */
		async preload(itemIDs) {
			for (let itemID of itemIDs) {
				if (this._disposed) {
					return;
				}
				await this._settle(itemID);
			}
		}

		/**
		 * Ask for the given items' previews to be derived next. Each call
		 * replaces the previous request -- items no longer asked for aren't
		 * derived -- and items already settled or mid-derivation are
		 * skipped, so repeating a request is free.
		 *
		 * @param {Number[]} itemIDs
		 */
		request(itemIDs) {
			if (this._disposed) {
				return;
			}
			this._queue = itemIDs.filter((itemID) => {
				return this._previews.get(itemID)?.state == 'pending'
					&& !this._inFlight.has(itemID);
			});
			this._pump();
		}

		/**
		 * Drop the given items' previews back to placeholders, for items
		 * whose content changed and made derived text stale
		 *
		 * @param {Number[]} itemIDs
		 */
		invalidate(itemIDs) {
			for (let itemID of itemIDs) {
				let preview = this._previews.get(itemID);
				if (!preview) {
					continue;
				}
				// A fresh object, so a fill of the old one that's still in
				// flight can't settle it (see _fill())
				this._previews.set(itemID, {
					...preview,
					state: 'pending',
					entries: []
				});
			}
		}

		/**
		 * End the session: abandon queued and in-flight derivation. A
		 * disposed session derives nothing and never calls onUpdate.
		 */
		dispose() {
			this._disposed = true;
			this._queue = [];
			this.onUpdate = null;
		}

		// Derive queued previews one at a time, each first waiting for a
		// moment when the main thread has nothing else to do. The queue is
		// read one item per turn, so a request() arriving mid-derivation
		// takes effect at the very next item.
		async _pump() {
			if (this._pumping) {
				return;
			}
			this._pumping = true;
			try {
				while (!this._disposed && this._queue.length) {
					await new Promise(
						resolve => Services.tm.idleDispatchToMainThread(resolve));
					if (this._disposed) {
						return;
					}
					let itemID = this._queue.shift();
					if (!await this._settle(itemID)) {
						continue;
					}
					if (!this._disposed && this.onUpdate) {
						try {
							this.onUpdate([itemID]);
						}
						catch (e) {
							Zotero.logError(e);
						}
					}
				}
			}
			finally {
				this._pumping = false;
			}
		}

		// Derive one pending item's preview, reporting whether it settled
		// here: an item already settled or mid-derivation elsewhere is left
		// alone. A derivation that failed would fail again, so it settles for
		// showing nothing rather than being retried.
		async _settle(itemID) {
			let preview = this._previews.get(itemID);
			if (!preview || preview.state != 'pending' || this._inFlight.has(itemID)) {
				return false;
			}
			this._inFlight.add(itemID);
			try {
				await this._fill(itemID, preview);
			}
			catch (e) {
				Zotero.logError(e);
				preview.state = 'empty';
			}
			finally {
				this._inFlight.delete(itemID);
			}
			return true;
		}

		/**
		 * Every excerpt explaining why an item matched this session's query:
		 * the lexical engine's excerpts around the query's literal matches
		 * (see Zotero.Lexical.getMatchingExcerpts()) merged with the item's
		 * most similar indexed chunks (see
		 * Zotero.Embeddings.getMatchingChunks()), which carry document
		 * locations and have those literal matches highlighted within them
		 * too. A lexical fulltext excerpt a shown chunk already covers is
		 * dropped as redundant, and what's left is ordered by strength, each
		 * entry on its engine's 0-1 display scale.
		 *
		 * Only the engines scoring recorded a match in are asked (see
		 * score()), so an item that matched one of them never pays the
		 * other's cost -- scanning the document's whole text, or embedding
		 * the query. A semantic index that isn't ready contributes nothing.
		 *
		 * @param {Number} itemID
		 * @return {Promise<Object[]>} - Entries with `text`, `ranges`, and
		 *     `strength`, plus chunk location fields or a lexical `source`
		 */
		async getMatchingExcerpts(itemID) {
			let queryText = this._queryText;
			let preview = this._previews.get(itemID);
			// Temporary, for testing: the bestMatchEngine pref keeps the
			// pinned engine's excerpts alone -- no lexical excerpts or
			// highlights when pinned semantic, no chunks when pinned lexical
			let engine = Zotero.Prefs.get('search.bestMatchEngine');
			// Uncapped: the tree shows every place an item matched
			let options = { limit: Infinity };
			let excerpts = engine == 'semantic' || preview?.lexical === false
				? []
				: await Zotero.Lexical.getMatchingExcerpts(queryText, itemID, options);
			if (preview?.semantic === false || engine == 'lexical' || !_useSemantic()
					|| !Zotero.Embeddings.normalizeQuery(queryText || '')) {
				return excerpts;
			}
			let chunks = [];
			try {
				chunks = await Zotero.Embeddings.getMatchingChunks(queryText, itemID, options);
				// Only fulltext chunks carry their own text; item-level
				// matches have nothing to excerpt
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
			let ranges = engine == 'semantic'
				? chunks.map(() => [])
				: await Zotero.Lexical.findMatchRanges(
					queryText, chunks.map(chunk => chunk.text));
			chunks = chunks.map((chunk, i) => ({
				...chunk,
				ranges: ranges[i],
				strength: Zotero.Embeddings.getScoreFraction(chunk.score)
			}));
			excerpts = excerpts.filter(
				excerpt => excerpt.source != 'content' || !_coveredByChunk(excerpt, chunks));
			return [...chunks, ...excerpts]
				.sort((a, b) => (b.strength || 0) - (a.strength || 0));
		}

		// Derive one item's entries, all at once. A preview replaced while
		// deriving (a re-score, an invalidate) keeps the newer object
		// untouched.
		async _fill(itemID, preview) {
			let entries = await this.getMatchingExcerpts(itemID);
			if (this._disposed || this._previews.get(itemID) != preview) {
				return;
			}
			preview.entries = entries.map((entry, i) => ({ key: i, ...entry }));
			preview.state = entries.length ? 'filled' : 'empty';
		}
	};

	/**
	 * Start a search session for a query (see Zotero.BestMatch.Session)
	 *
	 * @param {String} queryText
	 * @return {Zotero.BestMatch.Session}
	 */
	this.createSession = function (queryText) {
		return new this.Session(queryText);
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
