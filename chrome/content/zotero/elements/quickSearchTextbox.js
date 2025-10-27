/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2022 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
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

"use strict";

{
	class QuickSearchTextbox extends XULElement {
		constructor() {
			super();

			this.searchTextbox = null;
			MozXULElement.insertFTLIfNeeded("zotero.ftl");
			this.content = MozXULElement.parseXULToFragment(`
				<hbox id="search-wrapper" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
				</hbox>
			`, ['chrome://zotero/locale/zotero.dtd']);
		}

		_searchModes = {
			titleCreatorYear: Zotero.getString('quickSearch.mode.titleCreatorYear'),
			fields: Zotero.getString('quickSearch.mode.fieldsAndTags'),
			everything: Zotero.getString('quickSearch.mode.everything')
		};

		_searchModePopup = null;

		get value() {
			return this.searchTextbox.value;
		}

		set value(val) {
			this.searchTextbox.value = val;
		}

		connectedCallback() {
			let content = document.importNode(this.content, true);
			this.append(content);
			// Top level wrapper that will have dropmarker and search-textbox as children.
			// That way, we can move focus-ring between these two siblings regardless of
			// their shadom DOMs.
			let wrapper = this._id('search-wrapper');

			// Need to create an inner shadow DOM so that global.css styles,
			// which we need for the menupopup, don't break the search textbox
			let dropmarkerHost = document.createXULElement('hbox');
			let dropmarkerShadow = dropmarkerHost.attachShadow({ mode: 'open' });
			document.l10n.connectRoot(dropmarkerHost.shadowRoot);
			dropmarkerHost.id = 'zotero-tb-search-dropmarker';

			let s1 = document.createElement("link");
			s1.rel = "stylesheet";
			s1.href = "chrome://zotero-platform/content/zotero.css";

			let s2 = document.createElement("link");
			s2.rel = "stylesheet";
			s2.href = "chrome://global/skin/global.css";

			let dropmarker = document.createXULElement('button');
			dropmarker.id = "zotero-tb-search-menu-button";
			dropmarker.tabIndex = 0;
			dropmarker.setAttribute("type", "menu");
			dropmarker.setAttribute("data-l10n-id", "quicksearch-mode");
			dropmarker.append(this.searchModePopup);

			dropmarkerShadow.append(s1, s2, dropmarker);

			let searchBox = document.createXULElement("search-textbox");
			searchBox.id = "zotero-tb-search-textbox";
			// Enable applying styles to the input field
			searchBox.inputField.setAttribute("part", "search-input");
			this.searchTextbox = searchBox;
			
			wrapper.appendChild(dropmarkerHost);
			wrapper.appendChild(searchBox);
			
			
			// If Alt-Up/Down, show popup
			this.addEventListener('keypress', (event) => {
				if (event.altKey && (event.keyCode == event.DOM_VK_UP || event.keyCode == event.DOM_VK_DOWN)) {
					dropmarker.open = true;
					event.preventDefault();
				}
			});
		}

		get searchModePopup() {
			if (this._searchModePopup) {
				return this._searchModePopup;
			}

			let popup = document.createXULElement('menupopup');
			popup.id = "search-mode-popup";
			popup.toggleAttribute("needsgutter", true);

			for (let [mode, label] of Object.entries(this._searchModes)) {
				let item = document.createXULElement('menuitem');
				item.setAttribute('type', 'radio');
				item.label = label;
				item.value = mode;

				item.addEventListener('command', () => {
					Zotero.Prefs.set("search.quicksearch-mode", mode);
					this.updateMode();

					if (this.value) {
						this.dispatchEvent(new Event('command'));
					}
				});

				popup.append(item);
			}
			
			// "Apply to All Collections"
			let separatorOne = document.createXULElement('menuseparator');
			popup.append(separatorOne);
			let retainAcrossCollections = document.createXULElement('menuitem');
			retainAcrossCollections.label = Zotero.getString("quicksearch-apply-to-all");
			retainAcrossCollections.addEventListener("command", () => {
				let current = Zotero.Prefs.get("search.quicksearch-apply-to-all");
				Zotero.Prefs.set("search.quicksearch-apply-to-all", !current);
			});
			popup.append(retainAcrossCollections);

			// Add Advanced Search menu item in main window
			if (document.documentElement.getAttribute('windowtype') === 'navigator:browser') {
				let separatorTwo = document.createXULElement('menuseparator');
				popup.append(separatorTwo);
				let advancedSearchOption = document.createXULElement('menuitem');
				advancedSearchOption.label = Zotero.getString("zotero.toolbar.advancedSearch");
				advancedSearchOption.addEventListener("command", () => {
					ZoteroPane.openAdvancedSearchWindow();
				});
				popup.append(advancedSearchOption);
			}

			// Set some checked states when the popup appears
			popup.addEventListener('popupshowing', () => {
				retainAcrossCollections.setAttribute("checked", Zotero.Prefs.get("search.quicksearch-apply-to-all"));
			});
			
			return this._searchModePopup = popup;
		}

		updateMode() {
			let mode = Zotero.Prefs.get("search.quicksearch-mode");

			if (!this._searchModes[mode]) {
				Zotero.Prefs.set("search.quicksearch-mode", "fields");
				mode = 'fields';
			}

			this.searchModePopup.querySelector(`menuitem[value="${mode}"]`)
				.setAttribute('checked', 'true');
			document.l10n.setAttributes(this.searchTextbox.inputField, "quicksearch-input", { placeholder: this._searchModes[mode] });
		}

		_id(id) {
			return this.querySelector(`[id=${id}]`);
		}
	}
	
	customElements.define("quick-search-textbox", QuickSearchTextbox);
}
