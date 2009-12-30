/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
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
		
		if (screen.width > 1000) {
			_wizard.setAttribute('zoterowidescreen', 'true');
		}
		
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
		_mergeGroup.leftpane.removeAttribute("selected");
		_mergeGroup.rightpane.removeAttribute("selected");
		
		if (_mergeGroup.type == 'item') {
			_updateChangedCreators();
		}
		
		if (Zotero.isMac) {
			_wizard.getButton("next").setAttribute("hidden", "false");
			_wizard.getButton("finish").setAttribute("hidden", "true");
		}
		else {
			var buttons = document.getAnonymousElementByAttribute(_wizard, "anonid", "Buttons");
			var deck = document.getAnonymousElementByAttribute(buttons, "anonid", "WizardButtonDeck");
			deck.selectedIndex = 1;
		}
	}
	
	
	function onNext() {
		if (_pos + 1 == _objects.length) {
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
		
		if (_mergeGroup.type == 'item') {
			_updateChangedCreators();
		}
		
		// On Windows the buttons don't move when one is hidden
		if ((_pos + 1) != _objects.length) {
			if (Zotero.isMac) {
				_wizard.getButton("next").setAttribute("hidden", "false");
				_wizard.getButton("finish").setAttribute("hidden", "true");
			}
			else {
				var buttons = document.getAnonymousElementByAttribute(_wizard, "anonid", "Buttons");
				var deck = document.getAnonymousElementByAttribute(buttons, "anonid", "WizardButtonDeck");
				deck.selectedIndex = 1;
			}
		}
		// Last object
		else {
			if (Zotero.isMac) {
				_wizard.getButton("next").setAttribute("hidden", "true");
				_wizard.getButton("finish").setAttribute("hidden", "false");
			}
			// Windows uses a deck to switch between the Next and Finish buttons
			// TODO: check Linux
			else {
				var buttons = document.getAnonymousElementByAttribute(_wizard, "anonid", "Buttons");
				var deck = document.getAnonymousElementByAttribute(buttons, "anonid", "WizardButtonDeck");
				deck.selectedIndex = 0;
			}
		}
		
		return false;
	}
	
	
	function onFinish() {
		_merged[_pos] = _getCurrentMergeObject();
		
		_io.dataOut = _merged;
		return true;
	}
	
	
	function onCancel() {
		// if already merged, ask
	}
	
	
	function _getCurrentMergeObject() {
		var id = _mergeGroup.merge == 'deleted' ?
			(_mergeGroup.left == 'deleted'
				? _mergeGroup.right.id : _mergeGroup.left.id)
			: _mergeGroup.merge.id;
		
		return {
			id: id,
			ref: _mergeGroup.merge,
			left: _mergeGroup.left,
			right: _mergeGroup.right
		};
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
	
	
	function _error(e) {
		Zotero.debug(e);
		_io.error = e;
		_wizard.getButton('cancel').click();
	}
}
