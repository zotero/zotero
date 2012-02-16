/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2012 Center for History and New Media
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
Components.utils.import("resource://gre/modules/Services.jsm");

Zotero.Standalone = new function() {
	/**
	 * Stream listener proxy for AMO requests to replace Firefox's app ID with toolkit@mozilla.org.
	 * This means add-ons hosted at AMO will update properly for us.
	 */
	var AMOStreamListener = function() {};
	AMOStreamListener.prototype = {	
		"QueryInterface": function(arg) {
			if (!iid.equals(Components.interfaces.nsIStreamListener)
					&& !iid.equals(Components.interfaces.nsIRequestObserver)
					&& !iid.equals(Components.interfaces.nsISupports)) {
				throw Components.results.NS_ERROR_NO_INTERFACE;
			}
			return this;
		},
		
		"onStartRequest": function(aRequest, aContext) {
			this._stream = Cc["@mozilla.org/binaryinputstream;1"].
						   createInstance(Ci.nsIBinaryInputStream);
			this._bytes = "";
			this.oldListener.onStartRequest(aRequest, aContext);
		},
		
		"onStopRequest": function(aRequest, aContext, aStatusCode) {
			var requestFailed = !Components.isSuccessCode(aStatusCode);
			if(!requestFailed && (aRequest instanceof Ci.nsIHttpChannel))
				requestFailed = !aRequest.requestSucceeded;
			
			if(!requestFailed) {
				var data = this._bytes.replace("{ec8030f7-c20a-464f-9b0e-13a3a9e97384}",
					"toolkit@mozilla.org", "g")
				var nBytes = data.length;
				var inputStream = Cc["@mozilla.org/io/string-input-stream;1"].
					createInstance(Ci.nsIStringInputStream);
				inputStream.setData(data, nBytes);
				this.oldListener.onDataAvailable(aRequest, aContext, inputStream, 0, nBytes);
			}
			this.oldListener.onStopRequest(aRequest, aContext, aStatusCode);
		},
		
		"onDataAvailable": function(aRequest, aContext, aInputStream, aOffset, aCount) {
			this._stream.setInputStream(aInputStream);
			this._bytes += this._stream.readBytes(aCount);
		}
	};
	
	this.init = function() {
		// Set not offline
		Services.io.offline = false;
		
		// Add an observer to handle AMO requests
		Components.classes["@mozilla.org/observer-service;1"].
			getService(Components.interfaces.nsIObserverService).
			addObserver({
				"observe":function(ch) {
					try {
						if(ch.QueryInterface(Components.interfaces.nsIRequest).URI.host
							!== "versioncheck.addons.mozilla.org") return;
					} catch(e) {
						return;
					}
					var newListener = new AMOStreamListener;
					newListener.oldListener = ch.
						QueryInterface(Components.interfaces.nsITraceableChannel).
						setNewListener(newListener);
				}
			}, "http-on-examine-response", false);
	}
}
