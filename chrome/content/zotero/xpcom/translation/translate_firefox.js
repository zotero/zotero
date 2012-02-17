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

const BOMs = {
	"UTF-8":"\xEF\xBB\xBF",
	"UTF-16BE":"\xFE\xFF",
	"UTF-16LE":"\xFF\xFE",
	"UTF-32BE":"\x00\x00\xFE\xFF",
	"UTF-32LE":"\xFF\xFE\x00\x00"
}

Components.utils.import("resource://gre/modules/NetUtil.jsm");

/**
 * @class Manages the translator sandbox
 * @param {Zotero.Translate} translate
 * @param {String|window} sandboxLocation
 */
Zotero.Translate.SandboxManager = function(sandboxLocation) {
	this.sandbox = new Components.utils.Sandbox(sandboxLocation);
	this.sandbox.Zotero = {};
	
	// import functions missing from global scope into Fx sandbox
	this.sandbox.XPathResult = Components.interfaces.nsIDOMXPathResult;
	this.sandbox.DOMParser = function() {
		// get URI
		// DEBUG: In Fx 4 we can just use document.nodePrincipal, but in Fx 3.6 this doesn't work
		if(typeof sandboxLocation === "string") {	// if sandbox specified by URI
			var uri = sandboxLocation;
		} else {									// if sandbox specified by DOM document
			var uri = sandboxLocation.location.toString();
		}
		
		// get principal from URI
		var secMan = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
				.getService(Components.interfaces.nsIScriptSecurityManager);
		var ioService = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
		uri = ioService.newURI(uri, "UTF-8", null);
		var principal = secMan.getCodebasePrincipal(uri);
		
		// initialize DOM parser
		var _DOMParser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
			.createInstance(Components.interfaces.nsIDOMParser);
		_DOMParser.init(principal, uri, uri);
		
		// expose parseFromString
		this.__exposedProps__ = {"parseFromString":"r"};
		if(Zotero.isFx5) {
			this.parseFromString = function(str, contentType) {
				return Zotero.Translate.SandboxManager.Fx5DOMWrapper(_DOMParser.parseFromString(str, contentType));
			}
		} else {
			this.parseFromString = function(str, contentType) _DOMParser.parseFromString(str, contentType);
		}
	};
	this.sandbox.DOMParser.__exposedProps__ = {"prototype":"r"};
	this.sandbox.DOMParser.prototype = {};
	this.sandbox.XMLSerializer = function() {
		var s = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
			.createInstance(Components.interfaces.nsIDOMSerializer);
		this.serializeToString = function(doc) {
			return s.serializeToString(doc.__wrappedDOMObject ? doc.__wrappedDOMObject : doc);
		};
	};
}

/**
 * A really ugly way of making a DOM object not look like a DOM object, so we can pass it to the
 * sandbox under Firefox 5
 */
Zotero.Translate.SandboxManager.Fx5DOMWrapper = function(obj, parent) {
	if(obj === null) {
		return null;
	}
	
	var type = typeof obj;
	if(type === "function") {
		var me = this;
		var val = function() {
			var nArgs = arguments.length;
			var args = new Array(nArgs);
			for(var i=0; i<nArgs; i++) {
				args[i] = (arguments[i] instanceof Object && arguments[i].__wrappedDOMObject
						? arguments[i].__wrappedDOMObject : arguments[i]);
			}
			return Zotero.Translate.SandboxManager.Fx5DOMWrapper(obj.apply(parent ? parent : null, args));
		}
	} else if(type === "object") {
		if(val instanceof Array) {
			var val = [];
		} else {
			var val = {};
		}
	} else {
		return obj;
	}
	
	val.__wrappedDOMObject = obj;
	val.__exposedProps__ = {};
	for(var prop in obj) {
		let localProp = prop;
		val.__exposedProps__[localProp] = "r";
		val.__defineGetter__(localProp, function() {
			return Zotero.Translate.SandboxManager.Fx5DOMWrapper(obj[localProp], obj);
		});
	}
	
	return val;
}

Zotero.Translate.SandboxManager.prototype = {
	/**
	 * Evaluates code in the sandbox
	 */
	"eval":function(code, exported, path) {
		if(Zotero.isFx4) {
			Components.utils.evalInSandbox(code, this.sandbox, "1.8", path, 1);
		} else {
			Components.utils.evalInSandbox(code, this.sandbox);
		}
	},
	
	/**
	 * Imports an object into the sandbox
	 *
	 * @param {Object} object Object to be imported (under Zotero)
	 * @param {Boolean} passTranslateAsFirstArgument Whether the translate instance should be passed
	 *     as the first argument to the function.
	 */
	"importObject":function(object, passAsFirstArgument, attachTo) {
		if(!attachTo) attachTo = this.sandbox.Zotero;
		var newExposedProps = false;
		if(!object.__exposedProps__) newExposedProps = {};
		for(var key in (newExposedProps ? object : object.__exposedProps__)) {
			let localKey = key;
			if(newExposedProps) newExposedProps[localKey] = "r";
			
			var type = typeof object[localKey];
			var isFunction = type === "function";
			var isObject = typeof object[localKey] === "object";
			if(isFunction || isObject) {
				if(isFunction) {
					if(Zotero.isFx4) {
						if(passAsFirstArgument) {
							attachTo[localKey] = object[localKey].bind(object, passAsFirstArgument);
						} else {
							attachTo[localKey] = object[localKey].bind(object);
						}
					} else {
						attachTo[localKey] = function() {
							if(passAsFirstArgument) {
								var args = new Array(arguments.length+1);
								args[0] = passAsFirstArgument;
								var offset = 1;
							} else {
								var args = new Array(arguments.length);
								var offset = 0;
							}
							
							for(var i=0, nArgs=arguments.length; i<nArgs; i++) {
								args[i+offset] = arguments[i];
							}
							
							return object[localKey].apply(object, args);
						};
					}
				} else {
					attachTo[localKey] = {};
				}
				
				// attach members
				if(!(object instanceof Components.interfaces.nsISupports)) {
					this.importObject(object[localKey], passAsFirstArgument, attachTo[localKey]);
				}
			} else {
				attachTo[localKey] = object[localKey];
			}
		}
		
		if(newExposedProps) {
			attachTo.__exposedProps__ = newExposedProps;
		} else {
			attachTo.__exposedProps__ = object.__exposedProps__;
		}
	}
}

/**
 * This variable holds a reference to all open nsIInputStreams and nsIOutputStreams in the global  
 * scope at all times. Otherwise, our streams might get garbage collected when we allow other code
 * to run during Zotero.wait().
 */
Zotero.Translate.IO.maintainedInstances = [];

/******* (Native) Read support *******/

Zotero.Translate.IO.Read = function(file, mode) {
	Zotero.Translate.IO.maintainedInstances.push(this);
	
	this.file = file;
	
	// open file
	this._openRawStream();
	
	// start detecting charset
	var charset = null;
	
	// look for a BOM in the document
	var binStream = Components.classes["@mozilla.org/binaryinputstream;1"].
								createInstance(Components.interfaces.nsIBinaryInputStream);
	binStream.setInputStream(this._rawStream);
	var first4 = binStream.readBytes(4);

	for(var possibleCharset in BOMs) {
		if(first4.substr(0, BOMs[possibleCharset].length) == BOMs[possibleCharset]) {
			this._charset = possibleCharset;
			break;
		}
	}
	
	if(this._charset) {
		// BOM found; store its length and go back to the beginning of the file
		this._bomLength = BOMs[this._charset].length;
		this._rawStream.QueryInterface(Components.interfaces.nsISeekableStream)
			.seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, this._bomLength);
	} else {
		// look for an XML parse instruction
		this._bomLength = 0;
		
		var sStream = Components.classes["@mozilla.org/scriptableinputstream;1"]
					 .createInstance(Components.interfaces.nsIScriptableInputStream);
		sStream.init(this._rawStream);
		
		// read until we see if the file begins with a parse instruction
		const whitespaceRe = /\s/g;
		var read;
		do {
			read = sStream.read(1);
		} while(whitespaceRe.test(read))
		
		if(read == "<") {
			var firstPart = read + sStream.read(4);
			if(firstPart == "<?xml") {
				// got a parse instruction, read until it ends
				read = true;
				while((read !== false) && (read !== ">")) {
					read = sStream.read(1);
					firstPart += read;
				}
				
				const encodingRe = /encoding=['"]([^'"]+)['"]/;
				var m = encodingRe.exec(firstPart);
				if(m) {
					try {
						var charconv = Components.classes["@mozilla.org/charset-converter-manager;1"]
											   .getService(Components.interfaces.nsICharsetConverterManager)
											   .getCharsetTitle(m[1]);
						if(charconv) this._charset = m[1];
					} catch(e) {}
				}
				
				// if we know for certain document is XML, we also know for certain that the
				// default charset for XML is UTF-8
				if(!this._charset) this._charset = "UTF-8";
			}
		}
		
		// If we managed to get a charset here, then translators shouldn't be able to override it,
		// since it's almost certainly correct. Otherwise, we allow override.
		this._allowCharsetOverride = !!this._charset;		
		this._rawStream.QueryInterface(Components.interfaces.nsISeekableStream)
			.seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, this._bomLength);
		
		if(!this._charset) {
			// No XML parse instruction or BOM.
			
			// Check whether the user has specified a charset preference
			var charsetPref = Zotero.Prefs.get("import.charset");
			if(charsetPref == "auto") {
				Zotero.debug("Translate: Checking whether file is UTF-8");
				// For auto-detect, we are basically going to check if the file could be valid
				// UTF-8, and if this is true, we will treat it as UTF-8. Prior likelihood of
				// UTF-8 is very high, so this should be a reasonable strategy.
				
				// from http://codex.wordpress.org/User:Hakre/UTF8
				const UTF8Regex = new RegExp('^(?:' +
					  '[\x09\x0A\x0D\x20-\x7E]' +        // ASCII
					  '|[\xC2-\xDF][\x80-\xBF]' +        // non-overlong 2-byte
					  '|\xE0[\xA0-\xBF][\x80-\xBF]' +    // excluding overlongs
					  '|[\xE1-\xEC\xEE][\x80-\xBF]{2}' + // 3-byte, but exclude U-FFFE and U-FFFF
					  '|\xEF[\x80-\xBE][\x80-\xBF]' +
					  '|\xEF\xBF[\x80-\xBD]' +
					  '|\xED[\x80-\x9F][\x80-\xBF]' +    // excluding surrogates
					  '|\xF0[\x90-\xBF][\x80-\xBF]{2}' + // planes 1-3
					  '|[\xF1-\xF3][\x80-\xBF]{3}' +     // planes 4-15
					  '|\xF4[\x80-\x8F][\x80-\xBF]{2}' + // plane 16
					')*$');
				
				// Read all currently available bytes from file. This seems to be the entire file,
				// since the IO is blocking anyway.
				this._charset = "UTF-8";
				let bytesAvailable;
				while(bytesAvailable = this._rawStream.available()) {
					// read 131072 bytes
					let fileContents = binStream.readBytes(Math.min(131072, bytesAvailable));
					
					// on failure, try reading up to 3 more bytes and see if that makes this
					// valid (since we have chunked it)
					let isUTF8;
					for(let i=1; !(isUTF8 = UTF8Regex.test(fileContents)) && i <= 3; i++) {
						if(this._rawStream.available()) {
							fileContents += binStream.readBytes(1);
						}
					}
					
					// if the regexp continues to fail, this is not UTF-8
					if(!isUTF8) {
						// Can't be UTF-8; see if a default charset is defined
						var prefs = Components.classes["@mozilla.org/preferences-service;1"]
										.getService(Components.interfaces.nsIPrefBranch);
						try {
							this._charset = prefs.getComplexValue("intl.charset.default",
								Components.interfaces.nsIPrefLocalizedString).toString();
						} catch(e) {}
						
						if(!this._charset) {
							try {
								this._charset = prefs.getCharPref("intl.charset.default");
							} catch(e) {}
							
							
							// ISO-8859-1 by default
							if(!this._charset) this._charset = "ISO-8859-1";
						}
						
						break;
					}
				}
			} else {
				// No need to auto-detect; user has specified a charset
				this._charset = charsetPref;
			}
		}
	}
	
	Zotero.debug("Translate: Detected file charset as "+this._charset);
}

Zotero.Translate.IO.Read.prototype = {
	"__exposedProps__":{
		"_getXML":"r",
		"RDF":"r",
		"read":"r",
		"setCharacterSet":"r"
	},
	
	"_openRawStream":function() {
		if(this._rawStream) this._rawStream.close();
		this._rawStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
								  .createInstance(Components.interfaces.nsIFileInputStream);
		this._rawStream.init(this.file, 0x01, 0664, 0);
	},
	
	"_seekToStart":function(charset) {
		this._openRawStream();
		
		this._linesExhausted = false;
		this._rawStream.QueryInterface(Components.interfaces.nsISeekableStream)
			.seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, this._bomLength);
		this.bytesRead = this._bomLength;
	
		this.inputStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
			.createInstance(Components.interfaces.nsIConverterInputStream);
		this.inputStream.init(this._rawStream, charset, 32768,
			Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
	},
	
	"_readToString":function() {
		var str = {};
		var stringBits = [];
		this.inputStream.QueryInterface(Components.interfaces.nsIUnicharInputStream);
		while(1) {
			var read = this.inputStream.readString(32768, str);
			if(!read) break;
			stringBits.push(str.value);
		}
		return stringBits.join("");
	},
	
	"_initRDF":function() {
		// get URI
		var IOService = Components.classes['@mozilla.org/network/io-service;1']
						.getService(Components.interfaces.nsIIOService);
		var fileHandler = IOService.getProtocolHandler("file")
						  .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
		var baseURI = fileHandler.getURLSpecFromFile(this.file);
		
		Zotero.debug("Translate: Initializing RDF data store");
		this._dataStore = new Zotero.RDF.AJAW.RDFIndexedFormula();
		var parser = new Zotero.RDF.AJAW.RDFParser(this._dataStore);
		try {
			var nodes = Zotero.Translate.IO.parseDOMXML(this._rawStream, this._charset, this.file.fileSize);
			parser.parse(nodes, baseURI);
			
			this.RDF = new Zotero.Translate.IO._RDFSandbox(this._dataStore);
		} catch(e) {
			this.close();
			throw "Translate: No RDF found";
		}
	},
	
	"setCharacterSet":function(charset) {
		if(typeof charset !== "string") {
			throw "Translate: setCharacterSet: charset must be a string";
		}
		
		// seek back to the beginning
		this._seekToStart(this._allowCharsetOverride ? this._allowCharsetOverride : this._charset);
		
		if(!_allowCharsetOverride) {
			Zotero.debug("Translate: setCharacterSet: translate charset override ignored due to BOM or XML parse instruction");
		}
	},
	
	"read":function(bytes) {
		var str = {};
		
		if(bytes) {
			// read number of bytes requested
			this.inputStream.QueryInterface(Components.interfaces.nsIUnicharInputStream);
			var amountRead = this.inputStream.readString(bytes, str);
			if(!amountRead) return false;
			this.bytesRead += amountRead;
		} else {
			// bytes not specified; read a line
			this.inputStream.QueryInterface(Components.interfaces.nsIUnicharLineInputStream);
			if(this._linesExhausted) return false;
			this._linesExhausted = !this.inputStream.readLine(str);
			this.bytesRead += str.value.length+1; // only approximate
		}
		
		return str.value;
	},
	
	"_getXML":function() {
		if(this._mode == "xml/dom") {
			return Zotero.Translate.IO.parseDOMXML(this._rawStream, this._charset, this.file.fileSize);
		} else {
			return this._readToString().replace(/<\?xml[^>]+\?>/, "");
		}
	},
	
	"init":function(newMode, callback) {
		if(Zotero.Translate.IO.maintainedInstances.indexOf(this) === -1) {
			Zotero.Translate.IO.maintainedInstances.push(this);
		}
		this._seekToStart(this._charset);
		
		this._mode = newMode;
		if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1 && !this.RDF) {
			this._initRDF();
		}
		
		callback(true);
	},
	
	"close":function() {
		var myIndex = Zotero.Translate.IO.maintainedInstances.indexOf(this);
		if(myIndex !== -1) Zotero.Translate.IO.maintainedInstances.splice(myIndex, 1);
		
		if(this._rawStream) {
			this._rawStream.close();
			delete this._rawStream;
		}
	}
}
Zotero.Translate.IO.Read.prototype.__defineGetter__("contentLength",
function() {
	return this.file.fileSize;
});

/******* Write support *******/

Zotero.Translate.IO.Write = function(file) {
	Zotero.Translate.IO.maintainedInstances.push(this);
	this._rawStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
		.createInstance(Components.interfaces.nsIFileOutputStream);
	this._rawStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0); // write, create, truncate
	this._writtenToStream = false;
}

Zotero.Translate.IO.Write.prototype = {
	"__exposedProps__":{
		"RDF":"r",
		"write":"r",
		"setCharacterSet":"r"
	},
	
	"_initRDF":function() {
		Zotero.debug("Translate: Initializing RDF data store");
		this._dataStore = new Zotero.RDF.AJAW.RDFIndexedFormula();
		this.RDF = new Zotero.Translate.IO._RDFSandbox(this._dataStore);
	},
	
	"setCharacterSet":function(charset) {
		if(typeof charset !== "string") {
			throw "Translate: setCharacterSet: charset must be a string";
		}
		
		if(!this.outputStream) {
			this.outputStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
								   .createInstance(Components.interfaces.nsIConverterOutputStream);
		}
		
		if(charset == "UTF-8xBOM") charset = "UTF-8";
		this.outputStream.init(this._rawStream, charset, 1024, "?".charCodeAt(0));
		this._charset = charset;
	},
	
	"write":function(data) {
		if(!this._charset) this.setCharacterSet("UTF-8");
		
		if(!this._writtenToStream && this._charset.substr(this._charset.length-4) == "xBOM"
		   && BOMs[this._charset.substr(0, this._charset.length-4).toUpperCase()]) {
			// If stream has not yet been written to, and a UTF type has been selected, write BOM
			this._rawStream.write(BOMs[streamCharset], BOMs[streamCharset].length);
		}
		
		if(this._charset == "MACINTOSH") {
			// fix buggy Mozilla MacRoman
			var splitData = data.split(/([\r\n]+)/);
			for(var i=0; i<splitData.length; i+=2) {
				// write raw newlines straight to the string
				this.outputStream.writeString(splitData[i]);
				if(splitData[i+1]) {
					this._rawStream.write(splitData[i+1], splitData[i+1].length);
				}
			}
		} else {
			this.outputStream.writeString(data);
		}
		
		this._writtenToStream = true;
	},
	
	"init":function(newMode, charset, callback) {
		this._mode = newMode;
		if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1) {
			this._initRDF();
			if(!this._writtenToString) this.setCharacterSet("UTF-8");
		} else if(!this._writtenToString) {
			this.setCharacterSet(charset ? charset : "UTF-8");
		}
	},
	
	"close":function() {
		if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1) {
			this.write(this.RDF.serialize());
		}
		
		var myIndex = Zotero.Translate.IO.maintainedInstances.indexOf(this);
		if(myIndex !== -1) Zotero.Translate.IO.maintainedInstances.splice(myIndex, 1);
		
		this._rawStream.close();
	}
}
