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

Zotero.Integration.Compat = new function() {
	var _contentLengthRe = /[\r\n]Content-Length: *([0-9]+)/i;
	var _XMLRe = /<\?[^>]+\?>/;
	var _onlineObserverRegistered;
	
	this.sessions = {};
	
	var ns = "http://www.zotero.org/namespaces/SOAP";
	this.ns = new Namespace(ns);
	
	this.init = init;
	this.handleHeader = handleHeader;
	this.handleEnvelope = handleEnvelope;
	
	/*
	 * initializes a very rudimentary web server used for SOAP RPC
	 */
	function init() {
		this.env = new Namespace("http://schemas.xmlsoap.org/soap/envelope/");
		
		if (Zotero.Utilities.HTTP.browserIsOffline()) {
			Zotero.debug('Browser is offline -- not initializing integration HTTP server');
			_registerOnlineObserver()
			return;
		}
		
		// start listening on socket
		var serv = Components.classes["@mozilla.org/network/server-socket;1"]
					.createInstance(Components.interfaces.nsIServerSocket);
		try {
			// bind to a random port on loopback only
			serv.init(Zotero.Prefs.get('integration.port'), true, -1);
			serv.asyncListen(Zotero.Integration.Compat.SocketListener);
			
			Zotero.debug("Integration HTTP server listening on 127.0.0.1:"+serv.port);
		} catch(e) {
			Zotero.debug("Not initializing integration HTTP server");
		}
		
		_registerOnlineObserver()
	}
	
	/*
	 * handles an HTTP request
	 */
	function handleHeader(header) {
		// get first line of request (all we care about for now)
		var method = header.substr(0, header.indexOf(" "));
		
		if(!method) {
			return _generateResponse("400 Bad Request");
		}
		
		if(method != "POST") {
			return _generateResponse("501 Method Not Implemented");
		} else {
			// parse content length
			var m = _contentLengthRe.exec(header);
			if(!m) {
				return _generateResponse("400 Bad Request");
			} else {
				return parseInt(m[1]);
			}
		}
	}
	
	/*
	 * handles a SOAP envelope
	 */
	function handleEnvelope(envelope) {
		Zotero.debug("Integration: SOAP Request\n"+envelope);
		envelope = envelope.replace(_XMLRe, "");
		var env = this.env;
		
		var xml = new XML(envelope);
		var request = xml.env::Body.children()[0];
		if(request.namespace() != this.ns) {
			Zotero.debug("Integration: SOAP method not supported: invalid namespace");
		} else if(!xml.env::Header.children().length()) {
			// old style SOAP request
			var name = request.localName();
			var output = "ERROR:"+Zotero.getString("integration.error.incompatibleVersion", Zotero.version);
			var response = <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
				<SOAP-ENV:Body>
					<m:{name}Response xmlns:m={this.ns}>
						<output>{output}</output>
					</m:{name}Response>
				</SOAP-ENV:Body>
			</SOAP-ENV:Envelope>;
			return _generateResponse("200 OK", 'text/xml; charset="UTF-8"', response.toXMLString());
		} else {
			// new style SOAP request
			var text = Zotero.getString("integration.error.incompatibleVersion", Zotero.version);
			var response = <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
				<SOAP-ENV:Body>
					<SOAP-ENV:Fault>
						<SOAP-ENV:Code>
							<SOAP-ENV:Value>XML-ENV:Sender</SOAP-ENV:Value>
							<SOAP-ENV:Subcode>z:incompatibleVersion</SOAP-ENV:Subcode>
						</SOAP-ENV:Code>
					</SOAP-ENV:Fault>
					<SOAP-ENV:Reason>
						<SOAP-ENV:Text>{text}</SOAP-ENV:Text>
					</SOAP-ENV:Reason>
				</SOAP-ENV:Body>
			</SOAP-ENV:Envelope>
			return _generateResponse("500 Internal Server Error", 'text/xml; charset="UTF-8"', response.toXMLString());
		}
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
					Zotero.Integration.Compat.init();
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

Zotero.Integration.Compat.SocketListener = new function() {
	this.onSocketAccepted = onSocketAccepted;
	this.onStopListening = onStopListening;
	
	/*
	 * called when a socket is opened
	 */
	function onSocketAccepted(socket, transport) {
		// get an input stream
		var iStream = transport.openInputStream(0, 0, 0);
		var oStream = transport.openOutputStream(Components.interfaces.nsITransport.OPEN_BLOCKING, 0, 0);
		
		var dataListener = new Zotero.Integration.Compat.DataListener(iStream, oStream);
		var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"]
							 .createInstance(Components.interfaces.nsIInputStreamPump);
		pump.init(iStream, -1, -1, 0, 0, false);
		pump.asyncRead(dataListener, null);
	}
	
	function onStopListening(serverSocket, status) {
		Zotero.debug("Integration HTTP server going offline");
	}
}

/*
 * handles the actual acquisition of data
 */
Zotero.Integration.Compat.DataListener = function(iStream, oStream) {
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
Zotero.Integration.Compat.DataListener.prototype.onStartRequest = function(request, context) {}

/*
 * called when a request stops
 */
Zotero.Integration.Compat.DataListener.prototype.onStopRequest = function(request, context, status) {
	this.iStream.close();
	this.oStream.close();
}

/*
 * called when new data is available
 */
Zotero.Integration.Compat.DataListener.prototype.onDataAvailable = function(request, context,
                                                             inputStream, offset, count) {
	var readData = this.sStream.read(count);
	
	if(this.headerFinished) {	// reading body
		this.body += readData;
		// check to see if data is done
		this._bodyData();
	} else {					// reading header
		// see if there's a magic double return
		var lineBreakIndex = readData.indexOf("\r\n\r\n");
		if(lineBreakIndex != -1) {
			if(lineBreakIndex != 0) {
				this.header += readData.substr(0, lineBreakIndex+4);
				this.body = readData.substr(lineBreakIndex+4);
			}
			
			this._headerFinished();
			return;
		}
		var lineBreakIndex = readData.indexOf("\n\n");
		if(lineBreakIndex != -1) {
			if(lineBreakIndex != 0) {
				this.header += readData.substr(0, lineBreakIndex+2);
				this.body = readData.substr(lineBreakIndex+2);
			}
			
			this._headerFinished();
			return;
		}
		if(this.header && this.header[this.header.length-1] == "\n" &&
		   (readData[0] == "\n" || readData[0] == "\r")) {
			if(readData.length > 1 && readData[1] == "\n") {
				this.header += readData.substr(0, 2);
				this.body = readData.substr(2);
			} else {
				this.header += readData[0];
				this.body = readData.substr(1);
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
Zotero.Integration.Compat.DataListener.prototype._headerFinished = function() {
	this.headerFinished = true;
	var output = Zotero.Integration.Compat.handleHeader(this.header);
	
	if(typeof(output) == "number") {
		this.bodyLength = output;
		// check to see if data is done
		this._bodyData();
	} else {
		this._requestFinished(output);
	}
}

/*
 * checks to see if Content-Length bytes of body have been read and, if they
 * have, processes the body
 */
Zotero.Integration.Compat.DataListener.prototype._bodyData = function() {
	if(this.body.length >= this.bodyLength) {
		// convert to UTF-8
		var dataStream = Components.classes["@mozilla.org/io/string-input-stream;1"]
		                           .createInstance(Components.interfaces.nsIStringInputStream);
		dataStream.setData(this.body, this.bodyLength);
		
		var utf8Stream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
		                           .createInstance(Components.interfaces.nsIConverterInputStream);
		utf8Stream.init(dataStream, "UTF-8", 4096, "?");

		this.body = "";
		var string = {};
		while(utf8Stream.readString(this.bodyLength, string)) {
			this.body += string.value;
		}		
		
		// handle envelope
		var output = Zotero.Integration.Compat.handleEnvelope(this.body);
		this._requestFinished(output);
	}
}

/*
 * returns HTTP data from a request
 */
Zotero.Integration.Compat.DataListener.prototype._requestFinished = function(response) {
	// close input stream
	this.iStream.close();
	
	// open UTF-8 converter for output stream	
	var intlStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
							   .createInstance(Components.interfaces.nsIConverterOutputStream);
	
	// write
	try {
		intlStream.init(this.oStream, "UTF-8", 1024, "?".charCodeAt(0));
		
		// write response
		intlStream.writeString(response);
	} finally {	
		intlStream.close();
	}
}