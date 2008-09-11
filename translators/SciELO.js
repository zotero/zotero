{
	"translatorID":"3eabecf9-663a-4774-a3e6-0790d2732eed",
	"translatorType":4,
	"label":"SciELO",
	"creator":"Michael Berkowitz",
	"target":"http://(www.)?scielo.(org|br)/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-30 08:00:00"
}

function detectWeb(doc, url) {
	if (url.indexOf("wxis.exe") != -1) {
		if (doc.evaluate('//*[@class="isoref"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			return "multiple";
		}
	} else if (url.indexOf("issuetoc") != -1) {
		return "multiple"
	} else if (url.indexOf("&pid=") != -1) {
		return "journalArticle";
	} else {
		Zotero.debug("ok");
	}
}

function makeURL(host, str) {
	return 'http://www.scielo.br/scieloOrg/php/articleXML.php?pid=' + str.match(/pid=([^&]+)/)[1];
}

function doWeb(doc, url) {
	var host = doc.location.host;
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (url.indexOf(".exe") != -1) {
			var titlepath = '//font[@class="isoref"]/font[@class="negrito"]';
			var linkpath = '//font[@class="isoref"]/a[@class="isoref"]';
		} else {
			var titlepath = '//font[@class="normal"]/b/b[1]';
			var linkpath = '//tr/td/div/a[1]';
		}
		var titles = doc.evaluate(titlepath, doc, null, XPathResult.ANY_TYPE, null);
		var links = doc.evaluate(linkpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_title;
		var next_link;
		while ((next_title = titles.iterateNext()) && (next_link = links.iterateNext())) {
			items[next_link.href] = next_title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(makeURL(host, i));
		}
	} else {
		arts = [makeURL(host, url)];
	}
	Zotero.Utilities.HTTP.doGet(arts, function(text) {
		var item = new Zotero.Item("journalArticle");
		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "").replace(/<self-uri.*\/self\-uri>/g, "");
		var journal = text.split("<journal-meta>")[1].split("</journal-meta>")[0];
		journal = "<journal>" + journal + "</journal>";
		journal = journal.replace(/\-([a-z])/g, "$1");
		var xml2 = new XML(journal);
		var art = text.split("<article-meta>")[1].split("</article-meta>")[0];
		art = "<article>" + art + "</article>";
		art = art.replace(/\-([a-z])/g, "$1");
		var xml3 = new XML(art);
		
		item.publicationTitle = xml2..journaltitle.text().toString();
		item.journalAbbreviation = xml2..abbrevjournaltitle.text().toString();
		item.ISSN = xml2..issn.text().toString();
		item.publisher = xml2..publisher..publishername.text().toString();
		item.title = xml3..titlegroup..articletitle.text().toString();
		for (var i = 0 ; i < xml3..contribgroup..contrib.length() ; i++) {
			var name = xml3..contribgroup..contrib[i]..name;
			item.creators.push({firstName:name..givennames.text().toString(), lastName:name..surname.text().toString(), creatorType:"author"});
		}
		
		var date = xml3..pubdate[0];
		var day = date..day.text().toString();
		var month = date..month.text().toString();
		var year = date..year.text().toString();
		
		date =  year;
		if (month != "00") {
			date = month + "/" + date;
		}
		if (day != "00") {
			date = day + "/" + date;
		}
		item.date = date;
		item.volume = xml3..volume.text().toString();
		item.pages = xml3..fpage.text().toString() + "-" + xml3..lpage.text().toString();
		
		for (var i = 0 ; i < xml3..kwdgroup..kwd.length() ; i++) {
			item.tags.push(xml3..kwdgroup..kwd[i].text().toString());
		}
		
		item.attachments = [
			{url:url, title:"SciELO Snapshot", mimeType:"text/html"}
		];

		item.complete();
	});
}