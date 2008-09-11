{
	"translatorID":"9c335444-a562-4f88-b291-607e8f46a9bb",
	"translatorType":4,
	"label":"Berkeley Library Catalog",
	"creator":"Simon Kornblith",
	"target":"^https?://[^/]*berkeley.edu[^/]*/WebZ/(?:html/results.html|FETCH)\\?.*sessionid=",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-02 11:00:00"
}

function detectWeb(doc, url) {
	var resultsRegexp = /\/WebZ\/html\/results.html/i
	if(resultsRegexp.test(url)) {
		return "multiple";
	} else {
		return "book";
	}
}

function reformURL(url) {
	return url.replace(/fmtclass=[^&]*/, "")+":fmtclass=marc";
}

function doWeb(doc, url) {
	var resultsRegexp = /\/WebZ\/html\/results.html/i
	
	if(resultsRegexp.test(url)) {
		var items = Zotero.Utilities.getItemArray(doc, doc, "/WebZ/FETCH", "^[0-9]*$");
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(reformURL(i));
		}
	} else {
		var urls = [reformURL(url)];
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	
	Zotero.Utilities.processDocuments(urls, function(newDoc) {
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == 'x') return namespace; else return null;
		} : null;
		
		var elmts = newDoc.evaluate('//table/tbody/tr[@valign="top"]',
		                         newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var record = new marc.record();
		while(elmt = elmts.iterateNext()) {
			var field = Zotero.Utilities.superCleanString(newDoc.evaluate('./TD[1]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
			var value = newDoc.evaluate('./TD[2]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			// remove spacing
			value = value.replace(/^\s+/, "");
			value = value.replace(/\s+$/, "");
			if(field == 0) {
				record.leader = "00000"+value;
			} else {
				var ind = value[3]+value[5];
				if (value.match(/^\d{1,2}\s{3}/)) value = Zotero.Utilities.cleanString(value.replace(/^\d{1,2}\s{3}/, ""));
				value = value.replace(/\$([a-z0-9]) /g, marc.subfieldDelimiter+"$1");
				if(value[0] != marc.subfieldDelimiter) {
					value = marc.subfieldDelimiter+"a"+value;
				}
				record.addField(field, ind, value);
			}
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		var oldTags = newItem.tags;
		var newTags = new Array();
		for each (var tag in oldTags) {
			if (newTags.indexOf(tag) == -1) newTags.push(tag)
		}
		newItem.tags = newTags;
		newItem.repository = "Berkeley Library Catalog";
		
		newItem.complete();
	}, function() { Zotero.done(); }, null);
	
	Zotero.wait();
}