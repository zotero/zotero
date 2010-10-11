{
        "translatorID":"6ec8008d-b206-4a4c-8d0a-8ef33807703b",
        "label":"The Economist",
        "creator":"Michael Berkowitz",
        "target":"^http://(www\\.)?economist\\.com/",
        "minVersion":"1.0.0b4.r5",
        "maxVersion":"",
        "priority":100,
        "inRepository":true,
        "translatorType":4,
        "lastUpdated":"2010-10-03 13:27:34"
}

function detectWeb(doc, url) {
       if (doc.location.href.indexOf("search") != -1) {
		/* Multiple article download disabled-- broken.
		TODO Fix multiple article download. */
               //return "multiple";
       } else if (doc.location.href.toLowerCase().indexOf("node") != -1) {
               return "magazineArticle";
       }
}

function scrape(doc, url) {
       var namespace = doc.documentElement.namespaceURI;
       var nsResolver = namespace ? function(prefix) {
               if (prefix == "x" ) return namespace; else return null;
       } : null;

       newItem = new Zotero.Item("magazineArticle");
       newItem.ISSN = "0013-0613";
       newItem.url = doc.location.href;
       newItem.publicationTitle = "The Economist";


       //get headline
       var title = new Array();
       if (doc.title && doc.title != "" && doc.title != "Economist.com") {
               title = doc.title.split(" | ");
       } else {
		title.push(doc.evaluate('//div[@class="clear"][@id="pay-barrier"]/div[@class="col-left"]/div[@class="article"]/font/b', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
       }


       if (title.length == 1) {
               title.push = title;
       } else {
               title = title.slice(0, title.length - 1);
               title = title.join(": ");
       }
       newItem.title = title;

       if (doc.evaluate('//div[@class="clear"][@id="pay-barrier"]/div[@class="col-right"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ) {
               newItem.extra =  "(Subscription only)";
       }

	if (newItem.extra == "(Subscription only)"){ newItem.complete(); return;}
       //get abstract
       if (doc.evaluate('//div[@id="content"]/div[@class="clear top-border"]/div[@class="col-left"]/h2', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ) {
               newItem.abstractNote = doc.evaluate('//div[@id="content"]/div[@class="clear top-border"]/div[@class="col-left"]/h2', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
       } else if (doc.evaluate('//div[@class="clear"][@id="pay-barrier"]/div[@class="col-left"]/div[@class="article"]/p/strong', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ) {
               newItem.abstractNote = doc.evaluate('//div[@class="clear"][@id="pay-barrier"]/div[@class="col-left"]/div[@class="article"]/p/strong', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
       } else if (doc.evaluate('//div[@id="content"]/div[@class="clear top-border"]/div[@class="col-left"]/p[3]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
       		newItem.abstractNote = doc.evaluate('//div[@id="content"]/div[@class="clear top-border"]/div[@class="col-left"]/p[3]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
       }
       if (newItem.abstractNote) newItem.abstractNote = Zotero.Utilities.trimInternal(newItem.abstractNote);
       //get date and extra stuff
   if (doc.evaluate('//p[@class="ec-article-info"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ) {
               newItem.date = Zotero.Utilities.trim(doc.evaluate('//p[@class="ec-article-info"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.split("|")[0]);
       }
	
	var url = doc.location.href;
       newItem.attachments = [
       		{url:url.replace("displaystory", "PrinterFriendly"), title:"The Economist Snapshot", mimeType:"text/html"}
       	];
       	
       newItem.complete();
}


function doWeb(doc, url) {
       var namespace = doc.documentElement.namespaceURI;
       var nsResolver = namespace ? function(prefix) {
               if (prefix == "x" ) return namespace; else return null;
       } : null;

       var urls = new Array();

       if (doc.title == "Search | Economist.com") {
               var items = new Array();
               var uris = new Array();
               var results = doc.evaluate('//ol[@class="search-results"]/li/h2/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
               var headline = results.iterateNext();
               while (headline) {
                       items.push(headline.textContent);
                       uris.push(headline.href);
                       Zotero.debug(headline.href);
                       headline = results.iterateNext();
               }

               var newItems = new Object();
               for (var i = 0 ; i <items.length ; i++) {
                       newItems[uris[i]] = items[i];
               }

               newItems = Zotero.selectItems(newItems);
               if (!newItems) {
                       return true;
               }

               for (var i in newItems) {
                       urls.push(i);
               }
       } else if (doc.location.href.toLowerCase().indexOf("node") != -1) {
               scrape(doc, url);
               return;
       }
       
       Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
       
       Zotero.wait();
}
