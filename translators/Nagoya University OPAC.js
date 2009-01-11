{
	"translatorID":"b56d756e-814e-4b46-bc58-d61dccc9f32f",
	"translatorType":4,
	"label":"Nagoya University OPAC",
	"creator":"Frank Bennett",
	"target":"^http://opac.nul.nagoya-u.ac.jp/",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-10 06:15:00"
}

function detectWeb(doc, url) {
	if (url.match(/.*[^A-Za-z0-9]ID=[A-Z0-9].*$/)) {
		var journal_test = doc.evaluate( '//td[contains(text(),"frequency of publication") or contains(text(),"巻次・年月次")]',  doc, null, XPathResult.ANY_TYPE, null).iterateNext();
		if (!journal_test) {
			return "book";
		}
	}
}

// initially posted to zotero-dev as an attachment -- sorry for the extra list traffic that caused

parseRomanAuthors = function (item,data) {
	var result = false;
	var datastring = data['title'][0].replace(/.*\//, "")
	if ( datastring.match(/.*[^- 0-9()\[\];:.a-zA-Z].*/) ) {
		return result;
	}
	var authors = datastring.split(";");
	for (i in authors) {
		authortype = authors[i].replace(/^([ a-z]*).*/, "$1");
		if ( authortype.match(/.*edit.*/) ) {
			authortype = "editor";
		} else if ( authortype.match(/.*trans.*/) ) {
			authortype = "translator";
		} else {
			authortype = "author";
		}
		author = authors[i].replace(/^[ a-z]*/, "").replace( /\.\.\..*/, "" );
		item.creators.push(Zotero.Utilities.cleanAuthor(author, authortype));
		result = true;
	}
	return result;
}

parseJapaneseAuthors = function ( item, data ) {
	var authortype = author;
	var authors = data['authors'];
	for (i in authors ) {
		if ( authors[i].match(/.*編.*/) ) {
			authortype = 'editor';
		} else if ( authors[i].match(/.*訳.*/) ) {
			authortype = 'translator';
		} else {
			authortype = 'author';
		}
		var author = authors[i].replace(/[*]/g,"").replace(/[0-9<(|].*/, "").replace(/(.*?),(.*)/, "$2 $1");
		item.creators.push(Zotero.Utilities.cleanAuthor(author, authortype));
	}
}

function scrape(doc,url) {
	var item = new Zotero.Item("book");
	var spec = new Array();
	spec['title'] = ['題および','title and statement'];	
	spec['year'] = ['出版・頒布','publication,distribution'];
	spec['isbn'] = ['国際標準図書','international standard book'];
	spec['authors'] = ['著者標目','author link'];
	spec['series'] = ['書誌構造','parent bibliography'];
	var data = {};
	for (key in spec) {
		var check = doc.evaluate("//td[contains(text(),'"+spec[key][0]+"') or contains(text(),'"+spec[key][1]+"')]/following-sibling::td", doc, null, XPathResult.ANY_TYPE, null);
		var c = check.iterateNext();
		if (!data[key] && c) {
			data[key] = [];
		}
		while (c) {
			data[key].push(Zotero.Utilities.cleanString(c.textContent));
			c = check.iterateNext();
		}
	}

	if (data['title']) {
		item.title = data['title'][0].replace(/\/.*/, "");
		// if authors are in roman letters, use them
		has_author = parseRomanAuthors( item, data );
		// otherwise, use author links
		if (!has_author) {
			parseJapaneseAuthors( item, data );
		}
	}
	if (data['year']) {
		item.date = data['year'][0].replace(/.*?([0-9][.0-9][0-9]+).*/, "$1");
		item.place = data['year'][0].replace(/:.*/, "");
		item.publisher = data['year'][0].replace(/.*:(.*),.*/, "$1");
	}
	
	// apparently the series field does not exist in this capture type
	//if (data['series']) {
	//	Zotero.debug('series: '+data['series'][0]);
	//	item.series = data['series'][0].replace(/<.*/, "");
	//}
	
	item.complete();
}
function doWeb(doc, url) {
	var articles = [url];
	Zotero.Utilities.processDocuments(articles, scrape, function() {Zotero.done();});
	Zotero.wait();
}

