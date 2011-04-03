{
	"translatorID":"594ebe3c-90a0-4830-83bc-9502825a6810",
	"translatorType":4,
	"label":"ISI Web of Knowledge",
	"creator":"Michael Berkowitz",
	"target":"(WOS_GeneralSearch|product=WOS|product=CABI)",
	"minVersion":"2.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2010-04-01 22:50:00"
}

function detectWeb(doc, url) {
	if ((doc.title.indexOf("Web of Science Results") != -1) | (doc.title.indexOf("CABI Results") != -1)) {
		return "multiple";
	} else if (url.indexOf("full_record.do") != -1) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var ids = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object;
		var xpath = '//a[@class="smallV110"]';
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href.match(/\?(.*)/)[1]] = next_title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			ids.push(i);
		} 
	} else {
		ids.push(url.match(/\?(.*)/)[1]);
	}
	var hostRegexp = new RegExp("^(https?://[^/]+)/");
	var m = hostRegexp.exec(url);
	var host = m[1];
	for (var i in ids) {
		ids[i] = host+"/full_record.do?" + ids[i];
	}
	var product = url.match("product=([^\&]+)\&")[1];
	for (var i=0 ; i<ids.length; i++) {
		newDoc = Zotero.Utilities.retrieveDocument(ids[i]);
		var url = newDoc.location.href;
		var sid = newDoc.evaluate('//input[@name="selectedIds"]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().value;
		var nid = newDoc.evaluate('//input[@name="SID"]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().value;
		var post2 = 'product='+product+'&product_sid=' + nid + '&plugin=&product_st_thomas=http://esti.isiknowledge.com:8360/esti/xrpc&export_ref.x=0&export_ref.y=0';
		var post = 'action=go&mode=quickOutput&product='+product+'&SID=' + nid + '&format=ref&fields=BibAbs&mark_id='+product+'&count_new_items_marked=0&selectedIds=' + sid + '&qo_fields=bib&endnote.x=95&endnote.y=12&save_options=default';
		Zotero.Utilities.HTTP.retrieveSource('http://apps.isiknowledge.com/OutboundService.do', post);
		var text = Zotero.Utilities.HTTP.retrieveSource('http://pcs.isiknowledge.com/uml/uml_view.cgi', post2);
		var lines = text.split("\n");
		var field = " ";
		var content = " ";
		var item = new Zotero.Item("journalArticle");
		item.url = url;
		var authors;
		var fieldRe = /^[A-Z0-9]{2}(?: |$)/;
		for each(var line in lines) {
			if(line.match(fieldRe)) {
				field = line.match(fieldRe)[0].substr(0,2);
				content = line.substr(3);
				if ((field == "AF" || field == "AU")) {
					if (!item.creators[0]) {
						var author = content.split(",");
						item.creators.push({firstName:author[1], lastName:author[0], creatorType:"author"});
					} else {
						field = "";
					}
				} else if (field == "TI") {
					item.title = content;
				} else if (field == "SO") {
					// People say ISI is bad about being all-caps; let's try this for now
					// http://forums.zotero.org/discussion/17316
					if (content.toUpperCase() == content) Zotero.Utilities.capitalizeTitle(content.toLowerCase(), true);
					item.publicationTitle = content;
				} else if (field == "SN") {
					item.ISSN = content;
				} else if (field == "PD" || field == "PY") {
					if (item.date) {
						item.date += " " + content;
					} else {
						item.date = content;
					}
				} else if (field == "VL") {
					item.volume = content;
				} else if (field == "IS") {
					item.issue = content;
				} else if (field == "BP") {
					item.pages = content;
				} else if (field == "EP") {
					item.pages += "-" + content;
				} else if (field == "AB") {
					item.abstractNote = content;
				} else if (field == "DI") {
					item.DOI = content;
				}
			} else {
				content = Zotero.Utilities.trimInternal(line);
				if (field == "AF" || field == "AU") {
					var author = content.split(",");
					item.creators.push({firstName:author[1], lastName:author[0], creatorType:"author"});
				} else if (field == "TI") {
					item.title += " " + content;
				} else if (field == "AB") {
					item.abstractNote += " " + content;
				}
			}
		}
		item.attachments = [{url:item.url, title:"ISI Web of Knowledge Snapshot", mimeType:"text/html"}];
		item.complete();
	}
}
