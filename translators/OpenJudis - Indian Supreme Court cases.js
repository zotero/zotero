{
	"translatorID":"fe39e97d-7397-4f3f-a5f3-396a1a79213c",
	"translatorType":4,
	"label":"OpenJudis - Indian Supreme Court cases",
	"creator":"Prashant Iyengar and Michael Berkowitz",
	"target":"http://(www.)?openarchive.in/(judis|newcases)",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-08 20:30:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//div[@id="footer"]/dl/dt/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.match(/\d+\.htm/)) {
		return "case";
	}
}

function regexMeta(stuff, item) {	
        if (stuff) {
                if (stuff[0] == "Origlink") {
			item.source = stuff[1].split(/\s+/)[0];
	        }
		if (stuff[0] == "Acts") {
			if (stuff[1].indexOf("|")!=-0) {
				echts=stuff[1].split(" | ");
				for (i=0;i<echts.length;i++) {
					item.tags.push(echts[i]);
				}
	        	} else {
	        		item.tags.push(stuff[1]);
	        	}
	        }
		if (stuff[0] == "Citations" && stuff[1].length > 1) {
			item.reporter=stuff[1];
		}
		if (stuff[0] == "Judges") {
			if (stuff[1].indexOf(";")!=-0) {
				jedges=stuff[1].split(" ; ");
				for (i=0;i<jedges.length;i++) {
	       				item.creators.push(Zotero.Utilities.cleanAuthor(jedges[i], "author"));
	        		}
	        	} else {
	        		item.creators.push(Zotero.Utilities.cleanAuthor(stuff[1], "author"));
	        	}
		}
	        if (stuff[0] == "Jday") {
	       		item.dateDecided= stuff[1];
		}
	}
}



function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = Zotero.Utilities.getItemArray(doc, doc, "^http:\/\/openarchive\.in\/[^/]+\/[0-9]+.htm$");
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else { arts = [url]; }
	Zotero.debug(arts);
	for each (var art in arts) {
		var newurl = art;
		Zotero.Utilities.HTTP.doGet(art, function(text) {
			var newItem = new Zotero.Item("case");
			newItem.publicationTitle = "OpenJudis - http://judis.openarchive.in";
			newItem.url = url;
			
			//title
			var t = /\<title\>([\w\W]*?)<\/title/;
			newItem.title = Zotero.Utilities.trimInternal(t.exec(text)[1]);
			newItem.caseName = newItem.title;
			newItem.url = newurl;
			newItem.court="The Supreme Court of India";
	
			newItem.websiteTitle="OpenJudis - http://judis.openarchive.in";
			newItem.edition="Online";
			
			var metareg = /<META NAME[^>]+\>/g;
			var tags = text.match(metareg);
			for each (var tag in tags) {
				var stuff = tag.match(/NAME=\"([^"]+)\"\s+CONTENT=\"([^"]+)\"/);
				regexMeta([stuff[1], stuff[2]], newItem);
			}
			pdfurl = 'http://judis.openarchive.in/makepdf.php?filename=' + newItem.url;
			newItem.attachments = [
				{url:newItem.url, title:"OpenJudis Snapshot", mimeType:"text/html"},
				{url:pdfurl, title:"OpenJudis PDF", mimeType:"application/pdf"}
			];
			newItem.complete();
		}, function() {Zotero.done;});
		Zotero.wait();
	}
}
