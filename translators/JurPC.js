{
	"translatorID":"b662c6eb-e478-46bd- bad4-23cdfd0c9d67",
	"translatorType":4,
	"label":"JurPC",
	"creator":"Oliver Vivell and Michael Berkowitz",
	"target":"http://www.jurpc.de/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-12 19:30:00"
}

function detectWeb(doc, url) {
        var doctype = doc.evaluate('//meta/@doctype', doc, null,XPathResult.ANY_TYPE, null).iterateNext().textContent;

        if (doctype == "Aufsatz"){
                return "Aufsatz";
        }else{
                return "Rechtsprechung";
        }
}

function doWeb(doc, url) {

        var articles = new Array();

        if (detectWeb(doc, url) == "Aufsatz") {

                // Aufsatz gefunden

                Zotero.debug("Ok, we have an JurPC Article");
                var authors = '//meta/@Author';
                var title = '//meta/@Title';
                var webdoktext = '//meta/@WebDok';

                var authors = parseDoc(authors,doc);
                var title = parseDoc(title,doc);

                var webabs = webdoktext.substr(webdoktext.lastIndexOf("Abs."), webdoktext.length);

                //Zotero.debug(doctype);
                 Zotero.debug(webdoktext);
                var year = url.substr(28, 4);

                //Get Year & WebDok Number from Url
                var webdok = url.substr(32, 4);

                var suche = webdok.indexOf("0");
                if (suche == 0){
                         webdok = url.substr(33, 3);
                         suche = webdok.indexOf("0");

                        if(suche == 0){
                                webdok = url.substr(34, 2);
                                suche = webdok.indexOf("0");
                                }
                                //Zotero.debug(suche);
                                if(suche == 0){
                                        webdok = url.substr(35, 1);
                                        suche = webdok.indexOf("0");
                                }
                }

                var re = /<[^>]*>/
                Zotero.debug(re);
                        title = title.replace(re,"");
                        title = title.replace(re,"");
                        title = title.replace(re,"");
                Zotero.debug(title);

                var newArticle = new Zotero.Item('journalArticle');

                newArticle.title = title;
                newArticle.journal = "JurPC";
                newArticle.journalAbbreviation = "JurPC";
                newArticle.year = year;
                newArticle.volume =  "WebDok " + webdok + "/" + year;
                newArticle.pages = webabs ;
                newArticle.url = url;
                var aus = authors.split("/");
                for (var i=0; i< aus.length ; i++) {
                        Zotero.debug(aus[0]);
                        newArticle.creators.push(Zotero.Utilities.cleanAuthor(aus[i], "author"));
                }
                newArticle.complete();
        } else {

                // Dokument ist ein Urteil

                var gericht = '//meta/@Gericht';
                var ereignis =  '//meta/@Ereignis';
                var datum = '//meta/@Datum';
                var aktz = '//meta/@aktz';
                var titel =  '//meta/@Title';
                var webdok = '//meta/@WebDok';

                try{
                        var gericht = parseDoc(gericht,doc);
                        var ereignis = parseDoc(ereignis,doc);
                        var datum = parseDoc(datum,doc);
                        var aktz = parseDoc(aktz,doc);
                        var webdok = parseDoc(webdok,doc);
                        var titel = parseDoc(titel,doc);
                } catch (e) { var titel = doc.evaluate('//meta/@Titel', doc, null,XPathResult.ANY_TYPE, null).iterateNext().textContent;}
                //Zotero.debug(titel); 


                 // Informationen an Zotero übergeben

                var newCase = new Zotero.Item('case');
                 newCase.court = gericht;
                 newCase.caseName = titel;
                 newCase.title = titel;
                 newCase.shortTitle = "WebDok " + webdok;
                 newCase.dateDecided = ereignis + "  , " + aktz;
                 newCase.url = url;
                 newCase.journalAbbreviation = "JurPC";
                //Zotero.debug(newCase.codeNumber);
                newCase.complete();
	}
}

function parseDoc(xpath, doc) {
        var content = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE,null).iterateNext().textContent;
        return content;
}