{
	"translatorID":"b6d0a7a-d076-48ae-b2f0-b6de28b194e",
	"translatorType":4,
	"label":"ScienceDirect",
	"creator":"Michael Berkowitz",
	"target":"https?://[^/]*science-?direct\\.com[^/]*/science(\\/article)?(\\?(?:.+\\&|)ob=(?:ArticleURL|ArticleListURL|PublicationURL))?",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":null,
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-05-31 23:36:07"
}

function detectWeb(doc, url) {
	if ((url.indexOf("_ob=DownloadURL") != -1) || doc.title == "ScienceDirect Login") {
		return false;
	}
	if((!url.match("pdf") && url.indexOf("_ob=ArticleURL") == -1 && url.indexOf("/article/") == -1) || url.indexOf("/journal/") != -1) {
		return "multiple";
	} else if (!url.match("pdf")) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	if (doc.evaluate('//*[contains(@src, "exportarticle_a.gif")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("SPEACIAL");
		var articles = new Array();
		if(detectWeb(doc, url) == "multiple") {
			//search page
			var items = new Object();
			var xpath;
			if (url.indexOf("_ob=PublicationURL") != -1) {
				// not sure if this case still arises. may need to be fixed at some point
				xpath = '//table[@class="txt"]/tbody/tr/td[2]';
			} else {
				xpath = '//div[@class="font3"][@id="bodyMainResults"]/table/tbody/tr/td[2]/a';
			}
			var rows = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var next_row;
			while (next_row = rows.iterateNext()) {
				var title = next_row.textContent;
				var link = next_row.href;
				if (!title.match(/PDF \(/) && !title.match(/Related Articles/)) items[link] = title;
			}
			items = Zotero.selectItems(items);
			for (var i in items) {
				articles.push(i);
			}
		} else {
			articles = [url];
		}
		Zotero.Utilities.processDocuments(articles, function(newDoc) {
			var doi = newDoc.evaluate('//div[@class="articleHeaderInner"][@id="articleHeader"]/a[contains(text(), "doi")]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.substr(4);
			
			var tempPDF = newDoc.evaluate('//a[@class="noul" and div/div[contains(text(), "PDF")]]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if (!tempPDF) { // PDF xpath failed, lets try another
				tempPDF = newDoc.evaluate('//a[@class="noul" and contains(text(), "PDF")]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if (!tempPDF) { // second PDF xpath failed set PDF to null to avoid item.attachments
					var PDF = null;
				} else {
					var PDF = tempPDF.href; // second xpath succeeded, use that link
				}
			} else {
				var PDF = tempPDF.href; // first xpath succeeded, use that link
			}
			
			var url = newDoc.location.href;
			var get = newDoc.evaluate('//a[img[contains(@src, "exportarticle_a.gif")]]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
			// if the PDF is available make it an attachment otherwise only use snapshot.
			if (PDF) {
				var attachments = [
					{url:url, title:"ScienceDirect Snapshot", mimeType:"text/html"},
					{url:PDF, title:"ScienceDirect Full Text PDF", mimeType:"application/pdf"} // Sometimes PDF is null...I hope that is ok
				];
			} else {
				var attachments = [
					{url:url, title:"ScienceDirect Snapshot", mimeType:"text/html"},
				];
			}
			Zotero.Utilities.HTTP.doGet(get, function(text) {
				var md5 = text.match(/<input type=hidden name=md5 value=([^>]+)>/)[1];
				var acct = text.match(/<input type=hidden name=_acct value=([^>]+)>/)[1];
				var userid = text.match(/<input type=hidden name=_userid value=([^>]+)>/)[1];
				var uoikey = text.match(/<input type=hidden name=_uoikey value=([^>]+)>/)[1];
				if (text.match(/<input type=hidden name=_ArticleListID value=([^>]+)>/)) {
					var alid = text.match(/<input type=hidden name=_ArticleListID value=([^>]+)>/)[1];
				}
				if (alid) {
					var docID = "_ArticleListID=" + alid + "&_uoikey=" + uoikey;
				} else {
					var docID = "_uoikey=" + uoikey;
				}
				var post = "_ob=DownloadURL&_method=finish&_acct=" + acct + "&_userid=" + userid + "&_docType=FLA&" + docID + "&md5=" + md5 + "&count=1&JAVASCRIPT_ON=Y&format=cite-abs&citation-type=RIS&Export=Export&x=26&y=17";
				var baseurl = url.match(/https?:\/\/[^/]+\//)[0];
				Zotero.Utilities.HTTP.doPost(baseurl + 'science', post, function(text) { 
					var translator = Zotero.loadTranslator("import");
					translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
					translator.setString(text);
					translator.setHandler("itemDone", function(obj, item) {
						item.attachments = attachments;
						
						if(item.notes[0]) {
							item.abstractNote = item.notes[0].note;
							item.notes = new Array();
						}
						if (doi) {
							item.DOI = doi;
						}
						item.complete();
					});
					translator.translate();
				}, false, 'windows-1252');
			});
		}, function() {Zotero.done();});
	} else {
		var articles = new Array();
		if (detectWeb(doc, url) == "multiple") {
			var items = new Object();
			if (url.indexOf("_ob=PublicationURL") != -1) {
				xpath = '//table[@class="txt"]/tbody/tr[1]/td[2]';
				// not sure whether this case still exists
			} else {
				xpath = '//div[@class="font3"][@id="bodyMainResults"]/table/tbody/tr/td[2]/a';
			}
			var rows = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var next_row;
			while (next_row = rows.iterateNext()) {
				var title = next_row.textContent;
				var link = next_row.href;
				items[link] = title;
			}
			items = Zotero.selectItems(items);
			for (var i in items) {
				articles.push(i);
			}
		} else {
			articles = [url];
		}
		Zotero.Utilities.processDocuments(articles, function(doc2) {
			var item = new Zotero.Item("journalArticle");
			item.repository = "ScienceDirect";
			item.url = doc2.location.href;
			var title = doc2.title.match(/^[^-]+\-([^:]+):(.*)$/);
			item.title = Zotero.Utilities.trimInternal(title[2]);
			item.publicationTitle = Zotero.Utilities.trimInternal(title[1]);
			voliss = doc2.evaluate('//div[@class="pageText"][@id="sdBody"]/table/tbody/tr/td[1]', doc2, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			if (voliss.match(/Volume\s+\d+/)) item.volume = voliss.match(/Volume\s+(\d+)/)[1];
			if (voliss.match(/Issues?\s+[^,]+/)) item.issue = voliss.match(/Issues?\s+([^,]+)/)[1];
			if (voliss.match(/(J|F|M|A|S|O|N|D)\w+\s+\d{4}/)) item.date = voliss.match(/(J|F|M|A|S|O|N|D)\w+\s+\d{4}/)[0];
			if (voliss.match(/Pages?\s+[^,^\s]+/)) item.pages = voliss.match(/Pages?\s+([^,^\s]+)/)[1];
			item.DOI = doc2.evaluate('//div[@class="articleHeaderInner"][@id="articleHeader"]/a[contains(text(), "doi")]', doc2, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.substr(4);
			var abspath = '//div[@class="articleHeaderInner"][@id="articleHeader"]/div[@class="articleText"]/p';
			var absx = doc2.evaluate(abspath, doc2, nsResolver, XPathResult.ANY_TYPE, null);
			var ab;
			item.abstractNote = ""
			while (ab = absx.iterateNext()) {
				item.abstractNote += Zotero.Utilities.trimInternal(ab.textContent) + " ";
			}
			if (item.abstractNote.substr(0, 7) == "Summary") {
				item.abstractNote = item.abstractNote.substr(9);
			}
			var tagpath = '//div[@class="articleText"]/p[strong[starts-with(text(), "Keywords:")]]';
			if (doc2.evaluate(tagpath, doc2, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				if (doc2.evaluate(tagpath, doc2, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(":")[1]) {
					var tags = doc2.evaluate(tagpath, doc2, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(":")[1].split(";");
					for (var i in tags) {
						item.tags.push(Zotero.Utilities.trimInternal(tags[i]));
					}
				}
			}
			item.attachments.push({url:doc2.location.href, title:"ScienceDirect Snapshot", mimeType:"text/html"});
			Zotero.Utilities.HTTP.doGet(item.url, function(text) {
				var aus = text.match(/<strong>\s+<p>.*<\/strong>/)[0].replace(/<sup>/g, "$").replace(/<\/sup>/g, "$");
				aus = aus.replace(/\$[^$]*\$/g, "");
				aus = aus.replace(/<a[^>]*>/g, "$").replace(/<\/a[^>]*>/g, "$");
				aus = aus.replace(/\$[^$]*\$/g, "");
				aus = Zotero.Utilities.cleanTags(aus);
				aus = aus.split(/(,|and)/);
				for (var a in aus) {
					if (aus[a] != "," && aus[a] != "and" && aus[a].match(/\w+/)) {
						item.creators.push(Zotero.Utilities.cleanAuthor(Zotero.Utilities.trimInternal(aus[a]), "author"));
					}
				}
				item.complete();
			});
		}, function() {Zotero.done();});
	}
	Zotero.wait();
}