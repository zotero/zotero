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

/**
 * @property {Boolean} cacheTranslatorData Whether translator data should be cached or reloaded
 *	every time a translator is accessed
 * @property {Zotero.CSL} lastCSL
 */
Zotero.Styles = new function() {
	var _initialized = false;
	var _styles, _visibleStyles;
	
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
	 * Reads all styles from a given directory and caches their metadata
	 * @privates
	 */
	function _readStylesFromDirectory(dir, hidden) {
		var i = 0;
		var contents = dir.directoryEntries;
		while(contents.hasMoreElements()) {
			var file = contents.getNext().QueryInterface(Components.interfaces.nsIFile);
			if(!file.leafName || file.leafName[0] == "." || file.isDirectory()) continue;
			
			var style = new Zotero.Style(file);
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
		return i;
	}
	
	/**
	 * Gets a style with a given ID
	 * @param {String} id
	 */
	this.get = function(id) {
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
			/*if(type == "ens") {
				// EN style
				var type = "ens";
				var enConverter = new Zotero.ENConverter(style);
				var xml = enConverter.parse();
			} else {*/
				// CSL
				var xml = new XML(Zotero.CSL.Global.cleanXML(style));
			//}
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
				if(link.@rel == "source") {
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
					Zotero.Utilities.HTTP.doGet(source, function(xmlhttp) {
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
Zotero.Style = function(file) {
	this.file = file;
	
	var extension = file.leafName.substr(-4).toLowerCase();
	/*if(extension == ".ens") {
		this.type = "ens";
		
		this.styleID = Zotero.Styles.ios.newFileURI(this.file).spec;
		this.title = file.leafName.substr(0, file.leafName.length-4);
		this.updated = Zotero.Date.dateToSQL(new Date(file.lastModifiedTime));
	} else */if(extension == ".csl") {
		// "with ({});" needed to fix default namespace scope issue
		// See https://bugzilla.mozilla.org/show_bug.cgi?id=330572
		default xml namespace = "http://purl.org/net/xbiblio/csl"; with ({});
		
		this.type = "csl";
		
		var xml = Zotero.CSL.Global.cleanXML(Zotero.File.getContents(file));
		try {
			xml = new XML(xml);
		} catch(e) {
			Zotero.log(e.toString(), "error",
				Zotero.Styles.ios.newFileURI(this.file).spec, xml.split(/\r?\n/)[e.lineNumber-1],
				e.lineNumber);
			return;
		}
					
		this.styleID = xml.info.id.toString();
		this.title = xml.info.title.toString();
		this.updated = xml.info.updated.toString().replace(/(.+)T([^\+]+)\+?.*/, "$1 $2");
		this._class = xml.@class.toString();
		
		this.source = null;
		for each(var link in xml.info.link) {
			if(link.@rel == "source") {
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
	// cache last style
	if(Zotero.Styles.cacheTranslatorData && Zotero.Styles.lastCSL && 
			Zotero.Styles.lastCSL.styleID == this.styleID) {
		return Zotero.Styles.lastCSL;
	}
	
	if(this.type == "ens") {
		// EN style
		var string = Zotero.File.getBinaryContents(this.file);
		var enConverter = new Zotero.ENConverter(string, null, this.title);
		var xml = enConverter.parse();
	} else {
		// "with ({});" needed to fix default namespace scope issue
		// See https://bugzilla.mozilla.org/show_bug.cgi?id=330572
		default xml namespace = "http://purl.org/net/xbiblio/csl"; with ({});
		
		if(this.source) {
			// parent/child
			var formatCSL = Zotero.Styles.get(this.source);
			if(!formatCSL) {
				throw(new Error('Style references '+this.source+', but this style is not installed',
					Zotero.Styles.ios.newFileURI(this.file).spec, null));
			}
			var file = formatCSL.file;
		} else {
			var file = this.file;
		}
		
		var cslString = Zotero.File.getContents(file);
		var xml = new XML(Zotero.CSL.Global.cleanXML(cslString));
	}
	
	return (Zotero.Styles.lastCSL = new Zotero.CSL(xml));
});

Zotero.Style.prototype.__defineGetter__("class",
/**
 * Retrieves the style class, either from the metadata that's already loaded or by loading the file
 * @type String
 */
function() {
	if(this._class) return this._class;
	return (this._class = this.csl.class);
});

/**
 * Deletes a style
 */
Zotero.Style.prototype.remove = function() {
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