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

Zotero.Translate.ItemSaver = function(libraryID, attachmentMode, forceTagType) {
	// initialize constants
	this.newItems = [];
	this.newCollections = [];
	this._IDMap = {};
	
	// determine library ID
	if(libraryID === false) {
		this._libraryID = false;
	} else if(libraryID === true || libraryID == undefined) {
		this._libraryID = null;
	} else {
		this._libraryID = libraryID;
	}
	
	// determine whether to save files and attachments
	if (attachmentMode == Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD) {
		this._saveAttachment = this._saveAttachmentDownload;
	} else if(attachmentMode == Zotero.Translate.ItemSaver.ATTACHMENT_MODE_FILE) {
		this._saveAttachment = this._saveAttachmentFile;
	} else {
		this._saveAttachment = function() {};
	}
	
	this._saveFiles = !(attachmentMode === 0);
	
	// If group filesEditable==false, don't save attachments
	if (typeof this._libraryID == 'number') {
		var type = Zotero.Libraries.getType(this._libraryID);
		switch (type) {
			case 'group':
				var groupID = Zotero.Groups.getGroupIDFromLibraryID(this._libraryID);
				var group = Zotero.Groups.get(groupID);
				if (!group.filesEditable) {
					this._saveFiles = false;
				}
				break;
		}
	}
	
	// force tag types if requested
	this._forceTagType = forceTagType;
};

Zotero.Translate.ItemSaver.ATTACHMENT_MODE_IGNORE = 0;
Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD = 1;
Zotero.Translate.ItemSaver.ATTACHMENT_MODE_FILE = 2;

Zotero.Translate.ItemSaver.prototype = {
	"saveItem":function(item) {
		// Get typeID, defaulting to "webpage"
		var type = (item.itemType ? item.itemType : "webpage");
		
		if(type == "note") {			// handle notes differently
			var newItem = new Zotero.Item('note');
			newItem.libraryID = this._libraryID;
			newItem.setNote(item.note);
			var myID = newItem.save();
			var newItem = Zotero.Items.get(myID);
		} else {
			if(type == "attachment") {	// handle attachments differently
				var newItem = this._saveAttachment(item);
			} else {
				var typeID = Zotero.ItemTypes.getID(type);
				var newItem = new Zotero.Item(typeID);
				newItem._libraryID = this._libraryID;
			}
			
			this._saveFields(item, newItem);
			
			// handle creators
			if(item.creators) {
				this._saveCreators(item, newItem);
			}
			
			// save item
			var myID = newItem.save();
			newItem = Zotero.Items.get(myID);
			
			// handle notes
			if(item.notes) {
				this._saveNotes(item, myID);
			}
			
			// handle attachments
			if(item.attachments) {
				for(var i=0; i<item.attachments.length; i++) {
					this._saveAttachment(item.attachments[i], myID);
				}
			}
		}
		
		if(item.itemID) this._IDMap[item.itemID] = myID;
		
		// handle see also
		this._saveTags(item, newItem);
		
		// add to new item list
		this.newItems.push(myID);
		
		newItem = Zotero.Items.get(myID);
		return newItem;
	},
	
	"saveCollection":function(collection) {
		var collectionsToProcess = [collection];
		var parentIDs = [null];
		var topLevelCollection;
		
		while(collectionsToProcess) {
			var collection = collectionsToProcess.shift();
			var parentID = parentIDs.shift();
			
			var newCollection = Zotero.Collections.add(collection.name, parentID);
			if(parentID === null) topLevelCollection = newCollection;
			
			this.newCollections.push(newCollection.id);
			
			var toAdd = [];
			
			for each(child in collection.children) {
				if(child.type == "collection") {
					// do recursive processing of collections
					collectionsToProcess.push(child);
					parentIDs.push(newCollection.id);
				} else {
					// add mapped items to collection
					if(this._IDMap[child.id]) {
						toAdd.push(this._IDMap[child.id]);
					} else {
						Zotero.debug("Translate: Could not map "+child.id+" to an imported item", 2);
					}
				}
			}
			
			if(toAdd.length) {
				Zotero.debug("Translate: Adding " + toAdd, 5);
				newCollection.addItems(toAdd);
			}
		}
		
		return topLevelCollection;
	},
	
	"_saveAttachmentFile":function(attachment, parentID) {
		const urlRe = /(([A-Za-z]+):\/\/[^\s]*)/i;
		Zotero.debug("Translate: Adding attachment", 4);
			
		if(!attachment.url && !attachment.path) {
			Zotero.debug("Translate: Ignoring attachment: no path or URL specified", 2);
			return;
		}
		
		if(!attachment.path) {
			// see if this is actually a file URL
			var m = urlRe.exec(attachment.url);
			var protocol = m ? m[2].toLowerCase() : "";
			if(protocol == "file") {
				attachment.path = attachment.url;
				attachment.url = false;
			} else if(protocol != "http" && protocol != "https") {
				Zotero.debug("Translate: Unrecognized protocol "+protocol, 2);
				return;
			}
		}
		
		if(!attachment.path) {
			// create from URL
			try {
				var myID = Zotero.Attachments.linkFromURL(attachment.url, parentID,
						(attachment.mimeType ? attachment.mimeType : undefined),
						(attachment.title ? attachment.title : undefined));
			} catch(e) {
				Zotero.debug("Translate: Error adding attachment "+attachment.url, 2);
				return;
			}
			Zotero.debug("Translate: Created attachment; id is "+myID, 4);
			var newItem = Zotero.Items.get(myID);
		} else {
			var uri, file;
			
			// generate nsIFile
			var IOService = Components.classes["@mozilla.org/network/io-service;1"].
							getService(Components.interfaces.nsIIOService);
			try {
				var uri = IOService.newURI(attachment.path, "", null);
			}
			catch (e) {
				var msg = "Error parsing attachment path: " + attachment.path;
				Zotero.logError(msg);
				Zotero.debug("Translate: " + msg, 2);
			}
			
			if (uri) {
				try {
					var file = uri.QueryInterface(Components.interfaces.nsIFileURL).file;
					if (file.path == '/') {
						var msg = "Error parsing attachment path: " + attachment.path;
						Zotero.logError(msg);
						Zotero.debug("Translate: " + msg, 2);
					}
				}
				catch (e) {
					var msg = "Error getting file from attachment path: " + attachment.path;
					Zotero.logError(msg);
					Zotero.debug("Translate: " + msg, 2);
				}
			}
			
			if (!file || !file.exists()) {
				// use attachment title if possible, or else file leaf name
				var title = attachment.title;
				if(!title) {
					title = file ? file.leafName : '';
				}
				
				var myID = Zotero.Attachments.createMissingAttachment(
					attachment.url ? Zotero.Attachments.LINK_MODE_IMPORTED_URL
						: Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
					file, attachment.url ? attachment.url : null, title,
					attachment.mimeType, attachment.charset, parentID);
			}
			else if (attachment.url) {
				var myID = Zotero.Attachments.importSnapshotFromFile(file,
					attachment.url, attachment.title, attachment.mimeType, attachment.charset,
					parentID);
			}
			else {
				var myID = Zotero.Attachments.importFromFile(file, parentID);
			}
		}
		
		var newItem = Zotero.Items.get(myID);
		
		// save fields
		this._saveFields(attachment, newItem);
		
		// add note if necessary
		if(attachment.note) {
			newItem.setNote(attachment.note);
		}
		
		newItem.save();
		newItem = Zotero.Items.get(myID);
		
		return newItem;
	},
	
	"_saveAttachmentDownload":function(attachment, parentID) {
		Zotero.debug("Translate: Adding attachment", 4);
		
		// determine whether to save attachments at all
		var automaticSnapshots = Zotero.Prefs.get("automaticSnapshots");
		var downloadAssociatedFiles = Zotero.Prefs.get("downloadAssociatedFiles");
		
		if(!attachment.url && !attachment.document) {
			Zotero.debug("Translate: Not adding attachment: no URL specified", 2);
		} else {
			var shouldAttach = ((attachment.document
				|| (attachment.mimeType && attachment.mimeType == "text/html")) && automaticSnapshots)
				|| downloadAssociatedFiles;
			if(!shouldAttach) return;
			
			if(attachment.snapshot === false || !this._saveFiles) {
				// if snapshot is explicitly set to false, attach as link
				if(attachment.document) {
					Zotero.Attachments.linkFromURL(attachment.document.location.href, parentID,
							(attachment.mimeType ? attachment.mimeType : attachment.document.contentType),
							(attachment.title ? attachment.title : attachment.document.title));
				} else {
					if(!attachment.mimeType || !attachment.title) {
						Zotero.debug("Translate: Either mimeType or title is missing; attaching file will be slower", 3);
					}
					
					try {
						Zotero.Attachments.linkFromURL(attachment.url, parentID,
								(attachment.mimeType ? attachment.mimeType : undefined),
								(attachment.title ? attachment.title : undefined));
					} catch(e) {
						Zotero.debug("Translate: Error adding attachment "+attachment.url, 2);
					}
				}
			} else {
				// if snapshot is not explicitly set to false, retrieve snapshot
				if(attachment.document) {
					if(automaticSnapshots) {
						try {
							Zotero.Attachments.importFromDocument(attachment.document, parentID, attachment.title);
						} catch(e) {
							Zotero.debug("Translate: Error attaching document", 2);
						}
					}
				// Save attachment if snapshot pref enabled or not HTML
				// (in which case downloadAssociatedFiles applies)
				} else if(this._saveFiles && (automaticSnapshots || !attachment.mimeType
						|| attachment.mimeType != "text/html")) {
					var mimeType = (attachment.mimeType ? attachment.mimeType : null);
					var title = (attachment.title ? attachment.title : null);

					var fileBaseName = Zotero.Attachments.getFileBaseNameFromItem(parentID);
					try {
						Zotero.Attachments.importFromURL(attachment.url, parentID, title, fileBaseName);
					} catch(e) {
						Zotero.debug("Translate: Error adding attachment "+attachment.url, 2);
					}
				}
			}
		}
	},
	
	"_saveFields":function(item, newItem) {
		// fields that should be handled differently
		const skipFields = ["note", "notes", "itemID", "attachments", "tags", "seeAlso",
							"itemType", "complete", "creators"];
		
		var typeID = Zotero.ItemTypes.getID(item.itemType);
		var fieldID;
		for(var field in item) {
			// loop through item fields
			if(item[field] && skipFields.indexOf(field) === -1 && (fieldID = Zotero.ItemFields.getID(field))) {
				// if field is in db and shouldn't be skipped
				
				// try to map from base field
				if(Zotero.ItemFields.isBaseField(fieldID)) {
					fieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(typeID, fieldID);
					if(fieldID) {
						Zotero.debug("Translate: Mapping "+field+" to "+Zotero.ItemFields.getName(fieldID), 5);	
					}
				}
				
				// if field is valid for this type, set field
				Zotero.debug("Translate: Testing "+fieldID+" "+typeID);
				if(fieldID && Zotero.ItemFields.isValidForType(fieldID, typeID)) {
					newItem.setField(fieldID, item[field]);
				} else {
					Zotero.debug("Translate: Discarded field "+field+" for item: field not valid for type "+item.itemType, 3);
				}
			}
		}
	},
	
	"_saveCreators":function(item, newItem) {
		for(var i=0; i<item.creators.length; i++) {
			var creator = item.creators[i];
			
			// try to assign correct creator type
			if(creator.creatorType) {
				try {
					var creatorTypeID = Zotero.CreatorTypes.getID(creator.creatorType);
				} catch(e) {
					Zotero.debug("Translate: Invalid creator type "+creator.creatorType+" for creator index "+j, 2);
				}
			}
			if(!creatorTypeID) {
				var creatorTypeID = 1;
			}
			
			// Single-field mode
			if (creator.fieldMode && creator.fieldMode == 1) {
				var fields = {
					lastName: creator.lastName,
					fieldMode: 1
				};
			}
			// Two-field mode
			else {
				var fields = {
					firstName: creator.firstName,
					lastName: creator.lastName
				};
			}
			
			var creator = null;
			var creatorDataID = Zotero.Creators.getDataID(fields);
			if(creatorDataID) {
				var linkedCreators = Zotero.Creators.getCreatorsWithData(creatorDataID, this._libraryID);
				if (linkedCreators) {
					// TODO: support identical creators via popup? ugh...
					var creatorID = linkedCreators[0];
					creator = Zotero.Creators.get(creatorID);
				}
			}
			if(!creator) {
				creator = new Zotero.Creator;
				creator.libraryID = this._libraryID;
				creator.setFields(fields);
				var creatorID = creator.save();
			}
			
			newItem.setCreator(i, creator, creatorTypeID);
		}
	},
	
	"_saveNotes":function(item, parentID) {
		for(var i=0; i<item.notes.length; i++) {
			var note = item.notes[i];
			Zotero.debug(note);
			var myNote = new Zotero.Item('note');
			myNote.libraryID = this._libraryID;
			myNote.setNote(typeof note == "object" ? note.note : note);
			if(parentID) {
				myNote.setSource(parentID);
			}
			var noteID = myNote.save();
			
			if(typeof note == "object") {
				// handle see also
				myNote = Zotero.Items.get(noteID);
				this._saveTags(note, myNote);
			}
		}
	},
	
	"_saveTags":function(item, newItem) {
		// add to ID map
		if(item.itemID) {
			this._IDMap[item.itemID] = newItem.id;
		}
		
		// add see alsos
		if(item.seeAlso) {
			for each(var seeAlso in item.seeAlso) {
				if(this._IDMap[seeAlso]) {
					newItem.addRelatedItem(this._IDMap[seeAlso]);
				}
			}
			newItem.save();
		}
		
		// add tags
		if(item.tags) {
			var tagsToAdd = {};
			tagsToAdd[0] = []; // user tags
			tagsToAdd[1] = []; // automatic tags
			
			for(var i=0; i<item.tags.length; i++) {
				var tag = item.tags[i];
				
				if(typeof(tag) == "string") {
					// accept strings in tag array as automatic tags, or, if
					// importing, as non-automatic tags
					if(this._forceTagType) {
						tagsToAdd[this._forceTagType].push(tag);
					} else {
						tagsToAdd[0].push(tag);
					}
				} else if(typeof(tag) == "object") {
					// also accept objects
					if(tag.tag || tag.name) {
						if(this._forceTagType) {
							var tagType = this._forceTagType;
						} else if(tag.type) { 
							var tagType = tag.type;
						} else {
							var tagType = 0;
						}
						tagsToAdd[tagType].push(tag.tag ? tag.tag : tag.name);
					}
				}
			}
			
			for (var type in [0, 1]) {
				if (tagsToAdd[type].length) {
					newItem.addTags(tagsToAdd[type], type);
				}
			}
		}
	}
}

Zotero.Translate.ItemGetter = function() {
	this._itemsLeft = null;
	this._collectionsLeft = null;
	this._exportFileDirectory = null;
};

Zotero.Translate.ItemGetter.prototype = {
	"setItems":function(items) {
		this._itemsLeft = items;
	},
	
	"setCollection":function(collection, getChildCollections) {
		// get items in this collection
		this._itemsLeft = collection.getChildItems();
		if(!this._itemsLeft) {
			this._itemsLeft = [];
		}
		
		if(getChildCollections) {
			// get child collections
			this._collectionsLeft = Zotero.getCollections(collection.id, true);
			
			if(this._collectionsLeft.length) {
				// only include parent collection if there are actually children
				this._collectionsLeft.unshift(getChildren);
			}
			
			// get items in child collections
			for each(var collection in this._collectionsLeft) {
				var childItems = collection.getChildItems();
				if(childItems) {
					this._itemsLeft = this._itemsLeft.concat(childItems);
				}
			}
		}
	},
	
	"setAll":function(getChildCollections) {
		this._itemsLeft = Zotero.Items.getAll(true);
		
		if(getChildCollections) {
			this._collectionsLeft = Zotero.getCollections();
		}
	},
	
	"exportFiles":function(dir) {
		// generate directory
		var directory = Components.classes["@mozilla.org/file/local;1"].
		                createInstance(Components.interfaces.nsILocalFile);
		directory.initWithFile(this.location.parent);
		
		// delete this file if it exists
		if(dir.exists()) {
			dir.remove(true);
		}
		
		// get name
		var name = this.location.leafName;
		directory.append(name);
		
		// create directory
		directory.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0700);
		
		// generate a new location for the exported file, with the appropriate
		// extension
		var location = Components.classes["@mozilla.org/file/local;1"].
		                createInstance(Components.interfaces.nsILocalFile);
		location.initWithFile(directory);
		location.append(name+"."+this.translator[0].target);
		
		// create files directory
		this._exportFileDirectory = Components.classes["@mozilla.org/file/local;1"].
		                            createInstance(Components.interfaces.nsILocalFile);
		this._exportFileDirectory.initWithFile(directory);
		this._exportFileDirectory.append("files");
		this._exportFileDirectory.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0700);
		
		return location;
	},
	
	/**
	 * Converts an attachment to array format and copies it to the export folder if desired
	 */
	"_attachmentToArray":function(attachment) {
		var attachmentArray = this._itemToArray(attachment);
		
		var linkMode = attachment.getAttachmentLinkMode();
		
		// get mime type
		attachmentArray.mimeType = attachmentArray.uniqueFields.mimeType = attachment.getAttachmentMIMEType();
		// get charset
		attachmentArray.charset = attachmentArray.uniqueFields.charset = attachment.getAttachmentCharset();
		
		if(linkMode != Zotero.Attachments.LINK_MODE_LINKED_URL && this._exportFileDirectory) {
			// add path and filename if not an internet link
			var file = attachment.getFile();
			attachmentArray.path = "files/"+attachmentArray.itemID+"/"+file.leafName;
			
			if(linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
				// create a new directory
				var directory = Components.classes["@mozilla.org/file/local;1"].
								createInstance(Components.interfaces.nsILocalFile);
				directory.initWithFile(this._exportFileDirectory);
				directory.append(attachmentArray.itemID);
				// copy file
				try {
					directory.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0700);
					file.copyTo(directory, attachmentArray.filename);
				} catch(e) {
					attachmentArray.path = undefined;
				}
			} else {
				// copy imported files from the Zotero directory
				var directory = file.parent;
				try {
					directory.copyTo(this._exportFileDirectory, attachmentArray.itemID);
				} catch(e) {
					attachmentArray.path = undefined;
				}
			}
		}
		
		attachmentArray.itemType = "attachment";
		
		return attachmentArray;
	},
		
	/**
	 * Converts an item to array format
	 */
	"_itemToArray":function(returnItem) {
		const makeGetter = function(returnItemArray, fieldName) {
			return function() { return returnItemArray[fieldName] };
		}
		
		// TODO use Zotero.Item#serialize()
		var returnItemArray = returnItem.toArray();
		
		// Remove SQL date from multipart dates
		if (returnItemArray.date) {
			returnItemArray.date = Zotero.Date.multipartToStr(returnItemArray.date);
		}
		
		returnItemArray.uniqueFields = {};
		
		// get base fields, not just the type-specific ones
		var itemTypeID = returnItem.itemTypeID;
		var allFields = Zotero.ItemFields.getItemTypeFields(itemTypeID);
		for each(var field in allFields) {
			var fieldName = Zotero.ItemFields.getName(field);
			
			if(returnItemArray[fieldName] !== undefined) {
				var baseField = Zotero.ItemFields.getBaseIDFromTypeAndField(itemTypeID, field);
				
				var baseName = null;
				if(baseField && baseField != field) {
					baseName = Zotero.ItemFields.getName(baseField);
				}
				
				if(baseName) {
					returnItemArray.__defineGetter__(baseName, makeGetter(returnItemArray, fieldName));
					returnItemArray.uniqueFields.__defineGetter__(baseName, makeGetter(returnItemArray, fieldName));
				} else {
					returnItemArray.uniqueFields.__defineGetter__(fieldName, makeGetter(returnItemArray, fieldName));
				}
			}
		}
		
		// preserve notes
		if(returnItemArray.note) returnItemArray.uniqueFields.note = returnItemArray.note;
		
		// TODO: Change tag.tag references in translators to tag.name
		// once translators are 1.5-only
		// TODO: Preserve tag type?
		if (returnItemArray.tags) {
			for (var i in returnItemArray.tags) {
				returnItemArray.tags[i].tag = returnItemArray.tags[i].fields.name;
			}
		}
		
		return returnItemArray;
	},
	
	"nextItem":function() {
		while(this._itemsLeft.length != 0) {
			var returnItem = this._itemsLeft.shift();
			// export file data for single files
			if(returnItem.isAttachment()) {		// an independent attachment
				var returnItemArray = this._attachmentToArray(returnItem);
				if(returnItemArray) return returnItemArray;
			} else {
				returnItemArray = this._itemToArray(returnItem);
				
				// get attachments, although only urls will be passed if exportFileData
				// is off
				returnItemArray.attachments = new Array();
				var attachments = returnItem.getAttachments();
				for each(var attachmentID in attachments) {
					var attachment = Zotero.Items.get(attachmentID);
					var attachmentInfo = this._attachmentToArray(attachment);
					
					if(attachmentInfo) {
						returnItemArray.attachments.push(attachmentInfo);
					}
				}
				
				return returnItemArray;
			}
		}
		return false;
	},
	
	"nextCollection":function() {
		if(!this._collectionsLeft || !this._collectionsLeft.length == 0) return false;
	
		var returnItem = this._collectionsLeft.shift();
		var obj = returnItem.serialize(true);
		obj.id = obj.primary.collectionID;
		obj.name = obj.fields.name;
		return obj;
	}
}