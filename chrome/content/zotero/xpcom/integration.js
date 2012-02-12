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

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

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

// this is used only for update checking
const INTEGRATION_PLUGINS = ["zoteroMacWordIntegration@zotero.org",
	"zoteroOpenOfficeIntegration@zotero.org", "zoteroWinWordIntegration@zotero.org"];

Zotero.Integration = new function() {
	const INTEGRATION_MIN_VERSIONS = ["3.1.7.SOURCE", "3.5b2.SOURCE", "3.1.3.SOURCE"];
	
	var _tmpFile = null;
	var _osascriptFile;
	var _integrationVersionsOK = null;
	
	// these need to be global because of GC
	var _updateTimer;
	
	// For Carbon and X11
	var _carbon, ProcessSerialNumber, SetFrontProcessWithOptions,
		_x11, _x11Display, _x11RootWindow, XClientMessageEvent, XFetchName, XFree, XQueryTree,
		XOpenDisplay, XCloseDisplay, XFlush, XDefaultRootWindow, XInternAtom, XSendEvent,
		XMapRaised, XGetWindowProperty;
	
	var _inProgress = false;
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
				if(_deletePipe(sharedPipe) && sharedDir.isWritable()) {
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
			if(!_deletePipe(pipe)) return;
		}
		
		// try to initialize pipe
		try {
			Zotero.IPC.Pipe.initPipeListener(pipe, _parseIntegrationPipeCommand);
		} catch(e) {
			Zotero.logError(e);
		}
		
		_updateTimer = Components.classes["@mozilla.org/timer;1"].
			createInstance(Components.interfaces.nsITimer);
		_updateTimer.initWithCallback({"notify":function() { _checkPluginVersions() }}, 1000,
			Components.interfaces.nsITimer.TYPE_ONE_SHOT);
	}
	
	/**
	 * Deletes a defunct pipe on OS X
	 */
	function _deletePipe(pipe) {
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
				_executeAppleScript("do shell script \"rmdir '"+escapedFifoFile+"'; rm -f '"+escapedFifoFile+"'\" with administrator privileges", true);
				if(pipe.exists()) return false;
			} catch(e) {
				Zotero.logError(e);
				return false;
			}
		}
	}
	
	function _checkPluginVersions(callback) {
		if(_updateTimer) _updateTimer = undefined;
		
		if(_integrationVersionsOK !== null) {
			if(callback) callback(_integrationVersionsOK);
			return;
		}
		
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
					throw msg;
				}
			}
			_integrationVersionsOK = true;
			
			if(callback) callback(_integrationVersionsOK);
		}
	
		Components.utils.import("resource://gre/modules/AddonManager.jsm");
		AddonManager.getAddonsByIDs(INTEGRATION_PLUGINS, _checkAddons);
	}
	
	/**
	 * Executes an integration command, first checking to make sure that versions are compatible
	 */
	this.execCommand = function execCommand(agent, command, docId) {
		if(_inProgress) {
			Zotero.Integration.activate();
			if(Zotero.Integration.currentWindow && !Zotero.Integration.currentWindow.closed) {
				Zotero.Integration.currentWindow.focus();
			}
			Zotero.debug("Integration: Request already in progress; not executing "+agent+" "+command);
			return;
		}
		_inProgress = true;
		
		// Check integration component versions
		_checkPluginVersions(function(success) {
			if(success) {
				_callIntegration(agent, command, docId);
			} else {
				_inProgress = false;
			}
		});
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
				var document = parts[3] ? parts[3].toString() : null;
				Zotero.Integration.execCommand(agent, cmd, document);
			} else {
				Components.utils.reportError("Zotero: Invalid integration input received: "+string);
			}
		}
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
		} catch(e) {
			Zotero.Integration.handleError(e, document);
		}
	}
	
	/**
	 * Activates Firefox
	 */
	this.activate = function(win) {
		if(Zotero.isMac) {
			const BUNDLE_IDS = {
				"Zotero":"org.zotero.zotero",
				"Firefox":"org.mozilla.firefox",
				"Minefield":"org.mozilla.minefield"
			};
			
			if(win) {
				Components.utils.import("resource://gre/modules/ctypes.jsm");
				
				if(!_carbon) {
					_carbon = ctypes.open("/System/Library/Frameworks/Carbon.framework/Carbon");
					/*
					 * struct ProcessSerialNumber {
					 *    unsigned long highLongOfPSN;
					 *    unsigned long lowLongOfPSN;
					 * };
					 */
					ProcessSerialNumber = new ctypes.StructType("ProcessSerialNumber", 
						[{"highLongOfPSN":ctypes.uint32_t}, {"lowLongOfPSN":ctypes.uint32_t}]);
						
					/*
					 * OSStatus SetFrontProcessWithOptions (
					 *    const ProcessSerialNumber *inProcess,
					 *    OptionBits inOptions
					 * );
					 */
					SetFrontProcessWithOptions = _carbon.declare("SetFrontProcessWithOptions",
						ctypes.default_abi, ctypes.int32_t, ProcessSerialNumber.ptr,
						ctypes.uint32_t);
				}
				
				var psn = new ProcessSerialNumber();
				psn.highLongOfPSN = 0;
				psn.lowLongOfPSN = 2 // kCurrentProcess
				
				win.addEventListener("load", function() {
					var res = SetFrontProcessWithOptions(
						psn.address(),
						1 // kSetFrontProcessFrontWindowOnly = (1 << 0)
					);
				}, false);
			} else {
				if(Zotero.oscpu == "PPC Mac OS X 10.4" || Zotero.oscpu == "Intel Mac OS X 10.4"
				   || !BUNDLE_IDS[Zotero.appName]) {
					// 10.4 doesn't support "tell application id"
					_executeAppleScript('tell application "'+Zotero.appName+'" to activate');
				} else {
					_executeAppleScript('tell application id "'+BUNDLE_IDS[Zotero.appName]+'" to activate');
				}
			}
		} else if(!Zotero.isWin && win) {
			Components.utils.import("resource://gre/modules/ctypes.jsm");
			
			if(_x11 === false) return;
			if(!_x11) {
				try {
					_x11 = ctypes.open("libX11.so.6");
				} catch(e) {
					try {
						var libName = ctypes.libraryName("X11");
					} catch(e) {
						_x11 = false;
						Zotero.debug("Integration: Could not get libX11 name; not activating");
						Zotero.logError(e);
						return;
					}
					
					try {
						_x11 = ctypes.open(libName);
					} catch(e) {
						_x11 = false;
						Zotero.debug("Integration: Could not open "+libName+"; not activating");
						Zotero.logError(e);
						return;
					}
				}
				
				const Status = ctypes.int,
					Display = new ctypes.StructType("Display"),
					Window = ctypes.unsigned_long,
					Atom = ctypes.unsigned_long,
					Bool = ctypes.int;
					
				/*
				 * typedef struct {
				 *     int type;
				 *     unsigned long serial;	/ * # of last request processed by server * /
				 *     Bool send_event;			/ * true if this came from a SendEvent request * /
				 *     Display *display;		/ * Display the event was read from * /
				 *     Window window;
				 *     Atom message_type;
				 *     int format;
				 *     union {
				 *         char b[20];
				 *         short s[10];
				 *         long l[5];
				 *     } data;
				 * } XClientMessageEvent;
				 */
				XClientMessageEvent = new ctypes.StructType("XClientMessageEvent",
					[
						{"type":ctypes.int},
						{"serial":ctypes.unsigned_long},
						{"send_event":Bool},
						{"display":Display.ptr},
						{"window":Window},
						{"message_type":Atom},
						{"format":ctypes.int},
						{"l0":ctypes.long},
						{"l1":ctypes.long},
						{"l2":ctypes.long},
						{"l3":ctypes.long},
						{"l4":ctypes.long}
					]
				);
				
				/*
				 * Status XFetchName(
				 *    Display*		display,
				 *    Window		w,
				 *    char**		window_name_return
				 * );
				 */
				XFetchName = _x11.declare("XFetchName", ctypes.default_abi, Status, Display.ptr,
					Window, ctypes.char.ptr.ptr);
					
				/*
				 * Status XQueryTree(
				 *    Display*		display,
				 *    Window		w,
				 *    Window*		root_return,
				 *    Window*		parent_return,
				 *    Window**		children_return,
				 *    unsigned int*	nchildren_return
				 * );
				 */
				XQueryTree = _x11.declare("XQueryTree", ctypes.default_abi, Status, Display.ptr,
					Window, Window.ptr, Window.ptr, Window.ptr.ptr, ctypes.unsigned_int.ptr);
				
				/*
				 * int XFree(
				 *    void*		data
				 * );
				 */
				XFree = _x11.declare("XFree", ctypes.default_abi, ctypes.int, ctypes.voidptr_t);
				
				/*
				 * Display *XOpenDisplay(
				 *     _Xconst char*	display_name
				 * );
				 */
				XOpenDisplay = _x11.declare("XOpenDisplay", ctypes.default_abi, Display.ptr,
				 	ctypes.char.ptr);
				 
				/*
				 * int XCloseDisplay(
				 *     Display*		display
				 * );
				 */
				XCloseDisplay = _x11.declare("XCloseDisplay", ctypes.default_abi, ctypes.int,
					Display.ptr);
				
				/*
				 * int XFlush(
				 *     Display*		display
				 * );
				 */
				XFlush = _x11.declare("XFlush", ctypes.default_abi, ctypes.int, Display.ptr);
				
				/*
				 * Window XDefaultRootWindow(
				 *     Display*		display
				 * );
				 */
				XDefaultRootWindow = _x11.declare("XDefaultRootWindow", ctypes.default_abi,
					Window, Display.ptr);
					
				/*
				 * Atom XInternAtom(
				 *     Display*			display,
				 *     _Xconst char*	atom_name,
				 *     Bool				only_if_exists
				 * );
				 */
				XInternAtom = _x11.declare("XInternAtom", ctypes.default_abi, Atom, Display.ptr,
				 	ctypes.char.ptr, Bool);
				 
				/*
				 * Status XSendEvent(
				 *     Display*		display,
				 *     Window		w,
				 *     Bool			propagate,
				 *     long			event_mask,
				 *     XEvent*		event_send
				 * );
				 */
				XSendEvent = _x11.declare("XSendEvent", ctypes.default_abi, Status, Display.ptr,
				 	Window, Bool, ctypes.long, XClientMessageEvent.ptr);
				
				/*
				 * int XMapRaised(
				 *     Display*		display,
				 *     Window		w
				 * );
				 */
				XMapRaised = _x11.declare("XMapRaised", ctypes.default_abi, ctypes.int, Display.ptr,
				 	Window);
				
				 	
				_x11Display = XOpenDisplay(null);
				if(!_x11Display) {
					Zotero.debug("Integration: Could not open display; not activating");
					_x11 = false;
				}
				
				Zotero.addShutdownListener(function() {
					XCloseDisplay(_x11Display);
				});
				
				_x11RootWindow = XDefaultRootWindow(_x11Display);
				if(!_x11RootWindow) {
					Zotero.debug("Integration: Could not get root window; not activating");
					_x11 = false;
				}
			}
	
			win.addEventListener("load", function() {
				intervalID = win.setInterval(function() {
					_X11BringToForeground(win, intervalID);
				}, 50);
			}, false);
		}
	}
	
	/** 
	 * Bring a window to the foreground by interfacing directly with X11
	 */
	function _X11BringToForeground(win, intervalID) {
		var windowTitle = win.QueryInterface(Ci.nsIInterfaceRequestor)
			.getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIBaseWindow).title;
		
		var x11Window = _X11FindWindow(_x11RootWindow, windowTitle);
		if(!x11Window) return;
		win.clearInterval(intervalID);
			
		var event = new XClientMessageEvent();
		event.type = 33; /* ClientMessage*/
		event.serial = 0;
		event.send_event = 1;
		event.message_type = XInternAtom(_x11Display, "_NET_ACTIVE_WINDOW", 0);
		event.display = _x11Display;
		event.window = x11Window;
		event.format = 32;
		event.l0 = 2;
		var mask = 1<<20 /* SubstructureRedirectMask */ | 1<<19 /* SubstructureNotifyMask */;
		
		if(XSendEvent(_x11Display, _x11RootWindow, 0, mask, event.address())) {
			XMapRaised(_x11Display, x11Window);
			XFlush(_x11Display);
			Zotero.debug("Activated successfully");
		} else {
			Zotero.debug("Integration: An error occurred activating the window");
		}
	}
	
	/**
	 * Find an X11 window given a name
	 */
	function _X11FindWindow(w, searchName) {
		Components.utils.import("resource://gre/modules/ctypes.jsm");
		
		var childrenPtr = new ctypes.unsigned_long.ptr(),
			dummy = new ctypes.unsigned_long(),
			foundName = new ctypes.char.ptr(),
			nChildren = new ctypes.unsigned_int();
		
		if(XFetchName(_x11Display, w, foundName.address())) {
			var foundNameString = foundName.readString();
			XFree(foundName);
			if(foundNameString === searchName) return w;
		}
		
		var dummyPtr = dummy.address();
		if(!XQueryTree(_x11Display, w, dummyPtr, dummyPtr, childrenPtr.address(),
				nChildren.address()) || childrenPtr.isNull()) {
			return false;
		}
		
		var nChildrenJS = nChildren.value;
		var children = ctypes.cast(childrenPtr, ctypes.uint32_t.array(nChildrenJS).ptr).contents;
		var foundWindow = false;
		for(var i=0; i<nChildrenJS; i++) {
			var testWin = children.addressOfElement(i).contents;
			if(testWin == 0) continue;
			foundWindow = _X11FindWindow(testWin, searchName);
			if(foundWindow) break;
		}
		
		XFree(children);
		return foundWindow;
	}
	
	/**
	 * Show appropriate dialogs for an integration error
	 */
	this.handleError = function(e, document) {
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
					
					if(!message && typeof(e) == "object") message = "\n\n"+e.toString();
					
					if(message != "\n\nExceptionAlreadyDisplayed") {
						displayError = Zotero.getString("integration.error.generic")+message;
					}
					Zotero.debug(e);
				}
				
				if(displayError) {
					if(document) {
						document.activate();
						document.displayAlert(displayError,
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
				Zotero.logError(e);
			}
		}
		
		this.complete(document);
	}
	
	/**
	 * Called when integration is complete
	 */
	this.complete = function(doc) {
		if(doc) {
			try {
				doc.cleanup();
				doc.activate();
				
				// Call complete function if one exists
				if(doc.wrappedJSObject && doc.wrappedJSObject.complete) {
					doc.wrappedJSObject.complete();
				}
			} catch(e) {
				Zotero.logError(e);
			}
		}
		
		if(Zotero.Integration.currentWindow && !Zotero.Integration.currentWindow.closed) {
			var oldWindow = Zotero.Integration.currentWindow;
			Zotero.setTimeout(function() {
				oldWindow.close();
			}, 100, true);
		}
		_inProgress = Zotero.Integration.currentWindow = false;
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
	
	/**
	 * Displays a dialog in a modal-like fashion without hanging the thread 
	 * @param {String} url The chrome:// URI of the window
	 * @param {String} [options] Options to pass to the window
	 * @param {String} [io] Data to pass to the window
	 * @param {Function|Boolean} [async] Function to call when window is closed. If not specified,
	 *     function waits to return until the window has been closed. If "true", the function returns
	 *     immediately.
	 */
	this.displayDialog = function(doc, url, options, io, async) {
		doc.cleanup();
		
		var allOptions = 'chrome,centerscreen';
		// without this, Firefox gets raised with our windows under Compiz
		if(Zotero.isLinux) allOptions += ',dialog=no';
		if(options) allOptions += ','+options;
		if(!async) allOptions += ',modal=yes';
		
		var window = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
			.getService(Components.interfaces.nsIWindowWatcher)
			.openWindow(null, url, '', allOptions, (io ? io : null));
		Zotero.Integration.currentWindow = window;
		Zotero.Integration.activate(window);
		
		var listener = function() {
			if(window.location.toString() === "about:blank") return;
			
			if(window.newWindow) {
				window = window.newWindow;
				Zotero.Integration.currentWindow = window;
				window.addEventListener("unload", listener, false);
				return;
			}
			
			Zotero.Integration.currentWindow = false;
			if(async instanceof Function) {
				try {
					async();
				} catch(e) {
					Zotero.Integration.handleError(e, doc);
				}
			}
		}
		window.addEventListener("unload", listener, false);
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

const INTEGRATION_TYPE_ITEM = 1;
const INTEGRATION_TYPE_BIBLIOGRAPHY = 2;
const INTEGRATION_TYPE_TEMP = 3;

// Placeholder for an empty bibliography
const BIBLIOGRAPHY_PLACEHOLDER = "{Bibliography}";

/**
 * All methods for interacting with a document
 * @constructor
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
	var session = Zotero.Integration.sessions[data.sessionID] = new Zotero.Integration.Session(this._doc);
	return session;
}

/**
 * Gets preferences for a document
 * @param require {Boolean} Whether an error should be thrown if no preferences or fields exist 
 *                          (otherwise, the set doc prefs dialog is shown)
 * @param dontRunSetDocPrefs {Boolean} Whether to show the Set Document Preferences window if no
 *                                     preferences exist
 */
Zotero.Integration.Document.prototype._getSession = function(require, dontRunSetDocPrefs, callback) {
	var dataString = this._doc.getDocumentData(),
		me = this;
	if(!dataString) {
		var haveFields = false;
		var data = new Zotero.Integration.DocumentData();
		
		if(require) {
			// check to see if fields already exist
			for each(var fieldType in [this._app.primaryFieldType, this._app.secondaryFieldType]) {
				var fields = this._doc.getFields(this._app.primaryFieldType);
				if(fields.hasMoreElements()) {
					data.prefs.fieldType = this._app.primaryFieldType;
					haveFields = true;
					break;
				}
			}
			
			// if no fields, throw an error
			if(!haveFields) {
				throw new Zotero.Integration.DisplayException("mustInsertCitation");
			} else {
				Zotero.debug("Integration: No document preferences found, but found "+data.prefs.fieldType+" fields");
			}
		}
		
		// Set doc prefs if no data string yet
		this._session = this._createNewSession(data);
		this._session.setData(data);
		if(dontRunSetDocPrefs) {
			callback(false);
			return;
		}
		
		this._session.setDocPrefs(this._doc, this._app.primaryFieldType, this._app.secondaryFieldType, function(status) {
			if(status === false) {
				throw new Zotero.Integration.UserCancelledException();
			}
			
			// save doc prefs in doc
			me._doc.setDocumentData(me._session.data.serializeXML());
			
			if(haveFields) {
				me._session.reload = true;
			}
			callback(true);
		});
	} else {
		var data = new Zotero.Integration.DocumentData(dataString);
		if(data.dataVersion < DATA_VERSION) {
			if(data.dataVersion == 1
					&& data.prefs.fieldType == "Field"
					&& this._app.primaryFieldType == "ReferenceMark") {
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
		
		if(data.prefs.fieldType !== this._app.primaryFieldType
				&& data.prefs.fieldType !== this._app.secondaryFieldType) {
			throw new Zotero.Integration.DisplayException("fieldTypeMismatch");
		}
		
		if(Zotero.Integration.sessions[data.sessionID]) {
			this._session = Zotero.Integration.sessions[data.sessionID];
		} else {
			this._session = this._createNewSession(data);
			try {
				this._session.setData(data);
			} catch(e) {
				// make sure style is defined
				if(e instanceof Zotero.Integration.DisplayException && e.name === "invalidStyle") {
					this._session.setDocPrefs(this._doc, this._app.primaryFieldType,
							this._app.secondaryFieldType, function() {
						me._doc.setDocumentData(me._session.data.serializeXML());
						me._session.reload = true;
						callback(true);
					});
					return;
				} else {
					throw e;
				}
			}
			
			this._doc.setDocumentData(this._session.data.serializeXML());
			this._session.reload = true;
		}
		callback(true);
	}
}

/**
 * Adds a citation to the current document.
 */
Zotero.Integration.Document.prototype.addCitation = function() {
	var me = this;
	this._getSession(false, false, function() {
		var fieldGetter = new Zotero.Integration.Fields(me._session, me._doc);
		fieldGetter.addEditCitation(null, function() {
			Zotero.Integration.complete(me._doc);
		});
	});
}
	
/**
 * Edits the citation at the cursor position.
 */
Zotero.Integration.Document.prototype.editCitation = function() {
	var me = this;
	this._getSession(true, false, function() {
		var field = me._doc.cursorInField(me._session.data.prefs['fieldType'])
		if(!field) {
			throw new Zotero.Integration.DisplayException("notInCitation");
		}
		
		var fieldGetter = new Zotero.Integration.Fields(me._session, me._doc);
		fieldGetter.addEditCitation(field, function() {
			Zotero.Integration.complete(me._doc);
		});
	});
}

/**
 * Adds a bibliography to the current document.
 */
Zotero.Integration.Document.prototype.addBibliography = function() {
	var me = this;
	this._getSession(true, false, function() {
		// Make sure we can have a bibliography
		if(!me._session.data.style.hasBibliography) {
			throw new Zotero.Integration.DisplayException("noBibliography");
		}
		
		var fieldGetter = new Zotero.Integration.Fields(me._session, me._doc),
			field = fieldGetter.addField();
		field.setCode("BIBL");
		fieldGetter.updateSession(function() {
			fieldGetter.updateDocument(FORCE_CITATIONS_FALSE, true, false, function() {
				Zotero.Integration.complete(me._doc);
			});
		});
	});
}

/**
 * Edits bibliography metadata.
 */
Zotero.Integration.Document.prototype.editBibliography = function(callback) {
	// Make sure we have a bibliography
	var me = this;
	this._getSession(true, false, function() {
		var fieldGetter = new Zotero.Integration.Fields(me._session, me._doc);
		fieldGetter.get(function(fields) {
			var haveBibliography = false;
			for(var i=fields.length-1; i>=0; i--) {
				var code = fields[i].getCode();
				var [type, content] = fieldGetter.getCodeTypeAndContent(code);
				if(type == INTEGRATION_TYPE_BIBLIOGRAPHY) {
					haveBibliography = true;
					break;
				}
			}
			
			if(!haveBibliography) {
				throw new Zotero.Integration.DisplayException("mustInsertBibliography");
			}
			
			fieldGetter.updateSession(function() {
				me._session.editBibliography(me._doc, function() {
					me._doc.activate();
					fieldGetter.updateDocument(FORCE_CITATIONS_FALSE, true, false, function() {
						Zotero.Integration.complete(me._doc);
					});
				});
			});
		});
	});
}

/**
 * Updates the citation data for all citations and bibliography entries.
 */
Zotero.Integration.Document.prototype.refresh = function() {
	var me = this;
	this._getSession(true, false, function() {
		// Send request, forcing update of citations and bibliography
		var fieldGetter = new Zotero.Integration.Fields(me._session, me._doc);
		fieldGetter.updateSession(function() {
			fieldGetter.updateDocument(FORCE_CITATIONS_REGENERATE, true, false, function() {
				Zotero.Integration.complete(me._doc);
			});
		});
	});
}

/**
 * Deletes field codes.
 */
Zotero.Integration.Document.prototype.removeCodes = function() {
	var me = this;
	this._getSession(true, false, function() {
		var fieldGetter = new Zotero.Integration.Fields(me._session, me._doc);
		fieldGetter.get(function(fields) {
			var result = me._doc.displayAlert(Zotero.getString("integration.removeCodesWarning"),
						Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_WARNING,
						Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK_CANCEL);
			if(result) {
				for(var i=fields.length-1; i>=0; i--) {
					fields[i].removeCode();
				}
			}
			
			Zotero.Integration.complete(me._doc);
		});
	});
}

/**
 * Displays a dialog to set document preferences (style, footnotes/endnotes, etc.)
 */
Zotero.Integration.Document.prototype.setDocPrefs = function() {
	var me = this;
	this._getSession(false, true, function(haveSession) {
		var setDocPrefs = function() {
			me._session.setDocPrefs(me._doc, me._app.primaryFieldType, me._app.secondaryFieldType,
			function(oldData) {
				if(oldData || oldData === null) {
					me._doc.setDocumentData(me._session.data.serializeXML());
					if(oldData === null) return;
					
					fieldGetter.get(function(fields) {
						if(fields && fields.length) {
							// if there are fields, we will have to convert some things; get a list of what we need to deal with
							var convertBibliographies = oldData === true || oldData.prefs.fieldType != me._session.data.prefs.fieldType;
							var convertItems = convertBibliographies || oldData.prefs.noteType != me._session.data.prefs.noteType;
							var fieldsToConvert = new Array();
							var fieldNoteTypes = new Array();
							for(var i=0, n=fields.length; i<n; i++) {
								var field = fields[i],
									fieldCode = field.getCode(),
									[type, content] = fieldGetter.getCodeTypeAndContent(fieldCode);
								
								if(convertItems && type === INTEGRATION_TYPE_ITEM) {
									var citation = me._session.unserializeCitation(fieldCode);
									if(!citation.properties.dontUpdate) {
										fieldsToConvert.push(field);
										fieldNoteTypes.push(me._session.data.prefs.noteType);
									}
								} else if(convertBibliographies && type === INTEGRATION_TYPE_BIBLIOGRAPHY) {
									fieldsToConvert.push(field);
									fieldNoteTypes.push(0);
								}
							}
							
							if(fieldsToConvert.length) {
								// pass to conversion function
								me._doc.convert(new Zotero.Integration.Document.JSEnumerator(fieldsToConvert),
									me._session.data.prefs.fieldType, fieldNoteTypes, fieldNoteTypes.length);
							}
							
							// refresh contents
							fieldGetter = new Zotero.Integration.Fields(me._session, me._doc);
							fieldGetter.updateSession(function() {
								fieldGetter.updateDocument(FORCE_CITATIONS_RESET_TEXT, true, true,
								function() {
									Zotero.Integration.complete(me._doc);
								});
							});
						} else {
							Zotero.Integration.complete(me._doc);
						}
					});
				} else {
					Zotero.Integration.complete(me._doc);
				}
			});
		};
		
		var fieldGetter = new Zotero.Integration.Fields(me._session, me._doc);
		
		if(!haveSession) {
			// This is a brand new document; don't try to get fields
			setDocPrefs();
		} else if(me._session.reload) {
			// Always reload before setDocPrefs so we can permit/deny unchecking storeReferences as
			// appropriate
			fieldGetter.updateSession(setDocPrefs);
		} else {
			// Can get fields while dialog is open
			fieldGetter.get();
			setDocPrefs();
		}
	});
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
 * Methods for retrieving fields from a document
 * @constructor
 */
Zotero.Integration.Fields = function(session, doc) {
	this._session = session;
	this._doc = doc;
	this._callbacks = [];
}

/**
 * Checks that it is appropriate to add fields to the current document at the current
 * positon, then adds one.
 */
Zotero.Integration.Fields.prototype.addField = function(note) {
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
 * Gets the type and content of a field object
 */
Zotero.Integration.Fields.prototype.getCodeTypeAndContent = function(rawCode) {
	for each(var code in ["ITEM", "CITATION"]) {
		if(rawCode.substr(0, code.length) === code) {
			return [INTEGRATION_TYPE_ITEM, rawCode.substr(code.length+1)];
		}
	}
	
	if(rawCode.substr(0, 4) === "BIBL") {
		return [INTEGRATION_TYPE_BIBLIOGRAPHY, rawCode.substr(5)];
	}
	
	if(rawCode.substr(0, 4) === "TEMP") {
		return [INTEGRATION_TYPE_TEMP, rawCode.substr(5)];
	}
	
	return [null, rawCode];
}

/**
 * Gets all fields for a document
 */
Zotero.Integration.Fields.prototype.get = function(callback) {
	if(this._fields) {
		try {
			if(callback) {
				callback(this._fields);
			}
		} catch(e) {
			Zotero.logError(e);
			Zotero.Integration.handleError(e, this._doc);
		}
		return;
	}
	
	if(callback) {
		this._callbacks.push(callback);
	}
	this._retrieveFields();
}

/**
 * Actually do the work of retrieving fields
 */
Zotero.Integration.Fields.prototype._retrieveFields = function() {
	if(this._retrievingFields) return;
	
	this._retrievingFields = true;
	var getFieldsTime = (new Date()).getTime();
	var me = this;
	this._doc.getFieldsAsync(this._session.data.prefs['fieldType'], {"observe":function(subject, topic, data) {
		if(topic === "fields-available") {
			if(me.progressCallback) me.progressCallback(75);
			
			// Add fields to fields array
			var fieldsEnumerator = subject.QueryInterface(Components.interfaces.nsISimpleEnumerator);
			var fields = me._fields = [];
			while(fieldsEnumerator.hasMoreElements()) {
				fields.push(fieldsEnumerator.getNext().QueryInterface(Components.interfaces.zoteroIntegrationField));
			}
			
			if(Zotero.Debug.enabled) {
				var endTime = (new Date()).getTime();
				Zotero.debug("Integration: Retrieved "+fields.length+" fields in "+
					(endTime-getFieldsTime)/1000+"; "+
					1000/((endTime-getFieldsTime)/fields.length)+" fields/second");
			}
			
			// Run callbacks
			try {
				for(var i=0, n=me._callbacks.length; i<n; i++) {
					me._callbacks[i](fields);
				}
			} catch(e) {
				Zotero.Integration.handleError(e, me._doc);
			}
		} else if(topic === "fields-progress" && me.progressCallback) {
			me.progressCallback((data ? parseInt(data, 10)*(3/4) : null));
		} else if(topic === "fields-error") {
			Zotero.logError(data);
			Zotero.Integration.handleError(data, me._doc);
		}
	}, QueryInterface:XPCOMUtils.generateQI([Components.interfaces.nsIObserver, Components.interfaces.nsISupports])});
}

/**
 * Shows an error if a field code is corrupted
 * @param {Exception} e The exception thrown
 * @param {Field} field The Zotero field object
 * @param {Integer} i The field index
 */
Zotero.Integration.Fields.prototype._showCorruptFieldError = function(e, field, callback, errorCallback, i) {
	Zotero.logError(e);
	
	var msg = Zotero.getString("integration.corruptField")+'\n\n'+
			  Zotero.getString('integration.corruptField.description');
	field.select();
	this._doc.activate();
	var result = this._doc.displayAlert(msg,
		Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_CAUTION, 
		Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_YES_NO_CANCEL);
	
	if(result == 0) {
		throw new Zotero.Integration.UserCancelledException;
	} else if(result == 1) {		// No
		this._removeCodeFields.push(i);
		return true;
	} else {
		// Display reselect edit citation dialog
		var me = this;
		var oldWindow = Zotero.Integration.currentWindow;
		this.addEditCitation(field, function() {
			Zotero.Integration.currentWindow.close();
			Zotero.Integration.currentWindow = oldWindow;
			me.updateSession(callback, errorCallback);
		});
		return false;
	}
}

/**
 * Updates Zotero.Integration.Session attached to Zotero.Integration.Fields in line with document
 */
Zotero.Integration.Fields.prototype.updateSession = function(callback, errorCallback) {
	var me = this;
	this.get(function(fields) {
		me._session.resetRequest(me._doc);
		
		me._deleteKeys = {};
		me._deleteFields = [];
		me._removeCodeFields = [];
		me._bibliographyFields = [];
		me._bibliographyData = "";
		
		var collectFieldsTime = (new Date()).getTime();
		me._processFields(fields, function() {
			var endTime = (new Date()).getTime();
			if(Zotero.Debug.enabled) {
				Zotero.debug("Integration: Updated session data for "+fields.length+" fields in "+
					(endTime-collectFieldsTime)/1000+"; "+
					1000/((endTime-collectFieldsTime)/fields.length)+" fields/second");
			}
			
			// load uncited items from bibliography
			if(me._bibliographyData && !me._session.bibliographyData) {
				try {
					me._session.loadBibliographyData(me._bibliographyData);
				} catch(e) {
					if(errorCallback) {
						errorCallback(e);
					} else if(e instanceof Zotero.Integration.CorruptFieldException) {
						var msg = Zotero.getString("integration.corruptBibliography")+'\n\n'+
								  Zotero.getString('integration.corruptBibliography.description');
						var result = me._doc.displayAlert(msg, 
									Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_CAUTION, 
									Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK_CANCEL);
						if(result == 0) {
							throw e;
						} else {
							me._bibliographyData = "";
							me._session.bibliographyHasChanged = true;
							me._session.bibliographyDataHasChanged = true;
						}
					} else {
						throw e;
					}
				}
			}
			
			// if we are reloading this session, assume no item IDs to be updated except for edited items
			if(me._session.reload) {
				//this._session.restoreProcessorState(); TODO doesn't appear to be working properly
				me._session.updateUpdateIndices();
				Zotero.pumpGenerator(me._session.updateCitations(function(deleteCitations) {
						me._deleteFields = me._deleteFields.concat([i for(i in deleteCitations)]);
						me._session.updateIndices = {};
						me._session.updateItemIDs = {};
						me._session.citationText = {};
						me._session.bibliographyHasChanged = false;
						delete me._session.reload;
						if(callback) callback(me._session);
					}));
			} else {
				if(callback) callback(me._session);
			}
		}, errorCallback);		
	});
}

/**
 * Keep processing fields until all have been processed
 */
Zotero.Integration.Fields.prototype._processFields = function(fields, callback, errorCallback, i) {
	if(!i) i = 0;
	
	for(var n = fields.length; i<n; i++) {
		var field = fields[i];
		
		try {
			var fieldCode = field.getCode();
		} catch(e) {
			if(!this._showCorruptFieldError(e, field, callback, errorCallback, i)) return;
		}
		
		var [type, content] = this.getCodeTypeAndContent(fieldCode);
		if(type === INTEGRATION_TYPE_ITEM) {
			var noteIndex = field.getNoteIndex();
			try {
				this._session.addCitation(i, noteIndex, content);
			} catch(e) {
				if(errorCallback) {
					errorCallback(e);
				} else if(e instanceof Zotero.Integration.MissingItemException) {
					// First, check if we've already decided to remove field codes from these
					var reselect = true;
					for each(var reselectKey in e.reselectKeys) {
						if(this._deleteKeys[reselectKey]) {
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
						this._doc.activate();
						var result = this._doc.displayAlert(msg, 1, 3);
						if(result == 0) {			// Cancel
							throw new Zotero.Integration.UserCancelledException();
						} else if(result == 1) {	// No
							for each(var reselectKey in e.reselectKeys) {
								this._deleteKeys[reselectKey] = true;
							}
							this._removeCodeFields.push(i);
						} else {					// Yes
							// Display reselect item dialog
							var me = this;
							var oldCurrentWindow = Zotero.Integration.currentWindow;
							this._session.reselectItem(this._doc, e, function() {
								// Now try again
								Zotero.Integration.currentWindow = oldCurrentWindow;
								me._doc.activate();
								me._processFields(fields, callback, errorCallback, i);
							});
							return;
						}
					}
				} else if(e instanceof Zotero.Integration.CorruptFieldException) {
					if(!this._showCorruptFieldError(e, field, callback, errorCallback, i)) return;
				} else {
					throw e;
				}
			}
		} else if(type === INTEGRATION_TYPE_BIBLIOGRAPHY) {
			this._bibliographyFields.push(field);
			if(!this._session.bibliographyData && !this._bibliographyData) {
				this._bibliographyData = content;
			}
		}
	}
	
	if(callback) callback();
}
/**
 * Updates bibliographies and fields within a document
 * @param {Boolean} forceCitations Whether to regenerate all citations
 * @param {Boolean} forceBibliography Whether to regenerate all bibliography entries
 * @param {Boolean} [ignoreCitationChanges] Whether to ignore changes to citations that have been 
 *	modified since they were created, instead of showing a warning
 */
Zotero.Integration.Fields.prototype.updateDocument = function(forceCitations, forceBibliography,
		ignoreCitationChanges, callback) {
	// update citations
	this._session.updateUpdateIndices(forceCitations);
	var me = this;
	var deleteCitations = Zotero.pumpGenerator(this._session.updateCitations(function(deleteCitations) {
		Zotero.pumpGenerator(me._updateDocument(forceCitations, forceBibliography,
			ignoreCitationChanges, deleteCitations, callback));
	}));
}

/**
 * Helper function to update bibliographys and fields within a document
 * @param {Boolean} forceCitations Whether to regenerate all citations
 * @param {Boolean} forceBibliography Whether to regenerate all bibliography entries
 * @param {Boolean} [ignoreCitationChanges] Whether to ignore changes to citations that have been 
 *	modified since they were created, instead of showing a warning
 */
Zotero.Integration.Fields.prototype._updateDocument = function(forceCitations, forceBibliography,
		ignoreCitationChanges, deleteCitations, callback) {
	try {
		// update citations
		this._deleteFields = this._deleteFields.concat([i for(i in deleteCitations)]);
		
		if(this.progressCallback) {
			var nFieldUpdates = [i for(i in this._session.updateIndices)].length;
			if(this._session.bibliographyHasChanged || forceBibliography) {
				nFieldUpdates += this._bibliographyFields.length*5;
			}
		}
		
		var nUpdated=0;
		for(var i in this._session.updateIndices) {
			if(this.progressCallback && nUpdated % 10 == 0) {
				this.progressCallback(75+(nUpdated/nFieldUpdates)*25);
				yield true;
			}
			
			var citation = this._session.citationsByIndex[i];
			var field = this._fields[i];
			
			// If there is no citation, we're deleting it, or we shouldn't update it, ignore it
			if(!citation || deleteCitations[i]) continue;
			
			if(!citation.properties.dontUpdate) {
				var isRich = false;
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
							field.select();
							var result = this._doc.displayAlert(
								Zotero.getString("integration.citationChanged")+"\n\n"+Zotero.getString("integration.citationChanged.description"), 
								Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_CAUTION, 
								Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_YES_NO);
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
				field.setCode(
					(this._session.data.prefs.storeReferences ? "ITEM CSL_CITATION" : "ITEM")
					+" "+fieldCode);
				
				if(this._session.data.prefs.fieldType === "ReferenceMark" && isRich
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
				for each(var field in bibliographyFields) {
					field.setCode("BIBL "+bibliographyData
						+(this._session.data.prefs.storeReferences ? " CSL_BIBLIOGRAPHY" : ""));
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
			for each(var field in bibliographyFields) {
				if(this.progressCallback) {
					this.progressCallback(75+(nUpdated/nFieldUpdates)*25);
					yield true;
				}
				
				if(bibliographyText) {
					field.setText(bibliographyText, true);
				} else {
					field.setText("{Bibliography}", false);
				}
				nUpdated += 5;
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
		
		if(callback) {
			callback();
		}
	} catch(e) {
		Zotero.Integration.handleError(e, this._doc);
	}
}

/**
 * Brings up the addCitationDialog, prepopulated if a citation is provided
 */
Zotero.Integration.Fields.prototype.addEditCitation = function(field, callback) {
	var newField, citation, fieldIndex, session = this._session, me = this, loadFirst;
	
	// if there's already a citation, make sure we have item IDs in addition to keys
	if(field) {
		try {
			var code = field.getCode();
		} catch(e) {}
		
		if(code) {
			[type, content] = this.getCodeTypeAndContent(code);
			if(type != INTEGRATION_TYPE_ITEM) {			
				throw new Zotero.Integration.DisplayException("notInCitation");
			}
			
			try {
				citation = session.unserializeCitation(content);
			} catch(e) {}
			
			if(citation) {
				try {
					session.lookupItems(citation);
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
					if(!this._doc.displayAlert(Zotero.getString("integration.citationChanged.edit"),
							Components.interfaces.zoteroIntegrationDocument.DIALOG_ICON_WARNING,
							Components.interfaces.zoteroIntegrationDocument.DIALOG_BUTTONS_OK_CANCEL)) {
						throw new Zotero.Integration.UserCancelledException;
					}
				}
				
				// make sure it's going to get updated
				delete citation.properties["formattedCitation"];
				delete citation.properties["plainCitation"];
				delete citation.properties["dontUpdate"];
			}
		}
	} else {
		newField = true;
		var field = this.addField(true);
		if(!field) return;
	}
	
	if(!citation) {
		field.setCode("TEMP");
		citation = {"citationItems":[], "properties":{}};
	}
	
	var io = new Zotero.Integration.CitationEditInterface(citation, field, this, session, newField, callback);
	
	if(Zotero.Prefs.get("integration.useClassicAddCitationDialog")) {
		Zotero.Integration.displayDialog(this._doc,
			'chrome://zotero/content/integration/addCitationDialog.xul', 'alwaysRaised,resizable',
			io, true);
	} else {
		var mode = (!Zotero.isMac && Zotero.Prefs.get('integration.keepAddCitationDialogRaised')
			? 'popup' : 'alwaysRaised')
		Zotero.Integration.displayDialog(this._doc,
			'chrome://zotero/content/integration/quickFormat.xul', mode, io, true);
	}
}

/**
 * Citation editing functions and propertiesaccessible to quickFormat.js and addCitationDialog.js
 */
Zotero.Integration.CitationEditInterface = function(citation, field, fields, session, deleteOnCancel, doneCallback) {
	this.citation = citation;
	this._field = field;
	this._fields = fields;
	this._session = session;
	this._deleteOnCancel = deleteOnCancel;
	this._doneCallback = doneCallback;
	
	this._sessionUpdated = false;
	this._sessionCallbackQueue = false;
	
	// Needed to make this work across boundaries
	this.wrappedJSObject = this;
	
	// Determine whether citation is sortable in current style
	this.sortable = session.style.opt.sort_citations;
	
	// Citeproc-js style object for use of third-party extension
	this.style = session.style;
	
	// Start getting citation data
	var me = this;
	fields.get(function(fields) {
		for(var i=0, n=fields.length; i<n; i++) {
			if(fields[i].equals(field)) {
				me._fieldIndex = i;
				return;
			}
		}
	});
}

Zotero.Integration.CitationEditInterface.prototype = {
	/**
	 * Run a function when the session information has been updated
	 * @param {Function} sessionUpdatedCallback
	 */
	"_runWhenSessionUpdated":function runWhenSessionUpdated(sessionUpdatedCallback) {
		if(this._sessionUpdated) {
			// session has been updated; run callback
			sessionUpdatedCallback();
		} else if(this._sessionCallbackQueue) {
			// session is being updated; add to queue
			this._sessionCallbackQueue.push(sessionUpdatedCallback);
		} else {
			// session is not yet updated; start update
			this._sessionCallbackQueue = [sessionUpdatedCallback];
			var me = this;
			me._fields.updateSession(function() {
				for(var i=0, n=me._sessionCallbackQueue.length; i<n; i++) {
					me._sessionCallbackQueue[i]();
				}
				me._sessionUpdated = true;
				delete me._sessionCallbackQueue;
			}, function(e) {
				if(e instanceof Zotero.Integration.MissingItemException
						|| e instanceof Zotero.Integration.CorruptFieldException) {
					me._errorOccurred = true;
				}
			});
		}
	},
	
	/**
	 * Execute a callback with a preview of the given citation
	 * @param {Function} previewCallback
	 */
	"preview":function preview(previewCallback) {
		var me = this;
		this._runWhenSessionUpdated(function() {
			me.citation.properties.zoteroIndex = me._fieldIndex;
			me.citation.properties.noteIndex = me._field.getNoteIndex();
			previewCallback(me._session.previewCitation(me.citation));
		});
	},
	
	/**
	 * Sort the citation
	 */
	"sort":function() {
		// Unlike above, we can do the previewing here without waiting for all the fields to load,
		// since they won't change the sorting (I don't think)
		this._session.previewCitation(this.citation);
	},
	
	/**
	 * Accept changes to the citation
	 * @param {Function} [progressCallback] A callback to be run when progress has changed.
	 *     Receives a number from 0 to 100 indicating current status.
	 */
	"accept":function(progressCallback) {
		var me = this;
		this._fields.progressCallback = progressCallback;
		
		if(this._errorOccurred) {
			// If an error occurred updating the session, update it again, this time letting the
			// error get displayed
			Zotero.setTimeout(function() {
				me._fields.updateSession(function() {
					me._errorOccurred = false;
					me.accept(progressCallback);
				})
			}, 0);
			return;
		}
		
		if(this.citation.citationItems.length) {
			// Citation 
			this._runWhenSessionUpdated(function() {
				me._session.addCitation(me._fieldIndex, me._field.getNoteIndex(), me.citation);
				me._session.updateIndices[me._fieldIndex] = true;
				
				if(!me._session.bibliographyHasChanged) {
					var citationItems = me.citation.citationItems;
					for(var i=0, n=citationItems.length; i<n; i++) {
						if(me._session.citationsByItemID[citationItems[i].itemID] &&
								me._session.citationsByItemID[citationItems[i].itemID].length == 1) {
							me._session.bibliographyHasChanged = true;
							break;
						}
					}
				}
				
				me._fields.updateDocument(FORCE_CITATIONS_FALSE, false, false, me._doneCallback);
			});
		} else {
			if(this._deleteOnCancel) this._field.delete();
			if(this._doneCallback) this._doneCallback();
		}
	},
	
	/**
	 * Get a list of items used in the current document
	 * @param {Function} [itemsCallback] A callback to be run with item objects when items have been
	 *      retrieved.
	 */
	"getItems":function(itemsCallback) {
		if(this._fieldIndex || Zotero.Utilities.isEmpty(this._session.citationsByItemID)) {
			// Either we already have field data for this run or we have no item data at all.
			// Update session before continuing.
			var me = this;
			this._runWhenSessionUpdated(function() { me._getItems(itemsCallback); });
		} else {
			// We have item data left over from a previous run with this document, so we don't need
			// to wait.
			this._getItems(itemsCallback);
		}
	},
	
	/**
	 * Helper function for getItems. Does the same thing, but this can assume that the session data
	 * has already been updated if it should be.
	 */
	"_getItems":function(itemsCallback) {
		var citationsByItemID = this._session.citationsByItemID;
		var ids = [itemID for(itemID in citationsByItemID)
			if(citationsByItemID[itemID] && citationsByItemID[itemID].length
				// Exclude this item
				&& (citationsByItemID[itemID].length > 1
					|| citationsByItemID[itemID][0].properties.zoteroIndex !== this._fieldIndex))];
		
		// Sort all previously cited items at top, and all items cited later at bottom
		var fieldIndex = this._fieldIndex;
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
		
		itemsCallback(Zotero.Cite.getItem(ids));
	}
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
 */
Zotero.Integration.Session.prototype.setData = function(data) {
	var oldStyle = (this.data && this.data.style ? this.data.style : false);
	this.data = data;
	if(data.style.styleID && (!oldStyle || oldStyle.styleID != data.style.styleID)) {
		this.styleID = data.style.styleID;
		try {
			var getStyle = Zotero.Styles.get(data.style.styleID);
			data.style.hasBibliography = getStyle.hasBibliography;
			this.style = getStyle.csl;
			this.style.setOutputFormat("rtf");
			this.styleClass = getStyle.class;
			this.dateModified = new Object();
		} catch(e) {
			Zotero.logError(e);
			data.style.styleID = undefined;
			throw new Zotero.Integration.DisplayException("invalidStyle");
		}
		
		return true;
	} else if(oldStyle) {
		data.style = oldStyle;
	}
	return false;
}

/**
 * Displays a dialog to set document preferences
 * @return {oldData|null|false} Old document data, if there was any; null, if there wasn't; false if cancelled
 */
Zotero.Integration.Session.prototype.setDocPrefs = function(doc, primaryFieldType, secondaryFieldType, callback) {
	var io = new function() {
		this.wrappedJSObject = this;
	};
	
	if(this.data) {
		io.style = this.data.style.styleID;
		io.useEndnotes = this.data.prefs.noteType == 0 ? 0 : this.data.prefs.noteType-1;
		io.fieldType = this.data.prefs.fieldType;
		io.primaryFieldType = primaryFieldType;
		io.secondaryFieldType = secondaryFieldType;
		io.storeReferences = this.data.prefs.storeReferences;
		io.requireStoreReferences = !Zotero.Utilities.isEmpty(this.embeddedItems);
	}
	
	var me = this;
	Zotero.Integration.displayDialog(doc,
		'chrome://zotero/content/integration/integrationDocPrefs.xul', '', io, function() {
		if(!io.style) {
			callback(false);
			return;
		}
		
		// set data
		var oldData = me.data;
		var data = new Zotero.Integration.DocumentData();
		data.sessionID = oldData.sessionID;
		data.style.styleID = io.style;
		data.prefs.fieldType = io.fieldType;
		data.prefs.storeReferences = io.storeReferences;
		me.setData(data);
		// need to do this after setting the data so that we know if it's a note style
		me.data.prefs.noteType = me.style && me.styleClass == "note" ? io.useEndnotes+1 : 0;
		
		if(!oldData || oldData.style.styleID != data.style.styleID
				|| oldData.prefs.noteType != data.prefs.noteType
				|| oldData.prefs.fieldType != data.prefs.fieldType) {
			// This will cause us to regenerate all citations
			me.oldCitationIDs = {};
		}
		
		callback(oldData ? oldData : null);
	});
}

/**
 * Reselects an item to replace a deleted item
 * @param exception {Zotero.Integration.MissingItemException}
 */
Zotero.Integration.Session.prototype.reselectItem = function(doc, exception, callback) {
	var io = new function() {
		this.wrappedJSObject = this;
	},
		me = this;
	io.addBorder = Zotero.isWin;
	io.singleSelection = true;
	
	Zotero.Integration.displayDialog(doc, 'chrome://zotero/content/selectItemsDialog.xul',
		'resizable', io, function() {
		if(io.dataOut && io.dataOut.length) {
			var itemID = io.dataOut[0];
			
			// add reselected item IDs to hash, so they can be used
			for each(var reselectKey in exception.reselectKeys) {
				me.reselectedItems[reselectKey] = itemID;
			}
			// add old URIs to map, so that they will be included
			if(exception.reselectKeyType == RESELECT_KEY_URI) {
				me.uriMap.add(itemID, exception.reselectKeys.concat(me.uriMap.getURIsForItemID(itemID)));
			}
			// flag for update
			me.updateItemIDs[itemID] = true;
		}
		
		callback();
	});
}

/**
 * Generates a field from a citation object
 */
Zotero.Integration.Session.prototype.getCitationField = function(citation) {
	const saveProperties = ["custom", "unsorted", "formattedCitation", "plainCitation", "dontUpdate"];
	const saveCitationItemKeys = ["locator", "label", "suppress-author", "author-only", "prefix",
		"suffix"];
	var addSchema = false;
	
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
			
			// always store itemData, since we have no way to get it back otherwise
			serializeCitationItem.itemData = citationItem.itemData;
			addSchema = true;
		} else {
			serializeCitationItem.id = citationItem.id;
			serializeCitationItem.uris = this.uriMap.getURIsForItemID(citationItem.id);
			
			// XXX For compatibility with older versions of Zotero; to be removed at a later date
			serializeCitationItem.uri = serializeCitationItem.uris;
		
			// add itemData only if requested
			if(this.data.prefs.storeReferences) {
				serializeCitationItem.itemData = citationItem.item;
				addSchema = true;
			}
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
	
	if(addSchema) {
		field.push('"schema":"https://github.com/citation-style-language/schema/raw/master/csl-citation.json"');
	}
	
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
	this.lookupItems(citation, index);
	
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
}

/**
 * Looks up item IDs to correspond with keys or generates embedded items for given citation object.
 * Throws a MissingItemException if item was not found.
 */
Zotero.Integration.Session.prototype.lookupItems = function(citation, index) {
	for(var i=0, n=citation.citationItems.length; i<n; i++) {
		var citationItem = citation.citationItems[i];
		
		// get Zotero item
		var zoteroItem = false;
		if(citationItem.cslItemID) {
			
		} else if(citationItem.uris) {
			[zoteroItem, needUpdate] = this.uriMap.getZoteroItemForURIs(citationItem.uris);
			if(needUpdate && index) this.updateIndices[index] = true;
		} else {
			if(citationItem.key) {
				zoteroItem = Zotero.Items.getByKey(citationItem.key);
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
			for each(var reselectKey in reselectKeys) {
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
			citationItem.id = zoteroItem.cslItemID ? zoteroItem.cslItemID : zoteroItem.id;
		}
	}
}

/**
 * Unserializes a JSON citation into a citation object (sans items)
 */
Zotero.Integration.Session.prototype.unserializeCitation = function(arg, index) {
	var firstBracket = arg.indexOf("{");
	if(firstBracket !== -1) {		// JSON field
		arg = arg.substr(firstBracket);
		
		// fix for corrupted fields
		var lastBracket = arg.lastIndexOf("}");
		if(lastBracket+1 != arg.length) {
			if(index) this.updateIndices[index] = true;
			arg = arg.substr(0, lastBracket+1);
		}
		
		// get JSON
		try {
			var citation = JSON.parse(arg);
		} catch(e) {
			// fix for corrupted fields (corrupted by Word, somehow)
			try {
				var citation = JSON.parse(arg.substr(0, arg.length-1));
			} catch(e) {
				// another fix for corrupted fields (corrupted by 2.1b1)
				try {
					var citation = JSON.parse(arg.replace(/{{((?:\s*,?"unsorted":(?:true|false)|\s*,?"custom":"(?:(?:\\")?[^"]*\s*)*")*)}}/, "{$1}"));
				} catch(e) {
					throw new Zotero.Integration.CorruptFieldException(arg);
				}
			}
		}
		
		// fix for uppercase citation codes
		if(citation.CITATIONITEMS) {
			if(index) this.updateIndices[index] = true;
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
		
		for each(var citationItem in citation.citationItems) {
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
		if(index) this.updateIndices[index] = true;
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
	if(oldCitation.citationID) delete this.citeprocCitationIDs[oldCitation.citationID];
	
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
Zotero.Integration.Session.prototype.updateCitations = function(callback) {
	try {
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
				this.citeprocCitationIDs[citation.citationID] = true;
				delete this.newIndices[index];
				yield true;
			}
		}
		
		/*if(allUpdatesForced) {
			this.newIndices = {};
			this.updateIndices = {};
		}*/
		
		callback(deleteCitations);
	} catch(e) {
		Zotero.Integration.handleError(e, this._doc);
	}
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
			for each(var uris in documentData.uncited) {
				[zoteroItem, needUpdate] = this.uriMap.getZoteroItemForURIs(uris);
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
				
				var id = zoteroItem.cslItemID ? zoteroItem.cslItemID : zoteroItem.id;
				if(this.citationsByItemID[id] || this.uncitedItems[id]) {
					this.customBibliographyText[id] = custom[1];
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
		return JSON.stringify(bibliographyData);
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
		throw e;
	}
}

/**
 * Edits integration bibliography
 */
Zotero.Integration.Session.prototype.editBibliography = function(doc, callback) {
	var bibliographyEditor = new Zotero.Integration.Session.BibliographyEditInterface(this);
	var io = new function() { this.wrappedJSObject = bibliographyEditor; }
	
	this.bibliographyDataHasChanged = this.bibliographyHasChanged = true;
	
	Zotero.Integration.displayDialog(doc,
		'chrome://zotero/content/integration/editBibliographyDialog.xul', 'resizable', io,
		callback);
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
	var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
			.createInstance(Components.interfaces.nsIDOMParser);
	var doc = parser.parseFromString("<data/>", "application/xml");
	
	var xmlData = doc.documentElement;
	xmlData.setAttribute("data-version", DATA_VERSION);
	xmlData.setAttribute("zotero-version", Zotero.version);
	
	var session = doc.createElement("session");
	session.setAttribute("id", this.sessionID);
	xmlData.appendChild(session);
	
	var style = doc.createElement("style");
	style.setAttribute("id", this.style.styleID);
	style.setAttribute("hasBibliography", this.style.hasBibliography ? 1 : 0);
	style.setAttribute("bibliographyStyleHasBeenSet", this.style.bibliographyStyleHasBeenSet ? 1 : 0);
	xmlData.appendChild(style);
	
	var prefs = doc.createElement("prefs");
	for(var pref in this.prefs) {
		var prefXML = doc.createElement("pref");
		prefXML.setAttribute("name", pref);
		prefXML.setAttribute("value", this.prefs[pref]);
		prefs.appendChild(prefXML);
	}
	xmlData.appendChild(prefs);
	
	var domSerializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
			.createInstance(Components.interfaces.nsIDOMSerializer);
	return domSerializer.serializeToString(doc);
};


/**
 * Unserializes document-specific XML
 */
Zotero.Integration.DocumentData.prototype.unserializeXML = function(xmlData) {
	Components.classes["@mozilla.org/xul/xul-document;1"].getService(Components.interfaces.nsIDOMDocument)  
	var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
			.createInstance(Components.interfaces.nsIDOMParser);
	xmlData = parser.parseFromString(xmlData, "application/xml").documentElement;
	
	this.sessionID = Zotero.Utilities.xpathText(xmlData, "session/@id");
	this.style = {
		"styleID":Zotero.Utilities.xpathText(xmlData, "style/@id"),
		"hasBibliography":(Zotero.Utilities.xpathText(xmlData, "style/@hasBibliography") == "1"),
		"bibliographyStyleHasBeenSet":(Zotero.Utilities.xpathText(xmlData, "style/@bibliographyStyleHasBeenSet") == "1")
	};
	this.prefs = {};
	for each(var pref in Zotero.Utilities.xpath(xmlData, "prefs/pref")) {
		var name = pref.getAttribute("name");
		var value = pref.getAttribute("value");
		if(value === "true") {
			value = true;
		} else if(value === "false") {
			value = false;
		}
		
		this.prefs[name] = value;
	}
	if(this.prefs["storeReferences"] === undefined) this.prefs["storeReferences"] = false;
	this.zoteroVersion = xmlData.getAttribute("zotero-version");
	if(!this.zoteroVersion) this.zoteroVersion = "2.0";
	this.dataVersion = xmlData.getAttribute("data-version");
	if(!this.dataVersion) this.dataVersion = 2;
};

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
		this.prefs = {"fieldType":((prefParameters[5] == "1" || prefParameters[5] == "True") ? "Bookmark" : "Field"),
			"storeReferences":false};
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
Zotero.Integration.URIMap.prototype.getZoteroItemForURIs = function(uris) {
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
			zoteroItem = Zotero.URI.getURIItem(uri);
			if(zoteroItem) {
				// Ignore items in the trash
				if(zoteroItem.deleted) {
					zoteroItem = false;
				} else {
					break;
				}
			}
		} catch(e) {}
		
		// Try merged item mappings
		var seen = [];
		
		// Follow merged item relations until we find an item or hit a dead end
		while (!zoteroItem) {
			var relations = Zotero.Relations.getByURIs(uri, Zotero.Relations.deletedItemPredicate);
			// No merged items found
			if(!relations.length) {
				break;
			}
			
			uri = relations[0].object;
			
			// Keep track of mapped URIs in case there's a circular relation
			if(seen.indexOf(uri) != -1) {
				var msg = "Circular relation for '" + uri + "' in merged item mapping resolution";
				Zotero.debug(msg, 2);
				Components.utils.reportError(msg);
				break;
			}
			seen.push(uri);
			
			try {
				zoteroItem = Zotero.URI.getURIItem(uri);
				if(zoteroItem) {
					// Ignore items in the trash
					if(zoteroItem.deleted) {
						zoteroItem = false;
					} else {
						break;
					}
				}
			} catch(e) {}
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
}
