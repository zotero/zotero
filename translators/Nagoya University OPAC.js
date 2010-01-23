{
	"translatorID":"b56d756e-814e-4b46-bc58-d61dccc9f32f",
	"translatorType":4,
	"label":"Nagoya University OPAC",
	"creator":"Frank Bennett",
	"target":"^http://opac.nul.nagoya-u.ac.jp/webopac/(catdbl.do|ctlsrh.do)",
	"minVersion":"2.0b7",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-23 02:17:07"
}

// #######################
// ##### Sample URLs #####
// #######################

/*
 * The site is session-based, with page content negotiated
 * in POST calls.  The starting point for an OPAC search is
 * the URL below.  In testing, I tried the following:
 *
 *   - A search listing of books
 *   - A search listing of journals (no icon)
 *   - A mixed search listing of books and journals
 *   - A journal page (no icon)
 *   - A book page
 */
// http://opac.nul.nagoya-u.ac.jp/webopac/catsrk.do



// #####################
// ##### Constants #####
// #####################

/*
 * Strings corresponding to variables
*/
var pageStrings = {
	title: ['タイトル / 著者','Title / Author'],
	year: ['出版・頒布','Publication'],
	isbn: ['ISBN','ISBN'],
	authors: ['著者名リンク','Author link'],
	series: ['シリーズ情報','Series information']
};

var itemUrlBase = "http://opac.nul.nagoya-u.ac.jp/webopac/catdbl.do";

// ############################
// ##### String functions #####
// ############################

/*
 * Chop a semicolon-delimited string of authors out of a raw title string,
 * check it for Japanese characters, and save the raw string for each author
 * to an array.  If no Japanese authors were found, save directly to the item
 * object.
 */
var parseRomanAuthors = function (item,data) {
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
		var author = authors[i].replace(/^[ a-z]*/, "").replace( /\.\.\..*/, "" );
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
var parseJapaneseAuthors = function (item, data) {
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

// ##########################
// ##### Page functions #####
// ##########################

/*
 * When getlist argument is nil, return a value when the target
 * index DOM contains at least one book entry, otherwise
 * return false.
 *
 * When getlist argument is true, return a list of
 * array items for book entries in the DOM.
 */
var sniffIndexPage = function(doc,getlist){
	var check = doc.evaluate("//td[div[@class='lst_value' and contains(text(),'Books')]]/following-sibling::td",  doc, null, XPathResult.ANY_TYPE, null);
	var node = check.iterateNext();
	if (getlist){
		var ret = new Object();
		while (node){
			var myitems = Zotero.Utilities.getItemArray(
							  doc,
							  node,
							  "document\\.catsrhform\\.pkey.value=");
			for (var r in myitems){
				ret[r] = myitems[r];
			}
			node = check.iterateNext();
		}
		return ret;
	} else {
		return node;
	}
};

/*
 * Invoke sniffIndexPage to generate a list of book
 * items in the target DOM.
 */
var getBookItems = function(doc){
	return sniffIndexPage(doc,true);
};

/*
 * Extract data from the DOM using the var-string pairs in
 * pageStrings as a guide to navigation.
 */
var scrapePage = function(doc, spec) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var data = new Object();
	for (key in spec) {
		var check = doc.evaluate("//th[div[contains(text(),'"+spec[key][0]+"') or contains(text(),'"+spec[key][1]+"')]]/following-sibling::td/div", doc, nsResolver, XPathResult.ANY_TYPE, null);
		var c = check.iterateNext();
		while (c) {
			if (!data[key] ) {
				data[key] = new Array();
			}
			data[key].push(Zotero.Utilities.trimInternal(c.textContent));
			c = check.iterateNext();
		}
	}
	return data;
};

/*
 * Bring it all together.
 */
function scrapeAndParse(doc,url) {
	if (!detectWeb(doc,url)){
		return false;
	}
	var item = new Zotero.Item("book");
	item.authorstrings = new Array();
	var data = scrapePage(doc, pageStrings);
	splitTitle(data);

	if (data['title']) {
		var titles = new Array();
		for (i in data['title']) {
			titles.push( data['title'][i].replace(/\s+\/.*/, "") );
		}
		item.title = titles.join(", ");
		var jse_authors = parseRomanAuthors( item, data );
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
		item.series = data['series'][0].replace(/[/|<].*/, "");
	}

	if (data['isbn']) {
		item.ISBN = data['isbn'][0].replace(/[^0-9]*([0-9]+).*/, "$1");
	}
	item.complete();
}

// #########################
// ##### API functions #####
// #########################

function detectWeb(doc, url) {
	if (url.match(/.*\/webopac\/catdbl.do/)) {
		var journal_test = doc.evaluate( '//th[div[contains(text(),"Frequency of publication") or contains(text(),"刊行頻度") or contains(text(),"巻号") or contains(text(),"Volumes")]]',  doc, null, XPathResult.ANY_TYPE, null).iterateNext();
		if (!journal_test) {
			return "book";
		}
	} else if (url.match(/.*\/webopac\/ctlsrh.do/)){
		if (sniffIndexPage(doc)){
			return "multiple";
		}
	}
	return false;
}

function doWeb(doc, url) {
	var format = detectWeb(doc, url);
	if (format == "multiple") {
		var items = {};
		for (var u in Zotero.selectItems( getBookItems(doc) )){
			var m = u.match(/.*document\.catsrhform\.pkey\.value=\'([^\']+)\'.*/);
			items[itemUrlBase+"?pkey="+m[1]+"&initFlg=_RESULT_SET_NOTBIB"] = true;
		}
		if (items.__count__){
			for (var u in items){
				var d = Zotero.Utilities.retrieveDocument(u);
				scrapeAndParse(d, u);
			}
		}
	} else if (format == "book"){
		scrapeAndParse(doc, url);
	}
}
