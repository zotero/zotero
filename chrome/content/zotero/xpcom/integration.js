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

const API_VERSION = 3;

Zotero.Integration = new function() {
	var _contentLengthRe = /[\r\n]Content-Length: *([0-9]+)/i;
	var _XMLRe = /<\?[^>]+\?>/;
	this.ns = "http://www.zotero.org/namespaces/SOAP";
	
	this.init = init;
	this.handleHeader = handleHeader;
	this.handleEnvelope = handleEnvelope;
	
	/*
	 * initializes a very rudimentary web server used for SOAP RPC
	 */
	function init() {
		// start listening on socket
		var sock = Components.classes["@mozilla.org/network/server-socket;1"];
		serv = sock.createInstance();
		serv = serv.QueryInterface(Components.interfaces.nsIServerSocket);
		
		try {
			// bind to a random port on loopback only
			serv.init(50001, true, -1);
			serv.asyncListen(Zotero.Integration.SocketListener);
			
			Zotero.debug("Integration HTTP server listening on 127.0.0.1:"+serv.port);
		} catch(e) {
			Zotero.debug("Not initializing integration HTTP");
		}
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
		
		var env = new Namespace("http://schemas.xmlsoap.org/soap/envelope/");
		var xml = new XML(envelope);
		var request = xml.env::Body.children()[0];
		if(request.namespace() != this.ns) {
			Zotero.debug("Integration: SOAP method not supported: invalid namespace");
		} else {
			var name = request.localName();
			if(Zotero.Integration.SOAP[name]) {
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
				var output = Zotero.Integration.SOAP[name](vars);
				
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
}

Zotero.Integration.SocketListener = new function() {
	this.onSocketAccepted = onSocketAccepted;
	
	/*
	 * called when a socket is opened
	 */
	function onSocketAccepted(socket, transport) {
		// get an input stream
		var iStream = transport.openInputStream(0, 0, 0);
		var oStream = transport.openOutputStream(0, 0, 0);
		
		var dataListener = new Zotero.Integration.DataListener(iStream, oStream);
		var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"]
							 .createInstance(Components.interfaces.nsIInputStreamPump);
		pump.init(iStream, -1, -1, 0, 0, false);
		pump.asyncRead(dataListener, null);
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
	} catch(e) {
		Zotero.debug("An error occurred.");
		Zotero.debug(e);
	} finally {	
		intlStream.close();
	}
}

Zotero.Integration.SOAP = new function() {
	// SOAP methods
	this.init = init;
	this.update = update;
	this.restoreSession = restoreSession;
	this.setDocPrefs = setDocPrefs;
	
	var _sessions = new Array();
	var watcher;
	
	function init() {
		watcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
		                    .getService(Components.interfaces.nsIWindowWatcher);
	}
	
	/*
	 * generates a new citation for a given item
	 * ACCEPTS: sessionID, bibliographyMode, citationMode, editCitationIndex(, fieldIndex, fieldName)+
	 * RETURNS: bibliography, documentData(, fieldIndex, fieldRename, fieldContent)+
	 */
	function update(vars) {
		if(!_sessions[vars[0]]) return "ERROR:sessionExpired";
		
		var session = _sessions[vars[0]];
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
				editCitation = session.unserializeCitation(vars[i+1]);
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
				&& session.itemSetHasChanged)		// and bibliography changed
				|| bibliographyMode == "true") {	// or if we should generate regardless of changes
			var bibliography = session.getBibliography();
			if(!bibliography) bibliography = "!";
			
			output.push(bibliography);
		} else {	// otherwise, send no bibliography
			output.push("!");
		}
		
		if(session.documentDataHasChanged) {
			output.push(session.getDocumentData());
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
			return "ERROR:"+Zotero.getString("integration.incompatibleVersion");
		}
		
		var sessionID = Zotero.randomString();
		
		var session = _sessions[sessionID] = new Zotero.Integration.Session();
		session.setStyle(vars[2], vars[3], vars[4]);
		
		var encounteredItem = new Object();
		var newField = new Object();
		var regenerate = new Object();
		
		for(var i=5; i<vars.length; i+=2) {
			session.addCitation(vars[i], vars[i+1]);
		}
		
		session.updateItemSet(session.citationsByItemID);
		if(vars[1] != "!") session.loadDocumentData(vars[1]);
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
			return "ERROR:"+Zotero.getString("integration.incompatibleVersion");
		}
		
		var io = new function() {
			this.wrappedJSObject = this;
		}
		
		var version = vars[1].split("/");
		if(version[2].substr(0, 3) == "OOo") {
			io.openOffice = true;
		}
		
		if(vars[0] == "!") {
			// no session ID; generate a new one
			var sessionID = Zotero.randomString();
			var session = _sessions[sessionID] = new Zotero.Integration.Session();
		} else {
			// session ID exists
			var sessionID = vars[0];
			var session = _sessions[sessionID];
			if(!session) return "ERROR:sessionExpired";
			
			io.style = session.styleID;
			io.useEndnotes = session.useEndnotes;
			io.useBookmarks = session.useBookmarks;
		}
		
		watcher.openWindow(null, 'chrome://zotero/content/integrationDocPrefs.xul', '',
		                   'chrome,modal'+(Zotero.isWin ? ',popup' : ''), io, true);
		session.setStyle(io.style, io.useEndnotes, io.useBookmarks);
		
		return [sessionID, io.style, session.style.class, session.style.hasBibliography ? "1" : "0", io.useEndnotes, io.useBookmarks];
	}
	
	/*
	 * checks to see whether this version of the Integration API is compatible
	 * with the given version of the plug-in
	 */
	function _checkVersion(version) {
		versionParts = version.split("/");
		Zotero.debug("Integration: client version "+version);
		if(versionParts.length != 3 || versionParts[1] != API_VERSION) return false;
		return true;
	}
}

/*
 * keeps track of all session-specific variables
 */
Zotero.Integration.Session = function() {
	// holds items not in document that should be in bibliography
	this.uncitedItems = new Object();
	
	this.resetRequest();
}

/*
 * changes the Session style
 */
Zotero.Integration.Session.prototype.setStyle = function(styleID, useEndnotes, useBookmarks) {
	this.styleID = styleID;
	this.style = Zotero.Cite.getStyle(styleID);
	this.useEndnotes = useEndnotes;
	this.useBookmarks = useBookmarks;
	
	this.itemSet = this.style.createItemSet();
	this.dateModified = new Object();
	this.itemSetIsSorted = true;
	
	this.loadUncitedItems();
}

/*
 * resets per-request variables in the CitationSet
 */
Zotero.Integration.Session.prototype.resetRequest = function() {
	this.citationsByItemID = new Object();
	this.citationsByIndex = new Array();
	
	this.itemSetHasChanged = false;
	this.documentDataHasChanged = false;
	this.updateItemIDs = new Object();
	this.updateIndices = new Object()
}

/*
 * generates a field from a citation object
 */
Zotero.Integration.Session._acceptableTypes = ["string", "boolean", "number"];
Zotero.Integration.Session._saveProperties = ["custom"];
Zotero.Integration.Session.prototype.getCitationField = function(citation) {
	var type, field = "";
	
	for(var j=0; j<Zotero.Integration.Session._saveProperties.length; j++) {
		var property = Zotero.Integration.Session._saveProperties[j];
		if(citation.properties[property]) {
			field += ',"'+property+'":'+Zotero.JSON.serialize(citation.properties[property]);
		}
	}

	var citationItems = "";
	for(var j=0; j<citation.citationItems.length; j++) {
		var citationItem = "";
		for(var k in citation.citationItems[j]) {
			type = typeof(citation.citationItems[j][k]);
			if(citation.citationItems[j][k] && Zotero.Integration.Session._acceptableTypes.indexOf(type) !== -1) {
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
	if(typeof(arg) == "string") {	// text field
		if(arg == "!" || arg == "X") return;
		
		var citation = this.unserializeCitation(arg);
		if(arg[0] == "{") {		// JSON
			citation.properties.field = arg;
		} else {
			this.updateIndices[citation.properties.index];
		}
	} else {					// a citation already
		var citation = arg;
	}
	
	var completed = this.completeCitation(citation);
	if(!completed) {
		// doesn't exist
		this.deleteCitation(index);
		return;
	}
	
	// add to citationsByItemID and citationsByIndex
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
	
	citation.properties.index = index;
	this.citationsByIndex[index] = citation;
}

/*
 * adds items to a citation whose citationItems contain only item IDs
 */
Zotero.Integration.Session.prototype.completeCitation = function(object) {
	// replace item IDs with real items
	for(var i=0; i<object.citationItems.length; i++) {
		var citationItem = object.citationItems[i];
		
		var item = this.itemSet.getItemsByIds([citationItem.itemID])[0];
		
		// loop through items not in itemSet
		if(item == false) {
			item = Zotero.Items.get(citationItem.itemID);
			if(!item) return false;
			item = this.itemSet.add([item])[0];
			
			this.dateModified[citationItem.itemID] = item.zoteroItem.getField("dateModified", true, true);
			this.updateItemIDs[citationItem.itemID] = true;
			this.itemSetChanged();
		}
		
		citationItem.item = item;
	}
	return true;
}

/*
 * unserializes a JSON citation into a citation object (sans items)
 */
Zotero.Integration.Session.prototype.unserializeCitation = function(arg) {
	if(arg[0] == "{") {		// JSON field
		// create citation
		var citation = this.style.createCitation();
		
		// get JSON
		var object = Zotero.JSON.unserialize(arg);
		
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
	}
	
	return citation;
}

/*
 * marks a citation for removal
 */
Zotero.Integration.Session.prototype.deleteCitation = function(index) {
	this.citationsByIndex[index] = {properties:{"delete":true}};
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
		this.itemSetIsSorted = false;
	}
	
	return text;
}
 

/*
 * brings up the addCitationDialog, prepopulated if a citation is provided
 */
Zotero.Integration.Session.prototype.editCitation = function(index, citation) {
	var me = this;
	var io = new function() { this.wrappedJSObject = this; }
	
	// create object to hold citation
	io.citation = (citation ? citation.clone() : this.style.createCitation());
	io.citation.properties.index = index;
	// assign preview function
	io.previewFunction = function() {
		return me.previewCitation(io.citation);
	}
	
	Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
	          .getService(Components.interfaces.nsIWindowWatcher)
	          .openWindow(null, 'chrome://zotero/content/addCitationDialog.xul', '',
					  'chrome,modal'+(Zotero.isWin ? ',popup' : ''), io);
	
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
			|| this.citationsByIndex[previousIndex].properties.delete); 
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
		if(citation && !citation.properties.delete && !citation.properties.custom) {
			this.getCitationPositions(citation, true);
		}
	}
}

/*
 * updates the ItemSet, adding and deleting bibliography items as appropriate,
 * then re-sorting
 */
Zotero.Integration.Session.prototype.updateItemSet = function() {
	var addItems = [];
	var deleteItems = [];
	
	for(var i in this.citationsByItemID) {
		// see if items were deleted from Zotero
		if (!Zotero.Items.get(i)) {
			deleteItems.push(itemID);
			if(this.citationsByItemID[i].length) {
				for(var j=0; j<this.citationsByItemID[i].length; j++) {
					var citation = this.citationsByItemID[i][j];
					this.updateIndices[citation.properties.index] = true;
					citation.properties.delete = true;
				}
			}
			this.itemSetChanged();
		}
	}
	
	// see if old items were deleted or changed
	for each(var item in this.itemSet.items) {
		var itemID = item.getID();
		
		// see if items were removed 
		if(!this.citationsByItemID[itemID] && !this.uncitedItems[itemID]) {
			deleteItems.push(itemID);
			this.itemSetChanged();
			continue;
		}

		if(item.zoteroItem && this.dateModified[itemID] != item.zoteroItem.getField("dateModified", true, true)) {
			// update date modified
			this.dateModified[itemID] = item.zoteroItem.getField("dateModified", true, true);
			// add to list of updated item IDs
			this.updateItemIDs[itemID] = true;
			// need to resort now
			this.itemSetChanged();
		}
	}
	
	if(deleteItems.length) {
		this.itemSet.remove(deleteItems);
	}
	
	this.sortItemSet();
}

/*
 * sorts the ItemSet (what did you think it did?)
 */
Zotero.Integration.Session.prototype.sortItemSet = function() {
	if(!this.itemSetIsSorted) {
		if(!this.itemSet.sortable) {
			// sort by order in document. we need a stable sort, so first we
			// collect old indices.
			var oldItemIndices = new Object();
			for(var i=0; i<this.itemSet.items.length; i++) {
				oldItemIndices[this.itemSet.items[i].getID()] = i;
			}
			
			var me = this;
			this.itemSet.items.sort(function(a, b) { return me.sortByOrderAdded(a, b, oldItemIndices) });
		}
		
		var citationChanged = this.itemSet.resort();
		
		// add to list of updated item IDs
		for each(var item in citationChanged) {
			this.updateItemIDs[item.getID()] = true;
		}
		
		this.itemSetIsSorted = true;
	}
}

/*
 * sorts items by order added
 */
Zotero.Integration.Session.prototype.sortByOrderAdded = function(a, b, oldItemIndices) {
	var aID = a.getID();
	var bID = b.getID();
	
	if(this.citationsByItemID[aID] && this.citationsByItemID[aID].length) {
		if(!this.citationsByItemID[bID] || !this.citationsByItemID[bID].length) return -1;
		
		var diff = this.citationsByItemID[aID][0].properties.index-this.citationsByItemID[bID][0].properties.index;
		if(diff != 0) return diff;
	} else if(this.citationsByItemID[bID] && this.citationsByItemID[bID].length) {
		return 1;
	}
	
	return oldItemIndices[aID]-oldItemIndices[bID];
}

/*
 * marks an itemSet as changed
 */
Zotero.Integration.Session.prototype.itemSetChanged = function() {
	this.itemSetIsSorted = false;
	this.itemSetHasChanged = true;
}

/*
 * edits integration bibliography
 */
Zotero.Integration.Session.prototype.editBibliography = function() {
	var bibliographyEditor = new Zotero.Integration.Session.BibliographyEditInterface(this);
	var io = new function() { this.wrappedJSObject = bibliographyEditor; }
	
	this.documentDataHasChanged = true;
	this.itemSetHasChanged = true;
	
	Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
	          .getService(Components.interfaces.nsIWindowWatcher)
	          .openWindow(null, 'chrome://zotero/content/editBibliographyDialog.xul', '',
					  'chrome,modal'+(Zotero.isWin ? ',popup' : ''), io, true);
	
}

/*
 * gets integration bibliography
 */
Zotero.Integration.Session.prototype.getBibliography = function() {
	return this.style.formatBibliography(this.itemSet, "Integration");
}

/*
 * gets citations in need of update
 */
Zotero.Integration.Session.prototype.getCitations = function(regenerateAll) {
	if(regenerateAll) {
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
	
	var output = [];
	var citation;
	for(var i in this.updateIndices) {
		citation = this.citationsByIndex[i];
		
		if(!citation) continue;
		
		output.push(i);
		if(citation.properties.delete) {
			// delete citation
			output.push("!");
			output.push("!");
		} else {
			var field = this.getCitationField(citation);
			output.push(field == citation.properties.field ? "!" : field);
			
			if(citation.properties.custom) {
				output.push(citation.properties.custom);
			} else {
				output.push(this.style.formatCitation(citation, "Integration"));
			}
		}
	}
	
	return output;
}

/*
 * loads document data from a JSON object
 */
Zotero.Integration.Session.prototype.loadDocumentData = function(json) {
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
			Zotero.debug("getting item "+itemID);
			var item = this.itemSet.getItemsByIds([itemID])[0];
			Zotero.debug(item.toSource());
			item.setProperty("bibliography-Integration", documentData.custom[itemID]);
		}
	}
}

/*
 * adds items in this.uncitedItems to itemSet, if they are not already there
 */
Zotero.Integration.Session.prototype.loadUncitedItems = function() {
	for(var itemID in this.uncitedItems) {
		// skip "undefined"
		if(!this.uncitedItems[itemID]) continue;
		
		// if not yet in item set, add to item set
		var item = this.itemSet.getItemsByIds([itemID])[0];
		if(!item) this.itemSet.add([itemID])[0];
	}
}

/*
 * saves document data from a JSON object
 */
Zotero.Integration.Session.prototype.getDocumentData = function() {
	var documentData = {};
	
	// add uncited if there is anything
	for(var item in this.uncitedItems) {
		documentData.uncited = this.uncitedItems;
		break;
	}
	
	// look for custom bibliography entries
	if(this.itemSet.items.length) {
		for(var i=0; i<this.itemSet.items.length; i++) {
			var custom = this.itemSet.items[i].getProperty("bibliography-Integration");
			if(custom !== "") {
				var itemID = this.itemSet.items[i].getID();
				
				if(!documentData.custom) documentData.custom = {};
				documentData.custom[itemID] = custom;
			}
		}
	}
	
	if(documentData.uncited || documentData.custom) {
		return Zotero.JSON.serialize(documentData);
	} else {
		return "X"; 	// nothing
	}
}

/*
 * Interface for bibliography editor
 */
Zotero.Integration.Session.BibliographyEditInterface = function(session) {
	this.session = session;
}

Zotero.Integration.Session.BibliographyEditInterface.prototype.getItemSet = function() {
	return this.session.itemSet;
}

Zotero.Integration.Session.BibliographyEditInterface.prototype.isCited = function(item) {
	if(this.session.citationsByItemID[item.getID()]) return true;
	return false;
}

Zotero.Integration.Session.BibliographyEditInterface.prototype.add = function(item) {
	// create new item
	this.session.itemSet.add([item]);
	this.session.uncitedItems[item.getID()] = true;
	this.session.itemSetChanged();
	this.session.sortItemSet();
}

Zotero.Integration.Session.BibliographyEditInterface.prototype.remove = function(item) {
	// create new item
	this.session.itemSet.remove([item]);
	this.session.itemSetChanged();
	this.session.sortItemSet();
	
	// delete citations if necessary
	var itemID = item.getID();
	if(this.session.citationsByItemID[itemID]) {		
		for(var j=0; j<this.session.citationsByItemID[itemID].length; j++) {
			var citation = this.session.citationsByItemID[itemID][j];
			this.session.updateIndices[citation.properties.index] = true;
			citation.properties.delete = true;
		}
	}
	
	// delete uncited if neceessary
	if(this.session.uncitedItems[itemID]) this.session.uncitedItems[itemID] = undefined;
}

Zotero.Integration.Session.BibliographyEditInterface.prototype.preview = function(item) {
	var itemSet = this.session.style.createItemSet([item]);
	return this.session.style.formatBibliography(itemSet, "Integration");
}