{
	"translatorID":"80bc4fd3-747c-4dc2-86e9-da7b251e1407",
	"translatorType":4,
	"label":"Journal of Machine Learning Research",
	"creator":"Fei Qi",
	"target":"^http://jmlr\\.csail\\.mit\\.edu/papers",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":false,
	"lastUpdated":"2009-05-05 07:15:00"
}

function detectWeb(doc, url) {
	var contRe = /(v\d+|topic|special)/;
	var m = contRe.exec( url );
	if (m) {
		if( doc.title.match( "JMLR" ) )
			return "multiple";
		else
			return "journalArticle";
	}
	return false;
}

function scrape( doc, url ) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {} : null;

	var item = new Zotero.Item( "journalArticle" );
	item.url = doc.location.href;
	item.publicationTitle = "Journal of Machine Learning Research";

	// Zotero.debug( 'retrieving title' );
	var title = doc.evaluate( '//div[@id="content"]/h2', doc, ns,
							  XPathResult.ANY_TYPE, null ).iterateNext();
	if( title ){
		var titlecontent = title.textContent.replace( /^\s+/, '' );
		item.title = titlecontent.replace( /\s+$/, '' );
	}

	var refline = doc.evaluate( '//div[@id="content"]/p', doc, ns,
								XPathResult.ANY_TYPE, null ).iterateNext();
	if( refline ) {
		var info = refline.textContent.split( ';' );
		var authors = info[0].split( ',' );
		for ( var j = 0; j < authors.length; j++ ){
			item.creators.push( Zotero.Utilities.cleanAuthor( authors[j], "author" ) );
		}
		// Zotero.debug( 'retrieving publication info' );
		var volissRe = /\s*(\d+)\(\s*(\w+)\s*\):\s*(\d+\s*--\s*\d+),\s*(\d+)./;
		var voliss = info[1].match( volissRe );
		item.volume = voliss[1];
		item.date = voliss[2] + ', ' + voliss[4];
		item.pages = voliss[3];
	}

	var text = doc.evaluate( '//div[@id="content"]', doc, ns,
							 XPathResult.ANY_TYPE, null ).iterateNext();
	// Zotero.debug( doc.textContent );
	var full = text.textContent.split( 'Abstract' );
	var absatt = full[1].split( '[abs]' );
	var abs =absatt[0].replace( /^\s+/, '' );
	item.abstractNote = abs.replace( /\s+$/, '' );
	//Zotero.debug(  item.abstractNote );
	
	var atts = doc.evaluate( '//div[@id="content"]//a', doc, ns,
							 XPathResult.ANY_TYPE, null );
	var att = atts.iterateNext();
	while( att ){
		// Zotero.debug( att.textContent + ' VS ' + att.href );
		if( 0 <= att.textContent.search( 'pdf' ) ) {
			item.attachments = [ {url:att.href,
								  title:item.title,
								  mimeType:"application/pdf"} ];
			break;
		}
		att = atts.iterateNext();
	}
	item.complete();
}

function doWeb( doc, url ) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var n = doc.documentElement.namespaceURI;
		var ns = n ? function(prefix) {} : null;
		// Search page
		var items = new Object();
		var titles =  doc.evaluate( '//div[@id="content"]//dt', doc, ns,
									XPathResult.ANY_TYPE, null );
		var urls = doc.evaluate( '//div[@id="content"]//dd/a', doc, ns, 
								 XPathResult.ANY_TYPE, null );
		if( titles && urls ) {
			var title = titles.iterateNext();
			var url = urls.iterateNext();
			while( title ) {
				while( 0 > url.textContent.search( 'abs' ) )
					url = urls.iterateNext();
				// Zotero.debug( title.textContent + ' AT ' + url.href );
				items[url.href] = title.textContent;
				title = titles.iterateNext();
				url = urls.iterateNext();
			}
		}
		items = Zotero.selectItems(items);
		for (var item in items) {
			arts.push(item);
		}
	} else {
		arts.push(url);
	}

	Zotero.Utilities.processDocuments( arts, scrape, function() {Zotero.done();});
	Zotero.wait();
}
