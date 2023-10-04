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
			<toolbarbutton
				data-l10n-id="sidenav-info"
				data-pane="info"/>
			<toolbarbutton
				data-l10n-id="sidenav-abstract"
				data-pane="abstract"/>
			<toolbarbutton
				data-l10n-id="sidenav-attachments"
				data-pane="attachments"/>
			<toolbarbutton
				data-l10n-id="sidenav-notes"
				data-pane="notes"/>
			<toolbarbutton
				data-l10n-id="sidenav-tags"
				data-pane="tags"/>
			<toolbarbutton
				data-l10n-id="sidenav-related"
				data-pane="related"/>
		`, ['chrome://zotero/locale/zotero.dtd']);
		
		_container = null;
		
		_currentSmoothScrollTarget = null;
		
		_smoothScrollTargetTimeout = null;
		
		get container() {
			return this._container;
		}
		
		set container(val) {
			if (this._container == val) return;
			
			this._container?.removeEventListener('scroll', this._updateSelectedPane.bind(this), { passive: true });
			this._container = val;
			this._container.addEventListener('scroll', this._updateSelectedPane.bind(this), { passive: true });

			this._updateSelectedPane();
			this.render();
		}
		
		get selectedPane() {
			return this.getAttribute('selectedPane');
		}
		
		set selectedPane(val) {
			this.setAttribute('selectedPane', val);
			this.render();
		}

		static get observedAttributes() {
			return ['selectedPane'];
		}

		attributeChangedCallback() {
			this.render();
		}

		scrollToPane(id, behavior = 'smooth') {
			let pane = this._getPane(id);
			if (pane) {
				this._currentSmoothScrollTarget = id;
				pane.scrollIntoView({ block: 'start', behavior });
				
				if (this._smoothScrollTargetTimeout) {
					clearTimeout(this._smoothScrollTargetTimeout);
				}
				this._smoothScrollTargetTimeout = setTimeout(() => {
					this._currentSmoothScrollTarget = null;
				}, 1000);
			}
		}
		
		_updateSelectedPane() {
			let topPane = null;
			let containerBoundingRect = this.container.getBoundingClientRect();
			for (let box of this._getPanes()) {
				// Allow a little padding to deal with floating-point imprecision
				if (box.getBoundingClientRect().top > containerBoundingRect.top + 5) {
					break;
				}
				topPane = box.dataset.pane;
			}
			if (this._currentSmoothScrollTarget) {
				if (this._currentSmoothScrollTarget == topPane) {
					this._currentSmoothScrollTarget = null;
				}
				else {
					return;
				}
			}
			this.selectedPane = topPane || 'info';
		}

		_getPanes() {
			return Array.from(this.container.querySelectorAll('[data-pane]'));
		}
		
		_getPane(id) {
			return this.container.querySelector(':scope > [data-pane="' + id + '"]');
		}

		init() {
			if (!this.container) {
				this.container = document.getElementById('zotero-view-item');
			}

			for (let toolbarbutton of this.children) {
				toolbarbutton.addEventListener('command', () => {
					this.selectedPane = toolbarbutton.dataset.pane;
					this.scrollToPane(toolbarbutton.dataset.pane);
				});
			}
			this.render();
		}

		render() {
			let currentPane = this.selectedPane;
			for (let toolbarbutton of this.children) {
				let pane = toolbarbutton.dataset.pane;
				toolbarbutton.hidden = !this._getPane(pane);
				toolbarbutton.toggleAttribute('selected', pane == currentPane);
				toolbarbutton.setAttribute('aria-selected', pane == currentPane);
			}
		}
	}
	customElements.define("item-pane-sidenav", ItemPaneSidenav);
}
