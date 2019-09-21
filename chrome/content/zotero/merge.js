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

var Zotero_Merge_Window = new function () {
	var _wizard = null;
	var _wizardPage = null;
	var _mergeGroup = null;
	var _numObjects = null;
	
	var _io = null;
	var _conflicts = null;
	var _merged = [];
	var _pos = -1;
	
	this.init = function () {
		_wizard = document.getElementsByTagName('wizard')[0];
		_wizardPage = document.getElementsByTagName('wizardpage')[0];
		_mergeGroup = document.getElementsByTagName('zoteromergegroup')[0];
		
		_wizard.setAttribute('width', Math.min(980, screen.width - 20));
		_wizard.setAttribute('height', Math.min(718, screen.height - 30));
		
		// Set font size from pref
		Zotero.setFontSize(_wizardPage);
		
		_wizard.getButton('cancel').setAttribute('label', Zotero.getString('sync.cancel'));
		
		_io = window.arguments[0];
		// Not totally clear when this is necessary
		if (window.arguments[0].wrappedJSObject) {
			_io = window.arguments[0].wrappedJSObject;
		}
		_conflicts = _io.dataIn.conflicts;
		if (!_conflicts.length) {
			// TODO: handle no conflicts
			return;
		}
		
		if (_io.dataIn.type) {
			_mergeGroup.type = _io.dataIn.type;
		}
		_mergeGroup.leftCaption = _io.dataIn.captions[0];
		_mergeGroup.rightCaption = _io.dataIn.captions[1];
		_mergeGroup.mergeCaption = _io.dataIn.captions[2];
		
		_resolveAllCheckbox = document.getElementById('resolve-all');
		if (_conflicts.length == 1) {
			_resolveAllCheckbox.hidden = true;
		}
		else {
			_mergeGroup.onSelectionChange = _updateResolveAllCheckbox;
		}
		
		_numObjects = document.getElementById('zotero-merge-num-objects');
		document.getElementById('zotero-merge-total-objects').value = _conflicts.length;
		
		this.onNext();
	}
	
	
	this.onBack = function () {
		_merged[_pos] = _getCurrentMergeInfo();
		
		_pos--;
		
		if (_pos == 0) {
			_wizard.canRewind = false;
		}
		
		_updateGroup();
		
		var nextButton = _wizard.getButton("next");
		
		if (Zotero.isMac) {
			nextButton.setAttribute("hidden", "false");
			_wizard.getButton("finish").setAttribute("hidden", "true");
		}
		else {
			var buttons = document.getAnonymousElementByAttribute(_wizard, "anonid", "Buttons");
			var deck = document.getAnonymousElementByAttribute(buttons, "anonid", "WizardButtonDeck");
			deck.selectedIndex = 1;
		}
		
		_setInstructionsString(nextButton.label);
	}
	
	
	this.onNext = function () {
		// At end or resolving all
		if (_pos + 1 == _conflicts.length || _resolveAllCheckbox.checked) {
			return true;
		}
		
		// First page
		if (_pos == -1) {
			_wizard.canRewind = false;
		}
		// Subsequent pages
		else {
			_wizard.canRewind = true;
			_merged[_pos] = _getCurrentMergeInfo();
		}
		
		_pos++;
		
		try {
			_updateGroup();
		}
		catch (e) {
			_error(e);
			return;
		}
		
		_updateResolveAllCheckbox();
		
		if (_isLastConflict()) {
			_showFinishButton();
		}
		else {
			_showNextButton();
		}
		
		return false;
	}
	
	
	this.onFinish = function () {
		// If using one side for all remaining, update merge object
		if (!_isLastConflict() && _resolveAllCheckbox.checked) {
			let side = _mergeGroup.rightpane.getAttribute("selected") == "true" ? 'right' : 'left'
			for (let i = _pos; i < _conflicts.length; i++) {
				_merged[i] = {
					data: _getMergeDataWithSide(i, side),
					selected: side
				};
			}
		}
		else {
			_merged[_pos] = _getCurrentMergeInfo();
		}
		
		_merged.forEach(function (x, i, a) {
			// Add key
			x.data.key = _conflicts[i].left.key || _conflicts[i].right.key;
			// Add back version
			if (x.data) {
				x.data.version = _conflicts[i][x.selected].version;
			}
		})
		
		_io.dataOut = _merged;
		return true;
	}
	
	
	this.onCancel = function () {
		// if already merged, ask
	}
	
	
	this.onResolveAllChange = function (resolveAll) {
		if (resolveAll || _isLastConflict()) {
			_showFinishButton();
		}
		else {
			_showNextButton();
		}
	}
	
	
	function _updateGroup() {
		// Adjust counter
		_numObjects.value = _pos + 1;
		
		let data = {};
		Object.assign(data, _conflicts[_pos]);
		var mergeInfo = _getMergeInfo(_pos);
		data.merge = mergeInfo.data;
		data.selected = mergeInfo.selected;
		if (!_conflicts[_pos].libraryID) {
			throw new Error("libraryID not provided in conflict object");
		}
		_mergeGroup.libraryID = _conflicts[_pos].libraryID;
		_mergeGroup.data = data;
		
		_updateResolveAllCheckbox();
	}
	
	
	function _getCurrentMergeInfo() {
		return {
			data: _mergeGroup.merged,
			selected: _mergeGroup.leftpane.getAttribute("selected") == "true" ? "left" : "right"
		};
	}
	
	
	/**
	 * Get the default or previously chosen merge info for a given position
	 *
	 * @param {Integer} pos
	 * @return {Object} - Object with 'data' (JSON field data) and 'selected' ('left', 'right') properties
	 */
	function _getMergeInfo(pos) {
		// If data already selected, use that
		if (_merged[pos]) {
			return _merged[pos];
		}
		// If either side was deleted, use other side
		if (_conflicts[pos].left.deleted) {
			let mergeInfo = {
				data: {},
				selected: 'right'
			};
			Object.assign(mergeInfo.data, _conflicts[pos].right);
			return mergeInfo;
		}
		if (_conflicts[pos].right.deleted) {
			let mergeInfo = {
				data: {},
				selected: 'left'
			};
			Object.assign(mergeInfo.data, _conflicts[pos].left);
			return mergeInfo;
		}
		// Apply changes from each side and pick most recent version for conflicting fields
		var mergeInfo = {
			data: {}
		};
		Object.assign(mergeInfo.data, _conflicts[pos].left)
		Zotero.DataObjectUtilities.applyChanges(mergeInfo.data, _conflicts[pos].changes);
		if (_conflicts[pos].left.dateModified > _conflicts[pos].right.dateModified) {
			var side = 0;
		}
		// Use remote if remote Date Modified is later or same
		else {
			var side = 1;
		}
		Zotero.DataObjectUtilities.applyChanges(
			mergeInfo.data, _conflicts[pos].conflicts.map(x => x[side])
		);
		mergeInfo.selected = side ? 'right' : 'left';
		return mergeInfo;
	}
	
	
	/**
	 * Get the merge data using a given side at a given position
	 *
	 * @param {Integer} pos
	 * @param {String} side - 'left' or 'right'
	 * @return {Object} - JSON field data
	 */
	function _getMergeDataWithSide(pos, side) {
		if (!side) {
			throw new Error("Side not provided");
		}
		
		if (_conflicts[pos].left.deleted || _conflicts[pos].right.deleted) {
			return _conflicts[pos][side];
		}
		
		var data = {};
		Object.assign(data, _conflicts[pos].left)
		Zotero.DataObjectUtilities.applyChanges(data, _conflicts[pos].changes);
		Zotero.DataObjectUtilities.applyChanges(
			data, _conflicts[pos].conflicts.map(x => x[side == 'left' ? 0 : 1])
		);
		return data;
	}
	
	
	function _updateResolveAllCheckbox() {
		if (_mergeGroup.rightpane.getAttribute("selected") == 'true') {
			var label = 'resolveAllRemote';
		}
		else {
			var label = 'resolveAllLocal';
		}
		_resolveAllCheckbox.label = Zotero.getString('sync.conflict.' + label);
	}
	
	
	function _isLastConflict() {
		return (_pos + 1) == _conflicts.length;
	}
	
	
	function _showNextButton() {
		var nextButton = _wizard.getButton("next");
		
		if (Zotero.isMac) {
			nextButton.setAttribute("hidden", "false");
			_wizard.getButton("finish").setAttribute("hidden", "true");
		}
		else {
			var buttons = document.getAnonymousElementByAttribute(_wizard, "anonid", "Buttons");
			var deck = document.getAnonymousElementByAttribute(buttons, "anonid", "WizardButtonDeck");
			deck.selectedIndex = 1;
		}
		
		_setInstructionsString(nextButton.label);
	}
	
	
	function _showFinishButton() {
		var finishButton = _wizard.getButton("finish");
		
		if (Zotero.isMac) {
			_wizard.getButton("next").setAttribute("hidden", "true");
			finishButton.setAttribute("hidden", "false");
		}
		// Windows uses a deck to switch between the Next and Finish buttons
		// TODO: check Linux
		else {
			var buttons = document.getAnonymousElementByAttribute(_wizard, "anonid", "Buttons");
			var deck = document.getAnonymousElementByAttribute(buttons, "anonid", "WizardButtonDeck");
			deck.selectedIndex = 0;
		}
		
		_setInstructionsString(finishButton.label);
	}
	
	
	function _setInstructionsString(buttonName) {
		switch (_mergeGroup.type) {
			case 'file':
				var msg = 'fileChanged';
				break;
			
			default:
				// TODO: maybe don't always call it 'item'
				var msg = 'itemChanged';
		}
		
		msg = Zotero.getString('sync.conflict.' + msg, buttonName)
		document.getElementById('zotero-merge-instructions').value = msg;
	}
	
	
	function _error(e) {
		Zotero.debug(e);
		_io.error = e;
		_wizard.getButton('cancel').click();
	}
}
