{
	"translatorID":"11645bd1-0420-45c1-badb-53fb41eeb753",
	"translatorType":8,
	"label":"CrossRef",
	"creator":"Simon Kornblith",
	"target":"http://partneraccess.oclc.org/",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-09-15 21:00:00"
}

function detectSearch(item) {
	if(item.itemType == "journalArticle") {
		return true;
	}
	return false;
}

function processCrossRef(xmlOutput) {
	xmlOutput = xmlOutput.replace(/<\?xml[^>]*\?>/, "");
	
	// parse XML with E4X
	var qr = new Namespace("http://www.crossref.org/qrschema/2.0");
	try {
		var xml = new XML(xmlOutput);
	} catch(e) {
		return false;
	}
	
	// ensure status is valid
	var status = xml.qr::query_result.qr::body.qr::query.@status.toString();
	if(status != "resolved" && status != "multiresolved") {
		return false;
	}
	
	var query = xml.qr::query_result.qr::body.qr::query;
	var item = new Zotero.Item("journalArticle");
	
	// try to get a DOI
	item.DOI = query.qr::doi.(@type=="journal_article").text().toString();
	if(!item.DOI) {
		item.DOI = query.qr::doi.(@type=="book_title").text().toString();
	}
	if(!item.DOI) {
		item.DOI = query.qr::doi.(@type=="book_content").text().toString();
	}
	
	// try to get an ISSN (no print/electronic preferences)
	item.ISSN = query.qr::issn[0].text().toString();
	// get title
	item.title = query.qr::article_title.text().toString();
	// get publicationTitle
	item.publicationTitle = query.qr::journal_title.text().toString();
	// get author
	item.creators.push(Zotero.Utilities.cleanAuthor(query.qr::author.text().toString(), "author", true));
	// get volume
	item.volume = query.qr::volume.text().toString();
	// get issue
	item.issue = query.qr::issue.text().toString();
	// get year
	item.date = query.qr::year.text().toString();
	// get edition
	item.edition = query.qr::edition_number.text().toString();
	// get first page
	item.pages = query.qr::first_page.text().toString();
	
	item.complete();
	return true;
}

function doSearch(item) {
	if(item.contextObject) {
		var co = item.contextObject;
		if(co.indexOf("url_ver=") == -1) {
			co = "url_ver=Z39.88-2004&"+co;
		}
	} else {
		var co = Zotero.Utilities.createContextObject(item);
	}
	
	Zotero.Utilities.HTTP.doGet("http://www.crossref.org/openurl?req_dat=zter:zter321&"+co+"&noredirect=true", function(responseText) {
		processCrossRef(responseText);
		Zotero.done();
	});
	
	Zotero.wait();
}