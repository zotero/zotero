/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
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

Zotero.IPC = new function() {
	var _libc, _libcPath, _instancePipe, _user32, open, write, close;
	
	/**
	 * Initialize pipe for communication with connector
	 */
	this.init = function() {
		if(!Zotero.isWin) {	// no pipe support on Fx 3.6
			_instancePipe = _getPipeDirectory();
			if(!_instancePipe.exists()) {
				_instancePipe.create(Ci.nsIFile.DIRECTORY_TYPE, 0o700);
			}
			_instancePipe.append(Zotero.instanceID);
			
			Zotero.IPC.Pipe.initPipeListener(_instancePipe, this.parsePipeInput);
		}
	}
	
	/**
	 * Parses input received via instance pipe
	 */
	this.parsePipeInput = function(msgs) {
		for (let msg of msgs.split("\n")) {
			if(!msg) continue;
			Zotero.debug('IPC: Received "'+msg+'"');
			
			/*
			 * The below messages coordinate switching Zotero for Firefox from extension mode to
			 * connector mode without restarting after Zotero Standalone has been launched. The
			 * dance typically proceeds as follows:
			 *
			 * 1. SA sends a releaseLock message to Z4Fx that tells it to release its lock.
			 * 2. Z4Fx releases its lock and sends a lockReleased message to SA.
			 * 3. Z4Fx restarts in connector mode. Once it's ready for an IPC command, it sends
			 *    a checkInitComplete message to SA.
			 * 4. Once SA finishes initializing, or immediately after a checkInitComplete message
			 *    has been received if it is already initialized, SA sends an initComplete message 
			 *    to Z4Fx.
			 */
			if(msg.substr(0, 11) === "releaseLock") {
				// Standalone sends this to the Firefox extension to tell the Firefox extension to
				// release its lock on the Zotero database
				if(!Zotero.isConnector && (msg.length === 11 ||
						msg.substr(12) === Zotero.DataDirectory.getDatabase())) {
					switchConnectorMode(true);
				}
			} else if(msg === "lockReleased") {
				// The Firefox extension sends this to Standalone to let Standalone know that it has
				// released its lock
				Zotero.onDBLockReleased();
			} else if(msg === "checkInitComplete") {
				// The Firefox extension sends this to Standalone to tell Standalone to send an
				// initComplete message when it is fully initialized
				if(Zotero.initialized) {
					Zotero.IPC.broadcast("initComplete");
				} else {
					var observerService = Components.classes["@mozilla.org/observer-service;1"]
						.getService(Components.interfaces.nsIObserverService);
					var _loadObserver = function() {
						Zotero.IPC.broadcast("initComplete");
						observerService.removeObserver(_loadObserver, "zotero-loaded");
					};
					observerService.addObserver(_loadObserver, "zotero-loaded", false);
				}
			} else if(msg === "initComplete") {
				// Standalone sends this to the Firefox extension to let the Firefox extension
				// know that Standalone has fully initialized and it should pull the list of
				// translators
				Zotero.initComplete();
			}
			else if (msg == "reinit") {
				if (Zotero.isConnector) {
					reinit(false, true);
				}
			}
		}
	}
	
	/**
	 * Writes safely to a file, avoiding blocking.
	 * @param {nsIFile} pipe The pipe as an nsIFile.
	 * @param {String} string The string to write to the file.
	 * @param {Boolean} [block] Whether we should block. Usually, we don't want this.
	 * @return {Boolean} True if write succeeded; false otherwise
	 */
	this.safePipeWrite = function(pipe, string, block) {
		if(!open) {
			// safely write to instance pipes
			var lib = Zotero.IPC.getLibc();
			if(!lib) return false;
			
			// int open(const char *path, int oflag);
			open = lib.declare("open", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.int);
			// ssize_t write(int fildes, const void *buf, size_t nbyte);
			write = lib.declare("write", ctypes.default_abi, ctypes.ssize_t, ctypes.int, ctypes.char.ptr, ctypes.size_t);
			// int close(int filedes);
			close = lib.declare("close", ctypes.default_abi, ctypes.int, ctypes.int);
		}
		
		// On OS X and FreeBSD, O_NONBLOCK = 0x0004
		// On Linux, O_NONBLOCK = 00004000
		// On both, O_WRONLY = 0x0001
		var mode = 0x0001;
		if(!block) mode = mode | (Zotero.isLinux ? 0o0004000 : 0x0004);
		
		var fd = open(pipe.path, mode);
		if(fd === -1) return false;			
		write(fd, string, string.length);
		close(fd);
		return true;
	}
	
	/**
	 * Broadcast a message to all other Zotero instances
	 */
	this.broadcast = function(msg) {
		if(Zotero.isWin) {		// communicate via WM_COPYDATA method
			Components.utils.import("resource://gre/modules/ctypes.jsm");
			
			// communicate via message window
			var user32 = ctypes.open("user32.dll");
			
			/* http://msdn.microsoft.com/en-us/library/ms633499%28v=vs.85%29.aspx
			 * HWND WINAPI FindWindow(
			 *   __in_opt  LPCTSTR lpClassName,
			 *   __in_opt  LPCTSTR lpWindowName
			 * );
			 */
			var FindWindow = user32.declare("FindWindowW", ctypes.winapi_abi, ctypes.int32_t,
					ctypes.jschar.ptr, ctypes.jschar.ptr);
			
			/* http://msdn.microsoft.com/en-us/library/ms633539%28v=vs.85%29.aspx
			 * BOOL WINAPI SetForegroundWindow(
			 *   __in  HWND hWnd
			 * );
			 */
			var SetForegroundWindow = user32.declare("SetForegroundWindow", ctypes.winapi_abi,
					ctypes.bool, ctypes.int32_t);
			
			/*
			 * LRESULT WINAPI SendMessage(
			 *   __in  HWND hWnd,
			 *   __in  UINT Msg,
			 *   __in  WPARAM wParam,
			 *   __in  LPARAM lParam
			 * );
			 */
			var SendMessage = user32.declare("SendMessageW", ctypes.winapi_abi, ctypes.uintptr_t,
					ctypes.int32_t, ctypes.unsigned_int, ctypes.voidptr_t, ctypes.voidptr_t);
			
			/* http://msdn.microsoft.com/en-us/library/ms649010%28v=vs.85%29.aspx
			 * typedef struct tagCOPYDATASTRUCT {
			 *   ULONG_PTR dwData;
			 *   DWORD     cbData;
			 *   PVOID     lpData;
			 * } COPYDATASTRUCT, *PCOPYDATASTRUCT;
			 */
			var COPYDATASTRUCT = ctypes.StructType("COPYDATASTRUCT", [
					{"dwData":ctypes.voidptr_t},
					{"cbData":ctypes.uint32_t},
					{"lpData":ctypes.voidptr_t}
			]);
			
			// Aurora/Nightly are always named "Firefox" in
			// application.ini
			const appNames = ["Firefox", "Zotero"];
			
			// Different from Zotero.appName; this corresponds to the
			// name in application.ini
			const myAppName = Services.appinfo.name;

			for (let appName of appNames) {
				// don't send messages to ourself
				if(appName === myAppName) continue;
				
				var thWnd = FindWindow(appName+"MessageWindow", null);
				if(thWnd) {
					Zotero.debug('IPC: Broadcasting "'+msg+'" to window "'+appName+'MessageWindow"');
					
					// allocate message
					var data = ctypes.char.array()('firefox.exe -silent -ZoteroIPC "'+msg.replace('"', '""', "g")+'"\x00C:\\');
					var dataSize = data.length*data.constructor.size;
					
					// create new COPYDATASTRUCT
					var cds = new COPYDATASTRUCT();
					cds.dwData = null;
					cds.cbData = dataSize;
					cds.lpData = data.address();
					
					// send COPYDATASTRUCT
					var success = SendMessage(thWnd, 0x004A /** WM_COPYDATA **/, null, cds.address());
					
					user32.close();
					return !!success;
				}
			}
			
			user32.close();
			return false;
		} else {			// communicate via pipes
			// look for other Zotero instances
			var pipes = [];
			var pipeDir = _getPipeDirectory();
			if(pipeDir.exists()) {
				var dirEntries = pipeDir.directoryEntries;
				while (dirEntries.hasMoreElements()) {
					var pipe = dirEntries.getNext().QueryInterface(Ci.nsIFile);
					if(pipe.leafName[0] !== "." && (!_instancePipe || !pipe.equals(_instancePipe))) {
						pipes.push(pipe);
					}
				}
			}
			
			if(!pipes.length) return false;
			var success = false;
			for (let pipe of pipes) {
				Zotero.debug('IPC: Trying to broadcast "'+msg+'" to instance '+pipe.leafName);
				
				var defunct = false;
				
				if(pipe.isFile()) {
					// not actually a pipe
					if(pipe.isDirectory()) {
						// not a file, so definitely defunct
						defunct = true;
					} else {
						// check to see whether the size exceeds a certain threshold that we find
						// reasonable for the queue, and if not, delete the pipe, because it's 
						// probably just a file that wasn't deleted on shutdown and is now
						// accumulating vast amounts of data
						defunct = pipe.fileSize > 1024;
					}
				}
				
				if(!defunct) {
					// Try to write to the pipe for 100 ms
					var time = Date.now(), timeout = time+100, wroteToPipe;
					do {
						wroteToPipe = Zotero.IPC.safePipeWrite(pipe, msg+"\n");
					} while(Date.now() < timeout && !wroteToPipe);
					if (wroteToPipe) Zotero.debug('IPC: Pipe took '+(Date.now()-time)+' ms to become available');
					success = success || wroteToPipe;
					defunct = !wroteToPipe;
				}
				
				if(defunct) {
					Zotero.debug('IPC: Removing defunct pipe '+pipe.leafName);
					try {
						pipe.remove(true);
					} catch(e) {};
				}
			}
			
			return success;
		}
	}
	
	/**
	 * Get directory containing Zotero pipes
	 */
	function _getPipeDirectory() {
		var dir = Zotero.File.pathToFile(Zotero.DataDirectory.dir);
		dir.append("pipes");
		return dir;
	}
	
	this.pipeExists = Zotero.Promise.coroutine(function* () {
		var dir = _getPipeDirectory().path;
		return (yield OS.File.exists(dir)) && !(yield Zotero.File.directoryIsEmpty(dir));
	});
	
	/**
	 * Gets the path to libc as a string
	 */
	this.getLibcPath = function() {
		if(_libcPath) return _libcPath;
		
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
			var libPath = possibleLibcs.shift();
			try {
				var lib = ctypes.open(libPath);
				break;
			} catch(e) {}
		}
	
		// throw appropriate error on failure
		if(!lib) {
			Components.utils.reportError("Zotero: libc could not be loaded. Word processor integration "+
				"and other functionality will not be available. Please post on the Zotero Forums so we "+
				"can add support for your operating system.");
			return;
		}
		
		_libc = lib;	
		_libcPath = libPath;
		return libPath;
	}

	/**
	 * Gets standard C library via ctypes
	 */
	this.getLibc = function() {
		if(!_libc) this.getLibcPath();
		return _libc;
	}
}

/**
 * Methods for reading from and writing to a pipe
 */
Zotero.IPC.Pipe = new function() {
	var _mkfifo, _pipeClass;
	
	/**
	 * Creates and listens on a pipe
	 *
	 * @param {nsIFile} file The location where the pipe should be created
	 * @param {Function} callback A function to be passed any data received on the pipe
	 */
	this.initPipeListener = function(file, callback) {
		Zotero.debug("IPC: Initializing pipe at "+file.path);
		
		// determine type of pipe
		if(!_pipeClass) {
			var verComp = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
				.getService(Components.interfaces.nsIVersionComparator);
			var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].
				getService(Components.interfaces.nsIXULAppInfo);
			if(verComp.compare("2.2a1pre", appInfo.platformVersion) <= 0) {			// Gecko 5
				_pipeClass = Zotero.IPC.Pipe.DeferredOpen;
			}
		}
		
		// make new pipe
		new _pipeClass(file, callback);
	}
	
	/**
	 * Makes a fifo
	 * @param {nsIFile}		file		Location to create the fifo
	 */
	this.mkfifo = function(file) {
		// int mkfifo(const char *path, mode_t mode);
		if(!_mkfifo) {
			var libc = Zotero.IPC.getLibc();
			if(!libc) return false;
			_mkfifo = libc.declare("mkfifo", ctypes.default_abi, ctypes.int, ctypes.char.ptr, ctypes.unsigned_int);
		}
		
		// make pipe
		var ret = _mkfifo(file.path, 0o600);
		return file.exists();
	}
	
	/**
	 * Adds a shutdown listener for a pipe that writes "Zotero shutdown\n" to the pipe and then
	 * deletes it
	 */
	this.writeShutdownMessage = function(pipe, file) {
		// Make sure pipe actually exists
		if(!file.exists()) {
			Zotero.debug("IPC: Not closing pipe "+file.path+": already deleted");
			return;
		}
		
		// Keep trying to write to pipe until we succeed, in case pipe is not yet open
		Zotero.debug("IPC: Closing pipe "+file.path);
		Zotero.IPC.safePipeWrite(file, "Zotero shutdown\n");
		
		// Delete pipe
		file.remove(false);
	}
}

/**
 * Listens asynchronously for data on the integration pipe and reads it when available
 * 
 * Used to read from pipe on Gecko 5+
 */
Zotero.IPC.Pipe.DeferredOpen = function(file, callback) {
	this._file = file;
	this._callback = callback;
	
	if(!Zotero.IPC.Pipe.mkfifo(file)) return;
	
	this._initPump();
	
	// add shutdown listener
	Zotero.addShutdownListener(Zotero.IPC.Pipe.writeShutdownMessage.bind(null, this, file));
}

Zotero.IPC.Pipe.DeferredOpen.prototype = {
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
		
		if(out.value === "Zotero shutdown\n") return
		
		this._initPump();
		this._callback(out.value);
	},
	
	/**
	 * Initializes the nsIInputStream and nsIInputStreamPump to read from _fifoFile
	 *
	 * Used after reading from file on Gecko 5+
	 */
	"_initPump":function() {
		var fifoStream = Components.classes["@mozilla.org/network/file-input-stream;1"].
			createInstance(Components.interfaces.nsIFileInputStream);
		fifoStream.QueryInterface(Components.interfaces.nsIFileInputStream);
		// 16 = open as deferred so that we don't block on open
		fifoStream.init(this._file, -1, 0, 16);
		
		var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"].
			createInstance(Components.interfaces.nsIInputStreamPump);
		try {
			pump.init(fifoStream, 0, 0, true);
		}
		catch (e) {
			pump.init(fifoStream, -1, -1, 4096, 1, true);
		}
		pump.asyncRead(this, null);
		
		this._openTime = Date.now();
	}
};