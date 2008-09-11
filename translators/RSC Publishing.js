{
	"translatorID":"1c34744d-690f-4cac-b31b-b7f0c90ac14d",
	"translatorType":4,
	"label":"RSC Publishing",
	"creator":"Ramesh Srigiriraju",
	"target":"http://(:?www\\.|google\\.)?rsc\\.org/",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-12-21 16:00:00"
}

function detectWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var journalreg=new RegExp("http://(:?www\.)?rsc\.org/(:?P|p)ublishing/(:?J|j)ournals");
	if(journalreg.test(url))	{
		var browspath='//div/p/a[text()="Use advanced search"]';
		if(doc.evaluate(browspath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
			return "multiple";
		var searchpath='//a[text()="Back to Search Form"]';
		if(doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
			return "multiple";
		var singpath='//ul/li/a[text()="HTML Article" or text()="PDF"]';
		if(doc.evaluate(singpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
			return "journalArticle";
	}
	var magpath='//div/h3[text()="Link to journal article"]';
	if(doc.evaluate(magpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
		return "magazineArticle";
	var magbrows='//div/h4[@class="newstitle"]/a';
	if(doc.evaluate(magbrows, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
		return "multiple";
	var magsearch='//p[@class="more"]/strong/a[text()="Search RSC journals"]';
	if(doc.evaluate(magsearch, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
		return "multiple";
	var bookreg=new RegExp("http://(:?www\.)?rsc\.org/(:?P|p)ublishing/e(:?B|b)ooks");
	if(bookreg.test(url))	{
		var pagepath='//title/text()';
		var page=doc.evaluate(pagepath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
		if((page=="Books in a publication year")||(page=="Subject Area Books")||(page=="A - Z Index")
			||(page=="Book Series"))
				return "multiple";
		var chappath='//dt/img[@alt="Chapter"]';
		var singpath='//h3[text()="Table of Contents"]';
		if(doc.evaluate(chappath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
			return "bookSection";
		else if(doc.evaluate(singpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
			return "book";
	}
	var searchpath='//div/p[@class="title"][text()="Search Results"]';
	if(doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
		return "multiple";
}

function doChap(newItem, chaptext)	{
	var chapdata=chaptext.split("<br>");
	for(var pos=chapdata.length-2; pos>=0; pos--)	{
		chapdata[pos]=Zotero.Utilities.cleanTags(chapdata[pos]);
		if(chapdata[pos].indexOf("Editors")!=-1)	{
			var editors=chapdata[pos].split(",");
			for(var i=0; i<=editors.length-1; i++)	{
				editors[i]=Zotero.Utilities.cleanString(editors[i]);
				var names=editors[i].split(" ");
				var creators=new Array();
				if(i==0)
					creators.firstName=names[1];
				else
					creators.firstName=names[0];
				creators.lastName=names[names.length-1];
				creators.creatorType="editor";
				newItem.creators.push(creators);
			}
		}
		if(chapdata[pos].indexOf("Authors")!=-1)	{
			var authors=chapdata[pos].split(",");
			for(var i=0; i<=authors.length-1; i++)	{
				authors[i]=Zotero.Utilities.cleanString(authors[i]);
				var names=authors[i].split(" ");
				var creators=new Array();
				if(i==0)
					creators.firstName=names[1];
				else
					creators.firstName=names[0];
				creators.lastName=names[names.length-1];
				creators.creatorType="editor";
				newItem.creators.push(creators);
			}
		}
		if(chapdata[pos].indexOf("DOI")!=-1)
			newItem.itemID=chapdata[pos].substring(chapdata[pos].indexOf("1"));
		if(chapdata[pos].indexOf("Book")!=-1)
			newItem.bookTitle=chapdata[pos].substring(chapdata[pos].indexOf(" ")+1);
	}
}
function doBook(newItem, bookdata)	{
	var fields=bookdata.split("<br>");
	for(var pos=fields.length-2; pos>=0; pos--)	{
		fields[pos]=Zotero.Utilities.cleanTags(fields[pos]);
		if(fields[pos].indexOf("Volume")!=-1)	{
			var i=fields[pos].lastIndexOf(";");
			var vol;
			if(i!=-1)
				vol=fields[pos].substring(i+1);
			else
				vol=fields[pos].substring(fields[pos].lastIndexOf(" "));
			newItem.volume=Zotero.Utilities.cleanString(vol);
		}
		if(fields[pos].indexOf("Edition")!=-1)	{
			var i=fields[pos].lastIndexOf(";");
			if(i!=-1)
				ed=fields[pos].substring(i+1);
			else
				ed=fields[pos].substring(fields[pos].lastIndexOf(" "));
			newItem.edition=Zotero.Utilities.cleanString(ed);
		}
		if(fields[pos].indexOf("Copyright")!=-1)	{
			var i=fields[pos].lastIndexOf(";");
			var date;
			if(i!=-1)
				date=fields[pos].substring(i+1);
			else
				date=fields[pos].substring(fields[pos].indexOf(":")+2);
			newItem.date=Zotero.Utilities.cleanString(date);
		}
		if(fields[pos].indexOf("ISBN")!=-1&&fields[pos].indexOf("print")!=-1)	{
			var i=fields[pos].lastIndexOf(";");
			var isbn;
			if(i!=-1)
				isbn=fields[pos].substring(i+1);
			else
				isbn=fields[pos].substring(fields[pos].indexOf(":")+2);
			newItem.ISBN=Zotero.Utilities.cleanString(isbn);
		}
		if(fields[pos].indexOf("Author")!=-1||fields[pos].indexOf("Editor")!=-1)	{
			var authors=fields[pos].split(",");
			for(var i=0; i<=authors.length-1; i++)	{
				authors[i]=Zotero.Utilities.cleanString(authors[i]);
				var names=authors[i].split(" ");
				var creators=new Array();
				creators.firstName=names[0];
				creators.lastName=names[names.length-2];
				if(names[names.length-1]=="(Editor)")
					creators.creatorType="editor";
				if(names[names.length-1]=="(Author)")
					creators.creatorType="author";
				newItem.creators.push(creators);
			}
		}
		if(fields[pos].indexOf("DOI:")!=-1)
			newItem.itemID=fields[pos].substring(fields[pos].indexOf("1"));
	}
}
function doWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var journalreg=new RegExp("http://(:?www\.)?rsc\.org/(:?P|p)ublishing/(:?J|j)ournals");
	if(journalreg.test(url))	{
		var browspath='//div/p/a[text()="Use advanced search"]';
		if(doc.evaluate(browspath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
			var doipath='//p[strong/text()="DOI:"]/a/text()';
			var dois=doc.evaluate(doipath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var titlpath='//p/strong/a';
			var titles=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var items=new Array();
			var doi;
			while(doi=dois.iterateNext())
				items[doi.nodeValue]=Zotero.Utilities.cleanString(titles.iterateNext().textContent);
			items=Zotero.selectItems(items);
			var string="http://www.rsc.org/delivery/_ArticleLinking/refdownload.asp?";
			for(var codes in items)	{
				var string="http://www.rsc.org/delivery/_ArticleLinking/refdownload.asp?ManuscriptID=";
				string+=codes.substring(codes.indexOf("/")+1)+"&type=refman";
				Zotero.Utilities.HTTP.doGet(string, function(text)	{
					var trans=Zotero.loadTranslator("import");
					trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
					// fix bad Y1 tags, which have wrong spacing and typically terminate with "///"
					text = text.replace("Y1 -  ", "Y1  - ");
					trans.setString(text);
					trans.translate();
					Zotero.done();	
				});
			}
		}
		var searchpath='//a[text()="Back to Search Form"]';
		if(doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
			var doipath='//p[strong/text()="DOI:"]/a/text()';
			var dois=doc.evaluate(doipath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var titlpath='//form/div/h5';
			var titles=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var title;
			var items=new Array();
			while(title=titles.iterateNext())
				items[dois.iterateNext().nodeValue]=title.textContent;
			items=Zotero.selectItems(items);
			var string="http://www.rsc.org/delivery/_ArticleLinking/refdownload.asp?";
			for(var codes in items)	{
				var string="http://www.rsc.org/delivery/_ArticleLinking/refdownload.asp?ManuscriptID=";
				string+=codes.substring(codes.indexOf("/")+1)+"&type=refman";
				Zotero.Utilities.HTTP.doGet(string, function(text)	{
					var trans=Zotero.loadTranslator("import");
					trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
					// fix bad Y1 tags, which have wrong spacing and typically terminate with "///"
					text = text.replace("Y1 -  ", "Y1  - ");
					trans.setString(text);
					trans.translate();
					Zotero.done();
				});
			}
		}
		var singpath='//ul/li/a[text()="HTML Article" or text()="PDF"]';
		if(doc.evaluate(singpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
			var doipath='//div/p[strong/text()="DOI:"]';
			var text=doc.evaluate(doipath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var doi=text.substring(text.indexOf("/")+1);
			var string="http://www.rsc.org/delivery/_ArticleLinking/refdownload.asp?ManuscriptID="+doi;
			string+="&type=refman";
			Zotero.Utilities.HTTP.doGet(string, function(text)	{
				var trans=Zotero.loadTranslator("import");
				trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				// fix bad Y1 tags, which have wrong spacing and typically terminate with "///"
				text = text.replace("Y1 -  ", "Y1  - ");				
				trans.setString(text);
				trans.setHandler("itemDone", function(obj, newItem)	{
					var url2=newItem.url;
					var stringy;
					var archpath='//div[h3/text()="Journals archive purchaser access"]';
					if(doc.evaluate(archpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
						var stringy="http://www.rsc.org/ejarchive/";
						stringy+=url2.substring(url2.lastIndexOf("/")+1)+".pdf";
						newItem.attachments.push({url:stringy, title:"RSC PDF", mimeType:"application/pdf"});
					}
					else	{
						var stringy="http://www.rsc.org/delivery/_ArticleLinking/DisplayArticleForFree.cfm?doi=";
						stringy+=url2.substring(url2.lastIndexOf("/")+1);
						newItem.attachments.push({url:stringy, title:"RSC PDF", mimeType:"application/pdf"});
					}
					newItem.complete();
				});
				trans.translate();
				Zotero.done();
			});
		}
	}
	var magpath='//div/h3[text()="Link to journal article"]';
	if(doc.evaluate(magpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
		var newItem=new Zotero.Item("magazineArticle");
		var titlpath='//div/h2/div[@class="header"]/text()';
		newItem.title=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
		var authpath='//em/text()';
		var auth=doc.evaluate(authpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
		var authors=auth.split(",");
		if(newItem.title.indexOf("Interview")==-1)
			for(var i=0; i<=authors.length-1; i++)	{
				authors[i]=Zotero.Utilities.cleanString(authors[i]);
				var names=authors[i].split(" ");
				var creator=new Array();
				creator.firstName=names[0];
				creator.lastName=names[names.length-1];
				newItem.creators.push(creator);
			}
		var textpath='//div[@id="content"]//text()';
		var text=doc.evaluate(textpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var temp;
		while(temp=text.iterateNext())
			if(temp.nodeValue==newItem.title)	{
				newItem.date=text.iterateNext().nodeValue;
				break;
			}
		var datapath= '//div[@id="breadcrumbs"]/ul/li/a/text()';
		var data=doc.evaluate(datapath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var prev;
		while(temp=data.iterateNext())	{
			if(temp.nodeValue.indexOf("Chemi")!=-1)
				newItem.publication=temp.nodeValue;
			prev=temp;
		}
		newItem.issue=prev.nodeValue;
		newItem.complete();
	}
	var magbrows='//div/h4[@class="newstitle"]/a';
	if(doc.evaluate(magbrows, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
		var titlpath='//h4[@class="newstitle"]/a';
		var titles=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var title;
		var items=new Array();
		while(title=titles.iterateNext())
			items[title.href]=title.textContent;
		items=Zotero.selectItems(items);
		for(var linx in items)	{
			var newItem=new Zotero.Item("magazineArticle");
			newItem.url=linx;
			newItem.title=items[linx];
			var datepath='//div[h4/a/text()="'+items[linx]+'"]/h4[@class="datetext"]/text()';
			newItem.date=doc.evaluate(datepath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			var datapath= '//div[@id="breadcrumbs"]/ul/li/a/text()';
			var data=doc.evaluate(datapath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var prev;
			var temp;
			while(temp=data.iterateNext())	{
				if(temp.nodeValue.indexOf("Chemi")!=-1)
					newItem.publication=temp.nodeValue;
				prev=temp;
			}
			if(prev.nodeValue!=newItem.publication)
				newItem.issue=prev.nodeValue;
			newItem.complete();
		}
	}
	var magsearch='//p[@class="more"]/strong/a[text()="Search RSC journals"]';
	if(doc.evaluate(magsearch, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
		var titlpath='//div/p/a';
		var titles=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		titlpath='//blockquote/p/a[span/@class="l"]';
		var titles2=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null)
		var title;
		var items=new Array();
		while(title=titles.iterateNext())
			items[title.href]=title.textContent;
		while(title=titles2.iterateNext())
			items[title.href]=title.textContent;
		items=Zotero.selectItems(items);
		for(var linx in items)	{
			var newItem=new Zotero.Item("magazineArticle");
			newItem.url=linx;
			newItem.title=items[linx];
			newItem.complete();
		}
	}
	var bookreg=new RegExp("http://(:?www\.)?rsc\.org/(:?P|p)ublishing/e(:?B|b)ooks");
	if(bookreg.test(url))	{
		var browspath='//title/text()';
		var page=doc.evaluate(browspath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
		if((page=="Books in a publication year")||(page=="Subject Area Books")||(page=="A - Z Index")
			||(page=="Book Series"))	{
			var doipath='//dd/p/a/text()';
			var dois=doc.evaluate(doipath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var items=new Array();
			var title;
			while(title=dois.iterateNext())	{
				var doi=dois.iterateNext().nodeValue;
				items[doi.substring(doi.indexOf("1"))]=title.nodeValue;
			}
			items=Zotero.selectItems(items);
			for(var codes in items)	{
				var newItem=new Zotero.Item("book");
				newItem.itemID=codes;
				newItem.title=items[codes];
				var itempath='//dd/p[contains(a[2]/text(), "'+codes+'")]';
				var itempath2='//dd/p[contains(a/text(), "'+codes+'")]';
				var data;
				if(data=doc.evaluate(itempath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
					data=data.innerHTML;
				else if(data=doc.evaluate(itempath2, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
					data=data.innerHTML;
				doBook(newItem, data);
				newItem.complete();
			}	
		}
		var chappath='//dt/img[@alt="Chapter"]';
		var singpath='//h3[text()="Table of Contents"]';
		if(doc.evaluate(chappath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
			var newItem=new Zotero.Item("bookSection");
			var titlpath='//span/h3/text()';
			var titles=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			newItem.title=titles.iterateNext().nodeValue;
			newItem.bookTitle=titles.iterateNext().nodeValue;
			var datapath='//dd/p';
			var entries=doc.evaluate(datapath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var chaptext=entries.iterateNext().innerHTML;
			doChap(newItem, chaptext);
			var bookdata=entries.iterateNext().innerHTML;
			doBook(newItem, bookdata);
			var linkpath='//td[1][@class="td1"]/a[1]';
			var linx=doc.evaluate(linkpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var pdflink;
			while(pdflink=linx.iterateNext())
				newItem.attachments.push({url:pdflink.href, title:"RCS PDF", mimeType:"application/pdf"});
			newItem.complete();
		}
		else if(doc.evaluate(singpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
			var newItem=new Zotero.Item("book");
			var itempath='//dd/p';
			var data=doc.evaluate(itempath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().innerHTML;
			doBook(newItem, data);
			var titlpath='//div/h2/text()';
			newItem.title=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			var linkpath='//td[1][@class="td1"]/a[1]';
			var linx=doc.evaluate(linkpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var pdflink;
			while(pdflink=linx.iterateNext())
				newItem.attachments.push({url:pdflink.href, title:"RCS PDF", mimeType:"application/pdf"});
			newItem.complete();
		}
	}
	var searchpath='//div/p[@class="title"][text()="Search Results"]';
	if(doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
		var doipath='//dd/p/a/text()';
		var dois=doc.evaluate(doipath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var title;
		var items=new Array();
		while(title=dois.iterateNext())	{
			var doi=dois.iterateNext().nodeValue;
			items[doi.substring(doi.indexOf("1"))]=title.nodeValue;
		}
		items=Zotero.selectItems(items);
		for(var codes in items)	{
			var itempath='//dd/p[contains(a/text(), "'+codes+'")]';
			var newpath='//dd[contains(p[2]/a/text(), "'+codes+'")]/p[1]/strong/text()';
			var data=doc.evaluate(itempath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().innerHTML;
			if(data.indexOf("Book:")!=-1)	{
				var newItem=new Zotero.Item("bookSection");
				newItem.itemID=codes;
				newItem.title=items[codes];
				doChap(newItem, data);
				newItem.complete();
			}
			else		{
				var newItem=new Zotero.Item("book");
				var newdata=doc.evaluate(newpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
				if(newdata.indexOf("Volume")!=-1)
					newItem.volume=newdata.substring(newdata.lastIndexOf(" ")+1);
				else
					newItem.series=newdata;
				newItem.itemID=codes;
				newItem.title=items[codes];
				doBook(newItem, data);
				newItem.complete();
			}
		}
	}
	Zotero.wait();
}