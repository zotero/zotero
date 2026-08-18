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

	// Most match excerpts shown for an item
	const MAX_RESULTS = 5;

	// Why the selected item matched the active best-match search: cards with
	// excerpts of the item's own text around the matches (see
	// Zotero.BestMatch.getMatchingExcerpts()), so they can be read without
	// opening anything. Shown only while a best-match search is active, for
	// items with something to show.
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

		// The query the selected collection rows are ranked by, or false when
		// no best-match search is active. Rows can be duck-typed stand-ins
		// (e.g. the citation dialog's), which implement only part of the row
		// API.
		get _query() {
			// Quick-search state (setSearch()) lives on collection tree row
			// *instances*, and the ones passed down the item pane are
			// re-fetched from the collections view at item-selection time --
			// which can have rebuilt its rows since the items view got its
			// own set. Only the items view's instances are guaranteed to
			// carry the active search, so prefer those; the passed rows are
			// the fallback for hosts without an items view.
			let itemsView = this.closest('item-pane')?.itemsView;
			let rows = itemsView?.collectionTreeRows?.length
				? itemsView.collectionTreeRows
				: this.collectionTreeRows;
			for (let row of rows || []) {
				if (typeof row.getBestMatchQuery == 'function') {
					let query = row.getBestMatchQuery();
					if (query) {
						return query;
					}
				}
			}
			return false;
		}

		// A query change re-renders even when the item didn't change
		get _renderDependencies() {
			return [...super._renderDependencies, this._query];
		}

		render() {}

		async asyncRender() {
			if (!this.initialized) return;
			if (this._isAlreadyRendered("async")) return;

			let item = this.item;
			let query = this._query;
			this._body.replaceChildren();
			if (!item || !query) {
				return;
			}

			let excerpts = [];
			try {
				excerpts = await Zotero.BestMatch.getMatchingExcerpts(query, item.id,
					{ limit: MAX_RESULTS });
			}
			catch (e) {
				Zotero.logError(e);
			}
			// The selection may have moved on while scoring
			if (this.item !== item) {
				return;
			}
			this._count = excerpts.length;
			this._section.setCount(excerpts.length);
			this._updateHidden();
			// Left in the order getMatchingExcerpts() returns them, strongest
			// match first: with only a handful of cards shown, the best one
			// earning the top slot matters more than reading them in
			// document order
			for (let excerpt of excerpts) {
				let row = document.createXULElement('search-result-row');
				row.result = excerpt;
				this._body.append(row);
			}
		}

		// For a file attachment, open it where the activated card's excerpt
		// is: for a PDF with a stored chunk position, scrolled to and
		// highlighting the section; without one (EPUB, snapshot, a lexical
		// excerpt), just open it. Other item types show their matched text in
		// the pane already, so a card activation has nowhere to go.
		_handleActivate = (event) => {
			let row = event.target.closest('search-result-row');
			// The Show More toggle isn't an activation
			if (!row || !this.item || !this.item.isFileAttachment()
					|| event.target.closest('.show-more')) {
				return;
			}
			if (typeof ZoteroPane == 'undefined') {
				return;
			}
			let position = row.result?.position;
			ZoteroPane.viewAttachment(this.item.id, null, false,
				position ? { location: { position } } : undefined)
				.catch(e => Zotero.logError(e));
		};

		_updateHidden() {
			// Visible only during a best-match search; asyncRender hides it
			// again when nothing matched. Deciding emptiness needs the async
			// scoring, so unlike the annotations section this one can't know
			// its final state synchronously -- it appears, then empties out,
			// rather than flickering in late.
			this.hidden = !this.item || !this._query || this.tabType == 'reader'
				|| this._count === 0;
		}
	}

	customElements.define("search-results-box", SearchResultsBox);
}
