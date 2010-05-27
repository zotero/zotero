{
	"translatorID":"1e6d1529-246f-4429-84e2-1f1b180b250d",
	"translatorType":4,
	"label":"The Chronicle of Higher Education",
	"creator":"Simon Kornblith, Avram Lyon",
	"target":"^http://chronicle\\.com/",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2010-05-27 17:30:00"
}

/*
 This translator works on articles posted in The Chronicle of Higher Education.

 It is based on the earlier translator by Simon Kornblith, but the Chronicle has
 significantly restructured the site since 2006, breaking the old translator.

 As of early April 2010, this translator works on all tested pages.
*/

/* Test URLs:
Basic article:
	http://chronicle.com/article/A-Little-Advice-From-32000/46210/
	Fagen, Adam, and Kimberly Suedkamp Wells. “A Little Advice From 32,000 Graduate Students.” The Chronicle of Higher Education, January 14, 2002, sec. Advice. http://chronicle.com/article/A-Little-Advice-From-32000/46210/.

Older Article, with metadata at bottom:
	http://chronicle.com/article/Grinnells-Green-Secrets/2653/
	Yuan, Xiao-Bo. “Grinnell's Green Secrets.” The Chronicle of Higher Education, June 16, 2006, Volume 52, Issue 41  edition, sec. News : Short Subjects.

Blog Post:
	http://chronicle.com/blogPost/humanities-cyberinfrastructure-project-bamboo/6138
	Katz, Stan. “Humanities Cyberinfrastructure: Project Bamboo.” The Chronicle of Higher Education. Brainstorm, July 17, 2008. http://chronicle.com/blogPost/humanities-cyberinfrastructure-project-bamboo/6138.
*/

function detectWeb(doc, url) {
	/* The /daily/ and /weekly/ sections are leftover from the previous version
	   of the translator; they don't appear to still be on the Chronicle site, but
	   they might persist in older URLs. */
	var articleRegexp = /^http:\/\/chronicle\.com\/(daily|weekly|article|blogPost)\/[^/]+\// ;
	if(articleRegexp.test(url)) {
		var section = url.match(articleRegexp);
		switch (section[1]) {
			case "weekly":
			case "daily":
			case "article":
				return "newspaperArticle";
			case "blogPost":
				return "blogPost";
			default:
				return false;
		}
	} else {
		// This approach, used again below, is pretty crude.
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			if(articleRegexp.test(aTags[i].href)) {
				return "multiple";
			}
		}
	}
}

function doWeb (doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = {};
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			var articleRegexp = /^http:\/\/chronicle\.com\/(daily|weekly|article|blogPost)\/[^/]+\//;
			if(articleRegexp.test(aTags[i].href)) {
				items[aTags[i].href] = aTags[i].textContent;
			}
		}
		items = Zotero.selectItems(items);
		if(!items) return true;
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	
	Zotero.Utilities.processDocuments(articles, function(doc) {
		var type = detectWeb(doc, doc.location.href);
		item = new Zotero.Item(type);

		item.url = doc.location.href;
		item.publicationTitle = "The Chronicle of Higher Education";
		// Does the ISSN apply to online-only blog posts?
		item.ISSN = "0009-5982";
		
		var byline = doc.evaluate('//p[@class="byline"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext();
		if (byline !== null) {
			var authors = parseAuthors(byline.textContent);
			for (var i = 0; i < authors.length; i++) {
				item.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));
			}
		}
		
		// Behavior for some items is different:
		if(type === "blogPost") {
			var dateline = doc.evaluate('//p[@class="time"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext();
			if (dateline !== null) {
				item.date = dateline.textContent;
			}
			item.title = doc.evaluate('//div[@class="blog-mod"]/h1[@class="title"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;

			// We keep the Chronicle as the Website Type, for lack of a better place
			item.websiteType = item.publicationTitle;
			item.publicationTitle = doc.evaluate('//div[@class="header-breadcrumb-wrap"]/h1', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		} else {
			var dateline = doc.evaluate('//p[@class="dateline"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext();
			if (dateline !== null) {
				item.date = dateline.textContent;
			}
			item.title = Zotero.Utilities.trimInternal(doc.evaluate('//div[@class="article"]/h1', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			item.section = Zotero.Utilities.trimInternal(doc.evaluate('//div[@class="header-breadcrumb-wrap"]/h1', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			
			// Some items have publication details at the end of the article; one
			// example is: http://chronicle.com/article/Grinnells-Green-Secrets/2653/
			var articleParagraphs = doc.evaluate('//div[@class="article-body"]/p', doc, ns, XPathResult.ANY_TYPE, null);
			var par;
			while ((par = articleParagraphs.iterateNext()) !== null) {
				var data = par.textContent.match(/Section: ([a-zA-Z -&]+)[\n\t ]+Volume ([0-9]+), Issue ([0-9]+), Page ([0-9A-Za-z]+)/);
				if (data !== null && data.length > 0) {
					item.pages = data[4];
					// If the section here and in the page proper are different, concatenate
					if (item.section !== data[1])
						item.section = item.section + " : " + Zotero.Utilities.trimInternal(data[1]);
					// Since newspaperArticle doesn't have Volume / Issue, put as Edition
					item.edition = "Volume " + data[2] + ", Issue " + data[3];
				}
			}
		}
		
		item.attachments.push({url:doc.location.href, title: ("Chronicle of Higher Education Snapshot"), mimeType:"text/html"});
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}

function parseAuthors(author) {
		// Sometimes we have "By Author and Author"
		if(author.substr(0, 3).toLowerCase() == "by ") {
			author = author.substr(3);
		}
		
		// Sometimes the author is in all caps
		var pieces = author.split(" ");
		for (var i = 0; i < pieces.length; i++) {
			// TODO Make the all-caps character class more inclusive
			if (pieces[i].match(/[A-Z-]+/) !== null)
				pieces[i] = Zotero.Utilities.capitalizeTitle(pieces[i].toLowerCase(), true);
		}
		author = pieces.join(" ");
		
		// Somtimes we have multiple authors
		var authors = author.split(" and ");
		return authors;
}
