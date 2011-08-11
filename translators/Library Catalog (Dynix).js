{
	"translatorID": "774d7dc2-3474-2684-392c-f787789ec63d",
	"label": "Library Catalog (Dynix)",
	"creator": "Simon Kornblith and Sylvain Machefert",
	"target": "ipac\\.jsp\\?.*(?:uri=(?:link|full)=[0-9]|menu=search|term=)",
	"minVersion": "2.1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"lastUpdated": "2011-07-24 19:43:47"
}

function detectWeb(doc, url) {
  var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	// make sure there are multiple results, check to see if the search results number exists
	var xpath = '/html/body/table[4]/tbody/tr[2]/td[1]/table/tbody/tr[2]/td/a/b[1]';
	
	var detailsRe = new RegExp('ipac\.jsp\?.*uri=(?:full|link)=[0-9]');
	if(detailsRe.test(doc.location.href)) {
		return "book";
	} else if(!doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) { // this hack catches search results w/ single items
	  return "book";
	} else {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var uri = doc.location.href;
	var detailsRe = new RegExp('ipac\.jsp\?.*uri=(?:full|link)=[0-9]');
	
	var uris = new Array();
	if(detectWeb(doc,uri) == "book") {
		if (uri.indexOf("#") !== -1)
			uris.push(uri.replace(/#/,'&fullmarc=true#'));
		else
			uris.push(uri+'&fullmarc=true');
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, "ipac\.jsp\?.*uri=(?:full|link)=[0-9]|^javascript:buildNewList\\('.*uri%3Dfull%3D[0-9]", "Show details");
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var buildNewList = new RegExp("^javascript:buildNewList\\('([^']+)");
		
		var uris = new Array();
		for(var i in items) {
			var m = buildNewList.exec(i);
			if(m) {
				uris.push(unescape(m[1]+'&fullmarc=true'));
			} else {
				uris.push(i+'&fullmarc=true');
			}
		}
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	translator.getTranslatorObject(function (marc) {
		Zotero.Utilities.processDocuments(uris, function (newDoc) {
			scrape(newDoc, marc);
			}, function() { Zotero.done() }, null);
	});
	Zotero.wait();
}   

function scrape(newDoc, marc) {
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == 'x') return namespace; else return null;
		} : null;
		
		var xpath = '//form/table[@class="tableBackground"]/tbody/tr/td/table[@class="tableBackground"]/tbody/tr[td[1]/a[@class="normalBlackFont1"]]';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		if (!elmts.iterateNext()) {
			var xpath2 = '//form/table[@class="tableBackground"]/tbody/tr/td/table[@class="tableBackground"]/tbody/tr[td[1]/a[@class="boldBlackFont1"]]';
			var elmts = newDoc.evaluate(xpath2, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		else
		{
			// Added to restart the evaluation. Otherwise, because of the iteratenext 
			// used 5 lines above to test the xpath, we miss the first line (LDR) 
			elmts = newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		}

		var elmt;

		var record = new marc.record();		
		while(elmt = elmts.iterateNext()) {
			var field = Zotero.Utilities.superCleanString(newDoc.evaluate('./TD[1]/A[1]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
			var value = newDoc.evaluate('./TD[2]/TABLE[1]/TBODY[1]/TR[1]/TD[1]/A[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();

			// value = null for non-marc table entries w/ that xpath
			if (!value) {
				value = '';
			} else {
				value = value.textContent;
			}
			
			// Sometimes, the field contains "LDR: ", "001: ". We can delete these extra characters
			field = field.replace(/[\s:]/g, "");
			
			if (field == "LDR"){
  			record.leader = value;
			} else if(field != "FMT") {
				// In french catalogs (in unimarc), the delimiter isn't the $ but \xA4 is used. Added there
				// Also added the fact that subfield codes can be numerics
				value = value.replace(/[\xA4\$]([a-z0-9]) /g, marc.subfieldDelimiter+"$1");
				
				var code = field.substring(0, 3);
				var ind = "";
				if(field.length > 3) {
					ind = field[3];
					if(field.length > 4) {
						ind += field[4];
					}
				}
				record.addField(code, ind, value);
			}
		}
	
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = uri.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";

		// 20091210 : We try to get a permalink on the record
		var perma = uri.match(/(https?:\/\/[^/]+.*ipac\.jsp\?).*(uri\=[^&]*)/);
		var profile = uri.match(/(profile\=[^&]*)/);
		if (perma && perma[1] && perma[2])
		{
			var permalink = perma[1] + perma[2];
			// Sometimes, for libraries with multiple profiles, it can be useful
			// to store the permalink with the profile used
			if (profile)
			{
				permalink = permalink + "&" + profile[1];
			}
			newItem.attachments = [{url:permalink, title:"Original record", mimeType:"text/html", snapshot:false}];
		}
		else
		{
			Zotero.debug("Unable to create permalink on " + uri);
		}

		newItem.complete();
	}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://siris-libraries.si.edu/ipac20/ipac.jsp?&profile=all&source=~!silibraries&uri=full=3100001~!820431~!0#focus",
		"items": [
			{
				"itemType": "book",
				"creators": [
					{
						"lastName": "Pennsylvania Academy of the Fine Arts",
						"fieldMode": true
					},
					{
						"firstName": "Thomas",
						"lastName": "Eakins",
						"creatorType": "contributor"
					},
					{
						"firstName": "Susan Macdowell",
						"lastName": "Eakins",
						"creatorType": "contributor"
					},
					{
						"firstName": "Benjamin",
						"lastName": "Eakins",
						"creatorType": "contributor"
					},
					{
						"firstName": "Charles",
						"lastName": "Bregler",
						"creatorType": "contributor"
					},
					{
						"firstName": "Kathleen A",
						"lastName": "Foster",
						"creatorType": "contributor"
					}
				],
				"notes": [],
				"tags": [
					"Eakins, Thomas",
					"Eakins, Susan Macdowell",
					"Eakins, Benjamin",
					"Bregler, Charles",
					"Bregler, Charles",
					"Library",
					"McDowell family",
					"Manuscripts",
					"Private collections",
					"Pennsylvania Philadelphia"
				],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "Original record",
						"mimeType": "text/html",
						"snapshot": false
					}
				],
				"ISBN": "0812282248",
				"title": "Charles Bregler's Thomas Eakins collection",
				"place": "Philadelphia, PA",
				"publisher": "University of Pennsylvania Press",
				"date": "1989",
				"numPages": "37",
				"callNumber": "mfc 000652",
				"libraryCatalog": "siris-libraries.si.edu Library Catalog"
			}
		]
	}
]
/** END TEST CASES **/