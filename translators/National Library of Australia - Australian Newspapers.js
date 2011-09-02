{
	"translatorID": "fcfcfe9c-f6dd-48c6-aef9-61adbba31a4e",
	"label": "National Library of Australia - Australian Newspapers",
	"creator": "Tim Sherratt",
	"target": "^https?://trove\\.nla\\.gov\\.au/(?:newspaper|ndp)/",
	"minVersion": "2.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "g",
	"lastUpdated": "2011-08-24 15:59:48"
}

/*
   National Library of Australia - Australian Newspapers Translator
   Copyright (C) 2011 Tim Sherratt (tim@discontents.com.au, @wragge)

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU Affero General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU Affero General Public License for more details.

   You should have received a copy of the GNU Affero General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

function detectWeb(doc, url) {
    if (url.match(/\/newspaper\/result/i) || url.match(/\/ndp\/del\/page/)) {
        return "multiple";
    } else if (url.match(/\/ndp\/del\/article\//i)) {
        return "newspaperArticle";
    }
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var articles = new Array();
	var items = new Object();
	var nextTitle;
	if (detectWeb(doc, url) == "multiple") {
		// Search results
		if (url.match(/\/newspaper\/result/i)) {
			var titles = doc.evaluate('//div[@id="tnewspapers"]/ol/li[@class="article "]/dl/dt/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		// All the articles on a page
		} else if (url.match(/\/ndp\/del\/page/)) {
			var titles = doc.evaluate('//ul[@class="articles"]/li/h4/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		while (nextTitle = titles.iterateNext()) {
			if (nextTitle.textContent != '[coming soon]') {
    			items[nextTitle.href] = nextTitle.textContent;			}
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	Zotero.Utilities.processDocuments(articles, scrape, function(){Zotero.done();});
	Zotero.wait();
}

function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var nextTag, nextImg, nextLine;
	var newItem = new Zotero.Item("newspaperArticle");
	newItem.libraryCatalog = 'National Library of Australia - Trove - Australian Newspapers';
	// Get the persistent identifier.
	articleId = doc.location.href.match(/http:\/\/[a-z]+\.nla\.gov\.au\/ndp\/del\/article\/(\d+)/)[1];
	newItem.url = 'http://nla.gov.au/nla.news-article' + articleId
	// Gather all the basic details
	newItem.title =  Zotero.Utilities.trimInternal(doc.evaluate('//meta[@name="newsarticle_headline"]/@content', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
	var pubDetails = doc.evaluate('//div[@class="box title"]/strong', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent;
	newItem.publicationTitle = pubDetails.match(/(.+?) \(/)[1];
    if (pubDetails.indexOf(':') != -1) {
		newItem.place = pubDetails.match(/\((.+?) :/)[1];
	}
	newItem.date = doc.evaluate('//div[@class="box issue"]/strong', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent.match(/\w+ (\d{1,2} .+)/)[1];
	newItem.pages = Zotero.Utilities.trim(doc.evaluate('//select[@name="id"]/option[@selected="selected"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
	// Get tags.
	var tags = doc.evaluate('//p[@class="tags"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
	while (nextTag = tags.iterateNext()) {
		newItem.tags.push(nextTag.textContent);
	}
	// Get OCRed text
	var OCRLines = doc.evaluate('//p[@class="S8"]/span', doc, nsResolver, XPathResult.ANY_TYPE, null);
	var OCRText = '';
	while (nextLine = OCRLines.iterateNext()) {
		OCRText = OCRText + nextLine.textContent + '\n';
	}
	if (OCRText != '') {
		newItem.abstractNote = OCRText;
	}
	/* Uncomment this section if you want to save jpgs of the article (the pdfs are generally easier to work with).
	// Change the number at the end of the string to alter zoom factor - '/3?print=n'
	var imgDoc = Zotero.Utilities.retrieveDocument('http://trove.nla.gov.au/ndp/del/printArticleJpg/' + newItem.url.match(/.*?(\d+)/)[1] + '/3?print=n');
	var imgs =  imgDoc.evaluate('//img[@id="articleImg"]', imgDoc, nsResolver, XPathResult.ANY_TYPE, null);
	// With high zoom values or long articles there might be multiple images, so loop through and save them all.
	var imgNum = 1;
	while (nextImg = imgs.iterateNext()) {
		newItem.attachments.push({url:nextImg.src, title: newItem.publicationTitle + ', ' + newItem.date + ', p. ' + newItem.pages + ' - ' + imgNum, mimeType:'image/jpeg'});
		imgNum++;
	}
	*/
	// Save PDF version as attachment
	newItem.attachments.push({url: 'http://trove.nla.gov.au/ndp/del/printArticlePdf/' + articleId + '/3?print=n', title: newItem.publicationTitle + ', ' + newItem.date + ', p. ' + newItem.pages, mimeType:'application/pdf'});
	newItem.complete();
}

// Search result test fails when run automatically:
// http://trove.nla.gov.au/newspaper/result?q=clement+wragge

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://trove.nla.gov.au/ndp/del/article/972415",
		"items": [
			{
				"itemType": "newspaperArticle",
				"creators": [],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "The Argus, 8 August 1945, p. 1",
						"mimeType": "application/pdf"
					}
				],
				"libraryCatalog": "National Library of Australia - Trove - Australian Newspapers",
				"url": "http://nla.gov.au/nla.news-article972415",
				"title": "ATOMIC BOMB WARNING TO JAPS PEOPLE TOLD OF HORRORS OF NEW WEAPON Intensive Broadcast Campaign FROM OUR OWN CORRESPONDENT IN NEW YORK AND AAP NOW THAT AN ATOMIC BOMB HAS BEEN DROPPED ON JAPAN ALL POSSIBLE MEANS ARE BEING USED TO TELL THE JAPANESE OF THE HORRORS OF THE BOMB AND AT THE SAME TIME TO DRIVE HOME TO THEM THE POTSDAM SURRENDER TERMS. Four powerful Office of War Information stations are broadcasting news to Japan, while leaflets being produced at Saipan and Manila will be dropped over Japanese communities and troop concentrations. The two regular newspapers which are carried to Japan weekly by Super-Fortresses—\"Jiho,\" published on Saipan, and \"Rakkason,\" published in Manila—will lead with the atomic bomb story.",
				"publicationTitle": "The Argus",
				"place": "Melbourne, Vic.",
				"date": "8 August 1945",
				"pages": "1",
				"abstractNote": "ATOMIC  BOMB  WARNING  TO  JAPS\n  PEOPLE  TOLD  OF\n  HORRORS\n  OF  NEW  WEAPON\n  Intensive  Broadcast  Campaign\n  FROM  OUR  OWN  CORRESPONDENT  IN  NEW  YORK  AND  AAP\n  NOW  THAT  AN  ATOMIC  BOMB  HAS  BEEN  DROPPED  ON  JAPAN\n  ALL  POSSIBLE  MEANS  ARE  BEING  USED  TO  TELL  THE\n  JAPANESE  OF  THE  HORRORS  OF  THE  BOMB  AND  AT  THE\n  SAME  TIME  TO  DRIVE  HOME  TO  THEM  THE  POTSDAM\n  SURRENDER  TERMS.\n  Four  powerful  Office  of  War  Information  stations  are  broadcasting\n  news  to  Japan,  while  leaflets  being  produced  at  Saipan  and  Manila  will\n  be  dropped  over  Japanese  communities  and  troop  concentrations.\n  The  two  regular  newspapers  which  are  carried  to  Japan  weekly  by\n  Super-Fortresses  -  \"Jiho,\"  published  on  Saipan,  and  \"Rakkason,\"\n  published  in  Manila-will  lead  with  the  atomic  bomb  story.\n  The  Office  of  War  Information\n  revealed  yesterday  that   \n  transmissions  to  Japan  began\n  immediately  after  President\n  Truman's  statement  that  the\n  atomic  bomb  was  already  in  use\n  was  issued.\n  New  York  Times  Washington\n  correspondent  says  that  while\n  Mr  Stimson,  US  War  Secretary,\n  said  the  atomic  bomb  should\n  prove  a  tremendous  aid  in\n  shortening  the  war  against\n  Japan,  other  responsible  officials\n  thought  that  that  was  an   \n  extreme  understatement,  and\n  that  Japan  might  be  unable  to\n  remain  in  the  war  under  the\n  coming  rain  of  atomic  bombs.\n  Obviously  the  news  was   \n  released  now,  the  correspondent\n  adds,  because  of  the  possible\n  psychological  effect  in  forcing\n  the  Japanese  to  surrender.\n  DETAILS  AWAITED\n  Meanwhile  London  is  eagerly\n  awaiting  an  official  statement\n  on  the  scientific  details  of  the\n  atomic  bomb,  which  Sir  John\n  Anderson,  who  supervised   \n  research  work  in  Britain,  said\n  would  be  issued  in  a  few  days.\n  Press  Association  says  it  is\n  clear  from  the  announcements\n  already  made  that  the  industrial\n  application  of  this  new   \n  source  of  energy  will  require\n  many  years  of  research  and   \n  development  before  it  is  ready\n  for  exploitation.\n  Reuter's  military  correspondent\n  says:  \"It  seems  that  the   \n  secrets  of  the  atomic  bomb  will\n  not  be  shared  by  any  power\n  other  than  those  directly   \n  concerned  with  its  production.\n  \"As  soon  as  the  Big  Three's\n  experts  had  an  opportunity  to\n  study  all  the  strategic  implications,\n  it  is  likely  that  consultations   \n  will  begin  to  consider   \n  methods  for  the  agreed  control\n  of  the  super-bomb's  manufacture\n  and  use.   \n  \"Its  offensive  uses  at  the\n  moment  are  in  the  limelight,\n  but  its  use  in  defence  may\n  equally  outmode  the  present\n  forms  of  aerial  warfare.\n  \"So  far  experts  have  been   \n  unable  to  do  anything  more  than\n  grasp  the  sheer  magnitude  of\n  the  revolution  facing  them,  but\n  the  Big  Three  Governments  are\n  expected  to  act  speedily  to\n  regulate  this  unforeseen   \n  situation.\"\n  DECISION  OUTDATED\n  The  correspondent  adds:  \"The\n  strategic  decisions  taken  at\n  Teheran,  Yalta,  and  Potsdam,\n  according  to  military  experts,\n  have  already  been  outdated  by\n  the  advent  of  the  bomb.\n  \"Security  can  no  longer  be   \n  defined  for  instance  by  control  of\n  the  Dardanelles  and  the  Suez\n  Canal,  and  by  possession  of  this\n  or  that  port,  river,  or   \n  mountain."
			}
		]
	},
	{
		"type": "web",
		"url": "http://trove.nla.gov.au/newspaper/result?q=clement+wragge",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://trove.nla.gov.au/ndp/del/page/32665",
		"items": "multiple"
	}
]
/** END TEST CASES **/
