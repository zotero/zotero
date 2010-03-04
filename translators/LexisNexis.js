{
	"translatorID":"b047a13c-fe5c-6604-c997-bef15e502b09",
	"translatorType":4,
	"label":"LexisNexis",
	"creator":"Sean Takats",
	"target":"https?://[^/]*lexis-?nexis\\.com[^/]*/us/lnacademic",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2010-03-04 01:30:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if (doc.title.substr(doc.title.length-8, 8)=="Document"){
		var xpath = '//input[@name="cisb"]';
		var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		if (elmt.iterateNext()){
			return "newspaperArticle";
		}
	}
	var xpath = '//input[@name="frm_tagged_documents" and @type="checkbox"]';
	var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if (elmt.iterateNext()){
		return "multiple";
	}
}

function doWeb(doc, url) {	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	// define results navigation frame doc for export buttons and hidden fields
	var rfDoc = doc.defaultView.window.top.frames[1].document;
	var xpath = '//img[@title="Export Bibliographic References"]';	

	var elmt = doc.evaluate(xpath, rfDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();

	var hostRe = new RegExp("^http(?:s)?://[^/]+");
	var m = hostRe.exec(doc.location.href);
	var host = m[0];

	var risb = doc.evaluate('//input[@name="risb"]', rfDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
	var cisb = doc.evaluate('//input[@name="cisb"]', rfDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
	var uri = host+"/us/lnacademic/results/listview/delPrep.do?cisb="+cisb+"&risb="+risb+"&mode=delivery_refworks";
	var hiddenInputs = doc.evaluate('//form[@name="results_docview_DocumentForm"]//input[@type="hidden" and not(@name="tagData")]', rfDoc, nsResolver,
		XPathResult.ANY_TYPE, null);
	var hiddenInput;
	var poststring="";
	while(hiddenInput = hiddenInputs.iterateNext()) {
		poststring = poststring+"&"+hiddenInput.name+"="+encodeURIComponent(hiddenInput.value);
	}

	var xpath = '//input[@name="frm_tagged_documents" and @type="checkbox"]';
	var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if (doc.title.substr(doc.title.length-8, 8)=="Document"){
		// single page
		var delRange = "cur";
		poststring = poststring + "&hiddensearchfield=Narrow+Search&reloadClassif=&format=GNBFI&focusTerms=&nextSteps=0";
	} else {
		// get multiple item titles and tags
		var xpath = '//tr[td/input[@name="frm_tagged_documents"]]';
		var rows = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var title;
		var tagNumber;
		var items = new Object();
		while (row = rows.iterateNext()){
			title = doc.evaluate('.//a', row, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			tagNumber = doc.evaluate('./td/input[@name="frm_tagged_documents"]', row, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
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
			uri = text.match(/url=([^']+)'/)
			uri = decodeURIComponent(uri[1]);
			uri = uri.replace(/http:\/\/[^/]*\//, host+"/");
			var uris = new Array();
			uris.push(uri);
			Zotero.Utilities.processDocuments(uris, function(newDoc){
				var elmts =newDoc.evaluate('//html', newDoc, nsResolver, XPathResult.ANY_TYPE, null);
				var elmt;
				while (elmt = elmts.iterateNext()){
					var newItem = new Zotero.Item("newspaperArticle");
					var title = newDoc.evaluate('.//div[@class="HEADLINE"]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					if (title.textContent){
						newItem.title = title.textContent;
					}else{
						newItem.title = " ";
					}
					var date = newDoc.evaluate('.//meta[@name="_lndateissue"]/@content', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
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
					var publicationTitle = newDoc.evaluate('.//div[@class="PUB"]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					if (publicationTitle){
						newItem.publicationTitle = publicationTitle.textContent;
					}
					var section = newDoc.evaluate('.//div[@class="SECTION-INFO"]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					if (section){
						newItem.section = section.textContent;				
					}
					var author = newDoc.evaluate('.//div[@class="BYLINE"]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
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
}