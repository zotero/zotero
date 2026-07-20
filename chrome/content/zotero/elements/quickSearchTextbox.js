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
						<label id="advanced-search-label" crop="end"/>
						<toolbarbutton class="zotero-clicky advanced-collapse-button" tabindex="0"/>
						<toolbarbutton class="zotero-clicky advanced-close-button" data-l10n-id="advanced-search-close" tabindex="0"/>
					</hbox>
				</deck>
			`, ['chrome://zotero/locale/zotero.dtd']);
		}

		get _searchModes() {
			let modes = {
				titleCreatorYear: Zotero.getString('quickSearch.mode.titleCreatorYear'),
				fields: Zotero.getString('quickSearch.mode.fieldsAndTags'),
				everything: Zotero.getString('quickSearch.mode.everything')
			};
			if (Zotero.Embeddings.isEnabled()) {
				modes.bestMatch = Zotero.getString('quickSearch-mode-similarity');
			}
			return modes;
		}

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
			
			// Add Advanced Search button at the end of the field in main window
			if (document.documentElement.getAttribute('windowtype') === 'navigator:browser') {
				let advancedButton = document.createXULElement('toolbarbutton');
				advancedButton.id = 'zotero-tb-search-advanced-button';
				advancedButton.tabIndex = -1;
				document.l10n.setAttributes(advancedButton, 'quicksearch-advanced-search-button');
				advancedButton.addEventListener('command', (event) => {
					// Don't trigger a quick search via the oncommand handler
					event.stopPropagation();
					// If there's text in the field, seed the Advanced Search with it,
					// reproducing the current quick search mode as editable conditions.
					let mode = Zotero.Prefs.get('search.quicksearch-mode');
					if (this.value) {
						ZoteroPane.openAdvancedSearchFromQuickSearch(this.value, mode);
					}
					else {
						ZoteroPane.toggleAdvancedSearchState('open');
					}
				});
				wrapper.appendChild(advancedButton);
				this._advancedButton = advancedButton;
			}

			this.deck = this.firstElementChild;
			
			this.querySelector('.advanced-collapse-button').addEventListener('command', (event) => {
				event.stopPropagation();
				ZoteroPane.toggleAdvancedSearchState('collapsed');
			});
			this.querySelector('.advanced-close-button').addEventListener('command', (event) => {
				event.stopPropagation();
				// if activated via the keyboard, move focus to the Advanced Search button
				let triggeredByKeyboard = [MouseEvent.MOZ_SOURCE_KEYBOARD, MouseEvent.MOZ_SOURCE_UNKNOWN].includes(event.inputSource);
				ZoteroPane.toggleAdvancedSearchState('closed');
				if (triggeredByKeyboard) {
					this.querySelector('#zotero-tb-search-advanced-button').focus();
				}
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

			this._populateSearchModePopup(popup);
			// Rebuild the menu if the available modes changed since it was built
			// (e.g. semantic search was enabled or disabled in the preferences)
			popup.addEventListener('popupshowing', () => this._syncSearchModePopup());

			return this._searchModePopup = popup;
		}

		_populateSearchModePopup(popup) {
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
		}

		_syncSearchModePopup() {
			let popup = this._searchModePopup;
			if (!popup) {
				return;
			}
			let modes = Object.keys(this._searchModes);
			let current = [...popup.children].map(item => item.value);
			if (current.length === modes.length && current.every((mode, i) => mode === modes[i])) {
				return;
			}
			popup.replaceChildren();
			this._populateSearchModePopup(popup);
			let active = Zotero.Prefs.get('search.quicksearch-mode');
			popup.querySelector(`menuitem[value="${active}"]`)?.setAttribute('checked', 'true');
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

			this._syncSearchModePopup();
			this.searchModePopup.querySelector(`menuitem[value="${mode}"]`)
				.setAttribute('checked', 'true');
			document.l10n.setAttributes(this.searchTextbox.inputField, "quicksearch-input", { placeholder: this._searchModes[mode] });

			// A best-match search can't be converted into Advanced Search
			// conditions, so hide the button in best-match mode
			if (this._advancedButton) {
				this._advancedButton.hidden = mode === 'bestMatch';
			}

			let advancedSearchDeck = document.getElementById('zotero-advanced-search-pane-deck');
			if (advancedSearchDeck) {
				let state = advancedSearchDeck.state;
				let selectedSearchType = advancedSearchDeck.selectedSearchType;
				
				document.l10n.setAttributes(
					this.querySelector('#advanced-search-label'),
					selectedSearchType === 'temporary' ? 'advanced-search' : 'edit-saved-search',
				);
				this.deck.selectedIndex = state === 'closed' ? 0 : 1;
				this.toggleAttribute('advanced-search-open', state !== 'closed');
				this.querySelector('#advanced-search-indicator').dataset.collapsed = state === 'collapsed';
				this.querySelector('.advanced-collapse-button').hidden = selectedSearchType === 'saved';
				document.l10n.setAttributes(
					this.querySelector('.advanced-collapse-button'),
					state === 'collapsed' ? 'advanced-search-expand' : 'advanced-search-collapse'
				);
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
