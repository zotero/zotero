Zotero.QuickCopy = new function() {
	this.getFormattedNameFromSetting = getFormattedNameFromSetting;
	this.getSettingFromFormattedName = getSettingFromFormattedName;
	this.getFormatFromURL = getFormatFromURL;
	this.getContentFromItems = getContentFromItems;
	
	var _initialized = false;
	var _formattedNames = {};
	
	
	function getFormattedNameFromSetting(setting) {
		if (!_initialized) {
			_init();
		}
		
		return _formattedNames[setting];
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
			return;
		}
		
		var matches = [];
		
		var sql = "SELECT key AS domainPath, value AS format FROM settings "
			+ "WHERE setting='quickCopySite' AND key LIKE ?";
		var urlDomain = urlHostPort.match(/[^\.]+\.[^\.]+$/);
		var rows = Zotero.DB.query(sql, ['%' + urlDomain + '%']);
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
	function getContentFromItems(items, format, callback) {
		var [mode, format] = format.split('=');
		
		if (mode == 'export') {
			var translation = new Zotero.Translate("export");
			Zotero.debug(items);
			translation.setItems(items);
			translation.setTranslator(format);
			translation.setHandler("done", callback);
			translation.translate();
			return true;
		}
		else if (mode == 'bibliography') {
			var csl = Zotero.Cite.getStyle(format);
			var itemSet = csl.createItemSet(items);
			var bibliography = {
				text: csl.formatBibliography(itemSet, "Text"),
				html: csl.formatBibliography(itemSet, "HTML")
			};
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
