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

		_body = null;

		_preview = null;

		_lastPreviewRenderId = "";

		_discardPreviewTimeout = 60000;

		_previewDiscarded = false;

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
			if (this._preview) this._preview.disableResize = !!hidden;
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

		get previewElem() {
			if (!this._preview) {
				this._initPreview();
			}
			return this._preview;
		}

		get _renderDependencies() {
			if (this.item?.isRegularItem()) {
				// Render dependencies are used to determine if a re-render is necessary.
				// By including the list of attachment IDs as string, we ensure that it
				// will re-render if attachments are added or removed.
				return [...super._renderDependencies, this.item.getAttachments().join(',')];
			}
			return super._renderDependencies;
		}

		init() {
			this.initCollapsibleSection();
			this._section.addEventListener('add', this._handleAdd);

			this._body = this.querySelector('.body');

			this._attachments = this.querySelector('.attachments-container');
			
			this._addPopup = this.querySelector('.add-popup');
			
			let [addFile, addLink, addWebLink] = this._addPopup.children;
			this._addPopup.addEventListener('popupshowing', this._handleAddPopupShowing);
			addFile.addEventListener('command', this._handleAddFile);
			addLink.addEventListener('command', this._handleAddLink);
			addWebLink.addEventListener('command', this._handleAddWebLink);
			
			this.usePreview = Zotero.Prefs.get('showAttachmentPreview');

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'attachmentsBox');

			this._section._contextMenu.addEventListener('popupshowing', this._handleContextMenu, { once: true });

			// For tests
			this._asyncRendering = false;
			// Indicate if the preview should update, can be none | initial | final
			this._renderStage = "none";
		}

		destroy() {
			this.discard();
			this._preview?.remove();
			delete this._preview;

			Zotero.Notifier.unregisterObserver(this._notifierID);

			this._section?.removeEventListener('add', this._handleAdd);
			if (this._addPopup) {
				this._addPopup.removeEventListener('popupshowing', this._handleAddPopupShowing);
				let [addFile, addLink, addWebLink] = this._addPopup.children;
				addFile?.removeEventListener('command', this._handleAddFile);
				addLink?.removeEventListener('command', this._handleAddLink);
				addWebLink?.removeEventListener('command', this._handleAddWebLink);
			}
			
			this._section?._contextMenu?.removeEventListener('popupshowing', this._handleContextMenu);
		}

		notify(action, type, ids) {
			if (!['add', 'modify', 'refresh', 'delete', 'trash'].includes(action)) {
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
			// Reset the async render dependencies to allow re-rendering
			delete this._asyncRenderDependencies;
		}

		async asyncRender() {
			if (!this._item) return;
			if (this._isAlreadyRendered("async")) {
				if (this._previewDiscarded) {
					this._previewDiscarded = false;
					this.previewElem.render();
				}
				this._lastPreviewRenderId = `${Date.now()}-${Math.random()}`;
				return;
			}
			this._renderStage = "final";
			this._asyncRendering = true;
			
			// Execute sub-tasks concurrently to avoid race condition between different calls
			await Promise.all([
				this.updateRows(),
				this.updatePreview(),
			]);

			this._asyncRendering = false;
		}

		discard() {
			if (!this._preview) return;
			let lastPreviewRenderId = this._lastPreviewRenderId;
			setTimeout(() => {
				if (!this._asyncRendering && this._lastPreviewRenderId === lastPreviewRenderId) {
					this._preview?.discard();
					this._previewDiscarded = true;
				}
			}, this._discardPreviewTimeout);
		}
		
		updateCount() {
			if (!this._item?.isRegularItem()) {
				return;
			}
			let count = this._item.numAttachments(this.inTrash);
			this._section.setCount(count);
		}

		async updateRows() {
			await this._updateAttachmentIDs();

			let itemAttachments = Zotero.Items.get(this._attachmentIDs);

			this._attachments.querySelectorAll("attachment-row").forEach(e => e.remove());
			for (let attachment of itemAttachments) {
				this.addRow(attachment);
			}
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
			this.previewElem.item = attachment;
			await this.previewElem.render();
			this._lastPreviewRenderId = `${Date.now()}-${Math.random()}`;
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

		_initPreview() {
			this._preview = document.createXULElement('attachment-preview');
			this._preview.setAttribute('tabindex', '0');
			this._preview.setAttribute('data-l10n-id', 'attachment-preview');
			this._body.prepend(this._preview);
			this._preview.disableResize = !!this.hidden;
		}

		_handleAdd = (event) => {
			this._section.open = true;
			this._addPopup.openPopup(event.detail.button, 'after_end');
		};

		_handleAddPopupShowing = () => {
			let canAddAny = this.item?.isRegularItem() && this.item.library.editable;
				addFile.disabled = addLink.disabled = !(canAddAny && this.item.library.filesEditable);
				addWebLink.disabled = !canAddAny;
		};

		_handleAddFile = () => {
			ZoteroPane.addAttachmentFromDialog(false, this.item.id);
		};

		_handleAddLink = () => {
			ZoteroPane.addAttachmentFromDialog(true, this.item.id);
		};

		_handleAddWebLink = () => {
			ZoteroPane.addAttachmentFromURI(true, this.item.id);
		};

		_handleTogglePreview = () => {
			let toOpen = !Zotero.Prefs.get('showAttachmentPreview');
			Zotero.Prefs.set('showAttachmentPreview', toOpen);
			this.usePreview = toOpen;
			let menu = this._section._contextMenu.querySelector('.zotero-menuitem-toggle-preview');
			menu.dataset.l10nArgs = `{ "type": "${this.usePreview ? "open" : "collapsed"}" }`;
			
			if (toOpen) {
				this.previewElem.render();
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
