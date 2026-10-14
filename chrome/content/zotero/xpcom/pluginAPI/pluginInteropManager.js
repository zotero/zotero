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
		ManagerAPIBase: "chrome://zotero/content/xpcom/pluginAPI/managerAPIBase.mjs",
		ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
		PluginSandbox: "chrome://zotero/content/xpcom/plugins/sandbox.mjs",
	});

	/**
	 * @typedef {object} PluginInteropRegistrationOptions
	 * @property {string} pluginID - The command provider; injected for a sandbox caller
	 * @property {string} commandName - Unique per plugin
	 * @property {string} [commandVersion] - Semantic version; the plugin's own unless given
	 * @property {function({ callerPluginID: string, data: * }): *} command - May return a promise; only
	 *   primitives, plain objects and arrays cross in either direction
	 */

	class PluginInteropManagerInternal extends lazy.ManagerAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "PluginInteropManager",
				mainKeyName: "commandName",
				pluginIDKeyName: "pluginID",
				// Disable notifier
				notifyType: false,
				optionTypeDefinition: {
					commandName: "string",
					pluginID: "string",
					commandVersion: { type: "string", optional: true },
					command: {
						type: "function",
						// The controller reports what the command throws, so no catch-all wrapper
						unsafeFunction: true,
					},
				},
			};
		}

		// The base makes commandName the namespaced key; the name as registered is what a consumer sees
		_validate(option) {
			let name = option.commandName;
			option = super._validate(option);
			if (option) {
				option.name = name;
			}
			return option;
		}

		_convert(option) {
			option = super._convert(option);
			option.command = lazy.ScopeVariables.fromScope(
				option.command,
				option.pluginID,
			);
			// Set default version to plugin version if not specified
			if (!option.commandVersion) {
				let scope = lazy.PluginSandbox.getScope(option.pluginID);
				option.commandVersion = scope ? scope.VERSION : "0.0.0";
			}
			return option;
		}

		/**
		 * @param {string} pluginID
		 * @returns {{ commandName: string, commandVersion: string }[]} The provider's commands
		 */
		commandsOf(pluginID) {
			return Object.values(this._optionsCache)
				.filter(option => option.pluginID === pluginID)
				.map(({ name, commandVersion }) => ({ commandName: name, commandVersion }));
		}

		/**
		 * @param {string} pluginID
		 * @param {string} commandName
		 * @returns {object | null} The registration
		 */
		lookUp(pluginID, commandName) {
			return this._optionsCache[this._namespacedMainKey({ pluginID, commandName })] || null;
		}
	}

	/**
	 * The provider side of cross-plugin commands: named, versioned functions another plugin reaches through
	 * Zotero.PluginInteropController; dropped when the provider shuts down
	 * @memberof Zotero
	 *
	 * @example
	 * Zotero.PluginInteropManager.register({
	 *     commandName: "greet",
	 *     commandVersion: "1.2.0",
	 *     command({ callerPluginID, data }) { return "Hello, " + data.name; },
	 * });
	 */
	Zotero.PluginInteropManager = {
		_registry: new PluginInteropManagerInternal(),

		/**
		 * @param {PluginInteropRegistrationOptions} options
		 * @returns {string|false} The registration key, or false if validation failed
		 */
		register(options) {
			return this._registry.register(options);
		},

		/**
		 * @param {string} registrationKey - The key returned by register()
		 * @returns {boolean}
		 */
		unregister(registrationKey, _callerPluginID) {
			return this._registry.unregister(registrationKey, _callerPluginID);
		},
	};

	// A sandbox caller's own ID replaces whatever it passed
	lazy.ScopeVariables.setCustomParser(
		Zotero.PluginInteropManager.register,
		({ pluginID, args }) => {
			lazy.ScopeVariables.assignTrustedArg(args, 0, "pluginID", pluginID);
		}
	);
	lazy.ScopeVariables.setCustomParser(
		Zotero.PluginInteropManager.unregister,
		({ pluginID, args }) => {
			args[1] = pluginID;
		}
	);
}
