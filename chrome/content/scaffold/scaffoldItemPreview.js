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

"use strict";

{
	let { diff } = ChromeUtils.importESModule('chrome://zotero/content/xpcom/translate/testTranslators/diff.mjs');
	
	class ScaffoldItemPreview extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="diff" readonly="true"/>
			<info-box/>
			<abstract-box/>
			<html:div class="attachments-preview"/>
			<html:div class="notes-preview"/>
			<tags-box/>
		`);

		_preItem = null;
		
		_postItem = null;
		
		_cachedDiff = null;

		get itemPair() {
			return [this._preItem, this._postItem];
		}

		set itemPair([preItem, postItem]) {
			this._preItem = this._normalizeItem(preItem);
			if (!postItem) {
				// Default to cleaned version of preItem
				let zoteroPreItem = new Zotero.Item();
				zoteroPreItem.libraryID = Zotero.Libraries.userLibraryID;
				zoteroPreItem.fromJSON(this._preItem);

				postItem = Zotero.Utilities.Internal.itemToExportFormat(zoteroPreItem, {
					legacy: true,
					skipBaseFields: true
				});
				delete postItem.relations;
				delete postItem.collections;
				delete postItem.uniqueFields;
				delete postItem.uri;
				for (let [key, value] of Object.entries(postItem)) {
					if (value === null) {
						delete postItem[key];
					}
				}
				// Because we're just diffing the result of cleaning, differences
				// in these arrays are mostly meaningless
				postItem.attachments = structuredClone(preItem.attachments);
				postItem.notes = structuredClone(preItem.notes);
				postItem.tags = structuredClone(preItem.tags);
			}
			this._postItem = this._normalizeItem(postItem);
			this._cachedDiff = null;
			this.render();
		}
		
		get diff() {
			if (!this._cachedDiff) {
				if (!this._preItem || !this._postItem) {
					return null;
				}
				let diffString = diff(this._preItem, this._postItem)
					.split('\n')
					.filter(line => (
						// Remove lines without differences
						!/^\s*"\w+": (".*"|\d+|true|false)$/.test(line)
						// And accessDate diff lines - they just show a meaningless format change
						&& !/^\s*[-+]\s*"accessDate": "/.test(line)
					))
					.join('\n');
				// Remove now-empty object/array literals
				let emptyLiteralRe = /(\n|^)\s*("\w+": )?(\{\s*}|\[\s*])/g;
				while (emptyLiteralRe.test(diffString)) {
					diffString = diffString.replace(emptyLiteralRe, '');
				}
				this._cachedDiff = diffString;
			}
			return this._cachedDiff;
		}
		
		get diffStats() {
			let added = 0;
			let removed = 0;
			for (let diffLine of this.diff.split('\n')) {
				if (diffLine.startsWith('+')) {
					added++;
				}
				else if (diffLine.startsWith('-')) {
					removed++;
				}
			}
			return { added, removed };
		}

		init() {
			this.render();
		}

		render() {
			if (!this.initialized) return;

			let postItem = this._postItem;

			let zoteroPostItem = new Zotero.Item();
			zoteroPostItem.libraryID = Zotero.Libraries.userLibraryID;
			if (Object.entries(postItem).length) {
				zoteroPostItem.fromJSON(postItem);
			}

			let [diffBox, infoBox, abstractBox, attachmentsPreview, notesPreview, tagsBox] = this.children;
			for (let box of [infoBox, abstractBox, tagsBox]) {
				box.mode = 'view';
				box.editable = false;
				box.item = zoteroPostItem;
				box._forceRenderAll();
			}

			attachmentsPreview.replaceChildren(
				...(postItem.attachments ?? []).map((jsonAttachment) => {
					let zoteroAttachment = new Zotero.Item('attachment');
					
					let displayTitle = jsonAttachment.title;
					let urlOrPath = jsonAttachment.url || jsonAttachment.path;
					if (urlOrPath) {
						displayTitle += ` (${urlOrPath})`;
					}
					zoteroAttachment.setField('title', displayTitle);
					zoteroAttachment.attachmentContentType = jsonAttachment.mimeType;
					if (jsonAttachment.snapshot === false && jsonAttachment.mimeType === 'text/html') {
						zoteroAttachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_LINKED_URL;
					}
					else {
						zoteroAttachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_URL;
					}
					let row = document.createXULElement('attachment-row');
					row.attachment = zoteroAttachment;
					row._handleAttachmentClick = () => {};
					return row;
				})
			);
			notesPreview.replaceChildren(
				...(postItem.notes ?? []).map((jsonNote) => {
					let row = document.createXULElement('note-row');
					row.note = {
						title: '',
						body: Zotero.Utilities.cleanTags(jsonNote.note),
					};
					return row;
				})
			);

			for (let diffLine of this.diff.split('\n')) {
				let lineContainer = document.createElement('div');
				lineContainer.textContent = diffLine;
				if (diffLine.startsWith('+')) {
					lineContainer.classList.add('added');
				}
				else if (diffLine.startsWith('-')) {
					lineContainer.classList.add('removed');
				}
				diffBox.append(lineContainer);
			}
		}
		
		_normalizeItem(jsonItem) {
			jsonItem = JSON.parse(JSON.stringify(jsonItem));
			
			if (!Object.entries(jsonItem).length) {
				return jsonItem;
			}
			
			// Delete ID (meaningless)
			delete jsonItem.id;

			// _itemDone() sets 'title' in addition to the item type's mapped
			// title field for some reason. Delete it so it doesn't show up in the diff.
			let titleField = Zotero.ItemFields.getName(
				Zotero.ItemFields.getFieldIDFromTypeAndBase(jsonItem.itemType, 'title')
			);
			if (titleField !== 'title' && jsonItem[titleField]) {
				delete jsonItem.title;
			}

			if (jsonItem.accessDate === 'CURRENT_TIMESTAMP') {
				jsonItem.accessDate = Zotero.Date.dateToISO(new Date());
			}
			
			return jsonItem;
		}
	}

	customElements.define('scaffold-item-preview', ScaffoldItemPreview);
}
