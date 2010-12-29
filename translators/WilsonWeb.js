{
        "translatorID":"af1af8fa-19dc-486f-a8cc-107acb849101",
        "label":"WilsonWeb",
        "creator":"Brinda Shah",
        "target":"^http://(vnweb|webbeta|verityqa|verityqa2|atg-dev05)\\.hwwilsonweb\\.com/hww/results/",
        "minVersion":"1.0",
        "maxVersion":"",
        "priority":100,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2010-11-23 14:12:32"
}

var dispType='brief';
var titleObj= new Object();
var resultType = '';
var articles = new Array();	
var pgSize;


function detectWeb(doc, url) {

	var tClassObj;
	var namespace = doc.documentElement.namespaceURI; var nsResolver = namespace ? 
	function(prefix) {
	if (prefix == "x" )
		 return namespace;
	else 
		return null;
	} : null;
	
	if(doc.title.match("Search Results")) {
		var dispElePath = "//input[@name='displayType']";
		var dispEle = doc.evaluate(dispElePath , doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if(dispEle) {			
			dispType=dispEle.value;					
		}	
		
		var cxpath = getXPath(dispType, 'cxpath');		
		tClassObj = doc.evaluate(cxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					
		if (!tClassObj) {					
			cxpath = getXPath(dispType, 'cxpath1');			
			tClassObj = doc.evaluate(cxpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		}
		var tClass = tClassObj.textContent;		
		if(tClass.match("BIBL"))
			resultType = "journalArticle";		
		else if(tClass.match("BOOK"))
			resultType = "book";
		else if(tClass.match("ART"))
			resultType = "artwork";			
							
		var xpath = '//input[@name="pageSize"]';
		var eleObj = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var ele;
		if(ele = eleObj.iterateNext()) {
			if(ele) {
				pgSize= ele.value;
				
				if(pgSize > 1) {
					//if(resultType == 'journalArticle')
						return "multiple";
				}				
				else 			
					return resultType;				
					
			}
		}
		
	}

}

function doWeb(doc, url) {
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? 
	function(prefix) {
	if (prefix == 'x') 
		return namespace;
	 else 
	 	return null;
	} : null;
	
	if (detectWeb(doc, url) == "multiple") {	

			var nextTitle;
			var c = 0;
			
			var titles = doc.evaluate(getXPath(dispType,'ti'), doc, nsResolver, XPathResult.ANY_TYPE, null);			
			while (nextTitle= titles.iterateNext()) {	
				c++;				
				titleObj[c] = nextTitle.textContent;					
			}		
			titleObj = Zotero.selectItems(titleObj);
		
			for (var t in titleObj ) {				
				articles.push(t);			
				var newArticle = new Zotero.Item(resultType);				
				newArticle.url = doc.location.href;
				newArticle.title = titleObj[t];	
				switch(resultType) {
					case 'journalArticle' : associateBIBLData(doc,newArticle,t);	
										break;
					case 'book': associateBookData(doc, newArticle, t);
								break;
					case 'artwork' : associateArtData(doc, newArticle,t);
									break;
				}				
							
				newArticle.complete();
			}		
	}
	else {
		//saves single page items
		articles = [url]; 
	}
	
	Zotero.Utilities.processDocuments(articles, scrape, function(){Zotero.done();});
	
	Zotero.wait();
	
}

function associateBIBLData(doc,newArticle,t) {	
		
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? 
	function(prefix) {
	if (prefix == 'x') 
		return namespace;
	 else 
	 	return null;
	} : null;
	
	var host = doc.location.host;
	
	//author
	var authorPath = getXPath(dispType,'au',t);		
	var authorObj = doc.evaluate(authorPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();	
	if(authorObj) {
		associateAuthorData(newArticle, authorObj);
	}		
	
	//journal		
	var journalPath = getXPath(dispType, 'jn', t);	
 	var journalObj = doc.evaluate(journalPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
	if(journalObj ) {
		associateFieldData(newArticle, journalObj, 'journalAbbreviation');			
	}
	
	
	//source	
	var sourcePath = getXPath(dispType,'so',t);
	if(sourcePath != '') {
		var sourceObj = doc.evaluate(sourcePath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if(sourceObj)
			associateSourceData(newArticle, sourceObj);
	}
	
	//subject	
	var tagsContent = new Array();
	var suPath = getXPath(dispType, 'su', t);		
	if(suPath != '') {
		var suObj = doc.evaluate(suPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();		
		if(suObj) {
			var subjects = suObj.textContent.split(';');
			for (var i in subjects) {		
				//Zotero.debug(subjects[i]);			
				tagsContent.push(subjects[i]);
			}
			for (var i = 0; i < tagsContent.length; i++) {
				newArticle.tags[i] = tagsContent[i];
			}
		}
	}
	
	//issn	
	var issnPath = getXPath(dispType, 'issn', t);
	if(issnPath != '') {
		var issnObj = doc.evaluate(issnPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(issnObj) {
			associateFieldData(newArticle, issnObj, 'ISSN');				
		}
	}	
	
	//la	
	var laPath = getXPath(dispType, 'la', t);
	if(laPath != '') {
		var laObj = doc.evaluate(laPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(laObj) {
			associateFieldData(newArticle, laObj, 'language');				
		}
	}	
	
	//abstract
	var absPath = getXPath(dispType, 'abs', t);
	if(absPath != '') {
		var absObj = doc.evaluate(absPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(absObj) {
			associateFieldData(newArticle, absObj, 'abstractNote');				
		}
	}
	
	//doi
	var doiPath = getXPath(dispType, 'doi', t);
	if(doiPath != '') {
		var doiObj = doc.evaluate(doiPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(doiObj) {
			associateFieldData(newArticle, doiObj, 'DOI');				
		}
	}
	
	//inst
	var instPath = getXPath(dispType, 'inst', t);
	if(instPath != '') {
		var instObj = doc.evaluate(instPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(instObj ) {
			associateFieldData(newArticle, instObj , 'institution');				
		}
	}
	
	//publisher
	var pbPath = getXPath(dispType, 'pb', t);
	if(pbPath != '') {
		var pbObj = doc.evaluate(pbPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(pbObj) {
			associateFieldData(newArticle, pbObj, 'publisher');				
		}
	}
	
	//note
	var ntPath = getXPath(dispType, 'nt', t);
	Zotero.debug("ntPath : " + ntPath);
	if(ntPath != '') {
		var ntObj = doc.evaluate(ntPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(ntObj) {
			associateFieldData(newArticle, ntObj, 'notes');				
		}
	}
	
	//date entered
	var dtPath = getXPath(dispType, 'der', t);	
	if(dtPath != '') {
		var dtObj = doc.evaluate(dtPath, doc, nsResolver,  XPathResult.ANY_TYPE, null).iterateNext();
		if(dtObj) {
			associateFieldData(newArticle, dtObj, 'dateAdded');
		}
	}
	
	//date updated
	var udtPath = getXPath(dispType, 'ud', t);	
	if(dtPath != '') {
		var udtObj = doc.evaluate(udtPath, doc, nsResolver,  XPathResult.ANY_TYPE, null).iterateNext();
		if(udtObj) {
			associateFieldData(newArticle, udtObj, 'dateModified');
		}
	}
	
	var pdfURL='';
	var pdfLink = getXPath(dispType,'pdfLink',t);
	if(pdfLink != '') {
		var pdfObj = doc.evaluate(pdfLink, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(pdfObj ) {
			var pdf = pdfObj.textContent;			
			pdfURL =pdf.match(/https?:[/]+([-\w\.]+)+(:\d+)?([/]([\w/_\.]*(\?\S+)?)?)?/);
			//Zotero.debug("pdfURL :" + pdfURL[0]);			
		}
	}
	
	var snapShotURL='';
	var recid = getXPath(dispType,'recid',t);	
	if(recid != '') {
		var recObj= doc.evaluate(recid, doc,  nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if(recObj) {
			var rec =  recObj.value;			
			snapShotURL =  'http://' + host + '/hww/jumpstart.jhtml?recid=' + rec + '&fmt=S&DT=full';
			//Zotero.debug("snapShotURL :" + snapShotURL );		
					
		}
	}
	
	if(pdfURL != null || snapShotURL != null) {
		newArticle.attachments = [
			{url:snapShotURL, title:"WilsonWeb Snapshot", mimeType:"text/html"},
			{url:pdfURL[0], title:"WilsonWeb Full Text PDF", mimeType:"application/pdf"}
			];	
	}
}

function associateBookData( doc, newArticle, t) {	
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? 
	function(prefix) {
	if (prefix == 'x') 
		return namespace;
	 else 
	 	return null;
	} : null;
	
	var host = doc.location.host;
	
	//author
	var authorPath = getXPath(dispType,'au',t);	
	var authorObj = doc.evaluate(authorPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
	
	if(authorObj) {
		associateAuthorData(newArticle, authorObj);
	}	
	
	//publisher	
	var pbPath = getXPath(dispType, 'pb', t);
	if(pbPath != '') {
		var pbObj = doc.evaluate(pbPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(pbObj) {
			associateFieldData(newArticle, pbObj, 'publisher');				
		}
	}
	
	//pages
	var pgPath = getXPath(dispType, 'pa', t);	
	if(pgPath != '') {
		var pgObj = doc.evaluate(pgPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(pgObj) {
			associateFieldData(newArticle, pgObj, 'numPages');				
		}
	}
	
	//la	
	var laPath = getXPath(dispType, 'la', t);
	if(laPath != '') {
		var laObj = doc.evaluate(laPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(laObj) {
			associateFieldData(newArticle, laObj, 'language');				
		}
	}	
	
	//isbn	
	var isbnPath = getXPath(dispType, 'isbn', t);
	if(isbnPath != '') {
		var isbnObj = doc.evaluate(isbnPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(isbnObj) {
			associateFieldData(newArticle, isbnObj, 'ISBN');				
		}
	}
	
	//abstract
	var absPath = getXPath(dispType, 'abs', t);
	if(absPath != '') {
		var absObj = doc.evaluate(absPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(absObj) {
			associateFieldData(newArticle, absObj, 'abstractNote');				
		}
	}	
	
	//subject	
	var tagsContent = new Array();
	var suPath = getXPath(dispType, 'su', t);	
	if(suPath != '') {
		var suObj = doc.evaluate(suPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();		
		if(suObj) {
			var subjects = suObj.textContent.split(';');
			for (var i in subjects) {		
				Zotero.debug(subjects[i]);			
				tagsContent.push(subjects[i]);
			}
			for (var i = 0; i < tagsContent.length; i++) {
				newArticle.tags[i] = tagsContent[i];
			}
		}
	}
	
	//note	
	/*var noteContent = new Array();
	var ntPath = getXPath(dispType, 'nt', t);		
	Zotero.debug("ntPath : " + ntPath);
	if(ntPath != '') {
		var ntObj = doc.evaluate(ntPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(ntObj) {
			var notes = ntObj.textContent.split(';');
			for(var i in notes) {
				noteContent.push(notes[i]);
			}
			for (var i=0; i<noteContent.length; i++) {
				newArticle.notes[i] = noteContent[i];
			}
			//associateFieldData(newArticle, ntObj, 'notes');	
			//newArticle.notes = ntObj.textContent;	
		}
	}*/
	
	//date entered
	var dtPath = getXPath(dispType, 'der', t);	
	if(dtPath != '') {
		var dtObj = doc.evaluate(dtPath, doc, nsResolver,  XPathResult.ANY_TYPE, null).iterateNext();
		if(dtObj) {
			associateFieldData(newArticle, dtObj, 'dateAdded');
		}
	}
	
	//date updated
	var udtPath = getXPath(dispType, 'ud', t);	
	if(dtPath != '') {
		var udtObj = doc.evaluate(udtPath, doc, nsResolver,  XPathResult.ANY_TYPE, null).iterateNext();
		if(udtObj) {
			associateFieldData(newArticle, udtObj, 'dateModified');
		}
	}
	
	//series
	var seriesPath = getXPath(dispType, 'TSN', t);	
	if(seriesPath != '') {
		var seriesObj = doc.evaluate(seriesPath, doc, nsResolver,  XPathResult.ANY_TYPE, null).iterateNext();
		if(seriesObj) {
			associateFieldData(newArticle, seriesObj, 'series');
		}
	}
	
	var fullTextURL;
	var fullTextLink = getXPath(dispType,'fullTextLink',t);
	if(fullTextLink != '') {
		var fullTextObj = doc.evaluate(fullTextLink, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(fullTextObj ) {
			var fullText = fullTextObj.textContent;			
			fullTextURL=fullText.match(/https?:[/]+([-\w\.]+)+(:\d+)?([/]([\w/_\.]*(\?\S+)?)?)?/);
			//Zotero.debug("fullTextURL:" + fullTextURL[0]);			
		}
	}
	
	if(fullTextURL != null ) {
		newArticle.attachments = [
			{url:fullTextURL[0], title:"Book Full Text", mimeType:"text/html"}
		];	
	}
	
	var pdfURL;
	var pdfLink = getXPath(dispType,'pdfLink',t);
	if(pdfLink != '') {
		var pdfObj = doc.evaluate(pdfLink, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
		if(pdfObj ) {
			var pdf = pdfObj.textContent;//			
			pdfURL =pdf.match(/https?:[/]+([-\w\.]+)+(:\d+)?([/]([\w/_\.]*(\?\S+)?)?)?/);
			//Zotero.debug("pdfURL :" + pdfURL[0]);			
		}
	}
	
	if(pdfURL != null ) {
		newArticle.attachments = [
			{url:pdfURL[0], title:"WilsonWeb Full Text PDF", mimeType:"application/pdf"}
		];	
	}

	
}

function associateArtData(doc, newArticle,t) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? 
	function(prefix) {
	if (prefix == 'x') 
		return namespace;
	 else 
	 	return null;
	} : null;
	
	var host = doc.location.host;
	
	//artist
	var artist;
	var authorPath = getXPath(dispType,'ar',t);    
        var authorObj = doc.evaluate(authorPath, doc, nsResolver, XPathResult.ANY_TYPE, null);            
    
        while(artist = authorObj.iterateNext()) {
             newArticle.creators.push(Zotero.Utilities.cleanAuthor(artist.textContent, "artist"));
        }    
        
        //subject
   
    var tagsContent = new Array();
    var suPath = getXPath(dispType, 'su', t);
    if(suPath != '') {
        var suObj = doc.evaluate(suPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();        
        if(suObj) {
            var subjects = suObj.textContent.split(';');
            for (var i in subjects) {     
            	tagsContent.push(subjects[i]);
            }
            for (var i = 0; i < tagsContent.length; i++) {
                newArticle.tags[i] = tagsContent[i];
            }
        }
    }
	
	//artworksize
	var sizePath = getXPath(dispType,'siz',t);    
	if(sizePath != '') {
	        var sizeObj = doc.evaluate(sizePath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();            
	        if(sizeObj) {
		        associateFieldData(newArticle, sizeObj, 'artworkSize');	
	        }
	 }
        
        //artworkmedium
   	var mediumPath = getXPath(dispType,'mt',t);    
   	if(mediumPath != '') {
	        var mediumObj = doc.evaluate(mediumPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();            
	        if(mediumObj ) {
	            associateFieldData(newArticle, mediumObj, 'artworkMedium');    
	        }
        }
        
         //location
       var locPath = getXPath(dispType,'own',t);    
       if(locPath != '') {
	        var locObj = doc.evaluate(locPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();            
	        if(locObj) {
	            associateFieldData(newArticle, locObj, 'place');    
	        }
        }
        
        //abstract
    	var absPath = getXPath(dispType, 'abs', t);
   	if(absPath != '') {
        	var absObj = doc.evaluate(absPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();            
        	if(absObj) {
            		associateFieldData(newArticle, absObj, 'abstractNote');                
        	}
    	}    
}

function associateAuthorData(zoteroItem, zoteroObj) {
	var fTitle;
	var author = zoteroObj.textContent;	
	//Zotero.debug("Author : " + author);
	if (author.match("; ")) {
		var authors = author.split(";");
		for (var i in authors) {
			//Zotero.debug("authors["+i+"] - " + authors[i]); 		
			zoteroItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author",true));
		}
	} else {
		zoteroItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author",true));
	}
}

function associateSourceData(zoteroItem, zoteroObj) {
	//source
	var source = zoteroObj.textContent;		

	//volume 
	var vol = source.match(/[v].\s*\d+/);
	if(vol) 
		zoteroItem["volume"] =  vol[0].match(/\d+/);
		
	//issue
	var issue = source.match(/[no]..\s*\d+[/]*[\d+]*/);
	if(issue)
		zoteroItem["issue"] = issue[0].match(/\d+[/]*[\d+]*/);
	
	//date
	var date = source.match(/\b\w+\s*\d*\s*\d{4}\b/);	
	zoteroItem["date"] = date;	
	
	//pages
	var pages = source.match(/[p].\s*\d+[-]*\d+/);	
	if(pages)	
		zoteroItem["pages"] = pages[0].match(/\d+[-]*\d+/);

	zoteroItem["source"] = source;
}

function associateFieldData(zoteroItem, zoteroObj, zoteroField) {
	var fieldValue = zoteroObj.textContent.replace(/^\s*|\s*$/g, '');	
	zoteroItem[zoteroField] = fieldValue;
	//Zotero.debug(zoteroField + " - " + fieldValue);
}



function getXPath(dispType,field,p) {
	var xPath = "";
	var pos = "";
	if(p)
		pos = "[" + p + "]";

	if(dispType == 'brief') {
		
		switch(field){
						
			case 'cxpath1' : xPath = '//div[@id="results"]//table[contains(@class,"rectable")]/tbody/tr/td[2]/table/@class';
						break;
			case 'cxpath' : xPath = '//div[@id="results"]/table[contains(@class,"rectable")]/tbody/tr/td[2]/p/@class';
						break;
			case 'chk' : xPath = '//input[@name="checkbox"][@type="checkbox"]';
						break;
			case 'ti': 	xPath = "//span[contains(@class,'ti')][1]";
					break;
			case 'au': xPath =  '//table[@class="rectable"]'+ pos +'//span[contains(@class,"au")]';
					break;
			case 'jn': xPath =  '//table[@class="rectable"]'+ pos +'//span[contains(@class,"jn")]';
					break;
			case 'so' : xPath = '//table[@class="rectable"]'+ pos +'/tbody/tr/td[2]/table/tbody/tr/td/p/table[1]/tbody/tr/td/span[contains(@class,"so")]';
						break;
			case 'pdfLink' : xPath = '//table[@class="rectable"]' + pos + '//span[@id="pdf"]/a/@onclick';
						break;
			case 'fullTextLink' : xPath = '//div[@id="results"]/table' + pos + '//span[@id="fullText"]/a/@onclick';
							break;
			case 'recid' : xPath = '//table[@class="rectable"]' + pos + '//input[@name="recid"]';
						break;
			case 'pb' : xPath = '//table[@class="rectable"]' + pos + '//span[contains(@class,"pb")]';
						break;
			case 'pa' : xPath = '//table[@class="rectable"]' + pos + '//span[contains(@class,"pa")]';
						break;
			case 'ar' : xPath =  '//table[@class="rectable"]' + pos + '//span[contains(@class,"ar")]';
						break;
			
		}
		
	}	
	else if (dispType == "details") {		
		
		switch(field){		
			
			case 'cxpath' : xPath = '//div[@id="results"]/table/tbody/tr[2]/td/table/@class';
                       				break;	
			case 'ti': 	xPath = "//span[contains(@id,'ti')]";
					break;
			case 'ar':  xPath = '//table[@id="recData"]//td[@class="bioartmid"]//span[contains(@id,"namdir")]';
                        		break;                      
			case 'siz' : xPath = "//span[contains(@id,'siz')]";
					break;
			case 'mt' : xPath = "//span[contains(@id,'mt')]";
                    			break;
			case 'abs' :
			case 'su' : 
			case 'own' : xPath='//div[@id="results"]//table[@id="recData"]/tbody/tr/td[2]//span[contains(@id,"' + field + '")]';
                                break;
			
		}
	}	
	else {
		
		switch(field) {
			
			case 'cxpath' : xPath = '//div[@id="results"]/table/tbody/tr[2]/td/table/@class';
						break;
			case 'ti': xPath = '//div[@id="results"]//td[contains(@id, "ti")]';
					break;
			case 'au' : 
			case 'jn':
			case 'su' : 
			case 'so' : 
			case 'issn' :
			case 'la' : 
			case 'abs' :
			case 'doi' : 
			case 'inst' : 
			case 'pb' : 
			case 'pa' :
			case 'isbn' :
			case 'der' :
			case 'ud' :
			case 'TSN' :
			case 'orb' :	
			case 'siz' :		
			case 'mt' :
			case 'own' :
			case 'nt' :	xPath = '//div[@id="results"]/table[@class="rectable"]' + pos + '//table[@id="recData"]//td[contains(@id, "' + field + '")]';
						break;
			case 'pdfLink' : xPath = '//div[@id="results"]/table' + pos + '//table[@id="recData"]//span[@id="pdf"]/a/@onclick';
						break;
			case 'fullTextLink' : xPath = '//div[@id="results"]/table' + pos + '//span[@id="fullText"]/a/@onclick';
							break;
			case 'recid' : xPath = '//div[@id="results"]/table' + pos + '//input[@name="recid"]';
						break;
			case 'ar': 	xPath = '//div[@id="results"]/table[@class="rectable"]' + pos + '//table[@id="recData"]//td[contains(@id, "ar")]/span[contains(@id,"namdir")]';
						break;
		}
		
	}	
	return xPath;
}

function scrape(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? 
	function(prefix) {
		if (prefix == 'x') 
			return namespace; 
		else 
			return null;
	} : null;
		
	var newItem = new Zotero.Item(resultType);
	newItem.url = doc.location.href;
	
	var titleObj = doc.evaluate(getXPath(dispType,'ti'), doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	newItem.title = titleObj.textContent;
	
	switch(resultType) {
		case 'journalArticle' : associateBIBLData(doc, newItem, 1);
							break;
		case 'book' : associateBookData(doc, newItem, 1);
							break;
		case 'artwork' : associateArtData(doc, newItem, 1);
                           break;                           
               
	}

	newItem.complete();
	
	
}
