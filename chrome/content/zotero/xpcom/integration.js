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

// this is used only for update checking
const INTEGRATION_PLUGINS = ["zoteroMacWordIntegration@zotero.org",
	"zoteroOpenOfficeIntegration@zotero.org", "zoteroWinWordIntegration@zotero.org"];
const INTEGRATION_MIN_VERSIONS = ["3.1.2", "3.1b1", "3.1b1"];

Zotero.Integration = new function() {
	var _fifoFile = null;
	var _tmpFile = null;
	var _osascriptFile;
	var _inProgress = false;
	var _integrationVersionsOK = null;
	var _pipeMode = false;
	var _winUser32;
	
	// these need to be global because of GC
	var _timer;
	var _updateTimer;
	
	this.sessions = {};
	
	/**
	 * Initializes the pipe used for integration on non-Windows platforms.
	 */
	this.init = function() {
		// initialize SOAP server just to throw version errors
		Zotero.Integration.Compat.init();
		
		// Windows uses a command line handler for integration. See
		// components/zotero-integration-service.js for this implementation.
		if(Zotero.isWin) return;
	
		// Determine where to put the pipe
		if(Zotero.isMac) {
			// on OS X, first try /Users/Shared for those who can't put pipes in their home
			// directories
			_fifoFile = Components.classes["@mozilla.org/file/local;1"].
				createInstance(Components.interfaces.nsILocalFile);
			_fifoFile.initWithPath("/Users/Shared");
			
			if(_fifoFile.exists() && _fifoFile.isDirectory() && _fifoFile.isWritable()) {
				var logname = Components.classes["@mozilla.org/process/environment;1"].
					getService(Components.interfaces.nsIEnvironment).
					get("LOGNAME");
				_fifoFile.append(".zoteroIntegrationPipe_"+logname);
			} else {
				_fifoFile = null;
			}
		}
		
		if(!_fifoFile) {
			// on other platforms, or as a fallback, use home directory
			_fifoFile = Components.classes["@mozilla.org/file/directory_service;1"].
				getService(Components.interfaces.nsIProperties).
				get("Home", Components.interfaces.nsIFile);
			_fifoFile.append(".zoteroIntegrationPipe");
		}
		
		Zotero.debug("Initializing Zotero integration pipe at "+_fifoFile.path);
		
		// destroy old pipe, if one exists
		try {
			if(_fifoFile.exists()) {
				_fifoFile.remove(false);
			}
		} catch (e) {
			// if pipe can't be deleted, log an error
			Zotero.debug("Error removing old integration pipe", 1);
			Components.utils.reportError(
				"Zotero word processor integration initialization failed. "
					+ "See http://forums.zotero.org/discussion/12054/#Item_10 "
					+ "for instructions on correcting this problem."
			);
			if(Zotero.isMac) {
				// can attempt to delete on OS X
				try {
					var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
						.getService(Components.interfaces.nsIPromptService);
					var deletePipe = promptService.confirm(null, Zotero.getString("integration.error.title"), Zotero.getString("integration.error.deletePipe"));
					if(!deletePipe) return;
					let escapedFifoFile = _fifoFile.path.replace("'", "'\\''");
					_executeAppleScript("do shell script \"rmdir '"+escapedFifoFile+"'; rm -f '"+escapedFifoFile+"'\" with administrator privileges", true);
					if(_fifoFile.exists()) return;
				} catch(e) {
					Zotero.logError(e);
					return;
				}
			}
		}
		
		// try to initialize pipe
		try {
			var pipeInitialized = _initializeIntegrationPipe();
		} catch(e) {
			Components.utils.reportError(e);
		}
		
		if(pipeInitialized) {
			// if initialization succeeded, add an observer so that we don't hang shutdown
			var observerService = Components.classes["@mozilla.org/observer-service;1"]
				.getService(Components.interfaces.nsIObserverService);
			observerService.addObserver({ observe: Zotero.Integration.destroy }, "quit-application", false);
		}
		
		_updateTimer = Components.classes["@mozilla.org/timer;1"].
			createInstance(Components.interfaces.nsITimer);
		_updateTimer.initWithCallback({"notify":_checkPluginVersions}, 1000,
			Components.interfaces.nsITimer.TYPE_ONE_SHOT);
	}
	
	function _checkPluginVersions() {
		if(_updateTimer) _updateTimer = undefined;
		
		var verComp = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
			.getService(Components.interfaces.nsIVersionComparator);
		var addonsChecked = false;
		var success = true;
		function _checkAddons(addons) {
			addonsChecked = true;
			for(var i in addons) {
				var addon = addons[i];
				if(!addon) continue;
				if(addon.userDisabled) continue;
				
				if(verComp.compare(INTEGRATION_MIN_VERSIONS[i], addon.version) > 0) {
					_integrationVersionsOK = false;
					Zotero.Integration.activate();
					var msg = Zotero.getString(
						"integration.error.incompatibleVersion2",
						[Zotero.version, addon.name, INTEGRATION_MIN_VERSIONS[i]]
					);
					Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
						.getService(Components.interfaces.nsIPromptService)
						.alert(null, Zotero.getString("integration.error.title"), msg);
					success = false;
					throw msg;
				}
			}
			_integrationVersionsOK = true;
		}
	
		if(Zotero.isFx4) {
			Components.utils.import("resource://gre/modules/AddonManager.jsm");
			AddonManager.getAddonsByIDs(INTEGRATION_PLUGINS, _checkAddons);
			while(!addonsChecked) Zotero.mainThread.processNextEvent(true);
		} else {
			var extMan = Components.classes['@mozilla.org/extensions/manager;1'].
				getService(Components.interfaces.nsIExtensionManager);
			_checkAddons([extMan.getItemForID(id) for each(id in INTEGRATION_PLUGINS)]);
		}
		
		return success;
	}
	
	/**
	 * Executes an integration command, first checking to make sure that versions are compatible
	 */
	this.execCommand = function execCommand(agent, command, docId) {
		if(_inProgress) {
			Zotero.Integration.activate();
			Zotero.debug("Integration: Request already in progress; not executing "+agent+" "+command);
			return;
		}
		_inProgress = true;
		
		// Check integration component versions
		if(_checkPluginVersions()) {
			_callIntegration(agent, command, docId);
		} else {
			inProgress = false;
		}
	}
	
	/**
	 * Parses a command received from the integration pipe
	 */
	function _parseIntegrationPipeCommand(string) {
		if(string != "") {
			// exec command if possible
			var parts = string.match(/^([^ \n]*) ([^ \n]*)(?: ([^\n]*))?\n?$/);
			if(parts) {
				var agent = parts[1].toString();
				var cmd = parts[2].toString();
				
				// return if we were told to shutdown
				if(agent === "Zotero" && cmd === "shutdown") return;
				
				_initializePipeStreamPump();
				
				var document = parts[3] ? parts[3].toString() : null;
				Zotero.Integration.execCommand(agent, cmd, document);
			} else {
				_initializePipeStreamPump();
				Components.utils.reportError("Zotero: Invalid integration input received: "+string);
			}
		} else {
			_initializePipeStreamPump();
		}
	}
	
	/**
	 * Listens asynchronously for data on the integration pipe and reads it when available
	 * 
	 * Used to read from the integration pipe on Fx 4.2
	 */
	var _integrationPipeListenerFx42 = {
		"onStartRequest":function() {},
		"onStopRequest":function() {},
		
		"onDataAvailable":function(request, context, inputStream, offset, count) {
			// read from pipe
			var converterInputStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
				.createInstance(Components.interfaces.nsIConverterInputStream);
			converterInputStream.init(inputStream, "UTF-8", 4096,
				Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
			var out = {};
			converterInputStream.readString(count, out);
			inputStream.close();
			
			_parseIntegrationPipeCommand(out.value);
	}};
	
	/**
	 * Polling mechanism for file
	 */
	var _integrationPipeObserverFx36 = {"notify":function() {
		if(_fifoFile.fileSize === 0) return;
		
		// read from pipe (file, actually)
		var string = Zotero.File.getContents(_fifoFile);
		
		// clear file
		var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
			createInstance(Components.interfaces.nsIFileOutputStream);
		foStream.init(_fifoFile, 0x02 | 0x08 | 0x20, 0666, 0); 
		foStream.close();
		
		// run command
		_parseIntegrationPipeCommand(string);
	}};
	
	/**
	 * Initializes the nsIInputStream and nsIInputStreamPump to read from _fifoFile
	 */
	function _initializePipeStreamPump() {
		// Fx >4 supports deferred open; no need to use sh
		var fifoStream = Components.classes["@mozilla.org/network/file-input-stream;1"].
			createInstance(Components.interfaces.nsIFileInputStream);
		fifoStream.QueryInterface(Components.interfaces.nsIFileInputStream);
		// 16 = open as deferred so that we don't block on open
		fifoStream.init(_fifoFile, -1, 0, 16);
		
		var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"].
			createInstance(Components.interfaces.nsIInputStreamPump);
		pump.init(fifoStream, -1, -1, 4096, 1, true);
		pump.asyncRead(_integrationPipeListenerFx42, null);
	}
	
	/**
	 * Initializes the Zotero Integration Pipe
	 */
	function _initializeIntegrationPipe() {
		var verComp = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
			.getService(Components.interfaces.nsIVersionComparator);
		var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].
			getService(Components.interfaces.nsIXULAppInfo);
		if(Zotero.isFx4) {
			if(verComp.compare("2.0b9pre", appInfo.platformVersion) > 0) {
				Components.utils.reportError("Zotero word processor integration requires "+
					"Firefox 4.0b9 or later. Please update to the latest Firefox 4.0 beta.");
				return;
			} else if(verComp.compare("2.2a1pre", appInfo.platformVersion) <= 0) {
				_pipeMode = "deferredOpen";
			} else {
				_pipeMode = "fx4thread";
			}
		} else {
			if(Zotero.isMac) {
				_pipeMode = "poll";
			} else {
				_pipeMode = "fx36thread";
			}
		}
		
		Zotero.debug("Using integration pipe mode "+_pipeMode);
		
		if(_pipeMode === "poll") {
			// create empty file
			var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
				createInstance(Components.interfaces.nsIFileOutputStream);
			foStream.init(_fifoFile, 0x02 | 0x08 | 0x20, 0666, 0); 
			foStream.close();
			
			// no deferred open capability, so we need to poll
			// has to be global so that we don't get garbage collected
			_timer = Components.classes["@mozilla.org/timer;1"].
				createInstance(Components.interfaces.nsITimer);
			_timer.initWithCallback(_integrationPipeObserverFx36, 1000,
				Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
		} else {
			// make a new pipe
			var mkfifo = Components.classes["@mozilla.org/file/local;1"].
				createInstance(Components.interfaces.nsILocalFile);
			mkfifo.initWithPath("/usr/bin/mkfifo");
			if(!mkfifo.exists()) mkfifo.initWithPath("/bin/mkfifo");
			if(!mkfifo.exists()) mkfifo.initWithPath("/usr/local/bin/mkfifo");
			
			if(mkfifo.exists()) {
				// create named pipe
				var proc = Components.classes["@mozilla.org/process/util;1"].
						createInstance(Components.interfaces.nsIProcess);
				proc.init(mkfifo);
				proc.run(true, [_fifoFile.path], 1);
				
				if(_fifoFile.exists()) {
					if(_pipeMode === "deferredOpen") {
						_initializePipeStreamPump();
					} else if(_pipeMode === "fx36thread") {
						var main = Components.classes["@mozilla.org/thread-manager;1"].getService().mainThread;
						var background = Components.classes["@mozilla.org/thread-manager;1"].getService().newThread(0);
						
						function mainThread(agent, cmd, doc) {
							this.agent = agent;
							this.cmd = cmd;
							this.document = doc;
						}
						mainThread.prototype.run = function() {
							Zotero.Integration.execCommand(this.agent, this.cmd, this.document);
						}
						
						function fifoThread() {}
						fifoThread.prototype.run = function() {
							var fifoStream = Components.classes["@mozilla.org/network/file-input-stream;1"].
								createInstance(Components.interfaces.nsIFileInputStream);
							var line = {};
							while(true) {
								fifoStream.QueryInterface(Components.interfaces.nsIFileInputStream);
								fifoStream.init(_fifoFile, -1, 0, 0);
								fifoStream.QueryInterface(Components.interfaces.nsILineInputStream);
								fifoStream.readLine(line);
								fifoStream.close();
								
								var parts = line.value.split(" ");
								var agent = parts[0];
								var cmd = parts[1];
								var document = parts.length >= 3 ? line.value.substr(agent.length+cmd.length+2) : null;
								if(agent == "Zotero" && cmd == "shutdown") return;
								main.dispatch(new mainThread(agent, cmd, document), background.DISPATCH_NORMAL);
							}
						}
						
						fifoThread.prototype.QueryInterface = mainThread.prototype.QueryInterface = function(iid) {
							if (iid.equals(Components.interfaces.nsIRunnable) ||
								iid.equals(Components.interfaces.nsISupports)) return this;
							throw Components.results.NS_ERROR_NO_INTERFACE;
						}
						
						background.dispatch(new fifoThread(), background.DISPATCH_NORMAL);
					} else if(_pipeMode === "fx4thread") {
						Components.utils.import("resource://gre/modules/ctypes.jsm");
						
						// get possible names for libc
						if(Zotero.isMac) {
							var possibleLibcs = ["/usr/lib/libc.dylib"];
						} else {
							var possibleLibcs = [
								"libc.so.6",
								"libc.so.6.1",
								"libc.so"
							];
						}
						
						// try all possibilities
						while(possibleLibcs.length) {
							var libc = possibleLibcs.shift();
							try {
								var lib = ctypes.open(libc);
								break;
							} catch(e) {}
						}
						
						// throw appropriate error on failure
						if(!lib) {
							throw "libc could not be loaded. Please post on the Zotero Forums so we can add "+
								"support for your operating system.";
						}
						
						// int mkfifo(const char *path, mode_t mode);
						var mkfifo = lib.declare("mkfifo", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.unsigned_int);
						
						// make pipe
						var ret = mkfifo(_fifoFile.path, 0600);
						if(!_fifoFile.exists()) return false;
						lib.close();
						
						// set up worker
						var worker = Components.classes["@mozilla.org/threads/workerfactory;1"]  
							.createInstance(Components.interfaces.nsIWorkerFactory)
							.newChromeWorker("chrome://zotero/content/xpcom/integration_worker.js");
						worker.onmessage = function(event) {
							if(event.data[0] == "Exception") {
								throw event.data[1];
							} else if(event.data[0] == "Debug") {
								Zotero.debug(event.data[1]);
							} else {
								Zotero.Integration.execCommand(event.data[0], event.data[1], event.data[2]);
							}
						}
						worker.postMessage({"path":_fifoFile.path, "libc":libc});
					}
				} else {
					Components.utils.reportError("Zotero: mkfifo failed -- not initializing integration pipe");
					return false;
				}
			} else {
				Components.utils.reportError("Zotero: mkfifo or sh not found -- not initializing integration pipe");
				return false;
			}
		}
					
		return true;
	}
	
	/**
	 * Calls the Integration applicatoon
	 */
	function _callIntegration(agent, command, docId) {
		// Try to load the appropriate Zotero component; otherwise display an error using the alert
		// service
		try {
			var componentClass = "@zotero.org/Zotero/integration/application?agent="+agent+";1";
			Zotero.debug("Integration: Instantiating "+componentClass+" for command "+command+(docId ? " with doc "+docId : ""));
			var application = Components.classes[componentClass]
				.getService(Components.interfaces.zoteroIntegrationApplication);
		} catch(e) {
			_inProgress = false;
			Zotero.Integration.activate();
			Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Components.interfaces.nsIPromptService)
				.alert(null, Zotero.getString("integration.error.title"),
					Zotero.getString("integration.error.notInstalled"));
			throw e;
		}
		
		// Try to execute the command; otherwise display an error in alert service or word processor
		// (depending on what is possible)
		var integration, document;
		try {
			document = (application.getDocument && docId ? application.getDocument(docId) : application.getActiveDocument());
			integration = new Zotero.Integration.Document(application, document);
			integration[command]();
			integration.cleanup();
		} catch(e) {
			if(integration) {
				try {
					integration.cleanup();
				} catch(e) {
					Components.utils.reportError(e);
				}
			}
			
			if(!(e instanceof Zotero.Integration.UserCancelledException)) {
				try {
					var displayError = null;
					if(e instanceof Zotero.Integration.DisplayException) {
						displayError = e.toString();
					} else {
						// check to see whether there's a pyxpcom error in the console, since it doesn't
						// get thrown directly
						var message = "";
						
						var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
							.getService(Components.interfaces.nsIConsoleService);
						
						var messages = {};
						consoleService.getMessageArray(messages, {});
						messages = messages.value;
						if(messages && messages.length) {
							var lastMessage = messages[messages.length-1];
							try {
								var error = lastMessage.QueryInterface(Components.interfaces.nsIScriptError);
							} catch(e2) {
								if(lastMessage.message && lastMessage.message.substr(0, 12) == "ERROR:xpcom:") {
									// print just the last line of the message, but re-throw the rest
									message = lastMessage.message.substr(0, lastMessage.message.length-1);
									message = "\n"+message.substr(message.lastIndexOf("\n"))
								}
							}
						}
						
						if(!message && typeof(e) == "object" && e.message) message = "\n\n"+e.message;
						
						if(message != "\n\nExceptionAlreadyDisplayed") {
							displayError = Zotero.getString("integration.error.generic")+message;
						}
						Zotero.debug(e);
					}
					
					if(displayError) {
						if(integration) {
							integration._doc.displayAlert(displayError,
									Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_STOP,
									Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK);
						} else {
							Zotero.Integration.activate();
							Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService)
								.alert(null, Zotero.getString("integration.error.title"), displayError);
						}
					}
				} finally {
					throw e;
				}
			}
		} finally {
			_inProgress = false;
		}
	}
	
	/**
	 * Destroys the integration pipe.
	 */
	this.destroy = function() {
		if(_pipeMode !== "poll") {
			// send shutdown message to fifo thread
			var oStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
				getService(Components.interfaces.nsIFileOutputStream);
			oStream.init(_fifoFile, 0x02 | 0x10, 0, 0);
			var cmd = "Zotero shutdown\n";
			oStream.write(cmd, cmd.length);
			oStream.close();
		}
		_fifoFile.remove(false);
	}
	
	/**
	 * Activates Firefox
	 */
	this.activate = function() {
		if(Zotero.isMac) {
			const BUNDLE_IDS = {
				"Zotero":"org.zotero.zotero",
				"Firefox":"org.mozilla.firefox",
				"Minefield":"org.mozilla.minefield"
			};
			
			if(Zotero.oscpu == "PPC Mac OS X 10.4" || Zotero.oscpu == "Intel Mac OS X 10.4"
			   || !BUNDLE_IDS[Zotero.appName]) {
				// 10.4 doesn't support "tell application id"
				_executeAppleScript('tell application "'+Zotero.appName+'" to activate');
			} else {
				_executeAppleScript('tell application id "'+BUNDLE_IDS[Zotero.appName]+'" to activate');
			}
		}
	}
	
	/**
	 * Runs an AppleScript on OS X
	 *
	 * @param script {String}
	 * @param block {Boolean} Whether the script should block until the process is finished.
	 */
	function _executeAppleScript(script, block) {
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
			try {
				proc.run(!!block, ['-e', script], 2);
			} catch(e) {}
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
Zotero.Integration.MissingItemException.prototype.toString = function() { return this.message; };

Zotero.Integration.UserCancelledException = function() {};
Zotero.Integration.UserCancelledException.prototype.name = "UserCancelledException";
Zotero.Integration.UserCancelledException.prototype.message = "User cancelled document update.";
Zotero.Integration.UserCancelledException.prototype.toString = function() { return this.message; };

Zotero.Integration.DisplayException = function(name, params) {
	this.name = name;
	this.params = params ? params : [];
};
Zotero.Integration.DisplayException.prototype.toString = function() { return Zotero.getString("integration.error."+this.name, this.params); };

Zotero.Integration.CorruptFieldException = function(corruptFieldString) {
	this.corruptFieldString = corruptFieldString;
}
Zotero.Integration.CorruptFieldException.prototype.name = "CorruptFieldException";
Zotero.Integration.CorruptFieldException.prototype.message = "A field code in this document is corrupted.";
Zotero.Integration.CorruptFieldException.prototype.toString = function() { return this.message+" "+this.corruptFieldString.toSource(); }

// Field code for an item
const ITEM_CODE = "ITEM";
// Field code for a bibliography
const BIBLIOGRAPHY_CODE = "BIBL";
// Placeholder for an empty bibliography
const BIBLIOGRAPHY_PLACEHOLDER = "{Bibliography}";

/**
 * 
 */
Zotero.Integration.Document = function(app, doc) {
	this._app = app;
	this._doc = doc;
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
	this._reloadSession = false;
	var dataString = this._doc.getDocumentData();
	if(!dataString) {
		if(require) {
			throw new Zotero.Integration.DisplayException("mustInsertCitation");
		} else {
			// Set doc prefs if no data string yet
			this._session = this._createNewSession(new Zotero.Integration.DocumentData());
			if(dontRunSetDocPrefs) return false;
			
			Zotero.Integration.activate();
			try {
				var ret = this._session.setDocPrefs(this._app.primaryFieldType, this._app.secondaryFieldType);
			} finally {
				this._doc.activate();
			}
			// save doc prefs in doc
			this._doc.setDocumentData(this._session.data.serializeXML());
		}
	} else {
		var data = new Zotero.Integration.DocumentData(dataString);
		if(data.dataVersion < DATA_VERSION) {
			if(data.dataVersion == 1 && data.prefs.fieldType == "Field" && this._app.primaryFieldType == "ReferenceMark") {
				// Converted OOo docs use ReferenceMarks, not fields
				data.prefs.fieldType = "ReferenceMark";
			}
			
			var warning = this._doc.displayAlert(Zotero.getString("integration.upgradeWarning"),
				Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_WARNING,
				Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK_CANCEL);
			if(!warning) throw new Zotero.Integration.UserCancelledException();
		} else if(data.dataVersion > DATA_VERSION) {
			throw new Zotero.Integration.DisplayException("newerDocumentVersion", [data.zoteroVersion, Zotero.version]);
		}
		if(Zotero.Integration.sessions[data.sessionID]) {
			this._session = Zotero.Integration.sessions[data.sessionID];
		} else {
			this._session = this._createNewSession(data);
			
			// make sure style is defined
			if(!this._session.style) {
				Zotero.Integration.activate();
				try {
					this._session.setDocPrefs(this._app.primaryFieldType, this._app.secondaryFieldType);
				} finally {
					this._doc.activate();
				}
			}
			this._doc.setDocumentData(this._session.data.serializeXML());
			
			this._reloadSession = true;
		}
	}
	
	this._session.resetRequest(this);
	return !!dataString;
}

/**
 * Gets all fields for a document
 * @param require {Boolean} Whether an error should be thrown if no fields exist
 */
Zotero.Integration.Document.prototype._getFields = function(require) {
	if(this._fields) return;
	if(!this._session && !this._getSession(require, true)) return;
	
	var getFieldsTime = (new Date()).getTime();
	var fields = this._doc.getFields(this._session.data.prefs['fieldType']);
	this._fields = [];
	while(fields.hasMoreElements()) {
		this._fields.push(fields.getNext().QueryInterface(Components.interfaces.zoteroIntegrationField));
	}
	var endTime = (new Date()).getTime();
	if(Zotero.Debug.enabled) {
		Zotero.debug("Integration: got "+this._fields.length+" fields in "+
			(endTime-getFieldsTime)/1000+"; "+
			1000/((endTime-getFieldsTime)/this._fields.length)+" fields/second");
	}
	
	if(require && !this._fields.length) {
		throw new Zotero.Integration.DisplayException("mustInsertCitation");
	}
	
	return;
}

/**
 * Checks that it is appropriate to add fields to the current document at the current
 * positon, then adds one.
 */
Zotero.Integration.Document.prototype._addField = function(note) {
	// Get citation types if necessary
	if(!this._doc.canInsertField(this._session.data.prefs['fieldType'])) {
		throw new Zotero.Integration.DisplayException("cannotInsertHere");
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
 * Shows an error if a field code is corrupted
 * @param {Exception} e The exception thrown
 * @param {Field} field The Zotero field object
 * @param {Integer} i The field index
 */
Zotero.Integration.Document.prototype._showCorruptFieldError = function(e, field, i) {
	var msg = Zotero.getString("integration.corruptField")+'\n\n'+
			  Zotero.getString('integration.corruptField.description');
	field.select();
	var result = this._doc.displayAlert(msg,
		Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_CAUTION, 
		Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_YES_NO_CANCEL);
	
	if(result == 0) {
		throw e;
	} else if(result == 1) {		// No
		this._removeCodeFields.push(i);
	} else {
		// Display reselect edit citation dialog
		var added = this._session.editCitation(i, field.getNoteIndex());
		if(added) {
			this._doc.activate();
		} else {
			throw new Zotero.Integration.UserCancelledException();
		}
	}
}

/**
 * Loads existing citations and bibliographies out of a document, and creates or edits fields
 */
Zotero.Integration.Document.prototype._updateSession = function(newField, editField) {
	var deleteKeys = {};
	this._deleteFields = [];
	this._removeCodeFields = [];
	this._bibliographyFields = [];
	var bibliographyData = "";
	
	// first collect entire bibliography
	this._getFields();
	var editFieldIndex = false;
	var collectFieldsTime = (new Date()).getTime();
	for(var i in this._fields) {
		var field = this._fields[i];
		
		if(editField && field.equals(editField)) {
			editFieldIndex = i;
		} else {
			try {
				var fieldCode = field.getCode();
			} catch(e) {
				this._showCorruptFieldError(e, field, i);
			}
			
			if(fieldCode.substr(0, ITEM_CODE.length) == ITEM_CODE) {
				var noteIndex = (this._session.styleClass == "note" ? field.getNoteIndex() : 0);
				try {
					this._session.addCitation(i, noteIndex, fieldCode.substr(ITEM_CODE.length+1));
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
								var msg = Zotero.getString("integration.missingItem.multiple", (e.citationIndex+1).toString());
							}
							msg += '\n\n'+Zotero.getString('integration.missingItem.description');
							field.select();
							var result = this._doc.displayAlert(msg, 1, 3);
							if(result == 0) {			// Cancel
								throw new Zotero.Integration.UserCancelledException();
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
								this._session.addCitation(i, field.getNoteIndex(), fieldCode.substr(ITEM_CODE.length+1));
								this._doc.activate();
							}
						}
					} else if(e instanceof Zotero.Integration.CorruptFieldException) {
						this._showCorruptFieldError(e, field, i);
					} else {
						throw e;
					}
				}
			} else if(fieldCode.substr(0, BIBLIOGRAPHY_CODE.length) == BIBLIOGRAPHY_CODE) {
				this._bibliographyFields.push(field);
				if(!this._session.bibliographyData && !bibliographyData) {
					bibliographyData = fieldCode.substr(BIBLIOGRAPHY_CODE.length+1);
				}
			} else if(fieldCode == "TEMP") {
				if(newField && newField.equals(field)) {
					editFieldIndex = i;
					editField = field;
				} else {
					this._deleteFields.push(i);
				}
			}
		}
	}
	var endTime = (new Date()).getTime();
	if(Zotero.Debug.enabled) {
		Zotero.debug("Integration: collected "+this._fields.length+" fields in "+
			(endTime-collectFieldsTime)/1000+"; "+
			1000/((endTime-collectFieldsTime)/this._fields.length)+" fields/second");
	}
	
	// load uncited items from bibliography
	if(bibliographyData && !this._session.bibliographyData) {
		try {
			this._session.loadBibliographyData(bibliographyData);
		} catch(e) {
			if(e instanceof Zotero.Integration.CorruptFieldException) {
				var msg = Zotero.getString("integration.corruptBibliography")+'\n\n'+
						  Zotero.getString('integration.corruptBibliography.description');
				var result = this._doc.displayAlert(msg, 
							Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_CAUTION, 
							Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK_CANCEL);
				if(result == 0) {
					throw e;
				} else {
					bibliographyData = "";
					this._session.bibliographyHasChanged = true;
					this._session.bibliographyDataHasChanged = true;
				}
			} else {
				throw e;
			}
		}
	}
	
	// if we are reloading this session, assume no item IDs to be updated except for edited items
	if(this._reloadSession) {
		//this._session.restoreProcessorState(); TODO doesn't appear to be working properly
		this._session.updateUpdateIndices();
		var deleteCitations = this._session.updateCitations();
		this._deleteFields = this._deleteFields.concat([i for(i in deleteCitations)]);
		this._session.updateIndices = {};
		this._session.updateItemIDs = {};
		this._session.bibliographyHasChanged = false;
	}
	
	// create new citation or edit existing citation
	if(editFieldIndex) { 
		var editFieldCode = editField.getCode().substr(ITEM_CODE.length+1);
		var editCitation = editFieldCode ? this._session.unserializeCitation(editFieldCode, editFieldIndex) : null;
		
		Zotero.Integration.activate();
		var editNoteIndex = editField.getNoteIndex();
		var added = this._session.editCitation(editFieldIndex, editNoteIndex, editCitation);
		this._doc.activate();
		
		if(!added) {
			if(editFieldCode) {	// cancelled editing; just add as if nothing happened
				this._session.addCitation(editFieldIndex, editNoteIndex, editCitation);
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
	// update citations
	this._session.updateUpdateIndices(forceCitations);
	var deleteCitations = this._session.updateCitations();
	this._deleteFields = this._deleteFields.concat([i for(i in deleteCitations)]);
	for(var i in this._session.updateIndices) {
		var citation = this._session.citationsByIndex[i];
		if(!citation || deleteCitations[i]) continue;
		
		var fieldCode = this._session.getCitationField(citation);
		if(fieldCode != citation.properties.field) {
			this._fields[i].setCode(ITEM_CODE+" "+fieldCode);
		}
		
		if(citation.properties.custom) {
			var citationText = citation.properties.custom;
		} else {
			var citationText = this._session.citationText[i];
		}
		
		if(citationText.indexOf("\\") !== -1) {
			// need to set text as RTF
			this._fields[i].setText("{\\rtf "+citationText+"}", true);
		} else {
			// set text as plain
			this._fields[i].setText(citationText, false);
		}
	}
	
	// update bibliographies
	if(this._bibliographyFields.length	 				// if blbliography exists
			&& (this._session.bibliographyHasChanged	// and bibliography changed
			|| forceBibliography)) {					// or if we should generate regardless of changes
		if(forceBibliography || this._session.bibliographyDataHasChanged) {
			var bibliographyData = this._session.getBibliographyData();
			for each(var field in this._bibliographyFields) {
				field.setCode(BIBLIOGRAPHY_CODE+" "+bibliographyData);
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
				this._doc.setDocumentData(this._session.data.serializeXML());
			}
		}
		
		// set bibliography text
		for each(var field in this._bibliographyFields) {
			if(bibliographyText) {
				field.setText(bibliographyText, true);
			} else {
				field.setText("{Bibliography}", false);
			}
		}
	}
	
	// do this operations in reverse in case plug-ins care about order
	this._deleteFields.sort();
	for(var i=(this._deleteFields.length-1); i>=0; i--) {
		this._fields[this._deleteFields[i]].delete();
	}
	this._removeCodeFields.sort();
	for(var i=(this._removeCodeFields.length-1); i>=0; i--) {
		this._fields[this._removeCodeFields[i]].removeCode();
	}
}

/**
 * Adds a citation to the current document.
 */
Zotero.Integration.Document.prototype.addCitation = function() {
	this._getSession();
	
	var field = this._addField(true);
	if(!field) return;
	field.setCode("TEMP");
	
	this._updateSession(field);
	this._updateDocument();
}
	
/**
 * Edits the citation at the cursor position.
 */
Zotero.Integration.Document.prototype.editCitation = function() {
	this._getSession(true);
	
	var field = this._doc.cursorInField(this._session.data.prefs['fieldType'])
	if(!field) {
		throw new Zotero.Integration.DisplayException("notInCitation");
	}
	
	this._updateSession(false, field);
	this._updateDocument(false, false);
}

/**
 * Adds a bibliography to the current document.
 */
Zotero.Integration.Document.prototype.addBibliography = function() {
	this._getSession(true);

	// Make sure we can have a bibliography
	if(!this._session.data.style.hasBibliography) {
		throw new Zotero.Integration.DisplayException("noBibliography");
	}
	
	// Make sure we have some citations
	this._getFields(true);
	
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
	this._getFields(true);
	var haveBibliography = false;
	for(var i=this._fields.length-1; i>=0; i--) {
		if(this._fields[i].getCode().substr(0, BIBLIOGRAPHY_CODE.length) == BIBLIOGRAPHY_CODE) {
			haveBibliography = true;
			break;
		}
	}
	
	if(!haveBibliography) {
		throw new Zotero.Integration.DisplayException("mustInsertBibliography");
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
	this._getFields(true);
	
	// Send request, forcing update of citations and bibliography
	this._updateSession();
	this._updateDocument(true, true);
}

/**
 * Deletes field codes.
 */
Zotero.Integration.Document.prototype.removeCodes = function() {
	this._getFields(true);

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
	this._getFields();
	
	Zotero.Integration.activate();
	try {
		var oldData = this._session.setDocPrefs(this._app.primaryFieldType, this._app.secondaryFieldType);
	} finally {
		this._doc.activate();
	}
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
	this.omittedItems = new Object();
	this.customBibliographyText = new Object();
	this.reselectedItems = new Object();
	this.citationIDs = new Object();
}

/**
 * Resets per-request variables in the CitationSet
 */
Zotero.Integration.Session.prototype.resetRequest = function(doc) {
	this.citationsByItemID = new Object();
	this.citationsByIndex = new Array();
	this.uriMap = new Zotero.Integration.URIMap(this);
	
	this.regenerateAll = false;
	this.bibliographyHasChanged = false;
	this.bibliographyDataHasChanged = false;
	this.updateItemIDs = new Object();
	this.updateIndices = new Object();
	this.newIndices = new Object();
	
	this.oldCitationIDs = this.citationIDs;
	this.citationIDs = new Object();
	this.citationText = new Object();
	
	this.doc = doc;
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
			var getStyle = Zotero.Styles.get(data.style.styleID);
			data.style.hasBibliography = getStyle.hasBibliography;
			this.style = getStyle.csl;
			this.style.setOutputFormat("rtf");
			this.styleClass = getStyle.class;
			this.dateModified = new Object();
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
 * Displays a dialog in a modal-like fashion without hanging the thread 
 */
Zotero.Integration.Session.prototype._displayDialog = function(url, options, io) {
	if(this.doc) this.doc.cleanup();
	var window = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
		.getService(Components.interfaces.nsIWindowWatcher)
		.openWindow(null, url, '', 'chrome,centerscreen'+(options ? ','+options : ""), (io ? io : null));
	while(!window.closed) Zotero.mainThread.processNextEvent(true);
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
	
	this._displayDialog('chrome://zotero/content/integration/integrationDocPrefs.xul', '', io);
	if(!io.style) throw new Zotero.Integration.UserCancelledException();
	
	// set data
	var oldData = this.data;
	var data = new Zotero.Integration.DocumentData();
	data.sessionID = oldData.sessionID;
	data.style.styleID = io.style;
	data.prefs.fieldType = io.fieldType;
	this.setData(data);
	// need to do this after setting the data so that we know if it's a note style
	this.data.prefs.noteType = this.style && this.styleClass == "note" ? io.useEndnotes+1 : 0;
	
	if(!oldData || oldData.style.styleID != data.style.styleID
			|| oldData.prefs.noteType != data.prefs.noteType
			|| oldData.prefs.fieldType != data.prefs.fieldType) {
		this.oldCitationIDs = {};
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
	
	this._displayDialog('chrome://zotero/content/selectItemsDialog.xul', 'resizable', io);
	
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
 * Generates a field from a citation object
 */
Zotero.Integration.Session.prototype.getCitationField = function(citation) {
	const saveProperties = ["custom", "unsorted"];
	const saveCitationItems = ["locator", "label", "suppress-author", "author-only", "prefix", "suffix", "uri"];
	
	var type;
	var field = [];
	
	field.push('"citationID":'+uneval(citation.citationID));
	
	var properties = JSON.stringify(citation.properties, saveProperties);
	if(properties != "{}") {
		field.push('"properties":'+properties);
	}
	
	var citationItems = [];
	for(var j=0; j<citation.citationItems.length; j++) {
		var citationItem = citation.citationItems[j];
		
		citationItem.uri = this.uriMap.getURIsForItemID(citation.citationItems[j].id);
		citationItems.push(JSON.stringify(citationItem, saveCitationItems));
	}
	field.push('"citationItems":['+citationItems.join(",")+"]");
	
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
Zotero.Integration.Session.prototype.addCitation = function(index, noteIndex, arg) {
	var index = parseInt(index, 10);
	
	if(typeof(arg) == "string") {	// text field
		if(arg == "!" || arg == "X") return;
		
		var citation = this.unserializeCitation(arg, index);
	} else {					// a citation already
		var citation = arg;
	}
	
	// get items
	for(var i=0; i<citation.citationItems.length; i++) {
		var citationItem = citation.citationItems[i];
		
		// get Zotero item
		var zoteroItem = false;
		if(citationItem.uri) {
			[zoteroItem, needUpdate] = this.uriMap.getZoteroItemForURIs(citationItem.uri);
			if(needUpdate) this.updateIndices[index] = true;
		} else {
			if(citationItem.key) {
				zoteroItem = Zotero.Items.getByKey(citationItem.key);
			} else if(citationItem.itemID) {
				zoteroItem = Zotero.Items.get(citationItem.itemID);
			} else if(citationItem.id) {
				zoteroItem = Zotero.Items.get(citationItem.id);
			}
			if(zoteroItem) this.updateIndices[index] = true;
		}
		
		// if no item, check if it was already reselected and otherwise handle as a missing item
		if(!zoteroItem) {	
			if(citationItem.uri) {
				var reselectKeys = citationItem.uri;
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
			for each(var reselectKey in reselectKeys) {
				if(this.reselectedItems[reselectKey]) {
					zoteroItem = Zotero.Items.get(this.reselectedItems[reselectKey]);
					citationItem.id = zoteroItem.id;
					this.updateIndices[index] = true;
					break;
				}
			}
			
			// if not already reselected, throw a MissingItemException
			if(!zoteroItem) {
				throw(new Zotero.Integration.MissingItemException(
					reselectKeys, reselectKeyType, i, citation.citationItems.length));
			}
		}
		
		citationItem.id = zoteroItem.id;
	}
	
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
	
	var needNewID = !citation.citationID || this.citationIDs[citation.citationID];
	if(needNewID || !this.oldCitationIDs[citation.citationID]) {
		if(needNewID) {
			Zotero.debug("Integration: "+citation.citationID+" ("+index+") needs new citationID");
			citation.citationID = Zotero.randomString();
		}
		this.newIndices[index] = true;
		this.updateIndices[index] = true;
	}
	Zotero.debug("Integration: adding citationID "+citation.citationID);
	this.citationIDs[citation.citationID] = true;
}
/**
 * Unserializes a JSON citation into a citation object (sans items)
 */
Zotero.Integration.Session.prototype.unserializeCitation = function(arg, index) {
	if(arg[0] == "{") {		// JSON field
		// fix for corrupted fields
		var lastBracket = arg.lastIndexOf("}");
		if(lastBracket+1 != arg.length) {
			this.updateIndices[index] = true;
			arg = arg.substr(0, lastBracket+1);
		}
		
		// get JSON
		try {
			var citation = Zotero.JSON.unserialize(arg);
		} catch(e) {
			// fix for corrupted fields (corrupted by Word, somehow)
			try {
				var citation = Zotero.JSON.unserialize(arg.substr(0, arg.length-1));
			} catch(e) {
				// another fix for corrupted fields (corrupted by 2.1b1)
				try {
					var citation = Zotero.JSON.unserialize(arg.replace(/{{((?:\s*,?"unsorted":(?:true|false)|\s*,?"custom":"(?:(?:\\")?[^"]*\s*)*")*)}}/, "{$1}"));
				} catch(e) {
					throw new Zotero.Integration.CorruptFieldException(arg);
				}
			}
		}
		
		// fix for uppercase citation codes
		if(citation.CITATIONITEMS) {
			this.updateIndices[index] = true;
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
		
		// for upgrade from Zotero 2.0 or earlier
		for each(var citationItem in citation.citationItems) {
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
		}
		if(citation.sort) {
			citation.properties.unsorted = !citation.sort;
			delete citation.sort;
		}
		if(citation.custom) {
			citation.properties.custom = citation.custom;
			delete citation.custom;
		}
		if(!citation.citationID) citation.citationID = Zotero.randomString();
		
		citation.properties.field = arg;
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
			var citationItem = {id:itemIDs[i]};
			if(locators) {
				citationItem.locator = locators[i].substr(1);
				citationItem.label = Zotero.Integration._oldCitationLocatorMap[locators[i][0]];
			}
			citationItems.push(citationItem);
		}
		
		var citation = {"citationItems":citationItems, properties:{}};
		this.updateIndices[index] = true;
	}
	
	return citation;
}

/**
 * marks a citation for removal
 */
Zotero.Integration.Session.prototype.deleteCitation = function(index) {
	var oldCitation = (this.citationsByIndex[index] ? this.citationsByIndex[index] : false);
	this.citationsByIndex[index] = {properties:{"delete":true}};
	
	if(oldCitation && oldCitation.citationItems & oldCitation.properties.added) {
		// clear out old citations if necessary
		for each(var citationItem in oldCitation.citationItems) {
			if(this.citationsByItemID[citationItem.id]) {
				var indexInItemID = this.citationsByItemID[citationItem.id].indexOf(oldCitation);
				if(indexInItemID !== -1) {
					this.citationsByItemID[citationItem.id] = this.citationsByItemID[citationItem.id].splice(indexInItemID, 1);
					if(this.citationsByItemID[citationItem.id].length == 0) {
						delete this.citationsByItemID[citationItem.id];
					}
				}
			}
		}
	}
	Zotero.debug("Integration: Deleting old citationID "+oldCitation.citationID);
	if(oldCitation.citationID) delete this.citationIDs[oldCitation.citationID];
	
	this.updateIndices[index] = true;
}

/**
 * Gets integration bibliography
 */
Zotero.Integration.Session.prototype.getBibliography = function() {
	this.updateUncitedItems();
	
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
	this.style.updateUncitedItems([parseInt(i) for(i in this.uncitedItems)]);
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
		for each(var newCitation in newCitations[1]) {
			this.citationText[citationIndices[newCitation[0]]] = newCitation[1];
			this.updateIndices[citationIndices[newCitation[0]]] = true;
		}
		return newCitations.bibchange;
	}
}

/**
 * Updates the list of citations to be serialized to the document
 */
Zotero.Integration.Session.prototype.updateCitations = function() {
	/*var allUpdatesForced = false;
	var forcedUpdates = {};
	if(force) {
		allUpdatesForced = true;
		// make sure at least one citation gets updated
		updateLoop: for each(var indexList in [this.newIndices, this.updateIndices]) {
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
		Zotero.debug([key for(key in this.newIndices)]);
		Zotero.debug("Integration: Indices of updated citations");
		Zotero.debug([key for(key in this.updateIndices)]);
	}
	
	var deleteCitations = {};
	for each(var indexList in [this.newIndices, this.updateIndices]) {
		for(var index in indexList) {
			index = parseInt(index);
			
			var citation = this.citationsByIndex[index];
			if(citation.properties.delete) {
				deleteCitations[index] = true;
				continue;
			}
			if(this.formatCitation(index, citation)) {
				this.bibliographyHasChanged = true;
			}
			if(!this.citationIDs[citation.citationID]) {
				this.citationIDs[citation.citationID] = citation;
			}
			delete this.newIndices[index];
		}
	}
	
	/*if(allUpdatesForced) {
		this.newIndices = {};
		this.updateIndices = {};
	}*/
	
	return deleteCitations;
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
Zotero.Integration.Session.prototype.loadBibliographyData = function(json) {
	try {
		var documentData = Zotero.JSON.unserialize(json);
	} catch(e) {
		try {
			var documentData = Zotero.JSON.unserialize(json.substr(0, json.length-1));
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
			for each(var uris in documentData.uncited) {
				[zoteroItem, update] = this.uriMap.getZoteroItemForURIs(uris);
				if(zoteroItem && !this.citationsByItemID[zoteroItem.id]) {
					this.uncitedItems[zoteroItem.id] = true;
				} else {
					needUpdate = true;
				}
				this.bibliographyDataHasChanged |= needUpdate;
			}
		} else {
			for(var itemID in documentData.uncited) {
				// if not yet in item set, add to item set
				var zoteroItem = Zotero.Items.getByKey(itemID);
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
			for each(var custom in documentData.custom) {
				[zoteroItem, needUpdate] = this.uriMap.getZoteroItemForURIs(custom[0]);
				if(!zoteroItem) continue;
				if(needUpdate) this.bibliographyDataHasChanged = true;
				
				if(this.citationsByItemID[zoteroItem.id] || this.uncitedItems[zoteroItem.id]) {
					this.customBibliographyText[zoteroItem.id] = custom[1];
				}
			}
		} else {
			// old style hash
			for(var itemID in documentData.custom) {
				var zoteroItem = Zotero.Items.getByKey(itemID);
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
			for each(var uris in documentData.omitted) {
				[zoteroItem, update] = this.uriMap.getZoteroItemForURIs(uris);
				if(zoteroItem && this.citationsByItemID[zoteroItem.id]) {
					this.omittedItems[zoteroItem.id] = true;
				} else {
					needUpdate = true;
				}
				this.bibliographyDataHasChanged |= needUpdate;
			}
	}
	
	this.bibliographyData = json;
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
	for(var item in this.omittedItems) {
		if(item) {
			if(!bibliographyData.omitted) bibliographyData.omitted = [];
			bibliographyData.omitted.push(this.uriMap.getURIsForItemID(item));
		}
	}
	
	// look for custom bibliography entries
	bibliographyData.custom = [[this.uriMap.getURIsForItemID(id), this.customBibliographyText[id]]
		for(id in this.customBibliographyText)];
	
	if(bibliographyData.uncited || bibliographyData.custom) {
		return Zotero.JSON.serialize(bibliographyData);
	} else {
		return ""; 	// nothing
	}
}

/**
 * Returns a preview, given a citation object (whose citationItems lack item 
 * and position)
 */
Zotero.Integration.Session.prototype.previewCitation = function(citation) {
	var citationsPre, citationsPost, citationIndices;
	[citationsPre, citationsPost, citationIndices] = this._getPrePost(citation.properties.zoteroIndex);
	try {
		return this.style.previewCitationCluster(citation, citationsPre, citationsPost, "rtf");
	} catch(e) {
		Zotero.debug(e);
		throw e;
	}
} 

/**
 * Brings up the addCitationDialog, prepopulated if a citation is provided
 */
Zotero.Integration.Session.prototype.editCitation = function(index, noteIndex, citation) {
	var me = this;
	var io = new function() { this.wrappedJSObject = this; }
	
	// if there's already a citation, make sure we have item IDs in addition to keys
	if(citation) {
		var zoteroItem;
		for each(var citationItem in citation.citationItems) {
			var item = false;
			if(!citationItem.id) {
				zoteroItem = false;
				if(citationItem.uri) {
					[zoteroItem, ] = this.uriMap.getZoteroItemForURIs(citationItem.uri);
				} else if(citationItem.key) {
					zoteroItem = Zotero.Items.getByKey(citationItem.key);
				}
				if(zoteroItem) citationItem.id = zoteroItem.id;
			}
		}
	}
	
	// create object to hold citation
	io.citation = (citation ? Zotero.JSON.unserialize(Zotero.JSON.serialize(citation)) : {"citationItems":{}, "properties":{}});
	io.citation.properties.zoteroIndex = parseInt(index, 10);
	io.citation.properties.noteIndex = parseInt(noteIndex, 10);
	// assign preview function
	io.previewFunction = function() {
		return me.previewCitation(io.citation);
	}
	// determine whether citation is sortable in current style
	io.sortable = this.style.opt.sort_citations;
	
	
	this._displayDialog('chrome://zotero/content/integration/addCitationDialog.xul', 'resizable', io);
	
	if(io.citation.citationItems.length) {		// we have an item
		this.addCitation(index, noteIndex, io.citation);
		this.updateIndices[index] = true;
	}
	
	return !!io.citation.citationItems.length;
}

/**
 * Edits integration bibliography
 */
Zotero.Integration.Session.prototype.editBibliography = function() {
	var bibliographyEditor = new Zotero.Integration.Session.BibliographyEditInterface(this);
	var io = new function() { this.wrappedJSObject = bibliographyEditor; }
	
	this.bibliographyDataHasChanged = this.bibliographyHasChanged = true;
	
	this._displayDialog('chrome://zotero/content/integration/editBibliographyDialog.xul', 'resizable', io);
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
 * Serializes document-specific data as XML
 */
Zotero.Integration.DocumentData.prototype.serializeXML = function() {
	var xmlData = <data data-version={DATA_VERSION} zotero-version={Zotero.version}>
			<session id={this.sessionID} />
			<style id={this.style.styleID} hasBibliography={this.style.hasBibliography ? 1 : 0}
				bibliographyStyleHasBeenSet={this.style.bibliographyStyleHasBeenSet ? 1 : 0}/>
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
		"hasBibliography":(xmlData.style.@hasBibliography.toString() == 1),
		"bibliographyStyleHasBeenSet":(xmlData.style.@bibliographyStyleHasBeenSet.toString() == 1)};
	this.prefs = {};
	for each(var pref in xmlData.prefs.children()) {
		this.prefs[pref.@name.toString()] = pref.@value.toString();
	}
	this.zoteroVersion = xmlData["@zotero-version"].length() ? xmlData["@zotero-version"].toString() : "2.0";
	this.dataVersion = xmlData["@data-version"].length() ? xmlData["@data-version"].toString() : 2;
}

/**
 * Unserializes document-specific data, either as XML or as the string form used previously
 */
Zotero.Integration.DocumentData.prototype.unserialize = function(input) {
	if(input[0] == "<") {
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
				this.prefs.noteType = Components.interfaces.zoteroIntegrationDocument.NOTE_ENDNOTE;
			} else {
				this.prefs.noteType = Components.interfaces.zoteroIntegrationDocument.NOTE_FOOTNOTE;
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
