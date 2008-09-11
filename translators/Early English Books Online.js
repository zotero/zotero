{
	"translatorID":"b86bb082-6310-4772-a93c-913eaa3dfa1b",
	"translatorType":4,
	"label":"Early English Books Online",
	"creator":"Michael Berkowitz",
	"target":"http://[^/]*eebo.chadwyck.com[^/]*/search",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-02-11 19:30:00"
}

function detectWeb(doc, url) {
	if (doc.title == "Search Results - EEBO") {
		return "multiple";
	} else if (doc.title != "Basic Search - EEBO") {
		return "book";
	}
}

function doWeb(doc, url) {
	var eeboIDs = new Array();
	
	var hostRegexp = new RegExp("^(https?://[^/]+)/");
	var hMatch = hostRegexp.exec(url);
	var host = hMatch[1];

	if (doc.title == "Search Results - EEBO") {
		var items = new Object();
		Zotero.debug("search page");
		var IDxpath = '//td[3]/script';
		var Titlexpath = '//td[3]/i';
		var new_ids = doc.evaluate(IDxpath, doc, null, XPathResult.ANY_TYPE, null);
		var new_titles = doc.evaluate(Titlexpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_id = new_ids.iterateNext();
		var next_title = new_titles.iterateNext();
		var IDRegex = /'(\d+)'/;
		while (next_id) {
			items[next_id.textContent.match(IDRegex)[1]] = next_title.textContent;
			next_id = new_ids.iterateNext();
			next_title = new_titles.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			eeboIDs.push(i);
		}
	} else {
		var IDRegex = /&ID=(\w+)&/
		var eeboid = url.match(IDRegex)[1];
		if (eeboid[0] == "D") {
			eeboid = eeboid.slice(7, 14);
		}
		eeboIDs.push(eeboid);
	}
	Zotero.debug(eeboIDs);
	for (var i = 0 ; i < eeboIDs.length ; i++) {
		var postString = 'cit_format=RIS&Print=Print&cit_eeboid=' + eeboIDs[i] + '&EeboId=' + eeboIDs[i];
		var new_eeboid = eeboIDs[i]
		Zotero.Utilities.HTTP.doPost(host+'/search/print', postString, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text.substring(17));
			translator.setHandler("itemDone", function(obj, item) {
				item.url = host+'/search/full_rec?SOURCE=pgimages.cfg&ACTION=ByID&ID=' + new_eeboid + '&FILE=../session/1190302085_15129&SEARCHSCREEN=CITATIONS&SEARCHCONFIG=config.cfg&DISPLAY=ALPHA';
				item.complete();
			});
			translator.translate();
			Zotero.done();
		});
	}
}