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

Zotero.MIMETypeHandler = new function () {
	var _typeHandlers, _ignoreContentDispositionTypes, _observers;
	
	/**
	 * Registers URIContentListener to handle MIME types
	 */
	this.init = function() {
		Zotero.debug("Registering URIContentListener");
		// register our nsIURIContentListener and nsIObserver
		Components.classes["@mozilla.org/uriloader;1"].
			getService(Components.interfaces.nsIURILoader).
			registerContentListener(_URIContentListener);
		Components.classes["@mozilla.org/observer-service;1"].
			getService(Components.interfaces.nsIObserverService).
			addObserver(_Observer, "http-on-examine-response", false);
		this.initializeHandlers();
		Zotero.addShutdownListener(function() {
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
				}
				catch (e) {
					Zotero.logError(e);
					(new Zotero.Exception.Alert("styles.install.unexpectedError",
						origin, "styles.install.title", e)).present();
				}
				// Close styles page in basic viewer after installing a style
				if (win) {
					win.close();
				}
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
	this.addObserver = function(fn) {
		_observers.push(fn);
	}
	
	
	/**
	 * Called to observe a page load
	 */
	var _Observer = new function() {
		this.observe = function(channel) {
			if(Zotero.isConnector) return;
			
			channel.QueryInterface(Components.interfaces.nsIRequest);
			if(channel.loadFlags & Components.interfaces.nsIHttpChannel.LOAD_DOCUMENT_URI) {
				channel.QueryInterface(Components.interfaces.nsIHttpChannel);
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
				} catch(e) {}
				
				for (let observer of _observers) {
					observer(channel);
				}
			}
		}
	}
	
	var _URIContentListener = new function() {
		/**
		 * Standard QI definition
		 */
		this.QueryInterface = function(iid) {
			if  (iid.equals(Components.interfaces.nsISupports)
			   || iid.equals(Components.interfaces.nsISupportsWeakReference)
			   || iid.equals(Components.interfaces.nsIURIContentListener)) {
				return this;
			}
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}
		
		/**
		 * Called to see if we can handle a content type
		 */
		this.canHandleContent = this.isPreferred = function(contentType, isContentPreferred, desiredContentType) {
			if(Zotero.isConnector) return false;
			return !!_typeHandlers[contentType.toLowerCase()];
		}
		
		/**
		 * Called to begin handling a content type
		 */
		this.doContent = function(contentType, isContentPreferred, request, contentHandler) {
			Zotero.debug("MIMETypeHandler: handling "+contentType+" from " + request.name);
			contentHandler.value = new _StreamListener(request, contentType.toLowerCase());
			return false;
		}
		
		/**
		 * Called so that we could stop a load before it happened if we wanted to
		 */
		this.onStartURIOpen = function(URI) {
			return true;
		}
	}
		
	/**
	 * @class Implements nsIStreamListener and nsIRequestObserver interfaces to download MIME types
	 * 	we've registered ourself as the handler for
	 * @param {nsIRequest} request The request to handle
	 * @param {String} contenType The content type being handled
	 */
	var _StreamListener = function(request, contentType) {
		this._request = request;
		this._contentType = contentType
		this._storageStream = null;
		this._outputStream = null;
		this._binaryInputStream = null;
	}
	
	/**
	 * Standard QI definition
	 */
	_StreamListener.prototype.QueryInterface = function(iid) {
		if (iid.equals(Components.interfaces.nsISupports)
		   || iid.equals(Components.interfaces.nsIRequestObserver)
		   || iid.equals(Components.interfaces.nsIStreamListener)) {
			return this;
		}
		throw Components.results.NS_ERROR_NO_INTERFACE;
	}
	
	/**
	 * Called when the request is started
	 */
	_StreamListener.prototype.onStartRequest = async function(channel, context) {
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

	/**
	 * Called when there's data available; we collect this data and keep it until the request is
	 * done
	 */
	_StreamListener.prototype.onDataAvailable = function(request, context, inputStream, offset, count) {
		Zotero.debug(count + " bytes available");
		
		if (!this._storageStream) {
			this._storageStream = Components.classes["@mozilla.org/storagestream;1"].
					createInstance(Components.interfaces.nsIStorageStream);
			this._storageStream.init(16384, 4294967295, null); // PR_UINT32_MAX
			this._outputStream = this._storageStream.getOutputStream(0);
			
			this._binaryInputStream = Components.classes["@mozilla.org/binaryinputstream;1"].
					createInstance(Components.interfaces.nsIBinaryInputStream);
			this._binaryInputStream.setInputStream(inputStream);
		}
		
		var bytes = this._binaryInputStream.readBytes(count);
		this._outputStream.write(bytes, count);
	}
	
	/**
	 * Called when the request is done
	 */
	_StreamListener.prototype.onStopRequest = async function (channel, context, status) {
		Zotero.debug("charset is " + channel.contentCharset);
		
		var inputStream = this._storageStream.newInputStream(0);
		var stream = Components.classes["@mozilla.org/binaryinputstream;1"]
					.createInstance(Components.interfaces.nsIBinaryInputStream);
		stream.setInputStream(inputStream);
		let buffer = new ArrayBuffer(this._storageStream.length);
		stream.readArrayBuffer(buffer.byteLength, buffer);
		stream.close();
		inputStream.close();
		let blob = new (Zotero.getMainWindow()).Blob([buffer], { type: this._contentType });
		
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
		
		if (handled === false) {
			// Handle using nsIExternalHelperAppService
			let externalHelperAppService = Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"]
				.getService(Components.interfaces.nsIExternalHelperAppService);
			let frontWindow = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
				.getService(Components.interfaces.nsIWindowWatcher).activeWindow;
			
			let inputStream = this._storageStream.newInputStream(0);
			let streamListener = externalHelperAppService.doContent(
				this._contentType, this._request, frontWindow, null
			);
			if (streamListener) {
				streamListener.onStartRequest(channel, context);
				streamListener.onDataAvailable(
					this._request, context, inputStream, 0, this._storageStream.length
				);
				streamListener.onStopRequest(channel, context, status);
			}
		}
		
		this._storageStream.close();
	};
}
