"use strict";
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

const RESELECT_KEY_URI = 1;
const RESELECT_KEY_ITEM_KEY = 2;
const RESELECT_KEY_ITEM_ID = 3;
const DATA_VERSION = 3;

// Specifies that citations should only be updated if changed
const FORCE_CITATIONS_FALSE = 0;
// Specifies that citations should only be updated if formattedText has changed from what is encoded
// in the field code
const FORCE_CITATIONS_REGENERATE = 1;
// Specifies that citations should be reset regardless of whether formattedText has changed
const FORCE_CITATIONS_RESET_TEXT = 2;

// These must match the constants in corresponding word plugins 
const DIALOG_ICON_STOP = 0;
const DIALOG_ICON_WARNING = 1;
const DIALOG_ICON_CAUTION = 2;

const DIALOG_BUTTONS_OK = 0;
const DIALOG_BUTTONS_OK_CANCEL = 1;
const DIALOG_BUTTONS_YES_NO = 2;
const DIALOG_BUTTONS_YES_NO_CANCEL = 3;

const NOTE_FOOTNOTE = 1;
const NOTE_ENDNOTE = 2;

Zotero.Integration = new function() {
	Components.utils.import("resource://gre/modules/Services.jsm");
	Components.utils.import("resource://gre/modules/AddonManager.jsm");
	
	this.currentWindow = false;
	this.sessions = {};
	
	/**
	 * Initializes the pipe used for integration on non-Windows platforms.
	 */
	this.init = function() {
		// We only use an integration pipe on OS X.
		// On Linux, we use the alternative communication method in the OOo plug-in
		// On Windows, we use a command line handler for integration. See
		// components/zotero-integration-service.js for this implementation.
		if(!Zotero.isMac) return;
	
		// Determine where to put the pipe
		// on OS X, first try /Users/Shared for those who can't put pipes in their home
		// directories
		var pipe = null;
		var sharedDir = Components.classes["@mozilla.org/file/local;1"].
			createInstance(Components.interfaces.nsILocalFile);
		sharedDir.initWithPath("/Users/Shared");
		
		if(sharedDir.exists() && sharedDir.isDirectory()) {
			var logname = Components.classes["@mozilla.org/process/environment;1"].
				getService(Components.interfaces.nsIEnvironment).
				get("LOGNAME");
			var sharedPipe = sharedDir.clone();
			sharedPipe.append(".zoteroIntegrationPipe_"+logname);
			
			if(sharedPipe.exists()) {
				if(this.deletePipe(sharedPipe) && sharedDir.isWritable()) {
					pipe = sharedPipe;
				}
			} else if(sharedDir.isWritable()) {
				pipe = sharedPipe;
			}
		}
		
		if(!pipe) {
			// on other platforms, or as a fallback, use home directory
			pipe = Components.classes["@mozilla.org/file/directory_service;1"].
				getService(Components.interfaces.nsIProperties).
				get("Home", Components.interfaces.nsIFile);
			pipe.append(".zoteroIntegrationPipe");
		
			// destroy old pipe, if one exists
			if(!this.deletePipe(pipe)) return;
		}
		
		// try to initialize pipe
		try {
			this.initPipe(pipe);
		} catch(e) {
			Zotero.logError(e);
		}
	}

	/**
	 * Begin listening for integration commands on the given pipe
	 * @param {String} pipe The path to the pipe
	 */
	this.initPipe = function(pipe) {
		Zotero.IPC.Pipe.initPipeListener(pipe, function(string) {
			if(string != "") {
				// exec command if possible
				var parts = string.match(/^([^ \n]*) ([^ \n]*)(?: ([^\n]*))?\n?$/);
				if(parts) {
					var agent = parts[1].toString();
					var cmd = parts[2].toString();
					var document = parts[3] ? parts[3].toString() : null;
					Zotero.Integration.execCommand(agent, cmd, document);
				} else {
					Components.utils.reportError("Zotero: Invalid integration input received: "+string);
				}
			}
		});
	}
	
	/**
	 * Deletes a defunct pipe on OS X
	 */
	this.deletePipe = function(pipe) {
		try {
			if(pipe.exists()) {
				Zotero.IPC.safePipeWrite(pipe, "Zotero shutdown\n");
				pipe.remove(false);
			}
			return true;
		} catch (e) {
			// if pipe can't be deleted, log an error
			Zotero.debug("Error removing old integration pipe "+pipe.path, 1);
			Zotero.logError(e);
			Components.utils.reportError(
				"Zotero word processor integration initialization failed. "
					+ "See http://forums.zotero.org/discussion/12054/#Item_10 "
					+ "for instructions on correcting this problem."
			);
			
			// can attempt to delete on OS X
			try {
				var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
				var deletePipe = promptService.confirm(null, Zotero.getString("integration.error.title"), Zotero.getString("integration.error.deletePipe"));
				if(!deletePipe) return false;
				let escapedFifoFile = pipe.path.replace("'", "'\\''");
				Zotero.Utilities.Internal.executeAppleScript("do shell script \"rmdir '"+escapedFifoFile+"'; rm -f '"+escapedFifoFile+"'\" with administrator privileges", true);
				if(pipe.exists()) return false;
			} catch(e) {
				Zotero.logError(e);
				return false;
			}
		}
	}
	
	this.resetSessionStyles = Zotero.Promise.coroutine(function* (){
		for (let sessionID in Zotero.Integration.sessions) {
			let session = Zotero.Integration.sessions[sessionID];
			yield session.setData(session.data, true);
		}
	});
	
	this.getApplication = function(agent, command, docId) {
		// Try to load the appropriate Zotero component; otherwise display an error
		try {
			var componentClass = "@zotero.org/Zotero/integration/application?agent="+agent+";1";
			Zotero.debug("Integration: Instantiating "+componentClass+" for command "+command+(docId ? " with doc "+docId : ""));
			try {
				return Components.classes[componentClass]
					.getService(Components.interfaces.zoteroIntegrationApplication);
			} catch (e) {
				return Components.classes[componentClass]
					.getService(Components.interfaces.nsISupports).wrappedJSObject;
			}
		} catch(e) {
			throw new Zotero.Exception.Alert("integration.error.notInstalled",
				[], "integration.error.title");
		}	
	},
	
	/**
	 * Executes an integration command, first checking to make sure that versions are compatible
	 */
	this.execCommand = new function() {
		var inProgress;
		
		return Zotero.Promise.coroutine(function* execCommand(agent, command, docId) {
			var document;
			
			if (inProgress) {
				Zotero.Utilities.Internal.activate();
				if(Zotero.Integration.currentWindow && !Zotero.Integration.currentWindow.closed) {
					Zotero.Integration.currentWindow.focus();
				}
				Zotero.debug("Integration: Request already in progress; not executing "+agent+" "+command);
				return;
			}
			inProgress = true;
			
			var application = Zotero.Integration.getApplication(agent, command, docId);
			
			// Try to execute the command; otherwise display an error in alert service or word processor
			// (depending on what is possible)
			document = (application.getDocument && docId ? application.getDocument(docId) : application.getActiveDocument());
			try {
				yield Zotero.Promise.resolve((new Zotero.Integration.Interface(application, document))[command]());
			}
			catch (e) {
				if(!(e instanceof Zotero.Exception.UserCancelled)) {
					try {
						var displayError = null;
						if(e instanceof Zotero.Exception.Alert) {
							displayError = e.message;
						} else {
							if(e.toString().indexOf("ExceptionAlreadyDisplayed") === -1) {
								displayError = Zotero.getString("integration.error.generic")+"\n\n"+(e.message || e.toString());
							}
							if(e.stack) {
								Zotero.debug(e.stack);
							}
						}
						
						if(displayError) {
							var showErrorInFirefox = !document;
							
							if(document) {
								try {
									document.activate();
									document.displayAlert(displayError, DIALOG_ICON_STOP, DIALOG_BUTTONS_OK);
								} catch(e) {
									showErrorInFirefox = true;
								}
							}
							
							if(showErrorInFirefox) {
								Zotero.Utilities.Internal.activate();
								Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService)
									.alert(null, Zotero.getString("integration.error.title"), displayError);
							}
						}
					} finally {
						Zotero.logError(e);
					}
				}
			}
			finally {
				if(document) {
					try {
						document.cleanup();
						document.activate();
						
						// Call complete function if one exists
						if (document.wrappedJSObject && document.wrappedJSObject.complete) {
							document.wrappedJSObject.complete();
						} else if (document.complete) {
							document.complete();
						}
					} catch(e) {
						Zotero.logError(e);
					}
				}
				
				if(Zotero.Integration.currentWindow && !Zotero.Integration.currentWindow.closed) {
					var oldWindow = Zotero.Integration.currentWindow;
					Zotero.Promise.delay(100).then(function() {
						oldWindow.close();
					});
				}
				
				inProgress = Zotero.Integration.currentWindow = false;
			}
		});
	};
	
	/**
	 * Displays a dialog in a modal-like fashion without hanging the thread 
	 * @param {String} url The chrome:// URI of the window
	 * @param {String} [options] Options to pass to the window
	 * @param {String} [io] Data to pass to the window
	 * @return {Promise} Promise resolved when the window is closed
	 */
	this.displayDialog = function displayDialog(doc, url, options, io) {
		doc.cleanup();
		
		var allOptions = 'chrome,centerscreen';
		// without this, Firefox gets raised with our windows under Compiz
		if(Zotero.isLinux) allOptions += ',dialog=no';
		if(options) allOptions += ','+options;
		
		var window = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
			.getService(Components.interfaces.nsIWindowWatcher)
			.openWindow(null, url, '', allOptions, (io ? io : null));
		Zotero.Integration.currentWindow = window;
		Zotero.Utilities.Internal.activate(window);
		
		var deferred = Zotero.Promise.defer();
		var listener = function() {
			if(window.location.toString() === "about:blank") return;
			
			if(window.newWindow) {
				window = window.newWindow;
				Zotero.Integration.currentWindow = window;
				window.addEventListener("unload", listener, false);
				return;
			}
			
			Zotero.Integration.currentWindow = false;
			deferred.resolve();
		}
		window.addEventListener("unload", listener, false);
		
		return deferred.promise;
	};
	
	/**
	 * Default callback for field-related errors. All functions that do not define their
	 * own handlers for field-related errors should use this one.
	 */
	this.onFieldError = function onFieldError(err) {
		if(err.attemptToResolve) {
			return err.attemptToResolve();
		}
		throw err;
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
Zotero.Integration.MissingItemException.prototype = {
	"name":"MissingItemException",
	"message":"An item in this document is missing from your Zotero library.",
	"toString":function() { return this.message },
	"setContext":function(fieldGetter, fieldIndex) {
		this.fieldGetter = fieldGetter;
		this.fieldIndex = fieldIndex;
	},
	
	"attemptToResolve":function() {
		Zotero.logError(this);
		if(!this.fieldGetter) {
			throw new Error("Could not resolve "+this.name+": setContext not called");
		}
		
		// Ask user what to do with this item
		if(this.citationLength == 1) {
			var msg = Zotero.getString("integration.missingItem.single");
		} else {
			var msg = Zotero.getString("integration.missingItem.multiple", (this.citationIndex+1).toString());
		}
		msg += '\n\n'+Zotero.getString('integration.missingItem.description');
		this.fieldGetter._fields[this.fieldIndex].select();
		this.fieldGetter._doc.activate();
		var result = this.fieldGetter._doc.displayAlert(msg, 1, 3);
		if(result == 0) {			// Cancel
			return Zotero.Promise.reject(new Zotero.Exception.UserCancelled("document update"));
		} else if(result == 1) {	// No
			for (let reselectKey of this.reselectKeys) {
				this.fieldGetter._removeCodeKeys[reselectKey] = true;
			}
			this.fieldGetter._removeCodeFields[this.fieldIndex] = true;
			return this.fieldGetter._processFields(this.fieldIndex+1);
		} else {					// Yes
			// Display reselect item dialog
			var fieldGetter = this.fieldGetter,
				fieldIndex = this.fieldIndex,
				oldCurrentWindow = Zotero.Integration.currentWindow;
			return fieldGetter._session.reselectItem(fieldGetter._doc, this)
			.then(function() {
				// Now try again
				Zotero.Integration.currentWindow = oldCurrentWindow;
				fieldGetter._doc.activate();
				return fieldGetter._processFields(fieldIndex);
			});
		}
	}
}

Zotero.Integration.CorruptFieldException = function(code, cause) {
	this.code = code;
	this.cause = cause;
};
Zotero.Integration.CorruptFieldException.prototype = {
	"name":"CorruptFieldException",
	"message":"A field code in this document is corrupted.",
	"toString":function() { return this.cause.toString()+"\n\n"+this.code.toSource(); },
	"setContext":function(fieldGetter, fieldIndex, field) {
		this.fieldGetter = fieldGetter;
		this.fieldIndex = fieldIndex;
	},
	
	/**
	 * Tries to resolve the CorruptFieldException
	 * @return {Promise} A promise that is either resolved with true or rejected with
	 *    Zotero.Exception.UserCancelled
	 */
	"attemptToResolve":function() {
		Zotero.logError(this.cause);
		if(!this.fieldGetter) {
			throw new Error("Could not resolve "+this.name+": setContext not called");
		}
		
		var msg = Zotero.getString("integration.corruptField")+'\n\n'+
				  Zotero.getString('integration.corruptField.description'),
			field = this.fieldGetter._fields[this.fieldIndex];
		field.select();
		this.fieldGetter._doc.activate();
		var result = this.fieldGetter._doc.displayAlert(msg, DIALOG_ICON_CAUTION, DIALOG_BUTTONS_YES_NO_CANCEL); 
		if(result == 0) {
			return Zotero.Promise.reject(new Zotero.Exception.UserCancelled("document update"));
		} else if(result == 1) {		// No
			this.fieldGetter._removeCodeFields[this.fieldIndex] = true;
			return this.fieldGetter._processFields(this.fieldIndex+1);
		} else {
			// Display reselect edit citation dialog
			var fieldGetter = this.fieldGetter,
				oldWindow = Zotero.Integration.currentWindow,
				oldProgressCallback = this.progressCallback;
			return fieldGetter.addEditCitation(field).then(function() {
				if(Zotero.Integration.currentWindow && !Zotero.Integration.currentWindow.closed) {
					Zotero.Integration.currentWindow.close();
				}
				Zotero.Integration.currentWindow = oldWindow;
				fieldGetter.progressCallback = oldProgressCallback;
				return fieldGetter.updateSession();
			});
		}
	}
};

/**
 * An exception to encapsulate the case where bibliography data is invalid.
 * @class
 */
Zotero.Integration.CorruptBibliographyException = function(code, cause) {
	this.code = code;
	this.cause = cause;
}
Zotero.Integration.CorruptBibliographyException.prototype = {
	"name":"CorruptBibliographyException",
	"message":"A bibliography in this document is corrupted.",
	"toString":function() { return this.cause.toString()+"\n\n"+this.code },
	
	"setContext":function(fieldGetter) {
		this.fieldGetter = fieldGetter;
	},
	
	/**
	 * Tries to resolve the CorruptBibliographyException
	 * @return {Promise} A promise that is either resolved with true or rejected with
	 *    Zotero.Exception.UserCancelled
	 */
	"attemptToResolve":function() {
		Zotero.debug("Attempting to resolve")
		Zotero.logError(this.cause);
		if(!this.fieldGetter) {
			throw new Error("Could not resolve "+this.name+": setContext not called");
		}
		
		var msg = Zotero.getString("integration.corruptBibliography")+'\n\n'+
				  Zotero.getString('integration.corruptBibliography.description');
		var result = this.fieldGetter._doc.displayAlert(msg, DIALOG_ICON_CAUTION, DIALOG_BUTTONS_OK_CANCEL);
		if(result == 0) {
			return Zotero.Promise.reject(new Zotero.Exception.UserCancelled("clearing corrupted bibliography"));
		} else {
			this.fieldGetter._bibliographyData = "";
			this.fieldGetter._session.bibliographyHasChanged = true;
			this.fieldGetter._session.bibliographyDataHasChanged = true;
			return Zotero.Promise.resolve(true);
		}
	}
};

const INTEGRATION_TYPE_ITEM = 1;
const INTEGRATION_TYPE_BIBLIOGRAPHY = 2;
const INTEGRATION_TYPE_TEMP = 3;

// Placeholder for an empty bibliography
const BIBLIOGRAPHY_PLACEHOLDER = "{Bibliography}";

/**
 * All methods for interacting with a document
 * @constructor
 */
Zotero.Integration.Interface = function(app, doc) {
	this._app = app;
	this._doc = doc;
}
/**
 * Creates a new session
 * @param data {Zotero.Integration.DocumentData} Document data for new session
 * @return {Zotero.Integration.Session}
 */
Zotero.Integration.Interface.prototype._createNewSession = function _createNewSession(data) {
	data.sessionID = Zotero.randomString();
	var session = Zotero.Integration.sessions[data.sessionID] = new Zotero.Integration.Session(this._doc);
	return session;
};

/**
 * Gets preferences for a document
 * @param require {Boolean} Whether an error should be thrown if no preferences or fields
 *     exist (otherwise, the set doc prefs dialog is shown)
 * @param dontRunSetDocPrefs {Boolean} Whether to show the Set Document Preferences
 *    window if no preferences exist
 * @return {Promise} Promise resolved with true if a session was found or false if
 *    dontRunSetDocPrefs is true and no session was found, or rejected with
 *    Zotero.Exception.UserCancelled if the document preferences window was cancelled.
 */
Zotero.Integration.Interface.prototype._getSession = Zotero.Promise.coroutine(function *(require, dontRunSetDocPrefs) {
	var dataString = this._doc.getDocumentData(),
		data,
		me = this;
	
	if(dataString) {
		try {
			data = new Zotero.Integration.DocumentData(dataString);
		} catch(e) {};
	}
	
	// If no data or corrupted data, show doc prefs window again
	if (!data || !data.prefs || !data.prefs.fieldType) {
		var haveFields = false;
		data = new Zotero.Integration.DocumentData();
		
		if(require) {
			// check to see if fields already exist
			for (let fieldType of [this._app.primaryFieldType, this._app.secondaryFieldType]) {
				var fields = this._doc.getFields(this._app.primaryFieldType);
				if(fields.hasMoreElements()) {
					data.prefs.fieldType = this._app.primaryFieldType;
					haveFields = true;
					break;
				}
			}
			
			// if no fields, throw an error
			if(!haveFields) {
				return Zotero.Promise.reject(new Zotero.Exception.Alert(
				"integration.error.mustInsertCitation",
				[], "integration.error.title"));
			} else {
				Zotero.debug("Integration: No document preferences found, but found "+data.prefs.fieldType+" fields");
			}
		}
		
		// Set doc prefs if no data string yet
		this._session = this._createNewSession(data);
		yield this._session.setData(data);
		if(dontRunSetDocPrefs) return Zotero.Promise.resolve(false);
		
		return this._session.setDocPrefs(this._doc, this._app.primaryFieldType,
		this._app.secondaryFieldType).then(function(status) {
			// save doc prefs in doc
			me._doc.setDocumentData(me._session.data.serialize());
			
			if(haveFields) {
				me._session.reload = true;
			}
			
			return me._session;
		});
	} else {
		if(data.dataVersion < DATA_VERSION) {
			if(data.dataVersion == 1
					&& data.prefs.fieldType == "Field"
					&& this._app.primaryFieldType == "ReferenceMark") {
				// Converted OOo docs use ReferenceMarks, not fields
				data.prefs.fieldType = "ReferenceMark";
			}
			
			var warning = this._doc.displayAlert(Zotero.getString("integration.upgradeWarning", [Zotero.clientName, '5.0']),
				DIALOG_ICON_WARNING, DIALOG_BUTTONS_OK_CANCEL);
			if(!warning) {
				return Zotero.Promise.reject(new Zotero.Exception.UserCancelled("document upgrade"));
			}
		// Don't throw for version 4(JSON) during the transition from 4.0 to 5.0
		} else if((data.dataVersion > DATA_VERSION) && data.dataVersion != 4) {
			return Zotero.Promise.reject(new Zotero.Exception.Alert("integration.error.newerDocumentVersion",
					[data.zoteroVersion, Zotero.version], "integration.error.title"));
		}
		
		if(data.prefs.fieldType !== this._app.primaryFieldType
				&& data.prefs.fieldType !== this._app.secondaryFieldType) {
			return Zotero.Promise.reject(new Zotero.Exception.Alert("integration.error.fieldTypeMismatch",
					[], "integration.error.title"));
		}
		
		if (Zotero.Integration.sessions[data.sessionID]) {
			// If communication occured with this document since restart
			this._session = Zotero.Integration.sessions[data.sessionID];
		} else {
			// Document has zotero data, but has not communicated since Zotero restart
			this._session = this._createNewSession(data);
			try {
				yield this._session.setData(data);
				// this._createNewSession() updates sessionID, which we need to store back into the doc
				this._doc.setDocumentData(me._session.data.serialize())
			} catch(e) {
				// make sure style is defined
				if(e instanceof Zotero.Exception.Alert && e.name === "integration.error.invalidStyle") {
					if (data.style.styleID) {
						let displayError = Zotero.getString("integration.error.styleMissing", data.style.styleID);
						if (/^https?:\/\/(www\.)?(zotero\.org|citationstyles\.org)/.test(data.style.styleID) || 
							me._doc.displayAlert(displayError, DIALOG_ICON_WARNING, DIALOG_BUTTONS_YES_NO)) {
							
							let installed = false;
							try {
								yield Zotero.Styles.install(
									{url: data.style.styleID}, data.style.styleID, true
								);
								installed = true;
							}
							catch (e) {
								me._doc.displayAlert(
									Zotero.getString(
										'integration.error.styleNotFound', data.style.styleID
									),
									DIALOG_ICON_WARNING,
									DIALOG_BUTTONS_OK
								);
							}
							if (installed) {
								yield this._session.setData(data, true);
								return Zotero.Promise.resolve(this._session);
							}
						}
					}
					return this._session.setDocPrefs(this._doc, this._app.primaryFieldType,
					this._app.secondaryFieldType).then(function(status) {			
						me._doc.setDocumentData(me._session.data.serialize());
						me._session.reload = true;
						return me._session;
					});
				} else {
					return Zotero.Promise.reject(e);
				}
			}
			
			this._session.reload = true;
		}
		return Zotero.Promise.resolve(this._session);
	}
});

/**
 * Adds a citation to the current document.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.addCitation = function() {
	var me = this;
	return this._getSession(false, false).then(function() {
		return (new Zotero.Integration.Fields(me._session, me._doc)).addEditCitation(null);
	});
}

/**
 * Edits the citation at the cursor position.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.editCitation = function() {
	var me = this;
	return this._getSession(true, false).then(function() {
		var field = me._doc.cursorInField(me._session.data.prefs['fieldType']);
		if(!field) {
			throw new Zotero.Exception.Alert("integration.error.notInCitation", [],
				"integration.error.title");
		}
		
		return (new Zotero.Integration.Fields(me._session, me._doc)).addEditCitation(field);
	});
}

/**
 * Edits the citation at the cursor position if one exists, or else adds a new one.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.addEditCitation = function() {
	var me = this;
	return this._getSession(false, false).then(function() {
		var field = me._doc.cursorInField(me._session.data.prefs['fieldType']);
		return (new Zotero.Integration.Fields(me._session, me._doc)).addEditCitation(field);
	});
}

/**
 * Adds a bibliography to the current document.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.addBibliography = function() {
	var me = this;
	return this._getSession(true, false).then(function() {
		// Make sure we can have a bibliography
		if(!me._session.data.style.hasBibliography) {
			throw new Zotero.Exception.Alert("integration.error.noBibliography", [],
				"integration.error.title");
		}
		
		var fieldGetter = new Zotero.Integration.Fields(me._session, me._doc, Zotero.Integration.onFieldError);
		return fieldGetter.addField().then(function(field) {
			field.setCode("BIBL");
			return fieldGetter.updateSession().then(function() {
				return fieldGetter.updateDocument(FORCE_CITATIONS_FALSE, true, false);
			});
		});
	});
}

/**
 * Edits bibliography metadata.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.editBibliography = function() {
	// Make sure we have a bibliography
	var me = this, fieldGetter;
	return this._getSession(true, false).then(function() {
		fieldGetter = new Zotero.Integration.Fields(me._session, me._doc, Zotero.Integration.onFieldError);
		return fieldGetter.get();
	}).then(function(fields) {
		var haveBibliography = false;
		for (let i = fields.length-1; i >= 0; i--) {
			let field = Zotero.Integration.Field.loadExisting(fields[i]);
			if (field.type == INTEGRATION_TYPE_BIBLIOGRAPHY) {
				haveBibliography = true;
				break;
			}
		}
		
		if(!haveBibliography) {
			throw new Zotero.Exception.Alert("integration.error.mustInsertBibliography",
				[], "integration.error.title");
		}
		return fieldGetter.updateSession();
	}).then(function() {
		return me._session.editBibliography(me._doc);
	}).then(function() {
		return fieldGetter.updateDocument(FORCE_CITATIONS_FALSE, true, false);
	});
}


Zotero.Integration.Interface.prototype.addEditBibliography = Zotero.Promise.coroutine(function *() {
	// Check if we have a bibliography
	var session = yield this._getSession(true, false);
	
	if (!session.data.style.hasBibliography) {
		throw new Zotero.Exception.Alert("integration.error.noBibliography", [],
			"integration.error.title");
	}
	
	var fieldGetter = new Zotero.Integration.Fields(session, this._doc, Zotero.Integration.onFieldError);
	var fields = yield fieldGetter.get();
	
	var haveBibliography = false;
	for (let i = fields.length-1; i >= 0; i--) {
		let field = Zotero.Integration.Field.loadExisting(fields[i]);
		if (field.type == INTEGRATION_TYPE_BIBLIOGRAPHY) {
			haveBibliography = true;
			break;
		}
	}
	
	if (haveBibliography) {
		yield fieldGetter.updateSession();
		yield session.editBibliography(this._doc);
	} else {
		var field = new Zotero.Integration.BibliographyField(yield fieldGetter.addField());
		field.setCode("BIBL");
		yield fieldGetter.updateSession();
	}
	return fieldGetter.updateDocument(FORCE_CITATIONS_FALSE, true, false);
});

/**
 * Updates the citation data for all citations and bibliography entries.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.refresh = function() {
	var me = this;
	return this._getSession(true, false).then(function() {
		// Send request, forcing update of citations and bibliography
		var fieldGetter = new Zotero.Integration.Fields(me._session, me._doc, Zotero.Integration.onFieldError);
		return fieldGetter.updateSession().then(function() {
			return fieldGetter.updateDocument(FORCE_CITATIONS_REGENERATE, true, false);
		});
	});
}

/**
 * Deletes field codes.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.removeCodes = function() {
	var me = this;
	return this._getSession(true, false).then(function() {
		var fieldGetter = new Zotero.Integration.Fields(me._session, me._doc);
		return fieldGetter.get()
	}).then(function(fields) {
		var result = me._doc.displayAlert(Zotero.getString("integration.removeCodesWarning"),
					DIALOG_ICON_WARNING, DIALOG_BUTTONS_OK_CANCEL);
		if(result) {
			for(var i=fields.length-1; i>=0; i--) {
				fields[i].removeCode();
			}
		}
	});
}

/**
 * Displays a dialog to set document preferences (style, footnotes/endnotes, etc.)
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.setDocPrefs = Zotero.Promise.coroutine(function* () {
	var fieldGetter,
		oldData;
	let haveSession = yield this._getSession(false, true);
	
	fieldGetter = new Zotero.Integration.Fields(this._session, this._doc, Zotero.Integration.onFieldError);
	var setDocPrefs = this._session.setDocPrefs.bind(this._session, this._doc,
			this._app.primaryFieldType, this._app.secondaryFieldType);
			
	if(!haveSession) {
		// This is a brand new document; don't try to get fields
		oldData = yield setDocPrefs();
	} else {
		// Can get fields while dialog is open
		oldData = yield Zotero.Promise.all([
			fieldGetter.get(),
			setDocPrefs()
		]).spread(function (fields, setDocPrefs) {
			// Only return value from setDocPrefs
			return setDocPrefs;
		});
	}
	
	// Write document data to document
	this._doc.setDocumentData(this._session.data.serialize());
	
	// If oldData is null, then there was no document data, so we don't need to update
	// fields
	if (!oldData) return false;

	// Perform noteType or fieldType conversion
	let fields = yield fieldGetter.get();
	
	var convertBibliographies = oldData.prefs.fieldType != this._session.data.prefs.fieldType;
	var convertItems = convertBibliographies
		|| oldData.prefs.noteType != this._session.data.prefs.noteType;
	var fieldsToConvert = new Array();
	var fieldNoteTypes = new Array();
	for (var i=0, n=fields.length; i<n; i++) {
		let field = Zotero.Integration.Field.loadExisting(fields[i]);
		
		if (convertItems && field.type === INTEGRATION_TYPE_ITEM) {
			var citation = field.unserialize();
			if (!citation.properties.dontUpdate) {
				fieldsToConvert.push(field);
				fieldNoteTypes.push(this._session.data.prefs.noteType);
			}
		} else if(convertBibliographies
				&& type === INTEGRATION_TYPE_BIBLIOGRAPHY) {
			fieldsToConvert.push(field);
			fieldNoteTypes.push(0);
		}
	}
	
	if(fieldsToConvert.length) {
		// Pass to conversion function
		this._doc.convert(new Zotero.Integration.JSEnumerator(fieldsToConvert),
			this._session.data.prefs.fieldType, fieldNoteTypes,
			fieldNoteTypes.length);
	}
	
	// Refresh contents
	fieldGetter = new Zotero.Integration.Fields(this._session, this._doc, Zotero.Integration.onFieldError);
	fieldGetter.ignoreEmptyBibliography = false;
	return fieldGetter.updateSession().then(fieldGetter.updateDocument.bind(
		fieldGetter, FORCE_CITATIONS_RESET_TEXT, true, true));
});

/**
 * An exceedingly simple nsISimpleEnumerator implementation
 */
Zotero.Integration.JSEnumerator = function(objArray) {
	this.objArray = objArray;
}
Zotero.Integration.JSEnumerator.prototype.hasMoreElements = function() {
	return this.objArray.length;
}
Zotero.Integration.JSEnumerator.prototype.getNext = function() {
	return this.objArray.shift();
}

/**
 * Methods for retrieving fields from a document
 * @constructor
 */
Zotero.Integration.Fields = function(session, doc, fieldErrorHandler) {
	this.ignoreEmptyBibliography = true;

	// Callback called while retrieving fields with the percentage complete.
	this.progressCallback = null;

	// Promise injected into the middle of the promise chain while retrieving fields, to check for
	// recoverable errors. If the fieldErrorHandler is fulfilled, then the rest of the promise
	// chain continues. If the fieldErrorHandler is rejected, then the promise chain is rejected.
	this.fieldErrorHandler = fieldErrorHandler;

	this._session = session;
	this._doc = doc;

	this._deferreds = null;
	this._removeCodeKeys = {};
	this._removeCodeFields = {};
	this._bibliographyFields = [];
	this._bibliographyData = "";
}

/**
 * Checks that it is appropriate to add fields to the current document at the current
 * positon, then adds one.
 */
Zotero.Integration.Fields.prototype.addField = function(note) {
	// Get citation types if necessary
	if (!this._doc.canInsertField(this._session.data.prefs['fieldType'])) {
		return Zotero.Promise.reject(new Zotero.Exception.Alert("integration.error.cannotInsertHere",
		[], "integration.error.title"));
	}
	
	var field = this._doc.cursorInField(this._session.data.prefs['fieldType']);
	if (field) {
		if (!this._doc.displayAlert(Zotero.getString("integration.replace"),
				DIALOG_ICON_STOP,
				DIALOG_BUTTONS_OK_CANCEL)) {
			return Zotero.Promise.reject(new Zotero.Exception.UserCancelled("inserting citation"));
		}
	}
	
	if (!field) {
		field = this._doc.insertField(this._session.data.prefs['fieldType'],
			(note ? this._session.data.prefs["noteType"] : 0));
	}
	// If fields already retrieved, further this.get() calls will returned the cached version
	// So we append this field to that list
	if (this._fields) {
		this._fields.push(field);
	}
	
	return Zotero.Promise.resolve(field);
}

/**
 * Gets all fields for a document
 * @return {Promise} Promise resolved with field list.
 */
Zotero.Integration.Fields.prototype.get = function get() {
	// If we already have fields, just return them
	if(this._fields) {
		return Zotero.Promise.resolve(this._fields);
	}
	
	// Create a new promise and add it to promise list
	var deferred = Zotero.Promise.defer();
	
	// If already getting fields, just return the promise
	if(this._deferreds) {
		this._deferreds.push(deferred);
		return deferred.promise;
	} else {
		this._deferreds = [deferred];
	}
	
	// Otherwise, start getting fields
	var getFieldsTime = (new Date()).getTime(),
		me = this;
	this._doc.getFieldsAsync(this._session.data.prefs['fieldType'],
	{"observe":function(subject, topic, data) {
		if(topic === "fields-available") {
			if(me.progressCallback) {
				try {
					me.progressCallback(75);
				} catch(e) {
					Zotero.logError(e);
				};
			}
			
			try {
				// Add fields to fields array
				var fieldsEnumerator = subject.QueryInterface(Components.interfaces.nsISimpleEnumerator);
				var fields = me._fields = [];
				while(fieldsEnumerator.hasMoreElements()) {
					let field = fieldsEnumerator.getNext();
					try {
						fields.push(field.QueryInterface(Components.interfaces.zoteroIntegrationField));
					} catch (e) {
						fields.push(field);
					}
				}
				
				if(Zotero.Debug.enabled) {
					var endTime = (new Date()).getTime();
					Zotero.debug("Integration: Retrieved "+fields.length+" fields in "+
						(endTime-getFieldsTime)/1000+"; "+
						1000/((endTime-getFieldsTime)/fields.length)+" fields/second");
				}
			} catch(e) {
				// Reject promises
				for(var i=0, n=me._deferreds.length; i<n; i++) {
					me._deferreds[i].reject(e);
				}
				me._deferreds = [];
				return;
			}
			
			// Resolve promises
			for(var i=0, n=me._deferreds.length; i<n; i++) {
				me._deferreds[i].resolve(fields);
			}
			me._deferreds = [];
		} else if(topic === "fields-progress") {
			if(me.progressCallback) {
				try {
					me.progressCallback((data ? parseInt(data, 10)*(3/4) : null));
				} catch(e) {
					Zotero.logError(e);
				};
			}
		} else if(topic === "fields-error") {
			for(var i=0, n=me._deferreds.length; i<n; i++) {
				me._deferreds[i].reject(data);
			}
			me._deferreds = [];
		}
	}, QueryInterface:XPCOMUtils.generateQI([Components.interfaces.nsIObserver, Components.interfaces.nsISupports])});
	return deferred.promise;
}

/**
 * Updates Zotero.Integration.Session attached to Zotero.Integration.Fields in line with document
 */
Zotero.Integration.Fields.prototype.updateSession = Zotero.Promise.coroutine(function* () {
	var collectFieldsTime;
	yield this.get();
	this._session.resetRequest(this._doc);
	
	this._removeCodeKeys = {};
	this._removeCodeFields = {};
	this._bibliographyFields = [];
	this._bibliographyData = "";
	
	collectFieldsTime = (new Date()).getTime();
	yield this._processFields();
	
	var endTime = (new Date()).getTime();
	if(Zotero.Debug.enabled) {
		Zotero.debug("Integration: Updated session data for " + this._fields.length + " fields in "
			+ (endTime - collectFieldsTime) / 1000 + "; "
			+ 1000/ ((endTime - collectFieldsTime) / this._fields.length) + " fields/second");
	}
	
	// Load uncited items from bibliography
	if (this._bibliographyData && !this._session.bibliographyData) {
		try {
			yield this._session.loadBibliographyData(this._bibliographyData);
		} catch(e) {
			var exception = new Zotero.Integration.CorruptBibliographyException(this, e);
			exception.setContext(this);
			throw exception;
		}
	}
	
	// if we are reloading this session, assume no item IDs to be updated except for
	// edited items
	if (this._session.reload) {
		//this._session.restoreProcessorState(); TODO doesn't appear to be working properly
		this._session.updateUpdateIndices();
		// Iterate through citations, yielding for UI updates
		yield Zotero.Promise.each(this._session._updateCitations(), () => {});
		this._session.updateIndices = {};
		this._session.updateItemIDs = {};
		this._session.citationText = {};
		this._session.bibliographyHasChanged = false;
		delete this._session.reload;
	}
});

/**
 * Keep processing fields until all have been processed
 */
Zotero.Integration.Fields.prototype._processFields = Zotero.Promise.coroutine(function* (i) {
	if(!i) i = 0;
	
	for(var n = this._fields.length; i<n; i++) {
		let field = Zotero.Integration.Field.loadExisting(this._fields[i]);
		if (field.type === INTEGRATION_TYPE_ITEM) {
			var noteIndex = field.getNoteIndex();
			try {
				yield this._session.addCitation(i, noteIndex, field.unserialize());
			} catch(e) {
				var removeCode = false;
				
				if(e instanceof Zotero.Integration.CorruptFieldException) {
					e.setContext(this, i)
				} else if(e instanceof Zotero.Integration.MissingItemException) {						
					// Check if we've already decided to remove this field code
					for (let reselectKey of e.reselectKeys) {
						if(this._removeCodeKeys[reselectKey]) {
							this._removeCodeFields[i] = true;
							removeCode = true;
							break;
						}
					}
					if(!removeCode) e.setContext(this, i);
				}
				
				if(!removeCode) {
					if(this.fieldErrorHandler) return this.fieldErrorHandler(e);
					throw e;
				}
			}
		} else if (field.type === INTEGRATION_TYPE_BIBLIOGRAPHY) {
			if (this.ignoreEmptyBibliography && field.text.trim() === "") {
				this._removeCodeFields[i] = true;
			} else {
				this._bibliographyFields.push(field);
				if(!this._session.bibliographyData && !this._bibliographyData) {
					this._bibliographyData = field.code;
				}
			}
		}
	}
});

/**
 * Updates bibliographies and fields within a document
 * @param {Boolean} forceCitations Whether to regenerate all citations
 * @param {Boolean} forceBibliography Whether to regenerate all bibliography entries
 * @param {Boolean} [ignoreCitationChanges] Whether to ignore changes to citations that have been 
 *	   modified since they were created, instead of showing a warning
 * @return {Promise} A promise resolved when the document is updated
 */
Zotero.Integration.Fields.prototype.updateDocument = Zotero.Promise.coroutine(function* (forceCitations, forceBibliography,
		ignoreCitationChanges) {
	// Update citations
	this._session.updateUpdateIndices(forceCitations);
	// Iterate through citations, yielding for UI updates
	yield Zotero.Promise.each(this._session._updateCitations(), () => {});
	
	yield Zotero.Promise.each(
		this._updateDocument(forceCitations, forceBibliography, ignoreCitationChanges), () => {});
});

/**
 * Helper function to update bibliographys and fields within a document
 * @param {Boolean} forceCitations Whether to regenerate all citations
 * @param {Boolean} forceBibliography Whether to regenerate all bibliography entries
 * @param {Boolean} [ignoreCitationChanges] Whether to ignore changes to citations that have been 
 *	modified since they were created, instead of showing a warning
 */
Zotero.Integration.Fields.prototype._updateDocument = function* (forceCitations, forceBibliography,
		ignoreCitationChanges) {
	if(this.progressCallback) {
		var nFieldUpdates = Object.keys(this._session.updateIndices).length;
		if(this._session.bibliographyHasChanged || forceBibliography) {
			nFieldUpdates += this._bibliographyFields.length*5;
		}
	}
	
	var nUpdated=0;
	for(var i in this._session.updateIndices) {
		if(this.progressCallback && nUpdated % 10 == 0) {
			try {
				this.progressCallback(75+(nUpdated/nFieldUpdates)*25);
			} catch(e) {
				Zotero.logError(e);
			}
			yield;
		}
		
		var citation = this._session.citationsByIndex[i];
		var field = this._fields[i];
		
		// If there is no citation, we're deleting it, or we shouldn't update it, ignore
		// it
		if(!citation || citation.properties.delete) continue;
		var isRich = false;
		
		if(!citation.properties.dontUpdate) {
			var formattedCitation = citation.properties.custom
				? citation.properties.custom : this._session.citationText[i];
			
			if(formattedCitation.indexOf("\\") !== -1) {
				// need to set text as RTF
				formattedCitation = "{\\rtf "+formattedCitation+"}"
				isRich = true;
			}
			
			if(forceCitations === FORCE_CITATIONS_RESET_TEXT
					|| citation.properties.formattedCitation !== formattedCitation) {
				// Check if citation has been manually modified
				if(!ignoreCitationChanges && citation.properties.plainCitation) {
					var plainCitation = field.getText();
					if(plainCitation !== citation.properties.plainCitation) {
						// Citation manually modified; ask user if they want to save changes
						Zotero.debug("[_updateDocument] Attempting to update manually modified citation.\n"
							+ "Original: " + citation.properties.plainCitation + "\n"
							+ "Current:  " + plainCitation
						);
						field.select();
						var result = this._doc.displayAlert(
							Zotero.getString("integration.citationChanged")+"\n\n"+Zotero.getString("integration.citationChanged.description"), 
							DIALOG_ICON_CAUTION, DIALOG_BUTTONS_YES_NO);
						if(result) {
							citation.properties.dontUpdate = true;
						}
					}
				}
				
				if(!citation.properties.dontUpdate) {
					field.setText(formattedCitation, isRich);
					
					citation.properties.formattedCitation = formattedCitation;
					citation.properties.plainCitation = field.getText();
				}
			}
		}
		
		var fieldCode = this._session.getCitationField(citation);
		if(fieldCode != citation.properties.field) {
			field.setCode(`ITEM CSL_CITATION ${fieldCode}`);
			if(this._session.data.prefs.fieldType === "ReferenceMark"
					&& this._session.data.prefs.noteType != 0 && isRich
					&& !citation.properties.dontUpdate) {
				// For ReferenceMarks with formatting, we need to set the text again, because
				// setting the field code removes formatting from the mark. I don't like this.
				field.setText(formattedCitation, isRich);
			}
		}
		nUpdated++;
	}
	
	// update bibliographies
	if(this._bibliographyFields.length	 				// if bibliography exists
			&& (this._session.bibliographyHasChanged	// and bibliography changed
			|| forceBibliography)) {					// or if we should generate regardless of
														// changes
		var bibliographyFields = this._bibliographyFields;
		
		if(forceBibliography || this._session.bibliographyDataHasChanged) {
			var bibliographyData = this._session.getBibliographyData();
			for (let field of bibliographyFields) {
				field.setCode(`BIBL ${bibliographyData} CSL_BIBLIOGRAPHY`);
			}
		}
		
		// get bibliography and format as RTF
		var bib = this._session.getBibliography();
		
		var bibliographyText = "";
		if(bib) {
			bibliographyText = bib[0].bibstart+bib[1].join("\\\r\n")+"\\\r\n"+bib[0].bibend;
			
			// if bibliography style not set, set it
			if(!this._session.data.style.bibliographyStyleHasBeenSet) {
				var bibStyle = Zotero.Cite.getBibliographyFormatParameters(bib);
				
				// set bibliography style
				this._doc.setBibliographyStyle(bibStyle.firstLineIndent, bibStyle.indent,
					bibStyle.lineSpacing, bibStyle.entrySpacing, bibStyle.tabStops, bibStyle.tabStops.length);
				
				// set bibliographyStyleHasBeenSet parameter to prevent further changes	
				this._session.data.style.bibliographyStyleHasBeenSet = true;
				this._doc.setDocumentData(this._session.data.serialize());
			}
		}
		
		// set bibliography text
		for (let field of bibliographyFields) {
			if(this.progressCallback) {
				try {
					this.progressCallback(75+(nUpdated/nFieldUpdates)*25);
				} catch(e) {
					Zotero.logError(e);
				}
				yield;
			}
			
			if(bibliographyText) {
				field.setText(bibliographyText, true);
			} else {
				field.setText("{Bibliography}", false);
			}
			nUpdated += 5;
		}
	}
	
	// Do these operations in reverse in case plug-ins care about order
	for(var i=this._session.citationsByIndex.length-1; i>=0; i--) {
		if(this._session.citationsByIndex[i] &&
				this._session.citationsByIndex[i].properties.delete) {
			this._fields[i].delete();
		}
	}
	var removeCodeFields = Object.keys(this._removeCodeFields).sort();
	for(var i=(removeCodeFields.length-1); i>=0; i--) {
		this._fields[removeCodeFields[i]].removeCode();
	}
}

/**
 * Brings up the addCitationDialog, prepopulated if a citation is provided
 */
Zotero.Integration.Fields.prototype.addEditCitation = Zotero.Promise.coroutine(function* (field) {
	var newField, citation;
	
	// TODO: refactor citation/field preparation
	// Citation loading should be moved into Zotero.Integration.Citation
	
	// if there's already a citation, make sure we have item IDs in addition to keys
	if (field) {
		field = Zotero.Integration.Field.loadExisting(field);
		if (field.type != INTEGRATION_TYPE_ITEM) {			
			throw new Zotero.Exception.Alert("integration.error.notInCitation");
		}
		
		try {
			citation = field.unserialize();
		} catch(e) {}
		
		if (citation) {
			try {
				yield this._session.lookupItems(citation);
			} catch(e) {
				if(e instanceof Zotero.Integration.MissingItemException) {
					citation.citationItems = [];
				} else {
					throw e;
				}
			}
			
			if(citation.properties.dontUpdate
					|| (citation.properties.plainCitation
						&& field.getText() !== citation.properties.plainCitation)) {
				this._doc.activate();
				Zotero.debug("[addEditCitation] Attempting to update manually modified citation.\n"
					+ "citation.properties.dontUpdate: " + citation.properties.dontUpdate + "\n"
					+ "Original: " + citation.properties.plainCitation + "\n"
					+ "Current:  " + field.getText()
				);
				if(!this._doc.displayAlert(Zotero.getString("integration.citationChanged.edit"),
						DIALOG_ICON_WARNING, DIALOG_BUTTONS_OK_CANCEL)) {
					throw new Zotero.Exception.UserCancelled("editing citation");
				}
			}
			
			// make sure it's going to get updated
			delete citation.properties["formattedCitation"];
			delete citation.properties["plainCitation"];
			delete citation.properties["dontUpdate"];
		}
	} else {
		newField = true;
		field = new Zotero.Integration.CitationField(yield this.addField(true));
	}
	
	if (!citation) {
		field.setCode("TEMP");
		citation = {"citationItems":[], "properties":{}};
	}
	
	// -------------------
	// Preparing stuff to pass into CitationEditInterface
	var fieldIndexPromise = this.get().then(function(fields) {
		for (var i=0, n=fields.length; i<n; i++) {
			if (fields[i].equals(field)) {
				return i;
			}
		}
	});
	
	var citationsByItemIDPromise = fieldIndexPromise.then(function() {
		return this.updateSession();
	}.bind(this)).then(function() {
		return this._session.citationsByItemID;
	}.bind(this));

	// Required for preview fn
	citation.properties.noteIndex = field.getNoteIndex();
	var previewFn = Zotero.Promise.coroutine(function* (citation) {
		let idx = yield fieldIndexPromise;
		let citationsPre, citationsPost, citationIndices;
		[citationsPre, citationsPost, citationIndices] = this._session._getPrePost(idx);
		try {
			return this._session.style.previewCitationCluster(citation, citationsPre, citationsPost, "rtf");
		} catch(e) {
			throw e;
		}
	}.bind(this));
		
	var io = new Zotero.Integration.CitationEditInterface(
		// Clone citation
		JSON.parse(JSON.stringify(citation)), 
		this._session.style.opt.sort_citations, fieldIndexPromise, citationsByItemIDPromise,
		previewFn
	);
	
	if (Zotero.Prefs.get("integration.useClassicAddCitationDialog")) {
		Zotero.Integration.displayDialog(this._doc,
		'chrome://zotero/content/integration/addCitationDialog.xul', 'alwaysRaised,resizable',
		io);
	} else {
		var mode = (!Zotero.isMac && Zotero.Prefs.get('integration.keepAddCitationDialogRaised')
			? 'popup' : 'alwaysRaised')+',resizable=false';
		Zotero.Integration.displayDialog(this._doc,
		'chrome://zotero/content/integration/quickFormat.xul', mode, io);
	}

	// -------------------
	// io.promise resolves/rejects when the citation dialog is closed
	try {
		this.progressCallback = yield io.promise;
	} catch (e) {
		if (newField) {
			// Try to delete new field on failure
			try {
				field.delete();
			} catch(e) {}
			throw e;	
		}
	}
	
	if (!io.citation.citationItems.length) {
		throw new Zotero.Exception.UserCancelled("inserting citation");
	}

	let fieldIndex = yield fieldIndexPromise;
	yield this._session.addCitation(fieldIndex, field.getNoteIndex(), io.citation);
	this._session.updateIndices[fieldIndex] = true;
	
	// Check if bibliography changed
	// TODO: do an actual check
	this._session.bibliographyHasChanged = true;
	// if (!this._session.bibliographyHasChanged) {
	// 	let citationItems = io.citation.citationItems;
	// 	for (let i = 0; i < citationItems.length; i++) {
	// 		if (this._session.citationsByItemID[citationItems[i].itemID] &&
	// 				this._session.citationsByItemID[citationItems[i].itemID].length == 1) {
	// 			this._session.bibliographyHasChanged = true;
	// 			break;
	// 		}
	// 	}
	// }
	
	// Update document
	return this.updateDocument(FORCE_CITATIONS_FALSE, false, false);
});

/**
 * Citation editing functions and propertiesaccessible to quickFormat.js and addCitationDialog.js
 */
Zotero.Integration.CitationEditInterface = function(citation, sortable, fieldIndexPromise, citationsByItemIDPromise, previewFn) {
	this.citation = citation;
	this.sortable = sortable;
	this.previewFn = previewFn;
	this._fieldIndexPromise = fieldIndexPromise;
	this._citationsByItemIDPromise = citationsByItemIDPromise;
	
	// Not available in quickFormat.js if this unspecified
	this.wrappedJSObject = this;

	this._acceptDeferred = Zotero.Promise.defer();
	this.promise = this._acceptDeferred.promise;
}

Zotero.Integration.CitationEditInterface.prototype = {
	/**
	 * Execute a callback with a preview of the given citation
	 * @return {Promise} A promise resolved with the previewed citation string
	 */
	preview: function() {
		return this.previewFn(this.citation);
	},
	
	/**
	 * Sort the citationItems within citation (depends on this.citation.properties.unsorted)
	 * @return {Promise} A promise resolved with the previewed citation string
	 */
	sort: function() {
		return this.preview();
	},
	
	/**
	 * Accept changes to the citation
	 * @param {Function} [progressCallback] A callback to be run when progress has changed.
	 *     Receives a number from 0 to 100 indicating current status.
	 */
	accept: function(progressCallback) {
		if (!this._acceptDeferred.promise.isFulfilled()) {
			this._acceptDeferred.resolve(progressCallback);
		}
	},
	
	/**
	 * Get a list of items used in the current document
	 * @return {Promise} A promise resolved by the items
	 */
	getItems: Zotero.Promise.coroutine(function* () {
		var citationsByItemID = yield this._citationsByItemIDPromise;
		var ids = Object.keys(citationsByItemID).filter(itemID => {
			return citationsByItemID[itemID]
				&& citationsByItemID[itemID].length
				// Exclude the present item
				&& (citationsByItemID[itemID].length > 1
					|| citationsByItemID[itemID][0].properties.zoteroIndex !== this._fieldIndex);
		});
		
		// Sort all previously cited items at top, and all items cited later at bottom
		var fieldIndex = yield this._fieldIndexPromise;
		ids.sort(function(a, b) {
			var indexA = citationsByItemID[a][0].properties.zoteroIndex,
				indexB = citationsByItemID[b][0].properties.zoteroIndex;
			
			if(indexA >= fieldIndex){
				if(indexB < fieldIndex) return 1;
				return indexA - indexB;
			}
			
			if(indexB > fieldIndex) return -1;
			return indexB - indexA;
		});
		
		return Zotero.Cite.getItem(ids);	
	}),
}

/**
 * Keeps track of all session-specific variables
 */
Zotero.Integration.Session = function(doc) {
	// holds items not in document that should be in bibliography
	this.uncitedItems = {};
	this.omittedItems = {};
	this.embeddedItems = {};
	this.embeddedZoteroItems = {};
	this.embeddedZoteroItemsByURI = {};
	this.customBibliographyText = {};
	this.reselectedItems = {};
	this.resetRequest(doc);
}

/**
 * Resets per-request variables in the CitationSet
 */
Zotero.Integration.Session.prototype.resetRequest = function(doc) {
	this.uriMap = new Zotero.Integration.URIMap(this);
	
	this.regenerateAll = false;
	this.bibliographyHasChanged = false;
	this.bibliographyDataHasChanged = false;
	this.updateItemIDs = {};
	this.updateIndices = {};
	this.newIndices = {};
	
	this.oldCitationIDs = this.citeprocCitationIDs;
	
	this.citationsByItemID = {};
	this.citationsByIndex = [];
	this.documentCitationIDs = {};
	this.citeprocCitationIDs = {};
	this.citationText = {};
	
	this.doc = doc;
}

/**
 * Changes the Session style and data
 * @param data {Zotero.Integration.DocumentData}
 * @param resetStyle {Boolean} Whether to force the style to be reset
 *     regardless of whether it has changed. This is desirable if the
 *     automaticJournalAbbreviations or locale has changed.
 */
Zotero.Integration.Session.prototype.setData = Zotero.Promise.coroutine(function *(data, resetStyle) {
	var oldStyle = (this.data && this.data.style ? this.data.style : false);
	this.data = data;
	if (data.style.styleID && (!oldStyle || oldStyle.styleID != data.style.styleID || resetStyle)) {
		this.styleID = data.style.styleID;
		try {
			yield Zotero.Styles.init();
			var getStyle = Zotero.Styles.get(data.style.styleID);
			data.style.hasBibliography = getStyle.hasBibliography;
			this.style = getStyle.getCiteProc(data.style.locale, data.prefs.automaticJournalAbbreviations);
			this.style.setOutputFormat("rtf");
			this.styleClass = getStyle.class;
			this.dateModified = new Object();
		} catch (e) {
			Zotero.logError(e);
			throw new Zotero.Exception.Alert("integration.error.invalidStyle");
		}
		
		return true;
	} else if (oldStyle) {
		data.style = oldStyle;
	}
	return false;
});

/**
 * Displays a dialog to set document preferences
 * @return {Promise} A promise resolved with old document data, if there was any or null,
 *    if there wasn't, or rejected with Zotero.Exception.UserCancelled if the dialog was
 *    cancelled.
 */
Zotero.Integration.Session.prototype.setDocPrefs = Zotero.Promise.coroutine(function* (doc, primaryFieldType, secondaryFieldType) {
	var io = new function() {
		this.wrappedJSObject = this;
	};
	
	if (this.data) {
		io.style = this.data.style.styleID;
		io.locale = this.data.style.locale;
		io.useEndnotes = this.data.prefs.noteType == 0 ? 0 : this.data.prefs.noteType-1;
		io.fieldType = this.data.prefs.fieldType;
		io.primaryFieldType = primaryFieldType;
		io.secondaryFieldType = secondaryFieldType;
		io.automaticJournalAbbreviations = this.data.prefs.automaticJournalAbbreviations;
		io.requireStoreReferences = !Zotero.Utilities.isEmpty(this.embeddedItems);
	}
	
	// Make sure styles are initialized for new docs
	yield Zotero.Styles.init();
	yield Zotero.Integration.displayDialog(doc,
		'chrome://zotero/content/integration/integrationDocPrefs.xul', '', io);
	
	if (!io.style || !io.fieldType) {
		throw new Zotero.Exception.UserCancelled("document preferences window");
	}
	
	// set data
	var oldData = this.data;
	var data = new Zotero.Integration.DocumentData();
	data.sessionID = oldData.sessionID;
	data.style.styleID = io.style;
	data.style.locale = io.locale;
	data.prefs.fieldType = io.fieldType;
	data.prefs.automaticJournalAbbreviations = io.automaticJournalAbbreviations;
	
	var forceStyleReset = oldData
		&& (
			oldData.prefs.automaticJournalAbbreviations != data.prefs.automaticJournalAbbreviations
			|| oldData.style.locale != io.locale
		);
	yield this.setData(data, forceStyleReset);

	// need to do this after setting the data so that we know if it's a note style
	this.data.prefs.noteType = this.style && this.styleClass == "note" ? io.useEndnotes+1 : 0;
	
	if (!oldData || oldData.style.styleID != data.style.styleID
			|| oldData.prefs.noteType != data.prefs.noteType
			|| oldData.prefs.fieldType != data.prefs.fieldType
			|| oldData.prefs.automaticJournalAbbreviations != data.prefs.automaticJournalAbbreviations) {
		// This will cause us to regenerate all citations
		this.oldCitationIDs = {};
	}
	
	return oldData || null;
})

/**
 * Reselects an item to replace a deleted item
 * @param exception {Zotero.Integration.MissingItemException}
 */
Zotero.Integration.Session.prototype.reselectItem = function(doc, exception) {
	var io = new function() { this.wrappedJSObject = this; },
		me = this;
	io.addBorder = Zotero.isWin;
	io.singleSelection = true;
	
	return Zotero.Integration.displayDialog(doc, 'chrome://zotero/content/selectItemsDialog.xul',
	'resizable', io).then(function() {
		if(io.dataOut && io.dataOut.length) {
			var itemID = io.dataOut[0];
			
			// add reselected item IDs to hash, so they can be used
			for (let reselectKey of exception.reselectKeys) {
				me.reselectedItems[reselectKey] = itemID;
			}
			// add old URIs to map, so that they will be included
			if(exception.reselectKeyType == RESELECT_KEY_URI) {
				me.uriMap.add(itemID, exception.reselectKeys.concat(me.uriMap.getURIsForItemID(itemID)));
			}
			// flag for update
			me.updateItemIDs[itemID] = true;
		}
	});
}

/**
 * Generates a field from a citation object
 */
Zotero.Integration.Session.prototype.getCitationField = function(citation) {
	const saveProperties = ["custom", "unsorted", "formattedCitation", "plainCitation", "dontUpdate"];
	const saveCitationItemKeys = ["locator", "label", "suppress-author", "author-only", "prefix",
		"suffix"];
	
	var type;
	var field = [];
	
	field.push('"citationID":'+uneval(citation.citationID));
	
	var properties = JSON.stringify(citation.properties, saveProperties);
	if(properties != "{}") {
		field.push('"properties":'+properties);
	}
	
	var m = citation.citationItems.length;
	var citationItems = new Array(m);
	for(var j=0; j<m; j++) {
		var citationItem = citation.citationItems[j],
			serializeCitationItem = {},
			key, value;
		
		// add URI and itemData
		var slashIndex;
		if(typeof citationItem.id === "string" && (slashIndex = citationItem.id.indexOf("/")) !== -1) {
			// this is an embedded item
			serializeCitationItem.id = citationItem.itemData.id;
			serializeCitationItem.uris = citationItem.uris;
			
			// XXX For compatibility with older versions of Zotero; to be removed at a later date
			serializeCitationItem.uri = serializeCitationItem.uris;
			
			// always store itemData, since we have no way to get it back otherwise
			serializeCitationItem.itemData = citationItem.itemData;
		} else {
			serializeCitationItem.id = citationItem.id;
			serializeCitationItem.uris = this.uriMap.getURIsForItemID(citationItem.id);
			
			// XXX For compatibility with older versions of Zotero; to be removed at a later date
			serializeCitationItem.uri = serializeCitationItem.uris;
		
			serializeCitationItem.itemData = this.style.sys.retrieveItem(citationItem.id);
		}
		
		// copy saveCitationItemKeys
		for(var i=0, n=saveCitationItemKeys.length; i<n; i++) {
			if((value = citationItem[(key = saveCitationItemKeys[i])])) {
				serializeCitationItem[key] = value;
			}
		}
		
		citationItems[j] = JSON.stringify(serializeCitationItem);
	}
	field.push('"citationItems":['+citationItems.join(",")+"]");
	field.push('"schema":"https://github.com/citation-style-language/schema/raw/master/csl-citation.json"');
	
	return "{"+field.join(",")+"}";
}

/**
 * Adds a citation based on a serialized Word field
 */
Zotero.Integration._oldCitationLocatorMap = {
	p:"page",
	g:"paragraph",
	l:"line"
};

/**
 * Adds a citation to the arrays representing the document
 */
Zotero.Integration.Session.prototype.addCitation = Zotero.Promise.coroutine(function* (index, noteIndex, citation) {
	var index = parseInt(index, 10);
	
	// get items
	yield this.lookupItems(citation, index);
	
	citation.properties.added = true;
	citation.properties.zoteroIndex = index;
	citation.properties.noteIndex = noteIndex;
	this.citationsByIndex[index] = citation;
	
	// add to citationsByItemID and citationsByIndex
	for(var i=0; i<citation.citationItems.length; i++) {
		var citationItem = citation.citationItems[i];
		if(!this.citationsByItemID[citationItem.id]) {
			this.citationsByItemID[citationItem.id] = [citation];
			this.bibliographyHasChanged = true;
		} else {
			var byItemID = this.citationsByItemID[citationItem.id];
			if(byItemID[byItemID.length-1].properties.zoteroIndex < index) {
				// if index is greater than the last index, add to end
				byItemID.push(citation);
			} else {
				// otherwise, splice in at appropriate location
				for(var j=0; byItemID[j].properties.zoteroIndex < index && j<byItemID.length-1; j++) {}
				byItemID.splice(j++, 0, citation);
			}
		}
	}
	
	// We need a new ID if there's another citation with the same citation ID in this document
	var needNewID = !citation.citationID || this.documentCitationIDs[citation.citationID];
	if(needNewID || !this.oldCitationIDs[citation.citationID]) {
		if(needNewID) {
			Zotero.debug("Integration: "+citation.citationID+" ("+index+") needs new citationID");
			citation.citationID = Zotero.randomString();
		}
		this.newIndices[index] = true;
		this.updateIndices[index] = true;
	}
	Zotero.debug("Integration: Adding citationID "+citation.citationID);
	this.documentCitationIDs[citation.citationID] = citation.citationID;
});

/**
 * Looks up item IDs to correspond with keys or generates embedded items for given citation object.
 * Throws a MissingItemException if item was not found.
 */
Zotero.Integration.Session.prototype.lookupItems = Zotero.Promise.coroutine(function* (citation, index) {
	let items = [];
	
	for(var i=0, n=citation.citationItems.length; i<n; i++) {
		var citationItem = citation.citationItems[i];
		
		// get Zotero item
		var zoteroItem = false,
		    needUpdate;
		if(citationItem.uris) {
			[zoteroItem, needUpdate] = yield this.uriMap.getZoteroItemForURIs(citationItem.uris);
			if(needUpdate && index) this.updateIndices[index] = true;
			
			// Unfortunately, people do weird things with their documents. One weird thing people
			// apparently like to do (http://forums.zotero.org/discussion/22262/) is to copy and
			// paste citations from other documents created with earlier versions of Zotero into
			// their documents and then not refresh the document. Usually, this isn't a problem. If
			// document is edited by the same user, it will work without incident. If the first
			// citation of a given item doesn't contain itemData, the user will get a
			// MissingItemException. However, it may also happen that the first citation contains
			// itemData, but later citations don't, because the user inserted the item properly and
			// then copied and pasted the same citation from another document. We check for that
			// possibility here.
			if(zoteroItem.cslItemData && !citationItem.itemData) {
				citationItem.itemData = zoteroItem.cslItemData;
				this.updateIndices[index] = true;
			}
		} else {
			if(citationItem.key && citationItem.libraryID) {
				// DEBUG: why no library id?
				zoteroItem = Zotero.Items.getByLibraryAndKey(citationItem.libraryID, citationItem.key);
			} else if(citationItem.itemID) {
				zoteroItem = Zotero.Items.get(citationItem.itemID);
			} else if(citationItem.id) {
				zoteroItem = Zotero.Items.get(citationItem.id);
			}
			if(zoteroItem && index) this.updateIndices[index] = true;
		}
		
		// if no item, check if it was already reselected and otherwise handle as a missing item
		if(!zoteroItem) {	
			if(citationItem.uris) {
				var reselectKeys = citationItem.uris;
				var reselectKeyType = RESELECT_KEY_URI;
			} else if(citationItem.key) {
				var reselectKeys = [citationItem.key];
				var reselectKeyType = RESELECT_KEY_ITEM_KEY;
			} else if(citationItem.id) {
				var reselectKeys = [citationItem.id];
				var reselectKeyType = RESELECT_KEY_ITEM_ID;
			} else {
				var reselectKeys = [citationItem.itemID];
				var reselectKeyType = RESELECT_KEY_ITEM_ID;
			}
			
			// look to see if item has already been reselected
			for (let reselectKey of reselectKeys) {
				if(this.reselectedItems[reselectKey]) {
					zoteroItem = Zotero.Items.get(this.reselectedItems[reselectKey]);
					citationItem.id = zoteroItem.id;
					if(index) this.updateIndices[index] = true;
					break;
				}
			}
			
			if(!zoteroItem) {
				if(citationItem.itemData) {
					// add new embedded item
					var itemData = Zotero.Utilities.deepCopy(citationItem.itemData);
					
					// assign a random string as an item ID
					var anonymousID = Zotero.randomString();
					var globalID = itemData.id = citationItem.id = this.data.sessionID+"/"+anonymousID;
					this.embeddedItems[anonymousID] = itemData;
					
					// assign a Zotero item
					var surrogateItem = this.embeddedZoteroItems[anonymousID] = new Zotero.Item();
					Zotero.Utilities.itemFromCSLJSON(surrogateItem, itemData);
					surrogateItem.cslItemID = globalID;
					surrogateItem.cslURIs = citationItem.uris;
					surrogateItem.cslItemData = itemData;
					
					for(var j=0, m=citationItem.uris.length; j<m; j++) {
						this.embeddedZoteroItemsByURI[citationItem.uris[j]] = surrogateItem;
					}
				} else {
					// if not already reselected, throw a MissingItemException
					throw(new Zotero.Integration.MissingItemException(
						reselectKeys, reselectKeyType, i, citation.citationItems.length));
				}
			}
		}
		
		if(zoteroItem) {
			if (zoteroItem.cslItemID) {
				citationItem.id = zoteroItem.cslItemID;
			}
			else {
				citationItem.id = zoteroItem.id;
				items.push(zoteroItem);
			}
		}
	}
	
	// Items may be in libraries that haven't been loaded, and retrieveItem() is synchronous, so load
	// all data (as required by toJSON(), which is used by itemToExportFormat(), which is used by
	// itemToCSLJSON()) now
	if (items.length) {
		yield Zotero.Items.loadDataTypes(items);
	}
});

/**
 * Gets integration bibliography
 */
Zotero.Integration.Session.prototype.getBibliography = function() {
	this.updateUncitedItems();
	
	if(Zotero.Utilities.isEmpty(this.citationsByItemID)) return false;
	
	// generate bibliography
	var bib = this.style.makeBibliography();
	
	if(bib) {
		// omit items
		Zotero.Cite.removeFromBibliography(bib, this.omittedItems);	
		
		// replace items with their custom counterpars
		for(var i in bib[0].entry_ids) {
			if(this.customBibliographyText[bib[0].entry_ids[i]]) {
				bib[1][i] = this.customBibliographyText[bib[0].entry_ids[i]];
			}
		}
	}
	
	return bib;
}

/**
 * Calls CSL.Engine.updateUncitedItems() to reconcile list of uncited items
 */
Zotero.Integration.Session.prototype.updateUncitedItems = function() {
	// There appears to be a bug somewhere here.
	if(Zotero.Debug.enabled) Zotero.debug("Integration: style.updateUncitedItems("+this.uncitedItems.toSource()+")");
	this.style.updateUncitedItems(Object.keys(this.uncitedItems).map(i => parseInt(i)));
}

/**
 * Refreshes updateIndices variable to include fields for modified items
 */
Zotero.Integration.Session.prototype.updateUpdateIndices = function(regenerateAll) {
	if(regenerateAll || this.regenerateAll) {
		// update all indices
		for(var i in this.citationsByIndex) {
			this.newIndices[i] = true;
			this.updateIndices[i] = true;
		}
	} else {
		// update only item IDs
		for(var i in this.updateItemIDs) {
			if(this.citationsByItemID[i] && this.citationsByItemID[i].length) {
				for(var j=0; j<this.citationsByItemID[i].length; j++) {
					this.updateIndices[this.citationsByItemID[i][j].properties.zoteroIndex] = true;
				}
			}
		}
	}
}

/**
 * Returns citations before and after a given index
 */
Zotero.Integration.Session.prototype._getPrePost = function(index) {
	var citationIndices = [];
	var citationsPre = [];
	for(var i=0; i<index; i++) {
		if(this.citationsByIndex[i] && !this.newIndices[i] && !this.citationsByIndex[i].properties.delete) {
			citationsPre.push([this.citationsByIndex[i].citationID, this.citationsByIndex[i].properties.noteIndex]);
			citationIndices.push(i);
		}
	}
	citationIndices.push(index);
	var citationsPost = [];
	for(var i=index+1; i<this.citationsByIndex.length; i++) {
		if(this.citationsByIndex[i] && !this.newIndices[i] && !this.citationsByIndex[i].properties.delete) {
			citationsPost.push([this.citationsByIndex[i].citationID, this.citationsByIndex[i].properties.noteIndex]);
			citationIndices.push(i);
		}
	}
	return [citationsPre, citationsPost, citationIndices];
}

/**
 * Returns a formatted citation
 */
Zotero.Integration.Session.prototype.formatCitation = function(index, citation) {
	if(!this.citationText[index]) {
		var citationsPre, citationsPost, citationIndices;
		[citationsPre, citationsPost, citationIndices] = this._getPrePost(index);
		if(Zotero.Debug.enabled) {
			Zotero.debug("Integration: style.processCitationCluster("+citation.toSource()+", "+citationsPre.toSource()+", "+citationsPost.toSource());
		}
		var newCitations = this.style.processCitationCluster(citation, citationsPre, citationsPost);
		for (let newCitation of newCitations[1]) {
			this.citationText[citationIndices[newCitation[0]]] = newCitation[1];
			this.updateIndices[citationIndices[newCitation[0]]] = true;
		}
		return newCitations.bibchange;
	}
}

/**
 * Updates the list of citations to be serialized to the document
 */
Zotero.Integration.Session.prototype._updateCitations = function* () {
	/*var allUpdatesForced = false;
	var forcedUpdates = {};
	if(force) {
		allUpdatesForced = true;
		// make sure at least one citation gets updated
		updateLoop: for (let indexList of [this.newIndices, this.updateIndices]) {
			for(var i in indexList) {
				if(!this.citationsByIndex[i].properties.delete) {
					allUpdatesForced = false;
					break updateLoop;
				}
			}
		}
		
		if(allUpdatesForced) {
			for(i in this.citationsByIndex) {
				if(this.citationsByIndex[i] && !this.citationsByIndex[i].properties.delete) {
					forcedUpdates[i] = true;
					break;
				}
			}
		}
	}*/
	
	if(Zotero.Debug.enabled) {
		Zotero.debug("Integration: Indices of new citations");
		Zotero.debug(Object.keys(this.newIndices));
		Zotero.debug("Integration: Indices of updated citations");
		Zotero.debug(Object.keys(this.updateIndices));
	}
	
	
	for (let indexList of [this.newIndices, this.updateIndices]) {
		for(var index in indexList) {
			index = parseInt(index);
			
			var citation = this.citationsByIndex[index];
			if(!citation || citation.properties.delete) continue;
			if(this.formatCitation(index, citation)) {
				this.bibliographyHasChanged = true;
			}
			this.citeprocCitationIDs[citation.citationID] = true;
			delete this.newIndices[index];
			yield;
		}
	}
	
	/*if(allUpdatesForced) {
		this.newIndices = {};
		this.updateIndices = {};
	}*/
}

/**
 * Restores processor state from document, without requesting citation updates
 */
Zotero.Integration.Session.prototype.restoreProcessorState = function() {
	var citations = [];
	for(var i in this.citationsByIndex) {
		if(this.citationsByIndex[i] && !this.newIndices[i] && !this.citationsByIndex[i].properties.delete) {
			citations.push(this.citationsByIndex[i]);
		}
	}
	this.style.restoreProcessorState(citations);
}

/**
 * Loads document data from a JSON object
 */
Zotero.Integration.Session.prototype.loadBibliographyData = Zotero.Promise.coroutine(function* (json) {
	var openBraceIndex = json.indexOf("{");
	if(openBraceIndex == -1) return;
	
	try {
		var documentData = JSON.parse(json.substring(openBraceIndex, json.lastIndexOf("}")+1));
	} catch(e) {
		try {
			var documentData = JSON.parse(json.substr(0, json.length-1));
		} catch(e) {
			throw new Zotero.Integration.CorruptFieldException(json);
		}
	}
	
	var needUpdate;
	
	// set uncited
	if(documentData.uncited) {
		if(documentData.uncited[0]) {
			// new style array of arrays with URIs
			let zoteroItem, needUpdate;
			for (let uris of documentData.uncited) {
				[zoteroItem, needUpdate] = yield this.uriMap.getZoteroItemForURIs(uris);
				var id = zoteroItem.cslItemID ? zoteroItem.cslItemID : zoteroItem.id;
				if(zoteroItem && !this.citationsByItemID[id]) {
					this.uncitedItems[id] = true;
				} else {
					needUpdate = true;
				}
				this.bibliographyDataHasChanged |= needUpdate;
			}
		} else {
			for(var itemID in documentData.uncited) {
				// if not yet in item set, add to item set
				// DEBUG: why no libraryID?
				var zoteroItem = Zotero.Items.getByLibraryAndKey(0, itemID);
				if(!zoteroItem) zoteroItem = Zotero.Items.get(itemID);
				if(zoteroItem) this.uncitedItems[zoteroItem.id] = true;
			}
			this.bibliographyDataHasChanged = true;
		}
		
		this.updateUncitedItems();
	}
	
	// set custom bibliography entries
	if(documentData.custom) {
		if(documentData.custom[0]) {
			// new style array of arrays with URIs
			var zoteroItem, needUpdate;
			for (let custom of documentData.custom) {
				[zoteroItem, needUpdate] = yield this.uriMap.getZoteroItemForURIs(custom[0]);
				if(!zoteroItem) continue;
				if(needUpdate) this.bibliographyDataHasChanged = true;
				
				var id = zoteroItem.cslItemID ? zoteroItem.cslItemID : zoteroItem.id;
				if(this.citationsByItemID[id] || this.uncitedItems[id]) {
					this.customBibliographyText[id] = custom[1];
				}
			}
		} else {
			// old style hash
			for(var itemID in documentData.custom) {
				// DEBUG: why no libraryID?
				var zoteroItem = Zotero.Items.getByLibraryAndKey(0, itemID);
				if(!zoteroItem) zoteroItem = Zotero.Items.get(itemID);
				if(!zoteroItem) continue;
				
				if(this.citationsByItemID[zoteroItem.id] || this.uncitedItems[zoteroItem.id]) {
					this.customBibliographyText[zoteroItem.id] = documentData.custom[itemID];
				}
			}
			this.bibliographyDataHasChanged = true;
		}
	}
	
	// set entries to be omitted from bibliography
	if(documentData.omitted) {
			let zoteroItem, needUpdate;
			for (let uris of documentData.omitted) {
				[zoteroItem, update] = yield this.uriMap.getZoteroItemForURIs(uris);
				var id = zoteroItem.cslItemID ? zoteroItem.cslItemID : zoteroItem.id;
				if(zoteroItem && this.citationsByItemID[id]) {
					this.omittedItems[id] = true;
				} else {
					needUpdate = true;
				}
				this.bibliographyDataHasChanged |= needUpdate;
			}
	}
	
	this.bibliographyData = json;
});

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
	for(var item in this.omittedItems) {
		if(item) {
			if(!bibliographyData.omitted) bibliographyData.omitted = [];
			bibliographyData.omitted.push(this.uriMap.getURIsForItemID(item));
		}
	}
	
	// look for custom bibliography entries
	bibliographyData.custom = Object.keys(this.customBibliographyText)
		.map(id => [this.uriMap.getURIsForItemID(id), this.customBibliographyText[id]]);
	
	
	if(bibliographyData.uncited || bibliographyData.custom) {
		return JSON.stringify(bibliographyData);
	} else {
		return ""; 	// nothing
	}
}

/**
 * Edits integration bibliography
 */
Zotero.Integration.Session.prototype.editBibliography = function(doc) {
	var bibliographyEditor = new Zotero.Integration.Session.BibliographyEditInterface(this);
	var io = new function() { this.wrappedJSObject = bibliographyEditor; }
	
	this.bibliographyDataHasChanged = this.bibliographyHasChanged = true;
	
	return Zotero.Integration.displayDialog(doc,
	'chrome://zotero/content/integration/editBibliographyDialog.xul', 'resizable', io);
}

/**
 * @class Interface for bibliography editor to alter document bibliography
 * @constructor
 * Creates a new bibliography editor interface
 * @param session {Zotero.Integration.Session}
 */
Zotero.Integration.Session.BibliographyEditInterface = function(session) {
	this.session = session;
	
	this._changed = {
		"customBibliographyText":{},
		"uncitedItems":{},
		"omittedItems":{}
	}
	for(var list in this._changed) {
		for(var key in this.session[list]) {
			this._changed[list][key] = this.session[list][key];
		}
	}
	
	this._update();
}

/**
 * Updates stored bibliography
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype._update = function() {
	this.session.updateUncitedItems();
	this.session.style.setOutputFormat("rtf");
	this.bibliography = this.session.style.makeBibliography();
	Zotero.Cite.removeFromBibliography(this.bibliography, this.session.omittedItems);
	
	for(var i in this.bibliography[0].entry_ids) {
		if(this.bibliography[0].entry_ids[i].length != 1) continue;
		var itemID = this.bibliography[0].entry_ids[i][0];
		if(this.session.customBibliographyText[itemID]) {
			this.bibliography[1][i] = this.session.customBibliographyText[itemID];
		}
	}
}

/**
 * Reverts the text of an individual bibliography entry
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.revert = function(itemID) {
	delete this.session.customBibliographyText[itemID];
	this._update();
}

/**
 * Reverts bibliography to condition in which no edits have been made
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.revertAll = function() {
	for(var list in this._changed) {
		this.session[list] = {};
	}
	this._update();
}

/**
 * Reverts bibliography to condition before BibliographyEditInterface was opened
 * Does not run _update automatically, since this will usually only happen with a cancel request
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.cancel = function() {
	for(var list in this._changed) {
		this.session[list] = this._changed[list];
	}
	this.session.updateUncitedItems();
}

/**
 * Checks whether a given reference is cited within the main document text
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.isCited = function(item) {
	if(this.session.citationsByItemID[item]) return true;
}

/**
 * Checks whether an item ID is cited in the bibliography being edited
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.isEdited = function(itemID) {
	if(this.session.customBibliographyText[itemID]) return true;
	return false;
}

/**
 * Checks whether any citations in the bibliography have been edited
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.isAnyEdited = function() {
	for(var list in this._changed) {
		for(var a in this.session[list]) {
			return true;
		}
	}
	return false;
}

/**
 * Adds an item to the bibliography
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.add = function(itemID) {
	if(this.session.omittedItems[itemID]) {
		delete this.session.omittedItems[itemID];
	} else {
		this.session.uncitedItems[itemID] = true;
	}
	this._update();
}

/**
 * Removes an item from the bibliography being edited
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.remove = function(itemID) {
	if(this.session.uncitedItems[itemID]) {
		delete this.session.uncitedItems[itemID];
	} else {
		this.session.omittedItems[itemID] = true;
	}
	this._update();
}

/**
 * Sets custom bibliography text for a given item
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.setCustomText = function(itemID, text) {
	this.session.customBibliographyText[itemID] = text;
	this._update();
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
 * Serializes document-specific data as JSON
 */
Zotero.Integration.DocumentData.prototype.serialize = function() {
	// If we've retrieved data with version 4 (JSON), serialize back to JSON
	if (this.dataVersion == 4) {
		// Filter style properties
		let style = {};
		for (let prop of ['styleID', 'locale', 'hasBibliography', 'bibliographyStyleHasBeenSet']) {
			style[prop] = this.style[prop];
		}
		return JSON.stringify({
			style,
			prefs: this.prefs,
			sessionID: this.sessionID,
			zoteroVersion: Zotero.version,
			dataVersion: 4
		});
	}
	// Otherwise default to XML for now
	var prefs = "";
	for(var pref in this.prefs) {
		prefs += `<pref name="${Zotero.Utilities.htmlSpecialChars(pref)}" `+
			`value="${Zotero.Utilities.htmlSpecialChars(this.prefs[pref].toString())}"/>`;
	}
	
	return '<data data-version="'+Zotero.Utilities.htmlSpecialChars(`${DATA_VERSION}`)+'" '+
		'zotero-version="'+Zotero.Utilities.htmlSpecialChars(Zotero.version)+'">'+
			'<session id="'+Zotero.Utilities.htmlSpecialChars(this.sessionID)+'"/>'+
		'<style id="'+Zotero.Utilities.htmlSpecialChars(this.style.styleID)+'" '+
			(this.style.locale ? 'locale="' + Zotero.Utilities.htmlSpecialChars(this.style.locale) + '" ': '') +
			'hasBibliography="'+(this.style.hasBibliography ? "1" : "0")+'" '+
			'bibliographyStyleHasBeenSet="'+(this.style.bibliographyStyleHasBeenSet ? "1" : "0")+'"/>'+
		(prefs ? '<prefs>'+prefs+'</prefs>' : '<prefs/>')+'</data>';
};

/**
 * Unserializes document-specific XML
 */
Zotero.Integration.DocumentData.prototype.unserializeXML = function(xmlData) {
	var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
			.createInstance(Components.interfaces.nsIDOMParser),
		doc = parser.parseFromString(xmlData, "application/xml");
	
	this.sessionID = Zotero.Utilities.xpathText(doc, '/data/session[1]/@id');
	this.style = {"styleID":Zotero.Utilities.xpathText(doc, '/data/style[1]/@id'),
		"locale":Zotero.Utilities.xpathText(doc, '/data/style[1]/@locale'),
		"hasBibliography":(Zotero.Utilities.xpathText(doc, '/data/style[1]/@hasBibliography') == 1),
		"bibliographyStyleHasBeenSet":(Zotero.Utilities.xpathText(doc, '/data/style[1]/@bibliographyStyleHasBeenSet') == 1)};
	this.prefs = {};
	for (let pref of Zotero.Utilities.xpath(doc, '/data/prefs[1]/pref')) {
		var name = pref.getAttribute("name");
		var value = pref.getAttribute("value");
		if(value === "true") {
			value = true;
		} else if(value === "false") {
			value = false;
		}
		
		this.prefs[name] = value;
	}
	
	this.prefs.noteType = parseInt(this.prefs.noteType) || 0;
	if (this.prefs["automaticJournalAbbreviations"] === undefined) this.prefs["automaticJournalAbbreviations"] = false;
	this.zoteroVersion = doc.documentElement.getAttribute("zotero-version");
	if (!this.zoteroVersion) this.zoteroVersion = "2.0";
	this.dataVersion = doc.documentElement.getAttribute("data-version");
	if (!this.dataVersion) this.dataVersion = 2;
};

/**
 * Unserializes document-specific data, either as XML or as the string form used previously
 */
Zotero.Integration.DocumentData.prototype.unserialize = function(input) {
	try {
		return Object.assign(this, JSON.parse(input))
	} catch (e) {
		if (!(e instanceof SyntaxError)) {
			throw e;
		}
	}
	if (input[0] == "<") {
		this.unserializeXML(input);
	} else {
		const splitRe = /(^|[^:]):(?!:)/;
		
		var splitOutput = input.split(splitRe);
		var prefParameters = [];
		for(var i=0; i<splitOutput.length; i+=2) {
			prefParameters.push((splitOutput[i]+(splitOutput[i+1] ? splitOutput[i+1] : "")).replace("::", ":", "g"));
		}
		
		this.sessionID = prefParameters[0];
		this.style = {"styleID":prefParameters[1], 
			"hasBibliography":(prefParameters[3] == "1" || prefParameters[3] == "True"),
			"bibliographyStyleHasBeenSet":false};
		this.prefs = {"fieldType":((prefParameters[5] == "1" || prefParameters[5] == "True") ? "Bookmark" : "Field")};
		if(prefParameters[2] == "note") {
			if(prefParameters[4] == "1" || prefParameters[4] == "True") {
				this.prefs.noteType = NOTE_ENDNOTE;
			} else {
				this.prefs.noteType = NOTE_FOOTNOTE;
			}
		} else {
			this.prefs.noteType = 0;
		}
		
		this.zoteroVersion = "2.0b6 or earlier";
		this.dataVersion = 1;
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
	if(typeof id === "string" && id.indexOf("/") !== -1) {
		return Zotero.Cite.getItem(id).cslURIs;
	}
	
	if(!this.itemIDURIs[id]) {
		this.itemIDURIs[id] = [Zotero.URI.getItemURI(Zotero.Items.get(id))];
	}
	
	return this.itemIDURIs[id];
}

/**
 * Gets Zotero item for a given set of URIs
 */
Zotero.Integration.URIMap.prototype.getZoteroItemForURIs = Zotero.Promise.coroutine(function* (uris) {
	var zoteroItem = false;
	var needUpdate = false;
	var embeddedItem = false;;
	
	for(var i=0, n=uris.length; i<n; i++) {
		var uri = uris[i];
		
		// First try embedded URI
		if(this.session.embeddedZoteroItemsByURI[uri]) {
			embeddedItem = this.session.embeddedZoteroItemsByURI[uri];
		}
		
		// Next try getting URI directly
		try {
			zoteroItem = yield Zotero.URI.getURIItem(uri);
			if(zoteroItem) {
				// Ignore items in the trash
				if(zoteroItem.deleted) {
					zoteroItem = false;
				} else {
					break;
				}
			}
		} catch(e) {}
		
		// Try merged item mapping
		var replacer = Zotero.Relations.getByPredicateAndObject(
			'item', Zotero.Relations.replacedItemPredicate, uri
		);
		if (replacer.length && !replacer[0].deleted) {
			zoteroItem = replacer[0];
		}
		
		if(zoteroItem) break;
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
	} else if(embeddedItem) {
		return [embeddedItem, false];
	}
	
	return [zoteroItem, needUpdate];
});

Zotero.Integration.Field = class {
	constructor(field) {
		// This is not the best solution in terms of performance
		for (let prop in field) {
			if (!(prop in this)) this[prop] = field[prop];
		}
		this.dirty = false;
		this._field = field;
		this.type = INTEGRATION_TYPE_TEMP;	
	}
	
	get text() {return this._text = this._text ? this._text : this.getText()}
	set text(v) {return this._text = v; this.dirty = true}

	get code() {return this._code = this._code ? this._code : this.getCode()}
	set code(v) {return this._code = v; this.dirty = true}
	
	clearCode() {
		this.code = '{}';
	};
	
	writeToDoc(doc) {
		let text = this._text;
		let isRich = false;
		// If RTF wrap with RTF tags
		if (text.indexOf("\\") !== -1) {
			text = "{\\rtf "+text+"}";
			isRich = true;
		}
		this._field.setText(text, isRich);

		// Boo. Inconsistent.
		if (this.type == INTEGRATION_TYPE_ITEM) {
			this._field.setCode(`ITEM CSL_CITATION ${JSON.stringify(this.code)}`);
		} else if (this.type == INTEGRATION_TYPE_BIBLIOGRAPHY) {
			this._field.setCode(`BIBL ${this.code} CSL_BIBLIOGRAPHY`);
		}
		this.dirty = false;

		// Retrigger retrieval from doc.
		this._text = null;
		this._code = null;
	};
	
	getCode() {
		let code = this._field.getCode();
		let start = code.indexOf('{');
		if (start == -1) {
			return '{}';
		}
		return code.substr(start, start + code.indexOf('}'));
	};
};

/**
 * Load existing field in document and return correct instance of field type
 * @param docField
 * @param rawCode
 * @param idx
 * @returns {Zotero.Integration.Field|Zotero.Integration.CitationField|Zotero.Integration.BibliographyField}
 */
Zotero.Integration.Field.loadExisting = function(docField) {
	var field;
	let rawCode = docField.getCode();
	
	// ITEM/CITATION CSL_ITEM {json: 'data'} 
	for (let type of ["ITEM", "CITATION"]) {
		if (rawCode.substr(0, type.length) === type) {
			field = new Zotero.Integration.CitationField(docField);
		}
	}
	// BIBL {json: 'data'} CSL_BIBLIOGRAPHY
	if (rawCode.substr(0, 4) === "BIBL") {
		field = new Zotero.Integration.BibliographyField(docField);
	}
	if (field) {
		let start = rawCode.indexOf('{');
		if (start != -1) {
			field._code = rawCode.substr(start, start + rawCode.lastIndexOf('}'));
		} else {
			field._code = rawCode.substr(rawCode.indexOf(' ')+1);
		}
	}
	
	if (rawCode.substr(0, 4) === "TEMP") {
		field = new Zotero.Integration.Field(docField);
		field._code = rawCode.substr(5);
	}
	
	return field;
};

Zotero.Integration.CitationField = class extends Zotero.Integration.Field {
	constructor(field) {
		super(field);
		this.type = INTEGRATION_TYPE_ITEM;
	}
	
	/**
	 * Don't be fooled, this should be as simple as JSON.parse().
	 * The schema for the code is defined @ https://raw.githubusercontent.com/citation-style-language/schema/master/csl-citation.json
	 *
	 * However, over the years and different versions of Zotero there's been changes to the schema,
	 * incorrect serialization, etc. Therefore this function is cruft-full and we can't get rid of it.
	 *
	 * @returns {{citationItems: Object[], properties: Object}}
	 */
	unserialize() {
		function unserialize(code) {
			try {
				return JSON.parse(code);
			} catch(e) {
				// fix for corrupted fields (corrupted by 2.1b1)
				try {
					return JSON.parse(code.replace(/{{((?:\s*,?"unsorted":(?:true|false)|\s*,?"custom":"(?:(?:\\")?[^"]*\s*)*")*)}}/, "{$1}"));
				} catch(e) {
					throw new Zotero.Integration.CorruptFieldException(code, e);
				}
			}
		}
		
		function upgradeCruft(citation, code) {
			// fix for uppercase citation codes
			if(citation.CITATIONITEMS) {
				citation.citationItems = [];
				for (var i=0; i<citation.CITATIONITEMS.length; i++) {
					for (var j in citation.CITATIONITEMS[i]) {
						switch (j) {
							case 'ITEMID':
								var field = 'itemID';
								break;

							// 'position', 'custom'
							default:
								var field = j.toLowerCase();
						}
						if (!citation.citationItems[i]) {
							citation.citationItems[i] = {};
						}
						citation.citationItems[i][field] = citation.CITATIONITEMS[i][j];
					}
				}
			}

			if(!citation.properties) citation.properties = {};

			for (let citationItem of citation.citationItems) {
				// for upgrade from Zotero 2.0 or earlier
				if(citationItem.locatorType) {
					citationItem.label = citationItem.locatorType;
					delete citationItem.locatorType;
				} else if(citationItem.suppressAuthor) {
					citationItem["suppress-author"] = citationItem["suppressAuthor"];
					delete citationItem.suppressAuthor;
				}

				// fix for improper upgrade from Zotero 2.1 in <2.1.5
				if(parseInt(citationItem.label) == citationItem.label) {
					const locatorTypeTerms = ["page", "book", "chapter", "column", "figure", "folio",
						"issue", "line", "note", "opus", "paragraph", "part", "section", "sub verbo",
						"volume", "verse"];
					citationItem.label = locatorTypeTerms[parseInt(citationItem.label)];
				}

				// for update from Zotero 2.1 or earlier
				if(citationItem.uri) {
					citationItem.uris = citationItem.uri;
					delete citationItem.uri;
				}
			}

			// for upgrade from Zotero 2.0 or earlier
			if(citation.sort) {
				citation.properties.unsorted = !citation.sort;
				delete citation.sort;
			}
			if(citation.custom) {
				citation.properties.custom = citation.custom;
				delete citation.custom;
			}
			if(!citation.citationID) citation.citationID = Zotero.randomString();

			citation.properties.field = code;	
			return citation;
		}
		
		function unserializePreZotero1_0(code) {
			var underscoreIndex = code.indexOf("_");
			var itemIDs = code.substr(0, underscoreIndex).split("|");

			var lastIndex = code.lastIndexOf("_");
			if(lastIndex != underscoreIndex+1) {
				var locatorString = code.substr(underscoreIndex+1, lastIndex-underscoreIndex-1);
				var locators = locatorString.split("|");
			}

			var citationItems = new Array();
			for(var i=0; i<itemIDs.length; i++) {
				var citationItem = {id:itemIDs[i]};
				if(locators) {
					citationItem.locator = locators[i].substr(1);
					citationItem.label = Zotero.Integration._oldCitationLocatorMap[locators[i][0]];
				}
				citationItems.push(citationItem);
			}

			return {"citationItems":citationItems, properties:{}};
		}
		

		if (this.code[0] == '{') {		// JSON field
			return upgradeCruft(unserialize(this.code), this.code);
		} else {				// ye olde style field
			return unserializePreZotero1_0(this.code);
		}
	};
	
	clearCode() {
		this.code = JSON.stringify({citationItems: [], properties: {}});
		this.writeToDoc();
	}
};


Zotero.Integration.BibliographyField = class extends Zotero.Integration.Field {
	constructor(field) {
		super(field);
		this.type = INTEGRATION_TYPE_BIBLIOGRAPHY;
		this.type = INTEGRATION_TYPE_ITEM;
	};
	
	unserialize() {
		try {
			return JSON.parse(this.code);
		} catch(e) {
			throw new Zotero.Integration.CorruptFieldException(this.code, e);
		}
	}
};
