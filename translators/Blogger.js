{
        "translatorID": "6f9aa90d-6631-4459-81ef-a0758d2e3921",
        "label": "Blogger",
        "creator": "Adam Crymble",
        "target": "blogspot\\.com",
        "minVersion": "1.0.0b4.r5",
        "maxVersion": "",
        "priority": 100,
        "inRepository": true,
        "translatorType": 4,
        "lastUpdated": "2011-05-27 20:13:50"
}

function detectWeb(doc, url) {
	var result = doc.evaluate('//h3[contains(@class,"post-title") and contains(@class,"entry-title")]', doc, null, XPathResult.ANY_TYPE, null);
	var entry = result.iterateNext();
	if (entry && result.iterateNext()) {
		return "multiple";
	} else if (entry) {
		return "blogPost";
	} else {
		return false;
	}
}

//Blogger translator. Code by Adam Crymble

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var tagsContent = new Array();
	
	var newItem = new Zotero.Item("blogPost");
	
	//title
		if (doc.evaluate('//h3[@class="post-title entry-title"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		
			newItem.title = doc.evaluate('//h3[@class="post-title entry-title"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		} else {
			newItem.title = doc.title;
		}
	
	//author, if available
		if (doc.evaluate('//span[@class="post-author vcard"]', doc,  nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var author = doc.evaluate('//span[@class="post-author vcard"]', doc,  nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/^\s*|\s*$/g, '');
			var author = author.toLowerCase();
			
			if (author.match(/\sby\s/)) {
				var shortenAuthor = author.indexOf(" by");
				author = author.substr(shortenAuthor + 3).replace(/^\s*|\s$/g, '');
			}
			var words = author.split(/\s/);
				for (var i in words) {
					words[i] = words[i][0].toUpperCase() + words[i].substr(1).toLowerCase();
				}
			author = words.join(" ");
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
	
	//date, if available
		if (doc.evaluate('//h2[@class="date-header"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			newItem.date = doc.evaluate('//h2[@class="date-header"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			
		}
		
	//tags, if available
		if (doc.evaluate('//span[@class="post-labels"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var tags = doc.evaluate('//span[@class="post-labels"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
			
			var tags1;
			while (tags1 = tags.iterateNext()) {
				tagsContent.push(tags1.textContent);
			}
			
			for (var i = 0; i < tagsContent.length; i++) {
				newItem.tags[i] = tagsContent[i];
			}
		}
		
	var blogTitle1 = doc.title.split(":");
	newItem.blogTitle = blogTitle1[0];

	newItem.url = doc.location.href;

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
				
		var titles = doc.evaluate('//h3[@class="post-title entry-title"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var titles1 = doc.evaluate('//li[@class="archivedate expanded"]/ul[@class="posts"]/li/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
				
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = next_title.textContent;
		}
		
		while (next_title = titles1.iterateNext()) {
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