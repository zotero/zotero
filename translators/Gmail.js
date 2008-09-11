{
	"translatorID":"58a778cc-25e2-4884-95b3-6b22d7571183",
	"translatorType":4,
	"label":"Gmail",
	"creator":"Michael Berkowitz",
	"target":"http://mail.google.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-17 19:30:00"
}

function detectWeb(doc, url) {
	if (url.match(/#inbox\/[\w\d]+/)) {
		return "document";
	}
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var scripts = doc.evaluate('//script', doc, ns, XPathResult.ANY_TYPE, null);
	var script;
	var text = "";
	while (script = scripts.iterateNext()) {
		text += script.textContent;
	}
	var ik = text.match(/ID_KEY:\"([^"]+)\"/)[1]
	var th = url.match(/#inbox\/(.*)$/)[1];
	var newurl = 'http://mail.google.com/mail/?ui=2&ik=' + ik + '&view=om&th=' + th;
	Zotero.Utilities.HTTP.doGet(newurl, function(text) {
		var item = new Zotero.Item("email");
		var to = text.match(/\nTo:\s+([^\n]+)\n/)[1];
		item.creators.push(Zotero.Utilities.cleanAuthor(Zotero.Utilities.trimInternal(to.replace(/<.*>/g, "")), "recipient"));
		var from = text.match(/\nFrom:\s+([^\n]+)\n/)[1];
		item.creators.push(Zotero.Utilities.cleanAuthor(Zotero.Utilities.trimInternal(from.replace(/<.*>/g, "")), "author"));
		item.date = text.match(/\nDate:\s+(.*,\s+\d+\s+\w+\s+\d{4})/)[1];
		item.subject = text.match(/\nSubject:\s+([^\n]+)/)[1];
		if (item.subject == "") item.subject = "<No Subject>";
		item.title = item.subject;
		item.complete();
	});
	Zotero.wait();
}