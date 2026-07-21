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
		PluginAPIBase: "chrome://zotero/content/xpcom/pluginAPI/pluginAPIBase.mjs",
		ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
		PluginSandbox: "chrome://zotero/content/xpcom/plugins/sandbox.mjs",
		VarCheck: "chrome://zotero/content/xpcom/plugins/utils.mjs",
		ScopeUtils: "chrome://zotero/content/xpcom/plugins/utils.mjs",
	});

	const CommandStatus = {
		OK: 0,
		NOT_FOUND: 1,
		VERSION_TOO_LOW: 2,
		VERSION_TOO_HIGH: 3,
		PERMISSION_DENIED: 4,
	};

	/**
	 * Build a rejection reason that lives in the caller's compartment
	 */
	function rejectionForCaller(err, callerScope) {
		let message;
		try {
			message = String((err && err.message) || err || "Command failed");
		}
		catch {
			message = "Command failed";
		}
		try {
			return new callerScope.Error(message);
		}
		catch {
			return Cu.cloneInto({ message }, callerScope);
		}
	}

	/**
	 * @typedef {object} PluginInteropRegistrationOptions
	 * @property {string} pluginID - The plugin ID of the command provider
	 * @property {string} commandName - A unique name for this command (unique per plugin)
	 * @property {string} commandVersion - Semantic version of the command (e.g., "1.0.0")
	 * @property {function} command - The command function.
	 *   Receives a single argument `{ callerPluginID, data }` where `data` is the
	 *   value passed by the caller. Must only accept and return transferable types:
	 *   primitives (string, number, boolean, null, undefined),
	 *   plain objects, and arrays of these types.
	 *
	 * @typedef {object} PluginInteropGetOptions
	 * @property {string} [callerPluginID] - The calling plugin's ID (required unless checkOnly is true)
	 * @property {string} targetPluginID - The command provider's plugin ID
	 * @property {string} commandName - The name of the command
	 * @property {string} [minVersion] - Minimum acceptable command version (inclusive)
	 * @property {string} [maxVersion] - Maximum acceptable command version (inclusive)
	 * @property {boolean} [checkOnly] - If true, only check availability without creating a wrapper
	 */


	class PluginInteropManagerInternal extends lazy.PluginAPIBase {
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
					commandVersion: "string",
					command: {
						type: "function",
						// Disable try-catch wrapper for error propagation to caller
						unsafeFunction: true,
					},
				},
			};
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
		 * Get a command registered by plugin.
		 *
		 * Returns a callable function that handles cross-compartment
		 * value transfer automatically.
		 *
		 * @param {PluginInteropGetOptions} options
		 * @returns {function|null} - The callable command, or null
		 */
		getCommand({ callerPluginID, targetPluginID, commandName, minVersion, maxVersion, checkOnly } = {}) {
			if (!targetPluginID || !commandName) {
				this._log("getCommand requires targetPluginID and commandName", "warn");
				return CommandStatus.NOT_FOUND;
			}

			let mainKey = this._namespacedMainKey({ pluginID: targetPluginID, commandName });
			let option = this._optionsCache[mainKey];
			if (!option) {
				return CommandStatus.NOT_FOUND;
			}

			// Version compatibility check
			let version = option.commandVersion;
			if (minVersion && Zotero.Utilities.semverCompare(version, minVersion) < 0) {
				this._log(
					`Command '${commandName}' version ${version} is below minimum required ${minVersion}`,
					"warn"
				);
				return CommandStatus.VERSION_TOO_LOW;
			}
			if (maxVersion && Zotero.Utilities.semverCompare(version, maxVersion) > 0) {
				this._log(
					`Command '${commandName}' version ${version} exceeds maximum accepted ${maxVersion}`,
					"warn"
				);
				return CommandStatus.VERSION_TOO_HIGH;
			}

			if (callerPluginID) {
				let callerScope = lazy.PluginSandbox.getScope(callerPluginID);
				if (!lazy.VarCheck.checkScopePermission(callerScope, "INTEROP_PERMISSIONS", targetPluginID)) {
					this._log(
						`Plugin '${callerPluginID}' is not allowed to access commands from '${targetPluginID}'. Declare in interop_permissions to access.`,
						"warn"
					);
					return CommandStatus.PERMISSION_DENIED;
				}
			}

			if (checkOnly) {
				return CommandStatus.OK;
			}

			return this._createCallerCommand(option, callerPluginID);
		}

		/**
		 * Create a wrapped command function for a consumer plugin.
		 * The returned function accepts a single `data` argument, which is passed
		 * to the registered command along with `{ callerPluginID }`.
		 *
		 * @param {object} option - The stored registration option
		 * @param {string} callerPluginID - The consumer plugin ID
		 * @returns {function}
		 */
		_createCallerCommand(option, callerPluginID) {
			let mainKey = this._getOptionMainKey(option);
			let callerScope = lazy.PluginSandbox.getScope(callerPluginID);
			let providerScope = lazy.PluginSandbox.getScope(option.pluginID);
			let commandName = option.commandName;
			// If caller scopes is missing, we assume it is privileged and cross-compartment handling is not needed
			let isSameCompartment = lazy.VarCheck.isSameCompartment(callerScope, providerScope);

			let wrapper = (data) => {
				// Check if the command is still registered before calling, in case it was unregistered since getCommand() was called
				if (!this._optionsCache[mainKey]) {
					throw new Error(`Command '${commandName}' from plugin '${option.pluginID}' is no longer available`);
				}
				let arg = { callerPluginID, data };
				if (!isSameCompartment) {
					arg = Cu.cloneInto(arg, providerScope);
				}
				let result = option.command(arg);
				// Also handles caller scope missing (privileged caller)
				if (isSameCompartment) {
					return result;
				}
				if (lazy.VarCheck.isPromise(result)) {
					return new callerScope.Promise((resolve, reject) => {
						result.then(
							(v) => {
								try {
									resolve(Cu.cloneInto(v, callerScope));
								}
								catch (cloneErr) {
									reject(rejectionForCaller(cloneErr, callerScope));
								}
							},
							e => reject(rejectionForCaller(e, callerScope))
						);
					});
				}
				return Cu.cloneInto(result, callerScope);
			};
			return wrapper;
		}
	}


	/**
	 * Registry for cross-plugin commands.
	 *
	 * Allows plugins to register named commands that other plugins can discover
	 * and call. Command functions must accept and return only basic transferable
	 * types (primitives, plain objects, and arrays of these types).
	 *
	 * Registered commands are automatically cleaned up when the provider plugin shuts down.
	 *
	 * @memberof Zotero
	 *
	 * @example
	 * // Provider plugin registers a command
	 * Zotero.PluginInteropManager.register({
	 *     pluginID: "provider-plugin@example.com",
	 *     commandName: "greet",
	 *     commandVersion: "1.2.0",
	 *     command({ callerPluginID, data }) { return "Hello, " + data.name; },
	 * });
	 *
	 * // Consumer plugin calls the command
	 * let greet = Zotero.PluginInteropManager.getCommand({
	 *     callerPluginID: "consumer-plugin@example.com",
	 *     targetPluginID: "provider-plugin@example.com",
	 *     commandName: "greet",
	 *     minVersion: "1.0.0",
	 * });
	 * if (typeof greet === "function") {
	 *     let greeting = greet({ name: "World" }); // "Hello, World"
	 * }
	 * else if (greet === Zotero.PluginInteropManager.NOT_FOUND) {
	 *     // Command not registered
	 * }
	 */
	Zotero.PluginInteropManager = {
		...CommandStatus,

		_registry: new PluginInteropManagerInternal(),

		/**
		 * Register a command for other plugins to use.
		 *
		 * @param {PluginInteropRegistrationOptions} options
		 * @returns {string|false} - The registration key, or false if validation failed
		 */
		register(options) {
			return this._registry.register(options);
		},

		/**
		 * Unregister a previously registered command.
		 *
		 * @param {string} registrationKey - The key returned by register()
		 * @returns {boolean}
		 */
		unregister(registrationKey) {
			return this._registry.unregister(registrationKey);
		},

		/**
		 * Get a registered command from another plugin.
		 * Pass `checkOnly: true` to verify availability without creating a wrapper
		 *
		 * @param {PluginInteropGetOptions} options
		 * @returns {function|CommandStatus} - The callable command, or a status code in `checkOnly`.
		 */
		getCommand(options) {
			return this._registry.getCommand(options);
		},
	};

	// Inject the real caller plugin ID into getCommand options,
	// preventing unprivileged plugins from spoofing their identity.
	lazy.ScopeVariables.setCustomParser(
		Zotero.PluginInteropManager.getCommand,
		({ pluginID, args }) => {
			if (args[0] && typeof args[0] === "object") {
				args[0].callerPluginID = pluginID;
			}
		}
	);
}
