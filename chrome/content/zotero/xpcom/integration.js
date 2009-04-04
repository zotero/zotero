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
    limitations under the License.s
    
    ***** END LICENSE BLOCK *****
*/

const API_VERSION = 2;
const COMPAT_API_VERSION = 6;

Zotero.Integration = new function() {
	var _contentLengthRe = /[\r\n]Content-Length: *([0-9]+)/i;
	var _XMLRe = /<\?[^>]+\?>/;
	var _onlineObserverRegistered;
	
	this.sessions = {};
	
	var ns = "http://www.zotero.org/namespaces/SOAP";
	this.ns = new Namespace(ns);
	
	this.init = init;
	this.handleHeader = handleHeader;
	this.handleEnvelope = handleEnvelope;
	
	this.__defineGetter__("usePopup", function () {
		return Zotero.isWin && !Zotero.Prefs.get("integration.realWindow");
	});
	
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
			serv.asyncListen(Zotero.Integration.SocketListener);
			
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
			if(Zotero.Integration.SOAP_Compat[name]) {
				if(request.input.length()) {
					// split apart passed parameters (same colon-escaped format
					// as we pass)
					var input = request.input.toString();
					var vars = new Array();
					vars[0] = "";
					var i = 0;
					
					var lastIndex = 0;
					var colonIndex = input.indexOf(":", lastIndex);
					while(colonIndex != -1) {
						if(input[colonIndex+1] == ":") {	// escaped
							vars[i] += input.substring(lastIndex, colonIndex+1);
							lastIndex = colonIndex+2;
						} else {							// not escaped
							vars[i] += input.substring(lastIndex, colonIndex);
							i++;
							vars[i] = "";
							lastIndex = colonIndex+1;
						}
						colonIndex = input.indexOf(":", lastIndex);
					}
					vars[i] += input.substr(lastIndex);
				} else {
					var vars = null;
				}
				
				// execute request
				var output = Zotero.Integration.SOAP_Compat[name](vars);
				
				// ugh: we can't use real SOAP, since AppleScript VBA can't pass
				// objects, so implode arrays
				if(!output) {
					output = "";
				}
				
				if(typeof(output) == "object") {
					for(var i in output) {
						if(typeof(output[i]) == "string") {
							output[i] = output[i].replace(/:/g, "::");
						}
					}
					output = output.join(":");
				}
				
				// create envelope
				var responseEnvelope = <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
					<SOAP-ENV:Body>
						<m:{name}Response xmlns:m={this.ns}>
							<output>{output}</output>
						</m:{name}Response>
					</SOAP-ENV:Body>
				</SOAP-ENV:Envelope>;
				
				var response = '<?xml version="1.0" encoding="UTF-8"?>\n'+responseEnvelope.toXMLString();
				Zotero.debug("Integration: SOAP Response\n"+response);
				
				// return OK
				return _generateResponse("200 OK", 'text/xml; charset="UTF-8"',
				                         response);
			} else {
				Zotero.debug("Integration: SOAP method not supported");
			}
		} else {
			// execute request
			request = new Zotero.Integration.Request(xml);
			return _generateResponse(request.status+" "+request.statusText,
				'text/xml; charset="UTF-8"', request.responseText);
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

Zotero.Integration.SocketListener = new function() {
	this.onSocketAccepted = onSocketAccepted;
	this.onStopListening = onStopListening;
	
	/*
	 * called when a socket is opened
	 */
	function onSocketAccepted(socket, transport) {
		// get an input stream
		var iStream = transport.openInputStream(0, 0, 0);
		var oStream = transport.openOutputStream(0, 0, Components.interfaces.nsITransport.OPEN_BLOCKING);
		
		var dataListener = new Zotero.Integration.DataListener(iStream, oStream);
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
Zotero.Integration.DataListener = function(iStream, oStream) {
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
Zotero.Integration.DataListener.prototype.onStartRequest = function(request, context) {}

/*
 * called when a request stops
 */
Zotero.Integration.DataListener.prototype.onStopRequest = function(request, context, status) {
	this.iStream.close();
	this.oStream.close();
}

/*
 * called when new data is available
 */
Zotero.Integration.DataListener.prototype.onDataAvailable = function(request, context,
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
Zotero.Integration.DataListener.prototype._headerFinished = function() {
	this.headerFinished = true;
	var output = Zotero.Integration.handleHeader(this.header);
	
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
Zotero.Integration.DataListener.prototype._bodyData = function() {
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
		var output = Zotero.Integration.handleEnvelope(this.body);
		this._requestFinished(output);
	}
}

/*
 * returns HTTP data from a request
 */
Zotero.Integration.DataListener.prototype._requestFinished = function(response) {
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

Zotero.Integration.Request = function(xml) {
	var env = Zotero.Integration.env;
	this.header = xml.env::Header;
	this.body = xml.env::Body;
	
	this.responseXML = <SOAP-ENV:Envelope xmlns={Zotero.Integration.ns}
		xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
			<SOAP-ENV:Header/>
			<SOAP-ENV:Body/>
		</SOAP-ENV:Envelope>
	
	default xml namespace = Zotero.Integration.ns; with({});
	this.responseHeader = this.responseXML.env::Header;
	this.responseBody = this.responseXML.env::Body;
	
	this.needPrefs = this.body.setDocPrefs.length();
	
	try {
		this.initializeSession();
		if(this.needPrefs) {
			this.setDocPrefs();
		}
		if(this.body.reselectItem.length()) {
			this.reselectItem();
		} else {
			// if no more reselections, clear the reselectItem map
			this._session.reselectItem = new Object();
		}
		if(this.body.updateCitations.length() || this.body.updateBibliography.length()) {
			this.processCitations();
		}
		
		this.status = 200;
		this.statusText = "OK";
	} catch(e) {
		Zotero.debug(e);
		Components.utils.reportError(e);
		
		// Get a code for this error
		var code = (e.name ? e.name : "GenericError");
		var text = e.toString();
		try {
			var text = Zotero.getString("integration.error."+e, Zotero.version);
			code = e;
		} catch(e) {}
		
		this.responseXML = <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
			<SOAP-ENV:Body>
				<SOAP-ENV:Fault>
					<SOAP-ENV:Code>
						<SOAP-ENV:Value>XML-ENV:Sender</SOAP-ENV:Value>
						<SOAP-ENV:Subcode>z:{code}</SOAP-ENV:Subcode>
					</SOAP-ENV:Code>
				</SOAP-ENV:Fault>
				<SOAP-ENV:Reason>
					<SOAP-ENV:Text>{text}</SOAP-ENV:Text>
				</SOAP-ENV:Reason>
			</SOAP-ENV:Body>
		</SOAP-ENV:Envelope>
		
		this.status = 500;
		this.statusText = "Internal Server Error";
	}
	
	// Zap chars that we don't want in our output
	this.responseText = this.responseXML.toXMLString().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
	Zotero.debug("Integration: SOAP Response\n"+this.responseText);
}

/**
 * Gets session data to associate with a request
 **/
Zotero.Integration.Request.prototype.initializeSession = function() {
	default xml namespace = Zotero.Integration.ns; with({});
	
	if(this.header.client.@api != API_VERSION) {
		throw "incompatibleVersion";
	}
	
	var styleID = this.header.style.@id.toString();
	this._sessionID = this.header.session.@id.toString();
	if(this._sessionID === "" || !Zotero.Integration.sessions[this._sessionID]) {
		this._sessionID = Zotero.randomString();
		this._session = Zotero.Integration.sessions[this._sessionID] = new Zotero.Integration.Session();
		
		var preferences = {};
		for each(var pref in this.header.prefs.pref) {
			preferences[pref.@name] = pref.@value.toString();
		}
		
		this.needPrefs = this.needPrefs || !this._session.setStyle(styleID, preferences);
	} else {
		this._session = Zotero.Integration.sessions[this._sessionID];
	}
	
	this.responseHeader.appendChild(<session id={this._sessionID}/>);
}
	
/**
 * Sets preferences
 **/
Zotero.Integration.Request.prototype.setDocPrefs = function() {
	default xml namespace = Zotero.Integration.ns; with({});
	
	var io = new function() {
		this.wrappedJSObject = this;
	};
	
	io.openOffice = this.header.client.@agent == "OpenOffice.org"
	
	var oldStyle = io.style = this._session.styleID;
	io.useEndnotes = this._session.prefs.useEndnotes;
	io.useBookmarks = this._session.prefs.fieldType;
	
	Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
		.getService(Components.interfaces.nsIWindowWatcher)
		.openWindow(null, 'chrome://zotero/content/integrationDocPrefs.xul', '',
		'chrome,modal,centerscreen' + (Zotero.isWin ? ',popup' : ''), io, true);
	if(!oldStyle || oldStyle != io.style
			|| io.useEndnotes != this._session.prefs.useEndnotes
			|| io.useBookmarks != this._session.prefs.fieldType) {
		this._session.regenerateAll = this._session.bibliographyHasChanged = true;
		
		if(oldStyle != io.style) {
			this._session.setStyle(io.style, this._session.prefs);
		}
	}
	this._session.prefs.useEndnotes = io.useEndnotes;
	this._session.prefs.fieldType = io.useBookmarks;
	
	this.responseHeader.appendChild(<style
		id={io.style} class={this._session.style.class}
		hasBibliography={this._session.style.hasBibliography}/>);
	this.responseHeader.appendChild(<prefs>
		<pref name="useEndnotes" value={io.useEndnotes}/>
		<pref name="fieldType" value={io.useBookmarks}/>
	</prefs>);
	this.responseBody.appendChild(<setDocPrefsResponse/>);
}

/**
 * Reselects an item to replace a deleted item
 **/
Zotero.Integration.Request.prototype.reselectItem = function() {
	default xml namespace = Zotero.Integration.ns; with({});
	
	var io = new function() {
		this.wrappedJSObject = this;
	};
	io.addBorder = Zotero.isWin;
	io.singleSelection = true;
	
	Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
		.getService(Components.interfaces.nsIWindowWatcher)
		.openWindow(null,'chrome://zotero/content/selectItemsDialog.xul', '',
		'chrome,modal,centerscreen,resizable=yes' + (Zotero.isWin ? ',popup' : ''), io, true);
	
	if(io.dataOut && io.dataOut.length) {
		this._session.reselectItem[this.body.reselectItem.@id] = io.dataOut[0];
	}
}

/**
 * Updates citations
 **/
Zotero.Integration.Request.prototype.processCitations = function() {
	default xml namespace = Zotero.Integration.ns; with({});
	
	// get whether to edit bibliography or edit a citation
	var editCitationIndex = this.body.updateCitations.@edit.toString();
	
	// first collect entire bibliography
	var editCitation = false;
	for each(var citation in this.header.citations.citation) {
		// trim spacing characters
		var citationData = Zotero.Utilities.prototype.trim(citation.toString());
		if(citation.@index.toString() === editCitationIndex) {
			if(!citation.@new.toString()) {	// new citation
				// save citation data
				editCitation = this._session.unserializeCitation(citationData, citation.@index.toString());
			}
		} else {
			this._session.addCitation(citation.@index.toString(), citationData);
		}
	}
	
	if(!this._session.haveMissing) {
		// load bibliography data here
		if(this.header.bibliography.length()) {
			this._session.loadBibliographyData(Zotero.Utilities.prototype.trim(this.header.bibliography.toString()));
		}
		
		this._session.updateItemSet();
	}
	
	if(!this._session.haveMissing) {
		// create new citation
		if(editCitationIndex) { 
			this._session.updateCitations(editCitationIndex-1);
			var added = this._session.editCitation(editCitationIndex, editCitation);
			if(!added) {
				if(editCitation) {
					this._session.addCitation(editCitationIndex, editCitation);
				} else {
					this._session.deleteCitation(editCitationIndex);
				}
			}
			this._session.updateItemSet();
		}
		this._session.updateCitations();
		
		// edit bibliography
		if(this.body.updateBibliography.@edit.toString()) {
			this._session.editBibliography();
		}
		
		// update
		var output = new Array();
		if(this.body.updateBibliography.length()	 					// if we want updated bib
				&& (this._session.bibliographyHasChanged				// and bibliography changed
				|| this.body.updateBibliography.@force.toString())) {	// or if we should generate regardless of changes
			if(this._session.bibliographyDataHasChanged) {
				this.responseBody.updateBibliographyResponse.code = this._session.getBibliographyData();
			}
			this.responseBody.updateBibliographyResponse.text = this._session.getBibliography(true);
		}
	}
		
	// get citations
	if(this.body.updateCitations.length()) {
		this.responseBody.updateCitationsResponse.citations = this._session.getCitations(!!this.body.updateCitations.@force.toString() || this._session.regenerateAll, true);
	}
	
	// reset citationSet
	this._session.resetRequest();
}

Zotero.Integration.SOAP_Compat = new function() {
	// SOAP methods
	this.update = update;
	this.restoreSession = restoreSession;
	this.setDocPrefs = setDocPrefs;
	
	/*
	 * generates a new citation for a given item
	 * ACCEPTS: sessionID, bibliographyMode, citationMode, editCitationIndex(, fieldIndex, fieldName)+
	 * RETURNS: bibliography, documentData(, fieldIndex, fieldRename, fieldContent)+
	 */
	function update(vars) {
		if(!Zotero.Integration.sessions[vars[0]]) return "ERROR:sessionExpired";
		
		var session = Zotero.Integration.sessions[vars[0]];
		var bibliographyMode = vars[1];
		var citationMode = vars[2];
		
		// get whether to edit bibliography or edit a citation
		var editCitationIndex = false;
		var editBibliography = false;
		if(vars[3] == "B") {
			editBibliography = true;
		} else if(vars[3] != "!") {
			editCitationIndex = vars[3];
		}
		
		// first collect entire bibliography
		var editCitation = false;
		for(var i=4; i<vars.length; i+=2) {
			if(vars[i+1] == "X") {	// new citation has field name X
				// only one new/edited field at a time; others get deleted
				if(editCitationIndex === false) {
					editCitationIndex = vars[i];
				} else {
					session.deleteCitation(vars[i]);
				}
			} else if(editCitationIndex !== false && vars[i] == editCitationIndex) {
				// save citation data
				editCitation = session.unserializeCitation(vars[i+1], vars[i]);
			} else {
				session.addCitation(vars[i], vars[i+1]);
			}
		}
		
		session.updateItemSet();
		
		if(editCitationIndex) { 
			session.updateCitations(editCitationIndex-1);
			var added = session.editCitation(editCitationIndex, editCitation);
			if(!added) {
				if(editCitation) {
					session.addCitation(editCitationIndex, editCitation);
				} else {
					session.deleteCitation(editCitationIndex);
				}
			}
			session.updateItemSet();
		}
		session.updateCitations();
		
		if(editBibliography) {
			session.editBibliography();
		}
		
		// update
		var output = new Array();
		if((bibliographyMode == "updated"			// if we want updated bib
				&& session.bibliographyHasChanged)	// and bibliography changed
				|| bibliographyMode == "true") {	// or if we should generate regardless of changes
			var bibliography = session.getBibliography();
			if(!bibliography) bibliography = "!";
			
			output.push(bibliography);
		} else {	// otherwise, send no bibliography
			output.push("!");
		}
		
		if(session.bibliographyDataHasChanged) {
			var data = session.getBibliographyData();
			output.push(data !== "" ? data : "X");
		} else {
			output.push("!");
		}
		
		// get citations
		output = output.concat(session.getCitations(citationMode == "all"));
		
		// reset citationSet
		session.resetRequest();
		
		return output;
	}
	
	/*
	 * restores a session, given all citations
	 * ACCEPTS: version, documentData, styleID, use-endnotes, use-bookmarks(, fieldIndex, fieldName)+
	 * RETURNS: sessionID
	 */
	function restoreSession(vars) {
		if(!vars || !_checkVersion(vars[0])) {
			return "ERROR:"+Zotero.getString("integration.error.incompatibleVersion", Zotero.version);
		}

		try {
			Zotero.Styles.get(vars[2]);
		} catch(e) {
			return "ERROR:prefsNeedReset";
		}
		
		var sessionID = Zotero.randomString();
		var session = Zotero.Integration.sessions[sessionID] = new Zotero.Integration.Session();
		session.setStyle(vars[2], {useEndnotes:vars[3], fieldType:vars[4]});
		
		var encounteredItem = new Object();
		var newField = new Object();
		var regenerate = new Object();
		
		for(var i=5; i<vars.length; i+=2) {
			session.addCitation(vars[i], vars[i+1]);
		}
		
		session.updateItemSet(session.citationsByItemID);
		if(vars[1] != "!") session.loadBibliographyData(vars[1]);
		session.sortItemSet();
		session.resetRequest();
		
		return [sessionID];
	}
	
	/*
	 * sets document preferences
	 * ACCEPTS: (sessionID | "!"), version
	 * RETURNS: version, sessionID, styleID, style-class, has-bibliography, use-endnotes, use-bookmarks
	 */
	function setDocPrefs(vars) {
		if(!vars || !vars.length || !_checkVersion(vars[1])) {
			return "ERROR:"+Zotero.getString("integration.error.incompatibleVersion", Zotero.version);
		}
		
		var io = new function() {
			this.wrappedJSObject = this;
		}
		
		var version = vars[1].split("/");
		if(version[2].substr(0, 3) == "OOo") {
			io.openOffice = true;
		}
		
		var oldStyle = false;
		if(vars[0] == "!") {
			// no session ID; generate a new one
			var sessionID = Zotero.randomString();
			var session = Zotero.Integration.sessions[sessionID] = new Zotero.Integration.Session();
		} else {
			// session ID exists
			var sessionID = vars[0];
			var session = Zotero.Integration.sessions[sessionID];
			if(!session) return "ERROR:sessionExpired";
			
			oldStyle = io.style = session.styleID;
			io.useEndnotes = session.prefs.useEndnotes;
			io.useBookmarks = session.prefs.fieldType;
		}
		
		Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
			.getService(Components.interfaces.nsIWindowWatcher)
			.openWindow(
				null, 'chrome://zotero/content/integrationDocPrefs.xul', '',
				'chrome,modal,centerscreen'
					+ (Zotero.Integration.usePopup ? ',popup' : ''),
				io, true
			);
		session.prefs.useEndnotes = io.useEndnotes;
		session.prefs.fieldType = io.useBookmarks;
		session.setStyle(io.style, session.prefs);
		if(!oldStyle || oldStyle != io.style) {
			session.regenerateAll = session.bibliographyHasChanged = true;
		}
		
		return [sessionID, io.style, session.style.class, session.style.hasBibliography ? "1" : "0", io.useEndnotes, io.useBookmarks];
	}
	
	/*
	 * checks to see whether this version of the Integration API is compatible
	 * with the given version of the plug-in
	 */
	function _checkVersion(version) {
		versionParts = version.split("/");
		Zotero.debug("Integration: client version "+version);
		if(versionParts.length != 3 || versionParts[1] != COMPAT_API_VERSION) return false;
		return true;
	}
}

/*
 * keeps track of all session-specific variables
 */
Zotero.Integration.Session = function() {
	// holds items not in document that should be in bibliography
	this.uncitedItems = new Object();
	this.prefs = new Object();
	this.reselectItem = new Object();
	
	this.resetRequest();
}

/*
 * changes the Session style
 */
Zotero.Integration.Session.prototype.setStyle = function(styleID, prefs) {
	this.prefs = prefs;
	if(styleID) {
		this.styleID = styleID;
		try {
			this.style = Zotero.Styles.get(styleID).csl;
			this.dateModified = new Object();
			
			this.itemSet = this.style.createItemSet();
			this.loadUncitedItems();
		} catch(e) {
			Zotero.debug(e)
			this.styleID = undefined;
			return false;
		}
		
		return true;
	}
	return false;
}

/*
 * resets per-request variables in the CitationSet
 */
Zotero.Integration.Session.prototype.resetRequest = function() {
	this.citationsByItemID = new Object();
	this.citationsByIndex = new Array();
	
	this.haveMissing = false;
	this.regenerateAll = false;
	this.bibliographyHasChanged = false;
	this.bibliographyDataHasChanged = false;
	this.updateItemIDs = new Object();
	this.updateIndices = new Object();
}

/*
 * generates a field from a citation object
 */
Zotero.Integration.Session._acceptableTypes = ["string", "boolean", "number"];
Zotero.Integration.Session._saveProperties = ["custom", "sort"];
Zotero.Integration.Session.prototype.getCitationField = function(citation) {
	var type, field = "";
	
	for(var j=0; j<Zotero.Integration.Session._saveProperties.length; j++) {
		var property = Zotero.Integration.Session._saveProperties[j];
		if(citation.properties[property] || citation.properties[property] === false) {
			field += ',"'+property+'":'+Zotero.JSON.serialize(citation.properties[property]);
		}
	}

	var citationItems = "";
	for(var j=0; j<citation.citationItems.length; j++) {
		var citationItem = "";
		
		// ensure key is saved
		if(citation.citationItems[j].key == undefined) {
			citation.citationItems[j].key = citation.citationItems[j].item.key;
		}
		
		for(var k in citation.citationItems[j]) {
			type = typeof(citation.citationItems[j][k]);
			if(citation.citationItems[j][k] && k != "itemID" && Zotero.Integration.Session._acceptableTypes.indexOf(type) !== -1) {
				citationItem += ',"'+k+'":'+Zotero.JSON.serialize(citation.citationItems[j][k]);
			}
		}
		citationItems += ",{"+citationItem.substr(1)+"}";
	}
	field += ',"citationItems":['+citationItems.substr(1)+"]";
	
	return "{"+field.substr(1)+"}";
}

/*
 * adds a citation based on a serialized Word field
 */
Zotero.Integration._oldCitationLocatorMap = {
	p:Zotero.CSL.LOCATOR_PAGES,
	g:Zotero.CSL.LOCATOR_PARAGRAPH,
	l:Zotero.CSL.LOCATOR_LINE
};

/*
 * gets a Zotero.CSL.Citation object given a field name
 */
Zotero.Integration.Session.prototype.addCitation = function(index, arg) {
	var index = parseInt(index, 10);
	
	if(typeof(arg) == "string") {	// text field
		if(arg == "!" || arg == "X") return;
		
		var citation = this.unserializeCitation(arg, index);
	} else {					// a citation already
		var citation = arg;
	}
	
	var completed = this.completeCitation(citation);
	
	// add to citationsByItemID and citationsByIndex
	if(completed) {
		for(var i=0; i<citation.citationItems.length; i++) {
			var citationItem = citation.citationItems[i];
			if(!this.citationsByItemID[citationItem.itemID]) {
				this.citationsByItemID[citationItem.itemID] = [citation];
			} else {
				var byItemID = this.citationsByItemID[citationItem.itemID];
				if(byItemID[byItemID.length-1].properties.index < index) {
					// if index is greater than the last index, add to end
					byItemID.push(citation);
				} else {
					// otherwise, splice in at appropriate location
					for(var j=0; byItemID[j].properties.index < index && j<byItemID.length-1; j++) {}
					byItemID.splice(j, 0, citation);
				}
			}
		}
	} else {
		this.updateIndices[index] = true;
		this.haveMissing = true;
	}
	
	citation.properties.index = index;
	this.citationsByIndex[index] = citation;
}

/*
 * adds items to a citation whose citationItems contain only item IDs
 */
Zotero.Integration.Session.prototype.completeCitation = function(object) {
	// replace item IDs with real items
	var missing = [];
	var missingItems = [];
	for(var i=0; i<object.citationItems.length; i++) {
		var citationItem = object.citationItems[i];
		
		// deal with a reselected item
		if(citationItem.key && this.reselectItem[citationItem.key]) {
			citationItem.itemID = this.reselectItem[citationItem.key];
			citationItem.key = undefined;
		} else if(citationItem.itemID && this.reselectItem[citationItem.itemID]) {
			citationItem.itemID = this.reselectItem[citationItem.itemID];
			citationItem.key = undefined;
		}
		
		if(citationItem.key !== undefined) {
			var item = this.itemSet.getItemsByKeys([citationItem.key])[0];
		} else {
			this.updateItemIDs[citationItem.itemID] = true;
			var item = this.itemSet.getItemsByIds([citationItem.itemID])[0];
		}
		
		// loop through items not in itemSet
		if(item == false) {
			var zoteroItem = null;
			if(citationItem.key) {
				zoteroItem = Zotero.Items.getByKey(citationItem.key);
			} else {
				zoteroItem = Zotero.Items.get(citationItem.itemID);
			}
			if(!zoteroItem) {
				// item does not exist
				missing.push(i);
				missingItems.push(citationItem.key ? citationItem.key : citationItem.itemID);
				continue;
			}
			item = this.itemSet.add([zoteroItem])[0];
			
			this.dateModified[citationItem.itemID] = item.zoteroItem.getField("dateModified", true, true);
			this.updateItemIDs[citationItem.itemID] = true;
			this.bibliographyHasChanged = true;
		}
		
		citationItem.item = item;
		if(!citationItem.itemID) citationItem.itemID = item.id;
	}
	if(missing.length) {
		object.properties.missing = missing;
		object.properties.missingItems = missingItems;
		return false;
	}
	return true;
}

/*
 * unserializes a JSON citation into a citation object (sans items)
 */
Zotero.Integration.Session.prototype.unserializeCitation = function(arg, index) {
	if(arg[0] == "{") {		// JSON field
		// create citation
		var citation = this.style.createCitation();
		
		// fix for corrupted fields
		var lastBracket = arg.lastIndexOf("}");
		if(lastBracket+1 != arg.length) {
			arg = arg.substr(0, lastBracket+1);
			this.updateIndices[index] = true;
		} else {
			citation.properties.field = arg;
		}
		
		// get JSON
		var object = Zotero.JSON.unserialize(arg);
		
		// Fix uppercase citation codes
		if(object.CITATIONITEMS) {
			object.citationItems = [];
			for (var i=0; i<object.CITATIONITEMS.length; i++) {
				for (var j in object.CITATIONITEMS[i]) {
					switch (j) {
						case 'ITEMID':
							var field = 'itemID';
							break;
							
						// 'position', 'custom'
						default:
							var field = j.toLowerCase();
					}
					if (!object.citationItems[i]) {
						object.citationItems[i] = {};
					}
					object.citationItems[i][field] = object.CITATIONITEMS[i][j];
				}
			}
		}
		
		// copy properties
		for(var i in object) {
			if(Zotero.Integration.Session._saveProperties.indexOf(i) != -1) {
				citation.properties[i] = object[i];
			} else {
				citation[i] = object[i];
			}
		}
	} else {				// ye olde style field
		var underscoreIndex = arg.indexOf("_");
		var itemIDs = arg.substr(0, underscoreIndex).split("|");
		
		var lastIndex = arg.lastIndexOf("_");
		if(lastIndex != underscoreIndex+1) {
			var locatorString = arg.substr(underscoreIndex+1, lastIndex-underscoreIndex-1);
			var locators = locatorString.split("|");
		}
		
		var citationItems = new Array();
		for(var i=0; i<itemIDs.length; i++) {
			var citationItem = {itemID:itemIDs[i]};
			if(locators) {
				citationItem.locator = locators[i].substr(1);
				citationItem.locatorType = Zotero.Integration._oldCitationLocatorMap[locators[i][0]];
			}
			citationItems.push(citationItem);
		}
		
		var citation = this.style.createCitation(citationItems);
		this.updateIndices[index] = true;
	}
	
	return citation;
}

/*
 * marks a citation for removal
 */
Zotero.Integration.Session.prototype.deleteCitation = function(index, key) {
	this.citationsByIndex[index] = {properties:{"delete":true}};
	if(key) this.citationsByIndex[index].properties.key = key;
	this.updateIndices[index] = true;
}

/*
 * returns a preview, given a citation object (whose citationItems lack item 
 * and position) and an index
 */
Zotero.Integration.Session.prototype.previewCitation = function(citation) {
	// get length of item set, so we can tell how many items we've added
	var itemSetLength = this.itemSet.items.length;
	// add citation items
	this.completeCitation(citation);
	// get list of items we later have to delete
	var deleteItems = this.itemSet.items.slice(itemSetLength, this.itemSet.items.length);
	// get position
	this.getCitationPositions(citation);
	// sort item set
	this.sortItemSet();
	// sort citation if desired
	if(citation.properties.sort) {
		citation.sort();
	}
	// get preview citation
	var text = this.style.formatCitation(citation, "Integration");
	
	// delete from item set
	if(deleteItems.length) {
		this.itemSet.remove(deleteItems);
	}
	
	return text;
}
 

/*
 * brings up the addCitationDialog, prepopulated if a citation is provided
 */
Zotero.Integration.Session.prototype.editCitation = function(index, citation) {
	var me = this;
	var io = new function() { this.wrappedJSObject = this; }
	
	// if there's already a citation, make sure we have item IDs in addition to keys
	if(citation) {
		for each(var citationItem in citation.citationItems) {
			if(citationItem.key && !citationItem.itemID) {
				var item = Zotero.Items.getByKey([citationItem.key]);
				if(item) citationItem.itemID = item.itemID;
			}
		}
	}
	
	// create object to hold citation
	io.citation = (citation ? citation.clone() : this.style.createCitation());
	io.citation.properties.index = parseInt(index, 10);
	// assign preview function
	io.previewFunction = function() {
		return me.previewCitation(io.citation);
	}
	
	Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
			.getService(Components.interfaces.nsIWindowWatcher)
			.openWindow(
				null, 'chrome://zotero/content/addCitationDialog.xul', '',
				'chrome,modal,centerscreen,resizable=yes'
					+ (Zotero.Integration.usePopup ? ',popup' : ''),
				io
			);
	
	if(citation && !io.citation.citationItems.length) {
		io.citation = citation;
	}
	
	if(io.citation.citationItems.length) {		// we have an item
		this.addCitation(index, io.citation);
		this.updateIndices[index] = true;
	}
	
	// resort item set if necessary
	this.sortItemSet();
	
	return !!io.citation.citationItems.length;
}

/*
 * sets position attribute on a citation
 */
Zotero.Integration.Session.prototype.getCitationPositions = function(citation, update) {
	for(var previousIndex = citation.properties.index-1;
		previousIndex != -1
			&& (!this.citationsByIndex[previousIndex]
			|| this.citationsByIndex[previousIndex].properties["delete"]); 
		previousIndex--) {}
	var previousCitation = (previousIndex == -1 ? false : this.citationsByIndex[previousIndex]);
	
	// if only one source, and it's the same as the last, use ibid
	if(		// there must be a previous citation with one item, and this citation
			// may only have one item
			previousCitation && citation.citationItems.length == 1
			&& previousCitation.citationItems.length == 1
			// the previous citation must have been a citation of the same item
			&& citation.citationItems[0].item == previousCitation.citationItems[0].item
			// and if the previous citation had a locator (page number, etc.) 
			// then this citation must have a locator, or else we should do the 
			// full citation (see Chicago Manual of Style)
			&& (!previousCitation.citationItems[0].locator || citation.citationItems[0].locator)) {
		// use ibid, but check whether to use ibid+pages
		var newPosition = (citation.citationItems[0].locator == previousCitation.citationItems[0].locator
			&& citation.citationItems[0].locatorType == previousCitation.citationItems[0].locatorType
			? Zotero.CSL.POSITION_IBID : Zotero.CSL.POSITION_IBID_WITH_LOCATOR);
		// update if desired
		if(update && (citation.citationItems[0].position || newPosition) && citation.citationItems[0].position != newPosition) {
			this.updateIndices[citation.properties.index] = true;
		}
		citation.citationItems[0].position = newPosition;
	} else {
		// loop through to see which are first citations
		for(var i=0; i<citation.citationItems.length; i++) {
			var citationItem = citation.citationItems[i];
			var newPosition = (!this.citationsByItemID[citationItem.itemID]
					|| this.citationsByItemID[citationItem.itemID][0].properties.index >= citation.properties.index
				? Zotero.CSL.POSITION_FIRST : Zotero.CSL.POSITION_SUBSEQUENT);
			
			// update if desired
			if(update && (citation.citationItems[i].position || newPosition) && citation.citationItems[i].position != newPosition) {
				this.updateIndices[citation.properties.index] = true;
			}
			citation.citationItems[i].position = newPosition;
		}
	}
}

/*
 * marks citations for update, where necessary
 */
Zotero.Integration.Session.prototype.updateCitations = function(toIndex) {
	if(!toIndex) toIndex = this.citationsByIndex.length-1;
	for(var i=0; i<=toIndex; i++) {
		var citation = this.citationsByIndex[i];
		// get position, updating if necesary
		if(citation && !citation.properties["delete"] && !citation.properties.custom) {
			this.getCitationPositions(citation, true);
		}
	}
}

/*
 * updates the ItemSet, adding and deleting bibliography items as appropriate,
 * then re-sorting
 */
Zotero.Integration.Session.prototype.updateItemSet = function() {
	var deleteItems = [];
	var missingItems = [];
	
	// see if items were deleted from Zotero
	for(var i in this.citationsByItemID) {
		if (!Zotero.Items.get(i)) {
			deleteItems.push(i);
			missingItems.push(i);
		}
	}
	
	// see if old items were deleted or changed
	for each(var item in this.itemSet.items) {
		var itemID = item.id;
		
		// see if items were removed 
		if(!this.citationsByItemID[itemID] && !this.uncitedItems[item.key]) {
			deleteItems.push(itemID);
			continue;
		}

		if(item.zoteroItem && this.dateModified[itemID] != item.zoteroItem.getField("dateModified", true, true)) {
			// update date modified
			this.dateModified[itemID] = item.zoteroItem.getField("dateModified", true, true);
			// add to list of updated item IDs
			this.updateItemIDs[itemID] = true;
		}
	}
	
	// delete items from item set
	if(deleteItems.length) {
		this.itemSet.remove(deleteItems);
		this.bibliographyHasChanged = true;
	}
	
	// add missing attribute to citations of missing items
	if(missingItems.length) {
		for each(var i in missingItems) {
			if(this.citationsByItemID[i].length) {
				for(var j=0; j<this.citationsByItemID[i].length; j++) {
					this.updateIndices[this.citationsByItemID[i][j].properties.index] = true;
					this.completeCitation(this.citationsByItemID[i][j]);
				}
			}
		}
		this.haveMissing = true;
	} else {
		this.sortItemSet();
	}
}

/*
 * sorts the ItemSet (what did you think it did?)
 */
Zotero.Integration.Session.prototype.sortItemSet = function() {
	// save first index
	for(var itemID in this.citationsByItemID) {
		if(this.citationsByItemID[itemID]) {
			var item = this.itemSet.getItemsByIds([itemID])[0];
			if(item) item.setProperty("index", this.citationsByItemID[itemID][0].properties.index);
		}
	}
	
	var citationChanged = this.itemSet.resort();
	
	// add to list of updated item IDs
	for each(var item in citationChanged) {
		this.updateItemIDs[item.id] = true;
		this.bibliographyHasChanged = true;
	}
}

/*
 * edits integration bibliography
 */
Zotero.Integration.Session.prototype.editBibliography = function() {
	var bibliographyEditor = new Zotero.Integration.Session.BibliographyEditInterface(this);
	var io = new function() { this.wrappedJSObject = bibliographyEditor; }
	
	this.bibliographyDataHasChanged = this.bibliographyHasChanged = true;
	
	Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
			.getService(Components.interfaces.nsIWindowWatcher)
			.openWindow(
				null, 'chrome://zotero/content/editBibliographyDialog.xul', '',
				'chrome,modal,centerscreen,resizable=yes'
					+ (Zotero.Integration.usePopup ? ',popup' : ''),
				io,
				true
			);
}

/*
 * gets integration bibliography
 */
Zotero.Integration.Session.prototype.getBibliography = function(useXML) {
	// get preview citation
	if(useXML) {
		// use real RTF in XML incarnation, but chop off the first \n
		var text = this.style.formatBibliography(this.itemSet, "RTF")
		var nlIndex = text.indexOf("\n");
		if(nlIndex !== -1) {
			return "{\\rtf "+text.substr(text.indexOf("\n"));
		} else {
			return "";
		}
	} else {
		return this.style.formatBibliography(this.itemSet, "Integration");
	}
}

/*
 * gets citations in need of update
 */
Zotero.Integration.Session.prototype.getCitations = function(regenerateAll, useXML) {
	if(regenerateAll || this.regenerateAll) {
		// update all indices
		for(var i=0; i<this.citationsByIndex.length; i++) {
			this.updateIndices[i] = true;
		}
	} else {
		// update only item IDs
		for(var i in this.updateItemIDs) {
			if(this.citationsByItemID[i] && this.citationsByItemID[i].length) {
				for(var j=0; j<this.citationsByItemID[i].length; j++) {
					this.updateIndices[this.citationsByItemID[i][j].properties.index] = true;
				}
			}
		}
	}
	
	var output = (useXML ? <citations/> : []);
	var citation;
	
	for(var i in this.updateIndices) {
		citation = this.citationsByIndex[i];
		
		if(!citation) continue;
		
		if(useXML) {
			var citationXML = <citation index={i}/>;
		} else {
			output.push(i);
		}
		
		if(citation.properties["delete"] || citation.properties.missing) {
			// delete citation, or flag as missing
			if(useXML) {
				if(citation.properties.missing) {
					if(citation.citationItems.length > 1) {
						// use n tags if there are multiple items in the citation
						for(var j=0; j<citation.properties.missing.length; j++) {
							citationXML.missing += <missing n={citation.properties.missing[j]+1} 
								id={citation.properties.missingItems[j]}/>;
						}
					} else {
						citationXML.missing = <missing id={citation.properties.missingItems[0]}/>;
					}
				} else {
					citationXML["@delete"] = "1";
				}
				output.appendChild(citationXML);
			} else {
				output.push("!");
				output.push("!");
			}
		} else if(!useXML || !this.haveMissing) {
			var field = this.getCitationField(citation);

			if(useXML) {
				if(field != citation.properties.field) {
					citationXML.code = field;
				}
			} else {
				output.push(field == citation.properties.field ? "!" : field);
			}
			
			if(citation.properties.custom) {
				var citationText = citation.properties.custom;
				if(useXML) {
					// XML uses real RTF, rather than the format used for
					// integration, so we have to escape things properly
					citationText = citationText.replace(/[\x7F-\uFFFF]/g,
						Zotero.Integration.Session._rtfEscapeFunction).
						replace("\t", "\\tab ", "g");
				}
			} else if(useXML) {
				var citationText = this.style.formatCitation(citation, "RTF");
			} else {
				var citationText = this.style.formatCitation(citation, "Integration");
			}
			
			if(useXML) {
				citationXML.text = "{\\rtf "+citationText+"}";
			} else {
				output.push(citationText == "" ? " " : citationText);
			}
			
			if(useXML) output.appendChild(citationXML);
		}
	}
	
	return output;
}

Zotero.Integration.Session._rtfEscapeFunction = function(aChar) {
	return "{\\uc0\\u"+aChar.charCodeAt(0).toString()+"}"
}

/*
 * loads document data from a JSON object
 */
Zotero.Integration.Session.prototype.loadBibliographyData = function(json) {
	var documentData = Zotero.JSON.unserialize(json);
	
	// set uncited
	if(documentData.uncited) {
		this.uncitedItems = documentData.uncited;
		this.loadUncitedItems();
	} else {
		this.uncitedItems = new Object();
	}
	
	// set custom bibliography entries
	if(documentData.custom) {
		for(var itemID in documentData.custom) {
			if(typeof(itemID) == "string") {	// key
				var item = this.itemSet.getItemsByKeys([itemID])[0];
			} else {							// item ID
				this.bibliographyDataHasChanged = true;
				var item = this.itemSet.getItemsByIds([itemID])[0];
			}
			if (!item) {
				continue;
			}
			item.setProperty("bibliography-Integration", documentData.custom[itemID]);
			item.setProperty("bibliography-RTF", documentData.custom[itemID]);
		}
	}
}

/*
 * adds items in this.uncitedItems to itemSet, if they are not already there
 */
Zotero.Integration.Session.prototype.loadUncitedItems = function() {
	var needConversion = false;
	
	for(var itemID in this.uncitedItems) {
		// skip "undefined"
		if(!this.uncitedItems[itemID]) continue;
		
		// if not yet in item set, add to item set
		if(typeof(itemID) == "string") {	// key
			var item = this.itemSet.getItemsByKeys([itemID])[0];
			itemID = Zotero.Items.getByKey(itemID);
		} else {							// item ID
			needConversion = true;
			var item = this.itemSet.getItemsByIds([itemID])[0];
		}
		if(!item) this.itemSet.add([itemID])[0];
	}
	
	// need a second loop to convert, since we need to modify this.uncitedItems
	if(needConversion) {
		this.bibliographyDataHasChanged = true;
		
		oldUncitedItems = this.uncitedItems;
		this.uncitedItems = {};
		for(var itemID in oldUncitedItems) {
			if(!oldUncitedItems[itemID]) continue;
			
			if(typeof(itemID) == "string") {	// key
				this.uncitedItems[itemID] = true;
			} else {							// itemID
				var item = Zotero.Items.get(itemID);
				if(item) {
					this.uncitedItems[item.key] = true;
				}
			}
		}
	}
}

/*
 * saves document data from a JSON object
 */
Zotero.Integration.Session.prototype.getBibliographyData = function() {
	var bibliographyData = {};
	
	// add uncited if there is anything
	for each(var item in this.uncitedItems) {
		if(item) {
			bibliographyData.uncited = this.uncitedItems;
			break;
		}
	}
	
	// look for custom bibliography entries
	if(this.itemSet.items.length) {
		for(var i=0; i<this.itemSet.items.length; i++) {
			var custom = this.itemSet.items[i].getProperty("bibliography-RTF");
			if(custom !== "") {
				if(!bibliographyData.custom) bibliographyData.custom = {};
				bibliographyData.custom[this.itemSet.items[i].key] = custom;
			}
		}
	}
	
	if(bibliographyData.uncited || bibliographyData.custom) {
		return Zotero.JSON.serialize(bibliographyData);
	} else {
		return ""; 	// nothing
	}
}

/**
 * @class Interface for bibliography editor to alter document bibliography
 * @constructor
 * Creates a new bibliography editor interface
 * @param {Zotero.Integration.Session} session
 */
Zotero.Integration.Session.BibliographyEditInterface = function(session) {
	this.session = session;
}

/**
 * Gets the @link {Zotero.CSL.ItemSet} for the bibliography being edited
 * The item set should not be modified, but may be used to determine what items are in the
 * bibliography.
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.getItemSet = function() {
	return this.session.itemSet;
}

/**
 * Checks whether an item is cited in the bibliography being edited
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.isCited = function(item) {
	if(this.session.citationsByItemID[item.id]) return true;
	return false;
}

/**
 * Checks whether an item is cited in the bibliography being edited
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.add = function(item) {
	// create new item
	this.session.itemSet.add([item]);
	this.session.uncitedItems[item.key] = true;
	this.session.sortItemSet();
}

/**
 * Removes an item from the bibliography being edited
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.remove = function(item) {
	// create new item
	this.session.itemSet.remove([item]);
	this.session.sortItemSet();
	
	// delete citations if necessary
	var itemID = item.id;
	if(this.session.citationsByItemID[itemID]) {		
		for(var j=0; j<this.session.citationsByItemID[itemID].length; j++) {
			var citation = this.session.citationsByItemID[itemID][j];
			this.session.updateIndices[citation.properties.index] = true;
			citation.properties["delete"] = true;
		}
	}
	
	// delete uncited if neceessary
	if(this.session.uncitedItems[item.key]) this.session.uncitedItems[item.key] = undefined;
}

/**
 * Generates a preview of the bibliography entry for a given item
 */
Zotero.Integration.Session.BibliographyEditInterface.prototype.preview = function(item) {
	var itemSet = this.session.style.createItemSet([item]);
	return this.session.style.formatBibliography(itemSet, "Integration");
}