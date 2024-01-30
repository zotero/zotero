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
				<html:div class="clicky-item attachment-btn keyboard-clickable" tabindex="0">
					<html:span class="icon"/>
					<html:div class="label"/>
				</html:div>
				<html:div class="clicky-item annotation-btn">
					<html:span class="icon"/>
					<html:span class="label"/>
				</html:div>
			</html:div>
		`);
		
		_attachment = null;
		
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
		
		init() {
			this._attachmentButton = this.querySelector('.attachment-btn');
			this._annotationButton = this.querySelector('.annotation-btn');

			this._attachmentButton.addEventListener('click', this._handleAttachmentClick);
			this._annotationButton.addEventListener('click', this._handleAnnotationClick);

			this.render();
		}

		destroy() {
			this._attachmentButton.removeEventListener('click', this._handleAttachmentClick);
			this._annotationButton.removeEventListener('click', this._handleAnnotationClick);
		}
		
		_handleAttachmentClick = (event) => {
			ZoteroPane.viewAttachment(this._attachment.id, event);
		};

		_handleAnnotationClick = () => {
			// TODO: jump to annotations pane
			let pane = this._getSidenav()?.container.querySelector(`:scope > [data-pane="attachment-annotations"]`);
			if (pane) {
				pane._section.open = true;
			}
			let win = Zotero.getMainWindow();
			if (win) {
				win.ZoteroPane.selectItem(this._attachment.id);
				win.Zotero_Tabs.select('zotero-pane');
				win.focus();
			}
		};

		_getSidenav() {
			// TODO: update this after unifying item pane & context pane
			return document.querySelector(
				Zotero_Tabs.selectedType === 'library'
					? "#zotero-view-item-sidenav"
					: "#zotero-context-pane-sidenav");
		}

		render() {
			if (!this.initialized) return;
			
			this._attachmentButton.querySelector(".icon").replaceWith(getCSSItemTypeIcon(this._attachment.getItemTypeIconName()));
			this._attachmentButton.querySelector(".label").textContent = this._attachment.getField('title');
			let annotationCount = this.attachment.isFileAttachment() ? this.attachment.getAnnotations().length : 0;
			this._annotationButton.hidden = annotationCount == 0;
			this._annotationButton.querySelector(".label").textContent = annotationCount;
		}
	}

	customElements.define('attachment-row', AttachmentRow);
}
