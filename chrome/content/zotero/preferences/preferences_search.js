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
		var url = Zotero.Fulltext.pdfToolsDownloadBaseURL + 'latest.json';
		
		// Find latest version for this platform
		var self = this;
		var sent = Zotero.HTTP.doGet(url, function (xmlhttp) {
			try {
				if (xmlhttp.status != 200) {
					throw new Error("Unexpected response code " + xmlhttp.status);
				}
				
				var platform = Zotero.platform.replace(/\s/g, '-');
				var json = JSON.parse(xmlhttp.responseText);
				var latestVersion = json[platform] || json['default'];
				
				Zotero.debug("Latest PDF tools version for " + platform + " is " + latestVersion);
				
				var converterIsRegistered = Zotero.Fulltext.pdfConverterIsRegistered();
				var infoIsRegistered = Zotero.Fulltext.pdfInfoIsRegistered();
				var bothRegistered = converterIsRegistered && infoIsRegistered;
				
				// On Windows, install if not installed or anything other than 3.02a
				if (Zotero.isWin) {
					var converterVersionAvailable = !converterIsRegistered
						|| Zotero.Fulltext.pdfConverterVersion != '3.02a';
					var infoVersionAvailable = !infoIsRegistered
						|| Zotero.Fulltext.pdfInfoVersion != '3.02a';
					var bothAvailable = converterVersionAvailable && infoVersionAvailable;
					latestVersion = "3.02a";
				}
				// Install if not installed, version unknown, outdated, or
				// Xpdf 3.02/3.04 (to upgrade to Poppler),
				else {
					var converterVersionAvailable = (!converterIsRegistered ||
							Zotero.Fulltext.pdfConverterVersion == 'UNKNOWN'
								|| latestVersion > Zotero.Fulltext.pdfConverterVersion
								|| (!latestVersion.startsWith('3.02')
									&& Zotero.Fulltext.pdfConverterVersion.startsWith('3.02'))
								|| (!latestVersion.startsWith('3.02') && latestVersion != '3.04'
									&& Zotero.Fulltext.pdfConverterVersion == '3.04'));
					var infoVersionAvailable = (!infoIsRegistered ||
							Zotero.Fulltext.pdfInfoVersion == 'UNKNOWN'
								|| latestVersion > Zotero.Fulltext.pdfInfoVersion
								|| (!latestVersion.startsWith('3.02')
									&& Zotero.Fulltext.pdfInfoVersion.startsWith('3.02'))
								|| (!latestVersion.startsWith('3.02') && latestVersion != '3.04'
									&& Zotero.Fulltext.pdfInfoVersion == '3.04'));
					var bothAvailable = converterVersionAvailable && infoVersionAvailable;
				}
				
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
							[Zotero.Fulltext.pdfConverterName, latestVersion]);
						msg += '- ' + tvp + '\n';
					}
					if (infoVersionAvailable) {
						let tvp = Zotero.getString('zotero.preferences.search.pdf.toolVersionPlatform',
							[Zotero.Fulltext.pdfInfoName, latestVersion]);
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
						document.getElementById('pdftools-update-button').disabled = true;
						var str = Zotero.getString('zotero.preferences.search.pdf.downloading');
						document.getElementById('pdftools-update-button').setAttribute('label', str);
						
						if (converterVersionAvailable && infoVersionAvailable) {
							Zotero.Fulltext.downloadPDFTool('converter', latestVersion, function (success) {
								if (!success) {
									self.onPDFToolsDownloadError("Error downloading pdftotext");
									return;
								}
								Zotero.Fulltext.downloadPDFTool('info', latestVersion, function (success) {
									if (!success) {
										self.onPDFToolsDownloadError("Error downloading pdfinfo");
										return;
									}
									self.updatePDFToolsStatus();
								});
							});
						}
						else if (converterVersionAvailable) {
							Zotero.Fulltext.downloadPDFTool('converter', latestVersion, function (success) {
								if (!success) {
									self.onPDFToolsDownloadError("Error downloading pdftotext");
									return;
								}
								self.updatePDFToolsStatus();
							});
						}
						else {
							Zotero.Fulltext.downloadPDFTool('info', latestVersion, function (success) {
								if (!success) {
									self.onPDFToolsDownloadError("Error downloading pdfinfo");
									return;
								}
								self.updatePDFToolsStatus();
							});
						}
					}
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
