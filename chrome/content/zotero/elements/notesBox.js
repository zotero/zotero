/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2021 Corporation for Digital Scholarship
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
	class NotesBox extends ItemPaneSectionElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-notes" data-pane="notes" extra-buttons="add">
				<html:div class="body"/>
			</collapsible-section>
		`);
		
		init() {
			this._item = null;
			this._noteIDs = [];
			this.initCollapsibleSection();
			this._section.addEventListener('add', this._handleAdd);
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'notesBox');
		}
		
		destroy() {
			this._section?.removeEventListener('add', this._handleAdd);
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}
		
		get item() {
			return this._item;
		}

		set item(val) {
			if (this.tabType !== "library") {
				this.hidden = true;
				return;
			}
			if (val?.isRegularItem() && !val?.isFeedItem) {
				this.hidden = false;
			}
			else {
				this.hidden = true;
				return;
			}
			this._item = val;
		}

		notify(event, type, ids, _extraData) {
			if (['modify', 'delete'].includes(event)
					&& ids.some(id => this._item?.id === id || this._noteIDs.includes(id))) {
				this._forceRenderAll();
			}
		}

		render() {
			if (!this._item) {
				return;
			}
			if (this._isAlreadyRendered()) return;

			this._noteIDs = this._item.getNotes();

			let body = this.querySelector('.body');
			body.replaceChildren();

			let notes = Zotero.Items.get(this._item.getNotes());
			for (let item of notes) {
				let id = item.id;

				let row = document.createElement('div');
				row.className = 'row';
				
				let icon = getCSSItemTypeIcon('note');

				let label = document.createElement("span");
				label.className = 'label';
				label.append(this._TODO_EXTRACT_noteToTitle(item.getNote(), {
					maxLength: 0
				}));

				let box = document.createElement('div');
				box.addEventListener('click', () => this._handleShowItem(id));
				box.className = 'box keyboard-clickable';
				box.setAttribute("tabindex", 0);
				box.setAttribute("aria-label", label.textContent);
				box.setAttribute("role", "button");
				box.append(icon, label);

				row.append(box);

				if (this.editable) {
					let remove = document.createXULElement("toolbarbutton");
					remove.addEventListener('command', () => this._handleRemove(id));
					remove.className = 'zotero-clicky zotero-clicky-minus';
					remove.setAttribute("tabindex", "0");
					remove.setAttribute("data-l10n-id", 'section-button-remove');
					row.append(remove);
				}

				body.append(row);
			}

			let count = this._noteIDs.length;
			this._section.setCount(count);
		}

		_handleAdd = (event) => {
			ZoteroPane_Local.newNote(event.shiftKey, this._item.key);
		};

		_handleRemove(id) {
			var ps = Services.prompt;
			if (ps.confirm(null, '', Zotero.getString('pane.item.notes.delete.confirm'))) {
				Zotero.Items.trashTx(id);
			}
		}

		_handleShowItem(id) {
			ZoteroPane_Local.selectItem(id);
		}

		_id(id) {
			return this.querySelector(`#${id}`);
		}

		/**
		 * TODO: Extract this back to utilities_item.js when merging
		 * Return first line (or first maxLength characters) of note content
		 *
		 * @param {String} text
		 * @param {Object} [options]
		 * @param {Boolean} [options.stopAtLineBreak] - Stop at <br/> instead of converting to space
		 * @param {Number} [options.maxLength] - Defaults to 120. If set to 0, no limit is applied.
		 * @return {String}
		 */
		_TODO_EXTRACT_noteToTitle(text, options = {}) {
			var maxLength = options.maxLength;
			if (maxLength === undefined) {
				maxLength = 120;
			}
			else if (maxLength === 0) {
				maxLength = Infinity;
			}
			
			var origText = text;
			text = text.trim();
			// Add line breaks after block elements
			text = text.replace(/(<\/(h\d|p|div)+>)/g, '$1\n');
			if (options.stopAtLineBreak) {
				text = text.replace(/<br\s*\/?>/g, '\n');
			}
			else {
				text = text.replace(/<br\s*\/?>/g, ' ');
			}
			text = Zotero.Utilities.unescapeHTML(text);

			// If first line is just an opening HTML tag, remove it
			//
			// Example:
			//
			// <blockquote>
			// <p>Foo</p>
			// </blockquote>
			if (/^<[^>\n]+[^\/]>\n/.test(origText)) {
				text = text.trim();
			}

			var t = text.substring(0, maxLength);
			var ln = t.indexOf("\n");
			if (ln > -1 && ln < maxLength) {
				t = t.substring(0, ln);
			}
			return t;
		}
	}
	customElements.define("notes-box", NotesBox);
}
