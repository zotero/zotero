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
			<html:div class="inherit-flex highlight-notes-inactive">
				<html:div class="pin-wrapper">
					<toolbarbutton
						id="sidenav-info-btn"
						disabled="true"
						data-l10n-id="sidenav-info"
						data-pane="info"/>
				</html:div>
				<html:div class="pin-wrapper">
					<toolbarbutton
						disabled="true"
						data-l10n-id="sidenav-abstract"
						data-pane="abstract"/>
				</html:div>
				<html:div class="pin-wrapper" hidden="true">
					<toolbarbutton
						disabled="true"
						data-l10n-id="sidenav-attachment-preview"
						data-pane="attachment-preview"/>
				</html:div>
				<html:div class="pin-wrapper">
					<toolbarbutton
						disabled="true"
						data-l10n-id="sidenav-attachments"
						data-pane="attachments"/>
				</html:div>
				<html:div class="pin-wrapper">
					<toolbarbutton
						disabled="true"
						data-l10n-id="sidenav-notes"
						data-pane="notes"/>
				</html:div>
				<html:div class="pin-wrapper" hidden="true">
					<toolbarbutton
						disabled="true"
						data-l10n-id="sidenav-attachment-info"
						data-pane="attachment-info"/>
				</html:div>
				<html:div class="pin-wrapper" hidden="true">
					<toolbarbutton
						disabled="true"
						data-l10n-id="sidenav-attachment-annotations"
						data-pane="attachment-annotations"/>
				</html:div>
				<html:div class="pin-wrapper">
					<toolbarbutton
						disabled="true"
						data-l10n-id="sidenav-libraries-collections"
						data-pane="libraries-collections"/>
				</html:div>
				<html:div class="pin-wrapper">
					<toolbarbutton
						disabled="true"
						data-l10n-id="sidenav-tags"
						data-pane="tags"/>
				</html:div>
				<html:div class="pin-wrapper">
					<toolbarbutton
						disabled="true"
						data-l10n-id="sidenav-related"
						data-pane="related"/>
				</html:div>
			</html:div>
			
			<html:div class="divider"/>
			
			<html:div class="pin-wrapper highlight-notes-active">
				<toolbarbutton
					data-l10n-id="sidenav-notes"
					data-pane="context-notes"
					tabindex="0"
					role="tab"/>
			</html:div>

			<html:div class="divider"/>
			
			<html:div class="pin-wrapper">
				<toolbarbutton
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
				</menupopup>
			</popupset>
		`, ['chrome://zotero/locale/zotero.dtd']);
		
		_container = null;
		
		_contextNotesPane = null;
		
		_contextMenuTarget = null;

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
		
		isPanePinnable(id) {
			return id !== 'info' && id !== 'context-notes' && id !== 'context-all-notes' && id !== 'context-item-notes';
		}
		
		init() {
			this._buttonContainer = this.querySelector('.inherit-flex');
			for (let toolbarbutton of this.querySelectorAll('toolbarbutton[data-pane]')) {
				let pane = toolbarbutton.dataset.pane;
				
				let pinnable = this.isPanePinnable(pane);
				toolbarbutton.parentElement.classList.toggle('pinnable', pinnable);
				
				if (pinnable) {
					toolbarbutton.addEventListener('contextmenu', (event) => {
						this._contextMenuTarget = pane;
						this.querySelector('.zotero-menuitem-pin').hidden = this.pinnedPane == pane;
						this.querySelector('.zotero-menuitem-unpin').hidden = this.pinnedPane != pane;
						this.querySelector('.context-menu')
							.openPopupAtScreen(event.screenX, event.screenY, true);
					});
				}
			}

			this.addEventListener('click', this.handleButtonClick);
			this.addEventListener('keydown', this.handleKeyDown);
			this.addEventListener('focusin', this.handleFocusIn);
			// Set up action toolbarbuttons
			for (let toolbarbutton of this.querySelectorAll('toolbarbutton[data-action]')) {
				let action = toolbarbutton.dataset.action;
				
				if (action === 'locate') {
					toolbarbutton.addEventListener('mousedown', async (event) => {
						if (event.button !== 0 || toolbarbutton.open) {
							return;
						}
						event.preventDefault();
						let menu = toolbarbutton.querySelector('menupopup');
						await Zotero_LocateMenu.buildLocateMenu(menu);
						await document.l10n.translateFragment(menu);
						toolbarbutton.open = true;
					});
				}
			}
			
			// Make all toolbarbuttons focusable
			for (let toolbarbutton of this.querySelectorAll("toolbarbutton")) {
				toolbarbutton.setAttribute("tabindex", 0);
			}
			this.querySelector('.zotero-menuitem-pin').addEventListener('command', () => {
				this.container.scrollToPane(this._contextMenuTarget, 'smooth');
				this.pinnedPane = this._contextMenuTarget;
			});
			this.querySelector('.zotero-menuitem-unpin').addEventListener('command', () => {
				this.pinnedPane = null;
			});
			this.setAttribute("role", "tablist");
		}

		destroy() {
			this.removeEventListener('click', this.handleButtonClick);
			this.removeEventListener('keydown', this.handleKeyDown);
			this.removeEventListener('focusin', this.handleFocusIn);
		}

		render() {
			if (!this.container) return;
			let contextNotesPaneVisible = this._contextNotesPaneVisible;
			let pinnedPane = this.pinnedPane;
			for (let toolbarbutton of this.querySelectorAll('toolbarbutton[data-pane]')) {
				let pane = toolbarbutton.dataset.pane;
				// TEMP: never disable context notes button
				if (this._contextNotesPane) {
					toolbarbutton.disabled = false;
				}
				
				if (pane == 'context-notes') {
					let hidden = !this._contextNotesPane;
					let selected = contextNotesPaneVisible;
					
					toolbarbutton.parentElement.hidden = hidden;
					toolbarbutton.parentElement.previousElementSibling.hidden = hidden; // Divider
					
					toolbarbutton.setAttribute('aria-selected', selected);
					
					continue;
				}
				
				// No need to set `hidden` here, since it's updated by ItemDetails#_handlePaneStatus
				// Set .pinned on the container, for pin styling
				toolbarbutton.parentElement.classList.toggle('pinned', pane == pinnedPane);
			}
			
			for (let toolbarbutton of this.querySelectorAll('toolbarbutton[data-action]')) {
				let action = toolbarbutton.dataset.action;
				
				if (action == 'locate') {
					toolbarbutton.parentElement.hidden = false;
				}
			}
			
			this.querySelector('.highlight-notes-active').classList.toggle('highlight', contextNotesPaneVisible);
			this.querySelector('.highlight-notes-inactive').classList.toggle('highlight',
				this._contextNotesPane && !contextNotesPaneVisible);
		}

		addPane(paneID) {
			let toolbarbutton = this.querySelector(`toolbarbutton[data-pane=${paneID}]`);
			if (toolbarbutton) {
				toolbarbutton.parentElement.hidden = false;
				return;
			}
			let pane = this.container.getPane(paneID);
			if (!pane) return;
			let sidenavOptions = {};
			try {
				sidenavOptions = JSON.parse(pane.dataset.sidenavOptions);
			}
			catch (e) {}
			let { icon, darkIcon, l10nID, l10nArgs } = sidenavOptions;
			if (!darkIcon) darkIcon = icon;
			toolbarbutton = document.createXULElement("toolbarbutton");
			toolbarbutton.setAttribute("custom", "true");
			toolbarbutton.dataset.pane = paneID;
			toolbarbutton.dataset.l10nId = l10nID;
			toolbarbutton.dataset.l10nArgs = l10nArgs;
			toolbarbutton.style = `--custom-sidenav-icon-light: url('${icon}'); --custom-sidenav-icon-dark: url('${darkIcon}');`;
			toolbarbutton.addEventListener('contextmenu', (event) => {
				this._contextMenuTarget = paneID;
				this.querySelector('.zotero-menuitem-pin').hidden = this.pinnedPane == paneID;
				this.querySelector('.zotero-menuitem-unpin').hidden = this.pinnedPane != paneID;
				this.querySelector('.context-menu')
					.openPopupAtScreen(event.screenX, event.screenY, true);
			});

			let container = document.createElement("div");
			container.classList.add("pin-wrapper");
			container.classList.add("pinnable");
			container.append(toolbarbutton);
			if (this._defaultStatus) toolbarbutton.disabled = true;
			toolbarbutton.parentElement.hidden = this._defaultStatus || !this.container.getEnabledPane(paneID);
			this._buttonContainer.append(container);
		}

		removePane(paneID) {
			let toolbarbutton = this.querySelector(`toolbarbutton[data-pane=${paneID}]`);
			if (!toolbarbutton) return;
			toolbarbutton.parentElement.remove();
		}

		updatePaneStatus(paneID) {
			if (!paneID) {
				this.render();
				return;
			}

			let toolbarbutton = this.querySelector(`toolbarbutton[data-pane=${paneID}]`);
			if (!toolbarbutton) return;
			toolbarbutton.parentElement.hidden = !this.container.getEnabledPane(paneID);
			if (this.pinnedPane) {
				if (paneID == this.pinnedPane && !toolbarbutton.parentElement.classList.contains("pinned")) {
					this.querySelector(".pin-wrapper.pinned")?.classList.remove("pinned");
					toolbarbutton.parentElement.classList.add('pinned');
				}
			}
			else {
				this.querySelector(".pin-wrapper.pinned")?.classList.remove("pinned");
			}
		}

		toggleDefaultStatus(isDefault) {
			this._defaultStatus = isDefault;
			this.renderDefaultStatus();
		}

		renderDefaultStatus() {
			if (this._defaultStatus) {
				this.querySelectorAll('toolbarbutton[data-pane]').forEach((elem) => {
					elem.disabled = true;
					elem.parentElement.hidden = !(
						["info", "abstract", "attachments", "notes", "libraries-collections", "tags", "related"]
							.includes(elem.dataset.pane));
				});

				this.querySelectorAll('toolbarbutton[data-action]').forEach((elem) => {
					elem.disabled = false;
				});
			}
			else {
				this.querySelectorAll('toolbarbutton').forEach((elem) => {
					elem.disabled = false;
				});
				this.render();
			}
		}

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
				// Click on the sidenav toolbarbutton
				event.target.click();
				event.stopPropagation();
				let pane = event.target.dataset.pane;
				// Tab into the notes pane
				if (pane == "context-notes") {
					Services.focus.moveFocus(window, this.contextNotesPane, Services.focus.MOVEFOCUS_FORWARD, 0);
				}
				// Tab into the pane whose sidenav button was clicked
				else if (event.target.dataset.pane) {
					let section = this._container.getEnabledPane(pane);
					Services.focus.moveFocus(window, section, Services.focus.MOVEFOCUS_FORWARD, 0);
				}
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
			let toolbarbutton = event.target;
			let pane = toolbarbutton.dataset.pane;
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
					// single click via mouse of keypress
					let isSingledClick = event.detail == 0 || event.detail == 1;
					let isDoubleClick = event.detail == 2;
					if (isSingledClick) {
						if (this._contextNotesPane && this._contextNotesPaneVisible) {
							this._contextNotesPaneVisible = false;
							scrollType = 'instant';
						}
						this.container.scrollToPane(pane, scrollType);
					}
					else if (isDoubleClick) {
						if (this.pinnedPane == pane || !pinnable) {
							this.pinnedPane = null;
						}
						else {
							this.pinnedPane = pane;
						}
					}
				}
			}
			this.render();
		};
	}
	customElements.define("item-pane-sidenav", ItemPaneSidenav);
}
