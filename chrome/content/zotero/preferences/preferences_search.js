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

Zotero_Preferences.Search = {
	init: function () {
		document.getElementById('fulltext-rebuildIndex').setAttribute('label',
			Zotero.getString('zotero.preferences.search.rebuildIndex')
				+ Zotero.getString('punctuation.ellipsis'));
		document.getElementById('fulltext-clearIndex').setAttribute('label',
			Zotero.getString('zotero.preferences.search.clearIndex')
				+ Zotero.getString('punctuation.ellipsis'));
		this.updatePDFToolsStatus();
		
		this.updateIndexStats();
		
		// Quick hack to support install prompt from PDF recognize option
		var io = window.arguments[0];
		if (io.action && io.action == 'pdftools-install') {
			this.checkPDFToolsDownloadVersion();
		}
	},
	
	/*
	 * Update window according to installation status for PDF tools
	 *  (e.g. status line, install/update button, etc.)
	 */
	updatePDFToolsStatus: function () {
		var converterIsRegistered = Zotero.Fulltext.pdfConverterIsRegistered();
		var infoIsRegistered = Zotero.Fulltext.pdfInfoIsRegistered();
		
		var converterStatusLabel = document.getElementById('pdfconverter-status');
		var infoStatusLabel = document.getElementById('pdfinfo-status');
		var requiredLabel = document.getElementById('pdftools-required');
		var updateButton = document.getElementById('pdftools-update-button');
		var documentationLink = document.getElementById('pdftools-documentation-link');
		var settingsBox = document.getElementById('pdftools-settings');
		
		// If we haven't already generated the required and documentation messages
		if (!converterIsRegistered && !requiredLabel.hasChildNodes()) {
			
			// Xpdf link
			var str = Zotero.getString('zotero.preferences.search.pdf.toolsRequired',
				[Zotero.Fulltext.pdfConverterName, Zotero.Fulltext.pdfInfoName,
				'<a href="' + Zotero.Fulltext.pdfToolsURL + '">'
				+ Zotero.Fulltext.pdfToolsName + '</a>']);
			var parts = Zotero.Utilities.parseMarkup(str);
			for (var i=0; i<parts.length; i++) {
				var part = parts[i];
				if (part.type == 'text') {
					var elem = document.createTextNode(part.text);
				}
				else if (part.type == 'link') {
					var elem = document.createElement('label');
					elem.setAttribute('value', part.text);
					elem.setAttribute('class', 'zotero-text-link');
					for (var key in part.attributes) {
						elem.setAttribute(key, part.attributes[key]);
						
						if (key == 'href') {
							elem.setAttribute('tooltiptext', part.attributes[key]);
						}
					}
				}
				requiredLabel.appendChild(elem);
			}
			
			requiredLabel.appendChild(document.createTextNode(' '
				+ Zotero.getString('zotero.preferences.search.pdf.automaticInstall')));
			
			// Documentation link
			var link = '<a href="http://www.zotero.org/documentation/pdf_fulltext_indexing">'
				+ Zotero.getString('zotero.preferences.search.pdf.documentationLink')
				+ '</a>';
			var str = Zotero.getString('zotero.preferences.search.pdf.advancedUsers', link);
			var parts = Zotero.Utilities.parseMarkup(str);
			
			for (var i=0; i<parts.length; i++) {
				var part = parts[i];
				if (part.type == 'text') {
					var elem = document.createTextNode(part.text);
				}
				else if (part.type == 'link') {
					var elem = document.createElement('label');
					elem.setAttribute('value', part.text);
					elem.setAttribute('class', 'zotero-text-link');
					for (var key in part.attributes) {
						elem.setAttribute(key, part.attributes[key]);
						
						if (key == 'href') {
							elem.setAttribute('tooltiptext', part.attributes[key]);
						}
					}
				}
				documentationLink.appendChild(elem);
			}
		}
		
		// converter status line
		var prefix = 'zotero.preferences.search.pdf.tool';
		if (converterIsRegistered) {
			var version = Zotero.Fulltext.pdfConverterVersion;
			str = Zotero.getString(prefix + 'Registered',
				Zotero.getString('zotero.preferences.search.pdf.toolVersionPlatform',
					[Zotero.Fulltext.pdfConverterName, version]));
		}
		else {
			str = Zotero.getString(prefix + 'NotRegistered',
				[Zotero.Fulltext.pdfConverterFileName]);
		}
		converterStatusLabel.setAttribute('value', str);
		
		// pdfinfo status line
		if (infoIsRegistered) {
			var version = Zotero.Fulltext.pdfInfoVersion;
			str = Zotero.getString(prefix + 'Registered',
				Zotero.getString('zotero.preferences.search.pdf.toolVersionPlatform',
					[Zotero.Fulltext.pdfInfoName, version]));
		}
		else {
			str = Zotero.getString(prefix + 'NotRegistered',
				[Zotero.Fulltext.pdfInfoFileName]);
		}
		infoStatusLabel.setAttribute('value', str);
		
		str = converterIsRegistered ?
			Zotero.getString('general.checkForUpdate') :
			Zotero.getString('zotero.preferences.search.pdf.checkForInstaller');
		updateButton.setAttribute('label', str);
		
		requiredLabel.setAttribute('hidden', converterIsRegistered);
		documentationLink.setAttribute('hidden', converterIsRegistered);
		settingsBox.setAttribute('hidden', !converterIsRegistered);
	},
	
	
	/*
	 * Check available versions of PDF tools from server and prompt for installation
	 * if a newer version is available
	 */
	checkPDFToolsDownloadVersion: function () {
		var url = Zotero.Fulltext.pdfToolsDownloadBaseURL
					+ Zotero.platform.replace(' ', '-') + '.latest';
		
		// Find latest version for this platform
		var self = this;
		var sent = Zotero.HTTP.doGet(url, function (xmlhttp) {
			try {
				if (xmlhttp.status == 200) {
					var converterIsRegistered = Zotero.Fulltext.pdfConverterIsRegistered();
					var infoIsRegistered = Zotero.Fulltext.pdfInfoIsRegistered();
					var bothRegistered = converterIsRegistered && infoIsRegistered;
					
					var converterVersion = xmlhttp.responseText.split(/\s/)[0];
					var infoVersion = xmlhttp.responseText.split(/\s/)[1];
					
					var converterVersionAvailable = converterVersion &&
						(!converterIsRegistered ||
							Zotero.Fulltext.pdfConverterVersion == 'UNKNOWN' ||
							converterVersion > Zotero.Fulltext.pdfConverterVersion);
					var infoVersionAvailable = infoVersion &&
						(!infoIsRegistered ||
							Zotero.Fulltext.pdfInfoVersion == 'UNKNOWN' ||
							infoVersion > Zotero.Fulltext.pdfInfoVersion);
					var bothAvailable = converterVersionAvailable && infoVersionAvailable;
					
					/*
					Zotero.debug(converterIsRegistered);
					Zotero.debug(infoIsRegistered);
					Zotero.debug(converterVersion);
					Zotero.debug(infoVersion);
					Zotero.debug(Zotero.Fulltext.pdfConverterVersion);
					Zotero.debug(Zotero.Fulltext.pdfInfoVersion);
					Zotero.debug(converterVersionAvailable);
					Zotero.debug(infoVersionAvailable);
					*/
					
					// Up to date -- disable update button
					if (!converterVersionAvailable && !infoVersionAvailable) {
						var button = document.getElementById('pdftools-update-button');
						button.setAttribute('label', Zotero.getString('zotero.preferences.update.upToDate'));
						button.setAttribute('disabled', true);
					}
					// New version available -- display update prompt
					else {
						var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
								createInstance(Components.interfaces.nsIPromptService);
						var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
							+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
						
						var msg = Zotero.getString('zotero.preferences.search.pdf.available'
							+ ((converterIsRegistered || infoIsRegistered) ? 'Updates' : 'Downloads'),
							[Zotero.platform, 'zotero.org']) + '\n\n';
						
						if (converterVersionAvailable) {
							let tvp = Zotero.getString('zotero.preferences.search.pdf.toolVersionPlatform',
								[Zotero.Fulltext.pdfConverterName, converterVersion]);
							msg += '- ' + tvp + '\n';
						}
						if (infoVersionAvailable) {
							let tvp = Zotero.getString('zotero.preferences.search.pdf.toolVersionPlatform',
								[Zotero.Fulltext.pdfInfoName, infoVersion]);
							msg += '- ' + tvp + '\n';
						}
						msg += '\n';
						msg += Zotero.getString('zotero.preferences.search.pdf.zoteroCanInstallVersion'
								+ (bothAvailable ? 's' : ''));
						
						var index = ps.confirmEx(null,
							converterIsRegistered ?
								Zotero.getString('general.updateAvailable') : '',
							msg,
							buttonFlags,
							converterIsRegistered ?
								Zotero.getString('general.upgrade') :
								Zotero.getString('general.install'),
							null, null, null, {});
						
						if (index == 0) {
							var installVersions = {
								converter: converterVersionAvailable ?
									converterVersion : null,
								info: infoVersionAvailable ?
									infoVersion : null
							};
							self.installPDFTools(installVersions);
						}
					}
				}
				// Version not found for platform
				else if (xmlhttp.status == 404) {
					self.onPDFToolsDownloadError(404);
				}
			}
			catch (e) {
				self.onPDFToolsDownloadError(e);
			}
		});
		
		// Browser is offline
		if (!sent) {
			this.onPDFToolsDownloadError();
		}
	},
	
	
	/*
	 * Begin installation of specified PDF tools from server -- does a HEAD call to
	 * make sure file exists and then calls downloadPDFTool() if so
	 */
	installPDFTools: function (installVersions) {
		if (!installVersions) {
			installVersions = {
				converter: true,
				info: true
			};
		}
		
		// We install the converter first if it's available
		var url = Zotero.Fulltext.pdfToolsDownloadBaseURL;
		if (installVersions.converter) {
			var tool = 'converter';
			var version = installVersions.converter;
			url += Zotero.Fulltext.pdfConverterFileName + '-' + installVersions.converter;
		}
		else if (installVersions.info) {
			var tool = 'info';
			var version = installVersions.info;
			url += Zotero.Fulltext.pdfInfoFileName + '-' + installVersions.info;
		}
		else {
			return; 
		}
		
		// Find latest version for this platform
		var self = this;
		var sent = Zotero.HTTP.doHead(url, function (xmlhttp) {
			try {
				if (xmlhttp.status == 200) {
					// If doing both and on converter, chain pdfinfo
					if (installVersions.converter && installVersions.info) {
						self.downloadPDFTool(tool, version, function () {
							return self.installPDFTools({ info: installVersions.info });
						});
					}
					else {
						self.downloadPDFTool(tool, version);
					}
				}
				// Version not found for platform
				else if (xmlhttp.status == 404) {
					self.onPDFToolsDownloadError(404);
				}
			}
			catch (e) {
				self.onPDFToolsDownloadError(e);
			}
		});
		
		// Browser is offline
		if (!sent) {
			self.onPDFToolsDownloadError();
		}
	},
	
	
	/*
	 * Download and install specified PDF tool
	 */
	downloadPDFTool: function (tool, version, callback) {
		var ioService = Components.classes["@mozilla.org/network/io-service;1"]
							.getService(Components.interfaces.nsIIOService);
		
		if (tool == 'converter') {
			var fileName = Zotero.Fulltext.pdfConverterFileName; 
		}
		else {
			var fileName = Zotero.Fulltext.pdfInfoFileName;
		}
		
		
		var url = Zotero.Fulltext.pdfToolsDownloadBaseURL + fileName + '-' + version;
		var uri = ioService.newURI(url, null, null);
		
		var file = Zotero.getZoteroDirectory();
		file.append(fileName);
		var fileURL = ioService.newFileURI(file);
		
		const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
		var wbp = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
					.createInstance(nsIWBP);
		
		var self = this;
		var progressListener = new Zotero.WebProgressFinishListener(function () {
			// Set permissions to 755
			if (Zotero.isMac) {
				file.permissions = 33261;
			}
			else if (Zotero.isLinux) {
				file.permissions = 493;
			}
			
			// Write the version number to a file
			var versionFile = Zotero.getZoteroDirectory();
			versionFile.append(fileName + '.version');
			Zotero.File.putContents(versionFile, version + '');
			
			Zotero.Fulltext.registerPDFTool(tool);
			
			// Used to install info tool after converter
			if (callback) {
				callback();
			}
			// If done
			else {
				self.updatePDFToolsStatus();
			}
		});
		
		/*
		var tr = Components.classes["@mozilla.org/transfer;1"].
			createInstance(Components.interfaces.nsITransfer);
		tr.init(uri, fileURL, "", null, null, null, wbp);
		*/
		
		document.getElementById('pdftools-update-button').disabled = true;
		var str = Zotero.getString('zotero.preferences.search.pdf.downloading');
		document.getElementById('pdftools-update-button').setAttribute('label', str);
		
		wbp.progressListener = progressListener;
		Zotero.debug("Saving " + uri.spec + " to " + fileURL.spec);
		Zotero.Utilities.Internal.saveURI(wbp, uri, fileURL);
	},
	
	
	onPDFToolsDownloadError: function (e) {
		if (e == 404) {
			var str = Zotero.getString('zotero.preferences.search.pdf.toolDownloadsNotAvailable',
				Zotero.Fulltext.pdfToolsName) + ' '
				+ Zotero.getString('zotero.preferences.search.pdf.viewManualInstructions');
		}
		else if (e) {
			Components.utils.reportError(e);
			var str = Zotero.getString('zotero.preferences.search.pdf.toolsDownloadError', Zotero.Fulltext.pdfToolsName)
				+ ' ' + Zotero.getString('zotero.preferences.search.pdf.tryAgainOrViewManualInstructions');
		}
		else {
			var info = Components.classes["@mozilla.org/xre/app-info;1"]
						 .getService(Components.interfaces.nsIXULAppInfo);
			var browser = info.name; // Returns "Firefox" for Firefox
			var str = Zotero.getString('general.browserIsOffline', browser);
		}
		
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.createInstance(Components.interfaces.nsIPromptService);
		ps.alert(
			null,
			Zotero.getString('pane.item.attachments.PDF.installTools.title'),
			str
		);
	},
	
	
	updateIndexStats: function () {
		var stats = Zotero.Fulltext.getIndexStats();
		document.getElementById('fulltext-stats-indexed').
			lastChild.setAttribute('value', stats.indexed);
		document.getElementById('fulltext-stats-partial').
			lastChild.setAttribute('value', stats.partial);
		document.getElementById('fulltext-stats-unindexed').
			lastChild.setAttribute('value', stats.unindexed);
		document.getElementById('fulltext-stats-words').
			lastChild.setAttribute('value', stats.words);
	},
	
	
	rebuildIndexPrompt: function () {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
				createInstance(Components.interfaces.nsIPromptService);
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
			+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_IS_STRING);
		
		var index = ps.confirmEx(null,
			Zotero.getString('zotero.preferences.search.rebuildIndex'),
			Zotero.getString('zotero.preferences.search.rebuildWarning',
				Zotero.getString('zotero.preferences.search.indexUnindexed')),
			buttonFlags,
			Zotero.getString('zotero.preferences.search.rebuildIndex'),
			null,
			// Position 2 because of https://bugzilla.mozilla.org/show_bug.cgi?id=345067
			Zotero.getString('zotero.preferences.search.indexUnindexed'),
			null, {});
		
		if (index == 0) {
			Zotero.Fulltext.rebuildIndex();
		}
		else if (index == 2) {
			Zotero.Fulltext.rebuildIndex(true)
		}
		
		this.updateIndexStats();
	},
	
	
	clearIndexPrompt: function () {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
				createInstance(Components.interfaces.nsIPromptService);
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
			+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_IS_STRING);
		
		var index = ps.confirmEx(null,
			Zotero.getString('zotero.preferences.search.clearIndex'),
			Zotero.getString('zotero.preferences.search.clearWarning',
				Zotero.getString('zotero.preferences.search.clearNonLinkedURLs')),
			buttonFlags,
			Zotero.getString('zotero.preferences.search.clearIndex'),
			null,
			// Position 2 because of https://bugzilla.mozilla.org/show_bug.cgi?id=345067
			Zotero.getString('zotero.preferences.search.clearNonLinkedURLs'), null, {});
		
		if (index == 0) {
			Zotero.Fulltext.clearIndex();
		}
		else if (index == 2) {
			Zotero.Fulltext.clearIndex(true);
		}
		
		this.updateIndexStats();
	}
};
