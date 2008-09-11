{
	"translatorID":"d1605270-d7dc-459f-9875-74ad8dde1f7d",
	"translatorType":4,
	"label":"Le Devoir",
	"creator":"Adam Crymble",
	"target":"http://www.ledevoir.com",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-21 15:45:00"
}

function detectWeb(doc, url) {
	if (doc.location.href.match("Recherche")) {
		return "multiple";
	} else if (doc.evaluate('//div[@id="autresArticles"]/p', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "newspaperArticle";
	}
}

//Le Devoir Translator. Code by Adam Crymble

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	

	var tagsContent = new Array();
	
	var newItem = new Zotero.Item("newspaperArticle");
	
	var contents = doc.evaluate('//div[@id="autresArticles"]/p', doc, nsResolver, XPathResult.ANY_TYPE, null);

	var j = 0;
	var n = 0;
	var contentsArray = new Array();
	var contents1;
	
	while (contents1 = contents.iterateNext()) {
		contentsArray.push(contents1.textContent);
		j++;
	}     	
     	
     	var author;
     	var author1;
     	var author2;
     	
     	if (j > 1) {
	     	for (var i in contentsArray) {
		     	if (contentsArray[i].match("Édition du ")) {
			     	var date1 = contentsArray[i].split("Édition du ");
			     	
			     	newItem.date = date1[1];
			     	
			     	if (date1[0].match(/\w/)) {
				
				     	author = date1[0];
				     	if (author.match(/\n/)) {
					     	author1 = author.split(/\n/);
					     	
					     	 for (var k = 0; k < author1.length; k++) {
						     	 if (author1[k].match(/\w/) && author1[k].match(", ")) {
							     	author2 = author1[k].split(", ");
								 if (author2[0].match(/\w/)) {
									 newItem.creators.push(Zotero.Utilities.cleanAuthor(author2[0], "author"));	
								 } else {
									  newItem.creators.push(Zotero.Utilities.cleanAuthor(author2[1], "author"));	
								 }
						     	 } else if (author1[k].match(/\w/) && !author1[k].match(", ")) {
							     	 newItem.creators.push(Zotero.Utilities.cleanAuthor(author1[k], "author"));	
						     	 }
					     	 }
				     	} else if (author.match(" et ")) {
					     	author1 = author.split(" et ");
					     	for (var k in author1) {
						     	newItem.creators.push(Zotero.Utilities.cleanAuthor(author1[k], "author"));	
					     	}
				     	} else if (author.match(", ")) {
					     	author1 = author.split(", ");
					     	for (var k in author1) {
						     	newItem.creators.push(Zotero.Utilities.cleanAuthor(author1[k], "author"));	
					     	}
				     	} else {
					     	newItem.creators.push(Zotero.Utilities.cleanAuthor(date1[0], "author"));	
				     	}
			     	}
		     	} else if (contentsArray[i].match("Mots clés")) {
			     	contentsArray[i] = contentsArray[i].substr(11);
			     	if (contentsArray[i].match(", ")) {
				     	tagsContent = contentsArray[i].split(", ");
			     	} else {
				     	newItem.tags = ontentsArray[i];
				     	n = 1;
			     	}
		     	}
	     	}
     	}
     	
     	if (n == 0 && tagsContent.length>1) {
	     	for (var i = 0; i < tagsContent.length; i++) {
	     		newItem.tags[i] = tagsContent[i];
     		}
     	}

	newItem.title = doc.title;	
	newItem.url = doc.location.href;
	newItem.publicationTitle = "Le Devoir";
	newItem.ISSN = "0319-0722";

	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var articles = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
	
		var titles = doc.evaluate('//td[2]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = next_title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	Zotero.wait();
}