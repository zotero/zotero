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


{
	const lazy = {};
	ChromeUtils.defineESModuleGetters(lazy, {
		ControllerAPIBase: "chrome://zotero/content/xpcom/pluginAPI/controllerAPIBase.mjs",
		ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
		PathIdentity: "chrome://zotero/content/xpcom/plugins/filePath.mjs",
	});

	const FILE_FLAVOR = "application/x-moz-file";
	const IMAGE_FLAVOR = "application/x-moz-nativeimage";
	// What `flavors` looks for unless asked about others
	const KNOWN_FLAVORS = Object.freeze(["text/plain", "text/html", FILE_FLAVOR, IMAGE_FLAVOR]);

	// How each flavor may be asked for, the first entry by default, mapped to the core reader's data type; a
	// text flavor holds a string, which the core reader cannot give as bytes
	const FORMS = Object.freeze({
		[FILE_FLAVOR]: { path: "path", text: "string", bytes: "binary" },
		[IMAGE_FLAVOR]: { bytes: "binary", base64: "string" },
		other: { text: "string" },
	});

	// The request catalog as types for callers; keep in sync with the constructor's definitions
	/**
	 * @typedef {object} ClipboardControllerQueryParams
	 * @property {{ flavors?: string[] }} flavors
	 * @property {{ flavor: string, as?: "text" | "bytes" | "path" | "base64" }} read
	 *
	 *
	 * @typedef {object} ClipboardControllerQueryResults
	 * @property {{ flavors: string[] }} flavors - Those present, of the ones asked about
	 * @property {{ data: string | Uint8Array | null }} read - A file is its canonical path unless asked for its content
	 *
	 *
	 * @typedef {object} ClipboardControllerCommandParams
	 * @property {{ data: Record<string, string | Uint8Array> }} write - Flavor -> value; a file flavor takes a canonical path
	 *
	 *
	 * @typedef {object} ClipboardControllerCommandResults
	 * @property {{}} write
	 */
	class ClipboardControllerInternal extends lazy.ControllerAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "ClipboardController",
				queries: {
					flavors: {
						permissions: "clipboardRead",
						params: { flavors: { type: "array", optional: true } },
						handler: ({ flavors = KNOWN_FLAVORS }) => ({ flavors: flavors.filter(flavor => this._has(flavor)) }),
					},
					read: {
						permissions: "clipboardRead",
						params: { flavor: "string", as: { type: "string", optional: true } },
						handler: ({ flavor, as }) => ({ data: this._read(flavor, as) }),
					},
				},
				commands: {
					write: {
						permissions: "clipboardWrite",
						params: { data: { type: "object", checkHook: data => Object.keys(data).length > 0 || "must hold at least one flavor" } },
						handler: ({ data }) => {
							Zotero.Utilities.Internal.copyToClipboard(this._native(data));
							return {};
						},
					},
				},
			};
		}

		_has(flavor) {
			let clipboard = Services.clipboard;
			return clipboard.hasDataMatchingFlavors([flavor], 1, clipboard.kGlobalClipboard);
		}

		// The core reader's answer in the plugin's terms: a canonical path, bytes as a view, or a string
		_read(flavor, as) {
			let forms = FORMS[flavor] || FORMS.other;
			let form = as ?? Object.keys(forms)[0];
			if (!Object.hasOwn(forms, form)) {
				this._throw(lazy.ControllerAPIBase.errorCodes.INVALID_PARAMS, `'${flavor}' cannot be read as '${as}'`);
			}
			let data = Zotero.Utilities.Internal.getClipboard(flavor, forms[form]);
			if (data === null) {
				return null;
			}
			if (form === "path") {
				return lazy.PathIdentity.canonicalize(data);
			}
			return form === "bytes" ? new Uint8Array(data) : data;
		}

		// A file flavor's value is a canonical path here and a native one for the core writer
		_native(data) {
			let out = { ...data };
			if (typeof out[FILE_FLAVOR] === "string") {
				out[FILE_FLAVOR] = lazy.PathIdentity.toNative(lazy.PathIdentity.canonicalize(out[FILE_FLAVOR]));
			}
			return out;
		}
	}

	/**
	 * The system clipboard for plugins: reads with clipboardRead, writes with clipboardWrite
	 * @memberof Zotero
	 */
	Zotero.ClipboardController = {
		errorCodes: lazy.ControllerAPIBase.errorCodes,

		_clipboardController: new ClipboardControllerInternal(),

		/**
		 * Read what the clipboard holds
		 * @template {keyof ClipboardControllerQueryParams} N
		 * @param {N} name
		 * @param {ClipboardControllerQueryParams[N]} [params]
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<ControllerResponse<ClipboardControllerQueryResults[N]>>}
		 */
		query(name, params, _callerPluginID) {
			return Zotero.ClipboardController._clipboardController.query(name, params, _callerPluginID);
		},

		/**
		 * Put data on the clipboard
		 * @template {keyof ClipboardControllerCommandParams} N
		 * @param {N} name
		 * @param {ClipboardControllerCommandParams[N]} [params]
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<ControllerResponse<ClipboardControllerCommandResults[N]>>}
		 */
		command(name, params, _callerPluginID) {
			return Zotero.ClipboardController._clipboardController.command(name, params, _callerPluginID);
		},
	};

	let injectCaller = ({ pluginID, args }) => {
		args[2] = pluginID;
	};
	lazy.ScopeVariables.setCustomParser(Zotero.ClipboardController.query, injectCaller);
	lazy.ScopeVariables.setCustomParser(Zotero.ClipboardController.command, injectCaller);
}
