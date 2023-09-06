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
			this._item = null;

			this.content = MozXULElement.parseXULToFragment(`
				<box flex="1" tooltip="html-tooltip" style="display: flex" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
					<div id="tags-box" style="flex-grow: 1" xmlns="http://www.w3.org/1999/xhtml">
						<div class="tags-box-header">
							<label id="count"/>
							<button id="tags-box-add-button">&zotero.item.add;</button>
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

			let content = document.importNode(this.content, true);
			this.append(content);

			// When tag pane is opened, xul moves focus on the add button.
			// It messes with the focusring and tab-based navigation.
			// This is a workaround to send the focus back onto the tab
			this._id("tags-box-add-button").addEventListener('focus', (event) => {
				if (event.explicitOriginalTarget.className == 'tab-text'
					|| event.explicitOriginalTarget.lastChild.className == 'tab-text') {
					document.getElementById("zotero-editpane-tags-tab").focus();
				}
			});

			this._id("tags-box-add-button").addEventListener('click', this._handleAddButtonClick);
			this._id("tags-box-add-button").addEventListener('keydown', this._handleAddButtonKeyDown);
			this._id('tags-box').addEventListener('click', (event) => {
				if (event.target.id == 'tags-box') {
					this.blurOpenField();
				}
			});

			let removeAllItemTags = this._id('remove-all-item-tags');
			this._id('remove-all-item-tags').addEventListener('command', this.removeAll);
			this._id('tags-box').addEventListener('contextmenu', (event) => {
				removeAllItemTags.disabled = !this.count;
				this._id('tags-context-menu').openPopupAtScreen(event.screenX, event.screenY, true);
			});

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

		get item() {
			return this._item;
		}

		set item(val) {
			// Don't reload if item hasn't changed
			if (this._item == val) {
				return;
			}
			this._item = val;
			this._lastTabIndex = false;
			this.reload();
		}

		notify(event, type, ids, extraData) {
			if (type == 'setting') {
				if (ids.some(val => val.split("/")[1] == 'tagColors') && this.item) {
					this.reload();
					return;
				}
			}
			else if (type == 'item-tag') {
				let itemID, tagID;

				for (let i = 0; i < ids.length; i++) {
					[itemID, tagID] = ids[i].split('-').map(x => parseInt(x));
					if (!this.item || itemID != this.item.id) {
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

			this._id("tags-box-add-button").hidden = !this.editable;

			this._tagColors = Zotero.Tags.getColors(this.item.libraryID);

			let tagRows = this._id('rows');
			tagRows.replaceChildren();

			var tags = this.item.getTags();

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
						let item = this.item;
						this.remove(tagName);
						try {
							item.removeTag(tagName);
							await item.saveTx();
						}
						catch (e) {
							this.reload();
							throw e;
						}
					}
					// Remove empty textbox row
					else {
						row.parentNode.removeChild(row);
					}

					// TODO: Return focus to items pane
					var tree = document.getElementById('item-tree-main-default');
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
					this.clickHandler(event.target, false, valueText);
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

		showEditor(elem, multiline, value) {

			// Blur any active fields
			/*
			if (this._dynamicFields) {
				this._dynamicFields.focus();
			}
			*/

			Zotero.debug('Showing editor');

			var fieldName = 'tag';
			var tabindex = elem.getAttribute('ztabindex');

			var itemID = this._item.id;

			var t = document.createElement(multiline ? 'textarea' : 'input', { is: 'shadow-autocomplete-input' });
			t.setAttribute('class', 'editable');
			t.setAttribute('value', value);
			t.setAttribute('fieldname', fieldName);
			t.setAttribute('ztabindex', tabindex);
			t.setAttribute('ignoreblurwhilesearching', 'true');
			t.setAttribute('autocompletepopup', 'PopupAutoComplete');
			const multilineFieldRowsCount = 6;
			// Multi-line
			if (multiline) {
				t.setAttribute('rows', multilineFieldRowsCount);
			}
			// Add auto-complete
			else {
				t.setAttribute('type', 'autocomplete');
				t.setAttribute('autocompletesearch', 'zotero');
				let params = {
					fieldName: fieldName,
					libraryID: this.item.libraryID
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
						var tree = document.getElementById('item-tree-main-default');
						if (tree) {
							tree.focus();
						}
					}

					return false;

				case event.DOM_VK_ESCAPE:
					// Reset field to original value
					target.value = target.getAttribute('value');

					this._lastTabIndex = false;
					await this.blurHandler(event);


					// TODO: Return focus to items pane
					var tree = document.getElementById('item-tree-main-default');
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
						else {
							await this.blurHandler(event);
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

		makeMultiline(textbox, value) {
			textbox.parentNode.classList.add('multiline');
			textbox = this.showEditor(textbox, true, textbox.getAttribute('value'));
			textbox.value = value;
			// Move cursor to end
			textbox.selectionStart = value.length;
		}

		hideEditor = async (event) => {
			var textbox = event.target;

			Zotero.debug('Hiding editor');

			var oldValue = textbox.getAttribute('value');
			var value = textbox.value = textbox.value.trim();

			var tagsbox = textbox.closest('.editable');
			if (!tagsbox) {
				Zotero.debug('Tagsbox not found', 1);
				return;
			}

			// Make sure the multiline mode is off
			textbox.parentNode.classList.remove('multiline');
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

			const shiftEnter = event.keyCode == event.DOM_VK_RETURN && event.shiftKey;

			// Modifying existing tag with a single new one
			if (!isNew && tags.length < 2) {
				if (value !== "") {
					if (oldValue !== value) {
						var lastTag = row == row.parentNode.lastChild;
						var childCount = row.parentNode.childElementCount;
						// The existing textbox will be removed in notify()
						this.removeRow(row);
						this.add(value);
						if (event.type != 'blur') {
							if (lastTag) {
								this._lastTabIndex = childCount + 1;
							}
							this._focusField();
						}
						try {
							this.item.replaceTag(oldValue, value);
							await this.item.saveTx();
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
						this.item.removeTag(oldValue);
						await this.item.saveTx();
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
						this.item.removeTag(oldValue);
					}
					// If old tag is staying, restore the textbox
					// immediately. This isn't strictly necessary, but it
					// makes the transition nicer.
					else {
						textbox.value = textbox.getAttribute('value');
						this.textboxToLabel(textbox);
					}
				}

				tags.forEach(tag => this.item.addTag(tag));
				await this.item.saveTx();

				if (lastTag) {
					this._lastTabIndex = null;
				}
				// If multiple tags are added from new multiline field,
				// keep focus on new inputfield after refresh
				if (isNew && shiftEnter) {
					this._lastTabIndex = this.item.getTags().length + 1;
				}

				this.reload();
			}
			// Single tag at end
			else {
				if (event.type == 'blur' || shiftEnter) {
					this.removeRow(row);
				}
				else {
					textbox.value = '';
				}
				this.add(value);
				this.item.addTag(value);
				try {
					await this.item.saveTx();
					// If single tag is added from new multiline textfiled
					// keep the focus on it
					if (shiftEnter) {
						this._lastTabIndex = this.item.getTags().length + 1;
						this._focusField();
					}
				}
				catch (e) {
					this.reload();
					throw e;
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

			this._id('count').replaceChildren(Zotero.getString('pane.item.tags.count', count, count));
			this.count = count;
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
					// When add-button is focused for the first time via shift-tab
					// from the first tag, css .focus-visible does not get set
					//  and focusring does not show. .contentEditable is a hack to force it
					this._id("tags-box-add-button").contentEditable = true;
					this._id("tags-box-add-button").focus();
					this._id("tags-box-add-button").contentEditable = false;
					return false;
				}
				var nextIndex = tabindex - 1;
			}
			else {
				var nextIndex = tabindex;
			}

			nextIndex = Math.min(nextIndex, maxIndex);

			Zotero.debug('Looking for tabindex ' + nextIndex, 4);

			var next = this.querySelector(`[ztabindex="${nextIndex}"]`);
			if (next) {
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
			var textboxe = this.querySelector('.editable');
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
			return this.querySelector(`[id=${id}]`);
		}
	}

	customElements.define("tags-box", TagsBox);
}
