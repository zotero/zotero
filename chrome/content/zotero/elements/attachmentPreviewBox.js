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
	class AttachmentPreviewBox extends ItemPaneSectionElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-attachment-preview" data-pane="attachment-preview">
				<html:div class="body">
					<attachment-preview id="attachment-preview"/>
					<html:span id="preview-placeholder" data-l10n-id="attachment-preview-placeholder"></html:span>
				</html:div>
			</collapsible-section>
		`);

		constructor() {
			super();

			this._item = null;
			this._section = null;
			this._preview = null;
		}

		get item() {
			return this._item;
		}

		set item(item) {
			if (!(item instanceof Zotero.Item)) {
				throw new Error("'item' must be a Zotero.Item");
			}
			// TEMP: disable the preview section for now
			this.hidden = true;
			// this._item = item;
			// if (this._item.isRegularItem()) {
			// 	this.hidden = false;
			// 	this.render();
			// }
			// else {
			// 	this.hidden = true;
			// }
		}

		init() {
			this.initCollapsibleSection();
			this._preview = this.querySelector("#attachment-preview");
		}

		destroy() {}

		async render() {
			if (!this._section.open) return;
			let bestAttachment = await this.item.getBestAttachment();
			if (bestAttachment) {
				this._preview.item = bestAttachment;
			}
			this.toggleAttribute("data-use-preview", !!bestAttachment);
		}
	}

	customElements.define("attachment-preview-box", AttachmentPreviewBox);
}
