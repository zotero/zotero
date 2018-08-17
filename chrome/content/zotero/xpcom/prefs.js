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
	this.init = init;
	this.get = get;
	this.set = set;
	
	this.register = register;
	this.unregister = unregister;
	this.observe = observe;
	
	// Public properties
	this.prefBranch;
	
	function init(){
		this.prefBranch = Services.prefs.getBranch(ZOTERO_CONFIG.PREF_BRANCH);
		
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
			if (global) {
				var branch = Services.prefs.getBranch("");
			}
			else {
				var branch = this.prefBranch;
			}
			
			switch (branch.getPrefType(pref)){
				case branch.PREF_BOOL:
					return branch.getBoolPref(pref);
				case branch.PREF_STRING:
					return '' + branch.getComplexValue(pref, Components.interfaces.nsISupportsString);
				case branch.PREF_INT:
					return branch.getIntPref(pref);
			}
		}
		catch (e){
			throw new Error("Invalid preference '" + pref + "'");
		}
	}
	
	
	/**
	* Set a preference
	**/
	function set(pref, value, global) {
		try {
			if (global) {
				var branch = Services.prefs.getBranch("");
			}
			else {
				var branch = this.prefBranch;
			}
			
			switch (branch.getPrefType(pref)) {
				case branch.PREF_BOOL:
					return branch.setBoolPref(pref, value);
				case branch.PREF_STRING:
					let str = Cc["@mozilla.org/supports-string;1"]
						.createInstance(Ci.nsISupportsString);
					str.data = value;
					return branch.setComplexValue(pref, Ci.nsISupportsString, str);
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
						return branch.setCharPref(pref, value);
					}
					if (parseInt(value) == value) {
						Zotero.debug("Creating integer pref '" + pref + "'");
						return branch.setIntPref(pref, value);
					}
					throw new Error("Invalid preference value '" + value + "' for pref '" + pref + "'");
			}
		}
		catch (e) {
			Zotero.logError(e);
			throw new Error("Invalid preference '" + pref + "'");
		}
	}
	
	
	this.clear = function (pref, global) {
		if (global) {
			var branch = Services.prefs.getBranch("");
		}
		else {
			var branch = this.prefBranch;
		}
		branch.clearUserPref(pref);
	}
	
	
	this.resetBranch = function (exclude = []) {
		var keys = this.prefBranch.getChildList("", {});
		for (let key of keys) {
			if (this.prefBranch.prefHasUserValue(key)) {
				if (exclude.includes(key)) {
					continue;
				}
				Zotero.debug("Clearing " + key);
				this.prefBranch.clearUserPref(key);
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
		this.prefBranch.addObserver("", this, false);
		
		// Register pre-set handlers
		for (var i=0; i<_handlers.length; i++) {
			this.registerObserver(_handlers[i][0], _handlers[i][1]);
		}
	}
	
	function unregister(){
		if (!this.prefBranch){
			return;
		}
		this.prefBranch.removeObserver("", this);
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
				obs[i](this.get(data));
			}
			catch (e) {
				Zotero.debug("Error while executing preference observer handler for " + data);
				Zotero.debug(e);
			}
		}
	}
	
	var _observers = {};
	this.registerObserver = function(name, handler) {
		_observers[name] = _observers[name] || [];
		_observers[name].push(handler);
	}
	
	this.unregisterObserver = function(name, handler) {
		var obs = _observers[name];
		if (!obs) {
			Zotero.debug("No preferences observer registered for " + name);
			return;
		}
		
		var i = obs.indexOf(handler);
		if (i == -1) {
			Zotero.debug("Handler was not registered for preference " + name);
			return;
		}
		
		obs.splice(i, 1);
	}
}
