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
	// How long a selection rests before it's searched
	const SEARCH_DELAY = 500;
	// Most attachments shown for one search
	const MAX_ATTACHMENTS = 10;

	// Content in the library similar to the text selected in a reader tab:
	// the passages a semantic search for the selection finds in the
	// library's other attachments, grouped under the documents they come
	// from, each with how relevant it is. Searches only while in view, and
	// keeps each tab's last results until that tab's selection changes.
	//
	// A selection is learned from the reader's selection popup appearing for
	// it, which says nothing when a selection is cleared -- the last results
	// stay anyway.
	class SimilarContext extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="similar-context-message"/>
			<html:div class="similar-context-results" hidden="true"/>
		`);

		_tabID = null;

		// Per tab, the text last selected in it
		_selections = new Map();

		// Per tab, its last search: { text, state, groups, stale }, the state
		// 'searching', 'found', 'none' or 'unavailable', and `stale` the
		// attachments whose annotations changed since its cards were read
		_searches = new Map();

		_session = null;

		// The search drawn in the results
		_shown = null;

		init() {
			this._message = this.querySelector('.similar-context-message');
			this._results = this.querySelector('.similar-context-results');
			this._updateSoon = Zotero.Utilities.debounce(() => this.update(), SEARCH_DELAY);
			Zotero.Reader.registerEventListener('renderTextSelectionPopup', this._handleSelectionPopup);
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'similarContext');
			this.render();
		}

		destroy() {
			Zotero.Reader.unregisterEventListener('renderTextSelectionPopup', this._handleSelectionPopup);
			Zotero.Notifier.unregisterObserver(this._notifierID);
			this._session?.dispose();
		}

		// The reader tab whose selection is searched
		get tabID() {
			return this._tabID;
		}

		set tabID(tabID) {
			if (this._tabID == tabID) {
				return;
			}
			this._tabID = tabID;
			this.render();
			this.update();
		}

		// Whether it's in view: the context pane is open and showing it
		get shown() {
			return this.parentElement?.selectedPanel == this
				&& !this.closest('context-pane')?.collapsed;
		}

		// The reader shows its popup for a selection, in either view; the
		// popup itself is left as it is
		_handleSelectionPopup = ({ reader, params }) => {
			let text = params?.annotation?.text;
			if (!reader?.tabID || !text) {
				return;
			}
			this._selections.set(reader.tabID, text);
			if (reader.tabID == this._tabID) {
				this._updateSoon();
			}
		};

		// An annotation saved or gone, wherever it was made: every tab's
		// results with its attachment are marked to redraw that attachment's
		// cards -- those on screen now, the rest when next drawn. A deleted
		// annotation's parent isn't known any more, so a deletion marks
		// every attachment.
		notify(event, type, ids) {
			if (!['add', 'modify', 'delete'].includes(event)) {
				return;
			}
			let changed = null;
			if (event != 'delete') {
				changed = new Set(ids
					.map(id => Zotero.Items.get(id))
					.filter(item => item?.isAnnotation())
					.map(item => item.parentID));
				if (!changed.size) {
					return;
				}
			}
			for (let search of this._searches.values()) {
				for (let { itemID } of search.groups) {
					if (!changed || changed.has(itemID)) {
						search.stale.add(itemID);
					}
				}
			}
			this._refreshStale();
		}

		// Redraw the cards of the drawn results' attachments whose
		// annotations changed since they were read
		_refreshStale() {
			let search = this._shown;
			if (!search?.stale.size || this._results.hidden) {
				return;
			}
			for (let group of this._results.querySelectorAll('.similar-context-group')) {
				if (search.stale.delete(parseInt(group.dataset.itemId))) {
					this._refreshAnnotations(group).catch(e => Zotero.logError(e));
				}
			}
		}

		// Read a document's annotations over every card's passage at once --
		// one read of the attachment -- and hand each card its own
		async _refreshAnnotations(group) {
			let rows = [...group.querySelectorAll('search-result-row')];
			let anchors = rows.map(row => row.result?.anchor ?? null);
			if (!anchors.some(Boolean)) {
				return;
			}
			let read = await Zotero.SDT.readAnchors(parseInt(group.dataset.itemId), anchors, { isPriority: true });
			if (read.ok) {
				rows.forEach((row, i) => row.isConnected && row.setAnnotations(read.chunks[i]));
			}
		}

		/**
		 * Search the tab's last selection when in view and unlike the one last
		 * searched for the tab
		 */
		async update() {
			if (!this.initialized || !this.shown || !this._tabID) {
				return;
			}
			let tabID = this._tabID;
			let reader = Zotero.Reader.getByTabID(tabID);
			let text = this._selections.get(tabID)?.trim();
			if (!reader || !text || text == this._searches.get(tabID)?.text) {
				return;
			}
			let search = { text, state: 'searching', groups: [], stale: new Set() };
			this._searches.set(tabID, search);
			this.render();

			this._session?.dispose();
			let session = this._session = Zotero.BestMatch.createSession(text, { engine: 'semantic' });
			try {
				search.groups = await this._findMatches(session, reader.itemID);
				search.state = search.groups.length ? 'found' : 'none';
			}
			catch (e) {
				if (!(e instanceof Zotero.Embeddings.IndexNotReadyError)) {
					Zotero.logError(e);
				}
				search.state = 'unavailable';
			}
			// A newer search disposed this one before it was done, so it's
			// searched again when its tab is next in view
			if (session !== this._session) {
				if (this._searches.get(tabID) == search) {
					this._searches.delete(tabID);
				}
				return;
			}
			this.render();
		}

		// The attachments in the attachment's library that best match the
		// session's query, strongest first, each as { itemID, fraction,
		// entries }: how relevant it is, as the tree's bar shows it, and its
		// strongest passages. The attachment itself is left out, since its
		// own text matches it best.
		async _findMatches(session, attachmentID) {
			if (!Zotero.Embeddings.isEnabled()) {
				throw new Zotero.Embeddings.IndexNotReadyError('Semantic search is disabled');
			}
			let attachment = Zotero.Items.get(attachmentID);
			let candidateIDs = (await Zotero.DB.columnQueryAsync(
				"SELECT itemID FROM items WHERE libraryID=? "
					+ "AND itemID NOT IN (SELECT itemID FROM deletedItems)",
				[attachment.libraryID]
			)).filter(id => id != attachmentID);
			let scores = await session.score(candidateIDs);
			let matched = [...scores]
				.filter(([itemID]) => session.getPreviews(itemID))
				.sort((a, b) => b[1] - a[1])
				.slice(0, MAX_ATTACHMENTS);
			await session.fill(matched.map(([itemID]) => itemID));
			let groups = [];
			for (let [itemID] of matched) {
				let preview = session.getPreviews(itemID);
				if (preview?.state != 'filled') {
					continue;
				}
				groups.push({
					itemID,
					// The meaning track of the tree's bar, the only engine here
					fraction: session.barFractions.get(Zotero.Items.get(itemID).treeViewID)?.semantic ?? 0,
					entries: preview.entries.slice(0, Zotero.BestMatch.MAX_QUOTED_PASSAGES)
				});
			}
			return groups;
		}

		render() {
			if (!this.initialized) {
				return;
			}
			let search = this._tabID ? this._searches.get(this._tabID) : null;
			let state = search?.state ?? 'empty';
			let found = state == 'found';
			this._message.hidden = found;
			this._results.hidden = !found;
			if (!found) {
				document.l10n.setAttributes(this._message, `similar-context-${state}`);
				return;
			}
			if (this._shown !== search) {
				this._shown = search;
				this._results.replaceChildren(...search.groups.map(group => this._renderGroup(group)));
				// Other results read from their top, wherever the last were
				this._results.scrollTop = 0;
			}
			// Annotations changed while these results weren't drawn
			this._refreshStale();
		}

		// A document's matches: its type's icon and title, its creator and
		// year beside how relevant it is, then a card per passage
		_renderGroup({ itemID, fraction, entries }) {
			let attachment = Zotero.Items.get(itemID);
			let item = attachment.parentItem ?? attachment;
			let group = document.createElement('div');
			group.className = 'similar-context-group';
			group.dataset.itemId = itemID;

			let head = document.createElement('div');
			head.className = 'head';
			let icon = document.createElement('span');
			icon.className = 'icon icon-css icon-item-type';
			icon.setAttribute('data-item-type', item.getItemTypeIconName(true));
			let title = document.createElement('div');
			title.className = 'title';
			title.textContent = item.getDisplayTitle();
			head.append(icon, title);

			let meta = document.createElement('div');
			meta.className = 'meta';
			let creatorYear = document.createElement('span');
			creatorYear.className = 'creator-year';
			let firstCreator = item.isRegularItem() ? item.getField('firstCreator') : '';
			let year = item.isRegularItem() ? item.getField('year') : '';
			creatorYear.textContent = [firstCreator, year && `(${year})`].filter(Boolean).join(' ');
			let bar = document.createElement('span');
			bar.className = 'relevance-bar';
			let fill = document.createElement('span');
			fill.className = 'relevance-bar-fill';
			fill.style.width = Math.round(fraction * 100) + '%';
			bar.append(fill);
			meta.append(creatorYear, bar);

			let rows = document.createElement('div');
			rows.className = 'rows';
			for (let entry of entries) {
				let row = document.createXULElement('search-result-row');
				row.itemID = itemID;
				row.result = entry;
				rows.append(row);
			}
			group.append(head, meta, rows);
			return group;
		}
	}

	customElements.define('similar-context', SimilarContext);
}
