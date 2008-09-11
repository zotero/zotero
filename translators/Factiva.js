{
	"translatorID":"7bdb79e-a47f-4e3d-b317-ccd5a0a74456",
	"translatorType":4,
	"label":"Factiva",
	"creator":"Simon Kornblith",
	"target":"https?://[^/]*global\\.factiva\\.com[^/]*/ha/default\\.aspx$",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-20 19:10:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if(doc.evaluate('//tr[@class="headline"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		if(doc.body.className == 'articleView') {
			return "newspaperArticle";
		} else {
			return "multiple";
		}
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var items = new Array();
	var singlePage = doc.body.className == 'articleView';
	
	var tableRows = doc.evaluate('//tr[@class="headline"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var tableRow;
	while(tableRow = tableRows.iterateNext()) {
		var hdl = doc.evaluate('.//input[@name="hdl"]', tableRow, nsResolver, XPathResult.ANY_TYPE,
			null).iterateNext().value;
		if(!singlePage){
			items[hdl] = Zotero.Utilities.cleanString(tableRow.getElementsByTagName("a")[0].textContent);
		} else {
			var m = doc.evaluate('.//td[@class="count"]', tableRow, nsResolver, XPathResult.ANY_TYPE, 
				null).iterateNext().textContent.match(/[0-9]+/);
			items[m[0]] = hdl;
		}
	}
	
	if(!singlePage) {
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var hdls = new Array();
		for(var hdl in items) {
			hdls.push(hdl);
		}
	} else {
		var m = doc.evaluate('//div[@class="articleHeader"][@id="artHdr1"]/span[substring(text(), 1, 7) = "Article"]',
			doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/[0-9]+/);
		var hdls = [items[m[0]]];
	}
	
	var post = "";
	
	var hiddenInputs = doc.evaluate('//form[@name="PageBaseForm"]//input[@type="hidden"]', doc, nsResolver,
		XPathResult.ANY_TYPE, null);
	var hiddenInput;
	while(hiddenInput = hiddenInputs.iterateNext()) {
		// this is some weird shit, but apparently they're very picky
		post = post+"&"+hiddenInput.name+"="+escape(hiddenInput.value).replace(/\+/g, "%2B").replace(/\%20/g, "+");
	}
	
	var selects = doc.evaluate('//form[@name="PageBaseForm"]//select', doc, nsResolver,
		XPathResult.ANY_TYPE, null);
	var select;
	while(select = selects.iterateNext()) {
		post = post+"&"+select.name+"="+escape(select.options[select.selectedIndex].value);
	}
	
	for each(var hdl in hdls) {
		post += "&hdl="+escape(hdl);
	}
	post = post.substr(1);
	
	Zotero.Utilities.HTTP.doPost("http://global.factiva.com/pps/default.aspx?pp=XML", post, function(text) {
		// Remove xml parse instruction and doctype
		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");
		// kill the XML namespace, too, because we have no way of knowing what it will be, which presents a problem
		text = text.replace(/<ppsArticleResponse xmlns="[^"]+">/, "<ppsArticleResponse>");
		// kill hlt tags; they just make parsing harder
		text = text.replace(/<\/?hlt>/g, "");
		var xml = new XML(text);
		
		// loop through articles
		for each(var ppsarticle in xml[0]..ppsarticle) {
			var article = ppsarticle.article;
			var newItem = new Zotero.Item("newspaperArticle");
			
			newItem.title = Zotero.Utilities.cleanString(article.headline.paragraph.text().toString());
			newItem.publicationTitle = Zotero.Utilities.cleanString(article.sourceName.text().toString());
			for each(var tag in article..name) {
				newItem.tags.push(tag.text().toString());
			}
			newItem.date = Zotero.Utilities.formatDate(Zotero.Utilities.strToDate(article.publicationDate.date.text().toString()));
			if(article.byline.length()) {
				var byline = Zotero.Utilities.cleanString(article.byline.text().toString().replace(/By/i, ""));
				var authors = byline.split(/ (?:\&|and) /i);
				for each(var author in authors) {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
				}
			}
			newItem.section = article.sectionName.text().toString();
			newItem.edition = article.edition.text().toString();
			
			if(article.pages.length()) {
				newItem.pages = "";
				for each(var page in article.pages.page) {
					newItem.pages += ","+page.text().toString();
				}
				newItem.pages = newItem.pages.substr(1);
			}
			
			var m = article.volume.text().toString().match(/ISSN[:\s]*([\-0-9]{8,9})/i);
			if(m) newItem.ISSN = m[1];
			
			newItem.complete();
		}
		
		Zotero.done();
	});
		
	Zotero.wait();
}