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
	class EditableText extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:textarea rows="1" />
		`);
		
		_textarea;
		
		static observedAttributes = ['multiline', 'readonly', 'label'];
		
		get multiline() {
			return this.hasAttribute('multiline');
		}
		
		set multiline(multiline) {
			this.toggleAttribute('multiline', multiline);
		}
		
		get readOnly() {
			return this.hasAttribute('readonly');
		}
		
		set readOnly(readOnly) {
			this.toggleAttribute('readonly', readOnly);
		}
		
		get placeholder() {
			return this._textarea.placeholder;
		}
		
		set placeholder(placeholder) {
			this._textarea.placeholder = placeholder;
		}
		
		// Fluent won't set placeholder on an editable-text for some reason, so we use the label property to store
		// the placeholder that will be set on the child <textarea>
		get label() {
			return this.getAttribute('label');
		}
		
		set label(label) {
			this.setAttribute('label', label);
		}
		
		get ariaLabel() {
			return this._textarea.getAttribute('aria-label');
		}
		
		set ariaLabel(ariaLabel) {
			this._textarea.setAttribute('aria-label', ariaLabel);
		}
		
		get value() {
			return this._textarea.value;
		}
		
		set value(value) {
			this._textarea.value = value;
			this.dataset.value = value;
			this.render();
		}
		
		get initialValue() {
			return this._textarea.dataset.initialValue;
		}
		
		attributeChangedCallback() {
			this.render();
		}

		init() {
			this._textarea = this.querySelector('textarea');
			this._textarea.addEventListener('input', () => {
				if (!this.multiline) {
					this._textarea.value = this._textarea.value.replace(/\n/g, ' ');
				}
				this.dataset.value = this._textarea.value;
			});
			this._textarea.addEventListener('focus', () => {
				this._textarea.dataset.initialValue = this._textarea.value;
			});
			this._textarea.addEventListener('blur', () => {
				delete this._textarea.dataset.initialValue;
			});
			this._textarea.addEventListener('keydown', (event) => {
				if (event.key === 'Enter') {
					if (!this.multiline || event.shiftKey) {
						event.preventDefault();
						this._textarea.blur();
					}
				}
				else if (event.key === 'Escape') {
					this._textarea.value = this._textarea.dataset.initialValue;
					this._textarea.blur();
				}
			});
			this.render();
		}

		render() {
			if (!this._textarea) return;
			this._textarea.readOnly = this.readOnly;
			this._textarea.placeholder = this.label;
		}
		
		focus() {
			this._textarea.focus();
		}
		
		blur() {
			this._textarea.blur();
		}
	}
	customElements.define("editable-text", EditableText);
}
