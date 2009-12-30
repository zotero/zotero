/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
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
	 * |obj| and |worked|. The generated content should be placed in obj.output
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
				default xml namespace = '';
				XML.prettyPrinting = false;
				XML.ignoreWhitespace = false;
				var htmlXML = <div class="zotero-notes"/>;
				for (var i=0; i<notes.length; i++) {
					var noteContent = notes[i].getNote();
					try {
						var noteDiv = new XML('<div class="zotero-note">' + noteContent + '</div>');
					}
					catch (e) {
						Zotero.debug(e);
						Zotero.debug("Couldn't parse note as HTML -- try as CDATA", 2);
						try {
							var noteDiv = new XML('<div class="zotero-note"><pre><![CDATA[' + noteContent + ']]></pre></div>');
						}
						catch (e) {
							Zotero.debug("Skipping note", 2);
							continue;
						}
					}
					
					htmlXML.div += noteDiv;
				}
				
				// Raw HTML output
				var html = htmlXML.toXMLString();
				
				var textXML = htmlXML.copy();
				
				//
				// Text-only adjustments
				//
				
				// Add placeholders for newlines between notes
				if (notes.length > 1) {
					var divs = textXML.div;
					for (var i=0, len=divs.length(); i<len-1; i++) {
						divs[i].p += <p>--------------------------------------------------</p>;
					}
				}
				
				if (Zotero.Prefs.get('export.quickCopy.quoteBlockquotes.plainText')) {
					// Add quotes around blockquote paragraphs
					var nodes = textXML..blockquote;
					for (var i in nodes) {
						for (var j=0, len=nodes[i].p.length(); j<len; j++) {
							var children = nodes[i].p[j].children();
							children[0] = '\u201c' + children[0];
							// Add closing double quotes to final paragraph
							if (j == len - 1) {
								children[children.length()-1] +=  '\u201d';
							}
						}
					}
				}
				
				// Replace tags with characters, like Thunderbird
				//
				// (It'd be nice to use the OutputFormatted mode of the native
				// plaintext serializer, which appears to be what TB uses,
				// but I wasn't able to get it to work from JS.)
				var map = {
					strong: "*",
					em: "/"
				}
				for (var tag in map) {
					var nodes = textXML.descendants(tag);
					for (var i in nodes) {
						var children = nodes[i].children();
						children[0] = map[tag] + children[0];
						children[children.length()-1] += map[tag];
					}
				}
				
				// Replace span styles with characters
				var spanStyleMap = [
					{
						re: /text-decoration:\s*underline/,
						repl: "_"
					}
				];
				for each(var style in spanStyleMap) {
					var nodes = textXML..span.(style.re.test(@style));
					for (var i in nodes) {
						var children = nodes[i].children();
						children[0] = style.repl + children[0];
						children[children.length()-1] += style.repl;
					}
				}
				
				//
				// And add spaces for indents
				//
				// Placeholder for 4 spaces in final output
				var ztab = "%%ZOTEROTAB%%";
				var p = textXML..p;
				for (var i in p) {
					var children = p[i].children();
					// TODO: Be a bit smarter and more flexible about this
					if (p[i].@style.indexOf("padding-left: 30px") != -1) {
						children[0] = ztab + children[0];
					}
					else if (p[i].@style.indexOf("padding-left: 60px") != -1) {
						children[0] = ztab + ztab + children[0];
					}
					else if (p[i].@style.indexOf("padding-left: 90px") != -1) {
						children[0] = ztab + ztab + ztab + children[0];
					}
					else if (p[i].@style.indexOf("padding-left: 120px") != -1) {
						children[0] = ztab + ztab + ztab + ztab + children[0];
					}
				}
				
				var text = Zotero.Utilities.prototype.unescapeHTML(textXML.toXMLString());
				text = text.replace(new RegExp(ztab, "g"), "    ");
				
				if (text.trim) {
					text = text.trim();
				}
				// TODO: Remove once >=Fx3.5
				else {
					text = Zotero.Utilities.prototype.trim(text)
				}
				
				//
				// Adjustments for the HTML copied to the clipboard
				//
				
				// Everything seems to like margin-left better than padding-left
				var p = htmlXML..p;
				for (var i in p) {
					var children = p[i].children();
					if (p[i].@style.toString().indexOf("padding-left") != -1) {
						p[i].@style = p[i].@style.toString().replace("padding-left", "margin-left");
					}
				}
				
				if (notes.length > 1) {
					var divs = htmlXML.div;
					for (var i=0, len=divs.length(); i<len-1; i++) {
						divs[i].p += <p>----------------------------------------------------------------------</p>;
					}
				}
				
				// Add quotes around blockquote paragraphs
				if (Zotero.Prefs.get('export.quickCopy.quoteBlockquotes.richText')) {
					var nodes = htmlXML..blockquote;
					for (var i in nodes) {
						for (var j=0, len=nodes[i].p.length(); j<len; j++) {
							var children = nodes[i].p[j].children();
							children[0] = '\u201c' + children[0];
							// Add closing double quotes to final paragraph
							if (j == len - 1) {
								children[children.length()-1] +=  '\u201d';
							}
						}
					}
				}
				
				// Word and TextEdit don't indent blockquotes on their own and need this
				//
				// OO gets it right, so this results in an extra indent
				if (Zotero.Prefs.get('export.quickCopy.compatibility.indentBlockquotes')) {
					var p = htmlXML..blockquote.p;
					for (var i in p) {
						var children = p[i].children();
						p[i].@style = "margin-left: 30px";
					}
				}
				
				// Add Word Normal style to paragraphs and add double-spacing
				//
				// OO inserts the conditional style code as a document comment
				if (Zotero.Prefs.get('export.quickCopy.compatibility.word')) {
					var nodes = htmlXML..p;
					for (var i in nodes) {
						nodes[i].@class = "msoNormal";
					}
					var copyHTML = "<!--[if gte mso 0]>"
									+ "<style>"
									+ "p { margin-top:.1pt;margin-right:0in;margin-bottom:.1pt;margin-left:0in; line-height: 200%; }"
									+ "li { margin-top:.1pt;margin-right:0in;margin-bottom:.1pt;margin-left:0in; line-height: 200%; }"
									+ "blockquote p { margin-left: 11px; margin-right: 11px }"
									+ "</style>"
									+ "<![endif]-->\n"
									+ htmlXML.toXMLString();
				}
				else {
					var copyHTML = htmlXML.toXMLString();
				}
				
				var content = {
					text: contentType == "html" ? html : text,
					html: copyHTML
				};
				
				return content;
			}
			
			var csl = Zotero.Styles.get(format).csl;
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
