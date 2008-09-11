{
	"translatorID":"6773a9af-5375-3224-d148-d32793884dec",
	"translatorType":4,
	"label":"InfoTrac",
	"creator":"Simon Kornblith",
	"target":"^https?://[^/]+/itw/infomark/",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2006-12-18 06:00:45"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	// ensure that there is an InfoTrac logo
	if(!doc.evaluate('//img[substring(@alt, 1, 8) = "InfoTrac"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) return false;
	
	if(doc.title.substring(0, 8) == "Article ") {
		var genre = doc.evaluate('//comment()[substring(., 1, 6) = " Genre"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		
		if(genre) {
			var value = Zotero.Utilities.cleanString(genre.nodeValue.substr(7));
			if(value == "article") {
				return "journalArticle";
			} else if(value == "book") {
				return "book";
			} else if(value == "dissertation") {
				return "thesis";
			} else if(value == "bookitem") {
				return "bookSection";
			}
		}
		
		return "magazineArticle";
	} else if(doc.title.substring(0, 10) == "Citations ") {
		return "multiple";
	}
}

function extractCitation(url, elmts, title, doc) {
	var newItem = new Zotero.Item();
	newItem.url = url;
	
	if(title) {
		newItem.title = Zotero.Utilities.superCleanString(title);
	}
	while(elmt = elmts.iterateNext()) {
		var colon = elmt.nodeValue.indexOf(":");
		var field = elmt.nodeValue.substring(1, colon).toLowerCase();
		var value = elmt.nodeValue.substring(colon+1, elmt.nodeValue.length-1);
		if(field == "title") {
			newItem.title = Zotero.Utilities.superCleanString(value);
		} else if(field == "journal") {
			newItem.publicationTitle = value;
		} else if(field == "pi") {
			parts = value.split(" ");
			var date = "";
			var field = null;
			for(j in parts) {
				firstChar = parts[j].substring(0, 1);
				
				if(firstChar == "v") {
					newItem.itemType = "journalArticle";
					field = "volume";
				} else if(firstChar == "i") {
					field = "issue";
				} else if(firstChar == "p") {
					field = "pages";
					
					var pagesRegexp = /p(\w+)\((\w+)\)/;	// weird looking page range
					var match = pagesRegexp.exec(parts[j]);
					if(match) {			// yup, it's weird
						var finalPage = parseInt(match[1])+parseInt(match[2])
						parts[j] = "p"+match[1]+"-"+finalPage.toString();
					} else if(!newItem.itemType) {	// no, it's normal
						// check to see if it's numeric, bc newspaper pages aren't
						var justPageNumber = parts[j].substr(1);
						if(parseInt(justPageNumber).toString() != justPageNumber) {
							newItem.itemType = "newspaperArticle";
						}
					}
				} else if(!field) {	// date parts at the beginning, before
									// anything else
					date += " "+parts[j];
				}
				
				if(field) {
					isDate = false;
					
					if(parts[j] != "pNA") {		// make sure it's not an invalid
												// page number
						// chop of letter
						newItem[field] = parts[j].substring(1);
					} else if(!newItem.itemType) {		// only newspapers are missing
														// page numbers on infotrac
						newItem.itemType = "newspaperArticle";
					}
				}
			}
			
			// Set type
			if(!newItem.itemType) {
				newItem.itemType = "magazineArticle";
			}
			
			if(date != "") {
				newItem.date = date.substring(1);
			}
		} else if(field == "author") {
			var author = Zotero.Utilities.cleanAuthor(value, "author", true);
			
			// ensure author is not already there
			var add = true;
			for each(var existingAuthor in newItem.creators) {
				if(existingAuthor.firstName == author.firstName && existingAuthor.lastName == author.lastName) {
					add = false;
					break;
				}
			}
			if(add) newItem.creators.push(author);
		} else if(field == "issue") {
			newItem.issue = value;
		} else if(field == "volume") {
			newItem.volume = value;
		} else if(field == "issn") {
			newItem.ISSN = value;
		} else if(field == "gjd") {
			var m = value.match(/\(([0-9]{4}[^\)]*)\)(?:, pp\. ([0-9\-]+))?/);
			if(m) {
				newItem.date = m[1];
				newItem.pages = m[2];
			}
		} else if(field == "BookTitle") {
			newItem.publicationTitle = value;
		} else if(field == "genre") {
			value = value.toLowerCase();
			if(value == "article") {
				newItem.itemType = "journalArticle";
			} else if(value == "book") {
				newItem.itemType = "book";
			} else if(value == "dissertation") {
				newItem.itemType = "thesis";
			} else if(value == "bookitem") {
				newItem.itemType = "bookSection";
			}
		}
	}
	
	if(doc) {
		newItem.attachments.push({document:doc, title:"InfoTrac Snapshot"});
	} else {
		newItem.attachments.push({url:url, title:"InfoTrac Snapshot",
		                         mimeType:"text/html"});
	}
	
	newItem.complete();
}

function doWeb(doc, url) {	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var uri = doc.location.href;
	if(doc.title.substring(0, 8) == "Article ") {	// article
		var xpath = '/html/body//comment()';
		var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		extractCitation(uri, elmts);
	} else {										// search results
		var items = new Array();
		var uris = new Array();
		var elmts = new Array();
		
		var host = doc.location.href.match(/^https?:\/\/[^\/]+/)[0];
		
		var tableRows = doc.evaluate('/html/body//table/tbody/tr/td[a/b]', doc, nsResolver,
		                             XPathResult.ANY_TYPE, null);
		var tableRow;
		var javaScriptRe = /'([^']*)' *, *'([^']*)'/
		var i = 0;
		// Go through table rows
		while(tableRow = tableRows.iterateNext()) {
			var link = doc.evaluate('./a', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			var m = javaScriptRe.exec(link.href);
			if(m) {
				uris[i] = host+"/itw/infomark/192/215/90714844w6"+m[1]+"?sw_aep=olr_wad"+m[2];
			}
			var article = doc.evaluate('./b/text()', link, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			items[i] = article.nodeValue;
			// Chop off final period
			if(items[i].substr(items[i].length-1) == ".") {
				items[i] = items[i].substr(0, items[i].length-1);
			}
			elmts[i] = doc.evaluate(".//comment()", tableRow, nsResolver, XPathResult.ANY_TYPE, null);
			i++;
		}
		
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			extractCitation(uris[i], elmts[i], items[i]);
		}
	}
}