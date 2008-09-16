/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
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
	}
	
	/**
	 * Initializes handlers for MIME types
	 */
	this.initializeHandlers = function() {
		_typeHandlers = {};
		_ignoreContentDispositionTypes = [];
		_observers = [];
		
		if(Zotero.Prefs.get("parseEndNoteMIMETypes")) {
			this.addHandler("application/x-endnote-refer", Zotero.Ingester.importHandler, true);
			this.addHandler("application/x-research-info-systems", Zotero.Ingester.importHandler, true);
		}
		this.addHandler("text/x-csl", function(a1, a2, a3) { Zotero.Styles.install(a1, a2, a3) });
	}
	
	/**
	 * Adds a handler to handle a specific MIME type
	 * @param {String} type MIME type to handle
	 * @param {Function} fn Function to call to handle type
	 * @param {Boolean} ignoreContentDisposition If true, ignores the Content-Disposition header,
	 *	which is often used to force a file to download rather than let it be handled by the web
	 *	browser
	 */
	this.addHandler = function(type, fn, ignoreContentDisposition) {
		_typeHandlers[type] = fn;
		_ignoreContentDispositionTypes.push(type);
	}
	
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
			channel.QueryInterface(Components.interfaces.nsIRequest);
			if(channel.loadFlags & Components.interfaces.nsIHttpChannel.LOAD_DOCUMENT_URI) {
				channel.QueryInterface(Components.interfaces.nsIHttpChannel);
				try {
					// remove content-disposition headers for EndNote, etc.
					var contentType = channel.getResponseHeader("Content-Type").toLowerCase();
					for each(var handledType in _ignoreContentDispositionTypes) {
						if(contentType.length < handledType.length) {
							break;
						} else {
							if(contentType.substr(0, handledType.length) == handledType) {
								channel.setResponseHeader("Content-Disposition", "", false);
								break;
							}
						}
					}
				} catch(e) {}
				
				for each(var observer in _observers) {
					observer(channel);
				}
			}
		}
	}
	
	var _URIContentListener = new function() {
		/**
		 * Standard QI definiton
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
		this._readString = "";
		this._scriptableStream = null;
		this._scriptableStreamInput = null;
	}
	
	/**
	 * Standard QI definiton
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
	 * Called when the request is started; we ignore this
	 */
	_StreamListener.prototype.onStartRequest = function(channel, context) {}
	

	/**
	 * Called when there's data available; we collect this data and keep it until the request is
	 * done
	 */
	_StreamListener.prototype.onDataAvailable = function(request, context, inputStream, offset, count) {
		if (inputStream != this._scriptableStreamInput) {
			this._scriptableStream = Components.classes["@mozilla.org/scriptableinputstream;1"]
				.createInstance(Components.interfaces.nsIScriptableInputStream);
			this._scriptableStream.init(inputStream);
			this._scriptableStreamInput = inputStream;
		}
		this._readString += this._scriptableStream.read(count);
	}
	
	/**
	 * Called when the request is done
	 */
	_StreamListener.prototype.onStopRequest = function(channel, context, status) {
		try {
			_typeHandlers[this._contentType](this._readString, (this._request.name ? this._request.name : null),
				this._contentType);
		} catch(e) {
			// if there was an error, handle using nsIExternalHelperAppService
			var externalHelperAppService = Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"].
				getService(Components.interfaces.nsIExternalHelperAppService);
			var frontWindow = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
				getService(Components.interfaces.nsIWindowWatcher).activeWindow;
			
			var newStreamListener = externalHelperAppService.doContent(this._contentType,
				this._request, frontWindow, false);
			if(newStreamListener) {
				// create a string input stream
				var inputStream = Components.classes["@mozilla.org/io/string-input-stream;1"].
								  createInstance(Components.interfaces.nsIStringInputStream);
				inputStream.setData(this._readString, this._readString.length);
				
				newStreamListener.onStartRequest(channel, context);
				newStreamListener.onDataAvailable(this._request, context, inputStream, 0, this._readString.length);
				newStreamListener.onStopRequest(channel, context, status);
			}
			
			// then throw our error
			throw e;
		}
	}
}