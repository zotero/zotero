{
	"translatorID":"411f9a8b-64f3-4465-b7df-a3c988b602f3",
	"translatorType":4,
	"label":"RePEc",
	"creator":"Asa Kusuma",
	"target":"^https?://ideas\\.repec\\.org/",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-06-26 15:17:22"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var singXpath = '//html/body/a/table/tbody/tr/td/font/b';
	var multXpath = '//html/body/h2';
	
	
	
	if (doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		if(doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.indexOf("Search")!=-1)
			return "multiple";
	} else if(doc.evaluate(singXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	}
}

function strrev(str) {
   if (!str) return '';
   var revstr='';
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
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var singXpath = '//html/body/a/table/tbody/tr/td/font/b';
	var multXpath = '//html/body/h2';
	
	

	if (doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		if(doc.evaluate(multXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.indexOf("Search")!=-1)
			

			shortXpath = '//html/body/strong/a';
			longXpath = '//html/body/dl/dt/strong/a';
			var multXpath='';
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


}