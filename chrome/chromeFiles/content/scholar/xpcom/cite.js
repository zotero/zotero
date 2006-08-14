/*
 * Scholar.Cite: a class for creating bibliographies from within Scholar
 * this class handles pulling the CSL file and item data out of the database,
 * while CSL, below, handles the actual generation of the bibliography
 */
default xml namespace = "http://purl.org/net/xbiblio/csl";

Scholar.Cite = new function() {
	this.getBibliography = getBibliography;
	this.getStyles = getStyles;
	
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
	
	function getBibliography(cslID, items, format) {
		// get style
		var sql = "SELECT csl FROM csl WHERE cslID = ?";
		var style = Scholar.DB.valueQuery(sql, [cslID]);
		
		// get item arrays
		var itemArrays = new Array();
		for(var i in items) {
			itemArrays.push(items[i].toArray());
		}
		
		// create a CSL instance
		var cslInstance = new CSL(style);
		// return bibliography
		return cslInstance.createBibliography(itemArrays, format);
	}
}

/*
 * CSL: a class for creating bibliographies from CSL files
 * this is abstracted as a separate class for the benefit of anyone who doesn't
 * want to use the Scholar data model, but does want to use CSL in JavaScript
 */
CSL = function(csl) {
	this._csl = new XML(this._cleanXML(csl));
	
	// initialize CSL
	this._init();
	
	// load localizations
	this._terms = this._parseTerms(this._csl.terms);
	
	// load class defaults
	this._class =  this._csl["@class"].toString();
	
	this._defaults = new Object();
	// load class defaults
	if(CSL._classDefaults[this._class]) {
		var classDefaults = CSL._classDefaults[this._class];
		for(var i in classDefaults) {
			this._defaults[i] = classDefaults[i];
		}
	}
	// load defaults from CSL
	this._parseFieldDefaults(this._csl.defaults);
	
	// decide whether to parse bibliography, or, if none exists, citation
	if(this._csl.bibliography.length()) {
		var cite = this._csl.bibliography;
		this._parseBibliographyOptions();
		
		this._itemElement = this._csl.bibliography.layout.item;
	} else {
		var cite = this._csl.citation;
		this._parseCitationOptions();
		
		// find the type item without position="subsequent"
		var itemElements = this._csl.citation.layout.item;
		for each(var itemElement in itemElements) {
			if(itemElement.@position.toString() != "subsequent") {
				this._itemElement = itemElement;
				break;
			}
		}
		if(!this._itemElement) {
			throw("no primary item found in citation. cannot cite.");
		}
	}
	
	// create an associative array of available types
	if(this._itemElement.choose) {
		this._types = new Object();
		this._serializations = new Object();
		for each(var type in this._itemElement.choose.type) {
			this._types[type.@name] = true;
			this._serializations[type.@name] = new Object();
		}
	} else {
		// if there's only one type, bind it to index 0
		this._serializations[0] = new Object();
		this._types[0] = this._parseFields(this._itemElement.children(), 0);
	}
}

/*
 * create a bibliography
 * (items is expected to be an array of items)
 */
CSL.prototype.createBibliography = function(items, format) {
	// preprocess items
	this._preprocessItems(items);
	
	// sort by sort order
	if(this._opt.sortOrder) {
		var me = this;
		items.sort(function(a, b) {
			return me._compareItem(a, b);
		});
	}
	
	// disambiguate items
	this._disambiguateItems(items);
	
	// process items
	var output = "";
	
	if(format == "HTML") {
		var style = ""; 
		if(this._opt.hangingIndent) {
			style = "margin-left:0.5in;text-indent:-0.5in;";
		}
	} else if(format == "RTF") {
		output += "{\\rtf\\mac\\ansicpg10000{\\fonttbl\\f0\\froman Times New Roman;}{\\colortbl;\\red255\\green255\\blue255;}\\pard\\f0";
		if(this._opt.hangingIndent) {
			output += "\\li720\\fi-720";
		}
	}
	
	for(var i in items) {
		var item = items[i];
		if(item.itemType == "note" || item.itemType == "file") {
			// skip notes and files
			continue;
		}
		
		// determine mapping
		if(!this._types[0]) {	// multiple types
			if(CSL._optionalTypeMappings[item.itemType]
			   && this._types[CSL._optionalTypeMappings[item.itemType]]) {
			   	// try preferred types first
				if(this._types[CSL._optionalTypeMappings[item.itemType]] === true) {
					// exists but not yet processed
					this._parseReferenceType(CSL._optionalTypeMappings[item.itemType]);
				}
				
				var typeName = CSL._optionalTypeMappings[item.itemType];
			} else {
				// otherwise, use fallback types
				if(this._types[CSL._fallbackTypeMappings[item.itemType]] === true) {
					this._parseReferenceType(CSL._fallbackTypeMappings[item.itemType]);
				}
				
				var typeName = CSL._fallbackTypeMappings[item.itemType];
			}
		} else {		// only one element
			var typeName = 0;
		}
		
		var type = this._types[typeName];
		
		var string = "";
		for(var j in type) {
			var value = this._getFieldValue(type[j].name, type[j], item, format, typeName);
			
			if(this._opt.format && this._opt.format.delimiter && string && value) {
				// add delimiter before if one exists, and this isn't the first
				// element with content
				string += this._opt.format.delimiter;
			}
			string += value;
		}
			
		if(this._opt.format) {
			// add citation prefix or suffix
			if(this._opt.format.prefix) {
				string = string + this._opt.format.prefix;
			}
			
			if(this._opt.format.suffix) {
				string = string + this._opt.format.suffix;
			}
		}
			
		if(this._class == "note") {
			// add superscript number for footnotes
			string += (parseInt(i)+1).toString()+". ";
		}
		
		// add line feeds
		if(format == "HTML") {
			output += "<p";
			
			if(style) {
				output += ' style="'+style+'"';
			}
			
			output += ">"+string+"</p>";
		} else if(format == "RTF") {
			output += string+"\\\r\n\\\r\n";
		}
	}
	
	if(format == "RTF") {
		// drop last 6 characters of output (last two returns)
		output = output.substr(0, output.length-6)+"}";
	}
	
	return output;
}


CSL._months = ["January", "February", "March", "April", "May", "June", "July",
               "August", "September", "October", "November", "December"];
CSL._monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

CSL._optionalTypeMappings = {
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
CSL._fallbackTypeMappings = {
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
// for elements that inherit defaults from each other
CSL._inherit = {
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
CSL._classDefaults = new Object();
CSL._classDefaults["author-date"] = {
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

CSL.ns = "http://purl.org/net/xbiblio/csl";

CSL.prototype._cleanXML = function(xml) {
	return xml.replace(/<\?[^>]*\?>/g, "");
}

CSL.prototype._init = function() {
	if(!CSL._xmlLang) {
		// get XML lang
		var localeService = Components.classes['@mozilla.org/intl/nslocaleservice;1'].
							getService(Components.interfaces.nsILocaleService);
		CSL._xmlLang = localeService.getLocaleComponentForUserAgent();
		
		// read locales.xml from directory
		var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
				  createInstance();
		req.open("GET", "chrome://scholar/locale/locales.xml", false);
		req.overrideMimeType("text/plain");
		req.send(null);
		
		// get default terms
		var terms = new XML(this._cleanXML(req.responseText));
		CSL._defaultTerms = this._parseTerms(terms);
	}
}

CSL.prototype._parseTerms = function(termXML) {
	// return defaults if there are no terms
	if(!termXML.length()) {
		return (CSL._defaultTerms ? CSL._defaultTerms : {});
	}
	
	var xml = new Namespace("http://www.w3.org/XML/1998/namespace");
	
	// get proper locale
	var locale = termXML.locale.(@xml::lang == CSL._xmlLang);
	if(!locale.length()) {
		var xmlLang = CSL._xmlLang.substr(0, 2);
		locale = termXML.locale.(@xml::lang == xmlLang);
	}
	if(!locale.length()) {
		// return defaults if there are no locales
		return (CSL._defaultTerms ? CSL._defaultTerms : {});
	}
	
	var termArray = new Array();
	if(CSL._defaultTerms) {
		// ugh. copy default array. javascript dumb.
		for(var i in CSL._defaultTerms) {
			if(typeof(CSL._defaultTerms[i]) == "object") {
				termArray[i] = [CSL._defaultTerms[i][0],
				                CSL._defaultTerms[i][1]];
			} else {
				termArray[i] = CSL._defaultTerms[i];
			}
		}
	}
	
	// loop through terms
	for each(var term in locale.term) {
		var name = term.@name.toString();
		if(!name) {
			throw("citations cannot be generated: no name defined on term in CSL");
		}
		
		var single = term.single.text().toString();
		var multiple = term.multiple.text().toString();
		if(single || multiple) {
			if((single && multiple)		// if there's both elements or
			  || !termArray[name]) {	// no previously defined value
				termArray[name] = [single, multiple];
			} else {
				if(typeof(termArray[name]) != "object") {
					termArray[name] = [termArray[name], termArray[name]];
				}
				
				// redefine either single or multiple
				if(single) {
					termArray[name][0] = single;
				} else {
					termArray[name][1] = multiple;
				}
			}
		} else {
			termArray[name] = term.text().toString();
		}
	}
	
	return termArray;
}

/*
 * parses attributes and children for a CSL field
 */
CSL.prototype._parseFieldAttrChildren = function(element, desc) {
	if(!desc) {
		var desc = new Object();
	}
	
	// copy attributes
	var attributes = element.attributes();
	for each(var attribute in attributes) {
		desc[attribute.name()] = attribute.toString();
	}
	
	var children = element.children();
	if(children.length()) {
		// parse children
		
		if(children.length() > element.substitute.length()) {
			// if there are non-substitute children, clear the current children
			// array
			desc.children = new Array();
		}
		
		// add children to children array
		for each(var child in children) {
			if(child.namespace() == CSL.ns) {	// ignore elements in other
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
							if(choose.namespace() == CSL.ns) {
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
	
	return desc;
}

/*
 * parses a list of fields into a defaults associative array
 */
CSL.prototype._parseFieldDefaults = function(ref) {
	for each(var element in ref.children()) {
		if(element.namespace() == CSL.ns) {	// ignore elements in other namespaces
			var name = element.localName();
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
CSL.prototype._parseFields = function(ref, type) {
	var typeDesc = new Array();
	for each(var element in ref) {
		if(element.namespace() == CSL.ns) {	// ignore elements in other namespaces
			var itemDesc = new Object();
			itemDesc.name = element.localName();
			
			// parse attributes on this field
			this._parseFieldAttrChildren(element, itemDesc);
			
			// add defaults, but only if we're parsing as a reference type
			if(type != undefined) {
				var fieldDefaults = this._getFieldDefaults(itemDesc.name);
				itemDesc = this._merge(fieldDefaults, itemDesc);
				if(this._opt.inheritFormat) {
					itemDesc = this._merge(this._opt.inheritFormat, itemDesc);
				}
			
				// create serialized representation
				itemDesc._serialized = this._serializeElement(itemDesc.name, itemDesc);
				// add to serialization for type
				this._serializations[type][itemDesc._serialized] = itemDesc;
			}
			
			// parse group children
			if(itemDesc.name == "group" && itemDesc.children) {
				for(var i in itemDesc.children) {
					// don't bother merging fieldDefaults
					itemDesc.children[i] = this._merge(this._getFieldDefaults(itemDesc.children[i].name),
					                                   itemDesc.children[i]);
					if(type != undefined) {
						// serialize children
						itemDesc.children[i]._serialized = this._serializeElement(itemDesc.children[i].name,
						                                   itemDesc.children[i]);
						// add to serialization for type
						this._serializations[type][itemDesc._serialized] = itemDesc;
					}
				}
			}
			
			typeDesc.push(itemDesc);
		}
	}
	return typeDesc;
}

CSL.prototype._parseEtAl = function(etAl) {
	if(etAl.length()) {
		this._opt.etAl = new Object();
		
		if(etAl.length() > 1) {
			// separate first and subsequent et als
			for each(var etAlElement in etAl) {
				if(etAlElement.@position == "subsequent") {
					this._opt.subsequentEtAl = new Object();
					this._opt.subsequentEtAl.minCreators = parseInt(etAlElement['@min-authors']);
					this._opt.subsequentEtAl.useFirst = parseInt(etAlElement['@use-first']);
				} else {
					var parseElement = etAlElement;
				}
			}
		} else {
			var parseElement = etAl;
		}
		
		this._opt.etAl.minCreators = parseInt(parseElement['@min-authors']);
		this._opt.etAl.useFirst = parseInt(parseElement['@use-first']);
	}
}

/*
 * parses cs-format attributes into just a prefix and a suffix; accepts an
 * optional array of cs-format
 */
CSL.prototype._parseBibliographyOptions = function() {
	var bibliography = this._csl.bibliography;
	this._opt = new Object();
	
	// global prefix and suffix format information
	this._opt.inheritFormat = new Array();
	for each(var attribute in bibliography.layout.item.attributes()) {
		this._opt.inheritFormat[attribute.name()] = attribute.toString();
	}
	
	// sections (TODO)
	this._opt.sections = [{groupBy:"default",
		heading:bibliography.layout.heading.text["@term-name"].toString()}];
	for each(var section in bibliography.layout.section) {
		this._opt.sections.push([{groupBy:section["@group-by"].toString(),
			heading:section.heading.text["@term-name"].toString()}]);
	}
	
	// subsequent author substitute
	// replaces subsequent occurances of an author with a given string
	if(bibliography['@subsequent-author-substitute']) {
		this._opt.subsequentAuthorSubstitute = bibliography['@subsequent-author-substitute'].toString();
	}
	
	// hanging indent
	if(bibliography['@hanging-indent']) {
		this._opt.hangingIndent = true;
	}
	
	// sort order
	var algorithm = bibliography.sort.@algorithm.toString();
	if(algorithm) {
		// for classes, use the sort order that 
		if(algorithm == "author-date") {
			this._opt.sortOrder = [this._getFieldDefaults("author"),
			                 this._getFieldDefaults("date")];
			this._opt.sortOrder[0].name = "author";
			this._opt.sortOrder[1].name = "date";
		} else if(algorithm == "label") {
			this._opt.sortOrder = [this._getFieldDefaults("label")];
			this._opt.sortOrder[0].name = "label";
		} else if(algorithm == "cited") {
			this._opt.sortOrder = [this._getFieldDefaults("cited")];
			this._opt.sortOrder[0].name = "cited";
		}
	} else {
		this._opt.sortOrder = this._parseFields(bibliography.sort, false);
	}
	
	// parse et al
	this._parseEtAl(bibliography["use-et_al"]);
}

/*
 * parses cs-format attributes into just a prefix and a suffix; accepts an
 * optional array of cs-format
 */
CSL.prototype._parseCitationOptions = function() {
	var citation = this._csl.citation;
	this._opt = new Object();
	
	// parse et al
	this._parseEtAl(citation["use-et_al"]);
	
	// global format information
	this._opt.format = new Array();
	for each(var attribute in citation.attributes()) {
		this._opt.format[attribute.name()] = attribute.toString();
	}
}

/*
 * convert reference types to native structures for speed
 */
CSL.prototype._parseReferenceType = function(reftype) {
	var ref = this._itemElement.choose.type.(@name==reftype).children();
	this._types[reftype] = this._parseFields(ref, reftype);
}

/*
 * merges two elements, letting the second override the first
 */
CSL.prototype._merge = function(element1, element2) {
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
CSL.prototype._getFieldDefaults = function(elementName) {
	// first, see if there are specific defaults
	if(this._defaults[elementName]) {
		if(CSL._inherit[elementName]) {
			var inheritedDefaults = this._getFieldDefaults(CSL._inherit[elementName]);
			for(var i in inheritedDefaults) {	// will only be called if there
												// is merging necessary
				return this._merge(inheritedDefaults, this._defaults[elementName]);
			}
		}
		return this._defaults[elementName];
	}
	// next, try to get defaults from the item from which this item inherits
	if(CSL._inherit[elementName]) {
		return this._getFieldDefaults(CSL._inherit[elementName]);
	}
	// finally, return an empty object
	return {};
}

/*
 * gets a term, in singular or plural form
 */
CSL.prototype._getTerm = function(term, plural) {
	if(!this._terms[term]) {
		return "";
	}
	
	if(typeof(this._terms[term]) == "object") {	// singular and plural forms
	                                            // are available
		if(plural) {
			return this._terms[term][1];
		} else {
			return this._terms[term][0];
		}
	}
	
	return this._terms[term];
}

/*
 * process the date "string" into a useful object
 */
CSL.prototype._processDate = function(string) {
	var date = new Object();
	
	var dateRe = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
	var m = dateRe.exec(string);
	if(m) {		// sql date
		var jsDate = new Date(m[1], m[2]-1, m[3], false, false, false);
	} else {	// not an sql date
		var yearRe = /^[0-9]+$/;
		if(yearRe) {	// is a year
			date.year = string;
			return date;
		} else {		// who knows what this is
			var jsDate = new Date(string)
		}
	}
	
	if(isNaN(jsDate.valueOf())) { // couldn't parse
		// get year and say other parts are month
		var yearRe = /^(.*)([^0-9]{4})(.*)$/
		var m = yearRe.exec(string);
		
		date.year = m[2];
		date.month = m[1]
		if(m[2] && m[3]) date.month += " ";
		date.month += m[3];
	} else {
		date.year = jsDate.getFullYear();
		date.month = jsDate.getMonth();
		date.day = jsDate.getDay();
	}
	
	return date;
}

/*
 * formats a string according to the cs-format attributes on element
 */
CSL.prototype._formatString = function(element, string, format) {
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
	} else if(format == "RTF") {
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
		string = element.prefix+string;
	}
	if(format != "compare" && element.suffix &&
	   (element.suffix.length != 1 || string[string.length-1] != element.suffix)) {
		// skip if suffix is the same as the last char
		string += element.suffix;
	}
	
	return string;
}

/*
 * formats a locator (pages, volume, issue) or an identifier (isbn, doi)
 * note that label should be null for an identifier
 */
CSL.prototype._formatLocator = function(identifier, element, number, format) {
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
				string = this._getTerm(child["term-name"], plural);
			} else if(identifier && child.name == "label") {
				var plural = (number.indexOf(",") != -1 || number.indexOf("-") != -1);
				string = this._getTerm(identifier, plural);
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
CSL.prototype._formatDate = function(element, date, format) {
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
		} else if(child.name == "month" && date.month) {
			if(format == "compare") {
				string = this._lpad(date.month+1, "0", 2);
			} else {
				if(element.form == "short") {
					string = CSL._monthsShort[date.month];
				} else {
					string = CSL._months[date.month];
				}
			}
		} else if(child.name == "day" && date.day) {
			if(format == "compare") {
				string = this._lpad(date.day, "0", 2);
			} else {
				string = date.day.toString();
			}
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
CSL.prototype._serializeElement = function(name, element) {
	var string = name;
	if(element.relation) {
		string += " relation:"+element.relation;
	}
	if(element.role) {
		string += " role"+element.role;
	}
	return string;
}

/*
 * pads a number or other string with a given string on the left
 */
CSL.prototype._lpad = function(string, pad, length) {
	while(string.length < length) {
		string = pad + string;
	}
	return string;
}

/*
 * preprocess items, separating authors, editors, and translators arrays into
 * separate properties
 */
CSL.prototype._preprocessItems = function(items) {
	for(var i in items) {
		var item = items[i];
		
		// namespace everything in item._csl so there's no chance of overlap
		item._csl = new Object();
		item._csl.ignore = new Array();
		
		item._csl.authors = new Array();
		item._csl.editors = new Array();
		item._csl.translators = new Array();
		
		// separate item into authors, editors, translators
		for(var j in item.creators) {
			var creator = item.creators[j];
			
			if(creator.creatorType == "editor") {
				item._csl.editors.push(creator);
			} else if(creator.creatorType == "translator") {
				item._csl.translators.push(creator);
			} else if(creator.creatorType == "author") {
				// TODO: do we just ignore contributors?
				item._csl.authors.push(creator);
			}
		}
		
		// parse date
		item._csl.date = CSL.prototype._processDate(item.date);
	}
}

/*
 * disambiguates items, after pre-processing and sorting
 */
CSL.prototype._disambiguateItems = function(items) {
	var usedCitations = new Array();
	var lastAuthor;
	
	for(var i in items) {
		var item = items[i];
		
		var author = this._getFieldValue("author",
										   this._getFieldDefaults("author"),
										   item, "disambiguate");
		
		// handle (2006a) disambiguation for author-date styles
		if(this._class == "author-date") {
			var citation = author+" "+this._getFieldValue("date",
												this._getFieldDefaults("date"),
												item, "disambiguate");
			
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
		if(this._opt.subsequentAuthorSubstitute && lastAuthor == author) {
			item._csl.subsequentAuthorSubstitute = true;
		}
		lastAuthor = author;
	}
}

/*
 * handles sorting of items
 */
CSL.prototype._compareItem = function(a, b, opt) {
	for(var i in this._opt.sortOrder) {
		var sortElement = this._opt.sortOrder[i];
		
		var aValue = this._getFieldValue(sortElement.name, sortElement, a, "compare");
		var bValue = this._getFieldValue(sortElement.name, sortElement, b, "compare");
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
CSL.prototype._processCreators = function(type, element, creators, format) {
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
			if(this._opt.etAl && maxCreators >= this._opt.etAl.minCreators) {
				maxCreators = this._opt.etAl.useFirst;
				useEtAl = true;
			}
			
			// parse authors into strings
			var authorStrings = [];
			var firstName, lastName;
			for(var i=0; i<maxCreators; i++) {
				if(typeof(child["initialize-with"]) == "string") {
					// even if initialize-with is simply an empty string, use
					// initials
					
					// use first initials
					var firstName = "";
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
				lastName = creators[i].lastName;
				
				if(element["name-as-sort-order"]
				  && ((i == 0 && element["name-as-sort-order"] == "first")
				  || element["name-as-sort-order"] == "all")
				  && child["sort-separator"]) {
					// if this is the first author and name-as-sort="first"
					// or if this is a subsequent author and name-as-sort="all"
					// then the name gets inverted
					authorStrings.push(lastName+child["sort-separator"]+firstName);
				} else {
					authorStrings.push(firstName+" "+lastName);
				}
			}
			
			// figure out if we need an "and" or an "et al"
			var joinString = ", ";
			if(maxCreators > 1) {
				if(useEtAl) {	// multiple creators and need et al
					authorStrings.push(this._getTerm("et al."));
				} else {		// multiple creators but no et al
					// add and to last creator
					if(child["and"]) {
						if(child["and"] == "symbol") {
							var and = "&"
						} else {
							var and = this._getTerm("and");
						}
						
						authorStrings[maxCreators-1] = and+" "+authorStrings[maxCreators-1];
						// skip the comma if there are only two creators and no
						// et al, and name as sort is no
						if(maxCreators == 2 &&
						   (!element["name-as-sort-order"]
						    || (element["name-as-sort-order"] != "first"
						    && element["name-as-sort-order"] != "all"))) {
							joinString = " ";
						}
					}
				}
			}
			string = authorStrings.join(joinString);
		} else if(child.name == "label") {
			string = this._getTerm(type, (maxCreators != 1));
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
 * processes an element from a (pre-processed) item into text
 */
CSL.prototype._getFieldValue = function(name, element, item, format, typeName) {
	var data = "";
	
	if(element._serialized && item._csl.ignore[element._serialized]) {
		return "";
	}
	
	if(name == "author") {
		if(item._csl.subsequentAuthorSubstitute) {
			// handle subsequent author substitute behavior
			data = this._opt.subsequentAuthorSubstitute;
		} else {
			data = this._processCreators(name, element, item._csl.authors, format);
		}
	} else if(name == "editor") {
		data = this._processCreators(name, element, item._csl.editors, format);
	} else if(name == "translator") {
		data = this._processCreators(name, element, item._csl.translators, format);
	} else if(name == "titles") {
		for(var i in element.children) {
			var child = element.children[i];
			var string = "";
			
			if(child.name == "title") {	// for now, we only care about the
									// "title" sub-element
				if(!element.relation) {
					string = item.title;
				} else if(element.relation == "container") {
					string = item.publicationTitle;
				} else if(element.relation == "collection") {
					string = item.seriesTitle;
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
				string = item.place;
			} else if(child.name == "name") {
				string = item.publisher
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
				// TODO: better URL-handling strategies
				if(item.url) {
					string = item.url;
				}
			} else if(child.name == "date") {
				if(item.accessDate) {
					string = this._formatDate(child, this._processDate(item.accessDate), format);
				}
			} else if(child.name == "physicalLocation") {
				if(item.archiveLocation) {
					string = item.archiveLocation;
				}
			} else if(child.name == "text") {
				string = this._getTerm(child["term-name"]);
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
	} else if(name == "volume") {
		if(item.volume) {
			data = this._formatLocator("volume", element, item.volume, format);
		}
	} else if(name == "issue") {
		if(item.issue) {
			data = this._formatLocator("issue", element, item.issue, format);
		}
	} else if(name == "pages") {
		if(item.pages) {
			data = this._formatLocator("page", element, item.pages, format);
		}
	} else if(name == "edition") {
		if(item.edition) {
			data = item.edition;
		}
	} else if(name == "genre") {
		if(item.type || item.thesisType) {
			data = (item.type ? item.type : item.thesisType);
		}
	} else if(name == "group") {
		var childData = new Array();
		for(var i in element.children) {
			// get data for each child element
			var child = element.children[i];
			
			var string = this._getFieldValue(child.name, child, item,
			                                 format, typeName);
			if(string) {
				childData.push(string);
			}
		}
		
		// implode with delimiter
		data = childData.join((element["delimiter"] ? element["delimiter"] : ""));
	} else if(name == "text") {
		data = this._getTerm(element["term-name"]);
	} else if(name == "isbn") {
		if(item.ISBN) {
			data = this._formatLocator(null, element, item.ISBN, format);
		}
	} else if(name == "doi") {
		if(item.DOI) {
			data = this._formatLocator(null, element, item.DOI, format);
		}
	} else if(name == "number") {
		data = this._csl.number;
	}
	
	if(data) {
		return this._formatString(element, data, format); 
	} else if(element.substitute) {
		// try each substitute element until one returns something
		for(var i in element.substitute) {
			var substituteElement = element.substitute[i];
			var serialization = this._serializeElement(substituteElement.name,
			                                           substituteElement);
			
			var inheritElement;
			if(CSL._inherit[substituteElement.name] && CSL._inherit[name]
			   && CSL._inherit[substituteElement.name] == CSL._inherit[name]) {
				// if both substituteElement and the parent element inheirt from
				// the same base element, apply styles here
				inheritElement = element;
			} else {
				// search for elements with the same serialization
				if(typeName != undefined && this._serializations[typeName]
				   && this._serializations[typeName][serialization]) {
					inheritElement = this._serializations[typeName][serialization];
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
			
			// ignore elements with the same serialization
			item._csl.ignore[serialization] = true;
			
			// get field value
			data = this._getFieldValue(substituteElement.name,
			                           substituteElement, item, format);
			// return field value, if there is one; otherwise, keep processing
			// the data
			if(data) {
				return data;
			}
		}
	}
	
	return "";
}