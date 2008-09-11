{
	"translatorID":"cb48083-4d9-4ed-ac95-2e93dceea0ec",
	"translatorType":4,
	"label":"Blackwell Synergy",
	"creator":"Michael Berkowitz",
	"target":"https?://www\\.blackwell-synergy\\.com[^/]*/(?:action/doSearch|doi/|links/doi/)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-04-28 17:50:00"
}

function detectWeb(doc, url) {
	if(url.indexOf("doSearch") != -1) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}

function titleCase(str) {
	var skipWords = ["but", "or", "yet", "so", "for", "and", "nor", "a", "an", "the", "at", "by", "from", "in", "into", "of", "on", "to", "with", "up", "down", "as"];
	var words = str.toLowerCase().split(/\s+/);
	var newstr = "";
	for each (var word in words) {
		if (skipWords.indexOf(word.replace(/[^a-zA-Z]+/, "")) != -1) {
			newstr += " " + word;
		} else if (word.indexOf("-") != -1) {
			newword = word.split("-");
			newstr += " " + newword[0][0].toUpperCase() + newword[0].substr(1) + "-" + newword[1][0].toUpperCase() + newword[1].substr(1);
		} else {
			newstr += " " + word[0].toUpperCase() + word.substr(1);
		}
	}
	return Zotero.Utilities.trimInternal(newstr);
}

function doWeb(doc, url) {
	var host = doc.location.host;
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var rows = doc.evaluate('//div[@class="toc_item"]', doc, null, XPathResult.ANY_TYPE, null);
		var row;
		while (row = rows.iterateNext()) {
			var title = Zotero.Utilities.trimInternal(doc.evaluate('.//label', row, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var id = doc.evaluate('.//input[@name="doi"]', row, null, XPathResult.ANY_TYPE, null).iterateNext().value;
			items[id] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [decodeURIComponent(url).match(/doi\/(abs\/)?([^\?]+)(\?|$)/)[2]];
	}
	
	var post = "";
	for each (var doi in articles) {
		post += "doi=" + encodeURIComponent(doi) + "&"
	}
	post += "include=abs&format=refman&submit=Download+references";
	Zotero.Utilities.HTTP.doPost('http://www.blackwell-synergy.com/action/downloadCitation', post, function(text) {
		text = text.replace(/(Y1\s+\-\s+)(\d{4}\/\d{2}).*\n/, "$1$2\n");
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) { 
			item.DOI = Zotero.Utilities.trimInternal(item.notes[0]['note'].substr(4));
			item.notes = new Array();
			item.attachments = [
				{url:item.url, title:"Blackwell Synergy Snapshot", mimeType:"text/html"},
				{url:item.url.replace(/\/\/[^/]*/, "//" + host).replace("/doi/abs", "/doi/pdf"), title:"Blackwell Synergy Full Text PDF", mimeType:"application/pdf"}
			];
			// use fulltext if possible
			var oldCreators = item.creators;
			item.creators = []
			for each (var author in oldCreators) {
				if (author["lastName"] != "") {
					item.creators.push({firstName:titleCase(author.firstName), lastName:titleCase(author.lastName), creatorType:"author"});
				}
			}
			item.title = titleCase(item.title);
			item.complete();
		});
		translator.translate();
		
		Zotero.done();
	});
}