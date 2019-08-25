/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2012 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Portions of this file are derived from Special Powers code,
    Copyright (C) 2010 Mozilla Corporation. All Rights Reserved.
    
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
Components.utils.import("resource://gre/modules/Services.jsm");

Zotero.Translate.DOMWrapper = new function() {
	var Cu = Components.utils;
	
	/*
	 * BEGIN SPECIAL POWERS WRAPPING CODE
	 * https://dxr.mozilla.org/mozilla-central/source/testing/specialpowers/content/specialpowersAPI.js
	 *
	 * Includes modifications by Zotero to support overrides
	 */
	function isWrappable(x) {
		if (typeof x === "object")
			return x !== null;
		return typeof x === "function";
	};
	
	function isWrapper(x) {
		return isWrappable(x) && (typeof x.SpecialPowers_wrappedObject !== "undefined");
	};
	
	function unwrapIfWrapped(x) {
		return isWrapper(x) ? unwrapPrivileged(x) : x;
	};
	
	function wrapIfUnwrapped(x) {
		return isWrapper(x) ? x : wrapPrivileged(x);
	}
	
	function isObjectOrArray(obj) {
		if (Object(obj) !== obj)
			return false;
		let arrayClasses = ['Object', 'Array', 'Int8Array', 'Uint8Array',
												'Int16Array', 'Uint16Array', 'Int32Array',
												'Uint32Array', 'Float32Array', 'Float64Array',
												'Uint8ClampedArray'];
		let className = Cu.getClassName(obj, true);
		return arrayClasses.indexOf(className) != -1;
	}
	
	// In general, we want Xray wrappers for content DOM objects, because waiving
	// Xray gives us Xray waiver wrappers that clamp the principal when we cross
	// compartment boundaries. However, there are some exceptions where we want
	// to use a waiver:
	//
	// * Xray adds some gunk to toString(), which has the potential to confuse
	//	 consumers that aren't expecting Xray wrappers. Since toString() is a
	//	 non-privileged method that returns only strings, we can just waive Xray
	//	 for that case.
	//
	// * We implement Xrays to pure JS [[Object]] and [[Array]] instances that
	//	 filter out tricky things like callables. This is the right thing for
	//	 security in general, but tends to break tests that try to pass object
	//	 literals into SpecialPowers. So we waive [[Object]] and [[Array]]
	//	 instances before inspecting properties.
	//
	// * When we don't have meaningful Xray semantics, we create an Opaque
	//	 XrayWrapper for security reasons. For test code, we generally want to see
	//	 through that sort of thing.
	function waiveXraysIfAppropriate(obj, propName) {
		if (propName == 'toString' || isObjectOrArray(obj) ||
				/Opaque/.test(Object.prototype.toString.call(obj)))
	{
			return XPCNativeWrapper.unwrap(obj);
	}
		return obj;
	}
	
	// We can't call apply() directly on Xray-wrapped functions, so we have to be
	// clever.
	function doApply(fun, invocant, args) {
		// We implement Xrays to pure JS [[Object]] instances that filter out tricky
		// things like callables. This is the right thing for security in general,
		// but tends to break tests that try to pass object literals into
		// SpecialPowers. So we waive [[Object]] instances when they're passed to a
		// SpecialPowers-wrapped callable.
		//
		// Note that the transitive nature of Xray waivers means that any property
		// pulled off such an object will also be waived, and so we'll get principal
		// clamping for Xrayed DOM objects reached from literals, so passing things
		// like {l : xoWin.location} won't work. Hopefully the rabbit hole doesn't
		// go that deep.
		args = args.map(x => isObjectOrArray(x) ? Cu.waiveXrays(x) : x);
		return Reflect.apply(fun, invocant, args);
	}
	
	function wrapPrivileged(obj, overrides) {
	
		// Primitives pass straight through.
		if (!isWrappable(obj))
			return obj;
	
		// No double wrapping.
		if (isWrapper(obj))
			throw new Error("Trying to double-wrap object!");
	
		let dummy;
		if (typeof obj === "function")
			dummy = function() {};
		else
			dummy = Object.create(null);
	
		return new Proxy(dummy, new SpecialPowersHandler(obj, overrides));
	};
	
	function unwrapPrivileged(x) {
	
		// We don't wrap primitives, so sometimes we have a primitive where we'd
		// expect to have a wrapper. The proxy pretends to be the type that it's
		// emulating, so we can just as easily check isWrappable() on a proxy as
		// we can on an unwrapped object.
		if (!isWrappable(x))
			return x;
	
		// If we have a wrappable type, make sure it's wrapped.
		if (!isWrapper(x))
			throw new Error("Trying to unwrap a non-wrapped object!");
	
		var obj = x.SpecialPowers_wrappedObject;
		// unwrapped.
		return obj;
	};
	
	/*
	 * We want to waive the __exposedProps__ security check for SpecialPowers-wrapped
	 * objects. We do this by creating a proxy singleton that just always returns 'rw'
	 * for any property name.
	 */
	function ExposedPropsWaiverHandler() {
		// NB: XPConnect denies access if the relevant member of __exposedProps__ is not
		// enumerable.
		var _permit = { value: 'rw', writable: false, configurable: false, enumerable: true };
		return {
			getOwnPropertyDescriptor: function(name) { return _permit; },
			ownKeys: function() { throw Error("Can't enumerate ExposedPropsWaiver"); },
			enumerate: function() { throw Error("Can't enumerate ExposedPropsWaiver"); },
			defineProperty: function(name) { throw Error("Can't define props on ExposedPropsWaiver"); },
			deleteProperty: function(name) { throw Error("Can't delete props from ExposedPropsWaiver"); }
		};
	};
	ExposedPropsWaiver = new Proxy({}, ExposedPropsWaiverHandler());
	
	function SpecialPowersHandler(wrappedObject, overrides) {
		this.wrappedObject = wrappedObject;
		this.overrides = overrides ? overrides : {};
	}
	
	SpecialPowersHandler.prototype = {
		construct(target, args) {
			// The arguments may or may not be wrappers. Unwrap them if necessary.
			var unwrappedArgs = Array.prototype.slice.call(args).map(unwrapIfWrapped);
	
			// We want to invoke "obj" as a constructor, but using unwrappedArgs as
			// the arguments.	Make sure to wrap and re-throw exceptions!
			try {
				return wrapIfUnwrapped(Reflect.construct(this.wrappedObject, unwrappedArgs));
			} catch (e) {
				throw wrapIfUnwrapped(e);
			}
		},
	
		apply(target, thisValue, args) {
			// The invocant and arguments may or may not be wrappers. Unwrap
			// them if necessary.
			var invocant = unwrapIfWrapped(thisValue);
			var unwrappedArgs = Array.prototype.slice.call(args).map(unwrapIfWrapped);
	
			try {
				return wrapIfUnwrapped(doApply(this.wrappedObject, invocant, unwrappedArgs));
			} catch (e) {
				// Wrap exceptions and re-throw them.
				throw wrapIfUnwrapped(e);
			}
		},
	
		has(target, prop) {
			if (prop === "SpecialPowers_wrappedObject")
				return true;
	
			if (this.overrides[prop] !== undefined) {
				return true;
			}
			
			return Reflect.has(this.wrappedObject, prop);
		},
	
		get(target, prop, receiver) {
			if (prop === "SpecialPowers_wrappedObject")
				return this.wrappedObject;
			
			if (prop == "SpecialPowers_wrapperOverrides") {
				return this.overrides;
			}
			
			if (prop in this.overrides) {
				return this.overrides[prop];
			}
			
			let obj = waiveXraysIfAppropriate(this.wrappedObject, prop);
			return wrapIfUnwrapped(Reflect.get(obj, prop));
		},
	
		set(target, prop, val, receiver) {
			if (prop === "SpecialPowers_wrappedObject")
				return false;
	
			let obj = waiveXraysIfAppropriate(this.wrappedObject, prop);
			return Reflect.set(obj, prop, unwrapIfWrapped(val));
		},
	
		delete(target, prop) {
			if (prop === "SpecialPowers_wrappedObject")
				return false;
	
			return Reflect.deleteProperty(this.wrappedObject, prop);
		},
	
		defineProperty(target, prop, descriptor) {
			throw new Error("Can't call defineProperty on SpecialPowers wrapped object");
		},
	
		getOwnPropertyDescriptor(target, prop) {
			// Handle our special API.
			if (prop === "SpecialPowers_wrappedObject") {
				return { value: this.wrappedObject, writeable: true,
								 configurable: true, enumerable: false };
			}
			
			if (prop == "SpecialPowers_wrapperOverrides") {
				return { value: this.overrides, writeable: false, configurable: false, enumerable: false };
			}
			if (prop == "__exposedProps__") {
				return { value: ExposedPropsWaiver, writable: false, configurable: false, enumerable: false };
			}
			if (prop in this.overrides) {
				return { value: this.overrides[prop], writeable: false, configurable: true, enumerable: true };
			}
	
			let obj = waiveXraysIfAppropriate(this.wrappedObject, prop);
			let desc = Reflect.getOwnPropertyDescriptor(obj, prop);
	
			if (desc === undefined)
				return undefined;
	
			// Transitively maintain the wrapper membrane.
			function wrapIfExists(key) {
				if (key in desc)
					desc[key] = wrapIfUnwrapped(desc[key]);
			};
	
			wrapIfExists('value');
			wrapIfExists('get');
			wrapIfExists('set');
	
			// A trapping proxy's properties must always be configurable, but sometimes
			// we come across non-configurable properties. Tell a white lie.
			desc.configurable = true;
	
			return desc;
		},
	
		ownKeys(target) {
			// Insert our special API. It's not enumerable, but ownKeys()
			// includes non-enumerable properties.
			let props = ['SpecialPowers_wrappedObject'];
	
			// Do the normal thing.
			let flt = (a) => !props.includes(a);
			props = props.concat(Object.keys(this.overrides).filter(flt));
			props = props.concat(Reflect.ownKeys(this.wrappedObject).filter(flt));
	
			// If we've got an Xray wrapper, include the expandos as well.
			if ('wrappedJSObject' in this.wrappedObject) {
				props = props.concat(Reflect.ownKeys(this.wrappedObject.wrappedJSObject)
														 .filter(flt));
			}
	
			return props;
		},
	
		preventExtensions(target) {
			throw new Error("Can't call preventExtensions on SpecialPowers wrapped object");
		}
	};
	
	/*
	 * END SPECIAL POWERS WRAPPING CODE
	 */
	
	/**
	 * Abstracts DOM wrapper support for avoiding XOWs
	 * @param {XPCCrossOriginWrapper} obj
	 * @return {Object} An obj that is no longer Xrayed
	 */
	this.wrap = function(obj, overrides) {
		if(isWrapper(obj)) return obj;
		return wrapPrivileged(obj, overrides);
	};
	
	/**
	 * Unwraps an object
	 */
	this.unwrap = function(obj) {
		if(isWrapper(obj)) {
			return unwrapPrivileged(obj);
		} else {
			return obj;
		}
	}

	/**
	 * Wraps an object in the same sandbox as another object
	 */
	this.wrapIn = function(obj, insamebox) {
		if(insamebox.__wrappingManager) return insamebox.__wrappingManager.wrap(obj);
		return this.wrap(obj);
	}
	
	/**
	 * Checks whether an object is wrapped by a DOM wrapper
	 * @param {XPCCrossOriginWrapper} obj
	 * @return {Boolean} Whether or not the object is wrapped
	 */
	this.isWrapped = isWrapper;
}

/**
 * @class Manages the translator sandbox
 * @param {Translate} translate
 * @param {String|window} sandboxLocation
 */
Zotero.Translate.SandboxManager = function(sandboxLocation) {
	this.sandbox = {
		Zotero: {},
		// As of Fx60, XPathResult is no longer available as nsIDOMXPathResult in XPCOM, so just
		// shim its constants, which are all we need
		XPathResult: {
			ANY_TYPE: 0,
			NUMBER_TYPE: 1,
			STRING_TYPE: 2,
			BOOLEAN_TYPE: 3,
			UNORDERED_NODE_ITERATOR_TYPE: 4,
			ORDERED_NODE_ITERATOR_TYPE: 5,
			UNORDERED_NODE_SNAPSHOT_TYPE: 6,
			ORDERED_NODE_SNAPSHOT_TYPE: 7,
			ANY_UNORDERED_NODE_TYPE: 8,
			FIRST_ORDERED_NODE_TYPE: 9
		},
		DOMParser: function() {
			return Components.classes["@mozilla.org/xmlextras/domparser;1"]
				.createInstance(Components.interfaces.nsIDOMParser);
		},
		XMLSerializer: function() {
			return Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
				.createInstance(Components.interfaces.nsIDOMSerializer);
		}
	};
};

Zotero.Translate.SandboxManager.prototype = {
	/**
	 * Evaluates code in the sandbox
	 * @param {String} code Code to evaluate
	 * @param {String[]} functions Functions to import into the sandbox (rather than leaving
	 *                                 as inner functions)
	 */
	eval: function(code, functions) {
		// delete functions to import
		for (var i in functions) {
			delete this.sandbox[functions[i]];
		}

		// Prepend sandbox properties within eval environment (what a mess (1))
		for (var prop in this.sandbox) {
			code = 'var ' + prop + ' = this.sandbox.' + prop + ';' + code;
		}

		// Import inner functions back into the sandbox
		for (var i in functions) {
			try {
				code += 'try{this.sandbox.' + functions[i] + ' = ' + functions[i] + ';}catch(e){}';
			} catch (e) {
			}
		}

		// Eval in a closure
		(function() {
			eval(code);
		}).call(this);
	},
	
	/**
	 * Imports an object into the sandbox
	 *
	 * @param {Object} object Object to be imported (under Zotero)
	 * @param {Boolean} passTranslateAsFirstArgument Whether the translate instance should be passed
	 *     as the first argument to the function.
	 */
	importObject: function(object, passAsFirstArgument, attachTo) {
		if(!attachTo) attachTo = this.sandbox.Zotero;
		
		for(var key in (object.__exposedProps__ ? object.__exposedProps__ : object)) {
			if(Function.prototype[key]) continue;
			if(typeof object[key] === "function" || typeof object[key] === "object") {
				// magic closures
				attachTo[key] = new function() {
					var fn = object[key];
					return function() {
						var args = (passAsFirstArgument ? [passAsFirstArgument] : []);
						for(var i=0; i<arguments.length; i++) {
							args.push(arguments[i]);
						}
						
						return fn.apply(object, args);
					};
				}
				
				// attach members
				this.importObject(object[key], passAsFirstArgument ? passAsFirstArgument : null, attachTo[key]);
			} else {
				attachTo[key] = object[key];
			}
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

Zotero.Translate.IO.Read = function(file, sandboxManager) {
	Zotero.Translate.IO.maintainedInstances.push(this);
	
	this.file = file;
	this._sandboxManager = sandboxManager;
	
	// open file
	this._openRawStream();
	
	// start detecting charset
	this._charset = null;
	this._bomLength = 0;
	
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
		Zotero.debug("Translate: Found BOM. Setting character encoding to " + this._charset);
		// BOM found; store its length and go back to the beginning of the file
		this._bomLength = BOMs[this._charset].length;
	} else {
		this._rewind();
		
		// look for an XML parse instruction
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
					// Make sure encoding is valid
					try {
						var charconv = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
						                         .getService(Components.interfaces.nsIScriptableUnicodeConverter);
						charconv.charset = m[1];
					} catch(e) {
						Zotero.debug("Translate: Ignoring unknown XML encoding "+m[1]);
					}
				}
				
				if(this._charset) {
					Zotero.debug("Translate: Found XML parse instruction. Setting character encoding to " + this._charset);
				} else {
					// if we know for certain document is XML, we also know for certain that the
					// default charset for XML is UTF-8
					this._charset = "UTF-8";
					Zotero.debug("Translate: XML parse instruction not found. Defaulting to UTF-8 for XML files");
				}
			}
		}
		
		// If we managed to get a charset here, then translators shouldn't be able to override it,
		// since it's almost certainly correct. Otherwise, we allow override.
		this._allowCharsetOverride = !this._charset;
		this._rewind();
		
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
				this._rewind();
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
		"getXML":"r",
		"RDF":"r",
		"read":"r",
		"setCharacterSet":"r"
	},
	
	"_openRawStream":function() {
		if(this._rawStream) this._rawStream.close();
		this._rawStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
								  .createInstance(Components.interfaces.nsIFileInputStream);
		this._rawStream.init(this.file, 0x01, 0o664, 0);
	},
	
	"_rewind":function() {
		this._linesExhausted = false;
		this._rawStream.QueryInterface(Components.interfaces.nsISeekableStream)
			.seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, this._bomLength);
		this._rawStream.QueryInterface(Components.interfaces.nsIFileInputStream);
		this.bytesRead = this._bomLength;
	},
	
	"_seekToStart":function(charset) {
		this._openRawStream();
		
		this._rewind();
	
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
		this._dataStore = new Zotero.RDF.AJAW.IndexedFormula();
		var parser = new Zotero.RDF.AJAW.RDFParser(this._dataStore);
		try {
			var nodes = Zotero.Translate.IO.parseDOMXML(this._rawStream, this._charset, this.file.fileSize);
			parser.parse(nodes, baseURI);
			
			this.RDF = new Zotero.Translate.IO._RDFSandbox(this._dataStore);
		} catch(e) {
			this.close();
			throw new Error("Translate: No RDF found");
		}
	},
	
	"setCharacterSet":function(charset) {
		if(typeof charset !== "string") {
			throw new Error("Translate: setCharacterSet: charset must be a string");
		}
		
		// seek back to the beginning
		this._seekToStart(this._allowCharsetOverride ? charset : this._charset);
		
		if(!this._allowCharsetOverride) {
			Zotero.debug("Translate: setCharacterSet: translate charset override ignored due to BOM or XML parse instruction. Using " + this._charset);
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
	
	"getXML":function() {
		if(this.bytesRead !== 0) this._seekToStart(this._charset);
		try {
			var xml = Zotero.Translate.IO.parseDOMXML(this._rawStream, this._charset, this.file.fileSize);
		} catch(e) {
			this._xmlInvalid = true;
			throw e;
		}
		return xml;
	},
	
	init: function (newMode) {
		if(Zotero.Translate.IO.maintainedInstances.indexOf(this) === -1) {
			Zotero.Translate.IO.maintainedInstances.push(this);
		}
		this._seekToStart(this._charset);
		
		this._mode = newMode;
		if(newMode === "xml/e4x") {
			throw new Error("E4X is not supported");
		} else if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1 && !this.RDF) {
			this._initRDF();
		}
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
	this._rawStream.init(file, 0x02 | 0x08 | 0x20, 0o664, 0); // write, create, truncate
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
		this._dataStore = new Zotero.RDF.AJAW.IndexedFormula();
		this.RDF = new Zotero.Translate.IO._RDFSandbox(this._dataStore);
	},
	
	"setCharacterSet":function(charset) {
		if(typeof charset !== "string") {
			throw new Error("Translate: setCharacterSet: charset must be a string");
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
	
	init: function (newMode, charset) {
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
