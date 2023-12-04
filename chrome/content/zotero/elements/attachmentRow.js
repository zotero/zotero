/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2023 Corporation for Digital Scholarship
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

import { getCSSItemTypeIcon } from 'components/icons';

{
	class AttachmentRow extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="head">
				<html:span class="twisty"/>
				<html:div class="clicky-item">
					<html:span class="icon"/>
					<html:div class="label"/>
				</html:div>
			</html:div>
			<html:div class="body"/>
		`);
		
		_attachment = null;
		
		_mode = null;

		_listenerAdded = false;
		
		static get observedAttributes() {
			return ['attachment-id'];
		}
		
		attributeChangedCallback(name, oldValue, newValue) {
			switch (name) {
				case 'attachment-id':
					this._attachment = Zotero.Items.get(newValue);
					break;
			}
			this.render();
		}

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
			let openHeight = this._body.scrollHeight;
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
		}

		get attachment() {
			return this._attachment;
		}
		
		set attachment(attachment) {
			this._attachment = attachment;
			this.setAttribute('attachment-id', attachment.id);
		}
		
		get attachmentTitle() {
			return this._attachment.getField('title');
		}
		
		get empty() {
			return !this._attachment
				|| !this._attachment.isFileAttachment()
				|| !this._attachment.numAnnotations();
		}
		
		get contextRow() {
			return this.classList.contains('context');
		}
		
		set contextRow(val) {
			this.classList.toggle('context', !!val);
		}
		
		init() {
			this._head = this.querySelector('.head');
			this._head.addEventListener('click', this._handleClick);
			this._head.addEventListener('keydown', this._handleKeyDown);
			
			this._label = this.querySelector('.label');
			this._body = this.querySelector('.body');
			this.open = false;
			this.render();
		}
		
		_handleClick = (event) => {
			if (event.target.closest('.clicky-item')) {
				let win = Zotero.getMainWindow();
				if (win) {
					win.ZoteroPane.selectItem(this._attachment.id);
					win.Zotero_Tabs.select('zotero-pane');
					win.focus();
				}
				return;
			}
			this.open = !this.open;
		};
		
		_handleKeyDown = (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				this.open = !this.open;
				event.preventDefault();
			}
		};
		
		render() {
			if (!this.initialized) return;
			
			this.querySelector('.icon').replaceWith(getCSSItemTypeIcon(this._attachment.getItemTypeIconName()));
			this._label.textContent = this._attachment.getField('title');
			
			this._body.replaceChildren();
			
			if (this._attachment.isFileAttachment()) {
				for (let annotation of this._attachment.getAnnotations()) {
					let row = document.createXULElement('annotation-row');
					row.annotation = annotation;
					this._body.append(row);
				}
			}

			if (!this._listenerAdded) {
				this._body.addEventListener('transitionend', () => {
					this.style.setProperty('--open-height', 'auto');
				});
				this._listenerAdded = true;
			}

			this._head.setAttribute('aria-expanded', this.open);
			this.toggleAttribute('empty', this.empty);
		}
	}

	customElements.define('attachment-row', AttachmentRow);
}
