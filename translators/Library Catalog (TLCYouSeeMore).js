{
        "translatorID": "0f9fc2fc-306e-5204-1117-25bca009dffc",
        "label": "Library Catalog (TLC/YouSeeMore)",
        "creator": "Simon Kornblith",
        "target": "TLCScripts/interpac\\.dll\\?(?:.*LabelDisplay.*RecordNumber=[0-9]|Search|ItemTitles)",
        "minVersion": "1.0.0b3.r1",
        "maxVersion": "",
        "priority": 100,
        "inRepository": "1",
        "translatorType": 4,
        "lastUpdated": "2011-03-11 08:58:37"
}

function detectWeb(doc, url) {
	var detailRe = new RegExp("TLCScripts/interpac\.dll\?.*LabelDisplay.*RecordNumber=[0-9]");
	if(detailRe.test(doc.location.href)) {
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
	
	var detailRe = new RegExp("TLCScripts/interpac\.dll\?.*LabelDisplay.*RecordNumber=[0-9]");
	var uri = doc.location.href;
	var newUris = new Array();
	
	if(detailRe.test(uri)) {
		newUris.push(uri.replace("LabelDisplay", "MARCDisplay"));
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, 'TLCScripts/interpac\.dll\?.*LabelDisplay.*RecordNumber=[0-9]');
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			newUris.push(i.replace("LabelDisplay", "MARCDisplay"));
		}
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	
	Zotero.Utilities.processDocuments(newUris, function(newDoc) {
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == 'x') return namespace; else return null;
		} : null;
		
		var record = new marc.record();
		
		var elmts = newDoc.evaluate('/html/body/table/tbody/tr[td[4]]', newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null);
		var tag, ind, content, elmt;
		
		while(elmt = elmts.iterateNext()) {
			tag = newDoc.evaluate('./td[2]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var inds = newDoc.evaluate('./td[3]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			
			tag = tag.replace(/[\r\n]/g, "");
			inds = inds.replace(/[\r\n\xA0]/g, "");
			
			var children = newDoc.evaluate('./td[4]//text()', elmt, nsResolver,
			                               XPathResult.ANY_TYPE, null);
			var subfield = children.iterateNext();
			var fieldContent = children.iterateNext();
			
			if(tag == "LDR") {
				record.leader = "00000"+subfield.nodeValue;
			} else {
				content = "";
				if(!fieldContent) {
					content = subfield.nodeValue;
				} else {
					while(subfield && fieldContent) {
						content += marc.subfieldDelimiter+subfield.nodeValue.substr(1, 1)+fieldContent.nodeValue;
						var subfield = children.iterateNext();
						var fieldContent = children.iterateNext();
					}
				}
				
				record.addField(tag, inds, content);
			}
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";
		
		newItem.complete();
	}, function() {Zotero.done(); }, null);
	
	Zotero.wait();
}