{
	"translatorID":"b56f856e-934e-4b46-bc58-d61dccc9f32f",
	"translatorType":4,
	"label":"Mainichi Daily News",
	"creator":"Frank Bennett",
	"target":"^http://(?:search\\.)*mdn\\.mainichi\\.jp/(?:$|result\?|mdnnews/|perspectives/|features/|arts/|travel/)",
	"minVersion":"2.0b7",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-23 02:17:09"
}

// #################################
// #### Local utility functions ####
// #################################

var itemRe = new RegExp('.*/([0-9]{8})[a-z]{1}[0-9]{1}[a-z]{1}[0-9]{2}[a-z]{1}[0-9]{1}[a-z]{2}[0-9]{6}c\.html');

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

var cleanUp = function (str) {
	var ret;
	ret = str.replace("\u00a0", " ", "g").replace("\n", " ", "g");
	ret = ret.replace(/^\s+/, "").replace(/\s+$/, "").replace(/\s+/g, " ");
	ret = ret.replace(/\|.*/, "").replace(/<[^>]+>/g, "");;
	ret = Zotero.Utilities.unescapeHTML(ret);
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
	var type, nsResolver, availableItems, xpath, found, nodes, headline, pos, myurl, m, items, title;
	nsResolver = getResolver(doc);
	type = detectWeb(doc, url);
	if (type === "multiple") {
		availableItems = {};
		if (url.match(/^http:\/\/search\.mdn\.mainichi\.jp\/result\?/)){
			xpath = '//div[@class="ResultTitle"]/a[contains(@href, "mdn.mainichi.jp")]';
		} else {
			xpath = '//h2[@class="NewsTitle"]/a[@href]|//ul[@class="Mark"]/li/a[@href]';
		}
		nodes = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		found = nodes.iterateNext();
		while (found) {
			if (!itemRe.test(found.href)) {
				found = nodes.iterateNext();
				continue;
			}
			headline = found.textContent;
			headline = cleanUp(headline);
			availableItems[found.href] = headline;
			found = nodes.iterateNext();
		}
		if (availableItems.__count__) {
			items = Zotero.selectItems(availableItems);
			for (myurl in items) {
				if (items.hasOwnProperty(myurl)) {
					scrapeAndParse(myurl, availableItems[myurl]);
				}
			}
		}
	} else if (type === "newspaperArticle") {
		xpath = '//h2[@class="NewsTitle"]';
		nodes = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		title = nodes.iterateNext();
		if (title) {
			title = cleanUp(title.textContent);
			scrapeAndParse(url, title);
		}
	}
};

// ############################
// ##### Scraper function #####
// ############################

var scrapeAndParse = function (url, title) {
	var item, mytxt, m, val;
	item = new Zotero.Item("newspaperArticle");
	item.title = title;
	item.publicationTitle = "Mainichi Daily News";
	item.edition = "online edition";
	item.url = url;
	m = itemRe.exec(url);
	if (m) {
		var year = m[1].slice(0,4);
		var month = m[1].slice(4,6);
		var day = m[1].slice(6,8);
		item.date = [year, month, day].join("-");
	}
	item.attachments.push({title:"Mainichi Daily News snapshot", mimeType:"text/html", url:url});
	item.complete();
};
