-- 32

-- Set the following timestamp to the most recent scraper update date
REPLACE INTO "version" VALUES ('repository', STRFTIME('%s', '2006-07-05 23:40:00'));

REPLACE INTO "translators" VALUES ('96b9f483-c44d-5784-cdad-ce21b984fe01', '2006-06-28 23:08:00', 3, 'Amazon.com Scraper', 'Simon Kornblith', '^http://www\.amazon\.com/(?:gp/(?:product|search)/|exec/obidos/search-handle-url/)', 
'if(doc.location.href.indexOf("search") >= 0) {
	return "multiple";
} else {
	return "book";
}
',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var namespace = doc.documentElement.namespaceURI;
var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
} : null;

function scrape(doc) {
	uri = doc.location.href;
	
	// Retrieve authors
	var xpath = ''/html/body/table/tbody/tr/td[2]/form/div[@class="buying"]/a'';
	var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	for (var i = 0; i < elmts.length; i++) {
		var elmt = elmts[i];
		
		model.addStatement(uri, prefixDC + ''creator'', utilities.cleanString(utilities.getNode(doc, elmt, ''./text()[1]'', nsResolver).nodeValue), false); // Use your own type here
	}
	
	// Retrieve data from "Product Details" box
	var xpath = ''/html/body/table/tbody/tr/td[2]/table/tbody/tr/td[@class="bucket"]/div[@class="content"]/ul/li'';
	var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	for (var i = 0; i < elmts.length; i++) {
		var elmt = elmts[i];
		var attribute = utilities.cleanString(utilities.getNode(doc, elmt, ''./B[1]/text()[1]'', nsResolver).nodeValue);
		if(utilities.getNode(doc, elmt, ''./text()[1]'', nsResolver)) {
			var value = utilities.cleanString(utilities.getNode(doc, elmt, ''./text()[1]'', nsResolver).nodeValue);
			if(attribute == "Publisher:") {
				if(value.lastIndexOf("(") != -1) {
					var date = value.substring(value.lastIndexOf("(")+1, value.length-1);
					jsDate = new Date(date);
					if(!isNaN(jsDate.valueOf())) {
						date = utilities.dateToISO(jsDate);
					}
					
					value = value.substring(0, value.lastIndexOf("(")-1);
				}
				if(value.lastIndexOf(";") != -1) {
					var edition = value.substring(value.lastIndexOf(";")+2, value.length);
					value = value.substring(0, value.lastIndexOf(";"));
				}
				model.addStatement(uri, prefixDC + ''publisher'', value);
				model.addStatement(uri, prefixDC + ''date'', date);
				model.addStatement(uri, prefixDC + ''hasVersion'', edition);
			} else if(attribute == "Language:") {
				model.addStatement(uri, prefixDC + ''language'', value);
			} else if(attribute == "ISBN:") {
				model.addStatement(uri, prefixDC + ''identifier'', ''ISBN ''+value);
			} else if(value.substring(value.indexOf(" ")+1, value.length) == "pages") {
				model.addStatement(uri, prefixDummy + ''pages'', value.substring(0, value.indexOf(" ")));
				model.addStatement(uri, prefixDC + ''medium'', attribute.substring(0, attribute.indexOf(":")));
			}
		}
	}
	
	var xpath = ''/html/body/table/tbody/tr/td[2]/form/div[@class="buying"]/b[@class="sans"]'';
	var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	var title = utilities.cleanString(utilities.getNode(doc, elmts[0], ''./text()[1]'', nsResolver).nodeValue);
	if(title.lastIndexOf("(") != -1 && title.lastIndexOf(")") == title.length-1) {
		title = title.substring(0, title.lastIndexOf("(")-1);
	}
	model.addStatement(uri, prefixDC + ''title'', title);
	model.addStatement(uri, prefixRDF + "type", prefixDummy + "book", false);
}

var searchRe = new RegExp(''^http://www\.amazon\.com/(gp/search/|exec/obidos/search-handle-url/)'');
var m = searchRe.exec(doc.location.href)
if(m) {
	// Why can''t amazon use the same stylesheets
	var xpath;
	if(m == "gp/search/") {
		xpath = ''//table[@class="searchresults"]'';
	} else {
		xpath = ''//table[@cellpadding="3"]'';
	}
	
	var searchresults = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	var items = utilities.getItemArray(doc, searchresults, ''^http://www\.amazon\.com/(gp/product/|exec/obidos/tg/detail/)'', ''^(Buy new|Hardcover|Paperback|Digital)$'');
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	var uris = new Array();
	for(i in items) {
		uris.push(i);
	}
	
	utilities.processDocuments(browser, null, uris, function(browser) { scrape(browser.contentDocument) },
		function() { done(); }, function() {});
	
	wait();
} else {
	scrape(doc);
}');

REPLACE INTO "translators" VALUES ('838d8849-4ffb-9f44-3d0d-aa8a0a079afe', '2006-06-26 16:01:00', 3, 'WorldCat Scraper', 'Simon Kornblith', '^http://(?:new)?firstsearch\.oclc\.org/WebZ/',
'if(doc.title == ''FirstSearch: WorldCat Detailed Record'') {
	return "book";
} else if(doc.title == ''FirstSearch: WorldCat List of Records'') {
	return "multiple";
}
return false;',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var sessionRegexp = /(?:\?|\:)sessionid=([^?:]+)(?:\?|\:|$)/;
var numberRegexp = /(?:\?|\:)recno=([^?:]+)(?:\?|\:|$)/;
var resultsetRegexp = /(?:\?|\:)resultset=([^?:]+)(?:\?|\:|$)/;
var hostRegexp = new RegExp("http://([^/]+)/");

var uri = doc.location.href;
	
var sMatch = sessionRegexp.exec(uri);
var sessionid = sMatch[1];

var hMatch = hostRegexp.exec(uri);
var host = hMatch[1];

var newUri, exportselect;

if(doc.title == ''FirstSearch: WorldCat Detailed Record'') {
	var publisherRegexp = /^(.*), (.*?),?$/;
	
	var nMatch = numberRegexp.exec(uri);
	if(nMatch) {
		var number = nMatch[1];
	} else {
		number = 1;
	}
	
	var rMatch = resultsetRegexp.exec(uri);
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
	var items = utilities.getItemArray(doc, doc, ''/WebZ/FSFETCH\\?fetchtype=fullrecord'', ''^(See more details for locating this item|Detailed Record)$'');
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	// Set BookMark cookie
	for(i in items) {	// Hack to get first item
		var myCookie = sessionid+":";
		var rMatch = resultsetRegexp.exec(i);
		var resultset = rMatch[1];
		break;
	}
	var uris = new Array();
	for(i in items) {
		var nMatch = numberRegexp.exec(i);
		myCookie += resultset+"_"+nMatch[1]+",";
		uris.push(i);
	}
	myCookie = myCookie.substr(0, myCookie.length-1);
	doc.cookie = "BookMark="+myCookie;
	
	exportselect = ''marked'';
	newUri = ''http://''+host+''/WebZ/DirectExport?numrecs=10:smartpage=directexport:entityexportnumrecs=10:entityexportresultset='' + resultset + '':entityexportrecno=1:sessionid='' + sessionid + '':entitypagenum=29:0'';
}

utilities.HTTPUtilities.doPost(newUri, ''exportselect=''+exportselect+''&exporttype=plaintext'', null, function(text) {
	var lineRegexp = new RegExp();
	lineRegexp.compile("^([\\w() ]+): *(.*)$");
	
	var k = 0;
	var uri = uris[k];
	model.addStatement(uri, prefixRDF + "type", prefixDummy + "book", false);
	
	var lines = text.split(''\n'');
	for(var i=0;i<lines.length;i++) {
		match = lineRegexp.exec(lines[i]);
		if(lines[i] == "--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------") {
			k++;
			if(uris[k]) {
				uri = uris[k];
				model.addStatement(uri, prefixRDF + "type", prefixDummy + "book", false);
			} else {
				break;
			}
		} else if(match) {
			if(match[1] == ''Title'') {
				var title = match[2];
				if(!lineRegexp.test(lines[i+1])) {
					i++;
					title += '' ''+lines[i];
				}
				if(title.substring(title.length-2) == " /") {
					title = title.substring(0, title.length-2);
				}
				model.addStatement(uri, prefixDC + ''title'', title);
			} else if(match[1] == ''Author(s)'') {
				var authors = match[2].split('';'');
				if(authors) {
					model.addStatement(uri, prefixDC + ''creator'', utilities.cleanAuthor(authors[0]));
					for(var j=1; j<authors.length; j+=2) {
						if(authors[j-1].substring(0, 1) == ''('') {
							j++;
						}
						model.addStatement(uri, prefixDC + ''creator'', utilities.cleanAuthor(authors[j]));
					}
				} else {
						model.addStatement(uri, prefixDC + ''creator'', utilities.trimString(match[2]));
				}
			} else if(match[1] == ''Publication'') {
				// Don''t even try to deal with this. The WorldCat metadata is of poor enough quality that this isn''t worth it.
				match[2] = utilities.trimString(match[2]);
				if(match[2].substring(match[2].length-1) == '','') {
						match[2] = match[2].substring(0, match[2].length-1);
				}
				model.addStatement(uri, prefixDC + ''publisher'', match[2]);
			} else if(match[1] == ''Language'') {
				model.addStatement(uri, prefixDC + ''language'', utilities.trimString(match[2]));
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
								model.addStatement(uri, prefixDC + ''identifier'', type + '' '' + value);
							}
							j++;
						}
				}
			} else if(match[1] == ''Year'') {
				model.addStatement(uri, prefixDC + ''year'', match[2]);
			}
		}
	}
	
	done();
})
wait();');

REPLACE INTO "translators" VALUES ('88915634-1af6-c134-0171-56fd198235ed', '2006-06-26 21:40:00', 3, 'LOC/Voyager WebVoyage Scraper', 'Simon Kornblith', 'Pwebrecon\.cgi',
'var export_options = doc.forms.namedItem(''frm'').elements.namedItem(''RD'').options;
for(i in export_options) {
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
return false;',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var uri = doc.location.href;
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
	
	var tableRows = utilities.gatherElementsOnXPath(doc, doc, ''/html/body/form/table/tbody/tr[td/input[@type="checkbox"]]'', nsResolver);
	// Go through table rows
	for(var i=0; i<tableRows.length; i++) {
		// CHK is what we need to get it all as one file
		var input = utilities.getNode(doc, tableRows[i], ''./td/input[@name="CHK"]'', nsResolver);
		checkboxes[i] = input.value;
		var links = utilities.gatherElementsOnXPath(doc, tableRows[i], ''.//a'', nsResolver);
		urls[i] = links[0].href;
		utilities.debugPrint(urls[i]+" = "+links[0].href);
		// Go through links
		for(var j=0; j<links.length; j++) {
			if(tagRegexp.test(links[j].href)) {
				var text = utilities.getNodeString(doc, links[j], ''.//text()'', null);
				if(text) {
					text = utilities.cleanString(text);
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
	
	var items = utilities.selectItems(availableItems);
	if(!items) {
		return true;
	}
	
	// add arguments for items we need to grab
	for(i in items) {
		postString += "CHK="+checkboxes[i]+"&";
	}
}

var raw, unicode, latin1;

for(i in form.elements) {
	if(form.elements[i].type == ''HIDDEN'' || form.elements[i].type == ''hidden'') {
		postString += escape(form.elements[i].name)+''=''+escape(form.elements[i].value)+''&'';
	}
}

var export_options = form.elements.namedItem(''RD'').options;
for(i in export_options) {
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
postString += ''RD=''+i+''&MAILADDY=&SAVE=Press+to+SAVE+or+PRINT'';

utilities.debugPrint(postString);

// No idea why this doesn''t work as post
utilities.HTTPUtilities.doGet(newUri+''?''+postString, null, function(text) {
	var records = text.split("\x1D");
	for(var i=0; i<(records.length-1); i++) {
		if(multiple) {
			utilities.debugPrint("uri = urls["+i+"]");
			uri = urls[i];
			utilities.debugPrint("my uri = "+uri);
		}
		var record = new MARC_Record();
		record.load(records[i], "binary");
		utilities.importMARCRecord(record, uri, model);
	}
	done();
})
wait();');

REPLACE INTO "translators" VALUES ('d921155f-0186-1684-615c-ca57682ced9b', '2006-06-26 16:01:00', 3, 'JSTOR Scraper', 'Simon Kornblith', '^http://www\.jstor\.org/(?:view|browse|search/)', 
'var namespace = doc.documentElement.namespaceURI;
var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
} : null;

// See if this is a seach results page
if(doc.title == "JSTOR: Search Results") {
	return "multiple";
}

// If this is a view page, find the link to the citation
var xpath = ''/html/body/div[@class="indent"]/center/font/p/a[@class="nav"]'';
var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
if(!elmts.length) {
	var xpath = ''/html/body/div[@class="indent"]/center/p/font/a[@class="nav"]'';
	var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
}
if(elmts && elmts.length) {
	return "journalArticle";
}
return false;', 'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var namespace = doc.documentElement.namespaceURI;
var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
} : null;

var uri = doc.location.href;
var saveCitations = new Array();

if(doc.title == "JSTOR: Search Results") {
	var availableItems = new Object();
	
	// Require link to match this
	var tagRegexp = new RegExp();
	tagRegexp.compile(''citationAction='');
	
	var tableRows = utilities.gatherElementsOnXPath(doc, doc, ''/html/body/div[@class="indent"]/table/tbody/tr[td/span[@class="printDownloadSaveLinks"]]'', nsResolver);
	// Go through table rows
	for(var i=0; i<tableRows.length; i++) {
		var links = utilities.gatherElementsOnXPath(doc, tableRows[i], ''.//a'', nsResolver);
		// Go through links
		for(var j=0; j<links.length; j++) {
			if(tagRegexp.test(links[j].href)) {
				var text = utilities.getNode(doc, tableRows[i], ''.//strong/text()'', null);
				if(text && text.nodeValue) {
					text = utilities.cleanString(text.nodeValue);
					if(availableItems[links[j].href]) {
						availableItems[links[j].href] += " "+text;
					} else {
						availableItems[links[j].href] = text;
					}
				}
			}
		}
	}
	
	var items = utilities.selectItems(availableItems);
	if(!items) {
		return true;
	}
	
	for(i in items) {
		saveCitations.push(i.replace(''citationAction=remove'', ''citationAction=save''));
	}
} else {
	// If this is a view page, find the link to the citation
	var xpath = ''/html/body/div[@class="indent"]/center/font/p/a[@class="nav"]'';
	var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	if(!elmts.length) {
		var xpath = ''/html/body/div[@class="indent"]/center/p/font/a[@class="nav"]'';
		var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	}
	var saveCitation = elmts[0].href;
	var viewSavedCitations = elmts[1].href;
	saveCitations.push(saveCitation.replace(''citationAction=remove'', ''citationAction=save''));
}

function getList(urls, each, done, error) {
	var url = urls.shift();
	utilities.HTTPUtilities.doGet(url, null, function(text) {
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

function newDataObject() {
	var data = new Object();
	data[prefixDC + "title"] = new Array();
	data[prefixDC + "creator"] = new Array();
	data[prefixDummy + "publication"] = new Array();
	data[prefixDummy + "volume"] = new Array();
	data[prefixDummy + "number"] = new Array();
	data[prefixDummy + "series"] = new Array();
	data[prefixDC + "date"] = new Array();
	data[prefixDummy + "pages"] = new Array();
	data[prefixDC + "identifier"] = new Array();
	data[prefixDC + "publisher"] = new Array();
	return data;
}

utilities.HTTPUtilities.doGet(''http://www.jstor.org/browse?citationAction=removeAll&confirmRemAll=on&viewCitations=1'', null, function() {	// clear marked
	// Mark all our citations
	getList(saveCitations, null, function() {						// mark this
		utilities.HTTPUtilities.doGet(''http://www.jstor.org/browse/citations.txt?exportAction=Save+as+Text+File&exportFormat=cm&viewCitations=1'', null, function(text) {
																						// get marked
			var k = 0;
			var lines = text.split("\n");
			var haveStarted = false;
			var data = newDataObject();
			var newItemRe = /^<[0-9]+>/;
			var stableURL, ISSN;
			
			for(i in lines) {
				if(lines[i].substring(0,3) == "<1>") {
					haveStarted = true;
				} else if(newItemRe.test(lines[i])) {
					if(!stableURL) {
						if(ISSN) {
							stableURL = "http://www.jstor.org/browse/"+ISSN;
						} else {	// Just make sure it''s unique
							stableURL = k;
							k++;
						}
					}
					model.addStatement(stableURL, prefixRDF + "type", prefixDummy + "journalArticle", false);
					for(i in data) {
						if(data[i].length) {
							for(j in data[i]) {
								model.addStatement(stableURL, i, data[i][j]);
							}
						}
					}
					var data = newDataObject();
					delete ISSN;
					delete stableURL;
				} else if(lines[i].substring(2, 5) == " : " && haveStarted) {
					var fieldCode = lines[i].substring(0, 2);
					var fieldContent = utilities.cleanString(lines[i].substring(5))
					
					if(fieldCode == "TI") {
						data[prefixDC + "title"].push(fieldContent);
					} else if(fieldCode == "AU") {
						var authors = fieldContent.split(";");
						for(j in authors) {
							var author = authors[j];
							if(author) {
								var splitNames = author.split('', '');
								if(splitNames) {
									author = splitNames[1]+'' ''+splitNames[0];
								}
								data[prefixDC + "creator"].push(author);
							}
						}
					} else if(fieldCode == "SO") {
						data[prefixDummy + "publication"].push(fieldContent);
					} else if(fieldCode == "VO") {
						data[prefixDummy + "volume"].push(fieldContent);
					} else if(fieldCode == "NO") {
						data[prefixDummy + "number"].push(fieldContent);
					} else if(fieldCode == "SE") {
						data[prefixDummy + "series"].push(fieldContent);
					} else if(fieldCode == "DA") {
						var date = new Date(fieldContent.replace(".", ""));
						if(isNaN(date.valueOf())) {
							data[prefixDC + "date"].push(fieldContent);
						} else {
							data[prefixDC + "date"].push(utilities.dateToISO(date));
						}
					} else if(fieldCode == "PP") {
						data[prefixDummy + "pages"].push(fieldContent);
					} else if(fieldCode == "EI") {
						stableURL = fieldContent;
					} else if(fieldCode == "IN") {
						data[prefixDC + "identifier"].push("ISSN "+fieldContent);
						ISSN = fieldContent;
					} else if(fieldCode == "PB") {
						data[prefixDC + "publisher"].push(fieldContent);
					}
				}
			}
			
			// Loop through again so that we can add with the stableURL
			if(!stableURL) {
				if(ISSN) {
					stableURL = "http://www.jstor.org/browse/"+ISSN;
				} else {	// Just make sure it''s unique
					stableURL = k;
					k++;
				}
			}
			model.addStatement(stableURL, prefixRDF + "type", prefixDummy + "journalArticle", false);
			for(i in data) {
				if(data[i].length) {
					for(j in data[i]) {
						model.addStatement(stableURL, i, data[i][j]);
					}
				}
			}
			
			done();
		});
	}, function() {});
});

wait();');

REPLACE INTO "translators" VALUES ('e85a3134-8c1a-8644-6926-584c8565f23e', '2006-06-26 16:01:00', 3, 'History Cooperative Scraper', 'Simon Kornblith', '^http://www\.historycooperative\.org/(?:journals/.+/.+/.+\.html$|cgi-bin/search.cgi)', 
'if(doc.title == "History Cooperative: Search Results") {
	return "multiple";
} else {
	return "journalArticle";
}',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

function associateMeta(uri, metaTags, field, rdfUri) {
	var field = metaTags.namedItem(field);
	if(field) {
		model.addStatement(uri, rdfUri, field.getAttribute("content"), false);
	}
}

function scrape(doc) {
	var uri = doc.location.href;
	var month, year;
	var metaTags = doc.getElementsByTagName("meta");
	associateMeta(uri, metaTags, "Title", prefixDC + "title");
	associateMeta(uri, metaTags, "Journal", prefixDummy + "publication");
	associateMeta(uri, metaTags, "Volume", prefixDummy + "volume");
	associateMeta(uri, metaTags, "Issue", prefixDummy + "number");
	
	var author = metaTags.namedItem("Author");
	if(author) {
		var authors = author.getAttribute("content").split(" and ");
		for(j in authors) {
			model.addStatement(uri, prefixDC + "creator", authors[j], false);
		}
	}
	
	var month = metaTags.namedItem("PublicationMonth");
	var year = metaTags.namedItem("PublicationYear");
	if(month && year) {
		model.addStatement(uri, prefixDC + "date", month.getAttribute("content")+" "+year.getAttribute("content"), false);
	}
	
	model.addStatement(uri, prefixRDF + "type", prefixDummy + "journalArticle", false);
}

if(doc.title == "History Cooperative: Search Results") {
	var items = utilities.getItemArray(doc, doc, ''^http://[^/]+/journals/.+/.+/.+\.html$'');
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	var uris = new Array();
	for(i in items) {
		uris.push(i);
	}
	
	utilities.processDocuments(browser, null, uris, function(browser) { scrape(browser.contentDocument) },
		function() { done(); }, function() {});
	
	wait();
} else {
	scrape(doc);
}');

REPLACE INTO "translators" VALUES ('4fd6b89b-2316-2dc4-fd87-61a97dd941e8', '2006-06-28 22:52:00', 3, 'InnoPAC Scraper', 'Simon Kornblith', '^http://[^/]+/(?:search/|record=)',
'// First, check to see if the URL alone reveals InnoPAC, since some sites don''t reveal the MARC button
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
var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
if(elmts.length) {
	return "book";
}
// Also, check for links to an item display page
var tags = doc.getElementsByTagName("a");
for(i=0; i<tags.length; i++) {
	if(matchRegexp.test(tags[i].href)) {
		return "multiple";
	}
}
return false;
',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';


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
	var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	if(elmts.length) {
		newUri = elmts[0].href;
	}
}

if(newUri) {
	utilities.loadDocument(newUri, browser, function(newBrowser) {
		newDoc = newBrowser.contentDocument;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var xpath = ''//pre'';
		var elmts = utilities.gatherElementsOnXPath(newDoc, newDoc, xpath, nsResolver);
		
		var text = utilities.getNode(doc, elmts[0], ''./text()[1]'', nsResolver).nodeValue;
		
		var record = new MARC_Record();
		record.load(text, "MARC_PAC");
		utilities.importMARCRecord(record, uri, model);
		done();
	}, function() {});
} else {	// Search results page
	// Require link to match this
	var tagRegexp = new RegExp();
	tagRegexp.compile(''^http://[^/]+/search/[^/]+/[^/]+/1\%2C[^/]+/frameset'');
	
	var checkboxes = new Array();
	var urls = new Array();
	var availableItems = new Array();
	
	var tableRows = utilities.gatherElementsOnXPath(doc, doc, ''//table[@class="browseScreen"]//tr[td/input[@name="save"]]'', nsResolver);
	// Go through table rows
	for(var i=0; i<tableRows.length; i++) {
		// CHK is what we need to get it all as one file
		var input = utilities.getNode(doc, tableRows[i], ''./td/input[@name="save"]'', nsResolver);
		checkboxes[i] = input.value;
		var links = utilities.gatherElementsOnXPath(doc, tableRows[i], ''.//a'', nsResolver);
		urls[i] = links[0].href;
		// Go through links
		for(var j=0; j<links.length; j++) {
			if(tagRegexp.test(links[j].href)) {
				var text = utilities.getNodeString(doc, links[j], ''.//text()'', null);
				if(text) {
					text = utilities.cleanString(text);
					if(availableItems[i]) {
						availableItems[i] += " "+text;
					} else {
						availableItems[i] = text;
					}
				}
			}
		}
	}
	
	var items = utilities.selectItems(availableItems);
	
	if(!items) {
		return true;
	}
	
	var urlRe = new RegExp("^(http://[^/]+(/search/[^/]+/))");
	var m = urlRe.exec(urls[0]);
	var clearUrl = m[0]+"?clear_saves=1";
	var postUrl = m[0];
	var exportUrl = m[1]+"++export/1,-1,-1,B/export";
	
	var postString = "";
	for(i in items) {
		postString += "save="+checkboxes[i]+"&";
	}
	/*var hiddens = utilities.gatherElementsOnXPath(doc, doc, ''//form[@action="''+actionUrl+''"]//input[@type="hidden"]'', nsResolver);
	for(var i=0; i<hiddens.length; i++) {
		if(hiddens[i].name != "save_func") {
			postString += hiddens[i].name+"="+hiddens[i].value+"&";
		}
	}*/
	postString += "save_func=save_marked";
	
	
	utilities.HTTPUtilities.doGet(clearUrl, null, function() {
		utilities.HTTPUtilities.doPost(postUrl, postString, null, function() {
			utilities.HTTPUtilities.doPost(exportUrl, "ex_format=50&ex_device=45&SUBMIT=Submit", null, function(text) {
				var records = text.split("\x1D");
				for(var i=0; i<(records.length-1); i++) {
					var record = new MARC_Record();
					record.load(records[i], "binary");
					utilities.importMARCRecord(record, urls[i], model);
				}
				done();
			});
		});
	});
}

wait();');

REPLACE INTO "translators" VALUES ('add7c71c-21f3-ee14-d188-caf9da12728b', '2006-06-26 16:01:00', 3, 'SIRSI 2003+ Scraper', 'Simon Kornblith', '/uhtbin/cgisirsi',
'var namespace = doc.documentElement.namespaceURI;
var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
} : null;

var xpath = ''//tr[th[@class="viewmarctags"]][td[@class="viewmarctags"]]'';
var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
if(elmts.length) {
	return "book";
}
var xpath = ''//td[@class="searchsum"]/table'';
var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
if(elmts.length) {
	return "multiple";
}

return false;',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var namespace = doc.documentElement.namespaceURI;
var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
} : null;

var data = new Object();

function scrape(doc) {
	var uri = doc.location.href;
	
	var xpath = ''//tr[th[@class="viewmarctags"]][td[@class="viewmarctags"]]'';
	var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	if(!elmts.length) {
		return false;
	}
	for (var i = 0; i < elmts.length; i++) {
		var elmt = elmts[i];
		try {
			var node = utilities.getNode(doc, elmt, ''./TD[1]/A[1]/text()[1]'', nsResolver);
			if(!node) {
				var node = utilities.getNode(doc, elmt, ''./TD[1]/text()[1]'', nsResolver);
			}
			if(node) {
				var field = utilities.superCleanString(utilities.getNode(doc, elmt, ''./TH[1]/text()[1]'', nsResolver).nodeValue);
				field = field.toLowerCase();
				var value = utilities.superCleanString(node.nodeValue);
				var rdfUri = null;
				if(field == "publisher") {
					rdfUri = prefixDC + ''publisher'';
				} else if(field == "pub date") {
					rdfUri = prefixDC + ''year'';
					
					var re = /[0-9]+/;
					var m = re.exec(value);
					value = m[0];
				} else if(field == "isbn") {
					rdfUri = prefixDC + ''identifier'';
					
					var re = /^[0-9](?:[0-9X]+)/;
					var m = re.exec(value);
					value = "ISBN "+m[0];
				} else if(field == "title") {
					rdfUri = prefixDC + ''title'';
					var titleParts = value.split(" / ");
					value = titleParts[0];
				} else if(field == "publication info") {
					rdfUri = prefixDummy + ''place'';
					var pubParts = value.split(" : ");
					value = pubParts[0];
				} else if(field == "personal author") {
					rdfUri = prefixDC + ''creator'';
					value = utilities.cleanAuthor(node.nodeValue);
				} else if(field == "added author") {
					rdfUri = prefixDC + ''contributor'';
					value = utilities.cleanAuthor(node.nodeValue);
				} else if(field == "corporate author") {
					rdfUri = prefixDummy + ''corporateCreator'';
				}
				if(rdfUri) {
					var insert = true;
					if(data && data[rdfUri]) {
						for(j in data[rdfUri]) {
							if(data[rdfUri][j] == value) {
								insert = false;
								break;
							}
						}
					} else if(!data[rdfUri]) {
						data[rdfUri] = new Array();
					}
					if(insert) {
						data[rdfUri].push(value);
						model.addStatement(uri, rdfUri, value, true);
					}
				}
			}
		} catch (e) {}
	}
	
	var callNumber = utilities.getNode(doc, doc, ''//tr/td[1][@class="holdingslist"]/text()'', nsResolver);
	if(callNumber && callNumber.nodeValue) {
		model.addStatement(uri, prefixDC + "identifier", "CN "+callNumber.nodeValue, true);
	}
	
	model.addStatement(uri, prefixRDF + "type", prefixDummy + "book", false);
	return true;
}

if(!scrape(doc)) {	
	var checkboxes = new Array();
	var urls = new Array();
	var availableItems = new Array();
	
	var tableRows = utilities.gatherElementsOnXPath(doc, doc, ''//td[@class="searchsum"]/table[//input[@value="Details"]]'', nsResolver);
	// Go through table rows
	for(var i=1; i<tableRows.length; i++) {
		var input = utilities.getNode(doc, tableRows[i], ''.//input[@value="Details"]'', nsResolver);
		checkboxes[i] = input.name;
		var text = utilities.getNodeString(doc, tableRows[i], ''.//label/strong//text()'', nsResolver);
		if(text) {
			availableItems[i] = text;
		}
	}
	
	var items = utilities.selectItems(availableItems);
	
	if(!items) {
		return true;
	}
	
	var hostRe = new RegExp("^http://[^/]+");
	var m = hostRe.exec(doc.location.href);
	var hitlist = doc.forms.namedItem("hitlist");
	var baseUrl = m[0]+hitlist.getAttribute("action")+"?first_hit="+hitlist.elements.namedItem("first_hit").value+"&last_hit="+hitlist.elements.namedItem("last_hit").value;
	utilities.debugPrint(baseUrl);
	
	var uris = new Array();
	for(i in items) {
		uris.push(baseUrl+"&"+checkboxes[i]+"=Details");
	}
	
	utilities.processDocuments(browser, null, uris, function(browser) { scrape(browser.contentDocument) },
		function() { done() }, function() {});
	
	wait();
}
');

REPLACE INTO "translators" VALUES ('a77690cf-c5d1-8fc4-110f-d1fc765dcf88', '2006-06-26 16:01:00', 3, 'ProQuest Scraper', 'Simon Kornblith', '^http://proquest\.umi\.com/pqdweb\?((?:.*\&)?did=.*&Fmt=[0-9]|(?:.*\&)Fmt=[0-9].*&did=|(?:.*\&)searchInterface=)',
'if(doc.title == "Results") {
	return "magazineArticle";
} else {
	return "book";
}',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var namespace = doc.documentElement.namespaceURI;
var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
} : null;

function scrape(doc) {
	var uri = doc.location.href;
	
	// Title
	var xpath = ''/html/body/span[@class="textMedium"]/table/tbody/tr/td[@class="headerBlack"]/strong//text()'';
	var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	var title = "";
	for (var i = 0; i < elmts.length; i++) {
		var elmt = elmts[i];
		title += elmt.nodeValue;
	}
	if(title) {
		model.addStatement(uri, prefixDC + ''title'', title, true);
	}
	
	// Authors
	var xpath = ''/html/body/span[@class="textMedium"]/table/tbody/tr/td[@class="textMedium"]/a/em'';
	var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	for (var i = 0; i < elmts.length; i++) {
		var elmt = elmts[i];
		
		// Dirty hack to fix highlighted words
		var xpath = ''.//text()'';
		var author = "";
		var authorElmts = utilities.gatherElementsOnXPath(doc, elmt, xpath, nsResolver);
		for (var j = 0; j < authorElmts.length; j++) {
			var authorElmt = authorElmts[j];
			author += authorElmt.nodeValue;
		}
		model.addStatement(uri, prefixDC + ''creator'', utilities.cleanAuthor(author), true);
	}
	
	// Other info
	var xpath = ''/html/body/span[@class="textMedium"]/font/table/tbody/tr'';
	var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	for (var i = 0; i < elmts.length; i++) {
		var elmt = elmts[i];
		var field = utilities.superCleanString(utilities.getNode(doc, elmt, ''./TD[1]/text()[1]'', nsResolver).nodeValue).toLowerCase();
		if(field == "publication title") {
			var publication = utilities.getNode(doc, elmt, ''./TD[2]/A[1]/text()[1]'', nsResolver);
			if(publication.nodeValue) {
				model.addStatement(uri, prefixDummy + ''publication'', utilities.superCleanString(publication.nodeValue), true);
			}
			var place = utilities.getNode(doc, elmt, ''./TD[2]/text()[1]'', nsResolver);
			if(place.nodeValue) {
				model.addStatement(uri, prefixDummy + ''place'', utilities.superCleanString(place.nodeValue), true);
			}
			var date = utilities.getNode(doc, elmt, ''./TD[2]/A[2]/text()[1]'', nsResolver);		
			if(date.nodeValue) {
				date = date.nodeValue;
				var jsDate = new Date(utilities.superCleanString(date));
				if(!isNaN(jsDate.valueOf())) {
					date = utilities.dateToISO(jsDate);
				}
				model.addStatement(uri, prefixDC + ''date'', date, true);
			}
			var moreInfo = utilities.getNode(doc, elmt, ''./TD[2]/text()[2]'', nsResolver);
			if(moreInfo.nodeValue) {
				moreInfo = utilities.superCleanString(moreInfo.nodeValue);
				var parts = moreInfo.split(";\xA0");
				
				var issueRegexp = /^(\w+)\.(?: |\xA0)?(.+)$/
				var issueInfo = parts[0].split(",\xA0");
				for(j in issueInfo) {
					var m = issueRegexp.exec(issueInfo[j]);
					if(m) {
						var info = m[1].toLowerCase();
						if(info == "vol") {
							model.addStatement(uri, prefixDummy + ''volume'', utilities.superCleanString(m[2]), true);
						} else if(info == "iss" || info == "no") {
							model.addStatement(uri, prefixDummy + ''number'', utilities.superCleanString(m[2]), true);
						}
					}
				}
				if(parts[1] && utilities.superCleanString(parts[1]).substring(0, 3).toLowerCase() == "pg.") {
					var re = /[0-9\-]+/;
					var m = re.exec(parts[1]);
					
					if(m) {
						model.addStatement(uri, prefixDummy + ''pages'', m[0], true);
					}
				}
			}
		} else if(field == "source type") {
			var value = utilities.getNode(doc, elmt, ''./TD[2]/text()[1]'', nsResolver);
			if(value.nodeValue) {
				value = utilities.superCleanString(value.nodeValue).toLowerCase();
				utilities.debugPrint(value);
				
				if(value.indexOf("periodical") >= 0) {
					model.addStatement(uri, prefixRDF + "type", prefixDummy + "magazineArticle", false);
				} else if(value.indexOf("newspaper") >= 0) {
					model.addStatement(uri, prefixRDF + "type", prefixDummy + "newspaperArticle", false);
				} else {
					model.addStatement(uri, prefixRDF + "type", prefixDummy + "book", false);
				}
			}
		} else if(field == "isbn" || field == "issn" || field == "issn/isbn") {
			var value = utilities.getNode(doc, elmt, ''./TD[2]/text()[1]'', nsResolver);
			if(value) {
				var type;
				value = utilities.superCleanString(value.nodeValue);
				if(value.length == 10 || value.length == 13) {
					type = "ISBN";
				} else if(value.length == 8) {
					type = "ISSN";
				}
				if(type) {
					model.addStatement(uri, prefixDC + "identifier", type+" "+value, false);
				}
			}
		}
	}
}

if(doc.title == "Results") {
	var items = new Object();
	
	// Require link to match this
	var tagRegexp = new RegExp();
	tagRegexp.compile(''^http://[^/]+/pqdweb\\?((?:.*&)?did=.*&Fmt=[12]|(?:.*&)Fmt=[12].*&did=)'');
	
	var tableRows = utilities.gatherElementsOnXPath(doc, doc, ''/html/body/table/tbody/tr/td/table/tbody/tr/td/table/tbody/tr[@class="rowUnMarked"]/td[3][@class="textMedium"]'', nsResolver);
	// Go through table rows
	for(var i=0; i<tableRows.length; i++) {
		var links = utilities.gatherElementsOnXPath(doc, tableRows[i], ''.//a'', nsResolver);
		// Go through links
		for(var j=0; j<links.length; j++) {
			if(tagRegexp.test(links[j].href)) {
				var text = utilities.getNode(doc, tableRows[i], ''./a[@class="bold"]/text()'', null);
				if(text && text.nodeValue) {
					text = utilities.cleanString(text.nodeValue);
					items[links[j].href] = text;
				}
				break;
			}
		}
	}
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	var uris = new Array();
	for(i in items) {
		uris.push(i);
	}
	
	utilities.processDocuments(browser, null, uris, function(browser) { scrape(browser.contentDocument) },
		function() { done(); }, function() {});
	
	wait();
} else {
	var fmtCheck = /(?:\&|\?)Fmt=([0-9]+)/
	var m = fmtCheck.exec(doc.location.href);
	if(m && (m[1] == "1" || m[1] == "2")) {
		scrape(doc);
	} else if(m) {
		utilities.loadDocument(doc.location.href.replace("Fmt="+m[1], "Fmt=1"), browser, function(browser) { scrape(browser.contentDocument); done(); }, function() {});
		wait();
	}
}');

REPLACE INTO "translators" VALUES ('6773a9af-5375-3224-d148-d32793884dec', '2006-06-26 16:01:00', 3, 'InfoTrac Scraper', 'Simon Kornblith', '^http://infotrac-college\.thomsonlearning\.com/itw/infomark/',
'if(doc.title.substring(0, 8) == "Article ") {
	return "magazineArticle";
} else doc.title.substring(0, 10) == "Citations ") {
	return "multiple";
}
return false;',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var namespace = doc.documentElement.namespaceURI;
var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
} : null;

function extractCitation(uri, elmts, title) {
	if(title) {
		model.addStatement(uri, prefixDC + "title", utilities.superCleanString(title), true);
	}
	for (var i = 0; i < elmts.length; i++) {
		var elmt = elmts[i];
		var colon = elmt.nodeValue.indexOf(":");
		var field = elmt.nodeValue.substring(1, colon).toLowerCase();
		var value = elmt.nodeValue.substring(colon+1, elmt.nodeValue.length-1);
		if(field == "title") {
			model.addStatement(uri, prefixDC + "title", utilities.superCleanString(value), true);
		} else if(field == "journal") {
			model.addStatement(uri, prefixDummy + "publication", value, true);
		} else if(field == "pi") {
			parts = value.split(" ");
			var date = "";
			var isDate = true;
			var rdfUri, type;
			for(j in parts) {
				firstChar = parts[j].substring(0, 1);
				rdfUri = false;
				
				if(firstChar == "v") {
					rdfUri = prefixDummy + "volume";
					type = prefixDummy + "journalArticle";
				} else if(firstChar == "i") {
					rdfUri = prefixDummy + "number";
				} else if(firstChar == "p") {
					rdfUri = prefixDummy + "pages";
					var pagesRegexp = /p(\w+)\((\w+)\)/;
					var match = pagesRegexp.exec(parts[j]);
					if(match) {
						var finalPage = parseInt(match[1])+parseInt(match[2])
						parts[j] = "p"+match[1]+"-"+finalPage.toString();
					} else if(!type) {
						var justPageNumber = parts[j].substr(1);
						if(parseInt(justPageNumber).toString() != justPageNumber) {
							type = prefixDummy + "newspaperArticle";
						}
					}
				}
				
				if(rdfUri) {
					isDate = false;
					if(parts[j] != "pNA") {		// not a real page number
						var content = parts[j].substring(1);
						model.addStatement(uri, rdfUri, content, false);
					} else if(!type) {
						type = prefixDummy + "newspaperArticle";
					}
				} else if(isDate) {
					date += " "+parts[j];
				}
			}
			
			// Set type
			if(!type) {
				type = prefixDummy + "magazineArticle";
			}
			model.addStatement(uri, prefixRDF + "type", type, false);
			
			if(date != "") {
				model.addStatement(uri, prefixDC + "date", date.substring(1), true);
			}
		} else if(field == "author") {
			model.addStatement(uri, prefixDC + "creator", utilities.cleanAuthor(value), true);
		}
	}
}


var uri = doc.location.href;
if(doc.title.substring(0, 8) == "Article ") {
	var xpath = ''/html/body//comment()'';
	var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
	extractCitation(uri, elmts);
} else {
	var items = new Array();
	var uris = new Array();
	var tableRows = utilities.gatherElementsOnXPath(doc, doc, ''/html/body//table/tbody/tr/td[a/b]'', nsResolver);
	// Go through table rows
	for(var i=0; i<tableRows.length; i++) {
		var link = utilities.getNode(doc, tableRows[i], ''./a'', nsResolver);
		uris[i] = link.href;
		var article = utilities.getNode(doc, link, ''./b/text()'', nsResolver);
		items[i] = article.nodeValue;
		// Chop off final period
		if(items[i].substr(items[i].length-1) == ".") {
			items[i] = items[i].substr(0, items[i].length-1);
		}
	}
	
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	for(i in items) {
		var elmts = utilities.gatherElementsOnXPath(doc, tableRows[i], ".//comment()", nsResolver);
		extractCitation(uris[i], elmts, items[i]);
	}
}');

REPLACE INTO "translators" VALUES ('b047a13c-fe5c-6604-c997-bef15e502b09', '2006-06-26 16:01:00', 3, 'LexisNexis Scraper', 'Simon Kornblith', '^http://web\.lexis-nexis\.com/universe/(?:document|doclist)',
'var detailRe = new RegExp("^http://[^/]+/universe/document");
if(detailRe.test(doc.location.href)) {
	return "newspaperArticle";
} else {
	return "multiple";
}',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

function scrape(doc) {
	var uri = doc.location.href;
	
	var citationDataDiv;
	var divs = doc.getElementsByTagName("div");
	for(i in divs) {
		if(divs[i].className == "bodytext") {
			citationDataDiv = divs[i];
			break;
		}
	}
	
	centerElements = citationDataDiv.getElementsByTagName("center");
	var elementParts = centerElements[0].innerHTML.split(/<br[^>]*>/gi);
	model.addStatement(uri, prefixDummy + "publication", elementParts[elementParts.length-1], true);
	
	var dateRegexp = /<br[^>]*>(?:<b>)?([A-Z][a-z]+)(?:<\/b>)? ([0-9]+, [0-9]{4})/;
	var m = dateRegexp.exec(centerElements[centerElements.length-1].innerHTML);
	if(m) {
		var jsDate = new Date(m[1]+" "+m[2]);
		model.addStatement(uri, prefixDC + "date", utilities.dateToISO(jsDate), true);
	} else {
		var elementParts = centerElements[centerElements.length-1].innerHTML.split(/<br[^>]*>/gi);
		model.addStatement(uri, prefixDC + "date", elementParts[1], true);
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
	
	citationData = utilities.cleanTags(citationData);
	
	var headlineRegexp = /\n(?:HEADLINE|TITLE|ARTICLE): ([^\n]+)\n/;
	var m = headlineRegexp.exec(citationData);
	if(m) {
		model.addStatement(uri, prefixDC + "title", utilities.cleanTags(m[1]), true);
	}
	
	var bylineRegexp = /\nBYLINE:  *(\w[\w\- ]+)/;
	var m = bylineRegexp.exec(citationData);
	if(m) {
		if(m[1].substring(0, 3).toLowerCase() == "by ") {
			m[1] = m[1].substring(3);
		}
		model.addStatement(uri, prefixDC + "creator", m[1], true);
		model.addStatement(uri, prefixRDF + "type", prefixDummy + "newspaperArticle", false);
	} else {
		model.addStatement(uri, prefixRDF + "type", prefixDummy + "journalArticle", false);
	}
	
	var authorRegexp = /\n(?:AUTHOR|NAME): ([^\n]+)\n/;
	var m = authorRegexp.exec(citationData);
	if(m) {
		var authors = m[1].split(/, (?:and )?/);
		for(i in authors) {
			model.addStatement(uri, prefixDC + "creator", authors[i].replace(" *", ""), true);
		}
	}
}

var detailRe = new RegExp("^http://[^/]+/universe/document");
if(detailRe.test(doc.location.href)) {
	scrape(doc);
} else {
	var items = utilities.getItemArray(doc, doc, "^http://[^/]+/universe/document");
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	var uris = new Array();
	for(i in items) {
		uris.push(i);
	}
	
	utilities.processDocuments(browser, null, uris, function(browser) { scrape(browser.contentDocument) },
		function() { done(); }, function() {});
	
	wait();
}');

REPLACE INTO "translators" VALUES ('cf87eca8-041d-b954-795a-2d86348999d5', '2006-06-26 16:01:00', 3, 'Aleph Scraper', 'Simon Kornblith', '^http://[^/]+/F(?:/[A-Z0-9\-]+(?:\?.*)?$|\?func=find)',
'var singleRe = new RegExp("^http://[^/]+/F/[A-Z0-9\-]+\?.*func=full-set-set.*\&format=[0-9]{3}");

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
return false;',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var detailRe = new RegExp("^http://[^/]+/F/[A-Z0-9\-]+\?.*func=full-set-set.*\&format=[0-9]{3}");
var uri = doc.location.href;
var newUris = new Array();

if(detailRe.test(uri)) {
	newUris.push(uri.replace(/\&format=[0-9]{3}/, "&format=001"))
} else {
	var items = utilities.getItemArray(doc, doc, ''^http://[^/]+/F/[A-Z0-9\-]+\?.*func=full-set-set.*\&format=999'', ''^[0-9]+$'');
	
	// ugly hack to see if we have any items
	var haveItems = false;
	for(i in items) {
		haveItems = true;
		break;
	}
	
	// If we don''t have any items otherwise, let us use the numbers
	if(!haveItems) {
		var items = utilities.getItemArray(doc, doc, ''^http://[^/]+/F/[A-Z0-9\-]+\?.*func=full-set-set.*\&format=999'');
	}
	
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	for(i in items) {
		newUris.push(i.replace("&format=999", "&format=001"));
	}
}

utilities.processDocuments(browser, null, newUris, function(newBrowser) {
	var newDoc = newBrowser.contentDocument;
	var uri = newDoc.location.href;
	
	var namespace = newDoc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	  if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var xpath = ''/html/body/table/tbody/tr[td[1][@id="bold"]][td[2]]'';
	var elmts = utilities.gatherElementsOnXPath(newDoc, newDoc, xpath, nsResolver);
	var record = new MARC_Record();
	for(var i=0; i<elmts.length; i++) {
		var elmt = elmts[i];
		var field = utilities.superCleanString(utilities.getNode(doc, elmt, ''./TD[1]/text()[1]'', nsResolver).nodeValue);
		var value = utilities.getNodeString(doc, elmt, ''./TD[2]//text()'', nsResolver);
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
	utilities.importMARCRecord(record, uri, model);
}, function() { done(); }, function() {});

wait();');

REPLACE INTO "translators" VALUES ('774d7dc2-3474-2684-392c-f787789ec63d', '2006-06-26 16:01:00', 3, 'Dynix Scraper', 'Simon Kornblith', 'ipac\.jsp\?.*(?:uri=full=[0-9]|menu=search)',
'var detailsRe = new RegExp(''ipac\.jsp\?.*uri=full=[0-9]'');
if(detailsRe.test(doc.location.href)) {
	return "book";
} else {
	return "multiple";
}',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var uri = doc.location.href;
var detailsRe = new RegExp(''ipac\.jsp\?.*uri=full=[0-9]'');

var uris = new Array();
if(detailsRe.test(uri)) {
	uris.push(uri+''&fullmarc=true'');
} else {
	var items = utilities.getItemArray(doc, doc, "ipac\.jsp\?.*uri=full=[0-9]|^javascript:buildNewList\\(''.*uri%3Dfull%3D[0-9]");
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	var buildNewList = new RegExp("^javascript:buildNewList\\(''([^'']+)");
	
	var uris = new Array();
	for(i in items) {
		var m = buildNewList.exec(i);
		if(m) {
			uris.push(unescape(m[1]+''&fullmarc=true''));
		} else {
			uris.push(i+''&fullmarc=true'');
		}
	}
}

utilities.processDocuments(browser, null, uris, function(newBrowser) {
	var newDoc = newBrowser.contentDocument;
	var uri = newDoc.location.href;
	
	var namespace = newDoc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	  if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var xpath = ''//form/table[@class="tableBackground"]/tbody/tr/td/table[@class="tableBackground"]/tbody/tr[td[1]/a[@class="normalBlackFont1"]]'';
	var elmts = utilities.gatherElementsOnXPath(newDoc, newDoc, xpath, nsResolver);
	var record = new MARC_Record();		
	for(var i=0; i<elmts.length; i++) {
		var elmt = elmts[i];
		var field = utilities.superCleanString(utilities.getNode(newDoc, elmt, ''./TD[1]/A[1]/text()[1]'', nsResolver).nodeValue);
		var value = utilities.getNodeString(newDoc, elmt, ''./TD[2]/TABLE[1]/TBODY[1]/TR[1]/TD[1]/A[1]//text()'', nsResolver);
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
			record.add_field(field, ind1, ind2, value);
		}
	}
	
	utilities.importMARCRecord(record, uri, model);
}, function() { done() }, function() {});

wait();');

REPLACE INTO "translators" VALUES ('63a0a351-3131-18f4-21aa-f46b9ac51d87', '2006-06-26 16:01:00', 3, 'VTLS Scraper', 'Simon Kornblith', '/chameleon(?:\?|$)', 
'var node = utilities.getNode(doc, doc, ''//a[text()="marc"]'', null);
if(node) {
	return "book";
}
var node = utilities.getNode(doc, doc, ''//tr[@class="intrRow"]/td/table/tbody/tr[th]'', null);
if(node) {
	return "multiple";
}
return false;',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var namespace = doc.documentElement.namespaceURI;
var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
} : null;

var uri = doc.location.href;
var newUris = new Array();

var marcs = utilities.gatherElementsOnXPath(doc, doc, ''//a[text()="marc"]'', nsResolver);

if(marcs.length == 1) {
	newUris.push(marcs[0].href)
} else {
	// Require link to match this
	var tagRegexp = new RegExp();
	tagRegexp.compile("/chameleon\?.*function=CARDSCR");
	
	var items = new Array();
	
	var tableRows = utilities.gatherElementsOnXPath(doc, doc, ''//tr[@class="intrRow"]'', nsResolver);
	// Go through table rows
	for(var i=0; i<tableRows.length; i++) {
		var links = utilities.gatherElementsOnXPath(doc, tableRows[i], ''.//a'', nsResolver);
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
			var fields = utilities.gatherElementsOnXPath(doc, tableRows[i], ''./td/table/tbody/tr[th]'', nsResolver);
			for(var j=0; j<fields.length; j++) {
				var field = utilities.getNode(doc, fields[j], ''./th/text()'', nsResolver);
				if(field.nodeValue == "Title") {
					var value = utilities.getNodeString(doc, fields[j], ''./td//text()'', nsResolver);
					if(value) {
						items[url] = utilities.cleanString(value);
					}
				}
			}
		}
	}
	
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	for(i in items) {
		utilities.debugPrint(i.replace(/function=[A-Z]{7}/, "function=MARCSCR"));
		newUris.push(i.replace(/function=[A-Z]{7}/, "function=MARCSCR"));
	}
}

utilities.processDocuments(browser, null, newUris, function(newBrowser) {
	var newDoc = newBrowser.contentDocument;
	var uri = newDoc.location.href
	
	var namespace = newDoc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	  if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var xpath = ''//table[@class="outertable"]/tbody/tr[td[4]]'';
	var elmts = utilities.gatherElementsOnXPath(newDoc, newDoc, xpath, nsResolver);
	var record = new MARC_Record();		
	for(var i=0; i<elmts.length; i++) {
		var elmt = elmts[i];
		var field = utilities.getNode(doc, elmt, ''./TD[1]/text()[1]'', nsResolver).nodeValue;
		var ind1 = utilities.getNode(doc, elmt, ''./TD[2]/text()[1]'', nsResolver).nodeValue;
		var ind2 = utilities.getNode(doc, elmt, ''./TD[3]/text()[1]'', nsResolver).nodeValue;
		var value = utilities.getNode(doc, elmt, ''./TD[4]/text()[1]'', nsResolver).nodeValue;
		value = value.replace(/\\([a-z]) /g, record.subfield_delimiter+"$1");
		
		record.add_field(field, ind1, ind2, value);
	}
	
	utilities.importMARCRecord(record, uri, model);
}, function(){ done(); }, function() {});

wait();');

REPLACE INTO "translators" VALUES ('fb12ae9e-f473-cab4-0546-27ab88c64101', '2006-06-26 16:01:00', 3, 'DRA Scraper', 'Simon Kornblith', '/web2/tramp2\.exe/(?:see\_record/|authority\_hits/|goto/.*\?.*screen=Record\.html)',
'if(doc.location.href.indexOf("/authority_hits") > 0) {
	return "multiple";
} else {
	return "book";
}',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var checkItems = false;

if(doc.location.href.indexOf("/authority_hits") > 0) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	checkItems = utilities.gatherElementsOnXPath(doc, doc, "/html/body//ol/li", nsResolver);
}

if(checkItems && checkItems.length) {
	var items = utilities.getItemArray(doc, checkItems, ''https?://.*/web2/tramp2\.exe/see_record'');
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	var uris = new Array();
	for(i in items) {
		uris.push(i);
	}
} else {
	var uris = new Array(doc.location.href);
}

for(i in uris) {
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
	
	utilities.HTTPUtilities.doGet(newUri, null, function(text) {
		var record = new MARC_Record();
		record.load(text, "binary");
		utilities.importMARCRecord(record, uris[j], model);
		j++;
		if(j == uris.length) {
			done();
		}
	});
}
wait();');


REPLACE INTO "translators" VALUES ('c0e6fda6-0ecd-e4f4-39ca-37a4de436e15', '2006-06-26 16:01:00', 3, 'GEAC Scraper', 'Simon Kornblith', '/(?:GeacQUERY|(?:Geac)?FETCH[\:\?].*[&:]next=html/(?:record\.html|geacnffull\.html))',
'if(doc.location.href.indexOf("/GeacQUERY") > 0) {
	return "multiple";
} else {
	return "book";
}',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var uri = doc.location.href;

var uris = new Array();

if(uri.indexOf("/GeacQUERY") > 0) {
	var items = utilities.getItemArray(doc, doc, "(?:Geac)?FETCH[\:\?].*[&:]next=html/(?:record\.html|geacnffull\.html)");
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	var uris = new Array();
	for(i in items) {
		var newUri = i.replace(/([:&])next=html\/geacnffull.html/, "$1next=html/marc.html");
		newUri = newUri.replace(/([:&])next=html\/record.html/, "$1next=html/marc.html");
		uris.push(newUri);
	}
} else {
	var newUri = uri.replace(/([:&])next=html\/geacnffull.html/, "$1next=html/marc.html");
	newUri = newUri.replace(/([:&])next=html\/record.html/, "$1next=html/marc.html");
	uris.push(newUri);
}

utilities.processDocuments(browser, null, uris, function(newBrowser) {
	var newDoc = newBrowser.contentDocument;
	var uri = newDoc.location.href;
	
	var namespace = newDoc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	  if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var record = new MARC_Record();
	
	var elmts = utilities.gatherElementsOnXPath(newDoc, newDoc, ''//pre/text()'', nsResolver);
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
	
	utilities.importMARCRecord(record, uri, model);
}, function() { done(); }, function() {});

wait();');

REPLACE INTO "translators" VALUES ('5287d20c-8a13-6004-4dcb-5bb2b66a9cc9', '2006-06-26 16:01:00', 3, 'SIRSI -2003 Scraper', 'Simon Kornblith', '/uhtbin/cgisirsi',
'var namespace = doc.documentElement.namespaceURI;
var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
} : null;

var elmts = utilities.gatherElementsOnXPath(doc, doc, ''/html/body/form/p/text()[1]'', nsResolver);
for(i in elmts) {
	if(utilities.superCleanString(elmts[i].nodeValue) == "Viewing record") {
		return "book";
	}
}
var xpath = ''//form[@name="hitlist"]/table/tbody/tr'';
var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
if(elmts.length) {
	return "multiple";
}
return false;',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var namespace = doc.documentElement.namespaceURI;
var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
} : null;

// Cheap hack to convert HTML entities
function unescapeHTML(text) {
	var div = doc.createElement("div");
	div.innerHTML = utilities.cleanTags(text);
	var text = div.childNodes[0] ? div.childNodes[0].nodeValue : null;
	delete div;
	return text;
}

var uri = doc.location.href;
var recNumbers = new Array();

var xpath = ''//form[@name="hitlist"]/table/tbody/tr'';
var elmts = utilities.gatherElementsOnXPath(doc, doc, xpath, nsResolver);
if(elmts.length) {	// Search results page
	var uriRegexp = /^http:\/\/[^\/]+/;
	var m = uriRegexp.exec(uri);
	var postAction = doc.forms.namedItem("hitlist").getAttribute("action");
	var newUri = m[0]+postAction.substr(0, postAction.length-1)+"40"
	
	var titleRe = /<br>\s*(.*[^\s])\s*<br>/i;
	
	var items = new Array();
	
	for(var i=0; i<elmts.length; i++) {
		var links = utilities.gatherElementsOnXPath(doc, elmts[i], ''.//a'', nsResolver);
		
		// Collect title
		var myTd = utilities.getNode(doc, elmts[i], "./td[2]", nsResolver);
		var m = titleRe.exec(myTd.innerHTML);
		var title = unescapeHTML(m[1]);
		
		items[i] = title;
	}
	
	
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	for(i in items) {
		recNumbers.push(parseInt(i)+1);
	}
} else {		// Normal page
	var uriRegexp = /^(.*)(\/[0-9]+)$/;
	var m = uriRegexp.exec(uri);
	var newUri = m[1]+"/40"
	
	var elmts = utilities.gatherElementsOnXPath(doc, doc, ''/html/body/form/p'', nsResolver);
	for(i in elmts) {
		var elmt = elmts[i];
		var initialText = utilities.getNode(doc, elmt, ''./text()[1]'', nsResolver);
		if(initialText && initialText.nodeValue && utilities.superCleanString(initialText.nodeValue) == "Viewing record") {
			recNumbers.push(utilities.getNode(doc, elmt, ''./b[1]/text()[1]'', nsResolver).nodeValue);
			break;
		}
	}
}

utilities.HTTPUtilities.doGet(newUri+''?marks=''+recNumbers.join(",")+''&shadow=NO&format=FLAT+ASCII&sort=TITLE&vopt_elst=ALL&library=ALL&display_rule=ASCENDING&duedate_code=l&holdcount_code=t&DOWNLOAD_x=22&DOWNLOAD_y=12&address=&form_type='', null, function(text) {
	var texts = text.split("<PRE>");
	texts = texts[1].split("</PRE>");
	text = unescapeHTML(texts[0]);
	var documents = text.split("*** DOCUMENT BOUNDARY ***");
	
	for(var j=1; j<documents.length; j++) {
		var uri = newUri+"?marks="+recNumbers[j]+"&shadow=NO&format=FLAT+ASCII&sort=TITLE&vopt_elst=ALL&library=ALL&display_rule=ASCENDING&duedate_code=l&holdcount_code=t&DOWNLOAD_x=22&DOWNLOAD_y=12&address=&form_type=";
		var lines = documents[j].split("\n");
		var record = new MARC_Record();
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
		utilities.importMARCRecord(record, uri, model);
	}
	done();
});

wait();');

REPLACE INTO "translators" VALUES ('0f9fc2fc-306e-5204-1117-25bca009dffc', '2006-06-26 16:01:00', 3, 'TLC/YouSeeMore Scraper', 'Simon Kornblith', 'TLCScripts/interpac\.dll\?(?:.*LabelDisplay.*RecordNumber=[0-9]|Search|ItemTitles)',
'var detailRe = new RegExp("TLCScripts/interpac\.dll\?.*LabelDisplay.*RecordNumber=[0-9]");
if(detailRe.test(doc.location.href)) {
	return "book";
} else {
	return "multiple";
}',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

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
	var items = utilities.getItemArray(doc, doc, ''TLCScripts/interpac\.dll\?.*LabelDisplay.*RecordNumber=[0-9]'');
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	for(i in items) {
		newUris.push(i.replace("LabelDisplay", "MARCDisplay"));
	}
}

utilities.processDocuments(browser, null, newUris, function(newBrowser) {
	var newDoc = newBrowser.contentDocument;
	var uri = newDoc.location.href;
	
	var namespace = newDoc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	  if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var record = new MARC_Record();
	
	var elmts = utilities.gatherElementsOnXPath(newDoc, newDoc, ''/html/body/table/tbody/tr[td[4]]'', nsResolver);
	var tag, ind1, ind2, content;
	
	for(var i=0; i<elmts.length; i++) {
		var elmt = elmts[i];
		
		tag = utilities.getNode(newDoc, elmt, ''./td[2]/tt[1]/text()[1]'', nsResolver).nodeValue;
		var inds = utilities.getNode(newDoc, elmt, ''./td[3]/tt[1]/text()[1]'', nsResolver).nodeValue;
		
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
		
		var children = utilities.gatherElementsOnXPath(newDoc, elmt, ''./td[4]/tt[1]//text()'', nsResolver);
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
	
	utilities.importMARCRecord(record, uri, model);
}, function() {done(); }, function() {});

wait();');

REPLACE INTO "translators" VALUES ('c54d1932-73ce-dfd4-a943-109380e06574', '2006-06-26 16:01:00', 3, 'Project MUSE Scraper', 'Simon Kornblith', '^http://muse\.jhu\.edu/(?:journals/[^/]+/[^/]+/[^/]+\.html|search/pia.cgi)',
'var searchRe = new RegExp("^http://[^/]+/search/pia\.cgi");
if(searchRe.test(doc.location.href)) {
	return "multiple";
} else {
	return "journalArticle";
}', 'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var namespace = doc.documentElement.namespaceURI;
var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
} : null;

function newDataObject() {
	var data = new Object();
	data[prefixDC + "title"] = new Array();
	data[prefixDC + "creator"] = new Array();
	data[prefixDummy + "publication"] = new Array();
	data[prefixDummy + "volume"] = new Array();
	data[prefixDummy + "number"] = new Array();
	data[prefixDummy + "series"] = new Array();
	data[prefixDC + "year"] = new Array();
	data[prefixDummy + "pages"] = new Array();
	data[prefixDC + "identifier"] = new Array();
	data[prefixDC + "publisher"] = new Array();
	return data;
}

var searchRe = new RegExp("^http://[^/]+/search/pia\.cgi");
if(searchRe.test(doc.location.href)) {
	var items = new Array();
	var tableRows = utilities.gatherElementsOnXPath(doc, doc, ''/html/body/table[@class="navbar"]/tbody/tr/td/form/table'', nsResolver);
	// Go through table rows
	for(var i=0; i<tableRows.length; i++) {
		// article_id is what we need to get it all as one file
		var input = utilities.getNode(doc, tableRows[i], ''./tbody/tr/td/input[@name="article_id"]'', nsResolver);
		var link = utilities.getNode(doc, tableRows[i], ''.//b/i/a/text()'', nsResolver);
		if(input && input.value && link && link.nodeValue) {
			items[input.value] = link.nodeValue;
		}
	}
	
	items = utilities.selectItems(items);
	if(!items) {
		return true;
	}
	
	try {
		var search_id = doc.forms.namedItem("results").elements.namedItem("search_id").value;
	} catch(e) {
		var search_id = "";
	}
	var articleString = "";
	for(i in items) {
		articleString += "&article_id="+i;
	}
	var savePostString = "actiontype=save&search_id="+search_id+articleString;
	
	utilities.HTTPUtilities.doGet("http://muse.jhu.edu/search/save.cgi?"+savePostString, null, function() {
		utilities.HTTPUtilities.doGet("http://muse.jhu.edu/search/export.cgi?exporttype=endnote"+articleString, null, function(text) {
			var records = text.split("\n\n");
			for(i in records) {
				var lines = records[i].split("\n");
				if(lines.length > 1) {
					var data = newDataObject();
					for(i in lines) {
						var fieldCode = lines[i].substring(0, 2);
						var fieldContent = utilities.cleanString(lines[i].substring(6))
						
						if(fieldCode == "T1") {
							data[prefixDC + "title"].push(fieldContent);
						} else if(fieldCode == "A1") {
							var authors = fieldContent.split(";");
							for(j in authors) {
								var author = authors[j];
								if(author) {
									var splitNames = author.split('', '');
									if(splitNames) {
										author = splitNames[1]+'' ''+splitNames[0];
									}
									data[prefixDC + "creator"].push(author);
								}
							}
						} else if(fieldCode == "JF") {
							data[prefixDummy + "publication"].push(fieldContent);
						} else if(fieldCode == "VL") {
							data[prefixDummy + "volume"].push(fieldContent);
						} else if(fieldCode == "IS") {
							data[prefixDummy + "number"].push(fieldContent);
						} else if(fieldCode == "Y1") {
							data[prefixDC + "year"].push(fieldContent);
						} else if(fieldCode == "PP") {
							data[prefixDummy + "pages"].push(fieldContent);
						} else if(fieldCode == "UR") {
							stableURL = fieldContent;
						} else if(fieldCode == "SN") {
							data[prefixDC + "identifier"].push("ISSN "+fieldContent);
							ISSN = fieldContent;
						} else if(fieldCode == "PB") {
							data[prefixDC + "publisher"].push(fieldContent);
						}
					}
					model.addStatement(stableURL, prefixRDF + "type", prefixDummy + "journalArticle", false);
					for(i in data) {
						if(data[i].length) {
							for(j in data[i]) {
								model.addStatement(stableURL, i, data[i][j]);
							}
						}
					}
				}
			}
			done();
		}, function() {});
	}, function() {});
	
	wait();
} else {
	var uri = doc.location.href;
	
	var elmts = utilities.gatherElementsOnXPath(doc, doc, ''//comment()'', nsResolver);
	for(i in elmts) {
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
	
	mapRDF(newDOM.journal.text(), prefixDummy + "publication");
	mapRDF(newDOM.volume.text(), prefixDummy + "volume");
	mapRDF(newDOM.issue.text(), prefixDummy + "number");
	mapRDF(newDOM.year.text(), prefixDummy + "year");
	mapRDF(newDOM.pubdate.text(), prefixDC + "date");
	mapRDF(newDOM.doctitle.text(), prefixDC + "title");
	
	// Do ISSN
	var issn = newDOM.issn.text();
	if(issn) {
		model.addStatement(uri, prefixDC + "identifier", "ISSN "+issn.replace(/[^0-9]/g, ""), true);
	}
	
	// Do pages
	var fpage = newDOM.fpage.text();
	var lpage = newDOM.lpage.text();
	if(fpage != "") {
		var pages = fpage;
		if(lpage) {
			pages += "-"+lpage;
		}
		model.addStatement(uri, prefixDummy + "pages", pages, true);
	}
	
	// Do authors
	var elmts = newDOM.docauthor;
	for(i in elmts) {
		var fname = elmts[i].fname.text();
		var surname = elmts[i].surname.text();
		model.addStatement(uri, prefixDC + "creator", fname+" "+surname, true);
	}
	
	model.addStatement(uri, prefixRDF + "type", prefixDummy + "journalArticle", false);
}');

REPLACE INTO "translators" VALUES ('fcf41bed-0cbc-3704-85c7-8062a0068a7a', '2006-06-26 16:01:00', 3, 'PubMed Scraper', 'Simon Kornblith', '^http://www\.ncbi\.nlm\.nih\.gov/entrez/query\.fcgi\?(?:.*db=PubMed.*list_uids=[0-9]|.*list_uids=[0-9].*db=PubMed|.*db=PubMed.*CMD=search|.*CMD=search.*db=PubMed)',
'if(doc.location.href.indexOf("list_uids=") >= 0) {
	return "journalArticle";
} else {
	return "multiple";
}', 'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

function mapRDF(uri, text, rdfUri) {
	if(text != "") {
		model.addStatement(uri, rdfUri, text, true);
	}
}

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
	var tableRows = utilities.gatherElementsOnXPath(doc, doc, ''//div[@class="ResultSet"]/table/tbody'', nsResolver);
	// Go through table rows
	for(var i=0; i<tableRows.length; i++) {
		var link = utilities.getNode(doc, tableRows[i], ''.//a'', nsResolver);
		var article = utilities.getNode(doc, tableRows[i], ''./tr[2]/td[2]/text()[1]'', nsResolver);
		items[link.href] = article.nodeValue;
	}
	
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	for(i in items) {
		var m = idRegexp.exec(i);
		ids.push(m[1]);
	}
}

var newUri = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=PubMed&retmode=xml&rettype=citation&id="+ids.join(",");
utilities.HTTPUtilities.doGet(newUri, null, function(text) {
	// Remove xml parse instruction and doctype
	text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");
	
	var xml = new XML(text);
	
	for(var i=0; i<xml.PubmedArticle.length(); i++) {
		var citation = xml.PubmedArticle[i].MedlineCitation;
		
		var uri = "http://www.ncbi.nlm.nih.gov/entrez/query.fcgi?db=pubmed&cmd=Retrieve&list_uids="+citation.PMID.text();
		if(citation.PMID.length()) {
			model.addStatement(uri, prefixDC + "identifier", "PMID "+citation.PMID.text(), true);
		}
		
		var article = citation.Article;
		if(article.ArticleTitle.length()) {
			var title = article.ArticleTitle.text().toString();
			if(title.substr(-1) == ".") {
				title = title.substring(0, title.length-1);
			}
			model.addStatement(uri, prefixDC + "title", title, true);
		}
		
		if(article.Journal.length()) {
			var issn = article.Journal.ISSN.text();
			if(issn) {
				model.addStatement(uri, prefixDC + "identifier", "ISSN "+issn.replace(/[^0-9]/g, ""), true);
			}
			
			if(article.Journal.Title.length()) {
				model.addStatement(uri, prefixDummy + "publication", utilities.superCleanString(article.Journal.Title.text().toString()), true);
			} else if(citation.MedlineJournalInfo.MedlineTA.length()) {
				model.addStatement(uri, prefixDummy + "publication", utilities.superCleanString(citation.MedlineJournalInfo.MedlineTA.text().toString()), true);
			}
			
			if(article.Journal.JournalIssue.length()) {
				mapRDF(uri, article.Journal.JournalIssue.Volume.text(), prefixDummy + "volume");
				mapRDF(uri, article.Journal.JournalIssue.Issue.text(), prefixDummy + "number");
				if(article.Journal.JournalIssue.PubDate.length()) {
					if(article.Journal.JournalIssue.PubDate.Day.text().toString() != "") {
						var date = article.Journal.JournalIssue.PubDate.Month.text()+" "+article.Journal.JournalIssue.PubDate.Day.text()+", "+article.Journal.JournalIssue.PubDate.Year.text();
						var jsDate = new Date(date);
						if(!isNaN(jsDate.valueOf())) {
							date = utilities.dateToISO(date);
						}
					} else if(article.Journal.JournalIssue.PubDate.Month.text().toString() != "") {
						var date = article.Journal.JournalIssue.PubDate.Month.text()+" "+article.Journal.JournalIssue.PubDate.Year.text();
					} else if(article.Journal.JournalIssue.PubDate.Year.text().toString() != "") {
						var date = article.Journal.JournalIssue.PubDate.Year.text();
					}
					if(date) {
						model.addStatement(uri, prefixDC + "date", date, true);
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
				if(firstName && lastName) {
					model.addStatement(uri, prefixDC + "creator", firstName + " " + lastName);
				}
			}
		}
		model.addStatement(uri, prefixRDF + "type", prefixDummy + "journalArticle", false);
	}

	done();
})

wait();');

REPLACE INTO "translators" VALUES ('951c027d-74ac-47d4-a107-9c3069ab7b48', '2006-06-26 16:41:00', 3, 'Generic Scraper', 'Simon Kornblith', NULL,
'return "website";',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var uri = doc.location.href;

// Eventually, we can grab a last modified date from the Last-Modified header,
// but Piggy Bank will never be able to manage that

var metaTags = doc.getElementsByTagName("meta");

var foundCreator = false;	// Multiple creators encoded two different ways can screw us up
var foundTitle = false;		// Can always figure this out on our own
for(var i=0; i<metaTags.length; i++) {
	var tag = metaTags[i].getAttribute("name");
	var value = metaTags[i].getAttribute("content");
	if(tag && value && tag.substr(0, 3).toLowerCase() == "dc.") {
		var suffix = tag.substr(3);
		if(suffix == "creator" && !foundCreator) {
			// Everyone uses different methods of encoding the DC creator; clean them
			value = utilities.cleanAuthor(value);
			var foundCreator = true;
		}
		if(suffix == "title") {
			foundTitle = true;
		}
		model.addStatement(uri, prefixDC + suffix, value, true);
	} else if(tag && value && (tag == "author" || tag == "author-personal")) {
		value = utilities.cleanAuthor(value);
		var foundCreator = true;
		model.addStatement(uri, prefixDC + "creator", value, true);
	} else if(tag && value && tag == "author-corporate") {
		var foundCreator = true;
		model.addStatement(uri, prefixDC + "creator", value, true);
	} else if(tag && value && tag == "title") {
		var foundTitle = true;
		model.addStatement(uri, prefixDC + "title", value, true);
	}
}

if(!foundTitle) {
	model.addStatement(uri, prefixDC + "title", doc.title, true);
}

model.addStatement(uri, prefixRDF + "type", prefixDummy + "website", false);');

REPLACE INTO "translators" VALUES ('3e684d82-73a3-9a34-095f-19b112d88bbf', '2006-06-26 16:01:00', 3, 'Google Books Scraper', 'Simon Kornblith', '^http://books\.google\.com/books\?(.*vid=.*\&id=.*|.*q=.*)',
'var re = new RegExp(''^http://books\\.google\\.com/books\\?vid=([^&]+).*\\&id=([^&]+)'', ''i'');
if(re.test(doc.location.href)) {
	return "book";
} else {
	return "multiple";
}',
'var prefixRDF = ''http://www.w3.org/1999/02/22-rdf-syntax-ns#'';
var prefixDC = ''http://purl.org/dc/elements/1.1/'';
var prefixDCMI = ''http://purl.org/dc/dcmitype/'';
var prefixDummy = ''http://chnm.gmu.edu/firefox-scholar/'';

var uri = doc.location.href;
var newUris = new Array();

var re = new RegExp(''^http://books\\.google\\.com/books\\?vid=([^&]+).*\\&id=([^&]+)'', ''i'');
var m = re.exec(uri);
if(m) {
	newUris.push(''http://books.google.com/books?vid=''+m[1]+''&id=''+m[2]);
} else {
	var items = utilities.getItemArray(doc, doc, ''http://books\\.google\\.com/books\\?vid=([^&]+).*\\&id=([^&]+)'', ''^(?:All matching pages|About this Book)'');

	// Drop " - Page" thing
	for(i in items) {
		items[i] = items[i].replace(/- Page [0-9]+\s*$/, "");
	}
	items = utilities.selectItems(items);
	
	if(!items) {
		return true;
	}
	
	for(i in items) {
		var m = re.exec(i);
		newUris.push(''http://books.google.com/books?vid=''+m[1]+''&id=''+m[2]);
	}
}

utilities.processDocuments(browser, null, newUris, function(newBrowser) {
	var newDoc = newBrowser.contentDocument;
	var uri = newDoc.location.href;
	
	var namespace = newDoc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	  if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var xpath = ''//table[@id="bib"]/tbody/tr'';
	var elmts = utilities.gatherElementsOnXPath(newDoc, newDoc, xpath, nsResolver);
	for(var i = 0; i<elmts.length; i++) {
		var field = utilities.getNode(newDoc, elmts[i], ''./td[1]//text()'', nsResolver);
		var value = utilities.getNode(newDoc, elmts[i], ''./td[2]//text()'', nsResolver);
		
		if(field && value) {
			field = utilities.superCleanString(field.nodeValue);
			value = utilities.cleanString(value.nodeValue);
			if(field == "Title") {
				model.addStatement(uri, prefixDC + ''title'', value);
			} else if(field == "Author(s)") {
				var authors = value.split(", ");
				for(j in authors) {
					model.addStatement(uri, prefixDC + ''creator'', authors[j]);
				}
			} else if(field == "Editor(s)") {
				var authors = value.split(", ");
				for(j in authors) {
					model.addStatement(uri, prefixDummy + ''editor'', authors[j]);
				}
			} else if(field == "Publisher") {
				model.addStatement(uri, prefixDC + ''publisher'', value);
			} else if(field == "Publication Date") {
				var date = value;
				
				jsDate = new Date(value);
				if(!isNaN(jsDate.valueOf())) {
					date = utilities.dateToISO(jsDate);
				}
				
				model.addStatement(uri, prefixDC + ''date'', date);
			} else if(field == "Format") {
				model.addStatement(uri, prefixDC + ''medium'', value);
			} else if(field == "ISBN") {
				model.addStatement(uri, prefixDC + ''identifier'', ''ISBN ''+value);
			}
		}
	}
	model.addStatement(uri, prefixRDF + "type", prefixDummy + "book", false);
}, function() { done(); }, function() {});

wait();');

REPLACE INTO "translators" VALUES ('0e2235e7-babf-413c-9acf-f27cce5f059c', '2006-07-05 23:40:00', 2, 'MODS (XML)', 'Simon Kornblith', 'xml',
'addOption("exportNotes", true);
addOption("exportFileData", true);',
'var partialItemTypes = ["bookSection", "journalArticle", "magazineArticle", "newspaperArticle"];
var rdf = new Namespace("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
var rdfs = new Namespace("rdfs", "http://www.w3.org/2000/01/rdf-schema#");

/*
 * handles the generation of RDF describing a single collection and its child
 * collections
 */
function generateCollection(collection, rdfDoc) {
	var description = <rdf:Description xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" />;
	// specify collection ID, namespaced
	description.@rdf::ID = "collection:"+collection.id;
	// collection type is an RDF Bag. honestly, i''m not sure if this is the
	// correct way of doing it, but it''s how the Mozilla Foundation did it. then
	// again, the Mozilla Foundation also uses invalid URN namespaces, so who
	// knows.
	description.rdf::type.@resource = "http://www.w3.org/1999/02/22-rdf-syntax-ns#Bag";
	description.rdfs::label = collection.name;
	
	for(var i in collection.children) {
		var child = collection.children[i];
		// add child list items
		var childID = child.type+":"+child.id;
		description.rdf::li += <rdf:li xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" rdf:ID={childID} />;
		
		if(child.type == "collection") {
			// do recursive processing of collections
			generateCollection(child, rdfDoc);
		}
	}
	rdfDoc.rdf::description += description;
}

/*
 * handles the generation of RDF describing a see also item
 */
function generateSeeAlso(id, seeAlso, rdfDoc) {
	var description = <rdf:Description xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" />;
	description.@rdf::ID = "item:"+id;
	for(var i in seeAlso) {
		var seeID = "item:"+seeAlso[i];
		description += <rdfs:seeAlso xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" rdf:ID={seeID} />;
	}
	rdfDoc.rdf::description += description;
}

function doExport(items, collections) {
	var rdfDoc = <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" />;
	var modsCollection = <modsCollection xmlns="http://www.loc.gov/mods/v3" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.loc.gov/mods/v3 http://www.loc.gov/standards/mods/v3/mods-3-2.xsd" />;
	
	for(var i in items) {
		var item = items[i];
		
		var isPartialItem = false;
		if(utilities.inArray(item.itemType, partialItemTypes)) {
			isPartialItem = true;
		}
		
		var mods = <mods />;
		
		/** CORE FIELDS **/
		
		// add ID
		mods.@ID = "item:"+item.itemID;
		
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
			modsType.@manuscript = "interview";
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
			modsType = "text";
			marcGenre = null;
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
		//mods.recordInfo.recordOrigin = "Scholar for Firefox "+utilities.getVersion();
		
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
		if(item.series) {
			var series = <relatedItem type="series">
					<titleInfo><title>{item.series}</title></titleInfo>
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
			if(utilities.isInt(item.volume)) {
				part += <detail type="volume"><number>{item.volume}</number></detail>;
			} else {
				part += <detail type="volume"><text>{item.volume}</text></detail>;
			}
		}
		
		// XML tag detail; object field number
		if(item.number) {
			if(utilities.isInt(item.number)) {
				part += <detail type="issue"><number>{item.number}</number></detail>;
			} else {
				part += <detail type="issue"><text>{item.number}</text></detail>;
			}
		}
		
		// XML tag detail; object field section
		if(item.section) {
			if(utilities.isInt(item.section)) {
				part += <detail type="section"><number>{item.section}</number></detail>;
			} else {
				part += <detail type="section"><text>{item.section}</text></detail>;
			}
		}
		
		// XML tag detail; object field pages
		if(item.pages) {
			var range = utilities.getPageRange(item.pages);
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
			originInfo += <publisher>item.publisher</publisher>;
		} else if(item.distributor) {
			originInfo += <publisher>item.distributor</publisher>;
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
		if(originInfo.length() != 1) {
			if(isPartialItem) {
				// For a journal article, bookSection, etc., this goes under the host
				mods.relatedItem.originInfo += <originInfo>{originInfo}</originInfo>;
			} else {
				mods.originInfo += <originInfo>{originInfo}</originInfo>;
			}
		}
		
		// XML tag identifier; object fields ISBN, ISSN
		var identifier = false;
		if(item.ISBN) {
			identifier = <identifier type="ISBN">{item.ISBN}</identifier>;
		} else if(item.ISSN) {
			identifier = <identifier type="ISSN">{item.ISSN}</identifier>;
		}
		if(identifier) {
			if(isPartialItem) {
					mods.relatedItem.identifier = identifier;
			} else {
				mods.identifier = identifier;
			}
		}
		
		// XML tag relatedItem.titleInfo; object field publication
		if(item.publication) {
			mods.relatedItem.titleInfo += <titleInfo>{item.publication}</titleInfo>;
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
		
		if(mods.relatedItem.length() == 1 && isPartialItem) {
			mods.relatedItem.@type = "host";
		}
		
		/** NOTES **/
		
		for(var j in item.notes) {
			// Add note tag
			var note = <note type="content">{item.notes[j].note}</note>;
			note.@ID = "item:"+item.notes[j].itemID;
			mods.note += note;
			
			// Add see also info to RDF
			if(item.notes[j].seeAlso) {
				rdfDoc.Description += generateSeeAlso(item.notes[j].itemID, item.notes[j].seeAlso);
			}
		}
		
		if(item.note) {
			// Add note tag
			var note = <note type="content">{item.note}</note>;
			note.@ID = "item:"+item.itemID;
			mods.note += note;
		}
		
		/** TAGS **/
		
		for(var j in item.tags) {
			mods.subject += <subject>{item.tags[j]}</subject>;
		}
		
		/** RDF STRUCTURE **/
		
		// Add see also info to RDF
		if(item.seeAlso) {
			generateSeeAlso(item.itemID, item.seeAlso, rdfDoc);
		}
		
		modsCollection.mods += mods;
	}
	
	for(var i in collections) {
		generateCollection(collections[i], rdfDoc);
	}
	modsCollection.rdf::RDF = rdfDoc;
	
	write(''<?xml version="1.0"?>''+"\n");
	write(modsCollection.toXMLString());
}');

REPLACE INTO "translators" VALUES ('6e372642-ed9d-4934-b5d1-c11ac758ebb7', '2006-07-05 23:40:00', 2, 'Dublin Core (RDF/XML)', 'Simon Kornblith', 'xml', '',
'function doExport(items) {
	var addSubclass = new Object();
	var partialItemTypes = ["bookSection", "journalArticle", "magazineArticle", "newspaperArticle"];
	
	var rdfDoc = <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://dublincore.org/documents/dcq-rdf-xml/" />;
	var rdf = new Namespace("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
	var dcterms = new Namespace("dcterms", "http://purl.org/dc/terms/");
	var dc = new Namespace("dc", "http://purl.org/dc/elements/1.1/");
	
	for(var i in items) {
		var item = items[i];
		
		if(item.itemType == "note") {
			continue;
		}
		
		var isPartialItem = false;
		if(utilities.inArray(item.itemType, partialItemTypes)) {
			isPartialItem = true;
		}
		
		var description = <rdf:Description xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" />;
		if(item.ISBN) {
			description.@rdf::about = "urn:isbn:"+item.ISBN;
		} else if(item.ISSN) {
			description.@rdf::about = "urn:issn:"+item.ISSN;
		} else if(item.url) {
			description.@rdf::about = item.url;
		} else {
			// just specify a node ID
			description.@rdf::nodeID = item.itemID;
		}
		
		/** CORE FIELDS **/
		
		// XML tag titleInfo; object field title
		description.dc::title = item.title;
		
		// XML tag typeOfResource/genre; object field type
		var type;
		if(item.itemType == "film") {
			type = "MovingImage";
		} else if(item.itemType == "artwork") {
			type = "StillImage";
		} else {
			type = "Text";
		}
		description.dc::type.@rdf::resource = "http://purl.org/dc/dcmitype/"+type;
		
		// XML tag name; object field creators
		for(var j in item.creators) {
			// put creators in lastName, firstName format (although DC doesn''t specify)
			var creator = item.creators[j].lastName;
			if(item.creators[j].firstName) {
				creator += ", "+item.creators[j].firstName;
			}
			
			if(item.creators[j].creatorType == "author") {
				description.dc::creator += <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">{creator}</dc:creator>;
			} else {
				description.dc::contributor.* += <dc:contributor xmlns:dc="http://purl.org/dc/elements/1.1/">{creator}</dc:contributor>;
			}
		}
		
		/** FIELDS ON NEARLY EVERYTHING BUT NOT A PART OF THE CORE **/
		
		// source
		if(item.source) {
			description.dc::source = item.source;
		}
		
		// accessionNumber as generic ID
		if(item.accessionNumber) {
			description.dc::identifier = item.accessionNumber;
		}
		
		// rights
		if(item.rights) {
			description.dc::rights = item.rights;
		}
		
		/** SUPPLEMENTAL FIELDS **/
		
		// publication/series -> isPartOf
		if(item.publication) {
			description.dcterms::isPartOf = item.publication;
			addSubclass.isPartOf = true;
		} else if(item.series) {
			description.dcterms::isPartOf = item.series;
			addSubclass.isPartOf = true;
		}
		
		// TODO - create text citation and OpenURL citation to handle volume, number, pages, issue, place
		
		// edition
		if(item.edition) {
			description.dcterms::hasVersion = item.edition;
		}
		// publisher/distributor
		if(item.publisher) {
			description.dc::publisher = item.publisher;
		} else if(item.distributor) {
			description.dc::publisher = item.distributor;
		}
		// date/year
		if(item.date) {
			description.dc::date = item.date;
		} else if(item.year) {
			description.dc::date = item.year;
		}
		
		// ISBN/ISSN
		var resource = false;
		if(item.ISBN) {
			resource = "urn:isbn:"+item.ISBN;
		} else if(item.ISSN) {
			resource = "urn:issn:"+item.ISSN;
		}
		if(resource) {
			if(isPartialItem) {
				description.dcterms::isPartOf.@rdf::resource = resource;
				addSubclass.isPartOf = true;
			} else {
				description.dc::identifier.@rdf::resource = resource;
			}
		}
		
		// callNumber
		if(item.callNumber) {
			description.dc::identifier += <dc:identifier xmlns:dc="http://purl.org/dc/elements/1.1/">item.callNumber</dc:identifier>;
		}
		
		// archiveLocation
		if(item.archiveLocation) {
			description.dc::coverage = item.archiveLocation;
		}
		
		rdfDoc.rdf::Description += description;
	}
	
	if(addSubclass.isPartOf) {
		rdfDoc.rdf::Description += <rdf:Description rdf:about="http://purl.org/dc/terms/abstract" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#">
			<rdfs:subPropertyOf rdf:resource="http://purl.org/dc/elements/1.1/description"/>
		  </rdf:Description>;
	}
	
	write(''<?xml version="1.0"?>''+"\n");
	write(rdfDoc.toXMLString());
}');


REPLACE INTO "translators" VALUES ('32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7', '2006-06-30 15:36:00', 2, 'RIS', 'Simon Kornblith', 'ris',
'addOption("exportNotes", true);
addOption("exportFileData", true);',
'function addTag(tag, value) {
	if(value) {
		write(tag+"  - "+value+"\r\n");
	}
}

function doExport(items) {
	for(var i in items) {
		var item = items[i];
		
		// can''t store notes in RIS
		if(item.itemType == "note") {
			continue;
		}
		
		// type
		// TODO - figure out if these are the best types for letter, interview, website
		if(item.itemType == "book") {
			var risType = "BOOK";
		} else if(item.itemType == "bookSection") {
			var risType = "CHAP";
		} else if(item.itemType == "journalArticle") {
			var risType = "JOUR";
		} else if(item.itemType == "magazineArticle") {
			var risType = "MGZN";
		} else if(item.itemType == "newspaperArticle") {
			var risType = "NEWS";
		} else if(item.itemType == "thesis") {
			var risType = "THES";
		} else if(item.itemType == "letter" || item.itemType == "interview") {
			var risType = "PCOMM";
		} else if(item.itemType == "film") {
			var risType = "MPCT";
		} else if(item.itemType == "artwork") {
			var risType = "ART";
		} else if(item.itemType == "website") {
			var risType = "ICOMM";
		}
		addTag("TY", risType);
		// ID
		addTag("ID", item.itemID);
		// primary title
		addTag("T1", item.title);
		// series title
		addTag("T3", item.series);
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
		// publication
		addTag("JF", item.publication);
		// volume
		addTag("VL", item.volume);
		// number
		addTag("IS", item.number);
		// pages
		if(item.pages) {
			var range = utilities.getPageRange(item.pages);
			addTag("SP", range[0]);
			addTag("EP", range[1]);
		}
		// place
		addTag("CP", item.place);
		// publisher
		addTag("PB", item.publisher);
		// ISBN/ISSN
		addTag("SN", item.ISBN);
		addTag("SN", item.ISSN);
		// URL
		if(item.url) {
			addTag("UR", item.url);
		} else if(item.source && item.source.substr(0, 7) == "http://") {
			addTag("UR", item.source);
		}
		write("\r\n");
	}
}');