{
        "translatorID":"5c95b67b-41c5-4f55-b71a-48d5d7183063",
        "label":"CNKI",
        "creator":"Ace Strong<acestrong@gmail.com> and Heromyth<zxpmyth@yahoo.com.cn>",
        "target":"^https?://(?:(?:(dlib|epub|ckrd)(?:.edu)?.cnki.net)|(?:[0-9.]+))/(?:kns50|grid2008|grid20)",
        "minVersion":"2.0.b4",
        "maxVersion":"",
        "priority":100,
        "inRepository":true,
        "translatorType":4,
        "lastUpdated":"2010-09-26 15:08:45"
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


function detectWeb(doc, url) {
	var articleRe = /detail.aspx/;
	var s = articleRe.exec(url);

	if(s) {
		return "journalArticle";
	} else {
		articleRe = /Brief.aspx/;
		s = articleRe.exec(url);
		if(s)
			return "multiple";

	}

	return false;
}

function scrape(doc, url) {
	//var namespace = doc.documentElement.namespaceURI;
	//var nsResolver = namespace ? function(prefix) {
	//	if (prefix == "x") return namespace; else return null;
	//} : null;
	var nsResolver = null;

	var itemType = "journalArticle";
	// TODO: 因为中英文信息都不想丢失，所以存为两个Item，也算是中国特色吧～
	// 但是目前只解析出中文的信息，下个版本中添加英文信息。
	var newItem = new Zotero.Item(itemType);
	//Zotero.debug(itemType);
	newItem.url = url;

	// 标题
	var titles = doc.title.split('-').slice(0,-1);
	//Zotero.debug(titles);
	var title = titles.join("-");
	Zotero.debug("Title:"+title);
	newItem.title = title;

	// 附件，网页快照
	var snapName = title + " (CNKI)";
	//Zotero.debug(snapName);
	//newItem.attachments.push({document:doc, title:snapName});
	newItem.attachments.push({url:newItem.url, snapshot:true, title:snapName, mimeType:"text/html"});
	//Zotero.debug(doc);

	// 其他信息，/html/body/table[4]/tbody/tr/td[2]/table/tbody/tr/td[2]/table[2]/tbody
	var dataRows = doc.evaluate('//body/table[4]/tbody/tr/td[2]/table/tbody/tr/td[2]/table[2]/tbody/tr', doc, nsResolver,
		XPathResult.ANY_TYPE, null);
	var dataRow;
	while(dataRow = dataRows.iterateNext()) {
		var tds = dataRow.getElementsByTagName("td");
		var heading = Zotero.Utilities.trimInternal(tds[0].textContent);
		var content = tds[1];
		if(heading == "【作者中文名】" || heading == "【作者】") {
			//Zotero.debug("Authors:");
			var as = content.getElementsByTagName("a");
			//Zotero.debug(as.length);
			var i=0;
			for(i=0;i<as.length;i++) {
				var a = as[i];
				newItem.creators.push(Zotero.Utilities.cleanAuthor(a.textContent, "author", true));
				//Zotero.debug(a.textContent);
			}
		} else if(heading == "【文献出处】" || heading == "【刊名】") {
			//Zotero.debug("Publication:");
			var as = content.getElementsByTagName("a");
			//Zotero.debug(as[0].textContent);
			//Zotero.debug(as[3].textContent);
			// 出版社
			newItem.publicationTitle = as[0].textContent;
			var parts = Zotero.Utilities.trimInternal(as[3].textContent);
			// 出版时间
			var year = parts.substr(0,4);
			//Zotero.debug(year);
			newItem.date = year;
			// 卷号或期号
			var pattern = /(.*)(期|卷)/
			var testStr = parts.split(" ")[1];
			//Zotero.debug(testStr);
			if (pattern.test(testStr)){
				var attr = pattern.exec(testStr);
				//Zotero.debug(attr[1]+":"+attr[2]);
				if(attr[2]=="期"){
					newItem.issue = attr[1];
				}else{
					newItem.volume = attr[1];
				}
			}
		} else if(heading == "【摘要】" || heading == "【英文摘要】") {
			//Zotero.debug("Abstract:");
			var abstract = null;
			if (content.getElementsByTagName("font")[0] != null){
				abstract = content.getElementsByTagName("font")[0].textContent;
			}
			else{
				// 有些地方没有字体，直接在td标签下就是摘要。
				abstract = content.textContent;
			}
			//Zotero.debug(abstract);
			//Zotero.debug(newItem.abstractNote);
			if(newItem.abstractNote===undefined){
				newItem.abstractNote = Zotero.Utilities.trim(abstract);
			}else{
				newItem.abstractNote = newItem.abstractNote + "\n" + Zotero.Utilities.trim(abstract);
			}
		} else if(heading == "【DOI】") {
			//Zotero.debug("DOI:");
			var doi = Zotero.Utilities.trimInternal(content.textContent);
			//Zotero.debug(doi);
			newItem.DOI = doi;
		} else if(heading == "【关键词】"||heading == "【英文关键词】"||heading == "【中文关键词】") {
			//Zotero.debug("tags:");
			var as = content.getElementsByTagName("a");
			var i=0;
			for(i=0;i<as.length;i++) {
				var a = as[i];
				//Zotero.debug(a.textContent);
				newItem.tags.push(a.textContent);
			}
		}
	}
	// download pdf file
	// /html/body/table[4]/tbody/tr/td[2]/table/tbody/tr/td[2]/table/tbody/tr/td/table/tbody/tr/td/table/tbody/tr/td/table/tbody/tr/td[2]/a[2]
	//var as = table3.getElementsByTagName("a");
	//Zotero.debug(as[0].textContent);
	//Zotero.debug(as[1].textContent);
	//var pdfurlElmt = as[1];
	//if (pdfurlElmt) {
	//	newItem.attachments.push({url:pdfurlElmt.href, title:"CNKI Full Text PDF", mimeType:"application/pdf", downloadable:true});
	//}
	//Zotero.debug(pdfurlElmt.href);
	//Zotero.debug("finished.");
	newItem.complete();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = null;

	Zotero.debug(url);

	if(detectWeb(doc, url) == "multiple") {
		//Zotero.debug("Enter multiple~");
		// search page
		var items = new Array();

		var tableRows = doc.evaluate('//table[4]/tbody/tr/td[4]/table[3]/tbody/tr/td/table/tbody/tr[2]/td/table/tbody/tr', doc, nsResolver, XPathResult.ANY_TYPE, null);
		//Zotero.debug("get table rows");
		var tableRow;
		//Zotero.debug("begin to fetch multiple title and link");
		while(tableRow = tableRows.iterateNext()) {
			//Zotero.debug(tableRow!=null);
			var title = "";
			var link = "";
			var as = tableRow.getElementsByTagName("a");
			for each(var a in as) {
				if(a.textContent) {
					// shoulde only one 'a' here.
					link = a.href;
					title = a.textContent;
				}
			}
			//Zotero.debug(title);
			//Zotero.debug(link);
			if(link) {
				items[link] = Zotero.Utilities.trimInternal(title);
			}
		}
		// 让用户选择要保存哪些文献
		items = Zotero.selectItems(items);
		if(!items) return true;
		//Zotero.debug("go on processing.");

		var urls = new Array();
		for(var url in items) {
			urls.push(url);
		}
	} else {
		var urls = [url];
	}
	//Zotero.debug(urls);
	// 下面对每条url进行解析
	Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); },null);
	Zotero.wait();
}
