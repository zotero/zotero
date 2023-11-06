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
    
	
	Based on nsChromeExtensionHandler example code by Ed Anuff at
	http://kb.mozillazine.org/Dev_:_Extending_the_Chrome_Protocol
	
    ***** END LICENSE BLOCK *****
*/

/**
 * The class representing the Zotero command line handler
 */
function ZoteroCommandLineHandler() {}
ZoteroCommandLineHandler.prototype = {
	/* nsICommandLineHandler */
	handle: async function (cmdLine) {
		// Force debug output to window
		if (cmdLine.handleFlag("ZoteroDebug", false)) {
			zInitOptions.forceDebugLog = 2;
		}
		// Force debug output to text console
		else if (cmdLine.handleFlag("ZoteroDebugText", false)) {
			zInitOptions.forceDebugLog = 1;
		}
		// Pressing Ctrl-C via the terminal is interpreted as a crash, and after three crashes
		// Firefox starts up in automatic safe mode (troubleshooting mode). To avoid this, we clear the crash
		// counter when using one of the debug-logging flags, which generally imply terminal usage.
		if (zInitOptions.forceDebugLog) {
			Services.prefs.getBranch("toolkit.startup.").clearUserPref('recent_crashes');
		}
		
		zInitOptions.forceDataDir = cmdLine.handleFlagWithParam("datadir", false);
		
		if (cmdLine.handleFlag("ZoteroTest", false)) {
			zInitOptions.test = true;
		}
		if (cmdLine.handleFlag("ZoteroAutomatedTest", false)) {
			zInitOptions.automatedTest = true;
		}
		if (cmdLine.handleFlag("ZoteroSkipBundledFiles", false)) {
			zInitOptions.skipBundledFiles = true;
		}
		
		// handler for Zotero integration commands
		// this is typically used on Windows only, via WM_COPYDATA rather than the command line
		var agent = cmdLine.handleFlagWithParam("ZoteroIntegrationAgent", false);
		if(agent) {
			// Don't open a new window
			cmdLine.preventDefault = true;
			
			var command = cmdLine.handleFlagWithParam("ZoteroIntegrationCommand", false);
			var docId = cmdLine.handleFlagWithParam("ZoteroIntegrationDocument", false);
			var templateVersion = parseInt(cmdLine.handleFlagWithParam("ZoteroIntegrationTemplateVersion", false));
			templateVersion = isNaN(templateVersion) ? 0 : templateVersion;
			
			zContext.Zotero.Integration.execCommand(agent, command, docId, templateVersion);
		}
	
		var fileToOpen;
		// Handle zotero:// and file URIs and prevent them from opening a new window
		var param = cmdLine.handleFlagWithParam("url", false);
		if (param) {
			cmdLine.preventDefault = true;
			
			var uri = cmdLine.resolveURI(param);
			if (uri.schemeIs("zotero")) {
				addInitCallback(function (Zotero) {
					Zotero.uiReadyPromise
					.then(function () {
						// Check for existing window and focus it
						var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
							.getService(Components.interfaces.nsIWindowMediator);
						var win = wm.getMostRecentWindow("navigator:browser");
						if (win) {
							win.focus();
							win.ZoteroPane.loadURI(uri.spec)
						}
					});
				});
			}
			// See below
			else if (uri.schemeIs("file")) {
				Components.utils.import("resource://gre/modules/osfile.jsm")
				fileToOpen = OS.Path.fromFileURI(uri.spec)
			}
			else {
				dump(`Not handling URL: ${uri.spec}\n\n`);
			}
		}
		
		param = cmdLine.handleFlag("debugger", false);
		if (param) {
			try {
				let portOrPath = Services.prefs.getBranch('').getIntPref('devtools.debugger.remote-port');
				
				const { DevToolsLoader } = ChromeUtils.import(
					"resource://devtools/shared/loader/Loader.jsm"
				);
				const loader = new DevToolsLoader({
					freshCompartment: true,
				});
				const { DevToolsServer } = loader.require("devtools/server/devtools-server");
				const { SocketListener } = loader.require("devtools/shared/security/socket");
				
				if (DevToolsServer.initialized) {
					dump("Debugger server already initialized\n\n");
					return;
				}
				
				DevToolsServer.init();
				DevToolsServer.registerAllActors();
				DevToolsServer.allowChromeProcess = true;
				const socketOptions = { portOrPath };
				const listener = new SocketListener(DevToolsServer, socketOptions);
				await listener.open();
				if (!DevToolsServer.listeningSockets) {
					throw new Error("No listening sockets");
				}
				
				dump(`Debugger server started on ${portOrPath}\n\n`);
			}
			catch (e) {
				dump(e + "\n\n");
				Components.utils.reportError(e);
			}
		}
		
		// In Fx49-based Mac Standalone, if Zotero is closed, an associated file is launched, and
		// Zotero hasn't been opened before, a -file parameter is passed and two main windows open.
		// Subsequent file openings when closed result in -url with file:// URLs (converted above)
		// and don't result in two windows. Here we prevent the double window.
		param = fileToOpen;
		if (!param) {
			param = cmdLine.handleFlagWithParam("file", false);
			if (param && isMac()) {
				cmdLine.preventDefault = true;
			}
		}
		if (param) {
			addInitCallback(function (Zotero) {
				// Wait to handle things that require the UI until after it's loaded
				Zotero.uiReadyPromise
				.then(function () {
					var file = Zotero.File.pathToFile(param);
					
					if(file.leafName.substr(-4).toLowerCase() === ".csl"
							|| file.leafName.substr(-8).toLowerCase() === ".csl.txt") {
						// Install CSL file
						Zotero.Styles.install({ file: file.path }, file.path);
					} else {
						// Ask before importing
						var checkState = {
							value: Zotero.Prefs.get('import.createNewCollection.fromFileOpenHandler')
						};
						if (Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService)
								.confirmCheck(null, Zotero.getString('ingester.importFile.title'),
								Zotero.getString('ingester.importFile.text', [file.leafName]),
								Zotero.getString('ingester.importFile.intoNewCollection'),
								checkState)) {
							Zotero.Prefs.set(
								'import.createNewCollection.fromFileOpenHandler', checkState.value
							);
							
							// Perform file import in front window
							var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
							   .getService(Components.interfaces.nsIWindowMediator);
							var browserWindow = wm.getMostRecentWindow("navigator:browser");
							browserWindow.Zotero_File_Interface.importFile({
								file,
								createNewCollection: checkState.value
							});
						}
					}
				});
			});
		}
	},
	
	classID: Components.ID("{531828f8-a16c-46be-b9aa-14845c3b010f}"),
	service: true,
	_xpcom_categories: [{category:"command-line-handler", entry:"m-zotero"}],
	QueryInterface: ChromeUtils.generateQI([Components.interfaces.nsICommandLineHandler])
};

var NSGetFactory = ComponentUtils.generateNSGetFactory([ZoteroService, ZoteroCommandLineHandler]);
