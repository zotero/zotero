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


class ItemTreeMenuBar extends XULElement {
	// Menu bar containing View options for manipulating the itemTree table
	// (View > Columns, Sort By, Move Column).
	// Added to windows without a menubar by ItemTree.init()
	// to expose the functionality of table manipulation to keyboard users.
	// On Windows or Linux, this menubar appears on Alt keypress.
	constructor() {
		super();
		this._inactiveTimeout = null;

		this.content = MozXULElement.parseXULToFragment(`
		<keyset id="sortSubmenuKeys">
			<key id="key_sortCol0"/>
			<key id="key_sortCol1"/>
			<key id="key_sortCol2"/>
			<key id="key_sortCol3"/>
			<key id="key_sortCol4"/>
			<key id="key_sortCol5"/>
			<key id="key_sortCol6"/>
			<key id="key_sortCol7"/>
			<key id="key_sortCol8"/>
			<key id="key_sortCol9"/>
		</keyset>
		<menubar id="main-menubar">
			<menu id="view-menu"
					label="&viewMenu.label;"
					accesskey="&viewMenu.accesskey;">
				<menupopup id="menu_viewPopup">
					<menu id="column-picker-submenu"
							class="menu-type-library"
							label="&columns.label;">
						<menupopup/>
					</menu>
					<menu id="sort-submenu"
							class="menu-type-library"
							label="&sortBy.label;">
						<menupopup/>
					</menu>
				</menupopup>
			</menu>
		</menubar>
	`, ['chrome://zotero/locale/standalone.dtd']);
	}

	get suppressed() {
		return this.hasAttribute("no-menubar");
	}

	set suppressed(val) {
		this.toggleAttribute("no-menubar", !!val);
		for (let menu of this.querySelectorAll("menu")) {
			menu.hidden = this.suppressed;
		}
	}


	connectedCallback() {
		this.append(document.importNode(this.content, true));
		this.setAttribute("inactive", "");
	}

	// Show View > Columns, Sort By menus for windows that have an itemTree
	static handleItemTreeMenuShowing(event, menu, itemsView) {
		if (event.target !== menu.menupopup) {
			return;
		}
		menu.menupopup.replaceChildren();
		if (menu.id == "column-picker-submenu") {
			// View > Columns
			itemsView.buildColumnPickerMenu(menu.menupopup);
		}
		else if (menu.id == "sort-submenu") {
			// View > Sort By
			itemsView.buildSortMenu(menu.menupopup);
			for (let i = 0; i < 10; i++) {
				if (!menu.menupopup.children[i]) {
					break;
				}
				menu.menupopup.children[i].setAttribute('key', 'key_sortCol' + i);
			}
		}
	}

	// Set the access keys for menuitems to sort the itemTree
	static setItemTreeSortKeys(itemsView) {
		let sortSubmenuKeys = document.getElementById('sortSubmenuKeys');
		for (let i = 0; i < 10; i++) {
			let key = sortSubmenuKeys.children[i];
			key.setAttribute('modifiers', Zotero.isMac ? 'accel alt control' : 'alt');
			key.setAttribute('key', (i + 1) % 10);
			key.addEventListener('command', () => {
				if (!window.Zotero_Tabs || window.Zotero_Tabs.selectedType == 'library') {
					itemsView.toggleSort(i, true);
				}
			});
		}
	}

	init(itemTree) {
		this.constructor.setItemTreeSortKeys(itemTree);
		for (let menu of [...this.querySelectorAll(".menu-type-library")]) {
			menu.addEventListener("popupshowing", (event) => {
				this.constructor.handleItemTreeMenuShowing(event, menu, itemTree);
			});
		}
		if (!Zotero.isMac) {
			// On Alt keypress, DOMMenuBarActive event is fired. On click or tab away from the menubar, DOMMenuBarInactive is fired.
			// Handle these event to display/hide menubar accordingly.
			// If a selected menu is clicked, DOMMenuBarInactive event will fire first followed by DOMMenuBarActive.
			// To keep the menu visible in that case, hide inactive menu after delay if it is not cancelled.
			// https://searchfox.org/mozilla-central/source/browser/base/content/browser-customization.js#165
			document.addEventListener("DOMMenuBarInactive", (_) => {
				this._inactiveTimeout = setTimeout(() => {
					this._inactiveTimeout = null;
					this.setAttribute("inactive", "");
				});
			});
			document.addEventListener("DOMMenuBarActive", (_) => {
				if (this._inactiveTimeout) {
					clearTimeout(this._inactiveTimeout);
					this._inactiveTimeout = null;
				}
				this.removeAttribute("inactive");
			});
		}
	}
}

customElements.define("item-tree-menu-bar", ItemTreeMenuBar);
