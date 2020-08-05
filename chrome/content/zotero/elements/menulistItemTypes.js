/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
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
	// The menulist CE is defined lazily. Create one now to get menulist defined,
	// allowing us to inherit from it.
	if (!customElements.get("menulist")) {
		delete document.createXULElement("menulist");
	}
	
	class ItemTypeMenuList extends customElements.get("menulist") {
		constructor() {
			super();
		}
		
		connectedCallback() {
			super.connectedCallback();
			
			if (this.delayConnectedCallback()) {
				return;
			}
			
			if (this.menupopup) {
				return;
			}
			
			var t = Zotero.ItemTypes.getTypes();
			
			// Sort by localized name
			var itemTypes = [];
			for (let i = 0; i < t.length; i++) {
				itemTypes.push({
					name: t[i].name,
					localized: Zotero.ItemTypes.getLocalizedString(t[i].id)
				});
			}
			var collation = Zotero.getLocaleCollation();
			itemTypes.sort((a, b) => collation.compareString(1, a.localized, b.localized));
			
			for (let i = 0; i < itemTypes.length; i++) {
				let name = itemTypes[i].name;
				if (name != 'attachment' && name != 'note' && name != 'annotation') {
					this.appendItem(itemTypes[i].localized, itemTypes[i].name);
				}
			}
			
			if (this._preconnectedValue) {
				Zotero.debug("SETTING PRECONNECT");
				this.value = this._preconnectedValue;
			}
		}
		
		set value(value) {
			if (!this.itemCount) {
				Zotero.debug("STORING PRECONNECT");
				this._preconnectedValue = value;
			}
			else {
				Zotero.debug("SETTING VAL NOW " + value);
				Zotero.debug(this.itemCount);
				Zotero.debug(value);
				super.value = value;
			}
		}
	}
	
	customElements.define("menulist-item-types", ItemTypeMenuList, { extends: "menulist" });
}
