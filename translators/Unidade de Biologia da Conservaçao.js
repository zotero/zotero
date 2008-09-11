{
	"translatorID":"587aa172-af1a-4cab-b188-2b6d392cae5c",
	"translatorType":4,
	"label":"Unidade de Biologia da Conservaçao",
	"creator":"Giovanni Manghi and Michael Berkowitz",
	"target":"http://www.ubc.uevora.pt/",
	"minVersion":"1.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-09-08 18:40:46"
}

function detectWeb(doc, url) {
   if(doc.title == "UBC: referencia bibliografica") {
	return "book";
   } else if (doc.evaluate('//tr[@class]/td/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
	return "multiple";
   }
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "multiple") {
		var xpath = '//tr[@class]/td/a';
		var items = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_item;
		var arts = new Object();
		while (next_item = items.iterateNext()) {
			arts[next_item.href] = Zotero.Utilities.trimInternal(next_item.textContent);
		}
		arts = Zotero.selectItems(arts);
		var newDocs = new Array();
		for (var i in arts) {
			newDocs.push(i);
		}
		Zotero.debug(newDocs);
		Zotero.Utilities.processDocuments(newDocs, function(newDoc) { scrape(newDoc, newDoc.location.href); }, function() {Zotero.done();});
	} else {
		scrape(doc,url);
	}
}


function scrape(doc,url) {
       var xpath = "/html/body/div/div/div[3]/div[3]/table/tbody/tr/td"
       var xpathurl ="/html/body/div/div/div[3]/div[3]/table/tbody/tr/td/a[1]"
       var allRefText = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
       var allRefTexturl = Zotero.Utilities.cleanString(doc.evaluate(xpathurl, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);




// bib data scraper code here

function getItem(reftext,re) {
   var item = reftext.match(re);
   // Zotero.debug(item[1]);
   return item[1];
}

var TipoRe = "Type:(.*?)Title";
var tipoo = getItem(allRefText,TipoRe);

var titleRe = "Title:(.*?)Author";
var title = getItem(allRefText,titleRe);

var authorsRe = "Author.*?: (.*?)Journal";
var authors = getItem(allRefText,authorsRe);

var journalRe = "Journal:(.*?)Year";
var journal = getItem(allRefText,journalRe);

var yearRe = "Year:(.*?)Volume";
var year = getItem(allRefText,yearRe);

var volRe = "Volume:(.*?)Number";
var vol = getItem(allRefText,volRe);

var numRe = "Number:(.*?)Pages";
var num = getItem(allRefText,numRe);

var pageRe = "Pages:(.*?)Abstract";
var page = getItem(allRefText,pageRe);

var abstractRe = "Abstract:(.*?)Keywords";
var abstract = getItem(allRefText,abstractRe);

var keyRe = "Keywords:(.*?)Link";
var key = getItem(allRefText,keyRe);




// zotero entry creation code here

itemTypeMap = {
	article:"journalArticle",
	book:"book",
	conference:"conferencePaper",
	inproceedings:"conferencePaper",
	inbook:"bookSection",
	incollection:"bookSection",
	mastersthesis:"thesis",
	other:"journalArticle",
	phdthesis:"thesis",
	proceedings:"conferencePaper"
};

if (itemTypeMap[tipoo]) {
	tipooo = itemTypeMap[tipoo];
} else {
	tipooo = 'document';
}

var newArticle = new Zotero.Item(tipooo);

       var aus = authors.split(",");
        for (var i=0; i< aus.length ; i++) {
                newArticle.creators.push(Zotero.Utilities.cleanAuthor(aus[i],"author"));
       }

       newArticle.title = title;
       newArticle.publicationTitle = journal;
       newArticle.date = year;
       newArticle.volume = vol;
       newArticle.issue = num;
       newArticle.pages = page;
       newArticle.abstractNote = abstract;
       newArticle.keywords = key;
	     newArticle.url = url;


newArticle.complete();
}