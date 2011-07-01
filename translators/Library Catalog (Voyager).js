{
	"translatorID": "88915634-1af6-c134-0171-56fd198235ed",
	"label": "Library Catalog (Voyager)",
	"creator": "Simon Kornblith",
	"target": "Pwebrecon\\.cgi",
	"minVersion": "2.1.9",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2011-07-01 02:14:28"
}

function detectWeb(doc, url) {
	var export_options = ZU.xpath(doc, '//form[@name="frm"]//*[@name="RD"]');
	if(!export_options.length) return false;
	export_options = export_options[0];
	
	for(var i in export_options) {
		if(export_options[i].text == 'Latin1 MARC'
		|| export_options[i].text == 'Raw MARC'
		|| export_options[i].text == 'MARC 8'
		|| export_options[i].text == 'MARC-8'
		|| export_options[i].text == 'UTF-8'
		|| export_options[i].text == 'MARC (Unicode/UTF-8)'
		|| export_options[i].text == 'MARC UTF-8'
		|| export_options[i].text == 'UTF-8 MARC (Unicode)'
		|| export_options[i].text == 'UTF8-Unicode'
		|| export_options[i].text == 'MARC (non-Unicode/MARC-8)'
		|| export_options[i].text == 'MARC communication format'
		|| export_options[i].text == 'MARC Record') {
			// We have an exportable single record
			if(ZU.xpath(doc, '//form[@name="frm"]//*[@name="RC"]').length) {
				return "multiple";
			} else {
				return "book";
			}
		}
	}
}

function doWeb(doc, url) {
	var postString = '';
	var form = ZU.xpath(doc, '//form[@name="frm"]')[0];
	var newUri = form.action;
	var multiple = false;
	
	if(ZU.xpath(form, '//*[@name="RC"]').length) {
		multiple = true;
		
		var availableItems = new Object();	// Technically, associative arrays are objects
			
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		
		// Require link to match this
		var tagRegexp = new RegExp();
		tagRegexp.compile('Pwebrecon\\.cgi\\?.*v1=[0-9]+\\&.*ti=');
		// Do not allow text to match this
		var rejectRegexp = new RegExp();
		rejectRegexp.compile('\[ [0-9]+ \]');
		
		var checkboxes = new Array();
		var urls = new Array();
		
		var tableRows = doc.evaluate('//form[@name="frm"]//table/tbody/tr[td/input[@type="checkbox" or @type="CHECKBOX"]]', doc, nsResolver, XPathResult.ANY_TYPE, null);

		// Go through table rows
		var tableRow;
		var i = 0;
		while(tableRow = tableRows.iterateNext()) {
			i++;
			// CHK is what we need to get it all as one file
			var input = doc.evaluate('./td/input[@name="CHK"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			checkboxes[i] = input.value;
			var links = tableRow.getElementsByTagName("a");
			// Go through links
			for(var j=0; j<links.length; j++) {
				if(tagRegexp.test(links[j].href)) {
					var text = links[j].textContent;
					if(text) {
						text = Zotero.Utilities.trimInternal(text);
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
			// if no title, pull from second td
			if(!availableItems[i]) {
				availableItems[i] = Zotero.Utilities.trimInternal(doc.evaluate('./td[2]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			}
		}
		
		var items = Zotero.selectItems(availableItems);
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
		if(form.elements[i].type && form.elements[i].type.toLowerCase() == 'hidden') {
			postString += escape(form.elements[i].name)+'='+escape(form.elements[i].value)+'&';
		}
	}
	
	var export_options = ZU.xpath(form, '//select[@name="RD"]/option');
	for(var i=0; i<export_options.length; i++) {
		if(export_options[i].text == 'Raw MARC'
		|| export_options[i].text == 'MARC 8'
		|| export_options[i].text == 'MARC-8'
		|| export_options[i].text == 'MARC (non-Unicode/MARC-8)') {
			raw = i;
		}  if(export_options[i].text == 'Latin1 MARC') {
			latin1 = i;
		} else if(export_options[i].text == 'UTF-8'
		|| export_options[i].text == 'UTF-8 MARC (Unicode)'
		|| export_options[i].text == 'UTF8-Unicode'
		|| export_options[i].text == 'MARC UTF-8'
		|| export_options[i].text == 'MARC (Unicode/UTF-8)'
		|| export_options[i].text == 'MARC communication format'
		|| export_options[i].text == 'MARC Record') {
			unicode = i;
		}
	}
	
	var responseCharset = null;
	
	if(unicode) {
		var rd = unicode;
		responseCharset = 'UTF-8';
	} else if(latin1) {
		var rd = latin1;
		responseCharset = 'ISO-8859-1';
	} else if(raw) {
		var rd = raw;
	} else {
		return false;
	}
	
	postString += 'RD='+rd+'&MAILADDY=&SAVE=Press+to+SAVE+or+PRINT';
	
	// No idea why this doesn't work as post
	Zotero.Utilities.HTTP.doGet(newUri+'?'+postString, function(text) {
		// load translator for MARC
		var marc = Zotero.loadTranslator("import");
		marc.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
		marc.setString(text);
		
		// if this is the LOC catalog, specify that in repository field
		if(url.length > 23 && url.substr(0, 23) == "http://catalog.loc.gov/") {
			marc.setHandler("itemDone", function(obj, item) {
				item.repository = "Library of Congress Catalog";
				item.complete();
			});
		} else {
			var domain = url.match(/https?:\/\/([^/]+)/);
			marc.setHandler("itemDone", function(obj, item) {
				item.repository = domain[1]+" Library Catalog";
				item.complete();
			});
		}
		
		marc.translate();
		
		Zotero.done();
	}, null, responseCharset);
	Zotero.wait();
}

/** BEGIN TEST CASES **/
var testCases = [
    {
        "type": "web",
        "url": "http://catalog.loc.gov/cgi-bin/Pwebrecon.cgi?DB=local&Search_Arg=zotero&Search_Code=GKEY^*&CNT=100&hist=1&type=quick",
        "items": [
            {
                "itemType": "book",
                "creators": [
                    {
                        "firstName": "Jason",
                        "lastName": "Puckett",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [
                    "Zotero",
                    "Bibliographical citations",
                    "Computer programs",
                    "Citation of electronic information resources",
                    "Computer programs"
                ],
                "seeAlso": [],
                "attachments": [],
                "ISBN": "9780838985892",
                "title": "Zotero: A Guide for Librarians, Researchers, and Educators",
                "place": "Chicago",
                "publisher": "Association of College and Research Libraries",
                "date": "2011",
                "callNumber": "PN171.F56 P83 2011",
                "libraryCatalog": "Library of Congress Catalog",
                "shortTitle": "Zotero"
            },
            {
                "itemType": "book",
                "creators": [
                    {
                        "lastName": "IAMSLIC Conference",
                        "fieldMode": true
                    },
                    {
                        "firstName": "Dorothy",
                        "lastName": "Barr",
                        "creatorType": "contributor"
                    },
                    {
                        "lastName": "International Association of Aquatic and Marine Science Libraries and Information Centers",
                        "fieldMode": true
                    }
                ],
                "notes": [],
                "tags": [
                    "Marine science libraries",
                    "Marine sciences",
                    "Information services",
                    "Aquatic science libraries",
                    "Aquatic sciences",
                    "Information services",
                    "Fishery libraries",
                    "Fisheries",
                    "Information services"
                ],
                "seeAlso": [],
                "attachments": [],
                "title": "Netting Knowledge: Two Hemispheres/One World: Proceedings of the 36th IAMSLIC Annual Conference",
                "place": "Fort Pierce, Fla",
                "publisher": "IAMSLIC",
                "date": "2011",
                "callNumber": "Z675.M35 I2 2010",
                "libraryCatalog": "Library of Congress Catalog",
                "shortTitle": "Netting Knowledge"
            }
        ]
    }
]
/** END TEST CASES **/