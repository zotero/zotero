{
	"translatorID":"84564450-d633-4de2-bbcc-451ea580f0d6",
	"translatorType":4,
	"label":"Gale Literature Resource Center",
	"creator":"Simon Kornblith",
	"target":"^https?://[^/]+/servlet/LitRC?(?:|.*&)srchtp=(?:adv)?mla(?:&|$)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-03-28 20:00:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if(doc.title.length <= 33 || doc.title.substr(0, 33) != "Literature Resource Center -- MLA") return false;
	
	if(url.indexOf("docNum=") != -1) {	// article;
		return "journalArticle";
	} else if(doc.evaluate('//tr[td/span[@class="stndxtralead"]]', doc, nsResolver,
	   XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
	
	return false;
}

function extractCitation(type, citation) {
	type = Zotero.Utilities.cleanString(type).toLowerCase();
	citation = Zotero.Utilities.cleanString(citation);
	
	if(type == "book article") {
		var item = new Zotero.Item("bookSection");
	} else if(type == "book" || type == "book collection") {
		var item = new Zotero.Item("book");
	} else if(type == "dissertation abstract") {
		var item = new Zotero.Item("thesis");
	} else {
		var item = new Zotero.Item("journalArticle");
	}
	
	var m;
	if(item.itemType == "journalArticle" || item.itemType == "thesis") {
		m = citation.match(/^(.+)\. "([^"]+)" (.+), ([0-9\:]*) ?\(([^\)]+)\)(?:, (?:pp\. ([\-0-9]+)|([\-0-9A-Z]+)))?/);
		if(!m) return false;
		
		item.publicationTitle = m[3];
		var parts = m[4].split(":");
		if(parts.length == 2) {
			item.volume = parts[0];
			item.issue = parts[1];
		} else {
			item.issue = m[4];
		}
		item.date = m[5];
		item.pages = m[6] ? m[6] : m[7];
	} else if(item.itemType == "book") {
		m = citation.match(/^(.+)\. "([^"]+)" ([^:]+): ([^,]+), ([0-9]{4})\..*?(?:([0-9]+) pp\.)/);
		if(!m) return false;
		
		item.place = m[3];
		item.publisher = m[4];
		item.date = m[5];
		item.pages = m[6];
	} else if(item.itemType == "bookSection") {
		m = citation.match(/^(.+)\. "([^"]+)" pp\. ([\-0-9]+)\. (?:((?:[^\.]*|\([^\)]+\)| [A-Z]\.)*)\.)? ([^\(\)]+). ([^:]+): ([^,]+), ([0-9]{4})/);
		if(!m) return false;
		
		Zotero.debug(m);
		
		item.pages = m[3];
		var bookAuthors = m[4].split(" and ");
		for each(var bookAuthor in bookAuthors) {
			var n = bookAuthor.match(/^([^,]+), ([^\(]+)(?: \(([^\)]+)\)?)?$/);
			if(n) {
				var type = (n[3] && n[3].toLowerCase().indexOf("ed.") != -1) ? "editor" : "author";
				item.creators.push({lastName:n[1], firstName:n[2], creatorType:type})
			}
		}
		item.publicationTitle = m[5];
		item.place = m[6];
		item.publisher = m[7];
		item.date = m[8];
	}
	
	// add creators
	var creators = m[1].split("; ");
	for each(var creator in creators) {
		item.creators.push(Zotero.Utilities.cleanAuthor(creator, "author", true));
	}
	if(m[2][m[2].length-1] == ".") {
		item.title = m[2].substr(0, m[2].length-1);
	} else {
		item.title = m[2];
	}
	
	return item;
}

function doWeb(doc, url) {	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var uri = doc.location.href;
	if(url.indexOf("docNum=") != -1) {	// article;
		var citation = doc.evaluate('//td[b/text() = "Source Database:"] | //td[*/b/text() = "Source Database:"]', doc, nsResolver,
			XPathResult.ANY_TYPE, null).iterateNext().innerHTML;
		
		// ugh
		var parts = citation.split(/<\/CENTER>/i);
		var citation = parts[parts.length-1];
		citation = citation.replace(/<script[^>]*>(?:.|[\r\n])*<\/script>/gi, "");
		citation = citation.replace(/<a[^>]*>(?:.|[\r\n])*<\/a>/gi, "");
		
		// big enormous hack, but it works
		var span = doc.createElement("span");
		span.innerHTML = citation;
		citation = span.textContent;
		
		var citeM = citation.match(/^\s*([^\n]+)/);
		var subjectM = citation.match(/Subject Terms:\s+([^\n]+)/);
		var typeM = citation.match(/Document Type:\s+([^\n]+)/);
		var issnM = citation.match(/ISSN:\s+([^\n]+)/);
		
		var item = extractCitation(typeM[1], citeM[1]);
		item.tags = subjectM[1].split("; ");
		
		if(issnM) item.ISSN = issnM[1];
		
		item.complete();
	} else {							// search results
		var items = new Array();
				
		var tableRows = doc.evaluate('//tr[td/span[@class="stndxtralead"]]', doc, nsResolver,
		                             XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
		// Go through table rows
		for(var i=0; i<tableRows.snapshotLength; i++) {
			items[i] = doc.evaluate('./td/span[@class="stndxtralead"]//a', tableRows.snapshotItem(i),
				nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			items[i] = items[i].substring(1, items[i].length-1);
		}
		
		items = Zotero.selectItems(items);
		if(!items) return true
		
		for(var i in items) {
			var tableRow = tableRows.snapshotItem(i);
			
			var type = doc.evaluate('./td[3]/span[@class="stndxtralead"]', tableRow, nsResolver,
				XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var citation = doc.evaluate('./td/span[@class="stndxtralead"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			
			var item = extractCitation(type, citation);
			if(!item) continue;
			
			var terms = doc.evaluate('.//span[@class="mlasubjects"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(terms) {
				// chop off "[Subject Terms: " and "]"
				terms = terms.textContent;
				terms = terms.substring(16, terms.length-2);
				item.tags = terms.split("; ");
			}
			
			item.complete();
		}
	}
}