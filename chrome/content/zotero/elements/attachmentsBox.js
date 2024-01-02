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

{
	class AttachmentsBox extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-attachments" data-pane="attachments" show-add="true">
				<html:div class="body">
				</html:div>
			</collapsible-section>
			<popupset/>
		`);

		_item = null;
		
		_mode = null;
		
		_inTrash = false;
		
		get item() {
			return this._item;
		}

		set item(item) {
			if (this._item === item) {
				return;
			}
			
			this._item = item;
			this._body.replaceChildren();
			if (item) {
				for (let attachment of Zotero.Items.get(item.getAttachments(true))) {
					this.addRow(attachment);
				}
				this.updateCount();
			}
		}

		get mode() {
			return this._mode;
		}

		set mode(mode) {
			this._mode = mode;
		}
		
		get inTrash() {
			return this._inTrash;
		}
		
		set inTrash(inTrash) {
			this._inTrash = inTrash;
			for (let row of this._body.children) {
				this._updateRowAttributes(row, row.attachment);
			}
			this.updateCount();
		}

		init() {
			this._section = this.querySelector('collapsible-section');
			this._section.addEventListener('add', this._handleAdd);
			this._body = this.querySelector('.body');
			
			this._addPopup = document.getElementById('zotero-add-attachment-popup').cloneNode(true);
			this._addPopup.id = '';
			this.querySelector('popupset').append(this._addPopup);
			
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'attachmentsBox');
		}

		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		notify(action, type, ids) {
			if (!this._item) return;
			
			let itemAttachmentIDs = this._item.getAttachments(true);
			let attachments = Zotero.Items.get(ids.filter(id => itemAttachmentIDs.includes(id)));
			if (action == 'add') {
				for (let attachment of attachments) {
					this.addRow(attachment);
				}
			}
			else if (action == 'modify') {
				for (let attachment of attachments) {
					let row = this.querySelector(`attachment-row[attachment-id="${attachment.id}"]`);
					let open = false;
					if (row) {
						open = row.open;
						row.remove();
					}
					this.addRow(attachment).open = open;
				}
			}
			else if (action == 'delete') {
				for (let attachment of attachments) {
					let row = this.querySelector(`attachment-row[attachment-id="${attachment.id}"]`);
					if (row) {
						row.remove();
					}
				}
			}
			
			this.updateCount();
		}
		
		addRow(attachment) {
			let row = document.createXULElement('attachment-row');
			this._updateRowAttributes(row, attachment);
			
			let inserted = false;
			for (let existingRow of this._body.children) {
				if (Zotero.localeCompare(row.attachmentTitle, existingRow.attachmentTitle) < 0) {
					continue;
				}
				existingRow.before(row);
				inserted = true;
				break;
			}
			if (!inserted) {
				this._body.append(row);
			}
			return row;
		}
		
		updateCount() {
			let count = this._item.numAttachments(this._inTrash);
			this._section.setCount(count);
		}
		
		_handleAdd = (event) => {
			this._section.open = true;
			ZoteroPane.updateAddAttachmentMenu(this._addPopup);
			this._addPopup.openPopup(event.detail.button, 'after_end');
		};
		
		_updateRowAttributes(row, attachment) {
			let hidden = !this._inTrash && attachment.deleted;
			let context = this._inTrash && !this._item.deleted && !attachment.deleted;
			row.attachment = attachment;
			row.hidden = hidden;
			row.contextRow = context;
		}
	}
	customElements.define("attachments-box", AttachmentsBox);
}
