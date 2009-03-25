{
	"translatorID":"a77690cf-c5d1-8fc4-110f-d1fc765dcf88",
	"translatorType":4,
	"label":"ProQuest",
	"creator":"Simon Kornblith",
	"target":"^https?://[^/]+/pqdweb\\?((?:.*\\&)?did=.*&Fmt=[0-9]|(?:.*\\&)Fmt=[0-9].*&did=|(?:.*\\&)searchInterface=|(?:.*\\&)TS=[0-9])",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-15 18:30:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	       
	if(doc.evaluate('//img[substring(@src, string-length(@src)-32) = "/images/common/logo_proquest.gif" or substring(@src, string-length(@src)-38) = "/images/common/logo_proquest_small.gif"]',
	                doc, nsResolver, XPathResult.ANY_TYPE, null)) {    
		                
		
		var xpath = '//table[@id="tableIndexTerms"]/tbody/tr/td[@class="textSmall"]';
		var data= doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var aitem;
		var source;
		while(aitem = data.iterateNext()) {
			source=aitem.textContent;
			if(source=="Source type:") {
				source=data.iterateNext().textContent;
				Zotero.debug("Item Source Type: "+source);
				break;
			}
		}        
	                
		if(doc.title == "Results") {
			return "multiple";
		} else if(doc.title == "Document View") {
			switch (source) {
				case 'Dissertation':
					return "thesis";
					break;
				case 'Historical Newspaper':
				case 'Newspaper':
					return "newspaperArticle";
				default:
					return "journalArticle";
					break;
			}
			
		}
	}
}

//^https?://[^/]+/pqdweb\?((?:.*\&)?did=.*&Fmt=[0-9]|(?:.*\&)Fmt=[0-9].*&did=|(?:.*\&)searchInterface=)

function parseRIS(uris) {
	Zotero.Utilities.HTTP.doGet(uris, function(text, xmlhttp, url){	
		// load translator for RIS
		if(url.match("exportFormat=1")=="exportFormat=1") {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			// Strip lines with just whitespace, which mess up RIS parsing
			text = text.replace(/^\s*$\n/gm, '');
			translator.setString(text);

			//Set Handler fixes anomaly in Proquest RIS format. Properly formats author name as [last name], [first name]
			translator.setHandler("itemDone", function(obj, item) {
				var cre = new Array();
				cre = item.creators;
				
				for each(var e in cre) {
					
					if(!e['firstName']) {
						// Rather than parse, change creator to a single field.
						e.fieldMode = 1;
					}
				}
				
				if (item.publicationTitle) item.publicationTitle = Zotero.Utilities.trimInternal(item.publicationTitle.replace(/\([\d\-]+\)/g, ""));
				item.complete();
			});
		
			translator.translate();
			Zotero.done();
		}
		
	}, function() {});
	Zotero.wait();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var hostRegexp = new RegExp("^(https?://[^/]+)/");
	var hMatch = hostRegexp.exec(url);
	var host = hMatch[1];
	

	
	if(doc.evaluate('//img[substring(@src, string-length(@src)-32) = "/images/common/logo_proquest.gif" or substring(@src, string-length(@src)-38) = "/images/common/logo_proquest_small.gif"]',
		                doc, nsResolver, XPathResult.ANY_TYPE, null)) {
			if(doc.title == "Results") {
				
				//Get Client ID
				var xpath = '//a';
				var data= doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
				var aitem;
				var clientID;
				while(aitem = data.iterateNext()) {
					clientID=aitem.href;
					if(clientID.indexOf("clientId")!=-1) {
						clientID = clientID.substr(clientID.indexOf("clientId")+9,clientID.length);
						break;
					}
				}		
				
				var multXpath = '//input[@name="chk"][@type="checkbox"]';
				var titleXpath = '//a[@class="bold"]';
				var mInfos = doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
				var titleElmts = doc.evaluate(titleXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
				var titleElmt;
				var mInfo;
				mInfo = mInfos.iterateNext();
				titleElmt = titleElmts.iterateNext();

				var items = new Array();

				do {
					//Get item ID
					
					var str= mInfo.value;
					str= str.replace("retrieveGroup", "sid");
					var url = host+"/pqdweb?RQT=530&markedListInfo="+str+"1";
					items[url] = Zotero.Utilities.trimInternal(titleElmt.textContent);

				} while((mInfo = mInfos.iterateNext()) && (titleElmt = titleElmts.iterateNext()));

				items = Zotero.selectItems(items);
				if(!items) return true;

				
				//Array of URLs for the doGet
				var uris = new Array();
				
				//Clear Basket
				uris.push(host+"/pqdweb?RQT=531&clientId="+clientID);
				uris.push(host+"/pqdweb?RQT=532&clientId="+clientID);
				
				//Add URLS to the basket
				for(var bibcode in items) {
					uris.push(bibcode);
				}
					
				//Export basket as a RIS file
				uris.push(host+"/pqdweb?RQT=532&clientId="+clientID);
				uris.push(host+"/pqdweb?RQT=562&MRR=M&clientId="+clientID);
				uris.push(host+"/pqdweb?RQT=562&exportFormat=1&clientId="+clientID);
				
				parseRIS(uris);
				
			} else {

				//Get Client ID
				var xpath = '//a';
				var data= doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
				var aitem;
				var clientID;
				while(aitem = data.iterateNext()) {
					clientID=aitem.href;
					if(clientID.indexOf("clientId")!=-1) {
						clientID = clientID.substr(clientID.indexOf("clientId")+9,clientID.length);
						break;
					}
				}		
				
				//Get item ID
				var xpath = '//input[@name="marked"][@type="checkbox"]';
				var str= doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
				str= str.replace("retrieveGroup", "sid");
				
				//Array of URLs for the doGet
				var uris = new Array();
				
				//Clear Basket
				uris.push(host+"/pqdweb?RQT=531&clientId="+clientID);
				uris.push(host+"/pqdweb?RQT=532&clientId="+clientID);
				
				//Create URL to add item to basket
				url = host+"/pqdweb?RQT=530&markedListInfo="+str+"1";
				Zotero.debug("RIS URL: "+url);
				
				uris.push(url);
					
				//Export basket as a RIS file
				uris.push(host+"/pqdweb?RQT=532&clientId="+clientID);
				uris.push(host+"/pqdweb?RQT=562&MRR=M&clientId="+clientID);
				uris.push(host+"/pqdweb?RQT=562&exportFormat=1&clientId="+clientID);
				
				parseRIS(uris);
				
			}
		}

}