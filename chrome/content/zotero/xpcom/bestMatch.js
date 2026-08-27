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
	// How a passage's two kinds of evidence weigh against each other. The
	// model's reading leads: it is the calibrated signal, and it chose which
	// passages are worth showing. Saying the query's own words lifts a
	// passage above an equally similar one that only paraphrases them.
	const SEMANTIC_WEIGHT = 0.7;
	const LEXICAL_WEIGHT = 0.3;
	// About a line: what a passage is quoted down to for a one-line preview
	const SNIPPET_CHARS = 150;
	// Most passages quoted for one item. The strongest few already say what
	// the item has to offer at a glance; the rest are still derived --
	// they're read whole rather than quoted, which needs no line chosen.
	const MAX_QUOTED_PASSAGES = 3;

	this.MAX_QUOTED_PASSAGES = MAX_QUOTED_PASSAGES;

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
	 * Embedding-index coverage over the given libraries, for banners
	 * explaining incomplete best-match results. Null when the semantic
	 * engine is disabled or every eligible item is indexed. Never throws --
	 * the state is informational and shouldn't break a search.
	 *
	 * @param {Number[]} [libraryIDs] - Limit coverage to these libraries;
	 *     all libraries when empty
	 * @return {Promise<Object|null>} - { type: 'indexing'|'paused', indexed,
	 *     total }
	 */
	this.getIndexState = async function (libraryIDs = []) {
		try {
			let status = Zotero.Embeddings.Indexing.getStatus();
			if (!status.enabled) {
				return null;
			}
			// Counts aren't populated until the indexer runs in this session
			if (!status.libraries.length) {
				status = await Zotero.Embeddings.Indexing.refreshStatus();
			}
			let ids = new Set(libraryIDs);
			let libraries = status.libraries
				.filter(lib => !ids.size || ids.has(lib.libraryID));
			// Coverage is coverage: attachment fulltext is reported separately
			// in the preferences, but an incomplete index is incomplete
			// whichever part of it is still filling in
			let indexed = libraries.reduce(
				(sum, lib) => sum + lib.indexed + lib.indexedAttachments, 0);
			let total = libraries.reduce(
				(sum, lib) => sum + lib.eligible + lib.eligibleAttachments, 0);
			if (indexed >= total) {
				return null;
			}
			// Only an explicit pause reports as paused. Anything else --
			// between runs (startup, the pre-run debounce) or after an error
			// (detailed in the preferences) -- reports as indexing, since the
			// state explains the incomplete coverage, not the indexer.
			return {
				type: status.paused ? 'paused' : 'indexing',
				indexed,
				total
			};
		}
		catch (e) {
			Zotero.logError(e);
			return null;
		}
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
	 * previews explaining its matches.
	 *
	 * score() ranks candidates and, before it resolves, derives a preview
	 * for every matched item that has anything to show, so consumers read
	 * settled previews (getPreviews()) the moment scoring ends. An item's
	 * entries hold both engines' evidence, merged, deduplicated and ordered
	 * by strength (see getMatchingExcerpts()). A re-score keeps previews
	 * already derived; fill() re-derives ones invalidate() dropped back to
	 * pending. A disposed session derives nothing.
	 */
	this.Session = class {
		constructor(queryText) {
			this._queryText = queryText;
			this._previews = new Map();
			this._disposed = false;
		}

		get queryText() {
			return this._queryText;
		}

		/**
		 * Score candidates for this session's query (see
		 * Zotero.BestMatch.scoreItemIDs()), rebuild the preview set from the
		 * engines' match sets, recompute ranks and barFractions, and derive
		 * every pending preview before resolving, best-scored first. Items
		 * still matched keep their settled previews -- a re-score doesn't
		 * re-derive kept text -- and items no longer matched lose theirs.
		 *
		 * @param {Number[]} itemIDs - Candidate item IDs to score
		 * @param {Object} [options] - Passed through to scoreItemIDs()
		 * @param {Number} [options.topK] - Keep only the K best-scored items,
		 *     with a deterministic tiebreak, so equal scores keep a stable
		 *     membership; previews are only built and derived for the kept
		 *     items
		 * @param {Function} [options.shouldCancel] - Also checked between
		 *     preview derivations
		 * @return {Promise<Map>} - itemID -> score, as scoreItemIDs() returns
		 * @throws {Zotero.BestMatch.ScoringCancelledError}
		 */
		async score(itemIDs, options = {}) {
			let { scores, matches } = await Zotero.BestMatch.scoreItemIDs(
				this._queryText, itemIDs, options);
			if (this._disposed) {
				return scores;
			}
			if (options.topK) {
				scores = new Map(
					[...scores.entries()]
						.sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]))
						.slice(0, options.topK)
				);
			}
			let previews = new Map();
			for (let itemID of new Set([...matches.lexical, ...matches.semantic])) {
				if (!scores.has(itemID) || !_hasPreviews(itemID)) {
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
			this._rank(scores);
			for (let itemID of [...scores.entries()]
				.sort((a, b) => b[1] - a[1])
				.map(([id]) => id)
				.filter(id => previews.get(id)?.state == 'pending')) {
				if (this._disposed) {
					return scores;
				}
				if (options.shouldCancel?.()) {
					throw new Zotero.BestMatch.ScoringCancelledError();
				}
				await this._derive(itemID);
			}
			return scores;
		}

		/**
		 * Ranks from this session's last scoring pass: 1-based, tied
		 * effective scores share a rank, and every row with a match anywhere
		 * beneath it is covered (see _rank()). Empty before the first pass.
		 *
		 * @return {Map} - treeViewID -> rank (1 = most relevant)
		 */
		get ranks() {
			return this._ranks ?? new Map();
		}

		/**
		 * Score fractions for the relevance bars, keyed like ranks: each
		 * row's own score alone, so a row that only inherited its rank from
		 * a descendant shows its rank over an empty bar
		 *
		 * @return {Map} - treeViewID -> 0-1 fraction
		 */
		get barFractions() {
			return this._barFractions ?? new Map();
		}

		// Rank the scored items, lifting each item's score onto its ancestors
		// (annotation -> attachment -> top-level item) first, so an item's
		// effective score -- and so its rank -- is the best match anywhere
		// beneath it. Equal effective scores get equal ranks, so tied rows
		// (including a child and its parent) order deterministically via the
		// consumer's secondary sort fields.
		_rank(scores) {
			let effectiveScores = new Map(scores);
			for (let [itemID, score] of scores) {
				let parentItemID = Zotero.Items.get(itemID)?.parentItemID;
				while (parentItemID) {
					let current = effectiveScores.get(parentItemID);
					if (current === undefined || score > current) {
						effectiveScores.set(parentItemID, score);
					}
					parentItemID = Zotero.Items.get(parentItemID)?.parentItemID;
				}
			}
			let rankOfScore = new Map(
				[...new Set(effectiveScores.values())].sort((a, b) => b - a)
					.map((score, i) => [score, i + 1])
			);
			let ranks = new Map();
			let fractions = new Map();
			for (let [itemID, score] of effectiveScores) {
				let item = Zotero.Items.get(itemID);
				if (!item) {
					continue;
				}
				ranks.set(item.treeViewID, rankOfScore.get(score));
				fractions.set(item.treeViewID, scores.get(itemID) || 0);
			}
			this._ranks = ranks;
			this._barFractions = fractions;
		}

		/**
		 * The preview to show for an item, or null when there's nothing to
		 * show: no preview for it (see _hasPreviews()), or one that derived
		 * nothing after all. Passed to consumers as a bare function, so it's
		 * bound to its session.
		 *
		 * @param {Number} itemID
		 * @return {Object|null} - { state, entries }: state is 'pending'
		 *     (not yet derived) or 'filled'; entries are the derived entries
		 *     (see getMatchingExcerpts()), each with a `key` unique within
		 *     the preview and stable for as long as the preview stays filled
		 */
		getPreviews = (itemID) => {
			let preview = this._previews.get(itemID);
			return preview && preview.state != 'empty' ? preview : null;
		};

		/**
		 * Derive the given items' previews, in order, for previews put back
		 * to pending after scoring -- see invalidate(). Items already settled
		 * are skipped, so filling again is free.
		 *
		 * @param {Number[]} itemIDs
		 */
		async fill(itemIDs) {
			for (let itemID of itemIDs) {
				if (this._disposed) {
					return;
				}
				await this._derive(itemID);
			}
		}

		/**
		 * Drop the given items' previews back to pending, for items whose
		 * content changed and made derived text stale
		 *
		 * @param {Number[]} itemIDs
		 */
		invalidate(itemIDs) {
			for (let itemID of itemIDs) {
				let preview = this._previews.get(itemID);
				if (!preview) {
					continue;
				}
				// A fresh object, so a derivation of the old one that's still
				// in flight can't settle it (see _derive())
				this._previews.set(itemID, {
					...preview,
					state: 'pending',
					entries: []
				});
			}
		}

		/**
		 * End the session: abandon in-flight derivation. A disposed session
		 * derives nothing.
		 */
		dispose() {
			this._disposed = true;
		}

		// Derive one pending item's preview and settle it with the result --
		// its entries, all at once, each keyed for row identity. An item
		// already settled is left alone, and a preview replaced while
		// deriving (see invalidate()) is left to its next derivation. A
		// derivation that failed would fail again, so it settles for showing
		// nothing rather than being retried.
		async _derive(itemID) {
			let preview = this._previews.get(itemID);
			if (!preview || preview.state != 'pending') {
				return;
			}
			try {
				let entries = await this.getMatchingExcerpts(itemID);
				if (this._disposed || this._previews.get(itemID) != preview) {
					return;
				}
				preview.entries = entries.map((entry, i) => ({ key: i, ...entry }));
				preview.state = entries.length ? 'filled' : 'empty';
			}
			catch (e) {
				Zotero.logError(e);
				preview.state = 'empty';
			}
		}

		/**
		 * Every passage explaining why an item matched this session's query,
		 * strongest first.
		 *
		 * A passage is a chunk of the item's text: the chunks the semantic
		 * index already holds, or -- for an item it hasn't indexed -- chunks
		 * cut the same way from the item's own structure or flat text (see
		 * _getPassages()). One unit for both engines, so a match is always a
		 * piece of the document that knows where it sits, rather than a
		 * window cut around a word.
		 *
		 * Every passage that clears its engine's threshold comes back, so a
		 * consumer showing passages whole can show all of them.
		 *
		 * Each passage carries the whole chunk's `text`, and the strongest
		 * MAX_QUOTED_PASSAGES of them also carry a `snippet` extent within it
		 * -- the one line that best shows the query (see _pickSnippets()).
		 * `ranges` locate the query's literal matches in the full text.
		 *
		 * Only the engines scoring recorded a match in are asked (see
		 * score()), so an item that matched one of them never pays the
		 * other's cost. A semantic index that isn't ready contributes
		 * nothing.
		 *
		 * @param {Number} itemID
		 * @return {Promise<Object[]>} - Entries with `text`, `ranges` and
		 *     `strength`, plus location fields where the passage knows them,
		 *     strongest first; the first MAX_QUOTED_PASSAGES also have
		 *     `snippet`
		 */
		async getMatchingExcerpts(itemID) {
			let queryText = this._queryText;
			let passages = await this._getPassages(itemID);
			if (!passages.length) {
				return [];
			}
			let texts = passages.map(passage => passage.text);
			// Locating the query's words in texts already in hand is cheap,
			// unlike scanning a document, so it isn't gated on the item
			// having matched lexically -- only on the lexical engine being
			// one this session listens to at all
			let [ranges, lexical] = await Promise.all([
				this._lexicalEnabled()
					? Zotero.Lexical.findMatchRanges(queryText, texts)
					: texts.map(() => []),
				this._lexicalApplies(itemID) ? Zotero.Lexical.scoreTexts(queryText, texts) : null
			]);
			let entries = [];
			for (let i = 0; i < passages.length; i++) {
				let passage = passages[i];
				let share = lexical ? lexical[i] : 0;
				// A passage the model never weighed has only its words to
				// recommend it, so one that says nothing of the query isn't a
				// match at all
				if (passage.score === undefined && !share) {
					continue;
				}
				// Over the engines that spoke for this item, so a strength is
				// the same 0-1 fraction whether one weighed the passage or
				// both did
				let weighed = passage.score !== undefined;
				let semanticWeight = weighed ? SEMANTIC_WEIGHT : 0;
				let lexicalWeight = lexical ? LEXICAL_WEIGHT : 0;
				let fraction = weighed ? Zotero.Embeddings.getScoreFraction(passage.score) : 0;
				entries.push({
					...passage,
					ranges: ranges[i],
					strength: (semanticWeight * fraction + lexicalWeight * share)
						/ (semanticWeight + lexicalWeight)
				});
			}
			entries.sort((a, b) => b.strength - a.strength);
			// Only the strongest few passages are shown as rows in the tree,
			// so only they get a line chosen to quote
			await this._pickSnippets(entries.slice(0, MAX_QUOTED_PASSAGES));
			return entries;
		}

		/**
		 * The passages of an item to weigh against the query, from the best
		 * source the item has: the chunks the semantic index holds, the
		 * chunks its structured text divides into, or failing both, its flat
		 * text cut to the same size. Only the first two know where they sit
		 * in the document.
		 *
		 * @param {Number} itemID
		 * @return {Promise<Object[]>} - Passages, each with `text` and, from
		 *     an indexed source, a semantic `score` and location fields
		 */
		async _getPassages(itemID) {
			let queryText = this._queryText;
			if (this._semanticApplies(itemID)) {
				try {
					let chunks = await Zotero.Embeddings.getMatchingChunks(
						queryText, itemID, { limit: Infinity });
					// Only fulltext chunks carry their own text; item-level
					// matches have nothing to excerpt
					chunks = chunks.filter(chunk => chunk.text);
					if (chunks.length) {
						return chunks;
					}
				}
				catch (e) {
					if (!(e instanceof Zotero.Embeddings.IndexNotReadyError)) {
						throw e;
					}
				}
			}
			// Indexed, but with no model weighing the chunks -- either it
			// isn't ranking, or it found nothing here worth ranking. They
			// still say how the item divides, for the words to be found in.
			if (!this._lexicalApplies(itemID)) {
				return [];
			}
			let indexed = await Zotero.Embeddings.getChunks(itemID);
			indexed = indexed.filter(chunk => chunk.text);
			if (indexed.length) {
				return indexed;
			}
			return this._cutPassages(itemID);
		}

		// Cut an unindexed item into passages the size an indexed one's are:
		// along its outline where it has structured text, so each passage
		// still knows its section and page, and along its flat text where it
		// doesn't.
		async _cutPassages(itemID) {
			let item = await Zotero.Items.getAsync(itemID);
			if (!item) {
				return [];
			}
			let chunking = Zotero.Utilities.Internal.Chunking;
			// Only structure already extracted: generating it costs seconds,
			// which is not a price a preview may charge (see
			// Zotero.SDT.getPack()). Without it the flat text still divides,
			// just without knowing where its passages sit.
			let structure = await Zotero.SDT.getSections(itemID, { cachedOnly: true });
			if (structure.ok && structure.sections.length) {
				// The metrics only read the text for its script, so a sample
				// of the opening sections says as much as all of them
				let sample = structure.sections.slice(0, 5)
					.map(section => section.text).join('\n\n');
				return chunking.chunkSections(
					structure.sections, chunking.getCharacterMetrics(sample));
			}
			let text = await item.attachmentText;
			if (!text) {
				return [];
			}
			return chunking.chunkText(text, chunking.getCharacterMetrics(text));
		}

		/**
		 * Choose where in each passage to quote from.
		 *
		 * Where a passage says the query outright, the quote is the window
		 * covering the most of it. Where it only means it -- the model
		 * matched what no word of the query says -- the passage is quoted
		 * from its opening: whole sentences until the line is filled (see
		 * _quoteFrom()). The model isn't asked to choose a line -- embedding
		 * every quoted passage's sentences would put model calls on the
		 * scoring pass that derives all previews at once.
		 *
		 * @param {Object[]} entries - Set in place
		 */
		async _pickSnippets(entries) {
			let chunking = Zotero.Utilities.Internal.Chunking;
			for (let entry of entries) {
				let sentences = chunking.splitSentences(
					entry.text, chunking.getCharacterMetrics(entry.text));
				// The passage's opening, for a passage with no words to quote
				// around
				entry.snippet = sentences.length
					? _quoteFrom(sentences)
					: { start: 0, end: Math.min(entry.text.length, SNIPPET_CHARS) };
				if (!entry.ranges.length) {
					continue;
				}
				let window = await Zotero.Lexical.pickSnippetWindow(
					this._queryText, entry.text, { width: SNIPPET_CHARS });
				if (window) {
					entry.snippet = window;
				}
			}
		}

		// Whether this session's query reaches each engine for the item being
		// derived: the engine has to be one the session listens to, and to
		// have found something in the item worth speaking about.
		_semanticApplies(itemID) {
			return this._previews.get(itemID)?.semantic !== false
				&& this._modelApplies();
		}

		_lexicalApplies(itemID) {
			return this._previews.get(itemID)?.lexical !== false
				&& this._lexicalEnabled();
		}

		// Whether each engine reaches this session at all, apart from what it
		// made of any one item. The bestMatchEngine pref is temporary, for
		// testing: it pins a session to a single engine, which then decides
		// not only what matched but how a match is quoted.
		_modelApplies() {
			return Zotero.Prefs.get('search.bestMatchEngine') != 'lexical'
				&& _useSemantic()
				&& !!Zotero.Embeddings.normalizeQuery(this._queryText || '');
		}

		_lexicalEnabled() {
			return Zotero.Prefs.get('search.bestMatchEngine') != 'semantic';
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

	// The extent to quote from a passage's opening: sentences are added until
	// the quote passes SNIPPET_CHARS, so the sentence that crosses the limit
	// is taken whole. Half a sentence reads as a truncation rather than as a
	// passage, and the row clips what doesn't fit anyway -- while a quote cut
	// short of the limit would waste the line on a fragment.
	function _quoteFrom(sentences) {
		let { start, end } = sentences[0];
		for (let i = 1; i < sentences.length && end - start < SNIPPET_CHARS; i++) {
			end = sentences[i].end;
		}
		return { start, end };
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
