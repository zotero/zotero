{
	"translatorID":"04153a16-5f34-491c-9475-7f4093db8e3e",
	"translatorType":4,
	"label":"University of Michigan",
	"creator":"Matt Burton",
	"target":"http://mirlyn\\.lib\\.umich\\.edu",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-08-08 15:20:00"
}

var mirlyn2zoteroTypeMap = {
	"Book":"book", 
	"Video (DVD)":"videoRecording",
	"Video (VHS)":"videoRecording",
	"Audio CD":"audioRecording"
};

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if (url.indexOf("/Record/") != '-1') {
		var type = doc.evaluate('//span[contains(@class,"iconlabel")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		var zType = mirlyn2zoteroTypeMap[type];
		if (zType) {
			return zType;
		} else { // default to book
			return "book";
		}
	} else if (url.indexOf("/Search/") != "-1") {
		return "multiple";
	}
}

function doWeb (doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var marcURLs = [];
	
	if (detectWeb(doc, url) == "multiple") {
		var links = doc.evaluate("//a[@class='title']", doc, nsResolver, XPathResult.ANY_TYPE, null)
		var items = {}, td;
		while (td = links.iterateNext()) {
			items[td.href] = td.textContent;
		}
		
		items = Zotero.selectItems(items);
		if (!items) {
			return true;
		}
		for (item in items){
			marcURLs.push(item + "/Export?style=MARC");
		}
		
	} else { // we have a single
		marcURLs.push(url + "/Export?style=MARC");
	}
	Zotero.Utilities.doGet(marcURLs, function(text){
		// Merlyn is serving up the controL charcters in decimal, wassup wit dat?
		text = text.replace(/#([^;]*);/g, function(match, group){
			// I wish I could get this more generic method to work, 
			// but something funky about programatically building these hex strings
			// "\\x + parseInt(group).toString(16);
			// do it manually instead
			switch(group) {
				case "29":
					return "\x1d";
				case "30":
					return "\x1e";
				case "31":
				 	return "\x1f";
				default:
					return;
			}
		});
		
		var marc = Zotero.loadTranslator("import");
		marc.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
		marc.setString(text);
		marc.setHandler("itemDone", function(obj, item) {
			item.repository = "Mirlyn Library Catalog";
			item.complete();
		});
		marc.translate();
		
	}, function(){Zotero.done();});
	Zotero.wait();
		
}