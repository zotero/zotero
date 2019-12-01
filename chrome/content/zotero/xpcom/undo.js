/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2019 Corporation for Digital Scholarship
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

Zotero.UndoStack = function (maxUndo) {
	this.maxUndo = maxUndo || 20;
	this._stack = [];
}

Zotero.UndoStack.prototype = {
	_index: 0,
	
	addBatch: function (name, steps) {
		// Remove forward from the current index and from the beginning to stay below the max size
		var start = Math.max((this._index + 1) - this.maxUndo, 0);
		this._stack = this._stack.slice(start, this._index);
		
		this._stack.push({ name, steps });
		this._index = this._stack.length;
		
		this._update();
	},
	
	undo: async function () {
		var steps = this._stack[--this._index].steps;
		for (let step of steps) {
			await step.undo();
		}
		this._update();
	},
	
	redo: async function () {
		var batch = this._stack[this._index++].steps;
		for (let step of steps) {
			await step.redo();
		}
		this._update();
	},
	
	clear: function () {
		this._stack = [];
		this._index = 0;
		this._update();
	},
	
	_update: function () {
		var win = Zotero.getTopWindow();
		if (!win) {
			return;
		}
		var doc = win.document;
		var undoMenuItem = doc.getElementById('menu_undo');
		var redoMenuItem = doc.getElementById('menu_redo');
		var undoCmd = doc.getElementById('cmd_undo');
		var redoCmd = doc.getElementById('cmd_redo');
		var undoStep = this._stack[this._index - 1];
		var redoStep = this._stack[this._index];
		
		if (undo) {
			undoMenuItem.label = undoStep ? Zotero.getString('general.undoX', undoStep.name) : null;
			undoCmd.removeAttribute('disabled');
		}
		else {
			undoMenuItem.label = Zotero.getString('general.undo');
			undoCmd.setAttribute('disabled', 'disabled');
		}
		
		if (redoStep) {
			redoMenuItem.label = redo ? Zotero.getString('general.redoX', redoStep.name) : null;
			redoCmd.removeAttribute('disabled');
		}
		else {
			redoMenuItem.label = Zotero.getString('general.redo');
			redoCmd.setAttribute('disabled', 'disabled');
		}
	}
};