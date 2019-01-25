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
	var _timer;
	
	/**
	 * Read locateEngines JSON file to initialize locate manager
	 */
	this.init = async function() {
		_jsonFile = _getLocateFile();
		
		try {
			if (await OS.File.exists(_jsonFile)) {
				_locateEngines = JSON.parse(await Zotero.File.getContentsAsync(_jsonFile))
					.map(engine => new LocateEngine(engine));
			}
			else {
				await this.restoreDefaultEngines();
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	
	/**
	 * Adds a new search engine
	 * confirm parameter is currently ignored
	 */
	this.addEngine = function(engineURL, dataType, iconURL, confirm) {
		if(dataType !== Components.interfaces.nsISearchEngine.TYPE_OPENSEARCH) {
			throw new Error("LocateManager supports only OpenSearch engines");
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
	this.getEngines = function() { return _locateEngines.slice(0); }
	
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
		for (let engine of _locateEngines) if(engine.name.toLowerCase() == engineName) return engine;
		return null;
	}
	
	/**
	 * Returns the first engine with a specific alias
	 */
	this.getEngineByAlias = function(engineAlias) {
		engineAlias = engineAlias.toLowerCase();
		for (let engine of _locateEngines) if(engine.alias.toLowerCase() == engineAlias) return engine;
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
		if(oldIndex === -1) throw new Error("Engine is not currently listed");
		_locateEngines.splice(oldIndex, 1);
		engine._removeIcon();
		_serializeLocateEngines();
	}
	
	/**
	 * Restore default engines by copying file from extension dir
	 */
	this.restoreDefaultEngines = async function () {
		// get locate dir
		var locateDir = _getLocateDirectory();
		
		// remove old locate dir
		await OS.File.removeDir(locateDir, { ignoreAbsent: true, ignorePermissions: true });
		
		// create new locate dir
		await OS.File.makeDir(locateDir, { unixMode: 0o755 });
		
		// copy default file to new locate dir
		await Zotero.File.putContentsAsync(
			_jsonFile,
			await Zotero.File.getContentsFromURLAsync(_getDefaultFile())
		);
		
		// reread locate engines
		await this.init();
		
		// reload icons for default locate engines
		for (let engine of this.getEngines()) engine._updateIcon();
	}
	
	/**
	 * Writes the engines to disk; called from the nsITimer spawned by _serializeLocateEngines
	 */
	this.notify = async function () {
		await Zotero.File.putContentsAsync(_jsonFile, JSON.stringify(_locateEngines, null, "\t"));
		_timer = undefined;
	}
	
	/**
	 * Gets the JSON file containing engine info
	 */
	function _getLocateFile() {
		return OS.Path.join(_getLocateDirectory(), LOCATE_FILE_NAME);
	}
	
	/**
	 * Gets the dir containing the JSON file and engine icons
	 */
	function _getLocateDirectory() {
		return OS.Path.join(Zotero.DataDirectory.dir, LOCATE_DIR_NAME);
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
		this.uri = Services.io.newURI(uri, null, null);
		this.postData = postData;
	}
	
	/**
	 * @constructor
	 * Constructs a new LocateEngine
	 * @param {Object} [obj] The locate engine, in parsed form, as it was serialized to JSON
	 */
	var LocateEngine = function(obj) {
		this._alias = this._name = "Untitled";
		this._description = null;
		this._icon = null;
		this._hidden = false;
		this._urlTemplate = null;
		this._urlParams = [];
		
		if(obj) for(var prop in obj) this[prop] = obj[prop];
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
				throw new Error("Invalid namespace");
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
				if(i == urlTags.length) throw new Error("No Url tag found");
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
				throw new Error("LocateManager supports only responseType text/html");
			}
			
			if (item.toJSON) {
				item = item.toJSON();
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
			var uri = Services.io.newURI(this.icon, null, null);
			var file = uri.QueryInterface(Components.interfaces.nsIFileURL).file;
			if(file.exists()) file.remove(null);
		},
		
		_updateIcon: async function () {
			const iconExtensions = {
				"image/png": "png",
				"image/jpeg": "jpg",
				"image/gif": "gif",
				"image/vnd.microsoft.icon": "ico"
			};
			
			if (!this._iconSourceURI.startsWith('http') && !this._iconSourceURI.startsWith('https')) {
				return;
			}
			
			var tmpPath = OS.Path.join(Zotero.getTempDirectory().path, Zotero.Utilities.randomString());
			await Zotero.File.download(this._iconSourceURI, tmpPath);
			
			var sample = await Zotero.File.getSample(tmpPath);
			var contentType = Zotero.MIME.getMIMETypeFromData(sample);
			
			// ensure there is an extension
			var extension = iconExtensions[contentType.toLowerCase()];
			if (!extension) {
				throw new Error(`Invalid content type ${contentType} for icon for engine ${this.name}`);
			}
			
			// Find a good place to put the icon file
			var sanitizedAlias = this.name.replace(/[^\w _]/g, "");
			var iconFile = OS.Path.join(_getLocateDirectory(), sanitizedAlias + "." + extension);
			if (await OS.File.exists(iconFile)) {
				for (let i = 0; await OS.File.exists(iconFile); i++) {
					iconFile = OS.Path.join(
						OS.Path.dirname(iconFile),
						sanitizedAlias + "_" + i + "." + extension
					);
				}
			}
			
			await OS.File.move(tmpPath, iconFile);
			this.icon = OS.Path.toFileURI(iconFile);
		}
	}
	
	// Queue deferred serialization whenever a property is modified
	for (let prop of ["alias", "name", "description", "icon", "hidden"]) {
		let propName = '_' + prop;
		Object.defineProperty(LocateEngine.prototype, prop, {
			get: function () {
				return this[propName];
			},
			set: function (val) {
				var oldVal = this[propName];
				this[propName] = val;
				_watchLocateEngineProperties(prop, oldVal, val);
			}
		});
	}
}
