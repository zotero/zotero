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
			super.tabType = tabType;
			this._updateHidden();
		}
		
		get item() {
			return this._item;
		}

		set item(item) {
			super.item = (item instanceof Zotero.Item && item.isFileAttachment()) ? item : null;
			this._updateHidden();
		}

		init() {
			this.initCollapsibleSection();

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'attachmentAnnotationsBox');

			this._body = this.querySelector('.body');

			this._annotationItems = [];
		}

		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		notify(event, _type, ids, _extraData) {
			if (!this.item) return;

			this._annotationItems = this.item.getAnnotations();
			let annotations = this._annotationItems.filter(
				annotation => ids.includes(annotation.id));
			
			if (["add", "modify"].includes(event)) {
				for (let annotation of annotations) {
					let row = this.querySelector(`annotation-row[annotation-id="${annotation.id}"]`);
					row?.remove();
					this.addRow(annotation);
				}
			}
			else if (event == 'delete') {
				for (let id of ids) {
					let row = this.querySelector(`annotation-row[annotation-id="${id}"]`);
					row?.remove();
				}
			}
			this.updateCount();
		}

		render() {
			this._annotationItems = this.item.getAnnotations();
			this.updateCount();
		}

		async asyncRender() {
			if (!this.initialized || !this.item?.isFileAttachment()) return;
			if (this._isAlreadyRendered()) return;

			this._body.replaceChildren();

			if (!this._section.open || this._annotationItems.length === 0) {
				return;
			}

			this.hidden = false;
			let imageAnnotationRendered = false;
			for (let annotation of this._annotationItems) {
				if (!imageAnnotationRendered
						&& annotation.annotationType === 'image'
						&& !await Zotero.Annotations.hasCacheImage(annotation)) {
					try {
						await Zotero.PDFWorker.renderAttachmentAnnotations(annotation.parentID);
						imageAnnotationRendered = true;
					}
					catch (e) {
						Zotero.logError(e);
					}
				}
				this.addRow(annotation);
			}
		}

		addRow(annotation) {
			let row = document.createXULElement('annotation-row');
			row.annotation = annotation;
			
			let index = this._annotationItems.findIndex(item => item.id == annotation.id);
			if (index < 0 || index >= this._body.children.length) {
				this._body.append(row);
			}
			else {
				this._body.insertBefore(row, this._body.children[index]);
			}
			return row;
		}

		updateCount() {
			let count = this._annotationItems.length;
			this._section.setCount(count);
			if (count === 0) {
				this.hidden = true;
			}
			return count;
		}

		_updateHidden() {
			this.hidden = !this.item || this.tabType == "reader";
		}
	}
	customElements.define("attachment-annotations-box", AttachmentAnnotationsBox);
}
