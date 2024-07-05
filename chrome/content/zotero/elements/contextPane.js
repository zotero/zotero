/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
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
	class ContextPane extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<deck id="zotero-context-pane-deck" flex="1" selectedIndex="0">
				<deck id="zotero-context-pane-item-deck"></deck>
				<deck id="zotero-context-pane-notes-deck" class="notes-pane-deck" flex="1"></deck>
			</deck>
		`);

		get sidenav() {
			return this._sidenav;
		}

		set sidenav(sidenav) {
			this._sidenav = sidenav;
			// TODO: decouple sidenav and contextPane
			sidenav.contextNotesPane = this._notesPaneDeck;
		}

		get mode() {
			return ["item", "notes"][this._panesDeck.getAttribute('selectedIndex')];
		}

		set mode(mode) {
			let modeMap = {
				item: "0",
				notes: "1",
			};
			if (!(mode in modeMap)) {
				throw new Error(`ContextPane.mode must be one of ["item", "notes"], but got ${mode}`);
			}
			this._panesDeck.selectedIndex = modeMap[mode];
		}

		get activeEditor() {
			let currentContext = this._getCurrentNotesContext();
			return currentContext?._getCurrentEditor();
		}

		init() {
			this._panesDeck = this.querySelector('#zotero-context-pane-deck');
			// Item pane deck
			this._itemPaneDeck = this.querySelector('#zotero-context-pane-item-deck');
			// Notes pane deck
			this._notesPaneDeck = this.querySelector('#zotero-context-pane-notes-deck');

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item', 'tab'], 'contextPane');
		}

		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		notify(action, type, ids, extraData) {
			if (type == 'item') {
				this._handleItemUpdate(action, type, ids, extraData);
				return;
			}
			if (type == 'tab' && action == 'add') {
				this._handleTabAdd(action, type, ids, extraData);
				return;
			}
			if (type == 'tab' && action == 'close') {
				this._handleTabClose(action, type, ids, extraData);
				return;
			}
			if (type == 'tab' && ["select", "load"].includes(action)) {
				this._handleTabSelect(action, type, ids, extraData);
			}
		}

		_handleItemUpdate(action, type, ids, extraData) {
			// Update, remove or re-create item panes
			if (action === 'modify') {
				for (let itemDetails of Array.from(this._itemPaneDeck.children)) {
					let tabID = itemDetails.tabID;
					let item = Zotero.Items.get(Zotero_Tabs._getTab(tabID)?.tab.data.itemID);
					if ((item.parentID || itemDetails.parentID)
						&& item.parentID !== itemDetails.parentID) {
						this._removeItemContext(tabID);
						this._addItemContext(tabID, item.itemID);
					}
				}
			}

			// Update notes lists for affected libraries
			if (['add', 'delete', 'modify'].includes(action)) {
				let libraryIDs = [];
				for (let id of ids) {
					let item = Zotero.Items.get(id);
					if (item && (item.isNote() || item.isRegularItem())) {
						libraryIDs.push(item.libraryID);
					}
					else if (action == 'delete') {
						libraryIDs.push(extraData[id].libraryID);
					}
				}
				for (let context of Array.from(this._notesPaneDeck.children)) {
					if (libraryIDs.includes(context.libraryID)) {
						context.affectedIDs = new Set([...context.affectedIDs, ...ids]);
						context.update();
					}
				}
			}
		}

		_handleTabAdd(action, type, ids, extraData) {
			let data = extraData[ids[0]];
			this._addItemContext(ids[0], data.itemID, data.type);
		}

		_handleTabClose(action, type, ids) {
			this._removeItemContext(ids[0]);
			if (Zotero_Tabs.deck.children.length == 1) {
				Array.from(this._notesPaneDeck.children).forEach(x => x.notesList.expanded = false);
			}
			// Close tab specific notes if tab id no longer exists, but
			// do that only when unloaded tab is reloaded
			setTimeout(() => {
				let contextNodes = Array.from(this._notesPaneDeck.children);
				for (let contextNode of contextNodes) {
					let nodes = Array.from(contextNode.querySelector('.zotero-context-pane-tab-notes-deck').children);
					for (let node of nodes) {
						let tabID = node.getAttribute('data-tab-id');
						if (!document.getElementById(tabID)) {
							node.remove();
						}
					}
				}
				// For unknown reason fx102, unlike 60, sometimes doesn't automatically update selected index
				this._selectItemContext(Zotero_Tabs.selectedID);
			});
		}

		async _handleTabSelect(action, type, ids, extraData) {
			// TEMP: move these variables to ZoteroContextPane
			let _contextPaneSplitter = ZoteroContextPane.splitter;
			let _contextPane = document.getElementById('zotero-context-pane');
			let tabID = ids[0];
			let tabType = extraData[tabID].type;
			// It seems that changing `hidden` or `collapsed` values might
			// be related with significant slow down when there are too many
			// DOM nodes (i.e. 10k notes)
			if (tabType == 'library') {
				_contextPaneSplitter.setAttribute('hidden', true);
				_contextPane.setAttribute('collapsed', true);
				ZoteroContextPane.showLoadingMessage(false);
				this._sidenav.hidden = true;
			}
			else if (tabType == 'reader') {
				this._handleReaderReady(tabID);
				this._setupNotesContext(tabID);
				_contextPaneSplitter.setAttribute('hidden', false);

				_contextPane.setAttribute('collapsed', !(_contextPaneSplitter.getAttribute('state') != 'collapsed'));
				// It seems that on heavy load (i.e. syncing) the line below doesn't set the correct value,
				// therefore we repeat the same operation at the end of JS message queue
				setTimeout(() => {
					_contextPane.setAttribute('collapsed', !(_contextPaneSplitter.getAttribute('state') != 'collapsed'));
				});
				
				this._sidenav.hidden = false;
			}

			this._selectItemContext(tabID);
			ZoteroContextPane.update();
		}

		async _setupNotesContext(tabID) {
			let { tab } = Zotero_Tabs._getTab(tabID);
			if (!tab || !tab.data.itemID) return;
			let attachment = await Zotero.Items.getAsync(tab.data.itemID);
			if (attachment) {
				this._selectNotesContext(attachment.libraryID);
				let notesContext = this._getNotesContext(attachment.libraryID);
				notesContext.updateNotesListFromCache();
			}
			let currentNoteContext = this._getCurrentNotesContext();
			// Always switch to the current selected tab, since the selection might have changed
			currentNoteContext.switchToTab(Zotero_Tabs.selectedID);
		}

		async _handleReaderReady(tabID) {
			let reader = Zotero.Reader.getByTabID(tabID);
			if (!reader) {
				return;
			}
			// Focus reader pages view if context pane note editor is not selected
			if (Zotero_Tabs.selectedID == reader.tabID
				&& !Zotero_Tabs.isTabsMenuVisible()
				&& (!document.activeElement
					|| !document.activeElement.closest('.context-node iframe[id="editor-view"]'))) {
				if (!Zotero_Tabs.focusOptions?.keepTabFocused) {
					// Do not move focus to the reader during keyboard navigation
					setTimeout(() => {
						// Timeout to make sure focus does not stick to the tab
						// after click on windows
						reader.focus();
					});
				}
			}
		}

		_getCurrentNotesContext() {
			return this._notesPaneDeck.selectedPanel;
		}

		_getNotesContext(libraryID) {
			let context = Array.from(this._notesPaneDeck.children).find(x => x.libraryID == libraryID);
			if (!context) {
				context = this._addNotesContext(libraryID);
			}
			return context;
		}

		_addNotesContext(libraryID) {
			let context = document.createXULElement("notes-context");
			this._notesPaneDeck.append(context);
			context.libraryID = libraryID;
			return context;
		}

		_selectNotesContext(libraryID) {
			let context = this._getNotesContext(libraryID);
			this._notesPaneDeck.selectedPanel = context;
		}

		_removeNotesContext(libraryID) {
			let context = Array.from(this._notesPaneDeck.children).find(x => x.libraryID == libraryID);
			context?.remove();
		}

		_getItemContext(tabID) {
			return this._itemPaneDeck.querySelector(`[data-tab-id="${tabID}"]`);
		}

		_removeItemContext(tabID) {
			this._itemPaneDeck.querySelector(`[data-tab-id="${tabID}"]`)?.remove();
		}
	
		_selectItemContext(tabID) {
			let previousContainer = this._sidenav.container;
			let selectedPanel = this._getItemContext(tabID);
			if (selectedPanel) {
				this._itemPaneDeck.selectedPanel = selectedPanel;
				selectedPanel.sidenav = this._sidenav;
				// Inherits previous pinned states
				if (previousContainer) selectedPanel.pinnedPane = previousContainer.pinnedPane;
				selectedPanel.render();
			}
		}
	
		async _addItemContext(tabID, itemID, _tabType = "") {
			let { libraryID } = Zotero.Items.getLibraryAndKeyFromID(itemID);
			let library = Zotero.Libraries.get(libraryID);
			await library.waitForDataLoad('item');
	
			let item = Zotero.Items.get(itemID);
			if (!item) {
				return;
			}
			libraryID = item.libraryID;
			let editable = Zotero.Libraries.get(libraryID).editable;
			let parentID = item.parentID;
	
			let previousPinnedPane = this._sidenav.container?.pinnedPane || "";
			
			let targetItem = parentID ? Zotero.Items.get(parentID) : item;
	
			let itemDetails = document.createXULElement('item-details');
			itemDetails.id = tabID + '-context';
			itemDetails.dataset.tabId = tabID;
			itemDetails.className = 'zotero-item-pane-content';
			this._itemPaneDeck.appendChild(itemDetails);
	
			itemDetails.editable = editable;
			itemDetails.tabID = tabID;
			itemDetails.tabType = "reader";
			itemDetails.item = targetItem;
			// Manually cache parentID
			itemDetails.parentID = parentID;
			itemDetails.sidenav = this._sidenav;
			if (previousPinnedPane) itemDetails.pinnedPane = previousPinnedPane;
	
			// Make sure that the context pane of the selected tab is rendered
			if (tabID == Zotero_Tabs.selectedID) {
				this._selectItemContext(tabID);
			}
		}
	
		handleFocus() {
			let splitter = ZoteroContextPane.splitter;
	
			if (splitter.getAttribute('state') != 'collapsed') {
				if (this.mode == "item") {
					let header = this._itemPaneDeck.selectedPanel.querySelector("item-pane-header");
					// Focus the first focusable node after header
					Services.focus.moveFocus(window, header, Services.focus.MOVEFOCUS_FORWARD, 0);
					return true;
				}
				else {
					this._getCurrentNotesContext()?.focus();
				}
			}
			return false;
		}
	}
	customElements.define("context-pane", ContextPane);
}
