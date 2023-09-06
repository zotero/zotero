/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
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
	class ItemBox extends XULElement {
		constructor() {
			super();
			
			this.clickable = false;
			this.editable = false;
			this.saveOnEdit = false;
			this.showTypeMenu = false;
			this.hideEmptyFields = false;
			this.clickByRow = false;
			this.clickByItem = false;
			this.preventFocus = false;
			
			this.clickHandler = null;
			this.blurHandler = null;
			this.eventHandlers = [];
			
			this._mode = 'view';
			this._visibleFields = [];
			this._hiddenFields = [];
			this._clickableFields = [];
			this._editableFields = [];
			this._fieldAlternatives = {};
			this._fieldOrder = [];
			this._tabIndexMinCreators = 10;
			this._tabIndexMaxCreators = 0;
			this._tabIndexMinFields = 1000;
			this._tabIndexMaxFields = 0;
			this._initialVisibleCreators = 5;
			
			this.content = MozXULElement.parseXULToFragment(`
				<div id="item-box" xmlns="http://www.w3.org/1999/xhtml">
					<popupset xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">
						<menupopup id="creator-type-menu" position="after_start"/>
						<menupopup id="zotero-field-transform-menu">
							<menuitem id="creator-transform-title-case" label="&zotero.item.textTransform.titlecase;"
								class="menuitem-non-iconic"/>
							<menuitem id="creator-transform-sentence-case" label="&zotero.item.textTransform.sentencecase;"
								class="menuitem-non-iconic"/>
						</menupopup>
						<menupopup id="zotero-creator-transform-menu">
							<menuitem id="creator-transform-swap-names" label="&zotero.item.creatorTransform.nameSwap;"/>
							<menuitem id="creator-transform-capitalize" label="&zotero.item.creatorTransform.fixCase;"/>
						</menupopup>
						<menupopup id="zotero-doi-menu">
							<menuitem id="zotero-doi-menu-view-online" label="&zotero.item.viewOnline;"/>
							<menuitem id="zotero-doi-menu-copy" label="&zotero.item.copyAsURL;"/>
						</menupopup>
						<guidance-panel id="zotero-author-guidance" about="authorMenu" position="after_end" x="-25"/>
					</popupset>
					<div id="retraction-box" hidden="hidden">
						<div id="retraction-header">
							<div id="retraction-header-text"/>
						</div>
						<div id="retraction-details">
							<p id="retraction-date"/>
							
							<dl id="retraction-reasons"/>
							
							<p id="retraction-notice"/>
							
							<div id="retraction-links"/>
							
							<p id="retraction-credit"/>
							<div id="retraction-hide"><button/></div>
						</div>
					</div>
					<table id="info-table">
						<tr>
							<th><label class="key">&zotero.items.itemType;</label></th>
						</tr>
					</table>
				</div>
			`, ['chrome://zotero/locale/zotero.dtd']);
		}
		
		connectedCallback() {
			this._destroyed = false;
			window.addEventListener("unload", this.destroy);
			
			this.appendChild(document.importNode(this.content, true));

			this._creatorTypeMenu.addEventListener('popupshowing', () => {
				var typeBox = document.popupNode.localName == 'th' ? document.popupNode : document.popupNode.parentNode;
				var index = parseInt(typeBox.getAttribute('fieldname').split('-')[1]);
				
				var item = this.item;
				var exists = item.hasCreatorAt(index);
				var moreCreators = item.numCreators() > index + 1;
				
				var hideMoveToTop = !exists || index < 2;
				var hideMoveUp = !exists || index == 0;
				var hideMoveDown = !exists || !moreCreators;
				var hideMoveSep = hideMoveUp && hideMoveDown;
				
				this._id('zotero-creator-move-sep').setAttribute('hidden', hideMoveSep);
				this._id('zotero-creator-move-to-top').setAttribute('hidden', hideMoveToTop);
				this._id('zotero-creator-move-up').setAttribute('hidden', hideMoveUp);
				this._id('zotero-creator-move-down').setAttribute('hidden', hideMoveDown);
			});

			this._creatorTypeMenu.addEventListener('command', async (event) => {
				var typeBox = document.popupNode.localName == 'th' ? document.popupNode : document.popupNode.parentNode;
				var index = parseInt(typeBox.getAttribute('fieldname').split('-')[1]);
				
				if (event.explicitOriginalTarget.className == 'zotero-creator-move') {
					let dir;
					switch (event.explicitOriginalTarget.id) {
						case 'zotero-creator-move-to-top':
							dir = 'top';
							break;
						
						case 'zotero-creator-move-up':
							dir = 'up';
							break;
						
						case 'zotero-creator-move-down':
							dir = 'down';
							break;
					}
					this.moveCreator(index, dir);
					return;
				}
				
				var typeID = event.explicitOriginalTarget.getAttribute('typeid');
				var row = typeBox.parentNode;
				var fields = this.getCreatorFields(row);
				fields.creatorTypeID = typeID;
				typeBox.getElementsByTagName('label')[0].textContent = Zotero.getString(
					'creatorTypes.' + Zotero.CreatorTypes.getName(typeID)
				);
				typeBox.setAttribute('typeid', typeID);
				
				/* If a creator textbox is already open, we need to
				change its autocomplete parameters so that it
				completes on a creator with a different creator type */
				var changedParams = {
					creatorTypeID: typeID
				};
				this._updateAutoCompleteParams(row, changedParams);
				
				this.modifyCreator(index, fields);
				if (this.saveOnEdit) {
					await this.blurOpenField();
					await this.item.saveTx();
				}
			});

			this._id('zotero-field-transform-menu').addEventListener('popupshowing', () => {
				this._id('creator-transform-title-case').disabled = !this.canTextTransformField(document.popupNode, 'title');
				this._id('creator-transform-sentence-case').disabled = !this.canTextTransformField(document.popupNode, 'sentence');
			});

			this._id('creator-transform-title-case').addEventListener('command',
				() => this.textTransformField(document.popupNode, 'title'));
			this._id('creator-transform-sentence-case').addEventListener('command',
				() => this.textTransformField(document.popupNode, 'sentence'));
			
			this._id('zotero-creator-transform-menu').addEventListener('popupshowing', (event) => {
				var row = document.popupNode.closest('tr');
				var typeBox = row.querySelector('.creator-type-label');
				var index = parseInt(typeBox.getAttribute('fieldname').split('-')[1]);
				var item = this.item;
				var exists = item.hasCreatorAt(index);
				if (exists) {
					var fieldMode = item.getCreator(index).name !== undefined ? 1 : 0;
				}
				var hideTransforms = !exists || !!fieldMode;
				if (hideTransforms) {
					event.preventDefault();
				}
			});

			this._id('creator-transform-swap-names').addEventListener('command',
				event => this.swapNames(event));

			this._id('creator-transform-capitalize').addEventListener('command',
				event => this.capitalizeCreatorName(event));
			
			this._doiMenu.addEventListener('popupshowing', () => {
				let disabled = !this._doiMenu.dataset.doi;
				this._id('zotero-doi-menu-view-online').disabled = disabled;
				this._id('zotero-doi-menu-copy').disabled = disabled;
			});
			
			this._id('zotero-doi-menu-view-online').addEventListener(
				'command',
				event => ZoteroPane.loadURI(this._doiMenu.dataset.doi, event)
			);
			this._id('zotero-doi-menu-copy').addEventListener(
				'command',
				() => Zotero.Utilities.Internal.copyTextToClipboard(this._doiMenu.dataset.doi)
			);

			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'itemBox');
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
			// Empty the DOM. We will rebuild if reconnected.
			while (this.lastChild) {
				this.removeChild(this.lastChild);
			}
			this.destroy();
		}
		
		
		//
		// Public properties
		//
		
		// Modes are predefined settings groups for particular tasks
		get mode() {
			return this._mode;
		}
		
		set mode(val) {
			this.clickable = false;
			this.editable = false;
			this.saveOnEdit = false;
			this.showTypeMenu = false;
			this.hideEmptyFields = false;
			this.clickByRow = false;
			this.clickByItem = false;
			
			switch (val) {
				case 'view':
				case 'merge':
					break;
				
				case 'edit':
					this.clickable = true;
					this.editable = true;
					this.saveOnEdit = true;
					this.showTypeMenu = true;
					this.clickHandler = this.showEditor;
					this.blurHandler = this.hideEditor;
					break;
				
				case 'fieldmerge':
					this.hideEmptyFields = true;
					this._fieldAlternatives = {};
					break;
				
				default:
					throw new Error(`Invalid mode '${val}'`);
			}
			
			this._mode = val;
			this.setAttribute('mode', val);
		}
		
		get item() {
			return this._item;
		}
		
		set item(val) {
			if (!(val instanceof Zotero.Item)) {
				throw new Error("'item' must be a Zotero.Item");
			}
			
			// When changing items, reset truncation of creator list
			if (!this._item || val.id != this._item.id) {
				this._displayAllCreators = false;
			}
			
			// If switching items, save the current item first
			// Before fx102, clicking an item in the item tree would send a blur event before ItemBox.item was updated.
			// Now, ItemBox.item is set first, causing us to update this._item and remove the open field before it can
			// receive a blur event and trigger a save.
			if (this._item && val.id != this._item.id) {
				// Not awaiting the blurOpenField() call here is not great practice, but it's unavoidable - setters
				// can't be async and should immediately update their backing fields. Additionally, it matches the old
				// behavior, as the blur event was triggered immediately before the item setter, with the
				// Zotero.Item#saveTx() call continuing in the background.
				this.blurOpenField();
			}
			
			this._item = val;
			this._lastTabIndex = null;
			this.scrollToTop();
			this.refresh();
		}
		
		// .ref is an alias for .item
		get ref() {
			return this._item;
		}
		
		set ref(val) {
			this.item = val;
		}
		
		
		/**
		 * An array of field names that should be shown
		 * even if they're empty and hideEmptyFields is set
		 */
		set visibleFields(val) {
			if (val.constructor.name != 'Array') {
				throw Error('visibleFields must be an array in <itembox>.visibleFields');
			}
			
			this._visibleFields = val;
		}
		
		/**
		 * An array of field names that should be hidden
		*/
		set hiddenFields(val) {
			if (val.constructor.name != 'Array') {
				throw Error('hiddenFields must be an array in <itembox>.visibleFields');
			}
			
			this._hiddenFields = val;
		}
		
		/**
		 * An array of field names that should be clickable
		 * even if this.clickable is false
		 */
		set clickableFields(val) {
			if (val.constructor.name != 'Array') {
				throw Error('clickableFields must be an array in <itembox>.clickableFields');
			}
			
			this._clickableFields = val;
		}
		
		/**
		 * An array of field names that should be editable
		 * even if this.editable is false
		 */
		set editableFields(val) {
			if (val.constructor.name != 'Array') {
				throw Error('editableFields must be an array in <itembox>.editableFields');
			}
			
			this._editableFields = val;
		}
		
		/**
		 * An object of alternative values for keyed fields
		 */
		set fieldAlternatives(val) {
			if (val.constructor.name != 'Object') {
				throw Error('fieldAlternatives must be an Object in <itembox>.fieldAlternatives');
			}
			
			if (this.mode != 'fieldmerge') {
				throw Error('fieldAlternatives is valid only in fieldmerge mode in <itembox>.fieldAlternatives');
			}
			
			this._fieldAlternatives = val;
		}
		
		/**
		 * An array of field names in the order they should appear
		 * in the list; empty spaces can be created with null
		 */
		set fieldOrder(val) {
			if (val.constructor.name != 'Array') {
				throw Error('fieldOrder must be an array in <itembox>.fieldOrder');
			}
			
			this._fieldOrder = val;
		}
		
		get itemTypeMenu() {
			return this._id('item-type-menu');
		}
		
		//
		// Private properties
		//
		get _infoTable() {
			return this._id('info-table');
		}
		
		get _creatorTypeMenu() {
			return this._id('creator-type-menu');
		}
		
		get _defaultFirstName() {
			return '(' + Zotero.getString('pane.item.defaultFirstName') + ')';
		}
		
		get _defaultLastName() {
			return '(' + Zotero.getString('pane.item.defaultLastName') + ')';
		}
		
		get _defaultFullName() {
			return '(' + Zotero.getString('pane.item.defaultFullName') + ')';
		}
		
		get _doiMenu() {
			return this._id('zotero-doi-menu');
		}
		
		
		//
		// Methods
		//
		notify(event, _type, ids) {
			if (event != 'modify' || !this.item || !this.item.id) return;
			for (let i = 0; i < ids.length; i++) {
				let id = ids[i];
				if (id != this.item.id) {
					continue;
				}
				this.refresh();
				break;
			}
		}
		
		refresh() {
			Zotero.debug('Refreshing item box');
			
			if (!this.item) {
				Zotero.debug('No item to refresh', 2);
				return;
			}
			
			this.updateRetracted();
			
			if (this.clickByItem) {
				this.onclick = () => this.clickHandler(this);
			}
			
			// Item type menu
			if (!this.itemTypeMenu) {
				this.addItemTypeMenu();
			}
			if (this.showTypeMenu) {
				this.updateItemTypeMenuSelection();
				this.itemTypeMenu.parentNode.parentNode.style.display = 'contents';
				this.itemTypeMenu.setAttribute('ztabindex', '0');
			}
			else {
				this.itemTypeMenu.parentNode.parentNode.style.display = 'none';
			}

			delete this._doiMenu.dataset.doi;
			
			//
			// Clear and rebuild metadata fields
			//
			while (this._infoTable.childNodes.length > 1) {
				this._infoTable.removeChild(this._infoTable.lastChild);
			}
			
			var fieldNames = [];
			
			// Manual field order
			if (this._fieldOrder.length) {
				for (let field of this._fieldOrder) {
					fieldNames.push(field);
				}
			}
			// Get field order from database
			else {
				if (!this.showTypeMenu) {
					fieldNames.push("itemType");
				}
				
				var fields = Zotero.ItemFields.getItemTypeFields(this.item.getField("itemTypeID"));
				
				for (let i = 0; i < fields.length; i++) {
					fieldNames.push(Zotero.ItemFields.getName(fields[i]));
				}

				if (this.item instanceof Zotero.FeedItem) {
					let row = ZoteroPane.getCollectionTreeRow();
					if (row && row.isFeeds()) {
						fieldNames.unshift("feed");
					}
				}
				else {
					fieldNames.push("dateAdded", "dateModified");
				}
			}

			for (let i = 0; i < fieldNames.length; i++) {
				var fieldName = fieldNames[i];
				var val = '';
				
				if (fieldName) {
					var fieldID = Zotero.ItemFields.getID(fieldName);
					if (fieldID && !Zotero.ItemFields.isValidForType(fieldID, this.item.itemTypeID)) {
						fieldName = null;
					}
				}
				
				if (fieldName) {
					if (this._hiddenFields.indexOf(fieldName) != -1) {
						continue;
					}
					
					// createValueElement() adds the itemTypeID as an attribute
					// and converts it to a localized string for display
					if (fieldName == 'itemType') {
						val = this.item.itemTypeID;
					}
					// Fake "field" in the feeds global view that displays the name
					// of the containing feed
					else if (fieldName == 'feed') {
						val = Zotero.Feeds.get(this.item.libraryID)?.name;
					}
					else {
						val = this.item.getField(fieldName);
					}
					
					if (!val && this.hideEmptyFields
							&& this._visibleFields.indexOf(fieldName) == -1
							&& (this.mode != 'fieldmerge' || typeof this._fieldAlternatives[fieldName] == 'undefined')) {
						continue;
					}
					
					var fieldIsClickable = this._fieldIsClickable(fieldName);
					
					// Start tabindex at 1001 after creators
					var tabindex = fieldIsClickable
						? (i > 0 ? this._tabIndexMinFields + i : 1)
						: 0;
					this._tabIndexMaxFields = Math.max(this._tabIndexMaxFields, tabindex);
					
					if (fieldIsClickable
							&& !Zotero.Items.isPrimaryField(fieldName)
							&& Zotero.ItemFields.isDate(fieldName)
							// TEMP - NSF
							&& fieldName != 'dateSent') {
						this.addDateRow(fieldName, this.item.getField(fieldName, true), tabindex);
						continue;
					}
				}
				
				let th = document.createElement("th");
				th.setAttribute('fieldname', fieldName);
				
				let valueElement = this.createValueElement(
					val, fieldName, tabindex
				);
				
				var prefix = '';
				// Add '(...)' before 'Abstract' for collapsed abstracts
				if (fieldName == 'abstractNote') {
					if (val && !Zotero.Prefs.get('lastAbstractExpand')) {
						prefix = '(\u2026) ';
					}
				}
				
				if (fieldName) {
					let label = document.createElement('label');
					label.className = 'key';
					label.textContent = prefix + Zotero.ItemFields.getLocalizedString(fieldName);
					th.appendChild(label);
				}
				
				// TEMP - NSF (homepage)
				if ((fieldName == 'url' || fieldName == 'homepage')
						// Only make plausible HTTP URLs clickable
						&& Zotero.Utilities.isHTTPURL(val, true)) {
					th.classList.add("pointer");
					// TODO: make getFieldValue non-private and use below instead
					th.addEventListener('click', () => Zotero.launchURL(th.nextSibling.firstChild.value || th.nextSibling.firstChild.textContent));
					th.setAttribute('title', Zotero.getString('pane.item.viewOnline.tooltip'));
				}
				else if (fieldName == 'DOI' && val && typeof val == 'string') {
					// Pull out DOI, in case there's a prefix
					let doi = Zotero.Utilities.cleanDOI(val);
					if (doi) {
						doi = "https://doi.org/"
							// Encode some characters that are technically valid in DOIs,
							// though generally not used. '/' doesn't need to be encoded.
							+ doi.replace(/#/g, '%23')
								.replace(/\?/g, '%3f')
								.replace(/%/g, '%25')
								.replace(/"/g, '%22');
						th.classList.add("pointer");
						th.addEventListener('click', event => ZoteroPane.loadURI(doi, event));
						th.setAttribute('title', Zotero.getString('pane.item.viewOnline.tooltip'));
						this._doiMenu.dataset.doi = doi;
					}
				}
				else if (fieldName == 'abstractNote') {
					if (val.length) {
						th.classList.add("pointer");
					}
					th.addEventListener('click', function () {
						if (this.nextSibling.querySelector('input, textarea')) {
							this.nextSibling.querySelector('input, textarea').blur();
						}
						else {
							this.closest('item-box').toggleAbstractExpand(
								this.firstElementChild, this.closest('tr').querySelector('.value')
							);
						}
					});
				}
				else {
					th.addEventListener('click', function () {
						if (this.nextSibling.querySelector('input, textarea')) {
							this.nextSibling.querySelector('input, textarea').blur();
						}
					});
				}
				
				let td = document.createElement('td');
				td.appendChild(valueElement);
				
				this.addDynamicRow(th, td);
				
				if (fieldName && this._selectField == fieldName) {
					this.showEditor(valueElement);
				}
				
				// In field merge mode, add a button to switch field versions
				else if (this.mode == 'fieldmerge' && typeof this._fieldAlternatives[fieldName] != 'undefined') {
					var button = document.createXULElement("toolbarbutton");
					button.className = 'zotero-field-version-button';
					button.setAttribute('image', 'chrome://zotero/skin/treesource-duplicates.png');
					button.setAttribute('type', 'menu');
					button.setAttribute('wantdropmarker', true);
					
					var popup = button.appendChild(document.createXULElement("menupopup"));
					
					for (let v of this._fieldAlternatives[fieldName]) {
						let menuitem = document.createXULElement("menuitem");
						var sv = Zotero.Utilities.ellipsize(v, 60);
						menuitem.setAttribute('label', sv);
						if (v != sv) {
							menuitem.setAttribute('tooltiptext', v);
						}
						menuitem.setAttribute('fieldName', fieldName);
						menuitem.setAttribute('originalValue', v);
						menuitem.addEventListener('command', () => {
							this.item.setField(
								menuitem.getAttribute('fieldName'),
								menuitem.getAttribute('originalValue')
							);
							this.refresh();
						});
						popup.appendChild(menuitem);
					}
					
					td.appendChild(button);
				}
			}
			this._selectField = false;
			
			//
			// Creators
			//
			
			// Creator type menu
			if (this.editable) {
				while (this._creatorTypeMenu.hasChildNodes()) {
					this._creatorTypeMenu.removeChild(this._creatorTypeMenu.firstChild);
				}
				
				var creatorTypes = Zotero.CreatorTypes.getTypesForItemType(this.item.itemTypeID);
	
				var localized = {};
				for (let i = 0; i < creatorTypes.length; i++) {
					localized[creatorTypes[i].name]
						= Zotero.getString('creatorTypes.' + creatorTypes[i].name);
				}
				
				for (let i in localized) {
					var menuitem = document.createXULElement("menuitem");
					menuitem.setAttribute("label", localized[i]);
					menuitem.setAttribute("typeid", Zotero.CreatorTypes.getID(i));
					this._creatorTypeMenu.appendChild(menuitem);
				}
				
				var moveSep = document.createXULElement("menuseparator");
				var moveToTop = document.createXULElement("menuitem");
				var moveUp = document.createXULElement("menuitem");
				var moveDown = document.createXULElement("menuitem");
				moveSep.id = "zotero-creator-move-sep";
				moveToTop.id = "zotero-creator-move-to-top";
				moveUp.id = "zotero-creator-move-up";
				moveDown.id = "zotero-creator-move-down";
				moveToTop.className = "zotero-creator-move";
				moveUp.className = "zotero-creator-move";
				moveDown.className = "zotero-creator-move";
				moveToTop.setAttribute("label", Zotero.getString('pane.item.creator.moveToTop'));
				moveUp.setAttribute("label", Zotero.getString('pane.item.creator.moveUp'));
				moveDown.setAttribute("label", Zotero.getString('pane.item.creator.moveDown'));
				this._creatorTypeMenu.appendChild(moveSep);
				this._creatorTypeMenu.appendChild(moveToTop);
				this._creatorTypeMenu.appendChild(moveUp);
				this._creatorTypeMenu.appendChild(moveDown);
			}
			
			// Creator rows
			
			// Place, in order of preference, after title, after type,
			// or at beginning
			var titleFieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(this.item.itemTypeID, 'title');
			var field = this._infoTable.querySelector(`[fieldname="${Zotero.ItemFields.getName(titleFieldID)}"]`);
			if (!field) {
				field = this._infoTable.querySelector('[fieldName="itemType"]');
			}
			if (field) {
				this._beforeRow = field.parentNode.nextSibling;
			}
			else {
				this._beforeRow = this._infoTable.firstChild;
			}
			
			this._creatorCount = 0;
			var num = this.item.numCreators();
			if (num > 0) {
				// Limit number of creators display
				var max = Math.min(num, this._initialVisibleCreators);
				// If only 1 or 2 more, just display
				if (num < max + 3 || this._displayAllCreators) {
					max = num;
				}
				for (let i = 0; i < max; i++) {
					let data = this.item.getCreator(i);
					this.addCreatorRow(data, data.creatorTypeID);
					
					// Display "+" button on all but last row
					if (i == max - 2) {
						this.disableCreatorAddButtons();
					}
				}
				
				// Additional creators not displayed
				if (num > max) {
					this.addMoreCreatorsRow(num - max);
					
					this.disableCreatorAddButtons();
				}
				else {
					// If we didn't start with creators truncated,
					// don't truncate for as long as we're viewing
					// this item, so that added creators aren't
					// immediately hidden
					this._displayAllCreators = true;
					
					if (this._addCreatorRow) {
						this.addCreatorRow(false, this.item.getCreator(max - 1).creatorTypeID, true);
						this._addCreatorRow = false;
						this.disableCreatorAddButtons();
					}
				}
			}
			else if (this.editable && Zotero.CreatorTypes.itemTypeHasCreators(this.item.itemTypeID)) {
				// Add default row
				this.addCreatorRow(false, false, true, true);
				this.disableCreatorAddButtons();
			}
			
			// Move to next or previous field if (shift-)tab was pressed
			if (this._lastTabIndex && this._lastTabIndex != -1) {
				this._focusNextField(this._lastTabIndex);
			}
			
			if (this._showCreatorTypeGuidance) {
				let creatorTypeLabels = this.querySelectorAll(".creator-type-label");
				this._id("zotero-author-guidance").show({
					forEl: creatorTypeLabels[creatorTypeLabels.length - 1]
				});
				this._showCreatorTypeGuidance = false;
			}
			
			this._refreshed = true;
		}
		
		addItemTypeMenu() {
			var td = document.createElement('td');
			var menulist = document.createXULElement("menulist", { is: "menulist-item-types" });
			menulist.id = "item-type-menu";
			menulist.className = "zotero-clicky";
			menulist.addEventListener('command', (event) => {
				this.changeTypeTo(event.target.value, menulist);
			});
			menulist.addEventListener('focus', () => {
				this.ensureElementIsVisible(menulist);
			});
			menulist.addEventListener('keypress', (event) => {
				if (event.keyCode == event.DOM_VK_TAB) {
					this.itemTypeMenuTab(event);
				}
			});
			td.appendChild(menulist);
			this._infoTable.firstChild.appendChild(td);
		}
		
		updateItemTypeMenuSelection() {
			this.itemTypeMenu.value = this.item.itemTypeID;
		}
		
		addDynamicRow(label, value, beforeElement) {
			var row = document.createElement("tr");
			
			// Add click event to row
			if (this._rowIsClickable(value.getAttribute('fieldname'))) {
				row.className = 'zotero-clicky';
				row.addEventListener('click', (event) => {
					this.clickHandler(event.target);
				}, false);
			}
			
			row.appendChild(label);
			row.appendChild(value);
			if (beforeElement) {
				this._infoTable.insertBefore(row, this._beforeRow);
			}
			else {
				this._infoTable.appendChild(row);
			}
			
			return row;
		}
		
		addCreatorRow(creatorData, creatorTypeIDOrName, unsaved, defaultRow) {
			// getCreatorFields(), switchCreatorMode() and handleCreatorAutoCompleteSelect()
			// may need need to be adjusted if this DOM structure changes
			
			var fieldMode = Zotero.Prefs.get('lastCreatorFieldMode');
			var firstName = '';
			var lastName = '';
			if (creatorData) {
				fieldMode = creatorData.fieldMode;
				firstName = creatorData.firstName;
				lastName = creatorData.lastName;
			}
			
			// Sub in placeholder text for empty fields
			if (fieldMode == 1) {
				if (lastName === "") {
					lastName = this._defaultFullName;
				}
			}
			else {
				if (firstName === "") {
					firstName = this._defaultFirstName;
				}
				if (lastName === "") {
					lastName = this._defaultLastName;
				}
			}
			
			// Use the first entry in the drop-down for the default type if none specified
			var typeID = creatorTypeIDOrName
				? Zotero.CreatorTypes.getID(creatorTypeIDOrName)
				: this._creatorTypeMenu.childNodes[0].getAttribute('typeid');
			
			var rowIndex = this._creatorCount;
			var tabindex = this._tabIndexMinCreators + ((rowIndex - 1) * 6);
			
			var th = document.createElement("th");
			th.setAttribute("typeid", typeID);
			th.setAttribute("fieldname", 'creator-' + rowIndex + '-typeID');
			if (this.editable) {
				th.className = 'creator-type-label zotero-clicky zotero-focusable';
				let span = document.createElement('span');
				span.className = 'creator-type-dropmarker';
				th.appendChild(span);
				th.setAttribute('ztabindex', tabindex);
				th.setAttribute('role', 'button');
				th.setAttribute('aria-describedby', 'creator-type-label-inner');
				th.addEventListener('click', () => {
					document.popupNode = th;
					this._creatorTypeMenu.openPopup(th);
				});
			}
			else {
				th.className = 'creator-type-label';
			}
			
			var label = document.createElement("label");
			label.setAttribute('id', 'creator-type-label-inner');
			label.className = 'key';
			label.textContent = Zotero.getString('creatorTypes.' + Zotero.CreatorTypes.getName(typeID));
			th.appendChild(label);
			
			var td = document.createElement("td");
			td.className = 'creator-type-value';
			
			// Name
			var firstlast = document.createElement("span");
			firstlast.className = 'creator-name-box';
			
			var fieldName = 'creator-' + rowIndex + '-lastName';
			var lastNameElem = firstlast.appendChild(
				this.createValueElement(
					lastName,
					fieldName,
					tabindex + 1
				)
			);
			
			// Comma
			var comma = document.createElement("span");
			comma.textContent = Zotero.getString('punctuation.comma');
			comma.className = 'comma';
			firstlast.appendChild(comma);
			
			fieldName = 'creator-' + rowIndex + '-firstName';
			firstlast.appendChild(
				this.createValueElement(
					firstName,
					fieldName,
					tabindex + 2
				)
			);
			if (fieldMode > 0) {
				firstlast.lastChild.hidden = true;
			}
			
			if (this.editable) {
				firstlast.oncontextmenu = (event) => {
					document.popupNode = firstlast;
					this._id('creator-transform-swap-names').hidden = fieldMode > 0;
					this._id('creator-transform-capitalize').disabled = !this.canCapitalizeCreatorName(td.parentNode);
					this._id('zotero-creator-transform-menu').openPopupAtScreen(
						event.screenX + 1,
						event.screenY + 1,
						true
					);
				};
			}
			
			this._tabIndexMaxCreators = Math.max(this._tabIndexMaxCreators, tabindex);
			
			td.appendChild(firstlast);
			
			// Single/double field toggle
			var toggleButton = document.createElement('button');
			toggleButton.setAttribute('fieldname',
				'creator-' + rowIndex + '-fieldMode');
			toggleButton.className = 'zotero-field-toggle zotero-clicky zotero-focusable';
			toggleButton.setAttribute('ztabindex', tabindex + 3);
			td.appendChild(toggleButton);
			
			// Minus (-) button
			var removeButton = document.createElement('button');
			removeButton.textContent = "-";
			removeButton.setAttribute("class", "zotero-clicky zotero-clicky-minus zotero-focusable");
			removeButton.setAttribute('ztabindex', tabindex + 4);
			removeButton.setAttribute('aria-label', Zotero.getString('general.delete'));
			// If default first row, don't let user remove it
			if (defaultRow) {
				this.disableButton(removeButton);
			}
			else {
				removeButton.addEventListener("click", () => {
					this.removeCreator(rowIndex, td.parentNode);
				});
			}
			td.appendChild(removeButton);
			
			// Plus (+) button
			var addButton = document.createElement('button');
			addButton.textContent = "+";
			addButton.setAttribute("class", "zotero-clicky zotero-clicky-plus zotero-focusable");
			addButton.setAttribute('ztabindex', tabindex + 5);
			// If row isn't saved, don't let user add more
			if (unsaved) {
				this.disableButton(addButton);
			}
			else {
				this._enablePlusButton(addButton, typeID, fieldMode);
			}
			td.appendChild(addButton);

			if (!this.preventFocus) {
				for (const domEl of [th, toggleButton, removeButton, addButton]) {
					domEl.setAttribute('tabindex', '0');
					domEl.addEventListener('keypress', this.handleKeyPress.bind(this));
					domEl.addEventListener('focusin', this.updateLastFocused.bind(this));
				}
			}
			
			this._creatorCount++;
			
			if (!this.editable) {
				toggleButton.hidden = true;
				removeButton.hidden = true;
				addButton.hidden = true;
			}
			
			this.addDynamicRow(th, td, true);
			
			// Set single/double field toggle mode
			if (fieldMode) {
				this.switchCreatorMode(td.parentNode, 1, true);
			}
			else {
				this.switchCreatorMode(td.parentNode, 0, true);
			}
			
			// Focus new rows
			if (unsaved && !defaultRow) {
				lastNameElem.click();
			}
		}
		
		addMoreCreatorsRow(num) {
			var th = document.createElement('th');
			
			var td = document.createElement('td');
			td.id = 'more-creators-label';
			td.setAttribute('onclick',
				"var binding = this.closest('item-box'); "
				+ "binding._displayAllCreators = true; "
				+ "binding.refresh()"
			);
			td.textContent = Zotero.getString('general.numMore', num);
			
			this.addDynamicRow(th, td, true);
		}
		
		addDateRow(field, value, tabindex) {
			var th = document.createElement("th");
			th.setAttribute("fieldname", field);
			th.setAttribute("onclick", "this.nextSibling.firstChild.blur()");
			var label = document.createElement('label');
			label.className = 'key';
			label.textContent = Zotero.ItemFields.getLocalizedString(field);
			th.appendChild(label);
			
			var td = document.createElement('td');
			td.className = "date-box";
			
			var elem = this.createValueElement(
				Zotero.Date.multipartToStr(value),
				field,
				tabindex
			);
			
			// y-m-d status indicator
			var ymd = document.createElement('span');
			ymd.id = 'zotero-date-field-status';
			ymd.textContent = Zotero.Date.strToDate(Zotero.Date.multipartToStr(value))
					.order.split('').join(' ');
			
			td.appendChild(elem);
			td.appendChild(ymd);
			
			this.addDynamicRow(th, td);
		}
		
		switchCreatorMode(row, fieldMode, initial, updatePref) {
			// Change if button position changes
			var button = row.lastChild.lastChild.previousSibling.previousSibling;
			var creatorNameBox = button.previousSibling;
			var lastName = creatorNameBox.firstChild;
			var comma = creatorNameBox.firstChild.nextSibling;
			var firstName = creatorNameBox.lastChild;
			
			let tab;
			// Switch to single-field mode
			if (fieldMode == 1) {
				button.style.background = `url("chrome://zotero/skin/textfield-dual${Zotero.hiDPISuffix}.png") center/21px auto no-repeat`;
				button.setAttribute('title', Zotero.getString('pane.item.switchFieldMode.two'));
				lastName.setAttribute('fieldMode', '1');
				button.setAttribute('onclick', "this.closest('item-box').switchCreatorMode(this.closest('tr'), 0, false, true)");
				delete lastName.style.width;
				delete lastName.style.maxWidth;
				
				// Remove firstname field from tabindex
				tab = parseInt(firstName.getAttribute('ztabindex'));
				firstName.setAttribute('ztabindex', -1);
				if (this._tabIndexMaxCreators == tab) {
					this._tabIndexMaxCreators--;
				}
				
				// Hide first name field and prepend to last name field
				firstName.hidden = true;
				comma.hidden = true;
				
				if (!initial) {
					var first = this._getFieldValue(firstName);
					if (first && first != this._defaultFirstName) {
						let last = this._getFieldValue(lastName);
						this._setFieldValue(lastName, first + ' ' + last);
					}
				}
				
				if (this._getFieldValue(lastName) == this._defaultLastName) {
					this._setFieldValue(lastName, this._defaultFullName);
				}
				
				// If one of the creator fields is open, leave it open after swap
				let activeField = this._infoTable.querySelector('input');
				if (activeField == firstName || activeField == lastName) {
					this._lastTabIndex = parseInt(lastName.getAttribute('ztabindex'));
					this._tabDirection = false;
				}
			}
			// Switch to two-field mode
			else {
				button.style.background = `url("chrome://zotero/skin/textfield-single${Zotero.hiDPISuffix}.png") center/21px auto no-repeat`;
				button.setAttribute('title', Zotero.getString('pane.item.switchFieldMode.one'));
				lastName.setAttribute('fieldMode', '0');
				button.setAttribute('onclick', "this.closest('item-box').switchCreatorMode(this.closest('tr'), 1, false, true)");
				
				// appropriately truncate lastName
				
				// get item box width
				var computedStyle = window.getComputedStyle(this, null);
				var boxWidth = computedStyle.getPropertyValue('width');
				// get field label width
				computedStyle = window.getComputedStyle(row.firstChild, null);
				var leftHboxWidth = computedStyle.getPropertyValue('width');
				// get last name width
				computedStyle = window.getComputedStyle(lastName, null);
				var lastNameWidth = computedStyle.getPropertyValue('width');
				if (boxWidth.substr(-2) === 'px'
						&& leftHboxWidth.substr(-2) === 'px'
						&& lastNameWidth.substr(-2) === "px") {
					// compute a maximum width
					boxWidth = parseInt(boxWidth);
					leftHboxWidth = parseInt(leftHboxWidth);
					lastNameWidth = parseInt(lastNameWidth);
					var maxWidth = boxWidth - leftHboxWidth - 140;
					if (lastNameWidth > maxWidth) {
						//lastName.style.width = maxWidth+"px";
						//lastName.style.maxWidth = maxWidth+"px";
					}
					else {
						delete lastName.style.width;
						delete lastName.style.maxWidth;
					}
				}
				
				// Add firstname field to tabindex
				tab = parseInt(lastName.getAttribute('ztabindex'));
				firstName.setAttribute('ztabindex', tab + 1);
				if (this._tabIndexMaxCreators == tab) {
					this._tabIndexMaxCreators++;
				}
				
				if (!initial) {
					// Move all but last word to first name field and show it
					let last = this._getFieldValue(lastName);
					if (last && last != this._defaultFullName) {
						var lastNameRE = /(.*?)[ ]*([^ ]+[ ]*)$/;
						var parts = lastNameRE.exec(last);
						if (parts[2] && parts[2] != last) {
							this._setFieldValue(lastName, parts[2]);
							this._setFieldValue(firstName, parts[1]);
						}
					}
				}
				
				if (!this._getFieldValue(firstName)) {
					this._setFieldValue(firstName, this._defaultFirstName);
				}
				
				if (this._getFieldValue(lastName) == this._defaultFullName) {
					this._setFieldValue(lastName, this._defaultLastName);
				}
				
				firstName.hidden = false;
				comma.hidden = false;
			}
			
			// Save the last-used field mode
			if (updatePref) {
				Zotero.debug("Switching lastCreatorFieldMode to " + fieldMode);
				Zotero.Prefs.set('lastCreatorFieldMode', fieldMode);
			}
			
			if (!initial) {
				var index = button.getAttribute('fieldname').split('-')[1];
				var fields = this.getCreatorFields(row);
				fields.fieldMode = fieldMode;
				this.modifyCreator(index, fields);
				if (this.saveOnEdit) {
					let activeField = this._infoTable.querySelector('input, textarea');
					if (activeField !== null && activeField !== firstName && activeField !== lastName) {
						this.blurOpenField();
					}
					else {
						this.item.saveTx();
					}
				}
			}
		}
		
		scrollToTop() {
			this.scrollTop = 0;
		}
		
		ensureElementIsVisible(elem) {
			elem.scrollIntoView({ block: 'nearest' });
		}
		
		async changeTypeTo(itemTypeID, menu) {
			var functionsToRun = [];
			if (this.eventHandlers.itemtypechange && this.eventHandlers.itemtypechange.length) {
				functionsToRun = [...this.eventHandlers.itemtypechange];
			}
			
			if (itemTypeID == this.item.itemTypeID) {
				return true;
			}
			
			if (this.saveOnEdit) {
				await this.blurOpenField();
				await this.item.saveTx();
			}
			
			var fieldsToDelete = this.item.getFieldsNotInType(itemTypeID, true);
			
			// Special cases handled below
			var bookTypeID = Zotero.ItemTypes.getID('book');
			var bookSectionTypeID = Zotero.ItemTypes.getID('bookSection');
			
			// Add warning for shortTitle when moving from book to bookSection
			// when title will be transferred
			if (this.item.itemTypeID == bookTypeID && itemTypeID == bookSectionTypeID) {
				let titleFieldID = Zotero.ItemFields.getID('title');
				let shortTitleFieldID = Zotero.ItemFields.getID('shortTitle');
				if (this.item.getField(titleFieldID) && this.item.getField(shortTitleFieldID)) {
					if (!fieldsToDelete) {
						fieldsToDelete = [];
					}
					fieldsToDelete.push(shortTitleFieldID);
				}
			}
			
			// Generate list of localized field names for display in pop-up
			if (fieldsToDelete) {
				// Ignore warning for bookTitle when going from bookSection to book
				// if there's not also a title, since the book title is transferred
				// to title automatically in Zotero.Item.setType()
				if (this.item.itemTypeID == bookSectionTypeID && itemTypeID == bookTypeID) {
					let titleFieldID = Zotero.ItemFields.getID('title');
					var bookTitleFieldID = Zotero.ItemFields.getID('bookTitle');
					let shortTitleFieldID = Zotero.ItemFields.getID('shortTitle');
					if (this.item.getField(bookTitleFieldID) && !this.item.getField(titleFieldID)) {
						var index = fieldsToDelete.indexOf(bookTitleFieldID);
						fieldsToDelete.splice(index, 1);
						// But warn for short title, which will be removed
						if (this.item.getField(shortTitleFieldID)) {
							fieldsToDelete.push(shortTitleFieldID);
						}
					}
				}
				
				var fieldNames = "";
				for (var i = 0; i < fieldsToDelete.length; i++) {
					fieldNames += "\n - "
						+ Zotero.ItemFields.getLocalizedString(fieldsToDelete[i]);
				}
				
				var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
			}
			
			if (!fieldsToDelete || fieldsToDelete.length == 0
					|| promptService.confirm(null,
						Zotero.getString('pane.item.changeType.title'),
						Zotero.getString('pane.item.changeType.text') + "\n" + fieldNames)) {
				this.item.setType(itemTypeID);
				
				if (this.saveOnEdit) {
					// See note in transformText()
					await this.blurOpenField();
					await this.item.saveTx();
				}
				else {
					this.refresh();
				}
				
				functionsToRun.forEach(f => f.bind(this)());
				
				return true;
			}
			
			// Revert the menu (which changes before the pop-up)
			if (menu) {
				menu.value = this.item.itemTypeID;
			}
			
			return false;
		}
		
		toggleAbstractExpand(label, valueElement) {
			var cur = Zotero.Prefs.get('lastAbstractExpand');
			Zotero.Prefs.set('lastAbstractExpand', !cur);
			
			var valueText = this.item.getField('abstractNote');
			var tabindex = valueElement.getAttribute('ztabindex');
			var newValueElement = this.createValueElement(
				valueText,
				'abstractNote',
				tabindex
			);
			valueElement.replaceWith(newValueElement);
			
			var text = Zotero.ItemFields.getLocalizedString('abstractNote');
			// Add '(...)' before "Abstract" for collapsed abstracts
			if (valueText && cur) {
				text = '(\u2026) ' + text;
			}
			label.textContent = text;
		}
		
		disableButton(button) {
			button.setAttribute('disabled', true);
			button.setAttribute('onclick', false);
		}
		
		_enablePlusButton(button, creatorTypeID, _fieldMode) {
			button.removeAttribute('disabled');
			button.onclick = () => {
				this.disableButton(button);
				this.addCreatorRow(null, creatorTypeID, true);
			};
		}
		
		disableCreatorAddButtons() {
			// Disable the "+" button on all creator rows
			var elems = this._infoTable.getElementsByClassName('zotero-clicky-plus');
			for (let elem of elems) {
				this.disableButton(elem);
			}
		}
		
		createValueElement(valueText, fieldName, tabindex) {
			valueText += '';

			if (fieldName) {
				var fieldID = Zotero.ItemFields.getID(fieldName);
			}
			
			// Allow multiline/long fields to wrap
			var isMultiline = Zotero.ItemFields.isMultiline(fieldName) || Zotero.ItemFields.isLong(fieldName);
			// But treat Abstract as a multiline field only when expanded
			if (fieldName == 'abstractNote') {
				isMultiline &&= Zotero.Prefs.get('lastAbstractExpand');
			}
			
			var valueElement = document.createElement("div");
			
			valueElement.setAttribute('id', `itembox-field-value-${fieldName}`);
			valueElement.className = 'value';
			valueElement.setAttribute('fieldname', fieldName);

			if (this._fieldIsClickable(fieldName)) {
				valueElement.setAttribute('ztabindex', tabindex);
				valueElement.addEventListener('click', (event) => {
					// Skip right-click on Windows
					if (event.button) {
						return;
					}
					this.clickHandler(event.target);
				}, false);
				valueElement.classList.add('zotero-clicky');
			}
			
			switch (fieldName) {
				case 'itemType':
					valueElement.setAttribute('itemTypeID', valueText);
					valueText = Zotero.ItemTypes.getLocalizedString(valueText);
					break;
				
				// Convert dates from UTC
				case 'dateAdded':
				case 'dateModified':
				case 'accessDate':
				case 'date':
				case 'dateSent': // TEMP - NSF
				case 'dateDue':
				case 'accepted':
					if (fieldName == 'date' && this.item._objectType != 'feedItem') {
						break;
					}
					if (valueText) {
						var date = Zotero.Date.sqlToDate(valueText, true);
						if (date) {
							// If no time, interpret as local, not UTC
							if (Zotero.Date.isSQLDate(valueText)) {
								// Add time to avoid showing previous day if date is in
								// DST (including the current date at 00:00:00) and we're
								// in standard time
								date = Zotero.Date.sqlToDate(valueText + ' 12:00:00');
								valueText = date.toLocaleDateString();
							}
							else {
								valueText = date.toLocaleString();
							}
						}
						else {
							valueText = '';
						}
					}
					break;
			}
			
			if (fieldID) {
				// Display the SQL date as a tooltip for date fields
				// TEMP - filingDate
				if (Zotero.ItemFields.isFieldOfBase(fieldID, 'date') || fieldName == 'filingDate') {
					valueElement.setAttribute('title',
						Zotero.Date.multipartToSQL(this.item.getField(fieldName, true)));
				}
				
				// Display a context menu for certain fields
				if (this.editable && (fieldName == 'seriesTitle' || fieldName == 'shortTitle'
						|| Zotero.ItemFields.isFieldOfBase(fieldID, 'title')
						|| Zotero.ItemFields.isFieldOfBase(fieldID, 'publicationTitle'))) {
					valueElement.setAttribute('context', 'zotero-field-transform-menu');
					valueElement.oncontextmenu = (event) => {
						document.popupNode = valueElement;
						this._id('zotero-field-transform-menu').openPopupAtScreen(
							event.screenX + 1,
							event.screenY + 1,
							true
						);
					};
				}
			}
			
			// Add popup menu on DOI field with value
			if (fieldName == 'DOI' && valueText) {
				valueElement.oncontextmenu = (event) => {
					this._id('zotero-doi-menu').openPopupAtScreen(
						event.screenX + 1,
						event.screenY + 1,
						true
					);
				};
			}
			
			valueElement.textContent = valueText;

			// Attempt to make bidi things work automatically:
			// If we have text to work off of, let the layout engine try to guess the text direction
			if (valueText) {
				valueElement.dir = 'auto';
			}
			// If not, assume it follows the locale's direction
			else {
				valueElement.dir = Zotero.dir;
			}
			
			// Regardless, align the text in the label consistently, following the locale's direction
			if (Zotero.rtl) {
				valueElement.style.textAlign = 'right';
			}
			else {
				valueElement.style.textAlign = 'left';
			}

			if (isMultiline) {
				valueElement.classList.add('multiline');
			}
			
			// Allow toggling non-editable Abstract open and closed with click
			if (fieldName == 'abstractNote' && !this.editable) {
				valueElement.classList.add("pointer");
				valueElement.addEventListener('click', () => {
					let label = valueElement.parentElement.previousElementSibling.firstElementChild;
					this.toggleAbstractExpand(label, valueElement);
				});
			}
			
			return valueElement;
		}
		
		async removeCreator(index, labelToDelete) {
			// If unsaved row, just remove element
			if (!this.item.hasCreatorAt(index)) {
				labelToDelete.parentNode.removeChild(labelToDelete);
				
				// Enable the "+" button on the previous row
				var elems = this._infoTable.getElementsByClassName('zotero-clicky-plus');
				var button = elems[elems.length - 1];
				var creatorFields = this.getCreatorFields(button.closest('tr'));
				this._enablePlusButton(button, creatorFields.creatorTypeID, creatorFields.fieldMode);
				
				this._creatorCount--;
				return;
			}
			await this.blurOpenField();
			this.item.removeCreator(index);
			await this.item.saveTx();
		}
		
		async showEditor(elem) {
			Zotero.debug(`Showing editor for ${elem.getAttribute('fieldname')}`);
			
			var label = elem.closest('tr').querySelector('th > label');
			var lastTabIndex = this._lastTabIndex = parseInt(elem.getAttribute('ztabindex'));
			
			// If a field is open, hide it before selecting the new field, which might
			// trigger a refresh
			var activeField = this._infoTable.querySelector('input, textarea');
			if (activeField) {
				this._refreshed = false;
				await this.blurOpenField();
				this._lastTabIndex = lastTabIndex;
				// If the box was refreshed, the clicked element is no longer valid,
				// so just focus by tab index
				if (this._refreshed) {
					this._focusNextField(this._lastTabIndex);
					return;
				}
			}
			
			var fieldName = elem.getAttribute('fieldname');
			var tabindex = elem.getAttribute('ztabindex');
			
			var [field, creatorIndex, creatorField] = fieldName.split('-');
			let value, itemID;
			if (field == 'creator') {
				value = this.item.getCreator(creatorIndex)[creatorField];
				if (value === undefined) {
					value = "";
				}
				itemID = this.item.id;
			}
			else {
				value = this.item.getField(fieldName);
				itemID = this.item.id;
				
				// Access date needs to be converted from UTC
				if (value != '') {
					let localDate;
					switch (fieldName) {
						case 'accessDate':
						case 'dateSent': // TEMP - NSF
						case 'dateDue':
						case 'accepted':
							// If no time, interpret as local, not UTC
							if (Zotero.Date.isSQLDate(value)) {
								localDate = Zotero.Date.sqlToDate(value);
							}
							else {
								localDate = Zotero.Date.sqlToDate(value, true);
							}
							value = Zotero.Date.dateToSQL(localDate);
							
							// Don't show time in editor
							value = value.replace(' 00:00:00', '');
							break;
					}
				}
			}
			
			var t;
			if (Zotero.ItemFields.isMultiline(fieldName) || Zotero.ItemFields.isLong(fieldName)) {
				t = document.createElement("textarea");
			}
			// Add auto-complete for certain fields
			else if (field == 'creator' || Zotero.ItemFields.isAutocompleteField(fieldName)) {
				t = document.createElement("input", { is: 'shadow-autocomplete-input' });
				t.setAttribute('autocompletesearch', 'zotero');
				
				let params = {
					fieldName: fieldName,
					libraryID: this.item.libraryID
				};
				if (field == 'creator') {
					params.fieldMode = parseInt(elem.getAttribute('fieldMode'));
					
					// Include itemID and creatorTypeID so the autocomplete can
					// avoid showing results for creators already set on the item
					let row = elem.closest('tr');
					let creatorTypeID = parseInt(
						row.getElementsByClassName('creator-type-label')[0]
						.getAttribute('typeid')
					);
					if (itemID) {
						params.itemID = itemID;
						params.creatorTypeID = creatorTypeID;
					}
					
					// Return/click
					// Monkey-patching onTextEntered is apparently the current official way to detect completion --
					// there's also a custom event called textEntered, but it won't be fired unless the input has its
					// 'notifylegacyevents' attribute set to true
					// https://searchfox.org/mozilla-central/rev/2d678a843ceab81e43f7ffb83212197dc10e944a/toolkit/content/widgets/autocomplete-input.js#372
					// https://searchfox.org/mozilla-central/rev/2d678a843ceab81e43f7ffb83212197dc10e944a/browser/components/search/content/searchbar.js#791
					t.onTextEntered = () => {
						this.handleCreatorAutoCompleteSelect(t, true);
					};
					// Tab/Shift-Tab
					t.addEventListener('change', () => {
						this.handleCreatorAutoCompleteSelect(t, true);
					});
					
					if (creatorField == 'lastName') {
						t.setAttribute('fieldMode', elem.getAttribute('fieldMode'));
						t.addEventListener('paste', (event) => {
							let lastName = event.clipboardData.getData('text').trim();
							// Handle \n\r and \n delimited entries and a single line containing a tab
							var rawNameArray = lastName.split(/\r\n?|\n/);
							if (rawNameArray.length > 1 || rawNameArray[0].includes('\t')) {
								// Pasting multiple authors; first make sure we prevent normal paste behavior
								event.preventDefault();
								
								// Save tab direction and add creator flags since they are reset in the
								// process of adding multiple authors
								var tabDirectionBuffer = this._tabDirection;
								var addCreatorRowBuffer = this._addCreatorRow;
								var tabIndexBuffer = this._lastTabIndex;
								this._tabDirection = false;
								this._addCreatorRow = false;

								// Filter out bad names
								var nameArray = rawNameArray.filter(name => name);

								// If not adding names at the end of the creator list, make new creator
								// entries and then shift down existing creators.
								var initNumCreators = this.item.numCreators();
								var creatorsToShift = initNumCreators - creatorIndex;
								if (creatorsToShift > 0) {
									// Add extra creators with dummy values
									for (let i = 0; i < nameArray.length; i++) {
										this.modifyCreator(i + initNumCreators, {
											firstName: '',
											lastName: '',
											fieldMode: 0,
											creatorTypeID
										});
									}

									// Shift existing creators
									for (let i = initNumCreators - 1; i >= creatorIndex; i--) {
										let shiftedCreatorData = this.item.getCreator(i);
										this.item.setCreator(nameArray.length + i, shiftedCreatorData);
									}
								}

								let currentIndex = creatorIndex;
								let newCreator = { creatorTypeID };
								// Add the creators in lastNameArray one at a time
								for (let tempName of nameArray) {
									// Check for tab to determine creator name format
									newCreator.fieldMode = (tempName.indexOf('\t') == -1) ? 1 : 0;
									if (newCreator.fieldMode == 0) {
										newCreator.lastName = tempName.split('\t')[0];
										newCreator.firstName = tempName.split('\t')[1];
									}
									else {
										newCreator.lastName = tempName;
										newCreator.firstName = '';
									}
									this.modifyCreator(currentIndex, newCreator);
									currentIndex++;
								}
								this._tabDirection = tabDirectionBuffer;
								this._addCreatorRow = (creatorsToShift == 0) ? addCreatorRowBuffer : false;
								if (this._tabDirection == 1) {
									this._lastTabIndex = tabIndexBuffer + 2 * (nameArray.length - 1);
									if (newCreator.fieldMode == 0) {
										this._lastTabIndex++;
									}
								}
								
								if (this.saveOnEdit) {
									this.item.saveTx();
								}
							}
						});
					}
				}
				t.setAttribute(
					'autocompletesearchparam', JSON.stringify(params)
				);
				t.setAttribute('completeselectedindex', true);
			}
			
			if (!t) {
				t = document.createElement("input");
			}

			t.id = `itembox-field-textbox-${fieldName}`;
			t.value = value;
			t.dataset.originalValue = value;
			t.style.mozBoxFlex = 1;
			t.setAttribute('fieldname', fieldName);
			t.setAttribute('ztabindex', tabindex);
			// We set dir in createValueElement(), so figure out what it was computed as
			// and then propagate to the new text field
			t.dir = getComputedStyle(elem).direction;

			var box = elem.parentNode;
			box.replaceChild(t, elem);
			
			// Associate textbox with label
			label.setAttribute('control', t.getAttribute('id'));
			
			// Prevent error when clicking between a changed field
			// and another -- there's probably a better way
			if (!t.select) {
				return;
			}
			
			t.select();
			
			// Leave text field open when window loses focus
			var ignoreBlur = () => {
				this.ignoreBlur = true;
			};
			var unignoreBlur = () => {
				this.ignoreBlur = false;
			};
			addEventListener("deactivate", ignoreBlur);
			addEventListener("activate", unignoreBlur);
			
			t.addEventListener('blur', () => {
				if (this.ignoreBlur) return;
				
				removeEventListener("deactivate", ignoreBlur);
				removeEventListener("activate", unignoreBlur);
				this.blurHandler(t);
			});
			t.addEventListener('keypress', event => this.handleKeyPress(event));
			
			if (t instanceof HTMLTextAreaElement) {
				let updateHeight = () => {
					// Reset height before getting scrollHeight
					// Prevents field from growing slightly each time
					// https://stackoverflow.com/a/58073583
					t.style.height = 'auto';
					t.style.height = `calc(max(6em, ${t.scrollHeight}px))`;
				};
				t.addEventListener('input', updateHeight);
				updateHeight();
			}
		}
		
		
		/**
		 * Save a multiple-field selection for the creator autocomplete
		 * (e.g. "Shakespeare, William")
		 */
		handleCreatorAutoCompleteSelect(textbox, stayFocused) {
			var controller = textbox.controller;
			if (!controller.matchCount) return;
			
			var id = false;
			for (let i = 0; i < controller.matchCount; i++) {
				if (controller.getCommentAt(i) == textbox.value) {
					id = controller.getLabelAt(i);
					break;
				}
			}
			
			// No result selected
			if (!id) {
				return;
			}
			
			var [creatorID, numFields] = id.split('-');
			
			// If result uses two fields, save both
			if (numFields == 2) {
				// Manually clear autocomplete controller's reference to
				// textbox to prevent error next time around
				textbox.mController.input = null;
				
				var [_field, creatorIndex, creatorField]
					= textbox.getAttribute('fieldname').split('-');
				
				if (stayFocused) {
					this._lastTabIndex = parseInt(textbox.getAttribute('ztabindex'));
					this._tabDirection = false;
				}
				
				var creator = Zotero.Creators.get(creatorID);
				
				var otherField = creatorField == 'lastName' ? 'firstName' : 'lastName';
				
				// Update this textbox
				textbox.setAttribute('value', creator[creatorField]);
				textbox.value = creator[creatorField];
				
				// Update the other label
				let label;
				if (otherField == 'firstName') {
					label = textbox.nextSibling.nextSibling;
				}
				else if (otherField == 'lastName') {
					label = textbox.previousSibling.previousSibling;
				}
				
				//this._setFieldValue(label, creator[otherField]);
				if (label.firstChild) {
					label.firstChild.nodeValue = creator[otherField];
				}
				else {
					label.value = creator[otherField];
				}
				
				var row = textbox.closest('tr');
				
				var fields = this.getCreatorFields(row);
				fields[creatorField] = creator[creatorField];
				fields[otherField] = creator[otherField];
				
				this.modifyCreator(creatorIndex, fields);
				if (this.saveOnEdit) {
					this.ignoreBlur = true;
					this.item.saveTx().then(() => {
						this.ignoreBlur = false;
					});
				}
			}
			
			// Otherwise let the autocomplete popup handle matters
		}
		
		handleKeyPress(event) {
			var target = event.target;
			var focused = document.commandDispatcher.focusedElement;

			if ((event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === ' ')
				&& target.classList.contains('creator-type-label')) {
				event.preventDefault();
				target.click();

				setTimeout(() => {
					this._creatorTypeMenu.dispatchEvent(
						new KeyboardEvent("keydown", { key: 'ArrowDown', keyCode: 40, charCode: 0 })
					);
				}, 0);
				return;
			}

			let tree;
			switch (event.keyCode) {
				case event.DOM_VK_RETURN:
					var fieldname = target.getAttribute('fieldname');
					// Use shift-enter as the save action for the larger fields
					if (Zotero.ItemFields.isMultiline(fieldname) && !event.shiftKey) {
						return;
					}

					if (target.classList.contains('zotero-focusable')) {
						event.preventDefault();
						return;
					}
					
					// Prevent blur on containing textbox
					// DEBUG: what happens if this isn't present?
					event.preventDefault();
					
					// Shift-enter adds new creator row
					if (fieldname.indexOf('creator-') == 0 && event.shiftKey) {
						// Value hasn't changed
						if (target.dataset.originalValue == target.value) {
							Zotero.debug("Value hasn't changed");
							// If + button is disabled, just focus next creator row
							if (target.closest('tr').lastChild.lastChild.disabled) {
								this._focusNextField(this._lastTabIndex);
							}
							else {
								var creatorFields = this.getCreatorFields(target.closest('tr'));
								this.addCreatorRow(false, creatorFields.creatorTypeID, true);
							}
						}
						// Value has changed
						else {
							this._tabDirection = 1;
							this._addCreatorRow = true;
							focused.blur();
						}
						return;
					}
					focused.blur();
					
					// Return focus to items pane
					tree = document.getElementById('zotero-items-tree');
					if (tree) {
						tree.focus();
					}
					
					return;
					
				case event.DOM_VK_ESCAPE:
					// Reset field to original value
					target.value = target.dataset.originalValue;
					
					focused.blur();
					
					// Return focus to items pane
					tree = document.getElementById('zotero-items-tree');
					if (tree) {
						tree.focus();
					}
					
					return;
					
				case event.DOM_VK_TAB:
					event.preventDefault();
					if (event.shiftKey) {
						this._focusNextField(this._lastTabIndex, true);
					}
					else {
						// If on the last field, allow default tab action
						if (this._lastTabIndex == this._tabIndexMaxFields) {
							return;
						}
						this._focusNextField(++this._lastTabIndex);
					}
			}
		}
		
		itemTypeMenuTab(event) {
			if (!event.shiftKey) {
				this.focusFirstField();
				event.preventDefault();
			}
			// Shift-tab
			else {
				this._tabDirection = false;
			}
		}
		
		async hideEditor(textbox) {
			// Handle cases where creator autocomplete doesn't trigger
			// the textentered and change events handled in showEditor
			if (textbox.getAttribute('fieldname').startsWith('creator-')) {
				this.handleCreatorAutoCompleteSelect(textbox);
			}
			
			Zotero.debug(`Hiding editor for ${textbox.getAttribute('fieldname')}`);
			
			var label = textbox.closest('tr').querySelector('th > label');
			this._lastTabIndex = -1;
			
			// Prevent autocomplete breakage in Firefox 3
			if (textbox.mController) {
				textbox.mController.input = null;
			}
			
			var fieldName = textbox.getAttribute('fieldname');
			var tabindex = textbox.getAttribute('ztabindex');
			
			//var value = t.value;
			var value = textbox.value.trim();
			
			var elem;
			var [field, creatorIndex, creatorField] = fieldName.split('-');
			var newVal;
			
			// Creator fields
			if (field == 'creator') {
				var row = textbox.closest('tr');
				
				var otherFields = this.getCreatorFields(row);
				otherFields[creatorField] = value;
				this.modifyCreator(creatorIndex, otherFields);
				
				var val = this.item.getCreator(creatorIndex);
				val = val ? val[creatorField] : null;
				
				if (!val) {
					// Reset to '(first)'/'(last)'/'(name)'
					if (creatorField == 'lastName') {
						val = otherFields.fieldMode
							? this._defaultFullName
							: this._defaultLastName;
					}
					else if (creatorField == 'firstName') {
						val = this._defaultFirstName;
					}
				}
				
				newVal = val;
				
				if (Zotero.ItemTypes.getName(this.item.itemTypeID) === "bookSection") {
					this._showCreatorTypeGuidance = true;
				}
			}
			
			// Fields
			else {
				// Access date needs to be parsed and converted to UTC SQL date
				if (value != '') {
					switch (fieldName) {
						case 'accessDate':
							// Parse 'yesterday'/'today'/'tomorrow'
							value = Zotero.Date.parseDescriptiveString(value);
							
							// Allow "now" to use current time
							if (value == 'now') {
								value = Zotero.Date.dateToSQL(new Date(), true);
							}
							// If just date, don't convert to UTC
							else if (Zotero.Date.isSQLDate(value)) {
								let localDate = Zotero.Date.sqlToDate(value);
								value = Zotero.Date.dateToSQL(localDate).replace(' 00:00:00', '');
							}
							else if (Zotero.Date.isSQLDateTime(value)) {
								let localDate = Zotero.Date.sqlToDate(value);
								value = Zotero.Date.dateToSQL(localDate, true);
							}
							else {
								let d = Zotero.Date.strToDate(value);
								value = null;
								if (d.year && d.month != undefined && d.day) {
									d = new Date(d.year, d.month, d.day);
									value = Zotero.Date.dateToSQL(d).replace(' 00:00:00', '');
								}
							}
							break;
						
						// TEMP - NSF
						case 'dateSent':
						case 'dateDue':
						case 'accepted':
							if (Zotero.Date.isSQLDate(value)) {
								let localDate = Zotero.Date.sqlToDate(value);
								value = Zotero.Date.dateToSQL(localDate).replace(' 00:00:00', '');
							}
							else {
								let d = Zotero.Date.strToDate(value);
								value = null;
								if (d.year && d.month != undefined && d.day) {
									d = new Date(d.year, d.month, d.day);
									value = Zotero.Date.dateToSQL(d).replace(' 00:00:00', '');
								}
							}
							break;
						
						default:
							// TODO: generalize to all date rows/fields
							if (Zotero.ItemFields.isFieldOfBase(fieldName, 'date')) {
								// Parse 'yesterday'/'today'/'tomorrow'
								value = Zotero.Date.parseDescriptiveString(value);
							}
					}
				}
				
				this._modifyField(fieldName, value);
				newVal = this.item.getField(fieldName);
			}
			
			// Close box
			elem = this.createValueElement(
				newVal,
				fieldName,
				tabindex
			);
			textbox.replaceWith(elem);
			
			// Disassociate textbox from label
			label.setAttribute('control', elem.getAttribute('id'));
			
			if (field == 'creator') {
				// Set correct flex settings and fieldMode attribute
				this.switchCreatorMode(row, (otherFields.fieldMode ? 1 : 0), true);
			}
			
			if (this.saveOnEdit) {
				await this.item.saveTx();
			}
		}
		
		_rowIsClickable(fieldName) {
			return this.clickByRow
					&& (this.clickable
						|| this._clickableFields.indexOf(fieldName) != -1);
		}
		
		_fieldIsClickable(fieldName) {
			return !this.clickByRow
					&& ((this.clickable && !Zotero.Items.isPrimaryField(fieldName))
					|| this._clickableFields.indexOf(fieldName) != -1);
		}
		
		_modifyField(field, value) {
			this.item.setField(field, value);
		}
		
		_getFieldValue(label) {
			return label.firstChild?.nodeValue
				|| label.value
				|| label.textContent;
		}
		
		_setFieldValue(label, value) {
			if (label.firstChild) {
				label.firstChild.nodeValue = value;
			}
			else if (label instanceof HTMLInputElement || label instanceof HTMLTextAreaElement) {
				label.value = value;
			}
			else {
				label.textContent = value;
			}
		}
		
		textTransformString(val, mode) {
			switch (mode) {
				case 'title':
					return Zotero.Utilities.capitalizeTitle(val.toLowerCase(), true);
				case 'sentence':
					return Zotero.Utilities.sentenceCase(val);
				default:
					throw new Error("Invalid transform mode '" + mode + "' in ItemBox.textTransformString()");
			}
		}
		
		canTextTransformField(label, mode) {
			let val = this._getFieldValue(label);
			return this.textTransformString(val, mode) != val;
		}
		
		/**
		 * TODO: work with textboxes too
		 */
		async textTransformField(label, mode) {
			var val = this._getFieldValue(label);
			var newVal = this.textTransformString(val, mode);
			this._setFieldValue(label, newVal);
			var fieldName = label.getAttribute('fieldname');
			this._modifyField(fieldName, newVal);
			
			// If this is a title field, convert the Short Title too
			var isTitle = Zotero.ItemFields.getBaseIDFromTypeAndField(
				this.item.itemTypeID, fieldName) == Zotero.ItemFields.getID('title');
			var shortTitleVal = this.item.getField('shortTitle');
			if (isTitle && newVal.toLowerCase().startsWith(shortTitleVal.toLowerCase())) {
				this._modifyField('shortTitle', newVal.substr(0, shortTitleVal.length));
			}
			
			if (this.saveOnEdit) {
				// If a field is open, blur it, which will trigger a save and cause
				// the saveTx() to be a no-op
				await this.blurOpenField();
				await this.item.saveTx();
			}
		}
		
		getCreatorFields(row) {
			var typeID = row.getElementsByClassName('creator-type-label')[0].getAttribute('typeid');
			var label1 = row.getElementsByClassName('creator-name-box')[0].firstChild;
			var label2 = label1.parentNode.lastChild;
			
			var fields = {
				lastName: label1.firstChild ? label1.firstChild.nodeValue : label1.value,
				firstName: label2.firstChild ? label2.firstChild.nodeValue : label2.value,
				fieldMode: label1.getAttribute('fieldMode')
					? parseInt(label1.getAttribute('fieldMode'))
					: 0,
				creatorTypeID: parseInt(typeID),
			};
			
			// Ignore '(first)'
			if (fields.fieldMode == 1 || fields.firstName == this._defaultFirstName) {
				fields.firstName = '';
			}
			// Ignore '(last)' or '(name)'
			if (fields.lastName == this._defaultFullName
					|| fields.lastName == this._defaultLastName) {
				fields.lastName = '';
			}
			
			return fields;
		}
		
		modifyCreator(index, fields) {
			var firstName = fields.firstName;
			var lastName = fields.lastName;
			
			var oldCreator = this.item.getCreator(index);
			
			// Don't save empty creators
			if (!firstName && !lastName) {
				if (!oldCreator) {
					return false;
				}
				return this.item.removeCreator(index);
			}
			
			return this.item.setCreator(index, fields);
		}
		
		/**
		 * @return {Promise}
		 */
		async swapNames(_event) {
			var row = document.popupNode.closest('tr');
			var typeBox = row.querySelector('.creator-type-label');
			var creatorIndex = parseInt(typeBox.getAttribute('fieldname').split('-')[1]);
			var fields = this.getCreatorFields(row);
			var lastName = fields.lastName;
			var firstName = fields.firstName;
			fields.lastName = firstName;
			fields.firstName = lastName;
			this.modifyCreator(creatorIndex, fields);
			if (this.saveOnEdit) {
				// See note in transformText()
				await this.blurOpenField();
				await this.item.saveTx();
			}
		}
		
		canCapitalizeCreatorName(row) {
			var fields = this.getCreatorFields(row);
			return fields.firstName && Zotero.Utilities.capitalizeName(fields.firstName) != fields.firstName
				|| fields.lastName && Zotero.Utilities.capitalizeName(fields.lastName) != fields.lastName;
		}

		/**
		 * @return {Promise}
		 */
		async capitalizeCreatorName(_event) {
			var row = document.popupNode.closest('tr');
			var typeBox = row.querySelector('.creator-type-label');
			var creatorIndex = parseInt(typeBox.getAttribute('fieldname').split('-')[1]);
			var fields = this.getCreatorFields(row);
			fields.firstName = fields.firstName && Zotero.Utilities.capitalizeName(fields.firstName);
			fields.lastName = fields.lastName && Zotero.Utilities.capitalizeName(fields.lastName);
			this.modifyCreator(creatorIndex, fields);
			if (this.saveOnEdit) {
				// See note in transformText()
				await this.blurOpenField();
				await this.item.saveTx();
			}
		}
		
		/**
		 * @return {Promise}
		 */
		moveCreator(index, dir) {
			return Zotero.spawn(function* () {
				yield this.blurOpenField();
				if (index == 0 && dir == 'up') {
					Zotero.debug("Can't move up creator 0");
					return;
				}
				else if (index + 1 == this.item.numCreators() && dir == 'down') {
					Zotero.debug("Can't move down last creator");
					return;
				}
				
				var newIndex;
				switch (dir) {
					case 'top':
						newIndex = 0;
						break;
					
					case 'up':
						newIndex = index - 1;
						break;
					
					case 'down':
						newIndex = index + 1;
						break;
				}
				let creator = this.item.getCreator(index);
				// When moving to top, increment index of all other creators
				if (dir == 'top') {
					let otherCreators = this.item.getCreators();
					this.item.setCreator(newIndex, creator);
					for (let i = 0; i < index; i++) {
						this.item.setCreator(i + 1, otherCreators[i]);
					}
				}
				// When moving up or down, swap places with next creator
				else {
					let otherCreator = this.item.getCreator(newIndex);
					this.item.setCreator(newIndex, creator);
					this.item.setCreator(index, otherCreator);
				}
				if (this.saveOnEdit) {
					this.item.saveTx();
				}
			}, this);
		}
		
		_updateAutoCompleteParams(row, changedParams) {
			var textboxes = row.querySelectorAll('input');
			if (textboxes.length) {
				var t = textboxes[0];
				var params = JSON.parse(t.getAttribute('autocompletesearchparam'));
				for (var param in changedParams) {
					params[param] = changedParams[param];
				}
				t.setAttribute('autocompletesearchparam', JSON.stringify(params));
			}
		}
		
		focusFirstField() {
			this._focusNextField(1);
		}

		focusLastField() {
			const tabbableFields = this.querySelectorAll('*[ztabindex]:not([disabled=true])');
			const last = tabbableFields[tabbableFields.length - 1];

			if (last.classList.contains('zotero-focusable')) {
				last.focus();
			}
			// Fields need to be clicked
			else {
				last.click();
			}
		}
		
		focusField(fieldName) {
			let field = this.querySelector(`[fieldname="${fieldName}"][ztabindex]`);
			if (!field) return false;
			return this._focusNextField(field.getAttribute('ztabindex'));
		}
		
		/**
		 * Advance the field focus forward or backward
		 *
		 * Note: We're basically replicating the built-in tabindex functionality,
		 * which doesn't work well with the weird label/textbox stuff we're doing.
		 * (The textbox being tabbed away from is deleted before the blur()
		 * completes, so it doesn't know where it's supposed to go next.)
		 */
		_focusNextField(tabindex, back) {
			var box = this._infoTable;
			tabindex = parseInt(tabindex);
			
			// Get all fields with ztabindex attributes
			var tabbableFields = box.querySelectorAll('*[ztabindex]:not([disabled=true])');
			
			if (!tabbableFields.length) {
				Zotero.debug("No tabbable fields found");
				return false;
			}
			
			var next;
			if (back) {
				Zotero.debug('Looking for previous tabindex before ' + tabindex, 4);
				for (let i = tabbableFields.length - 1; i >= 0; i--) {
					let field = tabbableFields[i];
					let tabIndexHere = parseInt(field.getAttribute('ztabindex'));
					if (tabIndexHere !== -1 && tabIndexHere < tabindex) {
						next = tabbableFields[i];
						break;
					}
				}
			}
			else {
				Zotero.debug('Looking for tabindex ' + tabindex, 4);
				for (var pos = 0; pos < tabbableFields.length; pos++) {
					let field = tabbableFields[pos];
					let tabIndexHere = parseInt(field.getAttribute('ztabindex'));
					if (tabIndexHere !== -1 && tabIndexHere >= tabindex) {
						next = tabbableFields[pos];
						break;
					}
				}
			}
			if (!next) {
				Zotero.debug("Next field not found");
				return false;
			}
			
			// Drop-down and creator buttons need to be focused
			if (next.id == 'item-type-menu' || next.classList.contains('zotero-focusable')) {
				next.focus();
			}
			// Fields need to be clicked
			else {
				next.click();
			}
			
			// 1) next.parentNode is always null for some reason
			// 2) For some reason it's necessary to scroll to the next element when
			// moving forward for the target element to be fully in view
			let visElem;
			if (!back && tabbableFields[pos + 1]) {
				Zotero.debug("Scrolling to next field");
				visElem = tabbableFields[pos + 1];
			}
			else {
				visElem = next;
			}
			this.ensureElementIsVisible(visElem);
			
			return true;
		}

		updateLastFocused(ev) {
			if (ev.target.classList.contains('zotero-focusable')) {
				this._lastTabIndex = parseInt(ev.target.getAttribute('ztabindex'));
			}
		}
		
		async blurOpenField() {
			var activeField = this._infoTable.querySelector('input, textarea');
			if (!activeField) {
				return false;
			}
			return this.blurHandler(activeField);
		}
		
		/**
		 * Available handlers:
		 *
		 *   - 'itemtypechange'
		 *
		 * Note: 'this' in the function will be bound to the item box.
		 */
		addHandler(eventName, func) {
			if (!this.eventHandlers[eventName]) {
				this.eventHandlers[eventName] = [];
			}
			this.eventHandlers[eventName].push(func);
		}
		
		removeHandler(eventName, func) {
			if (!this.eventHandlers[eventName]) {
				return;
			}
			var pos = this.eventHandlers[eventName].indexOf(func);
			if (pos != -1) {
				this.eventHandlers[eventName].splice(pos, 1);
			}
		}
		
		updateRetracted() {
			// Create the real function here so we can use Zotero.serial(). updateRetracted()
			// isn't awaited in refresh(), so we want to make sure successive invocations
			// don't overlap.
			if (!this._updateRetracted) {
				this._updateRetracted = Zotero.serial(async function (item) {
					var show = Zotero.Retractions.isRetracted(item);
					if (!show) {
						this._id('retraction-box').hidden = true;
						return;
					}
					var data = await Zotero.Retractions.getData(item);
					
					this._id('retraction-box').hidden = false;
					this._id('retraction-header-text').textContent
						= Zotero.getString('retraction.banner');
					
					// Date
					if (data.date) {
						this._id('retraction-date').hidden = false;
						this._id('retraction-date').textContent = Zotero.getString(
							'retraction.date',
							data.date.toLocaleDateString()
						);
					}
					else {
						this._id('retraction-date').hidden = true;
					}
					
					// Reasons
					var allowHiding = false;
					if (data.reasons.length) {
						let elem = this._id('retraction-reasons');
						elem.hidden = false;
						elem.textContent = '';
						for (let reason of data.reasons) {
							let dt = document.createElement('dt');
							let dd = document.createElement('dd');
							
							dt.textContent = reason;
							dd.textContent = Zotero.Retractions.getReasonDescription(reason);
							
							elem.appendChild(dt);
							elem.appendChild(dd);
							
							if (reason == 'Retract and Replace') {
								allowHiding = true;
							}
						}
					}
					else {
						this._id('retraction-reasons').hidden = true;
					}
					
					// Retraction DOI or PubMed ID
					if (data.doi || data.pmid) {
						let div = this._id('retraction-notice');
						div.textContent = '';
						let a = document.createElement('a');
						a.textContent = Zotero.getString('retraction.notice');
						if (data.doi) {
							a.href = 'https://doi.org/' + data.doi;
						}
						else {
							a.href = `https://www.ncbi.nlm.nih.gov/pubmed/${data.pmid}/`;
						}
						div.appendChild(a);
					}
					else {
						this._id('retraction-notice').hidden = true;
					}
					
					// Links
					if (data.urls.length) {
						let div = this._id('retraction-links');
						div.hidden = false;
						div.textContent = '';
						
						let p = document.createElement('p');
						p.textContent = Zotero.getString('retraction.details');
						
						let ul = document.createElement('ul');
						for (let url of data.urls) {
							let li = document.createElement('li');
							let a = document.createElement('a');
							url = url.replace(/^http:/, 'https:');
							a.href = url;
							a.textContent = url;
							li.appendChild(a);
							ul.appendChild(li);
						}
						
						div.appendChild(p);
						div.appendChild(ul);
					}
					else {
						this._id('retraction-links').hidden = true;
					}
					
					let creditElem = this._id('retraction-credit');
					if (!creditElem.childNodes.length) {
						let text = Zotero.getString(
							'retraction.credit',
							'<a href="https://retractionwatch.com">Retraction Watch</a>'
						);
						let parts = Zotero.Utilities.parseMarkup(text);
						for (let part of parts) {
							if (part.type == 'text') {
								creditElem.appendChild(document.createTextNode(part.text));
							}
							else if (part.type == 'link') {
								let a = document.createElement('a');
								a.href = part.attributes.href;
								a.textContent = part.text;
								creditElem.appendChild(a);
							}
						}
					}
					
					let hideElem = this._id('retraction-hide');
					hideElem.firstChild.textContent = Zotero.getString('retraction.replacedItem.hide');
					hideElem.hidden = !allowHiding;
					hideElem.firstChild.onclick = (_event) => {
						ZoteroPane.promptToHideRetractionForReplacedItem(item);
					};
					
					Zotero.Utilities.Internal.updateHTMLInXUL(this._id('retraction-box'));
				}.bind(this));
			}
			
			return this._updateRetracted(this.item);
		}
		
		_id(id) {
			return this.querySelector(`#${id}`);
		}
	}
	customElements.define("item-box", ItemBox);
}
