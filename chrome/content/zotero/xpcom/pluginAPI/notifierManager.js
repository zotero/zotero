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
	});

	class NotifierManagerInternal extends lazy.ManagerAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "NotifierManager",
				mainKeyName: "observerID",
				notifyType: false,
				optionTypeDefinition: {
					observerID: "string",
					pluginID: "string",
					types: { type: "array", children: "string", optional: true },
					priority: { type: "number", optional: true },
					onNotify: { type: "function", unsafeFunction: true },
				},
			};
		}

		_convert(option) {
			option.onNotify = lazy.ScopeVariables.fromScope(option.onNotify, option.pluginID);
			return option;
		}

		_add(option) {
			let mainKey = super._add(option);
			if (!mainKey) {
				return false;
			}
			let addedOption = this._optionsCache[mainKey];
			try {
				addedOption.notifierID = Zotero.Notifier.registerObserver(
					{
						notify: (event, type, ids, extraData) => addedOption.onNotify({ event, type, ids, extraData }),
					},
					addedOption.types, mainKey, addedOption.priority,
				);
			}
			catch (e) {
				delete this._optionsCache[mainKey];
				throw e;
			}
			return mainKey;
		}

		_remove(mainKey) {
			let option = this._optionsCache[mainKey];
			if (!super._remove(mainKey)) {
				return false;
			}
			Zotero.Notifier.unregisterObserver(option.notifierID);
			return true;
		}
	}

	/**
	 * Plugin notifier observers, owned by their registering plugin and removed on shutdown.
	 * @memberof Zotero
	 */
	Zotero.NotifierManager = {
		_manager: new NotifierManagerInternal(),

		/**
		 * @param {object} options
		 * @param {string} options.observerID - Unique per plugin
		 * @param {string} options.pluginID - Injected for sandbox callers
		 * @param {string[]} [options.types] - Event types to observe; omitted means all
		 * @param {number} [options.priority] - Lower numbers run first
		 * @param {function({ event: string, type: string, ids: Array, extraData: object }): *} options.onNotify
		 *     Receives the notification context
		 * @returns {string|false} The key used to unregister, or false if invalid
		 */
		registerObserver(options) {
			return this._manager.register(options);
		},

		/**
		 * @param {string} observerID - The key returned by registerObserver()
		 * @returns {boolean}
		 */
		unregisterObserver(observerID, _callerPluginID) {
			return this._manager.unregister(observerID, _callerPluginID);
		},
	};

	lazy.ScopeVariables.setCustomParser(
		Zotero.NotifierManager.registerObserver,
		({ pluginID, args }) => {
			lazy.ScopeVariables.injectTrustedOptions(args, 0, { pluginID });
		}
	);
	lazy.ScopeVariables.setCustomParser(
		Zotero.NotifierManager.unregisterObserver,
		({ pluginID, args }) => {
			args[1] = pluginID;
		}
	);
}
