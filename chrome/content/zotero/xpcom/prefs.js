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
Zotero.Prefs = new function(){
	// Privileged methods
	this.get = get;
	this.set = set;
	
	this.register = register;
	this.unregister = unregister;
	this.observe = observe;
	
	this.rootBranch = Services.prefs.getBranch("");
	
	this.init = async function init() {
		await loadExtensionDefaults();
		
		// Register observer to handle pref changes
		this.register();

		// Unregister observer handling pref changes
		if (Zotero.addShutdownListener) {
			Zotero.addShutdownListener(this.unregister.bind(this));
		}

		// Process pref version updates
		var fromVersion = this.get('prefVersion');
		if (!fromVersion) {
			fromVersion = 0;
		}
		var toVersion = 2;
		if (fromVersion < toVersion) {
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
				}
			}
			this.set('prefVersion', toVersion);
		}
	}
	
	
	/**
	* Retrieve a preference
	**/
	function get(pref, global){
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
					// Pre-Fx59
					if (!branch.setStringPref) {
						let str = Cc["@mozilla.org/supports-string;1"]
							.createInstance(Ci.nsISupportsString);
						str.data = value;
						return branch.setComplexValue(pref, Ci.nsISupportsString, str);
					}
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
						// Pre-Fx59
						if (!branch.setStringPref) {
							let str = Cc["@mozilla.org/supports-string;1"]
								.createInstance(Ci.nsISupportsString);
							str.data = value;
							return branch.setComplexValue(pref, Ci.nsISupportsString, str);
						}
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
		["fontSize", function (val) {
			Zotero.setFontSize(
				Zotero.getActiveZoteroPane().document.getElementById('zotero-pane')
			);
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
		var i = obs.indexOf(handler);
		if (i == -1) {
			Zotero.debug("Handler was not registered for preference " + name, 2);
			return;
		}
		obs.splice(i, 1);
	}
	
	
	/**
	 * Firefox 60 no longer loads default preferences for extensions, so do it manually
	 */
	async function loadExtensionDefaults() {
		var defaultBranch = Services.prefs.getDefaultBranch("");
		
		return new Zotero.Promise(function (resolve) {
			Cu.import("resource://gre/modules/AddonManager.jsm");
			
			// Lines are in format `pref("[key]", [val]);`, so define a function to be called that
			// sets the defaults
			function pref(key, value) {
				switch (typeof value) {
					case "boolean":
						defaultBranch.setBoolPref(key, value);
						break;
					case "number":
						defaultBranch.setIntPref(key, value);
						break;
					case "string":
						defaultBranch.setStringPref(key, value);
						break;
				}
			}
			
			function readDefaults(contents) {
				let re = /^\s*pref\s*\(\s*['"]([a-zA-Z0-9_\-.]+)['"]\s*,\s*["']?.*["']?\s*\)\s*;\s*$/;
				let lines = contents.split(/\n/g).filter(line => re.test(line));
				for (let line of lines) {
					try {
						eval(line);
					}
					catch (e) {
						dump(e + "\n\n");
						Components.utils.reportError(e);
					}
				}
			}
			
			AddonManager.getAllAddons(async function(addons) {
				var reusableStreamInstance = Cc['@mozilla.org/scriptableinputstream;1']
					.createInstance(Ci.nsIScriptableInputStream);
				
				for (let addon of addons) {
					if (!addon.isActive) {
						continue;
					}
					
					try {
						let path = OS.Path.fromFileURI(addon.getResourceURI().spec);
						
						// Directory
						if ((await OS.File.stat(path)).isDir) {
							let dir = OS.Path.join(path, 'defaults', 'preferences');
							if (await OS.File.exists(dir)) {
								await Zotero.File.iterateDirectory(dir, async function (entry) {
									if (!entry.name.endsWith('.js')) return;
									readDefaults(Zotero.File.getContents(entry.path));
								});
							}
						}
						// XPI
						else {
							let file = Zotero.File.pathToFile(path);
							let zipReader = Components.classes["@mozilla.org/libjar/zip-reader;1"].
								createInstance(Components.interfaces.nsIZipReader);
							try {
								try {
									zipReader.open(file);
									zipReader.test(null);
								}
								catch (e) {
									Zotero.logError(path + " is not a valid ZIP file");
									continue;
								}
								
								let entries = zipReader.findEntries('defaults/preferences/*.js');
								while (entries.hasMore()) {
									let entryName = entries.getNext();
									let entry = zipReader.getEntry(entryName);
									
									if (!entry.isDirectory) {
										let inputStream = zipReader.getInputStream(entryName);
										reusableStreamInstance.init(inputStream);
										readDefaults(reusableStreamInstance.read(entry.realSize));
									}
								}
							}
							finally {
								zipReader.close();
							}
						}
					}
					catch (e) {
						Zotero.logError(e);
					}
				}
				
				resolve();
			});
		});
	}
}
