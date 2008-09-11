{
	"translatorID":"e4fe1596-a8c4-4d09-945f-120c4d83e580",
	"translatorType":4,
	"label":"LA Times",
	"creator":"Ben Parr",
	"target":"^https?://(?:www.|travel.)?latimes.com",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-07-31 16:45:00"
}

function detectWeb(doc, url)
{
   var namespace = doc.documentElement.namespaceURI;
               var nsResolver = namespace ? function(prefix) {
               if (prefix == 'x') return namespace; else return null;
               } : null;

              var xpath = '//link[@title="Main"]';
              if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext())
                      {return "newspaperArticle";}

              if(doc.title.indexOf("Search Results")>-1)
                      {return "multiple";}

              xpath = '//h1';
              var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
              var row;
              while(row=rows.iterateNext())
              {
		if(Zotero.Utilities.cleanString(row.textContent.toLowerCase())=="travel")
                              {return "newspaperArticle";}
              }

              return null;
}

function getCount(s)
{
      if(!s||s=='')
              return 0;
      if(s.indexOf("Displaying")>-1)
      {
              s=s.substr(19);
              s=s.replace('.','');
              s=s.split(' to ');
              return s[1]-s[0]+1;
      }
      return 0;
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

function findDate(s)
{
      var words=s.split(" ");
      var months=new Array("january","febuary","march","april","may","june","july","august","september","october","november","december");
      for(var n=0;words[n];n++)
      {
              for(var m in months)
                      {if(words[n].toLowerCase()==months[m])
                              {return words[n]+" "+words[n+1]+" "+words[n+2];}
                      }
      }
      return null;
}


function scrape(doc,url)
{
      var namespace = doc.documentElement.namespaceURI;
      var nsResolver = namespace ? function(prefix) {
              if (prefix == 'x') return namespace; else return null;
      } : null;

      var newItem = new Zotero.Item("newspaperArticle");
      newItem.publicationTitle = "The Los Angeles Times";
      newItem.ISSN = "0458-3035";

      var xpath='//h2/a';
      var t=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext();
      if(t)
              {newItem.section=t.textContent; }
      else
      {
              xpath='//a/img[@alt="WEST"]';
              if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext())
                      {newItem.section="West";}
              else
              {
                      xpath = '//h1';
                      var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
                      if(t=rows.iterateNext())
                              {newItem.section=t.textContent;}
              }
      }


      xpath='//h1[last()]';
      var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
      if(t=rows.iterateNext())
              {newItem.title=t.textContent;}

      newItem.url = url;
      xpath='//div[@class="storybyline"]';
      var test=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext();
      if(!test)
              {xpath='//p[@class="by-author"]';}
      var info=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext().textContent;
      info=Zotero.Utilities.cleanString(info);
      var date=findDate(info);
      if(date)
      {
              newItem.date=date;
              info=info.replace(date,'');
      }
      info=Zotero.Utilities.cleanString(info);
      if(info.indexOf(", ")>-1)
      {
              var phrases=info.split(", ");
              var a=phrases[0];
              if (a.substr(0,3).toLowerCase() == "by ")
                     {a= a.substr(3);}
              if(a.substr(0,5).toLowerCase()!="from ")
              {
                      var authors=a.split(" and ");
                      var n;
                      for(n in authors)
			{newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[n],"author"));}
              }
      }
      else
      {
              xpath='//div[@class="storydeckhead"]/a';
              temp=doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext();
              if(temp!=null && temp!='')
		{newItem.creators.push(Zotero.Utilities.cleanAuthor(temp.textContent,"author"));}
      }

      newItem.attachments.push({document:doc, title:"The Los Angeles Times Snapshot"});
      newItem.complete();
}



function doWeb(doc, url)
{
      var namespace = doc.documentElement.namespaceURI;
      var nsResolver = namespace ? function(prefix) {
              if (prefix == 'x') return namespace; else return null;
      } : null;


      var xpath='//link[@title="Main"]';
      if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext())
              {scrape(doc,url); return true;}

      xpath = '//h1';
      var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
      var row;
      while(row=rows.iterateNext())
      {
              if(Zotero.Utilities.cleanString(row.textContent.toLowerCase())=="travel")
                      {scrape(doc,url); return true;}
      }

      if(doc.title.indexOf("Search Results")>-1)
      {
              xpath='//div[@class="abstract1"]';
              var count=0;
              rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
              while(row=rows.iterateNext())
              {
                      count=getCount(row.textContent);
                      if(count!=0)
                              {break;}
              }
              if(count==0)
              {
                      xpath='//td[@class="abstract1"]';
                      rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
                      while(row=rows.iterateNext())
                      {
                              count=getCount(row.textContent);
                              if(count!=0)
                                      {break;}
                      }
              }

              if(count>0)
              {
                      var items=new Array();
                      xpath='//div[@class="headline14"]/a';
                      rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
                      while(row=rows.iterateNext())
                      {
                              if(count==0)
                                      {break;}
                              if(row.href.indexOf("/travel/")<0)
				{items[row.href]=Zotero.Utilities.cleanString(row.textContent);}
                              count--;
                      }

                      return processList(items);
              }
      }
}