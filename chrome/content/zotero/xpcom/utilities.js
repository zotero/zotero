/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
	
	Utilities based in part on code taken from Piggy Bank 2.1.1 (BSD-licensed)
	
    ***** END LICENSE BLOCK *****
*/

/**
 * @class Functions for text manipulation and other miscellaneous purposes
 */
Zotero.Utilities = {
	/**
	 * Cleans extraneous punctuation off a creator name and parse into first and last name
	 *
	 * @param {String} author Creator string
	 * @param {String} type Creator type string (e.g., "author" or "editor")
	 * @param {Boolean} useComma Whether the creator string is in inverted (Last, First) format
	 * @return {Object} firstName, lastName, and creatorType
	 */
	"cleanAuthor":function(author, type, useComma) {
		const allCapsRe = /^[A-Z\u0400-\u042f]+$/;
		
		if(typeof(author) != "string") {
			throw "cleanAuthor: author must be a string";
		}
		
		author = author.replace(/^[\s\.\,\/\[\]\:]+/, '');
		author = author.replace(/[\s\,\/\[\]\:\.]+$/, '');
		author = author.replace(/  +/, ' ');
		if(useComma) {
			// Add spaces between periods
			author = author.replace(/\.([^ ])/, ". $1");
			
			var splitNames = author.split(/, ?/);
			if(splitNames.length > 1) {
				var lastName = splitNames[0];
				var firstName = splitNames[1];
			} else {
				var lastName = author;
			}
		} else {
			var spaceIndex = author.lastIndexOf(" ");
			var lastName = author.substring(spaceIndex+1);
			var firstName = author.substring(0, spaceIndex);
		}
		
		if(firstName && allCapsRe.test(firstName) &&
				firstName.length < 4 &&
				(firstName.length == 1 || lastName.toUpperCase() != lastName)) {
			// first name is probably initials
			var newFirstName = "";
			for(var i=0; i<firstName.length; i++) {
				newFirstName += " "+firstName[i]+".";
			}
			firstName = newFirstName.substr(1);
		}
		
		return {firstName:firstName, lastName:lastName, creatorType:type};
	},
	
	/**
	 * Removes leading and trailing whitespace from a string
	 * @type String
	 */
	"trim":function(/**String*/ s) {
		if (typeof(s) != "string") {
			throw "trim: argument must be a string";
		}
		
		s = s.replace(/^\s+/, "");
		return s.replace(/\s+$/, "");
	},

	/**
	 * Cleans whitespace off a string and replaces multiple spaces with one
	 * @type String
	 */
	"trimInternal":function(/**String*/ s) {
		if (typeof(s) != "string") {
			throw "trimInternal: argument must be a string";
		}
		
		s = s.replace(/[\xA0\r\n\s]+/g, " ");
		return this.trim(s);
	},

	/**
	 * Cleans any non-word non-parenthesis characters off the ends of a string
	 * @type String
	 */
	"superCleanString":function(/**String*/ x) {
		if(typeof(x) != "string") {
			throw "superCleanString: argument must be a string";
		}
		
		var x = x.replace(/^[\x00-\x27\x29-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/, "");
		return x.replace(/[\x00-\x28\x2A-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+$/, "");
	},
	
	/**
	 * Eliminates HTML tags, replacing &lt;br&gt;s with newlines
	 * @type String
	 */
	"cleanTags":function(/**String*/ x) {
		if(typeof(x) != "string") {
			throw "cleanTags: argument must be a string";
		}
		
		x = x.replace(/<br[^>]*>/gi, "\n");
		return x.replace(/<[^>]+>/g, "");
	},

	/**
	 * Strip info:doi prefix and any suffixes from a DOI
	 * @type String
	 */
	"cleanDOI":function(/**String**/ x) {
		if(typeof(x) != "string") {
			throw "cleanDOI: argument must be a string";
		}
		
		return x.match(/10\.[^\s\/]+\/[^\s]+/);
	},

	/**
	 * Convert plain text to HTML by replacing special characters and replacing newlines with BRs or
	 * P tags
	 * @param {String} str Plain text string
	 * @param {Boolean} singleNewlineIsParagraph Whether single newlines should be considered as
	 *     paragraphs. If true, each newline is replaced with a P tag. If false, double newlines
	 *     are replaced with P tags, while single newlines are replaced with BR tags.
	 * @type String
	 */
	"text2html":function (/**String**/ str, /**Boolean**/ singleNewlineIsParagraph) {
		str = Zotero.Utilities.htmlSpecialChars(str);
		
		// \n => <p>
		if (singleNewlineIsParagraph) {
			str = '<p>'
					+ str.replace(/\n/g, '</p><p>')
						.replace(/  /g, '&nbsp; ')
				+ '</p>';
		}
		// \n\n => <p>, \n => <br/>
		else {
			str = '<p>'
					+ str.replace(/\n\n/g, '</p><p>')
						.replace(/\n/g, '<br/>')
						.replace(/  /g, '&nbsp; ')
				+ '</p>';
		}
		return str.replace(/<p>\s*<\/p>/g, '<p>&nbsp;</p>');
	},

	/**
	 * Encode special XML/HTML characters<br/>
	 * <br/>
	 * Certain entities can be inserted manually:<br/>
	 * <pre> &lt;ZOTEROBREAK/&gt; =&gt; &lt;br/&gt;
	 * &lt;ZOTEROHELLIP/&gt; =&gt; &amp;#8230;</pre>
	 * @type String
	 */
	 "htmlSpecialChars":function(/**String*/ str) {
		if (typeof str != 'string') {
			throw "Argument '" + str + "' must be a string in Zotero.Utilities.htmlSpecialChars()";
		}
		
		if (!str) {
			return '';
		}
		
		var chars = ['&', '"',"'",'<','>'];
		var entities = ['amp', 'quot', 'apos', 'lt', 'gt'];
		
		var newString = str;
		for (var i = 0; i < chars.length; i++) {
			var re = new RegExp(chars[i], 'g');
			newString = newString.replace(re, '&' + entities[i] + ';');
		}
		
		newString = newString.replace(/&lt;ZOTERO([^\/]+)\/&gt;/g, function (str, p1, offset, s) {
			switch (p1) {
				case 'BREAK':
					return '<br/>';
				case 'HELLIP':
					return '&#8230;';
				default:
					return p1;
			}
		});
		
		return newString;
	},

	/**
	 * Decodes HTML entities within a string, returning plain text
	 * @type String
	 */
	"unescapeHTML":function(/**String*/ str) {
		if(Zotero.isFx) {
			var nsISUHTML = Components.classes["@mozilla.org/feed-unescapehtml;1"]
				.getService(Components.interfaces.nsIScriptableUnescapeHTML);
			return nsISUHTML.unescape(str);
		} else {
			var node = document.createElement("div");
			node.innerHTML = str;
			return node.textContent;
		}
	},
	
	/**
	 * Wrap URLs and DOIs in <a href=""> links in plain text
	 *
	 * Ignore URLs preceded by '>', just in case there are already links
	 * @type String
	 */
	"autoLink":function (/**String**/ str) {
		// "http://www.google.com."
		// "http://www.google.com. "
		// "<http://www.google.com>" (and other characters, with or without a space after)
		str = str.replace(/([^>])(https?:\/\/[^\s]+)([\."'>:\]\)](\s|$))/g, '$1<a href="$2">$2</a>$3');
		// "http://www.google.com"
		// "http://www.google.com "
		str = str.replace(/([^">])(https?:\/\/[^\s]+)(\s|$)/g, '$1<a href="$2">$2</a>$3');
		
		// DOI
		str = str.replace(/(doi:[ ]*)(10\.[^\s]+[0-9a-zA-Z])/g, '$1<a href="http://dx.doi.org/$2">$2</a>');
		return str;
	},
	
	/**
	 * Parses a text string for HTML/XUL markup and returns an array of parts. Currently only finds
	 * HTML links (&lt;a&gt; tags)
	 *
	 * @return {Array} An array of objects with the following form:<br>
	 * <pre>   {
	 *         type: 'text'|'link',
	 *         text: "text content",
	 *         [ attributes: { key1: val [ , key2: val, ...] }
	 *    }</pre>
	 */
	"parseMarkup":function(/**String*/ str) {
		var parts = [];
		var splits = str.split(/(<a [^>]+>[^<]*<\/a>)/);
		
		for(var i=0; i<splits.length; i++) {
			// Link
			if (splits[i].indexOf('<a ') == 0) {
				var matches = splits[i].match(/<a ([^>]+)>([^<]*)<\/a>/);
				if (matches) {
					// Attribute pairs
					var attributes = {};
					var pairs = matches[1].match(/([^ =]+)="([^"]+")/g);
					for(var j=0; j<pairs.length; j++) {
						var keyVal = pairs[j].split(/=/);
						attributes[keyVal[0]] = keyVal[1].substr(1, keyVal[1].length - 2);
					}
					
					parts.push({
						type: 'link',
						text: matches[2],
						attributes: attributes
					});
					continue;
				}
			}
			
			parts.push({
				type: 'text',
				text: splits[i]
			});
		}
		
		return parts;
	},
	
	/**
	 * Calculates the Levenshtein distance between two strings
	 * @type Number
	 */
	"levenshtein":function (/**String*/ a, /**String**/ b) {
		var aLen = a.length;
		var bLen = b.length;
		
		var arr = new Array(aLen+1);
		var i, j, cost;
		
		for (i = 0; i <= aLen; i++) {
			arr[i] = new Array(bLen);
			arr[i][0] = i;
		}
		
		for (j = 0; j <= bLen; j++) {
			arr[0][j] = j;
		}
		
		for (i = 1; i <= aLen; i++) {
			for (j = 1; j <= bLen; j++) {
				cost = (a[i-1] == b[j-1]) ? 0 : 1;
				arr[i][j] = Math.min(arr[i-1][j] + 1, Math.min(arr[i][j-1] + 1, arr[i-1][j-1] + cost));
			}
		}
		
		return arr[aLen][bLen];
	},
	
	/**
	 * Test if an object is empty
	 *
	 * @param {Object} obj
	 * @type Boolean
	 */
	"isEmpty":function (obj) {
		for (var i in obj) {
			return false;
		}
		return true;
	},

	/**
	 * Compares an array with another and returns an array with
	 *	the values from array1 that don't exist in array2
	 *
	 * @param	{Array}		array1
	 * @param	{Array}		array2
	 * @param	{Boolean}	useIndex		If true, return an array containing just
	 *										the index of array2's elements;
	 *										otherwise return the values
	 */
	"arrayDiff":function(array1, array2, useIndex) {
		if (array1.constructor.name != 'Array') {
			throw ("array1 is not an array in Zotero.Utilities.arrayDiff() (" + array1 + ")");
		}
		if (array2.constructor.name != 'Array') {
			throw ("array2 is not an array in Zotero.Utilities.arrayDiff() (" + array2 + ")");
		}
		
		var val, pos, vals = [];
		for (var i=0; i<array1.length; i++) {
			val = array1[i];
			pos = array2.indexOf(val);
			if (pos == -1) {
				vals.push(useIndex ? pos : val);
			}
		}
		return vals;
	},
	
	/**
	 * Return new array with duplicate values removed
	 *
	 * From the JSLab Standard Library (JSL)
	 * Copyright 2007 - 2009 Tavs Dokkedahl
	 * Contact: http://www.jslab.dk/contact.php
	 *
	 * @param	{Array}		array
	 * @return	{Array}
	 */
	"arrayUnique":function(arr) {
		var a = [];
		var l = arr.length;
		for(var i=0; i<l; i++) {
			for(var j=i+1; j<l; j++) {
				// If this[i] is found later in the array
				if (arr[i] === arr[j])
					j = ++i;
			}
			a.push(arr[i]);
		}
		return a;
	},
	
	/**
	 * Generate a random integer between min and max inclusive
	 *
	 * @param	{Integer}	min
	 * @param	{Integer}	max
	 * @return	{Integer}
	 */
	"rand":function (min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	},

	/**
	 * Parse a page range
	 *
	 * @param {String} Page range to parse
	 * @return {Integer[]} Start and end pages
	 */
	"getPageRange":function(pages) {
		const pageRangeRegexp = /^\s*([0-9]+) ?[-\u2013] ?([0-9]+)\s*$/
		
		var pageNumbers;
		var m = pageRangeRegexp.exec(pages);
		if(m) {
			// A page range
			pageNumbers = [m[1], m[2]];
		} else {
			// Assume start and end are the same
			pageNumbers = [pages, pages];
		}
		return pageNumbers;
	},

	/**
	 * Pads a number or other string with a given string on the left
	 *
	 * @param {String} string String to pad
	 * @param {String} pad String to use as padding
	 * @length {Integer} length Length of new padded string
	 * @type String
	 */
	"lpad":function(string, pad, length) {
		string = string ? string + '' : '';
		while(string.length < length) {
			string = pad + string;
		}
		return string;
	},

	/**
	 * Shorten and add an ellipsis to a string if necessary
	 *
	 * @param	{String}	str
	 * @param	{Integer}	len
	 * @param	{Boolean}	[countChars=false]
	 */
	"ellipsize":function (str, len, countChars) {
		if (!len) {
			throw ("Length not specified in Zotero.Utilities.ellipsize()");
		}
		if (str.length > len) {
			return str.substr(0, len) + '...' + (countChars ? ' (' + str.length + ' chars)' : '');
		}
		return str;
	},
	
	/**
	  * Port of PHP's number_format()
	  *
	  * MIT Licensed
	  *
	  * From http://kevin.vanzonneveld.net
	  * +   original by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
	  * +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
	  * +     bugfix by: Michael White (http://getsprink.com)
	  * +     bugfix by: Benjamin Lupton
	  * +     bugfix by: Allan Jensen (http://www.winternet.no)
	  * +    revised by: Jonas Raoni Soares Silva (http://www.jsfromhell.com)
	  * +     bugfix by: Howard Yeend
	  * *     example 1: number_format(1234.5678, 2, '.', '');
	  * *     returns 1: 1234.57
	 */
	"numberFormat":function (number, decimals, dec_point, thousands_sep) {
		var n = number, c = isNaN(decimals = Math.abs(decimals)) ? 2 : decimals;
		var d = dec_point == undefined ? "." : dec_point;
		var t = thousands_sep == undefined ? "," : thousands_sep, s = n < 0 ? "-" : "";
		var i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "", j = (j = i.length) > 3 ? j % 3 : 0;
		
		return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
	},

	/**
	 * Cleans a title, converting it to title case and replacing " :" with ":"
	 *
	 * @param {String} string
	 * @param {Boolean} force Forces title case conversion, even if the capitalizeTitles pref is off
	 * @type String
	 */
	"capitalizeTitle":function(string, force) {
		const skipWords = ["but", "or", "yet", "so", "for", "and", "nor", "a", "an",
			"the", "at", "by", "from", "in", "into", "of", "on", "to", "with", "up",
			"down", "as"];
		
		// this may only match a single character
		const delimiterRegexp = /([ \/\-–—])/;
		
		string = this.trimInternal(string);
		string = string.replace(/ : /g, ": ");
		if(!Zotero.Prefs.get('capitalizeTitles') && !force) return string;
		if(!string) return "";
		
		// split words
		var words = string.split(delimiterRegexp);
		var isUpperCase = string.toUpperCase() == string;
		
		var newString = "";
		var delimiterOffset = words[0].length;
		var lastWordIndex = words.length-1;
		var previousWordIndex = -1;
		for(var i=0; i<=lastWordIndex; i++) {
			// only do manipulation if not a delimiter character
			if(words[i].length != 0 && (words[i].length != 1 || !delimiterRegexp.test(words[i]))) {
				var upperCaseVariant = words[i].toUpperCase();
				var lowerCaseVariant = words[i].toLowerCase();
				
				// only use if word does not already possess some capitalization
				if(isUpperCase || words[i] == lowerCaseVariant) {
					if(
						// a skip word
						skipWords.indexOf(lowerCaseVariant.replace(/[^a-zA-Z]+/, "")) != -1
						// not first or last word
						&& i != 0 && i != lastWordIndex
						// does not follow a colon
						&& (previousWordIndex == -1 || words[previousWordIndex][words[previousWordIndex].length-1] != ":")
					) {
						words[i] = lowerCaseVariant;
					} else {
						// this is not a skip word or comes after a colon;
						// we must capitalize
						words[i] = upperCaseVariant[0] + lowerCaseVariant.substr(1);
					}
				}
				
				previousWordIndex = i;
			}
			
			newString += words[i];
		}
		
		return newString;
	},

	/**
	 * Run sets of data through multiple asynchronous callbacks
	 *
	 * Each callback is passed the current set and a callback to call when done
	 *
	 * @param	{Object[]}		sets			Sets of data
	 * @param	{Function[]}	callbacks
	 * @param	{Function}		onDone			Function to call when done
	 */
	 "processAsync":function (sets, callbacks, onDone) {
		var currentSet;
		var index = 0;
		
		var nextSet = function () {
			if (!sets.length) {
				onDone();
				return;
			}
			index = 0;
			currentSet = sets.shift();
			callbacks[0](currentSet, nextCallback);
		};
		var nextCallback = function () {
			index++;
			callbacks[index](currentSet, nextCallback);
		};
		
		// Add a final callback to proceed to the next set
		callbacks[callbacks.length] = function () {
			nextSet();
		}
		nextSet();
	},
	
	/**
	 * Performs a deep copy of a JavaScript object
	 * @param {Object} obj
	 * @return {Object}
	 */
	"deepCopy":function(obj) {
		var obj2 = (obj instanceof Array ? [] : {});
		for(var i in obj) {
			if(typeof obj[i] === "object") {
				obj2[i] = Zotero.Utilities.deepCopy(obj[i]);
			} else {
				obj2[i] = obj[i];
			}
		}
		return obj2;
	},
	
	/**
	 * Tests if an item type exists
	 *
	 * @param {String} type Item type
	 * @type Boolean
	 */
	"itemTypeExists":function(type) {
		if(Zotero.ItemTypes.getID(type)) {
			return true;
		} else {
			return false;
		}
	},
	
	/**
	 * Find valid creator types for a given item type
	 *
	 * @param {String} type Item type
	 * @return {String[]} Creator types
	 */
	"getCreatorsForType":function(type) {
		var types = Zotero.CreatorTypes.getTypesForItemType(Zotero.ItemTypes.getID(type));
		var cleanTypes = new Array();
		for(var i=0; i<types.length; i++) {
			cleanTypes.push(types[i].name);
		}
		return cleanTypes;
	},
	
	/**
	 * Find valid creator types for a given item type
	 *
	 * @param {String} type Item type
	 * @return {String[]} Creator types
	 */
	"fieldIsValidForType":function(field, type) {
		return Zotero.ItemFields.isValidForType(field, Zotero.ItemTypes.getID(type));
	},
	
	/**
	 * Gets a creator type name, localized to the current locale
	 *
	 * @param {String} type Creator type
	 * @param {String} Localized creator type
	 * @type Boolean
	 */
	"getLocalizedCreatorType":function(type) {
		try {
			return Zotero.CreatorTypes.getLocalizedString(type);
		} catch(e) {
			return false;
		}
	},
	
	/**
	 * Escapes metacharacters in a literal so that it may be used in a regular expression
	 */
	"quotemeta":function(literal) {
		if(typeof literal !== "string") {
			throw "Argument "+literal+" must be a string in Zotero.Utilities.quotemeta()";
		}
		const metaRegexp = /[-[\]{}()*+?.\\^$|,#\s]/g;
		return literal.replace(metaRegexp, "\\$&");
	},
	
	/**
	 * Evaluate an XPath
	 *
	 * @param {element|element[]} elements The element(s) to use as the context for the XPath
	 * @param {String} xpath The XPath expression
	 * @param {Object} [namespaces] An object whose keys represent namespace prefixes, and whose
	 *                              values represent their URIs
	 * @return {element[]} DOM elements matching XPath
	 */
	"xpath":function(elements, xpath, namespaces) {
		var nsResolver = null;
		if(namespaces) {
			nsResolver = function(prefix) {
				return namespaces[prefix] || null;
			};
		}
		
		if(!(elements instanceof Array)) elements = [elements];
		
		var results = [];
		for(var i in elements) {
			var element = elements[i];
			// Firefox 5 hack
			if(element.__wrappedDOMObject) element = element.__wrappedDOMObject;
			
			if(element.ownerDocument) {
				var rootDoc = element.ownerDocument;
			} else if(element.documentElement) {
				var rootDoc = element;
			} else {
				throw new Error("First argument must be either element(s) or document(s) in Zotero.Utilities.xpath(elements, '"+xpath+"')");
			}
			
			try {
				var xpathObject = rootDoc.evaluate(xpath, element, nsResolver, 
					(Zotero.isFx
						? Components.interfaces.nsIDOMXPathResult.ORDERED_NODE_ITERATOR_TYPE
						: XPathResult.ORDERED_NODE_ITERATOR_TYPE),
					null);
			} catch(e) {
				// rethrow so that we get a stack
				throw new Error(e.name+": "+e.message);
			}
			
			var newEl;
			while(newEl = xpathObject.iterateNext()) {
				// Firefox 5 hack
				results.push(Zotero.isFx5 ? Zotero.Translate.SandboxManager.Fx5DOMWrapper(newEl) : newEl);
			}
		}
		
		return results;
	},
	
	/**
	 * Generates a string from the content of nodes matching a given XPath
	 *
	 * @param {element} node The node representing the document and context
	 * @param {String} xpath The XPath expression
	 * @param {Object} [namespaces] An object whose keys represent namespace prefixes, and whose
	 *                              values represent their URIs
	 * @param {String} [delimiter] The string with which to join multiple matching nodes
	 * @return {String|null} DOM elements matching XPath, or null if no elements exist
	 */
	"xpathText":function(node, xpath, namespaces, delimiter) {
		var elements = Zotero.Utilities.xpath(node, xpath, namespaces);
		if(!elements.length) return null;
		
		var strings = new Array(elements.length);
		for(var i in elements) {
			strings[i] = elements[i].textContent;
		}
		
		return strings.join(delimiter ? delimiter : ", ");
	}
}

/**
 * @class All functions accessible from within Zotero.Utilities namespace inside sandboxed
 * translators
 *
 * @constructor
 * @augments Zotero.Utilities
 * @borrows Zotero.Date.formatDate as this.formatDate
 * @borrows Zotero.Date.strToDate as this.strToDate
 * @borrows Zotero.Date.strToISO as this.strToISO
 * @borrows Zotero.OpenURL.createContextObject as this.createContextObject
 * @borrows Zotero.OpenURL.parseContextObject as this.parseContextObject
 * @borrows Zotero.HTTP.processDocuments as this.processDocuments
 * @borrows Zotero.HTTP.doPost as this.doPost
 * @param {Zotero.Translate} translate
 */
Zotero.Utilities.Translate = function(translate) {
	this._translate = translate;
}

var tmp = function() {};
tmp.prototype = Zotero.Utilities;
Zotero.Utilities.Translate.prototype = new tmp();
Zotero.Utilities.Translate.prototype.formatDate = Zotero.Date.formatDate;
Zotero.Utilities.Translate.prototype.strToDate = Zotero.Date.strToDate;
Zotero.Utilities.Translate.prototype.strToISO = Zotero.Date.strToISO;
Zotero.Utilities.Translate.prototype.createContextObject = Zotero.OpenURL.createContextObject;
Zotero.Utilities.Translate.prototype.parseContextObject = Zotero.OpenURL.parseContextObject;

/**
 * Gets the current Zotero version
 *
 * @type String
 */
Zotero.Utilities.Translate.prototype.getVersion = function() {
	return Zotero.version;
}

/**
 * Takes an XPath query and returns the results
 *
 * @deprecated Use {@link Zotero.Utilities.xpath} or doc.evaluate() directly
 * @type Node[]
 */
Zotero.Utilities.Translate.prototype.gatherElementsOnXPath = function(doc, parentNode, xpath, nsResolver) {
	var elmts = [];
	
	var iterator = doc.evaluate(xpath, parentNode, nsResolver,
		(Zotero.isFx ? Components.interfaces.nsIDOMXPathResult.ANY_TYPE : XPathResult.ANY_TYPE),
		null);
	var elmt = iterator.iterateNext();
	var i = 0;
	while (elmt) {
		elmts[i++] = elmt;
		elmt = iterator.iterateNext();
	}
	return elmts;
}

/**
 * Gets a given node as a string containing all child nodes
 *
 * @deprecated Use doc.evaluate and the "nodeValue" or "textContent" property
 * @type String
 */
Zotero.Utilities.Translate.prototype.getNodeString = function(doc, contextNode, xpath, nsResolver) {
	var elmts = this.gatherElementsOnXPath(doc, contextNode, xpath, nsResolver);
	var returnVar = "";
	for(var i=0; i<elmts.length; i++) {
		returnVar += elmts[i].nodeValue;
	}
	return returnVar;
}

/**
 * Grabs items based on URLs
 *
 * @param {Document} doc DOM document object
 * @param {Element|Element[]} inHere DOM element(s) to process
 * @param {RegExp} [urlRe] Regexp of URLs to add to list
 * @param {RegExp} [urlRe] Regexp of URLs to reject
 * @return {Object} Associative array of link => textContent pairs, suitable for passing to
 *	Zotero.selectItems from within a translator
 */
Zotero.Utilities.Translate.prototype.getItemArray = function(doc, inHere, urlRe, rejectRe) {
	var availableItems = new Object();	// Technically, associative arrays are objects
	
	// Require link to match this
	if(urlRe) {
		if(urlRe.exec) {
			var urlRegexp = urlRe;
		} else {
			var urlRegexp = new RegExp();
			urlRegexp.compile(urlRe, "i");
		}
	}
	// Do not allow text to match this
	if(rejectRe) {
		if(rejectRe.exec) {
			var rejectRegexp = rejectRe;
		} else {
			var rejectRegexp = new RegExp();
			rejectRegexp.compile(rejectRe, "i");
		}
	}
	
	if(!inHere.length) {
		inHere = new Array(inHere);
	}
	
	for(var j=0; j<inHere.length; j++) {
		var links = inHere[j].getElementsByTagName("a");
		for(var i=0; i<links.length; i++) {
			if(!urlRe || urlRegexp.test(links[i].href)) {
				var text = links[i].textContent;
				if(text) {
					text = this.trimInternal(text);
					if(!rejectRe || !rejectRegexp.test(text)) {
						if(availableItems[links[i].href]) {
							if(text != availableItems[links[i].href]) {
								availableItems[links[i].href] += " "+text;
							}
						} else {
							availableItems[links[i].href] = text;
						}
					}
				}
			}
		}
	}
	
	return availableItems;
}


/**
 * Load a single document in a hidden browser
 *
 * @deprecated Use processDocuments with a single URL
 * @see Zotero.Utilities.Translate#processDocuments
 */
Zotero.Utilities.Translate.prototype.loadDocument = function(url, succeeded, failed) {
	Zotero.debug("Zotero.Utilities.loadDocument is deprecated; please use processDocuments in new code");
	this.processDocuments([url], succeeded, null, failed);
}

/**
 * Already documented in Zotero.HTTP
 * @ignore
 */
Zotero.Utilities.Translate.prototype.processDocuments = function(urls, processor, done, exception) {
	if(typeof(urls) == "string") {
		urls = [this._convertURL(urls)];
	} else {
		for(var i in urls) {
			urls[i] = this._convertURL(urls[i]);
		}
	}
	
	// Unless the translator has proposed some way to handle an error, handle it
	// by throwing a "scraping error" message
	if(!exception) {
		var translate = this._translate;
		var exception = function(e) {
			translate.complete(false, e);
		}
	}
	
	var translate = this._translate;
	translate.incrementAsyncProcesses();
	Zotero.HTTP.processDocuments(urls, processor, function() {
		if(done) done();
		translate.decrementAsyncProcesses();
	}, exception);
}

/**
 * Gets the DOM document object corresponding to the page located at URL, but avoids locking the
 * UI while the request is in process.
 *
 * @param {String} 		url		URL to load
 * @return {Document} 			DOM document object
 */
Zotero.Utilities.Translate.prototype.retrieveDocument = function(url) {
	if(!Zotero.isFx) throw "Zotero.Utilities.retrieveDocument() is unsupported outside of Firefox";
	this._translate._debug("WARNING: Zotero.Utilities.retrieveDocument() is unsupported outside of Firefox", 1);
	
	url = this._convertURL(url);
	
	var mainThread = Zotero.mainThread;
	var loaded = false;
	var listener =  function() {
		loaded = hiddenBrowser.contentDocument.location.href != "about:blank";
	}
	
	var hiddenBrowser = Zotero.Browser.createHiddenBrowser();
	hiddenBrowser.addEventListener("pageshow", listener, true);
	hiddenBrowser.loadURI(url);
	
	// Use a timeout of 2 minutes. Without a timeout, a request to an IP at which no system is
	// configured will continue indefinitely, and hang Firefox as it shuts down. No same request
	// should ever take longer than 2 minutes. 
	var endTime = Date.now() + 120000;
	while(!loaded && Date.now() < endTime) {
		mainThread.processNextEvent(true);
	}
	
	hiddenBrowser.removeEventListener("pageshow", listener, true);
	hiddenBrowser.contentWindow.setTimeout(function() {
		Zotero.Browser.deleteHiddenBrowser(hiddenBrowser);
	}, 1);
	
	if(!loaded) throw "retrieveDocument failed: request timeout";
	return hiddenBrowser.contentDocument;
}

/**
 * Gets the source of the page located at URL, but avoids locking the UI while the request is in
 * process.
 *
 * @param {String} 		url					URL to load
 * @param {String}		[body=null]			Request body to POST to the URL; a GET request is
 *											executed if no body is present
 * @param {Object}		[headers]			HTTP headers to include in request;
 *											Content-Type defaults to application/x-www-form-urlencoded
 *											for POST; ignored if no body
 * @param {String} 		[responseCharset] 	Character set to force on the response
 * @return {String} 						Request body
 */
Zotero.Utilities.Translate.prototype.retrieveSource = function(url, body, headers, responseCharset) {
	this._translate._debug("WARNING: Use of Zotero.Utilities.retrieveSource() is deprecated. "+
		"The main thread will be frozen when Zotero.Utilities.retrieveSource() is called outside "+
		"of Firefox, and cross-domain requests will not work.", 1);
	
	if(Zotero.isFx) {
		/* Apparently, a synchronous XMLHttpRequest would have the behavior of this routine in FF3, but
		 * in FF3.5, synchronous XHR blocks all JavaScript on the thread. See 
		 * http://hacks.mozilla.org/2009/07/synchronous-xhr/. */
		url = this._convertURL(url);
		if(!headers) headers = null;
		if(!responseCharset) responseCharset = null;
		
		var mainThread = Zotero.mainThread;
		var xmlhttp = false;
		var listener = function(aXmlhttp) { xmlhttp = aXmlhttp };
		
		if(body) {
			Zotero.HTTP.doPost(url, body, listener, headers, responseCharset);
		} else {
			Zotero.HTTP.doGet(url, listener, responseCharset);
		}
		
		while(!xmlhttp) mainThread.processNextEvent(true);
	} else {
		// Use a synchronous XMLHttpRequest, even though this is inadvisable
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.open((body ? "POST" : "GET"), url, false);
		xmlhttp.send(body ? body : null);
	}
	
	if(xmlhttp.status >= 400) throw "Zotero.Utilities.retrieveSource() failed: "+xmlhttp.status+" "+xmlhttp.statusText;
	
	return xmlhttp.responseText;
}

/**
* Send an HTTP GET request via XMLHTTPRequest
* 
* @param {String|String[]} urls URL(s) to request
* @param {Function} processor Callback to be executed for each document loaded
* @param {Function} done Callback to be executed after all documents have been loaded
* @param {String} responseCharset Character set to force on the response
* @return {Boolean} True if the request was sent, or false if the browser is offline
*/
Zotero.Utilities.Translate.prototype.doGet = function(urls, processor, done, responseCharset) {
	var callAgain = false;
	
	if(typeof(urls) == "string") {
		var url = urls;
	} else {
		if(urls.length > 1) callAgain = true;
		var url = urls.shift();
	}
	
	url = this._convertURL(url);
	
	var me = this;
	
	this._translate.incrementAsyncProcesses();
	Zotero.HTTP.doGet(url, function(xmlhttp) {
		try {
			if(processor) {
				processor(xmlhttp.responseText, xmlhttp, url);
			}
			
			if(callAgain) {
				me.doGet(urls, processor, done);
			} else {
				if(done) {
					done();
				}
			}
			me._translate.decrementAsyncProcesses();
		} catch(e) {
			me._translate.complete(false, e);
		}
	}, responseCharset);
}

/**
 * Already documented in Zotero.HTTP
 * @ignore
 */
Zotero.Utilities.Translate.prototype.doPost = function(url, body, onDone, headers, responseCharset) {
	url = this._convertURL(url);
	
	var translate = this._translate;
	this._translate.incrementAsyncProcesses();
	Zotero.HTTP.doPost(url, body, function(xmlhttp) {
		try {
			onDone(xmlhttp.responseText, xmlhttp);
			translate.decrementAsyncProcesses();
		} catch(e) {
			translate.complete(false, e);
		}
	}, headers, responseCharset);
}

/**
 * Translate a URL to a form that goes through the appropriate proxy, or convert a relative URL to
 * an absolute one
 *
 * @param {String} url
 * @type String
 * @private
 */
Zotero.Utilities.Translate.prototype._convertURL = function(url) {
	const protocolRe = /^(?:(?:http|https|ftp):)/i;
	
	// convert proxy to proper if applicable
	if(this._translate.translator && this._translate.translator[0]
			&& this._translate.translator[0].properToProxy) {
		url = this._translate.translator[0].properToProxy(url);
	}
	
	if(Zotero.isChrome || Zotero.isSafari) {
		// this code is sandboxed, so we don't worry
		return url;
	} else {
		if(protocolRe.test(url)) return url;
		
		if(uri.indexOf(":") !== -1) {
			// don't allow protocol switches
			throw "Invalid URL supplied for HTTP request";
		}
		
		// resolve relative URIs
		return Components.classes["@mozilla.org/network/io-service;1"].
			getService(Components.interfaces.nsIIOService).
			newURI(this._translate.location, "", null).resolve(url);
	}
}

Zotero.Utilities.Translate.prototype.__exposedProps__ = {"HTTP":"r"};
for(var j in Zotero.Utilities.Translate.prototype) {
	if(typeof Zotero.Utilities.Translate.prototype[j] === "function" && j[0] !== "_" && j != "Translate") {
		Zotero.Utilities.Translate.prototype.__exposedProps__[j] = "r";
	}
}

/**
 * @class Utility functions not made available to translators
 */
Zotero.Utilities.Internal = {
	 /*
	 * Adapted from http://developer.mozilla.org/en/docs/nsICryptoHash
	 *
	 * @param	{String|nsIFile}	strOrFile
	 * @param	{Boolean}			[base64=false]	Return as base-64-encoded string rather than hex string
	 * @return	{String}
	 */
	"md5":function(strOrFile, base64) {
		if (typeof strOrFile == 'string') {
			var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
				createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
			converter.charset = "UTF-8";
			var result = {};
			var data = converter.convertToByteArray(strOrFile, result);
			var ch = Components.classes["@mozilla.org/security/hash;1"]
				.createInstance(Components.interfaces.nsICryptoHash);
			ch.init(ch.MD5);
			ch.update(data, data.length);
		}
		else if (strOrFile instanceof Components.interfaces.nsIFile) {
			// Otherwise throws (NS_ERROR_NOT_AVAILABLE) [nsICryptoHash.updateFromStream]
			if (!strOrFile.fileSize) {
				// MD5 for empty string
				return "d41d8cd98f00b204e9800998ecf8427e";
			}
			
			var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
							.createInstance(Components.interfaces.nsIFileInputStream);
			// open for reading
			istream.init(strOrFile, 0x01, 0444, 0);
			var ch = Components.classes["@mozilla.org/security/hash;1"]
						   .createInstance(Components.interfaces.nsICryptoHash);
			// we want to use the MD5 algorithm
			ch.init(ch.MD5);
			// this tells updateFromStream to read the entire file
			const PR_UINT32_MAX = 0xffffffff;
			ch.updateFromStream(istream, PR_UINT32_MAX);
		}
		
		// pass false here to get binary data back
		var hash = ch.finish(base64);
		
		if (istream) {
			istream.close();
		}
		
		if (base64) {
			return hash;
		}
		
		/*
		// This created 36-character hashes
		
		// return the two-digit hexadecimal code for a byte
		function toHexString(charCode) {
			return ("0" + charCode.toString(16)).slice(-2);
		}
		
		// convert the binary hash data to a hex string.
		return [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
		*/
		
		// From http://rcrowley.org/2007/11/15/md5-in-xulrunner-or-firefox-extensions/
		var ascii = [];
		var ii = hash.length;
		for (var i = 0; i < ii; ++i) {
			var c = hash.charCodeAt(i);
			var ones = c % 16;
			var tens = c >> 4;
			ascii.push(String.fromCharCode(tens + (tens > 9 ? 87 : 48)) + String.fromCharCode(ones + (ones > 9 ? 87 : 48)));
		}
		return ascii.join('');
	}
}

/**
 *  Base64 encode / decode
 *  From http://www.webtoolkit.info/
 */
Zotero.Utilities.Internal.Base64 = {
	 // private property
	 _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
	 
	 // public method for encoding
	 encode : function (input) {
		 var output = "";
		 var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
		 var i = 0;
		 
		 input = this._utf8_encode(input);
		 
		 while (i < input.length) {
			 
			 chr1 = input.charCodeAt(i++);
			 chr2 = input.charCodeAt(i++);
			 chr3 = input.charCodeAt(i++);
			 
			 enc1 = chr1 >> 2;
			 enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
			 enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
			 enc4 = chr3 & 63;
			 
			 if (isNaN(chr2)) {
				 enc3 = enc4 = 64;
			 } else if (isNaN(chr3)) {
				 enc4 = 64;
			 }
			 
			 output = output +
			 this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
			 this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
			 
		 }
		 
		 return output;
	 },
	 
	 // public method for decoding
	 decode : function (input) {
		 var output = "";
		 var chr1, chr2, chr3;
		 var enc1, enc2, enc3, enc4;
		 var i = 0;
		 
		 input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
		 
		 while (i < input.length) {
			 
			 enc1 = this._keyStr.indexOf(input.charAt(i++));
			 enc2 = this._keyStr.indexOf(input.charAt(i++));
			 enc3 = this._keyStr.indexOf(input.charAt(i++));
			 enc4 = this._keyStr.indexOf(input.charAt(i++));
			 
			 chr1 = (enc1 << 2) | (enc2 >> 4);
			 chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			 chr3 = ((enc3 & 3) << 6) | enc4;
			 
			 output = output + String.fromCharCode(chr1);
			 
			 if (enc3 != 64) {
				 output = output + String.fromCharCode(chr2);
			 }
			 if (enc4 != 64) {
				 output = output + String.fromCharCode(chr3);
			 }
			 
		 }
		 
		 output = this._utf8_decode(output);
		 
		 return output;
		 
	 },
	 
	 // private method for UTF-8 encoding
	 _utf8_encode : function (string) {
		 string = string.replace(/\r\n/g,"\n");
		 var utftext = "";
		 
		 for (var n = 0; n < string.length; n++) {
			 
			 var c = string.charCodeAt(n);
			 
			 if (c < 128) {
				 utftext += String.fromCharCode(c);
			 }
			 else if((c > 127) && (c < 2048)) {
				 utftext += String.fromCharCode((c >> 6) | 192);
				 utftext += String.fromCharCode((c & 63) | 128);
			 }
			 else {
				 utftext += String.fromCharCode((c >> 12) | 224);
				 utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				 utftext += String.fromCharCode((c & 63) | 128);
			 }
			 
		 }
		 
		 return utftext;
	 },
	 
	 // private method for UTF-8 decoding
	 _utf8_decode : function (utftext) {
		 var string = "";
		 var i = 0;
		 var c = c1 = c2 = 0;
		 
		 while ( i < utftext.length ) {
			 
			 c = utftext.charCodeAt(i);
			 
			 if (c < 128) {
				 string += String.fromCharCode(c);
				 i++;
			 }
			 else if((c > 191) && (c < 224)) {
				 c2 = utftext.charCodeAt(i+1);
				 string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
				 i += 2;
			 }
			 else {
				 c2 = utftext.charCodeAt(i+1);
				 c3 = utftext.charCodeAt(i+2);
				 string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
				 i += 3;
			 }
			 
		 }
		 
		 return string;
	 }
 }