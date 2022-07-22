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
	class TagsBox extends XULElement {
		constructor() {
			super();

			this.count = 0;
			this.clickHandler = null;

			this._lastTabIndex = false;
			this._tabDirection = null;
			this._tagColors = [];
			this._notifierID = null;
			this._mode = 'view';
			this._items = [];

			this.content = MozXULElement.parseXULToFragment(`
				<box flex="1" tooltip="html-tooltip" style="display: flex" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
					<div id="tags-box" style="flex-grow: 1" xmlns="http://www.w3.org/1999/xhtml">
						<div class="tags-box-header">
							<label id="count"/>
							<button id="add">&zotero.item.add;</button>
						</div>
						<ul id="rows" class="tags-box-list"/>
					</div>
				</box>
				<popupset xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
					<tooltip id="html-tooltip" page="true"/>
					<menupopup id="tags-context-menu">
						<menuitem id="remove-all-item-tags" label="&zotero.item.tags.removeAll;"/>
					</menupopup>
					<!-- Note: autocomplete-input can create this panel by itself, but it appears
							   in the top DOM and is behind the tags box popup -->
					<panel
						is="autocomplete-richlistbox-popup"
						type="autocomplete-richlistbox"
						id="PopupAutoComplete"
						role="group"
						noautofocus="true"
						hidden="true"
						overflowpadding="4"
						norolluponanchor="true"
						nomaxresults="true"
					/>
				</popupset>
			`, ['chrome://zotero/locale/zotero.dtd']);
		}

		connectedCallback() {
			this._destroyed = false;
			window.addEventListener("unload", this.destroy);

			let shadow = this.attachShadow({ mode: "open" });

			let s1 = document.createElement("link");
			s1.rel = "stylesheet";
			s1.href = "chrome://zotero-platform/content/tagsBox.css";
			shadow.append(s1);

			let s2 = document.createElement("link");
			s2.rel = "stylesheet";
			s2.href = "chrome://global/skin/";
			shadow.append(s2);

			let s3 = document.createElement("link");
			s3.rel = "stylesheet";
			s3.href = "chrome://zotero/skin/overlay.css";
			shadow.append(s3);

			let content = document.importNode(this.content, true);
			shadow.append(content);

			this._id('add').addEventListener('click', this._handleAddButtonClick);
			this._id('add').addEventListener('keydown', this._handleAddButtonKeyDown);
			this._id('tags-box').addEventListener('click', (event) => {
				if (event.target.id == 'tags-box') {
					this.blurOpenField();
				}
			});

			let removeAllItemTags = this._id('remove-all-item-tags');
			this._id('remove-all-item-tags').addEventListener('command', this.removeAll);

			// Don't allow the context menu to be opened if we're in a popup -
			// Remove All shows a confirmation dialog, which can't be opened from a popup,
			// and it's not clear to the user what action it would perform
			if (!this.closest('panel')) {
				this._id('tags-box').addEventListener('contextmenu', (event) => {
					removeAllItemTags.disabled = !this.count;
					this._id('tags-context-menu').openPopupAtScreen(event.screenX, event.screenY, true);
				});
			}

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item-tag', 'setting'], 'tagsBox');
		}

		destroy() {
			if (this._destroyed) {
				return;
			}
			window.removeEventListener("unload", this.destroy);
			this._destroyed = true;

			Zotero.Notifier.unregisterObserver(this._notifierID);
		}

		disconnectedCallback() {
			this.replaceChildren();
			this.destroy();
		}

		get mode() {
			return this._mode;
		}

		set mode(val) {
			this.clickable = false;
			this.editable = false;

			switch (val) {
				case 'view':
				case 'merge':
				case 'mergeedit':
					break;

				case 'edit':
					this.clickable = true;
					this.editable = true;
					this.clickHandler = this.showEditor;
					this.blurHandler = this.hideEditor;
					break;

				default:
					throw new Error(`Invalid mode ${val}`);
			}

			this._mode = val;
		}

		get items() {
			return Object.freeze([...this._items]);
		}

		set items(val) {
			this._items = [...val];
			this._lastTabIndex = false;
			this.reload();
		}

		get item() {
			return this._items.length == 1 ? this._items[0] : null;
		}

		set item(val) {
			// Don't reload if item hasn't changed
			if (this._items.length == 1 && this._items[0] == val) {
				return;
			}
			this._items = [val];
			this._lastTabIndex = false;
			this.reload();
		}

		/**
		 * Get tags in common between all items. If a tag is marked as manual in
		 * at least one item, it will be marked as manual in the returned array,
		 * even if other items have an automatic tag with the same name.
		 *
		 * @return {Object[]}
		 */
		get visibleTags() {
			if (this._items.length == 1) {
				return this._items[0].getTags();
			}
			else {
				// Calculate intersection of all tag lists
				let tags = new Map();
				for (let item of this._items) {
					for (let tag of item.getTags()) {
						if (tags.has(tag.tag)) {
							let data = tags.get(tag.tag);
							if (data.mode == 1 && tag.mode == 0) {
								data.mode = 0;
							}
							data.count++;
						}
						else {
							tags.set(tag.tag, { ...tag, count: 1 });
						}
					}
				}
				return [...tags.values()]
					.filter(data => data.count == this._items.length)
					.map(data => ({ tag: data.tag, mode: data.mode }));
			}
		}

		notify(event, type, ids, extraData) {
			if (type == 'setting') {
				if (ids.some(val => val.split("/")[1] == 'tagColors') && this._items.length) {
					this.reload();
					return;
				}
			}
			else if (type == 'item-tag') {
				let itemID, tagID;

				for (let i = 0; i < ids.length; i++) {
					[itemID, tagID] = ids[i].split('-').map(x => parseInt(x));
					if (!this._items.length || !this._items.some(item => itemID == item.id)) {
						continue;
					}
					let data = extraData[ids[i]];
					let tagName = data.tag;
					let tagType = data.type;

					if (event == 'add') {
						var newTabIndex = this.add(tagName, tagType);
						if (newTabIndex == -1) {
							return;
						}
						if (this._tabDirection == -1) {
							if (this._lastTabIndex > newTabIndex) {
								this._lastTabIndex++;
							}
						}
						else if (this._tabDirection == 1) {
							if (this._lastTabIndex > newTabIndex) {
								this._lastTabIndex++;
							}
						}
					}
					else if (event == 'modify') {
						let oldTagName = data.old.tag;
						this.remove(oldTagName);
						this.add(tagName, tagType);
					}
					else if (event == 'remove') {
						var oldTabIndex = this.remove(tagName);
						if (oldTabIndex == -1) {
							return;
						}
						if (this._tabDirection == -1) {
							if (this._lastTabIndex > oldTabIndex) {
								this._lastTabIndex--;
							}
						}
						else if (this._tabDirection == 1) {
							if (this._lastTabIndex >= oldTabIndex) {
								this._lastTabIndex--;
							}
						}
					}
				}

				this.updateCount();
			}
			else if (type == 'tag') {
				if (event == 'modify') {
					this.reload();
					return;
				}
			}
		}

		reload() {
			Zotero.debug('Reloading tags box');

			// Cancel field focusing while we're updating
			this._reloading = true;

			this._id('add').hidden = !this.editable;

			this._tagColors = Zotero.Tags.getColors(this._items[0].libraryID);

			let tagRows = this._id('rows');
			tagRows.replaceChildren();

			let tags = this.visibleTags;

			// Sort tags alphabetically
			var collation = Zotero.getLocaleCollation();
			tags.sort((a, b) => collation.compareString(1, a.tag, b.tag));

			for (let i = 0; i < tags.length; i++) {
				this.addDynamicRow(tags[i], i + 1);
			}
			this.updateCount(tags.length);

			this._reloading = false;
			this._focusField();
		}

		addDynamicRow(tagData, tabindex, skipAppend) {
			var isNew = !tagData;
			var name = tagData ? tagData.tag : "";

			if (!tabindex) {
				tabindex = this._id('rows').childNodes.length + 1;
			}

			var icon = document.createElement("img");
			icon.className = "zotero-box-icon";

			// DEBUG: Why won't just this.nextSibling.blur() work?
			icon.addEventListener('click', (event) => {
				event.target.nextSibling.blur();
			});

			var label = this.createValueElement(name, tabindex);

			if (this.editable) {
				var remove = document.createXULElement("label");
				remove.setAttribute('value', '-');
				remove.setAttribute('class', 'zotero-clicky zotero-clicky-minus');
				remove.setAttribute('tabindex', -1);
			}

			var row = document.createElement("li");
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

			var icon = row.firstChild;
			if (this.editable) {
				var remove = row.lastChild;
			}

			// Row
			row.setAttribute('tagName', tagName);
			row.setAttribute('tagType', tagType);

			// Icon
			var iconFile = 'tag';
			if (!tagData || tagType == 0) {
				icon.setAttribute('title', Zotero.getString('pane.item.tags.icon.user'));
			}
			else if (tagType == 1) {
				iconFile += '-automatic';
				icon.setAttribute('title', Zotero.getString('pane.item.tags.icon.automatic'));
			}
			icon.setAttribute('src', `chrome://zotero/skin/${iconFile}${Zotero.hiDPISuffix}.png`);

			// "-" button
			if (this.editable) {
				remove.setAttribute('disabled', false);
				remove.addEventListener('click', async (event) => {
					this._lastTabIndex = false;
					if (tagData) {
						this.remove(tagName);
						for (let item of this._items) {
							try {
								item.removeTag(tagName);
								await item.saveTx();
							}
							catch (e) {
								this.reload();
								throw e;
							}
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


		createValueElement(valueText, tabindex) {
			var valueElement = document.createXULElement("label");
			valueElement.setAttribute('fieldname', 'tag');
			valueElement.setAttribute('flex', 1);
			valueElement.className = 'zotero-box-label';

			if (this.clickable) {
				if (tabindex) {
					valueElement.setAttribute('ztabindex', tabindex);
				}
				valueElement.addEventListener('click', (event) => {
					/* Skip right-click on Windows */
					if (event.button) {
						return;
					}
					this.clickHandler(event.target, 1, valueText);
				}, false);
				valueElement.className += ' zotero-clicky';
			}

			var firstSpace;
			if (typeof valueText == 'string') {
				firstSpace = valueText.indexOf(" ");
			}

			// 29 == arbitrary length at which to chop uninterrupted text
			if ((firstSpace == -1 && valueText.length > 29) || firstSpace > 29) {
				valueElement.setAttribute('crop', 'end');
				valueElement.setAttribute('value', valueText);
			}
			else {
				// Wrap to multiple lines
				valueElement.appendChild(document.createTextNode(valueText));
			}

			// Tag color
			var colorData = this._tagColors.get(valueText);
			if (colorData) {
				valueElement.style.color = colorData.color;
				valueElement.style.fontWeight = 'bold';
			}

			return valueElement;
		}

		showEditor(elem, rows, value) {
			if (this.closest('panel')) {
				this.closest('panel').setAttribute('ignorekeys', true);
			}

			// Blur any active fields
			/*
			if (this._dynamicFields) {
				this._dynamicFields.focus();
			}
			*/

			Zotero.debug('Showing editor');

			var fieldName = 'tag';
			var tabindex = elem.getAttribute('ztabindex');

			var itemID = this._item?.id;

			var t = document.createElement(rows > 1 ? 'textarea' : 'input', { is: 'shadow-autocomplete-input' });
			t.setAttribute('class', 'editable');
			t.setAttribute('value', value);
			t.setAttribute('fieldname', fieldName);
			t.setAttribute('ztabindex', tabindex);
			t.setAttribute('ignoreblurwhilesearching', 'true');
			t.setAttribute('autocompletepopup', 'PopupAutoComplete');
			// Multi-line
			if (rows > 1) {
				t.setAttribute('rows', rows);
			}
			// Add auto-complete
			else {
				t.setAttribute('type', 'autocomplete');
				t.setAttribute('autocompletesearch', 'zotero');
				let params = {
					fieldName: fieldName,
					libraryID: this._items[0].libraryID
				};
				params.itemID = itemID ? itemID : '';
				t.setAttribute(
					'autocompletesearchparam', JSON.stringify(params)
				);
				t.setAttribute('completeselectedindex', true);
			}

			var box = elem.parentNode;
			box.replaceChild(t, elem);

			t.addEventListener('blur', this.blurHandler);
			t.addEventListener('keydown', this.handleKeyDown);
			t.addEventListener('paste', this.handlePaste);

			this._tabDirection = false;
			this._lastTabIndex = tabindex;

			// Prevent error when clicking between a changed field
			// and another -- there's probably a better way
			if (!t.select) {
				return;
			}
			t.select();

			return t;
		}

		handleKeyDown = async (event) => {
			var target = event.target;
			var focused = document.activeElement;

			switch (event.keyCode) {
				case event.DOM_VK_RETURN:
					var multiline = target.parentNode.classList.contains('multiline');
					var empty = target.value == "";
					if (event.shiftKey) {
						if (!multiline) {
							var self = this;
							setTimeout(function () {
								var val = target.value;
								if (val !== "") {
									val += "\n";
								}
								self.makeMultiline(target, val, 6);
							}, 0);
							return false;
						}
						// Submit
					}
					else if (multiline) {
						return true;
					}

					var row = target.closest('li');
					let blurOnly = false;

					// If non-empty last row, only blur, because the open textbox will
					// be cleared in hideEditor() and remain in place
					if (row == row.parentNode.lastChild && !empty) {
						blurOnly = true;
					}
					// If empty non-last row, refocus current row
					else if (row != row.parentNode.lastChild && empty) {
						var focusField = true;
					}
					// If non-empty non-last row, return focus to items pane
					else {
						var focusField = false;
						this._lastTabIndex = false;
					}

					await this.blurHandler(event);

					if (blurOnly) {
						return false;
					}
					if (focusField) {
						this._focusField();
					}
					// Return focus to items pane
					else {
						var tree = document.getElementById('zotero-items-tree');
						if (tree) {
							tree.focus();
						}
					}

					return false;

				case event.DOM_VK_ESCAPE:
					// Reset field to original value
					target.value = target.getAttribute('value');

					var tagsbox = focused.closest('.editable');

					this._lastTabIndex = false;
					await this.blurHandler(event);

					if (tagsbox) {
						tagsbox.closePopup();
					}

					// TODO: Return focus to items pane
					var tree = document.getElementById('zotero-items-tree');
					if (tree) {
						tree.focus();
					}

					return false;

				case event.DOM_VK_TAB:
					// If already an empty last row, ignore forward tab
					if (target.value == "" && !event.shiftKey) {
						var row = Zotero.getAncestorByTagName(target, 'li');
						if (row == row.parentNode.lastChild) {
							return false;
						}
					}

					this._tabDirection = event.shiftKey ? -1 : 1;
					await this.blurHandler(event);
					this._focusField();
					return false;
			}

			return true;
		};

		// Intercept paste, check for newlines, and convert textbox
		// to multiline if necessary
		handlePaste = (event) => {
			var textbox = event.target;
			var str = event.clipboardData.getData('text');

			var multiline = !!str.trim().match(/\n/);
			if (multiline) {
				setTimeout(() => {
					this.makeMultiline(textbox, str.trim());
				});
				event.preventDefault();
			}
		};

		makeMultiline(textbox, value, rows) {
			textbox.parentNode.classList.add('multiline');
			// If rows not specified, use one more than lines in input
			if (!rows) {
				rows = value.match(/\n/g).length + 1;
			}
			textbox = this.showEditor(textbox, rows, textbox.getAttribute('value'));
			textbox.value = value;
			// Move cursor to end
			textbox.selectionStart = value.length;
		}

		hideEditor = async (event) => {
			if (this.closest('panel')) {
				this.closest('panel').setAttribute('ignorekeys', false);
			}

			var textbox = event.target;

			Zotero.debug('Hiding editor');

			var oldValue = textbox.getAttribute('value');
			var value = textbox.value = textbox.value.trim();

			var tagsbox = textbox.closest('.editable');
			if (!tagsbox) {
				Zotero.debug('Tagsbox not found', 1);
				return;
			}

			var row = textbox.parentNode;

			var isNew = row.getAttribute('isNew');

			// Remove empty row at end
			if (isNew && value === "") {
				row.parentNode.removeChild(row);
				return;
			}

			// If row hasn't changed, change back to label
			if (oldValue == value) {
				this.textboxToLabel(textbox);
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
						if (event.type != 'blur') {
							this._focusField();
						}
						try {
							for (let item of this._items) {
								item.replaceTag(oldValue, value);
								await item.saveTx();
							}
						}
						catch (e) {
							this.reload();
							throw e;
						}
					}
				}
				// Existing tag cleared
				else {
					try {
						this.removeRow(row);
						if (event.type != 'blur') {
							this._focusField();
						}
						for (let item of this._items) {
							item.removeTag(oldValue);
							await item.saveTx();
						}
					}
					catch (e) {
						this.reload();
						throw e;
					}
				}
			}
			// Multiple tags
			else if (tags.length > 1) {
				var lastTag = row == row.parentNode.lastChild;

				if (!isNew) {
					// If old tag isn't in array, remove it
					if (tags.indexOf(oldValue) == -1) {
						for (let item of this._items) {
							item.removeTag(oldValue);
						}
					}
					// If old tag is staying, restore the textbox
					// immediately. This isn't strictly necessary, but it
					// makes the transition nicer.
					else {
						textbox.value = textbox.getAttribute('value');
						this.textboxToLabel(textbox);
					}
				}

				for (let item of this._items) {
					tags.forEach(tag => item.addTag(tag));
					await item.saveTx();
				}

				if (lastTag) {
					this._lastTabIndex = this.visibleTags.length;
				}

				this.reload();
			}
			// Single tag at end
			else {
				if (event.type == 'blur') {
					this.removeRow(row);
				}
				else {
					textbox.value = '';
				}
				this.add(value);
				for (let item of this._items) {
					item.addTag(value);
					try {
						await item.saveTx();
					}
					catch (e) {
						this.reload();
						throw e;
					}
				}
			}
		};

		newTag() {
			var rowsElement = this._id('rows');
			var rows = rowsElement.childNodes;

			// Don't add new row if there already is one
			if (rows.length && rows[rows.length - 1].querySelector('.editable')) {
				return;
			}

			var row = this.addDynamicRow();
			// It needs relatively high delay to make focus-on-click work
			setTimeout(() => {
				row.firstChild.nextSibling.click();
			}, 50);

			return row;
		}

		textboxToLabel(textbox) {
			var elem = this.createValueElement(
				textbox.value, textbox.getAttribute('ztabindex')
			);
			var row = textbox.parentNode;
			row.replaceChild(elem, textbox);
		}

		add(tagName, tagType) {
			var rowsElement = this._id('rows');
			var rows = rowsElement.childNodes;

			// Get this tag's existing row, if there is one
			var row = false;
			for (let i = 0; i < rows.length; i++) {
				if (rows[i].getAttribute('tagName') === tagName) {
					return rows[i].getAttribute('ztabindex');
				}
			}

			var tagData = {
				tag: tagName,
				type: tagType
			};

			if (row) {
				// Update row and label
				this.updateRow(row, tagData);
				var elem = this.createValueElement(tagName);

				// Remove the old row, which we'll reinsert at the correct place
				rowsElement.removeChild(row);

				// Find the current label or textbox within the row
				// and replace it with the new element -- this is used
				// both when creating new rows and when hiding the
				// entry textbox
				var oldElem = row.getElementsByAttribute('fieldname', 'tag')[0];
				row.replaceChild(elem, oldElem);
			}
			else {
				// Create new row, but don't insert it
				row = this.addDynamicRow(tagData, false, true);
				var elem = row.getElementsByAttribute('fieldname', 'tag')[0];
			}

			// Move row to appropriate place, alphabetically
			var collation = Zotero.getLocaleCollation();
			var labels = rowsElement.getElementsByAttribute('fieldname', 'tag');

			var inserted = false;
			var newTabIndex = false;
			for (var i = 0; i < labels.length; i++) {
				let index = i + 1;
				if (inserted) {
					labels[i].setAttribute('ztabindex', index);
					continue;
				}

				if (collation.compareString(1, tagName, labels[i].textContent) > 0
					// Ignore textbox at end
					&& labels[i].tagName != 'input') {
					labels[i].setAttribute('ztabindex', index);
					continue;
				}

				elem.setAttribute('ztabindex', index);
				rowsElement.insertBefore(row, labels[i].parentNode);
				newTabIndex = index;
				inserted = true;
			}
			if (!inserted) {
				newTabIndex = i + 1;
				elem.setAttribute('ztabindex', newTabIndex);
				rowsElement.appendChild(row);
			}

			this.updateCount(this.count + 1);

			return newTabIndex;
		}

		remove(tagName) {
			var rowsElement = this._id('rows');
			var rows = rowsElement.childNodes;
			var oldTabIndex = -1;
			for (var i = 0; i < rows.length; i++) {
				let value = rows[i].getAttribute('tagName');
				if (value === tagName) {
					oldTabIndex = this.removeRow(rows[i]);
					break;
				}
			}
			return oldTabIndex;
		}

		// Remove the row and update tab indexes
		removeRow(row) {
			var origTabIndex = row.getElementsByAttribute('fieldname', 'tag')[0].getAttribute('ztabindex');
			var origRow = row;
			var i = origTabIndex;
			while (row = row.nextSibling) {
				let elem = row.getElementsByAttribute('fieldname', 'tag')[0];
				elem.setAttribute('ztabindex', i++);
			}
			origRow.parentNode.removeChild(origRow);
			this.updateCount(this.count - 1);
			return origTabIndex;
		}

		removeAll = async () => {
			if (Services.prompt.confirm(null, "", Zotero.getString('pane.item.tags.removeAll'))) {
				if (this._items.length == 1) {
					this._items[0].setTags([]);
					this._items[0].saveTx();
				}
				else {
					let tags = this.visibleTags.map(tag => tag.tag);
					for (let item of this._items) {
						item.setTags(item.getTags().filter(tag => !tags.includes(tag.tag)));
						await item.saveTx();
					}
				}
			}
		};

		updateCount(count) {
			if (!this._items.length) {
				return;
			}

			if (typeof count == 'undefined') {
				var tags = this.visibleTags;
				if (tags) {
					count = tags.length;
				}
				else {
					count = 0;
				}
			}

			let itemCount = this._items.length;
			if (itemCount == 1) {
				this._id('count').replaceChildren(Zotero.getString('pane.item.tags.count', count, count));
			}
			else {
				let string = Zotero.getString('pane.item.tags.multipleItems.count', count, count)
					+ ' '
					+ Zotero.getString('pane.item.tags.multipleItems.itemCount', itemCount, itemCount);
				this._id('count').replaceChildren(string);
			}
			this.count = count;
		}

		closePopup() {
			if (this.parentNode.hidePopup) {
				this.parentNode.hidePopup();
			}
		}

		// Open the textbox for a particular label
		//
		// Note: We're basically replicating the built-in tabindex functionality,
		// which doesn't work well with the weird label/textbox stuff we're doing.
		// (The textbox being tabbed away from is deleted before the blur()
		// completes, so it doesn't know where it's supposed to go next.)
		_focusField() {
			if (this._reloading) {
				return;
			}

			if (this._lastTabIndex === false) {
				return;
			}

			var maxIndex = this._id('rows').childNodes.length + 1;

			var tabindex = parseInt(this._lastTabIndex);
			var dir = this._tabDirection;

			if (dir == 1) {
				var nextIndex = tabindex + 1;
			}
			else if (dir == -1) {
				if (tabindex == 1) {
					// Focus Add button
					this._id('add').focus();
					return false;
				}
				var nextIndex = tabindex - 1;
			}
			else {
				var nextIndex = tabindex;
			}

			nextIndex = Math.min(nextIndex, maxIndex);

			Zotero.debug('Looking for tabindex ' + nextIndex, 4);

			var next = this.shadowRoot.getElementsByAttribute('ztabindex', nextIndex);
			if (next.length) {
				next = next[0];
				next.click();
			}
			else {
				next = this.newTag();
				next = next.firstChild.nextSibling;
			}

			if (!next) {
				Components.utils.reportError('Next row not found');
				return;
			}

			next.scrollIntoView();
		}

		_handleAddButtonKeyDown = (event) => {
			if (event.keyCode != event.DOM_VK_TAB || event.shiftKey) {
				return;
			}
			this._lastTabIndex = 0;
			this._tabDirection = 1;
			this._focusField();
			event.preventDefault();
		};

		_handleAddButtonClick = async (event) => {
			await this.blurOpenField();
			this.newTag();
		};

		addNew() {
			this._handleAddButtonClick();
		}

		async blurOpenField(stayOpen) {
			this._lastTabIndex = false;
			var textboxe = this.shadowRoot.querySelector('.editable');
			if (textboxe) {
				await this.blurHandler({
					target: textboxe,
					// If coming from the Add button, pretend user pressed return
					type: stayOpen ? 'keypress' : 'blur',
					// DOM_VK_RETURN
					keyCode: stayOpen ? 13 : undefined
				});
			}
		}

		_id(id) {
			return this.shadowRoot.querySelector(`[id=${id}]`);
		}
	}

	customElements.define("tags-box", TagsBox);
}
