{
	"translatorID":"cde4428-5434-437f-9cd9-2281d14dbf9",
	"translatorType":4,
	"label":"Ovid",
	"creator":"Simon Kornblith and Michael Berkowitz",
	"target":"/(gw2|spa|spb)/ovidweb\\.cgi",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-07-07 00:15:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var results = doc.evaluate('//div[@class="bibheader-resultsrange"]/b', doc, nsResolver,
		XPathResult.ANY_TYPE, null).iterateNext();
	
	if(!doc.evaluate('//span[contains(./text(), "Results Manager")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return false;
	}
	
	if(results) {
		results = Zotero.Utilities.trimInternal(results.textContent);
		if(results.indexOf("-") != -1) {
			return "multiple";
		} else {
			return "journalArticle";
		}
	}
	
	return false;
}

function senCase(string) {
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
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var results = Zotero.Utilities.cleanString(doc.evaluate('//div[@class="bibheader-resultsrange"]/b', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	var post = "S="+doc.evaluate('.//input[@name="S"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;

	if(results.indexOf("-") != -1) {
		var items = new Object();
		
		// Go through table rows
		if (doc.evaluate('/html/body/form/div[substring(@class, 1, 10)="titles-row"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var tableRows = doc.evaluate('/html/body/form/div[substring(@class, 1, 10)="titles-row"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else if (doc.evaluate('//div[@id="titles-records"]/table[@class="titles-row"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var tableRows = doc.evaluate('//div[@id="titles-records"]/table[@class="titles-row"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		var tableRow;
		while(tableRow = tableRows.iterateNext()) {
			var id = doc.evaluate('.//input[@name="R"]', tableRow, nsResolver, XPathResult.ANY_TYPE,
				null).iterateNext().value;
			items[id] = Zotero.Utilities.cleanString(doc.evaluate('.//span[@class="titles-title"]', tableRow,
				nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		}
		
		var items = Zotero.selectItems(items);
		if(!items) return true;
		
		for(var i in items) {
			post += "&R="+i;
		}
	} else {
		var id = doc.evaluate('.//input[@name="R"]', doc, nsResolver, XPathResult.ANY_TYPE,
			null).iterateNext().value;
		post += "&R="+id;
	}
	
	if (detectWeb(doc, url) == "multiple") {
		var selectvar = doc.evaluate('.//input[@name="SELECT"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var nextselect = selectvar.iterateNext().value;
		if (next = selectvar.iterateNext()) {
			post += "&SELECT=" + next.value;
		} else {
			post += "&SELECT="+ nextselect;
		}
	} else {
		post += "&SELECT=" + doc.evaluate('.//input[@name="SELECT"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
	}
	post += "&CitMan="+doc.evaluate('.//input[@name="CitMan"]', doc, nsResolver, XPathResult.ANY_TYPE,
		null).iterateNext().value;
	post += "&CitManPrev="+doc.evaluate('.//input[@name="CitManPrev"]', doc, nsResolver, XPathResult.ANY_TYPE,
		null).iterateNext().value;
	post += "&cmRecordSelect=SELECTED&cmFields=ALL&cmFormat=export&cmsave.x=12&cmsave.y=7&doSave=1";
		
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
					} else if (fieldContent.match(/^(.*) [A-Z]{1,3}$/)) {
						names = fieldContent.match(/^(.*) ([A-Z]{1,3})$/);
					  	newItem.creators.push({firstName:names[2], lastName:names[1], creatorType:"author"});
					} else {
						newItem.creators.push({lastName:names[0], isInstitution:true, creatorType:"author"});
					}
				} else if(fieldCode == "SO") {
					if (fieldContent.match(/\d{4}/)) {
						newItem.date = fieldContent.match(/\d{4}/)[0];
					}
					if (fieldContent.match(/(\d+)\((\d+)\)/)) {
						var voliss = fieldContent.match(/(\d+)\((\d+)\)/);
						newItem.volume = voliss[1];
						newItem.issue = voliss[2];
					}
					if (fieldContent.match(/vol\.\s*(\d+)/)) {
						newItem.volume = fieldContent.match(/vol\.\s*(\d+)/)[1];
					}
					if (fieldContent.match(/vol\.\s*\d+\s*,\s*no\.\s*(\d+)/)) {
						newItem.issue = fieldContent.match(/vol\.\s*\d+\s*,\s*no\.\s*(\d+)/)[1];
					}
					if (fieldContent.match(/\d+\-\d+/))
						newItem.pages = fieldContent.match(/\d+\-\d+/)[0];
			  		if (fieldContent.match(/pp\.\s*(\d+\-\d+)/))
						newItem.pages = fieldContent.match(/pp\.\s*(\d+\-\d+)/)[1];
					if (fieldContent.match(/[J|j]ournal/)) {
						newItem.publicationTitle = fieldContent.match(/[J|j]ournal[-\s\w]+/)[0];
					} else {
						newItem.publicationTitle = Zotero.Utilities.trimInternal(fieldContent.split(/(\.|;|(,\s*vol\.))/)[0]);
					}
				} else if(fieldCode == "SB") {
					newItem.tags.push(Zotero.Utilities.superCleanString(fieldContent));
				} else if(fieldCode == "KW") {
					newItem.tags.push(fieldContent.split(/; +/));
				} else if(fieldCode == "DB") {
					newItem.repository = "Ovid ("+fieldContent+")";
				} else if(fieldCode == "DI") {
					newItem.DOI = fieldContent;
				} else if(fieldCode == "DO") {
					newItem.DOI = fieldContent;
				} else if(fieldCode == "DP") {
					newItem.date = fieldContent;
				} else if(fieldCode == "IS") {
					newItem.ISSN = fieldContent;
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
}