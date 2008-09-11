{
	"translatorID":"72cb2536-3211-41e0-ae8b-974c0385e085",
	"translatorType":4,
	"label":"ARTFL Encyclopedie",
	"creator":"Sean Takats",
	"target":"/cgi-bin/philologic31/(getobject\\.pl\\?c\\.[0-9]+:[0-9]+\\.encyclopedie|search3t\\?dbname=encyclopedie0507)",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-12 19:30:00"
}

function detectWeb(doc, url) {
	if (url.indexOf("getobject.pl") != -1){
		return "encyclopediaArticle";
	} else {
		return "multiple";
	}
}

function reconcileAuthor(author){
	var authorMap = {
		"Venel":"Venel, Gabriel-François",
		"d'Aumont":"d'Aumont, Arnulphe",
		"de La Chapelle":"de La Chapelle, Jean-Baptiste",
		"Bourgelat":"Bourgelat, Claude",
		"Dumarsais":"Du Marsais, César Chesneau",
		"Mallet":"Mallet, Edme-François",
		"Toussaint":"Toussaint, François-Vincent",
		"Daubenton":"Daubenton, Louis-Jean-Marie",
		"d'Argenville": "d'Argenville, Antoine-Joseph Desallier",
		"Tarin":"Tarin, Pierre",
		"Vandenesse":"de Vandenesse, Urbain",
		"Blondel": "Blondel, Jacques-François",
		"Le Blond":"Le Blond, Guillaume",
		"Rousseau":"Rousseau, Jean-Jacques",
		"Eidous":"Eidous, Marc-Antoine",
		"d'Alembert":"d'Alembert, Jean le Rond",
		"Louis":"Louis, Antoine",
		"Bellin":"Bellin, Jacques-Nicolas",
		"Diderot":"Diderot, Denis",
		"Diderot1":"Diderot, Denis",
		"Diderot2":"Diderot, Denis",
		"de Jaucourt":"de Jaucourt, Chevalier Louis",
		"Jaucourt":"de Jaucourt, Chevalier Louis",
		"d'Holbach":"d'Holbach, Baron"
		/* not yet mapped
		Yvon
		Forbonnais
		Douchet and Beauzée
		Boucher d'Argis
		Lenglet Du Fresnoy
		Cahusac
		Pestré
		Daubenton, le Subdélégué
		Goussier
		de Villiers
		Barthès
		Morellet
		Malouin
		Ménuret de Chambaud
		Landois
		Le Roy
		*/
	}
	if(authorMap[author]) {
		author = authorMap[author];
	}
	// remove ARTFL's trailing 5 for odd contributors (e.g. Turgot5)
		if (author.substr(author.length-1, 1)=="5"){
		author = author.substr(0, author.length-1);
	}
	return author;
}

function scrape (doc){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;
		var url = doc.location.href;
		var newItem = new Zotero.Item("encyclopediaArticle");
		var xpath = '/html/body/div[@class="text"]/font';
		var titleElmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if (titleElmt) {
			var title = titleElmt.textContent;
		} else {
			xpath = '/html/body/div[@class="text"]/b';
			var title = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		}
		newItem.title = title;
		newItem.encyclopediaTitle = "Encyclopédie, ou Dictionnaire raisonné des sciences, des arts et des métiers";
		newItem.shortTitle = "Encyclopédie";
		newItem.date = "1751-1772";
		newItem.publisher = "Briasson";
		newItem.place = "Paris";
		newItem.url = url;
	
		newItem.attachments.push({title:"ARTFL Snapshot", mimeType:"text/html", url:url, snapshot:true});
	
		// get author and tags
		var hostRegexp = new RegExp("^(https?://[^/]+)/");
		var hMatch = hostRegexp.exec(url);
		var host = hMatch[1];
		var getString1 = "/cgi-bin/philologic31/search3t?dbname=encyclopedie0507&word=&dgdivhead=";
		var getString2 = "&dgdivocauthor=&dgdivocplacename=&dgdivocsalutation=&dgdivocclassification=&dgdivocpartofspeech=&dgdivtype=&CONJUNCT=PHRASE&DISTANCE=3&PROXY=or+fewer&OUTPUT=conc&POLESPAN=5&KWSS=1&KWSSPRLIM=500";
		
		Zotero.Utilities.HTTP.doGet(host+getString1+title+getString2, function(text){
			var tagRe = new RegExp('>'+title+'</a>[^\[]*\\[([^\\]]*)\]', 'i');
			var m = tagRe.exec(text);
			if(m[1] != "unclassified"){
			 	var tagstring = m[1].replace("&amp;", "&", "g");
				var tags = tagstring.split(";")
				for(var j in tags) {
					newItem.tags.push(Zotero.Utilities.cleanString(tags[j]));
				}
			}
			var authorRe = new RegExp('>'+title+'</a>,([^,]*),', "i");
			var m = authorRe.exec(text);
			var author = m[1];
			author = Zotero.Utilities.cleanString(author);
			// reconcile author
			author = reconcileAuthor(author);	
			if (author!="NA"){ // ignore unknown authors
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author", true));
			}
			newItem.creators.push({firstName:"Denis", lastName:"Diderot", creatorType:"editor"});
			newItem.creators.push({firstName:"Jean le Rond", lastName:"d'Alembert", creatorType:"editor"});
			newItem.complete();
		}, function() {Zotero.done();}, null);
		Zotero.wait();	
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;

	if (url.indexOf("getobject.pl") != -1){
		// single article
		scrape(doc);				
	} else {
		//search page
		var items = new Object();
		var xpath = '/html/body/div[@class="text"]/p/a';
		var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;		
		while (elmt = elmts.iterateNext()){
			var title = elmt.textContent;
			var link = elmt.href;
			if (title && link){
				items[link] = title;
			}			
		}
		var items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();	
	}
		
}