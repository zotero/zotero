var Zotero_Long_Tag_Fixer = new function () {
	var _oldTag = window.arguments[0];
	var _dataOut = window.arguments[1];
	
	this.init = function () {
		document.getElementById('zotero-old-tag').value = _oldTag;
		
		var lastMode = Zotero.Prefs.get('lastLongTagMode');
		if (!lastMode) {
			lastMode = 0;
		}
		this.switchMode(lastMode);
	}
	
	this.switchMode = function (index) {
		var dialog = document.getElementById('zotero-long-tag-fixer');
		
		document.getElementById('zotero-new-tag-actions').selectedIndex = index;
		
		// TODO: localize
		switch (index) {
			case 0:
				var buttonLabel = "Save Tags";
				this.updateTagList();
				break;
				
			case 1:
				var buttonLabel = "Save Tag";
				document.getElementById('zotero-new-tag-editor').value = _oldTag;
				this.updateEditLength(_oldTag.length)
				break;
				
			case 2:
				var buttonLabel = "Delete Tag";
				dialog.getButton('accept').disabled = false;
				break;
		}
		
		document.getElementById('zotero-long-tag-fixer').getButton('accept').label = buttonLabel;
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
			var re = new RegExp("\\s*" + delimiter + "\\s*");
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
			if (i==0 || tags[i] == tags[i-1]) {
				continue;
			}
			var li = listbox.appendItem(tags[i]);
			li.setAttribute('type', 'checkbox');
			li.setAttribute('checked', 'true');
		}
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
		var invalid = len == 0 || len > 255;
		document.getElementById('zotero-new-tag-characters').setAttribute('invalid', invalid);
		document.getElementById('zotero-long-tag-fixer').getButton('accept').disabled = invalid;
	}
	
	
	this.cancel = function () {
		_dataOut.result = false;
	}
	
	
	this.save = function () {
		try {
		
		var index = document.getElementById('zotero-new-tag-actions').selectedIndex;
		
		// Search for all matching tags across all libraries
		var sql = "SELECT tagID FROM tags WHERE name=?";
		var oldTagIDs = Zotero.DB.columnQuery(sql, _oldTag);
		
		switch (index) {
			// Split
			case 0:
				// Get checked tags
				var listbox = document.getElementById('zotero-new-tag-list');
				var len = Zotero.isFx3 ? listbox.childNodes.length : listbox.childElementCount;
				var newTags = [];
				for (var i=0; i<len; i++) {
					var li = listbox.childNodes[i];
					if (li.getAttribute('checked') == 'true') {
						newTags.push(li.getAttribute('label'));
					}
				}
				
				Zotero.DB.beginTransaction();
				
				// Add new tags to all items linked to each matching old tag
				for (var i=0; i<oldTagIDs.length; i++) {
					var tag = Zotero.Tags.get(oldTagIDs[i]);
					var items = tag.getLinkedItems();
					if (items) {
						for (var j=0; j<items.length; j++) {
							items[j].addTags(newTags, tag.type);
						}
					}
				}
				
				// Remove old tags
				Zotero.Tags.erase(oldTagIDs);
				Zotero.Tags.purge();
				Zotero.DB.commitTransaction();
				break;
			
			// Edit
			case 1:
				var value = document.getElementById('zotero-new-tag-editor').value;
				Zotero.DB.beginTransaction();
				for (var i=0; i<oldTagIDs.length; i++) {
					var tag = Zotero.Tags.get(oldTagIDs[i]);
					tag.name = value;
					tag.save();
				}
				Zotero.DB.commitTransaction();
				break;
			
			// Delete
			case 2:
				Zotero.DB.beginTransaction();
				Zotero.Tags.erase(oldTagIDs);
				Zotero.Tags.purge();
				Zotero.DB.commitTransaction();
				break;
		}
		
		_dataOut.result = true;
		
		}
		catch (e) {
			Zotero.debug(e);
			throw (e);
		}
	}
}
