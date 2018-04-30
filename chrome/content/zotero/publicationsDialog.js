/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2015 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     https://www.zotero.org
    
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

var Zotero_Publications_Dialog = new function () {
	var _initialized = false;
	var _io;
	var _hasFiles = false;
	var _hasNotes = false;
	var _hasRights = null;
	var _includeFiles = true;
	var _includeNotes = true;
	var _keepRights = true;
	var _shareSettings = {
		sharing: 'reserved', // 'reserved', 'cc', 'cc0'
		adaptations: 'no',
		commercial: 'no'
	};
	var _license = null;
	
	function _init() {
		try {
			var wizard = document.getElementById('zotero-publications-wizard');
			wizard.getButton('finish').label =
				Zotero.getString('publications.buttons.addToMyPublications');
			
			if (window.arguments && window.arguments.length) {
				_io = window.arguments[0];
				_hasFiles = _io.hasFiles;
				_hasNotes = _io.hasNotes;
				_hasRights = _io.hasRights;
				if (_hasRights == 'none') _keepRights = false;
				delete _io.hasFiles;
				delete _io.hasNotes;
				delete _io.hasRights;
			}
			_initialized = true;
		}
		catch (e) {
			window.close();
			throw e;
		}
	}
	
	
	this.updatePage = function () {
		if (!_initialized) {
			_init();
			this.updateInclude();
		}
		
		var wizard = document.getElementById('zotero-publications-wizard');
		var currentPage = wizard.currentPage;
		var pageid = currentPage.pageid;
		
		if (pageid == 'intro') {
			let str = 'publications.authorship.checkbox';
			let filesCheckbox = document.getElementById('include-files');
			let notesCheckbox = document.getElementById('include-notes')
			
			// Enable the checkboxes only when relevant
			filesCheckbox.disabled = !_hasFiles;
			filesCheckbox.checked = _hasFiles && _includeFiles;
			notesCheckbox.disabled = !_hasNotes;
			notesCheckbox.checked = _hasNotes && _includeNotes;
			
			// Adjust the checkbox text based on whether there are files or notes
			if (filesCheckbox.checked || notesCheckbox.checked) {
				if (filesCheckbox.checked && notesCheckbox.checked) {
					str += '.filesNotes';
				}
				else if (filesCheckbox.checked) {
					str += '.files';
				}
				else {
					str += '.notes';
				}
			}
		}
		else if (pageid == 'choose-sharing') {
			let keepRightsBox = document.getElementById('keep-rights');
			let keepRightsCheckbox = document.getElementById('keep-rights-checkbox');
			if (_hasRights == 'none') {
				keepRightsBox.hidden = true;
				document.getElementById('sharing-radiogroup').focus();
			}
			else {
				let str = 'publications.sharing.keepRightsField';
				if (_hasRights == 'some') {
					str += 'WhereAvailable';
				}
				keepRightsCheckbox.label = Zotero.getString(str);
				keepRightsCheckbox.checked = _keepRights;
				this.updateKeepRights(keepRightsCheckbox.checked);
			}
		}
		// Select appropriate radio button from current license
		else if (pageid == 'choose-license') {
			document.getElementById('adaptations-' + _shareSettings.adaptations).selected = true;
			document.getElementById('commercial-' + _shareSettings.commercial).selected = true;
		}
		
		_updateLicense();
		this.updateNextButton();
	};
	
	
	this.updateNextButton = function () {
		var wizard = document.getElementById('zotero-publications-wizard');
		var currentPage = wizard.currentPage;
		var nextPage = wizard.wizardPages[wizard.pageIndex + 1];
		var nextButton = wizard.getButton('next');
		
		// Require authorship checkbox on first page to be checked to advance
		wizard.canAdvance = document.getElementById('confirm-authorship-checkbox').checked;
		
		if (!nextPage) {
			return;
		}
		
		if (_hasFiles
				&& _includeFiles
				&& (currentPage.pageid == 'intro' ||
				// If CC selected on sharing page and we're not using existing rights for all
				// items, go to license chooser next
				(currentPage.pageid == 'choose-sharing'
					&& _shareSettings.sharing == 'cc'
					&& !(_hasRights == 'all' && _keepRights)))) {
			this.lastPage = false;
			nextButton.label = Zotero.getString(
				'publications.buttons.next',
				Zotero.getString('publications.buttons.' + nextPage.pageid)
			);
		}
		// Otherwise this is the last page
		else {
			this.lastPage = true;
			// Due to issues with linux not handling finish button hiding correctly
			// we just set the next button label to be the one for the finish button
			// and leave visibility handling up to mr wizard
			nextButton.label = Zotero.getString('publications.buttons.addToMyPublications');
		}
	}
	
	
	/**
	 * Update files/notes settings from checkboxes
	 */
	this.updateInclude = function () {
		var filesCheckbox = document.getElementById('include-files');
		var notesCheckbox = document.getElementById('include-notes')
		var authorshipCheckbox = document.getElementById('confirm-authorship-checkbox');
		_includeFiles = filesCheckbox.checked;
		_includeNotes = notesCheckbox.checked;
		authorshipCheckbox.label = Zotero.getString(
			'publications.intro.authorship' + (_includeFiles ? '.files' : '')
		);
		this.updateNextButton();
	}
	
	
	/**
	 * Update rights setting from checkbox and hide sharing setting if necessary
	 */
	this.updateKeepRights = function (keepRights) {
		_keepRights = keepRights;
		
		// If all items have rights and we're using them, the sharing page is the last page
		document.getElementById('choose-sharing-options').hidden = _hasRights == 'all' && keepRights;
		this.updateNextButton();
	}
	
	
	/**
	 * Update sharing and license settings
	 */
	this.updateSharing = function (id) {
		var matches = id.match(/^(sharing|adaptations|commercial)-(.+)$/);
		var setting = matches[1];
		var value = matches[2];
		_shareSettings[setting] = value;
		_updateLicense();
		this.updateNextButton();
	}
	
	
	this.onAdvance = function () {
		if (this.lastPage) {
			this.finish();
			return false;
		}
		return true;
	}
	
	
	this.onFinish = function () {
		_io.includeFiles = document.getElementById('include-files').checked;
		_io.includeNotes = document.getElementById('include-notes').checked;
		_io.keepRights = _keepRights;
		_io.license = _license;
		_io.licenseName = _getLicenseName(_license);
	}
	
	this.finish = function () {
		this.onFinish();
		window.close();
	}
	
	
	/**
	 * Update the calculated license and image
	 *
	 * Possible licenses:
	 *
	 * 'cc-by'
	 * 'cc-by-sa'
	 * 'cc-by-nd'
	 * 'cc-by-nc'
	 * 'cc-by-nc-sa'
	 * 'cc-by-nc-nd'
	 * 'cc0'
	 * 'reserved'
	 */
	function _updateLicense() {
		var s = _shareSettings.sharing;
		var a = _shareSettings.adaptations;
		var c = _shareSettings.commercial;
		
		if (s == 'cc0' || s == 'reserved') {
			_license = s;
		}
		else {
			_license = 'cc-by';
			if (c == 'no') {
				_license += '-nc';
			}
			if (a == 'no') {
				_license += '-nd';
			}
			else if (a == 'sharealike') {
				_license += '-sa';
			}
		}
		_updateLicenseSummary();
	}
	
	
	/**
	 *
	 */
	function _updateLicenseSummary() {
		var wizard = document.getElementById('zotero-publications-wizard');
		var currentPage = wizard.currentPage;
		var groupbox = currentPage.getElementsByAttribute('class', 'license-info')[0];
		if (!groupbox) return;
		if (groupbox.hasChildNodes()) {
			let hbox = groupbox.lastChild;
			var icon = currentPage.getElementsByAttribute('class', 'license-icon')[0];
			var div = currentPage.getElementsByAttribute('class', 'license-description')[0];
		}
		else {
			let hbox = document.createElement('hbox');
			hbox.align = "center";
			groupbox.appendChild(hbox);
			
			var icon = document.createElement('image');
			icon.className = 'license-icon';
			icon.setAttribute('style', 'width: 88px');
			hbox.appendChild(icon);
			
			let sep = document.createElement('separator');
			sep.orient = 'vertical';
			sep.setAttribute('style', 'width: 10px');
			hbox.appendChild(sep);
			
			var div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
			div.className = 'license-description';
			div.setAttribute('style', 'width: 400px');
			hbox.appendChild(div);
		}
		
		// Show generic CC icon on sharing page
		if (currentPage.pageid == 'choose-sharing' && _shareSettings.sharing == 'cc') {
			var license = 'cc';
		}
		else {
			var license = _license;
		}
		
		icon.src = _getLicenseImage(license);
		var url = _getLicenseURL(license);
		if (url) {
			icon.setAttribute('tooltiptext', url);
			icon.style.cursor = 'pointer';
			icon.onclick = function () {
				try {
					let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					   .getService(Components.interfaces.nsIWindowMediator);
					let win = wm.getMostRecentWindow("navigator:browser");
					win.ZoteroPane_Local.loadURI(url, { shiftKey: true })
				}
				catch (e) {
					Zotero.logError(e);
				}
				return false;
			};
		}
		else {
			icon.removeAttribute('tooltiptext');
			icon.style.cursor = 'auto';
		}
		
		div.innerHTML = _getLicenseHTML(license);
		Zotero.Utilities.Internal.updateHTMLInXUL(div, { linkEvent: { shiftKey: true } });
		
		_updateLicenseMoreInfo();
	}
	
	
	function _getLicenseImage(license) {
		// Use generic "Some Rights Reserved" image
		if (license == 'cc') {
			return "chrome://zotero/skin/licenses/cc-srr.png";
		}
		else if (license == 'reserved') {
			return "chrome://zotero/skin/licenses/reserved.png";
		}
		return "chrome://zotero/skin/licenses/" + license + ".svg";
	}
	
	
	function _getLicenseHTML(license) {
		switch (license) {
		case 'cc':
			return '<a href="' + _getLicenseURL(license) + '">Creative Commons</a>';
		
		case 'reserved':
			return "All rights reserved";
		
		case 'cc0':
			return '<a href="' + _getLicenseURL(license) + '">CC0 1.0 Universal Public Domain Dedication</a>';
		
		default:
			return '<a href="' + _getLicenseURL(license) + '">'
				+ Zotero.getString('licenses.' + license) + "</a>";
		}
	}
	
	
	function _getLicenseName(license) {
		switch (license) {
		case 'reserved':
			return "All rights reserved";
		
		case 'cc0':
			return 'CC0 1.0 Universal Public Domain Dedication';
		
		default:
			return Zotero.getString('licenses.' + license) + " (" + license.toUpperCase() + ")";
		}
	}
	
	
	function _getLicenseURL(license) {
		switch (license) {
		case 'reserved':
			return "";
		
		case 'cc':
			return 'https://creativecommons.org/';
		
		case 'cc0':
			return "https://creativecommons.org/publicdomain/zero/1.0/";
		
		default:
			return "https://creativecommons.org/licenses/" + license.replace(/^cc-/, '') + "/4.0/"
		}
	}
	
	
	function _updateLicenseMoreInfo() {
		var wizard = document.getElementById('zotero-publications-wizard');
		var currentPage = wizard.currentPage;
		var s = _shareSettings.sharing;
		
		var div = currentPage.getElementsByAttribute('class', 'license-more-info')[0];
		if (s == 'cc0' || currentPage.pageid == 'choose-license') {
			let links = {
				cc: 'https://wiki.creativecommons.org/Considerations_for_licensors_and_licensees',
				cc0: 'https://wiki.creativecommons.org/CC0_FAQ'
			};
			div.innerHTML = Zotero.getString(
				'publications.' + s + '.moreInfo.text',
				// Add link to localized string
				'<a href="' + links[s] + '">'
					+ Zotero.getString('publications.' + s + '.moreInfo.linkText')
					+ '</a>'
			);
			Zotero.Utilities.Internal.updateHTMLInXUL(div, { linkEvent: { shiftKey: true } });
		}
		else {
			div.innerHTML = "";
		}
	}
}
