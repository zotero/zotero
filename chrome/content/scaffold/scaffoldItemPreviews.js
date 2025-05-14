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

		_deck;
		
		_switcher;

		_itemPairs = [];

		init() {
			this._deck = this.querySelector('deck');
			this._switcher = this.querySelector('.switcher');
			
			this.querySelector('.previous').addEventListener('command', () => {
				this._deck.selectedIndex--;
				this._renderSwitcher();
			});
			this.querySelector('.next').addEventListener('command', () => {
				this._deck.selectedIndex++;
				this._renderSwitcher();
			});
		}
		
		clearItemPairs() {
			this._itemPairs = [];
			this._deck.selectedIndex = 0;
			this._deck.replaceChildren();
			this._renderSwitcher();
			
			this.hidden = true;
		}

		/**
		 * @param {any} preItem JSON item
		 * @param {any} [postItem] JSON item (defaults to cleaned version of preItem)
		 * @returns {ScaffoldItemPreview}
		 */
		addItemPair(preItem, postItem) {
			let preview = document.createXULElement('scaffold-item-preview');
			preview.itemPair = [preItem, postItem];
			this._deck.append(preview);
			this._renderSwitcher();
			
			if (this.hidden) {
				let splitterPane = this.closest('splitter + *');
				if (splitterPane) {
					// If the pane hasn't been resized, it won't have a fixed width,
					// so it'll grow when wrapping text is added. Fix its width now.
					splitterPane.style.width = splitterPane.getBoundingClientRect().width + 'px';
				}
				this.hidden = false;
			}
			
			return preview;
		}
		
		_renderSwitcher() {
			let switcher = this.querySelector('.switcher');
			if (this._deck.children.length > 1) {
				switcher.hidden = false;
				switcher.querySelector('.current').textContent = this._deck.selectedIndex + 1;
				switcher.querySelector('.max').textContent = this._deck.children.length;
			}
			else {
				switcher.hidden = true;
			}
		}
	}

	customElements.define('scaffold-item-previews', ScaffoldItemPreviews);
}
