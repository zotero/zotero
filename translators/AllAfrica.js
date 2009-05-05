{
	"translatorID":"34B1E0EA-FD02-4069-BAE4-ED4D98674A5E",
	"translatorType":4,
	"label":"allAfrica.com",
	"creator":"Matt Bachtell",
	"target":"^http://allafrica\\.com/stories/*",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":false,
	"lastUpdated":"2009-05-05 07:15:00"
}


function detectWeb (doc, url) {
	
		return "newspaperArticle";
	
}

function doWeb (doc, url){
	scrape(doc,url);
}	

function scrape(doc, url) {
	var title = doc.evaluate("/html/body/div[3]/div/h1[@class='headline']", doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	var date = doc.evaluate("/html/body/div[3]/div/p[@class='date']", doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;	
				
// zotero entry creation code
	var newItem = new Zotero.Item('newspaperArticle');
	newItem.title = title;
	newItem.date = date;
	newItem.url = url;

	//AUTHORS
			try{
				var authors = doc.evaluate("/html/body/div[3]/div/p[@class='reporter']", doc, null, XPathResult.ANY_TYPE,null).iterateNext().textContent;
				if (authors.match(/ &| And/)){
					var aus = authors.split(" And");
					for (var i=0; i < aus.length ; i++){
						newItem.creators.push(Zotero.Utilities.cleanAuthor(aus[i], "author"));
					}
				}
				else if(authors.match(", ")){
					var aus = authors.split(/[,| And| & ]/);
					for (var i=0; i < aus.length; i++){
						newItem.creators.push(Zotero.Utilities.cleanAuthor(aus[i], "author"));
					}				
				}
				else{
					var author = authors;
					newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));				
				}
			}
			catch(e){
				// DO NOTHING
			}
		
	//SOURCE
	try{
		var newspaper_source = doc.evaluate("/html/body/div[3]/div/p/a/img/@alt", doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		newItem.publicationTitle = newspaper_source;				
	}
	catch(e){
		var newspaper_source = doc.evaluate("/html/body/div[3]/div/p", doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		newItem.publicationTitle = newspaper_source;				
	}
	newItem.complete();

} // end scrape