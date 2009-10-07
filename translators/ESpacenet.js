{
	"translatorID":"176948f7-9df8-4afc-ace7-4c1c7318d426",
	"translatorType":4,
	"label":"ESpacenet",
	"creator":"Gilles Poulain",
	"target":"http://v3.espacenet.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-10-07 16:30:00"
}

function detectWeb(doc, url) {
	if(url.match("searchResults\?")) {
        	return "multiple";
        } else if (doc.location.href.match("biblio")) {
	        return "patent";
        }
  }

function doWeb(doc, url) {
   
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var articles = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
			
		var titles = doc.evaluate('//td[3]/strong/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = Zotero.Utilities.trim(next_title.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
		
	} else {
		articles = [url];
	}
	if(articles.length == 0) return true;
	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	Zotero.wait();
}
   
function getItem(reftext,re) {
    var item = reftext.match(re);
    return item[1];
}

function scrape(doc,url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	
	//Get title
	var xpath = "/html/body/table[2]/tbody/tr[1]/td[3]/h2";
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var title = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);	
		
		var title1 = title.split(" ");		 
		for (var j in title1) {
			title1[j] = title1[j][0].toUpperCase() + title1[j].substr(1).toLowerCase();
		}
		title = title1.join(" ");
	}

	//Get Abstract
	var xpath = '//td[@id="abCell"]';
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var abstract = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);	
	}
	
	//Get Applicant
	var xpath = "//table[1]/tbody/tr/td[1]/table/tbody/tr[4]/td[2]";
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var applicant = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);	
	}

	//Get application number
	var xpath = "//table[1]/tbody/tr/td[1]/table/tbody/tr[8]/td[2]";
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var anumber = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);	
	}
	
	//Get patent number
	var xpath = "//table[1]/tbody/tr/td[1]/table/tbody/tr[1]/td[2]";
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var pnumber = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);	
	}
	
	//Get CIB
	var xpath = "//table[1]/tbody/tr/td[1]/table/tbody/tr[6]/td[2]";
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var CIBnumber = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);	
	}
	
	//Get ECLA
	var xpath = "//table[1]/tbody/tr/td[1]/table/tbody/tr[7]/td[2]";
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var tmpECLAnumber = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);		
		tmpECLAnumber = tmpECLAnumber.substr(24);
		tmpECLAnumber = tmpECLAnumber.replace(/\)+/g, '; ');
		var aus = tmpECLAnumber.split("; ");
		var ECLAnumber = "";
		for (var i=0; i< aus.length/2 ; i++){
			ECLAnumber = ECLAnumber + aus[i] + "; "
		}
	}

	//Get priority number
	var xpath = "//table[1]/tbody/tr/td[1]/table/tbody/tr[9]/td[2]";
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var prnumber = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	}	

	
	//Get date
	var xpath = "//table[1]/tbody/tr/td[1]/table/tbody/tr[2]/td[2]";
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var date = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);	
	}
	
	//Get Creators
	var xpath = "//table[1]/tbody/tr/td[1]/table/tbody/tr[3]/td[2]";
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var author = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);	
	}

	//Create Zotero Ref
	var newArticle = new Zotero.Item('patent');
		newArticle.url = doc.location.href;
		newArticle.title = title;
		newArticle.date = date;
		newArticle.abstractNote = abstract;
		newArticle.assignee = applicant;
		newArticle.patentNumber = pnumber;
		newArticle.priorityNumbers = prnumber;
		newArticle.applicationNumber = anumber;
		newArticle.extra = "CIB: " + CIBnumber + "\nECLA: " + ECLAnumber

	var author1 = author.split("; ");
;
	for (var m = 0; m< author1.length; m++) {
		
		if (author1[m].match(/\(/)) {
			author1[m] = author1[m].substr(0, author1[m].length-5);
		}
		words = author1[m].split(/\s/);

		for (var j in words) {
			words[j] = words[j][0].toUpperCase() + words[j].substr(1).toLowerCase();
		}

		var inventor = '';
		for (var k = 1; k < words.length; k++) {
			inventor = inventor +words[k] + " ";
			if (k == words.length-1) {
				inventor = inventor +words[0];
				newArticle.creators.push(Zotero.Utilities.cleanAuthor(inventor, "inventor"));
			}
		}
	}

	 newArticle.complete();
}