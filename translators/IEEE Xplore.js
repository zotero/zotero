{
	"translatorID":"92d4ed84-8d0-4d3c-941f-d4b9124cfbb",
	"translatorType":4,
	"label":"IEEE Xplore",
	"creator":"Simon Kornblith, Michael Berkowitz and Bastian Koenings)",
	"target":"https?://[^/]*ieeexplore.ieee.org[^/]*/(?:[^\\?]+\\?(?:|.*&)arnumber=[0-9]+|search/(?:searchresult.jsp|selected.jsp))",
	"minVersion":"1.0.1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2011-01-11 04:31:00"
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
		
		var xPathRows = '//form[@id="search_results_form"]/ul[@class="Results"]/li[@class="noAbstract"]/div[@class="header"]';
		var tableRows = doc.evaluate(xPathRows, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		while(tableRow = tableRows.iterateNext()) {
			var link = doc.evaluate('.//div[@class="detail"]/h3/a', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;			
			
			var title = "";
			var strongs = tableRow.getElementsByTagName("h3");
			for each(var strong in strongs) {
				if(strong.textContent) {
					title += strong.textContent+" ";
				}
			}
			
			items[link] = Zotero.Utilities.trimInternal(title);
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
	
	for each(var url in urls) {
		var m = articleRe.exec(url);
		var post = "recordIds="+m[2]+"&fromPageName=searchabstract&citations-format=citation-abstract&download-format=download-ris&x=62&y=13";
		Zotero.Utilities.HTTP.doPost("http://ieeexplore.ieee.org/xpl/downloadCitations", post, function(text) {
			//handle DOI
			var doiregex = /DOI\s+-\s(.+)/;
			var doi = doiregex.exec(text);
        		
        		//replace journal abbreviation
    			var jaregex = /JA\s+-\s(.+)/;
			var ja = jaregex.exec(text);
            		
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				// abstracts are notes in Xplore's RIS
				if(item.notes[0] && item.notes[0].note) {
					item.abstractNote = item.notes[0].note;
					item.notes = new Array();
				}
				if(doi) { item.DOI = doi[1]; }
				if(ja) { item.journalAbbreviation = ja[1]; }
				
				pdfurl = "http://ieeexplore.ieee.org/stampPDF/getPDF.jsp?tp=&arnumber="+m[2];
				item.attachments.push({url:pdfurl, title:"IEEE Xplore PDF", mimeType:"application/pdf"}); 
				item.complete();
			});
			translator.translate();
		});
	}
	Zotero.wait();
}
