/*
    ***** BEGIN LICENSE BLOCK *****
	
	Copyright (c) 2009  Zotero
	                    Center for History and New Media
						George Mason University, Fairfax, Virginia, USA
						http://zotero.org
	
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

/**
 * A common installer interface used by word processor plugins to make themselves
 * installable and available in the cite preferences pane.
 */

var EXPORTED_SYMBOLS = ["ZoteroPluginInstaller"];

var Zotero = Components.classes["@zotero.org/Zotero;1"]
				// Currently uses only nsISupports
				//.getService(Components.interfaces.chnmIZoteroService).
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");

var installationInProgress = false;
var _runningTimers = [];
function setTimeout(func, ms) {
	var timer = Components.classes["@mozilla.org/timer;1"].
		createInstance(Components.interfaces.nsITimer);
	var timerCallback = {notify: function() {
		_runningTimers.splice(_runningTimers.indexOf(timer), 1);
		func();
	}};
	timer.initWithCallback(timerCallback, ms, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
	// add timer to global scope so that it doesn't get garbage collected before it completes
	_runningTimers.push(timer);
}

var ZoteroPluginInstaller = function(addon, failSilently, force) {
	this._addon = addon;
	this.failSilently = failSilently;
	this.force = force;
	
	var prefService = Components.classes["@mozilla.org/preferences-service;1"].
			getService(Components.interfaces.nsIPrefService);
	this.prefBranch = prefService.getBranch(this._addon.EXTENSION_PREF_BRANCH);

	this.prefPaneDoc = null;
	
	var me = this;
	var extensionIDs = [this._addon.EXTENSION_ID].concat(this._addon.REQUIRED_ADDONS.map(req => req.id));
	Zotero.debug("PluginInstaller: fetching addon info");
	AddonManager.getAddonsByIDs(extensionIDs, function(addons) {
		Zotero.debug("PluginInstaller: addon info fetched");
		me._addonInfo = addons[0];
		me._addonInfoAvailable();
	});
};

ZoteroPluginInstaller.prototype = {
	_errorDisplayed: false,
	
	_addonInfoAvailable: function() {
		try {
			this._version = this._addonInfo.version;
			
			try {
				this._addon.verifyNotCorrupt(this);
			} catch(e) {
				Zotero.debug("Not installing +this._addon.EXTENSION_STRING+:  "+e.toString());
				return;
			}
			
			var version = this.prefBranch.getCharPref("version");			
			if(this.force || (
					(
						Services.vc.compare(version, this._addon.LAST_INSTALLED_FILE_UPDATE) < 0
						|| (!Zotero.isStandalone && !this.prefBranch.getBoolPref("installed"))
					)
					&& !this.prefBranch.getBoolPref("skipInstallation")
				)) {
					
				var me = this;
				if (installationInProgress) {
					Zotero.debug(`${this._addon.APP} extension installation is already in progress`);
					return;
				}
				
				installationInProgress = true;
				if(!this._addon.DISABLE_PROGRESS_WINDOW) {
					this._progressWindow = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
						.getService(Components.interfaces.nsIWindowWatcher)
						.openWindow(null, "chrome://"+this._addon.EXTENSION_DIR+"/content/progress.xul", '',
							"chrome,resizable=no,close=no,centerscreen", null);	
					this._progressWindow.addEventListener("load", function() { me._firstRunListener() }, false);
				} else {
					this._addon.install(this);
				}
			}
		} catch(e) {
			Zotero.logError(e);
		} finally {
			installationInProgress = false;
		}
	},
	
	isInstalled: function() {
		while(!this._version) Zotero.mainThread.processNextEvent(true);
		return this.prefBranch.getCharPref("version") == this._version && 
			this.prefBranch.getBoolPref("installed");
	},
	
	getAddonPath: function(addonID) {
		return this._addonInfo.getResourceURI().
			QueryInterface(Components.interfaces.nsIFileURL).file;
	},
	
	setProgressWindowLabel: function(value) {
		if(this._progressWindow) this._progressWindowLabel.value = value;
	},
	
	closeProgressWindow: function(value) {
		if(this._progressWindow) this._progressWindow.close();
	},
	
	success: function() {
		installationInProgress = false;
		this.closeProgressWindow();
		this.prefBranch.setCharPref("version", this._version);
		this.updateInstallStatus(true);
		this.prefBranch.setBoolPref("skipInstallation", false);
		if(this.force && !this._addon.DISABLE_PROGRESS_WINDOW) {
			var addon = this._addon;
			setTimeout(function() {
				Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService)
					.alert(null, addon.EXTENSION_STRING,
					Zotero.getString("zotero.preferences.wordProcessors.installationSuccess"));
			}, 0);
		}
	},
	
	error: function(error, notFailure) {
		installationInProgress = false;
		this.closeProgressWindow();
		if(!notFailure) {
			this.prefBranch.setCharPref("version", this._version);
			this.updateInstallStatus(false);
		}
		if(this.failSilently) return;
		if(this._errorDisplayed) return;
		this._errorDisplayed = true;
		var addon = this._addon;
		setTimeout(function() {
			Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Components.interfaces.nsIPromptService)
				.alert(null, addon.EXTENSION_STRING,
				(error ? error : Zotero.getString("zotero.preferences.wordProcessors.installationError", [addon.APP, Zotero.appName])));
		}, 0);
	},
	
	cancelled: function(dontSkipInstallation) {
		installationInProgress = false;
		this.closeProgressWindow();
		if(!this.force && !dontSkipInstallation) this.prefBranch.setBoolPref("skipInstallation", true);
	},

	showPreferences: function(document) {
		this.prefPaneDoc = document;
		var isInstalled = this.isInstalled(),
			groupbox = document.createElement("groupbox");
		groupbox.id = this._addon.EXTENSION_DIR;

		var caption = document.createElement("caption");
		caption.setAttribute("label", this._addon.APP);
		groupbox.appendChild(caption);

		var description = document.createElement("description");
		description.style.width = "45em";
		description.appendChild(document.createTextNode(
			isInstalled ?
				Zotero.getString('zotero.preferences.wordProcessors.installed', this._addon.APP) :
				Zotero.getString('zotero.preferences.wordProcessors.notInstalled', this._addon.APP)));
		groupbox.appendChild(description);

		var hbox = document.createElement("hbox");
		hbox.setAttribute("pack", "center");
		var button = document.createElement("button"),
			addon = this._addon;
		button.setAttribute("label", 
			(isInstalled ?
				Zotero.getString('zotero.preferences.wordProcessors.reinstall', this._addon.APP) :
				Zotero.getString('zotero.preferences.wordProcessors.install', this._addon.APP)));
		button.addEventListener("command", function() {
			Zotero.debug(`Install button pressed for ${addon.APP} plugin`);
			try {
				var zpi = new ZoteroPluginInstaller(addon, false, true);
				zpi.showPreferences(document);
			} catch (e) {
				Zotero.logError(e);
			}
		}, false);
		hbox.appendChild(button);
		groupbox.appendChild(hbox);

		var tabpanel = document.getElementById("wordProcessors"),
			old = document.getElementById(this._addon.EXTENSION_DIR);
		if(old) {
			tabpanel.replaceChild(groupbox, old);
		} else {
			tabpanel.insertBefore(groupbox, tabpanel.firstChild);
		}
	},
	
	updateInstallStatus: function(status) {
		this.prefBranch.setBoolPref("installed", status);
		if (! this.prefPaneDoc) return;
		var isInstalled = this.isInstalled();
		var description = this.prefPaneDoc.querySelector(`#${this._addon.EXTENSION_DIR} description`);
		description.replaceChild(this.prefPaneDoc.createTextNode(
				isInstalled ?
					Zotero.getString('zotero.preferences.wordProcessors.installed', this._addon.APP) :
					Zotero.getString('zotero.preferences.wordProcessors.notInstalled', this._addon.APP)
				), description.childNodes[0]);
		var button = this.prefPaneDoc.querySelector(`#${this._addon.EXTENSION_DIR} button`);
		button.setAttribute("label", 
			(isInstalled ?
				Zotero.getString('zotero.preferences.wordProcessors.reinstall', this._addon.APP) :
				Zotero.getString('zotero.preferences.wordProcessors.install', this._addon.APP)));
	},	
	
	_firstRunListener: function() {
		this._progressWindowLabel = this._progressWindow.document.getElementById("progress-label");
		this._progressWindowLabel.value = Zotero.getString('zotero.preferences.wordProcessors.installing', this._addon.EXTENSION_STRING);
		var me = this;
		setTimeout(function() {
			me._progressWindow.focus();
			setTimeout(function() {
				me._progressWindow.focus();
				try {
					me._addon.install(me);
				} catch(e) {
					me.error();
					throw e;
				}
			}, 500);
		}, 100);
	},
};