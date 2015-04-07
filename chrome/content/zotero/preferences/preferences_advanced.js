/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2006–2013 Center for History and New Media
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

"use strict";

Zotero_Preferences.Advanced = {
	_openURLResolvers: null,
	
	
	init: function () {
		Zotero_Preferences.Debug_Output.init();
		Zotero_Preferences.Keys.init();
	},
	
	revealDataDirectory: function () {
		var dataDir = Zotero.getZoteroDirectory();
		dataDir.QueryInterface(Components.interfaces.nsILocalFile);
		try {
			dataDir.reveal();
		}
		catch (e) {
			// On platforms that don't support nsILocalFile.reveal() (e.g. Linux),
			// launch the directory
			window.opener.ZoteroPane_Local.launchFile(dataDir);
		}
	},
	
	
	runIntegrityCheck: function () {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		
		var ok = Zotero.DB.integrityCheck();
		if (ok) {
			ok = Zotero.Schema.integrityCheck();
			if (!ok) {
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
					+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
				var index = ps.confirmEx(window,
					Zotero.getString('general.failed'),
					Zotero.getString('db.integrityCheck.failed') + "\n\n" +
						Zotero.getString('db.integrityCheck.repairAttempt') + " " +
						Zotero.getString('db.integrityCheck.appRestartNeeded', Zotero.appName),
					buttonFlags,
					Zotero.getString('db.integrityCheck.fixAndRestart', Zotero.appName),
					null, null, null, {}
				);
				
				if (index == 0) {
					// Safety first
					Zotero.DB.backupDatabase();
					
					// Fix the errors
					Zotero.Schema.integrityCheck(true);
					
					// And run the check again
					ok = Zotero.Schema.integrityCheck();
					var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING);
					if (ok) {
						var str = 'success';
						var msg = Zotero.getString('db.integrityCheck.errorsFixed');
					}
					else {
						var str = 'failed';
						var msg = Zotero.getString('db.integrityCheck.errorsNotFixed')
									+ "\n\n" + Zotero.getString('db.integrityCheck.reportInForums');
					}
					
					ps.confirmEx(window,
						Zotero.getString('general.' + str),
						msg,
						buttonFlags,
						Zotero.getString('general.restartApp', Zotero.appName),
						null, null, null, {}
					);
					
					var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
							.getService(Components.interfaces.nsIAppStartup);
					appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit
						| Components.interfaces.nsIAppStartup.eRestart);
				}
				
				return;
			}
		}
		var str = ok ? 'passed' : 'failed';
		
		ps.alert(window,
			Zotero.getString('general.' + str),
			Zotero.getString('db.integrityCheck.' + str)
			+ (!ok ? "\n\n" + Zotero.getString('db.integrityCheck.dbRepairTool') : ''));
	},
	
	
	resetTranslatorsAndStyles: function () {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		
		var index = ps.confirmEx(null,
			Zotero.getString('general.warning'),
			Zotero.getString('zotero.preferences.advanced.resetTranslatorsAndStyles.changesLost'),
			buttonFlags,
			Zotero.getString('zotero.preferences.advanced.resetTranslatorsAndStyles'),
			null, null, null, {});
		
		if (index == 0) {
			Zotero.Schema.resetTranslatorsAndStyles(function (xmlhttp, updated) {
				if (Zotero_Preferences.Export) {
					Zotero_Preferences.Export.populateQuickCopyList();
				}
			});
		}
	},
	
	
	resetTranslators: function () {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		
		var index = ps.confirmEx(null,
			Zotero.getString('general.warning'),
			Zotero.getString('zotero.preferences.advanced.resetTranslators.changesLost'),
			buttonFlags,
			Zotero.getString('zotero.preferences.advanced.resetTranslators'),
			null, null, null, {});
		
		if (index == 0) {
			Zotero.Schema.resetTranslators(function () {
				if (Zotero_Preferences.Export) {
					Zotero_Preferences.Export.populateQuickCopyList();
				}
			});
		}
	},
	
	
	resetStyles: function () {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		
		var index = ps.confirmEx(null,
			Zotero.getString('general.warning'),
			Zotero.getString('zotero.preferences.advanced.resetStyles.changesLost'),
			buttonFlags,
			Zotero.getString('zotero.preferences.advanced.resetStyles'),
			null, null, null, {});
		
		if (index == 0) {
			Zotero.Schema.resetStyles(function (xmlhttp, updated) {
				if (Zotero_Preferences.Export) {
					Zotero_Preferences.Export.populateQuickCopyList();
				}
			});
		}
	},
	
	
	onDataDirLoad: function () {
		var path = document.getElementById('dataDirPath');
		var useDataDir = Zotero.Prefs.get('useDataDir');
		path.setAttribute('disabled', !useDataDir);
	},
	
	
	onDataDirUpdate: function (event) {
		var radiogroup = document.getElementById('dataDir');
		var path = document.getElementById('dataDirPath');
		var useDataDir = Zotero.Prefs.get('useDataDir');
		
		// If triggered from the Choose button, don't show the dialog, since
		// Zotero.chooseZoteroDirectory() (called below due to the radio button
		// change) shows its own
		if (event.originalTarget && event.originalTarget.tagName == 'button') {
			return true;
		}
		
		// If changing from default to custom
		if (!useDataDir) {
			event.stopPropagation();
			var file = Zotero.chooseZoteroDirectory(true, false, function () {
				Zotero_Preferences.openURL('http://zotero.org/support/zotero_data');
			});
			radiogroup.selectedIndex = file ? 1 : 0;
			return !!file;
		}
		
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
			+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
		var app = Zotero.appName;
		var index = ps.confirmEx(window,
			Zotero.getString('general.restartRequired'),
			Zotero.getString('general.restartRequiredForChange', app) + '\n\n'
				+ Zotero.getString('dataDir.moveFilesToNewLocation', app),
			buttonFlags,
			Zotero.getString('general.quitApp', app),
			null,
			Zotero.getString('general.moreInformation'),
			null, {});
		
		if (index == 0) {
			useDataDir = !!radiogroup.selectedIndex;
			// quit() is asynchronous, but set this here just in case
			Zotero.Prefs.set('useDataDir', useDataDir);
			var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
					.getService(Components.interfaces.nsIAppStartup);
			appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
		}
		else if (index == 2) {
			Zotero_Preferences.openURL('http://zotero.org/support/zotero_data');
		}
		
		radiogroup.selectedIndex = useDataDir ? 1 : 0;
		return useDataDir;
	},
	
	
	getDataDirPath: function () {
		var desc = Zotero.Prefs.get('dataDir');
		if (desc == '') {
			return '';
		}
		
		var file = Components.classes["@mozilla.org/file/local;1"].
			createInstance(Components.interfaces.nsILocalFile);
		try {
			file.persistentDescriptor = desc;
		}
		catch (e) {
			return '';
		}
		return file.path;
	},
	
	
	populateOpenURLResolvers: function () {
		var openURLMenu = document.getElementById('openURLMenu');
		
		this._openURLResolvers = Zotero.OpenURL.discoverResolvers();
		var i = 0;
		for each(var r in this._openURLResolvers) {
			openURLMenu.insertItemAt(i, r.name);
			if (r.url == Zotero.Prefs.get('openURL.resolver') && r.version == Zotero.Prefs.get('openURL.version')) {
				openURLMenu.selectedIndex = i;
			}
			i++;
		}
		
		var button = document.getElementById('openURLSearchButton');
		switch (this._openURLResolvers.length) {
			case 0:
				var num = 'zero';
				break;
			case 1:
				var num = 'singular';
				break;
			default:
				var num = 'plural';
		}
		
		button.setAttribute('label', Zotero.getString('zotero.preferences.openurl.resolversFound.' + num, this._openURLResolvers.length));
	},
	
	
	onOpenURLSelected: function () {
		var openURLServerField = document.getElementById('openURLServerField');
		var openURLVersionMenu = document.getElementById('openURLVersionMenu');
		var openURLMenu = document.getElementById('openURLMenu');
		
		if(openURLMenu.value == "custom")
		{
			openURLServerField.focus();
		}
		else
		{
			openURLServerField.value = this._openURLResolvers[openURLMenu.selectedIndex]['url'];
			openURLVersionMenu.value = this._openURLResolvers[openURLMenu.selectedIndex]['version'];
			Zotero.Prefs.set("openURL.resolver", this._openURLResolvers[openURLMenu.selectedIndex]['url']);
			Zotero.Prefs.set("openURL.version", this._openURLResolvers[openURLMenu.selectedIndex]['version']);
		}
	},
	
	onOpenURLCustomized: function () {
		document.getElementById('openURLMenu').value = "custom";
	}
};


Zotero_Preferences.Attachment_Base_Directory = {
	choosePath: function () {
		// Get existing base directory
		var oldBasePath = Zotero.Prefs.get('baseAttachmentPath');
		if (oldBasePath) {
			var oldBasePathFile = Components.classes["@mozilla.org/file/local;1"]
				.createInstance(Components.interfaces.nsILocalFile);
			try {
				oldBasePathFile.persistentDescriptor = oldBasePath;
			}
			catch (e) {
				Zotero.debug(e, 1);
				Components.utils.reportError(e);
				oldBasePathFile = null;
			}
		}
		
		//Prompt user to choose new base path
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
					.createInstance(nsIFilePicker);
		if (oldBasePathFile) {
			fp.displayDirectory = oldBasePathFile;
		}
		fp.init(window, Zotero.getString('attachmentBasePath.selectDir'), nsIFilePicker.modeGetFolder);
		fp.appendFilters(nsIFilePicker.filterAll);
		if (fp.show() != nsIFilePicker.returnOK) {
			return false;
		}
		var newBasePathFile = fp.file;
		
		if (oldBasePathFile && oldBasePathFile.equals(newBasePathFile)) {
			Zotero.debug("Base directory hasn't changed");
			return false;
		}
		
		// Find all current attachments with relative attachment paths
		var sql = "SELECT itemID FROM itemAttachments WHERE linkMode=? AND path LIKE '"
			+ Zotero.Attachments.BASE_PATH_PLACEHOLDER  + "%'";
		var params = [Zotero.Attachments.LINK_MODE_LINKED_FILE];
		var oldRelativeAttachmentIDs = Zotero.DB.columnQuery(sql, params) || [];
		
		//Find all attachments on the new base path
		var sql = "SELECT itemID FROM itemAttachments WHERE linkMode=?";
		var params = [Zotero.Attachments.LINK_MODE_LINKED_FILE];
		var allAttachments = Zotero.DB.columnQuery(sql,params);
		var newAttachmentPaths = {};
		var numNewAttachments = 0;
		var numOldAttachments = 0;
		var attachmentFile = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		for (let i=0; i<allAttachments.length; i++) {
			let attachmentID = allAttachments[i];
			let relPath = false
			
			try {
				let attachment = Zotero.Items.get(attachmentID);
				// This will return FALSE for relative paths if base directory
				// isn't currently set
				attachmentFile = attachment.getFile(false, true);
				// Get existing relative path
				let path = attachment.attachmentPath;
				if (path.indexOf(Zotero.Attachments.BASE_PATH_PLACEHOLDER) == 0) {
					relPath = path.substr(Zotero.Attachments.BASE_PATH_PLACEHOLDER.length);
				}
			}
			catch (e) {
				// Don't deal with bad attachment paths. Just skip them.
				Zotero.debug(e, 2);
				continue;
			}
			
			// If a file with the same relative path exists within the new base directory,
			// don't touch the attachment, since it will continue to work
			if (relPath) {
				let relFile = Components.classes["@mozilla.org/file/local;1"]
					.createInstance(Components.interfaces.nsILocalFile);
				relFile.setRelativeDescriptor(newBasePathFile, relPath);
				if (relFile.exists()) {
					numNewAttachments++;
					continue;
				}
			}
			
			// Files within the new base directory need to be updated to use
			// relative paths (or, if the new base directory is an ancestor or
			// descendant of the old one, new relative paths)
			if (attachmentFile && Zotero.File.directoryContains(newBasePathFile, attachmentFile)) {
				newAttachmentPaths[attachmentID] = relPath
					? attachmentFile.persistentDescriptor : null;
				numNewAttachments++;
			}
			// Existing relative attachments not within the new base directory
			// will be converted to absolute paths
			else if (relPath && oldBasePathFile) {
				newAttachmentPaths[attachmentID] = attachmentFile.persistentDescriptor;
				numOldAttachments++;
			}
		}
		
		//Confirm change of the base path
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		
		var chooseStrPrefix = 'attachmentBasePath.chooseNewPath.';
		var clearStrPrefix = 'attachmentBasePath.clearBasePath.';
		var title = Zotero.getString(chooseStrPrefix + 'title');
		var msg1 = Zotero.getString(chooseStrPrefix + 'message') + "\n\n", msg2 = "", msg3 = "";
		switch (numNewAttachments) {
			case 0:
				break;
			
			case 1:
				msg2 += Zotero.getString(chooseStrPrefix + 'existingAttachments.singular') + " ";
				break;
			
			default:
				msg2 += Zotero.getString(chooseStrPrefix + 'existingAttachments.plural', numNewAttachments) + " ";
		}
		
		switch (numOldAttachments) {
			case 0:
				break;
			
			case 1:
				msg3 += Zotero.getString(clearStrPrefix + 'existingAttachments.singular');
				break;
			
			default:
				msg3 += Zotero.getString(clearStrPrefix + 'existingAttachments.plural', numOldAttachments);
		}
		
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		var index = ps.confirmEx(
			null,
			title,
			(msg1 + msg2 + msg3).trim(),
			buttonFlags,
			Zotero.getString(chooseStrPrefix + 'button'),
			null,
			null,
			null,
			{}
		);
		
		if (index == 1) {
			return false;
		}
		
		// Set new data directory
		Zotero.debug("Setting new base directory");
		Zotero.Prefs.set('baseAttachmentPath', newBasePathFile.persistentDescriptor);
		Zotero.Prefs.set('saveRelativeAttachmentPath', true);
		// Resave all attachments on base path (so that their paths become relative)
		// and all other relative attachments (so that their paths become absolute)
		for (let id in newAttachmentPaths) {
			let attachment = Zotero.Items.get(id);
			if (newAttachmentPaths[id]) {
				attachment.attachmentPath = newAttachmentPaths[id];
				attachment.save({
					skipDateModifiedUpdate: true
				});
			}
			else {
				attachment.updateAttachmentPath();
			}
		}
		return newBasePathFile.persistentDescriptor;
	},
	
	
	getPath: function (asFile) {
		var desc = Zotero.Prefs.get('baseAttachmentPath');
		if (desc == '') {
			return asFile ? null : '';
		}
		
		var file = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		try {
			file.persistentDescriptor = desc;
		}
		catch (e) {
			return asFile ? null : '';
		}
		return asFile ? file : file.path;
	},
	
	
	clearPath: function () {
		// Find all current attachments with relative paths
		var sql = "SELECT itemID FROM itemAttachments WHERE linkMode=? AND path LIKE '"
			+ Zotero.Attachments.BASE_PATH_PLACEHOLDER  + "%'";
		var params = [Zotero.Attachments.LINK_MODE_LINKED_FILE];
		var relativeAttachmentIDs = Zotero.DB.columnQuery(sql, params) || [];
		
		// Prompt for confirmation
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		
		var strPrefix = 'attachmentBasePath.clearBasePath.';
		var title = Zotero.getString(strPrefix + 'title');
		var msg = Zotero.getString(strPrefix + 'message');
		switch (relativeAttachmentIDs.length) {
			case 0:
				break;
			
			case 1:
				msg += "\n\n" + Zotero.getString(strPrefix + 'existingAttachments.singular');
				break;
			
			default:
				msg += "\n\n" + Zotero.getString(strPrefix + 'existingAttachments.plural',
					relativeAttachmentIDs.length);
		}
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		var index = ps.confirmEx(
			window,
			title,
			msg,
			buttonFlags,
			Zotero.getString(strPrefix + 'button'),
			null,
			null,
			null,
			{}
		);
		
		if (index == 1) {
			return false;
		}
		
		// Disable relative path saving and then resave all relative
		// attachments so that their absolute paths are stored
		Zotero.debug('Clearing base directory');
		Zotero.Prefs.set('saveRelativeAttachmentPath', false);
		for (var i=0; i<relativeAttachmentIDs.length; i++) {
			Zotero.Items.get(relativeAttachmentIDs[i]).updateAttachmentPath();
		}
		Zotero.Prefs.set('baseAttachmentPath', '');
	},
	
	
	updateUI: function () {
		var filefield = document.getElementById('baseAttachmentPath');
		var file = this.getPath(true);
		filefield.file = file;
		if (file) {
			filefield.label = file.path;
		}
		else {
			filefield.label = '';
		}
		
		document.getElementById('resetBasePath').disabled = !Zotero.Prefs.get('baseAttachmentPath');
	}
};


Zotero_Preferences.Debug_Output = {
	_timer: null,
	
	init: function () {
		var storing = Zotero.Debug.storing;
		this._updateButton();
		this.updateLines();
		if (storing) {
			this._initTimer();
		}
	},
	
	
	toggleStore: function () {
		this.setStore(!Zotero.Debug.storing);
	},
	
	
	setStore: function (set) {
		Zotero.Debug.setStore(set);
		if (set) {
			this._initTimer();
		}
		else {
			if (this._timerID) {
				this._timer.cancel();
				this._timerID = null;
			}
		}
		this._updateButton();
		this.updateLines();
	},
	
	
	view: function () {
		Zotero_Preferences.openInViewer("zotero://debug/");
	},
	
	
	submit: function () {
		document.getElementById('debug-output-submit').disabled = true;
		document.getElementById('debug-output-submit-progress').hidden = false;
		
		Components.utils.import("resource://zotero/config.js");
		
		var url = ZOTERO_CONFIG.REPOSITORY_URL + "report?debug=1";
		var output = Zotero.Debug.get(
			Zotero.Prefs.get('debug.store.submitSize'),
			Zotero.Prefs.get('debug.store.submitLineLength')
		);
		Zotero_Preferences.Debug_Output.setStore(false);
		
		var uploadCallback = function (xmlhttp) {
			document.getElementById('debug-output-submit').disabled = false;
			document.getElementById('debug-output-submit-progress').hidden = true;
			
			Zotero.debug(xmlhttp.responseText);
			
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
			
			if (!xmlhttp.responseXML) {
				ps.alert(
					null,
					Zotero.getString('general.error'),
					Zotero.getString('general.invalidResponseServer')
				);
				return;
			}
			var reported = xmlhttp.responseXML.getElementsByTagName('reported');
			if (reported.length != 1) {
				ps.alert(
					null,
					Zotero.getString('general.error'),
					Zotero.getString('general.serverError')
				);
				return;
			}
			
			var reportID = reported[0].getAttribute('reportID');
			ps.alert(
				null,
				Zotero.getString('zotero.preferences.advanced.debug.title'),
				Zotero.getString('zotero.preferences.advanced.debug.sent', reportID)
			);
		}
		
		var bufferUploader = function (data) {
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
			
			var oldLen = output.length;
			var newLen = data.length;
			var savings = Math.round(((oldLen - newLen) / oldLen) * 100)
			Zotero.debug("HTTP POST " + newLen + " bytes to " + url
				+ " (gzipped from " + oldLen + " bytes; "
				+ savings + "% savings)");
			
			if (Zotero.HTTP.browserIsOffline()) {
				ps.alert(
					null,
					Zotero.getString('general.error'),
					Zotero.getString('general.browserIsOffline', Zotero.appName)
				);
				return false;
			}
			
			var req =
				Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
					createInstance();
			req.open('POST', url, true);
			req.setRequestHeader('Content-Type', "text/plain");
			req.setRequestHeader('Content-Encoding', 'gzip');
			
			req.channel.notificationCallbacks = {
				onProgress: function (request, context, progress, progressMax) {
					var pm = document.getElementById('debug-output-submit-progress');
					pm.mode = 'determined'
					pm.value = progress;
					pm.max = progressMax;
				},
				
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
			req.onreadystatechange = function () {
				if (req.readyState == 4) {
					uploadCallback(req);
				}
			};
			try {
				// Send binary data
				let numBytes = data.length, ui8Data = new Uint8Array(numBytes);
				for (let i = 0; i < numBytes; i++) {
					ui8Data[i] = data.charCodeAt(i) & 0xff;
				}
				req.send(ui8Data);
			}
			catch (e) {
				Zotero.debug(e, 1);
				Components.utils.reportError(e);
				ps.alert(
					null,
					Zotero.getString('general.error'),
					Zotero.getString('zotero.preferences.advanced.debug.error')
				);
			}
		}
		
		// Get input stream from debug output data
		var unicodeConverter =
			Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
				.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
		unicodeConverter.charset = "UTF-8";
		var bodyStream = unicodeConverter.convertToInputStream(output);
		
		// Get listener for when compression is done
		var listener = new Zotero.BufferedInputListener(bufferUploader);
		
		// Initialize stream converter
		var converter =
			Components.classes["@mozilla.org/streamconv;1?from=uncompressed&to=gzip"]
				.createInstance(Components.interfaces.nsIStreamConverter);
		converter.asyncConvertData("uncompressed", "gzip", listener, null);
		
		// Send input stream to stream converter
		var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"].
				createInstance(Components.interfaces.nsIInputStreamPump);
		pump.init(bodyStream, -1, -1, 0, 0, true);
		pump.asyncRead(converter, null);
	},
	
	
	clear: function () {
		Zotero.Debug.clear();
		this.updateLines();
	},
	
	
	updateLines: function () {
		var enabled = Zotero.Debug.storing;
		var lines = Zotero.Debug.count();
		document.getElementById('debug-output-lines').value = lines;
		var empty = lines == 0;
		document.getElementById('debug-output-view').disabled = !enabled && empty;
		document.getElementById('debug-output-clear').disabled = empty;
		document.getElementById('debug-output-submit').disabled = empty;
	},
	
	
	_initTimer: function () {
		this._timer = Components.classes["@mozilla.org/timer;1"].
			createInstance(Components.interfaces.nsITimer);
		this._timer.initWithCallback({
			notify: function() {
				Zotero_Preferences.Debug_Output.updateLines();
			}
		}, 10000, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
	},
	
	
	_updateButton: function () {
		var storing = Zotero.Debug.storing
		
		var button = document.getElementById('debug-output-enable');
		if (storing) {
			button.label = Zotero.getString('general.disable');
		}
		else {
			button.label = Zotero.getString('general.enable');
		}
	},
	
	
	onUnload: function () {
		if (this._timer) {
			this._timer.cancel();
		}
	}
};


Zotero_Preferences.Keys = {
	init: function () {
		var rows = document.getElementById('zotero-prefpane-advanced-keys-tab').getElementsByTagName('row');
		for (var i=0; i<rows.length; i++) {
			// Display the appropriate modifier keys for the platform
			rows[i].firstChild.nextSibling.value = Zotero.isMac ? Zotero.getString('general.keys.cmdShift') : Zotero.getString('general.keys.ctrlShift');
		}
		
		var textboxes = document.getElementById('zotero-keys-rows').getElementsByTagName('textbox');
		for (let i=0; i<textboxes.length; i++) {
			let textbox = textboxes[i];
			textbox.value = textbox.value.toUpperCase();
			// .value takes care of the initial value, and this takes care of direct pref changes
			// while the window is open
			textbox.setAttribute('onsyncfrompreference', 'return Zotero_Preferences.Keys.capitalizePref(this.id)');
			textbox.setAttribute('oninput', 'this.value = this.value.toUpperCase()');
		}
	},
	
	
	capitalizePref: function (id) {
		var elem = document.getElementById(id);
		var pref = document.getElementById(elem.getAttribute('preference'));
		if (pref.value) {
			return pref.value.toUpperCase();
		}
	}
};
