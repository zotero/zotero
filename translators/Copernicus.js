{
        "translatorID": "8082115d-5bc6-4517-a4e8-abed1b2a784a",
        "label": "Copernicus",
        "creator": "Michael Berkowitz",
        "target": "http://www.(adv-sci-res|adv-geosci|adv-radio-sci|ann-geophys|astrophys-space-sci-trans|atmos-chem-phys|biogeosciences(-discuss)?|clim-past|electronic-earth|hydrol-earth-syst-sci|nat-hazards-earth-syst-sci|nonlin-processes-geophys|ocean-sci|soc-geogr|surv-perspect-integr-environ-soc|the-cryosphere).net/",
        "minVersion": "2.1",
        "maxVersion": "",
        "priority": 100,
        "inRepository": true,
        "translatorType": 4,
        "lastUpdated": "2011-07-01 10:38:24"
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

/** BEGIN TEST CASES **/
var testCases = [
    {
        "type": "web",
        "url": "http://www.adv-geosci.net/30/1/2011/adgeo-30-1-2011.html",
        "items": [
            {
                "itemType": "journalArticle",
                "creators": [
                    {
                        "lastName": "Michaelides",
                        "firstName": "S.",
                        "creatorType": "author"
                    },
                    {
                        "lastName": "Athanasatos",
                        "firstName": "S.",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://www.adv-geosci.net/30/1/2011/",
                        "title": "Adv. Geosci. Snapshot",
                        "mimeType": "text/html"
                    },
                    {
                        "url": "http://www.adv-geosci.net/30/1/2011/adgeo-30-1-2011.pdf",
                        "mimeType": "application/pdf",
                        "title": "Adv. Geosci. PDF",
                        "downloadable": true
                    }
                ],
                "title": "Preface ''Precipitation: Measurement, Climatology, Remote Sensing, and Modeling (EGU 2010)''",
                "publicationTitle": "Adv. Geosci.",
                "volume": "30",
                "pages": "1-2",
                "date": "May 09, 2011",
                "publisher": "Copernicus Publications",
                "ISBN": "1680-7359",
                "ISSN": "1680-7359",
                "url": "http://www.adv-geosci.net/30/1/2011/",
                "DOI": "10.5194/adgeo-30-1-2011",
                "libraryCatalog": "Copernicus Online Journals",
                "accessDate": "CURRENT_TIMESTAMP",
                "shortTitle": "Preface ''Precipitation"
            }
        ]
    },
    {
        "type": "web",
        "url": "http://www.adv-radio-sci.net/6/1/2008/ars-6-1-2008.html",
        "items": [
            {
                "itemType": "journalArticle",
                "creators": [
                    {
                        "lastName": "Will",
                        "firstName": "B.",
                        "creatorType": "author"
                    },
                    {
                        "lastName": "Gerding",
                        "firstName": "M.",
                        "creatorType": "author"
                    },
                    {
                        "lastName": "Schultz",
                        "firstName": "S.",
                        "creatorType": "author"
                    },
                    {
                        "lastName": "Schiek",
                        "firstName": "B.",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://www.adv-radio-sci.net/6/1/2008/",
                        "title": "Adv. Radio Sci. Snapshot",
                        "mimeType": "text/html"
                    },
                    {
                        "url": "http://www.adv-radio-sci.net/6/1/2008/ars-6-1-2008.pdf",
                        "mimeType": "application/pdf",
                        "title": "Adv. Radio Sci. PDF",
                        "downloadable": true
                    }
                ],
                "title": "Time domain reflectrometry measurements using a movable obstacle for the determination of dielectric profiles",
                "publicationTitle": "Adv. Radio Sci.",
                "volume": "6",
                "pages": "1-4",
                "date": "May 26, 2008",
                "publisher": "Copernicus Publications",
                "ISBN": "1684-9965",
                "ISSN": "1684-9965",
                "url": "http://www.adv-radio-sci.net/6/1/2008/",
                "DOI": "10.5194/ars-6-1-2008",
                "libraryCatalog": "Copernicus Online Journals",
                "accessDate": "CURRENT_TIMESTAMP"
            }
        ]
    }
]
/** END TEST CASES **/
