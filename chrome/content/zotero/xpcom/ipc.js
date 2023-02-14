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
		
		// make new pipe
		new Zotero.IPC.Pipe.DeferredOpen(file, callback);
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
	this.remove = function(pipe, file) {
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
	Zotero.addShutdownListener(Zotero.IPC.Pipe.remove.bind(null, this, file));
}

Zotero.IPC.Pipe.DeferredOpen.prototype = {
	"onStartRequest":function() {},
	"onStopRequest":function() {},
	onDataAvailable: function (request, inputStream, offset, count) {
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