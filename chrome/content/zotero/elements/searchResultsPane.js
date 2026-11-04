/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
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
	// The pane shown when what's selected is search matches rather than
	// items: a search-results-box per attachment the selected passages came
	// from, showing just those passages.
	//
	// A passage isn't an item, so nothing an item pane says about one -- its
	// fields, its attachments, its tags -- has anything to describe. What
	// there is to show is the passage itself.
	class SearchResultsPane extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="custom-head"></html:div>
			<html:div class="body zotero-view-item"></html:div>
		`);

		_matches = [];

		// @param {Object[]} matches - { itemID, entry }, in the order they're shown
		set matches(matches) {
			this._matches = matches || [];
		}

		get matches() {
			return this._matches;
		}

		init() {
			this._body = this.querySelector('.body');
		}

		render() {
			if (!this.initialized) return;
			this._body.replaceChildren();

			// Grouped by attachment, in the order the matches arrive, so the
			// pane reads in the order the rows do
			let byItem = new Map();
			for (let match of this._matches) {
				if (!byItem.has(match.itemID)) {
					byItem.set(match.itemID, []);
				}
				byItem.get(match.itemID).push(match.entry);
			}

			for (let [itemID, entries] of byItem) {
				let item = Zotero.Items.get(itemID);
				if (!item) {
					continue;
				}
				let box = document.createXULElement('search-results-box');
				box.item = item;
				box.entries = entries;
				// Shown for the rows they quote, so those lines are marked
				box.highlightSnippet = true;
				this._body.append(box);
				// Named, since it stands among other items' boxes; a box here
				// is there to be read, not folded away
				box.summary = item.getDisplayTitle();
				box.collapsible = false;
				box.asyncRender().catch(e => Zotero.logError(e));
			}
		}

		// The buttons the pane's host puts above the cards, if any
		renderCustomHead(callback) {
			let customHead = this.querySelector(".custom-head");
			customHead.replaceChildren();
			if (callback) {
				callback({
					doc: document,
					append: (...args) => customHead.append(...args),
				});
			}
		}
	}

	customElements.define("search-results-pane", SearchResultsPane);
}
