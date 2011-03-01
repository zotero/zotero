{
	"translatorID":"47533cd7-ccaa-47a7-81bb-71c45e68a74d",
	"label":"Bibliothèque nationale de France",
	"creator":"Florian Ziche",
	"target":"^https?://[^/]*catalogue\\.bnf\\.fr",
	"minVersion":"2.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"translatorType":4,
	"lastUpdated":"2011-02-22 09:55:00"
}

/*
 *  Bibliothèque nationale de France Translator
 *  Copyright (C) 2010 Florian Ziche, ziche@noos.fr
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/


/* Bnf namespace. */
var BnfClass = function() {
	//Private members
	
	/* MARC translator. */
	var marc;

	var that = this;

	/* Load MARC translator. */
	function loadMarcTranslator() {
		if(!marc) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
			marc = translator.getTranslatorObject();
		}
		return marc;
	};

	/* Map MARC responsibility roles to Zotero creator types.
		See http://archive.ifla.org/VI/3/p1996-1/appx-c.htm.
	*/
	function getCreatorType(aut) {
		switch(aut['4']) {
		case "005":
		case "250":
		case "275":
		case "590":	//performer
		case "755":	//vocalist
			return "performer";
		case "040":
		case "130":	//book designer
		case "740":	//type designer
		case "750":	//typographer
		case "350":	//engraver
		case "360":	//etcher
		case "430":	//illuminator
		case "440":	//illustrator
		case "510":	//lithographer
		case "530":	//metal engraver
		case "600":	//photographer
		case "705":	//sculptor
		case "760":	//wood engraver
			return "artist";
		case "070":
		case "305":
		case "330":
		case undefined:
			return "author";
		case "020":
		case "210":
		case "212":
			return "commenter";
		case "180":
			return "cartographer";
		case "220":
		case "340":
			return "editor";
		case "230":
			return "composer";
		case "245":
			return "inventor";
		case "255":
		case "695":	//scientific advisor
		case "727":	//thesis advisor
			return "counsel";
		case "300":
			return "director";
		case "400":	//funder
		case "723":	//sponsor
			return "sponsor";
		case "460":
			return "interviewee";
		case "470":
			return "interviewer";
		case "480":	//librettist
		case "520":    //lyricist
			return "wordsBy";
		case "605":
			return "presenter";
		case "630":
			return "producer";
		case "635":
			return "programmer";
		case "660":
			return "recipient";
		case "090":	//author of dialog
		case "690":	//scenarist
			return "scriptwriter";
		case "730":
			return "translator";
		//Ignore (no matching Zotero creatorType):
		case "320":	//donor
		case "610":	//printer
		case "650":	//publisher
			return undefined;
		//Default
		case "205":
		default:
			return "contributor";
		}
	};

	/* Fix creators (MARC translator is not perfect). */
	function getCreators(record, item) {
		//Clear creators
		item.creators = new Array();
			// Extract creators (700, 701 & 702)
		for (var i = 700; i < 703; i++)  {
			var authorTag = record.getFieldSubfields(i);
				for (var j in authorTag) {
				var aut = authorTag[j];
				var authorText = "";
				if (aut.b)  {
					authorText = aut['a'] + ", " + aut['b'];
				}  else  {
					authorText = aut['a'];
				}
				var type = getCreatorType(aut);
				if(type) {
					item.creators.push(Zotero.Utilities.cleanAuthor(authorText, type, true));
				}
			}
		}
			// Extract corporate creators (710, 711 & 712)
		for (var i = 710; i < 713; i++)  {
			var authorTag = record.getFieldSubfields(i);
			for (var j in authorTag)  {
				if (authorTag[j]['a'])  {
					var type = getCreatorType(authorTag[j]);
					if(type) {
						item.creators.push({
							lastName: authorTag[j]['a'], 
							creatorType: type, 
							fieldMode: true});
					}
				}
			}
		}
	};


	//Translate BnF types to Zotero item types.
	function getItemType(type) {
		switch(type) {
		case "Enregistrement sonore":
			return "audioRecording";
		case "Image fixe":
		case "Image fixe numérisée":
			return "artwork";
		case "Images animées":
			return "film";
		case "Ressource électronique":
			return "computerProgram";
		case "Document cartographique":
			return "map";
		case "Document d'archives":
			return "document";
		case "Texte manuscrit":
			return "manuscript";
		case "Multimédia multisupport":
		case "Musique imprimé":
		case "Texte imprimé":
		default:
			return "book";	
		}	
	};

	//Add tag, if not present yet
	function addTag(item, tag) {
		for(var t in item.tags) {
			if(item.tags[t] == tag) {
				return;
			}
		}
		item.tags.push(tag);
	};

	//Tagging
	function getTags(record, item) {
		var pTag = record.getFieldSubfields("600");
		if(pTag) {
			for(var j in pTag) {
				var tagText = false;
				var person = pTag[j];
				tagText = person.a;
				if(person.b) {
					tagText += ", " + person.b;
				}
				if(person.f) {
					tagText += " (" + person.f + ")";
				}
				addTag(item, tagText);
			}
		}
		pTag = record.getFieldSubfields("601");
		if(pTag) {
			for(var j in pTag) {
				var tagText = false;
				var person = pTag[j];
				tagText = person.a;
				addTag(item, tagText);
			}
		}
		pTag = record.getFieldSubfields("605");
		if(pTag) {
			for(var j in pTag) {
				var tagText = false;
				var person = pTag[j];
				tagText = person.a;
				addTag(item, tagText);
			}
		}
		pTag = record.getFieldSubfields("606");
		if(pTag) {
			for(var j in pTag) {
				var tagText = false;
				var person = pTag[j];
				tagText = person.a;
				addTag(item, tagText);
			}
		}
		pTag = record.getFieldSubfields("607");
		if(pTag) {
			for(var j in pTag) {
				var tagText = false;
				var person = pTag[j];
				tagText = person.a;
				addTag(item, tagText);
			}
		}
		pTag = record.getFieldSubfields("602");
		if(pTag) {
			for(var j in pTag) {
				var tagText = false;
				var person = pTag[j];
				tagText = person.a;
				if(person.f) {
					tagText += " (" + person.f + ")";
				}
				addTag(item, tagText);
			}       
		}
		pTag = record.getFieldSubfields("604");
		if(pTag) {
			for(var j in pTag) {
				var tagText = false;
				var person = pTag[j];
				tagText = person.a;
				if(person.b) {
					tagText += ", " + person.b;
				}
				if(person.f) {
					tagText += " (" + person.f + ")";
				}
				if(person.t) {
					tagText += ", " + person.t;
				}
				addTag(item, tagText);
			}
		}
	};

	//Get series (repeatable)
	function getSeries(record, item) {
		var seriesText = false;
		var seriesTag = record.getFieldSubfields("225");
		if(seriesTag && seriesTag.length > 1) {
			for(var j in seriesTag) {
				var series = seriesTag[j];
				if(seriesText) {
					seriesText += "; ";
				}
				else {
					seriesText = "";
				}
				seriesText += series.a;
				if(series.v) {
					seriesText += ", " + series.v;
				}
			}
			if(seriesText) {
				delete item.seriesNumber;
				item.series = seriesText;
			}
		}
		//Try 461
		if(!item.series) {
			seriesTag = record.getFieldSubfields("461");
			if(seriesTag) {
				for(var j in seriesTag) {
					var series = seriesTag[j];
					if(seriesText) {
						seriesText += "; ";
					}
					else {
						seriesText = "";
					}
					seriesText += series.t;
				}
			}
			if(seriesText) {
				delete item.seriesNumber;
				item.series = seriesText;
			}
		}
	};
	
	//Add extra text
	function addExtra(noteText, extra) {
		if(extra) {
			if(noteText) {
				if(!/\.$/.exec(noteText)) {
					noteText += ". ";
				}
				else {
					noteText += " ";
				}
			}
			else {
				noteText = "";
			}
			noteText += Zotero.Utilities.trim(extra);
		}
		return noteText;
	}
	
	//Assemble extra information
	function getExtra(record, item) {
		var noteText = false;
		//Material description
		var noteTag = record.getFieldSubfields("215");
		if(noteTag) {
			for(var j in noteTag) {
				var note = noteTag[j];
				noteText = addExtra(noteText, note.c);
				noteText = addExtra(noteText, note.d);
				noteText = addExtra(noteText, note.e);
			}
		}
		//Note
		noteTag = record.getFieldSubfields("300");
		if(noteTag) {
			for(var j in noteTag) {
				var note = noteTag[j];
				noteText = addExtra(noteText, note.a);
			}
		}
		//Edition history notes
		noteTag = record.getFieldSubfields("305");
		if(noteTag) {
			for(var j in noteTag) {
				var note = noteTag[j];
				noteText = addExtra(noteText, note.a);
			}
		}
		if(noteText) {
			if(!/\.$/.exec(noteText)) {
                 		noteText += ".";
                	}
			item.extra = noteText;
		}
	};


	//Get title from 200
	function getTitle(record, item) {
		var titleTag = record.getFieldSubfields("200");
		if(titleTag) {
			titleTag = titleTag[0];
			var titleText = titleTag.a;
			if(titleTag.e) {
				if(!/^[,\.:;-]/.exec(titleTag.e)) {
					titleText += ": ";
				}
				titleText += titleTag.e;
			} 
			if(titleTag.h) {
				titleText += ", " + titleTag.h;
				if(titleTag.i) {
					titleText += ": " + titleTag.i;
				} 
			} 
			else if(titleTag.i) {
				titleText += ", " + titleTag.i;
			} 
			item.title = titleText;
		}
	};


	//Do BnF specific Unimarc postprocessing
	function postprocessMarc(record, newItem) {
		//Type
		var t = record.getFieldSubfields("200");
		if(t  && t[0].b) {
			newItem.itemType = getItemType(t[0].b);
		}

		//Title
		getTitle(record, newItem);

		//Fix creators
		getCreators(record, newItem);

		//Store perennial url from 009 as attachment and accession number
		var url = record.getField("009");
		if(url && url.length > 0 && url[0][1]) {
			newItem.accessionNumber = url[0][1];
			newItem.attachments = [
				{
					url: url[0][1],
					title: "Bnf catalogue entry", 
					mimeType: "text/html", 
					snapshot:false
				}
			];
		}

		//Country (102a)
		record._associateDBField(newItem, "102", "a", "country");

		//Try to retrieve volumes/pages from 215d
		if(!newItem.pages) {
			var dimTag = record.getFieldSubfields("215");
			for (var j in dimTag)  {
				var dim = dimTag[j];
				if(dim.a) {
					var pages = /[^\d]*(\d+)\s+p\..*/.exec(dim.a);
					if(pages) {
						newItem.numPages = pages[1];
					}
					var vols= /[^\d]*(\d+)\s+vol\..*/.exec(dim.a);
					if(vols) {
						newItem.numberOfVolumes = vols[1];
					}
				}
			}
		}

		//Series
		getSeries(record, newItem);

		//Extra
		getExtra(record, newItem);
		 
		//Tagging
		getTags(record, newItem);
		
		//Repository
		newItem.libraryCatalog = "French National Library Online Catalog (http://catalogue.bnf.fr)";
	};


	//Public members

	/* Get the UNIMARC URL for a given single result page. */
	this.reformURL = function(url) {
		return url.replace(/&FormatAffichage=[^&]*/, "")
			.replace(/&idNoeud=[^&]*/, "") + "&FormatAffichage=4";
	};

	
	/* Get the results table from a list page, if any. Looks for //table[@class="ListeNotice"]. */
	this.getResultsTable = function(doc) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		try {
			var xPath = '//table[@class="ListeNotice"]';
			var xPathObject = doc.evaluate(xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			return xPathObject;
		} catch(x) {
			Zotero.debug(x.lineNumber + " " + x.message);
		}
		return undefined;
	};

	/* Get the DC type from the web page. Returns the first DC.type from meta tags. 
		2010-10-01: No DC meta tags any more... simply test for //td[@class="texteNotice"] cells and return "printed text".
	*/
	this.getDCType = function(doc, url) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		try {
//			var xPath = '//head/meta[@name="DC.type" and @lang="eng"]/@content';
			var xPath = '//td[@class="texteNotice"]';
			var xPathObject = doc.evaluate(xPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();;
			return xPathObject ? "printed text" : undefined;
		} catch(x) {
			Zotero.debug(x.lineNumber + " " + x.message);
		}
		return undefined;
	};

	/* Translate a DC type to a corresponding Zotero item type. Currently obsolete. */
	this.translateDCType = function(type) {
		switch(type) {
		case "printed text":
		case "text":
			return "book";
		case "sound recording":
			return "audioRecording";
		default:
			return type;
		}
	};

	
	/* Get selectable search items from a list page. 
		Loops through //td[@class="mn_partienoticesynthetique"], extracting the single items URLs from
		their onclick attribute, thier titles by assembling the spans for each cell.
	*/
	this.getSelectedItems = function(doc) {
		var items = new Object();
		
		var baseUri = /^(https?:\/\/[^\/]+)/.exec(doc.location.href)[1];

		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			  if (prefix == 'x') return namespace; else return null;
		} : null;	
		
		var cellPath = '//td[@class="mn_partienoticesynthetique"]';
		var spanPath = './/span';
		var cells = doc.evaluate(cellPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var cell = undefined;
		var regexLink = /\s*window.location='([^']+)'\s*/;
		
		//Cell loop
		while(cell = cells.iterateNext()) {
			//Get link
			var link = cell.attributes.item("onclick").textContent;
			var url = baseUri + regexLink.exec(link)[1];
			//Get title
			var title = "";
			var span = undefined;
			var spans = doc.evaluate(spanPath, cell, nsResolver, XPathResult.ANY_TYPE, null);
			//Span loop
			while(span = spans.iterateNext()) {
				if(title.length > 0) {
					title += " – ";
			}
				title += Zotero.Utilities.trim(span.textContent);
			}
			items[url] = title;
		}

		return items;        
	};

	
	//Check for Gallica URL (digital version available), if found, set item.url
	function checkGallica(doc, item) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == 'x') return namespace; else return null;
		} : null;
		
		var url = false;
		//Check for links containing the "Visualiser" img
		var elmts = doc.evaluate('//a[img[@src="/images/boutons/bouton_visualiser.gif"]]',
	            doc, nsResolver, XPathResult.ANY_TYPE, null);
		if(elmts) {
			var link;
			while(link = elmts.iterateNext()) {
				url = link.href;
				break;
			}
		}
		
		if(url) {
			item.url = url;
		}
	}
	
	
	/* Process UNIMARC URL. */
	this.processMarcUrl = function(newDoc) {
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == 'x') return namespace; else return null;
		} : null;
		
		
		/* Init MARC record. */
		var marc = loadMarcTranslator();
		var record = new marc.record();
		
		/* Get table cell containing MARC code. */
		var elmts = newDoc.evaluate('//td[@class="texteNotice"]/text()',
	            newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		/* Line loop. */
		var elmt, tag, content;
		var ind = "";

		while(elmt = elmts.iterateNext()) {
			var line = Zotero.Utilities.superCleanString(elmt.nodeValue);
			if(line.length == 0) {
				continue;
			}
			if(line.substring(0, 6) == "       ")  {
				content += " "+line.substring(6);
				continue;
			} else {
				if(tag) {
					record.addField(tag, ind, content);
				}
			}
			line = line.replace(/[_\t\xA0]/g," "); // nbsp
			tag = line.substr(0, 3);
			if(tag[0] != "0" || tag[1] != "0") {
				ind = line.substr(3, 2);
				content = line.substr(5).replace(/\$([a-z]|[0-9])/g, marc.subfieldDelimiter+"$1");
				content = content.replace(/ˆ([^‰]+)‰/g, "$1");
			} else {
				if(tag == "000") {
					tag = undefined;
					record.leader = "00000"+line.substr(8);
				} else {
					content = line.substr(3);
				}
			}
		}
			
		//Create item
		var newItem = new Zotero.Item();
		record.translate(newItem);
			
		//Do specific Unimarc postprocessing
		postprocessMarc(record, newItem);
		
		//Check for Gallica URL
		checkGallica(newDoc, newItem);
			
		newItem.complete();

	};
};

/* Global BnfClass object. */
var Bnf = new BnfClass();


/* Translator API implementation. */


function detectWeb(doc, url) {
	var resultRegexp = /ID=[0-9]+/i;
	//Single result ?
	if(resultRegexp.test(url)) {
		var type = Bnf.getDCType(doc, url);
		return Bnf.translateDCType(type);
	} 
    //Muliple result ?
	else if(Bnf.getResultsTable(doc)) {
		return "multiple";
	}
	//No items 
	return undefined;
}


function doWeb(doc, url) {
	/* Check type. */
	var type = detectWeb(doc, url);
	if(!type) {
		return;
	}
	/* Build array of MARC URLs. */
	var urls = undefined;
	switch(type) {
	case "multiple":
		var items = Bnf.getSelectedItems(doc);
		if(!items) {
			return true;
		}
		/* Let user select items. */
		items = Zotero.selectItems(items);
		
		urls = new Array();
		for(var i in items) {
			urls.push(Bnf.reformURL(i));
		}
		break;
	default:
		urls = [Bnf.reformURL(url)];
	}
	
	/* Loop through URLs. */
	if(urls.length > 0) {
		Zotero.Utilities.processDocuments(urls, 
			function(doc) {
				Bnf.processMarcUrl.call(Bnf, doc);
			},
			function() { Zotero.done(); }, 
			null);
		
		Zotero.wait();
	}
}
