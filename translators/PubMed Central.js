{
	"translatorID":"27ee5b2c-2a5a-4afc-a0aa-d386642d4eed",
	"translatorType":4,
	"label":"PubMed Central",
	"creator":"Michael Berkowitz",
	"target":"http://[^/]*.nih.gov/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-06 17:00:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//table[@id="ResultPanel"]//td[2]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("articlerender") != -1) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var tagMap = {journal_title:"publicationTitle",
					title:"title",
					date:"date",
					issue:"issue",
					volume:"volume",
					doi:"DOI",
					fulltext_html_url:"url"
				};
	var URIs = new Array();
	var items = new Object();
	if (doc.title.indexOf("PMC Results") != -1) {
		var titlex = '//div[@class="toc-entry"]/div/div[@class="toc-title"]';
		var linkx = '//div[@class="toc-entry"]/div/a[@class="toc-link"][1]';
		
		var titles = doc.evaluate(titlex, doc, null, XPathResult.ANY_TYPE, null);
		var next_title = titles.iterateNext();
		var links = doc.evaluate(linkx, doc, null, XPathResult.ANY_TYPE, null);
		var next_link = links.iterateNext();
		while (next_title && next_link) {
			items[next_link.href] = next_title.textContent;
			next_title = titles.iterateNext();
			next_link = links.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			URIs.push(i);
		}
	} else {
		URIs.push(url);
	}
		Zotero.Utilities.HTTP.doGet(URIs, function(text) {
			var tags = new Object();
			var meta = text.match(/<meta[^>]*>/gi);
			for (var i in meta) {
				var item = meta[i].match(/=\"([^"]*)\"/g);
				if (item[0].substring(2, 10) == 'citation') {
					tags[item[0].substring(11, item[0].length - 1)] = item[1].substring(2, item[1].length - 1);
				}
			}
			var newItem = new Zotero.Item("journalArticle");
			for (var tag in tagMap) {
				newItem[tagMap[tag]] = Zotero.Utilities.unescapeHTML(tags[tag]);
			}
			for (var i in meta) {
				if (meta[i].match(/DC.Contributor/)) {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(Zotero.Utilities.unescapeHTML(meta[i].match(/content=\"([^"]*)\">/)[1]), "author"));
				}
			}
			newItem.attachments.push({url:tags["fulltext_html_url"], title:"PubMed Central Snapshot", mimeType:"text/html"});
			if (tags["pdf_url"]) {	
				newItem.attachments.push({url:tags["pdf_url"], title:"PubMed Central Full Text PDF", mimeType:"application/pdf"});
			}
			newItem.url = tags["fulltext_html_url"];
			if (!newItem.url) newItem.url = tags["abstract_html_url"];
			newItem.extra = "PMCID:" + text.match(/PMCID: <\/span>(\d+)/)[1];
			newItem.journalAbbreviation = text.match(/span class=\"citation-abbreviation\">([^<]+)</)[1];
			newItem.pages = text.match(/span class=\"citation-flpages\">([^<]+)</)[1].replace(/[\.:\s]/g, "");
			
			if (text.match(/Abstract<\/div>([^<]+)</)) {
				var abstract = text.match(/Abstract<\/div>([^<]+)</)[1];
			} else if (text.match(/\"section-content\"><!\-\-article\-meta\-\->([^<]+)/)) {
				var abstract = text.match(/\"section-content\"><!\-\-article\-meta\-\->([^<]+)/)[1];
			}
			if (abstract) newItem.abstractNote = abstract;
			newItem.complete();
		}, function(){ Zotero.done();} 
		);
	Zotero.wait();
}