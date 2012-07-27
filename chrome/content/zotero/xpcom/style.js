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

/**
 * @property {Boolean} cacheTranslatorData Whether translator data should be cached or reloaded
 *	every time a translator is accessed
 * @property {Zotero.CSL} lastCSL
 */
Zotero.Styles = new function() {
	var _initialized = false;
	var _styles, _visibleStyles;
	
	this.xsltProcessor = null;
	this.ios = Components.classes["@mozilla.org/network/io-service;1"].
		getService(Components.interfaces.nsIIOService);
	
	/**
	 * Initializes styles cache, loading metadata for styles into memory
	 */
	this.init = function() {
		_initialized = true;
		
		var start = (new Date()).getTime()
		
		_styles = {};
		_visibleStyles = [];
		this.cacheTranslatorData = Zotero.Prefs.get("cacheTranslatorData");
		this.lastCSL = null;
		
		// main dir
		var dir = Zotero.getStylesDirectory();
		var i = _readStylesFromDirectory(dir, false);
		
		// hidden dir
		dir.append("hidden");
		if(dir.exists()) i += _readStylesFromDirectory(dir, true);
		
		Zotero.debug("Cached "+i+" styles in "+((new Date()).getTime() - start)+" ms");
	}
	
	/**
	 * Sort function for visible styles cache
	 */
	function _sortVisibleStyles (a,b) {
		if (a.title > b.title) {
			return 1;
		} else if (a.title < b.title) {
			return -1;
		} else {
			return 0;
		}
	}
	
	/**
	 * Reads all styles from a given directory and caches their metadata
	 * @private
	 */
	function _readStylesFromDirectory(dir, hidden) {
		var i = 0;
		var contents = dir.directoryEntries;
		while(contents.hasMoreElements()) {
			var file = contents.getNext().QueryInterface(Components.interfaces.nsIFile);
			if(!file.leafName || file.leafName[0] == "." || file.isDirectory()) continue;
			
			try {
				var style = new Zotero.Style(file);
			}
			catch (e) {
				Zotero.log(
					"Error loading style '" + file.leafName + "': " + e.message,
					"error",
					file.path,
					null,
					e.lineNumber
				);
				continue;
			}
			if(style.styleID) {
				if(_styles[style.styleID]) {
					// same style is already cached
					Zotero.log('Style with ID '+style.styleID+' already loaded from "'+
						_styles[style.styleID].file.leafName+'"', "error",
						Zotero.Styles.ios.newFileURI(style.file).spec);
				} else {
					// add to cache
					_styles[style.styleID] = style;
					_styles[style.styleID].hidden = hidden;
					if(!hidden) _visibleStyles.push(style);
				}
			}
			i++;
		}
        _visibleStyles.sort(_sortVisibleStyles);
		return i;
	}

	/**
	 * Gets a style with a given ID
	 * @param {String} id
	 */
	this.get = function(id) {
		// Map some obsolete styles to current ones
		var mappings = {
			"http://www.zotero.org/styles/chicago-note": "http://www.zotero.org/styles/chicago-note-bibliography",
			"http://www.zotero.org/styles/mhra_note_without_bibliography": "http://www.zotero.org/styles/mhra",
			"http://www.zotero.org/styles/aaa": "http://www.zotero.org/styles/american-anthropological-association"
		};
		if(mappings[id]) {
			Zotero.debug("Mapping " + id + " to " + mappings[id]);
			id = mappings[id];
		}
		
		if(!_initialized) this.init();
		return _styles[id] ? _styles[id] : false;
	}
	
	/**
	 * Gets all visible styles
	 * @return {Zotero.Style[]} An array of Zotero.Style objects
	 */
	this.getVisible = function() {
		if(!_initialized || !this.cacheTranslatorData) this.init();
		return _visibleStyles.slice(0);
	}
	
	/**
	 * Gets all styles
	 * @return {Object} An object whose keys are style IDs, and whose values are Zotero.Style objects
	 */
	this.getAll = function() {
		if(!_initialized || !this.cacheTranslatorData) this.init();
		return _styles;
	}
	
	/**
	 * Installs a style file
	 * @param {String|nsIFile} style An nsIFile representing a style on disk, or a string containing
	 *	the style data
	 * @param {String} loadURI The URI this style file was loaded from
	 * @param {Boolean} hidden Whether style is to be hidden. If this parameter is true, UI alerts
	 *	are silenced as well
	 */
	this.install = function(style, loadURI, hidden) {
		// "with ({});" needed to fix default namespace scope issue
		// See https://bugzilla.mozilla.org/show_bug.cgi?id=330572
		default xml namespace = "http://purl.org/net/xbiblio/csl"; with ({});
		const pathRe = /[^\/]+$/;
		
		if(!_initialized || !this.cacheTranslatorData) this.init();
		
		var type = "csl";
		
		// handle nsIFiles
		var styleFile = null;
		if(style instanceof Components.interfaces.nsIFile) {
			styleFile = style;
			loadURI = style.leafName;
			if(loadURI.substr(-4) == ".ens") {
				type = "ens";
				style = Zotero.File.getBinaryContents(styleFile);
			} else {
				style = Zotero.File.getContents(styleFile);
			}
		}
		
		var error = false;
		try {
			if(type == "ens") {
				// EN style
				var type = "ens";
				var enConverter = new Zotero.ENConverter(style);
				var xml = enConverter.parse();
			} else {
				// CSL
				var xml = this.cleanXML(style);
				if (!xml.name()) {
					throw new Error("File is not XML");
				}
			}
		} catch(e) {
			error = e;
		}
		
		if(!xml || error) {
			if(!hidden) alert(Zotero.getString('styles.installError', loadURI));
			if(error) throw error;
			return false;
		}
		
		var source = null;
		var styleID = xml.info.id.toString();
		if(type == "ens") {
			var title = styleFile.leafName.substr(0, styleFile.leafName.length-4);
			var fileName = styleFile.leafName;
		} else {
			// get file name from URL
			var m = pathRe.exec(styleID);
			var fileName = Zotero.File.getValidFileName(m ? m[0] : styleID);
			var title = xml.info.title.toString();
			
			// look for a parent
			for each(var link in xml.info.link) {
				if(link.@rel == "source" || link.@rel == "independent-parent") {
					source = link.@href.toString();
					if(source == styleID) {
						if(!hidden) alert(Zotero.getString('styles.installError', loadURI));
						throw "Style with ID "+this.styleID+" references itself as source";
					}
					break;
				}
			}
		}
		
		// ensure csl or ens extension
		if(fileName.substr(-4).toLowerCase() != "."+type) fileName += "."+type;
		
		var destFile = Zotero.getStylesDirectory();
		var destFileHidden = destFile.clone();
		destFile.append(fileName);
		destFileHidden.append("hidden");
		if(hidden) Zotero.File.createDirectoryIfMissing(destFileHidden);
		destFileHidden.append(fileName);
		
		// look for an existing style with the same styleID or filename
		var existingFile = null;
		var existingTitle = null;
		if(_styles[styleID]) {
			existingFile = _styles[styleID].file;
			existingTitle = _styles[styleID].title;
		} else {
			if(destFile.exists()) {
				existingFile = destFile;
			} else if(destFileHidden.exists()) {
				existingFile = destFileHidden;
			}
			
			if(existingFile) {
				// find associated style
				for each(var existingStyle in this._styles) {
					if(destFile.equals(existingStyle.file)) {
						existingTitle = existingStyle.title;
						break;
					}
				}
			}
		}
		
		// also look for an existing style with the same title
		if(!existingFile) {
			var styleTitle = xml.info.title.toString();
			for each(var existingStyle in this.getAll()) {
				if(styleTitle === existingStyle.title) {
					existingFile = existingStyle.file;
					existingTitle = existingStyle.title;
					break;
				}
			}
		}
		
		// display a dialog to tell the user we're about to install the style
		if(hidden) {
			destFile = destFileHidden;
		} else {
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Components.interfaces.nsIPromptService);
			
			if(existingTitle) {
				var text = Zotero.getString('styles.updateStyle', [existingTitle, title, loadURI]);
			} else {
				var text = Zotero.getString('styles.installStyle', [title, loadURI]);
			}
			
			var index = ps.confirmEx(null, '',
				text,
				((ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
				+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)),
				Zotero.getString('general.install'), null, null, null, {}
			);
		}
		
		if(hidden || index == 0) {
			// user wants to install/update		
			if(source && !_styles[source]) {
				// need to fetch source
				if(source.substr(0, 7) == "http://" || source.substr(0, 8) == "https://") {
					Zotero.HTTP.doGet(source, function(xmlhttp) {
						var success = false;
						var error = null;
						try {
							var success = Zotero.Styles.install(xmlhttp.responseText, loadURI, true);
						} catch(e) {
							error = e;
						}
						
						if(success) {
							_completeInstall(style, styleID, destFile, existingFile, styleFile);
						} else {
							if(!hidden) alert(Zotero.getString('styles.installSourceError', [loadURI, source]));
							throw error;
						}
					});
				} else {
					if(!hidden) alert(Zotero.getString('styles.installSourceError', [loadURI, source]));
					throw "Source CSL URI is invalid";
				}
			} else {
				_completeInstall(style, styleID, destFile, existingFile, styleFile);
			}
			return styleID;
		}
		
		return false;
	}

	this.cleanXML = function(str) {
		// this is where this should happen
		str = str.replace(/\s*<\?[^>]*\?>\s*\n/g, "");
		var ret = new XML(str);
		return ret;
	}
	
	/**
	 * Finishes installing a style, copying the file, reloading the style cache, and refreshing the
	 * styles list in any open windows
	 * @param {String} style The style string
	 * @param {String} styleID The style ID
	 * @param {nsIFile} destFile The destination for the style
	 * @param {nsIFile} [existingFile] The existing file to delete before copying this one
	 * @param {nsIFile} [styleFile] The file that contains the style to be installed
	 * @private
	 */
	function _completeInstall(style, styleID, destFile, existingFile, styleFile) {
		// remove any existing file with a different name
		if(existingFile) existingFile.remove(false);
		
		if(styleFile) {
			styleFile.copyToFollowingLinks(destFile.parent, destFile.leafName);
		} else {
			Zotero.File.putContents(destFile, style);
		}
		
		// recache
		Zotero.Styles.init();
		
		// refresh preferences windows
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
			getService(Components.interfaces.nsIWindowMediator);
		var enumerator = wm.getEnumerator("zotero:pref");
		while(enumerator.hasMoreElements()) {
			var win = enumerator.getNext();
			win.refreshStylesList(styleID);
		}
	}
}

/**
 * @class Represents a style file and its metadata
 * @property {nsIFile} file The path to the style file
 * @property {String} styleID
 * @property {String} type "csl" for CSL styles, "ens" for legacy styles
 * @property {String} title
 * @property {String} updated SQL-style date updated
 * @property {String} class "in-text" or "note"
 * @property {String} source The CSL that contains the formatting information for this one, or null
 *	if this CSL contains formatting information
 * @property {Zotero.CSL} csl The Zotero.CSL object used to format using this style
 * @property {Boolean} hidden True if this style is hidden in style selection dialogs, false if it
 *	is not
 */
Zotero.Style = function(arg) {
	if(typeof arg === "string") {
		this.string = arg;
	} else if(typeof arg === "object") {
		this.file = arg;
	} else {
		throw "Invalid argument passed to Zotero.Style";
	}
	
	var extension = (typeof arg === "string" ? ".csl" : arg.leafName.substr(-4).toLowerCase());
	if(extension == ".ens") {
		this.type = "ens";
		
		this.styleID = Zotero.Styles.ios.newFileURI(this.file).spec;
		this.title = this.file.leafName.substr(0, this.file.leafName.length-4);
		this.updated = Zotero.Date.dateToSQL(new Date(this.file.lastModifiedTime));
		this._version = "0.8";
	} else if(extension == ".csl") {
		// "with ({});" needed to fix default namespace scope issue
		// See https://bugzilla.mozilla.org/show_bug.cgi?id=330572
		default xml namespace = "http://purl.org/net/xbiblio/csl"; with ({});
		
		this.type = "csl";
		
		var xml = Zotero.Styles.cleanXML(typeof arg === "string" ? arg : Zotero.File.getContents(arg));
					
		this.styleID = xml.info.id.toString();
		this.title = xml.info.title.toString();
		this.updated = xml.info.updated.toString().replace(/(.+)T([^\+]+)\+?.*/, "$1 $2");
		this.categories = [category.@term.toString() for each(category in xml.info) if(category.@term.length())];
		this._class = xml.@class.toString();
		this._hasBibliography = !!xml.bibliography.length();
		this._version = xml.@version.toString();
		if(this._version == "") this._version = "0.8";
		
		this.source = null;
		for each(var link in xml.info.link) {
			if(link.@rel == "source" || link.@rel == "independent-parent") {
				this.source = link.@href.toString();
				if(this.source == this.styleID) {
					throw "Style with ID "+this.styleID+" references itself as source";
					this.source = null;
				}
				break;
			}
		}
	}
}

Zotero.Style.prototype.__defineGetter__("csl",
/**
 * Retrieves the Zotero.CSL object for this style
 * @type Zotero.CSL
 */
function() {
	var locale = Zotero.Prefs.get('export.bibliographyLocale');
	if(!locale) {
		var locale = Zotero.locale;
		if(!locale) {
			var locale = 'en-US';
		}
	}
	
	// determine version of parent style
	if(this.source) {
		var parentStyle = Zotero.Styles.get(this.source);
		if(!parentStyle) {
			throw(new Error('Style references '+this.source+', but this style is not installed',
				Zotero.Styles.ios.newFileURI(this.file).spec, null));
		}
		var version = parentStyle._version;
	} else {
		var version = this._version;
	}
	
	if(version === "0.8") {
		// get XSLT processor from updateCSL.xsl file
		if(!Zotero.Styles.xsltProcessor) {
			let protHandler = Components.classes["@mozilla.org/network/protocol;1?name=chrome"]
				.createInstance(Components.interfaces.nsIProtocolHandler);
			let channel = protHandler.newChannel(protHandler.newURI("chrome://zotero/content/updateCSL.xsl", "UTF-8", null));
			let updateXSLT = Components.classes["@mozilla.org/xmlextras/domparser;1"]
				.createInstance(Components.interfaces.nsIDOMParser)
				.parseFromStream(channel.open(), "UTF-8", channel.contentLength, "application/xml");
			
			// load XSLT file into XSLTProcessor
			Zotero.Styles.xsltProcessor = Components.classes["@mozilla.org/document-transformer;1?type=xslt"]
				.createInstance(Components.interfaces.nsIXSLTProcessor);
			Zotero.Styles.xsltProcessor.importStylesheet(updateXSLT);
		}
		
		// read style file as DOM XML
		let styleDOMXML = Components.classes["@mozilla.org/xmlextras/domparser;1"]
			.createInstance(Components.interfaces.nsIDOMParser)
			.parseFromString(this.getXML(), "text/xml");
		
		// apply XSLT and serialize output
		let newDOMXML = Zotero.Styles.xsltProcessor.transformToDocument(styleDOMXML);
		var xml = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
			.createInstance(Components.interfaces.nsIDOMSerializer).serializeToString(newDOMXML);
	} else {
		var xml = this.getXML();
	}
	
	if (Zotero.Prefs.get("csl.trigraphFormat")) {
		var trigraph = Zotero.Prefs.get("csl.trigraphFormat");
		if (!trigraph || !trigraph.match(/^(A[Aa]*00*)(?::(A[Aa]*00*))*$/)) {
			// Be obnoxiously fussy and intrusive.
			var msg = "Invalid csl.trigraphFormat string \"" + trigraph + "\".\nPlease adjust the value through about:config\nMeanwhile, the default value of \"Aaaa00:AaAa00:AaAA00:AAAA00\" will be used.";
			alert(msg);
			trigraph = "Aaaa00:AaAa00:AaAA00:AAAA00";
		}
	}

	try {
		var citeproc = new Zotero.CiteProc.CSL.Engine(Zotero.Cite.System, xml, locale);
		Zotero.setCitationLanguages({}, citeproc);
		citeproc.opt.trigraph = trigraph;
        citeproc.opt.development_extensions.static_statute_locator = true;
        citeproc.opt.development_extensions.clobber_locator_if_no_statute_section = false;
        citeproc.opt.development_extensions.handle_parallel_articles = true;

		return citeproc;
	} catch(e) {
 		Zotero.logError(e);
		throw e;
	}
});

Zotero.Style.prototype.__defineGetter__("class",
/**
 * Retrieves the style class, either from the metadata that's already loaded or by loading the file
 * @type String
 */
function() {
	if(!this._class) this.getXML();
	return this._class;
});

Zotero.Style.prototype.__defineGetter__("hasBibliography",
/**
 * Determines whether or not this style has a bibliography, either from the metadata that's already\
 * loaded or by loading the file
 * @type String
 */
function() {
	if(this.source) {
		// use hasBibliography from source style
		var parentStyle = Zotero.Styles.get(this.source);
		if(!parentStyle) {
			throw(new Error('Style references '+this.source+', but this style is not installed',
				Zotero.Styles.ios.newFileURI(this.file).spec, null));
		}
		return parentStyle.hasBibliography;
	}
	
	if(!this._hasBibliography) {
		// if we don't know whether this style has a bibliography, it's because it's an ens style
		// and we have to parse it to know
		this.getXML();
	}
	
	return this._hasBibliography;
});

Zotero.Style.prototype.__defineGetter__("independentFile",
/**
 * Retrieves the file corresponding to the independent CSL
 * (the parent if this style is dependent, or this style if it is not)
 */
function() {
	if(this.source) {
		// parent/child
		var formatCSL = Zotero.Styles.get(this.source);
		if(!formatCSL) {
			throw(new Error('Style references '+this.source+', but this style is not installed',
				Zotero.Styles.ios.newFileURI(this.file).spec, null));
		}
		return formatCSL.file;
	} else if(this.file) {
		return this.file;
	}
	return null;
});

/**
 * Retrieves the XML corresponding to this style
 * @type String
 */
Zotero.Style.prototype.getXML = function() {
	// "with ({});" needed to fix default namespace scope issue
	// See https://bugzilla.mozilla.org/show_bug.cgi?id=330572
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with ({});
	
	if(this.type == "ens") {
		// EN style
		var string = Zotero.File.getBinaryContents(this.file);
		var enConverter = new Zotero.ENConverter(string, null, this.title);
		var xml = enConverter.parse();
		this._class = xml.@class.toString();
		this._hasBibliography = !!xml.bibliography.length();
		
		return xml.toXMLString();
	} else {
		var indepFile = this.independentFile;
		if(indepFile) return Zotero.File.getContents(indepFile);
		return this.string;
	}
};

/**
 * Deletes a style
 */
Zotero.Style.prototype.remove = function() {
	if(!this.file) {
		throw "Cannot delete a style with no associated file."
	}
	
	// make sure no styles depend on this one
	var dependentStyles = false;
	var styles = Zotero.Styles.getAll();
	for each(var style in styles) {
		if(style.source == this.styleID) {
			dependentStyles = true;
			break;
		}
	}
	
	if(dependentStyles) {
		// copy dependent styles to hidden directory
		var hiddenDir = Zotero.getStylesDirectory();
		hiddenDir.append("hidden");
		Zotero.File.createDirectoryIfMissing(hiddenDir);
		this.file.moveTo(hiddenDir, null);
	} else {
		// remove defunct files
		this.file.remove(false);
	}
	
	// check to see if this style depended on a hidden one
	if(this.source) {
		var source = Zotero.Styles.get(this.source);
		if(source && source.hidden) {
			var deleteSource = true;
			
			// check to see if any other styles depend on the hidden one
			for each(var style in Zotero.Styles.getAll()) {
				if(style.source == this.source && style.styleID != this.styleID) {
					deleteSource = false;
					break;
				}
			}
			
			// if it was only this style with the dependency, delete the source
			if(deleteSource) {
				source.remove();
			}
		}
	}
	
	Zotero.Styles.init();
}