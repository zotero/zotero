{
	"translatorID":"88915634-1af6-c134-0171-56fd198235ed",
	"translatorType":4,
	"label":"Library Catalog (Voyager)",
	"creator":"Simon Kornblith",
	"target":"Pwebrecon\\.cgi",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-07-15 20:35:00"
}

function detectWeb(doc, url) {
	var export_options = doc.forms.namedItem('frm').elements.namedItem('RD').options;
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
		|| export_options[i].text == 'MARC communication format') {
			// We have an exportable single record
			if(doc.forms.namedItem('frm').elements.namedItem('RC')) {
				return "multiple";
			} else {
				return "book";
			}
		}
	}
}

function doWeb(doc, url) {
	var postString = '';
	var form = doc.forms.namedItem('frm');
	var newUri = form.action;
	var multiple = false;
	
	if(doc.forms.namedItem('frm').elements.namedItem('RC')) {
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
						text = Zotero.Utilities.cleanString(text);
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
				availableItems[i] = Zotero.Utilities.cleanString(doc.evaluate('./td[2]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
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
	
	var export_options = form.elements.namedItem('RD').options;
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
		|| export_options[i].text == 'MARC communication format') {
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