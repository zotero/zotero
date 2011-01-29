{
	"translatorID":"cee0cca2-e82a-4618-b6cf-16327970169d",
	"translatorType":4,
	"label":"Gene Ontology",
	"creator":"Amelia Ireland",
	"target":"^https?:\/\/.*\\.geneontology\\.org",
	"minVersion":"2.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":false,
	"lastUpdated":"2011-01-27 21:28:58"
}

/*
	Gene Ontology website translator
	Copyright (C) 2010-2011 girlwithglasses, amelia.ireland@gmail.com

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
/*
	This translator works on cited PubMed references on the Gene Ontology website.

	It makes use of the code of the existing PubMed translator; thanks to the
	authors of that translator for their premium quality code.
*/

var items = {};
var selectArray = {};


function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x" ) return namespace; else return null;
	} : null;

	var xPath = '//cite//*[@class="pmid"] | //cite//a[contains (@href, "pubmed")]';
	var cites = doc.evaluate(xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();

	if (cites)
	{	Zotero.debug("Found some cites!");
		return "multiple";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var myPMID = '//cite//*[@class="pmid"] | //cite//a[contains (@href, "pubmed")]';
	var pmids = doc.evaluate(myPMID, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var pmid_list = new Array();
	var unknown_list = new Array();
	var x;
	while (x = pmids.iterateNext()) {
		if (x.href && x.href.match('pubmed')) {
			// get the number
			var n = x.href.lastIndexOf("/");
			n++;
			pmid_list.push(x.href.substr(n));
//			Zotero.debug("Got a pubmed href! " + x.href.substr(n));
		}
		else {
			unknown_list.push(x);
		}
	}
	if (unknown_list.length > 0) {
//		Zotero.debug("Couldn't work out what to do with these refs: " + unknown_list.join("\n"));
	}
	if (pmid_list.length > 0) {
		Zotero.debug( "Found " + pmid_list.length + " PMIDs!" );
	}
	// get the data from the NCBI server
	var pmids = pmid_list.join(",");
	var url = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=" + pmids;

	Zotero.Utilities.HTTP.doGet(url, function(text) {
	// load translator for PubMed
		var translator = Zotero.loadTranslator("import");
//		var translator = Zotero.Translate.Import;
		translator.setTranslator("fcf41bed-0cbc-3704-85c7-8062a0068a7a");
		translator.setString(text);

		// don't save when item is done
		translator.setHandler("itemDone", function(obj, item) {
			items[item.extra] = item;
			selectArray[item.extra] = item.title;
		});

		translator.translate();

		// all pmids retrieved now
		selectArray = Zotero.selectItems(selectArray);
		for(var PMID in selectArray) {
			items[PMID].complete();
		}

		Zotero.done();
	});
	Zotero.wait();
}
