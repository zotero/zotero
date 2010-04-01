{
	"translatorID":"b56d756e-934e-4b46-bc58-d61dccc9f32f",
	"translatorType":4,
	"label":"Japan Times Online",
	"creator":"Frank Bennett",
	"target":"^http://(?:www|search)\\.japantimes\\.co\\.jp/(?:cgi-bin|gsearch|features|entertainment|sports|life|news)",
	"minVersion":"2.0b7",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-23 02:17:09"
}

// #################################
// #### Local utility functions ####
// #################################

var itemRe = new RegExp('^http://search\.japantimes\.co\.jp/cgi-bin/[a-z]{2}[0-9]{8}[a-z0-9]{2}\.html');

var getResolver = function (doc) {
	var namespace, resolver;
	namespace = doc.documentElement.namespaceURI;
	if (namespace) {
		resolver = function(prefix) {
			if (prefix == 'x') {
				return namespace;
			} else {
				return null;
			}
		};
	} else {
		resolver = null;
	}
	return resolver;
};

var getTagContent = function (txt, attribute, value) {
	var ret, m, rex;
	ret = false;
	rex = RegExp("<[^>]*" + attribute + "=\"" + value + "\"[^>]*>([^<]*)<");
	m = rex.exec(txt);
	if (m) {
		ret = m[1];
	}
	return ret;
}

var getTagsWithAttributeAndContent = function (txt, tag, attribute) {
	var ret, pos, len, lst, m, tagsrex, attribrex;
	ret = {};
	tagsrex = RegExp("(<" + tag + "(?: [^>]*>|>)|</" + tag+ ">)");
	attribrex = RegExp(' ' + attribute + '="([^"]+)"');
	lst = txt.split(tagsrex);
	if (lst.length > 1) {
		len = lst.length;
		for (pos=1; pos < len; pos += 4) {
			if (pos < (len - 2) &&  lst[pos + 2] == ("</" + tag + ">")) {
				m = lst[pos].match(attribrex);
				if (m) {
					if (!itemRe.exec(m[1])) {
						continue;
					}
					var title = lst[pos + 1];
					title = title.replace(/\|.*/, "").replace(/<[^>]+>/g, "");;
					ret[m[1]] = Zotero.Utilities.unescapeHTML(title);
				}
			}
		}
	}
	return ret;
}

// #########################
// ##### API functions #####
// #########################

var detectWeb = function (doc, url) {
	if (itemRe.test(doc.location.href)) {
		return "newspaperArticle";
	} else {
		return "multiple";
	}
}

var doWeb = function (doc, url) {
	var type, nsResolver, availableItems, xpath, found, nodes, headline, pos, myurl, m, items;
	nsResolver = getResolver(doc);
	type = detectWeb(doc, url);
	if (type === "multiple") {
		availableItems = {};
		if (url.match(/\/gsearch\//)) {
			//
			// For Google SafeSearch.  Thanks, guys, it was an entertaining afternoon.
			//
			xpath = '//iframe[@name="googleSearchFrame"]';
			var iframe = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			var address = iframe.src;
			var page = Zotero.Utilities.retrieveSource(address);
			availableItems = getTagsWithAttributeAndContent(page, "a", "href");
		} else {
			xpath = '//a[contains(@href, "cgi-bin")]';
			nodes = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			found = nodes.iterateNext();
			while (found) {
				if (!itemRe.test(found)) {
					found = nodes.iterateNext();
					continue;
				}
				headline = found.text;
				//
				// Some headlines have a weird structure that yields two
				// entries, the second of which is blank.  Nothing is lost
				// by this construct.
				//
				if (!headline.replace("\n", "")) {
					found = nodes.iterateNext();
					continue;
				}
				headline = headline.replace("\u00a0", " ", "g").replace("\n", " ", "g");
				headline = headline.replace(/^\s+/, "").replace(/\s+$/, "").replace(/\s+/g, " ");
				availableItems[found.href] = headline;
				found = nodes.iterateNext();
			}
		}
		if (availableItems.__count__) {
			items = Zotero.selectItems(availableItems);
			for (myurl in items) {
				if (items.hasOwnProperty(myurl)) {
					scrapeAndParse(myurl);
				}
			}
		}
	} else if (type === "newspaperArticle") {
		scrapeAndParse(url);
	}
};

// ############################
// ##### Scraper function #####
// ############################

var scrapeAndParse = function (url) {
	var item, mytxt, m, val;
	item = new Zotero.Item("newspaperArticle");

	mytxt = Zotero.Utilities.retrieveSource(url);

	item.publicationTitle = "Japan Times Online";
	item.url = url;
	val = getTagContent(mytxt, "id", "date");
	if (val) {
		item.date = val;
	}
	val = getTagContent(mytxt, "id", "headline");
	if (val) {
		item.title = val;
	}
	item.attachments.push({title:"Japan Times Online snapshot", mimeType:"text/html", url:url});
	item.complete();
};
