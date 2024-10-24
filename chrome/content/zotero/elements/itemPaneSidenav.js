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
				<html:div class="pin-wrapper show-by-default">
					<toolbarbutton
						disabled="true"
						data-l10n-id="sidenav-info"
						data-pane="info"/>
				</html:div>
				<html:div class="pin-wrapper show-by-default">
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
				<html:div class="pin-wrapper show-by-default">
					<toolbarbutton
						disabled="true"
						data-l10n-id="sidenav-attachments"
						data-pane="attachments"/>
				</html:div>
				<html:div class="pin-wrapper show-by-default">
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
				<html:div class="pin-wrapper show-by-default">
					<toolbarbutton
						disabled="true"
						data-l10n-id="sidenav-libraries-collections"
						data-pane="libraries-collections"/>
				</html:div>
				<html:div class="pin-wrapper show-by-default">
					<toolbarbutton
						disabled="true"
						data-l10n-id="sidenav-tags"
						data-pane="tags"/>
				</html:div>
				<html:div class="pin-wrapper show-by-default">
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
					data-pane="context-notes"/>
			</html:div>
			
			<html:div class="divider"/>
			
			<html:div class="pin-wrapper show-by-default">
				<toolbarbutton
					tooltiptext="&zotero.toolbar.openURL.label;"
					type="menu"
					data-action="locate">
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

		_disableScrollHandler = false;
		
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
			
			this.querySelector('.zotero-menuitem-pin').addEventListener('command', () => {
				this.container.scrollToPane(this._contextMenuTarget, 'smooth');
				this.pinnedPane = this._contextMenuTarget;
			});
			this.querySelector('.zotero-menuitem-unpin').addEventListener('command', () => {
				this.pinnedPane = null;
			});
		}

		destroy() {
			this.removeEventListener('click', this.handleButtonClick);
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
				
				toolbarbutton.setAttribute('aria-selected', !contextNotesPaneVisible && pane == pinnedPane);
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
			let { icon, darkIcon, l10nID, l10nArgs, showByDefault } = sidenavOptions;
			if (!darkIcon) darkIcon = icon;
			toolbarbutton = document.createXULElement("toolbarbutton");
			toolbarbutton.setAttribute("custom", "true");
			toolbarbutton.dataset.pane = paneID;
			toolbarbutton.dataset.l10nId = l10nID;
			toolbarbutton.dataset.l10nArgs = l10nArgs;
			toolbarbutton.style.setProperty("--custom-sidenav-icon-light", `url('${icon}'`);
			toolbarbutton.style.setProperty("--custom-sidenav-icon-dark", `url('${darkIcon}'`);
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
			if (showByDefault) {
				container.classList.add("show-by-default");
			}
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
			this.classList.toggle("default-status", isDefault);
			this.renderDefaultStatus();
		}

		renderDefaultStatus() {
			if (this._defaultStatus) {
				this.querySelectorAll('toolbarbutton[data-pane]').forEach((elem) => {
					elem.disabled = true;
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
	}
	customElements.define("item-pane-sidenav", ItemPaneSidenav);
}
