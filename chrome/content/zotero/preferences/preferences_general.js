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

Components.utils.import("resource://gre/modules/Services.jsm");
var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');

Zotero_Preferences.General = {
	_openURLResolvers: null,

	init: function () {
		// JS-based strings
		var checkbox = document.getElementById('launchNonNativeFiles-checkbox');
		if (checkbox) {
			checkbox.label = Zotero.getString(
				'zotero.preferences.launchNonNativeFiles', Zotero.appName
			);
		}
		var menuitems = document.querySelectorAll('.fileHandler-internal');
		for (let menuitem of menuitems) {
			menuitem.setAttribute('label', Zotero.appName);
		}

		// Set OpenURL resolver drop-down to last-known name or "custom" placeholder
		let resolverName = Zotero.getString("general.custom");
		if (Zotero.Prefs.get('openURL.resolver')) {
			let name = Zotero.Prefs.get('openURL.name');
			if (name) {
				resolverName = name;
			}
		}
		document.getElementById('openurl-primary-popup').firstChild.setAttribute('label', resolverName);
		
		this.refreshLocale();
		this._initItemPaneHeaderUI();
		this.updateAutoRenameFilesUI();
		this._updateFileHandlerUI();
		this._initEbookFontFamilyMenu();
	},

	_getAutomaticLocaleMenuLabel: function () {
		return Zotero.getString(
			'zotero.preferences.locale.automaticWithLocale',
			Zotero.Locale.availableLocales[Zotero.locale] || Zotero.locale
		);
	},
	
	
	refreshLocale: function () {
		var autoLocaleName, currentValue;
		
		// If matching OS, get the name of the current locale
		if (Zotero.Prefs.get('intl.locale.requested', true) === '') {
			autoLocaleName = this._getAutomaticLocaleMenuLabel();
			currentValue = 'automatic';
		}
		// Otherwise get the name of the locale specified in the pref
		else {
			autoLocaleName = Zotero.getString('zotero.preferences.locale.automatic');
			currentValue = Zotero.locale;
		}
		
		// Populate menu
		var menu = document.getElementById('locale-menu');
		var menupopup = menu.firstChild;
		menupopup.textContent = '';
		// Show "Automatic (English)", "Automatic (Français)", etc.
		menu.appendItem(autoLocaleName, 'automatic');
		menu.menupopup.appendChild(document.createXULElement('menuseparator'));
		// Add all available locales
		for (let locale in Zotero.Locale.availableLocales) {
			menu.appendItem(Zotero.Locale.availableLocales[locale], locale);
		}
		menu.value = currentValue;
	},
	
	onLocaleChange: function () {
		var requestedLocale = Services.locale.requestedLocale;
		var menu = document.getElementById('locale-menu');
		
		if (menu.value == 'automatic') {
			// Changed if not already set to automatic (unless we have the automatic locale name,
			// meaning we just switched away to the same manual locale and back to automatic)
			var changed = requestedLocale
				&& requestedLocale == Zotero.locale
				&& menu.label != this._getAutomaticLocaleMenuLabel();
			Services.locale.requestedLocales = [];
		}
		else {
			// Changed if moving to a locale other than the current one
			var changed = requestedLocale != menu.value
			Services.locale.requestedLocales = [menu.value];
		}
		
		// https://searchfox.org/mozilla-central/rev/961a9e56a0b5fa96ceef22c61c5e75fb6ba53395/browser/base/content/utilityOverlay.js#383-387
		if (Services.locale.isAppLocaleRTL) {
			Zotero.Prefs.set("bidi.browser.ui", true, true);
		}
		
		if (!changed) {
			return;
		}
		
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
		var index = ps.confirmEx(null,
			Zotero.getString('general.restartRequired'),
			Zotero.getString('general.restartRequiredForChange', Zotero.appName),
			buttonFlags,
			Zotero.getString('general.restartNow'),
			Zotero.getString('general.restartLater'),
			null, null, {});
		
		if (index == 0) {
			Zotero.Utilities.Internal.quitZotero(true);
		}
	},

	_initItemPaneHeaderUI() {
		let pane = document.querySelector('#zotero-prefpane-general');
		let headerMenu = document.querySelector('#item-pane-header-menulist');
		let styleMenu = document.querySelector('#item-pane-header-style-menu');

		this._updateItemPaneHeaderStyleUI();
		pane.addEventListener('showing', () => this._updateItemPaneHeaderStyleUI());
		
		// menulists stop responding to clicks if we replace their items while
		// they're closing. Yield back to the event loop before updating to
		// avoid this.
		let updateUI = () => {
			setTimeout(() => {
				this._updateItemPaneHeaderStyleUI();
			});
		};
		headerMenu.addEventListener('command', updateUI);
		styleMenu.addEventListener('command', updateUI);
	},
	
	_updateItemPaneHeaderStyleUI: Zotero.Utilities.Internal.serial(async function () {
		let optionsContainer = document.querySelector('#item-pane-header-bib-entry-options');
		let styleMenu = document.querySelector('#item-pane-header-style-menu');
		let localeMenu = document.querySelector('#item-pane-header-locale-menu');

		optionsContainer.hidden = Zotero.Prefs.get('itemPaneHeader') !== 'bibEntry';
		if (optionsContainer.hidden) {
			return;
		}
		
		if (!Zotero.Styles.initialized()) {
			let menus = [styleMenu, localeMenu];
			for (let menu of menus) {
				menu.selectedItem = null;
				menu.setAttribute('label', Zotero.getString('general.loading'));
				menu.disabled = true;
			}
			await Zotero.Styles.init();
			for (let menu of menus) {
				menu.disabled = false;
			}
		}

		let currentStyle = Zotero.Styles.get(styleMenu.value);
		let currentLocale = Zotero.Prefs.get('itemPaneHeader.bibEntry.locale');

		styleMenu.menupopup.replaceChildren();
		for (let style of Zotero.Styles.getVisible()) {
			let menuitem = document.createXULElement('menuitem');
			menuitem.label = style.title;
			menuitem.value = style.styleID;
			styleMenu.menupopup.append(menuitem);
		}
		
		if (currentStyle) {
			if (currentStyle.styleID !== styleMenu.value) {
				// Style has been renamed
				styleMenu.value = currentStyle.styleID;
			}

			if (!localeMenu.menupopup.childElementCount) {
				Zotero.Styles.populateLocaleList(localeMenu);
			}
			Zotero.Styles.updateLocaleList(localeMenu, currentStyle, currentLocale);
		}
		else {
			// Style is unknown/removed - show placeholder
			let shortName = styleMenu.value.replace('http://www.zotero.org/styles/', '');
			let missingLabel = await document.l10n.formatValue(
				'preferences-item-pane-header-missing-style',
				{ shortName }
			);
			styleMenu.selectedItem = null;
			styleMenu.setAttribute('label', missingLabel);
		}
	}),
	
	setAutoRenameFileTypes: function () {
		let typesBox = document.getElementById('zotero-prefpane-file-renaming-file-types-box');
		let enabledTypes = new Set(
			Zotero.Prefs.get('autoRenameFiles.fileTypes')
				.split(',')
				.filter(Boolean)
		);
		for (let checkbox of typesBox.querySelectorAll('checkbox')) {
			if (checkbox.checked) {
				enabledTypes.add(checkbox.dataset.contentType);
			}
			else {
				enabledTypes.delete(checkbox.dataset.contentType);
			}
		}
		Zotero.Prefs.set('autoRenameFiles.fileTypes', [...enabledTypes].join(','));
	},
	
	updateAutoRenameFilesUI: function () {
		let disabled = !Zotero.Prefs.get('autoRenameFiles');
		
		let typesBox = document.getElementById('zotero-prefpane-file-renaming-file-types-box');
		let enabledTypes = Zotero.Prefs.get('autoRenameFiles.fileTypes').split(',');
		for (let checkbox of typesBox.querySelectorAll('checkbox')) {
			checkbox.checked = enabledTypes.includes(checkbox.dataset.contentType);
			checkbox.disabled = disabled;
		}
		document.getElementById('rename-linked-files').disabled = disabled;
	},
	
	//
	// File handlers
	//
	chooseFileHandler: async function (type) {
		var pref = this._getFileHandlerPref(type);
		var currentPath = Zotero.Prefs.get(pref);
		
		var fp = new FilePicker();
		if (currentPath && currentPath != 'system') {
			fp.displayDirectory = PathUtils.parent(currentPath);
		}
		fp.init(
			window,
			Zotero.getString('zotero.preferences.chooseApplication'),
			fp.modeOpen
		);
		fp.appendFilters(fp.filterApps);
		if (await fp.show() != fp.returnOK) {
			this._updateFileHandlerUI();
			return false;
		}
		this.setFileHandler(type, fp.file);
	},
	
	setFileHandler: function (type, handler) {
		var pref = this._getFileHandlerPref(type);
		Zotero.Prefs.set(pref, handler);
		this._updateFileHandlerUI();
	},
	
	_updateFileHandlerUI: function () {
		function update(type) {
			let handler = Zotero.Prefs.get('fileHandler.' + type);
			let menulist = document.getElementById('fileHandler-' + type);
			var customMenuItem = menulist.querySelector('.fileHandler-custom');
			
			// System default
			if (handler == 'system') {
				customMenuItem.hidden = true;
				menulist.selectedIndex = 1;
			}
			// Custom handler
			else if (handler) {
				let icon;
				try {
					let urlspec = Zotero.File.pathToFileURI(handler);
					icon = "moz-icon://" + urlspec + "?size=16";
				}
				catch (e) {
					Zotero.logError(e);
				}

				let handlerFilename = PathUtils.filename(handler);
				if (Zotero.isMac) {
					handlerFilename = handlerFilename.replace(/\.app$/, '');
				}
				customMenuItem.setAttribute('label', handlerFilename);
				if (icon) {
					customMenuItem.classList.add('menuitem-iconic');
					customMenuItem.setAttribute('image', icon);
				}
				else {
					customMenuItem.classList.remove('menuitem-iconic');
				}
				customMenuItem.hidden = false;
				menulist.selectedIndex = 2;

				// There's almost certainly a better way to do this...
				// but why doesn't the icon just behave by default?
				menulist.shadowRoot.querySelector('[part="icon"]').style.height = '16px';
			}
			// Zotero
			else {
				menulist.selectedIndex = 0;
				customMenuItem.hidden = true;
			}
		}
		
		update('pdf');
		update('epub');
		update('snapshot');
		var inNewWindowCheckbox = document.getElementById('open-reader-in-new-window');
		inNewWindowCheckbox.disabled = ['pdf', 'epub', 'snapshot'].every(type => Zotero.Prefs.get('fileHandler.' + type));
	},
	
	_getFileHandlerPref: function (type) {
		if (type != 'pdf' && type != 'epub' && type != 'snapshot') {
			throw new Error(`Unknown file type ${type}`);
		}
		return 'fileHandler.' + type;
	},

	handleOpenURLPopupShowing: async function (event) {
		if (event.target.id != 'openurl-primary-popup') {
			return;
		}
		var openURLMenu = document.getElementById('openurl-menu');
		let openURLMenuFirstItem = openURLMenu.menupopup.firstChild;
		if (!this._openURLResolvers) {
			openURLMenuFirstItem.setAttribute('label', Zotero.getString('general.loading'));
			try {
				this._openURLResolvers = await Zotero.Utilities.Internal.OpenURL.getResolvers();
			}
			catch (e) {
				Zotero.logError(e);
				openURLMenu.menupopup.firstChild.setAttribute('label', "Error loading resolvers");
				return;
			}
		}
		// Set top-most item to "Custom" once the menu appears
		openURLMenuFirstItem.setAttribute('label', Zotero.getString('general.custom'));
		openURLMenuFirstItem.setAttribute('value', 'custom');
		this.updateOpenURLResolversMenu();
	},
	
	handleOpenURLPopupHidden(event) {
		if (event.target.id != 'openurl-primary-popup') {
			return;
		}
		// Clear the menu so that on Windows arrowUp/Down does not select an invalid
		// top-level entry (e.g. North America)
		this.emptyOpenURLMenu();
		// Set the proper values on the first item to be displayed when dropdown closes
		let firstItem = document.getElementById('openurl-menu').menupopup.firstChild;
		if (Zotero.Prefs.get('openURL.resolver')) {
			firstItem.setAttribute("value", Zotero.Prefs.get('openURL.resolver'));
		}
		if (Zotero.Prefs.get('openURL.name')) {
			firstItem.setAttribute("label", Zotero.Prefs.get('openURL.name'));
		}
		// Ensures that arrow keys will navigate the menu in case of subsequent opening on windows
		document.getElementById('openurl-menu').selectedItem = firstItem;
	},

	// Clear all menus, except for the top-most "Custom" menuitem. That item is selected
	// when menu opens and, if removed while still selected, keyboard navigation may break.
	emptyOpenURLMenu() {
		var openURLMenu = document.getElementById('openurl-menu');
		var menupopup = openURLMenu.firstChild;
		while (menupopup.childNodes.length > 1) menupopup.removeChild(menupopup.lastChild);
	},
	
	
	updateOpenURLResolversMenu: function () {
		if (!this._openURLResolvers) {
			Zotero.debug("Resolvers not loaded -- not updating menu");
			return;
		}
		
		var currentResolver = Zotero.Prefs.get('openURL.resolver');
		
		var openURLMenu = document.getElementById('openurl-menu');
		var menupopup = openURLMenu.firstChild;
		let firstItem = menupopup.firstChild;
		this.emptyOpenURLMenu();
		
		menupopup.appendChild(document.createXULElement('menuseparator'));
		
		var selectedName;
		var lastContinent;
		var lastCountry;
		var currentContinentPopup;
		var currentMenuPopup;
		for (let r of this._openURLResolvers) {
			// Create submenus for continents
			if (r.continent != lastContinent) {
				let menu = document.createXULElement('menu');
				menu.setAttribute('label', r.continent);
				openURLMenu.firstChild.appendChild(menu);
				
				currentContinentPopup = currentMenuPopup = document.createXULElement('menupopup');
				menu.appendChild(currentContinentPopup);
				lastContinent = r.continent;
			}
			if (r.country != lastCountry) {
				// If there's a country, create a submenu for it
				if (r.country) {
					let menu = document.createXULElement('menu');
					menu.setAttribute('label', r.country);
					currentContinentPopup.appendChild(menu);
					
					let menupopup = document.createXULElement('menupopup');
					menu.appendChild(menupopup);
					currentMenuPopup = menupopup;
				}
				// Otherwise use the continent popup
				else {
					currentMenuPopup = currentContinentPopup;
				}
				lastCountry = r.country;
			}
			let menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', r.name);
			menuitem.setAttribute('value', r.url);
			menuitem.setAttribute('type', 'checkbox');
			currentMenuPopup.appendChild(menuitem);
			var checked = r.url == Zotero.Prefs.get('openURL.resolver');
			menuitem.setAttribute('checked', checked);
			if (checked) {
				selectedName = r.name;
			}
		}
		
		// From directory
		if (selectedName) {
			openURLMenu.setAttribute('label', selectedName);
			// If we found a match, update stored name
			Zotero.Prefs.set('openURL.name', selectedName);
			firstItem.setAttribute('checked', false);
		}
		// Custom
		else {
			openURLMenu.setAttribute('label', Zotero.getString('general.custom'));
			firstItem.setAttribute('checked', true);
			Zotero.Prefs.clear('openURL.name');
		}
	},
	
	
	handleOpenURLSelected: function (event) {
		event.stopPropagation();
		event.preventDefault();
		
		if (event.target.localName != 'menuitem') {
			Zotero.debug("Ignoring click on " + event.target.localName);
			return;
		}
		
		var openURLMenu = document.getElementById('openurl-menu');
		
		var openURLServerField = document.getElementById('openURLServerField');
		
		// If "Custom" selected, clear URL field
		if (event.target.value == "custom") {
			Zotero.Prefs.clear('openURL.name');
			Zotero.Prefs.set('openURL.resolver', '');
			openURLServerField.value = '';
			openURLServerField.focus();
		}
		else {
			Zotero.Prefs.set('openURL.name', openURLServerField.value = event.target.label);
			Zotero.Prefs.set('openURL.resolver', openURLServerField.value = event.target.value);
		}
	},
	
	onOpenURLCustomized: function () {
		// Change resolver preference to "custom"
		let firstItem = document.getElementById('openurl-menu').menupopup.firstChild;
		firstItem.setAttribute('label', Zotero.getString('general.custom'));
		firstItem.setAttribute('value', 'custom');
		Zotero.Prefs.clear('openURL.name');
	},

	EBOOK_FONT_STACKS: {
		Baskerville: 'Baskerville, serif',
		Charter: 'Charter, serif',
		Futura: 'Futura, sans-serif',
		Georgia: 'Georgia, serif',
		// Helvetica and equivalent-ish
		Helvetica: 'Helvetica, Arial, Open Sans, Liberation Sans, sans-serif',
		Iowan: 'Iowan, serif',
		'New York': 'New York, serif',
		OpenDyslexic: 'OpenDyslexic, eulexia, serif',
		// Windows has called Palatino by many names
		Palatino: 'Palatino, Palatino Linotype, Adobe Palatino, Book Antiqua, URW Palladio L, FPL Neu, Domitian, serif',
		// Times New Roman and equivalent-ish
		'Times New Roman': 'Times New Roman, Linux Libertine, Liberation Serif, serif',
	},

	async _initEbookFontFamilyMenu() {
		let enumerator = Cc["@mozilla.org/gfx/fontenumerator;1"].createInstance(Ci.nsIFontEnumerator);
		let fonts = new Set(await enumerator.EnumerateAllFontsAsync());

		let menulist = document.getElementById('reader-ebook-font-family');
		let popup = menulist.menupopup;
		for (let [label, stack] of Object.entries(this.EBOOK_FONT_STACKS)) {
			// If no font in the stack exists on the user's system, don't add it to the list
			// Exclude the generic family name at the end, which is only there in case no font specified by name in the
			// stack supports a specific character (e.g. non-Latin)
			if (!stack.split(', ').slice(0, -1).some(font => fonts.has(font))) {
				continue;
			}
			
			let menuitem = document.createXULElement('menuitem');
			menuitem.label = label;
			menuitem.value = stack;
			menuitem.style.fontFamily = stack;
			popup.append(menuitem);
		}

		if (popup.childElementCount && fonts.size) {
			popup.append(document.createXULElement('menuseparator'));
		}
		for (let font of fonts) {
			let menuitem = document.createXULElement('menuitem');
			menuitem.label = font;
			menuitem.value = font;
			menuitem.style.fontFamily = `'${font.replace(/'/g, "\\'")}'`;
			popup.append(menuitem);
		}
	},
}
