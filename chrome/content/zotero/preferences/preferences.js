/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/

var openURLServerField;
var openURLVersionMenu;
var proxies;
var charsets;

function init()
{
	// Display the appropriate modifier keys for the platform
	var rows = document.getElementById('zotero-prefpane-keys').getElementsByTagName('row');
	for (var i=0; i<rows.length; i++) {
		rows[i].firstChild.nextSibling.value = Zotero.isMac ? 'Cmd+Shift+' : 'Ctrl+Alt+';
	}
	
	updateStorageSettings();
	refreshStylesList();
	refreshProxyList();
	populateQuickCopyList();
	updateQuickCopyInstructions();
	initSearchPane();
	
	var charsetMenu = document.getElementById("zotero-import-charsetMenu");
	var charsetMap = Zotero_Charset_Menu.populate(charsetMenu, false);
	charsetMenu.selectedItem =
		charsetMap[Zotero.Prefs.get("import.charset")] ?
			charsetMap[Zotero.Prefs.get("import.charset")] : charsetMap["auto"];
}


function onDataDirLoad() {
	var path = document.getElementById('dataDirPath');
	var useDataDir = Zotero.Prefs.get('useDataDir');
	path.setAttribute('disabled', !useDataDir);
}


function onDataDirUpdate(event) {
	var radiogroup = document.getElementById('dataDir');
	var path = document.getElementById('dataDirPath');
	var useDataDir = Zotero.Prefs.get('useDataDir');
	
	// If triggered from the Choose button, don't show the dialog, since
	// Zotero.chooseZoteroDirectory() shows its own
	if (event.originalTarget && event.originalTarget.tagName == 'button') {
		return true;
	}
	// If directory not set or invalid, prompt for location
	if (!getDataDirPath()) {
		event.stopPropagation();
		var file = Zotero.chooseZoteroDirectory(true);
		radiogroup.selectedIndex = file ? 1 : 0;
		return !!file;
	}
	
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Components.interfaces.nsIPromptService);
	
	var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
	var index = ps.confirmEx(window,
		Zotero.getString('general.restartRequired'),
		Zotero.getString('general.restartRequiredForChange'),
		buttonFlags,
		Zotero.getString('general.restartNow'),
		null, null, null, {});
	
	if (index == 0) {
		useDataDir = !!radiogroup.selectedIndex;
		// quit() is asynchronous, but set this here just in case
		Zotero.Prefs.set('useDataDir', useDataDir);
		var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
				.getService(Components.interfaces.nsIAppStartup);
		appStartup.quit(Components.interfaces.nsIAppStartup.eRestart);
		appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
	}
	
	radiogroup.selectedIndex = useDataDir ? 1 : 0;
	return useDataDir;
}


function getDataDirPath() {
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
}


function populateOpenURLResolvers() {
	var openURLMenu = document.getElementById('openURLMenu');
	
	var openURLResolvers = Zotero.OpenURL.discoverResolvers();
	for each(var r in openURLResolvers) {
		openURLMenu.insertItemAt(i, r.name);
		if (r.url == Zotero.Prefs.get('openURL.resolver') && r.version == Zotero.Prefs.get('openURL.version')) {
			openURLMenu.selectedIndex = i;
		}
	}
	
	var button = document.getElementById('openURLSearchButton');
	switch (openURLResolvers.length) {
		case 0:
			var num = 'zero';
			break;
		case 1:
			var num = 'singular';
			break;
		default:
			var num = 'plural';
	}
	
	button.setAttribute('label', Zotero.getString('zotero.preferences.openurl.resolversFound.' + num, openURLResolvers.length));
}


//
// Sync
//
/*
function updateSyncStatus() {
	var disabled = !Zotero.Sync.Server.enabled;
	
	var radioGroup = document.getElementById('zotero-reset').firstChild;
	radioGroup.disabled = disabled;
	var labels = radioGroup.getElementsByTagName('label');
	for each(var label in labels) {
		label.disabled = disabled;
	}
	var labels = radioGroup.getElementsByTagName('description');
	for each(var label in labels) {
		label.disabled = disabled;
	}
	document.getElementById('zotero-reset-button').disabled = disabled;
}
*/

function updateStorageSettings(value) {
	if (!value) {
		value = document.getElementById('pref-storage-protocol').value;
	}
	var prefix = document.getElementById('storage-url-prefix');
	switch (value) {
		case 'webdav':
			prefix.value = 'http://';
			break;
		
		case 'webdavs':
			prefix.value = 'https://';
			break;
	}
	unverifyStorageServer();
}

function unverifyStorageServer() {
	Zotero.Sync.Storage.clearSettingsCache();
	Zotero.Prefs.set('sync.storage.verified', false);
}

function verifyStorageServer() {
	Zotero.debug("Verifying storage");
	
	var verifyButton = document.getElementById("storage-verify");
	var abortButton = document.getElementById("storage-abort");
	var progressMeter = document.getElementById("storage-progress");
	var urlField = document.getElementById("storage-url");
	var usernameField = document.getElementById("storage-username");
	var passwordField = document.getElementById("storage-password");
	
	var callback = function (uri, status, authRequired) {
		verifyButton.hidden = false;
		abortButton.hidden = true;
		progressMeter.hidden = true;
		
		switch (status) {
			case Zotero.Sync.Storage.ERROR_NO_URL:
				setTimeout(function () {
					urlField.focus();
				}, 1);
				break;
			
			case Zotero.Sync.Storage.ERROR_NO_USERNAME:
				setTimeout(function () {
					usernameField.focus();
				}, 1);
				break;
			
			case Zotero.Sync.Storage.ERROR_NO_PASSWORD:
				setTimeout(function () {
					passwordField.focus();
				}, 1);
				break;
		}
		
		Zotero.Sync.Storage.checkServerCallback(uri, status, authRequired, window);
	}
	
	verifyButton.hidden = true;
	abortButton.hidden = false;
	progressMeter.hidden = false;
	var requestHolder = Zotero.Sync.Storage.checkServer(callback);
	abortButton.onclick = function () {
		if (requestHolder.request) {
			requestHolder.request.onreadystatechange = undefined;
			requestHolder.request.abort();
			verifyButton.hidden = false;
			abortButton.hidden = true;
			progressMeter.hidden = true;
		}
	}
}

function handleSyncResetSelect(obj) {
	var index = obj.selectedIndex;
	var rows = obj.getElementsByTagName('row');
	
	for (var i=0; i<rows.length; i++) {
		if (i == index) {
			rows[i].setAttribute('selected', 'true');
		}
		else {
			rows[i].removeAttribute('selected');
		}
	}
}

function handleSyncReset(action) {
	var pr = Components.classes["@mozilla.org/network/default-prompt;1"]
				.getService(Components.interfaces.nsIPrompt);
	
	if (!Zotero.Sync.Server.enabled) {
		pr.alert(
			Zotero.getString('general.error'),
			// TODO: localize
			"You must enter a username and password in the "
				+ document.getElementById('zotero-prefpane-sync')
					.getElementsByTagName('tab')[0].label
				+ " tab before using the reset options."
		);
		return;
	}
	
	var account = Zotero.Sync.Server.username;
	
	switch (action) {
		case 'restore-from-server':
			var buttonFlags = (pr.BUTTON_POS_0) * (pr.BUTTON_TITLE_IS_STRING)
								+ (pr.BUTTON_POS_1) * (pr.BUTTON_TITLE_CANCEL)
								+ pr.BUTTON_POS_1_DEFAULT;
			var index = pr.confirmEx(
				// TODO: localize
				Zotero.getString('general.warning'),
				"All data in this copy of Zotero will be erased and replaced with "
					+ "data belonging to user '" + account + "' on the Zotero server.",
				buttonFlags,
				"Replace Zotero Data",
				null, null, null, {}
			);
			
			switch (index) {
				case 0:
					// TODO: better error handling
					
					// Verify username and password
					Zotero.Sync.Server.login(function () {
						Zotero.Schema.stopRepositoryTimer();
						Zotero.Sync.Runner.clearSyncTimeout();
						
						Zotero.DB.skipBackup = true;
						
						var file = Zotero.getZoteroDirectory();
						file.append('restore-from-server');
						Zotero.File.putContents(file, '');
						
						var buttonFlags = (pr.BUTTON_POS_0) * (pr.BUTTON_TITLE_IS_STRING);
						var index = pr.confirmEx(
							Zotero.getString('general.restartRequired'),
							// TODO: localize
							"Firefox must be restarted to complete the restore process.",
							buttonFlags,
							Zotero.getString('general.restartNow'),
							null, null, null, {}
						);
						
						var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
								.getService(Components.interfaces.nsIAppStartup);
						appStartup.quit(Components.interfaces.nsIAppStartup.eRestart);
						appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
					});
					break;
				
				// Cancel
				case 1:
					return;
			}
			break;
		
		case 'restore-to-server':
			var buttonFlags = (pr.BUTTON_POS_0) * (pr.BUTTON_TITLE_IS_STRING)
							+ (pr.BUTTON_POS_1) * (pr.BUTTON_TITLE_CANCEL)
							+ pr.BUTTON_POS_1_DEFAULT;
			var index = pr.confirmEx(
				// TODO: localize
				Zotero.getString('general.warning'),
				"All item data belonging to user '" + account + "' on the Zotero server "
					+ "will be erased and replaced with data from this copy of Zotero.",
				buttonFlags,
				"Replace Server Data",
				null, null, null, {}
			);
			
			switch (index) {
				case 0:
					// TODO: better error handling
					Zotero.Sync.Server.clear(function () {
						Zotero.Sync.Server.sync(function () {
							pr.alert(
								"Restore Completed",
								"Item data on the Zotero server has been "
									+ "successfully restored."
							);
						});
					});
					break;
				
				// Cancel
				case 1:
					return;
			}
			
			break;
		
		default:
			throw ("Invalid action '" + action + "' in handleSyncReset()");
	}
}


/*
 * Builds the main Quick Copy drop-down from the current global pref
 */
function populateQuickCopyList() {
	// Initialize default format drop-down
	var format = Zotero.Prefs.get("export.quickCopy.setting");
	var menulist = document.getElementById("zotero-quickCopy-menu");
	buildQuickCopyFormatDropDown(menulist, Zotero.QuickCopy.getContentType(format), format);
	menulist.setAttribute('preference', "pref-quickCopy-setting");
	updateQuickCopyHTMLCheckbox();
	
	refreshQuickCopySiteList();
}


/*
 * Builds a Quick Copy drop-down 
 */
function buildQuickCopyFormatDropDown(menulist, contentType, currentFormat) {
	if (!currentFormat) {
		currentFormat = menulist.value;
	}
	// Strip contentType from mode
	currentFormat = Zotero.QuickCopy.stripContentType(currentFormat);
	
	menulist.selectedItem = null;
	menulist.removeAllItems();
	
	// Prevent Cmd-w from setting "Wikipedia"
	menulist.onkeydown = function (event) {
		if ((Zotero.isMac && event.metaKey) || event.ctrlKey) {
			event.preventDefault();
		}
	}
	
	var popup = document.createElement('menupopup');
	menulist.appendChild(popup);
	
	var itemNode = document.createElement("menuitem");
	itemNode.setAttribute("label", Zotero.getString('zotero.preferences.export.quickCopy.bibStyles'));
	itemNode.setAttribute("disabled", true);
	popup.appendChild(itemNode);
	
	// add styles to list
	var styles = Zotero.Styles.getVisible();
	for each(var style in styles) {
		var baseVal = 'bibliography=' + style.styleID;
		var val = 'bibliography' + (contentType == 'html' ? '/html' : '') + '=' + style.styleID;
		var itemNode = document.createElement("menuitem");
		itemNode.setAttribute("value", val);
		itemNode.setAttribute("label", style.title);
		itemNode.setAttribute("oncommand", 'updateQuickCopyHTMLCheckbox()');
		popup.appendChild(itemNode);
		
		if (baseVal == currentFormat) {
			menulist.selectedItem = itemNode;
		}
	}
	
	var itemNode = document.createElement("menuitem");
	itemNode.setAttribute("label", Zotero.getString('zotero.preferences.export.quickCopy.exportFormats'));
	itemNode.setAttribute("disabled", true);
	popup.appendChild(itemNode);
	
	// add export formats to list
	var translation = new Zotero.Translate("export");
	var translators = translation.getTranslators();
	
	for (var i=0; i<translators.length; i++) {
		// Skip RDF formats
		switch (translators[i].translatorID) {
			case '6e372642-ed9d-4934-b5d1-c11ac758ebb7':
			case '14763d24-8ba0-45df-8f52-b8d1108e7ac9':
				continue;
		}
		var val  = 'export=' + translators[i].translatorID;
		var itemNode = document.createElement("menuitem");
		itemNode.setAttribute("value", val);
		itemNode.setAttribute("label", translators[i].label);
		itemNode.setAttribute("oncommand", 'updateQuickCopyHTMLCheckbox()');
		popup.appendChild(itemNode);
		
		if (val == currentFormat) {
			menulist.selectedItem = itemNode;
		}
	}
	
	menulist.click();
	
	return popup;
}

function updateQuickCopyHTMLCheckbox() {
	var format = document.getElementById('zotero-quickCopy-menu').value;
	var mode, contentType;
	
	var checkbox = document.getElementById('zotero-quickCopy-copyAsHTML');
	[mode, format] = format.split('=');
	[mode, contentType] = mode.split('/');
	
	checkbox.checked = contentType == 'html';
	checkbox.disabled = mode != 'bibliography';
}

function showQuickCopySiteEditor(index) {
	var treechildren = document.getElementById('quickCopy-siteSettings-rows');
	
	if (index != undefined && index > -1 && index < treechildren.childNodes.length) {
		var treerow = treechildren.childNodes[index].firstChild;
		var domain = treerow.childNodes[0].getAttribute('label');
		var format = treerow.childNodes[1].getAttribute('label');
		var asHTML = treerow.childNodes[2].getAttribute('label') != '';
	}
	
	var format = Zotero.QuickCopy.getSettingFromFormattedName(format);
	if (asHTML) {
		format = format.replace('bibliography=', 'bibliography/html=');
	}
	
	var io = {domain: domain, format: format, ok: false};
	window.openDialog('chrome://zotero/content/preferences/quickCopySiteEditor.xul', "zotero-preferences-quickCopySiteEditor", "chrome, modal", io);
	
	if (!io.ok) {
		return;
	}
	
	if (domain && domain != io.domain) {
		Zotero.DB.query("DELETE FROM settings WHERE setting='quickCopySite' AND key=?", [domain]);
	}
	
	Zotero.DB.query("REPLACE INTO settings VALUES ('quickCopySite', ?, ?)", [io.domain, io.format]);
	
	refreshQuickCopySiteList();
}

function refreshQuickCopySiteList() {
	var treechildren = document.getElementById('quickCopy-siteSettings-rows');
	while (treechildren.hasChildNodes()) {
		treechildren.removeChild(treechildren.firstChild);
	}
	
	var sql = "SELECT key AS domainPath, value AS format FROM settings "
		+ "WHERE setting='quickCopySite' ORDER BY domainPath COLLATE NOCASE";
	var siteData = Zotero.DB.query(sql);
	
	if (!siteData) {
		return;
	}
	
	for (var i=0; i<siteData.length; i++) {
		var treeitem = document.createElement('treeitem');
		var treerow = document.createElement('treerow');
		var domainCell = document.createElement('treecell');
		var formatCell = document.createElement('treecell');
		var HTMLCell = document.createElement('treecell');
		
		domainCell.setAttribute('label', siteData[i].domainPath);
		
		var formatted = Zotero.QuickCopy.getFormattedNameFromSetting(siteData[i].format);
		formatCell.setAttribute('label', formatted);
		var copyAsHTML = Zotero.QuickCopy.getContentType(siteData[i].format) == 'html';
		HTMLCell.setAttribute('label', copyAsHTML ? '   ✓   ' : '');
		
		treerow.appendChild(domainCell);
		treerow.appendChild(formatCell);
		treerow.appendChild(HTMLCell);
		treeitem.appendChild(treerow);
		treechildren.appendChild(treeitem);
	}
}


function deleteSelectedQuickCopySite() {
	var tree = document.getElementById('quickCopy-siteSettings');
	var treeitem = tree.lastChild.childNodes[tree.currentIndex];
	var domainPath = treeitem.firstChild.firstChild.getAttribute('label');
	Zotero.DB.query("DELETE FROM settings WHERE setting='quickCopySite' AND key=?", [domainPath]);
	refreshQuickCopySiteList();
}


function updateQuickCopyInstructions() {
	if (Zotero.isMac) {
		document.getElementById('quickCopy-macWarning').setAttribute('hidden', false);
	}
	
	var prefix = Zotero.isMac ? 'Cmd+Shift+' : 'Ctrl+Alt+';
	var key = Zotero.Prefs.get('keys.copySelectedItemsToClipboard');
	
	var instr = document.getElementById('quickCopy-instructions');
	var str = Zotero.getString('zotero.preferences.export.quickCopy.instructions', prefix + key);
	
	while (instr.hasChildNodes()) {
		instr.removeChild(instr.firstChild);
	}
	instr.appendChild(document.createTextNode(str));
}


function rebuildIndexPrompt() {
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
			createInstance(Components.interfaces.nsIPromptService);
	var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_CANCEL);
	
	var index = ps.confirmEx(null,
		Zotero.getString('zotero.preferences.search.rebuildIndex'),
		Zotero.getString('zotero.preferences.search.rebuildWarning',
			Zotero.getString('zotero.preferences.search.indexUnindexed')),
		buttonFlags,
		Zotero.getString('zotero.preferences.search.rebuildIndex'),
		Zotero.getString('zotero.preferences.search.indexUnindexed'),
		null, null, {});
	
	if (index == 0) {
		Zotero.Fulltext.rebuildIndex();
	}
	else if (index == 1) {
		Zotero.Fulltext.rebuildIndex(true)
	}
	
	updateIndexStats();
}


function clearIndexPrompt() {
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
			createInstance(Components.interfaces.nsIPromptService);
	var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_CANCEL);
	
	var index = ps.confirmEx(null,
		Zotero.getString('zotero.preferences.search.clearIndex'),
		Zotero.getString('zotero.preferences.search.clearWarning',
			Zotero.getString('zotero.preferences.search.clearNonLinkedURLs')),
		buttonFlags,
		Zotero.getString('zotero.preferences.search.clearIndex'),
		Zotero.getString('zotero.preferences.search.clearNonLinkedURLs'),
		null, null, {});
	
	if (index == 0) {
		Zotero.Fulltext.clearIndex();
	}
	else if (index == 1) {
		Zotero.Fulltext.clearIndex(true);
	}
	
	updateIndexStats();
}


function initSearchPane() {
	document.getElementById('fulltext-rebuildIndex').setAttribute('label',
		Zotero.getString('zotero.preferences.search.rebuildIndex'));
	document.getElementById('fulltext-clearIndex').setAttribute('label',
		Zotero.getString('zotero.preferences.search.clearIndex'));
	updatePDFToolsStatus();
}


/*
 * Update window according to installation status for PDF tools
 *  (e.g. status line, install/update button, etc.)
 */
function updatePDFToolsStatus() {
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
		var utils = new Zotero.Utilities();
		
		// Xpdf link
		var str = Zotero.getString('zotero.preferences.search.pdf.toolsRequired',
			[Zotero.Fulltext.pdfConverterName, Zotero.Fulltext.pdfInfoName,
			'<a href="' + Zotero.Fulltext.pdfToolsURL + '">'
			+ Zotero.Fulltext.pdfToolsName + '</a>']);
		var parts = utils.parseMarkup(str);
		for (var i=0; i<parts.length; i++) {
			var part = parts[i];
			if (part.type == 'text') {
				var elem = document.createTextNode(part.text);
			}
			else if (part.type == 'link') {
				var elem = document.createElement('label');
				elem.setAttribute('value', part.text);
				elem.setAttribute('class', 'text-link');
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
		var parts = utils.parseMarkup(str);
		
		for (var i=0; i<parts.length; i++) {
			var part = parts[i];
			if (part.type == 'text') {
				var elem = document.createTextNode(part.text);
			}
			else if (part.type == 'link') {
				var elem = document.createElement('label');
				elem.setAttribute('value', part.text);
				elem.setAttribute('class', 'text-link');
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
}


/*
 * Check available versions of PDF tools from server and prompt for installation
 * if a newer version is available
 */
function checkPDFToolsDownloadVersion() {
	var url = Zotero.Fulltext.pdfToolsDownloadBaseURL
				+ Zotero.platform.replace(' ', '-') + '.latest';
	
	// Find latest version for this platform
	var sent = Zotero.Utilities.HTTP.doGet(url, function (xmlhttp) {
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
						tvp = Zotero.getString('zotero.preferences.search.pdf.toolVersionPlatform',
							[Zotero.Fulltext.pdfConverterName, converterVersion]);
						msg += '- ' + tvp + '\n';
					}
					if (infoVersionAvailable) {
						tvp = Zotero.getString('zotero.preferences.search.pdf.toolVersionPlatform',
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
						installPDFTools(installVersions);
					}
				}
			}
			// Version not found for platform
			else if (xmlhttp.status == 404) {
				onPDFToolsDownloadError(404);
			}
		}
		catch (e) {
			onPDFToolsDownloadError(e);
		}
	});
	
	// Browser is offline
	if (!sent) {
		onPDFToolsDownloadError();
	}
}


/*
 * Begin installation of specified PDF tools from server -- does a HEAD call to
 * make sure file exists and then calls downloadPDFTool() if so
 */
function installPDFTools(installVersions) {
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
	var sent = Zotero.Utilities.HTTP.doHead(url, function (xmlhttp) {
		try {
			if (xmlhttp.status == 200) {
				// If doing both and on converter, chain pdfinfo
				if (installVersions.converter && installVersions.info) {
					downloadPDFTool(tool, version, function () {
						return installPDFTools({ info: installVersions.info });
					});
				}
				else {
					downloadPDFTool(tool, version);
				}
			}
			// Version not found for platform
			else if (xmlhttp.status == 404) {
				onPDFToolsDownloadError(404);
			}
		}
		catch (e) {
			onPDFToolsDownloadError(e);
		}
	});
	
	// Browser is offline
	if (!sent) {
		onPDFToolsDownloadError();
	}
}


/*
 * Download and install specified PDF tool
 */
function downloadPDFTool(tool, version, callback) {
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
			updatePDFToolsStatus();
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
	wbp.saveURI(uri, null, null, null, null, fileURL);
}


function onPDFToolsDownloadError(e) {
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
	alert(str);
}


function updateIndexStats() {
	var stats = Zotero.Fulltext.getIndexStats();
	document.getElementById('fulltext-stats-indexed').
		lastChild.setAttribute('value', stats.indexed);
	document.getElementById('fulltext-stats-partial').
		lastChild.setAttribute('value', stats.partial);
	document.getElementById('fulltext-stats-unindexed').
		lastChild.setAttribute('value', stats.unindexed);
	document.getElementById('fulltext-stats-words').
		lastChild.setAttribute('value', stats.words);
}


function revealDataDirectory() {
	var dataDir = Zotero.getZoteroDirectory();
	dataDir.QueryInterface(Components.interfaces.nsILocalFile);
	try {
		dataDir.reveal();
	}
	catch (e) {
		// On platforms that don't support nsILocalFile.reveal() (e.g. Linux), we
		// open a small window with a selected read-only textbox containing the
		// file path, so the user can open it, Control-c, Control-w, Alt-Tab, and
		// Control-v the path into another app
		var io = {alertText: dataDir.path};
		window.openDialog('chrome://zotero/content/selectableAlert.xul', "zotero-reveal-window", "chrome", io);
	}
}


function runIntegrityCheck() {
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Components.interfaces.nsIPromptService);
	
	var ok = Zotero.DB.integrityCheck();
	var str = ok ? 'passed' : 'failed';
	
	ps.alert(window,
		Zotero.getString('general.' + str),
		Zotero.getString('db.integrityCheck.' + str));
}


function updateTranslators() {
	Zotero.Schema.updateFromRepository(true, function (xmlhttp, updated) {
		var button = document.getElementById('updateButton');
		if (button) {
			if (updated===-1) {
				var label = Zotero.getString('zotero.preferences.update.upToDate');
			}
			else if (updated) {
				var label = Zotero.getString('zotero.preferences.update.updated');
			}
			else {
				var label = Zotero.getString('zotero.preferences.update.error');
			}
			button.setAttribute('label', label);
		}
	});
}


function resetTranslatorsAndStyles() {
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
			populateQuickCopyList();
		});
	}
}


function resetTranslators() {
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
		Zotero.Schema.resetTranslators();
	}
}


function resetStyles() {
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
			populateQuickCopyList();
		});
	}
}


function onOpenURLSelected()
{
	var openURLMenu = document.getElementById('openURLMenu');
	
	if(openURLMenu.value == "custom")
	{
		openURLServerField.focus();
	}
	else
	{
		openURLServerField.value = openURLResolvers[openURLMenu.selectedIndex]['url'];
		openURLVersionMenu.value = openURLResolvers[openURLMenu.selectedIndex]['version'];
	}
}

function onOpenURLCustomized()
{
	document.getElementById('openURLMenu').value = "custom";
}

/** STYLES **/

/**
 * Refreshes the list of styles in the styles pane
 * @param {String} cslID Style to select
 */
function refreshStylesList(cslID) {
	var treechildren = document.getElementById('styleManager-rows');
	while (treechildren.hasChildNodes()) {
		treechildren.removeChild(treechildren.firstChild);
	}
	
	var styles = Zotero.Styles.getVisible();
	
	var selectIndex = false;
	var i = 0;
	for each(var style in styles) {
		var treeitem = document.createElement('treeitem');
		var treerow = document.createElement('treerow');
		var titleCell = document.createElement('treecell');
		var updatedCell = document.createElement('treecell');
		var cslCell = document.createElement('treecell');
		
		if (style.updated) {
			var updatedDate = Zotero.Date.formatDate(Zotero.Date.strToDate(style.updated), true);
		}
		else {
			var updatedDate = '';
		}
		
		treeitem.setAttribute('id', 'zotero-csl-' + style.styleID);
		titleCell.setAttribute('label', style.title);
		updatedCell.setAttribute('label', updatedDate);
		// if not EN
		if(style.type == "csl") {
			cslCell.setAttribute('src', 'chrome://zotero/skin/tick.png');
		}
		
		treerow.appendChild(titleCell);
		treerow.appendChild(updatedCell);
		treerow.appendChild(cslCell);
		treeitem.appendChild(treerow);
		treechildren.appendChild(treeitem);
		
		if (cslID == style.styleID) {
			document.getElementById('styleManager').view.selection.select(i);
		}
		i++;
	}
}

/**
 * Adds a new style to the style pane
 **/
function addStyle() {	
	const nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(nsIFilePicker);
	fp.init(window, Zotero.getString("zotero.preferences.styles.addStyle"), nsIFilePicker.modeOpen);
	
	fp.appendFilter("CSL Style", "*.csl");
	fp.appendFilter("EndNote Style", "*.ens");
	
	var rv = fp.show();
	if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
		Zotero.Styles.install(fp.file);
	}
}

/**
 * Deletes selected styles from the styles pane
 **/
function deleteStyle() {
	// get selected cslIDs
	var tree = document.getElementById('styleManager');
	var treeItems = tree.lastChild.childNodes;
	var cslIDs = [];
	var start = {};
	var end = {};
	var nRanges = tree.view.selection.getRangeCount();
	for(var i=0; i<nRanges; i++) {
		tree.view.selection.getRangeAt(i, start, end);
		for(var j=start.value; j<=end.value; j++) {
			cslIDs.push(treeItems[j].getAttribute('id').substr(11));
		}
	}
	
	if(cslIDs.length == 0) {
		return;
	} else if(cslIDs.length == 1) {
		var selectedStyle = Zotero.Styles.get(cslIDs[0])
		var text = Zotero.getString('styles.deleteStyle', selectedStyle.title);
	} else {
		var text = Zotero.getString('styles.deleteStyles');
	}
	
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Components.interfaces.nsIPromptService);
	if(ps.confirm(null, '', text)) {
		// delete if requested
		if(cslIDs.length == 1) {
			selectedStyle.remove();
		} else {
			for(var i=0; i<cslIDs.length; i++) {
				Zotero.Styles.get(cslIDs[i]).remove();
			}
		}
		
		this.refreshStylesList();
		document.getElementById('styleManager-delete').disabled = true;
	}
}

/**
 * Shows an error if import fails
 **/
function styleImportError() {
	alert(Zotero.getString('styles.installError', "This"));
}

/**PROXIES**/

/**
 * Adds a proxy to the proxy pane
 */
function showProxyEditor(index) {
	if(index == -1) return;
	window.openDialog('chrome://zotero/content/preferences/proxyEditor.xul',
		"zotero-preferences-proxyEditor", "chrome, modal", index !== undefined ? proxies[index] : null);
	refreshProxyList();
}

/**
 * Deletes the currently selected proxy
 */
function deleteProxy() {
	if(document.getElementById('proxyTree').currentIndex == -1) return;
	proxies[document.getElementById('proxyTree').currentIndex].erase();
	refreshProxyList();
	document.getElementById('proxyTree-delete').disabled = true;
}

/**
 * Refreshes the proxy pane
 */
function refreshProxyList() {
	// get and sort proxies
	proxies = Zotero.Proxies.get();
	proxies = proxies.sort(function(a, b) {
		if(a.multiHost) {
			if(b.multiHost) {
				if(a.hosts[0] < b.hosts[0]) {
					return -1;
				} else {
					return 1;
				}
			} else {
				return -1;
			}
		} else if(b.multiHost) {
			return 1;
		}
		
		if(a.scheme < b.scheme) {
			return -1;
		} else if(b.scheme > a.scheme) {
			return 1;
		}
		
		return 0;
	});
	
	// erase old children
	var treechildren = document.getElementById('proxyTree-rows');
	while (treechildren.hasChildNodes()) {
		treechildren.removeChild(treechildren.firstChild);
	}
	
	// add proxies to list
	for (var i=0; i<proxies.length; i++) {
		var treeitem = document.createElement('treeitem');
		var treerow = document.createElement('treerow');
		var hostnameCell = document.createElement('treecell');
		var schemeCell = document.createElement('treecell');
		
		hostnameCell.setAttribute('label', proxies[i].multiHost ? Zotero.getString("proxies.multiSite") : proxies[i].hosts[0]);
		schemeCell.setAttribute('label', proxies[i].scheme);
		
		treerow.appendChild(hostnameCell);
		treerow.appendChild(schemeCell);
		treeitem.appendChild(treerow);
		treechildren.appendChild(treeitem);
	}
	
	document.getElementById('proxyTree').currentIndex = -1;
	document.getElementById('proxyTree-delete').disabled = true;
	document.getElementById('zotero-proxies-autoRecognize').checked = Zotero.Prefs.get("proxies.autoRecognize");
	document.getElementById('zotero-proxies-transparent').checked = Zotero.Prefs.get("proxies.transparent");
}

/**
 * Updates proxy autoRecognize and transparent settings based on checkboxes
 */
function updateProxyPrefs() {
	Zotero.Prefs.set("proxies.autoRecognize", document.getElementById('zotero-proxies-autoRecognize').checked);
	
	var oldTransparent = Zotero.Prefs.get("proxies.transparent");
	var newTransparent = document.getElementById('zotero-proxies-transparent').checked;
	if(!oldTransparent && newTransparent) {
		Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService).alert(window,
			Zotero.getString("proxies.enableTransparentWarning.title"),
			Zotero.getString("proxies.enableTransparentWarning.description"));
	}
	Zotero.Prefs.set("proxies.transparent", newTransparent);
	
	Zotero.Proxies.init()
}