/*
 * Scholar.Cite: a class for creating bibliographies from within Scholar
 * this class handles pulling the CSL file and item data out of the database,
 * while CSL, below, handles the actual generation of the bibliography
 */
default xml namespace = "http://purl.org/net/xbiblio/csl";

Scholar.Cite = new function() {
	var _lastCSL = null;
	var _lastStyle = null;
	
	this.getStyles = getStyles;
	this.getStyle = getStyle;
	
	/*
	 * returns an associative array of cslID => styleName pairs
	 */
	function getStyles() {
		// get styles
		var sql = "SELECT cslID, title FROM csl ORDER BY title";
		var styles = Scholar.DB.query(sql);
		
		// convert to associative array
		var stylesObject = new Object();
		for each(var style in styles) {
			stylesObject[style.cslID] = style.title;
		}
		
		return stylesObject;
	}
	/*
	 * gets CSL from the database, or, if it's the most recently used style,
	 * from the cache
	 */
	function getStyle(cslID) {
		if(_lastStyle != cslID || Scholar.Prefs.get("cacheTranslatorData") == false) {
			// get style
			var sql = "SELECT csl FROM csl WHERE cslID = ?";
			var style = Scholar.DB.valueQuery(sql, [cslID]);
			
			// create a CSL instance
			_lastCSL = new Scholar.CSL(style);
			_lastStyle = cslID;
		}
		return _lastCSL;
	}
}

/*
 * CSL: a class for creating bibliographies from CSL files
 * this is abstracted as a separate class for the benefit of anyone who doesn't
 * want to use the Scholar data model, but does want to use CSL in JavaScript
 */
Scholar.CSL = function(csl) {
	this._csl = new XML(Scholar.CSL._cleanXML(csl));
	
	// initialize CSL
	Scholar.CSL.init();
	
	// load localizations
	this._terms = Scholar.CSL._parseLocales(this._csl.terms);
	
	// load class defaults
	this.class =  this._csl["@class"].toString();
	Scholar.debug("CSL: style class is "+this.class);
	
	this._defaults = new Object();
	// load class defaults
	if(Scholar.CSL._classDefaults[this.class]) {
		var classDefaults = Scholar.CSL._classDefaults[this.class];
		for(var i in classDefaults) {
			this._defaults[i] = classDefaults[i];
		}
	}
	// load defaults from CSL
	this._parseFieldDefaults(this._csl.defaults);
	// parse bibliography and citation options
	this._parseBibliographyOptions();
	this._parseCitationOptions();
	// if no bibliography exists, parse citation element as bibliography
	if(!this._bib) {
		Scholar.debug("CSL: using citation element for bibliography");
		this._bib = this._cit;
	}
}

/*
 * preprocess items, separating authors, editors, and translators arrays into
 * separate properties
 *
 * must be called prior to generating citations or bibliography with a new set
 * of items
 */
Scholar.CSL.prototype.preprocessItems = function(items) {
	Scholar.debug("CSL: preprocessing items");
	
	this._ignore = null;
	
	// get data necessary to generate citations before sorting
	for(var i in items) {
		var item = items[i];
		var dateModified = item.getField("dateModified");
		
		if(!item._csl || item._csl.dateModified != dateModified) {
			// namespace everything in item._csl so there's no chance of overlap
			item._csl = new Object();
			item._csl.dateModified = dateModified;
			
			// separate item into authors, editors, translators
			var creators = this._separateItemCreators(item);
			item._csl.authors = creators[0];
			item._csl.editors = creators[1];
			item._csl.translators = creators[2];
			
			// parse date
			item._csl.date = Scholar.CSL.prototype._processDate(item.getField("date"));
		}
		// clear disambiguation and subsequent author substitute
		if(item._csl.disambiguation) item._csl.date.disambiguation = undefined;
		if(item._csl.subsequentAuthorSubstitute) item._csl.subsequentAuthorSubstitute = undefined;
	}
	
	// sort by sort order
	if(this._bib.sortOrder) {
		Scholar.debug("CSL: sorting items");
		var me = this;
		items.sort(function(a, b) {
			return me._compareItem(a, b);
		});
	}
	
	// disambiguate items after preprocessing and sorting
	var usedCitations = new Array();
	var lastAuthor;
	
	for(var i in items) {
		var item = items[i];
		
		var author = this._getFieldValue("author",
										   this._getFieldDefaults("author"),
										   item, "disambiguate", this._bib);
		
		// handle (2006a) disambiguation for author-date styles
		if(this.class == "author-date") {
			var citation = author+" "+this._getFieldValue("date",
												this._getFieldDefaults("date"),
												item, "disambiguate", this._bib);
			
			if(usedCitations[citation]) {
				if(!usedCitations[citation]._csl.date.disambiguation) {
					usedCitations[citation]._csl.date.disambiguation = "a";
					item._csl.date.disambiguation = "b";
				} else {
					// get all but last character
					var oldLetter = usedCitations[citation]._csl.date.disambiguation;
					if(oldLetter.length > 1) {
						item._csl.date.disambiguation = oldLetter.substr(0, oldLetter.length-1);
					} else {
						item._csl.date.disambiguation = "";
					}
					
					var charCode = oldLetter.charCodeAt(oldLetter.length-1);
					if(charCode == 122) {
						// item is z; add another letter
						item._csl.date.disambiguation += "za";
					} else {
						// next lowercase letter
						item._csl.date.disambiguation += String.fromCharCode(charCode+1);
					}
				}
			}
			
			usedCitations[citation] = item;
		}
		
		// add numbers to each
		item._csl.number = i;
		
		// handle subsequent author substitutes
		if(lastAuthor == author) {
			item._csl.subsequentAuthorSubstitute = true;
		}
		lastAuthor = author;
	}
}

/*
 * create a citation (in-text or footnote)
 */
Scholar.CSL.prototype.createCitation = function(citation, format) {
	if(citation.citationType == 2) {
		var string = this._getTerm("ibid");
		string = string[0].toUpperCase()+string.substr(1);
	} else {
		var string = "";
		for(var i in citation.itemIDs) {
			if(this._cit.format && this._cit.format.delimiter && string) {
				// add delimiter if one exists, and this isn't the first element
				// with content
				string += this._cit.format.delimiter;
			}
			
			var locatorType = false;
			var locator = false;
			if(citation.locators) {
				if(citation.locatorTypes[i] == "p") {
					locatorType = "page";
				} else if(citation.locatorTypes[i] == "g") {
					locatorType = "paragraph";
				} else if(citation.locatorTypes[i] == "l") {
					locatorType = "line";
				}
				
				locator = citation.locators[i];
			}
			
			string += this._getCitation(Scholar.Items.get(citation.itemIDs[i]),
				(citation.citationType[i] == 1 ? "first" : "subsequent"),
				locatorType, locator, format, this._cit);
		}
	}
	
	// add format
	if(this._cit.format) {
		// add citation prefix or suffix
		if(this._cit.format.prefix) {
			string = this._cit.format.prefix + string ;
		}
		if(this._cit.format.suffix) {
			string += this._cit.format.suffix;
		}
	}
	
	return string;
}

/*
 * create a bibliography
 * (items is expected to be an array of items)
 */
Scholar.CSL.prototype.createBibliography = function(items, format) {
	// process this._items
	var output = "";
	
	var index = 0;
	if(format == "HTML") {
		if(this.class == "note") {
			output += '<ol>\r\n';
		} else if(this._bib.hangingIndent) {
			output += '<div style="margin-left:0.5in;text-indent:-0.5in;">\r\n';
		}
	} else if(format == "RTF") {
		output += "{\\rtf\\ansi{\\fonttbl\\f0\\froman Times New Roman;}{\\colortbl;\\red255\\green255\\blue255;}\\pard\\f0";
		if(this._bib.hangingIndent) {
			output += "\\li720\\fi-720";
		}
		output += "\r\n";
	}
	
	for(var i in items) {
		var item = items[i];
		
		var string = this._getCitation(item, "first", false, false, format, this._bib);
		if(!string) {
			continue;
		}
		
		// add format
		if(this._bib.format) {
			// add citation prefix or suffix
			if(this._bib.format.prefix) {
				string = this._bib.format.prefix + string ;
			}
			if(this._bib.format.suffix) {
				string += this._bib.format.suffix;
			}
		}
		
		// add line feeds
		if(format == "HTML") {
			var coins = Scholar.OpenURL.createContextObject(item, "1.0");
			if(coins) {
				string += '<span class="Z3988" title="'+coins.replace("&", "&amp;")+'"></span>';
			}
			
			if(this.class == "note") {
				output += "<li>"+string+"</li>\r\n";
			} else {
				output += "<p>"+string+"</p>\r\n";
			}
		} else if(format == "RTF") {
			if(this.class == "note") {
				index++;
				output += index+". ";
			}
			output += string+"\\\r\n\\\r\n";
		} else {
			if(format == "Text" && this.class == "note") {
				index++;
				output += index+". ";
			}
			output += string+"\r\n\r\n";
		}
	}
	
	if(format == "HTML") {
		if(this.class == "note") {
			output += '</ol>';
		} else if(this._bib.hangingIndent) {
			output += '</div>';
		}
	} else if(format == "RTF") {
		// drop last 6 characters of output (last two returns)
		output = output.substr(0, output.length-6)+"}";
	} else {
		// drop last 4 characters (last two returns)
		output = output.substr(0, output.length-4);
	}
	
	return output;
}

// for elements that inherit defaults from each other
Scholar.CSL._inherit = {
	author:"contributor",
	editor:"contributor",
	translator:"contributor",
	pages:"locator",
	volume:"locator",
	issue:"locator",
	isbn:"identifier",
	doi:"identifier",
	edition:"version"
}
// for class definitions
Scholar.CSL._classDefaults = new Object();
Scholar.CSL._classDefaults["author-date"] = {
	author:{
		substitute:[
			{name:"editor"},
			{name:"translator"},
			{name:"titles", relation:"container", "font-style":"italic"},
			{name:"titles", children:[
				{name:"title", form:"short"}
			]}
		]
	}
};

Scholar.CSL.ns = "http://purl.org/net/xbiblio/csl";

/*
 * initializes CSL interpreter
 */
Scholar.CSL.init = function() {
	if(!Scholar.CSL._xmlLang) {
		// get XML lang
		Scholar.CSL._xmlLang = Scholar.locale;
		
		// read locales.xml from directory
		var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
				  createInstance();
		req.open("GET", "chrome://scholar/locale/locales.xml", false);
		req.overrideMimeType("text/plain");
		req.send(null);
		
		// get default terms
		var locales = new XML(Scholar.CSL._cleanXML(req.responseText));
		Scholar.CSL._defaultTerms = Scholar.CSL._parseLocales(locales);
	}
}

/*
 * returns an array of short or long month strings
 */
Scholar.CSL.getMonthStrings = function(form) {
	Scholar.CSL.init();
	return Scholar.CSL._defaultTerms[form]["_months"];
}

/*
 * removes parse instructions from XML
 */
Scholar.CSL._cleanXML = function(xml) {
	return xml.replace(/<\?[^>]*\?>/g, "");
}

/*
 * parses locale strings into Scholar.CSL._defaultTerms
 */
Scholar.CSL._parseLocales = function(termXML) {
	// return defaults if there are no terms
	if(!termXML.length()) {
		return (Scholar.CSL._defaultTerms ? Scholar.CSL._defaultTerms : {});
	}
	
	var xml = new Namespace("http://www.w3.org/XML/1998/namespace");
	
	// get proper locale
	var locale = termXML.locale.(@xml::lang == Scholar.CSL._xmlLang);
	if(!locale.length()) {
		var xmlLang = Scholar.CSL._xmlLang.substr(0, 2);
		locale = termXML.locale.(@xml::lang == xmlLang);
	}
	if(!locale.length()) {
		// return defaults if there are no locales
		return (Scholar.CSL._defaultTerms ? Scholar.CSL._defaultTerms : {});
	}
	
	var termArray = new Object();
	termArray["default"] = new Object();
	
	if(Scholar.CSL._defaultTerms) {
		// ugh. copy default array. javascript dumb.
		for(var i in Scholar.CSL._defaultTerms) {
			termArray[i] = new Object();
			for(var j in Scholar.CSL._defaultTerms[i]) {
				if(typeof(Scholar.CSL._defaultTerms[i]) == "object") {
					termArray[i][j] = [Scholar.CSL._defaultTerms[i][j][0],
									Scholar.CSL._defaultTerms[i][j][1]];
				} else {
					termArray[i][j] = Scholar.CSL._defaultTerms[i][j];
				}
			}
		}
	}
	
	// loop through terms
	for each(var term in locale.term) {
		var name = term.@name.toString();
		if(!name) {
			throw("citations cannot be generated: no name defined on term in CSL");
		}
		// unless otherwise specified, assume "long" form
		var form = term.@form.toString();
		if(!form) {
			var form = "long";
		}
		if(!termArray[form]) {
			termArray[form] = new Object();
		}
		
		var single = term.single.text().toString();
		var multiple = term.multiple.text().toString();
		if(single || multiple) {
			if((single && multiple)			// if there's both elements or
			  || !termArray[form][name]) {	// no previously defined value
				termArray[form][name] = [single, multiple];
			} else {
				if(typeof(termArray[name]) != "object") {
					// if old object was just a single value, make it two copies
					termArray[form][name] = [termArray[form][name], termArray[form][name]];
				}
				
				// redefine either single or multiple
				if(single) {
					termArray[form][name][0] = single;
				} else {
					termArray[form][name][1] = multiple;
				}
			}
		} else {
			if(name.substr(0, 6) == "month-") {
				// place months into separate array
				if(!termArray[form]["_months"]) {
					termArray[form]["_months"] = new Array();
				}				
				var monthIndex = parseInt(name.substr(6),10)-1;
				var term = term.text().toString();
				termArray[form]["_months"][monthIndex] = term[0].toUpperCase()+term.substr(1).toLowerCase();
			} else {
				termArray[form][name] = term.text().toString();
			}
		}
	}
	
	return termArray;
}

/*
 * parses attributes and children for a CSL field
 */
Scholar.CSL.prototype._parseFieldAttrChildren = function(element, desc, ignoreChildren) {
	if(!desc) {
		var desc = new Object();
	}
	
	// copy attributes
	var attributes = element.attributes();
	for each(var attribute in attributes) {
		desc[attribute.name()] = attribute.toString();
	}
	
	var children = element.children();
	if(!ignoreChildren) {
		if(children.length()) {
			// parse children
			
			if(children.length() > element.substitute.length()) {
				// if there are non-substitute children, clear the current children
				// array
				desc.children = new Array();
			}
			
			// add children to children array
			for each(var child in children) {
				if(child.namespace() == Scholar.CSL.ns) {	// ignore elements in other
													// namespaces
					// parse recursively
					var name = child.localName();
					if(name == "substitute") {
						// place substitutes in their own key, so that they're
						// overridden separately
						if(child.choose.length) {	// choose
							desc.substitute = new Array();
							
							var chooseChildren = child.choose.children();
							for each(var choose in chooseChildren) {
								if(choose.namespace() == Scholar.CSL.ns) {
									var option = new Object();
									option.name = choose.localName();
									this._parseFieldAttrChildren(choose, option);
									desc.substitute.push(option);
								}
							}
						} else {					// don't choose
							desc.substitute = child.text().toString();
						}
					} else {
						var childDesc = this._parseFieldAttrChildren(child);
						childDesc.name = name;
						desc.children.push(childDesc);
					}
				}
			}
		}
	}
	
	return desc;
}

/*
 * parses a list of fields into a defaults associative array
 */
Scholar.CSL.prototype._parseFieldDefaults = function(ref) {
	for each(var element in ref.children()) {
		if(element.namespace() == Scholar.CSL.ns) {	// ignore elements in other namespaces
			var name = element.localName();
			Scholar.debug("CSL: parsing field defaults for "+name);
			var fieldDesc = this._parseFieldAttrChildren(element);
			
			if(this._defaults[name]) {		// inherit from existing defaults
				this._defaults[name] = this._merge(this._defaults[name],
				                                   fieldDesc);
			} else {
				this._defaults[name] = fieldDesc;
			}
		}
	}
}

/*
 * parses a list of fields into an array of objects
 */
Scholar.CSL.prototype._parseFields = function(ref, position, type, bibCitElement, inheritFormat) {
	var typeDesc = new Array();
	for each(var element in ref) {
		if(element.namespace() == Scholar.CSL.ns) {	// ignore elements in other namespaces
			var itemDesc = new Object();
			itemDesc.name = element.localName();
			
			// add defaults, but only if we're parsing as a reference type
			if(type != undefined) {
				var fieldDefaults = this._getFieldDefaults(itemDesc.name);
				itemDesc = this._merge(fieldDefaults, itemDesc);
				if(bibCitElement && inheritFormat) {
					itemDesc = this._merge(bibCitElement.inheritFormat, itemDesc);
				}
			}
			
			// parse group children
			if(itemDesc.name == "group") {
				// parse attributes on this field, but ignore children
				this._parseFieldAttrChildren(element, itemDesc, true);
				
				var children = element.children();
				if(children.length()) {
					itemDesc.children = this._parseFields(children, position, type, bibCitElement);
				}
			} else {
				// parse attributes on this field
				this._parseFieldAttrChildren(element, itemDesc);
			}
			
			if(type != undefined) {
				// create serialized representation
				itemDesc._serialized = this._serializeElement(itemDesc.name, itemDesc);
				// add to serialization for type
				if(bibCitElement) {
					bibCitElement._serializations[position][type][itemDesc._serialized] = itemDesc;
				}
			}
			
			typeDesc.push(itemDesc);
		}
	}
	return typeDesc;
}

/*
 * parses an et al field
 */
Scholar.CSL.prototype._parseEtAl = function(etAl, bibCitElement) {
	if(etAl.length()) {
		bibCitElement.etAl = new Object();
		
		if(etAl.length() > 1) {
			// separate first and subsequent et als
			for each(var etAlElement in etAl) {
				if(etAlElement.@position == "subsequent") {
					bibCitElement.subsequentEtAl = new Object();
					bibCitElement.subsequentEtAl.minCreators = parseInt(etAlElement['@min-authors'], 10);
					bibCitElement.subsequentEtAl.useFirst = parseInt(etAlElement['@use-first'], 10);
				} else {
					var parseElement = etAlElement;
				}
			}
		} else {
			var parseElement = etAl;
		}
		
		bibCitElement.etAl.minCreators = parseInt(parseElement['@min-authors'], 10);
		bibCitElement.etAl.useFirst = parseInt(parseElement['@use-first'], 10);
	}
}

/*
 * parses cs-format attributes into just a prefix and a suffix; accepts an
 * optional array of cs-format
 */
Scholar.CSL.prototype._parseBibliographyOptions = function() {
	if(!this._csl.bibliography.length()) {
		return;
	}
	
	var bibliography = this._csl.bibliography;
	this._bib = new Object();
	
	// global prefix and suffix format information
	this._bib.inheritFormat = new Array();
	for each(var attribute in bibliography.layout.item.attributes()) {
		this._bib.inheritFormat[attribute.name()] = attribute.toString();
	}
	
	// sections (TODO)
	this._bib.sections = [{groupBy:"default",
		heading:bibliography.layout.heading.text["@term-name"].toString()}];
	for each(var section in bibliography.layout.section) {
		this._bib.sections.push([{groupBy:section["@group-by"].toString(),
			heading:section.heading.text["@term-name"].toString()}]);
	}
	
	// subsequent author substitute
	// replaces subsequent occurances of an author with a given string
	if(bibliography['@subsequent-author-substitute']) {
		this._bib.subsequentAuthorSubstitute = bibliography['@subsequent-author-substitute'].toString();
	}
	
	// hanging indent
	if(bibliography['@hanging-indent']) {
		this._bib.hangingIndent = true;
	}
	
	// sort order
	var algorithm = bibliography.sort.@algorithm.toString();
	if(algorithm) {
		// for classes, use the sort order that 
		if(algorithm == "author-date") {
			this._bib.sortOrder = [this._getFieldDefaults("author"),
			                 this._getFieldDefaults("date")];
			this._bib.sortOrder[0].name = "author";
			this._bib.sortOrder[1].name = "date";
		} else if(algorithm == "label") {
			this._bib.sortOrder = [this._getFieldDefaults("label")];
			this._bib.sortOrder[0].name = "label";
		} else if(algorithm == "cited") {
			this._bib.sortOrder = [this._getFieldDefaults("cited")];
			this._bib.sortOrder[0].name = "cited";
		}
	} else {
		this._bib.sortOrder = this._parseFields(bibliography.sort, "first", false, this._bib);
	}
	
	// parse et al
	this._parseEtAl(bibliography["et-al"], this._bib);
	
	// parse types
	this._parseTypes(this._csl.bibliography.layout.item, this._bib);
}

/*
 * parses cs-format attributes into just a prefix and a suffix; accepts an
 * optional array of cs-format
 */
Scholar.CSL.prototype._parseCitationOptions = function() {
	var citation = this._csl.citation;
	this._cit = new Object();
	
	// parse et al
	this._parseEtAl(citation["et-al"], this._cit);
	
	// global format information
	this._cit.format = new Array();
	for each(var attribute in citation.attributes()) {
		this._cit.format[attribute.name()] = attribute.toString();
	}
	
	// parse types
	this._parseTypes(this._csl.citation.layout.item, this._cit);
}

/*
 * determine available reference types and add their XML objects to the tree
 * (they will be parsed on the fly when necessary; see _parseReferenceType)
 */
Scholar.CSL.prototype._parseTypes = function(itemElements, bibCitElement) {
	Scholar.debug("CSL: parsing item elements");
	
	bibCitElement._types = new Object();
	bibCitElement._serializations = new Object();
	
	// find the type item without position="subsequent"
	for each(var itemElement in itemElements) {
		var position = itemElement.@position.toString();
		if(position) {
			// handle ibids
			if(position == "subsequent" &&
			   itemElement.@ibid.toString() == "true") {
				this.ibid = true;
			}
		} else {
			position = "first";
		}
		
		if(!bibCitElement._types[position]) {
			bibCitElement._types[position] = new Object();
			bibCitElement._serializations[position] = new Object();
		}
		
		// create an associative array of available types
		if(itemElement.choose.length()) {
			for each(var type in itemElement.choose.type) {
				bibCitElement._types[position][type.@name] = type;
				bibCitElement._serializations[position][type.@name] = new Object();
			}
		} else {
			// if there's only one type, bind it to index 0
			bibCitElement._types[position][0] = itemElement;
			bibCitElement._serializations[position][0] = new Object();
		}
	}
}

/*
 * convert reference types to native structures for speed
 */
Scholar.CSL.prototype._getTypeObject = function(position, reftype, bibCitElement) {
	if(!bibCitElement._types[position][reftype]) {
		// no type available
		return false;
	}
	
	// parse type if necessary
	if(typeof(bibCitElement._types[position][reftype]) == "xml") {
		Scholar.debug("CSL: parsing XML for "+reftype);
		bibCitElement._types[position][reftype] = this._parseFields(
		                                          bibCitElement._types[position][reftype].children(),
		                                          position, reftype, bibCitElement, true);
	}
	
	Scholar.debug("CSL: got object for "+reftype);
	return bibCitElement._types[position][reftype];
}

/*
 * merges two elements, letting the second override the first
 */
Scholar.CSL.prototype._merge = function(element1, element2) {
	var mergedElement = new Object();
	for(var i in element1) {
		mergedElement[i] = element1[i];
	}
	for(var i in element2) {
		mergedElement[i] = element2[i];
	}
	return mergedElement;
}

/*
 * gets defaults for a specific element; handles various inheritance rules
 * (contributor, locator)
 */
Scholar.CSL.prototype._getFieldDefaults = function(elementName) {
	// first, see if there are specific defaults
	if(this._defaults[elementName]) {
		if(Scholar.CSL._inherit[elementName]) {
			var inheritedDefaults = this._getFieldDefaults(Scholar.CSL._inherit[elementName]);
			for(var i in inheritedDefaults) {	// will only be called if there
												// is merging necessary
				return this._merge(inheritedDefaults, this._defaults[elementName]);
			}
		}
		return this._defaults[elementName];
	}
	// next, try to get defaults from the item from which this item inherits
	if(Scholar.CSL._inherit[elementName]) {
		return this._getFieldDefaults(Scholar.CSL._inherit[elementName]);
	}
	// finally, return an empty object
	return {};
}

/*
 * gets a term, in singular or plural form
 */
Scholar.CSL.prototype._getTerm = function(term, plural, form) {
	if(!form) {
		form = "long";
	}
	if(!this._terms[form][term]) {
		return "";
	}
	
	if(typeof(this._terms[form][term]) == "object") {	// singular and plural forms
	                                                    // are available
		if(plural) {
			return this._terms[form][term][1];
		} else {
			return this._terms[form][term][0];
		}
	}
	
	return this._terms[form][term];
}

/*
 * escapes a string for a given format
 */
Scholar.CSL.prototype._escapeString = function(string, format) {
	if(format == "HTML") {
		// replace HTML entities
		string = string.replace(/&/g, "&amp;");
		string = string.replace(/</g, "&lt;");
		string = string.replace(/>/g, "&gt;");
		
		return string;
	} else if(format == "RTF") {
		var newString = "";
		
		// go through and fix up unicode entities
		for(i=0; i<string.length; i++) {
			var charCode = string.charCodeAt(i);
			if(charCode > 127) {			// encode unicode
				newString += "\\uc0\\u"+charCode.toString()+" ";
			} else if(charCode == 92) {		// double backslashes
				newString += "\\\\";
			} else {
				newString += string[i];
			}
		}
		
		return newString;
	} else if(format == "Integration") {
		return string.replace(/\\/g, "\\\\");
	} else {
		return string;
	}
}

/*
 * formats a string according to the cs-format attributes on element
 */
Scholar.CSL.prototype._formatString = function(element, string, format, dontEscape) {
	if(!string) return "";
	if(typeof(string) != "string") {
		string = string.toString();
	}
	
	// handle text transformation
	if(element["text-transform"]) {
		if(element["text-transform"] == "lowercase") {
			// all lowercase
			string = string.toLowerCase();
		} else if(element["text-transform"] == "uppercase") {
			// all uppercase
			string = string.toUpperCase();
		} else if(element["text-transform"] == "capitalize") {
			// capitalize first
			string = string[0].toUpperCase()+string.substr(1);
		}
	}
	
	// special rule: if a field ends in a punctuation mark, and the suffix
	// begins with a period, chop the period off the suffix
	var suffix;
	if(element.suffix) {
		suffix = element.suffix;	// copy so as to leave original intact
		
		if(suffix[0] == ".") {
			var lastChar = string[string.length-1];
			if(lastChar == "." || lastChar == "?" || lastChar == "!") {
				suffix = suffix.substr(1);
			}
		}
	}
	
	if(!dontEscape) {
		string = this._escapeString(string, format);
	}
	
	if(format == "HTML") {
		var style = "";
		
		var cssAttributes = ["font-family", "font-style", "font-variant",
							 "font-weight"];
		for(var j in cssAttributes) {
			if(element[cssAttributes[j]] && element[cssAttributes[j]].indexOf('"') == -1) {
				style += cssAttributes[j]+":"+element[cssAttributes[j]];
			}
		}
		
		if(style) {
			string = '<span style="'+style+'">'+string+'</span>';
		}
	} else if(format == "RTF" || format == "Integration") {
		if(element["font-style"] && (element["font-style"] == "oblique" || element["font-style"] == "italic")) {
			string = "\\i "+string+"\\i0 ";
		}
		if(element["font-variant"] && element["font-variant"] == "small-caps") {
			string = "\\scaps "+string+"\\scaps0 ";
		}
		if(element["font-weight"] && element["font-weight"] == "bold") {
			string = "\\b "+string+"\\b0 ";
		}
	}
	
	if(format != "compare" && element.prefix) {
		string = this._escapeString(element.prefix, format)+string;
	}
	if(format != "compare" && suffix) {
		string += this._escapeString(suffix, format);
	}
	
	return string;
}

/*
 * formats a locator (pages, volume, issue) or an identifier (isbn, doi)
 * note that label should be null for an identifier
 */
Scholar.CSL.prototype._formatLocator = function(identifier, element, number, format) {
	var data = "";
	
	if(number) {
		for(var i in element.children) {
			var child = element.children[i];
			var string = "";
			
			if(child.name == "number") {
				string = number;
			} else if(child.name == "text") {
				var plural = (identifier && (number.indexOf(",") != -1
				              || number.indexOf("-") != -1));
				string = this._getTerm(child["term-name"], plural, child["form"]);
			} else if(identifier && child.name == "label") {
				var plural = (number.indexOf(",") != -1 || number.indexOf("-") != -1);
				string = this._getTerm(identifier, plural, child["form"]);
			}
				
			if(string) {
				data += this._formatString(child, string, format);
			}
		}
	}
	
	return data;
}

/*
 * format the date in format supplied by element from the date object
 * returned by this._processDate
 */
Scholar.CSL.prototype._formatDate = function(element, date, format) {
	if(format == "disambiguate") {
		// for disambiguation, return only the year
		return date.year;
	}
	
	var data = "";
	
	for(var i in element.children) {
		var child = element.children[i];
		var string = "";
		
		if(child.name == "year" && date.year) {
			if(format == "compare") {
				string = this._lpad(date.year, "0", 4);
			} else {
				string = date.year.toString();
				if(date.disambiguation) {
					string += date.disambiguation;
				}
			}
		} else if(child.name == "month") {
			if(date.month != undefined) {
				if(format == "compare") {
					string = this._lpad(date.month+1, "0", 2);
				} else {
					if(element.form == "short") {
						string = this._terms["short"]["_months"][date.month];
					} else {
						string = this._terms["long"]["_months"][date.month];
					}
				}
			} else if(date.part && format != "compare") {
				string = date.part;
			}
		} else if(child.name == "day" && date.day) {
			if(format == "compare") {
				string = this._lpad(date.day, "0", 2);
			} else {
				string = date.day.toString();
			}
		} else if(child.name == "text") {
			string = this._getTerm(child["term-name"], false, child["form"]);
		}
		
		if(string) {
			data += this._formatString(child, string, format);
		}
	}
	
	return data;
}

/*
 * serializes an element into a string suitable to prevent substitutes from
 * recurring in the same style
 */
Scholar.CSL.prototype._serializeElement = function(name, element) {
	var string = name;
	if(element.relation) {
		string += " relation:"+element.relation;
	}
	if(element.role) {
		string += " role:"+element.role;
	}
	return string;
}

/*
 * pads a number or other string with a given string on the left
 */
Scholar.CSL.prototype._lpad = function(string, pad, length) {
	while(string.length < length) {
		string = pad + string;
	}
	return string;
}

/*
 * handles sorting of items
 */
Scholar.CSL.prototype._compareItem = function(a, b, opt) {
	for(var i in this._bib.sortOrder) {
		var sortElement = this._bib.sortOrder[i];
		
		var aValue = this._getFieldValue(sortElement.name, sortElement, a,
		                                 "compare", this._bib);
		var bValue = this._getFieldValue(sortElement.name, sortElement, b,
		                                 "compare", this._bib);
		if(bValue > aValue) {
			return -1;
		} else if(bValue < aValue) {
			return 1;
		}
	}

	// finally, give up; they're the same
	return 0;
}

/*
 * process creator objects; if someone had a creator model that handled
 * non-Western names better than ours, this would be the function to change
 */
Scholar.CSL.prototype._processCreators = function(type, element, creators, format, bibCitElement) {
	var maxCreators = creators.length;
	if(!maxCreators) return;
	
	if(format == "disambiguate") {
		// for disambiguation, return only the last name of the first creator
		return creators[0].lastName;;
	}
	if(!element.children) {
		return "";
	}
	
	var data = "";
	for(var i in element.children) {
		var child = element.children[i];
		var string = "";
		
		if(child.name == "name") {			
			var useEtAl = false;
			
			// figure out if we need to use "et al"
			if(bibCitElement.etAl && maxCreators >= bibCitElement.etAl.minCreators) {
				maxCreators = bibCitElement.etAl.useFirst;
				useEtAl = true;
			}
			
			// parse authors into strings
			var authorStrings = [];
			var firstName, lastName;
			for(var i=0; i<maxCreators; i++) {
				var firstName = "";
				if(element["form"] != "short") {
					if(child["initialize-with"] != undefined) {
						// even if initialize-with is simply an empty string, use
						// initials
						
						// use first initials
						var firstNames = creators[i].firstName.split(" ");
						for(var j in firstNames) {
							if(firstNames[j]) {
								// get first initial, put in upper case, add initializeWith string
								firstName += firstNames[j][0].toUpperCase()+child["initialize-with"];
							}
						}
					} else {
						firstName = creators[i].firstName;
					}
				}
				lastName = creators[i].lastName;
				
				if(element["name-as-sort-order"]
				  && ((i == 0 && element["name-as-sort-order"] == "first")
				  || element["name-as-sort-order"] == "all")
				  && child["sort-separator"]) {
					// if this is the first author and name-as-sort="first"
					// or if this is a subsequent author and name-as-sort="all"
					// then the name gets inverted
					authorStrings.push(lastName+(firstName ? child["sort-separator"]+firstName : ""));
				} else {
					authorStrings.push((firstName ? firstName+" " : "")+lastName);
				}
			}
			
			// figure out if we need an "and" or an "et al"
			var joinString = (child["delimiter"] ? child["delimiter"] : ", ");
			if(creators.length > 1) {
				if(useEtAl) {	// multiple creators and need et al
					authorStrings.push(this._getTerm("et-al"));
				} else {		// multiple creators but no et al
					// add and to last creator
					if(child["and"]) {
						if(child["and"] == "symbol") {
							var and = "&"
						} else if(child["and"] == "text") {
							var and = this._getTerm("and");
						}
						
						authorStrings[maxCreators-1] = and+" "+authorStrings[maxCreators-1];
						// skip the comma if there are only two creators and no
						// et al, and name as sort is no
						if((maxCreators == 2 && child["delimiter-precedes-last"] != "always") ||
						   (maxCreators > 2 && child["delimiter-precedes-last"] == "never")) {
						   	var lastString = authorStrings.pop();
							authorStrings[maxCreators-2] = authorStrings[maxCreators-2]+" "+lastString;
						}
					}
				}
			}
			string = authorStrings.join(joinString);
		} else if(child.name == "label") {
			string = this._getTerm(type, (maxCreators != 1), child["form"]);
		}
		
		
		// add string to data
		if(string) {
			data += this._formatString(child, string, format);
		}			
	}
	
	// add to the data
	return data;
}

/*
 * get a citation, given an item and bibCitElement
 */
Scholar.CSL.prototype._getCitation = function(item, position, locatorType, locator, format, bibCitElement) {
	Scholar.debug("CSL: generating citation for item "+item.getID());
	
	if(!bibCitElement._types[position]) {
		position = "first";
	}
	
	// determine mapping
	if(bibCitElement._types[position][0]) {
		// only one element
		var typeName = 0;
		var type = this._getTypeObject(position, typeName, bibCitElement);
	} else {
		var typeNames = this._getTypeFromItem(item);
		for each(var typeName in typeNames) {
			var type = this._getTypeObject(position, typeName, bibCitElement);
			if(type) {
				break;
			}
		}
	}
	
	if(!type) {
		return false;
	}
	Scholar.debug("CSL: using CSL type "+typeName);
	
	// remove previous ignore entries from list
	this._ignore = new Array();
	var string = "";
	for(var j in type) {
		var value = this._getFieldValue(type[j].name, type[j], item, format,
										bibCitElement, position, locatorType,
										locator, typeName);
		string += value;
	}
	
	return string;
}

/*
 * processes an element from a (pre-processed) item into text
 */
Scholar.CSL.prototype._getFieldValue = function(name, element, item, format,
                                                bibCitElement, position,
                                                locatorType, locator, typeName) {
	var data = "";
	
	var itemID = item.getID();
	if(element._serialized && this._ignore && this._ignore[itemID] && this._ignore[itemID][element._serialized]) {
		return "";
	}
	
	// controls whether formatted strings need to be escaped a second time
	var dontEscape = true;
	
	if(name == "author") {
		if(item._csl.subsequentAuthorSubstitute && bibCitElement.subsequentAuthorSubstitute) {
			// handle subsequent author substitute behavior
			data = bibCitElement.subsequentAuthorSubstitute;
		} else {
			data = this._processCreators(name, element, item._csl.authors, format, bibCitElement);
		}
	} else if(name == "editor") {
		data = this._processCreators(name, element, item._csl.editors, format, bibCitElement);
	} else if(name == "translator") {
		data = this._processCreators(name, element, item._csl.translators, format, bibCitElement);
	} else if(name == "titles") {
		for(var i in element.children) {
			var child = element.children[i];
			var string = "";
			
			if(child.name == "title") {	// for now, we only care about the
									// "title" sub-element
				if(!element.relation) {
					string = item.getField("title");
				} else if(element.relation == "container") {
					string = item.getField("publicationTitle");
				} else if(element.relation == "collection") {
					string = item.getField("seriesTitle");
				}
			}
				
			if(string) {
				data += this._formatString(child, string, format);
			}
		}
	} else if(name == "date") {
		data = this._formatDate(element, item._csl.date, format);
	} else if(name == "publisher") {
		for(var i in element.children) {
			var child = element.children[i];
			var string = "";
			
			if(child.name == "place") {
				string = item.getField("place");
			} else if(child.name == "name") {
				string = item.getField("publisher");
			}
				
			if(string) {
				data += this._formatString(child, string, format);
			}
		}
	} else if(name == "access") {
		var save = false;
		
		for(var i in element.children) {
			var child = element.children[i];
			var string = "";
			
			if(child.name == "url") {
				string = item.getField("url");
			} else if(child.name == "date") {
				var field = item.getField("accessDate");
				if(field) {
					string = this._formatDate(child, this._processDate(field), format);
				}
			} else if(child.name == "physicalLocation") {
				string = item.getField("archiveLocation");
			} else if(child.name == "text") {
				string = this._getTerm(child["term-name"], false, child["form"]);
			}
				
			if(string) {
				data += this._formatString(child, string, format);
				if(child.name != "text") {
					// only save if there's non-text data
					save = true;
				}
			}
		}
		
		if(!save) {
			data = "";
		}
	} else if(name == "volume" || name == "issue") {
		var field = item.getField(name);
		if(field) {
			data = this._formatLocator(name, element, field, format);
		}
	} else if(name == "pages") {
		if(locatorType == "page") {
			var field = locator;
		} else if(typeName != "book") {
			var field = item.getField("pages");
		}
		
		if(field) {
			data = this._formatLocator("page", element, field, format);
		}
	} else if(name == "locator") {
		if(locator) {
			data = this._formatLocator(locatorType, element, locator, format);
		}
	} else if(name == "edition") {
		data = item.getField("edition");
		dontEscape = false;
	} else if(name == "genre") {
		data = item.getField("type");
		if(!data) {
			data = item.getField("thesisType");
		}
		dontEscape = false;
	} else if(name == "group") {
		var childData = new Array();
		for(var i in element.children) {
			// get data for each child element
			var child = element.children[i];
			
			var string = this._getFieldValue(child.name, child, item,
			                                 format, bibCitElement, position,
			                                 typeName);
			if(string) {
				childData.push(string);
			}
		}
		
		// implode with delimiter
		data = childData.join((element["delimiter"] ? element["delimiter"] : ""));
	} else if(name == "text") {
		data = this._getTerm(element["term-name"], false, element["form"]);
		dontEscape = false;
	} else if(name == "isbn" || name == "doi") {
		var field = item.getField(name.toUpperCase());
		if(field) {
			data = this._formatLocator(null, element, field, format);
		}
	} else if(name == "number") {
		data = this._csl.number;
		dontEscape = false;
	}
	
	if(data) {
		return this._formatString(element, data, format, dontEscape); 
	} else if(element.substitute) {
		// try each substitute element until one returns something
		for(var i in element.substitute) {
			var substituteElement = element.substitute[i];
			var serialization = this._serializeElement(substituteElement.name,
			                                           substituteElement);
			
			var inheritElement;
			if(Scholar.CSL._inherit[substituteElement.name] && Scholar.CSL._inherit[name]
			   && Scholar.CSL._inherit[substituteElement.name] == Scholar.CSL._inherit[name]) {
				// if both substituteElement and the parent element inherit from
				// the same base element, apply styles here
				inheritElement = element;
			} else {
				// search for elements with the same serialization
				if(typeName != undefined && bibCitElement._serializations[position]
				   && bibCitElement._serializations[position][typeName]
				   && bibCitElement._serializations[position][typeName][serialization]) {
					inheritElement = bibCitElement._serializations[position][typeName][serialization];
				} else {
					// otherwise, use defaults
					inheritElement = this._getFieldDefaults(substituteElement.name);
				}
			}
			
			// merge inheritElement and element
			substituteElement = this._merge(inheritElement, substituteElement);
			// regardless of inheritance pathway, make sure substitute inherits
			// general prefix and suffix from the element it's substituting for
			substituteElement.prefix = element.prefix;
			substituteElement.suffix = element.suffix;
			// clear substitute element off of the element we're substituting
			substituteElement.substitute = undefined;
			
			// get field value
			data = this._getFieldValue(substituteElement.name,
			                           substituteElement, item, format,
			                           bibCitElement, position, typeName);
			
			// ignore elements with the same serialization
			if(this._ignore) {	// array might not exist if doing disambiguation
				if(!this._ignore[itemID]) this._ignore[itemID] = new Array();
				this._ignore[itemID][substituteElement._serialized] = true;
			}
			
			// return field value, if there is one; otherwise, keep processing
			// the data
			if(data) {
				return data;
			}
		}
	}
	
	return "";
}

/*
 * THE FOLLOWING CODE IS SCHOLAR-SPECIFIC
 * gets a list of possible CSL types, in order of preference, for an item
 */
 Scholar.CSL._optionalTypeMappings = {
	journalArticle:"article-journal",
	magazineArticle:"article-magazine",
	newspaperArticle:"article-newspaper",
	thesis:"thesis",
	letter:"personal communication",
	manuscript:"manuscript",
	interview:"interview",
	film:"motion picture",
	artwork:"graphic",
	website:"webpage"
};
// TODO: check with Elena/APA/MLA on this
Scholar.CSL._fallbackTypeMappings = {
	book:"book",
	bookSection:"chapter",
	journalArticle:"article",
	magazineArticle:"article",
	newspaperArticle:"article",
	thesis:"book",
	letter:"article",
	manuscript:"book",
	interview:"book",
	film:"book",
	artwork:"book",
	website:"article"
};

Scholar.CSL.prototype._getTypeFromItem = function(item) {
	var scholarType = Scholar.ItemTypes.getName(item.getType());

	// get type
	Scholar.debug("CSL: parsing item of Scholar type "+scholarType);
	return [Scholar.CSL._optionalTypeMappings[scholarType], Scholar.CSL._fallbackTypeMappings[scholarType]];
}

/*
 * separate creators object into authors, editors, and translators
 */
Scholar.CSL.prototype._separateItemCreators = function(item) {
	var authors = new Array();
	var editors = new Array();
	var translators = new Array();
	
	var authorID = Scholar.CreatorTypes.getID("author");
	var editorID = Scholar.CreatorTypes.getID("editor");
	var translatorID = Scholar.CreatorTypes.getID("translator");
	
	var creators = item.getCreators();
	for(var j in creators) {
		var creator = creators[j];
		
		if(creator.creatorTypeID == editorID) {
			editors.push(creator);
		} else if(creator.creatorTypeID == translatorID) {
			translators.push(creator);
		} else if(creator.creatorTypeID == authorID) {
			// TODO: do we just ignore contributors?
			authors.push(creator);
		}
	}
	
	return [authors, editors, translators];
}

/*
 * return an object containing year, month, and day
 */
Scholar.CSL.prototype._processDate = function(string) {
	return Scholar.Date.strToDate(string);
}
/*
 * END SCHOLAR-SPECIFIC CODE
 */