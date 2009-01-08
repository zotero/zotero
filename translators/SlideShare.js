{
	"translatorID":"0cc8e259-106e-4793-8c26-6ec8114a9160",
	"translatorType":4,
	"label":"SlideShare",
	"creator":"Michael Berkowitz",
	"target":"http://www.slideshare.net/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":99,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.indexOf("search") != -1) {
		return "multiple";
	} else if (doc.evaluate('//div[@class="slideProfile"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "presentation";
	}
}

function doWeb(doc, url) {
	var loggedin = false;
	if (doc.evaluate('//a[@class="green_link"][text() = "logout"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		loggedin = true;
	}
	var shows = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var links = doc.evaluate('//div[@class="search_list_box"]/div[@class="text_12"]/a', doc, null, XPathResult.ANY_TYPE, null);
		var next_link;
		while (next_link = links.iterateNext()) {
			items[next_link.href] = Zotero.Utilities.trimInternal(next_link.textContent);
		}
		items = Zotero.selectItems(items);
		if (!items) {
			return true;
		}
		for (var i in items) {
			shows.push(i);
		}
	} else {
		shows = [url];
	}
	Zotero.Utilities.processDocuments(shows, function(newDoc) {
		var downloadable = true;
		if (newDoc.evaluate('//p[@class="upload_p_left"][contains(text(), "Download not available")]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			downloadable = false;
		}
		var item = new Zotero.Item("presentation");
		item.title = newDoc.evaluate('//div[@class="slideProfile"]//h3', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		var creator = newDoc.evaluate('//div[@class="slideProfile"]//p/a[@class="blue_link_normal"]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		item.creators.push(Zotero.Utilities.cleanAuthor(creator, "author"));
		var tags = newDoc.evaluate('//a[@class="grey_tags"]', newDoc, null, XPathResult.ANY_TYPE, null);
		var next_tag;
		while (next_tag = tags.iterateNext()) {
			item.tags.push(Zotero.Utilities.trimInternal(next_tag.textContent));
		}
		var newurl = newDoc.location.href;
		item.url = newurl;
		item.repository = "SlideShare";
		var pdfurl;
		if (newurl.substr(-1) == "/") {
			pdfurl = newurl + "download";
		} else {
			pdfurl = newurl + "/download";
		}
		if (loggedin) {
			if (downloadable) {
				item.attachments.push({url:pdfurl, title:"SlideShare Slide Show", mimeType:"application/pdf"});
			}
		}
		item.complete();
	}, function() {Zotero.done();});
}