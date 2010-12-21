{
        "translatorID":"5c95b67b-41c5-4f55-b71a-48d5d7183063",
        "label":"CNKI",
        "creator":"Ace Strong <acestrong@gmail.com> and Heromyth <zxpmyth@yahoo.com.cn>",
        "target":"^https?://(?:(?:(dlib|epub|acad|apj1|law1|www)\\.cnki\\.net)|(?:[0-9\\.]+))/(?:grid2008|kns50|Kns55|kcms)",
        "minVersion":"2.0rc1",
        "maxVersion":"",
        "priority":100,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2010-12-10 14:32:46"
}

/*
   CNKI(China National Knowledge Infrastructure) Translator
   Copyright (C) 2009-2010 TAO Cheng, acestrong@gmail.com

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
 *   - A search listing of phd thesis
 *   - A search listing of master thesis
 *   - A search listing of conference papers
 *   - A search listing of newspaper articles
 *   - A journal paper page
 *   - A phd thesis page
 *   - A master thesis page
 *   - A conference paper page
 *   - A newspaper article page
 */
// http://epub.cnki.net/grid2008/index/ZKCALD.htm


// #################################
// #### Local utility functions ####
// #################################

function detectCode(url) {
	var pattern = /(?:dbcode|dbname)=([A-Za-z]{4})/i;
	if (pattern.test(url)) {
		var code = pattern.exec(url)[1];
		return code;
	} else {
		// parse from source page
		var page = Zotero.Utilities.retrieveSource(url);
		pattern = /id="nowdbname"[^>]*?>(.*?)<\/SPAN>/i;
		if (pattern.test(page)) {
			var dbname = pattern.exec(page)[1];
//			Zotero.debug(dbname);
			if (dbname == "中国期刊全文数据库") {
				return "CJFD";
			}
		}
	}
	return "NONE";
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

function trimTags(text) {
	var pattern = /(<.*?>)/g;
	text = text.replace(pattern, "");
	return text;
}

function trimMultiline(text) {
	var pattern = /(\s{2,})/g;
	text = text.replace(pattern, "\n");
	return text;
}

// #############################
// ##### Scraper functions #####
// #############################

// work for journalArticle
function scrapeAndParse1(url) {
//	Zotero.debug("journalArticle");
	Zotero.Utilities.doGet(url, function(page) {
		var pattern;
	
		// 类型 & URL
		var itemType = "journalArticle";
		var newItem = new Zotero.Item(itemType);
//		Zotero.debug(url);
		newItem.url = url;
	
		// 标题/Title
		pattern = /<span (?:id="chTitle"|class='datatitle')>(.*?)<\/span>/;
		if (pattern.test(page)) {
			var title = trimTags(pattern.exec(page)[1]);
			newItem.title = title;
//			Zotero.debug("title: "+title);
		}
		
		// 作者/Authors
		var authorNames;
		pattern = /【作者】(?:[\s\S]*?)GetLinkListEx\('(.*?);','/;
		if (pattern.test(page)) {
			authorNames = pattern.exec(page)[1].split(";");
		} else {
			pattern = /【作者】([\s\S]*?)<\/tr>/;
			if (pattern.test(page)) {
				authorNames = trimTags(pattern.exec(page)[1]).split(";");
			}
		}
		if (authorNames) {
			for (var i=0; i<authorNames.length; i++) {
				var authorName = Zotero.Utilities.trim(authorNames[i]);
				if (authorName.length > 0) {
					newItem.creators.push(
						Zotero.Utilities.cleanAuthor(authorNames[i], 
						"author", true));
				}
			}
//			Zotero.debug("authorNames:\n"+authorNames);
		}
		
		// 摘要/Abstract
		var abst;
		pattern = /【摘要】\s*<[^>]*>(.*?)<\/span>/;
		if (pattern.test(page)) {
			abst = trimTags(pattern.exec(page)[1]);
		} else {
			pattern = /【摘要】([\s\S]*?)<\/tr>/;
			if (pattern.test(page)) {
				abst = trimTags(pattern.exec(page)[1]);
			}
		}
		if (abst) {
//			Zotero.debug("abstract:\n"+abst);
			newItem.abstractNote = Zotero.Utilities.trim(abst);
		}
		
		pattern = /【Abstract】\s*<[^>]*>(.*?)<\/span>/;
		if (pattern.test(page)) {
			abst = trimTags(pattern.exec(page)[1]);
		} else {
			pattern = /【英文摘要】([\s\S]*?)<\/tr>/;
			if (pattern.test(page)) {
				abst = trimTags(pattern.exec(page)[1]);
			}
		}
		if (abst) {
//			Zotero.debug("abstract:\n"+abst);
			if (newItem.abstractNote===undefined) {
				newItem.abstractNote = Zotero.Utilities.trim(abst);
			} else {
				newItem.abstractNote = newItem.abstractNote + "\n" 
					+ Zotero.Utilities.trim(abst);
			}
		}
//		Zotero.debug(newItem.abstractNote);
		
		// 关键词/Keywords
		var tags;
		pattern = /【关键词】(?:[\s\S]*?)KeywordFilter\('(.*?)'\),'kw'/;
		if (pattern.test(page)) {
			tags = pattern.exec(page)[1].split(";");
		} else {
			pattern = /【(?:中文)?关键词】([\s\S]*?)<\/tr>/;
			if (pattern.test(page)) {
				tags = trimTags(pattern.exec(page)[1]).split(";");
			}
		}
		if (tags) {
			for (var i=0; i<tags.length; i++) {
				var tag = Zotero.Utilities.trim(tags[i]);
				if (tag.length>0 && newItem.tags.indexOf(tag)<0) {
					newItem.tags.push(tag);
				}
			}
//			Zotero.debug("tags:\n"+tags);
		}
		pattern = /【Key words】(?:[\s\S]*?)GetLinkList\('(.*?)','kw'/;
		if (pattern.test(page)) {
			tags = pattern.exec(page)[1].split(";");
		} else {
			pattern = /【英文关键词】([\s\S]*?)<\/tr>/;
			if (pattern.test(page)) {
				tags = trimTags(pattern.exec(page)[1]).split(";");
			}
		}
		if (tags) {
			for (var i=0; i<tags.length; i++) {
				var tag = Zotero.Utilities.trim(tags[i]);
				if (tag.length>0 && newItem.tags.indexOf(tag)<0) {
					newItem.tags.push(tag);
				}
			}
//			Zotero.debug("tags:\n"+tags);
		}
		
		// 文献出处 & DOI & 出版时间
		pattern = /【(?:文献出处|刊名)】([\s\S]*?)<\/a>/;
		if (pattern.test(page)) {
			var publicationTitle = trimTags(pattern.exec(page)[1]);
			newItem.publicationTitle = Zotero.Utilities.trim(publicationTitle);
//			Zotero.debug("publicationTitle: "+publicationTitle);
		}
		var doi;
		pattern = /【DOI】(.*?)<\/li>/;
		if (pattern.test(page)) {
			doi= pattern.exec(page)[1];
		} else {
			pattern = /【DOI】([\s\S]*?)<\/tr>/;
			if (pattern.test(page)) {
				doi= trimTags(pattern.exec(page)[1]);
			}
		}
		if (doi) {
			newItem.DOI = Zotero.Utilities.trim(doi);
//			Zotero.debug("doi: "+doi);
		}
		pattern = /【(?:文献出处|刊名)】(?:[\s\S]*?)(\d{4})年\s*([0-9A-Z]{2})(卷|期)/;
		if (pattern.test(page)) {
			var date = pattern.exec(page)[1];
			newItem.date = date;
			var val = pattern.exec(page)[2];
			var attr = pattern.exec(page)[3];
			if (attr == "卷") {
				newItem.volume = val;
			} else {
				newItem.issue = val;
			}
//			Zotero.debug("date: "+date);
//			Zotero.debug("val: "+val);
//			Zotero.debug("attr: "+attr);
		}
	
		newItem.complete();
	});
}

// work for thesis
function scrapeAndParse2(url) {
//	Zotero.debug("thesis");
	Zotero.Utilities.doGet(url, function(page) {
		var pattern;
	
		// 类型 & URL
		var itemType = "thesis";
		var newItem = new Zotero.Item(itemType);
//		Zotero.debug(url);
		newItem.url = url;
		var code = detectCode(url);
		if (code == "CDFD") {
			newItem.thesisType = "博士论文"
		} else {
			newItem.thesisType = "硕士论文"
		}
//		Zotero.debug(newItem.thesisType);
		
	
		// 标题/Title
		pattern = /<span (?:id="chTitle"|class='datatitle')>(.*?)<\/span>/;
		if (pattern.test(page)) {
			var title = pattern.exec(page)[1];
			pattern = /(<.*?>)/g;
			title = title.replace(pattern, "");
			newItem.title = title;
//			Zotero.debug("title: "+title);
		}
		
		// 作者/Author
		pattern = /【作者】([\s\S]*?)<\/a>/;
		if (pattern.test(page)) {
			var authorNames = trimTags(pattern.exec(page)[1]).split(";");
			for (var i=0; i<authorNames.length; i++) {
				newItem.creators.push(
					Zotero.Utilities.cleanAuthor(authorNames[i], 
					"author", true));
			}
//			Zotero.debug("authorNames:\n"+authorNames);
		}
		
		// 导师/Tutors
		pattern = /【导师】([\s\S]*?)<\/a>/;
		if (pattern.test(page)) {
			var directors = trimTags(pattern.exec(page)[1]).split(";");
			for (var i=0; i<directors.length; i++) {
				newItem.creators.push(
					Zotero.Utilities.cleanAuthor(trimTags(directors[i]), 
					"director", true));
			}
//			Zotero.debug("directors: "+directors);
		}
	
		// 摘要/Abstract
		var abst;
		pattern = /ReplaceFont\('ChDivSummary','(.*?)(?='\);ReplaceFont)/;
		if (pattern.test(page)) {
			abst = trimTags(pattern.exec(page)[1]);
		} else {
			pattern = /【中文摘要】([\s\S]*?)<\/tr>/;
			if (pattern.test(page)) {
				abst = trimTags(pattern.exec(page)[1]);
			}
		}
		if (abst) {
//			Zotero.debug("abstract:\n"+abst);
			newItem.abstractNote = trimMultiline(abst);
		}
		pattern = /ReplaceFont\('EnDivSummary','(.*?)(?='\);if)/;
		if (pattern.test(page)) {
			abst = trimTags(pattern.exec(page)[1]);
		} else {
			pattern = /【英文摘要】([\s\S]*?)<\/tr>/;
			if (pattern.test(page)) {
				abst = trimTags(pattern.exec(page)[1]);
			}
		}
		if (abst) {
//			Zotero.debug("abstract:\n"+abst);
			if (newItem.abstractNote===undefined) {
				newItem.abstractNote = Zotero.Utilities.trim(abst);
			} else {
				newItem.abstractNote = newItem.abstractNote + "\n" 
					+ trimMultiline(abst);
			}
		}
//		Zotero.debug(newItem.abstractNote);
		
		// 关键词/Keywords
		var tags;
		pattern = /【关键词】\s*<span[^>]*>(.*?)<\/a>*<\/span>/;
		if (pattern.test(page)) {
			tags = trimTags(pattern.exec(page)[1]).split(";");
		} else {
			pattern = /【关键词】([\s\S]*?)<\/tr>/;
			if (pattern.test(page)) {
				tags = trimTags(pattern.exec(page)[1]).split(";");
			}
		}
		if (tags) {
			for (var i=0; i<tags.length; i++) {
				var tag = Zotero.Utilities.trim(tags[i]);
				if (tag.length>0 && newItem.tags.indexOf(tag)<0) {
					newItem.tags.push(tag);
				}
			}
//			Zotero.debug("tags:\n"+tags);
		}
		pattern = /【Key words】\s*<span[^>]*>(.*?)<\/a>*<\/span>/;
		if (pattern.test(page)) {
			tags = trimTags(pattern.exec(page)[1]).split(";");
		} else {
			pattern = /【英文关键词】([\s\S]*?)<\/tr>/;
			if (pattern.test(page)) {
				tags = trimTags(pattern.exec(page)[1]).split(";");
			}
		}
		if (tags) {
			for (var i=0; i<tags.length; i++) {
				var tag = Zotero.Utilities.trim(tags[i]);
				if (tag.length>0 && newItem.tags.indexOf(tag)<0) {
					newItem.tags.push(tag);
				}
			}
//			Zotero.debug("tags:\n"+tags);
		}
//		Zotero.debug(newItem.tags);
		
		// 出版学校 & DOI & 出版时间
		var university;
		pattern = /【网络出版投稿人】\s*<a[^>]*>(.*?)<\/a>/;
		if (pattern.test(page)) {
			university = pattern.exec(page)[1];
		} else {
			pattern = /【网络出版投稿人】([\s\S]*?)<\/tr>/;
			if (pattern.test(page)) {
				university = Zotero.Utilities.trim(
					trimTags(pattern.exec(page)[1]));
			}
		}
		if (university) {
			pattern = /(.*?)（(.*?)）/;
			if (pattern.test(university)) {
				newItem.university = pattern.exec(university)[1];
				newItem.place = pattern.exec(university)[2];
			} else {
				newItem.publisher = university;
			}
//			Zotero.debug("university: "+university);
		}
		var doi;
		pattern = /【DOI】(.*?)<\/li>/;
		if (pattern.test(page)) {
			doi= pattern.exec(page)[1];
		} else {
			pattern = /【DOI】([\s\S]*?)<\/tr>/;
			if (pattern.test(page)) {
				var doi= trimTags(pattern.exec(page)[1]);
			}
		}
		if (doi) {
			newItem.DOI = Zotero.Utilities.trim(doi);
//			Zotero.debug("doi: "+doi);
		}
		var date;
		pattern = /【网络出版投稿时间】(.*?)\s*<\/li>/;
		if (pattern.test(page)) {
			date = pattern.exec(page)[1];
		} else {
			pattern = /【网络出版投稿时间】([\s\S]*?)\s*<\/tr>/;
			if (pattern.test(page)) {
				date = trimTags(pattern.exec(page)[1]);
			}
		}
		if (date) {
			newItem.date = Zotero.Utilities.trim(date);
//			Zotero.debug("date: "+date);
		}
	
		newItem.complete();
	});
}

// work for conferencePaper
function scrapeAndParse3(url) {
//	Zotero.debug("conferencePaper");
	Zotero.Utilities.doGet(url, function(page) {
		var pattern;
	
		// 类型 & URL
		var itemType = "conferencePaper";
		var newItem = new Zotero.Item(itemType);
//		Zotero.debug(url);
		newItem.url = url;
	
		// 标题/Title
		pattern = /<span id="chTitle">(.*?)<\/span>/;
		if (pattern.test(page)) {
			var title = trimTags(pattern.exec(page)[1]);
			newItem.title = title;
//			Zotero.debug("title: "+title);
		}
		
		// 作者/Authors
		pattern = /【作者】(.*?)<\/p>/;
		if (pattern.test(page)) {
			var authorNames = trimTags(pattern.exec(page)[1]).split(";");
			for (var i=0; i<authorNames.length; i++) {
				newItem.creators.push(
					Zotero.Utilities.cleanAuthor(
						Zotero.Utilities.trim(authorNames[i]), 
						"author", true));
			}
//			Zotero.debug("authorNames:\n"+authorNames);
		}
	
		// 摘要/Abstract
		var abst;
		pattern = /ReplaceFont\('ChDivSummary','(.*?)(?='\);ReplaceFont)/;
		if (pattern.test(page)) {
			abst = pattern.exec(page)[1];
//			Zotero.debug("raw:\n"+abst);
			pattern = /(<.*?>)/g;
			abst = abst.replace(pattern, "");
//			Zotero.debug("after:\n"+abst);
			newItem.abstractNote = Zotero.Utilities.trim(abst);
		}
	
		pattern = /ReplaceFont\('EnDivSummary','(.*?)(?='\);if)/;
		if (pattern.test(page)) {
			abst = pattern.exec(page)[1];
//			Zotero.debug("raw:\n"+abst);
			if (abst != undefined && abst != null) {
				pattern = /(<.*?>)/g;
				abst = abst.replace(pattern, "");
//				Zotero.debug("after:\n"+abst);
		
				if (newItem.abstractNote===undefined) {
					newItem.abstractNote = Zotero.Utilities.trim(abst);
				} else {
					newItem.abstractNote = newItem.abstractNote + "\n"
						+ Zotero.Utilities.trim(abst);
				}
			}
		}
//		Zotero.debug("abst:\n"+newItem.abstractNote);
		
		// 关键词/Keywords
		pattern = /【关键词】\s*<span[^>]*>(.*?)<\/a>*<\/span>/;
		if (pattern.test(page)) {
			var tags = trimTags(pattern.exec(page)[1]).split(";");
			for (var i=0; i<tags.length; i++) {
				var tag = Zotero.Utilities.trim(tags[i]);
				if (tag.length>0 && newItem.tags.indexOf(tag)<0) {
					newItem.tags.push(tag);
				}
			}
//			Zotero.debug("tags:\n"+tags);
		}
		pattern = /【Key words】\s*<span[^>]*>(.*?)<\/a>*<\/span>/;
		if (pattern.test(page)) {
			var tags = trimTags(pattern.exec(page)[1]).split(";");
			for (var i=0; i<tags.length; i++) {
				var tag = Zotero.Utilities.trim(tags[i]);
				if (tag.length>0 && newItem.tags.indexOf(tag)<0) {
					newItem.tags.push(tag);
				}
			}
//			Zotero.debug("tags:\n"+tags);
		}
//		Zotero.debug(newItem.tags);
	
		// 会议名称 & 会议录名称 & 会议地点 & 会议时间
		pattern = /【会议名称】(.*?)\s*<\/li>/;
		if (pattern.test(page)) {
			var conferenceName = trimTags(pattern.exec(page)[1]);
			newItem.conferenceName = conferenceName;
//			Zotero.debug("conferenceName: "+conferenceName);
		}
		pattern = /【会议录名称】(.*?)\s*<\/li>/;
		if (pattern.test(page)) {
			var proceedingsTitle = trimTags(pattern.exec(page)[1]);
			newItem.proceedingsTitle = proceedingsTitle;
//			Zotero.debug("proceedingsTitle: "+proceedingsTitle);
		}
		pattern = /【会议地点】(.*?)\s*<\/li>/;
		if (pattern.test(page)) {
			var place = trimTags(pattern.exec(page)[1]);
			newItem.place = place;
//			Zotero.debug("place: "+place);
		}
		pattern = /【会议时间】(.*?)\s*<\/li>/;
		if (pattern.test(page)) {
			var date = trimTags(pattern.exec(page)[1]);
			newItem.date = date;
//			Zotero.debug("date: "+date);
		}

		newItem.complete();
	});
}

// work for newspaperArticle
function scrapeAndParse4(url) {
//	Zotero.debug("newspaperArticle");
	Zotero.Utilities.doGet(url, function(page) {
		var pattern;
	
		// 类型 & URL
		var itemType = "newspaperArticle";
		var newItem = new Zotero.Item(itemType);
//		Zotero.debug(url);
		newItem.url = url;
	
		// 标题/Title
		pattern = /<span id="chTitle">(.*?)<\/span>/;
		if (pattern.test(page)) {
			var title = trimTags(pattern.exec(page)[1]);
			newItem.title = title;
//			Zotero.debug("title: "+title);
		}
	
		// 副标题/引题
		var shortTitle;
		pattern = /<p>【(?:副标题|引题)】(.*?)(?=<\/p>)/;
		if (pattern.test(page)) {
			shortTitle = pattern.exec(page)[1];
//			Zotero.debug("shortTitle: "+shortTitle);
			newItem.shortTitle = Zotero.Utilities.trimInternal(shortTitle);
		}
//		Zotero.debug(newItem.shortTitle);
	
		// 作者/Authors
		pattern = /【作\s*者】(.*?)<\/p>/;
		if (pattern.test(page)) {
			var authorNames = trimTags(pattern.exec(page)[1]).split(";");
			for (var i=0; i<authorNames.length; i++) {
				newItem.creators.push(
					Zotero.Utilities.cleanAuthor(
						Zotero.Utilities.trim(authorNames[i]), 
						"author", true));
			}
//			Zotero.debug("authorNames:\n"+authorNames);
		}
		
		// 正文快照/Abstract
		var abst;
		pattern = /<p>【正文快照】(.*?)(?=<\/p>)/;
		if (pattern.test(page)) {
			abst = pattern.exec(page)[1];
//			Zotero.debug("abst:\n"+abst);
			newItem.abstractNote = Zotero.Utilities.trimInternal(abst);
		}
//		Zotero.debug(newItem.abstractNote);
		
		// 报纸名称 & DOI & 出版时间 & 版名 & 版号
		pattern = /【报纸名称】\s*<[^>]*>(.*?)<\/a>/;
		if (pattern.test(page)) {
			var publicationTitle = trimTags(pattern.exec(page)[1]);
			newItem.publicationTitle = publicationTitle;
//			Zotero.debug("publicationTitle: "+publicationTitle);
		}
		pattern = /【DOI】\s*(.*?)\s*<\/li>/;
		if (pattern.test(page)) {
			var doi = pattern.exec(page)[1];
			newItem.DOI = doi;
//			Zotero.debug("doi: "+doi);
		}
		pattern = /【报纸日期】\s*(.*?)\s*<\/li>/;
		if (pattern.test(page)) {
			var date = pattern.exec(page)[1];
			newItem.date = date;
//			Zotero.debug("date: "+date);
		}
		pattern = /【版名】\s*(.*?)\s*<\/li>/;
		if (pattern.test(page)) {
			var section = pattern.exec(page)[1];
			newItem.section = section;
//			Zotero.debug("section: "+section);
		}
		pattern = /【版号】\s*(.*?)\s*<\/li>/;
		if (pattern.test(page)) {
			var edition = pattern.exec(page)[1];
			newItem.edition = edition;
//			Zotero.debug("edition: "+edition);
		}
	
		newItem.complete();
	});
}

// #########################
// ##### API functions #####
// #########################

function detectWeb(doc, url) {
	var pattern = /detail.aspx/;

	if (pattern.test(url)) {
		var code = detectCode(url).toUpperCase();
//		Zotero.debug(code);
		if (code == "CJFQ" || code == "CJFD") {
			return "journalArticle";
		} else if (code == "CDFD") {
			return "thesis";
		} else if (code == "CMFD" || code == "CLKM") {
			return "thesis";
		} else if (code == "CPFD") {
			return "conferencePaper";
		} else if (code == "CCND") {
			return "newspaperArticle";
		} else if (code == "NONE") {
			Zotero.debug("Not support yet.");
		}
	}

	pattern = /brief/;
	if (pattern.test(url)) {
		return "multiple"
	}

	return false;
}

function doWeb(doc, url) {
	var nsResolver = getResolver(doc);
	var urls, tds, pages;

//	Zotero.debug(url);

	if (detectWeb(doc, url) == "multiple") {
//		Zotero.debug("Enter multiple.");
		// search page
		var items = new Array();

		var xpath = '//iframe[@id="iframeResult"]';
		var iframe = doc.evaluate(xpath, doc, nsResolver,
			XPathResult.ANY_TYPE, null).iterateNext();
		if (iframe) {
			// fetch iframe's element
//			Zotero.debug(iframe.src);
			pages = Zotero.Utilities.retrieveSource(iframe.src);
		} else {
			// already in iframe
//			Zotero.debug("url:"+url);
			pages = Zotero.Utilities.retrieveSource(url);
		}

		pattern = /<tr class=["']GTContentTitle["']>[\s\S]*?<\/tr>([\s\S]*?)<table class=["']pageBar_bottom["']/;
		var content;
		try {
			content = pattern.exec(pages)[1];
//			Zotero.debug(content);
			pattern = /<\/table>[\s\S]*?<a href=["'](.*?)["'][^>]*?><script[\s\S]*?(?:Replace[^\(]*?\()'(.*?)'\)/g;
		} catch (err) {
			content = pages;
			pattern = /<div class=["']GridTitleDiv["']>.*?<a href=["'](.*?)["'][^>]*?><script[\s\S]*?(?:Replace[^\(]*?\()'(.*?)'\)/g;
		}
		var res = pattern.exec(content);
		if (!res) {
			pattern = /<div class=["']GridTitleDiv["']>.*?<a href=["'](.*?)["'][^>]*?>(.*?)<\/a>/g;
			res = pattern.exec(content);
			if (!res) {
				pattern = /<\/table>[\s\S]*?<a href=["'](.*?)["'][^>]*?>(.*?)<\/a>/g;
				res = pattern.exec(content);
			}
		}
		var link;
		var title;
		while (res) {

			title = Zotero.Utilities.cleanTags(res[2]);
			link = res[1];

			patt = /^(http:\/\/.*?)\//;
			link = patt.exec(url)[1] + link;
			items[link] = trimTags(title);
//			Zotero.debug("title:"+title);
//			Zotero.debug("link:"+link);

			res = pattern.exec(content);
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
			var type = detectWeb(null, urls[i]);
//			Zotero.debug(type);
			if (type == "journalArticle") {
				scrapeAndParse1(urls[i]);
			} else if (type == "thesis") {
				scrapeAndParse2(urls[i]);
			} else if (type == "conferencePaper") {
				scrapeAndParse3(urls[i]);
			} else if (type == "newspaperArticle") {
				scrapeAndParse4(urls[i]);
			} else {
				Zotero.debug("Not supported type.");
			}
		}
	}
}
