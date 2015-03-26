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
	this.init = init;
	this.onBack = onBack;
	this.onNext = onNext;
	this.onFinish = onFinish;
	this.onCancel = onCancel;
	
	var _wizard = null;
	var _wizardPage = null;
	var _mergeGroup = null;
	var _numObjects = null;
	
	var _initialized = false;
	var _io = null;
	var _objects = null;
	var _merged = [];
	var _pos = -1;
	
	function init() {
		_wizard = document.getElementsByTagName('wizard')[0];
		_wizardPage = document.getElementsByTagName('wizardpage')[0];
		_mergeGroup = document.getElementsByTagName('zoteromergegroup')[0];
		
		_wizard.setAttribute('width', Math.min(980, screen.width - 20));
		_wizard.setAttribute('height', Math.min(718, screen.height - 30));
		
		// Set font size from pref
		Zotero.setFontSize(_wizardPage);
		
		_wizard.getButton('cancel').setAttribute('label', Zotero.getString('sync.cancel'));
		
		_io = window.arguments[0];
		_objects = _io.dataIn.objects;
		if (!_objects.length) {
			// TODO: handle no objects
			return;
		}
		
		_mergeGroup.type = _io.dataIn.type;
		_mergeGroup.onSelectionChange = _updateResolveAllCheckbox;
		
		switch (_mergeGroup.type) {
			case 'item':
			case 'storagefile':
				break;
			
			default:
				_error("Unsupported merge object type '" + _mergeGroup.type
					+ "' in Zotero_Merge_Window.init()");
				return;
		}
		
		_mergeGroup.leftCaption = _io.dataIn.captions[0];
		_mergeGroup.rightCaption = _io.dataIn.captions[1];
		_mergeGroup.mergeCaption = _io.dataIn.captions[2];
		
		_resolveAllCheckbox = document.getElementById('resolve-all');
		
		_numObjects = document.getElementById('zotero-merge-num-objects');
		document.getElementById('zotero-merge-total-objects').value = _objects.length;
		
		this.onNext();
	}
	
	
	function onBack() {
		_pos--;
		
		if (_pos == 0) {
			_wizard.canRewind = false;
		}
		
		_merged[_pos + 1] = _getCurrentMergeObject();
		
		_numObjects.value = _pos + 1;
		
		_mergeGroup.left = _objects[_pos][0];
		_mergeGroup.right = _objects[_pos][1];
		
		// Restore previously merged object into merge pane
		_mergeGroup.merge = _merged[_pos].ref;
		if (_merged[_pos].id == _mergeGroup.left.id) {
			_mergeGroup.leftpane.setAttribute("selected", "true");
			_mergeGroup.rightpane.removeAttribute("selected");
		}
		else {
			_mergeGroup.leftpane.removeAttribute("selected");
			_mergeGroup.rightpane.setAttribute("selected", "true");
		}
		_updateResolveAllCheckbox();
		
		if (_mergeGroup.type == 'item') {
			_updateChangedCreators();
		}
		
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
	
	
	function onNext() {
		if (_pos + 1 == _objects.length || _resolveAllCheckbox.checked) {
			return true;
		}
		
		_pos++;
		
		if (_pos == 0) {
			_wizard.canRewind = false;
		}
		else {
			_wizard.canRewind = true;
			
			// Save merged object to return array
			_merged[_pos - 1] = _getCurrentMergeObject();
		}
		
		// Adjust counter
		_numObjects.value = _pos + 1;
		
		try {
			_mergeGroup.left = _objects[_pos][0];
			_mergeGroup.right = _objects[_pos][1];
			
			// Restore previously merged object into merge pane
			if (_merged[_pos]) {
				_mergeGroup.merge = _merged[_pos].ref;
				_mergeGroup.leftpane.removeAttribute("selected");
				_mergeGroup.rightpane.removeAttribute("selected");
			}
		}
		catch (e) {
			_error(e);
			return;
		}
		
		_updateResolveAllCheckbox();
		
		if (_mergeGroup.type == 'item') {
			_updateChangedCreators();
		}
		
		if (_isLastConflict()) {
			_showFinishButton();
		}
		else {
			_showNextButton();
		}
		
		return false;
	}
	
	
	function onFinish() {
		// If using one side for all remaining, update merge object
		if (!_isLastConflict() && _resolveAllCheckbox.checked) {
			let useRemote = _mergeGroup.rightpane.getAttribute("selected") == "true";
			for (let i = _pos; i < _objects.length; i++) {
				_merged[i] = _getMergeObject(
					_objects[i][useRemote ? 1 : 0],
					_objects[i][0],
					_objects[i][1]
				);
			}
		}
		else {
			_merged[_pos] = _getCurrentMergeObject();
		}
		
		_io.dataOut = _merged;
		return true;
	}
	
	
	function onCancel() {
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
	
	function _updateResolveAllCheckbox() {
		if (_mergeGroup.rightpane.getAttribute("selected") == 'true') {
			var label = 'sync.merge.resolveAllRemote';
		}
		else {
			var label = 'sync.merge.resolveAllLocal';
		}
		_resolveAllCheckbox.label = Zotero.getString(label);
	}
	
	
	function _isLastConflict() {
		return (_pos + 1) == _objects.length;
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
	
	
	function _getMergeObject(ref, left, right) {
		var id = ref == 'deleted'
			? (left == 'deleted' ? right.id : left.id)
			: ref.id;
		
		return {
			id: id,
			ref: ref,
			left: left,
			right: right
		};
	}
	
	
	function _getCurrentMergeObject() {
		return _getMergeObject(_mergeGroup.merge, _mergeGroup.left, _mergeGroup.right);
	}
	
	
	// Hack to support creator reconciliation via item view
	function _updateChangedCreators() {
		if (_mergeGroup.type != 'item') {
			_error("_updateChangedCreators called on non-item object in "
				+ "Zotero_Merge_Window._updateChangedCreators()");
			return;
		}
		
		if (_io.dataIn.changedCreators) {
			var originalCreators = _mergeGroup.rightpane.original.getCreators();
			var clonedCreators = _mergeGroup.rightpane.ref.getCreators();
			var refresh = false;
			for (var i in originalCreators) {
				var changedCreator = _io.dataIn.changedCreators[Zotero.Creators.getLibraryKeyHash(originalCreators[i].ref)];
				if (changedCreator) {
					_mergeGroup.rightpane.original.setCreator(
						i, changedCreator, originalCreators[i].creatorTypeID
					);
					clonedCreators[i].ref = changedCreator;
					refresh = true;
				}
			}
			
			if (refresh) {
				_mergeGroup.rightpane.objectbox.refresh();
				_mergeGroup.mergepane.objectbox.refresh();
			}
		}
	}
	
	
	// TEMP
	function _setInstructionsString(buttonName) {
		switch (_mergeGroup.type) {
			case 'storagefile':
				var msg = Zotero.getString('sync.conflict.fileChanged');
				break;
			
			default:
				// TODO: cf. localization: maybe not always call it 'item'
				var msg = Zotero.getString('sync.conflict.itemChanged');
		}
		
		msg += " " + Zotero.getString('sync.conflict.chooseVersionToKeep', buttonName);
		
		document.getElementById('zotero-merge-instructions').value = msg;
	}
	
	
	function _error(e) {
		Zotero.debug(e);
		_io.error = e;
		_wizard.getButton('cancel').click();
	}
}
