-- 258

--  ***** BEGIN LICENSE BLOCK *****
--  
--  Copyright (c) 2006  Center for History and New Media
--                      George Mason University, Fairfax, Virginia, USA
--                      http://chnm.gmu.edu
--  
--  Licensed under the Educational Community License, Version 1.0 (the "License");
--  you may not use this file except in compliance with the License.
--  You may obtain a copy of the License at
--  
--  http://www.opensource.org/licenses/ecl1.php
--  
--  Unless required by applicable law or agreed to in writing, software
--  distributed under the License is distributed on an "AS IS" BASIS,
--  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
--  See the License for the specific language governing permissions and
--  limitations under the License.
--  
--  ***** END LICENSE BLOCK *****


-- Set the following timestamp to the most recent scraper update date
REPLACE INTO version VALUES ('repository', STRFTIME('%s', '2008-04-04 20:30:00'));

REPLACE INTO translators VALUES ('96b9f483-c44d-5784-cdad-ce21b984fe01', '1.0.0b4.r1', '', '2008-03-21 20:00:00', '1', '100', '4', 'Amazon.com', 'Sean Takats and Michael Berkowitz', '^https?://(?:www\.)?amazon', 
'function detectWeb(doc, url) { 

	var suffixRe = new RegExp("https?://(?:www\.)?amazon\.([^/]+)/");
	var suffixMatch = suffixRe.exec(url);
	var suffix = suffixMatch[1];
	var searchRe = new RegExp(''^https?://(?:www\.)?amazon\.'' + suffix + ''/(gp/search/|exec/obidos/search-handle-url/|s/)'');
	if(searchRe.test(doc.location.href)) {
		return "multiple";
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var xpath = ''//input[@name="ASIN"]'';
		if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var elmt = doc.evaluate(''//input[@name="storeID"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
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
', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
	var suffixRe = new RegExp("https?://(?:www\.)?amazon\.([^/]+)/");
	var suffixMatch = suffixRe.exec(url);
	var suffix = suffixMatch[1];

	var searchRe = new RegExp(''^https?://(?:www\.)?amazon\.'' + suffix + ''/(gp/search/|exec/obidos/search-handle-url/|s/)'');
	var m = searchRe.exec(doc.location.href);
	var uris = new Array();
	if (suffix == "co.jp"){
		suffix = "jp";
	}
	if (suffix == ".com") suffix = "com";
	if(m) {
		var xpath = ''//a/span[@class="srTitle"]'';
		var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt = elmts.iterateNext();
		var asins = new Array();
		var availableItems = new Array();
		var i = 0;
		var asinRe = new RegExp(''/(dp|product)/([^/]+)/'');

		do {
			var link = doc.evaluate(''../@href'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
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
		var elmts = doc.evaluate(''//input[@name = "ASIN"]'', doc,
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
		if (xml..NumberOfPages.length()){
			newItem.pages = Zotero.Utilities.cleanString(xml..NumberOfPages[0].text().toString());
		}
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
	}, function() {Zotero.done();}, null);
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('aee2323e-ce00-4fcc-a949-06eb1becc98f', '1.0.0b4.r1', '', '2007-08-27 05:00:00', '0', '100', '4', 'Epicurious', 'Sean Takats', '^https?://www\.epicurious\.com/(?:tools/searchresults|recipes/food/views)', 
'function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
		} : null;
		
	var xpath = ''//div[@id="ingredients"]'';
	var multxpath = ''//table[@class="search-results"]/tbody/tr'';

	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "document";
	} else if (doc.evaluate(multxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";
	}
	
}', 
'function cleanText(s){
	s = s.replace(/\n+/g, "\n");
	s = s.replace(/(\n|\r)\t+/g, "\n");  
	s = s.replace(/\t+/g, " ");
	s = s.replace("        ", "", "g");
	return s;
}

function scrape(doc){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
		} : null;

	var newItem = new Zotero.Item("document");

	var xpath = ''//title'';
	var title = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	title = title.substring(0, title.indexOf(" Recipe at Epicurious.com"));
	newItem.title = title;

	var elmt;

	xpath = ''//p[@class="source"]'';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if (elmt = elmts.iterateNext()){
		var authordate = elmt.textContent;
		var authordates = authordate.split("|");
		newItem.creators.push(Zotero.Utilities.cleanAuthor(authordates[0], "contributor", true));
		var datestring = authordates[1].toString();
		datestring = datestring.replace("Copyright", "");
		newItem.date = Zotero.Utilities.formatDate(Zotero.Utilities.strToDate(datestring));
		while (elmt = elmts.iterateNext()){
		 	Zotero.debug("looping?");
		 	Zotero.debug(elmt.textContent);
			newItem.creators.push(Zotero.Utilities.cleanAuthor(elmt.textContent, "contributor", false));
		}
	}
		
	xpath = ''//div[@id="recipe_intro"]/p'';
	if (elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var abstract = elmt.textContent;
		abstract = Zotero.Utilities.cleanString(abstract);
		newItem.abstractNote = abstract;		
	}

	xpath = ''//div[@id="ingredients"]'';
	if (elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var ingredients = elmt.textContent;
		ingredients = Zotero.Utilities.superCleanString(ingredients);
		ingredients = cleanText(ingredients);
	}
	xpath = ''//div[@id="preparation"]'';
	if (elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var prep = elmt.textContent;
		prep = Zotero.Utilities.superCleanString(prep);
		prep = cleanText(prep);
		prep = prep.replace(/\n/g, "\n\n");
	}
	xpath = ''//div[@id="recipe_summary"]/p'';
	if (elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var serving = elmt.textContent;
		serving = Zotero.Utilities.superCleanString(serving);
		serving = cleanText(serving);
	}
//	notestring = ingredients + "\n\n" + prep + "\n\n" + serving;
//	newItem.notes.push({note:notestring});
	newItem.notes.push({note:ingredients});
	newItem.notes.push({note:prep});
	newItem.notes.push({note:serving});

	var url = doc.location.href;
	
	var snapshotURL = url.replace("/views/", "/printerfriendly/");
	newItem.attachments.push({title:"Epicurious.com Snapshot", mimeType:"text/html", url:snapshotURL, snapshot:true});
	newItem.url = url;
	newItem.attachments.push({title:"Epicurious.com Link", snapshot:false, mimeType:"text/html", url:url});

	newItem.complete();
}

function doWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
		} : null;

	var singxpath = ''//div[@id="ingredients"]'';
	var multxpath = ''//table[@class="search-results"]/tbody/tr'';
	if(doc.evaluate(singxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		// single recipe page
		scrape(doc, url);
	} else if (doc.evaluate(multxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var items = new Object();
		var elmtxpath = ''//div[@id="resultstable"]/table[@class="search-results"]/tbody/tr/td[3][@class="name"]/a[@class="hed"]'';
		var elmts = doc.evaluate(elmtxpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		while (elmt = elmts.iterateNext()) {
			var title = elmt.textContent;
			var link = elmt.href;
			if (title && link){
				items[link] = title;
			}
		}
		
		var items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();	
	}
}');

REPLACE INTO translators VALUES ('0dda3f89-15de-4479-987f-cc13f1ba7999', '1.0.0b4.r1', '', '2008-03-24 02:15:00', '0', '100', '4', 'Ancestry.com US Federal Census', 'Elena Razlogova', '^https?://search.ancestry.com/(.*)usfedcen|1890orgcen|1910uscenindex', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
		
	var result = doc.evaluate(''//div[@class="g_container"]/div[@class="g_panelWrap"]/div[@class="g_panelCore"]/div[@class="s_container"]/div[@class="p_rsltList"]'', doc, nsResolver,
	             XPathResult.ANY_TYPE, null).iterateNext();

	var rows = doc.evaluate(''//div[@class="g_container"]/div[@class="g_panelWrap"]/div[@class="g_panelCore"]/div[@class="s_container"]/div[@class="p_rsltList"]/table/tbody/tr[@class="tblrow record"]'', 
				doc, nsResolver, XPathResult.ANY_TYPE, null);
	var row;
	while(row = rows.iterateNext()) {
		links = doc.evaluate(''.//a'', row, nsResolver, XPathResult.ANY_TYPE, null);
		var linkNo=0;
		while(link=links.iterateNext()) {
			linkNo=linkNo+1;
		}
		break;
	}
	
	if(result && linkNo == 2) {
		return "multiple";
	} else {
		var indivRe = /indiv=1/;
		var m = indivRe.exec(doc.location.href);
		var indiv = 0;
		if(m) {
			indiv = 1;
			}

		checkURL = doc.location.href.replace("pf=", "").replace("&h=", "");
		if(doc.location.href == checkURL && indiv == 1) {
			return "bookSection";
		}
	} 
}', 
'// this US Federal Census scraper is a hack - so far there is no proper item type in Zotero for this kind of data (added to trac as a low priority ticket)
// this scraper creates proper citation for the census as a whole (should be cited as book)
// but also adds name, city, and state for a particular individual to the citation to make scanning for names & places easier in the middle pane 
// (that''s why the resulting item type is a book section) 
// it also adds all searchable text as a snapshot and a scan of the census record as an image

function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	// get initial census data; a proper census record item type should have separate fields for all of these except perhaps dbid
	var info = doc.evaluate(''//div[@class="facets"][@id="connect"]/div[@class="g_box"]/p/a'', 
		doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();	
		
	if(info) {	
		
		info = info.toString();
		var data = new Array();
		var parts = info.split(/[?&]/);
		for each(var part in parts) {
			var index = part.indexOf("=");
			if(index !== -1) {
				data[part.substr(0, index)] = part.substr(index+1);
			}
		}
		
		if(data.ln) {
			var lastName = data.ln.replace(/\+/g, " ");
			var firstName = data.fn.replace(/\+/g, " ");
		} else { 
			var lastName = data.fn.replace(/\+/g, " ");
			var firstName = ""; 
		}
		var dOb = data.by; // this does not get saved yet because no field is available; the info is in the snapshot
		if(data.rfd) {
			var yearRe = /([0-9]{4})/;
			var m = yearRe.exec(data.rfd);
			if(m) { 
				var year = m[1];
			}
		} else { var year = data.ry; }
		var state = data.rs.replace(/\+/g, " "); 
		var county = data.rcnty.replace(/\+/g, " "); // this does not get saved yet because no field is available; the info is in the snapshot
		var city = data.rcty.replace(/\+/g, " "); 
		var dbid = data.dbid;
	}
	
	// set census number for citation - let me know if this can be done in a better way
	var censusYear = 0;
	var censusNo = "";
	var censusNos = new Array("1790", "First", "1800", "Second", "1810", "Third", "1820", "Fourth", "1830", "Fifth", "1840", "Sixth", "1850", "Seventh", "1860", "Eighth", "1870", "Ninth", 
			"1880", "Tenth", "1890", "Eleventh", "1900", "Twelfth", "1910", "Thirteenth", "1920", "Fourteenth", "1930", "Fifteenth")
	for(var i in censusNos) {
			if(censusYear == 1) { censusNo = censusNos[i] };
			if(censusNos[i] == year) { censusYear = 1 } else {censusYear= 0 };
		}

	//begin adding item
	var newItem = new Zotero.Item("bookSection");
	newItem.title = city+", "+state; // this is not proper citation but is needed to easily scan for placenames in middle pane
	newItem.publicationTitle = censusNo+" Census of the United States, "+year;
	newItem.publisher = "National Archives and Records Administration";
	newItem.place = "Washington, DC";
	newItem.date = year;
	
	// get snapshot with all searchable text and a simplified link to the record for the URL field
	var dbRe = /db=([0-9a-z]+)/;
	var m = dbRe.exec(doc.location.href);
	if(m) {
		db = m[1];
	}
	var snapshotRe = /recid=([0-9]+)/;
	var m = snapshotRe.exec(doc.location.href);
		if(m) {
		snapshotURL = "http://search.ancestry.com/cgi-bin/sse.dll?db="+db+"&indiv=1&pf=1&recid="+m[1];
		newItem.attachments.push({title:"Ancestry.com Snapshot", mimeType:"text/html", url:snapshotURL, snapshot:true});
		cleanURL = "http://search.ancestry.com/cgi-bin/sse.dll?indiv=1&db="+db+"&recid="+m[1];
		newItem.url = cleanURL;
	}
			
	// add particular individual being surveyed as contributor - this is not proper citation but is needed so one could easily scan for names in middle pane
	var creator = new Array();
	creator.firstName = firstName;
	creator.lastName = lastName;
	creator.creatorType = "author";
	newItem.creators.push(creator);
	
	//add proper author for citation
	var creator = new Array();
	creator.lastName = "United States of America, Bureau of the Census";
	creator.creatorType = "contributor";
	newItem.creators.push(creator);

	// get scan of the census image
	var scanInfo = doc.evaluate(''//div[@id="record-main"]/table[@class="p_recTable"]/tbody/tr/td[2][@class="recordTN"]/a'', 
		doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	
	if(scanInfo) {
		var scanRe = /iid=([A-Z0-9_-]+)/;		
		var m = scanRe.exec(scanInfo);
		if(m) {
			scanURL = "http://content.ancestry.com/Browse/print_u.aspx?dbid="+dbid+"&iid="+m[1];
			Zotero.debug("scan url: " + scanURL);
		}
	}
	
	if(scanURL){
		Zotero.Utilities.HTTP.doGet(scanURL, function(text) { 
			Zotero.debug("running doGet");
			Zotero.debug(text);
			var imageRe = /950  src="([^"]+)"/;
			var m = imageRe.exec(text);
				if(m) {
					imageURL = m[1];
					Zotero.debug("image url: " + imageURL);
					newItem.attachments.push({title:"Ancestry.com Image", mimeType:"image/jpeg", url:imageURL, snapshot:true});
				}
			
			newItem.complete();
			Zotero.done();	
		});	
	} else {
		newItem.complete();
		Zotero.done();
	}
}

function doWeb(doc, url) {
	var resultsRegexp = /recid=/;
	if(resultsRegexp.test(url)) {
		scrape(doc);
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		// get census year for links to items
		var yearRe = /db=([0-9]+)/;
		var m = yearRe.exec(doc.location.href);
		if(m) {
			year = m[1];
		}
		
		var dbRe = /db=([0-9a-z]+)/;
		var m = dbRe.exec(doc.location.href);
		if(m) {
			db = m[1];
		}

		//select items
		var items = new Array();
		var listElts = doc.evaluate(''//div[@class="g_container"]/div[@class="g_panelWrap"]/div[@class="g_panelCore"]/div[@class="s_container"]/div[@class="p_rsltList"]/table/tbody/tr[@class="tblrowalt record"] | //div[@class="g_container"]/div[@class="g_panelWrap"]/div[@class="g_panelCore"]/div[@class="s_container"]/div[@class="p_rsltList"]/table/tbody/tr[@class="tblrow record"]'', 
				doc, nsResolver, XPathResult.ANY_TYPE, null);
		var recid;
		var link;
		var name;
		while (listElt = listElts.iterateNext()) {		
			recInfo = doc.evaluate(''.//a'', listElt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			var recidRe = /recid=([0-9]+)/;
			var m = recidRe.exec(recInfo);
			if(m) {
				recid = m[1];
			}
			link = "http://search.ancestry.com/cgi-bin/sse.dll?indiv=1&db="+db+"&recid="+recid;
			name = doc.evaluate(''.//span[@class="srchHit"]'', listElt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			items[link] = Zotero.Utilities.cleanString(name);
		} 

		items = Zotero.selectItems(items);
		if(!items) return true;

		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();

	}
}');

REPLACE INTO translators VALUES ('838d8849-4ffb-9f44-3d0d-aa8a0a079afe', '1.0.0b3.r1', '', '2008-02-07 21:15:00', 1, 100, 4, 'OCLC WorldCat FirstSearch', 'Simon Kornblith', 'https?://[^/]*firstsearch\.oclc\.org[^/]*/WebZ/',
'function detectWeb(doc, url) {
	var detailRe = /FirstSearch: [\w ]+ Detailed Record/;
	var searchRe = /FirstSearch: [\w ]+ List of Records/;
	
	if(detailRe.test(doc.title)) {
		return "book";
	} else if(searchRe.test(doc.title)) {
		return "multiple";
	}
}',
'function processURLs(urls) {
	if(!urls.length) {	// last url
		Zotero.done();
		return;
	}
	
	var newUrl = urls.shift();
	
	Zotero.Utilities.HTTP.doPost(newUrl,
	''exportselect=record&exporttype=plaintext'', function(text) {
		var lineRegexp = new RegExp();
		lineRegexp.compile("^([\\w() ]+): *(.*)$");
		
		var newItem = new Zotero.Item("book");
		newItem.extra = "";
		
		var lines = text.split(''\n'');
		for(var i=0;i<lines.length;i++) {
			var testMatch = lineRegexp.exec(lines[i]);
			if(testMatch) {
				var match = newMatch;
				var newMatch = testMatch
			} else {
				var match = false;
			}
			
			if(match) {
				// is a useful match
				if(match[1] == ''Title'') {
					var title = match[2];
					if(!lineRegexp.test(lines[i+1])) {
						i++;
						title += '' ''+lines[i];
					}
					if(title.substring(title.length-2) == " /") {
						title = title.substring(0, title.length-2);
					}
					newItem.title = Zotero.Utilities.capitalizeTitle(title);
				} else if(match[1] == "Series") {
					newItem.series = match[2];
				} else if(match[1] == "Description") {
					var pageMatch = /([0-9]+) p\.?/
					var m = pageMatch.exec(match[2]);
					if(m) {
						newItem.pages = m[1];
					}
				} else if(match[1] == ''Author(s)'' || match[1] == "Corp Author(s)") {
					var yearRegexp = /[0-9]{4}-([0-9]{4})?/;
					
					var authors = match[2].split('';'');
					if(authors) {
						newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[0], "author", true));
						for(var j=1; j<authors.length; j+=2) {
							if(authors[j-1].substring(0, 1) != ''('' && !yearRegexp.test(authors[j])) {
								// ignore places where there are parentheses		
								newItem.creators.push({lastName:authors[j], creatorType:"author", fieldMode:true});
							}
						}
					} else {
						newItem.creators.push(Zotero.Utilities.cleanString(match[2]));
					}
				} else if(match[1] == ''Publication'') {
					match[2] = Zotero.Utilities.cleanString(match[2]);
					if(match[2].substring(match[2].length-1) == '','') {
						match[2] = match[2].substring(0, match[2].length-1);
					}
					
					// most, but not all, WorldCat publisher/places are
					// colon delimited
					var parts = match[2].split(/ ?: ?/);
					if(parts.length == 2) {
						newItem.place = parts[0];
						newItem.publisher = parts[1];
					} else {
						newItem.publisher = match[2];
					}
				} else if(match[1] == ''Institution'') {
					newItem.publisher = match[2];
				} else if(match[1] == ''Standard No'') {
					var ISBNRe = /ISBN:\s*([0-9X]+)/
					var m = ISBNRe.exec(match[2]);
					if(m) newItem.ISBN = m[1];
				} else if(match[1] == ''Year'') {
					newItem.date = match[2];
				} else if(match[1] == "Descriptor") {
					if(match[2][match[2].length-1] == ".") {
						match[2] = match[2].substr(0, match[2].length-1);
					}
					
					var tags = match[2].split("--");
					for(var j in tags) {
						newItem.tags.push(Zotero.Utilities.cleanString(tags[j]));
					}
				} else if(match[1] == "Accession No") {
					newItem.accessionNumber = Zotero.Utilities.superCleanString(match[2]);
				} else if(match[1] == "Degree") {
					newItem.itemType = "thesis";
					newItem.thesisType = match[2];
				} else if(match[1] == "DOI") {
					newItem.DOI = match[2];
				} else if(match[1] == "Database") {
					if(match[2].substr(0, 8) != "WorldCat") {
						newItem.itemType = "journalArticle";
					}
				} else if(match[1] != "Availability" &&
				          match[1] != "Find Items About" &&
				          match[1] != "Document Type") {
					newItem.extra += match[1]+": "+match[2]+"\n";
				}
			} else {
				if(lines[i] != "" && lines[i] != "SUBJECT(S)") {
					newMatch[2] += " "+lines[i];
				}
			}
		}
		
		if(newItem.extra) {
			newItem.extra = newItem.extra.substr(0, newItem.extra.length-1);
		}
		
		newItem.complete();
		processURLs(urls);
	}, false, ''iso-8859-1'');
}

function doWeb(doc, url) {
	var sessionRegexp = /(?:\?|\:)sessionid=([^?:]+)(?:\?|\:|$)/;
	var numberRegexp = /(?:\?|\:)recno=([^?:]+)(?:\?|\:|$)/;
	var resultsetRegexp = /(?:\?|\:)resultset=([^?:]+)(?:\?|\:|$)/;
	var hostRegexp = new RegExp("^(https?://[^/]+)/");
		
	var sMatch = sessionRegexp.exec(url);
	var sessionid = sMatch[1];
	
	var hMatch = hostRegexp.exec(url);
	var host = hMatch[1];
	
	var newUri, exportselect;
	
	var detailRe = /FirstSearch: [\w ]+ Detailed Record/;
	if(detailRe.test(doc.title)) {
		var publisherRegexp = /^(.*), (.*?),?$/;
		
		var nMatch = numberRegexp.exec(url);
		if(nMatch) {
			var number = nMatch[1];
		} else {
			number = 1;
		}
		
		var rMatch = resultsetRegexp.exec(url);
		if(rMatch) {
			var resultset = rMatch[1];
		} else {
			// It''s in an XPCNativeWrapper, so we have to do this black magic
			resultset = doc.forms.namedItem(''main'').elements.namedItem(''resultset'').value;
		}
		
		urls = [host+''/WebZ/DirectExport?numrecs=10:smartpage=directexport:entityexportnumrecs=10:entityexportresultset='' + resultset + '':entityexportrecno='' + number + '':sessionid='' + sessionid + '':entitypagenum=35:0''];
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, ''/WebZ/FSFETCH\\?fetchtype=fullrecord'', ''^(See more details for locating this item|Detailed Record)$'');
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		
		for(var i in items) {
			var nMatch = numberRegexp.exec(i);
			var rMatch = resultsetRegexp.exec(i);
			if(rMatch && nMatch) {
				var number = nMatch[1];
				var resultset = rMatch[1];
				urls.push(host+''/WebZ/DirectExport?numrecs=10:smartpage=directexport:entityexportnumrecs=10:entityexportresultset='' + resultset + '':entityexportrecno='' + number + '':sessionid='' + sessionid + '':entitypagenum=35:0'');
			}
		}
	}
	
	processURLs(urls);
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('a2363670-7040-4cb9-8c48-6b96584e92ee', '1.0.0b4.r5', '', '2008-02-08 20:30:00', '0', '100', '4', 'Florida University Libraries (Endeca 1)', 'Sean Takats', '^http://[^/]+/[^\.]+.jsp\?[^/]*(?:Ntt=|NttWRD=)', 
'function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
		} : null;
		
	var xpath = ''//div[starts-with(@id, "briefTitle")]'';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
	if (url.indexOf("&V=D")){
		return "book";
	} else if (url.indexOf("&V=M")){
		return "book";
	} else if (url.indexOf("&V=U")){
		return "book";
	}
}', 
'function doWeb(doc, url){
	var newUris = new Array();
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
		} : null;	
	var xpath = ''//div[starts-with(@id, "briefTitle")]/a'';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var elmt;
	if(elmt = elmts.iterateNext()) {
		// search page
		var items = new Array();
		do {
			items[elmt.href] = Zotero.Utilities.cleanString(elmt.textContent);
			Zotero.debug(elmt.textContent);
		} while (elmt = elmts.iterateNext());
		
		items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		for(var i in items) {
			var newUri = i.replace(/&V=./, "&V=M");
			newUris.push(newUri);
		}
	} else {
		// single page
		var newURL = url.replace(/&V=./, "&V=M");
		newUris.push(newURL);
	}
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	Zotero.Utilities.processDocuments(newUris, function(newDoc) {
		var uri = newDoc.location.href;
		var xpath = ''//tr[@class="trGenContent"][td[3]]'';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		
		var record = new marc.record();
		while(elmt = elmts.iterateNext()) {
			var field = Zotero.Utilities.superCleanString(doc.evaluate(''./TD[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var value = doc.evaluate(''./TD[3]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			
			if(field == "LDR") {
				record.leader = value;
			} else if(field != "FMT") {
				
				Zotero.debug("field=" + field);
				value = value.replace(/\|([a-z]) /g, marc.subfieldDelimiter+"$1");
				
				var code = field.substring(0, 3);
				var ind = "";
				if(field.length > 3) {
					ind = field[3];
					if(field.length > 4) {
						ind += field[4];
					}
				}
				
				record.addField(code, ind, value);
			}
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";
		
		newItem.complete();
	}, function() { Zotero.done(); }, null);
	Zotero.wait();	
}');

REPLACE INTO translators VALUES ('da440efe-646c-4a18-9958-abe1f7d55cde', '1.0.0b4.r1', '', '2008-03-26 03:00:00', '0', '100', '4', 'NCSU Library (Endeca 2)', 'Sean Takats', '^https?://[^\.]+.lib.ncsu.edu/(?:web2/tramp2\.exe|catalog/\?)', 
'function detectWeb(doc, url) { 
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	var xpath = ''//a[contains(text(), "MARC record")]'';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	}
	xpath = ''//span[@class="resultTitle"]/a'';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
}', 
'function scrape(text){
	var tempidRe = new RegExp("/web2/tramp2\.exe/goto/([^?]+)\?");
	var tempidMatch = tempidRe.exec(text);
	var tempid = tempidMatch[1];
	
	marcUri = "http://catalog.lib.ncsu.edu/web2/tramp2.exe/download_hitlist/" + tempid;
	marcUri = marcUri + "/NCSUCatResults.mrc?server=1home&format=MARC&server=1home&item=1&item_source=1home";
	Zotero.Utilities.HTTP.doGet(marcUri, function(text) {
		// load translator for MARC
		var marc = Zotero.loadTranslator("import");
		marc.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
		marc.setString(text);	
		marc.translate();
	}, function() {Zotero.done()}, null);
}

function doWeb(doc, url) { 
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var xpath = ''//span[@class="resultTitle"]/a'';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var elmt;
	if(elmt = elmts.iterateNext()) {
		// search results page
		var newUris = new Array();
		var items = new Array();
		do {
			items[elmt.href] = Zotero.Utilities.cleanString(elmt.textContent);
		} while (elmt = elmts.iterateNext());
		items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		for(var i in items) {
			newUris.push(i);
		}
		Zotero.Utilities.HTTP.doGet(newUris, function(text) { scrape(text) },
			function() {}, null);		
		Zotero.wait();
	} else if (elmt = doc.evaluate(''//a[contains(text(), "MARC record")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		// single book
		scrape(elmt.href);
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('88915634-1af6-c134-0171-56fd198235ed', '1.0.0b3.r1', '', '2008-01-30 07:30:00', '1', '100', '4', 'Library Catalog (Voyager)', 'Simon Kornblith', 'Pwebrecon\.cgi', 
'function detectWeb(doc, url) {
	var export_options = doc.forms.namedItem(''frm'').elements.namedItem(''RD'').options;
	for(var i in export_options) {
		if(export_options[i].text == ''Latin1 MARC''
		|| export_options[i].text == ''Raw MARC''
		|| export_options[i].text == ''MARC 8''
		|| export_options[i].text == ''UTF-8''
		|| export_options[i].text == ''MARC (Unicode/UTF-8)''
		|| export_options[i].text == ''MARC UTF-8''
		|| export_options[i].text == ''UTF-8 MARC (Unicode)''
		|| export_options[i].text == ''UTF8-Unicode''
		|| export_options[i].text == ''MARC (non-Unicode/MARC-8)'') {
			// We have an exportable single record
			if(doc.forms.namedItem(''frm'').elements.namedItem(''RC'')) {
				return "multiple";
			} else {
				return "book";
			}
		}
	}
}', 
'function doWeb(doc, url) {
	var postString = '''';
	var form = doc.forms.namedItem(''frm'');
	var newUri = form.action;
	var multiple = false;
	
	if(doc.forms.namedItem(''frm'').elements.namedItem(''RC'')) {
		multiple = true;
		
		var availableItems = new Object();	// Technically, associative arrays are objects
			
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		// Require link to match this
		var tagRegexp = new RegExp();
		tagRegexp.compile(''Pwebrecon\\.cgi\\?.*v1=[0-9]+\\&.*ti='');
		// Do not allow text to match this
		var rejectRegexp = new RegExp();
		rejectRegexp.compile(''\[ [0-9]+ \]'');
		
		var checkboxes = new Array();
		var urls = new Array();
		
		var tableRows = doc.evaluate(''//form[@name="frm"]//table/tbody/tr[td/input[@type="checkbox"]]'', doc, nsResolver, XPathResult.ANY_TYPE, null);

		// Go through table rows
		var tableRow;
		var i = 0;
		while(tableRow = tableRows.iterateNext()) {
			i++;
			// CHK is what we need to get it all as one file
			var input = doc.evaluate(''./td/input[@name="CHK"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			checkboxes[i] = input.value;
			var links = tableRow.getElementsByTagName("a");
			// Go through links
			for(var j=0; j<links.length; j++) {
				if(tagRegexp.test(links[j].href)) {
					var text = links[j].textContent;
					if(text) {
						text = Zotero.Utilities.cleanString(text);
						if(!rejectRegexp.test(text)) {
							if(availableItems[i]) {
								availableItems[i] += " "+text;
							} else {
								availableItems[i] = text;
							}
						}
					}
				}
			}
			// if no title, pull from second td
			if(!availableItems[i]) {
				availableItems[i] = Zotero.Utilities.cleanString(doc.evaluate(''./td[2]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			}
		}
		
		var items = Zotero.selectItems(availableItems);
		if(!items) {
			return true;
		}
		
		// add arguments for items we need to grab
		for(var i in items) {
			postString += "CHK="+checkboxes[i]+"&";
		}
	}
	
	var raw, unicode, latin1;
	
	for(var i=0; i<form.elements.length; i++) {
		if(form.elements[i].type && form.elements[i].type.toLowerCase() == ''hidden'') {
			postString += escape(form.elements[i].name)+''=''+escape(form.elements[i].value)+''&'';
		}
	}
	
	var export_options = form.elements.namedItem(''RD'').options;
	for(var i=0; i<export_options.length; i++) {
		if(export_options[i].text == ''Raw MARC''
		|| export_options[i].text == ''MARC 8''
		|| export_options[i].text == ''MARC (non-Unicode/MARC-8)'') {
			raw = i;
		}  if(export_options[i].text == ''Latin1 MARC'') {
			latin1 = i;
		} else if(export_options[i].text == ''UTF-8''
		|| export_options[i].text == ''UTF-8 MARC (Unicode)''
		|| export_options[i].text == ''UTF8-Unicode''
		|| export_options[i].text == ''MARC UTF-8''
		|| export_options[i].text == ''MARC (Unicode/UTF-8)'') {
			unicode = i;
		}
	}
	
	if(unicode) {
		var rd = unicode;
	} else if(latin1) {
		var rd = latin1;
	} else if(raw) {
		var rd = raw;
	} else {
		return false;
	}
	
	postString += ''RD=''+rd+''&MAILADDY=&SAVE=Press+to+SAVE+or+PRINT'';
	
	// No idea why this doesn''t work as post
	Zotero.Utilities.HTTP.doGet(newUri+''?''+postString, function(text) {
		// load translator for MARC
		var marc = Zotero.loadTranslator("import");
		marc.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
		marc.setString(text);
		
		// if this is the LOC catalog, specify that in repository field
		if(url.length > 23 && url.substr(0, 23) == "http://catalog.loc.gov/") {
			marc.setHandler("itemDone", function(obj, item) {
				item.repository = "Library of Congress Catalog";
				item.complete();
			});
		} else {
			var domain = url.match(/https?:\/\/([^/]+)/);
			marc.setHandler("itemDone", function(obj, item) {
				item.repository = domain[1]+" Library Catalog";
				item.complete();
			});
		}
		
		marc.translate();
		
		Zotero.done();
	})
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('d921155f-0186-1684-615c-ca57682ced9b', '1.0.0b4.r1', '', '2008-04-04 20:30:00', '1', '100', '4', 'JSTOR', 'Simon Kornblith, Sean Takats and Michael Berkowitz', 'https?://[^/]*jstor\.org[^/]*/(action/(showArticle|doBasicSearch|doAdvancedSearch)|stable/)', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	// See if this is a seach results page
	if(doc.title == "JSTOR: Search Results" || url.indexOf("/stable/i") != -1) {
		return "multiple";
	} else if(url.indexOf("/search/") != -1) {
		return false;
	}
	
	// If this is a view page, find the link to the citation
	var xpath = ''//a[@id="favorites"]'';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if(elmts.iterateNext()) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var hostRegexp = new RegExp("^(https?://[^/]+)/");
	var hMatch = hostRegexp.exec(url);
	var host = hMatch[1];

	// If this is a view page, find the link to the citation
	var xpath = ''//a[@id="favorites"]'';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if(elmts.iterateNext()) {
			var jid;
		var jidRe1 = new RegExp("doi=[0-9\.]+/([0-9]+)");
		var jidRe2 = new RegExp("stable/view/([0-9]+)");
		var jidRe3 = new RegExp("stable/([0-9]+)");
		var jidmatch1 = jidRe1.exec(url);
		var jidmatch2 = jidRe2.exec(url);
		var jidmatch3 = jidRe3.exec(url);
		if (jidmatch1) {
			jid = jidmatch1[1];
		} else if (jidmatch2) {
			jid = jidmatch2[1];
		} else if (jidmatch3) {
			jid = jidmatch3[1];
		} else {
			return false;
		}
		var downloadString = "&noDoi=yesDoi&downloadFileName=deadbeef&suffix="+jid;
	}
	else{
		var availableItems = new Object();
		var tableRows = doc.evaluate(''//li[ul/li/a[@class="title"]]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		var jid;
		var title;
		var jidRe = new RegExp("[0-9\.]+/([0-9]+)");
		while(tableRow = tableRows.iterateNext()) {
			title = doc.evaluate(''./ul/li/a[@class="title"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			jid = doc.evaluate(''.//input[@name="doi"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
			var m = jidRe.exec(jid);
			if (m) {
				jid = m[1];
			}
			availableItems[jid] = title;
		}

		var items = Zotero.selectItems(availableItems);
		if(!items) {
			return true;
		}
		var downloadString="&noDoi=yesDoi&downloadFileName=deadbeef";
		for(var i in items) {
			downloadString+="&suffix="+i;
		}
	}

	Zotero.Utilities.HTTP.doPost(host+"/action/downloadCitation?format=refman&direct=true",
								 downloadString, function(text) {
		// load translator for RIS
		Zotero.debug(text);
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			if(item.notes && item.notes[0]) {
				item.extra = item.notes[0].note;

				delete item.notes;
				item.notes = undefined;
			}
			item.attachments[0].title = item.title;
			item.attachments[0].mimeType = "text/html";
			Zotero.debug(host);
			var pdfurl = item.url.replace(/([^\d]+)(\d+)$/, host + "/stable/pdfplus/$2") + ".pdf";
			item.attachments.push({url:pdfurl, title:"JSTOR Full Text PDF", mimeType:"application/pdf"});
			item.complete();
		});
		
		translator.translate();

		Zotero.done();
	});

}');

REPLACE INTO translators VALUES ('e8fc7ebc-b63d-4eb3-a16c-91da232f7220', '1.0.0b4.r5', '', '2008-02-12 10:00:00', '0', '100', '4', 'Aluka', 'Sean Takats', 'https?://(?:www\.)aluka.org/action/(?:showMetadata\?doi=[^&]+|doSearch\?|doBrowseResults\?)', 
'function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
		
	var xpath = ''//a[@class="title"]'';

	if (url.match(/showMetadata\?doi=[^&]+/)){
		return "document";
	} else if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
}', 
'// Aluka types we can import
// TODO: Improve support for other Aluka item types?
// Correspondence, Circulars, Newsletters, Interviews, Pamphlets, Policy Documents, Posters, Press Releases, Reports, Testimonies, Transcripts
var typeMap = {
	"Books":"book",
	"Aluka Essays":"report",
	"photograph":"artwork",
	"Photographs":"artwork",
	"Panoramas":"artwork",
	"Journals (Periodicals)":"journalArticle",
	"Articles":"journalArticle",
	"Correspondence":"letter",
	"Interviews":"interview",
	"Reports":"report"
}

function doWeb(doc, url){
	var urlString = "http://www.aluka.org/action/showPrimeXML?doi=" ;
	var uris = new Array();
	var m = url.match(/showMetadata\?doi=([^&]+)/);
	if (m) { //single page
		uris.push(urlString+ m[1]);
	} else { //search results page
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
		} : null;
			
		var xpath = ''//a[@class="title"]'';
		var items = new Object();
		var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		while (elmt = elmts.iterateNext()) {
			var title = elmt.textContent;
			var link = elmt.href;
			var m = link.match(/showMetadata\?doi=([^&]+)/);
			if (title && m){
				items[m[1]] = title;
			}
		}
		
		var items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			uris.push(urlString + i);
		}
	}
	// http://www.aluka.org/action/showPrimeXML?doi=10.5555/AL.SFF.DOCUMENT.cbp1008

	Zotero.Utilities.HTTP.doGet(uris, function(text) {
		text = text.replace(/<\?xml[^>]*\?>/, ""); // strip xml header
		text = text.replace(/(<[^>\.]*)\.([^>]*>)/g, "$1_$2");	// replace dots in tags with underscores
		var xml = new XML(text);
		var metadata = xml..MetadataDC;
		var itemType = "Unknown";
		if (metadata.length()){
			itemType = "document";
			if (metadata[0].Type.length()){
				var value = metadata[0].Type[0].text().toString();
				if(typeMap[value]) {
					itemType = typeMap[value];
				} else {
					Zotero.debug("Unmapped Aluka Type: " + value);
				}		
			}
			var newItem = new Zotero.Item(itemType);
			var title = "";
			if (metadata[0].Title.length()){
				var title = Zotero.Utilities.trimInternal(metadata[0].Title[0].text().toString());
				if (title == ""){
					title = " ";
				}
				newItem.title = title;
			}
			if (metadata[0].Title_Alternative.length()){
				newItem.extra = Zotero.Utilities.trimInternal(metadata[0].Title_Alternative[0].text().toString());
			}
			for(var i=0; i<metadata[0].Subject_Enriched.length(); i++) {
				newItem.tags.push(Zotero.Utilities.trimInternal(metadata[0].Subject_Enriched[i].text().toString()));
			}
			for(var i=0; i<metadata[0].Coverage_Spatial.length(); i++) {
				newItem.tags.push(Zotero.Utilities.trimInternal(metadata[0].Coverage_Spatial[i].text().toString()));
			}
			for(var i=0; i<metadata[0].Coverage_Temporal.length(); i++) {
				newItem.tags.push(Zotero.Utilities.trimInternal(metadata[0].Coverage_Temporal[i].text().toString()));
			}
//	TODO: decide whether to uncomment below code to import species data as tags
//			for(var i=0; i<xml..TopicName.length(); i++) {
//				newItem.tags.push(Zotero.Utilities.trimInternal(xml..TopicName[i].text().toString()));
//			}

			if (metadata[0].Date.length()){
				var date = metadata[0].Date[0].text().toString();
				if (date.match(/^\d{8}$/)){
					date = date.substr(0, 4) + "-" + date.substr(4, 2) + "-" + date.substr(6, 2);
				}
				newItem.date = date;
			}
			if (metadata[0].Creator.length()){
				var authors = metadata[0].Creator;
				var type = "author";
				for(var j=0; j<authors.length(); j++) {
					Zotero.debug("author: " + authors[j]);
					newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j].text().toString(),type,true));
				}
			}
			if (metadata[0].Contributor.length()){
				var authors = metadata[0].Contributor;
				var type = "contributor";
				for(var j=0; j<authors.length(); j++) {
					Zotero.debug("author: " + authors[j]);
					newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j].text().toString(),type,true));
				}
			}
			if (metadata[0].Publisher.length()){
				newItem.publisher = Zotero.Utilities.trimInternal(metadata[0].Publisher[0].text().toString());
			}
			if (metadata[0].Format_Medium.length()){
				newItem.medium = Zotero.Utilities.trimInternal(metadata[0].Format_Medium[0].text().toString());
			}
			if (metadata[0].Language.length()){
				newItem.language = Zotero.Utilities.trimInternal(metadata[0].Language[0].text().toString());
			}	
			if (metadata[0].Description.length()){
				newItem.abstractNote = metadata[0].Description[0].text().toString();
			}
			if (metadata[0].Format_Extent.length()){
				newItem.pages = Zotero.Utilities.trimInternal(metadata[0].Format_Extent[0].text().toString());
			}
			var doi = xml..DOI;
			if (doi.length()){
				newItem.DOI = doi[0];
				var newUrl = "http://www.aluka.org/action/showMetadata?doi=" + doi[0];
				newItem.attachments.push({title:"Aluka Link", snapshot:false, mimeType:"text/html", url:newUrl});
				var pdfUrl = "http://ts-den.aluka.org/delivery/aluka-contentdelivery/pdf/" + doi[0] + "?type=img&q=high";
				newItem.attachments.push({url:pdfUrl});
				newItem.url = newUrl;
			}
			var rights = xml..Rights.Attribution;
			if (rights.length()){
				newItem.rights = rights[0];
			}
			if (metadata[0].Rights.length()){
				newItem.rights = Zotero.Utilities.trimInternal(metadata[0].Rights[0].text().toString());
			}
			if (metadata[0].Source.length()){
				newItem.repository = "Aluka: " + Zotero.Utilities.trimInternal(metadata[0].Source[0].text().toString());
			}
			if (metadata[0].Relation.length()){
				newItem.callNumber = Zotero.Utilities.trimInternal(metadata[0].Relation[0].text().toString());
			}
			newItem.complete();
		} else {
			Zotero.debug("No Dublin Core XML data");
			return false;
		}
		Zotero.done();
	});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('e85a3134-8c1a-8644-6926-584c8565f23e', '1.0.0b4.r1', '', '2008-01-13 19:30:00', '1', '100', '4', 'History Cooperative', 'Simon Kornblith', 'https?://[^/]*historycooperative\.org[^/]*/(?:journals/.+/.+/.+\.s?html$|cgi-bin/search.cgi|journals/.+/.+/)', 
'function detectWeb(doc, url) {
	var contents = doc.title.replace("Contents", "");
	if(doc.title != contents || doc.title == "History Cooperative: Search Results") {
		return "multiple";
	} else {
		return "journalArticle";
	}
}', 
'function associateMeta(newItem, metaTags, field, zoteroField) {
	var field = metaTags.namedItem(field);
	if(field) {
		newItem[zoteroField] = field.getAttribute("content");
	}
}

function scrape(doc) {
	var newItem = new Zotero.Item("journalArticle");
	newItem.url = doc.location.href;
	
	var month, year;
	var metaTags = doc.getElementsByTagName("meta");
	
	// grab title without using meta tag, since when titles have quotes History
	// Cooperative can''t create a proper meta tag
	var titleRe = /<!--_title_-->(.*)<!--_\/title_-->/;
	var m = titleRe.exec(doc.getElementsByTagName("body")[0].innerHTML);
	if(m) {
		newItem.title = m[1];
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
	
		var bookTitle = doc.evaluate(''/html/body/form/table/tbody/tr/td[3]/table/tbody/tr/td/i'',
			doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();	
		bookTitle = bookTitle.textContent;
		newItem.title = "Review of "+bookTitle;
	}
	
	associateMeta(newItem, metaTags, "Journal", "publicationTitle");
	associateMeta(newItem, metaTags, "Volume", "volume");
	associateMeta(newItem, metaTags, "Issue", "issue");
	
	var author = metaTags.namedItem("Author");
	if(author) {
		var authors = author.getAttribute("content").split(" and ");
		for(j in authors) {
			authors[j] = authors[j].replace("Reviewed by ", "");
			newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j], "author"));
		}
	}
	
	var month = metaTags.namedItem("PublicationMonth");
	var year = metaTags.namedItem("PublicationYear");
	if(month && year) {
		newItem.date = month.getAttribute("content")+" "+year.getAttribute("content");
	}
	
	newItem.attachments.push({document:doc, title:"History Cooperative Snapshot"});
	
	newItem.complete();
}

function doWeb(doc, url) {
	var contents = doc.title.replace(" Contents | ", "");
	if(doc.title != contents || doc.title == "History Cooperative: Search Results") {
		var items = Zotero.Utilities.getItemArray(doc, doc, ''^https?://[^/]+/journals/.+/.+/.+\.html$'');
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			uris.push(i);
		}
		
		Zotero.Utilities.processDocuments(uris, function(doc) { scrape(doc) },
			function() { Zotero.done(); }, null);
		
		Zotero.wait();
	} else {
		scrape(doc);
	}
}');

REPLACE INTO translators VALUES ('4c9dbe33-e64f-4536-a02f-f347fa1f187d', '1.0.0b4.r5', '', '2008-04-03 19:45:00', '0', '100', '4', 'BioInfoBank', 'Michael Berkowitz', 'http://lib.bioinfo.pl/', 
'function detectWeb(doc, url) {
	return "multiple";
}', 
'function doWeb(doc, url) {
	var pmids = new Array();
	var items = new Object();
	var titles = doc.evaluate(''//div[@class="css_pmid"]/div[@class="css_pmid_title"]/a'', doc, null, XPathResult.ANY_TYPE, null);
	var title;
	while (title = titles.iterateNext()) {
		items[title.href] = Zotero.Utilities.trimInternal(title.textContent);
	}
	items = Zotero.selectItems(items);
	for (var i in items) {
		pmids.push(i.match(/pmid:(\d+)/)[1]);
	}
	var newUri = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=PubMed&retmode=xml&rettype=citation&id="+pmids.join(",");
	Zotero.Utilities.HTTP.doGet(newUri, function(text) {
		// Remove xml parse instruction and doctype
		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");

		var xml = new XML(text);
		for(var i=0; i<xml.PubmedArticle.length(); i++) {
			var newItem = new Zotero.Item("journalArticle");

			var citation = xml.PubmedArticle[i].MedlineCitation;

			var PMID = citation.PMID.text().toString();
			newItem.extra = "PMID: "+PMID;
			// add attachments
			if(doc) {
				newItem.attachments.push({document:doc, title:"PubMed Snapshot"});
			} else {
				var url = "http://www.ncbi.nlm.nih.gov/entrez/query.fcgi?db=pubmed&cmd=Retrieve&dopt=AbstractPlus&list_uids="+PMID;
				newItem.attachments.push({url:url, title:"PubMed Snapshot",
							 mimeType:"text/html"});
			}

			var article = citation.Article;
			if(article.ArticleTitle.length()) {
				var title = article.ArticleTitle.text().toString();
				if(title.substr(-1) == ".") {
					title = title.substring(0, title.length-1);
				}
				newItem.title = title;
			}

			if (article.Pagination.MedlinePgn.length()){
				newItem.pages = article.Pagination.MedlinePgn.text().toString();
			}

			if(article.Journal.length()) {
				var issn = article.Journal.ISSN.text().toString();
				if(issn) {
					newItem.ISSN = issn.replace(/[^0-9]/g, "");
				}

				newItem.journalAbbreviation = Zotero.Utilities.superCleanString(citation.MedlineJournalInfo.MedlineTA.text().toString());
				if(article.Journal.Title.length()) {
					newItem.publicationTitle = Zotero.Utilities.superCleanString(article.Journal.Title.text().toString());
				} else if(citation.MedlineJournalInfo.MedlineTA.length()) {
					newItem.publicationTitle = newItem.journalAbbreviation;
				}

				if(article.Journal.JournalIssue.length()) {
					newItem.volume = article.Journal.JournalIssue.Volume.text().toString();
					newItem.issue = article.Journal.JournalIssue.Issue.text().toString();
					if(article.Journal.JournalIssue.PubDate.length()) {	// try to get the date
						if(article.Journal.JournalIssue.PubDate.Day.text().toString() != "") {
							newItem.date = article.Journal.JournalIssue.PubDate.Month.text().toString()+" "+article.Journal.JournalIssue.PubDate.Day.text().toString()+", "+article.Journal.JournalIssue.PubDate.Year.text().toString();
						} else if(article.Journal.JournalIssue.PubDate.Month.text().toString() != "") {
							newItem.date = article.Journal.JournalIssue.PubDate.Month.text().toString()+" "+article.Journal.JournalIssue.PubDate.Year.text().toString();
						} else if(article.Journal.JournalIssue.PubDate.Year.text().toString() != "") {
							newItem.date = article.Journal.JournalIssue.PubDate.Year.text().toString();
						}
					}
				}
			}

			if(article.AuthorList.length() && article.AuthorList.Author.length()) {
				var authors = article.AuthorList.Author;
				for(var j=0; j<authors.length(); j++) {
					var lastName = authors[j].LastName.text().toString();
					var firstName = authors[j].FirstName.text().toString();
					if(firstName == "") {
						var firstName = authors[j].ForeName.text().toString();
					}
					if(firstName || lastName) {
						newItem.creators.push({lastName:lastName, firstName:firstName});
					}
				}
			}
			
			
			if (citation.MeshHeadingList && citation.MeshHeadingList.MeshHeading) {
				var keywords = citation.MeshHeadingList.MeshHeading;
				for (var k = 0 ; k < keywords.length() ; k++) {
					newItem.tags.push(keywords[k].DescriptorName.text().toString());
				}
			}
			newItem.abstractNote = article.Abstract.AbstractText.toString()
			
			newItem.complete();
		}

		Zotero.done();
	});
}');

REPLACE INTO translators VALUES ('2e43f4a9-d2e2-4112-a6ef-b3528b39b4d2', '1.0.0b4.r5', '', '2008-04-03 19:35:00', '1', '100', '4', 'MIT Press Journals', 'Michael Berkowitz', 'http://www.mitpressjournals.org/', 
'function detectWeb(doc, url) {
	if (url.match(/action\/doSearch/) || url.match(/toc\//)) {
		return "multiple";
	} else if (url.match(/doi\/abs\//)) {
		return "journalArticle";
	}
}', 
'function getDOI(str) {
	return str.match(/doi\/abs\/([^?]+)/)[1];
}
	
function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var links = doc.evaluate(''//table[@class="articleEntry"]/tbody/tr//a[text() = "First Page" or text() = "Citation"]'', doc, null, XPathResult.ANY_TYPE, null);
		var titles = doc.evaluate(''//table[@class="articleEntry"]/tbody/tr//div[@class="arttitle"]'', doc, null, XPathResult.ANY_TYPE, null);
		var link, title;
		while ((link = links.iterateNext()) && (title = titles.iterateNext())) {
			items[link.href] = Zotero.Utilities.trimInternal(title.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(getDOI(i));
		}
	} else {
		articles = [getDOI(url)];
	}
	for each (var doi in articles) {
		var risurl = ''http://www.mitpressjournals.org/action/downloadCitation?doi='' + doi + ''&include=cit&format=refman&direct=on&submit=Download+article+metadata'';
		var pdfurl = ''http://www.mitpressjournals.org/doi/pdf/'' + doi;
		var newurl = ''http://www.mitpressjournals.org/doi/abs/'' + doi;
		Zotero.Utilities.processDocuments([newurl], function(newDoc) {
			var abs = Zotero.Utilities.trimInternal(newDoc.evaluate(''//div[@class="abstractSection"]/p[@class="last"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			Zotero.Utilities.HTTP.doGet(risurl, function(text) {
				Zotero.debug(text);
				var translator = Zotero.loadTranslator("import");
				translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				translator.setString(text);
				translator.setHandler("itemDone", function(obj, item) {
					item.DOI = item.DOI.substr(4);
					item.attachments[0].title= item.publicationTitle + " Snapshot";
					item.attachments[0].mimeType = "text/html";
					item.attachments.push({url:pdfurl, title:item.publicationTitle + " Full Text PDF", mimeType:"application/pdf"});
					//http://www.mitpressjournals.org/doi/pdf/10.1162/afar.2008.41.1.1
					item.abstractNote = abs;
					item.complete();	
				});
				translator.translate();
			});
		}, function() {Zotero.done;});
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('b0abb562-218c-4bf6-af66-c320fdb8ddd3', '1.0.0b4.r5', '', '2008-04-01 04:50:00', '0', '100', '4', 'Philosopher''s Imprint', 'Michael Berkowitz', 'http://quod.lib.umich.edu/cgi/t/', 
'function detectWeb(doc, url) {
	if (doc.evaluate(''//div/span[text() = "Search Results"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.match(/\d+\.\d+\.\d+/)) {
		return "journalArticle";
	}
}', 
'function getID(str) {
	return str.match(/\d+\.\d+\.\d+/)[0];
}
function doWeb(doc, url) {
	var ids = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var titles = doc.evaluate(''//div[@class="itemcitation"]//a'', doc, null, XPathResult.ANY_TYPE, null);
		var title;
		while (title = titles.iterateNext()) {
			items[title.href] = title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			ids.push(''http://quod.lib.umich.edu/cgi/t/text/text-idx?c=phimp;view=text;rgn=main;idno='' + getID(i));
		}
	} else {
		ids = [''http://quod.lib.umich.edu/cgi/t/text/text-idx?c=phimp;view=text;rgn=main;idno='' + getID(url)];
	}
	Zotero.Utilities.processDocuments(ids, function(newDoc) {
		var rows = newDoc.evaluate(''//tr[td[@id="labelcell"]]'', newDoc, null, XPathResult.ANY_TYPE, null);
		var row;
		var data = new Object();
		while (row = rows.iterateNext()) {
			var heading = newDoc.evaluate(''./td[1]'', row, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var value = newDoc.evaluate(''./td[2]'', row, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			data[heading.replace(/[\s:]/g, "")] = value;
		}
		var item = new Zotero.Item("journalArticle");
		item.title = Zotero.Utilities.trimInternal(data[''Title'']);
		if (data[''Author'']) {
			item.creators.push(Zotero.Utilities.cleanAuthor(data[''Author''], "author"));
		} else if (data[''Authors'']) {
			var authors = data[''Authors''].split(",");
			for each (var a in authors) {
				item.creators.push(Zotero.Utilities.cleanAuthor(a, "author"));
			}
		}
		if (data[''Keywords'']) {
			var kws = data[''Keywords''].split(/\n/);
			for each (var kw in kws) {
				if (kw != "") item.tags.push(kw);
			}
		}
		var voliss = data[''Source''].replace(item.title, "");
		if (item.creators.length > 1) {
			voliss = voliss.replace(data[''Authors''], "");
		} else if (item.creators.length == 1) {
			voliss = voliss.replace(data[''Author''], "");
		}
		Zotero.debug(voliss);
		item.volume = voliss.match(/vol\.\s+(\d+)/)[1];
		item.issue = voliss.match(/no\.\s+(\d+)/)[1];
		item.pages = voliss.match(/pp\.\s+([\d\-]+)/)[1];
		item.date = Zotero.Utilities.trimInternal(voliss.match(/[^,]+$/)[0]);
		item.place = "Ann Arbor, MI";
		item.publisher = "University of Michigan";
		item.abstractNote = data[''Abstract''];
		item.url = data[''URL''];
		item.attachments = [
			{url:item.url, title:item.title + " Snapshot", mimeType:"text/html"},
			{url:''http://quod.lib.umich.edu/p/phimp/images/'' + getID(item.url) + ''.pdf'', title:"Philosopher''s Imprint Full Text PDF", mimeType:"application/pdf"}
		];
		item.complete();
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('2a5dc3ed-ee5e-4bfb-baad-36ae007e40ce', '1.0.0b4.r5', '', '2008-04-01 04:50:00', '0', '100', '4', 'Berkeley Electronic Press', 'Michael Berkowitz', 'http://www.bepress.com/', 
'function detectWeb(doc, url) {
	if (url.match("cgi/query.cgi")) {
		return "multiple";
	} else if (url.match(/vol[\d+]\/iss[\d]+/)) {
		return "journalArticle";
	}
}', 
'var tagMap = {
	journal_title:"publicationTitle",
	title:"title",
	date:"date",
	volume:"volume",
	issue:"issue",
	abstract_html_url:"url",
	doi:"DOI"
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
	} : null;

	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var titles = doc.evaluate(''//table[@id="query"]/tbody/tr/td[4]/a'', doc, nsResolver, XPathResult.ANY_TYPE, null);
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
	Zotero.debug(articles);
	Zotero.Utilities.processDocuments(articles, function(newDoc) {
		var metatags = new Object();
		var metas = newDoc.evaluate(''//meta[contains(@name, "bepress_citation")]'', newDoc, null, XPathResult.ANY_TYPE, null);
		var next_meta;
		while (next_meta = metas.iterateNext()) {
			metatags[next_meta.name.replace("bepress_citation_", "")] = next_meta.content;
		}
		var item = new Zotero.Item("journalArticle");
		
		//regularly mapped tags
		for (var tag in tagMap) {
			if (metatags[tag]) {
				item[tagMap[tag]] = metatags[tag];
			}
		}
		
		//authors
		var authors = metatags[''authors''].split(";");
		for each (var author in authors) {
			item.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
		
		//attachments
		item.attachments = [
			{url:item.url, title:item.title, mimeType:"text/html"},
			{url:metatags[''pdf_url''], title:"Berkeley Electronic Press Full Text PDF", mimeType:"application/pdf"}
		];
		item.complete();
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('7cb0089b-9551-44b2-abca-eb03cbf586d9', '1.0.0b4.r5', '', '2008-03-30 08:00:00', '0', '100', '4', 'BioOne', 'Michael Berkowitz', 'http://[^/]*www.bioone.org[^/]*/', 
'function detectWeb(doc, url) {
	if (url.indexOf("searchtype") != -1) {
		return "multiple";
	} else if (url.indexOf("get-document") != -1 || url.indexOf("get-abstract") != -1) {
		return "journalArticle";
	}
}', 
'function createCitationURL(str) {
	str = str.match(/doi=([^&]+)/)[1];
	return "http://www.bioone.org/perlserv/?request=cite-builder&doi=" + str;
}

function getPDFurl(item) {
	var bits = new Array(
		item.DOI.match(/\/([^(]+)\(/)[1],
		item.volume,
		item.issue,
		item.pages.match(/^([^-]+)\-/)[1]
	);
	return "http://www.bioone.org/archive/" + bits.slice(0,3).join("/") + "/pdf/i" + bits.join("-") + ".pdf";
}

function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var results = doc.evaluate(''//div[@class="content"]/table/tbody/tr/td[3][@class="group"]'', doc, null, XPathResult.ANY_TYPE, null);
		var next_result;
		while (next_result = results.iterateNext()) {
			var title = doc.evaluate(''.//span[@class="title"]'', next_result, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var link = doc.evaluate(''.//tr[4]/td/a[1]'', next_result, null, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(createCitationURL(i));
		}
	} else {
		articles = [createCitationURL(url)];
	}
	Zotero.debug(articles);
	Zotero.Utilities.processDocuments(articles, function(newDoc) {
		var newlink = newDoc.evaluate(''//a[contains(@href, "refman")]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		Zotero.Utilities.HTTP.doGet(newlink, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.url = decodeURIComponent(item.url);
				item.DOI = item.url.match(/http:\/\/dx\.doi\.org\/(.*)$/)[1];
				var pdfurl = getPDFurl(item);
				item.attachments = [
					{url:item.url, title:item.title, mimeType:"text/html"},
					{url:pdfurl, title:"BioOne Full Text PDF", mimeType:"application/pdf"}
				];
				item.complete();
			});
			translator.translate();
		});
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('b8a86e36-c270-48c9-bdd1-22aaa167ef46', '1.0.0b4.r5', '', '2008-03-30 08:00:00', '0', '100', '4', 'Agencia del ISBN', 'Michael Berkowitz', 'http://www.mcu.es/cgi-brs/BasesHTML', 
'function detectWeb(doc, url) {
	if (doc.evaluate(''//div[@id="formularios"]/div[@class="isbnResultado"]/div[@class="isbnResDescripcion"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate(''//div[@id="fichaISBN"]/table/tbody/tr'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	}
}', 
'function doWeb(doc, url) {
	var books = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var boxes = doc.evaluate(''//div[@id="formularios"]/div[@class="isbnResultado"]/div[@class="isbnResDescripcion"]'', doc, null, XPathResult.ANY_TYPE, null);
		var box;
		while (box = boxes.iterateNext()) {
			var book = doc.evaluate(''./p/span/strong/a'', box, null, XPathResult.ANY_TYPE, null).iterateNext();
			items[book.href] = book.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			books.push(i);
		}
	} else {
		books = [url];
	}
	Zotero.Utilities.processDocuments(books, function(newDoc) {
		var data = new Object();
		var rows = newDoc.evaluate(''//div[@id="fichaISBN"]/table/tbody/tr'', newDoc, null, XPathResult.ANY_TYPE, null);
		var next_row;
		while (next_row = rows.iterateNext()) {
			var heading = newDoc.evaluate(''./th'', next_row, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var value = newDoc.evaluate(''./td'', next_row, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			data[heading] = Zotero.Utilities.trimInternal(value);
		}
		var isbn = Zotero.Utilities.trimInternal(newDoc.evaluate(''//span[@class="cabTitulo"]/strong'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var item = new Zotero.Item("book");
		item.ISBN = isbn;
		item.title = data[''Título:''];
		author = data[''Autor:''];
		if (author) {
			if (author.match(/tr\.$/)) {
				item.creators.push(Zotero.Utilities.cleanAuthor(author.match(/([\w\s,]+)/)[1], "author"));
				if (author.match(/\[([^\]]+)\]/)) {
					item.creators.push(Zotero.Utilities.cleanAuthor(author.match(/\[([^\]]+)\]/)[1], "translator"));
				} else {
					item.creators.push(Zotero.Utilities.cleanAuthor(author.match(/\)(.*)tr\./)[1], "translator"));
				}
			} else {
				item.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
			}
		}
		if (data[''Publicación:'']) {
			var pub = data[''Publicación:''].match(/([^.]+)\.([\D]+)([\d\/]+)$/);
			item.place = pub[1];
			item.publisher = Zotero.Utilities.trimInternal(pub[2]).replace(/[\s,]+$/, "");
			item.date = pub[3];
		}
		item.complete();
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('a14ac3eb-64a0-4179-970c-92ecc2fec992', '1.0.0b4.r5', '', '2008-04-01 04:50:00', '1', '100', '4', 'Scopus', 'Michael Berkowitz', 'http://[^/]*www.scopus.com[^/]*', 
'function detectWeb(doc, url) {
	if (url.indexOf("/results/") != -1) {
		return "multiple";
	} else if (url.indexOf("/record/") != -1) {
		return "journalArticle";
	}
}', 
'function getEID(url) {
	return url.match(/eid=([^&]+)/)[1];
}

function returnURL(eid) {
	return ''http://www.scopus.com/scopus/citation/output.url?origin=recordpage&eid='' + eid + ''&src=s&view=CiteAbsKeywsRefs'';
}


function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
	} : null;

	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		items = new Object();
		var boxes = doc.evaluate(''//table/tbody/tr[@class]/td[@class="fldtextPad"][1]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var box;
		while (box = boxes.iterateNext()) {
			var title = Zotero.Utilities.trimInternal(doc.evaluate(''.//span[@class="txtBoldOnly"]'', box, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var link = doc.evaluate(''.//a[@class="outwardLink"]'', box, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(returnURL(getEID(i)));
		}
	} else {
		articles = [returnURL(getEID(url))];
	}
	Zotero.Utilities.processDocuments(articles, function(newDoc) {
		var eid = getEID(newDoc.location.href);
		var stateKey = newDoc.evaluate(''//input[@name="stateKey"]'', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
		var get = ''http://www.scopus.com/scopus/citation/export.url'';
		var post = ''origin=recordpage&sid=&src=s&stateKey='' + stateKey + ''&eid='' + eid + ''&sort=&exportFormat=RIS&view=CiteAbsKeyws&selectedCitationInformationItemsAll=on'';
		Zotero.Utilities.HTTP.doPost(get, post, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				if (item.notes[0][''note'']) {
					item.abstractNote = item.notes[0][''note''];
					item.notes = new Array();
					item.complete();
				}
			});
			translator.translate();
		});
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('e1140aa1-3bcf-4226-9099-78ef0b63bb3e', '1.0.0b4.r5', '', '2008-03-19 16:00:00', '0', '100', '4', 'Osterreichischer Bibliothekenverbund', 'Michael Berkowitz', 'http://meteor.bibvb.ac.at/F', 
'function detectWeb(doc, url) {
	if (doc.evaluate(''//td[@class="bar"]/a[@class="blue"]/img'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	} else if (doc.title.indexOf("Ergebnisliste") != -1) {
		return "multiple";
	}
}', 
'function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var itemRegexp = ''^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=999|func=direct)''
		var items = Zotero.Utilities.getItemArray(doc, doc, itemRegexp, ''^[0-9]+$'');
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		} 
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(newDoc) {
		var link = newDoc.evaluate(''//td[@class="bar"]/a[@class="blue"][2]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		link = link.replace(/full\-mail[^&]+&/, "full-mail&") + "&option_type=&format=777&encoding=UTF_TO_WEB_MAIL+++++&SUBJECT=&NAME=&EMAIL=&x=17&y=7";
		Zotero.Utilities.loadDocument([link], function(newDoc2) {
			var newest = newDoc2.evaluate(''/html/body/p[@class="text3"]/a'', newDoc2, null, XPathResult.ANY_TYPE, null).iterateNext().href;
			Zotero.Utilities.HTTP.doGet(newest, function(text) {
				var translator = Zotero.loadTranslator("import");
				translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				translator.setString(text);
				translator.setHandler("itemDone", function(obj, item) {
					item.itemType = "book";
					item.complete();
				});
				translator.translate();
			});
		});
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('4654c76f-451c-4ae6-9a36-575e982b3cdb', '1.0.0b4.r5', '', '2008-03-14 19:10:00', '0', '100', '4', 'Investigative Ophthalmology and Visual Science', 'Michael Berkowitz', 'http://www.iovs.org/', 
'function detectWeb(doc, url) {
	if (doc.title.indexOf("Table of Contents") != -1 || doc.title.indexOf("Search Result") != -1) {
		return "multiple"
	} else if (url.indexOf("abstract") != -1 || url.indexOf("full") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var host = doc.location.host;
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.title.indexOf("Search Result") != -1) {
			var boxes = doc.evaluate(''//table/tbody/tr/td/font/table/tbody/tr[1]'', doc, null, XPathResult.ANY_TYPE, null);
			var box;
			while (box = boxes.iterateNext()) {
				var id = doc.evaluate(''.//input'', box, null, XPathResult.ANY_TYPE, null).iterateNext().value;
				var titles = doc.evaluate(''./td/font/strong'', box, null, XPathResult.ANY_TYPE, null);
				var titletext = '''';
				var title;
				while (title = titles.iterateNext()) {
					titletext += title.textContent;
				}
				items[id] = titletext;
			}
		} else if (doc.title.indexOf("Table of Content") != -1) {
			var ids = doc.evaluate(''/html/body/form/dl/dt/input'', doc, null, XPathResult.ANY_TYPE, null);
			var titles = doc.evaluate(''/html/body/form/dl/dd/strong'', doc, null, XPathResult.ANY_TYPE, null);
			var id;
			var title;
			while ((title = titles.iterateNext()) && (id = ids.iterateNext())) {
				items[''iovs;'' + id.value] = title.textContent;
			}
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [doc.evaluate(''//a[contains(@href, "citmgr")]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href.match(/=(.*)$/)[1]]
	}
	Zotero.debug(arts);
	for each (var id in arts) {
		var post = ''type=refman&gca='' + id;
		Zotero.debug(post);
		post = ''http://www.iovs.org/cgi/citmgr?'' + post;
		Zotero.debug(post);
		Zotero.Utilities.HTTP.doGet(post, function(text) {
			Zotero.debug(text);
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				var pdfurl = item.url.replace(/content\/[^/]+/, "reprint") + ".pdf";
				item.attachments = [
					{url:item.url, title:"IOVS Snapshot", mimeType:"text/html"},
					{url:pdfurl, tite:"IOVS Full Text PDF", mimeType:"application/pdf"}
				];
				if (item.notes[0][''note''].match(/\d/)) {
					item.DOI = item.notes[0][''note''];
					item.notes = new Array();
				}
				item.complete();
			});
			translator.translate();
			
			Zotero.done();		
		});
	}
}');

REPLACE INTO translators VALUES ('62c0e36a-ee2f-4aa0-b111-5e2cbd7bb5ba', '1.0.0b4.r5', '', '2008-03-13 22:30:00', '0', '100', '4', 'MetaPress', 'Michael Berkowitz', 'https?://(.*).metapress.com/', 
'function detectWeb(doc, url) {
	if (doc.title.indexOf("Search Results") != -1) {
		return "multiple";
	} else if (url.match(/content\/[^?/]/)) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var host = doc.location.host;
	var artids = new Array();
	if (detectWeb(doc, url) == "multiple") {
		
	} else {
		artids.push(url.match(/content\/([^/]+)/)[1]);
	}
	for (var i in artids) {
		var newurl = ''http://'' + host + ''/content/'' + artids[i];
		Zotero.Utilities.processDocuments([newurl], function(newDoc) {
			var tagsx = ''//td[@class="mainPageContent"]/div[3]'';
			if (doc.evaluate(tagsx, doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
				var tags = Zotero.Utilities.trimInternal(doc.evaluate(tagsx, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent).split(",");
			}
			Zotero.Utilities.HTTP.doPost(''http://'' + host + ''/export.mpx'', ''code='' + artids[i] + ''&mode=ris'', function(text) {
				// load translator for RIS
				var translator = Zotero.loadTranslator("import");
				translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				translator.setString(text);
				translator.setHandler("itemDone", function(obj, item) {
					var pdfurl = ''http://'' + host + ''/content/'' + artids[i] + ''/fulltext.pdf'';
					item.attachments = [
						{url:item.url, title:"MetaPress Snapshot", mimeType:"text/html"},
						{url:pdfurl, title:"MetaPress Full Text PDF", mimeType:"application/pdf"}
					];
					if (tags) item.tags = tags;
					if (item.abstractNote.substr(0, 8) == "Abstract") item.abstractNote = Zotero.Utilities.trimInternal(item.abstractNote.substr(8));
					item.complete();
				});
				translator.translate();
				Zotero.done();
			});
		}, function() {});
	}
}');

REPLACE INTO translators VALUES ('0863b8ec-e717-4b6d-9e35-0b2db2ac6b0f', '1.0.0b4.r5', '', '2008-03-13 17:00:00', '0', '100', '4', 'Institute of Pure and Applied Physics', 'Michael Berkowitz', 'http://(.*)\.ipap\.jp/', 
'function detectWeb(doc, url) {
	if (doc.title.indexOf("Table of Contents") != -1 || doc.title.indexOf("search result") != -1) {
		return "multiple";
	} else if (url.indexOf("link?") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (url.indexOf("journal") != -1) {
			var linkx = ''//dt/a/b'';
			var links = doc.evaluate(linkx, doc, null, XPathResult.ANY_TYPE, null);
			var next_link;
			while (next_link = links.iterateNext()) {
				items[next_link.href] = next_link.textContent;
			}
		} else if (url.indexOf("cgi-bin/findarticle") != -1) {
			var boxx = ''//ol/li'';
			var boxes = doc.evaluate(boxx, doc, null, XPathResult.ANY_TYPE, null);
			var box;
			while (box = boxes.iterateNext()) {
				var title = doc.evaluate(''.//b'', box, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				var link = doc.evaluate(''./a'', box, null, XPathResult.ANY_TYPE, null).iterateNext().href;
				items[link] = title;
			}
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
		
	} else {
		articles = [url];
	}
		Zotero.debug(articles);
		Zotero.Utilities.processDocuments(articles, function(newDoc) {
		var item = new Zotero.Item("journalArticle");
		item.title = Zotero.Utilities.trimInternal(newDoc.evaluate(''/html/body/h2[@class="title"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);

		var authors = Zotero.Utilities.trimInternal(newDoc.evaluate(''/html/body/p[@class="author"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		authors = authors.replace(/\band\b/, ", ").split(",");
		Zotero.debug(authors);
		for each (var author in authors) {
			author = author.replace(/\d/g, "");
			if (author.match(/\w+/)) item.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
		
		var info = Zotero.Utilities.trimInternal(newDoc.evaluate(''/html/body/h4[@class="info"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		if (info.match(/(.+)Vol.\s+(\d+),\s+No.\s+([\d\w]+),\s+(\d+),\s+pp.\s+([\w\d\-]+)\s+URL\s*:\s*(.*)\s*DOI\s*:\s*(.*)$/)) {
			info2 = info.match(/(.+)Vol.\s+(\d+),\s+No.\s+([\d\w]+),\s+(\d+),\s+pp.\s+([\w\d\-]+)\s+URL\s*:\s*(.*)\s*DOI\s*:\s*(.*)$/);
			item.publicationTitle = info2[1];
			item.volume = info2[2];
			item.issue = info2[3];
			item.date = info2[4];
			item.pages = info2[5];
			item.url = info2[6];
			item.DOI = info2[7];
		} else {
			Zotero.debug(info);
			info2 = info.match(/(.+)Vol.\s+(\d+)\s+\(\d+\)\s+([\w\d\-]+)[^,]+,[^,]+,(.*)\s*URL\s*:\s*(.*)\s*DOI\s*:\s*(.*)$/);
			Zotero.debug(info2);
			item.publicationTitle = info2[1];
			item.volume = info2[2];
			item.pages = info2[3];
			item.date = info2[4];
			item.url = info2[5];
			item.DOI = info2[6];
		}
		if (newDoc.evaluate(''/html/body/p[@class="abstract"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			item.abstractNote = Zotero.Utilities.trimInternal(newDoc.evaluate(''/html/body/p[@class="abstract"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		}
		
		if (newDoc.evaluate(''/html/body/p[@class="keyword"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var tags = Zotero.Utilities.trimInternal(newDoc.evaluate(''/html/body/p[@class="keyword"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent).split(",");
			for each (var tag in tags) {
				item.tags.push(Zotero.Utilities.trimInternal(tag));
			}
		}
		item.attachments.push({url:item.url, title:"IPAP Snapshot", mimeType:"text/html"});
		item.complete();
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('9e306d5d-193f-44ae-9dd6-ace63bf47689', '1.0.0b3r1', '', '2008-03-28 16:30:00', '1', '100', '4', 'IngentaConnect', 'Michael Berkowitz', 'http://(www.)?ingentaconnect.com', 
'function detectWeb(doc, url) {
	if (url.indexOf("article?") != -1 || url.indexOf("article;") != -1) {
		return "journalArticle";
	} else if (url.indexOf("search?") !=-1 || url.indexOf("search;") != -1) {
		return "multiple";
	}
}', 
'function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var artlink = ''//div//p/strong/a'';
		var links = doc.evaluate(artlink, doc, null, XPathResult.ANY_TYPE, null);
		var next_link;
		while (next_link = links.iterateNext()) {
			items[next_link.href] = next_link.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	Zotero.Utilities.processDocuments(articles, function(newDoc) {
		var risurl = newDoc.evaluate(''//div[@id="export-formats"]/ul/li/a[@title="EndNote Export"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		var abs = Zotero.Utilities.trimInternal(newDoc.evaluate(''//div[@id="abstract"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent).substr(10);
		var keywords = newDoc.evaluate(''//div[@id="info"]/p[1]/a'', newDoc, null, XPathResult.ANY_TYPE, null);
		var key;
		var keys = new Array();
		while (key = keywords.iterateNext()) {
			keys.push(key.textContent);
		}
		Zotero.Utilities.HTTP.doGet(risurl, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.abstractNote = abs;
				item.attachments = [{url:item.url, title:"IngentaConnect Snapshot", mimeType:"text/html"}];
				item.tags = keys;
				if (item.DOI) {
					if (item.DOI.match(/doi/)) {
						item.DOI = item.DOI.substr(4);
					}
				}
				item.complete();
			});
			translator.translate();
		});
	}, function() {Zotero.done;});
}');

REPLACE INTO translators VALUES ('636c8ea6-2af7-4488-8ccd-ea280e4a7a98', '1.0.0b4.r5', '', '2008-04-04 15:00:00', '1', '100', '4', 'Sage Journals Online', 'Michael Berkowitz', 'http://[^/]*\.sagepub\.com[^/]*/', 
'function detectWeb(doc, url) {
	if (url.indexOf("searchresults") != -1 || (doc.title.indexOf("Table of Contents") != -1)) {
		return "multiple";
	} else if (url.indexOf("cgi/content") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.title.indexOf("Table of Contents") != -1) {
			var searchx = ''//div[@id="maincontent"]/div[@class="contentarea"]/table[@class="toc"]/tbody/tr/td[2][@class="rightcol"]/form/dl/dd''; 
			var titlex = ''.//strong'';
		} else {
			var searchx = ''//form[@id="search_results"]/div[@class="resultsitem"]/div[2]'';
			var titlex = ''.//label'';
		}	
		var linkx = ''.//a[1]'';
		var searchres = doc.evaluate(searchx, doc, null, XPathResult.ANY_TYPE, null);
		var next_res;
		while (next_res = searchres.iterateNext()) {
			var title = doc.evaluate(titlex, next_res, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var link = doc.evaluate(linkx, next_res, null, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		} 
	} else {
		arts = [url];
	}
	var newurls = new Array();
	for each (var i in arts) {
		newurls.push(i);
	}
	Zotero.Utilities.HTTP.doGet(arts, function(text) {
		var id = text.match(/=([^=]+)\">\s*Add to Saved Citations/)[1];
		var newurl = newurls.shift();
		var pdfurl = newurl.replace(/content\/[^/]+/, "reprint") + ".pdf";
		var get = ''http://online.sagepub.com/cgi/citmgr?type=refman&gca='' + id;
		Zotero.Utilities.HTTP.doGet(get, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			if (text.match(/N1(.*)\n/)) {
				var doi = text.match(/N1\s+\-\s+(.*)\n/)[1];
			}
			translator.setHandler("itemDone", function(obj, item) {
				item.attachments = [
					{url:newurl, title:"Sage Journals Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:"Sage Journals Full Text PDF", mimeType:"application/pdf"}
				];
				if (doi) item.DOI = doi;
				if (item.notes) item.notes = [];
				item.complete();
			});
			translator.translate();
		});
	});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('3eabecf9-663a-4774-a3e6-0790d2732eed', '1.0.0b4.r5', '', '2008-03-03 21:00:00', '0', '100', '4', 'SciELO Brazil', 'Michael Berkowitz', 'http://www.scielo.br/', 
'function detectWeb(doc, url) {
	if (url.indexOf("wxis.exe/iah") != -1) {
		if (doc.evaluate(''//font[@class="isoref"]/a[@class="isoref"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			return "multiple";
		}
	} else if (url.indexOf("&pid=") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var titlepath = ''//font[@class="isoref"]/font[@class="negrito"]/b[1]'';
		var linkpath = ''//font[@class="isoref"]/a[@class="isoref"]'';
		var titles = doc.evaluate(titlepath, doc, null, XPathResult.ANY_TYPE, null);
		var links = doc.evaluate(linkpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_title;
		var next_link;
		while ((next_title = titles.iterateNext()) && (next_link = links.iterateNext())) {
			items[next_link.href] = next_title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.debug(arts);
	Zotero.Utilities.processDocuments(arts, function(newDoc) {
		var url = newDoc.location.href;
		var pid = url.match(/pid=([^&]+)/)[1];
		var get = ''http://www.scielo.br/scieloOrg/php/articleXML.php?pid='' + pid + ''&lang=en'';
		Zotero.Utilities.HTTP.doGet(get, function(text) {
			var item = new Zotero.Item("journalArticle");
			
			text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "").replace(/<self-uri.*\/self\-uri>/g, "");
			var journal = text.split("<journal-meta>")[1].split("</journal-meta>")[0];
			journal = "<journal>" + journal + "</journal>";
			journal = journal.replace(/\-([a-z])/g, "$1");
			var xml2 = new XML(journal);
			var art = text.split("<article-meta>")[1].split("</article-meta>")[0];
			art = "<article>" + art + "</article>";
			art = art.replace(/\-([a-z])/g, "$1");
			var xml3 = new XML(art);
			
			item.publicationTitle = xml2..journaltitle.text().toString();
			item.journalAbbreviation = xml2..abbrevjournaltitle.text().toString();
			item.ISSN = xml2..issn.text().toString();
			item.publisher = xml2..publisher..publishername.text().toString();
			
			item.title = xml3..titlegroup..articletitle.text().toString();
			for (var i = 0 ; i < xml3..contribgroup..contrib.length() ; i++) {
				var name = xml3..contribgroup..contrib[i]..name;
				item.creators.push({firstName:name..givennames.text().toString(), lastName:name..surname.text().toString(), creatorType:"author"});
			}
			
			var date = xml3..pubdate[0];
			var day = date..day.text().toString();
			var month = date..month.text().toString();
			var year = date..year.text().toString();
			
			date =  year;
			if (month != "00") {
				date = month + "/" + date;
			}
			if (day != "00") {
				date = day + "/" + date;
			}
			item.date = date;
			item.volume = xml3..volume.text().toString();
			item.pages = xml3..fpage.text().toString() + "-" + xml3..lpage.text().toString();
			
			for (var i = 0 ; i < xml3..kwdgroup..kwd.length() ; i++) {
				item.tags.push(xml3..kwdgroup..kwd[i].text().toString());
			}
			
			item.attachments = [
				{url:url, title:"SciELO Snapshot", mimeType:"text/html"}
			];
	
			item.complete();
		});
	}, function() {Zotero.done;});
}');

REPLACE INTO translators VALUES ('0a84a653-79ea-4c6a-8a68-da933e3b504a', '1.0.0b4.r5', '', '2008-03-28 16:30:00', '0', '100', '4', 'Alexander Street Press', 'John West and Michael Berkowitz', 'http://(?:www\.)alexanderstreet', 
'function detectWeb(doc, url) {
	if( url.indexOf("object.details.aspx") != -1 ) {
		var zitemtype = doc.getElementById("ctl00_ctl00_MasterContentBody_ContentPlaceHolder1_txtZType").value;
		switch (zitemtype.toLowerCase()) {
		        case "book":
		        	return "book";
		        	break;
		        case "chapter":
		        	return "bookSection";
		        	break;
		        case "journal":
		        	return "journalArticle";
		        	break;
		        case "manuscript":
		        	return "manuscript";
		        	break;
		        case "audio":
		        	return "audioRecording";
		        	break;
		        case "video":
		        	return "videoRecording";
		        	break;
		        case "issue":
		        	return "journalArticle";
		        	break;
		        case "article":
		        	return "journalArticle";
		        	break;
		        case "series":
		        	return "interview";
		        	break;
		        case "session":
		        	return "interview";
		        	break;
		        default:
		        	return "document";
		}
	} else if (url.indexOf("results.aspx") != -1) {
		return "multiple";
	}
}', 
'function scrape(doc, url) {
	// set prefix for serverside control
	var p = "ctl00_ctl00_MasterContentBody_ContentPlaceHolder1_txtZ";

	// get values from hidden inputs
	var ztype = GetItemType(doc.getElementById(p+"Type").value);
	var ztitle = doc.getElementById(p+"Title").value;
	var zbooktitle = doc.getElementById(p+"BookTitle").value;
	var znotes = doc.getElementById(p+"Notes").value;
	var zurl = doc.getElementById(p+"URL").value;
	var zrights = doc.getElementById(p+"Rights").value;
	var zseries = doc.getElementById(p+"Series").value;
	var zvolume = doc.getElementById(p+"Volume").value;
	var zissue = doc.getElementById(p+"Issue").value;
	var zedition = doc.getElementById(p+"Edition").value;
	var zplace = doc.getElementById(p+"Place").value;
	var zpublisher = doc.getElementById(p+"Publisher").value;
	var zpages = doc.getElementById(p+"Pages").value;
	var zrepository = doc.getElementById(p+"Repository").value;
	var zlabel = doc.getElementById(p+"Label").value;
	var zrunningTime = doc.getElementById(p+"RunningTime").value;
	var zlanguage = doc.getElementById(p+"Language").value;
	var zauthor = doc.getElementById(p+"Author").value;
	var zeditor = doc.getElementById(p+"Editor").value;
	var ztranslator = doc.getElementById(p+"Translator").value;
	var zinterviewee = doc.getElementById(p+"Interviewee").value;
	var zinterviewer = doc.getElementById(p+"Interviewer").value;
	var zrecipient = doc.getElementById(p+"Recipient").value;
	var zdirector = doc.getElementById(p+"Director").value;
	var zscriptwriter = doc.getElementById(p+"ScriptWriter").value;
	var zproducer = doc.getElementById(p+"Producer").value;
	var zcastMember = doc.getElementById(p+"CastMember").value;
	var zperformer = doc.getElementById(p+"Performer").value;
	var zcomposer = doc.getElementById(p+"Composer").value;

	// create Zotero item
	var newArticle = new Zotero.Item(ztype);

	// populate Zotero item
	newArticle.title = ztitle;
	newArticle.bookTitle = zbooktitle;
	newArticle.notes = znotes;
	newArticle.url = zurl;
	newArticle.place = zplace;
	newArticle.publisher = zpublisher;
	newArticle.pages = zpages;
	newArticle.rights = zrights;
	newArticle.series = zseries;
	newArticle.volume = zvolume;
	newArticle.issue = zissue;
	newArticle.edition = zedition;
	newArticle.repository = zrepository;
	newArticle.label = zlabel;
	newArticle.runningTime = zrunningTime;
	newArticle.language = zlanguage;
	newArticle.editor = zeditor;
	newArticle.translator = ztranslator;
	newArticle.interviewee = zinterviewee;
	newArticle.interviewer = zinterviewer;
	newArticle.recipient = zrecipient;
	newArticle.director = zdirector;
	newArticle.scriptwriter = zscriptwriter;
	newArticle.producer = zproducer;
	newArticle.castMember = zcastMember;
	newArticle.performer = zperformer;
	newArticle.composer = zcomposer;
	var aus = zauthor.split(";");
	for (var i=0; i< aus.length ; i++) {
		 newArticle.creators.push(Zotero.Utilities.cleanAuthor(aus[i], "author", true));
	}

	newArticle.attachments = [{url:doc.location.href, title:"Alexander Street Press Snapshot", mimeType:"text/html"}];
	if (doc.evaluate(''//a[contains(@href, "get.pdf")]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var pdfurl = doc.evaluate(''//a[contains(@href, "get.pdf")]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		newArticle.attachments.push({url:pdfurl, title:"Alexander Street Press PDF", mimeType:"application/pdf"});
	} else if (doc.evaluate(''//a[contains(@href, "get.jpg")]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var imgurl = doc.evaluate(''//a[contains(@href, "get.jpg")]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href.replace(/.{2}$/, "01");
		newArticle.attachments.push({url:imgurl, title:"Alexander Street Press Pg 1", mimeType:"image/jpg"});
		newArticle.notes = [{note:"Further page images can be found by following the URL of the ''Alexander Street Press Pg 1'' attachment and iterating the final digits of the URL"}];
	}
	// save Zotero item
	newArticle.complete();

}

function GetItemType(zitemtype) {
	switch (zitemtype.toLowerCase()) {
	        case "book":
	        	return "book";
	        	break;
	        case "chapter":
	        	return "bookSection";
	        	break;
	        case "journal":
	        	return "journalArticle";
	        	break;
	        case "manuscript":
	        	return "manuscript";
	        	break;
	        case "audio":
	        	return "audioRecording";
	        	break;
	        case "video":
	        	return "videoRecording";
	        	break;
	        case "issue":
	        	return "journalArticle";
	        	break;
	        case "article":
	        	return "journalArticle";
	        	break;
	        case "series":
	        	return "interview";
	        	break;
	        case "session":
	        	return "interview";
	        	break;
	        default:
	        	return "document";
       }
}

function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = ''//tbody/tr/td[2][@class="data"]/a[1]'';
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
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

	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done;});
}');

REPLACE INTO translators VALUES ('0abd577b-ec45-4e9f-9081-448737e2fd34', '1.0.0b4.r5', '', '2008-02-22 20:30:00', '0', '100', '4', 'DSpace', 'Michael Berkowitz', 'dspace',
'function detectWeb(doc, url) {
	if (doc.evaluate(''//center/table[@class="itemDisplayTable"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "document";
	} else if (doc.evaluate(''//table[@class="miscTable"]//td[2]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
}', 
'var itemTypes = {
	"Article":"journalArticle",
	"Book":"book",
	"Thesis":"thesis",
	"Working Paper":"report",
	"Technical Report":"report"
}

function doWeb(doc, url) {
	var records = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = ''//table[@class="miscTable"]/tbody/tr/td[2]/a'';
		var rows = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var row;
		while (row = rows.iterateNext()) {
			items[row.href] = row.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			records.push(i + ''?mode=full'');
		}
	} else {
		records = [url.match(/^([^?]+)\??/)[1] + "?mode=full"];
	}
	Zotero.debug(records);
	Zotero.Utilities.processDocuments(records, function(newDoc) {
		Zotero.debug(newDoc.location.href);
		var values = new Object();
		var fields = newDoc.evaluate(''//table[@class="itemDisplayTable"]/tbody/tr/td[1]'', newDoc, null, XPathResult.ANY_TYPE, null);
		var data = newDoc.evaluate(''//table[@class="itemDisplayTable"]/tbody/tr/td[2]'', newDoc, null, XPathResult.ANY_TYPE, null);
		var field2;
		var datum2;
		var newItem = new Zotero.Item();
		while ((field2 = fields.iterateNext()) && (datum2 = data.iterateNext())) {
			var field = field2.textContent.replace(/^dc\./, "");
			var datum = datum2.textContent;
			if (field == "contributor.author") {
				var name = datum.split(",");
				newItem.creators.push({firstName:name[1], lastName:name[0], creatorType:"author"});
			} else if (field == "dentifier.uri") {
				newItem.url = datum;
			} else if (field == "title") {
				newItem.title = datum;
			} else if (field == "type") {
				if (itemTypes[datum]) {
					newItem.itemType = itemTypes[datum];
				} else {
					newItem.itemType = "document";
				}
			} else if (field == "description.abstract") {
				newItem.abstractNote = datum;
			} else if (field == "date.available") {
				newItem.date = datum.replace(/T.*$/, "");
			} else if (field == "subject") {
				newItem.tags.push(datum);
			} else if (field == "publisher") {
				newItem.publisher = datum;
			} else if (field == "identifier.issn") {
				newItem.ISSN = datum;
			} else if (field == "relation.ispartofseries") {
				if (datum.match(/Vol/)) {
					newItem.volume = datum.match(/\d+/)[0];
				} else if (datum.match(/No/)) {
					newItem.issue = datum.match(/\d+/)[0];
				}
			} else if (field == "rights") {
				newItem.rights = datum;
			}
		}
		var pdf = newDoc.evaluate(''//td[@class="standard"]/a'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		newItem.attachments = [
			{url:newDoc.location.href, title:"DSpace Snapshot", mimeType:"text/html"},
			{url:pdf, title:"DSpace PDF", mimeType:"application/pdf"}
		];
		Zotero.debug(newItem);
		newItem.complete();
	}, function() {Zotero.done;});
}');

REPLACE INTO translators VALUES ('7987b420-e8cb-4bea-8ef7-61c2377cd686', '1.0.0b4.r1', '', '2008-02-06 20:00:00', '0', '100', '4', 'NASA ADS', 'Asa Kusuma and Ramesh Srigiriraju', 'http://(ukads|cdsads|ads|adsabs|esoads|adswww|www.ads)\.(inasan|iucaa.ernet|nottingham.ac|harvard|eso|u-strasbg|nao.ac|astro.puc|bao.ac|on|kasi.re|grangenet|lipi.go|mao.kiev)\.(edu|org|net|fr|jp|cl|id|uk|cn|ua|in|ru|br|kr)/(?:cgi-bin|abs)/', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var singXpath = ''//input[@name="bibcode"][@type="hidden"]'';
	var multXpath = ''//input[@name="bibcode"][@type="checkbox"]'';

	if (doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "journalArticle";
	}
}', 
'function parseRIS(bibcodes, hostname){
	var getURL = "http://" + hostname + "/cgi-bin/nph-bib_query?"
		+ bibcodes + "data_type=REFMAN&nocookieset=1";
	Zotero.Utilities.HTTP.doGet(getURL, function(text){	
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.translate();
		Zotero.done();
	}, function() {});
	Zotero.wait();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var singXpath = ''//input[@name="bibcode"][@type="hidden"]'';
	var multXpath = ''//input[@name="bibcode"][@type="checkbox"]'';
	var titleXpath = ''//table/tbody/tr/td[4]''; //will find scores and titles
	var hostname = doc.location.host
	var bibElmts = doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var titleElmts = doc.evaluate(titleXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var titleElmt;
	var bibElmt;

	if ((bibElmt = bibElmts.iterateNext()) && (titleElmt = titleElmts.iterateNext())) {

		var items = new Array();

		do {
			titleElmt = titleElmts.iterateNext(); //iterate a second time to avoid score
			items[bibElmt.value] = Zotero.Utilities.cleanString(titleElmt.textContent);
		} while((bibElmt = bibElmts.iterateNext()) && (titleElmt = titleElmts.iterateNext()));
		items = Zotero.selectItems(items);
		if(!items) return true;

		var bibcodes="";
		for(var bibcode in items) {
			bibcodes = bibcodes + "bibcode="+encodeURIComponent(bibcode) + "&";
		}
		parseRIS(bibcodes, hostname);		
				
	} else if (bibElmt = doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var bibcode = bibElmt.value;
		var bibcodes = "bibcode="+encodeURIComponent(bibcode) + "&";
		parseRIS(bibcodes, hostname);
	}
}');

REPLACE INTO translators VALUES ('99f958ab-0732-483d-833f-6bd8e42f6277', '1.0.0b4.r1', '', '2007-06-27 02:00:00', '0', '100', '4', 'National Bureau of Economic Research', 'Asa Kusuma', '^https?://(?:papers\.|www\.)?nber\.org/papers', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var singXpath = ''//h1[@class="title"]'';
	var multXpath = ''//input[@name="module"][@type="hidden"]'';
	var singleXpath = ''//input[@name="domains"][@type="hidden"]'';
	
	var str=doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;

	if (doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("byprog")==-1 && doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.indexOf("Working Paper Search Results")==-1){
		
		if(doc.evaluate(singleXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() && doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.indexOf("NBER Working Papers")==-1) {
			return "journalArticle";
		}
	}
}', 
'function parseRIS(uris){
	
	Zotero.Utilities.HTTP.doGet(uris, function(text){	
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.translate();
		Zotero.done();
	}, function() {});
	Zotero.wait();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var singXpath = ''//h1[@class="title"]'';
	var multXpath = ''//input[@name="module"]'';
	var str=doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;

	if (doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		
		var bibXpath=''//table/tbody/tr/td/nobr/b'';
		var titleXpath=''//table/tbody/tr/td/a'';
		
		var bibElmts = doc.evaluate(bibXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var titleElmts = doc.evaluate(titleXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var titleElmt;
		var bibElmt;
		bibElmt = bibElmts.iterateNext();
		titleElmt = titleElmts.iterateNext();
		
		var items = new Array();

		do {
			items[bibElmt.textContent] = Zotero.Utilities.cleanString(titleElmt.textContent);
		} while((bibElmt = bibElmts.iterateNext()) && (titleElmt = titleElmts.iterateNext()));

		items = Zotero.selectItems(items);
		if(!items) return true;

		var bibcodes="";
		var uris = new Array();
		for(var bibcode in items) {
			var getURL = "http://www.nber.org/papers/"
				+ bibcode + ".ris";
			uris.push(getURL);
		}
		
		parseRIS(uris);


	} else if (doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.indexOf("Working Paper Search Results")==-1){
		bibcode=url.substr(url.indexOf("/papers/")+8,url.length);
		var uris = new Array();
		var getURL = "http://www.nber.org/papers/"
			+ bibcode + ".ris";
		uris.push(getURL);
		parseRIS(uris);
	}
}');

REPLACE INTO translators VALUES ('411f9a8b-64f3-4465-b7df-a3c988b602f3', '1.0.0b4.r1', '', '2007-06-26 15:17:22', '0', '100', '4', 'RePEc', 'Asa Kusuma', '^https?://ideas\.repec\.org/', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var singXpath = ''//html/body/a/table/tbody/tr/td/font/b'';
	var multXpath = ''//html/body/h2'';
	
	
	
	if (doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		if(doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.indexOf("Search")!=-1)
			return "multiple";
	} else if(doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	}
}', 
'function strrev(str) {
   if (!str) return '''';
   var revstr='''';
   for (i = str.length-1; i>=0; i--)
       revstr+=str.charAt(i)
   return revstr;
}


function parseRIS(uris) {
	

	Zotero.Utilities.HTTP.doGet(uris, function(text){	
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.translate();
		Zotero.done();
	}, function() {});
	Zotero.wait();
}

function doWeb(doc, url) {
	
	
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var singXpath = ''//html/body/a/table/tbody/tr/td/font/b'';
	var multXpath = ''//html/body/h2'';
	
	

	if (doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		if(doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.indexOf("Search")!=-1)
			

			shortXpath = ''//html/body/strong/a'';
			longXpath = ''//html/body/dl/dt/strong/a'';
			var multXpath='''';
			if(doc.evaluate(shortXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				multXpath=shortXpath;

			} else {
				multXpath=longXpath;

			}
			
			
			var bibElmts = doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var titleElmts = doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var titleElmt;
			var bibElmt;
			bibElmt = bibElmts.iterateNext();
			titleElmt = titleElmts.iterateNext();

			var items = new Array();

			do {
				
				var bibcode = bibElmt.href;

				bibcode=bibcode.substr(24);

				bibcode=strrev(bibcode);
				bibcode=bibcode.substr(5,bibcode.length);
				bibcode=strrev(bibcode);
				
				//Replace slashes with colons
				bibcode=bibcode.replace("/",":","g");
				
				//Insert colons between numbers and letters and letters and numbers
				bibcode=bibcode.replace(/([A-Za-z])([0-9])/g,
                   		function (str, p1, p2, offset, s) {
                      			return p1 + ":" + p2;
                   		}
                		)

				bibcode=bibcode.replace(/([0-9])([A-Za-z])/g,
                   		function (str, p1, p2, offset, s) {
                      			return p1 + ":" + p2;
                   		}
                		)
				
				items[bibcode] = Zotero.Utilities.cleanString(titleElmt.textContent);

			} while((bibElmt = bibElmts.iterateNext()) && (titleElmt = titleElmts.iterateNext()));

			items = Zotero.selectItems(items);
			if(!items) return true;

			var bibcodes="";
			var uris = new Array();
			for(var bibcode in items) {				

				var getURL = "http://ideas.repec.org/cgi-bin/ref.cgi?handle=RePEc";
				getURL = getURL + bibcode + "&output=3";

				uris.push(getURL);
			}

			parseRIS(uris);
			
			
			
			
	} else if(doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {

		var bibcode = url;

		bibcode=bibcode.substr(24);

		bibcode=strrev(bibcode);
		bibcode=bibcode.substr(5,bibcode.length);
		bibcode=strrev(bibcode);
		

		//Replace slashes with colons
		bibcode=bibcode.replace("/",":","g");
				
		//Insert colons between numbers and letters and letters and numbers
		bibcode=bibcode.replace(/([A-Za-z])([0-9])/g,
                   function (str, p1, p2, offset, s) {
                      	return p1 + ":" + p2;
                   }
                )

		bibcode=bibcode.replace(/([0-9])([A-Za-z])/g,
                   function (str, p1, p2, offset, s) {
                      	return p1 + ":" + p2;
                   }
                )	
		

		var getURL = "http://ideas.repec.org/cgi-bin/ref.cgi?handle=RePEc";
		getURL = getURL + bibcode + "&output=3";
				
		var idarray = new Array();
		idarray.push(getURL);
		parseRIS(idarray);
		
	}


}');

REPLACE INTO translators VALUES ('e4660e05-a935-43ec-8eec-df0347362e4c', '1.0.0b4.r1', '', '2007-07-31 16:45:00', '0', '100', '4', 'ERIC', 'Ramesh Srigiriraju', '^http://(?:www\.)?eric\.ed\.gov/', 
'function detectWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var searchpath=''//form[@name="searchResultsForm"][@id="searchResultsForm"]'';
	if(doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
		return "multiple";
	var singpath=''//tr/td[@class="primaryHeader"][contains(text(), "Result Details")]'';
	if(doc.evaluate(singpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
		var typepath=''//tr[td/strong/text()="Pub Types:"]/td[2]/text()'';
		var typestr=doc.evaluate(typepath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
		var typereg=new RegExp("([^;/\-]+)");
		var typearr=typereg.exec(typestr);
		if(typearr[1]=="Journal Articles")
			return "journalArticle";
		if(typearr[1]=="Information Analyses")
			return "journalArticle";
		if(typearr[1]="Machine")
			return "computerProgram";
		if(typearr[1]="Computer Programs")
			return "computerProgram";
		if(typearr[1]="Dissertations")
			return "thesis";
		if(typearr[1]="Reports")
			return "report";
		if(typearr[1]="Non")
			return "audioRecording";
		if(typearr[1]="Legal")
			return "statute";
		else
			return "book";
	}
}', 
'function doWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var searchpath=''//form[@name="searchResultsForm"][@id="searchResultsForm"]'';
	if(doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
		var string="http://eric.ed.gov/ERICWebPortal/custom/portlets/clipboard/performExport.jsp";
		var idpath=''//a[img]/@id'';
		var ids=doc.evaluate(idpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var items=new Array();
		var titlpath=''//tr[1]/td[1]/p/a'';
		var titlerows=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var id;
		while(id=ids.iterateNext())
			items[id.nodeValue]=Zotero.Utilities.cleanTags(Zotero.Utilities.cleanString(titlerows.iterateNext().textContent));
		items=Zotero.selectItems(items);
		var string="http://eric.ed.gov/ERICWebPortal/custom/portlets/clipboard/performExport.jsp?";
		for(var ids in items)
			string+="accno="+ids+"&";
		string+="texttype=endnote&citationtype=brief&Download.x=86&Download.y=14";
		Zotero.Utilities.HTTP.doGet(string, function(text)	{
			var trans=Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(text);
			trans.setHandler("itemDone", function(obj, newItem)	{
				var linkpath=''//tbody[tr/td/a/@id="''+newItem.itemID+''"]/tr/td/p/a[@class="action"]'';
				var link=doc.evaluate(linkpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if(link)
					newItem.attachments.push({url:link.href, title:newItem.title, mimeType:"application/pdf"});
				newItem.complete();
			});
			trans.translate();
			Zotero.done();
		});
		Zotero.wait();
	}
	var singpath=''//tr/td[@class="primaryHeader"][contains(text(), "Result Details")]'';
	if(doc.evaluate(singpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
		var idpath=''//input[@type="hidden"][@name="accno"]/@value'';
		var idpath2=''//meta[@name="eric #"]/@content'';
		var id;
		var temp=doc.evaluate(idpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if(temp)
			id=temp.nodeValue;
		else
			id=doc.evaluate(idpath2, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
		var string="http://eric.ed.gov/ERICWebPortal/custom/portlets/clipboard/performExport.jsp?accno=";
		string+=id+"&texttype=endnote&citationtype=brief&Download.x=86&Download.y=14";
		Zotero.Utilities.HTTP.doGet(string, function(text)	{
			var trans=Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(text);
			trans.setHandler("itemDone", function(obj, newItem)	{
				var linkpath=''//tr/td/p[img/@alt="PDF"]/a'';
				var link=doc.evaluate(linkpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if(link)
					newItem.attachments.push({url:link.href, title:newItem.title, mimeType:"application/pdf"});
				newItem.complete();
			});
			trans.translate();
			Zotero.done();
		});
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('5dd22e9a-5124-4942-9b9e-6ee779f1023e', '1.0.0b4.r5', '', '2007-11-29 18:00:00', '1', '100', '4', 'Flickr', 'Sean Takats', '^http://(?:www\.)?flickr\.com/', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;

	if (elmt = doc.evaluate(''//h1[@property="dc:title" and starts-with(@id, "title_div")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){		                       
		return "artwork";
	} else if (doc.evaluate(''//td[@class="DetailPic"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";
	} else if (doc.evaluate(''//div[@class="StreamView"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";
	} else if (doc.evaluate(''//div[@id="setThumbs"]/a[starts-with(@id, "set_thumb_link_")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";
	} else if (doc.evaluate(''//p[@class="StreamList" or @class="UserTagList"]/a'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
	var items = new Object();
	var photo_ids = new Array();
	var uris = new Array();
	var key = "3cde2fca0879089abf827c1ec70268b5";

	var elmts;
	var elmt;

// single result
	if (elmt = doc.evaluate(''//h1[@property="dc:title" and starts-with(@id, "title_div")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){		                       
		var photo_id = elmt.id;
		photo_id = photo_id.substr(9);
		photo_ids.push(photo_id);
	} else { //multiple results
		var photoRe = /\/photos\/[^\/]*\/([0-9]+)\//;
//search results
		if (doc.evaluate(''//td[@class="DetailPic"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			elmts = doc.evaluate(''//td[@class="DetailPic"]/a'', doc, nsResolver, XPathResult.ANY_TYPE, null);
			while (elmt = elmts.iterateNext()){
				var title = elmt.title;
				title = Zotero.Utilities.trimInternal(title);
				var link = elmt.href;
				var m = photoRe(link);
				var photo_id = m[1];
				items[photo_id] = title;
			}
// photo stream
		} else if (doc.evaluate(''//div[@class="StreamView"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			elmts = doc.evaluate(''//div[@class="StreamView" and starts-with(@id, "sv_title_")]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
			while (elmt = elmts.iterateNext()){
				var title = Zotero.Utilities.trimInternal(elmt.textContent);
				var photo_id = elmt.id;
				photo_id = photo_id.substr(9);
				items[photo_id] = title;
			}
// photo set
		} else if (doc.evaluate(''//div[@id="setThumbs"]/a[starts-with(@id, "set_thumb_link_")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			elmts = doc.evaluate(''//div[@id="setThumbs"]/a[starts-with(@id, "set_thumb_link_")]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
			while (elmt = elmts.iterateNext()){
				var title = Zotero.Utilities.trimInternal(elmt.title);
				var photo_id = elmt.id.substr(15);
				items[photo_id] = title;
			}
// tagged with
		} else if (doc.evaluate(''//p[@class="StreamList" or @class="UserTagList"]/a'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			var elmts = doc.evaluate(''//p[@class="StreamList" or @class="UserTagList"]/a[img]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
			while (elmt = elmts.iterateNext()){
				var title = Zotero.Utilities.trimInternal(elmt.title);
				var link = elmt.href;
				var m = photoRe(link);
				var photo_id = m[1];
				items[photo_id] = title;
			}
		}
		items = Zotero.selectItems(items);
		if(!items) return true;
		for(var i in items) {
			photo_ids.push(i);
		}
	}
	for each(var photo_id in photo_ids){
		uris.push("http://api.flickr.com/services/rest/?method=flickr.photos.getInfo&api_key="+key+"&photo_id="+photo_id);
	}
	Zotero.Utilities.HTTP.doGet(uris, function(text) {
		text = text.replace(/<\?xml[^>]*\?>/, "");
		var xml = new XML(text);
		var newItem = new Zotero.Item("artwork");
		var title = "";
		if (xml..title.length()){
			var title = Zotero.Utilities.cleanString(xml..title[0].text().toString());
			if (title == ""){
				title = " ";
			}
			newItem.title = title;
		}
		for(var i=0; i<xml..tag.length(); i++) {
			newItem.tags.push(Zotero.Utilities.cleanString(xml..tag[i].text().toString()));
		}
		if (xml..dates.length()){
			var date = xml..dates[0].@taken.toString();
			newItem.date = date.substr(0, 10);
		}
		if (xml..owner.length()){
			var author = xml..owner[0].@realname.toString();
			if (author == ""){
				author = xml..owner[0].@username.toString();
			}
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "artist"));
		}
		if (xml..url.length()){
			newItem.url = xml..url[0].text().toString();
		}
		if (xml..description.length()){
			newItem.abstractNote = xml..description[0].text().toString();
		}
		var format = xml..photo[0].@originalformat.toString();
		var photo_id = xml..photo[0].@id.toString();
		
// get attachment code
		var uri = "http://api.flickr.com/services/rest/?method=flickr.photos.getSizes&api_key="+key+"&photo_id="+photo_id;
		Zotero.Utilities.HTTP.doGet(uri, function(text) {
			text = text.replace(/<\?xml[^>]*\?>/, "");
			var xml = new XML(text);
			var last = xml..size.length() - 1;
			var attachmentUri = xml..size[last].@source.toString();
			newItem.attachments = [{title:title, url:attachmentUri}];
			newItem.complete();
		}, function(){Zotero.done();});	
	});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('d3b1d34c-f8a1-43bb-9dd6-27aa6403b217', '1.0.0rc4', '', '2008-03-30 08:30:00', '1', '100', '4', 'YouTube', 'Sean Takats and Michael Berkowitz', 'https?://[^/]*youtube\.com\/', 
'function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
	var xpath = ''//input[@type="hidden" and @name="video_id"]'';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "videoRecording";
	}
	if (doc.evaluate(''//div[@class="vtitle"]/a[@class="vtitlelink" and contains(@href, "/watch?v=")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";
	}
	if (doc.evaluate(''//div[starts-with(@class, "vtitle")]/a[contains(@href, "/watch?v=")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){	
		return "multiple";
	}
	if (doc.evaluate(''//div[@class="vltitle"]/div[@class="vlshortTitle"]/a[contains(@href, "/watch?v=")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){	
		return "multiple";
	}
}

', 
'function doWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
	var host = doc.location.host;
	var video_ids = new Array();
	var xpath = ''//input[@type="hidden" and @name="video_id"]'';
	var elmts;
	var elmt;
	elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	elmt = elmts.iterateNext();
	if(elmt) {
		//single video
		var video_id = elmt.value;
		video_ids.push(video_id);
	} else {
		// multiple videos
		var items = new Object();
		var videoRe = /\/watch\?v=([a-zA-Z0-9-_]+)/;
// search results		
		if (elmt = doc.evaluate(''//div[@class="vtitle"]/a[@class="vtitlelink" and contains(@href, "/watch?v=")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			elmts = doc.evaluate(''//div[@class="vtitle"]/a[@class="vtitlelink" and contains(@href, "/watch?v=")]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
// categories and community pages and user pages and browse pages
		} else if (doc.evaluate(''//div[starts-with(@class, "vtitle")]/a[contains(@href, "/watch?v=")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			elmts = doc.evaluate(''//div[starts-with(@class, "vtitle")]/a[contains(@href, "/watch?v=")]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else if (doc.evaluate(''//div[@class="vltitle"]/div[@class="vlshortTitle"]/a[contains(@href, "/watch?v=")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
			elmts = doc.evaluate(''//div[@class="vltitle"]/div[@class="vlshortTitle"]/a[contains(@href, "/watch?v=")]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		while (elmt = elmts.iterateNext()){
			var title = elmt.textContent;
			title = Zotero.Utilities.trimInternal(title);
			var link = elmt.href;
			var m = videoRe(link);
			var video_id = m[1];
			items[video_id] = title;
		}
		items = Zotero.selectItems(items);
		if(!items) return true;
		for(var i in items) {
			video_ids.push(i);
		}
	}
	getData(video_ids, host);			
}

function getData(ids, host){
	var uris = new Array();	
	var url = "http://gdata.youtube.com/feeds/videos/";
	for each(var id in ids){
		uris.push(url+id);
	}
	Zotero.Utilities.HTTP.doGet(uris, function(text) {
		// clean up header
		text = text.replace(/<\?xml[^>]*\?>/, "");
		text = text.replace(/<entry[^>]*>/, "<entry>");
		// replace colons in XML tags
		text = text.replace(/<media:/g, "<media_").replace(/<\/media:/g, "</media_");
//		text = text.replace(/<yt:/g, "<yt_").replace(/<\/yt:/g, "</yt_");
		text = text.replace(/yt:/g, "yt_");
		text = text.replace(/<gd:/g, "<gd_").replace(/<\/gd:/g, "</gd_");
		text = text.replace(/<\/?(georss|gml)[^>]+>/g, "");
		// pad xml
		text = "<zotero>"+text+"</zotero>";
		var xml = new XML(text);
		var newItem = new Zotero.Item("videoRecording");
		var title = "";
		var title = xml..media_title[0].text().toString();
		if (xml..media_title.length()){
			var title = Zotero.Utilities.cleanString(xml..media_title[0].text().toString());
			if (title == ""){
				title = " ";
			}
			newItem.title = title;
		}
		if (xml..media_keywords.length()){
			var keywords = xml..media_keywords[0].text().toString();
			keywords = keywords.split(",");
			for each(var tag in keywords){
				newItem.tags.push(Zotero.Utilities.trimInternal(tag));
			}
		}
		if (xml..published.length()){
			var date = xml..published[0].text().toString();
			newItem.date = date.substr(0, 10);
		}
		if (xml..author.name.length()){
			var author = xml..author.name[0].text().toString();
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "contributor", true));
		}
		if (xml..media_player.length()){
			var url = xml..media_player[0].@url.toString();
			newItem.url = url;
			newItem.attachments.push({title:"YouTube Link", snapshot:false, mimeType:"text/html", url:url});
		}
		if (xml..yt_duration.length()){
			var runningTime = xml..yt_duration[0].@seconds.toString();
			newItem.runningTime = runningTime + " seconds";
		}
		if (xml..media_description.length()){
			newItem.abstractNote = xml..media_description[0].text().toString();
		}
		
		var next_url = newItem.url.replace(/\/\/([^/]+)/, "//" + host).replace("watch?v=", "v/") + ''&rel=1'';
		Zotero.Utilities.loadDocument(next_url, function(newDoc) {
			var new_url = newDoc.location.href.replace("swf/l.swf", "get_video");
			newItem.attachments.push({url:new_url, title:"YouTube Video Recording", mimeType:"video/x-flv"});
			newItem.complete();
		}, function() {Zotero.done;});
	});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('e16095ae-986c-4117-9cb6-20f3b7a52f64', '1.0.0b4.r5', '', '2008-02-19 17:00:00', '0', '100', '4', 'Protein Data Bank', 'Michael Berkowitz', 'http://www.pdb.org/', 
'function detectWeb(doc, url) {
	if (doc.title.indexOf("Query Results") != -1) {
		return "multiple";
	} else if (url.indexOf("structureId") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var proteins = new Array();
	if (detectWeb(doc, url) == "multiple") {
		//search results
		var items = new Object();
		var xpath = ''//a[@class="qrb_title"]'';
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href.match(/structureId=(.*)/)[1]] = next_title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			proteins.push(i);
		}
	} else {
		proteins = [url.match(/structureId=(.*)/)[1]];
	}
	
	Zotero.debug(proteins);
	for (var p in proteins) {
		var xmlstr = ''http://www.pdb.org/pdb/download/downloadFile.do?fileFormat=xml&headerOnly=YES&structureId='' + proteins[p];
		Zotero.debug(xmlstr);
		
		Zotero.Utilities.HTTP.doGet(xmlstr, function(text) {
			var item = new Zotero.Item("journalArticle");
			text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "").replace(/PDBx\:/g, "");
			var article = text.split(''<citation id="primary">'');
			var art = article[1].split(/<\/citation>\n/);
			art = "<citation>" + art[0] + "</citation>";
			var xml = new XML(art);
			var info = text.split(''<database_PDB_revCategory>'')[1].split(''</database_PDB_revCategory>'')[0];
			var xml2 = new XML("<PDB_revCategory>" + info + "</PDB_revCategory>");
			var aus = text.split(''<citation_authorCategory>'')[1].split(''</citation_authorCategory>'')[0];
			aus = "<authors>" + aus + "</authors>";
			var xml3 = new XML(aus);
			
			item.title = xml..title.text().toString();
			item.publicationTitle = xml..journal_abbrev.text().toString();
			item.volume = xml..journal_volume.text().toString();
			item.pages = xml..page_first.text().toString() + "-" + xml..page_last.text().toString();
			item.ISSN = xml..journal_id_ISSN.text().toString();
			item.extra = "PubMed ID: " + xml..pdbx_database_id_PubMed.text().toString();
			if (xml..pdbx_database_id_DOI.length()) {
				item.DOI = xml..pdbx_database_id_DOI.text().toString();
			}
			item.date = xml2..date_original.text().toString();
			item.url = ''http://www.pdb.org/pdb/explore/explore.do?structureId='' + xml2..replaces.text().toString();
			
			var authors = xml3..citation_author.toString().split(/\n/);
			for (var i in authors) {
				var name = authors[i].match(/name=\"([^"]+)\"/)[1].split(", ");;
				Zotero.debug(name);
				item.creators.push({firstName:name[1], lastName:name[0], creatorType:"author"});
			}
			item.attachments = [
				{url:item.url, title:"PDB Snapshot", mimeType:"text/html"},
				{url:''http://www.pdb.org/pdb/download/downloadFile.do?fileFormat=pdb&compression=NO&structureId='' + proteins[p], title:"Protein Data Bank .pdb File", mimeType:"chemical/x-pdb"}
			]
			item.complete();
		});
		Zotero.done;
	}
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('0a01d85e-483c-4998-891b-24707728d83e', '1.0.0b4.r5', '', '2008-02-14 23:15:00', '0', '100', '4', 'AJHG', 'Michael Berkowitz', 'http://(www.)?ajhg.org/', 
'function detectWeb(doc, url) {
	if (doc.evaluate(''//div[@class="article_links"]/a[1]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("abstract") != -1 || url.indexOf("fulltext") != -1) {
		return "journalArticle";
	}
}', 
'function getID(str) {
	str =  str.match(/\/([^/]+)$/)[1];
	if (str.indexOf("#") != -1) {
		str = str.substr(0, str.length - 1);
	}
	return str;
}

function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.title.indexOf("Search Results") != -1) {
			var xpath = ''//table[@id="search_results"]/tbody/tr/td[1]'';
			var titlex = ''./strong'';
			var linkx = ''./div/a[1]'';
		} else {
			var xpath = ''//div[@id="main_toc"]/dl'';
			var titlex = ''./dt'';
			var linkx = ''./dd/div/a[1]'';
		}
		var blocks = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_block;
		while (next_block = blocks.iterateNext()) {
			var title = doc.evaluate(titlex, next_block, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var link = doc.evaluate(linkx, next_block, null, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(getID(i));
		}
	} else {
		articles = [getID(url)];
	}
	Zotero.debug(articles);
	for (var i in articles) {
		var poststr = ''format=cite-abs&citation-type=RIS&pii='' + articles[i] + ''&action=download&Submit=Export'';
		var pdfurl = ''http://download.ajhg.org/AJHG/pdf/PII'' + articles[i].replace(/(\(|\)|\-)/g, "") + ''.pdf'';
		var newurl = ''http://www.ajhg.org/AJHG/fulltext/'' + articles[i];
		Zotero.Utilities.HTTP.doPost(''http://ajhg.org/AJHG/citationexport'', poststr, function(text) {
			var trans = Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(text);
			trans.setHandler("itemDone", function(obj, item) {
				item.attachments = [
					{url:newurl, title:"AJHG Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:"AJHG Full Text PDF", mimeType:"application/pdf"}
				];
				
				if (item.notes[0]["note"]) {
					item.abstractNote = item.notes[0]["note"];
				}
				item.notes = [];
				item.complete();
			});
			trans.translate();
			Zotero.done();
		});
	}
	Zotero.wait();
	
}');

REPLACE INTO translators VALUES ('f26cfb71-efd7-47ae-a28c-d4d8852096bd', '1.0.0b4.r5', '', '2008-02-14 23:15:00', '0', '99', '4', 'Cell Press', 'Michael Berkowitz', 'http://www.(cancercell|cell|cellhostandmicrobe|cellmetabolism|cellstemcell|chembiol|current-biology|developmentalcell|immunity|molecule|neuron|structure).(org|com)', 
'function detectWeb(doc, url) {
	if (url.indexOf("search/results?") != -1) {
		return "multiple";
	} else if (url.indexOf("content/article") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = ''//form[@id="search_results_form"]/dl/dd'';
		var arts = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_art;
		while (next_art = arts.iterateNext()) {
			var title = doc.evaluate(''./strong'', next_art, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var link = doc.evaluate(''./nobr[1]/a'', next_art, null, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	Zotero.Utilities.processDocuments(articles, function(newDoc) {
		var newItem = new Zotero.Item("journalArticle");
		newItem.title = newDoc.evaluate(''//h1[@class="article_title"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		var voliss = newDoc.evaluate(''//div[@class="article_citation"]/p[1]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(".")[2].split(",");
		newItem.publicationTitle = voliss[0];
		newItem.volume = voliss[1].match(/\d+/)[0];
		newItem.pages = voliss[2];
		newItem.date = voliss[3];
		newItem.abstractNote = newDoc.evaluate(''//div[@class="panelcontent article_summary"]/p[contains(text(), " ")]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		var authors = newDoc.evaluate(''//p[@class="authors"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(",");
		for (var i in authors) {
			var next_author = authors[i];
			if (next_author.match(/[a-z]/)) {
				next_author = Zotero.Utilities.trimInternal(next_author.match(/[\w\s\.\-]+/)[0].replace(/\d/g, ""));
				if (next_author.substr(0, 3) == "and") {
					next_author = next_author.substr(4);
				}
				newItem.creators.push(Zotero.Utilities.cleanAuthor(next_author, "author"));
			}
		}
		var pdfx = ''//a[contains(text(), "PDF")]'';
		var pdfurl = newDoc.evaluate(pdfx, newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		var newurl = newDoc.location.href;
		if (newurl.indexOf("abstract") != -1) {
			newurl = newurl.replace("abstract", "fulltext");
		}
		newItem.attachments = [
			{url:url, title:"Cell Press Snapshot", mimeType:"text/html"},
			{url:pdfurl, title:"Cell Press Full Text PDF", mimeType:"application/pdf"}
		];
		newItem.complete();
	}, function() {Zotero.done;});
	
}');

REPLACE INTO translators VALUES ('0cc8e259-106e-4793-8c26-6ec8114a9160', '1.0.0b4.r5', '', '2008-02-13 11:30:00', '1', '99', '4', 'SlideShare', 'Michael Berkowitz', 'http://www.slideshare.net/', 
'function detectWeb(doc, url) {
	if (url.indexOf("search") != -1) {
		return "multiple";
	} else if (doc.evaluate(''//div[@class="slideProfile"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "presentation";
	}
}', 
'function doWeb(doc, url) {
	var loggedin = false;
	if (doc.evaluate(''//a[@class="green_link"][text() = "logout"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		loggedin = true;
	}
	var shows = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var links = doc.evaluate(''//div[@class="search_list_box"]/div[@class="text_12"]/a'', doc, null, XPathResult.ANY_TYPE, null);
		var next_link;
		while (next_link = links.iterateNext()) {
			items[next_link.href] = Zotero.Utilities.trimInternal(next_link.textContent);
		}
		items = Zotero.selectItems(items);
		if (!items) {
			return true;
		}
		for (var i in items) {
			shows.push(i);
		}
	} else {
		shows = [url];
	}
	Zotero.Utilities.processDocuments(shows, function(newDoc) {
		var downloadable = true;
		if (newDoc.evaluate(''//p[@class="upload_p_left"][contains(text(), "Download not available")]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			downloadable = false;
		}
		var item = new Zotero.Item("presentation");
		item.title = newDoc.evaluate(''//div[@class="slideProfile"]//h3'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		var creator = newDoc.evaluate(''//div[@class="slideProfile"]//p/a[@class="blue_link_normal"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		item.creators.push(Zotero.Utilities.cleanAuthor(creator, "author"));
		var tags = newDoc.evaluate(''//a[@class="grey_tags"]'', newDoc, null, XPathResult.ANY_TYPE, null);
		var next_tag;
		while (next_tag = tags.iterateNext()) {
			item.tags.push(Zotero.Utilities.trimInternal(next_tag.textContent));
		}
		var newurl = newDoc.location.href;
		item.url = newurl;
		item.repository = "SlideShare";
		var pdfurl;
		if (newurl.substr(-1) == "/") {
			pdfurl = newurl + "download";
		} else {
			pdfurl = newurl + "/download";
		}
		if (loggedin) {
			if (downloadable) {
				item.attachments.push({url:pdfurl, title:"SlideShare Slide Show", mimeType:"application/pdf"});
			}
		}
		item.complete();
	}, function() {Zotero.done;});
}');

REPLACE INTO translators VALUES ('8b35ab14-f18a-4f69-8472-b2df18c984da', '1.0.0b4.r5', '', '2008-04-01 04:50:00', '1', '100', '4', 'Davidson College Library', 'Michael Berkowitz', 'http://www.lib.davidson.edu/', 
'function detectWeb(doc, url) {
	if (url.indexOf("log_in") == -1) {
		if (url.indexOf("screen=Record") != -1) {
			return "book";
		} else {
			return "multiple";
		}
	}
}', 
'function doWeb(doc, url) {
	var books = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = Zotero.Utilities.getItemArray(doc, doc, ''screen=Record.html'');
		items = Zotero.selectItems(items);
		for (var i in items) {
			books.push(i.replace("Record.html", "MARCRecord.html"));
		}
	} else {
		books = [url.replace("Record.html", "MARCRecord.html")];
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	Zotero.Utilities.processDocuments(books, function(newDoc) {
		var uri = newDoc.location.href;
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		var nonstandard = false;
		var xpath;
		var xpath = ''//td[@class="body"]/p/table/tbody/tr[td[3]]'';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		var record = new marc.record();
		while(elmt = elmts.iterateNext()) {
			var field = Zotero.Utilities.trimInternal(newDoc.evaluate(''./td[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			if(field) {
				var value = newDoc.evaluate(''./td[3]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				if(field == "LDR") {
					record.leader = value;
				} else if(field != "FMT") {
					value = value.replace(/\$([a-z]) /g, marc.subfieldDelimiter+"$1");
					var code = field.substring(0, 3);
					var ind = "";
					if(field.length > 3) {
						ind = field[3];
						if(field.length > 4) {
							ind += field[4];
						}
					}
				
					record.addField(code, ind, value);
				}
			}
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = "Davidson College Library Catalog";
		newItem.complete();
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('1885b93c-cf37-4b25-aef5-283f42eada9d', '1.0.0b4.r5', '', '2008-02-01 19:30:00', '0', '100', '4', 'Informaworld', 'Michael Berkowitz', 'http://www.informaworld.com', 
'function detectWeb(doc, url) {
	if (url.indexOf("quicksearch") != -1) {
		return "multiple";
	} else if (doc.evaluate(''//a[substring(text(), 2, 8) = "Download"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		if (doc.evaluate(''//div[@id="metahead"]/div/strong[text() = "Published in:"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var pubtype = doc.evaluate(''//img[substring(@title, 1, 17) = "Publication type:"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext().title;
			if (pubtype.match("journal")) {
				return "journalArticle";
			} else if (pubtype.match("book")) {
				return "bookSection";
			}
		} else {
			return "book";
		}
	} else if (url.indexOf("content=g") != -1 || 
			doc.evaluate(''//div[@id="browse"]//tbody/tr/td[2]/a[2]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext() ||
			doc.evaluate(''//div[@id="title"]//td[2]/div/strong/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else {
		return true;
	}
}
', 
'function doWeb(doc, url) {
	var links = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.evaluate(''//div[@id="quicksearch"]//tr/td/b/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = ''//div[@id="quicksearch"]//tr/td/b/a'';
		} else if (doc.evaluate(''//div[@id="title"]/table/tbody/tr[2]//strong/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = ''//div[@id="title"]/table/tbody/tr[2]//strong/a'';
		} else if (doc.evaluate(''//div[@id="browse"]//tbody/tr/td[2]/a[2]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = ''//div[@id="browse"]//tbody/tr/td[2]/a[2]'';
		} else if (doc.evaluate(''//div[@id="title"]//td[2]/div/strong/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = ''//div[@id="title"]//td[2]/div/strong/a'';
		}
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var title = titles.iterateNext();
		while (title) {
			items[title.href] = title.textContent;
			title = titles.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			links.push(i);
		}
	} else {
		links = [url];
	}
	Zotero.debug(links);
	
	Zotero.Utilities.processDocuments(links, function(newDoc) {
		var xpath = ''//div[@id="metahead"]/div'';
		var stuff = newDoc.evaluate(xpath, newDoc, null, XPathResult.ANY_TYPE, null);
		var thing = stuff.iterateNext() ;
		while (thing) {
			if (thing.textContent.match(/DOI/)) {
				var doi = Zotero.Utilities.trimInternal(thing.textContent).match(/:\s+(.*)/)[1];
			}
			thing = stuff.iterateNext();
		}
		
		var id = newDoc.location.href.match(/content=([\w\d]+)/);
		var post = ''tab=citation&selecteditems='' + id[1].substr(1) + ''&content='' + id[1] + ''&citstyle=refworks&showabs=false&format=file'';
		Zotero.Utilities.HTTP.doPost(''http://www.informaworld.com/smpp/content'', post, function(text) {
			text = text.replace(/RT/, "TY");
			text = text.replace(/VO/, "VL");
			text = text.replace(/LK/, "UR");
			text = text.replace(/YR/, "PY");
			text = text.replace(/([A-Z][A-Z\d]\s)/g, "$1 - ")
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				var type = text.match(/TY\s+\-\s+([^\n]*)/)[1];
				Zotero.debug(type);
				if (type == "Journal") {
					item.itemType = "journalArticle";
				} else if (type == "Book, Whole") {
					item.itemType = "book";
				} else if (type == "Book, Section") {
					item.itemType = "bookSection";
				}
				if (doi) {
					item.DOI = doi;
				}
				item.complete();
			});
			translator.translate();
			
		});
	}, function() {Zotero.done;});
}');

REPLACE INTO translators VALUES ('f880bf79-d42f-4337-b0d2-7a7de4a48b7d', '1.0.0b4.r5', '', '2008-02-06 21:00:00', '0', '100', '4', 'Library Catalog (X-OPAC)', 'Michael Berkowitz', '(xopac|hylib)', 
'function detectWeb(doc, url) {
	if (url.indexOf("&nd=") != -1) {
		return "book";
	} else if (url.indexOf("Aktion") != -1) {
		return "multiple";
	}
}', 
'function doWeb(doc, url) {
	var ids = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var xpath = ''//table/tbody/tr/td//a'';
		var links = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var link = links.iterateNext();
		var items = new Object();
		while (link) {
			if (link.href.match(/&nd=\d+/)) {
				items[link.href.match(/&nd=(\d+)/)[1]] = Zotero.Utilities.trimInternal(link.textContent);
			}
			link = links.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			ids.push(i);
		}
	} else {
		ids = [url.match(/&nd=(\d+)/)[1]];
	}
	Zotero.debug(ids);
	for (var i = 0 ; i < ids.length ; i++) {
		var post = ''db=ubfr&nd='' + ids[i] + ''&counter=0&Aktion=S&VomOLAF=0&links=1&gk=&format=ris'';
		Zotero.Utilities.HTTP.doPost(''http://www.ub.uni-freiburg.de/cgi-bin/refman'', post, function(text) {
			//Zotero.debug(text);
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.translate();
		});
	}
}');

REPLACE INTO translators VALUES ('0cdc6a07-38cf-4ec1-b9d5-7a3c0cc89b15', '1.0.0b4.r5', '', '2008-01-30 21:00:00', '0', '100', '4', 'OSTI Energy Citations', 'Michael Berkowitz', 'http://www.osti.gov/energycitations', 
'function detectWeb(doc, url) {
	if (doc.evaluate(''//table[@class="searchresults"]//a[@class="citation"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("product.biblio.jsp") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var urls = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = ''//table[@class="searchresults"]//a[@class="citation"]'';
		var links = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_link;
		while (next_link = links.iterateNext()) {
			items[next_link.href] = next_link.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			urls.push(i.match(/osti_id=\d+/)[0]);
		}
	} else {
		urls = [url.match(/osti_id=\d+/)[0]];
	}
	for (var i = 0 ; i < urls.length ; i++) {
		var getstr = ''http://www.osti.gov/energycitations/endnote?osti_id=140097'';
		Zotero.Utilities.HTTP.doGet(getstr, function(text) {
			text = text.replace(/(%.)/g, "$1 ");
			var trans = Zotero.loadTranslator("import");
			trans.setTranslator("881f60f2-0802-411a-9228-ce5f47b64c7d");
			trans.setString(text);
			trans.translate();
		});
	}
}');

REPLACE INTO translators VALUES ('4345839f-b4fd-4e3f-a73d-268b6f280f6e', '1.0.0b4.r5', '', '2008-01-29 20:00:00', '0', '100', '4', 'Journal of Vision', 'Michael Berkowitz', 'http://(www.)?journalofvision.org/', 
'function detectWeb(doc, url) {
	if (url.indexOf("search.aspx?") != -1 ||  url.match(/\d+/g).length == 2) {
		return "multiple";
	} else if (url.match(/\d+/g).length == 3) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var urls = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		 if (doc.evaluate(''//a[@class="AbsTitle"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		 	var xpath = ''//a[@class="AbsTitle"]'';
		 } else if (doc.evaluate(''//a[@class="toc_ArticleTitle"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		 	var xpath = ''//a[@class="toc_ArticleTitle"]'';
		 }
		 var articles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		 var next_art;
		 while (next_art = articles.iterateNext()) {
			 items[next_art.href] = next_art.textContent;
		 }
		items = Zotero.selectItems(items);
		for (var i in items) {
			urls.push(i);
		}
	} else {
		urls.push(url);
	}
	Zotero.debug(urls);
	
	Zotero.Utilities.processDocuments(urls, function(newDoc) {
		var rislink = newDoc.evaluate(''//div[@id="block0"]/table/tbody/tr/td[@class="body"]/a'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().href.replace("info/GetCitation", "AutomaticCitationDownload") + ''&type=ReferenceManager'';
		var DOI = newDoc.evaluate(''//td[2]/span[@class="toc_VolumeLine"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/doi:\s*(.*)$/)[1];
		var PDF = newDoc.evaluate(''//div[@class="jovHistory"]//td[2]/a'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		Zotero.debug(rislink);
		Zotero.Utilities.HTTP.doGet(rislink, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.DOI = DOI;
				item.publicationTitle = "Journal of Vision";
				item.attachments = [{url:PDF, title:"Journal of Vision Full Text PDF", mimeType:"application/pdf"}];
				item.complete();
			});
			translator.translate();
		});
	}, function() {Zotero.done;});
}');

REPLACE INTO translators VALUES ('966a7612-900c-42d9-8780-2a3247548588', '1.0.0b4.r5', '', '2008-01-25 20:00:00', '0', '100', '4', 'eMJA', 'Michael Berkowitz', 'http://www.mja.com.au/', 
'function detectWeb(doc, url) {
	if (doc.evaluate(''//p[@class="Pfoot"]/b/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext() || doc.evaluate(''/html/body/table/tbody/tr[1]/td[2]/a/b'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.title.indexOf("eMJA:") != -1) {
		return "journalArticle";
	}
}', 
'function senCase(string) {
	var smallwords = Array("and", "a", "in", "the", "by", "of", "s", "on");
	var sen = string.split(/\b/);
	for (var i = 0 ; i < sen.length; i++) {
		if (sen[i].match(/\w+/)) {
			if (smallwords.indexOf(sen[i]) != -1 && i != 0) {
				sen[i] = sen[i].toLowerCase();
			} else {
				sen[i] = sen[i][0].toUpperCase() + sen[i].substring(1).toLowerCase();
			}
		}
	}
	return sen.join("");
}

function doWeb(doc, url) {
	var URIs = new Array();
	
	if (doc.evaluate(''//p[@class="Pfoot"]/b/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var xpath = ''//p[@class="Pfoot"]/b/a'';
	} else if (doc.evaluate(''//tr[1]/td[2]/a/b'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var xpath = ''//tr[1]/td[2]/a/b'';
		var linkpath = ''//tr[2]/td[2]/small[@class="gr"]'';
	}
	
	if (xpath) {
		if (linkpath) {
			var items = new Object();
			var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
			var links = doc.evaluate(linkpath, doc, null, XPathResult.ANY_TYPE, null);
			var title = titles.iterateNext();
			var link = links.iterateNext();
			while (title) {
				//Zotero.debug(Zotero.Utilities.cleanString(title.textContent));
				//Zotero.debug(Zotero.Utilities.cleanString(link.textContent));
				items[Zotero.Utilities.cleanString(link.textContent)] = Zotero.Utilities.cleanString(title.textContent).substring(6);
				title = titles.iterateNext();
				link = links.iterateNext();
			}
		} else {
			var items = new Object();
			var things = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
			var next_thing = things.iterateNext();
			while (next_thing) {
				items[next_thing.href] = senCase(Zotero.Utilities.cleanString(next_thing.textContent));
				next_thing = things.iterateNext();
			}
		}
		items = Zotero.selectItems(items);
		Zotero.debug(items);
		for (var i in items) {
			URIs.push(i);
		}
	} else {
		URIs.push(url);
	}
	Zotero.debug(URIs);
	Zotero.Utilities.processDocuments(URIs, function(newDoc) {
		var newItem = new Zotero.Item("journalArticle");
		newItem.title = senCase(newDoc.title.substring(6));
		
		newItem.publicationTitle = "The Medical Journal of Australia";
		newItem.ISSN = "0025-729X";
		newItem.url = newDoc.location.href;
		
		//date
		newItem.date = newDoc.evaluate(''//meta[@name="date"]/@content'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.substring(0,10);
		
		//voliss
		var voliss = newDoc.evaluate(''//meta[@name="citation"]/@content'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		//voliss = voliss.match(/[^\d]+(\d+)\s+\((\d+)\)/);
		voliss = voliss.match(/;\s+(\d+)\s+\((\d+)[^:]+:\s+(.*)\.$/);
		newItem.volume = voliss[1];
		newItem.issue = voliss[2];
		newItem.pages = voliss[3];
		
		//authors
		var authors = new Array();
		var apath = ''//div[@class="By"]/span[@class="Pn"]'';
		var author = newDoc.evaluate(apath, newDoc, null, XPathResult.ANY_TYPE, null);
		var next_a = author.iterateNext();
		while (next_a) {
			var name = next_a.textContent;
			if (name.substring(0,1) == ",") {
				name = name.substring(2);
			} else if (name.substring(0,4) == " and") {
				name = name.substring(5);
			}
			authors.push(name);
			next_a = author.iterateNext();
		}
		
		for (var i in authors) {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));
		}
		
		//attachments
		newItem.attachments = [
			{url:newDoc.location.href, title:"eMJA Snapshot", mimeType:"text/html"},
			{url:newDoc.location.href.replace(".html", ".pdf") , title:"eMJA PDF", mimeType:"application/pdf"}
		];
		newItem.complete();
	}, function() {Zotero.done;});
}');

REPLACE INTO translators VALUES ('303c2744-ea37-4806-853d-e1ca67be6818', '1.0.0b4.r5', '', '2008-04-01 04:50:00', '0', '100', '4', 'CSIRO Publishing', 'Michael Berkowitz', 'http://(www.)?publish.csiro.au/', 
'function detectWeb(doc, url) {
	if (doc.evaluate(''//a[@class="searchBoldBlue"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext() || doc.evaluate(''//td[2]/a[@class="linkJournal"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("/view/journals/") != -1 || url.indexOf("paper") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var links = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.evaluate(''//a[@class="searchBoldBlue"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var arts = doc.evaluate(''//a[@class="searchBoldBlue"]'', doc, null, XPathResult.ANY_TYPE, null);
			var art = arts.iterateNext();
			while (art) {
				items[art.href] = art.textContent;
				art = arts.iterateNext();
			}
		} else if (doc.evaluate(''//td[2]/a[@class="linkJournal"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var arts = doc.evaluate(''//td[2]/a[@class="linkJournal"]'', doc, null, XPathResult.ANY_TYPE, null);
			var titles = doc.evaluate(''//td[3]//td[1]/table/tbody/tr/td/b'', doc, null, XPathResult.ANY_TYPE, null);
			var art = arts.iterateNext();
			var title = titles.iterateNext();
			while (art) {
				items[art.href] = title.textContent;
				art = arts.iterateNext();
				title = titles.iterateNext();
			}
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			links.push(i.match(/([^/=.htm]*)(.htm)?$/)[1]);
		}
	} else {
		links.push(url.match(/([^/=.htm]*)(.htm)?$/)[1]);
	}
	for (var i in links) {
		var newURL = ''http://www.publish.csiro.au/view/journals/dsp_journal_retrieve_citation.cfm?ct='' + links[i] + ''.ris'';
		var pdfURL = ''http://www.publish.csiro.au/?act=view_file&file_id='' + links[i] + ''.pdf'';
		Zotero.Utilities.HTTP.doGet(newURL, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.itemType = "journalArticle";
				if (item.notes[0]) {
					item.abstractNote = item.notes[0].note;
				}
				item.attachments = [
					{url:pdfURL, title:"CSIRO Publishing PDF", mimeType:"application/pdf"},
					{url:newURL, title:"CSIRO Publishing Snaphost", mimeType:"text/html"}
				];
				item.complete();
			});
			translator.translate();
		});
	}
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('27ee5b2c-2a5a-4afc-a0aa-d386642d4eed', '1.0.0b4.r5', '', '2008-03-06 23:15:00', '1', '100', '4', 'PubMed Central', 'Michael Berkowitz', 'http://[^/]*.nih.gov/', 
'function detectWeb(doc, url) {
	if (doc.evaluate(''//table[@id="ResultPanel"]//td[2]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("articlerender") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var tagMap = {journal_title:"publicationTitle",
					title:"title",
					date:"date",
					issue:"issue",
					volume:"volume",
					doi:"DOI",
					fulltext_html_url:"url"
				}
	var URIs = new Array();
	var items = new Object();
	if (doc.title.indexOf("PMC Results") != -1) {
		var titlex = ''//div[@class="toc-entry"]/div/div[@class="toc-title"]'';
		var linkx = ''//div[@class="toc-entry"]/div/a[@class="toc-link"][1]'';
		
		var titles = doc.evaluate(titlex, doc, null, XPathResult.ANY_TYPE, null);
		var next_title = titles.iterateNext();
		var links = doc.evaluate(linkx, doc, null, XPathResult.ANY_TYPE, null);
		var next_link = links.iterateNext();
		while (next_title && next_link) {
			items[next_link.href] = next_title.textContent;
			next_title = titles.iterateNext();
			next_link = links.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			URIs.push(i);
		}
	} else {
		URIs.push(url);
	}
	
	for each (var link in URIs) {
		Zotero.Utilities.HTTP.doGet(link, function(text) {
			var tags = new Object();
			var meta = text.match(/<meta[^>]*>/gi);
			for (var i in meta) {
				var item = meta[i].match(/=\"([^"]*)\"/g);
				if (item[0].substring(2, 10) == ''citation'') {
					tags[item[0].substring(11, item[0].length - 1)] = item[1].substring(2, item[1].length - 1);
				}
			}
			var newItem = new Zotero.Item("journalArticle");
			for (var tag in tagMap) {
				newItem[tagMap[tag]] = Zotero.Utilities.unescapeHTML(tags[tag]);
			}
			for (var i in meta) {
				if (meta[i].match(/DC.Contributor/)) {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(meta[i].match(/content=\"([^"]*)\">/)[1], "author"));
				}
			}
			newItem.attachments.push({url:tags["fulltext_html_url"], title:"PubMed Central Snapshot", mimeType:"text/html"});
			if (tags["pdf_url"]) {	
				newItem.attachments.push({url:tags["pdf_url"], title:"PubMed Central Full Text PDF", mimeType:"application/pdf"});
			}
			newItem.url = tags["fulltext_html_url"];
			newItem.extra = text.match(/PMC\d+/)[0];
			newItem.complete();
		});
	}
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('60d97c99-47f0-4323-98b6-5699faf827b1', '1.0.0b4.r5', '', '2008-01-09 20:00:00', '0', '100', '4', 'Blackwell Compass', 'Michael Berkowitz', 'http://www.blackwell-compass.com/subject/[^/]+/.+', 
'function detectWeb(doc, url) {
	if (url.indexOf("search_results") != -1 || url.indexOf("section_home") != -1) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var URIs = new Array();
	var items = new Object();
	if (detectWeb(doc, url) == "multiple") {
		
		var xpath = ''//div[@class="article-holder"]//h4[@class="article"]/a'';
		var articles = doc.evaluate(xpath, doc, namespace, XPathResult.ANY_TYPE, null);
		var next_art = articles.iterateNext();
		while (next_art) {
			items[next_art.href] = next_art.textContent;
			next_art = articles.iterateNext();
		}
		items = Zotero.selectItems(items);
		
		for (var i in items) {
			URIs.push(i);
		}
	} else {
		URIs.push(url);
	}
	
	Zotero.Utilities.processDocuments(URIs, function(doc, urll) {
		var doi = doc.evaluate(''//div[@id="content"]/p/span[@class="guide"]/a[substring(@href, 1, 4) = "http"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href.match(/doi\/[^/]*\/([^&]*)/)[1];
		Zotero.Utilities.HTTP.doGet(''http://www.blackwell-synergy.com/action/downloadCitation?doi='' + doi + ''&include=cit&format=refman&direct=on&submit=Download+references'', function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.attachments = [
					{url:item.url, title:"Blackwell Compass Snapshot", mimeType:"text/html"},
					{url:item.url.replace("/doi/abs", "/doi/pdf"), title:"Blackwell Compass Full Text PDF", mimeType:"application/pdf"}
				];
				
				item.complete();
		
			});
			
			translator.translate();
		});
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('ca6e95d1-46b9-4535-885c-df0c2d4b7f7a', '1.0.0b4.r5', '', '2008-01-07 19:00:00', '0', '100', '4', 'Innovate Online', 'Michael Berkowitz', '^http://(www.)?innovateonline.info/', 
'function detectWeb(doc, url) {
	if (url.indexOf("view=article") != -1) {
		return "journalArticle";
	} else if (url.indexOf("view=search") != -1) {
		return "multiple";
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	var newURIs = new Array();
	
	if (url.indexOf("view=search") != -1) {
		var titles = new Array();
		var hrefs = new Array();
		var items = new Object();
		var xpath = ''//ul[@class="articles"]/li[@class="result"]/div[@class="header"]'';
		var names = doc.evaluate(xpath, doc, namespace, XPathResult.ANY_TYPE, null);
		var next_item = names.iterateNext();
		while (next_item) {
			titles.push(next_item.textContent.split(/\n/)[3]);
			next_item = names.iterateNext();
		}
		
		var nextpath = ''//ul[@class="articles"]/li/@onclick'';
		var links = doc.evaluate(nextpath, doc, namespace, XPathResult.ANY_TYPE, null);
		var next_link = links.iterateNext();
		while (next_link) {
			hrefs.push(next_link.textContent);
			next_link = links.iterateNext();
		}
	
		for (var i = 0 ; i < titles.length ; i++) {
			items[hrefs[i].match(/\d+/)] = titles[i];
		}
		items = Zotero.selectItems(items);
		
		for (var i in items) {
			newURIs.push(''http://innovateonline.info/index.php?view=article&id='' + i);
		}
	} else {
		var newURL = url;
		if (newURL.indexOf("highlight") != -1) {
			newURL = newURL.substring(0, newURL.indexOf("highlight") -1);
		}
		if (newURL.indexOf("action=synopsis") != -1) {
			newURL = newURL.replace("action=synopsis", "action=article");
		}
		newURIs.push(newURL);
	}
	Zotero.debug(newURIs);
	
	Zotero.Utilities.processDocuments(newURIs, function(newDoc) {
		var newItem = new Zotero.Item("journalArticle");
		newItem.repository = "Innovate Online";
		newItem.publicationTitle = "Innovate";
		newItem.title = newDoc.title.substring(10);
		
		var authors = newDoc.evaluate(''//div[@id="title"]/div[@class="author"]/a'', newDoc, namespace, XPathResult.ANY_TYPE, null);
		var author = authors.iterateNext();
		while (author) {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author.textContent, "author"));
			author = authors.iterateNext();
		}
		
		newItem.date = newDoc.evaluate(''//div[@id="page"]/a/div[@class="title"]'', newDoc, namespace, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		
		var voliss = newDoc.evaluate(''//div[@id="page"]/a/div[@class="subtitle"]'', newDoc, namespace, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/Volume\s+(\d+).*Issue\s+(\d+)/);
		newItem.volume = voliss[1];
		newItem.issue = voliss[2];
		
		var id = newDoc.location.href.match(/\d+/)[0];
		var PDFurl = "http://innovateonline.info/print.php?view=pdf&id=" + id;
		newItem.attachments = [
			{url:newDoc.location.href, title:"Innovate Online Snapshot", mimeType:"text/html"},
			{url:PDFurl, title:"Innovate Online PDF", mimeType:"application/pdf"}
		]
		
		Zotero.Utilities.HTTP.doGet(newDoc.location.href.replace("action=article", "action=synopsis"), function(text) {
			var abs = text.match(/<div id=\"synopsis\">\n<p>(.*)<\/p>/)[1];
			newItem.abstractNote = Zotero.Utilities.unescapeHTML(Zotero.Utilities.cleanTags(abs));
			newItem.complete();
		});
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('bdae838b-3a58-461f-9e8a-142ed9de61dc', '1.0.0b4.r5', '', '2008-04-02 08:10:00', '1', '100', '4', 'PLoS Biology and Medicine', 'Michael Berkowitz', 'http://[^.]+\.plosjournals\.org/', 
'function detectWeb(doc, url)	{
	if (doc.evaluate(''//div[@class="search"][@id="browseResults"]/ul/li/span/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext() ||
		doc.evaluate(''//div[@id="toclist"]/dl/dt/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("get-document") != -1) {
		return "journalArticle";
	}
}', 
'function unescape(text)	{
	var specialreg=new RegExp("&#[^;]+;");
	var specials=specialreg.exec(text);
	while(specials)	{
		text=text.replace(specials[0], String.fromCharCode(parseInt(specials[0].substring(2, specials[0].length-1), 10)));
		specials=specialreg.exec(text);
	}
	return text;
}

function doWeb(doc, url) {
	var URLs = new Array();
	var items = new Object();
	if (detectWeb(doc, url) == "multiple") {
		if (doc.evaluate(''//div[@class="search"][@id="browseResults"]/ul/li/span/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = ''//div[@class="search"][@id="browseResults"]/ul/li/span/a'';
		} else if (doc.evaluate(''//div[@id="toclist"]/dl/dt/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = ''//div[@id="toclist"]/dl/dt/a'';
		}
		var articles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_article = articles.iterateNext();
		while (next_article) {
			items[next_article.href] = Zotero.Utilities.cleanString(next_article.textContent);
			next_article = articles.iterateNext();
		}
		items = Zotero.selectItems(items);
		
		if (!items) {
			return true;
		}
		
		for (var i in items) {
			URLs.push(i);
		}
	} else {
		URLs.push(url);
	}
	
	
	Zotero.Utilities.processDocuments(URLs, function(doc, url) {
		var bits = doc.location.href.match(/(^.*\?request=).*(doi=.*$)/);
		var RISurl = bits[1] + ''download-citation&t=refman&'' + bits[2];
		Zotero.Utilities.HTTP.doGet(RISurl, function(text) {
			var trans=Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(text);
			trans.setHandler("itemDone", function(obj, newItem)	{
				var urlstring= bits[1]+ ''get-pdf&'' +bits[2].replace("doi=", "file=").replace("/", "_").replace("%2F", "_") + ''-S.pdf'';
				newItem.attachments.push({url:urlstring, title:newItem.title, mimeType:"application/pdf"});
				
				var urlRE = /http:\/\/dx.doi.org\/(.*)$/;
				if (newItem.url) {
					newItem.DOI = newItem.url.match(urlRE)[1].replace("%2F", "/");
				}
				
				newItem.complete();
			});
			trans.translate();
			Zotero.done();
		});
		Zotero.wait();
	}, function() {Zotero.done;});
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('9575e804-219e-4cd6-813d-9b690cbfc0fc', '1.0.0b4.r5', '', '2008-04-02 08:30:00', '1', '100', '4', 'PLoS Journals', 'Michael Berkowitz', 'http://www\.plos(one|ntds|compbiol|pathogens|genetics)\.org/(search|article)/', 
'function detectWeb(doc, url) {
	if (url.indexOf("Search.action") != -1 || url.indexOf("browse.action") != -1) {
		return "multiple";
	} else if (url.indexOf("article") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var items = new Object();
	var texts = new Array();
	if (url.indexOf("Search.action") != -1 || url.indexOf("browse.action") != -1) {
		var articlex = ''//span[@class="article"]/a'';
		var articles = doc.evaluate(articlex, doc, null, XPathResult.ANY_TYPE, null);
		var next_art = articles.iterateNext();
		while (next_art) {
			items[next_art.href] = next_art.textContent;
			next_art = articles.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			texts.push(i);
		}
	} else {
		texts.push(url);
	}
	Zotero.Utilities.processDocuments(texts, function(newDoc, url) {
		var doi = newDoc.location.href.match(/doi(\/|%2F)(.*)$/)[2];
		var newURL = newDoc.location.href.replace("info", "getRisCitation.action?articleURI=info");
		var pdfURL = newDoc.location.href.replace("info", "fetchObjectAttachment.action?uri=info") + ''&representation=PDF'';
		Zotero.Utilities.HTTP.doGet(newURL, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.attachments.push({url:pdfURL, title:"PLoS One Full Text PDF", mimeType:"application/pdf"});
				item.DOI = doi;
				item.repository = item.publicationTitle;
				item.complete();
			});
			translator.translate();
		});	
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('b86bb082-6310-4772-a93c-913eaa3dfa1b', '1.0.0b4.r5', '', '2008-02-11 19:30:00', '0', '100', '4', 'Early English Books Online', 'Michael Berkowitz', 'http://[^/]*eebo.chadwyck.com[^/]*/search', 
'function detectWeb(doc, url) {
	if (doc.title == "Search Results - EEBO") {
		return "multiple";
	} else if (doc.title != "Basic Search - EEBO") {
		return "book";
	}
}', 
'function doWeb(doc, url) {
	var eeboIDs = new Array();
	
	var hostRegexp = new RegExp("^(https?://[^/]+)/");
	var hMatch = hostRegexp.exec(url);
	var host = hMatch[1];

	if (doc.title == "Search Results - EEBO") {
		var items = new Object();
		Zotero.debug("search page");
		var IDxpath = ''//td[3]/script'';
		var Titlexpath = ''//td[3]/i'';
		var new_ids = doc.evaluate(IDxpath, doc, null, XPathResult.ANY_TYPE, null);
		var new_titles = doc.evaluate(Titlexpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_id = new_ids.iterateNext();
		var next_title = new_titles.iterateNext();
		var IDRegex = /''(\d+)''/;
		while (next_id) {
			items[next_id.textContent.match(IDRegex)[1]] = next_title.textContent;
			next_id = new_ids.iterateNext();
			next_title = new_titles.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			eeboIDs.push(i);
		}
	} else {
		var IDRegex = /&ID=(\w+)&/
		var eeboid = url.match(IDRegex)[1];
		if (eeboid[0] == "D") {
			eeboid = eeboid.slice(7, 14);
		}
		eeboIDs.push(eeboid);
	}
	Zotero.debug(eeboIDs);
	for (var i = 0 ; i < eeboIDs.length ; i++) {
		var postString = ''cit_format=RIS&Print=Print&cit_eeboid='' + eeboIDs[i] + ''&EeboId='' + eeboIDs[i];
		var new_eeboid = eeboIDs[i]
		Zotero.Utilities.HTTP.doPost(host+''/search/print'', postString, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text.substring(17));
			translator.setHandler("itemDone", function(obj, item) {
				item.url = host+''/search/full_rec?SOURCE=pgimages.cfg&ACTION=ByID&ID='' + new_eeboid + ''&FILE=../session/1190302085_15129&SEARCHSCREEN=CITATIONS&SEARCHCONFIG=config.cfg&DISPLAY=ALPHA'';
				item.complete();
			});
			translator.translate();
			Zotero.done();
		});
	}
}');

REPLACE INTO translators VALUES ('d9be934c-edb9-490c-a88d-34e2ee106cd7', '1.0.0b4.r5', '', '2008-03-25 18:20:36', '0', '100', '4', 'Time.com', 'Michael Berkowitz', '^http://www.time.com/time/', 
'function detectWeb(doc, url) {
	if (doc.title == "TIME Magazine - Search Results") {
		return "multiple";
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == "x") return namespace; else return null;
		} : null;
		
		var xpath = ''//meta[@name="byline"]'';
		var xpath2 = ''//div[@class="byline"]'';
		var xpath3 = ''//div[@class="copy"]/div[@class="byline"]'';
		if ((doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() || doc.evaluate(xpath2, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() || doc.evaluate(xpath3, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) ) {
			if (url.substr(-4,4) == "html") {
				return "newspaperArticle";
			}
		}
	}
}
', 
'function associateMeta(newItem, metaTags, field, zoteroField) {
	if (metaTags[field]) {
		newItem[zoteroField] = metaTags[field];
	}
}

function scrape(doc, url) {
	var newItem = new Zotero.Item("newspaperArticle");
	newItem.publicationTitle = "Time Magazine";
	newItem.ISSN = "0040-718X";
	newItem.url = doc.location.href;
	
	var metaTags = new Object();
	
	var metaTagHTML = doc.getElementsByTagName("meta")
	for (var i = 0 ; i < metaTagHTML.length ; i++) {
		metaTags[metaTagHTML[i].getAttribute("name")] = metaTagHTML[i].getAttribute("content");
	}
	
	if (metaTags["head"]) {
		associateMeta(newItem, metaTags, "head", "title");
	} else {
		newItem.title = doc.title.substr(0, doc.title.length - 7);
	}
	
	if (metaTags["description"]) {
		associateMeta(newItem, metaTags, "description", "abstractNote");
	}
	
	 if (metaTags["date"]) {
		 var date = metaTags["date"];
		 var months = new Object();
		 	months["jan"] = "January";
		 	months["feb"] = "February";
		 	months["mar"] = "March";
		 	months["apr"] = "April";
		 	months["may"] = "May";
		 	months["jun"] = "June";
		 	months["jul"] = "July";
		 	months["aug"] = "August";
		 	months["sep"] = "September";
		 	months["oct"] = "October";
		 	months["nov"] = "November";
		 	months["dec"] = "December";
		 date = date.split(".").join("").split(", ").slice(1);
		 date[0] = months[date[0].split(" ")[0].toLowerCase()] + " " + date[0].split(" ")[1];
		 newItem.date = date.join(", ");
	 }
	if (metaTags["keywords"]) {
		newItem.tags = Zotero.Utilities.cleanString(metaTags["keywords"]).split(", ");
		for (var i in newItem.tags) {
			if (newItem.tags[i] == "" || newItem.tags[i] == " ") {
				break;
			} else {
				var words = newItem.tags[i].split(" ");
				for (var j = 0 ; j < words.length ; j++) {
					Zotero.debug(words[j]);
					if (words[j][0] == words[j][0].toLowerCase() && words[j][0]) {
						words[j] = words[j][0].toUpperCase() + words[j].substr(1).toLowerCase();
					}
				}
			} 
			newItem.tags[i] = words.join(" ");
		}
	}
	
	if (metaTags["byline"]) {
		var byline = Zotero.Utilities.cleanString(metaTags["byline"]);
		var byline1 = byline.split(" and ");
		for (var i = 0 ; i < byline1.length ; i++) {
			var byline2 = byline1[i].split("/");
			for (var j = 0 ; j < byline2.length ; j++) {
				byline2[j] = Zotero.Utilities.cleanString(byline2[j]);
				if (byline2[j].indexOf(" ") == -1) {
					if (byline2[j].length == 2) {
						newItem.extra = byline2[j];
					} else {
						newItem.extra = byline2[j][0].toUpperCase() + byline2[j].substr(1).toLowerCase();
					}
				} else {
					byline3 = byline2[j].split(" ");
					for (var x = 0 ; x < byline3.length ; x++) {
						byline3[x] = byline3[x][0].toUpperCase() + byline3[x].substr(1).toLowerCase();
					}
					byline3 = byline3.join(" ");
					newItem.creators.push(Zotero.Utilities.cleanAuthor(byline3, "author"));
				}
			}
		}
	}
	newItem.complete();
}


function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x") return namespace; else return null;
	} : null;
	
	var urls = new Array();
	if (doc.title == "TIME Magazine - Search Results") {
		var items = new Array();
		var items = Zotero.Utilities.getItemArray(doc, doc.getElementById("search_results").getElementsByTagName("h3"), ''^http://www.time.com/time/.*\.html$'');
		Zotero.debug(items);

		items = Zotero.selectItems(items);
	
		if (!items) {
			return true;
		}
		
		for (var i in items) {
			if (i.match("covers") == null) {
				urls.push(i);
			}
		}
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); } );
	} else if (doc.evaluate(''//meta[@name="byline"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() || doc.evaluate(''//div[@class="byline"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() || doc.evaluate(''//div[@class="copy"]/div[@class="byline"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ) {
		scrape(doc, doc.location.href);
	}
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('b33bbb49-03d2-4175-91c4-3840501bc953', '1.0.0b4.r5', '', '2007-07-31 16:45:00', '1', '100', '4', 'Time-Blog.com', 'Michael Berkowitz', '^http://time-blog.com/', 
'function detectWeb(doc, url) {
	if (url.substr(-4,4) == "html") {
		return "blogPost";
	} else {
		return "multiple";
	}
}', 
'function scrape(doc, url) {
	var newItem = new Zotero.Item("blogPost");
	
	newItem.url = doc.location.href;
	newItem.title = doc.title.substr(0, doc.title.indexOf(" - "));
	
	var titleRE = new RegExp(''^http://time-blog.com/([^/]*)/'');
	var title = titleRE.exec(doc.location.href)[1].split("_");
	for (var i = 0 ; i < title.length ; i++) {
		title[i] = title[i][0].toUpperCase() + title[i].substr(1).toLowerCase();
	}
	newItem.blogTitle = title.join(" ");
	var metaTags = new Object();
	
	var metaTagHTML = doc.getElementsByTagName("meta");
	for (var i = 0 ; i < metaTagHTML.length ; i++) {
		metaTags[metaTagHTML[i].getAttribute("name")] = metaTagHTML[i].getAttribute("content");
	}
	
	if (metaTags["description"]) {
		newItem.abstractNote = Zotero.Utilities.cleanString(Zotero.Utilities.cleanTags(metaTags["description"]));
	}
	
	if (metaTags["date"]) {
		 var date = metaTags["date"];
		 var months = new Object();
		 	months["jan"] = "January";
		 	months["feb"] = "February";
		 	months["mar"] = "March";
		 	months["apr"] = "April";
		 	months["may"] = "May";
		 	months["jun"] = "June";
		 	months["jul"] = "July";
		 	months["aug"] = "August";
		 	months["sep"] = "September";
		 	months["oct"] = "October";
		 	months["nov"] = "November";
		 	months["dec"] = "December";
		 date = date.split(".").join("").split(", ");
		 date[0] = months[date[0].split(" ")[0].toLowerCase()] + " " + date[0].split(" ")[1];
		 newItem.date = date.join(", ");
	 }
	 
	 if (metaTags["keywords"]) {
		newItem.tags = metaTags["keywords"].split(", ");
		for (var i in newItem.tags) {
			if (newItem.tags[i] == "" || newItem.tags[i] == " ") {
				break;
			} else {
				var words = newItem.tags[i].split(" ");
				for (var j = 0 ; j < words.length ; j++) {
					if (words[j][0] == words[j][0].toLowerCase() && words[j][0]) {
						words[j] = words[j][0].toUpperCase() + words[j].substr(1).toLowerCase();
					}
				}
			} 
			newItem.tags[i] = words.join(" ");
		}
	}
	
	if (doc.evaluate(''//span[@class="postedby"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var byline = Zotero.Utilities.cleanString(doc.evaluate(''//span[@class="postedby"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		if (byline.substr(0,9).toLowerCase() == "posted by") {
			byline = byline.substr(10).split(" ");
		} else {
			byline.split(" ");
		}
		for (var i = 0; i < byline.length ; i++) {
			byline[i] = byline[i][0].toUpperCase() + byline[i].substr(1).toLowerCase();
		}
		newItem.creators.push(Zotero.Utilities.cleanAuthor(byline.join(" "), "author"));
	} else if (newItem.blogTitle == "Theag") {
		newItem.creators.push(Zotero.Utilities.cleanAuthor("Matthew Yeomans", "author"));
		newItem.blogTitle = "the Aggregator";
	}
	
	Zotero.debug(newItem);
	
	newItem.complete();
	
}

function doWeb(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x") return namespace; else return null;
	} : null;
	
	var URIS = new Array();
	
	var xpath = ''//h1[@class="entryTitle"]/a'';
	var articles = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var art = articles.iterateNext();
	var arts = new Array();
	var urls = new Array();
	while (art) {
		 arts.push(art.textContent);
		 urls.push(art.href);
		 art = articles.iterateNext();
	}
	if (arts.length > 1) {
		var items = new Object;
		for (var i  = 0; i < arts.length ; i++ ) {
			items[urls[i]] = arts[i];
		}
		items = Zotero.selectItems(items);
	
		for (i in items) {
			URIS.push(i);
		}
	} else {
		URIS.push(url);
	}
	Zotero.Utilities.processDocuments(URIS, scrape, function() { Zotero.done(); } );
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('9346ddef-126b-47ec-afef-8809ed1972ab', '1.0.0b4.r5', '', '2007-07-31 16:45:00', '1', '99', '4', 'Institute of Physics', 'Michael Berkowitz', '^http://www.iop.org/EJ/(toc|abstract|search)', 
'function detectWeb(doc, url) {
	if ((doc.location.href.indexOf("toc") == -1) && (doc.location.href.indexOf("search") == -1)) {
		Zotero.debug("journalArticle");
		return "journalArticle";
	} else {
		Zotero.debug("multiple");
		return "multiple";
	}
}', 
'function parseRIS(getURL, pdfURL) {   
    Zotero.Utilities.HTTP.doGet(getURL, function(text){
        // load translator for RIS
        var translator = Zotero.loadTranslator ("import");
        translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
        translator.setString(text);
        translator.setHandler("itemDone", function(obj, item) { 
		item.attachments = [
	    		{url:pdfURL, title:"IOP Full Text PDF", mimeType:"application/pdf"}
	    	];
	    	item.complete();
	});
	translator.translate();
        Zotero.done();
    }, function() {}); 

    Zotero.wait();
}


function doWeb(doc, url) {
    var namespace = doc.documentElement.namespaceURI;
    var nsResolver = namespace ? function(prefix) {
        if (prefix == "x" ) return namespace; else return null; 
    } : null;
    
    var xpath = ''//td[1][@id="toc-opts-left"]/span[@class="toclink"]/a[contains(text(), "Abstract")]'';
    var PDFs = new Array();
    var urls = new Array();
    var pdfurls = new Array();
    var items = new Array();
    
    if (doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
        var links = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
        var url = links.iterateNext();
        while (url) {
	        items.push(url.href);
	url = links.iterateNext ();
        }
        
        var titles = new Array();
        var xpath2 = ''//strong[@class="tocTitle"]'';
	var stuff = doc.evaluate(xpath2, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var title = stuff.iterateNext();
	while (title) {
		titles.push(title.textContent);
		title = stuff.iterateNext();
	}
        
        var xpath3 = ''//table/tbody/tr/td[2]/span[@class="toclink"]/a'';
        var PDFlinks = doc.evaluate(xpath3, doc, nsResolver, XPathResult.ANY_TYPE, null);
        var newPDF = PDFlinks.iterateNext();
        while (newPDF) {
	        PDFs.push(newPDF.href);
	        newPDF = PDFlinks.iterateNext();
        }
        
        var newItems = new Object();
        
        Zotero.debug(items.length);
        Zotero.debug(titles.length);
        for (var x = 0 ; x < items.length ; x++) {
            newItems[items[x]] = [titles[x], PDFs[x]];
        }
        
        
        Zotero.debug(newItems); 
        
        
        newItems = Zotero.selectItems(newItems);

        if (!newItems) {
            return true;
        }
        
        for (var i in newItems) {
            Zotero.debug(i);
            urls.push (i);
            var newStuff = newItems[i].split('','');
            pdfurls.push(Zotero.Utilities.cleanString(newStuff[newStuff.length - 1]));
        }
        
    } else {
        urls.push(doc.location.href);
        var xpath4 = ''//div[@id="abstract"]//td[2]/a'';
        pdfurls.push(doc.evaluate(xpath4, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href);
    }
    
    for (var i = 0 ; i < urls.length ; i++) {
        urls[i] = urls[i].replace("abstract", "sview"); 
    }
    
    Zotero.debug(urls);
    Zotero.debug(pdfurls);
    Zotero.Utilities.HTTP.doPost(urls, "format=refmgr&submit=1", function(text) {
        for (var j = 0 ; j < urls.length ; j++) {
            parseRIS(urls[j] + "?format=refmgr&submit=1", pdfurls[j]); 
        }
    });
    
    Zotero.wait();
}

');

REPLACE INTO translators VALUES ('6ec8008d-b206-4a4c-8d0a-8ef33807703b', '1.0.0b4.r5', '', '2007-08-27 02:00:00', '1', '100', '4', 'The Economist', 'Michael Berkowitz', '^http://(www.)?economist.com/', 
'function detectWeb(doc, url) {
       if (doc.location.href.indexOf("search") != -1) {
               return "multiple";
       } else if (doc.location.href.toLowerCase().indexOf("displaystory") != -1 || doc.location.href.indexOf("cityPage") != -1) {
               return "magazineArticle";
       }
}', 
'function scrape(doc, url) {
       var namespace = doc.documentElement.namespaceURI;
       var nsResolver = namespace ? function(prefix) {
               if (prefix == "x" ) return namespace; else return null;
       } : null;

       newItem = new Zotero.Item("magazineArticle");
       newItem.ISSN = "0013-0613";
       newItem.url = doc.location.href;
       newItem.publicationTitle = "The Economist";


       //get headline
       var title = new Array();
       if (doc.title && doc.title != "" && doc.title != "Economist.com") {
               title = doc.title.split(" | ");
       } else {
		title.push(doc.evaluate(''//div[@class="clear"][@id="pay-barrier"]/div[@class="col-left"]/div[@class="article"]/font/b'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
       }


       if (title.length == 1) {
               title.push = title;
       } else {
               title = title.slice(0, title.length - 1);
               title = title.join(": ");
       }
       newItem.title = title;

       if (doc.evaluate(''//div[@class="clear"][@id="pay-barrier"]/div[@class="col-right"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ) {
               newItem.extra =  "(Subscription only)";
       }

       //get abstract
       if (doc.evaluate(''//div[@id="content"]/div[@class="clear top-border"]/div[@class="col-left"]/h2'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ) {
               newItem.abstractNote = doc.evaluate(''//div[@id="content"]/div[@class="clear top-border"]/div[@class="col-left"]/h2'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
       } else if (doc.evaluate(''//div[@class="clear"][@id="pay-barrier"]/div[@class="col-left"]/div[@class="article"]/p/strong'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ) {
               newItem.abstractNote = doc.evaluate(''//div[@class="clear"][@id="pay-barrier"]/div[@class="col-left"]/div[@class="article"]/p/strong'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
       }
       
       if (newItem.abstractNote[newItem.abstractNote.length - 1] != ".") {
	       newItem.abstractNote += ".";
       }

       //get date and extra stuff
       if (doc.evaluate(''//div[@class="col-left"]/p[@class="info"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ) {
               newItem.date = doc.evaluate(''//div[@class="col-left"]/p[@class="info"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.substr(0,13);
       }
	
	var url = doc.location.href;
       newItem.attachments = [
       		{url:url.replace("displaystory", "PrinterFriendly"), title:"The Economist Snapshot", mimeType:"text/html"}
       	];
       	
       newItem.complete();
}


function doWeb(doc, url) {
       var namespace = doc.documentElement.namespaceURI;
       var nsResolver = namespace ? function(prefix) {
               if (prefix == "x" ) return namespace; else return null;
       } : null;

       var urls = new Array();

       if (doc.title == "Search | Economist.com") {
               var items = new Array();
               var uris = new Array();
               var results = doc.evaluate(''//ol[@class="search-results"]/li/h2/a'', doc, nsResolver, XPathResult.ANY_TYPE, null);
               var headline = results.iterateNext();
               while (headline) {
                       items.push(headline.textContent);
                       uris.push(headline.href);
                       headline = results.iterateNext();
               }

               var newItems = new Object();
               for (var i = 0 ; i <items.length ; i++) {
                       newItems[items[i]] = uris[i];
               }
               var newItems  = Zotero.Utilities.getItemArray(doc, doc, ''^http://(www.)*economist.com/(.*/)*(displaystory.cfm|cityPage.cfm)'');
               newItems = Zotero.selectItems(newItems);
               if (!newItems) {
                       return true;
               }

               for (var i in newItems) {
                       urls.push(i);
               }
       } else if (doc.location.href.toLowerCase().indexOf("displaystory") != -1) {
               urls.push(url);
       }
       
       Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
       
       Zotero.wait();

}');

REPLACE INTO translators VALUES ('84bd421d-c6d1-4223-ab80-a156f98a8e30', '1.0.0b4.r1', '', '2007-07-31 16:45:00', '0', '100', '4', 'International Herald Tribune', 'Michael Berkowitz', '^http://(www.)?iht.com/',
'function detectWeb(doc, url) {
	if (doc.title == "Search - International Herald Tribune" && doc.location.href != "http://www.iht.com/info/nytarchive.php") {
		return "multiple";
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == "x") return namespace; else return null;
		} : null;
		
		var xpath = ''//meta[@name="Headline"]'';
		if (doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			return "newspaperArticle";
		}
	}
}',
'function associateMeta(newItem, metaTags, field, zoteroField) {
	if(metaTags[field]) {
		newItem[zoteroField] = metaTags[field];
	}
}

function scrape(doc, url) {
	var newItem = new Zotero.Item("newspaperArticle");
	newItem.publicationTitle = "The International Herald Tribune";
	newItem.ISSN = "0294-8052";
	newItem.url = doc.location.href;
	
	var metaTags = new Object();
	
	var metaTagHTML = doc.getElementsByTagName("meta");
	for (var i = 0 ; i < metaTagHTML.length ; i++) {
		metaTags[metaTagHTML[i].getAttribute("name")] = Zotero.Utilities.cleanTags(metaTagHTML[i].getAttribute("content"));
	}

	associateMeta(newItem, metaTags, "Headline", "title");
	associateMeta(newItem, metaTags, "PrintPubDate", "date");
	associateMeta(newItem, metaTags, "Summary", "abstractNote");
	associateMeta(newItem, metaTags, "ArticleID", "accessionNumber");
	associateMeta(newItem, metaTags, "Owner", "extra");
	
	if (metaTags["Author"]) {
		var author = Zotero.Utilities.cleanString(metaTags["Author"]);
		if (author.substr(0,3).toLowerCase() == "by ") {
			author = author.substr(3);
		}
		
		var authors = author.split(" and ");
		for each(var author in authors) {
			var words = author.split(" ");
			for (var i in words) {
				words[i] = words[i][0].toUpperCase() + words[i].substr(1).toLowerCase();
			}
			author = words.join(" ");
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
	}
	
	if (metaTags["keywords"]) {
		var keywords = metaTags["keywords"];
		newItem.tags = keywords.split(",");
		if (newItem.tags[0].toLowerCase()) {
			newItem.tags = newItem.tags.slice(1, newItem.tags.length);
		}
		Zotero.debug(newItem.tags);
		for (var i in newItem.tags) {
			if (newItem.tags[i] != "") {
				newItem.tags[i] = Zotero.Utilities.cleanString(newItem.tags[i].replace("  ", ", "));
				var words = newItem.tags[i].split(" ");
				for (var j = 0 ; j < words.length ; j++) {
					if (words[j][0] == words[j][0].toLowerCase()) {
						words[j] = words[j][0].toUpperCase() + words[j].substr(1).toLowerCase();
					}
				}
				newItem.tags[i] = words.join(" ");
			}
		}
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x" ) return namespace; else return null;
	} : null;
	
	var uris = new Array();
	if (doc.title == "Search - International Herald Tribune") {
		var result = doc.evaluate(''//td[@class="searchheadline"]/a'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var items = new Array();
		var elmt = result.iterateNext();
		while (elmt) {
			items.push(elmt.href);
			elmt = result.iterateNext();
		}
		var items = Zotero.Utilities.getItemArray(doc, doc, ''^http://(www.)*iht.com/articles/.*\.php$'');
		items = Zotero.selectItems(items);
		
		if (!items) {
			return true;
		}
		
		for (var i in items) {
			uris.push(i);
		}
		
	} else if (doc.evaluate(''//meta[@name="Headline"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		uris.push(url);
	}
		
	Zotero.Utilities.processDocuments(uris, scrape, function() { Zotero.done(); });
	
	Zotero.wait();
}
');

REPLACE INTO translators VALUES ('631ff0c7-2e64-4279-a9c9-ad9518d40f2b', '1.0.0b4.r5', '', '2007-08-14 22:15:00', '0', '100', '4', 'Stuff.co.nz', 'Michael Berkowitz', '^http://(www.)?stuff.co.nz/', 
'function detectWeb(doc, url) {
	if ((doc.location.href.indexOf("search-results") != -1) || (doc.location.href.indexOf("/blogs/blogs/") != -1 )) {
		return "multiple";
	} else if ((doc.location.href.indexOf("blogs") != -1) && (url != "http://www.stuff.co.nz/blogs/blogs") && (url != "http://stuff.co.nz/blogs/blogs")) {
		return "blogPost";
	} else if (doc.location.href.indexOf("html") == (doc.location.href.length - 4)){
		return "newspaperArticle";
	}
}', 
'function scrape(doc, url) {
	if (doc.location.href.indexOf("html") != -1) {
		var newItem = new Zotero.Item("newspaperArticle");
		newItem.url = doc.location.href;
		newItem.publicationTitle = "Stuff.co.nz";
		newItem.title = doc.title.split(" - ")[0];
		
		//abstract
		var xpath = ''//div[@id="leftcol_story"]/p/strong'';
		newItem.abstractNote = Zotero.Utilities.cleanString(doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		
		//date and author
		var xpath = ''//div[@id="story_headline"]'';
		var info = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(/\n+/)[2].split(" | ");
		
		newItem.date = Zotero.Utilities.cleanString(info[1].split(",")[1]);
		
		var author = Zotero.Utilities.cleanString(info[0]);
		if (author.substr(0,2).toLowerCase() == "by") {
			author = author.substr(3);
			if (author.indexOf(" - ") != -1) {
				author = author.split(" - ")[0].split(" ");
			} else {
				author = author.split(" ");
			}
			for (var i = 0 ; i < author.length ; i++) {
				author[i] = author[i][0] + author[i].substr(1).toLowerCase();
				var creator = author.join(" ");
			}
			newItem.creators.push(Zotero.Utilities.cleanAuthor(creator, "author"));
		} else {
			newItem.extra = author;
		}
	} else if (doc.location.href.indexOf("blogs") != -1) {
		var newItem = new Zotero.Item("blogPost");
		newItem.url = doc.location.href;

		//post title
		var xpath = ''//div[@class="post"]/h2[@class="storytitle"]/a'';
		newItem.title = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	
		//date and author
		var xpath = ''//div[@class="meta"][@id="postdate"]''
		var info = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(" | ");
		var byline = Zotero.Utilities.cleanString(info[0]).split(" in ");
		newItem.creators.push(Zotero.Utilities.cleanAuthor(byline[0], "author"));
		newItem.blogTitle = byline[1];
		var date = Zotero.Utilities.cleanString(info[1]).split("m ");
		newItem.date = date[1];
	}
	newItem.complete();
}

function doWeb(doc, url) {
	var URLS = new Array();
	
	//multiple
	if ((url.indexOf("search-results") != -1) || (url.indexOf("blogs/blogs/") != -1)) {
		if (url.indexOf("search-results") != -1) {
			var xpath = ''//div[@id="leftcol_story"]/p/a'';
		} else if (url.indexOf("blogs/blogs/") != -1) {
			var xpath = ''//h2[@class="storytitle"]/a'';
		}
	
		var items = new Object();
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var newTitle = titles.iterateNext();
		while (newTitle) {
			items[newTitle.href] = newTitle.textContent;
			newTitle = titles.iterateNext();
		}
		
		items = Zotero.selectItems(items);
		
		for (var i in items) {
			URLS.push(i);
		}
	} else {
		URLS.push(url);
	}
	
	Zotero.Utilities.processDocuments(URLS, scrape, function() {Zotero.done();});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('efb3c424-daa9-40c9-8ee2-983d2802b27a', '1.0.0b4.r5', '', '2007-08-14 22:15:00', '0', '100', '4', 'The Age', 'Michael Berkowitz', '^http://(www|search).theage.com.au/', 
'function detectWeb(doc, url) {
	if (url.indexOf("siteSearch.ac") != -1) {
		return "multiple";
	} else if (url.indexOf("html") != -1) {
		return "newspaperArticle";
	}
}', 
'function scrape(url) {
	Zotero.Utilities.HTTP.doGet(url, function(text) {
		var newItem = new Zotero.Item("newspaperArticle");
		newItem.ISSN = "0312-6307";
		newItem.url =url;
		newItem.publicationTitle = "The Age";
		Zotero.debug(url);
		
		//title
		var t = /<HEADLINE>(.*)<\/HEADLINE>/;
		newItem.title = Zotero.Utilities.unescapeHTML(Zotero.Utilities.capitalizeTitle(text.match(t)[1]).split(" - ")[0]);
		
		//meta tags? (except abstract, for some reason)
		var m = /name=\"(.*)\"\s+content=\"(.*)\"\s+\/>/g;
		var metaTags = text.match(m);
		var metaInfo = new Object();
		var metaNames = new Array();
		var m2 = /name=\"(.*)\"\s+content=\"(.*)\"\s+\/>/;
		for (var i = 0 ; i < metaTags.length ; i++) {
			var stuff = metaTags[i].match(m2);
			metaInfo[stuff[1]] = stuff[2];
			metaNames.push(stuff[1]);
		}
		
		for (var i = 0 ; i <metaNames.length ; i++) {
			if (metaNames[i] == "sitecategories") {
				newItem.section = metaInfo[metaNames[i]].split(",")[0];
			} else if (metaNames[i] == "publishdate") {
				newItem.date = metaInfo[metaNames[i]].split(/\s+/)[0];
			} else if (metaNames[i] == "byline") {
				var byline = metaInfo[metaNames[i]].split(",")[0];
				if (byline.indexOf(" and ") != -1) {
					byline = byline.split(" and ");
					for (var j = 0 ; j < byline.length ; j++) {
						newItem.creators.push(Zotero.Utilities.cleanAuthor(byline[j], "author"));
					}
				} else {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(byline, "author"));
				}
			} else if (metaNames[i] == "keywords") {
				var keywords = metaInfo[metaNames[i]].split(",");
				for (var k = 0 ; k < keywords.length ; k++) {
					if (keywords[k].length > 1) {
						newItem.tags.push(Zotero.Utilities.unescapeHTML(keywords[k][0].toUpperCase() + keywords[k].substr(1).toLowerCase()));
					}
				}
			}
		}
		
		//abstract
		var a = /\"Description\"\s+content=\"([^\"]*)\"/;
		newItem.abstractNote = Zotero.Utilities.unescapeHTML(text.match(a)[1].substring(0, text.match(a)[1].length - 3));
		
		newItem.complete();
		Zotero.done();
	}, function() {});
}

function doWeb(doc, url) {
	var URLS = new Array();
	if (url.indexOf("siteSearch.ac") != -1) {
		var xpath = ''//div[@class="searchresults"]/dl/dt/a'';
		var titles = new Object();
		var stuff = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var newest = stuff.iterateNext();
		while (newest) {
			titles[newest.href] = newest.textContent;
			newest = stuff.iterateNext();
		}
		
		var items = Zotero.selectItems(titles);
		
		for (var i in items) {
			URLS.push(i.split("u=")[1].replace(/%3A/g,":").replace(/%2F/g,"/").split("&")[0]);
		}
	} else {
		URLS.push(url);
	}
	
	Zotero.debug(URLS);
	
	Zotero.Utilities.HTTP.doPost(URLS, "", function(text) {
		for (var i = 0 ; i < URLS.length ; i++) {
			scrape(URLS[i]);
		}
	});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('c7830593-807e-48cb-99f2-c3bed2b148c2', '1.0.0b4.r5', '', '2007-08-14 22:15:00', '1', '100', '4', 'New Zealand Herald', 'Michael Berkowitz', '^http://(www|search).nzherald.co.nz/', 
'function detectWeb(doc, url) {
	if (doc.title.indexOf("Search Results") != -1) {
		return "multiple";
	} else if (doc.location.href.indexOf("story.cfm") != -1) {
		return "newspaperArticle";
	}
}', 
'function scrape(url) {
	Zotero.Utilities.HTTP.doGet(url, function(text) {
		var newItem = new Zotero.Item("newspaperArticle");
		newItem.url = url;
		newItem.publicationTitle = "New Zealand Herald";
		
		//author?
		var aut = /<a href=\"\/author\/[^>]*>(.*)<\/a>/;
		if (text.match(aut)) {
			var author = text.match(aut)[1];
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
		
		//abstract
		var a = /meta name=\"description\" content=\"([^&]*)/;
		newItem.abstractNote = text.match(a)[1];
		
		//title and date
		var t = /<title>(.*)<\/title>/;
		var result = text.match(t)[1].split(" - ");
		newItem.title = result[0];
		newItem.date = result[1];
		
		//keywords
		var k = /<meta name=\"keywords\" content=\"(.*)\"/;
		var kwords = Zotero.Utilities.cleanString(text.match(k)[1]).split(", ");
		for (var i = 0 ; i < kwords.length ; i++) {
			newItem.tags.push(kwords[i]);
		}
		
		//section
		var s = /class=\"current\"><.*><span>(.*)<\/span>/;
		newItem.section = text.match(s)[1];
		
		newItem.complete();
		Zotero.debug(newItem);
		
		Zotero.done();
	}, function() {});
}

function doWeb(doc, url) {
	var articles = new Array();
	var names = new Array();
	if (doc.title.indexOf("Search Results:") != -1) {
		var URLS = new Array();
		var titles = new Array();
		var xpath = ''//p[@class="g"]/a'';
		var links = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var link = links.iterateNext();
	
		while (link) {
			URLS.push(link.href);
			titles.push(link.textContent);
			link = links.iterateNext();
		}
		
		Zotero.debug(titles);
		Zotero.debug(URLS);
		
		var newItems = new Object();
		
		for (var i = 0 ; i < titles.length ; i++) {
			newItems[URLS[i]] = titles[i];
		}
	
		newItems = Zotero.selectItems(newItems);
	
		Zotero.debug(newItems);
		
		for (var i in newItems) {
			articles.push(i);
			names.push(newItems[i]);
		}
	} else {
		articles.push(doc.location.href);
		names.push(Zotero.Utilities.cleanString(doc.title.split("-")[0]));
	}
	
	Zotero.debug(articles);
	
	Zotero.Utilities.HTTP.doPost(articles, "", function(text) {
		for (var i = 0 ; i < articles.length ; i++) {
			scrape(articles[i]);
		}
	});
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('19120a71-17a8-4629-936a-ccdf899b9861', '1.0.0b4.r5', '', '2007-08-14 22:15:00', '1', '99', '4', 'Sydney Morning Herald', 'Michael Berkowitz', '^http://(www|search).smh.com.au/(news|siteSearch|articles)', 
'function detectWeb(doc, url) {
	if (doc.location.href.indexOf("news") != -1 || doc.location.href.indexOf("articles") != -1) {
		return "newspaperArticle";
	} else if (doc.location.href.indexOf("siteSearch") != -1) {
		return "multiple";
	}
}', 
'function regexMeta(str, item) {
	var re = /name=\"(.*)\"\s+content=\"(.*)\"\s+\/>/;
	var stuff = str.match(re);
	if (stuff[1] == "byline") {
		authors = stuff[2].split(" and ");
		for (var i = 0 ; i < authors.length ; i++) {
			item.creators.push(Zotero.Utilities.cleanAuthor(authors[i].split(" in ")[0], "author"));
		}
	} else if (stuff[1] == "sitecategories") {
		item.section = stuff[2];
	} else if (stuff[1] == "publishdate") {
		item.date = stuff[2].split(/\s+/)[0];
	}
}

function doWeb(doc, url) {
	var articles = new Array();
	if (doc.location.href.indexOf("siteSearch") != -1) {
		var items = new Array();
		var xpath = ''//div[@class="searchresults"]/dl/dt/a'';
		var stuff = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var thing = stuff.iterateNext();
		while (thing) {
			items[thing.href] = thing.textContent;
			thing = stuff.iterateNext();
		}
		
		items = Zotero.selectItems(items);
		
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles.push(url);
	}
	for (var i = 0 ; i < articles.length ; i++) {
		var url = articles[i]
		Zotero.Utilities.HTTP.doGet(url, function(text) {
			var newItem = new Zotero.Item("newspaperArticle");
			newItem.publicationTitle = "Sydney Morning Herald";
			newItem.url = url;
			newItem.ISSN = "0312-6315";
			//title
			var t = /<HEADLINE>(.*)<\/HEADLINE>/;
			newItem.title = Zotero.Utilities.unescapeHTML(Zotero.Utilities.capitalizeTitle(text.match(t)[1]));
			//hooray for real meta tags!
			var meta = /<meta\s+name=(.*)\/>/g;
			var metaTags = text.match(meta);
			for (var i = 0 ; i <metaTags.length ; i++) {
				regexMeta(metaTags[i], newItem);
			}
			//abstract
			var abs = /meta name=\"Description\" content=\"([^\"]*)\"/;
			var abstract = text.match(abs)[1].split(/\s+/);
			abstract[0] = abstract[0][0] + abstract[0].substr(1).toLowerCase();
			abstract = abstract.join(" ");
			newItem.abstractNote = Zotero.Utilities.unescapeHTML(abstract.substr(0, abstract.length - 3));
			newItem.complete();
			Zotero.done();
		}, function() {});
	}
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('393afc28-212d-47dd-be87-ec51bc7a58a4', '1.0.0b3.r1', '', '2007-08-14 22:20:00', '1', '100', '4', 'The Australian', 'Michael Berkowitz', '^http://(searchresults|www.theaustralian).news.com.au/', 
'function detectWeb(doc, url) {
	if (url == "http://searchresults.news.com.au/servlet/Search" || url.indexOf("siteSearch") != -1) {
		return "multiple";
	} else if (url.indexOf("story") != -1) {
		return "newspaperArticle";
	}
}', 
'function scrape(url) {
	Zotero.Utilities.HTTP.doGet(url, function(text) {
		var newItem = new Zotero.Item("newspaperArticle");
		newItem.url = url;
		newItem.publicationTitle = "The Australian";
		
		//title
		var t = /<title>(.*)<\/title>/;
		newItem.title = Zotero.Utilities.capitalizeTitle(text.match(t)[1].split(" | ")[0]);
		
		//abstract
		var abs = /meta name=\"description\"\s+content=\"(.*)\"/;
		var abstract = Zotero.Utilities.unescapeHTML(text.match(abs)[1]).split(" ");
		abstract[0] = abstract[0][0] + abstract[0].substr(1).toLowerCase();
		newItem.abstractNote = abstract.join(" ");
		
		//tags
		var t = /meta name=\"keywords\"\s+content=\"(.*)\"/;
		var tags = text.match(t)[1].split(/,\s+/);
		for (var i = 0 ; i < tags.length ; i++) {
			newItem.tags.push(Zotero.Utilities.unescapeHTML(tags[i]));
		}

		//section
		var sec = /active\"><a[^>]*>(.*)<\/a>/;
		if (text.match(sec)) {
			newItem.section = text.match(sec)[1];
		}
		
		//timestamp
		var t = /<em class=\"timestamp\">(.*)<\/em>/;
		newItem.date = text.match(t)[1];
		
		//byline
		var by = /<div\s+class=\"module-subheader\"><p>(.*)/;
		if (text.match(by)[1]) {
			var byline = text.match(by)[1];
			var authors = new Array();
			if (byline.indexOf(",") != -1) {
				byline = byline.split(",")[0];
			}
			if (byline.indexOf(" and ") != -1) {
				var authors = byline.split(" and ");
			} else {
				authors.push(byline);
			}
			for (var i = 0 ; i < authors.length ; i++) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));
			}
		}
		
		newItem.complete();
		Zotero.debug(newItem);
		
		Zotero.done();
	}, function() {});
}

function doWeb(doc, url) {
	var URLS = new Array();
	var newItems = new Object();
	if (url == "http://searchresults.news.com.au/servlet/Search") {
		var articles = new Array();
		var xpath = ''//ol/li/h4[@class="heading"]/a'';
		//var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		
		newItems = Zotero.Utilities.getItemArray(doc, doc.getElementsByTagName("h4"), /^http:\/\//);
		newItems = Zotero.selectItems(newItems);
	} else {
		newItems[url] = doc.title.split(" | ")[0]; 
	}

	for (var i in newItems) {
		URLS.push(i);
	}
	
	Zotero.debug(URLS);
	Zotero.Utilities.HTTP.doPost(URLS, "", function(text) {
		for (var i = 0 ; i < URLS.length ; i++) {
			scrape(URLS[i]);
		}
	});
}');

REPLACE INTO translators VALUES ('303bdfc5-11b8-4107-bca1-63ca97701a0f', '1.0.0b3.r1', '', '2007-09-06 19:30:00', '0', '100', '4', 'ASCE', 'Michael Berkowitz', '^http://ascelibrary.aip.org/.+', 
'function detectWeb(doc, url) {
	if (doc.evaluate(''//div[@id="sr-content-wrap"]//div[@class="sr-right"]/p[@class="sr-art-title"]/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}', 
'function getRIS(doc, url) {
	var newx = ''//div[@id="sci-art-options-box"]//input[@name="SelectCheck"]'';
	var key = doc.evaluate(newx, doc, null, XPathResult.ANY_TYPE, null).iterateNext().value;
	Zotero.debug(key);
	var citation = ''http://ascelibrary.aip.org/getabs/servlet/GetCitation?source=scitation&PrefType=ARTICLE&PrefAction=Add+Selected&SelectCheck='' + key + ''&fn=open_refworks&downloadcitation=+Go+'';
	Zotero.Utilities.HTTP.doGet(citation, function(text) {
		var translator = Zotero.loadTranslator("import");
		text = text.replace(/RT/, "TY");
		text = text.replace(/VO/, "VL");
		text = text.replace(/LK/, "UR");
		text = text.replace(/YR/, "PY");
		Zotero.debug(text);
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text.replace(/([A-Z][A-Z\d]\s)/g, "$1 - "));
		translator.setHandler("itemDone", function(obj, item) {
			item.attachments = [
				{url:item.url, title:"ASCE Snapshot", mimeType:"text/html"},
				{url:"http://ascelibrary.aip.org/getpdf/servlet/GetPDFServlet?filetype=pdf&id=" + key + "&idtype=cvips&prog=search", title:"EAS Full Text PDF", mimeType:"application/pdf"}
			];
			//item.itemType = "journalArticle";
			item.complete();
		});
		translator.translate();
		Zotero.wait();
		Zotero.done();
	});
}

function doWeb(doc, url) {
	var articles = new Array();
	var items = new Object();
	var xpath = ''//div[@class="sr-right"]/p[@class="sr-art-title"]/a'';
	if (doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		while (new_title = titles.iterateNext()) {
			items[new_title.href] = new_title.textContent;
		}
		
		items = Zotero.selectItems(items);
		
		for (var i in items) {
			articles.push(i)
		}
	} else {
		var newx = ''//div[@id="sci-art-options-box"]//input[@name="SelectCheck"]'';
		var stuff = doc.evaluate(newx, doc, null, XPathResult.ANY_TYPE, null).iterateNext().value;
		Zotero.debug(stuff);
		articles.push(url);
	}

	Zotero.debug(articles);
	Zotero.Utilities.processDocuments(articles, getRIS, function() {Zotero.done});
	Zotero.wait();

}
');

REPLACE INTO translators VALUES ('5af42734-7cd5-4c69-97fc-bc406999bdba', '1.0.0b4.r5', '', '2008-03-25 00:50:00', '1', '100', '4', 'ESA Journals', 'Michael Berkowitz', 'http://www.esajournals.org/', 
'function detectWeb(doc, url) {
	if (url.indexOf("get-toc") != -1 || url.indexOf("searchtype") != -1) {
		return "multiple";
	} else if (url.indexOf("get-document") != -1 || url.indexOf("get-abstract") != -1) {
		return "journalArticle";
	}
}', 
'function senCase(string) {
	var smallwords = Array("AND", "A", "IN", "THE", "BY", "OF");
	var sen = string.split(/\b/);
	for (var i = 0 ; i < sen.length; i++) {
		if (sen[i].match(/\w+/)) {
			if (smallwords.indexOf(sen[i]) != -1 && i != 0) {
				sen[i] = sen[i].toLowerCase();
			} else {
				sen[i] = sen[i][0] + sen[i].substring(1).toLowerCase();
			}
		}
	}
	return sen.join("");
}

function fixURL(doistr) {
	var swapTable = {
		"%2F":"/",
		"%28":"(",
		"%29":")",
		"%5B":"[",
		"%5D":"]",
		"%3A":":",
		"%3B":";"
	}
	for (var probstr in swapTable) {
		doistr = doistr.replace(probstr, swapTable[probstr]);
	}
	return doistr;
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == ''x'') return namespace; else return null;
       	} : null;
	
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var resultItems = doc.evaluate(''//div[@class="nocolumn"][@id="content"]/div//*[@class="group"]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var next_item;
		while (next_item = resultItems.iterateNext()) {
			var link = doc.evaluate(''.//a[1]'', next_item, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
			var title = senCase(doc.evaluate(''.//*[@class="title"]'', next_item, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles.push(url);
	}
	Zotero.Utilities.processDocuments(articles, function(newDoc) {
		var newlink = newDoc.evaluate(''//a[text() = "Create Reference"]'', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
		var itemurl = newDoc.location.href;
		var doi = itemurl.match(/doi=([^&]+)/)[1];
		var issn = newDoc.evaluate(''//div[@id="pageTitle"]/p/a'', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href.match(/issn=([^&]+)/)[1];
		newlink = newlink.replace(''cite-builder'', ''download-citation&t=refman&site=esaonline'');
		Zotero.Utilities.HTTP.doGet(newlink, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.url = fixURL(itemurl);
				item.DOI = fixURL(doi);
				var bits = new Array(issn, item.volume, item.issue);
				var pdfurl = ''http://www.esajournals.org/archive/'' + bits.join("/") + "/pdf/i" + bits.join("-") + "-" + item.pages.match(/\d+/)[0] + ".pdf";
				item.attachments = [
					{url:item.url, title:"ESA Journals Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:"ESA Full Text PDF", mimeType:"application/pdf"}
				];
				item.complete();
			});
			translator.translate();
			
			Zotero.done();
		});
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('1f40baef-eece-43e4-a1cc-27d20c0ce086', '1.0.0b4.r1', '', '2007-07-31 19:40:00', '1', '100', '4', 'Engineering Village', 'Ben Parr', '^https?://(?:www\.)?engineeringvillage(2)?\.(?:com|org)', 
'function detectWeb(doc, url)
{
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
	var xpath=''//a[img/@style="vertical-align: middle;"][@href]'';
	if(doc.evaluate(xpath, doc,
		nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
		{  return "journalArticle";}
		
	xpath=''//input[@name="cbresult"]/@onclick'';
	if(doc.evaluate(xpath, doc,
		nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
		{  return "multiple";}
		
	return null;
}', 
'function parseRIS(uris)
{	
     Zotero.Utilities.HTTP.doGet(uris, function(text){
             // load translator for RIS
             var translator = Zotero.loadTranslator("import");
             translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
             translator.setString(text);
             translator.translate();
             Zotero.done();
     }, function() {});
     Zotero.wait();
}

//creates the link to the RIS file
function createURL(EISESSION,docidlist,curURL)
{
	var milli = (new Date()).getTime();
	var temp = curURL.split(''/'');		
	var url = temp.slice(0,temp.length-1).join(''/'') + "/Controller?EISESSION="+EISESSION;
	url+="&CID=downloadSelectedRecordsris&format=ris&displayformat=fullDoc&timestamp="
	url+=milli;
	url+="&docidlist=";
	url+=docidlist;
	url+="&handlelist=1";
	return url;
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
    	var url;
    	var xpath=''//a[img/@style="vertical-align: middle;"][@href]'';
	if(doc.evaluate(xpath, doc,
		nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
	{
		xpath=''//a[@class="MedBlueLink"][img]/@onclick'';
		var temp=doc.evaluate(xpath, doc,
			nsResolver,XPathResult.ANY_TYPE,null).iterateNext();
		var docidlist=temp.value;
	
		docidlist=docidlist.split("MID=")[1];
		docidlist=docidlist.split("&")[0];
	
		xpath=''//a[img/@style="vertical-align: middle;"][@href]'';
		temp=doc.evaluate(xpath, doc,
			nsResolver,XPathResult.ANY_TYPE,null).iterateNext();

		var EISESSION =temp.href;
		EISESSION=EISESSION.split("(''")[1];
		EISESSION=EISESSION.split("''")[0];
		url=createURL(EISESSION,docidlist,doc.location.href);
		parseRIS(url);
	}
	else
	{
		xpath=''//input[@NAME="sessionid"]'';
		var EISESSION=doc.evaluate(xpath, doc,
			nsResolver,XPathResult.ANY_TYPE,null).iterateNext().value;
		
		xpath=''//input[@name="cbresult"]/@onclick'';
		
		var items=new Array();
		var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null);
		var xpath2=''//a[@class="MedBlackText"]/b'';
		xpath2=doc.evaluate(xpath2, doc, nsResolver,XPathResult.ANY_TYPE,null);
		var title;
		var docidlist;
		while(row=rows.iterateNext())
		{
			docidlist=row.value;
			docidlist=docidlist.split("''")[1];
			
			url=createURL(EISESSION,docidlist,doc.location.href);
			
			title=xpath2.iterateNext();
			title=title.textContent;
			
			items[url]=title;			
		}
		items = Zotero.selectItems(items);
             if(!items) return true;
             var dois="";
             var theurls= new Array();
             for(var thelink in items)
             {
                    theurls.push(thelink);
             }
	parseRIS(theurls);
	}
}');


REPLACE INTO translators VALUES ('13b9f6fe-ded7-4f91-8c55-5d6ce64fb43e', '1.0.0b4.r1', '', '2007-06-27 02:00:00', '0', '100', '4', 'SPIE Digital Library', 'Asa Kusuma', '^https?://spiedigitallibrary\.aip\.org/', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var singXpath = ''//input[@name="SelectCheck"][@type="hidden"]'';
	var multXpath = ''//input[@name="SelectCheck"][@type="checkbox"]'';
	
	
	//var str=doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	//Zotero.debug("StRRRr: "+str);
	if (doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} if (doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		
		return "journalArticle";
		
	}
}
', 
'function parseRIS(uris) {
	
	Zotero.debug("Begin parsing RIS");
	Zotero.Utilities.HTTP.doGet(uris, function(text){	
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.translate();
		Zotero.done();
	}, function() {});
	Zotero.wait();
}

function doWeb(doc, url) {
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var singXpath = ''//input[@name="SelectCheck"][@type="hidden"]'';
	var multXpath = ''//input[@name="SelectCheck"][@type="checkbox"]'';
	

	if (doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		//multiple
		
		
		Zotero.debug("Multiple Step 1");
		var searchtitle = ''//tbody/tr/td/table/tbody/tr[2]/td/font/b'';
		var bibXpath = ''//input[@name="SelectCheck"][@type="checkbox"]'';
		var pagetype="";
		
		//Checks what type of multiple page it is, search or browse.
		if(doc.evaluate(searchtitle, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var titleXpath=''//a/b'';
			pagetype="search";
			Zotero.debug("Found a search page");
		} else {
			var titleXpath=''//ul/strong'';
			Zotero.debug("Found a browse page");
			pagetype="browse";
		}
		var bibElmts = doc.evaluate(bibXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var titleElmts = doc.evaluate(titleXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var titleElmt;
		var bibElmt;
		bibElmt = bibElmts.iterateNext();
		titleElmt = titleElmts.iterateNext();
		
		var items = new Array();
		Zotero.debug("Multiple Step 2");
		do {
			
			Zotero.debug("SelectCheck: "+bibElmt.value);
			items[bibElmt.value] = Zotero.Utilities.cleanString(titleElmt.textContent);
			if(pagetype=="search") {
				titleElmt = titleElmts.iterateNext();
			}
		} while((bibElmt = bibElmts.iterateNext()) && (titleElmt = titleElmts.iterateNext()));

		items = Zotero.selectItems(items);
		if(!items) return true;
	
		var bibcodes="";
		var uris = new Array();
		for(var bibcode in items) {
			Zotero.debug("Export SelectCheck: "+bibcode);
		
			var getURL = "http://spiedigitallibrary.aip.org/getabs/servlet/GetCitation?fn=view_isi&source=scitation&PrefType=ARTICLE&PrefAction=Add+Selected&SelectCheck=";
				getURL=getURL + bibcode +  "&downloadcitation=+Go+";
				Zotero.debug(getURL);
			uris.push(getURL);
		}
		
		parseRIS(uris);
		
		
	} if (doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		singXpath = ''//input[@name="SelectCheck"][@type="hidden"]'';
	
		var selectid=doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
		Zotero.debug("Node Value: "+selectid);
		//single
		var url="http://spiedigitallibrary.aip.org/getabs/servlet/GetCitation?fn=view_isi&source=scitation&PrefType=ARTICLE&PrefAction=Add+Selected&SelectCheck=";
		//PSISDG001207000001000088000001
		url = url+selectid;
		url = url + "&downloadcitation=+Go+";
		var idarray = new Array();
		idarray.push(url);
		parseRIS(idarray);
	}
	
	
	
}');

REPLACE INTO translators VALUES ('ab961e61-2a8a-4be1-b8a3-044f20d52d78', '1.0.0b4.r1', '', '2007-07-31 16:45:00', '0', '100', '4', 'BIBSYS', 'Ramesh Srigiriraju', '^http://ask\.bibsys\.no/ask/action', 
'function detectWeb(doc, url)	{
	var multireg=new RegExp("^http://ask\.bibsys\.no/ask/action/result");
	if(multireg.test(url))
		return "multiple";
	var singlereg=new RegExp("^http://ask\.bibsys\.no/ask/action/show");
	if(singlereg.test(url))
		return "book";
}', 
'function doWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var multireg=new RegExp("http://ask\.bibsys\.no/ask/action/result");
	if(multireg.test(url))	{
		var titlpath=''//tr/td[@width="49%"][@align="left"][@valign="top"]/a/text()'';
		var titles=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var codepath=''//tr/td/input[@type="checkbox"][@name="valg"]/@value'';
		var codes=doc.evaluate(codepath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var items=new Array();
		var title;
		titles.iterateNext();
		while(title=titles.iterateNext())
			items[codes.iterateNext().nodeValue]=title.nodeValue;
		items=Zotero.selectItems(items);
		var string="http://ask.bibsys.no/ask/action/result?control=ctr_top";
		for(var codes in items)
			string+="&valg="+codes;
		string+="&control=ctr_bottom&eksportFormat=refmanager&eksportEpostAdresse=&eksportEpostFormat=fortekst&cmd=sendtil";
		Zotero.Utilities.HTTP.doGet(string, function(text)	{
			var trans=Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(text);
			trans.translate();
			Zotero.done();
		});
		Zotero.wait();
	}
	var singlereg=new RegExp("http://ask\.bibsys\.no/ask/action/show");
	if(singlereg.test(url))	{
		var urlstring="http://ask.bibsys.no/ask/action/show";
		var data="visningsformat=fortekst_m_eksemplarer&eksportFormat=refmanager&eksportEpostAdresse=&eksportEpostFormat=fortekst&cmd=sendtil";
		Zotero.Utilities.HTTP.doPost(urlstring, data, function(text)	{
			var trans=Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(text);
			trans.translate();
			Zotero.done();
		});
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('f4130157-93f7-4493-8f24-a7c85549013d', '1.0.0b4.r1', '', '2007-08-27 05:00:00', '0', '100', '4', 'BBC', 'Ben Parr', '^https?://(?:www|news?)\.bbc\.co.uk', 
'function detectWeb(doc, url)
{

       var namespace = doc.documentElement.namespaceURI;
      var nsResolver = namespace ? function(prefix) {
      if (prefix == ''x'') return namespace; else return null;
      } : null;

	var xpath;
      
     xpath=''//meta[@name="Headline"]'';
     if(content=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
     { return "newspaperArticle";  }
     
     xpath=''//font[@class="poshead"]/b'';
     if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
    { return "newspaperArticle";  }
    
      return null;
}', 
'function scrape(doc,url,title)
{
	      var namespace = doc.documentElement.namespaceURI;
     	      var nsResolver = namespace ? function(prefix) {
      	      if (prefix == ''x'') return namespace; else return null;
      	      } : null;
	     
	     var newItem = new Zotero.Item("newspaperArticle");
	
 	     newItem.url=url;
	     newItem.repository="bbc.co.uk";
	     newItem.publicationTitle="BBC";
	     newItem.title=title;
	     
	     xpath=''//meta[@name="OriginalPublicationDate"]/@content'';
	     var temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext();
	     if(temp)
	     {
		temp=temp.value;
	     	temp=temp.split(" ")[0];
	     	newItem.date=temp;
	     }
	     else
	     {
		     xpath=''//font[@class="postxt"][@size="1"]'';
		     var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
		     var row;
		     while(row=rows.iterateNext())
		     {
			     temp=row.textContent;
			     if(temp.substr(0,9)=="Created: ")
			     {
				     newItem.date=temp.substr(9);
				     break;
			     }
		     }
	     }
	     
	     xpath=''//meta[@name="Section"]/@content'';
	    temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext();
	     if(temp)
	     { 	newItem.section=temp.value;     }
	     
	     xpath=''//meta[@name="Description"]/@content'';
	     temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext();
	     if(temp)
	     { 	newItem.abstractNote=temp.value;     }
	     else
	     {
		     xpath=''//meta[@name="description"]/@content'';
	     	     temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext();
	             if(temp)
	    	     { 	newItem.abstractNote=temp.value;     }
	     }
	     
	     newItem.attachments.push({url:url, title:"BBC News Snapshot",mimeType:"text/html"});
	     
	     newItem.complete();
}



function doWeb(doc,url)
{
       var namespace = doc.documentElement.namespaceURI;
      var nsResolver = namespace ? function(prefix) {
      if (prefix == ''x'') return namespace; else return null;
      } : null;
      
      var xpath=''//meta[@name="Headline"]/@content'';
      var title;
     if(title=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
     	{  scrape(doc,url,title.value) }
     else
     {
	     xpath=''//font[@class="poshead"]/b'';
	     if(title=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
    	     	{   scrape(doc,url,title.textContent)  }
     }

     
}');

REPLACE INTO translators VALUES ('dbb5d4bc-3b21-47a2-9751-5dcbb65b902a', '1.0.0b4.r1', '', '2007-07-31 16:45:00', '0', '100', '4', 'AMS Online Journals - Allenpress', 'Ben Parr', '^http://ams.allenpress.com/', 
'function detectWeb(doc,url)
{
      var namespace = doc.documentElement.namespaceURI;
      var nsResolver = namespace ? function(prefix) {
      if (prefix == ''x'') return namespace; else return null;
      } : null;

      	var xpath;
      	
	//Homepage=AMS Top 20
	var temp=url.split("request=")[1];
	if(temp)
	{
		if(temp.substr(0,10)=="index-html")
		{ return "multiple"; }
	}
	
	
	//browse page
	xpath=''//div[@class="group"]/p[@class="title"]'';
	if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
		{ return "multiple"; }
		
	//second browse page format
	xpath=''//div[@class="toc include j"]/p/span[@class="title"]'';
	if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
		{ return "multiple"; }
	
		
	//search page 
	xpath=''//td[@class="search"]/span[@class="title"]'';
	if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
		{ return "multiple"; }
		
	//single page
	xpath=''//ul/li/a'';
	var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
	var row;
	
	while(row=rows.iterateNext())
	{
		if(row.textContent=="Create Reference")
			{ return "journalArticle"; }
	}
	
}', 
'function parseRIS(temp,PDFs)
{
      Zotero.Utilities.HTTP.doGet(temp, function(text){

              // load translator for RIS
              var translator = Zotero.loadTranslator("import");
	      
              translator.setHandler("itemDone", function(obj, newItem) {
		//get doi of the item we''re currently saving from RIS file
		var doi=newItem.DOI;
		if(!doi)
			{doi=newItem.url.replace(''http://dx.doi.org/'','''');}
		else
			{doi=doi.replace("doi%3A","");}
		
		var urlstring='''';
		var volume=newItem.volume;
		var issue=newItem.issue;
		var d=newItem.pages.split("-")[0];
		
		var pdf = PDFs.shift();
		if(pdf)
		{
			if(pdf=="0")
			{
				var b=doi.split("/");
				if(b.length>1)
					{b=b[1];}
				else
					{b=doi.split("%2F")[1];}
				b=b.split("(")[0];
				b=b.split("%28")[0];
				if(!b||b.length!=9)
					{b="1520-0477";}
				urlstring="http://ams.allenpress.com/archive/"+b+"/"+volume+"/"+issue+"/pdf/i"+b+"-"+volume+"-"+issue+"-"+d+".pdf";
			}
			else if(pdf=="1")
			{
				while(volume.length<3)
					{volume="0"+volume;}
				while(issue.length<2)
					{issue="0"+issue;}
				while(d.length<4)
					{d="0"+d;}
				
				urlstring="http://docs.lib.noaa.gov/rescue/mwr/"+volume+"/mwr-"+volume+"-"+issue+"-"+d+".pdf";
			}
		}
		newItem.attachments[0]={
				title:"AMS Journals Full Text PDF",
				url:urlstring, mimeType:"application/pdf"}
		
		if(Zotero.Utilities.cleanString(newItem.abstractNote).toLowerCase()=="no abstract available.")
			{newItem.abstractNote='''';}
		newItem.complete();
		});
		
              translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
              translator.setString(text);
              translator.translate();

              Zotero.done();
      }, function() {});
      Zotero.wait();
}


function createLink(link)
{
	var url="http://ams.allenpress.com/perlserv/?request=download-citation&t=refman&doi=";
	url+=getdoi(link);
	url+="&site=amsonline";
	return url;
}

function getdoi(link)
{
	doi=link.split("doi%3A")[1];
	if(!doi)
	{
		doi=link.split("doi=")[1];
		return doi;
	}
	return doi;
}

function getType(text)
{
	if(text.indexOf("(")>-1)
		{return "0";}
	else
		{return "1";}
}

function doWeb(doc,url)
{
      var namespace = doc.documentElement.namespaceURI;
      var nsResolver = namespace ? function(prefix) {
      if (prefix == ''x'') return namespace; else return null;
      } : null;

        var doi;
        var PDFs=new Array();
	var xpath=''//ul/li/a'';
	var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
	var row;
	
	while(row=rows.iterateNext())
	{
		if(row.textContent=="Create Reference")
		{
				//single page
				
				var thelink=createLink(row.href);
				xpath=''//div[@class="mainPadding"]/div/div/div/div/div/p/a'';
				rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
				while(row=rows.iterateNext())
				{
					if(row.textContent.toLowerCase().indexOf("pdf")>-1)
						{PDFs.push(getType(row.textContent));}
				}
				parseRIS(thelink,PDFs);
				
				return null;
		}
	}
	
	var items=new Array();
	
	xpath=''//div[@class="group"]/p[@class="title"]'';
	var xpath1='''';
	var xpath2='''';
	
	if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
	{
		//browse page
		
		xpath1=''//div[@class="group"]/p[@class="title"]'';
		xpath2=''//p[@class="link"]/a'';
	}
	else
	{
		xpath=''//td[@class="search"]/span[@class="title"]'';
		if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
		{
			//search page
			
			xpath1=''//td[@class="search"]/span[@class="title"]'';
			xpath2=''//tr/td/a'';
		}
		else
		{
			xpath=''//div[@class="toc include j"]/p/span[@class="title"]'';
			if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
			{
				//second browse format
				
				xpath1=''//div[@class="toc include j"]/p/span[@class="title"]'';
				xpath2=''//div[@class="toc include j"]/p/a'';
			}
		}
	}
	
	if(xpath1!='''')
	{
		var rows1=doc.evaluate(xpath1, doc, nsResolver,XPathResult.ANY_TYPE, null);
		var row1;
		
		var rows2=doc.evaluate(xpath2, doc, nsResolver,XPathResult.ANY_TYPE, null);
		var row2=rows2.iterateNext();
		
		var rows3=doc.evaluate(xpath2, doc, nsResolver,XPathResult.ANY_TYPE, null);
		var row3;
		
		var tPDFs=new Array();
		var nextType;
		
		var link;
		var lastdoi;
		
		while(row1=rows1.iterateNext())
		{
			while(row3=rows3.iterateNext())
			{
				if(row3.textContent.toLowerCase().indexOf("pdf")>-1)
					{tPDFs.push(getType(row3.textContent));}
			}
			while(getdoi(row2.href)==lastdoi || !getdoi(row2.href))
				{row2=rows2.iterateNext()}
			
			lastdoi=getdoi(row2.href);
			link=createLink(row2.href);
			
			nextType=tPDFs.shift();
			if(!nextType)
				{nextType="none";}
			items[nextType+link]=row1.textContent;
		}
	}
	else
	{
		var t=url.split("request=")[1];
		if(t)
		{
			if(t.substr(0,10)=="index-html")
			{
				//Homepage=AMS Top 20
				
				xpath=''//div/p/a[@style="font-size: 85%;"]'';
				var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
				var row;
	
				while(row=rows.iterateNext())
					{items["0"+createLink(row.href)]=row.textContent;}
			}
	
		}
	}
		
		items = Zotero.selectItems(items);
				
		if(!items)
			{return true;}
		
		var urls = new Array();
		for(var i in items)
		{
			PDFs.push(i[0]);
			urls.push(i.substr(1));
		}
		
		parseRIS(urls,PDFs);
}');

REPLACE INTO translators VALUES ('7e51d3fb-082e-4063-8601-cda08f6004a3', '1.0.0b4.r1', '', '2007-07-31 16:45:00', '0', '100', '4', 'Education Week', 'Ben Parr', '^https?://(?:www\.|blogs\.|www2\.)?edweek', 
'function detectWeb(doc,url)
{
       var namespace = doc.documentElement.namespaceURI;
       var nsResolver = namespace ? function(prefix) {
       if (prefix == ''x'') return namespace; else return null;
       } : null;
       
       var xpath=''//meta[@name="Story_type"]/@content'';
       var temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext();
       if(temp)
       {
               if(temp.value=="Blog")
                       {return "blogPost";}
               if(temp.value.indexOf("Story")>-1)
                       {return "magazineArticle";}
       }
}', 
'function associateMeta(newItem, metaTags, field, zoteroField) {
      if(metaTags[field]) {
              newItem[zoteroField] = metaTags[field];
      }
}

function scrape(doc, url) {

      var newItem = new Zotero.Item("magazineArticle");
       if(url&&url.indexOf("blogs.edweek.org")>-1)
               {newItem.itemType="blogPost";}

      newItem.url = doc.location.href;

      var metaTags = new Object();

      var metaTagHTML = doc.getElementsByTagName("meta");
      var i;
      for (i = 0 ; i < metaTagHTML.length ; i++) {
              metaTags[metaTagHTML[i].getAttribute("name")]=Zotero.Utilities.cleanTags(metaTagHTML[i].getAttribute("content"));
      }
      associateMeta(newItem, metaTags, "Title", "title");
      associateMeta(newItem, metaTags, "Cover_date", "date");
      associateMeta(newItem, metaTags, "Description", "abstractNote");
      associateMeta(newItem, metaTags, "ArticleID", "accessionNumber");
      associateMeta(newItem,metaTags,"Source","publicationTitle");


        if (metaTags["Authors"]) {
              var author = Zotero.Utilities.cleanString(metaTags["Authors"]);
              if (author.substr(0,3).toLowerCase() == "by ") {
                      author = author.substr(3);
              }

              var authors = author.split(" and ");
              for each(var author in authors) {
                      var words = author.split(" ");
                      for (var i in words) {
                              words[i] = words[i][0].toUpperCase() +words[i].substr(1).toLowerCase();
                      }
                      author = words.join(" ");

		newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
              }
      }

       newItem.complete();
}

function doWeb(doc,url)
{
       var namespace = doc.documentElement.namespaceURI;
       var nsResolver = namespace ? function(prefix) {
       if (prefix == ''x'') return namespace; else return null;
       } : null;

      var xpath=''//meta[@name="Story_type"]/@content'';
      var temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext();
      if(temp)
      {
             if(temp.value.indexOf("Story")>-1 || temp.value=="Blog")
                       {scrape(doc,url);}
      }
}');

REPLACE INTO translators VALUES ('9220fa99-b936-430e-a8ea-43ca6cb04145', '1.0.0b4.r1', '', '2007-07-31 16:45:00', '0', '100', '4', 'AGU Journals', 'Ben Parr','^https?://(?:www.)?agu.org',
'function detectWeb(doc,url)
{
     var namespace = doc.documentElement.namespaceURI;
     var nsResolver = namespace ? function(prefix) {
     if (prefix == ''x'') return namespace; else return null;
     } : null;

       var xpath;

       //abstract
       xpath=''//p[@id="citation"]'';
       if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
               { return "journalArticle"; }

       //full text
       xpath=''//frameset[@rows="98, *"]'';
       if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
               { return "journalArticle"; }

       //issue page
       xpath=''//tr/td/p[@class="title"]'';
       if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
               { return "multiple"; }

       //Search  Page
       if(doc.title.indexOf("Query Results")>-1)
               {return "multiple";}
}
',
'function fixCaps(s)
{
       if(s!='''')
       {
               words=Zotero.Utilities.cleanString(s).toLowerCase().split(" ");
               for (var j = 0 ; j < words.length ; j++)
               {
                       if (j==0||(words[j][0] ==words[j][0].toLowerCase()&&words[j]!="or"&&words[j]!="and"&&words[j]!="of"&&words[j]!="in"))
                               {   words[j]= words[j][0].toUpperCase() +words[j].substr(1);   }
               }
               return words.join(" ");
       }
       return '''';
}

function scrape(doc,url)
{
       var namespace = doc.documentElement.namespaceURI;
       var nsResolver = namespace ? function(prefix) {
       if (prefix == ''x'') return namespace; else return null;
       } : null;

       var newItem=new Zotero.Item("journalArticle");
       var temp;
       var xpath;
       var row;
       var rows;

       newItem.url = doc.location.href;

       xpath=''//p[@id="title"]'';
       temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext();
       if(temp)
               {newItem.title=temp.textContent;}

       xpath=''//span[@id="published"]'';
       temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext();
       if(temp)
       {
               temp=Zotero.Utilities.cleanString(temp.textContent).split(" ");;
               newItem.date=temp[1]+" "+temp[0]+", "+temp[2];
       }

       xpath=''//p[@class="author"]'';
       rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
       var count=0;
       while(row=rows.iterateNext())
               {newItem.creators.push(Zotero.Utilities.cleanAuthor(row.textContent,"author"));
               count++;}

       xpath=''//tr/td/p'';
       temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
       var temp2=temp.iterateNext();
       if(temp2)
       {
               for(var n=0;n<(3+2*count);n++)
                       {temp2=temp.iterateNext();}
               newItem.abstractNote=Zotero.Utilities.cleanString(temp2.textContent);
       }

       xpath=''//p[@id="runhead"]'';
       temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext();
       if(temp)
       {
               temp=Zotero.Utilities.cleanString(temp.textContent).split(", ");
               newItem.publicationTitle=fixCaps(temp[0]);
               for(var n=1;temp[n];n++)
               {
                       if(temp[n].indexOf("VOL")>-1)
                               {newItem.volume=temp[n].replace(''VOL. '','''');}
                       else if(temp[n].indexOf("NO.")>-1)
                               {newItem.issue=temp[n].replace(''NO. '','''');}
                       else if(temp[n].indexOf("doi:")>-1)
                               {newItem.DOI=temp[n].replace(''doi:'','''');}
                       else if(temp[n+1])
                               {newItem.pages=temp[n];}
               }
       }

       xpath=''//p[@id="keywords"]'';
       temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext();
       if(temp)
       {
               temp=Zotero.Utilities.cleanString(temp.textContent.replace(''Keywords:'',''''));
               newItem.tags=temp.replace(''.'','''').split(''; '');
       }
       xpath=''//p[@id="citation"]/span[@id="journal"]'';
       temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext();
       if(temp)
               {newItem.journalAbbreviation=temp.textContent;}

       newItem.complete();
}


function processList(items)
{
               items = Zotero.selectItems(items);
               var uris=new Array();

              if (!items)
                       {return true;}

              for (var i in items)
                       {uris.push(i);}

             Zotero.Utilities.processDocuments(uris, scrape,function() {Zotero.done(); });
             Zotero.wait();

             return true;
}

function doWeb(doc,url)
{
     var namespace = doc.documentElement.namespaceURI;
     var nsResolver = namespace ? function(prefix) {
     if (prefix == ''x'') return namespace; else return null;
     } : null;

       //abstract
       var xpath=''//p[@id="citation"]'';
       if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
       {
               scrape(doc,url);
               return true;
       }

       //full text
       xpath=''//frameset[@rows="98, *"]'';
       if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
       {
               Zotero.Utilities.processDocuments(url+"0.shtml", scrape, function(){ Zotero.done(); });
               Zotero.wait();

               return true;
       }

       //issue page
       xpath=''//tr/td/p[@class="title"]'';
       if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
       {
               var titlerows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
               xpath=''//tr/td/p[@class="pubdate"]/a'';
               var linkrows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);

               var titlerow;
               var linkrow;
               var items=new Array();

               while(titlerow=titlerows.iterateNext())
               {
                       linkrow=linkrows.iterateNext();
                       while(linkrow.textContent.indexOf("Abstract")<0)
                               {linkrow=linkrows.iterateNext();}
                       items[linkrow.href]=titlerow.textContent;
               }

               return processList(items);
       }


       //Search page
       if(doc.title.indexOf("Query Results")>-1)
       {
               //FASTFind Search

               xpath=''//tr/td/h2'';
               var tt=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext().textContent;
               if(tt.indexOf("FASTFIND")>-1)
               {
                       xpath=''//tr/td[1]/font'';
                       var citerows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
                       xpath=''//tr/td[2]/font/a'';
                       var linkrows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);

                       var citerow;
                       var linkrow;
                       var items=new Array();
                       var temp;
                       var title;

                       while(citerow=citerows.iterateNext())
                       {
                               linkrow=linkrows.iterateNext();
                               items[linkrow.href]=Zotero.Utilities.cleanString(citerow.textContent);
                       }
                       return processList(items);
               }
               else
               {
                       //Advanced Search

                       xpath=''//tr/td[1]/font/a'';
                       var titlerows=doc.evaluate(xpath, doc,nsResolver,XPathResult.ANY_TYPE, null);
                       xpath=''//tr/td[2]/font/a'';
                       var linkrows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);

                       var titlerow;
                       var linkrow;
                       var items=new Array();
                       var temp;

                       while(titlerow=titlerows.iterateNext())
                       {
                               linkrow=linkrows.iterateNext();
                               while(linkrow.textContent.indexOf("Abstract")<0)
                                       {linkrow=linkrows.iterateNext();}

                               items[linkrow.href]=titlerow.textContent;
                       }
                       return processList(items);
               }
       }

}
');

REPLACE INTO translators VALUES ('e4fe1596-a8c4-4d09-945f-120c4d83e580', '1.0.0b4.r1', '', '2007-07-31 16:45:00', '0', '100', '4', 'LA Times', 'Ben Parr', '^https?://(?:www.|travel.)?latimes.com', 
'function detectWeb(doc, url)
{
   var namespace = doc.documentElement.namespaceURI;
               var nsResolver = namespace ? function(prefix) {
               if (prefix == ''x'') return namespace; else return null;
               } : null;

              var xpath = ''//link[@title="Main"]'';
              if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext())
                      {return "newspaperArticle";}

              if(doc.title.indexOf("Search Results")>-1)
                      {return "multiple";}

              xpath = ''//h1'';
              var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
              var row;
              while(row=rows.iterateNext())
              {
		if(Zotero.Utilities.cleanString(row.textContent.toLowerCase())=="travel")
                              {return "newspaperArticle";}
              }

              return null;
}', 
'function getCount(s)
{
      if(!s||s=='''')
              return 0;
      if(s.indexOf("Displaying")>-1)
      {
              s=s.substr(19);
              s=s.replace(''.'','''');
              s=s.split('' to '');
              return s[1]-s[0]+1;
      }
      return 0;
}

function processList(items)
{
              items = Zotero.selectItems(items);
              var uris=new Array();

             if (!items)
                      {return true;}

             for (var i in items)
                      {uris.push(i);}

            Zotero.Utilities.processDocuments(uris, scrape,function() {Zotero.done(); });
            Zotero.wait();

            return true;
}

function findDate(s)
{
      var words=s.split(" ");
      var months=new Array("january","febuary","march","april","may","june","july","august","september","october","november","december");
      for(var n=0;words[n];n++)
      {
              for(var m in months)
                      {if(words[n].toLowerCase()==months[m])
                              {return words[n]+" "+words[n+1]+" "+words[n+2];}
                      }
      }
      return null;
}


function scrape(doc,url)
{
      var namespace = doc.documentElement.namespaceURI;
      var nsResolver = namespace ? function(prefix) {
              if (prefix == ''x'') return namespace; else return null;
      } : null;

      var newItem = new Zotero.Item("newspaperArticle");
      newItem.publicationTitle = "The Los Angeles Times";
      newItem.ISSN = "0458-3035";

      var xpath=''//h2/a'';
      var t=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext();
      if(t)
              {newItem.section=t.textContent; }
      else
      {
              xpath=''//a/img[@alt="WEST"]'';
              if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext())
                      {newItem.section="West";}
              else
              {
                      xpath = ''//h1'';
                      var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
                      if(t=rows.iterateNext())
                              {newItem.section=t.textContent;}
              }
      }


      xpath=''//h1[last()]'';
      var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
      if(t=rows.iterateNext())
              {newItem.title=t.textContent;}

      newItem.url = url;
      xpath=''//div[@class="storybyline"]'';
      var test=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext();
      if(!test)
              {xpath=''//p[@class="by-author"]'';}
      var info=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext().textContent;
      info=Zotero.Utilities.cleanString(info);
      var date=findDate(info);
      if(date)
      {
              newItem.date=date;
              info=info.replace(date,'''');
      }
      info=Zotero.Utilities.cleanString(info);
      if(info.indexOf(", ")>-1)
      {
              var phrases=info.split(", ");
              var a=phrases[0];
              if (a.substr(0,3).toLowerCase() == "by ")
                     {a= a.substr(3);}
              if(a.substr(0,5).toLowerCase()!="from ")
              {
                      var authors=a.split(" and ");
                      var n;
                      for(n in authors)
			{newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[n],"author"));}
              }
      }
      else
      {
              xpath=''//div[@class="storydeckhead"]/a'';
              temp=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext();
              if(temp!=null && temp!='''')
		{newItem.creators.push(Zotero.Utilities.cleanAuthor(temp.textContent,"author"));}
      }

      newItem.attachments.push({document:doc, title:"The Los Angeles Times Snapshot"});
      newItem.complete();
}



function doWeb(doc, url)
{
      var namespace = doc.documentElement.namespaceURI;
      var nsResolver = namespace ? function(prefix) {
              if (prefix == ''x'') return namespace; else return null;
      } : null;


      var xpath=''//link[@title="Main"]'';
      if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext())
              {scrape(doc,url); return true;}

      xpath = ''//h1'';
      var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
      var row;
      while(row=rows.iterateNext())
      {
              if(Zotero.Utilities.cleanString(row.textContent.toLowerCase())=="travel")
                      {scrape(doc,url); return true;}
      }

      if(doc.title.indexOf("Search Results")>-1)
      {
              xpath=''//div[@class="abstract1"]'';
              var count=0;
              rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
              while(row=rows.iterateNext())
              {
                      count=getCount(row.textContent);
                      if(count!=0)
                              {break;}
              }
              if(count==0)
              {
                      xpath=''//td[@class="abstract1"]'';
                      rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
                      while(row=rows.iterateNext())
                      {
                              count=getCount(row.textContent);
                              if(count!=0)
                                      {break;}
                      }
              }

              if(count>0)
              {
                      var items=new Array();
                      xpath=''//div[@class="headline14"]/a'';
                      rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
                      while(row=rows.iterateNext())
                      {
                              if(count==0)
                                      {break;}
                              if(row.href.indexOf("/travel/")<0)
				{items[row.href]=Zotero.Utilities.cleanString(row.textContent);}
                              count--;
                      }

                      return processList(items);
              }
      }
}');

REPLACE INTO translators VALUES ('1a3e63b2-0adf-4c8e-928b-c58c2594b45d', '1.0.0b4.r1', '', '2008-01-09 20:00:00', '0', '100', '4', 'BioMed Central and More', 'Ben Parr', 'http://[^/]*(biomedcentral|actavetscand|aidsrestherapy|almob|ann-clinmicrob|annals-general-psychiatry|asir-journal|arthritis-research|anzhealthpolicy|behavioralandbrainfunctions|bjoc.beilstein-journals|biology-direct|biomagres|bio-diglib|biomedical-engineering-online|bpsmedicine|breast-cancer-research|cancerci|cbmjournal|cardiab|cardiovascularultrasound|cellandchromosome|biosignaling|celldiv|cerebrospinalfluidresearch|journal.chemistrycentral|capmh|cmjournal|chiroandosteo|clinicalmolecularallergy|cpementalhealth|comparative-hepatology|conflictandhealth|resource-allocation|coughjournal|ccforum|cytojournal|diagnosticpathology|dynamic-med|ete-online|ehjournal|epi-perspectives|filariajournal|frontiersinzoology|gvt-journal|genomebiology|geochemicaltransactions|globalizationandhealth|harmreductionjournal|head-face-med|hqlo|health-policy-systems|human-resources-health|immunityageing|immunome-research|implementationscience|infectagentscancer|internationalbreastfeedingjournal|equityhealthj|ijbnpa|ij-healthgeographics|issoonline|jautoimdis|jbiol|j-biomed-discovery|jbppni|carcinogenesis|cardiothoracicsurgery|jcircadianrhythms|ethnobiomed|jexpclinassistreprod|jibtherapies|journal-inflammation|jmedicalcasereports|jmolecularsignaling|jnanobiotechnology|jnrbm|jneuroengrehab|jneuroinflammation|occup-med|josr-online|translational-medicine|kinetoplastids|lipidworld|malariajournal|medimmunol|microbialcellfactories|molecular-cancer|molecularneurodegeneration|molecularpain|neuraldevelopment|nonlinearbiomedphys|nuclear-receptor|nutritionandmetabolism|nutritionj|ojrd|om-pc|particleandfibretoxicology|ped-rheum|peh-med|plantmethods|pophealthmetrics|proteomesci|ro-journal|rbej|reproductive-health-journal|respiratory-research|retrovirology|salinesystems|scoliosisjournal|scfbm|substanceabusepolicy|tbiomed|thrombosisjournal|trialsjournal|virologyj|wjes|wjso)\.(com|org|net)', 
'function detectWeb(doc,url)
{
	var namespace = doc.documentElement.namespaceURI;
    	var nsResolver = namespace ? function(prefix) {
        if (prefix == "x" ) return namespace; else return null;
    	} : null;
    	
    	var xpath=''//meta[@name="citation_fulltext_html_url"]'';
    	
    	//Single
    	if (doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) 
    		{return "journalArticle";}
    		
    	
    	//Multiple
    	xpath=''//a[@class="hiddenlink"][span[@class="xcitationtitle"][b]]'';
	xpath+='' | //span[@class="xcitationtitle2"]/a[@class="hiddenlink"]'';
	xpath+='' | //div[@class="bodytext"]/a[@class="hiddenlink"][font/b]'';
	xpath+='' | //p[@class="bodytext"]/a[@class="hiddenblack"][b]'';
	xpath+='' | //div[@class="bodytext"]/a[@class="hiddenblack"][b]'';
	xpath+='' | //div[@class="bodytext"]/a[@class="hiddenlink"][font/b]'';
	
	var rows=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var row;
	var link;
	while(row=rows.iterateNext())
	{
		link=row.href;
		if(link.indexOf("pubmed")<0 && link.substr(link.length-4)!=".pdf" && link.indexOf("blogs.")<0)
			{return "multiple";}
	}
	
}', 
'function parseRIS(getURL)
{  
    Zotero.Utilities.HTTP.doGet(getURL, function(text){
        // load translator for RIS
        var translator = Zotero.loadTranslator ("import");
        translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
        translator.setString(text);
        translator.translate();
        Zotero.done();
    }, function() {});

    Zotero.wait();
}

function doWeb(doc,url)
{
	var namespace = doc.documentElement.namespaceURI;
    	var nsResolver = namespace ? function(prefix) {
        if (prefix == "x" ) return namespace; else return null;
    	} : null;
    	
    	var xpath=''//meta[@name="citation_fulltext_html_url"]/@content'';
    	var rows;
    	var row=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
    	if (row) 
    	{
	    	//Single Article	    	
	    	var url=row.textContent+"/citation";
	    	Zotero.Utilities.HTTP.doPost(url, ''include=cit&format=refman&direct=on&submit=Download+references&action=submit'', function(text)
	    		{parseRIS(url+''?include=cit&format=refman&direct=on&submit=Download+references&action=submit'');});
   
    		Zotero.wait();
    		return true;
	}
 	
 	
 	//Multiple
    	xpath=''//a[@class="hiddenlink"][span[@class="xcitationtitle"][b]]'';
	xpath+='' | //span[@class="xcitationtitle2"]/a[@class="hiddenlink"]'';
	xpath+='' | //div[@class="bodytext"]/a[@class="hiddenlink"][font/b]'';
	xpath+='' | //p[@class="bodytext"]/a[@class="hiddenblack"][b]'';
	xpath+='' | //div[@class="bodytext"]/a[@class="hiddenblack"][b]'';
	xpath+='' | //div[@class="bodytext"]/a[@class="hiddenlink"][font/b]'';

	rows=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var items=new Array();
	var link;
	var t;
	while(row=rows.iterateNext())
	{
		link=row.href;
		if(link.indexOf("pubmed")<0 && link.substr(link.length-4)!=".pdf" && link.indexOf("blogs.")<0)
		{
			t=link.split(''/'');
			if(t[t.length-1].indexOf("comments#")>-1)
				{link=t.slice(0,t.length-1).join(''/'');}
			items[link.replace("/abstract","")+"/citation"]=row.textContent;
		}
	}
	
	items = Zotero.selectItems(items);
       	var uris=new Array();
       	if (!items)
               {return true;}

        for (var i in items)
               {uris.push(i);}

       	Zotero.Utilities.HTTP.doPost(uris, "include=cit&format=refman&direct=on&submit=Download+references&action=submit", function(text)
       	{
       	    for (var j = 0 ; j < uris.length ; j++)
       	    	{parseRIS(uris[j] + "?include=cit&format=refman&direct=on&submit=Download+references&action=submit");}
       	});
       
       	Zotero.wait();
}
');

REPLACE INTO translators VALUES ('8a07dd43-2bce-47bf-b4bf-c0fc441b79a9', '1.0.0b4.r5', '', '2008-02-27 23:00:00', '0', '100', '4', 'Optics Express', 'Michael Berkowitz', 'http://(www.)?opticsexpress\.org', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var searchpath = ''//div[@id="col2"]/p/strong/a'';
	if (doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("abstract.cfm") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var  articles = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = ''//div[@id="col2"]/p/strong/a'';
		var art = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var next_art;
		while (next_art = art.iterateNext()) {
			items[next_art.href] = Zotero.Utilities.trimInternal(next_art.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	for (var a in articles) {
		var link = articles[a];
		Zotero.Utilities.HTTP.doGet(link, function(text) {
			var id = text.match(/name=\"articles\"\s+value=\"([^"]+)\"/)[1];
			var action = text.match(/select\s+name=\"([^"]+)\"/)[1];
			Zotero.debug(id);
			Zotero.debug(action);
			var get = ''http://www.opticsinfobase.org/custom_tags/IB_Download_Citations.cfm'';
			var post = ''articles='' + id + ''&ArticleAction=save_endnote2&'' + action + ''=save_endnote2'';
			Zotero.debug(get + "?" + post);
			Zotero.Utilities.HTTP.doPost(get, post, function(text) {
				var translator = Zotero.loadTranslator("import");
				translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				translator.setString(text);
				translator.setHandler("itemDone", function(obj, item) {
					var pubName;
					if (item.journalAbbreviation) {
						pubName = item.journalAbbreviation;
					} else {
						pubName = item.publicationTitle;
					}
					Zotero.debug(pubName);
					item.attachments = [{url:articles[a], title:pubName + " Snapshot", mimeType:"text/html"}];
					item.complete();
				});
				translator.translate();
			});
		});
	}
}');

REPLACE INTO translators VALUES ('a1a97ad4-493a-45f2-bd46-016069de4162', '1.0.0b4.r1', '', '2008-02-27 23:00:00', '0', '100', '4', 'Optical Society of America', 'Michael Berkowitz', 'https?://[^.]+\.(opticsinfobase|osa)\.org', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var searchpath = ''//div[@id="col2"]/p/strong/a'';
	if (doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("abstract.cfm") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	var host = doc.location.host;
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = ''//div[@id="col2"]/p/strong/a'';
		var arts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var next_art;
		while (next_art = arts.iterateNext()) {
			items[next_art.href] = Zotero.Utilities.trimInternal(next_art.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	Zotero.debug(articles);
	Zotero.Utilities.processDocuments(articles, function(newDoc) {
		Zotero.debug(newDoc.location.href);
		var osalink = newDoc.evaluate(''//div[@id="abstract"]/p/a[contains(text(), "opticsinfobase")]'', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
		Zotero.debug(osalink);
		Zotero.Utilities.HTTP.doGet(osalink, function(text) {
			var action = text.match(/select\s+name=\"([^"]+)\"/)[1];
			var id = text.match(/input\s+type=\"hidden\"\s+name=\"articles\"\s+value=\"([^"]+)\"/)[1];
			var get = ''http://'' + host + ''/custom_tags/IB_Download_Citations.cfm'';
			var post = ''articles='' + id + ''&ArticleAction=save_endnote2&'' + action + ''=save_endnote2'';
			Zotero.Utilities.HTTP.doPost(get, post, function(text) {
				var translator = Zotero.loadTranslator("import");
				translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				translator.setString(text);
				translator.setHandler("itemDone", function(obj, item) {
					var pubName;
					if (item.journalAbbreviation) {
						pubName = item.journalAbbreviation;
					} else {
						pubName = item.publicationTitle;
					}
					Zotero.debug(pubName);
					item.attachments = [{url:osalink, title:pubName + " Snapshot", mimeType:"text/html"}];
					item.complete();
				});
				translator.translate();
			});
		});
	}, function() {Zotero.done;});
	
}');

REPLACE INTO translators VALUES ('b61c224b-34b6-4bfd-8a76-a476e7092d43', '1.0.0b4.r5', '', '2008-03-21 15:30:00', '1', '100', '4', 'SSRN', 'Michael Berkowitz', 'http://papers\.ssrn\.com/', 
'function detectWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	if (!doc.evaluate(''//span[@id="knownuser"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return false;
	}
	if (doc.evaluate(''//font/strong/a[substring(@class, 1, 4) = "text"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("abstract_id") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	
	var uris = new Array();
	
	if (doc.evaluate(''//font/strong/a[substring(@class, 1, 4) = "text"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var items = new Object();
		var xpath = ''//font/strong/a[substring(@class, 1, 4) = "text"]'';
		var titles = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var next_title = titles.iterateNext();
		while (next_title) {
			items[next_title.href] = next_title.textContent;
			next_title = titles.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			uris.push(i);
		}
	} else {
		uris.push(url);
	}
	
	Zotero.Utilities.processDocuments(uris, function(newDoc) {
		var id = newDoc.location.href.match(/abstract_id=(\d+)/)[1];
		if (newDoc.evaluate(''//a[@title="Download from Social Science Research Network"]'', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var pdfurl = newDoc.evaluate(''//a[@title="Download from Social Science Research Network"]'', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
		}
		var newURL = ''http://papers.ssrn.com/sol3/RefExport.cfm?abstract_id='' + id + ''&format=3'';
		Zotero.Utilities.HTTP.doGet(newURL, function(text) {
			var ris=text.match(/<input type=\"Hidden\"\s+name=\"hdnContent\"\s+value=\"([^"]*)\">/)[1];
			var trans=Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(ris);
			trans.setHandler("itemDone", function(obj, item) {
				item.itemType = "journalArticle";
				var tags = new Array();
				for each (var tag in item.tags) {
					var newtags = tag.split(",");
					for each (var newtag in newtags) tags.push(newtag);
				}
				item.tags = tags;
				item.attachments = [{url:item.url, title:"SSRN Snapshot", mimeType:"text/html"}];
				if (pdfurl) item.attachments.push({url:pdfurl, title:"SSRN Full Text PDF", mimeType:"application/pdf"});
				item.complete();
			});
			trans.translate();
		});
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('1c34744d-690f-4cac-b31b-b7f0c90ac14d', '1.0.0b3.r1', '', '2007-12-21 16:00:00', '0', '100', '4', 'RSC Publishing', 'Ramesh Srigiriraju', 'http://(:?www\.|google\.)?rsc\.org/', 
'function detectWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var journalreg=new RegExp("http://(:?www\.)?rsc\.org/(:?P|p)ublishing/(:?J|j)ournals");
	if(journalreg.test(url))	{
		var browspath=''//div/p/a[text()="Use advanced search"]'';
		if(doc.evaluate(browspath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
			return "multiple";
		var searchpath=''//a[text()="Back to Search Form"]'';
		if(doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
			return "multiple";
		var singpath=''//ul/li/a[text()="HTML Article" or text()="PDF"]'';
		if(doc.evaluate(singpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
			return "journalArticle";
	}
	var magpath=''//div/h3[text()="Link to journal article"]'';
	if(doc.evaluate(magpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
		return "magazineArticle";
	var magbrows=''//div/h4[@class="newstitle"]/a'';
	if(doc.evaluate(magbrows, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
		return "multiple";
	var magsearch=''//p[@class="more"]/strong/a[text()="Search RSC journals"]'';
	if(doc.evaluate(magsearch, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
		return "multiple";
	var bookreg=new RegExp("http://(:?www\.)?rsc\.org/(:?P|p)ublishing/e(:?B|b)ooks");
	if(bookreg.test(url))	{
		var pagepath=''//title/text()'';
		var page=doc.evaluate(pagepath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
		if((page=="Books in a publication year")||(page=="Subject Area Books")||(page=="A - Z Index")
			||(page=="Book Series"))
				return "multiple";
		var chappath=''//dt/img[@alt="Chapter"]'';
		var singpath=''//h3[text()="Table of Contents"]'';
		if(doc.evaluate(chappath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
			return "bookSection";
		else if(doc.evaluate(singpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
			return "book";
	}
	var searchpath=''//div/p[@class="title"][text()="Search Results"]'';
	if(doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
		return "multiple";
}', 
'function doChap(newItem, chaptext)	{
	var chapdata=chaptext.split("<br>");
	for(var pos=chapdata.length-2; pos>=0; pos--)	{
		chapdata[pos]=Zotero.Utilities.cleanTags(chapdata[pos]);
		if(chapdata[pos].indexOf("Editors")!=-1)	{
			var editors=chapdata[pos].split(",");
			for(var i=0; i<=editors.length-1; i++)	{
				editors[i]=Zotero.Utilities.cleanString(editors[i]);
				var names=editors[i].split(" ");
				var creators=new Array();
				if(i==0)
					creators.firstName=names[1];
				else
					creators.firstName=names[0];
				creators.lastName=names[names.length-1];
				creators.creatorType="editor";
				newItem.creators.push(creators);
			}
		}
		if(chapdata[pos].indexOf("Authors")!=-1)	{
			var authors=chapdata[pos].split(",");
			for(var i=0; i<=authors.length-1; i++)	{
				authors[i]=Zotero.Utilities.cleanString(authors[i]);
				var names=authors[i].split(" ");
				var creators=new Array();
				if(i==0)
					creators.firstName=names[1];
				else
					creators.firstName=names[0];
				creators.lastName=names[names.length-1];
				creators.creatorType="editor";
				newItem.creators.push(creators);
			}
		}
		if(chapdata[pos].indexOf("DOI")!=-1)
			newItem.itemID=chapdata[pos].substring(chapdata[pos].indexOf("1"));
		if(chapdata[pos].indexOf("Book")!=-1)
			newItem.bookTitle=chapdata[pos].substring(chapdata[pos].indexOf(" ")+1);
	}
}
function doBook(newItem, bookdata)	{
	var fields=bookdata.split("<br>");
	for(var pos=fields.length-2; pos>=0; pos--)	{
		fields[pos]=Zotero.Utilities.cleanTags(fields[pos]);
		if(fields[pos].indexOf("Volume")!=-1)	{
			var i=fields[pos].lastIndexOf(";");
			var vol;
			if(i!=-1)
				vol=fields[pos].substring(i+1);
			else
				vol=fields[pos].substring(fields[pos].lastIndexOf(" "));
			newItem.volume=Zotero.Utilities.cleanString(vol);
		}
		if(fields[pos].indexOf("Edition")!=-1)	{
			var i=fields[pos].lastIndexOf(";");
			if(i!=-1)
				ed=fields[pos].substring(i+1);
			else
				ed=fields[pos].substring(fields[pos].lastIndexOf(" "));
			newItem.edition=Zotero.Utilities.cleanString(ed);
		}
		if(fields[pos].indexOf("Copyright")!=-1)	{
			var i=fields[pos].lastIndexOf(";");
			var date;
			if(i!=-1)
				date=fields[pos].substring(i+1);
			else
				date=fields[pos].substring(fields[pos].indexOf(":")+2);
			newItem.date=Zotero.Utilities.cleanString(date);
		}
		if(fields[pos].indexOf("ISBN")!=-1&&fields[pos].indexOf("print")!=-1)	{
			var i=fields[pos].lastIndexOf(";");
			var isbn;
			if(i!=-1)
				isbn=fields[pos].substring(i+1);
			else
				isbn=fields[pos].substring(fields[pos].indexOf(":")+2);
			newItem.ISBN=Zotero.Utilities.cleanString(isbn);
		}
		if(fields[pos].indexOf("Author")!=-1||fields[pos].indexOf("Editor")!=-1)	{
			var authors=fields[pos].split(",");
			for(var i=0; i<=authors.length-1; i++)	{
				authors[i]=Zotero.Utilities.cleanString(authors[i]);
				var names=authors[i].split(" ");
				var creators=new Array();
				creators.firstName=names[0];
				creators.lastName=names[names.length-2];
				if(names[names.length-1]=="(Editor)")
					creators.creatorType="editor";
				if(names[names.length-1]=="(Author)")
					creators.creatorType="author";
				newItem.creators.push(creators);
			}
		}
		if(fields[pos].indexOf("DOI:")!=-1)
			newItem.itemID=fields[pos].substring(fields[pos].indexOf("1"));
	}
}
function doWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var journalreg=new RegExp("http://(:?www\.)?rsc\.org/(:?P|p)ublishing/(:?J|j)ournals");
	if(journalreg.test(url))	{
		var browspath=''//div/p/a[text()="Use advanced search"]'';
		if(doc.evaluate(browspath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
			var doipath=''//p[strong/text()="DOI:"]/a/text()'';
			var dois=doc.evaluate(doipath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var titlpath=''//p/strong/a'';
			var titles=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var items=new Array();
			var doi;
			while(doi=dois.iterateNext())
				items[doi.nodeValue]=Zotero.Utilities.cleanString(titles.iterateNext().textContent);
			items=Zotero.selectItems(items);
			var string="http://www.rsc.org/delivery/_ArticleLinking/refdownload.asp?";
			for(var codes in items)	{
				var string="http://www.rsc.org/delivery/_ArticleLinking/refdownload.asp?ManuscriptID=";
				string+=codes.substring(codes.indexOf("/")+1)+"&type=refman";
				Zotero.Utilities.HTTP.doGet(string, function(text)	{
					var trans=Zotero.loadTranslator("import");
					trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
					// fix bad Y1 tags, which have wrong spacing and typically terminate with "///"
					text = text.replace("Y1 -  ", "Y1  - ");
					trans.setString(text);
					trans.translate();
					Zotero.done();	
				});
			}
		}
		var searchpath=''//a[text()="Back to Search Form"]'';
		if(doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
			var doipath=''//p[strong/text()="DOI:"]/a/text()'';
			var dois=doc.evaluate(doipath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var titlpath=''//form/div/h5'';
			var titles=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var title;
			var items=new Array();
			while(title=titles.iterateNext())
				items[dois.iterateNext().nodeValue]=title.textContent;
			items=Zotero.selectItems(items);
			var string="http://www.rsc.org/delivery/_ArticleLinking/refdownload.asp?";
			for(var codes in items)	{
				var string="http://www.rsc.org/delivery/_ArticleLinking/refdownload.asp?ManuscriptID=";
				string+=codes.substring(codes.indexOf("/")+1)+"&type=refman";
				Zotero.Utilities.HTTP.doGet(string, function(text)	{
					var trans=Zotero.loadTranslator("import");
					trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
					// fix bad Y1 tags, which have wrong spacing and typically terminate with "///"
					text = text.replace("Y1 -  ", "Y1  - ");
					trans.setString(text);
					trans.translate();
					Zotero.done();
				});
			}
		}
		var singpath=''//ul/li/a[text()="HTML Article" or text()="PDF"]'';
		if(doc.evaluate(singpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
			var doipath=''//div/p[strong/text()="DOI:"]'';
			var text=doc.evaluate(doipath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var doi=text.substring(text.indexOf("/")+1);
			var string="http://www.rsc.org/delivery/_ArticleLinking/refdownload.asp?ManuscriptID="+doi;
			string+="&type=refman";
			Zotero.Utilities.HTTP.doGet(string, function(text)	{
				var trans=Zotero.loadTranslator("import");
				trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				// fix bad Y1 tags, which have wrong spacing and typically terminate with "///"
				text = text.replace("Y1 -  ", "Y1  - ");				
				trans.setString(text);
				trans.setHandler("itemDone", function(obj, newItem)	{
					var url2=newItem.url;
					var stringy;
					var archpath=''//div[h3/text()="Journals archive purchaser access"]'';
					if(doc.evaluate(archpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
						var stringy="http://www.rsc.org/ejarchive/";
						stringy+=url2.substring(url2.lastIndexOf("/")+1)+".pdf";
						newItem.attachments.push({url:stringy, title:"RSC PDF", mimeType:"application/pdf"});
					}
					else	{
						var stringy="http://www.rsc.org/delivery/_ArticleLinking/DisplayArticleForFree.cfm?doi=";
						stringy+=url2.substring(url2.lastIndexOf("/")+1);
						newItem.attachments.push({url:stringy, title:"RSC PDF", mimeType:"application/pdf"});
					}
					newItem.complete();
				});
				trans.translate();
				Zotero.done();
			});
		}
	}
	var magpath=''//div/h3[text()="Link to journal article"]'';
	if(doc.evaluate(magpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
		var newItem=new Zotero.Item("magazineArticle");
		var titlpath=''//div/h2/div[@class="header"]/text()'';
		newItem.title=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
		var authpath=''//em/text()'';
		var auth=doc.evaluate(authpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
		var authors=auth.split(",");
		if(newItem.title.indexOf("Interview")==-1)
			for(var i=0; i<=authors.length-1; i++)	{
				authors[i]=Zotero.Utilities.cleanString(authors[i]);
				var names=authors[i].split(" ");
				var creator=new Array();
				creator.firstName=names[0];
				creator.lastName=names[names.length-1];
				newItem.creators.push(creator);
			}
		var textpath=''//div[@id="content"]//text()'';
		var text=doc.evaluate(textpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var temp;
		while(temp=text.iterateNext())
			if(temp.nodeValue==newItem.title)	{
				newItem.date=text.iterateNext().nodeValue;
				break;
			}
		var datapath= ''//div[@id="breadcrumbs"]/ul/li/a/text()'';
		var data=doc.evaluate(datapath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var prev;
		while(temp=data.iterateNext())	{
			if(temp.nodeValue.indexOf("Chemi")!=-1)
				newItem.publication=temp.nodeValue;
			prev=temp;
		}
		newItem.issue=prev.nodeValue;
		newItem.complete();
	}
	var magbrows=''//div/h4[@class="newstitle"]/a'';
	if(doc.evaluate(magbrows, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
		var titlpath=''//h4[@class="newstitle"]/a'';
		var titles=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var title;
		var items=new Array();
		while(title=titles.iterateNext())
			items[title.href]=title.textContent;
		items=Zotero.selectItems(items);
		for(var linx in items)	{
			var newItem=new Zotero.Item("magazineArticle");
			newItem.url=linx;
			newItem.title=items[linx];
			var datepath=''//div[h4/a/text()="''+items[linx]+''"]/h4[@class="datetext"]/text()'';
			newItem.date=doc.evaluate(datepath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			var datapath= ''//div[@id="breadcrumbs"]/ul/li/a/text()'';
			var data=doc.evaluate(datapath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var prev;
			var temp;
			while(temp=data.iterateNext())	{
				if(temp.nodeValue.indexOf("Chemi")!=-1)
					newItem.publication=temp.nodeValue;
				prev=temp;
			}
			if(prev.nodeValue!=newItem.publication)
				newItem.issue=prev.nodeValue;
			newItem.complete();
		}
	}
	var magsearch=''//p[@class="more"]/strong/a[text()="Search RSC journals"]'';
	if(doc.evaluate(magsearch, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
		var titlpath=''//div/p/a'';
		var titles=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		titlpath=''//blockquote/p/a[span/@class="l"]'';
		var titles2=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null)
		var title;
		var items=new Array();
		while(title=titles.iterateNext())
			items[title.href]=title.textContent;
		while(title=titles2.iterateNext())
			items[title.href]=title.textContent;
		items=Zotero.selectItems(items);
		for(var linx in items)	{
			var newItem=new Zotero.Item("magazineArticle");
			newItem.url=linx;
			newItem.title=items[linx];
			newItem.complete();
		}
	}
	var bookreg=new RegExp("http://(:?www\.)?rsc\.org/(:?P|p)ublishing/e(:?B|b)ooks");
	if(bookreg.test(url))	{
		var browspath=''//title/text()'';
		var page=doc.evaluate(browspath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
		if((page=="Books in a publication year")||(page=="Subject Area Books")||(page=="A - Z Index")
			||(page=="Book Series"))	{
			var doipath=''//dd/p/a/text()'';
			var dois=doc.evaluate(doipath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var items=new Array();
			var title;
			while(title=dois.iterateNext())	{
				var doi=dois.iterateNext().nodeValue;
				items[doi.substring(doi.indexOf("1"))]=title.nodeValue;
			}
			items=Zotero.selectItems(items);
			for(var codes in items)	{
				var newItem=new Zotero.Item("book");
				newItem.itemID=codes;
				newItem.title=items[codes];
				var itempath=''//dd/p[contains(a[2]/text(), "''+codes+''")]'';
				var itempath2=''//dd/p[contains(a/text(), "''+codes+''")]'';
				var data;
				if(data=doc.evaluate(itempath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
					data=data.innerHTML;
				else if(data=doc.evaluate(itempath2, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
					data=data.innerHTML;
				doBook(newItem, data);
				newItem.complete();
			}	
		}
		var chappath=''//dt/img[@alt="Chapter"]'';
		var singpath=''//h3[text()="Table of Contents"]'';
		if(doc.evaluate(chappath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
			var newItem=new Zotero.Item("bookSection");
			var titlpath=''//span/h3/text()'';
			var titles=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			newItem.title=titles.iterateNext().nodeValue;
			newItem.bookTitle=titles.iterateNext().nodeValue;
			var datapath=''//dd/p'';
			var entries=doc.evaluate(datapath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var chaptext=entries.iterateNext().innerHTML;
			doChap(newItem, chaptext);
			var bookdata=entries.iterateNext().innerHTML;
			doBook(newItem, bookdata);
			var linkpath=''//td[1][@class="td1"]/a[1]'';
			var linx=doc.evaluate(linkpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var pdflink;
			while(pdflink=linx.iterateNext())
				newItem.attachments.push({url:pdflink.href, title:"RCS PDF", mimeType:"application/pdf"});
			newItem.complete();
		}
		else if(doc.evaluate(singpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
			var newItem=new Zotero.Item("book");
			var itempath=''//dd/p'';
			var data=doc.evaluate(itempath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().innerHTML;
			doBook(newItem, data);
			var titlpath=''//div/h2/text()'';
			newItem.title=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			var linkpath=''//td[1][@class="td1"]/a[1]'';
			var linx=doc.evaluate(linkpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var pdflink;
			while(pdflink=linx.iterateNext())
				newItem.attachments.push({url:pdflink.href, title:"RCS PDF", mimeType:"application/pdf"});
			newItem.complete();
		}
	}
	var searchpath=''//div/p[@class="title"][text()="Search Results"]'';
	if(doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
		var doipath=''//dd/p/a/text()'';
		var dois=doc.evaluate(doipath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var title;
		var items=new Array();
		while(title=dois.iterateNext())	{
			var doi=dois.iterateNext().nodeValue;
			items[doi.substring(doi.indexOf("1"))]=title.nodeValue;
		}
		items=Zotero.selectItems(items);
		for(var codes in items)	{
			var itempath=''//dd/p[contains(a/text(), "''+codes+''")]'';
			var newpath=''//dd[contains(p[2]/a/text(), "''+codes+''")]/p[1]/strong/text()'';
			var data=doc.evaluate(itempath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().innerHTML;
			if(data.indexOf("Book:")!=-1)	{
				var newItem=new Zotero.Item("bookSection");
				newItem.itemID=codes;
				newItem.title=items[codes];
				doChap(newItem, data);
				newItem.complete();
			}
			else		{
				var newItem=new Zotero.Item("book");
				var newdata=doc.evaluate(newpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
				if(newdata.indexOf("Volume")!=-1)
					newItem.volume=newdata.substring(newdata.lastIndexOf(" ")+1);
				else
					newItem.series=newdata;
				newItem.itemID=codes;
				newItem.title=items[codes];
				doBook(newItem, data);
				newItem.complete();
			}
		}
	}
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('4fd6b89b-2316-2dc4-fd87-61a97dd941e8', '1.0.0b3.r1', '', '2008-03-28 16:30:00', '1', '100', '4', 'Library Catalog (InnoPAC)', 'Simon Kornblith and Michael Berkowitz', 'https?://[^/]+/(search(\?|~(S[\d])?)?)\??/(a|X|t)?\??', 
'function detectWeb(doc, url) {
	// First, check to see if the URL alone reveals InnoPAC, since some sites don''t reveal the MARC button
	var matchRegexp = new RegExp(''^(https?://[^/]+/search\\??/[^/]+/[^/]+/[0-9]+\%2C[^/]+/)frameset(.+)$'');
	if(matchRegexp.test(doc.location.href)) {
		return "book";
	}
	// Next, look for the MARC button
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var xpath = ''//a[img[@src="/screens/marcdisp.gif" or starts-with(@alt, "MARC ") or @src="/screens/regdisp.gif" or @alt="REGULAR RECORD DISPLAY"]]'';
	var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(elmt) {
		return "book";
	}
	// Also, check for links to an item display page
	var tags = doc.getElementsByTagName("a");
	for(var i=0; i<tags.length; i++) {
		if(matchRegexp.test(tags[i].href) || tags[i].href.match(/^https?:\/\/[^/]+\/(?:search\??\/|record=?|search%7e\/)/)) {
			if (doc.evaluate(''//span[@class="briefcitTitle"]/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
				return "multiple";
			}
		}
	}
	
	return false;
}', 
'function scrape(marc, newDoc) {
	var namespace = newDoc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	  if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var xpath = ''//pre/text()'';
	if (newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var elmts = newDoc.evaluate(xpath, newDoc, null, XPathResult.ANY_TYPE, null);
		var useNodeValue = true;
	} else {
		var elmts = newDoc.evaluate(''//pre'', newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		var useNodeValue = false;
	}
	var elmt;
	while(elmt = elmts.iterateNext()) {
		if (useNodeValue) {
			var text = elmt.nodeValue;
		} else {
			var text = elmt.textContent;
		}
		var newItem = new Zotero.Item();
		var record = new marc.record();
		
		var linee = text.split("\n");
		for (var i=0; i<linee.length; i++) {
			if(!linee[i]) {
				continue;
			}
			
			linee[i] = linee[i].replace(/[\xA0_\t]/g, " ");
			var value = linee[i].substr(7);
			
			if(linee[i].substr(0, 6) == "      ") {
				// add this onto previous value
				tagValue += value;
			} else {
				if(linee[i].substr(0, 6) == "LEADER") {
					// trap leader
					record.leader = value;
				} else {
					if(tagValue) {	// finish last tag
						tagValue = tagValue.replace(/\|(.)/g, marc.subfieldDelimiter+"$1");
						if(tagValue[0] != marc.subfieldDelimiter) {
							tagValue = marc.subfieldDelimiter+"a"+tagValue;
						}
						
						// add previous tag
						record.addField(tag, ind, tagValue);
					}
					
					var tag = linee[i].substr(0, 3);
					var ind  = linee[i].substr(4, 2);
					var tagValue = value;
				}
			}
		}
		if(tagValue) {
			tagValue = tagValue.replace(/\|(.)/g, marc.subfieldDelimiter+"$1");
			if(tagValue[0] != marc.subfieldDelimiter) {
				tagValue = marc.subfieldDelimiter+"a"+tagValue;
			}
			
			// add previous tag
			record.addField(tag, ind, tagValue);
		}
		
		record.translate(newItem);
		
		var domain = newDoc.location.href.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";
		
		newItem.complete();
	}
}

function pageByPage(marc, urls) {
	Zotero.Utilities.processDocuments(urls, function(newDoc) {
		scrape(marc, newDoc);
	}, function() { Zotero.done() });
}

function doWeb(doc, url) {
	var uri = doc.location.href;
	var newUri;
	// load translator for MARC
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	
	var matchRegexp = new RegExp(''^(https?://[^/]+/search\\??/[^/]+/[^/]+/[0-9]+\%2C[^/]+/)frameset(.+)$'');
	var m = matchRegexp.exec(uri);
	if(m) {
		newUri = m[1]+''marc''+m[2];
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
	
		var xpath = ''//a[img[@src="/screens/marcdisp.gif" or starts-with(@alt, "MARC ")]]'';
		var aTag = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if(aTag) {
			newUri = aTag.href;
		} else {
			var xpath = ''//a[img[@src="/screens/regdisp.gif" or @alt="REGULAR RECORD DISPLAY"]]'';
			var aTag = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(aTag) {
				scrape(marc.getTranslatorObject(), doc);
				return;
			}
		}
	}
	
	if(newUri) {	// single page
		pageByPage(marc, [newUri]);
	} else {	// Search results page
		// Require link to match this
		var tagRegexp = new RegExp();
		tagRegexp.compile(''^https?://[^/]+/search\\??/[^/]+/[^/]+/[0-9]+\%2C[^/]+/frameset'');
		
		var urls = new Array();
		var availableItems = new Array();
		var firstURL = false;
		
		var tableRows = doc.evaluate(''//table[@class="browseScreen"]//tr[@class="browseEntry" or @class="briefCitRow" or td/input[@type="checkbox"] or td[contains(@class,"briefCitRow")]]'',
		                             doc, nsResolver, XPathResult.ANY_TYPE, null);
		// Go through table rows
		var i = 0;
		while(tableRow = tableRows.iterateNext()) {
			// get link
			var links = doc.evaluate(''.//span[@class="briefcitTitle"]/a'', tableRow,
									 nsResolver, XPathResult.ANY_TYPE, null);
			var link = links.iterateNext();
			if(!link) {
				var links = doc.evaluate(".//a", tableRow, nsResolver, 
										 XPathResult.ANY_TYPE, null);
				link = links.iterateNext();
			}
			
			if(link) {
				if(availableItems[link.href]) {
					continue;
				}
					
				
				// Go through links
				while(link) {
					availableItems[link.href] = link.textContent;
					link = links.iterateNext();
				}
				i++;
			}
		};
		
		var items = Zotero.selectItems(availableItems);
		
		if(!items) {
			return true;
		}
		
		var newUrls = new Array();
		for(var url in items) {
			newUrls.push(url.replace("frameset", "marc"));
		}
		pageByPage(marc, newUrls);
	}

	Zotero.wait();
}');

REPLACE INTO translators VALUES ('add7c71c-21f3-ee14-d188-caf9da12728b', '1.0.0b3.r1', '', '2007-03-25 00:50:00', '1', '100', '4', 'Library Catalog (SIRSI)', 'Sean Takats', '/uhtbin/cgisirsi', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	
	var xpath = ''//tr[th[@class="viewmarctags"]][td[@class="viewmarctags"]]'';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI detectWeb: viewmarctags");
		return "book";
	}
	var xpath = ''//input[@name="VOPTIONS"]'';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI detectWeb: VOPTIONS");
		return "book";
	}
	var elmts = doc.evaluate(''/html/body/form//text()'', doc, nsResolver,
	                         XPathResult.ANY_TYPE, null);
	while(elmt = elmts.iterateNext()) {
		if(Zotero.Utilities.superCleanString(elmt.nodeValue) == "Viewing record") {
			Zotero.debug("SIRSI detectWeb: Viewing record");
			return "book";
		}
	}
	
	var xpath = ''//td[@class="searchsum"]/table'';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI detectWeb: searchsum");
		return "multiple";
	}
	var xpath = ''//form[@name="hitlist"]/table/tbody/tr'';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI detectWeb: hitlist");
		return "multiple";
	}
	//	var xpath = ''//input[@type="checkbox"]'' 	
}', 
'function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var xpath = ''//tr[th[@class="viewmarctags"]][td[@class="viewmarctags"]]'';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var elmt = elmts.iterateNext();
	if(!elmt) {
		return false;
	}

	var newItem = new Zotero.Item("book");
	newItem.extra = "";
	
	while(elmt) {
		try {
			var node = doc.evaluate(''./TD[1]/A[1]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(!node) {
				var node = doc.evaluate(''./TD[1]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			}
			
			if(node) {
				var casedField = Zotero.Utilities.superCleanString(doc.evaluate(''./TH[1]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
				field = casedField.toLowerCase();
				var value = Zotero.Utilities.superCleanString(node.nodeValue);
				if(field == "publisher") {
					newItem.publisher = value;
				} else if(field == "pub date") {
					var re = /[0-9]+/;
					var m = re.exec(value);
					newItem.date = m[0];
				} else if(field == "isbn") {
					var re = /^[0-9](?:[0-9X]+)/;
					var m = re.exec(value);
					newItem.ISBN = m[0];
				} else if(field == "title") {
					var titleParts = value.split(" / ");
					newItem.title = Zotero.Utilities.capitalizeTitle(titleParts[0]);
				} else if(field == "publication info") {
					var pubParts = value.split(" : ");
					newItem.place = pubParts[0];
				} else if(field == "personal author") {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(value, "author", true));
				} else if(field == "author"){				 
					newItem.creators.push(Zotero.Utilities.cleanAuthor(value, "author", true));
				} else if(field == "added author") {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(value, "contributor", true));
				} else if(field == "corporate author") {
					newItem.creators.push({lastName:author, fieldMode:true});
				} else if(field == "edition") {
					newItem.tags = newItem.edition = value;
				} else if(field == "subject term" || field == "corporate subject" || field == "geographic term" || field == "subject") {
					var subjects = value.split("--");
					newItem.tags = newItem.tags.concat(subjects);
				} else if(field == "personal subject") {
					var subjects = value.split(", ");
					newItem.tags = newItem.tags.push(value[0]+", "+value[1]);
				} else if(value && field != "http") {
					newItem.extra += casedField+": "+value+"\n";
				}
			}
		} catch (e) {}
		
		elmt = elmts.iterateNext();
	}
	
	if(newItem.extra) {
		newItem.extra = newItem.extra.substr(0, newItem.extra.length-1);
	}
	
	var callNumber = doc.evaluate(''//tr/td[1][@class="holdingslist"]/text()'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(callNumber && callNumber.nodeValue) {
		newItem.callNumber = callNumber.nodeValue;
	}
	
	var domain = doc.location.href.match(/https?:\/\/([^/]+)/);
	newItem.repository = domain[1]+" Library Catalog";
	
	newItem.complete();
	return true;
}

function doWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var sirsiNew = true; //toggle between SIRSI -2003 and SIRSI 2003+
	var xpath = ''//td[@class="searchsum"]/table'';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI doWeb: searchsum");
		sirsiNew = true;	
	} else if (doc.evaluate(''//form[@name="hitlist"]/table/tbody/tr'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI doWeb: hitlist");
		sirsiNew = false;
	} else if (doc.evaluate(''//tr[th[@class="viewmarctags"]][td[@class="viewmarctags"]]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI doWeb: viewmarctags");
		sirsiNew = true;
	} else if (doc.evaluate(''//input[@name="VOPTIONS"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI doWeb: VOPTIONS");
		sirsiNew = false;
	} else {
	var elmts = doc.evaluate(''/html/body/form//text()'', doc, nsResolver,
	                         XPathResult.ANY_TYPE, null);
		while(elmt = elmts.iterateNext()) {
			if(Zotero.Utilities.superCleanString(elmt.nodeValue) == "Viewing record") {
				Zotero.debug("SIRSI doWeb: Viewing record");
				sirsiNew = false;
			}
		}
	}
	
	if (sirsiNew) { //executes Simon''s SIRSI 2003+ scraper code
		Zotero.debug("Running SIRSI 2003+ code");
		if(!scrape(doc)) {
			
			var checkboxes = new Array();
			var urls = new Array();
			var availableItems = new Array();			
			//begin IUCAT fixes by Andrew Smith
			var iuRe = /^https?:\/\/www\.iucat\.iu\.edu/;
			var iu = iuRe.exec(url);
			//IUCAT fix 1 of 2
			if (iu){
				var tableRows = doc.evaluate(''//td[@class="searchsum"]/table[//input[@class="submitLink"]]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
			} else{
				var tableRows = doc.evaluate(''//td[@class="searchsum"]/table[//input[@value="Details"]]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
			}
			var tableRow = tableRows.iterateNext();		// skip first row
			// Go through table rows
			while(tableRow = tableRows.iterateNext()) {
				//IUCAT fix 2 of 2
				if (iu){
					var input = doc.evaluate(''.//input[@class="submitLink"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					var text = doc.evaluate(''.//label/span'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				} else {
					var input = doc.evaluate(''.//input[@value="Details"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();					
					var text = doc.evaluate(''.//label/strong'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;					
				}
			//end IUCAT fixes by Andrew Smith
				if(text) {
					availableItems[input.name] = text;
				}
			}		
			var items = Zotero.selectItems(availableItems);		
			if(!items) {
				return true;
			}
			var hostRe = new RegExp("^http(?:s)?://[^/]+");
			var m = hostRe.exec(doc.location.href);
			Zotero.debug("href: " + doc.location.href);
			var hitlist = doc.forms.namedItem("hitlist");
			var baseUrl = m[0]+hitlist.getAttribute("action")+"?first_hit="+hitlist.elements.namedItem("first_hit").value+"&last_hit="+hitlist.elements.namedItem("last_hit").value;
			var uris = new Array();
			for(var i in items) {
				uris.push(baseUrl+"&"+i+"=Details");
			}
			Zotero.Utilities.processDocuments(uris, function(doc) { scrape(doc) },
				function() { Zotero.done() }, null);
			Zotero.wait();
		}	
	} else{  //executes Simon''s SIRSI -2003 translator code
		Zotero.debug("Running SIRSI -2003 code");
		var uri = doc.location.href;
		var recNumbers = new Array();
		var xpath = ''//form[@name="hitlist"]/table/tbody/tr'';
		var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt = elmts.iterateNext();
		if(elmt) {	// Search results page
			var uriRegexp = /^http:\/\/[^\/]+/;
			var m = uriRegexp.exec(uri);
			var postAction = doc.forms.namedItem("hitlist").getAttribute("action");
			var newUri = m[0]+postAction.substr(0, postAction.length-1)+"40";
			var titleRe = /<br>\s*(.*[^\s])\s*<br>/i;
			var items = new Array();
			do {
				var checkbox = doc.evaluate(''.//input[@type="checkbox"]'', elmt, nsResolver,
											XPathResult.ANY_TYPE, null).iterateNext();
				// Collect title
				var title = doc.evaluate("./td[2]", elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				if(checkbox && title) {
					items[checkbox.name] = Zotero.Utilities.cleanString(title);
				}
			} while(elmt = elmts.iterateNext());
			items = Zotero.selectItems(items);
			
			if(!items) {
				return true;
			}
			
			for(var i in items) {
				recNumbers.push(i);
			}
		} else {		// Normal page
			// this regex will fail about 1/100,000,000 tries
			var uriRegexp = /^((.*?)\/([0-9]+?))\//;
			var m = uriRegexp.exec(uri);
			var newUri = m[1]+"/40"
			
			var elmts = doc.evaluate(''/html/body/form'', doc, nsResolver,
									 XPathResult.ANY_TYPE, null);
			while(elmt = elmts.iterateNext()) {
				var initialText = doc.evaluate(''.//text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if(initialText && initialText.nodeValue && Zotero.Utilities.superCleanString(initialText.nodeValue) == "Viewing record") {
					recNumbers.push(doc.evaluate(''./b[1]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
					break;
				}
			}	
			// begin Emory compatibility
			var elmts = doc.evaluate(''//input[@name="first_hit"]'', doc, nsResolver,
									 XPathResult.ANY_TYPE, null);
			while (elmt = elmts.iterateNext()) {
				recNumbers.length = 0;
				var recNumber = elmt.value;
				recNumbers.push(recNumber);
				break;
			 }
			// end Emory compatibility	
		}
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
		var marc = translator.getTranslatorObject();
		Zotero.Utilities.loadDocument(newUri+''?marks=''+recNumbers.join(",")+''&shadow=NO&format=FLAT+ASCII&sort=TITLE&vopt_elst=ALL&library=ALL&display_rule=ASCENDING&duedate_code=l&holdcount_code=t&DOWNLOAD_x=22&DOWNLOAD_y=12&address=&form_type='', function(doc) {
			var pre = doc.getElementsByTagName("pre");
			var text = pre[0].textContent;
			var documents = text.split("*** DOCUMENT BOUNDARY ***");
			for(var j=1; j<documents.length; j++) {
				var uri = newUri+"?marks="+recNumbers[j]+"&shadow=NO&format=FLAT+ASCII&sort=TITLE&vopt_elst=ALL&library=ALL&display_rule=ASCENDING&duedate_code=l&holdcount_code=t&DOWNLOAD_x=22&DOWNLOAD_y=12&address=&form_type=";
				var lines = documents[j].split("\n");
				var record = new marc.record();
				var tag, content;
				var ind = "";
				for(var i=0; i<lines.length; i++) {
					var line = lines[i];
					if(line[0] == "." && line.substr(4,2) == ". ") {
						if(tag) {
							content = content.replace(/\|([a-z])/g, marc.subfieldDelimiter+"$1");
							record.addField(tag, ind, content);
						}
					} else {
						content += " "+line.substr(6);
						continue;
					}
					tag = line.substr(1, 3);	
					if(tag[0] != "0" || tag[1] != "0") {
						ind = line.substr(6, 2);
						content = line.substr(8);
					} else {
						content = line.substr(7);
						if(tag == "000") {
							tag = undefined;
							record.leader = "00000"+content;
							Zotero.debug("the leader is: "+record.leader);
						}
					}
				}	
				var newItem = new Zotero.Item();
				record.translate(newItem);
				
				var domain = url.match(/https?:\/\/([^/]+)/);
				newItem.repository = domain[1]+" Library Catalog";

				newItem.complete();
			}
			Zotero.done();
		});
		Zotero.wait();	
	}
}');

REPLACE INTO translators VALUES ('a77690cf-c5d1-8fc4-110f-d1fc765dcf88', '1.0.0b3.r1', '', '2007-12-03 03:00:00', '1', '100', '4', 'ProQuest', 'Simon Kornblith', '^https?://[^/]+/pqdweb\?((?:.*\&)?did=.*&Fmt=[0-9]|(?:.*\&)Fmt=[0-9].*&did=|(?:.*\&)searchInterface=|(?:.*\&)TS=[0-9])', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	       
	if(doc.evaluate(''//img[substring(@src, string-length(@src)-32) = "/images/common/logo_proquest.gif" or substring(@src, string-length(@src)-38) = "/images/common/logo_proquest_small.gif"]'',
	                doc, nsResolver, XPathResult.ANY_TYPE, null)) {    
		                
		
		var xpath = ''//table[@id="tableIndexTerms"]/tbody/tr/td[@class="textSmall"]'';
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
				case ''Dissertation'':
					return "thesis";
					break;
				case ''Historical Newspaper'':
				case ''Newspaper'':
					return "newspaperArticle";
				default:
					return "journalArticle";
					break;
			}
			
		}
	}
}

//^https?://[^/]+/pqdweb\?((?:.*\&)?did=.*&Fmt=[0-9]|(?:.*\&)Fmt=[0-9].*&did=|(?:.*\&)searchInterface=)', 
'function parseRIS(uris) {
	
	Zotero.Utilities.HTTP.doGet(uris, function(text, xmlhttp, url){	
		// load translator for RIS

		if(url.match("exportFormat=1")=="exportFormat=1") {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			// Strip lines with just whitespace, which mess up RIS parsing
			text = text.replace(/^\s*$\n/gm, '''');
			translator.setString(text);

			//Set Handler fixes anomaly in Proquest RIS format. Properly formats author name as [last name], [first name]
			translator.setHandler("itemDone", function(obj, item) {
				var cre = new Array();
				cre = item.creators;
				for each(var e in cre) {
	
					if(!e[''firstName'']) {
						//check if there is a first name, if not, take the first word in the last name
						var names = e[''lastName''].split(" ");
						e[''firstName'']=names[0];
						e[''lastName'']="";
						for(var i = 1; i<names.length; i++) {
							e[''lastName'']+=names[i];
						}
					}
				}

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
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var hostRegexp = new RegExp("^(https?://[^/]+)/");
	var hMatch = hostRegexp.exec(url);
	var host = hMatch[1];
	

	
	if(doc.evaluate(''//img[substring(@src, string-length(@src)-32) = "/images/common/logo_proquest.gif" or substring(@src, string-length(@src)-38) = "/images/common/logo_proquest_small.gif"]'',
		                doc, nsResolver, XPathResult.ANY_TYPE, null)) {
			if(doc.title == "Results") {
				
				//Get Client ID
				var xpath = ''//a'';
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
				
				var multXpath = ''//input[@name="chk"][@type="checkbox"]'';
				var titleXpath = ''//a[@class="bold"]'';
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
				var xpath = ''//a'';
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
				var xpath = ''//input[@name="marked"][@type="checkbox"]'';
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

}');

REPLACE INTO translators VALUES ('6773a9af-5375-3224-d148-d32793884dec', '1.0.0b3.r1', '', '2006-12-18 06:00:45', '1', '100', '4', 'InfoTrac', 'Simon Kornblith', '^https?://[^/]+/itw/infomark/', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	// ensure that there is an InfoTrac logo
	if(!doc.evaluate(''//img[substring(@alt, 1, 8) = "InfoTrac"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) return false;
	
	if(doc.title.substring(0, 8) == "Article ") {
		var genre = doc.evaluate(''//comment()[substring(., 1, 6) = " Genre"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		
		if(genre) {
			var value = Zotero.Utilities.cleanString(genre.nodeValue.substr(7));
			if(value == "article") {
				return "journalArticle";
			} else if(value == "book") {
				return "book";
			} else if(value == "dissertation") {
				return "thesis";
			} else if(value == "bookitem") {
				return "bookSection";
			}
		}
		
		return "magazineArticle";
	} else if(doc.title.substring(0, 10) == "Citations ") {
		return "multiple";
	}
}', 
'function extractCitation(url, elmts, title, doc) {
	var newItem = new Zotero.Item();
	newItem.url = url;
	
	if(title) {
		newItem.title = Zotero.Utilities.superCleanString(title);
	}
	while(elmt = elmts.iterateNext()) {
		var colon = elmt.nodeValue.indexOf(":");
		var field = elmt.nodeValue.substring(1, colon).toLowerCase();
		var value = elmt.nodeValue.substring(colon+1, elmt.nodeValue.length-1);
		if(field == "title") {
			newItem.title = Zotero.Utilities.superCleanString(value);
		} else if(field == "journal") {
			newItem.publicationTitle = value;
		} else if(field == "pi") {
			parts = value.split(" ");
			var date = "";
			var field = null;
			for(j in parts) {
				firstChar = parts[j].substring(0, 1);
				
				if(firstChar == "v") {
					newItem.itemType = "journalArticle";
					field = "volume";
				} else if(firstChar == "i") {
					field = "issue";
				} else if(firstChar == "p") {
					field = "pages";
					
					var pagesRegexp = /p(\w+)\((\w+)\)/;	// weird looking page range
					var match = pagesRegexp.exec(parts[j]);
					if(match) {			// yup, it''s weird
						var finalPage = parseInt(match[1])+parseInt(match[2])
						parts[j] = "p"+match[1]+"-"+finalPage.toString();
					} else if(!newItem.itemType) {	// no, it''s normal
						// check to see if it''s numeric, bc newspaper pages aren''t
						var justPageNumber = parts[j].substr(1);
						if(parseInt(justPageNumber).toString() != justPageNumber) {
							newItem.itemType = "newspaperArticle";
						}
					}
				} else if(!field) {	// date parts at the beginning, before
									// anything else
					date += " "+parts[j];
				}
				
				if(field) {
					isDate = false;
					
					if(parts[j] != "pNA") {		// make sure it''s not an invalid
												// page number
						// chop of letter
						newItem[field] = parts[j].substring(1);
					} else if(!newItem.itemType) {		// only newspapers are missing
														// page numbers on infotrac
						newItem.itemType = "newspaperArticle";
					}
				}
			}
			
			// Set type
			if(!newItem.itemType) {
				newItem.itemType = "magazineArticle";
			}
			
			if(date != "") {
				newItem.date = date.substring(1);
			}
		} else if(field == "author") {
			var author = Zotero.Utilities.cleanAuthor(value, "author", true);
			
			// ensure author is not already there
			var add = true;
			for each(var existingAuthor in newItem.creators) {
				if(existingAuthor.firstName == author.firstName && existingAuthor.lastName == author.lastName) {
					add = false;
					break;
				}
			}
			if(add) newItem.creators.push(author);
		} else if(field == "issue") {
			newItem.issue = value;
		} else if(field == "volume") {
			newItem.volume = value;
		} else if(field == "issn") {
			newItem.ISSN = value;
		} else if(field == "gjd") {
			var m = value.match(/\(([0-9]{4}[^\)]*)\)(?:, pp\. ([0-9\-]+))?/);
			if(m) {
				newItem.date = m[1];
				newItem.pages = m[2];
			}
		} else if(field == "BookTitle") {
			newItem.publicationTitle = value;
		} else if(field == "genre") {
			value = value.toLowerCase();
			if(value == "article") {
				newItem.itemType = "journalArticle";
			} else if(value == "book") {
				newItem.itemType = "book";
			} else if(value == "dissertation") {
				newItem.itemType = "thesis";
			} else if(value == "bookitem") {
				newItem.itemType = "bookSection";
			}
		}
	}
	
	if(doc) {
		newItem.attachments.push({document:doc, title:"InfoTrac Snapshot"});
	} else {
		newItem.attachments.push({url:url, title:"InfoTrac Snapshot",
		                         mimeType:"text/html"});
	}
	
	newItem.complete();
}

function doWeb(doc, url) {	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var uri = doc.location.href;
	if(doc.title.substring(0, 8) == "Article ") {	// article
		var xpath = ''/html/body//comment()'';
		var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		extractCitation(uri, elmts);
	} else {										// search results
		var items = new Array();
		var uris = new Array();
		var elmts = new Array();
		
		var host = doc.location.href.match(/^https?:\/\/[^\/]+/)[0];
		
		var tableRows = doc.evaluate(''/html/body//table/tbody/tr/td[a/b]'', doc, nsResolver,
		                             XPathResult.ANY_TYPE, null);
		var tableRow;
		var javaScriptRe = /''([^'']*)'' *, *''([^'']*)''/
		var i = 0;
		// Go through table rows
		while(tableRow = tableRows.iterateNext()) {
			var link = doc.evaluate(''./a'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			var m = javaScriptRe.exec(link.href);
			if(m) {
				uris[i] = host+"/itw/infomark/192/215/90714844w6"+m[1]+"?sw_aep=olr_wad"+m[2];
			}
			var article = doc.evaluate(''./b/text()'', link, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			items[i] = article.nodeValue;
			// Chop off final period
			if(items[i].substr(items[i].length-1) == ".") {
				items[i] = items[i].substr(0, items[i].length-1);
			}
			elmts[i] = doc.evaluate(".//comment()", tableRow, nsResolver, XPathResult.ANY_TYPE, null);
			i++;
		}
		
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			extractCitation(uris[i], elmts[i], items[i]);
		}
	}
}');

REPLACE INTO translators VALUES ('63c25c45-6257-4985-9169-35b785a2995e', '1.0.0b3.r1', '', '2006-12-15 03:40:00', 1, 100, 4, 'InfoTrac OneFile', 'Simon Kornblith', '^https?://[^/]+/itx/(?:[a-z]+Search|retrieve|paginate|tab)\.do',
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	if(doc.evaluate(''//img[@alt="Thomson Gale"]'', doc, nsResolver,
	                XPathResult.ANY_TYPE, null).iterateNext()) {
		if(doc.evaluate(''//table[@class="resultstable"][tbody/tr[@class="unselectedRow"]]'',
		                doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			return "multiple";
		} else {
			return "journalArticle";
		}
	}
}',
'function infoTracRIS(text) {
	// load translator for RIS
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
	translator.setString(text);
	translator.setHandler("itemDone", function(obj, item) {
		if(item.notes && item.notes[0]) {
			item.extra = item.notes[0].note;
			
			delete item.notes;
			item.notes = undefined;
		}
		
		// get underscored terms (term headings?) out of tags
		for(var i in item.tags) {
			var index = item.tags[i].indexOf("_");
			if(index != -1) {
				item.tags[i] = item.tags[i].substr(0, index);
			}
		}
		
		// add names to attachments
		for(var i in item.attachments) {
			if(!item.attachments[i].title) {
				item.attachments[i] = undefined;
			} else {
				item.attachments[i].title = "InfoTrac OneFile "+item.attachments[i].title;
			}
		}
		
		//item.attachments = newAttachments.shift();
		//Zotero.debug(item.attachments);
		item.complete();
	});
	translator.translate();
	Zotero.done();
}

function readEncoded(url) {
	var newArray = new Array();
	
	var parts = url.split(/[?&]/);
	for each(var part in parts) {
		var index = part.indexOf("=");
		if(index !== -1) {
			newArray[part.substr(0, index)] = part.substr(index+1);
		}
	}
	
	return newArray;
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var hostRe = new RegExp("^https?://[^/]+/");
	var host = hostRe.exec(doc.location.href)[0];
	
	if(doc.evaluate(''//table[@class="resultstable"][tbody/tr[@class="unselectedRow"]]'',
	                doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var items = Zotero.Utilities.getItemArray(doc, doc, ''^https?://[^/]+/itx/retrieve\\.do\\?.*docId='');
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}

		// parse things out of URLs
		var time = new Date();
		time = time.getTime();
		var markedString = "";
		for(var i in items) {
			var postVal = readEncoded(i);
			markedString += postVal.tabID+"_"+postVal.docId+"_1_0_"+postVal.contentSet+"_srcprod="+postVal.prodId+"|^";
		}
		
		var postData = "inPS=true&ts="+time+"&prodId="+postVal.prodId+"&actionCmd=UPDATE_MARK_LIST&userGroupName="+postVal.userGroupName+"&markedString="+markedString+"&a="+time;
		Zotero.Utilities.HTTP.doGet(host+"itx/marklist.do?inPS=true&ts="+time+"&prodId="+postVal.prodId+"&actionCmd=CLEAR_MARK_LIST&userGroupName="+postVal.userGroupName,
		                             function(text) {			// clear marked
			Zotero.Utilities.HTTP.doPost(host+"itx/marklist.do", postData,
			                              function(text) {		// mark
				Zotero.Utilities.HTTP.doGet(host+"itx/generateCitation.do?contentSet="+postVal.contentSet+"&inPS=true&tabID=T-ALL&prodId="+postVal.prodId+"&docId=&actionString=FormatCitation&userGroupName="+postVal.userGroupName+"&citationFormat=ENDNOTE",
			                                 function(text) {	// get marked
					infoTracRIS(text);
				});
			});
		});
	} else {
		// just extract from single page
		var postVal = readEncoded(url);
		Zotero.Utilities.HTTP.doGet(host+"itx/generateCitation.do?contentSet="+postVal.contentSet+"&inPS=true&tabID="+postVal.tabID+"&prodId="+postVal.prodId+"&docId="+postVal.docId+"&actionString=FormatCitation&citationFormat=ENDNOTE",
		                             function(text) {
			infoTracRIS(text);
		});
	}
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('b047a13c-fe5c-6604-c997-bef15e502b09', '1.0.0b3.r1', '', '2008-03-18 02:30:00', '1', '100', '4', 'LexisNexis', 'Sean Takats', 'https?://[^/]*lexis-?nexis\.com[^/]*/us/lnacademic', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	if (doc.title.substr(doc.title.length-8, 8)=="Document"){
		var xpath = ''//input[@name="cisb"]'';
		var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		if (elmt.iterateNext()){
			return "newspaperArticle";
		}
	}
	var xpath = ''//input[@name="frm_tagged_documents" and @type="checkbox"]'';
	var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if (elmt.iterateNext()){
		return "multiple";
	}
}', 
'function doWeb(doc, url) {	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	// define results navigation frame doc for export buttons and hidden fields
	var rfDoc = doc.defaultView.window.top.frames[1].document;
	var xpath = ''//img[@title="Export Bibliographic References"]'';	

	var elmt = doc.evaluate(xpath, rfDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();

	var hostRe = new RegExp("^http(?:s)?://[^/]+");
	var m = hostRe.exec(doc.location.href);
	var host = m[0];

	var risb = doc.evaluate(''//input[@name="risb"]'', rfDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
	var cisb = doc.evaluate(''//input[@name="cisb"]'', rfDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
	var uri = host+"/us/lnacademic/results/listview/delPrep.do?cisb="+cisb+"&risb="+risb+"&mode=delivery_refworks";
	var hiddenInputs = doc.evaluate(''//form[@name="results_docview_DocumentForm"]//input[@type="hidden" and not(@name="tagData")]'', rfDoc, nsResolver,
		XPathResult.ANY_TYPE, null);
	var hiddenInput;
	var poststring="";
	while(hiddenInput = hiddenInputs.iterateNext()) {
		poststring = poststring+"&"+hiddenInput.name+"="+encodeURIComponent(hiddenInput.value);
	}

	var xpath = ''//input[@name="frm_tagged_documents" and @type="checkbox"]'';
	var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if (doc.title.substr(doc.title.length-8, 8)=="Document"){
		// single page
		var delRange = "cur";
		poststring = poststring + "&hiddensearchfield=Narrow+Search&reloadClassif=&format=GNBFI&focusTerms=&nextSteps=0";
	} else {
		// get multiple item titles and tags
		var xpath = ''//tr[td/input[@name="frm_tagged_documents"]]'';
		var rows = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var title;
		var tagNumber;
		var items = new Object();
		while (row = rows.iterateNext()){
			title = doc.evaluate(''.//a'', row, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			tagNumber = doc.evaluate(''./td/input[@name="frm_tagged_documents"]'', row, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
			items[tagNumber] = title;
		}		
		var tagData = "";
		items = Zotero.selectItems(items);
		if (!items) {
			return true;
		}
		for (var i in items) {
			tagData += "-"+i;
		}
		tagData = tagData.substr(1);
		var delRange = "tag";
		poststring = poststring + "&tagData=" + tagData + "&hiddensearchfield=Narrow+Search&reloadClassif=&selDomainID=4&format=GNBLIST&focusTerms=&sort=RELEVANCE&nextSteps=0";
	} 
	Zotero.Utilities.HTTP.doPost(uri, poststring, function(text) {
		uri = host+"/us/lnacademic/delivery/refExport.do";
		var disb = text.match(/<input type="hidden" name="disb" value="([^"]+)">/);
		poststring = "delRange="+delRange+"&selDocs=&disb="+disb[1]+"&initializationPage=0";
		Zotero.Utilities.HTTP.doPost(uri, poststring, function(text) {
			uri = text.match(/&amp;url=([^'']+)''/)
			uri = decodeURIComponent(uri[1]);
			uri = uri.replace(/http:\/\/[^/]*\//, host+"/");
			var uris = new Array();
			uris.push(uri);
			Zotero.Utilities.processDocuments(uris, function(newDoc){
				var elmts =newDoc.evaluate(''//html'', newDoc, nsResolver, XPathResult.ANY_TYPE, null);
				var elmt;
				while (elmt = elmts.iterateNext()){
					var newItem = new Zotero.Item("newspaperArticle");
					var title = newDoc.evaluate(''.//div[@class="HEADLINE"]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					if (title.textContent){
						newItem.title = title.textContent;
					}else{
						newItem.title = " ";
					}
					var date = newDoc.evaluate(''.//meta[@name="_lndateissue"]/@content'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					if (date){
						date = date.nodeValue;
						var m = date.match(/([^T]+)T/);
						date = m[1];
						if (date.length == 8){
							date = date.substr(0,4) + "-" + date.substr(4,2) + "-" + date.substr(6,2);
						} else if (date.length == 6){
							date = date.substr(0,4) + "-" + date.substr(4,2);
						}
						newItem.date = date; 		
					}
					var publicationTitle = newDoc.evaluate(''.//div[@class="PUB"]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					if (publicationTitle){
						newItem.publicationTitle = publicationTitle.textContent;
					}
					var section = newDoc.evaluate(''.//div[@class="SECTION-INFO"]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					if (section){
						newItem.section = section.textContent;				
					}
					var author = newDoc.evaluate(''.//div[@class="BYLINE"]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					if (author){
						newItem.creators.push(Zotero.Utilities.cleanAuthor(author.textContent, "author"));
					}
					newItem.repository = "lexisnexis.com";
					newItem.url = url;
					newItem.complete()
				}
				Zotero.done();
			});
		});
	});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('5e3e6245-83da-4f55-a39b-b712df54a935', '1.0.0b3.r1', '', '2007-08-27 05:00:00', '0', '90', '4', 'Melvyl', 'Sean Takats', '^https?://(?:melvyl.cdlib.org|melvyl-dev.cdlib.org:8162)/F(?:/[A-Z0-9\-]+(?:\?.*)?$|\?func=find|\?func=scan)', 
'function detectWeb(doc, url) {
	var singleRe = new RegExp("^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=[0-9]{3}|func=direct)");
	
	if(singleRe.test(doc.location.href)) {
		return "book";
	} else {
		var tags = doc.getElementsByTagName("a");
		for(var i=0; i<tags.length; i++) {
			if(singleRe.test(tags[i].href)) {
				return "multiple";
			}
		}
	}
}', 
'function doWeb(doc, url) {
	var detailRe = new RegExp("^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=[0-9]{3}|func=direct)");
	var uri = doc.location.href;
	var newUris = new Array();
	
	if(detailRe.test(uri)) {
	newUris.push(uri.replace(/\&format=[0-9]{3}/, "&format=001"))
	} else {
		var itemRegexp = ''^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=999|func=direct)'';
		
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
			
		var reviewXpath = ''//table/tbody/tr[td[@class="resultsDisplayWhite"]]''
		
		var reviewRows = doc.evaluate(reviewXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var reviewRow;
		
		var items = new Array();
		
		if (reviewRow = reviewRows.iterateNext()){
			var xpath = ''./td[@class="resultsDisplayWhite"][2]/a[1]'';
			var titleXpath = ''./td[@class="resultsDisplayWhite"][5]'';
			var elmt;
			var titleElmt;
			do {
				elmt = doc.evaluate(xpath, reviewRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				titleElmt = doc.evaluate(titleXpath, reviewRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				items[elmt.href] = Zotero.Utilities.cleanString(titleElmt.textContent);
			} while (reviewRow = reviewRows.iterateNext());

		} else {
			var xpath = ''//td[2][@class="resultsBrief"]/a[1]'';  // gets MELVYL links
			var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var elmt;
			var titleXpath = ''//tr[td[@class="resultsBrief"][@id="bold"]/b[text()="Title"]]/td[4]''; // gets MELVYL results titles
			var titleElmts = doc.evaluate(titleXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var titleElmt;
			while ((elmt = elmts.iterateNext()) && (titleElmt = titleElmts.iterateNext())){
				items[elmt.href] = Zotero.Utilities.cleanString(titleElmt.textContent);
			}
		}
			
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			var newUri = i.replace(/\&format=[0-9]{3}/, "&format=001")
			if(newUri == i) {
				newUri += "&format=001";
			}
			newUris.push(newUri);
		}
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	Zotero.Utilities.processDocuments(newUris, function(newDoc) {
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var xpath = ''//tr[td[1][@class="contentSmall"][@id="bold"]/strong]'';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		
		var record = new marc.record();
		while(elmt = elmts.iterateNext()) {
			var field = Zotero.Utilities.superCleanString(doc.evaluate(''./TD[1]/strong/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
			var value = doc.evaluate(''./TD[2]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			
			if(field == "LDR") {
				record.leader = value;
			} else if(field != "FMT") {
				
				Zotero.debug("field=" + field);
				value = value.replace(/\|([a-z]) /g, marc.subfieldDelimiter+"$1");
				
				var code = field.substring(0, 3);
				var ind = "";
				if(field.length > 3) {
					ind = field[3];
					if(field.length > 4) {
						ind += field[4];
					}
				}
				
				record.addField(code, ind, value);
			}
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";
		
		newItem.complete();
	}, function() { Zotero.done(); }, null);
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('cf87eca8-041d-b954-795a-2d86348999d5', '1.0.0b3.r1', '', '2008-04-02 17:00:00', '1', '100', '4', 'Library Catalog (Aleph)', 'Simon Kornblith and Michael Berkowitz', 'https?://[^/]+/F(?:/[A-Z0-9\-]+(?:\?.*)?$|\?func=find|\?func=scan)', 
'function detectWeb(doc, url) {
	var singleRe = new RegExp("^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=[0-9]{3}|func=direct)");
	
	if(singleRe.test(doc.location.href)) {
		return "book";
	} else {
		var tags = doc.getElementsByTagName("a");
		for(var i=0; i<tags.length; i++) {
			if(singleRe.test(tags[i].href)) {
				return "multiple";
			}
		}
	}
}', 
'function doWeb(doc, url) {
	var detailRe = new RegExp("^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=[0-9]{3}|func=direct)");
	var uri = doc.location.href;
	var newUris = new Array();
	
	if(detailRe.test(uri)) {
		var newuri = uri.replace(/\&format=[0-9]{3}/, "&format=001");
		if (newuri == uri) newuri += "&format=001";
		newUris.push(newuri);
	} else {
		var itemRegexp = ''^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=999|func=direct)''
		var items = Zotero.Utilities.getItemArray(doc, doc, itemRegexp, ''^[0-9]+$'');
		
		// ugly hack to see if we have any items
		var haveItems = false;
		for(var i in items) {
			haveItems = true;
			break;
		}
		
		// If we don''t have any items otherwise, let us use the numbers
		if(!haveItems) {
			var items = Zotero.Utilities.getItemArray(doc, doc, itemRegexp);
		}
		
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			var newUri = i.replace("&format=999", "&format=001");
			if(newUri == i) {
				newUri += "&format=001";
			}
			newUris.push(newUri);
		}
	}
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	Zotero.Utilities.processDocuments(newUris, function(newDoc) {
		var uri = newDoc.location.href;
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		var nonstandard = false;
		var xpath;
		if (newDoc.evaluate(''//*[tr[td/text()="LDR"]]/tr[td[2]]'', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			xpath = ''//*[tr[td/text()="LDR"]]/tr[td[2]]'';
		} else if (newDoc.evaluate(''//tr[2]//table[2]//tr'', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			xpath = ''//tr[2]//table[2]//tr'';
			nonstandard = true;
		} else if (newDoc.evaluate(''//table//tr[td[2][@class="td1"]]'', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			xpath = ''//table//tr[td[2][@class="td1"]]'';
			nonstandard = true;
		}
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		var record = new marc.record();
		while(elmt = elmts.iterateNext()) {
			if (nonstandard) {
				var field = Zotero.Utilities.superCleanString(newDoc.evaluate(''./td[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			} else {
				var field = Zotero.Utilities.superCleanString(newDoc.evaluate(''./TD[1]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
			}
			var field = Zotero.Utilities.superCleanString(newDoc.evaluate(''./td[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			if(field) {
				var value = newDoc.evaluate(''./TD[2]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				if(field == "LDR") {
					record.leader = value;
				} else if(field != "FMT") {
					value = value.replace(/\|([a-z]) /g, marc.subfieldDelimiter+"$1");
				
					var code = field.substring(0, 3);
					var ind = "";
					if(field.length > 3) {
						ind = field[3];
						if(field.length > 4) {
							ind += field[4];
						}
					}
				
					record.addField(code, ind, value);
				}
			}
		}
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";

		var oldCreators = newItem.creators;
		newItem.creators = new Array();
		var transient = new Array();
		for each (var a in oldCreators) {
			if (a.lastName) {
				if (!a.lastName.match(/\d+/)) transient.push(a);
			}
		}
		for each (var a in transient) {
			if (a.firstName) {
				if (a.firstName.match(/|/)) a.firstName = a.firstName.match(/([^|]+)\s+|/)[1];
			}
		}
		newItem.creators = transient;
		newItem.complete();
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('774d7dc2-3474-2684-392c-f787789ec63d', '1.0.0b3.r1', '', '2007-09-19 20:30:00', '1', '100', '4', 'Library Catalog (Dynix)', 'Simon Kornblith', 'ipac\.jsp\?.*(?:uri=(?:link|full)=[0-9]|menu=search)', 
'function detectWeb(doc, url) {
	var detailsRe = new RegExp(''ipac\.jsp\?.*uri=(?:full|link)=[0-9]'');
	if(detailsRe.test(doc.location.href)) {
		return "book";
	} else {
		return "multiple";
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var uri = doc.location.href;
	var detailsRe = new RegExp(''ipac\.jsp\?.*uri=(?:full|link)=[0-9]'');
	
	var uris = new Array();
	if(detailsRe.test(uri)) {
		uris.push(uri+''&fullmarc=true'');
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, "ipac\.jsp\?.*uri=(?:full|link)=[0-9]|^javascript:buildNewList\\(''.*uri%3Dfull%3D[0-9]");
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var buildNewList = new RegExp("^javascript:buildNewList\\(''([^'']+)");
		
		var uris = new Array();
		for(var i in items) {
			var m = buildNewList.exec(i);
			if(m) {
				uris.push(unescape(m[1]+''&fullmarc=true''));
			} else {
				uris.push(i+''&fullmarc=true'');
			}
		}
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	
	Zotero.Utilities.processDocuments(uris, function(newDoc) {
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var xpath = ''//form/table[@class="tableBackground"]/tbody/tr/td/table[@class="tableBackground"]/tbody/tr[td[1]/a[@class="normalBlackFont1"]]'';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		if (!elmts.iterateNext()) {
			var xpath2 = ''//form/table[@class="tableBackground"]/tbody/tr/td/table[@class="tableBackground"]/tbody/tr[td[1]/a[@class="boldBlackFont1"]]'';
			var elmts = newDoc.evaluate(xpath2, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		var elmt;
		
		var record = new marc.record();		
		while(elmt = elmts.iterateNext()) {
			var field = Zotero.Utilities.superCleanString(newDoc.evaluate(''./TD[1]/A[1]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
			var value = newDoc.evaluate(''./TD[2]/TABLE[1]/TBODY[1]/TR[1]/TD[1]/A[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			
			if(field == "LDR") {
				record.leader = value;
			} else if(field != "FMT") {
				value = value.replace(/\$([a-z]) /g, marc.subfieldDelimiter+"$1");
				
				var code = field.substring(0, 3);
				var ind = "";
				if(field.length > 3) {
					ind = field[3];
					if(field.length > 4) {
						ind += field[4];
					}
				}
				
				record.addField(code, ind, value);
			}
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";

		newItem.complete();
	}, function() { Zotero.done() }, null);
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('63a0a351-3131-18f4-21aa-f46b9ac51d87', '1.0.0b3.r1', '', '2006-12-15 15:11:00', 1, 100, 4, 'Library Catalog (VTLS)', 'Simon Kornblith', '/chameleon(?:\?|$)', 
'function detectWeb(doc, url) {
	var node = doc.evaluate(''//tr[@class="intrRow"]/td/table/tbody/tr[th]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	if(node) {
		return "multiple";
	}
	var node = doc.evaluate(''//a[text()="marc"]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	if(node) {
		return "book";
	}
}',
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var uri = doc.location.href;
	var newUris = new Array();
	
	var marcs = doc.evaluate(''//a[text()="marc"]'', doc, nsResolver,
	                         XPathResult.ANY_TYPE, null);
	var record = marcs.iterateNext();
	
	if(record && !marcs.iterateNext()) {
		newUris.push(record.href);
	} else {
		// Require link to match this
		var tagRegexp = new RegExp();
		tagRegexp.compile("/chameleon\?.*function=CARDSCR");
		
		var items = new Array();
		
		var tableRows = doc.evaluate(''//tr[@class="intrRow"]'', doc, nsResolver,
		                             XPathResult.ANY_TYPE, null);
		var tableRow;
		// Go through table rows
		while(tableRow = tableRows.iterateNext()) {
			var links = tableRow.getElementsByTagName("a");
			// Go through links
			var url;
			for(var j=0; j<links.length; j++) {
				if(tagRegexp.test(links[j].href)) {
					url = links[j].href;
					break;
				}
			}
			if(url) {
				// Collect title information
				var fields = doc.evaluate(''./td/table/tbody/tr[th]'', tableRow,
				                          nsResolver, XPathResult.ANY_TYPE, null);
				var field;
				while(field = fields.iterateNext()) {
					var header = doc.evaluate(''./th/text()'', field, nsResolver,
					                          XPathResult.ANY_TYPE, null).iterateNext();
					if(header.nodeValue == "Title") {
						var value = doc.evaluate(''./td'', field, nsResolver,
					    	XPathResult.ANY_TYPE, null).iterateNext();
						if(value) {
							items[url] = Zotero.Utilities.cleanString(value.textContent);
						}
					}
				}
			}
		}
		
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			Zotero.debug(i.replace(/function=[A-Z]{7}/, "function=MARCSCR"));
			newUris.push(i.replace(/function=[A-Z]{7}/, "function=MARCSCR"));
		}
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	
	Zotero.Utilities.processDocuments(newUris, function(newDoc) {
		var uri = newDoc.location.href
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var record = new marc.record();
		
		var xpath = ''//table[@class="outertable"]/tbody/tr[td[4]]'';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null);
		
		while(elmt = elmts.iterateNext()) {
			var field = doc.evaluate(''./TD[1]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			var ind1 = doc.evaluate(''./TD[2]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			var ind2 = doc.evaluate(''./TD[3]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			var value = doc.evaluate(''./TD[4]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			value = value.replace(/\\([a-z]) /g, marc.subfieldDelimiter+"$1");
			
			record.addField(field, ind1+ind2, value);
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";
		
		newItem.complete();
	}, function(){ Zotero.done(); }, null);
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('fb12ae9e-f473-cab4-0546-27ab88c64101', '1.0.0b3.r1', '', '2006-12-15 15:11:00', 1, 100, 4, 'Library Catalog (DRA)', 'Simon Kornblith', '/web2/tramp2\.exe/(?:see\_record/|authority\_hits/|goto/.*\?.*screen=Record\.html)',
'function detectWeb(doc, url) {
	if(doc.location.href.indexOf("/authority_hits") > 0) {
		return "multiple";
	} else {
		return "book";
	}
}',
'function doWeb(doc, url) {
	var checkItems = false;
	
	if(doc.location.href.indexOf("/authority_hits") > 0) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		checkItems = Zotero.Utilities.gatherElementsOnXPath(doc, doc, "/html/body//ol/li", nsResolver);
	}
	
	if(checkItems && checkItems.length) {
		var items = Zotero.Utilities.getItemArray(doc, checkItems, ''https?://.*/web2/tramp2\.exe/see_record'');
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			uris.push(i);
		}
	} else {
		var ug = new Array(doc.location.href);
	}
	
	for(var i in uris) {
		var uri = uris[i];
		var uriRegexp = /^(https?:\/\/.*\/web2\/tramp2\.exe\/)(?:goto|see\_record|authority\_hits)(\/.*)\?(?:screen=Record\.html\&)?(.*)$/i;
		var m = uriRegexp.exec(uri);
		if(uri.indexOf("/authority_hits") < 0) {
			var newUri = m[1]+"download_record"+m[2]+"/RECORD.MRC?format=marc&"+m[3];
		} else {
			var newUri = m[1]+"download_record"+m[2]+"/RECORD.MRC?format=marc";
		}
		
		// Keep track of how many requests have been completed
		var j = 0;
		
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		marc.setHandler("itemDone", function(obj, item) {
			item.repository = domain[1]+" Library Catalog";
			item.complete();
		});
		
		Zotero.Utilities.HTTP.doGet(newUri, function(text) {
			translator.setString(text);
			translator.translate();
			
			j++;
			if(j == uris.length) {
				Zotero.done();
			}
		});
	}
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('c0e6fda6-0ecd-e4f4-39ca-37a4de436e15', '1.0.0b3.r1', '', '2006-12-15 15:11:00', 1, 100, 4, 'Library Catalog (GEAC)', 'Simon Kornblith', '/(?:GeacQUERY|GeacFETCH[\:\?].*[&:]next=html/(?:record\.html|geacnffull\.html))',
'function detectWeb(doc, url) {
	if(doc.location.href.indexOf("/GeacQUERY") > 0) {
		return "multiple";
	} else {
		return "book";
	}
}',
'function doWeb(doc, url) {
	var uri = doc.location.href;
	
	var uris = new Array();
	
	if(uri.indexOf("/GeacQUERY") > 0) {
		var items = Zotero.Utilities.getItemArray(doc, doc, "(?:Geac)?FETCH[\:\?].*[&:]next=html/(?:record\.html|geacnffull\.html)");
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			var newUri = i.replace(/([:&])next=html\/geacnffull.html/, "$1next=html/marc.html");
			newUri = newUri.replace(/([:&])next=html\/record.html/, "$1next=html/marc.html");
			uris.push(newUri);
		}
	} else {
		var newUri = uri.replace(/([:&])next=html\/geacnffull.html/, "$1next=html/marc.html");
		newUri = newUri.replace(/([:&])next=html\/record.html/, "$1next=html/marc.html");
		uris.push(newUri);
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	
	Zotero.Utilities.processDocuments(uris, function(newDoc) {
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var record = new marc.record();
		
		var elmts = newDoc.evaluate(''//pre/text()'', newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null);
		var elmt, tag, content;
		var ind = "";
		
		while(elmt = elmts.iterateNext()) {
			var line = elmt.nodeValue;
			
			if(line.substring(0, 6) == "       ") {
				content += " "+line.substring(6);
				continue;
			} else {
				if(tag) {
					record.addField(tag, ind, content);
				}
			}
			
			line = line.replace(/[_\t\xA0]/g," "); // nbsp
			
			tag = line.substr(0, 3);
			if(tag[0] != "0" || tag[1] != "0") {
				ind = line.substr(4, 2);
				content = line.substr(7).replace(/\$([a-z])(?: |$)/g, marc.subfieldDelimiter+"$1");
			} else {
				if(tag == "000") {
					tag = undefined;
					record.leader = "00000"+line.substr(4);
				} else {
					content = line.substr(4);
				}
			}
			
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";
		
		newItem.complete();
	}, function() { Zotero.done(); }, null);
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('0f9fc2fc-306e-5204-1117-25bca009dffc', '1.0.0b3.r1', '', '2006-12-15 15:11:00', 1, 100, 4, 'Library Catalog (TLC/YouSeeMore)', 'Simon Kornblith', 'TLCScripts/interpac\.dll\?(?:.*LabelDisplay.*RecordNumber=[0-9]|Search|ItemTitles)',
'function detectWeb(doc, url) {
	var detailRe = new RegExp("TLCScripts/interpac\.dll\?.*LabelDisplay.*RecordNumber=[0-9]");
	if(detailRe.test(doc.location.href)) {
		return "book";
	} else {
		return "multiple";
	}
}',
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var detailRe = new RegExp("TLCScripts/interpac\.dll\?.*LabelDisplay.*RecordNumber=[0-9]");
	var uri = doc.location.href;
	var newUris = new Array();
	
	if(detailRe.test(uri)) {
		newUris.push(uri.replace("LabelDisplay", "MARCDisplay"));
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, ''TLCScripts/interpac\.dll\?.*LabelDisplay.*RecordNumber=[0-9]'');
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			newUris.push(i.replace("LabelDisplay", "MARCDisplay"));
		}
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	
	Zotero.Utilities.processDocuments(newUris, function(newDoc) {
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var record = new marc.record();
		
		var elmts = newDoc.evaluate(''/html/body/table/tbody/tr[td[4]]'', newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null);
		var tag, ind, content, elmt;
		
		while(elmt = elmts.iterateNext()) {
			tag = newDoc.evaluate(''./td[2]/tt[1]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			var inds = newDoc.evaluate(''./td[3]/tt[1]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			
			tag = tag.replace(/[\r\n]/g, "");
			inds = inds.replace(/[\r\n\xA0]/g, "");
			
			var children = newDoc.evaluate(''./td[4]/tt[1]//text()'', elmt, nsResolver,
			                               XPathResult.ANY_TYPE, null);
			var subfield = children.iterateNext();
			var fieldContent = children.iterateNext();
			
			if(tag == "LDR") {
				record.leader = "00000"+subfield.nodeValue;
			} else {
				content = "";
				if(!fieldContent) {
					content = subfield.nodeValue;
				} else {
					while(subfield && fieldContent) {
						content += marc.subfieldDelimiter+subfield.nodeValue.substr(1, 1)+fieldContent.nodeValue;
						var subfield = children.iterateNext();
						var fieldContent = children.iterateNext();
					}
				}
				
				record.addField(tag, inds, content);
			}
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";
		
		newItem.complete();
	}, function() {Zotero.done(); }, null);
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('c54d1932-73ce-dfd4-a943-109380e06574', '1.0.0b4.r1', '', '2008-03-25 00:50:00', '1', '100', '4', 'Project MUSE', 'Simon Kornblith', 'https?://[^/]*muse\.jhu\.edu[^/]*/(?:journals/[^/]+/[^/]+/[^/]+\.html|search/results)', 
'function detectWeb(doc, url) {
	var searchRe = new RegExp("^https?://[^/]+/search/results");
	if(searchRe.test(url)) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var searchRe = new RegExp("^https?://[^/]+/search/results");
	if(searchRe.test(doc.location.href)) {
		var items = new Array();
		var attachments = new Array();
		var pdfRe = /\.pdf$/i;
		var htmlRe = /\.html$/i;
		
		var tableRows = doc.evaluate(''/html/body/table[@class="navbar"]/tbody/tr/td//form/table'',
		                             doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		// Go through table rows
		while(tableRow = tableRows.iterateNext()) {
			// aid (article id) is what we need to get it all as one file
			var input = doc.evaluate(''./tbody/tr/td/input[@name="aid"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			var title = doc.evaluate(''.//b/i/text()'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(input && input.value && title && title.nodeValue) {
				items[input.value] = title.nodeValue;
				
				var aTags = tableRow.getElementsByTagName("a");
				
				// get attachments
				attachments[input.value] = new Array();
				for(var i=0; i<aTags.length; i++) {
					if(pdfRe.test(aTags[i].href)) {
						attachments[input.value].push({url:aTags[i].href,
													  title:"Project MUSE Full Text PDF",
													  mimeType:"application/pdf"});
					} else if(htmlRe.test(aTags[i].href)) {
						attachments[input.value].push({url:aTags[i].href,
													  title:"Project MUSE Snapshot",
													  mimeType:"text/html"});
					}
				}
			}
		}
		
		items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		
		var articleString = "";
		var newAttachments = new Array();
		for(var i in items) {
			articleString += "&aid="+i;
			newAttachments.push(attachments[i]);
		}
		
		Zotero.Utilities.HTTP.doGet("http://muse.jhu.edu/search/export.cgi?exporttype=endnote"+articleString, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				if(item.notes && item.notes[0]) {
					item.extra = item.notes[0].note;						
					delete item.notes;
					item.notes = undefined;
				}
				item.attachments = newAttachments.shift();
				item.complete();
			});
			translator.translate();
			Zotero.done();
		}, function() {});
		
		Zotero.wait();
	} else {
		var hostRe = new RegExp("^(http://[^/]+)/");
		var m = hostRe.exec(url);
		var host = m[1];

		var getPDF = doc.evaluate(''//a[text() = "[Access article in PDF]"]'', doc,
		                          nsResolver, XPathResult.ANY_TYPE, null).iterateNext();		
		
		var newUrl = url.replace(host, host+"/metadata/zotero");
		Zotero.Utilities.HTTP.doGet(newUrl, function(text) {
			var translator = Zotero.loadTranslator("import");
			//set RIS translator
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				if(item.notes && item.notes[0]) {
					item.extra = item.notes[0].note;						
					delete item.notes;
					item.notes = undefined;
				}
				item.attachments.splice(0);
				item.attachments.push({document:doc, title:"Project MUSE Snapshot"});
				if(getPDF) {
					item.attachments.push({title:"Project MUSE Full Text PDF", mimeType:"application/pdf",
					url:getPDF.href});
				}
				
				item.complete();
			});
			translator.translate();
		});
	}
}');

REPLACE INTO translators VALUES ('fcf41bed-0cbc-3704-85c7-8062a0068a7a', '1.0.0b3.r1', '', '2008-03-14 18:00:00', '1', '100', '4', 'NCBI PubMed', 'Simon Kornblith and Michael Berkowitz', 'http://[^/]*www\.ncbi\.nlm\.nih\.gov[^/]*/(pubmed|sites/entrez|entrez/query\.fcgi\?.*db=PubMed)', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var uids = doc.evaluate(''//input[@id="UidCheckBox" or @name="uid"]'', doc,
			       nsResolver, XPathResult.ANY_TYPE, null);
	if(uids.iterateNext() && doc.title.indexOf("PMC Results") == -1) {
		if (uids.iterateNext() && doc.title.indexOf("PMC Results") == -1){
			return "multiple";
		}
		return "journalArticle";
	}
}
function getPMID(co) {
	var coParts = co.split("&");
	for each(part in coParts) {
		if(part.substr(0, 7) == "rft_id=") {
			var value = unescape(part.substr(7));
			if(value.substr(0, 10) == "info:pmid/") {
				return value.substr(10);
			}
		}
	}
}

function detectSearch(item) {
	if(item.contextObject) {
		if(getPMID(item.contextObject)) {
			return "journalArticle";
		}
	}
	return false;
}
', 
'function lookupPMIDs(ids, doc) {
	Zotero.wait();

	var newUri = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=PubMed&retmode=xml&rettype=citation&id="+ids.join(",");
	Zotero.Utilities.HTTP.doGet(newUri, function(text) {
		// Remove xml parse instruction and doctype
		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");

		var xml = new XML(text);

		for(var i=0; i<xml.PubmedArticle.length(); i++) {
			var newItem = new Zotero.Item("journalArticle");

			var citation = xml.PubmedArticle[i].MedlineCitation;

			var PMID = citation.PMID.text().toString();
//			newItem.accessionNumber = "PMID "+PMID;
			newItem.extra = "PMID: "+PMID;
			// add attachments
			if(doc) {
				newItem.attachments.push({document:doc, title:"PubMed Snapshot"});
			} else {
				var url = "http://www.ncbi.nlm.nih.gov/entrez/query.fcgi?db=pubmed&cmd=Retrieve&dopt=AbstractPlus&list_uids="+PMID;
				newItem.attachments.push({url:url, title:"PubMed Snapshot",
							 mimeType:"text/html"});
			}

			var article = citation.Article;
			if(article.ArticleTitle.length()) {
				var title = article.ArticleTitle.text().toString();
				if(title.substr(-1) == ".") {
					title = title.substring(0, title.length-1);
				}
				newItem.title = title;
			}

			if (article.Pagination.MedlinePgn.length()){
				newItem.pages = article.Pagination.MedlinePgn.text().toString();
			}

			if(article.Journal.length()) {
				var issn = article.Journal.ISSN.text().toString();
				if(issn) {
					newItem.ISSN = issn.replace(/[^0-9]/g, "");
				}

				newItem.journalAbbreviation = Zotero.Utilities.superCleanString(citation.MedlineJournalInfo.MedlineTA.text().toString());
				if(article.Journal.Title.length()) {
					newItem.publicationTitle = Zotero.Utilities.superCleanString(article.Journal.Title.text().toString());
				} else if(citation.MedlineJournalInfo.MedlineTA.length()) {
					newItem.publicationTitle = newItem.journalAbbreviation;
				}

				if(article.Journal.JournalIssue.length()) {
					newItem.volume = article.Journal.JournalIssue.Volume.text().toString();
					newItem.issue = article.Journal.JournalIssue.Issue.text().toString();
					if(article.Journal.JournalIssue.PubDate.length()) {	// try to get the date
						if(article.Journal.JournalIssue.PubDate.Day.text().toString() != "") {
							newItem.date = article.Journal.JournalIssue.PubDate.Month.text().toString()+" "+article.Journal.JournalIssue.PubDate.Day.text().toString()+", "+article.Journal.JournalIssue.PubDate.Year.text().toString();
						} else if(article.Journal.JournalIssue.PubDate.Month.text().toString() != "") {
							newItem.date = article.Journal.JournalIssue.PubDate.Month.text().toString()+" "+article.Journal.JournalIssue.PubDate.Year.text().toString();
						} else if(article.Journal.JournalIssue.PubDate.Year.text().toString() != "") {
							newItem.date = article.Journal.JournalIssue.PubDate.Year.text().toString();
						}
					}
				}
			}

			if(article.AuthorList.length() && article.AuthorList.Author.length()) {
				var authors = article.AuthorList.Author;
				for(var j=0; j<authors.length(); j++) {
					var lastName = authors[j].LastName.text().toString();
					var firstName = authors[j].FirstName.text().toString();
					if(firstName == "") {
						var firstName = authors[j].ForeName.text().toString();
					}
					if(firstName || lastName) {
						newItem.creators.push({lastName:lastName, firstName:firstName});
					}
				}
			}
			
			
			if (citation.MeshHeadingList && citation.MeshHeadingList.MeshHeading) {
				var keywords = citation.MeshHeadingList.MeshHeading;
				for (var k = 0 ; k < keywords.length() ; k++) {
					newItem.tags.push(keywords[k].DescriptorName.text().toString());
				}
			}
			newItem.abstractNote = article.Abstract.AbstractText.toString()
			
			newItem.complete();
		}

		Zotero.done();
	});
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
		} : null;
	var ids = new Array();
	var uids = doc.evaluate(''//input[@id="UidCheckBox" or @name="uid"]'', doc, //edited for new PubMed
			       nsResolver, XPathResult.ANY_TYPE, null);
	var uid = uids.iterateNext();
	if(uid) {
		if (uids.iterateNext()){
			var items = new Array();
			var tablex = ''//div[@class="rprt"]'';
			if (!doc.evaluate(tablex, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				var tablex = ''//div[@class="ResultSet"]/dl'';
				var other = true;
			}
			var tableRows = doc.evaluate(tablex, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var tableRow;
			// Go through table rows
			while(tableRow = tableRows.iterateNext()) {
				uid = doc.evaluate(''.//input[@id="UidCheckBox"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if (other) {
					var article = doc.evaluate(''.//h2'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				} else {
					var article = doc.evaluate(''.//div[@class="title"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				}
				items[uid.value] = article.textContent;
			}

			items = Zotero.selectItems(items);

			if(!items) {
				return true;
			}

			for(var i in items) {
				ids.push(i);
			}

			lookupPMIDs(ids);
		} else {
			ids.push(uid.value);
			lookupPMIDs(ids, doc);
		}
	}
}

function doSearch(item) {
	// pmid was defined earlier in detectSearch
	lookupPMIDs([getPMID(item.contextObject)]);
}');

REPLACE INTO translators VALUES ('951c027d-74ac-47d4-a107-9c3069ab7b48', '1.0.0b3.r1', '', '2008-03-14 18:00:00', '1', '400', '4', 'Embedded RDF', 'Simon Kornblith', '', 
'function detectWeb(doc, url) {
	if (url.indexOf("reprint") != -1) return false;
	var metaTags = doc.getElementsByTagName("meta");
	for(var i=0; i<metaTags.length; i++) {
		var tag = metaTags[i].getAttribute("name");
		if(tag && tag.substr(0, 3).toLowerCase() == "dc.") {
			return "webpage";
		}
	}
	
	return false;
}', 
'function doWeb(doc, url) {
	var dc = "http://purl.org/dc/elements/1.1/";

	// load RDF translator, so that we don''t need to replicate import code
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("5e3ad958-ac79-463d-812b-a86a9235c28f");
	translator.setHandler("itemDone", function(obj, newItem) {
		// use document title if none given in dublin core
		if(!newItem.title) {
			newItem.title = doc.title;
		}
		// add attachment
		newItem.attachments.push({document:doc});
		// add url
		newItem.url = doc.location.href;
		newItem.repository = false;
		newItem.complete();
	});
	var rdf = translator.getTranslatorObject();
	
	var metaTags = doc.getElementsByTagName("meta");
	var foundTitle = false;		// We can use the page title if necessary
	for(var i=0; i<metaTags.length; i++) {
		var tag = metaTags[i].getAttribute("name");
		var value = metaTags[i].getAttribute("content");
		if(tag && value && tag.substr(0, 3).toLowerCase() == "dc.") {
			if(tag == "dc.title") {
				foundTitle = true;
			}
			rdf.Zotero.RDF.addStatement(url, dc + tag.substr(3).toLowerCase(), value, true);
		} else if(tag && value && (tag == "author" || tag == "author-personal")) {
			rdf.Zotero.RDF.addStatement(url, dc + "creator", value, true);
		} else if(tag && value && tag == "author-corporate") {
			rdf.Zotero.RDF.addStatement(url, dc + "creator", value, true);
		}
	}
	
	rdf.defaultUnknownType = "webpage";
	rdf.doImport();
}');

REPLACE INTO translators VALUES ('05d07af9-105a-4572-99f6-a8e231c0daef', '1.0.0b3.r1', '', '2007-09-15 20:08:46', 1, 300, 4, 'COinS', 'Simon Kornblith', NULL,
'function detectWeb(doc, url) {
	var spanTags = doc.getElementsByTagName("span");
	
	var encounteredType = false;
	
	for(var i=0; i<spanTags.length; i++) {
		var spanClass = spanTags[i].getAttribute("class");
		if(spanClass) {
			var spanClasses = spanClass.split(" ");
			if(Zotero.Utilities.inArray("Z3988", spanClasses)) {
				var spanTitle = spanTags[i].getAttribute("title");
				
				// determine if it''s a valid type
				var item = new Zotero.Item;
				var success = Zotero.Utilities.parseContextObject(spanTitle, item);
				
				if(item.itemType) {
					if(encounteredType) {
						return "multiple";
					} else {
						encounteredType = item.itemType;
					}
				}
			}
		}
	}
	
	return encounteredType;
}',
'// used to retrieve next COinS object when asynchronously parsing COinS objects
// on a page
function retrieveNextCOinS(needFullItems, newItems, couldUseFullItems, doc) {
	if(needFullItems.length) {
		var item = needFullItems.shift();
		
		Zotero.debug("looking up contextObject");
		var search = Zotero.loadTranslator("search");
		search.setHandler("itemDone", function(obj, item) {
			newItems.push(item);
		});
		search.setHandler("done", function() {
			retrieveNextCOinS(needFullItems, newItems, couldUseFullItems, doc);
		});
		search.setSearch(item);
		
		// look for translators
		var translators = search.getTranslators();
		if(translators.length) {
			search.setTranslator(translators);
			search.translate();
		} else {
			retrieveNextCOinS(needFullItems, newItems, couldUseFullItems, doc);
		}
	} else {
		completeCOinS(newItems, couldUseFullItems, doc);
		Zotero.done();
	}
}

// saves all COinS objects
function completeCOinS(newItems, couldUseFullItems, doc) {
	if(newItems.length > 1) {
		var selectArray = new Array();
		
		for(var i in newItems) {
			selectArray[i] = newItems[i].title;
		}
		selectArray = Zotero.selectItems(selectArray);
		
		var useIndices = new Array();
		for(var i in selectArray) {
			useIndices.push(i);
		}
		completeItems(newItems, useIndices, couldUseFullItems);
	} else if(newItems.length) {
		completeItems(newItems, [0], couldUseFullItems);
	}
}

function completeItems(newItems, useIndices, couldUseFullItems, doc) {
	if(!useIndices.length) {
		return;
	}
	var i = useIndices.shift();
	
	// grab full item if the COinS was missing an author
	if(couldUseFullItems[i]) {
		Zotero.debug("looking up contextObject");
		var search = Zotero.loadTranslator("search");
		
		var firstItem = false;
		search.setHandler("itemDone", function(obj, newItem) {
			if(!firstItem) {
				// add doc as attachment
				newItem.attachments.push({document:doc});
				newItem.complete();
				firstItem = true;
			}
		});
		search.setHandler("done", function(obj) {
			// if we didn''t find anything, use what we had before (even if it
			// lacks the creator)
			if(!firstItem) {
				newItems[i].complete();
			}
			// call next
			completeItems(newItems, useIndices, couldUseFullItems);
		});
		
		search.setSearch(newItems[i]);			
		var translators = search.getTranslators();
		if(translators.length) {
			search.setTranslator(translators);
			search.translate();
		} else {
			// add doc as attachment
			newItems[i].attachments.push({document:doc});
			newItems[i].complete();
			// call next
			completeItems(newItems, useIndices, couldUseFullItems);
		}
	} else {
		// add doc as attachment
		newItems[i].attachments.push({document:doc});
		newItems[i].complete();
		// call next
		completeItems(newItems, useIndices, couldUseFullItems);
	}
}

function doWeb(doc, url) {
	var newItems = new Array();
	var needFullItems = new Array();
	var couldUseFullItems = new Array();
	
	var spanTags = doc.getElementsByTagName("span");
	
	for(var i=0; i<spanTags.length; i++) {
		var spanClass = spanTags[i].getAttribute("class");
		if(spanClass) {
			var spanClasses = spanClass.split(" ");
			if(Zotero.Utilities.inArray("Z3988", spanClasses)) {
				var spanTitle = spanTags[i].getAttribute("title");
				var newItem = new Zotero.Item();
				newItem.repository = false;	// do not save repository
				if(Zotero.Utilities.parseContextObject(spanTitle, newItem)) {
					if(newItem.title) {
						if(!newItem.creators.length) {
							// if we have a title but little other identifying
							// information, say we''ll get full item later
							newItem.contextObject = spanTitle;
							couldUseFullItems[newItems.length] = true;
						}
						
						// title and creators are minimum data to avoid looking up
						newItems.push(newItem);
					} else {
						// retrieve full item
						newItem.contextObject = spanTitle;
						needFullItems.push(newItem);
					}
				}
			}
		}
	}
	
	Zotero.debug(needFullItems);
	if(needFullItems.length) {
		// retrieve full items asynchronously
		Zotero.wait();
		retrieveNextCOinS(needFullItems, newItems, couldUseFullItems, doc);
	} else {
		completeCOinS(newItems, couldUseFullItems, doc);
	}
}');

REPLACE INTO translators VALUES ('e7e01cac-1e37-4da6-b078-a0e8343b0e98', '1.0.0b4.r1', '', '2007-08-04 23:15:00', '1', '200', '4', 'unAPI', 'Simon Kornblith', '', 
'var RECOGNIZABLE_FORMATS = ["mods", "marc", "endnote", "ris", "bibtex", "rdf"];
var FORMAT_GUIDS = {
	"mods":"0e2235e7-babf-413c-9acf-f27cce5f059c",
	"marc":"a6ee60df-1ddc-4aae-bb25-45e0537be973",
	"endnote":"881f60f2-0802-411a-9228-ce5f47b64c7d",
	"ris":"32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7",
	"bibtex":"9cb70025-a888-4a29-a210-93ec52da40d4",
	"rdf":"5e3ad958-ac79-463d-812b-a86a9235c28f"
};

var unAPIResolver, unsearchedIds, foundIds, foundItems, foundFormat, foundFormatName;

function detectWeb(doc, url) {
	// initialize variables
	unsearchedIds = [];
	foundIds = [];
	foundItems = [];
	foundFormat = [];
	foundFormatName = [];
	
	var nsResolver = doc.createNSResolver(doc.documentElement);
	
	// look for a resolver
	unAPIResolver = doc.evaluate(''//link[@rel="unapi-server"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(!unAPIResolver) return false;
	unAPIResolver = unAPIResolver.getAttribute("href");
	
	// look for abbrs
	var abbrs = doc.getElementsByTagName("abbr");
	for each(var abbr in abbrs) {
		if(abbr.getAttribute && abbr.getAttribute("class") &&
		   abbr.getAttribute("class").split(" ").indexOf("unapi-id") != -1 && abbr.getAttribute("title")) {
			// found an abbr
			unsearchedIds.push(escape(abbr.getAttribute("title")));
		}
	}
	
	if(!unsearchedIds.length) return false;
	
	// now we need to see if the server actually gives us bibliographic metadata.
	
	// one way to signal this is with a META tag
	var zoteroMeta = doc.evaluate(''//meta[@name="ZoteroItemType"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(zoteroMeta) return zoteroMeta.getAttribute("content");
	
	// otherwise, things will be a bit more complicated, and we''ll have to do some HTTP requests
	Zotero.wait();
	
	if(unsearchedIds.length == 1) {
		// if there''s only one abbr tag, we should go ahead and retrieve types for it
		getItemType();
	} else {
		// if there''s more than one, we should first see if the resolver gives metadata for all of them
		Zotero.Utilities.HTTP.doGet(unAPIResolver, function(text) {
			var format = checkFormats(text);
			if(format) {
				// move unsearchedIds to foundIds
				foundIds = unsearchedIds;
				unsearchedIds = [];
				// save format and formatName
				foundFormat = format[0];
				foundFormatName = format[1];
				
				Zotero.done("multiple");
			} else {
				getItemType();
			}
		});
	}
}

function getItemType() {
	// if there are no items left to search, use the only item''s type (if there is one) or give up
	if(!unsearchedIds.length) {
		if(foundIds.length) {
			getOnlyItem();
		} else {
			Zotero.done(false);
		}
		return;
	}
	
	var id = unsearchedIds.shift();
	Zotero.Utilities.HTTP.doGet(unAPIResolver+"?id="+id, function(text) {
		var format = checkFormats(text);
		if(format) {
			// save data
			foundIds.push(id);
			foundFormat.push(format[0]);
			foundFormatName.push(format[1]);
			
			if(foundIds.length == 2) {
				// this is our second; use multiple
				Zotero.done("multiple");
				return;
			}
		}
		
		// keep going
		getItemType();
	});
}

function checkFormats(text) {
	text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");
	var xml = new XML(text);
	
	var foundFormat = new Object();
	
	// this is such an ugly, disgusting hack, and I hate how Mozilla decided to neuter an ECMA standard
	for each(var format in xml.format) {
		var name = format.@name.toString();
		var lowerName = name.toLowerCase();
		
		if(format.@namespace_uri == "http://www.loc.gov/mods/v3" || lowerName == "mods" || format.@docs == "http://www.loc.gov/standards/mods/") {
			if(!foundFormat["mods"] || lowerName.indexOf("full") != -1) {
				foundFormat["mods"] = escape(name);
			}
		} else if(lowerName.match(/^marc\b/)) {
			if(!foundFormat["marc"] || lowerName.indexOf("utf8") != -1) {
				foundFormat["marc"] = escape(name);
			}
		} else if(lowerName == "rdf_dc") {
			foundFormat["rdf"] = escape(name);
		} else if(format.@docs.text() == "http://www.refman.com/support/risformat_intro.asp" || lowerName.match(/^ris\b/)) {
			if(!foundFormat["ris"] || lowerName.indexOf("utf8") != -1) {
				foundFormat["ris"] = escape(name);
			}
		} else if(lowerName == "bibtex") {
			foundFormat["bibtex"] = escape(name);
		} else if(lowerName == "endnote") {
			foundFormat["endnote"] = escape(name);
		}
	}
	
	// loop through again, this time respecting preferences
	for each(var format in RECOGNIZABLE_FORMATS) {
		if(foundFormat[format]) return [format, foundFormat[format]];
	}
	
	return false;
}

function getOnlyItem() {
	// retrieve the only item
	retrieveItem(foundIds[0], foundFormat[0], foundFormatName[0], function(obj, item) {
		foundItems.push(item);
		Zotero.done(item.itemType);
	});
}

function retrieveItem(id, format, formatName, callback) {
	// retrieve URL
	Zotero.Utilities.HTTP.doGet(unAPIResolver+"?id="+id+"&format="+formatName, function(text) {
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator(FORMAT_GUIDS[format]);
		translator.setString(text);
		translator.setHandler("itemDone", callback);
		translator.translate();
	});
}', 
'/**
 * Get formats and names for all usable ids; when done, get all items
 **/
function getAllIds() {
	if(!unsearchedIds.length) {
		// once all ids have been gotten, get all items
		getAllItems();
		return;
	}
	
	var id = unsearchedIds.shift();
	Zotero.Utilities.HTTP.doGet(unAPIResolver+"?id="+id, function(text) {
		var format = checkFormats(text);
		if(format) {
			// save data
			foundIds.push(id);
			foundFormat.push(format[0]);
			foundFormatName.push(format[1]);
		}
		
		// keep going
		getAllIds();
	});
}

/**
 * Get all items; when done, show selectItems or scrape
 **/
function getAllItems() {
	if(foundItems.length == foundIds.length) {
		if(foundItems.length == 1) {
			// if only one item, send complete()
			foundItems[0].complete();
		} else if(foundItems.length > 0) {
			// if multiple items, show selectItems
			var itemTitles = [];
			for(var i in foundItems) {
				itemTitles[i] = foundItems[i].title;
			}
			
			var chosenItems = Zotero.selectItems(itemTitles);
			if(!chosenItems) Zotero.done(true);
			
			for(var i in chosenItems) {
				foundItems[i].complete();
			}
		}
		
		// reset items
		foundItems = [];
		
		Zotero.done();
		return;
	}
	
	var id = foundIds[foundItems.length];
	// foundFormat can be either a string or an array
	if(typeof(foundFormat) == "string") {
		var format = foundFormat;
		var formatName = foundFormatName;
	} else {
		var format = foundFormat[foundItems.length];
		var formatName = foundFormatName[foundItems.length];
	}
	
	// get item
	retrieveItem(id, format, formatName, function(obj, item) {
		foundItems.push(item);
		getAllItems();
	});
}

function doWeb() {
	Zotero.wait();
	
	// retrieve data for all ids
	getAllIds();
}');

REPLACE INTO translators VALUES ('a326fc49-60c2-405b-8f44-607e5d18b9ad', '1.0.0b4.r5', '', '2008-01-25 20:00:00', '0', '100', '4', 'Code4Lib Journal', 'Michael Berkowitz', 'http://journal.code4lib.org/', 
'function detectWeb(doc, url) {
	if (doc.evaluate(''//h2[@class="articletitle"]/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate(''//h1[@class="articletitle"]/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var items = new Object();
	var articles = new Array();
	var xpath = ''//div[@class="article"]/h2[@class="articletitle"]/a'';
	if (detectWeb(doc, url) == "multiple") {
		var xpath = ''//div[@class="article"]/h2[@class="articletitle"]/a'';
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_title = titles.iterateNext();
		while (next_title) {
			items[next_title.href] = next_title.textContent;
			next_title = titles.iterateNext();
		}
		
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles.push(url);
	}
	
	Zotero.Utilities.processDocuments(articles, function(newDoc, url) {
		var newItem = new Zotero.Item("journalArticle");
		newItem.repository = "Code4Lib Journal";
		newItem.publicationTitle = "The Code4Lib Journal";
		newItem.ISSN = "1940-5758";
		newItem.url = newDoc.location.href;
		newItem.title = newDoc.evaluate(''//div[@class="article"]/h1[@class="articletitle"]/a'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		newItem.abstractNote = newDoc.evaluate(''//div[@class="article"]/div[@class="abstract"]/p'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		var issdate = newDoc.evaluate(''//p[@id="issueDesignation"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		newItem.issue = issdate.match(/([^,]*)/)[0].match(/\d+/)[0];
		newItem.date = issdate.match(/,\s+(.*)$/)[1];
		
		
		var axpath = ''//div[@class="article"]/div[@class="entry"]/p[1]/a'';
		var authors = newDoc.evaluate(axpath, newDoc, null, XPathResult.ANY_TYPE, null);
		var next_author = authors.iterateNext();
		while (next_author) {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(next_author.textContent, "author"));
			next_author = authors.iterateNext();
		}
		
		newItem.attachments.push({url:newDoc.location.href, title:"Code4Lib Journal Snapshot", mimeType:"text/html"});
		newItem.complete();
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('37445f52-64fa-4a2a-9532-35753520a0f0', '1.0.0b4.r5', '', '2008-01-16 06:30:00', '0', '100', '4', 'HeinOnline', 'Michael Berkowitz', 'http://heinonline\.org/HOL/', 
'function detectWeb(doc, url) {
	if (url.indexOf("LuceneSearch") != -1) {
		return "multiple";
	} else if (url.indexOf("handle=hein.journals")) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	
	var handle = url.match(/handle=([^&]*)&/)[1];
	if (url.match(/&id=(\d+)/)) {
		var id= url.match(/&id=(\d+)/)[1];
	} else if (url.match(/&div=(\d+)/)) {
		var ids = new Array();
		var id = doc.evaluate(''//option[@selected="selected"]/@value'', doc, null, XPathResult.ANY_TYPE, null);
		var next_id = id.iterateNext();
		while (next_id) {
			ids.push(next_id.textContent);
			next_id = id.iterateNext();
		}
		id = ids[ids.length - 1];
	}
	
	var citationurl = ''http://heinonline.org/HOL/citation-info?handle='' + handle + ''&id='' + id;
	var xpath = ''//div[@id="guide"]/ul/li[3]/a'';
	var journal = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/([^\d]*)/)[1];
	
	var newItem = new Zotero.Item("journalArticle");
	newItem.publicationTitle = Zotero.Utilities.trimInternal(journal);
	newItem.repository = "HeinOnline";
	newItem.url = url;
	
	Zotero.Utilities.HTTP.doGet(citationurl, function(text) {
		var stuff = text.match(/(\d+)\s+([^\d]+)\s+(\d+)\s+\(([-\d]+)\)\s+<br>\s+([^;]+)(;\s*(.*))?/);
		newItem.volume = stuff[1];
		newItem.journalAbbreviation = stuff[2];
		newItem.pages = stuff[3];
		newItem.date = stuff[4];
		newItem.title = Zotero.Utilities.trimInternal(stuff[5]);
		
		if (stuff[7]) {
			var authors = stuff[7].split('';'');
			for (var i in authors) {
				authors[i] = authors[i].split('','');
				newItem.creators.push({lastName:authors[i][0], firstName:authors[i][1], creatorType:"author"});
			}
		}
		
		var pdfurl = ''http://heinonline.org/HOL/Print?handle='' + handle + ''&id='' + id;
		Zotero.Utilities.HTTP.doGet(pdfurl, function(text) {
			var newurl = text.match(/<a\s+href=\"(PDF[^"]+)\"/i)[1];
			newItem.attachments = [
				{url:url, title:"HeinOnline Snapshot", mimeType:"text/html"},
				{url:''http://heinonline.org/HOL/'' + newurl, title:"HeinOnline PDF", mimeType:"application/pdf"}
			];
			newItem.complete();
		});
	});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('dede653d-d1f8-411e-911c-44a0219bbdad', '1.0.0b4.r1', '', '2007-06-18 18:15:00', '0', '100', '4', 'GPO Access e-CFR', 'Bill McKinney', '^http://ecfr\.gpoaccess\.gov/cgi/t/text/text-idx.+', 
'function detectWeb(doc, url) {
	var re = new RegExp("^http://ecfr\.gpoaccess\.gov/cgi/t/text/text-idx");
	if(re.test(doc.location.href)) {
		return "book";
	} else {
		return "multiple";
	}
}', 
'function get_nextsibling(n)
  {
  var x=n.nextSibling;
  while (x.nodeType!=1)
   {
   x=x.nextSibling;
   }
  return x;
}
function scrape(doc) {

	var newItem = new Zotero.Item("statute");
	newItem.url = doc.location.href;
	var extraText = new String();
	var tmpSection = "";
	newItem.code = "Electronic Code of Federal Regulations";
	newItem.language = "en-us";
	
	var spanTags = doc.getElementsByTagName("span");
	for(var i=0; i<spanTags.length; i++) {
		if (spanTags[i].className == "mainheader") {
			var tmpStr = spanTags[i].innerHTML;
			tmpStr = tmpStr.replace(/\&nbsp;/g, " ");
			tmpStr = tmpStr.replace(/\&\#167;/g, "Sec.");
			newItem.codeNumber = tmpStr;
			newItem.title = "e-CFR: " + tmpStr;
		}
		if (spanTags[i].className == "div5head") {
			var tmpStr = spanTags[i].childNodes[0].innerHTML;
			tmpStr = tmpStr.replace(/\&nbsp;/g, " ");
			tmpStr = tmpStr.replace(/\&\#167;/g, "Sec.");
			tmpSection = tmpStr;
		}
	}

	var heading5Tags = doc.getElementsByTagName("h5");
	for(var i=0; i<heading5Tags.length; i++) {
		var tmpStr = heading5Tags[0].innerHTML;
		tmpStr = tmpStr.replace(/\&nbsp;/g, " ");
		tmpStr = tmpStr.replace(/\&\#167;/g, "Sec.");
		if (tmpSection != "") {
			tmpSection = tmpSection + " - ";
		}
		newItem.section = tmpSection + tmpStr;
		break;
	}

	// statutory source
	var boldTags = doc.getElementsByTagName("b");
	for(var i=0; i<boldTags.length; i++) {
		var s = new String(boldTags[i].innerHTML);
		if (s.indexOf("Source:") > -1) {
			newItem.history = "Source: " + boldTags[i].nextSibling.nodeValue;
		}
		if (s.indexOf("Authority:") > -1) {
			newItem.extra = "Authority: " + boldTags[i].nextSibling.nodeValue;
		}
	}

	newItem.complete();
}

function doWeb(doc, url) {
	var re = new RegExp("http://ecfr\.gpoaccess\.gov/cgi/t/text/text-idx.+");
	if(re.test(doc.location.href)) {
		scrape(doc);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc,"http://ecfr\.gpoaccess\.gov/cgi/t/text/text-idx.+");
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			uris.push(i);
		}
		
		Zotero.Utilities.processDocuments(uris, function(doc) { scrape(doc) },
			function() { Zotero.done(); }, null);
		
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('5ed5ab01-899f-4a3b-a74c-290fb2a1c9a4', '1.0.0b4.r1', '', '2007-06-18 18:15:00', '0', '100', '4', 'AustLII and NZLII', 'Bill McKinney', 'http:\/\/www\.(?:austlii\.edu\.au|nzlii\.org)\/(?:\/cgi-bin\/disp\.pl\/)?(?:au|nz)\/cases\/.+', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var austliiRegexp = /^http:\/\/www\.(?:austlii\.edu\.au|nzlii\.org)\/(?:\/cgi-bin\/disp\.pl\/)?(?:au|nz)\/cases\/.+/
	if(austliiRegexp.test(url)) {
		return "book";
	} else {
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			if(articleRegexp.test(aTags[i].href)) {
				return "multiple";
			}
		}
	}
}
', 
'function scrape(doc) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("case");
	newItem.title = doc.title;
	newItem.url = doc.location.href;

	var titleRegexp = /^(.+)\s+\[(\d+)\]\s+(\w+)\s(\d+)\s+\((\d+)\s+(\w+)\s+(\d+)\)/
	var titleMatch = titleRegexp .exec(doc.title);
	if (titleMatch ) {
		newItem.caseName = titleMatch[1] + " [" + titleMatch[2] + "] " + titleMatch[3] + " " + titleMatch[4];
		newItem.dateDecided = titleMatch[7] + " " + titleMatch[6] + " " + titleMatch[5];
		newItem.court = titleMatch[3];	
	} else {
		newItem.caseName = doc.title;
		newItem.dateDecided = "not found";
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var austliiRegexp = /^http:\/\/www\.(?:austlii\.edu\.au|nzlii\.org)\/(?:\/cgi-bin\/disp\.pl\/)?(?:au|nz)\/cases\/.+/
	if(austliiRegexp.test(url)) {
		scrape(doc);
	} else {
		
		var items = Zotero.Utilities.getItemArray(doc, doc, austliiRegexp);
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('5ae63913-669a-4792-9f45-e089a37de9ab', '1.0.0b4.r1', '', '2007-06-18 18:15:00', '0', '100', '4', 'BAILII', 'Bill McKinney', 'http:\/\/www\.bailii\.org(?:\/cgi\-bin\/markup\.cgi\?doc\=)?\/\w+\/cases\/.+', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var liiRegexp= /^http:\/\/www\.bailii\.org(?:\/cgi\-bin\/markup\.cgi\?doc\=)?\/\w+\/cases\/.+/
	if(liiRegexp.test(url)) {
		return "book";
	} else {
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			if(articleRegexp.test(aTags[i].href)) {
				return "multiple";
			}
		}
	}
}', 
'function scrape(doc) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("case");
	newItem.title = doc.title;
	newItem.url = doc.location.href;

	var titleRegexp = /^(.+)\s+\[(\d+)\]\s+(.+)\s+\((\d+)\s+(\w+)\s+(\d+)\)/
	var titleMatch = titleRegexp .exec(doc.title);
	if (titleMatch ) {
		newItem.caseName = titleMatch[1] + " [" + titleMatch[2] + "] " + titleMatch[3];
		newItem.dateDecided = titleMatch[4] + " " + titleMatch[5] + " " + titleMatch[6];
	} else {
		newItem.caseName = doc.title;
		newItem.dateDecided = "not found";
	}

	var courtRegexp = /cases\/([^\/]+)\/([^\/]+)\//
	var courtMatch = courtRegexp.exec(doc.location.href);
	if (courtMatch) {
		var divRegexp = /\w+/
		var divMatch = divRegexp.exec(courtMatch[2]);
		if (divMatch) {
			newItem.court = courtMatch[1] + " (" + courtMatch[2] + ")";
		} else {
			newItem.court = courtMatch[1];
		}
	} else {
		newItem.court = "not found";
	}
	
	// judge
	var panel = doc.getElementsByTagName("PANEL");
	if (panel.length > 0) {
		var tmp = panel[0].innerHTML;
		newItem.creators.push({lastName:tmp, creatorType:"judge", fieldMode:true});
		
	}
	// citation
	var cite = doc.getElementsByTagName("CITATION");
	if (cite.length > 0) {
		var tmpc = cite[0].childNodes[0].innerHTML;
		newItem.notes.push({note:tmpc});
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var liiRegexp= /http:\/\/www\.bailii\.org(?:\/cgi\-bin\/markup\.cgi\?doc\=)?\/\w+\/cases\/.+/
	if(liiRegexp.test(url)) {
		scrape(doc);
	} else {
		
		var items = Zotero.Utilities.getItemArray(doc, doc, liiRegexp);
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('84799379-7bc5-4e55-9817-baf297d129fe', '1.0.0b4.r1', '', '2007-06-18 18:15:00', '0', '100', '4', 'CanLII', 'Bill McKinney', 'http:\/\/www\.canlii\.org\/en\/[^\/]+\/[^\/]+\/doc\/.+', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var canLiiRegexp = /http:\/\/www\.canlii\.org\/en\/[^\/]+\/[^\/]+\/doc\/.+/
	if(canLiiRegexp .test(url)) {
		return "book";
	} else {
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			if(articleRegexp.test(aTags[i].href)) {
				return "multiple";
			}
		}
	}
}
', 
'function associateMeta(newItem, metaTags, field, zoteroField) {
	var field = metaTags.namedItem(field);
	if(field) {
		newItem[zoteroField] = field.getAttribute("content");
	}
}

function scrape(doc) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("case");
	
	var metaTags = doc.getElementsByTagName("meta");
	associateMeta(newItem, metaTags, "DC.Title", "title");
	associateMeta(newItem, metaTags, "DC.Date", "dateDecided");
	associateMeta(newItem, metaTags, "DC.Language", "language");
	newItem.url = doc.location.href;
	
	var field = metaTags.namedItem("DC.Title");
	var tmpText = "";
	if(field) {
		tmpText = field.getAttribute("content");
		var capRe = /^(.+),\s+(\d{4})\s+(\w+)\s+(\d+)\s+\(([^\)]+)\)/;
			var m = capRe.exec(tmpText);
			if(m) {
				
				newItem.caseName = m[1]+", "+m[2]+" "+m[3]+" "+m[4];
				if (m[3] == ''CanLII'') {
					newItem.court = m[5];
				} else {
					newItem.court = m[3];
				}
				
			} else {
				newItem.caseName = tmpText;
				newItem.court = "not found";
			}
	}
	
	
	
	// attach link to pdf version
	// NOTE: not working - don''t know why
	var pdfRe = /^(.+)\.html$/;
	var pdfMatch = pdfRe.exec(doc.location.href);
	if (pdfMatch) {
		var pdfUrl = pdfMatch[1]+".pdf";
		newItem.attachments = [{url:pdfUrl, title:"PDF version", mimeType:"application/pdf"}];
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var canLiiRegexp= /http:\/\/www\.canlii\.org\/en\/[^\/]+\/[^\/]+\/doc\/.+/
	if(canLiiRegexp.test(url)) {
		scrape(doc);
	} else {
		
		var items = Zotero.Utilities.getItemArray(doc, doc, canLiiRegexp);
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('930d49bc-44a1-4c22-9dde-aa6f72fb11e5', '1.0.0b4.r1', '', '2007-06-18 18:15:00', '0', '100', '4', 'Cornell LII', 'Bill McKinney', '^http://www\.law\.cornell\.edu/supct/html/.+', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var liiRegexp = /http:\/\/www\.law\.cornell\.edu\/supct\/html\/.+/
	if(liiRegexp.test(url)) {
		return "book";
	} else {
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			if(articleRegexp.test(aTags[i].href)) {
				return "multiple";
			}
		}
	}
}', 
'function associateMeta(newItem, metaTags, field, zoteroField) {
	var field = metaTags.namedItem(field);
	if(field) {
		newItem[zoteroField] = field.getAttribute("content");
	}
}

function scrape(doc) {

	var caselawCourt = "U.S. Supreme Court";
	var caselawJurisdiction = "Federal";
	var caselawSourceReporter = "U.S.";
	var caselawSourceVolume = "___";
	var caselawSourceStartPage = "___";
	var caselawParallelSourceVolume = "___";
	var caselawParallelSourceStartPage = "___";
	var caselawParallelSourceReporter = "___";
	var caselawDecisionYear = "";
	
	var newItem = new Zotero.Item("case");
	newItem.url = doc.location.href;
	newItem.language = "en-us";
	newItem.court = "U.S. Supreme Court";
	newItem.reporter = "U.S.";
	
	// LII provides a bunch of meta tags to harvest
	var metaTags = doc.getElementsByTagName("meta");
	associateMeta(newItem, metaTags, "CASENAME", "title");
	associateMeta(newItem, metaTags, "CASENAME", "caseName");
	//associateMeta(newItem, metaTags, "DOCKET", "caselawDocket");
	//associateMeta(newItem, metaTags, "PARTY1", "caselawParty1");
	//associateMeta(newItem, metaTags, "PARTY2", "caselawParty2");
	//associateMeta(newItem, metaTags, "ARGDATE", "caselawArguedDate");
	//associateMeta(newItem, metaTags, "DECDATE", "dateDecided");
	associateMeta(newItem, metaTags, "COURTBELOW", "history");
	//associateMeta(newItem, metaTags, "ACTION", "caselawCourtAction");


	var tmpCasename = newItem.caseName;
	tmpCasename = Zotero.Utilities.capitalizeTitle(tmpCasename.toLowerCase());
	tmpCasename = tmpCasename.replace("V.", "v.");
	newItem.caseName = tmpCasename;
	newItem.shortTitle = tmpCasename;
	
	// judge
	var j = metaTags.namedItem("AUTHOR");
	if(j) {
		newItem.creators.push({lastName:j.getAttribute("content"), creatorType:"judge", fieldMode:true});
	}

	// group meta tags
	for(var i=0; i<metaTags.length; i++) {
		var key = metaTags[i].getAttribute("name");
		var value = metaTags[i].getAttribute("content");
		if (key == "GROUP") {
			newItem.tags.push(value);		
		}
	}
	
	// parse year out of decision date
	var decdateField = metaTags.namedItem("DECDATE");
	if(decdateField ) {
		var decisionYearRegex = /(\w+)\s+(\d+),\s+(\d+)/
		var decisionDateMatch = decisionYearRegex.exec(decdateField.getAttribute("content"));
		var dy;
		var dm;
		var dd;
		if (decisionDateMatch ) {
			dm = decisionDateMatch[1];
			dd = decisionDateMatch[2];
			dy = decisionDateMatch [3];
			caselawDecisionYear = dy;
			newItem.dateDecided = dy + " " + dm + " " + dd;
		}
	}

	// create attachment to pdf
	var dyRegex = /^(.+)\/html\/(.+)(\.Z\w+)\.html$/;
	var dyMatch = dyRegex.exec(newItem.url);
	if (dyMatch) {
		var pdfUrl = dyMatch[1]+"/pdf/"+dyMatch[2]+"P"+dyMatch[3];
		newItem.attachments.push({url:pdfUrl, title:"PDF version", mimeType:"application/pdf", downloadable:true});
	}

	// parse disposition
	var dis = doc.getElementsByTagName("DISPOSITION");
	if (dis.length > 0) {
		var tmpDis = dis[0].innerHTML;
		tmpDis = tmpDis.replace(/\s+/g, " ");
		newItem.title = newItem.title + " (" +	tmpDis + ")";	
		newItem.caseName= newItem.caseName + " (" +	tmpDis + ")";	
		
	}
	
	
	// parse citation into parts so that bluebook can be constructed
	var cite = doc.getElementsByTagName("CASENUMBER");
	if (cite.length > 0) {
			var citeRegex = /([0-9]+)\s+U\.S\.\s+([0-9]+)/;
			var citeMatch = citeRegex.exec(cite[0].innerHTML);
			if (citeMatch) {
				caselawSourceVolume = citeMatch[1];
				newItem.reporterVolume = citeMatch[1];
				caselawSourceStartPage = citeMatch[2];
				newItem.firstPage = citeMatch[2];
			}
	}
	
	// look for offcite span element
	var spanTags = doc.getElementsByTagName("span");
	if (spanTags.length > 0) {
		for(var i=0; i<spanTags.length; i++) {
			if(spanTags[i].className == "offcite") {
				var citeRegex = /([0-9]+)\s+U\.S\.\s+([0-9]+)/;
				var citeMatch = citeRegex.exec(spanTags[i].innerHTML);
				if (citeMatch) {
					caselawSourceVolume = citeMatch[1];
					newItem.reporterVolume = citeMatch[1];
					caselawSourceStartPage = citeMatch[2];
					newItem.firstPage = citeMatch[2];
				}
				break;	
			}
		}
	}
	
	// bluebook citation	
	var bbCite = newItem.shortTitle + ", " + 
		caselawSourceVolume + " " + 
		caselawSourceReporter + " " + 
		caselawSourceStartPage;
	// paralell cite	
	if (caselawParallelSourceVolume != "___") {
		bbCite = bbCite + ", " + caselawParallelSourceVolume +
		" " + caselawParallelSourceReporter + " " +
		caselawParallelSourceStartPage;
	}	
	// jurisdiction and year
	bbCite = bbCite + " (" + caselawDecisionYear + ")";
	// closing period
	bbCite = "Bluebook citation: " + bbCite + ".";
	newItem.notes.push({note:bbCite});
	
	// parse out publication notice
	var notice = doc.getElementsByTagName("NOTICE");
	if (notice .length > 0) {
		var tmpNotice= notice [0].innerHTML;
		tmpNotice= tmpNotice.replace(/\s+/g, " ");
		newItem.notes.push({note:tmpNotice});		
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var liiRegexp = /http:\/\/www\.law\.cornell\.edu\/supct\/html\/.+/
	if(liiRegexp.test(url)) {
		scrape(doc);
	} else {
		
		var items = Zotero.Utilities.getItemArray(doc, doc, liiRegexp);
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('232e24fe-2f68-44fc-9366-ecd45720ee9e', '1.0.0b4.r1', '', '2007-06-21 06:30:00', '0', '100', '4', 'Patents - USPTO', 'Bill McKinney', '^http://patft\.uspto\.gov/netacgi/nph-Parser.+', 
'function detectWeb(doc, url) {
	var re = new RegExp("^http://patft\.uspto\.gov/netacgi/nph-Parser");
	if(re.test(doc.location.href)) {
		return "book";
	} else {
		return "multiple";
	}
}', 
'function get_nextsibling(n)
  {
  var x=n.nextSibling;
  while (x.nodeType!=1)
   {
   x=x.nextSibling;
   }
  return x;
}

function scrape(doc) {

	var newItem = new Zotero.Item("patent");
	newItem.url = doc.location.href;
	var extraText = new String();
	var tmpStr = new String();
	var tmpRefs = "";
	var tmpTitle = doc.title;
	
	var fontTags = doc.getElementsByTagName("font");
	for(var i=0; i<fontTags.length; i++) {
		if (fontTags[i].getAttribute("size") == "+1") {
			tmpTitle = tmpTitle + " - " + fontTags[i].innerHTML;
		}
	}
	tmpTitle = Zotero.Utilities.cleanString(tmpTitle);
	tmpTitle = tmpTitle.replace(/<[^>]+>/g, "");
	newItem.title = tmpTitle;
	
	var cellTags = doc.getElementsByTagName("td");
	for(var i=0; i<cellTags.length; i++) {

		var s = new String(cellTags[i].innerHTML);
		if (s.indexOf("United States Patent") > -1) {
			
			tmpStr = cellTags[i+1].childNodes[0].innerHTML;
			tmpStr = tmpStr.replace(/<[^>]+>/gi, "");
			tmpStr = tmpStr.replace(/,/gi, "");
			newItem.patentNumber = tmpStr;
			
			tmpStr = cellTags[i+3].innerHTML;
			tmpStr = tmpStr.replace(/<[^>]+>/gi, "");
			newItem.issueDate = tmpStr;
			continue;
		}
		if (s.indexOf("Assignee") > -1) {
			tmpStr = cellTags[i+1].innerHTML;
			tmpStr = tmpStr.replace(/<\/?\w+>/gi, "");
			newItem.assignee = tmpStr;
			continue;
		}
		if (s.indexOf("Inventors") > -1) {
			tmpStr = cellTags[i+1].innerHTML;
			
			var inventors = tmpStr.split(/<b>,/ig);
			for (var j=0; j<inventors.length; j++) {
				var tmpInventor = inventors[j];
				tmpInventor = tmpInventor.replace(/<\/?\w+>/gi, "");
				tmpInventor = tmpInventor.replace(/\([^\)]+\)/gi, "");
				tmpInventor = tmpInventor.replace(/^\s+/gi, "");
				
				var names = tmpInventor.split(";");
				if (names) {
					var lname = names[0];
					var fname = names[1];
					lname = lname.replace(/^\s+/gi, "");
					lname = lname.replace(/\s+$/gi, "");
					fname= fname.replace(/^\s+/gi, "");
					fname= fname.replace(/\s+$/gi, "");
					newItem.creators.push({lastName:lname, firstName:fname, creatorType:"inventor"});
				}
			}
			continue;
		}
		
		// references
		if (s.indexOf("<a href=\"/netacgi/nph-Parser?Sect2") > -1) {
				tmpRefs = tmpRefs + cellTags[i].childNodes[0].innerHTML + " ";
		}
		if (s.indexOf("<a href=\"http://appft1.uspto.gov/netacgi/nph-Parser?TERM1") > -1) {
				tmpRefs = tmpRefs + cellTags[i].childNodes[0].innerHTML + " ";
		}
	}
	
	var centerTags = doc.getElementsByTagName("center");
	for(var i=0; i<centerTags.length; i++) {
		var s = new String(centerTags[i].innerHTML);
		if (s.indexOf("Abstract") > -1) {
			//newItem.extra = "ok";
			var el = get_nextsibling(centerTags[i]);
			newItem.abstractNote = el.innerHTML;
		}
	
	}

	newItem.references = tmpRefs;
	newItem.complete();
}

function doWeb(doc, url) {
	var re = new RegExp("^http://patft\.uspto\.gov/netacgi/nph-Parser.+");
	if(re.test(doc.location.href)) {
		scrape(doc);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, "^http://patft\.uspto\.gov/netacgi/nph-Parser.+");
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var uris = new Array();
		for(var i in items) {
			uris.push(i);
		}
		
		Zotero.Utilities.processDocuments(uris, function(doc) { scrape(doc) },
			function() { Zotero.done(); }, null);
		
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('3e684d82-73a3-9a34-095f-19b112d88bbf', '1.0.0b3.r1', '', '2007-12-22 21:20:00', '1', '100', '4', 'Google Books', 'Simon Kornblith', '^http://books\.google\.[a-z]+(\.[a-z]+)?/books\?(.*id=.*|.*q=.*)', 
'function detectWeb(doc, url) {
	var re = new RegExp(''^http://books\\.google\\.[a-z]+(\.[a-z]+)?/books\\?id=([^&]+)'', ''i'');
	if(re.test(doc.location.href)) {
		return "book";
	} else {
		return "multiple";
	}
}', 
'function doWeb(doc, url) {
	// get local domain suffix
	var suffixRe = new RegExp("https?://books\.google\.([^/]+)/");
	var suffixMatch = suffixRe.exec(url);
	var suffix = suffixMatch[1];              
	var uri = doc.location.href;
	var newUris = new Array();
	
	var re = new RegExp(''^http://books\\.google\\.[a-z]+(\.[a-z]+)?/books\\?id=([^&]+)'', ''i'');
	var m = re.exec(uri);
	if(m) {
		newUris.push(''http://books.google.''+suffix+''/books?id=''+m[2]);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, ''http://books\\.google\\.'' + suffix + ''/books\\?id=([^&]+)'', ''^(?:All matching pages|About this Book|Table of Contents|Index)'');
		// Drop " - Page" thing
		for(var i in items) {
			items[i] = items[i].replace(/- Page [0-9]+\s*$/, "");
		}
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			var m = re.exec(i);
			newUris.push(''http://books.google.''+suffix+''/books?id=''+m[2]);
		}
	}
	Zotero.Utilities.processDocuments(newUris, function(newDoc) {
		var newItem = new Zotero.Item("book");
		newItem.extra = "";
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;

		var xpath = ''//h2[@class="title"]''
		var elmt;	
		if (elmt = newDoc.evaluate(xpath, newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null).iterateNext()){
			var title = Zotero.Utilities.superCleanString(elmt.textContent);
			newItem.title = title;
			Zotero.debug("title: " + title);
		}
		xpath = ''//div[@class="titlewrap"]/span[@class="addmd"]''
		if (elmt = newDoc.evaluate(xpath, newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null).iterateNext()){
			var authors = Zotero.Utilities.superCleanString(elmt.textContent);
			if (authors.substring(0, 3) == "By "){
				authors = authors.substring(3);
			}
			authors = authors.split(", ");
			for(j in authors) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j], "author"));
			}
		}
		
		xpath = ''//table[@id="bibdata"]/tbody/tr'';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null);
		while(elmt = elmts.iterateNext()) {
			var fieldelmt = newDoc.evaluate(''./td[1]//text()'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(fieldelmt) {
				field = Zotero.Utilities.superCleanString(fieldelmt.nodeValue);
				Zotero.debug("output: " + field);
				if(field.substring(0,10) == "Published ") {
					newItem.date = field.substring(10);
					var publisher = newDoc.evaluate(''..//a'', fieldelmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					if (publisher){
						publisher =  Zotero.Utilities.superCleanString(publisher.textContent);
						newItem.publisher = publisher;
					}
				} else if(field.substring(0,5) == "ISBN ") {
					newItem.ISBN = field.substring(5);
				} else if(field.substring(field.length-6) == " pages") {
					newItem.pages = field.substring(0, field.length-6);
				} else if(field.substring(0,12) == "Contributor ") {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(field.substring(12), "contributor"));
				}
			}
		}		
		newItem.complete();
	}, function() { Zotero.done(); }, null);
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('57a00950-f0d1-4b41-b6ba-44ff0fc30289', '1.0.0b3.r1', '', '2008-03-28 16:30:00', '1', '100', '4', 'Google Scholar', 'Simon Kornblith', 'http://scholar\.google\.(?:com|com?\.[a-z]{2}|[a-z]{2})/scholar', 
'function detectWeb(doc, url) {
	return "multiple";
}', 
'var haveEndNoteLinks;

function scrape(doc) {
	var nsResolver = doc.createNSResolver(doc.documentElement);
	
	var items = new Array();
	var itemGrabLinks = new Array();
	var itemGrabLink;
	var links = new Array();
	var types = new Array();
	
	var itemTypes = new Array();
	var attachments = new Array();
	
	var elmts = doc.evaluate(''//p[@class="g"]'', doc, nsResolver,
	                         XPathResult.ANY_TYPE, null);
	var elmt;
	var i=0;
	Zotero.debug("get elmts");
	Zotero.debug(haveEndNoteLinks);
	while(elmt = elmts.iterateNext()) {
		var isCitation = doc.evaluate("./font[1]/b[1]/text()[1]", elmt, nsResolver,
		                              XPathResult.ANY_TYPE, null).iterateNext();
		                              
		// use EndNote links if available
		if(haveEndNoteLinks) {
			itemGrabLink = doc.evaluate(''.//a[contains(@href, ".enw")]'',
										   elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext(); 
		} else {
			itemGrabLink = doc.evaluate(''.//a[text() = "Related Articles"]'',
										   elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext(); 
		}
        	
        	var noLinkRe = /^\[[^\]]+\]$/;
		
		if(itemGrabLink) {
			itemGrabLinks[i] = itemGrabLink.href;
			if(isCitation && noLinkRe.test(isCitation.textContent)) {
				// get titles for [BOOK] or [CITATION] entries
				items[i] = Zotero.Utilities.getNodeString(doc, elmt, ''./text()|./b/text()'', nsResolver);
			} else {
				// get titles for articles
				var link = doc.evaluate(''.//a'', elmt, nsResolver,
										XPathResult.ANY_TYPE, null).iterateNext();
				if(link) {
					items[i] = link.textContent;
					links[i] = link.href;
				}
			}
			
			if(items[i]) {
			i++;
			}
		}
	}
	
	items = Zotero.selectItems(items);
	
	if(!items) {
		if(Zotero.done) Zotero.done(true);
		return true;
	}
	
	var relatedMatch = /[&?]q=related:([^&]+)/;
	
	var urls = new Array();
	for(var i in items) {
		// get url
		if(haveEndNoteLinks) {
			urls.push(itemGrabLinks[i]);
		} else {
			var m = relatedMatch.exec(itemGrabLinks[i]);
			urls.push("http://scholar.google.com/scholar.ris?hl=en&lr=&q=info:"+m[1]+"&oe=UTF-8&output=citation&oi=citation");
		}
		
		if(links[i]) {
			attachments.push([{title:"Google Scholar Linked Page", type:"text/html",
			                  url:links[i]}]);
		} else {
			attachments.push([]);
		}
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("881f60f2-0802-411a-9228-ce5f47b64c7d");
	translator.setHandler("itemDone", function(obj, item) {
		item.attachments = attachments.shift();
		item.complete();
	});
	Zotero.Utilities.HTTP.doGet(urls, function(text) {
		translator.setString(text);
		translator.translate();
	}, function() { Zotero.done() });
}

function doWeb(doc, url) {
	var nsResolver = doc.createNSResolver(doc.documentElement);
	
	//SR:Will use preference setting url instead of cookie to get EndNote links (works with ezproxy, doesn''t overwrite other prefs)
	//doc.cookie = "GSP=ID=deadbeefdeadbeef:IN=ebe89f7e83a8fe75+7e6cc990821af63:CF=3; domain=.scholar.google.com";
	
	// determine if we need to reload the page
	
	// first check for EndNote links
	Zotero.debug("get links");
	haveEndNoteLinks = doc.evaluate(''//a[contains(@href, ".enw")]'', 
			doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(!haveEndNoteLinks) {
			// SR:Commenting out this bit as code for retrieving citations from "Related" links is unreliable and unnecessary
			//// next check if there are docs with no related articles
			//if(doc.evaluate(''''//p[@class="g"][not(descendant-or-self::text() = "Related Articles")]'''',
			//	doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			
		// SR:Set preferences to show import links in English and do page reload
		// (bit of a hack as it overwrites user prefs for language and import link type)
		url = url.replace (/hl\=[^&]*&?/, "");
		url = url.replace("scholar?", "scholar_setprefs?hl=en&scis=yes&scisf=3&submit=Save+Preferences&");
		haveEndNoteLinks = true;
		Zotero.Utilities.loadDocument(url, scrape);
		Zotero.wait();
		return;
			//}
	}
	
	scrape(doc, url);
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('9c335444-a562-4f88-b291-607e8f46a9bb', '1.0.0b3.r1', '', '2006-12-15 15:11:00', 1, 100, 4, 'Berkeley Library Catalog', 'Simon Kornblith', '^https?://[^/]*berkeley.edu[^/]*/WebZ/(?:html/results.html|FETCH)\?.*sessionid=',
'function detectWeb(doc, url) {
	var resultsRegexp = /\/WebZ\/html\/results.html/i
	if(resultsRegexp.test(url)) {
		return "multiple";
	} else {
		return "book";
	}
}',
'function reformURL(url) {
	return url.replace(/fmtclass=[^&]*/, "")+":fmtclass=marc";
}

function doWeb(doc, url) {
	var resultsRegexp = /\/WebZ\/html\/results.html/i
	
	if(resultsRegexp.test(url)) {
		var items = Zotero.Utilities.getItemArray(doc, doc, "/WebZ/FETCH", "^[0-9]*$");
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(reformURL(i));
		}
	} else {
		var urls = [reformURL(url)];
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	
	Zotero.Utilities.processDocuments(urls, function(newDoc) {
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var elmts = newDoc.evaluate(''//table/tbody/tr[@valign="top"]'',
		                         newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var record = new marc.record();
		while(elmt = elmts.iterateNext()) {
			var field = Zotero.Utilities.superCleanString(doc.evaluate(''./TD[1]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
			var value = doc.evaluate(''./TD[2]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			
			// remove spacing
			value = value.replace(/^\s+/, "");
			value = value.replace(/\s+$/, "");
			
			if(field == 0) {
				record.leader = "00000"+value;
			} else {
				var ind = value[3]+value[5];
				value = Zotero.Utilities.cleanString(value.substr(5)).
						replace(/\$([a-z0-9]) /g, marc.subfieldDelimiter+"$1");
				if(value[0] != marc.subfieldDelimiter) {
					value = marc.subfieldDelimiter+"a"+value;
				}
				record.addField(field, ind, value);
			}
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		newItem.repository = "Berkeley Library Catalog";
		
		newItem.complete();
	}, function() { Zotero.done(); }, null);
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('d0b1914a-11f1-4dd7-8557-b32fe8a3dd47', '1.0.0b3.r1', '', '2008-03-18 02:30:00', '1', '100', '4', 'EBSCOhost', 'Simon Kornblith', 'https?://[^/]+/(?:bsi|ehost)/(?:results|detail|folder)', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	// See if this is a search results or folder results page
	var searchResult = doc.evaluate(''//ul[@class="result-list" or @class="folder-list"]/li/div[@class="result-list-record" or @class="folder-item"]'', doc, nsResolver,
	                                XPathResult.ANY_TYPE, null).iterateNext();         
	if(searchResult) {
		return "multiple";
	}
	
	var xpath = ''//div[@class="record-display"]/dl[@class="citation-fields"]/dt[text() = "Persistent link to this record:"''
		+''or text() = "Vínculo persistente a este informe:"''
		+''or text() = "Lien permanent à cette donnée:"''
		+''or text() = "Permanenter Link zu diesem Datensatz:"''
		+''or text() = "Link permanente al record:"''
		+''or text() = "Link permanente para este registro:"''
		+''or text() = "本記錄固定連結:"''
		+''or text() = "此记录的永久链接:"''
		+''or text() = "このレコードへのパーシスタント リンク:"''
		+''or text() = "레코드 링크 URL:"''
		+''or text() = "Постоянная ссылка на эту запись:"''
		+''or text() = "Bu kayda sürekli bağlantı:"''
		+''or text() = "Μόνιμος σύνδεσμος σε αυτό το αρχείο:"]'';

	var persistentLink = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(persistentLink) {
		return "journalArticle";
	}
}', 
'var customViewStateMatch = /<input type="hidden" name="__CUSTOMVIEWSTATE" id="__CUSTOMVIEWSTATE" value="([^"]+)" \/>/
var host;

function fullEscape(text) {
	return escape(text).replace(/\//g, "%2F").replace(/\+/g, "%2B");
}

/*
 * given the text of the delivery page, downloads an item
 */
function downloadFunction(text) {
	var postLocation = /<form name="aspnetForm" method="post" action="([^"]+)"/
	var m = postLocation.exec(text);
	var deliveryURL = m[1].replace(/&amp;/g, "&");
	m = customViewStateMatch.exec(text);
	var downloadString = "__EVENTTARGET=&__EVENTARGUMENT=&__CUSTOMVIEWSTATE="+fullEscape(m[1])+"&__VIEWSTATE=&ctl00%24ctl00%24MainContentArea%24MainContentArea%24ctl00%24btnSubmit=Save&ctl00%24ctl00%24MainContentArea%24MainContentArea%24ctl00%24BibFormat=1&ajax=enabled";

	Zotero.Utilities.HTTP.doPost(host+"/ehost/"+deliveryURL,
								 downloadString, function(text) {	// get marked records as RIS
		// load translator for RIS
		var test = text.match(/UR\s+\-(.*)/g);
		if (test[0].match("@")) text = text.replace(/UR\s+\-(.*)/, "");
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			if (text.match("L3")) {
				item.DOI = text.match(/L3\s+\-\s*(.*)/)[1];
			}
			
			if(item.notes && item.notes[0]) {
				item.extra = item.notes[0].note;
				item.notes = new Array();
			}
			item.complete();
		});
		translator.translate();
		
		Zotero.done();
	});
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var hostRe = new RegExp("^(https?://[^/]+)/");
	var m = hostRe.exec(url);
	host = m[1];
	                                
	var searchResult = doc.evaluate(''//ul[@class="result-list" or @class="folder-list"]/li/div[@class="result-list-record" or @class="folder-item"]'', doc, nsResolver,
	                                XPathResult.ANY_TYPE, null).iterateNext();                              

	if(searchResult) {
		var titlex = ''//div[@class="result-list-record" or @class="folder-item-detail"]/a'';
		if (doc.evaluate(titlex, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var titles = doc.evaluate(titlex, doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else {
			var titles = doc.evaluate(''//div[@class="result-list-record" or @class="folder-item-detail"]/span[@class="medium-font"]/a'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
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
			var customViewState = newDoc.evaluate(''//input[@name="__CUSTOMVIEWSTATE"]'', newDoc, nsResolver,
								 XPathResult.ANY_TYPE, null).iterateNext();
			customViewState = fullEscape(customViewState.value);
			var deliverString = "__EVENTTARGET=ctl00%24ctl00%24MainContentArea%24MainContentArea%24topDeliveryControl%24deliveryButtonControl%24lnkExport&__EVENTARGUMENT=&__CUSTOMVIEWSTATE="+customViewState+"&__VIEWSTATE=&ajax=enabled";
			Zotero.Utilities.HTTP.doPost(newDoc.location.href, deliverString, downloadFunction);
		});
	} else {
		// get view state for post string		
		var customViewState = doc.evaluate(''//input[@name="__CUSTOMVIEWSTATE"]'', doc, nsResolver,
								 XPathResult.ANY_TYPE, null).iterateNext();
		customViewState = fullEscape(customViewState.value);
		var deliverString = "__EVENTTARGET=ctl00%24ctl00%24MainContentArea%24MainContentArea%24topDeliveryControl%24deliveryButtonControl%24lnkExport&__EVENTARGUMENT=&__CUSTOMVIEWSTATE="+customViewState+"&__VIEWSTATE=&ajax=enabled";
		Zotero.Utilities.HTTP.doPost(url, deliverString, downloadFunction);
	}
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('ce7a3727-d184-407f-ac12-52837f3361ff', '1.0.0b3.r1', '', '2006-12-12 23:41:00', 1, 100, 4, 'NYTimes.com', 'Simon Kornblith', '^http://(?:query\.nytimes\.com/search/query|(?:select\.|www\.)?nytimes\.com/.)', 
'function detectWeb(doc, url) {
	if(doc.title.substr(0, 30) == "The New York Times: Search for") {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var result = doc.evaluate(''//div[@id="srchContent"]'', doc, nsResolver,
		             XPathResult.ANY_TYPE, null).iterateNext();
		if(result) {
			return "multiple";
		}
	} else {
		var metaTags = doc.getElementsByTagName("meta");
		if(metaTags.namedItem("hdl") && metaTags.namedItem("byl")) {
			return "newspaperArticle";
		}
	}
}',
'function associateMeta(newItem, metaTags, field, zoteroField) {
	if(metaTags[field]) {
		newItem[zoteroField] = metaTags[field];
	}
}

function scrape(doc, url) {
	var newItem = new Zotero.Item("newspaperArticle");
	newItem.publicationTitle = "The New York Times";
	newItem.ISSN = "0362-4331";
	
	var metaTags = new Object();
	if(url != undefined) {
		newItem.url = url;
		var metaTagRe = /<meta[^>]*>/gi;
		var nameRe = /name="([^"]+)"/i;
		var contentRe = /content="([^"]+)"/i;
		var m = doc.match(metaTagRe);
		
		if(!m) {
			return;
		}
		
		for(var i=0; i<m.length; i++) {
			var name = nameRe.exec(m[i]);
			var content = contentRe.exec(m[i]);
			if(name && content) {
				metaTags[name[1]] = content[1];
			}
		}
		
		if(!metaTags["hdl"]) {
			return;
		}
		
		newItem.attachments.push({url:url, title:"New York Times Snapshot",
	 	                          mimeType:"text/html"});
	} else {
		newItem.url = doc.location.href;
		var metaTagHTML = doc.getElementsByTagName("meta");
		for(var i=0; i<metaTagHTML.length; i++) {
			var key = metaTagHTML[i].getAttribute("name");
			var value = metaTagHTML[i].getAttribute("content");
			if(key && value) {
				metaTags[key] = value;
			}
		}
	
		newItem.attachments.push({document:doc, title:"New York Times Snapshot"});
	}
	
	associateMeta(newItem, metaTags, "dat", "date");
	associateMeta(newItem, metaTags, "hdl", "title");
	associateMeta(newItem, metaTags, "dsk", "section");
	associateMeta(newItem, metaTags, "articleid", "accessionNumber");
	
	if(metaTags["byl"]) {
		var author = Zotero.Utilities.cleanString(metaTags["byl"]);
		if(author.substr(0, 3).toLowerCase() == "by ") {
			author = author.substr(3);
		}
		
		var authors = author.split(" and ");
		for each(var author in authors) {
			// fix capitalization
			var words = author.split(" ");
			for(var i in words) {
				words[i] = words[i][0].toUpperCase()+words[i].substr(1).toLowerCase();
			}
			author = words.join(" ");
			
			if(words[0] == "The") {
				newItem.creators.push({lastName:author, creatorType:"author", fieldMode:true});
			} else {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
			}
		}
	}
	
	if(metaTags["keywords"]) {
		var keywords = metaTags["keywords"];
		newItem.tags = keywords.split(",");
		for(var i in newItem.tags) {
			newItem.tags[i] = newItem.tags[i].replace("  ", ", ");
		}
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	if(doc.title.substr(0, 30) == "The New York Times: Search for") {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var result = doc.evaluate(''//div[@id="srchContent"]'', doc, nsResolver,
		             XPathResult.ANY_TYPE, null).iterateNext();
		var items = Zotero.Utilities.getItemArray(doc, result, ''^http://(?:select\.|www\.)nytimes.com/.*\.html$'');
		items = Zotero.selectItems(items);
			
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.HTTP.doGet(urls, function(text, response, url) { scrape(text, url) }, function() { Zotero.done(); }, null);
		
		Zotero.wait();
	} else {
		scrape(doc);
	}
}');

REPLACE INTO translators VALUES ('1e6d1529-246f-4429-84e2-1f1b180b250d', '1.0.0b3.r1', '', '2006-12-12 23:41:00', 1, 100, 4, 'The Chronicle of Higher Education', 'Simon Kornblith', '^http://chronicle\.com/', 
'function detectWeb(doc, url) {
	var articleRegexp = /^http:\/\/chronicle\.com\/(?:daily|weekly)\/[^/]+\//
	if(articleRegexp.test(url)) {
		if(doc.location.href.indexOf("weekly") != -1) {
			return "magazineArticle";
		} else {
			return "webpage";
		}
	} else {
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			if(articleRegexp.test(aTags[i].href)) {
				return "multiple";
			}
		}
	}
}',
'function associateMeta(newItem, metaTags, field, zoteroField) {
	if(metaTags.namedItem(field)) {
		newItem[zoteroField] = Zotero.Utilities.cleanString(metaTags.namedItem(field).getAttribute("content"));
	}
}

function scrape(doc) {
	if(doc.location.href.indexOf("weekly") != -1) {
		var newItem = new Zotero.Item("magazineArticle");
		
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		// go in search of pages
		var content = doc.evaluate(''/html/body/table[@class="layout"]/tbody/tr[1]/td[@class="content"]'',
		                           doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if(content) {
			var pagesRegexp = /http:\/\/chronicle.com\nSection: [^\n]+\nVolume [0-9]+, Issue [0-9]+, Pages? ([A-Z0-9\-]+)/;
			var m = pagesRegexp.exec(content.textContent);
			if(m) {
				newItem.pages = m[1];
			}
		}
	} else {
		var newItem = new Zotero.Item("webpage");
	}
	newItem.publicationTitle = "The Chronicle of Higher Education";
	newItem.ISSN = "0009-5982";
	
	newItem.url = doc.location.href;
	var metaTags = doc.getElementsByTagName("meta");

	newItem.attachments.push({document:doc, title:"Chronicle of Higher Education Snapshot"});
	
	associateMeta(newItem, metaTags, "published_date", "date");
	associateMeta(newItem, metaTags, "headline", "title");
	associateMeta(newItem, metaTags, "section", "section");
	associateMeta(newItem, metaTags, "volume", "volume");
	associateMeta(newItem, metaTags, "issue", "issue");
	
	if(metaTags.namedItem("byline")) {
		var author = Zotero.Utilities.cleanString(metaTags.namedItem("byline").getAttribute("content"));
		if(author.substr(0, 3).toLowerCase() == "by ") {
			author = author.substr(3);
		}
		
		var authors = author.split(" and ");
		for each(var author in authors) {
			// fix capitalization
			var words = author.split(" ");
			for(var i in words) {
				words[i] = words[i][0].toUpperCase()+words[i].substr(1).toLowerCase();
			}
			author = words.join(" ");
			
			if(words[0] == "The") {
				newItem.creators.push({lastName:author, creatorType:"author", fieldMode:true});
			} else {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
			}
		}
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var articleRegexp = /^http:\/\/chronicle\.com\/(?:daily|weekly)\/[^/]+\//;
	if(articleRegexp.test(url)) {
		scrape(doc);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, ''^http://chronicle\\.com/(?:daily|weekly)/[^/]+/'');
		items = Zotero.selectItems(items);
			
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('4c164cc8-be7b-4d02-bfbf-37a5622dfd56', '1.0.0b3.r1', '', '2006-12-14 00:40:00', 1, 100, 4, 'The New York Review of Books', 'Simon Kornblith', '^https?://www\.nybooks\.com/', 
'function detectWeb(doc, url) {
	var articleRegexp = /^http:\/\/www\.nybooks\.com\/articles\/[0-9]+\/?/
	if(articleRegexp.test(url)) {
		return "journalArticle";
	} else {
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			if(articleRegexp.test(aTags[i].href)) {
				return "multiple";
			}
		}
	}
}',
'function associateMeta(newItem, metaTags, field, zoteroField) {
	if(metaTags.namedItem(field)) {
		newItem[zoteroField] = Zotero.Utilities.cleanString(metaTags.namedItem(field).getAttribute("content"));
	}
}

function scrape(doc) {
	var newItem = new Zotero.Item("journalArticle");
	newItem.publicationTitle = "The New York Review of Books";
	newItem.ISSN = "0028-7504";
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	newItem.url = doc.location.href;
	var metaTags = doc.getElementsByTagName("meta");

	newItem.attachments.push({document:doc, title:"New York Review of Books Snapshot"});
	
	associateMeta(newItem, metaTags, "dc.title", "title");
	
	var info = doc.evaluate(''//div[@id="center-content"]/h4[@class="date"]'',
	                            doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	
	if(info) {
		// get date (which is in an a tag)
		newItem.date = doc.evaluate("./a", info, nsResolver, XPathResult.ANY_TYPE,
		                           null).iterateNext();
		if(newItem.date) {
			newItem.date = newItem.date.textContent;
		}
		
		info = Zotero.Utilities.cleanString(info.textContent);
		
		// get volume and issue
		var infoRe = /Volume ([0-9]+), Number ([0-9]+)/;
		var m = infoRe.exec(info);
		if(m) {
			newItem.volume = m[1];
			newItem.issue = m[2];
		}
	}
	
	
	var authors = doc.evaluate(''//div[@id="center-content"]/h4/a[substring(@href, 1, 9) = "/authors/"]'',
	                           doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	
	var author;
	while(author = authors.iterateNext()) {
		newItem.creators.push(Zotero.Utilities.cleanAuthor(author.textContent, "author", false));
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var articleRegexp = /^http:\/\/www\.nybooks\.com\/articles\/[0-9]+/
	if(articleRegexp.test(url)) {
		scrape(doc);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, "^https?://www\\.nybooks\\.com/articles/[0-9]+/?");
		items = Zotero.selectItems(items);
			
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('d1bf1c29-4432-4ada-8893-2e29fc88fd9e', '1.0.0b3.r1', '', '2007-06-21 20:10:00', 1, 100, 4, 'washingtonpost.com', 'Simon Kornblith', '^http://www\.washingtonpost\.com/', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	// don''t say we can scrape when we can''t; make sure user is logged in
	var signedIn = doc.evaluate(''//a[text() = "Sign out" or text() = "Sign Out"]'',
							   doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(!signedIn) {
		return;
	}
	
	var articleRegexp = /http:\/\/www\.washingtonpost\.com\/wp-dyn\/content\/article\/[0-9]+\/[0-9]+\/[0-9]+\/[^\/]+\.html/
	if(articleRegexp.test(url)) {
		return "newspaperArticle";
	} else {
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			if(articleRegexp.test(aTags[i].href)) {
				return "multiple";
			}
		}
	}
}',
'function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("newspaperArticle");
	newItem.publicationTitle = "The Washington Post";
	newItem.ISSN = "0740-5421";
	
	newItem.url = doc.location.href;
	var metaTags = doc.getElementsByTagName("meta");
	
	// Elena''s code to grab print version (all pages)
	snapshotURL=doc.location.href.replace(".html", "_pf.html");
	newItem.attachments.push({title:"Washington Post Snapshot", mimeType:"text/html", url:snapshotURL, snapshot:true});

	// grab title from doc title
	newItem.title = doc.title.replace(" - washingtonpost.com", "");
	
	var byline = doc.evaluate(''//div[@id="byline"]'', doc, nsResolver,
	                        XPathResult.ANY_TYPE, null).iterateNext();	
	// grab authors from byline
	if(byline) {
		var authors = byline.textContent.substr(3).split(" and ");
		for each(var author in authors) {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
	}
	
	var fonts = doc.evaluate(''//div[@id="article"]/p/font/text()'', doc, nsResolver,
	                        XPathResult.ANY_TYPE, null);
	var font;
	while(font = fonts.iterateNext()) {
		var pageRe = /([^;]+);(?:[\xA0 ]+Pages?[\xA0 ]+([A-Z0-9\-]+))?/
		// grab pages and date
		Zotero.debug(Zotero.Utilities.cleanString(font.nodeValue));
		var m = pageRe.exec(font.nodeValue);
		if(m) {
			newItem.date = m[1];
			newItem.pages = m[2];
			break;
		}
	}
	
	// grab tags from meta tag
	var keywords = doc.getElementsByTagName("meta");
	if(keywords) {
		keywords = keywords.namedItem("keywords");
		if(keywords) {
			keywords = keywords.getAttribute("content");
			if(keywords) {
				newItem.tags = keywords.split(/, ?/);
			}
		}
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var articleRegexp = /http:\/\/www\.washingtonpost\.com\/wp-dyn\/content\/article\/[0-9]+\/[0-9]+\/[0-9]+\/[^\/]+\.html/
	if(articleRegexp.test(url)) {
		scrape(doc);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, articleRegexp);
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('a07bb62a-4d2d-4d43-ba08-d9679a0122f8', '1.0.0b3.r1', '', '2008-01-09 20:00:00', 1, 100, 4, 'ABC-CLIO Serials Web', 'Simon Kornblith', 'https?://[^/]*serials\.abc-clio\.com[^/]*/active/go/ABC-Clio-Serials_v4', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var result = doc.evaluate(''//table[@class="rc_main"]'', doc, nsResolver,
				 XPathResult.ANY_TYPE, null).iterateNext();
	if(result) {
		return "multiple";
	}
}',
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var availableItems = new Array();
	var availableAttachments = new Array();
		
	var elmts = doc.evaluate(''//table[@class="rc_main"]'', doc, nsResolver,
	                         XPathResult.ANY_TYPE, null);
	var elmt;
	while(elmt = elmts.iterateNext()) {
		var title = doc.evaluate(''./tbody/tr/td[b/text() = "Title:"]'',
		                         elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		var checkbox = doc.evaluate(''.//input[@type = "checkbox"]'',
		                         elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(title, checkbox) {
			checkbox = checkbox.name;
			availableItems[checkbox] = Zotero.Utilities.cleanString(title.textContent).substr(6);
			
			var links = doc.evaluate(''./tbody/tr/td[b/text() = "Fulltext: ["]/a'',
									 elmt, nsResolver, XPathResult.ANY_TYPE, null);
			var link;
			
			var attach = new Array();
			while(link = links.iterateNext()) {
				attach.push({url:link.href, title:Zotero.Utilities.cleanString(link.textContent)+" Full Text",
				             mimeType:"text/html"});
			}
			availableAttachments[checkbox] = attach;
		}
	}
	
	var items = Zotero.selectItems(availableItems);
	
	if(!items) {
		return true;
	}
	
	var postString = "_defaultoperation=Download+Options&research_field=&research_value=&jumpto=";
	var attachments = new Array();
	for(var i in availableItems) {
		postString += "&_checkboxname="+i+(items[i] ? "&"+i+"=1" : "");
		if(items[i]) {
			attachments.push(availableAttachments[i]);
		}
	}
	
	Zotero.Utilities.HTTP.doPost(url, postString, function(text) {
		Zotero.Utilities.HTTP.doPost(url, "_appname=serials&_defaultoperation=Download+Documents&_formname=download&download_format=citation&download_which=tagged&download_where=ris&mailto=&mailreplyto=&mailsubject=&mailmessage=",
		                              function(text) {	
			// get link
			var linkRe = /<a\s+class="button"\s+href="([^"]+)"\s+id="resource_link"/i;
			var m = linkRe.exec(text);
			if(!m) {
				throw("regular expression failed!");
			}			
			Zotero.Utilities.HTTP.doGet(m[1], function(text) {
				// load translator for RIS
				var translator = Zotero.loadTranslator("import");
				translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				translator.setString(text);
				translator.setHandler("itemDone", function(obj, item) {
					if(item.notes && item.notes[0]) {
						item.extra = item.notes[0].note;
						
						delete item.notes;
						item.notes = undefined;
					}
					
					// grab uni data from thesis
					if(item.itemType == "thesis") {
						var re = /^(.+?) ([0-9]{4})\. ([0-9]+) pp\.(.*)$/;
						var m = re.exec(item.extra);
						if(m) {
							item.publisher = m[1];
							item.date = m[2];
							item.pages = m[3];
							item.extra = m[4];
						}
					}
					
					// fix periods
					for(var i in item.creators) {
						var nameLength = item.creators[i].firstName.length;
						
						if(item.creators[i].firstName[nameLength-1] == ".") {
							item.creators[i].firstName = item.creators[i].firstName.substr(0, nameLength-1);
						}
					}
					for(var i in item.tags) {
						var tagLength = item.tags[i].length;
						
						if(item.tags[i][tagLength-1] == ".") {
							item.tags[i] = item.tags[i].substr(0, tagLength-1);
						}
					}
					
					// fix title
					item.title = Zotero.Utilities.superCleanString(item.title);
					
					// add attachments
					item.attachments = attachments.shift();
					
					item.complete();
				});
				translator.translate();
				Zotero.done();
			});
		});
	});
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('fa396dd4-7d04-4f99-95e1-93d6f355441d', '1.0.0b3.r1', '', '2008-02-06 21:00:00', 1, 100, 4, 'CiteSeer', 'Simon Kornblith', '^http://(?:citeseer\.ist\.psu\.edu/|citeseer\.csail\.mit\.edu/|citeseer\.ifi\.unizh\.ch/|citeseer\.comp\.nus\.edu\.sg/)', 
'function detectWeb(doc, url) {
	var searchRe = /http:\/\/[^\/]+\/ci?s/;
	if(searchRe.test(url)) {
		return "multiple";
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		if(doc.evaluate(''/html/body/span[@class="m"]/pre'', doc, nsResolver,
		                XPathResult.ANY_TYPE, null).iterateNext()) {
			return "journalArticle";
		}
	}
}', 
'function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	// figure out what attachments to add
	var attachments = new Array();
	var results = doc.evaluate(''/html/body/span[@class="m"]/table[@class="h"]/tbody/tr/td[4]/center/font/a'',
	                       doc, nsResolver, XPathResult.ANY_TYPE, null);
	var elmt;
	
	var acceptableTypes = ["PDF", "PS", "PS.gz"];
	var mimeTypes = ["application/pdf", "application/postscript", "application/gzip"];
	var resultsArray = [];
	while (elmt = results.iterateNext()) {
		resultsArray.push(elmt);
	}
	resultsArray = resultsArray.filter(function (element, index, array) {
		return (acceptableTypes.indexOf(element.textContent.toString()) != -1);
	});
	resultsArray = resultsArray.sort(function (a,b) {
		return (acceptableTypes.indexOf(a.textContent.toString()) -
			acceptableTypes.indexOf(b.textContent.toString()));
	});
	if (resultsArray.length > 0) {
		var elmt = resultsArray[0];
		var kind = elmt.textContent.toString();
		var index = acceptableTypes.indexOf(kind);
	       	var attachment = {url:elmt.href, mimeType:mimeTypes[index],
			       	  title:"CiteSeer Full Text "+kind};
		attachments.push(attachment);
	}
	
	var bibtex = doc.evaluate(''/html/body/span[@class="m"]/pre/text()'', doc, nsResolver,
		                XPathResult.ANY_TYPE, null).iterateNext();
	if(bibtex) {
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("9cb70025-a888-4a29-a210-93ec52da40d4");
		translator.setString(bibtex.nodeValue.toString());
		translator.setHandler("itemDone", function(obj, item) {
			if(item.url) {	// add http to url
				item.url = "http://"+item.url;
			}
			item.attachments = attachments;
			
			item.complete();
		});
		translator.translate();
	} else {
		throw "No BibTeX found!";
	}
}

function doWeb(doc, url) {
	var searchRe = /http:\/\/([^\/]+)\/ci?s/;
	var m = searchRe.exec(doc.location.href);
	if(m) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var items = Zotero.Utilities.getItemArray(doc, doc, "^http://"+m[1]+"/[^/]+.html");
		items = Zotero.selectItems(items);
			
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();
	} else {
		scrape(doc);
	}
}');

REPLACE INTO translators VALUES ('8917b41c-8527-4ee7-b2dd-bcbc3fa5eabd', '1.0.0b4.r5', '', '2008-02-01 19:30:00', '1', '100', '4', 'CiteULike', 'Sean Takats', 'https?://(?:www\.)?citeulike.org(?:.*/tag/[^/]*$|/search/|/journal/|/group/[0-9]+/library$|/\?page=[0-9]+$|/.*article/[0-9]+$|/$)', 
'function detectWeb(doc, url){
	var articleRe = /\/article\/[0-9]+$/;
	var m = url.match(articleRe);
	var newUris = new Array();
	
	if (m){
		return "journalArticle";
	} else {
		return "multiple";
	}
}', 
'function doWeb(doc, url){
	var articleRe = /\/article\/[0-9]+$/;
	var m = url.match(articleRe);
	var newUris = new Array();
	
	if (m){
		newUris.push(url.replace(/citeulike\.org\//, "citeulike.org/endnote/"));
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		var elmt;
		var elmts = doc.evaluate(''//a[@class="title"]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var items = new Object();		
		while(elmt = elmts.iterateNext()) {
			items[elmt.href] = Zotero.Utilities.trimInternal(elmt.textContent);
		} 
		items = Zotero.selectItems(items);
		if(!items) return true;
		for(var uri in items) {
			newUris.push(uri.replace(/citeulike\.org\//, "citeulike.org/endnote/"));
		}
	}
	Zotero.Utilities.HTTP.doGet(newUris, function(text) {
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.translate();
		Zotero.done();
	});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('ecddda2e-4fc6-4aea-9f17-ef3b56d7377a', '1.0.0b3.r1', '', '2008-04-02 08:10:00', '1', '100', '4', 'arXiv.org', 'Sean Takats and Michael Berkowitz', 'http://(?:(www|uk)\.)?(?:(arxiv\.org|xxx.lanl.gov)/(?:find/\w|list/\w|abs/)|eprintweb.org/S/(?:search|archive|article)(?!.*refs$)(?!.*cited$))', 
'function detectWeb(doc, url) {
	var searchRe = /^http:\/\/(?:(www|uk)\.)?(?:(arxiv\.org|xxx\.lanl\.gov)\/(?:find|list)|eprintweb.org\/S\/(?:archive|search$))/;
	if(searchRe.test(url)) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}', 
'function getPDF(articleID) {
	return {url:"http://www.arxiv.org/pdf/" + articleID + "v1.pdf",
			mimeType:"application/pdf", title:articleID + " PDF"};
}

function doWeb(doc, url) {
	var eprintMultRe = /^http:\/\/(?:www\.)?eprintweb.org\/S\/(?:search|archive)/;
	var eprintMultM = eprintMultRe.exec(url);
	
	var eprintSingRe = /^http:\/\/(?:www\.)?eprintweb.org\/S\/(?:article|search\/[0-9]+\/A[0-9]+)/;
	var eprintSingM = eprintSingRe.exec(url);

	if (eprintMultM) {
		var elmtsXPath = ''//table/tbody/tr/td[@class="txt"]/a[text()="Abstract"]/../b'';
		var titlesXPath = ''//table/tbody/tr/td[@class="lti"]'';
		var titleNode = ''./text()'';
	} else {
		var elmtsXPath = ''//div[@id="dlpage"]/dl/dt/span[@class="list-identifier"]/a[1]'';
		var titlesXPath = ''//div[@id="dlpage"]/dl/dd/div[@class="meta"]/div[@class="list-title"]'';
	}

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var elmts = doc.evaluate(elmtsXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var titles = doc.evaluate(titlesXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);

	var newURIs = new Array();
	var elmt = elmts.iterateNext();
	var title = titles.iterateNext();
	if (elmt && titles) {
		var availableItems = new Array();
		var arXivCats = new Array();
		var arXivIDs = new Array();
		var i=0;
		if (eprintMultM){
			do {
				var newID = doc.evaluate(''./text()'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				newID = newID.replace(/arXiv:/, "");
				newID = newID.replace(/\//g, "%2F"); 
				availableItems[i] = doc.evaluate(titleNode, title, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent; 
				arXivIDs[i] = newID;
				i++;
			} while ((elmt = elmts.iterateNext()) && (title = titles.iterateNext()));
		}
		else{
			do {
				var newID= elmt.textContent;
				newID = newID.replace(/arXiv:/, "");
				newID = newID.replace(/\//g, "%2F"); 
				availableItems[i] = Zotero.Utilities.cleanString(title.textContent.replace(/^\s*Title:\s+/, "")); 
				arXivIDs[i] = newID;
				i++;
			} while ((elmt = elmts.iterateNext()) && (title = titles.iterateNext()));
		}
		var items = Zotero.selectItems(availableItems);
		if(!items) {
			return true;
		}
		for(var i in items) {
			newURIs.push("http://export.arxiv.org/oai2?verb=GetRecord&identifier=oai%3AarXiv.org%3A" + arXivIDs[i] + "&metadataPrefix=oai_dc");

		}
	}
	else {
		if (eprintSingM){
			var titleID = doc.evaluate(''//td[@class="ti"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var arXivID = doc.evaluate(''//table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[1]/td[@class="txt"]/b'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			arXivID = arXivID.substring(0, arXivID.indexOf(" "));
			arXivID = arXivID.replace(/arXiv:/, "");
			arXivID = arXivID.replace(/\//g, "%2F");
		} else {
			var arXivID = doc.evaluate(''//title'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var titleRe = /\[([^\]]*)]/;
			var m = titleRe.exec(arXivID);
			arXivID = m[1];
			arXivID = arXivID.replace(/\//g, "%2F"); 
		}
		newURIs.push("http://export.arxiv.org/oai2?verb=GetRecord&identifier=oai%3AarXiv.org%3A" + arXivID + "&metadataPrefix=oai_dc");

	}

	Zotero.Utilities.HTTP.doGet(newURIs, function(text) {
		var newItem = new Zotero.Item("journalArticle");
		//	remove header
		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");
		//	fix non-compliant XML tags (colons)
		text = text.replace(/<dc:/g, "<dc_").replace(/<\/dc:/g, "</dc_");
		text = text.replace(/<oai_dc:dc/g, "<oai_dc_dc").replace(/<\/oai_dc:dc/g, "</oai_dc_dc");
		text = text.replace(/<OAI-PMH[^>]*>/, "").replace(/<\/OAI-PMH[^>]*>/, "");
		text = "<zotero>" + text + "</zotero>";
		var xml = new XML(text);
		var title;
		var citation = xml.GetRecord.record.metadata.oai_dc_dc;
		var test = xml..responseDate.text().toString();

		if (citation.dc_title.length()){
			title = Zotero.Utilities.cleanString(citation.dc_title.text().toString());
			newItem.title = title;
		}
		Zotero.debug("article title: " + title);
		var type = "";
		if(citation.dc_creator.length()) {
		var authors = citation.dc_creator;
			for(var j=0; j<authors.length(); j++) {
				Zotero.debug("author: " + authors[j]);
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j].text().toString(),type,true));
			}
		}
		if (citation.dc_date.length()) {
			var dates = citation.dc_date;
			newItem.date = Zotero.Utilities.cleanString(dates[0].text().toString());
		}
		if (citation.dc_description.length()) {
			var descriptions = citation.dc_description;
			for (var j=0; j<descriptions.length(); j++) {
				var noteStr = Zotero.Utilities.cleanString(descriptions[j].text().toString());
				newItem.notes.push({note:noteStr});
			}
		}
		if (citation.dc_subject.length()) {
			var subjects = citation.dc_subject;
			for (var j=0; j<subjects.length(); j++) { 
				var subjectValue = Zotero.Utilities.cleanString(subjects[j].text().toString());
				newItem.tags.push(subjectValue);
			}
		}
		if (citation.dc_identifier.length()) {
			var identifiers = citation.dc_identifier;
			for (var j=0; j<identifiers.length(); j++) {
				var identifier = Zotero.Utilities.cleanString(identifiers[j].text().toString());
				if (identifier.substr(0, 4) == "doi:") {
					newItem.DOI = identifier;
				}
				else if (identifier.substr(0, 7) == "http://") {
					newItem.url = identifier;
				}
				else {
					newItem.extra = identifier;
				}
			}
		}
		var articleID = "";
		if (xml.GetRecord.record.header.identifier.length()) {
			articleID = xml.GetRecord.record.header.identifier.text().toString();
			articleID = articleID.substr(14);
			newItem.publicationTitle = articleID;
		}
//		TODO add "arXiv.org" to bib data?
		newItem.attachments.push({url:newItem.url, title:"arXiv.org Snapshot", mimeType:"text/html"});
		newItem.attachments.push(getPDF(articleID));
		if (newItem.notes[0][''note'']) {
			newItem.abstractNote = newItem.notes[0][''note''];
			newItem.notes = new Array();
		}
		newItem.complete();
	}, function() {Zotero.done();}, null);
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('232903bc-7307-4058-bb1a-27cfe3e4e655', '1.0.0b3.r1', '', '2007-04-23 17:00:00', '0', '100', '4', 'SPIRES', 'Sean Takats', '^http://www.slac.stanford.edu/spires/find/hep/', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
		
	var citations = doc.evaluate(''//dl/dd/a[text()="BibTeX"]'', doc, nsResolver,
			XPathResult.ANY_TYPE, null);
	var citation = citations.iterateNext();
	var titles = doc.evaluate(''//p/b[1]'', doc, nsResolver,
			XPathResult.ANY_TYPE, null);
	var title = titles.iterateNext();
	if(citation && title) {
		// search page
		return "multiple";
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
		
	var citations = doc.evaluate(''//dl/dd/a[text()="BibTeX"]'', doc, nsResolver,
			XPathResult.ANY_TYPE, null);
	var citation = citations.iterateNext();
//	var titles = doc.evaluate(''//p/b[1]'', doc, nsResolver,
//			XPathResult.ANY_TYPE, null);
	var titles = doc.evaluate(''//p[b[1]]'', doc, nsResolver,
			XPathResult.ANY_TYPE, null);
	var title = titles.iterateNext();
	if(citation && title) {
		// search page
		var items = new Object();		
		do {
			items[citation.href] = Zotero.Utilities.cleanString(title.textContent);
		} while((citation=citations.iterateNext()) && (title=titles.iterateNext()))
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var newUris = new Array();
		for(var id in items) {
			newUris.push(id);
		}
	} else {
		//single result page?
	}
	
	Zotero.Utilities.HTTP.doGet(newUris, function(text) {
		var m = text.match(/<pre>(?:.|[\r\n])*?<\/pre>/g);
		var bibTeXString = "";
		for each(var citation in m) {
			// kill pre tags
			citation = citation.substring(5, citation.length-6);
			bibTeXString += citation;
		}
		
		// import using BibTeX
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("9cb70025-a888-4a29-a210-93ec52da40d4");
		translator.setString(bibTeXString);
		translator.setHandler("itemDone", function(obj, item) {			
			item.complete();
		});
		translator.translate();
		
		Zotero.done();
	});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('fe728bc9-595a-4f03-98fc-766f1d8d0936', '1.0.0b4.r5', '', '2007-12-03 22:00:00', '0', '100', '4', 'Wiley InterScience', 'Sean Takats', 'https?:\/\/(?:www3\.|www\.)?interscience\.wiley\.com[^\/]*\/(?:search\/|cgi-bin\/abstract\/[0-9]+)', 
'function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
		
	var xpath = ''//input[@name="ID"][@type="checkbox"]'';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
	var m = url.match(/https?:\/\/[^\/]*\/cgi-bin\/abstract\/[0-9]+/);
	if (m){
		return "journalArticle";
	}
}', 
'function doWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var m = url.match(/https?:\/\/[^\/]*\/cgi-bin\/abstract\/([0-9]+)/);
	var ids = new Array();
	var xpath = ''//tr[td/input[@name="ID"][@type="checkbox"]]'';
	var elmt;
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null); 
	elmt = elmts.iterateNext();
	if(elmt) {  //search
		var id;
		var title;
		var availableItems = new Array();
		do {
			title = doc.evaluate(''./td/strong'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			id = doc.evaluate(''./td/input[@name="ID"][@type="checkbox"]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
			availableItems[id] = title;
		} while (elmt = elmts.iterateNext())

		var items = Zotero.selectItems(availableItems);
		if(!items) {
			return true;
		}
		for(var id in items) {
			ids.push(id);
		}
		
	} else if (m){ //single article
		ids.push(m[1]);
	}
	
	var hostRe = new RegExp("^http(?:s)?://[^/]+");
	var m = hostRe.exec(doc.location.href);
	var host = m[0];
	var uri = host+"/tools/citex";
	var poststring = "";
	for each(var id in ids) {
		poststring = poststring + "&id=" + id;
	}
	poststring = "clienttype=1&subtype=1&mode=1&version=1" + poststring;
	Zotero.Utilities.HTTP.doPost(uri, poststring, function(text) {
		uri = host+"/tools/CitEx";
		poststring = "mode=2&format=3&type=2&file=3&exportCitation.x=16&exportCitation.y=10&exportCitation=submit";
		Zotero.Utilities.HTTP.doPost(uri, poststring, function(text) {
			var m = text.match(/%A\s(.*)/);  //following lines fix Wiley''s incorrect %A tag (should be separate tags for each author)
			if (m){
				var newauthors ="";
				var authors = m[1].split(",")
				for each (var author in authors){
					if (author != ""){
						newauthors = newauthors + "%A "+Zotero.Utilities.trimInternal(author)+"\n";
					}
				}
				text = text.replace(/%A\s.*\n/, newauthors);
			}
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("881f60f2-0802-411a-9228-ce5f47b64c7d"); //EndNote/Refer/BibIX
			translator.setString(text);
			translator.translate();
			Zotero.done();
		});
	});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('b6d0a7a-d076-48ae-b2f0-b6de28b194e', '1.0.0b3.r1', '', '2008-03-24 02:15:00', '1', '100', '4', 'ScienceDirect', 'Michael Berkowitz', 'https?://www\.sciencedirect\.com[^/]*/science\?(?:.+\&|)_ob=(?:ArticleURL|ArticleListURL|PublicationURL)', 
'function detectWeb(doc, url) {
	if ((url.indexOf("_ob=DownloadURL") != -1) || doc.title == "ScienceDirect Login") {
		return false;
	}
	if(url.indexOf("_ob=ArticleURL") == -1) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	if (!doc.evaluate(''//img[contains(@src, "guest_user.gif")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var articles = new Array();
		if(url.indexOf("_ob=ArticleURL") == -1) {
			//search page
			var items = new Object();
			var xpath;
			if (url.indexOf("_ob=PublicationURL") != -1) {
				xpath = ''//table[@class="txt"]/tbody/tr/td[2]'';
			} else {
				xpath = ''//table[@class="tableResults-T"]/tbody/tr[1]/td[2]'';
			}
			var rows = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var next_row;
			while (next_row = rows.iterateNext()) {
				var title = doc.evaluate(''./span[@class="bf"]'', next_row, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				var link = doc.evaluate(''.//a[1]'', next_row, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
				items[link] = title;
			}
			items = Zotero.selectItems(items);
			for (var i in items) {
				articles.push(i);
			}
		} else {
			articles = [url];
		}
		Zotero.Utilities.processDocuments(articles, function(newDoc) {
			var doi = newDoc.evaluate(''//div[@class="pageText"][@id="sdBody"]/a[contains(text(), "doi")]'', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.substr(4);
			Zotero.debug(doi);
			var PDF = newDoc.evaluate(''//a[contains(text(), "PDF")]'', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
			var url = newDoc.location.href;
			var get = newDoc.evaluate(''//a[img[contains(@alt, "Export citation")]]'', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
			Zotero.Utilities.HTTP.doGet(get, function(text) {
				var md5 = text.match(/<input type=hidden name=md5 value=([^>]+)>/)[1];
				var acct = text.match(/<input type=hidden name=_acct value=([^>]+)>/)[1];
				var userid = text.match(/<input type=hidden name=_userid value=([^>]+)>/)[1];
				var uoikey = text.match(/<input type=hidden name=_uoikey value=([^>]+)>/)[1];
				if (text.match(/<input type=hidden name=_ArticleListID value=([^>]+)>/)) {
					var alid = text.match(/<input type=hidden name=_ArticleListID value=([^>]+)>/)[1];
				}
				if (alid) {
					var docID = "_ArticleListID=" + alid + "&_uoikey=" + uoikey;
				} else {
					var docID = "_uoikey=" + uoikey;
				}
				var post = "_ob=DownloadURL&_method=finish&_acct=" + acct + "&_userid=" + userid + "&_docType=FLA&" + docID + "&md5=" + md5 + "&count=1&JAVASCRIPT_ON=Y&format=cite-abs&citation-type=RIS&Export=Export&x=26&y=17";
				var baseurl = url.match(/https?:\/\/[^/]+\//)[0];
				Zotero.Utilities.HTTP.doPost(baseurl + ''science'', post, function(text) { 
					var translator = Zotero.loadTranslator("import");
					translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
					translator.setString(text);
					translator.setHandler("itemDone", function(obj, item) {
						item.attachments = [
							{url:url, title:"ScienceDirect Snapshot", mimeType:"text/html"},
							{url:PDF, title:"ScienceDirect Full Text PDF", mimeType:"application/pdf"}
						];
				
				
						if(item.notes[0]) {
							item.abstractNote = item.notes[0].note;
							item.notes = new Array();
						}
						if (doi) {
							item.DOI = doi;
						}
						item.complete();
					});
					translator.translate();
				});
				Zotero.wait();
			});
		}, function() {Zotero.done;});
	} else {
		var articles = new Array();
		Zotero.debug("not logged in");
		if (detectWeb(doc, url) == "multiple") {
			var items = new Object();
			if (url.indexOf("_ob=PublicationURL") != -1) {
				xpath = ''//table[@class="txt"]/tbody/tr[1]/td[2]'';
			} else {
				var xpath = ''//table[@class="tableResults-T"]/tbody/tr/td[2]'';
			}
			
			var titlepath = xpath + ''//span[@class="bf"]'';
			var linkpath = xpath + ''//tr/td[1]/a[1]'';
			var titles = doc.evaluate(titlepath, doc, null, XPathResult.ANY_TYPE, null);
			var links = doc.evaluate(linkpath, doc, null, XPathResult.ANY_TYPE, null);
			var next_title;
			var next_link;
			while ((next_title = titles.iterateNext()) && (next_link = links.iterateNext())) {
				items[next_link.href] = next_title.textContent;
			}
			items = Zotero.selectItems(items);
			for (var i in items) {
				articles.push(i);
			}
		} else {
			articles = [url];
		}
		Zotero.Utilities.processDocuments(articles, function(doc2) {
			var item = new Zotero.Item("journalArticle");
			item.repository = "ScienceDirect";
			item.url = doc2.location.href;
			var title = doc2.title.match(/^[^-]+\-([^:]+):(.*)$/);
			item.title = Zotero.Utilities.trimInternal(title[2]);
			item.publicationTitle = Zotero.Utilities.trimInternal(title[1]);
			var voliss = Zotero.Utilities.trimInternal(doc2.evaluate(''//div[@class="pageText"][@id="sdBody"]/table/tbody/tr/td[1]'', doc2, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent).split(/,/);
			if (voliss[3] && voliss[3].match(/[\-\d]+/)) {
				item.volume = voliss[0].match(/\d+/)[0];
				item.issue = voliss[1].match(/[\-\d]+/)[0];
				item.date = Zotero.Utilities.trimInternal(voliss[2]);
				item.pages = voliss[3].match(/[R\-\d]+/)[0];
			} else if (voliss[2]) {
				item.volume = voliss[0].match(/\d+/)[0];
				item.date = Zotero.Utilities.trimInternal(voliss[1]);
				item.pages = voliss[2].match(/[R\-\d]+/)[0];
			}
			item.DOI = doc2.evaluate(''//div[@class="pageText"][@id="sdBody"]/a[contains(@href, "dx.doi")]'', doc2, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href.match(/dx\.doi\.org\/(.*)/)[1];
			var abspath = ''//div[@class="pageText"][@id="sdBody"]/div[@class="artAbs"]/p'';
			var absx = doc2.evaluate(abspath, doc2, nsResolver, XPathResult.ANY_TYPE, null);
			var ab;
			item.abstractNote = ""
			while (ab = absx.iterateNext()) {
				item.abstractNote += Zotero.Utilities.trimInternal(ab.textContent) + " ";
			}
			if (item.abstractNote.substr(0, 7) == "Summary") {
				item.abstractNote = item.abstractNote.substr(9);
			}
			var tagpath = ''//div[@class="pageText"][@id="sdBody"]/div[@class="art"]/p'';
			if (doc2.evaluate(tagpath, doc2, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				if (doc2.evaluate(tagpath, doc2, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(":")[1]) {
					var tags = doc2.evaluate(tagpath, doc2, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(":")[1].split(";");
					for (var i in tags) {
						item.tags.push(Zotero.Utilities.trimInternal(tags[i]));
					}
				}
			}
			item.attachments.push({url:doc2.location.href, title:"ScienceDirect Snapshot", mimeType:"text/html"});
			Zotero.Utilities.HTTP.doGet(item.url, function(text) {
				var aus = text.match(/<strong>\s+<p>.*<\/strong>/)[0].replace(/<sup>/g, "$").replace(/<\/sup>/g, "$");
				aus = aus.replace(/\$[^$]*\$/g, "");
				aus = aus.replace(/<a[^>]*>/g, "$").replace(/<\/a[^>]*>/g, "$");
				aus = aus.replace(/\$[^$]*\$/g, "");
				aus = Zotero.Utilities.cleanTags(aus);
				aus = aus.split(/(,|and)/);
				for (var a in aus) {
					if (aus[a] != "," && aus[a] != "and" && aus[a].match(/\w+/)) {
						item.creators.push(Zotero.Utilities.cleanAuthor(Zotero.Utilities.trimInternal(aus[a]), "author"));
					}
				}
				item.complete();
			});
		}, function() {Zotero.done;});
		Zotero.wait();
	}
}');

REPLACE INTO translators VALUES ('19643c25-a4b2-480d-91b7-4e0b761fb6ad', '1.0.0b3.r1', '', '2007-03-16 03:00:00', '1', '100', '4', 'ScientificCommons', 'Sean Takats', '^http://(?:en|de|www)\.scientificcommons\.org', 
'function detectWeb(doc, url) {
	var articleRe = /^http:\/\/(?:www|en|de)\.scientificcommons\.org\/([0-9]+)/;
	var m = articleRe.exec(url);

	if(m) {
		return "journalArticle";
	} else {
		var frontRe = /^http:\/\/(?:www|en|de)\.scientificcommons\.org\/$/;
		if(frontRe.test(url)) return "multiple";
		
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
			} : null;
		var listElt = doc.evaluate(''//div[@id="content_search_details"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if (listElt) return "multiple";
	}
	return false;
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
		} : null;

	var hostRe = new RegExp("^(http://[^/]+)/");
	var m = hostRe.exec(url);
	var host = m[1];

	var articleRe = /^http:\/\/(?:www|en|de)\.scientificcommons\.org\/([0-9]+)/;
	m = articleRe.exec(url);
	var uris = new Array();

	if(m) {
		var idElt = doc.evaluate(''//div[@id="publication_id"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if  (idElt) {
			uris.push(host + "/export/ris/" + idElt.textContent);
		} else {
			return false;
		}
	} else {
		var items = new Array();
		var listElts = doc.evaluate(''//div[@class="content_element"]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var id;
		var link;
		var title;
		while (listElt = listElts.iterateNext()) {
			id = doc.evaluate(''./@id'', listElt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			link = host + "/export/ris/" + id;
			title = doc.evaluate(''.//p[@class="title"]'', listElt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			items[link] = Zotero.Utilities.cleanString(title);
		} 

		items = Zotero.selectItems(items);
		if(!items) return true;

		for(var uri in items) {
			uris.push(uri);
		}
	}

	Zotero.Utilities.HTTP.doGet(uris, function(text) {
	// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			// add attachment support?
			item.complete();
		});
		translator.translate();
		Zotero.done();
	});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('d75381ee-7d8d-4a3b-a595-b9190a06f43f', '1.0.0b3.r1', '', '2007-04-05 19:45:00', '0', '100', '4', 'Scitation', 'Eugeniy Mikhailov', '^https?://(?:www\.)?scitation.aip.org', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var multids = doc.evaluate(''//tr/td/input[@type="checkbox" and @name="SelectCheck"]'',doc, nsResolver, XPathResult.ANY_TYPE, null);
	var singid = doc.evaluate(''//input[@type="hidden" and @name="SelectCheck"]'',doc, nsResolver, XPathResult.ANY_TYPE, null);

	if (multids.iterateNext()){
		return "multiple";
	} else if (singid.iterateNext()){
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var multids = doc.evaluate(''//tr/td/input[@type="checkbox" and @name="SelectCheck"]'',doc, nsResolver, XPathResult.ANY_TYPE, null);
	var singids = doc.evaluate(''//input[@type="hidden" and @name="SelectCheck"]'',doc, nsResolver, XPathResult.ANY_TYPE, null);
	var multid;
	var singid;
	var getstring = "/getabs/servlet/GetCitation?PrefType=ARTICLE&PrefAction=Add+Selected&fn=open_isi&source=scitation&downloadcitation=+Go+";
	if (multid = multids.iterateNext()){
		var titles = new Array();
		var ids = new Array();
		var items = new Array();
		var title;
		do {
			title = doc.evaluate(''../..//a[1]'',multid, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			items[multid.value] = Zotero.Utilities.cleanString(title.textContent);
		} while (multid =multids.iterateNext());
		
		items = Zotero.selectItems(items);
		if(!items) return true;

		for(var i in items) {
			getstring = getstring + "&SelectCheck=" + i;
		}
	} else if (singid = singids.iterateNext()){
		getstring = getstring + "&SelectCheck=" + singid.value;
	} 

	var hostRe = new RegExp("^(https?://[^/]+)/");
	var m = hostRe.exec(url);
	var host = m[1];
	var newuri = host + getstring;
	Zotero.Utilities.HTTP.doGet(newuri, function(text) {
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		Zotero.debug(text);
		translator.setString(text);
		translator.translate();

		Zotero.done();
    });
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('2c310a37-a4dd-48d2-82c9-bd29c53c1c76', '1.0.0b3.r1', '', '2008-04-02 08:10:00', '0', '100', '4', 'PROLA', 'Eugeniy Mikhailov and Michael Berkowitz', 'https?://(?:www\.)?prola.aps.org/(toc|searchabstract|abstract)/', 
'function detectWeb(doc, url) {
	if (url.indexOf("toc") != -1) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}	', 
'function doWeb(doc, url) {
    	var arts = new Array();
    	if (detectWeb(doc, url) == "multiple") {
	    	var items = Zotero.Utilities.getItemArray(doc, doc, "(abstract|abstractsearch)");
	    	items = Zotero.selectItems(items);
	    	for (var i in items) {
		    	arts.push(i);
	    	}
    	} else {
	    	arts = [url];
    	}
    	
    	Zotero.Utilities.processDocuments(arts, function(newDoc) {
    		Zotero.debug(newDoc.title);
    		var abs = Zotero.Utilities.trimInternal(newDoc.evaluate(''//div[@class="aps-abstractbox aps-mediumfont"]/p'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
    		var urlRIS = newDoc.location.href;
		// so far several more or less  identical url possible
		// one is with "abstract" other with "searchabstract"
		urlRIS = urlRIS.replace(/(searchabstract|abstract)/,"export");
		var post = "type=ris";
		var snapurl = newDoc.location.href;
		var pdfurl = snapurl.replace(/(searchabstract|abstract)/, "pdf");
		Zotero.Utilities.HTTP.doPost(urlRIS, post, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				if (item.itemID) {
					item.DOI = item.itemID;
				}
				item.attachments = [
					{url:snapurl, title:"PROLA Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:"PROLA Full Text PDF", mimeType:"application/pdf"}
				];
				item.abstractNote = abs;
				item.complete();
			});
			translator.translate();
		 });
	}, function() {Zotero.done;});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('cde4428-5434-437f-9cd9-2281d14dbf9', '1.0.0b3.r1', '', '2008-02-07 21:00:00', '1', '100', '4', 'Ovid', 'Simon Kornblith and Michael Berkowitz', '/(gw2|spa|spb)/ovidweb\.cgi', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var results = doc.evaluate(''//div[@class="bibheader-resultsrange"]/b'', doc, nsResolver,
		XPathResult.ANY_TYPE, null).iterateNext();
	
	if(results) {
		results = Zotero.Utilities.cleanString(results.textContent);
		
		if(results.indexOf("-") != -1) {
			return "multiple";
		} else {
			return "journalArticle";
		}
	}
	
	return false;
}', 
'function senCase(string) {
	var words = string.split(/\b/);
	for (var i = 0 ; i < words.length ; i++) {
		if (words[i].match(/[A-Z]/)) {
			words[i] = words[i][0] + words[i].substring(1).toLowerCase();
		} 
	}
	return words.join("");
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var results = Zotero.Utilities.cleanString(doc.evaluate(''//div[@class="bibheader-resultsrange"]/b'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	var post = "S="+doc.evaluate(''.//input[@name="S"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;

	if(results.indexOf("-") != -1) {
		var items = new Object();
		
		// Go through table rows
		if (doc.evaluate(''/html/body/form/div[substring(@class, 1, 10)="titles-row"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var tableRows = doc.evaluate(''/html/body/form/div[substring(@class, 1, 10)="titles-row"]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else if (doc.evaluate(''//div[@id="titles-records"]/table[@class="titles-row"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var tableRows = doc.evaluate(''//div[@id="titles-records"]/table[@class="titles-row"]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		var tableRow;
		while(tableRow = tableRows.iterateNext()) {
			var id = doc.evaluate(''.//input[@name="R"]'', tableRow, nsResolver, XPathResult.ANY_TYPE,
				null).iterateNext().value;
			items[id] = Zotero.Utilities.cleanString(doc.evaluate(''.//span[@class="titles-title"]'', tableRow,
				nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		}
		
		var items = Zotero.selectItems(items);
		if(!items) return true;
		
		for(var i in items) {
			post += "&R="+i;
		}
	} else {
		var id = doc.evaluate(''.//input[@name="R"]'', doc, nsResolver, XPathResult.ANY_TYPE,
			null).iterateNext().value;
		post += "&R="+id;
	}
	
	if (detectWeb(doc, url) == "multiple") {
		var selectvar = doc.evaluate(''.//input[@name="SELECT"]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var nextselect = selectvar.iterateNext();
		post += "&SELECT="+ selectvar.iterateNext().value;
	} else {
		post += "&SELECT=" + doc.evaluate(''.//input[@name="SELECT"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
	}
	post += "&CitMan="+doc.evaluate(''.//input[@name="CitMan"]'', doc, nsResolver, XPathResult.ANY_TYPE,
		null).iterateNext().value;
	post += "&CitManPrev="+doc.evaluate(''.//input[@name="CitManPrev"]'', doc, nsResolver, XPathResult.ANY_TYPE,
		null).iterateNext().value;
	post += "&cmRecordSelect=SELECTED&cmFields=ALL&cmFormat=export&cmsave.x=12&cmsave.y=7";
		
	Zotero.Utilities.HTTP.doPost(url, post, function(text) {
		var lines = text.split("\n");
		var haveStarted = false;
		var newItemRe = /^<[0-9]+>/;
		
		var newItem = new Zotero.Item("journalArticle");
		
		for(var i in lines) {
			if(lines[i].substring(0,3) == "<1>") {
				haveStarted = true;
			} else if(newItemRe.test(lines[i])) {
				newItem.complete();
				
				newItem = new Zotero.Item("journalArticle");
			} else if(lines[i].substr(2, 4) == "  - " && haveStarted) {
				var fieldCode = lines[i].substr(0, 2);
				var fieldContent = Zotero.Utilities.cleanString(lines[i].substr(6));
				
				if(fieldCode == "TI") {
					newItem.title = fieldContent.replace(/\. \[\w+\]$/, "");
				} else if(fieldCode == "AU") {
					var names = fieldContent.split(", ");
					
					if(names.length >= 2) {
						// get rid of the weird field codes
						if(names.length == 2) {
							names[1] = names[1].replace(/ [\+\*\S\[\]]+$/, "");
						}
						names[1] = names[1].replace(/ (?:MD|PhD|[BM]Sc|[BM]A|MPH|MB)$/i, "");
						
						newItem.creators.push({firstName:names[1], lastName:names[0], creatorType:"author"});
					} else {
						newItem.creators.push({lastName:names[0], isInstitution:true, creatorType:"author"});
					}
				} else if(fieldCode == "SO") {
					if (fieldContent.match(/\s+\w+\s+\d{4}/)) {
						newItem.date = fieldContent.match(/\w+\s+\d{4}/)[0];
					} else if (fieldContent.match(/\d{4}/)) {
						newItem.date = fieldContent.match(/\d{4}/)[0];
					}
					if (fieldContent.match(/(\d+)\((\d+)\)/)) {
						var voliss = fieldContent.match(/(\d+)\((\d+)\)/);
						newItem.volume = voliss[1];
						newItem.issue = voliss[2];
					}
					if (fieldContent.match(/\d+\-\d+/)[0])
						newItem.pages = fieldContent.match(/\d+\-\d+/)[0];
					if (fieldContent.match(/[J|j]ournal/)) {
						newItem.publicationTitle = fieldContent.match(/[J|j]ournal[-\s\w]+/)[0];
					} else {
						newItem.publicationTitle = Zotero.Utilities.trimInternal(fieldContent.split(/(\.|;)/)[0]);
					}
				} else if(fieldCode == "SB") {
					newItem.tags.push(Zotero.Utilities.superCleanString(fieldContent));
				} else if(fieldCode == "KW") {
					newItem.tags.push(fieldContent.split(/; +/));
				} else if(fieldCode == "DB") {
					newItem.repository = "Ovid ("+fieldContent+")";
				} else if(fieldCode == "DI") {
					newItem.DOI = fieldContent;
				} else if(fieldCode == "AB") {
					newItem.abstractNote = fieldContent;
				}
			}
		}
		
		// last item is complete
		if(haveStarted) {
			newItem.complete();
		}
	});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('cb48083-4d9-4ed-ac95-2e93dceea0ec', '1.0.0b3.r1', '', '2008-03-06 23:15:00', '1', '100', '4', 'Blackwell Synergy', 'Michael Berkowitz', 'https?://www\.blackwell-synergy\.com[^/]*/(?:action/doSearch|doi/|links/doi/)', 
'function detectWeb(doc, url) {
	if(url.indexOf("doSearch") != -1) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var rows = doc.evaluate(''//div[@class="toc_item"]'', doc, null, XPathResult.ANY_TYPE, null);
		var row;
		while (row = rows.iterateNext()) {
			var title = Zotero.Utilities.trimInternal(doc.evaluate(''.//label'', row, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var id = doc.evaluate(''.//input[@name="doi"]'', row, null, XPathResult.ANY_TYPE, null).iterateNext().value;
			items[id] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url.match(/doi\/[^/]+\/([^\?]+)(\?|$)/)[1]];
	}
	
	var post = "";
	for each (var doi in articles) {
		post += "doi=" + encodeURIComponent(doi) + "&"
	}
	post += "include=abs&format=refman&submit=Download+references";
	Zotero.debug(post);
	Zotero.Utilities.HTTP.doPost(''http://www.blackwell-synergy.com/action/downloadCitation'', post, function(text) {
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) { 
			item.attachments = [
				{url:item.url, title:"Blackwell Synergy Snapshot", mimeType:"text/html"},
				{url:item.url.replace("/doi/abs", "/doi/pdf"), title:"Blackwell Synergy Full Text PDF", mimeType:"application/pdf"}
			];
			// use fulltext if possible
			var oldCreators = item.creators;
			item.creators = []
			Zotero.debug(oldCreators);
			for each (var author in oldCreators) {
				if (author["lastName"] != "") {
					item.creators.push(author);
				}
			}
			item.complete();
		});
		translator.translate();
		
		Zotero.done();
	});
}');

REPLACE INTO translators VALUES ('df966c80-c199-4329-ab02-fa410c8eb6dc', '1.0.0b3.r1', '', '2008-01-23 20:00:00', '1', '100', '4', 'University of Chicago', 'Sean Takats', 'https?://[^/]*journals\.uchicago\.edu[^/]*/(?:doi/abs|doi/full|toc)', 
'function detectWeb(doc, url) {
	if(url.indexOf("toc") != -1) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var post = "";
	
	var fulltext = new Object();
	
	if(url.indexOf("toc") != -1) {
		var items = new Array();
		var links = new Array();
		
		var tableRows = doc.evaluate(''//li[div[@class="articleListing_col3"]/label][//input[@name="doi"]]'', doc,
			nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		// Go through table rows
		while(tableRow = tableRows.iterateNext()) {
			var id = doc.evaluate(''.//input[@name="doi"]'', tableRow, nsResolver, XPathResult.ANY_TYPE,
				null).iterateNext().value;
			items[id] = Zotero.Utilities.trimInternal(doc.evaluate(''.//label'', tableRow,
				nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		}
		
		var items = Zotero.selectItems(items);
		if(!items) return true;
		
		// find all fulltext links so we can determine where we can scrape the fulltext article
		var fulltextLinks = doc.evaluate(''//a[starts-with(text(), "Full Text")]'', doc,
			nsResolver, XPathResult.ANY_TYPE, null);
		var fulltextLink;
		while(fulltextLink = fulltextLinks.iterateNext()) {
			links.push(fulltextLink.href.toString());
		}
		
		for(var i in items) {
			post += "doi="+encodeURIComponent(i)+"&";
			
			// check for fulltext links
			for each(var link in links) {
				if(link.indexOf(i) != -1) {
					fulltext[i] = true;
					break;
				}
			}
		}
	} else {
		var m = url.match(/https?:\/\/[^\/]+\/doi\/[^\/]+\/([^\?]+)(\?|$)/);
		if (m) {
			var doi = m[1];
		} else {
			m = url.match(/https?:\/\/[^\/]+\/links\/doi\/([^\?]+)(\?|$)/);
			var doi = m[1];
		}
		post += "doi="+encodeURIComponent(doi)+"&";
		
		if(url.indexOf("doi/full") != -1 ||
		  doc.evaluate(''//img[@alt="Full Text Article"]'', doc, nsResolver, XPathResult.ANY_TYPE,
		  null).iterateNext()) {
			fulltext[doi] = true;
		}
	}
	
	post += "include=cit&downloadFileName=deadbeef&format=refman&direct=on&submit=Download+article+citation+data";
	
	Zotero.Utilities.HTTP.doPost("http://www.journals.uchicago.edu/action/downloadCitation", post, function(text) {
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			item.attachments = [
				{url:item.url, title:"University of Chicago Journals Snapshot", mimeType:"text/html"},
				{url:item.url.replace("/doi/abs", "/doi/pdf"), title:"University of Chicago Full Text PDF", mimeType:"application/pdf"}
			];
			// use fulltext if possible
			if(fulltext[item.DOI.substr(4)]) {
				item.attachments[0].url = item.attachments[0].url.replace("/doi/abs", "/doi/full");
			}
			
			item.complete();
		});
		translator.translate();
		
		Zotero.done();
	});
		
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('f8765470-5ace-4a31-b4bd-4327b960ccd', '1.0.0b3.r1', '', '2008-04-02 17:00:00', '1', '100', '4', 'SpringerLink', 'Simon Kornblith and Michael Berkowitz', 'https?://(www\.)*springerlink\.com|springerlink.metapress.com[^/]*/content/', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	if((doc.title == "SpringerLink - All Search Results") || (doc.title == "SpringerLink - Journal Issue")) {
		return "multiple";
	} else if(doc.title == "SpringerLink - Book Chapter") {
		return "bookSection";
	} else if (doc.title == "SpringerLink - Book") {
		return "book";
	} else if (doc.title == "SpringerLink - Journal Article") {
		return "journalArticle";
	} else if(doc.evaluate(''//a[text() = "RIS"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var m = url.match(/https?:\/\/[^\/]+/);
	var host = m[0];
	
	if(detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.title == "SpringerLink - Journal Issue") {
			var items = Zotero.Utilities.getItemArray(doc, doc.getElementsByTagName("table")[8], ''/content/[^/]+/\\?p=[^&]+&pi='');
		} else {
			var results = doc.evaluate(''//div[@class="listItemName"]/a'', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var result;
			while (result = results.iterateNext()) {
				items[result.href] = Zotero.Utilities.trimInternal(result.textContent);
			}
		}
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var urls = new Array();
		for(var url in items) {
			urls.push(url);
		}
	} else {
		var urls = [url];
	}
	
	var RIS = new Array();
	
	for each(var item in urls) {
		var m = item.match(/\/content\/([^/]+)/);
		RIS.push(host+"/export.mpx?code="+m[1]+"&mode=ris");
	}
	Zotero.Utilities.HTTP.doGet(RIS, function(text) {
		// load translator for RIS
		text = text.replace("CHAPTER", "CHAP");
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			var url = urls.shift();
			var m = url.match(/https?:\/\/[^\/]+\/content\/[^\/]+\/?/);
			item.attachments = [
				{url:url, title:"SpringerLink Snapshot", mimeType:"text/html"},
				{url:m[0]+"fulltext.pdf", title:"SpringerLink Full Text PDF", mimeType:"application/pdf"}
			];
			
			var oldCreators = item.creators;
			item.creators = new Array();
			for each (var creator in oldCreators) {
				if (creator[''lastName''] + creator[''firstName''] != "") {
					item.creators.push({firstName:Zotero.Utilities.trimInternal(creator[''firstName'']), lastName:creator[''lastName''], creatorType:"author"});
				}
			}
			
			// fix incorrect chapters
			if(item.publicationTitle && item.itemType == "book") item.title = item.publicationTitle;
			
			// fix "V" in volume
			if(item.volume) {
				item.volume = item.volume.replace("V", "");
			}
			item.complete();
		});
		translator.translate();
	}, function() { Zotero.done() });
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('6614a99-479a-4524-8e30-686e4d66663e', '1.0.0b3.r1', '', '2008-03-26 03:00:00', '1', '100', '4', 'Nature', 'Simon Kornblith', 'https?://www\.nature\.com[^/]*/(?:[^/]+/journal/v[^/]+/n[^/]+/(?:(?:full|abs)/.+\.html|index.html)|search/executeSearch)', 
'function detectWeb(doc, url) {
	var articleRe = /(https?:\/\/[^\/]+\/[^\/]+\/journal\/v[^\/]+\/n[^\/]+\/)(full|abs)(\/.+\.)html/;
	
	if (articleRe.test(url)) {
		if (doc.evaluate(''//a[contains(@href, ".ris")]'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			return "journalArticle";
		} else { return false; }
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == ''x'') return namespace; else return null;
		} : null;
		
		var tableRows = doc.evaluate(''//*[@class="atl"] | //*[@class="articletitle"] | //h4[@class="norm"]'',
			doc, nsResolver, XPathResult.ANY_TYPE, null);
		var fulltextLinks = doc.evaluate(''//a[text() = "Full Text"] | //a[text() = "Full text"] | //a[text() = "Full Text "]'',
			doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		if(tableRows.iterateNext() && fulltextLinks.iterateNext()) {
			return "multiple";
		}
	}
	
	return false;
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var articleRe = /(https?:\/\/[^\/]+\/[^\/]+\/journal\/v[^\/]+\/n[^\/]+\/)(full|abs)(\/.+)\.html/;
	var m = articleRe.exec(url);
	
	if(!m) {
		// search page
		var items = new Array();
		
		var tableRows = doc.evaluate(''//*[@class="atl"] | //*[@class="articletitle"] | //h4[@class="norm"]'',
			doc, nsResolver, XPathResult.ANY_TYPE, null);
		var fulltextLinks = doc.evaluate(''//a[text() = "Full Text"] | //a[text() = "Full text"] | //a[text() = "Full Text "]'',
			doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow, fulltextLink;
		while((tableRow = tableRows.iterateNext()) && (fulltextLink = fulltextLinks.iterateNext())) {
			items[fulltextLink.href] = Zotero.Utilities.cleanString(tableRow.textContent);
		}
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var urls = new Array();
		for(var url in items) {
			urls.push(url);
		}
	} else {
		var urls = [url];
	}
	
	var RIS = new Array();
	var regexps = new Array();
	
	for each(var item in urls) {
		var m = articleRe.exec(item);
		if(m[3][m[3].length-2] == "_") {
			m[3] = m[3].substr(0, m[3].length-2);
		}
		RIS.push(m[1]+"ris"+m[3]+".ris");
		regexps.push(m);
	}
	
	Zotero.Utilities.HTTP.doGet(RIS, function(text) {
		var url = urls.shift();
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			var m = regexps.shift();
			item.attachments = [
				{url:m[0], title:"Nature Snapshot", mimeType:"text/html"},
				{url:m[1]+"pdf"+m[3]+".pdf", title:"Nature Full Text PDF", mimeType:"application/pdf"}
			]
			
			item.notes = new Array();
			if (item.date) item.date = item.date.replace("print ", "");
			
			item.complete();
		});
		translator.translate();
	}, function() { Zotero.done(); });
		
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('92d4ed84-8d0-4d3c-941f-d4b9124cfbb', '1.0.0b3.r1', '', '2008-02-27 15:00:00', '1', '100', '4', 'IEEE Xplore', 'Simon Kornblith and Michael Berkowitz', 'https?://[^/]*ieeexplore.ieee.org[^/]*/(?:[^\?]+\?(?:|.*&)arnumber=[0-9]+|search/(?:searchresult.jsp|selected.jsp))', 
'function detectWeb(doc, url) {
	var articleRe = /[?&]arnumber=([0-9]+)/;
	var m = articleRe.exec(url);
	
	if(m) {
		return "journalArticle";
	} else {
		return "multiple";
	}
	
	return false;
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var articleRe = /[?&]arnumber=([0-9]+)/;
	var m = articleRe.exec(url);
	
	if(!m) {
		// search page
		var items = new Array();
		
		var tableRows = doc.evaluate(''//table[tbody/tr/td/div/strong]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		while(tableRow = tableRows.iterateNext()) {
			var link = doc.evaluate(''.//a[@class="bodyCopy"]'', tableRow, nsResolver, XPathResult.ANY_TYPE,
				null).iterateNext().href;
			
			var title = "";
			var strongs = tableRow.getElementsByTagName("strong");
			for each(var strong in strongs) {
				if(strong.textContent) {
					title += strong.textContent+" ";
				}
			}
			
			items[link] = Zotero.Utilities.cleanString(title);
		}
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var urls = new Array();
		for(var url in items) {
			urls.push(url);
		}
	} else {
		var urls = [url];
	}
	var arnumber = "";
	for each(var url in urls) {
		var m = articleRe.exec(url);
		arnumber = "%3Carnumber%3E"+m[1]+"%3C%2Farnumber%3E";
		var post = "dlSelect=cite_abs&fileFormate=ris&arnumber="+arnumber+"&x=5&y=10";
		var isRe = /[?&]isnumber=([0-9]+)/;
		var puRe = /[?&]punumber=([0-9]+)/;
		Zotero.Utilities.HTTP.doPost("http://ieeexplore.ieee.org/xpls/citationAct", post, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				var url = urls.shift();
				var is = isRe.exec(url);
				var pu = puRe.exec(url);
				var arnumber = articleRe.exec(url);
				if(item.notes[0] && item.notes[0].note) {
					item.abstractNote = item.notes[0].note;
					item.notes = new Array();
				}
				var dupes = new Array();
				for (var i = 0 ; i < item.creators.length - 1 ; i++) {
					if (item.creators[i].lastName + item.creators[i].firstName == item.creators[i+1].lastName + item.creators[i].firstName) {
						dupes.push(i + 1);
					}
				}
				
				for (var i in dupes) {
					delete item.creators[dupes[i]];
				}
				var dupes = [];
				for (var i = 0 ; i < item.creators.length ; i++) {
					if (item.creators[i]) {
						dupes.push(item.creators[i]);
					}
				}
				item.creators = dupes;
				var newurls = [url];
				Zotero.Utilities.processDocuments(newurls, function(newDoc) {
					var xpath = ''//p[@class="bodyCopyBlackLargeSpaced"]'';
					var textElmt = newDoc.evaluate(xpath, newDoc, namespace, XPathResult.ANY_TYPE, null).iterateNext();
					if (textElmt) {
						var m = textElmt.textContent.match(/Identifier:\s+([^\n]*)\n/);
						if (m){
							item.DOI = m[1];
						}
					}
					var pdfpath = ''//td[2][@class="bodyCopyBlackLarge"]/a[@class="bodyCopy"][substring(text(), 1, 3) = "PDF"]'';
					var pdfurlElmt = newDoc.evaluate(pdfpath, newDoc, namespace, XPathResult.ANY_TYPE, null).iterateNext();
					if (pdfurlElmt) {
						item.attachments = [{url:pdfurlElmt.href, title:"IEEE Xplore Full Text PDF", mimeType:"application/pdf"}];
					}
					item.complete();
				}, function() {Zotero.done;});
			});
			translator.translate();
		});
	}
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('7bdb79e-a47f-4e3d-b317-ccd5a0a74456', '1.0.0b3.r1', '', '2007-03-24 22:20:00', '1', '100', '4', 'Factiva', 'Simon Kornblith', '^https?://global\.factiva\.com[^/]*/ha/default\.aspx$', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	if(doc.evaluate(''//tr[@class="headline"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		if(doc.body.className == ''articleView'') {
			return "newspaperArticle";
		} else {
			return "multiple";
		}
	}
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var items = new Array();
	var singlePage = doc.body.className == ''articleView'';
	
	var tableRows = doc.evaluate(''//tr[@class="headline"]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var tableRow;
	while(tableRow = tableRows.iterateNext()) {
		var hdl = doc.evaluate(''.//input[@name="hdl"]'', tableRow, nsResolver, XPathResult.ANY_TYPE,
			null).iterateNext().value;
		if(!singlePage){
			items[hdl] = Zotero.Utilities.cleanString(tableRow.getElementsByTagName("a")[0].textContent);
		} else {
			var m = doc.evaluate(''.//td[@class="count"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, 
				null).iterateNext().textContent.match(/[0-9]+/);
			items[m[0]] = hdl;
		}
	}
	
	if(!singlePage) {
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var hdls = new Array();
		for(var hdl in items) {
			hdls.push(hdl);
		}
	} else {
		var m = doc.evaluate(''//div[@class="articleHeader"][@id="artHdr1"]/span[substring(text(), 1, 7) = "Article"]'',
			doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/[0-9]+/);
		var hdls = [items[m[0]]];
	}
	
	var post = "";
	
	var hiddenInputs = doc.evaluate(''//form[@name="PageBaseForm"]//input[@type="hidden"]'', doc, nsResolver,
		XPathResult.ANY_TYPE, null);
	var hiddenInput;
	while(hiddenInput = hiddenInputs.iterateNext()) {
		// this is some weird shit, but apparently they''re very picky
		post = post+"&"+hiddenInput.name+"="+escape(hiddenInput.value).replace(/\+/g, "%2B").replace(/\%20/g, "+");
	}
	
	var selects = doc.evaluate(''//form[@name="PageBaseForm"]//select'', doc, nsResolver,
		XPathResult.ANY_TYPE, null);
	var select;
	while(select = selects.iterateNext()) {
		post = post+"&"+select.name+"="+escape(select.options[select.selectedIndex].value);
	}
	
	for each(var hdl in hdls) {
		post += "&hdl="+escape(hdl);
	}
	post = post.substr(1);
	
	Zotero.Utilities.HTTP.doPost("http://global.factiva.com/pps/default.aspx?pp=XML", post, function(text) {
		// Remove xml parse instruction and doctype
		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");
		// kill the XML namespace, too, because we have no way of knowing what it will be, which presents a problem
		text = text.replace(/<ppsArticleResponse xmlns="[^"]+">/, "<ppsArticleResponse>");
		// kill hlt tags; they just make parsing harder
		text = text.replace(/<\/?hlt>/g, "");
		var xml = new XML(text);
		
		// loop through articles
		for each(var ppsarticle in xml[0]..ppsarticle) {
			var article = ppsarticle.article;
			var newItem = new Zotero.Item("newspaperArticle");
			
			newItem.title = Zotero.Utilities.cleanString(article.headline.paragraph.text().toString());
			newItem.publicationTitle = Zotero.Utilities.cleanString(article.sourceName.text().toString());
			for each(var tag in article..name) {
				newItem.tags.push(tag.text().toString());
			}
			newItem.date = Zotero.Utilities.formatDate(Zotero.Utilities.strToDate(article.publicationDate.date.text().toString()));
			if(article.byline.length()) {
				var byline = Zotero.Utilities.cleanString(article.byline.text().toString().replace(/By/i, ""));
				var authors = byline.split(/ (?:\&|and) /i);
				for each(var author in authors) {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
				}
			}
			newItem.section = article.sectionName.text().toString();
			newItem.edition = article.edition.text().toString();
			
			if(article.pages.length()) {
				newItem.pages = "";
				for each(var page in article.pages.page) {
					newItem.pages += ","+page.text().toString();
				}
				newItem.pages = newItem.pages.substr(1);
			}
			
			var m = article.volume.text().toString().match(/ISSN[:\s]*([\-0-9]{8,9})/i);
			if(m) newItem.ISSN = m[1];
			
			newItem.complete();
		}
		
		Zotero.done();
	});
		
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('850f4c5f-71fb-4669-b7da-7fb7a95500ef', '1.0.0b3r1', '', '2008-03-18 02:30:00', '1', '100', '4', 'Cambridge Journals Online', 'Sean Takats', 'https?://[^/]*journals.cambridge.org[^/]*//?action/(quickSearch|search|displayAbstract|displayFulltext|displayIssue)', 
'function detectWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var xpath = ''//tr[td/input[@type="checkbox"][@name="toView"]]'';
	if ((url.indexOf("/action/displayAbstract") != -1) || (url.indexOf("action/displayFulltext") != -1)){
		return "journalArticle";
	} else if (doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";			
	}
}', 
'function doWeb(doc, url){
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var urlstring="http://journals.cambridge.org/action/exportCitation";
	var datastring="format=RIS&emailId=&Download=Download&componentIds=";
	var xpath = ''//tr[td/input[@type="checkbox"][@name="toView"]]'';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var tableRows = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		var items=new Array();
		while (tableRow = tableRows.iterateNext()){
			var id = doc.evaluate(''./td/input[@type="checkbox"][@name="toView"]/@value'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			var title = doc.evaluate(''./td/h3'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			items[id.nodeValue]=Zotero.Utilities.trimInternal(title.textContent);	
		}
		items=Zotero.selectItems(items);
		for(var id in items)
			Zotero.Utilities.HTTP.doPost(urlstring, datastring+id, function(text)	{
				var trans=Zotero.loadTranslator("import");
				trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				trans.setString(text);
				trans.setHandler("itemDone", function(obj, newItem){
					var pdfpath=''//tr[td/input/@value="''+id+''"]/td/ul/li/a[contains(text(), "PDF")]'';
					var pdflink=doc.evaluate(pdfpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					if (pdflink){
						newItem.attachments.push({url:pdflink.href, title:newItem.title, mimeType:"application/pdf"});
					}
					newItem.complete();
				});
				trans.translate();
				Zotero.done();
			});
	}
	xpath = ''//div[@id="close"]/a[text()="close"]'';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
		var pdfpath=''//div/ul/li/a[contains(text(), "PDF")]'';
		var pdflink =doc.evaluate(pdfpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()
		Zotero.debug(url);
		idRe = /aid=([0-9]+)/
		var m = idRe.exec(url);
		var id = m[1];
		Zotero.Utilities.HTTP.doPost(urlstring, datastring+id, function(text)	{
			var trans=Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(text);
			trans.setHandler("itemDone", function(obj, newItem){
				if (pdflink){
					newItem.attachments.push({url:pdflink.href, title:newItem.title, mimeType:"application/pdf"});
				}
				newItem.complete();
			});
			trans.translate();
			Zotero.done();
		});
	}
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('82174f4f-8c13-403b-99b2-affc7bc7769b', '1.0.0b3.r1', '', '2008-03-20 20:00:00', '1', '100', '4', 'Cambridge Scientific Abstracts', 'Simon Kornblith and Michael Berkowitz', 'https?://[^/]+/ids70/(?:results.php|view_record.php)', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	if(url.indexOf("/results.php") != -1) {
		var type = doc.evaluate(''//td[@class="rt_tab_on"]'', doc, nsResolver, XPathResult.ANY_TYPE,
			null).iterateNext().textContent;
		
		if(type.substr(0, 15) == "Published Works") {
			return "multiple";
		}
	} else {
		// default to journal
		var itemType = "journalArticle";
		
		var type = doc.evaluate(''//tr[td[1][@class="data_heading"]/text() = "Publication Type"]/td[3]'',
			doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if(type) {
			type = Zotero.Utilities.cleanString(type.textContent);
			if(type == "Book Chapter") {
				return "bookSection";
			} else if(type.substr(0, 4) == "Book") {
				return "book";
			} else if(type.substr(0, 12) == "Dissertation") {
				return "thesis";
			} else if(type == "Catalog") {
				return "magazineArticle";
			}
		}
		return "journalArticle";
	}
	
	return false;
}', 
'function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var itemType = "journalArticle";
	
	var type = doc.evaluate(''//tr[td[1][@class="data_heading"]/text() = "Publication Type"]/td[3]'',
		doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(type) {
		type = Zotero.Utilities.trimInternal(type.textContent);
		if(type == "Book Chapter") {
			itemType = "bookSection";
		} else if(type.substr(0, 4) == "Book") {
			itemType = "book";
		} else if(type.substr(0, 12) == "Dissertation") {
			itemType = "thesis";
		} else if(type == "Catalog") {
			itemType = "magazineArticle";
		}
	}
	
	var newItem = new Zotero.Item(itemType);
	
	newItem.attachments = [{document:doc, title:"Cambridge Scientific Abstracts Snapshot"}];
	newItem.title = Zotero.Utilities.trimInternal(doc.evaluate(''//tr/td[3][@class="data_emphasis"]'', doc, nsResolver,
		XPathResult.ANY_TYPE, null).iterateNext().textContent);
	
	var dataRows = doc.evaluate(''//tr[td[3][@class="data_content"]]'', doc, nsResolver,
		XPathResult.ANY_TYPE, null);
	var dataRow;
	while(dataRow = dataRows.iterateNext()) {
		var tds = dataRow.getElementsByTagName("td");
		var heading = Zotero.Utilities.trimInternal(tds[0].textContent).toLowerCase();
		var content = Zotero.Utilities.trimInternal(tds[2].textContent);
		if(heading == "database") {
			newItem.repository = "Cambridge Scientific Abstracts ("+content+")";
		} else if(heading == "author") {
			var authors = content.split("; ");
			for each(var author in authors) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author", true));
			}
		} else if(heading == "source") {
			if(itemType == "journalArticle") {
				var parts = content.split(/(,|;)/);
				newItem.publicationTitle = parts.shift();
				Zotero.debug(parts);
				for each (var i in parts) {
					if (i.match(/\d+/)) {
						Zotero.debug(i);
						if (i.match(/v(ol)?/)) {
							newItem.volume = i.match(/\d+/)[0];
						} else if (i.match(/pp/)) {
							newItem.pages = i.match(/[\d\-]+/)[0];
						} else if (i.match(/no?/)) {
							newItem.issue = i.match(/\d+/)[0];
						} else if (i.match(/\d{4}/)) {
							newItem.date = Zotero.Utilities.trimInternal(i);
						}
					}
				}
			} else if(itemType == "book") {
				var m = content.match(/^([^:]+): ([^,0-9]+)/);
				if(m) {
					newItem.place = m[1];
					newItem.publisher = m[2];
				}
			} else if(itemType == "bookSection") {
				if(content.length > newItem.publicationTitle.length
				   && content.substr(0, newItem.publicationTitle.length) == newItem.publicationTitle) {
					var m = content.match(/\)\. ([^:]+): ([^,0-9]+)/);
					if(m) {
						newItem.place = m[1];
						newItem.publisher = m[2];
					}
					var m = content.match(/\(pp. ([\-0-9]+)\)/);
					if(m) newItem.pages = m[1];
				}
			}
		} else if(heading == "monograph title") {
			newItem.publicationTitle = content;
		} else if(heading == "series title") {
			newItem.series = content;
		} else if(heading == "issn") {
			newItem.ISSN = content;
		} else if(heading == "isbn") {
			newItem.ISBN = content;
		} else if(heading == "abstract") {
			newItem.abstractNote = content;
		} else if(heading == "notes") {
			newItem.extra = content;
		} else if(heading == "publication year") {
			if(!newItem.date) newItem.date = content;
		} else if(heading == "information provider") {
			if(content.substr(0, 19) == "http://dx.doi.org/") {
				newItem.DOI = content.substr(19);
			}
		} else if(heading == "journal volume") {
			newItem.volume = content;
		} else if(heading == "journal pages") {
			newItem.pages = content;
		} else if(heading == "journal issue") {
			newItem.issue = content;
		} else if(heading == "affiliation") {
			if(newItem.itemType == "thesis") {
				newItem.publisher = content;
			}
		}
	}
	
	var terms = doc.evaluate(''//input[substring(@name, 1, 4) = "term"]'', doc, nsResolver,
		XPathResult.ANY_TYPE, null);
	var term;
	while(term = terms.iterateNext()) {
		newItem.tags.push(term.value.replace(/ [0-9]{3,}$/, ""));
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	if(url.indexOf("/results.php") != -1) {
		var items = Zotero.Utilities.getItemArray(doc, doc, ''/view_record\.php\?'', ''^(?:View Record|More\.{3})$'');
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var urls = new Array();
		for(var url in items) {
			urls.push(url);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done() })
		Zotero.wait();
	} else {
		scrape(doc);
	}
}');

REPLACE INTO translators VALUES ('e78d20f7-488-4023-831-dfe39679f3f', '1.0.0b3.r1', '', '2008-03-04 20:00:00', '1', '100', '4', 'ACM', 'Simon Kornblith', 'https?://[^/]*portal\.acm\.org[^/]*/(?:results\.cfm|citation\.cfm)', 
'function detectWeb(doc, url) {
	if(url.indexOf("/results.cfm") != -1) {
		var items = Zotero.Utilities.getItemArray(doc, doc, ''^https?://[^/]+/citation.cfm\\?[^#]+$'');
		// hack to return multiple if there are items
		for(var i in items) {
			return "multiple";
		}
	} else {
		var onClick = doc.evaluate(''//a[substring(text(), 5, 7) = "EndNote"]'', doc, null, XPathResult.ANY_TYPE,
			null).iterateNext().getAttribute("onClick");
		if(onClick.match("proceeding.article")) {
			return "conferencePaper";
		} else {
			return "journalArticle";
		}
	}
}', 
'var urls = new Array();

// this handles sequential loading, since first we need to process a document (to get the abstract), then
// get the Refer metadata, then process the next document, etc.
function getNext() {
	if(urls.length) {
		var url = urls.shift();
		Zotero.Utilities.processDocuments([url], function(doc) { scrape(doc); });
	} else {
		Zotero.done();
	}
}

function scrape(doc) {
	var onClick = doc.evaluate(''//a[substring(text(), 5, 7) = "EndNote"]'', doc, null, XPathResult.ANY_TYPE,
		null).iterateNext().getAttribute("onClick");
	var m = onClick.match(/''([^'']+)''/);
	
	var abstract = doc.evaluate(''//div[@class="abstract"]/p[@class="abstract"]'', doc, null,
		XPathResult.ANY_TYPE, null).iterateNext();
	if(abstract) abstract = Zotero.Utilities.cleanString(abstract.textContent);
	
	var snapshot = doc.location.href;
	
	var attachments = new Array();
	var url;
	var typeLinks = doc.evaluate(''//td[@class="smaller-text"]/a[img]'', doc, null,
		XPathResult.ANY_TYPE, null);
	var typeLink;
	while(typeLink = typeLinks.iterateNext()) {
		var linkText = typeLink.textContent.toLowerCase();
		if(linkText == "pdf") {
			attachments.push({title:"ACM Full Text PDF", mimeType:"application/pdf", url:typeLink.href});
			url = typeLink.href;
		} else if(linkText == "html") {
			url = snapshot = typeLink.href;
		}
	}
	
	attachments.push({title:"ACM Snapshot", mimeType:"text/html", url:snapshot});

	var keywords = new Array();
	var keywordLinks = doc.evaluate(''//p[@class="keywords"]/a'', doc, null,
		XPathResult.ANY_TYPE, null);
	var keywordLink;
	while(keywordLink = keywordLinks.iterateNext()) {
		keywords.push(Zotero.Utilities.trimInternal(keywordLink.textContent.toLowerCase()));
	}
	var doi = "";
	var doiElmt = doc.evaluate(''/html/body/div/table/tbody/tr[4]/td/table/tbody/tr/td/table/tbody/tr[3]/td[2][@class="small-text"]/a'', doc, null, XPathResult.ANY_TYPE, null).iterateNext()
	if (doiElmt){
		var match = doiElmt.textContent.match(/org\/(.*)/);
		if (match){
			doi = match[1];
		}
	}
	
	Zotero.Utilities.HTTP.doGet("http://portal.acm.org/"+m[1], function(text) {
		// split() may no longer be necessary
		var m = text.split(/<\/?pre[^>]*>/ig);
		if (m[1]) {
			var text = m[1];
		}
   		// unescape HTML for extended characters
		function unescapeHTML(str, p1){
			return Zotero.Utilities.unescapeHTML("&#"+p1);
		}
   		text = text.replace(/\\&\\#([^;]+;)/g, unescapeHTML);  
		// load Refer translator
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("881f60f2-0802-411a-9228-ce5f47b64c7d");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			if(abstract) item.abstractNote = abstract;
			item.attachments = attachments;
			item.tags = keywords;
			item.DOI = doi;
			item.url = doc.location.href;
			item.complete();
		});
		translator.translate();
		
		getNext();
	});
}

function doWeb(doc, url) {
	if(url.indexOf("/results.cfm") != -1) {
		var items = Zotero.Utilities.getItemArray(doc, doc, ''^https?://[^/]+/citation.cfm\\?[^#]+$'');
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		for(var url in items) {
			urls.push(url);
		}
		
		getNext();
	} else {
		scrape(doc);
	}
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('594ebe3c-90a0-4830-83bc-9502825a6810', '1.0.0b4.r5', '', '2008-03-21 15:30:00', '1', '100', '4', 'ISI Web of Knowledge', 'Michael Berkowitz', '(WOS_GeneralSearch|product=WOS)', 
'function detectWeb(doc, url) {
	if (doc.title.indexOf("Web of Science Results") != -1) {
		return "multiple";
	} else if (url.indexOf("full_record.do") != -1) {
		return "journalArticle";
	}
}', 
'function doWeb(doc, url) {
	var ids = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object;
		var xpath = ''//a[@class="smallV110"]'';
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_title = titles.iterateNext();
		while (next_title) {
			var id = doc.evaluate(''.//@onclick'', next_title, null, XPathResult.ANY_TYPE, null).iterateNext().value.match(/\?([^'']+)''/)[1];
			items[id] = next_title.textContent;
			next_title = titles.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			ids.push(i);
		} 
	} else {
		ids.push(url.match(/\?(.*)/)[1]);
	}
	var hostRegexp = new RegExp("^(https?://[^/]+)/");
	var m = hostRegexp.exec(url);
	var host = m[1];
	for (var i in ids) {
		ids[i] = host+"/full_record.do?" + ids[i];
	}
	Zotero.Utilities.processDocuments(ids, function(newDoc) {
		var url = newDoc.location.href;
		var sid = newDoc.evaluate(''//input[@name="selectedIds"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().value;
		var nid = newDoc.evaluate(''//input[@name="SID"]'', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().value;
		var post2 = ''product=WOS&product_sid='' + nid + ''&plugin=&product_st_thomas=http://esti.isiknowledge.com:8360/esti/xrpc&export_ref.x=0&export_ref.y=0'';
		var post = ''action=go&mode=quickOutput&product=WOS&SID='' + nid + ''&format=ref&fields=BibAbs&mark_id=WOS&count_new_items_marked=0&selectedIds='' + sid + ''&qo_fields=bib&endnote.x=95&endnote.y=12&save_options=default'';
		Zotero.Utilities.HTTP.doPost(''http://apps.isiknowledge.com/OutboundService.do'', post, function() {
			Zotero.Utilities.HTTP.doPost(''http://pcs.isiknowledge.com/uml/uml_view.cgi'', post2, function(text) {
				var lines = text.split("\n");
				var field = " ";
				var content = " ";
				var item = new Zotero.Item("journalArticle");
				item.url = url;
				var authors;
				var fieldRe = /^[A-Z0-9]{2}(?: |$)/;
				
				for each(var line in lines) {
					if(line.match(fieldRe)) {
						field = line.match(fieldRe)[0].substr(0,2);
						content = line.substr(3);
						if ((field == "AF" || field == "AU")) {
							if (!item.creators[0]) {
								var author = content.split(",");
								item.creators.push({firstName:author[1], lastName:author[0], creatorType:"author"});
							} else {
								field = "";
							}
						} else if (field == "TI") {
							item.title = content;
						} else if (field == "SO") {
							item.publicationTitle = content;
						} else if (field == "SN") {
							item.ISSN = content;
						} else if (field == "PD" || field == "PY") {
							if (item.date) {
								item.date += " " + content;
							} else {
								item.date = content;
							}
						} else if (field == "VL") {
							item.volume = content;
						} else if (field == "IS") {
							item.issue = content;
						} else if (field == "BP") {
							item.pages = content;
						} else if (field == "EP") {
							item.pages += "-" + content;
						} else if (field == "AB") {
							item.abstractNote = content;
						}
					} else {
						content = Zotero.Utilities.trimInternal(line);
						if (field == "AF" || field == "AU") {
							var author = content.split(",");
							item.creators.push({firstName:author[1], lastName:author[0], creatorType:"author"});
						} else if (field == "TI") {
							item.title += " " + content;
						} else if (field == "AB") {
							item.abstractNote += " " + content;
						}
					}
				}
				item.attachments = [{url:item.url, title:"ISI Web of Knowledge Snapshot", mimeType:"text/html"}];
				item.complete();
			});
		});
	}, function() {Zotero.done;});
}');

REPLACE INTO translators VALUES ('84564450-d633-4de2-bbcc-451ea580f0d6', '1.0.0b3.r1', '', '2007-03-28 20:00:00', '1', '100', '4', 'Gale Literature Resource Center', 'Simon Kornblith', '^https?://[^/]+/servlet/LitRC?(?:|.*&)srchtp=(?:adv)?mla(?:&|$)', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	if(doc.title.length <= 33 || doc.title.substr(0, 33) != "Literature Resource Center -- MLA") return false;
	
	if(url.indexOf("docNum=") != -1) {	// article;
		return "journalArticle";
	} else if(doc.evaluate(''//tr[td/span[@class="stndxtralead"]]'', doc, nsResolver,
	   XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
	
	return false;
}', 
'function extractCitation(type, citation) {
	type = Zotero.Utilities.cleanString(type).toLowerCase();
	citation = Zotero.Utilities.cleanString(citation);
	
	if(type == "book article") {
		var item = new Zotero.Item("bookSection");
	} else if(type == "book" || type == "book collection") {
		var item = new Zotero.Item("book");
	} else if(type == "dissertation abstract") {
		var item = new Zotero.Item("thesis");
	} else {
		var item = new Zotero.Item("journalArticle");
	}
	
	var m;
	if(item.itemType == "journalArticle" || item.itemType == "thesis") {
		m = citation.match(/^(.+)\. "([^"]+)" (.+), ([0-9\:]*) ?\(([^\)]+)\)(?:, (?:pp\. ([\-0-9]+)|([\-0-9A-Z]+)))?/);
		if(!m) return false;
		
		item.publicationTitle = m[3];
		var parts = m[4].split(":");
		if(parts.length == 2) {
			item.volume = parts[0];
			item.issue = parts[1];
		} else {
			item.issue = m[4];
		}
		item.date = m[5];
		item.pages = m[6] ? m[6] : m[7];
	} else if(item.itemType == "book") {
		m = citation.match(/^(.+)\. "([^"]+)" ([^:]+): ([^,]+), ([0-9]{4})\..*?(?:([0-9]+) pp\.)/);
		if(!m) return false;
		
		item.place = m[3];
		item.publisher = m[4];
		item.date = m[5];
		item.pages = m[6];
	} else if(item.itemType == "bookSection") {
		m = citation.match(/^(.+)\. "([^"]+)" pp\. ([\-0-9]+)\. (?:((?:[^\.]*|\([^\)]+\)| [A-Z]\.)*)\.)? ([^\(\)]+). ([^:]+): ([^,]+), ([0-9]{4})/);
		if(!m) return false;
		
		Zotero.debug(m);
		
		item.pages = m[3];
		var bookAuthors = m[4].split(" and ");
		for each(var bookAuthor in bookAuthors) {
			var n = bookAuthor.match(/^([^,]+), ([^\(]+)(?: \(([^\)]+)\)?)?$/);
			if(n) {
				var type = (n[3] && n[3].toLowerCase().indexOf("ed.") != -1) ? "editor" : "author";
				item.creators.push({lastName:n[1], firstName:n[2], creatorType:type})
			}
		}
		item.publicationTitle = m[5];
		item.place = m[6];
		item.publisher = m[7];
		item.date = m[8];
	}
	
	// add creators
	var creators = m[1].split("; ");
	for each(var creator in creators) {
		item.creators.push(Zotero.Utilities.cleanAuthor(creator, "author", true));
	}
	if(m[2][m[2].length-1] == ".") {
		item.title = m[2].substr(0, m[2].length-1);
	} else {
		item.title = m[2];
	}
	
	return item;
}

function doWeb(doc, url) {	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var uri = doc.location.href;
	if(url.indexOf("docNum=") != -1) {	// article;
		var citation = doc.evaluate(''//td[b/text() = "Source Database:"] | //td[*/b/text() = "Source Database:"]'', doc, nsResolver,
			XPathResult.ANY_TYPE, null).iterateNext().innerHTML;
		
		// ugh
		var parts = citation.split(/<\/CENTER>/i);
		var citation = parts[parts.length-1];
		citation = citation.replace(/<script[^>]*>(?:.|[\r\n])*<\/script>/gi, "");
		citation = citation.replace(/<a[^>]*>(?:.|[\r\n])*<\/a>/gi, "");
		
		// big enormous hack, but it works
		var span = doc.createElement("span");
		span.innerHTML = citation;
		citation = span.textContent;
		
		var citeM = citation.match(/^\s*([^\n]+)/);
		var subjectM = citation.match(/Subject Terms:\s+([^\n]+)/);
		var typeM = citation.match(/Document Type:\s+([^\n]+)/);
		var issnM = citation.match(/ISSN:\s+([^\n]+)/);
		
		var item = extractCitation(typeM[1], citeM[1]);
		item.tags = subjectM[1].split("; ");
		
		if(issnM) item.ISSN = issnM[1];
		
		item.complete();
	} else {							// search results
		var items = new Array();
				
		var tableRows = doc.evaluate(''//tr[td/span[@class="stndxtralead"]]'', doc, nsResolver,
		                             XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
		// Go through table rows
		for(var i=0; i<tableRows.snapshotLength; i++) {
			items[i] = doc.evaluate(''./td/span[@class="stndxtralead"]//a'', tableRows.snapshotItem(i),
				nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			items[i] = items[i].substring(1, items[i].length-1);
		}
		
		items = Zotero.selectItems(items);
		if(!items) return true
		
		for(var i in items) {
			var tableRow = tableRows.snapshotItem(i);
			
			var type = doc.evaluate(''./td[3]/span[@class="stndxtralead"]'', tableRow, nsResolver,
				XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var citation = doc.evaluate(''./td/span[@class="stndxtralead"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			
			var item = extractCitation(type, citation);
			if(!item) continue;
			
			var terms = doc.evaluate(''.//span[@class="mlasubjects"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(terms) {
				// chop off "[Subject Terms: " and "]"
				terms = terms.textContent;
				terms = terms.substring(16, terms.length-2);
				item.tags = terms.split("; ");
			}
			
			item.complete();
		}
	}
}');

REPLACE INTO translators VALUES ('5eacdb93-20b9-4c46-a89b-523f62935ae4', '1.0.0b3.r1', '', '2008-04-04 15:30:00', '1', '100', '4', 'HighWire', 'Simon Kornblith', '^http://[^/]+/(?:cgi/searchresults|cgi/search|cgi/content/(?:abstract|full|short|summary)|current.dtl$|content/vol[0-9]+/issue[0-9]+/(?:index.dtl)?$)', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	if(doc.title.indexOf(" -- Search Result") != -1 ||
	  doc.title == "Science/AAAS | Search Results") {
		if(doc.evaluate(''//table/tbody/tr[td/input[@type="checkbox"][@name="gca"]]'', doc,
			nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) return "multiple";
	} else if(doc.title.indexOf(" -- Table of Contents") != -1||
	  doc.title == "Science/AAAS | Science Magazine Search Results") {
		if(doc.evaluate(''//form/dl'', doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext()) return "multiple";
	} else {
		if(doc.evaluate(''//a[substring(@href, 1, 16) = "/cgi/citmgr?gca="]'', doc, nsResolver,
			XPathResult.ANY_TYPE, null).iterateNext()) return "journalArticle";
	}
	
	return false;
}', 
'function handleRequests(requests) {
	if(requests.length == 0) {
		Zotero.done();
		return;
	}
	
	var request = requests.shift();
	var URL = request.baseURL+request.args;
	
	Zotero.Utilities.HTTP.doGet(URL, function(text) {
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			if(item.notes[0]) {
				item.DOI = item.notes[0].note;
				item.notes = new Array();
			}
			
			item.attachments = new Array();
			var snapshot = request.snapshots.shift();
			var pdf = request.pdfs.shift();
			if(snapshot) {
				if(typeof(snapshot) == "string") {
					// string snapshot (from search)
					item.attachments.push({title:"HighWire Snapshot", mimeType:"text/html", url:snapshot});
				} else {
					// document object
					item.attachments.push({title:"HighWire Snapshot", document:snapshot});
				}
			}
			if(pdf) {
				var m = pdf.match(/^[^?]+/);
				item.attachments.push({title:"HighWire Full Text PDF", mimeType:"application/pdf", url:m[0]+".pdf"});
			}
			
			item.complete();
		});
		translator.translate();
		
		handleRequests(requests);
	});
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var requests = new Array();
	var hostRe = /https?:\/\/[^\/]+/;
	
	var isSearch = doc.title.indexOf("Search Result") != -1
	var isTOC = doc.title.indexOf(" -- Table of Contents") != -1;
	var isScience = doc.title.indexOf("Science Magazine Search Results") != -1;
	if(isSearch || isTOC) {
		// search page
		var items = new Object();
		var snapshots = new Object();
		var pdfs = new Object();
		
		if(isTOC) {
			var gcaRe = /^https?:\/\/[^\/]+\/cgi\/reprint\/([0-9]+\/[0-9]+\/[0-9]+)/;
			var tableRows = doc.evaluate(''//form/dl'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else if(isScience) {
			var tableRows = doc.evaluate(''//form/dl/dd'', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var tableDTs = doc.evaluate(''//form/dl/dt'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else {
			var tableRows = doc.evaluate(''//table/tbody/tr[td/input[@type="checkbox"]][td/font/strong]'', doc,
				nsResolver, XPathResult.ANY_TYPE, null);
		}
		
		var tableRow, link;
		while(tableRow = tableRows.iterateNext()) {
			var snapshot = undefined;
			var pdf = undefined;
			
			if(isTOC) {
				var title = doc.evaluate(''.//strong'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				
				var links = doc.evaluate(''.//a'', tableRow, nsResolver, XPathResult.ANY_TYPE, null);
				while(link = links.iterateNext()) {
					// prefer Full Text snapshots, but take abstracts
					if(link.textContent == "[Abstract]") {
						if(!snapshot) snapshot = link.href;
					} else if (link.textContent == "[Full Text]") {
						snapshot = link.href;
					} else if(link.textContent == "[PDF]") {
						pdf = link.href;
						var m = gcaRe.exec(link.href);
						var gca = m[1];
					}
				}
			} else {
				if(isScience) {
					var tableDT = tableDTs.iterateNext();
					var gca = doc.evaluate(''./input[@type="checkbox"]'', tableDT, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
					var title = doc.evaluate(''./label'', tableDT, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				} else {
					var gca = doc.evaluate(''./td/input[@type="checkbox"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
					var title = doc.evaluate(''./td/font/strong'', tableRow, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
					if(title.snapshotItem(0).textContent.toUpperCase() == title.snapshotItem(0).textContent) {
						title = title.snapshotItem(1).textContent;
					} else {
						title = title.snapshotItem(0).textContent;
					}
				}
				
				var links = doc.evaluate(''.//a'', tableRow, nsResolver, XPathResult.ANY_TYPE, null);
				while(link = links.iterateNext()) {
					// prefer Full Text snapshots, but take abstracts
					var textContent = Zotero.Utilities.cleanString(link.textContent);
					if((textContent.substr(0, 8) == "Abstract" && !snapshot) || textContent.substr(0, 9) == "Full Text") {
						snapshot = link.href;
					} else if(textContent.substr(0, 3) == "PDF") {
						pdf = link.href;
					}
				}
			}
			
			snapshots[gca] = snapshot;
			pdfs[gca] = pdf;
			
			items[gca] = Zotero.Utilities.cleanString(title);
		}
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var requests = new Array();
		for(var gca in items) {
			var m = hostRe.exec(pdfs[gca]);
			var baseURL = ''http://'' + doc.location.host + ''/cgi/citmgr?type=refman'';
			
			var thisRequest = null;
			for each(var request in requests) {
				if(request.baseURL == baseURL) {
					thisRequest = request;
					break;
				}
			}
			
			if(!thisRequest) {
				thisRequest = new Object();
				thisRequest.snapshots = new Array();
				thisRequest.pdfs = new Array();
				thisRequest.args = "";
				thisRequest.baseURL = baseURL;
				requests.push(thisRequest);
			}
			
			thisRequest.snapshots.push(snapshots[gca]);
			thisRequest.pdfs.push(pdfs[gca]);
			thisRequest.args += "&gca="+gca;
		}
	} else {
		var baseURL = doc.evaluate(''//a[substring(@href, 1, 16) = "/cgi/citmgr?gca="]'', doc, nsResolver,
			XPathResult.ANY_TYPE, null).iterateNext().href;
		var pdf = doc.location.href.replace(/\/content\/[^\/]+\//, "/reprint/");
		Zotero.debug(pdf);
		var requests = [{baseURL:baseURL, args:"&type=refman", snapshots:[doc], pdfs:[pdf]}];
	}
	
	handleRequests(requests);
		
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('a354331-981b-43de-a61-bc26dd1be3a9', '1.0.0b3.r1', '', '2007-03-24 22:20:00', '1', '100', '4', 'AMS MathSciNet', 'Simon Kornblith', '^https?://www\.ams\.org[^/]*/mathscinet/search/(?:publications\.html|publdoc\.html)', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var tableRows = doc.evaluate(''//div[@id="content"]/form/div[@class="headline"]'', doc, nsResolver,
			XPathResult.ANY_TYPE, null);
	if(tableRows.iterateNext()) {
		return "multiple"
	} else if(doc.evaluate(''//div[@id="titleSeparator"]/div[@class="navbar"]/span[@class="PageLink"]/a[text() = "Up"]'',
		doc, nsResolver, XPathResult.ANY_TYPE, null)) {
		return "journalArticle";
	}
	
	return false;
}', 
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var pub = "http://www.ams.org/mathscinet/search/publications.html?fmt=bibtex";
	
	var tableRows = doc.evaluate(''//div[@id="content"]/form/div[@class="headline"]'', doc, nsResolver,
			XPathResult.ANY_TYPE, null);
	var tableRow = tableRows.iterateNext();
	if(tableRow) {
		// search page
		var items = new Object();
		var links = new Object();
		
		do {
			var id = doc.evaluate(''.//input[@type="checkbox"]'', tableRow, nsResolver,
				XPathResult.ANY_TYPE, null).iterateNext().value;
			items[id] = doc.evaluate(''./div[@class="headlineText"]/span[@class="title"]'', tableRow, nsResolver,
				XPathResult.ANY_TYPE, null).iterateNext().textContent;
			links[id] = doc.evaluate(''.//a'', tableRow, nsResolver, XPathResult.ANY_TYPE,
				null).iterateNext().href;
		} while(tableRow = tableRows.iterateNext())
		
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var docLinks = new Array();
		for(var id in items) {
			pub += "&b="+id;
			docLinks.push(links[id]);
		}
	} else {
		var MR = doc.evaluate(''//div[@id="content"]/div[@class="doc"]/div[@class="headline"]/strong'',
			doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		pub += "&b="+MR.replace(/^MR0*/, "");
	}
	
	Zotero.Utilities.HTTP.doGet(pub, function(text) {
		var m = text.match(/<pre>(?:.|[\r\n])*?<\/pre>/g);
		var bibTeXString = "";
		for each(var citation in m) {
			// kill pre tags
			citation = citation.substring(5, citation.length-6);
			bibTeXString += citation;
		}
		
		// import using BibTeX
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("9cb70025-a888-4a29-a210-93ec52da40d4");
		translator.setString(bibTeXString);
		translator.setHandler("itemDone", function(obj, item) {
			if(docLinks) {
				item.attachments.push({title:"MathSciNet Snapshot", url:docLinks.shift(), mimeType:"text/html"});
			} else {
				item.attachments.push({title:"MathSciNet Snapshot", document:doc});
			}
			
			item.complete();
		});
		translator.translate();
		
		Zotero.done();
	});
}');

REPLACE INTO translators VALUES ('938ebe32-2b2e-4349-a5b3-b3a05d3de627', '1.0.0b3.r1', '', '2008-03-18 02:30:00', '1', '100', '4', 'ACS Publications', 'Sean Takats and Michael Berkowitz', 'http://[^/]*pubs.acs.org[^/]*/(?:wls/journals/query/(?:subscriberResults|query)\.html|acs/journals/toc.page|cgi-bin/(?:article|abstract|sample|asap).cgi)?', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	if(doc.evaluate(''//input[@name="jid"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate(''//jid'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	} 
	return false;
}', 
'function handleRequests(requests, pdfs) {
	if(requests.length == 0) {
		Zotero.done();
		return;
	}

	var request = requests.shift();

	Zotero.Utilities.HTTP.doGet("http://pubs.acs.org/wls/journals/citation2/Citation?"+request.jid, function() {
		Zotero.Utilities.HTTP.doPost("http://pubs.acs.org/wls/journals/citation2/Citation",
							"includeAbstract=citation-abstract&format=refmgr&submit=1&mode=GET", function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				var pdf = pdfs.shift();
				if(pdf) {
					item.attachments.push({
					title:"ACS Full Text PDF",
					url:pdf, mimeType:"application/pdf"
					});
				}
				if (!item.attachments[0].title)
					item.attachments[0].title = "ACS Snapshot";
				item.complete();
				});
			translator.translate();

			handleRequests(requests);
		});
	});
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var pdfs = new Array();
	var requests = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		// search page
		var items = new Array();
		if (doc.evaluate(''//form[@name="citationSelect"]//tbody/tr[1]//span[@class="textbold"][1]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var titles = doc.evaluate(''//form[@name="citationSelect"]//tbody/tr[1]//span[@class="textbold"][1]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else if (doc.evaluate(''//form/div[@class="artBox"]/div[@class="artBody"]/div[@class="artTitle"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var titles = doc.evaluate(''//form/div[@class="artBox"]/div[@class="artBody"]/div[@class="artTitle"]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		if (doc.evaluate(''//form[@name="citationSelect"]//input[@name="jid"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var jids = doc.evaluate(''//form[@name="citationSelect"]//input[@name="jid"]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else if (doc.evaluate(''//div[@id="content"]/form/div[@class="artBox"]/div[@class="artHeadBox"]/div[@class="artHeader"]/input'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var jids = doc.evaluate(''//div[@id="content"]/form/div[@class="artBox"]/div[@class="artHeadBox"]/div[@class="artHeader"]/input'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		var links = doc.evaluate(''//form[@name="citationSelect"]//tbody/tr[2]//a[@class="link"]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var title;
		var jid;
		var id;
		var link;
		while ((title = titles.iterateNext()) && (jid = jids.iterateNext())){
			id = jid.value
			items[id] = Zotero.Utilities.trimInternal(title.textContent);

			var link = doc.evaluate(''../../..//a[contains(text(), "PDF")]'', title, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if(link) {
					links[id] = link.href.replace("searchRedirect.cgi", "article.cgi");
				}
		}

		items = Zotero.selectItems(items);
		if(!items) return true;

		var getstring = "";
		for(var i in items) {
			getstring = getstring + "jid=" + encodeURIComponent(i) + "&";
			pdfs.push(links[i]+"?sessid=");
		}
		requests.push({jid:getstring});
	} else {
		// single page
		var jid = doc.evaluate(''//jid'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		jid = jid.substr(jid.indexOf("/")+1);
		var pdf = doc.evaluate(''/html/body//a[contains(text(), "PDF")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if (!pdf) {
			var pdf = doc.evaluate(''/html/body//a[contains(@href, "/pdf/")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		}
		if (pdf) {
           		pdf = pdf.href;
           		pdf = pdf.replace("searchRedirect.cgi", "article.cgi");
           		pdfs.push(pdf+"?sessid=");
        	}
		var requests = [{jid:"jid=" + encodeURIComponent(jid)}]; 
	}
	handleRequests(requests, pdfs);

	Zotero.wait();
}');

REPLACE INTO translators VALUES ('72cb2536-3211-41e0-ae8b-974c0385e085', '1.0.0b4.r1', '', '2007-06-21 07:00:00', '0', '100', '4', 'ARTFL Encyclopedie', 'Sean Takats', '/cgi-bin/philologic31/(getobject\.pl\?c\.[0-9]+:[0-9]+\.encyclopedie|search3t\?dbname=encyclopedie0507)', 
'function detectWeb(doc, url) {
	if (url.indexOf("getobject.pl") != -1){
		return "encyclopediaArticle";
	} else {
		return "multiple";
	}
}', 
'function reconcileAuthor(author){
	var authorMap = {
		"Venel":"Venel, Gabriel-François",
		"d''Aumont":"d''Aumont, Arnulphe",
		"de La Chapelle":"de La Chapelle, Jean-Baptiste",
		"Bourgelat":"Bourgelat, Claude",
		"Dumarsais":"Du Marsais, César Chesneau",
		"Mallet":"Mallet, Edme-François",
		"Toussaint":"Toussaint, François-Vincent",
		"Daubenton":"Daubenton, Louis-Jean-Marie",
		"d''Argenville": "d''Argenville, Antoine-Joseph Desallier",
		"Tarin":"Tarin, Pierre",
		"Vandenesse":"de Vandenesse, Urbain",
		"Blondel": "Blondel, Jacques-François",
		"Le Blond":"Le Blond, Guillaume",
		"Rousseau":"Rousseau, Jean-Jacques",
		"Eidous":"Eidous, Marc-Antoine",
		"d''Alembert":"d''Alembert, Jean le Rond",
		"Louis":"Louis, Antoine",
		"Bellin":"Bellin, Jacques-Nicolas",
		"Diderot":"Diderot, Denis",
		"Diderot1":"Diderot, Denis",
		"Diderot2":"Diderot, Denis",
		"de Jaucourt":"de Jaucourt, Chevalier Louis",
		"Jaucourt":"de Jaucourt, Chevalier Louis",
		"d''Holbach":"d''Holbach, Baron"
		/* not yet mapped
		Yvon
		Forbonnais
		Douchet and Beauzée
		Boucher d''Argis
		Lenglet Du Fresnoy
		Cahusac
		Pestré
		Daubenton, le Subdélégué
		Goussier
		de Villiers
		Barthès
		Morellet
		Malouin
		Ménuret de Chambaud
		Landois
		Le Roy
		*/
	}
	if(authorMap[author]) {
		author = authorMap[author];
	}
	// remove ARTFL''s trailing 5 for odd contributors (e.g. Turgot5)
		if (author.substr(author.length-1, 1)=="5"){
		author = author.substr(0, author.length-1);
	}
	return author;
}

function scrape (doc){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
		} : null;
		var url = doc.location.href;
		var newItem = new Zotero.Item("encyclopediaArticle");
		var xpath = ''/html/body/div[@class="text"]/font'';
		var titleElmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if (titleElmt) {
			var title = titleElmt.textContent;
		} else {
			xpath = ''/html/body/div[@class="text"]/b'';
			var title = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		}
		newItem.title = title;
		newItem.encyclopediaTitle = "Encyclopédie, ou Dictionnaire raisonné des sciences, des arts et des métiers";
		newItem.shortTitle = "Encyclopédie";
		newItem.date = "1751-1772";
		newItem.publisher = "Briasson";
		newItem.place = "Paris";
		newItem.url = url;
	
		newItem.attachments.push({title:"ARTFL Snapshot", mimeType:"text/html", url:url, snapshot:true});
	
		// get author and tags
		var hostRegexp = new RegExp("^(https?://[^/]+)/");
		var hMatch = hostRegexp.exec(url);
		var host = hMatch[1];
		var getString1 = "/cgi-bin/philologic31/search3t?dbname=encyclopedie0507&word=&dgdivhead=";
		var getString2 = "&dgdivocauthor=&dgdivocplacename=&dgdivocsalutation=&dgdivocclassification=&dgdivocpartofspeech=&dgdivtype=&CONJUNCT=PHRASE&DISTANCE=3&PROXY=or+fewer&OUTPUT=conc&POLESPAN=5&KWSS=1&KWSSPRLIM=500";
		
		Zotero.Utilities.HTTP.doGet(host+getString1+title+getString2, function(text){
			var tagRe = new RegExp(''>''+title+''</a>[^\[]*\\[([^\\]]*)\]'', ''i'');
			var m = tagRe.exec(text);
			if(m[1] != "unclassified"){
			 	var tagstring = m[1].replace("&amp;", "&", "g");
				var tags = tagstring.split(";")
				for(var j in tags) {
					newItem.tags.push(Zotero.Utilities.cleanString(tags[j]));
				}
			}
			var authorRe = new RegExp(''>''+title+''</a>,([^,]*),'', "i");
			var m = authorRe.exec(text);
			var author = m[1];
			author = Zotero.Utilities.cleanString(author);
			// reconcile author
			author = reconcileAuthor(author);	
			if (author!="NA"){ // ignore unknown authors
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author", true));
			}
			newItem.creators.push({firstName:"Denis", lastName:"Diderot", creatorType:"editor"});
			newItem.creators.push({firstName:"Jean le Rond", lastName:"d''Alembert", creatorType:"editor"});
			newItem.complete();
		}, function() {Zotero.done();}, null);
		Zotero.wait();	
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
		} : null;

	if (url.indexOf("getobject.pl") != -1){
		// single article
		scrape(doc);				
	} else {
		//search page
		var items = new Object();
		var xpath = ''/html/body/div[@class="text"]/p/a'';
		var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;		
		while (elmt = elmts.iterateNext()){
			var title = elmt.textContent;
			var link = elmt.href;
			if (title && link){
				items[link] = title;
			}			
		}
		var items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();	
	}
		
}');

REPLACE INTO translators VALUES ('1b9ed730-69c7-40b0-8a06-517a89a3a278', '1.0.0b3.r1', '', '2007-01-24 01:35:00', '0', '100', '4', 'Sudoc', 'Sean Takats', '^http://www\.sudoc\.abes\.fr', 
'function detectWeb(doc, url) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
				if (prefix == ''x'') return namespace; else return null;
		} : null;

		var xpath = ''//table/tbody/tr/td[1][@class="preslabel"]/strong'';
		var multxpath = ''//a[@id="InitialFocusPoint"]'';
		var elt;

		if (elt = doc.evaluate(multxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				return "multiple";
		}
		else if (elt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) 
		{
				var contenu = elt.textContent;
				var numRegexp = /(Num.ro.de.notice|Record.number)/;
				var m = numRegexp.exec(contenu);
				if (m) {
						// On a bien une notice d"ouvrage, on doit chercher limage 
						// pour choisir le type de document
						var imgXpath = ''/html/body/table/tbody/tr/td[1]/p/img/@src'';
						var imgsrc = doc.evaluate(imgXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
						if (imgsrc){
								if (imgsrc.indexOf("icon_per.gif") > 0){
										return "book";
								} else if (imgsrc.indexOf("icon_books.gif") > 0){
										return "book";
								} else if (imgsrc.indexOf("icon_thesis.gif") > 0){
										return "thesis";
								} else if (imgsrc.indexOf("icon_art.gif") > 0){
										return "journalArticle";
								} else {
										return "book";
								}
						} 
				}
		}
}', 
'function scrape(doc) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
				if (prefix == ''x'') return namespace; else return null;
		} : null;

		var rowXpath = ''//tr[td[@class="preslabel"]]'';
		var tableRows = doc.evaluate(rowXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;

		var newItem = new Zotero.Item();
		// TODO add other item types using detectWeb''s icon checking code
		newItem.itemType = "book";
		var imgXpath = ''/html/body/table/tbody/tr/td[1]/p/img/@src'';
		var imgsrc = doc.evaluate(imgXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
		if (imgsrc){
				if (imgsrc.indexOf("icon_per.gif") > 0){
						newItem.itemType = "book";
				} else if (imgsrc.indexOf("icon_books.gif") > 0){
						newItem.itemType = "book";
				} else if (imgsrc.indexOf("icon_thesis.gif") > 0){
						newItem.itemType = "thesis";
				} else if (imgsrc.indexOf("icon_art.gif") > 0){
						newItem.itemType = "journalArticle";
				} else {
						newItem.itemType = "book";
				}
		} else {
				newItem.itemType = "book";
		}
		while (tableRow = tableRows.iterateNext())
		{
				var field = doc.evaluate(''./td[1]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				var value = doc.evaluate(''./td[2]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				field = Zotero.Utilities.superCleanString(field);

				if (field == "Titre" || field == "Title"){
						Zotero.debug("title = " + value);
						value = value.replace(/(\[[^\]]+\])/g,"");
						newItem.title = value.split(" / ")[0];
				}
				if (field.substr(0,6) == "Auteur" || field.substr(0,6) == "Author"){
						var authors = doc.evaluate(''./td[2]/a'', tableRow, nsResolver, XPathResult.ANY_TYPE, null);
						var author;
						while (author = authors.iterateNext()){
								var authorText = author.textContent;
								var authorParts = authorText.split(" ("); 
								newItem.creators.push(Zotero.Utilities.cleanAuthor(authorParts[0], 1, true));
						}
				}
				if (field.substr(0,4) == "Date"){
						newItem.date = value;
				}
				if (field.substr(0,7)  == "Editeur" || field.substr(0,9)  == "Publisher"){
						var pubParts = value.split(" : ");
						newItem.place = pubParts[0];
						// needs error checking below to avoid error
						if (pubParts[1] ) {
								pubParts = pubParts[1].split(", ");
								newItem.publisher = pubParts[0];
						}
				}
				if (field.substr(0,4) == "ISBN" || field.substr(0,4) == "ISSN"){
						newItem.ISBN = value.split(" (")[0];
				}
				if (field == "Description") {
						var m = value.match(/([0-9]+) (?:[pP])/);
						if (m) {
								newItem.pages = m[1];
						}
				}
				if (field.substr(0,5) == "Serie" || field.substr(0,10) == "Collection"){
						newItem.series = value;
				}
				if (field.substr(0,6) == "Sujets" || field.substr(0,8) == "Subjects"){
						var subjectElmts = doc.evaluate(''./td[2]/a'', tableRow, nsResolver, XPathResult.ANY_TYPE, null);
						var subject;
						var subjects;
						while (subject = subjectElmts.iterateNext()){
								subjects = subject.textContent.split(" -- ");
								newItem.tags = newItem.tags.concat(subjects);
						}
				}
				if (field == "In" || field == "Dans"){
						var jtitle = value.replace(/(\[[^\]]+\])/g,"");
						jtitle = jtitle.split(" / ")[0];
						jtitle = jtitle.split(" - ")[0];
						newItem.publicationTitle = jtitle;
						//get page numbers
						var m = value.match(/(?:[Pp]\. )([0-9\-]+)/);
						if (m) {
								newItem.pages = m[1];
						}
						//get ISBN or ISSN
						m = value.match(/(?:ISSN|ISBN) ([0-9Xx\-]+)/);
						if (m) {
								newItem.ISBN = m[1];
								newItem.ISSN = m[1];
						}
						// publicationTitle, issue/volume
				}
				// TODO Pages, Notes, Description, Language, Annexes
		}
		newItem.complete();
}

function doWeb(doc, url) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
				if (prefix == ''x'') return namespace; else return null;
		} : null;

		var multxpath = ''//a[@id="InitialFocusPoint"]'';
		var elt;

		if (elt = doc.evaluate(multxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				var newUrl = doc.evaluate(''//base/@href'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
				var xpath = ''//tr/td[3]/a'';
				var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
				var elmt = elmts.iterateNext();
				var links = new Array();
				var availableItems = new Array();
				var i = 0;
				do {
						var link = doc.evaluate(''./@href'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
						var searchTitle = elmt.textContent;
						availableItems[i] = searchTitle;
						links[i] = link;
						i++;
				} while (elmt = elmts.iterateNext());
				var items = Zotero.selectItems(availableItems);

				if(!items) {
						return true;
				}
				var uris = new Array();
				for(var i in items) {
						uris.push(newUrl + links[i]);
				}
				Zotero.Utilities.processDocuments(uris, function(doc) { scrape(doc) },
						function() { Zotero.done(); }, null);
				Zotero.wait();
		}
		else {
				scrape(doc);
		}
}');


REPLACE INTO translators VALUES ('66928fe3-1e93-45a7-8e11-9df6de0a11b3', '1.0.0b3.r1', '', '2007-03-22 16:35:00', '0', '100', '4', 'Max Planck Institute for the History of Science: Virtual Laboratory Library', 'Sean Takats', 'http://vlp.mpiwg-berlin.mpg.de/library/', 
'function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
				if (prefix == ''x'') return namespace; else return null;
		} : null;
	var elmt = doc.evaluate(''//base[contains(@href, "/library/data/lit")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (elmt){
			return "book";
	}
	elmt = doc.evaluate(''//span[starts-with(@title, "lit")] | //a[starts-with(@title, "lit")] | //p[starts-with(@title, "lit")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (elmt){
		return "multiple";
	}
}', 
'function doWeb(doc, url){

	var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
				if (prefix == ''x'') return namespace; else return null;
		} : null;
	var uris = new Array();
	var baseElmt = doc.evaluate(''//base[contains(@href, "/library/data/lit")]/@href'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (baseElmt){
		var docID = baseElmt.nodeValue;
		var idRe = /lit[0-9]+/;
		var m = idRe.exec(docID);
		uris.push("http://vlp.mpiwg-berlin.mpg.de/library/meta?id=" + m[0]);
	} else {
		var searchElmts = doc.evaluate(''//span[starts-with(@title, "lit")] | //a[starts-with(@title, "lit")] | //p[starts-with(@title, "lit")]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var searchElmt;
		var links = new Array();
		var availableItems = new Array();
		var i = 0;
		while (searchElmt = searchElmts.iterateNext()){
			availableItems[i] = Zotero.Utilities.cleanString(searchElmt.textContent);
			var docID = doc.evaluate(''./@title'', searchElmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			links.push("http://vlp.mpiwg-berlin.mpg.de/library/meta?id=" + docID);
			i++;
		}
		var items = Zotero.selectItems(availableItems);
		if(!items) {
			return true;
		}
		var uris = new Array();
		for(var i in items) {
			uris.push(links[i]);
		}
	}
	Zotero.Utilities.HTTP.doGet(uris, function(text) {
		// load Refer translator
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("881f60f2-0802-411a-9228-ce5f47b64c7d");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			item.type = undefined;
			item.complete();
		});
		translator.translate();
	}, function() {Zotero.done();}, null);
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('c73a4a8c-3ef1-4ec8-8229-7531ee384cc4', '1.0.0b3.r1', '', '2007-11-05 18:00:00', '1', '100', '4', 'Open WorldCat (Web)', 'Sean Takats', '^http://(?:www\.)?worldcat\.org/(?:search\?|profiles/[^/]+/lists/)', 
'function detectWeb(doc, url){
	var nsResolver = doc.createNSResolver(doc.documentElement);

	var xpath = ''//table[@class="tableResults" or @class="table-results"]/tbody/tr/td[3][@class="result"]/div[@class="name"]/a/strong'';
	var results = doc.evaluate(xpath, doc,
			       nsResolver, XPathResult.ANY_TYPE, null);
	if(results.iterateNext()) {
		return "multiple";
	}
}', 
'function processOWC(doc) {
	var spanTags = doc.getElementsByTagName("span");
	for(var i=0; i<spanTags.length; i++) {
		var spanClass = spanTags[i].getAttribute("class");
		if(spanClass) {
			var spanClasses = spanClass.split(" ");
			if(Zotero.Utilities.inArray("Z3988", spanClasses)) {
				var spanTitle = spanTags[i].getAttribute("title");
				var item = new Zotero.Item();
				if(Zotero.Utilities.parseContextObject(spanTitle, item)) {
					if(item.title) {
						item.title = Zotero.Utilities.capitalizeTitle(item.title);
					} else {
						item.title = "[Untitled]";
					}
					
					item.complete();
					return true;
				} else {
					return false;
				}
			}
		}
	}
	
	return false;
}

function doWeb(doc, url){
	var nsResolver = doc.createNSResolver(doc.documentElement);

	var urls = new Array();
	var items = new Array();
	var xpath = ''//table[@class="tableResults" or @class="table-results"]/tbody/tr/td[3][@class="result"]/div[@class="name"]/a'';
	var titles = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var title;
	// Go through titles
	while(title = titles.iterateNext()) {
		items[title.href] = title.textContent;
	}

	items = Zotero.selectItems(items);

	if(!items) {
		return true;
	}

	for(var i in items) {
		urls.push(i);
	}

	Zotero.Utilities.processDocuments(urls, function(doc) {
		processOWC(doc);}, function() {Zotero.done();});
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('e07e9b8c-0e98-4915-bb5a-32a08cb2f365', '1.0.0b3.r1', '', '2007-03-22 18:15:00', 1, 100, 12, 'Open WorldCat (Search)', 'Simon Kornblith', 'http://partneraccess.oclc.org/',
'function detectSearch(item) {
	if(item.itemType == "book" || item.itemType == "bookSection") {
		return true;
	}
	return false;
}',
'// creates an item from an Open WorldCat document
function processOWC(doc) {
	var spanTags = doc.getElementsByTagName("span");
	for(var i=0; i<spanTags.length; i++) {
		var spanClass = spanTags[i].getAttribute("class");
		if(spanClass) {
			var spanClasses = spanClass.split(" ");
			if(Zotero.Utilities.inArray("Z3988", spanClasses)) {
				var spanTitle = spanTags[i].getAttribute("title");
				var item = new Zotero.Item();
				if(Zotero.Utilities.parseContextObject(spanTitle, item)) {
					if(item.title) {
						item.title = Zotero.Utilities.capitalizeTitle(item.title);
					} else {
						item.title = "[Untitled]";
					}
					
					item.complete();
					return true;
				} else {
					return false;
				}
			}
		}
	}
	
	return false;
}

function doSearch(item) {
	if(item.contextObject) {
		var co = item.contextObject;
	} else {
		var co = Zotero.Utilities.createContextObject(item);
	}
	
	Zotero.Utilities.loadDocument("http://partneraccess.oclc.org/wcpa/servlet/OpenUrl?"+co, function(doc) {
		// find new COinS in the Open WorldCat page
		if(processOWC(doc)) {	// we got a single item page
			Zotero.done();
		} else {				// assume we have a search results page
			var items = new Array();
			
			var namespace = doc.documentElement.namespaceURI;
			var nsResolver = namespace ? function(prefix) {
				if (prefix == ''x'') return namespace; else return null;
			} : null;
			
			// first try to get only books
			var elmts = doc.evaluate(''//table[@class="tableLayout"]/tbody/tr/td[@class="content"]/table[@class="tableResults"]/tbody/tr[td/img[@alt="Book"]]/td/div[@class="title"]/a'', doc, nsResolver, Components.interfaces.nsIDOMXPathResult.ANY_TYPE,null);
			var elmt = elmts.iterateNext();
			if(!elmt) {	// if that fails, look for other options
				var elmts = doc.evaluate(''//table[@class="tableLayout"]/tbody/tr/td[@class="content"]/table[@class="tableResults"]/tbody/tr[td/img[@alt="Book"]]/td/div[@class="title"]/a'', doc, nsResolver, Components.interfaces.nsIDOMXPathResult.ANY_TYPE,null);
				elmt = elmts.iterateNext()
			}
			
			var urlsToProcess = new Array();
			do {
				urlsToProcess.push(elmt.href);
			} while(elmt = elmts.iterateNext());
			
			Zotero.Utilities.processDocuments(urlsToProcess, function(doc) {
				// per URL
				processOWC(doc);
			}, function() {	// done
				Zotero.done();
			});
		}
	}, null);
	
	Zotero.wait();
}');


REPLACE INTO translators VALUES ('11645bd1-0420-45c1-badb-53fb41eeb753', '1.0.0b3.r1', '', '2007-09-15 21:00:00', 1, 100, 8, 'CrossRef', 'Simon Kornblith', 'http://partneraccess.oclc.org/',
'function detectSearch(item) {
	if(item.itemType == "journalArticle") {
		return true;
	}
	return false;
}',
'function processCrossRef(xmlOutput) {
	xmlOutput = xmlOutput.replace(/<\?xml[^>]*\?>/, "");
	
	// parse XML with E4X
	var qr = new Namespace("http://www.crossref.org/qrschema/2.0");
	try {
		var xml = new XML(xmlOutput);
	} catch(e) {
		return false;
	}
	
	// ensure status is valid
	var status = xml.qr::query_result.qr::body.qr::query.@status.toString();
	if(status != "resolved" && status != "multiresolved") {
		return false;
	}
	
	var query = xml.qr::query_result.qr::body.qr::query;
	var item = new Zotero.Item("journalArticle");
	
	// try to get a DOI
	item.DOI = query.qr::doi.(@type=="journal_article").text().toString();
	if(!item.DOI) {
		item.DOI = query.qr::doi.(@type=="book_title").text().toString();
	}
	if(!item.DOI) {
		item.DOI = query.qr::doi.(@type=="book_content").text().toString();
	}
	
	// try to get an ISSN (no print/electronic preferences)
	item.ISSN = query.qr::issn[0].text().toString();
	// get title
	item.title = query.qr::article_title.text().toString();
	// get publicationTitle
	item.publicationTitle = query.qr::journal_title.text().toString();
	// get author
	item.creators.push(Zotero.Utilities.cleanAuthor(query.qr::author.text().toString(), "author", true));
	// get volume
	item.volume = query.qr::volume.text().toString();
	// get issue
	item.issue = query.qr::issue.text().toString();
	// get year
	item.date = query.qr::year.text().toString();
	// get edition
	item.edition = query.qr::edition_number.text().toString();
	// get first page
	item.pages = query.qr::first_page.text().toString();
	
	item.complete();
	return true;
}

function doSearch(item) {
	if(item.contextObject) {
		var co = item.contextObject;
		if(co.indexOf("url_ver=") == -1) {
			co = "url_ver=Z39.88-2004&"+co;
		}
	} else {
		var co = Zotero.Utilities.createContextObject(item);
	}
	
	Zotero.Utilities.HTTP.doGet("http://www.crossref.org/openurl?req_dat=zter:zter321&"+co+"&noredirect=true", function(responseText) {
		processCrossRef(responseText);
		Zotero.done();
	});
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('af4cf622-eaca-450b-bd45-0f4ba345d081', '1.0.0b3.r1', '', '2006-12-12 22:10:00', 1, 100, 8, 'CiteBase', 'Simon Kornblith', 'http://www.citebase.org/',
'function detectSearch(item) {
	if(item.itemType == "journalArticle") {
		return true;
	}
	return false;
}',
'function doSearch(item) {
	if(item.contextObject) {
		var co = item.contextObject;
		if(co.indexOf("url_ver=") == -1) {
			co = "url_ver=Z39.88-2004&"+co;
		}
		co = co.replace(/(?:&|^)svc_id=[^&]*/, "");
	} else {
		var co = Zotero.Utilities.createContextObject(item);
	}
	
	Zotero.Utilities.HTTP.doGet("http://www.citebase.org/openurl?"+co+"&svc_id=bibtex", function(responseText, request) {
		if(responseText.substr(0, 6) != "<?xml ") {
			// read BibTeX
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("9cb70025-a888-4a29-a210-93ec52da40d4");
			translator.setString(responseText);
			translator.translate();
		}
		
		Zotero.done();
	});
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('0e2235e7-babf-413c-9acf-f27cce5f059c', '1.0.0b4.r1', '', '2007-03-22 15:55:00', 1, 50, 3, 'MODS', 'Simon Kornblith', 'xml',
'Zotero.addOption("exportNotes", true);

function detectImport() {
	var read = Zotero.read(512);
	var modsTagRegexp = /<mods[^>]+>/
	if(modsTagRegexp.test(read)) {
		return true;
	}
}',
'var partialItemTypes = ["bookSection", "journalArticle", "magazineArticle", "newspaperArticle"];

function doExport() {
	Zotero.setCharacterSet("utf-8");
	var modsCollection = <modsCollection xmlns="http://www.loc.gov/mods/v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.loc.gov/mods/v3 http://www.loc.gov/standards/mods/v3/mods-3-2.xsd" />;
	
	var item;
	while(item = Zotero.nextItem()) {
		var isPartialItem = Zotero.Utilities.inArray(item.itemType, partialItemTypes);
		
		var mods = <mods />;
		
		/** CORE FIELDS **/
		
		// XML tag titleInfo; object field title
		if(item.title) {
			mods.titleInfo.title = item.title;
		}
		
		// XML tag typeOfResource/genre; object field type
		var modsType, marcGenre;
		if(item.itemType == "book" || item.itemType == "bookSection") {
			modsType = "text";
			marcGenre = "book";
		} else if(item.itemType == "journalArticle" || item.itemType == "magazineArticle") {
			modsType = "text";
			marcGenre = "periodical";
		} else if(item.itemType == "newspaperArticle") {
			modsType = "text";
			marcGenre = "newspaper";
		} else if(item.itemType == "thesis") {
			modsType = "text";
			marcGenre = "theses";
		} else if(item.itemType == "letter") {
			modsType = "text";
			marcGenre = "letter";
		} else if(item.itemType == "manuscript") {
			modsType = "text";
			modsType.@manuscript = "yes";
		} else if(item.itemType == "interview") {
			modsType = "text";
			marcGenre = "interview";
		} else if(item.itemType == "film") {
			modsType = "moving image";
			marcGenre = "motion picture";
		} else if(item.itemType == "artwork") {
			modsType = "still image";
			marcGenre = "art original";
		} else if(item.itemType == "webpage") {
			modsType = "multimedia";
			marcGenre = "web site";
		} else if(item.itemType == "note" || item.itemType == "attachment") {
			continue;
		}
		mods.typeOfResource = modsType;
		mods.genre += <genre authority="local">{item.itemType}</genre>;
		if(marcGenre) {
			mods.genre += <genre authority="marcgt">{marcGenre}</genre>;
		}
		
		// XML tag genre; object field thesisType, type
		if(item.thesisType) {
			mods.genre += <genre>{item.thesisType}</genre>;
		}
		if(item.type) {
			mods.genre += <genre>{item.type}</genre>;
		}
		
		// XML tag name; object field creators
		for(var j in item.creators) {
			var roleTerm = "";
			if(item.creators[j].creatorType == "author") {
				roleTerm = "aut";
			} else if(item.creators[j].creatorType == "editor") {
				roleTerm = "edt";
			} else if(item.creators[j].creatorType == "creator") {
				roleTerm = "ctb";
			}
			
			// FIXME - currently all names are personal
			mods.name += <name type="personal">
				<namePart type="family">{item.creators[j].lastName}</namePart>
				<namePart type="given">{item.creators[j].firstName}</namePart>
				<role><roleTerm type="code" authority="marcrelator">{roleTerm}</roleTerm></role>
				</name>;
		}
		
		// XML tag recordInfo.recordOrigin; used to store our generator note
		//mods.recordInfo.recordOrigin = "Zotero for Firefox "+Zotero.Utilities.getVersion();
		
		/** FIELDS ON NEARLY EVERYTHING BUT NOT A PART OF THE CORE **/
		
		// XML tag recordInfo.recordContentSource; object field source
		if(item.source) {
			mods.recordInfo.recordContentSource = item.source;
		}
		// XML tag recordInfo.recordIdentifier; object field accessionNumber
		if(item.accessionNumber) {
			mods.recordInfo.recordIdentifier = item.accessionNumber;
		}
		
		// XML tag accessCondition; object field rights
		if(item.rights) {
			mods.accessCondition = item.rights;
		}
		
		/** SUPPLEMENTAL FIELDS **/
		
		// Make part its own tag so we can figure out where it goes later
		var part = new XML();
		
		// XML tag detail; object field volume
		if(item.volume) {
			if(Zotero.Utilities.isInt(item.volume)) {
				part += <detail type="volume"><number>{item.volume}</number></detail>;
			} else {
				part += <detail type="volume"><text>{item.volume}</text></detail>;
			}
		}
		
		// XML tag detail; object field number
		if(item.issue) {
			if(Zotero.Utilities.isInt(item.issue)) {
				part += <detail type="issue"><number>{item.issue}</number></detail>;
			} else {
				part += <detail type="issue"><text>{item.issue}</text></detail>;
			}
		}
		
		// XML tag detail; object field section
		if(item.section) {
			if(Zotero.Utilities.isInt(item.section)) {
				part += <detail type="section"><number>{item.section}</number></detail>;
			} else {
				part += <detail type="section"><text>{item.section}</text></detail>;
			}
		}
		
		// XML tag detail; object field pages
		if(item.pages) {
			var range = Zotero.Utilities.getPageRange(item.pages);
			part += <extent unit="pages"><start>{range[0]}</start><end>{range[1]}</end></extent>;
		}
		
		// Assign part if something was assigned
		if(part.length() != 1) {
			if(isPartialItem) {
				// For a journal article, bookSection, etc., the part is the host
				mods.relatedItem.part += <part>{part}</part>;
			} else {
				mods.part += <part>{part}</part>;
			}
		}
		
		// XML tag originInfo; object fields edition, place, publisher, year, date
		var originInfo = new XML();
		if(item.edition) {
			originInfo += <edition>{item.edition}</edition>;
		}
		if(item.place) {
			originInfo += <place><placeTerm type="text">{item.place}</placeTerm></place>;
		}
		if(item.publisher) {
			originInfo += <publisher>{item.publisher}</publisher>;
		} else if(item.distributor) {
			originInfo += <publisher>{item.distributor}</publisher>;
		}
		if(item.date) {
			if(Zotero.Utilities.inArray(item.itemType, ["book", "bookSection"])) {
				// Assume year is copyright date
				var dateType = "copyrightDate";
			} else if(Zotero.Utilities.inArray(item.itemType, ["journalArticle", "magazineArticle", "newspaperArticle"])) {
				// Assume date is date issued
				var dateType = "dateIssued";
			} else {
				// Assume date is date created
				var dateType = "dateCreated";
			}
			var tag = <{dateType}>{item.date}</{dateType}>;
			originInfo += tag;
		}
		if(item.accessDate) {
			originInfo += <dateCaptured>{item.accessDate}</dateCaptured>;
		}
		if(originInfo.length() != 1) {
			if(isPartialItem) {
				// For a journal article, bookSection, etc., this goes under the host
				mods.relatedItem.originInfo += <originInfo>{originInfo}</originInfo>;
			} else {
				mods.originInfo += <originInfo>{originInfo}</originInfo>;
			}
		}
		
		// XML tag identifier; object fields ISBN, ISSN
		if(isPartialItem) {
			var identifier = mods.relatedItem;
		} else {
			var identifier = mods;
		}
		if(item.ISBN) {
			identifier.identifier += <identifier type="isbn">{item.ISBN}</identifier>;
		}
		if(item.ISSN) {
			identifier.identifier += <identifier type="issn">{item.ISSN}</identifier>;
		}
		if(item.DOI) {
			mods.identifier += <identifier type="doi">{item.DOI}</identifier>;
		}
		
		// XML tag relatedItem.titleInfo; object field publication
		if(item.publicationTitle) {
			mods.relatedItem.titleInfo += <titleInfo><title>{item.publicationTitle}</title></titleInfo>;
		}
		
		// XML tag classification; object field callNumber
		if(item.callNumber) {
			mods.classification = item.callNumber;
		}
		
		// XML tag location.physicalLocation; object field archiveLocation
		if(item.archiveLocation) {
			mods.location.physicalLocation = item.archiveLocation;
		}
		
		// XML tag location.url; object field archiveLocation
		if(item.url) {
			mods.location.url = item.url;
		}
		
		// XML tag title.titleInfo; object field journalAbbreviation
		if(item.journalAbbreviation) {
			mods.relatedItem.titleInfo += <titleInfo type="abbreviated"><title>{item.journalAbbreviation}</title></titleInfo>;
		}
		
		// XML tag abstract; object field abstractNote
		if(item.abstractNote) {
			mods.abstract = item.abstractNote;
		}
		
		if(mods.relatedItem.length() == 1 && isPartialItem) {
			mods.relatedItem.@type = "host";
		}
		
		/** NOTES **/
		
		if(Zotero.getOption("exportNotes")) {
			for(var j in item.notes) {
				// Add note tag
				var note = <note type="content">{item.notes[j].note}</note>;
				mods.note += note;
			}
		}
		
		/** TAGS **/
		
		for(var j in item.tags) {
			mods.subject += <subject><topic>{item.tags[j].tag}</topic></subject>;
		}
		
		
		// XML tag relatedItem.titleInfo; object field series
		if(item.seriesTitle || item.series || item.seriesNumber || item.seriesText) {
			var series = <relatedItem type="series"/>;
			
			if(item.series) {
				series.titleInfo.title = item.series;
			}
			
			if(item.seriesTitle) {
				series.titleInfo.partTitle = item.seriesTitle;
			}
			
			if(item.seriesText) {
				series.titleInfo.subTitle = item.seriesText;
			}
			
			if(item.seriesNumber) {
				series.titleInfo.partNumber = item.seriesNumber;
			}
			
			// TODO: make this work in import
			/*if(item.itemType == "bookSection") {
				// For a book section, series info must go inside host tag
				mods.relatedItem.relatedItem = series;
			} else {*/
				mods.relatedItem += series;
			//}
		}
		
		modsCollection.mods += mods;
	}
	
	Zotero.write(''<?xml version="1.0"?>''+"\n");
	Zotero.write(modsCollection.toXMLString());
}

function processIdentifiers(newItem, identifier) {
	for each(var myIdentifier in identifier) {
		if(myIdentifier.@type == "isbn") {
			newItem.ISBN = myIdentifier.text().toString()
		} else if(myIdentifier.@type == "issn") {
			newItem.ISSN = myIdentifier.text().toString()
		} else if(myIdentifier.@type == "doi") {
			newItem.DOI = myIdentifier.text().toString()
		}
	}
}

function doImport() {
	var marcGenres = {
		"book":"book",
		"periodical":"journalArticle",
		"newspaper":"newspaperArticle",
		"theses":"thesis",
		"letter":"letter",
		"motion picture":"film",
		"art original":"artwork",
		"web site":"webpage"
	};
	
	
	var text = "";
	var read;
	
	// read until we see if the file begins with a parse instruction
	read = " ";
	while(read == " " || read == "\n" || read == "\r") {
		read = Zotero.read(1);
	}
	
	var firstPart = read + Zotero.read(4);
	if(firstPart == "<?xml") {
		// got a parse instruction, read until it ends
		read = true;
		while((read !== false) && (read !== ">")) {
			read = Zotero.read(1);
			firstPart += read;
		}
		var encodingRe = /encoding=[''"]([^''"]+)[''"]/;
		var m = encodingRe.exec(firstPart);
		// set character set
		try {
			Zotero.setCharacterSet(m[1]);
		} catch(e) {
			Zotero.setCharacterSet("utf-8");
		}
	} else {
		Zotero.setCharacterSet("utf-8");
		text += firstPart;
	}
	
	// read in 16384 byte increments
	while(read = Zotero.read(16384)) {
		text += read;
	}
	
	// parse with E4X
	var m = new Namespace("http://www.loc.gov/mods/v3");
	// why does this default namespace declaration not work!?
	default xml namespace = m;
	var xml = new XML(text);
	
	if(xml.m::mods.length()) {
		var modsElements = xml.m::mods;
	} else {
		var modsElements = [xml];
	}
	
	for each(var mods in modsElements) {
		var newItem = new Zotero.Item();
		
		// title
		for each(var titleInfo in mods.m::titleInfo) {
			if(titleInfo.@type != "abbreviated") {
				newItem.title = titleInfo.m::title;
			}
		}
		// try to get genre from local genre
		for each(var genre in mods.m::genre) {
			if(genre.@authority == "local" && Zotero.Utilities.itemTypeExists(genre)) {
				newItem.itemType = genre.text().toString();
			} else if(!newItem.itemType && (genre.@authority == "marcgt" || genre.@authority == "marc")) {
				// otherwise, look at the marc genre
				newItem.itemType = marcGenres[genre.text().toString()];
			}
		}
		
		if(!newItem.itemType) {
			// try to get genre data from host
			for each(var relatedItem in mods.m::relatedItem) {
				if(relatedItem.@type == "host") {
					for each(var genre in relatedItem.m::genre) {
						if(genre.@authority == "marcgt" || genre.@authority == "marc") {
							newItem.itemType = marcGenres[genre.text().toString()];
							break;
						}
					}
				}
			}
			
			// check if this is an electronic resource
			if(!newItem.itemType) {
				for each(var form in mods.m::physicalDescription.m::form) {
					if(form.@authority == "marcform" || form.@authority == "marc") {
						if(form.text().toString() == "electronic") {
							newItem.itemType = "webpage";
							break;
						}
					}
				}
				
				if(!newItem.itemType) newItem.itemType = "book";
			}
		}
		
		var isPartialItem = Zotero.Utilities.inArray(newItem.itemType, partialItemTypes);
		
		// TODO: thesisType, type
		
		for each(var name in mods.m::name) {
			// TODO: institutional authors
			var creator = new Array();
			for each(var namePart in name.m::namePart) {
				if(namePart.@type == "given") {
					creator.firstName = namePart.text().toString();
				} else if(namePart.@type == "family") {
					creator.lastName = namePart.text().toString();
				} else {
					var backupName = namePart.text().toString();
				}
			}
			
			if(backupName && !creator.firstName && !creator.lastName) {
				creator = Zotero.Utilities.cleanAuthor(backupName, "author", true);
			}
			
			// look for roles
			for(var role in name.m::role.m::roleTerm) {
				if(role.@type == "code" && role.@authority == "marcrelator") {
					if(role == "edt") {
						creator.creatorType = "editor";
					} else if(role == "ctb") {
						creator.creatorType = "contributor";
					} else if(role == "trl") {
						creator.creatorType = "translator";
					}
				}
			}
			if(!creator.creatorType) creator.creatorType = "author";
			
			newItem.creators.push(creator);
		}
		
		// source
		newItem.source = mods.m::recordInfo.m::recordContentSource.text().toString();
		// accessionNumber
		newItem.accessionNumber = mods.m::recordInfo.m::recordIdentifier.text().toString();
		// rights
		newItem.rights = mods.m::accessCondition.text().toString();
		
		/** SUPPLEMENTAL FIELDS **/
		
		var part = false, originInfo = false;
		
		// series
		for each(var relatedItem in mods.m::relatedItem) {
			if(relatedItem.@type == "host") {
				for each(var titleInfo in relatedItem.m::titleInfo) {
					if(titleInfo.@type == "abbreviated") {
						newItem.journalAbbreviation = titleInfo.m::title.text().toString();
						if(!newItem.publicationTitle) newItem.publicationTitle = newItem.journalAbbreviation;
					} else {
						newItem.publicationTitle = titleInfo.m::title.text().toString();
					}
				}
				part = relatedItem.m::part;
				originInfo = relatedItem.m::originInfo;
				processIdentifiers(newItem, relatedItem.m::identifier);
			} else if(relatedItem.@type == "series") {
				newItem.series = relatedItem.m::titleInfo.m::title.text().toString();
				newItem.seriesTitle = relatedItem.m::titleInfo.m::partTitle.text().toString();
				newItem.seriesText = relatedItem.m::titleInfo.m::subTitle.text().toString();
				newItem.seriesNumber = relatedItem.m::titleInfo.m::partNumber.text().toString();
			}
		}
		
		// get part
		if(!part) {
			part = mods.m::part;
			originInfo = mods.m::originInfo;
		}
		
		if(part) {
			for each(var detail in part.m::detail) {
				// volume
				if(detail.@type == "volume") {
					newItem.volume = detail.m::number.text().toString();
					if(!newItem.volume) {
						newItem.volume = detail.m::text.text().toString();
					}
				}
				
				// number
				if(detail.@type == "issue") {
					newItem.issue = detail.m::number.text().toString();
					if(!newItem.issue) {
						newItem.issue = detail.m::text.text().toString();
					}
				}
				
				// section
				if(detail.@type == "section") {
					newItem.section = detail.m::number.text().toString();
					if(!newItem.section) {
						newItem.section = detail.m::text.text().toString();
					}
				}
			}
			
			// pages
			for each(var extent in part.m::extent) {
				if(extent.@unit == "pages" || extent.@unit == "page") {
					var pagesStart = extent.m::start.text().toString();
					var pagesEnd = extent.m::end.text().toString();
					if(pagesStart || pagesEnd) {
						if(pagesStart == pagesEnd) {
							newItem.pages = pagesStart;
						} else if(pagesStart && pagesEnd) {
							newItem.pages = pagesStart+"-"+pagesEnd;
						} else {
							newItem.pages = pagesStart+pagesEnd;
						}
					}
				}
			}
		}
		
		// identifier
		processIdentifiers(newItem, mods.m::identifier);
		// edition
		newItem.edition = originInfo.m::edition.text().toString();
		// place
		for each(var placeTerm in originInfo.m::place.m::placeTerm) {
			if(placeTerm.@type == "text") {
				newItem.place = placeTerm.text().toString();
			}
		}
		// publisher/distributor
		if(originInfo.m::publisher.length()) {
			if(newItem.itemType == "webpage" || newItem.itemType == "website") {
				newItem.publicationTitle = originInfo.m::publisher[0].text().toString();
			} else {
				newItem.publisher = originInfo.m::publisher[0].text().toString();
			}
		}
		// date
		if(originInfo.m::copyrightDate.length()) {
			newItem.date = originInfo.m::copyrightDate[0].text().toString();
		} else if(originInfo.m::dateIssued.length()) {
			newItem.date = originInfo.m::dateIssued[0].text().toString();
		} else if(originInfo.m::dateCreated.length()) {
			newItem.date = originInfo.m::dateCreated[0].text().toString();
		}
		// lastModified
		newItem.lastModified = originInfo.m::dateModified.text().toString();
		// accessDate
		newItem.accessDate = originInfo.m::dateCaptured.text().toString();
		
		// call number
		newItem.callNumber = mods.m::classification.text().toString();
		// archiveLocation
		newItem.archiveLocation = mods.m::location.m::physicalLocation.text().toString();
		// url
		newItem.url = mods.m::location.m::url.text().toString();
		// abstract
		newItem.abstractNote = mods.m::abstract.text().toString();
		
		/** NOTES **/
		for each(var note in mods.m::note) {
			newItem.notes.push({note:note.text().toString()});
		}
		
		/** TAGS **/
		for each(var subject in mods.m::subject.m::topic) {
			newItem.tags.push(subject.text().toString());
		}
		
		Zotero.debug(newItem);
		
		newItem.complete();
	}
}');

REPLACE INTO translators VALUES ('14763d24-8ba0-45df-8f52-b8d1108e7ac9', '1.0.0b4.r1', '', '2008-02-08 07:30:00', 1, 25, 2, 'Zotero RDF', 'Simon Kornblith', 'rdf',
'Zotero.configure("getCollections", true);
Zotero.configure("dataMode", "rdf");
Zotero.addOption("exportNotes", true);
Zotero.addOption("exportFileData", false);',
'var rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

var n = {
	bib:"http://purl.org/net/biblio#",
	dc:"http://purl.org/dc/elements/1.1/",
	dcterms:"http://purl.org/dc/terms/",
	prism:"http://prismstandard.org/namespaces/1.2/basic/",
	foaf:"http://xmlns.com/foaf/0.1/",
	vcard:"http://nwalsh.com/rdf/vCard#",
	link:"http://purl.org/rss/1.0/modules/link/",
	z:"http://www.zotero.org/namespaces/export#"
};

function generateSeeAlso(resource, seeAlso) {
	for(var i in seeAlso) {
		if(itemResources[seeAlso[i]]) {
			Zotero.RDF.addStatement(resource, n.dc+"relation", itemResources[seeAlso[i]], false);
		}
	}
}

function generateTags(resource, tags) {
	Zotero.debug("processing tags");
	for each(var tag in tags) {
		if(tag.type == 1) {
			var tagResource = Zotero.RDF.newResource();
			// set tag type and value
			Zotero.RDF.addStatement(tagResource, rdf+"type", n.z+"AutomaticTag", false);
			Zotero.RDF.addStatement(tagResource, rdf+"value", tag.tag, true);
			// add relationship to resource
			Zotero.RDF.addStatement(resource, n.dc+"subject", tagResource, false);
		} else {
			Zotero.RDF.addStatement(resource, n.dc+"subject", tag.tag, true);
		}
	}
}

function generateCollection(collection) {
	var collectionResource = "#collection_"+collection.id;
	Zotero.RDF.addStatement(collectionResource, rdf+"type", n.z+"Collection", false);
	Zotero.RDF.addStatement(collectionResource, n.dc+"title", collection.name, true);
	
	for each(var child in collection.descendents) {
		// add child list items
		if(child.type == "collection") {
			Zotero.RDF.addStatement(collectionResource, n.dcterms+"hasPart", "#collection_"+child.id, false);
			// do recursive processing of collections
			generateCollection(child);
		} else if(itemResources[child.id]) {
			Zotero.RDF.addStatement(collectionResource, n.dcterms+"hasPart", itemResources[child.id], false);
		}
	}
}

function generateItem(item, zoteroType, resource) {
	var container = null;
	var containerElement = null;
	
	/** CORE FIELDS **/
	
	// type
	var type = null;
	if(zoteroType == "book") {
		type = n.bib+"Book";
	} else if (zoteroType == "bookSection") {
		type = n.bib+"BookSection";
		container = n.bib+"Book";
	} else if(zoteroType == "journalArticle") {
		type = n.bib+"Article";
		container = n.bib+"Journal";
	} else if(zoteroType == "magazineArticle") {
		type = n.bib+"Article";
		container = n.bib+"Periodical";
	} else if(zoteroType == "newspaperArticle") {
		type = n.bib+"Article";
		container = n.bib+"Newspaper";
	} else if(zoteroType == "thesis") {
		type = n.bib+"Thesis";
	} else if(zoteroType == "letter") {
		type = n.bib+"Letter";
	} else if(zoteroType == "manuscript") {
		type = n.bib+"Manuscript";
	} else if(zoteroType == "interview") {
		type = n.bib+"Interview";
	} else if(zoteroType == "film") {
		type = n.bib+"MotionPicture";
	} else if(zoteroType == "artwork") {
		type = n.bib+"Illustration";
	} else if(zoteroType == "webpage") {
		type = n.bib+"Document";
		container = n.z+"Website";
	} else if(zoteroType == "note") {
		type = n.bib+"Memo";
		if(!Zotero.getOption("exportNotes")) {
			return;
		}
	} else if(zoteroType == "attachment") {
		type = n.z+"Attachment";
	} else if(zoteroType == "report") {
		type = n.bib+"Report";
	} else if(zoteroType == "bill") {
		type = n.bib+"Legislation";
	} else if(zoteroType == "case") {
		type = n.bib+"Document";	// ??
		container = n.bib+"CourtReporter";
	} else if(zoteroType == "hearing") {
		type = n.bib+"Report";
	} else if(zoteroType == "patent") {
		type = n.bib+"Patent";
	} else if(zoteroType == "statute") {
		type = n.bib+"Legislation";
	} else if(zoteroType == "email") {
		type = n.bib+"Letter";
	} else if(zoteroType == "map") {
		type = n.bib+"Image";
	} else if(zoteroType == "blogPost") {
		type = n.bib+"Document";
		container = n.z+"Blog";
	} else if(zoteroType == "instantMessage") {
		type = n.bib+"Letter";
	} else if(zoteroType == "forumPost") {
		type = n.bib+"Document";
		container = n.z+"Forum";
	} else if(zoteroType == "audioRecording") {
		type = n.bib+"Recording";
	} else if(zoteroType == "presentation") {
		type = n.bib+"ConferenceProceedings";
	} else if(zoteroType == "videoRecording") {
		type = n.bib+"Recording";
	} else if(zoteroType == "tvBroadcast") {
		type = n.bib+"Recording";
	} else if(zoteroType == "radioBroadcast") {
		type = n.bib+"Recording";
	} else if(zoteroType == "podcast") {
		type = n.bib+"Recording";
	} else if(zoteroType == "computerProgram") {
		type = n.bib+"Data";
	}
	
	if(type) {
		Zotero.RDF.addStatement(resource, rdf+"type", type, false);
	}
	Zotero.RDF.addStatement(resource, n.z+"itemType", zoteroType, true);
	
	// generate section
	if(item.section) {
		var section = Zotero.RDF.newResource();
		// set section type
		Zotero.RDF.addStatement(section, rdf+"type", n.bib+"Part", false);
		// set section title
		Zotero.RDF.addStatement(section, n.dc+"title", item.section, true);
		// add relationship to resource
		Zotero.RDF.addStatement(resource, n.dcterms+"isPartOf", section, false);
	}
	
	// generate container
	if(container) {
		if(item.ISSN && !Zotero.RDF.getArcsIn("urn:issn:"+item.ISSN)) {
			// use ISSN as container URI if no other item is
			containerElement = "urn:issn:"+item.ISSN;
		} else {
			containerElement = Zotero.RDF.newResource();
		}
		// attach container to section (if exists) or resource
		Zotero.RDF.addStatement((section ? section : resource), n.dcterms+"isPartOf", containerElement, false);
		// add container type
		Zotero.RDF.addStatement(containerElement, rdf+"type", container, false);
	}
	
	// generate series
	if(item.series || item.seriesTitle || item.seriesText || item.seriesNumber) {
		var series = Zotero.RDF.newResource();
		// set series type
		Zotero.RDF.addStatement(series, rdf+"type", n.bib+"Series", false);
		// add relationship to resource
		Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.dcterms+"isPartOf", series, false);
	}
	
	// generate publisher
	if(item.publisher || item.distributor || item.label || item.company || item.institution || item.place) {
		var organization = Zotero.RDF.newResource();
		// set organization type
		Zotero.RDF.addStatement(organization, rdf+"type", n.foaf+"Organization", false);
		// add relationship to resource
		Zotero.RDF.addStatement(resource, n.dc+"publisher", organization, false);
	}
	
	var typeProperties = ["reportType", "videoRecordingType", "letterType",
							"manuscriptType", "mapType", "thesisType", "websiteType",
							"audioRecordingType", "presentationType", "postType",
							"audioFileType"];
	var ignoreProperties = ["itemID", "itemType", "firstCreator", "dateAdded",
							"dateModified", "section", "sourceItemID"];
	
	// creators
	if(item.creators) {			// authors/editors/contributors
		var creatorContainers = new Object();
		
		// not yet in biblio
		var biblioCreatorTypes = ["author", "editor", "contributor"];
		
		for(var j in item.creators) {
			var creator = Zotero.RDF.newResource();
			Zotero.RDF.addStatement(creator, rdf+"type", n.foaf+"Person", false);
			// gee. an entire vocabulary for describing people, and these aren''t even
			// standardized in it. oh well. using them anyway.
			Zotero.RDF.addStatement(creator, n.foaf+"surname", item.creators[j].lastName, true);
			Zotero.RDF.addStatement(creator, n.foaf+"givenname", item.creators[j].firstName, true);
			
			if(biblioCreatorTypes.indexOf(item.creators[j].creatorType) != -1) {
				var cTag = n.bib+item.creators[j].creatorType+"s";
			} else {
				var cTag = n.z+item.creators[j].creatorType+"s";
			}
			
			if(!creatorContainers[cTag]) {
				var creatorResource = Zotero.RDF.newResource();
				// create new seq for author type
				creatorContainers[cTag] = Zotero.RDF.newContainer("seq", creatorResource);
				// attach container to resource
				Zotero.RDF.addStatement(resource, cTag, creatorResource, false);
			}
			Zotero.RDF.addContainerElement(creatorContainers[cTag], creator, false);
		}
	}
	
	// notes
	if(item.notes && Zotero.getOption("exportNotes")) {
		for(var j in item.notes) {
			var noteResource = itemResources[item.notes[j].itemID];
			
			// add note tag
			Zotero.RDF.addStatement(noteResource, rdf+"type", n.bib+"Memo", false);
			// add note item.notes
			Zotero.RDF.addStatement(noteResource, rdf+"value", item.notes[j].note, true);
			// add relationship between resource and note
			Zotero.RDF.addStatement(resource, n.dcterms+"isReferencedBy", noteResource, false);
			
			// Add see also info to RDF
			generateSeeAlso(noteResource, item.notes[j].seeAlso);
			generateTags(noteResource, item.notes[j].tags);
		}
	}
	
	// child attachments
	if(item.attachments) {
		for each(var attachment in item.attachments) {
			var attachmentResource = itemResources[attachment.itemID];
			Zotero.RDF.addStatement(resource, n.link+"link", attachmentResource, false);
			generateItem(attachment, "attachment", attachmentResource);
		}
	}
	
	// relative file path for attachment items
	if(item.path) {
		Zotero.RDF.addStatement(resource, rdf+"resource", item.path, false);
	}
    
	// seeAlso and tags
	if(item.seeAlso) generateSeeAlso(resource, item.seeAlso);
	if(item.tags) generateTags(resource, item.tags);
	
	for(var property in item.uniqueFields) {
		var value = item[property];
		if(!value) continue;
		
		if(property == "title") {					// title
			Zotero.RDF.addStatement(resource, n.dc+"title", value, true);
		} else if(property == "source") {			// authors/editors/contributors
			Zotero.RDF.addStatement(resource, n.dc+"source", value, true);
		} else if(property == "url") {				// url
			// add url as identifier
			var term = Zotero.RDF.newResource();
			// set term type
			Zotero.RDF.addStatement(term, rdf+"type", n.dcterms+"URI", false);
			// set url value
			Zotero.RDF.addStatement(term, rdf+"value", value, true);
			// add relationship to resource
			Zotero.RDF.addStatement(resource, n.dc+"identifier", term, false);
		} else if(property == "accessionNumber") {	// accessionNumber as generic ID
			Zotero.RDF.addStatement(resource, n.dc+"identifier", value, true);
		} else if(property == "rights") {			// rights
			Zotero.RDF.addStatement(resource, n.dc+"rights", value, true);
		} else if(property == "edition" ||			// edition
		          property == "version") {			// version
			Zotero.RDF.addStatement(resource, n.prism+"edition", value, true);
		} else if(property == "date") {				// date
			Zotero.RDF.addStatement(resource, n.dc+"date", value, true);
		} else if(property == "accessDate") {		// accessDate
			Zotero.RDF.addStatement(resource, n.dcterms+"dateSubmitted", value, true);
		} else if(property == "issueDate") {		// issueDate
			Zotero.RDF.addStatement(resource, n.dcterms+"issued", value, true);
		} else if(property == "pages") {			// pages
			// not yet part of biblio, but should be soon
			Zotero.RDF.addStatement(resource, n.bib+"pages", value, true);
		} else if(property == "extra") {			// extra
			Zotero.RDF.addStatement(resource, n.dc+"description", value, true);
		} else if(property == "mimeType") {			// mimeType
			Zotero.RDF.addStatement(resource, n.link+"type", value, true);
		} else if(property == "charset") {			// charset
			Zotero.RDF.addStatement(resource, n.link+"charset", value, true);
		// THE FOLLOWING ARE ALL PART OF THE CONTAINER
		} else if(property == "ISSN") {				// ISSN
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.dc+"identifier", "ISSN "+value, true);
		} else if(property == "ISBN") {				// ISBN
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.dc+"identifier", "ISBN "+value, true);
		} else if(property == "DOI") {				// DOI
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.dc+"identifier", "DOI "+value, true);
		} else if(property == "publicationTitle" ||	// publicationTitle
		          property == "reporter") {			// reporter
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.dc+"title", value, true);
		} else if(property == "journalAbbreviation") {	// journalAbbreviation
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.dcterms+"alternative", value, true);
		} else if(property == "volume") {			// volume
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.prism+"volume", value, true);
		} else if(property == "issue" ||			// issue
				  property == "number" ||			// number
				  property == "patentNumber") {		// patentNumber
			Zotero.RDF.addStatement((containerElement ? containerElement : resource), n.prism+"number", value, true);
		} else if(property == "callNumber") {
			var term = Zotero.RDF.newResource();
			// set term type
			Zotero.RDF.addStatement(term, rdf+"type", n.dcterms+"LCC", false);
			// set callNumber value
			Zotero.RDF.addStatement(term, rdf+"value", value, true);
			// add relationship to resource
			Zotero.RDF.addStatement(resource, n.dc+"subject", term, false);
		} else if(property == "abstractNote") {
			Zotero.RDF.addStatement(resource, n.dcterms+"abstract", value, true);
		// THE FOLLOWING ARE ALL PART OF THE SERIES
		} else if(property == "series") {			// series
			Zotero.RDF.addStatement(series, n.dc+"title", value, true);
		} else if(property == "seriesTitle") {		// seriesTitle
			Zotero.RDF.addStatement(series, n.dcterms+"alternative", value, true);
		} else if(property == "seriesText") {		// seriesText
			Zotero.RDF.addStatement(series, n.dc+"description", value, true);
		} else if(property == "seriesNumber") {		// seriesNumber
			Zotero.RDF.addStatement(series, n.dc+"identifier", value, true);
		// THE FOLLOWING ARE ALL PART OF THE PUBLISHER
		} else if(property == "publisher" ||		// publisher
		          property == "distributor" ||		// distributor (film)
		          property == "label" ||			// label (audioRecording)
		          property == "company" ||			// company (computerProgram)
		          property == "institution") {		// institution (report)
			Zotero.RDF.addStatement(organization, n.foaf+"name", value, true);
		} else if(property == "place") {			// place
			var address = Zotero.RDF.newResource();
			// set address type
			Zotero.RDF.addStatement(address, rdf+"type", n.vcard+"Address", false);
			// set address locality
			Zotero.RDF.addStatement(address, n.vcard+"locality", value, true);
			// add relationship to organization
			Zotero.RDF.addStatement(organization, n.vcard+"adr", address, false);
		} else if(property == "archiveLocation") {	// archiveLocation
			Zotero.RDF.addStatement(resource, n.dc+"coverage", value, true);
		} else if(property == "interviewMedium" ||
		          property == "artworkMedium") {	// medium
			Zotero.RDF.addStatement(resource, n.dcterms+"medium", value, true);
		} else if(property == "conferenceName") {
			var conference = Zotero.RDF.newResource();
			// set conference type
			Zotero.RDF.addStatement(conference, rdf+"type", n.bib+"Conference", false);
			// set conference title
			Zotero.RDF.addStatement(conference, n.dc+"title", value, true);
			// add relationship to conference
			Zotero.RDF.addStatement(resource, n.bib+"presentedAt", conference, false);
		} else if(typeProperties.indexOf(property) != -1) {
			Zotero.RDF.addStatement(resource, n.dc+"type", value, true);
		// THE FOLLOWING RELATE TO NOTES
		} else if(property == "note") {
			if(Zotero.getOption("exportNotes")) {
				if(item.itemType == "attachment") {
					Zotero.RDF.addStatement(resource, n.dc+"description", value, true);
				} else if(item.itemType == "note") {
					Zotero.RDF.addStatement(resource, rdf+"value", value, true);
				}
			}
		// THIS CATCHES ALL REMAINING PROPERTIES
		} else if(ignoreProperties.indexOf(property) == -1) {
			Zotero.debug("Zotero RDF: using Zotero namespace for property "+property);
			Zotero.RDF.addStatement(resource, n.z+property, value, true);
		}
	}
}

function doExport() {
	// add namespaces
	for(var i in n) {
		Zotero.RDF.addNamespace(i, n[i]);
	}
	
	// leave as global
	itemResources = new Array();
	
	// keep track of resources already assigned (in case two book items have the
	// same ISBN, or something like that)
	var usedResources = new Array();
	
	var items = new Array();
	
	// first, map each ID to a resource
	while(item = Zotero.nextItem()) {
		items.push(item);
		
		if(item.ISBN && !usedResources["urn:isbn:"+item.ISBN]) {
			itemResources[item.itemID] = "urn:isbn:"+item.ISBN;
			usedResources[itemResources[item.itemID]] = true;
		} else if(item.itemType != "attachment" && item.url && !usedResources[item.url]) {
			itemResources[item.itemID] = item.url;
			usedResources[itemResources[item.itemID]] = true;
		} else {
			// just specify a node ID
			itemResources[item.itemID] = "#item_"+item.itemID;
		}
		
		for(var j in item.notes) {
			itemResources[item.notes[j].itemID] = "#item_"+item.notes[j].itemID;
		}
		
		for each(var attachment in item.attachments) {
			// just specify a node ID
			itemResources[attachment.itemID] = "#item_"+attachment.itemID;
		}
	}
	
	for each(item in items) {
		// these items are global
		generateItem(item, item.itemType, itemResources[item.itemID]);
	}
	
	/** RDF COLLECTION STRUCTURE **/
	var collection;
	while(collection = Zotero.nextCollection()) {
		generateCollection(collection);
	}
}');

REPLACE INTO translators VALUES ('6e372642-ed9d-4934-b5d1-c11ac758ebb7', '1.0.0b3.r1', '', '2006-10-02 17:00:00', 1, 100, 2, 'Unqualified Dublin Core RDF', 'Simon Kornblith', 'rdf',
'Zotero.configure("dataMode", "rdf");',
'function doExport() {
	var dc = "http://purl.org/dc/elements/1.1/";
	Zotero.RDF.addNamespace("dc", dc);
	
	var item;
	while(item = Zotero.nextItem()) {
		if(item.itemType == "note" || item.itemType == "attachment") {
			continue;
		}
		
		var resource;
		if(item.ISBN) {
			resource = "urn:isbn:"+item.ISBN;
		} else if(item.url) {
			resource = item.url;
		} else {
			// just specify a node ID
			resource = Zotero.RDF.newResource();
		}
		
		/** CORE FIELDS **/
		
		// title
		if(item.title) {
			Zotero.RDF.addStatement(resource, dc+"title", item.title, true);
		}
		
		// type
		Zotero.RDF.addStatement(resource, dc+"type", item.itemType, true);
		
		// creators
		for(var j in item.creators) {
			// put creators in lastName, firstName format (although DC doesn''t specify)
			var creator = item.creators[j].lastName;
			if(item.creators[j].firstName) {
				creator += ", "+item.creators[j].firstName;
			}
			
			if(item.creators[j].creatorType == "author") {
				Zotero.RDF.addStatement(resource, dc+"creator", creator, true);
			} else {
				Zotero.RDF.addStatement(resource, dc+"contributor", creator, true);
			}
		}
		
		/** FIELDS ON NEARLY EVERYTHING BUT NOT A PART OF THE CORE **/
		
		// source
		if(item.source) {
			Zotero.RDF.addStatement(resource, dc+"source", item.source, true);
		}
		
		// accessionNumber as generic ID
		if(item.accessionNumber) {
			Zotero.RDF.addStatement(resource, dc+"identifier", item.accessionNumber, true);
		}
		
		// rights
		if(item.rights) {
			Zotero.RDF.addStatement(resource, dc+"rights", item.rights, true);
		}
		
		/** SUPPLEMENTAL FIELDS **/
		
		// TODO - create text citation and OpenURL citation to handle volume, number, pages, issue, place
		
		// publisher/distributor
		if(item.publisher) {
			Zotero.RDF.addStatement(resource, dc+"publisher", item.publisher, true);
		} else if(item.distributor) {
			Zotero.RDF.addStatement(resource, dc+"publisher", item.distributor, true);
		} else if(item.institution) {
			Zotero.RDF.addStatement(resource, dc+"publisher", item.distributor, true);
		}
		
		// date/year
		if(item.date) {
			Zotero.RDF.addStatement(resource, dc+"date", item.date, true);
		}
		
		// ISBN/ISSN/DOI
		if(item.ISBN) {
			Zotero.RDF.addStatement(resource, dc+"identifier", "ISBN "+item.ISBN, true);
		}
		if(item.ISSN) {
			Zotero.RDF.addStatement(resource, dc+"identifier", "ISSN "+item.ISSN, true);
		}
		if(item.DOI) {
			Zotero.RDF.addStatement(resource, dc+"identifier", "DOI "+item.DOI, true);
		}
		
		// callNumber
		if(item.callNumber) {
			Zotero.RDF.addStatement(resource, dc+"identifier", item.callNumber, true);
		}
		
		// archiveLocation
		if(item.archiveLocation) {
			Zotero.RDF.addStatement(resource, dc+"coverage", item.archiveLocation, true);
		}
		
		// medium
		if(item.medium) {
			Zotero.RDF.addStatement(resource, dcterms+"medium", item.medium, true);
		}
	}
}');

REPLACE INTO translators VALUES ('5e3ad958-ac79-463d-812b-a86a9235c28f', '1.0.0b4.r1', '', '2007-03-22 15:55:00', 1, 100, 1, 'RDF', 'Simon Kornblith', 'rdf',
'Zotero.configure("dataMode", "rdf");

function detectImport() {
	// unfortunately, Mozilla will let you create a data source from any type
	// of XML, so we need to make sure there are actually nodes
	
	var nodes = Zotero.RDF.getAllResources();
	if(nodes) {
		return true;
	}
}',
'var rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

var n = {
	bib:"http://purl.org/net/biblio#",
	dc:"http://purl.org/dc/elements/1.1/",
	dcterms:"http://purl.org/dc/terms/",
	prism:"http://prismstandard.org/namespaces/1.2/basic/",
	foaf:"http://xmlns.com/foaf/0.1/",
	vcard:"http://nwalsh.com/rdf/vCard#",
	link:"http://purl.org/rss/1.0/modules/link/",
	z:"http://www.zotero.org/namespaces/export#"
};

var callNumberTypes = [n.dcterms+"LCC", n.dcterms+"DDC", n.dcterms+"UDC"];

var defaultUnknownType = "book";

// gets the first result set for a property that can be encoded in multiple
// ontologies
function getFirstResults(node, properties, onlyOneString) {
	for(var i=0; i<properties.length; i++) {
		var result = Zotero.RDF.getTargets(node, properties[i]);
		if(result) {
			if(onlyOneString) {
				// onlyOneString means we won''t return nsIRDFResources, only
				// actual literals
				if(typeof(result[0]) != "object") {
					return result[0];
				}
			} else {
				return result;
			}
		}
	}
	return;	// return undefined on failure
}

// adds creators to an item given a list of creator nodes
function handleCreators(newItem, creators, creatorType) {
	if(!creators) {
		return;
	}
	
	if(typeof(creators[0]) != "string") {	// see if creators are in a container
		try {
			var creators = Zotero.RDF.getContainerElements(creators[0]);
		} catch(e) {}
	}
	
	if(typeof(creators[0]) == "string") {	// support creators encoded as strings
		for(var i in creators) {
			if(typeof(creators[i]) != "object") {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(creators[i], creatorType, true));
			}
		}
	} else {								// also support foaf
		for(var i in creators) {
			var type = Zotero.RDF.getTargets(creators[i], rdf+"type");
			if(type) {
				type = Zotero.RDF.getResourceURI(type[0]);
				if(type == n.foaf+"Person") {	// author is FOAF type person
					var creator = new Array();
					creator.lastName = getFirstResults(creators[i],
						[n.foaf+"surname", n.foaf+"family_name"], true);
					creator.firstName = getFirstResults(creators[i],
						[n.foaf+"givenname", n.foaf+"firstName"], true);
					creator.creatorType = creatorType;
					newItem.creators.push(creator);
				}
			}
		}
	}
}

// processes collections recursively
function processCollection(node, collection) {
	if(!collection) {
		collection = new Array();
	}
	collection.type = "collection";
	collection.name = getFirstResults(node, [n.dc+"title"], true);
	collection.children = new Array();
	
	// check for children
	var children = getFirstResults(node, [n.dcterms+"hasPart"]);
	for each(var child in children) {
		var type = Zotero.RDF.getTargets(child, rdf+"type");
		if(type) {
			type = Zotero.RDF.getResourceURI(type[0]);
		}
		
		if(type == n.bib+"Collection" || type == n.z+"Collection") {
			// for collections, process recursively
			collection.children.push(processCollection(child));
		} else {
			// all other items are added by ID
			collection.children.push({id:Zotero.RDF.getResourceURI(child), type:"item"});
		}
	}
	
	return collection;
}

function processSeeAlso(node, newItem) {
	var relations;
	newItem.itemID = Zotero.RDF.getResourceURI(node);
	newItem.seeAlso = new Array();
	if(relations = getFirstResults(node, [n.dc+"relation"])) {
		for each(var relation in relations) {
			newItem.seeAlso.push(Zotero.RDF.getResourceURI(relation));
		}
	}
}

function processTags(node, newItem) {
	var subjects;
	newItem.tags = new Array();
	if(subjects = getFirstResults(node, [n.dc+"subject"])) {
		for each(var subject in subjects) {
			if(typeof(subject) == "string") {	// a regular tag
				newItem.tags.push(subject);
			} else {
				// a call number
				var type = Zotero.RDF.getTargets(subject, rdf+"type");
				if(type) {
					type = Zotero.RDF.getResourceURI(type[0]);
					if(type == n.z+"AutomaticTag") {
						newItem.tags.push({tag:getFirstResults(subject, [rdf+"value"], true), type:1});
					}
				}
			}
		}
	}
}

// gets the node with a given type from an array
function getNodeByType(nodes, type) {
	if(!nodes) {
		return false;
	}
	
	for each(var node in nodes) {
		var nodeType = Zotero.RDF.getTargets(node, rdf+"type");
		if(nodeType) {
			nodeType = Zotero.RDF.getResourceURI(nodeType[0]);
			if(nodeType == type) {	// we have a node of the correct type
				return node;
			}
		}
	}
	return false;
}

// returns true if this resource is part of another (related by any arc besides
// dc:relation or dcterms:hasPart)
//
// used to differentiate independent notes and files
function isPart(node) {
	var arcs = Zotero.RDF.getArcsIn(node);
	var skip = false;
	for each(var arc in arcs) {
		arc = Zotero.RDF.getResourceURI(arc);
		if(arc != n.dc+"relation" && arc != n.dcterms+"hasPart") {	
			// related to another item by some arc besides see also
			skip = true;
		}
	}
	return skip;
}

function importItem(newItem, node, type) {
	var container = undefined;
	
	// also deal with type detection based on parts, so we can differentiate
	// magazine and journal articles, and find container elements
	var isPartOf = getFirstResults(node, [n.dcterms+"isPartOf"]);
	
	// get parts of parts, because parts are sections of wholes.
	if(isPartOf) {
		for(var i=0; i<isPartOf.length; i++) {
			var subParts = getFirstResults(isPartOf[i], [n.dcterms+"isPartOf"]);
			if(subParts) {
				isPartOf = isPartOf.concat(subParts);
			}
		}
	}
	
	if(type) {
		if(type == n.bib+"Book") {
			newItem.itemType = "book";
		} else if(type == n.bib+"BookSection") {
			newItem.itemType = "bookSection";
			container = getNodeByType(isPartOf, n.bib+"Book");
		} else if(type == n.bib+"Article") {	// choose between journal,
												// newspaper, and magazine
												// articles
			// use of container = (not container ==) is intentional
			if(container = getNodeByType(isPartOf, n.bib+"Journal")) {
				newItem.itemType = "journalArticle";
			} else if(container = getNodeByType(isPartOf, n.bib+"Periodical")) {
				newItem.itemType = "magazineArticle";
			} else if(container = getNodeByType(isPartOf, n.bib+"Newspaper")) {
				newItem.itemType = "newspaperArticle";
			}
		} else if(type == n.bib+"Thesis") {
			newItem.itemType = "thesis";
		} else if(type == n.bib+"Letter") {
			newItem.itemType = "letter";
		} else if(type == n.bib+"Manuscript") {
			newItem.itemType = "manuscript";
		} else if(type == n.bib+"Interview") {
			newItem.itemType = "interview";
		} else if(type == n.bib+"MotionPicture") {
			newItem.itemType = "film";
		} else if(type == n.bib+"Illustration") {
			newItem.itemType = "artwork";
		} else if(type == n.bib+"Document") {
			if(container = getNodeByType(isPartOf, n.bib+"CourtReporter")) {
				newItem.itemType = "case";
			} else {
				newItem.itemType = "webpage";
			}
		} else if(type == n.bib+"Memo") {
			newItem.itemType = "note";
		} else if(type == n.z+"Attachment") {
			// unless processing of independent attachment is intended, don''t
			// process
			
			// process as file
			newItem.itemType = "attachment";

			var path = getFirstResults(node, [rdf+"resource"]);
			if(path) {
				newItem.path = Zotero.RDF.getResourceURI(path[0]);
			}
			newItem.charset = getFirstResults(node, [n.link+"charset"], true);
			newItem.mimeType = getFirstResults(node, [n.link+"type"], true);
		} else if(type == n.bib+"Report") {
			newItem.itemType = "report";
		} else if(type == n.bib+"Legislation") {
			newItem.itemType = "statute";
		} else if(type == n.bib+"Patent") {
			newItem.itemType = "patent";
		} else if(type == n.bib+"Image") {
			newItem.itemType = "artwork";
		} else if(type == n.bib+"Recording") {
			newItem.itemType = "audioRecording";
		}
	}
	
	// check to see if we recognize the type in the fs or dc namespaces
	var zoteroType = getFirstResults(node, [n.z+"itemType", n.z+"type", n.dc+"type"], true);
	if(Zotero.Utilities.itemTypeExists(zoteroType)) {
		newItem.itemType = zoteroType;
	}
	
	if(newItem.itemType == "blogPost") {
		container = getNodeByType(isPartOf, n.z+"Blog");
	} else if(newItem.itemType == "forumPost") {
		container = getNodeByType(isPartOf, n.z+"Forum");
	} else if(newItem.itemType == "webpage") {
		container = getNodeByType(isPartOf, n.z+"Website");
	}
	
	// title
	newItem.title = getFirstResults(node, [n.dc+"title"], true);
	if(!newItem.itemType && !newItem.title) {			// require the title
														// (if not a known type)
		return false;
	}
	
	if(!newItem.itemType) {
		newItem.itemType = defaultUnknownType;
	}
	
	// regular author-type creators
	var possibleCreatorTypes = Zotero.Utilities.getCreatorsForType(newItem.itemType);
	for each(var creatorType in possibleCreatorTypes) {
		if(creatorType == "author") {
			var creators = getFirstResults(node, [n.bib+"authors", n.dc+"creator"]);
		} else if(creatorType == "editor" || creatorType == "contributor") {
			var creators = getFirstResults(node, [n.bib+creatorType+"s"]);
		} else {
			var creators = getFirstResults(node, [n.z+creatorType+"s"]);
		}
		
		if(creators) handleCreators(newItem, creators, creatorType);
	}
	
	// source
	newItem.source = getFirstResults(node, [n.dc+"source"], true);
	
	// rights
	newItem.rights = getFirstResults(node, [n.dc+"rights"], true);
	
	// section
	var section = getNodeByType(isPartOf, n.bib+"Part");
	if(section) {
		newItem.section = getFirstResults(section, [n.dc+"title"], true);
	}
	
	// publication
	if(container) {
		newItem.publicationTitle = getFirstResults(container, [n.dc+"title"], true);
		// these fields mean the same thing
		newItem.reporter = newItem.publicationTitle;
	}
	
	// series
	var series = getNodeByType(isPartOf, n.bib+"Series");
	if(series) {
		newItem.series = getFirstResults(series, [n.dc+"title"], true);
		newItem.seriesTitle = getFirstResults(series, [n.dcterms+"alternative"], true);
		newItem.seriesText = getFirstResults(series, [n.dc+"description"], true);
		newItem.seriesNumber = getFirstResults(series, [n.dc+"identifier"], true);
	}
	
	// volume
	newItem.volume = getFirstResults((container ? container : node), [n.prism+"volume"], true);
	
	// issue
	newItem.issue = getFirstResults((container ? container : node), [n.prism+"number"], true);
	// these mean the same thing
	newItem.patentNumber = newItem.number = newItem.issue;
	
	// edition
	newItem.edition = getFirstResults(node, [n.prism+"edition"], true);
	// these fields mean the same thing
	newItem.version = newItem.edition;
	
	// pages
	newItem.pages = getFirstResults(node, [n.bib+"pages"], true);
	
	// mediums
	newItem.artworkMedium = newItem.interviewMedium = getFirstResults(node, [n.dcterms+"medium"], true);
	
	// publisher
	var publisher = getFirstResults(node, [n.dc+"publisher"]);
	if(publisher) {
		if(typeof(publisher[0]) == "string") {
			newItem.publisher = publisher[0];
		} else {
			var type = Zotero.RDF.getTargets(publisher[0], rdf+"type");
			if(type) {
				type = Zotero.RDF.getResourceURI(type[0]);
				if(type == n.foaf+"Organization") {	// handle foaf organizational publishers
					newItem.publisher = getFirstResults(publisher[0], [n.foaf+"name"], true);
					var place = getFirstResults(publisher[0], [n.vcard+"adr"]);
					if(place) {
						newItem.place = getFirstResults(place[0], [n.vcard+"locality"]);
					}
				}
			}
		}
	}
	
	// these fields mean the same thing
	newItem.distributor = newItem.label = newItem.company = newItem.institution = newItem.publisher;
	
	// date
	newItem.date = getFirstResults(node, [n.dc+"date"], true);
	// accessDate
	newItem.accessDate = getFirstResults(node, [n.dcterms+"dateSubmitted"], true);
	// issueDate
	newItem.issueDate = getFirstResults(node, [n.dcterms+"issued"], true);
	// lastModified
	newItem.lastModified = getFirstResults(node, [n.dcterms+"modified"], true);
	
	// identifier
	var identifiers = getFirstResults(node, [n.dc+"identifier"]);
	if(container) {
		var containerIdentifiers = getFirstResults(container, [n.dc+"identifier"]);
		// concatenate sets of identifiers
		if(containerIdentifiers) {
			if(identifiers) {
				identifiers = identifiers.concat(containerIdentifiers);
			} else {
				identifiers = containerIdentifiers;
			}
		}
	}
	
	if(identifiers) {
		for(var i in identifiers) {
			if(typeof(identifiers[i]) == "string") {
				// grab other things
				var beforeSpace = identifiers[i].substr(0, identifiers[i].indexOf(" ")).toUpperCase();
				
				if(beforeSpace == "ISBN") {
					newItem.ISBN = identifiers[i].substr(5).toUpperCase();
				} else if(beforeSpace == "ISSN") {
					newItem.ISSN = identifiers[i].substr(5).toUpperCase();
				} else if(beforeSpace == "DOI") {
					newItem.DOI = identifiers[i].substr(4);
				} else if(!newItem.accessionNumber) {
					newItem.accessionNumber = identifiers[i];
				}
			} else {
				// grab URLs
				var type = Zotero.RDF.getTargets(identifiers[i], rdf+"type");
				if(type && (type = Zotero.RDF.getResourceURI(type[0])) && type == n.dcterms+"URI") {
					newItem.url = getFirstResults(identifiers[i], [rdf+"value"], true);
				}
			}
		}
	}
	
	// archiveLocation
	newItem.archiveLocation = getFirstResults(node, [n.dc+"coverage"], true);
	
	// abstract
	newItem.abstractNote = getFirstResults(node, [n.dcterms+"abstract"], true);
	
	// type
	var type = getFirstResults(node, [n.dc+"type"], true);
	// these all mean the same thing
	var typeProperties = ["reportType", "videoRecordingType", "letterType",
						"manuscriptType", "mapType", "thesisType", "websiteType",
						"audioRecordingType", "presentationType", "postType",
						"audioFileType"];
	for each(var property in typeProperties) {
		newItem[property] = type;
	}
	
	// conferenceName
	var conference = getFirstResults(node, [n.bib+"presentedAt"]);
	if(conference) {
		conference = conference[0];
		if(typeof(conference) == "string") {
			newItem.conferenceName = conference;
		} else {
			newItem.conferenceName = getFirstResults(conference, [n.dc+"title"], true);
		}
	}
	
	// journalAbbreviation
	newItem.journalAbbreviation = getFirstResults((container ? container : node), [n.dcterms+"alternative"], true);
	
	// see also
	processSeeAlso(node, newItem);
	
	// description/attachment note
	if(newItem.itemType == "attachment") {
		newItem.note = getFirstResults(node, [n.dc+"description"], true);
	} else {
		newItem.extra = getFirstResults(node, [n.dc+"description"], true);
	}
	
	/** NOTES **/
	
	var referencedBy = Zotero.RDF.getTargets(node, n.dcterms+"isReferencedBy");
	for each(var referentNode in referencedBy) {
		var type = Zotero.RDF.getTargets(referentNode, rdf+"type");
		if(type && Zotero.RDF.getResourceURI(type[0]) == n.bib+"Memo") {
			// if this is a memo
			var note = new Array();
			note.note = getFirstResults(referentNode, [rdf+"value", n.dc+"description"], true);
			if(note.note != undefined) {
				// handle see also
				processSeeAlso(referentNode, note);
				processTags(referentNode, note);
				
				// add note
				newItem.notes.push(note);
			}
		}
	}
	
	if(newItem.itemType == "note") {
		// add note for standalone
		newItem.note = getFirstResults(node, [rdf+"value", n.dc+"description"], true);
	}
	
	/** TAGS **/
	
	var subjects = getFirstResults(node, [n.dc+"subject"]);
	for each(var subject in subjects) {
		if(typeof(subject) == "string") {	// a regular tag
			newItem.tags.push(subject);
		} else {							// a call number or automatic tag
			var type = Zotero.RDF.getTargets(subject, rdf+"type");
			if(type) {
				type = Zotero.RDF.getResourceURI(type[0]);
				if(Zotero.Utilities.inArray(type, callNumberTypes)) {
					newItem.callNumber = getFirstResults(subject, [rdf+"value"], true);
				} else if(type == n.z+"AutomaticTag") {
					newItem.tags.push({tag:getFirstResults(subject, [rdf+"value"], true), type:1});
				}
			}
		}
	}
	
	/** ATTACHMENTS **/
	var relations = getFirstResults(node, [n.link+"link"]);
	for each(var relation in relations) {			
		var type = Zotero.RDF.getTargets(relation, rdf+"type");
		if(Zotero.RDF.getResourceURI(type[0]) == n.z+"Attachment") {
			var attachment = new Zotero.Item();
			newItem.attachments.push(attachment);
			importItem(attachment, relation, n.z+"Attachment");
		}
	}
	
	/** OTHER FIELDS **/
	var arcs = Zotero.RDF.getArcsOut(node);
	for each(var arc in arcs) {
		var uri = Zotero.RDF.getResourceURI(arc);
		if(uri.substr(0, n.z.length) == n.z) {
			var property = uri.substr(n.z.length);
			newItem[property] = Zotero.RDF.getTargets(node, n.z+property)[0];
		}
	}
	
	return true;
}

function doImport() {
	var nodes = Zotero.RDF.getAllResources();
	if(!nodes) {
		return false;
	}
	
	// keep track of collections while we''re looping through
	var collections = new Array();
	
	for each(var node in nodes) {
		var newItem = new Zotero.Item();
		newItem.itemID = Zotero.RDF.getResourceURI(node);
		
		// figure out if this is a part of another resource, or a linked
		// attachment
		if(Zotero.RDF.getSources(node, n.dcterms+"isPartOf") ||
		   Zotero.RDF.getSources(node, n.bib+"presentedAt") ||
		   Zotero.RDF.getSources(node, n.link+"link")) {
			continue;
		}
		
		// type
		var type = Zotero.RDF.getTargets(node, rdf+"type");
		if(type) {
			type = Zotero.RDF.getResourceURI(type[0]);
			
			// skip if this is not an independent attachment,
			if((type == n.z+"Attachment" || type == n.bib+"Memo") && isPart(node)) {
				continue;
			} else if(type == n.bib+"Collection" || type == n.z+"Collection") {
				// skip collections until all the items are done
				collections.push(node);
				continue;
			}
		} else {
			type = false;
		}
		
		if(importItem(newItem, node, type)) {
			newItem.complete();
		}
	}
	
	/* COLLECTIONS */
	
	for each(var collection in collections) {
		if(!Zotero.RDF.getArcsIn(collection)) {
			var newCollection = new Zotero.Collection();
			processCollection(collection, newCollection);
			newCollection.complete();
		}
	}
}');

REPLACE INTO translators VALUES ('32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7', '1.0.2', '', '2008-03-10 19:45:00', '1', '100', '3', 'RIS', 'Simon Kornblith', 'ris', 
'Zotero.configure("dataMode", "line");
Zotero.addOption("exportNotes", true);

function detectImport() {
	var line;
	var i = 0;
	while((line = Zotero.read()) !== "false") {
		line = line.replace(/^\s+/, "");
		if(line != "") {
			if(line.substr(0, 6).match(/^TY {1,2}- /)) {
				return true;
			} else {
				if(i++ > 3) {
					return false;
				}
			}
		}
	}
}', 
'var fieldMap = {
	ID:"itemID",
	T1:"title",
	T3:"series",
	JF:"publicationTitle",
	CP:"place",
	JA:"journalAbbreviation",
	M3:"DOI"
};

var inputFieldMap = {
	TI:"title",
	CT:"title",
	CY:"place"
};

// TODO: figure out if these are the best types for letter, interview, webpage
var typeMap = {
	book:"BOOK",
	bookSection:"CHAP",
	journalArticle:"JOUR",
	magazineArticle:"MGZN",
	newspaperArticle:"NEWS",
	thesis:"THES",
	letter:"PCOMM",
	manuscript:"PAMP",
	interview:"PCOMM",
	film:"MPCT",
	artwork:"ART",
	report:"RPRT",
	bill:"BILL",
	case:"CASE",
	hearing:"HEAR",
	patent:"PAT",
	statute:"STAT",
	map:"MAP",
	blogPost:"ELEC",
	webpage:"ELEC",
	instantMessage:"ICOMM",
	forumPost:"ICOMM",
	email:"ICOMM",
	audioRecording:"SOUND",
	presentation:"GEN",
	videoRecording:"VIDEO",
	tvBroadcast:"GEN",
	radioBroadcast:"GEN",
	podcast:"GEN",
	computerProgram:"COMP",
	conferencePaper:"CONF",
	document:"GEN"
};

// supplements outputTypeMap for importing
// TODO: DATA, MUSIC
var inputTypeMap = {
	ABST:"journalArticle",
	ADVS:"film",
	CTLG:"magazineArticle",
	INPR:"manuscript",
	JFULL:"journalArticle",
	PAMP:"manuscript",
	SER:"book",
	SLIDE:"artwork",
	UNBILL:"manuscript"
};

function processTag(item, tag, value) {
	if (Zotero.Utilities.unescapeHTML) {
		value = Zotero.Utilities.unescapeHTML(value);
	}
    
	if(fieldMap[tag]) {
		item[fieldMap[tag]] = value;
	} else if(inputFieldMap[tag]) {
		item[inputFieldMap[tag]] = value;
	} else if(tag == "TY") {
		// look for type

		// first check typeMap
		for(var i in typeMap) {
			if(value == typeMap[i]) {
				item.itemType = i;
			}
		}
		// then check inputTypeMap
		if(!item.itemType) {
			if(inputTypeMap[value]) {
				item.itemType = inputTypeMap[value];
			} else {
				// default to generic from inputTypeMap
				item.itemType = inputTypeMap["GEN"];
			}
		}
	} else if(tag == "JO") {
		if (item.itemType == "conferencePaper"){
			item.conferenceName = value;
		} else {
			item.publicationTitle = value;
		}
	} else if(tag == "BT") {
		// ignore, unless this is a book or unpublished work, as per spec
		if(item.itemType == "book" || item.itemType == "manuscript") {
			item.title = value;
		} else {
			item.backupPublicationTitle = value;
		}
	} else if(tag == "T2") {
		item.backupPublicationTitle = value;
	} else if(tag == "A1" || tag == "AU") {
		// primary author (patent: inventor)
		// store Zotero "creator type" in temporary variable
		var tempType;
		if (item.itemType == "patent") {
			tempType = "inventor";
		} else {
			tempType = "author";
		}
		var names = value.split(/, ?/);
		item.creators.push({lastName:names[0], firstName:names[1], creatorType:tempType});
	} else if(tag == "A2" || tag == "ED") {
		// contributing author (patent: assignee)
		if (item.itemType == "patent") {
			if (item.assignee) {
				// Patents can have multiple assignees (applicants) but Zotero only allows a single
				// assignee field, so we  have to concatenate them together
				item.assignee += ", "+value;
			} else {
				item.assignee =  value;
			}
		} else {
			var names = value.split(/, ?/);
			item.creators.push({lastName:names[0], firstName:names[1], creatorType:"contributor"});
		}
	} else if(tag == "Y1" || tag == "PY") {
		// year or date
		var dateParts = value.split("/");

		if(dateParts.length == 1) {
			// technically, if there''s only one date part, the file isn''t valid
			// RIS, but EndNote writes this, so we have to too
			// Nick: RIS spec example records also only contain a single part
			// even though it says the slashes are not optional (?)
			item.date = value;
		} else {
			// in the case that we have a year and other data, format that way

			var month = parseInt(dateParts[1]);
			if(month) {
				month--;
			} else {
				month = undefined;
			}

			item.date = Zotero.Utilities.formatDate({year:dateParts[0],
								  month:month,
								  day:dateParts[2],
								  part:dateParts[3]});
		}
	} else if(tag == "Y2") {
		// the secondary date field can mean two things, a secondary date, or an
		// invalid EndNote-style date. let''s see which one this is.
		// patent: application (filing) date -- do not append to date field 
		// for now. Zotero needs a filing date field added to make use of this.
		var dateParts = value.split("/");
		if(dateParts.length != 4 && item.itemType != "patent") {
			// an invalid date and not a patent. 
			// It''s from EndNote or Delphion (YYYY-MM-DD)
			if(item.date && value.indexOf(item.date) == -1) {
				// append existing year
				value += " " + item.date;
			}
			item.date = value;
		} 
		// ToDo: Handle correctly formatted Y2 fields (secondary date)
	} else if(tag == "N1" || tag == "AB") {
		// notes
		if(value != item.title) {       // why does EndNote do this!?
			item.notes.push({note:value});
		}
	} else if(tag == "N2") {
		// abstract
		item.abstractNote = value;
	} else if(tag == "KW") {
		// keywords/tags
		item.tags.push(value);
	} else if(tag == "SP") {
		// start page
		if(!item.pages) {
			item.pages = value;
		} else if(item.pages[0] == "-") {       // already have ending page
			item.pages = value + item.pages;
		} else {	// multiple ranges? hey, it''s a possibility
			item.pages += ", "+value;
		}
	} else if(tag == "EP") {
		// end page
		if(value) {
			if(!item.pages) {
				item.pages = value;
			} else if(value != item.pages) {
				item.pages += "-"+value;
			}
		}
	} else if(tag == "SN") {
		// ISSN/ISBN - just add both
		if(!item.ISBN) {
			item.ISBN = value;
		}
		if(!item.ISSN) {
			item.ISSN = value;
		}
	} else if(tag == "UR" || tag == "L1" || tag == "L2" || tag == "L4") {
		// URL
		if(!item.url) {
			item.url = value;
		}
		if(tag == "UR") {
			item.attachments.push({url:value});
		} else if(tag == "L1") {
			item.attachments.push({url:value, mimeType:"application/pdf",
				title:"Full Text (PDF)", downloadable:true});
		} else if(tag == "L2") {
			item.attachments.push({url:value, mimeType:"text/html",
				title:"Full Text (HTML)", downloadable:true});
		} else if(tag == "L4") {
			item.attachments.push({url:value,
				title:"Image", downloadable:true});
		}
	} else if (tag == "IS") {
		// Issue Number (patent: patentNumber)
		if (item.itemType == "patent") {
			item.patentNumber = value;
		} else {
			item.issue = value;
		}
	} else if (tag == "VL") {
		// Volume Number (patent: applicationNumber)
		if (item.itemType == "patent") {
			item.applicationNumber = value;
		} else {
			item.volume = value;
		}
	} else if (tag == "PB") {
		// publisher (patent: references)
		if (item.itemType == "patent") {
			item.references = value;
		} else {
			item.publisher = value;
		}
	} else if (tag == "M1" || tag == "M2") {
		// Miscellaneous fields
		if (!item.extra) {
			item.extra = value;
		} else {
			item.extra += "; "+value;
		}
	}
}

function completeItem(item) {
	// if backup publication title exists but not proper, use backup
	// (hack to get newspaper titles from EndNote)
	if(item.backupPublicationTitle) {
		if(!item.publicationTitle) {
			item.publicationTitle = item.backupPublicationTitle;
		}
		item.backupPublicationTitle = undefined;
	}
	// hack for sites like Nature, which only use JA, journal abbreviation
	if(item.journalAbbreviation && !item.publicationTitle){
		item.publicationTitle = item.journalAbbreviation;
	}
	item.complete();
}

function doImport(attachments) {
	// this is apparently the proper character set for RIS, although i''m not
	// sure how many people follow this
	Zotero.setCharacterSet("IBM850");

	var line = true;
	var tag = data = false;
	do {    // first valid line is type
		Zotero.debug("ignoring "+line);
		line = Zotero.read();
		line = line.replace(/^\s+/, "");
	} while(line !== false && !line.substr(0, 6).match(/^TY {1,2}- /));

	var item = new Zotero.Item();
	var i = 0;
	if(attachments && attachments[i]) {
		item.attachments = attachments[i];
	}

	var tag = "TY";
	
	// Handle out-of-spec old EndNote exports
	if (line.substr(0, 5) == "TY - ") {
		var data = line.substr(5);
	}
	else {
		var data = line.substr(6);
	}
	
	var rawLine;
	while((rawLine = Zotero.read()) !== false) {    // until EOF
		// trim leading space if this line is not part of a note
		line = rawLine.replace(/^\s+/, "");
		Zotero.debug("line is "+rawLine);
		if(line.substr(2, 4) == "  - " || line == "ER  -" || line.substr(0, 5) == "TY - ") {
			// if this line is a tag, take a look at the previous line to map
			// its tag
			if(tag) {
				processTag(item, tag, data);
			}

			// then fetch the tag and data from this line
			tag = line.substr(0,2);
			
			// Handle out-of-spec old EndNote exports
			if (line.substr(0, 5) == "TY - ") {
				data = line.substr(5);
			}
			else {
				data = line.substr(6);
			}

			Zotero.debug("tag: ''"+tag+"''; data: ''"+data+"''");

			if(tag == "ER") {	       // ER signals end of reference
				// unset info
				tag = data = false;
				// new item
				completeItem(item);
				item = new Zotero.Item();
				i++;
				if(attachments && attachments[i]) {
					item.attachments = attachments[i];
				}
			}
		} else {
			// otherwise, assume this is data from the previous line continued
			if(tag == "N1" || tag == "N2" || tag == "AB") {
				// preserve line endings for N1/N2/AB fields, for EndNote
				// compatibility
				data += "\n"+rawLine;
			} else if(tag) {
				// otherwise, follow the RIS spec
				if(data[data.length-1] == " ") {
					data += rawLine;
				} else {
					data += " "+rawLine;
				}
			}
		}
	}

	if(tag && tag != "ER") {	// save any unprocessed tags
		Zotero.debug(tag);
		processTag(item, tag, data);
		completeItem(item);
	}
}

function addTag(tag, value) {
	if(value) {
		Zotero.write(tag+"  - "+value+"\r\n");
	}
}

function doExport() {
	// this is apparently the proper character set for RIS, although i''m not
	// sure how many people follow this
	Zotero.setCharacterSet("IBM850");

	var item;

	while(item = Zotero.nextItem()) {
		// can''t store independent notes in RIS
		if(item.itemType == "note" || item.itemType == "attachment") {
			continue;
		}

		// type
		addTag("TY", typeMap[item.itemType] ? typeMap[item.itemType] : "GEN");

		// use field map
		for(var j in fieldMap) {
			if(item[fieldMap[j]]) addTag(j, item[fieldMap[j]]);
		}

		// creators
		for(var j in item.creators) {
			// only two types, primary and secondary
			var risTag;
			// authors and inventors are primary creators
			if (item.creators[j].creatorType == "author" || item.creators[j].creatorType == "inventor") {
				risTag = "A1";
			} else {
				risTag = "A2";
			}

			addTag(risTag, item.creators[j].lastName+","+item.creators[j].firstName);
		}
		
		// assignee (patent)
		if(item.assignee) {
			addTag("A2", item.assignee);
		}
		
		// volume (patent: applicationNumber)
		if(item.volume || item.applicationNumber) {
			var value = (item.volume) ? item.volume : item.applicationNumber;
			addTag("VL", value);
		}
		
		// issue (patent: patentNumber)
		if(item.issue || item.patentNumber) {
			var value = (item.issue) ? item.issue : item.patentNumber;
			addTag("IS", value);
		}

		// publisher (patent: references)
		if(item.publisher || item.references) {
			var value = (item.publisher) ? item.publisher : item.references;
			addTag("PB", value);
		}


		// date
		if(item.date) {
			var date = Zotero.Utilities.strToDate(item.date);
			var string = date.year+"/";
			if(date.month != undefined) {
				// deal with javascript months
				date.month++;
				if(date.month < 10) string += "0";
				string += date.month;
			}
			string += "/";
			if(date.day != undefined) {
				if(date.day < 10) string += "0";
				string += date.day;
			}
			string += "/";
			if(date.part != undefined) {
				string += date.part;
			}
			addTag("PY", string);
		}

		// notes
		if(Zotero.getOption("exportNotes")) {
			for(var j in item.notes) {
				addTag("N1", item.notes[j].note.replace(/(?:\r\n?|\n)/g, "\r\n"));
			}
		}

		if(item.abstractNote) {
			addTag("N2", item.abstractNote.replace(/(?:\r\n?|\n)/g, "\r\n"));
		}
		else if(item.abstract) {
			// patent type has abstract
			addTag("N2", item.abstract.replace(/(?:\r\n?|\n)/g, "\r\n"));
		}

		// tags
		for each(var tag in item.tags) {
			addTag("KW", tag.tag);
		}

		// pages
		if(item.pages) {
			if(item.itemType == "book") {
				addTag("EP", item.pages);
			} else {
				var range = Zotero.Utilities.getPageRange(item.pages);
				addTag("SP", range[0]);
				addTag("EP", range[1]);
			}
		}

		// ISBN/ISSN
		addTag("SN", item.ISBN);
		addTag("SN", item.ISSN);

		// URL
		if(item.url) {
			addTag("UR", item.url);
		} else if(item.source && item.source.substr(0, 7) == "http://") {
			addTag("UR", item.source);
		}

		Zotero.write("ER  - \r\n\r\n");
	}
}');

REPLACE INTO translators VALUES ('881f60f2-0802-411a-9228-ce5f47b64c7d', '1.0.0b4.r5', '', '2008-02-03 21:00:00', '1', '100', '3', 'Refer/BibIX', 'Simon Kornblith', 'txt', 
'Zotero.configure("dataMode", "line");

function detectImport() {
	var lineRe = /%[A-Z0-9\*\$] .+/;
	var line;
	var matched = 0;
	while((line = Zotero.read()) !== "false") {
		line = line.replace(/^\s+/, "");
		if(line != "") {
			if(lineRe.test(line)) {
				matched++;
				if(matched == 2) {
					// threshold is two lines
					return true;
				}
			} else {
				return false;
			}
		}
	}
}', 
'var fieldMap = {
	T:"title",
	S:"series",
	V:"volume",
	N:"issue",
	C:"place",
	I:"publisher",
	R:"type",
	P:"pages",
	W:"archiveLocation",
	"*":"rights",
	"@":"ISBN",
	L:"callNumber",
	M:"accessionNumber",
	U:"url",
	7:"edition",
	X:"abstractNote"
};

var inputFieldMap = {
	J:"publicationTitle",
	B:"publicationTitle",
	9:"type"
};

// TODO: figure out if these are the best types for personal communication
var typeMap = {
	book:"Book",
	bookSection:"Book Section",
	journalArticle:"Journal Article",
	magazineArticle:"Magazine Article",
	newspaperArticle:"Newspaper Article",
	thesis:"Thesis",
	letter:"Personal Communication",
	manuscript:"Unpublished Work",
	interview:"Personal Communication",
	film:"Film or Broadcast",
	artwork:"Artwork",
	webpage:"Web Page",
	report:"Report",
	bill:"Bill",
	"case":"Case",
	hearing:"Hearing",
	patent:"Patent",
	statute:"Statute",
	email:"Personal Communication",
	map:"Map",
	blogPost:"Web Page",
	instantMessage:"Personal Communication",
	forumPost:"Web Page",
	audioRecording:"Audiovisual Material",
	presentation:"Report",
	videoRecording:"Audiovisual Material",
	tvBroadcast:"Film or Broadcast",
	radioBroadcast:"Film or Broadcast",
	podcast:"Audiovisual Material",
	computerProgram:"Computer Program",
	conferencePaper:"Conference Paper",
	document:"Generic",
	encyclopediaArticle:"Encyclopedia",
	dictionaryEntry:"Dictionary"
};

// supplements outputTypeMap for importing
// TODO: BILL, CASE, COMP, CONF, DATA, HEAR, MUSIC, PAT, SOUND, STAT
var inputTypeMap = {
	"Ancient Text":"book",
	"Audiovisual Material":"videoRecording",
	"Generic":"book",
	"Chart or Table":"artwork",
	"Classical Work":"book",
	"Conference Proceedings":"conferencePaper",
	"Conference Paper":"conferencePaper",
	"Edited Book":"book",
	"Electronic Article":"journalArticle",
	"Electronic Book":"book",
	"Equation":"artwork",
	"Figure":"artwork",
	"Government Document":"document",
	"Grant":"document",
	"Legal Rule or Regulation":"statute",
	"Online Database":"webpage",
	"Online Multimedia":"webpage",
	"Electronic Source":"webpage"
};

var isEndNote = false;

function processTag(item, tag, value) {
	value = Zotero.Utilities.trim(value);
	if(fieldMap[tag]) {
		item[fieldMap[tag]] = value;
	} else if(inputFieldMap[tag]) {
		item[inputFieldMap[tag]] = value;
	} else if(tag == "0") {
		if(inputTypeMap[value]) {	// first check inputTypeMap
			item.itemType = inputTypeMap[value]
		} else {					// then check typeMap
			for(var i in typeMap) {
				if(value == typeMap[i]) {
					item.itemType = i;
					break;
				}
			}
			// fall back to generic
			if(!item.itemType) item.itemType = inputTypeMap["Generic"];
		}
	} else if(tag == "A" || tag == "E" || tag == "?") {
		if(tag == "A") {
			var type = "author";
		} else if(tag == "E") {
			var type = "editor";
		} else if(tag == "?") {
			var type = "translator";
		}
		
		item.creators.push(Zotero.Utilities.cleanAuthor(value, type, value.indexOf(",") != -1));
	} else if(tag == "Q") {
		item.creators.push({creatorType:"author", lastName:value, fieldMode:true});
	} else if(tag == "H" || tag == "O") {
		item.extra += "\n"+value;
	} else if(tag == "Z") {
		item.notes.push({note:value});
	} else if(tag == "D") {
		if(item.date) {
			if(item.date.indexOf(value) == -1) {
				item.date += " "+value;
			}
		} else {
			item.date = value;
		}
	} else if(tag == "8") {
		if(item.date) {
			if(value.indexOf(item.date) == -1) {
				item.date += " "+value;
			}
		} else {
			item.date = value;
		}
	} else if(tag == "K") {
		item.tags = value.split("\n");
	}
}

function doImport() {
	// no character set is defined for this format. we use UTF-8.
	Zotero.setCharacterSet("UTF-8");
	
	var line = true;
	var tag = data = false;
	do {	// first valid line is type
		Zotero.debug("ignoring "+line);
		line = Zotero.read();
		line = line.replace(/^\s+/, "");
	} while(line !== false && line[0] != "%");
	
	var item = new Zotero.Item();
	
	var tag = line[1];
	var data = line.substr(3);
	while((line = Zotero.read()) !== false) {	// until EOF
		line = line.replace(/^\s+/, "");
		if(!line) {
			if(tag) {
				processTag(item, tag, data);
				// unset info
				tag = data = readRecordEntry = false;
				// new item
				item.complete();
				item = new Zotero.Item();
			}
		} else if(line[0] == "%" && line[2] == " ") {
			// if this line is a tag, take a look at the previous line to map
			// its tag
			if(tag) {
				processTag(item, tag, data);
			}
			
			// then fetch the tag and data from this line
			tag = line[1];
			data = line.substr(3);
		} else {
			// otherwise, assume this is data from the previous line continued
			if(tag) {
				data += "\n"+line;
			}
		}
	}
	
	if(tag) {	// save any unprocessed tags
		processTag(item, tag, data);
		item.complete();
	}
}

function addTag(tag, value) {
	if(value) {
		Zotero.write("%"+tag+" "+value+"\r\n");
	}
}

function doExport() {
	// use UTF-8 to export
	Zotero.setCharacterSet("UTF-8");
	
	var item;
	while(item = Zotero.nextItem()) {
		// can''t store independent notes in RIS
		if(item.itemType == "note" || item.itemType == "attachment") {
			continue;
		}
		
		// type
		addTag("0", typeMap[item.itemType] ? typeMap[item.itemType] : "Generic");
		
		// use field map
		for(var j in fieldMap) {
			if(item[fieldMap[j]]) addTag(j, item[fieldMap[j]]);
		}
		
		//handle J & B tags correctly
		if (item["publicationTitle"]) {
			if (item.itemType == "journalArticle") {
				addTag("J", item["publicationTitle"]);
			} else {
				addTag("B", item["publicationTitle"]);
			}
		}
		
		// creators
		for(var j in item.creators) {
			var referTag = "A";
			if(item.creators[j].creatorType == "editor") {
				referTag = "E";
			} else if(item.creators[j].creatorType == "translator") {
				referTag = "?";
			}
			
			addTag(referTag, item.creators[j].lastName+(item.creators[j].firstName ? ", "+item.creators[j].firstName : ""));
		}
		
		// date
		addTag("D", item.date);
		
		// tags
		if(item.tags) {
			var keywordTag = "";
			for each(var tag in item.tags) {
				keywordTag += "\r\n"+tag.tag;
			}
			addTag("K", keywordTag.substr(2));
		}
		Zotero.write("\r\n");
	}
}');

REPLACE INTO translators VALUES ('9cb70025-a888-4a29-a210-93ec52da40d4', '1.0.0b4.r1', '', '2008-03-26 16:04:37', '1', '200', '3', 'BibTeX', 'Simon Kornblith', 'bib', 
'Zotero.configure("dataMode", "block");
Zotero.addOption("UTF8", true);

function detectImport() {
	var block = "";
	var read;
	
	var re = /^\s*@[a-zA-Z]+[\(\{]/;
	var lines_read = 0;
	while(read = Zotero.read(1)) {
		if(read == "%") {
			// read until next newline
			block = "";
			while((read = Zotero.read(1)) && read != "\r" && read != "\n") {}
		} else if((read == "\n" || read == "\r") && block) {
			// check if this is a BibTeX entry
			if(re.test(block)) {
				return true;
			}
			
			block = "";
		} else if(" \n\r\t".indexOf(read) == -1) {
			block += read;
		}
	}
}', 
'//%a = first author surname
//%y = year
//%t = first word of title
var citeKeyFormat = "%a_%t_%y";

var fieldMap = {
	address:"place",
	chapter:"section",
	edition:"edition",
//	number:"issue",
	type:"type",
	series:"series",
	title:"title",
	volume:"volume",
	copyright:"rights",
	isbn:"ISBN",
	issn:"ISSN",
	location:"archiveLocation",
	url:"url",
	doi:"DOI",
	"abstract":"abstractNote"
};

var inputFieldMap = {
	booktitle :"publicationTitle",
	school:"publisher",
	publisher:"publisher"
};

var zotero2bibtexTypeMap = {
	"book":"book",
	"bookSection": function (item) {
		var hasAuthor = false;
		var hasEditor = false;
		for each(var creator in item.creators) {
			if (creator.creatorType == "editor") { hasEditor = true; }
			if (creator.creatorType == "author") { hasAuthor = true; }
		}
		if (hasAuthor && hasEditor) { return "incollection"; }
		return "inbook";
		},
	"journalArticle":"article",
	"magazineArticle":"article",
	"newspaperArticle":"article",
	"thesis":"phdthesis",
	"letter":"misc",
	"manuscript":"unpublished",
	"interview":"misc",
	"film":"misc",
	"artwork":"misc",
	"webpage":"misc",
	"conferencePaper":"inproceedings"
};

var bibtex2zoteroTypeMap = {
	"book":"book", // or booklet,  proceedings
	"inbook":"bookSection",
	"incollection":"bookSection",
	"article":"journalArticle", // or magazineArticle or newspaperArticle
	"phdthesis":"thesis",
	"unpublished":"manuscript",
	"inproceedings":"conferencePaper", // check for conference also
	"techreport":"report",
	"booklet":"book",
	"incollection":"bookSection",
	"manual":"book",
	"mastersthesis":"thesis",
	"misc":"book",
	"proceedings":"conference"
};

/*
 * three-letter month abbreviations. i assume these are the same ones that the
 * docs say are defined in some appendix of the LaTeX book. (i don''t have the
 * LaTeX book.)
 */
var months = ["jan", "feb", "mar", "apr", "may", "jun",
              "jul", "aug", "sep", "oct", "nov", "dec"]

/*
 * new mapping table based on that from Matthias Steffens,
 * then enhanced with some fields generated from the unicode table.
 */

var mappingTable = {
    "\u00A0":"~", // NO-BREAK SPACE
    "\u00A1":"{\\textexclamdown}", // INVERTED EXCLAMATION MARK
    "\u00A2":"{\\textcent}", // CENT SIGN
    "\u00A3":"{\\textsterling}", // POUND SIGN
    "\u00A5":"{\\textyen}", // YEN SIGN
    "\u00A6":"{\\textbrokenbar}", // BROKEN BAR
    "\u00A7":"{\\textsection}", // SECTION SIGN
    "\u00A8":"{\\textasciidieresis}", // DIAERESIS
    "\u00A9":"{\\textcopyright}", // COPYRIGHT SIGN
    "\u00AA":"{\\textordfeminine}", // FEMININE ORDINAL INDICATOR
    "\u00AB":"{\\guillemotleft}", // LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
    "\u00AC":"{\\textlnot}", // NOT SIGN
    "\u00AD":"-", // SOFT HYPHEN
    "\u00AE":"{\\textregistered}", // REGISTERED SIGN
    "\u00AF":"{\\textasciimacron}", // MACRON
    "\u00B0":"{\\textdegree}", // DEGREE SIGN
    "\u00B1":"{\\textpm}", // PLUS-MINUS SIGN
    "\u00B2":"{\\texttwosuperior}", // SUPERSCRIPT TWO
    "\u00B3":"{\\textthreesuperior}", // SUPERSCRIPT THREE
    "\u00B4":"{\\textasciiacute}", // ACUTE ACCENT
    "\u00B5":"{\\textmu}", // MICRO SIGN
    "\u00B6":"{\\textparagraph}", // PILCROW SIGN
    "\u00B7":"{\\textperiodcentered}", // MIDDLE DOT
    "\u00B8":"{\\c\\ }", // CEDILLA
    "\u00B9":"{\\textonesuperior}", // SUPERSCRIPT ONE
    "\u00BA":"{\\textordmasculine}", // MASCULINE ORDINAL INDICATOR
    "\u00BB":"{\\guillemotright}", // RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
    "\u00BC":"{\\textonequarter}", // VULGAR FRACTION ONE QUARTER
    "\u00BD":"{\\textonehalf}", // VULGAR FRACTION ONE HALF
    "\u00BE":"{\\textthreequarters}", // VULGAR FRACTION THREE QUARTERS
    "\u00BF":"{\\textquestiondown}", // INVERTED QUESTION MARK
    "\u00C6":"{\\AE}", // LATIN CAPITAL LETTER AE
    "\u00D0":"{\\DH}", // LATIN CAPITAL LETTER ETH
    "\u00D7":"{\\texttimes}", // MULTIPLICATION SIGN
    "\u00DE":"{\\TH}", // LATIN CAPITAL LETTER THORN
    "\u00DF":"{\\ss}", // LATIN SMALL LETTER SHARP S
    "\u00E6":"{\\ae}", // LATIN SMALL LETTER AE
    "\u00F0":"{\\dh}", // LATIN SMALL LETTER ETH
    "\u00F7":"{\\textdiv}", // DIVISION SIGN
    "\u00FE":"{\\th}", // LATIN SMALL LETTER THORN
    "\u0131":"{\\i}", // LATIN SMALL LETTER DOTLESS I
    "\u0132":"IJ", // LATIN CAPITAL LIGATURE IJ
    "\u0133":"ij", // LATIN SMALL LIGATURE IJ
    "\u0138":"k", // LATIN SMALL LETTER KRA
    "\u0149":"''n", // LATIN SMALL LETTER N PRECEDED BY APOSTROPHE
    "\u014A":"{\\NG}", // LATIN CAPITAL LETTER ENG
    "\u014B":"{\\ng}", // LATIN SMALL LETTER ENG
    "\u0152":"{\\OE}", // LATIN CAPITAL LIGATURE OE
    "\u0153":"{\\oe}", // LATIN SMALL LIGATURE OE
    "\u017F":"s", // LATIN SMALL LETTER LONG S
    "\u02B9":"''", // MODIFIER LETTER PRIME
    "\u02BB":"''", // MODIFIER LETTER TURNED COMMA
    "\u02BC":"''", // MODIFIER LETTER APOSTROPHE
    "\u02BD":"''", // MODIFIER LETTER REVERSED COMMA
    "\u02C6":"{\\textasciicircum}", // MODIFIER LETTER CIRCUMFLEX ACCENT
    "\u02C8":"''", // MODIFIER LETTER VERTICAL LINE
    "\u02C9":"-", // MODIFIER LETTER MACRON
    "\u02CC":",", // MODIFIER LETTER LOW VERTICAL LINE
    "\u02D0":":", // MODIFIER LETTER TRIANGULAR COLON
    "\u02DA":"o", // RING ABOVE
    "\u02DC":"\\~{}", // SMALL TILDE
    "\u02DD":"{\\textacutedbl}", // DOUBLE ACUTE ACCENT
    "\u0374":"''", // GREEK NUMERAL SIGN
    "\u0375":",", // GREEK LOWER NUMERAL SIGN
    "\u037E":";", // GREEK QUESTION MARK
    "\u2000":" ", // EN QUAD
    "\u2001":"  ", // EM QUAD
    "\u2002":" ", // EN SPACE
    "\u2003":"  ", // EM SPACE
    "\u2004":" ", // THREE-PER-EM SPACE
    "\u2005":" ", // FOUR-PER-EM SPACE
    "\u2006":" ", // SIX-PER-EM SPACE
    "\u2007":" ", // FIGURE SPACE
    "\u2008":" ", // PUNCTUATION SPACE
    "\u2009":" ", // THIN SPACE
    "\u2010":"-", // HYPHEN
    "\u2011":"-", // NON-BREAKING HYPHEN
    "\u2012":"-", // FIGURE DASH
    "\u2013":"{\\textendash}", // EN DASH
    "\u2014":"{\\textemdash}", // EM DASH
    "\u2015":"--", // HORIZONTAL BAR
    "\u2016":"{\\textbardbl}", // DOUBLE VERTICAL LINE
    "\u2017":"{\\textunderscore}", // DOUBLE LOW LINE
    "\u2018":"{\\textquoteleft}", // LEFT SINGLE QUOTATION MARK
    "\u2019":"{\\textquoteright}", // RIGHT SINGLE QUOTATION MARK
    "\u201A":"{\\quotesinglbase}", // SINGLE LOW-9 QUOTATION MARK
    "\u201B":"''", // SINGLE HIGH-REVERSED-9 QUOTATION MARK
    "\u201C":"{\\textquotedblleft}", // LEFT DOUBLE QUOTATION MARK
    "\u201D":"{\\textquotedblright}", // RIGHT DOUBLE QUOTATION MARK
    "\u201E":"{\\quotedblbase}", // DOUBLE LOW-9 QUOTATION MARK
    "\u201F":"{\\quotedblbase}", // DOUBLE HIGH-REVERSED-9 QUOTATION MARK
    "\u2020":"{\\textdagger}", // DAGGER
    "\u2021":"{\\textdaggerdbl}", // DOUBLE DAGGER
    "\u2022":"{\\textbullet}", // BULLET
    "\u2023":">", // TRIANGULAR BULLET
    "\u2024":".", // ONE DOT LEADER
    "\u2025":"..", // TWO DOT LEADER
    "\u2026":"{\\textellipsis}", // HORIZONTAL ELLIPSIS
    "\u2027":"-", // HYPHENATION POINT
    "\u202F":" ", // NARROW NO-BREAK SPACE
    "\u2030":"{\\textperthousand}", // PER MILLE SIGN
    "\u2032":"''", // PRIME
    "\u2033":"''", // DOUBLE PRIME
    "\u2034":"''''''", // TRIPLE PRIME
    "\u2035":"`", // REVERSED PRIME
    "\u2036":"``", // REVERSED DOUBLE PRIME
    "\u2037":"```", // REVERSED TRIPLE PRIME
    "\u2039":"{\\guilsinglleft}", // SINGLE LEFT-POINTING ANGLE QUOTATION MARK
    "\u203A":"{\\guilsinglright}", // SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
    "\u203C":"!!", // DOUBLE EXCLAMATION MARK
    "\u203E":"-", // OVERLINE
    "\u2043":"-", // HYPHEN BULLET
    "\u2044":"{\\textfractionsolidus}", // FRACTION SLASH
    "\u2048":"?!", // QUESTION EXCLAMATION MARK
    "\u2049":"!?", // EXCLAMATION QUESTION MARK
    "\u204A":"7", // TIRONIAN SIGN ET
    "\u2070":"$^{0}$", // SUPERSCRIPT ZERO
    "\u2074":"$^{4}$", // SUPERSCRIPT FOUR
    "\u2075":"$^{5}$", // SUPERSCRIPT FIVE
    "\u2076":"$^{6}$", // SUPERSCRIPT SIX
    "\u2077":"$^{7}$", // SUPERSCRIPT SEVEN
    "\u2078":"$^{8}$", // SUPERSCRIPT EIGHT
    "\u2079":"$^{9}$", // SUPERSCRIPT NINE
    "\u207A":"$^{+}$", // SUPERSCRIPT PLUS SIGN
    "\u207B":"$^{-}$", // SUPERSCRIPT MINUS
    "\u207C":"$^{=}$", // SUPERSCRIPT EQUALS SIGN
    "\u207D":"$^{(}$", // SUPERSCRIPT LEFT PARENTHESIS
    "\u207E":"$^{)}$", // SUPERSCRIPT RIGHT PARENTHESIS
    "\u207F":"$^{n}$", // SUPERSCRIPT LATIN SMALL LETTER N
    "\u2080":"$_{0}$", // SUBSCRIPT ZERO
    "\u2081":"$_{1}$", // SUBSCRIPT ONE
    "\u2082":"$_{2}$", // SUBSCRIPT TWO
    "\u2083":"$_{3}$", // SUBSCRIPT THREE
    "\u2084":"$_{4}$", // SUBSCRIPT FOUR
    "\u2085":"$_{5}$", // SUBSCRIPT FIVE
    "\u2086":"$_{6}$", // SUBSCRIPT SIX
    "\u2087":"$_{7}$", // SUBSCRIPT SEVEN
    "\u2088":"$_{8}$", // SUBSCRIPT EIGHT
    "\u2089":"$_{9}$", // SUBSCRIPT NINE
    "\u208A":"$_{+}$", // SUBSCRIPT PLUS SIGN
    "\u208B":"$_{-}$", // SUBSCRIPT MINUS
    "\u208C":"$_{=}$", // SUBSCRIPT EQUALS SIGN
    "\u208D":"$_{(}$", // SUBSCRIPT LEFT PARENTHESIS
    "\u208E":"$_{)}$", // SUBSCRIPT RIGHT PARENTHESIS
    "\u20AC":"{\\texteuro}", // EURO SIGN
    "\u2100":"a/c", // ACCOUNT OF
    "\u2101":"a/s", // ADDRESSED TO THE SUBJECT
    "\u2103":"{\\textcelsius}", // DEGREE CELSIUS
    "\u2105":"c/o", // CARE OF
    "\u2106":"c/u", // CADA UNA
    "\u2109":"F", // DEGREE FAHRENHEIT
    "\u2113":"l", // SCRIPT SMALL L
    "\u2116":"{\\textnumero}", // NUMERO SIGN
    "\u2117":"{\\textcircledP}", // SOUND RECORDING COPYRIGHT
    "\u2120":"{\\textservicemark}", // SERVICE MARK
    "\u2121":"TEL", // TELEPHONE SIGN
    "\u2122":"{\\texttrademark}", // TRADE MARK SIGN
    "\u2126":"{\\textohm}", // OHM SIGN
    "\u212A":"K", // KELVIN SIGN
    "\u212B":"A", // ANGSTROM SIGN
    "\u212E":"{\\textestimated}", // ESTIMATED SYMBOL
    "\u2153":" 1/3", // VULGAR FRACTION ONE THIRD
    "\u2154":" 2/3", // VULGAR FRACTION TWO THIRDS
    "\u2155":" 1/5", // VULGAR FRACTION ONE FIFTH
    "\u2156":" 2/5", // VULGAR FRACTION TWO FIFTHS
    "\u2157":" 3/5", // VULGAR FRACTION THREE FIFTHS
    "\u2158":" 4/5", // VULGAR FRACTION FOUR FIFTHS
    "\u2159":" 1/6", // VULGAR FRACTION ONE SIXTH
    "\u215A":" 5/6", // VULGAR FRACTION FIVE SIXTHS
    "\u215B":" 1/8", // VULGAR FRACTION ONE EIGHTH
    "\u215C":" 3/8", // VULGAR FRACTION THREE EIGHTHS
    "\u215D":" 5/8", // VULGAR FRACTION FIVE EIGHTHS
    "\u215E":" 7/8", // VULGAR FRACTION SEVEN EIGHTHS
    "\u215F":" 1/", // FRACTION NUMERATOR ONE
    "\u2160":"I", // ROMAN NUMERAL ONE
    "\u2161":"II", // ROMAN NUMERAL TWO
    "\u2162":"III", // ROMAN NUMERAL THREE
    "\u2163":"IV", // ROMAN NUMERAL FOUR
    "\u2164":"V", // ROMAN NUMERAL FIVE
    "\u2165":"VI", // ROMAN NUMERAL SIX
    "\u2166":"VII", // ROMAN NUMERAL SEVEN
    "\u2167":"VIII", // ROMAN NUMERAL EIGHT
    "\u2168":"IX", // ROMAN NUMERAL NINE
    "\u2169":"X", // ROMAN NUMERAL TEN
    "\u216A":"XI", // ROMAN NUMERAL ELEVEN
    "\u216B":"XII", // ROMAN NUMERAL TWELVE
    "\u216C":"L", // ROMAN NUMERAL FIFTY
    "\u216D":"C", // ROMAN NUMERAL ONE HUNDRED
    "\u216E":"D", // ROMAN NUMERAL FIVE HUNDRED
    "\u216F":"M", // ROMAN NUMERAL ONE THOUSAND
    "\u2170":"i", // SMALL ROMAN NUMERAL ONE
    "\u2171":"ii", // SMALL ROMAN NUMERAL TWO
    "\u2172":"iii", // SMALL ROMAN NUMERAL THREE
    "\u2173":"iv", // SMALL ROMAN NUMERAL FOUR
    "\u2174":"v", // SMALL ROMAN NUMERAL FIVE
    "\u2175":"vi", // SMALL ROMAN NUMERAL SIX
    "\u2176":"vii", // SMALL ROMAN NUMERAL SEVEN
    "\u2177":"viii", // SMALL ROMAN NUMERAL EIGHT
    "\u2178":"ix", // SMALL ROMAN NUMERAL NINE
    "\u2179":"x", // SMALL ROMAN NUMERAL TEN
    "\u217A":"xi", // SMALL ROMAN NUMERAL ELEVEN
    "\u217B":"xii", // SMALL ROMAN NUMERAL TWELVE
    "\u217C":"l", // SMALL ROMAN NUMERAL FIFTY
    "\u217D":"c", // SMALL ROMAN NUMERAL ONE HUNDRED
    "\u217E":"d", // SMALL ROMAN NUMERAL FIVE HUNDRED
    "\u217F":"m", // SMALL ROMAN NUMERAL ONE THOUSAND
    "\u2190":"{\\textleftarrow}", // LEFTWARDS ARROW
    "\u2191":"{\\textuparrow}", // UPWARDS ARROW
    "\u2192":"{\\textrightarrow}", // RIGHTWARDS ARROW
    "\u2193":"{\\textdownarrow}", // DOWNWARDS ARROW
    "\u2194":"<->", // LEFT RIGHT ARROW
    "\u21D0":"<=", // LEFTWARDS DOUBLE ARROW
    "\u21D2":"=>", // RIGHTWARDS DOUBLE ARROW
    "\u21D4":"<=>", // LEFT RIGHT DOUBLE ARROW
    "\u2212":"-", // MINUS SIGN
    "\u2215":"/", // DIVISION SLASH
    "\u2216":"\\", // SET MINUS
    "\u2217":"*", // ASTERISK OPERATOR
    "\u2218":"o", // RING OPERATOR
    "\u2219":".", // BULLET OPERATOR
    "\u221E":"$\\infty$", // INFINITY
    "\u2223":"|", // DIVIDES
    "\u2225":"||", // PARALLEL TO
    "\u2236":":", // RATIO
    "\u223C":"\\~{}", // TILDE OPERATOR
    "\u2260":"/=", // NOT EQUAL TO
    "\u2261":"=", // IDENTICAL TO
    "\u2264":"<=", // LESS-THAN OR EQUAL TO
    "\u2265":">=", // GREATER-THAN OR EQUAL TO
    "\u226A":"<<", // MUCH LESS-THAN
    "\u226B":">>", // MUCH GREATER-THAN
    "\u2295":"(+)", // CIRCLED PLUS
    "\u2296":"(-)", // CIRCLED MINUS
    "\u2297":"(x)", // CIRCLED TIMES
    "\u2298":"(/)", // CIRCLED DIVISION SLASH
    "\u22A2":"|-", // RIGHT TACK
    "\u22A3":"-|", // LEFT TACK
    "\u22A6":"|-", // ASSERTION
    "\u22A7":"|=", // MODELS
    "\u22A8":"|=", // TRUE
    "\u22A9":"||-", // FORCES
    "\u22C5":".", // DOT OPERATOR
    "\u22C6":"*", // STAR OPERATOR
    "\u22D5":"$\\#$", // EQUAL AND PARALLEL TO
    "\u22D8":"<<<", // VERY MUCH LESS-THAN
    "\u22D9":">>>", // VERY MUCH GREATER-THAN
    "\u22EF":"...", // MIDLINE HORIZONTAL ELLIPSIS
    "\u2329":"{\\textlangle}", // LEFT-POINTING ANGLE BRACKET
    "\u232A":"{\\textrangle}", // RIGHT-POINTING ANGLE BRACKET
    "\u2400":"NUL", // SYMBOL FOR NULL
    "\u2401":"SOH", // SYMBOL FOR START OF HEADING
    "\u2402":"STX", // SYMBOL FOR START OF TEXT
    "\u2403":"ETX", // SYMBOL FOR END OF TEXT
    "\u2404":"EOT", // SYMBOL FOR END OF TRANSMISSION
    "\u2405":"ENQ", // SYMBOL FOR ENQUIRY
    "\u2406":"ACK", // SYMBOL FOR ACKNOWLEDGE
    "\u2407":"BEL", // SYMBOL FOR BELL
    "\u2408":"BS", // SYMBOL FOR BACKSPACE
    "\u2409":"HT", // SYMBOL FOR HORIZONTAL TABULATION
    "\u240A":"LF", // SYMBOL FOR LINE FEED
    "\u240B":"VT", // SYMBOL FOR VERTICAL TABULATION
    "\u240C":"FF", // SYMBOL FOR FORM FEED
    "\u240D":"CR", // SYMBOL FOR CARRIAGE RETURN
    "\u240E":"SO", // SYMBOL FOR SHIFT OUT
    "\u240F":"SI", // SYMBOL FOR SHIFT IN
    "\u2410":"DLE", // SYMBOL FOR DATA LINK ESCAPE
    "\u2411":"DC1", // SYMBOL FOR DEVICE CONTROL ONE
    "\u2412":"DC2", // SYMBOL FOR DEVICE CONTROL TWO
    "\u2413":"DC3", // SYMBOL FOR DEVICE CONTROL THREE
    "\u2414":"DC4", // SYMBOL FOR DEVICE CONTROL FOUR
    "\u2415":"NAK", // SYMBOL FOR NEGATIVE ACKNOWLEDGE
    "\u2416":"SYN", // SYMBOL FOR SYNCHRONOUS IDLE
    "\u2417":"ETB", // SYMBOL FOR END OF TRANSMISSION BLOCK
    "\u2418":"CAN", // SYMBOL FOR CANCEL
    "\u2419":"EM", // SYMBOL FOR END OF MEDIUM
    "\u241A":"SUB", // SYMBOL FOR SUBSTITUTE
    "\u241B":"ESC", // SYMBOL FOR ESCAPE
    "\u241C":"FS", // SYMBOL FOR FILE SEPARATOR
    "\u241D":"GS", // SYMBOL FOR GROUP SEPARATOR
    "\u241E":"RS", // SYMBOL FOR RECORD SEPARATOR
    "\u241F":"US", // SYMBOL FOR UNIT SEPARATOR
    "\u2420":"SP", // SYMBOL FOR SPACE
    "\u2421":"DEL", // SYMBOL FOR DELETE
    "\u2423":"{\\textvisiblespace}", // OPEN BOX
    "\u2424":"NL", // SYMBOL FOR NEWLINE
    "\u2425":"///", // SYMBOL FOR DELETE FORM TWO
    "\u2426":"?", // SYMBOL FOR SUBSTITUTE FORM TWO
    "\u2460":"(1)", // CIRCLED DIGIT ONE
    "\u2461":"(2)", // CIRCLED DIGIT TWO
    "\u2462":"(3)", // CIRCLED DIGIT THREE
    "\u2463":"(4)", // CIRCLED DIGIT FOUR
    "\u2464":"(5)", // CIRCLED DIGIT FIVE
    "\u2465":"(6)", // CIRCLED DIGIT SIX
    "\u2466":"(7)", // CIRCLED DIGIT SEVEN
    "\u2467":"(8)", // CIRCLED DIGIT EIGHT
    "\u2468":"(9)", // CIRCLED DIGIT NINE
    "\u2469":"(10)", // CIRCLED NUMBER TEN
    "\u246A":"(11)", // CIRCLED NUMBER ELEVEN
    "\u246B":"(12)", // CIRCLED NUMBER TWELVE
    "\u246C":"(13)", // CIRCLED NUMBER THIRTEEN
    "\u246D":"(14)", // CIRCLED NUMBER FOURTEEN
    "\u246E":"(15)", // CIRCLED NUMBER FIFTEEN
    "\u246F":"(16)", // CIRCLED NUMBER SIXTEEN
    "\u2470":"(17)", // CIRCLED NUMBER SEVENTEEN
    "\u2471":"(18)", // CIRCLED NUMBER EIGHTEEN
    "\u2472":"(19)", // CIRCLED NUMBER NINETEEN
    "\u2473":"(20)", // CIRCLED NUMBER TWENTY
    "\u2474":"(1)", // PARENTHESIZED DIGIT ONE
    "\u2475":"(2)", // PARENTHESIZED DIGIT TWO
    "\u2476":"(3)", // PARENTHESIZED DIGIT THREE
    "\u2477":"(4)", // PARENTHESIZED DIGIT FOUR
    "\u2478":"(5)", // PARENTHESIZED DIGIT FIVE
    "\u2479":"(6)", // PARENTHESIZED DIGIT SIX
    "\u247A":"(7)", // PARENTHESIZED DIGIT SEVEN
    "\u247B":"(8)", // PARENTHESIZED DIGIT EIGHT
    "\u247C":"(9)", // PARENTHESIZED DIGIT NINE
    "\u247D":"(10)", // PARENTHESIZED NUMBER TEN
    "\u247E":"(11)", // PARENTHESIZED NUMBER ELEVEN
    "\u247F":"(12)", // PARENTHESIZED NUMBER TWELVE
    "\u2480":"(13)", // PARENTHESIZED NUMBER THIRTEEN
    "\u2481":"(14)", // PARENTHESIZED NUMBER FOURTEEN
    "\u2482":"(15)", // PARENTHESIZED NUMBER FIFTEEN
    "\u2483":"(16)", // PARENTHESIZED NUMBER SIXTEEN
    "\u2484":"(17)", // PARENTHESIZED NUMBER SEVENTEEN
    "\u2485":"(18)", // PARENTHESIZED NUMBER EIGHTEEN
    "\u2486":"(19)", // PARENTHESIZED NUMBER NINETEEN
    "\u2487":"(20)", // PARENTHESIZED NUMBER TWENTY
    "\u2488":"1.", // DIGIT ONE FULL STOP
    "\u2489":"2.", // DIGIT TWO FULL STOP
    "\u248A":"3.", // DIGIT THREE FULL STOP
    "\u248B":"4.", // DIGIT FOUR FULL STOP
    "\u248C":"5.", // DIGIT FIVE FULL STOP
    "\u248D":"6.", // DIGIT SIX FULL STOP
    "\u248E":"7.", // DIGIT SEVEN FULL STOP
    "\u248F":"8.", // DIGIT EIGHT FULL STOP
    "\u2490":"9.", // DIGIT NINE FULL STOP
    "\u2491":"10.", // NUMBER TEN FULL STOP
    "\u2492":"11.", // NUMBER ELEVEN FULL STOP
    "\u2493":"12.", // NUMBER TWELVE FULL STOP
    "\u2494":"13.", // NUMBER THIRTEEN FULL STOP
    "\u2495":"14.", // NUMBER FOURTEEN FULL STOP
    "\u2496":"15.", // NUMBER FIFTEEN FULL STOP
    "\u2497":"16.", // NUMBER SIXTEEN FULL STOP
    "\u2498":"17.", // NUMBER SEVENTEEN FULL STOP
    "\u2499":"18.", // NUMBER EIGHTEEN FULL STOP
    "\u249A":"19.", // NUMBER NINETEEN FULL STOP
    "\u249B":"20.", // NUMBER TWENTY FULL STOP
    "\u249C":"(a)", // PARENTHESIZED LATIN SMALL LETTER A
    "\u249D":"(b)", // PARENTHESIZED LATIN SMALL LETTER B
    "\u249E":"(c)", // PARENTHESIZED LATIN SMALL LETTER C
    "\u249F":"(d)", // PARENTHESIZED LATIN SMALL LETTER D
    "\u24A0":"(e)", // PARENTHESIZED LATIN SMALL LETTER E
    "\u24A1":"(f)", // PARENTHESIZED LATIN SMALL LETTER F
    "\u24A2":"(g)", // PARENTHESIZED LATIN SMALL LETTER G
    "\u24A3":"(h)", // PARENTHESIZED LATIN SMALL LETTER H
    "\u24A4":"(i)", // PARENTHESIZED LATIN SMALL LETTER I
    "\u24A5":"(j)", // PARENTHESIZED LATIN SMALL LETTER J
    "\u24A6":"(k)", // PARENTHESIZED LATIN SMALL LETTER K
    "\u24A7":"(l)", // PARENTHESIZED LATIN SMALL LETTER L
    "\u24A8":"(m)", // PARENTHESIZED LATIN SMALL LETTER M
    "\u24A9":"(n)", // PARENTHESIZED LATIN SMALL LETTER N
    "\u24AA":"(o)", // PARENTHESIZED LATIN SMALL LETTER O
    "\u24AB":"(p)", // PARENTHESIZED LATIN SMALL LETTER P
    "\u24AC":"(q)", // PARENTHESIZED LATIN SMALL LETTER Q
    "\u24AD":"(r)", // PARENTHESIZED LATIN SMALL LETTER R
    "\u24AE":"(s)", // PARENTHESIZED LATIN SMALL LETTER S
    "\u24AF":"(t)", // PARENTHESIZED LATIN SMALL LETTER T
    "\u24B0":"(u)", // PARENTHESIZED LATIN SMALL LETTER U
    "\u24B1":"(v)", // PARENTHESIZED LATIN SMALL LETTER V
    "\u24B2":"(w)", // PARENTHESIZED LATIN SMALL LETTER W
    "\u24B3":"(x)", // PARENTHESIZED LATIN SMALL LETTER X
    "\u24B4":"(y)", // PARENTHESIZED LATIN SMALL LETTER Y
    "\u24B5":"(z)", // PARENTHESIZED LATIN SMALL LETTER Z
    "\u24B6":"(A)", // CIRCLED LATIN CAPITAL LETTER A
    "\u24B7":"(B)", // CIRCLED LATIN CAPITAL LETTER B
    "\u24B8":"(C)", // CIRCLED LATIN CAPITAL LETTER C
    "\u24B9":"(D)", // CIRCLED LATIN CAPITAL LETTER D
    "\u24BA":"(E)", // CIRCLED LATIN CAPITAL LETTER E
    "\u24BB":"(F)", // CIRCLED LATIN CAPITAL LETTER F
    "\u24BC":"(G)", // CIRCLED LATIN CAPITAL LETTER G
    "\u24BD":"(H)", // CIRCLED LATIN CAPITAL LETTER H
    "\u24BE":"(I)", // CIRCLED LATIN CAPITAL LETTER I
    "\u24BF":"(J)", // CIRCLED LATIN CAPITAL LETTER J
    "\u24C0":"(K)", // CIRCLED LATIN CAPITAL LETTER K
    "\u24C1":"(L)", // CIRCLED LATIN CAPITAL LETTER L
    "\u24C2":"(M)", // CIRCLED LATIN CAPITAL LETTER M
    "\u24C3":"(N)", // CIRCLED LATIN CAPITAL LETTER N
    "\u24C4":"(O)", // CIRCLED LATIN CAPITAL LETTER O
    "\u24C5":"(P)", // CIRCLED LATIN CAPITAL LETTER P
    "\u24C6":"(Q)", // CIRCLED LATIN CAPITAL LETTER Q
    "\u24C7":"(R)", // CIRCLED LATIN CAPITAL LETTER R
    "\u24C8":"(S)", // CIRCLED LATIN CAPITAL LETTER S
    "\u24C9":"(T)", // CIRCLED LATIN CAPITAL LETTER T
    "\u24CA":"(U)", // CIRCLED LATIN CAPITAL LETTER U
    "\u24CB":"(V)", // CIRCLED LATIN CAPITAL LETTER V
    "\u24CC":"(W)", // CIRCLED LATIN CAPITAL LETTER W
    "\u24CD":"(X)", // CIRCLED LATIN CAPITAL LETTER X
    "\u24CE":"(Y)", // CIRCLED LATIN CAPITAL LETTER Y
    "\u24CF":"(Z)", // CIRCLED LATIN CAPITAL LETTER Z
    "\u24D0":"(a)", // CIRCLED LATIN SMALL LETTER A
    "\u24D1":"(b)", // CIRCLED LATIN SMALL LETTER B
    "\u24D2":"(c)", // CIRCLED LATIN SMALL LETTER C
    "\u24D3":"(d)", // CIRCLED LATIN SMALL LETTER D
    "\u24D4":"(e)", // CIRCLED LATIN SMALL LETTER E
    "\u24D5":"(f)", // CIRCLED LATIN SMALL LETTER F
    "\u24D6":"(g)", // CIRCLED LATIN SMALL LETTER G
    "\u24D7":"(h)", // CIRCLED LATIN SMALL LETTER H
    "\u24D8":"(i)", // CIRCLED LATIN SMALL LETTER I
    "\u24D9":"(j)", // CIRCLED LATIN SMALL LETTER J
    "\u24DA":"(k)", // CIRCLED LATIN SMALL LETTER K
    "\u24DB":"(l)", // CIRCLED LATIN SMALL LETTER L
    "\u24DC":"(m)", // CIRCLED LATIN SMALL LETTER M
    "\u24DD":"(n)", // CIRCLED LATIN SMALL LETTER N
    "\u24DE":"(o)", // CIRCLED LATIN SMALL LETTER O
    "\u24DF":"(p)", // CIRCLED LATIN SMALL LETTER P
    "\u24E0":"(q)", // CIRCLED LATIN SMALL LETTER Q
    "\u24E1":"(r)", // CIRCLED LATIN SMALL LETTER R
    "\u24E2":"(s)", // CIRCLED LATIN SMALL LETTER S
    "\u24E3":"(t)", // CIRCLED LATIN SMALL LETTER T
    "\u24E4":"(u)", // CIRCLED LATIN SMALL LETTER U
    "\u24E5":"(v)", // CIRCLED LATIN SMALL LETTER V
    "\u24E6":"(w)", // CIRCLED LATIN SMALL LETTER W
    "\u24E7":"(x)", // CIRCLED LATIN SMALL LETTER X
    "\u24E8":"(y)", // CIRCLED LATIN SMALL LETTER Y
    "\u24E9":"(z)", // CIRCLED LATIN SMALL LETTER Z
    "\u24EA":"(0)", // CIRCLED DIGIT ZERO
    "\u2500":"-", // BOX DRAWINGS LIGHT HORIZONTAL
    "\u2501":"=", // BOX DRAWINGS HEAVY HORIZONTAL
    "\u2502":"|", // BOX DRAWINGS LIGHT VERTICAL
    "\u2503":"|", // BOX DRAWINGS HEAVY VERTICAL
    "\u2504":"-", // BOX DRAWINGS LIGHT TRIPLE DASH HORIZONTAL
    "\u2505":"=", // BOX DRAWINGS HEAVY TRIPLE DASH HORIZONTAL
    "\u2506":"|", // BOX DRAWINGS LIGHT TRIPLE DASH VERTICAL
    "\u2507":"|", // BOX DRAWINGS HEAVY TRIPLE DASH VERTICAL
    "\u2508":"-", // BOX DRAWINGS LIGHT QUADRUPLE DASH HORIZONTAL
    "\u2509":"=", // BOX DRAWINGS HEAVY QUADRUPLE DASH HORIZONTAL
    "\u250A":"|", // BOX DRAWINGS LIGHT QUADRUPLE DASH VERTICAL
    "\u250B":"|", // BOX DRAWINGS HEAVY QUADRUPLE DASH VERTICAL
    "\u250C":"+", // BOX DRAWINGS LIGHT DOWN AND RIGHT
    "\u250D":"+", // BOX DRAWINGS DOWN LIGHT AND RIGHT HEAVY
    "\u250E":"+", // BOX DRAWINGS DOWN HEAVY AND RIGHT LIGHT
    "\u250F":"+", // BOX DRAWINGS HEAVY DOWN AND RIGHT
    "\u2510":"+", // BOX DRAWINGS LIGHT DOWN AND LEFT
    "\u2511":"+", // BOX DRAWINGS DOWN LIGHT AND LEFT HEAVY
    "\u2512":"+", // BOX DRAWINGS DOWN HEAVY AND LEFT LIGHT
    "\u2513":"+", // BOX DRAWINGS HEAVY DOWN AND LEFT
    "\u2514":"+", // BOX DRAWINGS LIGHT UP AND RIGHT
    "\u2515":"+", // BOX DRAWINGS UP LIGHT AND RIGHT HEAVY
    "\u2516":"+", // BOX DRAWINGS UP HEAVY AND RIGHT LIGHT
    "\u2517":"+", // BOX DRAWINGS HEAVY UP AND RIGHT
    "\u2518":"+", // BOX DRAWINGS LIGHT UP AND LEFT
    "\u2519":"+", // BOX DRAWINGS UP LIGHT AND LEFT HEAVY
    "\u251A":"+", // BOX DRAWINGS UP HEAVY AND LEFT LIGHT
    "\u251B":"+", // BOX DRAWINGS HEAVY UP AND LEFT
    "\u251C":"+", // BOX DRAWINGS LIGHT VERTICAL AND RIGHT
    "\u251D":"+", // BOX DRAWINGS VERTICAL LIGHT AND RIGHT HEAVY
    "\u251E":"+", // BOX DRAWINGS UP HEAVY AND RIGHT DOWN LIGHT
    "\u251F":"+", // BOX DRAWINGS DOWN HEAVY AND RIGHT UP LIGHT
    "\u2520":"+", // BOX DRAWINGS VERTICAL HEAVY AND RIGHT LIGHT
    "\u2521":"+", // BOX DRAWINGS DOWN LIGHT AND RIGHT UP HEAVY
    "\u2522":"+", // BOX DRAWINGS UP LIGHT AND RIGHT DOWN HEAVY
    "\u2523":"+", // BOX DRAWINGS HEAVY VERTICAL AND RIGHT
    "\u2524":"+", // BOX DRAWINGS LIGHT VERTICAL AND LEFT
    "\u2525":"+", // BOX DRAWINGS VERTICAL LIGHT AND LEFT HEAVY
    "\u2526":"+", // BOX DRAWINGS UP HEAVY AND LEFT DOWN LIGHT
    "\u2527":"+", // BOX DRAWINGS DOWN HEAVY AND LEFT UP LIGHT
    "\u2528":"+", // BOX DRAWINGS VERTICAL HEAVY AND LEFT LIGHT
    "\u2529":"+", // BOX DRAWINGS DOWN LIGHT AND LEFT UP HEAVY
    "\u252A":"+", // BOX DRAWINGS UP LIGHT AND LEFT DOWN HEAVY
    "\u252B":"+", // BOX DRAWINGS HEAVY VERTICAL AND LEFT
    "\u252C":"+", // BOX DRAWINGS LIGHT DOWN AND HORIZONTAL
    "\u252D":"+", // BOX DRAWINGS LEFT HEAVY AND RIGHT DOWN LIGHT
    "\u252E":"+", // BOX DRAWINGS RIGHT HEAVY AND LEFT DOWN LIGHT
    "\u252F":"+", // BOX DRAWINGS DOWN LIGHT AND HORIZONTAL HEAVY
    "\u2530":"+", // BOX DRAWINGS DOWN HEAVY AND HORIZONTAL LIGHT
    "\u2531":"+", // BOX DRAWINGS RIGHT LIGHT AND LEFT DOWN HEAVY
    "\u2532":"+", // BOX DRAWINGS LEFT LIGHT AND RIGHT DOWN HEAVY
    "\u2533":"+", // BOX DRAWINGS HEAVY DOWN AND HORIZONTAL
    "\u2534":"+", // BOX DRAWINGS LIGHT UP AND HORIZONTAL
    "\u2535":"+", // BOX DRAWINGS LEFT HEAVY AND RIGHT UP LIGHT
    "\u2536":"+", // BOX DRAWINGS RIGHT HEAVY AND LEFT UP LIGHT
    "\u2537":"+", // BOX DRAWINGS UP LIGHT AND HORIZONTAL HEAVY
    "\u2538":"+", // BOX DRAWINGS UP HEAVY AND HORIZONTAL LIGHT
    "\u2539":"+", // BOX DRAWINGS RIGHT LIGHT AND LEFT UP HEAVY
    "\u253A":"+", // BOX DRAWINGS LEFT LIGHT AND RIGHT UP HEAVY
    "\u253B":"+", // BOX DRAWINGS HEAVY UP AND HORIZONTAL
    "\u253C":"+", // BOX DRAWINGS LIGHT VERTICAL AND HORIZONTAL
    "\u253D":"+", // BOX DRAWINGS LEFT HEAVY AND RIGHT VERTICAL LIGHT
    "\u253E":"+", // BOX DRAWINGS RIGHT HEAVY AND LEFT VERTICAL LIGHT
    "\u253F":"+", // BOX DRAWINGS VERTICAL LIGHT AND HORIZONTAL HEAVY
    "\u2540":"+", // BOX DRAWINGS UP HEAVY AND DOWN HORIZONTAL LIGHT
    "\u2541":"+", // BOX DRAWINGS DOWN HEAVY AND UP HORIZONTAL LIGHT
    "\u2542":"+", // BOX DRAWINGS VERTICAL HEAVY AND HORIZONTAL LIGHT
    "\u2543":"+", // BOX DRAWINGS LEFT UP HEAVY AND RIGHT DOWN LIGHT
    "\u2544":"+", // BOX DRAWINGS RIGHT UP HEAVY AND LEFT DOWN LIGHT
    "\u2545":"+", // BOX DRAWINGS LEFT DOWN HEAVY AND RIGHT UP LIGHT
    "\u2546":"+", // BOX DRAWINGS RIGHT DOWN HEAVY AND LEFT UP LIGHT
    "\u2547":"+", // BOX DRAWINGS DOWN LIGHT AND UP HORIZONTAL HEAVY
    "\u2548":"+", // BOX DRAWINGS UP LIGHT AND DOWN HORIZONTAL HEAVY
    "\u2549":"+", // BOX DRAWINGS RIGHT LIGHT AND LEFT VERTICAL HEAVY
    "\u254A":"+", // BOX DRAWINGS LEFT LIGHT AND RIGHT VERTICAL HEAVY
    "\u254B":"+", // BOX DRAWINGS HEAVY VERTICAL AND HORIZONTAL
    "\u254C":"-", // BOX DRAWINGS LIGHT DOUBLE DASH HORIZONTAL
    "\u254D":"=", // BOX DRAWINGS HEAVY DOUBLE DASH HORIZONTAL
    "\u254E":"|", // BOX DRAWINGS LIGHT DOUBLE DASH VERTICAL
    "\u254F":"|", // BOX DRAWINGS HEAVY DOUBLE DASH VERTICAL
    "\u2550":"=", // BOX DRAWINGS DOUBLE HORIZONTAL
    "\u2551":"|", // BOX DRAWINGS DOUBLE VERTICAL
    "\u2552":"+", // BOX DRAWINGS DOWN SINGLE AND RIGHT DOUBLE
    "\u2553":"+", // BOX DRAWINGS DOWN DOUBLE AND RIGHT SINGLE
    "\u2554":"+", // BOX DRAWINGS DOUBLE DOWN AND RIGHT
    "\u2555":"+", // BOX DRAWINGS DOWN SINGLE AND LEFT DOUBLE
    "\u2556":"+", // BOX DRAWINGS DOWN DOUBLE AND LEFT SINGLE
    "\u2557":"+", // BOX DRAWINGS DOUBLE DOWN AND LEFT
    "\u2558":"+", // BOX DRAWINGS UP SINGLE AND RIGHT DOUBLE
    "\u2559":"+", // BOX DRAWINGS UP DOUBLE AND RIGHT SINGLE
    "\u255A":"+", // BOX DRAWINGS DOUBLE UP AND RIGHT
    "\u255B":"+", // BOX DRAWINGS UP SINGLE AND LEFT DOUBLE
    "\u255C":"+", // BOX DRAWINGS UP DOUBLE AND LEFT SINGLE
    "\u255D":"+", // BOX DRAWINGS DOUBLE UP AND LEFT
    "\u255E":"+", // BOX DRAWINGS VERTICAL SINGLE AND RIGHT DOUBLE
    "\u255F":"+", // BOX DRAWINGS VERTICAL DOUBLE AND RIGHT SINGLE
    "\u2560":"+", // BOX DRAWINGS DOUBLE VERTICAL AND RIGHT
    "\u2561":"+", // BOX DRAWINGS VERTICAL SINGLE AND LEFT DOUBLE
    "\u2562":"+", // BOX DRAWINGS VERTICAL DOUBLE AND LEFT SINGLE
    "\u2563":"+", // BOX DRAWINGS DOUBLE VERTICAL AND LEFT
    "\u2564":"+", // BOX DRAWINGS DOWN SINGLE AND HORIZONTAL DOUBLE
    "\u2565":"+", // BOX DRAWINGS DOWN DOUBLE AND HORIZONTAL SINGLE
    "\u2566":"+", // BOX DRAWINGS DOUBLE DOWN AND HORIZONTAL
    "\u2567":"+", // BOX DRAWINGS UP SINGLE AND HORIZONTAL DOUBLE
    "\u2568":"+", // BOX DRAWINGS UP DOUBLE AND HORIZONTAL SINGLE
    "\u2569":"+", // BOX DRAWINGS DOUBLE UP AND HORIZONTAL
    "\u256A":"+", // BOX DRAWINGS VERTICAL SINGLE AND HORIZONTAL DOUBLE
    "\u256B":"+", // BOX DRAWINGS VERTICAL DOUBLE AND HORIZONTAL SINGLE
    "\u256C":"+", // BOX DRAWINGS DOUBLE VERTICAL AND HORIZONTAL
    "\u256D":"+", // BOX DRAWINGS LIGHT ARC DOWN AND RIGHT
    "\u256E":"+", // BOX DRAWINGS LIGHT ARC DOWN AND LEFT
    "\u256F":"+", // BOX DRAWINGS LIGHT ARC UP AND LEFT
    "\u2570":"+", // BOX DRAWINGS LIGHT ARC UP AND RIGHT
    "\u2571":"/", // BOX DRAWINGS LIGHT DIAGONAL UPPER RIGHT TO LOWER LEFT
    "\u2572":"\\", // BOX DRAWINGS LIGHT DIAGONAL UPPER LEFT TO LOWER RIGHT
    "\u2573":"X", // BOX DRAWINGS LIGHT DIAGONAL CROSS
    "\u257C":"-", // BOX DRAWINGS LIGHT LEFT AND HEAVY RIGHT
    "\u257D":"|", // BOX DRAWINGS LIGHT UP AND HEAVY DOWN
    "\u257E":"-", // BOX DRAWINGS HEAVY LEFT AND LIGHT RIGHT
    "\u257F":"|", // BOX DRAWINGS HEAVY UP AND LIGHT DOWN
    "\u25CB":"o", // WHITE CIRCLE
    "\u25E6":"{\\textopenbullet}", // WHITE BULLET
    "\u2605":"*", // BLACK STAR
    "\u2606":"*", // WHITE STAR
    "\u2612":"X", // BALLOT BOX WITH X
    "\u2613":"X", // SALTIRE
    "\u2639":":-(", // WHITE FROWNING FACE
    "\u263A":":-)", // WHITE SMILING FACE
    "\u263B":"(-:", // BLACK SMILING FACE
    "\u266D":"b", // MUSIC FLAT SIGN
    "\u266F":"$\\#$", // MUSIC SHARP SIGN
    "\u2701":"$\\%<$", // UPPER BLADE SCISSORS
    "\u2702":"$\\%<$", // BLACK SCISSORS
    "\u2703":"$\\%<$", // LOWER BLADE SCISSORS
    "\u2704":"$\\%<$", // WHITE SCISSORS
    "\u270C":"V", // VICTORY HAND
    "\u2713":"v", // CHECK MARK
    "\u2714":"V", // HEAVY CHECK MARK
    "\u2715":"x", // MULTIPLICATION X
    "\u2716":"x", // HEAVY MULTIPLICATION X
    "\u2717":"X", // BALLOT X
    "\u2718":"X", // HEAVY BALLOT X
    "\u2719":"+", // OUTLINED GREEK CROSS
    "\u271A":"+", // HEAVY GREEK CROSS
    "\u271B":"+", // OPEN CENTRE CROSS
    "\u271C":"+", // HEAVY OPEN CENTRE CROSS
    "\u271D":"+", // LATIN CROSS
    "\u271E":"+", // SHADOWED WHITE LATIN CROSS
    "\u271F":"+", // OUTLINED LATIN CROSS
    "\u2720":"+", // MALTESE CROSS
    "\u2721":"*", // STAR OF DAVID
    "\u2722":"+", // FOUR TEARDROP-SPOKED ASTERISK
    "\u2723":"+", // FOUR BALLOON-SPOKED ASTERISK
    "\u2724":"+", // HEAVY FOUR BALLOON-SPOKED ASTERISK
    "\u2725":"+", // FOUR CLUB-SPOKED ASTERISK
    "\u2726":"+", // BLACK FOUR POINTED STAR
    "\u2727":"+", // WHITE FOUR POINTED STAR
    "\u2729":"*", // STRESS OUTLINED WHITE STAR
    "\u272A":"*", // CIRCLED WHITE STAR
    "\u272B":"*", // OPEN CENTRE BLACK STAR
    "\u272C":"*", // BLACK CENTRE WHITE STAR
    "\u272D":"*", // OUTLINED BLACK STAR
    "\u272E":"*", // HEAVY OUTLINED BLACK STAR
    "\u272F":"*", // PINWHEEL STAR
    "\u2730":"*", // SHADOWED WHITE STAR
    "\u2731":"*", // HEAVY ASTERISK
    "\u2732":"*", // OPEN CENTRE ASTERISK
    "\u2733":"*", // EIGHT SPOKED ASTERISK
    "\u2734":"*", // EIGHT POINTED BLACK STAR
    "\u2735":"*", // EIGHT POINTED PINWHEEL STAR
    "\u2736":"*", // SIX POINTED BLACK STAR
    "\u2737":"*", // EIGHT POINTED RECTILINEAR BLACK STAR
    "\u2738":"*", // HEAVY EIGHT POINTED RECTILINEAR BLACK STAR
    "\u2739":"*", // TWELVE POINTED BLACK STAR
    "\u273A":"*", // SIXTEEN POINTED ASTERISK
    "\u273B":"*", // TEARDROP-SPOKED ASTERISK
    "\u273C":"*", // OPEN CENTRE TEARDROP-SPOKED ASTERISK
    "\u273D":"*", // HEAVY TEARDROP-SPOKED ASTERISK
    "\u273E":"*", // SIX PETALLED BLACK AND WHITE FLORETTE
    "\u273F":"*", // BLACK FLORETTE
    "\u2740":"*", // WHITE FLORETTE
    "\u2741":"*", // EIGHT PETALLED OUTLINED BLACK FLORETTE
    "\u2742":"*", // CIRCLED OPEN CENTRE EIGHT POINTED STAR
    "\u2743":"*", // HEAVY TEARDROP-SPOKED PINWHEEL ASTERISK
    "\u2744":"*", // SNOWFLAKE
    "\u2745":"*", // TIGHT TRIFOLIATE SNOWFLAKE
    "\u2746":"*", // HEAVY CHEVRON SNOWFLAKE
    "\u2747":"*", // SPARKLE
    "\u2748":"*", // HEAVY SPARKLE
    "\u2749":"*", // BALLOON-SPOKED ASTERISK
    "\u274A":"*", // EIGHT TEARDROP-SPOKED PROPELLER ASTERISK
    "\u274B":"*", // HEAVY EIGHT TEARDROP-SPOKED PROPELLER ASTERISK
    "\uFB00":"ff", // LATIN SMALL LIGATURE FF
    "\uFB01":"fi", // LATIN SMALL LIGATURE FI
    "\uFB02":"fl", // LATIN SMALL LIGATURE FL
    "\uFB03":"ffi", // LATIN SMALL LIGATURE FFI
    "\uFB04":"ffl", // LATIN SMALL LIGATURE FFL
    "\uFB05":"st", // LATIN SMALL LIGATURE LONG S T
    "\uFB06":"st", // LATIN SMALL LIGATURE ST
/* Derived accented characters */
    "\u00C0":"\\`{A}", // LATIN CAPITAL LETTER A WITH GRAVE
    "\u00C1":"\\''{A}", // LATIN CAPITAL LETTER A WITH ACUTE
    "\u00C2":"\\^{A}", // LATIN CAPITAL LETTER A WITH CIRCUMFLEX
    "\u00C3":"\\~{A}", // LATIN CAPITAL LETTER A WITH TILDE
    "\u00C4":"\\\"{A}", // LATIN CAPITAL LETTER A WITH DIAERESIS
    "\u00C7":"\\c{C}", // LATIN CAPITAL LETTER C WITH CEDILLA
    "\u00C8":"\\`{E}", // LATIN CAPITAL LETTER E WITH GRAVE
    "\u00C9":"\\''{E}", // LATIN CAPITAL LETTER E WITH ACUTE
    "\u00CA":"\\^{E}", // LATIN CAPITAL LETTER E WITH CIRCUMFLEX
    "\u00CB":"\\\"{E}", // LATIN CAPITAL LETTER E WITH DIAERESIS
    "\u00CC":"\\`{I}", // LATIN CAPITAL LETTER I WITH GRAVE
    "\u00CD":"\\''{I}", // LATIN CAPITAL LETTER I WITH ACUTE
    "\u00CE":"\\^{I}", // LATIN CAPITAL LETTER I WITH CIRCUMFLEX
    "\u00CF":"\\\"{I}", // LATIN CAPITAL LETTER I WITH DIAERESIS
    "\u00D1":"\\~{N}", // LATIN CAPITAL LETTER N WITH TILDE
    "\u00D2":"\\`{O}", // LATIN CAPITAL LETTER O WITH GRAVE
    "\u00D3":"\\''{O}", // LATIN CAPITAL LETTER O WITH ACUTE
    "\u00D4":"\\^{O}", // LATIN CAPITAL LETTER O WITH CIRCUMFLEX
    "\u00D5":"\\~{O}", // LATIN CAPITAL LETTER O WITH TILDE
    "\u00D6":"\\\"{O}", // LATIN CAPITAL LETTER O WITH DIAERESIS
    "\u00D9":"\\`{U}", // LATIN CAPITAL LETTER U WITH GRAVE
    "\u00DA":"\\''{U}", // LATIN CAPITAL LETTER U WITH ACUTE
    "\u00DB":"\\^{U}", // LATIN CAPITAL LETTER U WITH CIRCUMFLEX
    "\u00DC":"\\\"{U}", // LATIN CAPITAL LETTER U WITH DIAERESIS
    "\u00DD":"\\''{Y}", // LATIN CAPITAL LETTER Y WITH ACUTE
    "\u00E0":"\\`{a}", // LATIN SMALL LETTER A WITH GRAVE
    "\u00E1":"\\''{a}", // LATIN SMALL LETTER A WITH ACUTE
    "\u00E2":"\\^{a}", // LATIN SMALL LETTER A WITH CIRCUMFLEX
    "\u00E3":"\\~{a}", // LATIN SMALL LETTER A WITH TILDE
    "\u00E4":"\\\"{a}", // LATIN SMALL LETTER A WITH DIAERESIS
    "\u00E7":"\\c{c}", // LATIN SMALL LETTER C WITH CEDILLA
    "\u00E8":"\\`{e}", // LATIN SMALL LETTER E WITH GRAVE
    "\u00E9":"\\''{e}", // LATIN SMALL LETTER E WITH ACUTE
    "\u00EA":"\\^{e}", // LATIN SMALL LETTER E WITH CIRCUMFLEX
    "\u00EB":"\\\"{e}", // LATIN SMALL LETTER E WITH DIAERESIS
    "\u00EC":"\\`{i}", // LATIN SMALL LETTER I WITH GRAVE
    "\u00ED":"\\''{i}", // LATIN SMALL LETTER I WITH ACUTE
    "\u00EE":"\\^{i}", // LATIN SMALL LETTER I WITH CIRCUMFLEX
    "\u00EF":"\\\"{i}", // LATIN SMALL LETTER I WITH DIAERESIS
    "\u00F1":"\\~{n}", // LATIN SMALL LETTER N WITH TILDE
    "\u00F2":"\\`{o}", // LATIN SMALL LETTER O WITH GRAVE
    "\u00F3":"\\''{o}", // LATIN SMALL LETTER O WITH ACUTE
    "\u00F4":"\\^{o}", // LATIN SMALL LETTER O WITH CIRCUMFLEX
    "\u00F5":"\\~{o}", // LATIN SMALL LETTER O WITH TILDE
    "\u00F6":"\\\"{o}", // LATIN SMALL LETTER O WITH DIAERESIS
    "\u00F9":"\\`{u}", // LATIN SMALL LETTER U WITH GRAVE
    "\u00FA":"\\''{u}", // LATIN SMALL LETTER U WITH ACUTE
    "\u00FB":"\\^{u}", // LATIN SMALL LETTER U WITH CIRCUMFLEX
    "\u00FC":"\\\"{u}", // LATIN SMALL LETTER U WITH DIAERESIS
    "\u00FD":"\\''{y}", // LATIN SMALL LETTER Y WITH ACUTE
    "\u00FF":"\\\"{y}", // LATIN SMALL LETTER Y WITH DIAERESIS
    "\u0100":"\\={A}", // LATIN CAPITAL LETTER A WITH MACRON
    "\u0101":"\\={a}", // LATIN SMALL LETTER A WITH MACRON
    "\u0102":"\\u{A}", // LATIN CAPITAL LETTER A WITH BREVE
    "\u0103":"\\u{a}", // LATIN SMALL LETTER A WITH BREVE
    "\u0104":"\\k{A}", // LATIN CAPITAL LETTER A WITH OGONEK
    "\u0105":"\\k{a}", // LATIN SMALL LETTER A WITH OGONEK
    "\u0106":"\\''{C}", // LATIN CAPITAL LETTER C WITH ACUTE
    "\u0107":"\\''{c}", // LATIN SMALL LETTER C WITH ACUTE
    "\u0108":"\\^{C}", // LATIN CAPITAL LETTER C WITH CIRCUMFLEX
    "\u0109":"\\^{c}", // LATIN SMALL LETTER C WITH CIRCUMFLEX
    "\u010A":"\\.{C}", // LATIN CAPITAL LETTER C WITH DOT ABOVE
    "\u010B":"\\.{c}", // LATIN SMALL LETTER C WITH DOT ABOVE
    "\u010C":"\\v{C}", // LATIN CAPITAL LETTER C WITH CARON
    "\u010D":"\\v{c}", // LATIN SMALL LETTER C WITH CARON
    "\u010E":"\\v{D}", // LATIN CAPITAL LETTER D WITH CARON
    "\u010F":"\\v{d}", // LATIN SMALL LETTER D WITH CARON
    "\u0112":"\\={E}", // LATIN CAPITAL LETTER E WITH MACRON
    "\u0113":"\\={e}", // LATIN SMALL LETTER E WITH MACRON
    "\u0114":"\\u{E}", // LATIN CAPITAL LETTER E WITH BREVE
    "\u0115":"\\u{e}", // LATIN SMALL LETTER E WITH BREVE
    "\u0116":"\\.{E}", // LATIN CAPITAL LETTER E WITH DOT ABOVE
    "\u0117":"\\.{e}", // LATIN SMALL LETTER E WITH DOT ABOVE
    "\u0118":"\\k{E}", // LATIN CAPITAL LETTER E WITH OGONEK
    "\u0119":"\\k{e}", // LATIN SMALL LETTER E WITH OGONEK
    "\u011A":"\\v{E}", // LATIN CAPITAL LETTER E WITH CARON
    "\u011B":"\\v{e}", // LATIN SMALL LETTER E WITH CARON
    "\u011C":"\\^{G}", // LATIN CAPITAL LETTER G WITH CIRCUMFLEX
    "\u011D":"\\^{g}", // LATIN SMALL LETTER G WITH CIRCUMFLEX
    "\u011E":"\\u{G}", // LATIN CAPITAL LETTER G WITH BREVE
    "\u011F":"\\u{g}", // LATIN SMALL LETTER G WITH BREVE
    "\u0120":"\\.{G}", // LATIN CAPITAL LETTER G WITH DOT ABOVE
    "\u0121":"\\.{g}", // LATIN SMALL LETTER G WITH DOT ABOVE
    "\u0122":"\\c{G}", // LATIN CAPITAL LETTER G WITH CEDILLA
    "\u0123":"\\c{g}", // LATIN SMALL LETTER G WITH CEDILLA
    "\u0124":"\\^{H}", // LATIN CAPITAL LETTER H WITH CIRCUMFLEX
    "\u0125":"\\^{h}", // LATIN SMALL LETTER H WITH CIRCUMFLEX
    "\u0128":"\\~{I}", // LATIN CAPITAL LETTER I WITH TILDE
    "\u0129":"\\~{i}", // LATIN SMALL LETTER I WITH TILDE
    "\u012A":"\\={I}", // LATIN CAPITAL LETTER I WITH MACRON
    "\u012B":"\\={i}", // LATIN SMALL LETTER I WITH MACRON
    "\u012C":"\\u{I}", // LATIN CAPITAL LETTER I WITH BREVE
    "\u012D":"\\u{i}", // LATIN SMALL LETTER I WITH BREVE
    "\u012E":"\\k{I}", // LATIN CAPITAL LETTER I WITH OGONEK
    "\u012F":"\\k{i}", // LATIN SMALL LETTER I WITH OGONEK
    "\u0130":"\\.{I}", // LATIN CAPITAL LETTER I WITH DOT ABOVE
    "\u0134":"\\^{J}", // LATIN CAPITAL LETTER J WITH CIRCUMFLEX
    "\u0135":"\\^{j}", // LATIN SMALL LETTER J WITH CIRCUMFLEX
    "\u0136":"\\c{K}", // LATIN CAPITAL LETTER K WITH CEDILLA
    "\u0137":"\\c{k}", // LATIN SMALL LETTER K WITH CEDILLA
    "\u0139":"\\''{L}", // LATIN CAPITAL LETTER L WITH ACUTE
    "\u013A":"\\''{l}", // LATIN SMALL LETTER L WITH ACUTE
    "\u013B":"\\c{L}", // LATIN CAPITAL LETTER L WITH CEDILLA
    "\u013C":"\\c{l}", // LATIN SMALL LETTER L WITH CEDILLA
    "\u013D":"\\v{L}", // LATIN CAPITAL LETTER L WITH CARON
    "\u013E":"\\v{l}", // LATIN SMALL LETTER L WITH CARON
    "\u0143":"\\''{N}", // LATIN CAPITAL LETTER N WITH ACUTE
    "\u0144":"\\''{n}", // LATIN SMALL LETTER N WITH ACUTE
    "\u0145":"\\c{N}", // LATIN CAPITAL LETTER N WITH CEDILLA
    "\u0146":"\\c{n}", // LATIN SMALL LETTER N WITH CEDILLA
    "\u0147":"\\v{N}", // LATIN CAPITAL LETTER N WITH CARON
    "\u0148":"\\v{n}", // LATIN SMALL LETTER N WITH CARON
    "\u014C":"\\={O}", // LATIN CAPITAL LETTER O WITH MACRON
    "\u014D":"\\={o}", // LATIN SMALL LETTER O WITH MACRON
    "\u014E":"\\u{O}", // LATIN CAPITAL LETTER O WITH BREVE
    "\u014F":"\\u{o}", // LATIN SMALL LETTER O WITH BREVE
    "\u0150":"\\H{O}", // LATIN CAPITAL LETTER O WITH DOUBLE ACUTE
    "\u0151":"\\H{o}", // LATIN SMALL LETTER O WITH DOUBLE ACUTE
    "\u0154":"\\''{R}", // LATIN CAPITAL LETTER R WITH ACUTE
    "\u0155":"\\''{r}", // LATIN SMALL LETTER R WITH ACUTE
    "\u0156":"\\c{R}", // LATIN CAPITAL LETTER R WITH CEDILLA
    "\u0157":"\\c{r}", // LATIN SMALL LETTER R WITH CEDILLA
    "\u0158":"\\v{R}", // LATIN CAPITAL LETTER R WITH CARON
    "\u0159":"\\v{r}", // LATIN SMALL LETTER R WITH CARON
    "\u015A":"\\''{S}", // LATIN CAPITAL LETTER S WITH ACUTE
    "\u015B":"\\''{s}", // LATIN SMALL LETTER S WITH ACUTE
    "\u015C":"\\^{S}", // LATIN CAPITAL LETTER S WITH CIRCUMFLEX
    "\u015D":"\\^{s}", // LATIN SMALL LETTER S WITH CIRCUMFLEX
    "\u015E":"\\c{S}", // LATIN CAPITAL LETTER S WITH CEDILLA
    "\u015F":"\\c{s}", // LATIN SMALL LETTER S WITH CEDILLA
    "\u0160":"\\v{S}", // LATIN CAPITAL LETTER S WITH CARON
    "\u0161":"\\v{s}", // LATIN SMALL LETTER S WITH CARON
    "\u0162":"\\c{T}", // LATIN CAPITAL LETTER T WITH CEDILLA
    "\u0163":"\\c{t}", // LATIN SMALL LETTER T WITH CEDILLA
    "\u0164":"\\v{T}", // LATIN CAPITAL LETTER T WITH CARON
    "\u0165":"\\v{t}", // LATIN SMALL LETTER T WITH CARON
    "\u0168":"\\~{U}", // LATIN CAPITAL LETTER U WITH TILDE
    "\u0169":"\\~{u}", // LATIN SMALL LETTER U WITH TILDE
    "\u016A":"\\={U}", // LATIN CAPITAL LETTER U WITH MACRON
    "\u016B":"\\={u}", // LATIN SMALL LETTER U WITH MACRON
    "\u016C":"\\u{U}", // LATIN CAPITAL LETTER U WITH BREVE
    "\u016D":"\\u{u}", // LATIN SMALL LETTER U WITH BREVE
    "\u0170":"\\H{U}", // LATIN CAPITAL LETTER U WITH DOUBLE ACUTE
    "\u0171":"\\H{u}", // LATIN SMALL LETTER U WITH DOUBLE ACUTE
    "\u0172":"\\k{U}", // LATIN CAPITAL LETTER U WITH OGONEK
    "\u0173":"\\k{u}", // LATIN SMALL LETTER U WITH OGONEK
    "\u0174":"\\^{W}", // LATIN CAPITAL LETTER W WITH CIRCUMFLEX
    "\u0175":"\\^{w}", // LATIN SMALL LETTER W WITH CIRCUMFLEX
    "\u0176":"\\^{Y}", // LATIN CAPITAL LETTER Y WITH CIRCUMFLEX
    "\u0177":"\\^{y}", // LATIN SMALL LETTER Y WITH CIRCUMFLEX
    "\u0178":"\\\"{Y}", // LATIN CAPITAL LETTER Y WITH DIAERESIS
    "\u0179":"\\''{Z}", // LATIN CAPITAL LETTER Z WITH ACUTE
    "\u017A":"\\''{z}", // LATIN SMALL LETTER Z WITH ACUTE
    "\u017B":"\\.{Z}", // LATIN CAPITAL LETTER Z WITH DOT ABOVE
    "\u017C":"\\.{z}", // LATIN SMALL LETTER Z WITH DOT ABOVE
    "\u017D":"\\v{Z}", // LATIN CAPITAL LETTER Z WITH CARON
    "\u017E":"\\v{z}", // LATIN SMALL LETTER Z WITH CARON
    "\u01CD":"\\v{A}", // LATIN CAPITAL LETTER A WITH CARON
    "\u01CE":"\\v{a}", // LATIN SMALL LETTER A WITH CARON
    "\u01CF":"\\v{I}", // LATIN CAPITAL LETTER I WITH CARON
    "\u01D0":"\\v{i}", // LATIN SMALL LETTER I WITH CARON
    "\u01D1":"\\v{O}", // LATIN CAPITAL LETTER O WITH CARON
    "\u01D2":"\\v{o}", // LATIN SMALL LETTER O WITH CARON
    "\u01D3":"\\v{U}", // LATIN CAPITAL LETTER U WITH CARON
    "\u01D4":"\\v{u}", // LATIN SMALL LETTER U WITH CARON
    "\u01E6":"\\v{G}", // LATIN CAPITAL LETTER G WITH CARON
    "\u01E7":"\\v{g}", // LATIN SMALL LETTER G WITH CARON
    "\u01E8":"\\v{K}", // LATIN CAPITAL LETTER K WITH CARON
    "\u01E9":"\\v{k}", // LATIN SMALL LETTER K WITH CARON
    "\u01EA":"\\k{O}", // LATIN CAPITAL LETTER O WITH OGONEK
    "\u01EB":"\\k{o}", // LATIN SMALL LETTER O WITH OGONEK
    "\u01F0":"\\v{j}", // LATIN SMALL LETTER J WITH CARON
    "\u01F4":"\\''{G}", // LATIN CAPITAL LETTER G WITH ACUTE
    "\u01F5":"\\''{g}", // LATIN SMALL LETTER G WITH ACUTE
    "\u1E02":"\\.{B}", // LATIN CAPITAL LETTER B WITH DOT ABOVE
    "\u1E03":"\\.{b}", // LATIN SMALL LETTER B WITH DOT ABOVE
    "\u1E04":"\\d{B}", // LATIN CAPITAL LETTER B WITH DOT BELOW
    "\u1E05":"\\d{b}", // LATIN SMALL LETTER B WITH DOT BELOW
    "\u1E06":"\\b{B}", // LATIN CAPITAL LETTER B WITH LINE BELOW
    "\u1E07":"\\b{b}", // LATIN SMALL LETTER B WITH LINE BELOW
    "\u1E0A":"\\.{D}", // LATIN CAPITAL LETTER D WITH DOT ABOVE
    "\u1E0B":"\\.{d}", // LATIN SMALL LETTER D WITH DOT ABOVE
    "\u1E0C":"\\d{D}", // LATIN CAPITAL LETTER D WITH DOT BELOW
    "\u1E0D":"\\d{d}", // LATIN SMALL LETTER D WITH DOT BELOW
    "\u1E0E":"\\b{D}", // LATIN CAPITAL LETTER D WITH LINE BELOW
    "\u1E0F":"\\b{d}", // LATIN SMALL LETTER D WITH LINE BELOW
    "\u1E10":"\\c{D}", // LATIN CAPITAL LETTER D WITH CEDILLA
    "\u1E11":"\\c{d}", // LATIN SMALL LETTER D WITH CEDILLA
    "\u1E1E":"\\.{F}", // LATIN CAPITAL LETTER F WITH DOT ABOVE
    "\u1E1F":"\\.{f}", // LATIN SMALL LETTER F WITH DOT ABOVE
    "\u1E20":"\\={G}", // LATIN CAPITAL LETTER G WITH MACRON
    "\u1E21":"\\={g}", // LATIN SMALL LETTER G WITH MACRON
    "\u1E22":"\\.{H}", // LATIN CAPITAL LETTER H WITH DOT ABOVE
    "\u1E23":"\\.{h}", // LATIN SMALL LETTER H WITH DOT ABOVE
    "\u1E24":"\\d{H}", // LATIN CAPITAL LETTER H WITH DOT BELOW
    "\u1E25":"\\d{h}", // LATIN SMALL LETTER H WITH DOT BELOW
    "\u1E26":"\\\"{H}", // LATIN CAPITAL LETTER H WITH DIAERESIS
    "\u1E27":"\\\"{h}", // LATIN SMALL LETTER H WITH DIAERESIS
    "\u1E28":"\\c{H}", // LATIN CAPITAL LETTER H WITH CEDILLA
    "\u1E29":"\\c{h}", // LATIN SMALL LETTER H WITH CEDILLA
    "\u1E30":"\\''{K}", // LATIN CAPITAL LETTER K WITH ACUTE
    "\u1E31":"\\''{k}", // LATIN SMALL LETTER K WITH ACUTE
    "\u1E32":"\\d{K}", // LATIN CAPITAL LETTER K WITH DOT BELOW
    "\u1E33":"\\d{k}", // LATIN SMALL LETTER K WITH DOT BELOW
    "\u1E34":"\\b{K}", // LATIN CAPITAL LETTER K WITH LINE BELOW
    "\u1E35":"\\b{k}", // LATIN SMALL LETTER K WITH LINE BELOW
    "\u1E36":"\\d{L}", // LATIN CAPITAL LETTER L WITH DOT BELOW
    "\u1E37":"\\d{l}", // LATIN SMALL LETTER L WITH DOT BELOW
    "\u1E3A":"\\b{L}", // LATIN CAPITAL LETTER L WITH LINE BELOW
    "\u1E3B":"\\b{l}", // LATIN SMALL LETTER L WITH LINE BELOW
    "\u1E3E":"\\''{M}", // LATIN CAPITAL LETTER M WITH ACUTE
    "\u1E3F":"\\''{m}", // LATIN SMALL LETTER M WITH ACUTE
    "\u1E40":"\\.{M}", // LATIN CAPITAL LETTER M WITH DOT ABOVE
    "\u1E41":"\\.{m}", // LATIN SMALL LETTER M WITH DOT ABOVE
    "\u1E42":"\\d{M}", // LATIN CAPITAL LETTER M WITH DOT BELOW
    "\u1E43":"\\d{m}", // LATIN SMALL LETTER M WITH DOT BELOW
    "\u1E44":"\\.{N}", // LATIN CAPITAL LETTER N WITH DOT ABOVE
    "\u1E45":"\\.{n}", // LATIN SMALL LETTER N WITH DOT ABOVE
    "\u1E46":"\\d{N}", // LATIN CAPITAL LETTER N WITH DOT BELOW
    "\u1E47":"\\d{n}", // LATIN SMALL LETTER N WITH DOT BELOW
    "\u1E48":"\\b{N}", // LATIN CAPITAL LETTER N WITH LINE BELOW
    "\u1E49":"\\b{n}", // LATIN SMALL LETTER N WITH LINE BELOW
    "\u1E54":"\\''{P}", // LATIN CAPITAL LETTER P WITH ACUTE
    "\u1E55":"\\''{p}", // LATIN SMALL LETTER P WITH ACUTE
    "\u1E56":"\\.{P}", // LATIN CAPITAL LETTER P WITH DOT ABOVE
    "\u1E57":"\\.{p}", // LATIN SMALL LETTER P WITH DOT ABOVE
    "\u1E58":"\\.{R}", // LATIN CAPITAL LETTER R WITH DOT ABOVE
    "\u1E59":"\\.{r}", // LATIN SMALL LETTER R WITH DOT ABOVE
    "\u1E5A":"\\d{R}", // LATIN CAPITAL LETTER R WITH DOT BELOW
    "\u1E5B":"\\d{r}", // LATIN SMALL LETTER R WITH DOT BELOW
    "\u1E5E":"\\b{R}", // LATIN CAPITAL LETTER R WITH LINE BELOW
    "\u1E5F":"\\b{r}", // LATIN SMALL LETTER R WITH LINE BELOW
    "\u1E60":"\\.{S}", // LATIN CAPITAL LETTER S WITH DOT ABOVE
    "\u1E61":"\\.{s}", // LATIN SMALL LETTER S WITH DOT ABOVE
    "\u1E62":"\\d{S}", // LATIN CAPITAL LETTER S WITH DOT BELOW
    "\u1E63":"\\d{s}", // LATIN SMALL LETTER S WITH DOT BELOW
    "\u1E6A":"\\.{T}", // LATIN CAPITAL LETTER T WITH DOT ABOVE
    "\u1E6B":"\\.{t}", // LATIN SMALL LETTER T WITH DOT ABOVE
    "\u1E6C":"\\d{T}", // LATIN CAPITAL LETTER T WITH DOT BELOW
    "\u1E6D":"\\d{t}", // LATIN SMALL LETTER T WITH DOT BELOW
    "\u1E6E":"\\b{T}", // LATIN CAPITAL LETTER T WITH LINE BELOW
    "\u1E6F":"\\b{t}", // LATIN SMALL LETTER T WITH LINE BELOW
    "\u1E7C":"\\~{V}", // LATIN CAPITAL LETTER V WITH TILDE
    "\u1E7D":"\\~{v}", // LATIN SMALL LETTER V WITH TILDE
    "\u1E7E":"\\d{V}", // LATIN CAPITAL LETTER V WITH DOT BELOW
    "\u1E7F":"\\d{v}", // LATIN SMALL LETTER V WITH DOT BELOW
    "\u1E80":"\\`{W}", // LATIN CAPITAL LETTER W WITH GRAVE
    "\u1E81":"\\`{w}", // LATIN SMALL LETTER W WITH GRAVE
    "\u1E82":"\\''{W}", // LATIN CAPITAL LETTER W WITH ACUTE
    "\u1E83":"\\''{w}", // LATIN SMALL LETTER W WITH ACUTE
    "\u1E84":"\\\"{W}", // LATIN CAPITAL LETTER W WITH DIAERESIS
    "\u1E85":"\\\"{w}", // LATIN SMALL LETTER W WITH DIAERESIS
    "\u1E86":"\\.{W}", // LATIN CAPITAL LETTER W WITH DOT ABOVE
    "\u1E87":"\\.{w}", // LATIN SMALL LETTER W WITH DOT ABOVE
    "\u1E88":"\\d{W}", // LATIN CAPITAL LETTER W WITH DOT BELOW
    "\u1E89":"\\d{w}", // LATIN SMALL LETTER W WITH DOT BELOW
    "\u1E8A":"\\.{X}", // LATIN CAPITAL LETTER X WITH DOT ABOVE
    "\u1E8B":"\\.{x}", // LATIN SMALL LETTER X WITH DOT ABOVE
    "\u1E8C":"\\\"{X}", // LATIN CAPITAL LETTER X WITH DIAERESIS
    "\u1E8D":"\\\"{x}", // LATIN SMALL LETTER X WITH DIAERESIS
    "\u1E8E":"\\.{Y}", // LATIN CAPITAL LETTER Y WITH DOT ABOVE
    "\u1E8F":"\\.{y}", // LATIN SMALL LETTER Y WITH DOT ABOVE
    "\u1E90":"\\^{Z}", // LATIN CAPITAL LETTER Z WITH CIRCUMFLEX
    "\u1E91":"\\^{z}", // LATIN SMALL LETTER Z WITH CIRCUMFLEX
    "\u1E92":"\\d{Z}", // LATIN CAPITAL LETTER Z WITH DOT BELOW
    "\u1E93":"\\d{z}", // LATIN SMALL LETTER Z WITH DOT BELOW
    "\u1E94":"\\b{Z}", // LATIN CAPITAL LETTER Z WITH LINE BELOW
    "\u1E95":"\\b{z}", // LATIN SMALL LETTER Z WITH LINE BELOW
    "\u1E96":"\\b{h}", // LATIN SMALL LETTER H WITH LINE BELOW
    "\u1E97":"\\\"{t}", // LATIN SMALL LETTER T WITH DIAERESIS
    "\u1EA0":"\\d{A}", // LATIN CAPITAL LETTER A WITH DOT BELOW
    "\u1EA1":"\\d{a}", // LATIN SMALL LETTER A WITH DOT BELOW
    "\u1EB8":"\\d{E}", // LATIN CAPITAL LETTER E WITH DOT BELOW
    "\u1EB9":"\\d{e}", // LATIN SMALL LETTER E WITH DOT BELOW
    "\u1EBC":"\\~{E}", // LATIN CAPITAL LETTER E WITH TILDE
    "\u1EBD":"\\~{e}", // LATIN SMALL LETTER E WITH TILDE
    "\u1ECA":"\\d{I}", // LATIN CAPITAL LETTER I WITH DOT BELOW
    "\u1ECB":"\\d{i}", // LATIN SMALL LETTER I WITH DOT BELOW
    "\u1ECC":"\\d{O}", // LATIN CAPITAL LETTER O WITH DOT BELOW
    "\u1ECD":"\\d{o}", // LATIN SMALL LETTER O WITH DOT BELOW
    "\u1EE4":"\\d{U}", // LATIN CAPITAL LETTER U WITH DOT BELOW
    "\u1EE5":"\\d{u}", // LATIN SMALL LETTER U WITH DOT BELOW
    "\u1EF2":"\\`{Y}", // LATIN CAPITAL LETTER Y WITH GRAVE
    "\u1EF3":"\\`{y}", // LATIN SMALL LETTER Y WITH GRAVE
    "\u1EF4":"\\d{Y}", // LATIN CAPITAL LETTER Y WITH DOT BELOW
    "\u1EF5":"\\d{y}", // LATIN SMALL LETTER Y WITH DOT BELOW
    "\u1EF8":"\\~{Y}", // LATIN CAPITAL LETTER Y WITH TILDE
    "\u1EF9":"\\~{y}", // LATIN SMALL LETTER Y WITH TILDE

};

/* unfortunately the mapping isn''t reversible - hence this second table - sigh! */
var reversemappingTable = {
    "\u00A0":"~", // NO-BREAK SPACE
    "\u00A1":"{\\textexclamdown}", // INVERTED EXCLAMATION MARK
    "\u00A2":"{\\textcent}", // CENT SIGN
    "\u00A3":"{\\textsterling}", // POUND SIGN
    "\u00A5":"{\\textyen}", // YEN SIGN
    "\u00A6":"{\\textbrokenbar}", // BROKEN BAR
    "\u00A7":"{\\textsection}", // SECTION SIGN
    "\u00A8":"{\\textasciidieresis}", // DIAERESIS
    "\u00A9":"{\\textcopyright}", // COPYRIGHT SIGN
    "\u00AA":"{\\textordfeminine}", // FEMININE ORDINAL INDICATOR
    "\u00AB":"{\\guillemotleft}", // LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
    "\u00AC":"{\\textlnot}", // NOT SIGN
    "\u00AE":"{\\textregistered}", // REGISTERED SIGN
    "\u00AF":"{\\textasciimacron}", // MACRON
    "\u00B0":"{\\textdegree}", // DEGREE SIGN
    "\u00B1":"{\\textpm}", // PLUS-MINUS SIGN
    "\u00B2":"{\\texttwosuperior}", // SUPERSCRIPT TWO
    "\u00B3":"{\\textthreesuperior}", // SUPERSCRIPT THREE
    "\u00B4":"{\\textasciiacute}", // ACUTE ACCENT
    "\u00B5":"{\\textmu}", // MICRO SIGN
    "\u00B6":"{\\textparagraph}", // PILCROW SIGN
    "\u00B7":"{\\textperiodcentered}", // MIDDLE DOT
    "\u00B8":"{\\c\\ }", // CEDILLA
    "\u00B9":"{\\textonesuperior}", // SUPERSCRIPT ONE
    "\u00BA":"{\\textordmasculine}", // MASCULINE ORDINAL INDICATOR
    "\u00BB":"{\\guillemotright}", // RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
    "\u00BC":"{\\textonequarter}", // VULGAR FRACTION ONE QUARTER
    "\u00BD":"{\\textonehalf}", // VULGAR FRACTION ONE HALF
    "\u00BE":"{\\textthreequarters}", // VULGAR FRACTION THREE QUARTERS
    "\u00BF":"{\\textquestiondown}", // INVERTED QUESTION MARK
    "\u00C6":"{\\AE}", // LATIN CAPITAL LETTER AE
    "\u00D0":"{\\DH}", // LATIN CAPITAL LETTER ETH
    "\u00D7":"{\\texttimes}", // MULTIPLICATION SIGN
    "\u00DE":"{\\TH}", // LATIN CAPITAL LETTER THORN
    "\u00DF":"{\\ss}", // LATIN SMALL LETTER SHARP S
    "\u00E6":"{\\ae}", // LATIN SMALL LETTER AE
    "\u00F0":"{\\dh}", // LATIN SMALL LETTER ETH
    "\u00F7":"{\\textdiv}", // DIVISION SIGN
    "\u00FE":"{\\th}", // LATIN SMALL LETTER THORN
    "\u0131":"{\\i}", // LATIN SMALL LETTER DOTLESS I
    "\u0149":"''n", // LATIN SMALL LETTER N PRECEDED BY APOSTROPHE
    "\u014A":"{\\NG}", // LATIN CAPITAL LETTER ENG
    "\u014B":"{\\ng}", // LATIN SMALL LETTER ENG
    "\u0152":"{\\OE}", // LATIN CAPITAL LIGATURE OE
    "\u0153":"{\\oe}", // LATIN SMALL LIGATURE OE
    "\u02C6":"{\\textasciicircum}", // MODIFIER LETTER CIRCUMFLEX ACCENT
    "\u02DC":"\\~{}", // SMALL TILDE
    "\u02DD":"{\\textacutedbl}", // DOUBLE ACUTE ACCENT
    "\u2013":"{\\textendash}", // EN DASH
    "\u2014":"{\\textemdash}", // EM DASH
    "\u2015":"--", // HORIZONTAL BAR
    "\u2016":"{\\textbardbl}", // DOUBLE VERTICAL LINE
    "\u2017":"{\\textunderscore}", // DOUBLE LOW LINE
    "\u2018":"{\\textquoteleft}", // LEFT SINGLE QUOTATION MARK
    "\u2019":"{\\textquoteright}", // RIGHT SINGLE QUOTATION MARK
    "\u201A":"{\\quotesinglbase}", // SINGLE LOW-9 QUOTATION MARK
    "\u201C":"{\\textquotedblleft}", // LEFT DOUBLE QUOTATION MARK
    "\u201D":"{\\textquotedblright}", // RIGHT DOUBLE QUOTATION MARK
    "\u201E":"{\\quotedblbase}", // DOUBLE LOW-9 QUOTATION MARK
    "\u201F":"{\\quotedblbase}", // DOUBLE HIGH-REVERSED-9 QUOTATION MARK
    "\u2020":"{\\textdagger}", // DAGGER
    "\u2021":"{\\textdaggerdbl}", // DOUBLE DAGGER
    "\u2022":"{\\textbullet}", // BULLET
    "\u2026":"{\\textellipsis}", // HORIZONTAL ELLIPSIS
    "\u2030":"{\\textperthousand}", // PER MILLE SIGN
    "\u2034":"''''''", // TRIPLE PRIME
    "\u2036":"``", // REVERSED DOUBLE PRIME
    "\u2037":"```", // REVERSED TRIPLE PRIME
    "\u2039":"{\\guilsinglleft}", // SINGLE LEFT-POINTING ANGLE QUOTATION MARK
    "\u203A":"{\\guilsinglright}", // SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
    "\u203C":"!!", // DOUBLE EXCLAMATION MARK
    "\u2044":"{\\textfractionsolidus}", // FRACTION SLASH
    "\u2048":"?!", // QUESTION EXCLAMATION MARK
    "\u2049":"!?", // EXCLAMATION QUESTION MARK
    "\u2070":"$^{0}$", // SUPERSCRIPT ZERO
    "\u2074":"$^{4}$", // SUPERSCRIPT FOUR
    "\u2075":"$^{5}$", // SUPERSCRIPT FIVE
    "\u2076":"$^{6}$", // SUPERSCRIPT SIX
    "\u2077":"$^{7}$", // SUPERSCRIPT SEVEN
    "\u2078":"$^{8}$", // SUPERSCRIPT EIGHT
    "\u2079":"$^{9}$", // SUPERSCRIPT NINE
    "\u207A":"$^{+}$", // SUPERSCRIPT PLUS SIGN
    "\u207B":"$^{-}$", // SUPERSCRIPT MINUS
    "\u207C":"$^{=}$", // SUPERSCRIPT EQUALS SIGN
    "\u207D":"$^{(}$", // SUPERSCRIPT LEFT PARENTHESIS
    "\u207E":"$^{)}$", // SUPERSCRIPT RIGHT PARENTHESIS
    "\u207F":"$^{n}$", // SUPERSCRIPT LATIN SMALL LETTER N
    "\u2080":"$_{0}$", // SUBSCRIPT ZERO
    "\u2081":"$_{1}$", // SUBSCRIPT ONE
    "\u2082":"$_{2}$", // SUBSCRIPT TWO
    "\u2083":"$_{3}$", // SUBSCRIPT THREE
    "\u2084":"$_{4}$", // SUBSCRIPT FOUR
    "\u2085":"$_{5}$", // SUBSCRIPT FIVE
    "\u2086":"$_{6}$", // SUBSCRIPT SIX
    "\u2087":"$_{7}$", // SUBSCRIPT SEVEN
    "\u2088":"$_{8}$", // SUBSCRIPT EIGHT
    "\u2089":"$_{9}$", // SUBSCRIPT NINE
    "\u208A":"$_{+}$", // SUBSCRIPT PLUS SIGN
    "\u208B":"$_{-}$", // SUBSCRIPT MINUS
    "\u208C":"$_{=}$", // SUBSCRIPT EQUALS SIGN
    "\u208D":"$_{(}$", // SUBSCRIPT LEFT PARENTHESIS
    "\u208E":"$_{)}$", // SUBSCRIPT RIGHT PARENTHESIS
    "\u20AC":"{\\texteuro}", // EURO SIGN
    "\u2100":"a/c", // ACCOUNT OF
    "\u2101":"a/s", // ADDRESSED TO THE SUBJECT
    "\u2103":"{\\textcelsius}", // DEGREE CELSIUS
    "\u2105":"c/o", // CARE OF
    "\u2106":"c/u", // CADA UNA
    "\u2116":"{\\textnumero}", // NUMERO SIGN
    "\u2117":"{\\textcircledP}", // SOUND RECORDING COPYRIGHT
    "\u2120":"{\\textservicemark}", // SERVICE MARK
    "\u2121":"{TEL}", // TELEPHONE SIGN
    "\u2122":"{\\texttrademark}", // TRADE MARK SIGN
    "\u2126":"{\\textohm}", // OHM SIGN
    "\u212E":"{\\textestimated}", // ESTIMATED SYMBOL
    "\u2153":" 1/3", // VULGAR FRACTION ONE THIRD
    "\u2154":" 2/3", // VULGAR FRACTION TWO THIRDS
    "\u2155":" 1/5", // VULGAR FRACTION ONE FIFTH
    "\u2156":" 2/5", // VULGAR FRACTION TWO FIFTHS
    "\u2157":" 3/5", // VULGAR FRACTION THREE FIFTHS
    "\u2158":" 4/5", // VULGAR FRACTION FOUR FIFTHS
    "\u2159":" 1/6", // VULGAR FRACTION ONE SIXTH
    "\u215A":" 5/6", // VULGAR FRACTION FIVE SIXTHS
    "\u215B":" 1/8", // VULGAR FRACTION ONE EIGHTH
    "\u215C":" 3/8", // VULGAR FRACTION THREE EIGHTHS
    "\u215D":" 5/8", // VULGAR FRACTION FIVE EIGHTHS
    "\u215E":" 7/8", // VULGAR FRACTION SEVEN EIGHTHS
    "\u215F":" 1/", // FRACTION NUMERATOR ONE
    "\u2190":"{\\textleftarrow}", // LEFTWARDS ARROW
    "\u2191":"{\\textuparrow}", // UPWARDS ARROW
    "\u2192":"{\\textrightarrow}", // RIGHTWARDS ARROW
    "\u2193":"{\\textdownarrow}", // DOWNWARDS ARROW
    "\u2194":"<->", // LEFT RIGHT ARROW
    "\u21D0":"<=", // LEFTWARDS DOUBLE ARROW
    "\u21D2":"=>", // RIGHTWARDS DOUBLE ARROW
    "\u21D4":"<=>", // LEFT RIGHT DOUBLE ARROW
    "\u221E":"$\\infty$", // INFINITY
    "\u2225":"||", // PARALLEL TO
    "\u223C":"\\~{}", // TILDE OPERATOR
    "\u2260":"/=", // NOT EQUAL TO
    "\u2264":"<=", // LESS-THAN OR EQUAL TO
    "\u2265":">=", // GREATER-THAN OR EQUAL TO
    "\u226A":"<<", // MUCH LESS-THAN
    "\u226B":">>", // MUCH GREATER-THAN
    "\u2295":"(+)", // CIRCLED PLUS
    "\u2296":"(-)", // CIRCLED MINUS
    "\u2297":"(x)", // CIRCLED TIMES
    "\u2298":"(/)", // CIRCLED DIVISION SLASH
    "\u22A2":"|-", // RIGHT TACK
    "\u22A3":"-|", // LEFT TACK
    "\u22A6":"|-", // ASSERTION
    "\u22A7":"|=", // MODELS
    "\u22A8":"|=", // TRUE
    "\u22A9":"||-", // FORCES
    "\u22D5":"$\\#$", // EQUAL AND PARALLEL TO
    "\u22D8":"<<<", // VERY MUCH LESS-THAN
    "\u22D9":">>>", // VERY MUCH GREATER-THAN
    "\u22EF":"...", // MIDLINE HORIZONTAL ELLIPSIS
    "\u2329":"{\\textlangle}", // LEFT-POINTING ANGLE BRACKET
    "\u232A":"{\\textrangle}", // RIGHT-POINTING ANGLE BRACKET
    "\u2423":"{\\textvisiblespace}", // OPEN BOX
    "\u2425":"///", // SYMBOL FOR DELETE FORM TWO
    "\u25E6":"{\\textopenbullet}", // WHITE BULLET
    "\u2639":":-(", // WHITE FROWNING FACE
    "\u263A":":-)", // WHITE SMILING FACE
    "\u263B":"(-:", // BLACK SMILING FACE
    "\u266F":"$\\#$", // MUSIC SHARP SIGN
    "\u2701":"$\\%<$", // UPPER BLADE SCISSORS
    "\u2702":"$\\%<$", // BLACK SCISSORS
    "\u2703":"$\\%<$", // LOWER BLADE SCISSORS
    "\u2704":"$\\%<$", // WHITE SCISSORS
/* Derived accented characters */
    "\u00C0":"\\`{A}", // LATIN CAPITAL LETTER A WITH GRAVE
    "\u00C1":"\\''{A}", // LATIN CAPITAL LETTER A WITH ACUTE
    "\u00C2":"\\^{A}", // LATIN CAPITAL LETTER A WITH CIRCUMFLEX
    "\u00C3":"\\~{A}", // LATIN CAPITAL LETTER A WITH TILDE
    "\u00C4":"\\\"{A}", // LATIN CAPITAL LETTER A WITH DIAERESIS
    "\u00C7":"\\c{C}", // LATIN CAPITAL LETTER C WITH CEDILLA
    "\u00C8":"\\`{E}", // LATIN CAPITAL LETTER E WITH GRAVE
    "\u00C9":"\\''{E}", // LATIN CAPITAL LETTER E WITH ACUTE
    "\u00CA":"\\^{E}", // LATIN CAPITAL LETTER E WITH CIRCUMFLEX
    "\u00CB":"\\\"{E}", // LATIN CAPITAL LETTER E WITH DIAERESIS
    "\u00CC":"\\`{I}", // LATIN CAPITAL LETTER I WITH GRAVE
    "\u00CD":"\\''{I}", // LATIN CAPITAL LETTER I WITH ACUTE
    "\u00CE":"\\^{I}", // LATIN CAPITAL LETTER I WITH CIRCUMFLEX
    "\u00CF":"\\\"{I}", // LATIN CAPITAL LETTER I WITH DIAERESIS
    "\u00D1":"\\~{N}", // LATIN CAPITAL LETTER N WITH TILDE
    "\u00D2":"\\`{O}", // LATIN CAPITAL LETTER O WITH GRAVE
    "\u00D3":"\\''{O}", // LATIN CAPITAL LETTER O WITH ACUTE
    "\u00D4":"\\^{O}", // LATIN CAPITAL LETTER O WITH CIRCUMFLEX
    "\u00D5":"\\~{O}", // LATIN CAPITAL LETTER O WITH TILDE
    "\u00D6":"\\\"{O}", // LATIN CAPITAL LETTER O WITH DIAERESIS
    "\u00D9":"\\`{U}", // LATIN CAPITAL LETTER U WITH GRAVE
    "\u00DA":"\\''{U}", // LATIN CAPITAL LETTER U WITH ACUTE
    "\u00DB":"\\^{U}", // LATIN CAPITAL LETTER U WITH CIRCUMFLEX
    "\u00DC":"\\\"{U}", // LATIN CAPITAL LETTER U WITH DIAERESIS
    "\u00DD":"\\''{Y}", // LATIN CAPITAL LETTER Y WITH ACUTE
    "\u00E0":"\\`{a}", // LATIN SMALL LETTER A WITH GRAVE
    "\u00E1":"\\''{a}", // LATIN SMALL LETTER A WITH ACUTE
    "\u00E2":"\\^{a}", // LATIN SMALL LETTER A WITH CIRCUMFLEX
    "\u00E3":"\\~{a}", // LATIN SMALL LETTER A WITH TILDE
    "\u00E4":"\\\"{a}", // LATIN SMALL LETTER A WITH DIAERESIS
    "\u00E7":"\\c{c}", // LATIN SMALL LETTER C WITH CEDILLA
    "\u00E8":"\\`{e}", // LATIN SMALL LETTER E WITH GRAVE
    "\u00E9":"\\''{e}", // LATIN SMALL LETTER E WITH ACUTE
    "\u00EA":"\\^{e}", // LATIN SMALL LETTER E WITH CIRCUMFLEX
    "\u00EB":"\\\"{e}", // LATIN SMALL LETTER E WITH DIAERESIS
    "\u00EC":"\\`{i}", // LATIN SMALL LETTER I WITH GRAVE
    "\u00ED":"\\''{i}", // LATIN SMALL LETTER I WITH ACUTE
    "\u00EE":"\\^{i}", // LATIN SMALL LETTER I WITH CIRCUMFLEX
    "\u00EF":"\\\"{i}", // LATIN SMALL LETTER I WITH DIAERESIS
    "\u00F1":"\\~{n}", // LATIN SMALL LETTER N WITH TILDE
    "\u00F2":"\\`{o}", // LATIN SMALL LETTER O WITH GRAVE
    "\u00F3":"\\''{o}", // LATIN SMALL LETTER O WITH ACUTE
    "\u00F4":"\\^{o}", // LATIN SMALL LETTER O WITH CIRCUMFLEX
    "\u00F5":"\\~{o}", // LATIN SMALL LETTER O WITH TILDE
    "\u00F6":"\\\"{o}", // LATIN SMALL LETTER O WITH DIAERESIS
    "\u00F9":"\\`{u}", // LATIN SMALL LETTER U WITH GRAVE
    "\u00FA":"\\''{u}", // LATIN SMALL LETTER U WITH ACUTE
    "\u00FB":"\\^{u}", // LATIN SMALL LETTER U WITH CIRCUMFLEX
    "\u00FC":"\\\"{u}", // LATIN SMALL LETTER U WITH DIAERESIS
    "\u00FD":"\\''{y}", // LATIN SMALL LETTER Y WITH ACUTE
    "\u00FF":"\\\"{y}", // LATIN SMALL LETTER Y WITH DIAERESIS
    "\u0100":"\\={A}", // LATIN CAPITAL LETTER A WITH MACRON
    "\u0101":"\\={a}", // LATIN SMALL LETTER A WITH MACRON
    "\u0102":"\\u{A}", // LATIN CAPITAL LETTER A WITH BREVE
    "\u0103":"\\u{a}", // LATIN SMALL LETTER A WITH BREVE
    "\u0104":"\\k{A}", // LATIN CAPITAL LETTER A WITH OGONEK
    "\u0105":"\\k{a}", // LATIN SMALL LETTER A WITH OGONEK
    "\u0106":"\\''{C}", // LATIN CAPITAL LETTER C WITH ACUTE
    "\u0107":"\\''{c}", // LATIN SMALL LETTER C WITH ACUTE
    "\u0108":"\\^{C}", // LATIN CAPITAL LETTER C WITH CIRCUMFLEX
    "\u0109":"\\^{c}", // LATIN SMALL LETTER C WITH CIRCUMFLEX
    "\u010A":"\\.{C}", // LATIN CAPITAL LETTER C WITH DOT ABOVE
    "\u010B":"\\.{c}", // LATIN SMALL LETTER C WITH DOT ABOVE
    "\u010C":"\\v{C}", // LATIN CAPITAL LETTER C WITH CARON
    "\u010D":"\\v{c}", // LATIN SMALL LETTER C WITH CARON
    "\u010E":"\\v{D}", // LATIN CAPITAL LETTER D WITH CARON
    "\u010F":"\\v{d}", // LATIN SMALL LETTER D WITH CARON
    "\u0112":"\\={E}", // LATIN CAPITAL LETTER E WITH MACRON
    "\u0113":"\\={e}", // LATIN SMALL LETTER E WITH MACRON
    "\u0114":"\\u{E}", // LATIN CAPITAL LETTER E WITH BREVE
    "\u0115":"\\u{e}", // LATIN SMALL LETTER E WITH BREVE
    "\u0116":"\\.{E}", // LATIN CAPITAL LETTER E WITH DOT ABOVE
    "\u0117":"\\.{e}", // LATIN SMALL LETTER E WITH DOT ABOVE
    "\u0118":"\\k{E}", // LATIN CAPITAL LETTER E WITH OGONEK
    "\u0119":"\\k{e}", // LATIN SMALL LETTER E WITH OGONEK
    "\u011A":"\\v{E}", // LATIN CAPITAL LETTER E WITH CARON
    "\u011B":"\\v{e}", // LATIN SMALL LETTER E WITH CARON
    "\u011C":"\\^{G}", // LATIN CAPITAL LETTER G WITH CIRCUMFLEX
    "\u011D":"\\^{g}", // LATIN SMALL LETTER G WITH CIRCUMFLEX
    "\u011E":"\\u{G}", // LATIN CAPITAL LETTER G WITH BREVE
    "\u011F":"\\u{g}", // LATIN SMALL LETTER G WITH BREVE
    "\u0120":"\\.{G}", // LATIN CAPITAL LETTER G WITH DOT ABOVE
    "\u0121":"\\.{g}", // LATIN SMALL LETTER G WITH DOT ABOVE
    "\u0122":"\\c{G}", // LATIN CAPITAL LETTER G WITH CEDILLA
    "\u0123":"\\c{g}", // LATIN SMALL LETTER G WITH CEDILLA
    "\u0124":"\\^{H}", // LATIN CAPITAL LETTER H WITH CIRCUMFLEX
    "\u0125":"\\^{h}", // LATIN SMALL LETTER H WITH CIRCUMFLEX
    "\u0128":"\\~{I}", // LATIN CAPITAL LETTER I WITH TILDE
    "\u0129":"\\~{i}", // LATIN SMALL LETTER I WITH TILDE
    "\u012A":"\\={I}", // LATIN CAPITAL LETTER I WITH MACRON
    "\u012B":"\\={i}", // LATIN SMALL LETTER I WITH MACRON
    "\u012C":"\\u{I}", // LATIN CAPITAL LETTER I WITH BREVE
    "\u012D":"\\u{i}", // LATIN SMALL LETTER I WITH BREVE
    "\u012E":"\\k{I}", // LATIN CAPITAL LETTER I WITH OGONEK
    "\u012F":"\\k{i}", // LATIN SMALL LETTER I WITH OGONEK
    "\u0130":"\\.{I}", // LATIN CAPITAL LETTER I WITH DOT ABOVE
    "\u0134":"\\^{J}", // LATIN CAPITAL LETTER J WITH CIRCUMFLEX
    "\u0135":"\\^{j}", // LATIN SMALL LETTER J WITH CIRCUMFLEX
    "\u0136":"\\c{K}", // LATIN CAPITAL LETTER K WITH CEDILLA
    "\u0137":"\\c{k}", // LATIN SMALL LETTER K WITH CEDILLA
    "\u0139":"\\''{L}", // LATIN CAPITAL LETTER L WITH ACUTE
    "\u013A":"\\''{l}", // LATIN SMALL LETTER L WITH ACUTE
    "\u013B":"\\c{L}", // LATIN CAPITAL LETTER L WITH CEDILLA
    "\u013C":"\\c{l}", // LATIN SMALL LETTER L WITH CEDILLA
    "\u013D":"\\v{L}", // LATIN CAPITAL LETTER L WITH CARON
    "\u013E":"\\v{l}", // LATIN SMALL LETTER L WITH CARON
    "\u0143":"\\''{N}", // LATIN CAPITAL LETTER N WITH ACUTE
    "\u0144":"\\''{n}", // LATIN SMALL LETTER N WITH ACUTE
    "\u0145":"\\c{N}", // LATIN CAPITAL LETTER N WITH CEDILLA
    "\u0146":"\\c{n}", // LATIN SMALL LETTER N WITH CEDILLA
    "\u0147":"\\v{N}", // LATIN CAPITAL LETTER N WITH CARON
    "\u0148":"\\v{n}", // LATIN SMALL LETTER N WITH CARON
    "\u014C":"\\={O}", // LATIN CAPITAL LETTER O WITH MACRON
    "\u014D":"\\={o}", // LATIN SMALL LETTER O WITH MACRON
    "\u014E":"\\u{O}", // LATIN CAPITAL LETTER O WITH BREVE
    "\u014F":"\\u{o}", // LATIN SMALL LETTER O WITH BREVE
    "\u0150":"\\H{O}", // LATIN CAPITAL LETTER O WITH DOUBLE ACUTE
    "\u0151":"\\H{o}", // LATIN SMALL LETTER O WITH DOUBLE ACUTE
    "\u0154":"\\''{R}", // LATIN CAPITAL LETTER R WITH ACUTE
    "\u0155":"\\''{r}", // LATIN SMALL LETTER R WITH ACUTE
    "\u0156":"\\c{R}", // LATIN CAPITAL LETTER R WITH CEDILLA
    "\u0157":"\\c{r}", // LATIN SMALL LETTER R WITH CEDILLA
    "\u0158":"\\v{R}", // LATIN CAPITAL LETTER R WITH CARON
    "\u0159":"\\v{r}", // LATIN SMALL LETTER R WITH CARON
    "\u015A":"\\''{S}", // LATIN CAPITAL LETTER S WITH ACUTE
    "\u015B":"\\''{s}", // LATIN SMALL LETTER S WITH ACUTE
    "\u015C":"\\^{S}", // LATIN CAPITAL LETTER S WITH CIRCUMFLEX
    "\u015D":"\\^{s}", // LATIN SMALL LETTER S WITH CIRCUMFLEX
    "\u015E":"\\c{S}", // LATIN CAPITAL LETTER S WITH CEDILLA
    "\u015F":"\\c{s}", // LATIN SMALL LETTER S WITH CEDILLA
    "\u0160":"\\v{S}", // LATIN CAPITAL LETTER S WITH CARON
    "\u0161":"\\v{s}", // LATIN SMALL LETTER S WITH CARON
    "\u0162":"\\c{T}", // LATIN CAPITAL LETTER T WITH CEDILLA
    "\u0163":"\\c{t}", // LATIN SMALL LETTER T WITH CEDILLA
    "\u0164":"\\v{T}", // LATIN CAPITAL LETTER T WITH CARON
    "\u0165":"\\v{t}", // LATIN SMALL LETTER T WITH CARON
    "\u0168":"\\~{U}", // LATIN CAPITAL LETTER U WITH TILDE
    "\u0169":"\\~{u}", // LATIN SMALL LETTER U WITH TILDE
    "\u016A":"\\={U}", // LATIN CAPITAL LETTER U WITH MACRON
    "\u016B":"\\={u}", // LATIN SMALL LETTER U WITH MACRON
    "\u016C":"\\u{U}", // LATIN CAPITAL LETTER U WITH BREVE
    "\u016D":"\\u{u}", // LATIN SMALL LETTER U WITH BREVE
    "\u0170":"\\H{U}", // LATIN CAPITAL LETTER U WITH DOUBLE ACUTE
    "\u0171":"\\H{u}", // LATIN SMALL LETTER U WITH DOUBLE ACUTE
    "\u0172":"\\k{U}", // LATIN CAPITAL LETTER U WITH OGONEK
    "\u0173":"\\k{u}", // LATIN SMALL LETTER U WITH OGONEK
    "\u0174":"\\^{W}", // LATIN CAPITAL LETTER W WITH CIRCUMFLEX
    "\u0175":"\\^{w}", // LATIN SMALL LETTER W WITH CIRCUMFLEX
    "\u0176":"\\^{Y}", // LATIN CAPITAL LETTER Y WITH CIRCUMFLEX
    "\u0177":"\\^{y}", // LATIN SMALL LETTER Y WITH CIRCUMFLEX
    "\u0178":"\\\"{Y}", // LATIN CAPITAL LETTER Y WITH DIAERESIS
    "\u0179":"\\''{Z}", // LATIN CAPITAL LETTER Z WITH ACUTE
    "\u017A":"\\''{z}", // LATIN SMALL LETTER Z WITH ACUTE
    "\u017B":"\\.{Z}", // LATIN CAPITAL LETTER Z WITH DOT ABOVE
    "\u017C":"\\.{z}", // LATIN SMALL LETTER Z WITH DOT ABOVE
    "\u017D":"\\v{Z}", // LATIN CAPITAL LETTER Z WITH CARON
    "\u017E":"\\v{z}", // LATIN SMALL LETTER Z WITH CARON
    "\u01CD":"\\v{A}", // LATIN CAPITAL LETTER A WITH CARON
    "\u01CE":"\\v{a}", // LATIN SMALL LETTER A WITH CARON
    "\u01CF":"\\v{I}", // LATIN CAPITAL LETTER I WITH CARON
    "\u01D0":"\\v{i}", // LATIN SMALL LETTER I WITH CARON
    "\u01D1":"\\v{O}", // LATIN CAPITAL LETTER O WITH CARON
    "\u01D2":"\\v{o}", // LATIN SMALL LETTER O WITH CARON
    "\u01D3":"\\v{U}", // LATIN CAPITAL LETTER U WITH CARON
    "\u01D4":"\\v{u}", // LATIN SMALL LETTER U WITH CARON
    "\u01E6":"\\v{G}", // LATIN CAPITAL LETTER G WITH CARON
    "\u01E7":"\\v{g}", // LATIN SMALL LETTER G WITH CARON
    "\u01E8":"\\v{K}", // LATIN CAPITAL LETTER K WITH CARON
    "\u01E9":"\\v{k}", // LATIN SMALL LETTER K WITH CARON
    "\u01EA":"\\k{O}", // LATIN CAPITAL LETTER O WITH OGONEK
    "\u01EB":"\\k{o}", // LATIN SMALL LETTER O WITH OGONEK
    "\u01F0":"\\v{j}", // LATIN SMALL LETTER J WITH CARON
    "\u01F4":"\\''{G}", // LATIN CAPITAL LETTER G WITH ACUTE
    "\u01F5":"\\''{g}", // LATIN SMALL LETTER G WITH ACUTE
    "\u1E02":"\\.{B}", // LATIN CAPITAL LETTER B WITH DOT ABOVE
    "\u1E03":"\\.{b}", // LATIN SMALL LETTER B WITH DOT ABOVE
    "\u1E04":"\\d{B}", // LATIN CAPITAL LETTER B WITH DOT BELOW
    "\u1E05":"\\d{b}", // LATIN SMALL LETTER B WITH DOT BELOW
    "\u1E06":"\\b{B}", // LATIN CAPITAL LETTER B WITH LINE BELOW
    "\u1E07":"\\b{b}", // LATIN SMALL LETTER B WITH LINE BELOW
    "\u1E0A":"\\.{D}", // LATIN CAPITAL LETTER D WITH DOT ABOVE
    "\u1E0B":"\\.{d}", // LATIN SMALL LETTER D WITH DOT ABOVE
    "\u1E0C":"\\d{D}", // LATIN CAPITAL LETTER D WITH DOT BELOW
    "\u1E0D":"\\d{d}", // LATIN SMALL LETTER D WITH DOT BELOW
    "\u1E0E":"\\b{D}", // LATIN CAPITAL LETTER D WITH LINE BELOW
    "\u1E0F":"\\b{d}", // LATIN SMALL LETTER D WITH LINE BELOW
    "\u1E10":"\\c{D}", // LATIN CAPITAL LETTER D WITH CEDILLA
    "\u1E11":"\\c{d}", // LATIN SMALL LETTER D WITH CEDILLA
    "\u1E1E":"\\.{F}", // LATIN CAPITAL LETTER F WITH DOT ABOVE
    "\u1E1F":"\\.{f}", // LATIN SMALL LETTER F WITH DOT ABOVE
    "\u1E20":"\\={G}", // LATIN CAPITAL LETTER G WITH MACRON
    "\u1E21":"\\={g}", // LATIN SMALL LETTER G WITH MACRON
    "\u1E22":"\\.{H}", // LATIN CAPITAL LETTER H WITH DOT ABOVE
    "\u1E23":"\\.{h}", // LATIN SMALL LETTER H WITH DOT ABOVE
    "\u1E24":"\\d{H}", // LATIN CAPITAL LETTER H WITH DOT BELOW
    "\u1E25":"\\d{h}", // LATIN SMALL LETTER H WITH DOT BELOW
    "\u1E26":"\\\"{H}", // LATIN CAPITAL LETTER H WITH DIAERESIS
    "\u1E27":"\\\"{h}", // LATIN SMALL LETTER H WITH DIAERESIS
    "\u1E28":"\\c{H}", // LATIN CAPITAL LETTER H WITH CEDILLA
    "\u1E29":"\\c{h}", // LATIN SMALL LETTER H WITH CEDILLA
    "\u1E30":"\\''{K}", // LATIN CAPITAL LETTER K WITH ACUTE
    "\u1E31":"\\''{k}", // LATIN SMALL LETTER K WITH ACUTE
    "\u1E32":"\\d{K}", // LATIN CAPITAL LETTER K WITH DOT BELOW
    "\u1E33":"\\d{k}", // LATIN SMALL LETTER K WITH DOT BELOW
    "\u1E34":"\\b{K}", // LATIN CAPITAL LETTER K WITH LINE BELOW
    "\u1E35":"\\b{k}", // LATIN SMALL LETTER K WITH LINE BELOW
    "\u1E36":"\\d{L}", // LATIN CAPITAL LETTER L WITH DOT BELOW
    "\u1E37":"\\d{l}", // LATIN SMALL LETTER L WITH DOT BELOW
    "\u1E3A":"\\b{L}", // LATIN CAPITAL LETTER L WITH LINE BELOW
    "\u1E3B":"\\b{l}", // LATIN SMALL LETTER L WITH LINE BELOW
    "\u1E3E":"\\''{M}", // LATIN CAPITAL LETTER M WITH ACUTE
    "\u1E3F":"\\''{m}", // LATIN SMALL LETTER M WITH ACUTE
    "\u1E40":"\\.{M}", // LATIN CAPITAL LETTER M WITH DOT ABOVE
    "\u1E41":"\\.{m}", // LATIN SMALL LETTER M WITH DOT ABOVE
    "\u1E42":"\\d{M}", // LATIN CAPITAL LETTER M WITH DOT BELOW
    "\u1E43":"\\d{m}", // LATIN SMALL LETTER M WITH DOT BELOW
    "\u1E44":"\\.{N}", // LATIN CAPITAL LETTER N WITH DOT ABOVE
    "\u1E45":"\\.{n}", // LATIN SMALL LETTER N WITH DOT ABOVE
    "\u1E46":"\\d{N}", // LATIN CAPITAL LETTER N WITH DOT BELOW
    "\u1E47":"\\d{n}", // LATIN SMALL LETTER N WITH DOT BELOW
    "\u1E48":"\\b{N}", // LATIN CAPITAL LETTER N WITH LINE BELOW
    "\u1E49":"\\b{n}", // LATIN SMALL LETTER N WITH LINE BELOW
    "\u1E54":"\\''{P}", // LATIN CAPITAL LETTER P WITH ACUTE
    "\u1E55":"\\''{p}", // LATIN SMALL LETTER P WITH ACUTE
    "\u1E56":"\\.{P}", // LATIN CAPITAL LETTER P WITH DOT ABOVE
    "\u1E57":"\\.{p}", // LATIN SMALL LETTER P WITH DOT ABOVE
    "\u1E58":"\\.{R}", // LATIN CAPITAL LETTER R WITH DOT ABOVE
    "\u1E59":"\\.{r}", // LATIN SMALL LETTER R WITH DOT ABOVE
    "\u1E5A":"\\d{R}", // LATIN CAPITAL LETTER R WITH DOT BELOW
    "\u1E5B":"\\d{r}", // LATIN SMALL LETTER R WITH DOT BELOW
    "\u1E5E":"\\b{R}", // LATIN CAPITAL LETTER R WITH LINE BELOW
    "\u1E5F":"\\b{r}", // LATIN SMALL LETTER R WITH LINE BELOW
    "\u1E60":"\\.{S}", // LATIN CAPITAL LETTER S WITH DOT ABOVE
    "\u1E61":"\\.{s}", // LATIN SMALL LETTER S WITH DOT ABOVE
    "\u1E62":"\\d{S}", // LATIN CAPITAL LETTER S WITH DOT BELOW
    "\u1E63":"\\d{s}", // LATIN SMALL LETTER S WITH DOT BELOW
    "\u1E6A":"\\.{T}", // LATIN CAPITAL LETTER T WITH DOT ABOVE
    "\u1E6B":"\\.{t}", // LATIN SMALL LETTER T WITH DOT ABOVE
    "\u1E6C":"\\d{T}", // LATIN CAPITAL LETTER T WITH DOT BELOW
    "\u1E6D":"\\d{t}", // LATIN SMALL LETTER T WITH DOT BELOW
    "\u1E6E":"\\b{T}", // LATIN CAPITAL LETTER T WITH LINE BELOW
    "\u1E6F":"\\b{t}", // LATIN SMALL LETTER T WITH LINE BELOW
    "\u1E7C":"\\~{V}", // LATIN CAPITAL LETTER V WITH TILDE
    "\u1E7D":"\\~{v}", // LATIN SMALL LETTER V WITH TILDE
    "\u1E7E":"\\d{V}", // LATIN CAPITAL LETTER V WITH DOT BELOW
    "\u1E7F":"\\d{v}", // LATIN SMALL LETTER V WITH DOT BELOW
    "\u1E80":"\\`{W}", // LATIN CAPITAL LETTER W WITH GRAVE
    "\u1E81":"\\`{w}", // LATIN SMALL LETTER W WITH GRAVE
    "\u1E82":"\\''{W}", // LATIN CAPITAL LETTER W WITH ACUTE
    "\u1E83":"\\''{w}", // LATIN SMALL LETTER W WITH ACUTE
    "\u1E84":"\\\"{W}", // LATIN CAPITAL LETTER W WITH DIAERESIS
    "\u1E85":"\\\"{w}", // LATIN SMALL LETTER W WITH DIAERESIS
    "\u1E86":"\\.{W}", // LATIN CAPITAL LETTER W WITH DOT ABOVE
    "\u1E87":"\\.{w}", // LATIN SMALL LETTER W WITH DOT ABOVE
    "\u1E88":"\\d{W}", // LATIN CAPITAL LETTER W WITH DOT BELOW
    "\u1E89":"\\d{w}", // LATIN SMALL LETTER W WITH DOT BELOW
    "\u1E8A":"\\.{X}", // LATIN CAPITAL LETTER X WITH DOT ABOVE
    "\u1E8B":"\\.{x}", // LATIN SMALL LETTER X WITH DOT ABOVE
    "\u1E8C":"\\\"{X}", // LATIN CAPITAL LETTER X WITH DIAERESIS
    "\u1E8D":"\\\"{x}", // LATIN SMALL LETTER X WITH DIAERESIS
    "\u1E8E":"\\.{Y}", // LATIN CAPITAL LETTER Y WITH DOT ABOVE
    "\u1E8F":"\\.{y}", // LATIN SMALL LETTER Y WITH DOT ABOVE
    "\u1E90":"\\^{Z}", // LATIN CAPITAL LETTER Z WITH CIRCUMFLEX
    "\u1E91":"\\^{z}", // LATIN SMALL LETTER Z WITH CIRCUMFLEX
    "\u1E92":"\\d{Z}", // LATIN CAPITAL LETTER Z WITH DOT BELOW
    "\u1E93":"\\d{z}", // LATIN SMALL LETTER Z WITH DOT BELOW
    "\u1E94":"\\b{Z}", // LATIN CAPITAL LETTER Z WITH LINE BELOW
    "\u1E95":"\\b{z}", // LATIN SMALL LETTER Z WITH LINE BELOW
    "\u1E96":"\\b{h}", // LATIN SMALL LETTER H WITH LINE BELOW
    "\u1E97":"\\\"{t}", // LATIN SMALL LETTER T WITH DIAERESIS
    "\u1EA0":"\\d{A}", // LATIN CAPITAL LETTER A WITH DOT BELOW
    "\u1EA1":"\\d{a}", // LATIN SMALL LETTER A WITH DOT BELOW
    "\u1EB8":"\\d{E}", // LATIN CAPITAL LETTER E WITH DOT BELOW
    "\u1EB9":"\\d{e}", // LATIN SMALL LETTER E WITH DOT BELOW
    "\u1EBC":"\\~{E}", // LATIN CAPITAL LETTER E WITH TILDE
    "\u1EBD":"\\~{e}", // LATIN SMALL LETTER E WITH TILDE
    "\u1ECA":"\\d{I}", // LATIN CAPITAL LETTER I WITH DOT BELOW
    "\u1ECB":"\\d{i}", // LATIN SMALL LETTER I WITH DOT BELOW
    "\u1ECC":"\\d{O}", // LATIN CAPITAL LETTER O WITH DOT BELOW
    "\u1ECD":"\\d{o}", // LATIN SMALL LETTER O WITH DOT BELOW
    "\u1EE4":"\\d{U}", // LATIN CAPITAL LETTER U WITH DOT BELOW
    "\u1EE5":"\\d{u}", // LATIN SMALL LETTER U WITH DOT BELOW
    "\u1EF2":"\\`{Y}", // LATIN CAPITAL LETTER Y WITH GRAVE
    "\u1EF3":"\\`{y}", // LATIN SMALL LETTER Y WITH GRAVE
    "\u1EF4":"\\d{Y}", // LATIN CAPITAL LETTER Y WITH DOT BELOW
    "\u1EF5":"\\d{y}", // LATIN SMALL LETTER Y WITH DOT BELOW
    "\u1EF8":"\\~{Y}", // LATIN CAPITAL LETTER Y WITH TILDE
    "\u1EF9":"\\~{y}", // LATIN SMALL LETTER Y WITH TILDE
	
};

var alwaysMap = {
	"|":"{\\textbar}",
	"<":"{\\textless}",
	">":"{\\textgreater}",
	"~":"{\\textasciitilde}",
	"^":"{\\textasciicircum}",
	"\\":"{\\textbackslash}"
};

var strings = new Object();
var keyRe = /[a-zA-Z0-9\-]/;

function processField(item, field, value) {
	if(fieldMap[field]) {
		item[fieldMap[field]] = value;
	} else if(inputFieldMap[field]) {
		item[inputFieldMap[field]] = value;
	} else if(field == "journal") {
		if(item.publicationTitle) {
			// we already had an fjournal
			item.journalAbbreviation = value
		} else {
			item.publicationTitle = value;
		}
	} else if(field == "fjournal") {
		if(item.publicationTitle) {
			// move publicationTitle to abbreviation
			item.journalAbbreviation = value;
		}
		item.publicationTitle = value;
	} else if(field == "author" || field == "editor") {
		// parse authors/editors
		var names = value.split(" and ");
		for each(var name in names) {
			item.creators.push(Zotero.Utilities.cleanAuthor(name, field,
			                                  (name.indexOf(",") != -1)));
		}
	} else if(field == "institution" || field == "organization") {
		item.backupPublisher = value;
	} else if(field == "number"){ // fix for techreport
		if (item.itemType == "report") {
			item.reportNumber = value;
		} else {
			item.issue = value;
		}
	} else if(field == "month") {
		var monthIndex = months.indexOf(value.toLowerCase());
		if(monthIndex != -1) {
			value = Zotero.Utilities.formatDate({month:monthIndex});
		} else {
			value += " ";
		}
		
		if(item.date) {
			if(value.indexOf(item.date) != -1) {
				// value contains year and more
				item.date = value;
			} else {
				item.date = value+item.date;
			}
		} else {
			item.date = value;
		}
	} else if(field == "year") {
		if(item.date) {
			if(item.date.indexOf(value) == -1) {
				// date does not already contain year
				item.date += value;
			}
		} else {
			item.date = value;
		}
	} else if(field == "pages") {
		item.pages = value.replace(/--/g, "-");
	} else if(field == "note" || field == "annote") {
		item.extra += "\n"+value;
	} else if(field == "howpublished") {
		if(value.length >= 7) {
			var str = value.substr(0, 7);
			if(str == "http://" || str == "https:/" || str == "mailto:") {
				item.url = value;
			} else {
				item.extra += "\nPublished: "+value;
			}
		}
	} else if(field == "keywords") {
		if(value.indexOf(",") == -1) {
			// keywords/tags
			item.tags = value.split(" ");
		} else {
			item.tags = value.split(/, ?/g);
		}
	}
}

function getFieldValue(read) {
	var value = "";
	// now, we have the first character of the field
	if(read == "{") {
		// character is a brace
		var openBraces = 1;
		while(read = Zotero.read(1)) {
			if(read == "{" && value[value.length-1] != "\\") {
				openBraces++;
				value += "{";
			} else if(read == "}" && value[value.length-1] != "\\") {
				openBraces--;
				if(openBraces == 0) {
					break;
				} else {
					value += "}";
				}
			} else {
				value += read;
			}
		}
	} else if(read == ''"'') {
		var openBraces = 0;
		while(read = Zotero.read(1)) {
			if(read == "{" && value[value.length-1] != "\\") {
				openBraces++;
				value += "{";
			} else if(read == "}" && value[value.length-1] != "\\") {
				openBraces--;
				value += "}";
			} else if(read == ''"'' && openBraces == 0) {
				break;
			} else {
				value += read;
			}
		}
	}
	
	if(value.length > 1) {
		// replace accented characters (yucky slow)
		value = value.replace(/{(\\[`"''^~=a-z])([A-Za-z])}/g, "$1{$2}");
		for (var i in reversemappingTable) { // really really slow!
			var mapped = reversemappingTable[i];
			if (value.indexOf(mapped) != -1) {
				Zotero.debug("Replace " + mapped + " in " + value + " with " + i);
				value = value.replace(mapped, i, "g");
			}
			mapped = mapped.replace(/[{}]/, "");
			if (value.indexOf(mapped) != -1) {
				Zotero.debug("Replace(2) " + mapped + " in " + value + " with " + i);
				value = value.replace(mapped, i, "g");
			}
		}
		
		// kill braces
		value = value.replace(/([^\\])[{}]+/g, "$1");
		if(value[0] == "{") {
			value = value.substr(1);
		}
		
		// chop off backslashes
		value = value.replace(/([^\\])\\([#$%&~_^\\{}])/g, "$1$2");
		value = value.replace(/([^\\])\\([#$%&~_^\\{}])/g, "$1$2");
		if(value[0] == "\\" && "#$%&~_^\\{}".indexOf(value[1]) != -1) {
			value = value.substr(1);
		}
		if(value[value.length-1] == "\\" &&  "#$%&~_^\\{}".indexOf(value[value.length-2]) != -1) {
			value = value.substr(0, value.length-1);
		}
		value = value.replace(/\\\\/g, "\\");
		value = value.replace(/\s+/g, " ");
	}
	
	return value;
}

function beginRecord(type, closeChar) {
	type = Zotero.Utilities.cleanString(type.toLowerCase());
	if(type != "string") {
		zoteroType = bibtex2zoteroTypeMap[type];
		if (!zoteroType) {
			Zotero.debug("discarded item from BibTeX; type was "+type);
		}
		var item = new Zotero.Item(zoteroType);
		
		item.extra = "";
	}
	
	var field = "";
	
	// by setting dontRead to true, we can skip a read on the next iteration
	// of this loop. this is useful after we read past the end of a string.
	var dontRead = false;
	
	while(dontRead || (read = Zotero.read(1))) {
		dontRead = false;
		
		if(read == "=") {								// equals begin a field
		// read whitespace
			var read = Zotero.read(1);
			while(" \n\r\t".indexOf(read) != -1) {
				read = Zotero.read(1);
			}
			
			if(keyRe.test(read)) {
				// read numeric data here, since we might get an end bracket
				// that we should care about
				value = "";
				value += read;
				
				// character is a number
				while((read = Zotero.read(1)) && keyRe.test(read)) {
					value += read;
				}
				
				// don''t read the next char; instead, process the character
				// we already read past the end of the string
				dontRead = true;
				
				// see if there''s a defined string
				if(strings[value]) value = strings[value];
			} else {
				var value = getFieldValue(read);
			}
			
			if(item) {
				processField(item, field.toLowerCase(), value);
			} else if(type == "string") {
				strings[field] = value;
			}
			field = "";
		} else if(read == ",") {						// commas reset
			field = "";
		} else if(read == closeChar) {
			if(item) {
				if(item.extra) item.extra = item.extra.substr(1); // chop \n
				item.complete();
			}
			return;
		} else if(" \n\r\t".indexOf(read) == -1) {		// skip whitespace
			field += read;
		}
	}
}

function doImport() {
	var read = "", text = "", recordCloseElement = false;
	var type = false;
	
	Zotero.setCharacterSet("UTF-8");
	
	while(read = Zotero.read(1)) {
		if(read == "@") {
			type = "";
		} else if(type !== false) {
			if(type == "comment") {
				type = false;
			} else if(read == "{") {		// possible open character
				beginRecord(type, "}");
				type = false;
			} else if(read == "(") {		// possible open character
				beginRecord(type, ")");
				type = false;
			} else {
				type += read;
			}
		}
	}
}

// some fields are, in fact, macros.  If that is the case then we should not put the
// data in the braces as it will cause the macros to not expand properly
function writeField(field, value, isMacro) {
	if(!value) return;
	value = value + ""; // convert integers to strings
	Zotero.write(",\n\t"+field+" = ");
	if(!isMacro) Zotero.write("{");
	// I hope these are all the escape characters!
	value = value.replace(/[|\<\>\~\^\\]/g, mapEscape).replace(/([\#\$\%\&\_])/g, "\\$1");
	if (!Zotero.getOption("UTF8")) {
		value = value.replace(/[\u0080-\uFFFF]/g, mapAccent);
	}
	Zotero.write(value);
	if(!isMacro) Zotero.write("}");
}

function mapEscape(character) {
	return alwaysMap[character];
}

function mapAccent(character) {
	return (mappingTable[character] ? mappingTable[character] : "?");
}

var numberRe = /^[0-9]+/;
// this is a list of words that should not appear as part of the citation key
var citeKeyTitleBannedRe = /(\s+|\b)(a|an|from|does|how|it\''s|its|on|some|the|this|why)(\s+|\b)/g;
var citeKeyConversionsRe = /%([a-zA-Z])/;
var citeKeyCleanRe = /[^a-z0-9\!\$\&\*\+\-\.\/\:\;\<\>\?\[\]\^\_\`\|]+/g;

var citeKeyConversions = {
    "a":function (flags, item) {
        if(item.creators && item.creators[0] && item.creators[0].lastName) {
            return item.creators[0].lastName.toLowerCase().replace(/ /g,"_").replace(/,/g,"");
        }
        return "";
    },
    "t":function (flags, item) {
        if (item["title"]) {
            return item["title"].toLowerCase().replace(citeKeyTitleBannedRe, "").split(" ")[0];
        }
        return "";
    },
    "y":function (flags, item) {
        if(item.date) {
            var date = Zotero.Utilities.strToDate(item.date);
            if(date.year && numberRe.test(date.year)) {
                return date.year;
            }
        }
        return "????";
    }
}


function buildCiteKey (item,citekeys) {
    var basekey = "";
    var counter = 0;
    citeKeyFormatRemaining = citeKeyFormat;
    while (citeKeyConversionsRe.test(citeKeyFormatRemaining)) {
        if (counter > 100) {
            Zotero.debug("Pathological BibTeX format: " + citeKeyFormat);
            break;
        }
        var m = citeKeyFormatRemaining.match(citeKeyConversionsRe);
        if (m.index > 0) {
            //add data before the conversion match to basekey
            basekey = basekey + citeKeyFormatRemaining.substr(0, m.index);
        }
        var flags = ""; // for now
        var f = citeKeyConversions[m[1]];
        if (typeof(f) == "function") {
            var value = f(flags, item);
            Zotero.debug("Got value " + value + " for %" + m[1]);
            //add conversion to basekey
            basekey = basekey + value;
        }
        citeKeyFormatRemaining = citeKeyFormatRemaining.substr(m.index + m.length);
        counter++;
    }
    if (citeKeyFormatRemaining.length > 0) {
        basekey = basekey + citeKeyFormatRemaining;
    }

    // for now, remove any characters not explicitly known to be allowed;
    // we might want to allow UTF-8 citation keys in the future, depending
    // on implementation support.
    //
    // no matter what, we want to make sure we exclude
    // " # % '' ( ) , = { } ~ and backslash

    basekey = basekey.replace(citeKeyCleanRe, "");
    var citekey = basekey;
    var i = 0;
    while(citekeys[citekey]) {
        i++;
        citekey = basekey + "-" + i;
    }
    citekeys[citekey] = true;
    return citekey;
}

function doExport() {
	if(Zotero.getOption("UTF8")) {
	    Zotero.setCharacterSet("UTF-8");
	}
	else {
		Zotero.setCharacterSet("us-ascii");
	}
	
	//Zotero.write("% BibTeX export generated by Zotero "+Zotero.Utilities.getVersion());
	
	var first = true;
	var citekeys = new Object();
	var item;
	while(item = Zotero.nextItem()) {
		// determine type
		var type = zotero2bibtexTypeMap[item.itemType];
		if (typeof(type) == "function") { type = type(item); }
		if(!type) type = "misc";
		
		// create a unique citation key
		var citekey = buildCiteKey(item, citekeys);
		
		// write citation key
		Zotero.write((first ? "" : ",\n\n") + "@"+type+"{"+citekey);
		first = false;
		
		for(var field in fieldMap) {
			if(item[fieldMap[field]]) {
				writeField(field, item[fieldMap[field]]);
			}
		}
		
		if(item.proceedingsTitle || item.conferenceName) {
			writeField("booktitle", item.proceedingsTitle || item.conferenceName);
		}

		if(item.publicationTitle) {
			if(item.itemType == "chapter") {
				writeField("booktitle", item.publicationTitle);
			} else {
				writeField("journal", item.publicationTitle);
			}
		}
		
		if(item.publisher) {
			if(item.itemType == "thesis") {
				writeField("school", item.publisher);
			} else {
				writeField("publisher", item.publisher);
			}
		}
		
		if(item.creators && item.creators.length) {
			// split creators into subcategories
			var author = "";
			var editor = "";
			for each(var creator in item.creators) {
				var creatorString = creator.lastName;

				if (creator.firstName) {
					creatorString = creator.firstName + " " + creator.lastName;
				}

				if (creator.creatorType == "editor") {
					editor += " and "+creatorString;
				} else {
					author += " and "+creatorString;
				}
			}
			
			if(author) {
				writeField("author", author.substr(5));
			}
			if(editor) {
				writeField("editor", editor.substr(5));
			}
		}
		
		if(item.date) {
			var date = Zotero.Utilities.strToDate(item.date);
			// need to use non-localized abbreviation
			if(date.month) {
				writeField("month", months[date.month], true);
			}
			if(date.year) {
				writeField("year", date.year);
			}
		}
		
		if(item.extra) {
			writeField("note", item.extra);
		}
		
		if(item.tags && item.tags.length) {
			var tagString = "";
			for each(var tag in item.tags) {
				tagString += ","+tag.tag;
			}
			writeField("keywords", tagString.substr(1));
		}
		
		if(item.pages) {
			writeField("pages", item.pages);
		}
		
		if(item.itemType == "webpage") {
			writeField("howpublished", item.url);
		}
		
		Zotero.write("\n}");
	}
}');


REPLACE INTO translators VALUES ('a6ee60df-1ddc-4aae-bb25-45e0537be973', '1.0.0b3.r1', '', '2008-04-02 17:00:00', '1', '100', '1', 'MARC', 'Simon Kornblith', 'marc', 
'function detectImport() {
	var marcRecordRegexp = /^[0-9]{5}[a-z ]{3}$/
	var read = Zotero.read(8);
	if(marcRecordRegexp.test(read)) {
		return true;
	}
}', 
'var fieldTerminator = "\x1E";
var recordTerminator = "\x1D";
var subfieldDelimiter = "\x1F";

/*
 * CLEANING FUNCTIONS
 */

// general purpose cleaning
function clean(value) {
	value = value.replace(/^[\s\.\,\/\:;]+/, '''');
	value = value.replace(/[\s\.\,\/\:;]+$/, '''');
	value = value.replace(/ +/g, '' '');
	
	var char1 = value[0];
	var char2 = value[value.length-1];
	if((char1 == "[" && char2 == "]") || (char1 == "(" && char2 == ")")) {
		// chop of extraneous characters
		return value.substr(1, value.length-2);
	}
	
	return value;
}

// number extraction
function pullNumber(text) {
	var pullRe = /[0-9]+/;
	var m = pullRe.exec(text);
	if(m) {
		return m[0];
	}
}

// ISBN extraction
function pullISBN(text) {
	var pullRe = /[0-9X\-]+/;
	var m = pullRe.exec(text);
	if(m) {
		return m[0];
	}
}

// corporate author extraction
function corpAuthor(author) {
	return {lastName:author, fieldMode:true};
}

// regular author extraction
function author(author, type, useComma) {
	return Zotero.Utilities.cleanAuthor(author, type, useComma);
}

/*
 * END CLEANING FUNCTIONS
 */

var record = function() {
	this.directory = new Object();
	this.leader = "";
	this.content = "";
	
	// defaults
	this.indicatorLength = 2;
	this.subfieldCodeLength = 2;
}

// import a binary MARC record into this record
record.prototype.importBinary = function(record) {
	// get directory and leader
	var directory = record.substr(0, record.indexOf(fieldTerminator));
	this.leader = directory.substr(0, 24);
	var directory = directory.substr(24);
	
	// get various data
	this.indicatorLength = parseInt(this.leader[10], 10);
	this.subfieldCodeLength = parseInt(this.leader[11], 10);
	var baseAddress = parseInt(this.leader.substr(12, 5), 10);
	
	// get record data
	var contentTmp = record.substr(baseAddress);
	
	// MARC wants one-byte characters, so when we have multi-byte UTF-8
	// sequences, add null characters so that the directory shows up right. we
	// can strip the nulls later.
	this.content = "";
	for(i=0; i<contentTmp.length; i++) {
		this.content += contentTmp[i];
		if(contentTmp.charCodeAt(i) > 0x00FFFF) {
			this.content += "\x00\x00\x00";
		} else if(contentTmp.charCodeAt(i) > 0x0007FF) {
			this.content += "\x00\x00";
		} else if(contentTmp.charCodeAt(i) > 0x00007F) {
			this.content += "\x00";
		}
	}
	
	// read directory
	for(var i=0; i<directory.length; i+=12) {
		var tag = parseInt(directory.substr(i, 3), 10);
		var fieldLength = parseInt(directory.substr(i+3, 4), 10);
		var fieldPosition = parseInt(directory.substr(i+7, 5), 10);
		
		if(!this.directory[tag]) {
			this.directory[tag] = new Array();
		}
		this.directory[tag].push([fieldPosition, fieldLength]);
	}
}

// add a field to this record
record.prototype.addField = function(field, indicator, value) {
	field = parseInt(field, 10);
	// make sure indicator is the right length
	if(indicator.length > this.indicatorLength) {
		indicator = indicator.substr(0, this.indicatorLength);
	} else if(indicator.length != this.indicatorLength) {
		indicator = Zotero.Utilities.lpad(indicator, " ", this.indicatorLength);
	}
	
	// add terminator
	value = indicator+value+fieldTerminator;
	
	// add field to directory
	if(!this.directory[field]) {
		this.directory[field] = new Array();
	}
	this.directory[field].push([this.content.length, value.length]);
	
	// add field to record
	this.content += value;
}

// get all fields with a certain field number
record.prototype.getField = function(field) {
	field = parseInt(field, 10);
	var fields = new Array();
	
	// make sure fields exist
	if(!this.directory[field]) {
		return fields;
	}
	
	// get fields
	for(var i in this.directory[field]) {
		var location = this.directory[field][i];
		
		// add to array, replacing null characters
		fields.push([this.content.substr(location[0], this.indicatorLength),
		             this.content.substr(location[0]+this.indicatorLength,
		               location[1]-this.indicatorLength-1).replace(/\x00/g, "")]);
	}
	
	return fields;
}

// get subfields from a field
record.prototype.getFieldSubfields = function(tag) { // returns a two-dimensional array of values
	var fields = this.getField(tag);
	var returnFields = new Array();
	
	for(var i in fields) {
		returnFields[i] = new Object();
		
		var subfields = fields[i][1].split(subfieldDelimiter);
		if (subfields.length == 1) {
			returnFields[i]["?"] = fields[i][1];
		} else {
			for(var j in subfields) {
				if(subfields[j]) {
					var subfieldIndex = subfields[j].substr(0, this.subfieldCodeLength-1);
					if(!returnFields[i][subfieldIndex]) {
						returnFields[i][subfieldIndex] = subfields[j].substr(this.subfieldCodeLength-1);
					}
				}
			}
		}
	}
	
	return returnFields;
}

// add field to DB
record.prototype._associateDBField = function(item, fieldNo, part, fieldName, execMe, arg1, arg2) {
	var field = this.getFieldSubfields(fieldNo);
	Zotero.debug(''MARC: found ''+field.length+'' matches for ''+fieldNo+part);
	if(field) {
		for(var i in field) {
			var value = false;
			for(var j=0; j<part.length; j++) {
				var myPart = part[j];
				if(field[i][myPart]) {
					if(value) {
						value += " "+field[i][myPart];
					} else {
						value = field[i][myPart];
					}
				}
			}
			if(value) {
				value = clean(value);
				
				if(execMe) {
					value = execMe(value, arg1, arg2);
				}
				
				if(fieldName == "creator") {
					item.creators.push(value);
				} else {
					item[fieldName] = value;
					return;
				}
			}
		}
	}
}

// add field to DB as tags
record.prototype._associateTags = function(item, fieldNo, part) {
	var field = this.getFieldSubfields(fieldNo);
	
	for(var i in field) {
		for(var j=0; j<part.length; j++) {
			var myPart = part[j];
			if(field[i][myPart]) {
				item.tags.push(clean(field[i][myPart]));
			}
		}
	}
}

// this function loads a MARC record into our database
record.prototype.translate = function(item) {
	// get item type
	if(this.leader) {
		var marcType = this.leader[6];
		if(marcType == "g") {
			item.itemType = "film";
		} else if(marcType == "k" || marcType == "e" || marcType == "f") {
			item.itemType = "artwork";
		} else if(marcType == "t") {
			item.itemType = "manuscript";
		} else {
			item.itemType = "book";
		}
	} else {
		item.itemType = "book";
	}
	
	// Extract ISBNs
	this._associateDBField(item, "020", "a", "ISBN", pullISBN);
	// Extract ISSNs
	this._associateDBField(item, "022", "a", "ISSN", pullISBN);
	// Extract creators
	this._associateDBField(item, "100", "a", "creator", author, "author", true);
	this._associateDBField(item, "110", "a", "creator", corpAuthor, "author");
	this._associateDBField(item, "111", "a", "creator", corpAuthor, "author");
	this._associateDBField(item, "700", "a", "creator", author, "contributor", true);
	this._associateDBField(item, "710", "a", "creator", corpAuthor, "contributor");
	this._associateDBField(item, "711", "a", "creator", corpAuthor, "contributor");
	if(item.itemType == "book" && !item.creators.length) {
		// some LOC entries have no listed author, but have the author in the person subject field as the first entry
		var field = this.getFieldSubfields("600");
		if(field[0]) {
			item.creators.push(Zotero.Utilities.cleanAuthor(field[0]["a"], "author", true));	
		}
	}
	
	// Extract tags
	// personal
	this._associateTags(item, "600", "aqtxyz");
	// corporate
	this._associateTags(item, "611", "abtxyz");
	// meeting
	this._associateTags(item, "630", "acetxyz");
	// uniform title
	this._associateTags(item, "648", "atxyz");
	// chronological
	this._associateTags(item, "650", "axyz");
	// topical
	this._associateTags(item, "651", "abcxyz");
	// geographic
	this._associateTags(item, "653", "axyz");
	// uncontrolled
	this._associateTags(item, "653", "a");
	// faceted topical term (whatever that means)
	this._associateTags(item, "654", "abcyz");
	// genre/form
	this._associateTags(item, "655", "abcxyz");
	// occupation
	this._associateTags(item, "656", "axyz");
	// function
	this._associateTags(item, "657", "axyz");
	// curriculum objective
	this._associateTags(item, "658", "ab");
	// hierarchical geographic place name
	this._associateTags(item, "662", "abcdfgh");
	
	// Extract title
	this._associateDBField(item, "245", "ab", "title");
	// Extract edition
	this._associateDBField(item, "250", "a", "edition");
	// Extract place info
	this._associateDBField(item, "260", "a", "place");
	
	// Extract publisher/distributor
	if(item.itemType == "film") {
		this._associateDBField(item, "260", "b", "distributor");
	} else {
		this._associateDBField(item, "260", "b", "publisher");
	}
	
	// Extract year
	this._associateDBField(item, "260", "c", "date", pullNumber);
	// Extract pages
	this._associateDBField(item, "300", "a", "pages", pullNumber);
	// Extract series
	this._associateDBField(item, "440", "a", "series");
	// Extract call number
	this._associateDBField(item, "084", "ab", "callNumber");
	this._associateDBField(item, "082", "a", "callNumber");
	this._associateDBField(item, "080", "ab", "callNumber");
	this._associateDBField(item, "070", "ab", "callNumber");
	this._associateDBField(item, "060", "ab", "callNumber");
	this._associateDBField(item, "050", "ab", "callNumber");
	
	if (!item.place) this._associateDBField(item, "410", "a", "place");
	if (!item.publisher) this._associateDBField(item, "412", "a", "publisher");
	if (!item.title) this._associateDBField(item, "331", "a", "title");
	if (!item.date) this._associateDBField(item, "425", "a", "date", pullNumber);
	if (!item.date) this._associateDBField(item, "595", "a", "date", pullNumber);
	if(item.title) {
		item.title = Zotero.Utilities.capitalizeTitle(item.title);
	}
}

function doImport() {
	var text;
	var holdOver = "";	// part of the text held over from the last loop
	
	Zotero.setCharacterSet("utf-8");
	
	while(text = Zotero.read(4096)) {	// read in 4096 byte increments
		var records = text.split("\x1D");
		
		if(records.length > 1) {
			records[0] = holdOver + records[0];
			holdOver = records.pop(); // skip last record, since it''s not done
			
			for(var i in records) {
				var newItem = new Zotero.Item();
				
				// create new record
				var rec = new record();	
				rec.importBinary(records[i]);
				rec.translate(newItem);
				
				newItem.complete();
			}
		} else {
			holdOver += text;
		}
	}
}');

REPLACE INTO translators VALUES ('3f50aaac-7acc-4350-acd0-59cb77faf620', '1.0.0b4.r1', '', '2007-11-02 08:30:00', '1', '100', '2', 'Wikipedia Citation Templates', 'Simon Kornblith', '', '', 
'var fieldMap = {
	edition:"edition",
	publisher:"publisher",
	doi:"DOI",
	isbn:"ISBN",
	issn:"ISSN",
	conference:"conferenceName",
	volume:"volume",
	issue:"issue",
	pages:"pages",
	number:"episodeNumber"
};

var typeMap = {
	book:"Cite book",
	bookSection:"Cite book",
	journalArticle:"Cite journal",
	magazineArticle:"Cite news",
	newspaperArticle:"Cite news",
	thesis:"Cite paper",
	letter:"Cite",
	manuscript:"Cite book",
	interview:"Cite interview",
	film:"Cite video",
	artwork:"Cite",
	webpage:"Cite web",
	report:"Cite conference",
	bill:"Cite",
	hearing:"Cite",
	patent:"Cite",
	statute:"Cite",
	email:"Cite email",
	map:"Cite",
	blogPost:"Cite web",
	instantMessage:"Cite",
	forumPost:"Cite web",
	audioRecording:"Cite",
	presentation:"Cite paper",
	videoRecording:"Cite video",
	tvBroadcast:"Cite episode",
	radioBroadcast:"Cite episode",
	podcast:"Cite podcast",
	computerProgram:"Cite",
	conferencePaper:"Cite conference",
	document:"Cite",
	encyclopediaArticle:"Cite encyclopedia",
	dictionaryEntry:"Cite encyclopedia"
};

function formatAuthors(authors, useTypes) {
	var text = "";
	for each(var author in authors) {
		text += ", "+author.firstName;
		if(author.firstName && author.lastName) text += " ";
		text += author.lastName;
		if(useTypes) text += " ("+Zotero.Utilities.getLocalizedCreatorType(author.creatorType)+")";
	}
	return text.substr(2);
}

function formatFirstAuthor(authors, useTypes) {	
	var firstCreator = authors.shift();
	var field = firstCreator.lastName;
	if(firstCreator.lastName && firstCreator.firstName) field += ", ";
	field += firstCreator.firstName;
	if(useTypes) field += " ("+Zotero.Utilities.getLocalizedCreatorType(firstCreator.creatorType)+")";
	return field;
}

function formatDate(date) {
	var date = date.substr(0, date.indexOf(" "));
	if(date.substr(4, 3) == "-00") {
		date = date.substr(0, 4);
	} else if(date.substr(7, 3) == "-00") {
		date = date.substr(0, 7);
	}
	return date;
}

function doExport() {
	var first = true;
	while(item = Zotero.nextItem()) {
		// determine type
		var type = typeMap[item.itemType];
		if(!type) type = "Cite";
		
		var properties = new Object();
		
		for(var wikiField in fieldMap) {
			var zoteroField = fieldMap[wikiField];
			if(item[zoteroField]) properties[wikiField] = item[zoteroField];
		}
		
		if(item.creators && item.creators.length) {
			if(type == "Cite episode") {
				// now add additional creators
				properties.credits = formatAuthors(item.creators, true);
			} else if(type == "Cite video") {
				properties.people = "";
				
				// make first creator first, last
				properties.people = formatFirstAuthor(item.creators, true);
				// now add additional creators
				if(item.creators.length) properties.people += ", "+formatAuthors(item.creators, true);
				
				// use type
				if(item.type) {
					properties.medium = item.type;
				}
			} else if(type == "Cite email") {
				// get rid of non-authors
				for(var i in item.creators) {
					if(item.creators[i].creatorType != "author") {
						// drop contributors
						item.creators.splice(i, 1);
					}
				}
				
				// make first authors first, last
				properties.author = formatFirstAuthor(item.creators);
				// add supplemental authors
				if(item.creators.length) {
					properties.author += ", "+formatAuthors(item.creators);
				}
			} else if(type == "Cite interview") {
				// check for an interviewer or translator
				var interviewers = [];
				var translators = [];
				for(var i in item.creators) {
					if(item.creators[i].creatorType == "translator") {
						translators = translators.concat(item.creators.splice(i, 1));
					} else if(item.creators[i].creatorType == "interviewer") {
						interviewers = interviewers.concat(item.creators.splice(i, 1));
					} else if(item.creators[i].creatorType == "contributor") {
						// drop contributors
						item.creators.splice(i, 1);
					}
				}
				
				// interviewers
				if(interviewers.length) {
					properties.interviewer = formatAuthors([interviewers.shift()]);
					if(interviewers.length) properties.cointerviewers = formatAuthors(interviewers);
				}
				// translators
				if(translators.length) {
					properties.cointerviewers = (properties.cointerviewers ? properties.cointerviewers+", " : "");
					properties.cointerviewers += formatAuthors(translators);
				}
				// interviewees
				if(item.creators.length) {
					// take up to 4 interviewees
					var i = 1;
					while((interviewee = item.creators.shift()) && i <= 4) {
						var lastKey = "last";
						var firstKey = "first";
						if(i != 1) {
							lastKey += i;
							firstKey += i;
						}
						
						properties[lastKey] = interviewee.lastName;
						properties[firstKey] = interviewee.firstName;
					}
				}
				// medium
				if(item.medium) {
					properties.type = item.medium
				}
			} else {
				// check for an editor or translator
				var editors = [];
				var translators = [];
				for(var i in item.creators) {
					if(item.creators[i].creatorType == "translator") {
						translators = translators.concat(item.creators.splice(i, 1));
					} else if(item.creators[i].creatorType == "editor") {
						editors = editors.concat(item.creators.splice(i, 1));
					} else if(item.creators[i].creatorType == "contributor") {
						// drop contributors
						item.creators.splice(i, 1);
					}
				}
				
				// editors
				var others = "";
				if(editors.length) {
					var editorText = formatAuthors(editors)+(editors.length == 1 ? " (ed.)" : " (eds.)");
					if(item.itemType == "bookSection" || type == "Cite conference" || type == "Cite encyclopedia") {
						// as per docs, use editor only for chapters
						properties.editors = editorText;
					} else {
						others = editorText;
					}
				}
				// translators
				if(translators.length) {
					if(others) others += ", ";
					others += formatAuthors(translators)+" (trans.)";
				}
				
				// pop off first author, if there is one
				if(item.creators.length) {
					var firstAuthor = item.creators.shift();
					properties.last = firstAuthor.lastName;
					properties.first = firstAuthor.firstName;
					
					// add supplemental authors
					if(item.creators.length) {
						properties.coauthors = formatAuthors(item.creators);
					}
				}
				
				// attach others
				if(others) {
					if(type == "Cite book") {
						properties.others = others;
					} else {
						properties.coauthors = (properties.coauthors ? properties.coauthors+", " : "");
						properties.coauthors += others;
					}
				}
			}
		}
		
		if(item.itemType == "bookSection") {
			properties.title = item.publicationTitle;
			properties.chapter = item.title;;
		} else {
			properties.title = item.title;
			
			if(type == "Cite journal") {
				properties.journal = item.publicationTitle;
			} else if(type == "Cite conference") {
				properties.booktitle = item.publicationTitle;
			} else if(type == "Cite encyclopedia") {
				properties.encyclopedia = item.publicationTitle;
			} else {
				properties.work = item.publicationTitle;
			}
		}
		
		if(type == "Cite web" && item.type) {
			properties.format = item.type;
		}
		
		if(item.place) {
			if(type == "Cite episode") {
				properties.city = item.place;
			} else {
				properties.location = item.place;
			}
		}
		
		if(item.series) {
			properties.series = item.series;
		} else if(item.seriesTitle) {
			properties.series = item.seriesTitle;
		} else if(item.seriesText) {
			properties.series = item.seriesText;
		}
		
		if(item.accessDate) {
			properties.accessdate = formatDate(item.accessDate);
		}
		
		if(item.date) {
			if(type == "Cite email") {
				properties.senddate = formatDate(item.date);
			} else {
				var date = Zotero.Utilities.strToDate(item.date);
				var mm = "00";
				var dd = "00";
				if (date["month"] != undefined){
					mm = date["month"];
					mm = mm + 1;
					if (mm < 10){
						mm = "0" + mm;
					} 
				}
				if (date["day"] != undefined){
					dd = date["day"];
					if (dd < 10){
						dd = "0" + dd;
					} 
				}
				if (date["year"] != undefined){
					var yyyy = date["year"].toString();
					while (yyyy.length < 4){
						yyyy = "0"+yyyy;
					}
					properties.date = formatDate(yyyy+"-"+mm+"-"+dd+" ");
				}
			}
		}
		
		if(item.runningTime) {
			if(type == "Cite episode") {
				properties.minutes = item.runningTime;
			} else {
				properties.time = item.runningTime;
			}
		}
		
		if(item.url && item.accessDate) {
			if(item.itemType == "bookSection") {
				properties.chapterurl = item.url;
			} else {
				properties.url = item.url;
			}
		}
		
		// write out properties
		Zotero.write((first ? "" : "\r\n\r\n") + "{{"+type);
		for(var key in properties) {
			if(properties[key]) Zotero.write("\r\n| "+key+" = "+properties[key]);
		}
		Zotero.write("\r\n}}");
		
		first = false;
	}
}');




-- ----------------------------------------------------------------
--
--  CSL styles
--
-- ----------------------------------------------------------------
REPLACE INTO csl VALUES ('http://www.zotero.org/syles/ama', '2008-02-02 00:00:00', 'American Medical Association',
'<?xml version="1.0" encoding="UTF-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" xml:lang="en">
  <info>
    <title>American Medical Association</title>
    <id>http://www.zotero.org/syles/ama</id>
    <link href="http://www.zotero.org/syles/ama"/>
    <author>
      <name>Julian Onions</name>
      <email>julian.onions@gmail.com</email>
    </author>
    <category term="numeric"/>
    <category term="medicine"/>
    <updated>2008-02-02T00:00:00+00:00</updated>
    <summary>The American Medical Association style as used in JAMA.</summary>
    <link href="http://www.samford.edu/schools/pharmacy/dic/amaquickref07.pdf" rel="documentation"/>
  </info>
  <macro name="editor">
    <names variable="editor">
      <name name-as-sort-order="all" sort-separator=" " initialize-with="" delimiter=", " delimiter-precedes-last="always"/>
      <label form="short" prefix=", " text-case="lowercase" suffix="."/>
    </names>
  </macro>
  <macro name="anon">
    <text term="anonymous" form="short" text-case="capitalize-first"/>
  </macro>
  <macro name="author">
    <group suffix=".">
      <names variable="author">
	<name name-as-sort-order="all" sort-separator=" " initialize-with=""
	      delimiter=", " delimiter-precedes-last="always"/>
	<label form="short" prefix=" " suffix="" text-case="lowercase"/>
	<substitute>
	  <names variable="editor"/>
	  <text macro="anon"/>
	</substitute>
      </names>
    </group>
  </macro>
  <macro name="author-short">
    <names variable="author">
      <name form="short" and="symbol" delimiter=", " initialize-with="."/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
	<text macro="anon"/>
      </substitute>
    </names>
  </macro>
  <macro name="access">
    <group>
      <text value="Available at:" suffix=" "/>
      <text variable="URL"/>
      <group prefix=" [" suffix="]">
	<text term="accessed" text-case="capitalize-first" suffix=" "/>
	<date variable="accessed">
	  <date-part name="month" suffix=" "/>
	  <date-part name="day" suffix=", "/>
	  <date-part name="year"/>
	</date>
      </group>
    </group>
  </macro>
  <macro name="title">
    <choose>
      <if type="book">
	<text variable="title" font-style="italic"/>
      </if>
      <else>
	<text variable="title"/>
      </else>
    </choose>
  </macro>
  <macro name="publisher">
    <group delimiter=": ">
      <text variable="publisher-place"/>
      <text variable="publisher"/>
    </group>
  </macro>
  <macro name="year-date">
    <group prefix=" ">
      <choose>
	<if variable="issued">
	  <date variable="issued">
	    <date-part name="year"/>
	  </date>
	</if>
	<else>
	  <text term="no date"/>
	</else>
      </choose>
    </group>
  </macro>
  <macro name="edition">
    <choose>
      <if is-numeric="edition">
	<group delimiter=" ">
	  <number variable="edition" form="ordinal"/>
	  <text term="edition" form="short" suffix="."/>
	</group>
      </if>
      <else>
	  <text variable="edition" suffix="."/>
      </else>
    </choose>
  </macro>
  <citation>
    <option name="collapse" value="citation-number"/>
    <sort>
      <key variable="citation-number"/>
    </sort>
    <layout delimiter="," vertical-align="sup">
      <text variable="citation-number" />
      <group prefix="(" suffix=")">
	<label variable="locator" form="short"/>
	<text variable="locator"/>
      </group>
    </layout>
  </citation>
  <bibliography>
    <option name="hanging-indent" value="false"/>
    <option name="et-al-min" value="6"/>
    <option name="et-al-use-first" value="3"/>
    <layout>
      <text variable="citation-number" prefix="" suffix=". "/>
      <text macro="author" suffix=""/>
      <choose>
	<if type="book">
	  <group suffix=".">
	    <text macro="title" prefix=" " suffix="."/>
	    <text macro="edition" prefix=" " />
	    <text macro="editor" prefix=" (" suffix=")"/>
	  </group>
	  <text prefix=" " suffix="" macro="publisher"/>
	  <group suffix="." prefix="; ">
	    <date variable="issued">
	      <date-part name="year"/>
	    </date>
	    <text variable="page" prefix=":"/>
	  </group>
	</if>
	<else-if type="chapter">
	  <text macro="title" prefix=" " suffix="."/>
	  <group class="container" prefix=" ">
	    <text term="in" text-case="capitalize-first" suffix=": "/>
	    <text macro="editor"/>
	    <text variable="container-title" font-style="italic" prefix=" " suffix="."/>
	    <text variable="volume" prefix="Vol " suffix="."/>
	    <text macro="edition" prefix=" "/>
	    <text variable="collection-title" prefix=" " suffix="."/>
	    <group suffix=".">
	      <text macro="publisher" prefix=" "/>
	      <group suffix="." prefix="; ">
		<date variable="issued">
		  <date-part name="year"/>
		</date>
		<text variable="page" prefix=":"/>
	      </group>
	    </group>
	  </group>
	</else-if>
	<else>
	  <group suffix=".">
	    <text macro="title" prefix=" " />
	    <text macro="editor" prefix=" "/>
	  </group>
	  <group class="container" prefix=" " suffix=".">
	    <text variable="container-title" font-style="italic" form="short" suffix="."/>
	    <group delimiter=";" prefix=" ">
	      <date variable="issued">
		<date-part name="year"/>
	      </date>
	      <group>
		<text variable="volume" />
		<text variable="issue" prefix="(" suffix=")"/>
	      </group>
	    </group>
	    <text variable="page" prefix=":"/>
	  </group>
	</else>
      </choose>
      <text prefix=" " macro="access" suffix="."/>
    </layout>
  </bibliography>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/apa', '2008-02-02 00:00:00', 'American Psychological Association',
'<?xml version="1.0" encoding="UTF-8"?>
<?oxygen RNGSchema="http://xbiblio.svn.sourceforge.net/viewvc/*checkout*/xbiblio/csl/schema/trunk/csl.rnc" type="compact"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" xml:lang="en">
  <info>
    <title>American Psychological Association</title>
    <id>http://www.zotero.org/styles/apa</id>
    <link href="http://www.zotero.org/styles/apa"/>
    <author>
      <name>Simon Kornblith</name>
      <email>simon@simonster.com</email>
    </author>
    <category term="psychology"/>
    <category term="generic-base"/>
    <category term="author-date"/>
    <updated>2008-02-02T00:00:00+00:00</updated>
  </info>
  <macro name="editor-translator">
    <names variable="editor translator" delimiter=", ">
      <name and="symbol" initialize-with=". " delimiter=", "/>
      <label form="short" prefix=" (" text-case="capitalize-first" suffix=".)"/>
    </names>
  </macro>
  <macro name="author">
    <names variable="author">
      <name name-as-sort-order="all" and="symbol" sort-separator=", "
        initialize-with=". " delimiter=", " delimiter-precedes-last="always"/>
      <label form="short" prefix=" (" suffix=".)" text-case="capitalize-first"/>
      <substitute>
        <names variable="editor"/>
        <names variable="translator"/>
        <text macro="title"/>
      </substitute>
    </names>
  </macro>
  <macro name="author-short">
    <names variable="author">
      <name form="short" and="symbol" delimiter=", " initialize-with=". "/>
      <substitute>
        <names variable="editor"/>
        <names variable="translator"/>
        <choose>
          <if type="book">
            <text variable="title" form="short" font-style="italic"/>
          </if>
          <else>
            <text variable="title" form="short" quotes="true"/>
          </else>
        </choose>
      </substitute>
    </names>
  </macro>
  <macro name="access">
    <choose>
      <if variable="DOI">
        <text variable="DOI" prefix="doi: "/>
      </if>
      <else>
        <group>
          <text term="retrieved" text-case="capitalize-first" suffix=" "/>
          <date variable="accessed" suffix=", ">
            <date-part name="month" suffix=" "/>
            <date-part name="day" suffix=", "/>
            <date-part name="year"/>
          </date>
          <group>
            <text term="from" suffix=" "/>
            <text variable="URL"/>
          </group>
        </group>
      </else>
    </choose>
  </macro>
  <macro name="title">
    <choose>
      <if type="book">
        <text variable="title" text-case="sentence" font-style="italic"/>
      </if>
      <else>
        <text variable="title" text-case="sentence"/>
      </else>
    </choose>
  </macro>
  <macro name="publisher">
    <group delimiter=": ">
      <text variable="publisher-place"/>
      <text variable="publisher"/>
    </group>
  </macro>
  <macro name="event">
    <text variable="event"/>
    <text variable="event-place" prefix=", "/>
  </macro>
  <macro name="issued">
    <group prefix=" (" suffix=").">
      <date variable="issued">
        <date-part name="year"/>
      </date>
      <choose>
        <if type="book chapter article-journal" match="none">
          <date variable="issued">
            <date-part prefix=", " name="month"/>
            <date-part prefix=" " name="day"/>
          </date>
        </if>
      </choose>
    </group>
  </macro>
  <macro name="issued-year">
    <date variable="issued">
      <date-part name="year"/>
    </date>
  </macro>
  <macro name="citation-locator">
    <group>
      <label variable="locator" include-period="true" form="short"/>
      <text variable="locator" prefix=" "/>
    </group>
  </macro>
  <macro name="container-prefix">
    <choose>
      <if type="chapter">
        <text term="in" text-case="capitalize-first" suffix=" "/>
      </if>
    </choose>
  </macro>
  <macro name="pages">
    <choose>
      <if type="chapter">
        <group prefix=" (" suffix=")">
          <label variable="page" form="short" include-period="true" suffix=" "/>
          <text variable="page"/>
        </group>
      </if>
      <else>
        <text variable="page" prefix=", "/>
      </else>
    </choose>
  </macro>
  <macro name="edition">
      <text variable="edition"/>
  </macro>
  <citation>
    <option name="et-al-min" value="6"/>
    <option name="et-al-use-first" value="1"/>
    <option name="et-al-subsequent-min" value="3"/>
    <option name="et-al-subsequent-use-first" value="1"/>
    <option name="disambiguate-add-year-suffix" value="true"/>
    <option name="disambiguate-add-names" value="true"/>
    <option name="disambiguate-add-givenname" value="true"/>
    <option name="collapse" value="year"/>
    <sort>
      <key macro="author"/>
      <key variable="issued"/>
    </sort>
    <layout prefix="(" suffix=")" delimiter="; ">
      <group delimiter=", ">
        <text macro="author-short"/>
        <text macro="issued-year"/>
        <text macro="citation-locator"/>
      </group>
    </layout>
  </citation>
  <bibliography>
    <option name="hanging-indent" value="true"/>
    <option name="et-al-min" value="6"/>
    <option name="et-al-use-first" value="6"/>
    <sort>
      <key macro="author"/>
      <key variable="issued"/>
    </sort>
    <layout suffix=".">
      <text macro="author" suffix="."/>
      <text macro="issued"/>
      <text macro="title" prefix=" "/>
      <text macro="container-prefix" prefix=" "/>
      <text macro="editor-translator" prefix=" "/>
      <text variable="container-title" prefix=", " font-style="italic"/>
      <text variable="collection-title" prefix=", " suffix="."/>
      <text macro="edition" prefix=" (" suffix=")"/>
      <text variable="volume" prefix=", "/>
      <text variable="issue" prefix="(" suffix=")"/>
      <text macro="pages"/>
      <text macro="publisher" prefix=". "/>
      <text macro="access" prefix=". " />
    </layout>
  </bibliography>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/apsa', '2008-02-02 00:00:00', 'American Political Science Association',
'<?xml version="1.0" encoding="UTF-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" xml:lang="en" class="in-text" >
  <info>
    <title>American Political Science Association</title>
    <id>http://www.zotero.org/styles/apsa</id>
    <link href="http://www.zotero.org/styles/apsa"/>
    <author>
      <name>Julian Onions</name>
      <email>julian.onions@gmail.com</email>
    </author>
    <category term="author-date"/>
    <category term="political_science"/>
    <updated>2008-02-02T00:00:00+00:00</updated>
    <summary>The American Political Science Association style.</summary>
    <link href="http://www.wisc.edu/writing/Handbook/DocAPSA.html" rel="documentation"/>
  </info>
  <macro name="editor">
    <names variable="editor" delimiter=", ">
      <label form="short" text-case="lowercase" suffix=". "/>
      <name and="text"  delimiter=", "/>
    </names>
  </macro>
  <macro name="author">
    <names variable="author">
      <name name-as-sort-order="first" and="text" sort-separator=", " 
	    delimiter=", " delimiter-precedes-last="always"/>
      <label form="short" prefix=", " suffix="." text-case="lowercase"/>
      <substitute>
	<names variable="editor"/>
	<text variable="title"/>
      </substitute>
    </names>
  </macro>
  <macro name="author-short">
    <names variable="author">
      <name form="short" and="text" delimiter=", " initialize-with=". "/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
	<text variable="title"/>
      </substitute>
    </names>
  </macro>
  <macro name="access">
    <group delimiter=" ">
      <text value="Available at:"/>
      <text variable="URL"/>
      <group prefix="[" suffix="]">
	<text term="accessed" text-case="capitalize-first" suffix=" "/>
	<date variable="accessed">
	  <date-part name="month" suffix=" "/>
	  <date-part name="day" suffix=", "/>
	  <date-part name="year"/>
	</date>
      </group>
    </group>
  </macro>
  <macro name="title">
    <choose>
      <if type="book">
	<text variable="title" font-style="italic"/>
      </if>
      <else>
	<text variable="title"/>
      </else>
    </choose>
  </macro>
  <macro name="publisher">
    <group delimiter=": ">
      <text variable="publisher-place"/>
      <text variable="publisher"/>
    </group>
  </macro>
  <macro name="year-date">
    <group prefix=" ">
      <choose>
	<if variable="issued">
	  <date variable="issued">
	    <date-part name="year"/>
	  </date>
	</if>
	<else>
	  <text term="no date"/>
	</else>
      </choose>
    </group>
  </macro>
  <macro name="edition">
    <choose>
      <if is-numeric="edition">
	<group delimiter=" ">
	  <number variable="edition" form="ordinal"/>
	  <text term="edition" form="short" suffix="."/>
	</group>
      </if>
      <else>
	  <text variable="edition" suffix="."/>
      </else>
    </choose>
  </macro>
  <citation>
    <option name="et-al-min" value="4"/>
    <option name="et-al-use-first" value="1"/>
    <option name="et-al-subsequent-min" value="6"/>
    <option name="et-al-subsequent-use-first" value="1"/>
    <option name="disambiguate-add-year-suffix" value="true"/>
    <option name="disambiguate-add-names" value="true"/>
    <option name="disambiguate-add-givenname" value="true"/>
    <option name="collapse" value="year"/>
    <layout prefix="(" suffix=")" delimiter="; ">
      <group delimiter=", ">
	<group delimiter=" ">
	  <text macro="author-short"/>
	  <text macro="year-date"/>
	</group>
	<text variable="locator"/>
      </group>
    </layout>
  </citation>
  <bibliography>
    <option name="hanging-indent" value="true"/>
    <option name="et-al-min" value="4"/>
    <option name="et-al-use-first" value="1"/>
    <sort>
      <key macro="author"/>
      <key variable="title"/>
    </sort>
    <layout>
      <text macro="author" suffix="."/>
      <date variable="issued" prefix=" " suffix=".">
	<date-part name="year"/>
      </date>
      <choose>
	<if type="book">
	  <group prefix=" " delimiter=" ">
	    <text macro="title" suffix="."/>
	    <text macro="edition"/>
	    <text macro="editor" suffix="."/>
	  </group>
	  <text prefix=" " suffix="." macro="publisher"/>
	</if>
	<else-if type="chapter">
	  <text macro="title" prefix=" " suffix="." quotes="true"/>
	  <group class="container" prefix=" " delimiter=" ">
	    <text term="in" text-case="capitalize-first"/>
	    <text variable="container-title" font-style="italic" suffix=","/>
	    <text variable="collection-title" suffix=","/>
	    <text macro="editor" suffix="."/>
	    <group suffix=".">
	      <text macro="publisher" prefix=" "/>
	      <group prefix=", ">
		<text variable="page" prefix="p. "/>
	      </group>
	    </group>
	  </group>
	</else-if>
	<else>
	  <group prefix=" " delimiter=" " suffix=".">
	    <text macro="title" quotes="true"/>
	    <text macro="editor" />
	  </group>
	  <group class="container" prefix=" " suffix=".">
	    <text variable="container-title" font-style="italic"/>
	    <group prefix=" ">
	      <text variable="volume" />
	      <text variable="issue" prefix="(" suffix=")"/>
	    </group>
	    <text variable="page" prefix=":"/>
	  </group>
	</else>
      </choose>
      <text prefix=" " macro="access" suffix="."/>
    </layout>
  </bibliography>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/asa', '2008-02-02 00:00:00', 'American Sociological Association (Author-Date)',
'<?xml version="1.0" encoding="UTF-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" xml:lang="en" class="in-text" >
  <info>
    <title>American Sociological Association (Author-Date)</title>
    <id>http://www.zotero.org/styles/asa</id>
    <link href="http://www.zotero.org/styles/asa"/>
    <author>
      <name>Julian Onions</name>
      <email>julian.onions@gmail.com</email>
    </author>
    <category term="author-date"/>
    <category term="sociology"/>
    <updated>2008-02-02T00:00:00+00:00</updated>
    <summary>The ASA style.</summary>
    <link href="http://www.asanet.org/page.ww?name=Quick+Style+Guide%38section=Sociology+Depts" rel="documentation"/>
  </info>
  <macro name="editor">
    <names variable="editor">
      <label form="verb" text-case="lowercase" suffix=" "/>
      <name and="text" delimiter=", "/>
    </names>
  </macro>
  <macro name="series-editor">
    <names variable="original-author">
      <label form="short" text-case="capitalize-first" suffix=". "/>
      <name and="text" delimiter=", "/>
    </names>
  </macro>
  <macro name="anon">
    <text term="anonymous" form="short" text-case="capitalize-first"/>
  </macro>
  <macro name="author">
    <names variable="author">
      <name and="text" name-as-sort-order="first" sort-separator=", " delimiter=", "
	    delimiter-precedes-last="always"/>
      <label form="short" prefix=", " suffix="." text-case="lowercase"/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
	<text macro="anon"/>
      </substitute>
    </names>
  </macro>
  <macro name="author-short">
    <names variable="author">
      <name form="short" and="text" delimiter=", "/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
	<text macro="anon"/>
      </substitute>
    </names>
  </macro>
  <macro name="access">
    <group>
      <text variable="URL"/>
      <group prefix=" (" suffix=")">
	<text term="accessed" text-case="capitalize-first" suffix=" "/>
	<date variable="accessed">
	  <date-part name="month" suffix=" "/>
	  <date-part name="day" suffix=", "/>
	  <date-part name="year"/>
	</date>
      </group>
    </group>
  </macro>
  <macro name="title">
    <choose>
      <if type="thesis">
	<text variable="title"/>
      </if>
      <else-if type="book">
	<text variable="title" font-style="italic"/>
      </else-if>
      <else>
	<text variable="title" quotes="true"/>
      </else>
    </choose>
  </macro>
  <macro name="publisher">
    <group delimiter=": " >
      <text variable="publisher-place"/>
      <text variable="publisher"/>
    </group>
  </macro>
  <macro name="year-date">
    <choose>
      <if variable="issued">
	<date variable="issued">
	  <date-part name="year"/>
	</date>
      </if>
      <else>
	<text term="no date" form="short"/>
      </else>
    </choose>
  </macro>
  <macro name="day-month">
    <date variable="issued">
      <date-part name="month"/>
      <date-part name="day" prefix=" "/>
    </date>
    
  </macro>
  <macro name="pages">
    <label variable="page" form="short" suffix=". " text-case="capitalize-first"/>
    <text variable="page"/>
  </macro>
  <macro name="edition">
    <choose>
      <if is-numeric="edition">
	<group delimiter=" ">
	  <number variable="edition" form="ordinal"/>
	  <text term="edition" form="short" suffix="."/>
	</group>
      </if>
      <else>
	  <text variable="edition" suffix="."/>
      </else>
    </choose>
  </macro>
  <citation>
    <option name="et-al-min" value="3"/>
    <option name="et-al-use-first" value="1"/>
    <option name="et-al-subsequent-min" value="6"/>
    <option name="et-al-subsequent-use-first" value="1"/>
    <option name="disambiguate-add-year-suffix" value="true"/>
    <option name="disambiguate-add-names" value="true"/>
    <option name="disambiguate-add-givenname" value="true"/>
    <option name="collapse" value="year"/>
    <layout prefix="(" suffix=")" delimiter="; ">
      <group delimiter=":">
	<group delimiter=" ">
	  <text macro="author-short"/>
	  <text macro="year-date"/>
	</group>
	<text variable="locator"/>
      </group>
    </layout>
  </citation>
  <bibliography>
    <option name="hanging-indent" value="true"/>
    <option name="et-al-min" value="6"/>
    <option name="et-al-use-first" value="1"/>
    <sort>
      <key macro="author"/>
      <key variable="title"/>
    </sort>
    <layout suffix=".">
      <group delimiter=" ">
	<text macro="author" suffix="."/>
	<text macro="year-date" suffix="."/>
      </group>
      <choose>
	<if type="article-newspaper article-magazine" match="any">
	  <group delimiter=" ">
	    <text macro="title" prefix=" " suffix="."/>
	  </group>
	  <group prefix=" " delimiter=", ">
	    <text variable="container-title" font-style="italic"/>
	    <text macro="day-month"/>
	    <text variable="edition"/>
	    <text variable="page"/>
	  </group>
	</if>
	<else-if type="thesis">
	  <text macro="title" prefix=" " suffix="." quotes="true"/>
	  <group prefix=" " delimiter=", ">
	    <text macro="edition" />
	    <text macro="editor" suffix="."/>
	    <text variable="genre"/>
	    <text macro="publisher"/>
	  </group>
	</else-if>
	<else-if type="book">
	  <group delimiter=" ">
	    <text macro="title" prefix=" " suffix="."/>
	    <text macro="edition" />
	    <text macro="editor" suffix="."/>
	    <text macro="publisher"/>
	  </group>
	</else-if>
	<else-if type="chapter">
	  <group delimiter=" ">
	    <text macro="title" prefix=" " suffix="."/>
	    <group class="container" delimiter=", " suffix=".">
	      <group delimiter=" ">
		<text macro="pages"/>
		<text term="in" text-case="lowercase"/>
		<text variable="container-title" font-style="italic"/>
	      </group>
	      <text variable="volume" prefix="vol. "/>
	      <text variable="collection-title" font-style="italic"/>
	      <text macro="editor" prefix=" "/>
	    </group>
	    <text macro="publisher" prefix=" "/>
	  </group>
	</else-if>
	<else>
	  <group suffix="." >
	    <text macro="title" prefix=" " />
	    <text macro="editor" prefix=" "/>
	  </group>
	  <group class="container" prefix=" " suffix="." delimiter=" ">
	    <text variable="container-title" font-style="italic"/>
	    <group delimiter=":">
	      <text variable="volume" />
	      <text variable="page"/>
	    </group>
	  </group>
	</else>
      </choose>
      <text prefix=" " macro="access" suffix="."/>
    </layout>
  </bibliography>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/chicago-author-date', '2008-02-02 00:00:00', 'Chicago Manual of Style (Author-Date format)',
'<?xml version="1.0" encoding="UTF-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" xml:lang="en" class="in-text" >
  <info>
    <title>Chicago Manual of Style (Author-Date format)</title>
    <id>http://www.zotero.org/styles/chicago-author-date</id>
    <link href="http://www.zotero.org/styles/chicago-author-date"/>
    <author>
      <name>Julian Onions</name>
      <email>julian.onions@gmail.com</email>
    </author>
    <category term="author-date"/>
    <category term="generic-base"/>
    <updated>2008-02-02T00:00:00+00:00</updated>
    <summary>The author-date variant of the Chicago style</summary>
    <link href="http://www.chicagomanualofstyle.org/tools_citationguide.html" rel="documentation"/>
  </info>
  <macro name="secondary-contributor">
    <group delimiter=". ">
      <names variable="editor">
        <label form="verb-short" prefix=" " text-case="capitalize-first" suffix=". "/>
        <name and="text" delimiter=", "/>
      </names>
      <choose>
        <if variable="author editor" match="any">
      <names variable="translator">
        <label form="verb-short" prefix=" " text-case="capitalize-first" suffix=". "/>
        <name and="text" delimiter=", "/>
      </names>
        </if>
      </choose>
    </group>
  </macro>
  <macro name="series-editor">
    <names variable="original-author">
      <label form="short" text-case="capitalize-first" suffix=". "/>
      <name and="text" delimiter=", "/>
    </names>
  </macro>
  <macro name="anon">
    <text term="anonymous" form="short" text-case="capitalize-first"/>
  </macro>
  <macro name="author">
    <names variable="author">
      <name and="text" name-as-sort-order="first" sort-separator=", " delimiter=", "
	    delimiter-precedes-last="always"/>
      <label form="verb-short" prefix=", " suffix="." text-case="lowercase"/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
	<text macro="anon"/>
      </substitute>
    </names>
  </macro>
  <macro name="author-short">
    <names variable="author">
      <name form="short" and="text" delimiter=", "/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
	<text macro="anon"/>
      </substitute>
    </names>
  </macro>
  <macro name="access">
    <group>
      <text variable="URL"/>
      <group prefix=" (" suffix=")">
	<text term="accessed" text-case="capitalize-first" suffix=" "/>
	<date variable="accessed">
	  <date-part name="month" suffix=" "/>
	  <date-part name="day" suffix=", "/>
	  <date-part name="year"/>
	</date>
      </group>
    </group>
  </macro>
  <macro name="title">
    <choose>
      <if type="thesis">
	<text variable="title"/>
      </if>
      <else-if type="book">
	<text variable="title" font-style="italic"/>
      </else-if>
      <else>
	<text variable="title"/>
      </else>
    </choose>
  </macro>
  <macro name="edition">
    <choose>
      <if is-numeric="edition">
	<group delimiter=" ">
	  <number variable="edition" form="ordinal"/>
	  <text term="edition" form="short" suffix="."/>
	</group>
      </if>
      <else>
	  <text variable="edition" suffix="."/>
      </else>
    </choose>
  </macro>
  <macro name="volumes">
    <group delimiter=" ">
      <number variable="number-of-volumes" form="numeric"/>
      <text term="volume" form="short" suffix="." plural="true"/>
    </group>
  </macro>
  <macro name="publisher">
    <group delimiter=": " >
      <text variable="publisher-place"/>
      <text variable="publisher"/>
    </group>
  </macro>
  <macro name="year-date">
    <date variable="issued">
      <date-part name="year"/>
    </date>
  </macro>
  <macro name="day-month">
    <date variable="issued">
      <date-part name="month"/>
      <date-part name="day" prefix=" "/>
    </date>
  </macro>
  <citation>
    <option name="et-al-min" value="4"/>
    <option name="et-al-use-first" value="1"/>
    <option name="et-al-subsequent-min" value="6"/>
    <option name="et-al-subsequent-use-first" value="1"/>
    <option name="disambiguate-add-year-suffix" value="true"/>
    <option name="disambiguate-add-names" value="true"/>
    <option name="disambiguate-add-givenname" value="true"/>
    <option name="collapse" value="year"/>
    <layout prefix="(" suffix=")" delimiter="; ">
      <group delimiter=", ">
	<group delimiter=" ">
	  <text macro="author-short"/>
	  <text macro="year-date"/>
	</group>
	<text variable="locator"/>
      </group>
    </layout>
  </citation>
  <bibliography>
    <option name="hanging-indent" value="true"/>
    <option name="et-al-min" value="6"/>
    <option name="et-al-use-first" value="1"/>
    <sort>
      <key macro="author"/>
      <key variable="title"/>
    </sort>
    <layout suffix=".">
      <group delimiter=" ">
	<text macro="author" suffix="."/>
	<text macro="year-date" suffix="."/>
      </group>
      <choose>
	<if type="article-newspaper article-magazine" match="any">
	  <group delimiter=" ">
	    <text macro="title" prefix=" " suffix="."/>
	  </group>
	  <group prefix=" " delimiter=", ">
	    <text variable="container-title" font-style="italic"/>
	    <text macro="day-month"/>
	    <text variable="edition"/>
	  </group>
	</if>
	<else-if type="thesis">
	  <text macro="title" prefix=" " suffix="."/>
	  <group prefix=" " delimiter=", ">
	    <text variable="edition" suffix=" ed."/>
	    <text macro="secondary-contributor" suffix="."/>
	    <text variable="genre"/>
	    <text macro="publisher"/>
	  </group>
	</else-if>
	<else-if type="book">
	  <group delimiter=" ">
	    <text macro="title" prefix=" " suffix="."/>
	    <text macro="edition"/>
	    <text macro="volumes"/>
	    <text macro="secondary-contributor" suffix="."/>
	    <text macro="publisher"/>
	  </group>
	</else-if>
	<else-if type="chapter">
	  <group delimiter=" ">
	    <text macro="title" prefix=" " suffix="."/>
	    <group class="container" delimiter=", ">
	      <group delimiter=" ">
		<text term="in" text-case="capitalize-first"/>
		<text variable="container-title" font-style="italic"/>
	      </group>
	      <text macro="secondary-contributor" prefix=" "/>
	      <group delimiter=" ">
		<text variable="volume" prefix="Vol. " suffix=" of"/>
		<text variable="collection-title" font-style="italic"/>
		<text macro="series-editor"/>
	      </group>
	      <text variable="page"/>
	      <text macro="publisher" prefix=" "/>
	    </group>
	  </group>
	</else-if>
	<else>
	  <group suffix="." >
	    <text macro="title" prefix=" " />
	    <text macro="secondary-contributor" prefix=" "/>
	  </group>
	  <group class="container" prefix=" " suffix="." delimiter=" ">
	    <text variable="container-title" font-style="italic"/>
	    <group delimiter=":">
	      <group delimiter=", ">
		<text variable="volume" />
		<text variable="issue" prefix="no. "/>
	      </group>
	      <text variable="page"/>
	    </group>
	  </group>
	</else>
      </choose>
      <text prefix=" " macro="access" suffix="."/>
    </layout>
  </bibliography>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/chicago-fullnote-bibliography', '2008-02-02 00:00:00', 'Chicago Manual of Style (Full Note with Bibliography)',
'<style xmlns="http://purl.org/net/xbiblio/csl" class="note" xml:lang="en"> 
  <info>
    <title>Chicago Manual of Style (Full Note with Bibliography)</title>
    <id>http://www.zotero.org/styles/chicago-fullnote-bibliography</id>
    <link href="http://www.zotero.org/styles/chicago-fullnote-bibliography"/>
    <link href="http://www.chicagomanualofstyle.org/tools_citationguide.html" rel="documentation"/>
    <author>
      <name>Julian Onions</name>
      <email>julian.onions@gmail.com</email>
    </author>
    <contributor>
      <name>Simon Kornblith</name>
      <email>simon@simonster.com</email> 
    </contributor>
    <contributor>
      <name>Elena Razlogova</name>
      <email>elena.razlogova@gmail.com</email> 
    </contributor>
    <summary>Chicago format with full notes and bibliography</summary>
    <category term="generic-base"/>
    <category term="numeric"/>
    <updated>2008-02-02T00:00:00+00:00</updated>
  </info>
  <macro name="translator">
    <choose>
      <if variable="author editor" match="any">
    <names variable="translator" delimiter=", ">
      <label form="verb-short" prefix=" " text-case="lowercase" suffix=". "/>
      <name and="text" delimiter=", "/>
    </names>
      </if>
    </choose>
  </macro>
  <macro name="translator-bib">
    <choose>
      <if variable="author editor" match="any">
    <names variable="translator" delimiter=". ">
      <label form="verb" prefix=" " text-case="capitalize-first" suffix=" "/>
      <name and="text" delimiter=", "/>
    </names>
      </if>
    </choose>
  </macro>
  <macro name="secondary-contributor">
    <group delimiter=", ">
      <names variable="editor" delimiter=", ">
        <label form="verb-short" prefix=" " text-case="lowercase" suffix=". "/>
        <name and="text" delimiter=", "/>
      </names>
      <choose>
        <if type="article-journal article-magazine article-newspaper" match="none">
      <text macro="translator"/>
        </if>
      </choose>
    </group>
  </macro>
  <macro name="secondary-contributor-bib">
    <group delimiter=". ">
      <names variable="editor" delimiter=". ">
        <label form="verb" prefix=" " text-case="capitalize-first" suffix=" "/>
        <name and="text" delimiter=", "/>
      </names>
      <choose>
        <if type="article-journal article-magazine article-newspaper" match="none">
      <text macro="translator-bib"/>
        </if>
      </choose>
    </group>
  </macro>
  <macro name="translator-article">
    <choose>
      <if type="article-journal article-magazine article-newspaper" match="any">
        <text macro="translator"/>
      </if>
    </choose>
  </macro>
  <macro name="translator-article-bib">
    <choose>
      <if type="article-journal article-magazine article-newspaper" match="any">
        <text macro="translator-bib"/>
      </if>
    </choose>
  </macro>
  <macro name="author">
    <names variable="author">
      <name and="text" sort-separator=", "
	    delimiter=", "/>
      <label form="verb-short" prefix=", " suffix="."/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
      </substitute>
    </names>
  </macro> 
  <macro name="author-bib">
    <names variable="author">
      <name name-as-sort-order="first" and="text" sort-separator=", "
	    delimiter=", " delimiter-precedes-last="always"/>
      <label form="verb-short" prefix=", " suffix="."/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
      </substitute>
    </names>
  </macro>
  <macro name="author-short">
    <names variable="author">
      <name form="short" and="text" delimiter=", " />
      <label form="verb-short" prefix=", " suffix="."/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
      </substitute>
    </names>
  </macro>
  <macro name="author-sort">
    <names variable="author">
      <name name-as-sort-order="all" and="text" sort-separator=", "
	    delimiter=", " delimiter-precedes-last="always"/>
      <label form="verb-short" prefix=", " suffix="."/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
      </substitute>
    </names>
  </macro>
  <macro name="recipient">
    <names variable="recipient" delimiter=", ">
      <label form="verb" prefix=" " text-case="lowercase" suffix=" "/>
      <name and="text" delimiter=", "/>
    </names>
  </macro>
  <macro name="recipient-bib">
    <choose>
      <if type="personal_communication">
    	<choose>
	  	  <if variable="genre">
		<text variable="genre" text-case="capitalize-first"/>
	  	  </if>
	  	  <else>
		<text term="letter" text-case="capitalize-first"/>
		  </else>
	    </choose>
	  </if>
	</choose>
	<text macro="recipient" prefix=" "/>
  </macro>
  <macro name="recipient-short">
    <names variable="recipient"> 
      <label form="verb" prefix=" " text-case="lowercase" suffix=" "/>
      <name form="short" and="text" delimiter=", " />
    </names>
  </macro>
  <macro name="interviewer">
    <names variable="interviewer" delimiter=", ">
      <label form="verb" prefix=" " text-case="lowercase" suffix=" "/>
      <name and="text" delimiter=", "/>
    </names>
  </macro>
  <macro name="interviewer-bib">
    <names variable="interviewer" delimiter=", ">
      <label form="verb" prefix=" " text-case="capitalize-first" suffix=" "/>
      <name and="text" delimiter=", "/>
    </names>
  </macro>
  <macro name="title">
    <choose>
      <if variable="title" match="none">
        <text variable="genre"/>
      </if>
      <else-if type="book">
        <text variable="title" font-style="italic"/>
      </else-if>
      <else>
        <text variable="title" quotes="true"/>
      </else>
    </choose>
  </macro>
  <macro name="title-bib">
    <choose>
      <if variable="title" match="none">
        <text variable="genre" text-case="capitalize-first"/>
      </if>
      <else-if type="book">
        <text variable="title" font-style="italic"/>
      </else-if>
      <else>
        <text variable="title" quotes="true"/>
      </else>
    </choose>
  </macro>
  <macro name="title-short">
    <choose>
      <if variable="title" match="none">
        <choose>
          <if type="interview">
            <text term="interview" text-case="lowercase"/>
          </if>
          <else-if type="manuscript paper-conference" match="any">
            <text variable="genre" form="short"/>
          </else-if>
          <else-if type="personal_communication">
            <text macro="issued"/>
          </else-if>
        </choose>
      </if>
      <else-if type="book">
        <text variable="title" form="short" font-style="italic"/>
      </else-if>
      <else>
        <text variable="title" form="short" quotes="true"/>
      </else>
    </choose>
  </macro>
  <macro name="description">
    <group delimiter=", ">
      <text macro="interviewer"/>
      <text variable="medium"/>
      <choose>
        <if variable="title" match="none"> </if>
        <else-if type="thesis paper-conference" match="any"> </else-if>
        <else>
          <text variable="genre"/>
        </else>
      </choose>
    </group>
  </macro>
  <macro name="description-bib">
    <group delimiter=", ">
      <group delimiter=". ">
        <text macro="interviewer-bib"/>
        <text variable="medium" text-case="capitalize-first"/>
      </group>
      <choose>
        <if variable="title" match="none"> </if>
        <else-if type="thesis paper-conference" match="any"> </else-if>
        <else>
          <text variable="genre" text-case="capitalize-first"/>
        </else>
      </choose>
    </group>
  </macro>
  <macro name="container-prefix">
    <choose>
      <if type="chapter">
    <text term="in" text-case="lowercase" suffix=" "/>
      </if>
    </choose>
  </macro>
  <macro name="container-prefix-bib">
    <choose>
      <if type="chapter">
    <text term="in" text-case="capitalize-first" suffix=" "/>
      </if>
    </choose>
  </macro>
  <macro name="locators">
    <choose>
      <if type="article-journal">
        <text variable="volume" prefix=" "/>
        <text variable="issue" prefix=", no. "/>
      </if>
      <else-if type="book">
        <group prefix=", " delimiter=", ">
          <group>
            <text term="volume" form="short" suffix=". "/>
            <number variable="volume" form="numeric"/>
          </group>
          <choose>
            <if variable="locator" match="none">
          <group>
            <number variable="number-of-volumes" form="numeric"/>
            <text term="volume" form="short" prefix=" " suffix="." plural="true"/>
          </group>
            </if>
          </choose>
          <text variable="edition"/>
        </group>
      </else-if>
    </choose>
  </macro>
  <macro name="locators-bib">
    <choose>
      <if type="article-journal">
        <text variable="volume" prefix=" "/>
        <text variable="issue" prefix=", no. "/>
      </if>
      <else-if type="book">
        <group prefix=". " delimiter=". ">
          <group>
            <text term="volume" form="short" text-case="capitalize-first" suffix=". "/>
            <number variable="volume" form="numeric"/>
          </group>
          <choose>
            <if variable="locator" match="none">
          <group>
            <number variable="number-of-volumes" form="numeric"/>
            <text term="volume" form="short" prefix=" " suffix="." plural="true"/>
          </group>
            </if>
          </choose>
          <text variable="edition"/>
        </group>
      </else-if>
    </choose>
  </macro>
  <macro name="locators-newspaper">
    <choose>
      <if type="article-newspaper">
        <group delimiter=", ">
          <group>
        <text variable="edition" suffix=" "/>
        <text term="edition" prefix=" "/>
          </group>
          <group>
        <text term="section" form="short" suffix=". "/>
        <text variable="section"/>
          </group>
        </group>
      </if>
    </choose>
  </macro>
  <macro name="event">
    <group>
      <text term="presented at" suffix=" "/>
      <text variable="event"/>
    </group>
  </macro>
  <macro name="publisher">
    <group delimiter=": ">
      <text variable="publisher-place"/>
      <text variable="publisher"/>
    </group>
  </macro>
  <macro name="issued">
    <choose>
      <if type="graphic report" match="any">
	<date variable="issued">
	  <date-part name="month" suffix=" "/>
	  <date-part name="day" suffix=", "/>
	  <date-part name="year"/>
	</date>
      </if>
      <else-if type="book chapter thesis" match="any">
	<date variable="issued">
	  <date-part name="year"/>
	</date>
      </else-if>
      <else>
	<date variable="issued">
	  <date-part name="month" suffix=" "/>
	  <date-part name="day" suffix=", "/>
	  <date-part name="year"/>
	</date>
      </else>
    </choose>
  </macro>
  <macro name="locator">
    <choose>
      <if variable="locator" match="none">
        <text macro="pages"/>
      </if>
      <else-if type="article-journal">
        <text variable="locator" prefix=": "/>
      </else-if>
      <else>
        <text variable="locator" prefix=", "/>
      </else>
    </choose>
  </macro>
  <macro name="pages">
    <choose>
      <if type="article-journal">
    <text variable="page" prefix=": "/>
      </if>
      <else-if type="chapter">
    <text variable="page" prefix=", "/>
      </else-if>
    </choose>
  </macro>
  <macro name="pages-chapter">
    <choose>
      <if type="chapter">
    <text variable="page" prefix=", "/>
      </if>
    </choose>
  </macro>
  <macro name="pages-article">
    <choose>
      <if type="article-journal">
    <text variable="page" prefix=": "/>
      </if>
    </choose>
  </macro>
  <macro name="archive">
    <group delimiter=", ">
      <text variable="archive_location"/>
      <text variable="archive"/>
      <text variable="archive-place"/>
    </group>
  </macro>
  <macro name="archive-bib">
    <group delimiter=". ">
      <text variable="archive_location" text-case="capitalize-first"/>
      <text variable="archive"/>
      <text variable="archive-place"/>
    </group>
  </macro>
  <macro name="issue">
    <choose>
      <if type="article-journal">
        <text macro="issued" prefix=" (" suffix=")"/>
      </if>
      <else-if variable="publisher-place publisher" match="any">
        <group prefix=" (" suffix=")" delimiter=", ">
          <group delimiter=" ">
            <choose>
              <if variable="title" match="none"> </if>
              <else-if type="thesis paper-conference" match="any">
                <text variable="genre"/>
              </else-if>
            </choose>
            <text macro="event"/>
          </group>
          <text macro="publisher"/>
          <text macro="issued"/>
        </group>
      </else-if>
      <else>
        <text macro="issued" prefix=", "/>
      </else>
    </choose>
  </macro>
  <macro name="issue-bib">
    <choose>
      <if type="article-journal">
        <text macro="issued" prefix=" (" suffix=")"/>
      </if>
      <else-if variable="publisher-place publisher" match="any">
        <choose>
          <if variable="title" match="none"> </if>
          <else-if type="paper-conference">
            <text variable="genre" text-case="capitalize-first" prefix=". "/>
          </else-if>
        </choose>
        <text macro="event" prefix=" "/>
        <group prefix=". " delimiter=", ">
          <choose>
            <if type="thesis">
              <text variable="genre" text-case="capitalize-first"/>
            </if>
          </choose>
          <text macro="publisher"/>
          <text macro="issued"/>
        </group>
      </else-if>
      <else>
        <text macro="issued" prefix=", "/>
      </else>
    </choose>
  </macro>
  <macro name="access">
    <group delimiter=", ">
	  <choose>
	    <if type="graphic report" match="any">
      <text macro="archive"/>
	    </if>
	    <else-if type="book thesis chapter article-journal article-newspaper article-magazine" match="none">
      <text macro="archive"/>
	    </else-if>
	  </choose>
      <text variable="URL"/>
    </group>
  </macro>
  <macro name="access-bib">
    <group delimiter=". ">
	  <choose>
	    <if type="graphic report" match="any">
      <text macro="archive-bib"/>
	    </if>
	    <else-if type="book thesis chapter article-journal article-newspaper article-magazine" match="none">
      <text macro="archive-bib"/>
	    </else-if>
	  </choose>
      <text variable="URL"/>
    </group>
  </macro>
  <macro name="sort-key">
      <text macro="author-sort" suffix=" "/>
      <text variable="title" suffix=" "/>
      <text variable="genre"/>
  </macro>
  <citation>
    <option name="et-al-min" value="4"/>
    <option name="et-al-use-first" value="1"/>
    <option name="et-al-subsequent-min" value="4"/>
    <option name="et-al-subsequent-use-first" value="1"/>
    <option name="disambiguate-add-year-suffix" value="true"/>
    <option name="disambiguate-add-names" value="true"/>
    <option name="disambiguate-add-givenname" value="true"/>
    <layout prefix="" suffix="." delimiter="; ">
      <choose>
        <if position="ibid-with-locator">
          <group delimiter=", ">
            <text term="ibid" text-case="capitalize-first" suffix="."/>
            <text variable="locator"/>
          </group>
        </if>
        <else-if position="ibid">
          <text term="ibid" text-case="capitalize-first" suffix="."/>
        </else-if>
        <else-if position="subsequent">
          <group delimiter=", ">
            <group>
              <text macro="author-short"/>
              <text macro="recipient-short"/>
            </group>
            <text macro="title-short"/>
            <text variable="locator"/>
          </group>
        </else-if>
        <else>
          <group delimiter=", ">
            <group>
              <text macro="author"/>
              <text macro="recipient"/>
            </group>
            <text macro="title"/>
            <text macro="description"/>
            <text macro="translator-article"/>
            <group>
              <text macro="container-prefix"/>
              <text variable="container-title" font-style="italic"/>
            </group>
            <text macro="secondary-contributor"/>
          </group>
          <text macro="locators"/>
          <text variable="collection-title" prefix=", "/>
          <text macro="issue"/>
          <text macro="locators-newspaper" prefix=", "/>
          <text macro="locator"/>
          <text macro="access" prefix=", "/>
        </else>
      </choose>
    </layout>
  </citation> 
  <bibliography>
    <option name="hanging-indent" value="true"/>
    <option name="et-al-min" value="6"/>
    <option name="et-al-use-first" value="6"/>
    <option name="subsequent-author-substitute" value="---"/>
    <sort>
      <key macro="sort-key"/>
    </sort>
    <layout suffix=".">
      <group delimiter=". ">
        <text macro="author-bib"/>
        <text macro="recipient-bib"/>
        <text macro="title-bib"/>
        <text macro="description-bib"/>
        <text macro="translator-article-bib"/>
        <group>
          <text macro="container-prefix-bib"/>
          <text variable="container-title" font-style="italic"/>
          <text macro="pages-chapter"/>
        </group>
        <text macro="secondary-contributor-bib"/>
      </group>
      <text macro="locators-bib"/>
      <text variable="collection-title" text-case="capitalize-first" prefix=". "/>
      <text macro="issue-bib"/>
      <text macro="locators-newspaper" prefix=", "/>
      <text macro="pages-article"/>
      <text macro="access-bib" prefix=". "/>
    </layout>
  </bibliography>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/chicago-note-bibliography', '2008-02-02 00:00:00', 'Chicago Manual of Style (Note with Bibliography)',
'<?xml version="1.0" encoding="UTF-8"?>
<?oxygen RNGSchema="http://xbiblio.svn.sourceforge.net/viewvc/*checkout*/xbiblio/csl/schema/trunk/csl.rnc" type="compact"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="note" xml:lang="en"> 
  <info>
    <title>Chicago Manual of Style (Note with Bibliography)</title>
    <id>http://www.zotero.org/styles/chicago-note-bibliography</id>
    <link href="http://www.zotero.org/styles/chicago-note-bibliography"/>
    <link href="http://www.chicagomanualofstyle.org/tools_citationguide.html" rel="documentation"/>
    <author>
      <name>Julian Onions</name>
      <email>julian.onions@gmail.com</email>
    </author>
    <contributor>
      <name>Simon Kornblith</name>
      <email>simon@simonster.com</email> 
    </contributor>
    <contributor>
      <name>Elena Razlogova</name>
      <email>elena.razlogova@gmail.com</email> 
    </contributor>
    <summary>Chicago format with short notes and full bibliography</summary>
    <category term="generic-base"/>
    <category term="numeric"/>
    <updated>2008-02-02T00:00:00+00:00</updated>
  </info>
  <macro name="translator-bib">
    <choose>
      <if variable="author editor" match="any">
    <names variable="translator" delimiter=". ">
      <label form="verb" prefix=" " text-case="capitalize-first" suffix=" "/>
      <name and="text" delimiter=", "/>
    </names>
      </if>
    </choose>
  </macro>
  <macro name="secondary-contributor-bib">
    <group delimiter=". ">
      <names variable="editor" delimiter=". ">
        <label form="verb" prefix=" " text-case="capitalize-first" suffix=" "/>
        <name and="text" delimiter=", "/>
      </names>
      <choose>
        <if type="article-journal article-magazine article-newspaper" match="none">
      <text macro="translator-bib"/>
        </if>
      </choose>
    </group>
  </macro>
  <macro name="translator-article-bib">
    <choose>
      <if type="article-journal article-magazine article-newspaper" match="any">
        <text macro="translator-bib"/>
      </if>
    </choose>
  </macro>
  <macro name="author-bib">
    <names variable="author">
      <name name-as-sort-order="first" and="text" sort-separator=", "
	    delimiter=", " delimiter-precedes-last="always"/>
      <label form="verb-short" prefix=", " suffix="."/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
      </substitute>
    </names>
  </macro>
  <macro name="author-short">
    <names variable="author">
      <name form="short" and="text" delimiter=", " />
      <label form="verb-short" prefix=", " suffix="."/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
      </substitute>
    </names>
  </macro>
  <macro name="author-sort">
    <names variable="author">
      <name name-as-sort-order="all" and="text" sort-separator=", "
	    delimiter=", " delimiter-precedes-last="always"/>
      <label form="verb-short" prefix=", " suffix="."/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
      </substitute>
    </names>
  </macro>
  <macro name="recipient">
    <names variable="recipient" delimiter=", ">
      <label form="verb" prefix=" " text-case="lowercase" suffix=" "/>
      <name and="text" delimiter=", "/>
    </names>
  </macro>
  <macro name="recipient-bib">
    <choose>
      <if type="personal_communication">
    	<choose>
	  	  <if variable="genre">
		<text variable="genre" text-case="capitalize-first"/>
	  	  </if>
	  	  <else>
		<text term="letter" text-case="capitalize-first"/>
		  </else>
	    </choose>
	  </if>
	</choose>
	<text macro="recipient" prefix=" "/>
  </macro>
  <macro name="recipient-short">
    <names variable="recipient"> 
      <label form="verb" prefix=" " text-case="lowercase" suffix=" "/>
      <name form="short" and="text" delimiter=", " />
    </names>
  </macro>
  <macro name="interviewer-bib">
    <names variable="interviewer" delimiter=", ">
      <label form="verb" prefix=" " text-case="capitalize-first" suffix=" "/>
      <name and="text" delimiter=", "/>
    </names>
  </macro>
  <macro name="title-bib">
    <choose>
      <if variable="title" match="none">
        <text variable="genre" text-case="capitalize-first"/>
      </if>
      <else-if type="book">
        <text variable="title" font-style="italic"/>
      </else-if>
      <else>
        <text variable="title" quotes="true"/>
      </else>
    </choose>
  </macro>
  <macro name="title-short">
    <choose>
      <if variable="title" match="none">
        <choose>
          <if type="interview">
            <text term="interview" text-case="lowercase"/>
          </if>
          <else-if type="manuscript paper-conference" match="any">
            <text variable="genre" form="short"/>
          </else-if>
          <else-if type="personal_communication">
            <text macro="issued"/>
          </else-if>
        </choose>
      </if>
      <else-if type="book">
        <text variable="title" form="short" font-style="italic"/>
      </else-if>
      <else>
        <text variable="title" form="short" quotes="true"/>
      </else>
    </choose>
  </macro>
  <macro name="description-bib">
    <group delimiter=", ">
      <group delimiter=". ">
        <text macro="interviewer-bib"/>
        <text variable="medium" text-case="capitalize-first"/>
      </group>
      <choose>
        <if variable="title" match="none"> </if>
        <else-if type="thesis paper-conference" match="any"> </else-if>
        <else>
          <text variable="genre" text-case="capitalize-first"/>
        </else>
      </choose>
    </group>
  </macro>
  <macro name="container-prefix-bib">
    <choose>
      <if type="chapter">
    <text term="in" text-case="capitalize-first" suffix=" "/>
      </if>
    </choose>
  </macro>
  <macro name="locators-bib">
    <choose>
      <if type="article-journal">
        <text variable="volume" prefix=" "/>
        <text variable="issue" prefix=", no. "/>
      </if>
      <else-if type="book">
        <group prefix=". " delimiter=". ">
          <group>
            <text term="volume" form="short"  text-case="capitalize-first" suffix=". "/>
            <number variable="volume" form="numeric"/>
          </group>
          <choose>
            <if variable="locator" match="none">
          <group>
            <number variable="number-of-volumes" form="numeric"/>
            <text term="volume" form="short" prefix=" " suffix="." plural="true"/>
          </group>
            </if>
          </choose>
          <text variable="edition"/>
        </group>
      </else-if>
    </choose>
  </macro>
  <macro name="locators-newspaper">
    <choose>
      <if type="article-newspaper">
        <group delimiter=", ">
          <group>
        <text variable="edition" suffix=" "/>
        <text term="edition" prefix=" "/>
          </group>
          <group>
        <text term="section" form="short" suffix=". "/>
        <text variable="section"/>
          </group>
        </group>
      </if>
    </choose>
  </macro>
  <macro name="event">
    <group>
      <text term="presented at" suffix=" "/>
      <text variable="event"/>
    </group>
  </macro>
  <macro name="publisher">
    <group delimiter=": ">
      <text variable="publisher-place"/>
      <text variable="publisher"/>
    </group>
  </macro>
  <macro name="issued">
    <choose>
      <if type="graphic report" match="any">
	<date variable="issued">
	  <date-part name="month" suffix=" "/>
	  <date-part name="day" suffix=", "/>
	  <date-part name="year"/>
	</date>
      </if>
      <else-if type="book chapter thesis" match="any">
	<date variable="issued">
	  <date-part name="year"/>
	</date>
      </else-if>
      <else>
	<date variable="issued">
	  <date-part name="month" suffix=" "/>
	  <date-part name="day" suffix=", "/>
	  <date-part name="year"/>
	</date>
      </else>
    </choose>
  </macro>
  <macro name="pages-chapter">
    <choose>
      <if type="chapter">
    <text variable="page" prefix=", "/>
      </if>
    </choose>
  </macro>
  <macro name="pages-article">
    <choose>
      <if type="article-journal">
    <text variable="page" prefix=": "/>
      </if>
    </choose>
  </macro>
  <macro name="archive-bib">
    <group delimiter=". ">
      <text variable="archive_location" text-case="capitalize-first"/>
      <text variable="archive"/>
      <text variable="archive-place"/>
    </group>
  </macro>
  <macro name="issue-bib">
    <choose>
      <if type="article-journal">
        <text macro="issued" prefix=" (" suffix=")"/>
      </if>
      <else-if variable="publisher-place publisher" match="any">
        <choose>
          <if variable="title" match="none"> </if>
          <else-if type="paper-conference">
            <text variable="genre" text-case="capitalize-first" prefix=". "/>
          </else-if>
        </choose>
        <text macro="event" prefix=" "/>
        <group prefix=". " delimiter=", ">
          <choose>
            <if type="thesis">
              <text variable="genre" text-case="capitalize-first"/>
            </if>
          </choose>
          <text macro="publisher"/>
          <text macro="issued"/>
        </group>
      </else-if>
      <else>
        <text macro="issued" prefix=", "/>
      </else>
    </choose>
  </macro>
  <macro name="access-bib">
    <group delimiter=". ">
	  <choose>
	    <if type="graphic report" match="any">
      <text macro="archive-bib"/>
	    </if>
	    <else-if type="book thesis chapter article-journal article-newspaper article-magazine" match="none">
      <text macro="archive-bib"/>
	    </else-if>
	  </choose>
      <text variable="URL"/>
    </group>
  </macro>
  <macro name="sort-key">
      <text macro="author-sort" suffix=" "/>
      <text variable="title" suffix=" "/>
      <text variable="genre"/>
  </macro>
  <citation>
    <option name="et-al-min" value="4"/>
    <option name="et-al-use-first" value="1"/>
    <option name="et-al-subsequent-min" value="4"/>
    <option name="et-al-subsequent-use-first" value="1"/>
    <option name="disambiguate-add-year-suffix" value="true"/>
    <option name="disambiguate-add-names" value="true"/>
    <option name="disambiguate-add-givenname" value="true"/>
    <layout prefix="" suffix="." delimiter="; ">
      <choose>
        <if position="ibid-with-locator">
          <group delimiter=", ">
            <text term="ibid" text-case="capitalize-first" suffix="."/>
            <text variable="locator"/>
          </group>
        </if>
        <else-if position="ibid">
          <text term="ibid" text-case="capitalize-first" suffix="."/>
        </else-if>
        <else>
          <group delimiter=", ">
            <group>
              <text macro="author-short"/>
              <text macro="recipient-short"/>
            </group>
            <text macro="title-short"/>
            <text variable="locator"/>
          </group>
        </else>
      </choose>
    </layout>
  </citation> 
  <bibliography>
    <option name="hanging-indent" value="true"/>
    <option name="et-al-min" value="6"/>
    <option name="et-al-use-first" value="6"/>
    <option name="subsequent-author-substitute" value="---"/>
    <sort>
      <key macro="sort-key"/>
    </sort>
    <layout suffix=".">
      <group delimiter=". ">
        <text macro="author-bib"/>
        <text macro="recipient-bib"/>
        <text macro="title-bib"/>
        <text macro="description-bib"/>
        <text macro="translator-article-bib"/>
        <group>
          <text macro="container-prefix-bib"/>
          <text variable="container-title" font-style="italic"/>
          <text macro="pages-chapter"/>
        </group>
        <text macro="secondary-contributor-bib"/>
      </group>
      <text macro="locators-bib"/>
      <text variable="collection-title" text-case="capitalize-first" prefix=". "/>
      <text macro="issue-bib"/>
      <text macro="locators-newspaper" prefix=", "/>
      <text macro="pages-article"/>
      <text macro="access-bib" prefix=". "/>
    </layout>
  </bibliography>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/chicago-note', '2008-02-02 00:00:00', 'Chicago Manual of Style (Note without Bibliography)',
'<?xml version="1.0" encoding="UTF-8"?>
<?oxygen RNGSchema="http://xbiblio.svn.sourceforge.net/viewvc/*checkout*/xbiblio/csl/schema/trunk/csl.rnc" type="compact"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="note" xml:lang="en">
  <info>
    <title>Chicago Manual of Style (Note without Bibliography)</title>
    <id>http://www.zotero.org/styles/chicago-note</id>
    <link href="http://www.zotero.org/styles/chicago-note"/>
    <link href="http://www.chicagomanualofstyle.org/tools_citationguide.html" rel="documentation"/>
    <author>
      <name>Julian Onions</name>
      <email>julian.onions@gmail.com</email>
    </author>
    <contributor>
      <name>Simon Kornblith</name>
      <email>simon@simonster.com</email>
    </contributor>
    <contributor>
      <name>Elena Razlogova</name>
      <email>elena.razlogova@gmail.com</email>
    </contributor>
    <summary>Chicago format with full notes and no bibliography</summary>
    <category term="generic-base"/>
    <category term="note"/>
    <updated>2008-02-02T00:00:00+00:00</updated>
  </info>
  <macro name="translator">
    <choose>
      <if variable="author editor" match="any">
    <names variable="translator" delimiter=", ">
      <label form="verb-short" prefix=" " text-case="lowercase" suffix=". "/>
      <name and="text" delimiter=", "/>
    </names>
      </if>
    </choose>
  </macro>
  <macro name="secondary-contributor">
    <group delimiter=", ">
      <names variable="editor" delimiter=", ">
        <label form="verb-short" prefix=" " text-case="lowercase" suffix=". "/>
        <name and="text" delimiter=", "/>
      </names>
      <choose>
        <if type="article-journal article-magazine article-newspaper" match="none">
      <text macro="translator"/>
        </if>
      </choose>
    </group>
  </macro>
  <macro name="translator-article">
    <choose>
      <if type="article-journal article-magazine article-newspaper" match="any">
        <text macro="translator"/>
      </if>
    </choose>
  </macro>
  <macro name="author">
    <names variable="author">
      <name and="text" sort-separator=", " delimiter=", "/>
      <label form="verb-short" prefix=", " suffix="."/>
      <substitute>
        <names variable="editor"/>
        <names variable="translator"/>
      </substitute>
    </names>
  </macro>
  <macro name="author-short">
    <names variable="author">
      <name form="short" and="text" delimiter=", "/>
      <label form="verb-short" prefix=", " suffix="."/>
      <substitute>
        <names variable="editor"/>
        <names variable="translator"/>
      </substitute>
    </names>
  </macro>
  <macro name="recipient">
    <names variable="recipient" delimiter=", ">
      <label form="verb" prefix=" " text-case="lowercase" suffix=" "/>
      <name and="text" delimiter=", "/>
    </names>
  </macro>
  <macro name="recipient-short">
    <names variable="recipient">
      <label form="verb" prefix=" " text-case="lowercase" suffix=" "/>
      <name form="short" and="text" delimiter=", "/>
    </names>
  </macro>
  <macro name="interviewer">
    <names variable="interviewer" delimiter=", ">
      <label form="verb" prefix=" " text-case="lowercase" suffix=" "/>
      <name and="text" delimiter=", "/>
    </names>
  </macro>
  <macro name="title">
    <choose>
      <if variable="title" match="none">
        <text variable="genre"/>
      </if>
      <else-if type="book">
        <text variable="title" font-style="italic"/>
      </else-if>
      <else>
        <text variable="title" quotes="true"/>
      </else>
    </choose>
  </macro>
  <macro name="title-short">
    <choose>
      <if variable="title" match="none">
        <choose>
          <if type="interview">
            <text term="interview" text-case="lowercase"/>
          </if>
          <else-if type="manuscript paper-conference" match="any">
            <text variable="genre" form="short"/>
          </else-if>
          <else-if type="personal_communication">
            <text macro="issued"/>
          </else-if>
        </choose>
      </if>
      <else-if type="book">
        <text variable="title" form="short" font-style="italic"/>
      </else-if>
      <else>
        <text variable="title" form="short" quotes="true"/>
      </else>
    </choose>
  </macro>
  <macro name="description">
    <group delimiter=", ">
      <text macro="interviewer"/>
      <text variable="medium"/>
      <choose>
        <if variable="title" match="none"> </if>
        <else-if type="thesis paper-conference" match="any"> </else-if>
        <else>
          <text variable="genre"/>
        </else>
      </choose>
    </group>
  </macro>
  <macro name="container-prefix">
    <choose>
      <if type="chapter">
    <text term="in" text-case="lowercase" suffix=" "/>
      </if>
    </choose>
  </macro>
  <macro name="locators">
    <choose>
      <if type="article-journal">
        <text variable="volume" prefix=" "/>
        <text variable="issue" prefix=", no. "/>
      </if>
      <else-if type="book">
        <group prefix=", " delimiter=", ">
          <group>
            <text term="volume" form="short" suffix=". "/>
            <number variable="volume" form="numeric"/>
          </group>
          <choose>
            <if variable="locator" match="none">
          <group>
            <number variable="number-of-volumes" form="numeric"/>
            <text term="volume" form="short" prefix=" " suffix="." plural="true"/>
          </group>
            </if>
          </choose>
          <text variable="edition"/>
        </group>
      </else-if>
    </choose>
  </macro>
  <macro name="locators-newspaper">
    <choose>
      <if type="article-newspaper">
        <group delimiter=", ">
          <group>
        <text variable="edition" suffix=" "/>
        <text term="edition" prefix=" "/>
          </group>
          <group>
        <text term="section" form="short" suffix=". "/>
        <text variable="section"/>
          </group>
        </group>
      </if>
    </choose>
  </macro>
  <macro name="event">
    <group>
      <text term="presented at" suffix=" "/>
      <text variable="event"/>
    </group>
  </macro>
  <macro name="publisher">
    <group delimiter=": ">
      <text variable="publisher-place"/>
      <text variable="publisher"/>
    </group>
  </macro>
  <macro name="issued">
    <choose>
      <if type="graphic report" match="any">
        <date variable="issued">
          <date-part name="month" suffix=" "/>
          <date-part name="day" suffix=", "/>
          <date-part name="year"/>
        </date>
      </if>
      <else-if type="book chapter thesis" match="any">
        <date variable="issued">
          <date-part name="year"/>
        </date>
      </else-if>
      <else>
        <date variable="issued">
          <date-part name="month" suffix=" "/>
          <date-part name="day" suffix=", "/>
          <date-part name="year"/>
        </date>
      </else>
    </choose>
  </macro>
  <macro name="pages">
    <choose>
      <if type="article-journal">
    <text variable="page" prefix=": "/>
      </if>
      <else-if type="chapter">
    <text variable="page" prefix=", "/>
      </else-if>
    </choose>
  </macro>
  <macro name="locator">
    <choose>
      <if variable="locator" match="none">
        <text macro="pages"/>
      </if>
      <else-if type="article-journal">
        <text variable="locator" prefix=": "/>
      </else-if>
      <else>
        <text variable="locator" prefix=", "/>
      </else>
    </choose>
  </macro>
  <macro name="archive">
    <group delimiter=", ">
      <text variable="archive_location"/>
      <text variable="archive"/>
      <text variable="archive-place"/>
    </group>
  </macro>
  <macro name="issue">
    <choose>
      <if type="article-journal">
        <text macro="issued" prefix=" (" suffix=")"/>
      </if>
      <else-if variable="publisher-place publisher" match="any">
        <group prefix=" (" suffix=")" delimiter=", ">
          <group delimiter=" ">
            <choose>
              <if variable="title" match="none"> </if>
              <else-if type="thesis paper-conference" match="any">
                <text variable="genre"/>
              </else-if>
            </choose>
            <text macro="event"/>
          </group>
          <text macro="publisher"/>
          <text macro="issued"/>
        </group>
      </else-if>
      <else>
        <text macro="issued" prefix=", "/>
      </else>
    </choose>
  </macro>
  <macro name="access">
    <group delimiter=", ">
	  <choose>
	    <if type="graphic report" match="any">
      <text macro="archive"/>
	    </if>
	    <else-if type="book thesis chapter article-journal article-newspaper article-magazine" match="none">
      <text macro="archive"/>
	    </else-if>
	  </choose>
      <text variable="URL"/>
    </group>
  </macro>
  <citation>
    <option name="et-al-min" value="4"/>
    <option name="et-al-use-first" value="1"/>
    <option name="et-al-subsequent-min" value="4"/>
    <option name="et-al-subsequent-use-first" value="1"/>
    <option name="disambiguate-add-year-suffix" value="true"/>
    <option name="disambiguate-add-names" value="true"/>
    <option name="disambiguate-add-givenname" value="true"/>
    <layout prefix="" suffix="." delimiter="; ">
      <choose>
        <if position="ibid-with-locator">
          <group delimiter=", ">
            <text term="ibid" text-case="capitalize-first" suffix="."/>
            <text variable="locator"/>
          </group>
        </if>
        <else-if position="ibid">
          <text term="ibid" text-case="capitalize-first" suffix="."/>
        </else-if>
        <else-if position="subsequent">
          <group delimiter=", ">
            <group>
              <text macro="author-short"/>
              <text macro="recipient-short"/>
            </group>
            <text macro="title-short"/>
            <text variable="locator"/>
          </group>
        </else-if>
        <else>
          <group delimiter=", ">
            <group>
              <text macro="author"/>
              <text macro="recipient"/>
            </group>
            <text macro="title"/>
            <text macro="description"/>
            <text macro="translator-article"/>
            <group>
              <text macro="container-prefix"/>
              <text variable="container-title" font-style="italic"/>
            </group>
            <text macro="secondary-contributor"/>
          </group>
          <text macro="locators"/>
          <text variable="collection-title" prefix=", "/>
          <text macro="issue"/>
          <text macro="locators-newspaper" prefix=", "/>
          <text macro="locator"/>
          <text macro="access" prefix=", "/>
        </else>
      </choose>
    </layout>
  </citation>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/ieee', '2008-02-02 00:00:00', 'IEEE',
'<?xml version="1.0" encoding="UTF-8"?>
<?oxygen RNGSchema="http://xbiblio.svn.sourceforge.net/viewvc/*checkout*/xbiblio/csl/schema/trunk/csl.rnc" type="compact"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" xml:lang="en">
  <info>
    <title>IEEE</title>
    <id>http://www.zotero.org/styles/ieee</id>
    <link href="http://www.zotero.org/styles/ieee"/>
    <author>
      <name>Michael Berkowitz</name>
      <email>mberkowi@gmu.edu</email>
    </author>
    <contributor>
      <name>Julian Onions</name>
      <email>julian.onions@gmail.com</email>
    </contributor>
    <category term="engineering"/>
    <category term="generic-base"/>
    <category term="numeric"/>
    <updated>2008-02-02T00:00:00+00:00</updated>
  </info>
  <macro name="author">
    <names variable="author">
      <name initialize-with="." delimiter=", " and="text" name-as-sort-order="all"/>
      <label form="short" prefix=", " text-case="lowercase" suffix="."/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
      </substitute>
    </names>
  </macro>
  <macro name="editor">
    <names variable="editor">
      <name initialize-with="." delimiter=", " and="text" name-as-sort-order="all"/>
      <label form="short" prefix=", " text-case="lowercase" suffix="."/>
    </names>
  </macro>
  <macro name="title">
    <choose>
      <if type="book">
	<text variable="title" font-style="italic"/>
      </if>
      <else>
	<text variable="title" quotes="true"/>
      </else>
    </choose>
  </macro>
  <macro name="publisher">
    <text variable="publisher-place" suffix=": " prefix=" "/>
    <text variable="publisher" suffix=", "/>
    <date variable="issued">
      <date-part name="year"/>
    </date>
  </macro>
  <macro name="access">
      <text variable="URL"/>
  </macro>
  <macro name="page">
    <group> 
      <label variable="page" form="short" suffix=". "/>
      <text variable="page" />
    </group>
  </macro>
  <citation>
    <option name="collapse" value="citation-number"/>
    <sort>
      <key variable="citation-number"/>
    </sort>
    <layout prefix="[" suffix="]" delimiter=",">
      <text variable="citation-number"/>
    </layout>
  </citation>
  <bibliography>
    <option name="et-al-min" value="4"/>
    <option name="et-al-use-first" value="1"/>
    <option name="second-field-align" value="margin"/>
    <layout suffix=".">
      <text variable="citation-number" prefix="[" suffix="]"/>
      <text macro="author" prefix=" " suffix=", "/>
      <choose>
	<if type="book">
	  <group delimiter=", ">
	    <text macro="title"/>
	    <text macro="publisher"/>
	  </group>
	</if>
	<else-if type="chapter">
	  <group delimiter=", "> 
	    <text macro="title"/>
	    <text variable="container-title" font-style="italic"/>
	    <text macro="editor"/>
	    <text macro="publisher" />
	    <text macro="page"/>
	  </group>
	</else-if>
	<else>
	  <group delimiter=", "> 
	    <text macro="title"/>
	    <text variable="container-title" font-style="italic"/>
	    <text variable="volume" prefix=" vol. " />
	    <date variable="issued" >
	      <date-part name="month" form="short" suffix=". "/>
	      <date-part name="year"/>
	    </date>
	    <text macro="page"/>
	  </group>
	</else>
      </choose>
      <text macro="access" prefix="; "/>
    </layout>
  </bibliography>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/harvard1', '2008-02-02 00:00:00', 'Harvard Reference format 1 (Author-Date)',
'<?xml version="1.0" encoding="UTF-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" xml:lang="en" class="in-text" >
  <info>
    <title>Harvard Reference format 1 (Author-Date)</title>
    <id>http://www.zotero.org/styles/harvard1</id>
    <link href="http://www.zotero.org/styles/harvard1"/>
    <author>
      <name>Julian Onions</name>
      <email>julian.onions@gmail.com</email>
    </author>
    <category term="author-date"/>
    <category term="generic-base"/>
    <updated>2008-02-02T00:00:00+00:00</updated>
    <summary>The Harvard author-date style</summary>
    <link href="http://libweb.anglia.ac.uk/referencing/harvard.htm" rel="documentation"/>
  </info>
  <macro name="editor">
    <names variable="editor" delimiter=", ">
      <name and="symbol" initialize-with=". " delimiter=", "/>
      <label form="short" prefix=", " text-case="lowercase" suffix="."/>
    </names>
  </macro>
  <macro name="anon">
    <text term="anonymous" form="short" text-case="capitalize-first"/>
  </macro>
  <macro name="author">
    <names variable="author">
      <name name-as-sort-order="all" and="symbol" sort-separator=", " initialize-with="."
	    delimiter-precedes-last="never" delimiter=", "/>
      <label form="short" prefix=" " suffix="." text-case="lowercase"/>
      <substitute>
	<names variable="editor"/>
	<text macro="anon"/>
      </substitute>
    </names>
  </macro>
  <macro name="author-short">
    <names variable="author">
      <name form="short" and="symbol" delimiter=", " delimiter-precedes-last="never" initialize-with=". "/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
	<text macro="anon"/>
      </substitute>
    </names>
  </macro>
  <macro name="access">
    <group>
      <text value="Available at:" suffix=" "/>
      <text variable="URL"/>
      <group prefix=" [" suffix="]">
	<text term="accessed" text-case="capitalize-first" suffix=" "/>
	<date variable="accessed">
	  <date-part name="month" suffix=" "/>
	  <date-part name="day" suffix=", "/>
	  <date-part name="year"/>
	</date>
      </group>
    </group>
  </macro>
  <macro name="title">
    <choose>
      <if type="book">
	<text variable="title" font-style="italic"/>
      </if>
      <else>
	<text variable="title"/>
      </else>
    </choose>
  </macro>
  <macro name="publisher">
    <group delimiter=": ">
      <text variable="publisher-place"/>
      <text variable="publisher"/>
    </group>
  </macro>
  <macro name="year-date">
    <choose>
      <if variable="issued">
	<date variable="issued">
	  <date-part name="year"/>
	</date>
      </if>
      <else>
	  <text term="no date"/>
      </else>
    </choose>
  </macro>
  <macro name="edition">
    <choose>
      <if is-numeric="edition">
	<group delimiter=" ">
	  <number variable="edition" form="ordinal"/>
	  <text term="edition" form="short" suffix="."/>
	</group>
      </if>
      <else>
	  <text variable="edition" suffix="."/>
      </else>
    </choose>
  </macro>
  <citation>
    <option name="et-al-min" value="4"/>
    <option name="et-al-use-first" value="1"/>
    <option name="et-al-subsequent-min" value="6"/>
    <option name="et-al-subsequent-use-first" value="1"/>
    <option name="disambiguate-add-year-suffix" value="true"/>
    <option name="disambiguate-add-names" value="true"/>
    <option name="disambiguate-add-givenname" value="true"/>
    <option name="collapse" value="year"/>
    <layout prefix="(" suffix=")" delimiter="; ">
      <group delimiter=", ">
	<group delimiter=" ">
	  <text macro="author-short"/>
	  <text macro="year-date"/>
	</group>
	<text variable="locator" prefix="p."/>
      </group>
    </layout>
  </citation>
  <bibliography>
    <option name="hanging-indent" value="true"/>
    <option name="et-al-min" value="4"/>
    <option name="et-al-use-first" value="1"/>
    <sort>
      <key macro="author"/>
      <key variable="title"/>
    </sort>
    <layout>
      <text macro="author" suffix=","/>
      <date variable="issued" prefix=" " suffix=".">
	<date-part name="year"/>
      </date>
      <choose>
	<if type="book">
	  <group prefix=" " delimiter=" " suffix=",">
	    <text macro="title" />
	    <text macro="edition"/>
	    <text macro="editor"/>
	  </group>
	  <text prefix=" " suffix="." macro="publisher"/>
	</if>
	<else-if type="chapter">
	  <text macro="title" prefix=" " suffix="."/>
	  <group class="container" prefix=" ">
	    <text term="in" text-case="capitalize-first"/>
	    <text macro="editor" prefix=" "/>
	    <text variable="container-title" font-style="italic" prefix=" " suffix="."/>
	    <text variable="collection-title" prefix=" " suffix="."/>
	    <group suffix=".">
	      <text macro="publisher" prefix=" "/>
	      <group prefix=", ">
		<text variable="page" prefix="p. "/>
	      </group>
	    </group>
	  </group>
	</else-if>
	<else>
	  <group suffix=".">
	    <text macro="title" prefix=" " />
	    <text macro="editor" prefix=" "/>
	  </group>
	  <group class="container" prefix=" " suffix=".">
	    <text variable="container-title" font-style="italic"/>
	    <group prefix=", ">
	      <text variable="volume" />
	      <text variable="issue" prefix="(" suffix=")"/>
	    </group>
	    <group prefix=", ">
	      <text variable="page" prefix="p."/>
	    </group>
	  </group>
	</else>
      </choose>
      <text prefix=" " macro="access" suffix="."/>
    </layout>
  </bibliography>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/mhra', '2008-02-02 00:00:00', 'Modern Humanities Research Association (Note with Bibliography)',
'<style xmlns="http://purl.org/net/xbiblio/csl" class="note" xml:lang="en"> 
  <info>
    <title>Modern Humanities Research Association (Note with Bibliography)</title>
    <id>http://www.zotero.org/styles/mhra</id>
    <link href="http://www.zotero.org/styles/mhra"/>
    <link href="http://www.mhra.org.uk/Publications/Books/StyleGuide/download.shtml" rel="documentation"/>
    <author>
      <name>Julian Onions</name>
      <email>julian.onions@gmail.com</email>
    </author>
    <category term="history"/>
    <category term="numeric"/>
    <category term="generic-base"/>
    <updated>2008-02-02T00:00:00+00:00</updated>
  </info>
  <macro name="editor-translator">
    <names variable="editor translator" prefix="" suffix="" delimiter=", ">
      <label form="verb-short" prefix=" " text-case="lowercase" suffix=" "/>
      <name and="text" delimiter=", "/>
    </names>
  </macro>
  <macro name="editor-translator-short">
    <names variable="editor translator" prefix="" suffix="" delimiter=", ">
      <label form="short" prefix=" " text-case="lowercase" suffix=". "/>
      <name and="text" delimiter=", "/>
    </names>
  </macro>
  <macro name="author">
    <names variable="author">
      <name name-as-sort-order="first" and="text" sort-separator=", "
	    delimiter=", " delimiter-precedes-last="always"/>
      <label form="short" prefix=", " suffix="."/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
	<text macro="title"/>
      </substitute>
    </names>
  </macro> 
  <macro name="author-full">
    <names variable="author">
      <name name-as-sort-order="all" and="text" sort-separator=", "
	    delimiter=", " delimiter-precedes-last="always"/>
      <label form="short" prefix=", " suffix="."/>
      <substitute>
	<names variable="editor"/>
	<names variable="translator"/>
	<text macro="title"/>
      </substitute>
    </names>
  </macro>
  <macro name="author-short">
    <names variable="author">
      <name form="long" and="text" delimiter=", " />
      <label form="short" prefix=", " suffix="."/>
    </names>
  </macro>
  <macro name="access">
    <group>
      <text variable="URL"/>
      <group prefix=" (" suffix=")" delimiter=" ">
	<text term="accessed" text-case="lowercase" suffix=" "/>
	<date variable="accessed" suffix=", ">
	  <date-part name="month" suffix=" "/>
	  <date-part name="day" suffix=", "/>
	  <date-part name="year"/>
	</date>
      </group>
    </group>
  </macro>
  <macro name="title">
    <choose>
      <if type="thesis">
	<text variable="title" form="long" quotes="true"/>
      </if>
      <else-if type="book">
	<text variable="title" form="long" font-style="italic"/>
      </else-if>
      <else>
	<text variable="title" form="long" quotes="true"/>
      </else>
    </choose>
  </macro>
  <macro name="publisher">
    <group delimiter=": ">
      <text variable="publisher-place"/>
      <text variable="publisher"/>
    </group>
  </macro>
  <macro name="pages">
    <choose>
      <if type="article-journal" match="none">
	<label variable="page" form="short" suffix=". "/>
      </if>
    </choose>
    <text variable="page"/>
  </macro>
  <macro name="locator">
    <label variable="locator" form="short" suffix=". "/>
    <text variable="locator"/>
  </macro>
  <macro name="vols">
    <choose>
      <if variable="number-of-volumes">
	<text variable="number-of-volumes"/>
	<text term="volume" prefix=" " form="short" plural="true"/>
      </if>
    </choose>
  </macro>
  <citation>
    <layout suffix="." delimiter="; ">
      <group suffix="">       
	<text macro="author-short" suffix=", "/>
	<text macro="title" prefix=""/>
	<choose>
	  <if type="thesis">
	    <group prefix=" (" delimiter=", " suffix=")">
	      <text variable="genre"/>
	      <text variable="publisher"/>
	      <date variable="issued">
		<date-part name="year"/>
	      </date>
	    </group>
	  </if>
	  <else-if type="chapter">
	    <group class="container" prefix=", ">
	      <text term="in" text-case="lowercase"/>
	      <text variable="container-title" font-style="italic" prefix=" " suffix=","/>
	      <text variable="collection-title" prefix=" " suffix=","/>
	      <text macro="editor-translator-short"/>
	    </group>
	    <group prefix=" (" suffix=")" delimiter=", ">
	      <text macro="publisher" />
	      <date variable="issued">
		<date-part name="year"/>
	      </date>
	    </group>
	  </else-if>
	  <else-if type="book">
	    <group delimiter=", " prefix=" ">
	      <text macro="editor-translator-short"/>
	      <text variable="collection-title"/>
	      <text variable="edition" suffix=" edn"/>
	      <text macro="vols"/>
	    </group>
	    <group prefix=" (" suffix=")" delimiter=", ">
	      <text macro="publisher"/>
	      <date variable="issued" prefix=" " suffix="">
		<date-part name="year"/>
	      </date>
	    </group>
	    <text variable="volume" prefix=", "/>
	  </else-if>
	  <else-if type="article-newspaper article-magazine" match="any">
	    <group delimiter=", " prefix=", ">
	      <text variable="container-title" font-style="italic"/>
	      <text variable="issue"  suffix="."/>
	      <date variable="issued">
		<date-part name="day" form="numeric" suffix=" "/>
		<date-part name="month" form="long" suffix=" "/>
		<date-part name="year"/>
	      </date>          
	    </group>
	  </else-if>
	  <else-if type="article-journal">
	    <group class="container" prefix=", " delimiter=", ">
	      <text variable="container-title" font-style="italic"/>
	      <text macro="publisher"/>
	      <text variable="volume"  prefix=" "/>
	    </group>
	    <date variable="issued" prefix=" (" suffix=")">
	      <date-part name="year"/>
	    </date>
	  </else-if>
	  <else>
	    <group delimiter=", " prefix=". ">
	      <text variable="container-title" font-style="italic"/>
	      <text variable="issue"  prefix=", " suffix="."/>
	      <date variable="issued">
		<date-part name="month" form="long"/>
		<date-part name="day" form="numeric" prefix=" " suffix=", "/>
		<date-part name="year"/>
	      </date>          
	    </group>
	  </else>
	</choose>
	<group prefix=", " delimiter=" ">
	  <text macro="pages"/>
	  <text macro="locator" prefix="(" suffix=")"/>
	</group>
      </group> 
    </layout>
  </citation> 
  <bibliography>
    <option name="hanging-indent" value="true"/>
    <option name="et-al-min" value="6"/>
    <option name="et-al-use-first" value="6"/>
    <option name="subsequent-author-substitute" value="---"/>
    <sort>
      <key macro="author"/>
      <key variable="title"/>
    </sort>
    <layout suffix=".">
      <text macro="author" suffix=","/>
      <choose>
	<if type="thesis">
	  <group suffix=".">
	    <text macro="title" prefix=" "/>
	  </group>
	  <group delimiter=", " prefix=" ">
	    <text variable="genre"/>
	    <text variable="publisher"/>
	    <date variable="issued">
	      <date-part name="year"/>
	    </date>
	  </group>
	</if>
	<else-if type="chapter">
	  <text macro="title" prefix=" "/>
	  <group class="container" prefix=", ">
	    <text term="in" text-case="lowercase"/>
	    <text variable="container-title" font-style="italic" prefix=" " suffix=","/>
	    <text variable="collection-title" prefix=" " suffix=","/>
	    <text macro="editor-translator-short"/>
	  </group>
	  <group prefix=" (" suffix=")" delimiter=", ">
	    <text macro="publisher" />
	    <date variable="issued">
	      <date-part name="year"/>
	    </date>
	  </group>
	</else-if>
	<else-if type="article-journal">
	  <group suffix=".">
	    <text macro="title" prefix=" "/>
	    <text macro="editor-translator" prefix=" "/>
	  </group>
	  <group class="container" prefix=" " suffix="">
	    <text variable="container-title" font-style="italic" prefix=" "/>
	    <text variable="volume"  prefix=" "/>
	    <text variable="issue" prefix=", no. "/>
	    <date variable="issued" prefix=" (" suffix=")">
	      <date-part name="month" suffix=" "/>
	      <date-part name="day" suffix=", "/>
	      <date-part name="year"/>
	    </date>
	    <text variable="page" prefix=": "/>
	  </group>
	</else-if>
	<else-if type="article-newspaper article-magazine" match="any">
	  <group suffix=".">
	    <text macro="title" prefix=" "/>
	    <text macro="editor-translator" prefix=" "/>
	  </group>
	  <group delimiter=", " prefix=" ">
	    <text variable="container-title" font-style="italic"/>
	    <text variable="issue"  suffix="."/>
	    <date variable="issued">
	      <date-part name="month" form="long"/>
	      <date-part name="day" form="numeric" prefix=" " suffix=", "/>
	      <date-part name="year"/>
	    </date>          
	  </group>
	</else-if>
	<else-if type="paper-conference">
	  <group suffix=".">
	    <text macro="title" prefix=" "/>
	    <text macro="editor-translator" prefix=" "/>
	  </group>
	  <group suffix="">
	    <text value="paper presented at" text-case="capitalize-first"/>
	    <text variable="event" prefix=" "/>
	    <text variable="event-place"  prefix=", "/>
	    <date variable="event">
	      <date-part name="month" form="long"/>
	      <date-part name="day" form="numeric" prefix=" " suffix=", "/>
	      <date-part name="year"/>
	    </date>          
	  </group>
	</else-if>
	<else-if type="book">
	  <group suffix=".">
	    <text macro="title" prefix=" " suffix="."/>
	  </group>
	  <group delimiter=", " prefix=" ">
	    <text macro="editor-translator-short"/>
	    <text variable="collection-title"/>
	    <text variable="edition" suffix=" edn"/>
	    <text macro="vols"/>
	  </group>
	  <group prefix=" (" suffix=")" delimiter=", ">
	    <text macro="publisher"/>
	    <date variable="issued" prefix=" " suffix="">
	      <date-part name="year"/>
	    </date>
	  </group>
	  <text variable="volume" prefix=", "/>
	</else-if>
	<else>
	  <group suffix=".">
	    <text macro="title" prefix=" "/>
	    <text macro="editor-translator" prefix=" "/>
	  </group>
	  <group class="container" prefix=" " suffix="">
	    <text variable="container-title" font-style="italic"/>
	    <group prefix=", ">
	      <text variable="volume" font-style="italic"/>
	      <text variable="issue" prefix="(" suffix=")"/>
	    </group>
	    <text variable="page" prefix=", "/>
	  </group>
	</else>
      </choose>
      <text prefix=" " macro="access"/>
    </layout>
  </bibliography>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/mhra_note_without_bibliography', '2008-02-02 00:00:00', 'Modern Humanities Research Association (Note without Bibliography)',
'<?xml version="1.0" encoding="UTF-8"?>
<?oxygen RNGSchema="csl.rnc" type="compact"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="note">
    <info>
        <title>Modern Humanities Research Association (Note without Bibliography)</title>
        <id>http://www.zotero.org/styles/mhra_note_without_bibliography</id>
        <link href="http://www.zotero.org/styles/mhra_note_without_bibliography"/>
        <summary>Bibliography style for the Modern Humanities Research Association</summary>
        <author>
            <name>Jim Safley</name>
            <email>jsafley@gmu.edu</email>
        </author>
        <updated>2008-02-02T00:00:00+00:00</updated>
    </info>
    <defaults>
        <et-al min-authors="4" use-first="1" term-name="and-others"></et-al>
        <author name-as-sort-order="no">
            <name and="text" delimiter=", " delimiter-precedes-last="always"></name>
            <substitute>
                <choose>
                    <editor></editor>
                    <translator></translator>
                    <titles></titles>
                </choose>
            </substitute>
        </author>
        <contributor name-as-sort-order="no">
            <label suffix=" " form="verb"></label>
            <name and="text" delimiter=", "></name>
        </contributor>
        <locator>
            <number></number>
        </locator>
        <pages>
            <label suffix=". " form="short" ></label>
            <number></number>
        </pages>
        <identifier>
            <number></number>
        </identifier>
        <titles>
            <title></title>
        </titles>
        <date>
            <year></year>
        </date>
        <publisher>
            <place suffix=": "></place>
            <name></name>
        </publisher>
        <access>
            <url prefix=" &lt;" suffix="&gt; "></url>
            <text prefix=" [" suffix=" " term-name="accessed"></text>
            <date suffix="]">
                <day suffix=" "></day>
                <month suffix=" " text-case="capitalize-first"></month>
                <year></year>
            </date>
        </access>
    </defaults>
    <citation suffix="." delimiter="; ">
        <layout>
            <item>
                <choose>
                    <type name="book">
                        <author></author>
                        <titles prefix=", " font-style="italic"></titles>
                        <editor prefix=", "></editor>
                        <translator prefix=", "></translator>
                        <titles prefix=" " relation="collection"></titles><!-- this line should print out Zoteros "Series", but it does not -->
                        <!-- this line should be Zoteros "Series Number", what CSL element matches it? -->
                        <edition prefix=", "></edition>
                        <text prefix=" " term-name="edn"></text>
                        <!-- this line should be Zoteros "# of Volumes", what CSL element matches it? -->
                        <group prefix=" (" suffix=")">
                            <publisher></publisher>
                            <date prefix=", ">
                                <year></year>
                            </date>
                        </group>
                        <volume prefix=", "></volume>
                        <access prefix=" "></access>
                    </type>
                    <type name="chapter">
                        <author></author>
                        <titles prefix=", " font-style="italic"></titles>
                        <text prefix=", " term-name="in"></text>
                        <titles prefix=" " relation="container" font-style="italic"/>
                        <editor prefix=", "></editor>
                        <translator prefix=", "></translator>
                        <titles prefix=" " relation="collection"></titles><!-- this line should print out Zoteros "Series", but it does not -->
                        <!-- this line should be Zoteros "Series Number", what CSL element matches it? -->
                        <edition prefix=", "></edition>
                        <text prefix=" " term-name="edn"></text> <!-- this line should print out "edn" -->
                        <!-- this line should be Zoteros "# of Volumes", what CSL element matches it? -->
                        <group prefix=" (" suffix=")">
                            <publisher></publisher>
                            <date prefix=", ">
                                <year></year>
                            </date>
                        </group>
                        <volume prefix=", "></volume>
                        <pages prefix=", "></pages>
                        <access prefix=" "></access>
                    </type>
                    <type name="article">
                        <author></author>
                        <titles prefix=", " quotes="true"></titles>
                        <titles prefix=", " relation="container" font-style="italic"/>
                        <date prefix=", ">
                            <day suffix=" "></day>
                            <month suffix=" " text-case="capitalize-first"></month>
                            <year></year>
                        </date>
                        <pages prefix=", "></pages>
                        <access prefix=" "></access>
                    </type>
                    <type name="article-journal">
                        <author></author>
                        <titles prefix=", " quotes="true"></titles>
                        <titles prefix=", " relation="container" font-style="italic"/>
                        <volume prefix=", "></volume>
                        <issue prefix="."></issue>
                        <date prefix=" (" suffix=")"></date>
                        <pages prefix=", ">
                            <number></number>
                        </pages>
                        <access prefix=" "></access>
                    </type>
                </choose>
            </item>
        </layout>
    </citation>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/mla', '2008-02-02 00:00:00', 'Modern Language Association',
'<?xml version="1.0" encoding="UTF-8"?>
<?oxygen RNGSchema="http://xbiblio.svn.sourceforge.net/viewvc/*checkout*/xbiblio/csl/schema/trunk/csl.rnc" type="compact"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" xml:lang="en">
  <info>
    <title>Modern Language Association</title>
    <id>http://www.zotero.org/styles/mla</id>
    <link href="http://www.zotero.org/styles/mla"/>
    <author>
      <name>Simon Kornblith</name>
      <email>simon@simonster.com</email>
    </author>
    <category term="generic-base"/>
    <category term="author-date"/>
    <updated>2008-02-02T00:00:00+00:00</updated>
  </info>
  <macro name="editor-translator">
    <names variable="editor translator" delimiter=". ">
      <label form="verb-short" text-case="capitalize-first" suffix=". "/>
      <name and="symbol" delimiter=", "/>
    </names>
  </macro>
  <macro name="author">
    <names variable="author">
      <name name-as-sort-order="first" and="text" sort-separator=", "
        delimiter=", " delimiter-precedes-last="always"/>
      <label form="short" prefix=", " suffix="."/>
      <substitute>
        <names variable="editor"/>
        <names variable="translator"/>
        <text macro="title"/>
      </substitute>
    </names>
  </macro>
  <macro name="author-short">
    <names variable="author">
      <name form="short" and="symbol" delimiter=", " initialize-with=". "/>
      <substitute>
        <names variable="editor"/>
        <names variable="translator"/>
        <text macro="title-short"/>
      </substitute>
    </names>
  </macro>
  <macro name="access">
    <group delimiter=" ">
      <date variable="accessed">
		<date-part name="day" suffix=" "/>
		<date-part name="month" form="short" include-period="true" suffix=" "/>
		<date-part name="year"/>
      </date>
      <text variable="URL" prefix="&lt;" suffix="&gt;"/>
    </group>
  </macro>
  <macro name="title">
    <choose>
      <if type="book">
        <text variable="title" text-decoration="underline"/>
      </if>
      <else>
        <text variable="title" quotes="true"/>
      </else>
    </choose>
  </macro>
  <macro name="title-short">
    <choose>
      <if type="book">
        <text variable="title" form="short" text-decoration="underline"/>
      </if>
      <else>
        <text variable="title" form="short" quotes="true"/>
      </else>
    </choose>
  </macro>
  <macro name="publisher-year">
    <group delimiter=", ">
      <group delimiter=": ">
        <text variable="publisher-place"/>
        <text variable="publisher"/>
      </group>
      <date variable="issued">
        <date-part name="year"/>
      </date>
    </group>
  </macro>
  <citation>
    <option name="et-al-min" value="4"/>
    <option name="et-al-use-first" value="1"/>
    <option name="disambiguate-add-names" value="true"/>
    <option name="disambiguate-add-givenname" value="true"/>
    <layout prefix="(" suffix=")" delimiter="; ">
      <group delimiter=" ">
        <choose>
          <if variable="author editor translator" match="any">
            <group delimiter=", ">
          <text macro="author-short"/>
          <choose>
            <if disambiguate="true">
              <text macro="title-short"/>
            </if>
          </choose>
            </group>
          </if>
          <else>
            <text macro="title-short"/>
          </else>
        </choose>
        <text variable="locator"/>
      </group>
    </layout>
  </citation>
  <bibliography>
    <option name="hanging-indent" value="true"/>
    <option name="et-al-min" value="4"/>
    <option name="et-al-use-first" value="1"/>
    <option name="line-spacing" value="2"/>
    <sort>
      <key macro="author"/>
      <key variable="title"/>
    </sort>
    <layout>
      <text macro="author" suffix="."/>
      <text macro="title" prefix=" " suffix="."/>
      <choose>
        <if type="book">
          <text macro="editor-translator" prefix=" " suffix="."/>
          <text macro="publisher-year"  prefix=" " suffix="."/>
        </if>
        <else-if type="chapter">
          <group class="container">
            <text variable="container-title" text-decoration="underline" prefix=" " suffix="."/>
            <text macro="editor-translator" prefix=" " suffix="."/>
            <text macro="publisher-year"  prefix=" " suffix="."/>
          </group>
          <text variable="page" prefix=" " suffix="."/>
        </else-if>
        <else>
          <group class="container" prefix=" " suffix="." delimiter=": ">
            <group delimiter=" ">
              <text macro="editor-translator" suffix="."/>
              <text variable="container-title" text-decoration="underline"/>
              <choose>
                <if type="article-journal">
                  <group delimiter=" ">
                    <group delimiter=".">
                      <text variable="volume"/>
                      <text variable="issue"/>
                    </group>
                    <date variable="issued" prefix="(" suffix=")">
                      <date-part name="year"/>
                    </date>
                  </group>
                </if>
                <else>
                  <date variable="issued">
                    <date-part name="day" suffix=" "/>
                    <date-part name="month" form="short" include-period="true" suffix=" "/>
                    <date-part name="year"/>
                  </date>
                </else>
              </choose>
            </group>
            <text variable="page"/>
          </group>
        </else>
      </choose>
      <text prefix=" " suffix="." macro="access"/>
    </layout>
  </bibliography>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/nature', '2008-02-02 00:00:00', 'Nature Journal',
'<?xml version="1.0" encoding="UTF-8"?>
<?oxygen RNGSchema="http://xbiblio.svn.sourceforge.net/viewvc/*checkout*/xbiblio/csl/schema/trunk/csl.rnc" type="compact"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" xml:lang="en">
    <info>
        <title>Nature Journal</title>
        <id>http://www.zotero.org/styles/nature</id>
        <link href="http://www.zotero.org/styles/nature"/>
        <author>
            <name>Michael Berkowitz</name>
            <email>mberkowi@gmu.edu</email>
        </author>
        <category term="biology"/>
        <category term="generic-base"/>
        <category term="numeric"/>
        <updated>2008-02-02T00:00:00+00:00</updated>
    </info>
    <macro name="author">
        <names variable="author">
            <name sort-separator=", " delimiter=", " and="symbol" initialize-with="." delimiter-precedes-last="never" name-as-sort-order="all"/>
        </names>
    </macro>
	<macro name="access">
		<choose>
			<if variable="volume"/>
			<else-if variable="DOI">
				<text variable="DOI" prefix="doi:"/>
			</else-if>
			<else-if variable="URL">
				<text term="at"/>
				<text variable="URL" prefix=" &lt;" suffix="&gt;"/>
			</else-if>
		</choose>
	</macro>
	<citation>
		<option name="collapse" value="citation-number"/>
		<sort>
			<key variable="citation-number"/>
		</sort>
		<layout vertical-align="sup" delimiter=",">
			<text variable="citation-number"/>
		</layout>
	</citation>
    <bibliography>
        <option name="et-al-min" value="4"/>
        <option name="et-al-use-first" value="1"/>
        <option name="second-field-align" value="true"/>
        <option name="entry-spacing" value="0"/>
        <layout>
            <text variable="citation-number" suffix=". "/>
            <text macro="author"/>
            <text variable="title" prefix=" " suffix=". "/>
            <text variable="container-title" font-style="italic" suffix=" "/>
            <text variable="volume" suffix=", " font-weight="bold"/>
            <text variable="page"/>
            <text macro="access"/>
            <date prefix=" (" suffix=")." variable="issued">
                <date-part name="year"/>
            </date>
        </layout>
    </bibliography>
</style>
');

REPLACE INTO csl VALUES ('http://www.zotero.org/styles/nlm', '2008-02-02 00:00:00', 'National Library of Medicine',
'<?xml version="1.0" encoding="UTF-8"?>
<?oxygen RNGSchema="http://xbiblio.svn.sourceforge.net/viewvc/*checkout*/xbiblio/csl/schema/trunk/csl.rnc" type="compact"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" xml:lang="en">
  <info>
    <title>National Library of Medicine</title>
    <id>http://www.zotero.org/styles/nlm</id>
    <link href="http://www.zotero.org/styles/nlm"/>
    <author>
      <name>Michael Berkowitz</name>
      <email>mberkowi@gmu.edu</email>
    </author>
    <category term="generic-base"/>
    <category term="numeric"/>
    <updated>2008-02-02T00:00:00+00:00</updated>
  </info>
  <macro name="author">
    <names variable="author" suffix=". ">
      <name sort-separator=" " initialize-with="" name-as-sort-order="all" delimiter=", " delimiter-precedes-last="always"/>
    </names>
  </macro>
  <macro name="editor">
    <names variable="editor" suffix=", editor(s). ">
      <name sort-separator=" " initialize-with="" name-as-sort-order="all" delimiter=", " delimiter-precedes-last="always"/>
    </names>
  </macro>
  <macro name="publisher">
    <text variable="publisher-place" suffix=": "/>
    <text variable="publisher" suffix="; "/>
    <date variable="issued">
      <date-part name="year" suffix=". "/>
    </date>
  </macro>
  <macro name="access">
    <group delimiter=" ">
      <group prefix="[" suffix="]" delimiter=" ">
	<text term="cited" text-case="lowercase"/>
	<date variable="accessed" suffix=" ">
	  <date-part name="year"/>
	  <date-part name="month" prefix=" " form="short"/>
	  <date-part name="day" prefix=" "/>
	</date>
      </group>
      <group>
	<text value="Available from: "/>
	<text variable="URL"/>
      </group>
    </group>
  </macro>
  <macro name="title">
    <group delimiter=" ">
      <text variable="title"/>
      <choose>
	<if variable="URL">
	  <text term="internet" prefix="[" suffix="]" text-case="capitalize-first"/>
	</if>
      </choose>
    </group>
  </macro>
  <macro name="edition">
    <choose>
      <if is-numeric="edition">
	<group delimiter=" ">
	  <number variable="edition" form="ordinal"/>
	  <text term="edition" form="short" suffix="."/>
	</group>
      </if>
      <else>
	  <text variable="edition" suffix="."/>
      </else>
    </choose>
  </macro>
  <citation>
    <option name="collapse" value="citation-number"/>
    <sort>
      <key variable="citation-number"/>
    </sort>
    <layout prefix="(" suffix=")" delimiter="; ">
      <text variable="citation-number"/>
    </layout>
  </citation>
  <bibliography>
    <option name="et-al-min" value="7"/>
    <option name="et-al-use-first" value="6"/>
    <option name="second-field-align" value="true"/>
    <layout>
      <text variable="citation-number" suffix=". "/>
      <text macro="author"/>
      <text macro="title" suffix=". "/>
      <choose>
	<if type="book">
	  <text macro="edition" prefix=" " suffix=" "/>
	  <text macro="publisher" prefix=" "/>
	</if>
	<else-if type="chapter">
	  <group prefix=" " suffix=". ">
	    <text term="in" suffix=": " text-case="capitalize-first"/>
	    <text macro="editor"/>
	    <text variable="container-title"/>
	  </group>
	  <text macro="publisher" prefix=" "/>
	  <text variable="page" prefix=" p. " suffix="."/>
	</else-if>
	<else>
	  <text variable="container-title" suffix=". " form="short"/>
	  <date variable="issued" suffix=";">
	    <date-part name="year" suffix=" "/>
	    <date-part name="month" form="short" suffix=" "/>
	    <date-part name="day"/>
	  </date>
	  <text variable="volume"/>
	  <text variable="issue" prefix="(" suffix="):"/>
	  <text variable="page" suffix="."/>
	</else>
      </choose>
      <text macro="access"/>
    </layout>
  </bibliography>
</style>
');
