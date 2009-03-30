{
	"translatorID":"c816f8ad-4c73-4f6d-914e-a6e7212746cf",
	"translatorType":4,
	"label":"Neural Information Processing Systems",
	"creator":"Fei Qi",
	"target":"http://books\\.nips\\.cc/nips\\d+\\.html",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":false,
	"lastUpdated":"2009-03-21 11:23:12"
}

function detectWeb(doc, url) {
	return "multiple";
}

function grabCitation( paper ) {
	// Zotero.debug( paper.title );
	// Zotero.debug( paper.pdf );
	// Zotero.debug( paper.bib );
	Zotero.Utilities.HTTP.doGet( paper.bib, function( text ) {
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("9cb70025-a888-4a29-a210-93ec52da40d4");
		// Zotero.debug( text );
		translator.setString( text );
		translator.setHandler( "itemDone", function( obj, item ) {
			item.attachments = [{url:paper.pdf, title:paper.title, mimeType:"application/pdf"}];
			item.complete();
		} );
		translator.translate();
	}, function() {Zotero.done();}, null);
}

function doWeb( doc, url ) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {} : null;
	// if( doc.title.match( "Search" ) ){
	//	var titleRe = '//i';
	//	var urlRe = '//a';
	//} else {
		var titleRe = '//table//td/b';
		var urlRe = '//table//td/a';
	//}
	if (detectWeb(doc, url) == "multiple") {
		// Retrive items
		var items = new Object();
		var arts = new Array();
		var titles =  doc.evaluate( titleRe, doc, ns, XPathResult.ANY_TYPE, null);
		var urls = doc.evaluate( urlRe, doc, ns, XPathResult.ANY_TYPE, null);
		if( titles ) {
			var title = titles.iterateNext();
			var url = urls.iterateNext();
			var idx = 0;
			while( title && urls ) {
				var art = new Object;
				// Zotero.debug( title.textContent );
				items[idx] = title.textContent;
				art.title = items[idx];
				var urlnum = 0;
				while( urlnum < 2 && url ) {
					if( 0 <= url.textContent.search( 'pdf' ) ) {
						art.pdf = url.href;
						urlnum++;
					}
					if( 0 <= url.textContent.search( 'bib' ) ) {
						art.bib = url.href;
						urlnum++;
					}
					url = urls.iterateNext();
				}
				arts.push( art );
				idx++;
				title = titles.iterateNext();
				url = urls.iterateNext();
			}
		}
		items = Zotero.selectItems( items );
		for (var item in items) {
			grabCitation( arts[item] );
		}
	}
	Zotero.wait();
}
