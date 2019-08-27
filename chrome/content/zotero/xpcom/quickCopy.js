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

Zotero.QuickCopy = new function() {
	this.lastActiveURL = null;
	
	var _initTimeoutID
	var _initPromise;
	var _initialized = false;
	var _initCancelled = false;
	var _siteSettings;
	var _formattedNames;
	
	this.init = Zotero.Promise.coroutine(function* () {
		Zotero.debug("Initializing Quick Copy");
		
		if (!_initialized) {
			// Make sure export translator code is loaded whenever the output format changes
			this._prefObserverID = Zotero.Prefs.registerObserver(
				"export.quickCopy.setting", _loadOutputFormat
			);
			_initialized = true;
		}
		
		// Load code for selected export translators ahead of time
		// (in the background, because it requires translator initialization)
		Zotero.Schema.schemaUpdatePromise
		.then(function () {
			if (_initCancelled) return;
			
			// Avoid random translator initialization during tests, which can result in timeouts,
			// if an export format is selected
			if (Zotero.test) return;
			
			_initPromise = Zotero.Promise.each(
				[
					() => _loadOutputFormat(),
					() => this.loadSiteSettings()
				],
				f => f()
			);
		}.bind(this));
	});
	
	
	this.uninit = function () {
		_initCancelled = true;
		// Cancel load if in progress
		if (_initPromise) {
			_initPromise.cancel();
		}
		Zotero.Prefs.unregisterObserver(this._prefObserverID);
	};
	
	
	this.loadSiteSettings = Zotero.Promise.coroutine(function* () {
		var sql = "SELECT key AS domainPath, value AS format FROM settings "
			+ "WHERE setting='quickCopySite'";
		var rows = yield Zotero.DB.queryAsync(sql);
		// Unproxify storage row
		_siteSettings = rows.map(row => {
			return {
				domainPath: row.domainPath,
				format: row.format 
			};
		});
		yield Zotero.Promise.map(rows, row => _preloadFormat(row.format));
	});
	
	
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
	
	
	this.getFormattedNameFromSetting = Zotero.Promise.coroutine(function* (setting) {
		if (!_formattedNames) {
			yield _loadFormattedNames();
		}
		var format = this.unserializeSetting(setting);
		
		var name = _formattedNames[format.mode + "=" + format.id];
		return name ? name : '';
	});
	
	this.getSettingFromFormattedName = Zotero.Promise.coroutine(function* (name) {
		if (!_formattedNames) {
			yield _loadFormattedNames();
		}
		for (var setting in _formattedNames) {
			if (_formattedNames[setting] == name) {
				return setting;
			}
		}
		return '';
	});
	
	
	this.getFormatFromURL = function(url) {
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
		var sort = function(a, b) {
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
			translation.setItems(items);
			translation.setTranslator(format.id);
			translation.setHandler("done", callback);
			translation.translate();
			return true;
		}
		else if (format.mode == 'bibliography') {
			// Move notes to separate array
			var allNotes = true;
			var notes = [];
			for (var i=0; i<items.length; i++) {
				if (items[i].isNote()) {
					notes.push(items.splice(i, 1)[0]);
					i--;
				}
				else {
					allNotes = false;
				}
			}
			
			// If all notes, export full content
			if (allNotes) {
				var content = [],
					parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
						.createInstance(Components.interfaces.nsIDOMParser),
					doc = parser.parseFromString('<div class="zotero-notes"/>', 'text/html'),
					textDoc = parser.parseFromString('<div class="zotero-notes"/>', 'text/html'),
					container = doc.documentElement,
					textContainer = textDoc.documentElement;
				for (var i=0; i<notes.length; i++) {
					var div = doc.createElement("div");
					div.className = "zotero-note";
					// AMO reviewer: This documented is never rendered (and the inserted markup
					// is sanitized anyway)
					div.insertAdjacentHTML('afterbegin', notes[i].getNote());
					container.appendChild(div);
					textContainer.appendChild(textDoc.importNode(div, true));
				}
				
				// Raw HTML output
				var html = container.outerHTML;
				
				// Add placeholders for newlines between notes
				if (notes.length > 1) {
					var divs = Zotero.Utilities.xpath(container, "div"),
						textDivs = Zotero.Utilities.xpath(textContainer, "div");
					for (var i=1, len=divs.length; i<len; i++) {
						var p = doc.createElement("p");
						p.appendChild(doc.createTextNode("--------------------------------------------------"));
						container.insertBefore(p, divs[i]);
						textContainer.insertBefore(textDoc.importNode(p, true), textDivs[i]);
					}
				}
				
				const BLOCKQUOTE_PREFS = {
					'export.quickCopy.quoteBlockquotes.richText':doc,
					'export.quickCopy.quoteBlockquotes.plainText':textDoc
				};
				for(var pref in BLOCKQUOTE_PREFS) {
					if (Zotero.Prefs.get(pref)) {
						var currentDoc = BLOCKQUOTE_PREFS[pref];
						// Add quotes around blockquote paragraphs
						var addOpenQuote = Zotero.Utilities.xpath(currentDoc, "//blockquote/p[1]"),
							addCloseQuote = Zotero.Utilities.xpath(currentDoc, "//blockquote/p[last()]");
						for(var i=0; i<addOpenQuote.length; i++) {
							addOpenQuote[i].insertBefore(currentDoc.createTextNode("\u201c"),
								addOpenQuote[i].firstChild);
						}
						for(var i=0; i<addCloseQuote.length; i++) {
							addCloseQuote[i].appendChild(currentDoc.createTextNode("\u201d"));
						}
					}
				}
				
				//
				// Text-only adjustments
				//
				
				// Replace span styles with characters
				var spans = textDoc.getElementsByTagName("span");
				for(var i=0; i<spans.length; i++) {
					var span = spans[i];
					if(span.style.textDecoration == "underline") {
						span.insertBefore(textDoc.createTextNode("_"), span.firstChild);
						span.appendChild(textDoc.createTextNode("_"));
					}
				}
				
				//
				// And add spaces for indents
				//
				// Placeholder for 4 spaces in final output
				const ZTAB = "%%ZOTEROTAB%%";
				var ps = textDoc.getElementsByTagName("p");
				for(var i=0; i<ps.length; i++) {
					var p = ps[i],
						paddingLeft = p.style.paddingLeft;
					if(paddingLeft && paddingLeft.substr(paddingLeft.length-2) === "px") {
						var paddingPx = parseInt(paddingLeft, 10),
							ztabs = "";
						for (let j = 30; j <= paddingPx; j += 30) ztabs += ZTAB;
						p.insertBefore(textDoc.createTextNode(ztabs), p.firstChild);
					}
				}
				
				// Use plaintext serializer to output formatted text
				var docEncoder = Components.classes["@mozilla.org/layout/documentEncoder;1?type=text/html"]
					.createInstance(Components.interfaces.nsIDocumentEncoder);
				docEncoder.init(textDoc, "text/plain", docEncoder.OutputFormatted);
				var text = docEncoder.encodeToString().trim().replace(ZTAB, "    ", "g");
				
				//
				// Adjustments for the HTML copied to the clipboard
				//
				
				// Everything seems to like margin-left better than padding-left
				var ps = Zotero.Utilities.xpath(doc, "p");
				for(var i=0; i<ps.length; i++) {
					var p = ps[i];
					if(p.style.paddingLeft) {
						p.style.marginLeft = p.style.paddingLeft;
						p.style.paddingLeft = "";
					}
				}
				
				// Word and TextEdit don't indent blockquotes on their own and need this
				//
				// OO gets it right, so this results in an extra indent
				if (Zotero.Prefs.get('export.quickCopy.compatibility.indentBlockquotes')) {
					var ps = Zotero.Utilities.xpath(doc, "//blockquote/p");
					for(var i=0; i<ps.length; i++) ps[i].style.marginLeft = "30px";
				}
				
				// Add Word Normal style to paragraphs and add double-spacing
				//
				// OO inserts the conditional style code as a document comment
				if (Zotero.Prefs.get('export.quickCopy.compatibility.word')) {
					var ps = doc.getElementsByTagName("p");
					for (var i=0; i<ps.length; i++) ps[i].className = "msoNormal";
					var copyHTML = "<!--[if gte mso 0]>"
									+ "<style>"
									+ "p { margin-top:.1pt;margin-right:0in;margin-bottom:.1pt;margin-left:0in; line-height: 200%; }"
									+ "li { margin-top:.1pt;margin-right:0in;margin-bottom:.1pt;margin-left:0in; line-height: 200%; }"
									+ "blockquote p { margin-left: 11px; margin-right: 11px }"
									+ "</style>"
									+ "<![endif]-->\n"
									+ container.outerHTML;
				}
				else {
					var copyHTML = container.outerHTML;
				}
				
				var content = {
					text: format.contentType == "html" ? html : text,
					html: copyHTML
				};
				
				return content;
			}
			
			// determine locale preference
			var locale = format.locale ? format.locale : Zotero.Prefs.get('export.quickCopy.locale');
			
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
			} else {
				var style = Zotero.Styles.get(format.id);
				var cslEngine = style.getCiteProc(locale);
 				var html = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, items, "html");
				cslEngine = style.getCiteProc(locale);
				var text = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, items, "text");
			}
			
			return {text:(format.contentType == "html" ? html : text), html:html};
		}
		
		throw ("Invalid mode '" + format.mode + "' in Zotero.QuickCopy.getContentFromItems()");
	};
	
	
	/**
	 * If an export translator is the selected output format, load its code (which must be done
	 * asynchronously) ahead of time, since drag-and-drop requires synchronous operation
	 *
	 * @return {Promise}
	 */
	var _loadOutputFormat = Zotero.Promise.coroutine(function* () {
		var format = Zotero.Prefs.get("export.quickCopy.setting");
		return _preloadFormat(format);
	});
	
	
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
			await translator.getCode();
		}
	};
	
	
	var _loadFormattedNames = Zotero.Promise.coroutine(function* () {
		var t = new Date;
		Zotero.debug("Loading formatted names for Quick Copy");
		
		var translation = new Zotero.Translate.Export;
		var translators = yield translation.getTranslators();
		
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
	});
}
