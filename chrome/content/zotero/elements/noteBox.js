/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2022 Corporation for Digital Scholarship
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


{
	let { countWords } = ChromeUtils.importESModule("resource://zotero/allfaz.mjs").default;

	class NoteBox extends ItemPaneSectionElementBase {
		content = MozXULElement.parseXULToFragment(`
			<collapsible-section data-l10n-id="section-note-info" data-pane="note-info">
				<html:div class="body">
					<html:div class="metadata-table">
						<html:div id="dateCreatedRow" class="meta-row">
							<html:div class="meta-label"><html:label id="dateCreated-label" class="key" data-l10n-id="note-info-date-created"/></html:div>
							<html:div class="meta-data"><editable-text id="dateCreated" aria-labelledby="dateCreated-label" nowrap="true" tight="true" readonly="true"/></html:div>
						</html:div>
						<html:div id="dateModifiedRow" class="meta-row">
							<html:div class="meta-label"><html:label id="dateModified-label" class="key" data-l10n-id="note-info-date-modified"/></html:div>
							<html:div class="meta-data"><editable-text id="dateModified" aria-labelledby="dateModified-label" nowrap="true" tight="true" readonly="true"/></html:div>
						</html:div>
						<html:div id="wordCountRow" class="meta-row">
							<html:div class="meta-label"><html:label id="wordCount-label" class="key" data-l10n-id="note-info-word-count"/></html:div>
							<html:div class="meta-data"><editable-text id="wordCount" aria-labelledby="wordCount-label" nowrap="true" tight="true" readonly="true"/></html:div>
						</html:div>
					</html:div>
				</html:div>
			</collapsible-section>
		`);

		constructor() {
			super();

			this._item = null;
			this._section = null;
		}

		get item() {
			return this._item;
		}

		set item(val) {
			if (!(val instanceof Zotero.Item)) {
				throw new Error("'item' must be a Zotero.Item");
			}
			
			if (val.isNote()) {
				this._item = val;
				this.hidden = false;
			}
			else {
				this.hidden = true;
			}
		}

		init() {
			this.initCollapsibleSection();
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'noteBox');

			for (let label of this.querySelectorAll(".meta-label")) {
				// Prevent default focus/blur behavior - we implement our own below
				label.addEventListener("mousedown", this._handleMetaLabelMousedown);
				label.addEventListener("click", this._handleMetaLabelClick);
			}
		}

		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);

			for (let label of this.querySelectorAll(".meta-label")) {
				label.removeEventListener("mousedown", this._handleMetaLabelMousedown);
				label.removeEventListener("click", this._handleMetaLabelClick);
			}
		}

		notify(event, _type, ids, _extraData) {
			if (event != 'modify' || !this.item?.id || !ids.includes(this.item.id)) return;
			
			this._forceRenderAll();
		}

		render() {
			if (!this.item) return;
			if (!this._section.open) return;
			if (this._isAlreadyRendered("sync")) return;

			this.updateInfo();
		}

		updateInfo() {
			if (!this._item || !this._item.isNote()) return;

			let dateCreatedField = this._id('dateCreated');
			let dateModifiedField = this._id('dateModified');
			let wordCountField = this._id('wordCount');

			// Date created
			let dateAdded = this._item.getField('dateAdded');
			if (dateAdded) {
				let date = Zotero.Date.sqlToDate(dateAdded, true);
				dateCreatedField.value = date.toLocaleString();
			}

			// Date modified
			let dateModified = this._item.getField('dateModified');
			if (dateModified) {
				let date = Zotero.Date.sqlToDate(dateModified, true);
				dateModifiedField.value = date.toLocaleString();
			}

			// Note size and counts
			let noteContent = this._item.getNote();
			let wordCount = this._calculateWordCounts(noteContent);

			wordCountField.value = wordCount.toLocaleString();
		}

		_calculateWordCounts(noteContent) {
			if (!noteContent) {
				return {
					wordCount: 0,
				};
			}

			const parser = new DOMParser();
			const doc = parser.parseFromString(noteContent, "text/html");
			const text = doc.body.textContent || "";
			return countWords(text);
		}

		_handleMetaLabelClick = (event) => {
			event.preventDefault();
			
			let labelWrapper = event.target.closest(".meta-label");
			if (labelWrapper.nextSibling.contains(document.activeElement)) {
				ZoteroPane.itemsView.focus();
			}
			else if (!labelWrapper.nextSibling.firstChild.readOnly) {
				labelWrapper.nextSibling.firstChild.focus();
			}
		};

		_handleMetaLabelMousedown = (event) => {
			event.preventDefault();
		};

		_id(id) {
			return this.querySelector(`#${id}`);
		}
	}

	customElements.define("note-box", NoteBox);
}
