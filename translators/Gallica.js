{
	"translatorID":"58ab2618-4a25-4b9b-83a7-80cd0259f896",
	"translatorType":4,
	"label":"Gallica",
	"creator":"Sylvain Machefert",
	"target":"^http://gallica\\.bnf\\.fr",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-10-06 08:55:00"
}

function detectWeb(doc, url) {
               var namespace = doc.documentElement.namespaceURI;
               var nsResolver = namespace ? function(prefix) {
                               if (prefix == 'x') return namespace; else return null;
               } : null;

               var indexSearch = url.toString().indexOf('http://gallica.bnf.fr/Search');
               var indexArk = url.toString().indexOf('http://gallica.bnf.fr/ark:');
               var indexSNE = url.toString().indexOf('http://gallica.bnf.fr/VisuSNE');

               if (indexSearch == 0)
								{
									var errorXpath = '//div[@class="errorMessage"]';
									if  (elt = doc.evaluate(errorXpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
										// We are on a search page result but it can be an empty result page.
										// Nothing to return;
									}
									else
									{
										return "multiple";
									}
               }
               else if (indexArk == 0)
               {
                       var iconxpath = '//div[@id="Infos"]/img';
                       if (elt = doc.evaluate(iconxpath, doc, nsResolver,
XPathResult.ANY_TYPE, null).iterateNext()) {
                               var icon = elt.getAttribute('src');
                               return getDoctypeGallica(icon);
                       }
                       
                       // For some biblio, the icon picture is located in another div ...
                       var iconxpath = '//div[@class="titrePeriodiqueGauche"]/img';
                       if  (elt = doc.evaluate(iconxpath, doc, nsResolver,
XPathResult.ANY_TYPE, null).iterateNext()) {
                               var icon = elt.getAttribute('src');
                               
                               return getDoctypeGallica(icon);
                       }
               }
               else if (indexSNE == 0)
               {
                       return "book";
               }
}

// This function takes the name of the icon, and returns the Zotero item name
function getDoctypeGallica(img)
{
	var iconname = img.substring(img.lastIndexOf('/') + 1);
	
	if ( (iconname =='doc_livre_ocr.png') || (iconname == 'doc_livre.png') ) 
	{
		return "book";
	}
	else if (iconname == 'doc_carte.png')
	{
		return "map";
	}
	else if (iconname == 'doc_image.png')
	{
		return "artwork";
	}
	else if ( (iconname == 'doc_periodique.png') || (iconname == 'doc_perio_vol_ocr.png') )
	{
		return "book";
	}
	else
	{
		Zotero.debug("Undefined icon : " + iconname);
		return "book";
	}
	
}

function doWeb(doc, url) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
				if (prefix == 'x') return namespace; else return null;
		} : null;
		
		if (detectWeb(doc, url) == "multiple") 
		{
			var availableItems = new Array();
			var xpath = '//td[@class="ResultatsRechercheInfos"]/a';
			
			var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var elmt = elmts.iterateNext();
			
			var itemsId = new Array();
			
			var i = 0;
			do {
				var id = doc.evaluate('../../..//a[@id]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				// This id looks like  idN00000. We need the information after id to get the informations about 
				// the title. We need to store it in an array, we leave the starting id.
				var cleanId = id.getAttribute('id').substring(2);
				itemsId[i] = cleanId;

				var searchTitle = elmt.textContent;
				availableItems[i] = searchTitle;
				
				i++;
			} while (elmt = elmts.iterateNext());
			
			var items = Zotero.selectItems(availableItems);
			
			for (var i in items) {
				// All informations are available on search result page. We don't need to query 
				// every subpage with scrape. We'are going to call the special Gallica scrape function
				// This function (scrapeGallica) is reused in scrape. 
				var fullpath = '//div[@id="noticeComplete' + itemsId[i] + '"]/div';
				var detail = doc.evaluate(fullpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				Zotero.debug(itemsId[i]);
				var iconType = doc.evaluate('//a[@id="id' + itemsId[i] + '"]/..//span[@class="typedoc"]/img', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				var docType = getDoctypeGallica(iconType.getAttribute('src'));
				Zotero.debug( itemsId[i]);
				scrapeGallica(doc, nsResolver, detail, docType);
			}
		}
		else
		{
			var docType = detectWeb(doc, url);
			var xpath = '//div[@id="Popup1"]/div[@class="data"]';
			var detail = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			scrapeGallica(doc, nsResolver, detail, docType);
		}
}

function scrapeGallica(doc, nsResolver, div, type)
{
	var item = new Zotero.Item;
	item.itemType = type;
	
	var elmts = doc.evaluate('p', div, nsResolver, XPathResult.ANY_TYPE, null);
	
	var elmt = elmts.iterateNext();

	do {
		var text = Zotero.Utilities.trimInternal(elmt.textContent);
		var contenu = '';
		if (contenu = text.split(/^(Titre|Title|Título) : /)[2])
		{
			item.title = Zotero.Utilities.trimInternal(contenu);
		}
		else if ( contenu = text.split(/^(Auteur|Author|Autor) : /)[2])
		{
			contenu = contenu.replace(/(See only the results matching this author|Ne voir que les résultats de cet auteur)/, '');
			if (type == 'artwork')
			{
				 item.creators.push(Zotero.Utilities.cleanAuthor(contenu, "artist", true));	
			}
			else
			{
				item.creators.push(Zotero.Utilities.cleanAuthor(contenu, "author", true));	
			}
		}
		else if ( contenu = text.split(/^(Publisher|Éditeur|Editor) : /)[2])
		{
			item.publisher = Zotero.Utilities.trimInternal(contenu);
		}
		else if ( contenu = text.split(/^(Date of publication|Date d'édition|Data de publicação|Fecha de publicación) : /)[2])
		{
			item.date = Zotero.Utilities.trimInternal(contenu);
		}
		else if ( contenu = text.split(/^(Contributeur|Contributor|Contribuidor) : /)[2])
		{
			item.creators.push(Zotero.Utilities.cleanAuthor(contenu, "contributor", true));
		}
		else if ( contenu = text.split(/^(Language|Langue|Língua|Idioma) : /)[2])
		{
			item.language = Zotero.Utilities.trimInternal(contenu);
		}
		else if ( contenu = text.split(/^(Format|Formato) : /)[2])
		{
			// This field contains : application/pdf for example.
		}
		else if ( contenu = text.split(/^(Copyright|Droits|Direitos) : /)[2])
		{
			item.rights = Zotero.Utilities.trimInternal(contenu);
		}
		else if (contenu = text.split(/^(Identifier|Identifiant|Senha) : /)[2])
		{
			var temp = '';
			if (temp = contenu.split(/^ISSN /)[1])
			{
				item.ISSN = temp;	
			}
			else if (contenu.match(/^http:\/\//))
			{
				// If identifier starts with http it is the url of the document
				item.url = contenu;
			}
			else if (contenu.match(/^ark:/))
			{
				item.url = "http://gallica.bnf.fr/" + contenu;
			}
		}
		else if (contenu = text.split(/^(Description|Descrição) : /)[2])
		{
			var temp = '';
			if (temp = contenu.split(/^Variante\(s\) de titre : /)[1])
			{
		// Alternative title : no field in zotero ? 
		//		Zotero.debug("Titre : " + temp);
			}
			else if (temp = contenu.split(/^Collection : /)[1])
			{
				item.collection = temp;
			}
			else
			{
//				Zotero.debug(contenu);
			}
		}
		else if (contenu = text.split(/^(Sujet|Assunto|Tema|Subject) : /)[2])
		{
			
			var tagList = contenu.split(/; ?/);
			for (var tag in tagList) 
			{
				item.tags.push(Zotero.Utilities.trimInternal(tagList[tag]));
			}
		}

	} while (elmt = elmts.iterateNext());
		
	if ( (item.url == "") || (item.url == undefined) )
	{
		item.url = doc.location.href; 
	}
	item.complete();
}
