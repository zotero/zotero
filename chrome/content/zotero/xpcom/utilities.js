/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
	
	Utilities based in part on code taken from Piggy Bank 2.1.1 (BSD-licensed)
	
    ***** END LICENSE BLOCK *****
*/

/**
 * @class Functions for text manipulation and other miscellaneous purposes
 */
Zotero.Utilities = function () {}

/**
 * Cleans extraneous punctuation off a creator name and parse into first and last name
 *
 * @param {String} author Creator string
 * @param {String} type Creator type string (e.g., "author" or "editor")
 * @param {Boolean} useComma Whether the creator string is in inverted (Last, First) format
 * @return {Object} firstName, lastName, and creatorType
 */
Zotero.Utilities.prototype.cleanAuthor = function(author, type, useComma) {
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
}

/**
 * Removes leading and trailing whitespace from a string
 * @type String
 */
Zotero.Utilities.prototype.trim = function(/**String*/ s) {
	if (typeof(s) != "string") {
		Zotero.debug(s);
		throw "trim: argument must be a string";
	}
	
	s = s.replace(/^\s+/, "");
	return s.replace(/\s+$/, "");
}

/**
 * Cleans whitespace off a string and replaces multiple spaces with one
 * @type String
 */
Zotero.Utilities.prototype.trimInternal = function(/**String*/ s) {
	if (typeof(s) != "string") {
		throw "trimInternal: argument must be a string";
	}
	
	s = s.replace(/[\xA0\r\n\s]+/g, " ");
	return this.trim(s);
}

/**
 * Cleans whitespace off a string and replaces multiple spaces with one
 *
 * @deprecated Use trimInternal
 * @see Zotero.Utilities#trimInternal
 * @type String
 */
Zotero.Utilities.prototype.cleanString = function(/**String*/ s) {
	Zotero.debug("cleanString() is deprecated; use trimInternal() instead", 2);
	return this.trimInternal(s);
}

/**
 * Cleans any non-word non-parenthesis characters off the ends of a string
 * @type String
 */
Zotero.Utilities.prototype.superCleanString = function(/**String*/ x) {
	if(typeof(x) != "string") {
		throw "superCleanString: argument must be a string";
	}
	
	var x = x.replace(/^[\x00-\x27\x29-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/, "");
	return x.replace(/[\x00-\x28\x2A-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+$/, "");
}

/**
 * Eliminates HTML tags, replacing &lt;br&gt;s with newlines
 * @type String
 */
Zotero.Utilities.prototype.cleanTags = function(/**String*/ x) {
	if(typeof(x) != "string") {
		throw "cleanTags: argument must be a string";
	}
	
	x = x.replace(/<br[^>]*>/gi, "\n");
	return x.replace(/<[^>]+>/g, "");
}


Zotero.Utilities.prototype.cleanDOI = function(/**String**/ x) {
	if(typeof(x) != "string") {
		throw "cleanDOI: argument must be a string";
	}
	
	return x.match(/10\.[^\s\/]+\/[^\s]+/);
}


Zotero.Utilities.prototype.text2html = function (/**String**/ str, singleNewlineIsParagraph) {
	str = Zotero.Utilities.prototype.htmlSpecialChars(str);
	
	// \n => <p>
	if (singleNewlineIsParagraph) {
		str = '<p>'
				+ str.replace(/\n/g, '</p><p>')
					.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
					.replace(/  /g, '&nbsp;&nbsp;')
			+ '</p>';
	}
	// \n\n => <p>, \n => <br/>
	else {
		str = Zotero.Utilities.prototype.htmlSpecialChars(str);
		str = '<p>'
				+ str.replace(/\n\n/g, '</p><p>')
					.replace(/\n/g, '<br/>')
					.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
					.replace(/  /g, '&nbsp;&nbsp;')
			+ '</p>';
	}
	return str.replace(/<p>\s*<\/p>/g, '<p>&nbsp;</p>');
}


/**
 * Encode special XML/HTML characters<br/>
 * <br/>
 * Certain entities can be inserted manually:<br/>
 * <pre> &lt;ZOTEROBREAK/&gt; =&gt; &lt;br/&gt;
 * &lt;ZOTEROHELLIP/&gt; =&gt; &amp;#8230;</pre>
 * @type String
 */
Zotero.Utilities.prototype.htmlSpecialChars = function(/**String*/ str) {
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
}

/**
 * Decodes HTML entities within a string, returning plain text
 * @type String
 */
Zotero.Utilities.prototype.unescapeHTML = function(/**String*/ str) {
	var nsISUHTML = Components.classes["@mozilla.org/feed-unescapehtml;1"]
		.getService(Components.interfaces.nsIScriptableUnescapeHTML);
	return nsISUHTML.unescape(str);
}


/**
 * Wrap URLs and DOIs in <a href=""> links in plain text
 *
 * Ignore URLs preceded by '>', just in case there are already links
 */
Zotero.Utilities.prototype.autoLink = function (str) {
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
}


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
Zotero.Utilities.prototype.parseMarkup = function(/**String*/ str) {
	var parts = [];
	var splits = str.split(/(<a [^>]+>[^<]*<\/a>)/);
	
	for each(var split in splits) {
		// Link
		if (split.indexOf('<a ') == 0) {
			var matches = split.match(/<a ([^>]+)>([^<]*)<\/a>/);
			if (matches) {
				// Attribute pairs
				var attributes = {};
				var pairs = matches[1].match(/([^ =]+)="([^"]+")/g);
				for each (var pair in pairs) {
					var [key, val] = pair.split(/=/);
					attributes[key] = val.substr(1, val.length - 2);
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
			text: split
		});
	}
	
	return parts;
}

Zotero.Utilities.prototype.min3 = function (a, b, c) {
	var min = a;
	if (b < min) {
		min = b;
	}
	if (c < min) {
		min = c;
	}
	return min;
}


Zotero.Utilities.prototype.levenshtein = function (a, b) {
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
			arr[i][j] = this.min3(arr[i-1][j] + 1, arr[i][j-1] + 1, arr[i-1][j-1] + cost);
		}
	}
	
	return arr[aLen][bLen];
}


/**
 * Test if a string is an integer
 *
 * @deprecated Use isNaN(parseInt(x))
 * @type Boolean
 */
Zotero.Utilities.prototype.isInt = function(x) {
	if(parseInt(x) == x) {
		return true;
	}
	return false;
}



/**
 * Test if an object is empty
 *
 * @param	{Object}
 */
Zotero.Utilities.prototype.isEmpty = function (obj) {
    for (var i in obj) {
        return false;
    }
    return true;
}


/**
 * Compares an array with another and returns an array with
 *	the values from array2 that don't exist in array1
 *
 * @param	{Array}		array1
 * @param	{Array}		array2
 * @param	{Boolean}	useIndex		If true, return an array containing just
 *										the index of array2's elements;
 *										otherwise return the values
 */
Zotero.Utilities.prototype.arrayDiff = function(array1, array2, useIndex) {
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
}


/**
 * Generate a random integer between min and max inclusive
 *
 * @param	{Integer}	min
 * @param	{Integer}	max
 * @return	{Integer}
 */
Zotero.Utilities.prototype.rand = function (min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}


/**
 * Return true according to a given probability
 *
 * @param	{Integer}	x		Will return true every x times on average
 * @return	{Boolean}			On average, TRUE every x times
 *									the function is called
 */
Zotero.Utilities.prototype.probability = function (x) {
	return this.rand(1, x) == this.rand(1, x);
}



/**
 * Determine the necessary data type for SQLite parameter binding
 *
 * @return	int		0 for string, 32 for int32, 64 for int64
 */
Zotero.Utilities.prototype.getSQLDataType = function(value) {
	var strVal = value + '';
	if (strVal.match(/^[1-9]+[0-9]*$/)) {
		// These upper bounds also specified in Zotero.DB
		//
		// Store as 32-bit signed integer
		if (value <= 2147483647) {
			return 32;
		}
		// Store as 64-bit signed integer
		// 2^53 is JS's upper-bound for decimal integers
		else if (value < 9007199254740992) {
			return 64;
		}
	}
	return 0;
}


/*
 * Adapted from http://developer.mozilla.org/en/docs/nsICryptoHash
 *
 * @param	{String|nsIFile}	strOrFile
 * @param	{Boolean}			[base64=false]	Return as base-64-encoded string rather than hex string
 * @return	{String}
 */
Zotero.Utilities.prototype.md5 = function(strOrFile, base64) {
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
	var ascii = []; ii = hash.length;
	for (var i = 0; i < ii; ++i) {
		var c = hash.charCodeAt(i);
		var ones = c % 16;
		var tens = c >> 4;
		ascii.push(String.fromCharCode(tens + (tens > 9 ? 87 : 48)) + String.fromCharCode(ones + (ones > 9 ? 87 : 48)));
	}
	return ascii.join('');
}


/**
 * Parse a page range
 *
 * @param {String} Page range to parse
 * @return {Integer[]} Start and end pages
 */
Zotero.Utilities.prototype.getPageRange = function(pages) {
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
}

/**
 * Pads a number or other string with a given string on the left
 *
 * @param {String} string String to pad
 * @param {String} pad String to use as padding
 * @length {Integer} length Length of new padded string
 * @type String
 */
Zotero.Utilities.prototype.lpad = function(string, pad, length) {
	string = string ? string + '' : '';
	while(string.length < length) {
		string = pad + string;
	}
	return string;
}


/**
 * Shorten and add an ellipsis to a string if necessary
 *
 * @param	{String}	str
 * @param	{Integer}	len
 * @param	{Boolean}	[countChars=false]
 */
Zotero.Utilities.prototype.ellipsize = function (str, len, countChars) {
	if (!len) {
		throw ("Length not specified in Zotero.Utilities.ellipsize()");
	}
	if (str.length > len) {
		return str.substr(0, len) + '...' + (countChars ? ' (' + str.length + ' chars)' : '');
	}
	return str;
}


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
Zotero.Utilities.prototype.numberFormat = function (number, decimals, dec_point, thousands_sep) {
    var n = number, c = isNaN(decimals = Math.abs(decimals)) ? 2 : decimals;
    var d = dec_point == undefined ? "." : dec_point;
    var t = thousands_sep == undefined ? "," : thousands_sep, s = n < 0 ? "-" : "";
    var i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "", j = (j = i.length) > 3 ? j % 3 : 0;
    
    return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
}


/**
 * Tests if an item type exists
 *
 * @param {String} type Item type
 * @type Boolean
 */
Zotero.Utilities.prototype.itemTypeExists = function(type) {
	if(Zotero.ItemTypes.getID(type)) {
		return true;
	} else {
		return false;
	}
}

/**
 * Find valid creator types for a given item type
 *
 * @param {String} type Item type
 * @return {String[]} Creator types
 */
Zotero.Utilities.prototype.getCreatorsForType = function(type) {
	var types = Zotero.CreatorTypes.getTypesForItemType(Zotero.ItemTypes.getID(type));
	var cleanTypes = new Array();
	for each(var type in types) {
		cleanTypes.push(type.name);
	}
	return cleanTypes;
}

/**
 * Gets a creator type name, localized to the current locale
 *
 * @param {String} type Creator type
 * @param {String} Localized creator type
 * @type Boolean
 */
Zotero.Utilities.prototype.getLocalizedCreatorType = function(type) {
	try {
		return Zotero.getString("creatorTypes."+type);
	} catch(e) {
		return false;
	}
}

/**
 * Cleans a title, converting it to title case and replacing " :" with ":"
 *
 * @param {String} string
 * @param {Boolean} force Forces title case conversion, even if the capitalizeTitles pref is off
 * @type String
 */
Zotero.Utilities.prototype.capitalizeTitle = function(string, force) {
	string = this.trimInternal(string);
	if(Zotero.Prefs.get('capitalizeTitles') || force) {
		// fix colons
		string = string.replace(" : ", ": ", "g");
		string = Zotero.Text.titleCase(string.replace(/ : /g, ": "));
	}
	return string;
}


/**
 * Run sets of data through multiple asynchronous callbacks
 *
 * Each callback is passed the current set and a callback to call when done
 *
 * @param	{Object[]}		sets			Sets of data
 * @param	{Function[]}	callbacks
 * @param	{Function}		onDone			Function to call when done
 */
Zotero.Utilities.prototype.processAsync = function (sets, callbacks, onDone) {
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
}


/**
 * @class All functions accessible from within Zotero.Utilities namespace inside sandboxed
 * translators
 *
 * @constructor
 * @augments Zotero.Utilities
 * @borrows Zotero.inArray as this.inArray
 * @borrows Zotero.Date.formatDate as this.formatDate
 * @borrows Zotero.Date.strToDate as this.strToDate
 * @borrows Zotero.Date.strToISO as this.strToISO
 * @borrows Zotero.OpenURL.createContextObject as this.createContextObject
 * @borrows Zotero.OpenURL.parseContextObject as this.parseContextObject
 * @borrows Zotero.Utilities.HTTP.processDocuments as this.processDocuments
 * @borrows Zotero.Utilities.HTTP.doPost as this.doPost
 * @param {Zotero.Translate} translate
 */
Zotero.Utilities.Translate = function(translate) {
	this.translate = translate;
}

Zotero.Utilities.Translate.prototype = new Zotero.Utilities();
Zotero.Utilities.Translate.prototype.inArray = Zotero.inArray;
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
Zotero.Utilities.prototype.getVersion = function() {
	return Zotero.version;
}

/**
 * Takes an XPath query and returns the results
 *
 * @deprecated Use doc.evaluate() directly instead
 * @type Node[]
 */
Zotero.Utilities.Translate.prototype.gatherElementsOnXPath = function(doc, parentNode, xpath, nsResolver) {
	var elmts = [];
	
	var iterator = doc.evaluate(xpath, parentNode, nsResolver, Components.interfaces.nsIDOMXPathResult.ANY_TYPE,null);
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
 * Already documented in Zotero.Utilities.HTTP
 * @ignore
 */
Zotero.Utilities.Translate.prototype.processDocuments = function(urls, processor, done, exception) {
	if(this.translate.locationIsProxied) {
		if(typeof(urls) == "string") {
			urls = [this._convertURL(urls)];
		} else {
			for(var i in urls) {
				urls[i] = this._convertURL(urls[i]);
			}
		}
	}
	
	// Unless the translator has proposed some way to handle an error, handle it
	// by throwing a "scraping error" message
	if(!exception) {
		var translate = this.translate;
		var exception = function(e) {
			translate.error(false, e);
		}
	}
	
	Zotero.Utilities.HTTP.processDocuments(urls, processor, done, exception);
}

/**
 * Gets the DOM document object corresponding to the page located at URL, but avoids locking the
 * UI while the request is in process.
 *
 * @param {String} 		url		URL to load
 * @return {Document} 			DOM document object
 */
Zotero.Utilities.Translate.prototype.retrieveDocument = function(url) {
	if(this.translate.locationIsProxied) url = this._convertURL(url);
	
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
	/* Apparently, a synchronous XMLHttpRequest would have the behavior of this routine in FF3, but
	 * in FF3.5, synchronous XHR blocks all JavaScript on the thread. See 
	 * http://hacks.mozilla.org/2009/07/synchronous-xhr/. */
	if(this.translate.locationIsProxied) url = this._convertURL(url);
	if(!headers) headers = null;
	if(!responseCharset) responseCharset = null;
	
	var mainThread = Zotero.mainThread;
	var xmlhttp = false;
	var listener = function(aXmlhttp) { xmlhttp = aXmlhttp };
	
	if(body) {
		Zotero.Utilities.HTTP.doPost(url, body, listener, headers, responseCharset);
	} else {
		Zotero.Utilities.HTTP.doGet(url, listener, responseCharset);
	}
	
	while(!xmlhttp) mainThread.processNextEvent(true);
	if(xmlhttp.status >= 400) throw "retrieveSource failed: "+xmlhttp.status+" "+xmlhttp.statusText;
	
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
	
	Zotero.Utilities.HTTP.doGet(url, function(xmlhttp) {
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
		} catch(e) {
			me.translate.error(false, e);
		}
	}, responseCharset);
}

/**
 * Already documented in Zotero.Utilities.HTTP
 * @ignore
 */
Zotero.Utilities.Translate.prototype.doPost = function(url, body, onDone, headers, responseCharset) {
	url = this._convertURL(url);
	
	var translate = this.translate;
	Zotero.Utilities.HTTP.doPost(url, body, function(xmlhttp) {
		try {
			onDone(xmlhttp.responseText, xmlhttp);
		} catch(e) {
			translate.error(false, e);
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
	const fileRe = /^[^:]*/;
	
	if(this.translate.locationIsProxied) {
		url = Zotero.Proxies.properToProxy(url);
	}
	if(protocolRe.test(url)) return url;
	if(!fileRe.test(url)) {
		throw "Invalid URL supplied for HTTP request";
	} else {
		return Components.classes["@mozilla.org/network/io-service;1"].
			getService(Components.interfaces.nsIIOService).
			newURI(this.translate.location, "", null).resolve(url);
	}
}

/**
 * Functions for performing HTTP requests, both via XMLHTTPRequest and using a hidden browser
 * @namespace
 */
Zotero.Utilities.HTTP = new function() {
	this.WebDAV = {};
	
	
	/**
	* Send an HTTP GET request via XMLHTTPRequest
	* 
	* @param {nsIURI|String}	url				URL to request
	* @param {Function} 		onDone			Callback to be executed upon request completion
	* @param {String} 		responseCharset	Character set to force on the response
	* @return {Boolean} True if the request was sent, or false if the browser is offline
	*/
	this.doGet = function(url, onDone, responseCharset) {
		if (url instanceof Components.interfaces.nsIURI) {
			// Don't display password in console
			var disp = url.clone();
			if (disp.password) {
				disp.password = "********";
			}
			Zotero.debug("HTTP GET " + disp.spec);
			url = url.spec;
		}
		else {
			Zotero.debug("HTTP GET " + url);
		}
		if (this.browserIsOffline()){
			return false;
		}
		
		// Workaround for "Accept third-party cookies" being off in Firefox 3.0.1
		// https://www.zotero.org/trac/ticket/1070
		if (Zotero.isFx30) {
			const Cc = Components.classes;
			const Ci = Components.interfaces;
			var ds = Cc["@mozilla.org/webshell;1"].
						createInstance(Components.interfaces.nsIDocShellTreeItem).
						QueryInterface(Ci.nsIInterfaceRequestor);
			ds.itemType = Ci.nsIDocShellTreeItem.typeContent;
			var xmlhttp = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
							createInstance(Ci.nsIXMLHttpRequest);
			xmlhttp.mozBackgroundRequest = true;
			xmlhttp.open("GET", url, true);
			xmlhttp.channel.loadGroup = ds.getInterface(Ci.nsILoadGroup);
			xmlhttp.channel.loadFlags |= Ci.nsIChannel.LOAD_DOCUMENT_URI;
		}
		else {
			var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
							.createInstance();
			// Prevent certificate/authentication dialogs from popping up
			xmlhttp.mozBackgroundRequest = true;
			xmlhttp.open('GET', url, true);
			// Send cookie even if "Allow third-party cookies" is disabled (>=Fx3.6 only)
			if (!Zotero.isFx35) {
				var channel = xmlhttp.channel;
				channel.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
				channel.forceAllowThirdPartyCookie = true;
			}
		}
		
		/** @ignore */
		xmlhttp.onreadystatechange = function() {
			_stateChange(xmlhttp, onDone, responseCharset);
		};
		
		xmlhttp.send(null);
		
		return xmlhttp;
	}
	
	/**
	* Send an HTTP POST request via XMLHTTPRequest
	*
	* @param {String} url URL to request
	* @param {String} body Request body
	* @param {Function} onDone Callback to be executed upon request completion
	* @param {String} headers Request HTTP headers
	* @param {String} responseCharset Character set to force on the response
	* @return {Boolean} True if the request was sent, or false if the browser is offline
	*/
	this.doPost = function(url, body, onDone, headers, responseCharset) {
		if (url instanceof Components.interfaces.nsIURI) {
			// Don't display password in console
			var disp = url.clone();
			if (disp.password) {
				disp.password = "********";
			}
			url = url.spec;
		}
		
		var bodyStart = body.substr(0, 1024);
		// Don't display sync password or session id in console
		bodyStart = bodyStart.replace(/password=[^&]+/, 'password=********');
		bodyStart = bodyStart.replace(/sessionid=[^&]+/, 'sessionid=********');
		
		Zotero.debug("HTTP POST "
			+ (body.length > 1024 ?
				bodyStart + '... (' + body.length + ' chars)' : bodyStart)
			+ " to " + (disp ? disp.spec : url));
		
		
		if (this.browserIsOffline()){
			return false;
		}
		
		// Workaround for "Accept third-party cookies" being off in Firefox 3.0.1
		// https://www.zotero.org/trac/ticket/1070
		if (Zotero.isFx30) {
			const Cc = Components.classes;
			const Ci = Components.interfaces;
			var ds = Cc["@mozilla.org/webshell;1"].
						createInstance(Components.interfaces.nsIDocShellTreeItem).
						QueryInterface(Ci.nsIInterfaceRequestor);
			ds.itemType = Ci.nsIDocShellTreeItem.typeContent;
			var xmlhttp = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
							createInstance(Ci.nsIXMLHttpRequest);
			xmlhttp.mozBackgroundRequest = true;
			xmlhttp.open("POST", url, true);
			xmlhttp.channel.loadGroup = ds.getInterface(Ci.nsILoadGroup);
			xmlhttp.channel.loadFlags |= Ci.nsIChannel.LOAD_DOCUMENT_URI;
		}
		else {
			var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
			// Prevent certificate/authentication dialogs from popping up
			xmlhttp.mozBackgroundRequest = true;
			xmlhttp.open('POST', url, true);
			// Send cookie even if "Allow third-party cookies" is disabled (>=Fx3.6 only)
			if (!Zotero.isFx35) {
				var channel = xmlhttp.channel;
				channel.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
				channel.forceAllowThirdPartyCookie = true;
			}
		}
		
		if (headers) {
			if (typeof headers == 'string') {
				var msg = "doPost() now takes a headers object rather than a requestContentType -- update your code";
				Zotero.debug(msg, 2);
				Components.utils.reportError(msg);
				headers = {
					"Content-Type": headers
				};
			}
		}
		else {
			headers = {};
		}
		
		if (!headers["Content-Type"]) {
			headers["Content-Type"] = "application/x-www-form-urlencoded";
		}
		
		for (var header in headers) {
			xmlhttp.setRequestHeader(header, headers[header]);
		}
		
		/** @ignore */
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onDone, responseCharset);
		};
		
		xmlhttp.send(body);
		
		return xmlhttp;
	}
	
	/**
	* Send an HTTP HEAD request via XMLHTTPRequest
	*
	* @param {String} url URL to request
	* @param {Function} onDone Callback to be executed upon request completion
	* @param {Object} requestHeaders HTTP headers to include with request
	* @return {Boolean} True if the request was sent, or false if the browser is offline
	*/
	this.doHead = function(url, onDone, requestHeaders) {
		if (url instanceof Components.interfaces.nsIURI) {
			// Don't display password in console
			var disp = url.clone();
			if (disp.password) {
				disp.password = "********";
			}
			Zotero.debug("HTTP HEAD " + disp.spec);
			url = url.spec;
		}
		else {
			Zotero.debug("HTTP HEAD " + url);
		
		}
		
		if (this.browserIsOffline()){
			return false;
		}
		
		// Workaround for "Accept third-party cookies" being off in Firefox 3.0.1
		// https://www.zotero.org/trac/ticket/1070
		if (Zotero.isFx30) {
			const Cc = Components.classes;
			const Ci = Components.interfaces;
			var ds = Cc["@mozilla.org/webshell;1"].
						createInstance(Components.interfaces.nsIDocShellTreeItem).
						QueryInterface(Ci.nsIInterfaceRequestor);
			ds.itemType = Ci.nsIDocShellTreeItem.typeContent;
			var xmlhttp = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].
							createInstance(Ci.nsIXMLHttpRequest);
			// Prevent certificate/authentication dialogs from popping up
			xmlhttp.mozBackgroundRequest = true;
			xmlhttp.open("HEAD", url, true);
			xmlhttp.channel.loadGroup = ds.getInterface(Ci.nsILoadGroup);
			xmlhttp.channel.loadFlags |= Ci.nsIChannel.LOAD_DOCUMENT_URI;
		}
		else {
			var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
							.createInstance();
			// Prevent certificate/authentication dialogs from popping up
			xmlhttp.mozBackgroundRequest = true;
			xmlhttp.open('HEAD', url, true);
			// Send cookie even if "Allow third-party cookies" is disabled (>=Fx3.6 only)
			if (!Zotero.isFx35) {
				var channel = xmlhttp.channel;
				channel.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
				channel.forceAllowThirdPartyCookie = true;
			}
		}
		
		if (requestHeaders) {
			for (var header in requestHeaders) {
				xmlhttp.setRequestHeader(header, requestHeaders[header]);
			}
		}
		
		// Don't cache HEAD requests
		xmlhttp.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
		
		/** @ignore */
		xmlhttp.onreadystatechange = function(){
			_stateChange(xmlhttp, onDone);
		};
		
		xmlhttp.send(null);
		
		return xmlhttp;
	}
	
	/**
	 * Send an HTTP OPTIONS request via XMLHTTPRequest
	 *
	 * @param	{nsIURI}		url
	 * @param	{Function}	onDone
	 * @return	{XMLHTTPRequest}
	 */
	this.doOptions = function (uri, callback) {
		// Don't display password in console
		var disp = uri.clone();
		if (disp.password) {
			disp.password = "********";
		}
		Zotero.debug("HTTP OPTIONS for " + disp.spec);
		
		if (Zotero.Utilities.HTTP.browserIsOffline()){
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open('OPTIONS', uri.spec, true);
		/** @ignore */
		xmlhttp.onreadystatechange = function() {
			_stateChange(xmlhttp, callback);
		};
		xmlhttp.send(null);
		return xmlhttp;
	}
	
	//
	// WebDAV methods
	//
	
	/**
	* Send a WebDAV PROP* request via XMLHTTPRequest
	*
	* Returns false if browser is offline
	*
	* @param		{String}		method			PROPFIND or PROPPATCH
	* @param		{nsIURI}		uri
	* @param		{String}		body				XML string
	* @param		{Function}	callback
	* @param		{Object}		requestHeaders	e.g. { Depth: 0 }
	*/
	this.WebDAV.doProp = function (method, uri, body, callback, requestHeaders) {
		switch (method) {
			case 'PROPFIND':
			case 'PROPPATCH':
				break;
			
			default:
				throw ("Invalid method '" + method
					+ "' in Zotero.Utilities.HTTP.doProp");
		}
		
		if (requestHeaders && requestHeaders.depth != undefined) {
			var depth = requestHeaders.depth;
		}
		
		// Don't display password in console
		var disp = uri.clone();
		if (disp.password) {
			disp.password = "********";
		}
		
		var bodyStart = body.substr(0, 1024);
		Zotero.debug("HTTP " + method + " "
			+ (depth != undefined ? "(depth " + depth + ") " : "")
			+ (body.length > 1024 ?
				bodyStart + "... (" + body.length + " chars)" : bodyStart)
			+ " to " + disp.spec);
		
		if (Zotero.Utilities.HTTP.browserIsOffline()) {
			Zotero.debug("Browser is offline", 2);
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open(method, uri.spec, true);
		
		if (requestHeaders) {
			for (var header in requestHeaders) {
				xmlhttp.setRequestHeader(header, requestHeaders[header]);
			}
		}
		
		xmlhttp.setRequestHeader("Content-Type", 'text/xml; charset="utf-8"');
		
		xmlhttp.onreadystatechange = function() {
			_stateChange(xmlhttp, callback);
		};
		
		xmlhttp.send(body);
		return xmlhttp;
	}
	
	
	/**
	 * Send a WebDAV MKCOL request via XMLHTTPRequest
	 *
	 * @param	{nsIURI}		url
	 * @param	{Function}	onDone
	 * @return	{XMLHTTPRequest}
	 */
	this.WebDAV.doMkCol = function (uri, callback) {
		// Don't display password in console
		var disp = uri.clone();
		if (disp.password) {
			disp.password = "********";
		}
		Zotero.debug("HTTP MKCOL " + disp.spec);
		
		if (Zotero.Utilities.HTTP.browserIsOffline()) {
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open('MKCOL', uri.spec, true);
		xmlhttp.onreadystatechange = function() {
			_stateChange(xmlhttp, callback);
		};
		xmlhttp.send(null);
		return xmlhttp;
	}
	
	
	/**
	 * Send a WebDAV PUT request via XMLHTTPRequest
	 *
	 * @param	{nsIURI}		url
	 * @param	{String}		body			String body to PUT
	 * @param	{Function}	onDone
	 * @return	{XMLHTTPRequest}
	 */
	this.WebDAV.doPut = function (uri, body, callback) {
		// Don't display password in console
		var disp = uri.clone();
		if (disp.password) {
			disp.password = "********";
		}
		
		var bodyStart = "'" + body.substr(0, 1024) + "'";
		Zotero.debug("HTTP PUT "
			+ (body.length > 1024 ?
				bodyStart + "... (" + body.length + " chars)" : bodyStart)
			+ " to " + disp.spec);
		
		if (Zotero.Utilities.HTTP.browserIsOffline()) {
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open("PUT", uri.spec, true);
		// Some servers (e.g., Jungle Disk DAV) return a 200 response code
		// with Content-Length: 0, which triggers a "no element found" error
		// in Firefox, so we override to text
		xmlhttp.overrideMimeType("text/plain");
		xmlhttp.onreadystatechange = function() {
			_stateChange(xmlhttp, callback);
		};
		xmlhttp.send(body);
		return xmlhttp;
	}
	
	
	/**
	 * Send a WebDAV PUT request via XMLHTTPRequest
	 *
	 * @param	{nsIURI}		url
	 * @param	{Function}	onDone
	 * @return	{XMLHTTPRequest}
	 */
	this.WebDAV.doDelete = function (uri, callback) {
		// Don't display password in console
		var disp = uri.clone();
		if (disp.password) {
			disp.password = "********";
		}
		
		Zotero.debug("WebDAV DELETE to " + disp.spec);
		
		if (Zotero.Utilities.HTTP.browserIsOffline()) {
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open("DELETE", uri.spec, true);
		// Firefox 3 throws a "no element found" error even with a
		// 204 ("No Content") response, so we override to text
		xmlhttp.overrideMimeType("text/plain");
		xmlhttp.onreadystatechange = function() {
			_stateChange(xmlhttp, callback);
		};
		xmlhttp.send(null);
		return xmlhttp;
	}
	
	
	/**
	 * Get the Authorization header used by a channel
	 *
	 * As of Firefox 3.0.1 subsequent requests to higher-level directories
	 * seem not to authenticate properly and just return 401s, so this
	 * can be used to manually include the Authorization header in a request
	 *
	 * It can also be used to check whether a request was forced to
	 * use authentication
	 *
	 * @param	{nsIChannel}		channel
	 * @return	{String|FALSE}				Authorization header, or FALSE if none
	 */
	this.getChannelAuthorization = function (channel) {
		try {
			channel.QueryInterface(Components.interfaces.nsIHttpChannel);
			var authHeader = channel.getRequestHeader("Authorization");
			return authHeader;
		}
		catch (e) {
			Zotero.debug(e);
			return false;
		}
	}
	
	
	/**
	 * Checks if the browser is currently in "Offline" mode
	 *
	 * @type Boolean
	 */
	this.browserIsOffline = function() { 
		return Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService).offline;
	}
	
	/**
	 * Load one or more documents in a hidden browser
	 *
	 * @param {String|String[]} urls URL(s) of documents to load
	 * @param {Function} processor Callback to be executed for each document loaded
	 * @param {Function} done Callback to be executed after all documents have been loaded
	 * @param {Function} exception Callback to be executed if an exception occurs
	 */
	this.processDocuments = function(urls, processor, done, exception) {
		/**
		 * Removes event listener for the load event and deletes the hidden browser
		 */
		var removeListeners = function() {
			hiddenBrowser.removeEventListener(loadEvent, onLoad, true);
			Zotero.Browser.deleteHiddenBrowser(hiddenBrowser);
		}
		
		/**
		 * Loads the next page
		 * @inner
		 */
		var doLoad = function() {
			if(urls.length) {
				var url = urls.shift();
				try {
					Zotero.debug("loading "+url);
					hiddenBrowser.loadURI(url);
				} catch(e) {
					removeListeners();
					if(exception) {
						exception(e);
						return;
					} else {
						throw(e);
					}
				}
			} else {
				removeListeners();
				if(done) done();
			}
		};
		
		/**
		 * Callback to be executed when a page load completes
		 * @inner
		 */
		var onLoad = function() {
			if(hiddenBrowser.contentDocument.location.href == "about:blank") return;
			Zotero.debug(hiddenBrowser.contentDocument.location.href+" has been loaded");
			if(hiddenBrowser.contentDocument.location.href != prevUrl) {	// Just in case it fires too many times
				prevUrl = hiddenBrowser.contentDocument.location.href;
				try {
					processor(hiddenBrowser.contentDocument);
				} catch(e) {
					removeListeners();
					if(exception) {
						exception(e);
						return;
					} else {
						throw(e);
					}
				}
				doLoad();
			}
		};
		
		if(typeof(urls) == "string") urls = [urls];
		
		var prevUrl;
		var loadEvent = Zotero.isFx2 ? "load" : "pageshow";
		
		var hiddenBrowser = Zotero.Browser.createHiddenBrowser();
		hiddenBrowser.addEventListener(loadEvent, onLoad, true);
		
		doLoad();
	}
	
	/**
	 * Handler for XMLHttpRequest state change
	 *
	 * @param {nsIXMLHttpRequest} XMLHttpRequest whose state just changed
	 * @param {Function} [onDone] Callback for request completion
	 * @param {String} [responseCharset] Character set to force on the response
	 * @private
	 */
	function _stateChange(xmlhttp, callback, responseCharset, data) {
		switch (xmlhttp.readyState){
			// Request not yet made
			case 1:
				break;
			
			case 2:
				break;
			
			// Called multiple times while downloading in progress
			case 3:
				break;
			
			// Download complete
			case 4:
				if (callback) {
					// Override the content charset
					if (responseCharset) {
						xmlhttp.channel.contentCharset = responseCharset;
					}
					callback(xmlhttp, data);
				}
			break;
		}
	}
}

/**
 * @namespace
 */
// This would probably be better as a separate XPCOM service
Zotero.Utilities.AutoComplete = new function() {
	this.getResultComment = function (textbox){
		var controller = textbox.controller;
		
		for (var i=0; i<controller.matchCount; i++)
		{
			if (controller.getValueAt(i) == textbox.value)
			{
				return controller.getCommentAt(i);
			}
		}
		return false;
	}
}


/**
 *  Base64 encode / decode
 *  From http://www.webtoolkit.info/
 */
Zotero.Utilities.Base64 = {
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