{
	"translatorID": "a14ac3eb-64a0-4179-970c-92ecc2fec992",
	"label": "Scopus",
	"creator": "Michael Berkowitz, Rintze Zelle and Avram Lyon",
	"target": "^http://www\\.scopus\\.com[^/]*",
	"minVersion": "2.1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"lastUpdated": "2011-07-27 14:06:10"
}

/*
   Scopus Translator
   Copyright (C) 2008-2011 Center for History and New Media

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU Affero General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU Affero General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

function detectWeb(doc, url) {
	if (url.indexOf("/results/") !== -1) {
		return "multiple";
	} else if (url.indexOf("/record/") !== -1) {
		return "journalArticle";
	}
}

function getEID(url) {
	return url.match(/eid=([^&]+)/)[1];
}

function returnURL(eid) {
	return 'http://www.scopus.com/citation/output.url?origin=recordpage&eid=' + eid + '&src=s&view=FullDocument&outputType=export';
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == 'x') return namespace; else return null;
	} : null;

	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		items = new Object();
		var boxes = doc.evaluate('//div[@id="resultsBody"]/table/tbody/tr[@class and (not(@id) or not(contains(@id,"previewabstractrow")))]/td[@class="fldtextPad"][1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var box;
		while (box = boxes.iterateNext()) {
			var link = doc.evaluate('.//a', box, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			items[link.href] = Zotero.Utilities.trimInternal(link.textContent);
		}
		Zotero.selectItems(items, function (items) {
			for (var i in items) {
				articles.push(returnURL(getEID(i)));
			}
			scrape(articles);
		});
	} else {
		articles = [returnURL(getEID(url))];
		scrape(articles);
	}
	Zotero.wait();
}

function scrape(articles) {
	var article = articles.shift();
	Zotero.Utilities.doGet(article, function(text, obj) {
		var stateKey = text.match(/<input[^>]*name="stateKey"[^>]*>/);
		if (!stateKey) Zotero.debug("No stateKey");
		else stateKey = stateKey[0].match(/value="([^"]*)"/)[1];
		var eid = text.match(/<input[^>]*name="eid"[^>]*>/);
		if (!eid) Zotero.debug("No eid");
		else eid = eid[0].match(/value="([^"]*)"/)[1];
		var get = 'http://www.scopus.com/citation/export.url';
		var post = 'origin=recordpage&sid=&src=s&stateKey=' + stateKey + '&eid=' + eid + '&sort=&exportFormat=RIS&view=CiteAbsKeyws&selectedCitationInformationItemsAll=on';
		var rislink = get + "?" + post;	
		Zotero.Utilities.HTTP.doGet(rislink, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				for (i in item.notes) {
					if (item.notes[i]['note'].match(/Export Date:|Source:/))
						delete item.notes[i];
				}
				delete item.url;
				item.complete();
			});
			translator.translate();
		}, function() { 
			if (articles.length > 0) scrape(articles);
			else Zotero.done();
		});
	});
}
