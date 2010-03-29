{
	"translatorID":"e7e01cac-1e37-4da6-b078-a0e8343b0e98",
	"translatorType":4,
	"label":"unAPI",
	"creator":"Simon Kornblith",
	"target":null,
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":200,
	"inRepository":true,
	"lastUpdated":"2010-03-22 21:13:00"
}

var RECOGNIZABLE_FORMATS = ["mods", "marc", "endnote", "ris", "bibtex", "rdf"];
var FORMAT_GUIDS = {
	"mods":"0e2235e7-babf-413c-9acf-f27cce5f059c",
	"marc":"a6ee60df-1ddc-4aae-bb25-45e0537be973",
	"endnote":"881f60f2-0802-411a-9228-ce5f47b64c7d",
	"ris":"32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7",
	"bibtex":"9cb70025-a888-4a29-a210-93ec52da40d4",
	"rdf":"5e3ad958-ac79-463d-812b-a86a9235c28f"
};

var unAPIResolver, unsearchedIds, foundIds, foundItems, foundFormat, foundFormatName, domain;

function detectWeb(doc, url) {
	// initialize variables
	unsearchedIds = [];
	foundIds = [];
	foundItems = [];
	foundFormat = [];
	foundFormatName = [];

	// Set the domain we're scraping
	domain = doc.location.href.match(/https?:\/\/([^/]+)/);
	
	var nsResolver = doc.createNSResolver(doc.documentElement);
	
	// look for a resolver
	unAPIResolver = doc.evaluate('//link[@rel="unapi-server"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(!unAPIResolver) return false;
	unAPIResolver = unAPIResolver.getAttribute("href");
	
	// look for abbrs
	var abbrs = doc.getElementsByTagName("abbr");
	for each(var abbr in abbrs) {
		if(abbr.getAttribute && abbr.getAttribute("class") &&
		   abbr.getAttribute("class").split(" ").indexOf("unapi-id") != -1 && abbr.getAttribute("title")) {
			// found an abbr
			unsearchedIds.push(escape(abbr.getAttribute("title")));
		}
	}
	
	if(!unsearchedIds.length) return false;
	
	// now we need to see if the server actually gives us bibliographic metadata.
	
	// one way to signal this is with a META tag
	var zoteroMeta = doc.evaluate('//meta[@name="ZoteroItemType"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(zoteroMeta) return zoteroMeta.getAttribute("content");
	
	// otherwise, things will be a bit more complicated, and we'll have to do some HTTP requests
	Zotero.wait();
	
	if(unsearchedIds.length == 1) {
		// if there's only one abbr tag, we should go ahead and retrieve types for it
		getItemType();
	} else {
		// if there's more than one, we should first see if the resolver gives metadata for all of them
		Zotero.Utilities.HTTP.doGet(unAPIResolver, function(text) {
			var format = checkFormats(text);
			if(format) {
				// move unsearchedIds to foundIds
				foundIds = unsearchedIds;
				unsearchedIds = [];
				// save format and formatName
				foundFormat = format[0];
				foundFormatName = format[1];
				
				Zotero.done("multiple");
			} else {
				getItemType();
			}
		});
	}
}

function getItemType() {
	// if there are no items left to search, use the only item's type (if there is one) or give up
	if(!unsearchedIds.length) {
		if(foundIds.length) {
			getOnlyItem();
		} else {
			Zotero.done(false);
		}
		return;
	}
	
	var id = unsearchedIds.shift();
	Zotero.Utilities.HTTP.doGet(unAPIResolver+"?id="+id, function(text) {
		var format = checkFormats(text);
		if(format) {
			// save data
			foundIds.push(id);
			foundFormat.push(format[0]);
			foundFormatName.push(format[1]);
			
			if(foundIds.length == 2) {
				// this is our second; use multiple
				Zotero.done("multiple");
				return;
			}
		}
		
		// keep going
		getItemType();
	});
}

function checkFormats(text) {
	text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");
	var xml = new XML(text);
	
	var foundFormat = new Object();
	
	// this is such an ugly, disgusting hack, and I hate how Mozilla decided to neuter an ECMA standard
	for each(var format in xml.format) {
		var name = format.@name.toString();
		var lowerName = name.toLowerCase();
		
		if(format.@namespace_uri == "http://www.loc.gov/mods/v3" || lowerName == "mods" || format.@docs == "http://www.loc.gov/standards/mods/") {
			if(!foundFormat["mods"] || lowerName.indexOf("full") != -1) {
				foundFormat["mods"] = escape(name);
			}
		} else if(lowerName.match(/^marc\b/)) {
			if(!foundFormat["marc"] || lowerName.indexOf("utf8") != -1) {
				foundFormat["marc"] = escape(name);
			}
		} else if(lowerName == "rdf_dc") {
			foundFormat["rdf"] = escape(name);
		} else if(format.@docs.text() == "http://www.refman.com/support/risformat_intro.asp" || lowerName.match(/^ris\b/)) {
			if(!foundFormat["ris"] || lowerName.indexOf("utf8") != -1) {
				foundFormat["ris"] = escape(name);
			}
		} else if(lowerName == "bibtex") {
			foundFormat["bibtex"] = escape(name);
		} else if(lowerName == "endnote") {
			foundFormat["endnote"] = escape(name);
		}
	}
	
	// loop through again, this time respecting preferences
	for each(var format in RECOGNIZABLE_FORMATS) {
		if(foundFormat[format]) return [format, foundFormat[format]];
	}
	
	return false;
}

function getOnlyItem() {
	// retrieve the only item
	retrieveItem(foundIds[0], foundFormat[0], foundFormatName[0], function(obj, item) {
		foundItems.push(item);
		Zotero.done(item.itemType);
	});
}

function retrieveItem(id, format, formatName, callback) {
	// retrieve URL
	Zotero.Utilities.HTTP.doGet(unAPIResolver+"?id="+id+"&format="+formatName, function(text) {
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator(FORMAT_GUIDS[format]);
		translator.setString(text);
		translator.setHandler("itemDone", callback);
		translator.translate();
	});
}

/**
 * Get formats and names for all usable ids; when done, get all items
 **/
function getAllIds() {
	if(!unsearchedIds.length) {
		// once all ids have been gotten, get all items
		getAllItems();
		return;
	}
	
	var id = unsearchedIds.shift();
	Zotero.Utilities.HTTP.doGet(unAPIResolver+"?id="+id, function(text) {
		var format = checkFormats(text);
		if(format) {
			// save data
			foundIds.push(id);
			foundFormat.push(format[0]);
			foundFormatName.push(format[1]);
		}
		
		// keep going
		getAllIds();
	});
}

/**
 * Get all items; when done, show selectItems or scrape
 **/
function getAllItems() {
	if(foundItems.length == foundIds.length) {
		if(foundItems.length == 1) {
			// Set the item Repository to the domain
			foundItems[0].repository = domain[1];
			// if only one item, send complete()
			foundItems[0].complete();
		} else if(foundItems.length > 0) {
			// if multiple items, show selectItems
			var itemTitles = [];
			for(var i in foundItems) {
				itemTitles[i] = foundItems[i].title;
			}
			
			var chosenItems = Zotero.selectItems(itemTitles);
			if(!chosenItems) Zotero.done(true);
			
			for(var i in chosenItems) {
				// Set the item Repository to the domain
				foundItems[i].repository = domain[1];
				foundItems[i].complete();
			}
		}
		
		// reset items
		foundItems = [];
		
		Zotero.done();
		return;
	}
	
	var id = foundIds[foundItems.length];
	// foundFormat can be either a string or an array
	if(typeof(foundFormat) == "string") {
		var format = foundFormat;
		var formatName = foundFormatName;
	} else {
		var format = foundFormat[foundItems.length];
		var formatName = foundFormatName[foundItems.length];
	}
	
	// get item
	retrieveItem(id, format, formatName, function(obj, item) {
		foundItems.push(item);
		getAllItems();
	});
}

function doWeb() {
	Zotero.wait();
	
	// retrieve data for all ids
	getAllIds();
}
