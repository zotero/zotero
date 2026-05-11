/* global Zotero */

import * as ReadingStatus from './readingStatus.js';

const DRAG_MIME = 'application/x-zotero-kanban-item';

const COLUMNS = [
	{ key: '', l10nID: 'reading-status-kanban-none' },
	{ key: 'Unread', l10nID: 'reading-status-unread' },
	{ key: 'In Progress', l10nID: 'reading-status-in-progress' },
	{ key: 'Done', l10nID: 'reading-status-done' },
	{ key: 'Abandoned', l10nID: 'reading-status-abandoned' },
];

export async function openKanbanTab(window, { onOpen, onClose } = {}) {
	let { Zotero_Tabs, ZoteroPane, document } = window;
	let collectionTreeRow = ZoteroPane.getCollectionTreeRow();
	if (!collectionTreeRow) {
		// Nothing selected in the sidebar — nothing to put on the board.
		return;
	}
	let baseTitle = Zotero.getString('reading-status-kanban-title');
	let suffix = '';
	try {
		suffix = collectionTreeRow.getName() || '';
	}
	catch {
		// no-op
	}
	let title = suffix ? `${baseTitle} — ${suffix}` : baseTitle;

	let board;
	let { id, container } = Zotero_Tabs.add({
		type: 'kanban',
		title,
		select: true,
		data: {
			libraryID: collectionTreeRow.ref?.libraryID,
		},
		onClose: () => {
			if (board) board.destroy();
			onClose?.(id);
		},
	});
	onOpen?.(id);
	board = new KanbanBoard({ window, document, container, collectionTreeRow, tabID: id });
	await board.init();
}


class KanbanBoard {
	constructor({ window, document, container, collectionTreeRow, tabID }) {
		this.window = window;
		this.document = document;
		this.container = container;
		this.collectionTreeRow = collectionTreeRow;
		this.tabID = tabID;
		this.items = [];
		this._refreshTimer = null;
		this._notifierID = null;
		this._destroyed = false;
	}

	async init() {
		this._build();
		this._notifierID = Zotero.Notifier.registerObserver(
			{ notify: () => this._scheduleRefresh() },
			['item'],
			'reading-status-kanban'
		);
		await this.refresh();
	}

	destroy() {
		this._destroyed = true;
		if (this._refreshTimer) {
			this.window.clearTimeout(this._refreshTimer);
			this._refreshTimer = null;
		}
		if (this._notifierID) {
			Zotero.Notifier.unregisterObserver(this._notifierID);
			this._notifierID = null;
		}
		while (this.container.firstChild) {
			this.container.firstChild.remove();
		}
	}

	_build() {
		this.container.classList.add('kanban-tab-content');
		this.board = this.document.createElement('div');
		this.board.className = 'kanban-board';
		this.container.appendChild(this.board);

		this.columnEls = new Map();
		for (let col of COLUMNS) {
			let columnEl = this.document.createElement('div');
			columnEl.className = 'kanban-column';
			columnEl.dataset.statusKey = col.key;

			let header = this.document.createElement('div');
			header.className = 'kanban-column-header';
			let titleEl = this.document.createElement('span');
			titleEl.className = 'kanban-column-title';
			titleEl.textContent = Zotero.getString(col.l10nID);
			let countEl = this.document.createElement('span');
			countEl.className = 'kanban-column-count';
			countEl.textContent = '0';
			header.append(titleEl, countEl);

			let cards = this.document.createElement('div');
			cards.className = 'kanban-column-cards';

			columnEl.append(header, cards);
			this._wireColumnDnd(columnEl, col.key);
			this.board.appendChild(columnEl);

			this.columnEls.set(col.key, { columnEl, countEl, cards });
		}
	}

	_wireColumnDnd(columnEl, statusKey) {
		columnEl.addEventListener('dragover', (ev) => {
			if (!ev.dataTransfer.types.includes(DRAG_MIME)) return;
			ev.preventDefault();
			ev.dataTransfer.dropEffect = 'move';
			columnEl.classList.add('drag-over');
		});
		columnEl.addEventListener('dragleave', (ev) => {
			if (ev.target !== columnEl) return;
			columnEl.classList.remove('drag-over');
		});
		columnEl.addEventListener('drop', async (ev) => {
			ev.preventDefault();
			columnEl.classList.remove('drag-over');
			let itemID = parseInt(ev.dataTransfer.getData(DRAG_MIME));
			if (!itemID) return;
			let item = await Zotero.Items.getAsync(itemID);
			if (!item) return;
			let current = ReadingStatus.get(item);
			if (statusKey === current) return;
			try {
				await ReadingStatus.set(item, statusKey);
			}
			catch (e) {
				Zotero.logError(e);
			}
		});
	}

	_scheduleRefresh() {
		if (this._destroyed || this._refreshTimer) return;
		this._refreshTimer = this.window.setTimeout(() => {
			this._refreshTimer = null;
			this.refresh().catch(e => Zotero.logError(e));
		}, 50);
	}

	async refresh() {
		if (this._destroyed) return;
		let items = [];
		try {
			items = await this.collectionTreeRow.getItems();
		}
		catch (e) {
			Zotero.logError(e);
			items = [];
		}
		// Top-level only — child notes/attachments aren't useful on a board.
		this.items = items.filter(item => item instanceof Zotero.Item && item.isTopLevelItem());
		this._render();
	}

	_render() {
		let buckets = new Map(COLUMNS.map(c => [c.key, []]));
		for (let item of this.items) {
			let status = ReadingStatus.get(item) || '';
			if (!buckets.has(status)) status = '';
			buckets.get(status).push(item);
		}
		for (let col of COLUMNS) {
			let entries = buckets.get(col.key) || [];
			let { countEl, cards } = this.columnEls.get(col.key);
			countEl.textContent = String(entries.length);
			while (cards.firstChild) cards.firstChild.remove();
			for (let item of entries) {
				cards.appendChild(this._renderCard(item));
			}
		}
	}

	_renderCard(item) {
		let card = this.document.createElement('div');
		card.className = 'kanban-card';
		card.setAttribute('draggable', 'true');
		card.dataset.itemId = String(item.id);

		let titleEl = this.document.createElement('div');
		titleEl.className = 'kanban-card-title';
		titleEl.textContent = item.getDisplayTitle() || '';
		card.appendChild(titleEl);

		let creators = '';
		try {
			creators = item.getField('firstCreator') || '';
		}
		catch {
			// no-op
		}
		let year = '';
		try {
			let date = item.getField('date', true);
			if (date) year = date.substr(0, 4).replace(/^0+$/, '');
		}
		catch {
			// no-op
		}
		if (creators || year) {
			let meta = this.document.createElement('div');
			meta.className = 'kanban-card-meta';
			meta.textContent = creators + (creators && year ? ' · ' : '') + year;
			card.appendChild(meta);
		}

		card.addEventListener('dragstart', (ev) => {
			ev.dataTransfer.effectAllowed = 'move';
			ev.dataTransfer.setData(DRAG_MIME, String(item.id));
			card.classList.add('dragging');
		});
		card.addEventListener('dragend', () => {
			card.classList.remove('dragging');
		});
		card.addEventListener('click', () => {
			this._selectInLibrary(item);
		});
		card.addEventListener('dblclick', () => {
			// Match Zotero's table double-click: open the item.
			try {
				this.window.ZoteroPane?.viewItems?.([item]);
			}
			catch (e) {
				Zotero.logError(e);
			}
		});

		return card;
	}

	_selectInLibrary(item) {
		try {
			let tabs = this.window.Zotero_Tabs;
			if (tabs && tabs._selectedID !== 'zotero-pane') {
				tabs.select('zotero-pane');
			}
			this.window.ZoteroPane?.selectItem?.(item.id);
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
}
