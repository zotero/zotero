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
	class CollapsibleSection extends XULElementBase {
		_head = null;
		
		_title = null;

		_addButton = null;
		
		_listenerAdded = false;
		
		get open() {
			if (this.empty) {
				return false;
			}
			return this.hasAttribute('open');
		}
		
		set open(val) {
			val = !!val;
			let open = this.open;
			if (open === val || this.empty) return;
			this.render();
			let openHeight = this._head?.nextSibling?.scrollHeight;
			if (openHeight) {
				this.style.setProperty('--open-height', `${openHeight}px`);
			}
			else {
				this.style.setProperty('--open-height', 'auto');
			}
			
			// eslint-disable-next-line no-void
			void getComputedStyle(this).maxHeight; // Force style calculation! Without this the animation doesn't work
			this.toggleAttribute('open', val);
			if (!this.dispatchEvent(new CustomEvent('toggle', { bubbles: false, cancelable: true }))) {
				// Revert
				this.toggleAttribute('open', open);
				return;
			}
			if (!val && this.ownerDocument?.activeElement && this.contains(this.ownerDocument?.activeElement)) {
				this.ownerDocument.activeElement.blur();
			}
			
			this._saveOpenState();
		}
		
		get empty() {
			return this.hasAttribute('empty');
		}
		
		set empty(val) {
			this.toggleAttribute('empty', !!val);
		}
		
		setCount(count) {
			this.setAttribute('data-l10n-args', JSON.stringify({ count }));
			this.empty = !count;
		}
		
		get label() {
			return this.getAttribute('label');
		}
		
		set label(val) {
			this.setAttribute('label', val);
		}
		
		get showAdd() {
			return this.hasAttribute('show-add');
		}
		
		set showAdd(val) {
			this.toggleAttribute('show-add', !!val);
		}
		
		static get observedAttributes() {
			return ['open', 'empty', 'label', 'show-add'];
		}
		
		attributeChangedCallback() {
			this.render();
		}
		
		init() {
			if (!this.dataset.pane) {
				throw new Error('data-pane is required');
			}
			
			this.tabIndex = 0;
			
			this._head = document.createElement('div');
			this._head.role = 'button';
			this._head.className = 'head';
			this._head.addEventListener('click', this._handleClick);
			this._head.addEventListener('keydown', this._handleKeyDown);

			this._title = document.createElement('span');
			this._title.className = 'title';
			this._head.append(this._title);
			
			this._addButton = document.createXULElement('toolbarbutton');
			this._addButton.className = 'add';
			this._addButton.addEventListener('command', (event) => {
				this.dispatchEvent(new CustomEvent('add', { ...event, bubbles: false }));
			});
			this._head.append(this._addButton);
			
			let twisty = document.createXULElement('toolbarbutton');
			twisty.className = 'twisty';
			this._head.append(twisty);
			
			this.prepend(this._head);
			this._restoreOpenState();
			this.render();
			
			this._notifierID = Zotero.Prefs.registerObserver(`panes.${this.dataset.pane}.open`, this._restoreOpenState.bind(this));
			
			if (this.hasAttribute('data-l10n-id') && !this.hasAttribute('data-l10n-args')) {
				this.setAttribute('data-l10n-args', JSON.stringify({ count: 0 }));
			}
		}
		
		destroy() {
			this._head.removeEventListener('click', this._handleClick);
			this._head.removeEventListener('keydown', this._handleKeyDown);
			
			Zotero.Prefs.unregisterObserver(this._notifierID);
		}
		
		_saveOpenState() {
			Zotero.Prefs.set(`panes.${this.dataset.pane}.open`, this.open);
		}
		
		_restoreOpenState() {
			this.open = Zotero.Prefs.get(`panes.${this.dataset.pane}.open`) ?? true;
		}
		
		_handleClick = (event) => {
			if (event.target.closest('.add')) return;
			this.open = !this.open;
		};
		
		_handleKeyDown = (event) => {
			if (event.target.closest('.add')) return;
			if (event.key === 'Enter' || event.key === ' ') {
				this.open = !this.open;
				event.preventDefault();
			}
		};
		
		render() {
			if (!this.initialized) return;
			
			if (!this._listenerAdded && this._head?.nextSibling) {
				this._head.nextSibling.addEventListener('transitionend', () => {
					this.style.setProperty('--open-height', 'auto');
				});
				this._listenerAdded = true;
			}
			
			this._head.setAttribute('aria-expanded', this.open);
			this._title.textContent = this.label;
			this._addButton.hidden = !this.showAdd;
		}
	}
	customElements.define("collapsible-section", CollapsibleSection);
}
