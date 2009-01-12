{
	"translatorID":"fb12ae9e-f473-cab4-0546-27ab88c64101",
	"translatorType":4,
	"label":"Library Catalog (DRA)",
	"creator":"Simon Kornblith",
	"target":"/web2/tramp2\\.exe/(?:see\\_record/|authority\\_hits/|goto/.*\\?.*screen=Record\\.html)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-12 18:25:00"
}

function detectWeb(doc, url) {
	if(doc.location.href.indexOf("/authority_hits") > 0) {
		return "multiple";
	} else {
		return "book";
	}
}

function doWeb(doc, url) {
	var checkItems = false;
	
	if(doc.location.href.indexOf("/authority_hits") > 0) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		
		checkItems = Zotero.Utilities.gatherElementsOnXPath(doc, doc, "/html/body//ol/li", nsResolver);
	}
	
	if(checkItems && checkItems.length) {
		var items = Zotero.Utilities.getItemArray(doc, checkItems, 'https?://.*/web2/tramp2\.exe/see_record');
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = [];
		for(var i in items) {
			uris.push(i);
		}
	} else {
		var uris = [doc.location.href];
	}
	
	for(var i in uris) {
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
		
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		translator.setHandler("itemDone", function(obj, item) {
			item.repository = domain[1]+" Library Catalog";
			item.complete();
		});
		
		Zotero.Utilities.HTTP.doGet(newUri, function(text) {
			translator.setString(text);
			translator.translate();
			
			j++;
			if(j == uris.length) {
				Zotero.done();
			}
		});
	}
	Zotero.wait();
}