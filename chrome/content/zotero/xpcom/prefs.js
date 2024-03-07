/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2018 Center for History and New Media
					George Mason University, Fairfax, Virginia, USA
					http://zotero.org
	
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
Zotero.Prefs = new function() {
	// Privileged methods
	this.get = get;
	this.set = set;
	
	this.register = register;
	this.unregister = unregister;
	this.observe = observe;
	
	this.rootBranch = Services.prefs.getBranch("");
	
	this.init = async function init() {
		// Register observer to handle pref changes
		this.register();

		// Unregister observer handling pref changes
		if (Zotero.addShutdownListener) {
			Zotero.addShutdownListener(this.unregister.bind(this));
		}

		// Process pref version updates
		var fromVersion = this.get('prefVersion');
		var toVersion = 12;
		if (!fromVersion) {
			this.set('prefVersion', toVersion);
		}
		else if (fromVersion < toVersion) {
			for (var i = fromVersion + 1; i <= toVersion; i++) {
				switch (i) {
					case 1:
						// If a sync username is entered and ZFS is enabled, turn
						// on-demand downloading off to maintain current behavior
						if (this.get('sync.server.username')) {
							if (this.get('sync.storage.enabled')
									&& this.get('sync.storage.protocol') == 'zotero') {
								this.set('sync.storage.downloadMode.personal', 'on-sync');
							}
							if (this.get('sync.storage.groups.enabled')) {
								this.set('sync.storage.downloadMode.groups', 'on-sync');
							}
						}
						break;
					
					case 2:
						// Re-show saveButton guidance panel (and clear old saveIcon pref).
						// The saveButton guidance panel initially could auto-hide too easily.
						this.clear('firstRunGuidanceShown.saveIcon');
						this.clear('firstRunGuidanceShown.saveButton');
						break;
					
					case 3:
						this.clear('note.fontSize');
						break;
					
					case 4:
						this.clear('fileHandler.pdf');
						break;
					
					case 5:
						this.clear('extensions.spellcheck.inline.max-misspellings', true);
						break;
					
					// If the note Quick Copy setting was set to Markdown + Rich Text but in a
					// non-default way (e.g., because of whitespace differences), clear the pref
					// to pick up the new app-link options
					case 6:
						var o = this.get('export.noteQuickCopy.setting');
						try {
							o = JSON.parse(o);
							if (o.mode == 'export'
									&& o.id == Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT) {
								this.clear('export.noteQuickCopy.setting');
							}
						}
						catch (e) {
							Zotero.logError(e);
							this.clear('export.noteQuickCopy.setting');
						}
						break;
					
					// Re-enable hardware acceleration in Zotero 7 for all the people who turned it
					// off to fix PDF rendering problems
					case 7:
						this.clear('layers.acceleration.disabled', true);
						break;
					
					// Convert "attachment rename format string" from old format (e.g. {%c - }{%y - }{%t{50}})
					// to a new format that uses the template engine
					case 9:
						if (this.prefHasUserValue('attachmentRenameFormatString')) {
							let oldVal = this.get('attachmentRenameFormatString');
							let newVal;
							if (oldVal) {
								if (oldVal.includes('{%')) {
									newVal = this.convertLegacyAttachmentRenameFormatString(oldVal);
								}
								// User already modified new template from the Z7 beta before we
								// renamed this pref, so just transfer over
								else {
									newVal = oldVal;
								}
							}
							if (newVal) {
								this.set('attachmentRenameTemplate', newVal);
							}
							this.clear('attachmentRenameFormatString');
						}
						break;
					
					case 10:
						// Used internally
						break;
					
					case 11:
						await Zotero.LocateManager.migrateEngines();
						break;
					
					case 12:
						Zotero.Prefs.set('firstRunGuidanceShown.z7Banner', false);
						break;
				}
			}
			this.set('prefVersion', toVersion);
		}
	}
	
	
	/**
	* Retrieve a preference
	**/
	function get(pref, global) {
		try {
			pref = global ? pref : ZOTERO_CONFIG.PREF_BRANCH + pref;
			let branch = this.rootBranch;
			
			let value;
			switch (branch.getPrefType(pref)){
				case branch.PREF_BOOL:
					value = branch.getBoolPref(pref);
					break;
				
				case branch.PREF_STRING:
					// Pre-Fx59
					if (!branch.getStringPref) {
						value = '' + branch.getComplexValue(pref, Components.interfaces.nsISupportsString);
					}
					else {
						value = branch.getStringPref(pref);
					}
					break;
				
				case branch.PREF_INT:
					value = branch.getIntPref(pref);
					break;
			}
			
			return value;
		}
		catch (e) {
			// If debug system isn't yet initialized, log proper error
			if (Zotero.Debug.enabled === undefined) {
				dump(e + "\n\n");
			}
			Zotero.logError(e);
			throw new Error(`Error getting preference '${pref}'`);
		}
	}
	
	
	/**
	* Set a preference
	**/
	function set(pref, value, global) {
		try {
			pref = global ? pref : ZOTERO_CONFIG.PREF_BRANCH + pref;
			let branch = this.rootBranch;
			
			switch (branch.getPrefType(pref)) {
				case branch.PREF_BOOL:
					return branch.setBoolPref(pref, value);
				case branch.PREF_STRING:
					return branch.setStringPref(pref, value);
				case branch.PREF_INT:
					return branch.setIntPref(pref, value);
				
				// If not an existing pref, create appropriate type automatically
				case 0:
					if (typeof value == 'boolean') {
						Zotero.debug("Creating boolean pref '" + pref + "'");
						return branch.setBoolPref(pref, value);
					}
					if (typeof value == 'string') {
						Zotero.debug("Creating string pref '" + pref + "'");
						return branch.setStringPref(pref, value);
					}
					if (parseInt(value) == value) {
						Zotero.debug("Creating integer pref '" + pref + "'");
						return branch.setIntPref(pref, value);
					}
					throw new Error("Invalid preference value '" + value + "' for pref '" + pref + "'");
			}
		}
		catch (e) {
			// If debug system isn't yet initialized, log proper error
			if (Zotero.Debug.enabled === undefined) {
				dump(e + "\n\n");
			}
			Zotero.logError(e);
			throw new Error(`Error setting preference '${pref}'`);
		}
	}
	
	
	this.clear = function (pref, global) {
		pref = global ? pref : ZOTERO_CONFIG.PREF_BRANCH + pref;
		this.rootBranch.clearUserPref(pref);
	}
	
	
	this.prefHasUserValue = function (pref, global) {
		pref = global ? pref : ZOTERO_CONFIG.PREF_BRANCH + pref;
		return this.rootBranch.prefHasUserValue(pref);
	};
	
	
	/**
	 * @param {String[]} [exclude]
	 * @param {String} [branch] - Name of pref branch, ending with a period
	 */
	this.resetBranch = function (exclude = [], branch) {
		var branch = Services.prefs.getBranch(branch || ZOTERO_CONFIG.PREF_BRANCH);
		var keys = branch.getChildList("", {});
		for (let key of keys) {
			if (branch.prefHasUserValue(key)) {
				if (exclude.includes(key)) {
					continue;
				}
				Zotero.debug("Clearing " + key);
				branch.clearUserPref(key);
			}
		}
	};
	
	// Handlers for some Zotero preferences
	var _handlers = [
		[ "automaticScraperUpdates", function(val) {
			if (val){
				Zotero.Schema.updateFromRepository(1);
			}
			else {
				Zotero.Schema.stopRepositoryTimer();
			}
		}],
		["fontSize", function () {
			Zotero.UIProperties.setAll();
		}],
		["uiDensity", function () {
			Zotero.UIProperties.setAll();
		}],
		["recursiveCollections", function() {
			Zotero.getActiveZoteroPane().itemsView.refreshAndMaintainSelection();
		}],
		[ "layout", function(val) {
			Zotero.getActiveZoteroPane().updateLayout();
		}],
		[ "note.fontSize", function(val) {
			if (val < 6) {
				Zotero.Prefs.set('note.fontSize', 11);
			}
		}],
		[ "sync.autoSync", function(val) {
			if (val) {
				Zotero.Sync.EventListeners.AutoSyncListener.register();
				Zotero.Sync.EventListeners.IdleListener.register();
			}
			else {
				Zotero.Sync.EventListeners.AutoSyncListener.unregister();
				Zotero.Sync.EventListeners.IdleListener.unregister();
				Zotero.Prefs.set('sync.reminder.autoSync.enabled', true);
				// We don't want to immediately display reminder so bump this value
				Zotero.Prefs.set('sync.reminder.autoSync.lastDisplayed', Math.round(Date.now() / 1000));
			}
			try {
				Zotero.getActiveZoteroPane().initSyncReminders(false);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}],
		[ "search.quicksearch-mode", function(val) {
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						.getService(Components.interfaces.nsIWindowMediator);
			var enumerator = wm.getEnumerator("navigator:browser");
			while (enumerator.hasMoreElements()) {
				var win = enumerator.getNext();
				if (!win.ZoteroPane) continue;
				Zotero.updateQuickSearchBox(win.ZoteroPane.document);
			}
			
			var enumerator = wm.getEnumerator("zotero:item-selector");
			while (enumerator.hasMoreElements()) {
				var win = enumerator.getNext();
				if (!win.Zotero) continue;
				Zotero.updateQuickSearchBox(win.document);
			}
		}],
		[ "cite.useCiteprocRs", function(val) {
			val && Zotero.CiteprocRs.init();
		}]
	];
	
	//
	// Methods to register a preferences observer
	//
	function register(){
		this.rootBranch.addObserver("", this, false);
		
		// Register pre-set handlers
		for (var i=0; i<_handlers.length; i++) {
			this.registerObserver(_handlers[i][0], _handlers[i][1]);
		}
	}
	
	function unregister(){
		if (!this.rootBranch){
			return;
		}
		this.rootBranch.removeObserver("", this);
	}
	
	/**
	 * @param {nsIPrefBranch} subject The nsIPrefBranch we're observing (after appropriate QI)
	 * @param {String} topic The string defined by NS_PREFBRANCH_PREFCHANGE_TOPIC_ID
	 * @param {String} data The name of the pref that's been changed (relative to subject)
	 */
	function observe(subject, topic, data){
		if (topic != "nsPref:changed" || !_observers[data] || !_observers[data].length) {
			return;
		}
		
		var obs = _observers[data];
		for (var i=0; i<obs.length; i++) {
			try {
				obs[i](this.get(data, true));
			}
			catch (e) {
				Zotero.debug("Error while executing preference observer handler for " + data);
				Zotero.debug(e);
			}
		}
	}
	
	var _observers = {};
	var _observersBySymbol = {};
	
	/**
	 * @param {String} name - Preference name; if not global, this is on the extensions.zotero branch
	 * @param {Function} handler
	 * @param {Boolean} [global]
	 * @return {Symbol} - Symbol to pass to unregisterObserver()
	 */
	this.registerObserver = function (name, handler, global) {
		name = global ? name : ZOTERO_CONFIG.PREF_BRANCH + name;
		
		var symbol = Symbol();
		_observers[name] = _observers[name] || [];
		_observers[name].push(handler);
		_observersBySymbol[symbol] = [name, handler];
		return symbol;
	}
	
	/**
	 * @param {Symbol} symbol - Symbol returned from registerObserver()
	 */
	this.unregisterObserver = function (symbol) {
		var obs = _observersBySymbol[symbol];
		if (!obs) {
			Zotero.debug("No pref observer registered for given symbol");
			return;
		}
		
		delete _observersBySymbol[symbol];
		
		var [name, handler] = obs;
		var handlers = _observers[name];
		var i = handlers.indexOf(handler);
		if (i == -1) {
			Zotero.debug("Handler was not registered for preference " + name, 2);
			return;
		}
		handlers.splice(i, 1);
	}
	
	
	this.getVirtualCollectionState = function (type) {
		const prefKeys = {
			duplicates: 'duplicateLibraries',
			unfiled: 'unfiledLibraries',
			retracted: 'retractedLibraries'
		};
		let prefKey = prefKeys[type];
		if (!prefKey) {
			throw new Error("Invalid virtual collection type '" + type + "'");
		}
		
		var libraries;
		try {
			libraries = JSON.parse(Zotero.Prefs.get(prefKey) || '{}');
			if (typeof libraries != 'object') {
				throw true;
			}
		}
		// Ignore old/incorrect formats
		catch (e) {
			Zotero.Prefs.clear(prefKey);
			libraries = {};
		}
		
		return libraries;
	};
	
	
	this.getVirtualCollectionStateForLibrary = function (libraryID, type) {
		return this.getVirtualCollectionState(type)[libraryID] !== false;
	};
	
	
	this.setVirtualCollectionStateForLibrary = function (libraryID, type, show) {
		const prefKeys = {
			duplicates: 'duplicateLibraries',
			unfiled: 'unfiledLibraries',
			retracted: 'retractedLibraries'
		};
		let prefKey = prefKeys[type];
		if (!prefKey) {
			throw new Error("Invalid virtual collection type '" + type + "'");
		}
		
		var libraries = this.getVirtualCollectionState(type);
		
		// Update current library
		libraries[libraryID] = !!show;
		// Remove libraries that don't exist or that are set to true
		for (let id of Object.keys(libraries).filter(id => libraries[id] || !Zotero.Libraries.exists(id))) {
			delete libraries[id];
		}
		Zotero.Prefs.set(prefKey, JSON.stringify(libraries));
	};

	/**
	 * Converts a value of a `attachmentRenameFormatString` pref from a legacy format string
	 * with % markers to a new format that uses the template engine
	 *
	 * @param {string} formatString - The legacy format string to convert.
	 * @returns {string} The new format string.
	 */
	this.convertLegacyAttachmentRenameFormatString = function (formatString) {
		const markers = {
			c: 'firstCreator',
			y: 'year',
			t: 'title'
		};

		// Regexp contains 4 capture groups all wrapped in {}:
		// 		* Prefix before the wildcard, can be empty string
		// 		* Any recognized marker. % sign marks a wildcard and is required for a match but is
		// 		  not part of the capture group. Recognized markers are specified in a `markers`
		// 		  lookup.
		// 		* Optionally a maximum number of characters to truncate the value to
		// 		* Suffix after the wildcard, can be empty string
		const re = new RegExp(`{([^%{}]*)%(${Object.keys(markers).join('|')})({[0-9]+})?([^%{}]*)}`, 'ig');

		return formatString.replace(re, (match, prefix, marker, truncate, suffix) => {
			const field = markers[marker];
			truncate = truncate ? truncate.replace(/[^0-9]+/g, '') : false;
			prefix = prefix ? `prefix="${prefix}"` : null;
			suffix = suffix ? `suffix="${suffix}"` : null;
			truncate = truncate ? `truncate="${truncate}"` : null;

			return `{{ ${[field, truncate, prefix, suffix].filter(f => f !== null).join(' ')} }}`;
		});
	};
};
