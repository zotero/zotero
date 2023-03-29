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
	// The search-textbox CE is defined lazily. Create one now to get
	// search-textbox defined, allowing us to inherit from it.
	if (!customElements.get("search-textbox")) {
		delete document.createXULElement("search-textbox");
	}
	
	class QuickSearchTextbox extends customElements.get("search-textbox") {
		_searchModes = {
			titleCreatorYear: Zotero.getString('quickSearch.mode.titleCreatorYear'),
			fields: Zotero.getString('quickSearch.mode.fieldsAndTags'),
			everything: Zotero.getString('quickSearch.mode.everything')
		};

		_searchModePopup = null;

		connectedCallback() {
			super.connectedCallback();

			if (this.delayConnectedCallback()) {
				return;
			}

			// Need to create an inner shadow DOM so that global.css styles,
			// which we need for the menupopup, don't break the search textbox
			let dropmarkerHost = document.createXULElement('hbox');
			let dropmarkerShadow = dropmarkerHost.attachShadow({ mode: 'open' });

			let s1 = document.createElement("link");
			s1.rel = "stylesheet";
			s1.href = "chrome://zotero-platform/content/zotero.css";

			let s2 = document.createElement("link");
			s2.rel = "stylesheet";
			s2.href = "chrome://global/skin/global.css";

			let dropmarker = document.createXULElement('button');
			dropmarker.id = "zotero-tb-search-menu-button";
			dropmarker.tabIndex = -1;
			dropmarker.setAttribute("type", "menu");
			dropmarker.append(this.searchModePopup);

			dropmarkerShadow.append(s1, s2, dropmarker);

			this.inputField.before(dropmarkerHost);

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
			this.placeholder = this._searchModes[mode];
		}
	}
	
	customElements.define("quick-search-textbox", QuickSearchTextbox);
}
