{
	"translatorID":"63c25c45-6257-4985-9169-35b785a2995e",
	"translatorType":4,
	"label":"InfoTrac OneFile",
	"creator":"Simon Kornblith",
	"target":"^https?://[^/]+/itx/(?:[a-z]+Search|retrieve|paginate|tab)\\.do",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2006-12-15 03:40:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if(doc.evaluate('//img[@alt="Thomson Gale"]', doc, nsResolver,
	                XPathResult.ANY_TYPE, null).iterateNext()) {
		if(doc.evaluate('//table[@class="resultstable"][tbody/tr[@class="unselectedRow"]]',
		                doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			return "multiple";
		} else {
			return "journalArticle";
		}
	}
}

function infoTracRIS(text) {
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
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var hostRe = new RegExp("^https?://[^/]+/");
	var host = hostRe.exec(doc.location.href)[0];
	
	if(doc.evaluate('//table[@class="resultstable"][tbody/tr[@class="unselectedRow"]]',
	                doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var items = Zotero.Utilities.getItemArray(doc, doc, '^https?://[^/]+/itx/retrieve\\.do\\?.*docId=');
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
}