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

var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
var { setTimeout } = ChromeUtils.importESModule("resource://gre/modules/Timer.sys.mjs");

Components.utils.import("resource://gre/modules/Services.jsm");

var installationInProgress = false;

// Prefs:
// version - last successfully installed version
// lastAttemptedVersion - last version that was attempted to automatically install
// skipInstallation - if user cancels an attempt to automatically install the plugin, we do not
// 		automatically install it again until a successful manual installation

/**
 * Generic plugin installation orchestrator for word processor installers
 * @param addon {Object}
 * @param failSilently {Boolean} whether the installation should not throw errors (typically when installing automatically)
 * @param force {Boolean} force install even if the plugin version is up-to-date
 * @constructor
 */
var ZoteroPluginInstaller = function (addon, failSilently, force) {
	this._addon = addon;
	this.failSilently = failSilently;
	this.force = force;
	
	this.prefBranch = Services.prefs.getBranch(this._addon.EXTENSION_PREF_BRANCH);

	this.prefPaneDoc = null;
	this._errorDisplayed = false;
	
	this.init();
};

ZoteroPluginInstaller.prototype = {
	init: async function () {
		this.debug('Fetching addon info');
		
		this._currentPluginVersion = (await Zotero.File.getContentsFromURLAsync(this._addon.VERSION_FILE)).trim();
		let lastInstalledVersion = this.prefBranch.getCharPref("version");
		let lastAttemptedVersion = this.prefBranch.getCharPref("lastAttemptedVersion", "");
		let lastPluginFileVersion = this._addon.LAST_INSTALLED_FILE_UPDATE;
		this.debug(`Addon info fetched. version: ${this._currentPluginVersion}, `
			+ `file version: ${lastPluginFileVersion}, installed version: ${lastInstalledVersion}`
			+ `attempted: ${lastAttemptedVersion}`);
		const newVersionSinceLastInstall = Services.vc.compare(lastInstalledVersion, lastPluginFileVersion) < 0;
		const newVersionSinceLastAttempt = Services.vc.compare(lastAttemptedVersion, lastPluginFileVersion) < 0;
		const shouldSkipInstallation = this.prefBranch.getBoolPref("skipInstallation");
		if (this.force) {
			this.debug('Force-installing');
			// Should never fail silently
			this.failSilently = false;
			return this.install();
		}
		else if (shouldSkipInstallation) {
			this.debug('Skipping automatic installation because skipInstallation is true');
			return;
		}
		if (newVersionSinceLastAttempt) {
			this.debug('New version since last attempt to install. Will display prompt upon failure.');
			this.failSilently = false;
			this.prefBranch.setCharPref("lastAttemptedVersion", this._currentPluginVersion);
			return this.install();
		}
		else if (newVersionSinceLastInstall) {
			this.debug('New version since last successful install. Attempting to install silently.');
			return this.install();
		}
		this.debug('No new updates');
	},
	
	install: async function () {
		if (installationInProgress) {
			this.debug('Extension installation is already in progress');
			return;
		}
		installationInProgress = true;
		try {
			if (!this._addon.DISABLE_PROGRESS_WINDOW && !this.failSilently) {
				this._progressWindow = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
					.getService(Components.interfaces.nsIWindowWatcher)
					.openWindow(null, "chrome://zotero/content/progressWindow.xhtml", '',
						"chrome,resizable=no,close=no,centerscreen", null);
				this._progressWindow.addEventListener("load", () => this._firstRunListener(), false);
			}
			else {
				let result = this._addon.install(this);
				if (result.then) await result;
			}
		}
		catch (e) {
			Zotero.logError(e);
			this.error(e);
		}
		finally {
			installationInProgress = false;
		}
	},
	
	isInstalled: function () {
		return !!this.prefBranch.getCharPref("version");
	},
	
	setProgressWindowLabel: function (value) {
		if (this._progressWindow) this._progressWindowLabel.value = value;
	},
	
	closeProgressWindow: function () {
		if (this._progressWindow) this._progressWindow.close();
	},
	
	success: function () {
		this.debug(`Installation was successful. Version ${this._currentPluginVersion}`);
		installationInProgress = false;
		this.closeProgressWindow();
		this.prefBranch.setCharPref("version", this._currentPluginVersion);
		this.updateInstallStatus();
		this.prefBranch.setBoolPref("skipInstallation", false);
		if (this.force && !this._addon.DISABLE_PROGRESS_WINDOW) {
			setTimeout(() => {
				Services.prompt.alert(
					null,
					this._addon.EXTENSION_STRING,
					Zotero.getString("zotero.preferences.wordProcessors.installationSuccess")
				);
			});
		}
	},
	
	error: async function (error, notFailure) {
		this.debug(`Installation failed with error ${error}`);
		installationInProgress = false;
		this.closeProgressWindow();
		if (notFailure) {
			this.prefBranch.setCharPref("version", this._currentPluginVersion);
			this.updateInstallStatus();
		}
		if (this.failSilently) {
			this.debug('Not displaying error because failSilently is true');
			return;
		}
		if (this._errorDisplayed) return;
		this._errorDisplayed = true;
		let errorMessage = await Zotero.getString("zotero.preferences.wordProcessors.installationError", [
			this._addon.APP,
			Zotero.appName
		]);
		if (error) {
			errorMessage += "\n\n" + error;
		}
		setTimeout(() => {
			var ps = Services.prompt;
			var buttonFlags = (ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING) + ps.BUTTON_POS_0_DEFAULT
				+ (ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL);
			var result = ps.confirmEx(null,
				this._addon.EXTENSION_STRING,
				errorMessage,
				buttonFlags,
				Zotero.getString('general-view-troubleshooting-instructions'),
				null, null, null, {});
			if (result == 0) {
				Zotero.launchURL("https://www.zotero.org/support/kb/word_processor_plugin_installation_error");
			}
		});
	},
	
	cancelled: function (dontSkipInstallation) {
		this.debug('Installation cancelled');
		installationInProgress = false;
		this.closeProgressWindow();
		if (!this.force && !dontSkipInstallation) this.prefBranch.setBoolPref("skipInstallation", true);
	},

	showPreferences: function (document) {
		this.prefPaneDoc = document;
		var isInstalled = this.isInstalled(),
			groupbox = document.createXULElement("groupbox");
		groupbox.id = this._addon.EXTENSION_DIR;

		var label = document.createXULElement("label");
		var h2 = document.createElement('h2');
		h2.textContent = this._addon.APP;
		label.appendChild(h2);
		groupbox.appendChild(label);

		var description = document.createXULElement("description");
		description.appendChild(document.createTextNode(isInstalled
			? Zotero.getString('zotero.preferences.wordProcessors.installed', this._addon.APP)
			: Zotero.getString('zotero.preferences.wordProcessors.notInstalled', this._addon.APP)));
		groupbox.appendChild(description);

		var hbox = document.createXULElement("hbox");
		hbox.setAttribute("pack", "center");
		var button = document.createXULElement("button"),
			addon = this._addon;
		button.setAttribute("label", isInstalled
			? Zotero.getString('zotero.preferences.wordProcessors.reinstall', this._addon.APP)
			: Zotero.getString('zotero.preferences.wordProcessors.install', this._addon.APP));
			
		button.addEventListener("command", () => {
			this.debug('Install button pressed');
			try {
				var zpi = new ZoteroPluginInstaller(addon, false, true);
				zpi.showPreferences(document);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}, false);
		hbox.appendChild(button);
		groupbox.appendChild(hbox);

		var container = document.getElementById("wordProcessorInstallers"),
			old = document.getElementById(this._addon.EXTENSION_DIR);
		if (old) {
			container.replaceChild(groupbox, old);
		}
		else {
			container.appendChild(groupbox);
		}
	},
	
	updateInstallStatus: function () {
		if (!this.prefPaneDoc) return;
		var isInstalled = this.isInstalled();
		var description = this.prefPaneDoc.querySelector(`#${this._addon.EXTENSION_DIR} description`);
		description.replaceChild(this.prefPaneDoc.createTextNode(isInstalled
			? Zotero.getString('zotero.preferences.wordProcessors.installed', this._addon.APP)
			: Zotero.getString('zotero.preferences.wordProcessors.notInstalled', this._addon.APP)
		), description.childNodes[0]);
		var button = this.prefPaneDoc.querySelector(`#${this._addon.EXTENSION_DIR} button`);
		button.setAttribute("label", isInstalled
			? Zotero.getString('zotero.preferences.wordProcessors.reinstall', this._addon.APP)
			: Zotero.getString('zotero.preferences.wordProcessors.install', this._addon.APP));
	},
	
	_firstRunListener: async function () {
		this._progressWindowLabel = this._progressWindow.document.getElementById("progress-label");
		this._progressWindowLabel.value = Zotero.getString('zotero.preferences.wordProcessors.installing', this._addon.EXTENSION_STRING);
		this._progressWindow.sizeToContent();
		await Zotero.Promise.delay(100);
		this._progressWindow.focus();
		await Zotero.Promise.delay(500);
		this._progressWindow.focus();
		try {
			await this._addon.install(this);
		}
		catch (e) {
			Zotero.logError(e);
			this.error(e);
		}
	},
	
	debug: function (message) {
		Zotero.debug(`PluginInstaller ${this._addon.APP}: ${message}`);
	}
};
