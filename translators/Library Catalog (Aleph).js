{
	"translatorID":"cf87eca8-041d-b954-795a-2d86348999d5",
	"translatorType":4,
	"label":"Library Catalog (Aleph)",
	"creator":"Simon Kornblith and Michael Berkowitz",
	"target":"https?://[^/]+/F(?:/[A-Z0-9\\-]+(?:\\?.*)?$|\\?func=find|\\?func=scan|\\?func=short)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-10-22 19:00:00"
}

function detectWeb(doc, url) {
	var singleRe = new RegExp("^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=[0-9]{3}|func=direct|func=myshelf-full.*)");
	
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
}

function doWeb(doc, url) {
	var detailRe = new RegExp("^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=[0-9]{3}|func=direct|func=myshelf-full.*)");
	var mab2Opac = new RegExp("^https?://[^/]+berlin|193\.30\.112\.134|duisburg-essen/F/[A-Z0-9\-]+\?.*");
	var uri = doc.location.href;
	var newUris = new Array();
	
	if(detailRe.test(uri)) {
		var newuri = uri.replace(/\&format=[0-9]{3}/, "&format=001");
		if (newuri == uri) newuri += "&format=001";
		newUris.push(newuri);
	} else {
		var itemRegexp = '^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=999|func=direct|func=myshelf-full.*)'
		var items = Zotero.Utilities.getItemArray(doc, doc, itemRegexp, '^[0-9]+$');
		
		// ugly hack to see if we have any items
		var haveItems = false;
		for(var i in items) {
			haveItems = true;
			break;
		}
		
		// If we don't have any items otherwise, let us use the numbers
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
	if(mab2Opac.test(uri)) {
		translator.setTranslator("91acf493-0de7-4473-8b62-89fd141e6c74");
	} else {
		translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	}	
	var marc = translator.getTranslatorObject();
	Zotero.Utilities.processDocuments(newUris, function(newDoc) {
		var uri = newDoc.location.href;
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == 'x') return namespace; else return null;
		} : null;
		var nonstandard = false;
		var th = false;
		var xpath;
		if (newDoc.evaluate('//*[tr[td/text()="LDR"]]/tr[td[2]]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			xpath = '//*[tr[td/text()="LDR"]]/tr[td[2]]';
		} else if (newDoc.evaluate('//*[tr[th/text()="LDR"]]/tr[td[1]]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		  xpath = '//*[tr[th/text()="LDR"]]/tr[td[1]]';
		  th = true;
		} else if (newDoc.evaluate('//tr[2]//table[2]//tr', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			xpath = '//tr[2]//table[2]//tr[td[2]]';
			nonstandard = true;
		} else if (newDoc.evaluate('//table//tr[td[2][@class="td1"]]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			xpath = '//table//tr[td[2][@class="td1"]]';
			nonstandard = true;
		} else if (newDoc.evaluate('//tr/td[2]/table/tbody[tr/td[contains(text(), "LDR")]]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			xpath = '//tr/td[2]/table/tbody[tr/td[contains(text(), "LDR")]]/tr';
			nonstandard = true;
		}
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		var record = new marc.record();
		while(elmt = elmts.iterateNext()) {
			if (th) {
          var field = Zotero.Utilities.superCleanString(newDoc.evaluate('./th', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
      } else {
          var field = Zotero.Utilities.superCleanString(newDoc.evaluate('./td[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
      }
      // if (nonstandard) {
      //     var field = Zotero.Utilities.superCleanString(newDoc.evaluate('./td[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
      // } else {
      //     var field = Zotero.Utilities.superCleanString(newDoc.evaluate('./TD[1]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
      // }
     // var field = Zotero.Utilities.superCleanString(newDoc.evaluate('./td[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			if(field) {
				var value;
				if (th) {
				    value = newDoc.evaluate('./TD[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent; //.split(/\n/)[1];
				} else {
				  value = newDoc.evaluate('./TD[2]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent; //.split(/\n/)[1];
				}
				if (value.split(/\n/)[1]) value = Zotero.Utilities.trimInternal(value.split(/\n/)[1]);
				Zotero.debug(field + " : " + value);
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
		
		var domain = url.match(/https?:\/\/([^\/]+)/);
		newItem.repository = domain[1]+" Library Catalog";

		for (var i in newItem.creators) {
			if (!newItem.creators[i]['firstName']) {
				var name = newItem.creators[i]['lastName'].split(/([^\s]+)\s+(.*)$/);
				newItem.creators[i] = {lastName:name[1], firstName:name[2], creatorType:'author'};
			}
		}
		
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
				if (a.firstName.match(/\|/)) a.firstName = a.firstName.match(/([^|]+)\s+|/)[1];
			}
		}
		newItem.creators = transient;
		newItem.title = newItem.title.replace(/(<<|>>)/g, '');
		newItem.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}