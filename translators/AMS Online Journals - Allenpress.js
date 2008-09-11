{
	"translatorID":"dbb5d4bc-3b21-47a2-9751-5dcbb65b902a",
	"translatorType":4,
	"label":"AMS Online Journals - Allenpress",
	"creator":"Ben Parr",
	"target":"^http://ams.allenpress.com/",
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
      	
	//Homepage=AMS Top 20
	var temp=url.split("request=")[1];
	if(temp)
	{
		if(temp.substr(0,10)=="index-html")
		{ return "multiple"; }
	}
	
	
	//browse page
	xpath='//div[@class="group"]/p[@class="title"]';
	if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
		{ return "multiple"; }
		
	//second browse page format
	xpath='//div[@class="toc include j"]/p/span[@class="title"]';
	if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
		{ return "multiple"; }
	
		
	//search page 
	xpath='//td[@class="search"]/span[@class="title"]';
	if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
		{ return "multiple"; }
		
	//single page
	xpath='//ul/li/a';
	var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
	var row;
	
	while(row=rows.iterateNext())
	{
		if(row.textContent=="Create Reference")
			{ return "journalArticle"; }
	}
	
}

function parseRIS(temp,PDFs)
{
      Zotero.Utilities.HTTP.doGet(temp, function(text){

              // load translator for RIS
              var translator = Zotero.loadTranslator("import");
	      
              translator.setHandler("itemDone", function(obj, newItem) {
		//get doi of the item we're currently saving from RIS file
		var doi=newItem.DOI;
		if(!doi)
			{doi=newItem.url.replace('http://dx.doi.org/','');}
		else
			{doi=doi.replace("doi%3A","");}
		
		var urlstring='';
		var volume=newItem.volume;
		var issue=newItem.issue;
		var d=newItem.pages.split("-")[0];
		
		var pdf = PDFs.shift();
		if(pdf)
		{
			if(pdf=="0")
			{
				var b=doi.split("/");
				if(b.length>1)
					{b=b[1];}
				else
					{b=doi.split("%2F")[1];}
				b=b.split("(")[0];
				b=b.split("%28")[0];
				if(!b||b.length!=9)
					{b="1520-0477";}
				urlstring="http://ams.allenpress.com/archive/"+b+"/"+volume+"/"+issue+"/pdf/i"+b+"-"+volume+"-"+issue+"-"+d+".pdf";
			}
			else if(pdf=="1")
			{
				while(volume.length<3)
					{volume="0"+volume;}
				while(issue.length<2)
					{issue="0"+issue;}
				while(d.length<4)
					{d="0"+d;}
				
				urlstring="http://docs.lib.noaa.gov/rescue/mwr/"+volume+"/mwr-"+volume+"-"+issue+"-"+d+".pdf";
			}
		}
		newItem.attachments[0]={
				title:"AMS Journals Full Text PDF",
				url:urlstring, mimeType:"application/pdf"}
		
		if(Zotero.Utilities.cleanString(newItem.abstractNote).toLowerCase()=="no abstract available.")
			{newItem.abstractNote='';}
		newItem.complete();
		});
		
              translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
              translator.setString(text);
              translator.translate();

              Zotero.done();
      }, function() {});
      Zotero.wait();
}


function createLink(link)
{
	var url="http://ams.allenpress.com/perlserv/?request=download-citation&t=refman&doi=";
	url+=getdoi(link);
	url+="&site=amsonline";
	return url;
}

function getdoi(link)
{
	doi=link.split("doi%3A")[1];
	if(!doi)
	{
		doi=link.split("doi=")[1];
		return doi;
	}
	return doi;
}

function getType(text)
{
	if(text.indexOf("(")>-1)
		{return "0";}
	else
		{return "1";}
}

function doWeb(doc,url)
{
      var namespace = doc.documentElement.namespaceURI;
      var nsResolver = namespace ? function(prefix) {
      if (prefix == 'x') return namespace; else return null;
      } : null;

        var doi;
        var PDFs=new Array();
	var xpath='//ul/li/a';
	var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
	var row;
	
	while(row=rows.iterateNext())
	{
		if(row.textContent=="Create Reference")
		{
				//single page
				
				var thelink=createLink(row.href);
				xpath='//div[@class="mainPadding"]/div/div/div/div/div/p/a';
				rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
				while(row=rows.iterateNext())
				{
					if(row.textContent.toLowerCase().indexOf("pdf")>-1)
						{PDFs.push(getType(row.textContent));}
				}
				parseRIS(thelink,PDFs);
				
				return null;
		}
	}
	
	var items=new Array();
	
	xpath='//div[@class="group"]/p[@class="title"]';
	var xpath1='';
	var xpath2='';
	
	if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
	{
		//browse page
		
		xpath1='//div[@class="group"]/p[@class="title"]';
		xpath2='//p[@class="link"]/a';
	}
	else
	{
		xpath='//td[@class="search"]/span[@class="title"]';
		if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
		{
			//search page
			
			xpath1='//td[@class="search"]/span[@class="title"]';
			xpath2='//tr/td/a';
		}
		else
		{
			xpath='//div[@class="toc include j"]/p/span[@class="title"]';
			if(doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext())
			{
				//second browse format
				
				xpath1='//div[@class="toc include j"]/p/span[@class="title"]';
				xpath2='//div[@class="toc include j"]/p/a';
			}
		}
	}
	
	if(xpath1!='')
	{
		var rows1=doc.evaluate(xpath1, doc, nsResolver,XPathResult.ANY_TYPE, null);
		var row1;
		
		var rows2=doc.evaluate(xpath2, doc, nsResolver,XPathResult.ANY_TYPE, null);
		var row2=rows2.iterateNext();
		
		var rows3=doc.evaluate(xpath2, doc, nsResolver,XPathResult.ANY_TYPE, null);
		var row3;
		
		var tPDFs=new Array();
		var nextType;
		
		var link;
		var lastdoi;
		
		while(row1=rows1.iterateNext())
		{
			while(row3=rows3.iterateNext())
			{
				if(row3.textContent.toLowerCase().indexOf("pdf")>-1)
					{tPDFs.push(getType(row3.textContent));}
			}
			while(getdoi(row2.href)==lastdoi || !getdoi(row2.href))
				{row2=rows2.iterateNext()}
			
			lastdoi=getdoi(row2.href);
			link=createLink(row2.href);
			
			nextType=tPDFs.shift();
			if(!nextType)
				{nextType="none";}
			items[nextType+link]=row1.textContent;
		}
	}
	else
	{
		var t=url.split("request=")[1];
		if(t)
		{
			if(t.substr(0,10)=="index-html")
			{
				//Homepage=AMS Top 20
				
				xpath='//div/p/a[@style="font-size: 85%;"]';
				var rows=doc.evaluate(xpath, doc, nsResolver,XPathResult.ANY_TYPE, null);
				var row;
	
				while(row=rows.iterateNext())
					{items["0"+createLink(row.href)]=row.textContent;}
			}
	
		}
	}
		
		items = Zotero.selectItems(items);
				
		if(!items)
			{return true;}
		
		var urls = new Array();
		for(var i in items)
		{
			PDFs.push(i[0]);
			urls.push(i.substr(1));
		}
		
		parseRIS(urls,PDFs);
}