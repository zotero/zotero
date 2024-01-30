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
	class AttachmentAnnotationsBox extends ItemPaneSectionElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-attachments-annotations" data-pane="attachment-annotations">
				<html:div class="body">
				</html:div>
			</collapsible-section>
		`);

		get tabType() {
			return this._tabType;
		}

		set tabType(tabType) {
			this._tabType = tabType;
			this._updateHidden();
		}
		
		get item() {
			return this._item;
		}

		set item(item) {
			this._item = item;
			this._updateHidden();
		}

		init() {
			this.initCollapsibleSection();

			this._body = this.querySelector('.body');
		}

		destroy() {}

		notify(action, type, ids) {
			if (action == 'modify' && this.item && ids.includes(this.item.id)) {
				this.render(true);
			}
		}

		render(force = false) {
			if (!this.initialized || !this.item?.isFileAttachment()) return;
			if (!force && this._isAlreadyRendered()) return;

			let annotations = this.item.getAnnotations();
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

		_updateHidden() {
			this.hidden = !this.item?.isFileAttachment() || this.tabType == "reader";
		}
	}
	customElements.define("attachment-annotations-box", AttachmentAnnotationsBox);
}
