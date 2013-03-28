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
	 * |obj| and |worked|. The generated content should be placed in obj.string
	 * and |worked| should be true if the operation is successful.
	 *
	 * If bibliography format, the process is synchronous and an object
	 * contain properties 'text' and 'html' is returned.
	 */
	function getContentFromItems(items, format, callback, modified) {
		if (items.length > Zotero.Prefs.get('export.quickCopy.dragLimit')) {
			Zotero.debug("Skipping quick copy for " + items.length + " items");
			return false;
		}
		
		var [mode, format] = format.split('=');
		var [mode, contentType] = mode.split('/');
		
		if (mode == 'export') {
			var translation = new Zotero.Translate.Export;
			translation.noWait = true;	// needed not to break drags
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
					Zotero.debug("PADDING LEFT "+paddingLeft);
					if(paddingLeft && paddingLeft.substr(paddingLeft.length-2) === "px") {
						var paddingPx = parseInt(paddingLeft, 10),
							ztabs = "";
						for(var i=30; i<=paddingPx; i+=30) ztabs += ZTAB;
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
					text: contentType == "html" ? html : text,
					html: copyHTML
				};
				
				return content;
			}
			
			// Copy citations if shift key pressed
			if (modified) {
				var csl = Zotero.Styles.get(format).getCiteProc();
				csl.updateItems([item.id for each(item in items)]);
				var citation = {citationItems:[{id:item.id} for each(item in items)], properties:{}};
				var html = csl.previewCitationCluster(citation, [], [], "html"); 
				var text = csl.previewCitationCluster(citation, [], [], "text"); 
			} else {
				var style = Zotero.Styles.get(format);
				var html = Zotero.Cite.makeFormattedBibliographyOrCitationList(style, items, "html");
				var text = Zotero.Cite.makeFormattedBibliographyOrCitationList(style, items, "text");
			}
			
			return {text:(contentType == "html" ? html : text), html:html};
		}
		
		throw ("Invalid mode '" + mode + "' in Zotero.QuickCopy.getContentFromItems()");
	}
	
	
	function _init() {
		var translation = new Zotero.Translate.Export;
		var translators = translation.getTranslators();
		
		// add styles to list
		var styles = Zotero.Styles.getVisible();
		for each(var style in styles) {
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
	}
}
