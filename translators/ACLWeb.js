{
	"translatorID":"f4a5876a-3e53-40e2-9032-d99a30d7a6fc",
	"translatorType":4,
	"label":"ACL",
	"creator":"Nathan Schneider",
	"target":"^http://(www[.])?aclweb.org/anthology-new/[^#]+",
	"minVersion":"1.0.7",
	"maxVersion":"",
	"priority":100,
	"inRepository":false,
	"lastUpdated":"2008-12-06 10:21:05"
}

// based on ACM translator
function detectWeb(doc, url) {
  var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return prefix; else return null;
	} : namespace;
	
	var bibXpath = "//a[./text() = 'bib']"
	if(doc.evaluate(bibXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
	  return "multiple"
	}
  //commenting out single stuff
  // if (url.indexOf("/anthology-new/J/")>-1)
  //  return "journalArticle";
  // else
  //  return "conferencePaper";
}


function scrapeIndex(doc, items) {
	var results;
	var doImport;

	if (items != null) {	// Import user-selected item(s)
		results = items;
		doImport = true;
	}
	else {
		bibFileNodes = doc.evaluate('//a[substring(@href, string-length(@href)-3, 4) = ".bib"]', doc, null, XPathResult.ANY_TYPE, null);
		
		results = new Array();
		doImport = false;

		var bibFileNode = bibFileNodes.iterateNext();
		
		while (bibFileNode) {
			var bibFileName = bibFileNode.getAttribute("href");
			var bibFile = bibFileName.substring(0, bibFileName.length-4);

			var bNodes = doc.evaluate('//a[@href="' + bibFileName + '"]/following-sibling::b[position()=1]', doc, null, XPathResult.ANY_TYPE, null);	// These nodes contain author information
			
			// Extract authors' last names
			var authorLasts = new Array();
			
			var bNode = bNodes.iterateNext();
			var authorsS = bNode.innerHTML;	// may include markup: potentially <author>, <first>, <von>, and/or <last> tags
			authorsS = authorsS.replace(/[<][/]?author[>]/g, "");
			var authors = authorsS.split("; ");
			for (var a in authors) {
				var authorS = authors[a];
				var m = authorS.match(/[<]von[>]([^<]+)[<][/]von[>]/);
				var last = "";
				if (m!=null)	// we expect there is a <last> tag if there is a <von> tag
					last = m[1] + " ";
				m = authorS.match(/[<]last[>]([^<]+)[<][/]last[>]/);
				if (m!=null)
					last += m[1];
				else {
					var name = authorS.replace(/[<][^>]+[>]/g, "");	// remove all markup
					if (name=="Entire volume")
						last = name;
					else {
						var parts = name.split(" ");
						last = parts[parts.length-1];
						if (parts.length>1) {
							var penultInitial = parts[parts.length-2].substr(0,1);
							if (penultInitial.toUpperCase()!=penultInitial)	// e.g. van Dyke
								last = name[parts.length-2] + " " + last;
						}
					}
				}
				authorLasts.push(last);
			}

			// Prepare result for this item, which consists of the relative path to the .bib file (minus the extension)
			// followed by a space and the authors' last names (abbreviated format)
			var result = bibFile + " ";
			
			if (authorLasts.length<3)
				result += authorLasts.join(" & ");
			else
				result += authorLasts[0] + "+";

			results.push(result);
			bibFileNode = bibFileNodes.iterateNext();
		}
	}


	if (!doImport)
		return results;

	for (var i in results) {
		var ii = results[i].indexOf(" ");
		var fileRelPath = results[i].substring(0, ii);
		var authorsShort = results[i].substring(ii+1);
		var fileName = fileRelPath.substring(fileRelPath.lastIndexOf("/")+1);
		var bibFile = fileRelPath + ".bib";
	
		var pageurl = doc.location.href;
		var lastSlash = pageurl.lastIndexOf("/");
		var dirInUrl = pageurl.substring(0, lastSlash+1);
		var fileInUrl = pageurl.substring(lastSlash+1, pageurl.indexOf("#", lastSlash));
		var bib = dirInUrl + fileRelPath + ".bib";
		var pdf = dirInUrl + fileRelPath + ".pdf";
		var j = fileRelPath.lastIndexOf("-");
		var yearShort = fileRelPath.substring(j-2, j);
		var year = "";
		if (new Number(yearShort) < 50)
			year = "20" + yearShort;
		else
			year = "19" + yearShort;

		var attachments = new Array();
		attachments.push({title:authorsShort + " " + year + ".pdf", mimeType:"application/pdf", url:pdf});

		var type = "";	
		if (pageurl.indexOf("/anthology-new/J/")>-1)
			type = "journalArticle";
		else
			type = "conferencePaper";
		
		if (doImport)
			callTranslator(bib, type, attachments);
	
	}
}

function callTranslator(bibFileURL, type, attachments) {
	Zotero.Utilities.HTTP.doGet(bibFileURL, function(text) {
		
		// load BibTex translator
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("9cb70025-a888-4a29-a210-93ec52da40d4");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			item.itemType = type;
			item.attachments = attachments;
			item.repository = "Association for Computational Linguistics"
			item.complete();
		});
		translator.translate();
		
	});
}

function doWeb(doc, url) {
	var searchResult = true;
	if(searchResult) {
		var possibleItems = scrapeIndex(doc, null);	// items to present to user
		
		items = Zotero.selectItems(possibleItems);	// items selected by the user
		if(!items) return true;
		
		scrapeIndex(doc, items);
		
	} else {
	  //not implemented yet
		scrape(doc);
	}
	
	Zotero.wait();
}
