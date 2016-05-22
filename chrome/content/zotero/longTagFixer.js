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


var Zotero_Long_Tag_Fixer = new function () {
	var _oldTag = window.arguments[0];
	var _dataOut = window.arguments[1];
	
	this.init = function () {
		document.getElementById('zotero-old-tag').value = _oldTag;
		document.getElementById('zotero-old-tag-delimiter').nextSibling.value = Zotero.getString('general.character.singular');
		
		var delimiter = Zotero.Prefs.get('lastLongTagDelimiter');
		document.getElementById('zotero-old-tag-delimiter').value = delimiter;
		
		var lastMode = Zotero.Prefs.get('lastLongTagMode');
		if (!lastMode) {
			lastMode = 0;
		}
		this.switchMode(lastMode);
	}
	
	this.switchMode = function (index) {
		var dialog = document.getElementById('zotero-long-tag-fixer');
		
		document.getElementById('zotero-new-tag-actions').selectedIndex = index;
		
		switch (index) {
			case 0:
				var buttonLabel = "saveTags";
				this.updateTagList();
				document.getElementById('zotero-old-tag-delimiter').select();
				break;
				
			case 1:
				var buttonLabel = "saveTag";
				document.getElementById('zotero-new-tag-editor').value = _oldTag;
				this.updateEditLength(_oldTag.length)
				break;
				
			case 2:
				var buttonLabel = "deleteTag";
				dialog.getButton('accept').disabled = false;
				break;
		}
		
		document.getElementById('zotero-long-tag-fixer').getButton('accept').label = Zotero.getString('sync.longTagFixer.' + buttonLabel);
		window.sizeToContent();
		Zotero.Prefs.set('lastLongTagMode', index);
	}
	
	
	/**
	 * Split tags and populate list
	 */
	this.updateTagList = function () {
		var listbox = document.getElementById('zotero-new-tag-list');
		while (listbox.childNodes.length) {
			listbox.removeChild(listbox.lastChild);
		}
		
		var delimiter = document.getElementById('zotero-old-tag-delimiter').value;
		if (delimiter) {
			Zotero.Prefs.set('lastLongTagDelimiter', delimiter);
			var re = new RegExp("\\s*" + delimiter.replace(/([\.\-\[\]\(\)\?\*\+])/g, "\\$1") + "\\s*");
			var tags = _oldTag.split(re);
		}
		
		var acceptButton = document.getElementById('zotero-long-tag-fixer').getButton('accept');
		if (!delimiter || tags.length < 2) {
			acceptButton.disabled = true;
			return;
		}
		else {
			acceptButton.disabled = false;
		}
		
		tags.sort();
		for (var i=0; i<tags.length; i++) {
			if (i != 0 && tags[i] == tags[i-1]) {
				continue;
			}
			if (!tags[i]) {
				continue;
			}
			var li = listbox.appendItem(tags[i]);
			li.setAttribute('type', 'checkbox');
			li.setAttribute('checked', 'true');
		}
		
		window.sizeToContent();
	}
	
	
	this.deselectAll = function () {
		var lis = document.getElementById('zotero-new-tag-list').getElementsByTagName('listitem');
		for (var i=0; i<lis.length; i++) {
			lis[i].checked = false;
		}
	}
	
	
	this.selectAll = function () {
		var lis = document.getElementById('zotero-new-tag-list').getElementsByTagName('listitem');
		for (var i=0; i<lis.length; i++) {
			lis[i].checked = true;
		}
	}
	
	
	this.updateEditLength = function (len) {
		document.getElementById('zotero-new-tag-character-count').value = len;
		var invalid = len == 0 || len > Zotero.Tags.MAX_SYNC_LENGTH;
		document.getElementById('zotero-new-tag-characters').setAttribute('invalid', invalid);
		document.getElementById('zotero-long-tag-fixer').getButton('accept').disabled = invalid;
	}
	
	
	this.cancel = function () {
		_dataOut.result = false;
	}
	
	
	this.save = function () {
		try {
		
		var result = {};
		
		var index = document.getElementById('zotero-new-tag-actions').selectedIndex;
		
		switch (index) {
			// Split
			case 0:
				// Get checked tags
				var listbox = document.getElementById('zotero-new-tag-list');
				var len = listbox.childElementCount;
				var newTags = [];
				for (var i=0; i<len; i++) {
					var li = listbox.childNodes[i];
					if (li.getAttribute('checked') == 'true') {
						newTags.push(li.getAttribute('label'));
					}
				}
				
				result.op = 'split';
				result.tags = newTags;
				break;
			
			// Edit
			case 1:
				result.op = 'edit';
				result.tag = document.getElementById('zotero-new-tag-editor').value;
				break;
			
			// Delete
			case 2:
				result.op = 'delete';
				break;
		}
		
		_dataOut.result = result;
		
		}
		catch (e) {
			Zotero.debug(e);
			throw (e);
		}
	}
}
