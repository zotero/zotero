/*
    ***** BEGIN LICENSE BLOCK *****
	
	Copyright (c) 2009  Center for History and New Media
						George Mason University, Fairfax, Virginia, USA
						http://chnm.gmu.edu
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

const RESELECT_KEY_URI = 1;
const RESELECT_KEY_ITEM_KEY = 2;
const RESELECT_KEY_ITEM_ID = 3;

Zotero.Integration = new function() {
	var _fifoFile, _osascriptFile;
	
	this.sessions = {};
	
	this.__defineGetter__("usePopup", function () {
		return Zotero.isWin && !Zotero.Prefs.get("integration.realWindow");
	});
	
	/**
	 * Initializes the pipe used for integration on non-Windows platforms.
	 */
	this.init = function() {
		if(!Zotero.isWin) {
			// create a new file representing the pipe
			_fifoFile = Components.classes["@mozilla.org/file/directory_service;1"].
				getService(Components.interfaces.nsIProperties).
				get("Home", Components.interfaces.nsIFile);
			_fifoFile.append(".zoteroIntegrationPipe");
			
			// destroy old pipe, if one exists
			if(_fifoFile.exists()) _fifoFile.remove(false);
			
			// make a new pipe
			var mkfifo = Components.classes["@mozilla.org/file/local;1"].
				createInstance(Components.interfaces.nsILocalFile);
			mkfifo.initWithPath("/usr/bin/mkfifo");
			if(!mkfifo.exists()) mkfifo.initWithPath("/bin/mkfifo");
			if(!mkfifo.exists()) mkfifo.initWithPath("/usr/local/bin/mkfifo");
			
			if(mkfifo.exists()) {
				var main = Components.classes["@mozilla.org/thread-manager;1"].getService().mainThread;
				var background = Components.classes["@mozilla.org/thread-manager;1"].getService().newThread(0);
				
				var me = this;
				function mainThread(agent, cmd) {
					this.agent = agent;
					this.cmd = cmd;
				}
				mainThread.prototype.run = function() {
					me.execCommand(this.agent, this.cmd);
				}
				
				function fifoThread() {}
				fifoThread.prototype.run = function() {
					var proc = Components.classes["@mozilla.org/process/util;1"].
							createInstance(Components.interfaces.nsIProcess);
					proc.init(mkfifo);
					proc.run(true, [_fifoFile.path], 1);
					
					if(!_fifoFile.exists()) Zotero.debug("Could not initialize Zotero integration pipe");
					
					var fifoStream = Components.classes["@mozilla.org/network/file-input-stream;1"].
						createInstance(Components.interfaces.nsIFileInputStream);
					var line = {};
					while(true) {
						fifoStream.QueryInterface(Components.interfaces.nsIFileInputStream);
						fifoStream.init(_fifoFile, -1, 0, 0);
						fifoStream.QueryInterface(Components.interfaces.nsILineInputStream);
						fifoStream.readLine(line);
						fifoStream.close();
						
						var spaceIndex = line.value.indexOf(" ");
						var agent = line.value.substr(0, spaceIndex);
						var cmd = line.value.substr(spaceIndex+1);
						if(agent == "Zotero" && cmd == "shutdown") return;
						main.dispatch(new mainThread(agent, cmd), background.DISPATCH_NORMAL);
					}
				}
				
				fifoThread.prototype.QueryInterface = mainThread.prototype.QueryInterface = function(iid) {
					if (iid.equals(Components.interfaces.nsIRunnable) ||
						iid.equals(Components.interfaces.nsISupports)) return this;
					throw Components.results.NS_ERROR_NO_INTERFACE;
				}
				
				background.dispatch(new fifoThread(), background.DISPATCH_NORMAL);
								
				var observerService = Components.classes["@mozilla.org/observer-service;1"]
					.getService(Components.interfaces.nsIObserverService);
				observerService.addObserver({
					observe: me.destroy
				}, "quit-application", false);
			} else {
				Zotero.debug("mkfifo not found -- not initializing integration pipe");
			}
		}
		
		// initialize SOAP server just to throw version errors
		Zotero.Integration.Compat.init();
	}
	
	/**
	 * Executes an integration command.
	 */
	this.execCommand = function execCommand(agent, command) {
		var componentClass = "@zotero.org/Zotero/integration/application?agent="+agent+";1";
		Zotero.debug("Integration: Instantiating "+componentClass+" for command "+command);
		var application = Components.classes[componentClass]
			.getService(Components.interfaces.zoteroIntegrationApplication);
		var integration = new Zotero.Integration.Document(application);
		try {
			integration[command]();
		} catch(e) {
			integration._doc.displayAlert(Zotero.getString("integration.error.generic"),
				Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_STOP,
				Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK);
			throw e;
		} finally {
			integration.cleanup();
		}
	}
	
	/**
	 * Destroys the integration pipe.
	 */
	this.destroy = function() {
		// send shutdown message to fifo thread
		var oStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
			getService(Components.interfaces.nsIFileOutputStream);
		oStream.init(_fifoFile, 0x02 | 0x10, 0, 0);
		var cmd = "Zotero shutdown\n";
		oStream.write(cmd, cmd.length);
		oStream.close();
		_fifoFile.remove(false);
	}
	
	/**
	 * Activates Firefox
	 */
	this.activate = function() {
		if(Zotero.isMac) {
			if(_osascriptFile === undefined) {
				_osascriptFile = Components.classes["@mozilla.org/file/local;1"].
					createInstance(Components.interfaces.nsILocalFile);
				_osascriptFile.initWithPath("/usr/bin/osascript");
				if(!_osascriptFile.exists()) _osascriptFile = false;
			}
			
			if(_osascriptFile) {
				var proc = Components.classes["@mozilla.org/process/util;1"].
						createInstance(Components.interfaces.nsIProcess);
				proc.init(_osascriptFile);
				proc.run(false, ['-e', 'tell application "Firefox" to activate'], 2);
			}
		}
	}
}

/**
 * An exception thrown when a document contains an item that no longer exists in the current document.
 *
 * @param reselectKeys {Array} Keys representing the missing item
 * @param reselectKeyType {Integer} The type of the keys (see RESELECT_KEY_* constants)
 * @param citationIndex {Integer} The index of the missing item within the citation cluster
 * @param citationLength {Integer} The number of items cited in this citation cluster
 */
Zotero.Integration.MissingItemException = function(reselectKeys, reselectKeyType, citationIndex, citationLength) {
	this.reselectKeys = reselectKeys;
	this.reselectKeyType = reselectKeyType;
	this.citationIndex = citationIndex;
	this.citationLength = citationLength;
}
Zotero.Integration.MissingItemException.prototype.name = "MissingItemException";
Zotero.Integration.MissingItemException.prototype.message = "An item in this document is missing from your Zotero library.";
Zotero.Integration.MissingItemException.prototype.toString = function() {
	return this.name;
}


// Field code for an item
const ITEM_CODE = "ITEM"
// Field code for a bibliography
const BIBLIOGRAPHY_CODE = "BIBL"
// Placeholder for an empty bibliography
const BIBLIOGRAPHY_PLACEHOLDER = "{Bibliography}"

/**
 * 
 */
Zotero.Integration.Document = function(app) {
	this._app = app;
	this._doc = app.getActiveDocument();
}

/**
 * Creates a new session
 * @param data {Zotero.Integration.DocumentData} Document data for new session
 */
Zotero.Integration.Document.prototype._createNewSession = function(data) {
	data.sessionID = Zotero.randomString();
	var session = Zotero.Integration.sessions[data.sessionID] = new Zotero.Integration.Session();
	session.setData(data);
	return session;
}

/**
 * Gets preferences for a document
 * @param require {Boolean} Whether an error should be thrown if no preferences exist (otherwise,
 *                          the set doc prefs dialog is shown)
 * @param dontRunSetDocPrefs {Boolean} Whether to show the Set Document Preferences window if no
 *                                     preferences exist
 */
Zotero.Integration.Document.prototype._getSession = function(require, dontRunSetDocPrefs) {
	var dataString = this._doc.getDocumentData();
	Zotero.debug(dataString);
	if(!dataString) {
		if(require) {
			this._doc.displayAlert(Zotero.getString("integration.error.mustInsertCitation"),
				Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_STOP,
				Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK);
		} else {
			// Set doc prefs if no data string yet
			this._session = this._createNewSession(new Zotero.Integration.DocumentData());
			if(dontRunSetDocPrefs) return false;
			
			var ret = this._session.setDocPrefs(this._app.primaryFieldType, this._app.secondaryFieldType);
			if(!ret) return false;
			// save doc prefs in doc
			this._doc.setDocumentData(this._session.data.serializeXML());
		}
	} else {
		var data = new Zotero.Integration.DocumentData(dataString);
		if(Zotero.Integration.sessions[data.sessionID]) {
			this._session = Zotero.Integration.sessions[data.sessionID];
		} else {
			this._session = this._createNewSession(data);
			
			// make sure style is defined
			if(!this._session.style) {
				this._session.setDocPrefs(this._app.primaryFieldType, this._app.secondaryFieldType);
			}
			this._doc.setDocumentData(this._session.data.serializeXML());
		}
	}
	
	this._session.resetRequest();
	return true;
}

/**
 * Gets all fields for a document
 * @param require {Boolean} Whether an error should be thrown if no fields exist
 */
Zotero.Integration.Document.prototype._getFields = function(require, onlyCheck) {
	if(this._fields) return true;
	if(!this._session && !this._getSession(require, true)) return false;
	
	var fields = this._doc.getFields(this._session.data.prefs['fieldType']);
	this._fields = [];
	while(fields.hasMoreElements()) {
		this._fields.push(fields.getNext().QueryInterface(Components.interfaces.zoteroIntegrationField));
	}
	
	if(require && !this._fields.length) {
		this._doc.displayAlert(Zotero.getString("integration.error.mustInsertCitation"),
				Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_STOP,
				Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK);
		return false;
	}
	
	return true;
}

/**
 * Checks that it is appropriate to add fields to the current document at the current
 * positon, then adds one.
 */
Zotero.Integration.Document.prototype._addField = function(note) {
	// Get citation types if necessary
	if(!this._doc.canInsertField(this._session.data.prefs['fieldType'])) {
		this._doc.displayAlert(Zotero.getString("integration.error.cannotInsertHere"),
				Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_STOP,
				Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK)
		return false;
	}
	
	var field = this._doc.cursorInField(this._session.data.prefs['fieldType']);
	if(field) {
		if(!this._doc.displayAlert(Zotero.getString("integration.replace"),
				Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_STOP,
				Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK_CANCEL)) return false;
	}
	
	if(!field) {
		var field = this._doc.insertField(this._session.data.prefs['fieldType'],
			(note ? this._session.data.prefs["noteType"] : 0));
	}
	
	return field;
}

/**
 * Loads existing citations and bibliographies out of a document, and creates or edits fields
 */
Zotero.Integration.Document.prototype._updateSession = function(editField) {
	var deleteKeys = {};
	this._deleteFields = [];
	this._removeCodeFields = [];
	this._bibliographyFields = [];
	var bibliographyData = "";
	
	// first collect entire bibliography
	this._getFields();
	var editFieldIndex = false;
	for(var i in this._fields) {
		var field = this._fields[i];
		
		if(editField && field.equals(editField)) {
			editFieldIndex = i;
		} else {
			var fieldCode = field.getCode();
			
			if(fieldCode.substr(0, ITEM_CODE.length) == ITEM_CODE) {
				try {
					this._session.addCitation(i, fieldCode.substr(ITEM_CODE.length+1));
				} catch(e) {
					if(e instanceof Zotero.Integration.MissingItemException) {
						// First, check if we've already decided to remove field codes from these
						var reselect = true;
						for each(var reselectKey in e.reselectKeys) {
							if(deleteKeys[reselectKey]) {
								this._removeCodeFields.push(i);
								reselect = false;
								break;
							}
						}
						
						if(reselect) {
							// Ask user what to do with this item
							if(e.citationLength == 1) {
								var msg = Zotero.getString("integration.missingItem.single");
							} else {
								var msg = Zotero.getString("integration.missingItem.multiple", e.citationIndex.toString());
							}
							msg += '\n\n'+Zotero.getString('integration.missingItem.description');
							field.select();
							var result = this._doc.displayAlert(msg, 1, 3);
							if(result == 0) {			// Cancel
								throw "Integration update canceled by user";
							} else if(result == 1) {	// No
								for each(var reselectKey in e.reselectKeys) {
									deleteKeys[reselectKey] = true;
								}
								this._removeCodeFields.push(i);
							} else {					// Yes
								// Display reselect item dialog
								Zotero.Integration.activate();
								this._session.reselectItem(e);
								// Now try again
								this._session.addCitation(i, fieldCode.substr(ITEM_CODE.length+1));
								this._doc.activate();
							}
						}
					} else {
						throw e;
					}
				}
			} else if(fieldCode.substr(0, BIBLIOGRAPHY_CODE.length) == BIBLIOGRAPHY_CODE) {
				this._bibliographyFields.push(field);
				if(!this._session.bibliographyData && !bibliographyData) {
					bibliographyData = field.getCode().substr(BIBLIOGRAPHY_CODE.length+1);
				}
			}
		}
	}

	// load uncited items from bibliography
	if(bibliographyData && !this._session.bibliographyData) {
		this._session.loadBibliographyData(bibliographyData);
	}
	
	this._session.updateItemSet();
	
	// create new citation or edit existing citation
	if(editFieldIndex) { 
		this._session.updateCitations(editFieldIndex-1);
		var editFieldCode = editField.getCode().substr(ITEM_CODE.length+1);
		var editCitation = editFieldCode ? this._session.unserializeCitation(editFieldCode, editFieldIndex) : null;
		
		Zotero.Integration.activate();
		var added = this._session.editCitation(editFieldIndex, editCitation);
		this._doc.activate();
		
		if(!added) {
			if(editFieldCode) {	// cancelled editing; just add as if nothing happened
				this._session.addCitation(editFieldIndex, editCitation);
			} else {			// cancelled creation; delete the citation
				this._session.deleteCitation(editFieldIndex);
			}
		}
	}
}

/**
 * Updates bibliographies and fields within a document
 */
Zotero.Integration.Document.prototype._updateDocument = function(forceCitations, forceBibliography) {
	// update bibliographies
	var output = new Array();
	if(this._bibliographyFields.length	 				// if blbliography exists
			&& (this._session.bibliographyHasChanged	// and bibliography changed
			|| forceBibliography)) {					// or if we should generate regardless of changes
		if(this._session.bibliographyDataHasChanged) {
			var bibliographyData = this._session.getBibliographyData();
			for each(var field in this._bibliographyFields) {
				field.setCode(BIBLIOGRAPHY_CODE+" "+bibliographyData);
			}
		}
	
		var bibliographyText = this._session.getBibliography();
		for each(var field in this._bibliographyFields) {
			field.setText(bibliographyText, true);
		}
	}
	
	// update citations
	this._session.updateUpdateIndices(forceCitations);
	for(var i in this._session.updateIndices) {
		citation = this._session.citationsByIndex[i];
		if(!citation) continue;
		
		if(citation.properties["delete"]) {
			// delete citation
			this._deleteFields.push(i);
		} else if(!this.haveMissing) {
			var fieldCode = this._session.getCitationField(citation);
			if(fieldCode != citation.properties.field) {
				this._fields[citation.properties.index].setCode(ITEM_CODE+" "+fieldCode);
			}
			
			if(citation.properties.custom) {
				var citationText = citation.properties.custom;
				// XML uses real RTF, rather than the format used for
				// integration, so we have to escape things properly
				citationText = citationText.replace(/[\x7F-\uFFFF]/g,
					Zotero.Integration.Session._rtfEscapeFunction).
					replace("\t", "\\tab ", "g");
			} else {
				var citationText = this._session.style.formatCitation(citation, "RTF");
			}
			
			if(citationText.indexOf("\\") !== -1) {
				// need to set text as RTF
				this._fields[citation.properties.index].setText("{\\rtf "+citationText+"}", true);
			} else {
				// set text as plain
				this._fields[citation.properties.index].setText(citationText, false);
			}
		}
	}
	
	// do this operations in reverse in case plug-ins care about order
	for(var i=(this._deleteFields.length-1); i>=0; i--) {
		this._fields[this._deleteFields[i]].delete();
	}
	for(var i=(this._removeCodeFields.length-1); i>=0; i--) {
		this._fields[this._removeCodeFields[i]].removeCode();
	}
}

/**
 * Adds a citation to the current document.
 */
Zotero.Integration.Document.prototype.addCitation = function() {
	if(!this._getSession()) return;
	
	var field = this._addField(true);
	if(!field) return;
	
	this._updateSession(field);
	this._updateDocument();
}
	
/**
 * Edits the citation at the cursor position.
 */
Zotero.Integration.Document.prototype.editCitation = function() {
	if(!this._getSession(true)) return;
	
	var field = this._doc.cursorInField(this._session.data.prefs['fieldType'])
	if(!field) {
		this._doc.displayAlert(Zotero.getString("integration.error.notInCitation"),
				Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_STOP,
				Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK);
		return;
	}
	
	this._updateSession(field);
	this._updateDocument(false, false);
}

/**
 * Adds a bibliography to the current document.
 */
Zotero.Integration.Document.prototype.addBibliography = function() {
	if(!this._getSession(true)) return;

	// Make sure we can have a bibliography
	if(!this._session.style.hasBibliography) {
		this._doc.displayAlert(Zotero.getString("integration.error.noBibliography"),
				Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_STOP,
				Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK);
		return;
	}
	
	// Make sure we have some citations
	if(!this._getFields(true)) return;
	
	var field = this._addField();
	if(!field) return;
	var bibliographyData = this._session.getBibliographyData();
	field.setCode(BIBLIOGRAPHY_CODE+" "+bibliographyData);
	this._fields.push(field);
	
	this._updateSession();
	this._updateDocument(false, true);
}

/**
 * Edits bibliography metadata.
 */
Zotero.Integration.Document.prototype.editBibliography = function() {
	// Make sure we have a bibliography
	if(!this._getFields(true)) return false;
	var haveBibliography = false;
	for(var i=this._fields.length-1; i>=0; i++) {
		if(this._fields[i].getCode().substr(0, BIBLIOGRAPHY_CODE.length) == BIBLIOGRAPHY_CODE) {
			haveBibliography = true;
			break;
		}
	}
	
	if(!haveBibliography) {
		this._doc.displayAlert(Zotero.getString("integration.error.mustInsertBibliography"),
				Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_STOP,
				Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK);
		return;
	}
	
	this._updateSession();
	Zotero.Integration.activate();
	this._session.editBibliography();
	this._doc.activate();
	this._updateDocument(false, true);
}

/**
 * Updates the citation data for all citations and bibliography entries.
 */
Zotero.Integration.Document.prototype.refresh = function() {
	if(!this._getFields(true)) return false;
	
	// Send request, forcing update of citations and bibliography
	this._updateSession();
	this._updateDocument(true, true);
}

/**
 * Deletes field codes.
 */
Zotero.Integration.Document.prototype.removeCodes = function() {
	if(!this._getFields(true)) return false;

	var result = this._doc.displayAlert(Zotero.getString("integration.removeCodesWarning"),
				Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_WARNING,
				Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK_CANCEL);
	if(result) {
		for(var i=this._fields.length-1; i>=0; i--) {
			this._fields[i].removeCode();
		}
	}
}


/**
 * Displays a dialog to set document preferences (style, footnotes/endnotes, etc.)
 */
Zotero.Integration.Document.prototype.setDocPrefs = function() {
	if(this._getSession(false, true)) this._getFields();
	var oldData = this._session.setDocPrefs(this._app.primaryFieldType, this._app.secondaryFieldType);
	if(oldData) {
		this._doc.setDocumentData(this._session.data.serializeXML());
		if(this._fields && this._fields.length) {
			// if there are fields, we will have to convert some things; get a list of what we need to deal with
			var convertBibliographies = oldData === true || oldData.prefs.fieldType != this._session.data.prefs.fieldType;
			var convertItems = convertBibliographies || oldData.prefs.noteType != this._session.data.prefs.noteType;
			var fieldsToConvert = new Array();
			var fieldNoteTypes = new Array();
			for each(var field in this._fields) {
				var fieldCode = field.getCode();
				
				if(convertItems && fieldCode.substr(0, ITEM_CODE.length) == ITEM_CODE) {
					fieldsToConvert.push(field);
					fieldNoteTypes.push(this._session.data.prefs.noteType);
				} else if(convertBibliographies && fieldCode.substr(0, BIBLIOGRAPHY_CODE.length) == BIBLIOGRAPHY_CODE) {
					fieldsToConvert.push(field);
					fieldNoteTypes.push(0);
				}
			}
			
			if(fieldsToConvert.length) {
				// pass to conversion function
				this._doc.convert(new Zotero.Integration.Document.JSEnumerator(fieldsToConvert),
					this._session.data.prefs.fieldType, fieldNoteTypes, fieldNoteTypes.length);
				
				// clear fields so that they will get collected again before refresh
				this._fields = undefined;
			}
			
			// refresh contents
			this.refresh();
		}
	}
}

/**
 * Cleans up any changes made before returning, even if an error occurred
 */
Zotero.Integration.Document.prototype.cleanup = function() {
	this._doc.cleanup()
}

/**
 * An exceedingly simple nsISimpleEnumerator implementation
 */
Zotero.Integration.Document.JSEnumerator = function(objArray) {
	this.objArray = objArray;
}
Zotero.Integration.Document.JSEnumerator.prototype.hasMoreElements = function() {
	return this.objArray.length;
}
Zotero.Integration.Document.JSEnumerator.prototype.getNext = function() {
	return this.objArray.shift();
}

/**
 * Keeps track of all session-specific variables
 */
Zotero.Integration.Session = function() {
	// holds items not in document that should be in bibliography
	this.uncitedItems = new Object();
	this.reselectedItems = new Object();
}

/**
 * Changes the Session style and data
 * @param data {Zotero.Integration.DocumentData}
 */
Zotero.Integration.Session.prototype.setData = function(data) {
	var oldStyleID = (this.data && this.data.style.styleID ? this.data.style.styleID : false);
	this.data = data;
	if(data.style.styleID && oldStyleID != data.style.styleID) {
		this.styleID = data.style.styleID;
		try {
			this.style = Zotero.Styles.get(data.style.styleID).csl;
			this.dateModified = new Object();
			
			this.itemSet = this.style.createItemSet();
			this.loadUncitedItems();
		} catch(e) {
			Zotero.debug(e)
			data.style.styleID = undefined;
			return false;
		}
		
		return true;
	}
	return false;
}

/**
 * Displays a dialog to set document preferences
 */
Zotero.Integration.Session.prototype.setDocPrefs = function(primaryFieldType, secondaryFieldType) {
	var io = new function() {
		this.wrappedJSObject = this;
	};
	
	if(this.data) {
		io.style = this.data.style.styleID;
		io.useEndnotes = this.data.prefs.noteType == 0 ? 0 : this.data.prefs.noteType-1;
		io.fieldType = this.data.prefs.fieldType;
		io.primaryFieldType = primaryFieldType;
		io.secondaryFieldType = secondaryFieldType;
	}
	
	Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
		.getService(Components.interfaces.nsIWindowWatcher)
		.openWindow(null, 'chrome://zotero/content/integrationDocPrefs.xul', '',
		'chrome,modal,centerscreen' + (Zotero.isWin ? ',popup' : ''), io, true);
	if(!io.style) return false;
	
	// set data
	var oldData = this.data;
	var data = new Zotero.Integration.DocumentData();
	data.sessionID = oldData.sessionID;
	data.style.styleID = io.style;
	data.prefs.fieldType = io.fieldType;
	this.setData(data);
	// need to do this after setting the data so that we know if it's a note style
	this.data.prefs.noteType = this.style && this.style.class == "note" ? io.useEndnotes+1 : 0;
	
	if(!oldData || oldData.style.styleID != data.style.styleID
			|| oldData.prefs.noteType != data.prefs.noteType
			|| oldData.prefs.fieldType != data.prefs.fieldType) {
		this.regenerateAll = this.bibliographyHasChanged = true;
	}
	
	return oldData ? oldData : true;
}

/**
 * Reselects an item to replace a deleted item
 * @param exception {Zotero.Integration.MissingItemException}
 */
Zotero.Integration.Session.prototype.reselectItem = function(exception) {
	var io = new function() {
		this.wrappedJSObject = this;
	};
	io.addBorder = Zotero.isWin;
	io.singleSelection = true;
	
	Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
		.getService(Components.interfaces.nsIWindowWatcher)
		.openWindow(null,'chrome://zotero/content/selectItemsDialog.xul', '',
		'chrome,modal,centerscreen,resizable=yes' + (Zotero.isWin ? ',popup' : ''), io, true);
	
	if(io.dataOut && io.dataOut.length) {
		var itemID = io.dataOut[0];
		
		// add reselected item IDs to hash, so they can be used
		for each(var reselectKey in exception.reselectKeys) {
			this.reselectedItems[reselectKey] = itemID;
		}
		// add old URIs to map, so that they will be included
		if(exception.reselectKeyType == RESELECT_KEY_URI) {
			this.uriMap.add(itemID, exception.reselectKeys.concat(this.uriMap.getURIsForItemID(itemID)));
		}
		// flag for update
		this.updateItemIDs[itemID] = true;
	}
}

/**
 * Resets per-request variables in the CitationSet
 */
Zotero.Integration.Session.prototype.resetRequest = function() {
	this.citationsByItemID = new Object();
	this.citationsByIndex = new Array();
	this.uriMap = new Zotero.Integration.URIMap(this);
	
	this.haveMissing = false;
	this.regenerateAll = false;
	this.bibliographyHasChanged = false;
	this.bibliographyDataHasChanged = false;
	this.updateItemIDs = new Object();
	this.updateIndices = new Object();
}

/**
 * Generates a field from a citation object
 */
Zotero.Integration.Session._acceptableTypes = ["string", "boolean", "number"];
Zotero.Integration.Session._saveProperties = ["custom", "sort"];
Zotero.Integration.Session.prototype.getCitationField = function(citation) {
	var type, field = "";
	
	for(var j=0; j<Zotero.Integration.Session._saveProperties.length; j++) {
		var property = Zotero.Integration.Session._saveProperties[j];
		if(citation.properties[property] || citation.properties[property] === false) {
			field += ',"'+property+'":'+Zotero.JSON.serialize(citation.properties[property]);
		}
	}

	var citationItems = "";
	for(var j=0; j<citation.citationItems.length; j++) {
		var citationItem = "";
		
		// save citationItem properties
		for(var k in citation.citationItems[j]) {
			type = typeof(citation.citationItems[j][k]);
			if(citation.citationItems[j][k] && k != "itemID" && k != "key"
			    && Zotero.Integration.Session._acceptableTypes.indexOf(type) !== -1) {
				citationItem += ',"'+k+'":'+Zotero.JSON.serialize(citation.citationItems[j][k]);
			}
		}
		
		// save URI
		citationItem += ',"uri":'+Zotero.JSON.serialize(this.uriMap.getURIsForItemID(citation.citationItems[j].itemID));
		citationItems += ",{"+citationItem.substr(1)+"}";
	}
	field += ',"citationItems":['+citationItems.substr(1)+"]";
	
	return "{"+field.substr(1)+"}";
}

/**
 * Adds a citation based on a serialized Word field
 */
Zotero.Integration._oldCitationLocatorMap = {
	p:Zotero.CSL.LOCATOR_PAGES,
	g:Zotero.CSL.LOCATOR_PARAGRAPH,
	l:Zotero.CSL.LOCATOR_LINE
};

/**
 * Gets a Zotero.CSL.Citation object given a field name
 */
Zotero.Integration.Session.prototype.addCitation = function(index, arg) {
	var index = parseInt(index, 10);
	
	if(typeof(arg) == "string") {	// text field
		if(arg == "!" || arg == "X") return;
		
		var citation = this.unserializeCitation(arg, index);
	} else {					// a citation already
		var citation = arg;
	}
	
	this.completeCitation(citation);
	
	// add to citationsByItemID and citationsByIndex
	for(var i=0; i<citation.citationItems.length; i++) {
		var citationItem = citation.citationItems[i];
		if(!this.citationsByItemID[citationItem.itemID]) {
			this.citationsByItemID[citationItem.itemID] = [citation];
		} else {
			var byItemID = this.citationsByItemID[citationItem.itemID];
			if(byItemID[byItemID.length-1].properties.index < index) {
				// if index is greater than the last index, add to end
				byItemID.push(citation);
			} else {
				// otherwise, splice in at appropriate location
				for(var j=0; byItemID[j].properties.index < index && j<byItemID.length-1; j++) {}
				byItemID.splice(j, 0, citation);
			}
		}
	}
	
	citation.properties.index = index;
	this.citationsByIndex[index] = citation;
}

/**
 * Adds items to a citation whose citationItems contain only item IDs
 */
Zotero.Integration.Session.prototype.completeCitation = function(object) {
	// replace item IDs with real items
	var err;
	for(var i=0; i<object.citationItems.length; i++) {
		var citationItem = object.citationItems[i];
		
		// get Zotero item
		var zoteroItem = false;
		if(citationItem.uri) {
			var needUpdate = false;
			[zoteroItem, needUpdate] = this.uriMap.getZoteroItemForURIs(citationItem.uri);
			if(needUpdate) this.updateItemIDs[zoteroItem.id] = true;
		} else {
			if(citationItem.key) {
				zoteroItem = Zotero.Items.getByKey(citationItem.key);
			} else if(citationItem.itemID) {
				zoteroItem = Zotero.Items.get(citationItem.itemID);
			}
			
			if(zoteroItem) this.updateItemIDs[zoteroItem.id] = true;
		}
		
		// if no item, check if it was already reselected and otherwise handle as a missing item
		if(!zoteroItem) {	
			if(citationItem.uri) {
				var reselectKeys = citationItem.uri;
				var reselectKeyType = RESELECT_KEY_URI;
			} else if(citationItem.key) {
				var reselectKeys = citationItem.key;
				var reselectKeyType = RESELECT_KEY_ITEM_KEY;
			} else {
				var reselectKeys = citationItem.itemID;
				var reselectKeyType = RESELECT_KEY_ITEM_ID;
			}
			
			// look to see if item has already been reselected
			for each(var reselectKey in reselectKeys) {
				if(this.reselectedItems[reselectKey]) {
					zoteroItem = Zotero.Items.get(this.reselectedItems[reselectKey]);
					break;
				}
			}
			
			// if not already reselected, throw a MissingItemException
			if(!zoteroItem) {
				throw(new Zotero.Integration.MissingItemException(
					reselectKeys, reselectKeyType, i, object.citationItems.length));
			}
		}
		
		// get CSL item
		var item = this.itemSet.getItemsByIds([zoteroItem.id])[0];
		if(!item) {
			item = this.itemSet.add([zoteroItem])[0];
			
			this.dateModified[citationItem.itemID] = item.zoteroItem.getField("dateModified", true, true);
			this.updateItemIDs[citationItem.itemID] = true;
			this.bibliographyHasChanged = true;
		}
		
		citationItem.item = item;
		if(!citationItem.itemID) citationItem.itemID = item.id;
	}
	
	return null;
}

/**
 * Unserializes a JSON citation into a citation object (sans items)
 */
Zotero.Integration.Session.prototype.unserializeCitation = function(arg, index) {
	if(arg[0] == "{") {		// JSON field
		// create citation
		var citation = this.style.createCitation();
		
		// fix for corrupted fields
		var lastBracket = arg.lastIndexOf("}");
		if(lastBracket+1 != arg.length) {
			arg = arg.substr(0, lastBracket+1);
			this.updateIndices[index] = true;
		} else {
			citation.properties.field = arg;
		}
		
		// get JSON
		var object = Zotero.JSON.unserialize(arg);
		
		// Fix uppercase citation codes
		if(object.CITATIONITEMS) {
			object.citationItems = [];
			for (var i=0; i<object.CITATIONITEMS.length; i++) {
				for (var j in object.CITATIONITEMS[i]) {
					switch (j) {
						case 'ITEMID':
							var field = 'itemID';
							break;
							
						// 'position', 'custom'
						default:
							var field = j.toLowerCase();
					}
					if (!object.citationItems[i]) {
						object.citationItems[i] = {};
					}
					object.citationItems[i][field] = object.CITATIONITEMS[i][j];
				}
			}
		}
		
		// copy properties
		for(var i in object) {
			if(Zotero.Integration.Session._saveProperties.indexOf(i) != -1) {
				citation.properties[i] = object[i];
			} else {
				citation[i] = object[i];
			}
		}
	} else {				// ye olde style field
		var underscoreIndex = arg.indexOf("_");
		var itemIDs = arg.substr(0, underscoreIndex).split("|");
		
		var lastIndex = arg.lastIndexOf("_");
		if(lastIndex != underscoreIndex+1) {
			var locatorString = arg.substr(underscoreIndex+1, lastIndex-underscoreIndex-1);
			var locators = locatorString.split("|");
		}
		
		var citationItems = new Array();
		for(var i=0; i<itemIDs.length; i++) {
			var citationItem = {itemID:itemIDs[i]};
			if(locators) {
				citationItem.locator = locators[i].substr(1);
				citationItem.locatorType = Zotero.Integration._oldCitationLocatorMap[locators[i][0]];
			}
			citationItems.push(citationItem);
		}
		
		var citation = this.style.createCitation(citationItems);
		this.updateIndices[index] = true;
	}
	
	return citation;
}

/**
 * <arks a citation for removal
 */
Zotero.Integration.Session.prototype.deleteCitation = function(index) {
	this.citationsByIndex[index] = {properties:{"delete":true}};
	this.updateIndices[index] = true;
}

/**
 * Returns a preview, given a citation object (whose citationItems lack item 
 * and position) and an index
 */
Zotero.Integration.Session.prototype.previewCitation = function(citation) {
	// get length of item set, so we can tell how many items we've added
	var itemSetLength = this.itemSet.items.length;
	// add citation items
	this.completeCitation(citation);
	// get list of items we later have to delete
	var deleteItems = this.itemSet.items.slice(itemSetLength, this.itemSet.items.length);
	// get position
	this.getCitationPositions(citation);
	// sort item set
	this.sortItemSet();
	// sort citation if desired
	if(citation.properties.sort) {
		citation.sort();
	}
	// get preview citation
	var text = this.style.formatCitation(citation, "Integration");
	
	// delete from item set
	if(deleteItems.length) {
		this.itemSet.remove(deleteItems);
	}
	
	return text;
}
 

/**
 * Brings up the addCitationDialog, prepopulated if a citation is provided
 */
Zotero.Integration.Session.prototype.editCitation = function(index, citation) {
	var me = this;
	var io = new function() { this.wrappedJSObject = this; }
	
	// if there's already a citation, make sure we have item IDs in addition to keys
	if(citation) {
		var zoteroItem;
		for each(var citationItem in citation.citationItems) {
			var item = false;
			if(!citationItem.itemID) {
				zoteroItem = false;
				if(citationItem.uri) {
					[zoteroItem, ] = this.uriMap.getZoteroItemForURIs(citationItem.uri);
				} else if(citationItem.key) {
					zoteroItem = Zotero.Items.getByKey(citationItem.key);
				}
				if(zoteroItem) citationItem.itemID = zoteroItem.id;
			}
		}
	}
	
	// create object to hold citation
	io.citation = (citation ? citation.clone() : this.style.createCitation());
	io.citation.properties.index = parseInt(index, 10);
	// assign preview function
	io.previewFunction = function() {
		return me.previewCitation(io.citation);
	}
	
	Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
			.getService(Components.interfaces.nsIWindowWatcher)
			.openWindow(
				null, 'chrome://zotero/content/addCitationDialog.xul', '',
				'chrome,modal,centerscreen,resizable=yes'
					+ (Zotero.Integration.usePopup ? ',popup' : ''),
				io
			);
		
	if(citation && !io.citation.citationItems.length) {
		io.citation = citation;
	}
	
	if(io.citation.citationItems.length) {		// we have an item
		this.addCitation(index, io.citation);
		this.updateIndices[index] = true;
	}
	
	// resort item set if necessary
	this.sortItemSet();
	
	return !!io.citation.citationItems.length;
}

/**
 * Sets position attribute on a citation
 */
Zotero.Integration.Session.prototype.getCitationPositions = function(citation, update) {
	for(var previousIndex = citation.properties.index-1;
		previousIndex != -1
			&& (!this.citationsByIndex[previousIndex]
			|| this.citationsByIndex[previousIndex].properties["delete"]); 
		previousIndex--) {}
	var previousCitation = (previousIndex == -1 ? false : this.citationsByIndex[previousIndex]);
	
	// if only one source, and it's the same as the last, use ibid
	if(		// there must be a previous citation with one item, and this citation
			// may only have one item
			previousCitation && citation.citationItems.length == 1
			&& previousCitation.citationItems.length == 1
			// the previous citation must have been a citation of the same item
			&& citation.citationItems[0].item == previousCitation.citationItems[0].item
			// and if the previous citation had a locator (page number, etc.) 
			// then this citation must have a locator, or else we should do the 
			// full citation (see Chicago Manual of Style)
			&& (!previousCitation.citationItems[0].locator || citation.citationItems[0].locator)) {
		// use ibid, but check whether to use ibid+pages
		var newPosition = (citation.citationItems[0].locator == previousCitation.citationItems[0].locator
			&& citation.citationItems[0].locatorType == previousCitation.citationItems[0].locatorType
			? Zotero.CSL.POSITION_IBID : Zotero.CSL.POSITION_IBID_WITH_LOCATOR);
		// update if desired
		if(update && (citation.citationItems[0].position || newPosition) && citation.citationItems[0].position != newPosition) {
			this.updateIndices[citation.properties.index] = true;
		}
		citation.citationItems[0].position = newPosition;
	} else {
		// loop through to see which are first citations
		for(var i=0; i<citation.citationItems.length; i++) {
			var citationItem = citation.citationItems[i];
			var newPosition = (!this.citationsByItemID[citationItem.itemID]
					|| this.citationsByItemID[citationItem.itemID][0].properties.index >= citation.properties.index
				? Zotero.CSL.POSITION_FIRST : Zotero.CSL.POSITION_SUBSEQUENT);
			
			// update if desired
			if(update && (citation.citationItems[i].position || newPosition) && citation.citationItems[i].position != newPosition) {
				this.updateIndices[citation.properties.index] = true;
			}
			citation.citationItems[i].position = newPosition;
		}
	}
}

/**
 * Marks citations for update, where necessary
 */
Zotero.Integration.Session.prototype.updateCitations = function(toIndex) {
	if(!toIndex) toIndex = this.citationsByIndex.length-1;
	for(var i=0; i<=toIndex; i++) {
		var citation = this.citationsByIndex[i];
		// get position, updating if necesary
		if(citation && !citation.properties["delete"] && !citation.properties.custom) {
			this.getCitationPositions(citation, true);
		}
	}
}

/**
 * Updates the ItemSet, adding and deleting bibliography items as appropriate, then re-sorting
 */
Zotero.Integration.Session.prototype.updateItemSet = function() {
	var deleteItems = [];
	var missingItems = [];
	
	// see if items were deleted from Zotero
	for(var i in this.citationsByItemID) {
		if (!Zotero.Items.get(i)) {
			deleteItems.push(i);
			missingItems.push(i);
		}
	}
	
	// see if old items were deleted or changed
	for each(var item in this.itemSet.items) {
		var itemID = item.id;
		
		// see if items were removed 
		if(!this.citationsByItemID[itemID] && !this.uncitedItems[itemID]) {
			deleteItems.push(itemID);
			continue;
		}

		if(item.zoteroItem && this.dateModified[itemID] != item.zoteroItem.getField("dateModified", true, true)) {
			// update date modified
			this.dateModified[itemID] = item.zoteroItem.getField("dateModified", true, true);
			// add to list of updated item IDs
			this.updateItemIDs[itemID] = true;
		}
	}
	
	// delete items from item set
	if(deleteItems.length) {
		this.itemSet.remove(deleteItems);
		this.bibliographyHasChanged = true;
	}
	
	this.sortItemSet();
}

/**
 * Sorts the ItemSet
 */
Zotero.Integration.Session.prototype.sortItemSet = function() {
	// save first index
	for(var itemID in this.citationsByItemID) {
		if(this.citationsByItemID[itemID]) {
			var item = this.itemSet.getItemsByIds([itemID])[0];
			if(item) item.setProperty("index", this.citationsByItemID[itemID][0].properties.index);
		}
	}
	
	var citationChanged = this.itemSet.resort();
	
	// add to list of updated item IDs
	for each(var item in citationChanged) {
		this.updateItemIDs[item.id] = true;
		this.bibliographyHasChanged = true;
	}
}

/**
 * Edits integration bibliography
 */
Zotero.Integration.Session.prototype.editBibliography = function() {
	var bibliographyEditor = new Zotero.Integration.Session.BibliographyEditInterface(this);
	var io = new function() { this.wrappedJSObject = bibliographyEditor; }
	
	this.bibliographyDataHasChanged = this.bibliographyHasChanged = true;
	
	Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
			.getService(Components.interfaces.nsIWindowWatcher)
			.openWindow(
				null, 'chrome://zotero/content/editBibliographyDialog.xul', '',
				'chrome,modal,centerscreen,resizable=yes'
					+ (Zotero.Integration.usePopup ? ',popup' : ''),
				io,
				true
			);
}

/**
 * Gets integration bibliography
 */
Zotero.Integration.Session.prototype.getBibliography = function() {
	// use real RTF, but chop off the first \n
	var text = this.style.formatBibliography(this.itemSet, "RTF")
	var nlIndex = text.indexOf("\n");
	if(nlIndex !== -1) {
		return "{\\rtf "+text.substr(text.indexOf("\n"));
	} else {
		return "";
	}
}

/**
 * Refreshes updateIndices variable to include fields for modified items
 */
Zotero.Integration.Session.prototype.updateUpdateIndices = function(regenerateAll) {
	if(regenerateAll || this.regenerateAll) {
		// update all indices
		for(var i=0; i<this.citationsByIndex.length; i++) {
			this.updateIndices[i] = true;
		}
	} else {
		// update only item IDs
		for(var i in this.updateItemIDs) {
			if(this.citationsByItemID[i] && this.citationsByItemID[i].length) {
				for(var j=0; j<this.citationsByItemID[i].length; j++) {
					this.updateIndices[this.citationsByItemID[i][j].properties.index] = true;
				}
			}
		}
	}
}

Zotero.Integration.Session._rtfEscapeFunction = function(aChar) {
	return "{\\uc0\\u"+aChar.charCodeAt(0).toString()+"}"
}

/**
 * Loads document data from a JSON object
 */
Zotero.Integration.Session.prototype.loadBibliographyData = function(json) {
	var documentData = Zotero.JSON.unserialize(json);
	
	// set uncited
	if(documentData.uncited) {
		if(documentData.uncited[0]) {
			// new style array of arrays with URIs
			var zoteroItem, needUpdate;
			for each(var uris in documentData.uncited) {
				[zoteroItem, needUpdate] = this.uriMap.getZoteroItemForURIs(uris);
				if(zoteroItem) this.uncitedItems[zoteroItem.id] = true;
				if(needUpdate) this.bibliographyDataHasChanged = true;
			}
		} else {
			for(var itemID in documentData.uncited) {
				// if not yet in item set, add to item set
				if(typeof(itemID) == "string") {		// key			
					var zoteroItem = Zotero.getItemByKey(itemID);
					this.uncitedItems[zoteroItem.id] = true;
				} else {								// item ID
					this.uncitedItems[itemID] = true;
				}
			}
			this.bibliographyDataHasChanged = true;
		}
	}
	
	this.loadUncitedItems();
	
	// set custom bibliography entries
	if(documentData.custom) {
		if(documentData.custom[0]) {
			// new style array of arrays with URIs
			var zoteroItem, needUpdate;
			for each(var custom in documentData.custom) {
				[zoteroItem, needUpdate] = this.uriMap.getZoteroItemForURIs(custom[0]);
				if(!zoteroItem) continue;
				if(needUpdate) this.bibliographyDataHasChanged = true;
				
				var item = this.itemSet.getItemsByIds([zoteroItem.id])[0];
				if(!item) continue;
				
				item.setProperty("bibliography-Integration", custom[1]);
				item.setProperty("bibliography-RTF", custom[1]);
			}
		} else {
			// old style hash
			for(var itemID in documentData.custom) {
				if(typeof(itemID) == "string") {	// key;
					var zoteroItem = Zotero.Items.getByKey(itemID);
					if(!zoteroItem) continue;
					
					var item = this.itemSet.getItemsByIds([zoteroItem.id])[0];
				} else {							// item
					var item = this.itemSet.getItemsByIds([itemID])[0];
				}
				if (!item) continue;
				item.setProperty("bibliography-Integration", documentData.custom[itemID]);
				item.setProperty("bibliography-RTF", documentData.custom[itemID]);
			}
			this.bibliographyDataHasChanged = true;
		}
	}
	
	this.bibliographyData = json;
}

/**
 * Adds items in this.uncitedItems to itemSet, if they are not already there
 */
Zotero.Integration.Session.prototype.loadUncitedItems = function() {
	for(var itemID in this.uncitedItems) {
		// skip "undefined"
		if(!this.uncitedItems[itemID]) continue;
		var item = this.itemSet.getItemsByIds([itemID])[0];
		if(!item) {
			var zoteroItem = Zotero.Items.get(itemID);
			if(zoteroItem) this.itemSet.add([zoteroItem]);
		}
	}
}

/**
 * Saves document data from a JSON object
 */
Zotero.Integration.Session.prototype.getBibliographyData = function() {
	var bibliographyData = {};
	
	// add uncited if there is anything
	for(var item in this.uncitedItems) {
		if(item) {
			if(!bibliographyData.uncited) bibliographyData.uncited = [];
			bibliographyData.uncited.push(this.uriMap.getURIsForItemID(item));
		}
	}
	
	// look for custom bibliography entries
	if(this.itemSet.items.length) {
		for(var i=0; i<this.itemSet.items.length; i++) {
			var custom = this.itemSet.items[i].getProperty("bibliography-RTF");
			if(custom !== "") {
				if(!bibliographyData.custom) bibliographyData.custom = [];
				bibliographyData.custom.push([
					this.uriMap.getURIsForItemID(this.itemSet.items[i].id),
					this.itemSet.items[i].getProperty("bibliography-RTF")]);
			}
		}
	}
	
	if(bibliographyData.uncited || bibliographyData.custom) {
		return Zotero.JSON.serialize(bibliographyData);
	} else {
		return ""; 	// nothing
	}
}

/**
 * @class Interface for bibliography editor to alter document bibliography
 * @constructor
 * Creates a new bibliography editor interface
 * @param {Zotero.Integration.Session} session
 */
Zotero.Integration.Session.BibliographyEditInterface = function(session) {
	this.session = session;
}

/**
 * Gets the @link {Zotero.CSL.ItemSet} for the bibliography being edited
 * The item set should not be modified, but may be used to determine what items are in the
 * bibliography.
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.getItemSet = function() {
	return this.session.itemSet;
}

/**
 * Checks whether an item is cited in the bibliography being edited
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.isCited = function(item) {
	if(this.session.citationsByItemID[item.id]) return true;
	return false;
}

/**
 * Checks whether an item is cited in the bibliography being edited
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.add = function(item) {
	// create new item
	this.session.itemSet.add([item]);
	this.session.uncitedItems[item.id] = true;
	this.session.sortItemSet();
}

/**
 * Removes an item from the bibliography being edited
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.remove = function(item) {
	// create new item
	this.session.itemSet.remove([item]);
	this.session.sortItemSet();
	
	// delete citations if necessary
	var itemID = item.id;
	if(this.session.citationsByItemID[itemID]) {		
		for(var j=0; j<this.session.citationsByItemID[itemID].length; j++) {
			var citation = this.session.citationsByItemID[itemID][j];
			this.session.updateIndices[citation.properties.index] = true;
			citation.properties["delete"] = true;
		}
	}
	
	// delete uncited if neceessary
	if(this.session.uncitedItems[itemID]) this.session.uncitedItems[itemID] = undefined;
}

/**
 * Generates a preview of the bibliography entry for a given item
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.preview = function(item) {
	var itemSet = this.session.style.createItemSet([item]);
	return this.session.style.formatBibliography(itemSet, "Integration");
}

/**
 * A class for parsing and passing around document-specific data
 */
Zotero.Integration.DocumentData = function(string) {
	this.style = {};
	this.prefs = {};
	this.sessionID = null;
	if(string) {
		this.unserialize(string);
	}
}

/**
 * Serializes document-specific data as XML
 */
Zotero.Integration.DocumentData.prototype.serializeXML = function() {
	var xmlData = <data><session id={this.sessionID} />
		<style id={this.style.styleID} hasBibliography={this.style.hasBibliography ? 1 : 0}/>
		<prefs/>
		</data>;
	
	for(var pref in this.prefs) {
		xmlData.prefs.pref += <pref name={pref} value={this.prefs[pref]}/>
	}
	
	XML.prettyPrinting = false;
	var output = xmlData.toXMLString().replace("\n", "", "g");
	XML.prettyPrinting = true;
	return output;
}


/**
 * Unserializes document-specific XML
 */
Zotero.Integration.DocumentData.prototype.unserializeXML = function(xmlData) {
	if(typeof xmlData == "string") {
		var xmlData = new XML(xmlData);
	}
	
	this.sessionID = xmlData.session.@id.toString();
	this.style = {"styleID":xmlData.style.@id.toString(),
		"hasBibliography":(xmlData.style.@hasBibliography.toString() == 1)};
	this.prefs = {};
	for each(var pref in xmlData.prefs.children()) {
		this.prefs[pref.@name.toString()] = pref.@value.toString();
	}
}

/**
 * Unserializes document-specific data, either as XML or as the string form used previously
 */
Zotero.Integration.DocumentData.prototype.unserialize = function(input) {
	if(input[0] == "<" || input[1] == "<") {
		this.unserializeXML(input);
	} else {
		const splitRe = /(^|[^\:])\:([^\:]|$)/;
		
		var prefParameters = [];
		var splitOutput = splitRe.split(input);
		for(var i=0; i<splitOutput.length; i+=3) {
			prefParameters.push((splitOutput[i]+splitOutput[i+1]+splitOutput[i+2]).replace("::", ":", "g"));
		}
		
		this.sessionID = prefParameters[0];
		this.style = {"styleID":prefParameters[1], 
			"hasBibliography":(prefParameters[3] == "1" || prefParameters[3] == "True")};
		this.prefs = {"fieldType":((prefParameters[5] == "1" || prefParameters[5] == "True") ? "Bookmark" : "Field")};
		if(prefParameters[2] == "note") {
			if(prefParameters[4] == "1" || prefParameters[4] == "True") {
				this.prefs.noteType = Components.interfaces.zoteroIntegrationDocument.NOTE_ENDNOTE;
			} else {
				this.prefs.noteType = Components.interfaces.zoteroIntegrationDocument.NOTE_FOOTNOTE;
			}
		} else {
			this.prefs.noteType = 0;
		}
	}
}

/**
 * Handles mapping of item IDs to URIs
 */
Zotero.Integration.URIMap = function(session) {
	this.itemIDURIs = {};
	this.session = session;
}

/**
 * Adds a given mapping to the URI map
 */
Zotero.Integration.URIMap.prototype.add = function(id, uris) {
	this.itemIDURIs[id] = uris;
}

/**
 * Gets URIs for a given item ID, and adds to map
 */
Zotero.Integration.URIMap.prototype.getURIsForItemID = function(id) {
	if(!this.itemIDURIs[id]) {
		this.itemIDURIs[id] = [Zotero.URI.getItemURI(Zotero.Items.get(id))];
	}
	return this.itemIDURIs[id];
}

/**
 * Gets Zotero item for a given set of URIs
 */
Zotero.Integration.URIMap.prototype.getZoteroItemForURIs = function(uris) {
	var zoteroItem = false;
	var needUpdate = false;
	
	for(var i in uris) {
		try {
			zoteroItem = Zotero.URI.getURIItem(uris[i]);	
			if(zoteroItem) break;
		} catch(e) {}
	}
	
	if(zoteroItem) {
		// make sure URI is up to date (in case user just began synching)
		var newURI = Zotero.URI.getItemURI(zoteroItem);
		if(newURI != uris[i]) {
			uris[i] = newURI;
			needUpdate = true;
		}
		// cache uris
		this.itemIDURIs[zoteroItem.id] = uris;
	}
	
	return [zoteroItem, needUpdate];
}