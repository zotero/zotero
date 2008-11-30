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
		
		// TODO: localize
		_wizard.getButton('cancel').setAttribute('label', "Cancel Sync")
		
		_io = window.arguments[0];
		_objects = _io.dataIn.objects;
		if (!_objects.length) {
			// TODO: handle no objects
			return;
		}
		
		_mergeGroup.type = _io.dataIn.type;
		
		switch (_mergeGroup.type) {
			case 'item':
				var firstObj = _objects[0][0] == 'deleted' ? _objects[0][1] : _objects[0][0];
				if (firstObj.isNote()) {
					_mergeGroup.type = 'note';
				}
				else {
					_mergeGroup.type = 'item';
				}
				break;
			
			case 'collection':
				break;
				
			default:
				throw ("Unsupported merge object type '" + type
					+ "' in Zotero_Merge_Window.init()");
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
		
		_mergeGroup.left = _objects[_pos][0];
		_mergeGroup.right = _objects[_pos][1];
		
		// Restore previously merged object into merge pane
		if (_merged[_pos]) {
			_mergeGroup.merge = _merged[_pos].ref;
			_mergeGroup.leftpane.removeAttribute("selected");
			_mergeGroup.rightpane.removeAttribute("selected");
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
			throw ("_updateChangedCreators called on non-item object in "
				+ "Zotero_Merge_Window._updateChangedCreators()");
		}
		
		if (_io.dataIn.changedCreators) {
			var originalCreators = _mergeGroup.rightpane.original.getCreators();
			var clonedCreators = _mergeGroup.rightpane.ref.getCreators();
			var refresh = false;
			for (var i in originalCreators) {
				if (_io.dataIn.changedCreators[originalCreators[i].ref.id]) {
					var changedCreator = _io.dataIn.changedCreators[originalCreators[i].ref.id];
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
}
