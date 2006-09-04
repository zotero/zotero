Scholar.Integration = new function() {
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
		
		// bind to a random port on loopback only
		serv.init(50001, true, -1);
		serv.asyncListen(Scholar.Integration.SocketListener);
		
		Scholar.debug("Integration HTTP server listening on 127.0.0.1:"+serv.port);
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
		Scholar.debug("Integration: SOAP Request\n"+envelope);
		envelope = envelope.replace(_XMLRe, "");
		
		var env = new Namespace("http://schemas.xmlsoap.org/soap/envelope/");
		var xml = new XML(envelope);
		var request = xml.env::Body.children()[0];
		if(request.namespace() != this.ns) {
			Scholar.debug("Integration: SOAP method not supported: invalid namespace");
		} else {
			var name = request.localName();
			if(Scholar.Integration.SOAP[name]) {
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
				var output = Scholar.Integration.SOAP[name](vars);
				
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
				
				var response = responseEnvelope.toXMLString();
				Scholar.debug("Integration: SOAP Response\n"+response);
				
				// return OK
				return _generateResponse("200 OK", 'text/xml; charset="utf-8"',
				                         response);
			} else {
				Scholar.debug("Integration: SOAP method not supported");
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

Scholar.Integration.SocketListener = new function() {
	this.onSocketAccepted = onSocketAccepted;
	
	/*
	 * called when a socket is opened
	 */
	function onSocketAccepted(socket, transport) {
		// get an input stream
		var iStream = transport.openInputStream(0, 0, 0);
		var oStream = transport.openOutputStream(0, 0, 0);
		
		var dataListener = new Scholar.Integration.DataListener(iStream, oStream);
		var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"]
							 .createInstance(Components.interfaces.nsIInputStreamPump);
		pump.init(iStream, -1, -1, 0, 0, false);
		pump.asyncRead(dataListener, null);
	}
}

/*
 * handles the actual acquisition of data
 */
Scholar.Integration.DataListener = function(iStream, oStream) {
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
Scholar.Integration.DataListener.prototype.onStartRequest = function(request, context) {}

/*
 * called when a request stops
 */
Scholar.Integration.DataListener.prototype.onStopRequest = function(request, context, status) {
	this.iStream.close();
	this.oStream.close();
}

/*
 * called when new data is available
 */
Scholar.Integration.DataListener.prototype.onDataAvailable = function(request, context,
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
Scholar.Integration.DataListener.prototype._headerFinished = function() {
	this.headerFinished = true;
	var output = Scholar.Integration.handleHeader(this.header);
	
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
Scholar.Integration.DataListener.prototype._bodyData = function() {
	if(this.body.length >= this.bodyLength) {
		if(this.body.length > this.bodyLength) {
			// truncate
			this.body = this.body.substr(0, this.bodyLength);
		}
		
		var output = Scholar.Integration.handleEnvelope(this.body);
		this._requestFinished(output);
	}
}

/*
 * returns HTTP data from a request
 */
Scholar.Integration.DataListener.prototype._requestFinished = function(response) {
	// close input stream
	this.iStream.close();
	
	// write response
	this.oStream.write(response, response.length);
	
	// close output stream
	this.oStream.close();
}

Scholar.Integration.SOAP = new function() {
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
		
		var style = Scholar.Cite.getStyle(session.styleID);
		
		var encounteredItem = new Object();
		var newField = new Object();
		var regenerate = new Object();
		
		var newFieldArrayIndex = vars.indexOf("X", 2);
		if(newFieldArrayIndex != -1) {
			var newFieldIndex = vars[newFieldArrayIndex-1];
			
			// get items		
			var io = {dataIn: null, dataOut: null};
			window.openDialog('chrome://scholar/content/selectItemsDialog.xul','',
								'chrome,popup,modal,centerscreen',io);

			if(io.dataOut) {	// cancel was not pressed
				var field = (io.dataOut.join(","))+"_"+Scholar.randomString();
				
				// set so that itemID works
				vars[newFieldArrayIndex] = field;
				// set so that field name will get changed
				newField[newFieldIndex] = field;
			} else {
				vars[newFieldArrayIndex] = "!";
				newField[newFieldIndex] = "!";
			}
		}
		
		var regenerateItemList = _inspectCitationPairs(vars, 3, session, style,
		                         encounteredItem, newField, regenerate,
		                         (citationMode == "all"));
		
		if(!regenerateItemList) {
			// if we're not already regenerating the item list, ensure no
			// citations have been deleted
			for(var i in session.encounteredItem) {
				if(!encounteredItem[i]) {
					regenerateItemList = true;
				}
			}
		}
		
		var output = new Array();
		
		if(regenerateItemList || bibliographyMode == "true") {
			Scholar.debug("Integration: Regenerating Item List");
			
			// need to re-process items
			var items = new Array();
			for(var i in encounteredItem) {
				items.push(Scholar.Items.get(i));
			}
			style.preprocessItems(items);
			
			// EBNF: bibliography-data
			if(bibliographyMode != "false") {
				output.push(style.createBibliography(items, "Integration"));
			} else {
				output.push("!");
			}
		} else {
			// EBNF: bibliography-data
			output.push("!");
		}
		
		// state which citations to update
		// EBNF: citation-output-triple
		for(var i in regenerate) {
			// EBNF: citation-index
			output.push(i);
			
			if(regenerate[i] === false) {
				// if marked for deletion, delete
				output.push("!");
				output.push("!");
			} else if(regenerate[i] === true) {
				// if marked for name change, change name
				output.push(newField[i]);
				output.push("!");
			} else {
				// EBNF: citation-field
				if(newField[i]) {
					output.push(newField[i]);
				} else {
					output.push("!");
				}
				
				// EBNF: citation-data
				var items = Scholar.Items.get(regenerate[i][0]);
				output.push(style.createCitation(items, regenerate[i][1], "Integration"));
			}
		}
		
		session.encounteredItem = encounteredItem;
		
		return output;
	}
	
	/*
	 * restores a session, given all citations
	 * ACCEPTS: styleID(, fieldIndex, fieldName)+
	 * RETURNS: sessionID
	 */
	function restoreSession(vars) {
		var sessionID = Scholar.randomString();
		var session = _generateSession(sessionID);
		session.styleID = vars[0];
		
		var style = Scholar.Cite.getStyle(session.styleID);
		
		var encounteredItem = new Object();
		var newField = new Object();
		var regenerate = new Object();
		
		_inspectCitationPairs(vars, 1, session, style);
		
		return [sessionID];
	}
	
	/*
	 * sets document preferences
	 * ACCEPTS: (sessionID)?
	 * RETURNS: sessionID, styleID, style-class
	 */
	function setDocPrefs(vars) {
		var io = new Object();
		
		if(!vars || vars[0] == "!") {
			// no session ID; generate a new one
			var sessionID = Scholar.randomString();
			var session = _generateSession(sessionID);
		} else {
			// session ID exists
			var sessionID = vars[0];
			var session = _sessions[sessionID];
			var originalStyle = session.styleID;
			io.style = originalStyle;
		}
		
		window.openDialog('chrome://scholar/content/integrationDocPrefs.xul','',
		                    'chrome,popup,modal,centerscreen',io);
		session.styleID = io.style;
		var style = Scholar.Cite.getStyle(io.style);
		
		return [sessionID, io.style, style.class];
	}
	
	/*
	 * inspects citation pairs to determine which are in need of an update
	 * 
	 * vars - the set of variables
	 *
	 * startIndex - the place in the set of variables at which the citations
	 *              begin
	 *
	 * session - the session variable (see _generateSession())
	 * 
	 * encounteredItem - an object representing whether a given item ID has been
	 *                   encountered, in the format itemID => true
	 *
	 * newField - an object representing whether a given field needs to be
	 *            renamed, in the format fieldIndex => newFieldName
	 * 
	 * regenerate - an object representing whether the contents of a given field
	 *              need to be modified, in the format:
	 *                  index => [[itemID1, itemID2], ([format1, format2] | "2")]
	 *              formats are as follows:
	 *                  1 => first occurance of a given item. use full citation.
	 *                  2 => item occurred directly previously. use ibid. (never
	 *                       used as an array, only a single item)
	 *                  3 => subsequent entry.
	 */
	 
	function _inspectCitationPairs(vars, startIndex, session, style, encounteredItem, newField, regenerate, regenerateAll) {
		var newItemFound = false;	
		var encounteredField = new Object();// keep track of field names, to see
											// if there are duplicates
		
		if(!encounteredItem) {
			encounteredItem = new Object();
		}
		
		var lastItemIDString = null;
		var index, field, lastItemID, itemIDs, itemID, itemSetValue;
		for(var i=startIndex; i<vars.length; i+=2) {
			index = vars[i];
			field = vars[i+1];
			if(regenerate && field == "!") {
				// mark for deletion if necessary
				Scholar.debug("Integration: Marking "+index+" for deletion");
				regenerate[index] = false;
				continue;
			}
			
			itemIDString = field.substr(0, field.indexOf("_"));
			itemIDs = itemIDString.split(",");
			
			itemSetValue = null;
			if(itemIDString == lastItemIDString && style.ibid) {
				// use ibid if possible
				itemSetValue = 2;
			} else {
				// loop through to see which are first citations
				itemSetValue = new Array();
				for each(itemID in itemIDs) {
					if(!encounteredItem[itemID]) {
						encounteredItem[itemID] = true;
						itemSetValue.push(1);

						if(!session.encounteredItem[itemID]) {
							newItemFound = true;
						}
					} else {
						itemSetValue.push(3);
					}
				}
			}
			
			if(regenerateAll) {
				// regenerate all citations if requested
				var update = true;
			} else {
				// test to see if this itemSetValue is different from the
				// version stored in the session
				var update = false;
				if(typeof(itemSetValue) == "object" &&
				   typeof(session.itemSet[field]) == "object") {
					// loop through, looking for differences
					for(var j in itemSetValue) {
						if(itemSetValue[j] != session.itemSet[field][j]) {
							update = true;
							break;
						}
					}
				} else if(itemSetValue != session.itemSet[field]) {
					update = true;
				}
			}
			
			if(update) {
				Scholar.debug("Integration: field "+field+" at index "+index+" was "+(session.itemSet[field] ? session.itemSet[field].toSource() : "undefined")+" but is now "+itemSetValue.toSource());
				// positioning has changed
				if(encounteredField[field]) {
					if(regenerate) {
						// someone copy and pasted a citation from this document,
						// since this field appears twice. and we have to change it.
						newField[index] = itemIDString+"_"+Scholar.randomString();
						session.itemSet[newField[index]] = itemSetValue;
					}
				} else {
					session.itemSet[field] = itemSetValue;
				}
				
				if(regenerate) {
					// regenerate citation
					regenerate[index] = [itemIDs, itemSetValue];
				}
			} else if(encounteredField[field]) {
				// someone copy and pasted a citation from this document,
				// since this field appears twice. we don't have to change it,
				// but we do need to change its name
				session.itemSet[newField[index]] = itemSetValue;
				
				if(regenerate) {
					newField[index] = itemIDString+"_"+Scholar.randomString();
					regenerate[index] = true;	// true means name change without
												// field value change
				}
			}
			
			encounteredField[field] = true;
			lastItemIDString = itemIDString;
		}
		
		return newItemFound;
	}
	
	/*
	 * generates, stores, and returns a new session object
	 */
	function _generateSession(sessionID) {
		var session = _sessions[sessionID] = new Object();
		session.encounteredItem = new Object();
		session.itemSet = new Object();
		
		return session;
	}
}