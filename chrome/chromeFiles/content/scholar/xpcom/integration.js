Scholar.Integration = new function() {
	var _contentLengthRe = /[\r\n]Content-Length: *([0-9]+)/i;
	var _XMLRe = /<\?[^>]+\?>/;
	this.ns = "http://chnm.gmu.edu/firefoxscholar/soap";
	
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
		Scholar.debug("Integration: got SOAP envelope");
		Scholar.debug(envelope);
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
				
				// return OK
				return _generateResponse("200 OK", 'text/xml; charset="utf-8"',
				                         responseEnvelope.toXMLString());
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
	this.getCitation = getCitation;
	this.getBibliography = getBibliography;
	
	function getCitation(vars) {
		// get items
		
		var myWindow = Components.classes["@mozilla.org/appshell/appShellService;1"]
				   .getService(Components.interfaces.nsIAppShellService)
				   .hiddenDOMWindow;
		
		var io = {dataIn: null, dataOut: null};
		myWindow.openDialog('chrome://scholar/content/selectItemsDialog.xul','',
		                    'chrome,popup,modal,centerscreen,titlebar=no',io);
		
		if(io.dataOut) {	// cancel was not pressed
			var selectedItemIDs = io.dataOut;
			var selectedItems = Scholar.Items.get(selectedItemIDs);
			
			var style = vars[0];
			if(vars[1]) {	// some items already exist in the document
				var itemString = vars[1];		// underscore-delimited string
				
				var newItemIndex = parseInt(vars[2]);	// index at which the
														// item belongs in
														// itemString
				
				// splice in the new item ID
				if(newItemIndex == -1) {	// at beginning
					var items = selectedItems.concat(Scholar.Items.get(itemString.split("_")));
				} else {					// at newItemIndex
					var items = Scholar.Items.get(itemString.substr(0, newItemIndex).split("_")).
					            concat(selectedItems);
					
					if(newItemIndex != itemString.length) {	// not at the end
						items = items.concat(Scholar.Items.get(itemString.substr(newItemIndex+1).split("_")))
					}
				}
			} else {		// this is the first item and the only item to worry
							// about
				var items = selectedItems;
			}
			
			var citation = Scholar.Cite.getCitation(style, selectedItems, items, "Integration");
			
			return [selectedItemIDs.join("_"), citation];
		}
	}
	
	function getBibliography(vars) {
		// get items
		var itemIDs = vars[1].split("_");
		var items = Scholar.Items.get(itemIDs);
		
		return Scholar.Cite.getBibliography(vars[0], items, "Integration");
	}
}

Scholar.Integration.init();