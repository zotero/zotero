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

Zotero.LocateManager = new function() {
	const LOCATE_FILE_NAME = "engines.json";
	const LOCATE_DIR_NAME = "locate";
	
	var _jsonFile;
	var _locateEngines;
	var _ios;
	var _timer;
	
	/**
	 * Read locateEngines JSON file to initialize locate manager
	 */
	this.init = function() {
		_ios = Components.classes["@mozilla.org/network/io-service;1"].
				  getService(Components.interfaces.nsIIOService);
		
		_jsonFile = _getLocateFile();
		
		if(_jsonFile.exists()) {
			_locateEngines = JSON.parse(Zotero.File.getContents(_jsonFile))
				.map(engine => new LocateEngine(engine));
		} else {
			this.restoreDefaultEngines();
		}
	}
	
	/**
	 * Adds a new search engine
	 * confirm parameter is currently ignored
	 */
	this.addEngine = function(engineURL, dataType, iconURL, confirm) {
		if(dataType !== Components.interfaces.nsISearchEngine.TYPE_OPENSEARCH) {
			throw "LocateManager supports only OpenSearch engines";
		}
		
		Zotero.HTTP.doGet(engineURL, function(xmlhttp) {
			var engine = new LocateEngine();
			engine.initWithXML(xmlhttp.responseText, iconURL);
		});
	}
	
	/**
	 * Gets all default search engines (not currently used)
	 */
	this.getDefaultEngines = function () {
		return JSON.parse(Zotero.File.getContentsFromURL(_getDefaultFile()))
			.map(engine => new LocateEngine(engine));
	}
	
	/**
	 * Returns an array of all search engines
	 */
	this.getEngines = function() _locateEngines.slice(0);
	
	/**
	 * Returns an array of all search engines visible that should be visible in the dropdown
	 */
	this.getVisibleEngines = function () {
		return _locateEngines.filter(engine => !engine.hidden);
	}
	
	/**
	 * Returns an engine with a specific name
	 */
	this.getEngineByName = function(engineName) {
		engineName = engineName.toLowerCase();
		for each(var engine in _locateEngines) if(engine.name.toLowerCase() == engineName) return engine;
		return null;
	}
	
	/**
	 * Returns the first engine with a specific alias
	 */
	this.getEngineByAlias = function(engineAlias) {
		engineAlias = engineAlias.toLowerCase();
		for each(var engine in _locateEngines) if(engine.alias.toLowerCase() == engineAlias) return engine;
		return null;
	}
	
	/**
	 * Moves an engine in the list
	 */
	this.moveEngine = function(engine, newIndex) {
		this.removeEngine(engine);
		_locateEngines.splice(newIndex, engine);
	}
	
	/**
	 * Removes an engine from the list
	 */
	this.removeEngine = function(engine) {
		var oldIndex = _locateEngines.indexOf(engine);
		if(oldIndex === -1) throw "Engine is not currently listed";
		_locateEngines.splice(oldIndex, 1);
		engine._removeIcon();
		_serializeLocateEngines();
	}
	
	/**
	 * Restore default engines by copying file from extension dir
	 */
	this.restoreDefaultEngines = function() {
		// get locate dir
		var locateDir = _getLocateDirectory();
		
		// remove old locate dir
		if(locateDir.exists()) locateDir.remove(true);
		
		// create new locate dir
		locateDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0700);
		
		// copy default file to new locate dir
		Zotero.File.putContents(_jsonFile,
			Zotero.File.getContentsFromURL(_getDefaultFile()));
		
		// reread locate engines
		this.init();
		
		// reload icons for default locate engines
		for each(var engine in this.getEngines()) engine._updateIcon();
	}
	
	/**
	 * Writes the engines to disk; called from the nsITimer spawned by _serializeLocateEngines
	 */
	this.notify = function() {
		Zotero.File.putContents(_jsonFile, JSON.stringify(_locateEngines, null, "\t"));
		_timer = undefined;
	}
	
	/**
	 * Gets the JSON file containing engine info
	 */
	function _getLocateFile() {
		var locateDir = _getLocateDirectory();
		locateDir.append(LOCATE_FILE_NAME);
		return locateDir;
	}
	
	/**
	 * Gets the dir containing the JSON file and engine icons
	 */
	function _getLocateDirectory() {
		var locateDir = Zotero.getZoteroDirectory();
		locateDir.append(LOCATE_DIR_NAME);
		return locateDir;
	}
	
	/**
	 * Gets the JSON file containing the engine info for the default engines
	 */
	function _getDefaultFile() {
		return "resource://zotero/schema/"+LOCATE_FILE_NAME;
	}
	
	
	/**
	 * Writes the engines to disk when the current block is finished executing
	 */
	function _serializeLocateEngines() {
		if(_timer) return;
		_timer = Components.classes["@mozilla.org/timer;1"].
				createInstance(Components.interfaces.nsITimer);
		_timer.initWithCallback(Zotero.LocateManager, 0, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
	}
	
	/**
	 * Function to call to attach to watch engine properties and perform deferred serialization
	 */
	function _watchLocateEngineProperties(id, oldval, newval) {
		if(oldval !== newval) _serializeLocateEngines();
		return newval;
	}
	
	/**
	 * Called when an engine icon is downloaded to write it to disk
	 */
	function _engineIconLoaded(iconBytes, engine, contentType) {
		const iconExtensions = {
			"image/png":"png",
			"image/jpeg":"jpg",
			"image/gif":"gif",
			"image/x-icon":"ico",
			"image/vnd.microsoft.icon":"ico"
		};
		
		// ensure there is an icon
		if(!iconBytes) throw "Icon could not be retrieved for "+engine.name;
		
		// ensure there is an extension
		var extension = iconExtensions[contentType.toLowerCase()];
		if(!extension) throw "Invalid MIME type "+contentType+" for icon for engine "+engine.name;
		
		// remove old icon
		engine._removeIcon();
		
		// find a good place to put the icon file
		var sanitizedAlias = engine.name.replace(/[^\w _]/g, "");
		var iconFile = _getLocateDirectory();
		iconFile.append(sanitizedAlias + "." + extension);
		if(iconFile.exists()) {
			for(var i=0; iconFile.exists(); i++) {
				iconFile = iconFile.parent;
				iconFile.append(sanitizedAlias + "_" + i + "." + extension);
			}
		}
		
		// write the icon to the file
		var fos = Components.classes["@mozilla.org/network/file-output-stream;1"].
				createInstance(Components.interfaces.nsIFileOutputStream);
		fos.init(iconFile, 0x02 | 0x08 | 0x20, 0664, 0);  // write, create, truncate
		var bos = Components.classes["@mozilla.org/binaryoutputstream;1"].
				createInstance(Components.interfaces.nsIBinaryOutputStream);
		bos.setOutputStream(fos);
		bos.writeByteArray(iconBytes, iconBytes.length);
		bos.close();
		
		// get the URI of the icon
		engine.icon = _ios.newFileURI(iconFile).spec;
	}
	
	/**
	 * Looks up a parameter in our list
	 *
	 * Supported parameters include
	 * - all standard OpenURL parameters, identified by any OpenURL namespace
	 * - "version", "identifier", and "format" identified by the OpenURL ctx namespace
	 * - "openURL" identified by the Zotero namespace (= the whole openURL)
	 * - "year" identified by the Zotero namespace
	 * - any Zotero field identified by the Zotero namespace
	 */
	function _lookupParam(item, itemOpenURL, engine, nsPrefix, param) {
		const OPENURL_ITEM_PREFIXES = [
			"info:ofi/fmt:kev:mtx:journal",
			"info:ofi/fmt:kev:mtx:book",
			"info:ofi/fmt:kev:mtx:patent",
			"info:ofi/fmt:kev:mtx:sch_svc",
			"info:ofi/fmt:kev:mtx:dissertation"
		];
		
		const OPENURL_CONTEXT_MAPPINGS = {
			"version":"ctx_ver",
			"identifier":"rfr_id",
			"format":"rft_val_fmt"
		};
		
		if(nsPrefix) {
			var ns = engine._urlNamespaces[nsPrefix];
			if(!ns) return false;
		} else {
			if(param === "searchTerms") return [item.title];
			return false;
		}
		
		if(OPENURL_ITEM_PREFIXES.indexOf(ns) !== -1) {
			// take a normal "title," even though we don't use it, because it is valid (but not
			// preferred) OpenURL
			if(param === "title") {
				var title = item.title;
				return (title ? [encodeURIComponent(title)] : false);
			}
			
			if(!itemOpenURL["rft."+param]) {
				return false;
			}
			
			return itemOpenURL["rft."+param].map(val => encodeURIComponent(val));
		} else if(ns === "info:ofi/fmt:kev:mtx:ctx") {
			if(!OPENURL_CONTEXT_MAPPINGS[param] || !itemOpenURL[OPENURL_CONTEXT_MAPPINGS[param]]) {
				return false;
			}
			return itemOpenURL[OPENURL_CONTEXT_MAPPINGS[param]].map(val => encodeURIComponent(val));
		} else if(ns === "http://www.zotero.org/namespaces/openSearch#") {
			if(param === "openURL") {
				var ctx = Zotero.OpenURL.createContextObject(item, "1.0");
				return (ctx ? [ctx] : false);
			} else if(param === "year") {
				return (itemOpenURL["rft.date"] ? [itemOpenURL["rft.date"][0].substr(0, 4)] : false);
			} else {
				var result = item[param];
				return (result ? [encodeURIComponent(result)] : false);
			}
		} else {
			return false;
		}
	}
	
	/**
	 * Theoretically implements nsISearchSubmission
	 */
	var LocateSubmission = function(uri, postData) {
		this.uri = _ios.newURI(uri, null, null);
		this.postData = postData;
	}
	
	/**
	 * @constructor
	 * Constructs a new LocateEngine
	 * @param {Object} [obj] The locate engine, in parsed form, as it was serialized to JSON
	 */
	var LocateEngine = function(obj) {
		this.alias = this.name = "Untitled";
		this.description = this._urlTemplate = this.icon = null;
		this.hidden = false;
		this._urlParams = [];
		
		if(obj) for(var prop in obj) this[prop] = obj[prop];
		
		// Queue deferred serialization whenever a property is modified
		for each(var prop in ["alias", "name", "description", "icon", "hidden"]) {
			this.watch(prop, _watchLocateEngineProperties);
		}
	}
	
	LocateEngine.prototype = {
		/**
		 * Initializes an engine with a string and an iconURL to use if none is defined in the file
		 */
		"initWithXML":function(xmlStr, iconURL) {
			const OPENSEARCH_NAMESPACES = [
			  // These are the official namespaces
			  "http://a9.com/-/spec/opensearch/1.1/",
			  "http://a9.com/-/spec/opensearch/1.0/",
			  // These were also in nsSearchService.js
			  "http://a9.com/-/spec/opensearchdescription/1.1/",
			  "http://a9.com/-/spec/opensearchdescription/1.0/"
			];
			
			var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
					.createInstance(Components.interfaces.nsIDOMParser),
				doc = parser.parseFromString(xmlStr, "application/xml"),
				docEl = doc.documentElement,
				ns = docEl.namespaceURI,
				xns = {"s":doc.documentElement.namespaceURI,
					"xmlns":"http://www.w3.org/2000/xmlns"};
			if(OPENSEARCH_NAMESPACES.indexOf(ns) === -1) {
				throw "Invalid namespace";
			}
			
			// get simple attributes
			this.alias = Zotero.Utilities.xpathText(docEl, 's:ShortName', xns);
			this.name = Zotero.Utilities.xpathText(docEl, 's:LongName', xns);
			if(!this.name) this.name = this.alias;
			this.description = Zotero.Utilities.xpathText(docEl, 's:Description', xns);
			
			// get the URL template
			this._urlTemplate = undefined;
			var urlTags = Zotero.Utilities.xpath(docEl, 's:Url[@type="text/html"]', xns),
				i = 0;
			while(urlTags[i].hasAttribute("rel") && urlTags[i].getAttribute("rel") != "results") {
				i++;
				if(i == urlTags.length) throw "No Url tag found";
			}
			
			// TODO: better error handling
			var urlTag = urlTags[i];
			this._urlTemplate = urlTag.getAttribute("template")
			this._method = urlTag.getAttribute("method").toString().toUpperCase() === "POST" ? "POST" : "GET";
			
			// get namespaces
			this._urlNamespaces = {};
			var node = urlTag;
			while(node && node.attributes) {
				for(var i=0; i<node.attributes.length; i++) {
					var attr = node.attributes[i];
					if(attr.namespaceURI == "http://www.w3.org/2000/xmlns/") {
						this._urlNamespaces[attr.localName] = attr.nodeValue;
					}
				}
				node = node.parentNode;
			}
			
			// get params
			this._urlParams = [];
			for(var param of Zotero.Utilities.xpath(urlTag, 's:Param', xns)) {
				this._urlParams[param.getAttribute("name")] = param.getAttribute("value");
			}
			
			// find the icon
			this._iconSourceURI = iconURL;
			for(var img of Zotero.Utilities.xpath(docEl, 's:Image', xns)) {
				if((!img.hasAttribute("width") && !img.hasAttribute("height"))
						|| (img.getAttribute("width") == "16" && img.getAttribute("height") == "16")) {
					this._iconSourceURI = img.textContent;
				}
			}
			
			if(this._iconSourceURI) {
				// begin fetching the icon if necesssary
				this._updateIcon();
			}
			
			// delete any old engine with the same name
			var engine = Zotero.LocateManager.getEngineByName(this.name);
			if(engine) Zotero.LocateManager.removeEngine(engine);
			
			// add and serialize the new engine
			_locateEngines.push(this);
			_serializeLocateEngines();
		},
		
		"getItemSubmission":function(item, responseType) {
			if(responseType && responseType !== "text/html") {
				throw "LocateManager supports only responseType text/html";
			}
		
			if(item.toArray) {
				item = item.toArray();
			}
			
			var itemAsOpenURL = Zotero.OpenURL.createContextObject(item, "1.0", true);
			
			// do substitutions
			var me = this;
			var abort = false;
			var url = this._urlTemplate.replace(/{(?:([^}:]+):)?([^}:?]+)(\?)?}/g, function(all, nsPrefix, param, required) {
				var result = _lookupParam(item, itemAsOpenURL, me, nsPrefix, param, required);
				if(result) {
					return result[0];
				} else {
					if(required) {	// if no param and it wasn't optional, return
						return "";
					} else {
						abort = true;
					}
				}
			});
			if(abort) return null;
			
			// handle params
			var paramsToAdd = [];
			for(var param in this._urlParams) {
				var m = this._urlParams[param].match(/^{(?:([^}:]+):)?([^}:?]+)(\?)?}$/);
				if(!m) {
					paramsToAdd.push(encodeURIComponent(param)+"="+encodeURIComponent(this._urlParams[param]));
				} else {
					var result = _lookupParam(item, itemAsOpenURL, me, m[1], m[2]);
					if(result) {
						paramsToAdd = paramsToAdd.concat(
							result.map(val =>
								encodeURIComponent(param) + "=" + encodeURIComponent(val))
						);
					} else if(m[3]) {	// if no param and it wasn't optional, return
						return null;
					}
				}
			}
			
			// attach params
			if(paramsToAdd.length) {
				if(this._method === "POST") {
					var postData = paramsToAdd.join("&");
				} else {
					var postData = null;
					if(url.indexOf("?") === -1) {
						url += "?"+paramsToAdd.join("&");
					} else {
						url += "&"+paramsToAdd.join("&");
					}
				}
			}
			
			return new LocateSubmission(url, postData);
		},
		
		"_removeIcon":function() {
			if(!this.icon) return;
			var uri = _ios.newURI(this.icon, null, null);
			var file = uri.QueryInterface(Components.interfaces.nsIFileURL).file;
			if(file.exists()) file.remove(null);
		},
		
		"_updateIcon":function() {
			// create new channel
			var uri = _ios.newURI(this._iconSourceURI, null, null);
			if(uri.scheme !== "http" && uri.scheme !== "https" && uri.scheme !== "ftp") return;
			var chan = _ios.newChannelFromURI(uri);
			var listener = new loadListener(chan, this, _engineIconLoaded);
			chan.notificationCallbacks = listener;
			chan.asyncOpen(listener, null);
		}
	}
	
	/**
	 * Ripped from nsSearchService.js
	 */
	function loadListener(aChannel, aEngine, aCallback) {
		this._channel = aChannel;
		this._bytes = [];
		this._engine = aEngine;
		this._callback = aCallback;
	}
	
	loadListener.prototype = {
		_callback: null,
		_channel: null,
		_countRead: 0,
		_engine: null,
		_stream: null,
		
		QueryInterface: function SRCH_loadQI(aIID) {
			if (aIID.equals(Ci.nsISupports)           ||
				aIID.equals(Ci.nsIRequestObserver)    ||
				aIID.equals(Ci.nsIStreamListener)     ||
				aIID.equals(Ci.nsIChannelEventSink)   ||
				aIID.equals(Ci.nsIInterfaceRequestor) ||
				aIID.equals(Ci.nsIBadCertListener2)   ||
				aIID.equals(Ci.nsISSLErrorListener)   ||
				// See FIXME comment below
				aIID.equals(Ci.nsIHttpEventSink)      ||
				aIID.equals(Ci.nsIProgressEventSink)  ||
				false)
			  return this;
			
			throw Components.results.NS_ERROR_NO_INTERFACE;
		},
		
		// nsIRequestObserver
		onStartRequest: function SRCH_loadStartR(aRequest, aContext) {
			this._stream = Cc["@mozilla.org/binaryinputstream;1"].
						   createInstance(Ci.nsIBinaryInputStream);
		},
		
		onStopRequest: function SRCH_loadStopR(aRequest, aContext, aStatusCode) {
			var requestFailed = !Components.isSuccessCode(aStatusCode);
			if (!requestFailed && (aRequest instanceof Ci.nsIHttpChannel))
				requestFailed = !aRequest.requestSucceeded;
			
			if (requestFailed || this._countRead == 0) {
				// send null so the callback can deal with the failure
				this._callback(null, this._engine, this._channel.contentType);
			} else
				this._callback(this._bytes, this._engine, this._channel.contentType);
			this._channel = null;
			this._engine  = null;
		},
		
		// nsIStreamListener
		onDataAvailable: function SRCH_loadDAvailable(aRequest, aContext,
													aInputStream, aOffset,
													aCount) {
			this._stream.setInputStream(aInputStream);
			
			// Get a byte array of the data
			this._bytes = this._bytes.concat(this._stream.readByteArray(aCount));
			this._countRead += aCount;
		},
		
		// nsIChannelEventSink
		onChannelRedirect: function SRCH_loadCRedirect(aOldChannel, aNewChannel,
													 aFlags) {
			this._channel = aNewChannel;
		},
		
		// nsIInterfaceRequestor
		getInterface: function SRCH_load_GI(aIID) {
			return this.QueryInterface(aIID);
		},
		
		// nsIBadCertListener2
		notifyCertProblem: function SRCH_certProblem(socketInfo, status, targetSite) {
			return true;
		},
		
		// nsISSLErrorListener
		notifySSLError: function SRCH_SSLError(socketInfo, error, targetSite) {
			return true;
		},
		
		// FIXME: bug 253127
		// nsIHttpEventSink
		onRedirect: function (aChannel, aNewChannel) {},
		// nsIProgressEventSink
		onProgress: function (aRequest, aContext, aProgress, aProgressMax) {},
		onStatus: function (aRequest, aContext, aStatus, aStatusArg) {}
	}
}