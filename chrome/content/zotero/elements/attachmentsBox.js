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
			<collapsible-section data-l10n-id="section-attachments" data-pane="attachments" extra-buttons="add">
				<html:div class="body">
					<attachment-preview tabindex="0"/>
					<html:div class="attachments-container"></html:div>
				</html:div>
			</collapsible-section>
			<popupset/>
		`);

		_item = null;
		
		_attachmentIDs = [];

		_mode = null;
		
		_inTrash = false;

		_preview = null;

		get item() {
			return this._item;
		}

		set item(item) {
			let isRegularItem = item?.isRegularItem();
			this.hidden = !isRegularItem;
			if (!isRegularItem || this._item === item) {
				return;
			}
			
			this._item = item;
			this.refresh();
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
			if (this._inTrash === inTrash) {
				return;
			}
			this._inTrash = inTrash;
			if (!this._item?.isRegularItem()) {
				return;
			}
			for (let row of Array.from(this._attachments.querySelectorAll("attachment-row"))) {
				this._updateRowAttributes(row, row.attachment);
			}
			this.updateCount();
		}

		get usePreview() {
			return this.hasAttribute('data-use-preview');
		}

		set usePreview(val) {
			this.toggleAttribute('data-use-preview', val);
			this.updatePreview();
		}

		init() {
			this._section = this.querySelector('collapsible-section');
			this._section.addEventListener('add', this._handleAdd);
			// this._section.addEventListener('togglePreview', this._handleTogglePreview);

			this._attachments = this.querySelector('.attachments-container');
			
			this._addPopup = document.getElementById('zotero-add-attachment-popup').cloneNode(true);
			this._addPopup.id = '';
			this.querySelector('popupset').append(this._addPopup);
			
			this._preview = this.querySelector('attachment-preview');

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'attachmentsBox');

			this._section.addEventListener("toggle", (ev) => {
				if (ev.target.open) {
					this._preview.render();
				}
			});

			this._section._contextMenu.addEventListener('popupshowing', this._handleContextMenu, { once: true });
		}

		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		notify(action, type, ids) {
			if (!this._item?.isRegularItem()) return;

			this.updatePreview();

			this._updateAttachmentIDs().then(() => {
				let attachments = Zotero.Items.get((this._attachmentIDs).filter(id => ids.includes(id)));
				if (attachments.length === 0) {
					return;
				}
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
			});
		}
		
		addRow(attachment, open = false) {
			let row = document.createXULElement('attachment-row');
			this._updateRowAttributes(row, attachment);
			// Set open state before adding to dom to prevent animation
			row.toggleAttribute("open", open);
			
			let index = this._attachmentIDs.indexOf(attachment.id);
			if (index < 0 || index >= this._attachments.children.length) {
				this._attachments.append(row);
			}
			else {
				this._attachments.insertBefore(row, this._attachments.children[index]);
			}
			return row;
		}

		async refresh() {
			if (!this._item) return;
			
			this.usePreview = Zotero.Prefs.get('showAttachmentPreview');

			await this._updateAttachmentIDs();

			let itemAttachments = Zotero.Items.get(this._attachmentIDs);

			this._attachments.querySelectorAll("attachment-row").forEach(e => e.remove());
			for (let attachment of itemAttachments) {
				this.addRow(attachment);
			}
			this.updateCount();
		}
		
		updateCount() {
			let count = this._item.numAttachments(this._inTrash);
			this._section.setCount(count);
		}

		async updatePreview() {
			if (!this.usePreview) {
				return;
			}
			let attachment = await this._item.getBestAttachment();
			if (!this._preview.hasPreview) {
				this._preview.setItemAndRender(attachment);
				return;
			}
			this._preview.item = attachment;
		}

		_handleAdd = (event) => {
			this._section.open = true;
			ZoteroPane.updateAddAttachmentMenu(this._addPopup);
			this._addPopup.openPopup(event.detail.button, 'after_end');
		};

		_handleTogglePreview = () => {
			let toOpen = !Zotero.Prefs.get('showAttachmentPreview');
			Zotero.Prefs.set('showAttachmentPreview', toOpen);
			this.usePreview = toOpen;
			let menu = this._section._contextMenu.querySelector('.zotero-menuitem-toggle-preview');
			menu.dataset.l10nArgs = `{ "type": "${this.usePreview ? "open" : "collapsed"}" }`;
			
			if (toOpen) {
				this._preview.render();
			}
		};

		_handleContextMenu = () => {
			let contextMenu = this._section._contextMenu;
			let menu = document.createXULElement("menuitem");
			menu.classList.add('menuitem-iconic', 'zotero-menuitem-toggle-preview');
			menu.setAttribute('data-l10n-id', 'toggle-preview');
			menu.addEventListener('command', this._handleTogglePreview);
			menu.dataset.l10nArgs = `{ "type": "${this.usePreview ? "open" : "collapsed"}" }`;
			contextMenu.append(menu);
		};
		
		_updateRowAttributes(row, attachment) {
			let hidden = !this._inTrash && attachment.deleted;
			let context = this._inTrash && !this._item.deleted && !attachment.deleted;
			row.attachment = attachment;
			row.hidden = hidden;
			row.contextRow = context;
		}

		async _updateAttachmentIDs() {
			let sortedAttachmentIDs = [];
			let allAttachmentIDs = this._item.getAttachments(true);
			let bestAttachment = await this._item.getBestAttachment();
			if (bestAttachment) {
				sortedAttachmentIDs.push(
					bestAttachment.id,
					...allAttachmentIDs.filter(id => id && id !== bestAttachment.id)
				);
			}
			else {
				sortedAttachmentIDs = allAttachmentIDs;
			}
			this._attachmentIDs = sortedAttachmentIDs;
		}
	}
	customElements.define("attachments-box", AttachmentsBox);
}
