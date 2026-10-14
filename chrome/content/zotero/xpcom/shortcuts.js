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
		ShortcutUtils: "resource://gre/modules/ShortcutUtils.sys.mjs",
	});

	Zotero.Shortcuts = {
		// id -> registration
		_registrations: new Map(),

		// window -> listener function
		_windowListeners: new WeakMap(),

		// target -> Set<string> of canonical combos reserved
		_staticReserved: new Map(),

		MODIFIERS: ["accel", "control", "alt", "shift"],

		_FKEY_RE: /^F([1-9]|1[0-2])$/,

		_DIGIT_CODE_RE: /^(?:Digit|Numpad)([0-9])$/,

		/**
		 * @typedef BuiltinShortcut
		 * @type {object}
		 * @property {string} [prefKey] - `keys.` pref name supplying the key char and, without
		 * `commandID`, the command dispatched to the target's `_defaultHandlers` entry
		 * @property {string} [key] - Fixed key char instead of the `keys.<prefKey>` pref value
		 * (an entry whose pref is unset is skipped)
		 * @property {string[]} modifiers
		 * @property {string} [commandID] - ID of the <command> element to fire instead of
		 * dispatching to ZoteroPane.handleShortcutCommand
		 * @property {string} [keyElementID] - ID of the display-only menu-accelerator <key>
		 * element created and synced on window attach
		 * @property {string} [id] - Registration ID; defaults to `zotero-<prefKey>`
		 */

		/** @type {Object<string, BuiltinShortcut[]>} */
		_builtinShortcuts: {
			mainWindow: [
				// Single-letter `keys.` pref commands of the library tab
				{ prefKey: "library", modifiers: ["accel", "shift"] },
				{ prefKey: "quicksearch", modifiers: ["accel", "shift"] },
				{ prefKey: "newItem", modifiers: ["accel", "shift"] },
				{ prefKey: "newNote", modifiers: ["accel", "shift"] },
				{ prefKey: "newNote", id: "zotero-newNote-alt", modifiers: ["accel", "alt", "shift"] },
				{ prefKey: "sync", modifiers: ["accel", "shift"] },
				{ prefKey: "saveToZotero", modifiers: ["accel", "shift"] },
				{ prefKey: "toggleAllRead", modifiers: ["accel", "shift"] },
				{ prefKey: "toggleRead", modifiers: ["accel", "shift"] },
				// Pref-driven keys with menu items, bound to <command> elements
				{
					prefKey: "copySelectedItemCitationsToClipboard",
					commandID: "cmd_zotero_copyCitation",
					keyElementID: "key_copyCitation",
					modifiers: ["accel", "shift"],
				},
				{
					prefKey: "copySelectedItemsToClipboard",
					commandID: "cmd_zotero_copyBibliography",
					keyElementID: "key_copyBibliography",
					modifiers: ["accel", "shift"],
				},
				{
					prefKey: "showTabsMenu",
					commandID: "cmd_zotero_showTabsMenu",
					keyElementID: "key_showTabsMenu",
					modifiers: ["accel"],
				},
				// Fixed-combo mainKeyset keys migrated from XUL dispatch
				{
					id: "zotero-import",
					key: "I",
					commandID: "cmd_zotero_import",
					keyElementID: "key_import",
					modifiers: ["accel", "shift"],
				},
				{
					id: "zotero-importFromClipboard",
					key: "I",
					commandID: "cmd_zotero_importFromClipboard",
					keyElementID: "key_importFromClipboard",
					modifiers: ["accel", "alt", "shift"],
				},
				{
					id: "zotero-advancedSearch",
					key: "F",
					commandID: "cmd_zotero_advancedSearch",
					keyElementID: "key_advancedSearch",
					modifiers: ["accel", "shift"],
				},
			],
		},

		_defaultHandlers: {
			mainWindow(command) {
				return ({ win, event }) => {
					if (win.Zotero_Tabs.selectedType != "library") {
						return false;
					}
					return win.ZoteroPane.handleShortcutCommand(command, event);
				};
			},
			readerWindow() {
				return () => {
					throw new Error("Reader window default handlers are not implemented");
				};
			},
		},

		init() {
			for (let [target, entries] of Object.entries(this._builtinShortcuts)) {
				for (let entry of entries) {
					let { prefKey, commandID, keyElementID, modifiers } = entry;
					let key = entry.key || this.getKeyFromPref(prefKey);
					if (!key) {
						continue;
					}
					this.register({
						id: entry.id || `zotero-${prefKey}`,
						key,
						modifiers,
						keyElementID,
						targets: [target],
						handler: commandID
							? this._commandHandler(commandID)
							: this._defaultHandlers[target](prefKey),
					});
				}
			}
		},

		// Handler that fires a window's <command> element, declining while disabled
		_commandHandler(commandID) {
			return ({ win }) => {
				let cmd = win.document.getElementById(commandID);
				if (!cmd || cmd.hasAttribute("disabled")) {
					return false;
				}
				cmd.doCommand();
				return true;
			};
		},

		/**
		 * The configured key character of an `extensions.zotero.keys.` pref
		 * @param {string} prefKey
		 * @returns {string | false}
		 */
		getKeyFromPref(prefKey) {
			try {
				var key = Zotero.Prefs.get('keys.' + prefKey);
			}
			catch {}
			return key !== undefined ? key.toUpperCase() : false;
		},

		/**
		 * Canonicalize a combo into its registry string form.
		 * @param {string} key
		 * @param {string[]} modifiers
		 * @returns {string | null} - Null if a combo string can't be built
		 */
		normalizeCombo(key, modifiers) {
			if (typeof key != "string" || !key || !Array.isArray(modifiers)) {
				return null;
			}
			let mods = new Set(modifiers.filter(m => this.MODIFIERS.includes(m)));
			// Control is the accel key on Windows/Linux
			if (!Zotero.isMac && mods.has("control")) {
				mods.delete("control");
				mods.add("accel");
			}
			if (key.length == 1) {
				key = key.toUpperCase();
			}
			return this._serializeCombo(key, mods);
		},

		/**
		 * Whether a canonical combo is taken by Zotero itself, per the per-target static
		 * reserved list. Built-in registrations are not reserved -- they share like any other
		 * @param {string} combo
		 * @param {string[]} targets
		 * @returns {boolean}
		 */
		isReserved(combo, targets) {
			return targets.some(t => this._getStaticReserved(t).has(combo));
		},

		/**
		 * Whether a canonical combo has a registration for any of the given targets
		 * @param {string} combo
		 * @param {string[]} [targets] - Defaults to any target
		 * @returns {boolean}
		 */
		isRegistered(combo, targets) {
			for (let registration of this._registrations.values()) {
				if (registration.combo == combo
						&& (!targets || targets.some(t => registration.targets.has(t)))) {
					return true;
				}
			}
			return false;
		},

		/**
		 * Register a shortcut. All registrations sharing a (combo, target) fire on dispatch;
		 * grammar and reserved-combo validation are the caller's job
		 * @param {object} options
		 * @param {string} options.id - Unique registration ID
		 * @param {string} options.key
		 * @param {string[]} options.modifiers
		 * @param {function} options.handler - Called as `handler({ win, event })` on keydown;
		 * return false to decline -- the event propagates unless another handler consumes it
		 * @param {string[]} options.targets - Window target types the shortcut fires in,
		 * matching the types passed to `applyToWindow`
		 * @param {string} [options.keyElementID] - ID of a display-only <key> element whose
		 * key/modifiers attributes are synced to this combo in attached windows
		 * @returns {boolean}
		 */
		register({ id, key, modifiers, handler, targets, keyElementID }) {
			if (this._registrations.has(id)) {
				Zotero.warn(`Zotero.Shortcuts: ID '${id}' is already registered`);
				return false;
			}
			let combo = this.normalizeCombo(key, modifiers);
			if (!combo) {
				Zotero.warn(`Zotero.Shortcuts: Can't build a combo from key '${key}'`);
				return false;
			}
			if (!targets?.length) {
				Zotero.warn(`Zotero.Shortcuts: No targets given for ID '${id}'`);
				return false;
			}
			let registration = {
				id,
				combo,
				key,
				modifiers,
				keyElementID,
				handler,
				targets: new Set(targets),
			};
			this._registrations.set(id, registration);
			return true;
		},

		/**
		 * Platform-formatted accelerator text for a registration, e.g. "Ctrl+Shift+K",
		 * or "⇧⌘K" on mac
		 * @param {string} id
		 * @returns {string | false}
		 */
		getDisplayString(id) {
			let registration = this._registrations.get(id);
			if (!registration) {
				return false;
			}
			return lazy.ShortcutUtils.getModifierString(registration.modifiers.join(" "))
				+ lazy.ShortcutUtils.getKeyString(null, registration.key.toUpperCase());
		},

		/**
		 * Unregister a shortcut by registration ID
		 * @param {string} id
		 * @returns {boolean}
		 */
		unregister(id) {
			return this._registrations.delete(id);
		},

		/**
		 * Start dispatching registered shortcuts for keydown events in a window. Bubble
		 * phase, so existing handlers that stop propagation or prevent the default win
		 * @param {Window} win
		 * @param {string} target - The window's target type, e.g. "mainWindow"
		 */
		applyToWindow(win, target) {
			if (this._windowListeners.has(win)) {
				return;
			}
			let listener = event => this._handleKeyDown(event, win, target);
			win.document.addEventListener("keydown", listener);
			this._windowListeners.set(win, listener);
			this._applyKeyElements(win);
		},

		/**
		 * Stop dispatching shortcuts for a window
		 * @param {Window} win
		 */
		removeFromWindow(win) {
			let listener = this._windowListeners.get(win);
			if (!listener) {
				return;
			}
			win.document.removeEventListener("keydown", listener);
			this._windowListeners.delete(win);
		},

		_handleKeyDown(event, win, target) {
			if (Zotero.locked || event.defaultPrevented || event.repeat || event.isComposing) {
				return;
			}
			let combos = this._combosFromEvent(event);
			if (!combos.length) {
				return;
			}
			// On mac, Control+key combos are system text-editing bindings in text fields
			if (combos[0].startsWith("control+") && this._isEditableTarget(event)) {
				return;
			}
			// Every candidate combo's registrations fire
			let registrations = combos.flatMap(combo => this._registrationsFor(combo, target));
			let handled = false;
			// Every handler fires, so behavior can't depend on plugin load order
			for (let registration of registrations) {
				try {
					handled = registration.handler({ win, event }) !== false || handled;
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			if (!handled) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
		},

		// Registrations matching a (combo, target), in registration order. A snapshot,
		// so handlers may unregister shortcuts during dispatch
		_registrationsFor(combo, target) {
			let registrations = [];
			for (let registration of this._registrations.values()) {
				if (registration.combo == combo && registration.targets.has(target)) {
					registrations.push(registration);
				}
			}
			return registrations;
		},

		_combosFromEvent(event) {
			let accel = Zotero.isMac ? event.metaKey : event.ctrlKey;
			// The Windows/Super key isn't a combo modifier and disqualifies the event
			if (!Zotero.isMac && event.metaKey) {
				return [];
			}
			let ctrl = Zotero.isMac && event.ctrlKey;
			if (!accel && !ctrl && !event.altKey) {
				return [];
			}
			let keys = [];
			// Match digits by physical key, like tab and colored-tag shortcuts
			let digitMatch = event.code?.match(this._DIGIT_CODE_RE);
			if (digitMatch) {
				keys.push(digitMatch[1]);
			}
			else if (this._FKEY_RE.test(event.key)) {
				keys.push(event.key);
			}
			else {
				if (event.key.length == 1 && event.key != " ") {
					keys.push(event.key.toUpperCase());
				}
				// keyCode holds the layout's unshifted Latin letter -- immune to mac
				// Option / Windows AltGr composition, latinized on non-Latin layouts
				if (event.keyCode >= 65 && event.keyCode <= 90) {
					let letter = String.fromCharCode(event.keyCode);
					if (!keys.includes(letter)) {
						keys.push(letter);
					}
				}
			}
			let mods = new Set();
			if (accel) {
				mods.add("accel");
			}
			if (ctrl) {
				mods.add("control");
			}
			if (event.altKey) {
				mods.add("alt");
			}
			if (event.shiftKey) {
				mods.add("shift");
			}
			return keys.map(key => this._serializeCombo(key, mods));
		},

		_serializeCombo(key, mods) {
			return this.MODIFIERS.filter(m => mods.has(m)).concat(key).join("+");
		},

		// Create and sync a window's display-only menu-accelerator <key> elements
		// from registrations that declare a keyElementID
		_applyKeyElements(win) {
			let doc = win.document;
			for (let registration of this._registrations.values()) {
				if (!registration.keyElementID) {
					continue;
				}
				let elem = doc.getElementById(registration.keyElementID);
				if (!elem) {
					elem = doc.createXULElement("key");
					elem.id = registration.keyElementID;
					this._getKeyset(doc).appendChild(elem);
				}
				elem.setAttribute("modifiers", registration.modifiers.join(" "));
				elem.setAttribute("key", registration.key.length == 1
					? registration.key.toUpperCase()
					: registration.key);
				// Menus re-read the <key> element only when a menuitem's own `key`
				// attribute changes (native macOS menus don't observe <key> at all)
				for (let item of doc.querySelectorAll(`menuitem[key="${registration.keyElementID}"]`)) {
					item.removeAttribute("key");
					item.setAttribute("key", registration.keyElementID);
				}
			}
		},

		// The registry-owned keyset holding created display-only <key> elements
		_getKeyset(doc) {
			let keyset = doc.getElementById("zoteroShortcutKeyset");
			if (!keyset) {
				keyset = doc.createXULElement("keyset");
				keyset.id = "zoteroShortcutKeyset";
				doc.documentElement.appendChild(keyset);
			}
			return keyset;
		},

		_isEditableTarget(event) {
			// composedTarget (chrome-only) sees through shadow DOM, where event.target
			// is retargeted to the host (e.g. the quick search <search-textbox>)
			let el = event.composedTarget || event.target;
			return el.localName == "input" || el.localName == "textarea" || !!el.isContentEditable;
		},

		// Combos a <key> scan can't see, by window target. Keep in sync with
		// ZoteroPane.captureKeyDown, platformKeys.js, and the reader/note-editor keymaps
		_getStaticReserved(target) {
			let cached = this._staticReserved.get(target);
			if (cached) {
				return cached;
			}
			let combos = [
				// Window close, and quit; quit is disabled on Windows but reserved everywhere
				["accel+W", "accel+Q"],
				// Go back/forward (assigned to <key>s only when the Go menu opens)
				["accel+[", "accel+]"],
				// Edit keys, incl. the Windows accel+Y redo
				["accel+Z", "accel+shift+Z", "accel+Y", "accel+X", "accel+C", "accel+V"],
				["accel+A", "accel+F", "accel+G", "accel+shift+G", "accel+shift+X"],
				// Reader: print, zoom (incl. the accel+0 reset), page-number focus
				["accel+P", "accel+=", "accel++", "accel+-", "accel+0", "accel+alt+G"],
				// Note editor: formatting, code, horizontal rule
				["accel+B", "accel+I", "accel+U", "accel+K", "accel+`", "accel+_"],
			].flat();
			// Reader tools; also item-tree sorting on Win/Linux
			for (let i = 0; i <= 9; i++) {
				combos.push(`alt+${i}`);
			}
			if (Zotero.isMac) {
				// OS/app-menu shortcuts: hide, minimize, preferences, help
				combos.push("accel+H", "accel+alt+H", "accel+M", "accel+,", "accel+?", "accel+shift+?");
				// Note-editor literal-Ctrl bindings: headings/lists, code block,
				// blockquote, insert citation
				for (let i = 0; i <= 9; i++) {
					combos.push(`control+shift+${i}`);
				}
				combos.push("control+shift+\\", "control+shift+>", "accel+control+C");
			}
			else {
				// Note-editor literal-Ctrl bindings, where Ctrl is the accel key:
				// headings/lists, code block, blockquote, insert citation
				for (let i = 0; i <= 9; i++) {
					combos.push(`accel+shift+${i}`);
				}
				combos.push("accel+shift+\\", "accel+shift+>", "accel+alt+C");
			}
			if (target == "mainWindow") {
				// Undo-close and tab jumping (ZoteroPane.captureKeyDown)
				combos.push("accel+shift+T");
				for (let i = 1; i <= 9; i++) {
					combos.push(`accel+${i}`);
				}
				if (Zotero.isMac) {
					// Tab switching (ZoteroPane.captureKeyDown)
					combos.push("accel+shift+[", "accel+shift+]");
					// Item-tree sort keys (modifiers "accel alt control")
					for (let i = 0; i <= 9; i++) {
						combos.push(`accel+control+alt+${i}`);
					}
				}
			}
			else if (target == "readerWindow" && Zotero.isMac) {
				// The Window menu's focus-Library key in secondary windows (platformKeys.js)
				combos.push("accel+shift+L");
			}
			let set = new Set(combos.map(combo => this._canonicalizeComboString(combo)));
			this._staticReserved.set(target, set);
			return set;
		},

		// Canonicalize a hand-written combo string, so entry modifier order, casing, or
		// a literal control can't silently break matching; throws on an unknown modifier
		_canonicalizeComboString(str) {
			let parts = str.split("+");
			let key = parts.pop();
			// A trailing empty part means the key is the "+" character itself
			if (!key) {
				parts.pop();
				key = "+";
			}
			for (let modifier of parts) {
				if (!this.MODIFIERS.includes(modifier)) {
					throw new Error(`Unknown modifier '${modifier}' in combo '${str}'`);
				}
			}
			return this.normalizeCombo(key, parts);
		},
	};
}
