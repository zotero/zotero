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
	function handleEnvelope(envelope, encoding) {
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
					
					colonIndex = input.indexOf(":");
					while(colonIndex != -1) {
						if(input[colonIndex+1] == ":") {	// escaped
							vars[i] += input.substr(0, colonIndex+1);
							input = input.substr(colonIndex+2);
						} else {							// not escaped
							vars[i] += input.substr(0, colonIndex);
							i++;
							vars[i] = "";
							input = input.substr(colonIndex+1);
						}
						colonIndex = input.indexOf(":");
					}
					vars[i] += input;
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
				
				var response = '<?xml version="1.0" encoding="'+encoding+'"?>\n'+responseEnvelope.toXMLString();
				Zotero.debug("Integration: SOAP Response\n"+response);
				
				// return OK
				return _generateResponse("200 OK", 'text/xml; charset="'+encoding+'"',
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
			response += "Content-Length: "+body.length+"\r\n\r\n"+body;
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
		if(this.body.length > this.bodyLength) {
			// truncate
			this.body = this.body.substr(0, this.bodyLength);
		}
		
		// UTF-8 crashes AppleScript
		var encoding = (this.header.indexOf("\nUser-Agent: Mac OS X") !== -1 ? "macintosh" : "UTF-8");
		var output = Zotero.Integration.handleEnvelope(this.body, encoding);
		this._requestFinished(output, encoding);
	}
}

/*
 * returns HTTP data from a request
 */
Zotero.Integration.DataListener.prototype._requestFinished = function(response, encoding) {
	// close input stream
	this.iStream.close();
	
	if(encoding == "macintosh") {
		// double percent signs
		response = response.replace(/%/g, "%%");
		// replace line endings with percent signs
		response = response.replace(/\n/g, " %!");
		response = response.replace(/\r/g, "");

		// convert Unicode to Mac Roman
		var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"] 
								  .createInstance(Components.interfaces.nsIScriptableUnicodeConverter); 
		converter.charset = "macintosh";
		// convert text
		response = converter.ConvertFromUnicode(response);
		// fix returns
		response = response.replace(/ %!/g, "\n");
		// fix percent signs
		response = response.replace(/%%/g, "%"); 
		response = response + converter.Finish();
	
		// write
		this.oStream.write(response, response.length); 
	} else if(encoding) {
		// open UTF-8 converter for output stream	
		var intlStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
								   .createInstance(Components.interfaces.nsIConverterOutputStream);
		intlStream.init(this.oStream, encoding, 1024, "?".charCodeAt(0));
		
		// write response
		intlStream.writeString(response);
		intlStream.close();
	} else {
		// write
		this.oStream.write(response, response.length);
	}
	
	// close output stream
	this.oStream.close();
}

Zotero.Integration.SOAP = new function() {
	this.init = init;
	this.update = update;
	this.restoreSession = restoreSession;
	this.setDocPrefs = setDocPrefs;
	
	var _sessions = new Array();
	var window;
	
	function init() {
		window = Components.classes["@mozilla.org/appshell/appShellService;1"]
					   .getService(Components.interfaces.nsIAppShellService)
					   .hiddenDOMWindow;
	}
	
	/*
	 * generates a new citation for a given item
	 * ACCEPTS: sessionID, bibliographyMode, citationMode(, fieldIndex, fieldName)+
	 * RETURNS: bibliography(, fieldIndex, fieldRename, fieldContent)+
	 */
	function update(vars) {
		if(!_sessions[vars[0]]) {
			return "ERROR:sessionExpired";
		}
		var session = _sessions[vars[0]];
		var returnString = "";
		var bibliographyMode = vars[1];
		var citationMode = vars[2];
		
		var regenerateAll = (citationMode == "all");
		var citationSet = new Zotero.Integration.CitationSet(session.style);
		var updatedCitations = new Object();
		
		var citation, update;
		for(var i=3; i<vars.length; i+=2) {
			if(vars[i+1] == "X") {
				// get a new citation for a field with an X
				var io = new Object();
				window.openDialog('chrome://zotero/content/addCitationDialog.xul','',
									'chrome,popup,modal', io, true);
				
				citation = new Zotero.Integration.Citation(vars[i], "!");
				updatedCitations[citation.index] = true;
	
				if(io.items) {		// cancel was not pressed
					citation.setData(io.items, io.locators, io.locatorTypes);
					citation.regenerateFieldName();
					citation.updateField = true;
				} else {			// cancel pressed
					citation.deleteCitation = true;
					continue;
				}
			} else {
				// load an existing citation
				citation = new Zotero.Integration.Citation(vars[i], vars[i+1]);
			}
			
			var isDuplicate = citationSet.addCitation(citation);
			if(regenerateAll) {
				// regenerate all citations if requested
				updatedCitations[citation.index] = true;
				citation.updateText = true;
			} else {
				// test to see if this citationType is different from the
				// version stored in the session
				var oldCitation = session.citationSet.citationsByField[citation.field];
				
				if(!oldCitation) {
					// if no stored version, definitely needs update
					citation.updateText = true;
					updatedCitations[citation.index] = true;
				} else if(typeof(citation.citationType) == "object" &&
				          typeof(oldCitation.citationType) == "object") {
					// loop through, looking for differences; we can safely
					// assume IDs have not been changed or added
					for(var j in citation.citationType) {
						if(citation.citationType[j] != oldCitation.citationType[j]) {
							citation.updateText = true;
							updatedCitations[citation.index] = true;
							break;
						}
					}
				} else if(citation.citationType != oldCitation.citationType) {
					citation.updateText = true;
					updatedCitations[citation.index] = true;
				}
			}
			
			if(isDuplicate) {
				// generate a new field name for duplicated fields
				citation.regenerateFieldName();
				updatedCitations[citation.index] = true;
				citation.updateField = true;
			}
		}
		
		var output = new Array();
		
		var itemsChanged = session.citationFactory.updateItems(citationSet, session, updatedCitations);
		if(itemsChanged || bibliographyMode == "true") {
			Zotero.debug("Integration: Regenerating bibliography");
			// EBNF: bibliography-data
			if(bibliographyMode != "false") {
				output.push(session.style.createBibliography(session.citationFactory.items, "Integration"));
			} else {
				output.push("!");
			}
		} else {
			// EBNF: bibliography-data
			output.push("!");
		}
		
		// state which citations to update
		// EBNF: citation-output-triple
		for(var i in updatedCitations) {		
			// EBNF: citation-index
			output.push(i);
			if(citationSet.citationsByIndex[i]) {
				var citation = citationSet.citationsByIndex[i];
				
				// if renamed
				if(citation.updateField) {
					output.push(citation.field);
				} else {
					output.push("!");
				}
				
				// if needs text change
				if(citation.updateText) {
					output.push(session.citationFactory.getCitation(citation));
				} else {
					output.push("!");
				}
			} else {
				output.push("!");
				output.push("!");
			}
		}
		
		session.citationSet = citationSet;
		return output;
	}
	
	/*
	 * restores a session, given all citations
	 * ACCEPTS: styleID(, fieldIndex, fieldName)+
	 * RETURNS: sessionID
	 */
	function restoreSession(vars) {
		var sessionID = Zotero.randomString();
		var session = _sessions[sessionID] = new Zotero.Integration.Session(vars[0]);
		
		var encounteredItem = new Object();
		var newField = new Object();
		var regenerate = new Object();
		
		for(var i=1; i<vars.length; i+=2) {
			var citation = new Zotero.Integration.Citation(vars[i], vars[i+1]);
			session.citationSet.addCitation(citation);		// add to see when refresh is necessary
		}
		
		session.citationFactory.updateItems(session.citationSet);
		
		// regenerate citations for internal use
		for each(var citation in session.citationSet.citationsByIndex) {
			session.citationFactory.getCitation(citation);
		}
		
		return [sessionID];
	}
	
	/*
	 * sets document preferences
	 * ACCEPTS: (sessionID)?
	 * RETURNS: sessionID, styleID, style-class
	 */
	function setDocPrefs(vars) {
		var io = new Object();
		
		if(!vars || !vars[0] || vars[0] == "!") {
			// no session ID; generate a new one
			var sessionID = Zotero.randomString();
			var session = _sessions[sessionID] = new Zotero.Integration.Session();
		} else {
			// session ID exists
			var sessionID = vars[0];
			var session = _sessions[sessionID];
			if(!session) {
				return "ERROR:sessionExpired";
			}
			var originalStyle = session.styleID;
			io.style = originalStyle;
		}
		
		window.openDialog('chrome://zotero/content/integrationDocPrefs.xul','',
		                    'chrome,popup,modal',io);
		session.setStyle(io.style);
		
		return [sessionID, io.style, session.style.class];
	}
}

Zotero.Integration.Session = function(styleID) {
	if(styleID) {
		this.styleID = styleID;
		this.style = Zotero.Cite.getStyle(this.styleID);
	}
	
	this.citationSet = new Zotero.Integration.CitationSet(this.style);
	this.citationFactory = new Zotero.Integration.CitationFactory(this.style);
}

Zotero.Integration.Session.prototype.setStyle = function(styleID) {
	this.styleID = styleID;
	this.citationSet.style = this.citationFactory.style = this.style =  Zotero.Cite.getStyle(styleID);
	this.citationFactory.clearCache();
}

/*
 * a class to keep track of citation objects in a document
 */
Zotero.Integration.Citation = function(index, field) {
	this.index = index;
	this.field = field;
	if(field != "!") {
		var underscoreIndex = field.indexOf("_");
		this.itemIDString = field.substr(0, underscoreIndex);
		
		var lastIndex = field.lastIndexOf("_");
		if(lastIndex != underscoreIndex+1) {
			this.locatorString = field.substr(underscoreIndex+1, lastIndex-underscoreIndex-1);
		} else {
			this.locatorString = false;
		}
		
		this.serialization = this.itemIDString+"_"+this.locatorString;
		
		this.itemIDs = this.itemIDString.split("|");
	}
}
/*
 * generates a new field name based on available information
 */
Zotero.Integration.Citation.prototype.regenerateFieldName = function() {
	this.field = this.itemIDString+"_"+this.locatorString+"_"+Zotero.randomString();
}

/*
 * updates itemIDString and locatorString based on data
 */
Zotero.Integration.Citation.prototype.setData = function(itemIDs, locators, locatorTypes) {
	this.itemIDs = itemIDs;
	this.itemIDString = itemIDs.join("|");
	
	this.locators = locators;
	this.locatorTypes = locatorTypes;
	
	this.locatorString = "";
	for(var i in locators) {
		this.locatorString += locatorTypes[i]+locators[i].replace("|", "");
	}
	
	this.serialization = this.itemIDString+"_"+this.locatorString;
}

/*
 * loads locators from locatorString, if not already loaded
 */
Zotero.Integration.Citation.prototype.loadLocators = function() {
	if(this.locators) return;
	
	this.locators = new Array();
	this.locatorTypes = new Array();
	
	var locators = this.locatorString.split("|");
	for each(var locator in locators) {
		this.locatorTypes.push(locator[0]);
		this.locators.push(locator.substr(1));
	}
}

/*
 * a class to complement Zotero.Integration.Citation, to keep track of the
 * order of citations
 */
Zotero.Integration.CitationSet = function(style) {
	this.citationsByID = new Object();
	this.citationsByField = new Object();
	this.citationsByIndex = new Object();
	this.lastItemID = null;
	
	if(style) this.style = style;
}

/*
 * adds a citation. returns true if this citation duplicates another that has
 * already been added.
 */
Zotero.Integration.CitationSet.prototype.addCitation = function(citation) {
	var isDuplicate = false;
	var itemID;
	
	if(this.style.ibid && citation.itemIDs.length == 1 &&	// if using ibid
	   citation.itemIDString == this.lastItemIDString) {	// and is same as last
		// use ibid if possible
		citation.citationType = 2;
		citation.serializedType = "2";
		for each(itemID in citation.itemIDs) {
			this.citationsByID[itemID].push(citation);
		}
		
		this.citationsByField[citation.field] = citation;
	} else {
		// loop through to see which are first citations
		citation.citationType = new Array();
		for each(itemID in citation.itemIDs) {
			if(!this.citationsByID[itemID]) {
				this.citationsByID[itemID] = new Array(citation);
				citation.citationType.push(1);
			} else {
				this.citationsByID[itemID].push(citation);
				citation.citationType.push(3);
			}
		}
		citation.serializedType = citation.citationType.join(",");
		
		// see if this duplicates another citation
		if(this.citationsByField[citation.field]) {
			isDuplicate = true;
		} else {
			this.citationsByField[citation.field] = citation;
		}
	}
	
	this.lastItemID = (citation.itemIDs.length == 1 ? citation.itemIDString : null);
	this.citationsByIndex[citation.index] = citation;
	
	return isDuplicate;
}

/*
 * a class to generate and cache citations
 */
Zotero.Integration.CitationFactory = function(style) {
	if(style) this.style = style;
	this.cache = new Object();
	this.dateModified = new Object();
	this.items = new Array();
}

Zotero.Integration.CitationFactory.prototype.updateItems = function(citationSet, session, updateCitations) {
	if(session) {
		// check to see if an update is really necessary
		var regenerateItemList = false;
		var item, itemID;
		for(var i in this.items) {
			item = this.items[i]
			itemID = item.getID();
			
			// see if old items were deleted or changed
			if(!citationSet.citationsByID[itemID] ||
			 (this.dateModified[itemID] != item.getField("dateModified"))) {
				regenerateItemList = true;
				break;
			}
		}
		if(!regenerateItemList) {
			for(var i in citationSet.citationsByID) {
				// see if new items were added
				if(!session.citationSet.citationsByID[i]) {
					regenerateItemList = true;
					break;
				}
			}
		}
		
		// leave if it's not
		if(!regenerateItemList) {
			return false;
		}
	}
	
	this.items = new Array();
	var updateCheck = new Array();
	var disambiguation = new Array();
	
	for(var i in citationSet.citationsByID) {
		var item = Zotero.Items.get(i);
		this.items.push(item);
		
		if(this.dateModified[i] && this.dateModified[i] != item.getField("dateModified")) {
			// so that we can update modified this.items
			updateCheck[i] = true;
		}
		
		if(item._csl && item._csl.date.disambiguation) {
			// keep track of disambiguation data
			disambiguation[i] = item._csl.date.disambiguation;
		}
	}
	
	Zotero.debug(disambiguation);
	this.style.preprocessItems(this.items);
	
	var tempCache = new Object();
	for(var i in this.items) {
		var itemID = this.items[i].getID();
		this.dateModified[itemID] = this.items[i].getField("dateModified");
		
		if(session) {
			// check to see if disambiguation has changed
			if(this.items[i]._csl.date.disambiguation != disambiguation[itemID]) {
				for each(var citation in citationSet.citationsByID[itemID]) {
					updateCitations[citation.index] = true;
					citation.updateText = true;
					this.cache[citation.serialization] = null;
				}
			} else if(updateCheck[itemID]) {
				// check against cache to see if updated item has changed
				for each(var citation in citationSet.citationsByID[itemID]) {
					if(this.cache[citation.serializedType][citation.serialization]) {
						var citationText = this.getCitation(citation, tempCache);
						if(citationText != this.cache[citation.serializedType][citation.serialization]) {
							updateCitations[citation.index] = true;
							citation.updateText = true;
							this.cache[citation.serializedType][citation.serialization] = citationText;
						}
					}
				}
			}
		}
	}
	
	return true;
}

Zotero.Integration.CitationFactory.prototype.getCitation = function(citation, usingCache) {
	if(!usingCache) usingCache = this.cache;
	
	if(usingCache[citation.serializedType] && usingCache[citation.serializedType][citation.serialization]) {
		return usingCache[citation.serializedType][citation.serialization];
	}
	
	citation.loadLocators();
	var citationText = this.style.createCitation(citation, "Integration");
	
	if(!usingCache[citation.serializedType]) {
		usingCache[citation.serializedType] = new Object();
	}
	usingCache[citation.serializedType][citation.serialization] = citationText;
	
	return citationText;
}

Zotero.Integration.CitationFactory.prototype.clearCache = function() {
	this.cache = new Object();
	this.dateModified = new Object();
}