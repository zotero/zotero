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

Zotero.LibraryTreeView = function () {};
Zotero.LibraryTreeView.prototype = {
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
		Zotero.DragDrop.currentDragEvent = event;
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
		
		Zotero.DragDrop.currentDragEvent = event;
		
		var target = event.target;
		if (target.tagName != 'treechildren') {
			return false;
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
			var sourceItemGroup = Zotero.DragDrop.getDragSource();
			if (sourceItemGroup) {
				if (this.type == 'collection') {
					var targetItemGroup = Zotero.DragDrop.getDragTarget();
				}
				else if (this.type == 'item') {
					var targetItemGroup = this.itemGroup;
				}
				else {
					throw new Error("Invalid type '" + this.type + "'");
				}
				
				if (!targetItemGroup) {
					this._setDropEffect(event, "none");
					return false;
				}
				
				if (sourceItemGroup.id == targetItemGroup.id) {
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
				if (!sourceItemGroup.isCollection()) {
					this._setDropEffect(event, "copy");
					return false;
				}
				// For now, all cross-library drags are copies
				if (sourceItemGroup.ref.libraryID != targetItemGroup.ref.libraryID) {
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
				Zotero.DragDrop.currentDragEvent = event;
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
		Zotero.DragDrop.currentDragEvent = null;
	},
	
	
	_setDropEffect: function (event, effect) {
		// On Windows (in Fx26), Firefox uses 'move' for unmodified drags,
		// and 'copy'/'link' for drags with system-default modifier keys,
		// as long as the actions are allowed by the initial effectAllowed set
		// in onDragStart, regardless of the effectAllowed or dropEffect set
		// in onDragOver. To prevent inaccurate 'copy'/'link' cursors, we set
		// effectAllowed to 'move' in onDragStart, which locks the cursor at
		// 'move'. ('none' still changes the cursor, but 'copy'/'link' do not.)
		//
		// However, since effectAllowed is enforced, leaving it at 'move'
		// would prevent our default 'copy' from working, so we also have to
		// set effectAllowed here (called from onDragOver) to the same action
		// as the dropEffect. This allows the dropEffect setting (which we use
		// in the tree's canDrop() and drop() to determine the desired action)
		// to be changed, even if the cursor doesn't reflect the new setting.
		if (Zotero.isWin) {
			event.dataTransfer.effectAllowed = effect;
		}
		event.dataTransfer.dropEffect = effect;
	}
};
