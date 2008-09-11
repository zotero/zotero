{
	"translatorID":"aee2323e-ce00-4fcc-a949-06eb1becc98f",
	"translatorType":4,
	"label":"Epicurious",
	"creator":"Sean Takats",
	"target":"^https?://www\\.epicurious\\.com/(?:tools/searchresults|recipes/food/views)",
	"minVersion":"1.0.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-09-02 13:40:00"
}

function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;
		
	var xpath = '//div[@id="ingredients"]';
	var multxpath = '//table[@class="search-results"]/tbody/tr';

	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "document";
	} else if (doc.evaluate(multxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";
	}
	
}

function cleanText(s){
	s = s.replace(/\n+/g, "\n");
	s = s.replace(/(\n|\r)\t+/g, "\n");  
	s = s.replace(/\t+/g, " ");
	s = s.replace("        ", "", "g");
	return s;
}

function scrape(doc){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;

	var newItem = new Zotero.Item("document");

	var xpath = '//title';
	var title = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	title = Zotero.Utilities.trimInternal(title);
	title = title.substring(0, title.indexOf(" Recipe at Epicurious.com"));
	newItem.title = title;

	var elmt;

	xpath = '//p[@class="source"]';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if (elmt = elmts.iterateNext()){
		var authordate = elmt.textContent;
		var authordates = authordate.split("|");
		newItem.creators.push(Zotero.Utilities.cleanAuthor(authordates[0], "contributor", true));
		var datestring = authordates[1].toString();
		datestring = datestring.replace("Copyright", "");
		newItem.date = Zotero.Utilities.formatDate(Zotero.Utilities.strToDate(datestring));
		while (elmt = elmts.iterateNext()){
		 	Zotero.debug("looping?");
		 	Zotero.debug(elmt.textContent);
			newItem.creators.push(Zotero.Utilities.cleanAuthor(elmt.textContent, "contributor", false));
		}
	}
		
	xpath = '//div[@id="recipe_intro"]/p';
	if (elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var abstract = elmt.textContent;
		abstract = Zotero.Utilities.cleanString(abstract);
		newItem.abstractNote = abstract;		
	}

	xpath = '//div[@id="ingredients"]';
	if (elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var ingredients = elmt.textContent;
		ingredients = Zotero.Utilities.superCleanString(ingredients);
		ingredients = cleanText(ingredients);
	}
	xpath = '//div[@id="preparation"]';
	if (elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var prep = elmt.textContent;
		prep = Zotero.Utilities.superCleanString(prep);
		prep = cleanText(prep);
		prep = prep.replace(/\n/g, "\n\n");
	}
	xpath = '//div[@id="recipe_summary"]/p';
	if (elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var serving = elmt.textContent;
		serving = Zotero.Utilities.superCleanString(serving);
		serving = cleanText(serving);
	}
//	notestring = ingredients + "\n\n" + prep + "\n\n" + serving;
//	newItem.notes.push({note:notestring});
	newItem.notes.push({note:ingredients});
	newItem.notes.push({note:prep});
	newItem.notes.push({note:serving});

	var url = doc.location.href;
	
	var snapshotURL = url.replace("/views/", "/printerfriendly/");
	newItem.attachments.push({title:"Epicurious.com Snapshot", mimeType:"text/html", url:snapshotURL, snapshot:true});
	newItem.url = url;
	newItem.attachments.push({title:"Epicurious.com Link", snapshot:false, mimeType:"text/html", url:url});

	newItem.complete();
}

function doWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;

	var singxpath = '//div[@id="ingredients"]';
	var multxpath = '//table[@class="search-results"]/tbody/tr';
	if(doc.evaluate(singxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		// single recipe page
		scrape(doc, url);
	} else if (doc.evaluate(multxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var items = new Object();
		var elmtxpath = '//div[@id="resultstable"]/table[@class="search-results"]/tbody/tr/td[3][@class="name"]/a[@class="hed"]';
		var elmts = doc.evaluate(elmtxpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		while (elmt = elmts.iterateNext()) {
			var title = elmt.textContent;
			var link = elmt.href;
			if (title && link){
				items[link] = title;
			}
		}
		
		var items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();	
	}
}