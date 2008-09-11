{
	"translatorID":"e16095ae-986c-4117-9cb6-20f3b7a52f64",
	"translatorType":4,
	"label":"Protein Data Bank",
	"creator":"Michael Berkowitz",
	"target":"http://www.pdb.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-02-19 17:00:00"
}

function detectWeb(doc, url) {
	if (doc.title.indexOf("Query Results") != -1) {
		return "multiple";
	} else if (url.indexOf("structureId") != -1) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var proteins = new Array();
	if (detectWeb(doc, url) == "multiple") {
		//search results
		var items = new Object();
		var xpath = '//a[@class="qrb_title"]';
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_title;
		while (next_title = titles.iterateNext()) {
			items[next_title.href.match(/structureId=(.*)/)[1]] = next_title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			proteins.push(i);
		}
	} else {
		proteins = [url.match(/structureId=(.*)/)[1]];
	}
	
	Zotero.debug(proteins);
	for (var p in proteins) {
		var xmlstr = 'http://www.pdb.org/pdb/download/downloadFile.do?fileFormat=xml&headerOnly=YES&structureId=' + proteins[p];
		Zotero.debug(xmlstr);
		
		Zotero.Utilities.HTTP.doGet(xmlstr, function(text) {
			var item = new Zotero.Item("journalArticle");
			text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "").replace(/PDBx\:/g, "");
			var article = text.split('<citation id="primary">');
			var art = article[1].split(/<\/citation>\n/);
			art = "<citation>" + art[0] + "</citation>";
			var xml = new XML(art);
			var info = text.split('<database_PDB_revCategory>')[1].split('</database_PDB_revCategory>')[0];
			var xml2 = new XML("<PDB_revCategory>" + info + "</PDB_revCategory>");
			var aus = text.split('<citation_authorCategory>')[1].split('</citation_authorCategory>')[0];
			aus = "<authors>" + aus + "</authors>";
			var xml3 = new XML(aus);
			
			item.title = xml..title.text().toString();
			item.publicationTitle = xml..journal_abbrev.text().toString();
			item.volume = xml..journal_volume.text().toString();
			item.pages = xml..page_first.text().toString() + "-" + xml..page_last.text().toString();
			item.ISSN = xml..journal_id_ISSN.text().toString();
			item.extra = "PubMed ID: " + xml..pdbx_database_id_PubMed.text().toString();
			if (xml..pdbx_database_id_DOI.length()) {
				item.DOI = xml..pdbx_database_id_DOI.text().toString();
			}
			item.date = xml2..date_original.text().toString();
			item.url = 'http://www.pdb.org/pdb/explore/explore.do?structureId=' + xml2..replaces.text().toString();
			
			var authors = xml3..citation_author.toString().split(/\n/);
			for (var i in authors) {
				var name = authors[i].match(/name=\"([^"]+)\"/)[1].split(", ");;
				Zotero.debug(name);
				item.creators.push({firstName:name[1], lastName:name[0], creatorType:"author"});
			}
			item.attachments = [
				{url:item.url, title:"PDB Snapshot", mimeType:"text/html"},
				{url:'http://www.pdb.org/pdb/download/downloadFile.do?fileFormat=pdb&compression=NO&structureId=' + proteins[p], title:"Protein Data Bank .pdb File", mimeType:"chemical/x-pdb"}
			]
			item.complete();
		});
		Zotero.done;
	}
	Zotero.wait();
}