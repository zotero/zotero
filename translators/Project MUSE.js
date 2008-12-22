{
	"translatorID":"c54d1932-73ce-dfd4-a943-109380e06574",
	"translatorType":4,
	"label":"Project MUSE",
	"creator":"Simon Kornblith",
	"target":"https?://[^/]*muse\\.jhu\\.edu[^/]*/(?:journals/[^/]+/[^/]+/[^/]+\\.html|search/results)",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-12-22 19:50:00"
}

function detectWeb(doc, url) {
	var searchRe = new RegExp("^https?://[^/]+/search/results");
	if(searchRe.test(url)) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var searchRe = new RegExp("^https?://[^/]+/search/results");
	if(detectWeb(doc, url) == "multiple") {
		var items = new Array();
		var attachments = new Array();
		var pdfRe = /PDF/;
		var htmlRe = /HTML/;
		
		var tableRows = doc.evaluate('//div[@id="advancedsearch"]/save_form/table//tr',
		                             doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		// Go through table rows
		while(tableRow = tableRows.iterateNext()) {
			// aid (article id) is what we need to get it all as one file
			var input = doc.evaluate('.//input[@name="aid"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			var title = doc.evaluate('.//div[@class="title"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(input && input.value && title && title.textContent) {
				items[input.value] = title.textContent;
				
				var aTags = tableRow.getElementsByTagName("a");
				
				// get attachments
				attachments[input.value] = new Array();
				for(var i=0; i<aTags.length; i++) {
					var linkText = aTags[i].textContent;
					if(pdfRe.test(linkText)) {
						attachments[input.value].push({url:aTags[i].href,
													  title:"Project MUSE Full Text PDF",
													  mimeType:"application/pdf"});
					} else if(htmlRe.test(linkText)) {
						attachments[input.value].push({url:aTags[i].href,
													  title:"Project MUSE Snapshot",
													  mimeType:"text/html"});
					}
				}
			}
		}
		items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		
		var articleString = "";
		var newAttachments = new Array();
		for(var i in items) {
			articleString += "&aid="+i;
			newAttachments.push(attachments[i]);
		}
		
		Zotero.Utilities.HTTP.doGet("http://muse.jhu.edu/search/export.cgi?exporttype=endnote"+articleString, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				if(item.notes && item.notes[0]) {
					item.extra = item.notes[0].note;						
					delete item.notes;
					item.notes = undefined;
				}
				item.attachments = newAttachments.shift();
				item.complete();
			});
			translator.translate();
			Zotero.done();
		}, function() {});
		
		Zotero.wait();
	} else {
		var hostRe = new RegExp("^(http://[^/]+)/");
		var m = hostRe.exec(url);
		var host = m[1];

		var getPDF = doc.evaluate('//a[text() = "PDF Version"]', doc,
		                          nsResolver, XPathResult.ANY_TYPE, null).iterateNext();		
		
		var newUrl = url.replace(host, host+"/metadata/zotero");
		Zotero.Utilities.HTTP.doGet(newUrl, function(text) {
			var translator = Zotero.loadTranslator("import");
			//set RIS translator
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				if(item.notes && item.notes[0]) {
					item.extra = item.notes[0].note;						
					delete item.notes;
					item.notes = undefined;
				}
				item.attachments.splice(0);
				item.attachments.push({document:doc, title:"Project MUSE Snapshot"});
				if(getPDF) {
					item.attachments.push({title:"Project MUSE Full Text PDF", mimeType:"application/pdf",
					url:getPDF.href});
				}
				
				item.complete();
			});
			translator.translate();
		});
	}
}