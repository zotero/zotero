/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2025 Corporation for Digital Scholarship
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
	class ScaffoldItemPreviews extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="switcher">
				<button label="&lt;" class="previous"/>
				<html:div><html:span class="current"/>/<html:span class="max"/></html:div>
				<button label="&gt;" class="next"/>
			</html:div>
			<deck/>
		`);
		
		_jsonItems = [];

		get jsonItems() {
			return this._jsonItems;
		}

		set jsonItems(jsonItems) {
			this._jsonItems = jsonItems;
			this.render();
		}

		init() {
			this.querySelector('.previous').addEventListener('command', () => {
				this.querySelector('deck').selectedIndex--;
				this.render();
			});
			this.querySelector('.next').addEventListener('command', () => {
				this.querySelector('deck').selectedIndex++;
				this.render();
			});
			
			this.render();
		}

		render() {
			if (!this.initialized) return;
			
			let deck = this.querySelector('deck');
			for (let [i, jsonItem] of this._jsonItems.entries()) {
				if (deck.children[i]?.jsonItem === jsonItem) {
					continue;
				}
				let preview = document.createXULElement('scaffold-item-preview');
				preview.jsonItem = jsonItem;
				deck.append(preview);
			}
			while (deck.children.length > this._jsonItems.length) {
				deck.lastElementChild.remove();
			}
			if (deck.selectedIndex >= deck.children.length) {
				deck.selectedIndex = 0;
			}
			
			let switcher = this.querySelector('.switcher');
			if (deck.children.length > 1) {
				switcher.hidden = false;
				switcher.querySelector('.current').textContent = deck.selectedIndex + 1;
				switcher.querySelector('.max').textContent = deck.children.length;
			}
			else {
				switcher.hidden = true;
			}
		}
	}

	customElements.define('scaffold-item-previews', ScaffoldItemPreviews);
}
