{
	"translatorID":"96b9f483-c44d-5784-cdad-ce21b984fe01",
	"translatorType":4,
	"label":"Amazon.com",
	"creator":"Sean Takats and Michael Berkowitz",
	"target":"^https?://(?:www\\.)?amazon",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-22 20:30:00"
}

function detectWeb(doc, url) { 

	var suffixRe = new RegExp("https?://(?:www\.)?amazon\.([^/]+)/");
	var suffixMatch = suffixRe.exec(url);
	var suffix = suffixMatch[1];
	var searchRe = new RegExp('^https?://(?:www\.)?amazon\.' + suffix + '/(gp/search/|exec/obidos/search-handle-url/|s/)');
	if(searchRe.test(doc.location.href)) {
		return "multiple";
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		
		var xpath = '//input[@name="ASIN"]';
		if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var elmt = doc.evaluate('//input[@name="storeID"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(elmt) {
				var storeID = elmt.value;
				Zotero.debug("store id: " + storeID);
				if (storeID=="books"){
					return "book";
				}
				else if (storeID=="music"){
					return "audioRecording";
				}
				else if (storeID=="dvd"|storeID=="video"){
					return "videoRecording";
				}
				else {
					return "book";
				}
			}
			else {
				return "book";
			}
		}
	}
}


function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
	

	var suffixRe = new RegExp("https?://(?:www\.)?amazon\.([^/]+)/");
	var suffixMatch = suffixRe.exec(url);
	var suffix = suffixMatch[1];

	var searchRe = new RegExp('^https?://(?:www\.)?amazon\.' + suffix + '/(gp/search/|exec/obidos/search-handle-url/|s/)');
	var m = searchRe.exec(doc.location.href);
	var uris = new Array();
	if (suffix == "co.jp"){
		suffix = "jp";
	}
	if (suffix == ".com") suffix = "com";
	if(m) {
		var xpath = '//div[@class="productTitle"]/a | //a[span[@class="srTitle"]]';
		var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt = elmts.iterateNext();
		var asins = new Array();
		var availableItems = new Array();
		var i = 0;
		var asinRe = new RegExp('/(dp|product)/([^/]+)/');
		do {
			var link = elmt.href;
			var searchTitle = elmt.textContent;
			if  (asinRe.exec(link)) {
				var asinMatch = asinRe.exec(link);
				availableItems[i] = searchTitle;
				asins[i] = asinMatch[2];
				i++;
			}
		} while (elmt = elmts.iterateNext());
		var items = Zotero.selectItems(availableItems);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			uris.push("http://ecs.amazonaws." + suffix + "/onca/xml?Service=AWSECommerceService&Version=2006-06-28&Operation=ItemLookup&SubscriptionId=0H174V5J5R5BE02YQN02&ItemId=" + asins[i] + "&ResponseGroup=ItemAttributes");
		}
		
	} else {
		var elmts = doc.evaluate('//input[@name = "ASIN"]', doc,
	                       nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		while(elmt = elmts.iterateNext()) {
			var asin = elmt.value;
		}
		uris.push("http://ecs.amazonaws." + suffix + "/onca/xml?Service=AWSECommerceService&Version=2006-06-28&Operation=ItemLookup&SubscriptionId=0H174V5J5R5BE02YQN02&ItemId=" + asin + "&ResponseGroup=ItemAttributes");
	}
	Zotero.Utilities.HTTP.doGet(uris, function(text) {
		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");
		var texts = text.split("<Items>");
		texts = texts[1].split("</ItemLookupResponse>");
		text = "<Items>" + texts[0];
		var xml = new XML(text);
		var publisher = "";
	
		if (!xml..Errors.length()) {
			if (xml..Publisher.length()){
				publisher = Zotero.Utilities.cleanString(xml..Publisher[0].text().toString());
			}
			
			var binding = "";
			if (xml..Binding.length()){
				binding = Zotero.Utilities.cleanString(xml..Binding[0].text().toString());
			}
			
			var productGroup = "";
			if (xml..ProductGroup.length()){
				productGroup = Zotero.Utilities.cleanString(xml..ProductGroup[0].text().toString());
			}
				
			if (productGroup=="Book") {
				var newItem = new Zotero.Item("book");
				newItem.publisher = publisher;
			}
			else if (productGroup == "Music") {
				var newItem = new Zotero.Item("audioRecording");
				newItem.label = publisher;
				newItem.audioRecordingType = binding;
				for(var i=0; i<xml..Artist.length(); i++) {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(xml..Artist[i].text().toString(), "performer"));
				}
			}
			else if (productGroup == "DVD" | productGroup == "Video") {
				var newItem = new Zotero.Item("videoRecording");
				newItem.studio = publisher;
				newItem.videoRecordingType = binding;
				for(var i=0; i<xml..Actor.length(); i++) {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(xml..Actor[i].text().toString(), "castMember"));
				}
				for(var i=0; i<xml..Director.length(); i++) {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(xml..Director[i].text().toString(), "director"));
				}		
			}
			else{
				var newItem = new Zotero.Item("book");
				newItem.publisher = publisher;
			}
			
			if(xml..RunningTime.length()){
				newItem.runningTime = Zotero.Utilities.cleanString(xml..RunningTime[0].text().toString());
			}
			
			// Retrieve authors and other creators
			for(var i=0; i<xml..Author.length(); i++) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(xml..Author[i].text().toString(), "author"));
			}
			if (newItem.creators.length == 0){
				for(var i=0; i<xml..Creator.length(); i++) {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(xml..Creator[i].text().toString()));
				}
			}
			
			if (xml..PublicationDate.length()){
				newItem.date = Zotero.Utilities.cleanString(xml..PublicationDate[0].text().toString());
			} else if (xml..ReleaseDate.length()){
				newItem.date = Zotero.Utilities.cleanString(xml..ReleaseDate[0].text().toString());
			}
			if (xml..Edition.length()){
				newItem.edition = Zotero.Utilities.cleanString(xml..Edition[0].text().toString());
			}
			if (xml..ISBN.length()){
				newItem.ISBN = Zotero.Utilities.cleanString(xml..ISBN[0].text().toString());
			}
//			Uncomment when numPages field is added to schema
//			if (xml..NumberOfPages.length()){
//				newItem.numPages = Zotero.Utilities.cleanString(xml..NumberOfPages[0].text().toString());
//			}
			var title = Zotero.Utilities.cleanString(xml..Title[0].text().toString());
			if(title.lastIndexOf("(") != -1 && title.lastIndexOf(")") == title.length-1) {
				title = title.substring(0, title.lastIndexOf("(")-1);
			}
			if (xml..ASIN.length()){
				var url = "http://www.amazon." + suffix + "/dp/" + Zotero.Utilities.cleanString(xml..ASIN[0].text().toString());
				newItem.attachments.push({title:"Amazon.com Link", snapshot:false, mimeType:"text/html", url:url});
			}
			
			if (xml..OriginalReleaseDate.length()){
				newItem.extra = Zotero.Utilities.cleanString(xml..OriginalReleaseDate[0].text().toString());
			}
			
			newItem.title = title;
			newItem.complete();
		}
	}, function() {Zotero.done;}, null);
	Zotero.wait();
}