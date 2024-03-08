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
	class AttachmentAnnotationsBox extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-attachments-annotations" data-pane="attachment-annotations">
				<html:div class="body">
				</html:div>
			</collapsible-section>
		`);
		
		get item() {
			return this._item;
		}

		set item(item) {
			this._item = item;
			this._items = null;
			if (item?.isFileAttachment() || item?.isAnnotation()) {
				this.hidden = false;
				this.render();
			}
			else {
				this.hidden = true;
			}
		}

		set items(items) {
			this._items = items;
			this._item = null;
			if (!items.every(item => item.isAnnotation())) {
				this.hidden = true;
			}
			else {
				this.hidden = false;
				this.render();
			}
		}

		get items() {
			return this._items;
		}

		init() {
			this._section = this.querySelector('collapsible-section');
			this._section.addEventListener("toggle", this._handleSectionOpen);
			this._body = this.querySelector('.body');

			this.render();
		}

		destroy() {
			this._section.removeEventListener("toggle", this._handleSectionOpen);
		}

		notify(action, type, ids) {
			console.log("MODIFY ", action, type);
			if (action == 'modify'
				&& (this.item && ids.includes(this.item.id))
				|| (this.items && this.items.some(item => ids.includes(item.id)))) {
				console.log("Rerender ", this.item);
				this.render();
			}
		}

		render() {
			if (!this.initialized || !this._shouldRender()) return;
			let annotations = [];
			if (this.item) {
				annotations = this.item.isAnnotation() ? [this.item] : this.item.getAnnotations();
			}
			else {
				annotations = this._items;
			}
			this._section.setCount(annotations.length);

			this._body.replaceChildren();

			if (!this._section.open) {
				return;
			}

			let count = annotations.length;
			if (count === 0) {
				this.hidden = true;
				return;
			}

			this.hidden = false;
			for (let annotation of annotations) {
				let row = document.createXULElement('annotation-row');
				row.annotation = annotation;
				this._body.append(row);
			}
		}

		_handleSectionOpen = (event) => {
			if (event.target !== this._section || !this._section.open) {
				return;
			}
			this.render();
		};

		_shouldRender() {
			if (this.item) {
				return this.item.isFileAttachment() || this.item.isAnnotation();
			}
			if (this.items) {
				return this.items.every(item => item.isAnnotation());
			}
			return false;
		}
	}
	customElements.define("attachment-annotations-box", AttachmentAnnotationsBox);
}
