/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/


Zotero.DataServer = new function () {
	this.init = init;
	this.handleHeader = handleHeader;
	
	// TODO: assign dynamically
	this.__defineGetter__('port', function () {
		return 22030;
	});
	
	var _onlineObserverRegistered;
	
	
	/*
	 * initializes a very rudimentary web server used for SOAP RPC
	 */
	function init() {
		// Use Zeroconf pref for now
		if (!Zotero.Prefs.get("zeroconf.server.enabled")) {
			Zotero.debug("Not initializing data HTTP server");
			return;
		}
		
		if (Zotero.Utilities.HTTP.browserIsOffline()) {
			Zotero.debug('Browser is offline -- not initializing data HTTP server');
			_registerOnlineObserver()
			return;
		}
		
		// start listening on socket
		var serv = Components.classes["@mozilla.org/network/server-socket;1"]
					.createInstance(Components.interfaces.nsIServerSocket);
		try {
			serv.init(this.port, false, -1);
			serv.asyncListen(Zotero.DataServer.SocketListener);
			
			Zotero.debug("Data HTTP server listening on 127.0.0.1:" + serv.port);
		}
		catch(e) {
			Zotero.debug("Not initializing data HTTP server");
		}
		
		_registerOnlineObserver()
	}
	
	/*
	 * handles an HTTP request
	 */
	function handleHeader(header) {
		// get first line of request (all we care about for now)
		var method = header.substr(0, header.indexOf(" "));
		
		if (!method) {
			return _generateResponse("400 Bad Request");
		}
		
		if (method != "POST") {
			return _generateResponse("501 Method Not Implemented");
		}
		
		// Parse request URI
		var matches = header.match("^[A-Z]+ (\/.*) HTTP/1.[01]");
		if (!matches) {
			return _generateResponse("400 Bad Request");
		}
		
		var response = _handleRequest(matches[1]);
		
		// return OK
		return _generateResponse("200 OK", 'text/xml; charset="UTF-8"', response);
	}
	
	
	function _handleRequest(uri) {
		var s = new Zotero.Search();
		s.addCondition('noChildren', 'true');
		var ids = s.search();
		
		if (!ids) {
			ids = [];
		}
		
		var uploadIDs = {
			updated: {
				items: ids
			},
			/* TODO: fix buildUploadXML to ignore missing */
			deleted: {}
		};
		return Zotero.Sync.Server.Data.buildUploadXML(uploadIDs);
	}
	
	
	/*
	 * generates the response to an HTTP request
	 */
	function _generateResponse(status, contentType, body) {
		var response = "HTTP/1.0 "+status+"\r\n";
		
		if(body) {
			if(contentType) {
				response += "Content-Type: "+contentType+"\r\n";
			}
			response += "\r\n"+body;
		} else {
			response += "Content-Length: 0\r\n\r\n"
		}
		
		return response;
	}
	
	
	function _registerOnlineObserver() {
		if (_onlineObserverRegistered) {
			return;
		}
		
		// Observer to enable the integration when we go online
		var observer = {
			observe: function(subject, topic, data) {
				if (data == 'online') {
					Zotero.Integration.init();
				}
			}
		};
		
		var observerService =
			Components.classes["@mozilla.org/observer-service;1"]
				.getService(Components.interfaces.nsIObserverService);
		observerService.addObserver(observer, "network:offline-status-changed", false);
		
		_onlineObserverRegistered = true;
	}
}


Zotero.DataServer.SocketListener = new function() {
	this.onSocketAccepted = onSocketAccepted;
	
	/*
	 * called when a socket is opened
	 */
	function onSocketAccepted(socket, transport) {
		// get an input stream
		var iStream = transport.openInputStream(0, 0, 0);
		var oStream = transport.openOutputStream(0, 0, 0);
		
		var dataListener = new Zotero.DataServer.DataListener(iStream, oStream);
		var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"]
							 .createInstance(Components.interfaces.nsIInputStreamPump);
		pump.init(iStream, -1, -1, 0, 0, false);
		pump.asyncRead(dataListener, null);
	}
}

/*
 * handles the actual acquisition of data
 */
Zotero.DataServer.DataListener = function(iStream, oStream) {
	this.header = "";
	this.headerFinished = false;
	
	this.body = "";
	this.bodyLength = 0;
	
	this.iStream = iStream;
	this.oStream = oStream;
	this.sStream = Components.classes["@mozilla.org/scriptableinputstream;1"]
	                         .createInstance(Components.interfaces.nsIScriptableInputStream);
	this.sStream.init(iStream);
	
	this.foundReturn = false;
}

/*
 * called when a request begins (although the request should have begun before
 * the DataListener was generated)
 */
Zotero.DataServer.DataListener.prototype.onStartRequest = function(request, context) {}

/*
 * called when a request stops
 */
Zotero.DataServer.DataListener.prototype.onStopRequest = function(request, context, status) {
	this.iStream.close();
	this.oStream.close();
}

/*
 * called when new data is available
 */
Zotero.DataServer.DataListener.prototype.onDataAvailable = function(request, context,
                                                             inputStream, offset, count) {
	var readData = this.sStream.read(count);
	
	// Read header
	if (!this.headerFinished) {
		// see if there's a magic double return
		var lineBreakIndex = readData.indexOf("\r\n\r\n");
		if (lineBreakIndex != -1) {
			if (lineBreakIndex != 0) {
				this.header += readData.substr(0, lineBreakIndex+4);
			}
			
			this._headerFinished();
			return;
		}
		
		var lineBreakIndex = readData.indexOf("\n\n");
		if (lineBreakIndex != -1) {
			if (lineBreakIndex != 0) {
				this.header += readData.substr(0, lineBreakIndex+2);
			}
			
			this._headerFinished();
			return;
		}
		
		if (this.header && this.header[this.header.length-1] == "\n" &&
				(readData[0] == "\n" || readData[0] == "\r")) {
			if (readData.length > 1 && readData[1] == "\n") {
				this.header += readData.substr(0, 2);
			}
			else {
				this.header += readData[0];
			}
			
			this._headerFinished();
			return;
		}
		
		this.header += readData;
	}
}

/*
 * processes an HTTP header and decides what to do
 */
Zotero.DataServer.DataListener.prototype._headerFinished = function() {
	this.headerFinished = true;
	var output = Zotero.DataServer.handleHeader(this.header);
	this._requestFinished(output);
}

/*
 * returns HTTP data from a request
 */
Zotero.DataServer.DataListener.prototype._requestFinished = function(response) {
	// close input stream
	this.iStream.close();
	
	// open UTF-8 converter for output stream	
	var intlStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
							   .createInstance(Components.interfaces.nsIConverterOutputStream);
	
	// write
	try {
		intlStream.init(this.oStream, "UTF-8", 1024, "?".charCodeAt(0));
		
		Zotero.debug('Writing response to stream:\n\n' + response);
		
		// write response
		intlStream.writeString(response);
	} catch(e) {
		Zotero.debug("An error occurred.");
		Zotero.debug(e);
	} finally {
		Zotero.debug('Closing stream');
		intlStream.close();
	}
}

