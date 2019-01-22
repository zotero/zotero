/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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

Components.utils.import("resource://gre/modules/Services.jsm");

/**
 * This object contains the various functions for the interface
 */
const ZoteroStandalone = new function() {
	/**
	 * Run when standalone window first opens
	 */
	this.onLoad = function() {
		// Fix window without menubar/titlebar when Zotero is closed in full-screen mode in OS X 10.11+
		if (Zotero.isMac && window.document.documentElement.getAttribute('sizemode') == 'fullscreen') {
			window.document.documentElement.setAttribute('sizemode', 'normal');
		}
		
		Zotero.Promise.try(function () {
			if(!Zotero) {
				throw true;
			}
			if(Zotero.initializationPromise.isPending()) {
				Zotero.showZoteroPaneProgressMeter();
			}
			return Zotero.initializationPromise;
		})
		.then(async function () {
			if (Zotero.Prefs.get('devtools.errorconsole.enabled', true)) {
				document.getElementById('menu_errorConsole').hidden = false;
			}
			if (Zotero.Prefs.get('devtools.chrome.enabled', true)) {
				document.getElementById('menu_errorConsole').hidden = false;
				document.getElementById('menu_runJS').hidden = false;
			}
			
			document.getElementById('key_copyCitation')
				.setAttribute('key', Zotero.Keys.getKeyForCommand('copySelectedItemCitationsToClipboard'));
			document.getElementById('key_copyBibliography')
				.setAttribute('key', Zotero.Keys.getKeyForCommand('copySelectedItemsToClipboard'));
			
			ZoteroStandalone.DebugOutput.init();
			
			Zotero.hideZoteroPaneOverlays();
			await ZoteroPane.Containers.init();
			ZoteroPane.init();
			ZoteroPane.makeVisible();
			
			// Don't ask before handing http and https URIs
			var eps = Components.classes['@mozilla.org/uriloader/external-protocol-service;1']
					.getService(Components.interfaces.nsIExternalProtocolService);
			var hs = Components.classes["@mozilla.org/uriloader/handler-service;1"]
					.getService(Components.interfaces.nsIHandlerService);
			for (let scheme of ["http", "https"]) {
				var handlerInfo = eps.getProtocolHandlerInfo(scheme);
				handlerInfo.preferredAction = Components.interfaces.nsIHandlerInfo.useSystemDefault;
				handlerInfo.alwaysAskBeforeHandling = false;
				hs.store(handlerInfo);
			}
			
			// Add add-on listeners (not yet hooked up)
			Services.obs.addObserver(gXPInstallObserver, "addon-install-disabled", false);
			Services.obs.addObserver(gXPInstallObserver, "addon-install-started", false);
			Services.obs.addObserver(gXPInstallObserver, "addon-install-blocked", false);
			Services.obs.addObserver(gXPInstallObserver, "addon-install-failed", false);
			Services.obs.addObserver(gXPInstallObserver, "addon-install-complete", false);
		})
		.catch(function (e) {
			try { Zotero.debug(e, 1); } catch (e) {}
			Components.utils.reportError(e);
			ZoteroPane.displayStartupError();
			window.close();
			return;
		});
	}
	
	/**
	 * Builds new item menu
	 */
	this.buildNewItemMenu = function() {
		var addMenu = document.getElementById('menu_NewItemPopup');
		
		// Remove all nodes so we can regenerate
		while(addMenu.hasChildNodes()) addMenu.removeChild(addMenu.firstChild);
		
		var typeSets = [Zotero.ItemTypes.getPrimaryTypes(), Zotero.ItemTypes.getSecondaryTypes()];
		for(var j=0; j<typeSets.length; j++) {
			var t = typeSets[j];
			
			// Sort by localized name
			var itemTypes = [];
			for (var i=0; i<t.length; i++) {
				itemTypes.push({
					id: t[i].id,
					name: t[i].name,
					localized: Zotero.ItemTypes.getLocalizedString(t[i].id)
				});
			}
			var collation = Zotero.getLocaleCollation();
			itemTypes.sort(function(a, b) {
				return collation.compareString(1, a.localized, b.localized);
			});
			
			for (var i = 0; i<itemTypes.length; i++) {
				var menuitem = document.createElement("menuitem");
				menuitem.setAttribute("label", itemTypes[i].localized);
				menuitem.setAttribute("tooltiptext", "");
				let type = itemTypes[i].id;
				menuitem.addEventListener("command", function() {
					ZoteroPane_Local.newItem(type, null, null, true);
				}, false);
				menuitem.className = "zotero-tb-add";
				addMenu.appendChild(menuitem);
			}
			
			// add separator between sets
			if(j !== typeSets.length-1) {
				addMenu.appendChild(document.createElement("menuseparator"));
			}
		}
	}
	
	
	this.updateQuickCopyOptions = function () {
		var selected = false;
		try {
			selected = Zotero.getActiveZoteroPane()
				.getSelectedItems()
				.filter(item => item.isRegularItem())
				.length;
		}
		catch (e) {}
		
		var format = Zotero.QuickCopy.getFormatFromURL(Zotero.QuickCopy.lastActiveURL);
		format = Zotero.QuickCopy.unserializeSetting(format);
		
		var copyCitation = document.getElementById('menu_copyCitation');
		var copyBibliography = document.getElementById('menu_copyBibliography');
		var copyExport = document.getElementById('menu_copyExport');
		
		copyCitation.hidden = !selected || format.mode != 'bibliography';
		copyBibliography.hidden = !selected || format.mode != 'bibliography';
		copyExport.hidden = !selected || format.mode != 'export';
		if (format.mode == 'export') {
			try {
				let obj = Zotero.Translators.get(format.id);
				if (obj) {
					copyExport.label = Zotero.getString('quickCopy.copyAs', obj.label);
				}
				else {
					copyExport.hidden = true;
				}
			}
			catch (e) {
				if (!(e instanceof Zotero.Exception.UnloadedDataException && e.dataType == 'translators')) {
					Zotero.logError(e);
				}
				copyExport.hidden = true;
			}
		}
	};
	
	
	this.updateAddonsPane = function (doc) {
		// Hide unsigned add-on verification warnings
		//
		// This only works for the initial load of the window. If the user switches to Appearance
		// or Plugins and then back to Extensions, the warnings will appear again. A better way to
		// disable this might be discoverable by studying
		// https://dxr.mozilla.org/mozilla-central/source/toolkit/mozapps/extensions/content/extensions.js
		var addonList = doc.getElementById('addon-list');
		setTimeout(function () {
			for (let i = 0; i < addonList.itemCount; i++) {
				let richListItem = addonList.getItemAtIndex(i);
				let container = doc.getAnonymousElementByAttribute(
					richListItem, 'anonid', 'warning-container'
				);
				if (container) {
					let link = doc.getAnonymousElementByAttribute(
						richListItem, 'anonid', 'warning-link'
					);
					if (link && link.href.indexOf('unsigned-addons') != -1) {
						richListItem.removeAttribute('notification');
						container.hidden = true;
					}
				}
			}
		});
	}
	
	/**
	 * Handles help menu requests
	 */
	this.openHelp = function(type) {
		Components.utils.import("resource://zotero/config.js");
		
		switch (type) {
		case "troubleshooting":
			ZoteroPane.loadURI(ZOTERO_CONFIG.TROUBLESHOOTING_URL);
			break;
		
		case "feedback":
			ZoteroPane.loadURI(ZOTERO_CONFIG.FEEDBACK_URL);
			break;
		
		case "connectors":
			ZoteroPane.loadURI(ZOTERO_CONFIG.CONNECTORS_URL);
			break;
		
		default:
			ZoteroPane.loadURI(ZOTERO_CONFIG.SUPPORT_URL);
		}
	}
	
	/**
	 * Checks for updates
	 */
	this.checkForUpdates = function() {
		window.open('chrome://mozapps/content/update/updates.xul', 'updateChecker', 'chrome,centerscreen');
	}
	
	/**
	 * Called before standalone window is closed
	 */
	this.onUnload = function() {
		ZoteroPane.destroy();
	}
}


ZoteroStandalone.DebugOutput = {
	_timer: null,
	
	init: function () {
		var storing = Zotero.Debug.storing;
		this._showMenu();
		this.update();
	},
	
	
	toggleStore: function () {
		Zotero.Debug.setStore(!Zotero.Debug.storing);
	},
	
	
	update: function () {
		var enabled = Zotero.Debug.storing;
		var lines = Zotero.Debug.count();
		var empty = lines == 0;
		
		// Show "Submit" when enabled, but leave disabled until there's output
		var menuitem = document.getElementById('debug-output-submit');
		menuitem.hidden = !enabled && empty;
		menuitem.disabled = empty;
		
		// Toggle between "Enable" and "Disable"
		menuitem = document.getElementById('debug-output-enable-disable');
		menuitem.label = Zotero.getString('general.' + (enabled ? 'disable' : 'enable'));
		
		// Update line count
		var str = Zotero.getString('zotero.debugOutputLogging.linesLogged', lines, lines);
		document.getElementById('debug-output-status').label = str;
		
		// Enable "Clear" when there's output
		document.getElementById('debug-output-clear').disabled = empty;
	},
	
	
	submit: function () {
		// 'Zotero' isn't defined yet when this function is created, so do it inline
		return Zotero.Promise.coroutine(function* () {
			Zotero.debug("Submitting debug output");
			
			Components.utils.import("resource://zotero/config.js");
			
			var url = ZOTERO_CONFIG.REPOSITORY_URL + "report?debug=1";
			var output = yield Zotero.Debug.get(
				Zotero.Prefs.get('debug.store.submitSize'),
				Zotero.Prefs.get('debug.store.submitLineLength')
			);
			Zotero.Debug.setStore(false);
			
			var ps = Services.prompt;
			try {
				var xmlhttp = yield Zotero.HTTP.request(
					"POST",
					url,
					{
						compressBody: true,
						body: output,
						logBodyLength: 30,
						timeout: 15000,
						requestObserver: function (req) {
							// Don't fail during tests, with fake XHR
							if (!req.channel) {
								return;
							}
							req.channel.notificationCallbacks = {
								onProgress: function (request, context, progress, progressMax) {},
								
								// nsIInterfaceRequestor
								getInterface: function (iid) {
									try {
										return this.QueryInterface(iid);
									}
									catch (e) {
										throw Components.results.NS_NOINTERFACE;
									}
								},
								
								QueryInterface: function(iid) {
									if (iid.equals(Components.interfaces.nsISupports) ||
											iid.equals(Components.interfaces.nsIInterfaceRequestor) ||
											iid.equals(Components.interfaces.nsIProgressEventSink)) {
										return this;
									}
									throw Components.results.NS_NOINTERFACE;
								},
				
							}
						}
					}
				);
			}
			catch (e) {
				Zotero.logError(e);
				let title = Zotero.getString('general.error');
				let msg;
				if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
					msg = Zotero.getString('general.invalidResponseServer');
				}
				else if (e instanceof Zotero.HTTP.BrowserOfflineException) {
					msg = Zotero.getString('general.browserIsOffline', Zotero.appName);
				}
				else {
					msg = Zotero.getString('zotero.debugOutputLogging.dialog.error');
				}
				ps.alert(null, title, msg);
				return false;
			}
			
			Zotero.debug(xmlhttp.responseText);
			
			var reported = xmlhttp.responseXML.getElementsByTagName('reported');
			if (reported.length != 1) {
				ps.alert(
					null,
					Zotero.getString('general.error'),
					Zotero.getString('general.serverError')
				);
				return false;
			}
			
			var reportID = reported[0].getAttribute('reportID');
			
			var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
				+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
			var index = ps.confirmEx(
				null,
				Zotero.getString('zotero.debugOutputLogging.dialog.title'),
				Zotero.getString('zotero.debugOutputLogging.dialog.sent', [ZOTERO_CONFIG.DOMAIN_NAME, reportID]),
				buttonFlags,
				Zotero.getString('general.copyToClipboard'),
				null, null, null, {}
			);
			if (index == 0) {
				const helper = Components.classes["@mozilla.org/widget/clipboardhelper;1"]
					.getService(Components.interfaces.nsIClipboardHelper);
				helper.copyString("D" + reportID);
			}
			
			Zotero.Debug.clear();
			return true;
		}.bind(this))();
	},
	
	
	view: function () {
		Zotero.openInViewer("chrome://zotero/content/debugViewer.html", function (doc) {
			var submitted = false;
			doc.querySelector('#submit-button').addEventListener('click', function (event) {
				submitted = true;
			});
			doc.querySelector('#clear-button').addEventListener('click', function (event) {
				Zotero.Debug.clear();
			});
			// If output has been submitted, disable logging when window is closed
			doc.defaultView.addEventListener('unload', function (event) {
				if (submitted) {
					Zotero.Debug.setStore(false);
					Zotero.Debug.clear();
				}
			});
		});
	},
	
	
	clear: function () {
		Zotero.Debug.clear();
	},
	
	
	restartEnabled: function () {
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
				+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
				+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
		var index = ps.confirmEx(
			null,
			Zotero.getString('zotero.debugOutputLogging'),
			Zotero.getString('zotero.debugOutputLogging.enabledAfterRestart', [Zotero.clientName]),
			buttonFlags,
			Zotero.getString('general.restartNow'),
			null, Zotero.getString('general.restartLater'), null, {}
		);
		if (index != 1) {
			Zotero.Prefs.set('debug.store', true);
		}
		if (index == 0) {
			Zotero.Utilities.Internal.quit(true);
		}
	},
	
	
	_showMenu: function () {
		document.getElementById('debug-output-menu').hidden = false;
	}
};


function toJavaScriptConsole() {
	toOpenWindowByType("global:console", "chrome://global/content/console.xul");
}

function openRunJSWindow() {
	window.open('chrome://zotero/content/runJS.html', 'run-js', 'width=900,height=700,resizable');
}

function toOpenWindowByType(inType, uri, features)
{
	var topWindow = Services.wm.getMostRecentWindow(inType);
	
	if (topWindow) {
		topWindow.focus();
	} else if(features) {
		window.open(uri, "_blank", features);
	} else {
		window.open(uri, "_blank", "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
	}
}

const gXPInstallObserver = {
	observe: function (aSubject, aTopic, aData) {
		var installInfo = aSubject.QueryInterface(Components.interfaces.amIWebInstallInfo);
		var win = installInfo.originatingWindow;
		switch (aTopic) {
			case "addon-install-disabled":
			case "addon-install-blocked":
			case "addon-install-failed":
				var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
				promptService.alert(win, Zotero.getString("standalone.addonInstallationFailed.title"),
					Zotero.getString("standalone.addonInstallationFailed.body", installInfo.installs[0].name));
				break;
			/*case "addon-install-started":
			case "addon-install-complete":*/
		}
	}
};

// Used by update prompt
function openUILinkIn(url) {
	ZoteroPane.loadURI(url);
}

window.addEventListener("load", function(e) { ZoteroStandalone.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ZoteroStandalone.onUnload(e); }, false);