{
        "translatorID":"23ba3be6-412d-4dde-9cc1-c4df0cc09378",
        "label":"Rice University Library Catalog",
        "creator":"Mang Sun",
        "target":"^https?://[^/]*\\.rice\\.edu[^/]*/uhtbin/cgisirsi",
        "minVersion":"2.1",
        "maxVersion":"",
        "priority":90,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2011-07-29 12:52:04"
}

/* Based on the SIRSI translator by Simon Kornblith and Michael Berkowitz,
   and the modifications for Rutgers (IRIS) by Chad Mills.
 */

// Priority of 90 to override SIRSI

function detectWeb(doc, url) {
	if (doc.evaluate('//div[@class="columns_container"]/div[contains(@class, "left_column")]/div[@class="content_container"]/div[@class="content"]/form[@id="hitlist"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//div[@class="columns_container"]/div[contains(@class, "left_column")]/form[@name="item_view"]/div[@class="content_container item_details"]/div[@class="content"]/h3[.="Item Details"] ', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	}
}

function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

          var xpath = '/html/body/div[@class="columns_container"]/div[contains(@class, "left_column")]/form[@name="item_view"]/div[@class="content_container item_details"]/div[@class="content"]/ul[contains(@class, "detail_page")]/li[@id="detail_marc_record"]/dl/dt[@class="viewmarctags"]';
          
	 var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);

	var elmt = elmts.iterateNext();

	if(!elmt) {
			
		return false;
	}

	var newItem = new Zotero.Item("book");
	newItem.extra = "";
	newItem.series = "";
	var seriesItemCount = 0;
	

	while(elmt) {
		try {
						
			//By Rice. Select all non space text nodes.
			var node = doc.evaluate('./text()[normalize-space()]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			
			if(node) {
			    
				if (doc.evaluate('following-sibling::dd[position()=1]/a/text()', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
				{
					
				//By Rice. Some meta data must be retrieved from the text node of anchor tags.
				var value = Zotero.Utilities.superCleanString(doc.evaluate('following-sibling::dd[position()=1]/a/text()[normalize-space()]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
				}
				else
				{
				//while other metadata can be retrieved directly from the text node of  DD tags 	
				var value = Zotero.Utilities.superCleanString(doc.evaluate('following-sibling::dd[position()=1]/text()[normalize-space()]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);	
				}
							
								
				//acquire label and create super clean text by removing colon, space and etc.
                                casedField = Zotero.Utilities.superCleanString(node.nodeValue);
				field = casedField.toLowerCase();
							

				if(field == "publisher") {
					newItem.publisher = value;
					}else if(field == "pub date") {
					var re = /[0-9]+/;
					var m = re.exec(value);
					newItem.date = m[0];
				}else if(field == "isbn") {
					var re = /^[0-9](?:[0-9X]+)/;
					var m = re.exec(value);
					newItem.ISBN = m[0];
				}else if(field == "title") {
					var titleParts = value.split(" / ");
					re = /\[(.+)\]/i;
				if (re.test(titleParts[0])) {
					var ar = re.exec(titleParts[0]);
					var itype = ar[1].toLowerCase();
					if(itype== "phonodisc" || itype == "sound recording"){
						newItem.itemType = "audioRecording";
					}else if(itype=="videorecording"){
						newItem.itemType = "videoRecording";
					}else if(itype=="electronic resource"){
						//newItem.itemType = "webPage";
						//Rice treats eletronic resource as book
						newItem.itemType = "book";
					}
				}
				newItem.title = Zotero.Utilities.capitalizeTitle(titleParts[0]);

				}else if(field == "series") {//push onto item, delimit with semicolon when needed
	  				if (seriesItemCount != 0){
						newItem.series +=  "; " + value;
					}else if(seriesItemCount == 0) {
						newItem.series =  value;
					}
					seriesItemCount++;//bump counter
					}else if(field == "dissertation note") {
						newItem.itemType = "thesis";
						var thesisParts = value.split("--");
						var uniDate = thesisParts[1].split(", ");
						newItem.university = uniDate[0];
						newItem.date = uniDate[1];
					}else if(field == "edition") {
						newItem.edition = value;
					}else if(field == "physical description") {
                                                
						var physParts = value.split(" : ");
						var physParts = physParts[0].split(" ; ");
						//determine pages, split on " p."
						var physPages = value.split(" p.");
						//break off anything in the beginning before the numbers
						var pageParts = physPages[0].split(" ");
						newItem.numPages = pageParts[pageParts.length-1];
					}else if(field == "publication info") {
						var pubParts = value.split(" : ");
						newItem.place = pubParts[0];
						//drop off first part of array and recombine
						pubParts.shift();
						var i;
						var publisherInfo;
						for (i in pubParts) {
							if (i == 0) {
								publisherInfo = pubParts[i] + " : ";
							} else {
								publisherInfo = publisherInfo + pubParts[i] + " : ";
							}
						}//END for
						//drop off last colon
						publisherInfo = publisherInfo.substring(0,(publisherInfo.length - 3));
						//break apart publication parts into Publisher and Date
						var publisherParts = publisherInfo.split(",");
						newItem.publisher = publisherParts[0];
						//check that first character isn't a 'c', if so drop it
						if (publisherParts[1].substring(1,2) == "c") {
							newItem.date = publisherParts[1].substring(2);
						}
						else {
							newItem.date = publisherParts[1];
						}
					}else if(field == "personal author") {
						
					      newItem.creators.push(Zotero.Utilities.cleanAuthor(value, "author", true));
					}else if(field == "performer") {
						newItem.creators.push(Zotero.Utilities.cleanAuthor(value, "performer", true));
					}else if(field == "author"){
						newItem.creators.push(Zotero.Utilities.cleanAuthor(value, "author", true));
					}else if(field == "added author") {
						newItem.creators.push(Zotero.Utilities.cleanAuthor(value, "contributor", true));
					}else if(field == "conference author" || field == "corporate author") {
						
					     
					      
						//The following line is included by Rice to handle corporate or conference author
						 newItem.creators.push(Zotero.Utilities.cleanAuthor(value, "author", true));
					}else if(field == "subject" || field == "corporate subject" || field == "geographic term") {
						var subjects = value.split("--");
						newItem.tags = newItem.tags.concat(subjects);
					}else if(field == "personal subject") {
						var subjects = value.split(", ");
						newItem.tags = newItem.tags.push(value[0]+", "+value[1]);
					}else if(value && field != "http") {
						newItem.extra += casedField+": "+value+"\n";
					}
				}
			} catch (e) {}
				elmt = elmts.iterateNext();
				
			}//END if node

			if(newItem.extra) {
				newItem.extra = newItem.extra.substr(0, newItem.extra.length-1);
			}

			var callNumber = doc.evaluate('//tr/td[1][@class="holdingslist"]/strong/text()', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();

			if(callNumber && callNumber.nodeValue) {
				newItem.callNumber = callNumber.nodeValue;
			}

			newItem.libraryCatalog = "Rice University Library Catalog";
			newItem.complete();
			//Zotero.debug('hi');
			return true;
		}//END try

		function doWeb(doc, url){
  			var namespace = doc.documentElement.namespaceURI;
  			var nsResolver = namespace ? function(prefix) {
				if (prefix == 'x') return namespace; else return null;
			} : null;

			var sirsiNew = true; //toggle between SIRSI -2003 and SIRSI 2003+
                        //Adapted to catch the hitlist page of Rice Catalog
			var xpath = '/html/body/div[@class="columns_container"]/div[contains(@class, "left_column")]/div[@class="content_container"]/div[@class="content"]/form[@id="hitlist"]/ul[@class="hit_list"]/li/ul[starts-with(@class, "hit_list_row")]/li[@class="hit_list_item_info"]/dl';
                        
			if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				Zotero.debug("SIRSI doWeb: searchsum");
				sirsiNew = true;
			}else if (doc.evaluate('//form[@name="hitlist"]/table/tbody/tr', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				Zotero.debug("SIRSI doWeb: hitlist");
				sirsiNew = false;
			}else if (doc.evaluate('//tr[th[@class="viewmarctags"]][td[@class="viewmarctags"]]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				Zotero.debug("SIRSI doWeb: viewmarctags");
				sirsiNew = true;
			}else if (doc.evaluate('//input[@name="VOPTIONS"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				Zotero.debug("SIRSI doWeb: VOPTIONS");
				sirsiNew = false;
			}else {
				var elmts = doc.evaluate('/html/body/form//text()', doc, nsResolver, XPathResult.ANY_TYPE, null);
				//var elmts = doc.evaluate(' ', doc, nsResolver, XPathResult.ANY_TYPE, null);
			while(elmt = elmts.iterateNext()) {
				if(Zotero.Utilities.superCleanString(elmt.nodeValue) == "Viewing record") {
					Zotero.debug("SIRSI doWeb: Viewing record");
					sirsiNew = false;
				}
			}//END while elmts
		}//END FUNCTION doWeb
             // Zotero.debug(xpath);
		 if (sirsiNew) { //executes Simon's SIRSI 2003+ scraper code
			
			if(!scrape(doc)) {
						 	       
				var checkboxes = new Array();
				var urls = new Array();
				var availableItems = new Array();
				//pull items
				var tableRows = doc.evaluate('//ul[@class="hit_list"]/li/ul[contains(@class, "hit_list_row")][//input[@value="Details"]]', doc, nsResolver, XPathResult.ANY_TYPE, null);
				

				// Go through table rows
				while(tableRow = tableRows.iterateNext()) {
					var input = doc.evaluate('.//input[@value="Details"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					
					//var text = doc.evaluate('.//strong', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
					var text = doc.evaluate('.//dd[@class="title"]/a', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
					if(text) {
						availableItems[input.name] = text;
					}
				}//END while
				var items = Zotero.selectItems(availableItems);
				if(!items) {
					return true;
				    }
				    
				var hostRe = new RegExp("^http(?:s)?://[^/]+");
				var m = hostRe.exec(doc.location.href);
				Zotero.debug("href: " + doc.location.href);
				var hitlist = doc.forms.namedItem("hitlist");
				var baseUrl = m[0]+hitlist.getAttribute("action")+"?first_hit="+hitlist.elements.namedItem("first_hit").value+"&last_hit="+hitlist.elements.namedItem("last_hit").value;
				var alexandria = new Array();
				for(var i in items) {
					alexandria.push(baseUrl+"&"+i+"=Details");
				}
				Zotero.Utilities.processDocuments(alexandria, function(doc) { scrape(doc) }, function() { Zotero.done() }, null);
				Zotero.wait();
			}//END if not scrape(doc)
		}else{  //executes Simon's SIRSI -2003 translator code
			Zotero.debug("Running SIRSI -2003 code");
			 
			var uri = doc.location.href;
			var recNumbers = new Array();
			var xpath = '//form[@name="hitlist"]/table/tbody/tr';
			var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var elmt = elmts.iterateNext();
			if(elmt) {    // Search results page
				var uriRegexp = /^http:\/\/[^\/]+/;
				var m = uriRegexp.exec(uri);
				var postAction = doc.forms.namedItem("hitlist").getAttribute("action");
				var newUri = m[0]+postAction.substr(0, postAction.length-1)+"40";
				var titleRe = /<br>\s*(.*[^\s])\s*<br>/i;
				var items = new Array();
				do {
					var checkbox = doc.evaluate('.//input[@type="checkbox"]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					// Collect title
					var title = doc.evaluate("./td[2]", elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
					if(checkbox && title) {
						items[checkbox.name] = Zotero.Utilities.trimInternal(title);
					}
				} while(elmt = elmts.iterateNext());
					items = Zotero.selectItems(items);
					if(!items) {
						return true;
					}
					for(var i in items) {
						recNumbers.push(i);
					}
				} else {// Normal page
					// this regex will fail about 1/100,000,000 tries
					var uriRegexp = /^((.*?)\/([0-9]+?))\//;
					var m = uriRegexp.exec(uri);
					var newUri = m[1]+"/40"
					var elmts = doc.evaluate('/html/body/form', doc, nsResolver, XPathResult.ANY_TYPE, null);
					while(elmt = elmts.iterateNext()) {
						var initialText = doc.evaluate('.//text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
						if(initialText && initialText.nodeValue && Zotero.Utilities.superCleanString(initialText.nodeValue) == "Viewing record") {
							recNumbers.push(doc.evaluate('./b[1]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
							break;
						}
					}
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
					}//end FOR
					var newItem = new Zotero.Item();
					record.translate(newItem);
					
					newItem.libraryCatalog = "Rice University Library ";
					newItem.complete();
				}//end FOR
			Zotero.done();
			});
    	Zotero.wait();
	}//END while
}//END scrape function
