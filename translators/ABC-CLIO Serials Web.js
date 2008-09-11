{
	"translatorID":"a07bb62a-4d2d-4d43-ba08-d9679a0122f8",
	"translatorType":4,
	"label":"ABC-CLIO Serials Web",
	"creator":"Simon Kornblith",
	"target":"https?://[^/]*serials\\.abc-clio\\.com[^/]*/active/go/ABC-Clio-Serials_v4",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-01-09 20:00:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var result = doc.evaluate('//table[@class="rc_main"]', doc, nsResolver,
				 XPathResult.ANY_TYPE, null).iterateNext();
	if(result) {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var availableItems = new Array();
	var availableAttachments = new Array();
		
	var elmts = doc.evaluate('//table[@class="rc_main"]', doc, nsResolver,
	                         XPathResult.ANY_TYPE, null);
	var elmt;
	while(elmt = elmts.iterateNext()) {
		var title = doc.evaluate('./tbody/tr/td[b/text() = "Title:"]',
		                         elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		var checkbox = doc.evaluate('.//input[@type = "checkbox"]',
		                         elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(title, checkbox) {
			checkbox = checkbox.name;
			availableItems[checkbox] = Zotero.Utilities.cleanString(title.textContent).substr(6);
			
			var links = doc.evaluate('./tbody/tr/td[b/text() = "Fulltext: ["]/a',
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
}