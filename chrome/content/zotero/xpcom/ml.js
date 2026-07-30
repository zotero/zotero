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
	// Hosts models may be loaded from, in the runtime's allow-list format.
	// Local files cover models Zotero downloads itself; the runtime always
	// allows chrome://, resource://, and localhost.
	const ALLOWED_MODEL_HOSTS = [
		{ filter: 'ALLOW', urlPrefix: 'file://' },
		{ filter: 'ALLOW', urlPrefix: 'https://huggingface.co/' }
	];

	// The backends that run on the native libraries Firefox ships. The rest
	// either load a WebAssembly runtime from a Remote Settings attachment
	// ('onnx' and 'wllama', plus the 'best-*' backends that fall back to them)
	// or aren't local at all ('openai').
	const NATIVE_BACKENDS = ['onnx-native', 'llama.cpp'];

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
	 * The model is downloaded on first use and cached by the runtime. Model
	 * hosts other than Mozilla's and localhost are rejected unless the
	 * MOZ_ALLOW_EXTERNAL_ML_HUB environment variable is set.
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
