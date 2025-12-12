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
	class AdvancedSearchDeck extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<deck>
				<advanced-search-pane id="zotero-temporary-advanced-search-pane" type="temporary"/>
				<advanced-search-pane id="zotero-saved-advanced-search-pane" type="saved"/>
			</deck>
		`);

		init() {
			this.hidden = true;
			this._state = 'closed';
			
			this.deck = this.firstChild;
		}

		get state() {
			return this._state;
		}

		set state(state) {
			switch (state) {
				case 'open':
					this.hidden = false;
					break;
				case 'collapsed':
				case 'closed':
					this.hidden = true;
					break;
				default:
					throw new Error('Invalid state: ' + state);
			}
			this._state = state;
		}
		
		get selectedSearchType() {
			return this.deck.selectedIndex === 0 ? 'temporary' : 'saved';
		}
		
		set selectedSearchType(selectedSearchType) {
			switch (selectedSearchType) {
				case 'temporary':
					this.deck.selectedIndex = 0;
					break;
				case 'saved':
					this.deck.selectedIndex = 1;
					break;
			}
		}
		
		get pane() {
			return this.deck.selectedPanel;
		}
	}
	customElements.define("advanced-search-deck", AdvancedSearchDeck);
}
