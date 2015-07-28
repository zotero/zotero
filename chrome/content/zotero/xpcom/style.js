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
	var _styles, _visibleStyles, _cacheTranslatorData;
	
	var _renamedStyles = null;
	
	Components.utils.import("resource://zotero/q.js");
	Components.utils.import("resource://gre/modules/Services.jsm");
	
	this.xsltProcessor = null;
	this.ios = Components.classes["@mozilla.org/network/io-service;1"].
		getService(Components.interfaces.nsIIOService);
	
	this.ns = {
		"csl":"http://purl.org/net/xbiblio/csl"
	};
	
	this.preinit = function () {
		// Upgrade style locale prefs for 4.0.27
		var bibliographyLocale = Zotero.Prefs.get("export.bibliographyLocale");
		if (bibliographyLocale) {
			Zotero.Prefs.set("export.lastLocale", bibliographyLocale);
			Zotero.Prefs.set("export.quickCopy.locale", bibliographyLocale);
			Zotero.Prefs.clear("export.bibliographyLocale");
		}
		
		// TEMP
		// Until we get asynchronous style loading, load renamed styles at startup, since the
		// synchronous call we were using breaks the first drag of the session (on OS X, at least)
		_renamedStyles = {};
		Zotero.HTTP.promise(
			"GET", "resource://zotero/schema/renamed-styles.json", { responseType: 'json' }
		)
		.then(function (xmlhttp) {
			// Map some obsolete styles to current ones
			if (xmlhttp.response) {
				_renamedStyles = xmlhttp.response;
			}
		})
		.done();
	}
	
	/**
	 * Initializes styles cache, loading metadata for styles into memory
	 */
	this.init = function() {
		_initialized = true;
		
		var start = (new Date()).getTime()
		
		_styles = {};
		_visibleStyles = [];
		_cacheTranslatorData = Zotero.Prefs.get("cacheTranslatorData");
		this.lastCSL = null;
		
		// main dir
		var dir = Zotero.getStylesDirectory();
		var i = _readStylesFromDirectory(dir, false);
		
		// hidden dir
		dir.append("hidden");
		if (dir.exists()) i += _readStylesFromDirectory(dir, true);
		
		// Sort visible styles by title
		_visibleStyles.sort(function(a, b) {
			return a.title.localeCompare(b.title);
		})
		// .. and freeze, so they can be returned directly
		_visibleStyles = Object.freeze(_visibleStyles);
		
		Zotero.debug("Cached "+i+" styles in "+((new Date()).getTime() - start)+" ms");
		
		// load available CSL locales
		var localeFile = {};
		var locales = {};
		var primaryDialects = {};
		var localesLocation = "chrome://zotero/content/locale/csl/locales.json";
		localeFile = JSON.parse(Zotero.File.getContentsFromURL(localesLocation));
		
		primaryDialects = localeFile["primary-dialects"];
		
		// only keep localized language name
		for (let locale in localeFile["language-names"]) {
			locales[locale] = localeFile["language-names"][locale][0];
		}
		
		this.locales = locales;
		this.primaryDialects = primaryDialects;
	}
	
	/**
	 * Reads all styles from a given directory and caches their metadata
	 * @private
	 */
	function _readStylesFromDirectory(dir, hidden) {
		var i = 0;
		var contents = dir.directoryEntries;
		while(contents.hasMoreElements()) {
			var file = contents.getNext().QueryInterface(Components.interfaces.nsIFile),
				filename = file.leafName;
			if(!filename || filename[0] === "."
					|| filename.substr(-4).toLowerCase() !== ".csl"
					|| file.isDirectory()) continue;
			
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
		
		return i;
	}
	
	/**
	 * Gets a style with a given ID
	 * @param {String} id
	 * @param {Boolean} skipMappings Don't automatically return renamed style
	 */
	this.get = function(id, skipMappings) {
		if(!_initialized) this.init();
		
		// TODO: With asynchronous style loading, move renamedStyles call back here
		
		if(!skipMappings) {
			var prefix = "http://www.zotero.org/styles/";
			var shortName = id.replace(prefix, "");
			if(_renamedStyles.hasOwnProperty(shortName) && _styles[prefix + _renamedStyles[shortName]]) {
				let newID = prefix + _renamedStyles[shortName];
				Zotero.debug("Mapping " + id + " to " + newID);
				return _styles[newID];
			}
		}
		
		return _styles[id] || false;
	}
	
	/**
	 * Gets all visible styles
	 * @return {Zotero.Style[]} An immutable array of Zotero.Style objects
	 */
	this.getVisible = function() {
		if(!_initialized || !_cacheTranslatorData) this.init();
		return _visibleStyles; // Immutable
	}
	
	/**
	 * Gets all styles
	 * @return {Object} An object whose keys are style IDs, and whose values are Zotero.Style objects
	 */
	this.getAll = function() {
		if(!_initialized || !_cacheTranslatorData) this.init();
		return _styles;
	}
	
	/**
	 * Validates a style
	 * @param {String} style The style, as a string
	 * @return {Promise} A promise representing the style file. This promise is rejected
	 *    with the validation error if validation fails, or resolved if it is not.
	 */
	this.validate = function(style) {
		var deferred = Q.defer(),
			worker = new Worker("resource://zotero/csl-validator.js"); 
		worker.onmessage = function(event) {
			if(event.data) {
				deferred.reject(event.data);
			} else {
				deferred.resolve();
			}
		};
		worker.postMessage(style);
		return deferred.promise;
	}
	
	/**
	 * Installs a style file, getting the contents of an nsIFile and showing appropriate
	 * error messages
	 * @param {String|nsIFile} style An nsIFile representing a style on disk, or a string
	 *     containing the style data
	 * @param {String} origin The origin of the style, either a filename or URL, to be
	 *     displayed in dialogs referencing the style
	 */
	this.install = function(style, origin) {
		var styleInstalled;
		if(style instanceof Components.interfaces.nsIFile) {
			// handle nsIFiles
			var url = Services.io.newFileURI(style);
			styleInstalled = Zotero.HTTP.promise("GET", url.spec).when(function(xmlhttp) {
				return _install(xmlhttp.responseText, style.leafName);
			});
		} else {
			styleInstalled = _install(style, origin);
		}
		
		styleInstalled.fail(function(error) {
			// Unless user cancelled, show an alert with the error
			if(typeof error === "object" && error instanceof Zotero.Exception.UserCancelled) return;
			if(typeof error === "object" && error instanceof Zotero.Exception.Alert) {
				error.present();
				error.log();
			} else {
				Zotero.logError(error);
				(new Zotero.Exception.Alert("styles.install.unexpectedError",
					origin, "styles.install.title", error)).present();
			}
		}).done();
	}
	
	/**
	 * Installs a style
	 * @param {String} style The style as a string
	 * @param {String} origin The origin of the style, either a filename or URL, to be
	 *     displayed in dialogs referencing the style
	 * @param {Boolean} [hidden] Whether style is to be hidden.
	 * @return {Promise}
	 */
	function _install(style, origin, hidden) {
		if(!_initialized || !_cacheTranslatorData) Zotero.Styles.init();
		
		var existingFile, destFile, source, styleID
		return Q.fcall(function() {
			// First, parse style and make sure it's valid XML
			var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
					.createInstance(Components.interfaces.nsIDOMParser),
				doc = parser.parseFromString(style, "application/xml");
			
			styleID = Zotero.Utilities.xpathText(doc, '/csl:style/csl:info[1]/csl:id[1]',
					Zotero.Styles.ns),
				// Get file name from URL
				m = /[^\/]+$/.exec(styleID),
				fileName = Zotero.File.getValidFileName(m ? m[0] : styleID),
				title = Zotero.Utilities.xpathText(doc, '/csl:style/csl:info[1]/csl:title[1]',
					Zotero.Styles.ns);
			
			if(!styleID || !title) {
				// If it's not valid XML, we'll return a promise that immediately resolves
				// to an error
				throw new Zotero.Exception.Alert("styles.installError", origin,
					"styles.install.title", "Style is not valid XML, or the styleID or title is missing");
			}
				
			// look for a parent
			source = Zotero.Utilities.xpathText(doc,
				'/csl:style/csl:info[1]/csl:link[@rel="source" or @rel="independent-parent"][1]/@href',
				Zotero.Styles.ns);
			if(source == styleID) {
				throw new Zotero.Exception.Alert("styles.installError", origin,
					"styles.install.title", "Style references itself as source");
			}
			
			// ensure csl extension
			if(fileName.substr(-4).toLowerCase() != ".csl") fileName += ".csl";
			
			destFile = Zotero.getStylesDirectory();
			var destFileHidden = destFile.clone();
			destFile.append(fileName);
			destFileHidden.append("hidden");
			if(hidden) Zotero.File.createDirectoryIfMissing(destFileHidden);
			destFileHidden.append(fileName);
			
			// look for an existing style with the same styleID or filename
			var existingTitle;
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
					for each(var existingStyle in _styles) {
						if(destFile.equals(existingStyle.file)) {
							existingTitle = existingStyle.title;
							break;
						}
					}
				}
			}
			
			// also look for an existing style with the same title
			if(!existingFile) {
				for each(var existingStyle in Zotero.Styles.getAll()) {
					if(title === existingStyle.title) {
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
				if(existingTitle) {
					var text = Zotero.getString('styles.updateStyle', [existingTitle, title, origin]);
				} else {
					var text = Zotero.getString('styles.installStyle', [title, origin]);
				}
				
				var index = Services.prompt.confirmEx(null, Zotero.getString('styles.install.title'),
					text,
					((Services.prompt.BUTTON_POS_0) * (Services.prompt.BUTTON_TITLE_IS_STRING)
					+ (Services.prompt.BUTTON_POS_1) * (Services.prompt.BUTTON_TITLE_CANCEL)),
					Zotero.getString('general.install'), null, null, null, {}
				);
				
				if(index !== 0) {
					throw new Zotero.Exception.UserCancelled("style installation");
				}
			}
		
			return Zotero.Styles.validate(style).fail(function(validationErrors) {
				Zotero.logError("Style from "+origin+" failed to validate:\n\n"+validationErrors);
				
				// If validation fails on the parent of a dependent style, ignore it (for now)
				if(hidden) return;
				
				// If validation fails on a different style, we ask the user if s/he really
				// wants to install it
				Components.utils.import("resource://gre/modules/Services.jsm");
				var shouldInstall = Services.prompt.confirmEx(null,
					Zotero.getString('styles.install.title'),
					Zotero.getString('styles.validationWarning', origin),
					(Services.prompt.BUTTON_POS_0) * (Services.prompt.BUTTON_TITLE_OK)
					+ (Services.prompt.BUTTON_POS_1) * (Services.prompt.BUTTON_TITLE_CANCEL)
					+ Services.prompt.BUTTON_POS_1_DEFAULT + Services.prompt.BUTTON_DELAY_ENABLE,
					null, null, null, null, {}
				);
				if(shouldInstall !== 0) {
					throw new Zotero.Exception.UserCancelled("style installation");
				}
			});
		}).then(function() {
			// User wants to install/update		
			if(source && !_styles[source]) {
				// Need to fetch source
				if(source.substr(0, 7) === "http://" || source.substr(0, 8) === "https://") {
					return Zotero.HTTP.promise("GET", source).then(function(xmlhttp) {
						return _install(xmlhttp.responseText, origin, true);
					}).fail(function(error) {
						if(typeof error === "object" && error instanceof Zotero.Exception.Alert) {
							throw new Zotero.Exception.Alert("styles.installSourceError", [origin, source],
								"styles.install.title", error);
						} else {
							throw error;
						}
					});
				} else {
					throw new Zotero.Exception.Alert("styles.installSourceError", [origin, source],
						"styles.install.title", "Source CSL URI is invalid");
				}
			}
		}).then(function() {
			// Dependent style has been retrieved if there was one, so we're ready to
			// continue
			
			// Remove any existing file with a different name
			if(existingFile) existingFile.remove(false);
			
			return Zotero.File.putContentsAsync(destFile, style);
		}).then(function() {			
			// Cache
			Zotero.Styles.init();
			
			// Refresh preferences windows
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].
				getService(Components.interfaces.nsIWindowMediator);
			var enumerator = wm.getEnumerator("zotero:pref");
			while(enumerator.hasMoreElements()) {
				var win = enumerator.getNext();
				if(win.Zotero_Preferences.Cite) {
					win.Zotero_Preferences.Cite.refreshStylesList(styleID);
				}
			}
		});
	}
	
	/**
	 * Populate menulist with locales
	 * 
	 * @param {xul:menulist} menulist
	 */
	this.populateLocaleList = function(menulist) {
		if(!_initialized) this.init();
		
		// Reset menulist
		menulist.selectedItem = null;
		menulist.removeAllItems();
		
		let fallbackLocale = Zotero.Styles.primaryDialects[Zotero.locale]
			|| Zotero.locale;
		
		let menuLocales = Zotero.Utilities.deepCopy(Zotero.Styles.locales);
		let menuLocalesKeys = Object.keys(menuLocales).sort();
		
		// Make sure that client locale is always available as a choice
		if (fallbackLocale && !(fallbackLocale in menuLocales)) {
			menuLocales[fallbackLocale] = fallbackLocale;
			menuLocalesKeys.unshift(fallbackLocale);
		}
		
		for (let i=0; i<menuLocalesKeys.length; i++) {
			menulist.appendItem(menuLocales[menuLocalesKeys[i]], menuLocalesKeys[i]);
		}
	};
	
	/**
	 * Update locale list state based on style selection.
	 *   For styles that do not define a locale, enable the list and select a
	 *     preferred locale.
	 *   For styles that define a locale, disable the list and select the
	 *     specified locale. If the locale does not exist, it is added to the list.
	 *   If null is passed instead of style, the list and its label are disabled,
	 *    and set to blank value.
	 * 
	 * Note: Do not call this function synchronously immediately after
	 *   populateLocaleList. The menulist items are added, but the values are not
	 *   yet set.
	 * 
	 * @param {xul:menulist} menulist Menulist object that will be manipulated
	 * @param {Zotero.Style} style Currently selected style
	 * @param {String} prefLocale Preferred locale if not overridden by the style
	 * 
	 * @return {String} The locale that was selected
	 */
	this.updateLocaleList = function(menulist, style, prefLocale) {
		// Remove any nodes that were manually added to menulist
		let availableLocales = [];
		for (let i=0; i<menulist.itemCount; i++) {
			let item = menulist.getItemAtIndex(i);
			if (item.getAttributeNS('zotero:', 'customLocale')) {
				menulist.removeItemAt(i);
				i--;
				continue;
			}
			
			availableLocales.push(item.value);
		}
		
		if (!style) {
			// disable menulist and label
			menulist.disabled = true;
			if (menulist.labelElement) menulist.labelElement.disabled = true;
			
			// set node to blank node
			// If we just set value to "", the internal label is collapsed and the dropdown list becomes shorter
			let blankListNode = menulist.appendItem('', '');
			blankListNode.setAttributeNS('zotero:', 'customLocale', true);
			
			menulist.selectedItem = blankListNode;
			return menulist.value;
		}
		
		menulist.disabled = !!style.locale;
		if (menulist.labelElement) menulist.labelElement.disabled = false;
		
		let selectLocale = style.locale || prefLocale || Zotero.locale;
		selectLocale = Zotero.Styles.primaryDialects[selectLocale] || selectLocale;
		
		// Make sure the locale we want to select is in the menulist
		if (availableLocales.indexOf(selectLocale) == -1) {
			let customLocale = menulist.insertItemAt(0, selectLocale, selectLocale);
			customLocale.setAttributeNS('zotero:', 'customLocale', true);
		}
		
		return menulist.value = selectLocale;
	}
}

/**
 * @class Represents a style file and its metadata
 * @property {nsIFile} file The path to the style file
 * @property {String} styleID
 * @property {String} url The URL where the style can be found (rel="self")
 * @property {String} type "csl" for CSL styles
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
	
	this.type = "csl";
	
	var style = typeof arg === "string" ? arg : Zotero.File.getContents(arg),
		parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
			.createInstance(Components.interfaces.nsIDOMParser),
		doc = parser.parseFromString(style, "application/xml");
	if(doc.documentElement.localName === "parsererror") {
		throw new Error("File is not valid XML");
	}
				
	this.styleID = Zotero.Utilities.xpathText(doc, '/csl:style/csl:info[1]/csl:id[1]',
		Zotero.Styles.ns);
	this.url = Zotero.Utilities.xpathText(doc,
		'/csl:style/csl:info[1]/csl:link[@rel="self"][1]/@href',
		Zotero.Styles.ns);
	this.title = Zotero.Utilities.xpathText(doc, '/csl:style/csl:info[1]/csl:title[1]',
		Zotero.Styles.ns);
	this.updated = Zotero.Utilities.xpathText(doc, '/csl:style/csl:info[1]/csl:updated[1]',
		Zotero.Styles.ns).replace(/(.+)T([^\+]+)\+?.*/, "$1 $2");
	this.locale = Zotero.Utilities.xpathText(doc, '/csl:style/@default-locale',
		Zotero.Styles.ns) || null;
	this._class = doc.documentElement.getAttribute("class");
	this._usesAbbreviation = !!Zotero.Utilities.xpath(doc,
		'//csl:text[(@variable="container-title" and @form="short") or (@variable="container-title-short")][1]',
		Zotero.Styles.ns).length;
	this._hasBibliography = !!doc.getElementsByTagName("bibliography").length;
	this._version = doc.documentElement.getAttribute("version");
	if(!this._version) {
		this._version = "0.8";
		
		//In CSL 0.8.1, the "term" attribute on cs:category stored both
		//citation formats and fields.
		this.categories = [category.getAttribute("term")
		for each(category in Zotero.Utilities.xpath(doc,
			'/csl:style/csl:info[1]/csl:category', Zotero.Styles.ns))
			if(category.hasAttribute("term"))];
	} else {
		//CSL 1.0 introduced a dedicated "citation-format" attribute on cs:category 
		this.categories = Zotero.Utilities.xpathText(doc,
			'/csl:style/csl:info[1]/csl:category[@citation-format][1]/@citation-format',
			Zotero.Styles.ns);
	}
	
	this.source = Zotero.Utilities.xpathText(doc,
		'/csl:style/csl:info[1]/csl:link[@rel="source" or @rel="independent-parent"][1]/@href',
		Zotero.Styles.ns);
	if(this.source === this.styleID) {
		throw "Style with ID "+this.styleID+" references itself as source";
	}
}

/**
 * Get a citeproc-js CSL.Engine instance
 * @param {String} locale Locale code
 * @param {Boolean} automaticJournalAbbreviations Whether to automatically abbreviate titles
 */
Zotero.Style.prototype.getCiteProc = function(locale, automaticJournalAbbreviations) {
	if(!locale) {
		var locale = Zotero.Prefs.get('export.lastLocale') || Zotero.locale;
		if(!locale) {
			var locale = 'en-US';
		}
	}
	
	// determine version of parent style
	var overrideLocale = false; // to force dependent style locale
	if(this.source) {
		var parentStyle = Zotero.Styles.get(this.source);
		if(!parentStyle) {
			throw(new Error('Style references '+this.source+', but this style is not installed',
				Zotero.Styles.ios.newFileURI(this.file).spec, null));
		}
		var version = parentStyle._version;
		
		// citeproc-js will not know anything about the dependent style, including
		// the default-locale, so we need to force locale if a dependent style
		// contains one
		if(this.locale) {
			overrideLocale = true;
			locale = this.locale;
		}
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
	
	try {
		var citeproc = new Zotero.CiteProc.CSL.Engine(
			new Zotero.Cite.System(automaticJournalAbbreviations),
			xml,
			locale,
			overrideLocale
		);
		
		// Don't try to parse author names. We parse them in itemToCSLJSON
		citeproc.opt.development_extensions.parse_names = false;
		
		return citeproc;
	} catch(e) {
		Zotero.logError(e);
		throw e;
	}
};

Zotero.Style.prototype.__defineGetter__("csl", function() {
	Zotero.logError("Zotero.Style.csl is deprecated. Use Zotero.Style.getCiteProc()");
	return this.getCiteProc();
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
	return this._hasBibliography;
});

Zotero.Style.prototype.__defineGetter__("usesAbbreviation",
/**
 * Retrieves the style class, either from the metadata that's already loaded or by loading the file
 * @type String
 */
function() {
	if(this.source) {
		var parentStyle = Zotero.Styles.get(this.source);
		if(!parentStyle) return false;
		return parentStyle.usesAbbreviation;
	}
	return this._usesAbbreviation;
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
	var indepFile = this.independentFile;
	if(indepFile) return Zotero.File.getContents(indepFile);
	return this.string;
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
