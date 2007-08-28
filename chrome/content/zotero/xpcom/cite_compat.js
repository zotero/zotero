/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/

/*
 * Zotero.Cite: a class for creating bibliographies from within Scholar
 * this class handles pulling the CSL file and item data out of the database,
 * while CSL, below, handles the actual generation of the bibliography
 */
default xml namespace = "http://purl.org/net/xbiblio/csl";

/*
 * CSL: a class for creating bibliographies from CSL files
 * this is abstracted as a separate class for the benefit of anyone who doesn't
 * want to use the Scholar data model, but does want to use CSL in JavaScript
 */
Zotero.CSL.Compat = function(csl) {
	this._csl = new XML(Zotero.CSL.Compat.Global.cleanXML(csl));
	
	// initialize CSL
	Zotero.CSL.Compat.Global.init();
	
	// load localizations
	this._terms = Zotero.CSL.Compat.Global.parseLocales(this._csl.terms);
	
	// load class defaults
	this.class =  this._csl["@class"].toString();
	this.hasBibliography = true;
	Zotero.debug("CSL: style class is "+this.class);
	
	this._defaults = new Object();
	// load class defaults
	if(Zotero.CSL.Compat.Global.classDefaults[this.class]) {
		var classDefaults = Zotero.CSL.Compat.Global.classDefaults[this.class];
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
		Zotero.debug("CSL: using citation element for bibliography");
		this._bib = this._cit;
		this.hasBibliography = false;
	}
}


Zotero.CSL.Compat.Global = new function() {
	// for elements that inherit defaults from each other
	this.inherit = {
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
	
	// for types
	this.typeInheritance = { 
		"article-magazine":"article",
		"article-newspaper":"article",
		"article-journal":"article",
		"bill":"article",
		"figure":"article",
		"graphic":"article",
		"interview":"article",
		"legal case":"article",
		"manuscript":"book",
		"map":"article",
		"motion picture":"book",
		"musical score":"article",
		"pamphlet":"book",
		"paper-conference":"chapter",
		"patent":"article",
		"personal communication":"article",
		"report":"book",
		"song":"article",
		"speech":"article",
		"thesis":"book",
		"treaty":"article",
		"webpage":"article",
	}

	// for class definitions
	this.classDefaults = new Object();
	this.classDefaults["author-date"] = {
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
	
	

	this.ns = "http://purl.org/net/xbiblio/csl";

	/*
	 * initializes CSL interpreter
	 */
	this.init = function() {
		if(!Zotero.CSL.Compat.Global._xmlLang) {
			// get XML lang
			Zotero.CSL.Compat.Global._xmlLang = Zotero.locale;
			
			// read locales.xml from directory
			var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
					  createInstance();
			req.open("GET", "chrome://zotero/locale/locales.xml", false);
			req.overrideMimeType("text/plain");
			req.send(null);
			
			// get default terms
			var locales = new XML(Zotero.CSL.Compat.Global.cleanXML(req.responseText));
			Zotero.CSL.Compat.Global._defaultTerms = Zotero.CSL.Compat.Global.parseLocales(locales, true);
		}
	}
	
	/*
	 * returns an array of short or long month strings
	 */
	this.getMonthStrings = function(form) {
		Zotero.CSL.Compat.Global.init();
		return Zotero.CSL.Compat.Global._defaultTerms[form]["_months"];
	}
	
	/*
	 * removes parse instructions from XML
	 */
	this.cleanXML = function(xml) {
		return xml.replace(/<\?[^>]*\?>/g, "");
	}
	
	/*
	 * parses locale strings into Zotero.CSL.Compat.Global._defaultTerms
	 */
	this.parseLocales = function(termXML, ignoreLang) {
		// return defaults if there are no terms
		if(!termXML.length()) {
			return (Zotero.CSL.Compat.Global._defaultTerms ? Zotero.CSL.Compat.Global._defaultTerms : {});
		}
		
		var xml = new Namespace("http://www.w3.org/XML/1998/namespace");
		
		if(ignoreLang) {
			// ignore lang if loaded from chrome
			locale = termXML.locale[0];
		} else {
			// get proper locale
			var locale = termXML.locale.(@xml::lang == Zotero.CSL.Compat.Global._xmlLang);
			if(!locale.length()) {
				var xmlLang = Zotero.CSL.Compat.Global._xmlLang.substr(0, 2);
				locale = termXML.locale.(@xml::lang == xmlLang);
			}
			if(!locale.length()) {
				// return defaults if there are no locales
				return (Zotero.CSL.Compat.Global._defaultTerms ? Zotero.CSL.Compat.Global._defaultTerms : {});
			}
		}
		
		var termArray = new Object();
		termArray["default"] = new Object();
		
		if(Zotero.CSL.Compat.Global._defaultTerms) {
			// ugh. copy default array. javascript dumb.
			for(var i in Zotero.CSL.Compat.Global._defaultTerms) {
				termArray[i] = new Object();
				for(var j in Zotero.CSL.Compat.Global._defaultTerms[i]) {
					if(typeof(Zotero.CSL.Compat.Global._defaultTerms[i]) == "object") {
						termArray[i][j] = [Zotero.CSL.Compat.Global._defaultTerms[i][j][0],
										Zotero.CSL.Compat.Global._defaultTerms[i][j][1]];
					} else {
						termArray[i][j] = Zotero.CSL.Compat.Global_defaultTerms[i][j];
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
	 * pads a number or other string with a given string on the left
	 */
	this.lpad = function(string, pad, length) {
		while(string.length < length) {
			string = pad + string;
		}
		return string;
	}
}

Zotero.CSL.Compat.prototype.createItemSet = function(items) {
	return new Zotero.CSL.Compat.ItemSet(items, this);
}

Zotero.CSL.Compat.prototype.createCitation = function(citationItems) {
	return new Zotero.CSL.Citation(citationItems);
}

Zotero.CSL.Compat.ItemSet = function(items, csl) {
	this.items = [];
	this.csl = csl;
	if(items) this.add(items);
	this.resort();
}

Zotero.CSL.Compat.ItemSet.prototype.getItemsByIds = function(ids) {
	var returnList = [];
	for each(var id in ids) {
		var item = Zotero.Items.get(id);
		if(this.items.indexOf(item) !== -1) {
			returnList.push(item);
		} else {
			returnList.push(false);
		}
	}
	return returnList;
}

Zotero.CSL.Compat.ItemSet.prototype.add = function(items) {
	var returnList = [];
	for each(var item in items) {
		if(!(item instanceof Zotero.Item)) {
			item = Zotero.Items.get(item);
		}
		if(!item) {
			throw "Zotero.CSL.Compat.ItemSet.add called on a non-item"; 
		}
		this.items.push(item);
		returnList.push(item);
		item.zoteroItem = item;
	}
	return returnList;
}

Zotero.CSL.Compat.ItemSet.prototype.remove = function(items) {
	for(var i in items) {
		if(!item) continue;
		if(items[i] instanceof Zotero.Item) {
			var item = items[i];
		} else {
			var item = Zotero.Items.get(i);
		}
		this.items.splice(this.items.indexOf(item), 1);
	}
}

Zotero.CSL.Compat.ItemSet.prototype.resort = function() {
	var oldDisambiguation = {};
	if(!this.items) return;
	
	// get data necessary to generate citations before sorting
	for(var i in this.items) {
		var item = this.items[i];
		var dateModified = this.csl._getField(item, "dateModified");
		
		if(!item._csl || item._csl.dateModified != dateModified) {
			// namespace everything in item._csl so there's no chance of overlap
			item._csl = new Object();
			item._csl.dateModified = dateModified;
			
			// separate item into authors, editors, translators
			var creators = this.csl._separateItemCreators(item);
			item._csl.authors = creators[0];
			item._csl.editors = creators[1];
			item._csl.translators = creators[2];
			
			// parse date
			item._csl.date = Zotero.CSL.Compat.prototype._processDate(this.csl._getField(item, "date"));
		}
		
		// clear disambiguation and subsequent author substitute
		if(item._csl.date && item._csl.date.disambiguation) {
			oldDisambiguation[item.getID()] = item._csl.date.disambiguation;
			item._csl.date.disambiguation = undefined;
		}
		if(item._csl.subsequentAuthorSubstitute) item._csl.subsequentAuthorSubstitute = undefined;
	}
	
	// sort by sort order
	if(this.csl._bib.sortOrder) {
		Zotero.debug("CSL: sorting this.items");
		var me = this.csl;
		this.items.sort(function(a, b) {
			return me._compareItem(a, b);
		});
	}
	
	// disambiguate this.items after preprocessing and sorting
	var usedCitations = new Array();
	var lastAuthors;
	
	for(var i in this.items) {
		var item = this.items[i];
		
		// handle subsequent author substitutes
		if(item._csl.authors.length && lastAuthors) {
			var authorsAreSame = true;
			for(var i=item._csl.authors.length-1; i>=0; i--) {
				if(!lastAuthors[i] ||
						lastAuthors[i].firstName != item._csl.authors[i].firstName ||
						lastAuthors[i].lastName != item._csl.authors[i].lastName ||
						lastAuthors[i].creatorType != item._csl.authors[i].creatorType) {
					authorsAreSame = false;
					break;
				}
			}
			if(authorsAreSame) item._csl.subsequentAuthorSubstitute = true;
		}
		lastAuthors = item._csl.authors;
		
		// handle (2006a) disambiguation for author-date styles
		if(this.csl.class == "author-date") {
			var year = item._csl.date.year;
				
			if(authorsAreSame) {
				if(usedCitations[year]) {
					if(!usedCitations[year]._csl.date.disambiguation) {
						usedCitations[year]._csl.date.disambiguation = "a";
						item._csl.date.disambiguation = "b";
					} else {
						// get all but last character
						var oldLetter = usedCitations[year]._csl.date.disambiguation;
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
			} else {
				usedCitations = new Array();
			}
			
			usedCitations[year] = item;
		}
		
		// add numbers to each
		item._csl.number = i;
	}
	
	// see which items have changed
	var returnItems = [];
	for each(var item in this.items) {
		if(item._csl.date && item._csl.date.disambiguation) {
			var oldDisambig = oldDisambiguation[item.getID()];
			if(!oldDisambig || oldDisambig != item._csl.date.disambiguation) {
				returnItems.push(item);
			}
		}
	}
	return returnItems;
}

Zotero.CSL.Compat.prototype.formatCitation = function(citation, format) {
	var string = new Zotero.CSL.Compat.FormattedString(this, format);
	if(this.ibid == true && citation.citationItems.length == 1 &&
			citation.citationItems[0].position == Zotero.CSL.POSITION_IBID
			|| citation.citationItems[0].position == Zotero.CSL.POSITION_IBID_WITH_LOCATOR) {	// indicates ibid
		var term = this._getTerm("ibid");
		string.append(term[0].toUpperCase()+term.substr(1));
		
		if(citation.citationItems[0].position == Zotero.CSL.POSITION_IBID_WITH_LOCATOR) {
			// locator data
			var locator = citation.citationItems[0].locator;
			
			if(locator) {
				var locatorType = Zotero.CSL.locatorTypeTerms[citation.citationItems[0].locatorType];
				
				// search for elements with the same serialization
				var element = this._getFieldDefaults("locator");
				if(!element) {
					element = {
						name:"locator",
						children:{name:"number"}
					};
				}
				
				if(element) {
					string.append("., ");
					string.appendLocator(locatorType, locator, element);
				}
			}
		}
	} else {							// indicates primary or subsequent
		var lasti = citation.citationItems.length-1;
		for(var i in citation.citationItems) {
			var citationItem = citation.citationItems[i];
			if(!citationItem.locatorType) citationItem.locatorType = 0;
			
			var position = (citationItem.position >= Zotero.CSL.POSITION_SUBSEQUENT ? "subsequent" : "first");
			var ignore = (citationItem.suppressAuthor ? {"author":true} : undefined);
			
			if(citationItem.prefix) string.append(citationItem.prefix+" ");
			var citationString = this._getCitation(citationItem.item,
				position, Zotero.CSL.locatorTypeTerms[citationItem.locatorType],
				citationItem.locator, format, this._cit, ignore);
			string.concat(citationString);
			if(citationItem.suffix) string.append(citationItem.suffix+" ");
			
			if(this._cit.format && this._cit.format.delimiter && i != lasti) {
				// add delimiter if one exists, and this isn't the last element
				string.append(this._cit.format.delimiter);
			}
		}
	}
	
	// add format
	if(this._cit.format) {
		// add citation prefix or suffix
		if(this._cit.format.prefix) {
			string.string = this._cit.format.prefix + string.string;
		}
		if(this._cit.format.suffix) {
			string.append(this._cit.format.suffix);
		}
	}
	
	return string.get();
}

/*
 * create a bibliography
 * (items is expected to be an array of items)
 */
Zotero.CSL.Compat.prototype.formatBibliography = function(itemSet, format) {
	var items = itemSet.items;
	var output = "";
	
	var index = 0;
	if(format == "HTML") {
		if(this.class == "note" && this._bib == this._cit) {
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
		
		var string = this._getCitation(item, "first", false, false, format, this._bib).get();
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
			var coins = Zotero.OpenURL.createContextObject(item, "1.0");
			if(coins) {
				string += '<span class="Z3988" title="'+coins.replace("&", "&amp;")+'"></span>';
			}
			
			if(this.class == "note" && this._bib == this._cit) {
				output += "<li>"+string+"</li>\r\n";
			} else {
				output += "<p>"+string+"</p>\r\n";
			}
		} else if(format == "RTF") {
			if(this.class == "note" && this._bib == this._cit) {
				index++;
				output += index+". ";
			}
			output += string+"\\\r\n\\\r\n";
		} else {
			if(format == "Text" && this.class == "note" && this._bib == this._cit) {
				index++;
				output += index+". ";
			}
			// attach \n on mac (since both \r and \n count as newlines for
			// clipboard purposes)
			output += string+(Zotero.isMac ? "\n\n" : "\r\n\r\n");
		}
	}
	
	if(format == "HTML") {
		if(this.class == "note" && this._bib == this._cit) {
			output += '</ol>';
		} else if(this._bib.hangingIndent) {
			output += '</div>';
		}
	} else if(format == "RTF") {
		// drop last 6 characters of output (last two returns)
		output = output.substr(0, output.length-6)+"}";
	} else {
		// drop last 4 characters (last two returns)
		output = output.substr(0, (Zotero.isMac ? output.length-2 : output.length-4));
	}
	
	return output;
}

/*
 * parses attributes and children for a CSL field
 */
Zotero.CSL.Compat.prototype._parseFieldAttrChildren = function(element, desc, ignoreChildren) {
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
				if(child.namespace() == Zotero.CSL.Compat.Global.ns) {	// ignore elements in other
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
								if(choose.namespace() == Zotero.CSL.Compat.Global.ns) {
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
Zotero.CSL.Compat.prototype._parseFieldDefaults = function(ref) {
	for each(var element in ref.children()) {
		if(element.namespace() == Zotero.CSL.Compat.Global.ns) {	// ignore elements in other namespaces
			var name = element.localName();
			Zotero.debug("CSL: parsing field defaults for "+name);
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
Zotero.CSL.Compat.prototype._parseFields = function(ref, position, type, bibCitElement, inheritFormat) {
	var typeDesc = new Array();
	for each(var element in ref) {
		if(element.namespace() == Zotero.CSL.Compat.Global.ns) {	// ignore elements in other namespaces
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
			if(itemDesc.name == "group" || itemDesc.name == "conditional" ||
			   itemDesc.name == "if" || itemDesc.name == "else-if" ||
			   itemDesc.name == "else") {
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
				if(bibCitElement && bibCitElement._serializations) {
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
Zotero.CSL.Compat.prototype._parseEtAl = function(etAl, bibCitElement) {
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
	} else if(this._defaults["et-al"]) {
		bibCitElement.etAl = new Object();
		
		bibCitElement.etAl.minCreators = parseInt(this._defaults["et-al"]['min-authors'], 10);
		bibCitElement.etAl.useFirst = parseInt(this._defaults["et-al"]['use-first'], 10);
	}
}

/*
 * parses cs-format attributes into just a prefix and a suffix; accepts an
 * optional array of cs-format
 */
Zotero.CSL.Compat.prototype._parseBibliographyOptions = function() {
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
			                 this._getFieldDefaults("date"),
			                 this._getFieldDefaults("titles")];
			this._bib.sortOrder[0].name = "author";
			this._bib.sortOrder[0]["name-as-sort-order"] = "all";
			this._bib.sortOrder[1].name = "date";
			this._bib.sortOrder[2].name = "titles";
		} else if(algorithm == "label") {
			this._bib.sortOrder = [this._getFieldDefaults("label")];
			this._bib.sortOrder[0].name = "label";
		} else if(algorithm == "cited") {
			this._bib.sortOrder = [this._getFieldDefaults("cited")];
			this._bib.sortOrder[0].name = "cited";
		}
	} else {
		this._bib.sortOrder = this._parseFields(bibliography.sort.children(), "first", false, this._bib);
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
Zotero.CSL.Compat.prototype._parseCitationOptions = function() {
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
Zotero.CSL.Compat.prototype._parseTypes = function(itemElements, bibCitElement) {
	Zotero.debug("CSL: parsing item elements");
	
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
Zotero.CSL.Compat.prototype._getTypeObject = function(position, reftype, bibCitElement) {
	if(!bibCitElement._types[position][reftype]) {
		// no type available
		return false;
	}
	
	// parse type if necessary
	if(typeof(bibCitElement._types[position][reftype]) == "xml") {
		Zotero.debug("CSL: parsing XML for "+reftype);
		bibCitElement._types[position][reftype] = this._parseFields(
		                                          bibCitElement._types[position][reftype].children(),
		                                          position, reftype, bibCitElement, true);
	}
	
	Zotero.debug("CSL: got object for "+reftype);
	return bibCitElement._types[position][reftype];
}

/*
 * merges two elements, letting the second override the first
 */
Zotero.CSL.Compat.prototype._merge = function(element1, element2) {
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
Zotero.CSL.Compat.prototype._getFieldDefaults = function(elementName) {
	// first, see if there are specific defaults
	if(this._defaults[elementName]) {
		if(Zotero.CSL.Compat.Global.inherit[elementName]) {
			var inheritedDefaults = this._getFieldDefaults(Zotero.CSL.Compat.Global.inherit[elementName]);
			for(var i in inheritedDefaults) {	// will only be called if there
												// is merging necessary
				return this._merge(inheritedDefaults, this._defaults[elementName]);
			}
		}
		return this._defaults[elementName];
	}
	// next, try to get defaults from the item from which this item inherits
	if(Zotero.CSL.Compat.Global.inherit[elementName]) {
		return this._getFieldDefaults(Zotero.CSL.Compat.Global.inherit[elementName]);
	}
	// finally, return an empty object
	return {};
}

/*
 * gets a term, in singular or plural form
 */
Zotero.CSL.Compat.prototype._getTerm = function(term, plural, form) {
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
 * serializes an element into a string suitable to prevent substitutes from
 * recurring in the same style
 */
Zotero.CSL.Compat.prototype._serializeElement = function(name, element) {
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
 * handles sorting of items
 */
Zotero.CSL.Compat.prototype._compareItem = function(a, b, opt) {
	var localeService = Components.classes["@mozilla.org/intl/nslocaleservice;1"]
		.getService(Components.interfaces.nsILocaleService);
	var collationFactory = Components.classes["@mozilla.org/intl/collation-factory;1"]
		.getService(Components.interfaces.nsICollationFactory);
	var collation = collationFactory.CreateCollation(localeService.getApplicationLocale());
	
	for(var i in this._bib.sortOrder) {
		var sortElement = this._bib.sortOrder[i];
		
		if(sortElement.name == "date") {
			var aValue = a.getField("date", true);
			var bValue = b.getField("date", true);
			
			if(bValue == "" && aValue != "") {
				return -1;
			} else if(aValue == "" && bValue != "") {
				return 1;
			} else if(bValue > aValue) {
				return -1;
			} else if(bValue < aValue) {
				return 1;
			}
		} else {
			var formattedStringA = new Zotero.CSL.Compat.FormattedString(this, "compare");
			var formattedStringB = new Zotero.CSL.Compat.FormattedString(this, "compare");
			
			//Zotero.debug('comparing '+sortElement.name+' on "'+a.getField("title")+'" and "'+b.getField("title")+'"');
			
			this._getFieldValue(sortElement.name, sortElement, a,
											 formattedStringA, this._bib);
			this._getFieldValue(sortElement.name, sortElement, b,
											 formattedStringB, this._bib);
			
			var aValue = formattedStringA.get().toLowerCase();
			var bValue = formattedStringB.get().toLowerCase();
			//Zotero.debug(aValue+" vs "+bValue);
			
			var cmp = collation.compareString(0, aValue, bValue);
			if(cmp != 0) {
				return cmp;
			}
		}
	}

	// finally, give up; they're the same
	return 0;
}

/*
 * process creator objects; if someone had a creator model that handled
 * non-Western names better than ours, this would be the function to change
 */
Zotero.CSL.Compat.prototype._processCreators = function(type, element, creators, format, bibCitElement, position) {
	var maxCreators = creators.length;
	if(!maxCreators) return false;
	
	var data = new Zotero.CSL.Compat.FormattedString(this, format);
	if(format == "disambiguate") {
		// for disambiguation, return only the last name of the first creator
		// TODO: is this right?
		data.append(creators[0].lastName);
		return data;
	}
	
	if(!element.children) {
		return false;
	}
	
	var etAl = bibCitElement.etAl;
	if(position == "subsequent" && bibCitElement.subsequentEtAl) {
		etAl = bibCitElement.subsequentEtAl;
	}
	
	for(var i in element.children) {
		var child = element.children[i];
		var string = "";
		
		if(child.name == "name") {			
			var useEtAl = false;
			
			// figure out if we need to use "et al"
			if(etAl && maxCreators >= etAl.minCreators) {
				maxCreators = etAl.useFirst;
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
					}
				}
				
				// check whether to use a serial comma
				Zotero.debug(child["delimiter-precedes-last"]);
				if((authorStrings.length == 2 && (useEtAl || child["delimiter-precedes-last"] != "always")) ||
				   (authorStrings.length > 2 && child["delimiter-precedes-last"] == "never")) {
					var lastString = authorStrings.pop();
					authorStrings[authorStrings.length-1] = authorStrings[authorStrings.length-1]+" "+lastString;
				}
			}
			string = authorStrings.join(joinString);
		} else if(child.name == "label") {
			string = this._getTerm(type, (maxCreators != 1), child["form"]);
		}
		
		
		// add string to data
		if(string) {
			data.append(string, child);
		}			
	}
	
	// add to the data
	return data;
}

/*
 * get a citation, given an item and bibCitElement
 */
Zotero.CSL.Compat.prototype._getCitation = function(item, position, locatorType, locator, format, bibCitElement, ignore) {
	Zotero.debug("CSL: generating citation for item "+item.getID());
	
	// use true position if possible, otherwise "first"
	var typePosition = (bibCitElement._types[position] ? position : "first");
	
	// determine mapping
	if(bibCitElement._types[typePosition][0]) {
		// only one element
		var typeName = 0;
		var type = this._getTypeObject(typePosition, typeName, bibCitElement);
	} else {
		var typeNames = this._getTypeFromItem(item);
		for each(var typeName in typeNames) {
			var type = this._getTypeObject(typePosition, typeName, bibCitElement);
			if(type) {
				break;
			}
		}
	}
	
	Zotero.debug("CSL: using CSL type "+typeName);
	
	// remove previous ignore entries from list
	this._ignore = (ignore ? ignore : new Object());
	
	var formattedString = new Zotero.CSL.Compat.FormattedString(this, format);
	for(var j in type) {
		this._getFieldValue(type[j].name, type[j], item, formattedString,
		                    bibCitElement, position, locatorType, locator,
		                    typeName);
	}
	
	return formattedString;
}

/*
 * processes an element from a (pre-processed) item into text
 */
Zotero.CSL.Compat.prototype._getFieldValue = function(name, element, item, formattedString,
                                                bibCitElement, position,
                                                locatorType, locator, typeName) {
	var dataAppended = false;
	var itemID = item.getID();
	
	if(element._serialized && this._ignore && this._ignore[element._serialized]) {
		return false;
	}
	
	if(name == "author") {
		if(item._csl.subsequentAuthorSubstitute && bibCitElement.subsequentAuthorSubstitute) {
			// handle subsequent author substitute behavior
			dataAppended = formattedString.append(bibCitElement.subsequentAuthorSubstitute, element);
		} else {
			var newString = this._processCreators(name, element, item._csl.authors, formattedString.format, bibCitElement, position);
			if(newString) dataAppended = formattedString.concat(newString, element);
		}
	} else if(name == "editor") {
		dataAppended = formattedString.concat(this._processCreators(name, element, item._csl.editors, formattedString.format, bibCitElement, position), element);
	} else if(name == "translator") {
		dataAppended = formattedString.concat(this._processCreators(name, element, item._csl.translators, formattedString.format, bibCitElement, position), element);
	} else if(name == "titles") {
		var data = new Zotero.CSL.Compat.FormattedString(this, formattedString.format);
		
		for(var i in element.children) {
			var child = element.children[i];
			var string = null;
			
			if(child.name == "title") {	// for now, we only care about the
									// "title" sub-element
				if(!element.relation) {
					// preferentially use shortTitle if flagged
					if(element.form && element.form == "short") {
						string = this._getField(item, "shortTitle");
					}
					if(!string) {
						string = this._getField(item, "title");
					}
				} else if(element.relation == "container") {
					string = this._getField(item, "publicationTitle");
				} else if(element.relation == "collection") {
					string = this._getField(item, "seriesTitle");
					if(!string) string = this._getField(item, "series");
				} else if(element.relation == "event") {
					string = this._getField(item, "conferenceName");
				}
				
				// if comparing, drop "a" or "the" from title
				if(formattedString.format == "compare" && string.length > 1) {
					if(string.substr(0, 2).toLowerCase() == "a ") {
						string = string.substr(2);
					} else if(string.length > 3 && string.substr(0, 4).toLowerCase() == "the ") {
						string = string.substr(4);
					}
				}
			}
			
			if(string) {
				data.append(string, child);
			}
		}
		
		dataAppended = formattedString.concat(data, element);
	} else if(name == "date") {
		dataAppended = formattedString.appendDate(item._csl.date, element);
	} else if(name == "publisher") {
		var data = new Zotero.CSL.Compat.FormattedString(this, formattedString.format);
		
		for(var i in element.children) {
			var child = element.children[i];
			var string = "";
			
			if(child.name == "place") {
				string = this._getField(item, "place");
			} else if(child.name == "name") {
				string = this._getField(item, "publisher");
			}
				
			if(string) {
				data.append(string, child);
			}
		}
		
		dataAppended = formattedString.concat(data, element);
	} else if(name == "access") {
		var data = new Zotero.CSL.Compat.FormattedString(this, formattedString.format);
		var text = null;
		var save = false;
		
		for(var i in element.children) {
			text = null;
			var child = element.children[i];
			
			if(child.name == "url") {
				text = this._getField(item, "url");
			} else if(child.name == "date") {
				var field = this._getField(item, "accessDate");
				if(field) {
					data.appendDate(this._processDate(field), child);
					save = true;
				}
			} else if(child.name == "physicalLocation") {
				text = this._getField(item, "archiveLocation");
			} else if(child.name == "text") {
				text = this._getTerm(child["term-name"], false, child["form"]);
			}
				
			if(text) {
				data.append(text, child);
				if(child.name != "text") {
					// only save if there's non-text data
					save = true;
				}
			}
		}
		
		if(save) {
			dataAppended = formattedString.concat(data, element);
		}
	} else if(name == "volume" || name == "issue") {
		var data = new Zotero.CSL.Compat.FormattedString(this, formattedString.format);
		
		var field = this._getField(item, name);
		if(field) {
			dataAppended = formattedString.appendLocator(name, field, element);
		}
	} else if(name == "pages") {
		if(locatorType == "page") {
			var field = locator;
		} else if(typeName != "book") {
			var field = this._getField(item, "pages");
		}
		
		if(field) {
			dataAppended = formattedString.appendLocator("page", field, element);
		}
	} else if(name == "locator") {
		if(locator) {
			Zotero.debug("locatorType "+locatorType);
			dataAppended = formattedString.appendLocator(locatorType, locator, element);
		}
	} else if(name == "edition") {
		dataAppended = formattedString.append(this._getField(item, "edition"), element);
	} else if(name == "genre") {
		var data = this._getField(item, "type");
		if(!data) {
			data = this._getField(item, "thesisType");
		}
		dataAppended = formattedString.append(data, element);
	} else if(name == "group") {
		var data = new Zotero.CSL.Compat.FormattedString(this, formattedString.format, element["delimiter"]);
		
		for(var i in element.children) {
			// get data for each child element
			var child = element.children[i];
			
			this._getFieldValue(child.name, child, item, data,
		                    bibCitElement, position, locatorType, locator,
		                    typeName);
		}
		
		dataAppended = formattedString.concat(data, element);
	} else if(name == "conditional") {
		var status = false;
		for(var i in element.children) {
			var condition = element.children[i];
			
			if(condition.name == "if" || condition.name == "else-if") {
				// evaluate condition for if/else if
				if(condition.type) {
					var typeNames = this._getTypeFromItem(item);
					for each(var typeName in typeNames) {
						if(typeName == condition.type) {
							status = true;
							break;
						}
					}
				} else if(condition.field) {
					var testString = new Zotero.CSL.Compat.FormattedString(this, "Text");
					status = this._getFieldValue(condition.field, this._getFieldDefaults(condition.field), item, testString,
		                    bibCitElement, position, locatorType, locator,
		                    typeName);
				}
			} else if(condition.name == "else") {
				status = true;
			}
			
			if(status) {
				var data = new Zotero.CSL.Compat.FormattedString(this, formattedString.format, element["delimiter"]);
				for(var j in condition.children) {
					// get data for each child element
					var child = condition.children[j];
					
					this._getFieldValue(child.name, child, item, data,
		                    bibCitElement, position, locatorType, locator,
		                    typeName);
				}
				dataAppended = formattedString.concat(data, condition);
				break;
			}
		}
	} else if(name == "text") {
		dataAppended = formattedString.append(this._getTerm(element["term-name"], false, element["form"]), element);
	} else if(name == "isbn" || name == "doi") {
		var field = this._getField(item, name.toUpperCase());
		if(field) {
			dataAppended = formattedString.appendLocator(null, field, element);
		}
	} else if(name == "number") {
		dataAppended = formattedString.append(this._csl.number, element);
	}
	
	// if no change and there's a substitute, try it
	if(dataAppended) {
		return true;
	} else if (element.substitute) {
		// try each substitute element until one returns something
		for(var i in element.substitute) {
			var substituteElement = element.substitute[i];
			var serialization = this._serializeElement(substituteElement.name,
			                                           substituteElement);
			
			var inheritElement;
			if(Zotero.CSL.Compat.Global.inherit[substituteElement.name] && Zotero.CSL.Compat.Global.inherit[name]
			   && Zotero.CSL.Compat.Global.inherit[substituteElement.name] == Zotero.CSL.Compat.Global.inherit[name]) {
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
			substituteElement.form = element.form;
			// clear substitute element off of the element we're substituting
			substituteElement.substitute = undefined;
			
			// get field value
			dataAppended = this._getFieldValue(substituteElement.name,
			                           substituteElement, item, formattedString,
		                    bibCitElement, position, locatorType, locator,
		                    typeName);
			
			// ignore elements with the same serialization
			if(this._ignore) {	// array might not exist if doing disambiguation
				this._ignore[serialization] = true;
			}
			
			// return field value, if there is one; otherwise, keep processing
			// the data
			if(dataAppended) {
				return true;
			}
		}
	}
	
	return false;
}


Zotero.CSL.Compat.FormattedString = function(CSL, format, delimiter) {
	this.CSL = CSL;
	this.format = format;
	this.delimiter = delimiter;
	this.string = "";
	this.closePunctuation = false;
	this.useBritishStyleQuotes = false;
	
	if(format == "RTF") {
		this._openQuote = "\\uc0\\u8220 ";
		this._closeQuote = "\\uc0\\u8221 ";
	} else {
		this._openQuote = "\u201c";
		this._closeQuote = "\u201d";
	}
}

Zotero.CSL.Compat.FormattedString._punctuation = ["!", ".", ",", "?"];

/*
 * attaches another formatted string to the end of the current one
 */
Zotero.CSL.Compat.FormattedString.prototype.concat = function(formattedString, element) {
	if(!formattedString || !formattedString.string) {
		return false;
	}
	
	if(formattedString.format != this.format) {
		throw "CSL: cannot concatenate formatted strings: formats do not match";
	}
	
	if(formattedString.string) {
		// first, append the actual string
		var haveAppended = this.append(formattedString.string, element, false, true);
		
		// if there's close punctuation to append, that also counts
		if(formattedString.closePunctuation) {
			haveAppended = true;
			if(this.closePunctuation) {
				// if there's existing close punctuation and punctuation to
				// append, we need to append that
				this.string += this.closePunctuation;
			}
			// add the new close punctuation
			this.closePunctuation = formattedString.closePunctuation;
		}
		
		return haveAppended;
	}
	return false;
}

/*
 * appends a string (with format parameters) to the current one
 */
Zotero.CSL.Compat.FormattedString.prototype.append = function(string, element, dontDelimit, dontEscape) {
	if(!string) return false;
	if(typeof(string) != "string") {
		string = string.toString();
	}
	
	// append delimiter if necessary
	if(this.delimiter && this.string && !dontDelimit) {
		this.append(this.delimiter, null, true);
	}
	
	// append prefix before closing punctuation
	if(element && element.prefix && this.format != "compare") {
		this.append(element.prefix, null, true);
	}
	
	// close quotes, etc. using punctuation
	if(this.closePunctuation) {
		if(Zotero.CSL.Compat.FormattedString._punctuation.indexOf(string[0]) != -1) {
			this.string += string[0];
			string = string.substr(1);
		}
		this.string += this.closePunctuation;
		this.closePunctuation = false;
	}
	
	// handle text transformation
	if(element) {
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
	}
	
	if(!dontEscape) {
		if(this.format == "HTML") {
			var newString = "";
			
			for(var i=0; i<string.length; i++) {
				var charCode = string.charCodeAt(i);
				// Replace certain characters with HTML entities
				switch (charCode) {
					case 38: // &
						newString += '&amp;';
						break;
					case 60: // <
						newString += '&lt;';
						break;
					case 62: // >
						newString += '&gt;';
						break;
					case 8211: // en-dash
						newString += '&#8211;'
						break;
					case 8212: // em-dash
						newString += '&#8212;'
						break;
					default:
						newString += string[i];
				}
			}
			
			string = newString;
			
		} else if(this.format == "RTF") {
			var newString = "";
			
			// go through and fix up unicode entities
			for(var i=0; i<string.length; i++) {
				var charCode = string.charCodeAt(i);
				if(charCode > 127) {			// encode unicode
					newString += "{\\uc0\\u"+charCode.toString()+"}";
				} else if(charCode == 92) {		// double backslashes
					newString += "\\\\";
				} else {
					newString += string[i];
				}
			}
			
			string = newString;
		} else if(this.format == "Integration") {
			string = string.replace(/\\/g, "\\\\");
		}
	}
	
	if(element) {
		if(this.format == "HTML") {
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
		} else if(this.format == "RTF" || this.format == "Integration") {
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
	
		// add quotes if necessary
		if(element.quotes) {
			this.string += this._openQuote;
			
			if(this.useBritishStyleQuotes) {
				string += this._closeQuote;
			} else {
				this.closePunctuation = this._closeQuote;
			}
		}
	}
	
	this.string += string;
	
	// special rule: if a field ends in a punctuation mark, and the suffix
	// begins with a period, chop the period off the suffix
	var suffix;
	if(element && element.suffix && this.format != "compare") {
		suffix = element.suffix;	// copy so as to leave original intact
		
		if(suffix[0] == "." &&
		   Zotero.CSL.Compat.FormattedString._punctuation.indexOf(string[string.length-1]) != -1) {
		   // if string already ends in punctuation, preserve the existing stuff
		   // and don't add a period
			suffix = suffix.substr(1);
		}
		
		this.append(suffix, null, true);
	}
	
	return true;
}

/*
 * gets the formatted string
 */
Zotero.CSL.Compat.FormattedString.prototype.get = function() {
	return this.string+(this.closePunctuation ? this.closePunctuation : "");
}

/*
 * creates a new formatted string with the same formatting parameters as this one
 */
Zotero.CSL.Compat.FormattedString.prototype.clone = function() {
	return new Zotero.CSL.Compat.FormattedString(this.CSL, this.format);
}

/*
 * formats a locator (pages, volume, issue) or an identifier (isbn, doi)
 * note that label should be null for an identifier
 */
Zotero.CSL.Compat.FormattedString.prototype.appendLocator = function(identifier, number, element) {
	if(number) {
		var data = this.clone();
		
		for(var i in element.children) {
			var child = element.children[i];
			var string = "";
			
			if(child.name == "number") {
				string = number;
			} else if(child.name == "text") {
				var plural = (identifier && (number.indexOf(",") != -1
				              || number.indexOf("-") != -1));
				string = this.CSL._getTerm(child["term-name"], plural, child["form"]);
			} else if(identifier && child.name == "label") {
				var plural = (number.indexOf(",") != -1 || number.indexOf("-") != -1);
				string = this.CSL._getTerm(identifier, plural, child["form"]);
			}
				
			if(string) {
				data.append(string, child);
			}
		}
		
		this.concat(data, element);
		return true;
	} else {
		return false;
	}
}

/*
 * format the date in format supplied by element from the date object
 * returned by this._processDate
 */
Zotero.CSL.Compat.FormattedString.prototype.appendDate = function(date, element) {
		var data = this.clone();
	if(this.format == "disambiguate") {
		// for disambiguation, return only the year
		this.append(null, date.year);
		return (date.year ? true : false);
	}
	
	var data = this.clone();
	var isData = false;
	for(var i in element.children) {
		var child = element.children[i];
		var string = "";
		
		if(child.name == "year" && date.year) {
			if(this.format == "compare") {
				string = Zotero.CSL.Compat.Global.lpad(date.year, "0", 4);
			} else {
				string = date.year.toString();
				if(date.disambiguation) {
					string += date.disambiguation;
				}
			}
		} else if(child.name == "month") {
			if(date.month != undefined) {
				if(this.format == "compare") {
					string = Zotero.CSL.Compat.Global.lpad(date.month+1, "0", 2);
				} else {
					if(element.form == "short") {
						string = this.CSL._terms["short"]["_months"][date.month];
					} else {
						string = this.CSL._terms["long"]["_months"][date.month];
					}
				}
			} else if(date.part && this.format != "compare") {
				string = date.part;
			}
		} else if(child.name == "day" && date.day) {
			if(this.format == "compare") {
				string = Zotero.CSL.Compat.Global.lpad(date.day, "0", 2);
			} else {
				string = date.day.toString();
			}
		} else if(child.name == "text") {
			string = this.CSL._getTerm(child["term-name"], false, child["form"]);
		}
		
		if(string) {
			data.append(string, child);
			isData = true;
		}
	}
	
	this.concat(data, element);
	
	return isData;
}


/*
 * THE FOLLOWING CODE IS SCHOLAR-SPECIFIC
 * gets a list of possible CSL types, in order of preference, for an item
 */
 Zotero.CSL.Compat.Global.optionalTypeMappings = {
	journalArticle:"article-journal",
	magazineArticle:"article-magazine",
	newspaperArticle:"article-newspaper",
	thesis:"thesis",
	letter:"personal communication",
	manuscript:"manuscript",
	interview:"interview",
	film:"motion picture",
	artwork:"graphic",
	webpage:"webpage",
	report:"paper-conference",	// ??
	bill:"bill",
	case:"legal case",
	hearing:"bill",				// ??
	patent:"patent",
	statute:"bill",				// ??
	email:"personal communication",
	map:"map",
	blogPost:"webpage",
	instantMessage:"personal communication",
	forumPost:"webpage",
	audioRecording:"song",		// ??
	presentation:"paper-conference",
	videoRecording:"motion picture",
	tvBroadcast:"motion picture",
	radioBroadcast:"motion picture",
	podcast:"speech",			// ??
	computerProgram:"book"		// ??
};
// TODO: check with Elena/APA/MLA on this
Zotero.CSL.Compat.Global.fallbackTypeMappings = {
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
	webpage:"article",
	report:"book",
	bill:"book",
	case:"book",
	hearing:"book",
	patent:"book",
	statute:"book",
	email:"article",
	map:"article",
	blogPost:"article",
	instantMessage:"article",
	forumPost:"article",
	audioRecording:"article",
	presentation:"article",
	videoRecording:"article",
	tvBroadcast:"article",
	radioBroadcast:"article",
	podcast:"article",
	computerProgram:"book"
};

Zotero.CSL.Compat.prototype._getTypeFromItem = function(item) {
	var scholarType = Zotero.ItemTypes.getName(item.getType());

	// get type
	Zotero.debug("CSL: parsing item of Scholar type "+scholarType);
	if(Zotero.CSL.Compat.Global.optionalTypeMappings[scholarType]) { // if there is an optional type mapping
		var array = [Zotero.CSL.Compat.Global.optionalTypeMappings[scholarType]];
		
		// check if there is a fallback type mapping; otherwise, use article
		if(Zotero.CSL.Compat.Global.fallbackTypeMappings[scholarType]) {
			array.push(Zotero.CSL.Compat.Global.fallbackTypeMappings[scholarType]);
		} else {
			array.push("article");
		}
		
		return array;
	} else if(Zotero.CSL.Compat.Global.fallbackTypeMappings[scholarType]) { // if there is a fallback type mapping
		return [Zotero.CSL.Compat.Global.fallbackTypeMappings[scholarType]];
	} else {	// use article as backup type mapping
		return ["article"];
	}
}

/*
 * separate creators object into authors, editors, and translators
 */
Zotero.CSL.Compat.prototype._separateItemCreators = function(item) {
	var authors = new Array();
	var editors = new Array();
	var translators = new Array();
	
	var authorID = Zotero.CreatorTypes.getPrimaryIDForType(item.getType());
	var editorID = Zotero.CreatorTypes.getID("editor");
	var translatorID = Zotero.CreatorTypes.getID("translator");
	
	var creators = item.getCreators();
	for each(var creator in creators) {
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
Zotero.CSL.Compat.prototype._processDate = function(string) {
	return Zotero.Date.strToDate(string);
}

/*
 * get a field on an item
 */
Zotero.CSL.Compat.prototype._getField = function(item, field) {
	return item.getField(field, false, true);
}

/*
 * END SCHOLAR-SPECIFIC CODE
 */