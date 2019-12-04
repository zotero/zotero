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

Zotero.Styles = new function() {
	var _initialized = false;
	var _initializationDeferred = false;
	var _styles, _visibleStyles;
	
	var _renamedStyles = null;
	
	Components.utils.import("resource://gre/modules/Services.jsm");
	Components.utils.import("resource://gre/modules/FileUtils.jsm");
	
	this.xsltProcessor = null;
	this.ns = {
		"csl":"http://purl.org/net/xbiblio/csl"
	};

	this.CSL_VALIDATOR_URL = "resource://zotero/csl-validator.js";
	
	
	/**
	 * Initializes styles cache, loading metadata for styles into memory
	 */
	this.init = Zotero.Promise.coroutine(function* (options = {}) {
		// Wait until bundled files have been updated, except when this is called by the schema update
		// code itself
		if (!options.fromSchemaUpdate) {
			yield Zotero.Schema.schemaUpdatePromise;
		}
		
		// If an initialization has already started, a regular init() call should return the promise
		// for that (which may already be resolved). A reinit should yield on that but then continue
		// with reinitialization.
		if (_initializationDeferred) {
			let promise = _initializationDeferred.promise;
			if (options.reinit) {
				yield promise;
			}
			else {
				return promise;
			}
		}
		
		_initializationDeferred = Zotero.Promise.defer();
		
		Zotero.debug("Initializing styles");
		var start = new Date;
		
		// Upgrade style locale prefs for 4.0.27
		var bibliographyLocale = Zotero.Prefs.get("export.bibliographyLocale");
		if (bibliographyLocale) {
			Zotero.Prefs.set("export.lastLocale", bibliographyLocale);
			Zotero.Prefs.set("export.quickCopy.locale", bibliographyLocale);
			Zotero.Prefs.clear("export.bibliographyLocale");
		}
		
		_styles = {};
		_visibleStyles = [];
		
		// main dir
		var dir = Zotero.getStylesDirectory().path;
		var num = yield _readStylesFromDirectory(dir, false);
		
		// hidden dir
		var hiddenDir = OS.Path.join(dir, 'hidden');
		if (yield OS.File.exists(hiddenDir)) {
			num += yield _readStylesFromDirectory(hiddenDir, true);
		}
		
		// Sort visible styles by title
		_visibleStyles.sort(function(a, b) {
			return a.title.localeCompare(b.title);
		})
		// .. and freeze, so they can be returned directly
		_visibleStyles = Object.freeze(_visibleStyles);
		
		Zotero.debug("Cached " + num + " styles in " + (new Date - start) + " ms");
		
		// load available CSL locales
		var localeFile = {};
		var locales = {};
		var primaryDialects = {};
		localeFile = JSON.parse(
			yield Zotero.File.getResourceAsync("chrome://zotero/content/locale/csl/locales.json")
		);
		
		primaryDialects = localeFile["primary-dialects"];
		
		// only keep localized language name
		for (let locale in localeFile["language-names"]) {
			locales[locale] = localeFile["language-names"][locale][0];
		}
		
		this.locales = locales;
		this.primaryDialects = primaryDialects;
		
		// Load renamed styles
		_renamedStyles = JSON.parse(
			yield Zotero.File.getResourceAsync("resource://zotero/schema/renamed-styles.json")
		);

		_initializationDeferred.resolve();
		_initialized = true;
		
		// Styles are fully loaded, but we still need to trigger citeproc reloads in Integration
		// so that style updates are reflected in open documents
		Zotero.Integration.resetSessionStyles();
	});
	
	this.reinit = function (options = {}) {
		return this.init(Object.assign({}, options, { reinit: true }));
	};
	
	// This is used by bibliography.js to work around a weird interaction between Bluebird and modal
	// dialogs in tests. Calling `yield Zotero.Styles.init()` from `Zotero_File_Interface_Bibliography.init()`
	// in the modal Create Bibliography dialog results in a hang, so instead use a synchronous check for
	// initialization. The hang doesn't seem to happen (at least in the same way) outside of tests.
	this.initialized = function () {
		return _initialized;
	};
	
	/**
	 * Reads all styles from a given directory and caches their metadata
	 * @private
	 */
	var _readStylesFromDirectory = Zotero.Promise.coroutine(function* (dir, hidden) {
		var numCached = 0;
		
		var iterator = new OS.File.DirectoryIterator(dir);
		try {
			while (true) {
				let entries = yield iterator.nextBatch(10); // TODO: adjust as necessary
				if (!entries.length) break;
				
				for (let i = 0; i < entries.length; i++) {
					let entry = entries[i];
					let path = entry.path;
					let fileName = entry.name;
					if (!fileName || fileName[0] === "."
							|| fileName.substr(-4).toLowerCase() !== ".csl"
							|| entry.isDir) continue;
					
					try {
						let code = yield Zotero.File.getContentsAsync(path);
						var style = new Zotero.Style(code, path);
					}
					catch (e) {
						Components.utils.reportError(e);
						Zotero.debug(e, 1);
						continue;
					}
					if(style.styleID) {
						// same style is already cached
						if (_styles[style.styleID]) {
							Components.utils.reportError('Style with ID ' + style.styleID
								+ ' already loaded from ' + _styles[style.styleID].fileName);
						} else {
							// add to cache
							_styles[style.styleID] = style;
							_styles[style.styleID].hidden = hidden;
							if(!hidden) _visibleStyles.push(style);
						}
					}
					numCached++;
				}
			}
		}
		finally {
			iterator.close();
		}
		return numCached;
	});
	
	/**
	 * Gets a style with a given ID
	 * @param {String} id
	 * @param {Boolean} skipMappings Don't automatically return renamed style
	 */
	this.get = function (id, skipMappings) {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Styles not yet loaded", 'styles');
		}
		
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
	};
	
	/**
	 * Gets all visible styles
	 * @return {Zotero.Style[]} - An immutable array of Zotero.Style objects
	 */
	this.getVisible = function () {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Styles not yet loaded", 'styles');
		}
		return _visibleStyles; // Immutable
	}
	
	/**
	 * Gets all styles
	 *
	 * @return {Object} - An object with style IDs for keys and Zotero.Style objects for values
	 */
	this.getAll = function () {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Styles not yet loaded", 'styles');
		}
		return _styles;
	}
	
	/**
	 * Validates a style
	 * @param {String} style The style, as a string
	 * @return {Promise} A promise representing the style file. This promise is rejected
	 *    with the validation error if validation fails, or resolved if it is not.
	 */
	this.validate = function (style) {
		return new Zotero.Promise((resolve, reject) => {
			let worker = new Worker(this.CSL_VALIDATOR_URL);
			worker.onmessage = function (event) {
				if (event.data) {
					reject(event.data);
				} else {
					resolve();
				}
			};
			worker.postMessage(style);
		});
	}
	
	/**
	 * Installs a style file, getting the contents of an nsIFile and showing appropriate
	 * error messages
	 * @param {Object} style - An object with one of the following properties
	 *      - file: An nsIFile or string path representing a style on disk
	 *      - path: A string path
	 *      - url: A url of the location of the style (local or remote)
	 *      - string: A string containing the style data
	 * @param {String} origin The origin of the style, either a filename or URL, to be
	 *     displayed in dialogs referencing the style
	 * @param {Boolean} [silent=false] Skip prompts
	 */
	this.install = Zotero.Promise.coroutine(function* (style, origin, silent=false) {
		var warnDeprecated;
		if (style instanceof Components.interfaces.nsIFile) {
			warnDeprecated = true;
			style = {file: style};
		} else if (typeof style == 'string') {
			warnDeprecated = true;
			style = {string: style};
		}
		if (warnDeprecated) {
			Zotero.debug("Zotero.Styles.install() now takes a style object as first argument -- update your code", 2);
		}
		
		try {
			if (style.file) {
				style.string = yield Zotero.File.getContentsAsync(style.file);
			}
			else if (style.url) {
				style.string = yield Zotero.File.getContentsFromURLAsync(style.url);
			}
			var { styleTitle, styleID } = yield _install(style.string, origin, false, silent);
		}
		catch (error) {
			// Unless user cancelled, show an alert with the error
			if(typeof error === "object" && error instanceof Zotero.Exception.UserCancelled) return {};
			if(typeof error === "object" && error instanceof Zotero.Exception.Alert) {
				Zotero.logError(error);
				if (silent) {
					throw error;
				} else {
					error.present();
				}
			} else {
				Zotero.logError(error);
				if (silent) {
					throw error
				} else {
					(new Zotero.Exception.Alert("styles.install.unexpectedError",
						origin, "styles.install.title", error)).present();
				}
			}
		}
		return { styleTitle, styleID };
	});
	
	/**
	 * Installs a style
	 * @param {String} style The style as a string
	 * @param {String} origin The origin of the style, either a filename or URL, to be
	 *     displayed in dialogs referencing the style
	 * @param {Boolean} [hidden] Whether style is to be hidden.
	 * @param {Boolean} [silent=false] Skip prompts
	 * @return {Promise}
	 */
	var _install = Zotero.Promise.coroutine(function* (style, origin, hidden, silent=false) {
		if (!_initialized) yield Zotero.Styles.init();
		
		var existingFile, destFile, source;
		
		// First, parse style and make sure it's valid XML
		var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
				.createInstance(Components.interfaces.nsIDOMParser),
			doc = parser.parseFromString(style, "application/xml");
		
		var styleID = Zotero.Utilities.xpathText(doc, '/csl:style/csl:info[1]/csl:id[1]',
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
				for (let existingStyle of _styles) {
					if(destFile.equals(existingStyle.file)) {
						existingTitle = existingStyle.title;
						break;
					}
				}
			}
		}
		
		// also look for an existing style with the same title
		if(!existingFile) {
			let styles = Zotero.Styles.getAll();
			for (let i in styles) {
				let existingStyle = styles[i];
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
		} else if (!silent) {
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
		
		yield Zotero.Styles.validate(style)
		.catch(function(validationErrors) {
			Zotero.logError("Style from " + origin + " failed to validate:\n\n" + validationErrors);
			
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
		
		// User wants to install/update
		if(source && !_styles[source]) {
			// Need to fetch source
			if(source.substr(0, 7) === "http://" || source.substr(0, 8) === "https://") {
				try {
					let xmlhttp = yield Zotero.HTTP.request("GET", source);
					yield _install(xmlhttp.responseText, origin, true);
				}
				catch (e) {
					if (typeof e === "object" && e instanceof Zotero.Exception.Alert) {
						throw new Zotero.Exception.Alert(
							"styles.installSourceError",
							[origin, source],
							"styles.install.title",
							e
						);
					}
					throw e;
				}
			} else {
				throw new Zotero.Exception.Alert("styles.installSourceError", [origin, source],
					"styles.install.title", "Source CSL URI is invalid");
			}
		}
		
		// Dependent style has been retrieved if there was one, so we're ready to
		// continue
		
		// Remove any existing file with a different name
		if(existingFile) existingFile.remove(false);
		
		yield Zotero.File.putContentsAsync(destFile, style);
		
		yield Zotero.Styles.reinit();
		
		// Refresh preferences windows
		var enumerator = Services.wm.getEnumerator("zotero:pref");
		while(enumerator.hasMoreElements()) {
			var win = enumerator.getNext();
			if(win.Zotero_Preferences.Cite) {
				yield win.Zotero_Preferences.Cite.refreshStylesList(styleID);
			}
		}
		return {
			styleTitle: existingTitle || title,
			styleID: styleID
		};
	});
	
	/**
	 * Populate menulist with locales
	 * 
	 * @param {xul:menulist} menulist
	 * @return {Promise}
	 */
	this.populateLocaleList = function (menulist) {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Styles not yet loaded", 'styles');
		}
		
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
	}
	
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
	this.updateLocaleList = function (menulist, style, prefLocale) {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Styles not yet loaded", 'styles');
		}
		
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
 * @property {String} path The path to the style file
 * @property {String} fileName The name of the style file
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
Zotero.Style = function (style, path) {
	if (typeof style != "string") {
		throw new Error("Style code must be a string");
	}
	
	this.type = "csl";
	
	var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
			.createInstance(Components.interfaces.nsIDOMParser),
		doc = parser.parseFromString(style, "application/xml");
	if(doc.documentElement.localName === "parsererror") {
		throw new Error("File is not valid XML");
	}
	
	if (path) {
		this.path = path;
		this.fileName = OS.Path.basename(path);
	}
	else {
		this.string = style;
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
	this._uppercaseSubtitles = false;
	var uppercaseSubtitlesRE = /^apa($|-)|^(academy-of-management)/;
	var shortIDMatches = this.styleID.match(/\/?([^/]+)$/);
	this._uppercaseSubtitles = !!shortIDMatches && uppercaseSubtitlesRE.test(shortIDMatches[1]);
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
		this.categories = Zotero.Utilities.xpath(
			doc, '/csl:style/csl:info[1]/csl:category', Zotero.Styles.ns)
		.filter(category => category.hasAttribute("term"))
		.map(category => category.getAttribute("term"));
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
		throw new Error("Style with ID "+this.styleID+" references itself as source");
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
			throw new Error(
				'Style references ' + this.source + ', but this style is not installed',
				Zotero.Utilities.pathToFileURI(this.path)
			);
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
			let xsl = Zotero.File.getContentsFromURL("chrome://zotero/content/updateCSL.xsl");
			let updateXSLT = Components.classes["@mozilla.org/xmlextras/domparser;1"]
				.createInstance(Components.interfaces.nsIDOMParser)
				.parseFromString(xsl, "application/xml");
			
			// XSLTProcessor is no longer available in XPCOM, so get from hidden window
			let XSLTProcessor = Cc["@mozilla.org/appshell/appShellService;1"]
				.getService(Ci.nsIAppShellService).hiddenDOMWindow.XSLTProcessor;
			// load XSLT file into XSLTProcessor
			Zotero.Styles.xsltProcessor = new XSLTProcessor();
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
			new Zotero.Cite.System({
				automaticJournalAbbreviations,
				uppercaseSubtitles: this._uppercaseSubtitles
			}),
			xml,
			locale,
			overrideLocale
		);
		
		citeproc.opt.development_extensions.wrap_url_and_doi = true;
		// Don't try to parse author names. We parse them in itemToCSLJSON
		citeproc.opt.development_extensions.parse_names = false;
		
		return citeproc;
	} catch(e) {
		Zotero.logError(e);
		throw e;
	}
};

Zotero.Style.prototype.__defineGetter__("class",
/**
 * Retrieves the style class, either from the metadata that's already loaded or by loading the file
 * @type String
 */
function() {
	if(this.source) {
		// use class from source style
		var parentStyle = Zotero.Styles.get(this.source);
		if(!parentStyle) {
			throw new Error('Style references missing parent ' + this.source);
		}
		return parentStyle.class;
	}
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
			throw new Error('Style references missing parent ' + this.source);
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
			throw new Error('Style references missing parent ' + this.source);
		}
		return formatCSL.path;
	} else if (this.path) {
		return this.path;
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
Zotero.Style.prototype.remove = Zotero.Promise.coroutine(function* () {
	if (!this.path) {
		throw new Error("Cannot delete a style with no associated file")
	}
	
	// make sure no styles depend on this one
	var dependentStyles = false;
	var styles = Zotero.Styles.getAll();
	for (let i in styles) {
		let style = styles[i];
		if(style.source == this.styleID) {
			dependentStyles = true;
			break;
		}
	}
	
	if(dependentStyles) {
		// copy dependent styles to hidden directory
		let hiddenDir = OS.Path.join(Zotero.getStylesDirectory().path, 'hidden');
		yield Zotero.File.createDirectoryIfMissingAsync(hiddenDir);
		yield OS.File.move(this.path, OS.Path.join(hiddenDir, OS.Path.basename(this.path)));
	} else {
		// remove defunct files
		yield OS.File.remove(this.path);
	}
	
	// check to see if this style depended on a hidden one
	if(this.source) {
		var source = Zotero.Styles.get(this.source);
		if(source && source.hidden) {
			var deleteSource = true;
			
			// check to see if any other styles depend on the hidden one
			let styles = Zotero.Styles.getAll();
			for (let i in styles) {
				let style = styles[i];
				if(style.source == this.source && style.styleID != this.styleID) {
					deleteSource = false;
					break;
				}
			}
			
			// if it was only this style with the dependency, delete the source
			if(deleteSource) {
				yield source.remove();
			}
		}
	}
	
	return Zotero.Styles.reinit();
});
