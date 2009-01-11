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
	"lastUpdated":"2009-01-11 02:17:07"
}

function detectWeb(doc, url) {
	if (url.match(/.*[^A-Za-z0-9]ID=[A-Z0-9].*$/)) {
		var journal_test = doc.evaluate( '//td[contains(text(),"frequency of publication") or contains(text(),"巻次・年月次")]',  doc, null, XPathResult.ANY_TYPE, null).iterateNext();
		if (!journal_test) {
			return "book";
		}
	}
}

/*
 * Set the texts used to find raw citation elements
 */
function setSpec() {
	var spec = new Array();
	spec['title'] = ['題および','title and statement'];	
	spec['year'] = ['出版・頒布','publication,distribution'];
	spec['isbn'] = ['国際標準図書','international standard book'];
	spec['authors'] = ['著者標目','author link'];
	spec['series'] = ['書誌構造','parent bibliography'];
	return spec;
}

/*
 * Extract raw string sets from the page.  This is the only function that uses
 * xpath.  The string sets retrieved for each label registered by setSpec is 
 * stored as a list, to cope with the possibility of multiple instances of the
 * same label with different data.
 */
function getData(doc, spec) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var data = new Object();
	for (key in spec) {
		var check = doc.evaluate("//td[contains(text(),'"+spec[key][0]+"') or contains(text(),'"+spec[key][1]+"')]/following-sibling::td", doc, nsResolver, XPathResult.ANY_TYPE, null);
		var c = check.iterateNext();
		while (c) {
			if (!data[key] ) {
				data[key] = new Array();
			}
			data[key].push(Zotero.Utilities.cleanString(c.textContent));
			c = check.iterateNext();
		}
	}
	return data;
}

/*
 * Chop a semicolon-delimited string of authors out of a raw title string,
  * check it for Japanese characters, and save the raw string for each author
  * to an array.  If no Japanese authors were found, save directly to the item 
  * object. 
 */
parseRomanAuthors = function (item,data) {
	var datastring = data['title'][0];
	// don't bother if there is no author info
	if ( ! datastring.match(/.*\/.*/) ) {
		return true;
	}
	// cut off the title
	datastring = datastring.replace(/.*\//, "");
	// raise flag if there are japanese characters
	var japanese_check = datastring.match(/.*[^- &0-9()\[\];:,.a-zA-Z].*/);
	// replace comma with semicolon in certain cases, to prepare for split
	datastring = datastring.replace(/,(\s+[a-zA-Z]{3,})/, ";$1");
	datastring = datastring.replace(/,(\s+[a-zA-Z]{1}[^a-zA-Z])/, ";$1");
	datastring = datastring.replace(/(\s+and\s+)/, "; ");
	datastring = datastring.replace(/(\s+&\s+)/, "; ");
	// split the authors
	var authors = datastring.replace(/\|.*/, "").split(";");
	// this is parsing the authors for a single work.  if there is a special byline, we
	// assume that it applies to all subsequent entries until overridden.
	var authortype = 'author';
	for (i in authors) {
		item.authorstrings.push(authors[i]);
		var authortypehint = authors[i].replace(/^([ ,.:a-z]*).*/, "$1");
		if ( authortypehint.match(/.*(edit|organiz).*/) ) {
			authortype = "editor";
		} else if ( authortypehint.match(/.*trans.*/) ) {
			authortype = "translator";
		}
		author = authors[i].replace(/^[ a-z]*/, "").replace( /\.\.\..*/, "" );
		// need to test for length because the replacement of commas with semicolons
		// can cause a short split at the end of a byline that originally ended in a comma 
		if ( ! japanese_check && author.length ) {
			item.creators.push(Zotero.Utilities.cleanAuthor(author, authortype));
		}
	}
	return japanese_check;
}

/*
 * For each author link, attempt to find a hint that the person
 * is an editor or translator, first in the link text itself, then in
 * the list of raw author strings captured by parseRomanAuthors.
 * Clean out cruft, reverse the order of each name, and save
 * directly to the item object.
 */
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
		var author = authors[i].replace(/[*]/g,"").replace(/[0-9<()|].*/, "").replace(/(.*?),(.*)/, "$2 $1");
		// If we claim to be an author, double-check in the English entries for a translator hint.
		// This is an enormous pain, but the original records are a mess, with different conventions
		// for Japanese and foreign records, sometimes mixed up in the same entry.  What are you
		// going to do.
		for ( x in item.authorstrings ) {
			var authorstring = item.authorstrings[x];
			Zotero.debug(authorstring);
			var name = author.split(" ");
			name.reverse();
			if ( authorstring.indexOf( name[0] ) > -1 && authorstring.match(/.*(訳|譯|譯註)$/) ) {
				authortype = 'translator';
				break;
			} else if ( authorstring.indexOf( name[0] ) > -1 && authorstring.match(/.*(編|編著)$/) ) {
				authortype = 'editor';
				break;
			}
		}
		delete item.authorstrings;
		item.creators.push(Zotero.Utilities.cleanAuthor(author, authortype));
	}
}

/*
 * Split extracted title field.  This always starts as a single list item,
 * but can contain entries for several works, as in an omnibus volume of
 * translated works, for example.  Such records separate the elements of
 * the omnibus with periods that have no trailing space, so we use that as
 * the split point.  We discard the phonetic information appended to the end
 * of the string in Japanese records.
 */
function splitTitle(data) {
	// split in data array
	var titlestring = data['title'][0].replace(/\|.*/, "");
	data['title'] = titlestring.split(" . ");
}

/*
 * The scrape function brings the various parsing functions together
 */
function scrape(doc,url) {
	var item = new Zotero.Item("book");
	item.authorstrings = new Array();
	var spec = setSpec();
	var data = getData(doc, spec);
	splitTitle(data);

	if (data['title']) {
		var titles = new Array();
		for (i in data['title']) {
			titles.push( data['title'][i].replace(/\s*\/.*/, "") );
		}
		item.title = titles.join(", ");
		jse_authors = parseRomanAuthors( item, data );
		if ( jse_authors ) {
			parseJapaneseAuthors( item, data );
		}
	}

	if (data['year']) {
		// sometimes there are multiple "date" fields, some of which are filled
		// with other random information
		for (i in data['year']) {
			var year = data['year'][i];
			if ( year.match(/.*[0-9]{3}.*/) ) {
				item.date = year.replace(/.*?([0-9][.0-9][0-9]+).*/, "$1");
				item.place = year.replace(/:.*/, "").replace(/[\[\]]/g, "");
				item.publisher = year.replace(/.*:(.*),.*/, "$1");
				break;
			}
		}
	}
	
	if (data['series']) {
		item.series = data['series'][0].replace(/<.*/, "");
	}
	
	if (data['isbn']) {
		item.ISBN = data['isbn'][0].replace(/[^0-9]*([0-9]+).*/, "$1");
	}
	
	item.complete();
}

function doWeb(doc, url) {
	articles = [url];
	Zotero.Utilities.processDocuments(articles, scrape, function() {
		Zotero.done();
	});
	Zotero.wait();
}
