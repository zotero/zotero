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

Components.utils.import("resource://gre/modules/Services.jsm");

var installationInProgress = false;

var ZoteroPluginInstaller = function (addon, failSilently, force) {
	this._addon = addon;
	this.failSilently = failSilently;
	this.force = force;
	
	this.prefBranch = Services.prefs.getBranch(this._addon.EXTENSION_PREF_BRANCH);
	// Prefs:
	// version - last successfully installed version
	// skipInstallation - if user cancels an attempt to automatically install the plugin, we do not
	// 		attempt to automatically install it again until a successful installation

	this.prefPaneDoc = null;
	
	this.init();
};

ZoteroPluginInstaller.prototype = {
	init: async function () {
		if (this._initialized) return;
		Zotero.debug("PluginInstaller: fetching addon info");
		Zotero.debug("PluginInstaller: addon info fetched");
		
		try {
			this._version = (await Zotero.File.getContentsFromURLAsync(this._addon.VERSION_FILE)).trim();
			var version = this.prefBranch.getCharPref("version");
			if (this.force || (Services.vc.compare(version, this._addon.LAST_INSTALLED_FILE_UPDATE) < 0
					&& !this.prefBranch.getBoolPref("skipInstallation"))) {
				if (installationInProgress) {
					Zotero.debug(`${this._addon.APP} extension installation is already in progress`);
					return;
				}

				installationInProgress = true;
				if (!this._addon.DISABLE_PROGRESS_WINDOW) {
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
		}
		catch (e) {
			Zotero.logError(e);
		}
		finally {
			installationInProgress = false;
		}
		
		this._initialized = true;
	},
	_errorDisplayed: false,
	
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
		installationInProgress = false;
		this.closeProgressWindow();
		this.prefBranch.setCharPref("version", this._version);
		this.updateInstallStatus();
		this.prefBranch.setBoolPref("skipInstallation", false);
		if (this.force && !this._addon.DISABLE_PROGRESS_WINDOW) {
			var addon = this._addon;
			setTimeout(function () {
				Services.prompt.alert(
					null,
					addon.EXTENSION_STRING,
					Zotero.getString("zotero.preferences.wordProcessors.installationSuccess")
				);
			});
		}
	},
	
	error: function (error, notFailure) {
		installationInProgress = false;
		this.closeProgressWindow();
		if (!notFailure) {
			this.prefBranch.setCharPref("version", this._version);
			this.updateInstallStatus();
		}
		if (this.failSilently) return;
		if (this._errorDisplayed) return;
		this._errorDisplayed = true;
		var addon = this._addon;
		setTimeout(function () {
			var ps = Services.prompt;
			var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_OK
				+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING);
			var result = ps.confirmEx(null,
				addon.EXTENSION_STRING,
				(error ? error : Zotero.getString("zotero.preferences.wordProcessors.installationError", [addon.APP, Zotero.appName])),
				buttonFlags, null,
				Zotero.getString('zotero.preferences.wordProcessors.manualInstallation.button'),
				null, null, {});
			if (result == 1) {
				Zotero.launchURL("https://www.zotero.org/support/word_processor_plugin_manual_installation");
			}
		});
	},
	
	cancelled: function (dontSkipInstallation) {
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
			
		button.addEventListener("command", function () {
			Zotero.debug(`Install button pressed for ${addon.APP} plugin`);
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
	
	_firstRunListener: function () {
		this._progressWindowLabel = this._progressWindow.document.getElementById("progress-label");
		this._progressWindowLabel.value = Zotero.getString('zotero.preferences.wordProcessors.installing', this._addon.EXTENSION_STRING);
		this._progressWindow.sizeToContent();
		setTimeout(() => {
			this._progressWindow.focus();
			setTimeout(async () => {
				this._progressWindow.focus();
				try {
					await this._addon.install(this);
				}
				catch (e) {
					this.error();
					throw e;
				}
			}, 500);
		}, 100);
	},
};
