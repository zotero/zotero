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

/**
 * Constructor for EndNote converter
 * @constructor
 **/
Zotero.ENConverter = function(styleData, date, fileTitle) {
	this.data = styleData;
	if(date) this.date = date;
	if(fileTitle) this.fileTitle = fileTitle;
	
	var formatCode = this.data.substr(8, 8);
	if(formatCode != "RSFTSTYL" && formatCode != "ENDNENFT") {
		throw "Zotero.ENConverter: File not recognized. Is this a style file?";
	}
}

/**
 * Mappings for item types
 *
 * Those in lower case are not in the mapping list because they are implemented
 * elsewhere in the code.
 * Those in upper case are not implemented.
 **/
Zotero.ENConverter.typeMappings = {
	"\x00":"article-journal",
	"\x01":"book",
	"\x02":"thesis",
//	\x03 - CONFERENCE PROCEEDINGS
	"\x04":"personal_communication",
	"\x05":"article-newspaper",
//	\x06 - PROGRAM
	"\x07":"chapter",
	"\x08":"article-magazine",
//	\x09 - Edited Book
	"\x0A":"report",
	"\x0B":"map",
//	\x0C - AUDIOVISUAL MATERIAL
	"\x0D":"graphic",
//	\x0E - UNUSED 1
	"\x0F":"patent",
	"\x10":"webpage",
	"\x11":"bill",
	"\x12":"legal_case",
//	\x13 - HEARING
	"\x14":"manuscript",
	"\x15":"motion_picture",
//	\x16 - STATUTE
//	\x17 - UNUSED 2
//	\x18 - UNUSED 3
	"\x19":"figure",
//	\x1A - CHART OR TABLE
//	\x1B - EQUATION
//	\x1C - Electronic Article
//	\x1D - Electronic Book
//	\x1E - ONLINE DATABASE
//	\x1F - Generic
//	\x20 - GOVERNMENT DOCUMENT
	"\x21":"paper-conference",
//	\x22 - ONLINE MULTIMEDIA
//	\x23 - CLASSICAL WORK
	"\x24":"legislation",
//	\x25 - UNPUBLISHED WORK
//	\x26 - ANCIENT TEXT
	"\x27":"entry-dictionary",
	"\x28":"entry-encyclopedia"
//	\x29 - GRANT
};

/**
 * List of CSL fallback types
 **/
Zotero.ENConverter.fallbackTypes = {
	"book":true,
	"chapter":true,
	"article":true
}

/**
 * List of types that we should parse, but not map directly
 **/
Zotero.ENConverter.supplementalTypes = {
	"\x09":true,	// Edited Book (use conditional on book)
	"\x1C":true,	// Electronic Article (use conditional on article)
	"\x1D":true,	// Electronic Book (use conditional on book)
	"\x1F":true		// Generic (use for all unspecified types)
};

/**
 * Mappings for text variables
 *
 * Those in lower case are not in the mapping list because they are implemented
 * elsewhere in the code.
 * Those in upper case are not implemented.
 **/
Zotero.ENConverter.variableMappings = {
//	\x01 - TYPE OF REFERENCE
//	\x02 - Author/Editor
//	\x03 - Year
	"\x05":"page",
//	\x06 - Secondary/Series/Publication Title/Bill Code
	"\x07":"volume",
	"\x08":"issue",
	"\x09":"number-of-volumes",
//	\x0A - Secondary/Series Author
	"\x0B":"publisher-place",
	"\x0C":"publisher",
//	\x0D - Translator/Subsidiary Author
//	\x0F - KEYWORD
	"\x10":"genre",
//	\x11 - Date
	"\x12":"abstract",
	"\x13":"citation-label",
	"\x14":"URL",
//	\x15 - TERTIARY TITLE
//	\x16 - TERTIARY AUTHOR
	"\x17":"note",
	"\x18":"ISBN",
//	\x19 - CUSTOM 1
//	\x1A - CUSTOM 2
//	\x1B - CUSTOM 3
//	\x1C - CUSTOM 4
//	\x1D - ABBREVIATION
//	\x1E - ACCESSION NUMBER
//	\x1F - CALL NUMBER
//	\x21 - CUSTOM 5
//	\x22 - CUSTOM 6
//	\x23 - SECTION/PAGES CITED/Chapter Title
//	\x24 - ORIGINAL PUBLICATION
//	\x25 - REPRINT EDITION
//	\x26 - REVIEWED ITEM
//	\x27 - AUTHOR ADDRESS
//	\x28 - IMAGE
//	\x29 - CAPTION
//	\x2A - CUSTOM 7
//	\x2B - ELECTRONIC RESOURCE NUMBER
//	\x2C - LINK TO PDF
//	\x2D - TRANSLATED AUTHOR
//	\x2E - TRANSLATED TITLE
//	\x2F - NAME OF DATABASE
//	\x30 - DATABASE PROVIDER
//	\x31 - RESEARCH NOTES
//	\x32 - LANGUAGE
//	\x33 - accessed
//	\x34 - LAST MODIFIED
//	\x00\x40 - citation
	"\x01\x40":"citation-number",
//	\x02\x40 - RECORD NUMBER
	"\x06\x40":"locator"
}

/**
 * List of types that we should map to macros.
 **/
Zotero.ENConverter.macroVariables = {
	"\x02":["author-citation", "author-bibliography"],	// Author
	"\x03":["year-citation", "year-bibliography"],		// Year
	"\x04":["title-citation", "title-bibliography"],	// Title/Book Title
	"\x06":"secondary_title",							// Series/Publication Title
	"\x0A":["secondary_author-citation", "secondary_author-bibliography"],	// Editor/Series Editor
	"\x0D":["translator-citation", "translator-bibliography"],	// Translator
	"\x0E":"edition",									// Edition
	"\x11":"date",										// Date
	"\x15":"tertiary_title",
	"\x16":["tertiary_author-citation", "tertiary_author-bibliography"],	// Chapter Series Editor
	"\x20":"short-title",								// Short Title/Short Book Title
	"\x23":"chapter_title",								// Chapter Title
	"\x33":"accessed",
	"\x00\x40":"citation"								// Citation
};

/**
 * List of types where \x06 maps to collection-title (rather than
 * container-title)
 **/
Zotero.ENConverter.seriesTypes = "book report map motion_picture";
Zotero.ENConverter.seriesCodes = ["\x01", "\x09", "\x0A", "\x0B", "\x15", "\x1D"];

/**
 * Generates the <info> element for the style
 **/
Zotero.ENConverter.prototype.parseInfo = function() {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var guid = "";
	for(var i=0; i<16; i++) {
		var bite = Math.floor(Math.random() * 255);
		
		if(i == 4 || i == 6 || i == 8 || i == 10) {
			guid += "-";
			
			// version
			if(i == 6) bite = bite & 0x0f | 0x40;
			// variant
			if(i == 8) bite = bite & 0x3f | 0x80;
		}
		var str = bite.toString(16);
		guid += str.length == 1 ? '0' + str : str;
	}
	
	this.xml.info.id = "urn:uuid:"+guid;
	if(this.fileTitle) {
		var title = this.fileTitle;
	} else {
		var title = this.convertFromUTF16(this.findField(this.fields, "\x10")[0].data.replace("\xFB", "", "g"));
		if(!title) title = "Untitled Style";
	}
	this.xml.info.title = title;
	
	if(this.date) {
		var date = this.date;
	} else {
		var date = new Date();
	}
	
	var y = date.getFullYear().toString();
	var m = (date.getUTCMonth()+1).toString();
	var d = date.getUTCDay().toString();
	var h = date.getUTCHours().toString();
	var n = date.getUTCMinutes().toString();
	var s = date.getUTCSeconds().toString();
	if(m.length == 1) m = "0"+m;
	if(d.length == 1) d = "0"+d;
	if(h.length == 1) h = "0"+h;
	if(n.length == 1) n = "0"+n;
	if(s.length == 1) s = "0"+s;
	this.xml.info.updated = y+"-"+m+"-"+d+"T"+h+":"+n+":"+s+"+00:00";
}

/**
 * Converts a little endian binary representation of an integer into a JS integer
 *
 * @param {String} binaryData The binary representation of the integer
 * @returns The JS integer
 * @type Integer
 **/
Zotero.ENConverter.prototype.parseInt = function(binaryData) {
	if(binaryData.length == 4) {
		// since this is so common, avoid overhead
		return binaryData.charCodeAt(0)+binaryData.charCodeAt(1)*0x100
			+binaryData.charCodeAt(2)*0x10000+binaryData.charCodeAt(3)*0x1000000;
	} else {
		var integer = 0;
		for(var i=0; i<binaryData.length; i++) {
			integer += binaryData.charCodeAt(i)*Math.pow(0x100, i);
		}
		return integer;
	}
}

/**
 * Parses a commonly used string format found in these EndNote files, which
 * is padded by 8 bytes at the beginning and contains an \xFB\xFB
 *
 * @param {String} string The unparsed string
 * @param {Boolean} richOutput Whether to return XML <text> tags instead of
 *                             plain text
 *
 * @returns Plain text, or the XML representation as <text> tags, depending on
 *          the richOutput parameter
 **/
Zotero.ENConverter.prototype.parseFormattedString = function(string, richOutput) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var stringLength = this.parseInt(string.substr(4, 4))-8;
	if(stringLength == 0) return richOutput ? false : "";
	
	var newString = this.convertFromUTF16(string.substr(8, stringLength));
	
	// strip out chars that shouldn't be there
	newString = newString.replace(/[\x00-\x08\x0E-\x1F]/g, "");
	
	if(richOutput) {
		var formattedXML = new XML();
		var lastOffset = 0;
		var style = false;
		
		var i = stringLength + 8;
		while(i < string.length) {
			var length = this.parseInt(string.substr(i+4, 4));
			var data = string.substr(i+8, length-8);
			if(length == 0) break;
			var startOffset = this.parseInt(data.substr(4, 4));
			
			// add term containing text from last element to new element
			var text = newString.substring(lastOffset, startOffset);
			if(lastOffset != startOffset) {
				var textElement = <text value={text}/>;
				if(style) this.applyFormattingAttributes(textElement, style);
				formattedXML += textElement;
			}
			
			var style = data.substr(data.indexOf("&")+4, 4);
			lastOffset = startOffset;
			
			i += length + length % 4;
		}
		
		if(lastOffset != newString.length) {
			var text = newString.substring(lastOffset);
			var textElement = <text value={text}/>;
			if(style) this.applyFormattingAttributes(textElement, style);
			formattedXML += textElement;
		}
		
		return formattedXML;
	} else {
		return newString;
	}
}


/**
 * Applies the formatting attributes specified by a binary string to a given
 * text element
 *
 * @param {XML} element The element to which the formatting attributes will be
 *                      applied
 * @param {String} formatCode The binary format string
 **/
Zotero.ENConverter.prototype.applyFormattingAttributes = function(element, formatCode) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	if(!formatCode) return;
	
	var binaryDigits = this.parseInt(formatCode).toString(2);
	// pad to 7 digits
	while(binaryDigits.length < 7) binaryDigits = "0"+binaryDigits;
	
	if(binaryDigits[6] == "1") {			// italics
		element["@font-weight"] = "bold";
	}
	if(binaryDigits[5] == "1") {			// bold
		element["@font-style"] = "italic";
	}
	if(binaryDigits[4] == "1") {			// underline
		element["@text-decoration"] = "underline";
	}
	// what are bits 3 and 2?
	if(binaryDigits[1] == "1") {			// subscript
		element["@vertical-align"] = "sup";
	} else if(binaryDigits[0] == "1") {	// superscript
		element["@vertical-align"] = "sub";
	}
}

/**
 * Parses format to create a hierarchical data structure
 *
 * @param {String} styleData The EndNote style file, as binary data
 * @returns An array of objects representing the structure of the EndNote file
 * @type Array
 **/
Zotero.ENConverter.prototype.parseFormat = function(styleData) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var fields = [];
	
	var offset1 = styleData.indexOf("\x10");
	var offset2 = styleData.indexOf("\x11");
	if(offset1 != -1 && (offset2 == -1 || offset1 < offset2)) {		// \x10 comes first
		var offset = offset1;
	} else if(offset2 != -1) {						// \x11 comes first
		var offset = offset2;
	} else {										// both must be -1; no tags here
		return [styleData.replace("\xFB", "", "g")];
	}
	// want to start with tag before
	offset--;
	// for the \x10\x10 case
	if(offset === -1) offset = 0;
	
	if(offset !== 0) {
		fields.push(styleData.substr(0, offset).replace("\xFB", "", "g"));
	}
	
	while(offset < styleData.length) {
		if((styleData[offset] == "\x10" || styleData[offset] == "\x11" || styleData[offset] == "\x12")
				&& styleData[offset+1] == "\x00" && styleData[offset+2] == "\x03") {
			// 10 00 02 style short tag (use unknown)
			
			fields.push({dle:styleData[offset],
				type:"\x00",
				flags:styleData[offset+3],
				data:styleData.substr(offset+4, 4)});
				
			offset += 8;
		} else if(styleData[offset+2] == "\x01" || styleData[offset+2] == "\x02") {
			// standard data-bearing tag
			
			// size is little endian
			var size = this.parseInt(styleData.substr(offset+4, 4));
			size += size % 4;
			
			// set field data
			var field = {code:styleData[offset],
				dle:styleData[offset+1],
				type:styleData[offset+2],
				flags:styleData[offset+3],
				size:size,
				data:styleData.substr(offset+8, size-8)};
			field.subfields = this.parseFormat(field.data);
			fields.push(field);
			
			offset += size;
		} else if(styleData[offset+2] == "\x03" || styleData[offset+2] == "\x00") {
			// 10 03 style short tag (use unknown)
			
			fields.push({code:styleData[offset],
				dle:styleData[offset+1],
				type:"\x03",
				flags:styleData[offset+3],
				data:styleData.substr(offset+4, 4)});
				
			offset += 8;
		} else if(styleData[offset+1] != "\x10" && styleData[offset+1] != "\x11") {
			// unknown tag; error out
			throw("Zotero.ENConverter: Unexpected end of file at "+offset.toString(16)+"; "+varDump(styleData.substr(offset, offset+4)));
		}
	}
	
	return fields;
}

/**
 * Finds all instances of a given field at a given level of the hierarchy
 * @param {Array} fields The array of fields
 * @param {String} code The field code
 **/
Zotero.ENConverter.prototype.findField = function(fields, code) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var output = [];
	
	while(code.length) {
		if(typeof code != "object") {
			var searchCode = code;
			code = [];
		} else {
			var searchCode = code.shift();
		}
		
		for(var i=0; i<fields.length; i++) {
			if(fields[i].code && fields[i].code == searchCode) {
				if(!code.length) {
					output.push(fields[i]);
				} else {
					fields = fields[i].subfields;
					break;
				}
			}
		}
	}
	
	return output;
}

/**
 * Parses various options pertaining to a name to generate a <names/> tag
 *
 * @param {Object} options A binary field object
 * @returns A <names/> tag
 * @type XML
 **/
Zotero.ENConverter.prototype.parseName = function(options) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var authorXML = <name/>;
	
	// "Author Lists" preferences
	var delimiterOptions = this.findField(options.subfields, ["t", "x"]);
	if(this.parseInt(this.findField(delimiterOptions[0].subfields, ["z"])[0].data) == 2) {
		// this probably means delimiter-precedes-last shouldn't be set, because
		// this is probably configured such that, from 1-2, we use no delimiter
		// before the last, but for all other numbers of authors we do
		var delimiter = this.parseFormattedString(this.findField(delimiterOptions[1].subfields, "{")[0].data);
		var lastDelimiter = this.parseFormattedString(this.findField(delimiterOptions[1].subfields, "|")[0].data);
	} else {
		var delimiter = this.parseFormattedString(this.findField(delimiterOptions[0].subfields, "{")[0].data);
		var lastDelimiter = this.parseFormattedString(this.findField(delimiterOptions[0].subfields, "|")[0].data);
		// delimiter-precedes-last should probably be "always" or "never"
		// ignore second set of list separator options
		if(lastDelimiter.length >= delimiter.length
				&& lastDelimiter.substr(0, delimiter.length) == delimiter) {
			// there is a delimiter preceding the last
			authorXML["@delimiter-precedes-last"] = "always";
		} else {
			// there is no delimiter
			authorXML["@delimiter-precedes-last"] = "never";
		}
	}
	if(delimiter !== "") authorXML["@delimiter"] = delimiter;
	// TODO: alter locale "and" if neither text nor symbol
	if(lastDelimiter.indexOf("and") !== -1) {
		// text and
		authorXML["@and"] = "text";
	} else if(lastDelimiter.indexOf("&") !== -1) {
		// symbol and
		authorXML["@and"] = "symbol";
	}
	
	// "Author Name" preferences
	var firstAuthorPref = this.findField(options.subfields, "q")[0].data[0];
	var subsequentAuthorPref = this.findField(options.subfields, "r")[0].data[0];
	if(firstAuthorPref != "\x00") {
		if(subsequentAuthorPref != "\x00") {
			authorXML["@name-as-sort-order"] = "all";
		} else {
			authorXML["@name-as-sort-order"] = "first";
		}
	}
	if(firstAuthorPref == "\x01") {
		authorXML["@sort-separator"] = ", ";
	} else if(firstAuthorPref == "\x02") {
		authorXML["@sort-separator"] = " ";
	}
	
	var capitalizationPref = this.findField(options.subfields, "s")[0].data[0];
	if(capitalizationPref == "\x02") {
		authorXML["@text-case"] = "uppercase";
	} else if(capitalizationPref == "\x03") {
		authorXML["@font-variant"] = "small-caps";
	}
	
	var initialPref = this.findField(options.subfields, "p")[0].data[0];
	if(initialPref == "\x01") {			// B. C.
		authorXML["@initialize-with"] = ". ";
	} else if(initialPref == "\x02") {	// B.C.
		authorXML["@initialize-with"] = ".";
	} else if(initialPref == "\x03") {	// B C
		authorXML["@initialize-with"] = " ";
	} else if(initialPref == "\x04") {	// BC
		authorXML["@initialize-with"] = "";
	} else if(initialPref == "\x05") {	// just last name
		authorXML["@form"] = "short";
	}
	
	return authorXML;
}

/**
 * Parses options pertaining to subsequent author handling
 *
 * @param {Object} etAlOptions A binary field object
 * @param {XML} context The CSL context (<bibliography> or <citation> tag)
 * @param {Boolean} subsequent Whether this set of fields controls the behavior
 *                             of subsequent references.
 **/
Zotero.ENConverter.prototype.parseEtAl = function(etAlOptions, context, subsequent) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	if(this.findField(etAlOptions.subfields, "}")[0].data[0] == "\x01") {
		// if author list abbreviation is on
		
		// et-al-min
		var value = this.parseInt(this.findField(etAlOptions.subfields, "~")[0].data);
		var optionName = subsequent ? "et-al-subsequent-min" : "et-al-min";
		context.prependChild(<option name={optionName} value={value}/>);
		// et-al-use-first
		var value = this.parseInt(this.findField(etAlOptions.subfields, "\x7F")[0].data);
		var optionName = subsequent ? "et-al-subsequent-use-first" : "et-al-use-first";
		context.prependChild(<option name={optionName} value={value}/>);
		// TODO: presumably, codes \x81 and \x80 contain the et-al term and
		// whether to italicize the et-al, respectively.
	}
}

/**
 * Parses sorting data
 *
 * @param {Object} sort A binary field object
 **/
Zotero.ENConverter.prototype.parseSort = function(sort) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var sortXML = false;
	var numberOfSortFields = this.parseInt(this.findField(sort.subfields, "\xB2")[0].data);
	if(numberOfSortFields) {
		sortXML = <sort/>;
		var sortFields = this.findField(sort.subfields, ["\xB3", "\xB4"]);
		for(var i=0; i<numberOfSortFields; i++) {
			var variable = this.findField(sortFields[i].subfields, "\xB5")[0].data;
			while(variable[variable.length-1] == "\x00") {
				variable = variable.substr(0, variable.length-1);
			}
			
			// add appropriate sort key
			if(variable == "\x11") {			// date
				sortXML.key += <key variable="date"/>;
			} else if(variable == "\x33") {		// accessed
				sortXML.key += <key variable="date"/>;
			} else {
				var macro = this.getMacro(variable, true);
				if(macro) {
					sortXML.key += <key macro={macro}/>;
				} else if(Zotero.ENConverter.variableMappings[variable]) {
					sortXML.key += <key variable={Zotero.ENConverter.variableMappings[variable]}/>;
				}
			}
		}
	}
	return sortXML;
}

/**
 * Parses citation and bibliography options, adding them to the style as necessary
 **/
Zotero.ENConverter.prototype.parseOptions = function() {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	/** Bibliography Options **/
	var bibliography = this.findField(this.fields, "\x02")[0];
	var bibliographyOptions = this.findField(bibliography.subfields, "!")[0];
	
	var etAlOptions = this.findField(bibliographyOptions.subfields, "u")[0];
	this.parseEtAl(etAlOptions, this.xml.bibliography);
	
	var performSubstitute = this.findField(bibliographyOptions.subfields, "v");
	if(performSubstitute[0].data[0] == "\x01") {
		// subsequent author substitute should be skipped
		this.xml.bibliography.option.prependChild(<option name="subsequent-author-substitute" value=""/>);
	} else if(performSubstitute[0].data[0] == "\x02") {
		// subsequent author substitute exists
		var subsequentAuthorSubstitute = this.parseFormattedString(this.findField(bibliographyOptions.subfields, "w")[0].data);
		this.xml.bibliography.prependChild(<option name="subsequent-author-substitute" value={subsequentAuthorSubstitute}/>);
	}
	
	var hangingIndent = this.findField(bibliography.subfields, ["&", "e"])[0].data[0];
	if(hangingIndent == "\x01" || hangingIndent == "\x02") {
		this.xml.bibliography.prependChild(<option name="hanging-indent" value="true"/>);
	}
	// TODO: support second paragraph only and all paragraphs but first
	
	// get author name tag
	this.bibliographyAuthor = this.parseName(bibliographyOptions);
	// get editor name tag
	this.bibliographyEditor = this.parseName(this.findField(bibliography.subfields, '"')[0]);
	
	// text case
	var textCase = this.findField(bibliography.subfields, " ")[0].data[0];
	this.bibliographyCase = false;
	if(textCase == "\x01") {
		this.bibliographyCase = "title";
	} else if(textCase == "\x02") {
		this.bibliographyCase = "sentence";
	}
	
	// sort order
	var bibliographySort = this.parseSort(this.findField(bibliography.subfields, ["'", "\xB1"])[0]);
	if(bibliographySort) this.xml.bibliography.insertChildBefore(this.xml.bibliography.layout[0], bibliographySort);
	
	/** Citation Options **/
	var citation = this.findField(this.fields, "\x03")[0];
	var footnote = this.findField(this.fields, "\x04")[0];
	this.isFootnote = this.findField(footnote.subfields, "Q")[0].data[0] == "\x02";
	if(this.isFootnote) {	// special footnote style specified
		this.xml.@class = "note";
		
		// get author name tag
		var author = this.findField(footnote.subfields, "S")[0];
		this.citationAuthor = this.parseName(this.findField(footnote.subfields, "S")[0]);
		
		// get editor name tag
		var editor = this.findField(footnote.subfields, "T")[0]
		this.citationEditor = this.parseName(this.findField(footnote.subfields, "T")[0]);
		
		// get et al rules
		var etAlOptions = this.findField(author.subfields, "u")[0];
		this.parseEtAl(etAlOptions, this.xml.citation);
		
		// text case
		var textCase = this.findField(footnote.subfields, "R")[0].data[0];
		this.citationCase = false;
		if(textCase == "\x01") {
			this.citationCase = "title";
		} else if(textCase == "\x02") {
			this.citationCase = "sentence";
		}
	} else {
		this.citationCase = this.bibliographyCase;
		this.xml.@class = "in-text";
		
		// parse name
		var citationOptions = this.findField(citation.subfields, "4")[0];
		var name = this.parseName(citationOptions);
		
		// this is strange, because there is one preference called "include the
		// author initials or full name in citation" to disambiguate and another
		// called "use initials only for primary authors with the same last name."
		// at the moment, we ignore the latter, since in the included APA style, 
		// it's checked, but no initials are specified.
		var initializeWith = this.findField(citation.subfields, ">")[0].data[0];
		if(initializeWith != "\x00") {
			this.xml.citation.prependChild(<option name="disambiguate-add-givenname" value="true"/>);
		}
		if(initializeWith == "A") {	// B. C.
			name["@initialize-with"] = ". ";
		} else if(initializeWith == "B") {	// B.C.
			name["@initialize-with"] = ".";
		} else if(initializeWith == "C") {	// B C
			name["@initialize-with"] = " ";
		} else if(initializeWith == "D") {	// BC
			name["@initialize-with"] = "";
		}
		
		this.citationAuthor = this.citationEditor = name;
		
		var addNames = this.findField(citation.subfields, "?")[0].data[0];
		if(addNames != "\x00") {
			this.xml.citation.prependChild(<option name="disambiguate-add-names" value="true"/>);
		}
		
		var addYearSuffix = this.findField(citation.subfields, "=")[0].data[0];
		if(addYearSuffix == "A") {
			this.xml.citation.prependChild(<option name="disambiguate-add-year-suffix" value="true"/>);
			this.xml.citation.prependChild(<option name="collapse" value="year-suffix"/>);
		} else if(addYearSuffix == "B") {
			this.xml.citation.prependChild(<option name="disambiguate-add-year-suffix" value="true"/>);
			
			// TODO: There are more options here than are currently implemented in 
			// CSL. Specifically, one can choose the delimiter here, and one can
			// choose not to omit the authors from citations with suffixes.
			var collapse = this.findField(citation.subfields, "9")[0].data[0];
			if(collapse != "\x00") {
				this.xml.citation.prependChild(<option name="collapse" value="year"/>);
			}
		}
		
		var etAlOptions = this.findField(citationOptions.subfields, "u")[0];
		this.parseEtAl(etAlOptions, this.xml.citation);
		var etAlSubsequentOptions = this.findField(citation.subfields, "8")[0];
		this.parseEtAl(etAlSubsequentOptions, this.xml.citation, true);
		
		// can't determine whether to add this until we know whether the citation
		// has a number
		var numberCollapse = this.findField(citation.subfields, ["6", "\xD0"])[0].data[0];
		this.numberCollapse = numberCollapse == "\x00" ? false : true;
		
		// sort order
		var sort = this.findField(citation.subfields, "5")[0];
		var useBibliographySort = this.findField(sort.subfields, "\xB0")[0].data[0];
		if(useBibliographySort == "\x02") {
			if(bibliographySort) this.xml.citation.insertChildBefore(this.xml.citation.layout[0], bibliographySort);
		} else {
			var citationSort = this.parseSort(this.findField(sort.subfields, "\xB1")[0]);
			if(citationSort) this.xml.citation.insertChildBefore(this.xml.citation.layout[0], citationSort);
		}
		
		// TODO: CSL needs support for one number for references always cited
		// together
		
		// 2 digit year format and ability to add title for different works by the
		// same author are included in getMacro
	}
}

/**
 * Converts text from UTF-16
 *
 * @param {String} text The UTF-16 text
 * @returns The text as a JS string
 * @type String
 **/
Zotero.ENConverter.prototype.convertFromUTF16 = function(text) {
	// convert from UTF-16
	return text.replace("\x00", "", "g");	// this won't work for non-ASCII
	
	var dataStream = Components.classes["@mozilla.org/io/string-input-stream;1"]
							   .createInstance(Components.interfaces.nsIStringInputStream);
	dataStream.setData(text, text.length);
	
	var textStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
							   .createInstance(Components.interfaces.nsIConverterInputStream);
	textStream.init(dataStream, "UTF-16LE", 4096, "?");
	
	var newText = "";
	var string = {};
	while(textStream.readString(text.length, string)) {
		newText += string.value;
	}
	
	return newText;
}

/**
 * Handles plural terms inside of <text/> fields (indicated by a caret, as in
 * the EndNote editor)
 *
 * @param {XML} The <text/> fields
 * @type {String} The type, as a string with the nulls trimmed
 * @variable {String} The variable, as a string with the nulls trimmed
 **/
Zotero.ENConverter.prototype.pluralize = function(fields, type, variable) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	if(!fields) return;
	var pluralVar = false;
	switch(variable) {
		case "\x02":		// author
			// \x09 - edited book
			pluralVar = (type == "\x09" ? "editor" : "author");
			break;
		
		case "\x0A":		// secondary author
			if(Zotero.ENConverter.seriesCodes.indexOf(type) !== -1) {
				pluralVar = "series-editor";
			} else if(type == "\x04") {			// personal_communication
				pluralVar = "recipient";
			} else if(type == "\x07") {			// chapter
				pluralVar = "editor";
			}
			break;
		
		case "\x16":		// tertiary author
			if(type == "\x07") {				// chapter
				pluralVar = "series-editor";
			}
			break;
		
		case "\x0D":		// subsidiary author
			pluralVar = "translator";
			break;
		
		case "\x05":		// pages
			pluralVar = "page";
			break;
		
		case "\x06\x40":	// locator
			pluralVar = "locator";
			break;
	}
	
	for(var i=0; i<fields.length(); i++) {
		var text = fields[i];
		if(text.@value.indexOf("^") !== -1) {
			var textString = text.@value.toString();
			var singular = textString.replace(/([^\^\s]*)\^[^\^\s]*/g, "$1");
			if(pluralVar) {
				var singularTerm = text.copy();
				var pluralTerm = text.copy();
				singularTerm.@value = singular;
				pluralTerm.@value = textString.toString().replace(/[^\^\s]*\^([^\^\s]*)/g, "$1");
				
				fields[i] = <choose>
						<if is-plural={pluralVar}>{pluralTerm}</if>
						<else>{singularTerm}</else>
					</choose>;
			} else {
				text.@value = singular;
			}
		}
	}
}

/**
 * Gets the name of the macro for a given variable and adds that macro to
 * the style.
 *
 * @param {String} code The binary variable, with nulls trimmed.
 * @param {Boolean} isBibliography Whether this variable occurs in the bibliography
 * 
 * @returns A string macro name, or false if no macro is available for the given
 *          variable.
 **/
Zotero.ENConverter.prototype.getMacro = function(code, isBibliography) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var name = Zotero.ENConverter.macroVariables[code];
	if(!name) return false;
	if(typeof name == "object") name = Zotero.ENConverter.macroVariables[code][isBibliography ? 1 : 0];
	if(this.xml.macro.(@name == name).length()) return name;
	
	var macroXML = false;
	switch(code) {
		case "\x02":	// author/editor
			// if edited book, use editor; otherwise, use author
			var editor = (isBibliography ? this.bibliographyEditor : this.citationEditor);
			var author = (isBibliography ? this.bibliographyAuthor : this.citationAuthor);
			
			macroXML = <choose>
						<if type="book" variable="editor">
							<names variable="editor">{editor}</names>
						</if>
						<else>
							<names variable="author">{author}</names>
						</else>
					</choose>;
			
			// determine whether to add title to disambiguate
			if(!isBibliography) {
				var addTitle = this.findField(this.fields, ["\x03", "@"])[0].data[0];
				var titleElement = false;
				if(addTitle == "A") {				// long title
					titleElement = <text variable="title"/>;
				} else if(addTitle == "B") {		// short title
					titleElement = <text variable="title" form="short"/>;
				}
					
				if(titleElement) {
					macroXML += <choose>
							<if disambiguate="true">{titleElement}</if>
						</choose>;
				}
			}
			break;
		
		case "\x03":	// year
			macroXML = <date variable="issued">
						<date-part name="year"/>
					</date>;
			
			if(!isBibliography && !this.isFootnote) {
				// check to see whether to use 2-digit year
				var twoDigitYear = this.findField(this.fields, ["\x03", "2"])[0].data[0];
				if(twoDigitYear != "\x00") {
					macroXML["date-part"]["@form"] = "short";
				}
			}
			break;
		
		case "\x04":	// book title/title
			var title = <text variable="title"/>;
			var containerTitle = <text variable="container-title"/>;
			
			// determine whether to capitalize title
			var textCase = isBibliography ? this.bibliographyCase : this.citationCase;
			if(textCase) title["@text-case"] = containerTitle["@text-case"] = textCase;
			
			macroXML = <choose>
						<if type="chapter">
							{containerTitle}
						</if>
						<else>
							{title}
						</else>
					</choose>;
			break;
		
		case "\x06":	// secondary title
			macroXML = <choose>
						<if type={Zotero.ENConverter.seriesTypes} match="any">
							<text variable="collection-title"/>
						</if>
						<else>
							<text variable="container-title"/>
						</else>
					</choose>;
			break;
		
		case "\x0A":	// secondary author
			var nameElement = (isBibliography ? this.bibliographyEditor : this.citationEditor);
			
			macroXML = <choose>
						<if type={Zotero.ENConverter.seriesTypes} match="any">
							<names variable="series-editor">{nameElement}</names>
						</if>
						<else-if type="personal_communication">
							<names variable="recipient">{nameElement}</names>
						</else-if>
						<else-if type="chapter">
							<names variable="editor">{nameElement}</names>
						</else-if>
					</choose>;
			break;
		
		case "\x0D":	// translator
			var nameElement = (isBibliography ? this.bibliographyEditor : this.citationEditor);
			
			macroXML = <names variable="translator">{nameElement}</names>
			break;
		
		case "\x0E":	// edition
			macroXML = <number variable="edition" form="ordinal"/>;
			break;
		
		case "\x11":	// date
			macroXML = <date variable="issued">
						<date-part name="month" suffix=" "/>
						<date-part name="day" suffix=", "/>
						<date-part name="year"/>
					</date>;
			break;
			
		case "\x15":	// tertiary title
			macroXML = <choose>
						<if type="chapter">
							<text variable="collection-title"/>
						</if>
					</choose>;
			break;
		
		case "\x16":	// tertiary author
			var nameElement = (isBibliography ? this.bibliographyEditor : this.citationEditor);
			
			macroXML = <choose>
						<if type="chapter">
							<names variable="series-editor">{nameElement}</names>
						</if>
					</choose>;
			break;
		
		case "\x20":	// short title
			macroXML = <text variable="title" form="short"/>
			
			var textCase = isBibliography ? this.bibliographyCase : this.citationCase;
			if(textCase) macroXML["@text-case"] = textCase;
			
			break;
		
		case "\x23":	// chapter title
			macroXML = <choose>
						<if type="chapter">
							<text variable="title"/>
						</if>
					</choose>;
			break;
		
		case "\x33":	// accessed
			macroXML = <date variable="accessed">
						<date-part name="month" suffix=" "/>
						<date-part name="day" suffix=", "/>
						<date-part name="year"/>
					</date>
			break;
	}
	
	this.xml.info += <macro name={name}>{macroXML}</macro>;
	return name;
}

/**
 * Parses a set of fields
 *
 * @param {Array} fields An array of binary objects
 * @param {String} type The binary reference type, with nulls trimmed
 * @param {Boolean} isBibliography Whether these fields are in the bibliography
 **/
Zotero.ENConverter.prototype.parseFields = function(fields, type, isBibliography) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var referenceXML = new XML();
	for each(var field in fields) {
		var prefix = this.parseFormattedString(this.findField(field.subfields, "\x94")[0].data, true);
		var suffix = this.parseFormattedString(this.findField(field.subfields, "\x95")[0].data, true);
		
		// get only non-null characters of variable
		var variable = this.findField(field.subfields, "\x91")[0].data;
		while(variable[variable.length-1] == "\x00") {
			variable = variable.substr(0, variable.length-1);
		}
		
		var macro = this.getMacro(variable, isBibliography);
		
		if(macro || Zotero.ENConverter.variableMappings[variable]) {
			if(macro) {
				var text = <text macro={macro}/>;
			} else {
				// use mappings
				var text = <text variable={Zotero.ENConverter.variableMappings[variable]}/>;
			}
			
			// caret allows pluralization of terms
			this.pluralize(prefix, type, variable);
			this.pluralize(suffix, type, variable);
			
			var fieldFormat = this.findField(field.subfields, "\x92")[0].subfields[2].data;
			
			this.applyFormattingAttributes(text, fieldFormat);
			
			if(text) {
				if(prefix || suffix) {
					text = <group>{text}</group>;
					if(prefix) text.prependChild(prefix);
					if(suffix) text.appendChild(suffix);
				}
				referenceXML += text;
			}
		} else if(variable == "") {
			// this is a value
			if(prefix) referenceXML += prefix;
			if(suffix) referenceXML += suffix;
		} else if(variable == "\x05\x40") {	// newline
			if(prefix) referenceXML += prefix;
			referenceXML += <text value="&#xA;"/>;
			if(suffix) referenceXML += suffix;
		} else {
			/*var variableString = "EN-";
			for(var i=0; i<variable.length; i++) {
				variableString += showCode(variable[i])
			}
			referenceXML += <text variable={variableString}/>;*/
		}
	}
	return referenceXML;
}

/**
 * Parses separate descriptions for multiple references into one <choose> tag
 *
 * @param {Array} referenceDescriptions An array of binary objects
 * @param {Boolean} isBibliography Whether these references are in the bibliography
 **/
Zotero.ENConverter.prototype.parseReferences = function(referenceDescriptions, isBibliography) {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var types = [];
	var descriptions = [];
	var supplementalTypes = {};
	
	for each(var description in referenceDescriptions) {
		// map appropriate type
		var type = this.findField(description.subfields, "\xA1")[0].data[0];
		var cslType = Zotero.ENConverter.typeMappings[type];
		if(!cslType && !Zotero.ENConverter.supplementalTypes[type]) continue;
		
		// parse references into XML
		var referenceXML = this.parseFields(this.findField(description.subfields, ["\xA2", "\x90"]), type, isBibliography);
		
		// need to make sure more specific types get tested before less specific
		// types
		if(Zotero.ENConverter.fallbackTypes[cslType]) {
			types.push(cslType);
			descriptions.push(referenceXML);
		} else if(cslType) {
			types.unshift(cslType);
			descriptions.unshift(referenceXML);
		} else {
			supplementalTypes[type] = referenceXML;
		}
	}
	
	// determine whether we have multiple types
	var haveTypes = !!types.length;
	if(!haveTypes) {
		for(var i in supplementalTypes) {
			if(i != "\x1F") {
				haveTypes = true;
				break;
			}
		}
	}
	
	// build XML
	if(haveTypes) {
		// first tag must be an <if>; subsequent are else-ifs
		var tagName = "if";
		
		var choose = new XML();
		
		// put in supplemental types first, to make sure that they override
		for(var i in supplementalTypes) {
			var ifTag = <{tagName}>{supplementalTypes[i]}</{tagName}>;
			if(i == "\x09") {
				ifTag.@type = "book";
				ifTag.@variable = "editor";
			} else if(i == "\x1C") {
				ifTag.@type = "article";
				ifTag.@variable = "URL";
			} else if(i == "\x1D") {
				ifTag.@type = "book";
				ifTag.@variable = "URL";
			} else {
				continue;
			}
			
			choose += ifTag;
			tagName = "else-if";
		}
		
		// add mapped types
		for(var i in types) {
			choose += <{tagName} type={types[i]}>{descriptions[i]}</{tagName}>;
			tagName = "else-if";
		}
		
		// if not all fallback types are specified, use an <else> with the
		// generic record
		if(supplementalTypes["\x1F"]) {
			choose += <else>{supplementalTypes["\x1F"]}</else>;
		}
		
		return <choose>{choose}</choose>;
	} else if(supplementalTypes["\x1F"]) {
		// only a generic record; use for everything
		return supplementalTypes["\x1F"];
	} else {
		return new XML();
	}
}

Zotero.ENConverter.positions = ["ibid-with-locator", "ibid", "subsequent"]; 
/**
 * Converts the citation to CSL
 * Requires that parseOptions has already been run
 **/
Zotero.ENConverter.prototype.parseCitation = function() {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	if(this.isFootnote) {
		var footnote = this.findField(this.fields, "\x04")[0];
		
		var repeatRules = this.findField(footnote.subfields, "Y")[0];
		var positions = new Object();
		positions.else = this.parseReferences(this.findField(footnote.subfields, ["U", "\xA0"]));
		
		// determine whether to use short form
		if(this.findField(repeatRules.subfields, "\xC0")[0].data[0] == "\x01") {
			// determine whether to include title
			// TODO: better title handling (quotes, italics, etc.)
			positions.subsequent = new XML();
			
			if(this.findField(repeatRules.subfields, "\xC1")[0].data[0] == "\x01") {
				// include title
				var author = this.getMacro("\x02");
				var shortTitle = this.getMacro("\x20");
				positions.subsequent += <group delimiter=", ">
						<text macro={author}/>
						<text macro={shortTitle}/>
					</group>;
			} else {
				positions.subsequent += <text macro={author}/>
			}
			positions.subsequent += <text prefix=", " variable="locator"/>
		}
		
		// determine whether to use ibid
		var useIbid = this.findField(repeatRules.subfields, "\xC2")[0].data[0];
		if(useIbid == "\x00") {
			// replace repeated citations with ibid data
			var ibidTerm = this.parseFormattedString(this.findField(repeatRules.subfields, "\xC4")[0].data);
			positions.ibid = <text value={ibidTerm}/>;
		}
		// TODO: EndNote has an "omit repeated data" feature that doesn't
		// seem to make any sense, since this just suggests there isn't
		// supposed to be a footnote. Need to figure out what this means
		
		var useIbidWithLocator = this.findField(repeatRules.subfields, "\xC3")[0].data[0];
		var ibidWithLocatorTerm = this.parseFormattedString(this.findField(repeatRules.subfields, "\xC5")[0].data);
		if(useIbidWithLocator == "\x00") {
			// replace citations with different locators with ibid
			positions["ibid-with-locator"] = new XML();
			positions["ibid-with-locator"] += <text value={ibidWithLocatorTerm}/>;
			positions["ibid-with-locator"] += <text variable="locator" prefix=", "/>;
		} else if(useIbidWithLocator == "\x01") {
			positions["ibid-with-locator"] = positions.else.copy();
			for each(var position in positions["ibid-with-locator"]..text) {
				if(position.@macro == "secondary_title") {
					delete position.@macro;
					position.@value = ibidWithLocatorTerm;
				}
			}
		}
		
		// else find out whether we have any non-else positions
		var elseOnly = true;
		for(var i=0; i<Zotero.ENConverter.positions.length; i++) {
			if(positions[Zotero.ENConverter.positions[i]]) {
				elseOnly = false;
			}
		}
		
		if(elseOnly) {
			// if only first, don't use choose
			var citationXML = positions.else;
		} else {
			var citationXML = <choose/>;
			var isFirst = true;
			for(var i=0; i<Zotero.ENConverter.positions.length; i++) {
				if(positions[Zotero.ENConverter.positions[i]]) {
					var ifType = isFirst ? "if" : "else-if";
					isFirst = false;
					citationXML.appendChild(<{ifType} position={Zotero.ENConverter.positions[i]}>
							{positions[Zotero.ENConverter.positions[i]]}
						</{ifType}>);
				}
			}
			citationXML.appendChild(<else>{positions.else}</else>);
		}
	} else {
		var citation = this.findField(this.fields, "\x03")[0];
		
		// put citation in a macro so that it can potentially be used as a field
		var citationFields = this.findField(citation.subfields, ["3", "\xA0", "\xA2", "\x90"]);
		var citationXML = this.parseFields(citationFields);
		
		var delimiter = this.parseFormattedString(this.findField(citation.subfields, "0")[0].data);
		if(delimiter !== "") this.xml.citation.layout.@delimiter = delimiter;
		
		// determine whether to collapse numbers, since we need to know whether
		// there's a number first (because EndNote stupidly allows both collapse
		// on author and on number, which seems impossible)
		if(this.numberCollapse && citationXML..variable.(@text == "citation-number").length()) {
			if(this.xml.citation.option.(@name == "collapse").length()) {
				this.xml.citation.option.(@name == "collapse").value = "citation-number";
			} else {
				this.xml.citation.prependChild(<option name="collapse" value="citation-number"/>);
			}
		}
	}
	
	this.xml.info += <macro name="citation">{citationXML}</macro>;
}

/**
 * Converts the bibliography to CSL
 * Requires that parseOptions has already been run
 **/
Zotero.ENConverter.prototype.parseBibliography = function() {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	var references = this.findField(this.fields, "\x02")[0];
	
	// add prefix
	var prefixFields = this.findField(references.subfields, ["$", "\x90"]);
	this.xml.bibliography.layout.appendChild(this.parseFields(prefixFields, true));
	
	// contains a record for each type within EndNote
	var referenceDescriptions = this.findField(references.subfields, ["#", "\xA0"]);
	this.xml.bibliography.layout.appendChild(this.parseReferences(referenceDescriptions, true));
	
	// add suffix
	var prefixFields = this.findField(references.subfields, ["%", "\x90"]);
	this.xml.bibliography.layout.appendChild(this.parseFields(prefixFields, true));
}

/**
 * Parses the EN file format, returning CSL in the format of an E4X XML object
 **/
Zotero.ENConverter.prototype.parse = function() {
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	
	this.fields = this.parseFormat(this.data.substr(0x20));
	
	// create XML skeleton
	this.xml = <style xml:lang="en" xmlns="http://purl.org/net/xbiblio/csl">
			<info/>
			<citation>
				<layout>
					<text macro="citation"/>
				</layout>
			</citation>
			<bibliography>
				<layout/>
			</bibliography>
		</style>;
	
	this.parseInfo();
	this.parseOptions();
	this.parseCitation();
	this.parseBibliography();
	
	Zotero.debug(this.xml);
	return this.xml;
}