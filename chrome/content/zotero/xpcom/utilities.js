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
		// If no tags, no need to unescape
		if(str.indexOf("<") === -1 && str.indexOf("&") === -1) return str;
		
		if(Zotero.isFx) {
			if(!Zotero.Utilities._nsISUHTML) {
				Zotero.Utilities._nsISUHTML = Components.classes["@mozilla.org/feed-unescapehtml;1"]
					.getService(Components.interfaces.nsIScriptableUnescapeHTML);
			}
			return Zotero.Utilities._nsISUHTML.unescape(str);
		} else if(Zotero.isNode) {
			/*var doc = require('jsdom').jsdom(str, null, {
				"features":{
					"FetchExternalResources":false,
					"ProcessExternalResources":false,
					"MutationEvents":false,
					"QuerySelector":false
				}
			});
			if(!doc.documentElement) return str;
			return doc.documentElement.textContent;*/
			return Zotero.Utilities.cleanTags(str);
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
			return str.substr(0, len) + '\u2026' + (countChars ? ' (' + str.length + ' chars)' : '');
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
		if(force === false || (!Zotero.Prefs.get('capitalizeTitles') && !force)) return string;
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
	 * Replaces accented characters in a string with ASCII equivalents
	 *
	 * @param {String} str
	 * @param {Boolean} [lowercaseOnly]  Limit conversions to lowercase characters
	 *                                   (for improved performance on lowercase input)
	 * @return {String}
	 *
	 * From http://lehelk.com/2011/05/06/script-to-remove-diacritics/
	 */
	"removeDiacritics": function (str, lowercaseOnly) {
		var map = this._diacriticsRemovalMap.lowercase;
		for (var i=0, len=map.length; i<len; i++) {
			str = str.replace(map[i].letters, map[i].base);
		}
		
		if (!lowercaseOnly) {
			var map = this._diacriticsRemovalMap.uppercase;
			for (var i=0, len=map.length; i<len; i++) {
				str = str.replace(map[i].letters, map[i].base);
			}
		}
		
		return str;
	},
	
	"_diacriticsRemovalMap": {
		uppercase: [
			{'base':'A', 'letters':/[\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F]/g},
			{'base':'AA','letters':/[\uA732]/g},
			{'base':'AE','letters':/[\u00C6\u01FC\u01E2]/g},
			{'base':'AO','letters':/[\uA734]/g},
			{'base':'AU','letters':/[\uA736]/g},
			{'base':'AV','letters':/[\uA738\uA73A]/g},
			{'base':'AY','letters':/[\uA73C]/g},
			{'base':'B', 'letters':/[\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181]/g},
			{'base':'C', 'letters':/[\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E]/g},
			{'base':'D', 'letters':/[\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779]/g},
			{'base':'DZ','letters':/[\u01F1\u01C4]/g},
			{'base':'Dz','letters':/[\u01F2\u01C5]/g},
			{'base':'E', 'letters':/[\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E]/g},
			{'base':'F', 'letters':/[\u0046\u24BB\uFF26\u1E1E\u0191\uA77B]/g},
			{'base':'G', 'letters':/[\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E]/g},
			{'base':'H', 'letters':/[\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D]/g},
			{'base':'I', 'letters':/[\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197]/g},
			{'base':'J', 'letters':/[\u004A\u24BF\uFF2A\u0134\u0248]/g},
			{'base':'K', 'letters':/[\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2]/g},
			{'base':'L', 'letters':/[\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780]/g},
			{'base':'LJ','letters':/[\u01C7]/g},
			{'base':'Lj','letters':/[\u01C8]/g},
			{'base':'M', 'letters':/[\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C]/g},
			{'base':'N', 'letters':/[\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4]/g},
			{'base':'NJ','letters':/[\u01CA]/g},
			{'base':'Nj','letters':/[\u01CB]/g},
			{'base':'O', 'letters':/[\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C]/g},
			{'base':'OI','letters':/[\u01A2]/g},
			{'base':'OO','letters':/[\uA74E]/g},
			{'base':'OU','letters':/[\u0222]/g},
			{'base':'P', 'letters':/[\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754]/g},
			{'base':'Q', 'letters':/[\u0051\u24C6\uFF31\uA756\uA758\u024A]/g},
			{'base':'R', 'letters':/[\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782]/g},
			{'base':'S', 'letters':/[\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784]/g},
			{'base':'T', 'letters':/[\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786]/g},
			{'base':'TZ','letters':/[\uA728]/g},
			{'base':'U', 'letters':/[\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244]/g},
			{'base':'V', 'letters':/[\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245]/g},
			{'base':'VY','letters':/[\uA760]/g},
			{'base':'W', 'letters':/[\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72]/g},
			{'base':'X', 'letters':/[\u0058\u24CD\uFF38\u1E8A\u1E8C]/g},
			{'base':'Y', 'letters':/[\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE]/g},
			{'base':'Z', 'letters':/[\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762]/g},
		],
		
		lowercase: [
			{'base':'a', 'letters':/[\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250]/g},
			{'base':'aa','letters':/[\uA733]/g},
			{'base':'ae','letters':/[\u00E6\u01FD\u01E3]/g},
			{'base':'ao','letters':/[\uA735]/g},
			{'base':'au','letters':/[\uA737]/g},
			{'base':'av','letters':/[\uA739\uA73B]/g},
			{'base':'ay','letters':/[\uA73D]/g},
			{'base':'b', 'letters':/[\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253]/g},
			{'base':'c', 'letters':/[\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184]/g},
			{'base':'d', 'letters':/[\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A]/g},
			{'base':'dz','letters':/[\u01F3\u01C6]/g},
			{'base':'e', 'letters':/[\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD]/g},
			{'base':'f', 'letters':/[\u0066\u24D5\uFF46\u1E1F\u0192\uA77C]/g},
			{'base':'g', 'letters':/[\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F]/g},
			{'base':'h', 'letters':/[\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265]/g},
			{'base':'hv','letters':/[\u0195]/g},
			{'base':'i', 'letters':/[\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131]/g},
			{'base':'j', 'letters':/[\u006A\u24D9\uFF4A\u0135\u01F0\u0249]/g},
			{'base':'k', 'letters':/[\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3]/g},
			{'base':'l', 'letters':/[\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747]/g},
			{'base':'lj','letters':/[\u01C9]/g},
			{'base':'m', 'letters':/[\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F]/g},
			{'base':'n', 'letters':/[\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5]/g},
			{'base':'nj','letters':/[\u01CC]/g},
			{'base':'o', 'letters':/[\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275]/g},
			{'base':'oi','letters':/[\u01A3]/g},
			{'base':'ou','letters':/[\u0223]/g},
			{'base':'oo','letters':/[\uA74F]/g},
			{'base':'p','letters':/[\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755]/g},
			{'base':'q','letters':/[\u0071\u24E0\uFF51\u024B\uA757\uA759]/g},
			{'base':'r','letters':/[\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783]/g},
			{'base':'s','letters':/[\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B]/g},
			{'base':'t','letters':/[\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787]/g},
			{'base':'tz','letters':/[\uA729]/g},
			{'base':'u','letters':/[\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289]/g},
			{'base':'v','letters':/[\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C]/g},
			{'base':'vy','letters':/[\uA761]/g},
			{'base':'w','letters':/[\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73]/g},
			{'base':'x','letters':/[\u0078\u24E7\uFF58\u1E8B\u1E8D]/g},
			{'base':'y','letters':/[\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF]/g},
			{'base':'z','letters':/[\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763]/g}
		]
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
			
			// Firefox 5 hack, so we will preserve Fx5DOMWrappers
			var useFx5DOMWrapper = !!element.__wrappedDOMObject;
			if(useFx5DOMWrapper) element = element.__wrappedDOMObject;
			
			if(element.ownerDocument) {
				var rootDoc = element.ownerDocument;
			} else if(element.documentElement) {
				var rootDoc = element;
			} else {
				throw new Error("First argument must be either element(s) or document(s) in Zotero.Utilities.xpath(elements, '"+xpath+"')");
			}
			
			try {
				var xpathObject = rootDoc.evaluate(xpath, element, nsResolver, 5, // 5 = ORDERED_NODE_ITERATOR_TYPE
					null);
			} catch(e) {
				// rethrow so that we get a stack
				throw new Error(e.name+": "+e.message);
			}
			
			var newEl;
			while(newEl = xpathObject.iterateNext()) {
				// Firefox 5 hack
				results.push(useFx5DOMWrapper ? Zotero.Translate.SandboxManager.Fx5DOMWrapper(newEl) : newEl);
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
	},
	
	/**
	 * Generate a random string of length 'len' (defaults to 8)
	 **/
	"randomString":function(len, chars) {
		if (!chars) {
			chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
		}
		if (!len) {
			len = 8;
		}
		var randomstring = '';
		for (var i=0; i<len; i++) {
			var rnum = Math.floor(Math.random() * chars.length);
			randomstring += chars.substring(rnum,rnum+1);
		}
		return randomstring;
	},
	
	/**
	 * PHP var_dump equivalent for JS
	 *
	 * Adapted from http://binnyva.blogspot.com/2005/10/dump-function-javascript-equivalent-of.html
	 */
	"varDump":function(arr,level) {
		var dumped_text = "";
		if (!level){
			level = 0;
		}
		
		// The padding given at the beginning of the line.
		var level_padding = "";
		for (var j=0;j<level+1;j++){
			level_padding += "    ";
		}
		
		if (typeof(arr) == 'object') { // Array/Hashes/Objects
			for (var item in arr) {
				var value = arr[item];
				
				if (typeof(value) == 'object') { // If it is an array,
					dumped_text += level_padding + "'" + item + "' ...\n";
					dumped_text += arguments.callee(value,level+1);
				}
				else {
					if (typeof value == 'function'){
						dumped_text += level_padding + "'" + item + "' => function(...){...} \n";
					}
					else if (typeof value == 'number') {
						dumped_text += level_padding + "'" + item + "' => " + value + "\n";
					}
					else {
						dumped_text += level_padding + "'" + item + "' => \"" + value + "\"\n";
					}
				}
			}
		}
		else { // Stings/Chars/Numbers etc.
			dumped_text = "===>"+arr+"<===("+typeof(arr)+")";
		}
		return dumped_text;
	},
	
	/**
	 * Adds all fields to an item in toArray() format and adds a unique (base) fields to 
	 * uniqueFields array
	 */
	"itemToExportFormat":function(item) {
		item.uniqueFields = {};
		
		// get base fields, not just the type-specific ones
		var itemTypeID = (item.itemTypeID ? item.itemTypeID : Zotero.ItemTypes.getID(item.itemType));
		var allFields = Zotero.ItemFields.getItemTypeFields(itemTypeID);
		for(var i in allFields) {
			var field = allFields[i];
			var fieldName = Zotero.ItemFields.getName(field);
			
			if(item[fieldName] !== undefined) {
				var baseField = Zotero.ItemFields.getBaseIDFromTypeAndField(itemTypeID, field);
				
				var baseName = null;
				if(baseField && baseField != field) {
					baseName = Zotero.ItemFields.getName(baseField);
				}
				
				if(baseName) {
					item[baseName] = item[fieldName];
					item.uniqueFields[baseName] = item[fieldName];
				} else {
					item.uniqueFields[fieldName] = item[fieldName];
				}
			}
		}
		
		// preserve notes
		if(item.note) item.uniqueFields.note = item.note;
		
		return item;
	},
	
	/**
	 * Converts an item from toArray() format to content=json format used by the server
	 */
	"itemToServerJSON":function(item) {
		var newItem = {};
		
		var typeID = Zotero.ItemTypes.getID(item.itemType);
		if(!typeID) {
			Zotero.debug("Translate: Invalid itemType "+item.itemType+"; saving as webpage");
			item.itemType = "webpage";
			typeID = Zotero.ItemTypes.getID(item.itemType);
		}
		
		var fieldID, itemFieldID;
		for(var field in item) {
			if(field === "complete" || field === "itemID" || field === "attachments"
					|| field === "seeAlso") continue;
			
			var val = item[field];
			
			if(field === "itemType") {
				newItem[field] = val;
			} else if(field === "creators") {
				// normalize creators
				var n = val.length;
				var newCreators = newItem.creators = new Array(n);
				for(var j=0; j<n; j++) {
					var creator = val[j];
					
					// Single-field mode
					if (!creator.firstName || (creator.fieldMode && creator.fieldMode == 1)) {
						var newCreator = {
							name: creator.lastName
						};
					}
					// Two-field mode
					else {
						var newCreator = {
							firstName: creator.firstName,
							lastName: creator.lastName
						};
					}
					
					// ensure creatorType is present and valid
					if(creator.creatorType) {
						if(Zotero.CreatorTypes.getID(creator.creatorType)) {
							newCreator.creatorType = creator.creatorType;
						} else {
							Zotero.debug("Translate: Invalid creator type "+creator.creatorType+"; falling back to author");
						}
					}
					if(!newCreator.creatorType) newCreator.creatorType = "author";
					
					newCreators[j] = newCreator;
				}
			} else if(field === "tags") {
				// normalize tags
				var n = val.length;
				var newTags = newItem.tags = new Array(n);
				for(var j=0; j<n; j++) {
					var tag = val[j];
					if(typeof tag === "object") {
						if(tag.tag) {
							tag = tag.tag;
						} else if(tag.name) {
							tag = tag.name;
						} else {
							Zotero.debug("Translate: Discarded invalid tag");
							continue;
						}
					}
					newTags[j] = {"tag":tag.toString(), "type":1};
				}
			} else if(field === "notes") {
				// normalize notes
				var n = val.length;
				var newNotes = newItem.notes = new Array(n);
				for(var j=0; j<n; j++) {
					var note = val[j];
					if(typeof note === "object") {
						if(!note.note) {
							Zotero.debug("Translate: Discarded invalid note");
							continue;
						}
						note = note.note;
					}
					newNotes[j] = {"itemType":"note", "note":note.toString()};
				}
			} else if((fieldID = Zotero.ItemFields.getID(field))) {
				// if content is not a string, either stringify it or delete it
				if(typeof val !== "string") {
					if(val || val === 0) {
						val = val.toString();
					} else {
						continue;
					}
				}
				
				// map from base field if possible
				if((itemFieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(typeID, fieldID))) {
					newItem[Zotero.ItemFields.getName(itemFieldID)] = val;
					continue;	// already know this is valid
				}
				
				// if field is valid for this type, set field
				if(Zotero.ItemFields.isValidForType(fieldID, typeID)) {
					newItem[field] = val;
				} else {
					Zotero.debug("Translate: Discarded field "+field+": field not valid for type "+item.itemType, 3);
				}
			} else {
				Zotero.debug("Translate: Discarded unknown field "+field, 3);
			}
		}
		
		return newItem;
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
 * Hack to overloads {@link Zotero.Utilities.capitalizeTitle} to allow overriding capitalizeTitles 
 * pref on a per-translate instance basis (for translator testing only)
 */
Zotero.Utilities.Translate.prototype.capitalizeTitle = function(string, force) {
	if(force === undefined) {
		var translate = this._translate;
		do {
			if(translate.capitalizeTitles !== undefined) {
				force = translate.capitalizeTitles;
				break;
			}
		} while(translate = translate._parentTranslator);
	}
	
	return Zotero.Utilities.capitalizeTitle(string, force);
}

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
	var hiddenBrowser = Zotero.HTTP.processDocuments(urls, processor, function() {
		if(done) done();
		translate.decrementAsyncProcesses();
	}, exception, false, translate.cookieSandbox);
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
	if(translate.cookieSandbox) translate.cookieSandbox.attachToBrowser(hiddenBrowser);
	
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
		var finished = false;
		var listener = function() { finished = true };
		
		if(body) {
			var xmlhttp = Zotero.HTTP.doPost(url, body, listener, headers, responseCharset, translate.cookieSandbox);
		} else {
			var xmlhttp = Zotero.HTTP.doGet(url, listener, responseCharset, translate.cookieSandbox);
		}
		
		while(!finished) mainThread.processNextEvent(true);
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
	var xmlhttp = Zotero.HTTP.doGet(url, function(xmlhttp) {
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
	}, responseCharset, this._translate.cookieSandbox);
}

/**
 * Already documented in Zotero.HTTP
 * @ignore
 */
Zotero.Utilities.Translate.prototype.doPost = function(url, body, onDone, headers, responseCharset) {
	url = this._convertURL(url);
	
	var translate = this._translate;
	this._translate.incrementAsyncProcesses();
	var xmlhttp = Zotero.HTTP.doPost(url, body, function(xmlhttp) {
		try {
			onDone(xmlhttp.responseText, xmlhttp);
			translate.decrementAsyncProcesses();
		} catch(e) {
			translate.complete(false, e);
		}
	}, headers, responseCharset, translate.cookieSandbox ? translate.cookieSandbox : undefined);
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
	if(protocolRe.test(url)) {
		if(this._translate.translator && this._translate.translator[0]
				&& this._translate.translator[0].properToProxy) {
			url = this._translate.translator[0].properToProxy(url);
		}
		return url;
	}
	
	// resolve local URL
	var resolved = "";
	if(Zotero.isFx) {
		resolved = Components.classes["@mozilla.org/network/io-service;1"].
			getService(Components.interfaces.nsIIOService).
			newURI(this._translate.location, "", null).resolve(url);
	} else if(Zotero.isChrome || Zotero.isSafari) {
		var a = document.createElement('a');
        a.href = url;
        resolved = a.href;
	} else if(Zotero.isNode) {
		resolved = require('url').resolve(this._translate.location, url);
	}
	
	if(!protocolRe.test(resolved)) {
		throw new Error("Invalid URL supplied for HTTP request: "+url);
	}
	
	return resolved;
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