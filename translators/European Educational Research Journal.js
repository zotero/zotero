{
	"translatorID":"2e304579-dd7b-4770-85e9-0d724c9b49a5",
	"translatorType":4,
	"label":"European Educational Research Journal",
	"creator":"Michael Berkowitz",
	"target":"http://www.wwwords.co.uk/eerj/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-05 07:45:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//div[@id="maincontent"]/table[*//p[@class="articletitle"]]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
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
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return false;
	} : null;
	var items = new Object();
	var titles = doc.evaluate('//p[@class="articletitle"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var title;
	while (title = titles.iterateNext()) {
		var text = Zotero.Utilities.trimInternal(title.textContent);
		items[text] = text;
	}
	items = Zotero.selectItems(items);
	Zotero.debug(items);
	
	var articles = doc.evaluate('//div[@id="maincontent"]/table[*//p[@class="articletitle"]]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var art;
	while (art = articles.iterateNext()) {
		var title = Zotero.Utilities.trimInternal(doc.evaluate('.//p[@class="articletitle"]', art, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		if (items[title]) {
			var pdfurl = doc.evaluate('.//a[contains(text(), "FULL TEXT")]', art, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
			var item = new Zotero.Item("journalArticle");
			item.publicationTitle = "European Educational Research Journal";
			item.ISSN = "1474-9041";
			item.url = url;
			item.title = title;
			var voliss = doc.title.match(/\-\s+(.*)$/)[1];
			voliss = voliss.match(/Volume\s+(\d+)\s+Issue\s+(\d+)\s+\((\d+)\)/);
			item.volume = voliss[1];
			item.issue = voliss[2];
			item.date = voliss[3];
			
			var authors = doc.evaluate('.//tr[2]/td', art, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var ibits = doc.evaluate('.//tr[2]/td//i', art, nsResolver, XPathResult.ANY_TYPE, null);
			var ibit = "";
			var bit;
			while (bit = ibits.iterateNext()) {
				authors = authors.replace(bit.textContent, ",");
			}
			authors = authors.split(/\s*(,|&)\s*/);
			for each (var aut in authors) {
				if (aut.match(/\w/)) {
					aut = titleCase(Zotero.Utilities.trimInternal(aut));
					item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
				}
			}
			item.attachments = [{url:pdfurl, title:"EERJ Full Text PDF", mimeType:"application/pdf"}];
			item.complete();
		}
	}
}