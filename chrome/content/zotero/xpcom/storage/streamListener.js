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
 *   - onStop:  f(request, status, response, data)
 *   - onCancel:  f(request, status, data)
 *   - streams: array of streams to close on completion
 *   - Other values to pass to onStop()
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
		
		switch (status) {
			case 0:
			case 0x804b0002: // NS_BINDING_ABORTED
				this._onStop(request, status);
				break;
			
			default:
				throw ("Unexpected request status " + status
					+ " in Zotero.Sync.Storage.StreamListener.onStopRequest()");
		}
	},
	
	// nsIWebProgressListener
	onProgressChange: function (wp, request, curSelfProgress,
			maxSelfProgress, curTotalProgress, maxTotalProgress) {
		Zotero.debug("onProgressChange with " + curTotalProgress + "/" + maxTotalProgress);
		
		// onProgress gets called too, so this isn't necessary
		//this._onProgress(request, curTotalProgress, maxTotalProgress);
	},
	
	onStateChange: function (wp, request, stateFlags, status) {
		Zotero.debug("onStateChange");
		Zotero.debug(stateFlags);
		Zotero.debug(status);
		
		if ((stateFlags & Components.interfaces.nsIWebProgressListener.STATE_START)
				&& (stateFlags & Components.interfaces.nsIWebProgressListener.STATE_IS_NETWORK)) {
			this._onStart(request);
		}
		else if ((stateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)
				&& (stateFlags & Components.interfaces.nsIWebProgressListener.STATE_IS_NETWORK)) {
			this._onStop(request, status);
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
	onChannelRedirect: function (oldChannel, newChannel, flags) {
		Zotero.debug('onChannelRedirect');
		
		// if redirecting, store the new channel
		this._channel = newChannel;
	},
	
	asyncOnChannelRedirect: function (oldChan, newChan, flags, redirectCallback) {
		Zotero.debug('asyncOnRedirect');
		
		this.onChannelRedirect(oldChan, newChan, flags);
		redirectCallback.onRedirectVerifyCallback(0);
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
			var data = this._getPassData();
			this._data.onStart(request, data);
		}
	},
	
	_onProgress: function (request, progress, progressMax) {
		if (this._data && this._data.onProgress) {
			this._data.onProgress(request, progress, progressMax);
		}
	},
	
	_onStop: function (request, status) {
		Zotero.debug('Request ended with status ' + status);
		var cancelled = status == 0x804b0002; // NS_BINDING_ABORTED
		
		if (!cancelled && request instanceof Components.interfaces.nsIHttpChannel) {
			request.QueryInterface(Components.interfaces.nsIHttpChannel);
			status = request.responseStatus;
			request.QueryInterface(Components.interfaces.nsIRequest);
		}
		
		if (this._data.streams) {
			for each(var stream in this._data.streams) {
				stream.close();
			}
		}
		
		var data = this._getPassData();
		
		if (cancelled) {
			if (this._data.onCancel) {
				this._data.onCancel(request, status, data);
			}
		}
		else {
			if (this._data.onStop) {
				this._data.onStop(request, status, this._response, data);
			}
		}
		
		this._channel = null;
	},
	
	_getPassData: function () {
		// Make copy of data without callbacks to pass along
		var passData = {};
		for (var i in this._data) {
			switch (i) {
				case "onStart":
				case "onProgress":
				case "onStop":
				case "onCancel":
					continue;
			}
			passData[i] = this._data[i];
		}
		return passData;
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
			+ uri.hostPort + uri.path
	},
};
