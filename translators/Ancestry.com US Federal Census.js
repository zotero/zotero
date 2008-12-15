{
	"translatorID":"0dda3f89-15de-4479-987f-cc13f1ba7999",
	"translatorType":4,
	"label":"Ancestry.com US Federal Census",
	"creator":"Elena Razlogova",
	"target":"^https?://search.ancestry.com/(.*)usfedcen|1890orgcen|1910uscenindex",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-12-15 00:25:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
		
	var result = doc.evaluate('//div[@class="g_container"]/div[@class="g_panelWrap"]/div[@class="g_panelCore"]/div[@class="s_container"]/div[@class="p_rsltList"]', doc, nsResolver,
	             XPathResult.ANY_TYPE, null).iterateNext();

	var rows = doc.evaluate('//div[@class="g_container"]/div[@class="g_panelWrap"]/div[@class="g_panelCore"]/div[@class="s_container"]/div[@class="p_rsltList"]/table/tbody/tr[@class="tblrow record"]', 
				doc, nsResolver, XPathResult.ANY_TYPE, null);
	var row;
	while(row = rows.iterateNext()) {
		links = doc.evaluate('.//a', row, nsResolver, XPathResult.ANY_TYPE, null);
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

		checkURL = doc.location.href.replace("pf=", "");
		if(doc.location.href == checkURL && indiv == 1) {
			return "bookSection";
		}
	} 
}

// this US Federal Census scraper is a hack - so far there is no proper item type in Zotero for this kind of data (added to trac as a low priority ticket)
// this scraper creates proper citation for the census as a whole (should be cited as book)
// but also adds name, city, and state for a particular individual to the citation to make scanning for names & places easier in the middle pane 
// (that's why the resulting item type is a book section) 
// it also adds all searchable text as a snapshot and a scan of the census record as an image

function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	// get initial census data; a proper census record item type should have separate fields for all of these except perhaps dbid
	var info = doc.evaluate('//div[@class="facets"][@id="connect"]/div[@class="g_box"]/p/a', 
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
	var snapshotRe = /\&h=([0-9]+)/;
	var m = snapshotRe.exec(doc.location.href);
		if(m) {
		snapshotURL = "http://search.ancestry.com/cgi-bin/sse.dll?db="+db+"&indiv=1&pf=1&h="+m[1];
		newItem.attachments.push({title:"Ancestry.com Snapshot", mimeType:"text/html", url:snapshotURL, snapshot:true});
		cleanURL = "http://search.ancestry.com/cgi-bin/sse.dll?indiv=1&db="+db+"&h="+m[1];
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
	var scanInfo = doc.evaluate('//div[@id="record-main"]/table[@class="p_recTable"]/tbody/tr/td[2][@class="recordTN"]/a', 
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
	var resultsRegexp = /&h=/;
	if(resultsRegexp.test(url)) {
		scrape(doc);
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
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
		var listElts = doc.evaluate('//div[@class="g_container"]/div[@class="g_panelWrap"]/div[@class="g_panelCore"]/div[@class="s_container"]/div[@class="p_rsltList"]/table/tbody/tr[@class="tblrowalt record"] | //div[@class="g_container"]/div[@class="g_panelWrap"]/div[@class="g_panelCore"]/div[@class="s_container"]/div[@class="p_rsltList"]/table/tbody/tr[@class="tblrow record"]', 
				doc, nsResolver, XPathResult.ANY_TYPE, null);
		var recid;
		var link;
		var name;
		while (listElt = listElts.iterateNext()) {		
			recInfo = doc.evaluate('.//a', listElt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			var recidRe = /recid=([0-9]+)/;
			var m = recidRe.exec(recInfo);
			if(m) {
				recid = m[1];
			}
			link = "http://search.ancestry.com/cgi-bin/sse.dll?indiv=1&db="+db+"&recid="+recid;
			name = doc.evaluate('.//span[@class="srchHit"]', listElt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
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
}