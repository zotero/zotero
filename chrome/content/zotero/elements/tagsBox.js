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

"use strict";

{
	class TagsBox extends ItemPaneSectionElementBase {
		content = MozXULElement.parseXULToFragment(`
				<collapsible-section data-l10n-id="section-tags" data-pane="tags" extra-buttons="add">
					<html:div class="body">
						<html:div id="rows" class="tags-box-list"/>
						<popupset>
							<tooltip id="html-tooltip" page="true"/>
							<menupopup id="tags-context-menu">
								<menuitem id="remove-all-item-tags" label="&zotero.item.tags.removeAll;"/>
							</menupopup>
						</popupset>
					</html:div>
				</collapsible-section>
			`, ['chrome://zotero/locale/zotero.dtd']);

		init() {
			this.count = 0;
			this.clickHandler = null;

			this._tabDirection = null;
			this._tagColors = [];
			this._notifierID = null;
			this._item = null;

			this.initCollapsibleSection();
			this._section.addEventListener('add', this._handleAddButtonClick);
			this.addEventListener('click', (event) => {
				if (event.target === this) {
					this.blurOpenField();
				}
			});

			let removeAllItemTags = this._id('remove-all-item-tags');
			this._id('remove-all-item-tags').addEventListener('command', this.removeAll);
			this.querySelector('.body').addEventListener('contextmenu', (event) => {
				removeAllItemTags.disabled = !this.count;
				this._id('tags-context-menu').openPopupAtScreen(event.screenX, event.screenY, true);
			});
			// Register our observer with priority 101 (after Zotero.Tags) so we get updated tag colors
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item-tag', 'setting'], 'tagsBox', 101);
		}

		destroy() {
			this._section?.removeEventListener('add', this._handleAddButtonClick);
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		get item() {
			return this._item;
		}

		set item(val) {
			this.hidden = val?.isFeedItem;
			// Don't reload if item hasn't changed
			if (this._item == val) {
				return;
			}
			this._item = val;
		}

		notify(event, type, ids, extraData) {
			if (type == 'setting' && ids.some(val => val.split("/")[1] == 'tagColors') && this.item) {
				this._forceRenderAll();
			}
			else if (type == 'item-tag') {
				let itemID, _tagID;

				for (let i = 0; i < ids.length; i++) {
					[itemID, _tagID] = ids[i].split('-').map(x => parseInt(x));
					if (!this.item || itemID != this.item.id) {
						continue;
					}
					let data = extraData[ids[i]];
					let tagName = data.tag;
					let tagType = data.type;

					if (event == 'add') {
						this.add(tagName, tagType);
					}
					else if (event == 'modify') {
						let oldTagName = data.old.tag;
						this.remove(oldTagName);
						this.add(tagName, tagType);
					}
					else if (event == 'remove') {
						this.remove(tagName);
					}
				}

				this.updateCount();
			}
			else if (type == 'tag' && event == 'modify') {
				this._forceRenderAll();
			}
		}

		render() {
			if (!this.item) return;
			if (this._isAlreadyRendered()) return;

			Zotero.debug('Reloading tags box');

			// Cancel field focusing while we're updating
			this._reloading = true;

			this._tagColors = Zotero.Tags.getColors(this.item.libraryID);
			
			let focusedTag = this._id('rows').querySelector('editable-text:focus')?.value;

			let tagRows = this._id('rows');
			tagRows.replaceChildren();

			var tags = this.item.getTags();


			// Sort tags alphabetically with colored tags at the top followed by emoji tags
			tags.sort((a, b) => Zotero.Tags.compareTagsOrder(this.item.libraryID, a.tag, b.tag));
			

			for (let i = 0; i < tags.length; i++) {
				this.addDynamicRow(tags[i], i + 1);
			}
			this.updateCount(tags.length);

			this._reloading = false;
			
			if (focusedTag) {
				this._id('rows').querySelector(`[value="${CSS.escape(focusedTag)}"]`)?.focus();
			}
		}

		addDynamicRow(tagData, tabindex, skipAppend) {
			var isNew = !tagData;
			var name = tagData ? tagData.tag : "";

			if (!tabindex) {
				tabindex = this._id('rows').childNodes.length + 1;
			}

			var icon = document.createElement("div");
			icon.className = "zotero-box-icon";

			// DEBUG: Why won't just this.nextSibling.blur() work?
			icon.addEventListener('click', (event) => {
				event.target.nextSibling.blur();
			});

			var label = this.createValueElement(name, tabindex);

			if (this.editable) {
				var remove = document.createXULElement("toolbarbutton");
				remove.setAttribute('class', 'zotero-clicky zotero-clicky-minus');
				remove.setAttribute('tabindex', 0);
				remove.setAttribute("data-l10n-id", 'section-button-remove');
			}

			var row = document.createElement("div");
			row.classList.add('row');
			if (name && this._tagColors.has(name)) {
				row.classList.add('has-color');
				row.style.setProperty('--tag-color', this._tagColors.get(name).color);
			}
			if (isNew) {
				row.setAttribute('isNew', true);
			}
			row.appendChild(icon);
			row.appendChild(label);
			if (this.editable) {
				row.appendChild(remove);
			}

			this.updateRow(row, tagData);

			if (!skipAppend) {
				this._id('rows').appendChild(row);
			}

			return row;
		}


		// Update various attributes of a row to match the given tag
		// and current editability
		updateRow(row, tagData) {
			var tagName = tagData ? tagData.tag : "";
			var tagType = (tagData && tagData.type) ? tagData.type : 0;

			if (this.editable) {
				var remove = row.lastChild;
			}

			// Row
			row.setAttribute('tagName', tagName);
			row.setAttribute('tagType', tagType);

			// Icon
			let icon = row.firstChild;
			icon.title = tagType == 0
				? Zotero.getString('pane.item.tags.icon.user')
				: Zotero.getString('pane.item.tags.icon.automatic');

			// "-" button
			if (this.editable) {
				remove.setAttribute('disabled', false);
				remove.addEventListener('click', async (_event) => {
					if (tagData) {
						let item = this.item;
						this.remove(tagName);
						try {
							item.removeTag(tagName);
							await item.saveTx();
						}
						catch (e) {
							this._forceRenderAll();
							throw e;
						}
					}
					// Remove empty textbox row
					else {
						row.parentNode.removeChild(row);
					}

					// TODO: Return focus to items pane
					var tree = document.getElementById('zotero-items-tree');
					if (tree) {
						tree.focus();
					}
				});
			}
		}


		createValueElement(valueText) {
			var valueElement = document.createXULElement("editable-text");
			valueElement.setAttribute('fieldname', 'tag');
			valueElement.setAttribute('flex', 1);
			valueElement.setAttribute('nowrap', true);
			valueElement.setAttribute('tight', true);
			document.l10n.setAttributes(valueElement, "tag-field");
			valueElement.className = 'zotero-box-label';
			valueElement.readOnly = !this.editable;
			valueElement.value = valueText;
			let params = {
				fieldName: 'tag',
				libraryID: this._item.libraryID,
				itemID: this._item.id || ''
			};
			valueElement.autocomplete = {
				ignoreBlurWhileSearching: false,
				popup: 'PopupAutoComplete',
				search: 'zotero',
				searchParam: JSON.stringify(params),
				completeSelectedIndex: true
			};
			valueElement.addEventListener('blur', this.saveTag);
			valueElement.addEventListener('keydown', this.handleKeyDown);
			valueElement.addEventListener('paste', this.handlePaste);
			return valueElement;
		}

		handleKeyDown = async (event) => {
			var target = event.currentTarget;

			if (event.key === 'Enter') {
				// If tag's input is a multiline field, it must be right after pasting
				// of multiple tags. Then, Enter adds a new line and shift-Enter will save
				if (target.multiline && !event.shiftKey) return;
				var empty = target.value == "";

				event.preventDefault();

				var row = target.parentElement;
				// Not sure why this can happen, but if the event fires on an unmounted node, just ignore it
				if (!row.parentElement) {
					return;
				}
				// Do not propagate event to itemDetails that would send focus to itemTree or reader
				// because a new empty row will be created and focused in saveTag
				if (row.getAttribute("isNew")) {
					event.stopPropagation();
				}
				let blurOnly = false;
				let focusField = false;

				// If non-empty last row, only blur, because the open textbox will
				// be cleared in saveTag() and remain in place
				if (row == row.parentNode.lastChild && !empty) {
					blurOnly = true;
				}
				// If empty non-last row, refocus current row
				else if (row != row.parentNode.lastChild && empty) {
					focusField = row.nextElementSibling;
				}

				await this.blurOpenField();

				if (blurOnly) {
					return;
				}
				if (focusField) {
					focusField.focus();
				}
			}
			else if (event.key == "Tab" && !event.shiftKey) {
				// On tab from the last empty tag row, the minus icon will be focused
				// and the row will be immediately removed in this.saveTag, so focus will be lost.
				// To avoid that, on tab from the last tag input that is empty, focus the next
				// element after the tag row.
				let allTags = [...this.querySelectorAll(".row")];
				let isLastTag = target.closest(".row") == allTags[allTags.length - 1];
				if (isLastTag && !target.closest("editable-text").value.length) {
					Services.focus.moveFocus(window, target.closest(".row").lastChild, Services.focus.MOVEFOCUS_FORWARD, 0);
					event.preventDefault();
				}
			}
		};

		// Intercept paste, check for newlines, and convert textbox
		// to multiline if necessary
		handlePaste = (event) => {
			var textbox = event.currentTarget;
			var str = event.clipboardData.getData('text');

			var multiline = !!str.trim().match(/\n/);
			if (multiline) {
				setTimeout(() => {
					this.makeMultiline(textbox, str.trim());
				});
				event.preventDefault();
			}
		};

		makeMultiline(editable, value) {
			editable.noWrap = false;
			editable.multiline = true;
			editable.value = value;
			// Move cursor to end
			editable.ref.selectionStart = value.length;
		}
		
		makeSingleLine(editable) {
			editable.noWrap = true;
			editable.multiline = false;
		}

		saveTag = async (event) => {
			var textbox = event.currentTarget;

			Zotero.debug('Saving tag');

			var oldValue = textbox.initialValue;
			var value = textbox.value = textbox.value.trim();

			var row = textbox.parentNode;

			var isNew = row.getAttribute('isNew');

			// Remove empty row at end
			if (isNew && value === "") {
				row.parentNode.removeChild(row);
				this.updateCount();
				return;
			}

			// If row hasn't changed, we're done
			if (oldValue == value) {
				this.makeSingleLine(textbox);
				return;
			}

			var tags = value.split(/\r\n?|\n/).map(val => val.trim()).filter(x => x);

			// Modifying existing tag with a single new one
			if (!isNew && tags.length < 2) {
				if (value !== "") {
					if (oldValue !== value) {
						// The existing textbox will be removed in notify()
						this.removeRow(row);
						this.add(value);
						try {
							this.item.replaceTag(oldValue, value);
							await this.item.saveTx();
						}
						catch (e) {
							this._forceRenderAll();
							throw e;
						}
					}
				}
				// Existing tag cleared
				else {
					try {
						let nextRowElem = row.nextElementSibling?.querySelector('editable-text');
						this.removeRow(row);
						if (event.type != 'change') {
							nextRowElem?.focus();
						}
						this.item.removeTag(oldValue);
						await this.item.saveTx();
					}
					catch (e) {
						this._forceRenderAll();
						throw e;
					}
				}
			}
			// Multiple tags
			else if (tags.length > 1) {
				if (!isNew) {
					// If old tag isn't in array, remove it
					if (tags.indexOf(oldValue) == -1) {
						this.item.removeTag(oldValue);
					}
					// If old tag is staying, restore the textbox
					// immediately. This isn't strictly necessary, but it
					// makes the transition nicer.
					else {
						textbox.value = textbox.initialValue;
						textbox.blur();
					}
				}

				tags.forEach(tag => this.item.addTag(tag));
				await this.item.saveTx();
				this._forceRenderAll();
			}
			// Single tag at end
			else {
				if (event.type == 'change') {
					this.removeRow(row);
				}
				else {
					textbox.value = '';
					// We need a setTimeout here for some reason - why?
					setTimeout(() => textbox.focus());
				}
				this.add(value);
				this.item.addTag(value);
				try {
					await this.item.saveTx();
				}
				catch (e) {
					this._forceRenderAll();
					throw e;
				}
			}
			
			// If we didn't remove the textbox, make it single-line
			if (textbox.parentElement) {
				this.makeSingleLine(textbox);
			}
		};

		newTag() {
			this._section.empty = false;
			this._section.open = true;
			var row = this.addDynamicRow();
			row.querySelector('editable-text').focus();
			return row;
		}

		add(tagName, tagType) {
			var rowsElement = this._id('rows');
			var rows = rowsElement.childNodes;

			// Get this tag's existing row, if there is one
			var row = false;
			for (let i = 0; i < rows.length; i++) {
				if (rows[i].getAttribute('tagName') === tagName) {
					return rows[i];
				}
			}

			var tagData = {
				tag: tagName,
				type: tagType
			};
			
			var color = this._tagColors.has(tagName);

			// Create new row, but don't insert it
			row = this.addDynamicRow(tagData, false, true);
			var elem = row.getElementsByAttribute('fieldname', 'tag')[0];

			// Construct what the array of tags would be if this tag was a part of it
			let newTagsArray = this.item.getTags();
			newTagsArray.push({ tag: tagName, color: color || null });
			// Sort it with the colored tags on top, followed by emoji tags, followed by everything else
			newTagsArray.sort((a, b) => Zotero.Tags.compareTagsOrder(this._item.libraryID, a.tag, b.tag));
			// Find where the new tag should be placed and insert it there
			let newTagIndex = newTagsArray.findIndex(tag => tag.tag == tagName);
			if (newTagIndex < rowsElement.childNodes.length) {
				rowsElement.insertBefore(row, rowsElement.childNodes[newTagIndex]);
			}
			else {
				rowsElement.append(row);
			}

			this.updateCount(this.count + 1);

			return elem;
		}

		remove(tagName) {
			var rowsElement = this._id('rows');
			var rows = rowsElement.childNodes;
			for (var i = 0; i < rows.length; i++) {
				let value = rows[i].getAttribute('tagName');
				if (value === tagName) {
					this.removeRow(rows[i]);
					break;
				}
			}
		}

		// Remove the row and update tab indexes
		removeRow(row) {
			var origRow = row;
			origRow.parentNode.removeChild(origRow);
			this.updateCount(this.count - 1);
		}

		removeAll = () => {
			if (Services.prompt.confirm(null, "", Zotero.getString('pane.item.tags.removeAll'))) {
				this.item.setTags([]);
				this.item.saveTx();
			}
		};

		updateCount(count) {
			if (!this.item) {
				return;
			}

			if (typeof count == 'undefined') {
				var tags = this.item.getTags();
				if (tags) {
					count = tags.length;
				}
				else {
					count = 0;
				}
			}

			this._section.setCount(count);
			this.count = count;
		}

		closePopup() {
			if (this.parentNode.hidePopup) {
				this.parentNode.hidePopup();
			}
		}

		_handleAddButtonClick = async (_event) => {
			await this.blurOpenField();
			this.newTag();
		};

		addNew() {
			this._handleAddButtonClick();
		}

		async blurOpenField(stayOpen) {
			var editable = this.querySelector('editable-text:focus-within');
			if (editable) {
				await this.saveTag({
					currentTarget: editable,
					// If coming from the Add button, pretend user pressed Enter
					type: stayOpen ? 'keypress' : 'change',
					key: stayOpen ? 'Enter' : undefined
				});
			}
		}

		_id(id) {
			return this.querySelector(`[id=${id}]`);
		}
	}

	customElements.define("tags-box", TagsBox);
}
