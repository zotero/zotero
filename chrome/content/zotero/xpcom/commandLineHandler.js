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

Zotero.CommandLineIngester = {
	ingest: async function () {
		const { CommandLineOptions } = ChromeUtils.importESModule("chrome://zotero/content/modules/commandLineOptions.mjs");

		var mainWindow = Zotero.getMainWindow();
		var fileToOpen;
		// Handle zotero:// and file URIs
		var uri = CommandLineOptions.url;
		if (uri) {
			if (uri.schemeIs("zotero")) {
				// Check for existing window and focus it
				if (mainWindow) {
					mainWindow.focus();
					mainWindow.ZoteroPane.loadURI(uri.spec);
				}
			}
			// See below
			else if (uri.schemeIs("file")) {
				fileToOpen = OS.Path.fromFileURI(uri.spec);
			}
			else {
				Zotero.debug(`Not handling URL: ${uri.spec}\n\n`);
			}
		}


		fileToOpen = fileToOpen || CommandLineOptions.file;
		if (fileToOpen) {
			var file = Zotero.File.pathToFile(fileToOpen);

			if (file.leafName.substr(-4).toLowerCase() === ".csl"
				|| file.leafName.substr(-8).toLowerCase() === ".csl.txt") {
				// Install CSL file
				Zotero.Styles.install({ file: file.path }, file.path);
			}
			else {
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

					mainWindow.Zotero_File_Interface.importFile({
						file,
						createNewCollection: checkState.value
					});
				}
			}
		}

		CommandLineOptions.url = false;
		CommandLineOptions.file = false;
	},
};

/**
 * The object representing the Zotero command line handler.
 * It is only active after Zotero is initialized and there is initial handling
 * in app/assets/commandLineHandler.js
 */
var ZoteroCommandLineHandler = {
	/* nsICommandLineHandler */
	handle: async function (cmdLine) {
		const { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
		// handler for Zotero integration commands
		// this is typically used on Windows only, via WM_COPYDATA rather than the command line
		var agent = cmdLine.handleFlagWithParam("ZoteroIntegrationAgent", false);
		if (agent) {
			var command = cmdLine.handleFlagWithParam("ZoteroIntegrationCommand", false);
			var docId = cmdLine.handleFlagWithParam("ZoteroIntegrationDocument", false);
			var templateVersion = parseInt(cmdLine.handleFlagWithParam("ZoteroIntegrationTemplateVersion", false));
			templateVersion = isNaN(templateVersion) ? 0 : templateVersion;
			
			Zotero.Integration.execCommand(agent, command, docId, templateVersion);
		}
		// Only open main window if we aren't handling an integration command
		else {
			Zotero.Utilities.Internal.activate(Zotero.getMainWindow());
		}
		
		await Zotero.CommandLineIngester.ingest();
	},
	
	classID: Components.ID("{531828f8-a16c-46be-b9aa-14845c3b010f}"),
	contractID: "@zotero.org/command-line-handler;1",
	QueryInterface: ChromeUtils.generateQI(["nsISupports", "nsICommandLineHandler"]),
	createInstance(iid) {
		return this.QueryInterface(iid);
	},
};

const Cm = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
// Don't register if already registered (e.g., after a reinit() in tests)
if (!Cm.isCIDRegistered(ZoteroCommandLineHandler.classID)) {
	Cm.registerFactory(
		ZoteroCommandLineHandler.classID,
		"command-line-handler",
		ZoteroCommandLineHandler.contractID,
		ZoteroCommandLineHandler
	);
	const catman = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
	
	catman.addCategoryEntry("command-line-handler",
		"m-zotero",
		ZoteroCommandLineHandler.contractID, false, true);
}
