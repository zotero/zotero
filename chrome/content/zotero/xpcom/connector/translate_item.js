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
	
	this._timeoutID = null;
}

Zotero.Translate.ItemSaver.ATTACHMENT_MODE_IGNORE = 0;
Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD = 1;
Zotero.Translate.ItemSaver.ATTACHMENT_MODE_FILE = 2;

Zotero.Translate.ItemSaver.prototype = {
	/**
	 * Saves items to Standalone or the server
	 */
	"saveItems":function(items, callback) {
		var me = this;
		// first try to save items via connector
		Zotero.Connector.callMethod("saveItems", {"items":items}, function(success, status) {
			if(success !== false) {
				Zotero.debug("Translate: Save via Standalone succeeded");
				callback(true, items);
			} else if(Zotero.isFx) {
				callback(false, new Error("Save via Standalone failed with "+status));
			} else {
				me._saveToServer(items, callback);
			}
		});
	},
	
	/**
	 * Saves items to server
	 */
	"_saveToServer":function(items, callback) {
		const IGNORE_FIELDS = ["seeAlso", "attachments", "complete"];
		
		var newItems = [];
		for(var i in items) {
			var item = items[i];
			
			var newItem = {};
			newItems.push(newItem);
			
			var typeID = Zotero.ItemTypes.getID(item.itemType);
			if(!typeID) {
				Zotero.debug("Translate: Invalid itemType "+item.itemType+"; saving as webpage");
				item.itemType = "webpage";
				typeID = Zotero.ItemTypes.getID(item.itemType);
			}
			
			var fieldID;
			for(var field in item) {
				if(IGNORE_FIELDS.indexOf(field) !== -1) continue;
				
				var val = item[field];
				
				if(field === "itemType") {
					newItem[field] = val;
				} else if(field === "creators") {
					// normalize creators
					var newCreators = newItem.creators = [];
					for(var j in val) {
						var creator = val[j];
						
						// Single-field mode
						if (!creator.firstName || (creator.fieldMode && creator.fieldMode == 1)) {
							var newCreator = {
								name: creator.lastName
							};
						}
						// Two-field mode
						else {
							var newCreator = {
								firstName: creator.firstName,
								lastName: creator.lastName
							};
						}
						
						// ensure creatorType is present and valid
						newCreator.creatorType = "author";
						if(creator.creatorType) {
							if(Zotero.CreatorTypes.getID(creator.creatorType)) {
								newCreator.creatorType = creator.creatorType;
							} else {
								Zotero.debug("Translate: Invalid creator type "+creator.creatorType+"; falling back to author");
							}
						}
						
						newCreators.push(newCreator);
					}
				} else if(field === "tags") {
					// normalize tags
					var newTags = newItem.tags = [];
					for(var j in val) {
						var tag = val[j];
						if(typeof tag === "object") {
							if(tag.tag) {
								tag = tag.tag;
							} else if(tag.name) {
								tag = tag.name;
							} else {
								Zotero.debug("Translate: Discarded invalid tag");
								continue;
							}
						}
						newTags.push({"tag":tag.toString(), "type":1})
					}
				} else if(field === "notes") {
					// normalize notes
					var newNotes = newItem.notes = [];
					for(var j in val) {
						var note = val[j];
						if(typeof note === "object") {
							if(!note.note) {
								Zotero.debug("Translate: Discarded invalid note");
								continue;
							}
							note = note.note;
						}
						newNotes.push({"itemType":"note", "note":note.toString()});
					}
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
		var payload = JSON.stringify({"items":newItems}, null, "\t")
		
		Zotero.OAuth.doAuthenticatedPost(url, payload, function(status, message) {
			if(!status) {
				Zotero.debug("Translate: Save to server failed with message "+message+"; payload:\n\n"+payload);
				callback(false, new Error("Save to server failed with "+message));
			} else {
				Zotero.debug("Translate: Save to server complete");
				callback(true, newItems);
			}
		}, true);
	}
};