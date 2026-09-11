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
	//
	// The models
	//
	// Everything about the active model -- which one it is, what it expects,
	// where its files come from -- is answered here.
	//

	// Key order is the display order in the preferences model menu.
	//
	// Every field is a fact about the model, read off its model card or its
	// config. Anything that can only be learned by running it -- the mean vector
	// its embeddings share, the score below which nothing is a match, the score
	// at which the Relevance bar fills -- is measured instead, on first use (see
	// Zotero.Embeddings.Calibration). Adding a model fits nothing by hand.
	//
	// What each field is for, documented here:
	//
	// 'menu-key': {                      // also the value of the embeddings.model pref
	//     revision: 1,                   // bump when a change alters the vectors, to force a reindex
	//     modelId: 'Org/repo',           // HF repo id, and the transformers.js pipeline id
	//     language: 'en',                // optional: a code from Calibration.languages, and the only
	//                                    //   pairs it's calibrated against. Omit to use all of them.
	//     dtype: 'q8',                   // weights variant; 'q8' is onnx/model_quantized.onnx
	//     pooling: 'cls',                // how token vectors combine: 'cls' or 'mean'
	//     queryPrefix: '...',            // prepended to every query (see embedQuery())
	//     passagePrefix: '...',          // prepended to every passage (see embedPassages())
	//     maxTokens: 512,                // context window; longer text is chunked to fit
	//     dims: 256,                     // optional: keep only the first N dimensions of every vector
	//                                    //   (Matryoshka) -- only for a model trained to truncate
	//     l10nID: '...',                 // optional Fluent id for the menu
	//     label: '...'                   // optional plain-English menu label, for a model that isn't
	//                                    //   shipped. The menu prefers l10nID, then label, then modelId.
	// }
	const MODELS = {
		'bekko-embedding-v1-a8m': {
			revision: 1,
			modelId: 'hotchpotch/bekko-embedding-v1-a8m',
			// The repo's default artifact is onnx/model.onnx (fp32 layers,
			// int8 embedding table); it has no model_quantized.onnx
			dtype: 'fp32',
			pooling: 'mean',
			queryPrefix: '',
			passagePrefix: '',
			maxTokens: 8192,
			dims: 256,
			l10nID: 'preferences-advanced-semantic-search-multilingual'
		},
		'bekko-embedding-v1-a25m': {
			revision: 1,
			modelId: 'hotchpotch/bekko-embedding-v1-a25m',
			// The repo's default artifact is onnx/model.onnx (fp32 layers,
			// int8 embedding table); it has no model_quantized.onnx
			dtype: 'fp32',
			pooling: 'mean',
			queryPrefix: '',
			passagePrefix: '',
			maxTokens: 8192,
			dims: 256,
			label: "better but slower multilingual"
		},
		'bge-small-zh-v1.5': {
			revision: 1,
			modelId: 'Xenova/bge-small-zh-v1.5',
			language: 'zh',
			dtype: 'q8',
			pooling: 'cls',
			queryPrefix: '为这个句子生成表示以用于检索相关文章：',
			passagePrefix: '',
			maxTokens: 512,
			l10nID: 'preferences-advanced-semantic-search-chinese'
		},
		// Models for testing
	};

	const TASK_NAME = 'feature-extraction';
	// Identifies our engine to the inference runtime, and the model files it
	// caches for us (see getModelFile())
	const ENGINE_ID = 'zotero-embeddings';

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
	 * A model added to try out rather than to ship may have no `l10nID`; the
	 * menu falls back to its `label`, and then to `modelId`.
	 *
	 * @return {Object[]} - [{ name, modelId, label, l10nID }]
	 */
	this.getAvailableModels = function () {
		return Object.entries(MODELS).map(([name, model]) => ({
			name,
			modelId: model.modelId,
			label: model.label,
			l10nID: model.l10nID
		}));
	};

	// Bump when how a model is calibrated changes (see Zotero.Embeddings
	// .Calibration): stored vectors are centered on the measured mean, so a
	// new measurement means a reindex of every model
	const CALIBRATION_VERSION = 2;

	/**
	 * Identity of the active embedding function: model name, its revision and
	 * the calibration version. Any code change that alters the vectors a model
	 * produces (dtype, upstream weights, prefixes, pooling) must bump that
	 * model's `revision`, and a change to calibration must bump
	 * CALIBRATION_VERSION, so that stored embeddings are detected as stale and
	 * reindexed (see Indexing._ensureIndexMatchesModel()).
	 * @return {String}
	 */
	this.getModelVersion = function () {
		return `${this.getModelName()}/${_getModel().revision}/${CALIBRATION_VERSION}`;
	};

	// The active model's entry in MODELS. Throws when no model is selected:
	// every fact about the model is unanswerable then, and callers reach this
	// only after isEnabled().
	function _getModel() {
		let name = Zotero.Embeddings.getModelName();
		let model = MODELS[name];
		if (!model) {
			throw new Error(`Unknown embeddings model '${name}'`);
		}
		return model;
	}

	/**
	 * The active model's context window, in tokens.
	 *
	 * @return {Number}
	 */
	this.getModelMaxTokens = function () {
		return _getModel().maxTokens;
	};

	/**
	 * The language code the active model is for, or null when it handles every language.
	 *
	 * @return {String|null}
	 */
	this.getModelLanguage = function () {
		return _getModel().language || null;
	};

	/**
	 * The string embedQuery() prepends to every query.
	 *
	 * @return {String}
	 */
	this.getQueryPrefix = function () {
		return _getModel().queryPrefix;
	};

	/**
	 * The string embedPassages() prepends to every passage.
	 *
	 * @return {String}
	 */
	this.getPassagePrefix = function () {
		return _getModel().passagePrefix;
	};

	/**
	 * Read one of the active model's files (e.g. its tokenizer) from the
	 * runtime's model cache, fetching it from the model hub if the runtime
	 * doesn't have it yet.
	 *
	 * @param {String} file - File path within the model repository
	 * @return {Promise<ArrayBuffer>}
	 */
	this.getModelFile = function (file) {
		return Zotero.ML.getModelFile({
			engineId: ENGINE_ID,
			taskName: TASK_NAME,
			modelId: _getModel().modelId,
			file
		});
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
	const _dbVersion = 6;

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
				"SELECT value FROM embeddings.itemEmbeddingsMeta WHERE key='localUserKey'")
			: false;
		if (version >= _dbVersion && storedUserKey == localUserKey) {
			return;
		}
		await Zotero.DB.queryAsync("DROP TABLE IF EXISTS embeddings.itemEmbeddings");
		await Zotero.DB.queryAsync("DROP TABLE IF EXISTS embeddings.itemEmbeddingsMeta");
		await Zotero.DB.queryAsync("DROP TABLE IF EXISTS embeddings.modelCalibration");
		await Zotero.DB.queryAsync("DROP TABLE IF EXISTS embeddings.itemChunkCounts");
		// One row per chunk of an item's text, its vector centered and
		// quantized to int8 (see Zotero.Embeddings.prepare()), each carrying
		// the hash of the item's full source. For attachments, the block range
		// and offsets locate the chunk's text in the document (see
		// getMatchingChunks()). No foreign key: deletions are handled by the
		// notifier and eligibility pruning.
		await Zotero.DB.queryAsync(
			"CREATE TABLE embeddings.itemEmbeddings (\n"
			+ "    itemID INTEGER NOT NULL,\n"
			+ "    chunkIndex INTEGER NOT NULL,\n"
			+ "    embedding BLOB,\n"
			+ "    sourceHash TEXT NOT NULL,\n"
			+ "    startBlock INTEGER,\n"
			+ "    endBlock INTEGER,\n"
			+ "    startOffset INTEGER,\n"
			+ "    endOffset INTEGER,\n"
			+ "    textCheck TEXT,\n"
			+ "    sectionPart INTEGER,\n"
			+ "    sectionParts INTEGER,\n"
			+ "    tokens INTEGER,\n"
			+ "    PRIMARY KEY (itemID, chunkIndex)\n"
			+ ")"
		);
		// Chunk-shape diagnostics read this index alone, never the rows with
		// their vectors (see Indexing._getChunkShape())
		await Zotero.DB.queryAsync(
			"CREATE INDEX embeddings.itemEmbeddings_tokens "
				+ "ON itemEmbeddings (tokens, sectionParts, sectionPart)"
		);
		// The localUserKey the vectors were built against and the model that
		// produced them
		await Zotero.DB.queryAsync(
			"CREATE TABLE embeddings.itemEmbeddingsMeta (\n"
			+ "    key TEXT PRIMARY KEY,\n"
			+ "    value NOT NULL\n"
			+ ")"
		);
		// Per-model measurements (see ensureCalibration()), keyed by version
		// so a revision bump measures again
		await Zotero.DB.queryAsync(
			"CREATE TABLE embeddings.modelCalibration (\n"
			+ "    modelVersion TEXT PRIMARY KEY,\n"
			+ "    meanVector BLOB NOT NULL,\n"
			+ "    minScore REAL NOT NULL,\n"
			+ "    maxDisplayScore REAL NOT NULL\n"
			+ ")"
		);
		// How many chunks each attachment's current source splits into,
		// recorded at extraction, and how many of them have rows stored. An
		// attachment is indexed when the two are equal. Other item types
		// count as one apiece.
		await Zotero.DB.queryAsync(
			"CREATE TABLE embeddings.itemChunkCounts (\n"
			+ "    itemID INTEGER PRIMARY KEY,\n"
			+ "    sourceHash TEXT NOT NULL,\n"
			+ "    chunks INTEGER NOT NULL,\n"
			+ "    embedded INTEGER NOT NULL DEFAULT 0\n"
			+ ")"
		);
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) VALUES ('localUserKey', ?)",
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
	 * Delete everything we hold for models other than the active one (for all of
	 * them when disabled): their cached files, freeing disk space after a model
	 * switch, and what calibration measured about them.
	 *
	 * @return {Promise}
	 */
	this.pruneModels = async function () {
		let enabled = this.isEnabled();
		let keepModelId = enabled ? _getModel().modelId : null;
		let keepVersion = enabled ? this.getModelVersion() : null;
		for (let model of await Zotero.ML.listModels({ taskName: TASK_NAME })) {
			if (model.modelId !== keepModelId) {
				await Zotero.ML.deleteModels({
					taskName: TASK_NAME,
					model: model.name,
					revision: model.revision
				});
			}
		}
		await this.initDB();
		if (keepVersion) {
			// Clean calibration records
			await Zotero.DB.queryAsync(
				"DELETE FROM embeddings.modelCalibration WHERE modelVersion!=?",
				[keepVersion]
			);
		}
		else {
			// Semantic search is off, so there's no model to keep anything for
			await Zotero.DB.queryAsync("DELETE FROM embeddings.modelCalibration");
			// ...and nothing should render a relevance band
			_calibration = null;
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
	// Thread count the current engine was created with
	let _engineNumThreads = null;
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


	function _isEngineUsable(engine) {
		return !['closed', 'crashed', 'error'].includes(engine.engineStatus);
	}

	// Create the inference engine if needed. The engine reads the model files
	// from the model directory, so the model must already be downloaded.
	async function _getEngine(onProgress) {
		// An engine created for a different model or revision can't be reused
		// -- its weights and prefixes wouldn't match the active model
		if (_engine && _engineModelVersion
				&& _engineModelVersion !== Zotero.Embeddings.getModelVersion()) {
			await Zotero.Embeddings.shutdownEngine();
		}
		// The runtime destroys an engine left idle past its timeout, releasing
		// the model's memory, and expects the next run to create a new engine
		// -- a retained wrapper isn't revived, its run() only throws. The
		// replacement runs the same model, so vectors and scoring are
		// unaffected.
		if (_engine && !_isEngineUsable(_engine)) {
			await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
		}
		if (!_engineReady) {
			let modelVersion = Zotero.Embeddings.getModelVersion();
			_engineReady = (async () => {
				let model = _getModel();
				let numThreads = Zotero.Embeddings.Indexing.getEngineThreads();
				Zotero.debug(`Embeddings: creating engine for '${model.modelId}' `
					+ `(dtype ${model.dtype}, pooling ${model.pooling}, `
					+ `${numThreads} threads)`);
				_engine = await Zotero.ML.createEngine({
					engineId: ENGINE_ID,
					taskName: TASK_NAME,
					backend: 'onnx-native',
					modelId: model.modelId,
					modelRevision: 'main',
					modelHubRootUrl: MODEL_HUB_ROOT_URL,
					modelHubUrlTemplate: MODEL_HUB_URL_TEMPLATE,
					dtype: model.dtype,
					numThreads
				}, onProgress);
				_engineModelVersion = modelVersion;
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
	this.shutdownEngine = async function ({ modelChanged = true } = {}) {
		let engine = _engine;
		_engine = null;
		_engineReady = null;
		_engineModelVersion = null;
		_engineNumThreads = null;
		// Only a model change makes vectors computed by the old engine
		// unusable, so a shutdown to release memory leaves scoring alone
		if (modelChanged) {
			_modelGeneration++;
			// The old model's measurements don't describe the new one, and the
			// bar renders straight off them
			_calibration = null;
		}
		if (engine) {
			await engine.terminate();
			await Zotero.ML.shutdown();
		}
	};

	/**
	 * Whether the live engine was created with a different thread count than
	 * indexing currently wants (see Indexing.getEngineThreads())
	 *
	 * @return {Boolean}
	 */
	this.engineThreadsStale = function () {
		return !!_engine && _engineNumThreads !== this.Indexing.getEngineThreads();
	};

	//
	// Vector math
	//
	// Shared by scoring and by calibration, which has to measure exactly what
	// scoring computes -- if the two ever centered, quantized or compared
	// differently, the calibrated bounds would describe a quantity nothing
	// else produces. Public so Zotero.Embeddings.Calibration uses these rather
	// than its own copies.
	//

	/**
	 * Subtract a mean vector and scale back to unit length.
	 *
	 * Every embedding a model produces shares a large common direction that
	 * says nothing about the text, which leaves unrelated items looking
	 * moderately similar to everything -- an item with almost no text scores
	 * about as well as a real match. Removing it spreads the scores out, so
	 * that no relevance reads as no score rather than as a middling one.
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
	 * Center a raw embedding on the active model's measured mean and quantize
	 * it: the form every vector is stored and compared in. The calibration
	 * has to be in memory (see loadCalibration()).
	 *
	 * @param {Float32Array} vector
	 * @return {Int8Array}
	 */
	this.prepare = function (vector) {
		if (!_calibration) {
			throw new this.IndexNotReadyError(
				`Model '${this.getModelVersion()}' has no calibration to center on`);
		}
		let mean = _calibration.mean;
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
	// Three numbers govern scoring, and none of them can be read off a model
	// card: the mean vector its embeddings share, the score below which nothing
	// counts as a match, and the score at which the Relevance bar fills. They
	// aren't choices so much as properties of the model, so they're measured
	// rather than configured -- once per model version, against a fixed corpus
	// of query/passage pairs written to resemble real searches over a library.
	//
	// Measuring takes a few seconds of inference, so it runs from the indexing
	// pass, which has the engine loaded anyway, and the result is cached in the
	// database. Keying the cache by model version means switching models and
	// back doesn't measure again, while a `revision` bump does -- the same
	// signal that invalidates the stored vectors.
	//
	// How the numbers are derived, and the corpus they're derived from, live in
	// Zotero.Embeddings.Calibration. What's here is where they're kept and how
	// they're applied.
	//

	// Measured calibration for the active model, or null if it hasn't been
	// measured or loaded yet.
	let _calibration = null;

	/**
	 * The active model's calibration, read from the database and kept in memory
	 * for getScoreFraction(), or null if the model hasn't been measured yet. A
	 * single row read with no engine involved, so it's safe on the search path.
	 *
	 * @return {Promise<Object|null>} - { mean, minScore, maxDisplayScore }
	 */
	this.loadCalibration = async function () {
		let modelVersion = Zotero.Embeddings.getModelVersion();
		if (_calibration && _calibration.modelVersion === modelVersion) {
			return _calibration;
		}
		let row = await Zotero.DB.rowQueryAsync(
			"SELECT meanVector, minScore, maxDisplayScore FROM embeddings.modelCalibration "
				+ "WHERE modelVersion=?",
			[modelVersion]
		);
		_calibration = row
			? {
				modelVersion,
				mean: _blobToVector(row.meanVector),
				minScore: row.minScore,
				maxDisplayScore: row.maxDisplayScore
			}
			: null;
		return _calibration;
	};

	/**
	 * Measure the active model's calibration unless it's already been measured.
	 * Needs the engine, so this belongs to the indexing pass rather than to
	 * database setup: the search path only ever reads the cached result.
	 *
	 * @return {Promise}
	 */
	this.ensureCalibration = async function () {
		if (await this.loadCalibration()) {
			return;
		}
		let modelVersion = this.getModelVersion();
		Zotero.debug(`Embeddings: calibrating ${modelVersion}`);
		let measured = await Zotero.Embeddings.Calibration.measure();
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.modelCalibration "
				+ "(modelVersion, meanVector, minScore, maxDisplayScore) VALUES (?, ?, ?, ?)",
			[
				modelVersion,
				new Uint8Array(measured.mean.buffer, measured.mean.byteOffset,
					measured.mean.byteLength),
				measured.minScore,
				measured.maxDisplayScore
			],
			{ debugParams: false }
		);
		_calibration = { modelVersion, ...measured };
		Zotero.debug(`Embeddings: calibrated ${modelVersion} -- matches start at `
			+ `${measured.minScore.toFixed(4)}, the bar fills at `
			+ `${measured.maxDisplayScore.toFixed(4)}`);
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
		let engine;
		let run = async () => {
			engine = await _getEngine();
			Zotero.debug(`Embeddings: embedding batch of ${texts.length}`);
			// The runtime spreads `args` into the pipeline call, so the batch
			// of texts is a single argument
			return engine.run({
				args: [texts],
				options: { pooling: _getModel().pooling }
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
			await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
			vectors = await run();
		}
		Zotero.debug(`Embeddings: batch of ${texts.length} done`);
		return vectors.map(vector => _finish(new Float32Array(vector)));
	};

	// A model's raw output into its embedding: cut to its `dims` if it
	// truncates, and unit length -- centering subtracts a mean measured over
	// unit vectors (see center())
	function _finish(vector) {
		let dims = _getModel().dims;
		if (dims && vector.length > dims) {
			vector = vector.slice(0, dims);
		}
		return _normalize(vector);
	}

	// POST { input: [...] } to an OpenAI-style /v1/embeddings endpoint (as
	// served by llama.cpp, Ollama, TEI and the hosted APIs), which answers
	// { data: [{ index, embedding }] }. Ordered by index, since the spec
	// doesn't promise the array comes back in input order.
	async function _embedViaEndpoint(endpoint, texts) {
		Zotero.debug(`Embeddings: embedding batch of ${texts.length} via endpoint`);
		let xmlhttp = await Zotero.HTTP.request('POST', endpoint, {
			body: JSON.stringify({ input: texts }),
			headers: { 'Content-Type': 'application/json' },
			responseType: 'json',
			timeout: 120000,
			// A 5xx here means this batch can't be embedded remotely (e.g. an
			// input over the server's window); the caller falls back to the
			// local engine, so the HTTP layer's hour-long 5xx backoff must not run
			errorDelayMax: 0
		});
		let data = xmlhttp.response?.data;
		let vectors = Array.isArray(data)
			? data.slice().sort((a, b) => a.index - b.index).map(row => row.embedding)
			: null;
		if (!vectors || vectors.length !== texts.length || !vectors.every(Array.isArray)) {
			let received = vectors
				? `${vectors.length} vectors`
				: JSON.stringify(xmlhttp.response).substring(0, 200);
			throw new Error(`Embeddings: endpoint returned ${received} `
				+ `for ${texts.length} inputs`);
		}
		Zotero.debug(`Embeddings: batch of ${texts.length} done`);
		return vectors.map(vector => _finish(new Float32Array(vector)));
	}

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
	this.embedPassages = async function (texts) {
		let passagePrefix = _getModel().passagePrefix;
		texts = texts.map(text => passagePrefix + text);
		// Passages can route to an external endpoint serving the same model;
		// queries always embed locally. A failed batch embeds locally instead
		// of waiting on a retry -- the next batch tries the endpoint again.
		let endpoint = Zotero.Prefs.get('embeddings.endpoint');
		if (!endpoint) {
			return this.embedMany(texts);
		}
		try {
			return await _embedViaEndpoint(endpoint, texts);
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.debug('Embeddings: endpoint failed -- embedding this batch locally');
			return this.embedMany(texts);
		}
	};

	/**
	 * Similarity between an arbitrary query and passage, computed the way
	 * scoring computes it.
	 *
	 *
	 * @param {Object} pair
	 * @param {String} pair.query
	 * @param {String} pair.passage
	 * @return {Promise<Number>}
	 */
	this.compare = async function ({ query, passage }) {
		await this.initDB();
		// Pull the measured mean into memory, so prepare() centers with it
		await this.loadCalibration();
		let queryVector = await this.embedQuery(query);
		let [passageVector] = await this.embedPassages([passage]);
		return this.cosine(this.prepare(queryVector), this.prepare(passageVector));
	};


	/**
	 * Map a raw similarity score onto the active model's display range, for
	 * the Relevance column's bar. The band runs from the score where matches
	 * begin to the score where they're as good as this model gets, both
	 * measured (see the calibration section): scores at or below the floor
	 * render as an empty bar, at or above the ceiling as a full one. Nothing to
	 * render before the model has been calibrated, which is also before there
	 * are any scores.
	 *
	 * Pass clamped: false to keep scores above the ceiling apart -- for a
	 * consumer ordering by the fraction rather than displaying it, a strong
	 * query's whole top tier can sit past the ceiling, where the clamp would
	 * flatten the model's ordering into a tie.
	 *
	 * @param {Number} score
	 * @param {Object} [options]
	 * @param {Boolean} [options.clamped=true] - Cap the fraction at 1
	 * @return {Number} - 0-1, or above 1 unclamped
	 */
	this.getScoreFraction = function (score, { clamped = true } = {}) {
		if (!_calibration) {
			return 0;
		}
		let { minScore, maxDisplayScore } = _calibration;
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

	// mozStorage returns a BLOB as an array of byte values; reinterpret those
	// bytes as a Float32 vector (the calibration mean)
	function _blobToVector(blob) {
		let bytes = Uint8Array.from(blob);
		return new Float32Array(bytes.buffer);
	}

	// The cosine between a stored vector and the query, both in the form
	// prepare() produces -- the same score cosine() computes in JS. The query
	// binds as the JSON text vec_int8() reads rather than as a BLOB:
	// mozStorage reads an object bound as the first parameter as a set of
	// named parameters.
	//
	// @return {Object} - { sql, params }: the expression, and the value it
	//     binds ahead of the caller's own
	function _scoreExpression(query) {
		return {
			sql: '1 - vec_distance_cosine(vec_int8(embedding), vec_int8(?))',
			params: [JSON.stringify(Array.from(query))]
		};
	}

	// The columns saying where a chunk sits in its item, as _describeChunk()
	// reads them. The vector itself is never selected -- it's only ever used
	// for scoring, which happens in SQL.
	const CHUNK_COLUMNS = 'chunkIndex, startBlock, endBlock, startOffset, endOffset, '
		+ 'textCheck, sectionPart, sectionParts';

	// The shared guards of the scoring paths: wait out any in-progress model
	// switch, so a query isn't embedded with one model and compared against
	// another's vectors, and confirm the stored vectors were produced by the
	// active model -- during a switch, or a reindex after a revision bump,
	// the database isn't stamped for the new model until the indexer starts
	// filling it. Returns the model's calibration: indexing calibrates the
	// model before it writes a single vector, so a database stamped for this
	// model always has one to go with it -- but the numbers still have to be
	// read into memory, since getScoreFraction() reads them synchronously
	// while rendering.
	async function _requireReadyIndex() {
		await Zotero.Embeddings.Indexing.waitForPendingModelSwitch();
		await Zotero.Embeddings.initDB();
		let modelVersion = Zotero.Embeddings.getModelVersion();
		let indexedVersion = await Zotero.DB.valueQueryAsync(
			"SELECT value FROM embeddings.itemEmbeddingsMeta WHERE key='modelVersion'"
		);
		if (indexedVersion !== modelVersion) {
			throw new Zotero.Embeddings.IndexNotReadyError(
				`Embeddings index is for '${indexedVersion || 'no model'}', `
					+ `but the active model is '${modelVersion}'`
			);
		}
		let calibration = await Zotero.Embeddings.loadCalibration();
		if (!calibration) {
			throw new Zotero.Embeddings.IndexNotReadyError(
				`Embeddings index is stamped for '${modelVersion}' but the model `
					+ `has no calibration`
			);
		}
		return calibration;
	}

	/**
	 * Score a given set of items by similarity to a query. Items scoring below
	 * the model's measured minimum aren't matches and aren't returned (see
	 * Zotero.Embeddings.Calibration), and items without a stored embedding
	 * can't be scored at all. Used to apply semantic ranking within an
	 * existing result scope (e.g. the current collection) rather than the
	 * whole library.
	 *
	 * @param {String} queryText
	 * @param {Number[]} itemIDs - Candidate item IDs to score
	 * @param {Object} [options]
	 * @param {Function} [options.shouldCancel] - Checked between chunks;
	 *     return true to abandon scoring with a ScoringCancelledError (e.g.
	 *     because a newer query made this one obsolete)
	 * @return {Promise<Object>} - { scores, previewableIDs }: scores maps
	 *     itemID -> similarity score (higher is more similar);
	 *     previewableIDs holds the scored itemIDs with at least one
	 *     above-floor chunk that stores source references its text can be
	 *     re-derived from (see getMatchingChunks()) -- the items whose
	 *     match getMatchingChunks() can show. An item scored only by chunks
	 *     without references is its own preview and isn't in the set.
	 */
	this.scoreItemIDs = async function (queryText, itemIDs, { shouldCancel } = {}) {
		let scores = new Map();
		let previewableIDs = new Set();
		if (!itemIDs.length || !this.isEnabled()) {
			return { scores, previewableIDs };
		}
		let calibration = await _requireReadyIndex();
		let generation = _modelGeneration;
		let query = this.prepare(await this.embedQuery(queryText));
		let scoring = _scoreExpression(query);
		let minScore = calibration.minScore;

		// Score the candidates in chunks (avoids the SQLite bound-parameter
		// limit for large collections). SQLite scores every stored chunk and
		// reduces each item to the two numbers below, so ranking a library
		// hands JS a row per item rather than a vector per chunk. An item
		// stored as multiple text chunks scores as its best chunk, not an
		// average, so a long note that addresses the query in one paragraph
		// isn't diluted by the rest.
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
			// Rows without an embedding are processed-but-empty markers (see
			// _setUpDB()), with nothing to score
			let rows = await Zotero.DB.queryAsync(
				"SELECT itemID, MAX(score) AS score, "
					+ "MAX(CASE WHEN previewable THEN score END) AS previewableScore FROM ("
					+ "SELECT itemID, " + scoring.sql + " AS score, "
					+ "(startBlock IS NOT NULL OR startOffset IS NOT NULL) AS previewable "
					+ "FROM embeddings.itemEmbeddings WHERE itemID IN ("
					+ chunk.map(() => '?').join(',') + ") AND embedding IS NOT NULL"
					+ ") GROUP BY itemID",
				[...scoring.params, ...chunk]
			);
			for (let row of rows) {
				// A null score is a stored vector with no length: no match
				if (!(row.score >= minScore)) {
					continue;
				}
				scores.set(row.itemID, row.score);
				// An above-floor chunk with source references makes its item's
				// match showable; the chunk also puts the item's best at or
				// above the floor, so the set stays within the returned items
				if (row.previewableScore !== null && row.previewableScore >= minScore) {
					previewableIDs.add(row.itemID);
				}
			}
		}
		if (generation !== _modelGeneration) {
			throw new this.IndexNotReadyError('Model changed during scoring');
		}
		return { scores, previewableIDs };
	};

	/**
	 * The chunks of a single item most similar to a query, each with where in
	 * the item it came from -- for surfacing why an item matched (e.g. which
	 * section of an attachment's full text). Chunks scoring below the model's
	 * measured minimum aren't matches and aren't returned.
	 *
	 * The text and location fields describe attachment fulltext chunks. The
	 * stored rows carry only references into the attachment's extracted text
	 * (see the itemEmbeddings table), so the text is re-derived from the
	 * source here -- the SDT pack for chunks with block references, the flat
	 * text for the rest -- and verified against the row's fingerprint. A
	 * chunk whose source has drifted from what was embedded (the file or the
	 * extractor changed and reindexing hasn't caught up yet) comes back with
	 * null text and location rather than the wrong words. For other item
	 * types the fields are null, and the item itself is the preview and the
	 * location.
	 *
	 * @param {String} queryText
	 * @param {Number} itemID
	 * @param {Object} [options]
	 * @param {Number} [options.limit=3] - Most chunks to return; Infinity
	 *     for every chunk above the floor
	 * @return {Promise<Object[]>} - [{ chunkIndex, score, text, outlinePath,
	 *     startBlock, endBlock, pageLabel, position, sectionPart,
	 *     sectionParts }], best first, ties broken by position in the text.
	 *     chunkIndex is document order, for callers that want to re-sort.
	 */
	this.getMatchingChunks = async function (queryText, itemID, { limit = 3 } = {}) {
		if (!this.isEnabled()) {
			return [];
		}
		let calibration = await _requireReadyIndex();
		let query = this.prepare(await this.embedQuery(queryText));
		let scoring = _scoreExpression(query);
		let scored = await Zotero.DB.queryAsync(
			"SELECT * FROM ("
				+ "SELECT " + CHUNK_COLUMNS + ", " + scoring.sql + " AS score "
				+ "FROM embeddings.itemEmbeddings WHERE itemID=? AND embedding IS NOT NULL"
				+ ") WHERE score >= ? ORDER BY score DESC, chunkIndex",
			[...scoring.params, itemID, calibration.minScore]
		);
		scored = scored.slice(0, limit);
		let sources = await _loadChunkSources(itemID, scored);
		return scored.map((row, i) => Object.assign(
			_describeChunk(row, sources[i]),
			{ score: row.score }
		));
	};

	/**
	 * Every chunk an item is indexed as, in document order, with where in the
	 * item each came from -- for reading an item's own passages without a
	 * model's opinion of them. The text is re-derived and verified the same
	 * way getMatchingChunks() derives it.
	 *
	 * Unlike getMatchingChunks() this asks the model nothing, so it answers
	 * while the model is disabled or unready: the rows are a record of how
	 * the item was divided, which stands on its own. Deriving every chunk's
	 * text costs more than deriving a scored handful's, so this is for
	 * callers that need all of them.
	 *
	 * @param {Number} itemID
	 * @return {Promise<Object[]>} - [{ chunkIndex, text, outlinePath,
	 *     startBlock, endBlock, pageLabel, position, sectionPart,
	 *     sectionParts }], in document order
	 */
	this.getChunks = async function (itemID) {
		let rows = await _getChunkRows(itemID);
		if (!rows.length) {
			return [];
		}
		rows.sort((a, b) => a.chunkIndex - b.chunkIndex);
		let sources = await _loadChunkSources(itemID, rows);
		return rows.map((row, i) => _describeChunk(row, sources[i]));
	};

	/**
	 * How similar the model finds a query and each of the given texts, on the
	 * raw scale scoring compares with -- for choosing among passages of one
	 * item, where what matters is which scores highest rather than what the
	 * number means. No floor is applied: the caller has already decided the
	 * texts are worth reading.
	 *
	 * @param {String} queryText
	 * @param {String[]} texts
	 * @return {Promise<Number[]>} - A score for each text, in order
	 */
	this.scoreTexts = async function (queryText, texts) {
		if (!this.isEnabled() || !texts.length) {
			return texts.map(() => 0);
		}
		// prepare() centers with the measured mean, which has to be in memory
		await this.initDB();
		await this.loadCalibration();
		let query = this.prepare(await this.embedQuery(queryText));
		let vectors = await this.embedPassages(texts);
		return vectors.map(vector => this.cosine(query, this.prepare(vector)));
	};

	// The stored rows of an item's chunks. Attaches the database first, which
	// asking the model about the index would otherwise have done --
	// getChunks() never asks it anything.
	async function _getChunkRows(itemID) {
		await Zotero.Embeddings.initDB();
		return Zotero.DB.queryAsync(
			"SELECT " + CHUNK_COLUMNS + " "
				+ "FROM embeddings.itemEmbeddings WHERE itemID=? AND embedding IS NOT NULL",
			itemID
		);
	}

	// One chunk as callers see it: what the row records about where it sits,
	// with the text and location re-derived from its source
	function _describeChunk(row, source) {
		return {
			chunkIndex: row.chunkIndex,
			text: source.text,
			outlinePath: source.outlinePath,
			startBlock: row.startBlock,
			endBlock: row.endBlock,
			pageLabel: source.pageLabel,
			position: source.position,
			sectionPart: row.sectionPart,
			sectionParts: row.sectionParts
		};
	}

	/**
	 * Fingerprint of a chunk's text, for verifying a preview re-derived from
	 * a chunk row's source references against what was embedded (see
	 * getMatchingChunks()). Whitespace runs are collapsed first: a
	 * re-derivation joins the same extracted text with its own separators,
	 * and only the words matter.
	 *
	 * @param {String} text
	 * @return {String} - 8 hex characters
	 */
	this.textCheck = function (text) {
		return Zotero.Utilities.Internal.md5(text.replace(/\s+/g, ' ').trim()).slice(0, 8);
	};

	// Re-derive the text and location of the given chunk rows from their
	// stored source references: block ranges resolve against the
	// attachment's SDT pack, offset-only rows against its flat text (see the
	// itemEmbeddings table). Rows with no references (non-attachment chunks)
	// and rows whose derived text no longer matches their fingerprint yield
	// nulls.
	//
	// @return {Promise<Object[]>} - One { text, outlinePath, pageLabel,
	//     position } per row, in order
	async function _loadChunkSources(itemID, rows) {
		let sources = rows.map(() => ({
			text: null,
			outlinePath: null,
			pageLabel: null,
			position: null
		}));
		let blockRows = rows.filter(row => row.startBlock !== null);
		if (blockRows.length) {
			// isPriority: re-deriving a preview is user-initiated, and can
			// involve extraction when the cached pack is gone
			let result = await Zotero.SDT.getBlockRanges(
				itemID,
				blockRows.map(row => [row.startBlock, row.endBlock]),
				{ isPriority: true }
			);
			if (result.ok) {
				for (let i = 0; i < blockRows.length; i++) {
					_deriveFromBlocks(blockRows[i], result.ranges[i],
						sources[rows.indexOf(blockRows[i])]);
				}
			}
		}
		let flatRows = rows.filter(row => row.startBlock === null && row.startOffset !== null);
		if (flatRows.length) {
			let text = '';
			try {
				let item = await Zotero.Items.getAsync(itemID);
				if (item && item.isAttachment()) {
					text = await item.attachmentText || '';
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
			for (let row of flatRows) {
				let source = sources[rows.indexOf(row)];
				let sliced = text.slice(row.startOffset, row.endOffset);
				if (sliced && Zotero.Embeddings.textCheck(sliced) === row.textCheck) {
					source.text = sliced;
				}
			}
		}
		return sources;
	}

	// A chunk's text and location from the blocks its row references,
	// mirroring what indexing embedded: the blocks it counted -- reference
	// entries and outline headings never index, an auxiliary chunk is exactly
	// its own block, and body chunks skip auxiliary blocks (see
	// Indexing._toIndexableSections()) -- joined and cut to the row's
	// character offsets into the first and last block. Location is the first
	// block's, where the chunk starts. Nothing is filled in unless the
	// derived text matches the row's fingerprint.
	function _deriveFromBlocks(row, range, source) {
		if (!range) {
			return;
		}
		let auxiliary = row.startBlock === row.endBlock
			&& range.blocks[0]?.flowClass === 'auxiliary';
		let blocks = range.blocks.filter(block => block.text
			&& !block.reference && !block.outlineHeading
			&& (auxiliary ? block.index === row.startBlock : !block.flowClass));
		if (!blocks.length
				|| blocks[0].index !== row.startBlock
				|| blocks[blocks.length - 1].index !== row.endBlock) {
			return;
		}
		let joined = blocks.map(block => block.text).join('\n');
		let last = blocks[blocks.length - 1];
		let end = joined.length - last.text.length + row.endOffset;
		let text = joined.slice(row.startOffset, end);
		if (!text || Zotero.Embeddings.textCheck(text) !== row.textCheck) {
			return;
		}
		source.text = text;
		source.outlinePath = range.outlinePath || null;
		source.pageLabel = blocks[0].pageLabel ?? null;
		source.position = blocks[0].position ?? null;
	}
};


/**
 * Zotero.Embeddings.Chunking -- the shared chunker fitted to the active model.
 * Splitting a text into passages small enough to each be embedded on their own
 * keeps a long text's later paragraphs searchable instead of averaged into one
 * vector or truncated away. The geometry and the splitting live in
 * Zotero.Utilities.Internal.Chunking; this module caps the budget to the
 * model's window and reports passage sizes as estimated tokens.
 */
Zotero.Embeddings.Chunking = new function () {
	// The shared geometry: BUDGET_TOKENS caps a chunk within the model's
	// window (see _getBudget()); MIN_TOKENS is the least worth embedding
	// alone -- an item scores as its best chunk, so fragments would inflate
	// the score; OVERLAP_TOKENS is carried across a split, so a thought
	// spanning the boundary is searchable in both halves.
	const { BUDGET_TOKENS, MIN_TOKENS, OVERLAP_TOKENS } = Zotero.Utilities.Internal.Chunking;
	// Window taken by the special tokens wrapped around every input -- two
	// for the BERT-family models here; the budget's headroom absorbs more
	const SPECIAL_TOKENS = 2;

	// Headroom held back from the window: the character estimate can
	// undercount, and a chunk that overshoots loses its tail to the
	// pipeline's truncation
	const BUDGET_SAFETY = 0.9;

	// The shared ceiling capped to the model's window, less the special
	// tokens and the passage prefix embedPassages() prepends -- not part of
	// the text the chunker sees, but in the window once a chunk is embedded
	function _getBudget() {
		let prefix = Zotero.Embeddings.getPassagePrefix();
		let prefixTokens = prefix
			? Math.ceil(prefix.length / Zotero.Utilities.Internal.Chunking.getCharsPerToken(prefix))
			: 0;
		return Math.floor(
			(Math.min(BUDGET_TOKENS, Zotero.Embeddings.getModelMaxTokens())
				- SPECIAL_TOKENS - prefixTokens) * BUDGET_SAFETY
		);
	}

	// The shared chunker's metrics for the active model: counts estimated
	// from characters at the sample's chars-per-token scale. The estimate
	// errs both ways -- a misjudged small chunk merges or stands alone, an
	// overshooting one is truncated by the pipeline.
	function _getMetrics(sample) {
		let charsPerToken = Zotero.Utilities.Internal.Chunking.getCharsPerToken(sample);
		return {
			count: text => text.length / charsPerToken,
			joinSize: 2 / charsPerToken,
			budget: _getBudget(),
			minSize: MIN_TOKENS,
			overlap: OVERLAP_TOKENS
		};
	}


	/**
	 * Split a text into chunks that each fit the active model's window,
	 * sized in estimated tokens (see
	 * Zotero.Utilities.Internal.Chunking.chunkText()).
	 *
	 * @param {String} text
	 * @return {Object[]} - [{ text, tokens, start, end }]
	 */
	this.chunkText = function (text) {
		let metrics = _getMetrics(text);
		return _asTokens(Zotero.Utilities.Internal.Chunking.chunkText(text, metrics));
	};
	
	/**
	 * Estimated token count of a text -- the same character measure the
	 * chunkers size their chunks with, no model involved.
	 *
	 * @param {String} text
	 * @return {Number}
	 */
	this.estimateTokens = function (text) {
		return Math.round(
			text.length / Zotero.Utilities.Internal.Chunking.getCharsPerToken(text)
		);
	};


	/**
	 * Split a document's outline sections (see Zotero.SDT.getSections()) into
	 * chunks that each fit the active model's window, sized in estimated
	 * tokens and prefixed for embedding with their section's outline path
	 * (see Zotero.Utilities.Internal.Chunking.chunkSections()).
	 *
	 * @param {Object[]} sections
	 * @return {Object[]} - [{ text, embedText, tokens, outlinePath,
	 *     startBlock, endBlock, startOffset, endOffset, pageIndex, pageLabel,
	 *     position, sectionPart, sectionParts, auxiliary }], where tokens
	 *     counts embedText
	 */
	this.chunkSections = function (sections) {
		let sample = sections.map(section => section.text).join('\n\n');
		let metrics = _getMetrics(sample);
		return _asTokens(Zotero.Utilities.Internal.Chunking.chunkSections(sections, metrics));
	};

	// Chunks as this module reports them: the shared chunker sizes passages in
	// whatever it was handed, and what it was handed here is estimated tokens
	function _asTokens(chunks) {
		return chunks.map(({ size, ...chunk }) => ({ ...chunk, tokens: Math.round(size) }));
	}
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
	// The step a run is on (see _run()): getting the model, then each kind of
	// work in turn
	let _phase = 'idle';
	// 'idle' | 'downloading' | 'indexing' | 'extracting' | 'indexing-attachments'
	// Bytes of the model downloaded so far, while _phase is 'downloading'
	let _downloadProgress = null;
	// Attachments prepared so far ({ done, total }), while _phase is 'extracting'
	let _extractionProgress = null;
	let _lastError = null;
	// Indexed and eligible items, notes and annotations, and fulltext work
	// in chunks (see _getChunkCounts())
	let _itemCounts = { done: 0, total: 0 };
	let _chunkCounts = { done: 0, total: 0 };
	let _progressListeners = new Set();
	let _lastTick = 0;
	let _lastCountRefresh = 0;

	// The indexing queues. Producers (the item notifier, startIndexing()) only
	// add itemIDs here; _run() is the single consumer that drains them.
	//
	// Attachments queue separately because their work is a different job:
	// their text has to be extracted from a file before any of it can be
	// embedded, and that extraction costs orders of magnitude more than
	// everything else here. Keeping them apart is what lets a run be one
	// step at a time -- items, then extraction, then attachments (see
	// _run()) -- rather than three kinds of work interleaved.
	let _queue = new Set();
	let _attachmentQueue = new Set();
	let _kickTimer = null;

	// Tokens of text per engine call (see _indexItems()), in the model's own
	// tokens -- what the engine pads a batch to and what its memory scales
	// with. Under memory pressure this is halved, down to
	// DEGRADED_TOKEN_BUDGET_FLOOR, and the engine is shut down so the next
	// one's memory arena grows only to the smaller peak. Restored when the
	// pressure lifts.
	const DEFAULT_TOKEN_BUDGET = 3000;
	const DEGRADED_TOKEN_BUDGET_FLOOR = 400;
	let _tokenBudget = DEFAULT_TOKEN_BUDGET;

	// Don't start a run that would load the model with less than this much
	// memory available, since inference needs room well beyond the model files
	const MIN_AVAILABLE_MEMORY = 1.5 * 1024 * 1024 * 1024;

	// Wait longer than the usual debounce before retrying a run that was held
	// off for memory
	const LOW_MEMORY_RETRY_DELAY = 5 * 60 * 1000;
	// How often a run reports progress, and how often the per-library
	// counts -- a scan of the index -- are recomputed within that
	const PROGRESS_EMIT_INTERVAL = 1000;
	const COUNT_REFRESH_INTERVAL = 5000;
	// Debounce before starting the consumer, so a burst of changes (e.g. an
	// import) is picked up in one pass
	const KICK_DELAY = 3000;
	// itemIDs taken off a queue per pass of _indexItems(). A pass holds the
	// text of every chunk in the slice and sorts them by length, so this
	// bounds memory and how long the head of the queue waits behind the
	// rest; the regular queue is checked between passes.
	const QUEUE_SLICE_SIZE = 32;
	// Bump when chunking changes, so stored attachment rows are rebuilt (see
	// _getAttachmentSourceHash())
	const CHUNKER_VERSION = 2;

	// The inference process's memory arena only grows: fragmentation from
	// varying batch shapes accumulates and is never returned to the OS
	// (~650 MB/min measured), while throughput stays flat however large it
	// gets. Restarting the engine is the only reclaim and costs about a
	// second, so past this footprint it's restarted between batches.
	const INFERENCE_MEMORY_CAP = 1.5 * 1024 * 1024 * 1024;
	// Time of the process sample the last cap restart acted on, so each
	// sample triggers at most one
	let _restartedOnSample = 0;

	// Serialize model switches so rapid preference changes don't run their
	// clear/prune/re-index steps concurrently.
	let _switchChain = Promise.resolve();

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

		// Toggling fulltext indexing changes what's eligible: on, the newly
		// eligible attachments get indexed; off, their stored chunks are
		// pruned. Unlike a model switch, nothing already stored goes stale,
		// so the rest of the index is left alone.
		Zotero.Prefs.registerObserver('embeddings.indexFulltext', () => {
			_onIndexFulltextChange().catch(e => Zotero.logError(e));
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
						_enqueue(id);
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
		_clearCounts();

		if (Zotero.Embeddings.isEnabled()) {
			Zotero.Embeddings.Indexing.startIndexing();
		}
		else {
			_emitProgress();
		}
	}

	async function _onIndexFulltextChange() {
		if (!Zotero.Embeddings.isEnabled()) {
			return;
		}
		if (_indexFulltextEnabled()) {
			// Turning fulltext indexing on is a request to index the
			// attachments, so it also resumes a stopped indexer
			await Zotero.Embeddings.Indexing.startIndexing();
		}
		else {
			// The attachments are no longer eligible, so the ordinary orphan
			// pruning drops their chunks -- without restarting a paused indexer
			await Zotero.Embeddings.initDB();
			await _pruneOrphanedEmbeddings(await _getEligibleItemIDs());
			await Zotero.Embeddings.Indexing.refreshStatus();
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
			Zotero.Embeddings.shutdownEngine({ modelChanged: false })
				.catch(e => Zotero.logError(e));
		},
	};
	Services.obs.addObserver(_memoryPressureObserver, 'memory-pressure');
	Services.obs.addObserver(_memoryPressureObserver, 'memory-pressure-stop');

	// Reasons the engine may run at full thread count right now. Sources
	// ('prefs-open', 'user-idle') add and remove themselves independently.
	let _threadBoosts = new Set();

	/**
	 * Add or remove a reason to run the engine at full thread count. Applied
	 * at the next engine creation; an indexing run restarts its engine
	 * between batches when the count changed (see engineThreadsStale()).
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
	 * Thread count for the inference engine: the runtime's optimum while
	 * boosted -- the user is watching indexing progress or is away -- and
	 * half of it otherwise, trading wall time for heat during a long
	 * background index.
	 *
	 * @return {Number}
	 */
	this.getEngineThreads = function () {
		let optimal = Zotero.ML.getOptimalConcurrency();
		return _threadBoosts.size ? optimal : Math.max(1, Math.floor(optimal / 2));
	};


	/**
	 * Whether there's enough memory available to load the model and run
	 * inference. The runtime's own check is against total system memory, which
	 * says nothing about what's free right now.
	 *
	 * @return {Boolean}
	 */
	function _hasMemoryToIndex() {
		let available = Zotero.Embeddings.Diagnostics.getAvailableMemory();
		if (available && available < MIN_AVAILABLE_MEMORY) {
			Zotero.debug(`Embeddings: only ${Math.round(available / 1024 / 1024)} MB `
				+ "available -- not indexing yet");
			return false;
		}
		return true;
	}

	// Put an itemID on the queue its kind of work belongs to. An item the
	// cache can't type goes to the regular queue, which routes it when it
	// loads (see _drainItemQueue()).
	function _enqueue(itemID) {
		if (Zotero.Items.get(itemID)?.isAttachment()) {
			if (_indexFulltextEnabled()) {
				_attachmentQueue.add(itemID);
			}
			return;
		}
		_queue.add(itemID);
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
		if ((!_queue.size && !_attachmentQueue.size) || !Zotero.Embeddings.isEnabled()
				|| Zotero.Embeddings.Indexing.isPaused()) {
			return Promise.resolve();
		}
		_indexingPromise = _run();
		return _indexingPromise;
	}

	// The single definition of an eligible item, in any library:
	// - a regular item with at least two words in its title (including
	//   type-specific title fields -- caseName, subject, nameOfAct) or in its
	//   abstract
	// - a note with at least three words in its plain text
	// - an annotation with at least three words across the passage it marks
	//   and its comment
	// - with fulltext indexing enabled, a PDF/EPUB/snapshot attachment. Its
	//   text lives in a file, so there's no cheap word test here: one that
	//   yields no text at indexing time is recorded as processed instead
	//   (see _indexItems()), so the progress counts still converge.
	// Everything that needs to know what's eligible -- enqueueing, pruning,
	// progress counts -- works from this result, and _indexItems() skips items
	// by the same per-type tests (see _getIndexableText()), so the counts and
	// the index stay in agreement.
	//
	// Attachments are kept apart from the rest: their text costs orders of
	// magnitude more to index, so they're enqueued last, ordered most
	// recently touched first, and reported on their own line rather than
	// buried in one total that barely moves.
	//
	// @return {Promise<Map>} - libraryID -> { items: [itemID, ...],
	//     attachments: [itemID, ...] }
	async function _getEligibleItemIDs() {
		let fieldIDs = Zotero.Embeddings.getIndexedFieldIDs();
		let byLibrary = new Map();
		let seen = new Set();
		let add = (row, kind = 'items') => {
			if (seen.has(row.itemID)) {
				return;
			}
			seen.add(row.itemID);
			let eligible = byLibrary.get(row.libraryID);
			if (!eligible) {
				eligible = { items: [], attachments: [] };
				byLibrary.set(row.libraryID, eligible);
			}
			eligible[kind].push(row.itemID);
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
			// The title is the note's first line, so its words are among the
			// note's own -- a title with enough of them settles it without
			// stripping the body's HTML
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
		if (_indexFulltextEnabled()) {
			// Attachments the user touched most recently go first -- read,
			// modified, annotated, or with a recently edited parent or sibling
			// note -- since those are what they're most likely to search for.
			// Compared as integer seconds: strftime() returns text, which
			// SQLite sorts above every integer
			const EPOCH_SECONDS = "CAST(strftime('%s', {0}) AS INTEGER)";
			let epoch = column => EPOCH_SECONDS.replace('{0}', column);
			// The SQL mirror of _isIndexableAttachment(): stored or linked
			// PDFs and EPUBs, and snapshots (which are always stored)
			rows = await Zotero.DB.queryAsync(
				"SELECT I.libraryID, I.itemID FROM itemAttachments IA "
					+ "JOIN items I USING (itemID) "
					+ "LEFT JOIN items P ON (P.itemID=IA.parentItemID) "
					+ "WHERE (IA.contentType IN ('application/pdf', 'application/epub+zip') "
						+ "AND IA.linkMode!=?) "
					+ "OR (IA.contentType='text/html' AND IA.linkMode=?) "
					+ "ORDER BY MAX("
						+ "COALESCE(IA.lastRead, 0), "
						+ epoch('I.dateModified') + ", "
						+ "COALESCE(" + epoch('P.dateModified') + ", 0), "
						+ "COALESCE((SELECT MAX(" + epoch('AI.dateModified') + ") "
							+ "FROM itemAnnotations AN JOIN items AI USING (itemID) "
							+ "WHERE AN.parentItemID=IA.itemID), 0), "
						+ "COALESCE((SELECT MAX(" + epoch('NI.dateModified') + ") "
							+ "FROM itemNotes N JOIN items NI USING (itemID) "
							+ "WHERE N.parentItemID=IA.parentItemID), 0)"
					+ ") DESC, I.itemID",
				[
					Zotero.Attachments.LINK_MODE_LINKED_URL,
					Zotero.Attachments.LINK_MODE_IMPORTED_URL
				]
			);
			for (let row of rows) {
				add(row, 'attachments');
			}
		}
		return byLibrary;
	}

	// Whether attachment full text is part of the index (see the
	// embeddings.indexFulltext pref)
	function _indexFulltextEnabled() {
		return !!Zotero.Prefs.get('embeddings.indexFulltext');
	}

	// Whether an item is an attachment whose full text can be indexed --
	// the types Zotero.SDT can extract structured text from
	function _isIndexableAttachment(item) {
		return item.isPDFAttachment() || item.isEPUBAttachment() || item.isSnapshotAttachment();
	}

	// The stored text an annotation's eligibility is judged by, shared by the
	// SQL-side eligibility pass and _indexItems() so both test the same thing.
	// A cheap tag strip -- annotation text and comments carry only simple
	// inline markup.
	function _getAnnotationRawText(text, comment) {
		return [text, comment].filter(Boolean).join(' ').replace(/<\/?[a-z][^>]*>/gi, ' ');
	}

	// Enqueue every eligible item, each kind on its queue. The consumer
	// takes the regular queue first, so every library's metadata is indexed
	// -- cheap, and immediately useful -- before the far slower document
	// work starts anywhere.
	function _enqueueAllLibraries(eligibleByLibrary) {
		for (let library of _indexableLibraries()) {
			let eligible = eligibleByLibrary.get(library.libraryID);
			if (!eligible) {
				continue;
			}
			for (let id of eligible.items) {
				_queue.add(id);
			}
			for (let id of eligible.attachments) {
				_attachmentQueue.add(id);
			}
		}
	}

	// Drop stored embeddings for items that are no longer eligible (e.g. the
	// title and abstract were cleared).
	async function _pruneOrphanedEmbeddings(eligibleByLibrary) {
		await Zotero.Embeddings.initDB();
		let eligible = new Set();
		for (let { items, attachments } of eligibleByLibrary.values()) {
			for (let id of items) {
				eligible.add(id);
			}
			for (let id of attachments) {
				eligible.add(id);
			}
		}
		let stored = await Zotero.DB.columnQueryAsync(
			"SELECT DISTINCT itemID FROM embeddings.itemEmbeddings "
				+ "UNION SELECT itemID FROM embeddings.itemChunkCounts"
		);
		await _deleteEmbeddings(stored.filter(id => !eligible.has(id)));
	}

	// Delete the stored embeddings and chunk counts for the given items, in
	// chunks (avoids the SQLite bound-parameter limit)
	async function _deleteEmbeddings(itemIDs) {
		await Zotero.Embeddings.initDB();
		let chunkSize = 500;
		for (let i = 0; i < itemIDs.length; i += chunkSize) {
			let chunk = itemIDs.slice(i, i + chunkSize);
			let placeholders = chunk.map(() => '?').join(',');
			await Zotero.DB.queryAsync(
				"DELETE FROM embeddings.itemEmbeddings WHERE itemID IN (" + placeholders + ")",
				chunk
			);
			await Zotero.DB.queryAsync(
				"DELETE FROM embeddings.itemChunkCounts WHERE itemID IN (" + placeholders + ")",
				chunk
			);
		}
	}

	// Delete all stored item embeddings and chunk counts (chunks are sized to
	// the model's window, so the counts go with the vectors). This removes
	// the computed vectors, not the downloaded model files.
	async function _clearEmbeddings() {
		await Zotero.Embeddings.initDB();
		await Zotero.DB.queryAsync("DELETE FROM embeddings.itemEmbeddings");
		await Zotero.DB.queryAsync("DELETE FROM embeddings.itemChunkCounts");
	}

	// Indexed items, notes and annotations -- the numerator for their
	// progress; an item's chunks count as one item. Attachments are measured
	// in chunks instead (see _getChunkCounts()).
	async function _getIndexedItemCount() {
		return Zotero.DB.valueQueryAsync(
			"SELECT COUNT(DISTINCT itemID) FROM embeddings.itemEmbeddings "
				+ "JOIN items USING (itemID) WHERE itemTypeID!=?",
			Zotero.ItemTypes.getID('attachment')
		);
	}

	// Counts after the stored index is cleared: nothing done, and no chunk
	// counts until attachments are extracted again
	function _clearCounts() {
		_itemCounts = { done: 0, total: _itemCounts.total };
		_chunkCounts = { done: 0, total: 0 };
	}


	// Built once: for scripts without spaces the segmenter is dictionary-backed
	let _wordSegmenter = null;

	// Whether text has at least minWords words, counted with the locale-aware
	// segmenter so scripts that don't separate words with spaces (Chinese,
	// Japanese, Thai) are counted at their real word boundaries rather than by
	// whitespace. Only segments with a letter in them count as words: bare
	// numbers and dates ("2024-03-15") are placeholders, not content.
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

	// Convert stored HTML to plain text. Notes keep their block structure as
	// line breaks, so the chunker can split at paragraph boundaries;
	// annotation text and comments are inline and stripped flat, the same way
	// their display titles are built.
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

	// The text we embed for an item, or null when the item doesn't have enough
	// to index. The per-type word tests are the same ones
	// _getEligibleItemIDs() applies to its SQL rows, so an item comes back
	// null here exactly when the eligibility counts exclude it:
	// - regular item: its title and abstract, each judged on its own words the
	//   way the eligibility pass sees its rows -- a title alone is enough,
	//   since it's useful signal even without an abstract
	// - note: its full plain text (the eligibility pass's title shortcut is
	//   just a cheaper route to the same answer, since the title's words are
	//   among the note's own)
	// - annotation: the passage it marks together with its comment, judged on
	//   the same raw fields the eligibility pass reads
	function _getIndexableText(item) {
		if (item.isNote()) {
			let text = _htmlToText(item.getNote(), true);
			return _hasEmbeddableText(text) ? text : null;
		}
		if (item.isAnnotation()) {
			let raw = _getAnnotationRawText(item.annotationText, item.annotationComment);
			if (!_hasEmbeddableText(raw)) {
				return null;
			}
			let text = _htmlToText(item.annotationText);
			let comment = _htmlToText(item.annotationComment);
			if (text && comment) {
				return `${text}\n\n${comment}`;
			}
			return text || comment || null;
		}
		// Include type-specific title fields (caseName, subject, nameOfAct)
		let title = item.getField('title', false, true);
		let abstract = item.getField('abstractNote');
		if (!_hasEmbeddableText(title, 2) && !_hasEmbeddableText(abstract, 2)) {
			return null;
		}
		if (title && abstract) {
			return `${title}\n\n${abstract}`;
		}
		return title || abstract;
	}

	// The staleness key for an attachment's stored chunks, standing in for
	// the text hash other item types use. Derived from the file's identity
	// (path, size, mtime) rather than its extracted text, so the skip check
	// every indexing pass runs costs a stat rather than an extraction. The
	// extractor's version is part of it, and so is CHUNKER_VERSION: stored
	// rows are resumed by chunk index, so a change to how text is chunked
	// has to invalidate them. Returns null when the attachment has no
	// readable file, which also means there's nothing to extract.
	async function _getAttachmentSourceHash(item) {
		try {
			let path = await item.getFilePathAsync();
			if (!path) {
				return null;
			}
			let { size, lastModified } = await IOUtils.stat(path);
			let extractor = await Zotero.SDT.getProcessorVersion(item);
			return Zotero.Utilities.Internal.md5(
				[path, size, lastModified, extractor, CHUNKER_VERSION].join('|'));
		}
		catch (e) {
			if (e.name !== 'NotFoundError') {
				Zotero.logError(e);
			}
			return null;
		}
	}

	// The document's sections (see Zotero.SDT.getSections()) as things to
	// index. Reference entries are dropped: a bibliography is keyword-dense
	// but says nothing, so it crowds out real matches, and literal search
	// still covers it via the fulltext index. Auxiliary blocks are dropped
	// for now: the class mixes captions with equations, axis labels and
	// index entries. To revisit once the extractor tells those apart.
	function _toIndexableSections(sections) {
		let indexable = [];
		for (let section of sections) {
			let body = section.blocks.filter(
				block => !block.reference && block.flowClass !== 'auxiliary');
			if (body.length) {
				indexable.push({
					// The newline joins are part of the chunkSections()
					// contract: they're what lets a chunk's extent map back
					// to its blocks
					text: body.map(block => block.text).join('\n'),
					outlinePath: section.outlinePath,
					startBlock: body[0].index,
					blocks: body
				});
			}
		}
		return indexable;
	}

	/**
	 * The embeddable chunks of an attachment's full text: its outline
	 * sections (extracted by Zotero.SDT), split to fit the model window. A
	 * document with no structured text falls back to paragraph chunking of
	 * its plain text, without section locations.
	 *
	 * Each chunk locates its text in the document by block and offset rather
	 * than copying it, so this waits for a current extraction instead of
	 * accepting one from an older processor, whose blocks it would point
	 * past.
	 *
	 * @param {Zotero.Item} item - A PDF, EPUB or snapshot attachment
	 * @return {Promise<Object[]|null>} - Null when there's no embeddable
	 *     text at all
	 */
	this.getAttachmentChunks = async function (item) {
		let result = await Zotero.SDT.getSections(item.id, { allowStale: false });
		let sections = result.ok ? _toIndexableSections(result.sections) : [];
		// The word minimum applies to the document as a whole, not each
		// section: short sections are real content that the chunker merges,
		// but a document without three words anywhere gives the model nothing
		// to rank
		if (sections.length
				&& _hasEmbeddableText(sections.map(section => section.text).join(' '))) {
			return Zotero.Embeddings.Chunking.chunkSections(sections);
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
		// Flat text has no sections, so the whole document plays that role:
		// the part numbering says where in it a chunk falls, and the chunk's
		// extent in the flat text is its source reference
		let chunks = Zotero.Embeddings.Chunking.chunkText(text);
		return chunks.map((chunk, index) => ({
			text: chunk.text,
			tokens: chunk.tokens,
			startOffset: chunk.start,
			endOffset: chunk.end,
			sectionPart: index + 1,
			sectionParts: chunks.length
		}));
	};

	// The stored source hash of each of the given items that has rows, read
	// in one query per chunk rather than one per item (every start
	// re-enqueues the whole library to find what changed). Every chunk row
	// of an item carries the same hash.
	async function _getStoredHashes(itemIDs) {
		let storedHashes = new Map();
		let chunkSize = 500;
		for (let i = 0; i < itemIDs.length; i += chunkSize) {
			let chunk = itemIDs.slice(i, i + chunkSize);
			let rows = await Zotero.DB.queryAsync(
				"SELECT DISTINCT itemID, sourceHash FROM embeddings.itemEmbeddings "
					+ "WHERE itemID IN (" + chunk.map(() => '?').join(',') + ")",
				chunk
			);
			for (let row of rows) {
				storedHashes.set(row.itemID, row.sourceHash);
			}
		}
		return storedHashes;
	}

	// The given attachments whose stored embeddings are incomplete or stale
	// -- the ones the embedding pass will read packs for. An indexed
	// attachment won't be re-embedded and a fileless one has nothing to
	// extract, so neither needs a pack.
	async function _staleAttachments(itemIDs, shouldStop) {
		let items = await Zotero.Items.getAsync(itemIDs);
		let ledger = await _getChunkCountRows(itemIDs);
		let stale = [];
		for (let item of items) {
			if (shouldStop()) {
				break;
			}
			let hash = await _getAttachmentSourceHash(item);
			if (hash && !_isIndexed(ledger.get(item.id), hash)) {
				stale.push({ item, hash });
			}
		}
		return stale;
	}

	// The ledger rows (see itemChunkCounts in _setUpDB()) of the given
	// attachments, as itemID -> { sourceHash, chunks, embedded }
	async function _getChunkCountRows(itemIDs) {
		let ledger = new Map();
		let chunkSize = 500;
		for (let i = 0; i < itemIDs.length; i += chunkSize) {
			let chunk = itemIDs.slice(i, i + chunkSize);
			let rows = await Zotero.DB.queryAsync(
				"SELECT itemID, sourceHash, chunks, embedded FROM embeddings.itemChunkCounts "
					+ "WHERE itemID IN (" + chunk.map(() => '?').join(',') + ")",
				chunk
			);
			for (let row of rows) {
				ledger.set(row.itemID, row);
			}
		}
		return ledger;
	}

	// Whether a ledger row says every chunk of the source `hash` is stored
	function _isIndexed(row, hash) {
		return !!row && row.sourceHash === hash && row.embedded >= row.chunks;
	}

	// Record how many chunks an attachment's current source splits into and
	// how many are stored
	async function _storeChunkCount(itemID, hash, chunks, embedded = 0) {
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.itemChunkCounts (itemID, sourceHash, chunks, embedded) "
				+ "VALUES (?, ?, ?, ?)",
			[itemID, hash, chunks, embedded]
		);
	}

	// Recount an attachment's stored chunks in the ledger, from the rows
	async function _updateEmbeddedCount(itemID, hash) {
		await Zotero.DB.queryAsync(
			"UPDATE embeddings.itemChunkCounts SET embedded=("
				+ "SELECT COUNT(*) FROM embeddings.itemEmbeddings "
				+ "WHERE itemID=? AND sourceHash=? AND embedding IS NOT NULL"
			+ ") WHERE itemID=?",
			[itemID, hash, itemID]
		);
	}

	// Store one chunk's vector, centered and quantized (see
	// Zotero.Embeddings.prepare()). Source references are stored only for
	// attachments, whose text lives in a file: they're what the search
	// preview is re-derived from (see getMatchingChunks()). Other item types
	// are their own preview.
	async function _insertChunkRow(entry, chunkIndex, vector) {
		let chunk = entry.chunks[chunkIndex];
		let isAttachment = entry.item.isAttachment();
		let stored = Zotero.Embeddings.prepare(vector);
		let blob = new Uint8Array(stored.buffer, stored.byteOffset, stored.byteLength);
		// Keep the embedding blob out of debug output
		await Zotero.DB.queryAsync(
			"INSERT INTO embeddings.itemEmbeddings "
				+ "(itemID, chunkIndex, embedding, sourceHash, "
				+ "startBlock, endBlock, startOffset, endOffset, "
				+ "textCheck, sectionPart, sectionParts, tokens) "
				+ "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			[
				entry.item.id,
				chunkIndex,
				blob,
				entry.hash,
				chunk.startBlock ?? null,
				chunk.endBlock ?? null,
				isAttachment ? chunk.startOffset ?? null : null,
				isAttachment ? chunk.endOffset ?? null : null,
				isAttachment ? Zotero.Embeddings.textCheck(chunk.text) : null,
				chunk.sectionPart ?? null,
				chunk.sectionParts ?? null,
				chunk.tokens ?? null
			],
			{ debugParams: false }
		);
	}

	// Embed the regular queue -- items, notes and annotations -- a slice at
	// a time until it's empty or the run stops
	async function _drainItemQueue(shouldStop, indexOptions) {
		_setPhase('indexing');
		while (_queue.size && !shouldStop()) {
			let itemIDs = [];
			for (let id of _queue) {
				itemIDs.push(id);
				_queue.delete(id);
				if (itemIDs.length >= QUEUE_SLICE_SIZE) {
					break;
				}
			}
			// Deleted items simply aren't returned; their embeddings are
			// removed by the delete notifier
			let items = await Zotero.Items.getAsync(itemIDs);
			for (let item of items) {
				// Enqueued before the cache could type it (see _enqueue())
				if (item.isAttachment()) {
					if (_indexFulltextEnabled()) {
						_attachmentQueue.add(item.id);
					}
				}
			}
			items = items.filter(item => item.isRegularItem() || item.isNote()
				|| item.isAnnotation());
			if (items.length) {
				await _indexItems(items, indexOptions());
			}
		}
	}

	// Embed attachments whose text is extracted and cached, a slice at a
	// time. Gives way when the regular queue has new work, putting back
	// what's left --
	// its packs are cached, so the next cycle resumes without extracting
	// again.
	async function _embedAttachments(itemIDs, shouldStop, indexOptions) {
		_setPhase('indexing-attachments');
		for (let i = 0; i < itemIDs.length; i += QUEUE_SLICE_SIZE) {
			if (shouldStop()) {
				return;
			}
			if (_queue.size) {
				for (let itemID of itemIDs.slice(i)) {
					_attachmentQueue.add(itemID);
				}
				return;
			}
			let items = (await Zotero.Items.getAsync(itemIDs.slice(i, i + QUEUE_SLICE_SIZE)))
				.filter(item => _indexFulltextEnabled() && _isIndexableAttachment(item));
			if (items.length) {
				await _indexItems(items, indexOptions());
			}
		}
	}

	// Extract the structured text of the attachments about to be embedded, so
	// the embedding step reads cached packs instead of extracting inline. An
	// attachment whose chunks are counted for its current source was
	// extracted then and is skipped, so a resumed run has nothing to prepare.
	//
	// Runs with the engine shut down: extraction takes a long while, and the
	// model would otherwise sit in memory throughout, competing with the
	// worker for the same cores.
	async function _extractAttachments(itemIDs, shouldStop) {
		let stale = await _staleAttachments(itemIDs, shouldStop);
		let counted = await _getChunkCountRows(stale.map(({ item }) => item.id));
		let toExtract = stale.filter(({ item, hash }) => counted.get(item.id)?.sourceHash !== hash);
		if (!toExtract.length) {
			return;
		}
		_setPhase('extracting');
		await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
		let progress = { done: 0, total: toExtract.length };
		_extractionProgress = progress;
		_emitProgress();
		try {
			for (let { item, hash } of toExtract) {
				if (shouldStop()) {
					return;
				}
				await Zotero.SDT.ensure(item.id);
				// Counted while the pack is fresh, through the same derivation
				// the embedder uses so the two can't disagree
				let chunks = await Zotero.Embeddings.Indexing.getAttachmentChunks(item);
				await _storeChunkCount(item.id, hash, chunks ? chunks.length : 0);
				progress.done++;
				await _tick();
			}
		}
		finally {
			if (_extractionProgress === progress) {
				_extractionProgress = null;
			}
		}
	}

	// Compute and store embeddings for the given items, skipping any whose
	// stored embedding is already up to date (via sourceHash). Items with no
	// embeddable text have any existing embedding removed.
	//
	// @param {Zotero.Item[]} items
	// @param {Object} [options]
	// @param {Function} [options.onProgress] - Called after every batch as
	//     { done, total } items
	// @param {Number} [options.maxBatchItems=20] - Most items per engine call
	// @param {Number} [options.batchTokenBudget=3000] - Most tokens per engine
	//     call, counting every text in the batch as long as its longest one,
	//     since they're padded to that length.
	// @param {Function} [options.shouldStop] - Called before each batch;
	//     return true to stop early
	// @return {Promise<Number>} - Number of embeddings stored
	async function _indexItems(items, {
		onProgress,
		maxBatchItems = 20,
		batchTokenBudget = 3000,
		shouldStop
	} = {}) {
		await Zotero.Items.loadDataTypes(items, ['itemData', 'note', 'annotation']);

		let storedHashes = await _getStoredHashes(items.map(item => item.id));
		let ledger = await _getChunkCountRows(
			items.filter(item => item.isAttachment()).map(item => item.id));

		let toEmbed = [];
		let toDelete = [];
		for (let item of items) {
			// An attachment's text lives in a file, so its staleness check is
			// a file-identity hash rather than a text hash -- reading and
			// sectioning every attachment on every pass would defeat the
			// check's purpose -- and the ledger says whether all of its
			// chunks are stored
			if (item.isAttachment()) {
				let hash = await _getAttachmentSourceHash(item);
				if (!hash) {
					if (ledger.has(item.id) || storedHashes.has(item.id)) {
						toDelete.push(item.id);
					}
					continue;
				}
				if (!_isIndexed(ledger.get(item.id), hash)) {
					toEmbed.push({ item, hash });
				}
				continue;
			}
			let text = _getIndexableText(item);
			if (!text) {
				if (storedHashes.has(item.id)) {
					toDelete.push(item.id);
				}
				continue;
			}
			let hash = Zotero.Utilities.Internal.md5(text);
			if (storedHashes.get(item.id) !== hash) {
				toEmbed.push({ item, text, hash });
			}
		}
		if (toDelete.length) {
			await _deleteEmbeddings(toDelete);
		}

		// Derive each entry's chunks. Notes are split to fit the model's
		// context window; attachments are extracted (see
		// getAttachmentChunks()) and split section by section. A title and
		// abstract, or an annotation's passage and comment, fit the window in
		// almost all cases, so they're embedded as a single chunk and the
		// pipeline truncates the rare outlier.
		for (let entry of toEmbed) {
			// Extracting an attachment and tokenizing a chunk's worth of long
			// notes take real time, and a stop request can be a model switch
			// that's about to clear the vectors -- so bail out here as well,
			// rather than only between batches. No embeddings have been
			// written yet at this point, only the stale-item deletions above,
			// which hold regardless.
			if (shouldStop && shouldStop()) {
				return 0;
			}
			if (entry.item.isAttachment()) {
				entry.chunks = await Zotero.Embeddings.Indexing
					.getAttachmentChunks(entry.item);
				// Nothing embeddable anywhere in the attachment (missing
				// file, password-protected, no text layer). Recorded below
				// anyway, so the item counts as processed and isn't looked
				// at again until the file changes.
				if (!entry.chunks) {
					entry.chunks = [];
				}
			}
			else if (entry.item.isNote()) {
				// chunkText() already carries each chunk's token count
				entry.chunks = Zotero.Embeddings.Chunking.chunkText(entry.text);
			}
			else {
				// Item text is embedded whole, so it never passes through a
				// chunker and has to be counted here
				entry.chunks = [{
					text: entry.text,
					tokens: Zotero.Embeddings.Chunking.estimateTokens(entry.text)
				}];
			}
			entry.vectors = new Array(entry.chunks.length);
			entry.remaining = entry.chunks.length;
			entry.stored = new Set();
		}
		// Prepare the attachments' rows: drop what an older source or a
		// longer text left, keep the current source's rows so an interrupted
		// item resumes where it stopped, and bring the ledger in line. One
		// with nothing to embed is complete at zero chunks.
		let attachmentEntries = toEmbed.filter(entry => entry.item.isAttachment());
		if (attachmentEntries.length) {
			await Zotero.DB.executeTransaction(async function () {
				for (let entry of attachmentEntries) {
					// The item may have been deleted while we were extracting
					if (!Zotero.Items.get(entry.item.id)) {
						continue;
					}
					await Zotero.DB.queryAsync(
						"DELETE FROM embeddings.itemEmbeddings "
							+ "WHERE itemID=? AND (sourceHash!=? OR chunkIndex>=?)",
						[entry.item.id, entry.hash, entry.chunks.length]
					);
					entry.stored = new Set(await Zotero.DB.columnQueryAsync(
						"SELECT chunkIndex FROM embeddings.itemEmbeddings WHERE itemID=?",
						entry.item.id
					));
					entry.remaining -= entry.stored.size;
					await _storeChunkCount(
						entry.item.id, entry.hash, entry.chunks.length, entry.stored.size);
				}
			});
		}
		toEmbed = toEmbed.filter(entry => entry.remaining > 0);

		// What gets embedded is the chunk's embedText (its text plus any
		// outline-path context); plain chunks embed their text as is.
		let embedText = chunk => chunk.embedText || chunk.text;

		// Batches are packed from the flattened chunks, so an item's chunks
		// can span batches. An attachment's rows are written as each batch
		// finishes, since the ledger says when it's complete; any other
		// item's are written once every chunk is in, since its rows' hash
		// alone marks it done.
		let units = [];
		for (let entry of toEmbed) {
			for (let chunkIndex = 0; chunkIndex < entry.chunks.length; chunkIndex++) {
				if (!entry.stored.has(chunkIndex)) {
					units.push({ entry, chunkIndex });
				}
			}
		}
		// Pack batches from chunks of similar size, measured in the model's
		// own tokens -- what the engine pads a batch to, and what its memory
		// and compute scale with. The engine pads every text in a batch to its
		// longest one, so one long chunk makes a whole mixed batch pay
		// long-chunk price. Sorting the individual chunks (an item's chunks
		// legitimately range from captions to window-sized body text) roughly
		// halves fulltext indexing time versus item-level ordering.
		units.sort((a, b) => a.entry.chunks[a.chunkIndex].tokens
			- b.entry.chunks[b.chunkIndex].tokens);
		Zotero.Embeddings.Diagnostics.startSlice(units.length);

		let done = 0;
		for (let i = 0; i < units.length;) {
			if (shouldStop && shouldStop()) {
				break;
			}
			// Take as many of the next texts as fit the budget, always at
			// least one
			let longest = 0;
			let count = 0;
			while (i + count < units.length && count < maxBatchItems) {
				let unit = units[i + count];
				let tokens = Math.max(longest, unit.entry.chunks[unit.chunkIndex].tokens);
				if (count && tokens * (count + 1) > batchTokenBudget) {
					break;
				}
				longest = tokens;
				count++;
			}
			let batch = units.slice(i, i + count);
			i += count;
			let started = Date.now();
			let vectors = await Zotero.Embeddings.embedPassages(
				batch.map(unit => embedText(unit.entry.chunks[unit.chunkIndex]))
			);
			Zotero.Embeddings.Diagnostics.recordBatch({
				chunks: batch.length,
				tokens: batch.reduce((sum, unit) => sum + unit.entry.chunks[unit.chunkIndex].tokens, 0),
				longest,
				inferenceMs: Date.now() - started
			});
			// The arena's only reclaim is a restart (see INFERENCE_MEMORY_CAP)
			let sample = Zotero.Embeddings.Diagnostics.getProcessSample();
			if (sample?.inference?.memory > INFERENCE_MEMORY_CAP
					&& sample.time !== _restartedOnSample) {
				_restartedOnSample = sample.time;
				let footprintMB = Math.round(sample.inference.memory / 1024 / 1024);
				await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
				Zotero.Embeddings.Diagnostics.recordRestart('memory');
				Zotero.debug(`Embeddings: inference process at ${footprintMB} MB `
					+ '-- engine restarted to release its memory');
			}
			// A thread-boost change applies at the next engine, so restart
			// between batches, never mid-request
			else if (Zotero.Embeddings.engineThreadsStale()) {
				await Zotero.Embeddings.shutdownEngine({ modelChanged: false });
				Zotero.Embeddings.Diagnostics.recordRestart('threads');
				Zotero.debug('Embeddings: engine restarted to apply new thread count');
			}
			let completed = [];
			// prepare() centers with the measured mean, which has to be in memory
			await Zotero.Embeddings.loadCalibration();
			await Zotero.DB.executeTransaction(async function () {
				let touched = new Set();
				for (let j = 0; j < batch.length; j++) {
					let { entry, chunkIndex } = batch[j];
					if (entry.item.isAttachment()) {
						// The item may have been deleted while the batch was
						// embedding -- don't write its vectors back after the
						// delete notifier removed them
						if (Zotero.Items.get(entry.item.id)) {
							await _insertChunkRow(entry, chunkIndex, vectors[j]);
							touched.add(entry);
						}
					}
					else {
						entry.vectors[chunkIndex] = vectors[j];
					}
					if (--entry.remaining === 0) {
						completed.push(entry);
					}
				}
				for (let entry of touched) {
					await _updateEmbeddedCount(entry.item.id, entry.hash);
				}
				for (let entry of completed) {
					if (entry.item.isAttachment() || !Zotero.Items.get(entry.item.id)) {
						continue;
					}
					// Replace the item's rows as a unit, so a previously
					// longer text never leaves stale chunks behind
					await Zotero.DB.queryAsync(
						"DELETE FROM embeddings.itemEmbeddings WHERE itemID=?",
						entry.item.id
					);
					for (let k = 0; k < entry.vectors.length; k++) {
						await _insertChunkRow(entry, k, entry.vectors[k]);
					}
				}
			});
			done += completed.length;
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

	/**
	 * Current runner state, for the preferences UI.
	 *
	 * Progress comes in two disjoint pairs: `items` counts items, notes and
	 * annotations, and `chunks` measures attachment fulltext -- a far bigger
	 * and slower job -- in chunks stored so far.
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
			// What each queue still holds, for telling a run that's stuck
			// from one that's merely long
			queued: { items: _queue.size, attachments: _attachmentQueue.size },
			downloadProgress: _downloadProgress,
			extractionProgress: _extractionProgress,
			items: _itemCounts,
			chunks: _chunkCounts,
			// Seconds until the fulltext work is embedded, at the current rate.
			// Unknown while extraction is still adding to the total.
			eta: _phase === 'extracting'
				? null
				: Zotero.Embeddings.Diagnostics.estimateSeconds(_chunkCounts.total - _chunkCounts.done),
			diagnostics: {
				...Zotero.Embeddings.Diagnostics.getStatus(),
				tokenBudget: _tokenBudget,
				engine: {
					threads: this.getEngineThreads(),
					optimalThreads: Zotero.ML.getOptimalConcurrency(),
					boosts: [..._threadBoosts]
				}
			},
			error: _lastError ? (_lastError.message || String(_lastError)) : null
		};
	};

	this.addProgressListener = function (fn) {
		_progressListeners.add(fn);
	};

	this.removeProgressListener = function (fn) {
		_progressListeners.delete(fn);
	};

	// Move to a phase of the run, announcing the move (see _run())
	function _setPhase(phase) {
		if (_phase === phase) {
			return;
		}
		_phase = phase;
		_emitProgress();
	}

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
	 * Recompute every count and notify listeners. The eligibility pass makes
	 * this the expensive refresh, for the pane opening and a run's ends; a
	 * run in progress ticks with _tick() instead.
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
		let total = 0;
		for (let library of _indexableLibraries()) {
			total += eligibleByLibrary.get(library.libraryID)?.items.length || 0;
		}
		_itemCounts = { done: await _getIndexedItemCount(), total };
		_chunkCounts = await _getChunkCounts();
		await Zotero.Embeddings.Diagnostics.refreshChunkShape();
		_lastCountRefresh = Date.now();
		_emitProgress();
		return Zotero.Embeddings.Indexing.getStatus();
	};

	// Fulltext work in chunks, from the ledger
	async function _getChunkCounts() {
		let row = await Zotero.DB.rowQueryAsync(
			"SELECT COALESCE(SUM(chunks), 0) AS total, COALESCE(SUM(embedded), 0) AS done "
				+ "FROM embeddings.itemChunkCounts"
		);
		return { done: row.done, total: row.total };
	}

	// Progress tick for a run's inner loops: refresh the chunk counts and
	// emit, at most once per PROGRESS_EMIT_INTERVAL. The indexed item count
	// and chunk shape each cost an index scan, so they're recomputed less
	// often; the eligible count comes from the last full refresh.
	async function _tick() {
		let now = Date.now();
		if (now - _lastTick < PROGRESS_EMIT_INTERVAL) {
			return;
		}
		_lastTick = now;
		try {
			_chunkCounts = await _getChunkCounts();
			if (now - _lastCountRefresh >= COUNT_REFRESH_INTERVAL) {
				_lastCountRefresh = now;
				_itemCounts = { done: await _getIndexedItemCount(), total: _itemCounts.total };
				await Zotero.Embeddings.Diagnostics.refreshChunkShape();
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		_emitProgress();
	}

	/**
	 * Start (or resume) indexing: clear a previous stopIndexing(), drop stored
	 * embeddings for items that no longer have indexable text, re-enqueue
	 * every eligible item across all libraries (already-indexed items are
	 * skipped via their source hash, so this is cheap), and run the consumer.
	 * Safe to call while the consumer is already running -- the new work is
	 * just picked up by the existing loop.
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
			_clearCounts();
		}
		await Zotero.DB.queryAsync(
			"REPLACE INTO embeddings.itemEmbeddingsMeta (key, value) VALUES ('modelVersion', ?)",
			[current]
		);
	}

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


	// The single consumer: get the model ready, then drain the queues a step
	// at a time until they're empty or stopIndexing() is called. Every
	// indexing pass -- library-wide or notifier-driven -- runs through here,
	// so there's never more than one indexing process and all of them can be
	// stopped.
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
		_lastTick = 0;
		Zotero.Embeddings.Diagnostics.startRun();
		_startIdleWatch();
		try {
			await Zotero.Embeddings.initDB();
			await _ensureIndexMatchesModel();
			_setPhase((await Zotero.Embeddings.isDownloaded()) ? 'indexing' : 'downloading');
			await Zotero.Embeddings.Indexing.refreshStatus();
			// Download only -- the engine is created lazily by the first
			// embed, so the model isn't held in memory through the extraction
			// step below
			await Zotero.Embeddings.download(_onDownloadProgress);
			// Measure the model before storing anything scored against it. Only
			// the first run for a given model version pays for this; every
			// later one finds the numbers already in the database.
			await Zotero.Embeddings.ensureCalibration();

			_downloadProgress = null;
			let shouldStop = () => _stopping;
			// Built per call: memory pressure can shrink the token budget
			// between chunks
			let indexOptions = () => ({
				shouldStop,
				batchTokenBudget: _tokenBudget,
				onProgress: () => _tick()
			});
			// One step at a time, in a fixed order: the regular queue, then
			// the attachment queue's extraction, then its embedding. The
			// regular queue goes first and preempts the attachments, so a
			// just-edited item is searchable without waiting behind the
			// library's documents -- and so the phase a run is in says which
			// of the three kinds of work is holding it up.
			while ((_queue.size || _attachmentQueue.size) && !shouldStop()) {
				if (_queue.size) {
					await _drainItemQueue(shouldStop, indexOptions);
					continue;
				}
				let itemIDs = [..._attachmentQueue];
				_attachmentQueue.clear();
				await _extractAttachments(itemIDs, shouldStop);
				await _embedAttachments(itemIDs, shouldStop, indexOptions);
			}
			await Zotero.Embeddings.Indexing.refreshStatus();
		}
		catch (e) {
			Zotero.logError(e);
			_lastError = e;
		}
		finally {
			_stopIdleWatch();
			_indexing = false;
			_phase = 'idle';
			_downloadProgress = null;
			_extractionProgress = null;
			Zotero.Embeddings.Diagnostics.endRun();
			// A run cut short by a stop or an error still reports what's
			// stored
			try {
				_chunkCounts = await _getChunkCounts();
				_itemCounts = { done: await _getIndexedItemCount(), total: _itemCounts.total };
			}
			catch (e) {
				Zotero.logError(e);
			}
			_emitProgress();
			// Pick up anything enqueued while we were finishing up
			if ((_queue.size || _attachmentQueue.size) && !_stopping) {
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

	this.stopIndexing = function () {
		_stopping = true;
		_queue.clear();
		_attachmentQueue.clear();
		if (_kickTimer) {
			clearTimeout(_kickTimer);
			_kickTimer = null;
		}
		Zotero.Prefs.set('embeddings.indexingPaused', true);
		_emitProgress();
	};

	// Boost while the user is away from the machine, watched only during a run
	const IDLE_BOOST_SECONDS = 300;
	let _idleObserver = {
		observe: (subject, topic) => {
			Zotero.Embeddings.Indexing.setThreadBoost('user-idle', topic === 'idle');
		}
	};
	let _watchingIdle = false;

	function _startIdleWatch() {
		if (_watchingIdle) {
			return;
		}
		_watchingIdle = true;
		let idleService = Cc["@mozilla.org/widget/useridleservice;1"]
			.getService(Ci.nsIUserIdleService);
		idleService.addIdleObserver(_idleObserver, IDLE_BOOST_SECONDS);
		// Already away when the run starts
		if (idleService.idleTime >= IDLE_BOOST_SECONDS * 1000) {
			Zotero.Embeddings.Indexing.setThreadBoost('user-idle', true);
		}
	}

	function _stopIdleWatch() {
		if (!_watchingIdle) {
			return;
		}
		_watchingIdle = false;
		Cc["@mozilla.org/widget/useridleservice;1"]
			.getService(Ci.nsIUserIdleService)
			.removeIdleObserver(_idleObserver, IDLE_BOOST_SECONDS);
		Zotero.Embeddings.Indexing.setThreadBoost('user-idle', false);
	}
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

	// Recount the chunk shape from the database (see _getChunkShape())
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

	// The shape of the stored attachment chunks -- sizes from the tokens
	// index, chunks per document from the ledger -- for judging the
	// chunker's output. Attachment rows are the ones with sectionParts;
	// other item types' rows aren't the chunker's work.
	async function _getChunkShape() {
		let { BUDGET_TOKENS, MIN_TOKENS } = Zotero.Utilities.Internal.Chunking;
		let sizeBounds = [MIN_TOKENS, BUDGET_TOKENS / 2, Math.round(BUDGET_TOKENS * 5 / 6), BUDGET_TOKENS];
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

		let sizes = await Zotero.DB.rowQueryAsync(
			"SELECT COUNT(*) AS count, COALESCE(SUM(tokens), 0) AS tokens, "
				+ bucketSQL('tokens', sizeBounds) + ", "
				+ "SUM(sectionParts > 1) AS split, "
				+ "SUM(sectionParts > 1 AND sectionPart = 1) AS splitSections, "
				+ "SUM(CASE WHEN sectionParts > 1 AND sectionPart = 1 THEN sectionParts ELSE 0 END) AS splitParts "
				+ "FROM embeddings.itemEmbeddings WHERE sectionParts IS NOT NULL"
		);
		let documents = await Zotero.DB.rowQueryAsync(
			"SELECT COUNT(*) AS count, COALESCE(SUM(chunks), 0) AS chunks, "
				+ "COALESCE(MAX(chunks), 0) AS max, " + bucketSQL('chunks', documentBounds)
				+ " FROM embeddings.itemChunkCounts"
		);
		return {
			sizes: {
				count: sizes.count,
				tokens: sizes.tokens,
				mean: sizes.count ? sizes.tokens / sizes.count : 0,
				median: await median(
					"SELECT tokens FROM embeddings.itemEmbeddings WHERE sectionParts IS NOT NULL "
						+ "ORDER BY tokens",
					sizes.count),
				buckets: buckets(sizes, sizeBounds),
				splitShare: sizes.count ? (sizes.split || 0) / sizes.count : 0,
				partsPerSplitSection: sizes.splitSections ? sizes.splitParts / sizes.splitSections : 0
			},
			perDocument: {
				count: documents.count,
				mean: documents.count ? documents.chunks / documents.count : 0,
				median: await median(
					"SELECT chunks FROM embeddings.itemChunkCounts ORDER BY chunks", documents.count),
				max: documents.max,
				buckets: buckets(documents, documentBounds)
			}
		};
	}
};


/**
 * Zotero.Embeddings.Calibration -- how a model's scoring numbers are derived.
 *
 * A model can't tell you the mean vector its embeddings share, the score below
 * which nothing is a match, or the score at which the Relevance bar fills.
 * Those are measured, by running the model over a fixed corpus of query/passage
 * pairs and reading the answers off the resulting distributions.
 *
 * The corpus has short pairs (title- and annotation-length passages) and
 * long pairs (chunk-length body text). measure() does this:
 *
 *   1. Embed every query and passage, with the model's own prefixes.
 *   2. Average the long passage vectors into the mean, then center everything
 *      by it -- the same centering scoring uses. Chunk-length text is most of
 *      what the index holds and carries the model's shared direction most
 *      purely; a mean taken over short text leaves part of it in every stored
 *      chunk and lifts their scores as one.
 *   3. Score each set's queries against its passages: two N x N grids, the
 *      diagonal holding matched pairs and the cells off it unrelated text.
 *   4. minScore is NULL_PERCENTILE of the short grid's off-diagonal scores;
 *      maxDisplayScore is MATCH_PERCENTILE of the long grid's diagonal.
 *
 * Zotero.Embeddings calls this once per model version, then stores the result
 * and applies it while scoring.
 */
Zotero.Embeddings.Calibration = new function () {
	// Where the score floor goes, as a percentile of the null distribution --
	// what this model scores between texts with nothing to do with each other
	// (`mismatched` in measure()). At 0.999 only the top 0.1 of unrelated pairs
	// reach it; raising it cuts more noise and more weak-but-real matches along
	// with it, lowering it keeps both.
	const NULL_PERCENTILE = 0.999;
	// Where the Relevance bar fills, as a percentile of the other distribution
	// measure() collects -- `matched`, each query against its own passage. At
	// 0.5 a full bar means "as good as this model's typical real match".
	const MATCH_PERCENTILE = 0.5;
	// Texts per engine call while calibrating, matching the indexer's default
	// batch (see Indexing._indexItems())
	const BATCH_SIZE = 20;

	/**
	 * The languages the corpus is written in, and so the values a model's
	 * `language` may take (see MODELS). `other` collects languages with no code
	 * of their own, measured only by a model that claims no single language.
	 */
	this.languages = Object.freeze({ en: 'en', zh: 'zh', other: 'other' });

	// Query/passage pairs by language, in two sets: `short` pairs are the
	// titles and annotation-length passages indexing stores, `long` pairs are
	// chunk-length body text. Each query is what someone might plausibly type
	// to find its passage, and no two pairs anywhere in the file share a
	// subject -- not even as translations of each other, since a model measured
	// on several languages at once scores a passage's translation like the
	// passage itself, and a real match sitting in the null distribution raises
	// the floor against exactly the cross-language searches such a model is
	// for. That disjointness is what makes a query paired with any *other*
	// passage an honest example of two texts that have nothing to do with each
	// other. A language wants enough short pairs for the floor to land on a
	// settled stretch of the unrelated-score tail rather than on its few
	// highest values (see NULL_PERCENTILE).
	const CORPUS_URL = 'resource://zotero/embeddings-calibration-corpus.json';
	let _corpus = null;

	function _getCorpusData() {
		if (!_corpus) {
			_corpus = JSON.parse(Zotero.File.getResource(CORPUS_URL));
		}
		return _corpus;
	}

	/**
	 * The pairs the active model is measured against: its own language's, or
	 * every language when it claims none (see `language` in MODELS).
	 *
	 * A model is never measured on text it can't read. An English model shown
	 * Chinese passages doesn't merely waste them -- it can't tell two of them
	 * apart, so they score highly against each other and crowd out the tail
	 * that sets the floor, raising it against the English results the model is
	 * actually there to rank.
	 *
	 * @return {{ short: Object[], long: Object[] }} - { query, passage } pairs
	 */
	this.getCorpus = function () {
		let corpus = _getCorpusData();
		let language = Zotero.Embeddings.getModelLanguage();
		if (!language) {
			let sets = Object.values(corpus);
			return {
				short: sets.flatMap(set => set.short),
				long: sets.flatMap(set => set.long)
			};
		}
		if (!Object.prototype.hasOwnProperty.call(corpus, language)) {
			throw new Error(`Model '${Zotero.Embeddings.getModelName()}' claims language `
				+ `'${language}', which isn't one the corpus is written in `
				+ `(${Object.keys(this.languages).join(', ')})`);
		}
		return corpus[language];
	};

	/**
	 * Run the active model over its corpus and derive its three numbers: the
	 * mean of the passage embeddings, and the two ends of the score band, read
	 * off the distributions of matched and mismatched pairs.
	 *
	 * @return {Promise<Object>} - { mean, minScore, maxDisplayScore }
	 */
	this.measure = async function () {
		let { short, long } = this.getCorpus();
		let queryPrefix = Zotero.Embeddings.getQueryPrefix();
		let passagePrefix = Zotero.Embeddings.getPassagePrefix();
		Zotero.debug(`Embeddings: measuring against ${short.length} short `
			+ `and ${long.length} long query/passage pairs`);
		let embedPairs = async pairs => ({
			queries: await _embedAll(pairs.map(pair => queryPrefix + pair.query)),
			passages: await _embedAll(pairs.map(pair => passagePrefix + pair.passage))
		});
		short = await embedPairs(short);
		long = await embedPairs(long);

		// The direction every embedding shares, which says nothing about the
		// text. Taken over the long passages: chunk-length text is most of what
		// gets stored, and shows the direction most purely
		let mean = new Float32Array(long.passages[0].length);
		for (let vector of long.passages) {
			for (let d = 0; d < mean.length; d++) {
				mean[d] += vector[d] / long.passages.length;
			}
		}

		// Scoring compares centered, quantized vectors, so calibrate on those,
		// using the same transform and comparison the search path uses
		let prepare = vector => Zotero.Embeddings.quantize(Zotero.Embeddings.center(vector, mean));
		let grid = ({ queries, passages }) => {
			queries = queries.map(prepare);
			passages = passages.map(prepare);
			let matched = [];
			let mismatched = [];
			for (let i = 0; i < queries.length; i++) {
				for (let j = 0; j < passages.length; j++) {
					(i === j ? matched : mismatched)
						.push(Zotero.Embeddings.cosine(queries[i], passages[j]));
				}
			}
			return { matched, mismatched };
		};
		// Unrelated short pairs set the floor; chunk-length matches set the bar,
		// since a title-length passage paraphrases its query and scores higher
		// than any real chunk does
		let minScore = _percentile(grid(short).mismatched, NULL_PERCENTILE);
		let maxDisplayScore = _percentile(grid(long).matched, MATCH_PERCENTILE);
		// A model that rates its own matches no higher than unrelated text
		// can't rank anything, and every score it produced would clamp to a
		// full or empty bar. Better to fail loudly than to index with it.
		if (maxDisplayScore <= minScore) {
			throw new Error(`Model '${Zotero.Embeddings.getModelName()}' scores matched text `
				+ `(${maxDisplayScore.toFixed(4)}) no higher than unrelated text `
				+ `(${minScore.toFixed(4)}) -- it can't rank search results`);
		}
		return { mean, minScore, maxDisplayScore };
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

