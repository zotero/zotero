/*
 * Copyright (c) 2009 and 2010 Frank G. Bennett, Jr. All Rights
 * Reserved.
 *
 * The contents of this file are subject to the Common Public
 * Attribution License Version 1.0 (the “License”); you may not use
 * this file except in compliance with the License. You may obtain a
 * copy of the License at:
 *
 * http://bitbucket.org/fbennett/citeproc-js/src/tip/LICENSE.
 *
 * The License is based on the Mozilla Public License Version 1.1 but
 * Sections 14 and 15 have been added to cover use of software over a
 * computer network and provide for limited attribution for the
 * Original Developer. In addition, Exhibit A has been modified to be
 * consistent with Exhibit B.
 *
 * Software distributed under the License is distributed on an “AS IS”
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See
 * the License for the specific language governing rights and limitations
 * under the License.
 *
 * The Original Code is the citation formatting software known as
 * "citeproc-js" (an implementation of the Citation Style Language
 * [CSL]), including the original test fixtures and software located
 * under the ./std subdirectory of the distribution archive.
 *
 * The Original Developer is not the Initial Developer and is
 * __________. If left blank, the Original Developer is the Initial
 * Developer.
 *
 * The Initial Developer of the Original Code is Frank G. Bennett,
 * Jr. All portions of the code written by Frank G. Bennett, Jr. are
 * Copyright (c) 2009 and 2010 Frank G. Bennett, Jr. All Rights Reserved.
 *
 * Alternatively, the contents of this file may be used under the
 * terms of the GNU Affero General Public License (the [AGPLv3]
 * License), in which case the provisions of [AGPLv3] License are
 * applicable instead of those above. If you wish to allow use of your
 * version of this file only under the terms of the [AGPLv3] License
 * and not to allow others to use your version of this file under the
 * CPAL, indicate your decision by deleting the provisions above and
 * replace them with the notice and other provisions required by the
 * [AGPLv3] License. If you do not delete the provisions above, a
 * recipient may use your version of this file under either the CPAL
 * or the [AGPLv3] License.”
 */
if (!Array.indexOf) {
	Array.prototype.indexOf = function (obj) {
		var i, len;
		for (i = 0, len = this.length; i < len; i += 1) {
			if (this[i] === obj) {
				return i;
			}
		}
		return -1;
	};
}
var CSL = {
	GENDERS: ["masculine", "feminine"],
	ERROR_NO_RENDERED_FORM: 1,
	PREVIEW: "Just for laughs.",
	ASSUME_ALL_ITEMS_REGISTERED: 2,
	START: 0,
	END: 1,
	SINGLETON: 2,
	SEEN: 6,
	SUCCESSOR: 3,
	SUCCESSOR_OF_SUCCESSOR: 4,
	SUPPRESS: 5,
	SINGULAR: 0,
	PLURAL: 1,
	LITERAL: true,
	BEFORE: 1,
	AFTER: 2,
	DESCENDING: 1,
	ASCENDING: 2,
	ONLY_FIRST: 1,
	ALWAYS: 2,
	ONLY_LAST: 3,
	FINISH: 1,
	POSITION_FIRST: 0,
	POSITION_SUBSEQUENT: 1,
	POSITION_IBID: 2,
	POSITION_IBID_WITH_LOCATOR: 3,
	MARK_TRAILING_NAMES: true,
	POSITION_TEST_VARS: ["position", "first-reference-note-number", "near-note"],
	AREAS: ["citation", "citation_sort", "bibliography", "bibliography_sort"],
	MULTI_FIELDS: ["publisher", "publisher-place", "title", "container-title", "collection-title", "institution", "authority"],
	CITE_FIELDS: ["first-reference-note-number", "locator"],
	MINIMAL_NAME_FIELDS: ["literal", "family"],
	SWAPPING_PUNCTUATION: [".", "!", "?", ":",",",";"],
	TERMINAL_PUNCTUATION: [".", "!", "?", ":", " "],
	SPLICE_PUNCTUATION: [".", "!", "?", ":", ";", ","],
	NONE: 0,
	NUMERIC: 1,
	POSITION: 2,
	COLLAPSE_VALUES: ["citation-number", "year", "year-suffix"],
	DATE_PARTS: ["year", "month", "day"],
	DATE_PARTS_ALL: ["year", "month", "day", "season"],
	DATE_PARTS_INTERNAL: ["year", "month", "day", "year_end", "month_end", "day_end"],
	NAME_PARTS: ["family", "given", "dropping-particle", "non-dropping-particle", "suffix", "literal"],
	DECORABLE_NAME_PARTS: ["given", "family", "suffix"],
	DISAMBIGUATE_OPTIONS: [
		"disambiguate-add-names",
		"disambiguate-add-givenname",
		"disambiguate-add-year-suffix"
	],
	GIVENNAME_DISAMBIGUATION_RULES: [
		"all-names",
		"all-names-with-initials",
		"primary-name",
		"primary-name-with-initials",
		"by-cite"
	],
	NAME_ATTRIBUTES: [
		"and",
		"delimiter-precedes-last",
		"delimiter-precedes-et-al",
		"initialize-with",
		"name-as-sort-order",
		"sort-separator",
		"et-al-min",
		"et-al-use-first",
		"et-al-subsequent-min",
		"et-al-subsequent-use-first"
	],
	PARALLEL_MATCH_VARS: ["container-title"],
	PARALLEL_TYPES: ["legal_case",  "legislation"],
	PARALLEL_COLLAPSING_MID_VARSET: ["volume", "container-title", "section"],
	LOOSE: 0,
	STRICT: 1,
	PREFIX_PUNCTUATION: /[.;:]\s*$/,
	SUFFIX_PUNCTUATION: /^\s*[.;:,\(\)]/,
	NUMBER_REGEXP: /(?:^\d+|\d+$)/,
	QUOTED_REGEXP_START: /^"/,
	QUOTED_REGEXP_END: /^"$/,
	NAME_INITIAL_REGEXP: /^([A-Z\u0080-\u017f\u0400-\u042f])([a-zA-Z\u0080-\u017f\u0400-\u052f]*|)/,
	ROMANESQUE_REGEXP: /[a-zA-Z\u0080-\u017f\u0400-\u052f\u0386-\u03fb\u1f00-\u1ffe]/,
	STARTSWITH_ROMANESQUE_REGEXP: /^[&a-zA-Z\u0080-\u017f\u0400-\u052f\u0386-\u03fb\u1f00-\u1ffe]/,
	ENDSWITH_ROMANESQUE_REGEXP: /[&a-zA-Z\u0080-\u017f\u0400-\u052f\u0386-\u03fb\u1f00-\u1ffe]$/,
	ALL_ROMANESQUE_REGEXP: /^[a-zA-Z\u0080-\u017f\u0400-\u052f\u0386-\u03fb\u1f00-\u1ffe]+$/,
	VIETNAMESE_SPECIALS: /[\u00c0-\u00c3\u00c8-\u00ca\u00cc\u00cd\u00d2-\u00d5\u00d9\u00da\u00dd\u00e0-\u00e3\u00e8-\u00ea\u00ec\u00ed\u00f2-\u00f5\u00f9\u00fa\u00fd\u0101\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]/,
	VIETNAMESE_NAMES: /^(?:(?:[.AaBbCcDdEeGgHhIiKkLlMmNnOoPpQqRrSsTtUuVvXxYy \u00c0-\u00c3\u00c8-\u00ca\u00cc\u00cd\u00d2-\u00d5\u00d9\u00da\u00dd\u00e0-\u00e3\u00e8-\u00ea\u00ec\u00ed\u00f2-\u00f5\u00f9\u00fa\u00fd\u0101\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]{2,6})(\s+|$))+$/,
	NOTE_FIELDS_REGEXP: /{:[-a-z]+:[^}]+}/g,
	NOTE_FIELD_REGEXP: /{:([-a-z]+):([^}]+)}/,
	DISPLAY_CLASSES: ["block", "left-margin", "right-inline", "indent"],
	NAME_VARIABLES: [
		"author",
		"editor",
		"translator",
		"contributor",
		"collection-editor",
		"composer",
		"container-author",
		"editorial-director",
		"interviewer",
		"original-author",
		"recipient"
	],
	NUMERIC_VARIABLES: ["edition", "volume", "number-of-volumes", "number", "issue", "citation-number"],
	DATE_VARIABLES: ["issued", "event-date", "accessed", "container", "original-date"],
	TAG_ESCAPE: function (str) {
		var mx, lst, len, pos, m, buf1, buf2, idx, ret, myret;
		mx = str.match(/(<span\s+class=\"no(?:case|decor)\">)/g);
		lst = str.split(/<span\s+class=\"no(?:case|decor)\">/g);
		myret = [lst[0]];
		for (pos = 1, len = lst.length; pos < len; pos += 1) {
			myret.push(mx[pos - 1]);
			myret.push(lst[pos]);
		}
		lst = myret.slice();
		len = lst.length - 1;
		for (pos = len; pos > 1; pos += -2) {
			m = lst[pos].match(/<\/span>/);
			if (m) {
				idx = lst[pos].indexOf("</span>");
				buf1 = lst[pos].slice(0, idx);
				buf2 = lst[pos].slice(idx + 7);
				lst[pos - 1] += buf1 + "</span>";
				lst[pos] = buf2;
			} else {
				buf1 = lst.slice(0, pos - 1);
				if (pos < (lst.length - 1)) {
					buf2 = lst[pos - 1] + lst[pos];
				} else {
					buf2 = lst[pos - 1] + lst[pos] + lst[pos + 1];
				}
				lst = buf1.push(buf2).concat(lst.slice(pos + 2));
			}
		}
		return lst;
	},
	TAG_USEALL: function (str) {
		var ret, open, close, end;
		ret = [""];
		open = str.indexOf("<");
		close = str.indexOf(">");
		while (open > -1 && close > -1) {
			if (open > close) {
				end = open + 1;
			} else {
				end = close + 1;
			}
			if (open < close && str.slice(open + 1, close).indexOf("<") === -1) {
				ret[ret.length - 1] += str.slice(0, open);
				ret.push(str.slice(open, close + 1));
				ret.push("");
				str = str.slice(end);
			} else {
				ret[ret.length - 1] += str.slice(0, close + 1);
				str = str.slice(end);
			}
			open = str.indexOf("<");
			close = str.indexOf(">");
		}
		ret[ret.length - 1] += str;
		return ret;
	},
	SKIP_WORDS: ["a", "the", "an"],
	FORMAT_KEY_SEQUENCE: [
		"@strip-periods",
		"@font-style",
		"@font-variant",
		"@font-weight",
		"@text-decoration",
		"@vertical-align",
		"@quotes"
	],
	SUFFIX_CHARS: "a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z",
	ROMAN_NUMERALS: [
		[ "", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix" ],
		[ "", "x", "xx", "xxx", "xl", "l", "lx", "lxx", "lxxx", "xc" ],
		[ "", "c", "cc", "ccc", "cd", "d", "dc", "dcc", "dccc", "cm" ],
		[ "", "m", "mm", "mmm", "mmmm", "mmmmm"]
	],
	CREATORS: [
		"author",
		"editor",
		"contributor",
		"translator",
		"recipient",
		"interviewer",
		"composer",
		"original-author",
		"container-author",
		"collection-editor"
	],
	LANG_BASES: {
		af: "af_ZA",
		ar: "ar_AR",
		bg: "bg_BG",
		ca: "ca_AD",
		cs: "cs_CZ",
		da: "da_DK",
		de: "de_DE",
		el: "el_GR",
		en: "en_US",
		es: "es_ES",
		et: "et_EE",
		fr: "fr_FR",
		he: "he_IL",
		hu: "hu_HU",
		is: "is_IS",
		it: "it_IT",
		ja: "ja_JP",
		km: "km_KH",
		ko: "ko_KR",
		mn: "mn_MN",
		nb: "nb_NO",
		nl: "nl_NL",
		pl: "pl_PL",
		pt: "pt_PT",
		ro: "ro_RO",
		ru: "ru_RU",
		sk: "sk_SK",
		sl: "sl_SI",
		sr: "sr_RS",
		sv: "sv_SE",
		th: "th_TH",
		tr: "tr_TR",
		uk: "uk_UA",
		vi: "vi_VN",
		zh: "zh_CN"
	},
	locale: {},
	locale_opts: {},
	locale_dates: {}
};
CSL.TERMINAL_PUNCTUATION_REGEXP = new RegExp("^([" + CSL.TERMINAL_PUNCTUATION.slice(0, -1).join("") + "])(.*)");
CSL.CLOSURES = new RegExp(".*[\\]\\)]");
if ("object" === typeof console && "function" === typeof console.log) {
	CSL.debug = function (str) {
        console.log("CSL: " + str);
	};
	CSL.error = function (str) {
        console.log("CSL error: " + str);
	};
} else {
	CSL.debug = function () {};
	CSL.error = function (str) {
		throw "CSL error: " + str;
	};
}
var CSL_E4X = function () {};
CSL_E4X.prototype.clean = function (xml) {
	xml = xml.replace(/<\?[^?]+\?>/g, "");
	xml = xml.replace(/<![^>]+>/g, "");
	xml = xml.replace(/^\s+/g, "");
	xml = xml.replace(/\s+$/g, "");
	return xml;
};
CSL_E4X.prototype.children = function (myxml) {
	return myxml.children();
};
CSL_E4X.prototype.nodename = function (myxml) {
	var ret = myxml.localName();
	return ret;
};
CSL_E4X.prototype.attributes = function (myxml) {
	var ret, attrs, attr, key, xml;
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	ret = new Object();
	attrs = myxml.attributes();
	for each (attr in attrs) {
		key = "@" + attr.localName();
		if (key.slice(0,5) == "@e4x_") {
			continue;
		}
		ret[key] = attr.toString();
	}
	return ret;
};
CSL_E4X.prototype.content = function (myxml) {
	return myxml.toString();
};
CSL_E4X.prototype.namespace = {
	"xml":"http://www.w3.org/XML/1998/namespace"
}
CSL_E4X.prototype.numberofnodes = function (myxml) {
	return myxml.length();
};
CSL_E4X.prototype.getAttributeName = function (attr) {
	var ret = attr.localName();
	return ret;
}
CSL_E4X.prototype.getAttributeValue = function (myxml,name,namespace) {
	var xml;
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	if (namespace) {
		var ns = new Namespace(this.namespace[namespace]);
		var ret = myxml.@ns::[name].toString();
	} else {
		if (name) {
			var ret = myxml.attribute(name).toString();
		} else {
			var ret = myxml.toString();
		}
	}
	return ret;
}
CSL_E4X.prototype.getNodeValue = function (myxml,name) {
	var xml;
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	if (name){
		return myxml[name].toString();
	} else {
		return myxml.toString();
	}
}
CSL_E4X.prototype.setAttributeOnNodeIdentifiedByNameAttribute = function (myxml,nodename,attrname,attr,val) {
	var xml;
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	if (attr[0] != '@'){
		attr = '@'+attr;
	}
	myxml[nodename].(@name == attrname)[0][attr] = val;
}
CSL_E4X.prototype.deleteNodeByNameAttribute = function (myxml,val) {
	delete myxml.*.(@name==val)[0];
}
CSL_E4X.prototype.deleteAttribute = function (myxml,attr) {
	delete myxml["@"+attr];
}
CSL_E4X.prototype.setAttribute = function (myxml,attr,val) {
	myxml['@'+attr] = val;
}
CSL_E4X.prototype.nodeCopy = function (myxml) {
	return myxml.copy();
}
CSL_E4X.prototype.getNodesByName = function (myxml,name,nameattrval) {
	var xml, ret;
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	ret = myxml.descendants(name);
	if (nameattrval){
		ret = ret.(@name == nameattrval);
	}
	return ret;
}
CSL_E4X.prototype.nodeNameIs = function (myxml,name) {
	var xml;
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	if (myxml.localName() && myxml.localName().toString() == name){
		return true;
	}
	return false;
}
CSL_E4X.prototype.makeXml = function (myxml) {
	var xml;
	XML.ignoreComments = true;
	XML.ignoreProcessingInstructions = true;
 	XML.ignoreWhitespace = true;
	XML.prettyPrinting = true;
	XML.prettyIndent = 2;
	if ("xml" == typeof myxml){
		myxml = myxml.toXMLString();
	};
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	xml = new Namespace("http://www.w3.org/XML/1998/namespace");
	if (myxml){
		myxml = myxml.replace(/\s*<\?[^>]*\?>\s*\n*/g, "");
		myxml = new XML(myxml);
	} else {
		myxml = new XML();
	}
	return myxml;
};
CSL_E4X.prototype.insertChildNodeAfter = function (parent,node,pos,datexml) {
	var myxml, xml;
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	myxml = XML(datexml.toXMLString());
	parent.insertChildAfter(node,myxml);
	delete parent.*[pos];
	return parent;
};
CSL_E4X.prototype.addInstitutionNodes = function(myxml) {
	var institution_long, institution_short, children, node, xml;
	default xml namespace = "http://purl.org/net/xbiblio/csl"; with({});
	institution_long = <institution
		institution-parts="long"
		delimiter=", "
		substitute-use-first="1"
		use-last="1"/>;
	institution_short = <institution
		institution-parts="long"
		delimiter=", "
		substitute-use-first="1"
		use-last="1"/>;
	for each (node in myxml..names) {
		if ("xml" == typeof node && node.elements("name").length() > 0) {
			if (!node.institution.toString()) {
				node.name += institution_long;
			}
		}
	}
};
CSL.error = function (str) {
	Zotero.log("CSL: " + str, "error");
};
CSL.debug = function (str) {
	Zotero.debug("CSL: " + str);
};
CSL.Output = {};
CSL.Output.Queue = function (state) {
	this.levelname = ["top"];
	this.state = state;
	this.queue = [];
	this.empty = new CSL.Token("empty");
	var tokenstore = {};
	tokenstore.empty = this.empty;
	this.formats = new CSL.Stack(tokenstore);
	this.current = new CSL.Stack(this.queue);
};
CSL.Output.Queue.prototype.getToken = function (name) {
	var ret = this.formats.value()[name];
	return ret;
};
CSL.Output.Queue.prototype.mergeTokenStrings = function (base, modifier) {
	var base_token, modifier_token, ret, key;
	base_token = this.formats.value()[base];
	modifier_token = this.formats.value()[modifier];
	ret = base_token;
	if (modifier_token) {
		if (!base_token) {
			base_token = new CSL.Token(base, CSL.SINGLETON);
			base_token.decorations = [];
		}
		ret = new CSL.Token(base, CSL.SINGLETON);
		key = "";
		for (key in base_token.strings) {
			if (base_token.strings.hasOwnProperty(key)) {
				ret.strings[key] = base_token.strings[key];
			}
		}
		for (key in modifier_token.strings) {
			if (modifier_token.strings.hasOwnProperty(key)) {
				ret.strings[key] = modifier_token.strings[key];
			}
		}
		ret.decorations = base_token.decorations.concat(modifier_token.decorations);
	}
	return ret;
};
CSL.Output.Queue.prototype.addToken = function (name, modifier, token) {
	var newtok, attr;
	newtok = new CSL.Token("output");
	if ("string" === typeof token) {
		token = this.formats.value()[token];
	}
	if (token && token.strings) {
		for (attr in token.strings) {
			if (token.strings.hasOwnProperty(attr)) {
				newtok.strings[attr] = token.strings[attr];
			}
		}
		newtok.decorations = token.decorations;
	}
	if ("string" === typeof modifier) {
		newtok.strings.delimiter = modifier;
	}
	this.formats.value()[name] = newtok;
};
CSL.Output.Queue.prototype.pushFormats = function (tokenstore) {
	if (!tokenstore) {
		tokenstore = {};
	}
	tokenstore.empty = this.empty;
	this.formats.push(tokenstore);
};
CSL.Output.Queue.prototype.popFormats = function (tokenstore) {
	this.formats.pop();
};
CSL.Output.Queue.prototype.startTag = function (name, token) {
	var tokenstore = {};
	tokenstore[name] = token;
	this.pushFormats(tokenstore);
	this.openLevel(name);
};
CSL.Output.Queue.prototype.endTag = function () {
	this.closeLevel();
	this.popFormats();
};
CSL.Output.Queue.prototype.openLevel = function (token, ephemeral) {
	var blob, curr, x, has_ephemeral;
	if (!this.formats.value()[token]) {
		throw "CSL processor error: call to nonexistent format token \"" + token + "\"";
	}
	blob = new CSL.Blob(this.formats.value()[token], false, token);
	if (this.state.tmp.count_offset_characters && blob.strings.prefix.length) {
		this.state.tmp.offset_characters += blob.strings.prefix.length;
	}
	if (this.state.tmp.count_offset_characters && blob.strings.suffix.length) {
		this.state.tmp.offset_characters += blob.strings.suffix.length;
	}
	curr = this.current.value();
	has_ephemeral = false;
	for (x in this.state.tmp.names_cut.variable) {
		if (this.state.tmp.names_cut.variable.hasOwnProperty(x)) {
			has_ephemeral = x;
			break;
		}
	}
	if (ephemeral && (!has_ephemeral || ephemeral === has_ephemeral)) {
		if (!this.state.tmp.names_cut.variable[ephemeral]) {
			this.state.tmp.names_cut.variable[ephemeral] = [];
			this.state.tmp.names_cut.used = ephemeral;
		}
		this.state.tmp.names_cut.variable[ephemeral].push([curr, curr.blobs.length]);
	}
	curr.push(blob);
	this.current.push(blob);
};
CSL.Output.Queue.prototype.closeLevel = function (name) {
	if (name && name !== this.current.value().levelname) {
		CSL.error("Level mismatch error:  wanted " + name + " but found " + this.current.value().levelname);
	}
	this.current.pop();
};
CSL.Output.Queue.prototype.append = function (str, tokname) {
	var token, blob, curr;
	if ("undefined" === typeof str) {
		return;
	}
	if ("number" === typeof str) {
		str = "" + str;
	}
	if (this.state.tmp.element_trace && this.state.tmp.element_trace.value() === "suppress-me") {
		return;
	}
	blob = false;
	if (!tokname) {
		token = this.formats.value().empty;
	} else if (tokname === "literal") {
		token = true;
	} else if ("string" === typeof tokname) {
		token = this.formats.value()[tokname];
	} else {
		token = tokname;
	}
	if (!token) {
		throw "CSL processor error: unknown format token name: " + tokname;
	}
	if ("string" === typeof str && str.length) {
		this.last_char_rendered = str.slice(-1);
		str = str.replace(/\s+'/g, "  \'").replace(/^'/g, " \'");
		this.state.tmp.term_predecessor = true;
	}
	blob = new CSL.Blob(token, str);
	if (this.state.tmp.count_offset_characters && blob.strings.prefix) {
		this.state.tmp.offset_characters += blob.strings.prefix.length;
	}
	if (this.state.tmp.count_offset_characters && blob.strings.suffix) {
		this.state.tmp.offset_characters += blob.strings.suffix.length;
	}
	curr = this.current.value();
	if ("string" === typeof blob.blobs) {
		this.state.tmp.term_predecessor = true;
	}
	if (this.state.tmp.count_offset_characters) {
		if ("string" === typeof str) {
			this.state.tmp.offset_characters += blob.strings.prefix.length;
			this.state.tmp.offset_characters += blob.strings.suffix.length;
			this.state.tmp.offset_characters += blob.blobs.length;
		} else if ("undefined" !== str.num) {
			this.state.tmp.offset_characters += str.strings.prefix.length;
			this.state.tmp.offset_characters += str.strings.suffix.length;
			this.state.tmp.offset_characters += str.formatter.format(str.num).length;
		}
	}
	this.state.parallel.AppendBlobPointer(curr);
	if ("string" === typeof str) {
		curr.push(blob);
		if (blob.strings["text-case"]) {
			blob.blobs = CSL.Output.Formatters[blob.strings["text-case"]](this.state, str);
		}
		this.state.fun.flipflopper.init(str, blob);
		this.state.fun.flipflopper.processTags();
	} else {
		curr.push(str);
	}
};
CSL.Output.Queue.prototype.string = function (state, myblobs, blob) {
	var blobs, ret, blob_delimiter, i, params, blobjr, last_str, last_char, b, use_suffix, qres, addtoret, span_split, j, res, blobs_start, blobs_end, key, pos, len, ppos, llen, ttype, ltype, terminal, leading, delimiters, use_prefix, txt_esc;
	txt_esc = CSL.Output.Formats[this.state.opt.mode].text_escape;
	blobs = myblobs.slice();
	ret = [];
	if (blobs.length === 0) {
		return ret;
	}
	if (!blob) {
		blob_delimiter = "";
	} else {
		blob_delimiter = blob.strings.delimiter;
	}
	if (blob && blob.new_locale) {
		state.opt.lang = blob.new_locale;
	}
	for (pos = 0, len = blobs.length; pos < len; pos += 1) {
		blobjr = blobs[pos];
		if ("string" === typeof blobjr.blobs) {
			if ("number" === typeof blobjr.num) {
				ret.push(blobjr);
			} else if (blobjr.blobs) {
				b = blobjr.blobs;
				use_suffix = blobjr.strings.suffix;
				use_prefix = blobjr.strings.prefix;
				if (!state.tmp.suppress_decorations) {
					llen = blobjr.decorations.length;
					for (ppos = 0; ppos < llen; ppos += 1) {
						params = blobjr.decorations[ppos];
						b = state.fun.decorate[params[0]][params[1]](state, b);
					}
				}
				if (b && b.length) {
					b = txt_esc(blobjr.strings.prefix) + b + txt_esc(use_suffix);
					ret.push(b);
				}
			}
		} else if (blobjr.blobs.length) {
			addtoret = state.output.string(state, blobjr.blobs, blobjr);
			if (ret.slice(-1)[0] && addtoret.slice(-1)[0]) {
				ttype = typeof ret.slice(-1)[0];
				ltype = typeof addtoret.slice(-1)[0];
				if ("string" === ttype && "string" === ltype) {
					terminal = ret.slice(-1)[0].slice(-1);
					leading = addtoret.slice(-1)[0].slice(0, 1);
				}
			}
			ret = ret.concat(addtoret);
		} else {
			continue;
		}
	}
	span_split = 0;
	len = ret.length;
	for (pos = 0; pos < len; pos += 1) {
		if ("string" === typeof ret[pos]) {
			span_split = (parseInt(pos, 10) + 1);
		}
	}
	if (blob && (blob.decorations.length || blob.strings.suffix || blob.strings.prefix)) {
		span_split = ret.length;
	}
	blobs_start = state.output.renderBlobs(ret.slice(0, span_split), blob_delimiter);
	if (blobs_start && blob && (blob.decorations.length || blob.strings.suffix || blob.strings.prefix)) {
		if (!state.tmp.suppress_decorations) {
			len = blob.decorations.length;
			for (pos = 0; pos < len; pos += 1) {
				params = blob.decorations[pos];
				if (["@bibliography", "@display"].indexOf(params[0]) > -1) {
					continue;
				}
				blobs_start = state.fun.decorate[params[0]][params[1]](state, blobs_start);
			}
		}
		b = blobs_start;
		use_suffix = blob.strings.suffix;
		if (b && b.length) {
			use_prefix = blob.strings.prefix;
			b = txt_esc(use_prefix) + b + txt_esc(use_suffix);
		}
		blobs_start = b;
		if (!state.tmp.suppress_decorations) {
			len = blob.decorations.length;
			for (pos = 0; pos < len; pos += 1) {
				params = blob.decorations[pos];
				if (["@bibliography", "@display"].indexOf(params[0]) === -1) {
					continue;
				}
				blobs_start = state.fun.decorate[params[0]][params[1]](state, blobs_start);
			}
		}
	}
	blobs_end = ret.slice(span_split, ret.length);
	if (!blobs_end.length && blobs_start) {
		ret = [blobs_start];
	} else if (blobs_end.length && !blobs_start) {
		ret = blobs_end;
	} else if (blobs_start && blobs_end.length) {
		ret = [blobs_start].concat(blobs_end);
	}
	if ("undefined" === typeof blob) {
		this.queue = [];
		this.current.mystack = [];
		this.current.mystack.push(this.queue);
		if (state.tmp.suppress_decorations) {
			ret = state.output.renderBlobs(ret);
		}
	} else if ("boolean" === typeof blob) {
		ret = state.output.renderBlobs(ret);
	}
	if (blob && blob.new_locale) {
		state.opt.lang = blob.old_locale;
	}
	if (blob) {
		return ret;
	} else {
		return ret;
	}
};
CSL.Output.Queue.prototype.clearlevel = function () {
	var blob, pos, len;
	blob = this.current.value();
	len = blob.blobs.length;
	for (pos = 0; pos < len; pos += 1) {
		blob.blobs.pop();
	}
};
CSL.Output.Queue.prototype.renderBlobs = function (blobs, delim) {
	var state, ret, ret_last_char, use_delim, i, blob, pos, len, ppos, llen, pppos, lllen, res, str, params, txt_esc;
	txt_esc = CSL.Output.Formats[this.state.opt.mode].text_escape;
	if (!delim) {
		delim = "";
	}
	state = this.state;
	ret = "";
	ret_last_char = [];
	use_delim = "";
	len = blobs.length;
	for (pos = 0; pos < len; pos += 1) {
		if (blobs[pos].checkNext) {
			blobs[pos].checkNext(blobs[(pos + 1)]);
		}
	}
	var doit = true;
	for (pos = blobs.length - 1; pos > 0; pos += -1) {
	    if (blobs[pos].checkLast) {
		if (doit && blobs[pos].checkLast(blobs[pos - 1])) {
		    doit = false;
		}
	    } else {
		doit = true;
	    }
	}
	len = blobs.length;
	for (pos = 0; pos < len; pos += 1) {
		blob = blobs[pos];
		if (ret) {
			use_delim = delim;
		}
		if (blob && "string" === typeof blob) {
			ret += txt_esc(use_delim);
			ret += blob;
		} else if (blob.status !== CSL.SUPPRESS) {
			str = blob.formatter.format(blob.num, blob.gender);
			if (blob.strings["text-case"]) {
				str = CSL.Output.Formatters[blob.strings["text-case"]](this.state, str);
			}
			if (!state.tmp.suppress_decorations) {
				llen = blob.decorations.length;
				for (ppos = 0; ppos < llen; ppos += 1) {
					params = blob.decorations[ppos];
					str = state.fun.decorate[params[0]][params[1]](state, str);
				}
			}
			str = blob.strings.prefix + str + blob.strings.suffix;
			if (blob.status === CSL.END) {
				ret += blob.range_prefix;
			} else if (blob.status === CSL.SUCCESSOR) {
				ret += blob.successor_prefix;
			} else if (blob.status === CSL.START) {
				ret += "";
			} else if (blob.status === CSL.SEEN) {
				ret += blob.splice_prefix;
			}
			ret += str;
		}
	}
	return ret;
};
CSL.Output.Queue.purgeEmptyBlobs = function (myblobs, endOnly) {
	var res, j, jlen, tmpblobs;
	if ("string" === typeof myblobs || !myblobs.length) {
		return;
	}
	for (var i = myblobs.length - 1; i > -1; i += -1) {
		CSL.Output.Queue.purgeEmptyBlobs(myblobs[i].blobs);		
	}
	for (var i = myblobs.length - 1; i > -1; i += -1) {
		if (!myblobs[i].blobs.length) {
			tmpblobs = myblobs.slice(i + 1);
			for (j = i, jlen = myblobs.length; j < jlen; j += 1) {
				myblobs.pop();
			}
			for (j = 0, jlen = tmpblobs.length; j < jlen; j += 1) {
				myblobs.push(tmpblobs[j]);
			}
		} else if (endOnly) {
			break;
		}
	}
}
CSL.Output.Queue.purgeNearsidePrefixChars = function(myblob, chr) {
	if (!chr) {
		return;
	}
	if ("object" === typeof myblob) {
		if ((CSL.TERMINAL_PUNCTUATION.indexOf(chr) > -1 && 
			 CSL.TERMINAL_PUNCTUATION.slice(0, -1).indexOf(myblob.strings.prefix.slice(0, 1)) > -1)) {
			myblob.strings.prefix = myblob.strings.prefix.slice(1);
		} else if ("object" === typeof myblob.blobs) {
			CSL.Output.Queue.purgeNearsidePrefixChars(myblob.blobs[0], chr);
		}
	}
}
CSL.Output.Queue.purgeNearsidePrefixSpaces = function(myblob, chr) {
	if ("object" === typeof myblob) {
		if (" " === chr && " " === myblob.strings.prefix.slice(0, 1)) {
			myblob.strings.prefix = myblob.strings.prefix.slice(1);
		} else if ("object" === typeof myblob.blobs) {
			CSL.Output.Queue.purgeNearsidePrefixSpaces(myblob.blobs[0], chr);
		}
	}
}
CSL.Output.Queue.purgeNearsideSuffixSpaces = function(myblob, chr) {
	if ("object" === typeof myblob) {
		if (" " === chr && " " === myblob.strings.suffix.slice(-1)) {
			myblob.strings.suffix = myblob.strings.suffix.slice(0, -1);
		} else if ("object" === typeof myblob.blobs) {
			if (!chr) {
				chr = myblob.strings.suffix.slice(-1);
			}
			chr = CSL.Output.Queue.purgeNearsideSuffixSpaces(myblob.blobs[myblob.blobs.length - 1], chr);
		} else {
			chr = myblob.strings.suffix.slice(-1);
		}
	}
	return chr;
}
CSL.Output.Queue.adjustPunctuation = function (state, myblobs, stk, finish) {
	var chr, suffix, dpref, blob, delimiter, suffixX, dprefX, blobX, delimiterX, prefix, prefixX, dsuffX, dsuff, slast, dsufff, dsufffX, lastchr, firstchr, chr, exposed_suffixes, exposed;
	var TERMS = CSL.TERMINAL_PUNCTUATION.slice(0, -1);
	var TERM_OR_SPACE = CSL.TERMINAL_PUNCTUATION;
	var SWAPS = CSL.SWAPPING_PUNCTUATION;
	if (!stk) {
		stk = [{suffix: "", delimiter: ""}];
	}
	slast = stk.length - 1;
	delimiter = stk[slast].delimiter;
	dpref = stk[slast].dpref;
	dsuff = stk[slast].dsuff;
	dsufff = stk[slast].dsufff;
	prefix = stk[slast].prefix;
	suffix = stk[slast].suffix;
	blob = stk[slast].blob;
	if ("string" === typeof myblobs) {
		if (suffix) {
			if (blob && 
				TERMS.indexOf(myblobs.slice(-1)) > -1 &&
				TERMS.indexOf(suffix) > -1) {
					blob.strings.suffix = blob.strings.suffix.slice(1);
			}
		}
		lastchr = myblobs.slice(-1);
		firstchr = myblobs.slice(0,1);
	} else {
		if (dpref) {
			for (var j = 0, jlen = myblobs.length - 1; j < jlen; j += 1) {
				var t = myblobs[j].strings.suffix.slice(-1);
				if (TERMS.indexOf(t) === -1 ||
				    TERMS.indexOf(dpref) === -1) {
					if (dpref !== " " || dpref !== myblobs[j].strings.suffix.slice(-1)) {
						myblobs[j].strings.suffix += dpref;						
					}
				}
			}
		}
		if (suffix === " ") {
			CSL.Output.Queue.purgeNearsideSuffixSpaces(myblobs[myblobs.length - 1], " ");
		}
		var lst = [];
		for (var i = 0, ilen = myblobs.length - 1; i < ilen; i += 1) {
			var doblob = myblobs[i];
			var following_prefix = myblobs[i + 1].strings.prefix;
			var chr = false;
			var ret = CSL.Output.Queue.purgeNearsideSuffixSpaces(doblob, chr);
			if (!dsuff) {
				lst.push(ret);
			} else {
				lst.push(false);
			}
		}
		chr = false;
		for (var i = 1, ilen = myblobs.length; i < ilen; i += 1) {
			var doblob = myblobs[i];
			var chr = "";
			var preceding_suffix = myblobs[i - 1].strings.suffix;
			if (dsuff === " ") {
				chr = dsuff;
			} else if (preceding_suffix) {
				chr = preceding_suffix.slice(-1);
			} else if (lst[i - 1]) {
				chr = lst[i - 1];
			}
			CSL.Output.Queue.purgeNearsidePrefixSpaces(doblob, chr);
		}
		if (dsufff) {
			CSL.Output.Queue.purgeNearsidePrefixSpaces(myblobs[0], " ");
		} else if (prefix === " ") {
			CSL.Output.Queue.purgeNearsidePrefixSpaces(myblobs[0], " ");
		}
		for (var i = 0, ilen = myblobs.length; i < ilen; i += 1) {
			var doblob = myblobs[i];
			CSL.Output.Queue.purgeNearsidePrefixChars(doblob, lastchr);
			if (i === 0) {
				if (prefix) {
					if (doblob.strings.prefix.slice(0, 1) === " ") {
					}
				}
			}
			if (dsufff) {
				if (doblob.strings.prefix) {
					if (i === 0) {
						if (doblob.strings.prefix.slice(0, 1) === " ") {
						}
					}
				}
			}
			if (dsuff) {
				if (i > 0) {
					if (doblob.strings.prefix.slice(0, 1) === " ") {
					}
				}
			}
			if (i < (myblobs.length - 1)) {
				var nextprefix = myblobs[i + 1].strings.prefix;
				if (!delimiter) {
					if (nextprefix) {
						var nxtchr = nextprefix.slice(0, 1);
						if (SWAPS.indexOf(nxtchr) > -1) {
							myblobs[i + 1].strings.prefix = nextprefix.slice(1);
							if (TERMS.indexOf(nxtchr) === -1 ||
								(TERMS.indexOf(nxtchr) > -1 &&
								 TERMS.indexOf(doblob.strings.suffix.slice(-1)) === -1)) {
									 doblob.strings.suffix += nxtchr;
							}
						} else if (nxtchr === " " &&
									doblob.strings.suffix.slice(-1) === " ") {
							doblob.strings.suffix = doblob.strings.suffix.slice(0, -1);
						}
					}
				}
			}
			if (i === (myblobs.length - 1)) {
				if (suffix) {
					if (doblob.strings.suffix && 
						 (TERMS.indexOf(suffix) > -1 &&
						  TERMS.indexOf(doblob.strings.suffix.slice(-1)) > -1)) {
							blob.strings.suffix = blob.strings.suffix.slice(1);
					}
				}
			}
			if ("string" === typeof doblob.blobs && doblob.blobs) {
				for (var ppos = doblob.decorations.length - 1; ppos > -1; ppos += -1) {
					var params = doblob.decorations[ppos];
					if (params[0] === "@strip-periods" && params[1] === "true") {
						doblob.blobs = state.fun.decorate[params[0]][params[1]](state, doblob.blobs);
						doblob.decorations = doblob.decorations.slice(0, ppos).concat(doblob.decorations.slice(ppos + 1));
					}
				}
			}
			if (state.getOpt('punctuation-in-quote')) {
				var decorations = doblob.decorations;
				for (var j = 0, jlen = decorations.length; j < jlen; j += 1) {
					if (decorations[j][0] === '@quotes' && decorations[j][1] === 'true') {
						var swapchar = doblob.strings.suffix.slice(0, 1);
						var swapblob = false;
						if (SWAPS.indexOf(swapchar) > -1) {
							swapblob = doblob;
						} else if (SWAPS.indexOf(suffix) > -1 && i === (myblobs.length - 1)) {
							swapchar = suffix;
							swapblob = blob;
						} else {
							swapchar = false;
						}
						if (swapchar) {
							if ("string" === typeof doblob.blobs) {
								if (SWAPS.indexOf(doblob.blobs.slice(-1)) === -1 ||
								   (TERMS.indexOf(doblob.blobs.slice(-1)) > -1 &&
									SWAPS.indexOf(swapchar) > -1 &&
									TERMS.indexOf(swapchar) === -1)) {
										doblob.blobs += swapchar;
								}
							} else {
								if (SWAPS.indexOf(doblob.blobs.slice(-1)[0].strings.suffix.slice(-1)) === -1 ||
									(TERMS.indexOf(doblob.blobs.slice(-1)[0].strings.suffix.slice(-1)) > -1 &&
									 SWAPS.indexOf(swapchar) > -1 &&
									 TERMS.indexOf(swapchar) === -1)) {
										 doblob.blobs.slice(-1)[0].strings.suffix += swapchar;
								}
							}
							swapblob.strings.suffix = swapblob.strings.suffix.slice(1);
						}
					}
				}
			}
			if (i === (myblobs.length - 1)) {
				if (doblob.strings.suffix) {
					suffixX = doblob.strings.suffix.slice(0, 1);
					blobX = doblob;
				} else {
					suffixX = stk[stk.length - 1].suffix;
					blobX = stk[stk.length - 1].blob;
				}
			} else {
				if (doblob.strings.suffix) {
					suffixX = doblob.strings.suffix.slice(0, 1);
					blobX = doblob;
  				} else {
					suffixX = "";
					blobX = false;
				}
			}
			if (SWAPS.concat([" "]).indexOf(suffixX) === -1) {
				suffixX = "";
				blobX = false;
			}
			if (doblob.strings.delimiter && 
				doblob.blobs.length > 1) {
				dprefX = doblob.strings.delimiter.slice(0, 1);
				if (SWAPS.concat([" "]).indexOf(dprefX) > -1) {
					doblob.strings.delimiter = doblob.strings.delimiter.slice(1);
				} else {
					dprefX = "";
				}
			} else {
				dprefX = "";
			}
			if (doblob.strings.prefix) {
				if (doblob.strings.prefix.slice(-1) === " ") {
					prefixX = " ";
				} else {
					prefixX = "";
				}
			} else {
				if (i === 0) {
					prefixX = prefix;					
				} else {
					prefixX = "";
				}
			}
			if (dsuff) {
				dsufffX = dsuff;
			} else {
				if (i === 0) {
					dsufffX = dsufff;					
				} else {
					dsufffX = "";
				}
			}
			if (doblob.strings.delimiter) {
				if (doblob.strings.delimiter.slice(-1) === " " &&
					"object" === typeof doblob.blobs && doblob.blobs.length > 1) {
					   dsuffX = doblob.strings.delimiter.slice(-1);
				} else {
					dsuffX = "";						
				}
			} else {
				dsuffX = "";					
			}
			delimiterX = doblob.strings.delimiter;
			stk.push({suffix: suffixX, dsuff:dsuffX, blob:blobX, delimiter:delimiterX, prefix:prefixX, dpref: dprefX, dsufff: dsufffX});
			lastchr = CSL.Output.Queue.adjustPunctuation(state, doblob.blobs, stk);
		}
		if (myblobs && myblobs.length) {
			var last_suffix = myblobs[myblobs.length - 1].strings.suffix;
			if (last_suffix) {
				lastchr = last_suffix.slice(-1);
			}
		}
	}
	if (stk.length > 1) {
		stk.pop();
	}
	state.tmp.last_chr = lastchr;
	return lastchr;
};
CSL.substituteOne = function (template) {
	return function (state, list) {
		if (!list) {
			return "";
		} else {
			return template.replace("%%STRING%%", list);
		}
	};
};
CSL.substituteTwo = function (template) {
	return function (param) {
		var template2 = template.replace("%%PARAM%%", param);
		return function (state, list) {
			if (!list) {
				return "";
			} else {
				return template2.replace("%%STRING%%", list);
			}
		};
	};
};
CSL.Mode = function (mode) {
	var decorations, params, param, func, val, args;
	decorations = {};
	params = CSL.Output.Formats[mode];
	for (param in params) {
		if (true) {
			if ("@" !== param.slice(0, 1)) {
				decorations[param] = params[param];
				continue;
			}
			func = false;
			val = params[param];
			args = param.split('/');
			if (typeof val === "string" && val.indexOf("%%STRING%%") > -1)  {
				if (val.indexOf("%%PARAM%%") > -1) {
					func = CSL.substituteTwo(val);
				} else {
					func = CSL.substituteOne(val);
				}
			} else if (typeof val === "boolean" && !val) {
				func = CSL.Output.Formatters.passthrough;
			} else if (typeof val === "function") {
				func = val;
			} else {
				throw "CSL.Compiler: Bad " + mode + " config entry for " + param + ": " + val;
			}
			if (args.length === 1) {
				decorations[args[0]] = func;
			} else if (args.length === 2) {
				if (!decorations[args[0]]) {
					decorations[args[0]] = {};
				}
				decorations[args[0]][args[1]] = func;
			}
		}
	}
	return decorations;
};
CSL.setDecorations = function (state, attributes) {
	var ret, key, pos;
	ret = [];
	for (pos in CSL.FORMAT_KEY_SEQUENCE) {
		if (true) {
			key = CSL.FORMAT_KEY_SEQUENCE[pos];
			if (attributes[key]) {
				ret.push([key, attributes[key]]);
				delete attributes[key];
			}
		}
	}
	return ret;
};
CSL.compareAmbigConfig = function(a, b) {
	var ret, pos, len, ppos, llen;
	if (a.names.length !== b.names.length) {
		return 1;
	} else {
		for (pos = 0, len = a.names.length; pos < len; pos += 1) {
			if (a.names[pos] !== b.names[pos]) {
				return 1;
			} else {
				for (ppos = 0, llen = a.names[pos]; ppos < llen; ppos += 1) {
					if (a.givens[pos][ppos] !== b.givens[pos][ppos]) {
						return 1;
					}
				}
			}
		}
	}
	return 0;
};
CSL.cloneAmbigConfig = function (config, oldconfig, tainters) {
	var ret, param, pos, ppos, len, llen;
	ret = {};
	ret.names = [];
	ret.givens = [];
	ret.year_suffix = false;
	ret.disambiguate = false;
	for (pos = 0, len = config.names.length; pos < len; pos += 1) {
		param = config.names[pos];
		if (oldconfig && (!oldconfig.names[pos] || oldconfig.names[pos] !== param)) {
			for (ppos = 0, llen = tainters.length; ppos < llen; ppos += 1) {
				this.tmp.taintedItemIDs[tainters[ppos].id] = true;
			}
			oldconfig = false;
		}
		ret.names[pos] = param;
	}
	for (pos = 0, len = config.givens.length; pos < len; pos += 1) {
		param = [];
		llen = config.givens[pos].length;
		for (ppos = 0; ppos < llen; ppos += 1) {
			if (oldconfig && oldconfig.givens[pos][ppos] !== config.givens[pos][ppos]) {
				for (ppos = 0, llen = tainters.length; ppos < llen; ppos += 1) {
					this.tmp.taintedItemIDs[tainters[ppos].id] = true;
				}
				oldconfig = false;
			}
			param.push(config.givens[pos][ppos]);
		}
		ret.givens.push(param);
	}
	if (tainters && tainters.length > 1) {
		if (tainters.length == 2 || (oldconfig && oldconfig.year_suffix !== config.year_suffix)) {
			for (pos = 0, len = tainters.length; pos < len; pos += 1) {
				var oldYS = this.registry.registry[tainters[pos].id].disambig.year_suffix;
				if (tainters && (false === oldYS || oldYS != pos)) {
					this.tmp.taintedItemIDs[tainters[pos].id] = true;
				}
			}
			oldconfig = false;
		}
	}
	ret.year_suffix = config.year_suffix;
	ret.disambiguate = config.disambiguate;
	return ret;
};
CSL.getAmbigConfig = function () {
	var config, ret;
	config = this.tmp.disambig_request;
	if (!config) {
		config = this.tmp.disambig_settings;
	}
	ret = CSL.cloneAmbigConfig(config);
	return ret;
};
CSL.getMaxVals = function () {
	return this.tmp.names_max.mystack.slice();
};
CSL.getMinVal = function () {
	return this.tmp["et-al-min"];
};
CSL.tokenExec = function (token, Item, item) {
	var next, maybenext, exec, pos, len, debug;
	debug = false;
    next = token.next;
	maybenext = false;
	if (token.evaluator) {
	    next = token.evaluator(token, this, Item, item);
    }
	len = token.execs.length;
	for (pos = 0; pos < len; pos += 1) {
		exec = token.execs[pos];
		maybenext = exec.call(token, this, Item, item);
		if (maybenext) {
			next = maybenext;
		}
	}
	if (false) {
		CSL.debug(token.name + " (" + token.tokentype + ") ---> done");
	}
	return next;
};
CSL.expandMacro = function (macro_key_token) {
	var mkey, start_token, key, end_token, navi, macroxml, newoutput, mergeoutput, end_of_macro;
	mkey = macro_key_token.postponed_macro;
	if (this.build.macro_stack.indexOf(mkey) > -1) {
		throw "CSL processor error: call to macro \"" + mkey + "\" would cause an infinite loop";
	} else {
		this.build.macro_stack.push(mkey);
	}
	macro_key_token.tokentype = CSL.START;
	CSL.Node.group.build.call(macro_key_token, this, this[this.build.area].tokens, true);
	macroxml = this.sys.xml.getNodesByName(this.cslXml, 'macro', mkey);
	if (!this.sys.xml.getNodeValue(macroxml)) {
		throw "CSL style error: undefined macro \"" + mkey + "\"";
	}
	navi = new this.getNavi(this, macroxml);
	CSL.buildStyle.call(this, navi);
	end_of_macro = new CSL.Token("group", CSL.END);
	CSL.Node.group.build.call(end_of_macro, this, this[this.build.area].tokens, true);
	this.build.macro_stack.pop();
};
CSL.XmlToToken = function (state, tokentype) {
	var name, txt, attrfuncs, attributes, decorations, token, key, target;
	name = state.sys.xml.nodename(this);
	if (state.build.skip && state.build.skip !== name) {
		return;
	}
	if (!name) {
		txt = state.sys.xml.content(this);
		if (txt) {
			state.build.text = txt;
		}
		return;
	}
	if (!CSL.Node[state.sys.xml.nodename(this)]) {
		throw "Undefined node name \"" + name + "\".";
	}
	attrfuncs = [];
	attributes = state.sys.xml.attributes(this);
	decorations = CSL.setDecorations.call(this, state, attributes);
	token = new CSL.Token(name, tokentype);
	if (tokentype !== CSL.END || name === "if" || name === "else-if" || name === "layout") {
		for (key in attributes) {
			if (tokentype === CSL.END && key !== "@language" && key !== "@locale") {
				continue;
			}
			if (attributes.hasOwnProperty(key)) {
				try {
					CSL.Attributes[key].call(token, state, "" + attributes[key]);
				} catch (e) {
					if (e === "TypeError: Cannot call method \"call\" of undefined") {
						throw "Unknown attribute \"" + key + "\" in node \"" + name + "\" while processing CSL file";
					} else {
						throw "CSL processor error, " + key + " attribute: " + e;
					}
				}
			}
		}
		token.decorations = decorations;
	}
	target = state[state.build.area].tokens;
	CSL.Node[name].build.call(token, state, target);
};
CSL.DateParser = function (txt) {
	var jiy_list, jiy, jiysplitter, jy, jmd, jr, pos, key, val, yearlast, yearfirst, number, rangesep, fuzzychar, chars, rex, rexdash, rexdashslash, rexslashdash, seasonstrs, seasonrexes, seasonstr, monthstrs, monthstr, mrexes, seasonrex, len, jiymatchstring, jiymatcher;
	jiy_list = [
		["\u660E\u6CBB", 1867],
		["\u5927\u6B63", 1911],
		["\u662D\u548C", 1925],
		["\u5E73\u6210", 1988]
	];
	jiy = {};
	len = jiy_list.length;
	for (pos = 0; pos < len; pos += 1) {
		key = jiy_list[pos][0];
		val = jiy_list[pos][1];
		jiy[key] = val;
	}
	jiymatchstring = [];
	for (pos = 0; pos < len; pos += 1) {
		val = jiy_list[pos][0];
		jiymatchstring.push(val);
	}
	jiymatchstring = jiymatchstring.join("|");
	jiysplitter = "(?:" + jiymatchstring + ")(?:[0-9]+)";
	jiysplitter = new RegExp(jiysplitter);
	jiymatcher = "(?:" + jiymatchstring + ")(?:[0-9]+)";
	jiymatcher = new RegExp(jiymatcher, "g");
	jmd = /(\u6708|\u5E74)/g;
	jy = /\u65E5/;
	jr = /\u301c/g;
	yearlast = "(?:[?0-9]{1,2}%%NUMD%%){0,2}[?0-9]{4}(?![0-9])";
	yearfirst = "[?0-9]{4}(?:%%NUMD%%[?0-9]{1,2}){0,2}(?![0-9])";
	number = "[?0-9]{1,3}";
	rangesep = "[%%DATED%%]";
	fuzzychar = "[?~]";
	chars = "[a-zA-Z]+";
	rex = "(" + yearfirst + "|" + yearlast + "|" + number + "|" + rangesep + "|" + fuzzychar + "|" + chars + ")";
	rexdash = new RegExp(rex.replace(/%%NUMD%%/g, "-").replace(/%%DATED%%/g, "-"));
	rexdashslash = new RegExp(rex.replace(/%%NUMD%%/g, "-").replace(/%%DATED%%/g, "\/"));
	rexslashdash = new RegExp(rex.replace(/%%NUMD%%/g, "\/").replace(/%%DATED%%/g, "-"));
	seasonstrs = [];
	seasonrexes = [];
	len = seasonstrs.length;
	for (pos = 0; pos < len; pos += 1) {
		seasonrex = new RegExp(seasonstrs[pos] + ".*");
		seasonrexes.push(seasonrex);
	}
	this.mstrings = "january february march april may june july august september october november december spring summer fall winter spring summer";
	this.mstrings = this.mstrings.split(" ");
	this.setOrderDayMonth = function() {
		this.monthguess = 1;
		this.dayguess = 0;
	}
	this.setOrderMonthDay = function() {
		this.monthguess = 0;
		this.dayguess = 1;
	}
	this.setOrderMonthDay();
	this.resetMonths = function() {
		this.msets = [];
		for (var i = 0, ilen = this.mstrings.length; i < ilen; i += 1) {
			this.msets.push([this.mstrings[i]]);
		}
		this.mabbrevs = [];
		for (var i = 0, ilen = this.msets.length; i < ilen; i += 1) {
			this.mabbrevs.push([]);
			for (var j = 0, jlen = this.msets[i].length; j < jlen; j += 1) {
				this.mabbrevs[i].push(this.msets[i][0].slice(0, 3));
			}
		}
		this.mrexes = [];
		for (var i = 0, ilen = this.mabbrevs.length; i < ilen; i += 1) {
			this.mrexes.push(new RegExp("(?:" + this.mabbrevs[i].join("|") + ")"));
		}
	}
	this.resetMonths();
	this.addMonths = function(lst) {
		if ("string" === typeof lst) {
			lst = lst.split(/\s+/);
		}
		if (lst.length !== 12 && lst.length !== 16) {
			CSL.debug("month [+season] list of "+lst.length+", expected 12 or 16. Ignoring.");
			return;
		}
		var othermatch = [];
		var thismatch = [];
		for (var i = 0, ilen = lst.length; i < ilen; i += 1) {
			var abbrevlen = false;
			var skip = false;
			var insert = 3;
			var extend = {};
			for (var j = 0, jlen = this.mabbrevs.length; j < jlen; j += 1) {
				extend[j] = {};
				if (j === i) {
					for (var k = 0, klen = this.mabbrevs[i].length; k < klen; k += 1) {
						if (this.mabbrevs[i][k] === lst[i].slice(0, this.mabbrevs[i][k].length)) {
							skip = true;
							break;
						}
					}
				} else {
					for (var k = 0, klen = this.mabbrevs[j].length; k < klen; k += 1) {
						abbrevlen = this.mabbrevs[j][k].length;
						if (this.mabbrevs[j][k] === lst[i].slice(0, abbrevlen)) {
							while (this.msets[j][k].slice(0, abbrevlen) === lst[i].slice(0, abbrevlen)) {
								if (abbrevlen > lst[i].length || abbrevlen > this.msets[j][k].length) {
									CSL.debug("unable to disambiguate month string in date parser: "+lst[i]);
									break;
								} else {
									abbrevlen += 1;
								}
							}
							insert = abbrevlen;
							extend[j][k] = abbrevlen;
						}
					}
				}
				for (var j in extend) {
					j = parseInt(j, 10);
					for (var k in extend[j]) {
						k = parseInt(k, 10);
						abbrevlen = extend[j][k];
						this.mabbrevs[j][k] = this.msets[j][k].slice(0, abbrevlen);
					}
				}
			}
			if (!skip) {
				this.msets[i].push(lst[i]);
				this.mabbrevs[i].push(lst[i].slice(0, insert));
			}
		}
		this.mrexes = [];
		for (var i = 0, ilen = this.mabbrevs.length; i < ilen; i += 1) {
			this.mrexes.push(new RegExp("(?:" + this.mabbrevs[i].join("|") + ")"));
		}
	}
	this.parse = function (txt) {
		var slash, dash, lst, l, m, number, note, thedate, slashcount, range_delim, date_delim, ret, delim_pos, delims, isrange, suff, date, breakme, item, delim, element, mm, slst, mmpos, i, ilen, j, jlen, k, klen;
		m = txt.match(jmd);
		if (m) {
			txt = txt.replace(jy, "");
			txt = txt.replace(jmd, "-");
			txt = txt.replace(jr, "/");
			txt = txt.replace("-/", "/");
			txt = txt.replace(/-$/,"");
			slst = txt.split(jiysplitter);
			lst = [];
			mm = txt.match(jiymatcher);
			var mmx = [];
			for (pos = 0, len = mm.length; pos < len; pos += 1) {
				mmx = mmx.concat(mm[pos].match(/([^0-9]+)([0-9]+)/).slice(1));
			}
			for (pos = 0, len = slst.length; pos < len; pos += 1) {
				lst.push(slst[pos]);
				if (pos !== (len - 1)) {
					mmpos = (pos * 2);
					lst.push(mmx[mmpos]);
					lst.push(mmx[mmpos + 1]);
				}
			}
			l = lst.length;
			for	(pos = 1; pos < l; pos += 3) {
				lst[pos + 1] = jiy[lst[pos]] + parseInt(lst[pos + 1], 10);
				lst[pos] = "";
			}
			txt = lst.join("");
			txt = txt.replace(/\s*-\s*$/, "").replace(/\s*-\s*\//, "/");
			txt = txt.replace(/\.\s*$/, "");
			txt = txt.replace(/\.(?! )/, "");
			slash = txt.indexOf("/");
			dash = txt.indexOf("-");
		}
		txt = txt.replace(/([A-Za-z])\./g, "$1");
		number = "";
		note = "";
		thedate = {};
		if (txt.slice(0, 1) === "\"" && txt.slice(-1) === "\"") {
			thedate.literal = txt.slice(1, -1);
			return thedate;
		}
		if (slash > -1 && dash > -1) {
			slashcount = txt.split("/");
			if (slashcount.length > 3) {
				range_delim = "-";
				date_delim = "/";
				lst = txt.split(rexslashdash);
			} else {
				range_delim = "/";
				date_delim = "-";
				lst = txt.split(rexdashslash);
			}
		} else {
			txt = txt.replace("/", "-");
			range_delim = "-";
			date_delim = "-";
			lst = txt.split(rexdash);
		}
		ret = [];
		len = lst.length;
		for (pos = 0; pos < len; pos += 1) {
			item = lst[pos];
			m = item.match(/^\s*([\-\/]|[a-zA-Z]+|[\-~?0-9]+)\s*$/);
			if (m) {
				ret.push(m[1]);
			}
		}
		delim_pos = ret.indexOf(range_delim);
		delims = [];
		isrange = false;
		if (delim_pos > -1) {
			delims.push([0, delim_pos]);
			delims.push([(delim_pos + 1), ret.length]);
			isrange = true;
		} else {
			delims.push([0, ret.length]);
		}
		suff = "";
		for (i = 0, ilen = delims.length; i < ilen; i += 1) {
			delim = delims[i];
			date = ret.slice(delim[0], delim[1]);
			for (j = 0, jlen = date.length; j < jlen; j += 1) {
				element = date[j];
				if (element.indexOf(date_delim) > -1) {
					this.parseNumericDate(thedate, date_delim, suff, element);
					continue;
				}
				if (element.match(/[0-9]{4}/)) {
					thedate[("year" + suff)] = element.replace(/^0*/, "");
					continue;
				}
				breakme = false;
				for (k = 0, klen = this.mrexes.length; k < klen; k += 1) {
					if (element.toLocaleLowerCase().match(this.mrexes[k])) {
						thedate[("month" + suff)] = "" + (parseInt(k, 10) + 1);
						breakme = true;
						break;
					}
					if (breakme) {
						continue;
					}
					if (element.match(/^[0-9]+$/)) {
						number = parseInt(element, 10);
					}
					if (element.toLocaleLowerCase().match(/^bc/) && number) {
						thedate[("year" + suff)] = "" + (number * -1);
						number = "";
						continue;
					}
					if (element.toLocaleLowerCase().match(/^ad/) && number) {
						thedate[("year" + suff)] = "" + number;
						number = "";
						continue;
					}
				}
				breakme = false;
				lllen = seasonrexes.length;
				for (k = 0, klen = seasonrexes.length; k < klen; k += 1) {
					if (element.toLocaleLowerCase().match(seasonrexes[k])) {
						thedate[("season" + suff)] = "" + (parseInt(k, 10) + 1);
						breakme = true;
						break;
					}
				}
				if (breakme) {
					continue;
				}
				if (element === "~" || element === "?" || element === "c" || element.match(/^cir/)) {
					thedate.circa = "" + 1;
					continue;
				}
				if (element.toLocaleLowerCase().match(/(?:mic|tri|hil|eas)/) && !thedate[("season" + suff)]) {
					note = element;
					continue;
				}
			}
			if (number) {
				thedate[("day" + suff)] = number;
				number = "";
			}
			if (note && !thedate[("season" + suff)]) {
				thedate[("season" + suff)] = note;
				note = "";
			}
			suff = "_end";
		}
		if (isrange) {
			for (j = 0, jlen = CSL.DATE_PARTS_ALL.length; j < jlen; j += 1) {
				item = CSL.DATE_PARTS_ALL[j];
				if (thedate[item] && !thedate[(item + "_end")]) {
					thedate[(item + "_end")] = thedate[item];
				} else if (!thedate[item] && thedate[(item + "_end")]) {
					thedate[item] = thedate[(item + "_end")];
				}
			}
		}
		if (!thedate.year) {
			thedate = { "literal": txt };
		}
		if (this.use_array) {
			this.toArray(thedate);			
		}
		return thedate;
	};
	this.returnAsArray = function () {
		this.use_array = true;
	}
	this.returnAsKeys = function () {
		this.use_array = false;
	}
	this.toArray = function (thedate) {
		thedate["date-parts"] = [];
		thedate["date-parts"].push([]);
		var slicelen = 0;
		for (var i = 0, ilen = 3; i < ilen; i += 1) {
			var part = ["year", "month", "day"][i];
			if (!thedate[part]) {
				break;
			}
			slicelen += 1;
			thedate["date-parts"][0].push(thedate[part]);
			delete thedate[part];
		}
		for (var i = 0, ilen = slicelen; i < ilen; i += 1) {
			var part = ["year_end", "month_end", "day_end"][i];
			if (thedate[part] && thedate["date-parts"].length === 1) {
				thedate["date-parts"].push([]);
			}
			thedate["date-parts"][1].push(thedate[part]);
			delete thedate[part];
		}
	}
	this.parseNumericDate = function (ret, delim, suff, txt) {
		var lst, pos, len;
		lst = txt.split(delim);
		for (i = 0, ilen = lst.length; i < ilen; i += 1) {
			if (lst[i].length === 4) {
				ret[("year" + suff)] = lst[i].replace(/^0*/, "");
				if (!i) {
					lst = lst.slice(1);
				} else {
					lst = lst.slice(0, i);
				}
				break;
			}
		}
		for (i = 0, ilen = lst.length; i < ilen; i += 1) {
			lst[i] = parseInt(lst[i], 10);
		}
		if (lst.length === 1) {
			ret[("month" + suff)] = "" + lst[0];
		} else if (lst.length === 2) {
			if (lst[this.monthguess] > 12) {
				ret[("month" + suff)] = "" + lst[this.dayguess];
				ret[("day" + suff)] = "" + lst[this.monthguess];
			} else {
				ret[("month" + suff)] = "" + lst[this.monthguess];
				ret[("day" + suff)] = "" + lst[this.dayguess];
			}
		}
	};
};
CSL.Engine = function (sys, style, lang, forceLang) {
	var attrs, langspec, localexml, locale;
	this.processor_version = "1.0.108";
	this.csl_version = "1.0";
	this.sys = sys;
	this.sys.xml = new CSL.System.Xml.Parsing();
	if ("string" !== typeof style) {
		style = "";
	}
	this.parallel = new CSL.Parallel(this);
	this.transform = new CSL.Transform(this);
	this.setAbbreviations = function (nick) {
		this.transform.setAbbreviations(nick);
	};
	this.setParseNames = function (val) {
		this.opt['parse-names'] = val;
	};
	this.opt = new CSL.Engine.Opt();
	this.tmp = new CSL.Engine.Tmp();
	this.build = new CSL.Engine.Build();
	this.fun = new CSL.Engine.Fun();
	this.configure = new CSL.Engine.Configure();
	this.citation_sort = new CSL.Engine.CitationSort();
	this.bibliography_sort = new CSL.Engine.BibliographySort();
	this.citation = new CSL.Engine.Citation(this);
	this.bibliography = new CSL.Engine.Bibliography();
	this.output = new CSL.Output.Queue(this);
	this.dateput = new CSL.Output.Queue(this);
	this.cslXml = this.sys.xml.makeXml(style);
	this.sys.xml.addInstitutionNodes(this.cslXml);
	attrs = this.sys.xml.attributes(this.cslXml);
	if ("undefined" === typeof attrs["@sort-separator"]) {
		this.sys.xml.setAttribute(this.cslXml, "sort-separator", ", ");
	}
	if ("undefined" === typeof attrs["@name-delimiter"]) {
		this.sys.xml.setAttribute(this.cslXml, "name-delimiter", ", ");
	}
	this.opt["initialize-with-hyphen"] = true;
	this.setStyleAttributes();
	CSL.Util.Names.initNameSlices(this);
	this.opt.xclass = sys.xml.getAttributeValue(this.cslXml, "class");
	if (lang) {
		lang = lang.replace("_", "-");
	}
	if (this.opt["default-locale"][0]) {
		this.opt["default-locale"][0] = this.opt["default-locale"][0].replace("_", "-");
	}
	if (lang && forceLang) {
		this.opt["default-locale"] = [lang];
	}
	if (lang && !forceLang && this.opt["default-locale"][0]) {
		lang = this.opt["default-locale"][0];
	}
	if (this.opt["default-locale"].length === 0) {
		if (!lang) {
			lang = "en-US";
		}
		this.opt["default-locale"].push("en-US");
	}
	if (!lang) {
		lang = this.opt["default-locale"][0];
	}
	langspec = CSL.localeResolve(lang);
	this.opt.lang = langspec.best;
	this.opt["default-locale"][0] = langspec.best;
	this.locale = {};
	this.localeConfigure(langspec);
	this.buildTokenLists("citation");
	this.buildTokenLists("bibliography");
	this.configureTokenLists();
	this.registry = new CSL.Registry(this);
	this.disambiguate = new CSL.Disambiguation(this);
	this.splice_delimiter = false;
	this.fun.dateparser = new CSL.DateParser();
	this.fun.flipflopper = new CSL.Util.FlipFlopper(this);
	this.setCloseQuotesArray();
	this.fun.ordinalizer.init(this);
	this.fun.long_ordinalizer.init(this);
	this.fun.page_mangler = CSL.Util.PageRangeMangler.getFunction(this);
	this.setOutputFormat("html");
};
CSL.Engine.prototype.setCloseQuotesArray = function () {
	var ret;
	ret = [];
	ret.push(this.getTerm("close-quote"));
	ret.push(this.getTerm("close-inner-quote"));
	ret.push('"');
	ret.push("'");
	this.opt.close_quotes_array = ret;
};
CSL.Engine.prototype.buildTokenLists = function (area) {
	var area_nodes, navi;
	area_nodes = this.sys.xml.getNodesByName(this.cslXml, area);
	if (!this.sys.xml.getNodeValue(area_nodes)) {
		return;
	}
	navi = new this.getNavi(this, area_nodes);
	this.build.area = area;
	CSL.buildStyle.call(this, navi);
};
CSL.Engine.prototype.setStyleAttributes = function () {
	var dummy, attr, key, attributes, attrname;
	dummy = {};
	dummy.name = this.sys.xml.nodename(this.cslXml);
	attributes = this.sys.xml.attributes(this.cslXml);
	for (attrname in attributes) {
		if (attributes.hasOwnProperty(attrname)) {
			CSL.Attributes[attrname].call(dummy, this, attributes[attrname]);
		}
	}
};
CSL.buildStyle  = function (navi) {
	if (navi.getkids()) {
		CSL.buildStyle.call(this, navi);
	} else {
		if (navi.getbro()) {
			CSL.buildStyle.call(this, navi);
		} else {
			while (navi.nodeList.length > 1) {
				if (navi.remember()) {
					CSL.buildStyle.call(this, navi);
				}
			}
		}
	}
};
CSL.Engine.prototype.getNavi = function (state, myxml) {
	this.sys = state.sys;
	this.state = state;
	this.nodeList = [];
	this.nodeList.push([0, myxml]);
	this.depth = 0;
};
CSL.Engine.prototype.getNavi.prototype.remember = function () {
	var node;
	this.depth += -1;
	this.nodeList.pop();
	node = this.nodeList[this.depth][1][(this.nodeList[this.depth][0])];
	CSL.XmlToToken.call(node, this.state, CSL.END);
	return this.getbro();
};
CSL.Engine.prototype.getNavi.prototype.getbro = function () {
	var sneakpeek;
	sneakpeek = this.nodeList[this.depth][1][(this.nodeList[this.depth][0] + 1)];
	if (sneakpeek) {
		this.nodeList[this.depth][0] += 1;
		return true;
	} else {
		return false;
	}
};
CSL.Engine.prototype.getNavi.prototype.getkids = function () {
	var currnode, sneakpeek, pos, node, len;
	currnode = this.nodeList[this.depth][1][this.nodeList[this.depth][0]];
	sneakpeek = this.sys.xml.children(currnode);
	if (this.sys.xml.numberofnodes(sneakpeek) === 0) {
		CSL.XmlToToken.call(currnode, this.state, CSL.SINGLETON);
		return false;
	} else {
		for (pos in sneakpeek) {
			if (true) {
				node = sneakpeek[pos];
				if ("date" === this.sys.xml.nodename(node)) {
					currnode = CSL.Util.fixDateNode.call(this, currnode, pos, node);
					sneakpeek = this.sys.xml.children(currnode);
				}
			}
		}
		CSL.XmlToToken.call(currnode, this.state, CSL.START);
		this.depth += 1;
		this.nodeList.push([0, sneakpeek]);
		return true;
	}
};
CSL.Engine.prototype.getNavi.prototype.getNodeListValue = function () {
	return this.nodeList[this.depth][1];
};
CSL.Engine.prototype.getTerm = function (term, form, plural, gender, loose) {
	var ret = CSL.Engine.getField(CSL.LOOSE, this.locale[this.opt.lang].terms, term, form, plural, gender);
	if (typeof ret === "undefined") {
		ret = CSL.Engine.getField(CSL.STRICT, this.locale[this.opt.lang].terms, term, form, plural, gender);
	}
	if (ret) {
		this.tmp.cite_renders_content = true;
	}
	return ret;
};
CSL.Engine.prototype.getDate = function (form) {
	if (this.locale[this.opt.lang].dates[form]) {
		return this.locale[this.opt.lang].dates[form];
	} else {
		return false;
	}
};
CSL.Engine.prototype.getOpt = function (arg) {
	if ("undefined" !== typeof this.locale[this.opt.lang].opts[arg]) {
		return this.locale[this.opt.lang].opts[arg];
	} else {
		return this.locale[this.opt.lang].opts[arg];
	}
};
CSL.Engine.prototype.getVariable = function (Item, varname, form, plural) {
	return CSL.Engine.getField(CSL.LOOSE, Item, varname, form, plural);
};
CSL.Engine.prototype.getDateNum = function (ItemField, partname) {
	if ("undefined" === typeof ItemField) {
		return 0;
	} else {
		return ItemField[partname];
	}
};
CSL.Engine.getField = function (mode, hash, term, form, plural, gender) {
	var ret, forms, f, pos, len, hashterm;
	ret = "";
	if ("undefined" === typeof hash[term]) {
		if (mode === CSL.STRICT) {
			throw "Error in getField: term \"" + term + "\" does not exist.";
		} else {
			return undefined;
		}
	}
	if (gender && hash[term][gender]) {
		hashterm = hash[term][gender];
	} else {
		hashterm = hash[term];
	}
	forms = [];
	if (form === "symbol") {
		forms = ["symbol", "short"];
	} else if (form === "verb-short") {
		forms = ["verb-short", "verb"];
	} else if (form !== "long") {
		forms = [form];
	}
	forms = forms.concat(["long"]);
	len = forms.length;
	for (pos = 0; pos < len; pos += 1) {
		f = forms[pos];
		if ("string" === typeof hashterm || "number" === typeof hashterm) {
			ret = hashterm;
		} else if ("undefined" !== typeof hashterm[f]) {
			if ("string" === typeof hashterm[f] || "number" === typeof hashterm[f]) {
				ret = hashterm[f];
			} else {
				if ("number" === typeof plural) {
					ret = hashterm[f][plural];
				} else {
					ret = hashterm[f][0];
				}
			}
			break;
		}
	}
	return ret;
};
CSL.Engine.prototype.configureTokenLists = function () {
	var dateparts_master, area, pos, token, dateparts, part, ppos, pppos, len, llen, lllen;
	dateparts_master = ["year", "month", "day"];
	len = CSL.AREAS.length;
	for (pos = 0; pos < len; pos += 1) {
		area = CSL.AREAS[pos];
		llen = this[area].tokens.length - 1;
		for (ppos = llen; ppos > -1; ppos += -1) {
			token = this[area].tokens[ppos];
			if ("date" === token.name && CSL.END === token.tokentype) {
				dateparts = [];
			}
			if ("date-part" === token.name && token.strings.name) {
				lllen = dateparts_master.length;
				for (pppos = 0; pppos < lllen; pppos += 1) {
					part = dateparts_master[pppos];
					if (part === token.strings.name) {
						dateparts.push(token.strings.name);
					}
				}
			}
			if ("date" === token.name && CSL.START === token.tokentype) {
				dateparts.reverse();
				token.dateparts = dateparts;
			}
			token.next = (ppos + 1);
			if (token.name && CSL.Node[token.name].configure) {
				CSL.Node[token.name].configure.call(token, this, ppos);
			}
		}
	}
	this.version = CSL.version;
	return this.state;
};
CSL.Engine.prototype.retrieveItems = function (ids) {
	var ret, pos, len;
	ret = [];
	len = ids.length;
	for (pos = 0; pos < len; pos += 1) {
		ret.push(this.retrieveItem("" + ids[pos]));
	}
	return ret;
};
CSL.Engine.prototype.retrieveItem = function (id) {
	var Item, m, pos, len, mm;
	Item = this.sys.retrieveItem("" + id);
	if (Item.note) {
		m = CSL.NOTE_FIELDS_REGEXP.exec(Item.note);
		if (m) {
			for (pos = 0, len = m.length; pos < len; pos += 1) {
				mm = CSL.NOTE_FIELD_REGEXP.exec(m[pos]);
				if (!Item[mm[1]]) {
					Item[mm[1]] = mm[2].replace(/^\s+/, "").replace(/\s+$/, "");
				}
			}
		}
	}
	return Item;
};
CSL.Engine.prototype.dateParseArray = function (date_obj) {
	var ret, field, dpos, ppos, dp, exts, llen, pos, len, pppos, lllen;
	ret = {};
	for (field in date_obj) {
		if (field === "date-parts") {
			dp = date_obj["date-parts"];
			if (dp.length > 1) {
				if (dp[0].length !== dp[1].length) {
					CSL.error("CSL data error: element mismatch in date range input.");
				}
			}
			exts = ["", "_end"];
			llen = dp.length;
			for (ppos = 0; ppos < llen; ppos += 1) {
				lllen = CSL.DATE_PARTS.length;
				for (pppos = 0; pppos < lllen; pppos += 1) {
					ret[(CSL.DATE_PARTS[pppos] + exts[ppos])] = dp[ppos][pppos];
				}
			}
		} else if (date_obj.hasOwnProperty(field)) {
			if (field === "literal" && "object" === typeof date_obj.literal && "string" === typeof date_obj.literal.part) {
				CSL.error("CSL: fixing up weird literal date value");
				ret.literal = date_obj.literal.part;
			} else {
				ret[field] = date_obj[field];
			}
		}
	}
	return ret;
};
CSL.Engine.prototype.setOpt = function (token, name, value) {
	if (token.name === "style") {
		this.opt[name] = value;
	} else if (["citation", "bibliography"].indexOf(token.name) > -1) {
		this[token.name].opt[name] = value;
	} else if (["name-form", "name-delimiter", "names-delimiter"].indexOf(name) === -1) {
		token.strings[name] = value;
	}
};
CSL.Engine.prototype.fixOpt = function (token, name, localname) {
	if ("citation" === token.name || "bibliography" === token.name) {
		if (! this[token.name].opt[name] && "undefined" !== this.opt[name]) {
			this[token.name].opt[name] = this.opt[name];
		}
	}
	if ("name" === token.name || "names" === token.name) {
		if (! token.strings[localname] && "undefined" !== typeof this[this.build.area].opt[name]) {
			token.strings[localname] = this[this.build.area].opt[name];
		}
	}
};
CSL.Engine.prototype.setOutputFormat = function (mode) {
	this.opt.mode = mode;
	this.fun.decorate = CSL.Mode(mode);
	if (!this.output[mode]) {
		this.output[mode] = {};
		this.output[mode].tmp = {};
	}
};
CSL.Engine.prototype.setLangTagsForCslSort = function (tags) {
	var i, ilen;
	this.opt['locale-sort'] = [];
	for (i = 0, ilen = tags.length; i < ilen; i += 1) {
		this.opt['locale-sort'].push(tags[i]);
	}
}
CSL.Engine.prototype.setLangTagsForCslTransliteration = function (tags) {
	var i, ilen;
	this.opt['locale-pri'] = [];	
	for (i = 0, ilen = tags.length; i < ilen; i += 1) {
		this.opt['locale-pri'].push(tags[i]);
	}
}
CSL.Engine.prototype.setLangTagsForCslTranslation = function (tags) {
	var i, ilen;
	this.opt['locale-sec'] = [];
	for (i = 0, ilen = tags.length; i < ilen; i += 1) {
		this.opt['locale-sec'].push(tags[i]);
	}
};
CSL.Engine.prototype.setOriginalCreatorNameFormsOption = function (arg) {
	if (arg) {
		this.opt["locale-show-original-names"] = true;
	} else {
		this.opt["locale-show-original-names"] = false;
	}
};
CSL.Engine.prototype.setOriginalCreatorNameFormatOption = function (arg) {
	if (arg) {
		this.opt["locale-use-original-name-format"] = true;
	} else {
		this.opt["locale-use-original-name-format"] = false;
	}
};
CSL.Engine.prototype.setAutoVietnameseNamesOption = function (arg) {
	if (arg) {
		this.opt["auto-vietnamese-names"] = true;
	} else {
		this.opt["auto-vietnamese-names"] = false;
	}
};
CSL.Engine.Opt = function () {
	this.has_disambiguate = false;
	this.mode = "html";
	this.dates = {};
	this["locale-sort"] = [];
	this["locale-pri"] = [];
	this["locale-sec"] = [];
	this["default-locale"] = [];
	this["locale-use-original-name-format"] = false;
	this["noun-genders"] = {};
	this.update_mode = CSL.NONE;
	this.bib_mode = CSL.NONE;
	this.sort_citations = false;
	this["et-al-min"] = 0;
	this["et-al-use-first"] = 1;
	this["et-al-use-last"] = false;
	this["et-al-subsequent-min"] = false;
	this["et-al-subsequent-use-first"] = false;
	this["demote-non-dropping-particle"] = "display-and-sort";
	this["parse-names"] = true;
	this.citation_number_slug = false;
	this.max_number_of_names = 0;
};
CSL.Engine.Tmp = function () {
	this.names_max = new CSL.Stack();
	this.names_base = new CSL.Stack();
	this.givens_base = new CSL.Stack();
	this.value = [];
	this.namepart_decorations = {};
	this.namepart_type = false;
	this.area = "citation";
	this.can_substitute = new CSL.Stack(0, CSL.LITERAL);
	this.element_rendered_ok = false;
	this.element_trace = new CSL.Stack("style");
	this.nameset_counter = 0;
	this.term_sibling = new CSL.Stack([false, false, false], CSL.LITERAL);
	this.term_predecessor = false;
	this.jump = new CSL.Stack(0, CSL.LITERAL);
	this.decorations = new CSL.Stack();
	this.tokenstore_stack = new CSL.Stack();
	this.last_suffix_used = "";
	this.last_names_used = [];
	this.last_years_used = [];
	this.years_used = [];
	this.names_used = [];
	this.taintedItemIDs = false;
	this.taintedCitationIDs = false;
	this.initialize_with = new CSL.Stack();
	this.disambig_request = false;
	this["name-as-sort-order"] = false;
	this.suppress_decorations = false;
	this.disambig_settings = new CSL.AmbigConfig();
	this.bib_sort_keys = [];
	this.prefix = new CSL.Stack("", CSL.LITERAL);
	this.suffix = new CSL.Stack("", CSL.LITERAL);
	this.delimiter = new CSL.Stack("", CSL.LITERAL);
	this.names_cut = {};
	this.cite_locales = [];
	this.cite_affixes = false;
};
CSL.Engine.Fun = function () {
	this.match = new  CSL.Util.Match();
	this.suffixator = new CSL.Util.Suffixator(CSL.SUFFIX_CHARS);
	this.romanizer = new CSL.Util.Romanizer();
	this.ordinalizer = new CSL.Util.Ordinalizer();
	this.long_ordinalizer = new CSL.Util.LongOrdinalizer();
};
CSL.Engine.Build = function () {
	this["alternate-term"] = false;
	this.in_bibliography = false;
	this.in_style = false;
	this.skip = false;
	this.postponed_macro = false;
	this.layout_flag = false;
	this.name = false;
	this.form = false;
	this.term = false;
	this.macro = {};
	this.macro_stack = [];
	this.text = false;
	this.lang = false;
	this.area = "citation";
	this.substitute_level = new CSL.Stack(0, CSL.LITERAL);
	this.render_nesting_level = 0;
	this.render_seen = false;
};
CSL.Engine.Configure = function () {
	this.fail = [];
	this.succeed = [];
};
CSL.Engine.Citation = function (state) {
	this.opt = {};
	this.tokens = [];
	this.srt = new CSL.Registry.Comparifier(state, "citation_sort");
	this.opt.collapse = [];
	this.opt["disambiguate-add-names"] = false;
	this.opt["disambiguate-add-givenname"] = false;
	this.opt["disambiguate-add-year-suffix"] = false;
	this.opt["givenname-disambiguation-rule"] = "none";
	this.opt["near-note-distance"] = 5;
	this.opt.topdecor = [];
};
CSL.Engine.Bibliography = function () {
	this.opt = {};
	this.tokens = [];
	this.opt.collapse = [];
	this.opt.topdecor = [];
	this.opt.layout_decorations = [];
	this.opt.layout_prefix = "";
	this.opt.layout_suffix = "";
	this.opt.layout_delimiter = "";
	this.opt["line-spacing"] = 1;
	this.opt["entry-spacing"] = 1;
};
CSL.Engine.BibliographySort = function () {
	this.tokens = [];
	this.opt = {};
	this.opt.sort_directions = [];
	this.keys = [];
	this.opt.topdecor = [];
};
CSL.Engine.CitationSort = function () {
	this.tokens = [];
	this.opt = {};
	this.opt.sort_directions = [];
	this.keys = [];
	this.opt.topdecor = [];
};
CSL.Engine.prototype.setCitationId = function (citation, force) {
	var ret, id, direction;
	ret = false;
	if (!citation.citationID || force) {
		id = Math.floor(Math.random() * 100000000000000);
		while (true) {
			direction = 0;
			if (!this.registry.citationreg.citationById[id]) {
				citation.citationID = id.toString(32);
				break;
			} else if (!direction && id < 50000000000000) {
				direction = 1;
			} else {
				direction = -1;
			}
			if (direction === 1) {
				id += 1;
			} else {
				id += -1;
			}
		}
		ret = "" + id;
	}
	this.registry.citationreg.citationById[citation.citationID] = citation;
	return ret;
};
CSL.Engine.prototype.restoreProcessorState = function (citations) {
	var item, Item, newitem, citationList, itemList, sortedItems;
	citationList = [];
	itemList = [];
	if (!citations) {
		citations = [];
	}
	var indexNumbers = [];
	var citationIds = {};
	for (var i = 0, ilen = citations.length; i < ilen; i += 1) {
		if (citationIds[citations[i].citationID]) {
			this.setCitationId(citations[i], true);
		}
		citationIds[citations[i].citationID] = true;
		indexNumbers.push(citations[i].properties.index);
	}
	var oldCitations = citations.slice();
	oldCitations.sort(
	    function (a,b) {
			if (a.properties.index < b.properties.index) {
				return -1;
			} else if (a.properties.index > b.properties.index) {
				return 1;
			} else {
				return 0;
			}
		}
	);
	for (var i = 0, ilen = oldCitations.length; i < ilen; i += 1) {
		oldCitations[i].properties.index = i;
	}
	for (var i = 0, ilen = oldCitations.length; i < ilen; i += 1) {
		sortedItems = [];
		for (var j = 0, jlen = oldCitations[i].citationItems.length; j < jlen; j += 1) {
			item = oldCitations[i].citationItems[j];
			if ("undefined" === typeof item.sortkeys) {
				item.sortkeys = [];
			}
			Item = this.retrieveItem("" + item.id);
			newitem = [Item, item];
			sortedItems.push(newitem);
			oldCitations[i].citationItems[j].item = Item;
			itemList.push("" + item.id);
		}
		if (!oldCitations[i].properties.unsorted) {
			sortedItems.sort(this.citation.srt.compareCompositeKeys);
		}
		oldCitations[i].sortedItems = sortedItems;
		this.registry.citationreg.citationById[oldCitations[i].citationID] = oldCitations[i];
	}
	this.updateItems(itemList);
	for (var i = 0, ilen = citations.length; i < ilen; i += 1) {
		citationList.push(["" + citations[i].citationID, citations[i].properties.noteIndex]);
	}
	var ret = [];
	if (citations && citations.length) {
		ret = this.processCitationCluster(citations[0], [], citationList.slice(1));
	} else {
		this.registry = new CSL.Registry(this);
		this.tmp = new CSL.Engine.Tmp();
	}
	return ret;
};
CSL.Engine.prototype.updateItems = function (idList, nosort) {
	var debug = false;
	this.registry.init(idList);
	this.registry.dodeletes(this.registry.myhash);
	this.registry.doinserts(this.registry.mylist);
	this.registry.dorefreshes();
	this.registry.rebuildlist();
	this.registry.setsortkeys();
	this.registry.setdisambigs();
	if (!nosort) {
		this.registry.sorttokens();
	}
	this.registry.renumber();
	return this.registry.getSortedIds();
};
CSL.Engine.prototype.updateUncitedItems = function (idList, nosort) {
	var debug = false;
	this.registry.init(idList, true);
	this.registry.doinserts(this.registry.mylist);
	this.registry.douncited();
	this.registry.rebuildlist();
	this.registry.setsortkeys();
	this.registry.setdisambigs();
	if (!nosort) {
		this.registry.sorttokens();
	}
	this.registry.renumber();
	return this.registry.getSortedIds();
};
CSL.Engine.prototype.makeBibliography = function (bibsection) {
	var debug, ret, params, maxoffset, item, len, pos, tok, tokk, tokkk, entry_ids, entry_strings, bibliography_errors;
	debug = false;
	if (!this.bibliography.tokens.length) {
		return false;
	}
	if ("string" === typeof bibsection ) {
		this.opt.citation_number_slug = bibsection;
		bibsection = false;
	}
	ret = CSL.getBibliographyEntries.call(this, bibsection);
	entry_ids = ret[0];
	entry_strings = ret[1];
	params = {
		"maxoffset": 0,
		"entryspacing": this.bibliography.opt["entry-spacing"],
		"linespacing": this.bibliography.opt["line-spacing"],
		"second-field-align": false,
		"entry_ids": entry_ids,
		"bibliography_errors": this.tmp.bibliography_errors.slice()
	};
	if (this.bibliography.opt["second-field-align"]) {
		params["second-field-align"] = this.bibliography.opt["second-field-align"];
	}
	maxoffset = 0;
	len = this.registry.reflist.length;
	for (pos = 0; pos < len; pos += 1) {
		item = this.registry.reflist[pos];
		if (item.offset > params.maxoffset) {
			params.maxoffset = item.offset;
		}
	}
	if (this.bibliography.opt.hangingindent) {
		params.hangingindent = this.bibliography.opt.hangingindent;
	}
	params.bibstart = this.fun.decorate.bibstart;
	params.bibend = this.fun.decorate.bibend;
	this.opt.citation_number_slug = false;
	return [params, entry_strings];
};
CSL.getBibliographyEntries = function (bibsection) {
	var ret, input, include, anymatch, allmatch, bib_entry, res, len, pos, item, llen, ppos, spec, lllen, pppos, bib_layout, topblobs, all_item_ids, entry_item_ids, debug, collapse_parallel, i, siblings, skips, sortedItems, eyetem, chr, entry_item_data;
	ret = [];
	entry_item_data = [];
	this.tmp.area = "bibliography";
	this.tmp.last_rendered_name = false;
	this.tmp.bibliography_errors = [];
	this.tmp.bibliography_pos = 0;
	input = this.retrieveItems(this.registry.getSortedIds());
	this.tmp.disambig_override = true;
	function eval_string(a, b) {
		if (a === b) {
			return true;
		}
		return false;
	}
	function eval_list(a, lst) {
		lllen = lst.length;
		for (pppos = 0; pppos < lllen; pppos += 1) {
			if (eval_string(a, lst[pppos])) {
				return true;
			}
		}
		return false;
	}
	function eval_spec(a, b) {
		if ((a === "none" || !a) && !b) {
			return true;
		}
		if ("string" === typeof b) {
			return eval_string(a, b);
		} else if (!b) {
			return false;
		} else {
			return eval_list(a, b);
		}
	}
	skips = {};
	all_item_ids = [];
	len = input.length;
	for (pos = 0; pos < len; pos += 1) {
		item = input[pos];
		if (skips[item.id]) {
			continue;
		}
		if (bibsection) {
			include = true;
			if (bibsection.include) {
				include = false;
				llen = bibsection.include.length;
				for (ppos = 0; ppos < llen; ppos += 1) {
					spec = bibsection.include[ppos];
					if (eval_spec(spec.value, item[spec.field])) {
						include = true;
						break;
					}
				}
			} else if (bibsection.exclude) {
				anymatch = false;
				llen = bibsection.exclude.length;
				for (ppos = 0; ppos < llen; ppos += 1) {
					spec = bibsection.exclude[ppos];
					if (eval_spec(spec.value, item[spec.field])) {
						anymatch = true;
						break;
					}
				}
				if (anymatch) {
					include = false;
				}
			} else if (bibsection.select) {
				include = false;
				allmatch = true;
				llen = bibsection.select.length;
				for (ppos = 0; ppos < llen; ppos += 1) {
					spec = bibsection.select[ppos];
					if (!eval_spec(spec.value, item[spec.field])) {
						allmatch = false;
					}
				}
				if (allmatch) {
					include = true;
				}
			}
			if (bibsection.quash) {
				allmatch = true;
				llen = bibsection.quash.length;
				for (ppos = 0; ppos < llen; ppos += 1) {
					spec = bibsection.quash[ppos];
					if (!eval_spec(spec.value, item[spec.field])) {
						allmatch = false;
					}
				}
				if (allmatch) {
					include = false;
				}
			}
			if (!include) {
				continue;
			}
		}
		bib_entry = new CSL.Token("group", CSL.START);
		bib_entry.decorations = [["@bibliography", "entry"]].concat(this[this.build.area].opt.layout_decorations);
		this.output.startTag("bib_entry", bib_entry);
		sortedItems = [[{id: "" + item.id}, item]];
		entry_item_ids = [];
		if (this.registry.registry[item.id].master) {
			collapse_parallel = true;
			this.parallel.StartCitation(sortedItems);
			this.output.queue[0].strings.delimiter = ", ";
			entry_item_ids.push("" + CSL.getCite.call(this, item));
			skips[item.id] = true;
			siblings = this.registry.registry[item.id].siblings;
			for (ppos = 0, llen = siblings.length; ppos < llen; ppos += 1) {
				i = this.registry.registry[item.id].siblings[ppos];
				eyetem = this.retrieveItem(i);
				entry_item_ids.push("" + CSL.getCite.call(this, eyetem));
				skips[eyetem.id] = true;
			}
			this.parallel.ComposeSet();
			this.parallel.PruneOutputQueue();
		} else if (!this.registry.registry[item.id].siblings) {
			entry_item_ids.push("" + CSL.getCite.call(this, item));
		}
		entry_item_data.push("");
		this.tmp.bibliography_pos += 1;
		all_item_ids.push(entry_item_ids);
		this.output.endTag("bib_entry");
		if (this.output.queue[0].blobs.length && this.output.queue[0].blobs[0].blobs.length) {
			if (collapse_parallel) {
				topblobs = this.output.queue[0].blobs;
				collapse_parallel = false;
			} else {
				topblobs = this.output.queue[0].blobs[0].blobs;
			}
			llen = topblobs.length - 1;
			for (ppos = llen; ppos > -1; ppos += -1) {
				if (topblobs[ppos].blobs && topblobs[ppos].blobs.length !== 0) {
					chr = this.bibliography.opt.layout_suffix.slice(0, 1);
					if (chr && topblobs[ppos].strings.suffix.slice(-1) === chr) {
						topblobs[ppos].strings.suffix = topblobs[ppos].strings.suffix.slice(0, -1);
					}
					topblobs[ppos].strings.suffix += this.bibliography.opt.layout_suffix;
					break;
				}
			}
			topblobs[0].strings.prefix = this.bibliography.opt.layout_prefix + topblobs[0].strings.prefix;
		}
		CSL.Output.Queue.purgeEmptyBlobs(this.output.queue);
		CSL.Output.Queue.adjustPunctuation(this, this.output.queue);
		res = this.output.string(this, this.output.queue)[0];
		if (!res) {
			res = "\n[CSL STYLE ERROR: reference with no printed form.]\n";
		}
		ret.push(res);
	}
	this.tmp.disambig_override = false;
	return [all_item_ids, ret];
};
CSL.Engine.prototype.previewCitationCluster = function (citation, citationsPre, citationsPost, newMode) {
	var oldMode, oldCitationID, newCitationID, ret, data;
	oldMode = this.opt.mode;
	this.setOutputFormat(newMode);
	ret = this.processCitationCluster(citation, citationsPre, citationsPost, CSL.PREVIEW);
	this.setOutputFormat(oldMode);
	return ret[1];
};
CSL.Engine.prototype.appendCitationCluster = function (citation) {
	var pos, len, c, citationsPre;
	citationsPre = [];
	len = this.registry.citationreg.citationByIndex.length;
	for (pos = 0; pos < len; pos += 1) {
		c = this.registry.citationreg.citationByIndex[pos];
		citationsPre.push(["" + c.citationID, c.properties.noteIndex]);
	}
	return this.processCitationCluster(citation, citationsPre, [])[1];
};
CSL.Engine.prototype.processCitationCluster = function (citation, citationsPre, citationsPost, flag) {
	var sortedItems, new_citation, pos, len, item, citationByIndex, c, Item, newitem, k, textCitations, noteCitations, update_items, citations, first_ref, last_ref, ipos, ilen, cpos, onecitation, oldvalue, ibidme, suprame, useme, items, i, key, prev_locator, curr_locator, param, ret, obj, ppos, llen, lllen, pppos, ppppos, llllen, cids, note_distance, return_data, lostItemId, lostItemList, lostItemData, otherLostPkeys, disambig, oldItemIds;
	this.debug = false;
	this.tmp.citation_errors = [];
	return_data = {"bibchange": false};
	this.registry.return_data = return_data;
	this.setCitationId(citation);
	if (flag === CSL.PREVIEW) {
		var oldCitationList = this.registry.citationreg.citationByIndex.slice();
		var oldItemList = this.registry.reflist.slice();
		var newCitationList = citationsPre.concat([["" + citation.citationID, citation.properties.noteIndex]]).concat(citationsPost);
		var newItemIds = {};
		var newItemIdsList = [];
		for (pos = 0, len = newCitationList.length; pos < len; pos += 1) {
			c = this.registry.citationreg.citationById[newCitationList[pos][0]];
			for (ppos = 0, llen = c.citationItems.length; ppos < llen; ppos += 1) {
				newItemIds[c.citationItems[ppos].id] = true;
				newItemIdsList.push("" + c.citationItems[ppos].id);
			}
		}
		var oldAmbigs = {};
		for (pos = 0, len = oldItemList.length; pos < len; pos += 1) {
			if (!newItemIds[oldItemList[pos].id]) {
				var oldAkey = this.registry.registry[oldItemList[pos].id].ambig;
				var ids = this.registry.ambigcites[oldAkey];
				if (ids) {
					for (ppos = 0, llen = ids.length; ppos < llen; ppos += 1) {
						oldAmbigs[ids[ppos]] = CSL.cloneAmbigConfig(this.registry.registry[ids[ppos]].disambig);
					}
				}
			}
		}
	}
	this.tmp.taintedItemIDs = {};
	this.tmp.taintedCitationIDs = {};
	sortedItems = [];
	len = citation.citationItems.length;
	for (pos = 0; pos < len; pos += 1) {
		item = citation.citationItems[pos];
		Item = this.retrieveItem("" + item.id);
	    newitem = [Item, item];
		sortedItems.push(newitem);
		citation.citationItems[pos].item = Item;
	}
	if (!this.opt.citation_number_sort && sortedItems && sortedItems.length > 1 && this.citation_sort.tokens.length > 0) {
		len = sortedItems.length;
		for (pos = 0; pos < len; pos += 1) {
			sortedItems[pos][1].sortkeys = CSL.getSortKeys.call(this, sortedItems[pos][0], "citation_sort");
		}
		if (!citation.properties.unsorted) {
			sortedItems.sort(this.citation.srt.compareCompositeKeys);
		}
	}
	citation.sortedItems = sortedItems;
	citationByIndex = [];
	len = citationsPre.length;
	for (pos = 0; pos < len; pos += 1) {
		c = citationsPre[pos];
		this.registry.citationreg.citationById[c[0]].properties.noteIndex = c[1];
		citationByIndex.push(this.registry.citationreg.citationById[c[0]]);
	}
	citationByIndex.push(citation);
	len = citationsPost.length;
	for (pos = 0; pos < len; pos += 1) {
		c = citationsPost[pos];
		this.registry.citationreg.citationById[c[0]].properties.noteIndex = c[1];
		citationByIndex.push(this.registry.citationreg.citationById[c[0]]);
	}
	this.registry.citationreg.citationByIndex = citationByIndex;
	this.registry.citationreg.citationsByItemId = {};
	if (this.opt.update_mode === CSL.POSITION) {
		textCitations = [];
		noteCitations = [];
	}
	update_items = [];
	len = citationByIndex.length;
	for (pos = 0; pos < len; pos += 1) {
		citationByIndex[pos].properties.index = pos;
		llen = citationByIndex[pos].sortedItems.length;
		for (ppos = 0; ppos < llen; ppos += 1) {
			item = citationByIndex[pos].sortedItems[ppos];
			if (!this.registry.citationreg.citationsByItemId[item[1].id]) {
				this.registry.citationreg.citationsByItemId[item[1].id] = [];
				update_items.push("" + item[1].id);
			}
			if (this.registry.citationreg.citationsByItemId[item[1].id].indexOf(citationByIndex[pos]) === -1) {
				this.registry.citationreg.citationsByItemId[item[1].id].push(citationByIndex[pos]);
			}
		}
		if (this.opt.update_mode === CSL.POSITION) {
			if (citationByIndex[pos].properties.noteIndex) {
				noteCitations.push(citationByIndex[pos]);
			} else {
				textCitations.push(citationByIndex[pos]);
			}
		}
	}
	if (flag !== CSL.ASSUME_ALL_ITEMS_REGISTERED) {
		this.updateItems(update_items);
	}
	if (this.opt.update_mode === CSL.POSITION) {
		for (pos = 0; pos < 2; pos += 1) {
			citations = [textCitations, noteCitations][pos];
			first_ref = {};
			last_ref = {};
			llen = citations.length;
			for (ppos = 0; ppos < llen; ppos += 1) {
				onecitation = citations[ppos];
				if (!onecitation.properties.noteIndex) {
					onecitation.properties.noteIndex = 0;
				}
				lllen = citations[ppos].sortedItems.length;
				for (pppos = 0; pppos < lllen; pppos += 1) {
					item = citations[ppos].sortedItems[pppos];
					if (flag === CSL.PREVIEW) {
						if (onecitation.citationID != citation.citationID) {
							if ("undefined" === typeof first_ref[item[1].id]) {
								first_ref[item[1].id] = onecitation.properties.noteIndex;
								last_ref[item[1].id] = onecitation.properties.noteIndex;
							} else {
								last_ref[item[1].id] = onecitation.properties.noteIndex;
							}
							continue;
						}
					}
					oldvalue = {};
					oldvalue.position = item[1].position;
					oldvalue["first-reference-note-number"] = item[1]["first-reference-note-number"];
					oldvalue["near-note"] = item[1]["near-note"];
					item[1]["first-reference-note-number"] = 0;
					item[1]["near-note"] = false;
					if ("undefined" === typeof first_ref[item[1].id]) {
						first_ref[item[1].id] = onecitation.properties.noteIndex;
						last_ref[item[1].id] = onecitation.properties.noteIndex;
						item[1].position = CSL.POSITION_FIRST;
					} else {
						ibidme = false;
						suprame = false;
						if (ppos > 0 && parseInt(pppos, 10) === 0) {
							items = citations[(ppos - 1)].sortedItems;
							useme = false;
							if ((citations[(ppos - 1)].sortedItems[0][1].id  == item[1].id && citations[ppos - 1].properties.noteIndex >= (citations[ppos].properties.noteIndex - 1)) || citations[(ppos - 1)].sortedItems[0][1].id == this.registry.registry[item[1].id].parallel) {
								useme = true;
							}
							llllen = items.slice(1).length;
							for (ppppos = 0; ppppos < llllen; ppppos += 1) {
								i = items.slice(1)[ppppos];
								if (!this.registry.registry[i[1].id].parallel || this.registry.registry[i[1].id].parallel == this.registry.registry[i[1].id]) {
									useme = false;
								}
							}
							if (useme) {
								ibidme = true;
							} else {
								suprame = true;
							}
						} else if (pppos > 0 && onecitation.sortedItems[(pppos - 1)][1].id == item[1].id) {
							ibidme = true;
						} else {
							suprame = true;
						}
						if (ibidme) {
							if (pppos > 0) {
								prev_locator = onecitation.sortedItems[(pppos - 1)][1].locator;
							} else {
								prev_locator = citations[(ppos - 1)].sortedItems[0][1].locator;
							}
							curr_locator = item[1].locator;
						}
						if (ibidme && prev_locator && !curr_locator) {
							ibidme = false;
							suprame = true;
						}
						if (ibidme) {
							if (!prev_locator && curr_locator) {
								item[1].position = CSL.POSITION_IBID_WITH_LOCATOR;
							} else if (!prev_locator && !curr_locator) {
								item[1].position = CSL.POSITION_IBID;
							} else if (prev_locator && curr_locator === prev_locator) {
								item[1].position = CSL.POSITION_IBID;
							} else if (prev_locator && curr_locator && curr_locator !== prev_locator) {
								item[1].position = CSL.POSITION_IBID_WITH_LOCATOR;
							} else {
								ibidme = false; // just to be clear
								suprame = true;
							}
						}
						if (suprame) {
							item[1].position = CSL.POSITION_SUBSEQUENT;
							if (first_ref[item[1].id] != onecitation.properties.noteIndex) {
								item[1]["first-reference-note-number"] = first_ref[item[1].id];
							}
						}
					}
					if (onecitation.properties.noteIndex) {
						note_distance = parseInt(onecitation.properties.noteIndex, 10) - parseInt(last_ref[item[1].id], 10);
						if (note_distance <= this.citation.opt["near-note-distance"]) {
							item[1]["near-note"] = true;
						}
						last_ref[item[1].id] = onecitation.properties.noteIndex;
					}
					if (onecitation.citationID != citation.citationID) {
						llllen = CSL.POSITION_TEST_VARS.length;
						for (ppppos = 0; ppppos < llllen; ppppos += 1) {
							param = CSL.POSITION_TEST_VARS[ppppos];
							if (item[1][param] !== oldvalue[param]) {
								this.tmp.taintedCitationIDs[onecitation.citationID] = true;
							}
						}
					}
				}
			}
		}
	}
	if (this.opt.citation_number_sort && sortedItems && sortedItems.length > 1 && this.citation_sort.tokens.length > 0) {
		len = sortedItems.length;
		for (pos = 0; pos < len; pos += 1) {
			sortedItems[pos][1].sortkeys = CSL.getSortKeys.call(this, sortedItems[pos][0], "citation_sort");
		}
		if (!citation.properties.unsorted) {
			sortedItems.sort(this.citation.srt.compareCompositeKeys);
		}
	}
	for (key in this.tmp.taintedItemIDs) {
		if (this.tmp.taintedItemIDs.hasOwnProperty(key)) {
			citations = this.registry.citationreg.citationsByItemId[key];
				for (pos = 0, len = citations.length; pos < len; pos += 1) {
					this.tmp.taintedCitationIDs[citations[pos].citationID] = true;
				}
		}
	}
	ret = [];
	if (flag === CSL.PREVIEW) {
		ret = this.process_CitationCluster.call(this, citation.sortedItems);
		this.registry.citationreg.citationByIndex = oldCitationList;
		this.registry.citationreg.citationById = {};
		for (pos = 0, len = oldCitationList.length; pos < len; pos += 1) {
			this.registry.citationreg.citationById[oldCitationList[pos].citationID] = oldCitationList[pos];
		}
		oldItemIds = [];
		for (pos = 0, len = oldItemList.length; pos < len; pos += 1) {
			oldItemIds.push("" + oldItemList[pos].id);
		}
		this.updateItems(oldItemIds);
		for (key in oldAmbigs) {
			this.registry.registry[key].disambig = oldAmbigs[key];
		}
	} else {
		for (key in this.tmp.taintedCitationIDs) {
			if (this.tmp.taintedCitationIDs.hasOwnProperty(key)) {
				if (key == citation.citationID) {
					continue;
				}
				var mycitation = this.registry.citationreg.citationById[key];
				this.tmp.citation_pos = mycitation.properties.index;
				this.tmp.citation_note_index = mycitation.properties.noteIndex;
				this.tmp.citation_id = "" + mycitation.citationID;
				obj = [];
				obj.push(mycitation.properties.index);
				obj.push(this.process_CitationCluster.call(this, mycitation.sortedItems));
				ret.push(obj);
				this.tmp.citation_pos += 1;
			}
		}
		this.tmp.taintedItemIDs = false;
		this.tmp.taintedCitationIDs = false;
		this.tmp.citation_pos = citation.properties.index;
		this.tmp.citation_note_index = citation.properties.noteIndex;
		this.tmp.citation_id = "" + citation.citationID;
		obj = [];
		obj.push(citationsPre.length);
		obj.push(this.process_CitationCluster.call(this, sortedItems));
		ret.push(obj);
		ret.sort(function (a, b) {
			if (a[0] > b[0]) {
				return 1;
			} else if (a[0] < b[0]) {
				return -1;
			} else {
				return 0;
			}
		});
	}
	return_data.citation_errors = this.tmp.citation_errors.slice();
	return [return_data, ret];
};
CSL.Engine.prototype.process_CitationCluster = function (sortedItems) {
	var str;
	this.parallel.StartCitation(sortedItems);
	str = CSL.getCitationCluster.call(this, sortedItems);
	return str;
};
CSL.Engine.prototype.makeCitationCluster = function (rawList) {
	var inputList, newitem, str, pos, len, item, Item;
	inputList = [];
	len = rawList.length;
	for (pos = 0; pos < len; pos += 1) {
		item = rawList[pos];
		Item = this.retrieveItem("" + item.id);
		newitem = [Item, item];
		inputList.push(newitem);
	}
	if (inputList && inputList.length > 1 && this.citation_sort.tokens.length > 0) {
		len = inputList.length;
		for (pos = 0; pos < len; pos += 1) {
			rawList[pos].sortkeys = CSL.getSortKeys.call(this, inputList[pos][0], "citation_sort");
		}
		inputList.sort(this.citation.srt.compareCompositeKeys);
	}
	this.tmp.citation_errors = [];
	this.parallel.StartCitation(inputList);
	str = CSL.getCitationCluster.call(this, inputList);
	return str;
};
CSL.getAmbiguousCite = function (Item, disambig) {
	var use_parallels, ret;
	if (disambig) {
		this.tmp.disambig_request = disambig;
	} else {
		this.tmp.disambig_request = false;
	}
	this.tmp.area = "citation";
	use_parallels = this.parallel.use_parallels;
	this.parallel.use_parallels = false;
	this.tmp.suppress_decorations = true;
	this.tmp.just_looking = true;
	CSL.getCite.call(this, Item, {position: 1});
	CSL.Output.Queue.purgeEmptyBlobs(this.output.queue);
	CSL.Output.Queue.adjustPunctuation(this, this.output.queue);
	ret = this.output.string(this, this.output.queue);
	this.tmp.just_looking = false;
	this.tmp.suppress_decorations = false;
	this.parallel.use_parallels = use_parallels;
	return ret;
};
CSL.getSpliceDelimiter = function (last_collapsed, pos) {
	if (last_collapsed && ! this.tmp.have_collapsed && this.citation.opt["after-collapse-delimiter"]) {
		this.tmp.splice_delimiter = this.citation.opt["after-collapse-delimiter"];
	} else if (this.tmp.cite_locales[pos - 1]) {
		var alt_affixes = this.tmp.cite_affixes[this.tmp.cite_locales[pos - 1]];
		if (alt_affixes && alt_affixes.delimiter) {
			this.tmp.splice_delimiter = alt_affixes.delimiter;
		}
	}
	return this.tmp.splice_delimiter;
};
CSL.getCitationCluster = function (inputList, citationID) {
	var delimiter, result, objects, myparams, len, pos, item, last_collapsed, params, empties, composite, compie, myblobs, Item, llen, ppos, obj, preceding_item, txt_esc, error_object;
	txt_esc = CSL.Output.Formats[this.opt.mode].text_escape;
	this.tmp.area = "citation";
	result = "";
	objects = [];
	this.tmp.last_suffix_used = "";
	this.tmp.last_names_used = [];
	this.tmp.last_years_used = [];
	this.tmp.backref_index = [];
	this.tmp.cite_locales = [];
	if (citationID) {
		this.registry.citationreg.citationById[citationID].properties.backref_index = false;
		this.registry.citationreg.citationById[citationID].properties.backref_citation = false;
	}
	myparams = [];
	len = inputList.length;
	for (pos = 0; pos < len; pos += 1) {
		Item = inputList[pos][0];
		item = inputList[pos][1];
		last_collapsed = this.tmp.have_collapsed;
		params = {};
		if (pos > 0) {
			CSL.getCite.call(this, Item, item, "" + inputList[(pos - 1)][1].id);
		} else {
			this.tmp.term_predecessor = false;
			CSL.getCite.call(this, Item, item);
		}
		if (!this.tmp.cite_renders_content) {
			error_object = {
				citationID: "" + this.tmp.citation_id,
				index: this.tmp.citation_pos,
				noteIndex: this.tmp.citation_note_index,
				itemID: "" + Item.id,
				citationItems_pos: pos,
				error_code: CSL.ERROR_NO_RENDERED_FORM
			};
			this.tmp.citation_errors.push(error_object);
		}
		if (pos === (inputList.length - 1)) {
			this.parallel.ComposeSet();
		}
		params.splice_delimiter = CSL.getSpliceDelimiter.call(this, last_collapsed, pos);
		if (item && item["author-only"]) {
			this.tmp.suppress_decorations = true;
		}
		if (pos > 0) {
			preceding_item = inputList[pos - 1][1];
			if (preceding_item.suffix && pos > 0 && preceding_item.suffix.slice(-1) === ".") {
				var spaceidx = params.splice_delimiter.indexOf(" ");
				if (spaceidx > -1) {
					params.splice_delimiter = params.splice_delimiter.slice(spaceidx);
				} else {
					params.splice_delimiter = "";
				}
			}
		}
		params.suppress_decorations = this.tmp.suppress_decorations;
		params.have_collapsed = this.tmp.have_collapsed;
		myparams.push(params);
	}
	this.parallel.PruneOutputQueue(this);
	empties = 0;
	myblobs = this.output.queue.slice();
	var fakeblob = {
		strings: {
			suffix: this.citation.opt.layout_suffix,
			delimiter: this.citation.opt.layout_delimiter				
		}
	};
	var suffix = this.citation.opt.layout_suffix;
	var last_locale = this.tmp.cite_locales[this.tmp.cite_locales.length - 1];
	if (last_locale 
		&& this.tmp.cite_affixes[last_locale]
		&& this.tmp.cite_affixes[last_locale].suffix) {
		suffix = this.tmp.cite_affixes[last_locale].suffix;
	}
	if (CSL.TERMINAL_PUNCTUATION.slice(0, -1).indexOf(suffix.slice(0, 1)) > -1) {
		suffix = suffix.slice(0, 1);
	}
	var delimiter = this.citation.opt.layout_delimiter;
	if (CSL.TERMINAL_PUNCTUATION.slice(0, -1).indexOf(delimiter.slice(0, 1)) > -1) {
		delimiter = delimiter.slice(0, 1);
	}
	var mystk = [
		{
			suffix: suffix,
			delimiter: delimiter,
			blob: fakeblob
		}
	];
	var use_layout_suffix = suffix;
	for (pos = 0, len = myblobs.length; pos < len; pos += 1) {
		CSL.Output.Queue.purgeEmptyBlobs(this.output.queue, true);
	}
	for (pos = 0, len = myblobs.length; pos < len; pos += 1) {
		this.output.queue = [myblobs[pos]];
		this.tmp.suppress_decorations = myparams[pos].suppress_decorations;
		this.tmp.splice_delimiter = myparams[pos].splice_delimiter;
		if (myblobs[pos].parallel_delimiter) {
			this.tmp.splice_delimiter = myblobs[pos].parallel_delimiter;
		}
		this.tmp.have_collapsed = myparams[pos].have_collapsed;
		CSL.Output.Queue.adjustPunctuation(this, this.output.queue, mystk);
		composite = this.output.string(this, this.output.queue);
		this.tmp.suppress_decorations = false;
		if (item && item["author-only"]) {
			return composite;
		}
		if ("object" === typeof composite && composite.length === 0 && !item["suppress-author"]) {
			composite.push("[CSL STYLE ERROR: reference with no printed form.]");
		}
		if (objects.length && "string" === typeof composite[0]) {
			composite.reverse();
			objects.push(txt_esc(this.tmp.splice_delimiter) + composite.pop());
		} else {
			composite.reverse();
			compie = composite.pop();
			if ("undefined" !== typeof compie) {
				objects.push(compie);
			}
		}
		llen = composite.length;
		for (ppos = 0; ppos < llen; ppos += 1) {
			obj = composite[ppos];
			if ("string" === typeof obj) {
				objects.push(txt_esc(this.tmp.splice_delimiter) + obj);
				continue;
			}
			compie = composite.pop();
			if ("undefined" !== typeof compie) {
				objects.push(compie);
			}
		}
		if (objects.length === 0 && !inputList[pos][1]["suppress-author"]) {
			empties += 1;
		}
	}
	result += this.output.renderBlobs(objects);
	if (result) {
		if (this.tmp.last_chr === use_layout_suffix.slice(0, 1)) {
			use_layout_suffix = use_layout_suffix.slice(1);
		}
		result = txt_esc(this.citation.opt.layout_prefix) + result + txt_esc(use_layout_suffix);
		if (!this.tmp.suppress_decorations) {
			len = this.citation.opt.layout_decorations.length;
			for (pos = 0; pos < len; pos += 1) {
				params = this.citation.opt.layout_decorations[pos];
				result = this.fun.decorate[params[0]][params[1]](this, result);
			}
		}
	}
	return result;
};
CSL.getCite = function (Item, item, prevItemID) {
	var next, error_object;
	this.tmp.cite_renders_content = false;
	this.parallel.StartCite(Item, item, prevItemID);
	CSL.citeStart.call(this, Item);
	next = 0;
	while (next < this[this.tmp.area].tokens.length) {
		next = CSL.tokenExec.call(this, this[this.tmp.area].tokens[next], Item, item);
    }
	CSL.citeEnd.call(this, Item);
	this.parallel.CloseCite(this);
	if (!this.tmp.cite_renders_content && !this.tmp.just_looking) {
		if (this.tmp.area === "bibliography") {
			error_object = {
				index: this.tmp.bibliography_pos,
				itemID: "" + Item.id,
				error_code: CSL.ERROR_NO_RENDERED_FORM
			};
			this.tmp.bibliography_errors.push(error_object);
		}
	}
	return "" + Item.id;
};
CSL.citeStart = function (Item) {
	this.tmp.lastchr = "";
	this.tmp.have_collapsed = true;
	this.tmp.render_seen = false;
	if (this.tmp.disambig_request  && ! this.tmp.disambig_override) {
		this.tmp.disambig_settings = this.tmp.disambig_request;
	} else if (this.registry.registry[Item.id] && ! this.tmp.disambig_override) {
		this.tmp.disambig_request = this.registry.registry[Item.id].disambig;
		this.tmp.disambig_settings = this.registry.registry[Item.id].disambig;
	} else {
		this.tmp.disambig_settings = new CSL.AmbigConfig();
	}
	this.tmp.names_used = [];
	this.tmp.nameset_counter = 0;
	this.tmp.years_used = [];
	this.tmp.names_max.clear();
	this.tmp.splice_delimiter = this[this.tmp.area].opt.layout_delimiter;
	this.bibliography_sort.keys = [];
	this.citation_sort.keys = [];
	this.tmp.count_offset_characters = false;
	this.tmp.offset_characters = 0;
	this.tmp.has_done_year_suffix = false;
	CSL.Util.Names.initNameSlices(this);
	this.tmp.last_cite_locale = false;
};
CSL.citeEnd = function (Item) {
	if (this.tmp.last_suffix_used && this.tmp.last_suffix_used.match(/[\-.,;:]$/)) {
		this.tmp.splice_delimiter = " ";
	} else if (this.tmp.prefix.value() && this.tmp.prefix.value().match(/^[.,:;a-z]/)) {
		this.tmp.splice_delimiter = " ";
	}
	this.tmp.last_suffix_used = this.tmp.suffix.value();
	this.tmp.last_years_used = this.tmp.years_used.slice();
	this.tmp.last_names_used = this.tmp.names_used.slice();
	this.tmp.cut_var = false;
	if (this.tmp.disambig_restore && this.registry.registry[Item.id]) {
		this.registry.registry[Item.id].disambig = this.tmp.disambig_restore;
	}
	this.tmp.disambig_request = false;
	if (!this.tmp.suppress_decorations && this.tmp.offset_characters) {
		this.registry.registry[Item.id].offset = this.tmp.offset_characters;
	}
	this.tmp.cite_locales.push(this.tmp.last_cite_locale);
};
CSL.Node = {};
CSL.Node.bibliography = {
	build: function (state, target) {
		if (this.tokentype === CSL.START) {
			state.fixOpt(this, "names-delimiter", "delimiter");
			state.fixOpt(this, "name-delimiter", "delimiter");
			state.fixOpt(this, "name-form", "form");
			state.fixOpt(this, "and", "and");
			state.fixOpt(this, "delimiter-precedes-last", "delimiter-precedes-last");
			state.fixOpt(this, "delimiter-precedes-et-al", "delimiter-precedes-et-al");
			state.fixOpt(this, "initialize-with", "initialize-with");
			state.fixOpt(this, "name-as-sort-order", "name-as-sort-order");
			state.fixOpt(this, "sort-separator", "sort-separator");
			state.fixOpt(this, "et-al-min", "et-al-min");
			state.fixOpt(this, "et-al-use-first", "et-al-use-first");
			state.fixOpt(this, "et-al-use-last", "et-al-use-last");
			state.fixOpt(this, "et-al-subsequent-min", "et-al-subsequent-min");
			state.fixOpt(this, "et-al-subsequent-use-first", "et-al-subsequent-use-first");
			state.build.area_return = state.build.area;
			state.build.area = "bibliography";
		}
		if (this.tokentype === CSL.END) {
			state.build.area = state.build.area_return;
		}
		target.push(this);
	}
};
CSL.Node.choose = {
	build: function (state, target) {
		var func;
		if (this.tokentype === CSL.START) {
			func = function (state, Item) {
				state.tmp.jump.push(undefined, CSL.LITERAL);
			};
		}
		if (this.tokentype === CSL.END) {
			func = function (state, Item) {
				state.tmp.jump.pop();
			};
		}
		this.execs.push(func);
		target.push(this);
	},
	configure: function (state, pos) {
		if (this.tokentype === CSL.END) {
			state.configure.fail.push((pos));
			state.configure.succeed.push((pos));
		} else {
			state.configure.fail.pop();
			state.configure.succeed.pop();
		}
	}
};
CSL.localeResolve = function (langstr) {
	var ret, langlst;
	ret = {};
	langlst = langstr.split(/[\-_]/);
	ret.base = CSL.LANG_BASES[langlst[0]];
	if ("undefined" === typeof ret.base) {
		CSL.error("unknown locale "+langstr+", setting to en-US");
		return {base:"en-US", best:"en-US", bare:"en"};
	}
	if (langlst.length === 1 || langlst[1] === "x") {
		ret.best = ret.base.replace("_", "-");
	} else {
		ret.best = langlst.slice(0, 2).join("-");
	}
	ret.base = ret.base.replace("_", "-");
	ret.bare = langlst[0];
	return ret;
};
CSL.localeParse = function (arg) {
	return arg;
}
CSL.Engine.prototype.localeConfigure = function (langspec) {
	var localexml;
	localexml = this.sys.xml.makeXml(this.sys.retrieveLocale("en-US"));
	this.localeSet(localexml, "en-US", langspec.best);
	if (langspec.best !== "en-US") {
		if (langspec.base !== langspec.best) {
			localexml = this.sys.xml.makeXml(this.sys.retrieveLocale(langspec.base));
			this.localeSet(localexml, langspec.base, langspec.best);
		}
		localexml = this.sys.xml.makeXml(this.sys.retrieveLocale(langspec.best));
		this.localeSet(localexml, langspec.best, langspec.best);		
	}
	this.localeSet(this.cslXml, "", langspec.best);
	this.localeSet(this.cslXml, langspec.bare, langspec.best);
	if (langspec.base !== langspec.best) {
		this.localeSet(this.cslXml, langspec.base, langspec.best);
	}
	this.localeSet(this.cslXml, langspec.best, langspec.best);
}
CSL.Engine.prototype.localeSet = function (myxml, lang_in, lang_out) {
	var blob, locale, nodes, attributes, pos, ppos, term, form, termname, styleopts, attr, date, attrname, len, genderform, target;
	lang_in = lang_in.replace("_", "-");
	lang_out = lang_out.replace("_", "-");
	if (!this.locale[lang_out]) {
		this.locale[lang_out] = {};
		this.locale[lang_out].terms = {};
		this.locale[lang_out].opts = {};
		this.locale[lang_out].dates = {};
	}
	locale = this.sys.xml.makeXml();
	if (this.sys.xml.nodeNameIs(myxml, 'locale')) {
		locale = myxml;
	} else {
		nodes = this.sys.xml.getNodesByName(myxml, "locale");
		for (pos = 0, len = this.sys.xml.numberofnodes(nodes); pos < len; pos += 1) {
			blob = nodes[pos];
			if (this.sys.xml.getAttributeValue(blob, 'lang', 'xml') === lang_in) {
				locale = blob;
				break;
			}
		}
	}
	nodes = this.sys.xml.getNodesByName(locale, 'term');
	for (pos = 0, len = this.sys.xml.numberofnodes(nodes); pos < len; pos += 1) {
		term = nodes[pos];
		termname = this.sys.xml.getAttributeValue(term, 'name');
		if ("undefined" === typeof this.locale[lang_out].terms[termname]) {
			this.locale[lang_out].terms[termname] = {};
		}
		form = "long";
		genderform = false;
		if (this.sys.xml.getAttributeValue(term, 'form')) {
			form = this.sys.xml.getAttributeValue(term, 'form');
		}
		if (this.sys.xml.getAttributeValue(term, 'gender-form')) {
			genderform = this.sys.xml.getAttributeValue(term, 'gender-form');
		}
		if (this.sys.xml.getAttributeValue(term, 'gender')) {
			this.opt["noun-genders"][termname] = this.sys.xml.getAttributeValue(term, 'gender');
		}
		if (genderform) {
			this.locale[lang_out].terms[termname][genderform] = {};
			this.locale[lang_out].terms[termname][genderform][form] = [];
			target = this.locale[lang_out].terms[termname][genderform];
		} else {
			this.locale[lang_out].terms[termname][form] = [];
			target = this.locale[lang_out].terms[termname];
		}
		if (this.sys.xml.numberofnodes(this.sys.xml.getNodesByName(term, 'multiple'))) {
			target[form][0] = this.sys.xml.getNodeValue(term, 'single');
			target[form][1] = this.sys.xml.getNodeValue(term, 'multiple');
		} else {
			target[form] = this.sys.xml.getNodeValue(term);
		}
	}
	for (termname in this.locale[lang_out].terms) {
		for (var i = 0, ilen = 2; i < ilen; i += 1) {
			genderform = CSL.GENDERS[i];
			if (this.locale[lang_out].terms[termname][genderform]) {
				for (form in this.locale[lang_out].terms[termname]) {
					if (!this.locale[lang_out].terms[termname][genderform][form]) {
						this.locale[lang_out].terms[termname][genderform][form] = this.locale[lang_out].terms[termname][form];
					}
				}
			}
		}
	}
	nodes = this.sys.xml.getNodesByName(locale, 'style-options');
	for (pos = 0, len = this.sys.xml.numberofnodes(nodes); pos < len; pos += 1) {
		if (true) {
			styleopts = nodes[pos];
			attributes = this.sys.xml.attributes(styleopts);
			for (attrname in attributes) {
				if (attributes.hasOwnProperty(attrname)) {
					if (attributes[attrname] === "true") {
						this.locale[lang_out].opts[attrname.slice(1)] = true;
					} else {
						this.locale[lang_out].opts[attrname.slice(1)] = false;
					}
				}
			}
		}
	}
	nodes = this.sys.xml.getNodesByName(locale, 'date');
	for (pos = 0, len = this.sys.xml.numberofnodes(nodes); pos < len; pos += 1) {
		if (true) {
			date = nodes[pos];
			this.locale[lang_out].dates[this.sys.xml.getAttributeValue(date, "form")] = date;
		}
	}
};
CSL.Node.citation = {
	build: function (state, target) {
		if (this.tokentype === CSL.START) {
			state.fixOpt(this, "names-delimiter", "delimiter");
			state.fixOpt(this, "name-delimiter", "delimiter");
			state.fixOpt(this, "name-form", "form");
			state.fixOpt(this, "and", "and");
			state.fixOpt(this, "delimiter-precedes-last", "delimiter-precedes-last");
			state.fixOpt(this, "delimiter-precedes-et-al", "delimiter-precedes-et-al");
			state.fixOpt(this, "initialize-with", "initialize-with");
			state.fixOpt(this, "name-as-sort-order", "name-as-sort-order");
			state.fixOpt(this, "sort-separator", "sort-separator");
			state.fixOpt(this, "et-al-min", "et-al-min");
			state.fixOpt(this, "et-al-use-first", "et-al-use-first");
			state.fixOpt(this, "et-al-use-last", "et-al-use-last");
			state.fixOpt(this, "et-al-subsequent-min", "et-al-subsequent-min");
			state.fixOpt(this, "et-al-subsequent-use-first", "et-al-subsequent-use-first");
			state.build.area_return = state.build.area;
			state.build.area = "citation";
		}
		if (this.tokentype === CSL.END) {
			state.build.area = state.build.area_return;
		}
	}
};
CSL.Node.date = {
	build: function (state, target) {
		var func, date_obj, tok, len, pos, part, dpx, parts, mypos, start, end;
		if (this.tokentype === CSL.START || this.tokentype === CSL.SINGLETON) {
			state.build.date_parts = [];
			state.build.date_variables = this.variables;
			if (!state.build.sort_flag) {
				CSL.Util.substituteStart.call(this, state, target);
			}
			func = function (state, Item) {
				var key, dp;
				state.tmp.element_rendered_ok = false;
				state.tmp.donesies = [];
				state.tmp.dateparts = [];
				dp = [];
				if (this.variables.length) {
					state.parallel.StartVariable(this.variables[0]);
					date_obj = Item[this.variables[0]];
					if ("undefined" === typeof date_obj) {
						date_obj = {"date-parts": [[0]] };
					}
					if (date_obj.raw) {
						date_obj = state.fun.dateparser.parse(date_obj.raw);
					}
					state.tmp.date_object = state.dateParseArray(date_obj);
					len = this.dateparts.length;
					for (pos = 0; pos < len; pos += 1) {
						part = this.dateparts[pos];
						if ("undefined" !== typeof state.tmp.date_object[(part +  "_end")]) {
							dp.push(part);
						} else if (part === "month" && "undefined" !== typeof state.tmp.date_object.season_end) {
							dp.push(part);
						}
					}
					dpx = [];
					parts = ["year", "month", "day"];
					len = parts.length;
					for (pos = 0; pos < len; pos += 1) {
						if (dp.indexOf(parts[pos]) > -1) {
							dpx.push(parts[pos]);
						}
					}
					dp = dpx.slice();
					if (state.tmp.area.slice(-5) !== "_sort" && ("" + Item.volume) === "" + state.tmp.date_object.year && this.dateparts.length === 1 && this.dateparts[0] === "year") {
						for (key in state.tmp.date_object) {
							if (state.tmp.date_object.hasOwnProperty(key)) {
								if (key.slice(0, 4) === "year" && state.tmp.citeblob.can_suppress_identical_year) {
									delete state.tmp.date_object[key];
								}
							}
						}
					}
					mypos = 2;
					len = dp.length;
					for (pos = 0; pos < len; pos += 1) {
						part = dp[pos];
						start = state.tmp.date_object[part];
						end = state.tmp.date_object[(part + "_end")];
						if (start !== end) {
							mypos = pos;
							break;
						}
					}
					state.tmp.date_collapse_at = dp.slice(mypos);
				} else {
					state.tmp.date_object = false;
				}
			};
			this.execs.push(func);
			func = function (state, Item) {
				state.output.startTag("date", this);
			};
			this.execs.push(func);
		}
		if (state.build.sort_flag && (this.tokentype === CSL.END || this.tokentype === CSL.SINGLETON)) {
			tok = new CSL.Token("key", CSL.SINGLETON);
			tok.dateparts = state.build.date_parts.slice();
			tok.variables = state.build.date_variables;
			CSL.Node.key.build.call(tok, state, target);
			state.build.sort_flag = false;
		}
		if (!state.build.sort_flag && (this.tokentype === CSL.END || this.tokentype === CSL.SINGLETON)) {
			func = function (state, Item) {
				state.output.endTag();
				state.parallel.CloseVariable("date");
			};
			this.execs.push(func);
		}
		target.push(this);
		if (this.tokentype === CSL.END || this.tokentype === CSL.SINGLETON) {
			if (!state.build.sort_flag) {
				CSL.Util.substituteEnd.call(this, state, target);
			}
		}
	}
};
CSL.Node["date-part"] = {
	build: function (state, target) {
		var func, pos, len, decor, first_date, value, value_end, real, have_collapsed, invoked, precondition, known_year, bc, ad, bc_end, ad_end, ready, curr, dcurr, number, num, formatter, item;
		if (!this.strings.form) {
			this.strings.form = "long";
		}
		state.build.date_parts.push(this.strings.name);
		func = function (state, Item) {
			first_date = true;
			value = "";
			value_end = "";
			state.tmp.donesies.push(this.strings.name);
			if (state.tmp.date_object.literal && "year" === this.strings.name) {
				state.parallel.AppendToVariable(state.tmp.date_object.literal);
				state.output.append(state.tmp.date_object.literal, this);
			}
			if (state.tmp.date_object) {
				value = state.tmp.date_object[this.strings.name];
				value_end = state.tmp.date_object[(this.strings.name + "_end")];
			}
			if ("year" === this.strings.name && value === 0 && !state.tmp.suppress_decorations) {
				value = false;
			}
			real = !state.tmp.suppress_decorations;
			have_collapsed = state.tmp.have_collapsed;
			invoked = state[state.tmp.area].opt.collapse === "year-suffix" || state[state.tmp.area].opt.collapse === "year-suffix-ranged";
			precondition = state.opt["disambiguate-add-year-suffix"];
			if (real && precondition && invoked) {
				state.tmp.years_used.push(value);
				known_year = state.tmp.last_years_used.length >= state.tmp.years_used.length;
				if (known_year && have_collapsed) {
					if (state.tmp.last_years_used[(state.tmp.years_used.length - 1)] === value) {
						value = false;
					}
				}
			}
			if ("undefined" !== typeof value) {
				bc = false;
				ad = false;
				bc_end = false;
				ad_end = false;
				if ("year" === this.strings.name) {
					if (parseInt(value, 10) < 500 && parseInt(value, 10) > 0) {
						ad = state.getTerm("ad");
					}
					if (parseInt(value, 10) < 0) {
						bc = state.getTerm("bc");
						value = (parseInt(value, 10) * -1);
					}
					if (value_end) {
						if (parseInt(value_end, 10) < 500 && parseInt(value_end, 10) > 0) {
							ad_end = state.getTerm("ad");
						}
						if (parseInt(value_end, 10) < 0) {
							bc_end = state.getTerm("bc");
							value_end = (parseInt(value_end, 10) * -1);
						}
					}
				}
				state.parallel.AppendToVariable(value);
				var monthnameid = ""+state.tmp.date_object.month;
				while (monthnameid.length < 2) {
					monthnameid = "0"+monthnameid;
				}
				monthnameid = "month-"+monthnameid;
				var gender = state.opt["noun-genders"][monthnameid];
				if (this.strings.form) {
					value = CSL.Util.Dates[this.strings.name][this.strings.form](state, value, gender);
					if (value_end) {
						value_end = CSL.Util.Dates[this.strings.name][this.strings.form](state, value_end, gender);
					}
				}
				state.output.openLevel("empty");
				if (state.tmp.date_collapse_at.length) {
					ready = true;
					len = state.tmp.date_collapse_at.length;
					for (pos = 0; pos < len; pos += 1) {
						item = state.tmp.date_collapse_at[pos];
						if (state.tmp.donesies.indexOf(item) === -1) {
							ready = false;
							break;
						}
					}
					if (ready) {
						if ("" + value_end !== "0") {
							if (state.dateput.queue.length === 0) {
								first_date = true;
							}
							state.dateput.append(value_end, this);
							if (first_date) {
								state.dateput.current.value()[0].strings.prefix = "";
							}
						}
						state.output.append(value, this);
						curr = state.output.current.value();
						curr.blobs[(curr.blobs.length - 1)].strings.suffix = "";
						state.output.append(this.strings["range-delimiter"], "empty");
						dcurr = state.dateput.current.value();
						curr.blobs = curr.blobs.concat(dcurr);
						state.dateput.string(state, state.dateput.queue);
						state.tmp.date_collapse_at = [];
					} else {
						state.output.append(value, this);
						if (state.tmp.date_collapse_at.indexOf(this.strings.name) > -1) {
							if ("" + value_end !== "0") {
								if (state.dateput.queue.length === 0) {
									first_date = true;
								}
								state.dateput.openLevel("empty");
								state.dateput.append(value_end, this);
								if (first_date) {
									state.dateput.current.value().blobs[0].strings.prefix = "";
								}
								if (bc) {
									state.dateput.append(bc);
								}
								if (ad) {
									state.dateput.append(ad);
								}
								state.dateput.closeLevel();
							}
						}
					}
				} else {
					state.output.append(value, this);
				}
				if (bc) {
					state.output.append(bc);
				}
				if (ad) {
					state.output.append(ad);
				}
				state.output.closeLevel();
			} else if ("month" === this.strings.name) {
				if (state.tmp.date_object.season) {
					value = "" + state.tmp.date_object.season;
					if (value && value.match(/^[1-4]$/)) {
						state.tmp.term_sibling.replace([false, false, true]);
						state.output.append(state.getTerm(("season-0" + value)), this);
					} else if (value) {
						state.output.append(value, this);
					}
				}
			}
			state.tmp.value = [];
			if (!state.opt.has_year_suffix && "year" === this.strings.name && !state.tmp.just_looking) {
				if (state.registry.registry[Item.id] && state.registry.registry[Item.id].disambig.year_suffix !== false && !state.tmp.has_done_year_suffix) {
					state.tmp.has_done_year_suffix = true;
					num = parseInt(state.registry.registry[Item.id].disambig.year_suffix, 10);
					number = new CSL.NumericBlob(num, this);
					formatter = new CSL.Util.Suffixator(CSL.SUFFIX_CHARS);
					number.setFormatter(formatter);
					if (state[state.tmp.area].opt.collapse === "year-suffix-ranged") {
						number.range_prefix = "-";
					}
					if (state[state.tmp.area].opt["year-suffix-delimiter"]) {
						number.successor_prefix = state[state.build.area].opt["year-suffix-delimiter"];
					}
					state.output.append(number, "literal");
				}
			}
		};
		this.execs.push(func);
		if ("undefined" === typeof this.strings["range-delimiter"]) {
			this.strings["range-delimiter"] = "\u2013";
		}
		target.push(this);
	}
};
CSL.Node["else-if"] = {
	build: function (state, target) {
		var func, tryposition;
		if (this.tokentype === CSL.START || this.tokentype === CSL.SINGLETON) {
			if (this.locale) {
				state.opt.lang = this.locale;
			}
		    if (! this.evaluator) {
				this.evaluator = state.fun.match.any;
		    }
		}
		if (this.tokentype === CSL.END || this.tokentype === CSL.SINGLETON) {
			func = function (state, Item) {
				if (this.locale_default) {
					state.output.current.value().old_locale = this.locale_default;
					state.output.closeLevel("empty");
					state.opt.lang = this.locale_default;
				}
				var next = this[state.tmp.jump.value()];
				return next;
			};
			this.execs.push(func);
			if (this.locale_default) {
				state.opt.lang = this.locale_default;
			}
		}
		target.push(this);
	},
	configure: function (state, pos) {
		if (this.tokentype === CSL.START) {
			this.fail = state.configure.fail.slice(-1)[0];
			this.succeed = this.next;
			state.configure.fail[(state.configure.fail.length - 1)] = pos;
		} else if (this.tokentype === CSL.SINGLETON) {
			this.fail = this.next;
			this.succeed = state.configure.succeed.slice(-1)[0];
			state.configure.fail[(state.configure.fail.length - 1)] = pos;
		} else {
			this.succeed = state.configure.succeed.slice(-1)[0];
			this.fail = this.next;
		}
	}
};
CSL.Node["else"] = {
	build: function (state, target) {
		target.push(this);
	},
	configure: function (state, pos) {
		if (this.tokentype === CSL.START) {
			state.configure.fail[(state.configure.fail.length - 1)] = pos;
		}
	}
};
CSL.Node["#comment"] = {
       build: function (state, target) {
		   CSL.debug("CSL processor warning: comment node reached");
       }
};
CSL.Node["et-al"] = {
	build: function (state, target) {
		var func;
		if (state.build.area === "citation") {
			func = function (state, Item) {
				state.output.addToken("et-al-pers", false, this);
				state.output.addToken("et-al-org", false, this);
			};
			this.execs.push(func);
		} else if (state.build.area === "bibliography") {
			func = function (state, Item) {
				state.output.addToken("et-al-pers", false, this);
				state.output.addToken("et-al-org", false, this);
			};
			this.execs.push(func);
		}
		target.push(this);
	}
};
CSL.Node.group = {
	build: function (state, target, quashquash) {
		var func, execs;
		if (this.tokentype === CSL.START) {
			CSL.Util.substituteStart.call(this, state, target);
			if (state.build.substitute_level.value()) {
				state.build.substitute_level.replace((state.build.substitute_level.value() + 1));
			}
			if (!quashquash || true) {
				func = function (state, Item) {
					state.tmp.term_sibling.push([false, false, false], CSL.LITERAL);
				};
				this.execs.push(func);
			}
			func = function (state, Item) {
				state.output.startTag("group", this);
			};
			execs = [];
			execs.push(func);
			this.execs = execs.concat(this.execs);
		} else {
			if (!quashquash || true) {
				func = function (state, Item) {
					var flag = state.tmp.term_sibling.value();
					state.output.endTag();
					if (!flag[2] && (flag[1] || (!flag[1] && !flag[0]))) {
						if (state.output.current.value().blobs) {
							state.output.current.value().blobs.pop();
						}
					}
					state.tmp.term_sibling.pop();
					if ((flag[2] || (!flag[1] && flag[0])) && state.tmp.term_sibling.mystack.length > 1) {
						state.tmp.term_sibling.replace([false, false, true]);
					}
				};
				this.execs.push(func);
			}
		}
		target.push(this);
		if (this.tokentype === CSL.END) {
			if (state.build.substitute_level.value()) {
				state.build.substitute_level.replace((state.build.substitute_level.value() - 1));
			}
			CSL.Util.substituteEnd.call(this, state, target);
		}
	}
};
CSL.Node["if"] = {
	build: function (state, target) {
		var func;
		if (this.tokentype === CSL.START || this.tokentype === CSL.SINGLETON) {
			if (this.locale) {
				state.opt.lang = this.locale;
			}
		    if (!this.evaluator) {
				this.evaluator = state.fun.match.any;
		    }
		}
		if (this.tokentype === CSL.END || this.tokentype === CSL.SINGLETON) {
			func = function (state, Item) {
				if (this.locale_default) {
					state.output.current.value().old_locale = this.locale_default;
					state.output.closeLevel("empty");
					state.opt.lang = this.locale_default;
				}
				var next = this[state.tmp.jump.value()];
				return next;
			};
			this.execs.push(func);
			if (this.locale_default) {
				state.opt.lang = this.locale_default;
			}
		}
		target.push(this);
	},
	configure: function (state, pos) {
		if (this.tokentype === CSL.START) {
			this.fail = state.configure.fail.slice(-1)[0];
			this.succeed = this.next;
		} else if (this.tokentype === CSL.SINGLETON) {
			this.fail = this.next;
			this.succeed = state.configure.succeed.slice(-1)[0];
		} else {
			this.succeed = state.configure.succeed.slice(-1)[0];
			this.fail = this.next;
		}
	}
};
CSL.Node.info = {
	build: function (state, target) {
		if (this.tokentype === CSL.START) {
			state.build.skip = "info";
		} else {
			state.build.skip = false;
		}
	}
};
CSL.Node.institution = {
	build: function (state, target) {
		if ([CSL.SINGLETON, CSL.START].indexOf(this.tokentype) > -1) {
			var func = function (state, Item) {
				state.output.addToken("institution", false, this);
			};
			this.execs.push(func);
		}
		target.push(this);
	},
	configure: function (state, pos) {
		if ([CSL.SINGLETON, CSL.START].indexOf(this.tokentype) > -1) {
			state.build.has_institution = true;
		}
	}
};
CSL.Node["institution-part"] = {
	build: function (state, target) {
		var func;
		if ("long" === this.strings.name) {
			if (this.strings["if-short"]) {
				func = function (state, Item) {
					state.output.addToken("institution-if-short", false, this);
				};
			} else {
				func = function (state, Item) {
					state.output.addToken("institution-long", false, this);
				};
			}
		} else if ("short" === this.strings.name) {
			func = function (state, Item) {
				state.output.addToken("institution-short", false, this);
			};
		}
		this.execs.push(func);
		target.push(this);
	}
};
CSL.Node.key = {
	build: function (state, target) {
		var start_key, func, sort_direction, variable, names_start_token, name_token, names_end_token, single_text, token, pos, keypos, ppos, len, llen, tok, gtok, saveme, end_key, tlen, tlst, debug;
		debug = false;
		start_key = new CSL.Token("key", CSL.START);
		start_key.strings["et-al-min"] = this.strings["et-al-min"];
		start_key.strings["et-al-use-first"] = this.strings["et-al-use-first"];
		start_key.strings["et-al-use-last"] = this.strings["et-al-use-last"];
		func = function (state, Item) {
			state.tmp.done_vars = [];
		};
		start_key.execs.push(func);
		sort_direction = [];
		if (this.strings.sort_direction === CSL.DESCENDING) {
			sort_direction.push(1);
			sort_direction.push(-1);
		} else {
			sort_direction.push(-1);
			sort_direction.push(1);
		}
		state[state.build.area].opt.sort_directions.push(sort_direction);
		func = function (state, Item) {
			state.tmp.sort_key_flag = true;
			if (this.strings["et-al-min"]) {
				state.tmp["et-al-min"] = this.strings["et-al-min"];
			}
			if (this.strings["et-al-use-first"]) {
				state.tmp["et-al-use-first"] = this.strings["et-al-use-first"];
			}
			if (this.strings["et-al-use-last"]) {
				state.tmp["et-al-use-last"] = this.strings["et-al-use-last"];
			}
		};
		start_key.execs.push(func);
		target.push(start_key);
		if (this.variables.length) {
			variable = this.variables[0];
			if (variable === "citation-number" && state.build.area === "citation_sort") {
				state.opt.citation_number_sort = true;
			}
			if (CSL.CREATORS.indexOf(variable) > -1) {
				names_start_token = new CSL.Token("names", CSL.START);
				names_start_token.tokentype = CSL.START;
				names_start_token.variables = this.variables;
				CSL.Node.names.build.call(names_start_token, state, target);
				name_token = new CSL.Token("name", CSL.SINGLETON);
				name_token.tokentype = CSL.SINGLETON;
				name_token.strings["name-as-sort-order"] = "all";
				CSL.Node.name.build.call(name_token, state, target);
				names_end_token = new CSL.Token("names", CSL.END);
				names_end_token.tokentype = CSL.END;
				CSL.Node.names.build.call(names_end_token, state, target);
			} else {
				single_text = new CSL.Token("text", CSL.SINGLETON);
				single_text.dateparts = this.dateparts;
				if (CSL.NUMERIC_VARIABLES.indexOf(variable) > -1) {
					func = function (state, Item) {
						var num, m;
						num = false;
						if ("citation-number" === variable) {
							num = state.registry.registry[Item.id].seq.toString();
						} else {
							num = Item[variable];
						}
						if (num) {
							num = CSL.Util.padding(num);
						}
						state.output.append(num, this);
					};
				} else if (CSL.DATE_VARIABLES.indexOf(variable) > -1) {
					func = function (state, Item) {
						var dp, elem, value, e, yr, prefix;
						dp = Item[variable];
						if ("undefined" === typeof dp) {
							dp = {"date-parts": [[0]] };
							if (!dp.year) {
								state.tmp.empty_date = true;
							}
						}
						if ("undefined" === typeof this.dateparts) {
							this.dateparts = ["year", "month", "day"];
						}
						if (dp.raw) {
							dp = state.fun.dateparser.parse(dp.raw);
						} else if (dp["date-parts"]) {
							dp = state.dateParseArray(dp);
						}
						if ("undefined" === typeof dp) {
							dp = {};
						}
						for (var i = 0, ilen = CSL.DATE_PARTS_INTERNAL.length; i < ilen; i += 1) {
							elem = CSL.DATE_PARTS_INTERNAL[i];
							value = 0;
							e = elem;
							if (e.slice(-4) === "_end") {
								e = e.slice(0, -4);
							}
							if (dp[elem] && this.dateparts.indexOf(e) > -1) {
								value = dp[elem];
							}
							if (elem.slice(0, 4) === "year") {
								yr = CSL.Util.Dates[e].numeric(state, value);
								prefix = "Y";
								if (yr[0] === "-") {
									prefix = "X";
									yr = yr.slice(1);
									yr = 9999 - parseInt(yr, 10);
								}
								state.output.append(CSL.Util.Dates[elem.slice(0, 4)].numeric(state, (prefix + yr)));
							} else {
								state.output.append(CSL.Util.Dates[e]["numeric-leading-zeros"](state, value));
							}
						}
						if (state.registry.registry[Item.id].disambig.year_suffix) {
							num = state.registry.registry[Item.id].disambig.year_suffix.toString();
							num = CSL.Util.padding(num);
						} else {
							num = CSL.Util.padding("0");
						}
						state.output.append("S"+num)
					};
				} else if ("title" === variable) {
					state.transform.init("empty", "title");
					state.transform.setTransformLocale("locale-sort");
					state.transform.setTransformFallback(true);
					func = state.transform.getOutputFunction();
				} else {
					func = function (state, Item) {
						var varval = Item[variable];
						state.output.append(varval, "empty");
					};
				}
				single_text.execs.push(func);
				target.push(single_text);
			}
		} else { // macro
			token = new CSL.Token("text", CSL.SINGLETON);
			token.postponed_macro = this.postponed_macro;
			tlen = target.length;
			keypos = false;
			CSL.expandMacro.call(state, token);
			for (var i = 0, ilen = target.slice(tlen).length; i < ilen; i += 1) {
				tok = target.slice(tlen)[i];
				if (tok && tok.name === "text" && tok.dateparts) {
					keypos = i;
					break;
				}
			}
			if (keypos) {
				saveme = target[(parseInt(keypos, 10) + parseInt(tlen, 10))];
				len = target.length - 1;
				for (pos = len; pos > tlen; pos += -1) {
					target.pop();
				}
				target.push(saveme);
				gtok = new CSL.Token("group", CSL.END);
				target.push(gtok);
			}
		}
		end_key = new CSL.Token("key", CSL.END);
		func = function (state, Item) {
			var keystring = state.output.string(state, state.output.queue);
			if ("string" !== typeof keystring || state.tmp.empty_date) {
				keystring = undefined;
				state.tmp.empty_date = false;
			}
			state[state.tmp.area].keys.push(keystring);
			state.tmp.value = [];
		};
		end_key.execs.push(func);
		func = function (state, Item) {
			state.tmp["et-al-min"] = false;
			state.tmp["et-al-use-first"] = false;
			state.tmp["et-al-use-last"] = false;
			state.tmp.sort_key_flag = false;
		};
		end_key.execs.push(func);
		target.push(end_key);
	}
};
CSL.Node.label = {
	build: function (state, target) {
		var func, term, plural, form, debug;
		debug = false;
		if (state.build.name_flag) {
			this.strings.label_position = CSL.AFTER;
		} else {
			this.strings.label_position = CSL.BEFORE;
		}
		func = function (state, Item) {
			state.output.addToken("label", false, this);
		};
		this.execs.push(func);
		if (state.build.term) {
			term = state.build.term;
			plural = false;
			if (!this.strings.form) {
				this.strings.form = "long";
			}
			func = function (state, Item, item) {
				var termtxt = CSL.evaluateLabel(this, state, Item, item, term);
				state.output.append(termtxt, this);
			};
			this.execs.push(func);
			state.build.plural = false;
			state.build.term = false;
			state.build.form = false;
		}
		target.push(this);
	}
};
CSL.evaluateLabel = function (node, state, Item, item, term, termvar) {
	var myterm;
	if ("locator" === term) {
		if (item && item.label) {
			myterm = item.label;
		}
		if (!myterm) {
			myterm = "page";
		}
	} else {
		myterm = term;
	}
	if (!termvar) {
		termvar = term;
	}
	var plural = node.strings.plural;
	if ("number" !== typeof plural) {
		if (CSL.CREATORS.indexOf(termvar) > -1) {
			var creatorCount = -1;
			var lastWasPerson = true;
			plural = 0;
			for (var i = 0, ilen = Item[termvar].length; i < ilen; i += 1) {
				if (Item[termvar][i].given) {
					creatorCount += 1;
					lastWasPerson = true;
				} else {
					if (!lastWasPerson) {
						creatorCount += 1;
					}
					lastWasPerson = false;
				}
				if (creatorCount) {
					plural = 1;
					break;
				}
			}
		} else if ("locator" == term) {
			if (item) {
				plural = CSL.evaluateStringPluralism(item.locator);				
			}
		} else if (Item[term]) {
			plural = CSL.evaluateStringPluralism(Item[term]);			
		}
		if ("number" !== typeof plural) {
			plural = 0;
		}
	}
	var termtxt = state.getTerm(myterm, node.strings.form, plural);
	if (node.strings["strip-periods"]) {
		termtxt = termtxt.replace(/\./g, "");
	}
	return termtxt;
}
CSL.evaluateStringPluralism = function (str) {
	if (str && str.match(/(?:[0-9], *[0-9]| and |&|[0-9] *- *[0-9])/)) {
		return 1;
	} else {
		return 0;
	}
};
CSL.Node.layout = {
	build: function (state, target) {
		var func, prefix_token, suffix_token;
		if (this.tokentype === CSL.START && !state.tmp.cite_affixes) {
			func = function (state, Item) {
				state.tmp.done_vars = [];
				state.tmp.rendered_name = false;
			};
			this.execs.push(func);
			func = function (state, Item) {
				state.tmp.sort_key_flag = false;
				state[state.tmp.area].opt.delimiter = "";
				if (this.strings.delimiter) {
					state[state.tmp.area].opt.delimiter = this.strings.delimiter;
				}
			};
			this.execs.push(func);
			func = function (state, Item) {
				state.tmp.nameset_counter = 0;
			};
			this.execs.push(func);
			func = function (state, Item) {
				state.output.openLevel("empty");
				state.tmp.citeblob = state.output.queue[state.output.queue.length - 1];
			};
			this.execs.push(func);
			target.push(this);
			if (state.build.area === "citation") {
				prefix_token = new CSL.Token("text", CSL.SINGLETON);
				func = function (state, Item, item) {
					var sp;
					if (item && item.prefix) {
						sp = "";
						if (item.prefix.match(CSL.ROMANESQUE_REGEXP)) {
							sp = " ";
						}
						state.output.append((item.prefix + sp), this);
					}
				};
				prefix_token.execs.push(func);
				target.push(prefix_token);
			}
		}
		if (this.locale_raw) {
			var my_tok = new CSL.Token("dummy", CSL.START);
			my_tok.locale = this.locale_raw;
			my_tok.strings.delimiter = this.strings.delimiter;
			my_tok.strings.suffix = this.strings.suffix;
			if (!state.tmp.cite_affixes) {
				state.tmp.cite_affixes = {};
			}
		}
		if (this.tokentype === CSL.START) {
			state.build.layout_flag = true;
			if (!this.locale_raw) {
				state[state.tmp.area].opt.topdecor = [this.decorations];
				state[(state.tmp.area + "_sort")].opt.topdecor = [this.decorations];
				state[state.build.area].opt.layout_prefix = this.strings.prefix;
				state[state.build.area].opt.layout_suffix = this.strings.suffix;
				state[state.build.area].opt.layout_delimiter = this.strings.delimiter;
				state[state.build.area].opt.layout_decorations = this.decorations;
				if (state.tmp.cite_affixes) {
					tok = new CSL.Token("else", CSL.START);
					CSL.Node["else"].build.call(tok, state, target);
				}
			} // !this.locale_raw
			if (this.locale_raw) {
				if (!state.build.layout_locale_flag) {
					var choose_tok = new CSL.Token("choose", CSL.START);
					CSL.Node.choose.build.call(choose_tok, state, target);
					my_tok.name = "if";
					CSL.Attributes["@locale"].call(my_tok, state, this.locale_raw);
					CSL.Node["if"].build.call(my_tok, state, target);
				} else {
					my_tok.name = "else-if";
					CSL.Attributes["@locale"].call(my_tok, state, this.locale_raw);
					CSL.Node["else-if"].build.call(my_tok, state, target);
				}
				state.tmp.cite_affixes[my_tok.locale] = {};
				state.tmp.cite_affixes[my_tok.locale].delimiter = this.strings.delimiter;
				state.tmp.cite_affixes[my_tok.locale].suffix = this.strings.suffix;
			}
		}
		if (this.tokentype === CSL.END) {
			if (this.locale_raw) {
				if (!state.build.layout_locale_flag) {
					my_tok.name = "if";
					my_tok.tokentype = CSL.END;
					CSL.Attributes["@locale"].call(my_tok, state, this.locale_raw);
					CSL.Node["if"].build.call(my_tok, state, target);
					state.build.layout_locale_flag = true;
				} else {
					my_tok.name = "else-if";
					my_tok.tokentype = CSL.END;
					CSL.Attributes["@locale"].call(my_tok, state, this.locale_raw);
					CSL.Node["else-if"].build.call(my_tok, state, target);
				}
			}
			if (!this.locale_raw) {
				if (state.tmp.cite_affixes) {
					tok = new CSL.Token("else", CSL.END);
					CSL.Node["else"].build.call(tok, state, target);
					tok = new CSL.Token("choose", CSL.END);
					CSL.Node.choose.build.call(tok, state, target);
				}
				state.build_layout_locale_flag = true;
				if (state.build.area === "citation") {
					suffix_token = new CSL.Token("text", CSL.SINGLETON);
					func = function (state, Item, item) {
						var sp;
						if (item && item.suffix) {
							sp = "";
							if (item.suffix.match(CSL.ROMANESQUE_REGEXP)) {
								sp = " ";
							}
							state.output.append((sp + item.suffix), this);
						}
					};
					suffix_token.execs.push(func);
					target.push(suffix_token);
				}
				func = function (state, Item) {
					if (state.tmp.area === "bibliography") {
						if (state.bibliography.opt["second-field-align"]) {
							state.output.endTag();
						}
					}
					state.output.closeLevel();
				};
				this.execs.push(func);
				target.push(this);
				state.build.layout_flag = false;
			} // !this.layout_raw
		}
	}
};
CSL.Node.macro = {
	build: function (state, target) {}
};
CSL.Node.name = {
	build: function (state, target) {
		var func, pos, len, attrname;
		if ([CSL.SINGLETON, CSL.START].indexOf(this.tokentype) > -1) {
			state.fixOpt(this, "name-delimiter", "delimiter");
			state.fixOpt(this, "name-form", "form");
			state.fixOpt(this, "and", "and");
			state.fixOpt(this, "delimiter-precedes-last", "delimiter-precedes-last");
			state.fixOpt(this, "delimiter-precedes-et-al", "delimiter-precedes-et-al");
			state.fixOpt(this, "initialize-with", "initialize-with");
			state.fixOpt(this, "name-as-sort-order", "name-as-sort-order");
			state.fixOpt(this, "sort-separator", "sort-separator");
			state.fixOpt(this, "et-al-min", "et-al-min");
			state.fixOpt(this, "et-al-use-first", "et-al-use-first");
			state.fixOpt(this, "et-al-use-last", "et-al-use-last");
			state.fixOpt(this, "et-al-subsequent-min", "et-al-subsequent-min");
			state.fixOpt(this, "et-al-subsequent-use-first", "et-al-subsequent-use-first");
			state.build.nameattrs = {};
			len = CSL.NAME_ATTRIBUTES.length;
			for (pos = 0; pos < len; pos += 1) {
				attrname = CSL.NAME_ATTRIBUTES[pos];
				state.build.nameattrs[attrname] = this.strings[attrname];
			}
			state.build.form = this.strings.form;
			state.build.name_flag = true;
			func = function (state, Item, item) {
				if ("undefined" === typeof item) {
					item = {};
				}
				if (item.position) {
					if (! state.tmp["et-al-min"]) {
						if (this.strings["et-al-subsequent-min"]) {
							if (state.registry.registry[Item.id]
								&& !state.registry.registry[Item.id].have_seen_subsequent) {
								state.registry.registry[Item.id].have_seen_subsequent = true;
								state.tmp.disambig_request = false;
							}
							state.tmp["et-al-min"] = this.strings["et-al-subsequent-min"];
						} else {
							state.tmp["et-al-min"] = this.strings["et-al-min"];
						}
					}
					if (! state.tmp["et-al-use-first"]) {
						if (this.strings["et-al-subsequent-use-first"]) {
							if (state.registry.registry[Item.id]
								&& !state.registry.registry[Item.id].have_seen_subsequent) {
								state.registry.registry[Item.id].have_seen_subsequent = true;
								state.tmp.disambig_request = false;
							}
							state.tmp["et-al-use-first"] = this.strings["et-al-subsequent-use-first"];
						} else {
							state.tmp["et-al-use-first"] = this.strings["et-al-use-first"];
						}
					}
				} else {
					if (! state.tmp["et-al-min"]) {
						state.tmp["et-al-min"] = this.strings["et-al-min"];
					}
					if (! state.tmp["et-al-use-first"]) {
						state.tmp["et-al-use-first"] = this.strings["et-al-use-first"];
					}
				}
				if ("undefined" !== typeof this.strings["et-al-use-last"]) {
					state.tmp["et-al-use-last"] = this.strings["et-al-use-last"];
				}
			};
			this.execs.push(func);
			func = function (state, Item) {
				state.output.addToken("name", false, this);
			};
			this.execs.push(func);
		}
		target.push(this);
	}
};
CSL.Node["name-part"] = {
	build: function (state, target) {
		var func;
		func = function (state, Item) {
			state.output.addToken(this.strings.name, false, this);
		};
		this.execs.push(func);
		target.push(this);
	}
};
CSL.Node.names = {
	build: function (state, target) {
		var debug, func, len, pos, attrname;
		debug = false;
		if (this.tokentype === CSL.START || this.tokentype === CSL.SINGLETON) {
			CSL.Util.substituteStart.call(this, state, target);
			state.build.substitute_level.push(1);
			state.fixOpt(this, "names-delimiter", "delimiter");
			func = function (state, Item, item) {
				var namesets, nameset, names, rawlist, after_people_set, pers_seen, in_orgs, last_type, name, len, pos, variable, rawvar, llen, ppos, lllen, pppos, lllst, end, mynameset, tnamesets, frontnames, pair, offset, swaplist;
				state.parallel.StartVariable("names");
				if (state.tmp.value.length === 0) {
					namesets = [];
					len = this.variables.length;
					if (len && state.opt.xclass === "in-text") {
						len = 1;
					}
					for (pos = 0; pos < len; pos += 1) {
						variable = this.variables[pos];
						if (Item[variable]) {
							rawlist = Item[variable];
							if ("string" === typeof Item[variable]) {
								rawlist = [{literal: Item[variable]}];
							}
							var rawlen = rawlist.length;
							if (state.opt.max_number_of_names && rawlen > 50 && rawlen > (state.opt.max_number_of_names + 2)) {
								rawlist = rawlist.slice(0, state.opt.max_number_of_names + 2);
							}
							names = [];
							tnamesets = [];
							nameset = {names: []};
							frontnames = [];
							llen = rawlist.length;
							for (ppos = 0; ppos < llen; ppos += 1) {
								name = rawlist[ppos];
								if (name.literal || (name.family && !name.given)) {
									nameset.variable = variable;
									nameset.species = "org";
									if (name.literal) {
										var lit = name.literal;
									} else {
										var lit = name.family;
									}
									if (lit.slice(0, 1) === '"' && lit.slice(-1)) {
										lllst = [lit.slice(1, -1)];
									} else {
										lllst = lit.split(/,\s+/);
									}
									lllen = lllst.length;
									for (pppos = 0; pppos < lllen; pppos += 1) {
										name = {literal: lllst[pppos], family:'', given:''};
										nameset.names.push(name);
									}
									tnamesets.push(nameset);
									nameset = {names: []};
								} else {
									nameset.variable = variable;
									nameset.species = "pers";
									nameset.names.push(name);
									if (rawlist.length === (ppos + 1) || rawlist[ppos + 1].literal) {
										tnamesets.push(nameset);
										nameset = {names: []};
									}
								}
							}
							if (tnamesets.length > 1 && tnamesets.slice(-1)[0].species === "pers") {
								frontnames = tnamesets.slice(-1);
								tnamesets = tnamesets.slice(0, tnamesets.length - 1);
								if (tnamesets.length > 0) {
									tnamesets[0].after_people = true;
								}
							}  else {
								frontnames = [];
							}
							if (tnamesets.length > 0 && tnamesets.slice(-1)[0].species === "org") {
								tnamesets[0].organization_first = true;
								tnamesets.slice(-1)[0].organization_last = true;
								if (frontnames.length) {
									frontnames[0].free_agent_start = true;
									tnamesets.slice(-1)[0].free_agent_end = true;
								}
							}
							if (frontnames.length === 0) {
								if (tnamesets.length > 1) {
									if (tnamesets[0].species === "pers") {
										tnamesets[1].trailers1_start = true;
										if (tnamesets.length === 2) {
											tnamesets[1].trailers1a_end = true;
										} else {
											tnamesets[1].trailers1b_end = true;
										}
										if (tnamesets.length > 2) {
											tnamesets[2].trailers2_start = true;
											tnamesets.slice(-1)[0].trailers2_end = true;
										}
									} else {
										tnamesets[1].trailers2_start = true;
										tnamesets.slice(-1)[0].trailers2_end = true;
									}
								}
							} else {
								tnamesets[0].trailers3_start = true;
								tnamesets.slice(-1)[0].trailers3_end = true;
							}
							tnamesets = frontnames.concat(tnamesets);
							namesets = namesets.concat(tnamesets);
						}
					}
					if ((state.opt.xclass === "in-text" && state.tmp.area.slice(0, 8) === "citation") || (state.opt.xclass === "note" && item && "number" === typeof item.position && item.position !== CSL.POSITION_FIRST)) {
						if (namesets.length > 1) {
							var creatorCount = -1;
							var lastWasPerson = true;
							state.tmp.forceEtAl = false;
							for (var i = 0, ilen = namesets.length; i < ilen; i += 1) {
								if ("pers" === namesets[i].species) {
									creatorCount += 1;
									lastWasPerson = true;
								} else {
									if (!lastWasPerson) {
										creatorCount += 1;
									}
									lastWasPerson = false;
								}
								if (creatorCount) {
									state.tmp.forceEtAl = true;
									break;
								}
							}
						}
						namesets = namesets.slice(0, 1);
						if (namesets.length) {
							if (namesets[0].species === "pers") {
								namesets[0].organization_first = false;
								namesets[0].after_people = false;
								namesets[0].free_agent_start = false;
								namesets[0].free_agent_end = false;
							} else {
								namesets[0].organization_last = true;
							}
						}
					}
					len = namesets.length;
					for (pos = 0; pos < len; pos += 1) {
						state.tmp.names_max.push(namesets[pos].names.length);
						state.tmp.names_used.push(namesets[pos]);
					}
					state.tmp.value = namesets.slice();
				}
			};
			this.execs.push(func);
		}
		if (this.tokentype === CSL.START) {
			state.build.names_flag = true;
			func = function (state, Item) {
				state.tmp.can_substitute.push(true);
			};
			this.execs.push(func);
			func = function (state, Item) {
				state.output.startTag("names", this);
				state.tmp.name_node = state.output.current.value();
			};
			this.execs.push(func);
		}
		if (this.tokentype === CSL.END) {
			len = CSL.NAME_ATTRIBUTES.length;
			for (pos = 0; pos < len; pos += 1) {
				attrname = CSL.NAME_ATTRIBUTES[pos];
				if (attrname.slice(0, 5) === "et-al") {
					continue;
				}
				if ("undefined" !== typeof state.build.nameattrs[attrname]) {
					this.strings[attrname] = state.build.nameattrs[attrname];
					delete state.build.nameattrs[attrname];
				}
			}
			func = function (state, Item, item) {
				var common_term, nameset, name, local_count, withtoken, namesetIndex, lastones, currentones, compset, display_names, suppress_min, suppress_condition, sane, discretionary_names_length, overlength, et_al, and_term, outer_and_term, use_first, append_last, delim, param, paramx, val, s, myform, myinitials, termname, form, namepart, namesets, llen, ppos, label, plural, last_variable, cutinfo, obj, et_al_pers, et_al_org, and_pers, and_org, with_term, chk, apply_ellipsis;
				namesets = [];
				common_term = CSL.Util.Names.getCommonTerm(state, state.tmp.value);
				if (common_term) {
					namesets = state.tmp.value.slice(0, 1);
				} else {
					namesets = state.tmp.value;
				}
				len = namesets.length;
				if (namesets.length && (state.tmp.area === "bibliography" || state.tmp.area === "bibliography_sort" || (state.tmp.area && state.opt.xclass === "note"))) {
				    if (state.tmp["et-al-min"] === 1 && state.tmp["et-al-use-first"] === 1) {
					state.tmp.cut_var = namesets[0].variable;
				    }
				    cutinfo = state.tmp.names_cut;
				    if (namesets[0].species === "pers") {
					if (state.tmp.cut_var) {
					    namesets[0].names = namesets[0].names.slice(cutinfo.counts[state.tmp.cut_var]);
					}
					if (namesets[0].names.length === 0) {
					    if (namesets[0].free_agent_start) {
						namesets[1].free_agent_start = true;
					    }
					    if (namesets[0].organization_first) {
						namesets[1].organization_first = true;
					    }
					    namesets = namesets.slice(1);
					}
				    } else {
					namesets = namesets.slice(0, 1);
					if (namesets[0].organization_first) {
					    namesets[0].organization_last = true;
					}
				    }
				    if (state.tmp.cut_var && cutinfo.used === state.tmp.cut_var) {
					llen = cutinfo.variable[state.tmp.cut_var].length - 1;
					for (ppos = llen; ppos > -1; ppos += -1) {
					    obj = cutinfo.variable[state.tmp.cut_var][ppos];
					    obj[0].blobs = obj[0].blobs.slice(0, obj[1]).concat(obj[0].blobs.slice(obj[1] + 1));
					}
				    }
				}
				if (!state.output.getToken("institution")) {
					state.output.addToken("institution");
				}
				len = namesets.length;
				for (pos = 0; pos < len; pos += 1) {
					nameset = namesets[pos];
					if ("org" === nameset.species) {
						if (state.output.getToken("institution").strings["reverse-order"]) {
							nameset.names.reverse();
						}
					}
				}
				local_count = 0;
				nameset = {};
				state.output.addToken("term-join");
				state.output.addToken("etal-join");
				state.output.addToken("space", " ");
				state.output.addToken("sortsep", state.output.getToken("name").strings["sort-separator"]);
				state.output.addToken("suffixsep", " ");
				if (!state.output.getToken("et-al-pers")) {
					state.output.addToken("et-al-pers");
				}
				var nametok = state.output.getToken("name");
				if (nametok.strings["delimiter-precedes-et-al"] === "always") {
					state.output.getToken("et-al-pers").strings["prefix-single"] = nametok.strings.delimiter;
					state.output.getToken("et-al-pers").strings["prefix-multiple"] = nametok.strings.delimiter;
				} else if (nametok.strings["delimiter-precedes-et-al"] === "never") {
					state.output.getToken("et-al-pers").strings["prefix-single"] = " ";
					state.output.getToken("et-al-pers").strings["prefix-multiple"] = " ";
				} else {
					state.output.getToken("et-al-pers").strings["prefix-single"] = " ";
					state.output.getToken("et-al-pers").strings["prefix-multiple"] = nametok.strings.delimiter;
				}
				et_al_pers = state.getTerm("et-al", "long", 0);
				if ("undefined" !== typeof state.output.getToken("et-al-pers").strings.term) {
					et_al_pers = state.output.getToken("et-al-pers").strings.term;
				}
				if (!state.output.getToken("et-al-org")) {
					state.output.addToken("et-al-org");
				}
				state.output.getToken("et-al-org").strings["prefix-single"] = " ";
				state.output.getToken("et-al-org").strings["prefix-multiple"] = ", ";
				et_al_org = state.getTerm("et-al", "long", 0);
				if (!state.output.getToken("and-pers")) {
					state.output.addToken("and-pers");
				}
				state.output.getToken("and-pers").strings["prefix-single"] = " ";
				state.output.getToken("and-pers").strings["prefix-multiple"] = ", ";
				and_pers = state.getTerm("and", "long", 0);
				if (!state.output.getToken("and-org")) {
					state.output.addToken("and-org");
				}
				state.output.getToken("and-org").strings["prefix-single"] = " ";
				state.output.getToken("and-org").strings["prefix-multiple"] = ", ";
				and_org = state.getTerm("and", "long", 0);
				state.output.addToken("with");
				state.output.getToken("with").strings.prefix = ", ";
				state.output.getToken("with").strings.suffix = " ";
				with_term = "with";
				state.output.addToken("trailing-names");
				outer_and_term = " " + state.output.getToken("name").strings.and + " ";
				state.output.addToken("institution-outer", outer_and_term);
				if (!state.output.getToken("label")) {
					state.output.addToken("label");
				}
				delim = state.output.getToken("name").strings.delimiter;
				state.output.addToken("inner", delim);
				state.output.addToken("commasep", ", ");
				len = CSL.DECORABLE_NAME_PARTS.length;
				for (pos = 0; pos < len; pos += 1) {
					namepart = CSL.DECORABLE_NAME_PARTS[pos];
					if (!state.output.getToken(namepart)) {
						state.output.addToken(namepart);
					}
				}
				state.output.addToken("dropping-particle", false, state.output.getToken("family"));
				state.output.addToken("non-dropping-particle", false, state.output.getToken("family"));
				state.output.addToken("suffix", false, state.output.getToken("family"));
				state.output.getToken("suffix").decorations = [];
				state.output.openLevel("term-join");
				len = namesets.length;
				for  (namesetIndex = 0; namesetIndex < len; namesetIndex += 1) {
					nameset = namesets[namesetIndex];
					label = false;
					var labelnode = state.output.getToken("label");
					if (state.output.getToken("label").strings.label_position) {
						if (common_term) {
							termname = common_term;
						} else {
							termname = nameset.variable;
						}
						label = CSL.evaluateLabel(labelnode, state, Item, item, termname, nameset.variable);
					}
					if (label && state.output.getToken("label").strings.label_position === CSL.BEFORE) {
						state.output.append(label, "label");
					}
					if (!state.tmp.suppress_decorations && (state[state.tmp.area].opt.collapse === "year" || state[state.tmp.area].opt.collapse === "year-suffix" || state[state.tmp.area].opt.collapse === "year-suffix-ranged")) {
						if (state.tmp.last_names_used.length === state.tmp.names_used.length) {
							lastones = state.tmp.last_names_used[state.tmp.nameset_counter];
							currentones = state.tmp.names_used[state.tmp.nameset_counter];
							compset = [currentones, lastones];
							if (CSL.Util.Names.getCommonTerm(state, compset)) {
								continue;
							} else {
								state.tmp.have_collapsed = false;
							}
						}
					}
					if (!state.tmp.disambig_request) {
						state.tmp.disambig_settings.givens[state.tmp.nameset_counter] = [];
					}
					display_names = nameset.names.slice();
					if ("pers" === nameset.species) {
						suppress_min = state.output.getToken("name").strings["suppress-min"];
						if (namesetIndex === 0 && !suppress_min && (state.tmp.area === "bibliography" || (state.tmp.area === "citation" && state.opt.xclass === "note"))) {
							state.tmp.names_cut.counts[nameset.variable] = state.tmp["et-al-use-first"];
						}
						sane = state.tmp["et-al-min"] >= state.tmp["et-al-use-first"];
						if (state.tmp["et-al-use-last"] && state.tmp["et-al-min"] >= state.tmp["et-al-use-first"] + 2) {
							apply_ellipsis = true;
						} else {
							apply_ellipsis = false;
						}
						discretionary_names_length = state.tmp["et-al-min"];
						suppress_condition = suppress_min && display_names.length >= suppress_min;
						if (suppress_condition) {
							continue;
						}
						if (state.tmp.suppress_decorations) {
							if (state.tmp.disambig_request) {
								discretionary_names_length = state.tmp.disambig_request.names[state.tmp.nameset_counter];
							} else if (display_names.length >= state.tmp["et-al-min"]) {
								discretionary_names_length = state.tmp["et-al-use-first"];
							}
						} else {
							if (state.tmp.disambig_request && state.tmp.disambig_request.names[state.tmp.nameset_counter] > state.tmp["et-al-use-first"]) {
								if (display_names.length < state.tmp["et-al-min"]) {
									discretionary_names_length = display_names.length;
								} else {
									discretionary_names_length = state.tmp.disambig_request.names[state.tmp.nameset_counter];
								}
							} else if (display_names.length >= state.tmp["et-al-min"]) {
								discretionary_names_length = state.tmp["et-al-use-first"];
							}
						}
						overlength = display_names.length > discretionary_names_length;
						if (discretionary_names_length > display_names.length) {
							discretionary_names_length = display_names.length;
						}
						et_al = false;
						and_term = "";
						if (sane && (overlength || state.tmp.forceEtAl)) {
							if (! state.tmp.sort_key_flag) {
								et_al = et_al_pers;
								if (discretionary_names_length > 1) {
									state.output.getToken("et-al-pers").strings.prefix = state.output.getToken("et-al-pers").strings["prefix-multiple"];
								} else {
									state.output.getToken("et-al-pers").strings.prefix = state.output.getToken("et-al-pers").strings["prefix-single"];
								}
							}
							if (apply_ellipsis) {
								state.tmp.use_ellipsis = true;
								display_names = display_names.slice(0, discretionary_names_length).concat(display_names.slice(-1));
							} else {
								display_names = display_names.slice(0, discretionary_names_length);
							}
						} else {
							if (!state.tmp.sort_key_flag) {
								if (display_names.length > 1) {
									if (state.output.getToken("name").strings.and) {
										and_term = state.output.getToken("name").strings.and;
									}
								}
							}
						}
						state.output.formats.value().name.strings.delimiter = and_term;
					} else {
						if (namesetIndex === 0 && (state.tmp.area === "bibliography" || (state.tmp.area === "citation" && state.opt.xclass === "note"))) {
							state.tmp.names_cut.counts[nameset.variable] = 1;
						}
						use_first = state.output.getToken("institution").strings["use-first"];
						if (!use_first && namesetIndex === 0) {
							use_first = state.output.getToken("institution").strings["substitute-use-first"];
						}
						if (!use_first) {
							use_first = 0;
						}
						append_last = state.output.getToken("institution").strings["use-last"];
						if (use_first || append_last) {
							s = display_names.slice();
							display_names = [];
							display_names = s.slice(0, use_first);
							s = s.slice(use_first);
							if (append_last) {
								if (append_last > s.length) {
									append_last = s.length;
								}
								if (append_last) {
									display_names = display_names.concat(s.slice((s.length - append_last)));
								}
							}
						}
					}
					state.tmp.disambig_settings.names[state.tmp.nameset_counter] = display_names.length;
					local_count += display_names.length;
					llen = nameset.names.length;
					for (ppos = 0; ppos < llen; ppos += 1) {
						state.registry.namereg.addname("" + Item.id, nameset.names[ppos], ppos);
						chk = state.tmp.disambig_settings.givens[state.tmp.nameset_counter];
						if ("undefined" === typeof chk) {
							state.tmp.disambig_settings.givens.push([]);
						}
						chk = state.tmp.disambig_settings.givens[state.tmp.nameset_counter][ppos];
						if ("undefined" === typeof chk) {
							myform = state.output.getToken("name").strings.form;
							myinitials = this.strings["initialize-with"];
							param = state.registry.namereg.evalname("" + Item.id, nameset.names[ppos], ppos, 0, myform, myinitials);
							state.tmp.disambig_settings.givens[state.tmp.nameset_counter].push(param);
						}
						myform = state.output.getToken("name").strings.form;
						myinitials = this.strings["initialize-with"];
						paramx = state.registry.namereg.evalname("" + Item.id, nameset.names[ppos], ppos, 0, myform, myinitials);
						if (state.tmp.sort_key_flag) {
							state.tmp.disambig_settings.givens[state.tmp.nameset_counter][ppos] = 2;
							param = 2;
						} else if (state.tmp.disambig_request) {
							val = state.tmp.disambig_settings.givens[state.tmp.nameset_counter][ppos];
							if (val === 1 && 
								state.opt["givenname-disambiguation-rule"] === "by-cite" && 
								"undefined" === typeof this.strings["initialize-with"]) {
								val = 2;
							}
							param = val;
							if (state.opt["disambiguate-add-givenname"]) {
								param = state.registry.namereg.evalname("" + Item.id, nameset.names[ppos], ppos, param, state.output.getToken("name").strings.form, this.strings["initialize-with"]);
							}
						} else {
							param = paramx;
						}
						if (!state.tmp.just_looking && item && item.position === CSL.POSITION_FIRST) {
							state.tmp.disambig_restore = CSL.cloneAmbigConfig(state.tmp.disambig_settings);
							param = paramx;
						}
						if (!state.tmp.sort_key_flag) {
							state.tmp.disambig_settings.givens[state.tmp.nameset_counter][ppos] = param;
						}
					}
					if (namesetIndex > 0 && nameset.variable !== last_variable) {
						state.output.closeLevel("term-join");
					}
					if (namesetIndex > 0 && nameset.variable !== last_variable) {
						state.output.openLevel("term-join");
					}
					if (nameset.trailers3_start) {
						state.output.openLevel("trailing-names", state.tmp.cut_var);
					}
					if (nameset.after_people) {
						state.output.append("with", "with");
					}
					if (nameset.organization_first) {
						state.output.openLevel("institution-outer");
					}
					if (nameset.trailers2_start) {
						state.output.openLevel("trailing-names", state.tmp.cut_var);
					}
					if (nameset.organization_first) {
						state.output.openLevel("inner");
					}
					if (nameset.trailers1_start) {
						state.output.openLevel("trailing-names", state.tmp.cut_var);
					}
					if (nameset.species === "pers") {
						state.output.openLevel("etal-join"); // join for etal
						CSL.Util.Names.outputNames(state, display_names);
						if (et_al && !state.tmp.use_ellipsis) {
							state.output.append(et_al, "et-al-pers");
						}
						state.output.closeLevel("etal-join"); // etal
					} else {
						CSL.Util.Institutions.outputInstitutions(state, display_names);
						if (nameset.organization_last) {
							if (nameset.trailers1a_end) {
								state.output.closeLevel("trailing-names");
							}
							state.output.closeLevel("inner");
							if (nameset.trailers2_end) {
								state.output.closeLevel("trailing-names");
							}
							state.output.closeLevel("institution-outer");
						} else {
							if (nameset.trailers1b_end) {
								state.output.closeLevel("trailing-names");
							}
							state.output.closeLevel("inner");
							state.output.openLevel("inner");
						}
					}
					if (nameset.trailers3_end) {
						state.output.closeLevel("trailing-names");
					}
					if (namesets.length === namesetIndex + 1 || namesets[namesetIndex + 1].variable !== namesets[namesetIndex].variable) {
						if (label && state.output.getToken("label").strings.label_position !== CSL.BEFORE) {
							state.output.append(label, "label");
						}
					}
					state.tmp.nameset_counter += 1;
					last_variable = nameset.variable;
				}
				state.output.closeLevel("term-join");
				if (state.output.getToken("name").strings.form === "count") {
					state.output.clearlevel();
					state.output.append(local_count.toString());
					state.tmp["et-al-min"] = false;
					state.tmp["et-al-use-first"] = false;
				}
			};
			this.execs.push(func);
		}
		if (this.tokentype === CSL.END) {
			func = function (state, Item) {
				if (!state.tmp.can_substitute.pop()) {
					state.tmp.can_substitute.replace(false, CSL.LITERAL);
				}
				CSL.Util.Names.reinit(state, Item);
				state.output.endTag();
				state.parallel.CloseVariable("names");
				state.tmp["has-institution"] = false;
				state.tmp["has-first-person"] = false;
				state.tmp["et-al-min"] = false;
				state.tmp["et-al-use-first"] = false;
				state.tmp["et-al-use-last"] = false;
				state.tmp.use_ellipsis = false;
				state.tmp.can_block_substitute = false;
				state.tmp.forceEtAl = false;
			};
			this.execs.push(func);
			state.build.names_flag = false;
			state.build.name_flag = false;
		}
		target.push(this);
		if (this.tokentype === CSL.END || this.tokentype === CSL.SINGLETON) {
			state.build.substitute_level.pop();
			CSL.Util.substituteEnd.call(this, state, target);
		}
	},
	configure: function (state, pos) {
		if ([CSL.SINGLETON, CSL.START].indexOf(this.tokentype) > -1) {
			if (state.build.has_institution) {
				this.strings["has-institution"] = true;
				state.build.has_institution = false;
			}
		}
	}
};
CSL.Node.number = {
	build: function (state, target) {
		var func;
		CSL.Util.substituteStart.call(this, state, target);
		if (this.strings.form === "roman") {
			this.formatter = state.fun.romanizer;
		} else if (this.strings.form === "ordinal") {
			this.formatter = state.fun.ordinalizer;
		} else if (this.strings.form === "long-ordinal") {
			this.formatter = state.fun.long_ordinalizer;
		}
		if ("undefined" === typeof this.successor_prefix) {
			this.successor_prefix = state[state.tmp.area].opt.layout_delimiter;
		}
		if ("undefined" === typeof this.splice_prefix) {
			this.splice_prefix = state[state.tmp.area].opt.layout_delimiter;
		}
		func = function (state, Item) {
			var varname, num, number, m, j, jlen;
			varname = this.variables[0];
			state.parallel.StartVariable(this.variables[0]);
			state.parallel.AppendToVariable(Item[this.variables[0]]);
			if (varname === "page-range" || varname === "page-first") {
				varname = "page";
			}
			num = Item[varname];
			if ("undefined" !== typeof num) {
				if (this.variables[0] === "page-first") {
					m = num.split(/\s*(?:&|,|-)\s*/);
					num = m[0];
				}
				var prefixes = num.split(/[0-9]+/);
				var all_with_spaces = true;
				for (var i = 1, ilen = prefixes.length - 1; i < ilen; i += 1) {
				    if (prefixes[i].indexOf(" ") === -1) {
						all_with_spaces = false;
						break;
				    }
				}
				if (state.tmp.area !== "citation_sort"
				  && state.tmp.area !== "bibliography_sort"
				  && all_with_spaces 
				  && !num.match(/[^- 0-9,&]/)) {
					var nums = num.match(/[0-9]+/g);
					var range_ok = true;
					for (i = prefixes.length - 2; i > 0; i += -1) {
						if (prefixes && prefixes[i].indexOf("-") > -1) {
							var start = parseInt(nums[i - 1], 10);
							var end = parseInt(nums[i], 10);
							if (start >= end || start < (end - 1000)) {
								range_ok = false;
								break;
							}
							var replacement = [];
							for (j = start, jlen = end + 1; j < jlen; j += 1) {
								replacement.push(""+j);
							}
								nums = nums.slice(0, i - 1).concat(replacement).concat(nums.slice(i + 1));
						}
					}
					if (range_ok) {
						nums = nums.sort(function (a,b) {
							a = parseInt(a, 10);
							b = parseInt(b, 10);
							if (a > b) {
								return 1;
							} else if (a < b) {
								return -1;
							} else {
								return 0;
							}
						});
						for (i = nums.length; i > -1; i += -1) {
							if (nums[i] === nums[i + 1]) {
								nums = nums.slice(0, i).concat(nums.slice(i + 1));
							}
						}
						state.output.openLevel("empty");
						for (i = 0, ilen = nums.length; i < ilen; i += 1) {
							num = parseInt(nums[i], 10);
							number = new CSL.NumericBlob(num, this);
							number.gender = state.opt["noun-genders"][varname];
							if (i > 0) {
								number.successor_prefix = " & ";
								number.range_prefix = "-";
								number.splice_prefix = ", ";
							}
							state.output.append(number, "literal");
						}
						state.output.closeLevel("empty");
					} else {
						state.output.append(num, this);
				    }
				} else if (!all_with_spaces || prefixes.length > 2) {
				    state.output.append(num, this);
				} else {
					m = num.match(/\s*([0-9]+)(?:[^-]* |[^-]*$)/);
					if (m) {
						num = parseInt(m[1], 10);
						number = new CSL.NumericBlob(num, this);
						number.gender = state.opt["noun-genders"][varname];
						state.output.append(number, "literal");
				    } else {
						state.output.append(num, this);
				    }
				}
			}
			state.parallel.CloseVariable("number");
		};
		this.execs.push(func);
		target.push(this);
		CSL.Util.substituteEnd.call(this, state, target);
	}
};
CSL.Node.sort = {
	build: function (state, target) {
		if (this.tokentype === CSL.START) {
			if (state.build.area === "citation") {
				state.parallel.use_parallels = false;
				state.opt.sort_citations = true;
			}
			state.build.sort_flag  = true;
			state.build.area_return = state.build.area;
			state.build.area = state.build.area + "_sort";
		}
		if (this.tokentype === CSL.END) {
			state.build.area = state.build.area_return;
			state.build.sort_flag  = false;
		}
	}
};
CSL.Node.substitute = {
	build: function (state, target) {
		var func;
		if (this.tokentype === CSL.START) {
			func = function (state, Item) {
				state.tmp.can_block_substitute = true;
				if (state.tmp.value.length) {
				    state.tmp.can_substitute.replace(false, CSL.LITERAL);
				}
			};
			this.execs.push(func);
		}
		target.push(this);
	}
};
CSL.Node.text = {
	build: function (state, target) {
		var variable, func, form, plural, id, num, number, formatter, firstoutput, specialdelimiter, label, myname, names, name, year, suffix, term, dp, len, pos, n, m, value, flag;
		CSL.Util.substituteStart.call(this, state, target);
		if (this.postponed_macro) {
			CSL.expandMacro.call(state, this);
		} else {
			variable = this.variables[0];
			form = "long";
			plural = 0;
			if (this.strings.form) {
				form = this.strings.form;
			}
			if (this.strings.plural) {
				plural = this.strings.plural;
			}
			if ("citation-number" === variable || "year-suffix" === variable || "citation-label" === variable) {
				if (variable === "citation-number") {
					if (state.build.area === "citation") {
						state.opt.update_mode = CSL.NUMERIC;
					}
					if (state.build.area === "bibliography") {
						state.opt.bib_mode = CSL.NUMERIC;
					}
					if ("citation-number" === state[state.tmp.area].opt.collapse) {
						this.range_prefix = "-";
					}
					this.successor_prefix = state[state.build.area].opt.layout_delimiter;
					this.splice_prefix = state[state.build.area].opt.layout_delimiter;
					func = function (state, Item, item) {
						id = "" + Item.id;
						if (!state.tmp.just_looking) {
							if (item && item["author-only"]) {
								state.tmp.element_trace.replace("do-not-suppress-me");
								term = CSL.Output.Formatters["capitalize-first"](state, state.getTerm("reference", "long", "singular"));
								state.output.append(term + " ");
								state.tmp.last_element_trace = true;
							}
							if (item && item["suppress-author"]) {
								if (state.tmp.last_element_trace) {
									state.tmp.element_trace.replace("suppress-me");
								}
								state.tmp.last_element_trace = false;
							}
							num = state.registry.registry[id].seq;
							if (state.opt.citation_number_slug) {
								state.output.append(state.opt.citation_number_slug, this);
							} else {
								number = new CSL.NumericBlob(num, this);
								state.output.append(number, "literal");
							}
						}
					};
					this.execs.push(func);
				} else if (variable === "year-suffix") {
					state.opt.has_year_suffix = true;
					if (state[state.tmp.area].opt.collapse === "year-suffix-ranged") {
						this.range_prefix = "-";
					}
					if (state[state.tmp.area].opt["year-suffix-delimiter"]) {
						this.successor_prefix = state[state.build.area].opt["year-suffix-delimiter"];
					}
					func = function (state, Item) {
						if (state.registry.registry[Item.id] && state.registry.registry[Item.id].disambig.year_suffix !== false && !state.tmp.just_looking) {
							num = parseInt(state.registry.registry[Item.id].disambig.year_suffix, 10);
							number = new CSL.NumericBlob(num, this);
							formatter = new CSL.Util.Suffixator(CSL.SUFFIX_CHARS);
							number.setFormatter(formatter);
							state.output.append(number, "literal");
							firstoutput = false;
							len = state.tmp.term_sibling.mystack.length;
							for (pos = 0; pos < len; pos += 1) {
								flag = state.tmp.term_sibling.mystack[pos];
								if (!flag[2] && (flag[1] || (!flag[1] && !flag[0]))) {
									firstoutput = true;
									break;
								}
							}
							specialdelimiter = state[state.tmp.area].opt["year-suffix-delimiter"];
							if (firstoutput && specialdelimiter && !state.tmp.sort_key_flag) {
								state.tmp.splice_delimiter = state[state.tmp.area].opt["year-suffix-delimiter"];
							}
						}
					};
					this.execs.push(func);
				} else if (variable === "citation-label") {
					state.opt.has_year_suffix = true;
					func = function (state, Item) {
						label = Item["citation-label"];
						if (!label) {
							myname = state.getTerm("reference", "short", 0);
							len = CSL.CREATORS.length;
							for (pos = 0; pos < len; pos += 1) {
								n = CSL.CREATORS[pos];
								if (Item[n]) {
									names = Item[n];
									if (names && names.length) {
										name = names[0];
									}
									if (name && name.family) {
										myname = name.family.replace(/\s+/, "");
									} else if (name && name.literal) {
										myname = name.literal;
										m = myname.toLowerCase().match(/^(a|the|an\s+)/, "");
										if (m) {
											myname = myname.slice(m[1].length);
										}
									}
								}
							}
							year = "0000";
							if (Item.issued) {
								dp = Item.issued["date-parts"];
								if (dp && dp[0] && dp[0][0]) {
									year = "" + dp[0][0];
								}
							}
							label = myname + year;
						}
						suffix = "";
						if (state.registry.registry[Item.id] && state.registry.registry[Item.id].disambig.year_suffix !== false) {
							num = parseInt(state.registry.registry[Item.id].disambig.year_suffix, 10);
							suffix = state.fun.suffixator.format(num);
						}
						label += suffix;
						state.output.append(label, this);
					};
					this.execs.push(func);
				}
			} else {
				if (state.build.term) {
				    term = state.build.term;
				    term = state.getTerm(term, form, plural);
				    if (this.strings["strip-periods"]) {
					term = term.replace(/\./g, "");
				    }
				    func = function (state, Item) {
					var myterm;
					if (term !== "") {
					    flag = state.tmp.term_sibling.value();
					    flag[0] = true;
					    state.tmp.term_sibling.replace(flag);
					}
					if (!state.tmp.term_predecessor) {
					    myterm = CSL.Output.Formatters["capitalize-first"](state, term);
					} else {
					    myterm = term;
					}
					state.output.append(myterm, this);
				    };
				    this.execs.push(func);
				    state.build.term = false;
				    state.build.form = false;
				    state.build.plural = false;
				} else if (this.variables.length) {
					func = function (state, Item) {
						state.parallel.StartVariable(this.variables[0]);
						state.parallel.AppendToVariable(Item[this.variables[0]]);
					};
					this.execs.push(func);
					if (CSL.MULTI_FIELDS.indexOf(this.variables[0]) > -1) {
						if (form === "short") {
							state.transform.init(this, this.variables[0], this.variables[0]);
						} else {
							state.transform.init(this, this.variables[0]);
						}
						if (state.build.area.slice(-5) === "_sort") {
							state.transform.setTransformLocale("locale-sort");
							state.transform.setTransformFallback(true);
							func = state.transform.getOutputFunction();
						} else if (form === "short") {
							state.transform.setAbbreviationFallback(true);
							state.transform.setTransformLocale("locale-pri");
							state.transform.setTransformFallback(true);
							if (this.variables[0] === "container-title") {
								state.transform.setAlternativeVariableName("journalAbbreviation");
							} else if (this.variables[0] === "title") {
								state.transform.setAlternativeVariableName("shortTitle");
							} else if (["publisher", "publisher-place"].indexOf(this.variables[0]) > -1) {
								state.transform.setTransformLocale("default-locale");
							}
							func = state.transform.getOutputFunction();
						} else if (this.variables[0] === "title") {
							state.transform.setTransformLocale("locale-sec");
							state.transform.setTransformFallback(true);
							func = state.transform.getOutputFunction();
						} else {
							state.transform.setTransformLocale("locale-pri");
							state.transform.setTransformFallback(true);
							if (["publisher", "publisher-place"].indexOf(this.variables[0]) > -1) {
								state.transform.setTransformLocale("default-locale");
							}
							func = state.transform.getOutputFunction();
						}
						if (this.variables[0] === "container-title") {
							var xfunc = function (state, Item, item) {
								if (Item['container-title'] && state.tmp.citeblob.has_volume) {
									state.tmp.citeblob.can_suppress_identical_year = true;
								}
							};
							this.execs.push(xfunc);
						}
					} else {
						if (CSL.CITE_FIELDS.indexOf(this.variables[0]) > -1) {
							func = function (state, Item, item) {
								if (item && item[this.variables[0]]) {
									state.output.append(item[this.variables[0]], this);
								}
							};
						} else if (this.variables[0] === "page-first") {
							func = function (state, Item) {
								var idx, value;
								value = state.getVariable(Item, "page", form);
								if (value) {
									idx = value.indexOf("-");
									if (idx > -1) {
										value = value.slice(0, idx);
									}
									state.output.append(value, this);
								}
							};
						} else  if (this.variables[0] === "page") {
							func = function (state, Item) {
								var value = state.getVariable(Item, "page", form);
								if (value) {
									value = state.fun.page_mangler(value);
									state.output.append(value, this);
								}
							};
						} else if ("volume") {
							func = function (state, Item) {
								var value = state.getVariable(Item, this.variables[0], form);
								if (value) {
									state.tmp.citeblob.has_volume = true;
									state.output.append(value, this);
								}
							};
						} else {
							func = function (state, Item) {
								var value = state.getVariable(Item, this.variables[0], form);
								if (value) {
									state.output.append(value, this);
								}
							};
						}
					}
					this.execs.push(func);
					func = function (state, Item) {
						state.parallel.CloseVariable("text");
					};
					this.execs.push(func);
				} else if (this.strings.value) {
					func = function (state, Item) {
						var flag;
						flag = state.tmp.term_sibling.value();
						flag[0] = true;
						state.tmp.term_sibling.replace(flag);
						state.output.append(this.strings.value, this);
					};
					this.execs.push(func);
				}
			}
			target.push(this);
		}
		CSL.Util.substituteEnd.call(this, state, target);
	}
};
CSL.Attributes = {};
CSL.Attributes["@class"] = function (state, arg) {
	state.opt["class"] = arg;
};
CSL.Attributes["@version"] = function (state, arg) {
	state.opt.version = arg;
};
CSL.Attributes["@value"] = function (state, arg) {
	this.strings.value = arg;
};
CSL.Attributes["@name"] = function (state, arg) {
	this.strings.name = arg;
};
CSL.Attributes["@form"] = function (state, arg) {
	this.strings.form = arg;
};
CSL.Attributes["@date-parts"] = function (state, arg) {
	this.strings["date-parts"] = arg;
};
CSL.Attributes["@range-delimiter"] = function (state, arg) {
	this.strings["range-delimiter"] = arg;
};
CSL.Attributes["@macro"] = function (state, arg) {
	this.postponed_macro = arg;
};
CSL.Attributes["@term"] = function (state, arg) {
	if (this.name === "et-al") {
		if (state.locale[state.opt.lang].terms[arg]) {
			this.strings.term = state.getTerm(arg, "long", 0);
		} else {
			this.strings.term = arg;
		}
	} else {
		state.build.term = arg;
	}
};
CSL.Attributes["@xmlns"] = function (state, arg) {};
CSL.Attributes["@lang"] = function (state, arg) {
	if (arg) {
		state.build.lang = arg;
	}
};
CSL.Attributes["@type"] = function (state, arg) {
	var types, ret, func, len, pos;
	func = function (state, Item) {
		types = arg.split(/\s+/);
		ret = [];
		len = types.length;
		for (pos = 0; pos < len; pos += 1) {
			ret.push(Item.type === types[pos]);
		}
		return ret;
	};
	this.tests.push(func);
};
CSL.Attributes["@variable"] = function (state, arg) {
	var variables, pos, len, func, output, variable, varlen, needlen, ret, x, myitem, key, flag;
	this.variables = arg.split(/\s+/);
	this.variables_real = arg.split(/\s+/);
	if ("label" === this.name && this.variables[0]) {
		state.build.term = this.variables[0];
	} else if (["names", "date", "text", "number"].indexOf(this.name) > -1) {
		func = function (state, Item) {
			variables = this.variables_real.slice();
			this.variables = [];
			len = variables.length;
			for (pos = 0; pos < len; pos += 1) {
				if (state.tmp.done_vars.indexOf(variables[pos]) === -1) {
					this.variables.push(variables[pos]);
				}
				if (state.tmp.can_block_substitute) {
					state.tmp.done_vars.push(variables[pos]);
				}
			}
		};
		this.execs.push(func);
		func = function (state, Item, item) {
			var mydate;
			output = false;
			len = this.variables.length;
			for (pos = 0; pos < len; pos += 1) {
				variable = this.variables[pos];
				if (this.strings.form === "short" && !Item[variable]) {
					if (variable === "title") {
						variable = "shortTitle";
					} else if (variable === "container-title") {
						variable = "journalAbbreviation";
					} else if (variable === "page-first") {
						variable = "page";
					}
				}
				if (CSL.DATE_VARIABLES.indexOf(variable) > -1) {
					if (Item[variable] && Item[variable].raw) {
						output = true;
						break;
					} else if (Item[variable] && Item[variable].literal) {
						output = true;
						break;
					} else if (Item[variable] && Item[variable]['date-parts'] && Item[variable]['date-parts'].length && this.dateparts && this.dateparts.length) {
						varlen = Item[variable]['date-parts'][0].length;
						needlen = 4;
						if (this.dateparts.indexOf("year") > -1) {
							needlen = 1;
						} else if (this.dateparts.indexOf("month") > -1) {
							needlen = 2;
						} else if (this.dateparts.indexOf('day') > -1) {
							needlen = 3;
						}
						if (varlen >= needlen) {
							output = true;
							break;
						}
					}
				} else if ("locator" === variable) {
					if (item && item.locator) {
						output = true;
						break;
					}
				} else if ("citation-number" === variable) {
					output = true;
					break;
				} else if ("first-reference-note-number" === variable) {
					if (item && item["first-reference-note-number"]) {
						output = true;
						break;
					}
				} else if ("object" === typeof Item[variable]) {
					if (Item[variable].length) {
						output = true;
						break;
					}
				} else if ("string" === typeof Item[variable] && Item[variable]) {
					output = true;
					break;
				} else if ("number" === typeof Item[variable]) {
					output = true;
					break;
				}
				if (output) {
					break;
				}
			}
			flag = state.tmp.term_sibling.value();
			if (output) {
				if (variable !== "citation-number" || !state.tmp.area === "bibliography") {
					state.tmp.cite_renders_content = true;
				}
				flag[2] = true;
				state.tmp.term_sibling.replace(flag);
				state.tmp.can_substitute.replace(false,  CSL.LITERAL);
			} else {
				flag[1] = true;
			}
		};
		this.execs.push(func);
	} else if (["if",  "else-if"].indexOf(this.name) > -1) {
		func = function (state, Item, item) {
			var key;
			ret = [];
			len = this.variables.length;
			for (pos = 0; pos < len; pos += 1) {
				variable = this.variables[pos];
				x = false;
				myitem = Item;
				if (item && ["locator", "first-reference-note-number"].indexOf(variable) > -1) {
					myitem = item;
				}
				if (myitem[variable]) {
					if ("number" === typeof myitem[variable] || "string" === typeof myitem[variable]) {
						x = true;
					} else if ("object" === typeof myitem[variable]) {
						for (key in myitem[variable]) {
							if (myitem[variable].hasOwnProperty(key)) {
								x = true;
								break;
							}
						}
					}
				}
				ret.push(x);
			}
			return ret;
		};
		this.tests.push(func);
	}
};
CSL.Attributes["@lingo"] = function (state, arg) {
}
CSL.Attributes["@locale"] = function (state, arg) {
	var func, ret, len, pos, variable, myitem, langspec, lang, lst, i, ilen, fallback;
	if (this.name === "layout") {
		this.locale_raw = arg;
	} else {
		lst = arg.split(/\s+/);
		this.locale_bases = [];
		for (i = 0, ilen = lst.length; i < ilen; i += 1) {
			lang = CSL.localeParse(lst[i]);
			langspec = CSL.localeResolve(lang);
			if (lst[i].length === 2) {
				this.locale_bases.push(langspec.base);
			}
			state.localeConfigure(langspec);
			lst[i] = langspec;
		}
		this.locale_default = state.opt["default-locale"][0];
		this.locale = lst[0].best;
		this.locale_list = lst.slice();
		func = function (state, Item, item) {
			var key, res;
			ret = [];
			if (Item.language) {
				lang = CSL.localeParse(Item.language);
				langspec = CSL.localeResolve(lang);
				res = false;
				for (i = 0, ilen = this.locale_list.length; i < ilen; i += 1) {
					if (langspec.best === this.locale_list[i].best) {
						state.opt.lang = this.locale;
						state.tmp.last_cite_locale = this.locale;
						state.output.openLevel("empty");
						state.output.current.value().new_locale = this.locale;
						res = true;
						break;
					}
				}
				if (!res && this.locale_bases.indexOf(langspec.base) > -1) {
					state.opt.lang = this.locale;
					state.tmp.last_cite_locale = this.locale;
					state.output.openLevel("empty");
					state.output.current.value().new_locale = this.locale;
					res = true;
				}
			}
			ret.push(res);
			return ret;
		};
		this.tests.push(func);
	};
};
CSL.Attributes["@suffix"] = function (state, arg) {
	this.strings.suffix = arg;
};
CSL.Attributes["@prefix"] = function (state, arg) {
	this.strings.prefix = arg;
};
CSL.Attributes["@delimiter"] = function (state, arg) {
	this.strings.delimiter = arg;
};
CSL.Attributes["@match"] = function (state, arg) {
	var evaluator;
	if (this.tokentype === CSL.START || CSL.SINGLETON) {
		if ("none" === arg) {
			evaluator = state.fun.match.none;
		} else if ("any" === arg) {
			evaluator = state.fun.match.any;
		} else if ("all" === arg) {
			evaluator = state.fun.match.all;
		} else {
			throw "Unknown match condition \"" + arg + "\" in @match";
		}
		this.evaluator = evaluator;
	}
};
CSL.Attributes["@is-uncertain-date"] = function (state, arg) {
	var variables, len, pos, func, variable, ret;
	variables = arg.split(/\s+/);
	len = variables.length;
	func = function (state, Item) {
		ret = [];
		for (pos = 0; pos < len; pos += 1) {
			variable = variables[pos];
			if (Item[variable] && Item[variable].circa) {
				ret.push(true);
			} else {
				ret.push(false);
			}
		}
		return ret;
	};
	this.tests.push(func);
};
CSL.Attributes["@is-numeric"] = function (state, arg) {
	var variables, variable, func, val, pos, len, not_numeric_type, ret;
	variables = arg.split(/\s+/);
	len = variables.length;
	func = function (state, Item) {
		ret = [];
		for (pos = 0; pos < len; pos += 1) {
			variable = variables[pos];
			not_numeric_type = CSL.NUMERIC_VARIABLES.indexOf(variable) === -1;
			val = Item[variable];
			if (typeof val === "number") {
				val = val.toString();
			}
			if (not_numeric_type) {
				if (Item[variable] && ("" + Item[variable]).match(/[0-9]$/)) {
					ret.push(true);
				} else {
					ret.push(false);
				}
			} else  if (typeof val === "undefined") {
				ret.push(false);
			} else if (typeof val !== "string") {
				ret.push(false);
			} else if (val.match(CSL.QUOTED_REGEXP_START) && val.match(CSL.QUOTED_REGEXP_END)) {
				ret.push(false);
			} else if (val.match(CSL.NUMBER_REGEXP)) {
				ret.push(true);
			} else {
				ret.push(false);
			}
		}
		return ret;
	};
	this.tests.push(func);
};
CSL.Attributes["@names-min"] = function (state, arg) {
	var val = parseInt(arg, 10);
	if (state.opt.max_number_of_names < val) {
		state.opt.max_number_of_names = val;
	}
	this.strings["et-al-min"] = val;
};
CSL.Attributes["@names-use-first"] = function (state, arg) {
	this.strings["et-al-use-first"] = parseInt(arg, 10);
};
CSL.Attributes["@names-use-last"] = function (state, arg) {
    	if (arg === "true") {
		this.strings["et-al-use-last"] = true;
	} else {
		this.strings["et-al-use-last"] = false;
	}
};
CSL.Attributes["@sort"] = function (state, arg) {
	if (arg === "descending") {
		this.strings.sort_direction = CSL.DESCENDING;
	}
};
CSL.Attributes["@plural"] = function (state, arg) {
	if ("always" === arg || "true" === arg) {
		this.strings.plural = 1;
	} else if ("never" === arg || "false" === arg) {
		this.strings.plural = 0;
	} else if ("contextual" === arg) {
		this.strings.plural = false;
	}
};
CSL.Attributes["@locator"] = function (state, arg) {
	var func;
	if (["if",  "else-if"].indexOf(this.name) > -1) {
		func = function (state, Item, item) {
			var label;
			if ("undefined" === typeof item || !item.label) {
				label = "page";
			} else {
				label = item.label;
			}
			if (arg === label) {
				return true;
			}
			return false;
		};
		this.tests.push(func);
	}
};
CSL.Attributes["@newdate"] = function (state, arg) {
};
CSL.Attributes["@position"] = function (state, arg) {
    var tryposition;
	state.opt.update_mode = CSL.POSITION;
	var lst = arg.split(/\s+/);
	for (var i = 0, ilen = lst.length; i < ilen; i += 1) {
	    if (state.build.area.slice(0, 12) === "bibliography") {
		func = function (state, Item, item) {
		    return false;
		}
		this.tests.push(func);
	    } else {
		if (lst[i] === "first") {
		    tryposition = CSL.POSITION_FIRST;
		} else if (lst[i] === "subsequent") {
		    tryposition = CSL.POSITION_SUBSEQUENT;
		} else if (lst[i] === "ibid") {
		    tryposition = CSL.POSITION_IBID;
		} else if (lst[i] === "ibid-with-locator") {
		    tryposition = CSL.POSITION_IBID_WITH_LOCATOR;
		}
		var factory = function (tryposition) {
		    return  function (state, Item, item) {
			if (item && "undefined" === typeof item.position) {
			    item.position = 0;
			}
			if (item && typeof item.position === "number") {
			    if (item.position === 0 && tryposition === 0) {
				return true;
			    } else if (tryposition > 0 && item.position >= tryposition) {
				return true;
			    }
			} else if (tryposition === 0) {
			    return true;
			}
			return false;
		    };
		};
		func = factory(tryposition);
		this.tests.push(func);
	    }
	    if (lst[i] === "near-note") {
		func = function (state, Item, item) {
		    if (item && item["near-note"]) {
			return true;
		    }
		    return false;
		};
		this.tests.push(func);
	    }
	}
};
CSL.Attributes["@disambiguate"] = function (state, arg) {
	if (this.tokentype === CSL.START && ["if", "else-if"].indexOf(this.name) > -1) {
		if (arg === "true") {
			state.opt.has_disambiguate = true;
			var func = function (state, Item) {
				if (state.tmp.disambig_settings.disambiguate) {
					return true;
				}
				return false;
			};
			this.tests.push(func);
		}
	}
};
CSL.Attributes["@givenname-disambiguation-rule"] = function (state, arg) {
	if (CSL.GIVENNAME_DISAMBIGUATION_RULES.indexOf(arg) > -1) {
		state.opt["givenname-disambiguation-rule"] = arg;
	}
};
CSL.Attributes["@collapse"] = function (state, arg) {
	if (arg) {
		state[this.name].opt.collapse = arg;
	}
};
CSL.Attributes["@names-delimiter"] = function (state, arg) {
	state.setOpt(this, "names-delimiter", arg);
};
CSL.Attributes["@name-form"] = function (state, arg) {
	state.setOpt(this, "name-form", arg);
};
CSL.Attributes["@name-delimiter"] = function (state, arg) {
	state.setOpt(this, "name-delimiter", arg);
};
CSL.Attributes["@et-al-min"] = function (state, arg) {
	var val = parseInt(arg, 10);
	if (state.opt.max_number_of_names < val) {
		state.opt.max_number_of_names = val;
	}
	state.setOpt(this, "et-al-min", val);
};
CSL.Attributes["@et-al-use-first"] = function (state, arg) {
	state.setOpt(this, "et-al-use-first", parseInt(arg));
};
CSL.Attributes["@et-al-use-last"] = function (state, arg) {
	if (arg === "true") {
		state.setOpt(this, "et-al-use-last", true);
	} else {
		state.setOpt(this, "et-al-use-last", false);
	}
};
CSL.Attributes["@et-al-subsequent-min"] = function (state, arg) {
	state.opt.update_mode = CSL.POSITION;
	var val = parseInt(arg, 10);
	if (state.opt.max_number_of_names < val) {
		state.opt.max_number_of_names = val;
	}
	state.setOpt(this, "et-al-subsequent-min", val);
};
CSL.Attributes["@et-al-subsequent-use-first"] = function (state, arg) {
	state.opt.update_mode = CSL.POSITION;
	state.setOpt(this, "et-al-subsequent-use-first", parseInt(arg, 10));
};
CSL.Attributes["@truncate-min"] = function (state, arg) {
	this.strings["truncate-min"] = parseInt(arg, 10);
};
CSL.Attributes["@suppress-min"] = function (state, arg) {
	this.strings["suppress-min"] = parseInt(arg, 10);
};
CSL.Attributes["@and"] = function (state, arg) {
	var myarg, and;
	myarg = "&";
	if ("text" === arg) {
		and = state.getTerm("and", "long", 0);
		myarg = and;
	}
	state.setOpt(this, "and", myarg);
};
CSL.Attributes["@delimiter-precedes-last"] = function (state, arg) {
	state.setOpt(this, "delimiter-precedes-last", arg);
};
CSL.Attributes["@delimiter-precedes-et-al"] = function (state, arg) {
	state.setOpt(this, "delimiter-precedes-et-al", arg);
};
CSL.Attributes["@initialize-with"] = function (state, arg) {
	state.setOpt(this, "initialize-with", arg);
};
CSL.Attributes["@name-as-sort-order"] = function (state, arg) {
	state.setOpt(this, "name-as-sort-order", arg);
};
CSL.Attributes["@sort-separator"] = function (state, arg) {
	state.setOpt(this, "sort-separator", arg);
};
CSL.Attributes["@year-suffix-delimiter"] = function (state, arg) {
	state[this.name].opt["year-suffix-delimiter"] = arg;
};
CSL.Attributes["@after-collapse-delimiter"] = function (state, arg) {
	state[this.name].opt["after-collapse-delimiter"] = arg;
};
CSL.Attributes["@subsequent-author-substitute"] = function (state, arg) {
	state[this.name].opt["subsequent-author-substitute"] = arg;
};
CSL.Attributes["@disambiguate-add-names"] = function (state, arg) {
	if (arg === "true") {
		state.opt["disambiguate-add-names"] = true;
	}
};
CSL.Attributes["@disambiguate-add-givenname"] = function (state, arg) {
	if (arg === "true") {
		state.opt["disambiguate-add-givenname"] = true;
	}
};
CSL.Attributes["@disambiguate-add-year-suffix"] = function (state, arg) {
	if (arg === "true") {
		state.opt["disambiguate-add-year-suffix"] = true;
	}
};
CSL.Attributes["@second-field-align"] = function (state, arg) {
	if (arg === "flush" || arg === "margin") {
		state[this.name].opt["second-field-align"] = arg;
	}
};
CSL.Attributes["@hanging-indent"] = function (state, arg) {
	if (arg === "true") {
		state[this.name].opt.hangingindent = 2;
	}
};
CSL.Attributes["@line-spacing"] = function (state, arg) {
	if (arg && arg.match(/^[.0-9]+$/)) {
		state[this.name].opt["line-spacing"] = parseFloat(arg, 10);
	}
};
CSL.Attributes["@entry-spacing"] = function (state, arg) {
	if (arg && arg.match(/^[.0-9]+$/)) {
		state[this.name].opt["entry-spacing"] = parseFloat(arg, 10);
	}
};
CSL.Attributes["@near-note-distance"] = function (state, arg) {
	state[this.name].opt["near-note-distance"] = parseInt(arg, 10);
};
CSL.Attributes["@page-range-format"] = function (state, arg) {
	state.opt["page-range-format"] = arg;
};
CSL.Attributes["@text-case"] = function (state, arg) {
	this.strings["text-case"] = arg;
};
CSL.Attributes["@page-range-format"] = function (state, arg) {
	state.opt["page-range-format"] = arg;
};
CSL.Attributes["@default-locale"] = function (state, arg) {
	var lst, len, pos, m, ret;
	m = arg.match(/-x-(sort|pri|sec|name)-/g);
	if (m) {
		for (pos = 0, len = m.length; pos < len; pos += 1) {
			m[pos] = m[pos].replace(/^-x-/, "").replace(/-$/, "");
		}
	}
	lst = arg.split(/-x-(?:sort|pri|sec|name)-/);
	ret = [lst[0]];
	for (pos = 1, len = lst.length; pos < len; pos += 1) {
		ret.push(m[pos - 1]);
		ret.push(lst[pos]);
	}
	lst = ret.slice();
	len = lst.length;
	for (pos = 1; pos < len; pos += 2) {
		state.opt[("locale-" + lst[pos])].push(lst[(pos + 1)].replace(/^\s*/g, "").replace(/\s*$/g, ""));
	}
	if (lst.length) {
		state.opt["default-locale"] = lst.slice(0, 1);
	} else {
		state.opt["default-locale"] = ["en"];
	}
};
CSL.Attributes["@demote-non-dropping-particle"] = function (state, arg) {
	state.opt["demote-non-dropping-particle"] = arg;
};
CSL.Attributes["@initialize-with-hyphen"] = function (state, arg) {
	if (arg === "false") {
		state.opt["initialize-with-hyphen"] = false;
	}
};
CSL.Attributes["@institution-parts"] = function (state, arg) {
	this.strings["institution-parts"] = arg;
};
CSL.Attributes["@if-short"] = function (state, arg) {
	if (arg === "true") {
		this.strings["if-short"] = true;
	}
};
CSL.Attributes["@substitute-use-first"] = function (state, arg) {
	this.strings["substitute-use-first"] = parseInt(arg, 10);
};
CSL.Attributes["@use-first"] = function (state, arg) {
	this.strings["use-first"] = parseInt(arg, 10);
};
CSL.Attributes["@use-last"] = function (state, arg) {
	if (arg.match(/^[0-9]+$/)) {
		this.strings["use-last"] = parseInt(arg, 10);
	}
};
CSL.Attributes["@reverse-order"] = function (state, arg) {
	if ("true" === arg) {
		this.strings["reverse-order"] = true;
	}
};
CSL.Attributes["@display"] = function (state, arg) {
	this.strings.cls = arg;
};
var XML_PARSING;
var CSL_E4X;
var CSL_CHROME;
var DOMParser;
if ("undefined" !== typeof CSL_E4X) {
	XML_PARSING = CSL_E4X;
} else {
	XML_PARSING = CSL_CHROME;
}
CSL.System = {};
CSL.System.Xml = {
	"Parsing": XML_PARSING
};
CSL.Stack = function (val, literal) {
	this.mystack = [];
	if (literal || val) {
		this.mystack.push(val);
	}
};
CSL.Stack.prototype.push = function (val, literal) {
	if (literal || val) {
		this.mystack.push(val);
	} else {
		this.mystack.push("");
	}
};
CSL.Stack.prototype.clear = function () {
	this.mystack = [];
};
CSL.Stack.prototype.replace = function (val, literal) {
	if (this.mystack.length === 0) {
		throw "Internal CSL processor error: attempt to replace nonexistent stack item with " + val;
	}
	if (literal || val) {
		this.mystack[(this.mystack.length - 1)] = val;
	} else {
		this.mystack[(this.mystack.length - 1)] = "";
	}
};
CSL.Stack.prototype.pop = function () {
	return this.mystack.pop();
};
CSL.Stack.prototype.value = function () {
	return this.mystack.slice(-1)[0];
};
CSL.Stack.prototype.length = function () {
	return this.mystack.length;
};
CSL.Util = {};
CSL.Util.Match = function () {
	var func, pos, len, reslist, res, ppos, llen;
	this.any = function (token, state, Item, item) {
		var ret = false;
		len = token.tests.length;
		for (pos = 0; pos < len; pos += 1) {
			func = token.tests[pos];
			reslist = func.call(token, state, Item, item);
			if ("object" !== typeof reslist) {
				reslist = [reslist];
			}
			llen = reslist.length;
			for (ppos = 0; ppos < llen; ppos += 1) {
				if (reslist[ppos]) {
					ret = true;
					break;
				}
			}
			if (ret) {
				break;
			}
		}
		if (ret) {
			ret = token.succeed;
			state.tmp.jump.replace("succeed");
		} else {
			ret = token.fail;
			state.tmp.jump.replace("fail");
		}
		return ret;
	};
	this.none = function (token, state, Item, item) {
		var ret = true;
		len = this.tests.length;
		for (pos = 0; pos < len; pos += 1) {
			func = this.tests[pos];
			reslist = func.call(token, state, Item, item);
			if ("object" !== typeof reslist) {
				reslist = [reslist];
			}
			llen = reslist.length;
			for (ppos = 0; ppos < llen; ppos += 1) {
				if (reslist[ppos]) {
					ret = false;
					break;
				}
			}
			if (!ret) {
				break;
			}
		}
		if (ret) {
			ret = token.succeed;
			state.tmp.jump.replace("succeed");
		} else {
			ret = token.fail;
			state.tmp.jump.replace("fail");
		}
		return ret;
	};
	this.all = function (token, state, Item, item) {
		var ret = true;
		len = this.tests.length;
		for (pos = 0; pos < len; pos += 1) {
			func = this.tests[pos];
			reslist = func.call(token, state, Item, item);
			if ("object" !== typeof reslist) {
				reslist = [reslist];
			}
			llen = reslist.length;
			for (pos = 0; pos < len; pos += 1) {
				if (!reslist[ppos]) {
					ret = false;
					break;
				}
			}
			if (!ret) {
				break;
			}
		}
		if (ret) {
			ret = token.succeed;
			state.tmp.jump.replace("succeed");
		} else {
			ret = token.fail;
			state.tmp.jump.replace("fail");
		}
		return ret;
	};
};
CSL.Transform = function (state) {
	var debug = false, abbreviations, token, fieldname, subsection, opt;
	this["container-title"] = {};
	this["collection-title"] = {};
	this.institution = {};
	this.authority = {};
	this.title = {};
	this.publisher = {};
	this["publisher-place"] = {};
	this.hereinafter = {};
	abbreviations = "default";
	function init(t, f, x) {
		token = t;
		fieldname = f;
		subsection = x;
		opt = {
			abbreviation_fallback: false,
			alternative_varname: false,
			transform_locale: false,
			transform_fallback: false
		};
	}
	this.init = init;
	function abbreviate(state, Item, altvar, basevalue, mysubsection, use_field) {
		var value;
		if (!mysubsection) {
			return basevalue;
		}
		value = "";
		if (state.transform[mysubsection]) {
			if (state.transform[mysubsection][basevalue]) {
				value = state.transform[mysubsection][basevalue];
			} else if ("string" != typeof state.transform[mysubsection][basevalue]) {
				state.transform[mysubsection][basevalue] = "";
			}
		}
		if (!value && Item[altvar] && use_field) {
			value = Item[altvar];
		}
		if (!value) {
			value = basevalue;
		}
		return value;
	}
	function getTextSubField(Item, field, locale_type, use_default) {
		var m, lst, opt, o, oo, pos, key, ret, len, myret, opts;
		if (!Item[field]) {
			return "";
		}
		ret = "";
		opts = state.opt[locale_type];
		if ("undefined" === typeof opts) {
			opts = state.opt["default-locale"];
		}
		for (var i = 0, ilen = opts.length; i < ilen; i += 1) {
			opt = opts[i];
			o = opt.split(/[-_]/)[0];
			if (opt && Item.multi && Item.multi._keys[field] && Item.multi._keys[field][opt]) {
				ret = Item.multi._keys[field][opt];
				break;
			} else if (o && Item.multi && Item.multi._keys[field] && Item.multi._keys[field][o]) {
				ret = Item.multi._keys[field][o];
				break;
			}
		}
		if (!ret && use_default) {
			ret = Item[field];
		}
		return ret;
	}
	function setAbbreviationFallback(b) {
		opt.abbreviation_fallback = b;
	}
	this.setAbbreviationFallback = setAbbreviationFallback;
	function setAlternativeVariableName(s) {
		opt.alternative_varname = s;
	}
	this.setAlternativeVariableName = setAlternativeVariableName;
	function setTransformLocale(s) {
		opt.transform_locale = s;
	}
	this.setTransformLocale = setTransformLocale;
	function setTransformFallback(b) {
		opt.transform_fallback = b;
	}
	this.setTransformFallback = setTransformFallback;
	function setAbbreviations(name) {
		var vartype, pos, len;
		if (name) {
			abbreviations = name;
		}
		len = CSL.MULTI_FIELDS.length;
		for (pos = 0; pos < len; pos += 1) {
			vartype = CSL.MULTI_FIELDS[pos];
			this[vartype] = state.sys.getAbbreviations(abbreviations, vartype);
		}
	}
	this.setAbbreviations = setAbbreviations;
	function getOutputFunction() {
		var mytoken, mysubsection, myfieldname, abbreviation_fallback, alternative_varname, transform_locale, transform_fallback, getTextSubfield;
		mytoken = CSL.Util.cloneToken(token); // the token isn't needed, is it?
		mysubsection = subsection;
		myfieldname = fieldname;
		abbreviation_fallback = opt.abbreviation_fallback;
		alternative_varname = opt.alternative_varname;
		transform_locale = opt.transform_locale;
		transform_fallback = opt.transform_fallback;
		if (mysubsection) {
			return function (state, Item) {
				var primary;
				primary = getTextSubField(Item, myfieldname, transform_locale, transform_fallback);
				primary = abbreviate(state, Item, alternative_varname, primary, mysubsection, true);
				state.output.append(primary, this);
			};
		} else if (transform_locale === "locale-sec") {
			return function (state, Item) {
				var primary, secondary, primary_tok, secondary_tok, key;
				primary = getTextSubField(Item, myfieldname, "locale-pri", transform_fallback);
				secondary = getTextSubField(Item, myfieldname, "locale-sec");
				if (secondary) {
					primary_tok = CSL.Util.cloneToken(this);
					primary_tok.strings.suffix = "";
					secondary_tok = new CSL.Token("text", CSL.SINGLETON);
					secondary_tok.strings.suffix = "]" + this.strings.suffix;
					secondary_tok.strings.prefix = " [";
					state.output.append(primary, primary_tok);
					state.output.append(secondary, secondary_tok);
				} else {
					state.output.append(primary, this);
				}
				return null;
			};
		} else {
			return function (state, Item) {
				var primary;
				primary = getTextSubField(Item, myfieldname, transform_locale, transform_fallback);
				state.output.append(primary, this);
				return null;
			};
		}
	}
	this.getOutputFunction = getOutputFunction;
	function output(state, basevalue, token_short, token_long, use_fallback) {
		var shortvalue;
		shortvalue = state.transform.institution[basevalue];
		if (shortvalue) {
			state.output.append(shortvalue, token_short);
		} else {
			if (use_fallback) {
				state.output.append(basevalue, token_long);
			}
		}
	}
	this.output = output;
	function getStaticOrder (name, refresh) {
		var static_ordering_val = false;
		if (!refresh && name["static-ordering"]) {
			static_ordering_val = true;
		} else if (!(name.family.replace('"', '', 'g') + name.given).match(CSL.ROMANESQUE_REGEXP)) {
			static_ordering_val = true;
		} else if (name.multi && name.multi.main && name.multi.main.slice(0,2) == 'vn') {
			static_ordering_val = true;
		} else {
			if (state.opt['auto-vietnamese-names']
				&& (CSL.VIETNAMESE_NAMES.exec(name.family + " " + name.given)
					&& CSL.VIETNAMESE_SPECIALS.exec(name.family + name.given))) {
				static_ordering_val = true;
			}
		}
		return static_ordering_val;
	}
	function name (state, name, langTags) {
		var i, ret, optLangTag, ilen, key, langTag;
		if (state.tmp.area.slice(-5) === "_sort") {
			 langTags = state.opt["locale-sort"];
		}
		if ("string" === typeof langTags) {
			langTags = [langTags];
		}
		if (!name.family) {
			name.family = "";
		}
		if (!name.given) {
			name.given = "";
		}
		var static_ordering_freshcheck = false;
		var block_initialize = false;
		var transliterated = false;
		var static_ordering_val = getStaticOrder(name);
		if (langTags && name.multi) {
			for (i = 0, ilen = langTags.length; i < ilen; i += 1) {
				langTag = langTags[i];
				if (name.multi._key[langTag]) {
					name = name.multi._key[langTag];
					transliterated = true;
					if (!state.opt['locale-use-original-name-format']) {
						static_ordering_freshcheck = true;
					} else {
						if ((name.family.replace('"','','g') + name.given).match(CSL.ROMANESQUE_REGEXP)) {
							block_initialize = true;
						}
					}
					break;
				}
			}
		}
		name = {
			family:name.family,
			given:name.given,
			"non-dropping-particle":name["non-dropping-particle"],
			"dropping-particle":name["dropping-particle"],
			suffix:name.suffix,
			"static-ordering":static_ordering_val,
			"parse-names":name["parse-names"],
			"comma-suffix":name["comma-suffix"],
			transliterated:transliterated,
			block_initialize:block_initialize
		}
		if (static_ordering_freshcheck &&
			!getStaticOrder(name, true)) {
			name["static-ordering"] = false;
		}
		if (state.opt["parse-names"]
			&& name["parse-names"] !== 0) {
			state.parseName(name);
		}
		if (name.family && name.family.length && name.family.slice(0, 1) === '"' && name.family.slice(-1) === '"') {
			name.family = name.family.slice(1, -1);
		}
		if (!name.literal && !name.given && name.family) {
			name.literal = name.family;
		}
		if (name.literal) {
			delete name.family;
			delete name.given;
		}
		return name;
	}
	this.name = name;
};
CSL.Parallel = function (state) {
	this.state = state;
	this.sets = new CSL.Stack([]);
	this.try_cite = true;
	this.use_parallels = true;
};
CSL.Parallel.prototype.isMid = function (variable) {
	return ["names", "section", "volume", "container-title", "issue", "page", "locator"].indexOf(variable) > -1;
};
CSL.Parallel.prototype.StartCitation = function (sortedItems, out) {
	if (this.use_parallels) {
		this.sortedItems = sortedItems;
		this.sortedItemsPos = -1;
		this.sets.clear();
		this.sets.push([]);
		this.in_series = true;
		this.delim_counter = 0;
		this.delim_pointers = [];
		if (out) {
			this.out = out;
		} else {
			this.out = this.state.output.queue;
		}
	}
};
CSL.Parallel.prototype.StartCite = function (Item, item, prevItemID) {
	var position, len, pos, x, curr, master, last_id, prev_locator, curr_locator, is_master, parallel;
	if (this.use_parallels) {
		if (this.sets.value().length && this.sets.value()[0].itemId == Item.id) {
			this.ComposeSet();
		}
		this.sortedItemsPos += 1;
		if (item) {
			position = item.position;
		}
		this.try_cite = true;
		len = CSL.PARALLEL_MATCH_VARS.length;
		for (pos = 0; pos < len; pos += 1) {
			x = CSL.PARALLEL_MATCH_VARS[pos];
			if (!Item[x] || CSL.PARALLEL_TYPES.indexOf(Item.type) === -1) {
				this.try_cite = false;
				if (this.in_series) {
					this.in_series = false;
				}
				break;
			}
		}
		this.cite = {};
		this.cite.front = [];
		this.cite.mid = [];
		this.cite.back = [];
		this.cite.front_collapse = {};
		this.cite.back_forceme = [];
		this.cite.position = position;
		this.cite.Item = Item;
		this.cite.itemId = "" + Item.id;
		this.cite.prevItemID = "" + prevItemID;
		this.target = "front";
		if (this.sortedItems && this.sortedItemsPos > 0 && this.sortedItemsPos < this.sortedItems.length) {
			curr = this.sortedItems[this.sortedItemsPos][1];
			last_id = "" + this.sortedItems[(this.sortedItemsPos - 1)][1].id;
			master = this.state.registry.registry[last_id].parallel;
			prev_locator = false;
			if (master == curr.id) {
				len = this.sortedItemsPos - 1;
				for (pos = len; pos > -1; pos += -1) {
					if (this.sortedItems[pos][1].id == Item.id) {
						prev_locator = this.sortedItems[pos][1].locator;
						break;
					}
				}
				curr_locator = this.sortedItems[this.sortedItemsPos][1].locator;
				if (!prev_locator && curr_locator) {
					curr.position = CSL.POSITION_IBID_WITH_LOCATOR;
				} else if (curr_locator === prev_locator) {
					curr.position = CSL.POSITION_IBID;
				} else {
					curr.position = CSL.POSITION_IBID_WITH_LOCATOR;
				}
			}
		}
		this.force_collapse = false;
		if (this.state.registry.registry[Item.id].parallel) {
			this.force_collapse = true;
		}
	}
};
CSL.Parallel.prototype.StartVariable = function (variable) {
	if (this.use_parallels && (this.try_cite || this.force_collapse)) {
		this.variable = variable;
		this.data = {};
		this.data.value = "";
		this.data.blobs = [];
		var is_mid = this.isMid(variable);
		if (this.target === "front" && is_mid) {
			this.target = "mid";
		} else if (this.target === "mid" && !is_mid && this.cite.Item.title) {
			this.target = "back";
		} else if (this.target === "back" && is_mid) {
			this.try_cite = true;
			this.in_series = false;
		}
		if (variable === "number") {
			this.cite.front.push(variable);
		} else if (CSL.PARALLEL_COLLAPSING_MID_VARSET.indexOf(variable) > -1) {
			this.cite.front.push(variable);
		} else {
			this.cite[this.target].push(variable);
		}
	}
};
CSL.Parallel.prototype.AppendBlobPointer = function (blob) {
	if (this.use_parallels && this.variable && (this.try_cite || this.force_collapse) && blob && blob.blobs) {
		this.data.blobs.push([blob, blob.blobs.length]);
	}
};
CSL.Parallel.prototype.AppendToVariable = function (str, varname) {
	if (this.use_parallels && (this.try_cite || this.force_collapse)) {
		if (this.target !== "back" || true) {
			this.data.value += "::" + str;
		} else {
			var prev = this.sets.value()[(this.sets.value().length - 1)];
			if (prev) {
				if (prev[this.variable]) {
					if (prev[this.variable].value) {
						this.data.value += "::" + str;
					}
				}
			}
		}
	}
};
CSL.Parallel.prototype.CloseVariable = function (hello) {
	if (this.use_parallels && (this.try_cite || this.force_collapse)) {
		this.cite[this.variable] = this.data;
		if (this.sets.value().length > 0) {
			var prev = this.sets.value()[(this.sets.value().length - 1)];
			if (this.target === "front") {
				if (!(!prev[this.variable] && !this.data.value) && (!prev[this.variable] || this.data.value !== prev[this.variable].value)) {
					this.in_series = false;
				}
			} else if (this.target === "mid") {
				if (CSL.PARALLEL_COLLAPSING_MID_VARSET.indexOf(this.variable) > -1) {
					if (prev[this.variable]) {
						if (prev[this.variable].value === this.data.value) {
							this.cite.front_collapse[this.variable] = true;
						} else {
							this.cite.front_collapse[this.variable] = false;
						}
					} else {
						this.cite.front_collapse[this.variable] = false;
					}
				}
			} else if (this.target === "back") {
				if (prev[this.variable]) {
					if (this.data.value !== prev[this.variable].value && this.sets.value().slice(-1)[0].back_forceme.indexOf(this.variable) === -1) {
						this.in_series = false;
					}
				}
			}
		}
	}
	this.variable = false;
};
CSL.Parallel.prototype.CloseCite = function () {
	var x, pos, len, has_issued, use_journal_info, volume_pos, container_title_pos, section_pos;
	if (this.use_parallels) {
		use_journal_info = false;
		if (!this.cite.front_collapse["container-title"]) {
			use_journal_info = true;
		}
		if (this.cite.front_collapse.volume === false) {
			use_journal_info = true;
		}
		if (this.cite.front_collapse.section === false) {
			use_journal_info = true;
		}
		if (use_journal_info) {
			this.cite.use_journal_info = true;
			section_pos = this.cite.front.indexOf("section");
			if (section_pos > -1) {
				this.cite.front = this.cite.front.slice(0,section_pos).concat(this.cite.front.slice(section_pos + 1));
			}
			volume_pos = this.cite.front.indexOf("volume");
			if (volume_pos > -1) {
				this.cite.front = this.cite.front.slice(0,volume_pos).concat(this.cite.front.slice(volume_pos + 1));
			}
			container_title_pos = this.cite.front.indexOf("container-title");
			if (container_title_pos > -1) {
				this.cite.front = this.cite.front.slice(0,container_title_pos).concat(this.cite.front.slice(container_title_pos + 1));
			}
		}
		if (!this.in_series && !this.force_collapse) {
			this.ComposeSet(true);
		}
		if (this.sets.value().length === 0) {
			has_issued = false;
			for (pos = 0, len = this.cite.back.length; pos < len; pos += 1) {
				x = this.cite.back[pos];
				if (x === "issued" && this.cite.issued && this.cite.issued.value) {
					has_issued = true;
					break;
				}
			}
			if (!has_issued) {
				this.cite.back_forceme.push("issued");
			}
		} else {
			this.cite.back_forceme = this.sets.value().slice(-1)[0].back_forceme;
		}
		this.sets.value().push(this.cite);
	}
};
CSL.Parallel.prototype.ComposeSet = function (next_output_in_progress) {
	var cite, pos, master, len;
	if (this.use_parallels) {
		if (this.sets.value().length === 1) {
			if (!this.in_series) {
				this.sets.value().pop();
				this.delim_counter += 1;
			}
		} else {
			len = this.sets.value().length;
			for (pos = 0; pos < len; pos += 1) {
				cite = this.sets.value()[pos];
				if (pos === 0) {
					this.delim_counter += 1;
				} else {
					if (!cite.Item.title && cite.use_journal_info) {
						this.delim_pointers.push(false);
					} else {
						this.delim_pointers.push(this.delim_counter);
					}
					this.delim_counter += 1;
				}
				if (CSL.POSITION_FIRST === cite.position) {
					if (pos === 0) {
						this.state.registry.registry[cite.itemId].master = true;
						this.state.registry.registry[cite.itemId].siblings = [];
					} else {
						if (cite.prevItemID) {
							if (!this.state.registry.registry[cite.prevItemID].parallel) {
								this.state.registry.registry[cite.itemId].parallel = cite.prevItemID;
							} else {
								this.state.registry.registry[cite.itemId].parallel = this.state.registry.registry[cite.prevItemID].parallel;
							}
							this.state.registry.registry[cite.itemId].siblings = this.state.registry.registry[cite.prevItemID].siblings;
							this.state.registry.registry[cite.itemId].siblings.push(cite.itemId);
						}
					}
				}
			}
			this.sets.push([]);
		}
		this.in_series = true;
	}
};
CSL.Parallel.prototype.PruneOutputQueue = function () {
	var len, pos, series, ppos, llen, cite;
	if (this.use_parallels) {
		len = this.sets.mystack.length;
		for (pos = 0; pos < len; pos += 1) {
			series = this.sets.mystack[pos];
			if (series.length > 1) {
				llen = series.length;
				for (ppos = 0; ppos < llen; ppos += 1) {
					cite = series[ppos];
					if (ppos === 0) {
						this.purgeVariableBlobs(cite, cite.back);
					} else if (ppos === (series.length - 1)) {
						this.purgeVariableBlobs(cite, cite.front.concat(cite.back_forceme));
					} else {
						this.purgeVariableBlobs(cite, cite.front.concat(cite.back));
					}
				}
			}
		}
	}
};
CSL.Parallel.prototype.purgeVariableBlobs = function (cite, varnames) {
	var len, pos, varname, b, llen, ppos, out;
	if (this.use_parallels) {
		out = this.state.output.current.value();
		if ("undefined" === typeof out.length) {
			out = out.blobs;
		}
		for (pos = 0, len = this.delim_pointers.length; pos < len; pos += 1) {
			ppos = this.delim_pointers[pos];
			if (ppos !== false) {
				out[ppos].parallel_delimiter = ", ";
			}
		}
		len = varnames.length - 1;
		for (pos = len; pos > -1; pos += -1) {
			varname = varnames[pos];
			if (cite[varname]) {
				llen = cite[varname].blobs.length - 1;
				for (ppos = llen; ppos > -1; ppos += -1) {
					b = cite[varname].blobs[ppos];
					b[0].blobs = b[0].blobs.slice(0, b[1]).concat(b[0].blobs.slice((b[1] + 1)));
				}
			}
		}
	}
};
CSL.Token = function (name, tokentype) {
	this.name = name;
	this.strings = {};
	this.strings.delimiter = "";
	this.strings.prefix = "";
	this.strings.suffix = "";
	this.decorations = false;
	this.variables = [];
	this.execs = [];
	this.tokentype = tokentype;
	this.evaluator = false;
	this.tests = [];
	this.succeed = false;
	this.fail = false;
	this.next = false;
};
CSL.Util.cloneToken = function (token) {
	var newtok, key, pos, len;
	if ("string" === typeof token) {
		return token;
	}
	newtok = new CSL.Token(token.name, token.tokentype);
	for (key in token.strings) {
		if (token.strings.hasOwnProperty(key)) {
			newtok.strings[key] = token.strings[key];
		}
	}
	if (token.decorations) {
		newtok.decorations = [];
		for (pos = 0, len = token.decorations.length; pos < len; pos += 1) {
			newtok.decorations.push(token.decorations[pos].slice());
		}
	}
	newtok.variables = token.variables.slice();
	return newtok;
};
CSL.AmbigConfig = function () {
	this.maxvals = [];
	this.minval = 1;
	this.names = [];
	this.givens = [];
	this.year_suffix = false;
	this.disambiguate = 0;
};
CSL.Blob = function (token, str, levelname) {
	var len, pos, key;
	this.levelname = levelname;
	if (token) {
		this.strings = {};
		for (key in token.strings) {
			if (token.strings.hasOwnProperty(key)) {
				this.strings[key] = token.strings[key];
			}
		}
		this.decorations = [];
		if (token.decorations === undefined) {
			len = 0;
		} else {
			len = token.decorations.length;
		}
		for (pos = 0; pos < len; pos += 1) {
			this.decorations.push(token.decorations[pos].slice());
		}
	} else {
		this.strings = {};
		this.strings.prefix = "";
		this.strings.suffix = "";
		this.strings.delimiter = "";
		this.decorations = [];
	}
	if ("string" === typeof str) {
		this.blobs = str;
	} else {
		this.blobs = [];
	}
	this.alldecor = [this.decorations];
};
CSL.Blob.prototype.push = function (blob) {
	if ("string" === typeof this.blobs) {
		throw "Attempt to push blob onto string object";
	} else {
		blob.alldecor = blob.alldecor.concat(this.alldecor);
		this.blobs.push(blob);
	}
};
CSL.NumericBlob = function (num, mother_token) {
	this.alldecor = [];
	this.num = num;
	this.blobs = num.toString();
	this.status = CSL.START;
	this.strings = {};
	if (mother_token) {
		this.decorations = mother_token.decorations;
		this.strings.prefix = mother_token.strings.prefix;
		this.strings.suffix = mother_token.strings.suffix;
		this.strings["text-case"] = mother_token.strings["text-case"];
		this.successor_prefix = mother_token.successor_prefix;
		this.range_prefix = mother_token.range_prefix;
		this.splice_prefix = mother_token.splice_prefix;
		this.formatter = mother_token.formatter;
		if (!this.formatter) {
			this.formatter =  new CSL.Output.DefaultFormatter();
		}
		if (this.formatter) {
			this.type = this.formatter.format(1);
		}
	} else {
		this.decorations = [];
		this.strings.prefix = "";
		this.strings.suffix = "";
		this.successor_prefix = "";
		this.range_prefix = "";
		this.splice_prefix = "";
		this.formatter = new CSL.Output.DefaultFormatter();
	}
};
CSL.NumericBlob.prototype.setFormatter = function (formatter) {
	this.formatter = formatter;
	this.type = this.formatter.format(1);
};
CSL.Output.DefaultFormatter = function () {};
CSL.Output.DefaultFormatter.prototype.format = function (num) {
	return num.toString();
};
CSL.NumericBlob.prototype.checkNext = function (next) {
	if (! next || !next.num || this.type !== next.type || next.num !== (this.num + 1)) {
		if (this.status === CSL.SUCCESSOR_OF_SUCCESSOR) {
			this.status = CSL.END;
		}
		if ("object" === typeof next) {
			next.status = CSL.SEEN;
		}
	} else { // next number is in the sequence
		if (this.status === CSL.START || this.status === CSL.SEEN) {
			next.status = CSL.SUCCESSOR;
		} else if (this.status === CSL.SUCCESSOR || this.status === CSL.SUCCESSOR_OF_SUCCESSOR) {
			if (this.range_prefix) {
				next.status = CSL.SUCCESSOR_OF_SUCCESSOR;
				this.status = CSL.SUPPRESS;
			} else {
				next.status = CSL.SUCCESSOR;
			}
		}
	}
};
CSL.NumericBlob.prototype.checkLast = function (last) {
    if (this.status === CSL.SEEN 
	|| (last.num !== (this.num - 1) && this.status === CSL.SUCCESSOR)) {
		this.status = CSL.SUCCESSOR;
		return true;
    }
    return false;
};
CSL.Util.fixDateNode = function (parent, pos, node) {
	var form, variable, datexml, subnode, partname, attr, val, prefix, suffix, children, key, subchildren, kkey, display;
	form = this.sys.xml.getAttributeValue(node, "form");
	var lingo = this.sys.xml.getAttributeValue(node, "lingo");
	if (!this.state.getDate(form)) {
		return parent;
	}
	var dateparts = this.sys.xml.getAttributeValue(node, "date-parts");
	variable = this.sys.xml.getAttributeValue(node, "variable");
	prefix = this.sys.xml.getAttributeValue(node, "prefix");
	suffix = this.sys.xml.getAttributeValue(node, "suffix");
	display = this.sys.xml.getAttributeValue(node, "display");
	datexml = this.sys.xml.nodeCopy(this.state.getDate(form));
	this.sys.xml.setAttribute(datexml, 'lingo', this.state.opt.lang);
	this.sys.xml.setAttribute(datexml, 'form', form);
	this.sys.xml.setAttribute(datexml, 'date-parts', dateparts);
	this.sys.xml.setAttribute(datexml, 'variable', variable);
	if (prefix) {
		this.sys.xml.setAttribute(datexml, "prefix", prefix);
	}
	if (suffix) {
		this.sys.xml.setAttribute(datexml, "suffix", suffix);
	}
	if (display) {
		this.sys.xml.setAttribute(datexml, "display", display);
	}
	children = this.sys.xml.children(node);
	for (key in children) {
		subnode = children[key];
		if ("date-part" === this.sys.xml.nodename(subnode)) {
			partname = this.sys.xml.getAttributeValue(subnode, "name");
			subchildren = this.sys.xml.attributes(subnode);
			for (attr in subchildren) {
				if (subchildren.hasOwnProperty(attr)) {
					if ("@name" === attr) {
						continue;
					}
					if (lingo && lingo !== this.state.opt.lang) {
						if (["@suffix", "@prefix", "@form"].indexOf(attr) > -1) {
							continue;
						}
					}
					val = subchildren[attr];
					this.sys.xml.setAttributeOnNodeIdentifiedByNameAttribute(datexml, "date-part", partname, attr, val);
				}
			}
		}
	}
	if ("year" === this.sys.xml.getAttributeValue(node, "date-parts")) {
		this.sys.xml.deleteNodeByNameAttribute(datexml, 'month');
		this.sys.xml.deleteNodeByNameAttribute(datexml, 'day');
	} else if ("year-month" === this.sys.xml.getAttributeValue(node, "date-parts")) {
		this.sys.xml.deleteNodeByNameAttribute(datexml, 'day');
	}
	return this.sys.xml.insertChildNodeAfter(parent, node, pos, datexml);
};
CSL.Util.Institutions = {};
CSL.Util.Institutions.outputInstitutions = function (state, display_names) {
	var len, pos, name, institution, value, token_long, token_short, parts;
	state.output.openLevel("institution");
	len = display_names.length;
	for (pos = 0; pos < len; pos += 1) {
		name = display_names[pos];
		institution = state.output.getToken("institution");
		value = name.literal;
		if (state.transform.institution[value]) {
			token_long = state.output.mergeTokenStrings("institution-long", "institution-if-short");
		} else {
			token_long = state.output.getToken("institution-long");
		}
		token_short = state.output.getToken("institution-short");
		parts = institution.strings["institution-parts"];
		if ("short" === parts) {
			state.transform.output(state, value, token_short, token_long, true);
		} else if ("short-long" === parts) {
			state.transform.output(state, value, token_short);
			state.output.append(value, token_long);
		} else if ("long-short" === parts) {
			state.output.append(value, token_long);
			state.transform.output(state, value, token_short);
		} else {
			state.output.append(value, token_long);
		}
	}
	state.output.closeLevel();
};
CSL.Util.Names = {};
CSL.Util.Names.outputNames = function (state, display_names) {
	var segments, and;
	segments = new this.StartMiddleEnd(state, display_names);
	and = state.output.getToken("name").strings.delimiter;
	if (state.tmp.use_ellipsis) {
		and = state.output.getToken("inner").strings.delimiter + "\u2026 ";
	} else if (state.output.getToken("name").strings["delimiter-precedes-last"] === "always") {
		and = state.output.getToken("inner").strings.delimiter + and;
	} else if (state.output.getToken("name").strings["delimiter-precedes-last"] === "never") {
		if (!and) {
			and = state.output.getToken("inner").strings.delimiter;
		}
	} else if ((segments.segments.start.length + segments.segments.middle.length) > 1) {
		and = state.output.getToken("inner").strings.delimiter + and;
	} else {
		if (!and) {
			and = state.output.getToken("inner").strings.delimiter;
		}
	}
	if (and.match(CSL.STARTSWITH_ROMANESQUE_REGEXP)) {
		and = " " + and;
	}
	if (and.match(CSL.ENDSWITH_ROMANESQUE_REGEXP)) {
		and = and + " ";
	}
	state.output.getToken("name").strings.delimiter = and;
	state.output.openLevel("name");
	state.output.openLevel("inner");
	segments.outputSegmentNames("start");
	segments.outputSegmentNames("middle");
	state.output.closeLevel(); // inner
	segments.outputSegmentNames("end");
	state.output.closeLevel(); // name
};
CSL.Util.Names.StartMiddleEnd = function (state, names) {
	var start, middle, endstart, end, ret;
	this.state = state;
	this.nameoffset = 0;
	start = names.slice(0, 1);
	middle = names.slice(1, (names.length - 1));
	endstart = 1;
	if (names.length > 1) {
		endstart = (names.length - 1);
	}
	end = names.slice(endstart, (names.length));
	ret = {};
	ret.start = start;
	ret.middle = middle;
	ret.end = end;
	this.segments = ret;
};
CSL.Util.Names.StartMiddleEnd.prototype.outputSegmentNames = function (seg) {
	var state, value, sequence, pos, len;
	state = this.state;
	len = this.segments[seg].length;
	for (pos = 0; pos < len; pos += 1) {
		this.namenum = parseInt(pos, 10);
		this.name = this.segments[seg][pos];
		var translit = state.opt["locale-pri"];
		this.outputName(seg, pos, translit);
	}
	this.nameoffset += this.segments[seg].length;
};
CSL.Util.Names.StartMiddleEnd.prototype.outputName = function (seg, pos, translit, tokenname) {
	var name = this.state.transform.name(this.state, this.name, translit);
	if (name.literal) {
		value = name.literal;
		this.state.output.append(name.literal, "empty");
	} else {
		if (name.transliterated) {
			this.state.output.openLevel("empty");
		}
		if (tokenname) {
			this.state.output.openLevel(tokenname);
		} 
		sequence = CSL.Util.Names.getNamepartSequence(this.state, seg, name);
		this.state.output.openLevel(sequence[0][0]); // articular join
		this.state.output.openLevel(sequence[0][1]); // join to last element (?)
		this.state.output.openLevel(sequence[0][2]); // inter-element join (?)
		this.outputNameParts(name, sequence[1]);
		this.state.output.closeLevel();
		this.state.output.openLevel(sequence[0][2]);
		this.outputNameParts(name, sequence[2]);
		this.state.output.closeLevel();
		this.state.output.closeLevel();
		this.outputNameParts(name, sequence[3]);
		this.state.output.closeLevel();
		if (tokenname) {
			this.state.output.closeLevel(); // parens
		}
		if (this.state.opt["locale-show-original-names"] 
			&& this.state.tmp.area === "bibliography"
			&& name.transliterated 
			&& this.name.given) {
			var parens = new CSL.Blob();
			parens.strings.prefix = " (";
			parens.strings.suffix = ")";
			this.state.output.addToken("parens", false, parens);
			this.outputName(seg, pos, false, "parens");
		}
		if (name.transliterated) {
			this.state.output.closeLevel(); // wrapper to avoid delimiter between names.
		}
	}
	return name.transliterated;
};
CSL.Util.Names.StartMiddleEnd.prototype.outputNameParts = function (name, subsequence) {
	var state, len, pos, key, namepart, initialize_with, preffie;
	state = this.state;
	for (var i = subsequence.length - 1; i > -1; i += -1) {
	    if (!name[subsequence[i]]) {
		subsequence = subsequence.slice(0, i).concat(subsequence.slice(i + 1));
	    }
	}
	preffie = "";
	len = subsequence.length;
	for (pos = 0; pos < len; pos += 1) {
		key = subsequence[pos];
		namepart = name[key];
		if (preffie) {
		    namepart = preffie + namepart;
		    preffie = "";
		}
		if (["given", "suffix", "dropping-particle"].indexOf(key) > -1 && 0 === state.tmp.disambig_settings.givens[state.tmp.nameset_counter][this.namenum + this.nameoffset]) {
			if (!(key === "given" && !name.family)) {
				if (key === "suffix") {
					if (name.suffix !== name.suffix.toLowerCase()) {
						continue;
					}
				} else {
					continue;
				}
			}
		}
		if (key === "dropping-particle" 
		    && ["'","\u02bc","\u2019"].indexOf(namepart.slice(-1)) > -1
		    && pos < subsequence.length - 1
		    && subsequence[pos + 1] === "family") {
			preffie = namepart;
			continue;
		}
		if ("given" === key) {
			if (1 === state.tmp.disambig_settings.givens[state.tmp.nameset_counter][(this.namenum + this.nameoffset)] && !name.block_initialize) {
				initialize_with = state.output.getToken("name").strings["initialize-with"];
				namepart = CSL.Util.Names.initializeWith(state, namepart, initialize_with);
			} else {
				namepart = CSL.Util.Names.unInitialize(state, namepart);
			}
		}
		state.output.append(namepart, key);
	}
};
CSL.Util.Names.getNamepartSequence = function (state, seg, name) {
	var token, suffix_sep, romanesque, sequence;
	token = state.output.getToken("name");
	if (name["comma-suffix"]) {
		state.output.getToken("suffixsep").strings.delimiter = ", ";
	} else {
		state.output.getToken("suffixsep").strings.delimiter = " ";
	}
	romanesque = name.family.match(CSL.ROMANESQUE_REGEXP);
	if (!romanesque) {
		sequence = [["empty", "empty", "empty"], ["non-dropping-particle", "family"], ["given"], []];
	} else if (name["static-ordering"]) { // entry likes sort order
		sequence = [["empty", "space", "space"], ["non-dropping-particle", "family"], ["given"], []];
	} else if (state.tmp.sort_key_flag) {
		if (state.opt["demote-non-dropping-particle"] === "never") {
			sequence = [["suffixsep", "sortsep", "space"], ["non-dropping-particle", "family", "dropping-particle"], ["given"], ["suffix"]];
		} else {
			sequence = [["suffixsep", "sortsep", "space"], ["family"], ["given", "dropping-particle", "non-dropping-particle"], ["suffix"]];
		}
	} else if (token && (token.strings["name-as-sort-order"] === "all" || (token.strings["name-as-sort-order"] === "first" && seg === "start"))) {
		if (["always", "display-and-sort"].indexOf(state.opt["demote-non-dropping-particle"]) > -1) {
			sequence = [["sortsep", "sortsep", "space"], ["family"], ["given", "dropping-particle", "non-dropping-particle"], ["suffix"]];
		} else {
			sequence = [["sortsep", "sortsep", "space"], ["non-dropping-particle", "family"], ["given", "dropping-particle"], ["suffix"]];
		}
	} else { // plain vanilla
		sequence = [["suffixsep", "space", "space"], ["given"], ["dropping-particle", "non-dropping-particle", "family"], ["suffix"]];
	}
	return sequence;
};
CSL.Util.Names.reinit = function (state, Item) {
	state.tmp.value = [];
	state.tmp.name_et_al_term = false;
	state.tmp.name_et_al_decorations = false;
	state.tmp.name_et_al_form = "long";
	state.tmp.et_al_prefix = false;
};
CSL.Util.Names.getCommonTerm = function (state, namesets) {
	var base_nameset, varnames, len, pos, short_namesets, nameset;
	if (namesets.length < 2) {
		return false;
	}
	base_nameset = namesets[0];
	varnames = [];
		varnames.push(base_nameset.variable);
	short_namesets = namesets.slice(1);
	len = short_namesets.length;
	for (pos = 0; pos < len; pos += 1) {
		nameset = short_namesets[pos];
		if (!CSL.Util.Names.compareNamesets(base_nameset, nameset)) {
			return false;
		}
		if (varnames.indexOf(nameset.variable) === -1) {
			varnames.push(nameset.variable);
		}
	}
	varnames.sort();
	return varnames.join("");
};
CSL.Util.Names.compareNamesets = function (base_nameset, nameset) {
	var name, pos, len, part, ppos, llen;
	if (!base_nameset.names || !nameset.names || base_nameset.names.length !== nameset.names.length) {
		return false;
	}
	len = nameset.names.length;
	for (pos = 0; pos < len; pos += 1) {
		name = nameset.names[pos];
		llen = CSL.NAME_PARTS.length;
		for (ppos = 0; ppos < llen; ppos += 1) {
			part = CSL.NAME_PARTS[ppos];
			if (!base_nameset.names[pos] || base_nameset.names[pos][part] != name[part]) {
				return false;
			}
		}
	}
	return true;
};
CSL.Util.Names.unInitialize = function (state, name) {
	var namelist, punctlist, ret, pos, len;
	if (!name) {
		return "";
	}
	namelist = name.split(/(?:\-|\s+)/);
	punctlist = name.match(/(\-|\s+)/g);
	ret = "";
	for (pos = 0, len = namelist.length; pos < len; pos += 1) {
		if (CSL.ALL_ROMANESQUE_REGEXP.exec(namelist[pos].slice(0,-1))) {
			namelist[pos] = namelist[pos].slice(0, 1) + namelist[pos].slice(1).toLowerCase();
		}
		ret += namelist[pos];
		if (pos < len - 1) {
			ret += punctlist[pos];
		}
	}
	return ret;
};
CSL.Util.Names.initializeWith = function (state, name, terminator) {
	var namelist, l, i, n, m, extra, ret, s, c, pos, len, ppos, llen, llst, mx, lst;
	if (!name) {
		return "";
	}
	if (!terminator) {
		terminator = "";
	}
	namelist = name;
	if (state.opt["initialize-with-hyphen"] === false) {
		namelist = namelist.replace(/\-/g, " ");
	}
	namelist = namelist.replace(/\./g, " ").replace(/\s*\-\s*/g, "-").replace(/\s+/g, " ");
	namelist = namelist.split(/(\-|\s+)/);
	for (i = 0, ilen = namelist.length; i < ilen; i += 2) {
		n = namelist[i];
		if (!n) {
			continue;
		}
		m = n.match(CSL.NAME_INITIAL_REGEXP);
		if (!m && (!n.match(CSL.STARTSWITH_ROMANESQUE_REGEXP) && n.length > 1 && terminator.match("%s"))) {
			m = n.match(/(.)(.*)/);
		}
		if (m && m[1] === m[1].toUpperCase()) {
			extra = "";
			if (m[2]) {
				s = "";
				lst = m[2].split("");
				for (j = 0, jlen = lst.length; j < jlen; j += 1) {
					c = lst[j];
					if (c === c.toUpperCase()) {
						s += c;
					} else {
						break;
					}
				}
				if (s.length < m[2].length) {
					extra = s.toLocaleLowerCase();
				}
			}
			namelist[i] = m[1].toLocaleUpperCase() + extra;
			if (i < (ilen - 1)) {
				if (terminator.match("%s")) {
					namelist[i] = terminator.replace("%s", namelist[i]);
				} else {
					if (namelist[i + 1].indexOf("-") > -1) {
						namelist[i + 1] = terminator + namelist[i + 1];
					} else {
						namelist[i + 1] = terminator;
					}
				}
			} else {
				if (terminator.match("%s")) {
					namelist[i] = terminator.replace("%s", namelist[i]);
				} else {
					namelist.push(terminator);
				}
			}
		} else if (n.match(CSL.ROMANESQUE_REGEXP)) {
			namelist[i] = " " + n;
		}
	}
	ret = CSL.Util.Names.stripRight(namelist.join(""));
	ret = ret.replace(/\s*\-\s*/g, "-").replace(/\s+/g, " ");
	return ret;
};
CSL.Util.Names.stripRight = function (str) {
	var end, pos, len;
	end = 0;
	len = str.length - 1;
	for (pos = len; pos > -1; pos += -1) {
		if (str[pos] !== " ") {
			end = pos + 1;
			break;
		}
	}
	return str.slice(0, end);
};
CSL.Util.Names.initNameSlices = function (state) {
	var len, pos;
	state.tmp.names_cut = {
		counts: [],
		variable: {}
	};
	len = CSL.NAME_VARIABLES.length;
	for (pos = 0; pos < len; pos += 1) {
		state.tmp.names_cut.counts[CSL.NAME_VARIABLES[pos]] = 0;
	}
};
CSL.Engine.prototype.parseName = function (name) {
	var m, idx;
	if (! name["non-dropping-particle"] && name.family) {
		m = name.family.match(/^([ a-z]+\s+)/);
		if (m) {
			name.family = name.family.slice(m[1].length);
			name["non-dropping-particle"] = m[1].replace(/\s+$/, "");
		}
	}
	if (!name.suffix && name.given) {
		m = name.given.match(/(\s*,!*\s*)/);
		if (m) {
			idx = name.given.indexOf(m[1]);
			if (name.given.slice(idx, idx + m[1].length).replace(/\s*/g, "").length === 2) {
				name["comma-suffix"] = true;
			}
			name.suffix = name.given.slice(idx + m[1].length);
			name.given = name.given.slice(0, idx);
		}
	}
	if (! name["dropping-particle"] && name.given) {
		m = name.given.match(/^(\s+[ a-z]*[a-z])$/);
		if (m) {
			name.given = name.given.slice(0, m[1].length * -1);
			name["dropping-particle"] = m[2].replace(/^\s+/, "");
		}
	}
};
CSL.Util.Dates = {};
CSL.Util.Dates.year = {};
CSL.Util.Dates.year["long"] = function (state, num) {
	if (!num) {
		if ("boolean" === typeof num) {
			num = "";
		} else {
			num = 0;
		}
	}
	return num.toString();
};
CSL.Util.Dates.year["short"] = function (state, num) {
	num = num.toString();
	if (num && num.length === 4) {
		return num.substr(2);
	}
};
CSL.Util.Dates.year.numeric = function (state, num) {
	var m, pre;
	num = "" + num;
	m = num.match(/([0-9]*)$/);
	if (m) {
		pre = num.slice(0, m[1].length * -1);
		num = m[1];
	} else {
		pre = num;
		num = "";
	}
	while (num.length < 4) {
		num = "0" + num;
	}
	return (pre + num);
};
CSL.Util.Dates.month = {};
CSL.Util.Dates.month.numeric = function (state, num) {
	if (num) {
		num = parseInt(num, 10);
		if (num > 12) {
			num = "";
		}
	}
	var ret = "" + num;
	return ret;
};
CSL.Util.Dates.month["numeric-leading-zeros"] = function (state, num) {
	if (!num) {
		num = 0;
	}
	num = parseInt(num, 10);
	if (num > 12) {
		num = 0;
	}
	num = "" + num;
	while (num.length < 2) {
		num = "0" + num;
	}
	return num.toString();
};
CSL.Util.Dates.month["long"] = function (state, num) {
	var stub = "month-";
	num = parseInt(num, 10);
	if (num > 12) {
		stub = "season-";
		if (num > 16) {
			num = num - 16;
		} else {
			num = num - 12;
		}
	}
	num = "" + num;
	while (num.length < 2) {
		num = "0" + num;
	}
	num = stub + num;
	return state.getTerm(num, "long", 0);
};
CSL.Util.Dates.month["short"] = function (state, num) {
	var stub = "month-";
	num = parseInt(num, 10);
	if (num > 12) {
		stub = "season-";
		if (num > 16) {
			num = num - 16;
		} else {
			num = num - 12;
		}
	}
	num = "" + num;
	while (num.length < 2) {
		num = "0" + num;
	}
	num = "month-" + num;
	return state.getTerm(num, "short", 0);
};
CSL.Util.Dates.day = {};
CSL.Util.Dates.day.numeric = function (state, num) {
	return num.toString();
};
CSL.Util.Dates.day["long"] = CSL.Util.Dates.day.numeric;
CSL.Util.Dates.day["numeric-leading-zeros"] = function (state, num) {
	if (!num) {
		num = 0;
	}
	num = num.toString();
	while (num.length < 2) {
		num = "0" + num;
	}
	return num.toString();
};
CSL.Util.Dates.day.ordinal = function (state, num, gender) {
	return state.fun.ordinalizer.format(num, gender);
};
CSL.Util.Sort = {};
CSL.Util.Sort.strip_prepositions = function (str) {
	var m;
	if ("string" === typeof str) {
		m = str.toLocaleLowerCase();
		m = str.match(/^((a|an|the)\s+)/);
	}
	if (m) {
		str = str.substr(m[1].length);
	}
	return str;
};
CSL.Util.substituteStart = function (state, target) {
	var element_trace, display, bib_first, func, choose_start, if_start, nodetypes;
	nodetypes = ["number", "date", "names"];
	if (("text" === this.name && !this.postponed_macro) || nodetypes.indexOf(this.name) > -1) {
		element_trace = function (state, Item, item) {
			if (state.tmp.element_trace.value() === "author" || "names" === this.name) {
				if (item && item["author-only"]) {
					state.tmp.element_trace.push("do-not-suppress-me");
				} else if (item && item["suppress-author"]) {
					state.tmp.element_trace.push("suppress-me");
				}
			} else {
				if (item && item["author-only"]) {
					state.tmp.element_trace.push("suppress-me");
				} else if (item && item["suppress-author"]) {
					state.tmp.element_trace.push("do-not-suppress-me");
				}
			}
		};
		this.execs.push(element_trace);
	}
	display = this.strings.cls;
	this.strings.cls = false;
	if (state.build.render_nesting_level === 0) {
		if (state.build.area === "bibliography" && state.bibliography.opt["second-field-align"]) {
			bib_first = new CSL.Token("group", CSL.START);
			bib_first.decorations = [["@display", "left-margin"]];
			func = function (state, Item) {
				if (!state.tmp.render_seen) {
					state.output.startTag("bib_first", bib_first);
					state.tmp.count_offset_characters = true;
					state.output.calculate_offset = true;
				}
			};
			bib_first.execs.push(func);
			target.push(bib_first);
		} else if (CSL.DISPLAY_CLASSES.indexOf(display) > -1) {
			bib_first = new CSL.Token("group", CSL.START);
			bib_first.decorations = [["@display", display]];
			func = function (state, Item) {
				state.output.startTag("bib_first", bib_first);
			};
			bib_first.execs.push(func);
			target.push(bib_first);
		}
		state.build.cls = display;
	}
	state.build.render_nesting_level += 1;
	if (state.build.substitute_level.value() === 1) {
		choose_start = new CSL.Token("choose", CSL.START);
		CSL.Node.choose.build.call(choose_start, state, target);
		if_start = new CSL.Token("if", CSL.START);
		func = function (state, Item) {
			if (state.tmp.can_substitute.value()) {
				return true;
			}
			return false;
		};
		if_start.tests.push(func);
		if_start.evaluator = state.fun.match.any;
		target.push(if_start);
	}
};
CSL.Util.substituteEnd = function (state, target) {
	var func, bib_first_end, bib_other, if_end, choose_end, toplevel, hasval, author_substitute, printing, str;
	state.build.render_nesting_level += -1;
	if (state.build.render_nesting_level === 0) {
		if (state.build.cls) {
			func = function (state, Item) {
				state.output.endTag("bib_first");
				state.tmp.count_offset_characters = false;
				state.output.calculate_offset = false;
			};
			this.execs.push(func);
			state.build.cls = false;
		}
		if (state.build.area === "bibliography" && state.bibliography.opt["second-field-align"]) {
			bib_first_end = new CSL.Token("group", CSL.END);
			func = function (state, Item) {
				if (!state.tmp.render_seen) {
					state.output.endTag(); // closes bib_first
					state.tmp.count_offset_characters = false;
					state.output.calculate_offset = false;
				}
			};
			bib_first_end.execs.push(func);
			target.push(bib_first_end);
			bib_other = new CSL.Token("group", CSL.START);
			bib_other.decorations = [["@display", "right-inline"]];
			func = function (state, Item) {
				if (!state.tmp.render_seen) {
					state.tmp.render_seen = true;
					state.output.startTag("bib_other", bib_other);
				}
			};
			bib_other.execs.push(func);
			target.push(bib_other);
		}
	}
	if (state.build.substitute_level.value() === 1) {
		if_end = new CSL.Token("if", CSL.END);
		target.push(if_end);
		choose_end = new CSL.Token("choose", CSL.END);
		CSL.Node.choose.build.call(choose_end, state, target);
	}
	toplevel = "names" === this.name && state.build.substitute_level.value() === 0;
	hasval = "string" === typeof state[state.build.area].opt["subsequent-author-substitute"];
	if (toplevel && hasval) {
		author_substitute = new CSL.Token("text", CSL.SINGLETON);
		func = function (state, Item) {
			printing = !state.tmp.suppress_decorations;
			if (printing) {
				if (!state.tmp.rendered_name) {
					state.tmp.rendered_name = state.output.string(state, state.tmp.name_node.blobs, false);
					if (state.tmp.rendered_name) {
						if (state.tmp.rendered_name === state.tmp.last_rendered_name) {
							str = new CSL.Blob(false, state[state.tmp.area].opt["subsequent-author-substitute"]);
							state.tmp.name_node.blobs = [str];
						}
						state.tmp.last_rendered_name = state.tmp.rendered_name;
					}
				}
			}
		};
		author_substitute.execs.push(func);
		target.push(author_substitute);
	}
	if (("text" === this.name && !this.postponed_macro) || ["number", "date", "names"].indexOf(this.name) > -1) {
		func = function (state, Item) {
			state.tmp.element_trace.pop();
		};
		this.execs.push(func);
	}
};
CSL.Util.padding = function (num) {
	m = num.match(/\s*(-{0,1}[0-9]+)/);
	if (m) {
		num = parseInt(m[1], 10);
		if (num < 0) {
			num = 99999999999999999999 + num;
		}
		num = "" + num;
		while (num.length < 20) {
			num = "0" + num;
		}
	}
	return num;
}
CSL.Util.LongOrdinalizer = function () {};
CSL.Util.LongOrdinalizer.prototype.init = function (state) {
	this.state = state;
};
CSL.Util.LongOrdinalizer.prototype.format = function (num, gender) {
	if (num < 10) {
		num = "0" + num;
	}
	var ret = CSL.Engine.getField(
		CSL.LOOSE, 
		this.state.locale[this.state.opt.lang].terms,
		"long-ordinal-" + num,
		"long", 
		0, 
		gender
	);
	if (!ret) {
		ret = this.state.fun.ordinalizer.format(num, gender);
	}
	this.state.tmp.cite_renders_content = true;
	return ret;
};
CSL.Util.Ordinalizer = function () {};
CSL.Util.Ordinalizer.prototype.init = function (state) {
	this.suffixes = {};
	for (var i = 0, ilen = 3; i < ilen; i += 1) {
		var gender = [undefined, "masculine", "feminine"][i];
		this.suffixes[gender] = [];
		for (var j = 1; j < 5; j += 1) {
			var ordinal = state.getTerm("ordinal-0" + j, "long", false, gender);
			if ("undefined" === typeof ordinal) {
				delete this.suffixes[gender];
				break;
			}
			this.suffixes[gender].push(ordinal);			
		}
	}
};
CSL.Util.Ordinalizer.prototype.format = function (num, gender) {
	var str;
	num = parseInt(num, 10);
	str = num.toString();
	if ((num / 10) % 10 === 1 || (num > 10 && num < 20)) {
		str += this.suffixes[gender][3];
	} else if (num % 10 === 1) {
		str += this.suffixes[gender][0];
	} else if (num % 10 === 2) {
		str += this.suffixes[gender][1];
	} else if (num % 10 === 3) {
		str += this.suffixes[gender][2];
	} else {
		str += this.suffixes[gender][3];
	}
	return str;
};
CSL.Util.Romanizer = function () {};
CSL.Util.Romanizer.prototype.format = function (num) {
	var ret, pos, n, numstr, len;
	ret = "";
	if (num < 6000) {
		numstr = num.toString().split("");
		numstr.reverse();
		pos = 0;
		n = 0;
		len = numstr.length;
		for (pos = 0; pos < len; pos += 1) {
			n = parseInt(numstr[pos], 10);
			ret = CSL.ROMAN_NUMERALS[pos][n] + ret;
		}
	}
	return ret;
};
CSL.Util.Suffixator = function (slist) {
	if (!slist) {
		slist = CSL.SUFFIX_CHARS;
	}
	this.slist = slist.split(",");
};
CSL.Util.Suffixator.prototype.format = function (num) {
	var suffixes = this.get_suffixes(num);
	return suffixes[(suffixes.length - 1)];
};
CSL.Util.Suffixator.prototype.get_suffixes = function (num) {
	var suffixes, digits, chrs, pos, len, llen, ppos;
	num = parseInt(num, 10);
	suffixes = [];
	for (pos = 0; pos <= num; pos += 1) {
		if (!pos) {
			suffixes.push([0]);
		} else {
			suffixes.push(this.incrementArray(suffixes[(suffixes.length - 1)], this.slist));
		}
	}
	len = suffixes.length;
	for (pos = 0; pos < len; pos += 1) {
		digits = suffixes[pos];
		chrs = "";
		llen = digits.length;
		for (ppos = 0; ppos < llen; ppos += 1) {
			chrs = chrs + this.slist[digits[ppos]];
		}
		suffixes[pos] = chrs;
	}
	return suffixes;
};
CSL.Util.Suffixator.prototype.incrementArray = function (array) {
	var incremented, newdigit, i, pos, len, ppos, llen;
	array = array.slice();
	incremented = false;
	len = array.length - 1;
	for (pos = len; pos > -1; pos += -1) {
		if (array[pos] < (this.slist.length - 1)) {
			array[pos] += 1;
			for (ppos = (pos + 1), llen = array.length; ppos < llen; ppos += 1) {
				array[ppos] = 0;
			}
			incremented = true;
			break;
		}
	}
	if (!incremented) {
		len = array.length;
		for (pos = 0; pos < len; pos += 1) {
			array[pos] = 0;
		}
		newdigit = [0];
		array = newdigit.concat(array);
	}
	return array;
};
CSL.Util.PageRangeMangler = {};
CSL.Util.PageRangeMangler.getFunction = function (state) {
	var rangerex, pos, len, stringify, listify, expand, minimize, minimize_internal, chicago, lst, m, b, e, ret, begin, end, ret_func, ppos, llen;
	rangerex = /([a-zA-Z]*)([0-9]+)\s*-\s*([a-zA-Z]*)([0-9]+)/;
	stringify = function (lst) {
		len = lst.length;
		for (pos = 1; pos < len; pos += 2) {
			if ("object" === typeof lst[pos]) {
				lst[pos] = lst[pos].join("");
			}
		}
		return lst.join("");
	};
	listify = function (str) {
		var m, lst, ret;
		m = str.match(/([a-zA-Z]*[0-9]+\s*-\s*[a-zA-Z]*[0-9]+)/g);
		lst = str.split(/[a-zA-Z]*[0-9]+\s*-\s*[a-zA-Z]*[0-9]+/);
		if (lst.length === 0) {
			ret = m;
		} else {
			ret = [lst[0]];
			for (pos = 1, len = lst.length; pos < len; pos += 1) {
				ret.push(m[pos - 1]);
				ret.push(lst[pos]);
			}
		}
		return ret;
	};
	expand = function (str) {
		str = "" + str;
		lst = listify(str);
		len = lst.length;
		for (pos = 1; pos < len; pos += 2) {
			m = lst[pos].match(rangerex);
			if (m) {
				if (!m[3] || m[1] === m[3]) {
					if (m[4].length < m[2].length) {
						m[4] = m[2].slice(0, (m[2].length - m[4].length)) + m[4];
					}
					if (parseInt(m[2], 10) < parseInt(m[4], 10)) {
						m[3] = "\u2013" + m[1];
						lst[pos] = m.slice(1);
					}
				}
			}
			if ("string" === typeof lst[pos]) {
				lst[pos] = lst[pos].replace("-", "\u2013");
			}
		}
		return lst;
	};
	minimize = function (lst) {
		len = lst.length;
		for (pos = 1; pos < len; pos += 2) {
			lst[pos][3] = minimize_internal(lst[pos][1], lst[pos][3]);
			if (lst[pos][2].slice(1) === lst[pos][0]) {
				lst[pos][2] = "\u2013";
			}
		}
		return stringify(lst);
	};
	minimize_internal = function (begin, end) {
		b = ("" + begin).split("");
		e = ("" + end).split("");
		ret = e.slice();
		ret.reverse();
		if (b.length === e.length) {
			llen = b.length;
			for (ppos = 0; ppos < llen; ppos += 1) {
				if (b[ppos] === e[ppos]) {
					ret.pop();
				} else {
					break;
				}
			}
		}
		ret.reverse();
		return ret.join("");
	};
	chicago = function (lst) {
		len = lst.length;
		for (pos = 1; pos < len; pos += 2) {
			if ("object" === typeof lst[pos]) {
				m = lst[pos];
				begin = parseInt(m[1], 10);
				end = parseInt(m[3], 10);
				if (begin > 100 && begin % 100 && parseInt((begin / 100), 10) === parseInt((end / 100), 10)) {
					m[3] = "" + (end % 100);
				} else if (begin >= 10000) {
					m[3] = "" + (end % 1000);
				}
			}
			if (m[2].slice(1) === m[0]) {
				m[2] = "\u2013";
			}
		}
		return stringify(lst);
	};
	if (!state.opt["page-range-format"]) {
		ret_func = function (str) {
			return str;
		};
	} else if (state.opt["page-range-format"] === "expanded") {
		ret_func = function (str) {
			var lst = expand(str);
			return stringify(lst);
		};
	} else if (state.opt["page-range-format"] === "minimal") {
		ret_func = function (str) {
			var lst = expand(str);
			return minimize(lst);
		};
	} else if (state.opt["page-range-format"] === "chicago") {
		ret_func = function (str) {
			var lst = expand(str);
			return chicago(lst);
		};
	}
	return ret_func;
};
CSL.Util.FlipFlopper = function (state) {
	var tagdefs, pos, len, p, entry, allTags, ret, def, esc, makeHashes, closeTags, flipTags, openToClose, openToDecorations, okReverse, hashes, allTagsLst, lst;
	this.state = state;
	this.blob = false;
	tagdefs = [
		["<i>", "</i>", "italics", "@font-style", ["italic", "normal","normal"], true],
		["<b>", "</b>", "bold", "@font-weight", ["bold", "normal","normal"], true],
		["<sup>", "</sup>", "superscript", "@vertical-align", ["sup", "sup","baseline"], true],
		["<sub>", "</sub>", "subscript", "@vertical-align", ["sub", "sub","baseline"], true],
		["<sc>", "</sc>", "smallcaps", "@font-variant", ["small-caps", "small-caps","normal"], true],
		["<span class=\"nocase\">", "</span>", "passthrough", "@passthrough", ["true", "true","true"], true],
		["<span class=\"nodecor\">", "</span>", "passthrough", "@passthrough", ["true", "true","true"], true],
		['"',  '"',  "quotes",  "@quotes",  ["true",  "inner","true"],  "'"],
		[" '",  "'",  "quotes",  "@quotes",  ["inner",  "true","true"],  '"']
	];
	for (pos = 0; pos < 2; pos += 1) {
		p = ["-", "-inner-"][pos];
		entry = [];
		entry.push(state.getTerm(("open" + p + "quote")));
		entry.push(state.getTerm(("close" + p + "quote")));
		entry.push(("quote" + "s"));
		entry.push(("@" + "quote" + "s"));
		if ("-" === p) {
			entry.push(["true", "inner"]);
		} else {
			entry.push(["inner", "true"]);
		}
		entry.push(true);
		tagdefs.push(entry);
	}
	allTags = function (tagdefs) {
		ret = [];
		len = tagdefs.length;
		for (pos = 0; pos < len; pos += 1) {
			def = tagdefs[pos];
			if (ret.indexOf(def[0]) === -1) {
				esc = "";
				if (["(", ")", "[", "]"].indexOf(def[0]) > -1) {
					esc = "\\";
				}
				ret.push(esc + def[0]);
			}
			if (ret.indexOf(def[1]) === -1) {
				esc = "";
				if (["(", ")", "[", "]"].indexOf(def[1]) > -1) {
					esc = "\\";
				}
				ret.push(esc + def[1]);
			}
		}
		return ret;
	};
	allTagsLst = allTags(tagdefs);
	lst = [];
	for (pos = 0, len = allTagsLst.length; pos < len; pos += 1) {
		if (allTagsLst[pos]) {
			lst.push(allTagsLst[pos]);
		}
	}
	allTagsLst = lst.slice();
	this.allTagsRexMatch = new RegExp("(" + allTagsLst.join("|") + ")", "g");
	this.allTagsRexSplit = new RegExp("(?:" + allTagsLst.join("|") + ")");
	makeHashes = function (tagdefs) {
		closeTags = {};
		flipTags = {};
		openToClose = {};
		openToDecorations = {};
		okReverse = {};
		len = tagdefs.length;
		for (pos = 0; pos < len; pos += 1) {
			closeTags[tagdefs[pos][1]] = true;
			flipTags[tagdefs[pos][1]] = tagdefs[pos][5];
			openToClose[tagdefs[pos][0]] = tagdefs[pos][1];
			openToDecorations[tagdefs[pos][0]] = [tagdefs[pos][3], tagdefs[pos][4]];
			okReverse[tagdefs[pos][3]] = [tagdefs[pos][3], [tagdefs[pos][4][2], tagdefs[pos][1]]];
		}
		return [closeTags, flipTags, openToClose, openToDecorations, okReverse];
	};
	hashes = makeHashes(tagdefs);
	this.closeTagsHash = hashes[0];
	this.flipTagsHash = hashes[1];
	this.openToCloseHash = hashes[2];
	this.openToDecorations = hashes[3];
	this.okReverseHash = hashes[4];
};
CSL.Util.FlipFlopper.prototype.init = function (str, blob) {
	if (!blob) {
		this.strs = this.getSplitStrings(str);
		this.blob = new CSL.Blob();
	} else {
		this.blob = blob;
		this.strs = this.getSplitStrings(this.blob.blobs);
		this.blob.blobs = [];
	}
	this.blobstack = new CSL.Stack(this.blob);
};
CSL.Util.FlipFlopper.prototype.getSplitStrings = function (str) {
	var strs, pos, len, newstr, head, tail, expected_closers, expected_openers, expected_flips, tagstack, badTagStack, posA, sameAsOpen, openRev, flipRev, tag, ibeenrunned, posB, wanted_closer, posC, sep, resplice, params, lenA, lenB, lenC, badTagPos, mx, myret;
	mx = str.match(this.allTagsRexMatch);
	strs = str.split(this.allTagsRexSplit);
	myret = [strs[0]];
	for (pos = 1, len = strs.length; pos < len; pos += 1) {
		myret.push(mx[pos - 1]);
		myret.push(strs[pos]);
	}
	strs = myret.slice();
	len = strs.length - 2;
	for (pos = len; pos > 0; pos += -2) {
		if (strs[(pos - 1)].slice((strs[(pos - 1)].length - 1)) === "\\") {
			newstr = strs[(pos - 1)].slice(0, (strs[(pos - 1)].length - 1)) + strs[pos] + strs[(pos + 1)];
			head = strs.slice(0, (pos - 1));
			tail = strs.slice((pos + 2));
			head.push(newstr);
			strs = head.concat(tail);
		}
	}
	expected_closers = [];
	expected_openers = [];
	expected_flips = [];
	tagstack = [];
	badTagStack = [];
	lenA = strs.length - 1;
	for (posA = 1; posA < lenA; posA += 2) {
		tag = strs[posA];
		if (this.closeTagsHash[tag]) {
			expected_closers.reverse();
			sameAsOpen = this.openToCloseHash[tag];
			openRev = expected_closers.indexOf(tag);
			flipRev = expected_flips.indexOf(tag);
			expected_closers.reverse();
			if (!sameAsOpen || (openRev > -1 && (openRev < flipRev || flipRev === -1))) {
				ibeenrunned = false;
				lenB = expected_closers.length - 1;
				for (posB = lenB; posB > -1; posB += -1) {
					ibeenrunned = true;
					wanted_closer = expected_closers[posB];
					if (tag === wanted_closer) {
						expected_closers.pop();
						expected_openers.pop();
						expected_flips.pop();
						tagstack.pop();
						break;
					}
					badTagStack.push(posA);
				}
				if (!ibeenrunned) {
					badTagStack.push(posA);
				}
				continue;
			}
		}
		if (this.openToCloseHash[tag]) {
			expected_closers.push(this.openToCloseHash[tag]);
			expected_openers.push(tag);
			expected_flips.push(this.flipTagsHash[tag]);
			tagstack.push(posA);
		}
	}
	lenC = expected_closers.length - 1;
	for (posC = lenC; posC > -1; posC += -1) {
		expected_closers.pop();
		expected_flips.pop();
		expected_openers.pop();
		badTagStack.push(tagstack.pop());
	}
	badTagStack.sort(
		function (a, b) {
			if (a < b) {
				return 1;
			} else if (a > b) {
				return -1;
			}
			return 0;
		}
	);
	len = badTagStack.length;
	for (pos = 0; pos < len; pos += 1) {
		badTagPos = badTagStack[pos];
		head = strs.slice(0, (badTagPos - 1));
		tail = strs.slice((badTagPos + 2));
		sep = strs[badTagPos];
		if (sep.length && sep[0] !== "<" && this.openToDecorations[sep]) {
			params = this.openToDecorations[sep];
			sep = this.state.fun.decorate[params[0]][params[1][0]](this.state);
		}
		resplice = strs[(badTagPos - 1)] + sep + strs[(badTagPos + 1)];
		head.push(resplice);
		strs = head.concat(tail);
	}
	len = strs.length;
	for (pos = 0; pos < len; pos += 2) {
		strs[pos] = strs[pos].replace("'", "\u02bc");
		strs[pos] = CSL.Output.Formats[this.state.opt.mode].text_escape(strs[pos]);
	}
	return strs;
};
CSL.Util.FlipFlopper.prototype.processTags = function () {
	var expected_closers, expected_openers, expected_flips, expected_rendering, str, posA, tag, prestr, newblob, blob, sameAsOpen, openRev, flipRev, posB, wanted_closer, newblobnest, param, fulldecor, level, decor, lenA, lenB, posC, lenC;
	expected_closers = [];
	expected_openers = [];
	expected_flips = [];
	expected_rendering = [];
	str = "";
	if (this.strs.length === 1) {
		this.blob.blobs = this.strs[0];
	} else if (this.strs.length > 2) {
		lenA = (this.strs.length - 1);
		for (posA = 1; posA < lenA; posA += 2) {
			tag = this.strs[posA];
			prestr = this.strs[(posA - 1)];
			if (prestr) {
				newblob = new CSL.Blob(false, prestr);
				blob = this.blobstack.value();
				blob.push(newblob);
			}
			if (this.closeTagsHash[tag]) {
				expected_closers.reverse();
				sameAsOpen = this.openToCloseHash[tag];
				openRev = expected_closers.indexOf(tag);
				flipRev = expected_flips.indexOf(tag);
				expected_closers.reverse();
				if (!sameAsOpen || (openRev > -1 && (openRev < flipRev || flipRev === -1))) {
					lenB = expected_closers.length;
					for (posB = lenB; posB > -1; posB += -1) {
						wanted_closer = expected_closers[posB];
						if (tag === wanted_closer) {
							expected_closers.pop();
							expected_openers.pop();
							expected_flips.pop();
							expected_rendering.pop();
							this.blobstack.pop();
							break;
						}
					}
					continue;
				}
			}
			if (this.openToCloseHash[tag]) {
				expected_closers.push(this.openToCloseHash[tag]);
				expected_openers.push(tag);
				expected_flips.push(this.flipTagsHash[tag]);
				blob = this.blobstack.value();
				newblobnest = new CSL.Blob();
				blob.push(newblobnest);
				param = this.addFlipFlop(newblobnest, this.openToDecorations[tag]);
				if (tag === "<span class=\"nodecor\">") {
					fulldecor = this.state[this.state.tmp.area].opt.topdecor.concat(this.blob.alldecor).concat([[["@quotes", "inner"]]]);
					lenB = fulldecor.length;
					for (posB = 0; posB < lenB; posB += 1) {
						level = fulldecor[posB];
						lenC = level.length;
						for (posC = 0; posC < lenC; posC += 1) {
							decor = level[posC];
							if (["@font-style", "@font-weight", "@font-variant"].indexOf(decor[0]) > -1) {
								param = this.addFlipFlop(newblobnest, this.okReverseHash[decor[0]]);
							}
						}
					}
				}
				expected_rendering.push(this.state.fun.decorate[param[0]][param[1]](this.state));
				this.blobstack.push(newblobnest);
			}
		}
		if (this.strs.length > 2) {
			str = this.strs[(this.strs.length - 1)];
			if (str) {
				blob = this.blobstack.value();
				newblob = new CSL.Blob(false, str);
				blob.push(newblob);
			}
		}
	}
	return this.blob;
};
CSL.Util.FlipFlopper.prototype.addFlipFlop = function (blob, fun) {
	var posA, posB, fulldecor, lenA, decorations, breakme, decor, posC, newdecor, lenC;
	posB = 0;
	fulldecor = this.state[this.state.tmp.area].opt.topdecor.concat(blob.alldecor).concat([[["@quotes", "inner"]]]);
	lenA = fulldecor.length;
	for (posA = 0; posA < lenA; posA += 1) {
		decorations = fulldecor[posA];
		breakme = false;
		lenC = decorations.length - 1;
		for (posC = lenC; posC > -1; posC += -1) {
			decor = decorations[posC];
			if (decor[0] === fun[0]) {
				if (decor[1] === fun[1][0]) {
					posB = 1;
				}
				breakme = true;
				break;
			}
		}
		if (breakme) {
			break;
		}
	}
	newdecor = [fun[0], fun[1][posB]];
	blob.decorations.reverse();
	blob.decorations.push(newdecor);
	blob.decorations.reverse();
	return newdecor;
};
CSL.Output.Formatters = {};
CSL.Output.Formatters.strip_periods = function (state, string) {
    return string.replace(/\./g, " ").replace(/\s*$/g, "").replace(/\s+/g, " ");
};
CSL.Output.Formatters.passthrough = function (state, string) {
	return string;
};
CSL.Output.Formatters.lowercase = function (state, string) {
	var str = CSL.Output.Formatters.doppelString(string, CSL.TAG_USEALL);
	str.string = str.string.toLowerCase();
	return CSL.Output.Formatters.undoppelString(str);
};
CSL.Output.Formatters.uppercase = function (state, string) {
	var str = CSL.Output.Formatters.doppelString(string, CSL.TAG_USEALL);
	str.string = str.string.toUpperCase();
	return CSL.Output.Formatters.undoppelString(str);
};
CSL.Output.Formatters["capitalize-first"] = function (state, string) {
	var str = CSL.Output.Formatters.doppelString(string, CSL.TAG_ESCAPE);
	if (str.string.length) {
		str.string = str.string.slice(0, 1).toUpperCase() + str.string.substr(1);
		return CSL.Output.Formatters.undoppelString(str);
	} else {
		return "";
	}
};
CSL.Output.Formatters.sentence = function (state, string) {
	var str = CSL.Output.Formatters.doppelString(string, CSL.TAG_ESCAPE);
	str.string = str.string.slice(0, 1).toUpperCase() + str.string.substr(1).toLowerCase();
	return CSL.Output.Formatters.undoppelString(str);
};
CSL.Output.Formatters["capitalize-all"] = function (state, string) {
	var str, strings, len, pos;
	str = CSL.Output.Formatters.doppelString(string, CSL.TAG_ESCAPE);
	strings = str.string.split(" ");
	len = strings.length;
	for (pos = 0; pos < len; pos += 1) {
		if (strings[pos].length > 1) {
            strings[pos] = strings[pos].slice(0, 1).toUpperCase() + strings[pos].substr(1).toLowerCase();
        } else if (strings[pos].length === 1) {
            strings[pos] = strings[pos].toUpperCase();
        }
    }
	str.string = strings.join(" ");
	return CSL.Output.Formatters.undoppelString(str);
};
CSL.Output.Formatters.title = function (state, string) {
	var str, words, isUpperCase, newString, lastWordIndex, previousWordIndex, upperCaseVariant, lowerCaseVariant, pos, skip, notfirst, notlast, firstword, aftercolon, len, idx, tmp, skipword, ppos, mx, lst, myret;
	str = CSL.Output.Formatters.doppelString(string, CSL.TAG_ESCAPE);
	if (!string) {
		return "";
	}
	mx = str.string.match(/(\s+)/g);
	lst = str.string.split(/\s+/);
	myret = [lst[0]];
	for (pos = 1, len = lst.length; pos < len; pos += 1) {
		myret.push(mx[pos - 1]);
		myret.push(lst[pos]);
	}
	words = myret.slice();
	isUpperCase = str.string.toUpperCase() === string;
	newString = "";
	lastWordIndex = words.length - 1;
	previousWordIndex = -1;
	for (pos = 0; pos <= lastWordIndex;  pos += 2) {
		if (words[pos].length !== 0 && (words[pos].length !== 1 || !/\s+/.test(words[pos]))) {
			upperCaseVariant = words[pos].toUpperCase();
			lowerCaseVariant = words[pos].toLowerCase();
			if (isUpperCase || words[pos] === lowerCaseVariant) {
				skip = false;
				len = CSL.SKIP_WORDS.length;
				for (ppos = 0; ppos < len; ppos += 1) {
					skipword = CSL.SKIP_WORDS[ppos];
					idx = lowerCaseVariant.indexOf(skipword);
					if (idx > -1) {
						tmp = lowerCaseVariant.slice(0, idx, idx + lowerCaseVariant.slice(skipword.length));
						if (!tmp.match(/[a-zA-Z]/)) {
							skip = true;
						}
					}
				}
				notfirst = pos !== 0;
				notlast = pos !== lastWordIndex;
				if (words[previousWordIndex]) {
					aftercolon = words[previousWordIndex].slice(-1) !== ":";
				} else {
					aftercolon = false;
				}
				if (skip && notfirst && notlast && (firstword || aftercolon)) {
					words[pos] = lowerCaseVariant;
				} else {
					words[pos] = upperCaseVariant.slice(0, 1) + lowerCaseVariant.substr(1);
				}
			}
			previousWordIndex = pos;
		}
	}
	str.string = words.join("");
	return CSL.Output.Formatters.undoppelString(str);
};
CSL.Output.Formatters.doppelString = function (string, rex) {
	var ret, pos, len;
	ret = {};
	ret.array = rex(string);
	ret.string = "";
	len = ret.array.length;
	for (pos = 0; pos < len; pos += 2) {
		ret.string += ret.array[pos];
	}
	return ret;
};
CSL.Output.Formatters.undoppelString = function (str) {
	var ret, len, pos;
	ret = "";
	len = str.array.length;
	for (pos = 0; pos < len; pos += 1) {
		if ((pos % 2)) {
			ret += str.array[pos];
		} else {
			ret += str.string.slice(0, str.array[pos].length);
			str.string = str.string.slice(str.array[pos].length);
		}
	}
	return ret;
};
CSL.Output.Formatters.serializeItemAsRdf = function (Item) {
	return "";
};
CSL.Output.Formatters.serializeItemAsRdfA = function (Item) {
	return "";
};
CSL.Output.Formats = function () {};
CSL.Output.Formats.prototype.html = {
	"text_escape": function (text) {
		return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace("  ", "&nbsp; ", "g");
	},
	"bibstart": "<div class=\"csl-bib-body\">\n",
	"bibend": "</div>",
	"@font-style/italic": "<i>%%STRING%%</i>",
	"@font-style/oblique": "<em>%%STRING%%</em>",
	"@font-style/normal": "<span style=\"font-style:normal;\">%%STRING%%</span>",
	"@font-variant/small-caps": "<span style=\"font-variant:small-caps;\">%%STRING%%</span>",
	"@passthrough/true": CSL.Output.Formatters.passthrough,
	"@font-variant/normal": "<span style=\"font-variant:normal;\">%%STRING%%</span>",
	"@font-weight/bold": "<b>%%STRING%%</b>",
	"@font-weight/normal": "<span style=\"font-weight:normal;\">%%STRING%%</span>",
	"@font-weight/light": false,
	"@text-decoration/none": "<span style=\"text-decoration:none;\">%%STRING%%</span>",
	"@text-decoration/underline": "<span style=\"text-decoration:underline;\">%%STRING%%</span>",
	"@vertical-align/sup": "<sup>%%STRING%%</sup>",
	"@vertical-align/sub": "<sub>%%STRING%%</sub>",
	"@vertical-align/baseline": "<span style=\"baseline\">%%STRING%%</span>",
	"@strip-periods/true": CSL.Output.Formatters.strip_periods,
	"@strip-periods/false": function (state, string) {
		return string;
	},
	"@quotes/true": function (state, str) {
		if ("undefined" === typeof str) {
			return state.getTerm("open-quote");
		}
		return state.getTerm("open-quote") + str + state.getTerm("close-quote");
	},
	"@quotes/inner": function (state, str) {
		if ("undefined" === typeof str) {
			return "\u2019";
		}
		return state.getTerm("open-inner-quote") + str + state.getTerm("close-inner-quote");
	},
	"@quotes/false": false,
	"@bibliography/entry": function (state, str) {
		return "  <div class=\"csl-entry\">" + str + "</div>\n";
	},
	"@display/block": function (state, str) {
		return "\n\n    <div class=\"csl-block\">" + str + "</div>\n";
	},
	"@display/left-margin": function (state, str) {
		return "\n    <div class=\"csl-left-margin\">" + str + "</div>";
	},
	"@display/right-inline": function (state, str) {
		return "<div class=\"csl-right-inline\">" + str + "</div>\n  ";
	},
	"@display/indent": function (state, str) {
		return "<div class=\"csl-indent\">" + str + "</div>\n  ";
	}
};
CSL.Output.Formats.prototype.text = {
	"text_escape": function (text) {
		return text;
	},
	"bibstart": "",
	"bibend": "",
	"@font-style/italic": false,
	"@font-style/oblique": false,
	"@font-style/normal": false,
	"@font-variant/small-caps": false,
	"@passthrough/true": CSL.Output.Formatters.passthrough,
	"@font-variant/normal": false,
	"@font-weight/bold": false,
	"@font-weight/normal": false,
	"@font-weight/light": false,
	"@text-decoration/none": false,
	"@text-decoration/underline": false,
	"@vertical-align/baseline": false,
	"@vertical-align/sup": false,
	"@vertical-align/sub": false,
	"@strip-periods/true": CSL.Output.Formatters.strip_periods,
	"@strip-periods/false": function (state, string) {
		return string;
	},
	"@quotes/true": function (state, str) {
		if ("undefined" === typeof str) {
			return state.getTerm("open-quote");
		}
		return state.getTerm("open-quote") + str + state.getTerm("close-quote");
	},
	"@quotes/inner": function (state, str) {
		if ("undefined" === typeof str) {
			return "\u2019";
		}
		return state.getTerm("open-inner-quote") + str + state.getTerm("close-inner-quote");
	},
	"@quotes/false": false,
	"@bibliography/entry": function (state, str) {
		return str+"\n";
	},
	"@display/block": function (state, str) {
		return "\n"+str;
	},
	"@display/left-margin": function (state, str) {
		return str;
	},
	"@display/right-inline": function (state, str) {
		return str;
	},
	"@display/indent": function (state, str) {
		return "\n    "+str;
	}
};
CSL.Output.Formats.prototype.rtf = {
	"text_escape": function (text) {
		return text.replace(/([\\{}])/g, "\\$1", "g").replace(/[\x7F-\uFFFF]/g,
			function(aChar) { return "\\uc0\\u"+aChar.charCodeAt(0).toString()+"{}" })
			.replace("\t", "\\tab{}", "g");
	},
	"@passthrough/true": CSL.Output.Formatters.passthrough,
	"@strip-periods/true": CSL.Output.Formatters.strip_periods,
	"@font-style/italic":"\\i %%STRING%%\\i0{}",
	"@font-style/normal":false,
	"@font-style/oblique":"\\i %%STRING%%\\i0{}",
	"@font-variant/small-caps":"\\scaps %%STRING%%\\scaps0{}",
	"@font-variant/normal":false,
	"@font-weight/bold":"\\b %%STRING%%\\b0{}",
	"@font-weight/normal":false,
	"@font-weight/light":false,
	"@text-decoration/none":false,
	"@text-decoration/underline":"\\ul %%STRING%%\\ul0{}",
	"@vertical-align/baseline":false,
	"@vertical-align/sup":"\\super %%STRING%%\\nosupersub{}",
	"@vertical-align/sub":"\\sub %%STRING%%\\nosupersub{}",
	"@strip-periods/true": CSL.Output.Formatters.strip_periods,
	"@strip-periods/false": function (state, string) {
		return string;
	},
	"@quotes/true": function (state, str) {
		if ("undefined" === typeof str) {
			return CSL.Output.Formats.rtf.text_escape(state.getTerm("open-quote"));
		}
		return CSL.Output.Formats.rtf.text_escape(state.getTerm("open-quote")) + str + CSL.Output.Formats.rtf.text_escape(state.getTerm("close-quote"));
	},
	"@quotes/inner": function (state, str) {
		if ("undefined" === typeof str) {
			return CSL.Output.Formats.rtf.text_escape("\u2019");
		}
		return CSL.Output.Formats.rtf.text_escape(state.getTerm("open-inner-quote")) + str + CSL.Output.Formats.rtf.text_escape(state.getTerm("close-inner-quote"));
	},
	"@quotes/false": false,
	"bibstart":"{\\rtf ",
	"bibend":"}",
	"@display/block":"%%STRING%%\\line\r\n",
	"@bibliography/entry": function(state,str){
		return str;
	},
	"@display/left-margin": function(state,str){
		return str+"\\tab ";
	},
	"@display/right-inline": function (state, str) {
		return str+"\n";
	},
	"@display/indent": function (state, str) {
		return "\n\\tab "+str;
	}
};
CSL.Output.Formats = new CSL.Output.Formats();
CSL.Registry = function (state) {
	var pos, len, ret;
	this.debug = false;
	this.state = state;
	this.registry = {};
	this.reflist = [];
	this.namereg = new CSL.Registry.NameReg(state);
	this.citationreg = new CSL.Registry.CitationReg(state);
	this.mylist = [];
	this.myhash = {};
	this.deletes = [];
	this.inserts = [];
	this.uncited = [];
	this.refreshes = {};
	this.akeys = {};
	this.oldseq = {};
	this.return_data = {};
	this.ambigcites = {};
	this.sorter = new CSL.Registry.Comparifier(state, "bibliography_sort");
	this.getSortedIds = function () {
		ret = [];
		for (i = 0, ilen = this.reflist.length; i < ilen; i += 1) {
			ret.push("" + this.reflist[i].id);
		}
		return ret;
	};
	this.getSortedRegistryItems = function () {
		ret = [];
		for (i = 0, ilen = this.reflist.length; i < ilen; i += 1) {
			ret.push(this.reflist[i]);
		}
		return ret;
	};
};
CSL.Registry.prototype.init = function (myitems, uncited_flag) {
	var len, pos;
	this.oldseq = {};
	if (uncited_flag && this.mylist && this.mylist.length) {
		this.uncited = myitems;
		for (pos = 0, len = myitems.length; pos < len; pos += 1) {
			if (!this.myhash[myitems[pos]]) {
				this.mylist.push(myitems[pos]);
			}
		}
	} else {
		this.mylist = myitems;
	}
	this.myhash = {};
	len = myitems.length;
	for (pos = 0; pos < len; pos += 1) {
		this.myhash[myitems[pos]] = true;
	}
	this.refreshes = {};
	this.touched = {};
};
CSL.Registry.prototype.dodeletes = function (myhash) {
	var otheritems, key, ambig, pos, len, items, kkey, mypos, id;
	if ("string" === typeof myhash) {
		myhash = {myhash: true};
	}
	for (key in this.registry) {
		if (this.registry.hasOwnProperty(key) && !myhash[key]) {
			if (this.registry[key].uncited) {
				continue;
			}
			otheritems = this.namereg.delitems(key);
			for (kkey in otheritems) {
				if (otheritems.hasOwnProperty(kkey)) {
					this.refreshes[kkey] = true;
				}
			}
			ambig = this.registry[key].ambig;
			mypos = this.ambigcites[ambig].indexOf(key);
			if (mypos > -1) {
				items = this.ambigcites[ambig].slice();
				this.ambigcites[ambig] = items.slice(0, mypos).concat(items.slice([(mypos + 1)], items.length));
			}
			len = this.ambigcites[ambig].length;
			for (pos = 0; pos < len; pos += 1) {
				id = "" + this.ambigcites[ambig][pos];
				this.refreshes[id] = true;
			}
			delete this.registry[key];
			this.return_data.bibchange = true;
		}
	}
};
CSL.Registry.prototype.doinserts = function (mylist) {
	var len, pos, item, Item, akey, newitem, abase;
	if ("string" === typeof mylist) {
		mylist = [mylist];
	}
	len = mylist.length;
	for (pos = 0; pos < len; pos += 1) {
		item = mylist[pos];
		if (!this.registry[item]) {
			Item = this.state.retrieveItem(item);
			akey = CSL.getAmbiguousCite.call(this.state, Item);
			this.akeys[akey] = true;
			newitem = {
				"id": "" + item,
				"seq": 0,
				"offset": 0,
				"sortkeys": false,
				"ambig": false,
				"rendered": false,
				"disambig": false,
				"ref": Item
			};
			this.registry[item] = newitem;
			abase = CSL.getAmbigConfig.call(this.state);
			this.registerAmbigToken(akey, item, abase);
			this.touched[item] = true;
			this.return_data.bibchange = true;
		}
	}
};
CSL.Registry.prototype.douncited = function () {
	var pos, len;
	for (pos = 0, len = this.mylist.length; pos < len; pos += 1) {
		this.registry[this.mylist[pos]].uncited = false;
	}
	for (pos = 0, len = this.uncited.length; pos < len; pos += 1) {
		this.registry[this.mylist[pos]].uncited = true;
	}
};
CSL.Registry.prototype.rebuildlist = function () {
	var count, len, pos, item;
	this.reflist = [];
	len = this.mylist.length;
	for (pos = 0; pos < len; pos += 1) {
		item = this.mylist[pos];
		this.reflist.push(this.registry[item]);
		this.oldseq[item] = this.registry[item].seq;
		this.registry[item].seq = (pos + 1);
	}
};
CSL.Registry.prototype.dorefreshes = function () {
	var key, regtoken, Item, old_akey, akey, abase;
	for (key in this.refreshes) {
		if (this.refreshes.hasOwnProperty(key)) {
			regtoken = this.registry[key];
			delete this.registry[key];
			if (!regtoken) {
				continue;
			}
			regtoken.disambig = undefined;
			regtoken.sortkeys = undefined;
			regtoken.ambig = undefined;
			Item = this.state.retrieveItem(key);
			if ("undefined" === typeof akey) {
				akey = CSL.getAmbiguousCite.call(this.state, Item);
				this.state.tmp.taintedItemIDs[key] = true;
			}
			this.registry[key] = regtoken;
			abase = CSL.getAmbigConfig.call(this.state);
			this.registerAmbigToken(akey, key, abase);
			this.akeys[akey] = true;
			this.touched[key] = true;
		}
	}
};
CSL.Registry.prototype.setdisambigs = function () {
	var akey, leftovers, key, pos, len, id;
	this.leftovers = [];
	for (akey in this.akeys) {
		if (this.akeys.hasOwnProperty(akey)) {
			this.state.disambiguate.run(akey);
		}
	}
	this.akeys = {};
};
CSL.Registry.prototype.renumber = function () {
	var len, pos, item;
	len = this.reflist.length;
	for (pos = 0; pos < len; pos += 1) {
		item = this.reflist[pos];
		item.seq = (pos + 1);
		if (this.state.tmp.taintedItemIDs && item.seq != this.oldseq[item.id]) {
			if (this.state.opt.update_mode === CSL.NUMERIC) {
				this.state.tmp.taintedItemIDs[item.id] = true;
			}
			if (this.state.opt.bib_mode === CSL.NUMERIC) {
				this.return_data.bibchange = true;
			}
		}
	}
};
CSL.Registry.prototype.setsortkeys = function () {
	var key;
	for (key in this.touched) {
		if (this.touched.hasOwnProperty(key)) {
			this.registry[key].sortkeys = CSL.getSortKeys.call(this.state, this.state.retrieveItem(key), "bibliography_sort");
		}
	}
};
CSL.Registry.prototype.sorttokens = function () {
	this.reflist.sort(this.sorter.compareKeys);
};
CSL.Registry.Comparifier = function (state, keyset) {
	var sort_directions, len, pos, compareKeys;
	sort_directions = state[keyset].opt.sort_directions;
    this.compareKeys = function (a, b) {
		len = a.sortkeys.length;
		for (pos = 0; pos < len; pos += 1) {
			var cmp = 0;
			if (a.sortkeys[pos] === b.sortkeys[pos]) {
				cmp = 0;
			} else if ("undefined" === typeof a.sortkeys[pos]) {
				cmp = sort_directions[pos][1];
			} else if ("undefined" === typeof b.sortkeys[pos]) {
				cmp = sort_directions[pos][0];
			} else {
				cmp = a.sortkeys[pos].toLocaleLowerCase().localeCompare(b.sortkeys[pos].toLocaleLowerCase());
			}
			if (0 < cmp) {
				return sort_directions[pos][1];
			} else if (0 > cmp) {
				return sort_directions[pos][0];
			}
		}
		if (a.seq > b.seq) {
			return 1;
		} else if (a.seq < b.seq) {
			return -1;
		}
		return 0;
	};
	compareKeys = this.compareKeys;
	this.compareCompositeKeys = function (a, b) {
		return compareKeys(a[1], b[1]);
	};
};
CSL.Registry.prototype.compareRegistryTokens = function (a, b) {
	if (a.seq > b.seq) {
		return 1;
	} else if (a.seq < b.seq) {
		return -1;
	}
	return 0;
};
CSL.Registry.prototype.registerAmbigToken = function (akey, id, ambig_config, tainters) {
	if (!this.ambigcites[akey]) {
		this.ambigcites[akey] = [];
	}
	if (this.ambigcites[akey].indexOf("" + id) === -1) {
		this.ambigcites[akey].push("" + id);
	}
	this.registry[id].ambig = akey;
	var dome = false;
	if (tainters) {
		this.registry[id].disambig = CSL.cloneAmbigConfig.call(this.state, ambig_config, this.registry[id].disambig, tainters);
	} else {
		this.registry[id].disambig = CSL.cloneAmbigConfig(ambig_config);
	}
};
CSL.getSortKeys = function (Item, key_type) {
	var area, strip_prepositions, use_parallels, len, pos;
	area = this.tmp.area;
	strip_prepositions = CSL.Util.Sort.strip_prepositions;
	this.tmp.area = key_type;
	this.tmp.disambig_override = true;
	this.tmp.disambig_request = false;
	use_parallels = this.parallel.use_parallels;
	this.parallel.use_parallels = false;
	this.tmp.suppress_decorations = true;
	CSL.getCite.call(this, Item);
	this.tmp.suppress_decorations = false;
	this.parallel.use_parallels = use_parallels;
	this.tmp.disambig_override = false;
	len = this[key_type].keys.length;
	for (pos = 0; pos < len; pos += 1) {
		this[key_type].keys[pos] = strip_prepositions(this[key_type].keys[pos]);
	}
	this.tmp.area = area;
	return this[key_type].keys;
};
CSL.Registry.NameReg = function (state) {
	var pkey, ikey, skey, floor, ceiling, dagopt, gdropt, ret, pos, items, strip_periods, set_keys, evalname, delitems, addname, key, myitems;
	this.state = state;
	this.namereg = {};
	this.nameind = {};
	this.nameindpkeys = {};
	this.itemkeyreg = {};
	strip_periods = function (str) {
		if (!str) {
			str = "";
		}
		return str.replace(".", " ", "g").replace(/\s+/g, " ").replace(/\s+$/,"");
	};
	set_keys = function (state, itemid, nameobj) {
		pkey = strip_periods(nameobj.family);
		skey = strip_periods(nameobj.given);
		var m = skey.match(/,\!* [^,]$/);
		if (m && m[1] === m[1].toLowerCase()) {
			skey = skey.replace(/,\!* [^,]$/, "");
		}
		ikey = CSL.Util.Names.initializeWith(state, skey, "%s");
		if (state.opt["givenname-disambiguation-rule"] === "by-cite") {
			pkey = "" + itemid + pkey;
		}
	};
	evalname = function (item_id, nameobj, namenum, request_base, form, initials) {
		var pos, len, items, param;
		var nameobj = state.transform.name(state, nameobj, state.opt["locale-pri"]);
		set_keys(this.state, "" + item_id, nameobj);
		if ("undefined" === typeof this.namereg[pkey] || "undefined" === typeof this.namereg[pkey].ikey[ikey]) {
			return request_base;
		}
		param = 2;
		dagopt = state.opt["disambiguate-add-givenname"];
		gdropt = state.opt["givenname-disambiguation-rule"];
		if (gdropt === "by-cite") {
			gdropt = "all-names";
		}
		if ("short" === form) {
			param = 0;
		} else if ("string" === typeof initials) {
			param = 1;
		}
		if (param < request_base) {
			param = request_base;
		}
		if (!dagopt) {
			return param;
		}
		if ("string" === typeof gdropt && gdropt.slice(0, 12) === "primary-name" && namenum > 0) {
			return param;
		}
		if (!gdropt || gdropt === "all-names" || gdropt === "primary-name") {
			if (this.namereg[pkey].count > 1) {
				param = 1;
			}
			if (this.namereg[pkey].ikey && this.namereg[pkey].ikey[ikey].count > 1) {
			    param = 2;
			}
		} else if (gdropt === "all-names-with-initials" || gdropt === "primary-name-with-initials") {
			if (this.namereg[pkey].count > 1) {
				param = 1;
			}
		}
		if (param === 0) {
			pos = this.namereg[pkey].ikey[ikey].items.indexOf("" + item_id);
			items = this.namereg[pkey].ikey[ikey].items;
			if (pos > -1) {
				items = items.slice(0, pos).concat(items.slice(pos + 1));
			}
			for (pos = 0, len = items.length; pos < len; pos += 1) {
				this.state.tmp.taintedItemIDs[items[pos]] = true;
			}
			pos = this.namereg[pkey].ikey[ikey].skey[skey].items.indexOf("" + item_id);
			items = this.namereg[pkey].ikey[ikey].skey[skey].items;
			if (pos > -1) {
				items = items.slice(0, pos).concat(items.slice(pos + 1));
			}
			for (pos = 0, len = items.length; pos < len; pos += 1) {
				this.state.tmp.taintedItemIDs[items[pos]] = true;
			}
			if (this.namereg[pkey].items.indexOf("" + item_id) === -1) {
				this.namereg[pkey].items.push("" + item_id);
			}
		} else if (param === 1) {
			pos = this.namereg[pkey].items.indexOf("" + item_id);
			items = this.namereg[pkey].items;
			if (pos > -1) {
				items = items.slice(0, pos).concat(items.slice(pos + 1));
			}
			for (pos = 0, len = items.length; pos < len; pos += 1) {
				this.state.tmp.taintedItemIDs[items[pos]] = true;
			}
			pos = this.namereg[pkey].ikey[ikey].skey[skey].items.indexOf("" + item_id);
			items = this.namereg[pkey].ikey[ikey].skey[skey].items;
			if (pos > -1) {
				items = items.slice(0, pos).concat(items.slice(pos + 1));
			}
			for (pos = 0, len = items.length; pos < len; pos += 1) {
				this.state.tmp.taintedItemIDs[items[pos]] = true;
			}
			if (this.namereg[pkey].ikey[ikey].items.indexOf("" + item_id) === -1) {
				this.namereg[pkey].ikey[ikey].items.push("" + item_id);
			}
		} else if (param === 2) {
			pos = this.namereg[pkey].items.indexOf("" + item_id);
			items = this.namereg[pkey].items;
			if (pos > -1) {
				items = items.slice(0, pos).concat(items.slice(pos + 1));
			}
			for (pos = 0, len = items.length; pos < len; pos += 1) {
				this.state.tmp.taintedItemIDs[items[pos]] = true;
			}
			pos = this.namereg[pkey].ikey[ikey].items.indexOf("" + item_id);
			items = this.namereg[pkey].ikey[ikey].items;
			if (pos > -1) {
				items = items.slice(0, pos).concat(items.slice(pos + 1));
			}
			for (pos = 0, len = items.length; pos < len; pos += 1) {
				this.state.tmp.taintedItemIDs[items[pos]] = true;
			}
			if (this.namereg[pkey].ikey[ikey].skey[skey].items.indexOf("" + item_id) === -1) {
				this.namereg[pkey].ikey[ikey].skey[skey].items.push("" + item_id);
			}
		}
		return param;
	};
	delitems = function (ids) {
		var i, item, pos, len, posA, posB, id, fullkey, llen, ppos, otherid;
		if ("string" === typeof ids || "number" === typeof ids) {
			ids = ["" + ids];
		}
		ret = {};
		len = ids.length;
		for (pos = 0; pos < len; pos += 1) {
			id = "" + ids[pos];
			if (!this.nameind[id]) {
				continue;
			}
			for (fullkey in this.nameind[id]) {
				if (this.nameind[id].hasOwnProperty(fullkey)) {
					key = fullkey.split("::");
					pkey = key[0];
					ikey = key[1];
					skey = key[2];
					if ("undefined" === typeof this.namereg[pkey]) {
						continue;
					}
					posA = this.namereg[pkey].items.indexOf(posA);
					items = this.namereg[pkey].items;
					if (skey) {
						myitems = this.namereg[pkey].ikey[ikey].skey[skey].items;
						posB = myitems.indexOf("" + id);
						if (posB > -1) {
							this.namereg[pkey].ikey[ikey].skey[skey].items = myitems.slice(0, posB).concat(myitems.slice([(posB + 1)]));
						}
						if (this.namereg[pkey].ikey[ikey].skey[skey].items.length === 1) {
							this.namereg[pkey].ikey[ikey].items.push(this.namereg[pkey].ikey[ikey].skey[skey].items[0]);
							this.namereg[pkey].ikey[ikey].skey[skey].items = [];
						}
						for (ppos = 0, llen = this.namereg[pkey].ikey[ikey].skey[skey].items.length; ppos < llen; ppos += 1) {
							ret[this.namereg[pkey].ikey[ikey].items[ppos]] = true;
						}
					}
					if (ikey) {
						posB = this.namereg[pkey].ikey[ikey].items.indexOf("" + id);
						if (posB > -1) {
							items = this.namereg[pkey].ikey[ikey].items.slice();
							this.namereg[pkey].ikey[ikey].items = items.slice(0, posB).concat(items.slice([posB + 1]));
						}
						if (this.namereg[pkey].ikey[ikey].items.length === 1) {
							this.namereg[pkey].items.push(this.namereg[pkey].ikey[ikey].items[0]);
							this.namereg[pkey].ikey[ikey].items = [];
						}
						for (ppos = 0, llen = this.namereg[pkey].ikey[ikey].items.length; ppos < llen; ppos += 1) {
							ret[this.namereg[pkey].ikey[ikey].items[ppos]] = true;
						}
					}
					if (pkey) {
						posB = this.namereg[pkey].items.indexOf("" + id);
						if (posB > -1) {
							items = this.namereg[pkey].items.slice();
							this.namereg[pkey].items = items.slice(0, posB).concat(items.slice([posB + 1], items.length));
						}
						for (ppos = 0, llen = this.namereg[pkey].items.length; ppos < llen; ppos += 1) {
							ret[this.namereg[pkey].items[ppos]] = true;
						}
						if (this.namereg[pkey].items.length < 2) {
							delete this.namereg[pkey];
						}
					}
					delete this.nameind[id][fullkey];
				}
			}
			delete this.nameind[id];
			delete this.nameindpkeys[id];
		}
		return ret;
	};
	addname = function (item_id, nameobj, pos) {
		var nameobj = state.transform.name(state, nameobj, state.opt["locale-pri"]);
		set_keys(this.state, "" + item_id, nameobj);
		if (pkey) {
			if ("undefined" === typeof this.namereg[pkey]) {
				this.namereg[pkey] = {};
				this.namereg[pkey].count = 0;
				this.namereg[pkey].ikey = {};
				this.namereg[pkey].items = [];
			}
		}
		if (pkey && ikey) {
			if ("undefined" === typeof this.namereg[pkey].ikey[ikey]) {
				this.namereg[pkey].ikey[ikey] = {};
				this.namereg[pkey].ikey[ikey].count = 0;
				this.namereg[pkey].ikey[ikey].skey = {};
				this.namereg[pkey].ikey[ikey].items = [];
				this.namereg[pkey].count += 1;
			}
		}
		if (pkey && ikey && skey) {
			if ("undefined" === typeof this.namereg[pkey].ikey[ikey].skey[skey]) {
				this.namereg[pkey].ikey[ikey].skey[skey] = {};
				this.namereg[pkey].ikey[ikey].skey[skey].items = [];
				this.namereg[pkey].ikey[ikey].count += 1;
			}
		}
		if ("undefined" === typeof this.nameind[item_id]) {
			this.nameind[item_id] = {};
			this.nameindpkeys[item_id] = {};
		}
		if (pkey) {
			this.nameind[item_id][pkey + "::" + ikey + "::" + skey] = true;
			this.nameindpkeys[item_id][pkey] = this.namereg[pkey];
		}
	};
	this.addname = addname;
	this.delitems = delitems;
	this.evalname = evalname;
};
CSL.Disambiguation = function (state) {
	this.state = state;
	this.sys = this.state.sys;
	this.registry = state.registry.registry;
	this.ambigcites = state.registry.ambigcites;
	this.configModes();
	this.clashes = [1, 0];
};
CSL.Disambiguation.prototype.run = function(akey) {
	if (!this.modes.length) {
		return;
	}
	this.initVars(akey);
	this.runDisambig();
};
CSL.Disambiguation.prototype.runDisambig = function () {
	var pos, len, ppos, llen, pppos, lllen, ismax;
	for (pos = 0; pos < this.lists.length; pos += 1) {
		this.nnameset = 0;
		this.gnameset = 0;
		this.gname = 0;
		while(this.lists[pos][1].length) {
			this.listpos = pos;
			if (!this.base) {
				this.base = this.lists[pos][0];
			}
			if (this.rerun) {
				this.rerun = false;
			} else {
				this.scanItems(this.lists[pos], 0);
			}
			ismax = this.incrementDisambig();
			this.scanItems(this.lists[pos], 1);
			this.evalScan(ismax);
		}
	}
};
CSL.Disambiguation.prototype.scanItems = function (list, phase) {
	var pos, len, Item, otherItem, ItemCite, otherItemCite, ignore, base;
	Item = list[1][0];
	this.scanlist = list[1];
	this.partners = [];
    var tempResult = this.getItemDesc(Item);
    this.base = tempResult[0];
    this.maxvals = tempResult[1];
    this.minval = tempResult[2];
    ItemCite = tempResult[3];
	this.partners.push(Item);
	this.clashes[phase] = 0;
	this.nonpartners = [];
	for (pos = 1, len = list[1].length; pos < len; pos += 1) {
		otherItem = list[1][pos];
		otherItemData = this.getItemDesc(otherItem);
		otherItemCite = otherItemData[3];
		otherItemBase = otherItemData[0];
		if (ItemCite === otherItemCite) {
			this.clashes[phase] += 1;
			this.partners.push(otherItem);
		} else {
			this.nonpartners.push(otherItem);
		}
	}
};
CSL.Disambiguation.prototype.evalScan = function (ismax) {
	this[this.modes[this.modeindex]](ismax);
};
CSL.Disambiguation.prototype.disNames = function (ismax) {
	var pos, len;
	if (this.clashes[1] === 0) {
		mybase = CSL.cloneAmbigConfig(this.base);
		mybase.year_suffix = false;
		this.state.registry.registerAmbigToken(this.akey, "" + this.partners[0].id, mybase);
		if (this.nonpartners.length === 1) {
			this.state.registry.registerAmbigToken(this.akey, "" + this.nonpartners[0].id, this.base);
			this.lists[this.listpos] = [this.base,[]];
		} else {
			this.lists[this.listpos] = [this.base, this.nonpartners];
		}
	} else if (this.clashes[1] < this.clashes[0]) {
		this.lists[this.listpos] = [this.base, this.partners];
		if (this.nonpartners.length === 1) {
			this.state.registry.registerAmbigToken(this.akey, "" + this.nonpartners[0].id, this.base);
		} else {
			this.lists.push([this.base, this.nonpartners]);
		}
	} else {
		if (ismax || this.advance_mode) {
			for (pos = 0, len = this.partners.length; pos < len; pos += 1) {
				this.state.registry.registerAmbigToken(this.akey, "" + this.partners[pos].id, this.base);
			}
			if (ismax) {
				this.lists[this.listpos] = [this.base, this.nonpartners];
			}
		} else {
			this.rerun = true;
		}
	}
};
CSL.Disambiguation.prototype.disGivens = function (ismax) {
	var pos, len;
	if (this.clashes[1] === 0) {
		if (this.clashes[0] === 1) {
			this.base = this.decrementNames();
		}
		mybase = CSL.cloneAmbigConfig(this.base);
		mybase.year_suffix = false;
		this.state.registry.registerAmbigToken(this.akey, "" + this.partners[0].id, mybase);
		if (this.nonpartners.length === 1) {
			this.state.registry.registerAmbigToken(this.akey, "" + this.nonpartners[0].id, this.base);
			this.lists[this.listpos] = [this.base,[]];
		} else {
			this.lists[this.listpos] = [this.base, this.nonpartners];
		}
	} else if (this.clashes[1] < this.clashes[0]) {
		this.lists[this.listpos] = [this.base, this.partners];
		if (this.nonpartners.length === 1) {
			this.state.registry.registerAmbigToken(this.akey, "" + this.nonpartners[0].id, this.base);
		} else {
			this.lists.push([this.base, this.nonpartners]);
		}
	} else {
		this.base = CSL.cloneAmbigConfig(this.oldbase);
		if (ismax || this.advance_mode) {
			for (pos = 0, len = this.partners.length; pos < len; pos += 1) {
				this.state.registry.registerAmbigToken(this.akey, "" + this.partners[pos].id, this.base);
			}
			if (ismax) {
				this.lists[this.listpos] = [this.base, this.nonpartners];
			}
		} else {
			this.rerun = true;
		}
	}
};
CSL.Disambiguation.prototype.disExtraText = function () {
	var pos, len;
	if (this.clashes[1] === 0) {
		mybase = CSL.cloneAmbigConfig(this.base);
		mybase.year_suffix = false;
		this.state.registry.registerAmbigToken(this.akey, "" + this.partners[0].id, mybase);
		if (this.nonpartners.length === 1) {
			this.state.registry.registerAmbigToken(this.akey, "" + this.nonpartners[0].id, this.base);
			this.lists[this.listpos] = [this.base,[]];
		} else {
			this.lists[this.listpos] = [this.base, this.nonpartners];
		}
	} else {
		this.base.disambiguate = false;
		this.lists[this.listpos] = [this.base, this.lists[this.listpos][1].slice(1)];
	}
};
CSL.Disambiguation.prototype.disYears = function () {
	var pos, len, tokens, token, item;
	tokens = [];
	for (pos = 0, len = this.lists[this.listpos][1].length; pos < len; pos += 1) {
		token = this.registry[this.lists[this.listpos][1][pos].id];
		tokens.push(token);
	}
	tokens.sort(this.state.registry.sorter.compareKeys);
	for (pos = 0, len = tokens.length; pos < len; pos += 1) {
		if (pos === 0) {
			this.state.registry.registerAmbigToken(this.akey, "" + tokens[pos].id, this.base, this.scanlist);
		} else {
			this.state.registry.registerAmbigToken(this.akey, "" + tokens[pos].id, this.base);
		}
		tokens[pos].disambig.year_suffix = ""+pos;
	}
	this.lists[this.listpos] = [this.base, []];
};
CSL.Disambiguation.prototype.incrementDisambig = function () {
	var val, maxed;
	maxed = false;
	this.oldbase = CSL.cloneAmbigConfig(this.base);
	if (this.advance_mode) {
		this.modeindex += 1;
		this.advance_mode = false;
	}
	if (!maxed && "disNames" === this.modes[this.modeindex]) {
		if (this.base.names[this.nnameset] < this.maxvals[this.nnameset]) {
			this.base.names[this.nnameset] += 1;
		} else {
			if (this.nnameset < (this.base.names.length - 1)) {
				this.nnameset += 1;
			}
			if (this.base.names[this.nnameset] < this.maxvals[this.nnameset]) {
				this.base.names[this.nnameset] += 1;
			}
		}
		if (this.nnameset === (this.base.names.length - 1) && this.base.names[this.nnameset] === this.maxvals[this.nnameset]) {
			if (this.modeindex === (this.modes.length - 1)) {
				return true;
			} else {
				maxed = false;
			}
		}
	}
	if (!maxed && "disGivens" === this.modes[this.modeindex]) {
		if (this.gname < this.maxvals[this.gnameset]) {
			if (this.base.givens[this.gnameset][this.gname] === this.minval) {
				this.base.givens[this.gnameset][this.gname] += 1;
			}
			this.base.givens[this.gnameset][this.gname] += 1;
			this.gname += 1;
		} else {
			if (this.gnameset < (this.base.givens.length - 1)) {
				this.gnameset += 1;
				this.gname = 0;
			}
			if (this.gname < this.maxvals[this.gnameset]) {
				this.base.givens[this.gnameset][this.gname] += 1;
				this.gname += 1;
			}
		}
	}
	if (!maxed && "disExtraText" === this.modes[this.modeindex]) {
		maxed = false;
		this.base.disambiguate = true;
		if (this.modeindex === (this.modes.length - 1)) {
			return true;
		} else {
			maxed = false;
		}
	}
	if (!maxed && "disYears" === this.modes[this.modeindex]) {
		maxed = false;
	}
	if (this.modes[this.modeindex] === "disGivens") {
		if ((this.gnameset === (this.base.names.length - 1) && this.gname === this.maxvals[this.gnameset]) || this.base.names.length === 0) {
			if (this.modeindex === (this.modes.length - 1)) {
				maxed = true;
			} else {
				this.advance_mode = true;
			}
		}
	}
	if (this.modes[this.modeindex] === "disNames") {
		if ((this.nnameset === (this.base.names.length - 1) && this.base.names[this.nnameset] === this.maxvals[this.nnameset]) || this.base.names.length === 0) {
			if (this.modeindex === (this.modes.length - 1)) {
				maxed = true;
			} else {
				this.advance_mode = true;
			}
		}
	}
	return maxed;
};
CSL.Disambiguation.prototype.getItemDesc = function (Item, forceMax) {
	var str, maxvals, minval, base;
	str = CSL.getAmbiguousCite.call(this.state, Item, this.base);
	maxvals = CSL.getMaxVals.call(this.state);
	minval = CSL.getMinVal.call(this.state);
	base = CSL.getAmbigConfig.call(this.state);
	return [base, maxvals, minval, str];
};
CSL.Disambiguation.prototype.initVars = function (akey) {
	var pos, len;
	var myIds, myItemBundles, myItems;
	this.lists = [];
	this.base = false;
	this.akey = akey;
	myItemBundles = [];
	myIds = this.ambigcites[akey];
	if (myIds && myIds.length > 1) {
		for (var i = 0, ilen = myIds.length; i < ilen; i += 1) {
			var myItem = this.state.retrieveItem("" + myIds[i]);
			myItemBundles.push([this.getItemDesc(myItem), myItem]);
		}
		myItemBundles.sort(
 			function (a, b) {
   				if (a[0][1] > b[0][1]) {
					return 1;
				} else if (a[0][1] < b[0][1]) {
					return -1;
				} else {
					if (a[1].id > b[1].id) {
						return 1;
					} else if (a[1].id < b[1].id) {
						return -1;
					} else {
						return 0;
					}
				}
			}
 		);
		var myItems = [];
		for (var i = 0, ilen = myItemBundles.length; i < ilen; i += 1) {
			myItems.push(myItemBundles[i][1]);
		}
		this.lists.push([this.base, myItems]);
	}
	this.modeindex = 0;
};
CSL.Disambiguation.prototype.configModes = function () {
	var dagopt, gdropt;
	this.modes = [];
	if (this.state.opt["disambiguate-add-names"]) {
		this.modes.push("disNames");
	}
	dagopt = this.state.opt["disambiguate-add-givenname"];
	gdropt = this.state.opt["givenname-disambiguation-rule"];
	if (dagopt && gdropt === "by-cite") {
		this.modes.push("disGivens");
	}
	if (this.state.opt.has_disambiguate) {
		this.modes.push("disExtraText");
	}
	if (this.state.opt["disambiguate-add-year-suffix"]) {
		this.modes.push("disYears");
	}
};
CSL.Disambiguation.prototype.decrementNames = function () {
	var base_return, do_me, i, j, pos, len, ppos, llen, ids;
	base_return = CSL.cloneAmbigConfig(this.base);
	do_me = false;
	len = base_return.givens.length - 1;
	for (pos = len; pos > -1; pos += -1) {
		llen = base_return.givens[pos].length - 1;
		for (ppos = llen; ppos > -1; ppos += -1) {
			if (base_return.givens[pos][ppos] > this.oldbase.givens[pos][ppos]) {
				do_me = true;
			}
		}
	}
	if (do_me) {
		len = base_return.givens.length - 1;
		for (pos = len; pos > -1; pos += -1) {
			llen = base_return.givens[pos].length - 1;
			for (ppos = llen; ppos > -1; ppos += -1) {
				if (base_return.givens[pos][ppos] > this.oldbase.givens[pos][ppos]) {
					break;
				}
				if (ppos < base_return.names[pos]) {
					base_return.names[pos] += -1;
				}
			}
		}
	}
	return base_return;
};
CSL.Registry.CitationReg = function (state) {
	this.citationById = {};
	this.citationByIndex = [];
};
