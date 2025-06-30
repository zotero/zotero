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

const ArrayBufferInputStream = Components.Constructor(
	"@mozilla.org/io/arraybuffer-input-stream;1",
	"nsIArrayBufferInputStream"
);
const BinaryInputStream = Components.Constructor(
	"@mozilla.org/binaryinputstream;1",
	"nsIBinaryInputStream",
	"setInputStream"
);
const StorageStream = Components.Constructor(
	"@mozilla.org/storagestream;1",
	"nsIStorageStream",
	"init"
);
const BufferedOutputStream = Components.Constructor(
	"@mozilla.org/network/buffered-output-stream;1",
	"nsIBufferedOutputStream",
	"init"
);

Zotero.MIMETypeHandler = new function () {
	var _typeHandlers, _ignoreContentDispositionTypes, _observers;

	/**
	 * Registers nsIObserver to handle MIME types
	 */
	this.init = function () {
		Zotero.debug("Registering nsIObserver");
		// register our nsIObserver
		Components.classes["@mozilla.org/observer-service;1"].
			getService(Components.interfaces.nsIObserverService).
			addObserver(_Observer, "http-on-examine-response", false);
		this.initializeHandlers();
		Zotero.addShutdownListener(function () {
			Components.classes["@mozilla.org/observer-service;1"].
				getService(Components.interfaces.nsIObserverService).
				removeObserver(_Observer, "http-on-examine-response", false);
		});
	}
	
	/**
	 * Initializes handlers for MIME types
	 */
	this.initializeHandlers = function () {
		_typeHandlers = {};
		_ignoreContentDispositionTypes = new Set();
		_observers = [];
		
		// Install styles from the Cite preferences
		this.addHandlers("application/vnd.citationstyles.style+xml", {
			onContent: async function (blob, origin) {
				let win = Services.wm.getMostRecentWindow("zotero:basicViewer");
				var data = await Zotero.Utilities.Internal.blobToText(blob);
				try {
					await Zotero.Styles.install(data, origin, true);
					// Close styles page in basic viewer after installing a style
					win?.close();
					return true;
				}
				catch (e) {
					Zotero.logError(e);
					(new Zotero.Exception.Alert("styles.install.unexpectedError",
						origin, "styles.install.title", e)).present();
				}
				return false;
			}
		}, true);
	};
	
	/**
	 * Adds a handler to handle a specific MIME type
	 * @param {String} type MIME type to handle
	 * @param {Object} handlers
	 * 	- handlers.onContent - function to call when content is received
	 * 	- handlers.onStartRequest - function to call when response for content type is first received
	 * @param {Boolean} ignoreContentDisposition If true, ignores the Content-Disposition header,
	 *	which is often used to force a file to download rather than let it be handled by the web
	 *	browser
	 */
	this.addHandlers = function (type, handlers, ignoreContentDisposition) {
		if (typeof handlers == 'function') {
			handlers = {
				onContent: handlers
			};
			Zotero.debug('MIMETypeHandler.addHandler: second parameter function is deprecated. Pass an object', 1)
		}
		if (_typeHandlers[type]) {
			_typeHandlers[type].push(handlers);
		}
		else {
			_typeHandlers[type] = [handlers];
		}
		if (ignoreContentDisposition) {
			_ignoreContentDispositionTypes.add(type);
		}
	};
	
	/**
	 * Removes a handler for a specific MIME type
	 * @param {String} type MIME type to handle
	 * @param {Object} handlers Function handlers to remove
	 */
	this.removeHandlers = function (type, handlers) {
		// If no handler specified or this is the last handler for the type
		// stop monitoring the content type completely.
		if (!handlers || _typeHandlers[type] && _typeHandlers[type].length <= 1) {
			delete _typeHandlers[type];
			_ignoreContentDispositionTypes.delete(type);
		}
		else if (_typeHandlers[type]) {
			var i = _typeHandlers[type].indexOf(handlers);
			if (i != -1) {
				_typeHandlers[type].splice(i, 1);
			}
		}
	};
	
	/**
	 * Adds an observer to inspect and possibly modify page headers
	 */
	this.addObserver = function (fn) {
		_observers.push(fn);
	}
	
	
	/**
	 * Called to observe a page load
	 */
	var _Observer = {
		observe(channel) {
			channel.QueryInterface(Components.interfaces.nsIRequest);
			// https://searchfox.org/mozilla-esr102/rev/f78d456e055a41106be086c501b271385a973961/netwerk/base/nsIChannel.idl#209-211
			if (!channel.isDocument) {
				return;
			}
			channel.QueryInterface(Components.interfaces.nsIHttpChannel);
			channel.QueryInterface(Components.interfaces.nsITraceableChannel);

			try {
				// Get the main directive of the Content-Type header
				// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type#syntax
				var contentType = channel.getResponseHeader("Content-Type").split(';')[0].toLowerCase();
				// remove content-disposition headers for EndNote, etc.
				for (let handledType of _ignoreContentDispositionTypes) {
					if (contentType.startsWith(handledType)) {
						channel.setResponseHeader("Content-Disposition", "inline", false);
						break;
					}
				}
			}
			catch (e) {
				// getResponseHeader() throws if header is not set; ignore
			}
			
			try {
				if (contentType && _typeHandlers[contentType]) {
					// Replace listener entirely
					// #setNewListener() contract wants us to pass through events to the original (eventually),
					// but we will not
					let originalListener = channel.setNewListener(new _StreamListener(channel, contentType));
					// Make it look like the connection ended, so the original listener can clean up
					originalListener.onStopRequest(channel, Cr.NS_BINDING_ABORTED);
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
			
			for (let observer of _observers) {
				try {
					observer(channel);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
		}
	};
		
	/**
	 * @class _StreamListener Implements nsIStreamListener and nsIRequestObserver interfaces to download MIME types
	 * 	we've registered ourself as the handler for
	 * @param {nsIRequest} request The request to handle
	 * @param {String} contenType The content type being handled
	 */
	var _StreamListener = function (request, contentType) {
		this._request = request;
		this._contentType = contentType;
	}
	
	/**
	 * Standard QI definition
	 */
	_StreamListener.prototype.QueryInterface = function (iid) {
		if (iid.equals(Components.interfaces.nsISupports)
		   || iid.equals(Components.interfaces.nsIRequestObserver)
		   || iid.equals(Components.interfaces.nsIStreamListener)) {
			return this;
		}
		throw Components.results.NS_ERROR_NO_INTERFACE;
	}
	
	_StreamListener.prototype.onStartRequest = async function (channel) {
		this._onStartRequestCalled = true;
		this._dataBuffer = new StorageStream(4096, 0xffffffff);
		this._stream = new BufferedOutputStream(this._dataBuffer.getOutputStream(0), 8192);
		
		try {
			if (!_typeHandlers[this._contentType]) return;
			for (let handlers of _typeHandlers[this._contentType]) {
				if (!handlers.onStartRequest) continue;
				let maybePromise = handlers.onStartRequest(
					this._request.name ? this._request.name : null,
					this._contentType,
					channel
				);
				if (maybePromise && maybePromise.then) {
					maybePromise = await maybePromise;
				}
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	
	_StreamListener.prototype.onDataAvailable = async function (channel, inputStream, offset, count) {
		if (!this._onStartRequestCalled) {
			await this.onStartRequest(channel);
		}
		
		this._stream.writeFrom(inputStream, count);
	};
	
	/**
	 * Called when the request is done
	 */
	_StreamListener.prototype.onStopRequest = async function (channel, statusCode) {
		if (!this._onStartRequestCalled) {
			await this.onStartRequest(channel);
		}

		Zotero.debug("charset is " + channel.contentCharset);
		
		this._stream.close();
		this._stream = null;

		if (!Components.isSuccessCode(statusCode)) {
			throw Components.Exception('Failed to load', statusCode);
		}

		let stream = new BinaryInputStream(this._dataBuffer.newInputStream(0));
		let buffer = new ArrayBuffer(this._dataBuffer.length);
		stream.readArrayBuffer(buffer.byteLength, buffer);
		let blob = new Blob([buffer], { type: this._contentType });
		
		var handled = false;
		try {
			if (!_typeHandlers[this._contentType]) return;
			for (let handlers of _typeHandlers[this._contentType]) {
				if (!handlers.onContent) continue;
				let maybePromise = handlers.onContent(
					blob,
					this._request.name ? this._request.name : null,
					this._contentType,
					channel
				);
				if (maybePromise && maybePromise.then) {
					maybePromise = await maybePromise;
				}
				handled = handled || maybePromise;
				if (handled) break;
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		
		if (!handled) {
			// Handle using nsIExternalHelperAppService
			let externalHelperAppService = Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"]
				.getService(Components.interfaces.nsIExternalHelperAppService);
			let frontWindow = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
				.getService(Components.interfaces.nsIWindowWatcher).activeWindow;
			
			let inputStream = new ArrayBufferInputStream();
			inputStream.setData(buffer, 0, buffer.byteLength);
			let streamListener = externalHelperAppService.doContent(
				this._contentType, this._request, frontWindow, null
			);
			if (streamListener) {
				streamListener.onStartRequest(channel);
				streamListener.onDataAvailable(
					this._request, inputStream, 0, buffer.byteLength
				);
				streamListener.onStopRequest(channel, statusCode);
			}
		}
	};
}
