{
        "translatorID":"176948f7-9df8-4afc-ace7-4c1c7318d426",
        "label":"ESpacenet",
        "creator":"Gilles Poulain, Rintze Zelle, and Edouard Leroy",
        "target":"^https?://worldwide\\.espacenet\\.com/",
        "minVersion":"1.0.0b4.r5",
        "maxVersion":"",
        "priority":100,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2011-01-11 04:31:00"
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

		var titles = doc.evaluate('//span[@class="resNumber"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);

		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = Zotero.Utilities.trim(next_title.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
		
		if(articles.length == 0) return true;
		Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
		Zotero.wait();
	} else {
		scrape(doc, url);
	}
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
	var xpath = '//div[@id="pagebody"]/h3';
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var title = Zotero.Utilities.trimInternal(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);

		// In the very common case of all-caps, fix them!
		if (title == title.toUpperCase()) {
			title = Zotero.Utilities.capitalizeTitle(title.toLowerCase(), true);
		}
	}

	//Get Abstract
	var xpath = '//div[@class="application article clearfix"]/p[1]';
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var abstract = Zotero.Utilities.trimInternal(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	}

	//Get Applicant
	var xpath = '//table[@class="tableType3"]/tbody/tr[5]/td';
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var applicantField = Zotero.Utilities.trimInternal(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	}

	//Get application number
	var xpath = '//table[@class="tableType3"]/tbody/tr[7]/td';
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var anumber = Zotero.Utilities.trimInternal(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	}

	//Get patent number
	var xpath = '//table[@class="tableType3"]/tbody/tr[2]/td/a';
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var pnumber = Zotero.Utilities.trimInternal(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var pnumber= pnumber.split("-");
		pnumber=pnumber[0];
	}

	//Get CIB
	var xpath = '//tr[contains(th/text(),"- international:")]/td';
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var CIBnumber = Zotero.Utilities.trimInternal(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	}

	//Get ECLA
	var xpath = "//tr[contains(th/text(),'- European:')]/td";
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		ECLAnumber = Zotero.Utilities.trimInternal(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	}

	//Get priority number
	var xpath = '//table[@class="tableType3"]/tbody/tr[8]/td';
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var prnumber = Zotero.Utilities.trimInternal(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	}

	//Get date
	var xpath = '//table[@class="tableType3"]/tbody/tr[3]/td';
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var date = Zotero.Utilities.trimInternal(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	}

	//Get Creators
	var xpath = '//table[@class="tableType3"]/tbody/tr[4]/td';
	if(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()){
		var inventorField = Zotero.Utilities.trimInternal(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	}

	//Create Zotero Ref
	var newArticle = new Zotero.Item('patent');
	newArticle.attachments = [{url:doc.location.href, title:"Espacenet patent record"}];
	newArticle.title = title;
	newArticle.date = date;
	newArticle.abstractNote = abstract;
	newArticle.patentNumber = pnumber;
	newArticle.priorityNumbers = prnumber;
	newArticle.applicationNumber = anumber;
	newArticle.extra = "CIB: " + CIBnumber + "\nECLA: " + ECLAnumber;

	if (applicantField) {
		newArticle.assignee = reorganizeNames(applicantField).join("; ");
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
			nameParts = nameArray[m].split(", ");
			nameParts[0] = nameParts[0].concat(",");
			nameArray[m] = nameParts.join(" ");
		} else {
			nameArray[m] = nameArray[m].replace(" ", ", ");
		}
	}

	return nameArray;
}
