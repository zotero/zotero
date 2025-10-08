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

"use strict";

Zotero.QuickCopy = new function () {
	this.lastActiveURL = null;
	
	var _initialized = false;
	var _initCancelled = false;
	var _siteSettings;
	var _formattedNames;
	
	this.init = function () {
		if (_initialized) {
			return;
		}
		
		Zotero.debug("Initializing Quick Copy");
		
		_initialized = true;

		// Make sure export translator code is loaded whenever the output format changes
		this._prefObserverID = Zotero.Prefs.registerObserver(
			"export.quickCopy.setting", _loadOutputFormat
		);
		
		this._prefObserverID = Zotero.Prefs.registerObserver(
			"export.noteQuickCopy.setting", _loadNoteOutputFormat
		);
		
		Zotero.Schema.schemaUpdatePromise.then(async () => {
			// Avoid random translator initialization during tests, which can result in timeouts
			// if an export format is selected
			if (Zotero.test) return;

			// Unfortunate, but we need to keep checking this to prevent race conditions
			if (_initCancelled) return;
			await _loadOutputFormat();
			if (_initCancelled) return;
			await _loadNoteOutputFormat();
			if (_initCancelled) return;
			await this.loadSiteSettings();
		});
	};
	
	
	this.uninit = function () {
		_initialized = false;
		_initCancelled = true;
		Zotero.Prefs.unregisterObserver(this._prefObserverID);
	};
	
	
	this.loadSiteSettings = async function () {
		var sql = "SELECT key AS domainPath, value AS format FROM settings "
			+ "WHERE setting='quickCopySite'";
		var rows = await Zotero.DB.queryAsync(sql);
		// Unproxify storage row
		_siteSettings = rows.map(row => {
			return {
				domainPath: row.domainPath,
				format: row.format
			};
		});
		for (let row of rows) {
			await _preloadFormat(row.format);
		}
	};
	
	
	this.hasSiteSettings = function () {
		return _siteSettings && _siteSettings.length > 0;
	};
	
	
	/*
	 * Return Quick Copy setting object from string, stringified object, or object
	 * 
	 * Example string format: "bibliography/html=http://www.zotero.org/styles/apa"
	 *
	 * Quick Copy setting object has the following properties:
	 * - "mode": "bibliography" (for styles) or "export" (for export translators)
	 * - "contentType: "" (plain text output) or "html" (HTML output; for styles
	 *   only)
	 * - "id": style ID or export translator ID
	 * - "locale": locale code (for styles only)
	 */
	this.unserializeSetting = function (setting) {
		var settingObject = {};
		
		if (typeof setting === 'string') {
			try {
				// First test if string input is a stringified object
				settingObject = JSON.parse(setting);
			} catch (e) {
				// Try parsing as formatted string
				var parsedSetting = setting.match(/(bibliography|export)(?:\/([^=]+))?=(.+)$/);
				if (parsedSetting) {
					settingObject.mode = parsedSetting[1];
					settingObject.contentType = parsedSetting[2] || '';
					settingObject.id = parsedSetting[3];
					settingObject.locale = '';
				}
			}
		} else {
			// Return input if not a string; it might already be an object
			return setting;
		}
		
		return settingObject;
	};
	
	
	this.getFormattedNameFromSetting = async function (setting) {
		if (!_formattedNames) {
			await _loadFormattedNames();
		}
		var format = this.unserializeSetting(setting);
		
		var name = _formattedNames[format.mode + "=" + format.id];
		return name ? name : '';
	};
	
	this.getSettingFromFormattedName = async function (name) {
		if (!_formattedNames) {
			await _loadFormattedNames();
		}
		for (var setting in _formattedNames) {
			if (_formattedNames[setting] == name) {
				return setting;
			}
		}
		return '';
	};
	
	this.getNoteFormat = function () {
		var pref = Zotero.Prefs.get('export.noteQuickCopy.setting');
		pref = JSON.stringify(this.unserializeSetting(pref));
		return pref;
	};
	
	this.getFormatFromURL = function (url) {
		var quickCopyPref = Zotero.Prefs.get("export.quickCopy.setting");
		quickCopyPref = JSON.stringify(this.unserializeSetting(quickCopyPref));
		
		if (!url) {
			return quickCopyPref;
		}
		
		var nsIURI;
		try {
			nsIURI = Services.io.newURI(url, null, null);
			// Accessing some properties may throw for URIs that do not support those
			// parts. E.g. hostPort throws NS_ERROR_FAILURE for about:blank
			var urlHostPort = nsIURI.hostPort;
			var urlPath = nsIURI.pathQueryRef;
		}
		catch (e) {}
		
		// Skip non-HTTP URLs
		if (!nsIURI || !/^https?$/.test(nsIURI.scheme)) {
			return quickCopyPref;
		}
		
		if (!_siteSettings) {
			Zotero.debug("Quick Copy site settings not loaded", 2);
			return quickCopyPref;
		}
		
		var matches = [];
		for (let i=0; i<_siteSettings.length; i++) {
			let row = _siteSettings[i];
			let domain = row.domainPath.split('/',1)[0];
			let path = row.domainPath.substr(domain.length) || '/';
			if (urlHostPort.endsWith(domain) && urlPath.startsWith(path)) {
				matches.push({
					format: JSON.stringify(this.unserializeSetting(row.format)),
					domainLength: domain.length,
					pathLength: path.length
				});
			}
		}
		
		// Give priority to longer domains, then longer paths
		var sort = function (a, b) {
			if (a.domainLength > b.domainLength) {
				return -1;
			}
			else if (a.domainLength < b.domainLength) {
				return 1;
			}
			
			if (a.pathLength > b.pathLength) {
				return -1;
			}
			else if (a.pathLength < b.pathLength) {
				return 1;
			}
			
			return -1;
		};
		
		if (matches.length) {
			matches.sort(sort);
			return matches[0].format;
		} else {
			return quickCopyPref;
		}
	};
	
	
	/*
	 * Get text and (when applicable) HTML content from items
	 *
	 * |items| is an array of Zotero.Item objects
	 *
	 * |format| may be a Quick Copy format string
	 * (e.g. "bibliography=http://www.zotero.org/styles/apa")
	 * or an Quick Copy format object
	 *
	 * |callback| is only necessary if using an export format and should be
	 * a function suitable for Zotero.Translate.setHandler, taking parameters
	 * |obj| and |worked|. The generated content should be placed in obj.string
	 * and |worked| should be true if the operation is successful.
	 *
	 * If bibliography format, the process is synchronous and an object
	 * contain properties 'text' and 'html' is returned.
	 */
	this.getContentFromItems = function (items, format, callback, modified) {
		if (items.length > Zotero.Prefs.get('export.quickCopy.dragLimit')) {
			Zotero.debug("Skipping quick copy for " + items.length + " items");
			return false;
		}
		
		format = this.unserializeSetting(format);
		
		if (format.mode == 'export') {
			var translation = new Zotero.Translate.Export;
			translation.noWait = true;	// needed not to break drags
			// Allow to reuse items array
			translation.setItems(items.slice());
			translation.setTranslator(format.id);
			if (format.options) {
				translation.setDisplayOptions(format.options);
			}
			translation.setHandler("done", callback);
			translation.translate();
			return true;
		}
		else if (format.mode == 'bibliography') {
			items = items.filter(item => !item.isNote());
			
			var locale = _getLocale(format);
			
			// Copy citations if shift key pressed
			if (modified) {
				var csl = Zotero.Styles.get(format.id).getCiteProc(locale);
				csl.updateItems(items.map(item => item.id));
				var citation = {
					citationItems: items.map(item => ({ id: item.id })),
					properties: {}
				};
				var html = csl.previewCitationCluster(citation, [], [], "html"); 
				var text = csl.previewCitationCluster(citation, [], [], "text");
				csl.free();
			} else {
				var style = Zotero.Styles.get(format.id);
				var cslEngine = style.getCiteProc(locale, 'html');
 				var html = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, items, "html");
 				cslEngine.free();
				cslEngine = style.getCiteProc(locale, 'text');
				var text = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, items, "text");
				cslEngine.free();
			}
			
			return {text:(format.contentType == "html" ? html : text), html:html};
		}
		
		throw ("Invalid mode '" + format.mode + "' in Zotero.QuickCopy.getContentFromItems()");
	};

	/**
	 * Generate a note item to pass to getContentFromItems() from an array of annotations
	 *
	 * @param {Zotero.Item[]|Object[]} annotations - An array of Zotero.Item annotations or JSON
	 *    annotations from Zotero.Annotations.toJSON()
	 * @return {Zotero.Item} - A note item with the annotations serialized as HTML
	 */
	this.annotationsToNote = function (annotations) {
		let jsonAnnotations = [];
		for (let annotation of annotations) {
			if (annotation instanceof Zotero.Item) {
				// Skip ink and image annotations because fetching them
				// requires awaiting Zotero.Annotations.toJSON()
				if (["ink", "image"].includes(annotation.type)) {
					continue;
				}
				let json = Zotero.Annotations.toJSONSync(annotation);
				json.attachmentItemID = annotation.parentItemID;
				jsonAnnotations.push(json);
			}
			else {
				jsonAnnotations.push(annotation);
			}
		}
		for (let annotation of jsonAnnotations) {
			if (annotation.image && !annotation.imageAttachmentKey) {
				annotation.imageAttachmentKey = 'none';
				delete annotation.image;
			}
		}
		let { html } = Zotero.EditorInstanceUtilities.serializeAnnotations(jsonAnnotations);
		let tmpNote = new Zotero.Item('note');
		tmpNote.libraryID = Zotero.Libraries.userLibraryID;
		tmpNote.setNote(html);
		return tmpNote;
	};
	
	/**
	 * If an export translator is the selected output format, load its code (which must be done
	 * asynchronously) ahead of time, since drag-and-drop requires synchronous operation
	 *
	 * @return {Promise}
	 */
	var _loadOutputFormat = async function () {
		var format = Zotero.Prefs.get("export.quickCopy.setting");
		return _preloadFormat(format);
	};
	
	
	var _loadNoteOutputFormat = async function () {
		var format = Zotero.Prefs.get("export.noteQuickCopy.setting");
		format = Zotero.QuickCopy.unserializeSetting(format);
		
		// Always preload Note Markdown and Note HTML translators. They're both needed for note
		// dragging if the format is "Markdown + Rich Text", HTML is needed for note dragging if
		// the format is "HTML", and they're both needed for copying or dragging from the note
		// editor, which uses `noWait`.
		await _preloadFormat({ mode: 'export', id: Zotero.Translators.TRANSLATOR_ID_NOTE_MARKDOWN });
		await _preloadFormat({ mode: 'export', id: Zotero.Translators.TRANSLATOR_ID_NOTE_HTML });
		
		// If there's another format, preload it for note item dragging
		if (format.id != Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT
				&& format.id != Zotero.Translators.TRANSLATOR_ID_NOTE_HTML) {
			await _preloadFormat(format);
		}
	};
	
	
	var _preloadFormat = async function (format) {
		format = Zotero.QuickCopy.unserializeSetting(format);
		if (format.mode == 'export') {
			Zotero.debug(`Preloading ${format.id} for Quick Copy`);
			await Zotero.Translators.init();
			let translator = Zotero.Translators.get(format.id);
			if (!translator) {
				Zotero.logError(`Translator ${format.id} not found`);
				return;
			}
			translator.cacheCode = true;
			await Zotero.Translators.getCodeForTranslator(translator);
		}
		else if (format.mode === 'bibliography') {
			let style = Zotero.Styles.get(format.id);
			let locale = _getLocale(format);
			// Cache CiteProc instances for HTML and text
			style.getCiteProc(locale, 'html');
			style.getCiteProc(locale, 'text');
		}
	};
	
	
	function _getLocale(format) {
		return format.locale || Zotero.Prefs.get('export.quickCopy.locale');
	}
	
	var _loadFormattedNames = async function () {
		var t = new Date;
		Zotero.debug("Loading formatted names for Quick Copy");
		
		var translation = new Zotero.Translate.Export;
		var translators = await translation.getTranslators();
		
		// add styles to list
		_formattedNames = {};
		var styles = Zotero.Styles.getVisible();
		for (let style of styles) {
			_formattedNames['bibliography=' + style.styleID] = style.title;
		}
		
		for (var i=0; i<translators.length; i++) {
			// Skip RDF formats
			switch (translators[i].translatorID) {
				case '6e372642-ed9d-4934-b5d1-c11ac758ebb7':
				case '14763d24-8ba0-45df-8f52-b8d1108e7ac9':
					continue;
			}
			_formattedNames['export=' + translators[i].translatorID] = translators[i].label;
		}
		
		Zotero.debug("Loaded formatted names for Quick Copy in " + (new Date - t) + " ms");
	};
}
