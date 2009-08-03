{
	"translatorID":"fe728bc9-595a-4f03-98fc-766f1d8d0936",
	"translatorType":4,
	"label":"Wiley InterScience",
	"creator":"Sean Takats and Michael Berkowitz",
	"target":"https?:\\/\\/(?:www3\\.|www\\.)?interscience\\.wiley\\.com[^\\/]*\\/(?:search\\/|(cgi-bin|journal)\\/[0-9]+\\/abstract|journal)",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-08-03 01:25:00"
}

function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
		
	var xpath = '//input[@name="ID"][@type="checkbox"]';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
	if (url.match(/journal\/\d+\/(issue|home)$/)) {
		return "multiple";
	}
	var m = url.match(/https?:\/\/[^\/]*\/(cgi-bin|journal)(\/(abstract|summary))?\/[0-9]+\/abstract/);
	if (m){
		return "journalArticle";
	}
}

function doWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var host = 'http://' + doc.location.host + "/";
	Zotero.debug(host);
	var m = url.match(/https?:\/\/[^\/]*\/(journal|cgi-bin\/summary)\/([0-9]+)\/(abstract)?/);
	var ids = new Array();
	if(detectWeb(doc, url) == "multiple") {  //search
		var id;
		var title;
		var availableItems = new Array();
		var xpath = '//tr[td/input[@name="ID"][@type="checkbox"]]';
		if (doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var elmt = elmts.iterateNext();
			do {
				title = doc.evaluate('./td/strong', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				id = doc.evaluate('./td/input[@name="ID"][@type="checkbox"]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
				availableItems[id] = title;
			} while (elmt = elmts.iterateNext())
		} else {
			var xpath = '//div[@id="contentCell"]/div[*/a]';
			var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var elmt = elmts.iterateNext();
			do {
				title = Zotero.Utilities.trimInternal(doc.evaluate('.//strong', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
				id = doc.evaluate('.//a[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href.match(/\/([\d]+)\/abstract/)[1];
				availableItems[id] = title;
			} while (elmt = elmts.iterateNext())
		}
		var items = Zotero.selectItems(availableItems);
		if(!items) {
			return true;
		}
		for(var id in items) {
			ids.push(id);
		}
		
	} else if (m){ //single article
		ids.push(m[2]);
	}
	
	
	var sets = [];
	for each (id in ids) {
		var uri = host + 'tools/citex';
		var poststring = "clienttype=1&subtype=1&mode=1&version=1&id=" + id;
		sets.push({ id: id, uri: uri, poststring: poststring });
	}
	
	var setupCallback = function (set, next) {
		Zotero.Utilities.HTTP.doPost(set.uri, set.poststring, function () {
			next();
		});
	}
	
	var processCallback = function (set, next) {
		var id = set.id;
		var uri = host+"tools/CitEx";
		var poststring = "mode=2&format=3&type=2&file=3&exportCitation.x=16&exportCitation.y=10&exportCitation=submit";
		Zotero.Utilities.HTTP.doPost(uri, poststring, function(text) {
			var m = text.match(/%A\s(.*)/);  //following lines fix Wiley's incorrect %A tag (should be separate tags for each author)
			if (m){
				var newauthors ="";
				var authors = m[1].split(",")
				for each (var author in authors){
					if (author != ""){
						newauthors = newauthors + "%A "+Zotero.Utilities.unescapeHTML(Zotero.Utilities.trimInternal(author))+"\n";
					}
				}
				text = text.replace(/%A\s.*\n/, newauthors);
			}
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("881f60f2-0802-411a-9228-ce5f47b64c7d"); //EndNote/Refer/BibIX
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				var pdfurl = host + "cgi-bin/fulltext?ID=" + id + "&PLACEBO=IE.pdf&mode=pdf";
				item.attachments.push({url:pdfurl, title:"Wiley Interscience PDF", mimeType:"application/pdf"});
				item.DOI = item.url.match(/\.org\/(.*)$/)[1];
				item.complete();
			});
			translator.translate();
			
			next();
		}, null, 'iso-8859-1');
	}
	
	var callbacks = [setupCallback, processCallback];
	Zotero.Utilities.processAsync(sets, callbacks, function () { Zotero.done(); });
	Zotero.wait();
}