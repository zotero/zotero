/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://digitalscholar.org

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
		ScopeUtils: "chrome://zotero/content/xpcom/plugins/utils.mjs",
		VarCheck: "chrome://zotero/content/xpcom/plugins/utils.mjs",
		Params: "chrome://zotero/content/xpcom/pluginAPI/apiParams.mjs",
	});

	/**
	 * @typedef {object} InteropCommandInfo
	 * @property {string} commandName
	 * @property {string} commandVersion
	 */

	// The request catalog as types for callers; keep in sync with the constructor's definitions
	/**
	 * @typedef {object} PluginInteropControllerQueryParams
	 * @property {{ targetPluginID: string }} commands
	 *
	 *
	 * @typedef {object} PluginInteropControllerQueryResults
	 * @property {{ commands: InteropCommandInfo[] }} commands
	 *
	 *
	 * @typedef {object} PluginInteropControllerCommandParams
	 * @property {{ targetPluginID: string, commandName: string, data?: *, minVersion?: string, maxVersion?: string }} call
	 *
	 *
	 * @typedef {object} PluginInteropControllerCommandResults
	 * @property {{ value: * }} call - What the command returned, settled if it was a promise
	 */

	class PluginInteropControllerInternal extends lazy.ControllerAPIBase {
		// The request codes, plus the one only a call can meet: the other plugin's command threw or rejected
		static errorCodes = Object.freeze({
			...lazy.ControllerAPIBase.errorCodes,
			COMMAND_FAILED: "CommandFailed",
		});

		constructor() {
			super();
			this.config = {
				apiName: "PluginInteropController",
				queries: {
					commands: {
						params: { targetPluginID: lazy.Params.nonEmptyString },
						handler: ({ targetPluginID }, { caller }) => this._listCommands(targetPluginID, caller),
					},
				},
				commands: {
					call: {
						params: {
							targetPluginID: lazy.Params.nonEmptyString,
							commandName: lazy.Params.nonEmptyString,
							data: { type: "any", optional: true },
							minVersion: { type: "string", optional: true },
							maxVersion: { type: "string", optional: true },
						},
						handler: (params, { caller }) => this._call(params, caller),
					},
				},
			};
		}

		// A sandbox caller reaches only the providers its manifest declares
		_requireDeclared(targetPluginID, caller) {
			if (caller.privileged) {
				return;
			}
			if (!lazy.VarCheck.checkScopePermission(caller.scope, "INTEROP_PERMISSIONS", targetPluginID)) {
				this._throw(lazy.ControllerAPIBase.errorCodes.PERMISSION_DENIED,
					`Commands of ${targetPluginID} require it in interop_permissions`);
			}
		}

		// Named clear of the base's _commands registry
		_listCommands(targetPluginID, caller) {
			this._requireDeclared(targetPluginID, caller);
			return { commands: Zotero.PluginInteropManager._registry.commandsOf(targetPluginID) };
		}

		/**
		 * @param {PluginInteropControllerCommandParams["call"]} params
		 * @param {RequestCaller} caller
		 * @returns {Promise<PluginInteropControllerCommandResults["call"]>}
		 */
		async _call({ targetPluginID, commandName, data, minVersion, maxVersion }, caller) {
			this._requireDeclared(targetPluginID, caller);
			let option = Zotero.PluginInteropManager._registry.lookUp(targetPluginID, commandName);
			if (!option) {
				this._throw(lazy.ControllerAPIBase.errorCodes.NOT_FOUND, `${targetPluginID} has no command '${commandName}'`);
			}
			let version = option.commandVersion;
			if ((minVersion && Zotero.Utilities.semverCompare(version, minVersion) < 0)
					|| (maxVersion && Zotero.Utilities.semverCompare(version, maxVersion) > 0)) {
				this._throw(lazy.ControllerAPIBase.errorCodes.NOT_FOUND,
					`Command '${commandName}' of ${targetPluginID} is version ${version}, not within ${minVersion ?? "*"}..${maxVersion ?? "*"}`,
					{ version });
			}
			let value;
			try {
				value = await option.command({ callerPluginID: caller.pluginID, data });
			}
			catch (e) {
				this._throw(PluginInteropControllerInternal.errorCodes.COMMAND_FAILED, String(e?.message ?? e));
			}
			return { value: lazy.ScopeUtils.toPlainData(value) };
		}
	}

	/**
	 * The consumer side of cross-plugin commands: list a provider's and call one, each call checked against
	 * the caller's interop_permissions and traced
	 * @memberof Zotero
	 */
	Zotero.PluginInteropController = {
		errorCodes: PluginInteropControllerInternal.errorCodes,

		_interopController: new PluginInteropControllerInternal(),

		/**
		 * Read what a provider offers
		 * @template {keyof PluginInteropControllerQueryParams} N
		 * @param {N} name
		 * @param {PluginInteropControllerQueryParams[N]} [params]
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<APIResponse<PluginInteropControllerQueryResults[N]>>}
		 */
		query(name, params, _callerPluginID) {
			return Zotero.PluginInteropController._interopController.query(name, params, _callerPluginID);
		},

		/**
		 * Call a provider's command
		 * @template {keyof PluginInteropControllerCommandParams} N
		 * @param {N} name
		 * @param {PluginInteropControllerCommandParams[N]} [params]
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<APIResponse<PluginInteropControllerCommandResults[N]>>}
		 */
		command(name, params, _callerPluginID) {
			return Zotero.PluginInteropController._interopController.command(name, params, _callerPluginID);
		},
	};

	let injectCaller = ({ pluginID, args }) => {
		args[2] = pluginID;
	};
	lazy.ScopeVariables.setCustomParser(Zotero.PluginInteropController.query, injectCaller);
	lazy.ScopeVariables.setCustomParser(Zotero.PluginInteropController.command, injectCaller);
}
