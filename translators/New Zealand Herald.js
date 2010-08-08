{
	"translatorID" : "c7830593-807e-48cb-99f2-c3bed2b148c2",
	"label" : "New Zealand Herald",
	"creator" : "Sopheak Hean (University of Waikato, Faculty of Education, New Zealand)",
	"target" : "^http://www\\.nzherald\\.co\\.nz",
	"minVersion" : "1.0",
	"maxVersion" : "",
	"priority" : 100,
	"inRepository" : "1",
	"translatorType":4,
	"lastUpdated":"2010-08-03 10:49:18"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == "x" ) return namespace; else return null;
	} : null;

/* If the address bar has /news in it then its a newspaper article*/

	if (doc.location.href.indexOf("/search/results.cfm") !=-1){
		return "multiple";
	} else if (doc.location.href.indexOf("/news/article.cfm") !=-1){
		return "newspaperArticle";
	}
}

function associateData (newItem, items, field, zoteroField) {
	if (items[field]){
		newItem[zoteroField] = items[field];
	}
}

function scrape(doc, url){
	var authorTemp;
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var articleLanguage = "English";

	var newItem = new Zotero.Item('newspaperArticle');
	newItem.url = doc.location.href;

	newItem.publicationTitle = "New Zealand Herald";
	newItem.ISSN = "1170-0777";

	//Get title of the news via xpath
	var myXPath = '//h1';
	var myXPathObject = doc.evaluate(myXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	var headers;
	var items = new Object();
	var authorsTemp;
	var blankCell;
	var contents;
	var authorArray = new Array();

	/*
	 Get authors of the article
	 Remove "By " then replace "and " with ", "

	 Put the string into an array then split the array and loop all
     authors then push author to Zotero.  Possible with more than 1 author
     on an article.
	*/
	var authorXPath = '//span[@class="credits"]';
	var authorXPathObject = doc.evaluate(authorXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();

	if (authorXPathObject) {
		var authorString = authorXPathObject.textContent.replace(/\bBy\W+/g, '');
		if (authorString.match(/\W\band\W+/g)){
			authorTemp = authorString.replace(/\W\band\W+/g, ', ');
			authorArray = authorTemp.split(", ");
		} else if (!authorString.match(/\W\band\W+/g)){
			authorArray = authorString;
		}
		if( authorArray instanceof Array ) {
			for (var i in authorArray){
				var author;
				author = authorArray[i];
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
			}
		} else {
			if (authorString.match(/\W\bof\W+/g)){
				authorTemp = authorString.replace (/\W\bof\W(.*)/g, '');
				authorArray = authorTemp;
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authorTemp, "author"));

			}  else {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authorArray, "author"));
			}
		}
	}
	//date-Year
	var dateXPath = '//div[@class="tools"]/span';
	var dateXPathObject = doc.evaluate(dateXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/\d{1,2}:\d{1,2} (AM|PM) (\w)+ /g, '');

	//If the original Xpath1 is equal to Updated then go to XPath2
	if ((dateXPathObject =="Updated")|| (dateXPathObject =="New")){
		var dateXPath = '//div[@class="tools"]/span[2]';
		var dateXPathObject = doc.evaluate(dateXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/\d{1,2}:\d{1,2} (AM|PM) (\w)+ /g, '');
		newItem.date = dateXPathObject ;
	} else { //great found the date just push it to Zotero.
		var dateXPath = '//div[@class="tools"]/span';
		var dateXPathObject = doc.evaluate(dateXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/\d{1,2}:\d{1,2} (AM|PM) (\w)+ /g, '');
		newItem.date = dateXPathObject ;
	}

	//Get Section of the news
	var sectionXPath = '//div[@class="sectionHeader"]/span/a[1]';
	var sectionXPathObject = doc.evaluate(sectionXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	newItem.section = sectionXPathObject;

	//Get news title
	headers =myXPathObject;
	newItem.title = headers;

	newItem.language= articleLanguage;

	//grab abstract from meta data
	var a= "//meta[@name='description']";
	newItem.abstractNote = doc.evaluate(a, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
	newItem.complete();
}

function doWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix){
		if (prefix =='x')
		return namespace; else return null;
	} :null;

	var articles = new Array();
	var items = new Object();
	var nextTitle;

	if (detectWeb(doc, url) == "multiple"){
		var titles = doc.evaluate('//p[@class="results"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		while (nextTitle = titles.iterateNext()){
			items[nextTitle.href] = nextTitle.textContent;
		}
		items= Zotero.selectItems(items);
		for (var i in items){
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	
	Zotero.Utilities.processDocuments(articles, scrape, function(){Zotero.done();});
	Zotero.wait();
}
