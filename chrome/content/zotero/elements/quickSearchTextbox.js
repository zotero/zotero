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
				<deck id="search-deck">
					<hbox id="search-wrapper">
					</hbox>
					<hbox id="advanced-search-indicator">
						<label id="advanced-search-label"/>
						<toolbarbutton class="zotero-clicky advanced-collapse-button" tabindex="0"/>
						<toolbarbutton class="zotero-clicky advanced-close-button" tabindex="0"/>
					</hbox>
				</deck>
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
			
			this.deck = this.firstElementChild;
			
			this.querySelector('.advanced-collapse-button').addEventListener('command', () => {
				ZoteroPane.toggleAdvancedSearchState('collapsed');
			});
			this.querySelector('.advanced-close-button').addEventListener('command', () => {
				ZoteroPane.toggleAdvancedSearchState('closed');
			});
			
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
			
			// Add Advanced Search menu item in main window
			if (document.documentElement.getAttribute('windowtype') === 'navigator:browser') {
				let separator = document.createXULElement('menuseparator');
				popup.append(separator);
				let advancedSearchOption = document.createXULElement('menuitem');
				document.l10n.setAttributes(advancedSearchOption, 'menuitem-advanced-search');
				advancedSearchOption.addEventListener('command', () => {
					ZoteroPane.toggleAdvancedSearchState('open');
				});
				popup.append(advancedSearchOption);
			}
			
			return this._searchModePopup = popup;
		}
		
		onCollectionSelected() {
			this.searchTextbox.value = '';
			this.updateMode();
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

			let advancedSearchDeck = document.getElementById('zotero-advanced-search-pane-deck');
			if (advancedSearchDeck) {
				let state = advancedSearchDeck.state;
				let selectedSearchType = advancedSearchDeck.selectedSearchType;
				
				document.l10n.setAttributes(
					this.querySelector('#advanced-search-label'),
					selectedSearchType === 'temporary' ? 'advanced-search' : 'edit-saved-search',
				);
				this.deck.selectedIndex = state === 'closed' ? 0 : 1;
				this.querySelector('#advanced-search-indicator').dataset.collapsed = state === 'collapsed';
				this.querySelector('.advanced-collapse-button').hidden = selectedSearchType === 'saved';
			}
		}
		
		focus(options) {
			if (this.deck.selectedIndex === 0) {
				this._searchModePopup.flattenedTreeParentNode.focus(options);
			}
			else {
				Services.focus.moveFocus(window, this.deck.selectedPanel, Services.focus.MOVEFOCUS_FORWARD, 0);
			}
		}

		_id(id) {
			return this.querySelector(`[id=${id}]`);
		}
	}
	
	customElements.define("quick-search-textbox", QuickSearchTextbox);
}
