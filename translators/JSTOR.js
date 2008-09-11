{
	"translatorID":"d921155f-0186-1684-615c-ca57682ced9b",
	"translatorType":4,
	"label":"JSTOR",
	"creator":"Simon Kornblith, Sean Takats and Michael Berkowitz",
	"target":"https?://[^/]*jstor\\.org[^/]*/(action/(showArticle|doBasicSearch|doAdvancedSearch)|stable/|pss|sici)",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-27 16:45:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	// See if this is a seach results page
	if (doc.title == "JSTOR: Search Results" || url.match(/\/i\d+/)) {
		return "multiple";
	} else if(url.indexOf("/search/") != -1) {
		return false;
	}
	
	// If this is a view page, find the link to the citation
	var xpath = '//a[@id="favorites"]';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if(elmts.iterateNext() || url.match(/pss/)) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var hostRegexp = new RegExp("^(https?://[^/]+)/");
	var hMatch = hostRegexp.exec(url);
	var host = hMatch[1];

	// If this is a view page, find the link to the citation
	var xpath = '//a[@id="favorites"]';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if (url.match(/pss/)) {
		var jid = url.match(/\d+/);
		var downloadString = "&noDoi=yesDoi&downloadFileName=deadbeef&suffix=" + jid;
		var pdfYes = false;
	} else {
		if(elmt = elmts.iterateNext()) {
			var jid;
			var jidRe1 = new RegExp("doi=[0-9\.]+/([0-9]+)");
			var jidRe2 = new RegExp("stable/view/([0-9]+)");
			var jidRe3 = new RegExp("stable/([0-9]+)");
			var jidmatch1 = jidRe1.exec(url);
			var jidmatch2 = jidRe2.exec(url);
			var jidmatch3 = jidRe3.exec(url);
			if (jidmatch1) {
				jid = jidmatch1[1];
			} else if (jidmatch2) {
				jid = jidmatch2[1];
			} else if (jidmatch3) {
				jid = jidmatch3[1];
			} else {
				jid = elmt.href.match(/jid=([0-9]+)/)[1];
			}
			var downloadString = "&noDoi=yesDoi&downloadFileName=deadbeef&suffix="+jid;
		}
		else{
			var availableItems = new Object();
			var tableRows = doc.evaluate('//li[ul/li/a[@class="title"]]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var tableRow;
			var jid;
			var title;
			var jidRe = new RegExp("[0-9\.]+/([0-9]+)");
			while(tableRow = tableRows.iterateNext()) {
				title = doc.evaluate('./ul/li/a[@class="title"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				jid = doc.evaluate('.//input[@name="doi"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
				var m = jidRe.exec(jid);
				if (m) {
					jid = m[1];
				}
				availableItems[jid] = title;
			}
	
			var items = Zotero.selectItems(availableItems);
			if(!items) {
				return true;
			}
			var downloadString="&noDoi=yesDoi&downloadFileName=deadbeef";
			for(var i in items) {
				downloadString+="&suffix="+i;
			}
		}
		var pdfYes = true;
	}

	Zotero.Utilities.HTTP.doPost(host+"/action/downloadCitation?format=refman&direct=true",
								 downloadString, function(text) {
		// load translator for RIS
		Zotero.debug(text);
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			if(item.notes && item.notes[0]) {
				item.extra = item.notes[0].note;

				delete item.notes;
				item.notes = undefined;
			}
			item.attachments[0].title = item.title;
			item.attachments[0].mimeType = "text/html";
			Zotero.debug(host);
			var pdfurl = item.url.replace(/([^\d]+)(\d+)$/, host + "/stable/pdfplus/$2") + ".pdf";
			if (pdfYes == true) item.attachments.push({url:pdfurl, title:"JSTOR Full Text PDF", mimeType:"application/pdf"});
			item.complete();
		});
		
		translator.translate();

		Zotero.done();
	});

}