{
	"translatorID":"f909cbda-2fac-4700-965f-6c0783b77eeb",
	"translatorType":4,
	"label":"Tatknigafund",
	"creator":"Avram Lyon",
	"target":"^https?://www.tatknigafund.ru/books/",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":false,
	"lastUpdated":"2009-12-31 16:20:00"
}

/*
 This translator is designed for the Tatar Book Repository, http://www.tatknigafund.ru/ .
 At present, it imports the limited metadata that the repository exposes about its books,
 independent of interface language (Russian or Tatar).
 
 It should be able to fetch bibliographic data even for non-logged-in users, although
 to read the full-text of works in the repository, users will need to create a free account.
 
 It works on URLs of the form http://www.tatknigafund.ru/books/XXXX/ , where XXXX is the
 book ID assigned by the repository. One such URL is:
 http://www.tatknigafund.ru/books/1037
 Which should give the result:
 Ф. Гыйбадуллина, Роман hәм милләт: Гаяз Исхакый иҗатында роман жанры (Татарстан китап нəшрияты, 2007),
	http://www.tatknigafund.ru/books/1037?locale=tt.
 It should also populate the abstract field.
 
 It can also work on search results, of the form http://www.tatknigafund.ru/books/search?locale=ru&type=meta&query=XXXX
 where XXXX is the query string. One such URL is:
 http://www.tatknigafund.ru/books/search?locale=ru&type=meta&query=%D0%B8%D1%81%D1%85%D0%B0%D0%BA%D0%B8
 Which at present gives six results.

 When Zotero is able to assign languages to bibliographic data, the data obtained here would
 be a good candidate, since all the author names, titles and abstracts are served in Russian
 or Tatar, depending on the user's locale choice.
 
 This translator draws heavily on the National Library of Australia translator for inspiration,
 in lieu of up-to-date translator documentation.
 */

function detectWeb(doc, url) {
	if (url.match("books/search?")) {
		return "multiple";
	} else
	if (url.match("books") && !url.match("read")) {
		return "book";
	}
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var books = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var tablerow = doc.evaluate('//table[@class="books_list"]/tbody/tr', doc, ns, XPathResult.ANY_TYPE, null);
		var items = new Array();
		var row;
		while(row = tablerow.iterateNext()) {
			var link = doc.evaluate('./td/a[@class="book_title"]', row, ns, XPathResult.ANY_TYPE, null).iterateNext();
			var title = link.textContent;
			var url = link.href;
			items[url] = title;
		}
		items = Zotero.selectItems(items);
		if(!items) return true;
		for (var i in items) {
			books.push(i);
		}
	} else {
		books = [url];
	}
	
	Zotero.Utilities.processDocuments(books, function(doc) {
		item = new Zotero.Item("book");
		item.title = Zotero.Utilities.trimInternal(
			doc.evaluate('//div[@class="description"]/h1', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent
		);
		
		var author = doc.evaluate('//a[@class="author_link"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		// Authors here are Last Name, First initial(s) (ФИО)
		var spaceIndex = author.lastIndexOf(" ");
		var firstName = author.substring(spaceIndex+1);
		var lastName = author.substring(0, spaceIndex);
		item.creators.push({firstName:firstName, lastName:lastName, creatorType:"author"});
		
		var info = doc.evaluate('//p[@class="summary"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		var pub = info.match(/(Нәшрият|Издательство): (.+)/);
		var publisher = pub[2];
		yr = info.match(/(Нәшрият|Издательство): (.+),\s+(\d+)\s(ел|г)\./);
		var year = yr[3];
	
		var pagematch = info.match(/(\d+) (бит|страница|страниц|страницы)/);
		var pages = pagematch[1];
		item.publisher = Zotero.Utilities.trimInternal(publisher);
		item.date = Zotero.Utilities.trimInternal(year);
		item.numPages = pages;
		
		var description = doc.evaluate('//div[@class="description"]/p[2]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		item.abstractNote = description;
		
		item.url = url;
		
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}