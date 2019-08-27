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


/**
 * Stream listener that can handle both download and upload requests
 *
 * Possible properties of data object:
 *   - onStart: f(request)
 *   - onProgress:  f(request, progress, progressMax)
 *   - onStop:  f(request, status, response)
 *   - onCancel:  f(request, status)
 *   - streams: array of streams to close on completion
 */
Zotero.Sync.Storage.StreamListener = function (data) {
	this._data = data;
}

Zotero.Sync.Storage.StreamListener.prototype = {
	_channel: null,
	
	// nsIProgressEventSink
	onProgress: function (request, context, progress, progressMax) {
		Zotero.debug("onProgress with " + progress + "/" + progressMax);
		this._onProgress(request, progress, progressMax);
	},
	
	onStatus: function (request, context, status, statusArg) {
		Zotero.debug('onStatus with ' + status);
	},
	
	// nsIRequestObserver
	// Note: For uploads, this isn't called until data is done uploading
	onStartRequest: function (request, context) {
		Zotero.debug('onStartRequest');
		this._response = "";
		
		this._onStart(request);
	},
	
	onStopRequest: function (request, context, status) {
		Zotero.debug('onStopRequest with ' + status);
		
		// Some errors from https://developer.mozilla.org/en-US/docs/Table_Of_Errors
		var msg = "";
		switch (status) {
		// Normal
		case 0:
			break;
		
		// NS_BINDING_ABORTED
		case 0x804b0002:
			msg = "Request cancelled";
			break;
		
		// NS_ERROR_NET_INTERRUPT
		case 0x804B0047:
			msg = "Request interrupted";
			break;
		
		// NS_ERROR_NET_TIMEOUT
		case 0x804B000E:
			msg = "Request timed out";
			break;
		
		default:
			msg = "Request failed";
			break;
		}
		
		if (msg) {
			msg += " in Zotero.Sync.Storage.StreamListener.onStopRequest() (" + status + ")";
			Components.utils.reportError(msg);
			Zotero.debug(msg, 1);
		}
		
		this._onStop(request, status);
	},
	
	// nsIWebProgressListener
	onProgressChange: function (wp, request, curSelfProgress,
			maxSelfProgress, curTotalProgress, maxTotalProgress) {
		//Zotero.debug("onProgressChange with " + curTotalProgress + "/" + maxTotalProgress);
		
		// onProgress gets called too, so this isn't necessary
		//this._onProgress(request, curTotalProgress, maxTotalProgress);
	},
	
	onStateChange: function (wp, request, stateFlags, status) {
		Zotero.debug("onStateChange with " + stateFlags);
		
		if (stateFlags & Components.interfaces.nsIWebProgressListener.STATE_IS_REQUEST) {
			if (stateFlags & Components.interfaces.nsIWebProgressListener.STATE_START) {
				this._onStart(request);
			}
			else if (stateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP) {
				this._onStop(request, status);
			}
		}
	},
	
	onStatusChange: function (progress, request, status, message) {
		Zotero.debug("onStatusChange with '" + message + "'");
	},
	onLocationChange: function () {
		Zotero.debug('onLocationChange');
	},
	onSecurityChange: function () {
		Zotero.debug('onSecurityChange');
	},
	
	// nsIStreamListener
	onDataAvailable: function (request, context, stream, sourceOffset, length) {
		Zotero.debug('onDataAvailable');
		var scriptableInputStream = 
			Components.classes["@mozilla.org/scriptableinputstream;1"]
				.createInstance(Components.interfaces.nsIScriptableInputStream);
		scriptableInputStream.init(stream);
		
		var data = scriptableInputStream.read(length);
		Zotero.debug(data);
		this._response += data;
	},
	
	// nsIChannelEventSink
	//
	// If this._data.onChannelRedirect exists, it should return a promise resolving to true to
	// follow the redirect or false to cancel it
	onChannelRedirect: Zotero.Promise.coroutine(function* (oldChannel, newChannel, flags) {
		Zotero.debug('onChannelRedirect');
		
		if (this._data && this._data.onChannelRedirect) {
			let result = yield this._data.onChannelRedirect(oldChannel, newChannel, flags);
			if (!result) {
				oldChannel.cancel(Components.results.NS_BINDING_ABORTED);
				newChannel.cancel(Components.results.NS_BINDING_ABORTED);
				Zotero.debug("Cancelling redirect");
				// TODO: Prevent onStateChange error
				return false;
			}
		}
		
		// if redirecting, store the new channel
		this._channel = newChannel;
	}),
	
	asyncOnChannelRedirect: function (oldChan, newChan, flags, redirectCallback) {
		Zotero.debug('asyncOnRedirect');
		
		this.onChannelRedirect(oldChan, newChan, flags)
		.then(function (result) {
			redirectCallback.onRedirectVerifyCallback(
				result ? Components.results.NS_SUCCEEDED : Components.results.NS_FAILED
			);
		})
		.catch(function (e) {
			Zotero.logError(e);
			redirectCallback.onRedirectVerifyCallback(Components.results.NS_FAILED);
		});
	},
	
	// nsIHttpEventSink
	onRedirect: function (oldChannel, newChannel) {
		Zotero.debug('onRedirect');
		
		var newURL = Zotero.HTTP.getDisplayURI(newChannel.URI).spec;
		Zotero.debug("Redirecting to " + newURL);
	},
	
	
	//
	// Private methods
	//
	_onStart: function (request) {
		Zotero.debug('Starting request');
		if (this._data && this._data.onStart) {
			this._data.onStart(request);
		}
	},
	
	_onProgress: function (request, progress, progressMax) {
		if (this._data && this._data.onProgress) {
			this._data.onProgress(request, progress, progressMax);
		}
	},
	
	_onStop: function (request, status) {
		var cancelled = status == 0x804b0002; // NS_BINDING_ABORTED
		
		if (!cancelled && status == 0 && request instanceof Components.interfaces.nsIHttpChannel) {
			request.QueryInterface(Components.interfaces.nsIHttpChannel);
			try {
				status = request.responseStatus;
			}
			catch (e) {
				Zotero.debug("Request responseStatus not available", 1);
				status = 0;
			}
			Zotero.debug('Request ended with status code ' + status);
			request.QueryInterface(Components.interfaces.nsIRequest);
		}
		else {
			Zotero.debug('Request ended with status ' + status);
			status = 0;
		}
		
		if (this._data.streams) {
			for (let stream of this._data.streams) {
				stream.close();
			}
		}
		
		if (cancelled) {
			if (this._data.onCancel) {
				this._data.onCancel(request, status);
			}
		}
		else {
			if (this._data.onStop) {
				this._data.onStop(request, status, this._response);
			}
		}
		
		this._channel = null;
	},
	
	// nsIInterfaceRequestor
	getInterface: function (iid) {
		try {
			return this.QueryInterface(iid);
		}
		catch (e) {
			throw Components.results.NS_NOINTERFACE;
		}
	},
	
	QueryInterface: function(iid) {
		if (iid.equals(Components.interfaces.nsISupports) ||
				iid.equals(Components.interfaces.nsIInterfaceRequestor) ||
				iid.equals(Components.interfaces.nsIChannelEventSink) || 
				iid.equals(Components.interfaces.nsIProgressEventSink) ||
				iid.equals(Components.interfaces.nsIHttpEventSink) ||
				iid.equals(Components.interfaces.nsIStreamListener) ||
				iid.equals(Components.interfaces.nsIWebProgressListener)) {
			return this;
		}
		throw Components.results.NS_NOINTERFACE;
	},
	
	_safeSpec: function (uri) {
		return uri.scheme + '://' + uri.username + ':********@'
			+ uri.hostPort + uri.pathQueryRef
	},
};
