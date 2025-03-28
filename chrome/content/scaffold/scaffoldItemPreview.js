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
	class ScaffoldItemPreview extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="diff" readonly="true"/>
			<info-box/>
			<abstract-box/>
			<html:div class="attachments-preview"/>
			<html:div class="notes-preview"/>
		`);

		_jsonItem = null;

		get jsonItem() {
			return this._jsonItem;
		}

		set jsonItem(jsonItem) {
			// Don't pass this any objects you really care about
			delete jsonItem.id;
			if (jsonItem.accessDate === 'CURRENT_TIMESTAMP') {
				jsonItem.accessDate = Zotero.Date.dateToISO(new Date());
			}
			for (let attachment of jsonItem.attachments) {
				if (attachment.document) {
					attachment.mimeType = 'text/html';
					attachment.url = attachment.document.location?.href;
					delete attachment.document;
				}
				delete attachment.complete;
			}
			
			this._jsonItem = jsonItem;
			this.render();
		}

		init() {
			this.render();
		}

		render() {
			if (!this.initialized) return;

			let zoteroItem = new Zotero.Item();
			zoteroItem.fromJSON(this._jsonItem);

			let [diffBox, infoBox, abstractBox, attachmentsPreview, notesPreview] = this.children;
			for (let box of [infoBox, abstractBox]) {
				box.mode = 'view';
				box.editable = false;
				box.item = zoteroItem;
				box._forceRenderAll();
			}

			attachmentsPreview.replaceChildren(
				...this._jsonItem.attachments.map((jsonAttachment) => {
					let zoteroAttachment = new Zotero.Item('attachment');
					zoteroAttachment.setField('title', `${jsonAttachment.title} (${jsonAttachment.url || jsonAttachment.path})`);
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
				...this._jsonItem.notes.map((jsonNote) => {
					let row = document.createXULElement('note-row');
					row.note = {
						title: '',
						body: Zotero.Utilities.cleanTags(jsonNote.note),
					};
					return row;
				})
			);

			let preCleaning = JSON.parse(JSON.stringify(this._jsonItem));
			let postCleaning = Zotero.Utilities.Internal.itemToExportFormat(zoteroItem, {
				legacy: true,
				skipBaseFields: true
			});
			delete postCleaning.relations;
			delete postCleaning.collections;
			delete postCleaning.uniqueFields;
			for (let [key, value] of Object.entries(postCleaning)) {
				if (value === null) {
					delete postCleaning[key];
				}
			}
			// Differences in these arrays are mostly meaningless
			postCleaning.attachments = preCleaning.attachments;
			postCleaning.notes = preCleaning.notes;
			postCleaning.tags = preCleaning.tags;
			let diff = Zotero_TranslatorTester._generateDiff(preCleaning, postCleaning)
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
			while (emptyLiteralRe.test(diff)) {
				diff = diff.replace(emptyLiteralRe, '');
			}
			for (let diffLine of diff.split('\n')) {
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
	}

	customElements.define('scaffold-item-preview', ScaffoldItemPreview);
}
