{
        "translatorID":"176948f7-9df8-4afc-ace7-4c1c7318d426",
        "label":"ESpacenet",
        "creator":"Gilles Poulain and Rintze Zelle",
        "target":"http://v3.espacenet.com/",
        "minVersion":"1.0.0b4.r5",
        "maxVersion":"",
        "priority":100,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2010-10-17 10:38:50"
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
		var applicantField = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);	
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
		var inventorField = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);	
	}

	//Create Zotero Ref
	var newArticle = new Zotero.Item('patent');
	newArticle.url = doc.location.href;
	newArticle.title = title;
	newArticle.date = date;
	newArticle.abstractNote = abstract;
	newArticle.patentNumber = pnumber;
	newArticle.priorityNumbers = prnumber;
	newArticle.applicationNumber = anumber;
	newArticle.extra = "CIB: " + CIBnumber + "\nECLA: " + ECLAnumber

	if (applicantField) {
		var applicant = reorganizeNames(applicantField).join("; ");
		newArticle.assignee = applicant;
	}
	
	var inventors = reorganizeNames(inventorField);
	for (var m = 0; m< inventors.length; m++) {
		newArticle.creators.push(Zotero.Utilities.cleanAuthor(inventors[m], "inventor", true));
	}

	 newArticle.complete();
}

function reorganizeNames(nameField) {
	var nameCollection = nameField.split("(")[1].split(")")[0];
	var nameParts = nameCollection.split(" ");
	for (var j in nameParts) {
		nameParts[j] = nameParts[j][0].toUpperCase() + nameParts[j].substr(1).toLowerCase();
        }
        nameCollection = nameParts.join(" ");
	
	var nameArray = nameCollection.split(", ; ");

	for (var m = 0; m< nameArray.length; m++) {
		if (nameArray[m].match(",")) {
			var nameParts = "";
			nameParts =  nameArray[m].split(", ");
			nameParts[0] = nameParts[0].concat(",");
			nameArray[m] = nameParts.join(" ");
		} else {
			nameArray[m] = nameArray[m].replace(" ", ", ");
		}
	}

    return nameArray;
}