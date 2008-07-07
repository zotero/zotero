Zotero.QuickCopy = new function() {
	this.getFormattedNameFromSetting = getFormattedNameFromSetting;
	this.getSettingFromFormattedName = getSettingFromFormattedName;
	this.getContentType = getContentType;
	this.stripContentType = stripContentType;
	this.getFormatFromURL = getFormatFromURL;
	this.getContentFromItems = getContentFromItems;
	
	var _initialized = false;
	var _formattedNames = {};
	
	
	function getFormattedNameFromSetting(setting) {
		if (!_initialized) {
			_init();
		}
		
		var name = _formattedNames[this.stripContentType(setting)];
		return name ? name : '';
	}
	
	function getSettingFromFormattedName(name) {
		if (!_initialized) {
			_init();
		}
		
		for (var setting in _formattedNames) {
			if (_formattedNames[setting] == name) {
				return setting;
			}
		}
		
		return '';
	}
	
	
	/*
	 * Returns the setting with any contentType stripped from the mode part
	 */
	function getContentType(setting) {
		var matches = setting.match(/(?:bibliography|export)\/([^=]+)=.+$/, '$1');
		return matches ? matches[1] : '';
	}
	
	
	/*
	 * Returns the setting with any contentType stripped from the mode part
	 */
	function stripContentType(setting) {
		return setting.replace(/(bibliography|export)(?:\/[^=]+)?=(.+)$/, '$1=$2');
	}
	
	
	function getFormatFromURL(url) {
		if (!url) {
			return Zotero.Prefs.get("export.quickCopy.setting");
		}
		
		var ioService = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
		var nsIURI = ioService.newURI(url, null, null);
		
		try {
			var urlHostPort = nsIURI.hostPort;
			var urlPath = nsIURI.path;
		}
		catch (e) {
			return Zotero.Prefs.get("export.quickCopy.setting");
		}
		
		var matches = [];
		
		var sql = "SELECT key AS domainPath, value AS format FROM settings "
			+ "WHERE setting='quickCopySite' AND (key LIKE ? OR key LIKE ?)";
		var urlDomain = urlHostPort.match(/[^\.]+\.[^\.]+$/);
		var rows = Zotero.DB.query(sql, ['%' + urlDomain + '%', '/%']);
		for each(var row in rows) {
			var [domain, path] = row.domainPath.split(/\//);
			path = '/' + (path ? path : '');
			var re = new RegExp(domain + '$');
			if (urlHostPort.match(re) && urlPath.indexOf(path) == 0) {
				matches.push({
					format: row.format,
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
		}
		
		if (matches.length) {
			matches.sort(sort);
			return matches[0].format;
		}
		
		return Zotero.Prefs.get("export.quickCopy.setting");
	}
	
	
	/*
	 * Get text and (when applicable) HTML content from items
	 *
	 * |items| is an array of Zotero.Item objects
	 *
	 * |format| is a Quick Copy format string
	 *    (e.g. "bibliography=http://purl.org/net/xbiblio/csl/styles/apa.csl")
	 *
	 * |callback| is only necessary if using an export format and should be
	 * a function suitable for Zotero.Translate.setHandler, taking parameters
	 * |obj| and |worked|. The generated content should be placed in obj.output
	 * and |worked| should be true if the operation is successful.
	 *
	 * If bibliography format, the process is synchronous and an object
	 * contain properties 'text' and 'html' is returned.
	 */
	function getContentFromItems(items, format, callback, modified) {
		var [mode, format] = format.split('=');
		var [mode, contentType] = mode.split('/');
		
		if (mode == 'export') {
			var translation = new Zotero.Translate("export");
			translation.setItems(items);
			translation.setTranslator(format);
			translation.setHandler("done", callback);
			translation.translate();
			return true;
		}
		else if (mode == 'bibliography') {
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
				var content = [];
				for (var i=0; i<notes.length; i++) {
					content.push(notes[i].getNote());
				}
				
				default xml namespace = '';
				var html = <div/>;
				for (var i=0; i<content.length; i++) {
					var p = <p>{content[i]}</p>;
					p.@style = 'white-space: pre-wrap';
					html.p += p;
				}
				
				html = html.toXMLString();
				
				// Don't copy HTML, since we don't have rich-text notes and
				// copying HTML on Windows just loses newlines (due to
				// unsupported white-space: pre-wrap in Word and OO).
				/*
				var content = {
					text: contentType == "html" ? html : content.join('\n\n\n'),
					html: html
				};
				*/
				var content = {
					text: contentType == "html" ? html : content.join('\n\n\n')
				};
				
				return content;
			}
			
			var csl = Zotero.Cite.getStyle(format);
			var itemSet = csl.createItemSet(items);
			
			// Copy citations if shift key pressed
			if (modified) {
				var itemIDs = [];
				for (var i=0; i<items.length; i++) {
					itemIDs.push(items[i].id);
				}
				var citation = csl.createCitation(itemSet.getItemsByIds(itemIDs));
				var bibliography = {
					text: csl.formatCitation(citation, contentType == "html" ? 'HTML' : 'Text'),
					html: csl.formatCitation(citation, "HTML")
				}
			}
			else {
				var bibliography = {
					text: csl.formatBibliography(itemSet, contentType == "html" ? "HTML" : "Text"),
					html: csl.formatBibliography(itemSet, "HTML")
				};
			}
			return bibliography;
		}
		
		throw ("Invalid mode '" + mode + "' in Zotero.QuickCopy.getContentFromItems()");
	}
	
	
	function _init() {
		var translation = new Zotero.Translate("export");
		var translators = translation.getTranslators();
		
		// add styles to list
		var styles = Zotero.Cite.getStyles();
		for (var i in styles) {
			_formattedNames['bibliography=' + i] = styles[i];
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
	}
}
