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
 * Zotero.Embeddings -- the embedding engine and its public face: model config
 * and download, the engine Zotero.ML runs out of process, embed*(), and
 * scoreItemIDs() for the search path.
 *
 * Zotero.Embeddings.Indexing -- what gets embedded, and keeping the
 * itemEmbeddings table filled.
 */
Zotero.Embeddings = new function () {
	//
	// The models
	//
	// Everything about the active model -- which one it is, what it expects,
	// where its files come from -- is answered here.
	//

	// Every field is a fact read off the model's card or config, except
	// `calibration`, which can only be learned by running it: the mean its
	// embeddings share and the scores the Relevance bar is drawn against.
	// Those are measured with Calibration.record() and pasted in -- never
	// fitted by hand -- and a `revision` bump means measuring again.
	const MODEL = {
		name: 'bekko-embedding-v1-a25m',
		// Bump when a change alters the vectors -- dtype, upstream weights,
		// prefixes, pooling, the mean they're centered on -- so that stored
		// embeddings are detected as stale and reindexed
		revision: 1,
		// HF repo id, and the transformers.js pipeline id
		modelId: 'hotchpotch/bekko-embedding-v1-a25m',
		// Weights variant. The repo's default artifact is onnx/model.onnx
		// (fp32 layers, int8 embedding table); it has no model_quantized.onnx
		dtype: 'fp32',
		// How token vectors combine: 'cls' or 'mean'
		pooling: 'mean',
		// Prepended to every query and every passage before it's embedded
		queryPrefix: '',
		passagePrefix: '',
		// Context window; longer text is chunked to fit
		maxTokens: 8192,
		// Width of every stored vector, which rows from other clients are
		// checked against. A model trained to truncate (Matryoshka) has its
		// output cut to it; any other model's output must be this wide.
		dims: 256,
		// The tokenizer marks the first word with a space the runtime fails
		// to add, so we add it
		leadingSpace: true,
		// How the same model is served from llama.cpp
		serving: { gguf: 'hotchpotch/bekko-embedding-v1-a25m-GGUF', quant: 'F16' },
		calibration: {
			minScore: 0.34,
			maxDisplayScore: 0.54,
			mean: 'PqFavOYNOLx1IDi9qH2BvaxQ27zU/qW8nE/ePJtGxrwYwuy7SX+buykW8Lsjc5A7mABAvAlBG70BiY07Sa1avVx+mrt0/L+8NpaMvKjWir26UIa9lVP/vI7A+ry4KAa90fU/OwSdUTvTOJu8Z5oivXZ8RL274v68yHldvZqXhTxkAYA8aV5MvQ5LujprwUW7KTSEvfQLFb2rw1O93Yj+u1g2Tjwz98E6pGYOPFxXi72pUPu84J0HvZaF3bwbx+w705kvvW3/cj2W2SG8wBcZu5Q6G7xd0xm8uPhEvKBjm7zLtwK9Q57HPSPjg7xobXK8B0PavG+ylLxTEiC9uK+tPOMgH7zpzZW5CMXsu3quQTzOLym9q9nLvHaPl7r50JO81+kEvKzyNbvquoK8AfZ6u0KBLrtFooA7fp2QvEVedLxHDaW8llSFvFNiz7z8Nxk8NPnyvJOjMLk6J1m7CRHuvFNnmDuhqge8Fz+9vLbqCbxQ0qK7VlqfvI8J9LwVPVu8AWwJvcc0xby6HbW8GHUuvIhAO73H7/a8l9OjvFUoH7zHnNO8rKcnPBakq7z5vZu8kwsMvYaV3zzrHYS8VTyLPFRX5byS6La8tKLGO/Y1wboh6qC8oxdCvDuaGTxuSuk7MYzYvLonNjsrLWO7sioCvfs4ALxFNzS9/tWPvFTs1zvRHU86vy0gurIR4rwu/1U8qMacvMyg2Lyc6pq8tuPxu9WfCTxS6Z28svKjvB9Esju0aGW83viTO6QqmDve/rM8m2IeO/bW6bylzB28vpG6vPpTzLtNRpG8qwCdvBJMObxTsBi6MOj9Ork9EL0cDis9bQIcvdMt4bzyTrK8rEzBvFfh2jzxYOS81FIEvO6TgLwNGBi9z3Xquh2GkrzNpIm7biGDu1iVsrxjvJy8zS1dPDlBCbyqYBa9piRivGh/hLyfszM8ydtpPErN+LzMNeW8yCogvO/noLt625E7GngBvRUK+LzAQt27fKM3vMqcDbxW9py8P/AMvYPW4Lsp8Rg8gPJKvMNQWDyJVxW5yWCBvBpeD73XJRS8R8sYvJFa1rsD97Q5WU0tvPTvBj20Z1a805+duyWUxLynXlG6eP2ZO3kYxLzlJTm9vcItvPGWtrxwqlu8+spCvDE+mbnuYua8K6C0vCh/hLyUGkY7B4GOvK6KALwij2E84fvFvCax57yPjgw9FXjxvL2aKrw6JM07qxSsO8NZwLxmn7i89tPWvGlCxLyNzD+7ooAkvfpjTTsX4Zy8wMwjvZDi0bzwK+U7kc1svMFOsDuewtq7Z/7dO83wlLypIKi8sTUPvEUMb7v7eUi9WkVUvBgojDom5Qu9HJchPH1EDbzUevu8rUZEvQ=='
		}
	};

	const TASK_NAME = 'feature-extraction';
	// Identifies our engine to the inference runtime, and the model files it
	// caches for us
	const ENGINE_ID = 'zotero-embeddings';

	const MODEL_HUB_ROOT_URL = 'https://huggingface.co';
	const MODEL_HUB_URL_TEMPLATE = '{model}/resolve/{revision}';

	/**
	 * Name of the model, for logging and for the identity stored with the
	 * vectors.
	 * @return {String}
	 */
	this.getModelName = function () {
		return MODEL.name;
	};

	/**
	 * Whether semantic search is enabled. While it's off nothing is indexed
	 * and best-match search ranks lexically; what's already stored is left
	 * alone, so turning it back on resumes rather than rebuilds.
	 * @return {Boolean}
	 */
	this.isEnabled = function () {
		return !!Zotero.Prefs.get('search.bestMatch.enableSemantic');
	};

	/**
	 * Identity of the active embedding function: model name and revision.
	 * @return {String}
	 */
	this.getModelVersion = function () {
		return `${MODEL.name}/${MODEL.revision}`;
	};

	/**
	 * Width of every stored vector
	 * @return {Number}
	 */
	this.getDimensions = function () {
		return MODEL.dims;
	};

	/**
	 * The string embedQuery() prepends to every query.
	 *
	 * @return {String}
	 */
	this.getQueryPrefix = function () {
		return MODEL.queryPrefix;
	};

	/**
	 * The string embedPassages() prepends to every passage.
	 *
	 * @return {String}
	 */
	this.getPassagePrefix = function () {
		return MODEL.passagePrefix;
	};

	/**
	 * How the model combines token vectors: 'cls' or 'mean'.
	 * @return {String}
	 */
	this.getPooling = function () {
		return MODEL.pooling;
	};

	/**
	 * How the model can be served from llama.cpp
	 * @return {Object} - { gguf, quant }
	 */
	this.getServing = function () {
		return MODEL.serving;
	};

	/**
	 * Read one of the model's files (e.g. its tokenizer) from the runtime's
	 * model cache, fetching it from the model hub if the runtime doesn't have
	 * it yet.
	 *
	 * @param {String} file - File path within the model repository
	 * @return {Promise<ArrayBuffer>}
	 */
	this.getModelFile = function (file) {
		return Zotero.ML.getModelFile({
			engineId: ENGINE_ID,
			taskName: TASK_NAME,
			modelId: MODEL.modelId,
			file
		});
	};

	//
	// Embeddings database
	//
	// Stored vectors live in their own attached database (embeddings.sqlite),
	// like the full-text index: local, rebuildable and model-specific, so
	// they stay out of zotero.sqlite and its backups and are versioned on
	// their own PRAGMA user_version.
	//

	// Schema version of the attached embeddings database. The tables are only
	// created when this is bumped (_setUpDB() drops and recreates everything),
	// so any schema change needs a bump.
	const _dbVersion = 14;

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
		// A corrupt file is dropped and recreated (it's derived, so indexing
		// repopulates it). The corruption handler drives this, since a
		// malformed page can surface from any query; DBConnection confirms the
		// main database is intact first, so an index failure never triggers
		// main-database recovery.
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
		// Scoring uses sqlite-vec's vector functions: mozStorage hands a
		// vector to JS one number per byte, far too slow for a whole library
		await Zotero.DB.loadExtension('vec');
		// Idempotent, since it can run again for a retried initialization or
		// after a connection reopen
		let attached = (await Zotero.DB.queryAsync("PRAGMA database_list"))
			.some(row => row.name == 'embeddings');
		if (!attached) {
			let path = Zotero.DataDirectory.getDatabase('embeddings');
			await Zotero.DB.queryAsync("ATTACH DATABASE ? AS embeddings", [path]);
		}
		// itemIDs are reassigned when zotero.sqlite is recreated, so vectors
		// stamped with a different localUserKey belong to other items
		let localUserKey = Zotero.Users.getLocalUserKey();
		let version = await Zotero.DB.valueQueryAsync("PRAGMA embeddings.user_version");
		let storedUserKey = version >= _dbVersion
			? await Zotero.DB.valueQueryAsync(
				"SELECT value FROM embeddings.embeddingsMeta WHERE key='localUserKey'")
			: false;
		if (version >= _dbVersion && storedUserKey == localUserKey) {
			return;
		}
		for (let table of ['itemEmbeddings', 'embeddingsMeta', 'itemIndexState']) {
			await Zotero.DB.queryAsync(`DROP TABLE IF EXISTS embeddings.${table}`);
		}
		Zotero.Embeddings.Endpoint.reset();
		// One row per chunk of an item's text: its vector, centered and
		// quantized to int8 (null while still to embed), and for structured
		// text its anchor in the file, as Indexing.compactAnchor() writes it.
		// No foreign key; the notifier and eligibility pruning handle
		// deletions.
		await Zotero.DB.queryAsync(
			"CREATE TABLE embeddings.itemEmbeddings (\n"
			+ "    itemID INTEGER NOT NULL,\n"
			+ "    chunkIndex INTEGER NOT NULL,\n"
			+ "    embedding BLOB,\n"
			+ "    anchor BLOB,\n"
			+ "    PRIMARY KEY (itemID, chunkIndex)\n"
			+ ")"
		);
		// Chunks still to embed are the few, so what's left is answered from
		// this index alone
		await Zotero.DB.queryAsync(
			"CREATE INDEX embeddings.itemEmbeddings_pending "
			+ "ON itemEmbeddings (itemID) WHERE embedding IS NULL"
		);
		// The localUserKey the vectors were built against and the model that
		// produced them
		await Zotero.DB.queryAsync(
			"CREATE TABLE embeddings.embeddingsMeta (\n"
			+ "    key TEXT PRIMARY KEY,\n"
			+ "    value NOT NULL\n"
			+ ")"
		);
		// One row per item the index knows about: what its rows were made
		// from -- the content's hash and, for an attachment with a file here,
		// the file's key and the extractor that cut it -- the stamp it was
		// last seen at, and its standing with the server: the version its
		// rows are from, a refusal, a mark to fetch them again
		await Zotero.DB.queryAsync(
			"CREATE TABLE embeddings.itemIndexState (\n"
			+ "    itemID INTEGER PRIMARY KEY,\n"
			+ "    sourceKey TEXT,\n"
			+ "    contentHash TEXT,\n"
			+ "    extractor TEXT,\n"
			+ "    clientDateModified TEXT,\n"
			+ "    syncVersion INTEGER,\n"
			+ "    syncDeclined INTEGER,\n"
			+ "    syncShouldRefresh INTEGER NOT NULL DEFAULT 0\n"
			+ ")"
		);
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.embeddingsMeta (key, value) VALUES ('localUserKey', ?)",
			[localUserKey]
		);
		await Zotero.DB.queryAsync("PRAGMA embeddings.user_version = " + _dbVersion);
	}

	async function _rebuildDB() {
		if (_rebuildingDB) {
			return;
		}
		_rebuildingDB = true;
		try {
			Zotero.debug("Rebuilding corrupt embeddings database", 1);
			let path = Zotero.DataDirectory.getDatabase('embeddings');
			// Detach before touching the file. If that fails (e.g., during a
			// transaction), stop rather than delete an attached database; a
			// later corruption error or the next startup retries. There's
			// nothing to detach when the attach itself failed.
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
			// Indexing rebuilds what was dropped
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
	 * Vacuum the embeddings database. Revision bumps and pruning delete whole
	 * swaths of vectors, and the main-database vacuum doesn't cover this one.
	 * Gated on the freelist threshold, which is self-throttling: a vacuum
	 * empties the freelist, so it won't run again until content drops again.
	 *
	 * @param {Object} [options]
	 * @param {Boolean} [options.force] - Skip the freelist and disk-space checks
	 * @return {Promise<Boolean>} - Whether the database was vacuumed
	 */
	this.vacuumDB = async function ({ force = false } = {}) {
		if (Zotero.DB.inTransaction()) {
			await Zotero.DB.waitForTransaction();
		}
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

	/**
	 * Whether the model, and the static model that comes with it, have been
	 * fully downloaded and are ready to use.
	 *
	 * @return {Promise<Boolean>}
	 */
	this.isDownloaded = async function () {
		return (await _isModelDownloaded()) && this.Static.isDownloaded();
	};

	async function _isModelDownloaded() {
		let cached = await Zotero.ML.listModels({ taskName: TASK_NAME });
		return cached.some(model => model.modelId === MODEL.modelId);
	}


	/**
	 * Make the model available to the inference runtime, downloading it if the
	 * runtime doesn't have it cached, and the static model after it.
	 * Interrupted downloads resume, so this can be called again after a
	 * failure. The static model only chooses which line of a passage to
	 * quote, so failing to fetch it is logged rather than thrown.
	 *
	 * @param {Function} [onProgress] - Called with the runtime's download
	 *     progress
	 * @return {Promise}
	 */
	this.download = async function (onProgress) {
		if (await this.isDownloaded()) {
			Zotero.debug(`Embeddings: model '${MODEL.name}' already downloaded`);
			return;
		}
		if (!await _isModelDownloaded()) {
			Zotero.debug(`Embeddings: downloading model '${MODEL.name}'`);
			// Creating the engine downloads whatever the runtime is missing
			await _getEngine(onProgress);
			Zotero.debug(`Embeddings: model '${MODEL.name}' downloaded`);
		}
		try {
			await this.Static.download(onProgress);
		}
		catch (e) {
			Zotero.logError(e);
		}
	};


	//
	// Embedding generation, in Firefox's inference process via Zotero.ML. The
	// runtime downloads the model files and caches them in the profile
	// directory, so they aren't part of the data directory or its backups.
	//

	let _engine = null;
	let _engineReady = null;
	// Thread count the current engine was created with
	let _engineNumThreads = null;
	// Reasons the engine may run at full thread count right now. Sources
	// ('prefs-open', 'user-idle') add and remove themselves independently.
	let _threadBoosts = new Set();

	/**
	 * Thrown when the stored embeddings can't be searched for the active
	 * model, while the index is being rebuilt after a revision bump. Callers
	 * should treat the index as still being prepared rather than scoring
	 * mismatched data.
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


	function _isEngineUsable(engine) {
		return !['closed', 'crashed', 'error'].includes(engine.engineStatus);
	}

	// Create the inference engine if needed. The engine reads the model files
	// from the model directory, so the model must already be downloaded.
	async function _getEngine(onProgress) {
		// The runtime destroys an engine left idle past its timeout, releasing
		// the model's memory, and expects the next run to create a new engine
		// -- a retained wrapper isn't revived, its run() only throws
		if (_engine && !_isEngineUsable(_engine)) {
			await Zotero.Embeddings.shutdownEngine();
		}
		if (!_engineReady) {
			_engineReady = (async () => {
				let numThreads = Zotero.Embeddings.getEngineThreads();
				Zotero.debug(`Embeddings: creating engine for '${MODEL.modelId}' `
					+ `(dtype ${MODEL.dtype}, pooling ${MODEL.pooling}, `
					+ `${numThreads} threads)`);
				_engine = await Zotero.ML.createEngine({
					engineId: ENGINE_ID,
					taskName: TASK_NAME,
					backend: 'onnx-native',
					modelId: MODEL.modelId,
					modelRevision: 'main',
					modelHubRootUrl: MODEL_HUB_ROOT_URL,
					modelHubUrlTemplate: MODEL_HUB_URL_TEMPLATE,
					dtype: MODEL.dtype,
					numThreads
				}, onProgress);
				_engineNumThreads = numThreads;
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
	this.shutdownEngine = async function () {
		let engine = _engine;
		_engine = null;
		_engineReady = null;
		_engineNumThreads = null;
		if (engine) {
			await engine.terminate();
			await Zotero.ML.shutdown();
		}
	};

	/**
	 * Add or remove a reason to run the engine at full thread count. Applied
	 * at the next engine creation; an indexing run restarts its engine
	 * between batches once the count has changed.
	 *
	 * @param {String} reason
	 * @param {Boolean} enabled
	 */
	this.setThreadBoost = function (reason, enabled) {
		let before = !!_threadBoosts.size;
		if (enabled) {
			_threadBoosts.add(reason);
		}
		else {
			_threadBoosts.delete(reason);
		}
		if (before !== !!_threadBoosts.size) {
			Zotero.debug('Embeddings: engine threads '
				+ (enabled ? `boosted (${[..._threadBoosts].join(', ')})` : 'restored'));
		}
	};

	/**
	 * The reasons the engine currently runs at full thread count
	 *
	 * @return {String[]}
	 */
	this.getThreadBoosts = function () {
		return [..._threadBoosts];
	};

	/**
	 * Thread count for the inference engine: the runtime's optimum while
	 * boosted -- the user is watching indexing progress or is away -- and
	 * half of it otherwise, trading wall time for heat during a long
	 * background index
	 *
	 * @return {Number}
	 */
	this.getEngineThreads = function () {
		let optimal = Zotero.ML.getOptimalConcurrency();
		return _threadBoosts.size ? optimal : Math.max(1, Math.floor(optimal / 2));
	};

	/**
	 * Whether the live engine was created with a different thread count than
	 * getEngineThreads() gives now
	 *
	 * @return {Boolean}
	 */
	this.engineThreadsStale = function () {
		return !!_engine && _engineNumThreads !== this.getEngineThreads();
	};

	//
	// Vector math
	//
	// Public, so that scoring and calibration share one copy: calibration has
	// to measure exactly what scoring computes, and two implementations that
	// centered or quantized differently would calibrate against a quantity
	// nothing else produces.
	//

	/**
	 * Subtract a mean vector and scale back to unit length.
	 *
	 * Every embedding shares a large common direction that says nothing about
	 * the text, leaving unrelated items moderately similar to everything.
	 * Removing it spreads the scores out, so no relevance reads as no score
	 * rather than as a middling one.
	 *
	 * @param {Float32Array} vector
	 * @param {Float32Array} mean
	 * @return {Float32Array}
	 */
	this.center = function (vector, mean) {
		let out = new Float32Array(vector.length);
		for (let i = 0; i < vector.length; i++) {
			out[i] = vector[i] - mean[i];
		}
		return _normalize(out);
	};

	/**
	 * Round a vector to 8 bits per dimension, scaled so its largest component
	 * fills the int8 range. Cosine divides the scale out, so nothing else is
	 * kept: the integers compare as the scaled floats would.
	 *
	 * @param {Float32Array} vector
	 * @return {Int8Array}
	 */
	this.quantize = function (vector) {
		let max = 0;
		for (let val of vector) {
			max = Math.max(max, Math.abs(val));
		}
		let out = new Int8Array(vector.length);
		if (max) {
			let scale = 127 / max;
			for (let i = 0; i < vector.length; i++) {
				out[i] = Math.round(vector[i] * scale);
			}
		}
		return out;
	};

	/**
	 * Cosine similarity of two vectors of any numeric type, or 0 if either
	 * has no length
	 *
	 * @param {Float32Array|Int8Array} a
	 * @param {Float32Array|Int8Array} b
	 * @return {Number}
	 */
	this.cosine = function (a, b) {
		let dot = 0;
		let aa = 0;
		let bb = 0;
		for (let i = 0; i < a.length; i++) {
			dot += a[i] * b[i];
			aa += a[i] * a[i];
			bb += b[i] * b[i];
		}
		return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
	};

	/**
	 * Center a raw embedding on the active model's mean and quantize it: the
	 * form every vector is stored and compared in.
	 *
	 * @param {Float32Array} vector
	 * @return {Int8Array}
	 */
	this.prepare = function (vector) {
		let mean = this.getCalibration().mean;
		// A mean of a different width than the vector is no mean to center on
		if (mean.length === vector.length) {
			vector = this.center(vector, mean);
		}
		return this.quantize(vector);
	};

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

	//
	// Model calibration
	//
	// Three numbers govern scoring, none of them on a model card: the mean
	// its embeddings share, the score below which nothing is a match, and
	// the score at which the Relevance bar fills. Measured once with
	// Zotero.Embeddings.Calibration and recorded in MODEL.calibration.
	//

	// Decoded on first use
	let _calibration = null;

	/**
	 * The model's calibration, with its mean decoded.
	 *
	 * @return {Object} - { mean: Float32Array, minScore, maxDisplayScore }
	 */
	this.getCalibration = function () {
		if (!_calibration) {
			let recorded = MODEL.calibration;
			if (!recorded) {
				throw new Error(`Model '${MODEL.name}' has no calibration -- record one with `
					+ 'Zotero.Embeddings.Calibration.record()');
			}
			let bytes = Uint8Array.from(atob(recorded.mean), c => c.charCodeAt(0));
			_calibration = {
				mean: new Float32Array(bytes.buffer),
				minScore: recorded.minScore,
				maxDisplayScore: recorded.maxDisplayScore
			};
		}
		return _calibration;
	};


	/**
	 * Embed an arbitrary string, returning the model's vector. Task prefixes
	 * ("query: ", "passage: ") are NOT added here -- add them at the call site
	 * if the model expects them.
	 *
	 * @param {String} text
	 * @return {Promise<Float32Array>}
	 */
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
		texts = texts.map(this.normalizeInput);
		// The model's Metaspace tokenizer marks the first word with a space,
		// which the runtime's tokenizer (transformers.js 3.5.1) adds only with
		// the legacy add_prefix_space flag current tokenizer.json files omit.
		// Without it the vectors drift (cosine 0.83-0.95 for titles and
		// queries, 0.99+ for chunks).
		if (MODEL.leadingSpace) {
			texts = texts.map(text => ' ' + text);
		}
		let engine;
		let run = async () => {
			engine = await _getEngine();
			Zotero.debug(`Embeddings: embedding batch of ${texts.length}`);
			// The runtime spreads `args` into the pipeline call, so the batch
			// of texts is a single argument
			return engine.run({
				args: [texts],
				options: { pooling: MODEL.pooling }
			});
		};
		let vectors;
		try {
			vectors = await run();
		}
		catch (e) {
			// The engine's idle timer is the runtime's own, so it can destroy
			// the engine between _getEngine()'s liveness check and the run.
			// One fresh engine gets one more try; a failure from a live
			// engine, or from the replacement, propagates.
			if (!engine || _isEngineUsable(engine)) {
				throw e;
			}
			Zotero.debug("Embeddings: engine died mid-call -- replacing it");
			await Zotero.Embeddings.shutdownEngine();
			vectors = await run();
		}
		Zotero.debug(`Embeddings: batch of ${texts.length} done`);
		return vectors.map(vector => this.finishVector(new Float32Array(vector)));
	};

	/**
	 * Text as every embedding path sees it, local or served: runs of
	 * whitespace, newlines included, become one space. Line breaks and
	 * double spaces in extracted text are layout, not language -- and the
	 * runtime's tokenizer reads them differently from the reference
	 * implementation, which moved vectors by up to 0.1 in cosine.
	 *
	 * @param {String} text
	 * @return {String}
	 */
	this.normalizeInput = function (text) {
		return text.replace(/\s+/g, ' ').trim();
	};

	/**
	 * A model's raw output into its embedding: cut to its `dims` if it
	 * truncates, and unit length, since the mean it's centered on was
	 * measured over unit vectors
	 *
	 * @param {Float32Array} vector
	 * @return {Float32Array}
	 */
	this.finishVector = function (vector) {
		let dims = this.getDimensions();
		if (vector.length > dims) {
			vector = vector.slice(0, dims);
		}
		return _normalize(vector);
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
		let promise = this.embed(MODEL.queryPrefix + text);
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
	 * Passages route to an endpoint verified to serve the same model, when
	 * there is one; queries always embed locally. A batch the endpoint
	 * fails embeds locally rather than waiting on a retry.
	 *
	 * @param {String[]} texts
	 * @return {Promise<Float32Array[]>}
	 */
	this.embedPassages = async function (texts) {
		let passagePrefix = MODEL.passagePrefix;
		texts = texts.map(text => passagePrefix + text);
		let endpoint = await this.Endpoint.getActive();
		if (!endpoint) {
			return this.embedMany(texts);
		}
		let vectors = await this.Endpoint.embed(endpoint, texts);
		return vectors || _embedInParts(texts);
	};

	// A batch cut for a remote server can be several times what the local
	// engine's memory allows, so it embeds locally in parts. Even quarters
	// are near enough for a fallback.
	async function _embedInParts(texts) {
		const PARTS = 4;
		let size = Math.ceil(texts.length / PARTS);
		let vectors = [];
		for (let i = 0; i < texts.length; i += size) {
			vectors.push(...await Zotero.Embeddings.embedMany(texts.slice(i, i + size)));
		}
		return vectors;
	}


	/**
	 * Map a raw similarity score onto the model's display band, for the
	 * Relevance bar: empty at or below the floor, full at or above the
	 * ceiling. Unclamped, scores past the ceiling stay apart, for ordering by
	 * the fraction -- a strong query's whole top tier can sit past it.
	 *
	 * @param {Number} score
	 * @param {Object} [options]
	 * @param {Boolean} [options.clamped=true] - Cap the fraction at 1
	 * @return {Number} - 0-1, or above 1 unclamped
	 */
	this.getScoreFraction = function (score, { clamped = true } = {}) {
		let { minScore, maxDisplayScore } = this.getCalibration();
		let fraction = (score - minScore) / (maxDisplayScore - minScore);
		return clamped ? Math.min(1, Math.max(0, fraction)) : Math.max(0, fraction);
	};

	/**
	 * The item fields whose text is embedded, and so the fields a query can
	 * match literally.
	 *
	 * @return {Number[]}
	 */
	this.getIndexedFieldIDs = function () {
		return [...new Set([
			Zotero.ItemFields.getID('title'),
			Zotero.ItemFields.getID('abstractNote'),
			...Zotero.ItemFields.getTypeFieldsFromBase('title')
		])];
	};


	// The cosine between a stored vector and the query, as cosine() computes
	// it in JS. The query binds as JSON text for vec_int8() rather than as a
	// BLOB, since mozStorage reads an object bound first as named parameters.
	//
	// @return {Object} - { sql, params }: the expression, and the value it
	//     binds ahead of the caller's own
	function _scoreExpression(query) {
		return {
			sql: '1 - vec_distance_cosine(vec_int8(embedding), vec_int8(?))',
			params: [JSON.stringify(Array.from(query))]
		};
	}

	// The shared guard of the scoring paths: confirm the stored vectors were
	// produced by the active model. During a reindex after a revision bump
	// the database isn't stamped for the new revision until the indexer
	// starts filling it. Returns the calibration for the scoring that follows.
	async function _requireReadyIndex() {
		await Zotero.Embeddings.initDB();
		let modelVersion = Zotero.Embeddings.getModelVersion();
		let indexedVersion = await Zotero.Embeddings.Indexing.Store.getIndexedModelVersion();
		if (indexedVersion !== modelVersion) {
			throw new Zotero.Embeddings.IndexNotReadyError(
				`Embeddings index is for '${indexedVersion || 'no model'}', `
					+ `but the active model is '${modelVersion}'`
			);
		}
		return Zotero.Embeddings.getCalibration();
	}

	/**
	 * Score a set of items by similarity to a query, within that scope
	 * rather than the whole library. Items below the model's floor, or with
	 * no stored embedding, aren't returned.
	 *
	 * @param {String} queryText
	 * @param {Number[]} itemIDs - Candidate item IDs to score
	 * @param {Object} [options]
	 * @param {Function} [options.shouldCancel] - Checked between chunks;
	 *     return true to abandon scoring with a ScoringCancelledError
	 * @return {Promise<Object>} - { scores, previewableIDs }: itemID ->
	 *     similarity score, and the scored items with an above-floor chunk
	 *     whose text can be re-derived for a preview
	 */
	this.scoreItemIDs = async function (queryText, itemIDs, { shouldCancel } = {}) {
		let scores = new Map();
		let previewableIDs = new Set();
		if (!itemIDs.length || !this.isEnabled()) {
			return { scores, previewableIDs };
		}
		let calibration = await _requireReadyIndex();
		let query = this.prepare(await this.embedQuery(queryText));
		let scoring = _scoreExpression(query);
		let minScore = calibration.minScore;

		// Score the candidates in chunks, under SQLite's bound-parameter
		// limit. SQLite reduces each item to the two numbers below, so
		// ranking a library hands JS a row per item rather than a vector per
		// chunk. An item scores as its best chunk, not an average, so a long
		// note that answers the query in one paragraph isn't diluted.
		let chunkSize = 500;
		for (let i = 0; i < itemIDs.length; i += chunkSize) {
			if (shouldCancel && shouldCancel()) {
				throw new this.ScoringCancelledError();
			}
			let chunk = itemIDs.slice(i, i + chunkSize);
			// A chunk is previewable when there's something to re-derive its
			// text from: its anchor in the document, or the attachment's
			// plain text it was cut from. A chunk that no longer reads back
			// -- an anchor that doesn't resolve, text since regenerated --
			// derives as nothing and is dropped when the preview is derived.
			let rows = await Zotero.DB.queryAsync(
				"SELECT itemID, MAX(score) AS score, "
					+ "MAX(CASE WHEN previewable THEN score END) AS previewableScore FROM ("
					+ "SELECT itemID, "
					+ "(anchor IS NOT NULL OR itemID IN (SELECT itemID FROM itemAttachments)) AS previewable, "
					+ scoring.sql + " AS score "
					+ "FROM embeddings.itemEmbeddings "
					+ "WHERE embedding IS NOT NULL AND itemID IN (" + chunk.map(() => '?').join(',') + ")"
					+ ") GROUP BY itemID",
				[...scoring.params, ...chunk]
			);
			for (let row of rows) {
				// A null score is a stored vector with no length: no match
				if (!(row.score >= minScore)) {
					continue;
				}
				scores.set(row.itemID, row.score);
				// An above-floor chunk whose text can be re-derived makes its
				// item's match showable; that chunk also puts the item's best
				// at or above the floor, so the set stays within the returned
				// items
				if (row.previewableScore !== null && row.previewableScore >= minScore) {
					previewableIDs.add(row.itemID);
				}
			}
		}
		return { scores, previewableIDs };
	};

	/**
	 * The chunks of an item most similar to a query, above the model's
	 * floor, each with where in the item it came from. No chunk text is
	 * stored, so it's re-derived from the chunk's anchor or the plain text it
	 * was cut from; a chunk that no longer reads back comes with null text and
	 * location. For other item types those fields are null. A chunk in a
	 * section headed as a reference list is left out.
	 *
	 * @param {String} queryText
	 * @param {Number} itemID
	 * @param {Object} [options]
	 * @param {Number} [options.limit=3] - Most chunks to return; Infinity
	 *     for every chunk above the floor
	 * @return {Promise<Object[]>} - [{ chunkIndex, score, text, outlinePath,
	 *     pageLabel, position }], best first, then in document order
	 */
	this.getMatchingChunks = async function (queryText, itemID, { limit = 3 } = {}) {
		if (!this.isEnabled()) {
			return [];
		}
		let calibration = await _requireReadyIndex();
		let query = this.prepare(await this.embedQuery(queryText));
		let scoring = _scoreExpression(query);
		// Where each chunk sits, and its score; the vector itself stays in SQL
		let scored = await Zotero.DB.queryAsync(
			"SELECT * FROM ("
				+ "SELECT chunkIndex, anchor, " + scoring.sql + " AS score "
				+ "FROM embeddings.itemEmbeddings WHERE itemID=? AND embedding IS NOT NULL"
				+ ") WHERE score >= ? ORDER BY score DESC, chunkIndex",
			[...scoring.params, itemID, calibration.minScore]
		);
		// A chunk's heading is only known once it's read back, so chunks are
		// read in batches until enough outside reference lists are found
		let chunks = [];
		let batchSize = Math.max(1, Number.isFinite(limit) ? limit : scored.length);
		for (let i = 0; i < scored.length && chunks.length < limit; i += batchSize) {
			let batch = scored.slice(i, i + batchSize);
			let sources = await _loadChunkSources(itemID, batch);
			for (let j = 0; j < batch.length; j++) {
				// In a reference list when any heading over it names one
				let headings = sources[j].outlinePath?.split(' > ') || [];
				if (!headings.some(heading => Zotero.Utilities.Internal.isLikelyReference(heading))) {
					chunks.push(Object.assign(_describeChunk(batch[j], sources[j]), { score: batch[j].score }));
				}
			}
		}
		return chunks.slice(0, limit);
	};

	// One chunk as callers see it: its place in the item's order, with the
	// text and location re-derived from its source
	function _describeChunk(row, source) {
		return {
			chunkIndex: row.chunkIndex,
			text: source.text,
			outlinePath: source.outlinePath,
			pageLabel: source.pageLabel,
			position: source.position
		};
	}

	// Re-derive the text and location of the given chunk rows: a chunk with
	// a stored anchor by reading it back from the document, a chunk without
	// by cutting the attachment's plain text again
	//
	// @return {Promise<Object[]>} - One { text, outlinePath, pageLabel,
	//     position } per row, in order; `position` is the one the reader
	//     navigates to, the first of the chunk's
	async function _loadChunkSources(itemID, rows) {
		let sources = rows.map(() => ({
			text: null,
			outlinePath: null,
			pageLabel: null,
			position: null
		}));
		let structured = [];
		let plain = [];
		for (let i = 0; i < rows.length; i++) {
			let anchor = rows[i].anchor ? Zotero.Embeddings.Indexing.expandAnchor(rows[i].anchor) : null;
			let entry = { index: i, chunkIndex: rows[i].chunkIndex, anchor };
			(anchor ? structured : plain).push(entry);
		}
		if (structured.length) {
			await _loadStructuredChunkSources(itemID, structured, sources);
		}
		if (plain.length) {
			await _loadPlainChunkSources(itemID, plain, sources);
		}
		return sources;
	}

	// The plain-text case of _loadChunkSources(): rows made from the
	// attachment's text, as the item's recorded content hash says, were
	// cut from that text, and the same cut finds each chunk at its index.
	// Rows without an anchor made from anything else have no text to show.
	async function _loadPlainChunkSources(itemID, entries, sources) {
		let text;
		try {
			let item = await Zotero.Items.getAsync(itemID, { noCache: true });
			text = item && item.isAttachment() ? await item.attachmentText : null;
		}
		catch (e) {
			Zotero.logError(e);
			return;
		}
		if (!text) {
			return;
		}
		let records = await Zotero.Embeddings.Indexing.Store.getIndexStates([itemID]);
		if (records.get(itemID)?.contentHash !== Zotero.Utilities.Internal.md5(text)) {
			return;
		}
		let chunks = Zotero.SDT.getPlainTextChunks(text);
		for (let { index, chunkIndex } of entries) {
			sources[index].text = chunks[chunkIndex]?.text || null;
		}
	}

	// The structured-text case of _loadChunkSources(): the chunks' anchors
	// read back from the pack, each with the reader positions of its text
	async function _loadStructuredChunkSources(itemID, entries, sources) {
		// isPriority: re-deriving a preview is user-initiated, and can
		// involve extraction when the cached pack is gone
		let result = await Zotero.SDT.readAnchors(
			itemID,
			entries.map(entry => entry.anchor),
			{ isPriority: true }
		);
		if (!result.ok) {
			return;
		}
		for (let i = 0; i < entries.length; i++) {
			let found = result.chunks[i];
			if (found) {
				Object.assign(sources[entries[i].index], {
					text: found.text,
					outlinePath: found.outlinePath || null,
					pageLabel: found.pageLabel,
					position: found.position || null
				});
			}
		}
	}
};


/**
 * Background indexing for semantic search: one run at a time indexes the
 * items saved since the index last looked at them, then takes every
 * eligible attachment through the pipeline. Starts and stops with the
 * search.bestMatch.enableSemantic preference. What a run is built on --
 * Sources, Progress, Store and Runtime -- is declared below it.
 */
Zotero.Embeddings.Indexing = new function () {
	//
	// State
	//

	// The run
	let _initialized = false;
	let _indexing = false;
	let _indexingPromise = null;
	let _stopping = false;
	let _lastError = null;

	// A kick that landed while a run is going: the attachment work gives way
	// to the items, and the run goes again before it's over
	let _kicked = false;
	let _kickTimer = null;
	// While the server can't be reached: when the run goes back to it and
	// what went wrong, and the timer that takes it there
	let _serverUnreachable = null;
	let _serverRetryTimer = null;
	// Attachments whose pack a run of this session has made sure of, so
	// that later runs don't check for it again
	let _packed = new Set();

	// Pacing
	//
	// Wait longer than the usual debounce before retrying a run that was held
	// off for memory
	const LOW_MEMORY_RETRY_DELAY = 5 * 60 * 1000;
	// How long a run waits before asking the server again after a request
	// failed. No attachment is cut or embedded in the meantime.
	this.SERVER_RETRY_DELAY = 5 * 60 * 1000;
	// Attachments a step takes at a time: the sync request size, and the
	// most ever held in memory at once
	this.ATTACHMENT_PAGE_SIZE = 50;
	// Debounce before starting the consumer, so a burst of changes (e.g. an
	// import) is picked up in one pass
	const KICK_DELAY = 3000;
	// Items embedded per pass. A pass holds the text of every chunk in the
	// slice and sorts them by length, so this bounds both memory and how
	// long the first item waits behind the rest.
	const ITEM_SLICE_SIZE = 32;
	// Attachment chunks pooled before they're sorted and embedded. Counted in
	// chunks rather than attachments, which run from a handful apiece to
	// thousands.
	const EMBED_POOL_SIZE = 500;
	// How long a pool may spend filling before it's embedded anyway. Filling
	// reads and cuts a document per attachment, seconds apiece on a cold
	// cache, and nothing is stored or reported until the first drain.
	const EMBED_POOL_FILL_MAX = 3000;
	// The oldest chunker whose cut is still kept. Rows cut here by an older
	// one are dropped at reconcile and the attachment is indexed anew, so a
	// chunker change that matters is forced through by raising this to the
	// new version; one that doesn't leaves it be, and existing rows stand.
	const MIN_CHUNKER_VERSION = 1;
	// Most texts per engine call, whatever the token budget allows
	const MAX_BATCH_TEXTS = 20;


	//
	// Lifecycle
	//
	// The public surface, and what starts, stops and resets a run.
	//

	/**
	 * Wire up the background indexer. Guarded so multiple windows don't
	 * double-initialize.
	 */
	this.init = function () {
		if (_initialized) {
			return;
		}
		_initialized = true;

		// Turning semantic search on indexes what's missing; turning it off
		// stops the indexer and leaves everything stored where it is, so
		// turning it back on resumes rather than rebuilds.
		Zotero.Prefs.registerObserver('search.bestMatch.enableSemantic', () => {
			if (Zotero.Embeddings.isEnabled()) {
				Zotero.Embeddings.Indexing.startIndexing();
			}
			else {
				Zotero.Embeddings.Indexing.stopIndexing();
			}
		});

		Zotero.Notifier.registerObserver({
			notify: async (event, type, ids) => {
				if (!Zotero.Embeddings.isEnabled()) {
					return;
				}
				// Attachments held off by a sync go once it's over
				if (type === 'sync') {
					if (event === 'finish' && !Zotero.Embeddings.Indexing.isPaused()) {
						_scheduleKick();
					}
					return;
				}
				if (type !== 'item') {
					return;
				}
				// No foreign key removes an item's stored embedding when the
				// item is deleted (references across attached databases aren't
				// possible), so drop it here -- even while indexing is paused,
				// since this is removal of stale data rather than indexing
				if (event === 'delete') {
					await Zotero.Embeddings.Indexing.Store.deleteItems(ids);
					return;
				}
				if (Zotero.Embeddings.Indexing.isPaused()) {
					return;
				}
				if (event === 'add' || event === 'modify') {
					_scheduleKick();
				}
			}
		}, ['item', 'sync'], 'embeddings');

		// Resume indexing if semantic search is on and indexing wasn't
		// explicitly stopped, after a short delay so we don't compete with
		// window setup.
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
	 * indexed at all -- item changes don't even kick a run -- until
	 * startIndexing() is called again. Persisted so a stop survives a restart.
	 * @return {Boolean}
	 */
	this.isPaused = function () {
		return !!Zotero.Prefs.get('embeddings.indexingPaused');
	};

	/**
	 * Start (or resume) indexing: clear a previous stopIndexing(), drop what's
	 * stored for items that are gone, and run the consumer, which indexes
	 * every item saved since it was last looked at and takes every attachment
	 * through the pipeline. Safe to call while the consumer is already
	 * running -- the run goes again once it's over.
	 *
	 * @return {Promise} - Resolves when the run is over or indexing was
	 *     stopped
	 */
	this.startIndexing = function () {
		if (!Zotero.Embeddings.isEnabled()) {
			return Promise.resolve();
		}
		Zotero.Prefs.set('embeddings.indexingPaused', false);
		// Asking the server again now, rather than when the retry was due
		_clearServerRetry();
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
			await _pruneOrphanedEmbeddings();
			// A full pass: every attachment's file is asked again, as at
			// the start of a session
			await Zotero.Embeddings.Indexing.Store.clearAttachmentStamps();
			return _startConsumer();
		})();
	};

	/**
	 * Stop indexing: leave the current batch to finish and go no further.
	 * Persisted, so nothing is indexed again until startIndexing().
	 */
	this.stopIndexing = function () {
		_stopping = true;
		_kicked = false;
		if (_kickTimer) {
			clearTimeout(_kickTimer);
			_kickTimer = null;
		}
		_clearServerRetry();
		Zotero.Prefs.set('embeddings.indexingPaused', true);
		Zotero.Embeddings.Indexing.Progress.emit();
	};

	/**
	 * Take in an attachment's complete set of chunk rows from elsewhere,
	 * replacing whatever is stored for it. Refused: fewer rows than `chunks`,
	 * another model, malformed rows, and rows made from anything but the
	 * file as it is here.
	 *
	 * @param {Number} itemID
	 * @param {Object} arrival
	 * @param {String} arrival.modelVersion
	 * @param {String} arrival.contentHash
	 * @param {Number} arrival.chunks
	 * @param {Object[]} arrival.rows - [{ chunkIndex, embedding, anchor }],
	 *     each embedding as Zotero.Embeddings.prepare() leaves it
	 * @param {Integer} [arrival.version] - The server's version the rows
	 *     are from, when they're the server's
	 * @return {Promise<Boolean>} - Whether they were taken
	 */
	this.addChunks = async function (itemID, { modelVersion, contentHash, chunks, rows, version = null }) {
		let { Store, Sources } = Zotero.Embeddings.Indexing;
		if (!Zotero.Embeddings.isEnabled()
				|| modelVersion !== Zotero.Embeddings.getModelVersion()
				|| !chunks || rows.length !== chunks) {
			return false;
		}
		if (!_areRowsWellFormed(rows, chunks)) {
			Zotero.debug(`Embeddings: malformed rows for item ${itemID} -- refused`);
			return false;
		}
		// Loaded rather than taken from the cache: rows arrive for whatever
		// the other client indexed, which this one may never have touched.
		// Not kept either, since nothing here is about to be shown.
		let item = await Zotero.Items.getAsync(itemID, { noCache: true });
		if (!item || !Sources.isIndexableAttachment(item)) {
			return false;
		}
		await Zotero.Embeddings.initDB();
		// Clears an index left by another model and records this one, so the
		// next run doesn't take these rows for stale along with it
		await _ensureIndexMatchesModel();
		// Rows for the file as it was before it changed here would sit
		// looking like the new file's index. Rows cut from the file's plain
		// text derive from that text instead.
		let sourceKey = await Sources.getAttachmentSourceKey(item);
		if (sourceKey
				&& contentHash !== await item.attachmentHash
				&& contentHash !== await Sources.getAttachmentTextHash(item)) {
			return false;
		}
		await Zotero.DB.executeTransaction(async function () {
			await Store.deleteRows(itemID);
			for (let row of rows) {
				await Store.insertRow(itemID, row.chunkIndex, row.embedding, row.anchor);
			}
			// Recorded under the file's key when there's a file; without one
			// the rows still score, and cutting the attachment adopts them
			// once it arrives
			await Store.setSource(itemID, { sourceKey, contentHash, syncVersion: version });
			await Store.clearSyncState(itemID);
		});
		return true;
	};

	// Whether rows from elsewhere can be stored and scored: each index one of
	// the cut's and given once, each vector a byte per dimension of the
	// model's width -- another width fails every query that scores it --
	// and each anchor an object or null
	function _areRowsWellFormed(rows, chunks) {
		let width = Zotero.Embeddings.getDimensions();
		let indexes = new Set();
		for (let { chunkIndex, embedding, anchor } of rows) {
			if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= chunks
					|| indexes.has(chunkIndex)) {
				return false;
			}
			indexes.add(chunkIndex);
			if (!ArrayBuffer.isView(embedding) || embedding.byteLength !== width) {
				return false;
			}
			if (anchor !== null && (typeof anchor != 'object' || Array.isArray(anchor))) {
				return false;
			}
		}
		return true;
	}

	// Make sure the stored vectors are the active model's, as recorded in the
	// meta table. On a mismatch -- a `revision` bump -- everything stored is
	// cleared, and indexing rebuilds it.
	async function _ensureIndexMatchesModel() {
		let current = Zotero.Embeddings.getModelVersion();
		let indexed = await Zotero.Embeddings.Indexing.Store.getIndexedModelVersion();
		if (indexed === current) {
			return;
		}
		if (indexed) {
			Zotero.debug(`Embeddings: stored embeddings are from '${indexed}' `
				+ `but the active model is '${current}' -- clearing for reindexing`);
			await Zotero.Embeddings.Indexing.Store.clear();
			Zotero.Embeddings.Indexing.Progress.clearCounts();
		}
		await Zotero.Embeddings.Indexing.Store.setIndexedModelVersion(current);
	}

	// Drop what's stored for items that are gone or in a library that's no
	// longer indexed. An item that lost its text is a saved item, which the
	// next run sees for itself.
	async function _pruneOrphanedEmbeddings() {
		let { Store, Sources } = Zotero.Embeddings.Indexing;
		await Zotero.Embeddings.initDB();
		let libraryIDs = new Set(Sources.getIndexableLibraries().map(library => library.libraryID));
		let orphaned = (await Store.getStoredItems())
			.filter(row => !libraryIDs.has(row.libraryID))
			.map(row => row.itemID);
		await Store.deleteItems(orphaned);
	}

	//
	// Kicks
	//

	// Start a run after a short delay, which gathers a burst of changes
	// into one. A run already going is told at once, so the attachment
	// work gives way without waiting out the delay.
	function _scheduleKick(delay = KICK_DELAY) {
		if (_indexing && !_stopping) {
			_kicked = true;
			return;
		}
		if (_kickTimer) {
			clearTimeout(_kickTimer);
		}
		_kickTimer = setTimeout(() => {
			_kickTimer = null;
			_startConsumer();
		}, delay);
	}


	// Come back to the server once it may be reachable again, by starting a
	// run as pressing Resume does
	function _scheduleServerRetry() {
		if (_serverRetryTimer || !_serverUnreachable) {
			return;
		}
		let delay = Math.max(0, _serverUnreachable.retryAt - Date.now());
		_serverRetryTimer = setTimeout(() => {
			_serverRetryTimer = null;
			if (Zotero.Embeddings.Indexing.isPaused()) {
				return;
			}
			Zotero.debug('Embeddings: asking the server again');
			Zotero.Embeddings.Indexing.startIndexing().catch(e => Zotero.logError(e));
		}, delay);
		Zotero.Embeddings.Indexing.Progress.emit();
	}

	function _clearServerRetry() {
		_serverUnreachable = null;
		if (_serverRetryTimer) {
			clearTimeout(_serverRetryTimer);
			_serverRetryTimer = null;
		}
	}

	// A count with its noun, for the log
	function _count(n, noun) {
		return `${n.toLocaleString()} ${Zotero.Utilities.pluralize(n, noun)}`;
	}

	// Milliseconds as "4 m 10 s", for the log
	function _duration(ms) {
		let seconds = Math.round(ms / 1000);
		let minutes = Math.floor(seconds / 60);
		return minutes ? `${minutes} m ${seconds % 60} s` : `${seconds} s`;
	}

	// Start a run, or note the kick when a run is already going
	function _startConsumer() {
		if (_indexing) {
			_kicked = true;
			return _indexingPromise;
		}
		if (!Zotero.Embeddings.isEnabled() || Zotero.Embeddings.Indexing.isPaused()) {
			return Promise.resolve();
		}
		_indexingPromise = _run();
		return _indexingPromise;
	}

	//
	// The run
	//
	// One consumer does the indexing; everything below it is work the run
	// hands off to.
	//

	// The single consumer: get the model ready, then index the items and
	// take the attachments through their pipeline until there's nothing
	// left or stopIndexing() is called. Every run goes through here, so
	// there's never more than one, and it can always be stopped.
	async function _run() {
		// Wait for memory rather than starting a run that would make things
		// worse. A later kick finds the work where it was.
		if (!Zotero.Embeddings.Indexing.Runtime.hasMemoryToIndex()) {
			_scheduleKick(LOW_MEMORY_RETRY_DELAY);
			return;
		}
		_indexing = true;
		_stopping = false;
		_lastError = null;
		let started = Date.now();
		Zotero.Embeddings.Diagnostics.startRun();
		Zotero.Embeddings.Indexing.Runtime.startRun();
		Zotero.Embeddings.Indexing.Progress.startRun();
		try {
			await Zotero.Embeddings.initDB();
			await _ensureIndexMatchesModel();
			Zotero.Embeddings.Indexing.Progress.setPhase((await Zotero.Embeddings.isDownloaded()) ? 'indexing' : 'downloading');
			await Zotero.Embeddings.Indexing.Progress.refresh();
			// Download only -- the engine is created lazily by the first
			// embed, so the model isn't held in memory through the extraction
			// step below
			await Zotero.Embeddings.download(
				report => Zotero.Embeddings.Indexing.Progress.onDownload(report));
			// A verified endpoint may have changed or gone away since
			await Zotero.Embeddings.Endpoint.recheck();

			Zotero.Embeddings.Indexing.Progress.clearDownload();
			Zotero.debug('Embeddings: run starting -- server '
				+ (Zotero.Embeddings.Sync.isAvailable() ? 'available' : 'not available'));
			// One kind of work at a time, in a fixed order: the items, then
			// the attachments through their pipeline. The items go first,
			// and a kick brings the run back to them, so a just-edited item
			// is searchable without waiting behind the library's documents.
			while (!_shouldStop()) {
				_kicked = false;
				await _indexItems();
				// A sync may be adding, replacing and removing files: the
				// attachments wait for it to finish, which kicks the run
				if (Zotero.Sync.Runner.syncInProgress) {
					Zotero.debug('Embeddings: sync in progress -- the attachments wait for it to finish');
					break;
				}
				// The attachment pipeline. Each step finds its own work in the
				// index, so a run cut short resumes where it was, and one that
				// gives way to a kick starts over once the items are seen to.
				let finished = await _reconcileAttachments()
					&& await _extractAttachments()
					&& await _fetchAttachments()
					&& await _cutAttachments()
					&& await _embedAttachments();
				// The server couldn't be reached: everything waits for the
				// retry, which starts the run over. Otherwise over, unless
				// a kick landed meanwhile.
				if (_serverUnreachable || (finished && !_kicked)) {
					break;
				}
			}
			await Zotero.Embeddings.Indexing.Progress.refresh();
		}
		catch (e) {
			Zotero.logError(e);
			_lastError = e;
		}
		finally {
			Zotero.Embeddings.Indexing.Runtime.endRun();
			_indexing = false;
			Zotero.Embeddings.Diagnostics.endRun();
			await Zotero.Embeddings.Indexing.Progress.endRun();
			Zotero.debug(`Embeddings: run ${_stopping ? 'stopped' : 'finished'} after `
				+ _duration(Date.now() - started));
			// Go again for a kick that landed as we were finishing up,
			// unless the attachments are waiting on a sync or on the
			// server, each of which kicks the run itself
			let kicked = _kicked;
			_kicked = false;
			if (!_stopping && kicked && !Zotero.Sync.Runner.syncInProgress && !_serverUnreachable) {
				_scheduleKick();
			}
			// Inference memory is held by the process running the model, and
			// the runtime's own idle timeout is long, so release it as soon as
			// there's nothing left to index
			else {
				try {
					await Zotero.Embeddings.shutdownEngine();
					if (_serverUnreachable && !_stopping) {
						_scheduleServerRetry();
					}
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
		}
	}

	// Index items, notes and annotations: those saved since the index last
	// looked at them, a slice at a time, until they're done or the run
	// stops
	async function _indexItems() {
		Zotero.Embeddings.Indexing.Progress.setPhase('indexing');
		let changed = await Zotero.Embeddings.Indexing.Sources.getChangedItems();
		for (let i = 0; i < changed.length && !_shouldStop(); i += ITEM_SLICE_SIZE) {
			await _embedItems(new Map(changed.slice(i, i + ITEM_SLICE_SIZE)
				.map(row => [row.itemID, row.clientDateModified])));
		}
	}

	// Embed the given items, notes and annotations whose text differs from
	// what their rows were made from, replacing an item's rows as a unit once
	// every chunk is in; one whose text is gone loses its rows. Each is
	// stamped as seen, so the next run passes it over until it's saved again.
	// The text is read from the tables, so no item is loaded.
	//
	// @param {Map} stamps - itemID -> the item's clientDateModified as
	//     seen when it was found changed
	async function _embedItems(stamps) {
		let { Store, Sources } = Zotero.Embeddings.Indexing;
		// Deleted since they were found: their rows went with the delete
		// notifier, and they get no stamp
		let itemIDs = [...stamps.keys()].filter(itemID => Zotero.Items.exists(itemID));
		let texts = await Sources.getItemTexts(itemIDs);
		let storedHashes = await Store.getStoredHashes(itemIDs);
		let entries = [];
		let toDelete = [];
		let seen = [];
		for (let itemID of itemIDs) {
			let text = texts.get(itemID);
			let contentHash = text ? Zotero.Utilities.Internal.md5(text) : null;
			if (text && storedHashes.get(itemID) !== contentHash) {
				entries.push({ itemID, text, contentHash });
				continue;
			}
			if (!text && storedHashes.has(itemID)) {
				toDelete.push(itemID);
			}
			seen.push({ itemID, clientDateModified: stamps.get(itemID) });
		}
		if (toDelete.length) {
			await Store.deleteItems(toDelete);
		}
		await Store.stampItems(seen);
		// Each text is cut to fit the model's context window. A title and
		// abstract, or an annotation's passage and comment, come out as a
		// single chunk in almost all cases; a long note as several.
		let units = [];
		for (let entry of entries) {
			// Cutting long notes takes real time, so a stop is heeded here as
			// well as between batches. Nothing has been written yet but the
			// deletions and stamps above, which hold regardless.
			if (_shouldStop()) {
				return;
			}
			let chunks = Zotero.SDT.getPlainTextChunks(entry.text);
			entry.vectors = new Array(chunks.length);
			entry.remaining = chunks.length;
			chunks.forEach((chunk, chunkIndex) => {
				units.push({ text: chunk.text, tokens: chunk.tokens, entry, chunkIndex });
			});
		}
		units.sort((a, b) => a.tokens - b.tokens);
		Zotero.Embeddings.Diagnostics.startSlice(units.length);
		for (let i = 0; i < units.length;) {
			if (_shouldStop()) {
				return;
			}
			let batch = _nextBatch(units, i);
			i += batch.length;
			let vectors = await _embedBatch(batch);
			let completed = [];
			batch.forEach((unit, j) => {
				unit.entry.vectors[unit.chunkIndex] = vectors[j];
				if (--unit.entry.remaining === 0) {
					completed.push(unit.entry);
				}
			});
			await Zotero.DB.executeTransaction(async function () {
				for (let { itemID, vectors: itemVectors, contentHash } of completed) {
					// The item may have been deleted while the batch was
					// embedding -- don't write its vectors back after the
					// delete notifier removed them
					if (!Zotero.Items.exists(itemID)) {
						continue;
					}
					await Zotero.Embeddings.Indexing.Store.deleteRows(itemID);
					for (let k = 0; k < itemVectors.length; k++) {
						await Zotero.Embeddings.Indexing.Store.insertRow(itemID, k,
							Zotero.Embeddings.prepare(itemVectors[k]));
					}
					await Zotero.Embeddings.Indexing.Store.setSource(itemID, {
						contentHash,
						clientDateModified: stamps.get(itemID)
					});
				}
			});
			await Zotero.Embeddings.Indexing.Progress.tick();
			// Yield so the UI thread stays responsive between batches
			await Zotero.Promise.delay(0);
		}
	}

	// Reconcile: whether what's stored still holds. An attachment loses
	// everything stored when its file is gone, its rows were cut by a chunker
	// older than MIN_CHUNKER_VERSION, or its file's content changed; one with
	// the same content under a new file key keeps its rows.
	//
	// @return {Promise<Boolean>} - Whether it got to the end
	async function _reconcileAttachments() {
		let { Store, Sources } = Zotero.Embeddings.Indexing;
		return _forEachPage(async (page) => {
			for (let { item, record } of page) {
				if (_shouldStop()) {
					return false;
				}
				if (!record?.sourceKey) {
					continue;
				}
				if (_chunkerVersionOf(record.extractor) < MIN_CHUNKER_VERSION) {
					await Store.deleteItems([item.id]);
					continue;
				}
				let sourceKey = await Sources.getAttachmentSourceKey(item);
				if (sourceKey === record.sourceKey) {
					continue;
				}
				if (sourceKey && record.contentHash && await _hasContent(item, record.contentHash)) {
					await Store.setSource(item.id, {
						sourceKey,
						contentHash: record.contentHash,
						extractor: record.extractor,
						syncVersion: record.syncVersion
					});
				}
				else {
					await Store.deleteItems([item.id]);
				}
			}
			return true;
		});
	}

	// Whether an attachment's file, or the text it yields, is the content
	// rows were made from
	async function _hasContent(item, contentHash) {
		let { Sources } = Zotero.Embeddings.Indexing;
		return contentHash === await item.attachmentHash
			|| contentHash === await Sources.getAttachmentTextHash(item);
	}

	// The chunker's version in an extractor identity ('pdf/3/1/1' -> 1), or
	// Infinity for rows not cut here, which no chunker of this client's
	// outdates
	function _chunkerVersionOf(extractor) {
		let version = parseInt(extractor?.split('/').at(-1));
		return Number.isNaN(version) ? Infinity : version;
	}

	// Extract: every attachment's text cached as a pack, the server's
	// included, so no preview waits on an extraction; rows that arrived
	// before their file are adopted. Only attachments not packed this session
	// or looked at since saved are asked about, then stamped. The engine goes
	// down first, since extraction competes with it for the same cores.
	async function _extractAttachments() {
		let { Sources, Store } = Zotero.Embeddings.Indexing;
		let engineDown = false;
		return _forEachPage(async (page) => {
			let work = [];
			let seen = [];
			for (let payload of page) {
				if (_shouldStop()) {
					return false;
				}
				let { item, record, rows, pending, clientDateModified } = payload;
				let adopt = rows > 0 && !record?.sourceKey;
				let lookedAt = record?.clientDateModified === clientDateModified;
				if (!adopt && !pending && (_packed.has(item.id) || lookedAt)) {
					seen.push({ itemID: item.id, clientDateModified });
					continue;
				}
				let sourceKey = await Sources.getAttachmentSourceKey(item);
				if (sourceKey && (adopt || pending > 0 || !await Zotero.SDT.isCached(item.id))) {
					work.push({ ...payload, sourceKey, adopt });
				}
				else {
					if (sourceKey) {
						_packed.add(item.id);
					}
					seen.push({ itemID: item.id, clientDateModified });
				}
			}
			await Store.stampItems(seen);
			if (work.length && !engineDown) {
				engineDown = true;
				await Zotero.Embeddings.shutdownEngine();
			}
			return _forEachAttachment('preparing', work, async (payload) => {
				if (await Zotero.SDT.ensure(payload.item.id)) {
					_packed.add(payload.item.id);
				}
				if (payload.adopt) {
					await _adoptRows(payload);
				}
				await Store.stampItems([{ itemID: payload.item.id, clientDateModified: payload.clientDateModified }]);
			});
		});
	}

	// Rows that arrived for a file this client didn't have: now that it
	// does, they're recorded as the file's if they were made from the
	// content it cuts to, and dropped otherwise, so the attachment is asked
	// about anew
	async function _adoptRows({ item, sourceKey, record }) {
		let { Store, Sources } = Zotero.Embeddings.Indexing;
		let result = await Sources.getAttachmentChunks(item);
		// Not known right now: the rows wait for a run that can cut the file
		if (result?.failed) {
			return;
		}
		if (result && record.contentHash && result.contentHash === record.contentHash) {
			await Store.setSource(item.id, {
				sourceKey,
				contentHash: record.contentHash,
				syncVersion: record.syncVersion
			});
		}
		else {
			await Store.deleteItems([item.id]);
		}
	}

	// Cut: this client's attachments cut into chunks, a row per chunk with
	// its anchor and the vector still to come. The attachments that want
	// cutting, less the server's -- whose rows are never cut over -- and
	// those without a file.
	async function _cutAttachments() {
		let { Sources } = Zotero.Embeddings.Indexing;
		let extractors = await Sources.getExtractors();
		return _forEachPage(async (page) => {
			let work = [];
			for (let payload of page.filter(p => !_isServers(p) && _needsCut(p, extractors))) {
				if (_shouldStop()) {
					return false;
				}
				let sourceKey = await Sources.getAttachmentSourceKey(payload.item);
				if (!sourceKey) {
					continue;
				}
				work.push({ ...payload, sourceKey, extractor: await Sources.getExtractor(payload.item) });
			}
			if (work.length) {
				Zotero.debug(`Embeddings: cutting ${_count(work.length, 'attachment')}`);
			}
			return _forEachAttachment('preparing', work, async (payload) => {
				await _chunkAttachment(payload);
			});
		});
	}

	// Cut one attachment into a row per chunk with its anchor, the vector
	// still to come. Rows for the same content stay when this extractor cut
	// them, so an interrupted attachment resumes, or when they're complete,
	// since anchors hold across extractors. Anything else stored goes.
	async function _chunkAttachment({ item, sourceKey, extractor, record, rows, pending, clientDateModified }) {
		let { Store, Sources } = Zotero.Embeddings.Indexing;
		let result = await Sources.getAttachmentChunks(item);
		// Not known right now: left as it is, to be cut on a later run
		if (result?.failed) {
			return;
		}
		let chunks = result ? result.chunks : [];
		let contentHash = result ? result.contentHash : null;
		await Zotero.DB.executeTransaction(async function () {
			let keep = rows > 0 && record?.contentHash === contentHash;
			if (keep && record.extractor !== extractor) {
				if (!pending) {
					await Store.setSource(item.id, {
						sourceKey, contentHash, extractor: record.extractor, clientDateModified
					});
					return;
				}
				keep = false;
			}
			await Store.deleteRows(item.id, keep ? chunks.length : 0);
			for (let [chunkIndex, chunk] of chunks.entries()) {
				await Store.insertPendingRow(item.id, chunkIndex, chunk.anchor);
			}
			await Store.setSource(item.id, { sourceKey, contentHash, extractor, clientDateModified });
		});
	}

	// Embed here: every chunk cut here without a vector gets one, the
	// server's attachments aside. Chunks pool across attachments and pages
	// and are sorted by length before they go to the engine. Rows are written
	// as each batch lands, so an interrupted attachment resumes from them.
	async function _embedAttachments() {
		let { Progress } = Zotero.Embeddings.Indexing;
		let started = false;
		let pool = [];
		let filling = Date.now();
		// Embed everything pooled so far, emptying the pool either way
		let drain = async () => {
			let units = pool;
			pool = [];
			filling = Date.now();
			if (!units.length) {
				return true;
			}
			units.sort((a, b) => a.tokens - b.tokens);
			Zotero.Embeddings.Diagnostics.startSlice(units.length);
			for (let i = 0; i < units.length;) {
				if (_shouldYield()) {
					return false;
				}
				let batch = _nextBatch(units, i);
				i += batch.length;
				await _storeAttachmentBatch(batch, await _embedBatch(batch));
				// Yield so the UI thread stays responsive between batches
				await Zotero.Promise.delay(0);
			}
			return true;
		};
		let finished = await _forEachPage(async (page) => {
			let own = page.filter(payload => !_isServers(payload) && payload.pending > 0);
			if (!own.length) {
				return true;
			}
			let ownChunks = own.reduce((sum, { pending }) => sum + pending, 0);
			// Ones the server declined are this client's
			let declined = own.filter(payload => payload.record?.syncDeclined).length;
			Zotero.debug(`Embeddings: page of ${_count(own.length, 'attachment')} to embed here `
				+ `(${ownChunks} chunks)`
				+ (declined ? `, ${declined} of them declined by the server` : ''));
			if (!started) {
				started = true;
				Progress.setEmbedWork({});
			}
			Progress.addEmbedWork({ own: own.length, ownChunks, declined });
			return _forEachAttachment('indexing-documents', own, async (payload) => {
				pool.push(...await _getAttachmentUnits(payload));
				if (pool.length >= EMBED_POOL_SIZE
						|| (pool.length && Date.now() - filling >= EMBED_POOL_FILL_MAX)) {
					await drain();
				}
			});
		});
		return await drain() && finished;
	}

	// Fetch: ask the server for the rows of every attachment that's its, a
	// library at a time within each page. What it declines is cut and
	// embedded here; what it puts off waits. When it can't be reached, every
	// attachment waits for the retry after SERVER_RETRY_DELAY.
	//
	// @return {Promise<Boolean>} - Whether it got to the end
	async function _fetchAttachments() {
		if (_serverUnreachable) {
			return false;
		}
		let { Progress } = Zotero.Embeddings.Indexing;
		let started = false;
		return _forEachPage(async (page) => {
			let server = page.filter(payload => _isServers(payload) && _needsAnswer(payload));
			if (!server.length) {
				return true;
			}
			Zotero.debug(`Embeddings: asking the server for ${_count(server.length, 'attachment')}`);
			if (!started) {
				started = true;
				Progress.resetAwaiting();
				Progress.setPhase('fetching-documents');
			}
			let byLibrary = new Map();
			for (let payload of server) {
				let libraryID = payload.item.libraryID;
				if (!byLibrary.has(libraryID)) {
					byLibrary.set(libraryID, []);
				}
				byLibrary.get(libraryID).push(payload);
			}
			for (let [libraryID, payloads] of byLibrary) {
				if (_shouldYield()) {
					return false;
				}
				let finished;
				try {
					finished = await Zotero.Embeddings.Sync.fetch(libraryID, payloads, _shouldStop);
				}
				catch (e) {
					Zotero.logError(e);
					let delay = Zotero.Embeddings.Indexing.SERVER_RETRY_DELAY;
					_serverUnreachable = { retryAt: Date.now() + delay, error: e };
					Zotero.debug(`Embeddings: the server couldn't be reached -- asking again in ${_duration(delay)}`);
					return false;
				}
				if (!finished) {
					return false;
				}
			}
			return true;
		});
	}

	// An attachment's chunks still to embed, as { text, tokens } units with
	// what each one's row needs. The text embedded is the chunk's embedText,
	// its own text with the outline path woven in, and each chunk carries
	// its anchor in the document, none when cut from plain attachment text.
	async function _getAttachmentUnits({ item, rows }) {
		let result = await Zotero.Embeddings.Indexing.Sources.getAttachmentChunks(item);
		if (result?.failed) {
			return [];
		}
		let chunks = result ? result.chunks : [];
		// The pack changed since the attachment was cut, so its rows no
		// longer describe these chunks. Skipped until a newer extractor cuts
		// it again.
		if (chunks.length !== rows) {
			Zotero.debug(`Embeddings: ${item.libraryKey} cuts into ${chunks.length} chunks, `
				+ `not the ${rows} stored -- skipping`);
			return [];
		}
		let stored = await Zotero.Embeddings.Indexing.Store.getEmbeddedIndexes(item.id);
		return chunks.flatMap((chunk, chunkIndex) => (stored.has(chunkIndex)
			? []
			: [{
				text: chunk.embedText || chunk.text,
				tokens: chunk.tokens,
				item,
				chunkIndex,
				anchor: chunk.anchor
			}]));
	}

	// Store a batch of attachment chunks as it lands. An attachment may have
	// been deleted while the batch was embedding, and then its vectors
	// aren't written back after the delete notifier removed them.
	async function _storeAttachmentBatch(batch, vectors) {
		await Zotero.DB.executeTransaction(async function () {
			for (let j = 0; j < batch.length; j++) {
				let { item, chunkIndex, anchor } = batch[j];
				// Asked of the id maps, not the cache: the attachments a run
				// embeds are loaded without being cached
				if (!Zotero.Items.exists(item.id)) {
					continue;
				}
				await Zotero.Embeddings.Indexing.Store.insertRow(item.id, chunkIndex,
					Zotero.Embeddings.prepare(vectors[j]), anchor);
			}
		});
		await Zotero.Embeddings.Indexing.Progress.tick();
	}

	// Whether the run has been told to stop
	function _shouldStop() {
		return _stopping;
	}

	// Whether the attachment work should give way: the run is stopping, a
	// kick landed, or a sync has started and may be changing the files
	function _shouldYield() {
		return _shouldStop() || _kicked || Zotero.Sync.Runner.syncInProgress;
	}

	// One pass over the outstanding attachments, a page at a time in id
	// order, handing each page to `step`, which says whether it got through
	// it, and giving way between pages. Reports how far through the
	// library's attachments the pass has got.
	//
	// @return {Promise<Boolean>} - Whether it got to the end
	async function _forEachPage(step) {
		let { Sources, Progress } = Zotero.Embeddings.Indexing;
		let afterID = 0;
		Progress.setSweep(0);
		while (!_shouldYield()) {
			let page = await Sources.getOutstandingAttachments(
				afterID, Zotero.Embeddings.Indexing.ATTACHMENT_PAGE_SIZE);
			if (!page.length) {
				return true;
			}
			if (!await step(page)) {
				return false;
			}
			afterID = page.at(-1).item.id;
			Progress.setSweep(await Sources.countEligibleAttachments(afterID));
		}
		return false;
	}

	// Go over the attachments a stage has work for, one at a time, announcing
	// the step it belongs to and giving way between them. A stage with
	// nothing to do announces nothing, so a run that finds everything up to
	// date doesn't report a step that never ran.
	//
	// @return {Promise<Boolean>} - Whether it got to the end
	async function _forEachAttachment(phase, payloads, step) {
		if (!payloads.length) {
			return true;
		}
		Zotero.Embeddings.Indexing.Progress.setPhase(phase);
		for (let payload of payloads) {
			if (_shouldYield()) {
				return false;
			}
			await step(payload);
			await Zotero.Embeddings.Indexing.Progress.tick();
		}
		return true;
	}

	// Whether an attachment is the server's to answer for, rather than
	// this client's to cut and embed
	function _isServers({ item, record }) {
		return Zotero.Embeddings.Sync.shouldAskServer(item, record);
	}

	// Whether the server may have rows for an attachment: chunks still to
	// embed, marked to be fetched again, or nothing stored and never cut
	// here
	function _needsAnswer({ record, rows, pending }) {
		return pending > 0 || !!record?.syncShouldRefresh || (!rows && !record?.sourceKey);
	}

	// Whether an attachment wants cutting: never cut from the file here,
	// or chunks still to embed under an extractor that is no longer among
	// the given current identities
	function _needsCut({ record, pending }, extractors) {
		return !record?.sourceKey || (pending > 0 && !extractors.includes(record.extractor));
	}


	//
	// Embedding
	//

	// As many of the units from `start` as fit one engine call, always at
	// least one. The engine pads every text to the longest in its batch, so
	// units sorted by token count pack batches of similar length, roughly
	// halving fulltext indexing time. The budget is read per batch, since
	// memory pressure and the endpoint can change it mid-run.
	//
	// @param {Object[]} units - Each { text, tokens } plus the caller's own
	//     fields
	// @param {Number} start
	// @return {Object[]} - The units to embed together
	function _nextBatch(units, start) {
		let budget = Zotero.Embeddings.Indexing.Runtime.getTokenBudget();
		let longest = 0;
		let count = 0;
		while (start + count < units.length && count < MAX_BATCH_TEXTS) {
			let tokens = Math.max(longest, units[start + count].tokens);
			if (count && tokens * (count + 1) > budget) {
				break;
			}
			longest = tokens;
			count++;
		}
		return units.slice(start, start + count);
	}

	// Turn one batch of units into vectors -- the only engine call here.
	// Restarts the engine afterwards if it's due, between batches rather
	// than mid-request.
	//
	// @param {Object[]} batch - From _nextBatch()
	// @return {Promise<Float32Array[]>} - One vector per unit, in order
	async function _embedBatch(batch) {
		let started = Date.now();
		let vectors = await Zotero.Embeddings.embedPassages(batch.map(unit => unit.text));
		Zotero.Embeddings.Diagnostics.recordBatch({
			chunks: batch.length,
			tokens: batch.reduce((sum, unit) => sum + unit.tokens, 0),
			longest: Math.max(...batch.map(unit => unit.tokens)),
			inferenceMs: Date.now() - started
		});
		await Zotero.Embeddings.Indexing.Runtime.restartEngineIfDue();
		return vectors;
	}


	//
	// Status
	//
	// What the preferences pane reads, composed from the run's own state and
	// what Progress, Diagnostics, Runtime and Endpoint each report.
	//

	/**
	 * Current runner state, for the preferences UI.
	 *
	 * Progress comes in two disjoint pairs: `items` counts items, notes and
	 * annotations, and `attachments` the attachments with a vector for every
	 * chunk, wherever they were embedded. `chunks` counts the chunks cut
	 * here, for the rate and the ETA.
	 */
	this.getStatus = function () {
		return {
			enabled: Zotero.Embeddings.isEnabled(),
			model: Zotero.Embeddings.getModelName(),
			indexing: _indexing,
			// A stop has been requested but the current batch is still finishing
			stopping: _indexing && _stopping,
			paused: this.isPaused(),
			// Whether the server is in the picture at all, so the pane can
			// say when work is done here instead
			server: Zotero.Embeddings.Sync.isAvailable() && !Zotero.Embeddings.Endpoint.isActive(),
			// While the server can't be reached: when the run goes back to
			// it, and what went wrong
			serverUnreachable: _serverUnreachable
				? {
					retryAt: _serverUnreachable.retryAt,
					error: _serverUnreachable.error.message || String(_serverUnreachable.error)
				}
				: null,
			...Zotero.Embeddings.Indexing.Progress.getStatus(),
			diagnostics: {
				...Zotero.Embeddings.Diagnostics.getStatus(),
				...Zotero.Embeddings.Indexing.Runtime.getStatus()
			},
			endpoint: Zotero.Embeddings.Endpoint.getStatus(),
			error: _lastError ? (_lastError.message || String(_lastError)) : null
		};
	};

	this.addProgressListener = function (fn) {
		Zotero.Embeddings.Indexing.Progress.addListener(fn);
	};

	this.removeProgressListener = function (fn) {
		Zotero.Embeddings.Indexing.Progress.removeListener(fn);
	};

	/**
	 * Recompute every count and notify listeners.
	 *
	 * @return {Promise<Object>} - The status object
	 */
	this.refreshStatus = async function () {
		await Zotero.Embeddings.Indexing.Progress.refresh();
		return this.getStatus();
	};


	//
	// Anchors
	//
	// A chunk's anchor is stored as its JSON, deflated: a third of the plain
	// JSON across a library.
	//

	/**
	 * A chunk's anchor as the bytes it's stored as
	 *
	 * @param {Object|null} anchor - A chunk's anchor, as the SDT module
	 *     gives it
	 * @return {Uint8Array}
	 */
	this.compactAnchor = function (anchor) {
		if (anchor !== null && (typeof anchor != 'object' || Array.isArray(anchor))) {
			throw new TypeError("anchor must be an object or null");
		}
		return require('pako').deflateRaw(JSON.stringify(anchor));
	};

	/**
	 * An anchor read back from what compactAnchor() stored
	 *
	 * @param {Uint8Array|Number[]} bytes - As stored, or as the database
	 *     returns a blob
	 * @return {Object|null}
	 */
	this.expandAnchor = function (bytes) {
		if (!(bytes instanceof Uint8Array)) {
			bytes = new Uint8Array(bytes);
		}
		if (!bytes.length) {
			throw new TypeError("bytes must be a nonempty byte array");
		}
		return JSON.parse(require('pako').inflateRaw(bytes, { to: 'string' }));
	};
};


/**
 * What each kind of item offers the index, and what text it yields. The SQL
 * eligibility pass and the per-item text tests have to agree, so they live
 * together. Nothing here knows that a run is under way.
 */
Zotero.Embeddings.Indexing.Sources = new function () {
	// The identity of the extractor and chunker that would cut an attachment
	// here, as recorded with the rows cut from it. Null when the attachment
	// has no extractor.
	//
	// @param {Zotero.Item} item
	// @return {Promise<String|null>} - e.g. 'pdf/3/1/1'
	this.getExtractor = async function (item) {
		return Zotero.SDT.getProcessorVersion(item);
	};

	// Every identity getExtractor() gives right now, one per kind of
	// attachment
	//
	// @return {Promise<String[]>}
	this.getExtractors = async function () {
		return Zotero.SDT.getProcessorVersions();
	};

	// The items, notes and annotations eligible for indexing, in the
	// libraries indexed: a regular item with two words in its title (or a
	// type-specific title field) or abstract, a note with three words, an
	// annotation with three across its passage and comment. getItemTexts()
	// applies the same tests, so the counts and the index agree.
	//
	// @return {Promise<Integer[]>}
	this.getEligibleItemIDs = async function () {
		let fieldIDs = Zotero.Embeddings.getIndexedFieldIDs();
		let libraryIDs = new Set(this.getIndexableLibraries().map(library => library.libraryID));
		let ids = new Set();
		let add = (row) => {
			if (libraryIDs.has(row.libraryID)) {
				ids.add(row.itemID);
			}
		};
		let rows = await Zotero.DB.queryAsync(
			"SELECT libraryID, itemID, value FROM itemData "
				+ "JOIN itemDataValues USING (valueID) "
				+ "JOIN items USING (itemID) "
				+ "WHERE fieldID IN (" + fieldIDs.join(',') + ") "
				+ "AND TRIM(value)!='' AND itemTypeID!=?",
			Zotero.ItemTypes.getID('attachment')
		);
		for (let row of rows) {
			if (_hasEmbeddableText(row.value, 2)) {
				add(row);
			}
		}
		rows = await Zotero.DB.queryAsync(
			"SELECT libraryID, itemID, title, note FROM itemNotes "
				+ "JOIN items USING (itemID) WHERE itemTypeID=?",
			Zotero.ItemTypes.getID('note')
		);
		for (let row of rows) {
			// The title is the note's first line, so its words are among
			// the note's own -- a title with enough of them settles it
			// without stripping the body's HTML
			if (_hasEmbeddableText(row.title)) {
				add(row);
			}
			else if (_hasEmbeddableText(_htmlToText(row.note, true))) {
				add(row);
			}
		}
		rows = await Zotero.DB.queryAsync(
			"SELECT libraryID, itemID, text, comment FROM itemAnnotations "
				+ "JOIN items USING (itemID)"
		);
		for (let row of rows) {
			if (_hasEmbeddableText(_getAnnotationRawText(row.text, row.comment))) {
				add(row);
			}
		}
		return [...ids];
	};

	// A stamp is a second, so an item saved in the last few seconds is
	// taken as saved since the index looked at it, whatever its stamp
	// says: a save in the same second as the look would otherwise go
	// unseen
	const RECENT_SAVE_MS = 5 * 1000;

	// The stamp from which a save counts as recent, as SQL
	function _recentSaveCutoff() {
		return Zotero.Date.dateToSQL(new Date(Date.now() - RECENT_SAVE_MS), true);
	}

	// Items, notes and annotations saved since the index last looked at them,
	// or never looked at, library by library, most recently saved first. Each
	// comes with the stamp seen, which is what the look records.
	//
	// @return {Promise<Object[]>} - [{ itemID, clientDateModified }]
	this.getChangedItems = async function () {
		let byLibrary = new Map();
		let rows = await Zotero.DB.queryAsync(
			"SELECT I.libraryID, I.itemID, I.clientDateModified FROM items I "
				+ "LEFT JOIN embeddings.itemIndexState S USING (itemID) "
				+ "WHERE I.itemTypeID!=? "
				+ "AND (S.itemID IS NULL OR S.clientDateModified IS NOT I.clientDateModified "
					+ "OR I.clientDateModified>=?) "
				+ "ORDER BY I.clientDateModified DESC, I.itemID",
			[Zotero.ItemTypes.getID('attachment'), _recentSaveCutoff()]
		);
		for (let row of rows) {
			if (!byLibrary.has(row.libraryID)) {
				byLibrary.set(row.libraryID, []);
			}
			byLibrary.get(row.libraryID).push({ itemID: row.itemID, clientDateModified: row.clientDateModified });
		}
		return this.getIndexableLibraries().flatMap(library => byLibrary.get(library.libraryID) || []);
	};

	// The SQL mirror of isIndexableAttachment() over itemAttachments IA
	// and items I: stored or linked PDFs and EPUBs, and snapshots (which
	// are always stored), in the libraries indexed
	function _eligibleAttachmentSQL() {
		let libraryIDs = Zotero.Embeddings.Indexing.Sources.getIndexableLibraries()
			.map(library => library.libraryID);
		return "((IA.contentType IN ('application/pdf', 'application/epub+zip') "
				+ "AND IA.linkMode!=" + Zotero.Attachments.LINK_MODE_LINKED_URL + ") "
			+ "OR (IA.contentType='text/html' AND IA.linkMode=" + Zotero.Attachments.LINK_MODE_IMPORTED_URL + ")) "
			+ "AND I.libraryID IN (" + (libraryIDs.join(',') || 'NULL') + ")";
	}

	// One page of the outstanding attachments: at most `limit` with an id
	// above `afterID`, in id order
	//
	// @return {Promise<Object[]>} - [{ item, record, rows, pending,
	//     clientDateModified }]: the item, its state row or null, its row
	//     count, how many still want a vector, and the stamp seen
	this.getOutstandingAttachments = async function (afterID, limit) {
		// An eligible attachment is outstanding with nothing recorded, no
		// file key, rows to fetch again, a chunk still to embed, or a save
		// since the index last looked at it (or in the last few seconds)
		const OUTSTANDING = "(S.itemID IS NULL OR S.sourceKey IS NULL OR S.syncShouldRefresh=1 "
			+ "OR EXISTS (SELECT 1 FROM embeddings.itemEmbeddings E "
				+ "WHERE E.itemID=I.itemID AND E.embedding IS NULL) "
			+ "OR S.clientDateModified IS NOT I.clientDateModified OR I.clientDateModified>=?)";
		let rows = await Zotero.DB.queryAsync(
			"SELECT I.itemID, I.clientDateModified, S.itemID AS stateID, S.sourceKey, "
				+ "S.contentHash, S.extractor, S.syncVersion, S.syncDeclined, S.syncShouldRefresh, "
				+ "(SELECT COUNT(*) FROM embeddings.itemEmbeddings E "
					+ "WHERE E.itemID=I.itemID) AS rowCount, "
				+ "(SELECT COUNT(*) FROM embeddings.itemEmbeddings E "
					+ "WHERE E.itemID=I.itemID AND E.embedding IS NULL) AS pendingCount "
				+ "FROM itemAttachments IA "
				+ "JOIN items I USING (itemID) "
				+ "LEFT JOIN embeddings.itemIndexState S ON (S.itemID=I.itemID) "
				+ "WHERE " + _eligibleAttachmentSQL() + " AND " + OUTSTANDING + " "
				+ "AND I.itemID>? ORDER BY I.itemID LIMIT ?",
			[_recentSaveCutoff(), afterID, limit]
		);
		// Loaded without caching, as file sync loads a library's files for
		// its scan: a run reads attachments across every library, which is
		// no reason to hold them in memory. The items come back in cache
		// order with deleted ones left out, so each row finds its own.
		let items = new Map((await Zotero.Items.getAsync(rows.map(row => row.itemID), { noCache: true }))
			.map(item => [item.id, item]));
		return rows.filter(row => items.has(row.itemID)).map(row => ({
			item: items.get(row.itemID),
			clientDateModified: row.clientDateModified,
			record: row.stateID === null
				? null
				: {
					itemID: row.itemID,
					sourceKey: row.sourceKey,
					contentHash: row.contentHash,
					extractor: row.extractor,
					syncVersion: row.syncVersion,
					syncDeclined: row.syncDeclined,
					syncShouldRefresh: row.syncShouldRefresh
				},
			rows: row.rowCount,
			pending: row.pendingCount
		}));
	};

	// How many attachments are eligible at all, or up to the given id:
	// how far through them a pass in id order has got
	this.countEligibleAttachments = async function (upToID = null) {
		return Zotero.DB.valueQueryAsync(
			"SELECT COUNT(*) FROM itemAttachments IA JOIN items I USING (itemID) "
				+ "WHERE " + _eligibleAttachmentSQL()
				+ (upToID === null ? "" : " AND I.itemID<=?"),
			upToID === null ? [] : [upToID]
		);
	};

	// The libraries whose items are indexed at all
	this.getIndexableLibraries = function () {
		return Zotero.Libraries.getAll()
			.filter(library => ['user', 'group'].includes(library.libraryType));
	};

	// Whether an item is an attachment whose full text can be indexed --
	// the types Zotero.SDT can extract structured text from
	this.isIndexableAttachment = function (item) {
		return item.isPDFAttachment() || item.isEPUBAttachment()
			|| item.isSnapshotAttachment();
	};

	// The text embedded for each item, null when it has too little to index
	// by the eligibility tests: a regular item's title and abstract, a note's
	// plain text, an annotation's passage with its comment. Read from the
	// tables, so no item is loaded; the ids go into one IN list.
	//
	// @param {Integer[]} itemIDs - Items, notes and annotations
	// @return {Promise<Map>}
	this.getItemTexts = async function (itemIDs) {
		let texts = new Map(itemIDs.map(itemID => [itemID, null]));
		if (!itemIDs.length) {
			return texts;
		}
		let ids = itemIDs.map(() => '?').join(',');
		// The title field is one of several, by item type (title, caseName,
		// subject, nameOfAct); the abstract is one field
		let abstractFieldID = Zotero.ItemFields.getID('abstractNote');
		let fields = new Map();
		let rows = await Zotero.DB.queryAsync(
			"SELECT itemID, fieldID, value FROM itemData JOIN itemDataValues USING (valueID) "
				+ "WHERE itemID IN (" + ids + ") "
				+ "AND fieldID IN (" + Zotero.Embeddings.getIndexedFieldIDs().join(',') + ")",
			itemIDs
		);
		for (let row of rows) {
			let entry = fields.get(row.itemID) || { title: '', abstract: '' };
			entry[row.fieldID === abstractFieldID ? 'abstract' : 'title'] = row.value;
			fields.set(row.itemID, entry);
		}
		for (let [itemID, { title, abstract }] of fields) {
			if (!_hasEmbeddableText(title, 2) && !_hasEmbeddableText(abstract, 2)) {
				continue;
			}
			texts.set(itemID, title && abstract ? `${title}\n\n${abstract}` : title || abstract);
		}
		rows = await Zotero.DB.queryAsync(
			"SELECT itemID, note FROM itemNotes WHERE itemID IN (" + ids + ")", itemIDs);
		for (let row of rows) {
			let text = _htmlToText(row.note, true);
			if (_hasEmbeddableText(text)) {
				texts.set(row.itemID, text);
			}
		}
		rows = await Zotero.DB.queryAsync(
			"SELECT itemID, text, comment FROM itemAnnotations WHERE itemID IN (" + ids + ")", itemIDs);
		for (let row of rows) {
			if (!_hasEmbeddableText(_getAnnotationRawText(row.text, row.comment))) {
				continue;
			}
			let text = _htmlToText(row.text);
			let comment = _htmlToText(row.comment);
			texts.set(row.itemID, text && comment ? `${text}\n\n${comment}` : text || comment || null);
		}
		return texts;
	};

	// The key the index records an attachment's file under: its path,
	// size and mtime, so checking for a change costs a stat rather than a
	// read. A changed key says the file may have changed; the rows' content
	// hash says whether it did. Null when the attachment has no readable
	// file, which also means there's nothing to extract.
	this.getAttachmentSourceKey = async function (item) {
		try {
			let path = await item.getFilePathAsync();
			if (!path) {
				return null;
			}
			let { size, lastModified } = await IOUtils.stat(path);
			return Zotero.Utilities.Internal.md5([path, size, lastModified].join('|'));
		}
		catch (e) {
			if (e.name !== 'NotFoundError') {
				Zotero.logError(e);
			}
			return null;
		}
	};

	// How many attachments never cut from a file here have no file to
	// read. Those are outstanding by definition, so in a settled library
	// this stats a handful rather than everything.
	this.countWithoutFiles = async function () {
		let missing = 0;
		let afterID = 0;
		while (true) {
			let page = await this.getOutstandingAttachments(
				afterID, Zotero.Embeddings.Indexing.ATTACHMENT_PAGE_SIZE);
			if (!page.length) {
				return missing;
			}
			for (let { item, record } of page) {
				if (!record?.sourceKey && !await this.getAttachmentSourceKey(item)) {
					missing++;
				}
			}
			afterID = page.at(-1).item.id;
		}
	};

	/**
	 * How an attachment's full text cuts into chunks: those of its structured
	 * text, each anchored in the document, or of its plain text when it has
	 * none. Waits for a current extraction rather than accepting an older
	 * processor's, so the anchors are this extractor's.
	 *
	 * @param {Zotero.Item} item - A PDF, EPUB or snapshot attachment
	 * @return {Promise<Object|null>} - { chunks, contentHash }, the hash
	 *     being the file's for structured text and the text's for plain
	 *     text; { failed: true } when the structured text is there but
	 *     couldn't be cut right now; or null when there's no embeddable
	 *     text at all
	 */
	this.getAttachmentChunks = async function (item) {
		let result = await Zotero.SDT.getItemChunks(item.id, { allowStale: false });
		// Not a verdict on the attachment: falling back to plain text here
		// would stick, since the record would then be the text's
		if (!result.ok && result.reason == 'cut-failed') {
			return { failed: true };
		}
		let chunks = result.ok ? result.chunks : [];
		// The word minimum applies to the document as a whole, not each
		// chunk: a document without three words anywhere gives the model
		// nothing to rank
		if (chunks.length && _hasEmbeddableText(chunks.map(chunk => chunk.text).join(' '))) {
			return { chunks, contentHash: result.contentHash };
		}
		Zotero.debug(`Embeddings: no structured text for ${item.libraryKey}`
			+ (result.ok ? '' : ` (${result.reason})`)
			+ ' -- falling back to plain text');
		let text;
		try {
			text = await item.attachmentText;
		}
		catch (e) {
			Zotero.logError(e);
			return null;
		}
		if (!text || !_hasEmbeddableText(text)) {
			return null;
		}
		// Plain text has no geometry: a chunk is found again by cutting the
		// text the same way and taking its index, so the chunks derive from
		// the text rather than the file
		chunks = Zotero.SDT.getPlainTextChunks(text).map(chunk => ({
			text: chunk.text,
			tokens: chunk.tokens,
			anchor: null
		}));
		return { chunks, contentHash: Zotero.Utilities.Internal.md5(text) };
	};

	/**
	 * The content hash of chunks cut from an attachment's plain text: the
	 * hash of that text, as getAttachmentChunks() records it
	 *
	 * @param {Zotero.Item} item
	 * @return {Promise<String|null>} - Null when the attachment has no text
	 */
	this.getAttachmentTextHash = async function (item) {
		try {
			let text = await item.attachmentText;
			return text ? Zotero.Utilities.Internal.md5(text) : null;
		}
		catch (e) {
			Zotero.logError(e);
			return null;
		}
	};

	// The stored text an annotation's eligibility is judged by, shared by
	// the eligibility pass and getItemTexts() so both test the same thing.
	// A cheap tag strip -- annotation text and comments carry only simple
	// inline markup.
	function _getAnnotationRawText(text, comment) {
		return [text, comment].filter(Boolean).join(' ').replace(/<\/?[a-z][^>]*>/gi, ' ');
	}

	// Built once: for scripts without spaces the segmenter is
	// dictionary-backed
	let _wordSegmenter = null;

	// Whether text has at least minWords words, counted with the locale-aware
	// segmenter so scripts without spaces (Chinese, Japanese, Thai) count at
	// their real word boundaries. Only segments with a letter count: bare
	// numbers and dates are placeholders, not content.
	function _hasEmbeddableText(text, minWords = 3) {
		text = (text || '').trim();
		if (!text) {
			return false;
		}
		if (!_wordSegmenter) {
			_wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
		}
		let count = 0;
		for (let { segment, isWordLike } of _wordSegmenter.segment(text)) {
			if (isWordLike && /\p{L}/u.test(segment)) {
				count++;
				if (count >= minWords) {
					return true;
				}
			}
		}
		return false;
	}

	// Convert stored HTML to plain text. Notes keep their block structure
	// as line breaks, so the chunker can split at paragraph boundaries;
	// annotation text and comments are inline and stripped flat, the same
	// way their display titles are built.
	function _htmlToText(html, blockBreaks = false) {
		if (!html) {
			return '';
		}
		let parserUtils = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);
		return parserUtils.convertToPlainText(
			html,
			blockBreaks
				? Ci.nsIDocumentEncoder.OutputLFLineBreak
				: Ci.nsIDocumentEncoder.OutputRaw,
			0
		).trim();
	}
};


/**
 * How far along a run is and who's told about it. Everything the preferences
 * pane reads that changes as a run goes lives here, and nothing else writes
 * it: the run announces the step it's on, and the counts are recomputed on a
 * clock rather than per item, since each costs an index scan.
 */
Zotero.Embeddings.Indexing.Progress = new function () {
	// How often a run reports progress, and how often the per-library
	// counts -- a scan of the index -- are recomputed within that
	const EMIT_INTERVAL = 1000;
	const COUNT_REFRESH_INTERVAL = 5000;

	// The step a run is on: getting the model, the items, then the steps
	// the attachments go through -- extracted, asked of the server, cut,
	// embedded here. Extracting and cutting are both 'preparing'.
	// 'idle' | 'downloading' | 'indexing' | 'fetching-documents' | 'preparing'
	// | 'indexing-documents'
	let _phase = 'idle';
	// The steps an attachment goes through. Documents in them aren't in the
	// chunk counts until they've been cut.
	const ATTACHMENT_PHASES = ['fetching-documents', 'preparing', 'indexing-documents'];
	// What the embed step has before it: the attachments and chunks it
	// embeds here, and how many of those attachments the server declined
	let _embedWork = null;
	// Bytes of the model downloaded so far, while the phase is
	// 'downloading'
	let _download = null;
	// Indexed and eligible items, notes and annotations, and the chunks
	// cut and embedded here: the local inference, not the whole of the
	// fulltext work, since the server's rows arrive whole
	let _items = { done: 0, total: 0 };
	let _chunks = { done: 0, total: 0 };
	// Attachments finished with -- every chunk embedded -- of every one
	// that will be indexed. Counted in attachments rather than chunks so it
	// reaches its total when the work does: the chunk totals only cover
	// documents cut here, and grow as more are.
	let _attachments = { done: 0, total: 0 };
	// Attachments the server was asked for and didn't answer for in the
	// last fetch, still working on them or not knowing them yet, which
	// arrive at its pace rather than the engine's
	let _awaiting = 0;
	// How far a step has got through the library's eligible attachments,
	// files or not. Preparing leaves nothing behind that counting the index
	// could see -- an extraction only fills a cache -- so the step reports
	// it.
	let _sweep = { done: 0, total: 0 };
	let _eligibleAttachments = 0;
	let _listeners = new Set();
	let _lastEmit = 0;
	let _lastCountRefresh = 0;

	this.addListener = function (fn) {
		_listeners.add(fn);
	};

	this.removeListener = function (fn) {
		_listeners.delete(fn);
	};

	// How far along a run is, for the status object the pane reads
	this.getStatus = function () {
		return {
			phase: _phase,
			downloadProgress: _download,
			// Whether attachments are moving through the pipeline, so a
			// caller can tell a complete index from one whose documents
			// aren't counted yet
			processing: ATTACHMENT_PHASES.includes(_phase),
			items: _items,
			chunks: _chunks,
			attachments: { ..._attachments, awaiting: _awaiting },
			sweep: _sweep,
			embedWork: _embedWork,
			// Seconds until the chunks cut here are embedded, at the current
			// rate. Unknown until the documents are cut, since the total is
			// still being counted.
			eta: _phase === 'preparing'
				? null
				: Zotero.Embeddings.Diagnostics.estimateSeconds(_chunks.total - _chunks.done)
		};
	};

	// Report the current status to the listeners
	this.emit = function () {
		let status = Zotero.Embeddings.Indexing.getStatus();
		for (let fn of _listeners) {
			try {
				fn(status);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
	};

	// Move to a step of the run, announcing the move
	this.setPhase = function (phase) {
		if (_phase === phase) {
			return;
		}
		_phase = phase;
		this.emit();
	};

	// The model download's progress is a percentage of the files it has
	// discovered so far, so it jumps while the small config and tokenizer
	// files are fetched and then climbs steadily through the weights,
	// which dominate the download. Reports arrive frequently, so only
	// emit on a change of at least a percentage point.
	this.onDownload = function ({ type, progress, totalLoaded, total, units }) {
		if (type !== 'downloading' || units !== 'bytes' || !total) {
			return;
		}
		let previous = _download;
		let fraction = Math.min(progress / 100, 1);
		// The first file is fetched and completed before the rest are
		// known, which reads as a complete download -- stay indeterminate
		// until there's something left to report
		if (!previous && fraction >= 1) {
			return;
		}
		_download = { loaded: totalLoaded, total, fraction };
		if (!previous || Math.abs(fraction - previous.fraction) >= 0.01) {
			this.emit();
		}
	};

	this.clearDownload = function () {
		_download = null;
	};

	// Counts after the stored index is cleared: nothing done, and no
	// chunk counts until attachments are cut again
	this.clearCounts = function () {
		_items = { done: 0, total: _items.total };
		_chunks = { done: 0, total: 0 };
		_attachments = { done: 0, total: _attachments.total };
		_awaiting = 0;
	};

	// Take the index's counts: chunks for the rate and the ETA, attachments
	// for how much of the work is behind us
	async function _readCounts() {
		let { chunks, embedded, finished } = await Zotero.Embeddings.Indexing.Store.getIndexCounts();
		_chunks = { done: embedded, total: chunks };
		_attachments = { done: finished, total: _attachments.total };
	}

	// A fetch starting, and then each batch of it: how many of the
	// attachments asked for the server didn't answer for
	this.resetAwaiting = function () {
		_awaiting = 0;
	};

	this.addAwaiting = function (count) {
		_awaiting += count;
	};

	// How far through the library's attachments a step has got, against
	// how many there are: what the pane shows while documents are prepared
	// or asked of the server
	this.setSweep = function (position) {
		_sweep = { done: position, total: _eligibleAttachments };
	};

	// What the embed step has before it
	//
	// @param {Object} work - { own, ownChunks, declined }
	this.setEmbedWork = function ({ own = 0, ownChunks = 0, declined = 0 }) {
		_embedWork = { own, ownChunks, declined };
	};

	// More before the embed step, as each page of it is read
	//
	// @param {Object} work - { own, ownChunks, declined }, each added to
	//     what's counted
	this.addEmbedWork = function ({ own = 0, ownChunks = 0, declined = 0 }) {
		if (_embedWork) {
			_embedWork = {
				own: _embedWork.own + own,
				ownChunks: _embedWork.ownChunks + ownChunks,
				declined: _embedWork.declined + declined
			};
		}
	};

	this.startRun = function () {
		_lastEmit = 0;
	};

	// A run's end, however it ended: back to idle, and one last report of
	// what's stored, so a run cut short by a stop or an error still says
	// where it got to
	this.endRun = async function () {
		let Store = Zotero.Embeddings.Indexing.Store;
		_phase = 'idle';
		_download = null;
		_sweep = { done: 0, total: 0 };
		_embedWork = null;
		try {
			await _readCounts();
			_items = { done: await Store.getIndexedItemCount(), total: _items.total };
		}
		catch (e) {
			Zotero.logError(e);
		}
		this.emit();
	};

	// Progress tick for a run's inner loops: refresh the chunk counts and
	// emit, at most once per EMIT_INTERVAL. The indexed item count and
	// chunk shape each cost an index scan, so they're recomputed less
	// often; the eligible count comes from the last full refresh.
	this.tick = async function () {
		let Store = Zotero.Embeddings.Indexing.Store;
		let now = Date.now();
		if (now - _lastEmit < EMIT_INTERVAL) {
			return;
		}
		_lastEmit = now;
		try {
			await _readCounts();
			if (now - _lastCountRefresh >= COUNT_REFRESH_INTERVAL) {
				_lastCountRefresh = now;
				_items = { done: await Store.getIndexedItemCount(), total: _items.total };
				await Zotero.Embeddings.Diagnostics.refreshChunkShape();
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		this.emit();
	};

	// Recompute every count and report. The eligibility pass makes this
	// the expensive refresh, for the pane opening and a run's ends; a run
	// in progress ticks instead.
	this.refresh = async function () {
		let { Store, Sources } = Zotero.Embeddings.Indexing;
		// Don't create and attach the embeddings database just to report
		// a disabled state (e.g. when the Advanced preferences pane opens)
		if (!Zotero.Embeddings.isEnabled()) {
			this.emit();
			return;
		}
		await Zotero.Embeddings.initDB();
		let items = await Sources.getEligibleItemIDs();
		_items = { done: await Store.getIndexedItemCount(), total: items.length };
		// An attachment that's never been cut and has no file to cut can't
		// be indexed at all, so it isn't work left to do -- counting it
		// would leave the total forever out of reach
		_eligibleAttachments = await Sources.countEligibleAttachments();
		let total = _eligibleAttachments - await Sources.countWithoutFiles();
		_attachments = { done: _attachments.done, total };
		await _readCounts();
		await Zotero.Embeddings.Diagnostics.refreshChunkShape();
		_lastCountRefresh = Date.now();
		this.emit();
	};
};


/**
 * What indexing stores, and the only code that writes it: a row per chunk
 * with its vector and anchor, and a state row per item the index knows
 * about -- what its rows were made from, and its standing with the server.
 * Counts are never stored; they're read off the rows.
 */
Zotero.Embeddings.Indexing.Store = new function () {
	// itemIDs per query, under SQLite's bound-parameter limit
	const BATCH_SIZE = 500;

	let batches = itemIDs => Array.from(
		{ length: Math.ceil(itemIDs.length / BATCH_SIZE) },
		(_, i) => itemIDs.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
	);
	let placeholders = batch => batch.map(() => '?').join(',');

	// Rows

	// Store one chunk's vector and, when the chunk has one at this point,
	// its anchor -- filling in the chunk's row if it was cut without a
	// vector. The vector is already in the form the table holds -- centered
	// on the model's mean and quantized to int8 -- so that a row made here
	// and one made by another client take the same path in.
	//
	// @param {Int8Array} stored - Zotero.Embeddings.prepare()'s output
	this.insertRow = async function (itemID, chunkIndex, stored, anchor = null) {
		let blob = new Uint8Array(stored.buffer, stored.byteOffset, stored.byteLength);
		// Keep the embedding blob out of debug output
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding, anchor) "
				+ "VALUES (?, ?, ?, ?)",
			[itemID, chunkIndex, blob, anchor ? Zotero.Embeddings.Indexing.compactAnchor(anchor) : null],
			{ debugParams: false }
		);
	};

	// Store a cut chunk without its vector, leaving a row it already has --
	// embedded or not -- as it is
	this.insertPendingRow = async function (itemID, chunkIndex, anchor = null) {
		await Zotero.DB.queryAsync(
			"INSERT OR IGNORE INTO embeddings.itemEmbeddings (itemID, chunkIndex, embedding, anchor) "
				+ "VALUES (?, ?, NULL, ?)",
			[itemID, chunkIndex, anchor ? Zotero.Embeddings.Indexing.compactAnchor(anchor) : null],
			{ debugParams: false }
		);
	};

	// Delete an item's rows from the given chunk on
	this.deleteRows = async function (itemID, fromChunkIndex = 0) {
		await Zotero.DB.queryAsync(
			"DELETE FROM embeddings.itemEmbeddings WHERE itemID=? AND chunkIndex>=?",
			[itemID, fromChunkIndex]
		);
	};

	// The chunks an item has vectors for
	this.getEmbeddedIndexes = async function (itemID) {
		return new Set(await Zotero.DB.columnQueryAsync(
			"SELECT chunkIndex FROM embeddings.itemEmbeddings WHERE itemID=? AND embedding IS NOT NULL", itemID));
	};

	// The recorded content hash of each of the given items that has one
	this.getStoredHashes = async function (itemIDs) {
		let hashes = new Map();
		for (let batch of batches(itemIDs)) {
			let rows = await Zotero.DB.queryAsync(
				"SELECT itemID, contentHash FROM embeddings.itemIndexState "
					+ "WHERE itemID IN (" + placeholders(batch) + ")",
				batch
			);
			for (let row of rows) {
				hashes.set(row.itemID, row.contentHash);
			}
		}
		return hashes;
	};

	// Indexed items, notes and annotations; an item's chunks count as one
	// item
	this.getIndexedItemCount = async function () {
		return Zotero.DB.valueQueryAsync(
			"SELECT COUNT(DISTINCT itemID) FROM embeddings.itemEmbeddings "
				+ "JOIN items USING (itemID) WHERE itemTypeID!=?",
			Zotero.ItemTypes.getID('attachment')
		);
	};

	// Index state

	// The state rows of the given items, as itemID -> { itemID, sourceKey,
	// contentHash, extractor, clientDateModified, syncVersion, syncDeclined,
	// syncShouldRefresh }
	this.getIndexStates = async function (itemIDs) {
		let records = new Map();
		for (let batch of batches(itemIDs)) {
			let rows = await Zotero.DB.queryAsync(
				"SELECT itemID, sourceKey, contentHash, extractor, clientDateModified, "
					+ "syncVersion, syncDeclined, syncShouldRefresh "
					+ "FROM embeddings.itemIndexState "
					+ "WHERE itemID IN (" + placeholders(batch) + ")",
				batch
			);
			for (let row of rows) {
				records.set(row.itemID, row);
			}
		}
		return records;
	};

	// Record what an item's rows were made from -- for the server's rows,
	// the version they're from -- and the stamp it was seen in, clearing
	// any field not given. The server's refusal and refresh marks are left
	// as they are.
	this.setSource = async function (itemID, { sourceKey = null, contentHash = null, extractor = null, syncVersion = null, clientDateModified = null }) {
		await Zotero.DB.queryAsync(
			"INSERT INTO embeddings.itemIndexState "
				+ "(itemID, sourceKey, contentHash, extractor, syncVersion, clientDateModified) "
				+ "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (itemID) DO UPDATE SET "
				+ "sourceKey = excluded.sourceKey, contentHash = excluded.contentHash, "
				+ "extractor = excluded.extractor, syncVersion = excluded.syncVersion, "
				+ "clientDateModified = excluded.clientDateModified",
			[itemID, sourceKey, contentHash, extractor, syncVersion, clientDateModified]
		);
	};

	// Forget the state attachments were seen in, so the next run looks at
	// every one of them
	this.clearAttachmentStamps = async function () {
		await Zotero.DB.queryAsync(
			"UPDATE embeddings.itemIndexState SET clientDateModified=NULL "
				+ "WHERE itemID IN (SELECT itemID FROM itemAttachments)"
		);
	};

	// Record the state each item was seen in, leaving the rest of its
	// record as it is; an item with no record gets one with nothing else
	// in it, which says it was looked at and had nothing to index
	//
	// @param {Object[]} entries - [{ itemID, clientDateModified }]
	this.stampItems = async function (entries) {
		const BATCH = 200;
		for (let i = 0; i < entries.length; i += BATCH) {
			let batch = entries.slice(i, i + BATCH);
			await Zotero.DB.queryAsync(
				"INSERT INTO embeddings.itemIndexState (itemID, clientDateModified) VALUES "
					+ batch.map(() => '(?, ?)').join(',')
					+ " ON CONFLICT (itemID) DO UPDATE SET clientDateModified = excluded.clientDateModified",
				batch.flatMap(entry => [entry.itemID, entry.clientDateModified])
			);
		}
	};

	// The fulltext work: the chunks of attachments cut here and how many
	// have vectors, and how many attachments with a file here have every
	// chunk embedded, whoever embedded it
	//
	// @return {Promise<Object>} - { chunks, embedded, finished }
	this.getIndexCounts = async function () {
		let fromCut = "FROM embeddings.itemEmbeddings E "
			+ "JOIN embeddings.itemIndexState S USING (itemID) WHERE S.extractor IS NOT NULL";
		let chunks = await Zotero.DB.valueQueryAsync("SELECT COUNT(*) " + fromCut);
		let pending = await Zotero.DB.valueQueryAsync(
			"SELECT COUNT(*) " + fromCut + " AND E.embedding IS NULL");
		let finished = await Zotero.DB.valueQueryAsync(
			"SELECT COUNT(*) FROM embeddings.itemIndexState S WHERE S.sourceKey IS NOT NULL "
				+ "AND NOT EXISTS (SELECT 1 FROM embeddings.itemEmbeddings E "
				+ "WHERE E.itemID=S.itemID AND E.embedding IS NULL)"
		);
		return { chunks, embedded: chunks - pending, finished };
	};

	// Sync state

	// Mark the given attachments' rows to be fetched again, the server
	// having embedded them anew -- which also makes a new ask of any it
	// declined before
	this.setSyncRefresh = async function (itemIDs) {
		for (let batch of batches(itemIDs)) {
			await Zotero.DB.queryAsync(
				"INSERT INTO embeddings.itemIndexState (itemID, syncShouldRefresh) VALUES "
					+ batch.map(() => '(?, 1)').join(',')
					+ " ON CONFLICT (itemID) DO UPDATE SET syncShouldRefresh = 1, syncDeclined = NULL",
				batch
			);
		}
	};

	// Meta

	// The model every stored vector is from, or null with nothing recorded
	this.getIndexedModelVersion = async function () {
		let value = await Zotero.DB.valueQueryAsync(
			"SELECT value FROM embeddings.embeddingsMeta WHERE key='modelVersion'");
		return value || null;
	};

	this.setIndexedModelVersion = async function (modelVersion) {
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.embeddingsMeta (key, value) VALUES ('modelVersion', ?)",
			[modelVersion]
		);
	};

	// The server's version of a library's embeddings as of this client's
	// last look at what changed, or null
	this.getSyncVersion = async function (libraryID) {
		let value = await Zotero.DB.valueQueryAsync(
			"SELECT value FROM embeddings.embeddingsMeta WHERE key=?", ['embeddingsVersion:' + libraryID]);
		return value ? parseInt(value) : null;
	};

	this.setSyncVersion = async function (libraryID, version) {
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.embeddingsMeta (key, value) VALUES (?, ?)",
			['embeddingsVersion:' + libraryID, version]
		);
	};

	// Rows arrived from the server, or the file changed: forget the
	// attachment's standing with the server
	this.clearSyncState = async function (itemID) {
		await Zotero.DB.queryAsync(
			"UPDATE embeddings.itemIndexState SET syncDeclined = NULL, syncShouldRefresh = 0 "
				+ "WHERE itemID=?",
			itemID
		);
	};

	// The server has nothing for the given attachments, which answers any
	// refresh standing on them
	this.setSyncDeclined = async function (itemIDs) {
		let now = Date.now();
		for (let batch of batches(itemIDs)) {
			await Zotero.DB.queryAsync(
				"INSERT INTO embeddings.itemIndexState (itemID, syncDeclined) VALUES "
					+ batch.map(() => '(?, ?)').join(',')
					+ " ON CONFLICT (itemID) DO UPDATE SET syncDeclined = excluded.syncDeclined, "
					+ "syncShouldRefresh = 0",
				batch.flatMap(itemID => [itemID, now])
			);
		}
	};

	// Across the tables

	// Everything stored, with where its item is -- no library for one
	// that's gone
	//
	// @return {Promise<Object[]>} - [{ itemID, libraryID }]
	this.getStoredItems = async function () {
		return Zotero.DB.queryAsync(
			"SELECT S.itemID, I.libraryID "
				+ "FROM (SELECT itemID FROM embeddings.itemEmbeddings "
					+ "UNION SELECT itemID FROM embeddings.itemIndexState) S "
				+ "LEFT JOIN items I USING (itemID)"
		);
	};

	// Delete everything stored for the given items
	this.deleteItems = async function (itemIDs) {
		await Zotero.Embeddings.initDB();
		for (let batch of batches(itemIDs)) {
			for (let table of ['itemEmbeddings', 'itemIndexState']) {
				await Zotero.DB.queryAsync(
					`DELETE FROM embeddings.${table} WHERE itemID IN (${placeholders(batch)})`,
					batch
				);
			}
		}
	};

	// Delete everything stored. This removes the computed vectors, not
	// the downloaded model files.
	this.clear = async function () {
		await Zotero.Embeddings.initDB();
		for (let table of ['itemEmbeddings', 'itemIndexState']) {
			await Zotero.DB.queryAsync(`DELETE FROM embeddings.${table}`);
		}
		await Zotero.DB.queryAsync(
			"DELETE FROM embeddings.embeddingsMeta WHERE key LIKE ?", ['embeddingsVersion:%']);
	};
};


/**
 * The machine's say in how a run goes: how much text the engine gets per
 * call, whether there's memory to start at all, when the engine may run at
 * full thread count, when it's restarted to give memory back, and how work
 * that has to happen on the main thread is paced against the idle time there
 * is. Nothing here knows what's being indexed.
 */
Zotero.Embeddings.Indexing.Runtime = new function () {
	// Tokens of text per engine call, in the model's own tokens -- what
	// the engine pads a batch to and what its memory scales with. Under
	// memory pressure this is halved, down to DEGRADED_TOKEN_BUDGET_FLOOR,
	// and the engine is shut down so the next one's memory arena grows
	// only to the smaller peak. Restored when the pressure lifts.
	const DEFAULT_TOKEN_BUDGET = 3000;
	const DEGRADED_TOKEN_BUDGET_FLOOR = 400;
	let _tokenBudget = DEFAULT_TOKEN_BUDGET;
	// A remote server's cost is mostly the round trip, so its batches are
	// this many times the local budget; a failed one embeds locally in parts
	const REMOTE_BUDGET_FACTOR = 3;

	// Don't start a run that would load the model with less than this
	// much memory available, since inference needs room well beyond the
	// model files
	const MIN_AVAILABLE_MEMORY = 1.5 * 1024 * 1024 * 1024;

	// The inference process's memory arena only grows: fragmentation from
	// varying batch shapes accumulates and is never returned to the OS
	// (~650 MB/min measured), while throughput stays flat however large
	// it gets. Restarting the engine is the only reclaim and costs about
	// a second, so past this footprint it's restarted between batches.
	const INFERENCE_MEMORY_CAP = 1.5 * 1024 * 1024 * 1024;
	// Time of the process sample the last cap restart acted on, so each
	// sample triggers at most one
	let _restartedOnSample = 0;

	// Boost the engine's threads while the user is away from the machine,
	// watched only during a run
	const IDLE_BOOST_SECONDS = 300;
	let _watchingIdle = false;

	// The most tokens the next engine call should carry. Read per batch:
	// memory pressure can shrink it between chunks, and the endpoint can
	// drop out mid-run.
	this.getTokenBudget = function () {
		return _tokenBudget
			* (Zotero.Embeddings.Endpoint.isRemoteActive() ? REMOTE_BUDGET_FACTOR : 1);
	};

	// Whether there's enough memory available to load the model and run
	// inference. The runtime's own check is against total system memory,
	// which says nothing about what's free right now.
	this.hasMemoryToIndex = function () {
		let available = Zotero.Embeddings.Diagnostics.getAvailableMemory();
		if (available && available < MIN_AVAILABLE_MEMORY) {
			Zotero.debug(`Embeddings: only ${Math.round(available / 1024 / 1024)} MB `
				+ "available -- not indexing yet");
			return false;
		}
		return true;
	};

	// Restart the engine between batches when it has to be: past the
	// memory cap, or created with a thread count that has since changed.
	// Never mid-request.
	this.restartEngineIfDue = async function () {
		let sample = Zotero.Embeddings.Diagnostics.getProcessSample();
		if (sample?.inference?.memory > INFERENCE_MEMORY_CAP
				&& sample.time !== _restartedOnSample) {
			_restartedOnSample = sample.time;
			let footprintMB = Math.round(sample.inference.memory / 1024 / 1024);
			await Zotero.Embeddings.shutdownEngine();
			Zotero.Embeddings.Diagnostics.recordRestart('memory');
			Zotero.debug(`Embeddings: inference process at ${footprintMB} MB `
				+ '-- engine restarted to release its memory');
		}
		else if (Zotero.Embeddings.engineThreadsStale()) {
			await Zotero.Embeddings.shutdownEngine();
			Zotero.Embeddings.Diagnostics.recordRestart('threads');
			Zotero.debug('Embeddings: engine restarted to apply new thread count');
		}
	};

	// Watch for the user going idle for the length of a run
	this.startRun = function () {
		if (_watchingIdle) {
			return;
		}
		_watchingIdle = true;
		let idleService = Cc["@mozilla.org/widget/useridleservice;1"]
			.getService(Ci.nsIUserIdleService);
		idleService.addIdleObserver(_idleObserver, IDLE_BOOST_SECONDS);
		// Already away when the run starts
		if (idleService.idleTime >= IDLE_BOOST_SECONDS * 1000) {
			Zotero.Embeddings.setThreadBoost('user-idle', true);
		}
	};

	this.endRun = function () {
		if (!_watchingIdle) {
			return;
		}
		_watchingIdle = false;
		Cc["@mozilla.org/widget/useridleservice;1"]
			.getService(Ci.nsIUserIdleService)
			.removeIdleObserver(_idleObserver, IDLE_BOOST_SECONDS);
		Zotero.Embeddings.setThreadBoost('user-idle', false);
	};

	// What the machine is letting the engine have, for diagnostics
	this.getStatus = function () {
		return {
			tokenBudget: _tokenBudget,
			engine: {
				threads: Zotero.Embeddings.getEngineThreads(),
				optimalThreads: Zotero.ML.getOptimalConcurrency(),
				boosts: Zotero.Embeddings.getThreadBoosts()
			}
		};
	};

	let _idleObserver = {
		observe: (subject, topic) => {
			Zotero.Embeddings.setThreadBoost('user-idle', topic === 'idle');
		}
	};

	// Inference memory is dominated by the padded text in each batch, so
	// memory pressure shrinks the batches rather than stopping: indexing
	// keeps making progress, just more slowly. The engine is shut down at
	// the same time, both to release its memory now and because its arena
	// never shrinks -- only a new engine picks up the smaller budget.
	let _memoryPressureObserver = {
		observe: (subject, topic) => {
			if (topic === 'memory-pressure-stop') {
				if (_tokenBudget !== DEFAULT_TOKEN_BUDGET) {
					Zotero.debug("Embeddings: memory pressure over -- restoring batch size");
					_tokenBudget = DEFAULT_TOKEN_BUDGET;
				}
				return;
			}
			Zotero.Embeddings.Diagnostics.recordMemoryPressure();
			if (_tokenBudget <= DEGRADED_TOKEN_BUDGET_FLOOR) {
				return;
			}
			_tokenBudget = Math.max(
				DEGRADED_TOKEN_BUDGET_FLOOR, Math.floor(_tokenBudget / 2)
			);
			Zotero.debug(`Embeddings: memory pressure -- batch size reduced to `
				+ `${_tokenBudget} tokens`);
			Zotero.Embeddings.shutdownEngine()
				.catch(e => Zotero.logError(e));
		},
	};
	Services.obs.addObserver(_memoryPressureObserver, 'memory-pressure');
	Services.obs.addObserver(_memoryPressureObserver, 'memory-pressure-stop');
};


/**
 * Pipeline diagnostics, reported through Indexing.getStatus().
 * Indexing records what happens -- engine batches, restarts, memory
 * pressure, process samples, the slice in progress -- and this turns it
 * into rates and shape summaries. Tokens are the chunker's estimates.
 */
Zotero.Embeddings.Diagnostics = new function () {
	// Throughput window: at least a slice, since the in-slice length sort
	// makes shorter windows swing
	const RATE_WINDOW = 120 * 1000;
	// A window this long is trusted for estimates
	const ESTABLISHED_WINDOW = 30 * 1000;
	// How often the main and inference processes are sampled during a run
	const PROC_SAMPLE_INTERVAL = 10 * 1000;
	let _samples = [];
	let _run = _newRun();
	let _slice = null;
	let _chunkShape = null;
	let _pressureEvents = 0;
	let _procTimer = null;
	let _procCpuTimes = new Map();
	let _procLastSample = 0;
	let _processSample = null;

	function _newRun() {
		return {
			batches: 0,
			chunks: 0,
			tokens: 0,
			padded: 0,
			inferenceMs: 0,
			restarts: { memory: 0, threads: 0 }
		};
	}

	// Reset everything scoped to one indexing run and start sampling the
	// processes
	this.startRun = function () {
		_samples = [];
		_run = _newRun();
		_pressureEvents = 0;
		_slice = null;
		if (!_procTimer) {
			_procCpuTimes = new Map();
			_procLastSample = 0;
			_procTimer = setInterval(
				() => _sampleProcesses().catch(e => Zotero.logError(e)),
				PROC_SAMPLE_INTERVAL
			);
		}
	};

	this.endRun = function () {
		_slice = null;
		if (_procTimer) {
			clearInterval(_procTimer);
			_procTimer = null;
		}
	};

	// Throughput over the last RATE_WINDOW, wall-clock -- so it includes
	// commits and restarts -- or null before the first batch
	function _getWindow() {
		if (!_samples.length) {
			return null;
		}
		let sum = key => _samples.reduce((total, sample) => total + sample[key], 0);
		let span = Date.now() - _samples[0].time;
		let seconds = Math.max(1, span / 1000);
		let tokens = sum('tokens');
		return {
			chunksPerSecond: sum('chunks') / seconds,
			tokensPerSecond: tokens / seconds,
			paddingEfficiency: tokens / (sum('padded') || 1),
			established: span >= ESTABLISHED_WINDOW
		};
	}

	// Seconds to embed `remaining` chunks at the window's rate, or null when
	// there's nothing left or the window isn't established
	this.estimateSeconds = function (remaining) {
		let window = _getWindow();
		if (!window?.established || remaining <= 0) {
			return null;
		}
		return remaining / window.chunksPerSecond;
	};

	// The last process sample: { time, available, main: { memory, cpu },
	// inference: { memory, cpu } }, with memory in bytes and CPU in
	// core-fractions (several busy threads read over 100%). Null before the
	// first sample of a run; inference is absent when no engine is up.
	this.getProcessSample = function () {
		return _processSample;
	};

	// Physical memory available right now, in bytes -- 0 when the platform
	// can't say
	this.getAvailableMemory = function () {
		try {
			return Cc["@mozilla.org/ml-utils;1"]
				.getService(Ci.nsIMLUtils)
				.availablePhysicalMemory || 0;
		}
		catch (e) {
			Zotero.logError(e);
			return 0;
		}
	};


	async function _sampleProcesses() {
		let info = await ChromeUtils.requestProcInfo();
		let now = Date.now();
		let elapsedNS = _procLastSample ? (now - _procLastSample) * 1e6 : 0;
		_procLastSample = now;
		let inference = info.children.find(child => child.type == 'inference');
		let procs = [
			{ label: 'main', pid: info.pid, memory: info.memory, cpuTime: info.cpuTime }
		];
		if (inference) {
			procs.push({
				label: 'inference',
				pid: inference.pid,
				memory: inference.memory,
				cpuTime: inference.cpuTime
			});
		}
		let sample = { time: now, available: Zotero.Embeddings.Diagnostics.getAvailableMemory() };
		for (let proc of procs) {
			let prev = _procCpuTimes.get(proc.pid);
			_procCpuTimes.set(proc.pid, proc.cpuTime);
			sample[proc.label] = {
				memory: proc.memory,
				cpu: prev !== undefined && elapsedNS
					? Math.round((proc.cpuTime - prev) / elapsedNS * 100)
					: null
			};
		}
		_processSample = sample;
	}

	// A slice of `total` chunks is about to be embedded
	this.startSlice = function (total) {
		_slice = { done: 0, total };
	};

	// Record an engine batch that finished at `time` (now by default). Padded
	// tokens are what the engine computed: every text as long as the longest.
	this.recordBatch = function ({ chunks, tokens, longest, inferenceMs, time = Date.now() }) {
		let sample = { time, chunks, tokens, padded: chunks * longest, inferenceMs };
		_samples.push(sample);
		while (_samples.length && _samples[0].time < sample.time - RATE_WINDOW) {
			_samples.shift();
		}
		_run.batches++;
		_run.chunks += chunks;
		_run.tokens += tokens;
		_run.padded += sample.padded;
		_run.inferenceMs += inferenceMs;
		if (_slice) {
			_slice.done += chunks;
		}
	};

	// @param {String} cause - 'memory' or 'threads'
	this.recordRestart = function (cause) {
		_run.restarts[cause]++;
	};

	this.recordMemoryPressure = function () {
		_pressureEvents++;
	};

	// Recount the chunk shape from the database
	this.refreshChunkShape = async function () {
		_chunkShape = await _getChunkShape();
	};

	// The window is wall-clock throughput; the run's inference speed counts
	// only time inside the engine, so the gap between them is overhead.
	this.getStatus = function () {
		let window = _getWindow();
		let run = null;
		if (_run.batches) {
			let seconds = Math.max(0.001, _run.inferenceMs / 1000);
			run = {
				chunksPerSecond: _run.chunks / seconds,
				tokensPerSecond: _run.tokens / seconds,
				paddingEfficiency: _run.tokens / (_run.padded || 1),
				batches: _run.batches,
				chunksPerBatch: _run.chunks / _run.batches,
				tokensPerBatch: _run.tokens / _run.batches
			};
		}
		return {
			window,
			run,
			restarts: _run.restarts,
			pressureEvents: _pressureEvents,
			processes: _processSample,
			slice: _slice,
			chunks: _chunkShape
		};
	};

	// The shape of the stored attachment chunking -- rows per document with
	// a file here, those cut to nothing included -- for judging the
	// chunker's output
	async function _getChunkShape() {
		let perDocument = "(SELECT S.itemID, COUNT(E.itemID) AS chunks "
			+ "FROM embeddings.itemIndexState S "
			+ "LEFT JOIN embeddings.itemEmbeddings E USING (itemID) "
			+ "WHERE S.sourceKey IS NOT NULL GROUP BY S.itemID)";
		let documentBounds = [1, 11, 51, 201];
		let bucketSQL = (column, bounds) => bounds.map((bound, i) => (i
			? `SUM(${column} >= ${bounds[i - 1]} AND ${column} < ${bound}) AS b${i}`
			: `SUM(${column} < ${bound}) AS b0`
		)).concat(`SUM(${column} >= ${bounds[bounds.length - 1]}) AS b${bounds.length}`).join(', ');
		let buckets = (row, bounds) => bounds.map((bound, i) => ({
			from: i ? bounds[i - 1] : null,
			to: bound,
			count: row[`b${i}`] || 0
		})).concat({ from: bounds[bounds.length - 1], to: null, count: row[`b${bounds.length}`] || 0 });
		let median = async (sql, count) => (count
			? Zotero.DB.valueQueryAsync(sql + " LIMIT 1 OFFSET " + Math.floor(count / 2))
			: 0);

		let documents = await Zotero.DB.rowQueryAsync(
			"SELECT COUNT(*) AS count, COALESCE(SUM(chunks), 0) AS chunks, "
				+ "COALESCE(MAX(chunks), 0) AS max, " + bucketSQL('chunks', documentBounds)
				+ " FROM " + perDocument
		);
		return {
			perDocument: {
				count: documents.count,
				mean: documents.count ? documents.chunks / documents.count : 0,
				median: await median(
					"SELECT chunks FROM " + perDocument + " ORDER BY chunks",
					documents.count),
				max: documents.max,
				buckets: buckets(documents, documentBounds)
			}
		};
	}
};


/**
 * Zotero.Embeddings.Calibration -- a model's scoring numbers, measured over
 * triples of a query, a passage that answers it, and a near miss: the mean of
 * the passages, the floor at a percentile of near-miss scores, and the bar's
 * ceiling at one of passage scores. Run record() by hand when the model or
 * its revision changes.
 */
Zotero.Embeddings.Calibration = new function () {
	// Where the score floor goes, as a percentile of the near-miss scores --
	// what this model gives a query against same-field text that doesn't
	// answer it. At 0.95 one near miss in twenty still clears the floor;
	// raising it cuts more of them, and more weak-but-real matches along
	// with them.
	const MISS_PERCENTILE = 0.95;
	// Where the Relevance bar fills, as a percentile of the passage scores,
	// each query against the passage that answers it. At 0.5 a full bar means
	// "as good as this model's typical real match".
	const MATCH_PERCENTILE = 0.5;
	// Texts per engine call while calibrating, matching the indexer's largest
	// batch
	const BATCH_SIZE = 20;

	/**
	 * The languages the corpus is written in. `other` collects languages with
	 * no code of their own.
	 */
	this.languages = Object.freeze({ en: 'en', zh: 'zh', other: 'other' });

	// Triples by language: a query someone might type, the chunk-length
	// passage it finds, and a same-length near miss from the same field. A
	// language wants enough triples for the percentiles to land on a settled
	// stretch of their distributions.
	const CORPUS_URL = 'resource://zotero/embeddings-calibration-corpus.json';
	let _corpus = null;

	function _getCorpusData() {
		if (!_corpus) {
			_corpus = JSON.parse(Zotero.File.getResource(CORPUS_URL));
		}
		return _corpus;
	}

	/**
	 * The triples the model is measured against: every language's, since the
	 * model is multilingual.
	 *
	 * @return {Object[]} - { query, passage, nearMiss } triples
	 */
	this.getCorpus = function () {
		return Object.values(_getCorpusData()).flat();
	};

	/**
	 * Run the active model over its corpus and derive its three numbers: the
	 * mean of the passage embeddings, and the two ends of the score band, read
	 * off the distributions of matched and near-miss scores.
	 *
	 * @return {Promise<Object>} - { mean, minScore, maxDisplayScore }
	 */
	this.measure = async function () {
		let triples = this.getCorpus();
		let queryPrefix = Zotero.Embeddings.getQueryPrefix();
		let passagePrefix = Zotero.Embeddings.getPassagePrefix();
		Zotero.debug(`Embeddings: measuring against ${triples.length} `
			+ `query/passage/near-miss triples`);
		let queries = await _embedAll(triples.map(triple => queryPrefix + triple.query));
		let passages = await _embedAll(triples.map(triple => passagePrefix + triple.passage));
		let nearMisses = await _embedAll(triples.map(triple => passagePrefix + triple.nearMiss));

		// The direction every embedding shares, which says nothing about the
		// text. Taken over the passages: chunk-length text is most of what
		// gets stored, and shows the direction most purely
		let mean = new Float32Array(passages[0].length);
		for (let vector of passages) {
			for (let d = 0; d < mean.length; d++) {
				mean[d] += vector[d] / passages.length;
			}
		}

		// Scoring compares centered, quantized vectors, so calibrate on those,
		// using the same transform and comparison the search path uses
		let prepare = vector => Zotero.Embeddings.quantize(Zotero.Embeddings.center(vector, mean));
		queries = queries.map(prepare);
		let scores = vectors => vectors.map(
			(vector, i) => Zotero.Embeddings.cosine(queries[i], prepare(vector))
		);
		let matched = scores(passages);
		let missed = scores(nearMisses);
		let minScore = _percentile(missed, MISS_PERCENTILE);
		let maxDisplayScore = _percentile(matched, MATCH_PERCENTILE);
		let inverted = matched.filter((score, i) => score <= missed[i]).length;
		Zotero.debug(`Embeddings: ${inverted} of ${triples.length} near misses `
			+ `score at least as high as their passage`);
		// A model that rates its matches no higher than near misses can't rank
		// anything, and every score it produced would clamp to a full or empty
		// bar. Better to fail loudly than to index with it.
		if (maxDisplayScore <= minScore) {
			throw new Error(`Model '${Zotero.Embeddings.getModelName()}' scores matched text `
				+ `(${maxDisplayScore.toFixed(4)}) no higher than near misses `
				+ `(${minScore.toFixed(4)}) -- it can't rank search results`);
		}
		return { mean, minScore, maxDisplayScore };
	};

	/**
	 * measure(), formatted for MODEL's `calibration` entry.
	 *
	 * @return {Promise<Object>} - { minScore, maxDisplayScore, mean }, the
	 *     mean as base64
	 */
	this.record = async function () {
		let { mean, minScore, maxDisplayScore } = await this.measure();
		let bytes = new Uint8Array(mean.buffer, mean.byteOffset, mean.byteLength);
		return { minScore, maxDisplayScore, mean: btoa(String.fromCharCode(...bytes)) };
	};

	async function _embedAll(texts) {
		let vectors = [];
		for (let i = 0; i < texts.length; i += BATCH_SIZE) {
			vectors.push(...await Zotero.Embeddings.embedMany(texts.slice(i, i + BATCH_SIZE)));
		}
		return vectors;
	}

	// The value a given fraction of the way through a distribution, with 0 the
	// smallest value and 1 the largest
	function _percentile(values, fraction) {
		let sorted = Float64Array.from(values).sort();
		return sorted[Math.round(fraction * (sorted.length - 1))];
	}
};


/**
 * Zotero.Embeddings.Endpoint -- embedding passages through a server that
 * serves the active model. A server is trusted only once its vectors match
 * the local model's: verify() embeds fixed texts both ways and stores the
 * verdict for the URL, model version and request format. Each batch carries
 * a sentinel text that catches a server that stops matching.
 */
Zotero.Embeddings.Endpoint = new function () {
	// Least per-text cosine between served and local vectors for the two to
	// count as the same model.
	const AGREEMENT_MIN = 0.98;
	// Request formats verify() tries, in order
	const FORMATS = ['openai', 'tei'];
	// Texts the probe embeds both ways, drawn from the calibration corpus:
	// queries for short text, passages for chunk-length
	const PROBE_QUERIES = 8;
	const PROBE_PASSAGES = 12;
	// The probe's longest text, in characters -- a chunk near the indexer's
	// worst case, so a server whose window is too small for real chunks is
	// found out here rather than mid-run
	const PROBE_PADDED_CHARS = 8000;
	// Context and batch size baked into the command shown to the user, for
	// the same reason
	const SERVER_CONTEXT = 4096;
	// Consecutive failed requests before the endpoint is left alone for the
	// rest of the run, rather than waiting out a timeout per batch
	const MAX_FAILURES = 3;
	const META_KEY = 'endpoint';

	// The stored verdict: undefined until read, null when there is none
	let _verdict;
	// The sentinel text and its local vector, for the active model version
	let _sentinel = null;
	// Consecutive failed requests
	let _failures = 0;
	// Whether the endpoint is being skipped for the rest of this run
	let _suspended = false;

	// A 2xx response that isn't an embeddings response for the inputs sent
	class ResponseError extends Error {}

	/**
	 * Whether the model can be served at all
	 * @return {Boolean}
	 */
	this.isSupported = function () {
		return !!Zotero.Embeddings.getServing();
	};

	/**
	 * The llama.cpp command that serves the active model with the settings
	 * its vectors depend on, and the URL it serves at.
	 *
	 * @return {Object|null} - { command, url }, or null for a model that
	 *     can't be served
	 */
	this.getCommand = function () {
		let serving = Zotero.Embeddings.getServing();
		if (!serving) {
			return null;
		}
		return {
			command: `llama serve -hf ${serving.gguf}:${serving.quant} --embeddings `
				+ `--pooling ${Zotero.Embeddings.getPooling()} `
				+ `-c ${SERVER_CONTEXT} -ub ${SERVER_CONTEXT} -b ${SERVER_CONTEXT} --port 8080`,
			url: 'http://localhost:8080/v1/embeddings'
		};
	};

	/**
	 * Embed a fixed set of texts locally and through the endpoint, compare
	 * them, and store the verdict for the current model version.
	 *
	 * @param {String} url
	 * @return {Promise<Object>} - { state, url, modelVersion, format,
	 *     serverModel, agreement, time }. state is 'ok', or why not:
	 *     'unreachable' (no usable response), 'unauthorized' (the server
	 *     wants credentials, which aren't supported), 'not-embeddings' (not
	 *     an embeddings endpoint in a format Zotero speaks),
	 *     'width-mismatch' (a different model),
	 *     'low-agreement' (a different model, or the wrong pooling), or
	 *     'context-too-small' (the server can't take a chunk-length text).
	 *     agreement is the least per-text cosine, once there are vectors to
	 *     compare.
	 */
	this.verify = async function (url) {
		let E = Zotero.Embeddings;
		_suspended = false;
		_failures = 0;
		let verdict = {
			state: null, url, modelVersion: E.getModelVersion(), format: null,
			serverModel: null, agreement: null, time: Date.now()
		};
		let fail = async (state, detail) => {
			Zotero.debug(`Embeddings: endpoint ${url} failed verification -- ${state}: ${detail}`);
			verdict.state = state;
			await _save(verdict);
			return verdict;
		};
		let prefix = E.getPassagePrefix();
		let { regular, padded } = _probeTexts();
		let local = await E.embedMany([...regular, padded].map(text => prefix + text));
		let localPadded = local.pop();

		// The first format the server answers is the one it speaks
		let served;
		for (let format of FORMATS) {
			try {
				served = await _request(url, regular.map(text => prefix + text), format);
				verdict.format = format;
				break;
			}
			catch (e) {
				let state = _classifyFailure(e);
				if (state != 'not-embeddings' || format == FORMATS.at(-1)) {
					return fail(state, e.message);
				}
			}
		}
		verdict.serverModel = served.model;
		let dims = local[0].length;
		if (served.width < dims) {
			return fail('width-mismatch', `served ${served.width} dimensions, model has ${dims}`);
		}
		verdict.agreement = Math.min(...served.vectors.map((vector, i) => E.cosine(vector, local[i])));
		if (verdict.agreement < AGREEMENT_MIN) {
			return fail('low-agreement', `agreement ${verdict.agreement.toFixed(3)}`);
		}
		// A server whose window is too small for a chunk rejects it, or embeds
		// what fits and says nothing
		try {
			let { vectors } = await _request(url, [prefix + padded], verdict.format);
			let agreement = E.cosine(vectors[0], localPadded);
			if (agreement < AGREEMENT_MIN) {
				return fail('context-too-small', `long text agreement ${agreement.toFixed(3)}`);
			}
		}
		catch (e) {
			// A server that took the other texts and rejects this one is
			// short of window, not of network
			if (e instanceof Zotero.HTTP.UnexpectedStatusException
					|| e instanceof ResponseError) {
				return fail('context-too-small', e.message);
			}
			return fail(_classifyFailure(e), e.message);
		}
		verdict.state = 'ok';
		await _save(verdict);
		return verdict;
	};

	/**
	 * The endpoint passages route to: the configured URL, when a stored
	 * verdict says it serves the active model.
	 *
	 * @return {Promise<Object|null>} - { url, format, serverModel }
	 */
	this.getActive = async function () {
		let url = Zotero.Prefs.get('embeddings.endpoint');
		if (!url || _suspended) {
			return null;
		}
		let verdict = await _load();
		if (!_applies(verdict, url) || verdict.state != 'ok') {
			return null;
		}
		return { url, format: verdict.format || 'openai', serverModel: verdict.serverModel };
	};

	/**
	 * Embed a batch through the endpoint, with a sentinel text appended
	 * whose local vector is known, so a server that stops matching the
	 * model is caught on that batch and never gets a vector stored.
	 *
	 * @param {Object} endpoint - As getActive() returned it
	 * @param {String[]} texts - With any prefix already applied
	 * @return {Promise<Float32Array[]|null>} - One finished vector per text,
	 *     or null when the request failed or the served vectors can't be
	 *     trusted, and the batch is to be embedded locally
	 */
	this.embed = async function (endpoint, texts) {
		let sentinel = await this.getSentinel();
		let served;
		try {
			served = await _request(endpoint.url, [...texts, sentinel.text], endpoint.format);
		}
		catch (e) {
			Zotero.logError(e);
			this.recordFailure(e);
			Zotero.debug('Embeddings: endpoint failed -- embedding this batch locally');
			return null;
		}
		this.recordSuccess();
		let checked = await this.checkBatch(endpoint, served, sentinel.vector, texts.length);
		return checked ? served.vectors.slice(0, texts.length) : null;
	};

	/**
	 * A short text sent along with every batch, and the active model's own
	 * vector for it, embedded once per model version. Checking the server's
	 * vector for it costs no local inference per batch.
	 *
	 * @return {Promise<Object>} - { text, vector }
	 */
	this.getSentinel = async function () {
		let modelVersion = Zotero.Embeddings.getModelVersion();
		if (_sentinel?.modelVersion !== modelVersion) {
			let text = Zotero.Embeddings.getPassagePrefix() + _probeTexts().regular[0];
			let [vector] = await Zotero.Embeddings.embedMany([text]);
			_sentinel = { modelVersion, text, vector };
		}
		return _sentinel;
	};

	/**
	 * Whether a served batch can be stored: the server still reports the
	 * model it was verified with, and its vector for the text at `index`
	 * matches the local model's. Anything else invalidates the endpoint.
	 *
	 * @param {Object} endpoint - As getActive() returned it
	 * @param {Object} served - { vectors, model }, as the server answered
	 * @param {Float32Array} local - The local vector for that text
	 * @param {Number} index
	 * @return {Promise<Boolean>}
	 */
	this.checkBatch = async function (endpoint, served, local, index) {
		if (served.model !== endpoint.serverModel) {
			await this.invalidate(`served model changed from '${endpoint.serverModel}' to '${served.model}'`);
			return false;
		}
		let agreement = Zotero.Embeddings.cosine(served.vectors[index], local);
		if (agreement < AGREEMENT_MIN) {
			await this.invalidate(`served vectors stopped matching (agreement ${agreement.toFixed(3)})`);
			return false;
		}
		return true;
	};

	/**
	 * Whether passages are routing to the endpoint right now: a verified
	 * one, not being skipped. Synchronous, from the verdict last read, so
	 * false until one has been.
	 *
	 * @return {Boolean}
	 */
	this.isActive = function () {
		let url = Zotero.Prefs.get('embeddings.endpoint');
		return !!url && !_suspended && _applies(_verdict, url) && _verdict.state == 'ok';
	};

	/**
	 * Whether passages are routing to a server on another machine right now:
	 * an active endpoint not on this host
	 *
	 * @return {Boolean}
	 */
	this.isRemoteActive = function () {
		return this.isActive() && !_isLocalhost(Zotero.Prefs.get('embeddings.endpoint'));
	};

	/**
	 * Note a failed request. After MAX_FAILURES in a row the endpoint is
	 * skipped until the next run or a fresh verification.
	 * @param {Error} e
	 */
	this.recordFailure = function (e) {
		if (++_failures >= MAX_FAILURES && !_suspended) {
			_suspended = true;
			Zotero.debug(`Embeddings: endpoint skipped for the rest of this run -- `
				+ `${MAX_FAILURES} requests failed in a row, the last with: ${e.message}`);
		}
	};

	this.recordSuccess = function () {
		_failures = 0;
	};

	/**
	 * At the start of a run: try the endpoint again if it was skipped, and
	 * confirm a verified one still serves the model, on one text.
	 */
	this.recheck = async function () {
		_suspended = false;
		_failures = 0;
		let active = await this.getActive();
		if (!active) {
			return;
		}
		let sentinel = await this.getSentinel();
		let served;
		try {
			served = await _request(active.url, [sentinel.text], active.format);
		}
		catch (e) {
			_suspended = true;
			Zotero.debug(`Embeddings: endpoint skipped for this run -- unreachable: ${e.message}`);
			return;
		}
		await this.checkBatch(active, served, sentinel.vector, 0);
	};

	/**
	 * Stop routing to the endpoint until it's verified again.
	 * @param {String} detail - For the debug log
	 */
	this.invalidate = async function (detail) {
		let verdict = await _load();
		if (!verdict) {
			return;
		}
		Zotero.debug(`Embeddings: endpoint no longer trusted -- ${detail}`);
		await _save(Object.assign(verdict, { state: 'invalid' }));
	};

	/**
	 * The endpoint as the preferences show it. Synchronous, from the verdict
	 * last read; 'unknown' until one has been.
	 *
	 * @return {Object} - { url, state, serverModel }: state is 'off' with no
	 *     URL configured, 'unverified' with a URL no stored verdict covers,
	 *     'unreachable' while a verified endpoint is being skipped this run,
	 *     or the verdict's own state
	 */
	this.getStatus = function () {
		let url = Zotero.Prefs.get('embeddings.endpoint') || '';
		let status = { url, state: 'off', serverModel: null };
		// A verdict is about a model, so there is none to report without one
		if (!url || !Zotero.Embeddings.isEnabled()) {
			return status;
		}
		if (_verdict === undefined) {
			status.state = 'unknown';
		}
		else if (!_applies(_verdict, url)) {
			status.state = 'unverified';
		}
		else {
			Object.assign(status, {
				state: _verdict.state == 'ok' && _suspended ? 'unreachable' : _verdict.state,
				serverModel: _verdict.serverModel
			});
		}
		return status;
	};

	/**
	 * Read the stored verdict into memory, so getStatus() can answer.
	 * @return {Promise<Object|null>}
	 */
	this.load = function () {
		return _load();
	};

	/**
	 * Forget the verdict read into memory, after the table holding it was
	 * rebuilt
	 */
	this.reset = function () {
		_verdict = undefined;
		_sentinel = null;
		_suspended = false;
		_failures = 0;
	};

	// Embed texts through the server, as 'openai' (llama.cpp's /v1/embeddings:
	// { input } in, { model, data: [{ index, embedding }] } out) or 'tei'
	// ({ inputs } in, bare vectors out). Returns { vectors, model, width }, the
	// vectors finished as the local engine's are. Throws on a non-2xx, and
	// ResponseError on a 2xx that isn't an embeddings response.
	async function _request(url, texts, format = 'openai') {
		let E = Zotero.Embeddings;
		texts = texts.map(E.normalizeInput);
		Zotero.debug(`Embeddings: embedding batch of ${texts.length} via endpoint (${format})`);
		let xmlhttp = await Zotero.HTTP.request('POST', url, {
			body: JSON.stringify(format == 'tei' ? { inputs: texts } : { input: texts }),
			headers: { 'Content-Type': 'application/json' },
			responseType: 'json',
			timeout: 120000,
			// A 5xx here means this batch can't be embedded remotely (e.g. an
			// input over the server's window); the caller falls back to the
			// local engine, so the HTTP layer's hour-long 5xx backoff must not run
			errorDelayMax: 0
		});
		let response = xmlhttp.response;
		let vectors = null;
		if (Array.isArray(response)) {
			vectors = response;
		}
		else if (Array.isArray(response?.data)) {
			vectors = response.data.slice().sort((a, b) => a.index - b.index).map(row => row.embedding);
		}
		if (!vectors || vectors.length !== texts.length || !vectors.every(Array.isArray)) {
			let received = vectors
				? `${vectors.length} vectors`
				: JSON.stringify(response).substring(0, 200);
			throw new ResponseError(`Endpoint returned ${received} for ${texts.length} inputs`);
		}
		Zotero.debug(`Embeddings: batch of ${texts.length} done`);
		return {
			vectors: vectors.map(vector => E.finishVector(new Float32Array(vector))),
			model: typeof response.model == 'string' ? response.model : null,
			width: vectors[0].length
		};
	}

	function _isLocalhost(url) {
		let host;
		try {
			host = new URL(url).hostname;
		}
		catch {
			return false;
		}
		return host == 'localhost' || host == '[::1]' || host.startsWith('127.');
	}

	// Whether a stored verdict is about this URL and the active model
	function _applies(verdict, url) {
		return !!verdict && verdict.url === url
			&& verdict.modelVersion === Zotero.Embeddings.getModelVersion();
	}

	async function _load() {
		if (_verdict === undefined) {
			await Zotero.Embeddings.initDB();
			let json = await Zotero.DB.valueQueryAsync(
				"SELECT value FROM embeddings.embeddingsMeta WHERE key=?", [META_KEY]);
			_verdict = json ? JSON.parse(json) : null;
		}
		return _verdict;
	}

	async function _save(verdict) {
		await Zotero.Embeddings.initDB();
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.embeddingsMeta (key, value) VALUES (?, ?)",
			[META_KEY, JSON.stringify(verdict)]);
		_verdict = verdict;
	}

	// What went wrong with a request, as a verdict state
	function _classifyFailure(e) {
		if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
			if (e.status == 401 || e.status == 403) {
				return 'unauthorized';
			}
			if ([400, 404, 405, 422].includes(e.status)) {
				return 'not-embeddings';
			}
			return 'unreachable';
		}
		if (e instanceof ResponseError) {
			return 'not-embeddings';
		}
		return 'unreachable';
	}

	// Short and long texts from the calibration corpus, and one long enough
	// to overrun a small server window, its tail distinct so that a silently
	// truncated embedding no longer matches the local one
	function _probeTexts() {
		let triples = Zotero.Embeddings.Calibration.getCorpus();
		let regular = [
			...triples.slice(0, PROBE_QUERIES).map(triple => triple.query),
			...triples.slice(0, PROBE_PASSAGES).map(triple => triple.passage)
		];
		let padded = '';
		for (let i = 0; padded.length < PROBE_PADDED_CHARS; i++) {
			padded += triples[i % triples.length].passage + ' ';
		}
		padded += 'The closing sentence names the Antikythera mechanism and the lighthouse at Alexandria.';
		return { regular, padded };
	}
};

/**
 * The server's part in indexing: which attachments it embeds, and fetching
 * the rows it made. Those attachments are neither cut nor embedded here
 * unless it declines them. It's used whenever the account syncs, which is
 * what puts the files where it can read them.
 */
Zotero.Embeddings.Sync = new function () {
	// Whether the server can be embedding for this client at all: there's
	// an account to sync with. The pref is an override for testing.
	this.isAvailable = function () {
		return Zotero.Prefs.get('embeddings.sync.enabled') && Zotero.Sync.Runner.enabled;
	};

	// Whether an attachment's rows are to be asked of the server: a stored
	// file the server has (in sync or still to download) in a library
	// syncing with Zotero Storage, that the server hasn't declined. Nothing is
	// the server's while an endpoint is active.
	//
	// @param {Zotero.Item} item
	// @param {Object} [record] - The item's entry from Store.getIndexStates()
	// @return {Boolean}
	this.shouldAskServer = function (item, record = null) {
		if (!this.isAvailable() || Zotero.Embeddings.Endpoint.isActive()
				|| !item.isStoredFileAttachment()) {
			return false;
		}
		let library = Zotero.Libraries.get(item.libraryID);
		if (!Zotero.Sync.Data.Local.filterSkippedLibraries([library]).length) {
			return false;
		}
		let Storage = Zotero.Sync.Storage.Local;
		if (!Storage.getEnabledForLibrary(item.libraryID)
				|| Storage.getModeForLibrary(item.libraryID) != 'zfs') {
			return false;
		}
		let onServer = [
			Storage.SYNC_STATE_IN_SYNC,
			Storage.SYNC_STATE_TO_DOWNLOAD,
			Storage.SYNC_STATE_FORCE_DOWNLOAD
		];
		if (!onServer.includes(item.attachmentSyncState)) {
			return false;
		}
		return !record?.syncDeclined;
	};

	// Attachments asked for per request
	const MAX_BATCH_ITEMS = 50;
	// How the server's vectors are read, by the dtype it reports with them.
	// Each is the model's raw output, little-endian, which this client trims,
	// centers and quantizes itself.
	const DECODERS = {
		float16: Float16Array,
		float32: Float32Array
	};

	/**
	 * Ask the server for the rows of the given attachments. Rows it has are
	 * taken in through Indexing.addChunks(); a refusal, another model or rows
	 * from other content leave the attachment to this client; one put off is
	 * asked about next run. A failed request is thrown.
	 *
	 * @param {Integer} libraryID
	 * @param {Object[]} payloads - Attachments in that library to ask for,
	 *     as Sources.getOutstandingAttachments() gives them
	 * @param {Function} shouldStop
	 * @return {Promise<Boolean>} - Whether it got to the end
	 */
	this.fetch = async function (libraryID, payloads, shouldStop) {
		let Store = Zotero.Embeddings.Indexing.Store;
		let apiKey = await Zotero.Sync.Data.Local.getAPIKey();
		if (!apiKey) {
			return true;
		}
		let client = Zotero.Sync.Runner.getAPIClient({ apiKey });
		let library = Zotero.Libraries.get(libraryID);
		let model = Zotero.Embeddings.getModelVersion();
		let items = payloads.map(payload => payload.item);
		let records = new Map(payloads.map(payload => [payload.item.id, payload.record]));
		for (let i = 0; i < items.length; i += MAX_BATCH_ITEMS) {
			if (shouldStop()) {
				return false;
			}
			let batch = items.slice(i, i + MAX_BATCH_ITEMS);
			let served = await client.getEmbeddings(
				library.libraryType, library.libraryTypeID, model, batch.map(item => item.key));
			// Asked for by model, so an answer in another is the server's
			// mistake, and rows of it are no use here
			if (served.model !== model) {
				Zotero.debug(`Embeddings: the server answered for ${library.name} with `
					+ `${served.model || 'no model'} -- embedding its attachments here`);
				await Store.setSyncDeclined(batch.map(item => item.id));
				continue;
			}
			// Vectors in an encoding this client doesn't read would be
			// misread rather than refused
			let decoder = Object.hasOwn(DECODERS, served.dtype) ? DECODERS[served.dtype] : null;
			if (!decoder) {
				Zotero.debug(`Embeddings: the server sent ${library.name}'s vectors as `
					+ `${served.dtype || 'no dtype'} -- embedding its attachments here`);
				await Store.setSyncDeclined(batch.map(item => item.id));
				continue;
			}
			let byKey = new Map(served.items.map(arrival => [arrival.key, arrival]));
			let counts = { taken: 0, kept: 0, declined: 0, awaiting: 0 };
			let declined = [];
			for (let item of batch) {
				let arrival = byKey.get(item.key);
				if (!arrival || arrival.status == 'pending') {
					counts.awaiting++;
					continue;
				}
				// Rows already held from this version: nothing to replace
				if (arrival.status == 'success' && arrival.version
						&& records.get(item.id)?.syncVersion === arrival.version) {
					await Store.clearSyncState(item.id);
					counts.kept++;
					continue;
				}
				let rows = arrival.status == 'success' ? _decodeRows(arrival.rows, decoder) : null;
				let taken = rows && await Zotero.Embeddings.Indexing.addChunks(
					item.id,
					{
						modelVersion: model,
						contentHash: arrival.contentHash,
						chunks: arrival.chunks,
						version: arrival.version || null,
						rows
					}
				);
				if (taken) {
					counts.taken++;
				}
				else {
					declined.push(item.id);
					counts.declined++;
				}
			}
			if (declined.length) {
				await Store.setSyncDeclined(declined);
			}
			Zotero.debug(`Embeddings: asked the server for ${batch.length} `
				+ Zotero.Utilities.pluralize(batch.length, 'attachment') + ` in ${library.name} -- `
				+ `${counts.taken} taken, ${counts.kept} kept, ${counts.declined} declined, `
				+ `${counts.awaiting} still to come`);
			Zotero.Embeddings.Indexing.Progress.addAwaiting(counts.awaiting);
			await Zotero.Embeddings.Indexing.Progress.tick();
		}
		return true;
	};

	/**
	 * See what the server has embedded anew in a library since the version
	 * last recorded, mark those attachments to be fetched again, declined
	 * ones included, and start a run for them. The version is recorded last,
	 * so a failure repeats the delta. Nothing is asked while an endpoint is
	 * active.
	 *
	 * @param {Zotero.Sync.APIClient} client
	 * @param {Integer} libraryID
	 */
	this.checkLibrary = async function (client, libraryID) {
		if (!Zotero.Embeddings.isEnabled() || !this.isAvailable()
				|| await Zotero.Embeddings.Endpoint.getActive()) {
			return;
		}
		let Indexing = Zotero.Embeddings.Indexing;
		let Store = Indexing.Store;
		let library = Zotero.Libraries.get(libraryID);
		let model = Zotero.Embeddings.getModelVersion();
		await Zotero.Embeddings.initDB();
		let since = await Store.getSyncVersion(libraryID);
		let changes;
		try {
			changes = await client.getEmbeddingVersions(
				library.libraryType, library.libraryTypeID, model, since);
		}
		catch (e) {
			Zotero.logError(e);
			return;
		}
		if (!changes) {
			return;
		}
		let { version, items: versions, models } = changes;
		if (models && !models.includes(model)) {
			Zotero.debug(`Embeddings: the server embeds ${library.name} with `
				+ `${models.join(', ') || 'no model'}, not ${model}`);
		}
		let keys = Object.keys(versions);
		let refresh = [];
		if (keys.length) {
			let ids = keys.map(key => Zotero.Items.getIDFromLibraryAndKey(libraryID, key)).filter(Boolean);
			// Judged without the record, so that declined ones are included
			let items = (await Zotero.Items.getAsync(ids, { noCache: true }))
				.filter(item => this.shouldAskServer(item));
			let records = await Store.getIndexStates(items.map(item => item.id));
			refresh = items
				.filter(item => records.get(item.id)?.syncVersion !== versions[item.key])
				.map(item => item.id);
			if (refresh.length) {
				await Store.setSyncRefresh(refresh);
			}
		}
		if (version) {
			await Store.setSyncVersion(libraryID, version);
		}
		Zotero.debug(`Embeddings: ${library.name} is at version ${version} on the server -- `
			+ `${keys.length} changed since ${since || 'the start'}, ${refresh.length} to fetch again`);
		if (refresh.length && !Indexing.isPaused()) {
			Indexing.startIndexing().catch(e => Zotero.logError(e));
		}
	};

	// An answer's rows with their vectors in the stored form -- trimmed,
	// centered and quantized as this client's own are -- or null when any
	// can't be read
	//
	// @param {Object[]} rows
	// @param {Function} decoder - The typed array each vector's bytes form
	function _decodeRows(rows, decoder) {
		try {
			let decoded = [];
			for (let row of rows) {
				let vector = _decodeEmbedding(row.embedding, decoder);
				if (!vector) {
					return null;
				}
				decoded.push({
					chunkIndex: row.chunkIndex,
					embedding: Zotero.Embeddings.prepare(Zotero.Embeddings.finishVector(vector)),
					anchor: row.anchor ?? null
				});
			}
			return decoded;
		}
		catch (e) {
			Zotero.logError(e);
			return null;
		}
	}

	// A vector as the server sends it -- base64 of the model's raw output --
	// in float32, or null when it isn't one: narrower than the stored width,
	// or holding a value that isn't finite
	function _decodeEmbedding(base64, VectorArray) {
		let bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
		if (bytes.byteLength % VectorArray.BYTES_PER_ELEMENT) {
			return null;
		}
		let vector = Float32Array.from(new VectorArray(bytes.buffer));
		if (vector.length < Zotero.Embeddings.getDimensions() || !vector.every(Number.isFinite)) {
			return null;
		}
		return vector;
	}
};

/**
 * A static embedding model (potion-multilingual-128M): a text's vector is
 * the mean of its tokens' rows, so a sentence embeds in microseconds --
 * cheap enough to weigh every sentence of a passage. Its vectors are topical
 * and share no space with the index's, so they only rank texts against each
 * other and are never stored.
 */
Zotero.Embeddings.Static = new function () {
	const MODEL = {
		modelId: 'mozilla/static-embeddings',
		revision: 'v1.0.0',
		subfolder: 'models/minishlab/potion-multilingual-128M',
		// The table's own width; fp8 keeps 0.9999 of fp16's pooled cosine
		// at half the download
		dtype: 'fp8_e4m3',
		dims: 256
	};
	const TASK_NAME = 'static-embeddings';
	const ENGINE_ID = 'zotero-static-embeddings';
	const MODEL_HUB_ROOT_URL = 'https://model-hub.mozilla.org';
	const MODEL_HUB_URL_TEMPLATE = '{model}/{revision}';

	let _engine = null;
	let _engineReady = null;
	let _downloaded = false;
	// The last query embedded, since every passage of a search is weighed
	// against the same one
	let _queryCache = null;

	/**
	 * Whether the model is in the runtime's cache
	 *
	 * @return {Promise<Boolean>}
	 */
	this.isDownloaded = async function () {
		if (!_downloaded) {
			let cached = await Zotero.ML.listModels({ taskName: TASK_NAME });
			_downloaded = cached.some(model => model.modelId === MODEL.modelId);
		}
		return _downloaded;
	};

	/**
	 * Download the model if the runtime doesn't have it cached
	 *
	 * @param {Function} [onProgress] - Called with the runtime's download
	 *     progress
	 * @return {Promise}
	 */
	this.download = async function (onProgress) {
		if (await this.isDownloaded()) {
			return;
		}
		Zotero.debug('Embeddings: downloading static model');
		await _getEngine(onProgress);
		_downloaded = true;
		Zotero.debug('Embeddings: static model downloaded');
	};

	/**
	 * How similar each text is to a query, as a cosine between -1 and 1
	 *
	 * @param {String} queryText
	 * @param {String[]} texts
	 * @return {Promise<Number[]>}
	 */
	this.similarities = async function (queryText, texts) {
		if (!texts.length) {
			return [];
		}
		if (_queryCache?.text !== queryText) {
			let promise = _embed([queryText]).then(([vector]) => vector);
			_queryCache = { text: queryText, promise };
			promise.catch(() => {
				if (_queryCache?.promise === promise) {
					_queryCache = null;
				}
			});
		}
		let [query, vectors] = await Promise.all([_queryCache.promise, _embed(texts)]);
		// Unit vectors, so the dot product is the cosine
		return vectors.map((vector) => {
			let dot = 0;
			for (let i = 0; i < vector.length; i++) {
				dot += vector[i] * query[i];
			}
			return dot;
		});
	};

	// Each text as a unit vector
	async function _embed(texts) {
		let run = async () => {
			let engine = await _getEngine();
			let { output } = await engine.run({
				args: texts.map(text => text.replace(/\s+/g, ' ').trim()),
				options: { pooling: 'mean', normalize: true }
			});
			return output;
		};
		try {
			return await run();
		}
		catch (e) {
			// The runtime destroys an idle engine on its own timer, so one
			// found dead gets one replacement
			if (!_engine || _isUsable(_engine)) {
				throw e;
			}
			_engine = null;
			_engineReady = null;
			return run();
		}
	}

	function _isUsable(engine) {
		return !['closed', 'crashed', 'error'].includes(engine.engineStatus);
	}

	// The engine, created on first use; creating it downloads whatever of the
	// model the runtime is missing
	async function _getEngine(onProgress) {
		if (_engine && !_isUsable(_engine)) {
			_engine = null;
			_engineReady = null;
		}
		if (!_engineReady) {
			_engineReady = (async () => {
				_engine = await Zotero.ML.createEngine({
					engineId: ENGINE_ID,
					taskName: TASK_NAME,
					backend: 'static-embeddings',
					modelId: MODEL.modelId,
					modelRevision: MODEL.revision,
					modelHubRootUrl: MODEL_HUB_ROOT_URL,
					modelHubUrlTemplate: MODEL_HUB_URL_TEMPLATE,
					staticEmbeddingsOptions: {
						subfolder: MODEL.subfolder,
						dtype: MODEL.dtype,
						dimensions: MODEL.dims,
						compression: true
					}
				}, onProgress);
				return _engine;
			})();
			_engineReady.catch(() => {
				_engineReady = null;
			});
		}
		return _engineReady;
	}
};
