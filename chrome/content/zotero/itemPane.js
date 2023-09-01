/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
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

// import React from 'react';
// import ReactDOM from 'react-dom';
// import TagsBoxContainer from 'containers/tagsBoxContainer';

var ZoteroItemPane = new function() {
	var _lastItem, _itemBox, _tagsBox, _notesBox, _relatedBox;
	var _selectedNoteID;
	var _translationTarget;

	this.onLoad = function () {
		if (!Zotero) {
			return;
		}

		let tabBox = document.getElementById('zotero-view-tabbox');
		
		// Not in item pane, so skip the introductions
		//
		// DEBUG: remove?
		if (!tabBox) {
			return;
		}

		_notesBox = document.getElementById('zotero-editpane-notes');
		_tagsBox = document.getElementById('zotero-editpane-tags');
		_relatedBox = document.getElementById('zotero-editpane-related');

		this._unregisterID = Zotero.Notifier.registerObserver(this, ['item'], 'itemPane');

		Zotero.ItemPaneManager.initPane(tabBox, 'library', 'zotero-pane');
	};
	
	
	this.onUnload = function () {
		Zotero.Notifier.unregisterObserver(this._unregisterID);
	};
	
	
	/*
	 * Load a top-level item
	 */
	this.viewItem = Zotero.Promise.coroutine(function* (item, mode, index) {
		if (!index) {
			index = 0;
		}
		
		Zotero.debug('Viewing item in pane ' + index);
		
		let box;
		switch (index) {
			case 0: {
				if (!_itemBox) {
					_itemBox = new (customElements.get('item-box'));
					_itemBox.id = 'zotero-editpane-item-box';
					document.getElementById('item-box-container').appendChild(_itemBox);
				}
				box = _itemBox;
				break;
			}
			
			case 1:
				box = _notesBox;
				box.parentItem = item;
				break;

			case 2:
				box = _tagsBox;
				break;

			case 3:
				box = _relatedBox;
				break;
		}
		
		// Force blur() when clicking off a textbox to another item in middle
		// pane, since for some reason it's not being called automatically
		if (_lastItem && _lastItem != item) {
			switch (index) {
				case 0:
					// TEMP
					//yield box.blurOpenField();
					// DEBUG: Currently broken
					//box.scrollToTop();
					break;
			}
		}
		
		_lastItem = item;
		
		var viewBox = document.getElementById('zotero-view-item');
		viewBox.classList.remove('no-tabs');
		
		if (index == 0) {
			document.getElementById('zotero-editpane-tabs').setAttribute('hidden', item.isFeedItem);
			
			if (item.isFeedItem) {
				viewBox.classList.add('no-tabs');
				
				let lastTranslationTarget = Zotero.Prefs.get('feeds.lastTranslationTarget');
				if (lastTranslationTarget) {
					let id = parseInt(lastTranslationTarget.substr(1));
					if (lastTranslationTarget[0] == "L") {
						_translationTarget = Zotero.Libraries.get(id);
					}
					else if (lastTranslationTarget[0] == "C") {
						_translationTarget = Zotero.Collections.get(id);
					}
				}
				if (!_translationTarget) {
					_translationTarget = Zotero.Libraries.userLibrary;
				}
				this.setTranslateButton();
			}
		}
		
		if (box) {
			if (mode) {
				box.mode = mode;
				
				if (box.mode == 'view') {
					box.hideEmptyFields = true;
				}
			}
			else {
				box.mode = 'edit';
			}
			
			box.item = item;
		}

		let tabBox = document.getElementById('zotero-view-tabbox');
		Zotero.ItemPaneManager.setItemToElement(tabBox, _lastItem);

		let panel = tabBox.selectedPanel;
		const loaded = Zotero.ItemPaneManager.getPaneLoadedFromElement(panel);
		if (!loaded) {
			return;
		}
		const paneID = Zotero.ItemPaneManager.getPaneIDFromElement(panel);
		const target = Zotero.ItemPaneManager.getPaneContainerFromElement(panel);
		// Trigger update event for custom panes manually
		Zotero.ItemPaneManager.triggerEvent(paneID, {
			type: "update",
			mode: "library",
			item: _lastItem,
			target
		});
	});
	
	
	this.notify = Zotero.Promise.coroutine(function* (action, _type, _ids, _extraData) {
		var viewBox = document.getElementById('zotero-view-item');
		if (viewBox.selectedIndex == 0 && action == 'refresh' && _lastItem) {
			yield this.viewItem(_lastItem, null, 0);
		}
	});
	
	
	this.blurOpenField = Zotero.Promise.coroutine(function* () {
		var tabBox = document.getElementById('zotero-view-tabbox');
		let box;
		switch (tabBox.selectedIndex) {
			case 0:
				box = _itemBox;
				if (box) {
					yield box.blurOpenField();
				}
				break;
				
			case 2:
				box = _tagsBox;
				if (box) {
					box.blurOpenField();
				}
				break;
		}
	});
	
	
	function _focusItemsList() {
		var tree = document.getElementById('zotero-items-tree');
		if (tree) {
			tree.focus();
		}
	}
	
	
	this.onNoteSelected = function (item, editable) {
		_selectedNoteID = item.id;
		
		var _type = Zotero.Libraries.get(item.libraryID).libraryType;
		var noteEditor = document.getElementById('zotero-note-editor');
		noteEditor.mode = editable ? 'edit' : 'view';
		noteEditor.viewMode = 'library';
		noteEditor.parent = null;
		noteEditor.item = item;
		
		document.getElementById('zotero-item-pane-content').selectedIndex = 2;
	};
	
	
	/**
	 * Select the parent item and open the note editor
	 */
	this.openNoteWindow = async function () {
		var selectedNote = Zotero.Items.get(_selectedNoteID);
		
		var _type = Zotero.Libraries.get(selectedNote.libraryID).libraryType;
		ZoteroPane.openNoteWindow(selectedNote.id);
	};
	
	
	this.onTagsContextPopupShowing = function () {
		if (!_lastItem.isEditable()) {
			return false;
		}
		return undefined;
	};
	
	
	this.removeAllTags = async function () {
		if (Services.prompt.confirm(null, "", Zotero.getString('pane.item.tags.removeAll'))) {
			_lastItem.setTags([]);
			await _lastItem.saveTx();
		}
	};
	
	
	this.translateSelectedItems = Zotero.Promise.coroutine(function* () {
		var collectionID = _translationTarget.objectType == 'collection' ? _translationTarget.id : undefined;
		var items = ZoteroPane_Local.itemsView.getSelectedItems();
		for (let item of items) {
			yield item.translate(_translationTarget.libraryID, collectionID);
		}
	});
	
	
	this.buildTranslateSelectContextMenu = function (event) {
		var menu = document.getElementById('zotero-item-addTo-menu');
		// Don't trigger rebuilding on nested popupmenu open/close
		if (event.target != menu) {
			return;
		}
		// Clear previous items
		while (menu.firstChild) {
			menu.removeChild(menu.firstChild);
		}
		
		let target = Zotero.Prefs.get('feeds.lastTranslationTarget');
		if (!target) {
			target = "L" + Zotero.Libraries.userLibraryID;
		}
		
		var libraries = Zotero.Libraries.getAll();
		for (let library of libraries) {
			if (!library.editable || library.libraryType == 'publications') {
				continue;
			}
			Zotero.Utilities.Internal.createMenuForTarget(
				library,
				menu,
				target,
				function(event, libraryOrCollection) {
					if (event.target.tagName == 'menu') {
						Zotero.Promise.coroutine(function* () {
							// Simulate menuitem flash on OS X
							if (Zotero.isMac) {
								event.target.setAttribute('_moz-menuactive', false);
								yield Zotero.Promise.delay(50);
								event.target.setAttribute('_moz-menuactive', true);
								yield Zotero.Promise.delay(50);
								event.target.setAttribute('_moz-menuactive', false);
								yield Zotero.Promise.delay(50);
								event.target.setAttribute('_moz-menuactive', true);
							}
							menu.hidePopup();
							
							ZoteroItemPane.setTranslationTarget(libraryOrCollection);
							event.stopPropagation();
						})();
					}
					else {
						ZoteroItemPane.setTranslationTarget(libraryOrCollection);
						event.stopPropagation();
					}
				}
			);
		}
	};
	
	
	this.setTranslateButton = function() {
		var label = Zotero.getString('pane.item.addTo', _translationTarget.name);
		var elem = document.getElementById('zotero-feed-item-addTo-button');
		elem.label = label;

		var key = Zotero.Keys.getKeyForCommand('saveToZotero');
		
		var tooltip = label
			+ (Zotero.rtl ? ' \u202B' : ' ') + '('
			+ (Zotero.isMac ? '⇧⌘' : Zotero.getString('general.keys.ctrlShift'))
			+ key + ')';
		elem.title = tooltip;
		elem.image = _translationTarget.treeViewImage;
	};
	

	this.setTranslationTarget = function(translationTarget) {
		_translationTarget = translationTarget;
		Zotero.Prefs.set('feeds.lastTranslationTarget', translationTarget.treeViewID);
		ZoteroItemPane.setTranslateButton();
	};
	
	
	this.setReadLabel = function (isRead) {
		var elem = document.getElementById('zotero-feed-item-toggleRead-button');
		var label = Zotero.getString('pane.item.' + (isRead ? 'markAsUnread' : 'markAsRead'));
		elem.textContent = label;

		var key = Zotero.Keys.getKeyForCommand('toggleRead');
		var tooltip = label + (Zotero.rtl ? ' \u202B' : ' ') + '(' + key + ')';
		elem.title = tooltip;
	};
};

addEventListener("load", function(e) { ZoteroItemPane.onLoad(e); }, false);
addEventListener("unload", function(e) { ZoteroItemPane.onUnload(e); }, false);
