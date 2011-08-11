{
	"translatorID":"24d9f058-3eb3-4d70-b78f-1ba1aef2128d",
	"translatorType":5,
	"label":"CTX",
	"creator":"Avram Lyon and Simon Kornblith",
	"target":"^http://freecite\\.library\\.brown\\.edu",
	"minVersion":"2.0",
	"maxVersion":"",
	"priority":100,
	"configOptions":{"dataMode":"line"},
	"inRepository":false,
	"lastUpdated":"2011-01-11 04:31:00"
}

/*
   ContextObjects in XML Translator
   Copyright (C) 2010 Avram Lyon, ajlyon@gmail.com

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
 /*This translator imports OpenURL ContextObjects encapsulated in XML
 * documents, as described at:
 *  http://alcme.oclc.org/openurl/servlet/OAIHandler?verb=GetRecord&metadataPrefix=oai_dc&identifier=info:ofi/fmt:xml:xsd:ctx
 * The schema for such XML documents is at:
 *  http://www.openurl.info/registry/docs/xsd/info:ofi/fmt:xml:xsd:ctx
 *
 * This format is used in several places online, including Brown University's FreeCite
 * Citation parser (http://freecite.library.brown.edu/welcome) and Oslo University's
 * X-Port (http://www.ub.uio.no/portal/gs.htm or http://x-port.uio.no/).
 
 * Our input looks like this:
<ctx:context-objects xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xsi:schemaLocation='info:ofi/fmt:xml:xsd:ctx http://www.openurl.info/registry/docs/info:ofi/fmt:xml:xsd:ctx' xmlns:ctx='info:ofi/fmt:xml:xsd:ctx'>
<ctx:context-object timestamp='2010-01-02T16:55:48-05:00' encoding='info:ofi/enc:UTF-8' version='Z39.88-2004' identifier=''>
 <ctx:referent>
  <ctx:metadata-by-val>
   <ctx:format>info:ofi/fmt:xml:xsd:journal</ctx:format>
   <ctx:metadata>
    <journal xmlns:rft='info:ofi/fmt:xml:xsd:journal' xsi:schemaLocation='info:ofi/fmt:xml:xsd:journal http://www.openurl.info/registry/docs/info:ofi/fmt:xml:xsd:journal'>
     <rft:atitle>Acute Myocardial Infarction in the Medicare population: process of care and clinical outcomes</rft:atitle>
     <rft:spage>2530</rft:spage>
     <rft:date>1992</rft:date>
     <rft:stitle>Journal of the American Medical Association</rft:stitle>
     <rft:genre>article</rft:genre>
     <rft:volume>18</rft:volume>
     <rft:epage>2536</rft:epage>
     <rft:au>I S Udvarhelyi</rft:au>
     <rft:au>C A Gatsonis</rft:au>
     <rft:au>A M Epstein</rft:au>
     <rft:au>C L Pashos</rft:au>
     <rft:au>J P Newhouse</rft:au>
     <rft:au>B J McNeil</rft:au>
    </journal>
   </ctx:metadata>
  </ctx:metadata-by-val>
 </ctx:referent>
</ctx:context-object>
</ctx:context-objects>
 *
 * The approach we will take is to convert this into COinS, so that we can
 * piggy-back off of the perhaps more robust support in the core Zotero code.
 */

function detectWeb(doc, url) {
	var texts = [], text = "";
	var codes = doc.getElementsByTagName("code");
	for(var i = 0; i < codes.length; i++) {
		text = codes[i].textContent;
		text.replace(/</g,"&lt;").replace(/>/g,"&gt;");
		texts.push(text);
	}
	return detectInString(texts);
};

function doWeb(doc, url) {
	var texts = [], text = "";
	var codes = doc.getElementsByTagName("code");
	for(var i = 0; i < codes.length; i++) {
		text = codes[i].textContent;
		text.replace(/</g,"&lt;").replace(/>/g,"&gt;");
		texts.push(text);
	}
	doImportFromText(texts, true);
};

function doImport() {
	var text = "";
	var line;
	while(line = Zotero.read()) {
		text += line;
	}
	return doImportFromText(text, false);
}

function detectImport() {
	var text = "";
	var line;
	while(line = Zotero.read()) {
		text += line;
	}	
	return detectInString(text) != false;
}

function detectInString(text) {
    var detectedType = false;

	var spans = [];
	
	// This is because we want to be able to read multiple such CTX elements in a single page
	if (typeof text != "string" && text.length >= 1) {
		spans = text.map(contextObjectXMLToCOinS).reduce(function(a,b){return a.concat(b);});
	} else {
		spans = contextObjectXMLToCOinS(text);
	}       
	
	for (var i = 0 ; i < spans.length ; i++) {
		var item = new Zotero.Item;
		var success = Zotero.Utilities.parseContextObject(spans[i], item);
		if(item.itemType) {
			Zotero.debug("Found " + item.itemType);
			if (detectedType) {
			    return "multiple";
			}
			detectedType = item.itemType;
		} else {
			Zotero.debug("Type not found");
		}
	}
	return detectedType;
};

/* Takes the string of the ContextObject XML format
 * and returns an array of COinS titles of the same, per the COinS
 * specification.
 */
function contextObjectXMLToCOinS (text) {
	try {
		var doc = new XML(text);
	}
	catch (e) {
		return [];
	}
	
	/* Here and elsewhere, we are using the E4X syntax for XML */
	var objects = doc..*::["context-object"];

	/* Bail out if no object */
	if (objects.length() == 0) {
		Zotero.debug("No context object");
		return [];
	}

	var titles = [];
	
	for (var i = 0; i < objects.length(); i++) {
		Zotero.debug("Processing object: " + objects[i].text());
		var pieces = [];
		
		
		var version = objects[i].@version;
		pieces.push("ctx_ver="+encodeURIComponent(version));
		
		var format = objects[i]..*::format;
		// Now convert this to the corresponding Key/Encoded-Value format; see note below.
		// Check if this is unknown; if it is, skip
		if (format.text() == "info:ofi/fmt:xml:xsd:unknown") {
			Zotero.debug("Skipping object of type 'unknown'");
			continue;
		}
		format = mapXMLtoKEV[format.text()];
		
		pieces.push("rft_val_fmt=" + encodeURIComponent(format));
		
		// Here we disregard the namespaces
		var fields = objects[i]..*::metadata.children()[0].*::*;
		var field;
		
		for each (field in fields) {
		    var name = field.localName();
		    // We can hardcode the 'rft' namespace to keep COinS valid
		    name = "rft."+name;
		    var value = encodeURIComponent(field.text());
		    pieces.push(name + "=" + value);
		}
		
		var title = pieces.join("&");
		var span = "<span title='" + title + "' class='Z3988'></span>\n";
		Zotero.debug("Made span: " + span);
		titles.push(title);
	}
	return titles;
};

function doImportFromText(text, showPrompt) {
	var spans = [], items = [], zoteroItems = [];
	
	// This is because we want to be able to read multiple such CTX elements in a single page
	if (typeof text != "string" && text.length >= 1) {
		spans = text.map(contextObjectXMLToCOinS).reduce(function(a,b){return a.concat(b);});
	} else {
		spans = contextObjectXMLToCOinS(text);
	}
	
	for (var i = 0 ; i < spans.length ; i++) {
		Zotero.debug("Processing span: "+spans[i]);
		var item = new Zotero.Item;
		Zotero.Utilities.parseContextObject(spans[i], item);
		if(item.itemType) {
			Zotero.debug("Found " + item.itemType);
			items.push(item.title);
			zoteroItems.push(item);
			// Set publicationTitle to the short title if only the latter is specified
			if (item.journalAbbreviation && !item.publicationTitle) {
				item.publicationTitle = item.journalAbbreviation;
			}
			// If we're in non-prompting mode, save right away
			if (showPrompt === false) {
				item.complete();
			}
		} else {
			Zotero.debug("Type not found");
		}
	}
	// Since we want to prompt, we have to parse twice.
	if(showPrompt === true) {
		if(items.length == 1) {
			item.complete();
		} else {
			items = Zotero.selectItems(items);
			if(!items) return true;
			for(var i in items) {
				zoteroItems[i].complete();
			}
		}
	}
};

/* These two arrays are needed because COinS uses Key/Escaped-Value, which has a different
 * set of format codes. Codes from "Registry for the OpenURL Framework - ANSI/NISO Z39.88-2004":
 * http://alcme.oclc.org/openurl/servlet/OAIHandler?verb=ListRecords&metadataPrefix=oai_dc&set=Core:Metadata+Formats
 */
var mapKEVtoXML = {
	'info:ofi/fmt:kev:mtx:book'	:	'info:ofi/fmt:xml:xsd:book',	 	// Books
	'info:ofi/fmt:kev:mtx:dc'	:	'info:ofi/fmt:xml:xsd:oai_dc',		// Dublin Core
	'info:ofi/fmt:kev:mtx:dissertation' :	'info:ofi/fmt:xml:xsd:dissertation',	// Dissertations
	'info:ofi/fmt:kev:mtx:journal'	:	'info:ofi/fmt:xml:xsd:journal',		// Journals
	'info:ofi/fmt:kev:mtx:patent'	:	'info:ofi/fmt:xml:xsd:patent',		// Patents
	'info:ofi/fmt:kev:mtx:sch_svc'	:	'info:ofi/fmt:xml:xsd:sch_svc'		// Scholarly ServiceTypes
};

var mapXMLtoKEV = {
	'info:ofi/fmt:xml:xsd:book'	:	'info:ofi/fmt:kev:mtx:book',	 	// Books
	'info:ofi/fmt:xml:xsd:oai_dc'	:	'info:ofi/fmt:kev:mtx:dc',		// Dublin Core
	'info:ofi/fmt:xml:xsd:dissertation' :	'info:ofi/fmt:kev:mtx:dissertation',	// Dissertations
	'info:ofi/fmt:xml:xsd:journal'	:	'info:ofi/fmt:kev:mtx:journal',		// Journals
	'info:ofi/fmt:xml:xsd:patent'	:	'info:ofi/fmt:kev:mtx:patent',		// Patents
	'info:ofi/fmt:xml:xsd:sch_svc'	:	'info:ofi/fmt:kev:mtx:sch_svc'		// Scholarly ServiceTypes
};
