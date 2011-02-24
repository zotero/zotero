{
        "translatorID": "d0b1914a-11f1-4dd7-8557-b32fe8a3dd47",
        "label": "EBSCOhost",
        "creator": "Simon Kornblith and Michael Berkowitz",
        "target": "https?://[^/]+/(?:bsi|ehost)/(?:results|detail|folder)",
        "minVersion": "1.0.0b3.r1",
        "maxVersion": "",
        "priority": 100,
        "inRepository": "1",
        "translatorType": 4,
        "lastUpdated": "2011-02-24 23:44:28"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
		// The Scientific American Archive breaks this translator, disabling 
		try {
			var databases = doc.evaluate("//span[@class = 'selected-databases']", doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			if(databases.indexOf("Scientific American Archive Online") != -1) {
				return false;
			}
		} catch(e) {
		}
	
	
	// See if this is a search results or folder results page
	var searchResult = doc.evaluate('//ul[@class="result-list" or @class="folder-list"]/li/div[@class="result-list-record" or @class="folder-item"]', doc, nsResolver,
	                                XPathResult.ANY_TYPE, null).iterateNext();         
	if(searchResult) {
		return "multiple";
	}
/*
	var xpath = '//div[@class="citation-wrapping-div"]/dl[@class="citation-fields"]/dt[starts-with(text(), "Persistent link to this record")'
		+' or starts-with(text(), "Vínculo persistente a este informe")'
		+' or starts-with(text(), "Lien permanent à cette donnée")'
		+' or starts-with(text(), "Permanenter Link zu diesem Datensatz")'
		+' or starts-with(text(), "Link permanente al record")'
		+' or starts-with(text(), "Link permanente para este registro")'
		+' or starts-with(text(), "本記錄固定連結")'
		+' or starts-with(text(), "此记录的永久链接")'
		+' or starts-with(text(), "このレコードへのパーシスタント リンク")'
		+' or starts-with(text(), "레코드 링크 URL")'
		+' or starts-with(text(), "Постоянная ссылка на эту запись")'
		+' or starts-with(text(), "Bu kayda sürekli bağlantı")'
		+' or starts-with(text(), "Μόνιμος σύνδεσμος σε αυτό το αρχείο")]';
*/
	var xpath = '//input[@id="ctl00_ctl00_Column2_Column2_topDeliveryControl_deliveryButtonControl_lnkExport"]';
	var persistentLink = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if(persistentLink) {
		return "journalArticle";
	}
}

var customViewStateMatch = /<input type="hidden" name="__CUSTOMVIEWSTATE" id="__CUSTOMVIEWSTATE" value="([^"]+)" \/>/
var host;

function fullEscape(text) {
	return escape(text).replace(/\//g, "%2F").replace(/\+/g, "%2B");
}

function generateDeliverString(nsResolver, doc){	
	var hiddenInputs = doc.evaluate('//input[@type="hidden" and not(contains(@name, "folderHas")) and not(@name ="ajax")]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var hiddenInput;
	var deliverString ="";
	while(hiddenInput = hiddenInputs.iterateNext()) {
		if (hiddenInput.name !== "__EVENTTARGET" && hiddenInput.name !== "") {
			deliverString = deliverString+hiddenInput.name.replace(/\$/g, "%24")+"="+encodeURIComponent(hiddenInput.value) + "&";
		}
	}
	var otherHiddenInputs = doc.evaluate('//input[@type="hidden" and contains(@name, "folderHas")]', doc, nsResolver, XPathResult.ANY_TYPE, null);
	while(hiddenInput = otherHiddenInputs.iterateNext()) {
		deliverString = deliverString+hiddenInput.name.replace(/\$/g, "%24")+"="+escape(hiddenInput.value).replace(/\//g, "%2F").replace(/%20/g, "+") + "&";
	}
	
	deliverString = "__EVENTTARGET=ctl00%24ctl00%24Column2%24Column2%24topDeliveryControl%24deliveryButtonControl%24lnkExport&" + deliverString;
	
	return deliverString;
}


/*
 * given the text of the delivery page, downloads an item
 */
function downloadFunction(text) {
	
	//Zotero.debug("POSTTEXT="+text);
	var postLocation = /<form method="post" action="([^"]+)"[^><]*id="aspnetForm"/
	var postMatch = postLocation.exec(text);
	var deliveryURL = postMatch[1].replace(/&amp;/g, "&");
	postMatch = customViewStateMatch.exec(text);
	var downloadString = "__EVENTTARGET=&__EVENTARGUMENT=&__CUSTOMVIEWSTATE="+fullEscape(postMatch[1])+"&__VIEWSTATE=&ctl00%24ctl00%24MainContentArea%24MainContentArea%24ctl00%24btnSubmit=Save&ctl00%24ctl00%24MainContentArea%24MainContentArea%24ctl00%24BibFormat=1&ajax=enabled";
	
	Zotero.Utilities.HTTP.doPost(host+"/ehost/"+deliveryURL,
								 downloadString, function(text) {	// get marked records as RIS
		Zotero.debug(text);
		// load translator for RIS
		if (text.match(/^AB\s\s\-/m)) text = text.replace(/^AB\s\s\-/m, "N2  -");
		if (!text.match(/^TY\s\s-/m)) text = text+"\nTY  - JOUR\n"; 
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			if (text.match(/^L3\s+-\s*(.*)/m)) {
				item.DOI = text.match(/^L3\s+\-\s*(.*)/m)[1];
			}
			if (text.match(/^M3\s+-\s*(.*)/m)) {
				if (item.DOI == text.match(/^M3\s+\-\s*(.*)/m)[1]) item.DOI = "";
			}
			if (text.match(/^DO\s+-\s*(.*)/m)) {
				item.DOI = text.match(/^DO\s+-\s*(.*)/m)[1];
			}
			if (text.match(/^T1\s+-/m)) {
				item.title = text.match(/^T1\s+-\s*(.*)/m)[1];
			}
			//item.itemType = "journalArticle";
			item.url = false;
			// RIS translator tries to download the link in "UR" this leads to unhappyness
			item.attachments = [];
			item.complete();

		});
		translator.translate();
		
		Zotero.done();
	});
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var hostRe = new RegExp("^(https?://[^/]+)/");
	var hostMatch = hostRe.exec(url);
	host = hostMatch[1];
	                                
	var searchResult = doc.evaluate('//ul[@class="result-list" or @class="folder-list"]/li/div[@class="result-list-record" or @class="folder-item"]', doc, nsResolver,
	                                XPathResult.ANY_TYPE, null).iterateNext();                              

	if(searchResult) {
		var titlex = '//a[@class = "title-link color-p4"]';
		var titles = doc.evaluate(titlex, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var items = new Object();
		var title;
		while (title = titles.iterateNext()) {
			items[title.href] = title.textContent;
		}
		
		var items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}

		var uris = new Array();
		for(var i in items) {
			uris.push(i);
		}
		
		Zotero.Utilities.processDocuments(uris, function(newDoc){
			var postURL = newDoc.evaluate('//form[@id="aspnetForm"]/@action', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			postURL = host+"/ehost/"+postURL.nodeValue;
			var deliverString = generateDeliverString(nsResolver, newDoc);
			Zotero.Utilities.HTTP.doPost(postURL, deliverString, downloadFunction);
		});
	} else {
		//This is a hack, generateDeliveryString is acting up for single pages, but it works on the plink url
		var link = [doc.evaluate("//input[@id ='pLink']/@value", doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue];
		Zotero.Utilities.processDocuments(link, function(newDoc){			
			var postURL = newDoc.evaluate('//form[@id="aspnetForm"]/@action', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			postURL = host+"/ehost/"+postURL.nodeValue;
			var deliverString = generateDeliverString(nsResolver, newDoc);
			Zotero.Utilities.HTTP.doPost(postURL, deliverString, downloadFunction);
		});

	}
	Zotero.wait();
}
