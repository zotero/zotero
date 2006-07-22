/*
 * Scholar.Cite: a class for creating bibliographies from within Scholar
 * this class handles pulling the CSL file and item data out of the database,
 * while Scholar.CSL, below, handles the actual generation of the bibliography
 */
Scholar.Cite = new function() {
	this.getBibliography = getBibliography;
	this.getStyles = getStyles;
	
	function getStyles() {
		// TODO: return key/values from database
		return ["American Psychological Association"];
	}
	
	function getBibliography(style, items) { 
		// TODO: retrieve style from the database
		style = '<citationstyle xmlns="http://purl.org/net/xbiblio/csl" xml:lang="en">   <info>      <title>American Psychological Association</title>      <title-short>APA</title-short>      <edition>5</edition>      <author>         <name>Bruce DÕArcus</name>         <email>bdarcus@sourceforge.net</email>      </author>      <dateCreated>2005-05-18</dateCreated>      <dateModified>2006-07-09</dateModified>      <source         href="http://www.english.uiuc.edu/cws/wworkshop/writer_resources/citation_styles/apa/apa.htm"         >Citation Styles Handbook: APA</source>      <field>psychology</field>      <description>Style for the American Psychological      Association.</description>   </info>   <general>      <names and="text" sort-separator=", " initialize-with=".">         <original-script position="after" prefix=" "/>      </names>      <contributors>         <label position="before-unless-first" type="verb"/>      </contributors>      <locators>         <label position="before" form="short"/>      </locators>      <titles>         <original-script position="after" prefix=" "/>      </titles>      <dates format="year, month day" month="full">         <original position="after" prefix=" [" suffix="]"/>      </dates>      <publishers order="address-publisher" separator=":"/>      <access order="url-date" separator=", "/>   </general>   <citation delimiter=";" type="author-year" sort-order="author-date"      prefix="(" suffix=")">      <use-et_al min-authors="6" use-first="6" position="first"/>      <use-et_al min-authors="6" use-first="1" position="subsequent"/>      <item-layout>         <author form="short" suffix=", "/>         <year/>         <point-locator prefix=": " include-label="false"/>      </item-layout>   </citation>   <bibliography author-as-sort-order="all" author-shorten-with="ÑÑÑ."      sort-order="author-date">      <use-et_al min-authors="4" use-first="3"/>      <list-layout>         <heading label="references"/>      </list-layout>      <item-layout suffix=".">         <reftype name="book">            <author alternate="editor"/>            <year prefix=" (" suffix=")."/>            <title font-style="italic" prefix=" " suffix="."/>            <editor prefix=", "/>            <publisher/>            <access prefix=" "/>         </reftype>         <reftype name="chapter">            <author alternate="editor"/>            <year prefix=" (" suffix=")."/>            <title prefix=" "/>            <group class="container">               <text idref="in"/>               <editor/>               <title type="container" font-style="italic" prefix=" " suffix="."/>               <title type="series" prefix=" " suffix="."/>               <publisher/>            </group>            <access prefix=" "/>            <pages prefix=", "/>         </reftype>         <reftype name="article">            <author alternate="container-title"/>            <year prefix=" (" suffix=")."/>            <title prefix=" "/>            <group class="container">               <editor/>               <title type="container" font-style="italic" prefix=" " suffix="."/>            </group>            <access prefix=" "/>            <volume prefix=" "/>            <issue prefix="(" suffix=")"/>            <pages prefix=", "/>         </reftype>        <reftype name="legalcase">          <title/>          <year prefix=" (" suffix=")"/>          <access prefix=", "/>        </reftype>      </item-layout>   </bibliography></citationstyle>';
		
		// get item arrays
		var itemArrays = new Array();
		for(var i in items) {
			itemArrays.push(items[i].toArray());
		}
		
		// create a Scholar.CSL instance
		var CSL = new Scholar.CSL(style);
		// return bibliography
		return CSL.createBibliography(itemArrays);
	}
}

/*
 * Scholar.CSL: a class for creating bibliographies from CSL files
 * this is abstracted as a separate class for the benefit of anyone who doesn't
 * want to use the Scholar data model, but does want to use CSL in JavaScript
 */

/*
 * constructor
 */
Scholar.CSL = function(csl) {
	default xml namespace = Scholar.CSL.ns;
	this._csl = new XML(csl);
	
	// load basic options
	this._parseOptions();
}



Scholar.CSL._loc = {
	and:"and",
	etAl:"et al",
	pSingle:"p.",
	pMultiple:"pp.",
	editorVerb:"Edited By",
	editorNounSingle:"Ed.",
	editorNounMultiple:"Eds.",
	translatorVerb:"Translated By",
	translatorNounSingle:"Trans.",
	translatorNounMultiple:"Trans.",
	months:["January", "February", "March", "April", "May", "June", "July",
	        "August", "September", "October", "November", "December"],
	monthsAbbreviated:["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
	                   "Sep", "Oct", "Nov", "Dec"],
	pagesShortSingle:"p",
	pagesShortMultiple:"pp",
	pagesLongSingle:"page",
	pagesLongMultiple:"pages"
}


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

Scholar.CSL.ns = "http://purl.org/net/xbiblio/csl";

/*
 * create a bibliography
 * (items is expected to be an array of items)
 */
Scholar.CSL.prototype.createBibliography = function(items) {
	// sort by sort order
	if(this._opt.sortOrder == "author-date") {
		items.sort(function(a, b) {
			// first make sure both have creators at the first index
			if(!a.creators[0] && b.creators[0]) {
				return 1;
			} else if(!b.creators[0] && a.creators[0]) {
				return -1;
			}
			
			// now, either both have creators or neither do
			if(a.creators[0]) {
				// sort by last names
				if(b.creators[0].lastName > a.creators[0].lastName) {
					return 1;
				} else if(b.creators[0].lastName < a.creators[0].lastName) {
					return -1;
				}
				// sort by first name
				if(b.creators[0].firstName > a.creators[0].firstName) {
					return 1;
				} else if(b.creators[0].firstName < a.creators[0].firstName) {
					return -1;
				}
			}
			
			// now, sort by date
			var date1 = (a.date ? a.date : a.year);
			var date2 = (b.date ? b.date : b.year);
			if(date2 > date1) {
				return 1;
			} else if(date1 > date2) {
				return -1;
			}
			
			// finally, give up; they're the same
			return 0;
		});
	}
	
	// process items
	var output = "";
	for(var i in items) {
		var item = items[i];
		if(item.itemType == "note") {	// skip notes
			continue;
		}
		
		// determine mapping
		if(Scholar.CSL._optionalTypeMappings[item.itemType]
		   && this._opt.referenceTypes[Scholar.CSL._optionalTypeMappings[item.itemType]]) {
			if(this._opt.referenceTypes[Scholar.CSL._optionalTypeMappings[item.itemType]] === true) {
				// exists but not yet processed
				this._parseReferenceType(Scholar.CSL._optionalTypeMappings[item.itemType]);
			}
			
			var reftype = this._opt.referenceTypes[Scholar.CSL._optionalTypeMappings[item.itemType]];
		} else {
			if(this._opt.referenceTypes[Scholar.CSL._fallbackTypeMappings[item.itemType]] === true) {
				this._parseReferenceType(Scholar.CSL._fallbackTypeMappings[item.itemType]);
			}
			
			var reftype = this._opt.referenceTypes[Scholar.CSL._fallbackTypeMappings[item.itemType]];
		}
		
		output += "<p>"+this._processElements(reftype, item)+"</p>\n";
	}
	
	return output;
}

/*
 * process an item
 */
Scholar.CSL.prototype._processElements = function(reftype, item) {
	var output = "";
	
	// separate item into authors, editors, translators
	var authors = new Array();
	var editors = new Array();
	var translators = new Array();
	for(var j in item.creators) {
		if(item.creators[j].creatorType == "editor") {
			editors.push(item.creators[j]);
		} else if(item.creators[j].creatorType == "translator") {
			translators.push(item.creators[j]);
		} else {
			authors.push(item.creators[j]);
		}
	}
	if(item.date) {		// specific date
		var date = this._processDate(item.date);
	} else {			// no real date, but might salvage a year 
		var date = new Object();
		
		if(item.year) {
			date.year = item.year;
		}
	}
	
	for(var i in reftype) {
		var element = reftype[i];
		var data = "";
		
		if(element.name == "author") {
			if(authors.length) {
				data = this._processCreators("author", authors);
			} else if(element.alternate) {	// no authors; use alternate if
											// it exists
				if(element.alternate == "editor") {
					data = this._processCreators("editor", editors);
					editors = new Array();
				} else if(element.alternate == "title") {
					data = item.title;
					item.title = undefined;
				} else if(element.alternate == "container-title") {
					if(item.publication) {
						data = item.publication;
						item.publication = undefined;
					}
				}
			}
		} else if(element.name == "editor") {
			data = this._processCreators("editor", editors);
		} else if(element.name == "translator") {
			data = this._processCreators("translator", translators);
		} else if(element.name == "year") {
			data = date.year;
		} else if(element.name == "month-day") {
			data = date.month+" "+date.day;
		} else if(element.name == "date") {
			data = this._formatDate(date);
		} else if(element.name == "volume") {
			data = item.volume;
		} else if(element.name == "issue") {
			data = item.number;
		} else if(element.name == "pages") {
			if(item.pages) {
				if(this._opt.locators.label) {
					if(item.pages.indexOf(",") != -1 || item.pages.indexOf("-") != -1) {
						var label = this._opt.locators.label[1];
					} else {
						var label = this._opt.locators.label[0];
					}
					if(this._opt.locators.positionBefore) {
						data += label;
					}
				}
				data += item.pages;
				if(this._opt.locators.label && !this._opt.locators.positionBefore) {
					data += label;
				}
			}
		} else if(element.name == "title") {
			if(!element.type) {	// standard title
				data = item.title;
			} else if(element.type == "container" && item.publication) {
				data = item.publication;
			} else if(element.type == "series") {
				data = item.series;
			}
		} else if(element.name == "publisher") {
			if(item.publisher) {
				if(item.place) {
					if(this._opt.publishers.publisherFirst) {
						data = item.publisher+this._opt.publishers.separator+item.place;
					} else {
						data = item.place+this._opt.publishers.separator+item.publisher;
					}
				} else {
					data = item.publisher;
				}
			}
		} else if(element.name == "access") {
			var dateAccessed = "";
			if(item.dateAccessed) {
				var dateAccessed = this._formatDate(this._processDate(item.dateAccessed));
			}
			
			if(this._opt.access.dateFirst) {
				data = (dateAccessed ? dateAccessed : "");
			} else {
				data = (item.url ? item.url : "");
			}
			if(dateAccessed && item.url) {
				data += this._opt.access.separator;
			}
			if(this._opt.access.dateFirst) {
				data += item.url;
			} else {
				data += dateAccessed;
			}
		} else if(element.name == "group") {
			data = this._processElements(element.elements, item);
		} else {
			data = element.name;
		}
		
		style = "";
		var cssAttributes = ["font-family", "font-style", "font-variant",
		                     "font-weight", "text-transform"];
		for(var j in cssAttributes) {
			if(element[cssAttributes[j]] && element[cssAttributes[j]].indexOf('"') == -1) {
				style += cssAttributes[j]+":"+element[cssAttributes[j]];
			}
		}
		
		if(data) {
			var data = data.toString();
			
			// add prefix
			if(element.prefix) {
				output += element.prefix;
			}
			
			if(style) {
				output += '<span style="'+style+'">';
			}
			output += data;
			if(style) {
				output += '</span>';
			}
			
			if(element.suffix) {
				// suffix for this element only
				output += element.suffix;
			} else if(element.name != "group" && this._opt.suffix && data.substr(data.length-this._opt.suffix.length) != this._opt.suffix) {
				// global suffix if no suffix for this element
				output += this._opt.suffix;
			}
		}
	}
	
	return output;
}

/*
 * process creator objects; if someone had a creator model that handled
 * non-Western names better than ours, this would be the function to change
 */
Scholar.CSL.prototype._processCreators = function(type, creators) {
	var maxCreators = creators.length;
	if(!maxCreators) return;
	
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
		if(this._opt.names.initializeWith) {	// initialize with makes us use first
										// initials, e.g. Doe, J.R.
			var firstName = "";
			var firstNames = creators[i].firstName.split(" ");
			for(var j in firstNames) {
				if(firstNames[j]) {
					// get first initial, put in upper case, add initializeWith string
					firstName += firstNames[j][0].toUpperCase()+this._opt.names.initializeWith;
				}
			}
		} else {
			firstName = creators[i].firstName;
		}
		lastName = creators[i].lastName;
		
		if(i == 0 && this._opt.names.firstAuthorInverted || this._opt.names.subsequentAuthorInverted) {
			// if this is the first author and author-as-sort-order="first-author"
			// or if this is a subsequent author and author-as-sort-order="all"
			// then the name gets inverted
			authorStrings.push(lastName+this._opt.names.sortSeparator+firstName);
		} else {
			authorStrings.push(firstName+" "+lastName);
		}
	}
	
	// figure out if we need an "and" or an "et al"
	var joinString = ", ";
	if(maxCreators > 1) {
		if(useEtAl) {	// multiple creators and need et al
			authorStrings.push(Scholar.CSL._loc.etAl);
		} else {		// multiple creators but no et al
			// add and to last creator
			authorStrings[maxCreators-1] = this._opt.names.and+" "+authorStrings[maxCreators-1];
			// skip the comma if there are only two creators and no
			// et al
			if(maxCreators == 2) {
				joinString = " ";
			}
		}
	}
	
	var returnString = authorStrings.join(joinString);
	
	// add "Edited By" or "Translated By"
	if(this._opt.contributors.label[type]) {
		// figure out whether to use singular or plural representation
		if(maxCreators == 1) {
			var label = this._opt.contributors.label[type][0];
		} else {
			var label = this._opt.contributors.label[type][1];
		}
		// figure out where to add
		if(this._opt.contributors.positionBefore) {
			returnString = label+" "+returnString;
		} else {
			returnString += " ("+label+")";
		}
	}
	
	// add to the data
	return returnString;
}

/*
 * process the date "string" into a useful object
 */
Scholar.CSL.prototype._processDate = function(string) {
	var date = new Object();

	var dateRe = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
	var m = dateRe.exec(string);
	if(m) {		// sql date
		var jsDate = new Date(m[1], m[2]-1, m[3], false, false, false);
	} else {	// not an sql date
		var jsDate = new Date(string);
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
		date.month = this._opt.dates.months[jsDate.getMonth()];
		date.day = jsDate.getDay();
	}
	
	return date;
}

/*
 * format the date according to date processing preference from the date object
 * returned by this._processDate
 */
Scholar.CSL.prototype._formatDate = function(date) {
	var data = this._opt.dates.format.replace("year", (date.year ? date.year : ""));
	data = data.replace("month", (date.month ? date.month : ""));
	data = data.replace("day", (date.day ? date.day : ""));
	data = data.replace(/^[^\w]+/, "");
	data = data.replace(/[^\w]+$/, "");
	return data;
}

	default xml namespace = Scholar.CSL.ns;
/*
 * convert options to native structures for speed
 */
Scholar.CSL.prototype._parseOptions = function() {
	default xml namespace = Scholar.CSL.ns;
	this._opt = new Object();
	
	// names
	this._opt.names = new Object();
	if(this._csl.general.names.@and == "text") {
		this._opt.names.and = Scholar.CSL._loc.and;
	} else if(this._csl.general.names.@and == "symbol") {
		this._opt.names.and = "&";
	} else {
		this._opt.names.and = "";
	}
	this._opt.names.sortSeparator = this._csl.general.names["@sort-separator"].toString();
	this._opt.names.initializeWith = this._csl.general.names["@initialize-with"].toString();
	if(this._csl.bibliography["@author-as-sort-order"] == "all") {
		this._opt.names.firstAuthorInverted = true;
		this._opt.names.subsequentAuthorInverted = true;
	} else if(this._csl.bibliography["@author-as-sort-order"] == "first-author") {
		this._opt.names.firstAuthorInverted = true;
		this._opt.names.subsequentAuthorInverted = false;
	} else {
		this._opt.names.firstAuthorInverted = false;
		this._opt.names.subsequentAuthorInverted = false;
	}
	
	// contributors
	this._opt.contributors = new Object();
	if(this._csl.general.contributors.label.length) {
		// contributors
		if(this._csl.general.contributors.label.@position == "before") {
			this._opt.contributors.positionBefore = true;
		}
		if(this._csl.general.contributors.label.@type == "verb") {
			this._opt.contributors.label = {editor:[Scholar.CSL._loc.editorVerb, Scholar.CSL._loc.editorVerb],
			                          translator:[Scholar.CSL._loc.translatorVerb, Scholar.CSL._loc.translatorVerb]}
		} else {
			this._opt.contributors.label = {editor:[Scholar.CSL._loc.editorNounSingle, Scholar.CSL._loc.editorNounMultiple],
			                          translator:[Scholar.CSL._loc.translatorNounSingle, Scholar.CSL._loc.translatorNounMultiple]}
		}
	}
	
	// locators
	this._opt.locators = new Object();
	if(this._csl.general.Scholar.CSL._locators.label.length) {
		// contributors
		if(this._csl.general.Scholar.CSL._locators.label.@position == "before") {
			this._opt.locators.positionBefore = true;
		}
		if(this._csl.general.Scholar.CSL._locators.label.@form == "short") {
			this._opt.locators.label = [Scholar.CSL._loc.pagesShortSingle, Scholar.CSL._loc.pagesShortMultiple];
		} else {
			this._opt.locators.label = [Scholar.CSL._loc.pagesLongSingle, Scholar.CSL._loc.pagesLongMultiple];
		}
	}
	
	// dates
	this._opt.dates = new Object();
	this._opt.dates.format = this._csl.general.dates.@format.toString();
	if(this._csl.general.dates.@month == "abbreviated") {
		this._opt.dates.months = Scholar.CSL._loc.monthsAbbreviated;
	} else {
		this._opt.dates.months = Scholar.CSL._loc.months;
	}
	
	// publishers
	this._opt.publishers = new Object();
	if(this._csl.general.publishers.@order == "publisher-address") {
		this._opt.publishers.publisherFirst = true;
	}
	this._opt.publishers.separator = this._csl.general.publishers.@separator.toString();
	
	// access
	this._opt.access = new Object();
	if(this._csl.general.access.@order == "date-url") {
		this._opt.access.dateFirst = true;
	}
	this._opt.access.separator = this._csl.general.access.@separator.toString();
	
	// et al
	if(this._csl.bibliography['use-et_al'].length()) {
		this._opt.names.etAl = new Object();
		this._opt.names.etAl.minCreators = parseInt(this._csl.bibliography['use-et_al']['@min-authors']);
		this._opt.names.etAl.useFirst = parseInt(this._csl.bibliography['use-et_al']['@use-first']);
	}
	
	// sort order
	this._opt.sortOrder = this._csl.bibliography["@sort-order"].toString();
	
	// referenceTypes
	this._opt.referenceTypes = new Object();
	for each(var element in this._csl.bibliography['item-layout'].reftype) {
		if(element.namespace() == Scholar.CSL.ns) {	// ignore elements in other namespaces
			this._opt.referenceTypes[element.@name.toString()] = true;
		}
	}
	
	// global prefix and suffix
	this._opt.suffix = this._csl.bibliography["item-layout"].@suffix.toString();
	this._opt.prefix = this._csl.bibliography["item-layout"].@prefix.toString();
}

/*
 * does the dirty work for parseReferenceTypes - recursively process attributes
 * into an associative array
 */
Scholar.CSL.prototype._parseElements = function(ref) {
	var typeDesc = new Array();
	for each(var element in ref) {
		if(element.namespace() == Scholar.CSL.ns) {	// ignore elements in other namespaces
			var itemDesc = new Object();
			itemDesc.name = element.localName();
			var attributes = element.attributes();
			for each(var attribute in attributes) {
				itemDesc[attribute.name()] = attribute.toString();
			}
			if(itemDesc.name == "group") {	// parse groups recursively
				itemDesc.elements = this._parseElements(element.elements());
			}
			typeDesc.push(itemDesc);
		}
	}
	return typeDesc;
}

/*
 * convert reference types to native structures for speed
 */
Scholar.CSL.prototype._parseReferenceType = function(reftype) {
	default xml namespace = Scholar.CSL.ns;
	var ref = this._csl.bibliography['item-layout'].reftype.(@name==reftype).elements();
	this._opt.referenceTypes[reftype] = this._parseElements(ref);
}