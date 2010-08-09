{
	"translatorID" : "649c2836-a94d-4bbe-8e28-6771f283702f",
	"label" : "TVNZ",
	"creator" : "Sopheak Hean",
	"target" : "^http://tvnz\\.co\\.nz",
	"minVersion" : "1.0",
	"maxVersion" : "",
	"priority" : 100,
	"inRepository" : true,
	"translatorType" : 4,
	"lastUpdated":"2010-08-03 10:30:20"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == "x" ) return namespace; else return null;
	} : null;
	
	if (doc.location.href.indexOf("/search/") !=-1){
		return "multiple";
	} 
	else if ((doc.location.href.indexOf("politics-news/") !=-1) && (doc.location.href.indexOf("-video") !=-1) 
	|| (doc.location.href.indexOf("politics-news/") !=-1) && (doc.location.href.indexOf("/video") !=-1)
	|| (doc.location.href.indexOf("business-news/") !=-1) && (doc.location.href.indexOf("-video") !=-1)
	|| (doc.location.href.indexOf("national-news/") !=-1) && (doc.location.href.indexOf("-video") !=-1)
	|| (doc.location.href.indexOf("breakfast-news/") !=-1) && (doc.location.href.indexOf("-video") !=-1)
	|| (doc.location.href.indexOf("breakfast-news/") !=-1) && (doc.location.href.indexOf("/video") !=-1)
	|| (doc.location.href.indexOf("world-news/") !=-1) && (doc.location.href.indexOf("-video") !=-1)
	|| (doc.location.href.indexOf("all-blacks/") !=-1) && (doc.location.href.indexOf("-video") !=-1)
	|| (doc.location.href.indexOf("weather/") !=-1) && (doc.location.href.indexOf("-video") !=-1)
	|| (doc.location.href.indexOf("-news/") !=-1) && (doc.location.href.indexOf("-video") !=-1)
	|| (doc.location.href.indexOf("-news/") !=-1) && (doc.location.href.indexOf("/video") !=-1)
	|| (doc.location.href.indexOf("on/") !=-1) && (doc.location.href.indexOf("-video") !=-1)
	|| (doc.location.href.indexOf("up/") !=-1) &&  (doc.location.href.indexOf("/video") !=-1)){
		return "tvBroadcast";
	} 
	else if ((doc.location.href.indexOf("news/") !=-1) || (doc.location.href.indexOf("all-blacks/") !=-1) || (doc.location.href.indexOf("up/")!=-1)){
		return "newspaperArticle";
	} 
}

function scrape(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == "x" ) return namespace; else return null;
	} : null;
		if (detectWeb(doc, url) == "newspaperArticle") {
			var newItem = new Zotero.Item('newspaperArticle');
			newItem.url = doc.location.href;
			newItem.publicationTitle = "TVNZ";
			newItem.language = "English";
			
			var titleXPath = '//h1';
			var titleXPathObject = doc.evaluate(titleXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if (titleXPathObject){
				var titleXPathString = titleXPathObject.textContent;
				newItem.title = titleXPathString ;
			}
			
			var dateXPath = '//p[@class="time"]';
			var dateXPathObject = doc.evaluate(dateXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(dateXPathObject){
				var dateXPathString = dateXPathObject.textContent.replace(/\W\bPublished:\W\d{1,2}:\d{1,2}(AM|PM) (\w)+ /g, '');
				newItem.date = dateXPathString.replace(/^\s*|\s*$/g, '');
			}
			//get Author from the article
			var authorXPath = '//p[@class="source"]';
			var authorXPathObject = doc.evaluate(authorXPath,  doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if (authorXPathObject){
				var authorXPathString = authorXPathObject.textContent.replace(/\W\bSource:\W+/g, '');
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authorXPathString.replace(/\W+/g, '-'), "author"));
			}
			
			//get Section of the article
			var sectionXPath = '//li[@class="selectedLi"]/a/span';
			var sectionXPathObject = doc.evaluate(sectionXPath,  doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if (sectionXPathObject){
				
				var sectionXPathString = sectionXPathObject.textContent.replace(/^s/g, '');
				var sectionArray = new Array("Rugby", "All Blacks", "Cricket", "League",  "Football", "Netball", "Basketball", "Tennis", "Motor", "Golf", "Other", "Tipping");
				
				//loop through the Array and check for condition for section category
				//var count =0;
				for (var i=0; i <sectionArray.length; i++){
					//count = 1;
					//if there is a match in the loop then replacing the section found with SPORT
					if(sectionXPathString == sectionArray[i]){
						sectionXPathString = "Sport";
						newItem.section = sectionXPathString;
					} 
					//if not found then take the value from XPath
					newItem.section = sectionXPathString;
					//count++;
					
				}
			}
			
			//get Abstract
			var a= "//meta[@name='description']";
			var abs= doc.evaluate(a, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if (abs){				
				var abstractString = abs.content;
				newItem.abstractNote = abstractString;
			}
			
			//closed up NewItem
			newItem.complete();
	
	} else if (detectWeb(doc, url) == "tvBroadcast"){
		var newItem = new Zotero.Item("tvBroadcast");
		newItem.url = doc.location.href;
		
		newItem.network = "TVNZ";
		newItem.language = "English";
	
			/* get Title and Running time for video clip */
			//if meta title exist

			
		//if the array is true then do this
		
			var dateXPath = '//p[@class="added"]';
			var dateXPathObject = doc.evaluate(dateXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			
			if (dateXPathObject){
				var dateString = dateXPathObject.textContent.replace(/\W\bAdded:\W\d{1,2}:\d{1,2}(AM|PM) (\w)+ /g, '');
				newItem.date = dateString.replace(/^\s*|\s*$/g, '');
			} else {
				var dateXPath = '//p[@class="time"]';
				var dateXPathObject = doc.evaluate(dateXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/\W\bPublished:\W\d{1,2}:\d{1,2}(AM|PM) (\w)+ /g, '');
				newItem.date = dateXPathObject.replace(/^\s*|\s*$/g, '');
				
			}

			var myTitlePath ='//meta[@name="title"]';
			var myTitlePathObject= doc.evaluate(myTitlePath,  doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if (myTitlePathObject){
				var titleString= myTitlePathObject.content.replace(/\b[)]+/g, '');
				var TitleResult= titleString.split(" (");
				newItem.title = TitleResult[0];
				var runTime = TitleResult[1];
				if(TitleResult[1] == undefined) {
					newItem.runningTime ="";	
				} else {
					newItem.runningTime = runTime;
				}
			}else{
				var myPath = '//head/title';
				var myPathObject = doc.evaluate(myPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(" | ");
				newItem.title= myPathObject[0];	
			}
			
			//get Author from the article
			var authorXPath = '//p[@class="source"]';
			var authorXPathObject = doc.evaluate(authorXPath,  doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if (authorXPathObject){
				var authorString = authorXPathObject.textContent.replace(/\W\bSource:\W+/g, '');
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authorString.replace(/\W+/g, '-'), "author"));
			
			} else {
				var keywordsPath = '//meta[@name="keywords"]';
				var keywordsObject = doc.evaluate(keywordsPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content.replace(/\s+/g, '-').split(",");
				newItem.creators.push(Zotero.Utilities.cleanAuthor(keywordsObject[0], "author"));
			}
		
			//get Abstract
			var a= "//meta[@name='description']";
			var abs= doc.evaluate(a, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
			newItem.abstractNote = abs;
			
			//get Section of the video, not sure if this meant for Archive location, if incorrect then leave it commented.
			//var sectionPath = "//meta[@name='keywords']";
			//var sectionPathObject = doc.evaluate(sectionPath,  doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
			//var sectionResult = sectionMetaObject.split(",");
			//newItem.archiveLocation = sectionPathObject;
			
			newItem.complete();
	}
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
		var titleXPath = '//div[@class="readItem"]/h4/a';
		var titles = doc.evaluate(titleXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		while (nextTitle = titles.iterateNext()){
			items[nextTitle.href] = nextTitle.textContent;
		}
		items= Zotero.selectItems(items);
		for (var i in items){
			articles.push(i);
		}
	} else if (detectWeb(doc,url) =="webpage"){
	articles = [url];
	}
	 else if (detectWeb(doc,url) =="tvBroadcast"){
	articles = [url];
	}
	
	Zotero.debug(articles);
	//Zotero.Util only works when scrape function is declared	
	Zotero.Utilities.processDocuments(articles, scrape, function(){Zotero.done();});
	
	Zotero.wait();	
}
