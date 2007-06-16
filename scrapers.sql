-- 236

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
REPLACE INTO version VALUES ('repository', STRFTIME('%s', '2007-06-16 17:20:00'));

REPLACE INTO translators VALUES ('96b9f483-c44d-5784-cdad-ce21b984fe01', '1.0.0b4.r1', '', '2007-03-21 15:26:54', '1', '100', '4', 'Amazon.com', 'Sean Takats', '^https?://(?:www\.)?amazon', 
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
			availableItems[i] = searchTitle;
			var asinMatch = asinRe.exec(link);
			asins[i] = asinMatch[2];
			Zotero.debug(searchTitle + " @ " + asins[i]);
			i++;
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
		Zotero.debug(text);

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
			newItem.creators.push(Zotero.Utilities.cleanAuthor(xml..Author[i].text().toString()));
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
			newItem.extra =  newItem.pages = Zotero.Utilities.cleanString(xml..OriginalReleaseDate[0].text().toString());
		}
		
		newItem.title = title;
		newItem.complete();			
	}, function() {Zotero.done();}, null);
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('aee2323e-ce00-4fcc-a949-06eb1becc98f', '1.0.0b4r1', '', '2007-06-15 20:00:00', '0', '100', '4', 'Epicurious', 'Sean Takats', '^https?://www\.epicurious\.com/recipes/(?:find/results|recipe_views/views/)', 
'function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
		} : null;
		
	var xpath = ''//div[@class="recipeDetailLeftDiv"][@id="ingredients"]'';
	var multxpath = ''//div[@id="left"]/table[@class="searchresults"]/tbody/tr'';

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

	xpath = ''//div[@id="sourceInfo"]/p[@class="source"]'';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if (elmt = elmts.iterateNext()){
		var authordate = elmt.textContent;
		var authordates = authordate.split(",");
		newItem.creators.push(Zotero.Utilities.cleanAuthor(authordates[0], "contributor", true));
		newItem.date = authordates[1];
		while (elmt = elmts.iterateNext()){
		 	Zotero.debug("looping?");
		 	Zotero.debug(elmt.textContent);
			newItem.creators.push(Zotero.Utilities.cleanAuthor(elmt.textContent, "contributor", false));
		}
	}
		
	xpath = ''//div[@class="recipeDetailLeftDiv"][@id="intro"]/p'';
	if (elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var abstract = elmt.textContent;
		abstract = Zotero.Utilities.cleanString(abstract);
		newItem.abstractNote = abstract;		
	}

	xpath = ''//div[@class="recipeDetailLeftDiv"][@id="ingredients"]'';
	if (elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var ingredients = elmt.textContent;
		ingredients = Zotero.Utilities.superCleanString(ingredients);
		ingredients = cleanText(ingredients);
	}
	xpath = ''//div[@class="recipeDetailLeftDiv"][@id="preparation"]'';
	if (elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var prep = elmt.textContent;
		prep = Zotero.Utilities.superCleanString(prep);
		prep = cleanText(prep);
		prep = prep.replace(/\n/g, "\n\n");
	}
	xpath = ''//div[@id="servingInfo"]'';
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
	
	var snapshotURL = url.replace("/views/", "/printer_friendly/");
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

	var singxpath = ''//div[@class="recipeDetailLeftDiv"][@id="ingredients"]'';
	var multxpath = ''//div[@id="left"]/table[@class="searchresults"]/tbody/tr'';
	if(doc.evaluate(singxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		// single recipe page
		scrape(doc, url);
	} else if (doc.evaluate(multxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		var items = new Object();
		var elmtxpath = ''//div[@id="left"]/table[@class="searchresults"]/tbody/tr/td[@class="pd2"]/a[@class="hed"]'';
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

REPLACE INTO translators VALUES ('0dda3f89-15de-4479-987f-cc13f1ba7999', '1.0.0b3r1', '', '2007-06-16 17:20:00', '0', '100', '4', 'Ancestry.com US Federal Census', 'Elena Razlogova', '^https?://search.ancestry.com/(.*)usfedcen|1890orgcen', 
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
	var info = doc.evaluate(''//div[@class="g_container"]/div[@class="g_panelWrap"]/div[@class="g_panelCore"]/div[@class="g_right"]/div[@class="g_box"]/p/a'', 
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
		if (year == 1890) {
			var yearDb = "1890orgcen";
		} else { var yearDb = year+"usfedcen"; }
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
	var snapshotRe = /recid=([0-9]+)/;
	var m = snapshotRe.exec(doc.location.href);
	if(m) {
		snapshotURL = "http://search.ancestry.com/cgi-bin/sse.dll?db="+yearDb+"&indiv=1&pf=1&recid="+m[1];
		newItem.attachments.push({title:"Ancestry.com Snapshot", mimeType:"text/html", url:snapshotURL, snapshot:true});
		cleanURL = "http://search.ancestry.com/cgi-bin/sse.dll?indiv=1&db="+yearDb+"&recid="+m[1];
		newItem.url = cleanURL;
	}
			
	// add particular individual being surveyed as contributor - this is not proper citation but is needed so one could easily scan for names in middle pane
	var creator = new Array();
	creator.firstName = firstName;
	creator.lastName = lastName;
	creator.creatorType = "contributor";
	newItem.creators.push(creator);
	
	//add proper author for citation
	var creator = new Array();
	creator.lastName = "United States of America, Bureau of the Census";
	creator.creatorType = "author";
	newItem.creators.push(creator);

	// get scan of the census image
	var scanInfo = doc.evaluate(''//div[@class="g_container"]/div[@class="g_panelWrap"]/div[@class="g_panelCore"]/div[@class="g_main"]/div[@class="g_outerBox"]/div[@class="s_container"]/div[@class="g_box2"]/table[@class="p_recTable"]/tbody/tr/td[2][@class="recordTN"]/a'', 
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
		
		//select items
		var items = new Array();
		var listElts = doc.evaluate(''//div[@class="g_container"]/div[@class="g_panelWrap"]/div[@class="g_panelCore"]/div[@class="s_container"]/div[@class="p_rsltList"]/table/tbody/tr[@class="tblrowalt record"] | //div[@class="g_container"]/div[@class="g_panelWrap"]/div[@class="g_panelCore"]/div[@class="s_container"]/div[@class="p_rsltList"]/table/tbody/tr[@class="tblrow record"]'', 
				doc, nsResolver, XPathResult.ANY_TYPE, null);
		var recid;
		var link;
		var name;
		while (listElt = listElts.iterateNext()) {		
			recInfo = doc.evaluate(''.//a'', listElt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			var recidRe = /^javascript:go[0-9]+_([0-9]+)/;
			var m = recidRe.exec(recInfo);
			if(m) {
				recid = m[1];
			}
			link = "http://search.ancestry.com/cgi-bin/sse.dll?indiv=1&db="+year+"usfedcen&recid="+recid;
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

REPLACE INTO translators VALUES ('838d8849-4ffb-9f44-3d0d-aa8a0a079afe', '1.0.0b3.r1', '', '2007-03-24 22:20:00', 1, 100, 4, 'OCLC WorldCat FirstSearch', 'Simon Kornblith', '^https?://(?:new)?firstsearch\.oclc\.org[^/]*/WebZ/',
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
	});
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

REPLACE INTO translators VALUES ('88915634-1af6-c134-0171-56fd198235ed', '1.0.0b3.r1', '', '2007-05-31 20:00:00', 1, 100, 4, 'Library Catalog (Voyager)', 'Simon Kornblith', 'Pwebrecon\.cgi',
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
		
		var tableRows = doc.evaluate(''/html/body/form/table/tbody/tr[td/input[@type="checkbox"]]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
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

REPLACE INTO translators VALUES ('d921155f-0186-1684-615c-ca57682ced9b', '1.0.0b4.r1', '', '2007-03-28 16:00:00', 1, 100, 4, 'JSTOR', 'Simon Kornblith', '^https?://(?:www\.|ocrpdf-sandbox\.)jstor\.org[^/]*/(?:view|browse/[^/]+/[^/]+\?|search/|cgi-bin/jstor/viewitem)', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	// See if this is a seach results page
	if(doc.title == "JSTOR: Search Results" || url.indexOf("/browse/") != -1) {
		return "multiple";
	} else if(url.indexOf("/search/") != -1) {
		return false;
	}
	
	// If this is a view page, find the link to the citation
	var xpath = ''/html/body/div[@class="indent"]//a[@class="nav"]'';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if(elmts.iterateNext()) {
		return "journalArticle";
	}
}',
'function getJSTORAttachment(viewURL) {
	var viewRe = new RegExp("(^https?://[^/]+/)view([^?]+)");
	var m = viewRe.exec(viewURL);
	if(m) {
		return {url:m[1]+"cgi-bin/jstor/printpage"+m[2]+".pdf?dowhat=Acrobat",
		        mimeType:"application/pdf", title:"JSTOR Full Text PDF"};
	} else {
		return false;
	}
}

function itemComplete(newItem, url) {
	if(newItem.url) {
		newItem.attachments.push({url:newItem.url, mimeType:"text/html",
			                      title:"JSTOR Link", snapshot:false});
	} else {
		if(newItem.ISSN) {
			newItem.url = "http://www.jstor.org/browse/"+newItem.ISSN;
		} else {
			newItem.url = url;
		}
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	var saveCitations = new Array();
	var viewPages = new Array();
	
	if(doc.title == "JSTOR: Search Results") {
		var availableItems = new Object();
		
		// Require link to match this
		var tagRegexp = new RegExp();
		tagRegexp.compile(''citationAction='');
		
		var tableRows = doc.evaluate(''//tr[td/span[@class="printDownloadSaveLinks"]]'', doc, nsResolver, XPathResult.ANY_TYPE, null);		
		var tableRow;
		// Go through table rows
		var tableView = new Array();
		var tableSave = new Array();
		var i = 0;
		while(tableRow = tableRows.iterateNext()) {
			i++;
			var links = tableRow.getElementsByTagName("a");
			// Go through links
			for(var j=0; j<links.length; j++) {
				if(links[j].href.indexOf("citationAction=") != -1) {
					tableSave[i] = links[j].href;
					var link = doc.evaluate(''.//a[strong]'', tableRow, null, XPathResult.ANY_TYPE, null).iterateNext();
					if(link) {
						tableView[i] = link.href;
					}
					
					var text = doc.evaluate(''.//strong/text()'', tableRow, null, XPathResult.ANY_TYPE, null).iterateNext();
					if(text && text.nodeValue) {
						text = Zotero.Utilities.cleanString(text.nodeValue);
						if(availableItems[i]) {
							availableItems[i] += " "+text;
						} else {
							availableItems[i] = text;
						}
					}
				}
			}
		}
		
		var items = Zotero.selectItems(availableItems);
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			viewPages.push(tableView[i]);
			saveCitations.push(tableSave[i].replace(''citationAction=remove'', ''citationAction=save''));
		}
	} else if(url.indexOf("/browse/") != -1) {
		var tableView = new Object();
		var items = new Object();
		
		var articleTitle, viewPage;
		var links = doc.evaluate("//a", doc, nsResolver, XPathResult.ANY_TYPE, null);
		var link;
		// get article and save citation links
		while(link = links.iterateNext()) {
			if(link.href.indexOf("/view/") != -1) {
				articleTitle = link.textContent;
				viewPage = link.href;
			} else if(link.href.indexOf("citationAction=") != -1) {
				items[link.href] = articleTitle;
				tableView[link.href] = viewPage;
			}
		}
		
		var items = Zotero.selectItems(items);
		if(!items) return true;
		
		for(var i in items) {
			viewPages.push(tableView[i]);
			saveCitations.push(i.replace(''citationAction=remove'', ''citationAction=save''));
		}
	} else {
		// If this is a view page, find the link to the citation
		var xpath = ''/html/body/div[@class="indent"]//a[@class="nav"]'';
		var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var saveCitation = elmts.iterateNext();
		var viewSavedCitations = elmts.iterateNext();
		
		if(saveCitation && viewSavedCitations) {
			viewPages.push(url);
			saveCitations.push(saveCitation.href.replace(''citationAction=remove'', ''citationAction=save''));
		} else {
			throw("Could not find citation save links");
		}
	}
	
	Zotero.Utilities.HTTP.doGet(''http://www.jstor.org/browse?citationAction=removeAll&confirmRemAll=on&viewCitations=1'', function() {	// clear marked
		// Mark all our citations
		Zotero.Utilities.HTTP.doGet(saveCitations, null, function() {						// mark this
			Zotero.Utilities.HTTP.doGet(''http://www.jstor.org/browse/citations.txt?exportAction=Save+as+Text+File&exportFormat=cm&viewCitations=1'', function(text) {
																							// get marked
				var k = 0;
				var lines = text.split("\n");
				var haveStarted = false;
				var newItemRe = /^<[0-9]+>/;
				
				var newItem = new Zotero.Item("journalArticle");
				newItem.attachments.push(getJSTORAttachment(viewPages[k]));
				
				for(var i in lines) {
					if(lines[i].substring(0,3) == "<1>") {
						haveStarted = true;
					} else if(newItemRe.test(lines[i])) {
						itemComplete(newItem, url);
						k++;
						
						newItem = new Zotero.Item("journalArticle");
						newItem.attachments.push(getJSTORAttachment(viewPages[k]));
					} else if(lines[i].substring(2, 5) == " : " && haveStarted) {
						var fieldCode = lines[i].substring(0, 2);
						var fieldContent = Zotero.Utilities.cleanString(lines[i].substring(5))
						
						if(fieldCode == "TI") {
							if(fieldContent) {
								newItem.title = fieldContent;
							} else {
								newItem.title = "[untitled]";
							}
						} else if(fieldCode == "AU") {
							var authors = fieldContent.split(";");
							for(j in authors) {
								if(authors[j]) {
									newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j], "author", true));
								}
							}
						} else if(fieldCode == "SO") {
							newItem.publicationTitle = fieldContent;
						} else if(fieldCode == "VO") {
							newItem.volume = fieldContent;
						} else if(fieldCode == "NO") {
							newItem.issue = fieldContent;
						} else if(fieldCode == "SE") {
							newItem.series = fieldContent;
						} else if(fieldCode == "DA") {
							newItem.date = fieldContent;
						} else if(fieldCode == "PP") {
							newItem.pages = fieldContent;
						} else if(fieldCode == "EI") {
							newItem.url = fieldContent;
						} else if(fieldCode == "IN") {
							newItem.ISSN = fieldContent;
						} else if(fieldCode == "PB") {
							newItem.publisher = fieldContent;
						} else if(fieldCode == "AB") {
							newItem.abstractNote = fieldContent;
						}
					}
				}
				
				// last item is complete
				if(haveStarted) {
					itemComplete(newItem, url);
				}
				
				Zotero.Utilities.HTTP.doGet(''http://www.jstor.org/browse?citationAction=removeAll&confirmRemAll=on&viewCitations=1'', function() {	// clear marked
					Zotero.done();
				});
			});
		});
	});
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('e85a3134-8c1a-8644-6926-584c8565f23e', '1.0.0b3.r1', '', '2007-03-24 22:20:00', 1, 100, 4, 'History Cooperative', 'Simon Kornblith', '^https?://www\.historycooperative\.org[^/]*/(?:journals/.+/.+/.+\.s?html$|cgi-bin/search.cgi)', 
'function detectWeb(doc, url) {
	if(doc.title == "History Cooperative: Search Results") {
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
	newItem.title = m[1];
	
	associateMeta(newItem, metaTags, "Journal", "publicationTitle");
	associateMeta(newItem, metaTags, "Volume", "volume");
	associateMeta(newItem, metaTags, "Issue", "issue");
	
	var author = metaTags.namedItem("Author");
	if(author) {
		var authors = author.getAttribute("content").split(" and ");
		for(j in authors) {
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
	if(doc.title == "History Cooperative: Search Results") {
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

REPLACE INTO translators VALUES ('4fd6b89b-2316-2dc4-fd87-61a97dd941e8', '1.0.0b3.r1', '', '2007-05-18 23:00:00', '1', '100', '4', 'Library Catalog (InnoPAC)', 'Simon Kornblith', '^https?://[^/]+/(?:search\??/|record=)', 
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
	
	var xpath = ''//a[img[@src="/screens/marcdisp.gif" or @alt="MARC Display" or @src="/screens/regdisp.gif" or @alt="REGULAR RECORD DISPLAY"]]'';
	var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(elmt) {
		return "book";
	}
	// Also, check for links to an item display page
	var tags = doc.getElementsByTagName("a");
	for(var i=0; i<tags.length; i++) {
		if(matchRegexp.test(tags[i].href)) {
			return "multiple";
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
	var elmts = newDoc.evaluate(xpath, newDoc, nsResolver,
			   XPathResult.ANY_TYPE, null);
	var elmt;
	
	while(elmt = elmts.iterateNext()) {
		var text = elmt.nodeValue;
		
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
	
		var xpath = ''//a[img[@src="/screens/marcdisp.gif" or @alt="MARC Display"]]'';
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
		
		var tableRows = doc.evaluate(''//table[@class="browseScreen"]//tr[@class="browseEntry" or @class="briefCitRow" or td/input[@type="checkbox"]]'',
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
					if(tagRegexp.test(link.href)) {
						if(!firstURL) firstURL = link.href;
						
						var text = link.textContent;
						if(text) {
							text = Zotero.Utilities.cleanString(text);
							if(availableItems[link.href]) {
								availableItems[link.href] += " "+text;
							} else {
								availableItems[link.href] = text;
							}
						}
					}
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
			var m = matchRegexp.exec(url);
			if(!m) {
				throw("matchRegexp choked on "+url);
			}
			newUrls.push(m[1]+"marc"+m[2]);
		}
		
		pageByPage(marc, newUrls);
	}

	Zotero.wait();
}');

REPLACE INTO translators VALUES ('add7c71c-21f3-ee14-d188-caf9da12728b', '1.0.0b3.r1', '', '2007-06-12 23:00:00', '1', '100', '4', 'Library Catalog (SIRSI)', 'Sean Takats', '/uhtbin/cgisirsi', 
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
				} else if(field == "subject term" || field == "corporate subject" || field == "geographic term") {
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

REPLACE INTO translators VALUES ('a77690cf-c5d1-8fc4-110f-d1fc765dcf88', '1.0.0b3.r1', '', '2007-05-03 15:05:00', '1', '100', '4', 'ProQuest', 'Simon Kornblith', '^https?://[^/]+/pqdweb\?((?:.*\&)?did=.*&Fmt=[0-9]|(?:.*\&)Fmt=[0-9].*&did=|(?:.*\&)searchInterface=)', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	if(doc.evaluate(''//img[substring(@src, string-length(@src)-32) = "/images/common/logo_proquest.gif" or substring(@src, string-length(@src)-38) = "/images/common/logo_proquest_small.gif"]'',
	                doc, nsResolver, XPathResult.ANY_TYPE, null)) {
		if(doc.title == "Results") {
			return "multiple";
		} else {
			return "magazineArticle";
		}
	}
}', 
'function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var newItem = new Zotero.Item();
	var elmt;
	
	// Title
	var xpath = ''//td[@class="headerBlack"]/strong'';
	newItem.title = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	
	// Authors
	var xpath = ''//td[@class="textMedium"]/a/em'';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	while(elmt = elmts.iterateNext()) {
		// there are sometimes additional tags representing highlighting
		var author = elmt.textContent;
		if(author) {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
	}
	
	// Other info
	var xpath = ''//table[@id="tableIndexTerms"]/tbody/tr'';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	while(elmt = elmts.iterateNext()) {
		var field = Zotero.Utilities.superCleanString(doc.evaluate(''./TD[1]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue).toLowerCase();
		if(field == "publication title") {
			var publication = doc.evaluate(''./TD[2]/A[1]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(publication.nodeValue) {
				newItem.publicationTitle = Zotero.Utilities.superCleanString(publication.nodeValue);
			}
			
			var place = doc.evaluate(''./TD[2]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(place.nodeValue) {
				newItem.place = Zotero.Utilities.superCleanString(place.nodeValue);
			}
			
			var date = doc.evaluate(''./TD[2]/A[2]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();		
			if(date.nodeValue) {
				newItem.date = date.nodeValue;
			}
			
			var moreInfo = doc.evaluate(''./TD[2]/text()[2]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(moreInfo.nodeValue) {
				moreInfo = Zotero.Utilities.superCleanString(moreInfo.nodeValue);
				var parts = moreInfo.split(";\xA0");
				var issueRegexp = /^(\w+)\.(?: |\xA0)?(.+)$/
				var issueInfo = parts[0].split(",\xA0");
				for(j in issueInfo) {
					var m = issueRegexp.exec(issueInfo[j]);
					if(m) {
						var info = m[1].toLowerCase();
						if(info == "vol") {
							newItem.volume = Zotero.Utilities.superCleanString(m[2]);
						} else if(info == "iss" || info == "no") {
							newItem.issue = Zotero.Utilities.superCleanString(m[2]);
						}
					}
				}
				if(parts[1] && Zotero.Utilities.superCleanString(parts[1]).substring(0, 3).toLowerCase() == "pg.") {
					var re = /[0-9\-]+/;
					var m = re.exec(parts[1]);
					
					if(m) {
						newItem.pages = m[0];
						var pgs = parts[1].split(",\xA0");
						if(pgs[1] && Zotero.Utilities.superCleanString(pgs[1]).substring(pgs[1].length-3, pgs[1].length).toLowerCase() == "pgs") {
							var re = /[0-9\-]+/;
							var m = re.exec(pgs[1]);
							if(m) {
								var pagelength = parseInt(m[0]);
								if (pagelength > 1){
									var endpage = parseInt(newItem.pages) + pagelength - 1;
									newItem.pages = newItem.pages + "-" + endpage;
								}
							}
						}			
					}
				}
			}
		} else if(field == "source type") {
			var value = doc.evaluate(''./TD[2]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(value.nodeValue) {
				value = Zotero.Utilities.superCleanString(value.nodeValue).toLowerCase();
				
				if(value.indexOf("periodical") >= 0) {
					newItem.itemType = "magazineArticle";
				} else if(value.indexOf("newspaper") >= 0) {
					newItem.itemType = "newspaperArticle";
				} else {	// TODO: support thesis
					newItem.itemType = "book";
				}
			}
		} else if(field == "isbn" || field == "issn" || field == "issn/isbn") {
			var value = doc.evaluate(''./TD[2]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(value) {
				var type;
				value = Zotero.Utilities.superCleanString(value.nodeValue);
				if(value.length == 10 || value.length == 13) {
					newItem.ISBN = value;
				} else if(value.length == 8) {
					newItem.ISSN = value;
				}
			}
		} else if(field == "document url") {
			var value = doc.evaluate(''./TD[2]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(value) {
				newItem.url = Zotero.Utilities.cleanString(value.textContent);
			}
		} else if(field == "proquest document id") {
			var value = doc.evaluate(''./TD[2]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(value) {
				newItem.accessionNumber = Zotero.Utilities.cleanString(value.nodeValue);
			}
		} else if(field == "subjects" || field == "people" || field == "locations") {
			var subjects = doc.evaluate(".//a", elmt, nsResolver, XPathResult.ANY_TYPE, null);
			var currentSubject;
			while(currentSubject = subjects.iterateNext()) {
				var subjectValue = currentSubject.textContent;
				subjectValue = Zotero.Utilities.superCleanString(subjectValue);
				if(subjectValue) {
					newItem.tags.push(subjectValue);
				}
			}
		}
	}
	
	// magazineArticle -> journalArticle if issue and volume exist
	if(newItem.itemType == "magazineArticle" && (newItem.issue || newItem.volume)) {
		newItem.itemType = "journalArticle";
	}
	
	// figure out what we can attach
	var attachArray = {
		''//div[@class="textMedium formatBox"]//img[@alt="Full Text - PDF"]'':"ProQuest Full Text PDF",
		''//div[@class="textMedium formatBox"]//img[@alt="Text+Graphics"]'':"ProQuest Snapshot (HTML with Graphics)",
		''//div[@class="textMedium formatBox"]//img[@alt="Full Text"]'':"ProQuest Snapshot (HTML)",
		''//div[@class="textMedium formatBox"]//img[@alt="Abstract"]'':"ProQuest Snapshot (Abstract)"
	}
	for(var xpath in attachArray) {
		var item = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if(item) {
			var title = attachArray[xpath];
			
			if(item.parentNode.tagName.toLowerCase() == "a") {
				// item is not this page
				if(title == "ProQuest Full Text PDF") {
					// PDF gets different mime type and downloadability
					newItem.attachments.push({url:item.parentNode.href,
						title:title, mimeType:"application/pdf"});
				} else {
					newItem.attachments.push({url:item.parentNode.href,
						title:title, mimeType:"text/html"});
				}
			} else {
				// item is this page
				newItem.attachments.push({document:doc, title:title});
			}
			
			// only snapshot one of the possible types
			if(title != "ProQuest Snapshot (PDF)") break;
		}
	}
	
	var abstractNote = doc.evaluate(''//table[*/tr[1]/td[@class="textSmall"]/strong/text() = "Abstract"]/*/tr[2]'',
		doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(abstractNote) {
		newItem.abstractNote = abstractNote.textContent;
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	if(doc.title == "Results") {
		var items = new Object();
		
		// Require link to match this
		var tagRegexp = new RegExp();
		tagRegexp.compile(''^https?://[^/]+/pqdweb\\?((?:.*&)?did=.*&Fmt=[12](?:[^0-9]|$)|(?:.*&)Fmt=[12][^0-9].*&did=)'');
		
		var tableRows = doc.evaluate(''//tr[@class="rowUnMarked"]'',
		                doc, nsResolver, XPathResult.ANY_TYPE, null);
		// Go through table rows
		var tableRow;
		while(tableRow = tableRows.iterateNext()) {
			var links = tableRow.getElementsByTagName("a");
			// Go through links
			for(var j=0; j<links.length; j++) {
				if(tagRegexp.test(links[j].href)) {
					var text = doc.evaluate(''.//a[@class="bold"]/text()'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					if(text && text.nodeValue) {
						text = Zotero.Utilities.cleanString(text.nodeValue);
						items[links[j].href] = text;
					}
					break;
				}
			}
		}
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, function(doc) { scrape(doc) },
			function() { Zotero.done(); }, null);
		
		Zotero.wait();
	} else {
		if(doc.evaluate(''/html/body/table/tbody/tr/td[@class="headerBlack"]/strong//text()'',
						doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			scrape(doc);
		} else {
			var newURL = doc.location.href.replace(/RQT=[0-9]+/i, "RQT=309");
			newURL = newURL.replace(/Fmt=[0-9]+/i, "Fmt=1");
			Zotero.Utilities.loadDocument(newURL, function(doc) { scrape(doc); Zotero.done(); }, null);
			Zotero.wait();
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

REPLACE INTO translators VALUES ('b047a13c-fe5c-6604-c997-bef15e502b09', '1.0.0b3.r1', '', '2007-03-24 22:20:00', 1, 100, 4, 'LexisNexis', 'Simon Kornblith', '^https?://web\.lexis-?nexis\.com[^/]*/universe/(?:document|doclist)',
'function detectWeb(doc, url) {
	var detailRe = new RegExp("^https?://[^/]+/universe/document");
	if(detailRe.test(doc.location.href)) {
		return "newspaperArticle";
	} else {
		return "multiple";
	}
}',
'function scrape(doc) {
	var newItem = new Zotero.Item();
	newItem.attachments.push({document:doc, title:"LexisNexis Snapshot"});
	
	var citationDataDiv;
	var divs = doc.getElementsByTagName("div");
	for(var i=0; i<divs.length; i++) {
		if(divs[i].className == "bodytext") {
			citationDataDiv = divs[i];
			break;
		}
	}
	
	centerElements = citationDataDiv.getElementsByTagName("center");
	var elementParts = centerElements[0].innerHTML.split(/<br[^>]*>/gi);
	newItem.publicationTitle = elementParts[elementParts.length-1];
	
	var dateRegexp = /<br[^>]*>(?:<b>)?([A-Z][a-z]+)(?:<\/b>)? ([0-9]+, [0-9]{4})/;
	var m = dateRegexp.exec(centerElements[centerElements.length-1].innerHTML);
	if(m) {
		newItem.date = m[1]+" "+m[2];
	} else {
		var elementParts = centerElements[centerElements.length-1].innerHTML.split(/<br[^>]*>/gi);
		newItem.date = elementParts[1];
	}
	
	var cutIndex = citationDataDiv.innerHTML.indexOf("<b>BODY:</b>");
	if(cutIndex < 0) {
		cutIndex = citationDataDiv.innerHTML.indexOf("<b>TEXT:</b>");
	}
	if(cutIndex > 0) {
		citationData = citationDataDiv.innerHTML.substring(0, cutIndex);
	} else {
		citationData = citationDataDiv.innerHTML;
	}
	
	citationData = Zotero.Utilities.cleanTags(citationData);
	
	var headlineRegexp = /\n(?:HEADLINE|TITLE|ARTICLE): ([^\n]+)\n/;
	var m = headlineRegexp.exec(citationData);
	if(m) {
		newItem.title = Zotero.Utilities.cleanTags(m[1]);
	}
	
	var bylineRegexp = /\nBYLINE:  *(\w[\w\- ]+)/;
	var m = bylineRegexp.exec(citationData);
	if(m) {		// there is a byline; use it as an author
		if(m[1].substring(0, 3).toLowerCase() == "by ") {
			m[1] = m[1].substring(3);
		}
		newItem.creators.push(Zotero.Utilities.cleanAuthor(m[1], "author"));
		
		newItem.itemType = "newspaperArticle";
	} else {	// no byline; must be a journal
		newItem.itemType = "journalArticle";
	}
	
	// other ways authors could be encoded
	var authorRegexp = /\n(?:AUTHOR|NAME): ([^\n]+)\n/; 
	var m = authorRegexp.exec(citationData);
	if(m) {
		var authors = m[1].split(/, (?:and )?/);
		for(var i in authors) {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i].replace(" *", ""), "author"));
		}
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var detailRe = new RegExp("^https?://[^/]+/universe/document");
	if(detailRe.test(doc.location.href)) {
		scrape(doc);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, "^https?://[^/]+/universe/document");
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

REPLACE INTO translators VALUES ('cf87eca8-041d-b954-795a-2d86348999d5', '1.0.0b3.r1', '', '2006-12-15 15:11:00', 1, 100, 4, 'Library Catalog (Aleph)', 'Simon Kornblith', '^https?://[^/]+/F(?:/[A-Z0-9\-]+(?:\?.*)?$|\?func=find|\?func=scan)',
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
		
		var xpath = ''//*[tr[td/text()="LDR"]]/tr'';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		
		var record = new marc.record();
		while(elmt = elmts.iterateNext()) {
			var field = Zotero.Utilities.superCleanString(doc.evaluate(''./TD[1]/text()[1]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
			var value = doc.evaluate(''./TD[2]'', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			
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
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";
		
		newItem.complete();
	}, function() { Zotero.done(); }, null);
	
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('774d7dc2-3474-2684-392c-f787789ec63d', '1.0.0b3.r1', '', '2006-12-15 15:11:00', 1, 100, 4, 'Library Catalog (Dynix)', 'Simon Kornblith', 'ipac\.jsp\?.*(?:uri=full=[0-9]|menu=search)',
'function detectWeb(doc, url) {
	var detailsRe = new RegExp(''ipac\.jsp\?.*uri=full=[0-9]'');
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
	var detailsRe = new RegExp(''ipac\.jsp\?.*uri=full=[0-9]'');
	
	var uris = new Array();
	if(detailsRe.test(uri)) {
		uris.push(uri+''&fullmarc=true'');
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, "ipac\.jsp\?.*uri=full=[0-9]|^javascript:buildNewList\\(''.*uri%3Dfull%3D[0-9]");
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

REPLACE INTO translators VALUES ('c54d1932-73ce-dfd4-a943-109380e06574', '1.0.0b3.r1', '', '2007-06-12 23:30:00', 1, 100, 4, 'Project MUSE', 'Simon Kornblith', '^https?://muse\.jhu\.edu[^/]*/(?:journals/[^/]+/[^/]+/[^/]+\.html|search/pia.cgi)',
'function detectWeb(doc, url) {
	var searchRe = new RegExp("^https?://[^/]+/search/pia\.cgi");
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
	
	var searchRe = new RegExp("^https?://[^/]+/search/pia\.cgi");
	if(searchRe.test(doc.location.href)) {
		var items = new Array();
		var attachments = new Array();
		var pdfRe = /\.pdf$/i;
		var htmlRe = /\.html$/i;
		
		var tableRows = doc.evaluate(''/html/body/table[@class="navbar"]/tbody/tr/td/form/table'',
		                             doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		// Go through table rows
		while(tableRow = tableRows.iterateNext()) {
			// article_id is what we need to get it all as one file
			var input = doc.evaluate(''./tbody/tr/td/input[@name="article_id"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			var link = doc.evaluate(''.//b/i/text()'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(input && input.value && link && link.nodeValue) {
				items[input.value] = link.nodeValue;
				
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
		
		try {
			var search_id = doc.forms.namedItem("results").elements.namedItem("search_id").value;
		} catch(e) {
			var search_id = "";
		}
		var articleString = "";
		var newAttachments = new Array();
		for(var i in items) {
			articleString += "&article_id="+i;
			newAttachments.push(attachments[i]);
		}
		var savePostString = "actiontype=save&search_id="+search_id+articleString;
		
		Zotero.Utilities.HTTP.doGet("http://muse.jhu.edu/search/save.cgi?"+savePostString, function() {
			Zotero.Utilities.HTTP.doGet("http://muse.jhu.edu/search/export.cgi?exporttype=endnote"+articleString, function(text) {
				Zotero.debug(text);
				// load translator for RIS
				var translator = Zotero.loadTranslator("import");
				translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				translator.setString(text);
				translator.setHandler("itemDone", function(obj, item) {
					if(item.notes && item.notes[0]) {
						Zotero.debug(item.notes);
						item.extra = item.notes[0].note;
						
						delete item.notes;
						item.notes = undefined;
					}
					item.attachments = newAttachments.shift();
					Zotero.debug(item.attachments);
					item.complete();
				});
				translator.translate();
				Zotero.done();
			}, function() {});
		}, function() {});
		
		Zotero.wait();
	} else {
		var newItem = new Zotero.Item("journalArticle");
		newItem.url = url;
		newItem.attachments.push({document:doc, title:"Project MUSE Snapshot"});
		
		var getPDF = doc.evaluate(''//a[text() = "[Access article in PDF]"]'', doc,
		                          nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if(getPDF) {
			newItem.attachments.push({title:"Project MUSE Full Text PDF", mimeType:"application/pdf",
			                         url:getPDF.href});
		}
		
		var elmts = doc.evaluate(''//comment()'', doc, nsResolver,
		                         XPathResult.ANY_TYPE, null);
		
		var headerRegexp = /HeaderData((?:.|\n)*)\#\#EndHeaders/i
		while(elmt = elmts.iterateNext()) {
			if(elmt.nodeValue.substr(0, 10) == "HeaderData") {
				var m = headerRegexp.exec(elmt.nodeValue);
				var headerData = m[1];
			}
		}
		
		// Use E4X rather than DOM/XPath, because the Mozilla gods have decided not to
		// expose DOM/XPath to sandboxed scripts
		var newDOM = new XML(headerData);
		
		newItem.publicationTitle = newDOM.journal.text();
		newItem.volume = newDOM.volume.text();
		newItem.issue = newDOM.issue.text();
		newItem.date = newDOM.pubdate.text().toString();
		if(!newItem.date) {
			newItem.date = newDOM.year.text();
		}
		newItem.title = newDOM.doctitle.text();
		newItem.ISSN = newDOM.issn.text();
		
		// Do pages
		var fpage = newDOM.fpage.text();
		var lpage = newDOM.lpage.text();
		if(fpage != "") {
			newItem.pages = fpage;
			if(lpage) {
				newItem.pages += "-"+lpage;
			}
		}
		
		// Do authors
		var elmts = newDOM.docauthor;
		for(var i in elmts) {
			var fname = elmts[i].fname.text();
			var surname = elmts[i].surname.text();
			newItem.creators.push({firstName:fname, lastName:surname, creatorType:"author"});
		}
		
		newItem.complete();
	}
}');

REPLACE INTO translators VALUES ('fcf41bed-0cbc-3704-85c7-8062a0068a7a', '1.0.0b3.r1', '', '2007-05-24 19:30:00', '1', '100', '4', 'NCBI PubMed', 'Simon Kornblith', '^http://www\.ncbi\.nlm\.nih\.gov/(sites/entrez|entrez/query\.fcgi\?.*db=PubMed)', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	var uids = doc.evaluate(''//input[@id="UidCheckBox" or @name="uid"]'', doc,
			       nsResolver, XPathResult.ANY_TYPE, null);
	if(uids.iterateNext()) {
		if (uids.iterateNext()){
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
			var tableRows = doc.evaluate(''//div[@class="ResultSet"]/table/tbody | //table[@id="ResultPanel"]/tbody/tr[3]/td/div[5]/table/tbody'', doc, // edited for new PubMed
					     nsResolver, XPathResult.ANY_TYPE, null);
			var tableRow;
			// Go through table rows
			while(tableRow = tableRows.iterateNext()) {
				var link = doc.evaluate(''.//a'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				uid = doc.evaluate(''.//input[@id="UidCheckBox" or @name="uid"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				var article = doc.evaluate(''./tr[2]/td[2]/text()[1]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				items[uid.value] = article.nodeValue;
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

REPLACE INTO translators VALUES ('951c027d-74ac-47d4-a107-9c3069ab7b48', '1.0.0b3.r1', '', '2006-12-12 23:41:00', 1, 100, 4, 'Embedded RDF', 'Simon Kornblith', NULL,
'function detectWeb(doc, url) {
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

REPLACE INTO translators VALUES ('05d07af9-105a-4572-99f6-a8e231c0daef', '1.0.0b3.r1', '', '2006-12-15 03:40:00', 1, 100, 4, 'COinS', 'Simon Kornblith', NULL,
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
		Zotero.done(true);
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

REPLACE INTO translators VALUES ('e7e01cac-1e37-4da6-b078-a0e8343b0e98', '1.0.0b4r1', '', '2007-03-20 17:50:13', '1', '90', '4', 'unAPI', 'Simon Kornblith', '', 
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

REPLACE INTO translators VALUES ('3af43735-36d3-46ae-9ca8-506ff032b0d3', '1.0.0b4.r1', '', '2007-06-15 20:00:00', '0', '100', '4', 'HeinOnline', 'Bill McKinney', 'http:\/\/heinonline\.org\/HOL\/Page\?handle\=hein\.journals\/.+', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var re = /http:\/\/heinonline\.org\/HOL\/Page\?handle\=hein\.journals\/.+/
	if(re.test(url)) {
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
	
	var newItem = new Zotero.Item("journalArticle");
	newItem.url = doc.location.href;
	
	// publicaton
	var tmpTitle = doc.title;
	var titleRe= /Law Journal Library (.+)\s+-\s+HeinOnline\.org/
	var titleMatch = titleRe.exec(tmpTitle);
	if (titleMatch) {
		newItem.publicationTitle = titleMatch[1];
	} else {
		newItem.publicationTitle = doc.title;
	}
	
	// default title
	newItem.title = doc.title;
	
	// get selected page
	var selectedPage = "1";
	var pageNum = "1";
	var p= doc.getElementsByTagName("select");
	if (p.length > 0) {
		for (var i = 0; i < p[4].options.length; i++) {
			if (p[4].options[ i ].selected) {
				selectedPage = p[4].options[i].value;
				pageNum = p[4].options[i].innerHTML;
				newItem.pages = pageNum.replace(/^Page\s+/,"") + "-";
			}
		}
	}


	// get handle
	var handle="";
	var handleRe = /handle=([^\&]+)\&/
	var handleMatch = handleRe.exec(doc.location.href);
	if (handleMatch) {
		handle = handleMatch[1];
	}
	
	// fetch citation
	var url = "http://heinonline.org/HOL/citation-info?handle="+handle+"&id="+selectedPage+"&rand=12345&collection=journals";
	Zotero.Utilities.HTTP.doGet(url, function(text) {
		
		var tmpTxt = text;
		var citeRe = /(\d+)\s+(.+)\s+(\d+)\s+\(([^\)]+)\)\s+<br>\s+([^;]+)(;\s.+[\S])/
		var citeMatch = citeRe.exec(tmpTxt)
		if (citeMatch) {
			
			newItem.volume = citeMatch[1];
			//newItem.issue= citeMatch[3];
			newItem.date = citeMatch[4];
			newItem.journalAbbreviation = citeMatch[2];
			newItem.title = citeMatch[5];
			
			var tmpAuthors = citeMatch[6];
			var authors = tmpAuthors.split(";");
			for (i=1;i<authors .length;i++) {
				
				var name = authors[i].split(",");
				var fname = name[1].replace(/^\s+/,"");
				var lname= name[0].replace(/^\s+/,"");
				newItem.creators.push({lastName:lname, firstName:fname, creatorType:"author", fieldMode:true});
			}
			newItem.abstract =  citeMatch[0];
		}	
	
		var getSectionUrl = "http://heinonline.org/HOL/ajaxcalls/get-section-id?base=js&handle="+handle+"&id="+selectedPage;
		Zotero.Utilities.HTTP.doGet(getSectionUrl, function(sectionRes) {
		
			var pdfUrl = "http://heinonline.org/HOL/PDF?handle="+handle+"&id="+selectedPage+"&print=section&section="+sectionRes+"&ext=.pdf";
			newItem.attachments.push({url:pdfUrl, title:"PDF version", mimeType:"application/pdf", downloadable:true});
			newItem.notes.push({note:"PDF version: "+pdfUrl});
			newItem.complete();
		});	
	});	
	
	
	// print page: PDF?handle=hein.journals/adelrev11&id=150&print=section&section=16&ext=.pdf"
}

function doWeb(doc, url) {
	var re=  /http:\/\/heinonline\.org\/HOL\/Page\?handle\=hein\.journals\/.+/
	if(re.test(url)) {
		scrape(doc);
	} else {
		
		var items = Zotero.Utilities.getItemArray(doc, doc, re);
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

REPLACE INTO translators VALUES ('dede653d-d1f8-411e-911c-44a0219bbdad', '1.0.0b4.r1', '', '2007-06-15 20:00:00', '0', '100', '4', 'GPO Access e-CFR', 'Bill McKinney', '^http://ecfr\.gpoaccess\.gov/cgi/t/text/text-idx.+', 
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

REPLACE INTO translators VALUES ('5ed5ab01-899f-4a3b-a74c-290fb2a1c9a4', '1.0.0b4.r1', '', '2007-06-15 20:00:00', '0', '100', '4', 'AustLII and NZLII', 'Bill McKinney', 'http:\/\/www\.(?:austlii\.edu\.au|nzlii\.org)\/(?:\/cgi-bin\/disp\.pl\/)?(?:au|nz)\/cases\/.+', 
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

REPLACE INTO translators VALUES ('5ae63913-669a-4792-9f45-e089a37de9ab', '1.0.0b4.r1', '', '2007-06-15 20:00:00', '0', '100', '4', 'BAILII', 'Bill McKinney', 'http:\/\/www\.bailii\.org(?:\/cgi\-bin\/markup\.cgi\?doc\=)?\/\w+\/cases\/.+', 
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

REPLACE INTO translators VALUES ('84799379-7bc5-4e55-9817-baf297d129fe', '1.0.0b4.r1', '', '2007-06-15 20:00:00', '0', '100', '4', 'CanLII', 'Bill McKinney', 'http:\/\/www\.canlii\.org\/en\/[^\/]+\/[^\/]+\/doc\/.+', 
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

REPLACE INTO translators VALUES ('930d49bc-44a1-4c22-9dde-aa6f72fb11e5', '1.0.0b4.r1', '', '2007-06-15 20:00:00', '0', '100', '4', 'Cornell LII', 'Bill McKinney', '^http://www\.law\.cornell\.edu/supct/html/.+', 
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

REPLACE INTO translators VALUES ('232e24fe-2f68-44fc-9366-ecd45720ee9e', '1.0.0b4.r1', '', '2007-06-15 20:00:00', '0', '100', '4', 'Patents - USPTO', 'Bill McKinney', '^http://patft\.uspto\.gov/netacgi/nph-Parser.+', 
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
			newItem.abstract= el.innerHTML;
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

REPLACE INTO translators VALUES ('3e684d82-73a3-9a34-095f-19b112d88bbf', '1.0.0b3.r1', '', '2007-05-15 12:00:00', '1', '100', '4', 'Google Books', 'Simon Kornblith', '^http://books\.google\.[a-z]+/books\?(.*id=.*|.*q=.*)', 
'function detectWeb(doc, url) {
	var re = new RegExp(''^http://books\\.google\\.[a-z]+/books\\?id=([^&]+)'', ''i'');
	if(re.test(doc.location.href)) {
		return "book";
	} else {
		return "multiple";
	}
}', 
'function doWeb(doc, url) {
	var uri = doc.location.href;
	var newUris = new Array();
	
	var re = new RegExp(''^http://books\\.google\\.[a-z]+/books\\?id=([^&]+)'', ''i'');
	var m = re.exec(uri);
	if(m) {
		newUris.push(''http://books.google.com/books?id=''+m[1]);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, ''http://books\\.google\\.[a-z]+/books\\?id=([^&]+)'', ''^(?:All matching pages|About this Book|Table of Contents|Index)'');
	
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
			newUris.push(''http://books.google.com/books?id=''+m[1]);
		}
	}
	
	Zotero.Utilities.processDocuments(newUris, function(newDoc) {
		var newItem = new Zotero.Item("book");
		newItem.extra = "";
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == ''x'') return namespace; else return null;
		} : null;

		var xpath = ''//div[@id="titlebar"]/span[@class="title"]/text()''
		var elmt;	
		if (elmt = newDoc.evaluate(xpath, newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null).iterateNext()){
			var title = Zotero.Utilities.superCleanString(elmt.nodeValue);
			newItem.title = title;
			Zotero.debug("title: " + title);
		}
		xpath = ''//div[@id="titlebar"]/span[@class="author"]/text()''
		if (elmt = newDoc.evaluate(xpath, newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null).iterateNext()){
			var authors = Zotero.Utilities.superCleanString(elmt.nodeValue);
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
					var publisher = newDoc.evaluate(''../text()[2]'', fieldelmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					if (publisher){
						publisher =  Zotero.Utilities.superCleanString(publisher.nodeValue);
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

REPLACE INTO translators VALUES ('57a00950-f0d1-4b41-b6ba-44ff0fc30289', '1.0.0b3.r1', '', '2007-03-22 17:40:00', 1, 100, 4, 'Google Scholar', 'Simon Kornblith', '^http://scholar\.google\.[a-z]+/scholar',
'function detectWeb(doc, url) {
	return "multiple";
}',
'var haveEndNoteLinks;

function scrape(doc) {
	var nsResolver = doc.createNSResolver(doc.documentElement);
	
	var items = new Array();
	var itemGrabLinks = new Array();
	var links = new Array();
	var types = new Array();
	
	var itemTypes = new Array();
	var attachments = new Array();
	
	var elmts = doc.evaluate(''//p[@class="g"]'', doc, nsResolver,
	                         XPathResult.ANY_TYPE, null);
	var elmt;
	var i=0;
	Zotero.debug("get elms");
	while(elmt = elmts.iterateNext()) {
		var isCitation = doc.evaluate("./font[1]/b[1]/text()[1]", elmt, nsResolver,
		                              XPathResult.ANY_TYPE, null).iterateNext();
		// use EndNote links if available
		if(haveEndNoteLinks) {
			var itemGrabLink = doc.evaluate(''.//a[text() = "Import into EndNote"]'',
										   elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext(); 
		} else {
			var itemGrabLink = doc.evaluate(''.//a[text() = "Related Articles"]'',
										   elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext(); 
		}
        
        var noLinkRe = /^\[[^\]]+\]$/;
		if(itemGrabLinks) {
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
	
	doc.cookie = "GSP=ID=deadbeefdeadbeef:IN=ebe89f7e83a8fe75+7e6cc990821af63:CF=3; domain=.scholar.google.com";
	
	// determine if we need to reload the page
	
	// first check for EndNote links
	Zotero.debug("get links");
	haveEndNoteLinks = doc.evaluate(''//a[text() = "Import into EndNote"]'', 
			doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(!haveEndNoteLinks) {
		// next check if there are docs with no related articles
		if(doc.evaluate(''//p[@class="g"][not(descendant-or-self::text() = "Related Articles")]'',
				doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
					// now it''s reload time
					haveEndNoteLinks = true;
					Zotero.Utilities.loadDocument(url, scrape);
					
					return;
		}
	}
	
	scrape(doc, url);
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

REPLACE INTO translators VALUES ('d0b1914a-11f1-4dd7-8557-b32fe8a3dd47', '1.0.0b3.r1', '', '2007-06-12 23:00:00', '1', '100', '4', 'EBSCOhost', 'Simon Kornblith', '^https?://[^/]+/ehost/(?:results|detail)', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	// See if this is a seach results page
	var searchResult = doc.evaluate(''//table[@class="result-list-inner"]'', doc, nsResolver,
	                                XPathResult.ANY_TYPE, null).iterateNext();
	if(searchResult) {
		return "multiple";
	}

	var persistentLink = doc.evaluate(''//tr[td[@class="left-content-ft"]/text() = "Persistent link to this record:"]/td[@class="right-content-ft"]'',
									  doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(persistentLink) {
		return "journalArticle";
	}
}', 
'var viewStateMatch = /<input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="([^"]+)" \/>/
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
	m = viewStateMatch.exec(text);
	var downloadString = "__EVENTTARGET=&__EVENTARGUMENT=&__VIEWSTATE="+fullEscape(m[1])+"&ctl00%24ctl00%24MainContentArea%24MainContentArea%24ctl00%24btnSubmit=Save&ctl00%24ctl00%24MainContentArea%24MainContentArea%24ctl00%24BibFormat=1&ajax=enabled";

	Zotero.Utilities.HTTP.doPost(host+"/ehost/"+deliveryURL,
								 downloadString, function(text) {	// get marked records as RIS
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
	
	var queryRe = /\?(.*)$/;
	var m = queryRe.exec(url);
	var queryString = m[1];
		
	var viewState = doc.evaluate(''//input[@name="__VIEWSTATE"]'', doc, nsResolver,
								 XPathResult.ANY_TYPE, null).iterateNext();
	viewState = fullEscape(viewState.value);
	
	var searchResult = doc.evaluate(''//table[@class="result-list-inner"]'', doc, nsResolver,
	                                XPathResult.ANY_TYPE, null).iterateNext();
	if(searchResult) {
		var items = new Object();
		
		var tableRows = doc.evaluate(''//table[@class="cluster-result-record-table"]/tbody/tr'',
		                             doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		// Go through table rows
		while(tableRow = tableRows.iterateNext()) {
			var title = doc.evaluate(''.//a[@class="title-link"]'', tableRow, nsResolver,
			                         XPathResult.ANY_TYPE, null).iterateNext();
			var addLink = doc.evaluate(''.//a[substring(@id, 1, 11)="addToFolder"]'', tableRow, nsResolver,
			                           XPathResult.ANY_TYPE, null).iterateNext();
			if(title && addLink) {
				items[addLink.href] = title.textContent;
			}
		}
		
		var items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		
		var citations = new Array();
		var argRe = /''([^'']+)''/;
		for(var i in items) {
			var m = argRe.exec(i);
			citations.push(m[1]);
		}

		var saveString = "__EVENTTARGET=FolderItem:AddItem&IsCallBack=true&SearchTerm1=test&SortOptionDropDown=date&__EVENTARGUMENT="+citations.join(",")+"&";
		var folderString = "__EVENTTARGET=ctl00%24ctl00%24ToolbarArea%24toolbar%24folderControl%24lnkFolder&__EVENTARGUMENT=&__VIEWSTATE="+viewState+"&ctl00%24ctl00%24ToolbarArea%24toolbar%24drpLanguages=&ctl00%24ctl00%24MainContentArea%24MainContentArea%24ctl11%24SearchTerm1=test&ctl00%24ctl00%24MainContentArea%24MainContentArea%24DbSortOptionControl%24SortOptionDropDown=date";
		//clear saved folder first
		var clearUrl = url.replace("results?", "folder?");
		clearUrl = clearUrl.replace("vid=2", "vid=3");
		var clearString = "__EVENTTARGET=&__EVENTARGUMENT=&ctl00%24ctl00%24MainContentArea%24MainContentArea%24btnRemoveAll=Remove+All&ajax=enabled";

		Zotero.Utilities.HTTP.doPost(clearUrl, clearString, function(text){
			Zotero.Utilities.HTTP.doPost(url, saveString, function(text) {				// mark records
				Zotero.Utilities.HTTP.doPost(url, folderString, function(text) {		// view folder
					var postLocation = /<form name="aspnetForm" method="post" action="([^"]+)"/
					var m = postLocation.exec(text);
					var folderURL = m[1].replace(/&amp;/g, "&");
					
					m = viewStateMatch.exec(text);
					var folderViewState = m[1];
					var deliverString = "__EVENTTARGET=ctl00%24ctl00%24MainContentArea%24MainContentArea%24btnDelivery%24lnkExport&__EVENTARGUMENT=&__VIEWSTATE="+fullEscape(folderViewState)+"&ajax=enabled";
					Zotero.Utilities.HTTP.doPost(host+"/ehost/"+folderURL,
												  deliverString, downloadFunction);		// download records as RIS
				});
			});
		});
	} else {
		// If this is a view page, find the link to the citation
		var xpath = ''/html/body/div[@class="indent"]/center//a[@class="nav"]'';
		var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var saveCitation = elmts.iterateNext();
		var viewSavedCitations = elmts.iterateNext();
		
		var deliverString = "__EVENTTARGET=ctl00%24ctl00%24MainContentArea%24MainContentArea%24topDeliveryControl%24deliveryButtonControl%24lnkExport&__EVENTARGUMENT=&__VIEWSTATE="+viewState+"&ajax=enabled";
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

REPLACE INTO translators VALUES ('d1bf1c29-4432-4ada-8893-2e29fc88fd9e', '1.0.0b3.r1', '', '2006-12-15 03:40:00', 1, 100, 4, 'washingtonpost.com', 'Simon Kornblith', '^http://www\.washingtonpost\.com/', 
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
	
	newItem.attachments.push({document:doc, title:"Washington Post Snapshot"});
	
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

REPLACE INTO translators VALUES ('a07bb62a-4d2d-4d43-ba08-d9679a0122f8', '1.0.0b3.r1', '', '2007-03-24 22:20:00', 1, 100, 4, 'ABC-CLIO Serials Web', 'Simon Kornblith', '^https?://serials\.abc-clio\.com[^/]*/active/go/ABC-Clio-Serials_v4', 
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

REPLACE INTO translators VALUES ('fa396dd4-7d04-4f99-95e1-93d6f355441d', '1.0.0b3.r1', '', '2006-12-11 18:37:00', 1, 100, 4, 'CiteSeer', 'Simon Kornblith', '^http://(?:citeseer\.ist\.psu\.edu/|citeseer\.csail\.mit\.edu/|citeseer\.ifi\.unizh\.ch/|citeseer\.comp\.nus\.edu\.sg/)', 
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
	while(elmt = results.iterateNext()) {
		var kind = elmt.textContent.toString();
		var index = acceptableTypes.indexOf(kind);
		if(index != -1) {
			var attachment = {url:elmt.href, mimeType:mimeTypes[index],
			                  title:"CiteSeer Full Text "+kind};
			attachments.push(attachment);
			
			// only get one of thse files
			break;
		}
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

REPLACE INTO translators VALUES ('ecddda2e-4fc6-4aea-9f17-ef3b56d7377a', '1.0.0b3.r1', '', '2007-04-13 16:05:00', '1', '100', '4', 'arXiv.org', 'Sean Takats', '^http://(?:www\.)?(?:arxiv\.org/(?:find/\w|list/\w|abs/)|eprintweb.org/S/(?:search|archive|article)(?!.*refs$)(?!.*cited$))', 
'function detectWeb(doc, url) {
	var searchRe = /^http:\/\/(?:www\.)?(?:arxiv\.org\/(?:find|list)|eprintweb.org\/S\/(?:archive|search$))/;
	if(searchRe.test(url)) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}', 
'function getPDF(articleID) {
	return {url:"http://www.arxiv.org/pdf/" + articleID,
			mimeType:"application/pdf", title:articleID + " PDF"};
}

function doWeb(doc, url) {
	var eprintMultRe = /^http:\/\/(?:www\.)?eprintweb.org\/S\/(?:search|archive)/;
	var eprintMultM = eprintMultRe.exec(url);
	
	var eprintSingRe = /^http:\/\/(?:www\.)?eprintweb.org\/S\/(?:article|article)/;
	var eprintSingM = eprintSingRe.exec(url);

	if (eprintMultM) {
		var elmtsXPath = ''//table/tbody/tr/td[@class="txt"]/a[text()="Abstract"]/../b'';
		var titlesXPath = ''//table/tbody/tr/td[@class="lti"]'';
		var titleNode = ''./text()'';
	} else {
		var elmtsXPath = ''//div[@id="content"]/dl/dt/font/b/a'';
		var titlesXPath = ''//div[@id="content"]//dd'';
		var titleNode = ''./b[1]/text()'';
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
				availableItems[i] = doc.evaluate(titleNode, title, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent; 
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
			var arXivID = doc.evaluate(''//tr[1]/td[@class="txt"]/b'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
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
			var subjectValue = Zotero.Utilities.cleanString(citation.dc_subject.text().toString());
			newItem.tags.push(subjectValue);
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
		newItem.attachments.push(getPDF(articleID));
		newItem.complete();
	}, function() {Zotero.done();}, null);
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('232903bc-7307-4058-bb1a-27cfe3e4e655', '1.0.0b3r1', '', '2007-04-23 17:00:00', '0', '100', '4', 'SPIRES', 'Sean Takats', '^http://www.slac.stanford.edu/spires/find/hep/', 
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

REPLACE INTO translators VALUES ('b6d0a7a-d076-48ae-b2f0-b6de28b194e', '1.0.0b3.r1', '', '2007-04-16 17:00:00', '1', '100', '4', 'ScienceDirect', 'Simon Kornblith', '^https?://www\.sciencedirect\.com[^/]*/science\?(?:.+\&|)_ob=(?:ArticleURL|ArticleListURL|PublicationURL)', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	if (doc.evaluate(''//img[contains(@src, "guest_user.gif")]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return false;
	}
	if(url.indexOf("_ob=ArticleURL") == -1) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}', 
'function handleRIS(text, PDFs) {
	// load translator for RIS
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
	translator.setString(text);
	translator.setHandler("itemDone", function(obj, item) {
		if(item.attachments[0]) {
			item.attachments[0].title = "ScienceDirect Snapshot";
			item.attachments[0].mimeType = "text/html";
		}

		var pdf = PDFs.shift();
		if(pdf) {
			item.attachments.push({
				title:"ScienceDirect Full Text PDF",
				url:pdf, mimeType:"application/pdf"
			});
		}

		if(item.notes[0]) {
			item.abstractNote = item.notes[0].note;
			item.notes = new Array();
		}
		item.complete();
	});
	translator.translate();
	Zotero.done();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;

	if(url.indexOf("_ob=ArticleURL") == -1) {
		// search page
		var items = new Array();
		var links = new Array();

		var isPublication = url.indexOf("_ob=PublicationURL") != -1;
		if(isPublication) {
			var xpath = ''//table[@class="txt"][@id="pubBody"]//tr'';
		} else {
			var xpath = ''//table[@class="tableResults-T"]//tr'';
		}

		var arts = new Object();

		var tableRows = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		// Go through table rows
		var tableRow;
		var i = 0;
		while(tableRow = tableRows.iterateNext()) {
			i++;

			var checkboxes = tableRow.getElementsByTagName("input");
			var title = doc.evaluate(''.//span[@class="bf"]'', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();

			if(checkboxes[0] && title) {
				var index = checkboxes[0].value;
				items[index] = Zotero.Utilities.cleanString(title.textContent);

				var link = doc.evaluate(''.//a[substring(text(), 1, 3) = "PDF"]'',
					tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if(link) {
					links[index] = link.href;
				}
			}
		}

		items = Zotero.selectItems(items);
		if(!items) return true;

		var PDFs = new Array();

		var itemCount = 0;
		var itemList = "";
		for(var i in items) {
			itemList += "&art="+i;
			PDFs.push(links[i]);
			itemCount++;
		}

		var count = doc.evaluate(''//input[@name="count"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;

		var md5 = doc.getElementsByName("md5")[1].value;
		if(isPublication) {
			var tockey = escape(doc.evaluate(''//input[@name="_tockey"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value);
			var chunk = doc.evaluate(''//input[@name="chunk"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
			var pubType = doc.evaluate(''//input[@name="_pubType"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
			var cdi = url.match(/_cdi=([^&]+)/);
			var getURL = "http://www.sciencedirect.com/science?_ob=PublicationURL&_method=list&_tockey="+tockey+"&_auth=y&_version=1&refSource=toc&_pubType="+pubType+"&_cdi="+cdi[1]+"&md5="+md5+"&chunk="+chunk+"&view=c&export.x=21&export.y=14&count="+count+itemList;
		} else {
			var st = doc.evaluate(''//input[@name="_st"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
			var chunk = doc.evaluate(''//input[@name="_chunk"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
			var count = doc.evaluate(''//input[@name="count"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
			var alid = doc.evaluate(''//input[@name="_ArticleListID"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
			var getURL = "http://www.sciencedirect.com/science?_ob=ArticleListURL&_method=tag&refSource=search&_st="+st+"&count="+count+"&_chunk="+chunk+"&NEXT_LIST=1&view=c&md5="+md5+"&_ArticleListID="+alid+"&export.x=21&export.y=6&sort=d"+itemList;
		}

		Zotero.Utilities.HTTP.doGet(getURL, function(text) {
			var md5 = text.match(/<input type=hidden name=md5 value=([^>]+)>/);
			var acct = url.match(/_acct=([^&]+)/);
			var userid = url.match(/_userid=([^&]+)/);
			var subid = text.match(/<input type=hidden name=_subId value=([^>]+)>/);
			if(isPublication) {
				var post = "_ob=DownloadURL&_method=finish&_acct="+acct[1]+"&_userid="+userid[1]+"&_subId="+subid[1]+"&_tockey="+tockey+"&count="+itemCount+"&md5="+md5[1]+"&JAVASCRIPT_ON=Y&format=cite-abs&citation-type=RIS&x=12&y=15";
			} else {
				var post = "_ob=DownloadURL&_method=finish&_acct="+acct[1]+"&_userid="+userid[1]+"&_ArticleListID="+alid+"&_subId="+subid[1]+"&count="+itemCount+"&md5="+md5[1]+"&JAVASCRIPT_ON=Y&limiter=selected&format=cite-abs&citation-type=RIS";
			}
			Zotero.Utilities.HTTP.doPost("http://www.sciencedirect.com/science", post, function(text) { handleRIS(text, PDFs) });
		});
	} else {
		var get = doc.evaluate(''//a[img[contains(@alt, "Export citation")]]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;

		var PDFs = [];

		var link = doc.evaluate(''//a[substring(text(), 1, 3) = "PDF"]'',
			doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if(link) {
			var PDFs = [link.href];
		}

		Zotero.Utilities.HTTP.doGet(get, function(text) {
			var md5 = text.match(/<input type=hidden name=md5 value=([^>]+)>/);
			var acct = url.match(/_acct=([^&]+)/);
			var userid = url.match(/_userid=([^&]+)/);
			var alid = url.match(/_alid=([0-9]+)/);
			var udi = url.match(/_udi=([^&]+)/);
			var uoikey = text.match(/<input type=hidden name=_uoikey value=([^>]+)>/);
			if(alid) {
				var docIdentifier = "_ArticleListID="+alid[1]+"&_uoikey="+uoikey[1];
			} else {
				var docIdentifier = "_uoikey="+uoikey[1];
			}

			var post = "_ob=DownloadURL&_method=finish&_acct="+acct[1]+"&_userid="+userid[1]+"&_docType=FLA&"+docIdentifier+"&md5="+md5[1]+"&JAVASCRIPT_ON=Y&format=cite-abs&citation-type=RIS&x=26&y=17";
			Zotero.Utilities.HTTP.doPost("http://www.sciencedirect.com/science", post, function(text) { handleRIS(text, PDFs) });
		});
	}

	Zotero.wait();
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

REPLACE INTO translators VALUES ('d75381ee-7d8d-4a3b-a595-b9190a06f43f', '1.0.0b3r1', '', '2007-04-05 19:45:00', '0', '100', '4', 'Scitation', 'Eugeniy Mikhailov', '^https?://(?:www\.)?scitation.aip.org', 
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

REPLACE INTO translators VALUES ('2c310a37-a4dd-48d2-82c9-bd29c53c1c76', '1.0.0b3r1', '', '2007-04-05 19:45:00', '0', '100', '4', 'PROLA', 'Eugeniy Mikhailov', '^https?://(?:www\.)?prola.aps.org/(searchabstract|abstract)/', 
'function detectWeb(doc, url) {
	return "journalArticle";
}	', 
'function doWeb(doc, url) {
    var urlRIS = url;
	// so far several more or less  identical url possible
	// one is with "abstract" other with "searchabstract"
	urlRIS = urlRIS.replace("searchabstract","export");
	urlRIS = urlRIS.replace("abstract","export");
	var post = "type=ris";
	
	Zotero.Utilities.HTTP.doPost(urlRIS, post, function(text) {
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

REPLACE INTO translators VALUES ('cde4428-5434-437f-9cd9-2281d14dbf9', '1.0.0b3.r1', '', '2006-12-15 22:19:00', 1, 100, 4, 'Ovid', 'Simon Kornblith', '/gw1/ovidweb\.cgi', 
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
'function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var results = Zotero.Utilities.cleanString(doc.evaluate(''//div[@class="bibheader-resultsrange"]/b'', doc, nsResolver,
		XPathResult.ANY_TYPE, null).iterateNext().textContent);
	
	var post = "S="+doc.evaluate(''.//input[@name="S"]'', doc, nsResolver, XPathResult.ANY_TYPE,
		null).iterateNext().value;
	
	if(results.indexOf("-") != -1) {
		var items = new Array();
		
		var tableRows = doc.evaluate(''/html/body/form/div[substring(@class, 1, 10)="titles-row"]'', doc,
			nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		// Go through table rows
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
	
	post += "&SELECT="+doc.evaluate(''.//input[@name="SELECT"]'', doc, nsResolver, XPathResult.ANY_TYPE,
		null).iterateNext().value;
	post += "&CitMan="+doc.evaluate(''.//input[@name="CitMan"]'', doc, nsResolver, XPathResult.ANY_TYPE,
		null).iterateNext().value;
	post += "&CitManPrev="+doc.evaluate(''.//input[@name="CitManPrev"]'', doc, nsResolver, XPathResult.ANY_TYPE,
		null).iterateNext().value;
	post += "&cmRecordSelect=SELECTED&cmFields=ALL&cmFormat=export&cmsave.x=12&cmsave.y=7";
		
	Zotero.Utilities.HTTP.doPost(url, post, function(text) {
		Zotero.debug(text);
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
					// make a vague attempt at getting a volume and pages
					var m = fieldContent.match(/([0-9]+)\(([0-9]+)\):([A-Z]?[0-9]+(?:\-[A-Z]?[0-9]+))/);
					if(m) {
						newItem.volume = m[1];
						newItem.issue = m[2];
						newItem.pages = m[3];
						fieldContent = fieldContent.replace(m[0], "");
					}
					// try to get the date, too
					var m = fieldContent.match(/((?:January|February|March|April|May|June|July|August|September|October|November|December).*[0-9]{4});$/);
					if(m) {
						newItem.date = m[1];
						fieldContent = fieldContent.replace(m[0], "");
					}
					
					newItem.publicationTitle = Zotero.Utilities.superCleanString(fieldContent);
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
		
		Zotero.done();
	});
		
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('cb48083-4d9-4ed-ac95-2e93dceea0ec', '1.0.0b3.r1', '', '2007-03-24 22:20:00', 1, 100, 4, 'Blackwell Synergy', 'Simon Kornblith', '^https?://www\.blackwell-synergy\.com[^/]*/(?:action/doSearch|doi/)', 
'function detectWeb(doc, url) {
	if(url.indexOf("doSearch") != -1) {
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
	
	if(url.indexOf("doSearch") != -1) {
		var items = new Array();
		var links = new Array();
		
		var tableRows = doc.evaluate(''//div[@class="toc_item"]'', doc,
			nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		// Go through table rows
		while(tableRow = tableRows.iterateNext()) {
			var id = doc.evaluate(''.//input[@name="doi"]'', tableRow, nsResolver, XPathResult.ANY_TYPE,
				null).iterateNext().value;
			items[id] = Zotero.Utilities.cleanString(doc.evaluate(''.//label'', tableRow,
				nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		}
		
		var items = Zotero.selectItems(items);
		if(!items) return true;
		
		// find all fulltext links so we can determine where we can scrape the fulltext article
		var fulltextLinks = doc.evaluate(''//a[img[@alt="Full Text Article"]]'', doc,
			nsResolver, XPathResult.ANY_TYPE, null);
		var fulltextLink;
		while(fulltextLink = fulltextLinks.iterateNext()) {
			links.push(fulltextLink.href.toString());
		}
		
		for(var i in items) {
			post += "doi="+escape(i)+"&";
			
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
		var doi = unescape(m[1]);
		post += "doi="+escape(doi)+"&";
		
		if(url.indexOf("doi/full") != -1 ||
		  doc.evaluate(''//img[@alt="Full Text Article"]'', doc, nsResolver, XPathResult.ANY_TYPE,
		  null).iterateNext()) {
			fulltext[doi] = true;
		}
	}
	
	post += "include=abs&format=refman&direct=on&submit=Download+references";
	
	Zotero.Utilities.HTTP.doPost("http://www.blackwell-synergy.com/action/downloadCitation", post, function(text) {
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			item.attachments = [
				{url:item.url, title:"Blackwell Synergy Snapshot", mimeType:"text/html"},
				{url:item.url.replace("/doi/abs", "/doi/pdf"), title:"Blackwell Synergy Full Text PDF", mimeType:"application/pdf"}
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

REPLACE INTO translators VALUES ('f8765470-5ace-4a31-b4bd-4327b960ccd', '1.0.0b3.r1', '', '2007-03-24 22:20:00', 1, 100, 4, 'SpringerLink', 'Simon Kornblith', '^https?://(?:www\.springerlink\.com|springerlink.metapress.com)[^/]*/content/', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	if(doc.title == "SpringerLink - All Search Results" || doc.title == "SpringerLink - Journal Issue") {
		return "multiple";
	} else if(doc.title == "SpringerLink - Book Chapter") {
		return "bookSection";
	} else if(doc.evaluate(''//a[text() = "RIS"]'',
	          doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
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
	
	if(doc.title == "SpringerLink - All Search Results" || doc.title == "SpringerLink - Journal Issue") {		
		var items = Zotero.Utilities.getItemArray(doc, doc, ''/content/[^/]+/\\?p=[^&]+&pi='');
		
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
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			var url = urls.shift();
			var m = url.match(/https?:\/\/[^\/]+\/content\/[^\/]+\//);
			item.attachments = [
				{url:url, title:"SpringerLink Snapshot", mimeType:"text/html"},
				{url:m[0]+"fulltext.pdf", title:"SpringerLink Full Text PDF", mimeType:"application/pdf"}
			];
			
			// fix incorrect authors
			var oldCreators = item.creators;
			item.creators = new Array();
			for each(var creator in oldCreators) {
				item.creators.push(Zotero.Utilities.cleanAuthor(creator.lastName, "author"));
			}
			
			// fix incorrect chapters
			Zotero.debug(item);
			if(item.publicationTitle && item.itemType == "book") item.itemType = "bookSection";
			
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

REPLACE INTO translators VALUES ('6614a99-479a-4524-8e30-686e4d66663e', '1.0.0b3.r1', '', '2007-03-24 22:20:00', 1, 100, 4, 'Nature', 'Simon Kornblith', '^https?://www\.nature\.com[^/]*/(?:[^/]+/journal/v[^/]+/n[^/]+/(?:(?:full|abs)/.+\.html|index.html)|search/executeSearch)', 
'function detectWeb(doc, url) {
	var articleRe = /(https?:\/\/[^\/]+\/[^\/]+\/journal\/v[^\/]+\/n[^\/]+\/)(full|abs)(\/.+\.)html/;
	
	if(articleRe.test(url)) {
		return "journalArticle";
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
			item.date = item.date.replace("print ", "");
			
			item.complete();
		});
		translator.translate();
	}, function() { Zotero.done(); });
		
	Zotero.wait();
}');

REPLACE INTO translators VALUES ('92d4ed84-8d0-4d3c-941f-d4b9124cfbb', '1.0.0b3.r1', '', '2007-03-24 22:20:00', 1, 100, 4, 'IEEE Xplore', 'Simon Kornblith', '^https?://ieeexplore.ieee.org[^/]*/(?:[^\?]+\?(?:|.*&)arnumber=[0-9]+|search/(?:searchresult.jsp|selected.jsp))', 
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
		arnumber += "%3Carnumber%3E"+m[1]+"%3C%2Farnumber%3E";
	}
	
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
			Zotero.debug(url);
			var is = isRe.exec(url);
			var pu = puRe.exec(url);
			var arnumber = articleRe.exec(url);
			
			if(is && pu) {
				item.url = "http://ieeexplore.ieee.org/iel5/"+pu[1]+"/"+is[1]+"/"+Zotero.Utilities.lpad(arnumber[1], "0", 8)+".pdf";
				item.attachments = [{title:"IEEE Xplore Full Text PDF", mimeType:"application/pdf", url:item.url}];
			}
			
			if(item.notes[0] && item.notes[0].note) {
				item.abstractNote = item.notes[0].note;
				item.notes = new Array();
			}
			
			item.complete();
		});
		translator.translate();
		
		Zotero.done();
	});
		
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

REPLACE INTO translators VALUES ('82174f4f-8c13-403b-99b2-affc7bc7769b', '1.0.0b3.r1', '', '2007-03-28 00:45:00', '1', '100', '4', 'Cambridge Scientific Abstracts', 'Simon Kornblith', 'https?://[^/]+/ids70/(?:results.php|view_record.php)', 
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
		type = Zotero.Utilities.cleanString(type.textContent);
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
	newItem.title = Zotero.Utilities.cleanString(doc.evaluate(''//tr/td[3][@class="data_emphasis"]'', doc, nsResolver,
		XPathResult.ANY_TYPE, null).iterateNext().textContent);
	
	var dataRows = doc.evaluate(''//tr[td[3][@class="data_content"]]'', doc, nsResolver,
		XPathResult.ANY_TYPE, null);
	var dataRow;
	while(dataRow = dataRows.iterateNext()) {
		var tds = dataRow.getElementsByTagName("td");
		var heading = Zotero.Utilities.cleanString(tds[0].textContent).toLowerCase();
		var content = Zotero.Utilities.cleanString(tds[2].textContent);
		
		if(heading == "database") {
			newItem.repository = "Cambridge Scientific Abstracts ("+content+")";
		} else if(heading == "author") {
			var authors = content.split("; ");
			for each(var author in authors) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author", true));
			}
		} else if(heading == "source") {
			if(itemType == "journalArticle") {
				var parts = content.split(",");
				newItem.publicationTitle = parts.shift();
				
				var last = parts.pop();
				var m = last.match(/([0-9]+)\(([0-9]+)\):([0-9]+)$/);
				if(m) {
					newItem.volume = m[1];
					newItem.issue = m[2];
					newItem.pages = m[3];
				}
				
				var volMatch = /vol\.? ([0-9]+)/i;
				var noMatch = /no\.? ([0-9]+)/i;
				var ppMatch = /pp\.? ([\-0-9]+)/i;
				
				for each(var part in parts) {
					var m = volMatch.exec(part);
					if(m) {
						newItem.volume = m[1];
					} else {
						var m = noMatch.exec(part);
						if(m) {
							newItem.issue = m[1];
						} else {
							var m = ppMatch.exec(part);
							if(m) {
								newItem.pages = m[1];
							}
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

REPLACE INTO translators VALUES ('e78d20f7-488-4023-831-dfe39679f3f', '1.0.0b3.r1', '', '2007-03-24 22:20:00', '1', '100', '4', 'ACM', 'Simon Kornblith', '^https?://portal\.acm\.org[^/]*/(?:results\.cfm|citation\.cfm)', 
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
		keywords.push(keywordLink.textContent.toLowerCase());
	}
	
	Zotero.Utilities.HTTP.doGet("http://portal.acm.org/"+m[1], function(text) {
		var m = text.split(/<\/?pre[^>]*>/ig);
		var text = m[1];
		
		// load Refer translator
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("881f60f2-0802-411a-9228-ce5f47b64c7d");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			if(abstract) item.abstractNote = abstract;
			item.attachments = attachments;
			item.tags = keywords;
			item.type = undefined;
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

REPLACE INTO translators VALUES ('21ad38-3830-4836-aed7-7b5c2dbfa740', '1.0.0b3.r1', '', '2007-01-10 05:00:00', '1', '100', '4', 'ISI Web of Knowledge', 'Simon Kornblith', '^https?://[^/]+/(?:[^/]+/CIW\.cgi|portal\.cgi)', 
'function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	// require a link to Thomson at the bottom, to weed out other CGIs that
	// happen to be called CIW.cgi
	if(!doc.evaluate(''//p[@class="copyright"]/a[@href="http://www.thomson.com/scientific/scientific.jsp"]'',
		doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return false;
	}
	
	if(doc.title.substr(0, 11) == "Full Record") {
		return "journalArticle";
	} else if(doc.title.substr(0, 14) == "Search Results") {
		return "multiple";
	}
	
	return false;
}', 
'function query(formAction, post, docOrUrls, done) {
	post = post.substr(1)+"&fields=FullNoCitRef";
	
	Zotero.Utilities.HTTP.doPost(formAction, post, function(text) {
		var m = text.match(/<a href="(uml_view.cgi[^"]+)">/);
		var newURL = "http://portal.isiknowledge.com/uml/"+m[1];
		Zotero.Utilities.HTTP.doGet(newURL, function(text) {
			var lines = text.split("\n");
			
			var fieldRe = /^[A-Z0-9]{2}(?: |$)/;
			var field, content, item, authors;
			
			for each(var line in lines) {
				if(fieldRe.test(line)) {
					if(item && field && content) {
						if(field == "AF") {
							// returns need to be processed separately when dealing with authors
							authors = content;
						} else if(field == "AU" && !authors)  {
							authors = content;
						} else {
							content = content.replace(/\n/g, " ");
							if(field == "TI") {
								item.title = content;
							} else if(field == "SO") {
								item.publicationTitle = content;
							} else if(field == "DE" || field == "ID" || field == "SC") {
								item.tags = item.tags.concat(content.split("; "));
							} else if(field == "AB") {
								item.abstractNote = content;
							} else if(field == "PB") {
								item.publisher = content;
							} else if(field == "PI") {
								item.place = content;
							} else if(field == "SN") {
								item.ISSN = content;
							} else if(field == "JI") {
								item.journalAbbreviation = content;
							} else if(field == "PD") {
								if(item.date) {
									item.date = content+" "+item.date;
								} else {
									item.date = content;
								}
							} else if(field == "PY") {
								if(item.date) {
									item.date += " "+content;
								} else {
									item.date = content;
								}
							} else if(field == "VL") {
								item.volume = content;
							} else if(field == "IS") {
								item.issue = content;
							} else if(field == "BP") {
								item.pages = content;
							} else if(field == "EP") {
								if(!item.pages) {
									item.pages = content;
								} else if(item.pages != content) {
									item.pages += "-"+content;
								}
							}
						}
					}
					
					var field = line.substr(0, 2);
					var content = Zotero.Utilities.cleanString(line.substr(3));
					if(field == "PT") {
						// theoretically, there could be book types, but I don''t know what the codes
						// are and Thomson is unlikely to help me figure that out
						item = new Zotero.Item("journalArticle");
						if(docOrUrls.location) {
							item.attachments = [{title:"ISI Web of Science Snapshot", document:docOrUrls}];
						} else {
							item.attachments = [{title:"ISI Web of Science Snapshot", url:docOrUrls.shift(), mimeType:"text/html"}];
						}
						field = content = undefined;
					} else if(field == "ER") {
						if(authors) {
							authors = authors.split("\n");
							for each(var author in authors) {
								item.creators.push(Zotero.Utilities.cleanAuthor(author, "author", true));
							}
						}
						
						item.complete();
						item = field = content = authors = undefined;
					}
				} else {
					content += "\n"+Zotero.Utilities.cleanString(line);
				}
			}
			
			if(done) {
				done();
			} else {
				Zotero.done();
			}
		});
	});
}

function crossSearchFetch(services, SID) {
	// if we''ve fetched everything, we''re done
	if(!services.length) {
		Zotero.done();
		return;
	}
	var service = services.shift();
	Zotero.debug(service);
	
	// execute requests
	var post = "&SID="+SID+"&all_summary_UTs="+service.items.join("%3B");
	
	// add marked_list_candidates
	var i = 1;
	for each(var marked_list_candidate in service.items) {
		post += "&marked_list_candidates="+marked_list_candidate+"%2F"+i;
	}
	post += "&mark_selection=selected_records&Export.x=10&Export.y=10";
	
	// do query
	query(service.URL, post, service.itemURLs, function() { crossSearchFetch(services, SID) });
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == ''x'') return namespace; else return null;
	} : null;
	
	var post = "";
	
	// get hidden fields to add to post string
	var hiddenFields = doc.evaluate(''//input[@type="hidden"]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var hiddenField;
	while(hiddenField = hiddenFields.iterateNext()) {
		post += "&"+hiddenField.name+"="+encodeURIComponent(hiddenField.value);
	}
	
	if(doc.title.substr(0, 14) == "Search Results") {
		var items = new Array();
		var links = new Array();
		var tableRow;
		
		if(url.indexOf("/portal.cgi") != -1 || url.indexOf("/XS/CIW.cgi") != -1) {
			// CrossSearch
			var tableRows = doc.evaluate(''//tr[td/span/input[@name="marked_list_candidates"]]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
			while(tableRow = tableRows.iterateNext()) {
				var id = tableRow.getElementsByTagName("input")[0].value;
				
				items[id] = tableRow.getElementsByTagName("b")[0].textContent;
				
				var linkList = tableRow.getElementsByTagName("a");
				for each(var link in linkList) {
					if(link.href && link.href.indexOf("&Func=TransferToPublisher&") != -1) {
						links[id] = link.href;
						break;
					}
				}
			}
			
			items = Zotero.selectItems(items);
			if(!items) return true;
			
			var serviceRe = /^(https?:\/\/[^\/]+\/).*%26SrcAuth%3D([^%]+)%26/;
			var queries = new Object();
			var urls = new Object();
			
			// contains an array of service objects with service, URL, itemURLs, and items properties
			var services = new Array();
			
			// build up object of request URL => [marked_list_candidates]
			for(var id in items) {
				var foundService = null;
				
				var m = serviceRe.exec(links[id]);
				for each(var service in services) {
					if(service.service == m[2]) {
						foundService = service;
						break;
					}
				}
				
				if(!foundService) {
					foundService = new Object();
					foundService.service = m[2];
					foundService.URL = m[1]+m[2]+"/CIW.cgi";
					foundService.itemURLs = new Array();
					foundService.items = new Array();
					services.push(foundService);
				}
				
				foundService.items.push(id.substr(id.indexOf(":")+1));
				foundService.itemURLs.push(links[id]);
			}
			
			var SID = doc.getElementsByName("SID")[0].value;
			crossSearchFetch(services, SID);
		} else {
			var tableRows = doc.evaluate(''//tr[td/input[@name="marked_list_candidates"]]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
			while(tableRow = tableRows.iterateNext()) {
				var id = tableRow.getElementsByTagName("input")[0].value;
				var link = tableRow.getElementsByTagName("a")[0];
				items[id] = link.textContent;
				links[id] = link.href;
			}
			
			items = Zotero.selectItems(items);
			if(!items) return true;
			
			var urls = new Array();
			for(var code in items) {
				post += "&marked_list_candidates="+encodeURIComponent(code);
				urls.push(links[id]);
			}
			post += "&mark_selection=selected_records&Export.x=10&Export.y=10";
			
			// get form action
			var formAction = doc.getElementsByTagName("form")[0].action;
			// run query
			query(formAction, post, urls);
		}
	} else {
		post += "&ExportOne.x=10&ExportOne.y=10"
		
		// get form action
		var formAction = doc.getElementsByTagName("form")[0].action;
		// run query
		query(formAction, post, doc);
	}
	
	Zotero.wait();
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

REPLACE INTO translators VALUES ('5eacdb93-20b9-4c46-a89b-523f62935ae4', '1.0.0b3.r1', '', '2007-06-13 01:00:00', '1', '100', '4', 'HighWire', 'Simon Kornblith', '^http://[^/]+/(?:cgi/searchresults|cgi/search|cgi/content/(?:abstract|full|short|summary)|current.dtl$|content/vol[0-9]+/issue[0-9]+/(?:index.dtl)?$)', 
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
			var baseURL = m[0]+"/cgi/citmgr?type=refman";
			
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

REPLACE INTO translators VALUES ('938ebe32-2b2e-4349-a5b3-b3a05d3de627', '1.0.0b3.r1', '', '2007-04-29 17:30:00', '1', '100', '4', 'ACS Publications', 'Sean Takats', '[^/]*/(?:wls/journals/query/subscriberResults\.html|acs/journals/toc.page|cgi-bin/(?:article|abstract|sample).cgi/[^/]+/[0-9]+/[0-9]+/i[0-9]+/(?:html|abs)/[^\.]+.html)', 
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
				Zotero.debug("takats PDF: "+pdf); 
				if(pdf) {
					item.attachments.push({
					title:"ACS Full Text PDF",
					url:pdf, mimeType:"application/pdf"
					});
				}
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

	var jids = doc.evaluate(''//tr//tr[td//input[@name="jid"]]'',doc, nsResolver, XPathResult.ANY_TYPE, null);
	var jid = jids.iterateNext();
	if(jid) {
		// search page
		var items = new Array();
		var titles = doc.evaluate(''//form[@name="citationSelect"]//tbody/tr[1]//span[@class="textbold"][1]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var jids = doc.evaluate(''//form[@name="citationSelect"]//input[@name="jid"]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var links = doc.evaluate(''//form[@name="citationSelect"]//tbody/tr[2]//a[@class="link"]'', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var title;
		var jid;
		var id;
		var link;
		while ((title = titles.iterateNext()) && (jid = jids.iterateNext())){
			id = jid.value
			items[id] = Zotero.Utilities.cleanString(title.textContent);

			var link = doc.evaluate(''../../..//a[substring(text(), 1, 3) = "PDF"]'', title, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if(link) {
					Zotero.debug(link.href);
					links[id] = link.href;
				}
		}

		items = Zotero.selectItems(items);
		if(!items) return true;

		var getstring = "";
		for(var i in items) {
			getstring = getstring + "jid=" + encodeURIComponent(i) + "&";
			pdfs.push(links[i]+"?sessid=");
		}
		Zotero.debug(getstring);
		requests.push({jid:getstring});
	} else {
		// single page
		var jid = doc.evaluate(''//jid'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		jid = jid.substr(jid.indexOf("/")+1);
		var pdf = doc.evaluate(''/html/body/a[text()="[PDF version of this article]"]'', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if(pdf) pdf = pdf.href;

		var requests = [{jid:"jid=" + encodeURIComponent(jid)}]; 
		pdfs.push(pdf+"?sessid=");
	}

	handleRequests(requests, pdfs);

	Zotero.wait();
}');

REPLACE INTO translators VALUES ('1b9ed730-69c7-40b0-8a06-517a89a3a278', '1.0.0b3r1', '', '2007-01-24 01:35:00', '0', '100', '4', 'Sudoc', 'Sean Takats', '^http://www\.sudoc\.abes\.fr', 
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

REPLACE INTO translators VALUES ('c73a4a8c-3ef1-4ec8-8229-7531ee384cc4', '1.0.0b3.r1', '', '2007-03-22 18:15:00', 1, 100, 12, 'Open WorldCat (Web)', 'Sean Takats', '^http://(?:www\.)?worldcat\.org/search\?',
'function detectWeb(doc, url){
	var nsResolver = doc.createNSResolver(doc.documentElement);

	var xpath = ''//table[@class="tableResults"]/tbody/tr/td[2][@class="result"]/div[@class="name"]/a/strong'';
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
	var xpath = ''//table[@class="tableResults"]/tbody/tr/td[2][@class="result"]/div[@class="name"]/a'';
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

REPLACE INTO translators VALUES ('11645bd1-0420-45c1-badb-53fb41eeb753', '1.0.0b3.r1', '', '2006-11-27 22:45:00', 1, 100, 8, 'CrossRef', 'Simon Kornblith', 'http://partneraccess.oclc.org/',
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
	
	Zotero.Utilities.HTTP.doGet("http://www.crossref.org/openurl/?"+co+"&noredirect=true", function(responseText) {
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

REPLACE INTO translators VALUES ('14763d24-8ba0-45df-8f52-b8d1108e7ac9', '1.0.0b4.r1', '', '2007-04-26 09:00:00', 1, 25, 2, 'Zotero RDF', 'Simon Kornblith', 'rdf',
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

var container, containerElement;

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
	var collectionResource = "#collection:"+collection.id;
	Zotero.RDF.addStatement(collectionResource, rdf+"type", n.z+"Collection", false);
	Zotero.RDF.addStatement(collectionResource, n.dc+"title", collection.name, true);
	
	for each(var child in collection.descendents) {
		// add child list items
		if(child.type == "collection") {
			Zotero.RDF.addStatement(collectionResource, n.dcterms+"hasPart", "#collection:"+child.id, false);
			// do recursive processing of collections
			generateCollection(child);
		} else if(itemResources[child.id]) {
			Zotero.RDF.addStatement(collectionResource, n.dcterms+"hasPart", itemResources[child.id], false);
		}
	}
}

function generateItem(item, zoteroType, resource) {
	container = null;
	containerElement = null;
	
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
			containerElement = "urn:issn:"+item.ISSN
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
			itemResources[item.itemID] = "#item:"+item.itemID;
		}
		
		for(var j in item.notes) {
			itemResources[item.notes[j].itemID] = "#item:"+item.notes[j].itemID;
		}
		
		for each(var attachment in item.attachments) {
			// just specify a node ID
			itemResources[attachment.itemID] = "#item:"+attachment.itemID;
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

REPLACE INTO translators VALUES ('32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7', '1.0.0b4.r1', '', '2007-03-28 00:45:00', '1', '100', '3', 'RIS', 'Simon Kornblith', 'ris', 
'Zotero.configure("dataMode", "line");
Zotero.addOption("exportNotes", true);

function detectImport() {
	var line;
	var i = 0;
	while((line = Zotero.read()) !== "false") {
		line = line.replace(/^\s+/, "");
		if(line != "") {
			if(line.substr(0, 6) == "TY  - ") {
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
	VL:"volume",
	IS:"issue",
	CP:"place",
	PB:"publisher",
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
		// primary author
		var names = value.split(/, ?/);
		item.creators.push({lastName:names[0], firstName:names[1], creatorType:"author"});
	} else if(tag == "A2" || tag == "ED") {
		// contributing author
		var names = value.split(/, ?/);
		item.creators.push({lastName:names[0], firstName:names[1], creatorType:"contributor"});
	} else if(tag == "Y1" || tag == "PY") {
		// year or date
		var dateParts = value.split("/");

		if(dateParts.length == 1) {
			// technically, if there''s only one date part, the file isn''t valid
			// RIS, but EndNote writes this, so we have to too
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
		var dateParts = value.split("/");
		if(dateParts.length != 4) {
			// an invalid date. it''s from EndNote.
			if(item.date && value.indexOf(item.date) == -1) {
				// append existing year
				value += " " + item.date;
			}
			item.date = value;
		}
	} else if(tag == "N1" || tag == "AB") {
		// notes
		if(value != item.title) {       // why does EndNote do this!?
			item.notes.push({note:value});
		}
	} else if(tag == "N2") {
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
	} while(line !== false && line.substr(0, 6) != "TY  - ");

	var item = new Zotero.Item();
	var i = 0;
	if(attachments && attachments[i]) {
		item.attachments = attachments[i];
	}

	var tag = "TY";
	var data = line.substr(6);
	var rawLine;
	while((rawLine = Zotero.read()) !== false) {    // until EOF
		// trim leading space if this line is not part of a note
		line = rawLine.replace(/^\s+/, "");
		Zotero.debug("line is "+rawLine);
		if(line.substr(2, 4) == "  - " || line == "ER  -") {
			// if this line is a tag, take a look at the previous line to map
			// its tag
			if(tag) {
				processTag(item, tag, data);
			}

			// then fetch the tag and data from this line
			tag = line.substr(0,2);
			data = line.substr(6);

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
			var risTag = "A1"
			if(item.creators[j].creatorType != "author") {
				risTag = "A2";
			}

			addTag(risTag, item.creators[j].lastName+","+item.creators[j].firstName);
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

REPLACE INTO translators VALUES ('881f60f2-0802-411a-9228-ce5f47b64c7d', '1.0.0b4.r1', '', '2007-03-28 00:45:00', 1, 100, 3, 'EndNote/Refer/BibIX', 'Simon Kornblith', 'txt',
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

REPLACE INTO translators VALUES ('9cb70025-a888-4a29-a210-93ec52da40d4', '1.0.0b4.r1', '', '2007-04-24 15:30:00', 1, 100, 3, 'BibTeX', 'Simon Kornblith', 'bib',
'Zotero.configure("dataMode", "block");

function detectImport() {
	var block = "";
	var read;
	// read 20 chars out of the file
	while(read = Zotero.read(1)) {
		if(read == "%") {
			// read until next newline
			block = "";
			while(Zotero.read(1) != "\n") {}
		} else if(read == "\n" && block) {
			break;
		} else if(" \n\r\t".indexOf(read) == -1) {
			block += read;
		}
	}
	
	var re = /^@[a-zA-Z]+[\(\{]/;
	if(re.test(block)) {
		return true;
	}
}',
'var fieldMap = {
	address:"place",
	chapter:"section",
	edition:"edition",
	number:"issue",
	type:"type",
	series:"series",
	title:"title",
	volume:"volume",
	copyright:"rights",
	isbn:"ISBN",
	issn:"ISSN",
	location:"archiveLocation",
	url:"url",
	"abstract":"abstractNote"
};

var inputFieldMap = {
	booktitle :"publicationTitle",
	school:"publisher",
	publisher:"publisher"
};

var typeMap = {
	book:"book",
	bookSection:"inbook",
	journalArticle:"article",
	magazineArticle:"article",
	newspaperArticle:"article",
	thesis:"phdthesis",
	letter:"misc",
	manuscript:"unpublished",
	interview:"misc",
	film:"misc",
	artwork:"misc",
	webpage:"misc",
	conferencePaper:"inproceedings"
};

// supplements outputTypeMap for importing
var inputTypeMap = {
	conference:"inproceedings",
	techreport:"report",
	booklet:"book",
	incollection:"bookSection",
	manual:"book",
	mastersthesis:"thesis",
	misc:"book",
	proceedings:"book"
};

/*
 * three-letter month abbreviations. i assume these are the same ones that the
 * docs say are defined in some appendix of the LaTeX book. (i don''t have the
 * LaTeX book.)
 */
var months = ["jan", "feb", "mar", "apr", "may", "jun",
              "jul", "aug", "sep", "oct", "nov", "dec"]

/*
 * this is the character table for converting TeX to Unicode. sorry, Czech
 * speakers; you''ll have to add your own (or stop using BibTeX!)
 */
var accentedCharacters = {
	// grave accents
	192:"\\`A", 224:"\\`a",
	200:"\\`E", 232:"\\`e",
	204:"\\`I", 236:"\\`i",
	210:"\\`O", 242:"\\`o",
	217:"\\`U", 249:"\\`u",
	// acute accents
	193:"\\''A", 225:"\\''a",
	201:"\\''E", 233:"\\''e",
	205:"\\''I", 237:"\\''i",
	211:"\\''O", 243:"\\''o",
	218:"\\''U", 250:"\\''u",
	// circumflexes
	194:"\\^A", 226:"\\^a",
	202:"\\^E", 234:"\\^e",
	206:"\\^I", 238:"\\^i",
	212:"\\^O", 244:"\\^o",
	219:"\\^U", 251:"\\^u",
	// tildes
	195:"\\~A", 227:"\\~a",
	213:"\\~O", 245:"\\~o",
	209:"\\~N", 241:"\\~n",
	// umlauts
	196:''\\"A'', 228:''\\"a'',
	203:''\\"E'', 235:''\\"e'',
	207:''\\"I'', 239:''\\"i'',
	214:''\\"O'', 246:''\\"o'',
	220:''\\"U'', 252:''\\"u'',
	// cidillas
	191:"\\c{C}", 231:"\\c{c}",
	// AE norwegian tings
	198:"{\\AE}", 230:"{\\ae}",
	// o norwegian things
	216:"{\\o}", 248:"{\\O}",
	// a norweigan things
	197:"{\\AA}", 229:"{\\aa}"
};

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
		item.extra += "\nPublished: "+value;
	} else if(field == "keywords") {
		if(value.indexOf(",") == -1) {
			// keywords/tags
			item.tags = value.split(" ");
		} else {
			item.tags = value.split(/, ?/g);
		}
	}
}

function getFieldValue() {
	// read whitespace
	var read = Zotero.read(1);
	while(" \n\r\t".indexOf(read) != -1) {
		read = Zotero.read(1);
	}
	
	var value = "";
	// now, we have the first character of the field
	if("0123456789".indexOf(read) != -1) {
		value += read;
		// character is a number
		while((read = Zotero.read(1)) && ("0123456789".indexOf(read) != -1)) {
			value += read;
		}
	} else if(read == "{") {
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
		for(var i in accentedCharacters) {
			value = value.replace(accentedCharacters[i], i);
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
	if(inputTypeMap[type]) {
		var item = new Zotero.Item(inputTypeMap[type]);
	} else {
		for(var i in typeMap) {
			if(typeMap[i] == type) {
				var item = new Zotero.Item(i);
				break;
			}
		}
		if(!item) {
			Zotero.debug("discarded item from BibTeX; type was "+type);
		}
	}
	
	item.extra = "";
	
	var field = "";
	while(read = Zotero.read(1)) {
		if(read == "=") {								// equals begin a field
			var value = getFieldValue();
			if(item) {
				processField(item, field.toLowerCase(), value);
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
	// make regular expressions out of values
	var newArray = new Array();
	for(var i in accentedCharacters) {
		newArray[String.fromCharCode(i)] = new RegExp(accentedCharacters[i].replace(/\\/g, "\\\\"), "g");
	}
	accentedCharacters = newArray;
	
	var read = "", text = "", recordCloseElement = false;
	var type = false;
	
	while(read = Zotero.read(1)) {
		if(read == "@") {
			type = "";
		} else if(type !== false) {
			if(read == "{") {				// possible open character
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
function writeMacroField(field, value) {
	if (!value) {
		return;
	}
	
	value = value.toString();
	// replace naughty chars
	value = value.replace(/([#$%&~_^\\{}])/g, "\\$1");
	
	// replace accented characters	
	for (var i in accentedCharacters) {
		value = value.replace(accentedCharacters[i], i);
	}
	// replace other accented characters
	value = value.replace(/[\u0080-\uFFFF]/g, "?")
	
	// write
	Zotero.write(",\n\t"+field+" = "+value);
}

function writeField(field, value) {
	if(!value) return;
	
	value = value.toString();
	// replace naughty chars
	value = value.replace(/([#$%&~_^\\{}])/g, "\\$1");
	// we assume people who use braces in their title probably did so intentionally
	if (field == "title") {
		value = value.replace(/\\([{}])/g, "$1");
	}
	// replace accented characters	
	for (var i in accentedCharacters) {
		value = value.replace(accentedCharacters[i], i);
	}
	// replace other accented characters
	value = value.replace(/[\u0080-\uFFFF]/g, "?")
	
	// write
	Zotero.write(",\n\t"+field+" = {"+value+"}");
}

var numberRe = /^[0-9]+/;
function doExport() {
	// switch keys and values of accented characters
	var newArray = new Array();
	for(var i in accentedCharacters) {
		newArray["{"+accentedCharacters[i]+"}"] = new RegExp(String.fromCharCode(i), "g");
	}
	accentedCharacters = newArray;
	
	//Zotero.write("% BibTeX export generated by Zotero "+Zotero.Utilities.getVersion());
	
	var first = true;
	var citekeys = new Object();
	var item;
	while(item = Zotero.nextItem()) {
		// determine type
		var type = typeMap[item.itemType];
		if(!type) type = "misc";
		
		// create a unique citation key
		var basekey = "";
		if(item.creators && item.creators[0] && item.creators[0].lastName) {
			basekey = item.creators[0].lastName.toLowerCase().replace(/ /g,"_").replace(/,/g,"");
		}
		
		// include the item title as part of the citation key
		if (item["title"]) {
			// this is a list of words that should not appear as part of the citation key
			var bannedTitleKeys = {"a" : 1, "an" : 1, "does": 1, "how": 1, "it''s": 1, "on" : 1, "some": 1, "the" : 1, "this" : 1, "why" : 1 };
			var titleElements = item["title"].split(" ");
			var appendKey = "";
			for (te in titleElements) {
				if (!bannedTitleKeys[titleElements[te].toLowerCase()]) {
					appendKey = "_" + titleElements[te].toLowerCase() + "_";
					break;
					}
				}
				basekey = basekey + appendKey;
        }

		if(item.date) {
			var date = Zotero.Utilities.strToDate(item.date);
			if(date.year && numberRe.test(date.year)) {
				basekey += date.year;
			}
		}
		
		// make sure we do not have any other funny characters
		basekey = basekey.replace(/[\. ,'':\"!&]/g,"");
		var citekey = basekey;
		var i = 0;
		while(citekeys[citekey]) {
			i++;
			citekey = basekey+"-"+i;
		}
		citekeys[citekey] = true;
		
		// write citation key
		Zotero.write((first ? "" : ",\n\n") + "@"+type+"{"+citekey);
		first = false;
		
		for(var field in fieldMap) {
			if(item[fieldMap[field]]) {
				writeField(field, item[fieldMap[field]]);
			}
		}
		
		if(item.conferenceName) {
			writeField("booktitle", item.conferenceName);
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
			// need to use non-localized abbreviation
			if(date.month) {
				writeMacroField("month", months[date.month]);
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
		
		Zotero.write("\n}");
	}
}');

REPLACE INTO translators VALUES ('a6ee60df-1ddc-4aae-bb25-45e0537be973', '1.0.0b3.r1', '', '2007-03-28 19:15:00', 1, 100, 1, 'MARC', 'Simon Kornblith', 'marc',
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

REPLACE INTO translators VALUES ('3f50aaac-7acc-4350-acd0-59cb77faf620', '1.0.0b4.r1', '', '2007-04-24 15:30:00', 1, 100, 2, 'Wikipedia Citation Templates', 'Simon Kornblith', '', NULL,
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
				properties.date = formatDate(item.date);
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

REPLACE INTO csl VALUES('http://purl.org/net/xbiblio/csl/styles/apa.csl', '2007-06-13 01:00:00', 'American Psychological Association',
'<?xml version="1.0" encoding="UTF-8"?>
<?oxygen RNGSchema="../schema/trunk/csl.rnc" type="compact"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="author-date" xml:lang="en">
  <info>
    <title>American Psychological Association</title>
    <id>http://purl.org/net/xbiblio/csl/styles/apa.csl</id>
    <link>http://purl.org/net/xbiblio/csl/styles/apa.csl</link>
    <author>
      <name>Bruce D’Arcus</name>
      <email>bdarcus@sourceforge.net</email>
    </author>
    <contributor>
      <name>Simon Kornblith</name>
      <email>simon@simonster.com</email>
    </contributor>
    <contributor>
      <name>Johan Kool</name>
      <email>johankool@users.sourceforge.net</email>
    </contributor>
    <updated>2006-09-04T20:14:00+05:00</updated>
  </info>
  <defaults>
    <contributor name-as-sort-order="no">
      <name and="symbol" initialize-with="." delimiter=", " delimiter-precedes-last="always"/>
      <label form="short" prefix=", " text-transform="capitalize" suffix="."/>
    </contributor>
    <author name-as-sort-order="all">
      <name and="symbol" sort-separator=", " initialize-with="." delimiter=", " delimiter-precedes-last="always"/>
      <label form="short" prefix=" (" suffix=".)" text-transform="capitalize"/>
      <substitute>
        <choose>
          <editor/>
          <translator/>
          <titles/>
        </choose>
      </substitute>
    </author>
    <locator>
      <number/>
    </locator>
    <identifier>
      <number/>
    </identifier>
    <titles>
      <title/>
    </titles>
    <date>
      <year/>
      <month prefix=", "/>
      <day prefix=" "/>
    </date>
    <access>
      <text term-name="retrieved" text-transform="capitalize" suffix=" "/>
      <date suffix=", ">
        <month suffix=" "/>
        <day suffix=", "/>
        <year/>
      </date>
      <text term-name="from" suffix=" "/>
      <url/>
    </access>
  </defaults>
  <citation prefix="(" suffix=")" delimiter="; ">
    <et-al min-authors="6" use-first="1" position="first"/>
    <et-al min-authors="3" use-first="1" position="subsequent"/>
    <layout>
      <item>
        <author form="short">
        	<name and="symbol" delimiter=", "/>
        	<label form="short" prefix=", " text-transform="capitalize" suffix="."/>
        </author>
        <date prefix=", ">
          <year/>
        </date>
        <locator prefix=": "/>
      </item>
    </layout>
  </citation>
  <bibliography hanging-indent="true">
    <sort algorithm="author-date"/>
    <et-al min-authors="6" use-first="6"/>
    <layout>
      <list>
        <heading>
          <text term-name="references"/>
        </heading>
      </list>
      <item suffix=".">
        <choose>
          <type name="book">
            <author/>
            <date prefix=" (" suffix=").">
              <year/>
            </date>
            <group suffix=".">
              <titles font-style="italic" prefix=" "/>
              <group prefix=" (" suffix=")" delimiter=", ">
                <editor/>
                <translator/>
              </group>
            </group>
            <group prefix=" " delimiter=": ">
            	<publisher><place/></publisher>
            	<publisher><name/></publisher>
            </group>
            <access prefix=" "/>
          </type>
          <type name="chapter">
            <author/>
            <date prefix=" (" suffix=").">
              <year/>
            </date>
            <titles font-style="italic" prefix=" "/>
            <group class="container" prefix=" ">
              <text term-name="in" text-transform="capitalize"/>
              <editor prefix=" " suffix=",">
                <name and="symbol" sort-separator=", " initialize-with="."/>
                <label form="short" prefix=" (" suffix=")" text-transform="capitalize"/>
              </editor>
              <translator prefix=" " suffix=",">
                <name and="symbol" sort-separator=", " initialize-with="."/>
                <label form="short" prefix=" (" suffix=")" text-transform="capitalize"/>
              </translator>
              <titles relation="container" font-style="italic" prefix=" " suffix="."/>
              <titles relation="collection" prefix=" " suffix="."/>
				<group prefix=" " delimiter=": ">
					<publisher><place/></publisher>
					<publisher><name/></publisher>
				</group>
              <pages prefix=" (" suffix=")">
                <label form="short" text-transform="capitalize" suffix=". "/>
                <number/>
              </pages>
            </group>
             <access prefix=" "/>
          </type>
          <type name="article">
            <author/>
            <date prefix=" (" suffix=").">
              <year/>
            </date>
            <group suffix=".">
              <titles prefix=" "/>
              <group prefix=" (" suffix=")" delimiter=", ">
                <editor/>
                <translator/>
              </group>
            </group>
            <group class="container" prefix=" " suffix=".">
              <titles relation="container" font-style="italic"/>
              <volume prefix=", " font-style="italic"/>
              <issue prefix="(" suffix=")"/>
              <pages prefix=", "/>
            </group>
            <access prefix=" "/>
          </type>
        </choose>
      </item>
    </layout>
  </bibliography>
</style>');

REPLACE INTO csl VALUES('http://www.zotero.org/namespaces/CSL/chicago-author-date.csl', '2007-04-25 23:40:00', 'Chicago Manual of Style (Author-Date)',
'<?xml version="1.0" encoding="UTF-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="author-date" xml:lang="en">
	<info>
		<title>Chicago Reference List Style</title>
		<id>http://www.zotero.org/namespaces/CSL/chicago-author-date.csl</id>
		<author>
			<name>Simon Kornblith</name>
			<email>simon@simonster.com</email>
		</author>
		<updated>2006-12-20T03:33:00+05:00</updated>
		<summary>The author-date variant of the Chicago style.</summary>
	</info>
	<defaults>
		<contributor name-as-sort-order="no">
			<label form="verb-short" suffix=". "/>
			<name and="text" delimiter=", "/>
		</contributor>
		<author name-as-sort-order="first">
			<name and="text" sort-separator=", " delimiter=", " delimiter-precedes-last="always"/>
			<label form="short" prefix=", " suffix="."/>
			<substitute>
				<choose>
					<editor/>
					<translator/>
					<titles relation="container" font-style="italic"/>
					<titles/>
				</choose>
			</substitute>
		</author>
		<locator>
			<number/>
		</locator>
		<identifier>
			<number/>
		</identifier>
		<titles>
			<title/>
		</titles>
		<date>
			<year/>
		</date>
		<access>
			<url/>
			<date prefix=" (" suffix=")">
				<text term-name="accessed" suffix=" "/>
				<month suffix=" " text-transform="capitalize"/>
				<day suffix=", "/>
				<year/>
			</date>
		</access>
	</defaults>
	<citation prefix="(" suffix=")" delimiter="; ">
		<et-al min-authors="3" use-first="1"/>
		<layout>
			<item>
				<author form="short">
					<name and="text" delimiter=", "/>
				</author>
				<date prefix=" "/>
				<locator prefix=", "/>
			</item>
		</layout>
	</citation>
	<bibliography hanging-indent="true" subsequent-author-substitute="&#8212;&#8212;&#8212;">
		<sort algorithm="author-date"/>
		<et-al min-authors="6" use-first="6"/>
		<layout>
			<list>
				<heading>
					<text term-name="works cited"/>
				</heading>
			</list>
			<item suffix=".">
				<choose>
					<type name="book">
						<author suffix="."/>
						<conditional>
							<if field="date">
								<date prefix=" " suffix="."/>
							</if><else>
								<text term-name="no date" text-transform="capitalize" prefix=" " suffix="."/>
							</else>
						</conditional>
						<titles prefix=" " suffix="." font-style="italic"/>
						<group prefix=" " suffix="." delimiter=", " text-transform="capitalize">
							<editor/>
							<translator/>
						</group>
						<group prefix=" " suffix="." delimiter=": ">
							<publisher><place/></publisher>
							<publisher><name/></publisher>
						</group>
						<access prefix=" "/>
					</type>
					<type name="chapter">
						<author suffix="."/>
						<conditional>
							<if field="date">
								<date prefix=" " suffix="."/>
							</if><else>
								<text term-name="no date" text-transform="capitalize" prefix=" " suffix="."/>
							</else>
						</conditional>
						<titles prefix=" " suffix="."/>
						<group class="container" suffix=".">
							<text prefix=" " term-name="in" text-transform="capitalize"/>
							<titles prefix=" " relation="container" font-style="italic"/>
							<editor prefix=", "/>
							<translator prefix=", "/>
							<pages prefix=", "/>
							<group prefix=". " delimiter=": ">
								<publisher><place/></publisher>
								<publisher><name/></publisher>
							</group>
						</group>
						<access prefix=" "/>
					</type>
					<type name="article">
						<author suffix="."/>
						<date prefix=" " suffix="."/>
						<titles prefix=" " suffix="."/>
						<group prefix=" " suffix="." delimiter=", " text-transform="capitalize">
							<editor/>
							<translator/>
						</group>
						<group class="container" prefix=" " suffix="." delimiter=", ">
							<titles relation="container" font-style="italic"/>
							<date>
								<month text-transform="capitalize"/>
								<day prefix=" "/>
							</date>
						</group>
						<access prefix=" "/>
					</type>
					<type name="article-journal">
						<author suffix="."/>
						<date prefix=" " suffix="."/>
						<titles prefix=" " suffix="."/>
						<group prefix=" " suffix="." delimiter=", " text-transform="capitalize">
							<editor/>
							<translator/>
						</group>
						<group class="container" prefix=" " suffix=".">
							<titles relation="container" font-style="italic"/>
							<volume prefix=" "/>						
							<conditional>
								<if field="issue">
									<conditional>
										<if field="date">
											<issue prefix=", no. "/>
											<date prefix=" (" suffix=")">
												<month text-transform="capitalize"/>
												<day prefix=" "/>
											</date>
										</if><else>
											<issue prefix=" (" suffix=")"/>
										</else>
									</conditional>
									<pages prefix=": "/>
								</if><else>
									<pages prefix=":"/>
								</else>
							</conditional>
						</group>
						<access prefix=" "/>
					</type>
				</choose>
			</item>
		</layout>
	</bibliography>
</style>');

REPLACE INTO csl VALUES('http://purl.org/net/xbiblio/csl/styles/chicago-note.csl', '2007-03-23 19:25:00', 'Chicago Manual of Style (Note without Bibliography)',
'<?xml version="1.0" encoding="UTF-8"?>
<?oxygen RNGSchema="../schema/trunk/csl.rnc" type="compact"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="note" xml:lang="en">
  <info>
    <title>Chicago Note Sans Reference List</title>
    <id>http://purl.org/net/xbiblio/csl/styles/chicago-note.csl</id>
    <author>
      <name>Bruce D’Arcus</name>
      <email>bdarcus@sourceforge.net</email>
    </author>
    <contributor>
      <name>Simon Kornblith</name>
      <email>simon@simonster.com</email>
    </contributor>
    <contributor>
      <name>Johan Kool</name>
      <email>johankool@users.sourceforge.net</email>
    </contributor>
    <updated>2006-12-20T04:20:00+05:00</updated>
    <summary>The note-without-bibliography variant of the Chicago style.</summary>
  </info>
  <defaults>
    <contributor>
      <label form="short" suffix=". " text-transform="lowercase"/>
      <name and="text" delimiter=", "/>
    </contributor>
    <author>
      <name and="text" delimiter=", "/>
      <label form="short" prefix=", " suffix="." text-transform="lowercase"/>
      <substitute>
        <choose>
          <editor/>
          <translator/>
        </choose>
      </substitute>
    </author>
    <locator>
      <number/>
    </locator>
    <titles>
      <title/>
    </titles>
    <date>
      <month suffix=" " text-transform="capitalize"/>
      <day suffix=", "/>
      <year/>
    </date>
    <access>
      <url/>
      <date prefix=" (" suffix=")">
        <text term-name="accessed" suffix=" "/>
        <month suffix=" " text-transform="capitalize"/>
        <day suffix=", "/>
        <year/>
      </date>
    </access>
  </defaults>
  <citation suffix="." delimiter="; ">
    <et-al min-authors="4" use-first="1"/>
    <layout>
      <item>
        <choose>
          <type name="book">
            <group delimiter=", ">
              <author/>
              <titles font-style="italic"/>
              <editor/>
              <translator/>
            </group>
            <group prefix=" (" suffix=")" delimiter=", ">
              <group delimiter=": ">
            	<publisher><place/></publisher>
            	<publisher><name/></publisher>
              </group>
			  <conditional>
				<if field="date">
					<date><year/></date>
				</if><else>
					<text term-name="no date"/>
				</else>
			  </conditional>
            </group>
            <pages prefix=", "/>
            <access prefix=", "/>
          </type>
          <type name="chapter">
            <group delimiter=", ">
              <author/>
              <titles quotes="true"/>
            </group>
            <group class="container">
              <text prefix=", " term-name="in" text-transform="lowercase"/>
              <group delimiter=", ">
                <titles relation="container" prefix=" " font-style="italic"/>
                <editor/>
                <translator/>
              </group>
              <group prefix=" (" suffix=")" delimiter=", ">
                <group delimiter=": ">
            	  <publisher><place/></publisher>
            	  <publisher><name/></publisher>
                </group>
				<conditional>
					<if field="date">
						<date><year/></date>
					</if><else>
						<text term-name="no date"/>
					</else>
			    </conditional>
              </group>
              <pages prefix=", "/>
              <access prefix=", "/>
            </group>
          </type>
          <type name="article">
            <group delimiter=", ">
              <author/>
              <titles quotes="true"/>
              <titles relation="container" font-style="italic"/>
              <date/>
              <access/>
            </group>
          </type>
          <type name="article-journal">
            <group delimiter=", ">
              <author/>
              <titles quotes="true"/>
              <titles relation="container" font-style="italic"/>
            </group>
            <volume prefix=" "/>
            <issue prefix=", ">
              <label form="short" text-transform="lowercase" suffix=". "/>
              <number/>
            </issue>
            <date prefix=" (" suffix=")"/>
            <pages prefix=": "/>
            <access prefix=", "/>
          </type>
        </choose>
      </item>
      <item position="subsequent" ibid="true">
        <author form="short"/>
        <conditional>
          <if type="book">
            <titles prefix=", " font-style="italic" form="short"/>
          </if><else>
            <titles prefix=", " quotes="true" form="short"/>
          </else>
        </conditional>
        <pages prefix=", "/>
      </item>
    </layout>
  </citation>
</style>');

REPLACE INTO csl VALUES('http://www.zotero.org/namespaces/CSL/chicago-note-bibliography.csl', '2007-06-13 01:00:00', 'Chicago Manual of Style (Note with Bibliography)',
'<?xml version="1.0" encoding="UTF-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="note" xml:lang="en">
	<info>
		<title>Chicago Note With Bibliography Style</title>
		<id>http://www.zotero.org/namespaces/CSL/chicago-note-bibliography.csl</id>
		<author>
			<name>Simon Kornblith</name>
			<email>simon@simonster.com</email>
		</author>
		<updated>2006-12-20T03:29:00+05:00</updated>
		<summary>The note-with-bibliography variant of the Chicago style.</summary>
	</info>
	<defaults>
		<contributor name-as-sort-order="no">
			<label form="verb" suffix=" "/>
			<name and="text" delimiter=", "/>
		</contributor>
		<author name-as-sort-order="first">
			<name and="text" sort-separator=", " delimiter=", " delimiter-precedes-last="always"/>
			<label form="short" prefix=", " suffix="."/>
			<substitute>
				<choose>
					<editor/>
					<translator/>
					<titles relation="container" font-style="italic"/>
					<titles/>
				</choose>
			</substitute>
		</author>
		<locator>
			<number/>
		</locator>
		<identifier>
			<number/>
		</identifier>
		<titles>
			<title/>
		</titles>
		<date>
			<month suffix=" " text-transform="capitalize"/>
			<day suffix=", "/>
			<year/>
		</date>
		<access>
			<url/>
			<date prefix=" (" suffix=")">
				<text term-name="accessed" suffix=" "/>
				<month suffix=" " text-transform="capitalize"/>
				<day suffix=", "/>
				<year/>
			</date>
		</access>
	</defaults>
	<citation suffix="." delimiter="; ">
		<et-al min-authors="3" use-first="1"/>
		<layout>
			<item suffix=".">
				<author form="short">
					<name and="text" sort-separator=", " delimiter=", "/>
				</author>
				<conditional>
					<if type="book">
						<titles prefix=", " font-style="italic" form="short"/>
					</if><else>
						<titles prefix=", " quotes="true" form="short"/>
					</else>
				</conditional>
				<pages prefix=", "/>
			</item>
			<item suffix="." position="subsequent" ibid="true">
				<author form="short">
					<name and="text" sort-separator=", " delimiter=", "/>
				</author>
				<conditional>
					<if type="book">
						<titles prefix=", " font-style="italic" form="short"/>
					</if><else>
						<titles prefix=", " quotes="true" form="short"/>
					</else>
				</conditional>
				<pages prefix=", "/>
			</item>
		</layout>
	</citation>
	<bibliography hanging-indent="true" subsequent-author-substitute="&#8212;&#8212;&#8212;">
		<sort>
			<author name-as-sort-order="all"/>
			<titles/>
		</sort>
		<et-al min-authors="6" use-first="6"/>
		<layout>
			<list>
				<heading>
					<text term-name="works cited"/>
				</heading>
			</list>
			<item suffix=".">
				<choose>
					<type name="book">
						<author suffix="."/>
						<titles prefix=" " suffix="." font-style="italic"/>
						<group prefix=" " suffix="." delimiter=", " text-transform="capitalize">
							<editor/>
							<translator/>
						</group>
						<group prefix=" " suffix="." delimiter=", " text-transform="capitalize">
              				<group delimiter=": ">
            					<publisher><place/></publisher>
            					<publisher><name/></publisher>
              				</group>	
							<conditional>
								<if field="date">
									<date><year/></date>
								</if><else>
									<text term-name="no date"/>
								</else>
							</conditional>
						</group>
						<access prefix=" "/>
					</type>
					<type name="chapter">
						<author suffix="."/>
						<titles prefix=" " suffix="." quotes="true"/>
						<group class="container" suffix=".">
							<text prefix=" " term-name="in" text-transform="capitalize"/>
							<titles prefix=" " relation="container" font-style="italic"/>
							<editor prefix=", "/>
							<translator prefix=", "/>
							<pages prefix=", "/>
							<group prefix=". " delimiter=", ">
              					<group delimiter=": ">
            						<publisher><place/></publisher>
            						<publisher><name/></publisher>
              					</group>	
								<conditional>
									<if field="date">
										<date><year/></date>
									</if><else>
										<text term-name="no date"/>
									</else>
								</conditional>
							</group>
						</group>
						<access prefix=" "/>
					</type>
					<type name="article">
						<author suffix="."/>
						<titles prefix=" " quotes="true"/>
						<group prefix=" " suffix="." delimiter=", " text-transform="capitalize">
							<editor/>
							<translator/>
						</group>
						<group class="container" prefix=" " suffix="." delimiter=", ">
							<titles prefix=" " relation="container" font-style="italic"/>
							<date/>
						</group>
						<access prefix=" "/>
					</type>
					<type name="article-journal">
						<author suffix="."/>
						<titles prefix=" " suffix="." quotes="true"/>
						<group prefix=" " suffix="." delimiter=", " text-transform="capitalize">
							<editor/>
							<translator/>
						</group>
						<group class="container" prefix=" " suffix=".">
							<titles relation="container" font-style="italic"/>
							<volume prefix=" "/>			
							<issue prefix=", no. "/>
							<conditional>
								<if field="date">
									<date prefix=" (" suffix=")"/>	
									<pages prefix=": "/>
								</if><else>
									<pages prefix=":"/>
								</else>
							</conditional>
						</group>
						<access prefix=" "/>
					</type>
				</choose>
			</item>
		</layout>
	</bibliography>
</style>');

REPLACE INTO csl VALUES('http://purl.org/net/xbiblio/csl/styles/mla.csl', '2007-03-23 19:25:00', 'Modern Language Association',
'<?xml version="1.0" encoding="UTF-8"?>
<?oxygen RNGSchema="../schema/trunk/csl.rnc" type="compact"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="author" xml:lang="en">
  <info>
    <title>Modern Language Association</title>
    <id>http://purl.org/net/xbiblio/csl/styles/mla.csl</id>
    <link>http://purl.org/net/xbiblio/csl/styles/mla.csl</link>
    <author>
      <name>Bruce D’Arcus</name>
      <email>bdarcus@sourceforge.net</email>
    </author>
    <contributor>
      <name>Johan Kool</name>
      <email>johankool@users.sourceforge.net</email>
    </contributor>
    <contributor>
      <name>Simon Kornblith</name>
      <email>simon@simonster.com</email>
    </contributor>
    <updated>2006-09-04T20:28:00+05:00</updated>
  </info>
  <defaults>
    <contributor name-as-sort-order="first">
      <name and="text" sort-separator=", " delimiter=", " delimiter-precedes-last="always"/>
      <label form="short" prefix=", " suffix="."/>
    </contributor>
    <author>
      <substitute>
        <choose>
          <editor/>
          <titles/>
        </choose>
      </substitute>
    </author>
    <locator>
      <number/>
    </locator>
    <titles>
      <title/>
    </titles>
    <date>
      <year/>
    </date>
    <access>
      <date>
        <day suffix=" "/>
        <month suffix=" "/>
        <year/>
      </date>
      <url prefix=" &lt;" suffix="&gt;"/>
    </access>
  </defaults>
  <citation prefix="(" suffix=")" delimiter="; ">
    <et-al min-authors="6" use-first="6" position="first"/>
    <et-al min-authors="6" use-first="1" position="subsequent"/>
    <layout>
      <item>
        <author form="short">
          <name and="text" sort-separator=", " delimiter=", "/>
        </author>
        <locator prefix=" "/>
      </item>
    </layout>
  </citation>
  <bibliography subsequent-author-substitute="---">
    <sort algorithm="author-date"/>
    <et-al min-authors="4" use-first="1"/>
    <layout>
      <list>
        <heading>
          <text term-name="references"/>
        </heading>
      </list>
      <item>
        <choose>
          <type name="book">
            <author suffix="."/>
            <titles font-style="italic" prefix=" " suffix="."/>
            <group prefix=" " suffix="." delimiter=", ">
              <edition/>
			  <group delimiter=": ">
				<publisher><place/></publisher>
				<publisher><name/></publisher>
			  </group>
              <date/>
            </group>
            <access prefix=" " suffix="."/>
          </type>
          <type name="chapter">
            <author suffix="."/>
            <titles prefix=" &#8220;" suffix=".&#8221;"/>
            <group class="container" prefix=" " suffix=".">
              <titles relation="container" font-style="italic" suffix="."/>
              <editor prefix=" " suffix=".">
      	        <label form="short" suffix=". " text-transform="capitalize"/>
                <name and="text" delimiter=", "/>
      	      </editor>
              <titles relation="collection" prefix=" " suffix="."/>
			  <group prefix=" " delimiter=": ">
				<publisher><place/></publisher>
				<publisher><name/></publisher>
			  </group>
              <date prefix=", "/>
            </group>
            <pages prefix=" " suffix="."/>
            <access prefix=" " suffix="."/>
          </type>
          <type name="article">
            <author suffix="."/>
            <titles prefix=" &#8220;" suffix=".&#8221;"/>
            <group class="container">
              <editor prefix=" " suffix="."/>
              <titles relation="container" font-style="italic" prefix=" " suffix="."/>
            </group>
            <volume prefix=" "/>
            <issue prefix="."/>
            <group suffix=".">
              <date prefix=" (" suffix=")"/>
              <pages prefix=": "/>
            </group>
            <access prefix=" " suffix="."/>
          </type>
        </choose>
      </item>
    </layout>
  </bibliography>
</style>');