{
	"translatorID":"e7e01cac-1e37-4da6-b078-a0e8343b0e98",
	"translatorType":4,
	"label":"unAPI",
	"creator":"Simon Kornblith",
	"target":null,
	"minVersion":"2.1",
	"maxVersion":"",
	"priority":200,
	"inRepository":true,
	"detectXPath":"//link[@rel='unapi-server']",
	"lastUpdated":"2011-04-19 19:40:07"
}

var RECOGNIZABLE_FORMATS = ["rdf_zotero", "rdf_bibliontology", "mods", "marc", "unimarc", "ris",
	"refer", "bibtex", "rdf_dc"];
var FORMAT_GUIDS = {
	"rdf_zotero":"5e3ad958-ac79-463d-812b-a86a9235c28f",
	"rdf_bibliontology":"14763d25-8ba0-45df-8f52-b8d1108e7ac9",
	"mods":"0e2235e7-babf-413c-9acf-f27cce5f059c",
	"marc":"a6ee60df-1ddc-4aae-bb25-45e0537be973",
	"unimarc":"a6ee60df-1ddc-4aae-bb25-45e0537be973",
	"ris":"32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7",
	"refer":"881f60f2-0802-411a-9228-ce5f47b64c7d",
	"bibtex":"9cb70025-a888-4a29-a210-93ec52da40d4",
	"rdf_dc":"5e3ad958-ac79-463d-812b-a86a9235c28f"
};

var unAPIResolver = false;
var defaultFormat, unAPIIDs;

/**
 * A class to describe an unAPI format description
 * @property isSupported {Boolean} Whether Zotero supports a format contained in this description
 * @property name {String} The unAPI format name, used to retrieve item descriptions
 * @property translatorID {String} The ID of the translator used to read this format
 *
 * @constructor
 * @param {String} aXML unAPI format description XML
 */
UnAPIFormat = function(aXML) {
	var parser = new DOMParser();
	var doc = parser.parseFromString(aXML.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, ""), "text/xml");
	
	var foundFormat = new Object();
	
	// Loop through to determine format name
	var nodes = doc.documentElement.getElementsByTagName("format");
	var nNodes = nodes.length;
	var node, name, lowerName, format;
	for(var i=0; i<nNodes; i++) {
		node = nodes[i];
		name = node.getAttribute("name");
		lowerName = name.toLowerCase();
		format = false;
		
		// Look for formats we can recognize
		if(["rdf_zotero", "rdf_bibliontology", "bibtex", "endnote", "rdf_dc"].indexOf(lowerName) != -1) {
			format = lowerName;
		} else if(lowerName == "rdf_bibliontology") {
			format = "rdf_bibliontology";
		} else if(lowerName === "mods"
				|| node.getAttribute("namespace_uri") === "http://www.loc.gov/mods/v3"
				|| node.getAttribute("docs") === "http://www.loc.gov/standards/mods/"
				|| node.getAttribute("type") === "application/mods+xml") {
			format = "mods";
		} else if(lowerName.match(/^marc\b/)
				|| node.getAttribute("type") === "application/marc") {
			format = "marc";
		} else if(lowerName.match(/^unimarc\b/)
				|| node.getAttribute("type") === "application/unimarc") {
			format = "unimarc";
		} else if(node.getAttribute("docs") == "http://www.refman.com/support/risformat_intro.asp"
				|| lowerName.match(/^ris\b/)) {
			format = "ris";
		}
		
		if(format) foundFormat[format] = name;
	}
	
	// Loop through again to determine optimal supported format
	for(var i=0; i<RECOGNIZABLE_FORMATS.length; i++) {
		if(foundFormat[RECOGNIZABLE_FORMATS[i]]) {
			this.isSupported = true;
			this.name = foundFormat[RECOGNIZABLE_FORMATS[i]];
			this.translatorID = FORMAT_GUIDS[RECOGNIZABLE_FORMATS[i]];
			return;
		}
	}
	
	this.isSupported = false;
}

/**
 * A class encapsulating an UnAPI ID
 * @property format {UnAPIFormat} Information regarding the format
 * @property items {Zotero.Item[]} Items corresponding to this ID
 *
 * @constructor
 * @param {String} id The ID contained in an abbr tag
 */
UnAPIID = function(id) {
	this.id = id;
	unAPIIDs[id] = this;
}

UnAPIID.prototype = {
	/**
	 * Gets the item type for this item
	 * @param {Function} callback Callback to be passed itemType when it is known
	 */
	"getItemType":function(callback) {
		var me = this;
		this.getItems(function(items) {
			if(items.length === 0) {
				callback(false);
			} else if(items.length === 1) {
				callback(items[0].itemType);
			} else {
				callback("multiple");
			}
		});
	},
	
	/**
	 * Gets items associated with this ID
	 * @param {Function} callback Callback to be passed items when they have been retrieved
	 */
	"getItems":function(callback) {
		if(this.items) {
			callback(me.items);
			return;
		}
		
		var me = this;
		this.items = [];
		this.isSupported(function(isSupported) {
			if(!isSupported) {
				callback([]);
				return;
			}
			
			Zotero.Utilities.HTTP.doGet(unAPIResolver+"?id="+me.id+"&format="+me.format.name, function(text) {
				var translator = Zotero.loadTranslator("import");
				translator.setTranslator(me.format.translatorID);
				translator.setString(text);
				translator.setHandler("itemDone", function(obj, item) {
					// add item to array
					me.items.push(item);
				});
				translator.setHandler("done", function(obj) {
					// run callback on item array
					callback(me.items);
				});
				translator.translate();
			});
		});
	},
	
	/**
	 * Determines whether Zotero can handle this ID
	 * @param {Function} callback Callback to be passed isSupported when it is known
	 */
	"isSupported":function(callback) {
		if(this.hasOwnProperty("format")) {
			callback(me.format.isSupported);
			return;
		}
		
		var me = this;
		
		getDefaultFormat(function() {
			// first try default format, since this won't require >1 HTTP request
			if(defaultFormat.isSupported) {
				me.format = defaultFormat;
				callback(true);
			} else {
				// if no supported default format, try format for this item
				Zotero.Utilities.HTTP.doGet(unAPIResolver+"?id="+me.id, function(text) {
					me.format = UnAPIFormat(text);
					callback(!!me.format.isSupported);
				});
			}
		});
	}
}

/**
 * This and the x: prefix in the XPath are to work around an issue with pages
 * served as application/xhtml+xml
 *
 * https://developer.mozilla.org/en/Introduction_to_using_XPath_in_JavaScript#Implementing_a_default_namespace_for_XML_documents
 */
function nsResolver() {
	return 'http://www.w3.org/1999/xhtml';
}

/**
 * Extracts UnAPIIDs from a document
 * @param {document} A document object from which to extract unAPIIds
 * @return {UnAPIID[]} The unAPI ID objects extracted from the document
 */
function getUnAPIIDs(doc) {
	// look for a resolver
	var newUnAPIResolver = doc.evaluate('//x:link[@rel="unapi-server"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(!newUnAPIResolver) return [];
	newUnAPIResolver = newUnAPIResolver.getAttribute("href");
	if(unAPIResolver !== newUnAPIResolver) {
		// if unAPI resolver has changed, clear
		defaultFormat = false;
		unAPIResolver = newUnAPIResolver;
		unAPIIDs = [];
	}
	
	// look for abbrs
	var abbrs = doc.evaluate('//x:abbr[contains(@class, " unapi-id") or contains(@class, "unapi-id ") or @class="unapi-id"][@title]',
		doc, nsResolver, XPathResult.ANY_TYPE, null);
	var abbr;
	var ids = [];
	while(abbr = abbrs.iterateNext()) {
		var id = abbr.getAttribute("title");
		ids.push(unAPIIDs[id] ? unAPIIDs[id] : new UnAPIID(id));
	}
	
	return ids;
}


/**
 * Retrieves the list of formats available for all items accessible through this unAPI resolver
 * @param {Function} callback A callback to be passed the format when it is available
 */
function getDefaultFormat(callback) {
	if(defaultFormat) {
		callback(defaultFormat);
	} else {
		Zotero.Utilities.HTTP.doGet(unAPIResolver, function(text) {
			// determine format of this item
			defaultFormat = new UnAPIFormat(text);
			callback(defaultFormat);
		});
	}
}
/**
 * Determines itemType for detection
 */
function determineDetectItemType(ids, supportedId) {
	var id = ids.shift();
	id.isSupported(function(isSupported) {
		if(isSupported && supportedId !== undefined) {
			// If there are multiple items with valid itemTypes, use "multiple"
			Zotero.done("multiple");
		} else if(ids.length) {
			// If IDs remain to be handled, handle the next one
			determineDetectItemType(ids, (isSupported ? id : supportedId));
		} else {
			// If all IDs have been handled, get foundItemType for only supported ID
			supportedId.getItemType(Zotero.done);
		}
	});
}

/**
 * Get all items
 * @param {UnAPIID[]} ids List of UnAPI IDs
 * @param {Function} callback Function to pass item array to when items have been retrieved
 * @param {Zotero.Item[]} items Item array; used for recursive calls
 **/
function getAllItems(ids, callback, items) {
	var id = ids.shift();
	id.getItems(function(retrievedItems) {
		var collectedItems = (items ? items.concat(retrievedItems) : retrievedItems);
		
		if(ids.length) {
			getAllItems(ids, callback, collectedItems);
		} else {
			callback(collectedItems);
		}
	});
}

function detectWeb(doc, url) {
	// get unAPI IDs
	var ids = getUnAPIIDs(doc);
	if(!ids.length) return false;
	
	// now we need to see if the server actually gives us bibliographic metadata, and determine the
	// type
	Zotero.wait();
	
	if(!ids.length === 1) {
		// Only one item, so we will just get its item type
		ids[0].getItemType(Zotero.done);
	} else {
		// Several items. We will need to call determineDetectItemType
		determineDetectItemType(ids);
	}
}

function doWeb(doc, url) {
	var ids = getUnAPIIDs(doc);
	
	Zotero.wait();
	
	getAllItems(ids, function(items) {
		// get the domain we're scraping, so we can use it for libraryCatalog
		domain = doc.location.href.match(/https?:\/\/([^/]+)/);
		
		if(items.length == 1) {
			// If only one item, just complete it
			items[0].libraryCatalog = domain[1];
			items[0].complete();
		} else if(items.length > 0) {
			// If multiple items, extract their titles
			var itemTitles = [];
			for(var i in items) {
				itemTitles[i] = items[i].title;
			}
			
			// Show item selection dialog
			var chosenItems = Zotero.selectItems(itemTitles);
			if(!chosenItems) Zotero.done(true);
			
			// Complete items
			for(var i in chosenItems) {
				items[i].libraryCatalog = domain[1];
				items[i].complete();
			}
		}
		
		Zotero.done();
		return;
	});
}
