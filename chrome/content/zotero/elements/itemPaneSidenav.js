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
			<html:div class="toolbarbutton-container">
				<toolbarbutton
					data-l10n-id="sidenav-info"
					data-pane="info"/>
			</html:div>
			<html:div class="toolbarbutton-container">
				<toolbarbutton
					data-l10n-id="sidenav-abstract"
					data-pane="abstract"/>
			</html:div>
			<html:div class="toolbarbutton-container">
				<toolbarbutton
					data-l10n-id="sidenav-attachments"
					data-pane="attachments"/>
			</html:div>
			<html:div class="toolbarbutton-container">
				<toolbarbutton
					data-l10n-id="sidenav-notes"
					data-pane="notes"/>
			</html:div>
			<html:div class="toolbarbutton-container">
				<toolbarbutton
					data-l10n-id="sidenav-tags"
					data-pane="tags"/>
			</html:div>
			<html:div class="toolbarbutton-container">
				<toolbarbutton
					data-l10n-id="sidenav-related"
					data-pane="related"/>
			</html:div>
			
			<popupset>
				<menupopup class="context-menu">
					<menuitem class="menuitem-iconic zotero-menuitem-pin" data-l10n-id="pin-section"/>
					<menuitem class="menuitem-iconic zotero-menuitem-unpin" data-l10n-id="unpin-section"/>
				</menupopup>
			</popupset>
		`, ['chrome://zotero/locale/zotero.dtd']);
		
		_container = null;
		
		_contextMenuTarget = null;

		_preserveMinScrollHeightTimeout = null;
		
		get container() {
			return this._container;
		}
		
		set container(val) {
			if (this._container == val) return;
			this._container?.removeEventListener('scroll', this._handleContainerScroll);
			this._container = val;
			this._container.addEventListener('scroll', this._handleContainerScroll);
			this.render();
		}
		
		get pinnedPane() {
			return this.getAttribute('pinnedPane');
		}
		
		set pinnedPane(val) {
			this.setAttribute('pinnedPane', val || '');
			if (val) {
				this._pinnedPaneMinScrollHeight = this._getMinScrollHeightForPane(this.getPane(val));
			}
		}
		
		get _minScrollHeight() {
			return parseFloat(this._container.style.getPropertyValue('--min-scroll-height') || 0);
		}
		
		set _minScrollHeight(val) {
			this._container.style.setProperty('--min-scroll-height', val + 'px');
		}

		static get observedAttributes() {
			return ['pinnedPane'];
		}

		attributeChangedCallback() {
			this.render();
		}

		scrollToPane(id, behavior = 'smooth') {
			let pane = this.getPane(id);
			if (!pane) return;
			
			// The pane should always be at the very top
			// If there isn't enough stuff below it for it to be at the top, we add padding
			// We use a ::before pseudo-element for this so that we don't need to add another level to the DOM
			this._makeSpaceForPane(pane);
			if (behavior == 'smooth' && pane.getBoundingClientRect().top > this._container.getBoundingClientRect().top) {
				if (this._preserveMinScrollHeightTimeout) {
					clearTimeout(this._preserveMinScrollHeightTimeout);
				}
				this._preserveMinScrollHeightTimeout = setTimeout(() => {
					this._preserveMinScrollHeightTimeout = null;
					this._handleContainerScroll();
				}, 1000);
			}
			pane.scrollIntoView({ block: 'start', behavior });
			pane.focus();
		}
		
		_makeSpaceForPane(pane) {
			let oldMinScrollHeight = this._minScrollHeight;
			let newMinScrollHeight = this._getMinScrollHeightForPane(pane);
			if (newMinScrollHeight > oldMinScrollHeight) {
				this._minScrollHeight = newMinScrollHeight;
			}
		}
		
		_getMinScrollHeightForPane(pane) {
			let paneRect = pane.getBoundingClientRect();
			let containerRect = this._container.getBoundingClientRect();
			// No offsetTop property for XUL elements
			let offsetTop = paneRect.top - containerRect.top + this._container.scrollTop;
			return offsetTop + containerRect.height;
		}

		_handleContainerScroll = () => {
			if (this._preserveMinScrollHeightTimeout) return;
			let minHeight = this._minScrollHeight;
			if (minHeight) {
				let newMinScrollHeight = this._container.scrollTop + this._container.clientHeight;
				// Ignore overscroll (which generates scroll events on Windows 11, unlike on macOS)
				// and don't shrink below the pinned pane's min scroll height
				if (newMinScrollHeight > this._container.scrollHeight
						|| this.pinnedPane && newMinScrollHeight < this._pinnedPaneMinScrollHeight) {
					return;
				}
				this._minScrollHeight = newMinScrollHeight;
			}
		};
		
		getPanes() {
			return Array.from(this.container.querySelectorAll(':scope > [data-pane]'));
		}
		
		getPane(id) {
			return this.container.querySelector(`:scope > [data-pane="${CSS.escape(id)}"]`);
		}
		
		isPanePinnable(id) {
			return id !== 'info';
		}

		init() {
			if (!this.container) {
				this.container = document.getElementById('zotero-view-item');
			}
			
			for (let toolbarbutton of this.querySelectorAll('toolbarbutton')) {
				let pane = toolbarbutton.dataset.pane;
				let pinnable = this.isPanePinnable(pane);
				toolbarbutton.parentElement.classList.toggle('pinnable', pinnable);
				
				toolbarbutton.addEventListener('click', (event) => {
					switch (event.detail) {
						case 1:
							this.scrollToPane(pane, 'smooth');
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
				});

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
			
			this.querySelector('.zotero-menuitem-pin').addEventListener('command', () => {
				this.scrollToPane(this._contextMenuTarget, 'smooth');
				this.pinnedPane = this._contextMenuTarget;
			});
			this.querySelector('.zotero-menuitem-unpin').addEventListener('command', () => {
				this.pinnedPane = null;
			});
			
			this.render();
		}

		render() {
			let pinnedPane = this.pinnedPane;
			for (let toolbarbutton of this.querySelectorAll('toolbarbutton')) {
				let pane = toolbarbutton.dataset.pane;
				toolbarbutton.setAttribute('aria-selected', pane == pinnedPane);
				toolbarbutton.parentElement.hidden = !this.getPane(pane);

				// Set .pinned on the container, for pin styling
				toolbarbutton.parentElement.classList.toggle('pinned', pane == pinnedPane);
			}
		}
	}
	customElements.define("item-pane-sidenav", ItemPaneSidenav);
}
