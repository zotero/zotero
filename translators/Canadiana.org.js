{
	"translatorID":"2d174277-7651-458f-86dd-20e168d2f1f3",
	"translatorType":4,
	"label":"Canadiana.org",
	"creator":"Adam Crymble",
	"target":"http://(www.)?canadiana.org",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-12 19:30:00"
}

function detectWeb(doc, url) {
   
   //checks the title of the webpage. If it matches, then the little blue book symbol appears in the address bar.
   //works for English and French versions of the page.
    
   	 if(doc.title == "Early Canadiana Online - Item Record"|doc.title == "Notre mémoire en ligne - Notice") {
        	return "book";
	} else if (doc.evaluate('//div[@id="Content"]/div[@class="NormalRecord"]/h3/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return  "multiple";
	}
}



//Canadiana Translator Coding by Adam Crymble
//because the site uses so many random formats for the "Imprint" field, it's not always perfect. But it works for MOST entries

function associateData (newItem, dataTags, field, zoteroField) {
	if (dataTags[field]) {
		newItem[zoteroField] = dataTags[field];
	}
}

function scrape(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x" ) return namespace; else return null;
	} : null;
        	
       	//declaring variables to be used later.
	var newItem = new Zotero.Item("book");
	newItem.url = doc.location.href;
	
	var dataTags = new Object();
	var fieldTitle;
	var tagsContent= new Array();
        
        //these variables tell the program where to find the data we want in the HTML file we're looking at.
        //in this case, the data is found in a table.
        var xPath1 = '//tr/td[1][@class="Label"]';
        var xPath2 = '//tr/td[2]';
       
      
       //at this point, all the data we want has been saved into the following 2 Objects: one for the headings, one for the content.
       // The 3rd object tells us how many items we've found.
       if (doc.evaluate('//tr/td[1][@class="Label"]', doc, nsResolver, XPathResult.ANY_TYPE, null)) {
       		 var xPath1Results = doc.evaluate(xPath1, doc, nsResolver, XPathResult.ANY_TYPE, null);
      		  var xPath2Results = doc.evaluate(xPath2, doc, nsResolver, XPathResult.ANY_TYPE, null);
      		  var xPathCount = doc.evaluate( 'count (//tr/td[1][@class="Label"])', doc, nsResolver, XPathResult.ANY_TYPE, null);       	
  	}  
  
  	//At this point we have two lists (xPath1Results and xPath2Results). this loop matches the first item in the first list
  	//with the first item in the second list, and on until the end. 
  	//If we then ask for the "Principal Author" the program returns "J.K. Rowling" instead of "Principal Author"
   	if (doc.evaluate('//tr/td[1][@class="Label"]', doc, nsResolver, XPathResult.ANY_TYPE, null)) {
	   	for (i=0; i<xPathCount.numberValue; i++) {	 	
	     			
	     		fieldTitle=xPath1Results.iterateNext().textContent.replace(/\s+/g, '');
	     		
	     			//gets the author's name without cleaning it away using cleanTags.
	     		if (fieldTitle =="PrincipalAuthor:" || fieldTitle == "Auteurprincipal:") {
		     		
		     		fieldTitle="PrincipalAuthor:";
		     		dataTags[fieldTitle]=(xPath2Results.iterateNext().textContent);
		     		var authorName =dataTags["PrincipalAuthor:"].split(",");
		     		authorName[0]=authorName[0].replace(/\s+/g, '');
		     		dataTags["PrincipalAuthor:"]= (authorName[1] + (" ") + authorName[0]);
		     		newItem.creators.push(Zotero.Utilities.cleanAuthor(dataTags["PrincipalAuthor:"], "author"));
	     		
		     		//Splits Adressebibliographique or Imprint into 3 fields and cleans away any extra whitespace or unwanted characters.      		
	     		} else if (fieldTitle =="Adressebibliographique:" || fieldTitle == "Imprint:") {
	     		     	
	     		     	fieldTitle = "Imprint:";
	     		     	dataTags[fieldTitle] = Zotero.Utilities.cleanTags(xPath2Results.iterateNext().textContent);
	     		     	
	     		     	var separateImprint = dataTags["Imprint:"].split(":");
	     		     	separateImprint[0]= separateImprint[0].replace(/^\s*|\[|\]/g,'');
		     		dataTags["Place:"]=separateImprint[0];
		     		
		     		var justDate = separateImprint[1].replace(/\D/g, '');
		     		dataTags["Date:"]= justDate;
		     		
		     		separateImprint[1] = separateImprint[1].replace(/\d|\[|\]|\./g, '');
		     		separateImprint[1] = separateImprint[1].replace(/^\s*|\s*$/g, '');
		     		dataTags["Publisher:"]= separateImprint[1];
		     		
		     		// determines how many tags there will be, pushes them into an array and clears away whitespace.
		     	} else if (fieldTitle == "Subject:" || fieldTitle == "Sujet:") {
			     	
			     	tagsContent.push(Zotero.Utilities.cleanTags(xPath2Results.iterateNext().textContent.replace(/^\s*|\s*$/g, '')));
			     	while (fieldTitle != "Collection:") {
				     	i=i+1;
				     	tagsContent.push(Zotero.Utilities.cleanTags(xPath2Results.iterateNext().textContent.replace(/^\s*|\s*$/g, '')));
				     	fieldTitle=xPath1Results.iterateNext().textContent.replace(/\s+/g, '');
			     	}
	    
	     		} else {
	     			
	     			dataTags[fieldTitle] = Zotero.Utilities.cleanTags(xPath2Results.iterateNext().textContent.replace(/^\s*|\s*$/g, ''));
	     		
	     		}
	     	}
     	}
     		//Adds a string to CIHM no: and ICMH no: so that the resulting number makes sense to the reader.
     		if (dataTags["CIHMno.:"]) {
	     		
	     		dataTags["CIHMno.:"]=("CIHM Number: " + dataTags["CIHMno.:"]);
     		}
     		
     		if (dataTags["ICMHno:"]) {
	     		
	     		dataTags["ICMHno:"]=("ICMH nombre: " + dataTags["ICMHno:"]);
     		}
     		
     		//makes tags of the items in the "tagsContent" array.
     		for (var i = 0; i < tagsContent.length; i++) {
	     		newItem.tags[i] = tagsContent[i];
     		}
     	
     	//calls the associateData function to put the data in the correct Zotero field.	
	associateData (newItem, dataTags, "Title:", "title");
	associateData (newItem, dataTags, "Place:", "place");
     	associateData (newItem, dataTags, "Publisher:", "publisher");
     	associateData (newItem, dataTags, "Date:", "date");			
	associateData (newItem, dataTags, "PageCount:", "pages");
	associateData (newItem, dataTags, "CIHMno.:", "extra");
	associateData (newItem, dataTags, "DocumentSource:", "rights");
	
	associateData (newItem, dataTags, "Titre:", "title" );
	associateData (newItem, dataTags, "Nombredepages:", "pages");
	associateData (newItem, dataTags, "ICMHno:", "extra");
	associateData (newItem, dataTags, "Documentoriginal:", "rights");
	
	//Saves everything to Zotero.	
	newItem.complete();

}


function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var articles = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var titles = doc.evaluate('//div[@id="Content"]/div[@class="NormalRecord"]/h3/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href] = next_title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	Zotero.wait();
	
	
	
}