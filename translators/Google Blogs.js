{
	"translatorID": "58641ca2-d324-445b-a618-4e7c4631726f",
	"label": "Google Blogs",
	"creator": "Avram Lyon",
	"target": "^https?://www\\.google\\.[^/]+/.*[#&]tbm=blg",
	"minVersion": "2.1.8",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"lastUpdated": "2011-07-30 03:19:03"
}

/*
   Google Blogs Translator
   Copyright (C) 2011 Avram Lyon, ajlyon@gmail.com

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

function detectWeb(doc, url) {
	return "multiple";
}

function doWeb(doc, url) {
	if (ZU === undefined) {
		var ZU = {};
		ZU.xpath = function (node, xpath, ns) {
			var nodes = [];
			var i;
			var result = doc.evaluate(xpath, node, ns, XPathResult.ANY_TYPE, null);
			while (i = result.iterateNext()) nodes.push(i);
			if (nodes.length > 0) return nodes;
			return null;
		}
	}

	var list = ZU.xpath(doc, '//div[@id="search"]//ol[@id="rso"]/li/div[@class="vsc"]');
	var i, node;
	var items = [];
	var names = {};
	for (i in list) {
		items[i] = new Zotero.Item("blogPost");
		link = ZU.xpath(list[i], './span/h3/a')[0];
		names[i] = link.textContent;
		items[i].title = link.textContent;
		items[i].url = link.href;
		items[i].attachments.push({url:link.href,
					title:"Blog Snapshot",
					mimeType:"text/html"});
		items[i].blogTitle = ZU.xpath(list[i], './/cite/a')[0].textContent;
		node = ZU.xpath(list[i], './/div[@class="f kb"]')[0].textContent.match(/^(.*) by (.*)$/);
		if (node) {
			items[i].date = node[1];
			items[i].creators.push(Zotero.Utilities.cleanAuthor(node[2], "author"));
		}
	}

	Zotero.selectItems(names, function(names) {
		var j;
		for (j in names) {
			items[j].complete();
		}
	});
}
