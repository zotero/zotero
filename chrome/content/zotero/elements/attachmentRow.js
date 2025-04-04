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
				<html:div class="clicky-item attachment-btn keyboard-clickable" tabindex="0" role="button">
					<html:span class="icon"/>
					<html:div class="label"/>
				</html:div>
				<html:div class="clicky-item annotation-btn keyboard-clickable" tabindex="0" role="button" data-l10n-id="section-button-annotations" data-l10n-attrs="tooltiptext,aria-label" >
					<html:span class="icon"/>
					<html:span class="label"/>
				</html:div>
				<toolbarbutton class="zotero-clicky zotero-clicky-minus" tabindex="0" data-l10n-id="section-button-remove" disabled="false">
					<image class="toolbarbutton-icon"/>
					<label class="toolbarbutton-text" />
				</toolbarbutton>
			</html:div>
		`);
		
		_attachment = null;
		
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
			if (attachment.id) {
				this.setAttribute('attachment-id', attachment.id);
			}
		}
		
		get attachmentTitle() {
			return this._attachment.getField('title');
		}
		
		init() {
			this._attachmentButton = this.querySelector('.attachment-btn');
			this._annotationButton = this.querySelector('.annotation-btn');
			this._removeButton = this.querySelector('.zotero-clicky-minus');

			this._attachmentButton.addEventListener('click', this._handleAttachmentClick);
			this._attachmentButton.addEventListener('dragstart', this._handleAttachmentDragStart);
			this._annotationButton.addEventListener('click', this._handleAnnotationClick);

			if (this.editable) {
				this._removeButton.addEventListener('command', this._handleRemove);
			}

			this.render();
		}

		destroy() {
			this._attachmentButton.removeEventListener('click', this._handleAttachmentClick);
			this._attachmentButton.removeEventListener('dragstart', this._handleAttachmentDragStart);
			this._annotationButton.removeEventListener('click', this._handleAnnotationClick);
		}
		
		_handleAttachmentClick = (event) => {
			ZoteroPane.viewAttachment(this._attachment.id, event);
		};

		_handleAttachmentDragStart = (event) => {
			Zotero.Utilities.Internal.onDragItems(event, [this._attachment.id]);
		};

		_handleAnnotationClick = () => {
			// TODO: jump to annotations pane
			let pane;
			if (ZoteroContextPane) {
				pane = ZoteroContextPane.sidenav?.container.querySelector(`:scope > [data-pane="attachment-annotations"]`);
			}
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

		_handleRemove = async () => {
			const promptTitle = Zotero.getString('pane.items.trash.title');
			const promptMessage = await Zotero.ftl.formatValue('section-attachments-move-to-trash-message', { title: this._attachment.getField('title') });
			if (Services.prompt.confirm(window, promptTitle, promptMessage)) {
				await Zotero.Items.trashTx([this._attachment.id]);
			}
		};

		render() {
			if (!this.initialized) return;
			
			this._attachmentButton.querySelector(".icon").replaceWith(getCSSItemTypeIcon(this._attachment.getItemTypeIconName()));
			this._attachmentButton.setAttribute("aria-label", this._attachment.getField('title'));
			this._attachmentButton.querySelector(".label").textContent = this._attachment.getField('title');
			let annotationCount = this.attachment.isFileAttachment() ? this.attachment.getAnnotations().length : 0;
			this._annotationButton.setAttribute('data-l10n-args', JSON.stringify({ count: annotationCount }));
			this._annotationButton.hidden = annotationCount == 0;
			this._annotationButton.querySelector(".label").textContent = annotationCount;
			this._removeButton.hidden = !this.editable;
		}
	}

	customElements.define('attachment-row', AttachmentRow);
}
