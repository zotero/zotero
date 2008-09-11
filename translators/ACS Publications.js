{
	"translatorID":"938ebe32-2b2e-4349-a5b3-b3a05d3de627",
	"translatorType":4,
	"label":"ACS Publications",
	"creator":"Sean Takats and Michael Berkowitz",
	"target":"http://[^/]*pubs3?.acs.org[^/]*/(?:wls/journals/query/(?:subscriberResults|query)\\.html|acs/journals/toc.page|cgi-bin/(?:article|abstract|sample|asap).cgi)?",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-06 08:15:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	if(doc.evaluate('//input[@name="jid"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//jid', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	} 
	return false;
}

function handleRequests(requests, pdfs) {
	if(requests.length == 0) {
		Zotero.done();
		return;
	}

	var request = requests.shift();

	Zotero.Utilities.HTTP.doGet("http://pubs.acs.org/wls/journals/citation2/Citation?"+request.jid, function() {
		Zotero.Utilities.HTTP.doPost("http://pubs.acs.org/wls/journals/citation2/Citation",
							"includeAbstract=citation-abstract&format=refmgr&submit=1&mode=GET", function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				var pdf = pdfs.shift();
				if(pdf) {
					item.attachments.push({
					title:"ACS Full Text PDF",
					url:pdf, mimeType:"application/pdf"
					});
				}
				if (!item.attachments[0].title)
					item.attachments[0].title = "ACS Snapshot";
				item.complete();
				});
			translator.translate();

			handleRequests(requests);
		});
	});
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var pdfs = new Array();
	var requests = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		// search page
		var items = new Array();
		if (doc.evaluate('//form[@name="citationSelect"]//tbody/tr[1]//span[@class="textbold"][1]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var titles = doc.evaluate('//form[@name="citationSelect"]//tbody/tr[1]//span[@class="textbold"][1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else if (doc.evaluate('//form/div[@class="artBox"]/div[@class="artBody"]/div[@class="artTitle"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var titles = doc.evaluate('//form/div[@class="artBox"]/div[@class="artBody"]/div[@class="artTitle"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		if (doc.evaluate('//form[@name="citationSelect"]//input[@name="jid"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var jids = doc.evaluate('//form[@name="citationSelect"]//input[@name="jid"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else if (doc.evaluate('//div[@id="content"]/form/div[@class="artBox"]/div[@class="artHeadBox"]/div[@class="artHeader"]/input', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var jids = doc.evaluate('//div[@id="content"]/form/div[@class="artBox"]/div[@class="artHeadBox"]/div[@class="artHeader"]/input', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		var links = doc.evaluate('//form[@name="citationSelect"]//tbody/tr[2]//a[@class="link"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var title;
		var jid;
		var id;
		var link;
		while ((title = titles.iterateNext()) && (jid = jids.iterateNext())){
			id = jid.value
			items[id] = Zotero.Utilities.trimInternal(title.textContent);

			var link = doc.evaluate('../../..//a[contains(text(), "PDF")]', title, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if(link) {
					links[id] = link.href.replace("searchRedirect.cgi", "article.cgi");
				}
		}

		items = Zotero.selectItems(items);
		if(!items) return true;

		var getstring = "";
		for(var i in items) {
			getstring = getstring + "jid=" + encodeURIComponent(i) + "&";
			pdfs.push(links[i]+"?sessid=");
		}
		requests.push({jid:getstring});
	} else {
		// single page
		var jid = doc.evaluate('//jid', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		jid = jid.substr(jid.indexOf("/")+1);
		var pdf = doc.evaluate('/html/body//a[contains(text(), "PDF")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if (!pdf) {
			var pdf = doc.evaluate('/html/body//a[contains(@href, "/pdf/")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		}
		if (pdf) {
           		pdf = pdf.href;
           		pdf = pdf.replace("searchRedirect.cgi", "article.cgi");
           		pdfs.push(pdf+"?sessid=");
        	}
		var requests = [{jid:"jid=" + encodeURIComponent(jid)}]; 
	}
	handleRequests(requests, pdfs);

	Zotero.wait();
}