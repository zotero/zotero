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
	class ItemTreeMenuBar extends XULElement {
		// Menu bar containing View options for manipulating the itemTree table
		// (View > Columns, Sort By, Move Column).
		// Should be added to non-main windows or dialogs containing an itemTree
		// to expose the functionality of table manipulation to keyboard users.
		// On Windows or Linux, this menubar appears on Alt keypress.
		constructor() {
			super();

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
						<menu id="column-move-submenu"
							class="menu-type-library"
							label="&moveColumn.label;">
							<menupopup/>
						</menu>
					</menupopup>
				</menu>
			</menubar>
		`, ['chrome://zotero/locale/standalone.dtd']);
		}


		connectedCallback() {
			this.append(document.importNode(this.content, true));
			this.hidden = true;
		}

		init(itemTree) {
			Zotero.Utilities.Internal.setItemTreeSortKeys(window, itemTree);
			for (let menu of [...this.querySelectorAll(".menu-type-library")]) {
				menu.addEventListener("popupshowing", (event) => {
					Zotero.Utilities.Internal.handleItemTreeMenuShowing(event, menu.id, itemTree);
				});
			}
			if (!Zotero.isMac) {
				// On windows and linux, display and focus menubar on Alt keypress
				document.addEventListener("keydown", (event) => {
					if (event.key == "Alt") {
						this.hidden = !this.hidden;
						document.getElementById("main-menubar").focus();
					}
				}, true);
			}
		}
	}
	
	customElements.define("item-tree-menu-bar", ItemTreeMenuBar);
}
