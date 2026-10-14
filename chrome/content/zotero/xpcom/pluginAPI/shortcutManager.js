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
	});

	const VALID_TARGETS = [
		"mainWindow",
		"readerWindow",
	];

	const NON_SHIFT_MODIFIERS = ["accel", "control", "alt"];

	const FKEY_RE = /^F([1-9]|1[0-2])$/;

	const ShortcutRejectReasons = {
		NONE: 0,
		INVALID: 1,
		RESERVED: 2,
		REGISTERED: 3,
	};


	/**
	 * @namespace Zotero
	 */

	/**
	 * @typedef ShortcutOptions
	 * @type {object}
	 * @property {string} shortcutID - The unique ID of the shortcut
	 * @property {string} pluginID - The ID of the plugin registering the shortcut
	 * @property {string} key - A single printable character or F1-F12
	 * @property {string[]} modifiers - Subset of `Zotero.Shortcuts.MODIFIERS`; must
	 * include a non-shift modifier (see `NON_SHIFT_MODIFIERS`). "accel" is the platform's
	 * primary modifier (Command on mac, Control on Windows/Linux)
	 * @property {string} target - The window type the shortcut fires in, see
	 * `VALID_TARGETS`.
	 * @property {(context: ShortcutContext) => void | false} onCommand - Function to run when
	 * the shortcut is pressed in a target window. Return false to decline -- the keystroke
	 * is consumed unless every handler sharing the combo declines
	 */

	/**
	 * @typedef ShortcutContext
	 * @type {object}
	 * @property {string} tabType - The tab content type, e.g. "library" or "reader"
	 * @property {string} [tabSubType] - The tab subtype, e.g. the reader type ("pdf")
	 * @property {string} [tabID] - The tab ID. Undefined for a reader in a separate window
	 * @property {number[]} itemIDs - The IDs of the items the shortcut acts on: the
	 * selected items for a library tab, or the tab's own item otherwise. Load them
	 * with `Zotero.Items.get()`
	 * @property {number[]} [collectionIDs] - mainWindow's library tab only: the IDs of the
	 * collections selected in the collections tree
	 */


	class ShortcutManagerInternal extends lazy.PluginAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "ShortcutAPI",
				mainKeyName: "shortcutID",
				notifyType: false,
				optionTypeDefinition: {
					shortcutID: "string",
					pluginID: "string",
					key: "string",
					modifiers: {
						type: "array",
						children: "string",
					},
					target: {
						type: "string",
						optional: false,
						checkHook: (value) => {
							if (!VALID_TARGETS.includes(value)) {
								return `Option 'target' must be one of ${VALID_TARGETS.join(", ")}, got ${value}`;
							}
							return true;
						}
					},
					onCommand: "function",
				},
			};
		}

		/**
		 * Validate a combo against the plugin shortcut grammar (see `ShortcutOptions`)
		 * @param {string} key
		 * @param {string[]} modifiers
		 * @returns {{combo?: string, error?: string}} - The canonical combo if valid
		 */
		validateCombo(key, modifiers) {
			if (!Array.isArray(modifiers)) {
				return { error: "'modifiers' must be an array" };
			}
			let unknown = Array.from(modifiers).find(m => !Zotero.Shortcuts.MODIFIERS.includes(m));
			if (unknown) {
				return { error: `Unknown modifier '${unknown}' -- must be one of ${Zotero.Shortcuts.MODIFIERS.join(", ")}` };
			}
			if (!modifiers.some(m => NON_SHIFT_MODIFIERS.includes(m))) {
				return { error: `Modifiers must include one of ${NON_SHIFT_MODIFIERS.join(", ")}` };
			}
			if (typeof key != "string" || (!FKEY_RE.test(key) && (key.length != 1 || key == " "))) {
				return { error: `'key' must be a single printable character or F1-F12, got '${key}'` };
			}
			return { combo: Zotero.Shortcuts.normalizeCombo(key, modifiers) };
		}

		/**
		 * The conflict a combo would register into, as a `ShortcutRejectReasons` value
		 * @param {string} key
		 * @param {string[]} modifiers
		 * @param {string} target
		 * @returns {number}
		 */
		checkShortcut(key, modifiers, target) {
			if (!VALID_TARGETS.includes(target)) {
				return ShortcutRejectReasons.INVALID;
			}
			let { combo, error } = this.validateCombo(key, modifiers);
			if (error) {
				return ShortcutRejectReasons.INVALID;
			}
			if (Zotero.Shortcuts.isReserved(combo, [target])) {
				return ShortcutRejectReasons.RESERVED;
			}
			if (Zotero.Shortcuts.isRegistered(combo, [target])) {
				return ShortcutRejectReasons.REGISTERED;
			}
			return ShortcutRejectReasons.NONE;
		}

		_validate(option) {
			option = super._validate(option);

			if (!option) {
				return false;
			}

			let { combo, error } = this.validateCombo(option.key, option.modifiers);
			if (error) {
				this._log(`Invalid shortcut: ${error}`, "warn");
				return false;
			}
			if (Zotero.Shortcuts.isReserved(combo, [option.target])) {
				this._log(`Invalid shortcut: combo '${combo}' is reserved by Zotero`, "warn");
				return false;
			}
			if (Zotero.Shortcuts.isRegistered(combo, [option.target])) {
				this._log(`Combo '${combo}' for target '${option.target}' is already registered by another shortcut`, "warn");
			}
			return option;
		}

		_convert(option) {
			option = super._convert(option);
			option.onCommand = lazy.ScopeVariables.fromScope(option.onCommand, option.pluginID);
			return option;
		}

		_add(option) {
			let mainKey = super._add(option);
			if (!mainKey) {
				return false;
			}
			let addedOption = this._optionsCache[mainKey];
			let success = Zotero.Shortcuts.register({
				id: mainKey,
				key: addedOption.key,
				modifiers: addedOption.modifiers,
				targets: [addedOption.target],
				handler: ({ win }) => this._handleShortcut(addedOption, win),
			});
			if (!success) {
				this._log(`Failed to register the combo for shortcut '${mainKey}'`, "warn");
				delete this._optionsCache[mainKey];
				return false;
			}
			return mainKey;
		}

		_remove(mainKey) {
			if (this._optionsCache[mainKey]) {
				Zotero.Shortcuts.unregister(mainKey);
			}
			return super._remove(mainKey);
		}

		_handleShortcut(option, win) {
			return option.onCommand(this._getContext(win));
		}

		_getContext(win) {
			// Standalone reader window: no tab bar, the reader is on the window
			if (!win.Zotero_Tabs) {
				let reader = win.reader;
				return {
					tabType: "reader",
					tabSubType: reader?.type,
					itemIDs: reader?.itemID ? [reader.itemID] : [],
				};
			}
			let { id, type, subType, data } = win.Zotero_Tabs.getTabInfo();
			let context = {
				tabType: type,
				tabSubType: subType,
				tabID: id,
			};
			if (type == "library") {
				context.itemIDs = win.ZoteroPane.getSelectedItems(true);
				context.collectionIDs = win.ZoteroPane.getSelectedCollections(true);
			}
			else {
				context.itemIDs = data?.itemID ? [data.itemID] : [];
			}
			return context;
		}
	}


	/**
	 * Manages custom keyboard shortcut APIs.
	 *
	 * @memberof Zotero
	 */
	Zotero.ShortcutManager = {
		rejectReasons: ShortcutRejectReasons,

		_shortcutManager: new ShortcutManagerInternal(),

		/**
		 * Register a keyboard shortcut in its target windows
		 * @param {ShortcutOptions} options
		 * @returns {string | false} - False if the combo is invalid or reserved by Zotero.
		 * Sharing an already-registered combo is allowed with a warning -- every handler
		 * on the combo fires
		 */
		registerShortcut(options) {
			return this._shortcutManager.register(options);
		},

		/**
		 * Unregister a keyboard shortcut
		 * @param {string} shortcutID
		 * @param {string} [_callerPluginID]
		 * @returns {boolean}
		 */
		unregisterShortcut(shortcutID, _callerPluginID) {
			return this._shortcutManager.unregister(shortcutID, _callerPluginID);
		},

		/**
		 * Check if a keyboard shortcut can be registered.
		 * @param {object} options
		 * @param {string} options.key
		 * @param {string[]} options.modifiers
		 * @param {string} options.target
		 * @returns {number} - See `ShortcutRejectReasons`
		 */
		checkShortcut({ key, modifiers, target }) {
			return this._shortcutManager.checkShortcut(key, modifiers, target);
		},
	};

	lazy.ScopeVariables.setCustomParser(
		Zotero.ShortcutManager.registerShortcut,
		({ pluginID, args }) => {
			lazy.ScopeVariables.assignTrustedArg(args, 0, "pluginID", pluginID);
		}
	);
	lazy.ScopeVariables.setCustomParser(
		Zotero.ShortcutManager.unregisterShortcut,
		({ pluginID, args }) => {
			args[1] = pluginID;
		}
	);
}
