{
	"translatorID":"9220fa99-b936-430e-a8ea-43ca6cb04145",
	"translatorType":4,
	"label":"AGU Journals",
	"creator":"Ben Parr",
	"target":"^https?://(?:www.)?agu.org",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-07-31 16:45:00"
}

function detectWeb(doc,url)
{
     var namespace = doc.documentElement.namespaceURI;
     var nsResolver = namespace ? function(prefix) {
     if (prefix == 'x') return namespace; else return null;
     } : null;

       var xpath;

       //abstract
       xpath='//p[@id="citation"]';
       if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
               { return "journalArticle"; }

       //full text
       xpath='//frameset[@rows="98, *"]';
       if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
               { return "journalArticle"; }

       //issue page
       xpath='//tr/td/p[@class="title"]';
       if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
               { return "multiple"; }

       //Search  Page
       if(doc.title.indexOf("Query Results")>-1)
               {return "multiple";}
}


function fixCaps(s)
{
       if(s!='')
       {
               words=Zotero.Utilities.cleanString(s).toLowerCase().split(" ");
               for (var j = 0 ; j < words.length ; j++)
               {
                       if (j==0||(words[j][0] ==words[j][0].toLowerCase()&&words[j]!="or"&&words[j]!="and"&&words[j]!="of"&&words[j]!="in"))
                               {   words[j]= words[j][0].toUpperCase() +words[j].substr(1);   }
               }
               return words.join(" ");
       }
       return '';
}

function scrape(doc,url)
{
       var namespace = doc.documentElement.namespaceURI;
       var nsResolver = namespace ? function(prefix) {
       if (prefix == 'x') return namespace; else return null;
       } : null;

       var newItem=new Zotero.Item("journalArticle");
       var temp;
       var xpath;
       var row;
       var rows;

       newItem.url = doc.location.href;

       xpath='//p[@id="title"]';
       temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext();
       if(temp)
               {newItem.title=temp.textContent;}

       xpath='//span[@id="published"]';
       temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext();
       if(temp)
       {
               temp=Zotero.Utilities.cleanString(temp.textContent).split(" ");;
               newItem.date=temp[1]+" "+temp[0]+", "+temp[2];
       }

       xpath='//p[@class="author"]';
       rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
       var count=0;
       while(row=rows.iterateNext())
               {newItem.creators.push(Zotero.Utilities.cleanAuthor(row.textContent,"author"));
               count++;}

       xpath='//tr/td/p';
       temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
       var temp2=temp.iterateNext();
       if(temp2)
       {
               for(var n=0;n<(3+2*count);n++)
                       {temp2=temp.iterateNext();}
               newItem.abstractNote=Zotero.Utilities.cleanString(temp2.textContent);
       }

       xpath='//p[@id="runhead"]';
       temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext();
       if(temp)
       {
               temp=Zotero.Utilities.cleanString(temp.textContent).split(", ");
               newItem.publicationTitle=fixCaps(temp[0]);
               for(var n=1;temp[n];n++)
               {
                       if(temp[n].indexOf("VOL")>-1)
                               {newItem.volume=temp[n].replace('VOL. ','');}
                       else if(temp[n].indexOf("NO.")>-1)
                               {newItem.issue=temp[n].replace('NO. ','');}
                       else if(temp[n].indexOf("doi:")>-1)
                               {newItem.DOI=temp[n].replace('doi:','');}
                       else if(temp[n+1])
                               {newItem.pages=temp[n];}
               }
       }

       xpath='//p[@id="keywords"]';
       temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext();
       if(temp)
       {
               temp=Zotero.Utilities.cleanString(temp.textContent.replace('Keywords:',''));
               newItem.tags=temp.replace('.','').split('; ');
       }
       xpath='//p[@id="citation"]/span[@id="journal"]';
       temp=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext();
       if(temp)
               {newItem.journalAbbreviation=temp.textContent;}

       newItem.complete();
}


function processList(items)
{
               items = Zotero.selectItems(items);
               var uris=new Array();

              if (!items)
                       {return true;}

              for (var i in items)
                       {uris.push(i);}

             Zotero.Utilities.processDocuments(uris, scrape,function() {Zotero.done(); });
             Zotero.wait();

             return true;
}

function doWeb(doc,url)
{
     var namespace = doc.documentElement.namespaceURI;
     var nsResolver = namespace ? function(prefix) {
     if (prefix == 'x') return namespace; else return null;
     } : null;

       //abstract
       var xpath='//p[@id="citation"]';
       if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
       {
               scrape(doc,url);
               return true;
       }

       //full text
       xpath='//frameset[@rows="98, *"]';
       if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
       {
               Zotero.Utilities.processDocuments(url+"0.shtml", scrape, function(){ Zotero.done(); });
               Zotero.wait();

               return true;
       }

       //issue page
       xpath='//tr/td/p[@class="title"]';
       if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext())
       {
               var titlerows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
               xpath='//tr/td/p[@class="pubdate"]/a';
               var linkrows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);

               var titlerow;
               var linkrow;
               var items=new Array();

               while(titlerow=titlerows.iterateNext())
               {
                       linkrow=linkrows.iterateNext();
                       while(linkrow.textContent.indexOf("Abstract")<0)
                               {linkrow=linkrows.iterateNext();}
                       items[linkrow.href]=titlerow.textContent;
               }

               return processList(items);
       }


       //Search page
       if(doc.title.indexOf("Query Results")>-1)
       {
               //FASTFind Search

               xpath='//tr/td/h2';
               var tt=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE,null).iterateNext().textContent;
               if(tt.indexOf("FASTFIND")>-1)
               {
                       xpath='//tr/td[1]/font';
                       var citerows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
                       xpath='//tr/td[2]/font/a';
                       var linkrows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);

                       var citerow;
                       var linkrow;
                       var items=new Array();
                       var temp;
                       var title;

                       while(citerow=citerows.iterateNext())
                       {
                               linkrow=linkrows.iterateNext();
                               items[linkrow.href]=Zotero.Utilities.cleanString(citerow.textContent);
                       }
                       return processList(items);
               }
               else
               {
                       //Advanced Search

                       xpath='//tr/td[1]/font/a';
                       var titlerows=doc.evaluate(xpath, doc,nsResolver,XPathResult.ANY_TYPE, null);
                       xpath='//tr/td[2]/font/a';
                       var linkrows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);

                       var titlerow;
                       var linkrow;
                       var items=new Array();
                       var temp;

                       while(titlerow=titlerows.iterateNext())
                       {
                               linkrow=linkrows.iterateNext();
                               while(linkrow.textContent.indexOf("Abstract")<0)
                                       {linkrow=linkrows.iterateNext();}

                               items[linkrow.href]=titlerow.textContent;
                       }
                       return processList(items);
               }
       }

}
