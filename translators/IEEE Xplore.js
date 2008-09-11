{
	"translatorID":"92d4ed84-8d0-4d3c-941f-d4b9124cfbb",
	"translatorType":4,
	"label":"IEEE Xplore",
	"creator":"Simon Kornblith and Michael Berkowitz",
	"target":"https?://[^/]*ieeexplore.ieee.org[^/]*/(?:[^\\?]+\\?(?:|.*&)arnumber=[0-9]+|search/(?:searchresult.jsp|selected.jsp))",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-08 20:30:00"
}

function detectWeb(doc, url) {
	var articleRe = /[?&]ar(N|n)umber=([0-9]+)/;
	var m = articleRe.exec(url);
	
	if(m) {
		return "journalArticle";
	} else {
		return "multiple";
	}
	
	return false;
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var articleRe = /[?&]ar(N|n)umber=([0-9]+)/;
	var m = articleRe.exec(url);
	
	if(detectWeb(doc, url) == "multiple") {
		// search page
		var items = new Array();
		
		var tableRows = doc.evaluate('//table[tbody/tr/td/div/strong]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		while(tableRow = tableRows.iterateNext()) {
			var link = doc.evaluate('.//a[@class="bodyCopy"]', tableRow, nsResolver, XPathResult.ANY_TYPE,
				null).iterateNext().href;
			
			var title = "";
			var strongs = tableRow.getElementsByTagName("strong");
			for each(var strong in strongs) {
				if(strong.textContent) {
					title += strong.textContent+" ";
				}
			}
			
			items[link] = Zotero.Utilities.cleanString(title);
		}
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var urls = new Array();
		for(var url in items) {
			urls.push(url);
		}
	} else {
		var urls = [url];
	}
	var arnumber = "";
	for each(var url in urls) {
		var m = articleRe.exec(url);
		arnumber = "%3Carnumber%3E"+m[2]+"%3C%2Farnumber%3E";
		var post = "dlSelect=cite_abs&fileFormate=ris&arnumber="+arnumber+"&x=5&y=10";
		var isRe = /[?&]isnumber=([0-9]+)/;
		var puRe = /[?&]punumber=([0-9]+)/;
		Zotero.Utilities.HTTP.doPost("http://ieeexplore.ieee.org/xpls/citationAct", post, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				var url = urls.shift();
				var is = isRe.exec(url);
				var pu = puRe.exec(url);
				var arnumber = articleRe.exec(url);
				if(item.notes[0] && item.notes[0].note) {
					item.abstractNote = item.notes[0].note;
					item.notes = new Array();
				}
				var dupes = new Array();
				for (var i = 0 ; i < item.creators.length - 1 ; i++) {
					if (item.creators[i].lastName + item.creators[i].firstName == item.creators[i+1].lastName + item.creators[i].firstName) {
						dupes.push(i + 1);
					}
				}
				
				for (var i in dupes) {
					delete item.creators[dupes[i]];
				}
				var dupes = [];
				for (var i = 0 ; i < item.creators.length ; i++) {
					if (item.creators[i]) {
						dupes.push(item.creators[i]);
					}
				}
				item.creators = dupes;
				var newurls = [url];
				Zotero.Utilities.processDocuments(newurls, function(newDoc) {
					var xpath = '//p[@class="bodyCopyBlackLargeSpaced"]';
					var textElmt = newDoc.evaluate(xpath, newDoc, namespace, XPathResult.ANY_TYPE, null).iterateNext();
					if (textElmt) {
						var m = textElmt.textContent.match(/Identifier:\s+([^\n]*)\n/);
						if (m){
							item.DOI = m[1];
						}
					}
					var pdfpath = '//td[2][@class="bodyCopyBlackLarge"]/a[@class="bodyCopy"][substring(text(), 1, 3) = "PDF"]';
					var pdfurlElmt = newDoc.evaluate(pdfpath, newDoc, namespace, XPathResult.ANY_TYPE, null).iterateNext();
					if (pdfurlElmt) {
						item.attachments = [{url:pdfurlElmt.href, title:"IEEE Xplore Full Text PDF", mimeType:"application/pdf"}];
					}
					item.complete();
				}, function() {Zotero.done;});
			});
			translator.translate();
		});
	}
	Zotero.wait();
}