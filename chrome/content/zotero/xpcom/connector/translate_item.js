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

Zotero.Translate.ItemSaver = function(libraryID, attachmentMode, forceTagType) {
	this.newItems = [];
	
	this._itemsToSaveToServer = [];
	this._timeoutID = null;
}

Zotero.Translate.ItemSaver.ATTACHMENT_MODE_IGNORE = 0;
Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD = 1;
Zotero.Translate.ItemSaver.ATTACHMENT_MODE_FILE = 2;

Zotero.Translate.ItemSaver.prototype = {
	"saveItem":function(item) {
		// don't save documents as documents, since we can't pass them around
		for(var i in item.attachments) {
			if(item.attachments[i].document) {
				item.attachments[i].url = item.attachments[i].document.location.href;
				delete item.attachments[i].document;
			}
		}
		
		// save items
		this.newItems.push(item);
		var me = this;
		Zotero.Connector.callMethod("saveItems", {"items":[item]}, function(success) {
			if(success === false && !Zotero.isFx) {
				// attempt to save to server on a timer
				if(me._timeoutID) clearTimeout(me._timeoutID);
				me._itemsToSaveToServer.push(item);
				setTimeout(function() { me._saveToServer() }, 2000);
			}
		});
	},
	
	"_saveToServer":function() {
		const IGNORE_FIELDS = ["seeAlso", "attachments", "complete"];
		
		// clear timeout, since saving has begin
		this._timeoutID = null;
		
		var newItems = new Array(this._itemsToSaveToServer.length);
		for(var i in this._itemsToSaveToServer) {
			var item = this._itemsToSaveToServer[i];
			var newItem = newItems[i] = {};
			
			var typeID = Zotero.ItemTypes.getID(item.itemType);
			var fieldID;
			for(var field in item) {
				if(IGNORE_FIELDS.indexOf(field) !== -1) continue;
				
				var val = item[field];
				
				if(field === "itemType") {
					newItem[field] = val;
				} else if(field === "creators") {
					// TODO normalize
					newItem[field] = val;
				} else if(field === "tags") {
					// TODO normalize
					newItem[field] = val;
				} else if(field === "notes") {
					// TODO normalize
					newItem[field] = val;
				} else if(fieldID = Zotero.ItemFields.getID(field)) {
					// if content is not a string, either stringify it or delete it
					if(typeof val !== "string") {
						if(val || val === 0) {
							val = val.toString();
						} else {
							continue;
						}
					}
					
					// map from base field if possible
					var itemFieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(typeID, fieldID);
					if(itemFieldID) {
						newItem[Zotero.ItemFields.getName(itemFieldID)] = val;
						continue;	// already know this is valid
					}
					
					// if field is valid for this type, set field
					if(Zotero.ItemFields.isValidForType(fieldID, typeID)) {
						newItem[field] = val;
					} else {
						Zotero.debug("Translate: Discarded field "+field+": field not valid for type "+item.itemType, 3);
					}
				} else if(field !== "complete") {
					Zotero.debug("Translate: Discarded unknown field "+field, 3);
				}
			}
		}
		
		var url = 'users/%%USERID%%/items?key=%%APIKEY%%';
		var payload = JSON.stringify({"items":newItems});
		this._itemsToSaveToServer = [];
		
		Zotero.OAuth.doAuthenticatedPost(url, payload, function(status, message) {
			if(!status) {
				Zotero.Messaging.sendMessage("saveDialog_error", status);
				throw new Error("Translate: Save to server failed: "+message);
			}
		}, true);
	}
};