{
	"translatorID": "5d506fe3-dbde-4424-90e8-d219c63faf72",
	"label": "Library Catalog (BiblioCommons)",
	"creator": "Avram Lyon",
	"target": "^https?://[^.]+\\.bibliocommons\\.com\\/",
	"minVersion": "2.1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2011-07-19 20:37:25"
}


/*
   BiblioCommons Translator
   Copyright (C) 2011 Avram Lyon, ajlyon@gmail.com

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

function detectWeb(doc, url) {
	if (url.match(/\/item\/(?:show|catalogue_info)/))
		return "book";
	if (url.match(/\/search\?t=/))
		return "multiple";
	return false;
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;

	// Load MARC
	var translator = Z.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");

	var domain = url.match(/https?:\/\/([^.\/]+)/)[1];

	if (url.match(/\/item\/show/)) {
		Zotero.Utilities.doGet(url.replace(/\/item\/show/,"/item/catalogue_info"),
					function (text) {
						translator.getTranslatorObject(function (obj) {
							processor({	
								translator: obj,
								text: text,
								domain: domain
							});
						})
					}, function() {Zotero.done()});
	} else if (url.match(/\/item\/catalogue_info/)) {
		translator.getTranslatorObject(function (obj) {
			processor({	
				translator: obj,
				text: doc.documentElement.innerHTML,
				domain: domain
			});
		})
	} else if (url.match(/\/search\?t=/)) {
		var results = doc.evaluate('//div[@id="bibList"]/div/div//span[@class="title"]/a[1]', doc, ns, XPathResult.ANY_TYPE, null);
		var items = new Array();
		var result;
		while(result = results.iterateNext()) {
				var title = result.textContent;
				var url = result.href.replace(/\/show\//,"/catalogue_info/");
				items[url] = title;
		}
		Zotero.selectItems(items, function (items) {
			var urls = [];
			var i;
			for (i in items) urls.push(i);
			Zotero.Utilities.doGet(urls, function (text) {
				translator.getTranslatorObject(function (obj) {
					processor({
						translator: obj,
						text: text,
						domain: domain
					});
				})
			}, function() {Zotero.done()});
        });
        Zotero.wait();
	}
}

function processor (obj) {
		// Gets {translator: , text: }
		// Here, we split up the table and insert little placeholders between record bits
		var marced = obj.text.replace(/\s+/g," ")
					.replace(/^.*<div id="marc_details">(?:\s*<[^>"]+>\s*)*/,"")
					.replace(/<tr +class="(?:odd|even)">\s*/g,"")
					.replace(/<td +class="marcTag"><strong>(\d+)<\/strong><\/td>\s*/g,"$1\x1F")
					// We may be breaking the indicator here
					.replace(/<td\s+class="marcIndicator">\s*(\d*)\s*<\/td>\s*/g,"$1\x1F")
					.replace(/<td +class="marcTagData">(.*?)<\/td>\s*<\/tr>\s*/g,"$1\x1E")
					.replace(/\x1F(?:[^\x1F]*)$/,"\x1F")
					// We have some extra 0's at the start of the leader
					.replace(/^000/,"");
		//Z.debug(marced);
		
		// We've used the record delimiter to delimit fields
		var fields = marced.split("\x1E");
		
		// The preprocess function gets the translator object, if available
		// This is pretty vital for fancy translators like MARC
		var marc = obj["translator"];
		// Make a record, only one.
		var record = new marc.record();
		// The first piece is the MARC leader
		record.leader = fields.shift();
		for each (var field in fields) {
			// Skip blanks
			if (field.replace(/\x1F|\s/g,"") == "") continue;
			// We're using the subfield delimiter to separate the field code,
			// indicator, and the content.
			var pieces = field.split("\x1F");
			record.addField(pieces[0].trim(),
							pieces[1].trim(),
							// Now we insert the subfield delimiter
							pieces[2].replace(/\$([a-z]|$)/g,"\x1F$1").trim());
		}
		// returns {translator: , text: false, items: [Zotero.Item[]]}
		var item = new Zotero.Item();
		record.translate(item);
		item.libraryCatalog = obj.domain + " Library Catalog";
		item.complete();
		return true;
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://bostonpl.bibliocommons.com/item/catalogue_info/2993906042_test",
		"items": [
			{
				"itemType": "book",
				"creators": [
					{
						"firstName": "William",
						"lastName": "Sleator",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"Education",
					"Immigrants",
					"Conspiracies",
					"Political corruption",
					"Educational tests and measurements"
				],
				"seeAlso": [],
				"attachments": [],
				"ISBN": "0810993562",
				"title": "Test",
				"place": "New York",
				"publisher": "Amulet Books",
				"date": "2008",
				"numPages": "298",
				"callNumber": "SLEATOR W",
				"libraryCatalog": "bostonpl Library Catalog"
			}
		]
	},
	{
		"type": "web",
		"url": "http://nypl.bibliocommons.com/search?t=smart&search_category=keyword&q=tatar&commit=Search&searchOpt=catalogue",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://bostonpl.bibliocommons.com/item/show/3679347042_adam_smith",
		"items": [
			{
				"itemType": "book",
				"creators": [
					{
						"firstName": "James R",
						"lastName": "Otteson",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"Smith, Adam",
					"Classical school of economics",
					"Free enterprise"
				],
				"seeAlso": [],
				"attachments": [],
				"ISBN": "9780826429834",
				"title": "Adam Smith",
				"place": "New York",
				"publisher": "Continuum",
				"date": "2011",
				"numPages": "179",
				"series": "Major conservative and libertarian thinkers",
				"seriesNumber": "v. 16",
				"callNumber": "HB103.S6",
				"libraryCatalog": "bostonpl Library Catalog"
			}
		]
	}
]
/** END TEST CASES **/
