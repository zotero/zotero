{
	"translatorID":"add7c71c-21f3-ee14-d188-caf9da12728b",
	"translatorType":4,
	"label":"Library Catalog (SIRSI)",
	"creator":"Sean Takats",
	"target":"/uhtbin/cgisirsi",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-12 19:30:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	
	var xpath = '//tr[th[@class="viewmarctags"]][td[@class="viewmarctags"]]';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI detectWeb: viewmarctags");
		return "book";
	}
	var xpath = '//input[@name="VOPTIONS"]';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI detectWeb: VOPTIONS");
		return "book";
	}
	var elmts = doc.evaluate('/html/body/form//text()', doc, nsResolver,
	                         XPathResult.ANY_TYPE, null);
	while(elmt = elmts.iterateNext()) {
		if(Zotero.Utilities.superCleanString(elmt.nodeValue) == "Viewing record") {
			Zotero.debug("SIRSI detectWeb: Viewing record");
			return "book";
		}
	}
	
	var xpath = '//td[@class="searchsum"]/table';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI detectWeb: searchsum");
		return "multiple";
	}
	var xpath = '//form[@name="hitlist"]/table/tbody/tr';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI detectWeb: hitlist");
		return "multiple";
	}
	//	var xpath = '//input[@type="checkbox"]' 	
}

function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var xpath = '//tr[th[@class="viewmarctags"]][td[@class="viewmarctags"]]';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var elmt = elmts.iterateNext();
	if(!elmt) {
		return false;
	}

	var newItem = new Zotero.Item("book");
	newItem.extra = "";
	
	authors = [];
	while(elmt) {
		try {
			var node = doc.evaluate('./TD[1]/A[1]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(!node) {
				var node = doc.evaluate('./TD[1]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			}
			
			if(node) {
				var casedField = Zotero.Utilities.superCleanString(doc.evaluate('./TH[1]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
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
				} else if(field == "title" || field == "título") {
					var titleParts = value.split(" / ");
					newItem.title = Zotero.Utilities.capitalizeTitle(titleParts[0]);
				} else if(field == "publication info" || field == "publicación") {
					var pubParts = value.split(" : ");
					newItem.place = pubParts[0];
					if (pubParts[1].match(/\d+/)) newItem.date = pubParts[1].match(/\d+/)[0];
				} else if(field == "personal author" || field == "autor personal") {
					if(authors.indexOf(value) == -1) {
						value = value.replace(/(\(|\)|\d+|\-)/g, "");
						newItem.creators.push(Zotero.Utilities.cleanAuthor(value, "author", true));
						authors.push(value);
					}
				} else if(field == "author"){		
					if(authors.indexOf(value) == -1) { 
						newItem.creators.push(Zotero.Utilities.cleanAuthor(value, "author", true));
						authors.push(value);
					}
				} else if(field == "added author") {
					if(authors.indexOf(value) == -1) {
						newItem.creators.push(Zotero.Utilities.cleanAuthor(value, "contributor", true));
						authors.push(value);
					}
				} else if(field == "corporate author") {
					if(authors.indexOf(value) == -1) {
						newItem.creators.push({lastName:value, fieldMode:true});
						authors.push(value);
					}
				} else if(field == "edition") {
					newItem.edition = value;
				} else if(field == "subject term" || field == "corporate subject" || field == "geographic term" || field == "subject") {
					var subjects = value.split("--");
					for(var i=0; i<subjects.length; i++) {
						if(newItem.tags.indexOf(subjects[i]) == -1) {
							newItem.tags.push(subjects[i]);
						}
					}
				} else if(field == "personal subject") {
					var subjects = value.split(", ");
					var tag = value[0]+", "+value[1];
					if(newItems.tag.indexOf(tag) == -1) {
						newItem.tags.push(tag);
					}
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
	
	var callNumber = doc.evaluate('//tr/td[1][@class="holdingslist"]/text()', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
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
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var sirsiNew = true; //toggle between SIRSI -2003 and SIRSI 2003+
	var xpath = '//td[@class="searchsum"]/table';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI doWeb: searchsum");
		sirsiNew = true;	
	} else if (doc.evaluate('//form[@name="hitlist"]/table/tbody/tr', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI doWeb: hitlist");
		sirsiNew = false;
	} else if (doc.evaluate('//tr[th[@class="viewmarctags"]][td[@class="viewmarctags"]]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI doWeb: viewmarctags");
		sirsiNew = true;
	} else if (doc.evaluate('//input[@name="VOPTIONS"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SIRSI doWeb: VOPTIONS");
		sirsiNew = false;
	} else {
	var elmts = doc.evaluate('/html/body/form//text()', doc, nsResolver,
	                         XPathResult.ANY_TYPE, null);
		while(elmt = elmts.iterateNext()) {
			if(Zotero.Utilities.superCleanString(elmt.nodeValue) == "Viewing record") {
				Zotero.debug("SIRSI doWeb: Viewing record");
				sirsiNew = false;
			}
		}
	}
	
	if (sirsiNew) { //executes Simon's SIRSI 2003+ scraper code
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
				var tableRows = doc.evaluate('//td[@class="searchsum"]/table[//input[@class="submitLink"]]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			} else{
				var tableRows = doc.evaluate('//td[@class="searchsum"]/table[//input[@value="Details"]]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			}
			var tableRow = tableRows.iterateNext();		// skip first row
			// Go through table rows
			while(tableRow = tableRows.iterateNext()) {
				//IUCAT fix 2 of 2
				if (iu){
					var input = doc.evaluate('.//input[@class="submitLink"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					var text = doc.evaluate('.//label/span', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				} else {
					var input = doc.evaluate('.//input[@value="Details"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();					
					var text = doc.evaluate('.//label/strong', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;					
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
	} else{  //executes Simon's SIRSI -2003 translator code
		Zotero.debug("Running SIRSI -2003 code");
		var uri = doc.location.href;
		var recNumbers = new Array();
		var xpath = '//form[@name="hitlist"]/table/tbody/tr';
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
				var checkbox = doc.evaluate('.//input[@type="checkbox"]', elmt, nsResolver,
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
			
			var elmts = doc.evaluate('/html/body/form', doc, nsResolver,
									 XPathResult.ANY_TYPE, null);
			while(elmt = elmts.iterateNext()) {
				var initialText = doc.evaluate('.//text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if(initialText && initialText.nodeValue && Zotero.Utilities.superCleanString(initialText.nodeValue) == "Viewing record") {
					recNumbers.push(doc.evaluate('./b[1]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
					break;
				}
			}	
			// begin Emory compatibility
			var elmts = doc.evaluate('//input[@name="first_hit"]', doc, nsResolver,
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
		Zotero.Utilities.loadDocument(newUri+'?marks='+recNumbers.join(",")+'&shadow=NO&format=FLAT+ASCII&sort=TITLE&vopt_elst=ALL&library=ALL&display_rule=ASCENDING&duedate_code=l&holdcount_code=t&DOWNLOAD_x=22&DOWNLOAD_y=12&address=&form_type=', function(doc) {
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
}