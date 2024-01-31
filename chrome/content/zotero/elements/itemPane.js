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
	class ItemPane extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<deck id="zotero-item-pane-content" class="zotero-item-pane-content" selectedIndex="0" flex="1" zotero-persist="width height" height="300">
				<item-message-pane id="zotero-item-message" />
				
				<item-details id="zotero-item-details" />
				
				<note-editor id="zotero-note-editor" flex="1" notitle="1"
					previousfocus="zotero-items-tree" />
				
				<duplicates-merge-pane id="zotero-duplicates-merge-pane" />
			</deck>
			<item-pane-sidenav id="zotero-view-item-sidenav" class="zotero-view-item-sidenav"/>
		`);

		init() {
			this._itemDetails = this.querySelector("#zotero-item-details");
			this._noteEditor = this.querySelector("#zotero-note-editor");
			this._duplicatesPane = this.querySelector("#zotero-duplicates-merge-pane");
			this._messagePane = this.querySelector("#zotero-item-message");
			this._sidenav = this.querySelector("#zotero-view-item-sidenav");
			this._deck = this.querySelector("#zotero-item-pane-content");

			this._itemDetails.sidenav = this._sidenav;

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item']);

			this._translationTarget = null;
		}

		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		get data() {
			return this._data;
		}

		set data(data) {
			this._data = data;
		}

		get viewMode() {
			return this._viewMode;
		}

		set viewMode(mode) {
			this._viewMode = mode;
		}

		get editable() {
			return this._editable;
		}

		set editable(editable) {
			this._editable = editable;
		}

		get viewType() {
			return ["message", "item", "note", "duplicates"][this._deck.selectedIndex];
		}

		/**
		 * Set view type
		 * @param {"message" | "item" | "note" | "duplicates"} type view type
		 */
		set viewType(type) {
			this.setAttribute("view-type", type);
		}

		render() {
			if (!this.data) return false;
			let hideSidenav = false;
			let renderStatus = false;
			// Single item selected
			if (this.data.length == 1) {
				let item = this.data[0];
				
				if (item.isNote()) {
					hideSidenav = true;
					renderStatus = this.renderNoteEditor(item);
				}
				else {
					renderStatus = this.renderItemPane(item);
				}
			}
			// Zero or multiple items selected
			else {
				renderStatus = this.renderMessage();
			}
			this._sidenav.hidden = hideSidenav;
			return renderStatus;
		}

		notify(action, type) {
			if (type == 'item' && action == 'modify') {
				if (this.viewMode.isFeedsOrFeed) {
					this.updateReadLabel();
				}
			}
		}

		renderNoteEditor(item) {
			this.viewType = "note";

			let noteEditor = document.getElementById('zotero-note-editor');
			noteEditor.mode = this.editable ? 'edit' : 'view';
			noteEditor.viewMode = 'library';
			noteEditor.parent = null;
			noteEditor.item = item;
			return true;
		}

		renderItemPane(item) {
			this.viewType = "item";
			
			this._itemDetails.mode = this.editable ? null : "view";
			this._itemDetails.item = item;

			if (this.hasAttribute("collapsed")) {
				return true;
			}

			this._itemDetails.render();
			
			if (item.isFeedItem) {
				let lastTranslationTarget = Zotero.Prefs.get('feeds.lastTranslationTarget');
				if (lastTranslationTarget) {
					let id = parseInt(lastTranslationTarget.substr(1));
					if (lastTranslationTarget[0] == "L") {
						this._translationTarget = Zotero.Libraries.get(id);
					}
					else if (lastTranslationTarget[0] == "C") {
						this._translationTarget = Zotero.Collections.get(id);
					}
				}
				if (!this._translationTarget) {
					this._translationTarget = Zotero.Libraries.userLibrary;
				}
				this.setTranslateButton();
				// Too slow for now
				// if (!item.isTranslated) {
				// 	item.translate();
				// }
				ZoteroPane.startItemReadTimeout(item.id);
			}
			return true;
		}

		renderMessage() {
			let msg;
			
			let count = this.data.length;
			
			// Display duplicates merge interface in item pane
			if (this.viewMode.isDuplicates) {
				if (!this.editable) {
					if (count) {
						msg = Zotero.getString('pane.item.duplicates.writeAccessRequired');
					}
					else {
						msg = Zotero.getString('pane.item.selected.zero');
					}
					this.setItemPaneMessage(msg);
				}
				else if (count) {
					this.viewType = "duplicates";
					
					// On a Select All of more than a few items, display a row
					// count instead of the usual item type mismatch error
					let displayNumItemsOnTypeError = count > 5 && count == this.viewMode.rowCount;
					
					// Initialize the merge pane with the selected items
					this._duplicatesPane.setItems(this.data, displayNumItemsOnTypeError);
				}
				else {
					msg = Zotero.getString('pane.item.duplicates.selectToMerge');
					this.setItemPaneMessage(msg);
				}
			}
			// Display label in the middle of the item pane
			else {
				if (count) {
					msg = Zotero.getString('pane.item.selected.multiple', count);
				}
				else {
					let rowCount = this.viewMode.rowCount;
					let str = 'pane.item.unselected.';
					switch (rowCount) {
						case 0:
							str += 'zero';
							break;
						case 1:
							str += 'singular';
							break;
						default:
							str += 'plural';
							break;
					}
					msg = Zotero.getString(str, [rowCount]);
				}
				
				this.setItemPaneMessage(msg);
				// Return false for itemTreeTest#shouldn't select a modified item
				return false;
			}
			return true;
		}

		setItemPaneMessage(msg) {
			this.viewType = "message";
			this._messagePane.render(msg);
		}
		
		/**
		 * Display buttons at top of item pane depending on context
		 */
		updateItemPaneButtons() {
			let container;
			if (!this.data.length) {
				return;
			}
			else if (this.data.length > 1) {
				container = this._messagePane;
			}
			else if (this.data[0].isNote()) {
				container = this._noteEditor;
			}
			else {
				container = this._itemDetails;
			}
			
			// My Publications buttons
			var isPublications = this.viewMode.isPublications;
			// Show in My Publications view if selected items are all notes or non-linked-file attachments
			var showMyPublicationsButtons = isPublications
				&& this.data.every((item) => {
					return item.isNote()
						|| (item.isAttachment()
							&& item.attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_FILE);
				});
			
			if (showMyPublicationsButtons) {
				container.renderCustomHead(this.renderPublicationsHead.bind(this));
				return;
			}

			// Trash button
			let nonDeletedItemsSelected = this.data.some(item => !item.deleted);
			if (this.viewMode.isTrash && !nonDeletedItemsSelected) {
				container.renderCustomHead(this.renderTrashHead.bind(this));
				return;
			}
			
			// Feed buttons
			if (this.viewMode.isFeedsOrFeed) {
				container.renderCustomHead(this.renderFeedHead.bind(this));
				this.updateReadLabel();
				return;
			}

			container.renderCustomHead();
		}

		renderPublicationsHead(data) {
			let { doc, append } = data;
			let button = doc.createXULElement("button");
			button.id = 'zotero-item-pane-my-publications-button';

			let hiddenItemsSelected = this.data.some(item => !item.inPublications);
			let str, onclick;
			if (hiddenItemsSelected) {
				str = 'showInMyPublications';
				onclick = () => Zotero.Items.addToPublications(this.data);
			}
			else {
				str = 'hideFromMyPublications';
				onclick = () => Zotero.Items.removeFromPublications(this.data);
			}
			button.label = Zotero.getString('pane.item.' + str);
			button.onclick = onclick;
			append(button);
		}

		renderTrashHead(data) {
			let { doc, append } = data;
			let restoreButton = doc.createXULElement("button");
			restoreButton.id = "zotero-item-restore-button";
			restoreButton.dataset.l10nId = "menu-restoreToLibrary";
			restoreButton.addEventListener("command", () => {
				ZoteroPane.restoreSelectedItems();
			});

			let deleteButton = doc.createXULElement("button");
			deleteButton.id = "zotero-item-delete-button";
			deleteButton.dataset.l10nId = "menu-deletePermanently";
			deleteButton.addEventListener("command", () => {
				ZoteroPane.deleteSelectedItems();
			});

			append(restoreButton, deleteButton);
		}

		renderFeedHead(data) {
			let { doc, append } = data;

			let toggleReadButton = doc.createXULElement("button");
			toggleReadButton.id = "zotero-feed-item-toggleRead-button";
			toggleReadButton.addEventListener("command", () => {
				ZoteroPane.toggleSelectedItemsRead();
			});

			let addToButton = new (customElements.get('split-menu-button'));
			addToButton.id = "zotero-feed-item-addTo-button";
			addToButton.setAttribute("popup", "zotero-item-addTo-menu");
			addToButton.addEventListener("command", () => this.translateSelectedItems());

			append(toggleReadButton, addToButton);

			this.setTranslateButton();
		}

		updateReadLabel() {
			var items = this.data;
			var isUnread = false;
			for (let item of items) {
				if (!item.isRead) {
					isUnread = true;
					break;
				}
			}
			this.setReadLabel(!isUnread);
		}

		setReadLabel(isRead) {
			var elem = document.getElementById('zotero-feed-item-toggleRead-button');
			var label = Zotero.getString('pane.item.' + (isRead ? 'markAsUnread' : 'markAsRead'));
			elem.label = label;
	
			var key = Zotero.Keys.getKeyForCommand('toggleRead');
			var tooltip = label + (Zotero.rtl ? ' \u202B' : ' ') + '(' + key + ')';
			elem.title = tooltip;
		}

		async translateSelectedItems() {
			var collectionID = this._translationTarget.objectType == 'collection' ? this._translationTarget.id : undefined;
			var items = this.data;
			for (let item of items) {
				await item.translate(this._translationTarget.libraryID, collectionID);
			}
		}
		
		buildTranslateSelectContextMenu(event) {
			var menu = document.getElementById('zotero-item-addTo-menu');
			// Don't trigger rebuilding on nested popupmenu open/close
			if (event.target != menu) {
				return;
			}
			// Clear previous items
			while (menu.firstChild) {
				menu.removeChild(menu.firstChild);
			}
			
			let target = Zotero.Prefs.get('feeds.lastTranslationTarget');
			if (!target) {
				target = "L" + Zotero.Libraries.userLibraryID;
			}
			
			var libraries = Zotero.Libraries.getAll();
			for (let library of libraries) {
				if (!library.editable || library.libraryType == 'publications') {
					continue;
				}
				Zotero.Utilities.Internal.createMenuForTarget(
					library,
					menu,
					target,
					async (event, libraryOrCollection) => {
						if (event.target.tagName == 'menu') {
							// Simulate menuitem flash on OS X
							if (Zotero.isMac) {
								event.target.setAttribute('_moz-menuactive', false);
								await Zotero.Promise.delay(50);
								event.target.setAttribute('_moz-menuactive', true);
								await Zotero.Promise.delay(50);
								event.target.setAttribute('_moz-menuactive', false);
								await Zotero.Promise.delay(50);
								event.target.setAttribute('_moz-menuactive', true);
							}
							menu.hidePopup();
							
							this.setTranslationTarget(libraryOrCollection);
							event.stopPropagation();
						}
						else {
							this.setTranslationTarget(libraryOrCollection);
							event.stopPropagation();
						}
					}
				);
			}
		}
		
		setTranslateButton() {
			if (!this._translationTarget) return;
			var label = Zotero.getString('pane.item.addTo', this._translationTarget.name);
			var elem = document.getElementById('zotero-feed-item-addTo-button');
			elem.label = label;
	
			var key = Zotero.Keys.getKeyForCommand('saveToZotero');
			
			var tooltip = label
				+ (Zotero.rtl ? ' \u202B' : ' ') + '('
				+ (Zotero.isMac ? '⇧⌘' : Zotero.getString('general.keys.ctrlShift'))
				+ key + ')';
			elem.title = tooltip;
			elem.image = this._translationTarget.treeViewImage;
		}
	
		setTranslationTarget(translationTarget) {
			this._translationTarget = translationTarget;
			Zotero.Prefs.set('feeds.lastTranslationTarget', translationTarget.treeViewID);
			this.setTranslateButton();
		}

		static get observedAttributes() {
			return ['collapsed', 'width', 'height', 'view-type'];
		}

		attributeChangedCallback(name, oldValue, newValue) {
			switch (name) {
				case "collapsed": {
					this.handleResize();
					break;
				}
				case "width": {
					this.style.width = `${newValue}px`;
					break;
				}
				case "height": {
					this.style.height = `${newValue}px`;
					break;
				}
				case "view-type": {
					if (newValue !== oldValue) {
						this._handleViewTypeChange(newValue);
					}
				}
			}
		}

		handleResize() {
			if (this.getAttribute("collapsed")) {
				this.removeAttribute("width");
				this.removeAttribute("height");
			}
			else {
				// Must have width or height to auto-resize when changing sidenav visibility
				// Keep in sync with $min-width-item-pane and min-height + sidebar size
				let minWidth = 337;
				let minHeight = 205;
				let width = this.getAttribute("width");
				let height = this.getAttribute("height");
				if (!width || Number(width) < minWidth) this.setAttribute("width", String(minWidth));
				if (!height || Number(height) < minHeight) this.setAttribute("height", String(minHeight));
				// Render item pane after open
				if ((!width || !height) && this.viewType == "item") {
					this._itemDetails.render();
				}
			}
		}

		_handleViewTypeChange(type) {
			let previousViewType = this.viewType;
			switch (type) {
				case "message": {
					this._deck.selectedIndex = 0;
					break;
				}
				case "item": {
					this._deck.selectedIndex = 1;
					break;
				}
				case "note": {
					this._deck.selectedIndex = 2;
					break;
				}
				case "duplicates": {
					this._deck.selectedIndex = 3;
					break;
				}
			}
			let isViewingItem = type == "item";
			if (previousViewType != "item" && isViewingItem) {
				this._itemDetails.forceUpdateSideNav();
			}
			this._itemDetails.sidenav.toggleDefaultStatus(!isViewingItem);
		}
	}
	customElements.define("item-pane", ItemPane);
}
