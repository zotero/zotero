/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2025 Corporation for Digital Scholarship
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
	class AnnotationBox extends ItemPaneSectionElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-annotation" data-pane="annotation">
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
			super.item = (item instanceof Zotero.Item && item.isAnnotation()) ? item : null;
			this._updateHidden();
		}

		init() {
			this.initCollapsibleSection();

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'annotationBox');

			this._body = this.querySelector('.body');
		}

		destroy() {
			this._row?.remove();
			this._row = null;
		}

		notify(event, _type, ids, _extraData) {
			if (!this.item) return;

			if (event === "modify" && ids.includes(this.item.id)) {
				this.updateRow();
			}
		}

		render() {}

		async asyncRender() {
			if (!this.initialized || !this.item?.isAnnotation()) return;
			if (this._isAlreadyRendered()) return;

			if (!this._section.open) {
				return;
			}

			if (['ink', 'image'].includes(this.item.annotationType)
					&& !await Zotero.Annotations.hasCacheImage(this.item)) {
				try {
					await Zotero.PDFWorker.renderAttachmentAnnotations(this.item.parentID);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			this.updateRow();
		}

		async updateRow() {
			if (!this._row) {
				this._row = document.createXULElement("annotation-row");
				this._row.setAttribute("annotation-id", this.item.id);
				this._body.appendChild(this._row);
			}
			this._row.annotation = this.item;
			return this._row;
		}

		_updateHidden() {
			this.hidden = !this.item || this.tabType == "reader";
		}
	}
	customElements.define("annotation-box", AnnotationBox);
}
