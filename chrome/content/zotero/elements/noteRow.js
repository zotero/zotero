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
	class NoteRow extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="head">
				<html:span class="icon"/>
				<html:div class="parent-title"/>
			</html:div>
			<html:div class="body">
				<html:div class="note-title"/>
				<html:div class="note-content-container">
					<html:div class="note-content"/>
					<html:span class="note-date"/>
				</html:div>
			</html:div>
		`);

		_note = null;

		get note() {
			return this._note;
		}

		set note(val) {
			this._note = val;
			this.render();
		}

		init() {
			this._parentTitle = this.querySelector('.parent-title');
			this._noteTitle = this.querySelector('.note-title');
			this._noteContent = this.querySelector('.note-content');
			this._noteDate = this.querySelector('.note-date');
			this.tabIndex = 0;
			this.classList.add("keyboard-clickable");
			this.render();
		}

		render() {
			if (!this.initialized) return;
			
			let note = this._note;
			if (!note) return;
			
			if (note.parentItemType) {
				this.querySelector('.icon').replaceWith(getCSSItemTypeIcon(note.parentItemType));
				this._parentTitle.textContent = note.parentTitle;
				this._noteTitle.hidden = false;
				this._noteTitle.textContent = note.title;
				this.setAttribute("aria-description", note.title);
			}
			else {
				this.querySelector('.icon').replaceWith(getCSSItemTypeIcon('note'));
				this._parentTitle.textContent = note.title;
				this._noteTitle.hidden = true;
				this._noteTitle.textContent = '';
				this.setAttribute("aria-description", note.body);
			}
			this.setAttribute("aria-label", this._parentTitle.textContent);
			this._noteContent.textContent = note.body;
			this._noteContent.hidden = !note.body;
			this._noteDate.textContent = note.date;
		}
	}

	customElements.define('note-row', NoteRow);
}
