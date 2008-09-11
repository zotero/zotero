{
	"translatorID":"ea531652-cdeb-4ec2-940e-627d4b107263",
	"translatorType":4,
	"label":"AlterNet",
	"creator":"Jesse Johnson",
	"target":"^http://(?:www\\.)alternet.org",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-10 06:15:00"
}

function detectWeb(doc, url) {
	// identifies articles according to the presence of an article ID
	// number in the URL
	var index = url.toString().indexOf('.org/') + 5;
	index += url.toString().substr(index).indexOf('/');
	if (index != -1) {
		// ordinary aritcle
		var id = url.toString().substr(index + 1, 5);
		Zotero.Utilities.cleanString(id);
		if (Number(id)) {
			return "magazineArticle";
		}
		//columnist or blog article
		index += url.toString().substr(index + 1).indexOf('/');
		id = url.toString().substr(index + 2, 5);
		Zotero.Utilities.cleanString(id);
		if  (Number(id) && url.toString().search('blog') == -1) {
			return "magazineArticle";
		}
		else if (Number(id)) {
			return "blogPost";
		}
	}
	
	return null;
}

function scrape(doc, url, title) {    
	     var index = url.toString().indexOf('.org/') + 5;
	     index += url.toString().substr(index).indexOf('/');
	     if (index != -1) {
		     // ordinary aritcle
		     var id = url.toString().substr(index + 1, 5);
		     Zotero.Utilities.cleanString(id);
		     if (Number(id)) { 
			     var newItem = new Zotero.Item("magazineArticle");
		     }
		     //columnist or blog article
		     index += url.toString().substr(index + 1).indexOf('/');
		     id = url.toString().substr(index + 2, 5);
		     Zotero.Utilities.cleanString(id);
		     if  (Number(id) && url.toString().search('blog') == -1) {
			     var newItem = new Zotero.Item("magazineArticle");
		     }
		     else if (Number(id)) {
			     var newItem = new Zotero.Item("blogPost");
		     }
	     }
	     	
 	     newItem.url = url;
	     newItem.title = title;
	     
	     if (newItem.itemType == "magazineArticle") {
		     newItem.publicationTitle = "AlterNet";
		     newItem.repository = "alternet.org";
	     }
	     else if (newItem.itemType == "blogPost") {
		     newItem.websiteType = "AlterNet Blog";
	     }
	     
	     
	     // general scraping variables
	     var xpath;

	     
	     // author
	     if (newItem.itemType == "magazineArticle") {
		     xpath = '//p[@class="storybyline"]//a[contains(@href,"author")]';
	     }
	     else if (newItem.itemType == "blogPost") {
		     xpath = '//p[@class="storybyline"]//a[contains(@href,"bloggers")]';
	     }
	     temp = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	     if (temp) { 
		     var author = Zotero.Utilities.trimInternal(temp.textContent);
		     if(author.substr(0, 3).toLowerCase() == "by ") {
			     author = author.substr(3);
		     }
		     
		     var authors = author.split(",");
		     for each (var author in authors) {
			     newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		     } 
	     }
	     
	     // date
	     if (newItem.itemType == "magazineArticle") {
		     xpath = '//p[@class="storybyline"]//a[contains(@href,"date")]';
		     temp = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext();
		     var date = Zotero.Utilities.strToDate(temp.textContent);     
	     }
	     else if (newItem.itemType == "blogPost") {
		     xpath = '//p[@class="storybyline"]/b';
		     temp = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext();
		     var begin = temp.textContent.lastIndexOf(" on ");
		     temp = temp.textContent.substr(begin + 4);
		     var date = Zotero.Utilities.strToDate(temp.substr(0, temp.length - 1));
	     }
	     if (date != null) {
		     var strdate;
		     
		     date.month = date.month + 1;
		     
		     strdate = date.year + '-'; 
		     if (date.month < 10) {
			     strdate += '0' + date.month;
		     }
		     else {
			     strdate += date.month;
		     }
		     if (date.day > 10) {
			     strdate += '-' + date.day;
		     }
		     else { 
			     strdate += '-0' + date.day;
		     }
		   
		     newItem.date = strdate;
	     }
	     
	     // abstract
	     xpath = '//div[@class="teaser"]//div[contains(@class,"teaser")]';
	     temp = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	     if (temp) {
		     newItem.abstractNote = Zotero.Utilities.trimInternal(temp.textContent);
	     }   

	     // article snapshot
	     // grabs 5-digit article code from url and uses it to derive printable page url for use in article snapshot
	     var index = url.toString().indexOf('.org/') + 5;
	     index += url.toString().substr(index).indexOf('/');
	     if (index != -1) {
		     var printurl;
		     // ordinary article
		     var id = url.toString().substr(index + 1, 5);
		     if (Number(id)) {
			     printurl = "http://www.alternet.org/module/printversion/" + id;
	     	             newItem.attachments.push({url:printurl, title:"AlterNet Article Snapshot", mimeType:"text/html"});
		     }
		     // columnist article
		     else {
		     	     index += url.toString().substr(index + 1).indexOf('/');
		     	     id = url.toString().substr(index + 2, 5);
		     	     Zotero.Utilities.cleanString(id);
		     	     if  (Number(id)) {
				     printurl = "http://www.alternet.org/module/printversion/" + id;
				     if (newItem.itemType == "blogPost") {
					     printurl += "/?type=blog";
				     }
	     	             	     newItem.attachments.push({url:printurl, title:"AlterNet Article Snapshot", mimeType:"text/html"});
	     	             }
		     }		     		     
	     }
	     
	     newItem.complete();
}



function doWeb(doc, url) {      
      // ordinary and columnist articles
      var xpath = '//p[@class="storyheadline"]';
      var title;
      if (title = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {  
	      scrape(doc, url, title.textContent);
      }

      return null;
}