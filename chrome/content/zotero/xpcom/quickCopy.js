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
		this._prefObserverIDs = [
			Zotero.Prefs.registerObserver(
				"export.quickCopy.bibliographySetting", _loadOutputFormat
			),
			Zotero.Prefs.registerObserver(
				"export.quickCopy.exportSetting", _loadOutputFormat
			),
			Zotero.Prefs.registerObserver(
				"export.noteQuickCopy.setting", _loadNoteOutputFormat
			),
		];
		
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
		this._prefObserverIDs.forEach(id => Zotero.Prefs.unregisterObserver(id));
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
		// Preload every translator/style referenced by a site-specific entry
		// so drag-drop has them available synchronously
		for (let row of _siteSettings) {
			let site = this.parseSiteFormat(row.format);
			if (site.bibliography) {
				await _preloadFormat(site.bibliography);
			}
			if (site.export) {
				await _preloadFormat(site.export);
			}
		}
	};
	
	
	this.hasSiteSettings = function () {
		return _siteSettings && _siteSettings.length > 0;
	};
	

	/**
	 * Parse a site-specific Quick Copy setting from the DB into a normalized
	 * shape. Supports both the legacy single-mode format and the new shape;
	 * always returns:
	 *
	 *   {
	 *       bibliography?: { mode: 'bibliography', id, contentType, locale },
	 *       export?:       { mode: 'export', id },
	 *       drag?:         'bibliography' | 'export'
	 *   }
	 * @param {String|Object} raw - DB row.format value
	 * @return {Object} - Normalized site setting
	 */
	this.parseSiteFormat = function (raw) {
		var parsed = this.unserializeSetting(raw);
		if (!parsed || typeof parsed !== 'object') {
			return {};
		}
		// Legacy single-mode shape (top-level `mode` field)
		if (parsed.mode === 'bibliography') {
			return {
				bibliography: {
					mode: 'bibliography',
					id: parsed.id,
					contentType: parsed.contentType || '',
					locale: parsed.locale || ''
				},
				drag: 'bibliography'
			};
		}
		if (parsed.mode === 'export') {
			return {
				export: { mode: 'export', id: parsed.id },
				drag: 'export'
			};
		}
		// Ensure each sub-object is a complete single-mode setting
		var out = {};
		if (parsed.bibliography) {
			out.bibliography = {
				mode: 'bibliography',
				id: parsed.bibliography.id,
				contentType: parsed.bibliography.contentType || '',
				locale: parsed.bibliography.locale || ''
			};
		}
		if (parsed.export) {
			out.export = { mode: 'export', id: parsed.export.id };
		}
		if (parsed.drag) {
			out.drag = parsed.drag;
		}
		return out;
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
				// Try parsing as formatted string. contentType and locale are
				// only meaningful for bibliography mode.
				var parsedSetting = setting.match(/(bibliography|export)(?:\/([^=]+))?=(.+)$/);
				if (parsedSetting) {
					settingObject.mode = parsedSetting[1];
					if (parsedSetting[1] === 'bibliography') {
						settingObject.contentType = parsedSetting[2] || '';
					}
					settingObject.id = parsedSetting[3];
					if (parsedSetting[1] === 'bibliography') {
						settingObject.locale = '';
					}
				}
			}
		} else {
			// Return input if not a string; it might already be an object
			return setting;
		}

		// Ensure bibliography mode always has contentType and locale fields
		if (settingObject.mode === 'bibliography') {
			if (settingObject.contentType === undefined) settingObject.contentType = '';
			if (settingObject.locale === undefined) settingObject.locale = '';
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

	this.getLocale = function () {
		return this.unserializeSetting(
			Zotero.Prefs.get('export.quickCopy.bibliographySetting')
		).locale;
	};


	/**
	 * Find the best-matching site setting row for the given URL (longest domain,
	 * then longest path). Returns the raw DB row.format string, or null.
	 */
	var _findSiteFormatForURL = function (url) {
		if (!url) return null;

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
			return null;
		}

		if (!_siteSettings) {
			Zotero.debug("Quick Copy site settings not loaded", 2);
			return null;
		}

		var matches = [];
		for (let i = 0; i < _siteSettings.length; i++) {
			let row = _siteSettings[i];
			let domain = row.domainPath.split('/', 1)[0];
			let path = row.domainPath.substr(domain.length) || '/';
			if (urlHostPort.endsWith(domain) && urlPath.startsWith(path)) {
				matches.push({
					format: row.format,
					domainLength: domain.length,
					pathLength: path.length
				});
			}
		}

		if (!matches.length) return null;

		// Give priority to longer domains, then longer paths
		matches.sort(function (a, b) {
			if (a.domainLength > b.domainLength) return -1;
			if (a.domainLength < b.domainLength) return 1;
			if (a.pathLength > b.pathLength) return -1;
			if (a.pathLength < b.pathLength) return 1;
			return -1;
		});
		return matches[0].format;
	};


	/**
	 * Get the Quick Copy format for the currently active URL.
	 * When `items` is a selection composed entirely of notes/annotations,
	 * return the user's note-format pref.
	 *
	 * @param {Object} [options]
	 * @param {String} [options.mode] - 'bibliography' or 'export'; omit for drag-drop
	 * @param {Zotero.Item[]} [options.items] - Items the format will be applied to
	 * @return {Object} - `{mode, id, contentType, locale}` for bibliography; `{mode, id, ...}` for export
	 */
	this.getFormat = function ({ mode, items } = {}) {
		// Note-only selections always use the note format
		if (items && items.length && items.every(item => item.isNote() || item.isAnnotation())) {
			return this.unserializeSetting(Zotero.Prefs.get('export.noteQuickCopy.setting'));
		}

		var siteRaw = _findSiteFormatForURL(this.lastActiveURL);
		var site = siteRaw ? this.parseSiteFormat(siteRaw) : null;

		// If no mode was requested (drag-drop), pick one from the site's
		// `drag` pref or fall back to the user's preferredFormatOnDrag pref
		if (!mode) {
			if (site?.drag) {
				mode = site.drag;
			}
			else {
				mode = Zotero.Prefs.get('export.quickCopy.preferredFormatOnDrag');
			}
		}

		// Site override for that mode wins, else fall back to global
		if (site && site[mode] && site[mode].id) {
			return site[mode];
		}
		var globalFormat = mode === 'export'
			? Zotero.Prefs.get('export.quickCopy.exportSetting')
			: Zotero.Prefs.get('export.quickCopy.bibliographySetting');
		return this.unserializeSetting(globalFormat);
	};
	
	
	/**
	 * Produce QuickCopy content from items. Single entry point for clipboard
	 * copy, drag-and-drop, and the Bibliography dialog. Item-type prep is
	 * handled here: annotations are wrapped via annotationsToNote, notes are
	 * passed through reformatNoteCitations, and bibliography mode is filtered
	 * to regular items. Always returns { text, html },
	 * unless export translator provides no html format.
	 *
	 * @param {Zotero.Item[]} items
	 * @param {String|Object} format
	 * @param {Object} [options]
	 * @param {Boolean} [options.asCitations=false] - Bibliography only: in-text citation cluster
	 * @return {{text: String, html?: String} | null}
	 */
	this.getContentFromItems = function (items, format, options = {}) {
		if (!items.length) return null;
		
		format = this.unserializeSetting(format);

		// Format-appropriate item transformations:
		//   annotations → wrap into a temp note,
		//   notes → reformat embedded citations in the current bib style,
		//   bibliography mode → keep only regular items.
		if (items.every(item => item.isAnnotation())) {
			items = [this.annotationsToNote(items)];
		}
		if (items.every(item => item.isNote())) {
			items = this.reformatNoteCitations(items);
		}
		if (format.mode === 'bibliography') {
			items = items.filter(item => item.isRegularItem());
		}
		if (!items.length) return null;

		if (format.mode === 'export') {
			// Markdown+RichText virtual translator: produces both flavors,
			// using its `markdownOptions` and `htmlOptions` independently.
			if (format.id === Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT) {
				let text = _runExportTranslator(items, {
					mode: 'export',
					id: Zotero.Translators.TRANSLATOR_ID_NOTE_MARKDOWN,
					options: format.markdownOptions
				});
				let html = _runExportTranslator(items, {
					mode: 'export',
					id: Zotero.Translators.TRANSLATOR_ID_NOTE_HTML,
					options: format.htmlOptions
				});
				if (text === null || html === null) return null;
				return {
					text: text.replace(/\r\n/g, '\n'),
					html: html.replace(/\r\n/g, '\n')
				};
			}

			// Note HTML: HTML output, exposed on both flavors so rich-text
			// targets get the formatting and plain editors get the source.
			if (format.id === Zotero.Translators.TRANSLATOR_ID_NOTE_HTML) {
				let output = _runExportTranslator(items, format);
				if (output === null) return null;
				output = output.replace(/\r\n/g, '\n');
				let parser = new DOMParser();
				let doc = parser.parseFromString(output, 'text/html');
				output = doc.body.innerHTML;
				return { text: output, html: output };
			}

			// Other export translators (e.g. BibTeX): single-flavor output.
			let output = _runExportTranslator(items, format);
			if (output === null) return null;
			return { text: output.replace(/\r\n/g, '\n') };
		}

		if (format.mode === 'bibliography') {
			let locale = format.locale || this.getLocale();
			let style = Zotero.Styles.get(format.id);
			if (!style) return null;

			// Bibliography mode always produces both flavors: plain text for
			// `text/plain`, HTML for `text/html`. "Copy as HTML" (contentType
			// === 'html') sends the HTML version to `text/plain` as well, so
			// plain editors paste HTML source.
			let html, text;
			if (options.asCitations) {
				let csl = style.getCiteProc(locale, 'html', { cache: true });
				csl.updateItems(items.map(item => item.id));
				let citation = {
					citationItems: items.map(item => ({ id: item.id })),
					properties: {}
				};
				html = csl.previewCitationCluster(citation, [], [], 'html');
				text = csl.previewCitationCluster(citation, [], [], 'text');
				csl.free();
			}
			else {
				let cslEngine = style.getCiteProc(locale, 'html', { cache: true });
				html = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, items, 'html');
				cslEngine.free();
				cslEngine = style.getCiteProc(locale, 'text', { cache: true });
				text = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, items, 'text');
				cslEngine.free();
			}

			return {
				text: format.contentType === 'html' ? html : text,
				html
			};
		}

		throw new Error(`Invalid Quick Copy mode '${format.mode}'`);
	};


	/**
	 * Run an export translator synchronously (relies on noWait + preloaded
	 * translator code) and return its string output, or null on failure.
	 */
	function _runExportTranslator(items, format) {
		let result = null;
		let translation = new Zotero.Translate.Export();
		translation.noWait = true;
		translation.setItems(items.slice());
		translation.setTranslator(format.id);
		if (format.options) {
			translation.setDisplayOptions(format.options);
		}
		translation.setHandler("done", (obj, worked) => {
			if (worked) {
				result = obj.string;
			}
		});
		translation.translate();
		return result;
	}

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
	 * Reformat citation spans in note items using the QuickCopy CSL style
	 *
	 * Parses citation data from each <span class="citation"> in the note HTML,
	 * resolves item URIs, and reformats using the CSL engine. Returns new temporary
	 * note items with updated HTML -- the originals are not modified.
	 *
	 * @param {Zotero.Item[]} items - Note items to process
	 * @return {Zotero.Item[]} - New note items with CSL-formatted citations
	 */
	this.reformatNoteCitations = function (items) {
		if (!items.every(item => item.isNote())) {
			return items;
		}

		// Use getFormat() so site-specific bibliography overrides apply when
		// the user is on a URL with a configured site setting
		let format = this.getFormat({ mode: 'bibliography' });
		if (format.mode !== 'bibliography' || !format.id) {
			return items;
		}

		let style = Zotero.Styles.get(format.id);
		if (!style) {
			return items;
		}

		let locale = format.locale || this.getLocale();
		let cslEngine;
		try {
			cslEngine = style.getCiteProc(locale, 'html', { cache: true });
		}
		catch (e) {
			Zotero.logError('Failed to initialize CSL engine for note citation reformatting: ' + e);
			return items;
		}

		try {
			// First pass: collect all unique item IDs across all notes,
			// and build a fallback map of embedded CSL JSON for deleted items
			let allItemIDs = new Set();
			let embeddedCSLByFakeID = {};
			let parsedNotes = [];

			for (let item of items) {
				if (!item.isNote()) {
					parsedNotes.push(null);
					continue;
				}

				let noteHTML = item.getNote();
				if (!noteHTML) {
					parsedNotes.push(null);
					continue;
				}

				let parser = new DOMParser();
				let doc = parser.parseFromString(noteHTML, 'text/html');
				let citationSpans = doc.querySelectorAll('span.citation[data-citation]');

				if (!citationSpans.length) {
					parsedNotes.push(null);
					continue;
				}

				// Parse embedded citation item data from the note wrapper
				// for fallback when items have been deleted
				let embeddedItemDataByURI = {};
				let containerNode = doc.querySelector('div[data-citation-items]');
				if (containerNode) {
					try {
						let storedItems = JSON.parse(decodeURIComponent(
							containerNode.getAttribute('data-citation-items')
						));
						if (Array.isArray(storedItems)) {
							for (let si of storedItems) {
								if (si.uris && si.itemData) {
									for (let uri of si.uris) {
										embeddedItemDataByURI[uri] = si.itemData;
									}
								}
							}
						}
					}
					catch (e) {
						// Ignore parse errors
					}
				}

				let spanData = [];
				for (let span of citationSpans) {
					let citation;
					try {
						citation = JSON.parse(decodeURIComponent(span.getAttribute('data-citation')));
					}
					catch (e) {
						spanData.push(null);
						continue;
					}

					if (!citation || !citation.citationItems || !citation.citationItems.length) {
						spanData.push(null);
						continue;
					}

					let cslItems = [];
					for (let ci of citation.citationItems) {
						if (!ci.uris || !ci.uris.length) continue;
						let uri = ci.uris[0];
						let itemID = Zotero.URI.getURIItemID(uri);

						if (!itemID) {
							// Item deleted -- use embedded CSL JSON if available
							let embeddedData = embeddedItemDataByURI[uri];
							if (!embeddedData) continue;

							let fakeID = Zotero.Utilities.randomString();
							let cslData = Zotero.Utilities.deepCopy(embeddedData);
							cslData.id = fakeID;
							embeddedCSLByFakeID[fakeID] = cslData;
							itemID = fakeID;
						}

						allItemIDs.add(itemID);
						let cslItem = { id: itemID };
						if (ci.locator) {
							cslItem.locator = ci.locator;
							cslItem.label = ci.label || 'page';
						}
						if (ci.prefix) {
							cslItem.prefix = ci.prefix;
						}
						if (ci.suffix) {
							cslItem.suffix = ci.suffix;
						}
						cslItems.push(cslItem);
					}

					spanData.push(cslItems.length ? { span, cslItems } : null);
				}

				parsedNotes.push({ doc, spanData });
			}

			if (!allItemIDs.size) {
				cslEngine.free();
				return items;
			}

			// If we have embedded items for deleted citations, temporarily
			// patch retrieveItem so citeproc can resolve fake IDs
			let originalRetrieveItem;
			if (Object.keys(embeddedCSLByFakeID).length) {
				originalRetrieveItem = cslEngine.sys.retrieveItem;
				cslEngine.sys.retrieveItem = function (id) {
					if (embeddedCSLByFakeID[id]) {
						return embeddedCSLByFakeID[id];
					}
					return originalRetrieveItem.call(this, id);
				};
			}

			cslEngine.updateItems([...allItemIDs]);

			// Second pass: format citations and build new note items
			let result = [];
			for (let i = 0; i < items.length; i++) {
				let parsed = parsedNotes[i];
				if (!parsed) {
					result.push(items[i]);
					continue;
				}

				for (let data of parsed.spanData) {
					if (!data) continue;
					let citation = {
						citationItems: data.cslItems,
						properties: {}
					};
					let formatted = cslEngine.previewCitationCluster(citation, [], [], 'html');
					data.span.innerHTML = '(' + formatted + ')';
				}

				let tmpNote = new Zotero.Item('note');
				tmpNote.libraryID = items[i].libraryID;
				tmpNote.setNote(parsed.doc.body.innerHTML);
				result.push(tmpNote);
			}

			// Restore original retrieveItem if patched
			if (originalRetrieveItem) {
				cslEngine.sys.retrieveItem = originalRetrieveItem;
			}
			cslEngine.free();
			return result;
		}
		catch (e) {
			Zotero.logError('Failed to reformat note citations: ' + e);
			if (cslEngine) {
				cslEngine.free();
			}
			return items;
		}
	};

	/**
	 * Preload the global default bibliography and export translators/styles so
	 * drag-and-drop has them available synchronously. Site-specific formats
	 * are preloaded by loadSiteSettings().
	 *
	 * @return {Promise}
	 */
	var _loadOutputFormat = async function () {
		await _preloadFormat(Zotero.Prefs.get('export.quickCopy.bibliographySetting'));
		await _preloadFormat(Zotero.Prefs.get('export.quickCopy.exportSetting'));
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
			let locale = format.locale || Zotero.QuickCopy.getLocale();
			// Cache a single CiteProc instance (format-independent)
			style.getCiteProc(locale, 'html', { cache: true });
		}
	};
	
	
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
