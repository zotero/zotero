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
				fileToOpen = OS.Path.fromFileURI(uri.spec)
			}
			else {
				dump(`Not handling URL: ${uri.spec}\n\n`);
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
						if (Services.prompt.confirmCheck(null, Zotero.getString('ingester.importFile.title'),
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
