{
	"translatorID":"879d738c-bbdd-4fa0-afce-63295764d3b7",
	"translatorType":4,
	"label":"FreePatentsOnline",
	"creator":"Adam Crymble",
	"target":"http://www.freepatentsonline.com",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-09-02 13:40:00"
}

function detectWeb(doc, url) {
	if (doc.location.href.match("result.html")) {
		return "multiple";
	} else if (doc.evaluate('//div[@class="disp_doc2"]/div', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "patent";
	}
}

function associateData (newItem, dataTags, field, zoteroField) {
	if (dataTags[field]) {
		newItem[zoteroField] = dataTags[field];
	}
}

function scrape(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;	
	
	var dataTags = new Object();
	var fieldTitle;
	var contents;
	
	var newItem = new Zotero.Item("patent");

	var pageContent = doc.evaluate('//div[@class="disp_doc2"]/div', doc, null, XPathResult.ANY_TYPE, null);
	var xPathCount = doc.evaluate('count (//div[@class="disp_doc2"]/div)', doc, null, XPathResult.ANY_TYPE, null);
	

	for (i=0; i<xPathCount.numberValue/2; i++) {	 	
     			
     		fieldTitle = pageContent.iterateNext().textContent.replace(/\s+/g, '');
     		content = pageContent.iterateNext().textContent.replace(/^\s*|\s*$/g, '');
     		dataTags[fieldTitle] = (content);
     	}
	
	var inventors = new Array();
	var parenthesis;
	
	if (dataTags["Inventors:"]) {
		inventors = dataTags["Inventors:"].split(/\n/);
		if (inventors.length>1) {
			for (var i = 0; i < inventors.length; i++) {
					parenthesis = inventors[i].indexOf("(");
					inventors[i] = inventors[i].substr(0, parenthesis).replace(/^\s*|\s*$/g, '');			
				if (inventors[i].match(", ")) {
					var inventors1 = inventors[i].split(", ");
					inventors[i] = inventors1[1] + " " + inventors1[0];
					newItem.creators.push(Zotero.Utilities.cleanAuthor(inventors[i], "inventor"));
				} else {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(inventors[i], "inventor"));
				}
			}
			
		} else {
			Zotero.debug(doc.title);
			parenthesis = dataTags["Inventors:"].indexOf("(");
			dataTags["Inventors:"] = dataTags["Inventors:"].substr(0, parenthesis).replace(/^\s*|\s*$/g, '');
			
			if (dataTags["Inventors:"].match(", ")) {
				var inventors1 = dataTags["Inventors:"].split(", ");
				dataTags["Inventors:"] = inventors1[1] + " " + inventors1[0];
				newItem.creators.push(Zotero.Utilities.cleanAuthor(dataTags["Inventors:"], "inventor"));
			} else {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(dataTags["Inventors:"], "inventor"));
			}
		}
	}

	associateData (newItem, dataTags, "Title:", "title");
	associateData (newItem, dataTags, "Abstract:", "abstract");
	associateData (newItem, dataTags, "DocumentTypeandNumber:", "patentNumber");
	associateData (newItem, dataTags, "ApplicationNumber:", "applicationNumber");
	associateData (newItem, dataTags, "PublicationDate:", "issueDate");
	associateData (newItem, dataTags, "Assignee:", "assignee");
	
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
				
		var titles = doc.evaluate('//table[@class="listing_table"]/tbody/tr/td[3]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
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