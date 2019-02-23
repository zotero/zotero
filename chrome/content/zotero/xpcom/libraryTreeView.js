/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2013 Center for History and New Media
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

Zotero.LibraryTreeView = function () {
	this._initialized = false;
	this._listeners = {};
	this._rows = [];
	this._rowMap = {};
	
	this.id = Zotero.Utilities.randomString();
	Zotero.debug("Creating " + this.type + "s view with id " + this.id);
	
	//
	// Create .on(Load|Select|Refresh).addListener() methods
	//
	var _createEventBinding = function (event, alwaysOnce) {
		return alwaysOnce
			? {
				addListener: listener => this._addListener(event, listener, true)
			}
			: {
				addListener: (listener, once) => this._addListener(event, listener, once)
			};
	}.bind(this);
	
	this.onLoad = _createEventBinding('load', true);
	this.onSelect = _createEventBinding('select');
	this.onRefresh = _createEventBinding('refresh');
};

Zotero.LibraryTreeView.prototype = {
	get initialized() {
		return this._initialized;
	},
	
	
	addEventListener: function (event, listener) {
		Zotero.logError("Zotero.LibraryTreeView::addEventListener() is deprecated");
		this.addListener(event, listener);
	},
	
	
	waitForLoad: function () {
		return this._waitForEvent('load');
	},
	
	
	waitForSelect: function () {
		return this._waitForEvent('select');
	},
	
	
	runListeners: Zotero.Promise.coroutine(function* (event) {
		//Zotero.debug(`Calling ${event} listeners on ${this.type} tree ${this.id}`);
		if (!this._listeners[event]) return;
		for (let [listener, once] of this._listeners[event].entries()) {
			yield Zotero.Promise.resolve(listener.call(this));
			if (once) {
				this._listeners[event].delete(listener);
			}
		}
	}),
	
	
	_addListener: function(event, listener, once) {
		// If already initialized run now
		if (event == 'load' && this._initialized) {
			listener.call(this);
		}
		else {
			if (!this._listeners[event]) {
				this._listeners[event] = new Map();
			}
			this._listeners[event].set(listener, once);
		}
	},
	
	
	_waitForEvent: Zotero.Promise.coroutine(function* (event) {
		if (event == 'load' && this._initialized) {
			return;
		}
		return new Zotero.Promise((resolve, reject) => {
			this._addListener(event, () => resolve(), true);
		});
	}),
	
	
	/**
	 * Return a reference to the tree row at a given row
	 *
	 * @return {Zotero.CollectionTreeRow|Zotero.ItemTreeRow}
	 */
	getRow: function(row) {
		return this._rows[row];
	},
	
	
	/**
	 * Return the index of the row with a given ID (e.g., "C123" for collection 123)
	 *
	 * @param {String} - Row id
	 * @return {Integer|false}
	 */
	getRowIndexByID: function (id) {
		var type = "";
		if (this.type != 'item') {
			var type = id[0];
			id = ('' + id).substr(1);
		}
		return this._rowMap[type + id] !== undefined ? this._rowMap[type + id] : false;
	},
	
	
	getSelectedRowIndexes: function () {
		var rows = [];
		var start = {};
		var end = {};
		for (let i = 0, len = this.selection.getRangeCount(); i < len; i++) {
			this.selection.getRangeAt(i, start, end);
			for (let j = start.value; j <= end.value; j++) {
				rows.push(j);
			}
		}
		return rows;
	},
	
	
	/**
	 * Return an object describing the current scroll position to restore after changes
	 *
	 * @return {Object|Boolean} - Object with .id (a treeViewID) and .offset, or false if no rows
	 */
	_saveScrollPosition: function() {
		var treebox = this._treebox;
		var first = treebox.getFirstVisibleRow();
		if (!first) {
			return false;
		}
		var last = treebox.getLastVisibleRow();
		var firstSelected = null;
		for (let i = first; i <= last; i++) {
			// If an object is selected, keep the first selected one in position
			if (this.selection.isSelected(i)) {
				return {
					id: this.getRow(i).ref.treeViewID,
					offset: i - first
				};
			}
		}
		
		// Otherwise keep the first visible row in position
		return {
			id: this.getRow(first).ref.treeViewID,
			offset: 0
		};
	},
	
	
	/**
	 * Restore a scroll position returned from _saveScrollPosition()
	 */
	_rememberScrollPosition: function (scrollPosition) {
		if (!scrollPosition || !scrollPosition.id) {
			return;
		}
		var row = this.getRowIndexByID(scrollPosition.id);
		if (row === false) {
			return;
		}
		this._treebox.scrollToRow(Math.max(row - scrollPosition.offset, 0));
	},
	
	
	runSelectListeners: function () {
		return this._runListeners('select');
	},
	
	
	/**
	 * Add a tree row to the main array, update the row count, tell the treebox that the row
	 * count changed, and update the row map
	 *
	 * @param {Array} newRows - Array to operate on
	 * @param {Zotero.ItemTreeRow} itemTreeRow
	 * @param {Number} [beforeRow] - Row index to insert new row before
	 */
	_addRow: function (treeRow, beforeRow, skipRowMapRefresh) {
		this._addRowToArray(this._rows, treeRow, beforeRow);
		this.rowCount++;
		this._treebox.rowCountChanged(beforeRow, 1);
		if (!skipRowMapRefresh) {
			// Increment all rows in map at or above insertion point
			for (let i in this._rowMap) {
				if (this._rowMap[i] >= beforeRow) {
					this._rowMap[i]++
				}
			}
			// Add new row to map
			this._rowMap[treeRow.id] = beforeRow;
		}
	},
	
	
	/**
	 * Add a tree row into a given array
	 *
	 * @param {Array} array - Array to operate on
	 * @param {Zotero.CollectionTreeRow|ItemTreeRow} treeRow
	 * @param {Number} beforeRow - Row index to insert new row before
	 */
	_addRowToArray: function (array, treeRow, beforeRow) {
		array.splice(beforeRow, 0, treeRow);
	},
	
	
	/**
	* Remove a row from the main array, decrement the row count, tell the treebox that the row
	* count changed, update the parent isOpen if necessary, delete the row from the map, and
	* optionally update all rows above it in the map
	*/
	_removeRow: function (row, skipMapUpdate) {
		var id = this._rows[row].id;
		var level = this.getLevel(row);
		
		var lastRow = row == this.rowCount - 1;
		if (lastRow && this.selection.isSelected(row)) {
			// Deselect removed row
			this.selection.toggleSelect(row);
			// If no other rows selected, select first selectable row before
			if (this.selection.count == 0 && row !== 0) {
				let previous = row;
				while (true) {
					previous--;
					// Should ever happen
					if (previous < 0) {
						break;
					}
					if (!this.isSelectable(previous)) {
						continue;
					}
					
					this.selection.toggleSelect(previous);
					break;
				}
			}
		}
		
		this._rows.splice(row, 1);
		this.rowCount--;
		// According to the example on https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsITreeBoxObject#rowCountChanged
		// this should start at row + 1 ("rowCountChanged(rowIndex+1, -1);"), but that appears to
		// just be wrong. A negative count indicates removed rows, but the index should still
		// start at the place where the removals begin, not after it going backward.
		this._treebox.rowCountChanged(row, -1);
		// Update isOpen if parent and no siblings
		if (row != 0
				&& this.getLevel(row - 1) < level
				&& (!this._rows[row] || this.getLevel(row) != level)) {
			this._rows[row - 1].isOpen = false;
			this._treebox.invalidateRow(row - 1);
		}
		delete this._rowMap[id];
		if (!skipMapUpdate) {
			for (let i in this._rowMap) {
				if (this._rowMap[i] > row) {
					this._rowMap[i]--;
				}
			}
		}
	},
	
	
	_removeRows: function (rows) {
		rows = Zotero.Utilities.arrayUnique(rows);
		rows.sort((a, b) => a - b);
		for (let i = rows.length - 1; i >= 0; i--) {
			this._removeRow(rows[i]);
		}
	},
	
	
	getLevel: function (row) {
		return this._rows[row].level;
	},
	
	
	isContainerOpen: function(row) {
		return this._rows[row].isOpen;
	},
	
	
	/**
	 *  Called while a drag is over the tree
	 */
	canDrop: function(row, orient, dataTransfer) {
		// onDragOver() calls the view's canDropCheck() and sets the
		// dropEffect, which we check here. Setting the dropEffect on the
		// dataTransfer here seems to have no effect.
		
		// ondragover doesn't have access to the orientation on its own,
		// so we stuff it in Zotero.DragDrop
		Zotero.DragDrop.currentOrientation = orient;
		
		return dataTransfer.dropEffect && dataTransfer.dropEffect != "none";
	},
	
	
	/*
	 * Called by HTML 5 Drag and Drop when dragging over the tree
	 */
	onDragEnter: function (event) {
		Zotero.DragDrop.currentEvent = event;
		return false;
	},
	
	
	/**
	 * Called by HTML 5 Drag and Drop when dragging over the tree
	 *
	 * We use this to set the drag action, which is used by view.canDrop(),
	 * based on the view's canDropCheck() and modifier keys.
	 */
	onDragOver: function (event) {
		// Prevent modifier keys from doing their normal things
		event.preventDefault();
		
		Zotero.DragDrop.currentEvent = event;
		
		var target = event.target;
		if (target.tagName != 'treechildren') {
			let doc = target.ownerDocument;
			// Consider a drop on the items pane message box (e.g., when showing the welcome text)
			// a drop on the items tree
			let msgBox = doc.getElementById('zotero-items-pane-message-box');
			if (msgBox.contains(target) && msgBox.firstChild.hasAttribute('allowdrop')) {
				target = doc.querySelector('#zotero-items-tree treechildren');
			}
			else {
				this._setDropEffect(event, "none");
				return false;
			}
		}
		var tree = target.parentNode;
		let row = {}, col = {}, obj = {};
		tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);
		if (tree.id == 'zotero-collections-tree') {
			var view = tree.ownerDocument.defaultView.ZoteroPane.collectionsView;
		}
		else if (tree.id == 'zotero-items-tree') {
			var view = tree.ownerDocument.defaultView.ZoteroPane.itemsView;
		}
		else {
			throw new Error("Invalid tree id '" + tree.id + "'");
		}
		
		if (!view.canDropCheck(row.value, Zotero.DragDrop.currentOrientation, event.dataTransfer)) {
			this._setDropEffect(event, "none");
			return;
		}
		
		if (event.dataTransfer.getData("zotero/item")) {
			var sourceCollectionTreeRow = Zotero.DragDrop.getDragSource(event.dataTransfer);
			if (sourceCollectionTreeRow) {
				if (this.type == 'collection') {
					var targetCollectionTreeRow = Zotero.DragDrop.getDragTarget(event);
				}
				else if (this.type == 'item') {
					var targetCollectionTreeRow = this.collectionTreeRow;
				}
				else {
					throw new Error("Invalid type '" + this.type + "'");
				}
				
				if (!targetCollectionTreeRow) {
					this._setDropEffect(event, "none");
					return false;
				}
				
				if (sourceCollectionTreeRow.id == targetCollectionTreeRow.id) {
					// Ignore drag into the same collection
					if (this.type == 'collection') {
						this._setDropEffect(event, "none");
					}
					// If dragging from the same source, do a move
					else {
						this._setDropEffect(event, "move");
					}
					return false;
				}
				// If the source isn't a collection, the action has to be a copy
				if (!sourceCollectionTreeRow.isCollection()) {
					this._setDropEffect(event, "copy");
					return false;
				}
				// For now, all cross-library drags are copies
				if (sourceCollectionTreeRow.ref.libraryID != targetCollectionTreeRow.ref.libraryID) {
					this._setDropEffect(event, "copy");
					return false;
				}
			}
			
			if ((Zotero.isMac && event.metaKey) || (!Zotero.isMac && event.shiftKey)) {
				this._setDropEffect(event, "move");
			}
			else {
				this._setDropEffect(event, "copy");
			}
		}
		else if (event.dataTransfer.getData("zotero/collection")) {
			let collectionID = Zotero.DragDrop.getDataFromDataTransfer(event.dataTransfer).data[0];
			let { libraryID: sourceLibraryID } = Zotero.Collections.getLibraryAndKeyFromID(collectionID);
			
			if (this.type == 'collection') {
				var targetCollectionTreeRow = Zotero.DragDrop.getDragTarget(event);
			}
			else {
				throw new Error("Invalid type '" + this.type + "'");
			}
			
			// For now, all cross-library drags are copies
			if (sourceLibraryID != targetCollectionTreeRow.ref.libraryID) {
				/*if ((Zotero.isMac && event.metaKey) || (!Zotero.isMac && event.shiftKey)) {
					this._setDropEffect(event, "move");
				}
				else {
					this._setDropEffect(event, "copy");
				}*/
				this._setDropEffect(event, "copy");
				return false;
			}
			
			// And everything else is a move
			this._setDropEffect(event, "move");
		}
		else if (event.dataTransfer.types.contains("application/x-moz-file")) {
			// As of Aug. 2013 nightlies:
			//
			// - Setting the dropEffect only works on Linux and OS X.
			//
			// - Modifier keys don't show up in the drag event on OS X until the
			//   drop (https://bugzilla.mozilla.org/show_bug.cgi?id=911918),
			//   so since we can't show a correct effect, we leave it at
			//   the default 'move', the least misleading option, and set it
			//   below in onDrop().
			//
			// - The cursor effect gets set by the system on Windows 7 and can't
			//   be overridden.
			if (!Zotero.isMac) {
				if (event.shiftKey) {
					if (event.ctrlKey) {
						event.dataTransfer.dropEffect = "link";
					}
					else {
						event.dataTransfer.dropEffect = "move";
					}
				}
				else {
					event.dataTransfer.dropEffect = "copy";
				}
			}
		}
		return false;
	},
	
	
	/*
	 * Called by HTML 5 Drag and Drop when dropping onto the tree
	 */
	onDrop: function (event) {
		// See note above
		if (event.dataTransfer.types.contains("application/x-moz-file")) {
			if (Zotero.isMac) {
				Zotero.DragDrop.currentEvent = event;
				if (event.metaKey) {
					if (event.altKey) {
						event.dataTransfer.dropEffect = 'link';
					}
					else {
						event.dataTransfer.dropEffect = 'move';
					}
				}
				else {
					event.dataTransfer.dropEffect = 'copy';
				}
			}
		}
		return false;
	},
	
	
	onDragExit: function (event) {
		//Zotero.debug("Clearing drag data");
		Zotero.DragDrop.currentEvent = null;
	},
	
	
	_setDropEffect: function (event, effect) {
		// On Windows (in Fx26), Firefox uses 'move' for unmodified drags
		// and 'copy'/'link' for drags with system-default modifier keys
		// as long as the actions are allowed by the initial effectAllowed set
		// in onDragStart, regardless of the effectAllowed or dropEffect set
		// in onDragOver. It doesn't seem to be possible to use 'copy' for
		// the default and 'move' for modified, as we need to in the collections
		// tree. To prevent inaccurate cursor feedback, we set effectAllowed to
		// 'copy' in onDragStart, which locks the cursor at 'copy'. ('none' still
		// changes the cursor, but 'move'/'link' do not.) It'd be better to use
		// the unadorned 'move', but we use 'copy' instead because with 'move' text
		// can't be dragged to some external programs (e.g., Chrome, Notepad++),
		// which seems worse than always showing 'copy' feedback.
		//
		// However, since effectAllowed is enforced, leaving it at 'copy'
		// would prevent our modified 'move' in the collections tree from working,
		// so we also have to set effectAllowed here (called from onDragOver) to
		// the same action as the dropEffect. This allows the dropEffect setting
		// (which we use in the tree's canDrop() and drop() to determine the desired
		// action) to be changed, even if the cursor doesn't reflect the new setting.
		if (Zotero.isWin || Zotero.isLinux) {
			event.dataTransfer.effectAllowed = effect;
		}
		event.dataTransfer.dropEffect = effect;
	}
};
