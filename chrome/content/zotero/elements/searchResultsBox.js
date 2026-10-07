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

{
	const { ItemPaneSectionElementBase } = ChromeUtils.importESModule(
		"chrome://zotero/content/elements/itemPaneSectionElementBase.mjs",
		{ global: "current" }
	);

	// Why the selected item matched the active best-match search: a card per
	// passage of the item's own text that the search matched (see
	// Zotero.BestMatch.Session#getPreviews()), each carrying the whole
	// passage rather than the line the tree quotes, so a match can be read
	// without opening anything.
	//
	// Shows every passage the selected item matched in. A single passage
	// selected on its own is a search-results-pane, not an item with a
	// section.
	class SearchResultsBox extends ItemPaneSectionElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-search-results" data-pane="search-results">
				<html:div class="body">
				</html:div>
			</collapsible-section>
		`);

		get item() {
			return this._item;
		}

		set item(item) {
			super.item = item instanceof Zotero.Item ? item : null;
			// A new item's emptiness isn't known until asyncRender scores it
			this._count = undefined;
		}

		get collectionTreeRows() {
			return super.collectionTreeRows;
		}

		// The item pane sets collectionTreeRows after item, so this is where
		// everything visibility depends on is finally known
		set collectionTreeRows(collectionTreeRows) {
			super.collectionTreeRows = collectionTreeRows;
			this._updateHidden();
		}

		init() {
			this.initCollapsibleSection();
			this._body = this.querySelector('.body');
			// The header's count placeholder needs a value before the first
			// async render fills in the real one
			this._section.setCount(0);
			// Double-click (or Enter on a focused card) opens the attachment
			// at the chunk
			this._body.addEventListener('dblclick', this._handleActivate);
			this._body.addEventListener('keydown', (event) => {
				if (event.key == 'Enter') {
					this._handleActivate(event);
				}
			});
		}

		get _itemsView() {
			return this.closest('item-pane')?.itemsView ?? null;
		}

		// The session holding the passages of the active best-match search,
		// or null when no such search is running. It derives a preview once
		// per item and keeps it, so reading one costs nothing after the first
		// time.
		get _session() {
			return this._itemsView?.bestMatchSession ?? null;
		}

		// A new search re-renders even when the item didn't change
		get _renderDependencies() {
			return [...super._renderDependencies, this._session];
		}

		render() {}

		async asyncRender() {
			if (!this.initialized) return;
			if (this._isAlreadyRendered("async")) return;

			let item = this.item;
			let session = this._session;
			this._body.replaceChildren();
			if (!item || !session) {
				this._count = 0;
				this._updateHidden();
				return;
			}

			let preview = session.getPreviews(item.id);
			if (preview?.state == 'pending') {
				// Previews are derived before the tree's rows appear, but a
				// selection can still land mid-re-score, so settle this one
				// outright
				await session.fill([item.id]);
				// The selection, or the search, may have moved on while
				// deriving
				if (this.item !== item || this._session !== session) {
					return;
				}
				preview = session.getPreviews(item.id);
			}
			let entries = preview?.state == 'filled' ? preview.entries : [];
			this._count = entries.length;
			this._section.setCount(entries.length);
			this._updateHidden();
			// Left in the order the preview holds them, strongest match
			// first: with only a handful of cards shown, the best one earning
			// the top slot matters more than reading them in document order
			for (let entry of entries) {
				let row = document.createXULElement('search-result-row');
				row.result = entry;
				this._body.append(row);
			}
		}

		// Open the activated card's attachment at its passage
		_handleActivate = (event) => {
			let row = event.target.closest('search-result-row');
			// The Show More toggle isn't an activation
			if (!row || !this.item || event.target.closest('.show-more')) {
				return;
			}
			if (typeof ZoteroPane == 'undefined') {
				return;
			}
			ZoteroPane.viewSearchMatch(this.item.id, row.result, event)
				.catch(e => Zotero.logError(e));
		};

		_updateHidden() {
			// Visible only during a best-match search; asyncRender hides it
			// again when nothing matched. Deciding emptiness needs the async
			// derivation, so unlike the annotations section this one can't
			// know its final state synchronously -- it appears, then empties
			// out, rather than flickering in late.
			this.hidden = !this.item || !this._session || this.tabType == 'reader'
				|| this._count === 0;
		}
	}

	customElements.define("search-results-box", SearchResultsBox);
}
