/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2020 Corporation for Digital Scholarship
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
	class ItemPaneSidenav extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="inherit-flex highlight-notes-inactive" tabindex="0" role="tab" data-l10n-id="sidenav-main-btn-grouping">
				<!-- Buttons will be added dynamically -->
			</html:div>
			
			<html:div class="divider"/>
			
			<html:div class="pin-wrapper highlight-notes-active">
				<html:div class="btn"
					data-l10n-id="sidenav-notes"
					data-pane="context-notes"
					tabindex="0"
					role="tab">
				</html:div>
			</html:div>

			<html:div class="divider"/>
			
			<html:div class="pin-wrapper">
				<toolbarbutton class="btn"
					tooltiptext="&zotero.toolbar.openURL.label;"
					type="menu"
					data-action="locate"
					tabindex="0">
					<menupopup/>
				</toolbarbutton>
			</html:div>
			
			<popupset>
				<menupopup class="context-menu">
					<menuitem class="menuitem-iconic zotero-menuitem-pin" data-l10n-id="pin-section"/>
					<menuitem class="menuitem-iconic zotero-menuitem-unpin" data-l10n-id="unpin-section"/>
					<menuseparator class="zotero-menuitem-pin-separator"/>
					<menuitem class="menuitem-iconic zotero-menuitem-reorder zotero-menuitem-reorder-up" data-l10n-id="sidenav-reorder-up"/>
					<menuitem class="menuitem-iconic zotero-menuitem-reorder zotero-menuitem-reorder-down" data-l10n-id="sidenav-reorder-down"/>
					<menuitem class="menuitem-iconic zotero-menuitem-reorder zotero-menuitem-reorder-reset" data-l10n-id="sidenav-reorder-reset"/>
				</menupopup>
			</popupset>
		`, ['chrome://zotero/locale/zotero.dtd']);

		_initialized = false;
		
		_container = null;
		
		_contextNotesPane = null;
		
		_contextMenuTarget = null;

		_draggedWrapper = null;

		_dropIndicator = null;

		_prefObserverID = null;

		get _defaultPanes() {
			return ["info", "abstract", "attachments", "notes", "libraries-collections", "tags", "related"];
		}

		get _builtInPanes() {
			return ["info", "abstract", "attachments", "notes", "attachment-info", "attachment-annotations", "libraries-collections", "tags", "related"];
		}

		get container() {
			return this._container;
		}
		
		set container(val) {
			if (this._container == val) return;
			this._container = val;
			this.render();
		}
		
		get contextNotesPane() {
			return this._contextNotesPane;
		}
		
		set contextNotesPane(val) {
			if (this._contextNotesPane == val) return;
			this._contextNotesPane = val;
			this.render();
		}
		
		get pinnedPane() {
			return this.container?.pinnedPane;
		}
		
		set pinnedPane(val) {
			if (!this.container) return;
			this.container.pinnedPane = val;
		}

		get _collapsed() {
			return this.container?._collapsed;
		}

		set _collapsed(val) {
			if (!this.container) return;
			this.container._collapsed = val;
		}
		
		get _contextNotesPaneVisible() {
			return this._contextNotesPane
				&& !this._collapsed
				&& this._contextNotesPane.parentElement.selectedPanel == this._contextNotesPane;
		}

		set _contextNotesPaneVisible(val) {
			if (!this._contextNotesPane) return;
			// The context notes pane will always be a direct child of the deck we need to update
			let deck = this._contextNotesPane.parentElement;
			if (val) {
				deck.selectedPanel = this._contextNotesPane;
				this._collapsed = false;
			}
			else {
				// But our _container is not a direct child of the deck,
				// so find the child that contains it
				deck.selectedPanel = Array.from(deck.children).find(child => child.contains(this._container));
			}
			this.render();
		}

		get _wrappers() {
			return Array.from(this._buttonContainer.querySelectorAll('.pin-wrapper'));
		}

		get _enabledWrappers() {
			return Array.from(this._buttonContainer.querySelectorAll('.pin-wrapper:not([hidden])'));
		}

		isPanePinnable(id) {
			if (['context-notes', 'context-all-notes', 'context-item-notes'].includes(id)) {
				return false;
			}
			// The first button in the group is not pinnable
			if (this._buttonContainer.querySelector(".pin-wrapper:not([hidden])").querySelector(".btn").dataset.pane == id) {
				return false;
			}
			return true;
		}

		isPaneOrderable(paneID) {
			let orderable =
				// Built-in or orderable custom sections
				this._builtInPanes.includes(paneID) || Zotero.ItemPaneManager.isSectionOrderable(paneID);
			return orderable;
		}

		isPaneMovable(paneID, direction) {
			let wrappers = this._enabledWrappers;
			let currentWrapper = this.querySelector(`.btn[data-pane=${CSS.escape(paneID)}]`).parentElement;
			let currentIndex = wrappers.indexOf(currentWrapper);

			let isOrderable = this.isPaneOrderable(paneID);
			let isLast = currentIndex === wrappers.length - 1;
			let isNextOrderable = !isLast && this.isPaneOrderable(
				wrappers[currentIndex + 1]?.querySelector(".btn")?.dataset.pane);
			
			if (direction === 'up') {
				return isOrderable && currentIndex !== 0;
			}
			else if (direction === 'down') {
				return isOrderable && isNextOrderable && !isLast;
			}
		}

		isOrderChanged() {
			let order = this.getPersistedOrder();
			for (let i = 0; i < this._builtInPanes.length; i++) {
				if (this._builtInPanes[i] != order[i]) {
					return true;
				}
			}
			return false;
		}

		init() {
			this._buttonContainer = this.querySelector('.inherit-flex');
			this.loadBuiltInButtons();
			this.toggleDefaultStatus(true);

			this.addEventListener('click', this.handleButtonClick);
			this.addEventListener('keydown', this.handleKeyDown);
			this.addEventListener('focusin', this.handleFocusIn);
			// Set up action buttons
			for (let button of this.querySelectorAll('.btn[data-action]')) {
				let action = button.dataset.action;
				
				if (action === 'locate') {
					button.addEventListener('mousedown', async (event) => {
						if (event.button !== 0 || button.open) {
							return;
						}
						event.preventDefault();
						let menu = button.querySelector('menupopup');
						await Zotero_LocateMenu.buildLocateMenu(menu);
						await document.l10n.translateFragment(menu);
						button.open = true;
					});
				}
			}

			this._buttonContainer.addEventListener('dragstart', this.handleButtonDragStart, true);
			this._buttonContainer.addEventListener('dragover', this.handleButtonDragOver);
			this._buttonContainer.addEventListener('drop', this.handleButtonDrop);
			this._buttonContainer.addEventListener('dragend', this.handleButtonDragEnd);
			this._buttonContainer.addEventListener('dragleave', this.handleButtonDragLeave);
			
			this.querySelector('.zotero-menuitem-pin').addEventListener('command', () => {
				this.container.scrollToPane(this._contextMenuTarget, 'smooth');
				this.pinnedPane = this._contextMenuTarget;
			});
			this.querySelector('.zotero-menuitem-unpin').addEventListener('command', () => {
				this.pinnedPane = null;
			});
			this.querySelector('.zotero-menuitem-reorder-up').addEventListener('command', () => {
				this.handlePaneMove(this._contextMenuTarget, 'up');
			});
			this.querySelector('.zotero-menuitem-reorder-down').addEventListener('command', () => {
				this.handlePaneMove(this._contextMenuTarget, 'down');
			});
			this.querySelector('.zotero-menuitem-reorder-reset').addEventListener('command', () => {
				this.resetPaneOrder();
			});
			this.setAttribute("role", "tablist");

			this._prefObserverID = Zotero.Prefs.registerObserver("sidenav.order", this.handlePaneOrderChange);

			this._initialized = true;
		}

		destroy() {
			this.removeEventListener('click', this.handleButtonClick);
			this.removeEventListener('keydown', this.handleKeyDown);
			this.removeEventListener('focusin', this.handleFocusIn);

			this._buttonContainer.removeEventListener('dragstart', this.handleButtonDragStart, true);
			this._buttonContainer.removeEventListener('dragover', this.handleButtonDragOver);
			this._buttonContainer.removeEventListener('drop', this.handleButtonDrop);
			this._buttonContainer.removeEventListener('dragend', this.handleButtonDragEnd);
			this._buttonContainer.removeEventListener('dragleave', this.handleButtonDragLeave);

			Zotero.Prefs.unregisterObserver(this._prefObserverID);

			this._initialized = false;
		}

		render() {
			if (!this.container) return;

			for (let paneElem of this.container.getPanes()) {
				let paneID = paneElem.dataset.pane;
				this.addPane(paneID);
				this.updatePaneStatus(paneID);
			}

			let contextNotesPaneVisible = this._contextNotesPaneVisible;
			let pinnedPane = this.pinnedPane;
			for (let button of this.querySelectorAll('.btn[data-pane]')) {
				let pane = button.dataset.pane;
				// TEMP: never disable context notes button
				if (this._contextNotesPane) {
					button.removeAttribute('disabled');
				}
				
				if (pane == 'context-notes') {
					let hidden = !this._contextNotesPane;
					let selected = contextNotesPaneVisible;
					
					button.parentElement.hidden = hidden;
					button.parentElement.previousElementSibling.hidden = hidden; // Divider
					
					button.setAttribute('aria-selected', selected);
					
					continue;
				}
				
				button.closest("[role='tab']").setAttribute('aria-selected', !contextNotesPaneVisible);
				// No need to set `hidden` here, since it's updated by ItemDetails#_handlePaneStatus
				// Set .pinned on the container, for pin styling
				button.parentElement.classList.toggle('pinned', pane == pinnedPane);
			}
			
			for (let button of this.querySelectorAll('.btn[data-action]')) {
				let action = button.dataset.action;
				
				if (action == 'locate') {
					button.parentElement.hidden = false;
				}
			}
			
			this.querySelector('.highlight-notes-active').classList.toggle('highlight', contextNotesPaneVisible);
			this.querySelector('.highlight-notes-inactive').classList.toggle('highlight',
				this._contextNotesPane && !contextNotesPaneVisible);

			// Update the pane order
			this.container.initPaneOrder(this.getPersistedOrder());
		}

		async persistOrder(currentOrder = undefined) {
			let panes = Array.from(this._buttonContainer.querySelectorAll('.btn[data-pane]'));
			if (currentOrder === undefined) {
				currentOrder = [];
				for (let pane of panes) {
					let paneID = pane.dataset.pane;
					if (this.isPaneOrderable(paneID)) {
						currentOrder.push(paneID);
					}
				}
			}

			currentOrder = [...currentOrder];
			// Restore the order from installed plugins but not registered in the current order
			let prevOrder = this.getPersistedOrder();
			let installedPluginIDs = undefined;
			for (let paneID of prevOrder) {
				if (currentOrder.includes(paneID)) {
					continue;
				}
				// If the pane ID is not in the current order, check if it's a plugin ID
				if (!installedPluginIDs) {
					installedPluginIDs = (await Zotero.Plugins.getAllPluginIDs()).map(
						// Escape the plugin ID to match the pane ID generation
						id => CSS.escape(id)
					);
				}
				
				if (!installedPluginIDs.find(id => paneID.startsWith(id))) {
					continue;
				}

				// If the pane ID is not in the current order, add it to the end
				currentOrder.push(paneID);
			}

			Zotero.Prefs.set("sidenav.order", currentOrder.join(","));
		}
		

		getPersistedOrder(value = null) {
			if (value === null) {
				value = Zotero.Prefs.get("sidenav.order");
			}
			if (!value) return this._builtInPanes;
			try {
				return value.split(",");
			}
			catch(e) {
				return this._builtInPanes;
			}
		}

		addPane(paneID, order = null) {
			let button = this.querySelector(`.btn[data-pane=${CSS.escape(paneID)}]`);
			if (button) {
				button.parentElement.hidden = false;
				return;
			}

			button = document.createXULElement("div");
			button.classList.add("btn");
			button.dataset.pane = paneID;
			button.addEventListener('contextmenu', this.handleButtonContextMenu);

			let container = document.createElement("div");
			container.classList.add("pin-wrapper");
			container.classList.add("pinnable");
			container.append(button);
			if (this._defaultStatus) button.setAttribute("disabled", "true");

			let isBuiltin = this._builtInPanes.includes(paneID);
			if (isBuiltin) {
				button.dataset.l10nId = `sidenav-${paneID}`;
			}
			else {
				let pane = this.container?.getPane(paneID);
				if (!pane) return;
				let sidenavOptions = {};
				try {
					sidenavOptions = JSON.parse(pane.dataset.sidenavOptions);
				}
				catch (e) {}
				let { icon, darkIcon, l10nID, l10nArgs } = sidenavOptions;
				if (!darkIcon) darkIcon = icon;
				button.setAttribute("custom", "true");
				button.dataset.l10nId = l10nID;
				button.dataset.l10nArgs = l10nArgs;
				button.style = `--custom-sidenav-icon-light: url('${icon}'); --custom-sidenav-icon-dark: url('${darkIcon}');`;

				container.hidden = this._defaultStatus || !this.container.getEnabledPane(paneID);
			}

			if (this.isPaneOrderable(paneID)) {
				container.draggable = true;
			} else {
				// If the pane is not orderable, always insert it at the end
				this._buttonContainer.appendChild(container);
				return;
			}
			
			// Insert the new button according to the persisted order.
			if (order === null) {
				order = this.getPersistedOrder();
			}
			let index = order.indexOf(paneID);
			if (index >= 0) {
				let children = Array.from(this._buttonContainer.children);
				let inserted = false;
				for (let child of children) {
					let comparedPaneID = child.querySelector('.btn')?.dataset.pane;
					// If the compared pane is not orderable, insert before it
					if (!this.isPaneOrderable(comparedPaneID)) {
						this._buttonContainer.insertBefore(container, child);
						inserted = true;
						break;
					}
					let comparedIndex = order.indexOf(comparedPaneID);
					// If the compared pane should go after the new pane, insert before it
					if (comparedIndex > index) {
						this._buttonContainer.insertBefore(container, child);
						inserted = true;
						break;
					}
				}
				if (!inserted) {
					this._buttonContainer.appendChild(container);
				}
			} else {
				this._buttonContainer.appendChild(container);
			}
		}

		removePane(paneID) {
			let button = this.querySelector(`.btn[data-pane=${CSS.escape(paneID)}]`);
			if (!button) return;
			button.parentElement.remove();
		}

		loadBuiltInButtons() {
			// Clear existing buttons in the first group.
			this._buttonContainer.innerHTML = "";
			
			let order = this.getPersistedOrder();
			for (let paneID of this._builtInPanes) {
				this.addPane(paneID, order);
			}
		}

		updatePaneStatus(paneID) {
			if (!paneID) {
				this.render();
				return;
			}

			let button = this.querySelector(`.btn[data-pane=${CSS.escape(paneID)}]`);
			if (!button) return;
			button.parentElement.hidden = !this.container.getEnabledPane(paneID);
			if (this.pinnedPane) {
				if (paneID == this.pinnedPane && !button.parentElement.classList.contains("pinned")) {
					this.querySelector(".pin-wrapper.pinned")?.classList.remove("pinned");
					button.parentElement.classList.add('pinned');
				}
			}
			else {
				this.querySelector(".pin-wrapper.pinned")?.classList.remove("pinned");
			}

			if (this._defaultStatus && this._defaultPanes.includes(paneID)) {
				button.setAttribute("disabled", "true");
			}
			else {
				button.removeAttribute("disabled");
			}
		}

		/**
		 * Change the order of the panes in the sidenav.
		 * @param {string} paneID
		 * @param {number} newIndex
		 * @param {Object} options
		 * @param {boolean} options.render Whether to re-render the panes
		 * @param {boolean} options.scroll Whether to scroll to the new position
		 * @param {boolean} options.persist Whether to persist the new order
		 * @returns {Promise<boolean>} Whether the order was changed
		 */
		async changePaneOrder(paneID, newIndex, options = {}) {
			let button = this.querySelector(`.btn[data-pane=${CSS.escape(paneID)}]`);
			if (!button) return false;
			let wrappers = this._wrappers;
			let currentWrapper = button.parentElement;
			let currentIndex = wrappers.indexOf(currentWrapper);
			if (currentIndex == -1) return false;
			// Inserting to the same position or the position before it does nothing
			if (currentIndex == newIndex || currentIndex == newIndex - 1) return false;
			if (newIndex < wrappers.length) {
				this._buttonContainer.insertBefore(currentWrapper, wrappers[newIndex]);
			}
			else {
				this._buttonContainer.appendChild(currentWrapper);
			}

			if (this.container) {
				// Notify the container to update the pane order
				await this.container.changePaneOrder(paneID, newIndex, {
					render: options.render
				});
			}

			// Update the pinned pane if it's no longer pinnable
			if (!this.isPanePinnable(this.pinnedPane)) {
				this.pinnedPane = null;
			}

			// If no pinned pane, scroll to the new position
			// if (options.scroll !== false) {
			// 	this.container.scrollToPane(paneID);
			// }
			if (options.persist !== false) {
				await this.persistOrder();
			}
			return true;
		}

		async resetPaneOrder() {
			await this.persistOrder([...this._builtInPanes]);
		}

		toggleDefaultStatus(isDefault) {
			this._defaultStatus = isDefault;
			this.renderDefaultStatus();
		}

		renderDefaultStatus() {
			if (this._defaultStatus) {
				this.querySelectorAll('.btn[data-pane]').forEach((elem) => {
					elem.setAttribute("disabled", "true");
					elem.parentElement.hidden = !this._defaultPanes.includes(elem.dataset.pane);
				});

				this.querySelectorAll('.btn[data-action]').forEach((elem) => {
					elem.removeAttribute("disabled");
				});
			}
			else {
				this.querySelectorAll('.btn').forEach((elem) => {
					elem.removeAttribute("disabled");
				});
				this.render();
			}
		}

		/**
		 * Compute the drop position based on the offset from the button container.
		 * @param {number} offset Offset from the left or top of the button container
		 * @returns {Object} Object containing the index and position of the drop position
		 * @property {number} index Index of the drop position after the drop in the enabled wrappers
		 * @property {number} position Position of the drop indicator
		 */
		computeDropPosition(offset) {
			// Keep in sync with _itemPaneSidenav.scss
			let btnSize = 28;
			let btnGap = 6;
			// Before the center of the button, insert before it; otherwise, insert after it.
			let index = 0;
			if (offset < btnSize / 2) {
				index = 0;
			}
			else {
				offset -= btnSize / 2;
				index = Math.floor(offset / (btnSize + btnGap)) + 1;
			}
			return {
				index,
				position: index === 0 ? 0 : index * (btnSize + btnGap) + btnGap / 2
			}
		};

		handleKeyDown = (event) => {
			if (event.key == "Tab" && !event.shiftKey) {
				// Wrap focus around to the tab bar
				Zotero_Tabs.moveFocus("current");
				event.preventDefault();
			}
			if (event.key == "Tab" && event.shiftKey) {
				event.preventDefault();
				if (this._contextNotesPaneVisible && this._contextNotesPane.selectedPanel.mode == "notesList") {
					let focusHandled = this._contextNotesPane.selectedPanel.notesList.refocusLastFocusedNote();
					if (focusHandled) return;
				}
				// Shift-Tab out of sidenav to itemPane
				Services.focus.moveFocus(window, this, Services.focus.MOVEFOCUS_BACKWARD, 0);
			}
			if (["ArrowUp", "ArrowDown"].includes(event.key)) {
				// Up/Down arrow navigation
				let direction = event.key == "ArrowUp" ? Services.focus.MOVEFOCUS_BACKWARD : Services.focus.MOVEFOCUS_FORWARD;
				let focused = Services.focus.moveFocus(window, event.target, direction, Services.focus.FLAG_BYKEY);
				// If focus was moved outside of the sidenav (e.g. on arrowUp from the first button), bring it back
				if (!this.contains(focused)) {
					Services.focus.setFocus(event.target, Services.focus.FLAG_BYKEY);
				}
				event.preventDefault();
			}
			if (["ArrowRight", "ArrowLeft"].includes(event.key)) {
				// Do nothing on arrow right/left
				event.preventDefault();
			}
			if ([" ", "Enter"].includes(event.key)) {
				// Only handles buttons that change which itemPane deck is visible
				if (!(event.target == this._buttonContainer || event.target.closest(".highlight-notes-active"))) return;
				// Click the first itemPane button in a group to switch from notes to item details pane
				if (event.target === this._buttonContainer && this._contextNotesPaneVisible) {
					let firstBtn = event.target.querySelector(".btn");
					let clickEvent = new MouseEvent('click', {
						bubbles: true,
						cancelable: true,
						detail: 1
					});
					firstBtn.dispatchEvent(clickEvent);
				}
				setTimeout(() => {
					// If notes are visible, tab into them
					if (this._contextNotesPaneVisible) {
						Services.focus.moveFocus(window, this.contextNotesPane, Services.focus.MOVEFOCUS_FORWARD, 0);
					}
					// Tab into the pinned section if it exists
					else if (this.pinnedPane) {
						Services.focus.moveFocus(window, this.container.getEnabledPane(this.pinnedPane),
							Services.focus.MOVEFOCUS_FORWARD, 0);
					}
					// Otherwise, focus the top-level scrollable itemPane
					else {
						this._container.querySelector(".zotero-view-item").focus();
					}
				});
			}
		};

		/**
		 * Help screen readers understand the index of focused tab in the sidenav.
		 * Sidenav has role="tablist", since it can switch between itemDetails and notesContext panes.
		 * However, it also has Locate (and potentially plugin) buttons. It confuses some screen readers
		 * and leads them to announce the index of tabs incorrectly. As a workaround, aria-hide all non-tabs
		 * when a tab is focused and hide tabs when a non-tab is focused.
		 */
		handleFocusIn = (event) => {
			let focusedTab = event.target.getAttribute("role") == "tab";
			
			for (let node of this.querySelectorAll("[tabindex]")) {
				let isTab = node.getAttribute("role") == "tab";
				if (focusedTab) {
					node.setAttribute("aria-hidden", !isTab);
				}
				else {
					node.setAttribute("aria-hidden", isTab);
				}
			}
			
			if (Services.focus.getLastFocusMethod(window) & Services.focus.FLAG_BYMOUSE) {
				event.relatedTarget?.focus();
			}
		};

		handleButtonClick = (event) => {
			let button = event.target;
			let pane = button.dataset.pane;
			if (!pane) return;
			switch (pane) {
				case "context-notes":
					if (event.button !== 0) {
						return;
					}
					if (event.detail == 2) {
						this.pinnedPane = null;
					}
					this._contextNotesPaneVisible = true;
					break;
				default: {
					if (event.button !== 0) {
						return;
					}
					let pinnable = this.isPanePinnable(pane);
					let scrollType = this._collapsed ? 'instant' : 'smooth';
					if (this._collapsed) this._collapsed = false;
					switch (event.detail) {
						case 1:
							if (this._contextNotesPane && this._contextNotesPaneVisible) {
								this._contextNotesPaneVisible = false;
								scrollType = 'instant';
							}
							this.container.scrollToPane(pane, scrollType);
							break;
						case 2:
							if (this.pinnedPane == pane || !pinnable) {
								this.pinnedPane = null;
							}
							else {
								this.pinnedPane = pane;
							}
							break;
					}
				}
			}
			this.render();
		};

		handleButtonContextMenu = (event) => {
			event.preventDefault();
			let button = event.target;
			let paneID = button.dataset.pane;
			if (!paneID) return;
			this._contextMenuTarget = paneID;

			let isPinnable = this.isPanePinnable(paneID);
			this.querySelector('.zotero-menuitem-pin').hidden = !isPinnable || this.pinnedPane == paneID;
			this.querySelector('.zotero-menuitem-unpin').hidden = !isPinnable || this.pinnedPane != paneID;
			this.querySelector('.zotero-menuitem-pin-separator').hidden = !isPinnable;

			this.querySelector('.zotero-menuitem-reorder-up').hidden = !this.isPaneMovable(paneID, 'up');
			this.querySelector('.zotero-menuitem-reorder-down').hidden = !this.isPaneMovable(paneID, 'down');
			this.querySelector('.zotero-menuitem-reorder-reset').hidden = !this.isOrderChanged();

			this.querySelector('.context-menu')
					.openPopupAtScreen(event.screenX, event.screenY, true);
		};

		handlePaneMove = (paneID, direction) => {
			let enabledWrappers = this._enabledWrappers;
			let currentWrapper = this.querySelector(`.btn[data-pane=${CSS.escape(paneID)}]`).parentElement;
			let currentIndex = enabledWrappers.indexOf(currentWrapper);
			let targetIndex;
			if (direction === 'up') {
				targetIndex = currentIndex - 1;
			}
			else if (direction === 'down') {
				targetIndex = currentIndex + 2;
			}
			else {
				return;
			}
			let targetWrapper = enabledWrappers[targetIndex];
			if (targetWrapper) {
				// Insert at the index of the previous wrapper
				this.changePaneOrder(paneID, this._wrappers.indexOf(targetWrapper));
			}
		}

		handleButtonDragStart = (event) => {
			let wrapper = event.target.closest('.pin-wrapper');
			if (!wrapper) return;
			let button = wrapper.querySelector(".btn");
			if (button.hasAttribute("disabled")) return;
			let paneID = button.dataset.pane;
			if (!this.isPaneOrderable(paneID)) return;
			this._draggedWrapper = wrapper;
			event.dataTransfer.dropEffect = "move";
			// Create a clone for a custom drag image.
			let clone = button.cloneNode(true);
			clone.style.position = "absolute";
			clone.style.top = "-1000px";
			clone.style.left = "-1000px";
			this.appendChild(clone);
			event.dataTransfer.setDragImage(clone, 0, 0);
			// Remove the clone after the drag has started.
			setTimeout(() => {
				clone.remove();
			}, 0);
			// Set the data to the pane ID.
			event.dataTransfer.setData("zotero/sidenav", paneID);
		};

		handleButtonDragOver = (event) => {
			let paneID = event.dataTransfer.getData("zotero/sidenav");
			if (!paneID) return;
			event.preventDefault();
			
			let rect = this._buttonContainer.getBoundingClientRect();
			let isStacked = this.classList.contains("stacked");
			let offset = isStacked ? event.clientX - rect.left : event.clientY - rect.top;
			let { index, position } = this.computeDropPosition(offset);

			let currentIndex = this._enabledWrappers.indexOf(this._draggedWrapper);
			if (
				// Dragging the button to the same position
				currentIndex === index || currentIndex === index - 1
				// Dragging the button after the non-orderable button
				|| (
					index > 0
					&& !this.isPaneOrderable(this._enabledWrappers[index - 1].querySelector(".btn").dataset.pane)
				)
			) {
				this._dropIndicator?.setAttribute("hidden", "true");
				// Make pointer forbidden
				event.dataTransfer.dropEffect = "none";
				return;
			}

			event.dataTransfer.dropEffect = "move";
	
			// Create a drop indicator if one doesn't exist.
			if (!this._dropIndicator) {
				this._dropIndicator = document.createElement('div');
				this._dropIndicator.classList.add('drop-indicator');
				this._buttonContainer.appendChild(this._dropIndicator);
			}

			this.style.setProperty("--drop-indicator-offset", `${position}px`);

			this._dropIndicator.removeAttribute("hidden");
		};

		handleButtonDrop = async (event) => {
			let paneID = event.dataTransfer.getData("zotero/sidenav");
			if (!paneID) return;
			event.preventDefault();

			let rect = this._buttonContainer.getBoundingClientRect();
			let isStacked = this.classList.contains("stacked");
			let offset = isStacked ? event.clientX - rect.left : event.clientY - rect.top;
			let { index } = this.computeDropPosition(offset);

			// Drop the button after the non-orderable button is not allowed
			if (
				index > 0
				&& !this.isPaneOrderable(this._enabledWrappers[index - 1].querySelector(".btn").dataset.pane)) {
				return;
			}
			let actualIndex = this._wrappers.indexOf(this._enabledWrappers[index]);

			await this.changePaneOrder(paneID, actualIndex);
		};

		handleButtonDragEnd = (event) => {
			if (!event.dataTransfer.types.includes("zotero/sidenav")) {
				return;
			}
			this._draggedWrapper = null;
			// Clean up the drop indicator if it still exists.
			if (this._dropIndicator) {
				this._dropIndicator.remove();
				this._dropIndicator = null;
			}
		};

		handleButtonDragLeave = (event) => {
			if (this._dropIndicator) {
				this._dropIndicator.setAttribute("hidden", "true");
			}
		};

		handlePaneOrderChange = async (value) => {
			// If no container, wait until it's set
			if (!this.container) return;
			let order = this.getPersistedOrder(value);
			let hasChange = false;
			for (let i = 0; i < order.length; i++) {
				let paneID = order[i];
				let changed = await this.changePaneOrder(paneID, i, {
					scroll: false,
					persist: false,
					render: false
				});
				if (changed && !hasChange) {
					hasChange = true;
				}
			}
			if (hasChange) {
				if (this.pinnedPane) {
					this.container?.scrollToPane(this.pinnedPane, 'instant');
				}
				this.container?.render();
			}
		}
	}
	customElements.define("item-pane-sidenav", ItemPaneSidenav);
}
