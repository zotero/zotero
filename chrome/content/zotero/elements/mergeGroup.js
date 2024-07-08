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

{
	class MergeGroup extends XULElement {
		constructor() {
			super();
			
			this.libraryID = null;
			this._data = null;
			this._type = null;
			
			this.content = MozXULElement.parseXULToFragment(`
				<merge-pane id="left-pane" flex="1" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"/>
				<merge-pane id="right-pane" flex="1" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"/>
				<merge-pane id="merge-pane" flex="1" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"/>
			`, ['chrome://zotero/locale/zotero.dtd']);
		}
		
		get stylesheets() {
			return [
				'chrome://zotero/skin/merge.css'
			];
		}
		
		connectedCallback() {
			this.append(document.importNode(this.content, true));
			
			this._leftPane = this._id('left-pane');
			this._rightPane = this._id('right-pane');
			this._mergePane = this._id('merge-pane');
			
			// Select pane with left/right arrow key
			this.addEventListener('keypress', (event) => {
				if (event.key == Zotero.arrowNextKey && !this._rightPane.hasAttribute("selected")) {
					this.choosePane(this._rightPane);
					this.rightPane.groupbox.focus();
				}
				else if (event.key == Zotero.arrowPreviousKey && !this._leftPane.hasAttribute("selected")) {
					this.choosePane(this._leftPane);
					this._leftPane.groupbox.focus();
				}
			});
		}
		
		get data() {
			return this._data;
		}

		set data(val) {
			this._data = val;
			this.refresh();
		}
		
		get merged() {
			return this._mergePane.data;
		}
		
		get type() {
			return this._type;
		}

		set type(val) {
			switch (val) {
				case 'item':
				case 'attachment':
				case 'note':
				case 'annotation':
				case 'file':
					break;
				
				default:
					throw new Error(`Unsupported merge object type '${val}'`);
			}
			
			this._type = val;
			this.setAttribute('mergetype', val);
		}
		
		set leftCaption(val) {
			this._leftPane.caption = val;
		}

		set rightCaption(val) {
			this._rightPane.caption = val;
		}

		set mergeCaption(val) {
			this._mergePane.caption = val;
		}
		
		get leftPane() {
			return this._leftPane;
		}

		get rightPane() {
			return this._rightPane;
		}

		get mergePane() {
			return this._mergePane;
		}
		
		refresh() {
			if (this._data.left.deleted && this._data.right.deleted) {
				throw new Error("'left' and 'right' cannot both be deleted");
			}
			
			// Check for note or attachment
			this.type = this._getTypeFromObject(
				this._data.left.deleted ? this._data.right : this._data.left
			);
			
			var showButton = this.type != 'item';
			
			this._leftPane.showButton = showButton;
			this._rightPane.showButton = showButton;
			this._leftPane.libraryID = this.libraryID;
			this._rightPane.libraryID = this.libraryID;
			this._mergePane.libraryID = this.libraryID;
			this._leftPane.data = this._data.left;
			this._rightPane.data = this._data.right;
			this._mergePane.data = this._data.merge;
			
			if (this._data.selected == 'left') {
				this.choosePane(this._leftPane);
			}
			else {
				this.choosePane(this._rightPane);
			}
			
			/*
			
			Code to display only the different values -- not used
			
			var diff = this._leftPane.ref.diff(this._rightPane.ref, true);
			
			var fields = [];
			var diffFields = [];
			for (var field in diff[0].primary) {
				fields.push(field);
				if (diff[0].primary[field] != diff[1].primary[field]) {
					diffFields.push(field);
				}
			}
			for (var field in diff[0].fields) {
				fields.push(field);
				if (diff[0].fields[field] != diff[1].fields[field]) {
					diffFields.push(field);
				}
			}
			
			this._leftPane.objectBox.fieldOrder = fields;
			this._rightPane.objectBox.fieldOrder = fields;
			
			// Display merge pane if item types match
			if (this._leftPane.ref.itemTypeID == this._rightPane.ref.itemTypeID) {
				this._leftPane.objectBox.visibleFields = fields;
				this._rightPane.objectBox.visibleFields = fields;
				
				this._leftPane.objectBox.clickable = false;
				this._rightPane.objectBox.clickable = false;
				this._leftPane.objectBox.clickableFields = diffFields;
				this._rightPane.objectBox.clickableFields = diffFields;
				
				var mergeItem = new Zotero.Item(this._leftPane.ref.itemTypeID);
				this._mergePane.ref = mergeItem;
				this._mergePane.objectBox.visibleFields = fields;
			}
			// Otherwise only allow clicking on item types
			else {
				this._leftPane.objectBox.clickableFields = ['itemType'];
				this._rightPane.objectBox.clickableFields = ['itemType'];
			}
			*/
			
			
			this._mergePane.objectBox.editable = true;
			
			
			/*
			
			No need to refresh if not comparing fields
			
			this._leftPane.objectBox.refresh();
			this._rightPane.objectBox.refresh();
			*/
		}
		
		
		choosePane(pane) {
			Zotero.debug(new Error().stack);
			let otherPane;
			if (pane.id == 'left-pane') {
				otherPane = this._rightPane;
			}
			else {
				otherPane = this._leftPane;
			}
			
			pane.removeAttribute("selected");
			otherPane.removeAttribute("selected");
			pane.setAttribute("selected", "true");
			
			this._mergePane.data = pane.data;
			
			if (this.onSelectionChange) {
				this.onSelectionChange();
			}
		}
		
		
		_getTypeFromObject(obj) {
			if (!obj.itemType) {
				Zotero.debug(obj, 1);
				throw new Error("obj is not item JSON");
			}
			switch (obj.itemType) {
				case 'attachment':
				case 'note':
				case 'annotation':
					return obj.itemType;
			}
			return 'item';
		}
		
		
		_id(id) {
			return this.querySelector(`#${id}`);
		}
	}
	customElements.define("merge-group", MergeGroup);
}


{
	class MergePane extends XULElement {
		constructor() {
			super();
			
			this._data = null;
			this._deleted = false;
			
			this.content = MozXULElement.parseXULToFragment(`
				<groupbox>
					<label><html:h2/></label>
					<html:div class="parent-row" hidden="true"/>
					<box class="object-placeholder"/>
					<hbox class="delete-box" hidden="true" flex="1">
						<label value="&zotero.merge.deleted;"/>
					</hbox>
				</groupbox>
				<button class="choose-button"/>
			`, ['chrome://zotero/locale/zotero.dtd']);
		}
		
		get stylesheets() {
			return ['chrome://zotero/skin/bindings/merge.css'];
		}
		
		connectedCallback() {
			this.append(document.importNode(this.content, true));
			
			this.parent = document.querySelector('merge-group');
			this.isLeftPane = this.id == 'left-pane';
			this.isRightPane = this.id == 'right-pane';
			this.isMergePane = this.id == 'merge-pane';
			
			if (!this.isMergePane) {
				this.groupbox.onclick = this.click.bind(this);
			}
		}
		
		get type() {
			return this.parent.type;
		}
		
		get groupbox() {
			return this.querySelector('groupbox');
		}
		
		get caption() {
			return this.querySelector('h2').textContent;
		}
		
		set caption(val) {
			this.querySelector('h2').textContent = val;
		}
		
		get parentRow() {
			return this._class('parent-row');
		}
		
		get objectBox() {
			return this._class('object-box');
		}
		
		get deleted() {
			return this._deleted;
		}
		
		set deleted(val) {
			this._deleted = val;
			
			var placeholder = this._class('object-placeholder');
			if (placeholder) {
				placeholder.hidden = !!val;
			}
			else {
				this._class('object-box').hidden = true;
			}
			var deleteBox = this._class('delete-box');
			deleteBox.hidden = !val;
		}
		
		get data() {
			return this._data;
		}

		set data(val) {
			this._data = val;
			
			var button = this._class('choose-button');
			button.label = Zotero.getString('sync.conflict.chooseThisVersion');
			if (this.showButton) {
				button.onclick = this.click.bind(this);
				button.style.visibility = 'visible';
			}
			else {
				button.style.visibility = 'hidden';
			}
			
			if (val.deleted) {
				this.deleted = true;
				return;
			}
			
			this.deleted = false;
			
			// Replace XUL placeholder with XUL object box of given type
			var elementName;
			switch (this.type) {
				case 'item':
					elementName = 'item-box';
					break;
				
				case 'attachment':
				case 'file':
					elementName = 'attachment-box';
					break;
				
				case 'note':
					elementName = 'note-editor';
					break;
				
				case 'annotation':
					elementName = 'div';
					break;
				
				default:
					throw new Error("Object type '" + this.type + "' not supported");
			}
			
			let objbox;
			if (elementName == 'div') {
				objbox = document.createElement(elementName);
			}
			else {
				objbox = document.createXULElement(elementName);
			}
			
			var parentRow = this._class('parent-row');
			if (val.parentItem) {
				parentRow.textContent = '';
				
				let label = document.createElement('span');
				label.textContent = Zotero.getString('pane.item.parentItem');
				parentRow.appendChild(label);
				
				let parentItem = Zotero.Items.getByLibraryAndKey(this.libraryID, val.parentItem);
				let text = document.createTextNode(" " + parentItem.getDisplayTitle(true));
				parentRow.appendChild(text);
				
				parentRow.hidden = false;
			}
			else {
				parentRow.hidden = true;
			}
			
			if (this._class('object-placeholder')) {
				var placeholder = this._class('object-placeholder');
				placeholder.parentNode.replaceChild(objbox, placeholder);
			}
			else {
				let oldObjBox = this.objectBox;
				oldObjBox.parentNode.replaceChild(objbox, oldObjBox);
			}
			
			objbox.className = "object-box";
			objbox.setAttribute("flex", "1");
			objbox.mode = this.type == 'file' ? 'filemerge' : 'merge';
			
			// Keyboard accessibility
			objbox.preventFocus = true;
			if (!this.isMergePane) {
				this.groupbox.setAttribute('tabindex', 0);
				this.groupbox.addEventListener('keypress', (event) => {
					if (event.key == " ") {
						this.click();
					}
				});
			}
			
			// Store JSON
			this._data = val;
			
			// Create a copy of the JSON that we can clean for display, since the remote object
			// might reference things that don't exist locally
			var displayJSON = Object.assign({}, val);
			displayJSON.collections = [];
			
			// Create item from JSON for metadata box
			var item = new Zotero.Item(val.itemType);
			item.libraryID = this.libraryID;
			item.fromJSON(displayJSON);
			
			if (item.isAnnotation()) {
				Zotero.Annotations.toJSON(item)
				.then((data) => {
					Zotero.AnnotationBox.render(objbox, { data });
				});
			}
			else {
				objbox.item = item;
				objbox.render && objbox.render();
				objbox.asyncRender && objbox.asyncRender();
			}
		}
		
		click() {
			this.parent.choosePane(this);
		}
		
		_class(className) {
			return this.querySelector(`.${className}`);
		}
	}
	customElements.define("merge-pane", MergePane);
}
