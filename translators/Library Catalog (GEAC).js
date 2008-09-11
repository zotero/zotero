{
	"translatorID":"c0e6fda6-0ecd-e4f4-39ca-37a4de436e15",
	"translatorType":4,
	"label":"Library Catalog (GEAC)",
	"creator":"Simon Kornblith",
	"target":"/(?:GeacQUERY|GeacFETCH[\\:\\?].*[&:]next=html/(?:record\\.html|geacnffull\\.html))",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2006-12-15 15:11:00"
}

function detectWeb(doc, url) {
	if(doc.location.href.indexOf("/GeacQUERY") > 0) {
		return "multiple";
	} else {
		return "book";
	}
}

function doWeb(doc, url) {
	var uri = doc.location.href;
	
	var uris = new Array();
	
	if(uri.indexOf("/GeacQUERY") > 0) {
		var items = Zotero.Utilities.getItemArray(doc, doc, "(?:Geac)?FETCH[\:\?].*[&:]next=html/(?:record\.html|geacnffull\.html)");
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			var newUri = i.replace(/([:&])next=html\/geacnffull.html/, "$1next=html/marc.html");
			newUri = newUri.replace(/([:&])next=html\/record.html/, "$1next=html/marc.html");
			uris.push(newUri);
		}
	} else {
		var newUri = uri.replace(/([:&])next=html\/geacnffull.html/, "$1next=html/marc.html");
		newUri = newUri.replace(/([:&])next=html\/record.html/, "$1next=html/marc.html");
		uris.push(newUri);
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	
	Zotero.Utilities.processDocuments(uris, function(newDoc) {
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == 'x') return namespace; else return null;
		} : null;
		
		var record = new marc.record();
		
		var elmts = newDoc.evaluate('//pre/text()', newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null);
		var elmt, tag, content;
		var ind = "";
		
		while(elmt = elmts.iterateNext()) {
			var line = elmt.nodeValue;
			
			if(line.substring(0, 6) == "       ") {
				content += " "+line.substring(6);
				continue;
			} else {
				if(tag) {
					record.addField(tag, ind, content);
				}
			}
			
			line = line.replace(/[_\t\xA0]/g," "); // nbsp
			
			tag = line.substr(0, 3);
			if(tag[0] != "0" || tag[1] != "0") {
				ind = line.substr(4, 2);
				content = line.substr(7).replace(/\$([a-z])(?: |$)/g, marc.subfieldDelimiter+"$1");
			} else {
				if(tag == "000") {
					tag = undefined;
					record.leader = "00000"+line.substr(4);
				} else {
					content = line.substr(4);
				}
			}
			
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";
		
		newItem.complete();
	}, function() { Zotero.done(); }, null);
	
	Zotero.wait();
}