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
	//     l10nID: '...',                 // optional Fluent id for the menu
	//     label: '...'                   // optional plain-English menu label, for a model that isn't
	//                                    //   shipped. The menu prefers l10nID, then label, then modelId.
	// }
	const MODELS = {
		'bge-small-en-v1.5': {
			revision: 1,
			modelId: 'Xenova/bge-small-en-v1.5',
			language: 'en',
			dtype: 'q8',
			pooling: 'cls',
			queryPrefix: 'Represent this sentence for searching relevant passages: ',
			passagePrefix: '',
			maxTokens: 512,
			l10nID: 'preferences-advanced-semantic-search-english'
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
		'multilingual-e5-small': {
			revision: 1,
			modelId: 'Xenova/multilingual-e5-small',
			dtype: 'q8',
			pooling: 'mean',
			queryPrefix: 'query: ',
			passagePrefix: 'passage: ',
			maxTokens: 512,
			l10nID: 'preferences-advanced-semantic-search-multilingual'
		},
		// Models for testing
		'all-MiniLM-L6-v2': {
			revision: 1,
			modelId: 'Xenova/all-MiniLM-L6-v2',
			dtype: 'q8',
			pooling: 'mean',
			queryPrefix: '',
			passagePrefix: '',
			maxTokens: 512,
			language: 'en',
			label: 'test: English (lightest, fast)'
		},
		'bge-base-en-v1.5': {
			revision: 1,
			modelId: 'Xenova/bge-base-en-v1.5',
			language: 'en',
			dtype: 'q8',
			pooling: 'cls',
			queryPrefix: 'Represent this sentence for searching relevant passages: ',
			passagePrefix: '',
			maxTokens: 512,
			label: 'test: English (bge mid-weight)'
		},
		'jina-embeddings-v2-small-en': {
			revision: 1,
			modelId: 'Xenova/jina-embeddings-v2-small-en',
			dtype: 'q8',
			pooling: 'mean',
			queryPrefix: '',
			passagePrefix: '',
			maxTokens: 8192,
			language: 'en',
			label: 'test: English (jina mid-weight, large window)'
		},
		'multilingual-e5-base': {
			revision: 1,
			modelId: 'Xenova/multilingual-e5-base',
			dtype: 'q8',
			pooling: 'mean',
			queryPrefix: 'query: ',
			passagePrefix: 'passage: ',
			maxTokens: 512,
			label: "test: multilingual (mid-weight)"
		},
		'bge-m3': {
			revision: 1,
			modelId: 'Xenova/bge-m3',
			dtype: 'q8',
			pooling: 'cls',
			queryPrefix: '',
			passagePrefix: '',
			maxTokens: 8192,
			label: 'test: multilingual (very heavy)'
		},
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
			await Zotero.DB.queryAsync("DROP TABLE IF EXISTS embeddings.modelCalibration");
			// No foreign key on itemID -- references across attached databases
			// aren't possible, so item deletions are handled by the indexing
			// notifier and eligibility pruning instead.
			// An item's text is stored as one or more chunks (see
			// Zotero.Embeddings.Chunking);
			// every chunk row carries the hash of the item's full source text,
			// and scoring takes the item's best chunk.
			// An attachment fulltext chunk also records what and where it
			// came from, so a match can be previewed and located without
			// re-deriving the chunking: its text, its section's outline path,
			// the top-level block range it covers, the page it starts on
			// (pageLabel), a reader-navigable position (navPosition, JSON --
			// see Zotero.SDT.getSections()), and which piece of a split
			// section it is (sectionPart of sectionParts). All NULL for
			// chunks of other item types, which are their own preview and
			// location.
			// An attachment that yields no text at all (missing file,
			// password-protected, no text layer) gets a single row with a
			// NULL embedding: a record that it was processed, so progress
			// counts it and later passes skip it (via sourceHash) until the
			// file changes. Scoring reads only rows with an embedding.
			await Zotero.DB.queryAsync(
				"CREATE TABLE embeddings.itemEmbeddings (\n"
				+ "    itemID INTEGER NOT NULL,\n"
				+ "    chunkIndex INTEGER NOT NULL,\n"
				+ "    embedding BLOB,\n"
				+ "    sourceHash TEXT NOT NULL,\n"
				+ "    chunkText TEXT,\n"
				+ "    outlinePath TEXT,\n"
				+ "    startBlock INTEGER,\n"
				+ "    endBlock INTEGER,\n"
				+ "    pageLabel TEXT,\n"
				+ "    navPosition TEXT,\n"
				+ "    sectionPart INTEGER,\n"
				+ "    sectionParts INTEGER,\n"
				+ "    PRIMARY KEY (itemID, chunkIndex)\n"
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
			// What running the model taught us about it, measured once per
			// model version (see Zotero.Embeddings.ensureCalibration()). Keyed
			// by version rather than name, so a `revision` bump measures again
			// alongside the reindex it already forces.
			await Zotero.DB.queryAsync(
				"CREATE TABLE embeddings.modelCalibration (\n"
				+ "    modelVersion TEXT PRIMARY KEY,\n"
				+ "    meanVector BLOB NOT NULL,\n"
				+ "    minScore REAL NOT NULL,\n"
				+ "    maxDisplayScore REAL NOT NULL\n"
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
				Zotero.debug(`Embeddings: creating engine for '${model.modelId}' `
					+ `(dtype ${model.dtype}, pooling ${model.pooling})`);
				_engine = await Zotero.ML.createEngine({
					engineId: ENGINE_ID,
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
			// The old model's measurements don't describe the new one, and the
			// bar renders straight off them
			_calibration = null;
		}
		if (engine) {
			await engine.terminate();
			await Zotero.ML.shutdown();
		}
	};

	//
	// Vector math
	//
	// Shared by scoring and by calibration, which has to measure exactly what
	// scoring computes -- if the two ever centered or compared differently, the
	// calibrated bounds would describe a quantity nothing else produces. Public
	// so Zotero.Embeddings.Calibration uses these rather than its own copies.
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
	 * Similarity between two vectors that are already centered and of unit
	 * length, which for those is the cosine between them.
	 *
	 * @param {Float32Array} a
	 * @param {Float32Array} b
	 * @return {Number}
	 */
	this.dot = function (a, b) {
		let sum = 0;
		for (let i = 0; i < a.length; i++) {
			sum += a[i] * b[i];
		}
		return sum;
	};

	// Center against the active model's measured mean, leaving the vector
	// alone if there's nothing to center against
	function _center(vector) {
		let mean = _calibration && _calibration.mean;
		if (!mean || mean.length !== vector.length) {
			return vector;
		}
		return Zotero.Embeddings.center(vector, mean);
	}

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
		// Pull the measured mean into memory, so _center() centers with it
		await this.loadCalibration();
		let queryVector = await this.embedQuery(query);
		let [passageVector] = await this.embedPassages([passage]);
		return this.dot(_center(queryVector), _center(passageVector));
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
	 * @param {Number} score
	 * @return {Number} - 0-1
	 */
	this.getScoreFraction = function (score) {
		if (!_calibration) {
			return 0;
		}
		let { minScore, maxDisplayScore } = _calibration;
		return Math.min(1, Math.max(0,
			(score - minScore) / (maxDisplayScore - minScore)));
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

	// Items among the given ones whose indexed text contains every word of the
	// query, matched as substrings the way quick search matches them. Covers
	// everything the index embeds: item fields, note text, and annotation
	// text and comments.
	async function _findLiteralMatches(queryText, itemIDs) {
		let terms = Zotero.Embeddings.normalizeQuery(queryText).split(/\s+/).filter(Boolean);
		if (!terms.length || !itemIDs.length) {
			return new Set();
		}
		let fieldIDs = Zotero.Embeddings.getIndexedFieldIDs();
		let matched = null;
		for (let term of terms) {
			let ids = new Set();
			let pattern = '%' + term.replace(/[\\%_]/g, '\\$&') + '%';
			let chunkSize = 500;
			for (let i = 0; i < itemIDs.length; i += chunkSize) {
				let chunk = itemIDs.slice(i, i + chunkSize);
				let placeholders = chunk.map(() => '?').join(',');
				let queries = [
					[
						"SELECT DISTINCT itemID FROM itemData "
							+ "JOIN itemDataValues USING (valueID) "
							+ "WHERE fieldID IN (" + fieldIDs.join(',') + ") "
							+ "AND itemID IN (" + placeholders + ") "
							+ "AND value LIKE ? ESCAPE '\\'",
						[...chunk, pattern]
					],
					[
						// Match inside the stored note the way the quick
						// search note condition does: with the standard
						// wrapper element trimmed off, so its markup
						// ('zotero-note znv1') doesn't match every note
						"SELECT itemID FROM itemNotes "
							+ "WHERE itemID IN (" + placeholders + ") "
							+ "AND SUBSTR(note, "
								+ (1 + Zotero.Notes.notePrefix.length) + ", "
								+ "LENGTH(note) - "
								+ (Zotero.Notes.notePrefix.length + Zotero.Notes.noteSuffix.length)
							+ ") LIKE ? ESCAPE '\\'",
						[...chunk, pattern]
					],
					[
						"SELECT itemID FROM itemAnnotations "
							+ "WHERE itemID IN (" + placeholders + ") "
							+ "AND (text LIKE ? ESCAPE '\\' OR comment LIKE ? ESCAPE '\\')",
						[...chunk, pattern, pattern]
					]
				];
				for (let [sql, params] of queries) {
					let rows = await Zotero.DB.columnQueryAsync(sql, params);
					for (let id of rows || []) {
						ids.add(id);
					}
				}
			}
			matched = matched ? new Set([...matched].filter(id => ids.has(id))) : ids;
			if (!matched.size) {
				break;
			}
		}
		return matched;
	}

	// mozStorage returns a BLOB as an array of byte values; reinterpret those
	// bytes as the stored Float32 embedding vector.
	function _blobToVector(blob) {
		let bytes = Uint8Array.from(blob);
		return new Float32Array(bytes.buffer);
	}

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
	 * can't be scored at all -- unless nothing clears the minimum, in which
	 * case candidates whose text contains the query's words are returned
	 * instead, indexed or not, since the model missing what an item says
	 * literally shouldn't leave the search with nothing to show. Used to apply
	 * semantic ranking within an existing result scope (e.g. the current
	 * collection) rather than the whole library.
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
		let belowFloor = new Map();
		if (!itemIDs.length || !this.isEnabled()) {
			return scores;
		}
		let calibration = await _requireReadyIndex();
		let generation = _modelGeneration;
		let query = _center(await this.embedQuery(queryText));
		let minScore = calibration.minScore;

		// Load embeddings for the candidates in chunks (avoids the SQLite bound-
		// parameter limit for large collections), scoring each as we go. An
		// item stored as multiple text chunks scores as its best chunk, not an
		// average, so a long note that addresses the query in one paragraph
		// isn't diluted by the rest.
		let best = new Map();
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
				"SELECT itemID, embedding FROM embeddings.itemEmbeddings WHERE itemID IN ("
					+ chunk.map(() => '?').join(',') + ") AND embedding IS NOT NULL",
				chunk
			);
			for (let row of rows) {
				let dot = this.dot(query, _center(_blobToVector(row.embedding)));
				let prev = best.get(row.itemID);
				if (prev === undefined || dot > prev) {
					best.set(row.itemID, dot);
				}
			}
		}
		for (let [itemID, dot] of best) {
			if (dot >= minScore) {
				scores.set(itemID, dot);
			}
			else {
				belowFloor.set(itemID, dot);
			}
		}
		// Nothing was similar enough to the query to be a match, so fall back to
		// the items that use its words, which leave the relevance bar empty:
		// indexed items ranked by their own scores, and unindexed ones -- too
		// little text to embed, so nothing to rank them by -- placed at the
		// floor
		if (!scores.size) {
			let literal = await _findLiteralMatches(queryText, itemIDs);
			for (let itemID of literal) {
				scores.set(itemID,
					belowFloor.has(itemID) ? belowFloor.get(itemID) : minScore);
			}
		}
		if (generation !== _modelGeneration) {
			throw new this.IndexNotReadyError('Model changed during scoring');
		}
		return scores;
	};

	/**
	 * The chunks of a single item most similar to a query, each with where in
	 * the item it came from -- for surfacing why an item matched (e.g. which
	 * section of an attachment's full text). Chunks scoring below the model's
	 * measured minimum aren't matches and aren't returned.
	 *
	 * The text and location fields describe attachment fulltext chunks (see
	 * the itemEmbeddings table); for other item types they're null, and the
	 * item itself is the preview and the location.
	 *
	 * @param {String} queryText
	 * @param {Number} itemID
	 * @param {Object} [options]
	 * @param {Number} [options.limit=3] - Most chunks to return
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
		let query = _center(await this.embedQuery(queryText));
		let rows = await Zotero.DB.queryAsync(
			"SELECT chunkIndex, embedding, chunkText, outlinePath, startBlock, endBlock, "
				+ "pageLabel, navPosition, sectionPart, sectionParts "
				+ "FROM embeddings.itemEmbeddings WHERE itemID=? AND embedding IS NOT NULL",
			itemID
		);
		return rows
			.map(row => ({
				chunkIndex: row.chunkIndex,
				score: this.dot(query, _center(_blobToVector(row.embedding))),
				text: row.chunkText,
				outlinePath: row.outlinePath,
				startBlock: row.startBlock,
				endBlock: row.endBlock,
				pageLabel: row.pageLabel,
				position: row.navPosition ? JSON.parse(row.navPosition) : null,
				sectionPart: row.sectionPart,
				sectionParts: row.sectionParts
			}))
			.filter(chunk => chunk.score >= calibration.minScore)
			.sort((a, b) => (b.score - a.score) || (a.chunkIndex - b.chunkIndex))
			.slice(0, limit);
	};
};


/**
 * Zotero.Embeddings.Chunking -- splitting a text into passages small enough to
 * each be embedded on their own, so a long text's later paragraphs are
 * searchable instead of being averaged into one vector or truncated away by the
 * pipeline. The indexer applies this to notes (chunkText()) and to attachment
 * full text (chunkSections()). Chunk size is bounded by CHUNK_MAX_TOKENS,
 * capped by the model's window, and counted in the model's own tokens.
 */
Zotero.Embeddings.Chunking = new function () {
	// Tokens carried over from the end of one chunk into the start of the
	// next, so a thought spanning a boundary is searchable in both. Carried
	// only between pieces of the same paragraph block.
	const CHUNK_OVERLAP_TOKENS = 48;
	// Fewest tokens worth embedding on their own. An item scores as its best
	// chunk, so every chunk is another draw at that maximum: splitting text
	// into fragments inflates the score without adding information, and a
	// fragment loses the context that gave it meaning. Paragraphs below this
	// (headings, dates, list items) are combined with their neighbors rather
	// than becoming chunks of their own.
	const CHUNK_MIN_TOKENS = 120;
	// Most tokens a chunk may reach. A ceiling rather than a target: chunks come
	// out paragraph-sized, so this decides only how long a text has to be before
	// it's split at all, and how far a single oversized paragraph is split.
	const CHUNK_MAX_TOKENS = 768;
	// Most characters to feed the tokenizer in one encode() call. The
	// multilingual models' SentencePiece Unigram tokenizer is quadratic in
	// input length -- its Metaspace pre-tokenizer doesn't split at whitespace,
	// so the whole input goes through the Viterbi lattice as one string, and a
	// single long encode can take seconds. Segments this size keep every call
	// in the tokenizer's linear regime, and token counts are additive across
	// whitespace boundaries, so the segmented measurement is exact.
	const TOKENIZER_SEGMENT_CHARS = 1000;

	// Tokenizer instances by model name. Failures aren't cached, so a later
	// indexing run retries the load.
	let _tokenizers = new Map();

	/**
	 * The active model's tokenizer, constructed from the tokenizer files in
	 * the runtime's model cache using the transformers.js implementation
	 * Firefox ships -- the same code, over the same files, that the inference
	 * process tokenizes with.
	 *
	 * The tokenizer files are part of the downloaded model, so with the model
	 * present this can't fail short of a broken download -- and then inference
	 * couldn't tokenize either, so nothing would embed anyway. A failure
	 * therefore throws, aborting the indexing run and surfacing as its error,
	 * rather than falling back to an approximate count: an approximation would
	 * only produce chunks that then fail to embed, and chunk boundaries are
	 * persistent -- an item's source hash covers its text, not the chunker, so
	 * a run that guessed at them would never be corrected.
	 *
	 * @return {Promise<Object>}
	 */
	this.getTokenizer = function () {
		let name = Zotero.Embeddings.getModelName();
		if (!_tokenizers.has(name)) {
			let promise = (async () => {
				let { PreTrainedTokenizer } = ChromeUtils.importESModule(
					'chrome://global/content/ml/transformers.js'
				);
				let decoder = new TextDecoder();
				let [tokenizerJSON, tokenizerConfig] = await Promise.all(
					['tokenizer.json', 'tokenizer_config.json'].map(
						async file => JSON.parse(decoder.decode(
							await Zotero.Embeddings.getModelFile(file)
						))
					)
				);
				return new PreTrainedTokenizer(tokenizerJSON, tokenizerConfig);
			})();
			// Allow a later run to retry after a failed load
			promise.catch(() => {
				if (_tokenizers.get(name) === promise) {
					_tokenizers.delete(name);
				}
			});
			_tokenizers.set(name, promise);
		}
		return _tokenizers.get(name);
	};

	// How to measure text against the active model, and how much of its window a
	// chunk's own text may use.
	//
	// Counts leave out the special tokens the tokenizer wraps every input in, so
	// that the counts of several pieces of text add up to the count of those
	// pieces joined. That additivity is what the whole chunking flow leans on:
	// a text is tokenized exactly once, at paragraph granularity
	// (_measureParagraphs()), and every level above -- blocks, sections, groups
	// of sections -- is sized by summing those counts (_sumTokens()) instead of
	// re-tokenizing the same text. `joinTokens` is what one '\n\n' join adds
	// once paragraphs are put back together, measured rather than assumed
	// (a SentencePiece model can spend a token on collapsed whitespace), so
	// sums charge it per join.
	//
	// Those special tokens come off the window instead, together with the
	// passage prefix embedPassages() prepends -- neither is part of the text this
	// code sees, but both take up room once the chunk is embedded.
	function _getMetrics(tokenizer) {
		let specialTokens = tokenizer.encode('').length;
		// Measured in segments (see _splitForTokenizer()), so a long paragraph
		// never hits the tokenizer's quadratic regime in a single call
		let count = text => _splitForTokenizer(text).reduce(
			(sum, segment) => sum + tokenizer.encode(segment).length - specialTokens,
			0
		);
		let prefix = Zotero.Embeddings.getPassagePrefix();
		return {
			count,
			joinTokens: Math.max(0, count('a\n\na') - 2 * count('a')),
			budget: Math.min(CHUNK_MAX_TOKENS, Zotero.Embeddings.getModelMaxTokens())
				- specialTokens - (prefix ? count(prefix) : 0)
		};
	}

	// The paragraphs of a text, each counted exactly once -- the single place
	// chunking pays for tokenization
	function _measureParagraphs(text, count) {
		return text.split(/\n+/)
			.map(paragraph => paragraph.trim())
			.filter(Boolean)
			.map(paragraph => ({ text: paragraph, tokens: count(paragraph) }));
	}

	// Tokens of the given paragraphs once joined back together, charging
	// joinTokens per join (see _getMetrics())
	function _sumTokens(paragraphs, joinTokens) {
		if (!paragraphs.length) {
			return 0;
		}
		return paragraphs.reduce((sum, paragraph) => sum + paragraph.tokens, 0)
			+ joinTokens * (paragraphs.length - 1);
	}

	// A text in segments of at most TOKENIZER_SEGMENT_CHARS, each ending
	// right before a whitespace character, so the next segment carries it and
	// the tokenizer sees every word with its leading space. Text with no
	// whitespace in a whole window (e.g., unsegmented CJK) is cut mid-run,
	// which can miscount by a token per boundary -- noise against the budget.
	function _splitForTokenizer(text) {
		if (text.length <= TOKENIZER_SEGMENT_CHARS) {
			return [text];
		}
		let segments = [];
		let start = 0;
		while (start < text.length) {
			let end = Math.min(start + TOKENIZER_SEGMENT_CHARS, text.length);
			if (end < text.length) {
				for (let i = end; i > start; i--) {
					if (/\s/.test(text[i])) {
						end = i;
						break;
					}
				}
			}
			segments.push(text.slice(start, end));
			start = end;
		}
		return segments;
	}

	// Last resort for text with no sentence boundary inside the budget: window
	// it by tokens.
	function _hardSplit(text, budget, tokenizer) {
		let pieces = [];
		// Encoded in segments for the same reason count() measures in them
		// (see _splitForTokenizer()). Each segment keeps its special-token
		// wrapper -- stripping it would mean knowing how the tokenizer splits
		// it between start and end -- so a window can hold a few interior
		// special tokens; decode skips them, and a piece just lands a few
		// tokens under the budget.
		let ids = _splitForTokenizer(text)
			.flatMap(segment => [...tokenizer.encode(segment)]);
		let step = Math.max(1, budget - CHUNK_OVERLAP_TOKENS);
		for (let start = 0; start < ids.length; start += step) {
			let piece = tokenizer
				// eslint-disable-next-line camelcase
				.decode(ids.slice(start, start + budget), { skip_special_tokens: true })
				.trim();
			if (piece) {
				pieces.push(piece);
			}
		}
		return pieces;
	}

	// The sentence units of a block, each within the budget. Sentence
	// boundaries come from Intl.Segmenter, which is locale-aware, so scripts
	// without Western punctuation still split at real boundaries.
	function _splitToSentences(text, budget, count, tokenizer) {
		let units = [];
		let segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
		for (let { segment } of segmenter.segment(text)) {
			let sentence = segment.trim();
			if (!sentence) {
				continue;
			}
			let tokens = count(sentence);
			if (tokens <= budget) {
				units.push({ text: sentence, tokens });
				continue;
			}
			for (let piece of _hardSplit(sentence, budget, tokenizer)) {
				units.push({ text: piece, tokens: count(piece) });
			}
		}
		return units;
	}

	// Split a block that outgrew the budget into as few pieces as possible and
	// as evenly as possible. Filling each piece to the budget instead would
	// leave a short, low-information remainder at the end, which is the same
	// thing CHUNK_MIN_TOKENS exists to prevent.
	function _splitBlockEvenly(block, budget, count, tokenizer) {
		// Each piece carries overlap from the previous one, so its own content
		// has that much less room
		let pieceCount = Math.ceil(block.tokens / (budget - CHUNK_OVERLAP_TOKENS));
		let sentences = _splitToSentences(block.text, budget, count, tokenizer);
		let chunks = [];
		// Sentences in the current piece, the carried-over tokens among them
		// (which don't count toward the target, since they're a repeat of the
		// previous piece's content), and the piece's total size
		let current = [];
		let carriedTokens = 0;
		let totalTokens = 0;
		// Content and pieces still to place. A piece can only close on a
		// sentence boundary, so it usually lands a little under its target;
		// recomputing the target from what's left spreads that slack over the
		// pieces that follow, instead of letting it accumulate into an extra
		// undersized piece at the end.
		let remainingTokens = block.tokens;
		let remainingPieces = pieceCount;
		for (let sentence of sentences) {
			let contentTokens = totalTokens - carriedTokens;
			// Close the piece at whichever boundary lands nearer the target, so
			// the pieces come out even rather than full-then-short. On the last
			// piece there's nothing left to balance against, so only the window
			// closes it.
			let closeHere = false;
			if (current.length) {
				if (totalTokens + sentence.tokens > budget) {
					closeHere = true;
				}
				else if (remainingPieces > 1) {
					let target = Math.ceil(remainingTokens / remainingPieces);
					closeHere = Math.abs(contentTokens + sentence.tokens - target)
						> Math.abs(contentTokens - target);
				}
			}
			if (closeHere) {
				chunks.push(current.map(s => s.text).join(' '));
				remainingTokens -= contentTokens;
				remainingPieces = Math.max(1, remainingPieces - 1);
				// Carry the trailing sentences that fit the overlap allowance
				// alongside the incoming sentence
				let carry = [];
				carriedTokens = 0;
				let allowance = Math.min(CHUNK_OVERLAP_TOKENS, budget - sentence.tokens);
				for (let i = current.length - 1; i >= 0; i--) {
					if (carriedTokens + current[i].tokens > allowance) {
						break;
					}
					carry.unshift(current[i]);
					carriedTokens += current[i].tokens;
				}
				current = carry;
				totalTokens = carriedTokens;
			}
			current.push(sentence);
			totalTokens += sentence.tokens;
		}
		if (current.length) {
			chunks.push(current.map(s => s.text).join(' '));
		}
		return chunks;
	}

	/**
	 * Split a text into chunks that each fit the active model's context
	 * window. Text that fits the window -- the vast majority -- comes back as
	 * a single chunk.
	 *
	 * Paragraphs are the topic units, so two of them never share a chunk
	 * unless one was too small to embed on its own: a chunk spanning two
	 * subjects represents neither of them well, and since an item scores as
	 * its best chunk, that dilution is what decides whether it matches at all.
	 * Paragraphs below CHUNK_MIN_TOKENS are therefore combined with their
	 * neighbors into a block, and a block over the window is split into even
	 * pieces at sentence boundaries.
	 *
	 * @param {String} text
	 * @return {Promise<String[]>}
	 */
	this.chunkText = async function (text) {
		let tokenizer = await this.getTokenizer();
		let metrics = _getMetrics(tokenizer);
		let paragraphs = _measureParagraphs(text, metrics.count);
		return _chunkParagraphs(text, paragraphs, metrics.budget, metrics, tokenizer);
	};

	// The paragraph-level chunker behind chunkText(), over paragraphs already
	// measured by _measureParagraphs() -- everything here is sized by summing
	// their counts, so no text is tokenized a second time. The budget is the
	// caller's, so chunkSections() can reserve part of the window for a
	// section's outline-path prefix. `text` is what a fitting result returns
	// as its single chunk, joins and all.
	function _chunkParagraphs(text, paragraphs, budget, metrics, tokenizer) {
		let { count, joinTokens } = metrics;
		// Text that fits the window as it stands, which is most of it
		if (_sumTokens(paragraphs, joinTokens) <= budget) {
			return [text];
		}

		// Group paragraphs into blocks, combining any that are too small to
		// stand alone with the paragraphs that follow them. A paragraph that
		// reaches the minimum on its own becomes its own block, which is what
		// keeps distinct subjects out of each other's chunks.
		let groups = [];
		let pending = [];
		let pendingTokens = 0;
		for (let paragraph of paragraphs) {
			pending.push(paragraph);
			pendingTokens += paragraph.tokens;
			if (pendingTokens >= CHUNK_MIN_TOKENS) {
				groups.push(pending);
				pending = [];
				pendingTokens = 0;
			}
		}
		// A trailing group still under the minimum joins the previous block
		// rather than standing alone as a runt chunk; the block is split evenly
		// below, so absorbing it costs nothing
		if (pending.length) {
			if (groups.length) {
				groups[groups.length - 1].push(...pending);
			}
			else {
				groups.push(pending);
			}
		}

		let chunks = [];
		for (let group of groups) {
			let block = {
				text: group.map(paragraph => paragraph.text).join('\n\n'),
				tokens: _sumTokens(group, joinTokens)
			};
			if (block.tokens <= budget) {
				chunks.push(block.text);
			}
			else {
				chunks.push(..._splitBlockEvenly(block, budget, count, tokenizer));
			}
		}
		return chunks.length ? chunks : [text];
	}

	/**
	 * Split a document's outline sections (see Zotero.SDT.getSections()) into
	 * chunks that each fit the active model's context window. Sections play
	 * the role paragraphs play in chunkText(), one level up: a section is the
	 * topic unit, so two of them never share a chunk unless one was too small
	 * to embed on its own, and a section over the window is split by the
	 * paragraph machinery. Each chunk points back at the section blocks it
	 * covers, so a match can be located in the document later.
	 *
	 * Sections marked `auxiliary` (captions, image descriptions) are exempt
	 * from the too-small merging in both directions: each becomes exactly
	 * one chunk (flagged `auxiliary`), so it can surface on its own without
	 * ever mixing into the running text.
	 *
	 * A chunk's `embedText` -- what actually gets embedded -- is its text
	 * prefixed with its section's outline path (e.g. "Methods >
	 * Participants"), giving a section fragment the context of its headings;
	 * the prefix comes out of the chunk's token budget. `text` stays the
	 * plain piece, for display.
	 *
	 * Each chunk carries its section's location (pageIndex, pageLabel,
	 * position -- see Zotero.SDT.getSections()), and its place within the
	 * section: sectionPart / sectionParts say which piece of a split section
	 * this is, so a match can be read as coming from the middle or the end
	 * of its section. Splitting happens at sentence granularity, blind to
	 * blocks, so the pieces of one section share its location.
	 *
	 * @param {Object[]} sections - [{ text, outlinePath, startBlock, endBlock,
	 *     pageIndex, pageLabel, position }]
	 * @return {Promise<Object[]>} - [{ text, embedText, outlinePath,
	 *     startBlock, endBlock, pageIndex, pageLabel, position,
	 *     sectionPart, sectionParts }]
	 */
	this.chunkSections = async function (sections) {
		let tokenizer = await this.getTokenizer();
		let metrics = _getMetrics(tokenizer);
		let { count, joinTokens, budget } = metrics;

		// Group sections into chunk-worthy units, combining any too small to
		// stand alone with the sections that follow them -- same policy as
		// chunkText()'s paragraph grouping. Each section is measured once, at
		// paragraph granularity, and carries its paragraphs forward, so no
		// later stage tokenizes the same text again.
		let groups = [];
		let pending = null;
		// Index of the last body group, for the trailing merge below
		let lastBodyGroup = -1;
		for (let section of sections) {
			if (!section.text) {
				continue;
			}
			let paragraphs = _measureParagraphs(section.text, count);
			let tokens = _sumTokens(paragraphs, joinTokens);
			// An auxiliary section (caption, image description) is its own
			// chunk no matter how small: indexed and searchable on its own,
			// never mixed into the running text. The body sections around it
			// still merge with each other -- `pending` just carries across.
			if (section.auxiliary) {
				groups.push({ sections: [section], paragraphs, auxiliary: true });
				continue;
			}
			if (pending) {
				pending.sections.push(section);
				pending.paragraphs.push(...paragraphs);
				pending.tokens += tokens;
			}
			else {
				pending = { sections: [section], paragraphs, tokens };
			}
			if (pending.tokens >= CHUNK_MIN_TOKENS) {
				lastBodyGroup = groups.length;
				groups.push(pending);
				pending = null;
			}
		}
		// A trailing group still under the minimum joins the previous body
		// group rather than standing alone as a runt chunk -- never an
		// auxiliary group, which stays exactly its own text
		if (pending) {
			if (lastBodyGroup >= 0) {
				let last = groups[lastBodyGroup];
				last.sections.push(...pending.sections);
				last.paragraphs.push(...pending.paragraphs);
			}
			else {
				groups.push(pending);
			}
		}
		// Body sections merge across the auxiliary sections between them, so
		// a group can close after an auxiliary group whose blocks it
		// precedes. Chunk indexes are document order (the UI sorts by them),
		// so restore it here.
		groups.sort((a, b) => (a.sections[0].startBlock ?? 0) - (b.sections[0].startBlock ?? 0));

		let chunks = [];
		for (let group of groups) {
			// A merged group takes its first section's outline path -- the
			// heading its text starts under
			let outlinePath = group.sections[0].outlinePath || '';
			let startBlock = group.sections[0].startBlock;
			let endBlock = group.sections[group.sections.length - 1].endBlock;
			let prefix = outlinePath ? outlinePath + '\n\n' : '';
			let prefixTokens = prefix ? count(prefix) : 0;
			// A pathological outline path that would eat a real share of the
			// window hurts more than it helps
			if (prefixTokens > budget / 4) {
				prefix = '';
				prefixTokens = 0;
			}
			let text = group.sections.map(section => section.text).join('\n\n');
			let first = group.sections[0];
			let pieces = _chunkParagraphs(text, group.paragraphs, budget - prefixTokens, metrics, tokenizer);
			for (let i = 0; i < pieces.length; i++) {
				chunks.push({
					text: pieces[i],
					embedText: prefix + pieces[i],
					outlinePath,
					startBlock,
					endBlock,
					pageIndex: first.pageIndex ?? null,
					pageLabel: first.pageLabel ?? null,
					position: first.position ?? null,
					sectionPart: i + 1,
					sectionParts: pieces.length,
					auxiliary: !!group.auxiliary
				});
			}
		}
		return chunks;
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
	// Most often the per-library status counts are recomputed during a run,
	// since each refresh is a pass over the database
	const STATUS_REFRESH_INTERVAL = 5000;
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
	// magnitude more to index, so they're enqueued last, ordered smallest
	// first, and reported on their own line rather than buried in one total
	// that barely moves.
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
			if (_hasEmbeddableText(row.title)
					|| _hasEmbeddableText(_htmlToText(row.note, true))) {
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
			// Ordering attachments by size compares the
			// two things the fulltext index records -- characters for EPUBs and
			// snapshots, pages for PDFs -- so page counts are scaled to roughly the
			// characters they stand for.
			const CHARS_PER_PAGE = 3000;
			const UNKNOWN_ATTACHMENT_SIZE = 99999999;
			// The SQL mirror of _isIndexableAttachment(): stored or linked
			// PDFs and EPUBs, and snapshots (which are always stored),
			// smallest first so that one enormous book doesn't sit at the
			// head of the queue while the rest of the library waits behind
			// it. Size is taken from Zotero's own fulltext index, which
			// already knows it for virtually every attachment -- unlike
			// measuring the files, which would mean a filesystem call per
			// attachment every time this runs.
			rows = await Zotero.DB.queryAsync(
				"SELECT libraryID, itemID FROM itemAttachments "
					+ "JOIN items USING (itemID) "
					+ "LEFT JOIN fulltextItems USING (itemID) "
					+ "WHERE (contentType IN ('application/pdf', 'application/epub+zip') "
						+ "AND linkMode!=?) "
					+ "OR (contentType='text/html' AND linkMode=?) "
					+ "ORDER BY COALESCE(totalChars, totalPages * ?, ?), itemID",
				[
					Zotero.Attachments.LINK_MODE_LINKED_URL,
					Zotero.Attachments.LINK_MODE_IMPORTED_URL,
					CHARS_PER_PAGE,
					UNKNOWN_ATTACHMENT_SIZE
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

	// Enqueue every eligible item in two passes: first every library's items,
	// notes, and annotations, then every library's attachments. That index is
	// cheap and immediately useful, so it fills in across all libraries
	// before the far slower fulltext extraction starts anywhere -- no
	// library's metadata waits behind another library's documents.
	//
	// This governs full passes only. Items the notifier enqueues as they
	// change go in on arrival, so editing a huge PDF still indexes it now
	// rather than deferring it behind everything else.
	function _enqueueAllLibraries(eligibleByLibrary) {
		for (let kind of ['items', 'attachments']) {
			for (let library of _indexableLibraries()) {
				let eligible = eligibleByLibrary.get(library.libraryID);
				if (!eligible) {
					continue;
				}
				for (let id of eligible[kind]) {
					_queue.add(id);
				}
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
			"SELECT DISTINCT itemID FROM embeddings.itemEmbeddings"
		);
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
			"SELECT DISTINCT itemID FROM embeddings.itemEmbeddings"
		);
		await Zotero.DB.queryAsync("DELETE FROM embeddings.itemEmbeddings");
		if (cleared.length) {
			_notifyIndexed(cleared);
		}
	}

	// Items in a library that have a stored embedding -- the numerators for
	// indexing progress, split the way _getEligibleItemIDs() splits the
	// denominators. An item's chunks count as one item, and an attachment
	// recorded as processed-but-empty counts as done (see _indexItems()).
	async function _getIndexedCounts(libraryID) {
		let attachmentTypeID = Zotero.ItemTypes.getID('attachment');
		let row = await Zotero.DB.rowQueryAsync(
			"SELECT "
				+ "COUNT(DISTINCT CASE WHEN itemTypeID!=? THEN itemID END) AS items, "
				+ "COUNT(DISTINCT CASE WHEN itemTypeID=? THEN itemID END) AS attachments "
				+ "FROM embeddings.itemEmbeddings JOIN items USING (itemID) "
				+ "WHERE libraryID=?",
			[attachmentTypeID, attachmentTypeID, libraryID]
		);
		return { items: row.items, attachments: row.attachments };
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
	// every indexing pass runs costs a stat rather than an extraction. A
	// change to the extraction or chunking logic isn't detected -- rebuild
	// the index after one. (Nor is a pack regenerated for a processor bump
	// without the file changing -- the vectors stay derived from the older
	// extraction until the file changes or the index is rebuilt.)
	// Returns null when the attachment has no readable file, which also
	// means there's nothing to extract.
	async function _getAttachmentSourceHash(item) {
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
	}

	// The document's sections (see Zotero.SDT.getSections()) as things to
	// index. Reference entries are dropped: a bibliography is keyword-dense
	// but says nothing, so it crowds out real matches, and literal search
	// still covers it via the fulltext index. Auxiliary blocks (captions,
	// image descriptions) are lifted out into standalone sections: each is
	// worth finding on its own, but isn't part of the running text it sits in.
	function _toIndexableSections(sections) {
		let indexable = [];
		for (let section of sections) {
			let body = [];
			for (let block of section.blocks) {
				if (block.reference) {
					continue;
				}
				if (block.flowClass === 'auxiliary') {
					indexable.push(_toIndexableSection(section, [block], true));
				}
				else {
					body.push(block);
				}
			}
			if (body.length) {
				indexable.push(_toIndexableSection(section, body, false));
			}
		}
		// A body section is emitted after the auxiliary blocks it surrounds,
		// and chunk indexes are document order
		return indexable.sort((a, b) => a.startBlock - b.startBlock);
	}

	// One run of blocks as a section for the chunker, located where the run
	// starts
	function _toIndexableSection(section, blocks, auxiliary) {
		let first = blocks[0];
		return {
			text: blocks.map(block => block.text).join('\n'),
			outlinePath: section.outlinePath,
			startBlock: first.index,
			endBlock: blocks[blocks.length - 1].index,
			pageIndex: first.pageIndex ?? null,
			pageLabel: first.pageLabel ?? null,
			position: first.position ?? null,
			auxiliary
		};
	}

	// The embeddable chunks of an attachment's full text: its outline
	// sections (extracted and cached by Zotero.SDT), split to fit the model
	// window. When structured extraction yields nothing, the flat text falls
	// back to note-style paragraph chunking -- searchable, just without
	// section locations. Null when there's no embeddable text at all.
	async function _getAttachmentChunks(item) {
		let result = await Zotero.SDT.getSections(item.id);
		let sections = result.ok ? _toIndexableSections(result.sections) : [];
		// The word minimum applies to the document as a whole, not each
		// section: short sections are real content that the chunker merges,
		// but a document without three words anywhere gives the model nothing
		// to rank
		if (sections.length
				&& _hasEmbeddableText(sections.map(section => section.text).join(' '))) {
			let chunks = await Zotero.Embeddings.Chunking.chunkSections(sections);
			// An auxiliary chunk stands alone, so it's held to the same word
			// minimum as any standalone text -- a bare "Figure 1" gives the
			// model nothing to rank
			return chunks.filter(chunk => !chunk.auxiliary || _hasEmbeddableText(chunk.text));
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
		// the part numbering says where in it a chunk falls
		let chunks = await Zotero.Embeddings.Chunking.chunkText(text);
		return chunks.map((chunkText, index) => ({
			text: chunkText,
			sectionPart: index + 1,
			sectionParts: chunks.length
		}));
	}

	// Compute and store embeddings for the given items, skipping any whose
	// stored embedding is already up to date (via sourceHash). Items with no
	// embeddable text have any existing embedding removed.
	//
	// @param {Zotero.Item[]} items
	// @param {Object} [options]
	// @param {Function} [options.onProgress] - Called as { done, total }
	// @param {Number} [options.maxBatchItems=20] - Most items per engine call
	// @param {Number} [options.batchCharBudget=12000] - Most characters per
	//     engine call, counting every text in the batch as long as its longest
	//     one, since they're padded to that length. Attention memory grows with
	//     the square of the padded length, so a batch of long texts uses
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
		await Zotero.Items.loadDataTypes(items, ['itemData', 'note', 'annotation']);

		// Every start re-enqueues the whole library to find what changed, so
		// read the stored hashes in one query per chunk rather than one per
		// item. Every chunk row of an item carries the same hash.
		let storedHashes = new Map();
		let itemIDs = items.map(item => item.id);
		let chunkSize = 500;
		for (let i = 0; i < itemIDs.length; i += chunkSize) {
			let chunk = itemIDs.slice(i, i + chunkSize);
			let rows = await Zotero.DB.queryAsync(
				"SELECT DISTINCT itemID, sourceHash FROM embeddings.itemEmbeddings WHERE itemID IN ("
					+ chunk.map(() => '?').join(',') + ")",
				chunk
			);
			for (let row of rows) {
				storedHashes.set(row.itemID, row.sourceHash);
			}
		}

		let toEmbed = [];
		let toDelete = [];
		for (let item of items) {
			// An attachment's text lives in a file, so its staleness check is
			// a file-identity hash rather than a text hash -- reading and
			// sectioning every attachment on every pass would defeat the
			// check's purpose
			if (item.isAttachment()) {
				let hash = await _getAttachmentSourceHash(item);
				if (!hash) {
					if (storedHashes.has(item.id)) {
						toDelete.push(item.id);
					}
					continue;
				}
				if (storedHashes.get(item.id) !== hash) {
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
		// _getAttachmentChunks()) and split section by section. A title and
		// abstract, or an annotation's passage and comment, fit the window in
		// almost all cases, so they're embedded as a single chunk and the
		// pipeline truncates the rare outlier.
		let emptyAttachments = [];
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
				entry.chunks = await _getAttachmentChunks(entry.item);
				// Nothing embeddable anywhere in the attachment (missing
				// file, password-protected, no text layer). Record the
				// attempt anyway, so the item counts as processed and isn't
				// looked at again until the file changes.
				if (!entry.chunks || !entry.chunks.length) {
					entry.chunks = [];
					emptyAttachments.push(entry);
					continue;
				}
			}
			else if (entry.item.isNote()) {
				entry.chunks = (await Zotero.Embeddings.Chunking.chunkText(entry.text))
					.map(text => ({ text }));
			}
			else {
				entry.chunks = [{ text: entry.text }];
			}
			entry.vectors = new Array(entry.chunks.length);
			entry.remaining = entry.chunks.length;
		}
		// An attachment with nothing to embed is still processed: replace
		// whatever an older file left with a single embedding-less row
		// carrying the current source hash, so the indexed count converges on
		// the eligible count instead of these items reading as forever
		// unindexed (see _setUpDB())
		if (emptyAttachments.length) {
			await Zotero.DB.executeTransaction(async function () {
				for (let entry of emptyAttachments) {
					// The item may have been deleted while we were extracting
					if (!Zotero.Items.get(entry.item.id)) {
						continue;
					}
					await Zotero.DB.queryAsync(
						"DELETE FROM embeddings.itemEmbeddings WHERE itemID=?",
						entry.item.id
					);
					await Zotero.DB.queryAsync(
						"INSERT INTO embeddings.itemEmbeddings "
							+ "(itemID, chunkIndex, embedding, sourceHash) "
							+ "VALUES (?, 0, NULL, ?)",
						[entry.item.id, entry.hash]
					);
				}
			});
		}
		toEmbed = toEmbed.filter(entry => entry.chunks.length);

		// What gets embedded is the chunk's embedText (its text plus any
		// outline-path context); plain chunks embed their text as is.
		let embedText = chunk => chunk.embedText || chunk.text;

		// Batches are packed from the flattened chunks, so an item's chunks
		// can span batches; its rows are written only once every chunk's
		// vector is in, as one transaction, so a stop mid-item never leaves a
		// partial set that the source hash would report as complete
		let units = [];
		for (let entry of toEmbed) {
			for (let chunkIndex = 0; chunkIndex < entry.chunks.length; chunkIndex++) {
				units.push({ entry, chunkIndex });
			}
		}
		// Pack batches from chunks of similar size: the engine pads every
		// text in a batch to its longest one and compute scales with the
		// padded length, so one long chunk makes a whole mixed batch pay
		// long-chunk price. Sorting the individual chunks (an item's chunks
		// legitimately range from captions to window-sized body text) roughly
		// halves fulltext indexing time versus item-level ordering.
		units.sort((a, b) => embedText(a.entry.chunks[a.chunkIndex]).length
			- embedText(b.entry.chunks[b.chunkIndex]).length);

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
				let length = Math.max(longest, embedText(unit.entry.chunks[unit.chunkIndex]).length);
				if (count && length * (count + 1) > batchCharBudget) {
					break;
				}
				longest = length;
				count++;
			}
			let batch = units.slice(i, i + count);
			i += count;
			let vectors = await Zotero.Embeddings.embedPassages(
				batch.map(unit => embedText(unit.entry.chunks[unit.chunkIndex]))
			);
			let completed = [];
			for (let j = 0; j < batch.length; j++) {
				let { entry, chunkIndex } = batch[j];
				entry.vectors[chunkIndex] = vectors[j];
				if (--entry.remaining === 0) {
					completed.push(entry);
				}
			}
			if (completed.length) {
				await Zotero.DB.executeTransaction(async function () {
					for (let entry of completed) {
						// The item may have been deleted while the batch was
						// embedding -- don't write its vectors back after the
						// delete notifier removed them
						if (!Zotero.Items.get(entry.item.id)) {
							continue;
						}
						// Replace the item's rows as a unit, so a previously
						// longer text never leaves stale chunks behind
						await Zotero.DB.queryAsync(
							"DELETE FROM embeddings.itemEmbeddings WHERE itemID=?",
							entry.item.id
						);
						for (let k = 0; k < entry.vectors.length; k++) {
							let vector = entry.vectors[k];
							let chunk = entry.chunks[k];
							let blob = new Uint8Array(
								vector.buffer, vector.byteOffset, vector.byteLength
							);
							// The chunk text is stored only for attachments,
							// whose text lives in a file: it's what the
							// search-results section previews. Other item
							// types are their own preview.
							// Keep the embedding blobs out of debug output.
							await Zotero.DB.queryAsync(
								"INSERT INTO embeddings.itemEmbeddings "
									+ "(itemID, chunkIndex, embedding, sourceHash, "
									+ "chunkText, outlinePath, startBlock, endBlock, "
									+ "pageLabel, navPosition, sectionPart, sectionParts) "
									+ "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
								[
									entry.item.id,
									k,
									blob,
									entry.hash,
									entry.item.isAttachment() ? chunk.text : null,
									chunk.outlinePath || null,
									chunk.startBlock ?? null,
									chunk.endBlock ?? null,
									chunk.pageLabel ?? null,
									chunk.position ? JSON.stringify(chunk.position) : null,
									chunk.sectionPart ?? null,
									chunk.sectionParts ?? null
								],
								{ debugParams: false }
							);
						}
					}
				});
				_notifyIndexed(completed.map(entry => entry.item.id));
				done += completed.length;
				if (onProgress) {
					onProgress({ done, total: toEmbed.length });
				}
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
	 *
	 * Each library's counts come in two disjoint pairs: `indexed`/`eligible`
	 * for items, notes, and annotations, and `indexedAttachments`/
	 * `eligibleAttachments` for attachment fulltext, which is a far bigger and
	 * slower job. Callers that want whole-library coverage add them up.
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
			let eligible = eligibleByLibrary.get(library.libraryID)
				|| { items: [], attachments: [] };
			let indexed = await _getIndexedCounts(library.libraryID);
			// Attachments are counted separately from everything else, not
			// included in it -- the two pairs are disjoint, and consumers sum
			// them when they want the whole library
			_status.set(library.libraryID, {
				name: library.name,
				indexed: indexed.items,
				eligible: eligible.items.length,
				indexedAttachments: indexed.attachments,
				eligibleAttachments: eligible.attachments.length
			});
		}
		_emitProgress();
		return Zotero.Embeddings.Indexing.getStatus();
	};

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
			// Measure the model before storing anything scored against it. Only
			// the first run for a given model version pays for this; every
			// later one finds the numbers already in the database.
			await Zotero.Embeddings.ensureCalibration();

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
					.filter(item => item.isRegularItem() || item.isNote() || item.isAnnotation()
						|| (_indexFulltextEnabled() && _isIndexableAttachment(item)));
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
		if (now - _lastStatusRefresh < STATUS_REFRESH_INTERVAL) {
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

/**
 * Zotero.Embeddings.Calibration -- how a model's scoring numbers are derived.
 *
 * A model can't tell you the mean vector its embeddings share, the score below
 * which nothing is a match, or the score at which the Relevance bar fills.
 * Those are measured, by running the model over a fixed corpus of query/passage
 * pairs and reading the answers off the resulting distributions.
 *
 * For a corpus of N pairs, measure() does this:
 *
 *   1. Embed all N queries and all N passages, with the model's own prefixes.
 *   2. Average the passage vectors into the mean, then center all 2N by it --
 *      the same centering scoring uses.
 *   3. Score every query against every passage: an N x N grid.
 *   4. The diagonal holds the N matched pairs, each query with the passage it
 *      was written for; the N*(N-1) cells off it are unrelated text.
 *   5. minScore is NULL_PERCENTILE of those off-diagonal scores, and
 *      maxDisplayScore is MATCH_PERCENTILE of the diagonal.
 *
 * Zotero.Embeddings calls this once per model version, then stores the result
 * and applies it while scoring.
 */
Zotero.Embeddings.Calibration = new function () {
	// Where the score floor goes, as a percentile of the null distribution --
	// what this model scores between texts with nothing to do with each other
	// (`mismatched` in measure()). At 0.99 only the top 1% of unrelated pairs
	// reach it; raising it cuts more noise and more weak-but-real matches along
	// with it, lowering it keeps both.
	const NULL_PERCENTILE = 0.99;
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

	// Query/passage pairs spanning fields, languages, and lengths: the titles
	// and abstracts, note paragraphs, and annotation-style passages that
	// indexing stores. Each query is what someone might plausibly type to find
	// its passage, and no two pairs anywhere in the corpus share a subject --
	// not even as translations of each other, since a model measured on several
	// languages at once scores a passage's translation like the passage itself,
	// and a real match sitting in the null distribution raises the floor
	// against exactly the cross-language searches such a model is for. That
	// disjointness is what makes a query paired with any *other* passage an
	// honest example of two texts that have nothing to do with each other. A
	// language wants enough pairs for the floor to land on a settled stretch of
	// the unrelated-score tail rather than on its few highest values (see
	// NULL_PERCENTILE).
	const CORPUS = {
		// English. Also the largest set, since it's the one an English-only
		// model is measured against.
		en: [
			{
				query: 'qualitative research methods',
				passage: 'Grounded theory methodology in qualitative sociology'
			},
			{
				query: 'gut bacteria and metabolism',
				passage: 'The gut microbiome influences host metabolism through short-chain fatty acid production'
			},
			{
				query: 'predicting protein structure with deep learning',
				passage: 'A transformer architecture for protein structure prediction from sequence alone'
			},
			{
				query: 'lack of sleep and memory',
				passage: 'Sleep deprivation impairs hippocampal memory consolidation in rodents'
			},
			{
				query: 'does peer review work',
				passage: 'Does peer review improve manuscript quality? Evidence from a randomized trial'
			},
			{
				query: 'reward prediction error dopamine',
				passage: 'Dopaminergic neurons in the ventral tegmental area encode reward prediction error'
			},
			{
				query: 'speaking two languages and dementia risk',
				passage: 'Bilingualism and the onset of dementia: a population-based cohort study'
			},
			{
				query: 'amyloid hypothesis alzheimer',
				passage: 'The amyloid cascade hypothesis of Alzheimer disease revisited'
			},
			{
				query: 'is depression caused by low serotonin',
				passage: 'Critiques of the serotonin hypothesis of depression'
			},
			{
				query: 'machine learning weather models',
				passage: 'Machine learning emulation of atmospheric convection'
			},
			{
				query: 'french colonial atlantic history',
				passage: 'The colonial history of the French Atlantic world, 1660-1800'
			},
			{
				query: 't cell exhaustion crispr screen',
				passage: 'CRISPR screens identify regulators of T cell exhaustion'
			},
			{
				query: 'higgs boson mass measurement',
				passage: 'Measurement of the Higgs boson mass in the four-lepton channel'
			},
			{
				query: 'coral reefs and acidifying oceans',
				passage: 'Ocean acidification reduces coral reef calcification rates'
			},
			{
				query: 'heat deaths in cities',
				passage: 'Urban heat islands and heat-related mortality in European cities'
			},
			{
				query: 'economics of baroque opera',
				passage: 'Patronage and the economics of eighteenth-century opera'
			},
			{
				query: 'quantum error correction',
				passage: 'Quantum error correction with surface codes on superconducting qubits'
			},
			{
				query: 'unions and wage inequality',
				passage: 'Wage inequality and the decline of labor market institutions'
			},
			{
				query: 'hospital antibiotic resistance',
				passage: 'Antibiotic resistance in hospital-acquired Klebsiella infections'
			},
			{
				query: 'how the brain handles uncertainty',
				passage: 'Neural correlates of decision making under uncertainty'
			},
			{
				query: 'farming and declining bees',
				passage: 'Land use change and pollinator decline in temperate agriculture'
			},
			{
				query: 'evidentiality in indigenous languages',
				passage: 'A grammar of evidentiality in Amazonian languages'
			},
			{
				query: 'courts and the erosion of democracy',
				passage: 'Constitutional courts and democratic backsliding'
			},
			{
				query: 'how heavy elements form in stars',
				passage: 'Stellar nucleosynthesis in asymptotic giant branch stars'
			},
			{
				query: 'himalayan river erosion',
				passage: 'Tectonic controls on Himalayan river incision'
			},
			{
				query: 'ovid in medieval literature',
				passage: 'The reception of Ovid in medieval French romance'
			},
			{
				query: 'therapy for insomnia trial',
				passage: 'Randomized trial of cognitive behavioral therapy for insomnia'
			},
			{
				query: 'supply chains after the pandemic',
				passage: 'Supply chain resilience after the 2020 disruption'
			},
			{
				query: 'splitting water with sunlight',
				passage: 'Photocatalytic water splitting with earth-abundant catalysts'
			},
			{
				query: 'neolithic dairy farming',
				passage: 'Archaeological evidence for early dairying in Neolithic Europe'
			},
			{
				query: 'social media and teenage mental health',
				passage: 'Social media use and adolescent wellbeing: a longitudinal analysis'
			},
			{
				query: 'solving stiff ODEs numerically',
				passage: 'Numerical methods for stiff differential equations'
			},
			{
				query: 'long covid prevalence',
				passage: 'The epidemiology of long COVID in primary care'
			},
			{
				query: 'roman political oratory',
				passage: 'Rhetoric and citizenship in the Roman republic'
			},
			{
				query: 'segmenting medical images',
				passage: 'Deep learning for medical image segmentation'
			},
			{
				query: 'interest rates in developing economies',
				passage: 'Monetary policy transmission in emerging markets'
			},
			{
				query: 'farmed salmon escaping into the wild',
				passage: 'Gene flow between domestic and wild populations of Atlantic salmon'
			},
			{
				query: 'philosophy of the body',
				passage: 'Phenomenology of embodiment in twentieth-century philosophy'
			},
			{
				query: 'getting drugs into the brain',
				passage: 'Nanoparticle drug delivery across the blood-brain barrier'
			},
			{
				query: 'plague mortality in medieval england',
				passage: 'Historical demography of the Black Death in England'
			},
			{
				query: 'why replication attempts fail',
				passage: 'The replication attempts collected here differ from the originals in ways '
					+ 'that are easy to overlook. Sample sizes were larger, but recruitment moved '
					+ 'online, and the populations are not the same ones the original authors drew '
					+ 'from. Where an effect failed to replicate, it is rarely possible to say '
					+ 'whether the original was a false positive or the replication was run under '
					+ 'conditions that suppress a real effect. Both explanations predict the same '
					+ 'null result, which is why the debate has not been settled by more data alone.'
			},
			{
				query: 'cost effectiveness of preventive care',
				passage: 'A recurring finding is that prevention saves lives without saving money. '
					+ 'Screening programs catch disease earlier and extend life, and the additional '
					+ 'years carry their own costs of care. The programs that do pay for themselves '
					+ 'tend to be the narrow ones aimed at populations with high baseline risk, '
					+ 'where the number needed to screen is small. Broad screening of low-risk '
					+ 'populations improves outcomes at considerable expense, which is a defensible '
					+ 'thing to buy but should not be defended on the grounds that it is cheap.'
			},
			{
				query: 'archival silence and colonial records',
				passage: 'The archive records what the administration found worth recording, which '
					+ 'means the people it governed appear mostly at moments of friction: tax '
					+ 'disputes, criminal proceedings, petitions. Reading these documents for '
					+ 'ordinary life means reading against their purpose, and the silences are not '
					+ 'random. Whole categories of activity went unwritten precisely because they '
					+ 'were unremarkable to the clerk, and their absence from the record has been '
					+ 'mistaken more than once for absence from the world.'
			},
			{
				query: 'attention mechanism computational cost',
				passage: 'Self-attention compares every position against every other, so its cost '
					+ 'grows with the square of the sequence length. For short inputs this is '
					+ 'irrelevant next to the cost of the feedforward layers, but it dominates '
					+ 'once sequences reach the thousands. The approximations proposed since -- '
					+ 'sparse patterns, low-rank projections, kernel methods -- all trade some '
					+ 'exactness for a lower asymptotic cost, and which trade is acceptable '
					+ 'depends on whether the task needs long-range precision or merely long context.'
			},
			{
				query: 'measurement error in survey research',
				passage: 'Respondents answer the question they understood, which is not always the '
					+ 'question that was asked. Small changes in wording move responses by margins '
					+ 'comparable to the effects under study, and the direction of the shift is '
					+ 'often predictable from the order of the response options alone. Treating '
					+ 'these as noise understates the problem: the error is systematic, correlated '
					+ 'with the characteristics being measured, and does not average out with a '
					+ 'larger sample.'
			},
			{
				query: 'this assumes stationarity which seems unwarranted',
				passage: 'The model assumes the underlying distribution is stable over the study '
					+ 'period. Given the intervening policy change, that seems hard to defend -- '
					+ 'and the authors never test it.'
			},
			{
				query: 'sample size justification missing',
				passage: 'No power analysis is reported anywhere in the methods. With n=24 per '
					+ 'group, the study is only powered to detect effects far larger than the '
					+ 'literature suggests are plausible.'
			}
		],
		// Chinese.
		zh: [
			{
				query: '青蒿素的抗疟机制',
				passage: '青蒿素及其衍生物抗疟原虫作用机制的研究进展'
			},
			{
				query: '高铁对区域经济的影响',
				passage: '高速铁路开通对沿线城市经济发展的影响研究'
			},
			{
				query: '汉语方言的声调差异',
				passage: '吴语方言声调系统的实验语音学分析'
			},
			{
				query: '稻田的甲烷排放',
				passage: '水稻田甲烷排放的季节变化及其调控因素'
			},
			{
				query: '大熊猫种群的遗传多样性',
				passage: '野生大熊猫种群的遗传多样性与栖息地破碎化'
			},
			{
				query: '固态锂电池的界面问题',
				passage: '固态锂电池电极与电解质界面稳定性研究'
			},
			{
				query: '青藏高原冻土退化',
				passage: '青藏高原多年冻土退化及其碳释放效应'
			},
			{
				query: '宋代科举与社会流动',
				passage: '宋代科举制度与士人阶层的社会流动研究'
			},
			{
				query: '明清白话小说的叙事',
				passage: '明清白话小说叙事视角的演变研究'
			},
			{
				query: '青少年近视与户外活动',
				passage: '学龄儿童近视患病率上升与户外活动时间的关系'
			},
			{
				query: '敦煌文献整理',
				passage: '敦煌藏经洞出土文献的整理与断代研究'
			},
			{
				query: '人口老龄化与养老金',
				passage: '人口老龄化背景下养老保险制度的可持续性分析'
			},
			{
				query: '绿茶多酚的抗氧化作用',
				passage: '绿茶儿茶素类化合物清除自由基的构效关系研究'
			},
			{
				query: '垃圾分类政策为什么难以推行',
				passage: '垃圾分类政策的执行效果在不同城市之间差异很大，而这种差异很难用宣传力度来解释。'
					+ '居民是否坚持分类，更多取决于投放点的便利程度、监督是否持续，'
					+ '以及分类后的垃圾是否被混装混运——一旦居民发现分好的垃圾被混在一起运走，'
					+ '参与率会迅速下降，且很难恢复。把执行失败归结为居民素质，'
					+ '会掩盖收运体系本身的问题，而后者恰恰是政策设计中最容易被忽视的环节。'
			},
			{
				query: '对照组的选择存在偏倚',
				passage: '对照组全部来自另一家医院，两组患者的基线特征并不可比。'
					+ '观察到的组间差异有多少来自干预本身，无从判断。'
			}
		],
		// Languages without a code of their own. Only models that claim no
		// single language -- the multilingual one -- are measured on these,
		// together with everything above.
		other: [
			{
				query: 'transition énergétique des villes',
				passage: 'Étude sur la transition énergétique dans les villes européennes'
			},
			{
				query: 'Erinnerung in der Nachkriegsliteratur',
				passage: 'Die Rolle des Gedächtnisses in der deutschen Nachkriegsliteratur'
			},
			{
				query: 'biodiversidad en bosques tropicales',
				passage: 'Un estudio sobre la biodiversidad en los bosques tropicales'
			},
			{
				query: '地震の早期警報システム',
				passage: '地震早期警報システムの精度と即時性に関する研究'
			},
			{
				query: 'деградация чернозёмов',
				passage: 'Исследование деградации чернозёмных почв при интенсивном земледелии'
			},
			{
				query: 'necropoli etrusche',
				passage: 'Uno studio archeologico sulle necropoli etrusche in Italia centrale'
			},
			{
				query: 'políticas de saúde no Brasil',
				passage: 'Estudo sobre políticas públicas de saúde no Brasil'
			},
			{
				query: 'waterbeheer in laaggelegen gebieden',
				passage: 'Onderzoek naar waterbeheer in laaggelegen gebieden'
			},
			{
				query: 'historia gospodarcza Europy Środkowej',
				passage: 'Badania nad historią gospodarczą Europy Środkowej'
			}
		]
	};

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
	 * @return {Object[]} - [{ query, passage }]
	 */
	this.getCorpus = function () {
		let language = Zotero.Embeddings.getModelLanguage();
		if (!language) {
			return Object.values(CORPUS).flat();
		}
		if (!Object.prototype.hasOwnProperty.call(CORPUS, language)) {
			throw new Error(`Model '${Zotero.Embeddings.getModelName()}' claims language `
				+ `'${language}', which isn't one the corpus is written in `
				+ `(${Object.keys(this.languages).join(', ')})`);
		}
		return CORPUS[language];
	};

	/**
	 * Run the active model over its corpus and derive its three numbers: the
	 * mean of the passage embeddings, and the two ends of the score band, read
	 * off the distributions of matched and mismatched pairs.
	 *
	 * @return {Promise<Object>} - { mean, minScore, maxDisplayScore }
	 */
	this.measure = async function () {
		let corpus = this.getCorpus();
		let queryPrefix = Zotero.Embeddings.getQueryPrefix();
		let passagePrefix = Zotero.Embeddings.getPassagePrefix();
		Zotero.debug(`Embeddings: measuring against ${corpus.length} query/passage pairs`);
		let queries = await _embedAll(corpus.map(pair => queryPrefix + pair.query));
		let passages = await _embedAll(corpus.map(pair => passagePrefix + pair.passage));

		// The direction every embedding shares, which says nothing about the
		// text. Taken over the passages, since those are what gets stored.
		let mean = new Float32Array(passages[0].length);
		for (let vector of passages) {
			for (let d = 0; d < mean.length; d++) {
				mean[d] += vector[d] / passages.length;
			}
		}

		// Scoring compares centered vectors, so calibrate on centered scores,
		// using the same centering and comparison the search path uses
		queries = queries.map(vector => Zotero.Embeddings.center(vector, mean));
		passages = passages.map(vector => Zotero.Embeddings.center(vector, mean));
		let matched = [];
		let mismatched = [];
		for (let i = 0; i < queries.length; i++) {
			for (let j = 0; j < passages.length; j++) {
				(i === j ? matched : mismatched)
					.push(Zotero.Embeddings.dot(queries[i], passages[j]));
			}
		}
		let minScore = _percentile(mismatched, NULL_PERCENTILE);
		let maxDisplayScore = _percentile(matched, MATCH_PERCENTILE);
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
