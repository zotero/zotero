{
	"translatorID":"8082115d-5bc6-4517-a4e8-abed1b2a784a",
	"translatorType":4,
	"label":"Copernicus2",
	"creator":"Michael Berkowitz",
	"target":"http://www.(adv-sci-res|astrophys-space-sci-trans|atmos-chem-phys|biogeosciences(-discuss)?|clim-past|electronic-earth|hydrol-earth-syst-sci|nat-hazards-earth-syst-sci|nonlin-processes-geophys|ocean-sci|soc-geogr|surv-perspect-integr-environ-soc|the-cryosphere).net/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-29 21:10:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//div[@id="publisher"]/iframe', doc, null, XPathResult.ANY_TYPE, null).iterateNext() || doc.evaluate('//td[*[a[contains(text(), "Abstract")]]]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.title.match(/Abstract/)) {
		return "journalArticle";
	}
}

function getRIS(link) {
	Zotero.Utilities.HTTP.doGet(link, function(text) {
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			item.repository = "Copernicus Online Journals";
			item.attachments[0].title = item.publicationTitle + " Snapshot";
			item.attachments[0].mimeType = "text/html";
			item.attachments[1].title = item.publicationTitle + " PDF";
			item.complete();
		});
		translator.translate();
	});
}

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.evaluate('//div[@id="publisher"]/iframe', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var link = doc.evaluate('//div[@id="publisher"]/iframe', doc, null, XPathResult.ANY_TYPE, null).iterateNext().src;
			Zotero.Utilities.HTTP.doGet(link, function(text) {
				var links = text.match(/<a\s+target=\"_top\"\s+href=\"[^"]+\">[^<]+/g);
				for each (var link in links) {
					link = link.match(/href=\"([^"]+)\">(.*)/);
					items[link[1].replace(/\.[^\.]+$/, ".ris")] = Zotero.Utilities.trimInternal(link[2]) + "...";
				}
				items = Zotero.selectItems(items);
				for (var i in items) {
					getRIS(i);
				}
			});
		} else {
			var titles = doc.evaluate('//td[*[a[contains(text(), "Abstract")]]]/span[@class="pb_toc_article_title"]', doc, null, XPathResult.ANY_TYPE, null);
			var links = doc.evaluate('//td[*[a[contains(text(), "Abstract")]]]//a[1]', doc, null, XPathResult.ANY_TYPE, null);
			var title;
			var link;
			while ((title = titles.iterateNext()) && (link = links.iterateNext())) {
				items[link.href] = title.textContent;
			}
			items = Zotero.selectItems(items);
			for (var i in items) {
				getRIS(i.replace(".html", ".ris"));
			}
		}
	} else {
		getRIS(url.replace('.html', '.ris'));
	}
	Zotero.wait();
}