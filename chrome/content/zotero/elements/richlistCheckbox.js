/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2022 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
					http://zotero.org
	
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
	if (!customElements.get("richlistitem")) {
		delete document.createXULElement("richlistitem");
	}
	/**
	 * Extend richlistbox for checkbox inputs since we use them in multiple places
	 */
	class RichListCheckbox extends customElements.get('richlistitem') {
		connectedCallback() {
			this._checkbox = document.createXULElement('checkbox');
			this._checkbox.setAttribute('native', 'true');
			this._checkbox.setAttribute('checked', this.checked);
			this._checkbox.addEventListener('focus', () => this.control.focus())
			this._label = document.createElement('label');
			this._label.textContent = this.label;
			this.append(this._checkbox);
			this.append(this._label);

			// this.control (parent richlistbox) only available after connecting
			this.control.addEventListener('keypress', (event) => {
				if (
					event.key == " " &&
					!event.ctrlKey &&
					!event.shiftKey &&
					!event.altKey &&
					!event.metaKey
				) {
					if (!this.selected) return;
					this.checked = !this.checked;
					event.stopPropagation();
				}
			});

			this.addEventListener('dblclick', (event) => {
				this.checked = !this.checked;
				event.stopPropagation();
			});
		}
		
		get label() {
			return this.getAttribute('label');
		}
		set label(val) {
			this._label.innerText = val;
			return this.setAttribute('label', 'val');
		}
		
		get checked() {
			return JSON.parse(this.getAttribute('checked'));
		}
		set checked(val) {
			this._checkbox.setAttribute('checked', !!val);	
			return this.setAttribute('checked', !!val);
		}
	}
	
	customElements.define("richlistcheckbox", RichListCheckbox);
}
