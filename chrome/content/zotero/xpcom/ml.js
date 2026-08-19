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
 * Zotero.ML -- access to Firefox's machine-learning runtime
 * (toolkit/components/ml), which runs models in a separate, memory-gated
 * inference process using the native ONNX Runtime and llama.cpp libraries
 * Firefox ships.
 *
 * Engines are created through createEngine(), which supplies the runtime
 * configuration Zotero's build requires. Callers pass the model and task.
 */
Zotero.ML = new function () {
	// Hosts models may be downloaded from, in the runtime's allow-list format.
	// The runtime additionally always allows chrome://, resource://, and
	// localhost.
	const ALLOWED_MODEL_HOSTS = [
		{ filter: 'ALLOW', urlPrefix: 'https://huggingface.co/' }
	];

	// The backends that run on the native libraries Firefox ships. The rest
	// either load a WebAssembly runtime from a Remote Settings attachment
	// ('onnx' and 'wllama', plus the 'best-*' backends that fall back to them)
	// or aren't local at all ('openai').
	const NATIVE_BACKENDS = ['onnx-native', 'llama.cpp'];

	// Default host and URL layout for models, for operations that address the
	// model cache without creating an engine
	const MODEL_HUB_ROOT_URL = 'https://huggingface.co';
	const MODEL_HUB_URL_TEMPLATE = '{model}/resolve/{revision}';

	var _configured = false;

	/**
	 * The runtime reads its model configuration, runtime configuration, and
	 * model-host policy from Remote Settings, which Zotero's build omits.
	 * Supply those collections here: the model and runtime collections return
	 * no records, which the runtime handles by falling back to the
	 * configuration passed to createEngine(), and the host policy comes from
	 * ALLOWED_MODEL_HOSTS. Without this, loading the empty Remote Settings
	 * module throws when the runtime first looks up a collection.
	 */
	function _configureRuntime() {
		if (_configured) {
			return;
		}
		let { MLEngineParent } = ChromeUtils.importESModule(
			"resource://gre/actors/MLEngineParent.sys.mjs"
		);
		let client = records => ({
			get: async () => records,
			on() {},
			off() {}
		});
		MLEngineParent.mockRemoteSettings({
			'ml-onnx-runtime': client([]),
			'ml-inference-options': client([]),
			'ml-model-allow-deny-list': client(ALLOWED_MODEL_HOSTS)
		});
		_configured = true;
	}

	/**
	 * Whether the runtime can run models, which requires an enabled runtime
	 * and enough physical memory for the inference process
	 *
	 * @return {Boolean}
	 */
	this.isAvailable = function () {
		if (!Services.prefs.getBoolPref('browser.ml.enable', false)) {
			return false;
		}
		if (!Services.prefs.getBoolPref('browser.ml.checkForMemory', true)) {
			return true;
		}
		let minimum = Services.prefs.getIntPref('browser.ml.minimumPhysicalMemory', 3);
		let utils = Cc["@mozilla.org/ml-utils;1"].getService(Ci.nsIMLUtils);
		return utils.totalPhysicalMemory >= minimum * 1024 * 1024 * 1024;
	};

	/**
	 * Create an inference engine.
	 *
	 * The model is downloaded on first use and cached by the runtime. Its host
	 * has to be one of ALLOWED_MODEL_HOSTS.
	 *
	 * @param {Object} options - Pipeline options for the runtime, including
	 *     `taskName`, `modelId`, and `backend` (see NATIVE_BACKENDS)
	 * @param {Function} [onProgress] - Called with the runtime's download and
	 *     initialization progress
	 * @return {Promise<Object>} - The engine, with run() and terminate()
	 */
	this.createEngine = async function (options, onProgress) {
		if (!this.isAvailable()) {
			throw new Error("Machine-learning runtime is not available");
		}
		if (!NATIVE_BACKENDS.includes(options.backend)) {
			throw new Error(`Backend '${options.backend}' requires a runtime this build `
				+ `doesn't include -- use one of: ${NATIVE_BACKENDS.join(', ')}`);
		}
		_configureRuntime();
		let { createEngine } = ChromeUtils.importESModule(
			"chrome://global/content/ml/EngineProcess.sys.mjs"
		);
		Zotero.debug(`ML: creating ${options.taskName} engine for `
			+ `${options.modelId} on ${options.backend}`);
		return createEngine(options, onProgress);
	};

	/**
	 * Thread count the runtime recommends for CPU inference on this machine.
	 * Throughput scales with threads up to a point and then drops off, so
	 * running more is slower, not just less polite.
	 *
	 * @return {Number}
	 */
	this.getOptimalConcurrency = function () {
		return Cc["@mozilla.org/ml-utils;1"]
			.getService(Ci.nsIMLUtils)
			.getOptimalCPUConcurrency();
	};

	/**
	 * Models the runtime has cached.
	 *
	 * The runtime stores each model under a name qualified by the host it came
	 * from, so entries also carry the `modelId` that was passed to
	 * createEngine(). Deletions address a model by its stored `name`.
	 *
	 * @param {Object} [options]
	 * @param {String} [options.taskName] - Limit to models cached for a task
	 * @return {Promise<Object[]>} - [{ taskName, name, modelId, revision }]
	 */
	this.listModels = async function ({ taskName } = {}) {
		let host = new URL(MODEL_HUB_ROOT_URL).host + '/';
		let models = await _getModelHub().listModels();
		if (taskName) {
			models = models.filter(model => model.taskName === taskName);
		}
		return models.map(model => ({
			...model,
			modelId: model.name.startsWith(host) ? model.name.slice(host.length) : model.name
		}));
	};

	/**
	 * Delete cached model files, freeing the disk space they use.
	 *
	 * @param {Object} options
	 * @param {String} [options.taskName] - Limit to models cached for a task
	 * @param {String} [options.model] - Limit to one model, by the stored
	 *     `name` from listModels()
	 * @param {String} [options.revision] - Limit to one revision
	 * @return {Promise}
	 */
	this.deleteModels = async function ({ taskName, model, revision } = {}) {
		await _getModelHub().deleteModels({ taskName, model, revision, deletedBy: 'zotero' });
	};

	/**
	 * Read a single file of a model (e.g. its tokenizer) from the runtime's
	 * model cache, fetching it from the model hub if it isn't cached yet.
	 *
	 * @param {Object} options
	 * @param {String} options.taskName - Task the model is cached for, as
	 *     passed to createEngine() -- the cache registers every file under it
	 * @param {String} options.modelId - The model id, as passed to createEngine()
	 * @param {String} options.file - File path within the model repository
	 *     (e.g. 'tokenizer.json')
	 * @param {String} [options.engineId]
	 * @param {String} [options.revision='main']
	 * @return {Promise<ArrayBuffer>}
	 */
	this.getModelFile = async function ({ taskName, modelId, file, engineId, revision = 'main' }) {
		let [buffer] = await _getModelHub().getModelFileAsArrayBuffer({
			engineId,
			taskName,
			model: modelId,
			revision,
			file
		});
		return buffer;
	};

	function _getModelHub() {
		let { ModelHub } = ChromeUtils.importESModule(
			"chrome://global/content/ml/ModelHub.sys.mjs"
		);
		return new ModelHub({
			rootUrl: MODEL_HUB_ROOT_URL,
			urlTemplate: MODEL_HUB_URL_TEMPLATE,
			// A hub constructed without a list denies every external host --
			// the engine's own hub gets this same policy from the Remote
			// Settings mock (see _configureRuntime())
			allowDenyList: ALLOWED_MODEL_HOSTS
		});
	}

	/**
	 * Shut down the inference process, releasing the memory held by any
	 * loaded models
	 *
	 * @return {Promise}
	 */
	this.shutdown = async function () {
		if (!_configured) {
			return;
		}
		let { EngineProcess } = ChromeUtils.importESModule(
			"chrome://global/content/ml/EngineProcess.sys.mjs"
		);
		await EngineProcess.destroyMLEngine();
	};
};
