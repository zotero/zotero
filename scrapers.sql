-- 38

-- Set the following timestamp to the most recent scraper update date
REPLACE INTO "version" VALUES ('repository', STRFTIME('%s', '2006-08-07 01:09:00'));

REPLACE INTO "translators" VALUES ('96b9f483-c44d-5784-cdad-ce21b984fe01', '2006-06-28 23:08:00', 4, 'Amazon.com Scraper', 'Simon Kornblith', '^http://www\.amazon\.com/(?:gp/(?:product|search)/|exec/obidos/search-handle-url/|s/)', 
'function detect(doc, url) {
	var searchRe = new RegExp(''^http://www\.amazon\.com/(gp/search/|exec/obidos/search-handle-url/|s/)'');
	if(searchRe.test(doc.location.href)) {
		return "multiple";
	} else {
		return "book";
	}
}
',
'function scrape(doc) {	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var newItem = new Scholar.Item("book");
	newItem.source = doc.location.href;
	
	// Retrieve authors
	try {
		var xpath = ''/html/body/table/tbody/tr/td[2]/form/div[@class="buying"]/a'';
		var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
		for (var i = 0; i < elmts.length; i++) {
			var elmt = elmts[i];
			var author = Scholar.Utilities.getNode(doc, elmt, ''./text()[1]'', nsResolver).nodeValue;
			
			newItem.creators.push(Scholar.Utilities.cleanAuthor(author, "author"));
		}
	} catch(ex) {}
	
	// Retrieve data from "Product Details" box
	var xpath = ''/html/body/table/tbody/tr/td[2]/table/tbody/tr/td[@class="bucket"]/div[@class="content"]/ul/li'';
	var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	for (var i = 0; i < elmts.length; i++) {
		try {
			var elmt = elmts[i];
			var attribute = Scholar.Utilities.cleanString(Scholar.Utilities.getNode(doc, elmt, ''./B[1]/text()[1]'', nsResolver).nodeValue);
			if(Scholar.Utilities.getNode(doc, elmt, ''./text()[1]'', nsResolver)) {
				var value = Scholar.Utilities.cleanString(Scholar.Utilities.getNode(doc, elmt, ''./text()[1]'', nsResolver).nodeValue);
				if(attribute == "Publisher:") {
					if(value.lastIndexOf("(") != -1) {
						var date = value.substring(value.lastIndexOf("(")+1, value.length-1);
						jsDate = new Date(date);
						if(!isNaN(jsDate.valueOf())) {
							date = Scholar.Utilities.dateToISO(jsDate);
						}
						newItem.date = date;
						
						value = value.substring(0, value.lastIndexOf("(")-1);
					}
					if(value.lastIndexOf(";") != -1) {
						newItem.edition = value.substring(value.lastIndexOf(";")+2, value.length);
						
						value = value.substring(0, value.lastIndexOf(";"));
					}
					newItem.publisher = value;
				/*} else if(attribute == "Language:") {
					.addStatement(uri, prefixDC + ''language'', value);*/
				} else if(attribute == "ISBN:") {
					newItem.ISBN = value;
				/*} else if(value.substring(value.indexOf(" ")+1, value.length) == "pages") {
					.addStatement(uri, prefixDummy + ''pages'', value.substring(0, value.indexOf(" ")));
					.addStatement(uri, prefixDC + ''medium'', attribute.substring(0, attribute.indexOf(":")));*/
				}
			}
		} catch(ex) {}
	}
	
	var xpath = ''/html/body/table/tbody/tr/td[2]/form/div[@class="buying"]/b[@class="sans"]'';
	var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	var title = Scholar.Utilities.cleanString(Scholar.Utilities.getNode(doc, elmts[0], ''./text()[1]'', nsResolver).nodeValue);
	if(title.lastIndexOf("(") != -1 && title.lastIndexOf(")") == title.length-1) {
		title = title.substring(0, title.lastIndexOf("(")-1);
	}
	newItem.title = title;
	
	newItem.complete();
}

function doWeb(doc, url) {
	var searchRe = new RegExp(''^http://www\.amazon\.com/(gp/search/|exec/obidos/search-handle-url/|s/)'');
	var m = searchRe.exec(doc.location.href)
	if(m) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		// Why can''t amazon use the same stylesheets
		var xpath;
		if(m == "exec/obidos/search-handle-url/") {
			xpath = ''//table[@cellpadding="3"]'';
		} else {
			xpath = ''//table[@class="searchresults"]'';
		}
		
		var searchresults = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
		var items = Scholar.Utilities.getItemArray(doc, searchresults, ''^http://www\.amazon\.com/(gp/product/|exec/obidos/tg/detail/)'', ''^(Buy new|Hardcover|Paperback|Digital)$'');
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			uris.push(i);
		}
		
		Scholar.Utilities.processDocuments(null, uris, function(browser) { scrape(browser.contentDocument) },
			function() { Scholar.done(); }, function() {});
		
		Scholar.wait();
	} else {
		scrape(doc);
	}
}');

REPLACE INTO "translators" VALUES ('838d8849-4ffb-9f44-3d0d-aa8a0a079afe', '2006-06-26 16:01:00', 4, 'WorldCat Scraper', 'Simon Kornblith', '^http://(?:new)?firstsearch\.oclc\.org/WebZ/',
'function detect(doc, url) {
	if(doc.title == ''FirstSearch: WorldCat Detailed Record'') {
		return "book";
	} else if(doc.title == ''FirstSearch: WorldCat List of Records'') {
		return "multiple";
	}
}',
'function doWeb(doc, url) {
	var sessionRegexp = /(?:\?|\:)sessionid=([^?:]+)(?:\?|\:|$)/;
	var numberRegexp = /(?:\?|\:)recno=([^?:]+)(?:\?|\:|$)/;
	var resultsetRegexp = /(?:\?|\:)resultset=([^?:]+)(?:\?|\:|$)/;
	var hostRegexp = new RegExp("http://([^/]+)/");
		
	var sMatch = sessionRegexp.exec(url);
	var sessionid = sMatch[1];
	
	var hMatch = hostRegexp.exec(url);
	var host = hMatch[1];
	
	var newUri, exportselect;
	
	if(doc.title == ''FirstSearch: WorldCat Detailed Record'') {
		var publisherRegexp = /^(.*), (.*?),?$/;
		
		var nMatch = numberRegexp.exec(url);
		if(nMatch) {
			var number = nMatch[1];
		} else {
			number = 1;
		}
		
		var rMatch = resultsetRegexp.exec(url);
		if(rMatch) {
			var resultset = rMatch[1];
		} else {
			// It''s in an XPCNativeWrapper, so we have to do this black magic
			resultset = doc.forms.namedItem(''main'').elements.namedItem(''resultset'').value;
		}
		
		exportselect = ''record'';
		newUri = ''http://''+host+''/WebZ/DirectExport?numrecs=10:smartpage=directexport:entityexportnumrecs=10:entityexportresultset='' + resultset + '':entityexportrecno='' + number + '':sessionid='' + sessionid + '':entitypagenum=35:0'';
		
		var uris = new Array(newUri);
	} else {
		var items = Scholar.Utilities.getItemArray(doc, doc, ''/WebZ/FSFETCH\\?fetchtype=fullrecord'', ''^(See more details for locating this item|Detailed Record)$'');
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		// Set BookMark cookie
		for(var i in items) {	// Hack to get first item
			var myCookie = sessionid+":";
			var rMatch = resultsetRegexp.exec(i);
			var resultset = rMatch[1];
			break;
		}
		var uris = new Array();
		for(var i in items) {
			var nMatch = numberRegexp.exec(i);
			myCookie += resultset+"_"+nMatch[1]+",";
			uris.push(i);
		}
		myCookie = myCookie.substr(0, myCookie.length-1);
		doc.cookie = "BookMark="+myCookie;
		
		exportselect = ''marked'';
		newUri = ''http://''+host+''/WebZ/DirectExport?numrecs=10:smartpage=directexport:entityexportnumrecs=10:entityexportresultset='' + resultset + '':entityexportrecno=1:sessionid='' + sessionid + '':entitypagenum=29:0'';
	}
	
	Scholar.Utilities.HTTPUtilities.doPost(newUri, ''exportselect=''+exportselect+''&exporttype=plaintext'', null, function(text) {
		Scholar.Utilities.debugPrint(text);
		var lineRegexp = new RegExp();
		lineRegexp.compile("^([\\w() ]+): *(.*)$");
		
		var k = 0;
		var newItem = new Scholar.Item("book");
		newItem.source = uris[k];
		
		var lines = text.split(''\n'');
		for(var i=0;i<lines.length;i++) {
			match = lineRegexp.exec(lines[i]);
			if(lines[i] == "--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------") {
				// new record
				k++;
				if(uris[k]) {
					newItem.complete();
					newItem = new Scholar.Item("book");
					newItem.source = uris[k];
				} else {
					break;
				}
			} else if(match) {
				// is a useful match
				if(match[1] == ''Title'') {
					var title = match[2];
					if(!lineRegexp.test(lines[i+1])) {
						i++;
						title += '' ''+lines[i];
					}
					if(title.substring(title.length-2) == " /") {
						title = title.substring(0, title.length-2);
					}
					newItem.title = title;
				} else if(match[1] == ''Author(s)'') {
					var authors = match[2].split('';'');
					if(authors) {
						newItem.creators.push(Scholar.Utilities.cleanAuthor(authors[0], "author" true));
						for(var j=1; j<authors.length; j+=2) {
							if(authors[j-1].substring(0, 1) == ''('') {
								// ignore places where there are parentheses
								j++;
							}
							newItem.creators.push(Scholar.Utilities.cleanAuthor(authors[j], "author", true));
						}
					} else {
							newItem.creators.push(Scholar.Utilities.trimString(match[2]));
					}
				} else if(match[1] == ''Publication'') {
					// Don''t even try to deal with this. The WorldCat metadata is of poor enough quality that this isn''t worth it.
					match[2] = Scholar.Utilities.trimString(match[2]);
					if(match[2].substring(match[2].length-1) == '','') {
							match[2] = match[2].substring(0, match[2].length-1);
					}
					newItem.publisher = match[2];
				/*} else if(match[1] == ''Language'') {
					.addStatement(uri, prefixDC + ''language'', Scholar.Utilities.trimString(match[2]));*/
				} else if(match[1] == ''Standard No'') {
					var identifiers = match[2].split(/ +/);
					var j=0;
					while(j<(identifiers.length-1)) {
							var type = identifiers[j].substring(0, identifiers[j].length-1);
							var lastChar;
							var value;
	
							j++;
							while(j<identifiers.length && (lastChar = identifiers[j].substring(identifiers[j].length-1)) != '':'') {
								if(identifiers[j].substring(0, 1) != ''('') {
									if(lastChar == '';'') {
										value = identifiers[j].substring(0, identifiers[j].length-1);
									} else {
										value = identifiers[j];
									}
									if(type == "ISBN" || type == "ISSN") {
										newItem[type] = value;
									}
								}
								j++;
							}
					}
				} else if(match[1] == ''Year'') {
					newItem.year = match[2];
				}
			}
		}
		
		newItem.complete();
		
		Scholar.done();
	})
	Scholar.wait();
}');

REPLACE INTO "translators" VALUES ('88915634-1af6-c134-0171-56fd198235ed', '2006-06-26 21:40:00', 4, 'LOC/Voyager WebVoyage Scraper', 'Simon Kornblith', 'Pwebrecon\.cgi',
'function detect(doc, url) {
	var export_options = doc.forms.namedItem(''frm'').elements.namedItem(''RD'').options;
	for(var i in export_options) {
		if(export_options[i].text == ''Latin1 MARC''
		|| export_options[i].text == ''Raw MARC''
		|| export_options[i].text == ''UTF-8''
		|| export_options[i].text == ''MARC (Unicode/UTF-8)''
		|| export_options[i].text == ''MARC (non-Unicode/MARC-8)'') {
			// We have an exportable single record
			if(doc.forms.namedItem(''frm'').elements.namedItem(''RC'')) {
				return "multiple";
			} else {
				return "book";
			}
		}
	}
}',
'function doWeb(doc, url) {
	var postString = '''';
	var form = doc.forms.namedItem(''frm'');
	var newUri = form.action;
	var multiple = false;
	
	if(doc.forms.namedItem(''frm'').elements.namedItem(''RC'')) {
		multiple = true;
		
		var availableItems = new Object();	// Technically, associative arrays are objects
			
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		// Require link to match this
		var tagRegexp = new RegExp();
		tagRegexp.compile(''Pwebrecon\\.cgi\\?.*v1=[0-9]+\\&.*ti='');
		// Do not allow text to match this
		var rejectRegexp = new RegExp();
		rejectRegexp.compile(''\[ [0-9]+ \]'');
		
		var checkboxes = new Array();
		var urls = new Array();
		
		var tableRows = Scholar.Utilities.gatherElementsOnXPath(doc, doc, ''/html/body/form/table/tbody/tr[td/input[@type="checkbox"]]'', nsResolver);
		// Go through table rows
		for(var i=0; i<tableRows.length; i++) {
			// CHK is what we need to get it all as one file
			var input = Scholar.Utilities.getNode(doc, tableRows[i], ''./td/input[@name="CHK"]'', nsResolver);
			checkboxes[i] = input.value;
			var links = Scholar.Utilities.gatherElementsOnXPath(doc, tableRows[i], ''.//a'', nsResolver);
			urls[i] = links[0].href;
			// Go through links
			for(var j=0; j<links.length; j++) {
				if(tagRegexp.test(links[j].href)) {
					var text = Scholar.Utilities.getNodeString(doc, links[j], ''.//text()'', null);
					if(text) {
						text = Scholar.Utilities.cleanString(text);
						if(!rejectRegexp.test(text)) {
							if(availableItems[i]) {
								availableItems[i] += " "+text;
							} else {
								availableItems[i] = text;
							}
						}
					}
				}
			}
		}
		
		var items = Scholar.selectItems(availableItems);
		if(!items) {
			return true;
		}
		
		// add arguments for items we need to grab
		for(var i in items) {
			postString += "CHK="+checkboxes[i]+"&";
		}
	}
	
	var raw, unicode, latin1;
	
	for(var i=0; i<form.elements.length; i++) {
		if(form.elements[i].type && form.elements[i].type.toLowerCase() == ''hidden'') {
			postString += escape(form.elements[i].name)+''=''+escape(form.elements[i].value)+''&'';
		}
	}
	
	var export_options = form.elements.namedItem(''RD'').options;
	for(var i=0; i<export_options.length; i++) {
		if(export_options[i].text == ''Raw MARC''
		|| export_options[i].text == ''MARC (non-Unicode/MARC-8)'') {
			raw = i;
		}  if(export_options[i].text == ''Latin1 MARC'') {
			latin1 = i;
		} else if(export_options[i].text == ''UTF-8''
		|| export_options[i].text == ''MARC (Unicode/UTF-8)'') {
			unicode = i;
		}
	}
	
	if(unicode) {
		var rd = unicode;
	} else if(latin1) {
		var rd = latin1;
	} else if(raw) {
		var rd = raw;
	} else {
		return false;
	}
	
	postString += ''RD=''+rd+''&MAILADDY=&SAVE=Press+to+SAVE+or+PRINT'';
	
	// No idea why this doesn''t work as post
	Scholar.Utilities.HTTPUtilities.doGet(newUri+''?''+postString, null, function(text) {	
		// load translator for MARC
		var marc = Scholar.loadTranslator("import", "a6ee60df-1ddc-4aae-bb25-45e0537be973");
		marc.Scholar.write(text);
		marc.Scholar.eof();
		marc.doImport(url);
		
		Scholar.done();
	})
	Scholar.wait();
}');

REPLACE INTO "translators" VALUES ('d921155f-0186-1684-615c-ca57682ced9b', '2006-06-26 16:01:00', 4, 'JSTOR Scraper', 'Simon Kornblith', '^http://www\.jstor\.org/(?:view|browse|search/)', 
'function detect(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	// See if this is a seach results page
	if(doc.title == "JSTOR: Search Results") {
		return "multiple";
	}
	
	// If this is a view page, find the link to the citation
	var xpath = ''/html/body/div[@class="indent"]/center/font/p/a[@class="nav"]'';
	var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	if(!elmts.length) {
		var xpath = ''/html/body/div[@class="indent"]/center/p/font/a[@class="nav"]'';
		var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	}
	if(elmts && elmts.length) {
		return "journalArticle";
	}
}',
'function getList(urls, each, done, error) {
	var url = urls.shift();
	Scholar.Utilities.HTTPUtilities.doGet(url, null, function(text) {
		if(each) {
			each(text);
		}
		
		if(urls.length) {
			getList(urls, each, done, error);
		} else if(done) {
			done(text);
		}
	}, error);
}

function itemComplete(newItem, url) {
	if(!newItem.source) {
		if(newItem.ISSN) {
			newItem.source = "http://www.jstor.org/browse/"+newItem.ISSN;
		} else {
			newItem.source = url;
		}
	}
	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	var saveCitations = new Array();
	
	if(doc.title == "JSTOR: Search Results") {
		var availableItems = new Object();
		
		// Require link to match this
		var tagRegexp = new RegExp();
		tagRegexp.compile(''citationAction='');
		
		var tableRows = Scholar.Utilities.gatherElementsOnXPath(doc, doc, ''/html/body/div[@class="indent"]/table/tbody/tr[td/span[@class="printDownloadSaveLinks"]]'', nsResolver);
		// Go through table rows
		for(var i=0; i<tableRows.length; i++) {
			var links = Scholar.Utilities.gatherElementsOnXPath(doc, tableRows[i], ''.//a'', nsResolver);
			// Go through links
			for(var j=0; j<links.length; j++) {
				if(tagRegexp.test(links[j].href)) {
					var text = Scholar.Utilities.getNode(doc, tableRows[i], ''.//strong/text()'', null);
					if(text && text.nodeValue) {
						text = Scholar.Utilities.cleanString(text.nodeValue);
						if(availableItems[links[j].href]) {
							availableItems[links[j].href] += " "+text;
						} else {
							availableItems[links[j].href] = text;
						}
					}
				}
			}
		}
		
		var items = Scholar.selectItems(availableItems);
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			saveCitations.push(i.replace(''citationAction=remove'', ''citationAction=save''));
		}
	} else {
		// If this is a view page, find the link to the citation
		var xpath = ''/html/body/div[@class="indent"]/center/font/p/a[@class="nav"]'';
		var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
		if(!elmts.length) {
			var xpath = ''/html/body/div[@class="indent"]/center/p/font/a[@class="nav"]'';
			var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
		}
		var saveCitation = elmts[0].href;
		var viewSavedCitations = elmts[1].href;
		saveCitations.push(saveCitation.replace(''citationAction=remove'', ''citationAction=save''));
	}
	
	Scholar.Utilities.HTTPUtilities.doGet(''http://www.jstor.org/browse?citationAction=removeAll&confirmRemAll=on&viewCitations=1'', null, function() {	// clear marked
		// Mark all our citations
		getList(saveCitations, null, function() {						// mark this
			Scholar.Utilities.HTTPUtilities.doGet(''http://www.jstor.org/browse/citations.txt?exportAction=Save+as+Text+File&exportFormat=cm&viewCitations=1'', null, function(text) {
																							// get marked
				var k = 0;
				var lines = text.split("\n");
				var haveStarted = false;
				var newItemRe = /^<[0-9]+>/;
				
				var newItem = new Scholar.Item("journalArticle");
				
				for(var i in lines) {
					if(lines[i].substring(0,3) == "<1>") {
						haveStarted = true;
					} else if(newItemRe.test(lines[i])) {
						itemComplete(newItem, url);
						newItem = new Scholar.Item("journalArticle");
					} else if(lines[i].substring(2, 5) == " : " && haveStarted) {
						var fieldCode = lines[i].substring(0, 2);
						var fieldContent = Scholar.Utilities.cleanString(lines[i].substring(5))
						
						if(fieldCode == "TI") {
							newItem.title = fieldContent;
						} else if(fieldCode == "AU") {
							var authors = fieldContent.split(";");
							for(j in authors) {
								if(authors[j]) {
									newItem.creators.push(Scholar.Utilities.cleanAuthor(authors[j], "author", true));
								}
							}
						} else if(fieldCode == "SO") {
							newItem.publicationTitle = fieldContent;
						} else if(fieldCode == "VO") {
							newItem.volume = fieldContent;
						} else if(fieldCode == "NO") {
							newItem.issue = fieldContent;
						} else if(fieldCode == "SE") {
							newItem.seriesTitle = fieldContent;
						} else if(fieldCode == "DA") {
							var date = new Date(fieldContent.replace(".", ""));
							if(isNaN(date.valueOf())) {
								newItem.date = fieldContent;
							} else {
								newItem.date = Scholar.Utilities.dateToISO(date);
							}
						} else if(fieldCode == "PP") {
							newItem.pages = fieldContent;
						} else if(fieldCode == "EI") {
							newItem.source = fieldContent;
						} else if(fieldCode == "IN") {
							newItem.ISSN = fieldContent;
						} else if(fieldCode == "PB") {
							newItem.publisher = fieldContent;
						}
					}
				}
				
				// last item is complete
				if(haveStarted) {
					itemComplete(newItem, url);
				}
				
				Scholar.done();
			});
		}, function() {});
	});
	
	Scholar.wait();
}');

REPLACE INTO "translators" VALUES ('e85a3134-8c1a-8644-6926-584c8565f23e', '2006-06-26 16:01:00', 4, 'History Cooperative Scraper', 'Simon Kornblith', '^http://www\.historycooperative\.org/(?:journals/.+/.+/.+\.html$|cgi-bin/search.cgi)', 
'function detect(doc, url) {
	if(doc.title == "History Cooperative: Search Results") {
		return "multiple";
	} else {
		return "journalArticle";
	}
}',
'function associateMeta(newItem, metaTags, field, scholarField) {
	var field = metaTags.namedItem(field);
	if(field) {
		newItem[scholarField] = field.getAttribute("content");
	}
}

function scrape(doc) {
	var newItem = new Scholar.Item("journalArticle");
	newItem.source = doc.location.href;
	
	var month, year;
	var metaTags = doc.getElementsByTagName("meta");
	associateMeta(newItem, metaTags, "Title", "title");
	associateMeta(newItem, metaTags, "Journal", "publication");
	associateMeta(newItem, metaTags, "Volume", "volume");
	associateMeta(newItem, metaTags, "Issue", "number");
	
	var author = metaTags.namedItem("Author");
	if(author) {
		var authors = author.getAttribute("content").split(" and ");
		for(j in authors) {
			newItem.creators.push(Scholar.Utilities.cleanAuthor(authors[j], "author"));
		}
	}
	
	newItem.complete();
	
	// don''t actually need date info for a journal article
	/*var month = metaTags.namedItem("PublicationMonth");
	var year = metaTags.namedItem("PublicationYear");
	if(month && year) {
		odel.addStatement(uri, prefixDC + "date", month.getAttribute("content")+" "+year.getAttribute("content"), false);
	}*/
}

function doWeb(doc, url) {
	if(doc.title == "History Cooperative: Search Results") {
		var items = Scholar.Utilities.getItemArray(doc, doc, ''^http://[^/]+/journals/.+/.+/.+\.html$'');
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			uris.push(i);
		}
		
		Scholar.Utilities.processDocuments(null, uris, function(browser) { scrape(browser.contentDocument) },
			function() { Scholar.done(); }, function() {});
		
		Scholar.wait();
	} else {
		scrape(doc);
	}
}');

REPLACE INTO "translators" VALUES ('4fd6b89b-2316-2dc4-fd87-61a97dd941e8', '2006-08-06 21:45:00', 4, 'InnoPAC Scraper', 'Simon Kornblith', '^http://[^/]+/(?:search/|record=)',
'function detect(doc, url) {
	// First, check to see if the URL alone reveals InnoPAC, since some sites don''t reveal the MARC button
	var matchRegexp = new RegExp(''^(http://[^/]+/search/[^/]+/[^/]+/1\%2C[^/]+/)frameset(.+)$'');
	if(matchRegexp.test(doc.location.href)) {
		return "book";
	}
	// Next, look for the MARC button
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var xpath = ''//a[img[@alt="MARC Display"]]'';
	var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	if(elmts.length) {
		return "book";
	}
	// Also, check for links to an item display page
	var tags = doc.getElementsByTagName("a");
	for(var i=0; i<tags.length; i++) {
		if(matchRegexp.test(tags[i].href)) {
			return "multiple";
		}
	}
	
	return false;
}',
'function doWeb(doc, url) {
	var uri = doc.location.href;
	var newUri;
	
	var matchRegexp = new RegExp(''^(http://[^/]+/search/[^/]+/[^/]+/1\%2C[^/]+/)frameset(.+)$'');
	var m = matchRegexp.exec(uri);
	if(m) {
		newUri = m[1]+''marc''+m[2];
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
	
		var xpath = ''//a[img[@alt="MARC Display"]]'';
		var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
		if(elmts.length) {
			newUri = elmts[0].href;
		}
	}
	
	// load translator for MARC
	var marc = Scholar.loadTranslator("import", "a6ee60df-1ddc-4aae-bb25-45e0537be973");
	
	if(newUri) {	// single page
		Scholar.Utilities.loadDocument(newUri, function(newBrowser) {
			newDoc = newBrowser.contentDocument;
			
			var namespace = newDoc.documentElement.namespaceURI;
			var nsResolver = namespace ? function(prefix) {
			  if (prefix == ''x'') return namespace; else return null;
			} : null;
			
			var xpath = ''//pre'';
			var elmts = Scholar.Utilities.gatherElementsOnXPath(newDoc, newDoc, xpath, nsResolver);
			
			var text = Scholar.Utilities.getNode(doc, elmts[0], ''./text()[1]'', nsResolver).nodeValue;
			
			var newItem = new Scholar.Item();
			newItem.source = uri;
			
			var record = new marc.MARC_Record();
			
			var linee = text.split("\n");
			for (var i=0; i<linee.length; i++) {
				linee[i] = linee[i].replace(/\xA0|_|\t/g,'' '');
				if (linee[i] == '''') continue; // jumps empty lines
				var replacer = record.subfield_delimiter+''$1'';
				linee[i]  = linee[i].replace(/\|(.)/g,replacer);
				linee[i]  = linee[i].replace(/\|/g,this.subfield_delimiter);
				var tag   = linee[i].substr(0,3);
				var ind1  = linee[i].substr(4,1);
				var ind2  = linee[i].substr(5,1);
				var value = record.subfield_delimiter+''a''+linee[i].substr(7);
				if(linee[i].substr(0, 6) == "LEADER") {
					value = linee[i].substr(7);
					record.leader.record_length = ''00000'';
					record.leader.record_status = value.substr(5,1);
					record.leader.type_of_record = value.substr(6,1);
					record.leader.bibliographic_level = value.substr(7,1);
					record.leader.type_of_control = value.substr(8,1);
					record.leader.character_coding_scheme = value.substr(9,1);
					record.leader.indicator_count = ''2'';
					record.leader.subfield_code_length = ''2'';
					record.leader.base_address_of_data = ''00000'';
					record.leader.encoding_level = value.substr(17,1);
					record.leader.descriptive_cataloging_form = value.substr(18,1);
					record.leader.linked_record_requirement = value.substr(19,1);
					record.leader.entry_map = ''4500'';
					
					record.directory = '''';
					record.directory_terminator = record.field_terminator;
					record.variable_fields = new Array();
				}
				else if (tag > ''008'' && tag < ''899'') { // jumps low and high tags
					if (tag != ''040'') record.add_field(tag,ind1,ind2,value);
				}
			}
			
			record.translate(newItem);
			newItem.complete();
			
			Scholar.done();
		}, function() {});
	} else {	// Search results page
		// Require link to match this
		var tagRegexp = new RegExp();
		tagRegexp.compile(''^http://[^/]+/search/[^/]+/[^/]+/1\%2C[^/]+/frameset'');
		
		var checkboxes = new Array();
		var urls = new Array();
		var availableItems = new Array();
		
		var tableRows = Scholar.Utilities.gatherElementsOnXPath(doc, doc, ''//table[@class="browseScreen"]//tr[td/input[@type="checkbox"]]'', nsResolver);
		// Go through table rows
		for(var i=0; i<tableRows.length; i++) {
			// CHK is what we need to get it all as one file
			var input = Scholar.Utilities.getNode(doc, tableRows[i], ''./td/input[@type="checkbox"]'', nsResolver);
			checkboxes[i] = input.name+"="+escape(input.value);
			var links = Scholar.Utilities.gatherElementsOnXPath(doc, tableRows[i], ''.//a'', nsResolver);
			urls[i] = links[0].href;
			// Go through links
			for(var j=0; j<links.length; j++) {
				if(tagRegexp.test(links[j].href)) {
					var text = Scholar.Utilities.getNodeString(doc, links[j], ''.//text()'', null);
					if(text) {
						text = Scholar.Utilities.cleanString(text);
						if(availableItems[i]) {
							availableItems[i] += " "+text;
						} else {
							availableItems[i] = text;
						}
					}
				}
			}
		}
		
		var items = Scholar.selectItems(availableItems);
		
		if(!items) {
			return true;
		}
		
		var urlRe = new RegExp("^(http://[^/]+(/search/[^/]+/))");
		var m = urlRe.exec(urls[0]);
		var clearUrl = m[0]+"?clear_saves=1";
		var postUrl = m[0];
		var exportUrl = m[1]+"++export/1,-1,-1,B/export";
		
		var postString = "";
		for(var i in items) {
			postString += checkboxes[i]+"&";
		}
		postString += "save_func=save_marked";
		
		
		Scholar.Utilities.HTTPUtilities.doGet(clearUrl, null, function() {
			Scholar.Utilities.HTTPUtilities.doPost(postUrl, postString, null, function() {
				Scholar.Utilities.HTTPUtilities.doPost(exportUrl, "ex_format=50&ex_device=45&SUBMIT=Submit", null, function(text) {
					marc.Scholar.write(text);
					marc.Scholar.eof();
					marc.doImport(url);
					
					Scholar.done();
				});
			});
		});
	}

	Scholar.wait();
}');

REPLACE INTO "translators" VALUES ('add7c71c-21f3-ee14-d188-caf9da12728b', '2006-06-26 16:01:00', 4, 'SIRSI 2003+ Scraper', 'Simon Kornblith', '/uhtbin/cgisirsi',
'function detect(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var xpath = ''//tr[th[@class="viewmarctags"]][td[@class="viewmarctags"]]'';
	var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	if(elmts.length) {
		return "book";
	}
	var xpath = ''//td[@class="searchsum"]/table'';
	var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	if(elmts.length) {
		return "multiple";
	}
}',
'function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var xpath = ''//tr[th[@class="viewmarctags"]][td[@class="viewmarctags"]]'';
	var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	if(!elmts.length) {
		return false;
	}

	var newItem = new Scholar.Item("book");
	newItem.source = doc.location.href;
	
	for (var i = 0; i < elmts.length; i++) {
		var elmt = elmts[i];
		try {
			var node = Scholar.Utilities.getNode(doc, elmt, ''./TD[1]/A[1]/text()[1]'', nsResolver);
			if(!node) {
				var node = Scholar.Utilities.getNode(doc, elmt, ''./TD[1]/text()[1]'', nsResolver);
			}
			if(node) {
				var field = Scholar.Utilities.superCleanString(Scholar.Utilities.getNode(doc, elmt, ''./TH[1]/text()[1]'', nsResolver).nodeValue);
				field = field.toLowerCase();
				var value = Scholar.Utilities.superCleanString(node.nodeValue);
				if(field == "publisher") {
					newItem.publisher = value;
				} else if(field == "pub date") {
					var re = /[0-9]+/;
					var m = re.exec(value);
					newItem.year = m[0];
				} else if(field == "isbn") {
					var re = /^[0-9](?:[0-9X]+)/;
					var m = re.exec(value);
					newItem.ISBN = m[0];
				} else if(field == "title") {
					var titleParts = value.split(" / ");
					newItem.title = titleParts[0];
				} else if(field == "publication info") {
					var pubParts = value.split(" : ");
					newItem.place = pubParts[0];
				} else if(field == "personal author") {
					newItem.creators.push(Scholar.Utilities.cleanAuthor(value, "author", true));
				} else if(field == "added author") {
					newItem.creators.push(Scholar.Utilities.cleanAuthor(value, "contributor", true));
				} else if(field == "corporate author") {
					newItem.creators.push({lastName:author});
				}
			}
		} catch (e) {}
	}
	
	var callNumber = Scholar.Utilities.getNode(doc, doc, ''//tr/td[1][@class="holdingslist"]/text()'', nsResolver);
	if(callNumber && callNumber.nodeValue) {
		newItem.callNumber = callNumber.nodeValue;
	}
	
	newItem.complete();
	return true;
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	if(!scrape(doc)) {
		var checkboxes = new Array();
		var urls = new Array();
		var availableItems = new Array();
		
		var tableRows = Scholar.Utilities.gatherElementsOnXPath(doc, doc, ''//td[@class="searchsum"]/table[//input[@value="Details"]]'', nsResolver);
		// Go through table rows
		for(var i=1; i<tableRows.length; i++) {
			var input = Scholar.Utilities.getNode(doc, tableRows[i], ''.//input[@value="Details"]'', nsResolver);
			checkboxes[i] = input.name;
			var text = Scholar.Utilities.getNodeString(doc, tableRows[i], ''.//label/strong//text()'', nsResolver);
			if(text) {
				availableItems[i] = text;
			}
		}
		
		var items = Scholar.selectItems(availableItems);
		
		if(!items) {
			return true;
		}
		
		var hostRe = new RegExp("^http://[^/]+");
		var m = hostRe.exec(doc.location.href);
		var hitlist = doc.forms.namedItem("hitlist");
		var baseUrl = m[0]+hitlist.getAttribute("action")+"?first_hit="+hitlist.elements.namedItem("first_hit").value+"&last_hit="+hitlist.elements.namedItem("last_hit").value;
		Scholar.Utilities.debugPrint(baseUrl);
		
		var uris = new Array();
		for(var i in items) {
			uris.push(baseUrl+"&"+checkboxes[i]+"=Details");
		}
		
		Scholar.Utilities.processDocuments(null, uris, function(browser) { scrape(browser.contentDocument) },
			function() { Scholar.done() }, function() {});
		
		Scholar.wait();
	}
}
');

REPLACE INTO "translators" VALUES ('a77690cf-c5d1-8fc4-110f-d1fc765dcf88', '2006-06-26 16:01:00', 4, 'ProQuest Scraper', 'Simon Kornblith', '^http://proquest\.umi\.com/pqdweb\?((?:.*\&)?did=.*&Fmt=[0-9]|(?:.*\&)Fmt=[0-9].*&did=|(?:.*\&)searchInterface=)',
'function detect(doc, url) {
	if(doc.title == "Results") {
		return "magazineArticle";
	} else {
		return "book";
	}
}',
'function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;


	var newItem = new Scholar.Item();
	newItem.source = doc.location.href;
	
	// Title
	var xpath = ''/html/body/span[@class="textMedium"]/table/tbody/tr/td[@class="headerBlack"]/strong//text()'';
	var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	var title = "";
	for (var i = 0; i < elmts.length; i++) {
		var elmt = elmts[i];
		title += elmt.nodeValue;
	}
	if(title) {
		newItem.title = title;
	}
	
	// Authors
	var xpath = ''/html/body/span[@class="textMedium"]/table/tbody/tr/td[@class="textMedium"]/a/em'';
	var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	for (var i = 0; i < elmts.length; i++) {
		var elmt = elmts[i];
		// there are sometimes additional tags representing higlighting
		var author = getNodeString(doc, links[j], ''.//text()'', null);
		if(author) {
			newItem.creators.push(Scholar.Utilities.cleanAuthor(author, "author", true));
		}
	}
	
	// Other info
	var xpath = ''/html/body/span[@class="textMedium"]/font/table/tbody/tr'';
	var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	for (var i = 0; i < elmts.length; i++) {
		var elmt = elmts[i];
		var field = Scholar.Utilities.superCleanString(Scholar.Utilities.getNode(doc, elmt, ''./TD[1]/text()[1]'', nsResolver).nodeValue).toLowerCase();
		if(field == "publication title") {
			var publication = Scholar.Utilities.getNode(doc, elmt, ''./TD[2]/A[1]/text()[1]'', nsResolver);
			if(publication.nodeValue) {
				newItem.publicationTitle = Scholar.Utilities.superCleanString(publication.nodeValue);
			}
			
			var place = Scholar.Utilities.getNode(doc, elmt, ''./TD[2]/text()[1]'', nsResolver);
			if(place.nodeValue) {
				newItem.place = Scholar.Utilities.superCleanString(place.nodeValue);
			}
			
			var date = Scholar.Utilities.getNode(doc, elmt, ''./TD[2]/A[2]/text()[1]'', nsResolver);		
			if(date.nodeValue) {
				date = date.nodeValue;
				var jsDate = new Date(Scholar.Utilities.superCleanString(date));
				if(!isNaN(jsDate.valueOf())) {
					date = Scholar.Utilities.dateToISO(jsDate);
				}
				newItem.date = date;
			}
			
			var moreInfo = Scholar.Utilities.getNode(doc, elmt, ''./TD[2]/text()[2]'', nsResolver);
			if(moreInfo.nodeValue) {
				moreInfo = Scholar.Utilities.superCleanString(moreInfo.nodeValue);
				var parts = moreInfo.split(";\xA0");
				
				var issueRegexp = /^(\w+)\.(?: |\xA0)?(.+)$/
				var issueInfo = parts[0].split(",\xA0");
				for(j in issueInfo) {
					var m = issueRegexp.exec(issueInfo[j]);
					if(m) {
						var info = m[1].toLowerCase();
						if(info == "vol") {
							newItem.volume = Scholar.Utilities.superCleanString(m[2]);
						} else if(info == "iss" || info == "no") {
							newItem.issue = Scholar.Utilities.superCleanString(m[2]);
						}
					}
				}
				if(parts[1] && Scholar.Utilities.superCleanString(parts[1]).substring(0, 3).toLowerCase() == "pg.") {
					var re = /[0-9\-]+/;
					var m = re.exec(parts[1]);
					
					if(m) {
						newItem.pages = m[0];
					}
				}
			}
		} else if(field == "source type") {
			var value = Scholar.Utilities.getNode(doc, elmt, ''./TD[2]/text()[1]'', nsResolver);
			if(value.nodeValue) {
				value = Scholar.Utilities.superCleanString(value.nodeValue).toLowerCase();
				Scholar.Utilities.debugPrint(value);
				
				if(value.indexOf("periodical") >= 0) {
					newItem.itemType = "magazineArticle";
				} else if(value.indexOf("newspaper") >= 0) {
					newItem.itemType = "newspaperArticle";
				} else {	// TODO: support thesis
					newItem.itemType = "book";
				}
			}
		} else if(field == "isbn" || field == "issn" || field == "issn/isbn") {
			var value = Scholar.Utilities.getNode(doc, elmt, ''./TD[2]/text()[1]'', nsResolver);
			if(value) {
				var type;
				value = Scholar.Utilities.superCleanString(value.nodeValue);
				if(value.length == 10 || value.length == 13) {
					newItem.ISBN = value;
				} else if(value.length == 8) {
					newItem.ISSN = value;
				}
			}
		}
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	if(doc.title == "Results") {
		var items = new Object();
		
		// Require link to match this
		var tagRegexp = new RegExp();
		tagRegexp.compile(''^http://[^/]+/pqdweb\\?((?:.*&)?did=.*&Fmt=[12]|(?:.*&)Fmt=[12].*&did=)'');
		
		var tableRows = Scholar.Utilities.gatherElementsOnXPath(doc, doc, ''/html/body/table/tbody/tr/td/table/tbody/tr/td/table/tbody/tr[@class="rowUnMarked"]/td[3][@class="textMedium"]'', nsResolver);
		// Go through table rows
		for(var i=0; i<tableRows.length; i++) {
			var links = Scholar.Utilities.gatherElementsOnXPath(doc, tableRows[i], ''.//a'', nsResolver);
			// Go through links
			for(var j=0; j<links.length; j++) {
				if(tagRegexp.test(links[j].href)) {
					var text = Scholar.Utilities.getNode(doc, tableRows[i], ''./a[@class="bold"]/text()'', null);
					if(text && text.nodeValue) {
						text = Scholar.Utilities.cleanString(text.nodeValue);
						items[links[j].href] = text;
					}
					break;
				}
			}
		}
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			uris.push(i);
		}
		
		Scholar.Utilities.processDocuments(null, uris, function(browser) { scrape(browser.contentDocument) },
			function() { Scholar.done(); }, function() {});
		
		Scholar.wait();
	} else {
		var fmtCheck = /(?:\&|\?)Fmt=([0-9]+)/
		var m = fmtCheck.exec(doc.location.href);
		if(m && (m[1] == "1" || m[1] == "2")) {
			scrape(doc);
		} else if(m) {
			Scholar.Utilities.loadDocument(doc.location.href.replace("Fmt="+m[1], "Fmt=1"), function(browser) { scrape(browser.contentDocument); Scholar.done(); }, function() {});
			Scholar.wait();
		}
	}
}');

REPLACE INTO "translators" VALUES ('6773a9af-5375-3224-d148-d32793884dec', '2006-06-26 16:01:00', 4, 'InfoTrac Scraper', 'Simon Kornblith', '^http://infotrac-college\.thomsonlearning\.com/itw/infomark/',
'function detect(doc, url) {
	if(doc.title.substring(0, 8) == "Article ") {
		return "magazineArticle";
	} else doc.title.substring(0, 10) == "Citations ") {
		return "multiple";
	}
}',
'function extractCitation(uri, elmts, title) {
	var newItem = new Scholar.Item();
	newItem.source = uri;
	
	if(title) {
		newItem.title = Scholar.Utilities.superCleanString(title);
	}
	for (var i = 0; i < elmts.length; i++) {
		var elmt = elmts[i];
		var colon = elmt.nodeValue.indexOf(":");
		var field = elmt.nodeValue.substring(1, colon).toLowerCase();
		var value = elmt.nodeValue.substring(colon+1, elmt.nodeValue.length-1);
		if(field == "title") {
			newItem.title = Scholar.Utilities.superCleanString(value);
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
					if(match) {			// yup, it''s weird
						var finalPage = parseInt(match[1])+parseInt(match[2])
						parts[j] = "p"+match[1]+"-"+finalPage.toString();
					} else if(!type) {	// no, it''s normal
						// check to see if it''s numeric, bc newspaper pages aren''t
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
					
					if(parts[j] != "pNA") {		// make sure it''s not an invalid
												// page number
						// chop of letter
						newItem[field] = parts[j].substring(1);
					} else if(!type) {			// only newspapers are missing
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
			newItem.creators.push(Scholar.Utilities.cleanAuthor(value, "author", true));
		}
	}
	
	newItem.complete();
}

function doWeb(doc, url) {	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var uri = doc.location.href;
	if(doc.title.substring(0, 8) == "Article ") {	// article
		var xpath = ''/html/body//comment()'';
		var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
		extractCitation(uri, elmts);
	} else {										// search results
		var items = new Array();
		var uris = new Array();
		var tableRows = Scholar.Utilities.gatherElementsOnXPath(doc, doc, ''/html/body//table/tbody/tr/td[a/b]'', nsResolver);
		// Go through table rows
		for(var i=0; i<tableRows.length; i++) {
			var link = Scholar.Utilities.getNode(doc, tableRows[i], ''./a'', nsResolver);
			uris[i] = link.href;
			var article = Scholar.Utilities.getNode(doc, link, ''./b/text()'', nsResolver);
			items[i] = article.nodeValue;
			// Chop off final period
			if(items[i].substr(items[i].length-1) == ".") {
				items[i] = items[i].substr(0, items[i].length-1);
			}
		}
		
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, tableRows[i], ".//comment()", nsResolver);
			extractCitation(uris[i], elmts, items[i]);
		}
	}
}');

REPLACE INTO "translators" VALUES ('b047a13c-fe5c-6604-c997-bef15e502b09', '2006-06-26 16:01:00', 4, 'LexisNexis Scraper', 'Simon Kornblith', '^http://web\.lexis-nexis\.com/universe/(?:document|doclist)',
'function detect(doc, url) {
	var detailRe = new RegExp("^http://[^/]+/universe/document");
	if(detailRe.test(doc.location.href)) {
		return "newspaperArticle";
	} else {
		return "multiple";
	}
}',
'function scrape(doc) {
	var newItem = new Scholar.Item();
	newItem.source = doc.location.href;
	
	var citationDataDiv;
	var divs = doc.getElementsByTagName("div");
	for(var i=0; i<divs.length; i++) {
		if(divs[i].className == "bodytext") {
			citationDataDiv = divs[i];
			break;
		}
	}
	
	centerElements = citationDataDiv.getElementsByTagName("center");
	var elementParts = centerElements[0].innerHTML.split(/<br[^>]*>/gi);
	newItem.publicationTitle = elementParts[elementParts.length-1];
	
	var dateRegexp = /<br[^>]*>(?:<b>)?([A-Z][a-z]+)(?:<\/b>)? ([0-9]+, [0-9]{4})/;
	var m = dateRegexp.exec(centerElements[centerElements.length-1].innerHTML);
	if(m) {
		var jsDate = new Date(m[1]+" "+m[2]);
		newItem.date = Scholar.Utilities.dateToISO(jsDate);
	} else {
		var elementParts = centerElements[centerElements.length-1].innerHTML.split(/<br[^>]*>/gi);
		newItem.date = elementParts[1];
	}
	
	var cutIndex = citationDataDiv.innerHTML.indexOf("<b>BODY:</b>");
	if(cutIndex < 0) {
		cutIndex = citationDataDiv.innerHTML.indexOf("<b>TEXT:</b>");
	}
	if(cutIndex > 0) {
		citationData = citationDataDiv.innerHTML.substring(0, cutIndex);
	} else {
		citationData = citationDataDiv.innerHTML;
	}
	
	citationData = Scholar.Utilities.cleanTags(citationData);
	
	var headlineRegexp = /\n(?:HEADLINE|TITLE|ARTICLE): ([^\n]+)\n/;
	var m = headlineRegexp.exec(citationData);
	if(m) {
		newItem.title = Scholar.Utilities.cleanTags(m[1]);
	}
	
	var bylineRegexp = /\nBYLINE:  *(\w[\w\- ]+)/;
	var m = bylineRegexp.exec(citationData);
	if(m) {		// there is a byline; use it as an author
		if(m[1].substring(0, 3).toLowerCase() == "by ") {
			m[1] = m[1].substring(3);
		}
		newItem.creators.push(Scholar.Utilities.cleanAuthor(m[1], "author"));
		
		newItem.itemType = "newspaperArticle";
	} else {	// no byline; must be a journal
		newItem.itemType = "journalArticle";
	}
	
	// other ways authors could be encoded
	var authorRegexp = /\n(?:AUTHOR|NAME): ([^\n]+)\n/; 
	var m = authorRegexp.exec(citationData);
	if(m) {
		var authors = m[1].split(/, (?:and )?/);
		for(var i in authors) {
			newItem.creators.push(Scholar.Utilities.cleanAuthor(authors[i].replace(" *", ""), "author"));
		}
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var detailRe = new RegExp("^http://[^/]+/universe/document");
	if(detailRe.test(doc.location.href)) {
		scrape(doc);
	} else {
		var items = Scholar.Utilities.getItemArray(doc, doc, "^http://[^/]+/universe/document");
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			uris.push(i);
		}
		
		Scholar.Utilities.processDocuments(null, uris, function(browser) { scrape(browser.contentDocument) },
			function() { Scholar.done(); }, function() {});
		
		Scholar.wait();
	}
}');

REPLACE INTO "translators" VALUES ('cf87eca8-041d-b954-795a-2d86348999d5', '2006-06-26 16:01:00', 4, 'Aleph Scraper', 'Simon Kornblith', '^http://[^/]+/F(?:/[A-Z0-9\-]+(?:\?.*)?$|\?func=find)',
'function detect(doc, url) {
	var singleRe = new RegExp("^http://[^/]+/F/[A-Z0-9\-]+\?.*func=full-set-set.*\&format=[0-9]{3}");
	
	if(singleRe.test(doc.location.href)) {
		return "book";
	} else {
		var tags = doc.getElementsByTagName("a");
		for(var i=0; i<tags.length; i++) {
			if(singleRe.test(tags[i].href)) {
				return "multiple";
			}
		}
	}
}',
'function doWeb(doc, url) {
	var detailRe = new RegExp("^http://[^/]+/F/[A-Z0-9\-]+\?.*func=full-set-set.*\&format=[0-9]{3}");
	var uri = doc.location.href;
	var newUris = new Array();
	
	if(detailRe.test(uri)) {
	newUris.push(uri.replace(/\&format=[0-9]{3}/, "&format=001"))
	} else {
	var items = Scholar.Utilities.getItemArray(doc, doc, ''^http://[^/]+/F/[A-Z0-9\-]+\?.*func=full-set-set.*\&format=999'', ''^[0-9]+$'');
	
	// ugly hack to see if we have any items
	var haveItems = false;
	for(var i in items) {
		haveItems = true;
		break;
	}
	
	// If we don''t have any items otherwise, let us use the numbers
	if(!haveItems) {
		var items = Scholar.Utilities.getItemArray(doc, doc, ''^http://[^/]+/F/[A-Z0-9\-]+\?.*func=full-set-set.*\&format=999'');
	}
	
	items = Scholar.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	for(var i in items) {
		newUris.push(i.replace("&format=999", "&format=001"));
	}
	}
	
	var marc = Scholar.loadTranslator("import", "a6ee60df-1ddc-4aae-bb25-45e0537be973");
	Scholar.Utilities.processDocuments(null, newUris, function(newBrowser) {
		var newDoc = newBrowser.contentDocument;
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var xpath = ''/html/body/table/tbody/tr[td[1][@id="bold"]][td[2]]'';
		var elmts = Scholar.Utilities.gatherElementsOnXPath(newDoc, newDoc, xpath, nsResolver);
		
		var record = new marc.MARC_Record();
		for(var i=0; i<elmts.length; i++) {
			var elmt = elmts[i];
			var field = Scholar.Utilities.superCleanString(Scholar.Utilities.getNode(doc, elmt, ''./TD[1]/text()[1]'', nsResolver).nodeValue);
			var value = Scholar.Utilities.getNodeString(doc, elmt, ''./TD[2]//text()'', nsResolver);
			var value = value.replace(/\|([a-z]) /g, record.subfield_delimiter+"$1");
			
			if(field != "FMT" && field != "LDR") {
				var ind1 = "";
				var ind2 = "";
				var code = field.substring(0, 3);
				if(field.length > 3) {
					var ind1 = field.charAt(3);
					if(field.length > 4) {
						var ind2 = field.charAt(4);
					}
				}
				record.add_field(code, ind1, ind2, value);
			}
		}
		
		var newItem = new Scholar.Item();
		newItem.source = uri;
		record.translate(newItem);
		newItem.complete();
	}, function() { Scholar.done(); }, function() {});
	
	Scholar.wait();
}');

REPLACE INTO "translators" VALUES ('774d7dc2-3474-2684-392c-f787789ec63d', '2006-06-26 16:01:00', 4, 'Dynix Scraper', 'Simon Kornblith', 'ipac\.jsp\?.*(?:uri=full=[0-9]|menu=search)',
'function detect(doc, url) {
	var detailsRe = new RegExp(''ipac\.jsp\?.*uri=full=[0-9]'');
	if(detailsRe.test(doc.location.href)) {
		return "book";
	} else {
		return "multiple";
	}
}',
'function scrape(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var uri = doc.location.href;
	var detailsRe = new RegExp(''ipac\.jsp\?.*uri=full=[0-9]'');
	
	var uris = new Array();
	if(detailsRe.test(uri)) {
		uris.push(uri+''&fullmarc=true'');
	} else {
		var items = Scholar.Utilities.getItemArray(doc, doc, "ipac\.jsp\?.*uri=full=[0-9]|^javascript:buildNewList\\(''.*uri%3Dfull%3D[0-9]");
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var buildNewList = new RegExp("^javascript:buildNewList\\(''([^'']+)");
		
		var uris = new Array();
		for(var i in items) {
			var m = buildNewList.exec(i);
			if(m) {
				uris.push(unescape(m[1]+''&fullmarc=true''));
			} else {
				uris.push(i+''&fullmarc=true'');
			}
		}
	}
	
	var marc = Scholar.loadTranslator("import", "a6ee60df-1ddc-4aae-bb25-45e0537be973");
	
	Scholar.Utilities.processDocuments(null, uris, function(newBrowser) {
		var newDoc = newBrowser.contentDocument;
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var xpath = ''//form/table[@class="tableBackground"]/tbody/tr/td/table[@class="tableBackground"]/tbody/tr[td[1]/a[@class="normalBlackFont1"]]'';
		var elmts = Scholar.Utilities.gatherElementsOnXPath(newDoc, newDoc, xpath, nsResolver);
		
		var record = new marc.MARC_Record();		
		for(var i=0; i<elmts.length; i++) {
			var elmt = elmts[i];
			var field = Scholar.Utilities.superCleanString(Scholar.Utilities.getNode(newDoc, elmt, ''./TD[1]/A[1]/text()[1]'', nsResolver).nodeValue);
			var value = Scholar.Utilities.getNodeString(newDoc, elmt, ''./TD[2]/TABLE[1]/TBODY[1]/TR[1]/TD[1]/A[1]//text()'', nsResolver);
			value = value.replace(/\$([a-z]) /g, record.subfield_delimiter+"$1");
			
			if(field != "FMT" && field != "LDR") {
				var ind1 = "";
				var ind2 = "";
				var valRegexp = /^([0-9])([0-9])? (.*)$/;
				var m = valRegexp.exec(value);
				if(m) {
					ind1 = m[1];
					if(ind2) {
						ind2 = m[2]
					}
					value = m[3];
				}
				marc.add_field(field, ind1, ind2, value);
			}
		}
		
		var newItem = new Scholar.Item();
		newItem.source = uri;
		record.translate(newItem);
		newItem.complete();
	}, function() { Scholar.done() }, function() {});
	
	Scholar.wait();
}');

REPLACE INTO "translators" VALUES ('63a0a351-3131-18f4-21aa-f46b9ac51d87', '2006-06-26 16:01:00', 4, 'VTLS Scraper', 'Simon Kornblith', '/chameleon(?:\?|$)', 
'function detect(doc, url) {
	var node = Scholar.Utilities.getNode(doc, doc, ''//tr[@class="intrRow"]/td/table/tbody/tr[th]'', null);
	if(node) {
		return "multiple";
	}
	var node = Scholar.Utilities.getNode(doc, doc, ''//a[text()="marc"]'', null);
	if(node) {
		return "book";
	}
}',
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var uri = doc.location.href;
	var newUris = new Array();
	
	var marcs = Scholar.Utilities.gatherElementsOnXPath(doc, doc, ''//a[text()="marc"]'', nsResolver);
	
	if(marcs.length == 1) {
		newUris.push(marcs[0].href)
	} else {
		// Require link to match this
		var tagRegexp = new RegExp();
		tagRegexp.compile("/chameleon\?.*function=CARDSCR");
		
		var items = new Array();
		
		var tableRows = Scholar.Utilities.gatherElementsOnXPath(doc, doc, ''//tr[@class="intrRow"]'', nsResolver);
		// Go through table rows
		for(var i=0; i<tableRows.length; i++) {
			var links = Scholar.Utilities.gatherElementsOnXPath(doc, tableRows[i], ''.//a'', nsResolver);
			// Go through links
			var url;
			for(var j=0; j<links.length; j++) {
				if(tagRegexp.test(links[j].href)) {
					url = links[j].href;
					break;
				}
			}
			if(url) {
				// Collect title information
				var fields = Scholar.Utilities.gatherElementsOnXPath(doc, tableRows[i], ''./td/table/tbody/tr[th]'', nsResolver);
				for(var j=0; j<fields.length; j++) {
					var field = Scholar.Utilities.getNode(doc, fields[j], ''./th/text()'', nsResolver);
					if(field.nodeValue == "Title") {
						var value = Scholar.Utilities.getNodeString(doc, fields[j], ''./td//text()'', nsResolver);
						if(value) {
							items[url] = Scholar.Utilities.cleanString(value);
						}
					}
				}
			}
		}
		
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			Scholar.Utilities.debugPrint(i.replace(/function=[A-Z]{7}/, "function=MARCSCR"));
			newUris.push(i.replace(/function=[A-Z]{7}/, "function=MARCSCR"));
		}
	}
	
	var marc = Scholar.loadTranslator("import", "a6ee60df-1ddc-4aae-bb25-45e0537be973");
	
	Scholar.Utilities.processDocuments(null, newUris, function(newBrowser) {
		var newDoc = newBrowser.contentDocument;
		var uri = newDoc.location.href
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var xpath = ''//table[@class="outertable"]/tbody/tr[td[4]]'';
		var elmts = Scholar.Utilities.gatherElementsOnXPath(newDoc, newDoc, xpath, nsResolver);
		var record = new marc.MARC_Record();		
		for(var i=0; i<elmts.length; i++) {
			var elmt = elmts[i];
			var field = Scholar.Utilities.getNode(doc, elmt, ''./TD[1]/text()[1]'', nsResolver).nodeValue;
			var ind1 = Scholar.Utilities.getNode(doc, elmt, ''./TD[2]/text()[1]'', nsResolver).nodeValue;
			var ind2 = Scholar.Utilities.getNode(doc, elmt, ''./TD[3]/text()[1]'', nsResolver).nodeValue;
			var value = Scholar.Utilities.getNode(doc, elmt, ''./TD[4]/text()[1]'', nsResolver).nodeValue;
			value = value.replace(/\\([a-z]) /g, record.subfield_delimiter+"$1");
			
			record.add_field(field, ind1, ind2, value);
		}
		
		var newItem = new Scholar.Item();
		newItem.source = uri;
		record.translate(newItem);
		newItem.complete();
	}, function(){ Scholar.done(); }, function() {});
	
	Scholar.wait();
}');

REPLACE INTO "translators" VALUES ('fb12ae9e-f473-cab4-0546-27ab88c64101', '2006-06-26 16:01:00', 4, 'DRA Scraper', 'Simon Kornblith', '/web2/tramp2\.exe/(?:see\_record/|authority\_hits/|goto/.*\?.*screen=Record\.html)',
'function detect(doc, url) {
	if(doc.location.href.indexOf("/authority_hits") > 0) {
		return "multiple";
	} else {
		return "book";
	}
}',
'function doWeb(doc, url) {
	var checkItems = false;
	
	if(doc.location.href.indexOf("/authority_hits") > 0) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		checkItems = Scholar.Utilities.gatherElementsOnXPath(doc, doc, "/html/body//ol/li", nsResolver);
	}
	
	if(checkItems && checkItems.length) {
		var items = Scholar.Utilities.getItemArray(doc, checkItems, ''https?://.*/web2/tramp2\.exe/see_record'');
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			uris.push(i);
		}
	} else {
		var uris = new Array(doc.location.href);
	}
	
	for(var i in uris) {
		var uri = uris[i];
		var uriRegexp = /^(https?:\/\/.*\/web2\/tramp2\.exe\/)(?:goto|see\_record|authority\_hits)(\/.*)\?(?:screen=Record\.html\&)?(.*)$/i;
		var m = uriRegexp.exec(uri);
		if(uri.indexOf("/authority_hits") < 0) {
			var newUri = m[1]+"download_record"+m[2]+"/RECORD.MRC?format=marc&"+m[3];
		} else {
			var newUri = m[1]+"download_record"+m[2]+"/RECORD.MRC?format=marc";
		}
		
		// Keep track of how many requests have been completed
		var j = 0;
		
		var marc = Scholar.loadTranslator("import", "a6ee60df-1ddc-4aae-bb25-45e0537be973");
		
		Scholar.Utilities.HTTPUtilities.doGet(newUri, null, function(text) {
			var record = new marc.MARC_Record();
			record.load(text, "binary");
			
			var newItem = new Scholar.Item();
			newItem.source = uris[j];
			record.translate(record, newItem);
			newItem.complete();
			
			j++;
			if(j == uris.length) {
				Scholar.done();
			}
		});
	}
	Scholar.wait();
}');


REPLACE INTO "translators" VALUES ('c0e6fda6-0ecd-e4f4-39ca-37a4de436e15', '2006-06-26 16:01:00', 4, 'GEAC Scraper', 'Simon Kornblith', '/(?:GeacQUERY|(?:Geac)?FETCH[\:\?].*[&:]next=html/(?:record\.html|geacnffull\.html))',
'function detect(doc, url) {
	if(doc.location.href.indexOf("/GeacQUERY") > 0) {
		return "multiple";
	} else {
		return "book";
	}
}',
'function doWeb(doc, url) {
	var uri = doc.location.href;
	
	var uris = new Array();
	
	if(uri.indexOf("/GeacQUERY") > 0) {
		var items = Scholar.Utilities.getItemArray(doc, doc, "(?:Geac)?FETCH[\:\?].*[&:]next=html/(?:record\.html|geacnffull\.html)");
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			var newUri = i.replace(/([:&])next=html\/geacnffull.html/, "$1next=html/marc.html");
			newUri = newUri.replace(/([:&])next=html\/record.html/, "$1next=html/marc.html");
			uris.push(newUri);
		}
	} else {
		var newUri = uri.replace(/([:&])next=html\/geacnffull.html/, "$1next=html/marc.html");
		newUri = newUri.replace(/([:&])next=html\/record.html/, "$1next=html/marc.html");
		uris.push(newUri);
	}
	
	var marc = Scholar.loadTranslator("import", "a6ee60df-1ddc-4aae-bb25-45e0537be973");
	
	Scholar.Utilities.processDocuments(null, uris, function(newBrowser) {
		var newDoc = newBrowser.contentDocument;
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var record = new marc.MARC_Record();
		
		var elmts = Scholar.Utilities.gatherElementsOnXPath(newDoc, newDoc, ''//pre/text()'', nsResolver);
		var tag, ind1, ind2, content;
		
		for(var i=0; i<elmts.length; i++) {
			var line = elmts[i].nodeValue;
			
			if(line.substring(0, 6) == "       ") {
				content += " "+line.substring(6);
				continue;
			} else {
				if(tag) {
					record.add_field(tag, ind1, ind2, content);
				}
			}
			
			line = line.replace(/\xA0/g," "); // nbsp
			line = line.replace(/_/g," ");
			line = line.replace(/\t/g,"");
			
			tag = line.substring(0, 3);
			if(parseInt(tag) > 10) {
				ind1 = line.substring(4, 5);
				ind2 = line.substring(5, 6);
				content = line.substring(7);
				content = content.replace(/\$([a-z])(?: |$)/g, record.subfield_delimiter+"$1");
			} else {
				ind1 = "";
				ind2 = "";
				content = line.substring(4);
			}
			
		}
		
		var newItem = new Scholar.Item();
		newItem.source = uri;
		record.translate(newItem);
		newItem.complete();
	}, function() { Scholar.done(); }, function() {});
	
	Scholar.wait();
}');

REPLACE INTO "translators" VALUES ('5287d20c-8a13-6004-4dcb-5bb2b66a9cc9', '2006-06-26 16:01:00', 4, 'SIRSI -2003 Scraper', 'Simon Kornblith', '/uhtbin/cgisirsi',
'function detect(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, ''/html/body/form/p/text()[1]'', nsResolver);
	for(var i=0; i<elmts.length; i++) {
		if(Scholar.Utilities.superCleanString(elmts[i].nodeValue) == "Viewing record") {
			return "book";
		}
	}
	var xpath = ''//form[@name="hitlist"]/table/tbody/tr'';
	var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	if(elmts.length) {
		return "multiple";
	}
}',
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	// Cheap hack to convert HTML entities
	function unescapeHTML(text) {
		var div = doc.createElement("div");
		div.innerHTML = Scholar.Utilities.cleanTags(text);
		var text = div.childNodes[0] ? div.childNodes[0].nodeValue : null;
		delete div;
		return text;
	}
	
	var uri = doc.location.href;
	var recNumbers = new Array();
	
	var xpath = ''//form[@name="hitlist"]/table/tbody/tr'';
	var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	if(elmts.length) {	// Search results page
		var uriRegexp = /^http:\/\/[^\/]+/;
		var m = uriRegexp.exec(uri);
		var postAction = doc.forms.namedItem("hitlist").getAttribute("action");
		var newUri = m[0]+postAction.substr(0, postAction.length-1)+"40"
		
		var titleRe = /<br>\s*(.*[^\s])\s*<br>/i;
		
		var items = new Array();
		
		for(var i=0; i<elmts.length; i++) {
			var links = Scholar.Utilities.gatherElementsOnXPath(doc, elmts[i], ''.//a'', nsResolver);
			
			// Collect title
			var myTd = Scholar.Utilities.getNode(doc, elmts[i], "./td[2]", nsResolver);
			var m = titleRe.exec(myTd.innerHTML);
			var title = unescapeHTML(m[1]);
			
			items[i] = title;
		}
		
		
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			recNumbers.push(parseInt(i)+1);
		}
	} else {		// Normal page
		var uriRegexp = /^(.*)(\/[0-9]+)$/;
		var m = uriRegexp.exec(uri);
		var newUri = m[1]+"/40"
		
		var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, ''/html/body/form/p'', nsResolver);
		for(var i=0; i<elmts.length; i++) {
			var elmt = elmts[i];
			var initialText = Scholar.Utilities.getNode(doc, elmt, ''./text()[1]'', nsResolver);
			if(initialText && initialText.nodeValue && Scholar.Utilities.superCleanString(initialText.nodeValue) == "Viewing record") {
				recNumbers.push(Scholar.Utilities.getNode(doc, elmt, ''./b[1]/text()[1]'', nsResolver).nodeValue);
				break;
			}
		}
	}
	
	var marc = Scholar.loadTranslator("import", "a6ee60df-1ddc-4aae-bb25-45e0537be973");
	
	Scholar.Utilities.HTTPUtilities.doGet(newUri+''?marks=''+recNumbers.join(",")+''&shadow=NO&format=FLAT+ASCII&sort=TITLE&vopt_elst=ALL&library=ALL&display_rule=ASCENDING&duedate_code=l&holdcount_code=t&DOWNLOAD_x=22&DOWNLOAD_y=12&address=&form_type='', null, function(text) {
		var texts = text.split("<PRE>");
		texts = texts[1].split("</PRE>");
		text = unescapeHTML(texts[0]);
		var documents = text.split("*** DOCUMENT BOUNDARY ***");
		
		for(var j=1; j<documents.length; j++) {
			var uri = newUri+"?marks="+recNumbers[j]+"&shadow=NO&format=FLAT+ASCII&sort=TITLE&vopt_elst=ALL&library=ALL&display_rule=ASCENDING&duedate_code=l&holdcount_code=t&DOWNLOAD_x=22&DOWNLOAD_y=12&address=&form_type=";
			var lines = documents[j].split("\n");
			var record = new marc.MARC_Record();
			var tag, ind1, ind2, content;
			for(var i=0; i<lines.length; i++) {
				var line = lines[i];
				
				if(line.substr(0, 1) == "." && line.substr(4,2) == ". ") {
					if(tag) {
						content = content.replace(/\|([a-z])/g, record.subfield_delimiter+"$1");
						record.add_field(tag, ind1, ind2, content);
					}
				} else {
					content += " "+line.substring(6);
					continue;
				}
				
				tag = line.substr(1, 3);
				
				if(parseInt(tag) > 10) {
					ind1 = line.substr(6, 1);
					ind2 = line.substr(7, 1);
					content = line.substr(8);
				} else {
					ind1 = "";
					ind2 = "";
					content = line.substring(6);
				}
			}
			
			var newItem = new Scholar.Item();
			newItem.source = uri;
			record.translate(newItem);
			newItem.complete();
		}
		Scholar.done();
	});
	
	Scholar.wait();
}');

REPLACE INTO "translators" VALUES ('0f9fc2fc-306e-5204-1117-25bca009dffc', '2006-06-26 16:01:00', 4, 'TLC/YouSeeMore Scraper', 'Simon Kornblith', 'TLCScripts/interpac\.dll\?(?:.*LabelDisplay.*RecordNumber=[0-9]|Search|ItemTitles)',
'function detect(doc, url) {
	var detailRe = new RegExp("TLCScripts/interpac\.dll\?.*LabelDisplay.*RecordNumber=[0-9]");
	if(detailRe.test(doc.location.href)) {
		return "book";
	} else {
		return "multiple";
	}
}',
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var detailRe = new RegExp("TLCScripts/interpac\.dll\?.*LabelDisplay.*RecordNumber=[0-9]");
	var uri = doc.location.href;
	var newUris = new Array();
	
	if(detailRe.test(uri)) {
		newUris.push(uri.replace("LabelDisplay", "MARCDisplay"));
	} else {
		var items = Scholar.Utilities.getItemArray(doc, doc, ''TLCScripts/interpac\.dll\?.*LabelDisplay.*RecordNumber=[0-9]'');
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			newUris.push(i.replace("LabelDisplay", "MARCDisplay"));
		}
	}
	
	var marc = Scholar.loadTranslator("import", "a6ee60df-1ddc-4aae-bb25-45e0537be973");
	
	Scholar.Utilities.processDocuments(null, newUris, function(newBrowser) {
		var newDoc = newBrowser.contentDocument;
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var record = new marc.MARC_Record();
		
		var elmts = Scholar.Utilities.gatherElementsOnXPath(newDoc, newDoc, ''/html/body/table/tbody/tr[td[4]]'', nsResolver);
		var tag, ind1, ind2, content;
		
		for(var i=0; i<elmts.length; i++) {
			var elmt = elmts[i];
			
			tag = Scholar.Utilities.getNode(newDoc, elmt, ''./td[2]/tt[1]/text()[1]'', nsResolver).nodeValue;
			var inds = Scholar.Utilities.getNode(newDoc, elmt, ''./td[3]/tt[1]/text()[1]'', nsResolver).nodeValue;
			
			tag = tag.replace(/[\r\n]/g, "");
			if(tag.length == 1) {
				tag = "00"+tag;
			} else if(tag.length == 2) {
				tag = "0"+tag;
			}
			inds = inds.replace(/[\r\n]/g, "");
			
			// Get indicators, fix possible problems with &nbsp;s
			ind1 = inds.substr(0, 1);
			ind2 = inds.substr(1, 1);
			if(ind1 == "\xA0") {
				ind1 = "";
			}
			if(ind2 == "\xA0") {
				ind2 = "";
			}
			
			var children = Scholar.Utilities.gatherElementsOnXPath(newDoc, elmt, ''./td[4]/tt[1]//text()'', nsResolver);
			content = "";
			if(children.length == 1) {
				content = children[0].nodeValue;
			} else {
				for(var j=0; j<children.length; j+=2) {
					var subfield = children[j].nodeValue.substr(1, 1);
					var fieldContent = children[j+1].nodeValue;
					content += record.subfield_delimiter+subfield+fieldContent;
				}
			}
			
			record.add_field(tag, ind1, ind2, content);
		}
		
		var newItem = new Scholar.Item();
		newItem.source = uri;
		record.translate(newItem);
		newItem.complete();
	}, function() {Scholar.done(); }, function() {});
	
	Scholar.wait();
}');

REPLACE INTO "translators" VALUES ('c54d1932-73ce-dfd4-a943-109380e06574', '2006-06-26 16:01:00', 4, 'Project MUSE Scraper', 'Simon Kornblith', '^http://muse\.jhu\.edu/(?:journals/[^/]+/[^/]+/[^/]+\.html|search/pia.cgi)',
'function detect(doc, url) {
	var searchRe = new RegExp("^http://[^/]+/search/pia\.cgi");
	if(searchRe.test(url)) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}',
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var searchRe = new RegExp("^http://[^/]+/search/pia\.cgi");
	if(searchRe.test(doc.location.href)) {
		var items = new Array();
		var tableRows = Scholar.Utilities.gatherElementsOnXPath(doc, doc, ''/html/body/table[@class="navbar"]/tbody/tr/td/form/table'', nsResolver);
		// Go through table rows
		for(var i=0; i<tableRows.length; i++) {
			// article_id is what we need to get it all as one file
			var input = Scholar.Utilities.getNode(doc, tableRows[i], ''./tbody/tr/td/input[@name="article_id"]'', nsResolver);
			var link = Scholar.Utilities.getNode(doc, tableRows[i], ''.//b/i/a/text()'', nsResolver);
			if(input && input.value && link && link.nodeValue) {
				items[input.value] = link.nodeValue;
			}
		}
		
		items = Scholar.selectItems(items);
		if(!items) {
			return true;
		}
		
		try {
			var search_id = doc.forms.namedItem("results").elements.namedItem("search_id").value;
		} catch(e) {
			var search_id = "";
		}
		var articleString = "";
		for(var i in items) {
			articleString += "&article_id="+i;
		}
		var savePostString = "actiontype=save&search_id="+search_id+articleString;
		
		Scholar.Utilities.HTTPUtilities.doGet("http://muse.jhu.edu/search/save.cgi?"+savePostString, null, function() {
			Scholar.Utilities.HTTPUtilities.doGet("http://muse.jhu.edu/search/export.cgi?exporttype=endnote"+articleString, null, function(text) {
				// load translator for RIS
				var translator = Scholar.loadTranslator("import", "32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				// feed in data
				translator.Scholar.write(text);
				translator.Scholar.eof();
				// translate
				translator.doImport();
				Scholar.done();
			}, function() {});
		}, function() {});
		
		Scholar.wait();
	} else {
		var newItem = new Scholar.Item("journalArticle");
		newItem.source = url;
		
		var elmts = Scholar.Utilities.gatherElementsOnXPath(doc, doc, ''//comment()'', nsResolver);
		for(var i in elmts) {
			if(elmts[i].nodeValue.substr(0, 10) == "HeaderData") {
				var headerRegexp = /HeaderData((?:.|\n)*)\#\#EndHeaders/i
				var m = headerRegexp.exec(elmts[i].nodeValue);
				var headerData = m[1];
			}
		}
		
		// Use E4X rather than DOM/XPath, because the Mozilla gods have decided not to
		// expose DOM/XPath to sandboxed scripts
		var newDOM = new XML(headerData);
		
		function mapRDF(text, rdfUri) {
			if(text) {
				model.addStatement(uri, rdfUri, text, true);
			}
		}
		
		newItem.publicationTitle = newDOM.journal.text();
		newItem.volume = newDOM.volume.text();
		newItem.issue = newDOM.issue.text();
		newItem.year = newDOM.year.text();
		newItem.date = newDOM.pubdate.text();
		newItem.title = newDOM.doctitle.text();
		newItem.ISSN = newDOM.issn.text();
		
		// Do pages
		var fpage = newDOM.fpage.text();
		var lpage = newDOM.lpage.text();
		if(fpage != "") {
			newItem.pages = fpage;
			if(lpage) {
				newItem.pages += "-"+lpage;
			}
		}
		
		// Do authors
		var elmts = newDOM.docauthor;
		for(var i in elmts) {
			var fname = elmts[i].fname.text();
			var surname = elmts[i].surname.text();
			newItem.creators.push({firstName:fname, lastName:surname, creatorType:"author"});
		}
		
		newItem.complete();
	}
}');

REPLACE INTO "translators" VALUES ('fcf41bed-0cbc-3704-85c7-8062a0068a7a', '2006-06-26 16:01:00', 4, 'PubMed Scraper', 'Simon Kornblith', '^http://www\.ncbi\.nlm\.nih\.gov/entrez/query\.fcgi\?(?:.*db=PubMed.*list_uids=[0-9]|.*list_uids=[0-9].*db=PubMed|.*db=PubMed.*CMD=search|.*CMD=search.*db=PubMed)',
'function detect(doc, url) {
	if(doc.location.href.indexOf("list_uids=") >= 0) {
		return "journalArticle";
	} else {
		return "multiple";
	}
}',
'function doWeb(doc, url) {
	var uri = doc.location.href;
	var ids = new Array();
	var idRegexp = /[\?\&]list_uids=([0-9\,]+)/;
	
	var m = idRegexp.exec(uri);
	if(m) {
		ids.push(m[1]);
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var items = new Array();
		var tableRows = Scholar.Utilities.gatherElementsOnXPath(doc, doc, ''//div[@class="ResultSet"]/table/tbody'', nsResolver);
		// Go through table rows
		for(var i=0; i<tableRows.length; i++) {
			var link = Scholar.Utilities.getNode(doc, tableRows[i], ''.//a'', nsResolver);
			var article = Scholar.Utilities.getNode(doc, tableRows[i], ''./tr[2]/td[2]/text()[1]'', nsResolver);
			items[link.href] = article.nodeValue;
		}
		
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			var m = idRegexp.exec(i);
			ids.push(m[1]);
		}
	}
	
	var newUri = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=PubMed&retmode=xml&rettype=citation&id="+ids.join(",");
	Scholar.Utilities.HTTPUtilities.doGet(newUri, null, function(text) {
		// Remove xml parse instruction and doctype
		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");
		
		var xml = new XML(text);
		
		for(var i=0; i<xml.PubmedArticle.length(); i++) {
			var newItem = new Scholar.Item("journalArticle");
			
			var citation = xml.PubmedArticle[i].MedlineCitation;
			
			newItem.source = "http://www.ncbi.nlm.nih.gov/entrez/query.fcgi?db=pubmed&cmd=Retrieve&list_uids="+citation.PMID.text();
			// TODO: store PMID directly
			
			var article = citation.Article;
			if(article.ArticleTitle.length()) {
				var title = article.ArticleTitle.text().toString();
				if(title.substr(-1) == ".") {
					title = title.substring(0, title.length-1);
				}
				newItem.title = title;
			}
			
			if(article.Journal.length()) {
				var issn = article.Journal.ISSN.text();
				if(issn) {
					newItem.ISSN = issn.replace(/[^0-9]/g, "");
				}
				
				if(article.Journal.Title.length()) {
					newItem.publicationTitle = Scholar.Utilities.superCleanString(article.Journal.Title.text().toString());
				} else if(citation.MedlineJournalInfo.MedlineTA.length()) {
					newItem.publicationTitle = Scholar.Utilities.superCleanString(citation.MedlineJournalInfo.MedlineTA.text().toString());
				}
				
				if(article.Journal.JournalIssue.length()) {
					newItem.volume = article.Journal.JournalIssue.Volume.text();
					newItem.issue = article.Journal.JournalIssue.Issue.text();
					if(article.Journal.JournalIssue.PubDate.length()) {	// try to get the date
						if(article.Journal.JournalIssue.PubDate.Day.text().toString() != "") {
							var date = article.Journal.JournalIssue.PubDate.Month.text()+" "+article.Journal.JournalIssue.PubDate.Day.text()+", "+article.Journal.JournalIssue.PubDate.Year.text();
							var jsDate = new Date(date);
							if(!isNaN(jsDate.valueOf())) {
								date = Scholar.Utilities.dateToISO(jsDate);
							}
						} else if(article.Journal.JournalIssue.PubDate.Month.text().toString() != "") {
							var date = article.Journal.JournalIssue.PubDate.Month.text()+" "+article.Journal.JournalIssue.PubDate.Year.text();
						} else if(article.Journal.JournalIssue.PubDate.Year.text().toString() != "") {
							var date = article.Journal.JournalIssue.PubDate.Year.text();
						}
						
						if(date) {
							newItem.date = date;
						}
					}
				}
			}
			
			if(article.AuthorList.length() && article.AuthorList.Author.length()) {
				var authors = article.AuthorList.Author;
				for(var j=0; j<authors.length(); j++) {
					var lastName = authors[j].LastName.text().toString();
					var firstName = authors[j].FirstName.text().toString();
					if(firstName == "") {
						var firstName = authors[j].ForeName.text().toString();
					}
					if(firstName || lastName) {
						newItem.creators.push({lastName:lastName, firstName:firstName});
					}
				}
			}
			
			newItem.complete();
		}
	
		Scholar.done();
	})
	
	Scholar.wait();
}');

REPLACE INTO "translators" VALUES ('951c027d-74ac-47d4-a107-9c3069ab7b48', '2006-06-26 16:41:00', 4, 'Embedded RDF Scraper', 'Simon Kornblith', NULL,
'function detect(doc, url) {
	var metaTags = doc.getElementsByTagName("meta");
	
	for(var i=0; i<metaTags.length; i++) {
		var tag = metaTags[i].getAttribute("name");
		if(tag && tag.substr(0, 3).toLowerCase() == "dc.") {
			return "website";
		}
	}
	
	return false;
}',
'function doWeb(doc, url) {
	var dc = "http://purl.org/dc/elements/1.1/";

	// load RDF translator
	var translator = Scholar.loadTranslator("import", "5e3ad958-ac79-463d-812b-a86a9235c28f");
	
	var metaTags = doc.getElementsByTagName("meta");
	var foundTitle = false;		// We can use the page title if necessary
	for(var i=0; i<metaTags.length; i++) {
		var tag = metaTags[i].getAttribute("name");
		var value = metaTags[i].getAttribute("content");
		if(tag && value && tag.substr(0, 3).toLowerCase() == "dc.") {
			if(tag == "dc.title") {
				foundTitle = true;
			}
			translator.Scholar.RDF.addStatement(url, dc + tag.substr(3), value, true);
			Scholar.Utilities.debugPrint(tag.substr(3) + " = " + value);
		} else if(tag && value && (tag == "author" || tag == "author-personal")) {
			translator.Scholar.RDF.addStatement(url, dc + "creator", value, true);
		} else if(tag && value && tag == "author-corporate") {
			translator.Scholar.RDF.addStatement(url, dc + "creator", value, true);
		}
	}
	
	if(!foundTitle) {
		translator.Scholar.RDF.addStatement(url, dc + "title", doc.title, true);
	}
	
	translator.doImport();
}');

REPLACE INTO "translators" VALUES ('05d07af9-105a-4572-99f6-a8e231c0daef', '2006-08-07 01:09:00', 4, 'COinS Scraper', 'Simon Kornblith', NULL,
'function detect(doc, url) {
	var spanTags = doc.getElementsByTagName("span");
	
	var encounteredType = false;
	
	for(var i=0; i<spanTags.length; i++) {
		var spanClass = spanTags[i].getAttribute("class");
		if(spanClass) {
			var spanClasses = spanClass.split(" ");
			if(Scholar.Utilities.inArray("Z3988", spanClasses)) {
				var spanTitle = spanTags[i].getAttribute("title");
				
				// determine if it''s a valid type
				var coParts = spanTitle.split("&");
				var type = null
				for(var i in coParts) {
					if(coParts[i].substr(0, 12) == "rft_val_fmt=") {
						var format = unescape(coParts[i].substr(12));
						if(format == "info:ofi/fmt:kev:mtx:journal") {
							var type = "journal";
						} else if(format == "info:ofi/fmt:kev:mtx:book") {
							if(Scholar.Utilities.inArray("rft.genre=bookitem", coParts)) {
								var type = "bookSection";
							} else {
								var type = "book";
							}
							break;
						}
					}
				}
				
				if(type) {
					if(encounteredType) {
						return "multiple";
					} else {
						encounteredType = type;
					}
				}
			}
		}
	}
	
	return encounteredType;
}',
'// used to retrieve next COinS object when asynchronously parsing COinS objects
// on a page
function retrieveNextCOinS(needFullItems, newItems) {
	if(needFullItems.length) {
		var item = needFullItems.shift();
		
		Scholar.Utilities.debugPrint("looking up contextObject");
		Scholar.Utilities.lookupContextObject(item.contextObject, function(items) {
			Scholar.Utilities.debugPrint(items);
			if(items) {
				newItems = newItems.concat(items);
			}
			retrieveNextCOinS(needFullItems, newItems);
		}, function() {
			Scholar.done(false);
		});
	} else {
		completeCOinS(newItems);
		Scholar.done(true);
	}
}

// attaches item data to a new Scholar.Item instance (because data returned from
// Scholar.OpenURL.processContextObject does not have a complete() method)
function addAsItem(itemArray) {
	var newItem = new Scholar.Item();
	for(var i in itemArray) {
		newItem[i] = itemArray[i];
	}
	newItem.complete();
}

// saves all COinS objects
function completeCOinS(newItems) {
	if(newItems.length > 1) {
		var selectArray = new Array();
		
		for(var i in newItems) {
			selectArray[i] = newItems.title;
		}
		selectArray = Scholar.selectItems(selectArray);
		for(var i in selectArray) {
			addAsItem(newItems[i]);
		}
	} else if(newItems.length) {
		addAsItem(newItems[0]);
	}
}

function doWeb(doc, url) {
	var newItems = new Array();
	var needFullItems = new Array();
	
	var spanTags = doc.getElementsByTagName("span");
	
	for(var i=0; i<spanTags.length; i++) {
		var spanClass = spanTags[i].getAttribute("class");
		if(spanClass) {
			var spanClasses = spanClass.split(" ");
			if(Scholar.Utilities.inArray("Z3988", spanClasses)) {
				var spanTitle = spanTags[i].getAttribute("title");
				var newItem = Scholar.Utilities.parseContextObject(spanTitle);
				if(newItem) {
					if(newItem.title && newItem.creators.length) {
						// title and creators are minimum data to avoid looking up
						newItems.push(newItem);
					} else {
						// retrieve full item
						newItem.contextObject = spanTitle;
						needFullItems.push(newItem);
					}
				}
			}
		}
	}
	
	if(needFullItems.length) {
		// retrieve full items asynchronously
		Scholar.wait();
		retrieveNextCOinS(needFullItems, newItems);
	} else {
		completeCOinS(newItems);
	}
}');

REPLACE INTO "translators" VALUES ('3e684d82-73a3-9a34-095f-19b112d88bbf', '2006-06-26 16:01:00', 4, 'Google Books Scraper', 'Simon Kornblith', '^http://books\.google\.com/books\?(.*vid=.*\&id=.*|.*q=.*)',
'function detect(doc, url) {
	var re = new RegExp(''^http://books\\.google\\.com/books\\?vid=([^&]+).*\\&id=([^&]+)'', ''i'');
	if(re.test(doc.location.href)) {
		return "book";
	} else {
		return "multiple";
	}
}',
'function doWeb(doc, url) {
	var uri = doc.location.href;
	var newUris = new Array();
	
	var re = new RegExp(''^http://books\\.google\\.com/books\\?vid=([^&]+).*\\&id=([^&]+)'', ''i'');
	var m = re.exec(uri);
	if(m) {
		newUris.push(''http://books.google.com/books?vid=''+m[1]+''&id=''+m[2]);
	} else {
		var items = Scholar.Utilities.getItemArray(doc, doc, ''http://books\\.google\\.com/books\\?vid=([^&]+).*\\&id=([^&]+)'', ''^(?:All matching pages|About this Book|Table of Contents|Index)'');
	
		// Drop " - Page" thing
		for(var i in items) {
			items[i] = items[i].replace(/- Page [0-9]+\s*$/, "");
		}
		items = Scholar.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			var m = re.exec(i);
			newUris.push(''http://books.google.com/books?vid=''+m[1]+''&id=''+m[2]);
		}
	}
	
	Scholar.Utilities.processDocuments(null, newUris, function(newBrowser) {
		var newDoc = newBrowser.contentDocument;
		var newItem = new Scholar.Item("book");
		newItem.source = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var xpath = ''//table[@id="bib"]/tbody/tr'';
		var elmts = Scholar.Utilities.gatherElementsOnXPath(newDoc, newDoc, xpath, nsResolver);
		for(var i = 0; i<elmts.length; i++) {
			var field = Scholar.Utilities.getNode(newDoc, elmts[i], ''./td[1]//text()'', nsResolver);
			var value = Scholar.Utilities.getNode(newDoc, elmts[i], ''./td[2]//text()'', nsResolver);
			
			if(field && value) {
				field = Scholar.Utilities.superCleanString(field.nodeValue);
				value = Scholar.Utilities.cleanString(value.nodeValue);
				if(field == "Title") {
					newItem.title = value;
				} else if(field == "Author(s)") {
					var authors = value.split(", ");
					for(j in authors) {
						newItem.creators.push(Scholar.Utilities.cleanAuthor(authors[j], "author"));
					}
				} else if(field == "Editor(s)") {
					var authors = value.split(", ");
					for(j in authors) {
						newItem.creators.push(Scholar.Utilities.cleanAuthor(authors[j], "editor"));
					}
				} else if(field == "Publisher") {
					newItem.publisher = value;
				} else if(field == "Publication Date") {
					var date = value;
					
					jsDate = new Date(value);
					if(!isNaN(jsDate.valueOf())) {
						date = Scholar.Utilities.dateToISO(jsDate);
					}
					
					newItem.date = date;
				/*} else if(field == "Format") {
					.addStatement(uri, prefixDC + ''medium'', value);*/
				} else if(field == "ISBN") {
					newItem.ISBN = value;
				}
			}
		}
		newItem.complete();
	}, function() { Scholar.done(); }, function() {});
	
	Scholar.wait();
}');

REPLACE INTO "translators" VALUES ('0e2235e7-babf-413c-9acf-f27cce5f059c', '2006-07-05 23:40:00', 3, 'MODS (XML)', 'Simon Kornblith', 'xml',
'Scholar.addOption("exportNotes", true);
Scholar.addOption("exportFileData", true);',
'var partialItemTypes = ["bookSection", "journalArticle", "magazineArticle", "newspaperArticle"];

function doExport() {
	var modsCollection = <modsCollection xmlns="http://www.loc.gov/mods/v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.loc.gov/mods/v3 http://www.loc.gov/standards/mods/v3/mods-3-2.xsd" />;
	
	var item;
	while(item = Scholar.nextItem()) {
		var isPartialItem = Scholar.Utilities.inArray(item.itemType, partialItemTypes);
		
		var mods = <mods />;
		
		/** CORE FIELDS **/
		
		// XML tag titleInfo; object field title
		if(item.title) {
			mods.titleInfo.title = item.title;
		}
		
		// XML tag typeOfResource/genre; object field type
		var modsType, marcGenre;
		if(item.itemType == "book" || item.itemType == "bookSection") {
			modsType = "text";
			marcGenre = "book";
		} else if(item.itemType == "journalArticle" || item.itemType == "magazineArticle") {
			modsType = "text";
			marcGenre = "periodical";
		} else if(item.itemType == "newspaperArticle") {
			modsType = "text";
			marcGenre = "newspaper";
		} else if(item.itemType == "thesis") {
			modsType = "text";
			marcGenre = "theses";
		} else if(item.itemType == "letter") {
			modsType = "text";
			marcGenre = "letter";
		} else if(item.itemType == "manuscript") {
			modsType = "text";
			modsType.@manuscript = "yes";
		} else if(item.itemType == "interview") {
			modsType = "text";
			marcGenre = "interview";
		} else if(item.itemType == "film") {
			modsType = "moving image";
			marcGenre = "motion picture";
		} else if(item.itemType == "artwork") {
			modsType = "still image";
			marcGenre = "art original";
		} else if(item.itemType == "website") {
			modsType = "multimedia";
			marcGenre = "web site";
		} else if(item.itemType == "note") {
			continue;
		}
		mods.typeOfResource = modsType;
		mods.genre += <genre authority="local">{item.itemType}</genre>;
		if(marcGenre) {
			mods.genre += <genre authority="marcgt">{marcGenre}</genre>;
		}
		
		// XML tag genre; object field thesisType, type
		if(item.thesisType) {
			mods.genre += <genre>{item.thesisType}</genre>;
		}
		if(item.type) {
			mods.genre += <genre>{item.type}</genre>;
		}
		
		// XML tag name; object field creators
		for(var j in item.creators) {
			var roleTerm = "";
			if(item.creators[j].creatorType == "author") {
				roleTerm = "aut";
			} else if(item.creators[j].creatorType == "editor") {
				roleTerm = "edt";
			} else if(item.creators[j].creatorType == "creator") {
				roleTerm = "ctb";
			}
			
			// FIXME - currently all names are personal
			mods.name += <name type="personal">
				<namePart type="family">{item.creators[j].lastName}</namePart>
				<namePart type="given">{item.creators[j].firstName}</namePart>
				<role><roleTerm type="code" authority="marcrelator">{roleTerm}</roleTerm></role>
				</name>;
		}
		
		// XML tag recordInfo.recordOrigin; used to store our generator note
		//mods.recordInfo.recordOrigin = "Scholar for Firefox "+Scholar.Utilities.getVersion();
		
		/** FIELDS ON NEARLY EVERYTHING BUT NOT A PART OF THE CORE **/
		
		// XML tag recordInfo.recordContentSource; object field source
		if(item.source) {
			mods.recordInfo.recordContentSource = item.source;
		}
		// XML tag recordInfo.recordIdentifier; object field accessionNumber
		if(item.accessionNumber) {
			mods.recordInfo.recordIdentifier = item.accessionNumber;
		}
		
		// XML tag accessCondition; object field rights
		if(item.rights) {
			mods.accessCondition = item.rights;
		}
		
		/** SUPPLEMENTAL FIELDS **/
		
		// XML tag relatedItem.titleInfo; object field series
		if(item.seriesTitle) {
			var series = <relatedItem type="series">
					<titleInfo><title>{item.seriesTitle}</title></titleInfo>
					</relatedItem>;
			
			if(item.itemType == "bookSection") {
				// For a book section, series info must go inside host tag
				mods.relatedItem.relatedItem = series;
			} else {
				mods.relatedItem += series;
			}
		}
		
		// Make part its own tag so we can figure out where it goes later
		var part = new XML();
		
		// XML tag detail; object field volume
		if(item.volume) {
			if(Scholar.Utilities.isInt(item.volume)) {
				part += <detail type="volume"><number>{item.volume}</number></detail>;
			} else {
				part += <detail type="volume"><text>{item.volume}</text></detail>;
			}
		}
		
		// XML tag detail; object field number
		if(item.issue) {
			if(Scholar.Utilities.isInt(item.issue)) {
				part += <detail type="issue"><number>{item.issue}</number></detail>;
			} else {
				part += <detail type="issue"><text>{item.issue}</text></detail>;
			}
		}
		
		// XML tag detail; object field section
		if(item.section) {
			if(Scholar.Utilities.isInt(item.section)) {
				part += <detail type="section"><number>{item.section}</number></detail>;
			} else {
				part += <detail type="section"><text>{item.section}</text></detail>;
			}
		}
		
		// XML tag detail; object field pages
		if(item.pages) {
			var range = Scholar.Utilities.getPageRange(item.pages);
			part += <extent unit="pages"><start>{range[0]}</start><end>{range[1]}</end></extent>;
		}
		
		// Assign part if something was assigned
		if(part.length() != 1) {
			if(isPartialItem) {
				// For a journal article, bookSection, etc., the part is the host
				mods.relatedItem.part += <part>{part}</part>;
			} else {
				mods.part += <part>{part}</part>;
			}
		}
		
		// XML tag originInfo; object fields edition, place, publisher, year, date
		var originInfo = new XML();
		if(item.edition) {
			originInfo += <edition>{item.edition}</edition>;
		}
		if(item.place) {
			originInfo += <place><placeTerm type="text">{item.place}</placeTerm></place>;
		}
		if(item.publisher) {
			originInfo += <publisher>{item.publisher}</publisher>;
		} else if(item.distributor) {
			originInfo += <publisher>{item.distributor}</publisher>;
		}
		if(item.year) {
			// Assume year is copyright date
			originInfo += <copyrightDate encoding="iso8601">{item.year}</copyrightDate>;
		}
		if(item.date) {
			if(inArray(item.itemType, ["magazineArticle", "newspaperArticle"])) {
				// Assume date is date issued
				var dateType = "dateIssued";
			} else {
				// Assume date is date created
				var dateType = "dateCreated";
			}
			originInfo += <{dateType} encoding="iso8601">{item.date}</{dateType}>;
		}
		if(item.lastModified) {
			originInfo += <dateModified encoding="iso8601">{item.lastModified}</dateModified>;
		}
		if(item.accessDate) {
			originInfo += <dateCaptured encoding="iso8601">{item.accessDate}</dateCaptured>;
		}
		if(originInfo.length() != 1) {
			if(isPartialItem) {
				// For a journal article, bookSection, etc., this goes under the host
				mods.relatedItem.originInfo += <originInfo>{originInfo}</originInfo>;
			} else {
				mods.originInfo += <originInfo>{originInfo}</originInfo>;
			}
		}
		
		// XML tag identifier; object fields ISBN, ISSN
		if(isPartialItem) {
			var identifier = mods.relatedItem;
		} else {
			var identifier = mods;
		}
		if(item.ISBN) {
			identifier.identifier += <identifier type="isbn">{item.ISBN}</identifier>;
		}
		if(item.ISSN) {
			identifier.identifier += <identifier type="issn">{item.ISSN}</identifier>;
		}
		if(item.DOI) {
			identifier.identifier += <identifier type="doi">{item.DOI}</identifier>;
		}
		
		// XML tag relatedItem.titleInfo; object field publication
		if(item.publicationTitle) {
			mods.relatedItem.titleInfo += <titleInfo><title>{item.publicationTitle}</title></titleInfo>;
		}
		
		// XML tag classification; object field callNumber
		if(item.callNumber) {
			mods.classification = item.callNumber;
		}
		
		// XML tag location.physicalLocation; object field archiveLocation
		if(item.archiveLocation) {
			mods.location.physicalLocation = item.archiveLocation;
		}
		
		// XML tag location.url; object field archiveLocation
		if(item.url) {
			mods.location.url = item.url;
		}
		
		// XML tag title.titleInfo; object field journalAbbreviation
		if(item.journalAbbreviation) {
			mods.relatedItem.titleInfo += <titleInfo type="abbreviated"><title>{item.journalAbbreviation}</title></titleInfo>;
		}
		
		if(mods.relatedItem.length() == 1 && isPartialItem) {
			mods.relatedItem.@type = "host";
		}
		
		/** NOTES **/
		
		for(var j in item.notes) {
			// Add note tag
			var note = <note type="content">{item.notes[j].note}</note>;
			mods.note += note;
		}
		
		/** TAGS **/
		
		for(var j in item.tags) {
			mods.subject += <subject>{item.tags[j]}</subject>;
		}
		
		modsCollection.mods += mods;
	}
	
	Scholar.write(''<?xml version="1.0"?>''+"\n");
	Scholar.write(modsCollection.toXMLString());
}

function doImport() {
	var text = "";
	var read;
	
	// read in 16384 byte increments
	while(read = Scholar.read(16384)) {
		text += read;
	}
	Scholar.Utilities.debugPrint("read in");
	
	// eliminate <?xml ?> heading so we can parse as XML
	text = text.replace(/<\?xml[^?]+\?>/, "");
	
	// parse with E4X
	var m = new Namespace("http://www.loc.gov/mods/v3");
	// why does this default namespace declaration not work!?
	default xml namespace = m;
	var xml = new XML(text);
	
	for each(var mods in xml.m::mods) {
		Scholar.Utilities.debugPrint("item is: ");
		for(var i in mods) {
			Scholar.Utilities.debugPrint(i+" = "+mods[i].toString());
		}
		
		var newItem = new Scholar.Item();
		
		// title
		newItem.title = mods.m::titleInfo.(m::title.@type!="abbreviated").m::title;
		
		// try to get genre from local genre
		var localGenre = mods.m::genre.(@authority=="local").text().toString();
		if(localGenre && Scholar.Utilities.itemTypeExists(localGenre)) {
			newItem.itemType = localGenre;
		} else {
			// otherwise, look at the marc genre
			var marcGenre = mods.m::genre.(@authority=="marcgt").text().toString();
			if(marcGenre) {
				if(marcGenre == "book") {
					newItem.itemType = "book";
				} else if(marcGenre == "periodical") {
					newItem.itemType = "magazineArticle";
				} else if(marcGenre == "newspaper") {
					newItem.itemType = "newspaperArticle";
				} else if(marcGenre == "theses") {
					newItem.itemType = "thesis";
				} else if(marcGenre == "letter") {
					newItem.itemType = "letter";
				} else if(marcGenre == "interview") {
					newItem.itemType = "interview";
				} else if(marcGenre == "motion picture") {
					newItem.itemType = "film";
				} else if(marcGenre == "art original") {
					newItem.itemType = "artwork";
				} else if(marcGenre == "web site") {
					newItem.itemType = "website";
				}
			}
			
			if(!newItem.itemType) {
				newItem.itemType = "book";
			}
		}
		
		var isPartialItem = Scholar.Utilities.inArray(newItem.itemType, partialItemTypes);
		
		// TODO: thesisType, type
		
		for each(var name in mods.m::name) {
			// TODO: institutional authors
			var creator = new Array();
			creator.firstName = name.m::namePart.(@type=="given").text().toString();
			creator.lastName = name.m::namePart.(@type=="family").text().toString();
			
			// look for roles
			var role = name.m::role.m::roleTerm.(@type=="code").(@authority=="marcrelator").text().toString();
			if(role == "edt") {
				creator.creatorType = "editor";
			} else if(role == "ctb") {
				creator.creatorType = "contributor";
			} else {
				creator.creatorType = "author";
			}
			
			newItem.creators.push(creator);
		}
		
		// source
		newItem.source = mods.m::recordInfo.m::recordContentSource.text().toString();
		// accessionNumber
		newItem.accessionNumber = mods.m::recordInfo.m::recordIdentifier.text().toString();
		// rights
		newItem.rights = mods.m::accessCondition.text().toString();
		
		/** SUPPLEMENTAL FIELDS **/
		
		// series
		if(newItem.itemType == "bookSection") {
			newItem.seriesTitle = mods.m::relatedItem.(@type=="host").m::relatedItem.(@type=="series").m::titleInfo.m::title.text().toString();
		} else {
			newItem.seriesTitle = mods.m::relatedItem.(@type=="series").m::titleInfo.m::title.text().toString();
		}
		
		// get part
		if(isPartialItem) {
			var part = mods.m::relatedItem.m::part;
			var originInfo = mods.m::relatedItem.m::originInfo;
			var identifier = mods.m::relatedItem.m::identifier;
		} else {
			var part = mods.m::part;
			var originInfo = mods.m::originInfo;
			var identifier = mods.m::identifier;
		}
		
		// volume
		newItem.volume = part.m::detail.(@type=="volume").m::number.text().toString();
		if(!newItem.volume) {
			newItem.volume = part.m::detail.(@type=="volume").m::text.text().toString();
		}
		
		// number
		newItem.issue = part.m::detail.(@type=="issue").m::number.text().toString();
		if(!newItem.issue) {
			newItem.issue = part.m::detail.(@type=="issue").m::text.text().toString();
		}
		
		// section
		newItem.section = part.m::detail.(@type=="section").m::number.text().toString();
		if(!newItem.section) {
			newItem.section = part.m::detail.(@type=="section").m::text.text().toString();
		}
		
		// pages
		var pagesStart = part.m::extent.(@unit=="pages").m::start.text().toString();
		var pagesEnd = part.m::extent.(@unit=="pages").m::end.text().toString();
		if(pagesStart || pagesEnd) {
			if(pagesStart && pagesEnd && pagesStart != pagesEnd) {
				newItem.pages = pagesStart+"-"+pagesEnd;
			} else {
				newItem.pages = pagesStart+pagesEnd;
			}
		}
		
		// edition
		newItem.edition = originInfo.m::edition.text().toString();
		// place
		newItem.place = originInfo.m::place.m::placeTerm.text().toString();
		// publisher/distributor
		newItem.publisher = newItem.distributor = originInfo.m::publisher.text().toString();
		// date
		newItem.date = originInfo.m::copyrightDate.text().toString();
		if(!newItem.date) {
			newItem.date = originInfo.m::dateIssued.text().toString();
			if(!newItem.date) {
				newItem.date = originInfo.dateCreated.text().toString();
			}
		}
		// lastModified
		newItem.lastModified = originInfo.m::dateModified.text().toString();
		// accessDate
		newItem.accessDate = originInfo.m::dateCaptured.text().toString();
		// ISBN
		newItem.ISBN = identifier.(@type=="isbn").text().toString()
		// ISSN
		newItem.ISSN = identifier.(@type=="issn").text().toString()
		// DOI
		newItem.DOI = identifier.(@type=="doi").text().toString()
		// publication
		newItem.publicationTitle = mods.m::relatedItem.m::publication.text().toString();
		// call number
		newItem.callNumber = mods.m::classification.text().toString();
		// archiveLocation
		newItem.archiveLocation = mods.m::location.m::physicalLocation.text().toString();
		// url
		newItem.url = mods.m::location.m::url.text().toString();
		// journalAbbreviation
		newItem.journalAbbreviation = mods.m::relatedItem.(m::titleInfo.@type=="abbreviated").m::titleInfo.m::title.text().toString();
		
		/** NOTES **/
		for each(var note in mods.m::note) {
			newItem.notes.push({note:note.text().toString()});
		}
		
		/** TAGS **/
		for each(var subject in mods.m::subject) {
			newItem.tags.push(subject.text().toString());
		}
		
		newItem.complete();
	}
}');

REPLACE INTO "translators" VALUES ('14763d24-8ba0-45df-8f52-b8d1108e7ac9', '2006-07-07 12:44:00', 2, 'Biblio/DC/FOAF/PRISM/VCard (RDF/XML)', 'Simon Kornblith', 'rdf',
'Scholar.configure("getCollections", true);
Scholar.configure("dataMode", "rdf");
Scholar.addOption("exportNotes", true);
Scholar.addOption("exportFileData", true);',
'function generateSeeAlso(resource, seeAlso) {
	for(var i in seeAlso) {
		Scholar.RDF.addStatement(resource, n.dc+"relation", itemResources[seeAlso[i]], false);
	}
}

function generateCollection(collection) {
	var collectionResource = "#collection:"+collection.id;
	Scholar.RDF.addStatement(collectionResource, rdf+"type", n.bib+"Collection", false);
	Scholar.RDF.addStatement(collectionResource, n.dc+"title", collection.name, true);
	
	for each(var child in collection.children) {
		// add child list items
		if(child.type == "collection") {
			Scholar.RDF.addStatement(collectionResource, n.dcterms+"hasPart", "#collection:"+child.id, false);
			// do recursive processing of collections
			generateCollection(child);
		} else {
			Scholar.RDF.addStatement(collectionResource, n.dcterms+"hasPart", itemResources[child.id], false);
		}
	}
}

function doExport() {
	rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
	
	n = {
		bib:"http://purl.org/net/biblio#",
		dc:"http://purl.org/dc/elements/1.1/",
		dcterms:"http://purl.org/dc/terms/",
		prism:"http://prismstandard.org/namespaces/1.2/basic/",
		foaf:"http://xmlns.com/foaf/0.1/",
		vcard:"http://nwalsh.com/rdf/vCard"
	};
	
	// add namespaces
	for(var i in n) {
		Scholar.RDF.addNamespace(i, n[i]);
	}
	
	// leave as global
	itemResources = new Array();
	
	// keep track of resources already assigned (in case two book items have the
	// same ISBN, or something like that)
	var usedResources = new Array();
	
	var items = new Array();
	
	// first, map each ID to a resource
	while(item = Scholar.nextItem()) {
		items.push(item);
		
		if(item.ISBN && !usedResources["urn:isbn:"+item.ISBN]) {
			itemResources[item.itemID] = "urn:isbn:"+item.ISBN;
			usedResources[itemResources[item.itemID]] = true;
		} else if(item.url && !usedResources[item.url]) {
			itemResources[item.itemID] = item.url;
			usedResources[itemResources[item.itemID]] = true;
		} else {
			// just specify a node ID
			itemResources[item.itemID] = "#item:"+item.itemID;
		}
		
		for(var j in item.notes) {
			itemResources[item.notes[j].itemID] = "#item:"+item.notes[j].itemID;
		}
	}
	
	for each(item in items) {
		// these items are global
		resource = itemResources[item.itemID];
		
		container = null;
		containerElement = null;
		section = null;
		
		/** CORE FIELDS **/
		
		// title
		if(item.title) {
			Scholar.RDF.addStatement(resource, n.dc+"title", item.title, true);
		}
		
		// type
		var type = null;
		if(item.itemType == "book") {
			type = "Book";
		} else if (item.itemType == "bookSection") {
			type = "BookSection";
			container = "Book";
		} else if(item.itemType == "journalArticle") {
			type = "Article";
			container = "Journal";
		} else if(item.itemType == "magazineArticle") {
			type = "Article";
			container = "Periodical";
		} else if(item.itemType == "newspaperArticle") {
			type = "Article";
			container = "Newspaper";
		} else if(item.itemType == "thesis") {
			type = "Thesis";
		} else if(item.itemType == "letter") {
			type = "Letter";
		} else if(item.itemType == "manuscript") {
			type = "Manuscript";
		} else if(item.itemType == "interview") {
			type = "Interview";
		} else if(item.itemType == "film") {
			type = "MotionPicture";
		} else if(item.itemType == "artwork") {
			type = "Illustration";
		} else if(item.itemType == "website") {
			type = "Document";
		} else if(item.itemType == "note") {
			type = "Memo";
		}
		if(type) {
			Scholar.RDF.addStatement(resource, rdf+"type", n.bib+type, false);
		}
		
		// authors/editors/contributors
		var creatorContainers = new Object();
		for(var j in item.creators) {
			var creator = Scholar.RDF.newResource();
			Scholar.RDF.addStatement(creator, rdf+"type", n.foaf+"Person", false);
			// gee. an entire vocabulary for describing people, and these aren''t even
			// standardized in it. oh well. using them anyway.
			Scholar.RDF.addStatement(creator, n.foaf+"surname", item.creators[j].lastName, true);
			Scholar.RDF.addStatement(creator, n.foaf+"givenname", item.creators[j].firstName, true);
			
			// in addition, these tags are not yet in Biblio, but Bruce D''Arcus
			// says they will be.
			if(item.creators[j].creatorType == "author") {
				var cTag = "authors";
			} else if(item.creators[j].creatorType == "editor") {
				var cTag = "editors";
			} else {
				var cTag = "contributors";
			}
			
			if(!creatorContainers[cTag]) {
				var creatorResource = Scholar.RDF.newResource();
				// create new seq for author type
				creatorContainers[cTag] = Scholar.RDF.newContainer("seq", creatorResource);
				// attach container to resource
				Scholar.RDF.addStatement(resource, n.bib+cTag, creatorResource, false);
			}
			Scholar.RDF.addContainerElement(creatorContainers[cTag], creator, false);
		}
		
		/** FIELDS ON NEARLY EVERYTHING BUT NOT A PART OF THE CORE **/
		
		// source
		if(item.source) {
			Scholar.RDF.addStatement(resource, n.dc+"source", item.source, true);
		}
		
		// accessionNumber as generic ID
		if(item.accessionNumber) {
			Scholar.RDF.addStatement(resource, n.dc+"identifier", item.accessionNumber, true);
		}
		
		// rights
		if(item.rights) {
			Scholar.RDF.addStatement(resource, n.dc+"rights", item.rights, true);
		}
		
		/** SUPPLEMENTAL FIELDS **/
		
		// use section to set up another container element
		if(item.section) {
			section = Scholar.RDF.newResource();				// leave as global
			// set section type
			Scholar.RDF.addStatement(section, rdf+"type", n.bib+"Part", false);
			// set section title
			Scholar.RDF.addStatement(section, n.dc+"title", item.section, true);
			// add relationship to resource
			Scholar.RDF.addStatement(resource, n.dc+"isPartOf", section, false);
		}
		
		// generate container
		if(container) {
			if(item.ISSN && !Scholar.RDF.getArcsIn("urn:issn:"+item.ISSN)) {
				// use ISSN as container URI if no other item is
				containerElement = "urn:issn:"+item.ISSN
			} else {
				containerElement = Scholar.RDF.newResource();
			}
			// attach container to section (if exists) or resource
			Scholar.RDF.addStatement((section ? section : resource), n.dcterms+"isPartOf", containerElement, false);
			// add container type
			Scholar.RDF.addStatement(containerElement, rdf+"type", n.bib+container, false);
		}
		
		// ISSN
		if(item.ISSN) {
			Scholar.RDF.addStatement((containerElement ? containerElement : resource), n.dc+"identifier", "ISSN "+item.ISSN, true);
		}
		
		// ISBN
		if(item.ISBN) {
			Scholar.RDF.addStatement((containerElement ? containerElement : resource), n.dc+"identifier", "ISBN "+item.ISBN, true);
		}
		
		// DOI
		if(item.DOI) {
			Scholar.RDF.addStatement((containerElement ? containerElement : resource), n.dc+"identifier", "DOI "+item.DOI, true);
		}
		
		// publication gets linked to container via isPartOf
		if(item.publication) {
			Scholar.RDF.addStatement((containerElement ? containerElement : resource), n.dc+"title", item.publicationTitle, true);
		}
		
		// series also linked in
		if(item.seriesTitle) {
			var series = Scholar.RDF.newResource();
			// set series type
			Scholar.RDF.addStatement(series, rdf+"type", n.bib+"Series", false);
			// set series title
			Scholar.RDF.addStatement(series, n.dc+"title", item.seriesTitle, true);
			// add relationship to resource
			Scholar.RDF.addStatement((containerElement ? containerElement : resource), n.dcterms+"isPartOf", series, false);
		}
		
		// volume
		if(item.volume) {
			Scholar.RDF.addStatement((containerElement ? containerElement : resource), n.prism+"volume", item.volume, true);
		}
		// number
		if(item.issue) {
			Scholar.RDF.addStatement((containerElement ? containerElement : resource), n.prism+"number", item.issue, true);
		}
		// edition
		if(item.edition) {
			Scholar.RDF.addStatement(resource, n.prism+"edition", item.edition, true);
		}
		// publisher/distributor and place
		if(item.publisher || item.distributor || item.place) {
			var organization = Scholar.RDF.newResource();
			// set organization type
			Scholar.RDF.addStatement(organization, rdf+"type", n.foaf+"Organization", false);
			// add relationship to resource
			Scholar.RDF.addStatement(resource, n.dc+"publisher", organization, false);
			// add publisher/distributor
			if(item.publisher) {
				Scholar.RDF.addStatement(organization, n.foaf+"name", item.publisher, true);
			} else if(item.distributor) {
				Scholar.RDF.addStatement(organization, n.foaf+"name", item.distributor, true);
			}
			// add place
			if(item.place) {
				var address = Scholar.RDF.newResource();
				// set address type
				Scholar.RDF.addStatement(address, rdf+"type", n.vcard+"Address", false);
				// set address locality
				Scholar.RDF.addStatement(address, n.vcard+"locality", item.place, true);
				// add relationship to organization
				Scholar.RDF.addStatement(organization, n.vcard+"adr", address, false);
			}
		}
		// date/year
		if(item.date) {
			Scholar.RDF.addStatement(resource, n.dc+"date", item.date, true);
		} else if(item.year) {
			Scholar.RDF.addStatement(resource, n.dc+"date", item.year, true);
		}
		if(item.accessDate) {	// use date submitted for access date?
			Scholar.RDF.addStatement(resource, n.dcterms+"dateSubmitted", item.accessDate, true);
		}
		if(item.lastModified) {
			Scholar.RDF.addStatement(resource, n.dcterms+"modified", item.lastModified, true);
		}
		
		// callNumber
		if(item.callNumber) {
			var term = Scholar.RDF.newResource();
			// set term type
			Scholar.RDF.addStatement(term, rdf+"type", n.dcterms+"LCC", false);
			// set callNumber value
			Scholar.RDF.addStatement(term, rdf+"value", item.callNumber, true);
			// add relationship to resource
			Scholar.RDF.addStatement(resource, n.dc+"subject", term, false);
		}
		
		// archiveLocation
		if(item.archiveLocation) {
			Scholar.RDF.addStatement(resource, n.dc+"coverage", item.archiveLocation, true);
		}
		
		// type (not itemType)
		if(item.type) {
			Scholar.RDF.addStatement(resource, n.dc+"type", item.type, true);
		} else if(item.thesisType) {
			Scholar.RDF.addStatement(resource, n.dc+"type", item.thesisType, true);
		}
		
		// THIS IS NOT YET IN THE BIBLIO NAMESPACE, BUT BRUCE D''ARCUS HAS SAID
		// IT WILL BE SOON
		if(item.pages) {
			Scholar.RDF.addStatement(resource, n.bib+"pages", item.pages, true);
		}
		
		// journalAbbreviation
		if(item.journalAbbreviation) {
			Scholar.RDF.addStatement((containerElement ? containerElement : resource), n.dcterms+"alternative", item.journalAbbreviation, true);
		}
		
		/** NOTES **/
		
		for(var j in item.notes) {
			var noteResource = itemResources[item.notes[j].itemID];
			
			// add note tag
			Scholar.RDF.addStatement(noteResource, rdf+"type", n.bib+"Memo", false);
			// add note value
			Scholar.RDF.addStatement(noteResource, rdf+"value", item.notes[j].note, true);
			// add relationship between resource and note
			Scholar.RDF.addStatement(resource, n.dcterms+"isReferencedBy", noteResource, false);
			
			// Add see also info to RDF
			generateSeeAlso(resource, item.notes[j].seeAlso);
		}
		
		if(item.note) {
			Scholar.RDF.addStatement(resource, rdf+"value", item.note, true);
		}
		
		/** TAGS **/
		
		for(var j in item.tags) {
			Scholar.RDF.addStatement(resource, n.dc+"subject", item.tags[j], true);
		}
		
		// Add see also info to RDF
		generateSeeAlso(resource, item.seeAlso);
	}
	
	/** RDF COLLECTION STRUCTURE **/
	var collection;
	while(collection = Scholar.nextCollection()) {
		generateCollection(collection);
	}
}');

REPLACE INTO "translators" VALUES ('6e372642-ed9d-4934-b5d1-c11ac758ebb7', '2006-07-05 23:40:00', 2, 'Unqualified Dublin Core (RDF/XML)', 'Simon Kornblith', 'rdf',
'Scholar.configure("dataMode", "rdf");',
'function doExport() {
	var dc = "http://purl.org/dc/elements/1.1/";
	Scholar.RDF.addNamespace("dc", dc);
	
	var item;
	while(item = Scholar.nextItem()) {
		if(item.itemType == "note") {
			continue;
		}
		
		var resource;
		if(item.ISBN) {
			resource = "urn:isbn:"+item.ISBN;
		} else if(item.url) {
			resource = item.url;
		} else {
			// just specify a node ID
			resource = Scholar.RDF.newResource();
		}
		
		/** CORE FIELDS **/
		
		// title
		if(item.title) {
			Scholar.RDF.addStatement(resource, dc+"title", item.title, true);
		}
		
		// type
		Scholar.RDF.addStatement(resource, dc+"type", item.itemType, true);
		
		// creators
		for(var j in item.creators) {
			// put creators in lastName, firstName format (although DC doesn''t specify)
			var creator = item.creators[j].lastName;
			if(item.creators[j].firstName) {
				creator += ", "+item.creators[j].firstName;
			}
			
			if(item.creators[j].creatorType == "author") {
				Scholar.RDF.addStatement(resource, dc+"creator", creator, true);
			} else {
				Scholar.RDF.addStatement(resource, dc+"contributor", creator, true);
			}
		}
		
		/** FIELDS ON NEARLY EVERYTHING BUT NOT A PART OF THE CORE **/
		
		// source
		if(item.source) {
			Scholar.RDF.addStatement(resource, dc+"source", item.source, true);
		}
		
		// accessionNumber as generic ID
		if(item.accessionNumber) {
			Scholar.RDF.addStatement(resource, dc+"identifier", item.accessionNumber, true);
		}
		
		// rights
		if(item.rights) {
			Scholar.RDF.addStatement(resource, dc+"rights", item.rights, true);
		}
		
		/** SUPPLEMENTAL FIELDS **/
		
		// TODO - create text citation and OpenURL citation to handle volume, number, pages, issue, place
		
		// publisher/distributor
		if(item.publisher) {
			Scholar.RDF.addStatement(resource, dc+"publisher", item.publisher, true);
		} else if(item.distributor) {
			Scholar.RDF.addStatement(resource, dc+"publisher", item.distributor, true);
		}
		// date/year
		if(item.date) {
			Scholar.RDF.addStatement(resource, dc+"date", item.date, true);
		} else if(item.year) {
			Scholar.RDF.addStatement(resource, dc+"date", item.year, true);
		} else if(item.lastModified) {
			Scholar.RDF.addStatement(resource, dc+"date", item.lastModified, true);
		}
		
		// ISBN/ISSN/DOI
		if(item.ISBN) {
			Scholar.RDF.addStatement(resource, dc+"identifier", "ISBN "+item.ISBN, true);
		}
		if(item.ISSN) {
			Scholar.RDF.addStatement(resource, dc+"identifier", "ISSN "+item.ISSN, true);
		}
		if(item.DOI) {
			Scholar.RDF.addStatement(resource, dc+"identifier", "DOI "+item.DOI, true);
		}
		
		// callNumber
		if(item.callNumber) {
			Scholar.RDF.addStatement(resource, dc+"identifier", item.callNumber, true);
		}
		
		// archiveLocation
		if(item.archiveLocation) {
			Scholar.RDF.addStatement(resource, dc+"coverage", item.archiveLocation, true);
		}
	}
}');

REPLACE INTO "translators" VALUES ('5e3ad958-ac79-463d-812b-a86a9235c28f', '2006-07-15 17:09:00', 1, 'RDF', 'Simon Kornblith', 'rdf',
'Scholar.configure("dataMode", "rdf");',
'// gets the first result set for a property that can be encoded in multiple
// ontologies
function getFirstResults(node, properties, onlyOneString) {
	for(var i=0; i<properties.length; i++) {
		var result = Scholar.RDF.getTargets(node, properties[i]);
		if(result) {
			if(onlyOneString) {
				// onlyOneString means we won''t return nsIRDFResources, only
				// actual literals
				if(typeof(result[0]) != "object") {
					return result[0];
				}
			} else {
				return result;
			}
		}
	}
	return;	// return undefined on failure
}

// adds creators to an item given a list of creator nodes
function handleCreators(newItem, creators, creatorType) {
	if(!creators) {
		return;
	}
	
	if(typeof(creators[0]) != "string") {	// see if creators are in a container
		try {
			var creators = Scholar.RDF.getContainerElements(creators[0]);
		} catch(e) {}
	}
	
	if(typeof(creators[0]) == "string") {	// support creators encoded as strings
		for(var i in creators) {
			if(typeof(creators[i]) != "object") {
				newItem.creators.push(Scholar.Utilities.cleanAuthor(creators[i], creatorType, true));
			}
		}
	} else {								// also support foaf
		for(var i in creators) {
			var type = Scholar.RDF.getTargets(creators[i], rdf+"type");
			if(type) {
				type = Scholar.RDF.getResourceURI(type[0]);
				if(type == n.foaf+"Person") {	// author is FOAF type person
					var creator = new Array();
					creator.lastName = getFirstResults(creators[i],
						[n.foaf+"surname", n.foaf+"family_name"], true);
					creator.firstName = getFirstResults(creators[i],
						[n.foaf+"givenname", n.foaf+"firstName"], true);
					creator.creatorType = creatorType;
					newItem.creators.push(creator);
				}
			}
		}
	}
}

// processes collections recursively
function processCollection(node, collection) {
	if(!collection) {
		collection = new Array();
	}
	collection.type = "collection";
	collection.name = getFirstResults(node, [n.dc+"title"], true);
	collection.children = new Array();
	
	// check for children
	var children = getFirstResults(node, [n.dcterms+"hasPart"]);
	for each(var child in children) {
		var type = Scholar.RDF.getTargets(child, rdf+"type");
		if(type) {
			type = Scholar.RDF.getResourceURI(type[0]);
		}
		
		if(type == n.bib+"Collection") {
			// for collections, process recursively
			collection.children.push(processCollection(child));
		} else {
			// all other items are added by ID
			collection.children.push({id:Scholar.RDF.getResourceURI(child), type:"item"});
		}
	}
	
	return collection;
}

// gets the node with a given type from an array
function getNodeByType(nodes, type) {
	if(!nodes) {
		return false;
	}
	
	for each(node in nodes) {
		var nodeType = Scholar.RDF.getTargets(node, rdf+"type");
		if(nodeType) {
			nodeType = Scholar.RDF.getResourceURI(nodeType[0]);
			if(nodeType == type) {	// we have a node of the correct type
				return node;
			}
		}
	}
	return false;
}

function doImport() {
	rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
	
	n = {
		bib:"http://purl.org/net/biblio#",
		dc:"http://purl.org/dc/elements/1.1/",
		dcterms:"http://purl.org/dc/terms/",
		prism:"http://prismstandard.org/namespaces/1.2/basic/",
		foaf:"http://xmlns.com/foaf/0.1/",
		vcard:"http://nwalsh.com/rdf/vCard"
	};
	
	callNumberTypes = [
		n.dcterms+"LCC", n.dcterms+"DDC", n.dcterms+"UDC"
	];
	
	var nodes = Scholar.RDF.getAllResources();
	if(!nodes) {
		return false;
	}
	
	// keep track of collections while we''re looping through
	var collections = new Array();
	
	for each(var node in nodes) {
		var newItem = new Scholar.Item();
		newItem.itemID = Scholar.RDF.getResourceURI(node);
		var container = undefined;
		
		// type
		var type = Scholar.RDF.getTargets(node, rdf+"type");
		// also deal with type detection based on parts, so we can differentiate
		// magazine and journal articles, and find container elements
		var isPartOf = getFirstResults(node, [n.dcterms+"isPartOf"]);
		
		if(type) {
			type = Scholar.RDF.getResourceURI(type[0]);
			
			if(type == n.bib+"Book") {
				newItem.itemType = "book";
			} else if(type == n.bib+"BookSection") {
				newItem.itemType = "bookSection";
				container = getNodeByType(isPartOf, n.bib+"Book");
			} else if(type == n.bib+"Article") {	// choose between journal,
													// newspaper, and magazine
													// articles
				if(container = getNodeByType(isPartOf, n.bib+"Journal")) {
					newItem.itemType = "journalArticle";
				} else if(container = getNodeByType(isPartOf, n.bib+"Periodical")) {
					newItem.itemType = "magazineArticle";
				} else if(container = getNodeByType(isPartOf, n.bib+"Newspaper")) {
					newItem.itemType = "newspaperArticle";
				}
			} else if(type == n.bib+"Thesis") {
				newItem.itemType = "thesis";
			} else if(type == n.bib+"Letter") {
				newItem.itemType = "letter";
			} else if(type == n.bib+"Manuscript") {
				newItem.itemType = "manuscript";
			} else if(type == n.bib+"Interview") {
				newItem.itemType = "interview";
			} else if(type == n.bib+"MotionPicture") {
				newItem.itemType = "film";
			} else if(type == n.bib+"Illustration") {
				newItem.itemType = "illustration";
			} else if(type == n.bib+"Document") {
				newItem.itemType = "website";
			} else if(type == n.bib+"Memo") {
				// check to see if this note is independent
				var arcs = Scholar.RDF.getArcsIn(node);
				Scholar.Utilities.debugPrint("working on a note");
				Scholar.Utilities.debugPrint(arcs);
				var skip = false;
				for each(var arc in arcs) {
					arc = Scholar.RDF.getResourceURI(arc);
					if(arc != n.dc+"relation" && arc != n.dcterms+"hasPart") {	
						// related to another item by some arc besides see also
						skip = true;
					}
				}
				if(skip) {
					continue;
				}
				
				newItem.itemType = "note";
			} else if(type == n.bib+"Collection") {
				// skip collections until all the items are done
				collections.push(node);
				continue;
			} else {	// default to book
				newItem.itemType = "book";
			}
		}
		
		// title
		newItem.title = getFirstResults(node, [n.dc+"title"], true);
		if(newItem.itemType != "note" && !newItem.title) {	// require the title
															// (if not a note)
			continue;
		}
		
		// regular author-type creators
		var creators = getFirstResults(node, [n.bib+"authors", n.dc+"creator"]);
		handleCreators(newItem, creators, "author");
		// editors
		var creators = getFirstResults(node, [n.bib+"editors"]);
		handleCreators(newItem, creators, "editor");
		// contributors
		var creators = getFirstResults(node, [n.bib+"contributors"]);
		handleCreators(newItem, creators, "contributor");
		
		// source
		newItem.source = getFirstResults(node, [n.dc+"source"], true);
		
		// rights
		newItem.rights = getFirstResults(node, [n.dc+"rights"], true);
		
		// section
		var section = getNodeByType(isPartOf, n.bib+"Part");
		if(section) {
			newItem.section = getFirstResults(section, [n.dc+"title"], true);
		}
		
		// publication
		if(container) {
			newItem.publicationTitle = getFirstResults(container, [n.dc+"title"], true);
		}
		
		// series
		var series = getNodeByType(isPartOf, n.bib+"Series");
		if(series) {
			newItem.seriesTitle = getFirstResults(container, [n.dc+"title"], true);
		}
		
		// volume
		newItem.volume = getFirstResults((container ? container : node), [n.prism+"volume"], true);
		
		// number
		newItem.issue = getFirstResults((container ? container : node), [n.prism+"number"], true);
		
		// edition
		newItem.edition = getFirstResults(node, [n.prism+"edition"], true);
		
		// publisher
		var publisher = getFirstResults(node, [n.dc+"publisher"]);
		if(publisher) {
			if(typeof(publisher[0]) == "string") {
				newItem.publisher = publisher[0];
			} else {
				var type = Scholar.RDF.getTargets(publisher[0], rdf+"type");
				if(type) {
					type = Scholar.RDF.getResourceURI(type[0]);
					if(type == n.foaf+"Organization") {	// handle foaf organizational publishers
						newItem.publisher = getFirstResults(publisher[0], [n.foaf+"name"], true);
						var place = getFirstResults(publisher[0], [n.vcard+"adr"]);
						if(place) {
							newItem.place = getFirstResults(place[0], [n.vcard+"locality"]);
						}
					}
				}
			}
		}
		
		// (this will get ignored except for films, where we encode distributor as publisher)
		newItem.distributor = newItem.publisher;
		
		// date
		newItem.date = getFirstResults(node, [n.dc+"date"], true);
		// accessDate
		newItem.accessDate = getFirstResults(node, [n.dcterms+"dateSubmitted"], true);
		// lastModified
		newItem.lastModified = getFirstResults(node, [n.dcterms+"modified"], true);
		
		// identifier
		var identifiers = getFirstResults(node, [n.dc+"identifier"]);
		if(container) {
			var containerIdentifiers = getFirstResults(container, [n.dc+"identifier"]);
			// concatenate sets of identifiers
			if(containerIdentifiers) {
				if(identifiers) {
					identifiers = identifiers.concat(containerIdentifiers);
				} else {
					identifiers = containerIdentifiers;
				}
			}
		}
		
		if(identifiers) {
			for(var i in identifiers) {
				var beforeSpace = identifiers[i].substr(0, identifiers[i].indexOf(" ")).toUpperCase();
				
				if(beforeSpace == "ISBN") {
					newItem.ISBN = identifiers[i].substr(5).toUpperCase();
				} else if(beforeSpace == "ISSN") {
					newItem.ISSN = identifiers[i].substr(5).toUpperCase();
				} else if(beforeSpace == "DOI") {
					newItem.DOI = identifiers[i].substr(4);
				} else if(!newItem.accessionNumber) {
					newItem.accessionNumber = identifiers[i];
				}
			}
		}
		
		// archiveLocation
		newItem.archiveLocation = getFirstResults(node, [n.dc+"coverage"], true);
		
		// type
		newItem.type = newItem.thesisType = getFirstResults(node, [n.dc+"type"], true);
		
		// journalAbbreviation
		newItem.journalAbbreviation = getFirstResults((container ? container : node), [n.dcterms+"alternative"], true);
		
		// see also
		var relations;
		if(relations = getFirstResults(node, [n.dc+"relation"])) {
			for each(var relation in relations) {
				newItem.seeAlso.push(Scholar.RDF.getResourceURI(relation));
			}
		}
	
		/** NOTES **/
		
		var referencedBy = Scholar.RDF.getTargets(node, n.dcterms+"isReferencedBy");
		for each(var referentNode in referencedBy) {
			var type = Scholar.RDF.getTargets(referentNode, rdf+"type");
			if(type && Scholar.RDF.getResourceURI(type[0]) == n.bib+"Memo") {
				// if this is a memo
				var note = new Array();
				note.note = getFirstResults(referentNode, [rdf+"value", n.dc+"description"], true);
				if(note.note != undefined) {
					// handle see also
					var relations;
					if(relations = getFirstResults(referentNode, [n.dc+"relation"])) {
						note.seeAlso = new Array();
						for each(var relation in relations) {
							note.seeAlso.push(Scholar.RDF.getResourceURI(relation));
						}
					}
					
					// add note
					newItem.notes.push(note);
				}
			}
		}
		
		if(newItem.itemType == "note") {
			// add note for standalone
			newItem.note = getFirstResults(node, [rdf+"value", n.dc+"description"], true);
		}
		
		/** TAGS **/
		
		var subjects = getFirstResults(node, [n.dc+"subject"]);
		for each(var subject in subjects) {
			if(typeof(subject) == "string") {	// a regular tag
				newItem.tags.push(subject);
			} else {							// a call number
				var type = Scholar.RDF.getTargets(subject, rdf+"type");
				if(type) {
					type = Scholar.RDF.getResourceURI(type[0]);
					if(Scholar.Utilities.inArray(type, callNumberTypes)) {
						newItem.callNumber = getFirstResults(subject, [rdf+"value"], true);
					}
				}
			}
		}
		
		newItem.complete();
	}
	
	/* COLLECTIONS */
	
	for each(collection in collections) {
		if(!Scholar.RDF.getArcsIn(collection)) {
			var newCollection = new Scholar.Collection();
			processCollection(collection, newCollection);
			newCollection.complete();
		}
	}
}');

REPLACE INTO "translators" VALUES ('32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7', '2006-06-30 15:36:00', 3, 'RIS', 'Simon Kornblith', 'ris',
'Scholar.configure("dataMode", "line");
Scholar.addOption("exportNotes", true);',
'var itemsWithYears = ["book", "bookSection", "thesis", "film"];

var fieldMap = {
	ID:"itemID",
	T1:"title",
	T3:"seriesTitle",
	JF:"publicationTitle",
	VL:"volume",
	IS:"issue",
	CP:"place",
	PB:"publisher"
};

var inputFieldMap = {
	TI:"title",
	CT:"title",
	JO:"publicationTitle",
	CY:"place"
};

// TODO: figure out if these are the best types for letter, interview, website, manuscript
var typeMap = {
	book:"BOOK",
	bookSection:"CHAP",
	journalArticle:"JOUR",
	magazineArticle:"MGZN",
	newspaperArticle:"NEWS",
	thesis:"THES",
	letter:"PCOMM",
	manuscript:"UNPB",
	interview:"PCOMM",
	film:"MPCT",
	artwork:"ART",
	website:"ELEC"
};

// supplements outputTypeMap for importing
// TODO: BILL, CASE, COMP, CONF, DATA, HEAR, MUSIC, PAT, SOUND, STAT
var inputTypeMap = {
	ABST:"journalArticle",
	ADVS:"film",
	CTLG:"magazineArticle",
	GEN:"book",
	INPR:"manuscript",
	JFULL:"journalArticle",
	MAP:"artwork",
	PAMP:"book",
	RPRT:"book",
	SER:"book",
	SLIDE:"artwork",
	UNBILL:"manuscript",
	VIDEO:"film"
};

function processTag(item, tag, value) {
	if(fieldMap[tag]) {
		item[fieldMap[tag]] = value;
	} else if(tag == "TY") {
		// look for type
		
		// first check typeMap
		for(var i in typeMap) {
			if(value == typeMap[i]) {
				item.itemType = i;
			}
		}
		// then check inputTypeMap
		if(!item.itemType) {
			if(inputTypeMap[value]) {
				item.itemType = inputTypeMap[value];
			} else {
				// default to generic from inputTypeMap
				item.itemType = inputTypeMap["GEN"];
			}
		}
	} else if(tag == "BT") {
		// ignore, unless this is a book or unpublished work, as per spec
		if(item.itemType == "book" || item.itemType == "manuscript") {
			item.title = value;
		}
	} else if(tag == "A1" || tag == "AU") {
		// primary author
		var names = value.split(",");
		item.creators.push({lastName:names[0], firstName:names[1], creatorType:"author"});
	} else if(tag == "A2" || tag == "ED") {
		// contributing author
		var names = value.split(",");
		item.creators.push({lastName:names[0], firstName:names[1], creatorType:"contributor"});
	} else if(tag == "Y1" || tag == "PY") {
		// year or date
		var dateParts = value.split("/");
		
		if(dateParts.length == 1) {
			// technically, if there''s only one date part, the file isn''t valid
			// RIS, but EndNote accepts this, so we have to too
			item.date = value+"-00-00";
		} else if(dateParts[1].length == 0 && dateParts[2].length == 0 && dateParts[3] && dateParts[3].length != 0) {
			// in the case that we have a year and other data, format that way
			item.date = dateParts[3]+(dateParts[0] ? " "+dateParts[0] : "");
		} else {
			// standard YMD data
			item.date = Scholar.Utilities.lpad(dateParts[0], "0", 4)+"-"+Scholar.Utilities.lpad(dateParts[1], "0", 2)+"-"+Scholar.Utilities.lpad(dateParts[2], "0", 2);
		}
	} else if(tag == "N1" || tag == "AB") {
		// notes
		item.notes.push({note:value});
	} else if(tag == "KW") {
		// keywords/tags
		item.tags.push(value);
	} else if(tag == "SP") {
		// start page
		if(!item.pages) {
			item.pages = value;
		} else if(item.pages[0] == "-") {	// already have ending page
			item.pages = value + item.pages;
		} else {	// multiple ranges? hey, it''s a possibility
			item.pages += ", "+value;
		}
	} else if(tag == "EP") {
		// end page
		if(value) {
			if(!item.pages || value != item.pages) {
				if(!item.pages) {
					item.pages = "";
				}
				item.pages += "-"+value;
			}
		}
	} else if(tag == "SN") {
		// ISSN/ISBN - just add both
		if(!item.ISBN) {
			item.ISBN = value;
		}
		if(!item.ISSN) {
			item.ISSN = value;
		}
	} else if(tag == "UR") {
		// URL
		item.url = value;
	}
}

function doImport() {
	var line = true;
	var tag = data = false;
	do {	// first valid line is type
		line = Scholar.read();
		Scholar.Utilities.debugPrint(line);
	} while(line !== false && line.substr(0, 6) != "TY  - ");
	
	var item = new Scholar.Item();
	var tag = "TY";
	var data = line.substr(6);
	
	while((line = Scholar.read()) !== false) {	// until EOF
		if(line.substr(2, 4) == "  - ") {
			// if this line is a tag, take a look at the previous line to map
			// its tag
			if(tag) {
				processTag(item, tag, data);
			}
			
			// then fetch the tag and data from this line
			tag = line.substr(0,2);
			data = line.substr(6);
			
			Scholar.Utilities.debugPrint("tag: ''"+tag+"''; data: ''"+data+"''");
			
			if(tag == "ER") {		// ER signals end of reference			
				// unset info
				tag = data = false;
				// new item
				item.complete();
				item = new Scholar.Item();
			}
		} else {
			// otherwise, assume this is data from the previous line continued
			if(tag) {
				data += line;
			}
		}
	}
	
	if(tag) {	// save any unprocessed tags
		processTag(item, tag, data);
		item.complete();
	}
}

function addTag(tag, value) {
	if(value) {
		Scholar.write(tag+"  - "+value+"\r\n");
	}
}

function doExport() {
	var item;
	
	while(item = Scholar.nextItem()) {
		// can''t store independent notes in RIS
		if(item.itemType == "note") {
			continue;
		}
		
		// type
		addTag("TY", typeMap[item.itemType]);
		
		// use field map
		for(var j in fieldMap) {
			addTag(j, item[fieldMap[j]]);
		}
		
		// creators
		for(var j in item.creators) {
			// only two types, primary and secondary
			var risTag = "A1"
			if(item.creators[j].creatorType != "author") {
				risTag = "A2";
			}
			
			addTag(risTag, item.creators[j].lastName+","+item.creators[j].firstName);
		}
		
		// date
		if(item.date) {
			var isoDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
			if(isoDate.test(item.date)) {	// can directly accept ISO format with minor mods
				addTag("Y1", item.date.replace("-", "/")+"/");
			} else {						// otherwise, extract year and attach other data
				var year = /^(.*?) *([0-9]{4})/;
				var m = year.exec(item.date);
				if(m) {
					addTag("Y1", m[2]+"///"+m[1]);
				}
			}
		} else if(item.year) {
			addTag("Y1", item.year+"///");
		}
		
		// notes
		for(var j in item.notes) {
			addTag("N1", item.notes[j].note);
		}
		
		// tags
		for(var j in item.tags) {
			addTag("KY", item.tags[j]);
		}
		
		// pages
		if(item.pages) {
			var range = Scholar.Utilities.getPageRange(item.pages);
			addTag("SP", range[0]);
			addTag("EP", range[1]);
		}
		
		// ISBN/ISSN
		addTag("SN", item.ISBN);
		addTag("SN", item.ISSN);
		
		// URL
		if(item.url) {
			addTag("UR", item.url);
		} else if(item.source && item.source.substr(0, 7) == "http://") {
			addTag("UR", item.source);
		}
		
		Scholar.write("ER  - \r\n\r\n");
	}
}');

REPLACE INTO "translators" VALUES ('a6ee60df-1ddc-4aae-bb25-45e0537be973', '2006-07-16 17:18:00', 1, 'MARC', 'Simon Kornblith', 'marc',
NULL,
'/*
* Original version of MARC record library copyright (C) 2005 Stefano Bargioni,
* licensed under the LGPL
*
* (Available at http://www.pusc.it/bib/mel/Scholar.Ingester.MARC_Record.js)
*
* This library is free software; you can redistribute it or
* modify it under the terms of the GNU General Public
* License as published by the Free Software Foundation; either
* version 2 of the License, or (at your option) any later version.
*
* This library is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
* General Public License for more details.
*/

var MARC_Record = function() { // new MARC record
	this.leader = {
		record_length:''00000'',
		record_status:''n'', // acdnp
		type_of_record:'' '',
		bibliographic_level:'' '',
		type_of_control:'' '',
		character_coding_scheme:'' '',
		indicator_count:''2'',
		subfield_code_length:''2'',
		base_address_of_data:''00000'',
		encoding_level:'' '',
		descriptive_cataloging_form:'' '',
		linked_record_requirement:'' '',
		entry_map:''4500''
	}; // 24 chars

	this.field_terminator   = ''\x1E'';
	this.record_terminator  = ''\x1D'';
	this.subfield_delimiter = ''\x1F'';
	this.directory = '''';
	this.directory_terminator = this.field_terminator;
	this.variable_fields = new Array();
};

MARC_Record.prototype.load = function(s,f) { // loads record s passed in format f
	if (f == ''binary'') {
		this.leader.record_length = ''00000'';
		this.leader.record_status = s.substr(5,1);
		this.leader.type_of_record = s.substr(6,1);
		this.leader.bibliographic_level = s.substr(7,1);
		this.leader.type_of_control = s.substr(8,1);
		this.leader.character_coding_scheme = s.substr(9,1);
		this.leader.indicator_count = ''2'';
		this.leader.subfield_code_length = ''2'';
		this.leader.base_address_of_data = ''00000'';
		this.leader.encoding_level = s.substr(17,1);
		this.leader.descriptive_cataloging_form = s.substr(18,1);
		this.leader.linked_record_requirement = s.substr(19,1);
		this.leader.entry_map = ''4500'';
		
		this.directory = '''';
		this.directory_terminator = this.field_terminator;
		this.variable_fields = new Array();
	
		// loads fields
		var campi = s.split(this.field_terminator);
		var k;
		for (k=1; k<-1+campi.length; k++) { // the first and the last are unuseful
			// the first is the header + directory, the last is the this.record_terminator
			var tag = campi[0].substr(24+(k-1)*12,3);
			var ind1 = ''''; var ind2 = ''''; var value = campi[k];
			if (tag.substr(0,2) != ''00'') {
				ind1  = campi[k].substr(0,1);
				ind2  = campi[k].substr(1,1);
				value = campi[k].substr(2);
			}
			this.add_field(tag,ind1,ind2,value);
		}
	}
	
	this.update_record_length();
	this.update_base_address_of_data();
	return this;
}

MARC_Record.prototype.update_base_address_of_data = function() { // updates the base_address
	this.leader.base_address_of_data = this._zero_fill(24+this.variable_fields.length*12+1,5);
	return this.leader.base_address_of_data;
}

MARC_Record.prototype.update_displacements = function() { // rebuilds the directory
	var displ = 0;
	this.directory = '''';
	for (var i=0; i<this.variable_fields.length; i++) {
		var len = this.variable_fields[i].value.length + 1 +
				 this.variable_fields[i].ind1.length  +
				 this.variable_fields[i].ind2.length;
		this.directory += this.variable_fields[i].tag +
						  this._zero_fill(len,4) + this._zero_fill(displ,5);
		displ += len;
	}
	return true;
}
MARC_Record.prototype.update_record_length = function() { // updates total record length
	var fields_total_length = 0; var f;
	for (f=0; f<this.variable_fields.length;f++) {
		fields_total_length += this.variable_fields[f].ind1.length+this.variable_fields[f].ind2.length+this.variable_fields[f].value.length + 1;
	}
	var rl = 24+this.directory.length+1+fields_total_length+1;
	this.leader.record_length = this._zero_fill(rl,5);
}

MARC_Record.prototype.sort_directory = function() { // sorts directory and array variable_fields by tag and occ
	// ordinamento della directory
	if (this.directory.length <= 12) { return true; } // already sorted
	var directory_entries = new Array();
	var i;
	for (i=0; i<this.directory.length; i=i+12) {
		directory_entries[directory_entries.length] = this.directory.substr(i,12);
	}
	directory_entries.sort();
	this.directory = directory_entries.join('''');
	// sorts array variable_fields
	this.variable_fields.sort(function(a,b) { return a.tag - b.tag + a.occ - b.occ; });
	return true;
}

MARC_Record.prototype.show_leader = function() {
	var leader = ''''; var f;
	for (f in this.leader) { leader += this.leader[f]; }
	return leader;
}

MARC_Record.prototype.show_fields = function() {
	var fields = ''''; var f;
	for (f=0; f<this.variable_fields.length;f++) {
		fields += this.variable_fields[f].ind1  +
				  this.variable_fields[f].ind2  +
				  this.variable_fields[f].value +
				  this.field_terminator;
	}
	return fields;
}

MARC_Record.prototype.show_directory = function() {
	var d = '''';
	for (var i = 0; i<this.directory.length; i+=12) {
		d += this.directory.substr(i,3)   + '' '' +
			 this.directory.substr(i+3,4) + '' '' +
			 this.directory.substr(i+7,5) + ''\n'';
	}
	return d;
}

MARC_Record.prototype.add_field_005 = function() {
	var now = new Date();
	now = now.getFullYear() + 
		  this._zero_fill(now.getMonth()+1,2) + 
		  this._zero_fill(now.getDate(),2) +
		  this._zero_fill(now.getHours(),2) + 
		  this._zero_fill(now.getMinutes(),2) +
		  this._zero_fill(now.getSeconds(),2) + ''.0'';
	this.add_field(''005'','''','''',now);
	return now;
}

MARC_Record.prototype.count_occ = function(tag) { // counts occ of tag
	var n = 0;
	for (var i=0; i<this.variable_fields.length; i++) {
		if (this.variable_fields[i].tag == tag) { n++; }
	}
	return n;
}

MARC_Record.prototype.exists = function(tag) { // field existence
	if (this.count_occ(tag) > 0) return true;
	return false;
}

MARC_Record.prototype.MARC_field = function(rec,tag,ind1,ind2,value) { // new MARC field
	this.tag = tag;
	this.occ = rec.count_occ(tag)+1; // occurrence order no.
	this.ind1 = ind1; if (this.ind1 == '''') this.ind1 = '' '';
	this.ind2 = ind2; if (this.ind2 == '''') this.ind2 = '' '';
	if (tag.substr(0,2) == ''00'') {
		this.ind1 = ''''; this.ind2 = '''';
	}
	this.value = value;
	return this;
}

MARC_Record.prototype.display = function(type) { // displays record in format type
	type = type.toLowerCase();
	if (type == ''binary'') return this.show_leader() +
								 this.directory     +
								 this.field_terminator   +
								 this.show_fields() +
								 this.record_terminator;
	if (type == ''xml'') {
		s = '''';
		s += ''<?xml version="1.0" encoding="iso-8859-1"?><collection xmlns="http://www.loc.gov/MARC21/slim"><record>'';
		s += ''<leader>''+this.show_leader()+''</leader>'';
		// var i;
		for (i=0; i<this.variable_fields.length; i++) {
			ind1 = this.variable_fields[i].ind1; if (ind1 != '''') ind1 = '' ind1="''+ind1+''"'';
			ind2 = this.variable_fields[i].ind2; if (ind2 != '''') ind2 = '' ind2="''+ind2+''"'';
			if (this.variable_fields[i].tag.substr(0,2) == ''00'') s += ''<controlfield tag="''+this.variable_fields[i].tag+''">''+this.variable_fields[i].value+''</controlfield>'';
			else {
				var subfields = this.variable_fields[i].value.split(this.subfield_delimiter);
				// alert(this.variable_fields[i].value+'' ''+subfields.length); // test
				if (subfields.length == 1) subfields[1] = ''?''+this.variable_fields[i].value;
				var sf = '''';
				for (var j=1; j<subfields.length; j++) {
					sf += ''<subfield code="''+subfields[j].substr(0,1)+''">''+subfields[j].substr(1)+''</subfield>'';
				}
				s += ''<datafield tag="'' + this.variable_fields[i].tag + ''"'' + ind1 + ind2 + ''>'' + sf + ''</datafield>'';
			}
		}
		s += ''</record></collection>'';
		return s;
	}
	return false;
}

MARC_Record.prototype.get_field = function(tag) { // returns an array of values, one for each occurrence
	var v = new Array(); var i;
	for (i=0; i<this.variable_fields.length; i++) {
		if (this.variable_fields[i].tag == tag) {
			v[v.length] = this.variable_fields[i].ind1 +
			this.variable_fields[i].ind2 + 
			this.variable_fields[i].value;
		}
	}
	return v;
}

// This function added by Simon Kornblith
MARC_Record.prototype.get_field_subfields = function(tag) { // returns a two-dimensional array of values
	var field = this.get_field(tag);
	var return_me = new Array();
	for(var i in field) {
		return_me[i] = new Object();
		var subfields = field[i].split(this.subfield_delimiter);
		if (subfields.length == 1) {
			return_me[i][''?''] = field[i];
		} else {
			for (var j=1; j<subfields.length; j++) {
				return_me[i][subfields[j].substr(0,1)] = subfields[j].substr(1);
			}
		}
	}
	return return_me;
}

MARC_Record.prototype.add_field = function(tag,ind1,ind2,value) { // adds a field to the record
	if (tag.length != 3) { return false; }
	var F = new this.MARC_field(this,tag,ind1,ind2,value);
	// adds pointer to list of fields
	this.variable_fields[this.variable_fields.length] = F;
	// adds the entry to the directory
	this.directory += F.tag+this._zero_fill(F.ind1.length+F.ind2.length+F.value.length+1,4)+''00000'';
	// sorts the directory
	this.sort_directory();
	// updates lengths
	this.update_base_address_of_data();
	this.update_displacements();
	this.update_record_length();
	return F;
}

MARC_Record.prototype.delete_field = function(tag,occurrence) {
	// lookup and delete the occurrence from array variable_fields
	var i;
	for (i=0; i<this.variable_fields.length; i++) {
		if (this.variable_fields[i].tag == tag && this.variable_fields[i].occ == occurrence) break;
	}
	if (i==this.variable_fields.length) return false; // campo non trovato
	// deletes the occ. i from array variable_fields scaling next values
	var j;
	for (j=i+1; j<this.variable_fields.length; j++) {
		this.variable_fields[i++]=this.variable_fields[j];
	}
	this.variable_fields.length--; // deletes last element
	// lookup and delete the occurrence from directory (must exist; no sort is needed)
	var nocc = 0;
	// var i;
	for (i=0; i<this.directory.length;i=i+12) {
		if (this.directory.substr(i,3) == tag) nocc++;
		if (occurrence == nocc) { // occ found
			break;
		}
	}
	if (i >= this.directory.length) alert(''Internal error!'');
	this.directory = this.directory.substr(0,i) + this.directory.substr(i+12);
	// updates lengths
	this.update_base_address_of_data();
	this.update_displacements();
	this.update_record_length();
	return true;
}

MARC_Record.prototype._clean = function(value) {
	value = value.replace(/^[\s\.\,\/\:]+/, '''');
	value = value.replace(/[\s\.\,\/\:]+$/, '''');
	value = value.replace(/ +/g, '' '');
	
	var char1 = value[1];
	var char2 = value[value.length-1];
	if((char1 == "[" && char2 == "]") || (char1 == "(" && char2 == ")")) {
		// chop of extraneous characters
		return value.substr(1, value.length-2);
	}
	
	return value;
}

MARC_Record.prototype._associateDBField = function(item, fieldNo, part, fieldName, execMe, arg1, arg2) {
	if(!part) {
		part = ''a'';
	}
	var field = this.get_field_subfields(fieldNo);
	Scholar.Utilities.debugPrint(''Found ''+field.length+'' matches for ''+fieldNo+part);
	if(field) {
		for(var i in field) {
			var value = false;
			for(var j=0; j<part.length; j++) {
				var myPart = part[j];
				if(field[i][myPart]) {
					if(value) {
						value += " "+field[i][myPart];
					} else {
						value = field[i][myPart];
					}
				}
			}
			if(value) {	
				value = this._clean(value);
				
				if(execMe) {
					value = execMe(value, arg1, arg2);
				}
				
				if(fieldName == "creator") {
					item.creators.push(value);
				} else {
					item[fieldName] = value;
				}
			}
		}
	}
}

MARC_Record.prototype._associateTags = function(item, fieldNo, part) {
	var field = this.get_field_subfields(fieldNo);
	
	for(var i in field) {
		for(var j=0; j<part.length; j++) {
			var myPart = part[j];
			if(field[i][myPart]) {
				item.tags.push(this._clean(field[i][myPart]));
			}
		}
	}
}

// this function loads a MARC record into our database
MARC_Record.prototype.translate = function(item) {
	// cleaning functions - use a closure to improve readability because they''ll
	// only be called once per record anyway
	function _pullNumber(text) {
		var pullRe = /[0-9]+/;
		var m = pullRe.exec(text);
		if(m) {
			return m[0];
		}
	}
	
	function _corpAuthor(author) {
		return {lastName:author};
	}
	
	// not sure why this is necessary, but without it, this code is inaccessible
	// from other translators
	function _author(author, type, useComma) {
		return Scholar.Utilities.cleanAuthor(author, type, useComma);
	}

	// Extract ISBNs
	this._associateDBField(item, ''020'', ''a'', ''ISBN'', _pullNumber);
	// Extract ISSNs
	this._associateDBField(item, ''022'', ''a'', ''ISSN'', _pullNumber);
	// Extract creators
	this._associateDBField(item, ''100'', ''a'', ''creator'', _author, ''author'', true);
	this._associateDBField(item, ''110'', ''a'', ''creator'', _corpAuthor, ''author'');
	this._associateDBField(item, ''111'', ''a'', ''creator'', _corpAuthor, ''author'');
	this._associateDBField(item, ''700'', ''a'', ''creator'', _author, ''contributor'', true);
	this._associateDBField(item, ''710'', ''a'', ''creator'', _corpAuthor, ''contributor'');
	this._associateDBField(item, ''711'', ''a'', ''creator'', _corpAuthor, ''contributor'');
	if(!item.creators.length) {
		// some LOC entries have no listed author, but have the author in the person subject field as the first entry
		var field = this.get_field_subfields(''600'');
		if(field[0]) {
			item.creators.push(this.cleanAuthor(field[0][''a''], true));	
		}
	}
	
	// Extract tags
	// personal
	this._associateTags(item, "600", "aqtxyz");
	// corporate
	this._associateTags(item, "611", "abtxyz");
	// meeting
	this._associateTags(item, "630", "acetxyz");
	// uniform title
	this._associateTags(item, "648", "atxyz");
	// chronological
	this._associateTags(item, "650", "axyz");
	// topical
	this._associateTags(item, "651", "abcxyz");
	// geographic
	this._associateTags(item, "653", "axyz");
	// uncontrolled
	this._associateTags(item, "653", "a");
	// faceted topical term (whatever that means)
	this._associateTags(item, "654", "abcyz");
	// genre/form
	this._associateTags(item, "655", "abcxyz");
	// occupation
	this._associateTags(item, "656", "axyz");
	// function
	this._associateTags(item, "657", "axyz");
	// curriculum objective
	this._associateTags(item, "658", "ab");
	// hierarchical geographic place name
	this._associateTags(item, "662", "abcdfgh");
	
	// Extract title
	this._associateDBField(item, ''245'', ''ab'', ''title'');
	// Extract edition
	this._associateDBField(item, ''250'', ''a'', ''edition'');
	// Extract place info
	this._associateDBField(item, ''260'', ''a'', ''place'');
	// Extract publisher info
	this._associateDBField(item, ''260'', ''b'', ''publisher'');
	// Extract year
	this._associateDBField(item, ''260'', ''c'', ''year'', _pullNumber);
	// Extract series
	this._associateDBField(item, ''440'', ''a'', ''seriesTitle'');
	// Extract call number
	this._associateDBField(item, ''084'', ''ab'', ''callNumber'');
	this._associateDBField(item, ''082'', ''a'', ''callNumber'');
	this._associateDBField(item, ''080'', ''ab'', ''callNumber'');
	this._associateDBField(item, ''070'', ''ab'', ''callNumber'');
	this._associateDBField(item, ''060'', ''ab'', ''callNumber'');
	this._associateDBField(item, ''050'', ''ab'', ''callNumber'');
	
	// Set type
	item.itemType = "book";
}

MARC_Record.prototype._trim = function(s) { // eliminates blanks from both sides
	s = s.replace(/\s+$/,'''');
	return s.replace(/^\s+/,'''');
}

MARC_Record.prototype._zero_fill = function(s,l) { // left ''0'' padding of s, up to l (l<=15)
	var t = ''000000000000000'';
	t = t+s;
	return t.substr(t.length-l,l);
}

function doImport(url) {	// the URL is actually here for other translators
	var text;
	var holdOver = "";	// part of the text held over from the last loop
	
	while(text = Scholar.read(4096)) {	// read in 4096 byte increments
		var records = text.split("\x1D");
		Scholar.Utilities.debugPrint(records);
		
		if(records.length > 1) {
			records[0] = holdOver + records[0];
			holdOver = records.pop(); // skip last record, since it''s not done
			
			for(var i in records) {
				var newItem = new Scholar.Item();
				newItem.source = url;
				
				// create new record
				var record = new MARC_Record();	
				record.load(records[i], "binary");
				record.translate(newItem);
				
				newItem.complete();
			}
		} else {
			holdOver += text;
		}
	}
}');

REPLACE INTO "csl" VALUES('id-not-yet-given', '2006-08-03 00:33:00', 'American Psychological Association',
'<citationstyle xmlns="http://purl.org/net/xbiblio/csl" xml:lang="en">
   <info>
      <title>American Psychological Association</title>
      <title-short>APA</title-short>
      <edition>5</edition>
      <author>
         <name>Bruce DÕArcus</name>
         <email>bdarcus@sourceforge.net</email>
      </author>
      <dateCreated>2005-05-18</dateCreated>
      <dateModified>2006-07-09</dateModified>
      <source
         href="http://www.english.uiuc.edu/cws/wworkshop/writer_resources/citation_styles/apa/apa.htm"
         >Citation Styles Handbook: APA</source>
      <field>psychology</field>
      <description>Style for the American Psychological
      Association.</description>
   </info>
   <general>
      <names and="text" sort-separator=", " initialize-with=".">
         <original-script position="after" prefix=" "/>
      </names>
      <contributors>
         <label position="before-unless-first" type="verb"/>
      </contributors>
      <locators>
         <label position="before" form="short"/>
      </locators>
      <titles>
         <original-script position="after" prefix=" "/>
      </titles>
      <dates format="year, month day" month="full">
         <original position="after" prefix=" [" suffix="]"/>
      </dates>
      <publishers order="address-publisher" separator=":"/>
      <access order="url-date" separator=", "/>
   </general>
   <citation delimiter=";" type="author-year" sort-order="author-date"
      prefix="(" suffix=")">
      <use-et_al min-authors="6" use-first="6" position="first"/>
      <use-et_al min-authors="6" use-first="1" position="subsequent"/>
      <item-layout>
         <author form="short" suffix=", "/>
         <year/>
         <point-locator prefix=": " include-label="false"/>
      </item-layout>
   </citation>
   <bibliography author-as-sort-order="all" author-shorten-with="ÑÑÑ."
      sort-order="author-date">
      <use-et_al min-authors="4" use-first="3"/>
      <list-layout>
         <heading label="references"/>
      </list-layout>
      <item-layout suffix=".">
         <reftype name="book">
            <author alternate="editor"/>
            <year prefix=" (" suffix=")."/>
            <title font-style="italic" prefix=" " suffix="."/>
            <editor prefix=", "/>
            <publisher/>
            <access prefix=" "/>
         </reftype>
         <reftype name="chapter">
            <author alternate="editor"/>
            <year prefix=" (" suffix=")."/>
            <title prefix=" "/>
            <group class="container">
               <text idref="in"/>
               <editor/>
               <title type="container" font-style="italic" prefix=" " suffix="."/>
               <title type="series" prefix=" " suffix="."/>
               <publisher/>
            </group>
            <access prefix=" "/>
            <pages prefix=", "/>
         </reftype>
         <reftype name="article">
            <author alternate="container-title"/>
            <year prefix=" (" suffix=")."/>
            <title prefix=" "/>
            <group class="container">
               <editor/>
               <title type="container" font-style="italic" prefix=" " suffix="."/>
            </group>
            <access prefix=" "/>
            <volume prefix=" "/>
            <issue prefix="(" suffix=")"/>
            <pages prefix=", "/>
         </reftype>
        <reftype name="legalcase">
          <title/>
          <year prefix=" (" suffix=")"/>
          <access prefix=", "/>
        </reftype>
      </item-layout>
   </bibliography>
</citationstyle>');