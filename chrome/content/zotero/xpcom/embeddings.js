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
 *
 *   Zotero.Embeddings -- the embedding engine and its public face: model
 *   config + download, the inference engine (see Zotero.ML, which runs it in
 *   Firefox's inference process), embed*(), and scoreItemIDs() for the search
 *   path.
 *
 *   Zotero.Embeddings.Indexing -- everything that decides what gets embedded
 *   and keeps the itemEmbeddings table filled.
 *
 */
Zotero.Embeddings = new function () {
	// Key order is the display order in the preferences model menu
	const MODELS = {
		'bge-small-en-v1.5': {
			revision: 1,
			// HF repo id -- also the transformers.js pipeline id and download URL basis.
			modelId: 'Xenova/bge-small-en-v1.5',
			// int8 dynamic quantization ('q8' -> onnx/model_quantized.onnx)
			dtype: 'q8',
			pooling: 'cls',
			// bge prepends a retrieval instruction to queries; passages get none.
			queryPrefix: 'Represent this sentence for searching relevant passages: ',
			passagePrefix: '',
			// Raw cosine scores cluster in a model-specific band; this maps that
			// band onto the Relevance column's 0-1 bar (see getScoreFraction()).
			// Display-only, so retuning it doesn't require a revision bump.
			// Fitted to observed distributions: irrelevant mass ~0.44-0.50,
			// strong matches ~0.65-0.75.
			displayScoreRange: [0.5, 0.75],
			l10nID: 'preferences-advanced-semantic-search-english',
			files: [
				'config.json',
				'tokenizer.json',
				'tokenizer_config.json',
				'special_tokens_map.json',
				'onnx/model_quantized.onnx',
			]
		},
		'multilingual-e5-small': {
			revision: 1,
			modelId: 'Xenova/multilingual-e5-small',
			dtype: 'q8',
			pooling: 'mean',
			queryPrefix: 'query: ',
			passagePrefix: 'passage: ',
			displayScoreRange: [0.78, 0.92],
			l10nID: 'preferences-advanced-semantic-search-multilingual',
			files: [
				'config.json',
				'tokenizer.json',
				'tokenizer_config.json',
				'special_tokens_map.json',
				'onnx/model_quantized.onnx',
			]
		}
	};

	const TASK_NAME = 'feature-extraction';

	const MODEL_HUB_ROOT_URL = 'https://huggingface.co';
	const MODEL_HUB_URL_TEMPLATE = '{model}/resolve/{revision}';

	/**
	 * Name of the active model, from the global preference. Empty string means
	 * semantic search is disabled.
	 * @return {String}
	 */
	this.getModelName = function () {
		return Zotero.Prefs.get('embeddings.model') || '';
	};

	/**
	 * Whether semantic search is enabled (a known model is selected).
	 * @return {Boolean}
	 */
	this.isEnabled = function () {
		return Object.prototype.hasOwnProperty.call(MODELS, this.getModelName());
	};

	/**
	 * Available models, in display order, for the preferences UI.
	 *
	 * @return {Object[]} - [{ name, l10nID }]
	 */
	this.getAvailableModels = function () {
		return Object.entries(MODELS).map(([name, model]) => ({ name, l10nID: model.l10nID }));
	};

	/**
	 * Identity of the active embedding function: model name plus its revision.
	 * Any code change that alters the vectors a model produces (dtype, upstream
	 * weights, prefixes, pooling) must bump that model's `revision`, so that
	 * stored embeddings are detected as stale and reindexed (see
	 * Indexing._ensureIndexMatchesModel()).
	 * @return {String}
	 */
	this.getModelVersion = function () {
		return this.getModelName() + '/' + _getModel().revision;
	};

	//
	// Embeddings database
	//
	// Stored vectors live in a separate attached database (embeddings.sqlite),
	// like the full-text content index: they're a local, rebuildable,
	// model-specific index derived from item metadata, kept out of
	// zotero.sqlite so they don't bloat the main database or its backups, and
	// versioned independently via PRAGMA user_version.
	//

	// Schema version of the attached embeddings database. The tables are only
	// created when this is bumped (_setUpDB() drops and recreates everything),
	// so any schema change needs a bump.
	const _dbVersion = 1;

	let _dbInitPromise = null;
	let _dbHooksRegistered = false;
	let _rebuildingDB = false;

	/**
	 * Attach the embeddings database, creating or rebuilding it as needed, and
	 * hook it into the main connection's lifecycle. Called lazily by every
	 * code path that touches the database, so the file isn't created until
	 * semantic search is actually used.
	 *
	 * @return {Promise}
	 */
	this.initDB = function () {
		if (!_dbInitPromise) {
			_dbInitPromise = _initDB();
			// Allow a later call to retry after a failed initialization (e.g.
			// a transient I/O error)
			_dbInitPromise.catch(() => {
				_dbInitPromise = null;
			});
		}
		return _dbInitPromise;
	};

	async function _initDB() {
		// Rebuild the database if its file is found corrupt. A malformed page
		// can surface from any query, so recovery is driven by the corruption
		// handler: drop the file and recreate it (it's derived, so indexing
		// repopulates it from item metadata). DBConnection confirms the main
		// database is intact before calling this, so a disposable index
		// failure never triggers main-database recovery.
		if (!_dbHooksRegistered) {
			_dbHooksRegistered = true;
			Zotero.DB.addCorruptionHandler(_rebuildDB);
			// An ATTACHed database doesn't survive a connection reopen (e.g.,
			// after a vacuum), so re-run the setup on every reconnect
			Zotero.DB.onConnect(_setUpDB);
			// The main-database vacuum doesn't reach the attached database, so
			// reclaim its space during the same idle maintenance
			Zotero.DB.onIdle(() => Zotero.Embeddings.vacuumDB());
		}
		// A corrupt database throws when first read here. Rebuild it right
		// away, so callers don't query a still-corrupt database until the
		// connection-level handler gets to it. Any non-corruption error is
		// unexpected.
		try {
			await _setUpDB();
		}
		catch (e) {
			if (!Zotero.DB.isCorruptionError(e)) {
				throw e;
			}
			Zotero.logError(e);
			await _rebuildDB();
		}
	}

	async function _setUpDB() {
		// Idempotent, since it can run again for a retried initialization or
		// after a connection reopen
		let attached = (await Zotero.DB.queryAsync("PRAGMA database_list"))
			.some(row => row.name == 'embeddings');
		if (!attached) {
			let path = Zotero.DataDirectory.getDatabase('embeddings');
			await Zotero.DB.queryAsync("ATTACH DATABASE ? AS embeddings", [path]);
		}
		// The embeddings are keyed by local itemID, which is reassigned
		// whenever zotero.sqlite is recreated (e.g., deleted and re-synced
		// from the server). Vectors stored against a different database
		// instance would map to the wrong items, so they have to be discarded
		// rather than reused. Detect that by comparing the localUserKey the
		// database was stamped with against the current one.
		let localUserKey = Zotero.Users.getLocalUserKey();
		let version = await Zotero.DB.valueQueryAsync("PRAGMA embeddings.user_version");
		let storedUserKey = version >= _dbVersion
			? await Zotero.DB.valueQueryAsync(
				"SELECT value FROM embeddings.itemEmbeddingsMeta WHERE key='localUserKey'")
			: false;
		if (version < _dbVersion || storedUserKey != localUserKey) {
			await Zotero.DB.queryAsync("DROP TABLE IF EXISTS embeddings.itemEmbeddings");
			await Zotero.DB.queryAsync("DROP TABLE IF EXISTS embeddings.itemEmbeddingsMeta");
			// No foreign key on itemID -- references across attached databases
			// aren't possible, so item deletions are handled by the indexing
			// notifier and eligibility pruning instead
			await Zotero.DB.queryAsync(
				"CREATE TABLE embeddings.itemEmbeddings (\n"
				+ "    itemID INTEGER PRIMARY KEY,\n"
				+ "    embedding BLOB NOT NULL,\n"
				+ "    sourceHash TEXT NOT NULL\n"
				+ ")"
			);
			// Database metadata: the localUserKey the vectors were built
			// against (above) and the identity of the model that produced them
			// (see Indexing._ensureIndexMatchesModel())
			await Zotero.DB.queryAsync(
				"CREATE TABLE embeddings.itemEmbeddingsMeta (\n"
				+ "    key TEXT PRIMARY KEY,\n"
				+ "    value NOT NULL\n"
				+ ")"
			);
			await Zotero.DB.queryAsync(
				"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) VALUES ('localUserKey', ?)",
				[localUserKey]
			);
			await Zotero.DB.queryAsync("PRAGMA embeddings.user_version = " + _dbVersion);
		}
	}

	async function _rebuildDB() {
		if (_rebuildingDB) {
			return;
		}
		_rebuildingDB = true;
		try {
			Zotero.debug("Rebuilding corrupt embeddings database", 1);
			let path = Zotero.DataDirectory.getDatabase('embeddings');
			// Detach before touching the file. If this fails (e.g., a
			// transaction is in progress), stop rather than delete a
			// still-attached database or reattach under a name that's still in
			// use -- the database stays as it was, and a later corruption
			// error or the next startup retries. The attach itself can be what
			// failed, in which case there's nothing to detach.
			let attached = (await Zotero.DB.queryAsync("PRAGMA database_list"))
				.some(row => row.name == 'embeddings');
			if (attached) {
				await Zotero.DB.queryAsync("DETACH DATABASE embeddings");
			}
			// Best-effort removal; if it fails, _setUpDB() reattaches the old
			// file and a later corruption error retries, rather than leaving
			// the database detached
			try {
				await IOUtils.remove(path, { ignoreAbsent: true });
				await IOUtils.remove(path + "-wal", { ignoreAbsent: true });
				await IOUtils.remove(path + "-shm", { ignoreAbsent: true });
			}
			catch (e) {
				Zotero.logError(e);
			}
			await _setUpDB();
			// The dropped vectors are re-derived from item metadata
			if (Zotero.Embeddings.isEnabled() && !Zotero.Embeddings.Indexing.isPaused()) {
				Zotero.Embeddings.Indexing.startIndexing();
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		finally {
			_rebuildingDB = false;
		}
	}

	/**
	 * Vacuum the embeddings database. Model switches and pruning delete whole
	 * swaths of vectors, which can leave embeddings.sqlite much bigger than
	 * its contents, and the main-database vacuum covers only the main
	 * database. Gated on the freelist threshold, which makes it
	 * self-throttling: a vacuum empties the freelist, so it won't run again
	 * until content drops substantially.
	 *
	 * @param {Object} [options]
	 * @param {Boolean} [options.force] - Skip the freelist and disk-space checks
	 * @return {Promise<Boolean>} - Whether the database was vacuumed
	 */
	this.vacuumDB = async function ({ force = false } = {}) {
		if (!force) {
			let freelistCount = await Zotero.DB.valueQueryAsync("PRAGMA embeddings.freelist_count");
			let pageCount = await Zotero.DB.valueQueryAsync("PRAGMA embeddings.page_count");
			let threshold = Zotero.Prefs.get('vacuum.freelistThreshold') || 10;
			if (!(pageCount > 0) || (freelistCount / pageCount * 100) < threshold) {
				return false;
			}
			// In-place VACUUM needs temporary space roughly the size of the database
			let path = Zotero.DataDirectory.getDatabase('embeddings');
			let size = (await IOUtils.stat(path)).size;
			if (Zotero.File.pathToFile(path).diskSpaceAvailable < size) {
				Zotero.debug("Not enough disk space to vacuum embeddings database -- skipping");
				return false;
			}
		}
		Zotero.debug("Vacuuming embeddings database");
		let t = new Date();
		await Zotero.DB.queryAsync("VACUUM embeddings");
		Zotero.debug("Vacuumed embeddings database in " + (new Date() - t) + " ms");
		return true;
	};

	function _getModel() {
		let name = Zotero.Embeddings.getModelName();
		let model = MODELS[name];
		if (!model) {
			throw new Error(`Unknown embeddings model '${name}'`);
		}
		return model;
	}

	/**
	 * Whether the active model has been fully downloaded and is ready to use.
	 *
	 * @return {Promise<Boolean>}
	 */
	this.isDownloaded = async function () {
		let modelId = _getModel().modelId;
		let cached = await Zotero.ML.listModels({ taskName: TASK_NAME });
		return cached.some(model => model.modelId === modelId);
	};


	/**
	 * Make the active model available to the inference runtime, downloading it
	 * if the runtime doesn't have it cached. Interrupted downloads resume, so
	 * this can be called again after a failure.
	 *
	 * @param {Function} [onProgress] - Called with the runtime's download
	 *     progress
	 * @return {Promise}
	 */
	this.download = async function (onProgress) {
		if (await this.isDownloaded()) {
			Zotero.debug(`Embeddings: model '${this.getModelName()}' already downloaded`);
			return;
		}
		Zotero.debug(`Embeddings: downloading model '${this.getModelName()}'`);
		// Creating the engine downloads whatever the runtime is missing
		await _getEngine(onProgress);
		Zotero.debug(`Embeddings: model '${this.getModelName()}' downloaded`);
	};


	/**
	 * Delete cached model files other than the active model's (all of them when
	 * disabled), freeing disk space after a model switch.
	 *
	 * @return {Promise}
	 */
	this.pruneModels = async function () {
		let keep = this.isEnabled() ? _getModel().modelId : null;
		for (let model of await Zotero.ML.listModels({ taskName: TASK_NAME })) {
			if (model.modelId !== keep) {
				await Zotero.ML.deleteModels({
					taskName: TASK_NAME,
					model: model.name,
					revision: model.revision
				});
			}
		}
	};


	//
	// Embedding generation, in Firefox's inference process via Zotero.ML. The
	// runtime downloads the model files and caches them in the profile
	// directory, so they aren't part of the data directory or its backups.
	//

	let _engine = null;
	let _engineReady = null;
	// Model identity the current engine was created for
	let _engineModelVersion = null;
	// Bumped on every engine shutdown (e.g. a model switch), so long-running
	// consumers can detect that the model changed under them and discard
	// their results
	let _modelGeneration = 0;

	/**
	 * Thrown when the stored embeddings can't be searched for the active
	 * model -- during a model switch, or while the index is being rebuilt
	 * after a revision bump. Callers should treat the index as still being
	 * prepared rather than scoring mismatched data.
	 */
	this.IndexNotReadyError = class extends Error {
		constructor(message) {
			super(message);
			this.name = 'EmbeddingsIndexNotReadyError';
		}
	};

	/**
	 * Thrown when scoring is abandoned via the shouldCancel callback -- e.g.
	 * because a newer query superseded the one being scored
	 */
	this.ScoringCancelledError = class extends Error {
		constructor(message = 'Scoring cancelled') {
			super(message);
			this.name = 'EmbeddingsScoringCancelledError';
		}
	};

	// Create the inference engine if needed. The engine reads the model files
	// from the model directory, so the model must already be downloaded.
	async function _getEngine(onProgress) {
		// An engine created for a different model or revision can't be reused
		// -- its weights and prefixes wouldn't match the active model
		if (_engine && _engineModelVersion
				&& _engineModelVersion !== Zotero.Embeddings.getModelVersion()) {
			await Zotero.Embeddings.shutdownEngine();
		}
		if (!_engineReady) {
			let modelVersion = Zotero.Embeddings.getModelVersion();
			_engineReady = (async () => {
				let model = _getModel();
				Zotero.debug(`Embeddings: creating engine for '${model.modelId}' `
					+ `(dtype ${model.dtype}, pooling ${model.pooling})`);
				_engine = await Zotero.ML.createEngine({
					engineId: 'zotero-embeddings',
					taskName: TASK_NAME,
					backend: 'onnx-native',
					modelId: model.modelId,
					modelRevision: 'main',
					modelHubRootUrl: MODEL_HUB_ROOT_URL,
					modelHubUrlTemplate: MODEL_HUB_URL_TEMPLATE,
					dtype: model.dtype,
					numThreads: Zotero.ML.getOptimalConcurrency()
				}, onProgress);
				_engineModelVersion = modelVersion;
				Zotero.debug('Embeddings: engine ready');
			})();
		}
		try {
			await _engineReady;
		}
		catch (e) {
			// Allow a later retry after a failed initialization
			_engineReady = null;
			throw e;
		}
		return _engine;
	}

	/**
	 * Prepare embeddings ahead of time: download the model if needed, then
	 * create the inference engine so the first embed() is fast.
	 *
	 * @return {Promise} Resolves when the engine is ready to embed
	 */
	this.preloadModel = async function (onProgress) {
		await this.download(onProgress);
		await _getEngine();
	};

	/**
	 * Shut down the inference engine and the process running it, releasing the
	 * memory held by the loaded model
	 *
	 * @return {Promise}
	 */
	this.shutdownEngine = async function ({ modelChanged = true } = {}) {
		let engine = _engine;
		_engine = null;
		_engineReady = null;
		_engineModelVersion = null;
		// Only a model change makes vectors computed by the old engine
		// unusable, so a shutdown to release memory leaves scoring alone
		if (modelChanged) {
			_modelGeneration++;
		}
		if (engine) {
			await engine.terminate();
			await Zotero.ML.shutdown();
		}
	};

	/**
	 * Embed an arbitrary string, returning the model's vector. Task prefixes
	 * ("query: ", "passage: ") are NOT added here -- add them at the call site
	 * if the model expects them.
	 *
	 * @param {String} text
	 * @return {Promise<Float32Array>}
	 */
	function _normalize(vector) {
		let sum = 0;
		for (let val of vector) {
			sum += val * val;
		}
		let magnitude = Math.sqrt(sum);
		if (magnitude) {
			for (let i = 0; i < vector.length; i++) {
				vector[i] /= magnitude;
			}
		}
		return vector;
	}


	this.embed = async function (text) {
		let vectors = await this.embedMany([text]);
		return vectors[0];
	};

	/**
	 * Embed multiple strings in a single engine call.
	 *
	 * @param {String[]} texts
	 * @return {Promise<Float32Array[]>}
	 */
	this.embedMany = async function (texts) {
		if (!texts.length) {
			return [];
		}
		let engine = await _getEngine();
		let model = _getModel();
		Zotero.debug(`Embeddings: embedding batch of ${texts.length}`);
		// The runtime spreads `args` into the pipeline call, so the batch of
		// texts is a single argument
		let vectors = await engine.run({
			args: [texts],
			options: { pooling: model.pooling }
		});
		Zotero.debug(`Embeddings: batch of ${texts.length} done`);
		// Scoring compares vectors with a plain dot product, which only
		// measures how closely two of them point in the same direction when
		// both have a length of 1
		return vectors.map(vector => _normalize(new Float32Array(vector)));
	};

	// The last embedded query, reused across the scoring passes a single
	// search triggers (per-row membership cutoffs plus the merged ranking)
	let _queryCache = null;

	/**
	 * Normalize a best-match query: trim whitespace and strip a single pair
	 * of wrapping quotes, which carry no phrase semantics here -- the whole
	 * query embeds as one string. A query that normalizes to an empty string
	 * is no query at all, and callers treat it as no active search.
	 *
	 * @param {String} text
	 * @return {String}
	 */
	this.normalizeQuery = function (text) {
		return text.trim().replace(/^"(.*)"$/s, '$1').trim();
	};

	/**
	 * Embed a search query string, applying the active model's query prefix.
	 *
	 * @param {String} text
	 * @return {Promise<Float32Array>}
	 */
	this.embedQuery = function (text) {
		text = this.normalizeQuery(text);
		// Callers treat a query that normalizes to nothing as no search at
		// all, so it should never get this far -- embedding just the model's
		// query prefix would rank against noise
		if (!text) {
			throw new Error("Empty best-match query");
		}
		let modelVersion = this.getModelVersion();
		if (_queryCache && _queryCache.modelVersion === modelVersion
				&& _queryCache.text === text) {
			return _queryCache.promise;
		}
		// Cache the in-flight promise, so the concurrent per-row scoring
		// passes of a multi-collection search share one embed
		let promise = this.embed(_getModel().queryPrefix + text);
		_queryCache = { modelVersion, text, promise };
		// Don't cache a failed embed
		promise.catch(() => {
			if (_queryCache && _queryCache.promise === promise) {
				_queryCache = null;
			}
		});
		return promise;
	};

	/**
	 * Embed passages (item texts), applying the active model's passage prefix.
	 *
	 * @param {String[]} texts
	 * @return {Promise<Float32Array[]>}
	 */
	this.embedPassages = function (texts) {
		let passagePrefix = _getModel().passagePrefix;
		return this.embedMany(texts.map(text => passagePrefix + text));
	};

	/**
	 * Map a raw similarity score onto the active model's display range, for
	 * the Relevance column's bar. The ranges are empirical per-model
	 * constants (see displayScoreRange in MODELS): scores at or below the
	 * floor render as an empty bar, at or above the ceiling as a full one.
	 *
	 * @param {Number} score
	 * @return {Number} - 0-1
	 */
	this.getScoreFraction = function (score) {
		let model = MODELS[this.getModelName()];
		if (!model) {
			return 0;
		}
		let [min, max] = model.displayScoreRange;
		return Math.min(1, Math.max(0, (score - min) / (max - min)));
	};

	// mozStorage returns a BLOB as an array of byte values; reinterpret those
	// bytes as the stored Float32 embedding vector.
	function _blobToVector(blob) {
		let bytes = Uint8Array.from(blob);
		return new Float32Array(bytes.buffer);
	}

	/**
	 * Score a given set of items by similarity to a query. Items without a
	 * stored embedding aren't scored. Used to apply semantic ranking within an
	 * existing result scope (e.g. the current collection) rather than the
	 * whole library.
	 *
	 * @param {String} queryText
	 * @param {Number[]} itemIDs - Candidate item IDs to score
	 * @param {Object} [options]
	 * @param {Function} [options.shouldCancel] - Checked between chunks;
	 *     return true to abandon scoring with a ScoringCancelledError (e.g.
	 *     because a newer query made this one obsolete)
	 * @return {Promise<Map>} - itemID -> similarity score (higher is more similar)
	 */
	this.scoreItemIDs = async function (queryText, itemIDs, { shouldCancel } = {}) {
		let scores = new Map();
		if (!itemIDs.length || !this.isEnabled()) {
			return scores;
		}
		// Wait out any in-progress model switch, so the query isn't embedded
		// with one model and compared against another's vectors
		await Zotero.Embeddings.Indexing.waitForPendingModelSwitch();
		await this.initDB();
		// The stored vectors must have been produced by the active model.
		// During a switch, or a reindex after a revision bump, the database
		// isn't stamped for the new model until the indexer starts filling it.
		let modelVersion = this.getModelVersion();
		let indexedVersion = await Zotero.DB.valueQueryAsync(
			"SELECT value FROM embeddings.itemEmbeddingsMeta WHERE key='modelVersion'"
		);
		if (indexedVersion !== modelVersion) {
			throw new this.IndexNotReadyError(
				`Embeddings index is for '${indexedVersion || 'no model'}', `
					+ `but the active model is '${modelVersion}'`
			);
		}
		let generation = _modelGeneration;
		let query = await this.embedQuery(queryText);
		let dim = query.length;

		// Load embeddings for the candidates in chunks (avoids the SQLite bound-
		// parameter limit for large collections), scoring each as we go.
		let chunkSize = 500;
		for (let i = 0; i < itemIDs.length; i += chunkSize) {
			if (shouldCancel && shouldCancel()) {
				throw new this.ScoringCancelledError();
			}
			// If the model changed while we were scoring, the scores computed
			// so far mix models -- discard them
			if (generation !== _modelGeneration) {
				throw new this.IndexNotReadyError('Model changed during scoring');
			}
			let chunk = itemIDs.slice(i, i + chunkSize);
			let rows = await Zotero.DB.queryAsync(
				"SELECT itemID, embedding FROM embeddings.itemEmbeddings WHERE itemID IN ("
					+ chunk.map(() => '?').join(',') + ")",
				chunk
			);
			for (let row of rows) {
				let vec = _blobToVector(row.embedding);
				let dot = 0;
				for (let d = 0; d < dim; d++) {
					dot += query[d] * vec[d];
				}
				scores.set(row.itemID, dot);
			}
		}
		if (generation !== _modelGeneration) {
			throw new this.IndexNotReadyError('Model changed during scoring');
		}
		return scores;
	};

};


/**
 * Background indexing flow for semantic search: a single queue of itemIDs
 * drained by one consumer loop.
 * Inference runs out of process; batches yield between DB writes.
 * Also switches models when the extensions.zotero.embeddings.model preference
 * changes. Progress is reported per library via listeners.
 */
Zotero.Embeddings.Indexing = new function () {
	let _initialized = false;
	let _indexing = false;
	let _indexingPromise = null;
	let _stopping = false;
	let _phase = 'idle'; // 'idle' | 'downloading' | 'indexing'
	// Bytes of the model downloaded so far, while _phase is 'downloading'
	let _downloadProgress = null;
	let _lastError = null;
	let _status = new Map(); // libraryID -> { name, indexed, eligible }
	let _progressListeners = new Set();
	let _lastStatusRefresh = 0;

	// The indexing queue. Producers (the item notifier, startIndexing()) only
	// add itemIDs here; _run() is the single consumer that embeds them.
	let _queue = new Set();
	let _kickTimer = null;

	// Characters of text per engine call (see _indexItems()). Under memory
	// pressure this is halved, down to DEGRADED_CHAR_BUDGET_FLOOR, and the
	// engine is shut down so the next one's memory arena grows only to the
	// smaller peak. Restored when the pressure lifts.
	const DEFAULT_CHAR_BUDGET = 12000;
	const DEGRADED_CHAR_BUDGET_FLOOR = 1500;
	let _charBudget = DEFAULT_CHAR_BUDGET;

	// Don't start a run that would load the model with less than this much
	// memory available, since inference needs room well beyond the model files
	const MIN_AVAILABLE_MEMORY = 1.5 * 1024 * 1024 * 1024;

	// Wait longer than the usual debounce before retrying a run that was held
	// off for memory
	const LOW_MEMORY_RETRY_DELAY = 5 * 60 * 1000;
	// Debounce before starting the consumer, so a burst of changes (e.g. an
	// import) is picked up in one pass
	const KICK_DELAY = 3000;
	// itemIDs pulled off the queue per consumer iteration. Large enough that
	// sorting by text length within the chunk (see indexItems()) produces
	// well-packed batches
	const CHUNK_SIZE = 256;

	// Serialize model switches so rapid preference changes don't run their
	// clear/prune/re-index steps concurrently.
	let _switchChain = Promise.resolve();

	// Items whose embeddings were written but not yet announced to views, and
	// the coalescing timer for the announcement (see _notifyIndexed())
	let _indexedNotifyIDs = new Set();
	let _indexedNotifyTimer = null;
	const INDEXED_NOTIFY_DELAY = 2000;

	/**
	 * Wire up the background indexer. Guarded so multiple windows don't
	 * double-initialize.
	 */
	this.init = function () {
		if (_initialized) {
			return;
		}
		_initialized = true;

		// Changing the model preference (including to/from "" = Disabled) switches
		// models: clear old embeddings + files and re-index with the new one.
		Zotero.Prefs.registerObserver('embeddings.model', () => {
			_switchModel();
		});

		Zotero.Notifier.registerObserver({
			notify: async (event, type, ids) => {
				if (type !== 'item' || !Zotero.Embeddings.isEnabled()) {
					return;
				}
				// No foreign key removes an item's stored embedding when the
				// item is deleted (references across attached databases aren't
				// possible), so drop it here -- even while indexing is paused,
				// since this is removal of stale data rather than indexing
				if (event === 'delete') {
					await _deleteEmbeddings(ids);
					return;
				}
				if (Zotero.Embeddings.Indexing.isPaused()) {
					return;
				}
				if (event === 'add' || event === 'modify') {
					for (let id of ids) {
						_queue.add(id);
					}
					_scheduleKick();
				}
			}
		}, ['item'], 'embeddings');

		// Resume indexing if a model is selected and indexing wasn't explicitly
		// stopped, after a short delay so we don't compete with window setup.
		if (Zotero.Embeddings.isEnabled() && !this.isPaused()) {
			Zotero.Promise.delay(5000).then(() => {
				if (Zotero.Embeddings.isEnabled() && !Zotero.Embeddings.Indexing.isPaused()) {
					Zotero.Embeddings.Indexing.startIndexing();
				}
			});
		}
	};

	/**
	 * Whether indexing has been explicitly stopped. While paused, nothing is
	 * indexed at all -- item changes aren't even enqueued -- until
	 * startIndexing() is called again. Persisted so a stop survives a restart.
	 * @return {Boolean}
	 */
	this.isPaused = function () {
		return !!Zotero.Prefs.get('embeddings.indexingPaused');
	};

	function _switchModel() {
		_switchChain = _switchChain.then(() => _doSwitchModel()).catch(e => Zotero.logError(e));
		return _switchChain;
	}

	/**
	 * Resolves once any in-progress model switch (stopping the indexer,
	 * clearing the old vectors, starting reindexing) has finished, so that
	 * callers don't operate across a switch
	 *
	 * @return {Promise}
	 */
	this.waitForPendingModelSwitch = function () {
		return _switchChain;
	};

	async function _doSwitchModel() {
		// Stop any in-progress indexing and wait for it to actually finish before
		// touching the stored vectors, so we never mix models/dimensions.
		Zotero.Embeddings.Indexing.stopIndexing();
		if (_indexingPromise) {
			try {
				await _indexingPromise;
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		await Zotero.Embeddings.shutdownEngine();

		// Different models produce different-dimension vectors, so all stored
		// embeddings are wiped on any switch -- including disabling, which drops
		// the index and the downloaded files entirely. Then drop every downloaded
		// model except the newly-selected one.
		await _clearEmbeddings();
		await Zotero.Embeddings.pruneModels();
		_status.clear();

		if (Zotero.Embeddings.isEnabled()) {
			Zotero.Embeddings.Indexing.startIndexing();
		}
		else {
			_emitProgress();
		}
	}

	// Debounce before starting the consumer, so a burst of changes (e.g. an
	// import) is picked up in one pass. Enqueued ids just sit in the queue
	// until the consumer runs.
	// Inference memory is dominated by the padded text in each batch, so
	// respond to system memory pressure by shrinking the batches rather than
	// stopping: indexing keeps making progress, just more slowly. The engine is
	// shut down at the same time, both to release its memory immediately and
	// because its memory arena never shrinks -- only a new engine picks up the
	// smaller budget.
	let _memoryPressureObserver = {
		observe: (subject, topic) => {
			if (topic === 'memory-pressure-stop') {
				if (_charBudget !== DEFAULT_CHAR_BUDGET) {
					Zotero.debug("Embeddings: memory pressure over -- restoring batch size");
					_charBudget = DEFAULT_CHAR_BUDGET;
				}
				return;
			}
			if (_charBudget <= DEGRADED_CHAR_BUDGET_FLOOR) {
				return;
			}
			_charBudget = Math.max(
				DEGRADED_CHAR_BUDGET_FLOOR, Math.floor(_charBudget / 2)
			);
			Zotero.debug(`Embeddings: memory pressure -- batch size reduced to `
				+ `${_charBudget} characters`);
			Zotero.Embeddings.shutdownEngine({ modelChanged: false })
				.catch(e => Zotero.logError(e));
		},
	};
	Services.obs.addObserver(_memoryPressureObserver, 'memory-pressure');
	Services.obs.addObserver(_memoryPressureObserver, 'memory-pressure-stop');

	/**
	 * Whether there's enough memory available to load the model and run
	 * inference. The runtime's own check is against total system memory, which
	 * says nothing about what's free right now.
	 *
	 * @return {Boolean}
	 */
	function _hasMemoryToIndex() {
		try {
			let available = Cc["@mozilla.org/ml-utils;1"]
				.getService(Ci.nsIMLUtils)
				.availablePhysicalMemory;
			if (available && available < MIN_AVAILABLE_MEMORY) {
				Zotero.debug(`Embeddings: only ${Math.round(available / 1024 / 1024)} MB `
					+ "available -- not indexing yet");
				return false;
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		return true;
	}

	function _scheduleKick(delay = KICK_DELAY) {
		if (_kickTimer) {
			clearTimeout(_kickTimer);
		}
		_kickTimer = setTimeout(() => {
			_kickTimer = null;
			_startConsumer();
		}, delay);
	}

	// Start the consumer loop if there's work and it isn't already running
	function _startConsumer() {
		if (_indexing) {
			return _indexingPromise;
		}
		if (!_queue.size || !Zotero.Embeddings.isEnabled()
				|| Zotero.Embeddings.Indexing.isPaused()) {
			return Promise.resolve();
		}
		_indexingPromise = _run();
		return _indexingPromise;
	}

	// The single definition of an eligible item: a regular item with a
	// non-empty title (including type-specific title fields -- caseName,
	// subject, nameOfAct) or abstract, in any library.
	// Everything that needs to know what's eligible -- enqueueing, pruning,
	// progress counts -- works from this result.
	//
	// @return {Promise<Map>} - libraryID -> [itemID, ...]
	async function _getEligibleItemIDs() {
		let fieldIDs = [...new Set([
			Zotero.ItemFields.getID('title'),
			Zotero.ItemFields.getID('abstractNote'),
			...Zotero.ItemFields.getTypeFieldsFromBase('title')
		])];
		let rows = await Zotero.DB.queryAsync(
			"SELECT DISTINCT libraryID, itemID FROM itemData "
				+ "JOIN itemDataValues USING (valueID) "
				+ "JOIN items USING (itemID) "
				+ "WHERE fieldID IN (" + fieldIDs.join(',') + ") "
				+ "AND TRIM(value)!='' AND itemTypeID!=?",
			Zotero.ItemTypes.getID('attachment')
		);
		let byLibrary = new Map();
		for (let row of rows) {
			let ids = byLibrary.get(row.libraryID);
			if (!ids) {
				ids = [];
				byLibrary.set(row.libraryID, ids);
			}
			ids.push(row.itemID);
		}
		return byLibrary;
	}

	// Enqueue every eligible item, library by library, so the queue drains
	// one library at a time. indexItems() skips items whose stored embedding
	// is already current (via sourceHash), so re-enqueueing everything on
	// each start is cheap for already-indexed items.
	function _enqueueAllLibraries(eligibleByLibrary) {
		for (let library of _indexableLibraries()) {
			for (let id of eligibleByLibrary.get(library.libraryID) || []) {
				_queue.add(id);
			}
		}
	}

	// Drop stored embeddings for items that are no longer eligible (e.g. the
	// title and abstract were cleared).
	async function _pruneOrphanedEmbeddings(eligibleByLibrary) {
		await Zotero.Embeddings.initDB();
		let eligible = new Set();
		for (let ids of eligibleByLibrary.values()) {
			for (let id of ids) {
				eligible.add(id);
			}
		}
		let stored = await Zotero.DB.columnQueryAsync("SELECT itemID FROM embeddings.itemEmbeddings");
		await _deleteEmbeddings(stored.filter(id => !eligible.has(id)));
	}

	// Delete the stored embeddings for the given items, in chunks (avoids the
	// SQLite bound-parameter limit)
	async function _deleteEmbeddings(itemIDs) {
		await Zotero.Embeddings.initDB();
		let chunkSize = 500;
		for (let i = 0; i < itemIDs.length; i += chunkSize) {
			let chunk = itemIDs.slice(i, i + chunkSize);
			await Zotero.DB.queryAsync(
				"DELETE FROM embeddings.itemEmbeddings WHERE itemID IN ("
					+ chunk.map(() => '?').join(',') + ")",
				chunk
			);
		}
	}

	// Delete all stored item embeddings. This removes the computed vectors,
	// not the downloaded model files.
	async function _clearEmbeddings() {
		await Zotero.Embeddings.initDB();
		// Announce the removals, so active semantic views refresh after the
		// notification's coalescing delay (e.g. after disabling or a model
		// switch)
		let cleared = await Zotero.DB.columnQueryAsync(
			"SELECT itemID FROM embeddings.itemEmbeddings"
		);
		await Zotero.DB.queryAsync("DELETE FROM embeddings.itemEmbeddings");
		if (cleared.length) {
			_notifyIndexed(cleared);
		}
	}

	// Number of items in a library that have a stored embedding -- the
	// numerator for indexing progress
	function _getIndexedCount(libraryID) {
		return Zotero.DB.valueQueryAsync(
			"SELECT COUNT(*) FROM embeddings.itemEmbeddings JOIN items USING (itemID) WHERE libraryID=?",
			libraryID
		);
	}

	// Text we embed for an item: its title and abstract. A title alone is
	// enough -- it's useful signal even without an abstract. Returns null only
	// for items with neither.
	function _getItemText(item) {
		// Include type-specific title fields (caseName, subject, nameOfAct)
		let title = item.getField('title', false, true);
		let abstract = item.getField('abstractNote');
		if (title && abstract) {
			return `${title}\n\n${abstract}`;
		}
		return title || abstract || null;
	}

	// Compute and store embeddings for the given items, skipping any whose
	// stored embedding is already up to date (via sourceHash). Items with no
	// embeddable text (neither a title nor an abstract) have any existing
	// embedding removed.
	//
	// @param {Zotero.Item[]} items
	// @param {Object} [options]
	// @param {Function} [options.onProgress] - Called as { done, total }
	// @param {Number} [options.maxBatchItems=20] - Most items per engine call
	// @param {Number} [options.batchCharBudget=12000] - Most characters per
	//     engine call, counting every text in the batch as long as its longest
	//     one, since they're padded to that length. Attention memory grows with
	//     the square of the padded length, so a batch of long abstracts uses
	//     far more memory than the same number of short ones.
	// @param {Function} [options.shouldStop] - Called before each batch;
	//     return true to stop early
	// @return {Promise<Number>} - Number of embeddings stored
	async function _indexItems(items, {
		onProgress,
		maxBatchItems = 20,
		batchCharBudget = 12000,
		shouldStop
	} = {}) {
		await Zotero.Items.loadDataTypes(items, ['itemData']);

		let toEmbed = [];
		for (let item of items) {
			let text = _getItemText(item);
			if (!text) {
				await Zotero.DB.queryAsync(
					"DELETE FROM embeddings.itemEmbeddings WHERE itemID=?", item.id
				);
				continue;
			}
			let hash = Zotero.Utilities.Internal.md5(text);
			let existing = await Zotero.DB.valueQueryAsync(
				"SELECT sourceHash FROM embeddings.itemEmbeddings WHERE itemID=?", item.id
			);
			if (existing !== hash) {
				toEmbed.push({ item, text, hash });
			}
		}

		// Process one library at a time
		toEmbed.sort((a, b) => (a.item.libraryID - b.item.libraryID)
			|| (a.text.length - b.text.length));

		let done = 0;
		for (let i = 0; i < toEmbed.length; ) {
			if (shouldStop && shouldStop()) {
				break;
			}
			// Take as many of the next (length-sorted) texts as fit the budget,
			// always at least one
			let longest = 0;
			let count = 0;
			while (i + count < toEmbed.length && count < maxBatchItems) {
				let length = Math.max(longest, toEmbed[i + count].text.length);
				if (count && length * (count + 1) > batchCharBudget) {
					break;
				}
				longest = length;
				count++;
			}
			let batch = toEmbed.slice(i, i + count);
			i += count;
			let vectors = await Zotero.Embeddings.embedPassages(batch.map(b => b.text));
			await Zotero.DB.executeTransaction(async function () {
				for (let j = 0; j < batch.length; j++) {
					// The item may have been deleted while the batch was
					// embedding -- don't write its vector back after the
					// delete notifier removed it
					if (!Zotero.Items.get(batch[j].item.id)) {
						continue;
					}
					let vector = vectors[j];
					let blob = new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
					// Keep the embedding blobs out of debug output
					await Zotero.DB.queryAsync(
						"REPLACE INTO embeddings.itemEmbeddings (itemID, embedding, sourceHash) "
							+ "VALUES (?, ?, ?)",
						[batch[j].item.id, blob, batch[j].hash],
						{ debugParams: false }
					);
				}
			});
			_notifyIndexed(batch.map(b => b.item.id));
			done += batch.length;
			if (onProgress) {
				onProgress({ done, total: toEmbed.length });
			}
			// Yield so the UI thread stays responsive between batches
			await Zotero.Promise.delay(0);
		}
		return done;
	}

	function _indexableLibraries() {
		return Zotero.Libraries.getAll()
			.filter(library => ['user', 'group'].includes(library.libraryType));
	}

	// Announce written or removed embeddings with a 'refresh' item event, so
	// an active best-match search reranks as vectors change (e.g. during
	// initial indexing, or after a clear). The embeddingsUpdate flag lets the
	// item tree rerank only for these events, not for every refresh. Coalesced,
	// so a long indexing run produces an update every couple of seconds rather
	// than one per committed batch.
	function _notifyIndexed(itemIDs) {
		for (let id of itemIDs) {
			_indexedNotifyIDs.add(id);
		}
		if (_indexedNotifyTimer) {
			return;
		}
		_indexedNotifyTimer = setTimeout(() => {
			_indexedNotifyTimer = null;
			let ids = [..._indexedNotifyIDs];
			_indexedNotifyIDs.clear();
			Zotero.Notifier.trigger('refresh', 'item', ids, { embeddingsUpdate: true })
				.catch(e => Zotero.logError(e));
		}, INDEXED_NOTIFY_DELAY);
	}

	/**
	 * Current runner state, for the preferences UI.
	 */
	this.getStatus = function () {
		return {
			enabled: Zotero.Embeddings.isEnabled(),
			model: Zotero.Embeddings.getModelName(),
			indexing: _indexing,
			// A stop has been requested but the current batch is still finishing
			stopping: _indexing && _stopping,
			paused: this.isPaused(),
			phase: _phase,
			downloadProgress: _downloadProgress,
			error: _lastError ? (_lastError.message || String(_lastError)) : null,
			libraries: [..._status.entries()].map(([libraryID, s]) => ({ libraryID, ...s }))
		};
	};

	this.addProgressListener = function (fn) {
		_progressListeners.add(fn);
	};

	this.removeProgressListener = function (fn) {
		_progressListeners.delete(fn);
	};

	function _emitProgress() {
		let status = Zotero.Embeddings.Indexing.getStatus();
		for (let fn of _progressListeners) {
			try {
				fn(status);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
	}

	/**
	 * Recompute per-library indexed/eligible counts (without indexing anything)
	 * and notify listeners. Used by the preferences UI to show current state.
	 *
	 * @return {Promise<Object>} - The status object
	 */
	this.refreshStatus = async function () {
		// Don't create and attach the embeddings database just to report a
		// disabled state (e.g. when the Advanced preferences pane opens)
		if (!Zotero.Embeddings.isEnabled()) {
			_emitProgress();
			return Zotero.Embeddings.Indexing.getStatus();
		}
		await Zotero.Embeddings.initDB();
		let eligibleByLibrary = await _getEligibleItemIDs();
		for (let library of _indexableLibraries()) {
			_status.set(library.libraryID, {
				name: library.name,
				indexed: await _getIndexedCount(library.libraryID),
				eligible: (eligibleByLibrary.get(library.libraryID) || []).length
			});
		}
		_emitProgress();
		return Zotero.Embeddings.Indexing.getStatus();
	};

	/**
	 * Start (or resume) indexing: clear a previous stopIndexing(), drop stored
	 * embeddings for items that no longer have an abstract, re-enqueue every
	 * eligible item across all libraries (already-indexed items are skipped
	 * via their source hash, so this is cheap), and run the consumer. Safe to
	 * call while the consumer is already running -- the new work is just
	 * picked up by the existing loop.
	 *
	 * @return {Promise} - Resolves when the queue has been drained or indexing
	 *     was stopped
	 */
	this.startIndexing = function () {
		if (!Zotero.Embeddings.isEnabled()) {
			return Promise.resolve();
		}
		Zotero.Prefs.set('embeddings.indexingPaused', false);
		return (async () => {
			// If a consumer is still winding down from a stop, let it finish
			// before starting a fresh run
			if (_indexing && _stopping) {
				try {
					await _indexingPromise;
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			let eligibleByLibrary = await _getEligibleItemIDs();
			await _pruneOrphanedEmbeddings(eligibleByLibrary);
			_enqueueAllLibraries(eligibleByLibrary);
			return _startConsumer();
		})();
	};

	// Make sure the stored embeddings were produced by the active model
	// definition, comparing Zotero.Embeddings.getModelVersion() against the
	// identity recorded (in the database's meta table) when the vectors were
	// stored. On mismatch -- a model switch, or a `revision` bump after a
	// dtype/weights change -- all stored vectors are cleared, and the indexing
	// pass that follows rebuilds them.
	async function _ensureIndexMatchesModel() {
		let current = Zotero.Embeddings.getModelVersion();
		let indexed = await Zotero.DB.valueQueryAsync(
			"SELECT value FROM embeddings.itemEmbeddingsMeta WHERE key='modelVersion'"
		);
		if (indexed === current) {
			return;
		}
		// No recorded identity but stored vectors present: the embeddings
		// predate identity tracking, so their provenance can't be verified --
		// treat them as stale too
		let hasStale = indexed
			|| await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM embeddings.itemEmbeddings");
		if (hasStale) {
			Zotero.debug(`Embeddings: stored embeddings are from '${indexed || 'unknown'}' `
				+ `but the active model is '${current}' -- clearing for reindexing`);
			await _clearEmbeddings();
			_status.clear();
		}
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) VALUES ('modelVersion', ?)",
			[current]
		);
	}

	// The single consumer: drain the queue in chunks until it's empty or
	// stopIndexing() is called. Every indexing pass -- library-wide or
	// notifier-driven -- runs through here, so there's never more than one
	// indexing process and all of them can be stopped.
	// The runtime's progress is a percentage of the files it has discovered so
	// far, so it jumps while the small config and tokenizer files are fetched
	// and then climbs steadily through the weights, which dominate the
	// download. Reports arrive frequently, so only emit on a change of at
	// least a percentage point.
	function _onDownloadProgress({ type, progress, totalLoaded, total, units }) {
		if (type !== 'downloading' || units !== 'bytes' || !total) {
			return;
		}
		let previous = _downloadProgress;
		let fraction = Math.min(progress / 100, 1);
		// The first file is fetched and completed before the rest are known,
		// which reads as a complete download -- stay indeterminate until
		// there's something left to report
		if (!previous && fraction >= 1) {
			return;
		}
		_downloadProgress = { loaded: totalLoaded, total, fraction };
		if (!previous || Math.abs(fraction - previous.fraction) >= 0.01) {
			_emitProgress();
		}
	}


	async function _run() {
		// Wait for memory rather than starting a run that would make things
		// worse. The queue is untouched, so a later kick picks it up.
		if (!_hasMemoryToIndex()) {
			_scheduleKick(LOW_MEMORY_RETRY_DELAY);
			return;
		}
		_indexing = true;
		_stopping = false;
		_lastError = null;
		try {
			await Zotero.Embeddings.initDB();
			await _ensureIndexMatchesModel();
			_phase = (await Zotero.Embeddings.isDownloaded()) ? 'indexing' : 'downloading';
			_emitProgress();
			await Zotero.Embeddings.Indexing.refreshStatus();
			await Zotero.Embeddings.preloadModel(_onDownloadProgress);

			_phase = 'indexing';
			_downloadProgress = null;
			_emitProgress();
			let shouldStop = () => _stopping;
			while (_queue.size) {
				if (shouldStop()) {
					break;
				}
				// Pull the next chunk of ids off the queue
				let ids = [];
				for (let id of _queue) {
					ids.push(id);
					_queue.delete(id);
					if (ids.length >= CHUNK_SIZE) {
						break;
					}
				}
				// Deleted items simply aren't returned; their embeddings are
				// removed by the delete notifier
				let items = (await Zotero.Items.getAsync(ids))
					.filter(item => item.isRegularItem());
				if (!items.length) {
					continue;
				}
				await _indexItems(items, {
					shouldStop,
					batchCharBudget: _charBudget,
					onProgress: () => _refreshStatusThrottled()
				});
			}
			await Zotero.Embeddings.Indexing.refreshStatus();
		}
		catch (e) {
			Zotero.logError(e);
			_lastError = e;
		}
		finally {
			_indexing = false;
			_phase = 'idle';
			_downloadProgress = null;
			_emitProgress();
			// Pick up anything enqueued while we were finishing up
			if (_queue.size && !_stopping) {
				_scheduleKick();
			}
			// Inference memory is held by the process running the model, and
			// the runtime's own idle timeout is long, so release it as soon as
			// there's nothing left to index
			else {
				try {
					await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
		}
	}

	function _refreshStatusThrottled() {
		let now = Date.now();
		if (now - _lastStatusRefresh < 5000) {
			return;
		}
		_lastStatusRefresh = now;
		Zotero.Embeddings.Indexing.refreshStatus().catch(e => Zotero.logError(e));
	}

	this.stopIndexing = function () {
		_stopping = true;
		_queue.clear();
		if (_kickTimer) {
			clearTimeout(_kickTimer);
			_kickTimer = null;
		}
		Zotero.Prefs.set('embeddings.indexingPaused', true);
		_emitProgress();
	};
};
