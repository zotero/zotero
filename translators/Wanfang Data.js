{
        "translatorID":"eb876bd2-644c-458e-8d05-bf54b10176f3",
        "label":"Wanfang Data",
        "creator":"Ace Strong <acestrong@gmail.com>",
        "target":"^https?://[ds]\\.(?:g\\.)?wanfangdata\\.com\\.cn",
        "minVersion":"2.0rc1",
        "maxVersion":"",
        "priority":100,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2010-10-12 15:45:49"
}

/*
   Wanfang Data Translator
   Copyright (C) 2010 TAO Cheng, acestrong@gmail.com

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

// #######################
// ##### Sample URLs #####
// #######################

/*
 * The starting point for an search is the URL below.
 * In testing, I tried the following:
 *
 *   - A search listing of journals
 *   - A search listing of thesis
 *   - A search listing of conference papers
 *   - A search listing of foreign literatures(for chinese)
 *   - A journal paper page
 *   - A thesis page
 *   - A conference paper page
 *   - A foreign literature page
 */
// http://g.wanfangdata.com.cn/Default.aspx


// #################################
// #### Local utility functions ####
// #################################

function detectCode(url) {
	var pattern = /[ds]\.(?:g\.)?wanfangdata\.com\.cn\/([A-Za-z]*?)_/;
	if (pattern.test(url)) {
		var code = pattern.exec(url)[1];
		return code;
	}
	return null;
}

function detectType(code) {
	if (code == "Periodical") {
		return "journalArticle";
	} else if (code == "Thesis") {
		return "thesis";
	} else if (code == "Conference") {
		return "conferencePaper";
	} else if (code == "NSTLHY") {
		return "conferencePaper";
	} else if (code == "NSTLQK") {
		return "journalArticle";
	} else {
		return false;
	}
}

function getResolver(doc) {
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
}

// #############################
// ##### Scraper functions #####
// #############################

function scrape(url) {

	Zotero.Utilities.HTTP.doGet(url, function(page) {
		var pattern = /href=["'](.*?)["'] class="export"/;
		var newurl = pattern.exec(page)[1];
	
		Zotero.Utilities.HTTP.doGet(newurl, function(page) {
			// scrape from xml data of export page
			var pattern;
			
			pattern = /var text='(.*?)';/;
			if (pattern.test(page)) {
				var xml = pattern.exec(page)[1].replace(/(\\r\\n)/g, "\n");
//				Zotero.debug(xml);
	
				var newItem = new Zotero.Item();
	
				// 类型
				pattern = /<ResourceCategory>(.*?)<\/ResourceCategory>/;
				var category = pattern.exec(xml)[1];
				var type = detectType(category);
				
//				Zotero.debug(type);
				newItem.itemType = type;
				newItem.url = url;
				
				// 标题
				pattern = /<Titles>[\s\S]*?<Text>(.*?)<\/Text>[\s\S]*?(?:<Text>(.*?)<\/Text>[\s\S]*?)?<\/Titles>/;
				var titles = pattern.exec(xml);
		
				newItem.title = titles[1];
				if (titles[2]) {
					newItem.shortTitle = titles[2];
				}
				
				// 作者
				pattern = /<Creator>\s*<Name>(.*?)<\/Name>/g;
				var author = pattern.exec(xml)[1];
				while (author) {
//					Zotero.debug(author);
		
					var patt = /[a-zA-Z]/;
					var useComma = true;
					if (patt.test(author)) {
						patt = /,/;
						if (!patt.test(author)) {
							useComma = false;
						}
					}
					newItem.creators.push(
						Zotero.Utilities.cleanAuthor(
							author,
							"author",
							useComma));
		
					var res = pattern.exec(xml);
					if (res) {
						author = res[1];
					} else {
						author = null;
					}
				}
				
				// 引用页/页数
				pattern = /<Page>([0-9,-]*?)[^0-9,-]*?<\/Page>/;
				if (pattern.test(xml)) {
					var pages = pattern.exec(xml)[1];
//					Zotero.debug(pages);
					pattern = /-/;
					if (pattern.test(pages)) {
						newItem.pages = pages;
					} else {
						newItem.numPages = pages;
					}
				}
				
				// 页数
				pattern = /<PageCount>([0-9]*)<\/PageCount>/;
				if (pattern.test(xml)) {
					var pages = pattern.exec(xml)[1];
//					Zotero.debug(pages);
					newItem.numPages = pages;			
				}
				
				// 发表时间
				pattern = /<PublishDate>(.*?)<\/PublishDate>/;
				if (pattern.test(xml)) {
					newItem.date = pattern.exec(xml)[1];
				}
				
				// 关键词
				pattern = /<Keyword>(.*?)<\/Keyword>/g;
				var res = pattern.exec(xml);
				while (res) {
					newItem.tags.push(res[1]);
					res = pattern.exec(xml);
				}
				
				// 摘要
				pattern = /<Abstract>\s*?<Text>([\s\S]*?)<\/Text>/;
				if (pattern.test(xml)) {
					newItem.abstractNote = pattern.exec(xml)[1];
				}
				
				// 硕士/博士
				pattern = /<Degree>(.*?)<\/Degree>/;
				if (pattern.test(xml)) {
					newItem.thesisType = pattern.exec(xml)[1];
				}
				
				// 导师
				pattern = /<Tutor>(.*?)<\/Tutor>/g;
				var res = pattern.exec(xml);
				while (res) {
					var tutor = res[1];
					newItem.creators.push(
						Zotero.Utilities.cleanAuthor(
							tutor, 
							"director",
							true));
					res = pattern.exec(xml);
				}
				
				// 毕业学校
				pattern = /<School>(.*?)<\/School>/;
				if (pattern.test(xml)) {
					newItem.publisher = pattern.exec(xml)[1];
				}
				
				// 期刊名
				pattern = /<Periodical>[\s\S]*?<Name>(.*?)<\/Name>\s*?<NameEn>(.*?)<\/NameEn>/;
				if (pattern.test(xml)) {
					var res = pattern.exec(xml);
					newItem.publicationTitle = res[1];
					newItem.journalAbbreviation = res[2];
				}
				
				// 卷
				pattern = /<Volum>([0-9]*?)<\/Volum>/;
				if (pattern.test(xml)) {
					newItem.volume = pattern.exec(xml)[1];
				}
				
				// 期
				pattern = /<Issue>([0-9]*?)<\/Issue>/;
				if (pattern.test(xml)) {
					newItem.issue = pattern.exec(xml)[1];
				}
				
				// 系列
				pattern = /<Column>(.*?)<\/Column>/;
				if (pattern.test(xml)) {
					newItem.series = pattern.exec(xml)[1];
				}
				
				// 会议名称
				pattern = /<Conference>[\s\S]*?<Name>(.*?)<\/Name>/;
				if (pattern.test(xml)) {
					newItem.conferenceName = pattern.exec(xml)[1];
				}
				
				// 会议地点
				pattern = /<Conference>[\s\S]*?<Locus>(.*?)<\/Locus>/;
				if (pattern.test(xml)) {
					newItem.place = pattern.exec(xml)[1];
				}
				
				// 会议论文集
				pattern = /<Source>(.*?)<\/Source>/;
				if (pattern.test(xml)) {
					newItem.proceedingsTitle = pattern.exec(xml)[1];
				}
				
				// ISSN
				pattern = /<ISSN>(.*?)<\/ISSN>/;
				if (pattern.test(xml)) {
					newItem.ISSN = pattern.exec(xml)[1];
				}
				
				// 语言
				pattern = /<Language>([a-zA-Z]*?)<\/Language>/;
				if (pattern.test(xml)) {
					newItem.language = Zotero.Utilities.trim(
						pattern.exec(xml)[1]);
				}
				
				newItem.complete();	
			}
		});
	});
}

// #########################
// ##### API functions #####
// #########################

function detectWeb(doc, url) {
	var pattern = /paper\.aspx/i;
	if (pattern.test(url)) {
		return "multiple"
	}
	
	pattern = /[ds]\.(?:g\.)?wanfangdata\.com\.cn/;
	if (pattern.test(url)) {
		var code = detectCode(url);
//		Zotero.debug(code);
		return detectType(code);
	}

	return false;
}

function doWeb(doc, url) {
	var nsResolver = getResolver(doc);
	var urls, lis;

	Zotero.debug(url);

	if (detectWeb(doc, url) == "multiple") {
//		Zotero.debug("Enter multiple.");
		// search page
		var items = new Array();

		var xpath = '//li[@class="title_li"]';
		lis = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);

		var li = lis.iterateNext();
		var link;
		var title;
		while (li) {
			var a = li.getElementsByTagName("a")[0];
			title = Zotero.Utilities.cleanTags(a.textContent);
			link = a.getAttribute("href");
			if (link) {
				items[link] = Zotero.Utilities.trimInternal(title);
//				Zotero.debug("title:"+title);
//				Zotero.debug("link:"+link);
			}
			li = lis.iterateNext();
		}
//		Zotero.debug(items);
		if (items.__count__) {
			// 让用户选择要保存哪些文献
			items = Zotero.selectItems(items);
			if (!items) return true;

			urls = new Array();
			for (var url in items) {
				urls.push(url);
			}
		}
	} else {
		urls = [url];
	}
	
	if (urls) {
//		Zotero.debug(urls);

		for (var i=0; i<urls.length; i++) {
			scrape(urls[i]);
		}
	}
}
