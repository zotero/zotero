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
	let htmlDoc = document.implementation.createHTMLDocument();
	
	class ItemPaneHeader extends ItemPaneSectionElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="head-container">
				<html:div class="title-head">
					<html:div class="title">
						<editable-text />
					</html:div>
					
					<html:div class="creator-year"></html:div>
					
					<html:div class="bib-entry"></html:div>
				</html:div>

				<html:div class="custom-head"></html:div>
			</html:div>

			<popupset>
				<menupopup class="secondary-popup">
					<menuitem data-l10n-id="text-action-copy" />
					<menuseparator />
					<menu data-l10n-id="item-pane-header-view-as">
						<menupopup class="view-as-popup" />
					</menu>
				</menupopup>
			</popupset>
		`, ['chrome://zotero/locale/zotero.dtd']);
		
		_item = null;
		
		_titleFieldID = null;
		
		get item() {
			return this._item;
		}

		set item(item) {
			this.blurOpenField();
			this._item = item;
		}

		init() {
			this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'paneHeader');
			this._prefsObserverIDs = [
				Zotero.Prefs.registerObserver('itemPaneHeader', () => {
					this._forceRenderAll();
				}),
				Zotero.Prefs.registerObserver('itemPaneHeader.bibEntry.style', () => this._forceRenderAll()),
				Zotero.Prefs.registerObserver('itemPaneHeader.bibEntry.locale', () => this._forceRenderAll()),
			];
			
			this.title = this.querySelector('.title');
			this.titleField = this.title.querySelector('editable-text');
			this.creatorYear = this.querySelector('.creator-year');
			this.bibEntry = this.querySelector('.bib-entry');
			this.bibEntry.attachShadow({ mode: 'open' });
			
			// Context menu for non-editable information (creator/year and bib entry)
			this.secondaryPopup = this.querySelector('.secondary-popup');
			this.secondaryPopup.firstElementChild.addEventListener('command', () => this._handleSecondaryCopy());
			
			this.creatorYear.addEventListener('contextmenu', (event) => {
				if (this.item) {
					this.secondaryPopup.openPopupAtScreen(event.screenX + 1, event.screenY + 1, true);
				}
			});
			
			this.bibEntryContent = document.createElement('div');
			this.bibEntryContent.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
			this.bibEntryContent.addEventListener('click', (event) => {
				event.preventDefault();
				if (event.target.matches('a[href]')) {
					Zotero.launchURL(event.target.href);
				}
			});
			this.bibEntryContent.addEventListener('contextmenu', (event) => {
				if (this._item && Zotero.Styles.initialized()) {
					this.secondaryPopup.openPopupAtScreen(event.screenX + 1, event.screenY + 1, true);
				}
			});
			this.bibEntry.shadowRoot.append(this.bibEntryContent);
			
			this.viewAsPopup = this.querySelector('.view-as-popup');
			this.viewAsPopup.addEventListener('popupshowing', () => this._buildViewAsMenu(this.viewAsPopup));
			
			this._bibEntryCache = new LRUCache();
			
			this.titleField.addEventListener('blur', () => this.save());
			this.titleField.ariaLabel = Zotero.getString('itemFields.title');
			this.titleField.addEventListener('contextmenu', (event) => {
				if (!this._item
					// Attachment title field: Use default editable-text context menu
					|| this._item.isAttachment()) return;
				
				event.preventDefault();
				let menupopup = ZoteroPane.buildFieldTransformMenu({
					target: this.titleField,
					onTransform: (newValue) => {
						this._setTransformedValue(newValue);
					},
				});
				
				menupopup.append(document.createXULElement('menuseparator'));
				
				let viewAsMenu = document.createXULElement('menu');
				viewAsMenu.setAttribute('data-l10n-id', 'item-pane-header-view-as');
				viewAsMenu.setAttribute('type', 'menu');
				let viewAsPopup = document.createXULElement('menupopup');
				this._buildViewAsMenu(viewAsPopup);
				viewAsMenu.append(viewAsPopup);
				menupopup.append(viewAsMenu);
				
				this.ownerDocument.querySelector('popupset').append(menupopup);
				menupopup.addEventListener('popuphidden', () => menupopup.remove());
				menupopup.openPopupAtScreen(event.screenX + 1, event.screenY + 1, true);
			});
		}
		
		destroy() {
			Zotero.Notifier.unregisterObserver(this._notifierID);
			for (let id of this._prefsObserverIDs) {
				Zotero.Prefs.unregisterObserver(id);
			}
		}

		notify(action, type, ids) {
			if (action == 'modify' || action == 'delete') {
				for (let id of ids) {
					this._bibEntryCache.delete(id);
				}
			}

			if (action == 'modify' && this.item && ids.includes(this.item.id)) {
				this._forceRenderAll();
			}
		}
		
		async _setTransformedValue(newValue) {
			await this.blurOpenField();
			this._item.setField(this._titleFieldID, newValue);
			let shortTitleVal = this._item.getField('shortTitle');
			if (newValue.toLowerCase().startsWith(shortTitleVal.toLowerCase())) {
				this._item.setField('shortTitle', newValue.substring(0, shortTitleVal.length));
			}
			await this._item.saveTx();
		}
		
		async save() {
			if (this._item) {
				this._item.setField(this._titleFieldID, this.titleField.value);
				await this._item.saveTx();
			}
			this._forceRenderAll();
		}
		
		async blurOpenField() {
			if (this.titleField.focused) {
				this.titleField.blur();
				await this.save();
			}
		}
		
		render() {
			if (!this._item) {
				return;
			}
			if (this._isAlreadyRendered()) return;

			let headerMode = Zotero.Prefs.get('itemPaneHeader');
			if (this._item.isAttachment()) {
				headerMode = 'title';
			}
			
			this.title.hidden = true;
			this.creatorYear.hidden = true;
			this.bibEntry.hidden = true;

			if (headerMode === 'none') {
				this.classList.add('no-title-head');
				return;
			}

			this.classList.remove('no-title-head');
			
			if (headerMode === 'bibEntry') {
				if (!Zotero.Styles.initialized()) {
					this.bibEntryContent.textContent = Zotero.getString('general.loading');
					this.bibEntry.classList.add('loading');
					this.bibEntry.hidden = false;
					Zotero.Styles.init().then(() => this._forceRenderAll());
					return;
				}
				
				if (this._renderBibEntry()) {
					this.bibEntry.hidden = false;
					return;
				}
				
				// Fall back to Title/Creator/Year if style is not found
				headerMode = 'titleCreatorYear';
			}

			if (headerMode === 'title' || headerMode === 'titleCreatorYear') {
				this._titleFieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(this._item.itemTypeID, 'title');

				let title = this.item.getField(this._titleFieldID);
				// If focused, update the value that will be restored on Escape;
				// otherwise, update the displayed value
				if (this.titleField.focused) {
					this.titleField.initialValue = title;
				}
				else {
					this.titleField.value = title;
				}
				this.titleField.readOnly = !this.editable;
				if (this._titleFieldID) {
					this.titleField.placeholder = Zotero.ItemFields.getLocalizedString(this._titleFieldID);
				}
				this.title.hidden = false;
			}
			
			if (headerMode === 'titleCreatorYear') {
				let firstCreator = this._item.getField('firstCreator');
				let year = this._item.getField('year');
				let creatorYearString = '';
				if (firstCreator) {
					creatorYearString += firstCreator;
				}
				if (year) {
					creatorYearString += ` (${year})`;
				}
				
				if (creatorYearString) {
					this.creatorYear.textContent = creatorYearString;
					this.creatorYear.hidden = false;
				}
				else {
					this.creatorYear.hidden = true;
				}
			}

			// Make title field padding tighter if creator/year is visible below it
			this.titleField.toggleAttribute('tight',
				headerMode === 'titleCreatorYear' && !this.creatorYear.hidden);
		}
		
		_renderBibEntry() {
			let style = Zotero.Styles.get(Zotero.Prefs.get('itemPaneHeader.bibEntry.style'));
			if (!style) {
				Zotero.warn('Style not found: ' + Zotero.Prefs.get('itemPaneHeader.bibEntry.style'));
				return false;
			}
			let locale = Zotero.Prefs.get('itemPaneHeader.bibEntry.locale');
			
			// Create engine if not cached (first run with this style)
			if (this._cslEngineStyleID !== style.styleID || this._cslEngineLocale !== locale) {
				this._cslEngine = style.getCiteProc(locale, 'html');
				this._cslEngineStyleID = style.styleID;
				this._cslEngineLocale = locale;
				this._bibEntryCache.clear();
			}

			// Create bib entry if not cached (first run on this item or item data has changed)
			if (!this._bibEntryCache.has(this._item.id)) {
				// Force refresh items - without this, entries won't change when item data changes
				this._cslEngine.updateItems([]);
				this._bibEntryCache.set(this._item.id,
					Zotero.Cite.makeFormattedBibliographyOrCitationList(this._cslEngine,
						[this._item], 'html', false));
			}
			
			htmlDoc.body.innerHTML = this._bibEntryCache.get(this._item.id);
			// Remove .loading (added above if styles weren't yet initialized)
			this.bibEntry.classList.remove('loading');
			// Remove existing children and *then* append new ones to avoid "scripts are blocked internally"
			// error in log
			this.bibEntryContent.replaceChildren();
			this.bibEntryContent.append(...htmlDoc.body.childNodes);
			
			let body = this.bibEntryContent.querySelector('.csl-bib-body');
			if (!body) {
				Zotero.debug('No .csl-bib-body found in bib entry');
				return false;
			}
			
			// Remove any custom indentation/line height set by the style
			body.style.marginLeft = body.style.marginRight = '';
			body.style.textIndent = '';
			body.style.lineHeight = '';
			
			if (style.categories === 'numeric') {
				// Remove number from entry if present
				let number = body.querySelector('.csl-entry > .csl-left-margin:first-child');
				if (number) {
					let followingContent = number.nextElementSibling;
					if (followingContent?.classList.contains('csl-right-inline')) {
						followingContent.classList.remove('csl-right-inline');
						followingContent.style = '';
					}
					number.remove();
				}
			}
			
			return true;
		}
		
		_handleSecondaryCopy() {
			let selectedMode = Zotero.Prefs.get('itemPaneHeader');
			if (selectedMode === 'titleCreatorYear') {
				Zotero.Utilities.Internal.copyTextToClipboard(this.creatorYear.textContent);
			}
			else if (selectedMode === 'bibEntry') {
				Zotero_File_Interface.copyItemsToClipboard(
					[this._item],
					Zotero.Prefs.get('itemPaneHeader.bibEntry.style'),
					Zotero.Prefs.get('itemPaneHeader.bibEntry.locale'),
					false,
					false
				);
			}
		}
		
		_buildViewAsMenu(menupopup) {
			menupopup.replaceChildren();
			
			let selectedMode = Zotero.Prefs.get('itemPaneHeader');
			for (let headerMode of ['title', 'titleCreatorYear', 'bibEntry']) {
				let menuitem = document.createXULElement('menuitem');
				menuitem.setAttribute('data-l10n-id', 'item-pane-header-' + headerMode);
				menuitem.setAttribute('type', 'radio');
				menuitem.setAttribute('checked', headerMode === selectedMode);
				menuitem.addEventListener('command', () => {
					Zotero.Prefs.set('itemPaneHeader', headerMode);
				});
				menupopup.append(menuitem);
			}
			
			menupopup.append(document.createXULElement('menuseparator'));
			
			let moreOptionsMenuitem = document.createXULElement('menuitem');
			moreOptionsMenuitem.setAttribute('data-l10n-id', 'item-pane-header-more-options');
			moreOptionsMenuitem.addEventListener('command', () => {
				Zotero.Utilities.Internal.openPreferences('zotero-prefpane-general');
			});
			menupopup.append(moreOptionsMenuitem);
		}

		renderCustomHead(callback) {
			let customHead = this.querySelector(".custom-head");
			customHead.replaceChildren();
			let append = (...args) => {
				customHead.append(...args);
			};
			if (callback) callback({
				doc: document,
				append,
			});
			this.classList.toggle('has-custom-head', customHead.innerHTML);
		}
	}
	customElements.define("item-pane-header", ItemPaneHeader);
	
	/**
	 * Simple LRU cache that stores bibliography entries for the 100 most recently viewed items.
	 */
	class LRUCache {
		static CACHE_SIZE = 100;
		
		_map = new Map();
		
		clear() {
			this._map.clear();
		}
		
		has(key) {
			return this._map.has(key);
		}
		
		get(key) {
			if (!this._map.has(key)) {
				return undefined;
			}
			let value = this._map.get(key);
			// Maps are sorted by insertion order, so delete and add back at the end
			this._map.delete(key);
			this._map.set(key, value);
			return value;
		}
		
		set(key, value) {
			this._map.delete(key);
			// Delete the first (= inserted earliest) elements until we're under CACHE_SIZE
			while (this._map.size >= this.constructor.CACHE_SIZE) {
				this._map.delete(this._map.keys().next().value);
			}
			this._map.set(key, value);
			return this;
		}
		
		delete(key) {
			return this._map.delete(key);
		}
	}
}
