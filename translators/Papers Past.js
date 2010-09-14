{
        "translatorID":"1b052690-16dd-431d-9828-9dc675eb55f6",
        "label":"Papers Past",
        "creator":"staplegun",
        "target":"^http://paperspast\\.natlib\\.govt\\.nz",
        "minVersion":"1.0",
        "maxVersion":"",
        "priority":100,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2010-09-14 19:04:32"
}

/*
    Papers Past Translator - Parses historic digitised newspaper articles and creates Zotero-based metadata
    Copyright (C) 2010 staplegun

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

  // a results parameter in URL means search hitlist
  if (url.match(/results=/) ) {
    return "multiple";

  } else {

    // init variables
    var namespace = doc.documentElement.namespaceURI;
    var nsResolver = namespace ? function(prefix) {
      if (prefix == "x" ) return namespace; else return null;
    } : null;
    var myXPath;
    var myXPathObject;

    // publication title in meta tags means have an article
    myXPath          = '//meta[@name="newsarticle_publication"]/@content';
    myXPathObject    = doc.evaluate(myXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
    var meta = myXPathObject.iterateNext().textContent;
    if (meta.length > 0) {
      return "newspaperArticle";
    }
  }
}

function doWeb(doc, url) {

  // init variables
  var namespace = doc.documentElement.namespaceURI;
  var nsResolver = namespace ? function(prefix) {
    if (prefix == "x" ) return namespace; else return null;
  } : null;

  // hitlist page: compile hitlist titles, user selects which are wanted 
  // (add &zto=1 to URL for usage tracking)
  var articles = new Array();
  if (detectWeb(doc, url) == "multiple") {
    var titlesXPath = '//div[@class="search-results"]/p/a';
    var titles      = doc.evaluate(titlesXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
    var nextTitle;
    var items       = new Array();
    while (nextTitle = titles.iterateNext()) {
      items[nextTitle.href+"&zto=1"] = nextTitle.textContent;
    }
    // presented to user - who reduces list to those selected
    items = Zotero.selectItems(items);
    // transfer this list to articles array
    for (var i in items) {
      articles.push(i);
    }

  // article page: just continue with single (current) page URL
  } else {
    articles = [url+"&zto=1"];
  }

  // process each selected article page URL
  Zotero.Utilities.processDocuments(articles, scrape, function(){Zotero.done();});
  Zotero.wait();
}

function scrape(doc) {

  // init variables
  var namespace = doc.documentElement.namespaceURI;
  var nsResolver = namespace ? function(prefix) {
    if (prefix == "x" ) return namespace; else return null;
  } : null;
  var myXPath;
  var myXPathObject;
  
  // basic item details
  var newItem     = new Zotero.Item('newspaperArticle');
  newItem.url     = doc.location.href;
  newItem.archive = 'Papers Past';

  // publication title
  myXPath       = '//meta[@name="newsarticle_publication"]/@content';
  myXPathObject = doc.evaluate(myXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
  newItem.publicationTitle = myXPathObject.iterateNext().textContent;
  Zotero.debug(newItem.publicationTitle);

  // article title (convert to sentence case)
  // NB: THE CONVERSION SEEMS TO FAIL IF HAS SPECIAL CHARS
  myXPath          = '//meta[@name="newsarticle_headline"]/@content';
  myXPathObject    = doc.evaluate(myXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
  var title   = myXPathObject.iterateNext().textContent;
  var words = title.split(/\s/);
  var titleFixed = '';
  for (var i in words) {
   words[i] = words[i][0].toUpperCase() + words[i].substr(1).toLowerCase();
   titleFixed = titleFixed + words[i] + ' ';
  }
  titleFixed = Zotero.Utilities.trim(titleFixed);
  newItem.title = titleFixed;

  // publication date (is preformatted to ISO 8601)
  myXPath          = '//meta[@name="dc_date"]/@content';
  myXPathObject    = doc.evaluate(myXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
  newItem.date = myXPathObject.iterateNext().textContent;

  // pagination
  myXPath          = '//meta[@name="newsarticle_firstpage"]/@content';
  myXPathObject    = doc.evaluate(myXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
  var pages = myXPathObject.iterateNext().textContent;

  myXPath          = '//meta[@name="newsarticle_otherpages"]/@content';
  myXPathObject    = doc.evaluate(myXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
  pages = pages + ' ' + myXPathObject.iterateNext().textContent;

  newItem.pages = Zotero.Utilities.trim(pages);

  // save copy of entire web page as attachment
	var attachments = new Array();
  attachments.push({
    title:titleFixed + " : Article webpage",
    mimeType:"text/html",
    url:doc.location.href
  });

  // find image scans and add as attachments
  myXPath       = '//img[@class="veridianimage"]/@src';
  myXPathObject = doc.evaluate(myXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
  var imgSrc;
  var imgUrl;
  var imgNo = 0;
  while (imgSrc = myXPathObject.iterateNext() ) {
	  imgUrl = "http://paperspast.natlib.govt.nz" + imgSrc.textContent;
	  attachments.push({
		  title: titleFixed + " : Scan image part " + ++imgNo,
		  mimeType: "image/gif",
		  url: imgUrl
    });
  }
  newItem.attachments = attachments;

  // finish
  newItem.complete();
}
