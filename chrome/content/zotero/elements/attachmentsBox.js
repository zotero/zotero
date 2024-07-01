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
	class AttachmentsBox extends ItemPaneSectionElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-attachments" data-pane="attachments" extra-buttons="add">
				<html:div class="body">
					<attachment-preview tabindex="0" data-l10n-id="attachment-preview"/>
					<html:div class="attachments-container"></html:div>
				</html:div>
			</collapsible-section>
			<popupset>
				<menupopup class="add-popup">
					<menuitem data-l10n-id="item-menu-add-file" />
					<menuitem data-l10n-id="item-menu-add-linked-file" />
					<menuitem data-l10n-id="item-menu-add-url" />
				</menupopup>
			</popupset>
		`);

		_attachmentIDs = [];

		_preview = null;

		get item() {
			return this._item;
		}

		set item(item) {
			if (this._item === item) {
				return;
			}
			
			super.item = item;
			let hidden = !item?.isRegularItem() || item?.isFeedItem;
			this.hidden = hidden;
			this._preview.disableResize = !!hidden;
		}

		get inTrash() {
			if (this.tabType != "library") {
				return false;
			}
			return ZoteroPane.collectionsView.selectedTreeRow
				&& ZoteroPane.collectionsView.selectedTreeRow.isTrash();
		}

		get usePreview() {
			return this.hasAttribute('data-use-preview');
		}

		set usePreview(val) {
			this.toggleAttribute('data-use-preview', val);
			if (this.item) {
				this.updatePreview();
			}
		}

		init() {
			this.initCollapsibleSection();
			this._section.addEventListener('add', this._handleAdd);

			this._attachments = this.querySelector('.attachments-container');
			
			this._addPopup = this.querySelector('.add-popup');
			
			let [addFile, addLink, addWebLink] = this._addPopup.children;
			this._addPopup.addEventListener('popupshowing', () => {
				let canAddAny = this.item?.isRegularItem() && this.item.library.editable;
				addFile.disabled = addLink.disabled = !(canAddAny && this.item.library.filesEditable);
				addWebLink.disabled = !canAddAny;
			});
			addFile.addEventListener('command', () => {
				ZoteroPane.addAttachmentFromDialog(false, this.item.id);
			});
			addLink.addEventListener('command', () => {
				ZoteroPane.addAttachmentFromDialog(true, this.item.id);
			});
			addWebLink.addEventListener('command', () => {
				ZoteroPane.addAttachmentFromURI(true, this.item.id);
			});
			
			this.usePreview = Zotero.Prefs.get('showAttachmentPreview');
			this._preview = this.querySelector('attachment-preview');

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'attachmentsBox');

			this._section._contextMenu.addEventListener('popupshowing', this._handleContextMenu, { once: true });

			// For tests
			this._asyncRendering = false;
			// Indicate if the preview should update, can be none | initial | final
			this._renderStage = "none";
		}

		destroy() {
			this._section?.removeEventListener('add', this._handleAdd);
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		notify(action, type, ids) {
			if (!(action === 'add' || action === 'modify' || action === 'refresh' || action === 'delete')) {
				return;
			}
			if (!this._item?.isRegularItem()) return;

			this._updateAttachmentIDs().then(() => {
				this.updatePreview();

				for (let id of ids) {
					this.querySelector(`attachment-row[attachment-id="${id}"]`)
						?.remove();
				}
				if (action !== 'delete') {
					let attachments = Zotero.Items.get(this._attachmentIDs.filter(id => ids.includes(id)));
					for (let attachment of attachments) {
						this.addRow(attachment);
					}
				}
				this.updateCount();
			});
		}
		
		addRow(attachment) {
			let row = document.createXULElement('attachment-row');
			this._updateRowAttributes(row, attachment);
			
			let index = this._attachmentIDs.indexOf(attachment.id);
			if (index < 0 || index >= this._attachments.children.length) {
				this._attachments.append(row);
			}
			else {
				this._attachments.insertBefore(row, this._attachments.children[index]);
			}
			return row;
		}

		render() {
			if (!this._item) return;
			if (this._isAlreadyRendered()) return;
			this._renderStage = "initial";
			this.updateCount();
		}

		async asyncRender() {
			if (!this._item) return;
			if (this._isAlreadyRendered("async")) return;
			this._renderStage = "final";
			this._asyncRendering = true;
			
			await this._updateAttachmentIDs();

			let itemAttachments = Zotero.Items.get(this._attachmentIDs);

			this._attachments.querySelectorAll("attachment-row").forEach(e => e.remove());
			for (let attachment of itemAttachments) {
				this.addRow(attachment);
			}
			await this.updatePreview();
			this._asyncRendering = false;
		}
		
		updateCount() {
			if (!this._item?.isRegularItem()) {
				return;
			}
			let count = this._item.numAttachments(this.inTrash);
			this._section.setCount(count);
		}

		async updatePreview() {
			// Skip if asyncRender is not finished/executed, which means the box is invisible
			// The box will be rendered when it becomes visible
			if (!this.initialized || this._renderStage !== "final") {
				return;
			}
			let attachment = await this._getPreviewAttachment();
			this.toggleAttribute('data-use-preview', !!attachment && Zotero.Prefs.get('showAttachmentPreview'));
			if (!attachment) {
				return;
			}
			if (!this.usePreview
				// Skip only when the section is manually collapsed (when there's attachment),
				// This is necessary to ensure the rendering of the first added attachment
				// because the section is force-collapsed if no attachment.
				|| (this._attachmentIDs.length && !this._section.open)) {
				return;
			}
			this._preview.item = attachment;
			await this._preview.render();
		}

		async _getPreviewAttachment() {
			let attachment = await this._item.getBestAttachment();
			if (this.tabType === "reader"
				&& Zotero_Tabs._getTab(this.tabID)?.tab?.data?.itemID == attachment.id) {
				// In the reader, only show the preview when viewing a secondary attachment
				return null;
			}
			return attachment;
		}

		_handleAdd = (event) => {
			this._section.open = true;
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

		_handleContextMenu = async () => {
			if (!await this._getPreviewAttachment()) return;
			let contextMenu = this._section._contextMenu;
			let menu = document.createXULElement("menuitem");
			menu.classList.add('menuitem-iconic', 'zotero-menuitem-toggle-preview');
			menu.setAttribute('data-l10n-id', 'toggle-preview');
			menu.addEventListener('command', this._handleTogglePreview);
			menu.dataset.l10nArgs = `{ "type": "${this.usePreview ? "open" : "collapsed"}" }`;
			contextMenu.append(menu);
		};
		
		_updateRowAttributes(row, attachment) {
			let hidden = !this.inTrash && attachment.deleted;
			row.attachment = attachment;
			row.hidden = hidden;
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
