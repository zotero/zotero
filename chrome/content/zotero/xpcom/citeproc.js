/*
Copyright (c) 2009-2019 Frank Bennett

	This program is free software: you can redistribute it and/or
	modify it under EITHER

      * the terms of the Common Public Attribution License (CPAL) as
	    published by the Open Source Initiative, either version 1 of
	    the CPAL, or (at your option) any later version; OR

      * the terms of the GNU Affero General Public License (AGPL)
        as published by the Free Software Foundation, either version
        3 of the AGPL, or (at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
	Affero General Public License for more details.

	You should have received copies of the Common Public Attribution
    License and of the GNU Affero General Public License along with
    this program.  If not, see <https://opensource.org/licenses/> or
    <http://www.gnu.org/licenses/> respectively.
*/
/*global CSL: true */

/**
 * A Javascript implementation of the CSL citation formatting language.
 *
 * <p>A configured instance of the process is built in two stages,
 * using {@link CSL.Core.Build} and {@link CSL.Core.Configure}.
 * The former sets up hash-accessible locale data and imports the CSL format file
 * to be applied to the citations,
 * transforming it into a one-dimensional token list, and
 * registering functions and parameters on each token as appropriate.
 * The latter sets jump-point information
 * on tokens that constitute potential branch
 * points, in a single back-to-front scan of the token list.
 * This
 * yields a token list that can be executed front-to-back by
 * body methods available on the
 * {@link CSL.Engine} class.</p>
 *
 * <p>This top-level {@link CSL} object itself carries
 * constants that are needed during processing.</p>
 * @namespace A CSL citation formatter.
 */

// IE6 does not implement Array.indexOf().
// IE7 neither, according to rumour.


// Potential skip words:
// under; along; out; between; among; outside; inside; amid; amidst; against; toward; towards.
// See https://forums.zotero.org/discussion/30484/?Focus=159613#Comment_159613

'use strict';


var CSL = {

    PROCESSOR_VERSION: "1.2.17",

    error: function(str) { // default error function
        if ("undefined" === typeof Error) {
            throw new Error("citeproc-js error: " + str);
        } else {
            throw "citeproc-js error: " + str;
        }
    },
    debug: function(str) { // default debug function
        if ("undefined" === typeof console) {
            dump("CSL: " + str + "\n");
        } else {
            console.log("citeproc-js warning: " + str);
        }
    },

    LOCATOR_LABELS_REGEXP: new RegExp("^((art|ch|subch|col|fig|l|n|no|op|p|pp|para|subpara|supp|pt|r|sec|subsec|sv|sch|tit|vrs|vol)\\.)\\s+(.*)"),

    STATUTE_SUBDIV_PLAIN_REGEX: /(?:(?:^| )(?:art|bk|ch|subch|col|fig|fol|l|n|no|op|p|pp|para|subpara|supp|pt|r|sec|subsec|sv|sch|tit|vrs|vol)\. *)/,
    STATUTE_SUBDIV_PLAIN_REGEX_FRONT: /(?:^\s*[.,;]*\s*(?:art|bk|ch|subch|col|fig|fol|l|n|no|op|p|pp|para|subpara|supp|pt|r|sec|subsec|sv|sch|tit|vrs|vol)\. *)/,
    STATUTE_SUBDIV_STRINGS: {
        "art.": "article",
        "bk.": "book",
        "ch.": "chapter",
        "subch.": "subchapter",
        "p.": "page",
        "pp.": "page",
        "para.": "paragraph",
        "subpara.": "subparagraph",
        "pt.": "part",
        "r.": "rule",
        "sec.": "section",
        "subsec.": "subsection",
        "supp.": "supplement",
        "sch.": "schedule",
        "tit.": "title",
        "col.": "column",
        "fig.": "figure",
        "fol.": "folio",
        "l.": "line",
        "n.": "note",
        "no.": "issue",
        "op.": "opus",
        "sv.": "sub-verbo",
        "vrs.": "verse",
        "vol.": "volume"
    },
    STATUTE_SUBDIV_STRINGS_REVERSE: {
        "article": "art.",
        "book": "bk.",
        "chapter": "ch.",
        "subchapter": "subch.",
        "page": "p.",
        "paragraph": "para.",
        "subparagraph": "subpara.",
        "part": "pt.",
        "rule": "r.",
        "section": "sec.",
        "subsection": "subsec.",
        "supplement": "supp.",
        "schedule": "sch.",
        "title": "tit.",
        "column": "col.",
        "figure": "fig.",
        "folio": "fol.",
        "line": "l.",
        "note": "n.",
        "issue": "no.",
        "opus": "op.",
        "sub-verbo": "sv.",
        "sub verbo": "sv.",
        "verse": "vrs.",
        "volume": "vol."
    },

    LOCATOR_LABELS_MAP: {
        "art": "article",
        "bk": "book",
        "ch": "chapter",
        "subch": "subchapter",
        "col": "column",
        "fig": "figure",
        "fol": "folio",
        "l": "line",
        "n": "note",
        "no": "issue",
        "op": "opus",
        "p": "page",
        "pp": "page",
        "para": "paragraph",
        "subpara": "subparagraph",
        "pt": "part",
        "r": "rule",
		"sec": "section",
		"subsec": "subsection",
		"supp": "supplement",
		"sv": "sub-verbo",
        "sch": "schedule",
        "tit": "title",
        "vrs": "verse",
        "vol": "volume"
    },
    MODULE_MACROS: {
        "juris-pretitle": true,
        "juris-title": true,
        "juris-pretitle-short": true,
        "juris-title-short": true,
        "juris-main": true,
        "juris-main-short": true,
        "juris-tail": true,
        "juris-tail-short": true,
        "juris-locator": true
    },
    MODULE_TYPES: {
        "legal_case": true,
        "legislation": true,
        "bill": true,
        "hearing": true,
        "gazette": true,
        "report": true,
        "regulation": true,
        "standard": true,
        "patent": true
    },
    checkNestedBrace: function(state) {
        if (state.opt.xclass === "note") {
            this.depth = 0;
            this.update = function(str) {
                
                // Receives affix string, returns with flipped parens.
                
                var str = str ? str : "";
                var lst = str.split(/([\(\)])/);
                for (var i=1,ilen=lst.length;i<ilen;i += 2) {
                    if (lst[i] === "(") {
                        if (1 === (this.depth % 2)) {
                            lst[i] = "[";
                        }
                        this.depth += 1;
                    } else if (lst[i] === ")") {
                        if (0 === (this.depth % 2)) {
                            lst[i] = "]";
                        }
                        this.depth -= 1;
                    }
                }
                var ret = lst.join("");
                return ret;
            };
        } else {
            this.update = function(str) {
                return str;
            };
        }
    },

    MULTI_FIELDS: ["event", "publisher", "publisher-place", "event-place", "title", "container-title", "collection-title", "authority","genre","title-short","medium","country","jurisdiction","archive","archive-place"],

    LangPrefsMap: {
        "title":"titles",
        "title-short":"titles",
        "event":"titles",
        "genre":"titles",
        "medium":"titles",
        "container-title":"journals",
        "collection-title":"titles",
        "archive":"journals",
        "publisher":"publishers",
        "authority":"publishers",
        "publisher-place": "places",
        "event-place": "places",
        "archive-place": "places",
        "jurisdiction": "places",
        "number": "places",
        "edition":"places",
        "issue":"places",
        "volume":"places"
    },

    AbbreviationSegments: function () {
        this["container-title"] = {};
        this["collection-title"] = {};
        this["institution-entire"] = {};
        this["institution-part"] = {};
        this.nickname = {};
        this.number = {};
        this.title = {};
        this.place = {};
        this.hereinafter = {};
        this.classic = {};
        this["container-phrase"] = {};
        this["title-phrase"] = {};
    },

    FIELD_CATEGORY_REMAP: {
        "title": "title",
        "container-title": "container-title",
        "collection-title": "collection-title",
        "country": "place",
        "number": "number",
        "place": "place",
        "archive": "collection-title",
        "title-short": "title",
        "genre": "title",
        "event": "title",
        "medium": "title",
		"archive-place": "place",
		"publisher-place": "place",
		"event-place": "place",
		"jurisdiction": "place",
		"language-name": "place",
		"language-name-original": "place",
        "call-number": "number",
        "chapter-number": "number",
        "collection-number": "number",
        "edition": "number",
        "page": "number",
        "issue": "number",
        "locator": "number",
        "locator-extra": "number",
        "number-of-pages": "number",
        "number-of-volumes": "number",
        "volume": "number",
        "citation-number": "number",
        "publisher": "institution-part"
    },
    
    parseLocator: function(item) {
        if (this.opt.development_extensions.locator_date_and_revision) {
            // Break out locator elements if necessary
            if (item.locator) {
                item.locator = "" + item.locator;
                var idx = item.locator.indexOf("|");
                if (idx > -1) {
                    var raw_locator = item.locator;
                    item.locator = raw_locator.slice(0, idx);
                    raw_locator = raw_locator.slice(idx + 1);
                    var m = raw_locator.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2}).*/);
                    if (m) {
                        item["locator-date"] = this.fun.dateparser.parseDateToObject(m[1]);
                        raw_locator = raw_locator.slice(m[1].length);
                    }
                    item["locator-extra"] = raw_locator.replace(/^\s+/, "").replace(/\s+$/, "");
                }
            }
        }
        if (item.locator) {
            item.locator = ("" + item.locator).replace(/\s+$/, '');
        }
        return item;
    },

    normalizeLocaleStr: function(str) {
        if (!str) {
            return;
        }
        var lst = str.split('-');
        lst[0] = lst[0].toLowerCase();
        if (lst[1]) {
            lst[1] = lst[1].toUpperCase();
        }
        return lst.join("-");
    },

    parseNoteFieldHacks: function(Item, validFieldsForType, allowDateOverride) {
        if ("string" !== typeof Item.note) {
            return;
        }
        var elems = [];
        var lines = Item.note.split('\n');
        // Normalize entries
        for (var i=0, ilen=lines.length; i<ilen; i++) {
            var line = lines[i];
            var elems = [];
            var m = line.match(CSL.NOTE_FIELDS_REGEXP);
            if (m) {
                var splt = line.split(CSL.NOTE_FIELDS_REGEXP);
                for (var j=0,jlen=(splt.length-1);j<jlen;j++) {
                    elems.push(splt[j]);
                    elems.push(m[j]);
                }
                elems.push(splt[splt.length-1]);
                for (var j=1,jlen=elems.length;j<jlen;j += 2) {
                    // Abort conversions if preceded by unparseable text
                    if (elems[j-1].trim() && (i>0 || j>1) && !elems[j-1].match(CSL.NOTE_FIELD_REGEXP)) {
                        break;
                    } else {
                        elems[j] = '\n' + elems[j].slice(2,-1).trim() + '\n';
                    }
                }
                lines[i] = elems.join('');
            }
        }
        // Resplit
        lines = lines.join('\n').split('\n');
        var offset = 0;
        var names = {};
        for (var i=0,ilen=lines.length;i<ilen;i++) {
            var line = lines[i];
            var mm = line.match(CSL.NOTE_FIELD_REGEXP);
            if (!line.trim()) {
                continue;
            } else if (!mm) {
                if (i === 0) {
                    continue;
                } else {
                    offset = i;
                    break;
                }
            }
            var key = mm[1];
            var val = mm[2].replace(/^\s+/, "").replace(/\s+$/, "");
            if (key === "type") {
                Item.type = val;
                lines[i] = "";
            } else if (CSL.DATE_VARIABLES.indexOf(key.replace(/^alt-/, "")) > -1) {
                if (!Item[key] || allowDateOverride) {
                    Item[key] = CSL.DateParser.parseDateToArray(val);
                    if (!validFieldsForType || (validFieldsForType[key] && this.isDateString(val))) {
                        lines[i] = "";
                    }
                }
            } else if (!Item[key]) {
                if (CSL.NAME_VARIABLES.indexOf(key.replace(/^alt-/, "")) > -1) {
                    if (!names[key]) {
                        names[key] = [];
                    }
                    var lst = val.split(/\s*\|\|\s*/);
                    if (lst.length === 1) {
                        names[key].push({literal:lst[0]});
                    } else if (lst.length === 2) {
                        var name = {family:lst[0],given:lst[1]};
                        CSL.parseParticles(name);
                        names[key].push(name);
                    }
                } else {
                    Item[key] = val;
                }
                if (!validFieldsForType || validFieldsForType[key]) {
                    lines[i] = "";
                }
            }
        }
        for (var key in names) {
            Item[key] = names[key];
        }
        // Final cleanup for validCslFields only: eliminate blank lines, add blank line to text
        if (validFieldsForType) {
            if (lines[offset].trim()) {
                lines[offset] = '\n' + lines[offset];
            }
            for (var i=offset-1;i>-1;i--) {
                if (!lines[i].trim()) {
                    lines = lines.slice(0, i).concat(lines.slice(i + 1));
                }
            }
        }
        Item.note = lines.join("\n").trim();
    },

    checkPrefixSpaceAppend: function (state, prefix) {
        if (!prefix) {
            prefix = "";
        }
        var sp = "";
        // We need the raw string, without decorations
        // of any kind. Markup scheme is known, though, so
        // markup can be safely stripped at string level.
        //
        // U+201d = right double quotation mark
        // U+2019 = right single quotation mark
        // U+00bb = right double angle bracket (guillemet)
        // U+202f = non-breaking thin space
        // U+00a0 = non-breaking space
        var test_prefix = prefix.replace(/<[^>]+>/g, "").replace(/["'\u201d\u2019\u00bb\u202f\u00a0 ]+$/g,"");
        var test_char = test_prefix.slice(-1);
        if (test_prefix.match(CSL.ENDSWITH_ROMANESQUE_REGEXP)) {
            sp = " ";
        } else if (CSL.TERMINAL_PUNCTUATION.slice(0,-1).indexOf(test_char) > -1) {
            sp = " ";
        } else if (test_char.match(/[\)\],0-9]/)) {
            sp = " ";
        }
        // Protect against double spaces, which would trigger an extra,
        // explicit, non-breaking space.
        var prefix = (prefix + sp).replace(/\s+/g, " ");
        return prefix;
    },

    checkIgnorePredecessor: function(state, prefix) {
        var ignorePredecessor = false;
        var test_prefix = prefix.replace(/<[^>]+>/g, "").replace(/["'\u201d\u2019\u00bb\u202f\u00a0 ]+$/g,"");
        var test_char = test_prefix.slice(-1);
        if (CSL.TERMINAL_PUNCTUATION.slice(0,-1).indexOf(test_char) > -1 && prefix.trim().indexOf(" ") > -1) {
            state.tmp.term_predecessor = false;
            return true;
        }
        return false;
    },

    checkSuffixSpacePrepend: function(state, suffix) {
        if (!suffix) {
            return "";
        }
        if (suffix.match(CSL.STARTSWITH_ROMANESQUE_REGEXP) || ['[','('].indexOf(suffix.slice(0,1)) > -1) {
            suffix = " " + suffix;
        }
        return suffix;
    },
    
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

    PRIMARY: 1,
    SECONDARY: 2,
    
    POSITION_FIRST: 0,
    POSITION_SUBSEQUENT: 1,
    POSITION_IBID: 2,
    POSITION_IBID_WITH_LOCATOR: 3,

    POSITION_TEST_VARS: ["position", "first-reference-note-number", "near-note"],

    AREAS: ["citation", "citation_sort", "bibliography", "bibliography_sort", "intext"],

    CITE_FIELDS: ["first-reference-note-number", "locator", "locator-extra"],

    SWAPPING_PUNCTUATION: [".", "!", "?", ":", ","],
    TERMINAL_PUNCTUATION: [":", ".", ";", "!", "?", " "],

    // update modes
    NONE: 0,
    NUMERIC: 1,
    POSITION: 2,
    TRIGRAPH: 3,

    DATE_PARTS: ["year", "month", "day"],
    DATE_PARTS_ALL: ["year", "month", "day", "season"],
    DATE_PARTS_INTERNAL: ["year", "month", "day", "year_end", "month_end", "day_end"],

    NAME_PARTS: ["non-dropping-particle", "family", "given", "dropping-particle", "suffix", "literal"],

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
        "initialize",
        "name-as-sort-order",
        "sort-separator",
        "et-al-min",
        "et-al-use-first",
        "et-al-subsequent-min",
        "et-al-subsequent-use-first",
        "form",
        "prefix",
        "suffix",
        "delimiter"
    ],

    PARALLEL_MATCH_VARS: ["container-title"],
    PARALLEL_TYPES: ["bill","gazette","regulation","legislation","legal_case","treaty","article-magazine","article-journal"],
    PARALLEL_COLLAPSING_MID_VARSET: ["volume", "issue", "container-title", "section", "collection-number"],

    LOOSE: 0,
    STRICT: 1,
    TOLERANT: 2,

    PREFIX_PUNCTUATION: /[.;:]\s*$/,
    SUFFIX_PUNCTUATION: /^\s*[.;:,\(\)]/,

    NUMBER_REGEXP: /(?:^\d+|\d+$)/,
    //
    // \u0400-\u042f are cyrillic and extended cyrillic capitals
    // this is not fully smart yet.  can't do what this was trying to do
    // with regexps, actually; we want to identify strings with a leading
    // capital letter, and any subsequent capital letters.  Have to compare
    // locale caps version with existing version, character by character.
    // hard stuff, but if it breaks, that's what to do.
    // \u0600-\u06ff is Arabic/Persian
    // \u200c-\u200e and \u202a-\u202e are special spaces and left-right 
    // control characters



    NAME_INITIAL_REGEXP: /^([A-Z\u0e01-\u0e5b\u00c0-\u017f\u0400-\u042f\u0590-\u05d4\u05d6-\u05ff\u0600-\u06ff\u0370\u0372\u0376\u0386\u0388-\u03ab\u03e2\u03e4\u03e6\u03e8\u03ea\u03ec\u03ee\u03f4\u03f7\u03fd-\u03ff])([a-zA-Z\u0e01-\u0e5b\u00c0-\u017f\u0400-\u052f\u0600-\u06ff\u0370-\u03ff\u1f00-\u1fff]*|)(\.)*/,
    ROMANESQUE_REGEXP: /[-0-9a-zA-Z\u0e01-\u0e5b\u00c0-\u017f\u0370-\u03ff\u0400-\u052f\u0590-\u05d4\u05d6-\u05ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]/,
    ROMANESQUE_NOT_REGEXP: /[^a-zA-Z\u0e01-\u0e5b\u00c0-\u017f\u0370-\u03ff\u0400-\u052f\u0590-\u05d4\u05d6-\u05ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]/g,
    STARTSWITH_ROMANESQUE_REGEXP: /^[&a-zA-Z\u0e01-\u0e5b\u00c0-\u017f\u0370-\u03ff\u0400-\u052f\u0590-\u05d4\u05d6-\u05ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]/,
    ENDSWITH_ROMANESQUE_REGEXP: /[.;:&a-zA-Z\u0e01-\u0e5b\u00c0-\u017f\u0370-\u03ff\u0400-\u052f\u0590-\u05d4\u05d6-\u05ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]$/,
    ALL_ROMANESQUE_REGEXP: /^[a-zA-Z\u0e01-\u0e5b\u00c0-\u017f\u0370-\u03ff\u0400-\u052f\u0590-\u05d4\u05d6-\u05ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]+$/,

    VIETNAMESE_SPECIALS: /[\u00c0-\u00c3\u00c8-\u00ca\u00cc\u00cd\u00d2-\u00d5\u00d9\u00da\u00dd\u00e0-\u00e3\u00e8-\u00ea\u00ec\u00ed\u00f2-\u00f5\u00f9\u00fa\u00fd\u0101\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]/,

    VIETNAMESE_NAMES: /^(?:(?:[.AaBbCcDdEeGgHhIiKkLlMmNnOoPpQqRrSsTtUuVvXxYy \u00c0-\u00c3\u00c8-\u00ca\u00cc\u00cd\u00d2-\u00d5\u00d9\u00da\u00dd\u00e0-\u00e3\u00e8-\u00ea\u00ec\u00ed\u00f2-\u00f5\u00f9\u00fa\u00fd\u0101\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]{2,6})(\s+|$))+$/,

    NOTE_FIELDS_REGEXP: /\{:(?:[\-_a-z]+|[A-Z]+):[^\}]+\}/g,
    NOTE_FIELD_REGEXP: /^([\-_a-z]+|[A-Z]+):\s*([^\}]+)$/,

	PARTICLE_GIVEN_REGEXP: /^([^ ]+(?:\u02bb |\u2019 | |\' ) *)(.+)$/,
	PARTICLE_FAMILY_REGEXP: /^([^ ]+(?:\-|\u02bb|\u2019| |\') *)(.+)$/,

    DISPLAY_CLASSES: ["block", "left-margin", "right-inline", "indent"],

    NAME_VARIABLES: [
        "author",
        "collection-editor",
        "composer",
        "container-author",
        "director",
        "editor",
        "editorial-director",
        "illustrator",
        "interviewer",
        "original-author",
        "recipient",
        "reviewed-author",
        "translator"
    ],
    CREATORS: [
        "author",
        "collection-editor",
        "composer",
        "container-author",
        "director",
        "editor",
        "editorial-director",
        "illustrator",
        "interviewer",
        "original-author",
        "recipient",
        "reviewed-author",
        "translator"
    ],
    NUMERIC_VARIABLES: [
        "call-number",
        "chapter-number",
        "collection-number",
        "division",
        "edition",
        "page",
        "issue",
        "locator",
        "locator-extra",
        "number",
        "number-of-pages",
        "number-of-volumes",
        "volume",
        // "section", ??? add this?
        "supplement",
        "citation-number"
    ],
    //var x = new Array();
    //x = x.concat(["title","container-title","issued","page"]);
    //x = x.concat(["locator","collection-number","original-date"]);
    //x = x.concat(["reporting-date","decision-date","filing-date"]);
    //x = x.concat(["revision-date"]);
    //NUMERIC_VARIABLES = x.slice();
    DATE_VARIABLES: [
        "locator-date", 
        "issued", 
        "event-date", 
        "accessed", 
        "original-date",
        "publication-date",
        "available-date",
        "submitted",
        "alt-issued",
        "alt-event"
    ],
    VARIABLES_WITH_SHORT_FORM: [
        "title",
        "container-title"
    ],
    TITLE_FIELD_SPLITS: function(seg) {
        var keys = ["title", "short", "main", "sub", "subjoin"];
        var ret = {};
        for (var i=0,ilen=keys.length;i<ilen;i++) {
            ret[keys[i]] = seg + "title" + (keys[i] === "title" ? "" : "-" + keys[i]);
        }
        return ret;
    },
    
    demoteNoiseWords: function (state, fld, drop_or_demote) {
        var SKIP_WORDS = state.locale[state.opt.lang].opts["leading-noise-words"];
        if (fld && drop_or_demote) {
            fld = fld.split(/\s+/);
            fld.reverse();
            var toEnd = [];
            for (var j  = fld.length - 1; j > -1; j += -1) {
                if (SKIP_WORDS.indexOf(fld[j].toLowerCase()) > -1) {
                    toEnd.push(fld.pop());
                } else {
                    break;
                }
            }
            fld.reverse();
            var start = fld.join(" ");
            var end = toEnd.join(" ");
            if ("drop" === drop_or_demote || !end) {
                fld = start;
            } else if ("demote" === drop_or_demote) {
                fld = [start, end].join(", ");
            }
        }
        return fld;
    },

    extractTitleAndSubtitle: function (Item, narrowSpaceLocale) {
        var narrowSpace = narrowSpaceLocale ? "\u202f" : "";
        // XXX In this function, split on split-char, but prefer exact match
        // XXX of subtitle to a split-char in title if found.
        var segments = ["", "container-"];
        for (var i=0,ilen=segments.length;i<ilen;i++) {
            var seg = segments[i];
            var title = CSL.TITLE_FIELD_SPLITS(seg);
            var langs = [false];
            if (Item.multi) {
                for (var lang in Item.multi._keys[title.short]) {
                    langs.push(lang);
                }
            }
            for (var j=0,jlen=langs.length;j<jlen;j++) {
                var lang = langs[j];
                var vals = {};
                if (lang) {
                    if (Item.multi._keys[title.title]) {
                        vals[title.title] = Item.multi._keys[title.title][lang];
                    }
                    if (Item.multi._keys[title["short"]]) {
                        vals[title["short"]] = Item.multi._keys[title["short"]][lang];
                    }
                } else {
                    vals[title.title] = Item[title.title];
                    vals[title["short"]] = Item[title["short"]];
                }
                vals[title.main] = vals[title.title];
                vals[title.sub] = false;
                var shortTitle = vals[title["short"]];
                if (vals[title.title]) {
                    // Rules
                    // TITLE_SPLIT eliminates split-points of period-space preceded by a capital letter.
                    // If short title exists and matches exactly to a split-point, use that split-point only.
                    // Otherwise if there is just one split-point, use that as main/sub split.
                    // Otherwise use all split-points ... which is handled in titleCaseSentenceOrNormal, not here.
                    if (shortTitle && shortTitle.toLowerCase() === vals[title.title].toLowerCase()) {
                        vals[title.main] = vals[title.title];
                        vals[title.subjoin] = "";
                        vals[title.sub] = "";
                    } else if (shortTitle) {
                        // check for valid match to shortTitle
                        var tail = vals[title.title].slice(shortTitle.replace(/[\?\!]+$/, "").length);
                        var top = vals[title.title].replace(tail.replace(/^[\?\!]+/, ""), "").trim();
                        var m = CSL.TITLE_SPLIT_REGEXP.matchfirst.exec(tail);
                        if (m && top.toLowerCase() === shortTitle.toLowerCase()) {
                            vals[title.main] = top;
                            vals[title.subjoin] = m[1].replace(/[\?\!]+(\s*)$/, "$1");
                            vals[title.sub] = tail.replace(CSL.TITLE_SPLIT_REGEXP.matchfirst, "");
                            if (this.opt.development_extensions.force_short_title_casing_alignment) {
                                vals[title["short"]] = vals[title.main];
                            }
                        } else {
                            var splitTitle = CSL.TITLE_SPLIT(vals[title.title]);
                            if (splitTitle.length == 3) {
                                vals[title.main] = splitTitle[0];
                                vals[title.subjoin] = splitTitle[1];
                                vals[title.sub] = splitTitle[2];
                            } else {
                                vals[title.main] = vals[title.title];
                                vals[title.subjoin] = "";
                                vals[title.sub] = "";
                            }
                        }
                    } else {
                        var splitTitle = CSL.TITLE_SPLIT(vals[title.title]);
                        if (splitTitle.length == 3) {
                            vals[title.main] = splitTitle[0];
                            vals[title.subjoin] = splitTitle[1];
                            vals[title.sub] = splitTitle[2];
                        } else {
                            vals[title.main] = vals[title.title];
                            vals[title.subjoin] = "";
                            vals[title.sub] = "";
                        }
                    }
                    if (vals[title.subjoin]) {
                        if (vals[title.subjoin].match(/([\?\!])/)) {
                            var m = vals[title.subjoin].match(/(\s*)$/)
                            vals[title.main] = vals[title.main] + narrowSpace +vals[title.subjoin].trim();
                            vals[title.subjoin] = m[1];
                        }
                    }
                }
                if (vals[title.subjoin]) {
                    if (vals[title.subjoin].indexOf(":") > -1) {
                        vals[title.subjoin] = narrowSpace + ": ";
                    }
                    if (vals[title.subjoin].indexOf("-") > -1 || vals[title.subjoin].indexOf("—") > -1) {
                        vals[title.subjoin] = "—";
                    }
                }
                if (lang) {
                    for (var key in vals) {
                        if (!Item.multi._keys[key]) {
                            Item.multi._keys[key] = {};
                        }
                        Item.multi._keys[key][lang] = vals[key];
                    }
                } else {
                    for (var key in vals) {
                        Item[key] = vals[key];
                    }
                }
            }
        }
    },

    titlecaseSentenceOrNormal: function(state, Item, seg, lang, sentenceCase) {
        // Hold on here.
        // What is seg here?
        // It's ... either "" or "container-". Which is ugly, but works.
        // But this ALWAYS returns the full title, never short.
        // So sentence-casing cannot be applied to short.
        // Goes unnoticed because forced sentence-casing almost never appears in styles.
        var title = CSL.TITLE_FIELD_SPLITS(seg);
        var vals = {};
        if (lang && Item.multi) {
            if (Item.multi._keys[title.title]) {
                vals[title.title] = Item.multi._keys[title.title][lang];
            }
            if (Item.multi._keys[title.main]) {
                vals[title.main] = Item.multi._keys[title.main][lang];
            }
            if (Item.multi._keys[title.sub]) {
                vals[title.sub] = Item.multi._keys[title.sub][lang];
            }
            if (Item.multi._keys[title.subjoin]) {
                vals[title.subjoin] = Item.multi._keys[title.subjoin][lang];
            }
        } else {
            vals[title.title] = Item[title.title];
            vals[title.main] = Item[title.main];
            vals[title.sub] = Item[title.sub];
            vals[title.subjoin] = Item[title.subjoin];
        }
        if (vals[title.main] && vals[title.sub]) {
            var mainTitle = vals[title.main];
            var subJoin = vals[title.subjoin];
            var subTitle = vals[title.sub];
            if (sentenceCase) {
                mainTitle = CSL.Output.Formatters.sentence(state, mainTitle);
                subTitle = CSL.Output.Formatters.sentence(state, subTitle);
            } else if (state.opt.development_extensions.uppercase_subtitles) {
                subTitle = CSL.Output.Formatters["capitalize-first"](state, subTitle);
            }
            return [mainTitle, subJoin, subTitle].join("");
        } else if (vals[title.title]) {
            if (sentenceCase) {
                return CSL.Output.Formatters.sentence(state, vals[title.title]);
            } else if (state.opt.development_extensions.uppercase_subtitles) {
                // Split and apply everywhere.
                var splits = CSL.TITLE_SPLIT(vals[title.title]);
                for (var i=0,ilen=splits.length; i<ilen; i += 2) {
                    splits[i] = CSL.Output.Formatters["capitalize-first"](state, splits[i]);
                }
                for (var i=1, ilen=splits.length-1; i < ilen; i += 2) {
                    var m = splits[i].match(/([:\?\!] )/);
                    if (m) {
                        var narrowSpace = state.opt["default-locale"][0].slice(0, 2).toLowerCase() === "fr" ? "\u202f" : "";
                        splits[i] = narrowSpace + m[1];
                    }
                    if (splits[i].indexOf("-") > -1 || splits[i].indexOf("—") > -1) {
                        splits[i] = "—";
                    }
                }
                vals[title.title] = splits.join("");
                return vals[title.title];
            } else {
                return vals[title.title];
            }
        } else {
            return "";
        }
    },

    getSafeEscape: function(state) {
        if (["bibliography", "citation"].indexOf(state.tmp.area) > -1) {
            // Callback to apply thin space hack
            // Callback to force LTR/RTL on parens and braces
            // XXX Is this really necessary?
            var callbacks = [];
            if (state.opt.development_extensions.thin_non_breaking_space_html_hack && state.opt.mode === "html") {
                callbacks.push(function (txt) {
                    return txt.replace(/\u202f/g, '<span style="white-space:nowrap">&thinsp;</span>');
                });
            }
            if (callbacks.length) {
                return function (txt) {
                    for (var i = 0, ilen = callbacks.length; i < ilen; i += 1) {
                        txt = callbacks[i](txt);
                    }
                    return CSL.Output.Formats[state.opt.mode].text_escape(txt);
                };
            } else {
                return CSL.Output.Formats[state.opt.mode].text_escape;
            }
        } else {
            return function (txt) { return txt; };
        }
    },

    SKIP_WORDS: ["about","above","across","afore","after","against","al", "along","alongside","amid","amidst","among","amongst","anenst","apropos","apud","around","as","aside","astride","at","athwart","atop","barring","before","behind","below","beneath","beside","besides","between","beyond","but","by","circa","despite","down","during","et", "except","for","forenenst","from","given","in","inside","into","lest","like","modulo","near","next","notwithstanding","of","off","on","onto","out","over","per","plus","pro","qua","sans","since","than","through"," thru","throughout","thruout","till","to","toward","towards","under","underneath","until","unto","up","upon","versus","vs.","v.","vs","v","via","vis-à-vis","with","within","without","according to","ahead of","apart from","as for","as of","as per","as regards","aside from","back to","because of","close to","due to","except for","far from","inside of","instead of","near to","next to","on to","out from","out of","outside of","prior to","pursuant to","rather than","regardless of","such as","that of","up to","where as","or", "yet", "so", "for", "and", "nor", "a", "an", "the", "de", "d'", "von", "van", "c", "ca"],

    FORMAT_KEY_SEQUENCE: [
        "@strip-periods",
        "@font-style",
        "@font-variant",
        "@font-weight",
        "@text-decoration",
        "@vertical-align",
        "@quotes"
    ],

    INSTITUTION_KEYS: [
        "font-style",
        "font-variant",
        "font-weight",
        "text-decoration",
        "text-case"
    ],

    SUFFIX_CHARS: "a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z",
    ROMAN_NUMERALS: [
        [ "", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix" ],
        [ "", "x", "xx", "xxx", "xl", "l", "lx", "lxx", "lxxx", "xc" ],
        [ "", "c", "cc", "ccc", "cd", "d", "dc", "dcc", "dccc", "cm" ],
        [ "", "m", "mm", "mmm", "mmmm", "mmmmm"]
    ],

    LANGS: {
        "af-ZA":"Afrikaans",
        "ar":"Arabic",
        "bg-BG":"Bulgarian",
        "ca-AD":"Catalan",
        "cs-CZ":"Czech",
        "da-DK":"Danish",
        "de-AT":"Austrian",
        "de-CH":"German (CH)",
        "de-DE":"German (DE)",
        "el-GR":"Greek",
        "en-GB":"English (GB)",
        "en-US":"English (US)",
        "es-ES":"Spanish",
        "et-EE":"Estonian",
        "eu":"European",
        "fa-IR":"Persian",
        "fi-FI":"Finnish",
        "fr-CA":"French (CA)",
        "fr-FR":"French (FR)",
        "he-IL":"Hebrew",
        "hr-HR":"Croatian",
        "hu-HU":"Hungarian",
        "is-IS":"Icelandic",
        "it-IT":"Italian",
        "ja-JP":"Japanese",
        "km-KH":"Khmer",
        "ko-KR":"Korean",
        "lt-LT":"Lithuanian",
        "lv-LV":"Latvian",
        "mn-MN":"Mongolian",
        "nb-NO":"Norwegian (Bokmål)",
        "nl-NL":"Dutch",
        "nn-NO":"Norwegian (Nynorsk)",
        "pl-PL":"Polish",
        "pt-BR":"Portuguese (BR)",
        "pt-PT":"Portuguese (PT)",
        "ro-RO":"Romanian",
        "ru-RU":"Russian",
        "sk-SK":"Slovak",
        "sl-SI":"Slovenian",
        "sr-RS":"Serbian",
        "sv-SE":"Swedish",
        "th-TH":"Thai",
        "tr-TR":"Turkish",
        "uk-UA":"Ukrainian",
        "vi-VN":"Vietnamese",
        "zh-CN":"Chinese (CN)",
        "zh-TW":"Chinese (TW)"
    },

    LANG_BASES: {
        af: "af_ZA",
        ar: "ar",
        bg: "bg_BG",
        ca: "ca_AD",
        cs: "cs_CZ",
        da: "da_DK",
        de: "de_DE",
        el: "el_GR",
        en: "en_US",
        es: "es_ES",
        et: "et_EE",
        eu: "eu",
        fa: "fa_IR",
        fi: "fi_FI",
        fr: "fr_FR",
        he: "he_IL",
        hr: "hr-HR",
        hu: "hu_HU",
        is: "is_IS",
        it: "it_IT",
        ja: "ja_JP",
        km: "km_KH",
        ko: "ko_KR",
        lt: "lt_LT",
        lv: "lv-LV",
        mn: "mn_MN",
        nb: "nb_NO",
        nl: "nl_NL",
        nn: "nn-NO",
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

    SUPERSCRIPTS: {
        "\u00AA": "\u0061",
        "\u00B2": "\u0032",
        "\u00B3": "\u0033",
        "\u00B9": "\u0031",
        "\u00BA": "\u006F",
        "\u02B0": "\u0068",
        "\u02B1": "\u0266",
        "\u02B2": "\u006A",
        "\u02B3": "\u0072",
        "\u02B4": "\u0279",
        "\u02B5": "\u027B",
        "\u02B6": "\u0281",
        "\u02B7": "\u0077",
        "\u02B8": "\u0079",
        "\u02E0": "\u0263",
        "\u02E1": "\u006C",
        "\u02E2": "\u0073",
        "\u02E3": "\u0078",
        "\u02E4": "\u0295",
        "\u1D2C": "\u0041",
        "\u1D2D": "\u00C6",
        "\u1D2E": "\u0042",
        "\u1D30": "\u0044",
        "\u1D31": "\u0045",
        "\u1D32": "\u018E",
        "\u1D33": "\u0047",
        "\u1D34": "\u0048",
        "\u1D35": "\u0049",
        "\u1D36": "\u004A",
        "\u1D37": "\u004B",
        "\u1D38": "\u004C",
        "\u1D39": "\u004D",
        "\u1D3A": "\u004E",
        "\u1D3C": "\u004F",
        "\u1D3D": "\u0222",
        "\u1D3E": "\u0050",
        "\u1D3F": "\u0052",
        "\u1D40": "\u0054",
        "\u1D41": "\u0055",
        "\u1D42": "\u0057",
        "\u1D43": "\u0061",
        "\u1D44": "\u0250",
        "\u1D45": "\u0251",
        "\u1D46": "\u1D02",
        "\u1D47": "\u0062",
        "\u1D48": "\u0064",
        "\u1D49": "\u0065",
        "\u1D4A": "\u0259",
        "\u1D4B": "\u025B",
        "\u1D4C": "\u025C",
        "\u1D4D": "\u0067",
        "\u1D4F": "\u006B",
        "\u1D50": "\u006D",
        "\u1D51": "\u014B",
        "\u1D52": "\u006F",
        "\u1D53": "\u0254",
        "\u1D54": "\u1D16",
        "\u1D55": "\u1D17",
        "\u1D56": "\u0070",
        "\u1D57": "\u0074",
        "\u1D58": "\u0075",
        "\u1D59": "\u1D1D",
        "\u1D5A": "\u026F",
        "\u1D5B": "\u0076",
        "\u1D5C": "\u1D25",
        "\u1D5D": "\u03B2",
        "\u1D5E": "\u03B3",
        "\u1D5F": "\u03B4",
        "\u1D60": "\u03C6",
        "\u1D61": "\u03C7",
        "\u2070": "\u0030",
        "\u2071": "\u0069",
        "\u2074": "\u0034",
        "\u2075": "\u0035",
        "\u2076": "\u0036",
        "\u2077": "\u0037",
        "\u2078": "\u0038",
        "\u2079": "\u0039",
        "\u207A": "\u002B",
        "\u207B": "\u2212",
        "\u207C": "\u003D",
        "\u207D": "\u0028",
        "\u207E": "\u0029",
        "\u207F": "\u006E",
        "\u2120": "\u0053\u004D",
        "\u2122": "\u0054\u004D",
        "\u3192": "\u4E00",
        "\u3193": "\u4E8C",
        "\u3194": "\u4E09",
        "\u3195": "\u56DB",
        "\u3196": "\u4E0A",
        "\u3197": "\u4E2D",
        "\u3198": "\u4E0B",
        "\u3199": "\u7532",
        "\u319A": "\u4E59",
        "\u319B": "\u4E19",
        "\u319C": "\u4E01",
        "\u319D": "\u5929",
        "\u319E": "\u5730",
        "\u319F": "\u4EBA",
        "\u02C0": "\u0294",
        "\u02C1": "\u0295",
        "\u06E5": "\u0648",
        "\u06E6": "\u064A"
    },
    SUPERSCRIPTS_REGEXP: new RegExp("[\u00AA\u00B2\u00B3\u00B9\u00BA\u02B0\u02B1\u02B2\u02B3\u02B4\u02B5\u02B6\u02B7\u02B8\u02E0\u02E1\u02E2\u02E3\u02E4\u1D2C\u1D2D\u1D2E\u1D30\u1D31\u1D32\u1D33\u1D34\u1D35\u1D36\u1D37\u1D38\u1D39\u1D3A\u1D3C\u1D3D\u1D3E\u1D3F\u1D40\u1D41\u1D42\u1D43\u1D44\u1D45\u1D46\u1D47\u1D48\u1D49\u1D4A\u1D4B\u1D4C\u1D4D\u1D4F\u1D50\u1D51\u1D52\u1D53\u1D54\u1D55\u1D56\u1D57\u1D58\u1D59\u1D5A\u1D5B\u1D5C\u1D5D\u1D5E\u1D5F\u1D60\u1D61\u2070\u2071\u2074\u2075\u2076\u2077\u2078\u2079\u207A\u207B\u207C\u207D\u207E\u207F\u2120\u2122\u3192\u3193\u3194\u3195\u3196\u3197\u3198\u3199\u319A\u319B\u319C\u319D\u319E\u319F\u02C0\u02C1\u06E5\u06E6]", "g"),

    UPDATE_GROUP_CONTEXT_CONDITION: function (state, termtxt, valueTerm) {
        if (state.tmp.group_context.tip.condition) {
            if (state.tmp.group_context.tip.condition.test) {
                state.tmp.group_context.tip.condition.termtxt = termtxt;
                state.tmp.group_context.tip.condition.valueTerm = valueTerm;
            }
        } else {
            // If not inside a conditional group, raise numeric flag
            // if and only if the current term string ends in a number.
            if (termtxt.slice(-1).match(/[0-9]/)) {
                state.tmp.just_did_number = true;
            } else {
                state.tmp.just_did_number = false;
            }
        }
    },

    EVALUATE_GROUP_CONDITION: function(state, flags) {
        var testres;
        if (flags.condition.test === "empty-label") {
            testres = !flags.condition.termtxt;
        } else if (flags.condition.test === "empty-label-no-decor") {
            testres = !flags.condition.termtxt || flags.condition.termtxt.indexOf("%s") > -1;
        } else if (flags.condition.test === "comma-safe") {
            var empty = !flags.condition.termtxt;
            var termStartAlpha = false;
            if (flags.condition.termtxt) {
                termStartAlpha = flags.condition.termtxt.slice(0,1).match(CSL.ALL_ROMANESQUE_REGEXP);
            }
            var num = state.tmp.just_did_number;
            if (empty) {
                // i.e. Big L. Rev. 100, 102
                //      Little L. Rev. 102
                //      L. Rev. for Plan 9, 102
                if (num) {
                    testres = true;
                } else {
                    testres = false;
                }
            } else if (flags.condition.valueTerm) {
                // i.e. Ibid. at 102
                testres = false;
            } else {
                if (termStartAlpha) {
                    testres = true;
                } else {
                    testres = false;
                }
            }
        }
        if (testres) {
            var force_suppress = false;
        } else {
            var force_suppress = true;
        }
        if (flags.condition.not) {
            force_suppress = !force_suppress;
        }
        return force_suppress;
    },
    
    SYS_OPTIONS: [
        "prioritize_disambiguate_condition",
        "csl_reverse_lookup_support",
        "main_title_from_short_title",
        "uppercase_subtitles"
    ],

    TITLE_SPLIT_REGEXP: (function() {
        var splits = [
            "\\.\\s+",
            "\\!\\s+",
            "\\?\\s+",
            "\\s*::*\\s+",
            "\\s*—\\s*",
            "\\s+\\-\\s+",
            "\\s*\\-\\-\\-*\\s*"
        ]
        return {
            match: new RegExp("(" + splits.join("|") + ")", "g"),
            matchfirst: new RegExp("^(" + splits.join("|") + ")"),
            split: new RegExp("(?:" + splits.join("|") + ")")
        }
    })(),

    TITLE_SPLIT: function(str) {
        if (!str) {
            return str;
        }
        var m = str.match(CSL.TITLE_SPLIT_REGEXP.match);
        var lst = str.split(CSL.TITLE_SPLIT_REGEXP.split);
        for (var i=lst.length-2; i>-1; i--) {
            lst[i] = lst[i].trim();
            if (lst[i] && lst[i].slice(-1).toLowerCase() !== lst[i].slice(-1)) {
                // recombine
                lst[i] = lst[i] + m[i] + lst[i+1];
                lst = lst.slice(0, i+1).concat(lst.slice(i+2))
            } else {
                // merge
                lst = lst.slice(0, i+1).concat([m[i]]).concat(lst.slice(i+1))
            }
        }
        return lst;
    }
};

/**
 * Functions for parsing an XML object converted to JSON.
 */

/*
  Style and locale JSON should be formatted as follows. Note that
  an empty literal should be set as an explicit empty strings within
  children:[]
  
  {
    name:"term",
    children:[
      ""
    ],
    attrs:{
      name:"author"
    }
  }

  The following script will generate correctly formatted JSON
  from a CSL style or locale file:
*/

CSL.XmlJSON = function (dataObj) {
    this.dataObj = dataObj;
    this.institution = {
        name:"institution",
        attrs:{
            "institution-parts":"long",
            "delimiter":", ",
            "substitute-use-first":"1",
            "use-last":"1"
        },
        children:[
            {
                name:"institution-part",
                attrs:{
                    name:"long"
                },
                children:[]
            }
        ]
    };
};

/**
 * No need for cleaning with native JSON.
 */
CSL.XmlJSON.prototype.clean = function (json) {
    return json;
};


/**
 * Methods to call on a node.
 */
CSL.XmlJSON.prototype.getStyleId = function (myjson, styleName) {
    var tagName = 'id';
    if (styleName) {
        tagName = 'title';
    }
    var ret = "";
    var children = myjson.children;
    for (var i=0,ilen=children.length;i<ilen;i++) {
        if (children[i].name === 'info') {
            var grandkids = children[i].children;
            for (var j=0,jlen=grandkids.length;j<jlen;j++) {
                if (grandkids[j].name === tagName) {
                    ret = grandkids[j].children[0];
                }
            }
        }
    }
    return ret;
};

CSL.XmlJSON.prototype.children = function (myjson) {
    //print("children()");
    if (myjson && myjson.children.length) {
        return myjson.children.slice();
    } else {
        return false;
    }
};

CSL.XmlJSON.prototype.nodename = function (myjson) {
    //print("nodename()");
    return myjson ? myjson.name : null;
};

CSL.XmlJSON.prototype.attributes = function (myjson) {
    //print("attributes()");
    var ret = {};
    for (var attrname in myjson.attrs) {
        ret["@"+attrname] = myjson.attrs[attrname];
    }
    return ret;
};


CSL.XmlJSON.prototype.content = function (myjson) {
    //print("content()");
    // xmldom.js and xmle4x.js have "undefined" as default
    var ret = "";
    // This only catches content at first level, but that is good enough
    // for us.
    if (!myjson || !myjson.children) {
        return ret;
    }
    for (var i=0, ilen=myjson.children.length; i < ilen; i += 1) {
        if ("string" === typeof myjson.children[i]) {
            ret += myjson.children[i];
        }
    }
    return ret;
};


CSL.XmlJSON.prototype.namespace = {}

CSL.XmlJSON.prototype.numberofnodes = function (myjson) {
    //print("numberofnodes()");
    if (myjson && "number" == typeof myjson.length) {
        return myjson.length;
    } else {
        return 0;
    }
};

// getAttributeName() removed. Looks like it was not being used.

CSL.XmlJSON.prototype.getAttributeValue = function (myjson,name,namespace) {
    //print("getAttributeValue()");
    var ret = "";
    if (namespace) {
        name = namespace+":"+name;
    }
    if (myjson) {
        if (myjson.attrs) {
            if (myjson.attrs[name]) {
                ret = myjson.attrs[name];
            } else {
                ret = "";
            }
        }
    }
    return ret;
}

CSL.XmlJSON.prototype.getNodeValue = function (myjson,name) {
    //print("getNodeValue()");
    var ret = "";
    if (name){
        for (var i=0, ilen=myjson.children.length; i < ilen; i += 1) {
            if (myjson.children[i].name === name) {
                // This will always be Object() unless empty
                if (myjson.children[i].children.length) {
                    ret = myjson.children[i];
                } else {
                    ret = "";
                }
            }
        }
    } else if (myjson) {
        ret = myjson;
    }
    // Just being careful here, following the former DOM code. The JSON object we receive 
    // for this should be fully normalized.
    if (ret && ret.children && ret.children.length == 1 && "string" === typeof ret.children[0]) {
        ret = ret.children[0];
    }
    return ret;
}

CSL.XmlJSON.prototype.setAttributeOnNodeIdentifiedByNameAttribute = function (myjson,nodename,partname,attrname,val) {
    //print("setAttributeOnNodeIdentifiedByNameAttribute()");
    var pos, len, xml, nodes, node;
    if (attrname.slice(0,1) === '@'){
        attrname = attrname.slice(1);
    }
    // In the one place this is used in citeproc-js code, it doesn't need to recurse.
    for (var i=0,ilen=myjson.children.length; i<ilen; i += 1) {
        if (myjson.children[i].name === nodename && myjson.children[i].attrs.name === partname) {
            myjson.children[i].attrs[attrname] = val;
        }
    }
}

CSL.XmlJSON.prototype.deleteNodeByNameAttribute = function (myjson,val) {
    //print("deleteNodeByNameAttribute()");
    var i, ilen;
    for (i = 0, ilen = myjson.children.length; i < ilen; i += 1) {
        if (!myjson.children[i] || "string" === typeof myjson.children[i]) {
            continue;
        }
        if (myjson.children[i].attrs.name == val) {
            myjson.children = myjson.children.slice(0,i).concat(myjson.children.slice(i+1));
        }
    }
}

CSL.XmlJSON.prototype.deleteAttribute = function (myjson,attrname) {
    //print("deleteAttribute()");
    var i, ilen;
    if ("undefined" !== typeof myjson.attrs[attrname]) {
        myjson.attrs.pop(attrname);
    }
}

CSL.XmlJSON.prototype.setAttribute = function (myjson,attr,val) {
    //print("setAttribute()");
    myjson.attrs[attr] = val;
    return false;
}

CSL.XmlJSON.prototype.nodeCopy = function (myjson,clone) {
    //print("nodeCopy()");
    if (!clone) {
        var clone = {};
    }
    if ("object" === typeof clone && "undefined" === typeof clone.length) {
        // myjson is an object
        for (var key in myjson) {
            if ("string" === typeof myjson[key]) {
                clone[key] = myjson[key];
            } else if ("object" === typeof myjson[key]) {
                if ("undefined" === typeof myjson[key].length) {
                    clone[key] = this.nodeCopy(myjson[key],{});
                } else {
                    clone[key] = this.nodeCopy(myjson[key],[]);
                }
            }
        }
    } else {
        // myjson is an array
        for (var i=0,ilen=myjson.length;i<ilen; i += 1) {
            if ("string" === typeof myjson[i]) {
                clone[i] = myjson[i];
            } else {
                // If it's at the first level of an array, it's an object.
                clone[i] = this.nodeCopy(myjson[i],{});
            }
        }
    }
    return clone;
}

CSL.XmlJSON.prototype.getNodesByName = function (myjson,name,nameattrval,ret) {
    //print("getNodesByName()");
    var nodes, node, pos, len;
    if (!ret) {
        var ret = [];
    }
    if (!myjson || !myjson.children) {
        return ret;
    }
    if (name === myjson.name) {
        if (nameattrval) {
            if (nameattrval === myjson.attrs.name) {
                ret.push(myjson);
            }
        } else {
            ret.push(myjson);
        }
    }
    for (var i=0,ilen=myjson.children.length;i<ilen;i+=1){
        if ("object" !== typeof myjson.children[i]) {
            continue;
        }
        this.getNodesByName(myjson.children[i],name,nameattrval,ret);
    }
    return ret;
}

CSL.XmlJSON.prototype.nodeNameIs = function (myjson,name) {
    //print("nodeNameIs()");
    if (typeof myjson === "undefined") {
        return false;
    }
    if (name == myjson.name) {
        return true;
    }
    return false;
}

CSL.XmlJSON.prototype.makeXml = function (myjson) {
    //print("makeXml()");
    if ("string" === typeof myjson) {
        if (myjson.slice(0, 1) === "<") {
            myjson = this.jsonStringWalker.walkToObject(myjson);
        } else {
            myjson = JSON.parse(myjson);
        }
    }
    return myjson;
};

CSL.XmlJSON.prototype.insertChildNodeAfter = function (parent,node,pos,datejson) {
    //print("insertChildNodeAfter()");
    // Function is misnamed: this replaces the node
    for (var i=0,ilen=parent.children.length;i<ilen;i+=1) {
        if (node === parent.children[i]) {
            parent.children = parent.children.slice(0,i).concat([datejson]).concat(parent.children.slice(i+1));
            break;
        }
    }
    return parent;
};


CSL.XmlJSON.prototype.insertPublisherAndPlace = function(myjson) {
    if (myjson.name === "group") {
        var useme = true;
        var mustHaves = ["publisher","publisher-place"];
        for (var i=0,ilen=myjson.children.length;i<ilen;i+=1) {
            var haveVarname = mustHaves.indexOf(myjson.children[i].attrs.variable);
            var isText = myjson.children[i].name === "text";
            if (isText && haveVarname > -1 && !myjson.children[i].attrs.prefix && !myjson.children[i].attrs.suffix) {
                mustHaves = mustHaves.slice(0,haveVarname).concat(mustHaves.slice(haveVarname+1));
            } else {
                useme = false;
                break;
            }
        }
        if (useme && !mustHaves.length) {
            myjson.attrs["has-publisher-and-publisher-place"] = true;
       }
    }
    for (var i=0,ilen=myjson.children.length;i<ilen;i+=1) {
        if ("object" === typeof myjson.children[i]) {
            this.insertPublisherAndPlace(myjson.children[i]);
        }
    }    
}
/*
CSL.XmlJSON.prototype.insertPublisherAndPlace = function(myxml) {
    var group = myxml.getElementsByTagName("group");
    for (var i = 0, ilen = group.length; i < ilen; i += 1) {
        var node = group.item(i);
        var skippers = [];
        for (var j = 0, jlen = node.childNodes.length; j < jlen; j += 1) {
            if (node.childNodes.item(j).nodeType !== 1) {
                skippers.push(j);
            }
        }
        if (node.childNodes.length - skippers.length === 2) {
            var twovars = [];
            for (var j = 0, jlen = 2; j < jlen; j += 1) {
                if (skippers.indexOf(j) > -1) {
                    continue;
                }
                var child = node.childNodes.item(j);                    
                var subskippers = [];
                for (var k = 0, klen = child.childNodes.length; k < klen; k += 1) {
                    if (child.childNodes.item(k).nodeType !== 1) {
                        subskippers.push(k);
                    }
                }
                if (child.childNodes.length - subskippers.length === 0) {
                    twovars.push(child.getAttribute('variable'));
                    if (child.getAttribute('suffix')
                        || child.getAttribute('prefix')) {
                        twovars = [];
                        break;
                    }
                }
            }
            if (twovars.indexOf("publisher") > -1 && twovars.indexOf("publisher-place") > -1) {
                node.setAttribute('has-publisher-and-publisher-place', true);
            }
        }
    }
};
*/

CSL.XmlJSON.prototype.isChildOfSubstitute = function(parents) {
    if (parents.length > 0) {
        var myparents = parents.slice();
        var parent = myparents.pop();
        if (parent === "substitute") {
            return true;
        } else {
            return this.isChildOfSubstitute(myparents);
        }
    }
    return false;
};

CSL.XmlJSON.prototype.addMissingNameNodes = function(myjson,parents) {
    if (!parents) {
        parents = [];
    }
    if (myjson.name === "names") {
        // Trawl through children to decide whether a name node is needed here
        if (!this.isChildOfSubstitute(parents)) {
            var addName = true;
            for (var i=0,ilen=myjson.children.length;i<ilen;i++) {
                if (myjson.children[i].name === "name") {
                    addName = false;
                    break;
                }
            }
            if (addName) {
                myjson.children = [{name:"name",attrs:{},children:[]}].concat(myjson.children);
            }
        }
    }
    parents.push(myjson.name);
    for (var i=0,ilen=myjson.children.length;i<ilen;i+=1) {
        if ("object" === typeof myjson.children[i]) {
            this.addMissingNameNodes(myjson.children[i],parents);
        }
    }
    parents.pop();
}


CSL.XmlJSON.prototype.addInstitutionNodes = function(myjson) {
    //print("addInstitutionNodes()");
    var names, thenames, institution, theinstitution, name, thename, xml, pos, len;
    // The idea here is to map relevant attributes from name and nampart=family
    // to the "long" institution-part node, when and only when forcing insert
    // of the default node.
    if (myjson.name === "names") {
        // do stuff
        var attributes = {};
        var insertPos = -1;
        for (var i=0,ilen=myjson.children.length;i<ilen;i+=1) {
            if (myjson.children[i].name == "name") {
                for (var key in myjson.children[i].attrs) {
                    attributes[key] = myjson.children[i].attrs[key];
                }
                attributes.delimiter = myjson.children[i].attrs.delimiter;
                attributes.and = myjson.children[i].attrs.and;
                insertPos = i;
                for (var k=0,klen=myjson.children[i].children.length;k<klen;k+=1) {
                    if (myjson.children[i].children[k].attrs.name !== 'family') {
                        continue;
                    }
                    for (var key in myjson.children[i].children[k].attrs) {
                        attributes[key] = myjson.children[i].children[k].attrs[key];
                    }
                }
            }
            if (myjson.children[i].name == "institution") {
                insertPos = -1;
                break;
            }
        }
        if (insertPos > -1) {
            var institution = this.nodeCopy(this.institution);
            for (var i=0,ilen = CSL.INSTITUTION_KEYS.length;i<ilen;i+=1) {
                var attrname = CSL.INSTITUTION_KEYS[i];
                if ("undefined" !== typeof attributes[attrname]) {
                    institution.children[0].attrs[attrname] = attributes[attrname];
                }
                if (attributes.delimiter) {
                    institution.attrs.delimiter = attributes.delimiter;
                }
                if (attributes.and) {
                    institution.attrs.and = "text";
                }
            }
            myjson.children = myjson.children.slice(0,insertPos+1).concat([institution]).concat(myjson.children.slice(insertPos+1));
        }
    }
    for (var i=0,ilen=myjson.children.length;i<ilen;i+=1) {
        if ("string" === typeof myjson.children[i]) {
            continue;
        }
        // Recurse
        this.addInstitutionNodes(myjson.children[i]);
    }
}
CSL.XmlJSON.prototype.flagDateMacros = function(myjson) {
    // print("flagDateMacros()");
    for (var i=0,ilen=myjson.children.length;i<ilen;i+=1) {
        if (myjson.children[i].name === "macro") {
            if (this.inspectDateMacros(myjson.children[i])) {
                myjson.children[i].attrs["macro-has-date"] = "true";
            }
        }
    }
}
CSL.XmlJSON.prototype.inspectDateMacros = function(myjson) {
    //print("inspectDateMacros()");
    if (!myjson || !myjson.children) {
        return false;
    }
    if (myjson.name === "date") {
        return true;
    } else {
        for (var i=0,ilen=myjson.children.length;i<ilen;i+=1) {
            if (this.inspectDateMacros(myjson.children[i])) {
                return true;
            }
        }
    }
    return false;
}

/*
 * Clean serialized XML
 */
CSL.stripXmlProcessingInstruction = function (xml) {
    if (!xml) {
        return xml;
    }
    xml = xml.replace(/^<\?[^?]+\?>/, "");
    xml = xml.replace(/<!--[^>]+-->/g, "");
    xml = xml.replace(/^\s+/g, "");
    xml = xml.replace(/\s+$/g, "");
    return xml;
};


/*
 * String parser for XML inputs
 */
CSL.parseXml = function(str) {

    var _pos = 0;
    var _obj = {children:[]};
    var _stack = [_obj.children];

    function _listifyString(str) {
        str = str.split(/(?:\r\n|\n|\r)/).join(" ").replace(/>[	 ]+</g, "><").replace(/<\!--.*?-->/g, "");
        var lst = str.split("><");
        var stylePos = null;
        for (var i=0,ilen=lst.length;i<ilen;i++) {
            if (i > 0) {
                lst[i] = "<" + lst[i];
            }
            if (i < (lst.length-1)) {
                lst[i] = lst[i] + ">";
            }
            if ("number" != typeof stylePos) {
                if (lst[i].slice(0, 7) === "<style " || lst[i].slice(0, 8) == "<locale ") {
                    stylePos = i;
                }
            }
        }
        lst = lst.slice(stylePos);
        // Combine open/close elements for empty terms,
        // so that they will be passed through correctly
        // as empty strings.
        for (var i=lst.length-2;i>-1;i--) {
            if (lst[i].slice(1).indexOf("<") === -1) {
                var stub = lst[i].slice(0, 5);
                if (lst[i].slice(-2) !== "/>") {
                    if (stub === "<term") {
                        if (lst[i+1].slice(0, 6) === "</term") {
                            lst[i] = lst[i] + lst[i+1];
                            lst = lst.slice(0, i+1).concat(lst.slice(i+2));
                        }
                    } else if (["<sing", "<mult"].indexOf(stub) > -1) {
                        if (lst[i].slice(-2) !== "/>" && lst[i+1].slice(0, 1) === "<") {
                            lst[i] = lst[i] + lst[i+1];
                            lst = lst.slice(0, i+1).concat(lst.slice(i+2));
                        }
                    }
                }
            }
        }
        return lst;
    }

    function _decodeHtmlEntities(str) {
        return str
            .split("&amp;").join("&")
            .split("&quot;").join("\"")
            .split("&gt;").join(">").split("&lt;").join("<")
            .replace(/&#([0-9]{1,6});/gi, function(match, numStr) {
                var num = parseInt(numStr, 10); // read num as normal number
                return String.fromCharCode(num);
            })
            .replace(/&#x([a-f0-9]{1,6});/gi, function(match, numStr){
                var num = parseInt(numStr, 16); // read num as hex
                return String.fromCharCode(num);
            });
    }

    function _getAttributes(elem) {
        var m = elem.match(/([^\'\"=	 ]+)=(?:\"[^\"]*\"|\'[^\']*\')/g);
        if (m) {
            for (var i=0,ilen=m.length;i<ilen;i++) {
                m[i] = m[i].replace(/=.*/, "");
            }
        }
        return m;
    }

    function _getAttribute(elem, attr) {
        var rex = RegExp('^.*[	 ]+' + attr + '=(\"(?:[^\"]*)\"|\'(?:[^\']*)\').*$');
        var m = elem.match(rex);
        return m ? m[1].slice(1, -1) : null;
    }

    function _getTagName(elem) {
        var rex = RegExp("^<([^	 />]+)");
        var m = elem.match(rex);
        return m ? m[1] : null;
    }
    

    function _castObjectFromOpeningTag(elem) {
        var obj = {};
        obj.name = _getTagName(elem);
        obj.attrs = {};
        var attributes = _getAttributes(elem);
        if (attributes) {
            for (var i=0,ilen=attributes.length;i<ilen;i++) {
                var attr = {
                    name: attributes[i],
                    value: _getAttribute(elem, attributes[i])
                }
                obj.attrs[attr.name] = _decodeHtmlEntities(attr.value);
            }
        }
        obj.children = [];
        return obj;
    }

    function _extractTextFromCompositeElement(elem) {
        var m = elem.match(/^.*>([^<]*)<.*$/);
        return _decodeHtmlEntities(m[1]);
    }

    function _appendToChildren(obj) {
        _stack.slice(-1)[0].push(obj);
    }

    function _extendStackWithNewChildren(obj) {
        _stack.push(obj.children);
    }

    function processElement(elem) {
        var obj;
        if (elem.slice(1).indexOf('<') > -1) {
            // withtext
            var tag = elem.slice(0, elem.indexOf('>')+1);
            obj = _castObjectFromOpeningTag(tag);
            obj.children = [_extractTextFromCompositeElement(elem)];
            _appendToChildren(obj);
        } else if (elem.slice(-2) === '/>') {
            // singleton
            obj = _castObjectFromOpeningTag(elem);
            // Empty term as singleton
            if (_getTagName(elem) === 'term') {
                obj.children.push('');
            }
            _appendToChildren(obj);
        } else if (elem.slice(0, 2) === '</') {
            // close
            _stack.pop();
        } else {
            // open
            obj = _castObjectFromOpeningTag(elem);
            _appendToChildren(obj)
            _extendStackWithNewChildren(obj);
        }
    }

    var lst = _listifyString(str);

    for (var i=0,ilen=lst.length;i<ilen;i++) {
        var elem = lst[i];
        processElement(elem);
    }
    return _obj.children[0];
}

/**
 * Functions for parsing an XML object using E4X.
 */

CSL.XmlDOM = function (dataObj) {
    this.dataObj = dataObj;
    if ("undefined" == typeof DOMParser) {
        DOMParser = function() {};
        DOMParser.prototype.parseFromString = function(str, contentType) {
            if ("undefined" != typeof ActiveXObject) {
                var xmldata = new ActiveXObject('MSXML.DomDocument');
                xmldata.async = false;
                xmldata.loadXML(str);
                return xmldata;
            } else if ("undefined" != typeof XMLHttpRequest) {
                var xmldata = new XMLHttpRequest;
                if (!contentType) {
                    contentType = 'text/xml';
                }
                xmldata.open('GET', 'data:' + contentType + ';charset=utf-8,' + encodeURIComponent(str), false);
                if(xmldata.overrideMimeType) {
                    xmldata.overrideMimeType(contentType);
                }
                xmldata.send(null);
                return xmldata.responseXML;
            } else if ("undefined" != typeof marknote) {
                var parser = new marknote.Parser();
                return parser.parse(str);
            }
        };
        this.hasAttributes = function (node) {
            var ret;
            if (node.attributes && node.attributes.length) {
                ret = true;
            } else {
                ret = false;
            }
            return ret;
        };
    } else {
        /*
        this.hasAttributes = function (node) {
            return node["hasAttributes"]();
        };
        */
        this.hasAttributes = function (node) {
            var ret;
            if (node.attributes && node.attributes.length) {
                ret = true;
            } else {
                ret = false;
            }
            return ret;
        };
    }
    this.importNode = function (doc, srcElement) {
        var ret;
        if ("undefined" == typeof doc.importNode) {
            ret = this._importNode(doc, srcElement, true);
        } else {
            ret = doc.importNode(srcElement, true);
        }
        return ret;
    };
    // In case importNode is not available.
    // Thx + hat tip to Anthony T. Holdener III
    // http://www.alistapart.com/articles/crossbrowserscripting
    // cases 3, 4, 8 = text, cdata, comment
    this._importNode = function(doc, node, allChildren) {
        switch (node.nodeType) {
            // element node
            case 1:
                var newNode = doc.createElement(node.nodeName);
                if (node.attributes && node.attributes.length > 0)
                    for (var i = 0, il = node.attributes.length; i < il;)
                        newNode.setAttribute(node.attributes[i].nodeName, node.getAttribute(node.attributes[i++].nodeName));
                    if (allChildren && node.childNodes && node.childNodes.length > 0)
                        for (var i = 0, il = node.childNodes.length; i < il;)
                            newNode.appendChild(this._importNode(doc, node.childNodes[i++], allChildren));
                return newNode;
                break;
            case 3:
            case 4:
            case 8:
                // Drop comments on the floor as well.
                //return doc.createTextNode(node.nodeValue);
                //break;
        }
    };
    this.parser = new DOMParser();

    // This seems horribly tormented, but there might be a reason for it.
    // Perhaps this was the only way I found to get namespacing to work ... ?
    var str = "<docco><institution institution-parts=\"long\" delimiter=\", \" substitute-use-first=\"1\" use-last=\"1\"><institution-part name=\"long\"/></institution></docco>";
    var inst_doc = this.parser.parseFromString(str, "text/xml");
    var inst_node = inst_doc.getElementsByTagName("institution");
    this.institution = inst_node.item(0);
    var inst_part_node = inst_doc.getElementsByTagName("institution-part");
    this.institutionpart = inst_part_node.item(0);
    this.ns = "http://purl.org/net/xbiblio/csl";
};

/**
 * No need for cleaning with the DOM, I think.  This will probably just be a noop.
 * But first, let's get XML mode switching up and running.
 */
CSL.XmlDOM.prototype.clean = function (xml) {
    xml = xml.replace(/<\?[^?]+\?>/g, "");
    xml = xml.replace(/<![^>]+>/g, "");
    xml = xml.replace(/^\s+/, "");
    xml = xml.replace(/\s+$/, "");
    xml = xml.replace(/^\n*/, "");
    return xml;
};


/**
 * Methods to call on a node.
 */
CSL.XmlDOM.prototype.getStyleId = function (myxml, styleName) {
    var text = "";
    var tagName = "id";
    if (styleName) {
        tagName = "title";
    }
    var node = myxml.getElementsByTagName(tagName);
    if (node && node.length) {
        node = node.item(0);
    }
    if (node) {
        // W3C conformant browsers
        text = node.textContent;
    }
    if (!text) {
        // Opera, IE 6 & 7
        text = node.innerText;
    }
    if (!text) {
        // Safari
        text = node.innerHTML;
    }
    return text;
};

CSL.XmlDOM.prototype.children = function (myxml) {
    var children, pos, len, ret;
    if (myxml) {
        ret = [];
        children = myxml.childNodes;
        for (pos = 0, len = children.length; pos < len; pos += 1) {
            if (children[pos].nodeName != "#text") {
                ret.push(children[pos]);
            }
        }
        return ret;
    } else {
        return [];
    }
};

CSL.XmlDOM.prototype.nodename = function (myxml) {
    var ret = myxml.nodeName;
    return ret;
};

CSL.XmlDOM.prototype.attributes = function (myxml) {
    var ret, attrs, attr, key, xml, pos, len;
    ret = new Object();
    if (myxml && this.hasAttributes(myxml)) {
        attrs = myxml.attributes;
        for (pos = 0, len=attrs.length; pos < len; pos += 1) {
            attr = attrs[pos];
            ret["@" + attr.name] = attr.value;
        }
    }
    return ret;
};


CSL.XmlDOM.prototype.content = function (myxml) {
    var ret;
    if ("undefined" != typeof myxml.textContent) {
        ret = myxml.textContent;
    } else if ("undefined" != typeof myxml.innerText) {
        ret = myxml.innerText;
    } else {
        ret = myxml.txt;
    }
    return ret;
};


CSL.XmlDOM.prototype.namespace = {
    "xml":"http://www.w3.org/XML/1998/namespace"
}

CSL.XmlDOM.prototype.numberofnodes = function (myxml) {
    if (myxml) {
        return myxml.length;
    } else {
        return 0;
    }
};

CSL.XmlDOM.prototype.getAttributeName = function (attr) {
    var ret = attr.name;
    return ret;
}

CSL.XmlDOM.prototype.getAttributeValue = function (myxml,name,namespace) {
    var ret = "";
    if (namespace) {
        name = namespace+":"+name;
    }
    if (myxml && this.hasAttributes(myxml) && myxml.getAttribute(name)) {
        ret = myxml.getAttribute(name);
    }
    return ret;
}

//
// Can't this be, you know ... simplified?
//
CSL.XmlDOM.prototype.getNodeValue = function (myxml,name) {
    var ret = null;
    if (name){
        var vals = myxml.getElementsByTagName(name);
        if (vals.length > 0) {
            if ("undefined" != typeof vals[0].textContent) {
                ret = vals[0].textContent;
            } else if ("undefined" != typeof vals[0].innerText) {
                ret = vals[0].innerText;
            } else {
                ret = vals[0].text;
            }
        }
    }
    if (ret === null && myxml && myxml.childNodes && (myxml.childNodes.length == 0 || (myxml.childNodes.length == 1 && myxml.firstChild.nodeName == "#text"))) {
        if ("undefined" != typeof myxml.textContent) {
            ret = myxml.textContent;
        } else if ("undefined" != typeof myxml.innerText) {
            ret = myxml.innerText;
        } else {
            ret = myxml.text;
        }
    }
    if (ret === null) {
        ret = myxml;
    }
    return ret;
}

CSL.XmlDOM.prototype.setAttributeOnNodeIdentifiedByNameAttribute = function (myxml,nodename,partname,attrname,val) {
    var pos, len, xml, nodes, node;
    if (attrname.slice(0,1) === '@'){
        attrname = attrname.slice(1);
    }
    nodes = myxml.getElementsByTagName(nodename);
    for (pos = 0, len = nodes.length; pos < len; pos += 1) {
        node = nodes[pos];
        if (node.getAttribute("name") != partname) {
            continue;
        }
        node.setAttribute(attrname, val);
    }
}

CSL.XmlDOM.prototype.deleteNodeByNameAttribute = function (myxml,val) {
    var pos, len, node, nodes;
    nodes = myxml.childNodes;
    for (pos = 0, len = nodes.length; pos < len; pos += 1) {
        node = nodes[pos];
        if (!node || node.nodeType == node.TEXT_NODE) {
            continue;
        }
        if (this.hasAttributes(node) && node.getAttribute("name") == val) {
            myxml.removeChild(nodes[pos]);
        }
    }
}

CSL.XmlDOM.prototype.deleteAttribute = function (myxml,attr) {
    myxml.removeAttribute(attr);
}

CSL.XmlDOM.prototype.setAttribute = function (myxml,attr,val) {
    if (!myxml.ownerDocument) {
        myxml = myxml.firstChild;
    }
    // "unknown" to satisfy IE8, which crashes when setAttribute
    // is checked directly as a property, and report its type as
    // "unknown".
    // Many thanks to Phil Lord for tracing the cause of the fault.
    if (["function", "unknown"].indexOf(typeof myxml.setAttribute) > -1) {
        myxml.setAttribute(attr, val);
    }
    return false;
}

CSL.XmlDOM.prototype.nodeCopy = function (myxml) {
    var cloned_node = myxml.cloneNode(true);
    return cloned_node;
}

CSL.XmlDOM.prototype.getNodesByName = function (myxml,name,nameattrval) {
    var ret, nodes, node, pos, len;
    ret = [];
    nodes = myxml.getElementsByTagName(name);
    for (pos = 0, len = nodes.length; pos < len; pos += 1) {
        node = nodes.item(pos);
        if (nameattrval && !(this.hasAttributes(node) && node.getAttribute("name") == nameattrval)) {
//        if (nameattrval && !(this.attributes && node.attributes.name && node.attributes.name.value == nameattrval)) {
            continue;
        }
        ret.push(node);
    }
    return ret;
}

CSL.XmlDOM.prototype.nodeNameIs = function (myxml,name) {
    if (name == myxml.nodeName) {
        return true;
    }
    return false;
}

CSL.XmlDOM.prototype.makeXml = function (myxml) {
    var ret, topnode;
    if (!myxml) {
        myxml = "<docco><bogus/></docco>";
    }
    myxml = myxml.replace(/\s*<\?[^>]*\?>\s*\n*/g, "");
    var nodetree = this.parser.parseFromString(myxml, "application/xml");
    return nodetree.firstChild;
};

CSL.XmlDOM.prototype.insertChildNodeAfter = function (parent,node,pos,datexml) {
    var myxml, xml;
    myxml = this.importNode(node.ownerDocument, datexml);
    parent.replaceChild(myxml, node);
     return parent;
};

CSL.XmlDOM.prototype.insertPublisherAndPlace = function(myxml) {
    var group = myxml.getElementsByTagName("group");
    for (var i = 0, ilen = group.length; i < ilen; i += 1) {
        var node = group.item(i);
        var skippers = [];
        for (var j = 0, jlen = node.childNodes.length; j < jlen; j += 1) {
            if (node.childNodes.item(j).nodeType !== 1) {
                skippers.push(j);
            }
        }
        if (node.childNodes.length - skippers.length === 2) {
            var twovars = [];
            for (var j = 0, jlen = 2; j < jlen; j += 1) {
                if (skippers.indexOf(j) > -1) {
                    continue;
                }
                var child = node.childNodes.item(j);                    
                var subskippers = [];
                for (var k = 0, klen = child.childNodes.length; k < klen; k += 1) {
                    if (child.childNodes.item(k).nodeType !== 1) {
                        subskippers.push(k);
                    }
                }
                if (child.childNodes.length - subskippers.length === 0) {
                    twovars.push(child.getAttribute('variable'));
                    if (child.getAttribute('suffix')
                        || child.getAttribute('prefix')) {
                        twovars = [];
                        break;
                    }
                }
            }
            if (twovars.indexOf("publisher") > -1 && twovars.indexOf("publisher-place") > -1) {
                node.setAttribute('has-publisher-and-publisher-place', true);
            }
        }
    }
};

CSL.XmlDOM.prototype.isChildOfSubstitute = function(node) {
    if (node.parentNode) {
        if (node.parentNode.tagName.toLowerCase() === "substitute") {
            return true;
        } else {
            return this.isChildOfSubstitute(node.parentNode);
        }
    }
    return false;
};

CSL.XmlDOM.prototype.addMissingNameNodes = function(myxml) {
    var nameslist = myxml.getElementsByTagName("names");
    for (var i = 0, ilen = nameslist.length; i < ilen; i += 1) {
        var names = nameslist.item(i);
        var namelist = names.getElementsByTagName("name");
        if ((!namelist || namelist.length === 0)
            && !this.isChildOfSubstitute(names)) {
            
            var doc = names.ownerDocument;
            var name = doc.createElement("name");
            names.appendChild(name);
        }
    }
};


CSL.XmlDOM.prototype.addInstitutionNodes = function(myxml) {
    var names, thenames, institution, theinstitution, theinstitutionpart, name, thename, xml, pos, len;
    names = myxml.getElementsByTagName("names");
    for (pos = 0, len = names.length; pos < len; pos += 1) {
        thenames = names.item(pos);
        name = thenames.getElementsByTagName("name");
        if (name.length == 0) {
            continue;
        }
        institution = thenames.getElementsByTagName("institution");
        if (institution.length == 0) {
            theinstitution = this.importNode(myxml.ownerDocument, this.institution);
            theinstitutionpart = theinstitution.getElementsByTagName("institution-part").item(0);
            thename = name.item(0);
            thenames.insertBefore(theinstitution, thename.nextSibling);
            for (var j = 0, jlen = CSL.INSTITUTION_KEYS.length; j < jlen; j += 1) {
                var attrname = CSL.INSTITUTION_KEYS[j];
                var attrval = thename.getAttribute(attrname);
                if (attrval) {
                    theinstitutionpart.setAttribute(attrname, attrval);
                }
            }
            var nameparts = thename.getElementsByTagName("name-part");
            for (var j = 0, jlen = nameparts.length; j < jlen; j += 1) {
                if ('family' === nameparts[j].getAttribute('name')) {
                    for (var k = 0, klen = CSL.INSTITUTION_KEYS.length; k < klen; k += 1) {
                        var attrname = CSL.INSTITUTION_KEYS[k];
                        var attrval = nameparts[j].getAttribute(attrname);
                        if (attrval) {
                            theinstitutionpart.setAttribute(attrname, attrval);
                        }
                    }
                }
            }
        }
    }
};


CSL.XmlDOM.prototype.flagDateMacros = function(myxml) {
    var pos, len, thenode, thedate;
    var nodes = myxml.getElementsByTagName("macro");
    for (pos = 0, len = nodes.length; pos < len; pos += 1) {
        thenode = nodes.item(pos);
        thedate = thenode.getElementsByTagName("date");
        if (thedate.length) {
            thenode.setAttribute('macro-has-date', 'true');
        }
    }
};


/*global CSL: true */

CSL.setupXml = function(xmlObject) {
    var dataObj = {};
    var parser = null;
    if ("undefined" !== typeof xmlObject) {
        if ("string" === typeof xmlObject) {
            xmlObject = xmlObject.replace("^\uFEFF", "")
                .replace(/^\s+/, "");
            if (xmlObject.slice(0, 1) === "<") {
                // Assume serialized XML
                dataObj = CSL.parseXml(xmlObject);
            } else {
                // Assume serialized JSON
                dataObj = JSON.parse(xmlObject);
            }
            parser = new CSL.XmlJSON(dataObj);
        } else if ("undefined" !== typeof xmlObject.getAttribute) {
            // Assume DOM instance
            parser = new CSL.XmlDOM(xmlObject);
        } else if ("undefined" !== typeof xmlObject.toXMLString) {
            // Assume E4X object
            parser = new CSL.XmlE4X(xmlObject);
        } else {
            // Assume JS object
            parser = new CSL.XmlJSON(xmlObject);
        }
    } else {
        CSL.error("unable to parse XML input");
    }
    if (!parser) {
        CSL.error("citeproc-js error: unable to parse CSL style or locale object");
    }
    return parser;
};

/*global CSL: true */

CSL.getSortCompare = function (default_locale) {
    if (CSL.stringCompare) {
        return CSL.stringCompare;
    }
    var strcmp;
    var strcmp_opts = {
        sensitivity:"base",
        ignorePunctuation:true,
        numeric:true
    };
    // In order, attempt the following:
    //   (1) Set locale collation from processor language
    //   (2) Use localeCompare()
    if (!default_locale) {
        default_locale = "en-US";
    }
    strcmp = function (a, b) {
        //var ret = a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase(),default_locale,strcmp_opts);
        // print(ret+' ('+a+') :: ('+b+')');
        //return ret;
        return a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase(),default_locale,strcmp_opts);
    };
    var stripPunct = function (str) {
        return str.replace(/^[\[\]\'\"]*/g, "");
    };
    var getBracketPreSort = function () {
        if (!strcmp("[x","x")) {
            return false;
        } else {
            return function (a, b) {
                return strcmp(stripPunct(a), stripPunct(b));
            };
        }
    };
    var bracketPreSort = getBracketPreSort();
    var sortCompare = function (a, b) {
        if (bracketPreSort) {
            return bracketPreSort(a, b);
        } else {
            return strcmp(a, b);
        }
    };
    return sortCompare;
};

/*global CSL: true */

CSL.ambigConfigDiff = function(a, b) {
    var pos, len, ppos, llen;
    // return of true means the ambig configs differ
    if (a.names.length !== b.names.length) {
        //print("   (1)");
        return 1;
    } else {
        for (pos = 0, len = a.names.length; pos < len; pos += 1) {
            if (a.names[pos] !== b.names[pos]) {
        //print("   (2) "+a.names[pos]+" "+b.names[pos]);
                return 1;
            } else {
                for (ppos = 0, llen = a.givens[pos]; ppos < llen; ppos += 1) {
                    if (a.givens[pos][ppos] !== b.givens[pos][ppos]) {
        //print("   (3): "+a.givens[pos][ppos]+" "+b.givens[pos][ppos]+" "+pos+"/"+ppos+" "+b.givens[pos]);
                        return 1;
                    }
                }
            }
        }
    }
    if (a.disambiguate != b.disambiguate) {
        //print("   (4) "+a.disambiguate+" "+b.disambiguate);
        return 1;
    }
    if (a.year_suffix !== b.year_suffix) {
        //print("   (5) "+a.year_suffix+" "+b.year_suffix);
        return 1;
    }
    return 0;
};

CSL.cloneAmbigConfig = function (config, oldconfig) {
    var i, ilen, j, jlen, param;
    var ret = {};
    ret.names = [];
    ret.givens = [];
    ret.year_suffix = false;
    ret.disambiguate = false;
    for (i = 0, ilen = config.names.length; i < ilen; i += 1) {
        param = config.names[i];
        // Fixes update bug affecting plugins, without impacting
        // efficiency with update of large numbers of year-suffixed
        // items.
        ret.names[i] = param;
    }
    for (i  = 0, ilen = config.givens.length; i < ilen; i += 1) {
        param = [];
        for (j = 0, jlen = config.givens[i].length; j < jlen; j += 1) {
            // condition at line 312 of disambiguate.js protects against negative
            // values of j
            param.push(config.givens[i][j]);
        }
        ret.givens.push(param);
    }
    // XXXX Is this necessary at all?
    if (oldconfig) {
        ret.year_suffix = oldconfig.year_suffix;
        ret.disambiguate = oldconfig.disambiguate;
    } else {
        ret.year_suffix = config.year_suffix;
        ret.disambiguate = config.disambiguate;
    }
    return ret;
};

/**
 * Return current base configuration for disambiguation
 */
CSL.getAmbigConfig = function () {
    var config, ret;
    config = this.tmp.disambig_request;
    if (!config) {
        config = this.tmp.disambig_settings;
    }
    var ret = CSL.cloneAmbigConfig(config);
    return ret;
};

/**
 * Return max values for disambiguation
 */
CSL.getMaxVals = function () {
    return this.tmp.names_max.mystack.slice();
};

/**
 * Return min value for disambiguation
 */
CSL.getMinVal = function () {
    return this.tmp["et-al-min"];
};

/*global CSL: true */

/* For node execution pretty-printing (see below) */

/*
var INDENT = "";
*/

CSL.tokenExec = function (token, Item, item) {
    // Called on state object
    var next, maybenext, exec, debug;
    debug = false;
    next = token.next;
    maybenext = false;

    /* Pretty-print node executions */

    /*
    if (["if", "else-if", "else"].indexOf(token.name) === -1) {
        if (token.tokentype == 1) {
            INDENT = INDENT.slice(0, -2);
        }
    }
    this.sys.print(INDENT + "---> Token: " + token.name + " (" + token.tokentype + ") in " + this.tmp.area + ", " + this.output.current.mystack.length);
    if (["if", "else-if", "else"].indexOf(token.name) === -1) {
        if (token.tokentype == 0) {
            INDENT += "  ";
        }
    }
    */

    var record = function (result) {
        if (result) {
            this.tmp.jump.replace("succeed");
            return token.succeed;
        } else {
            this.tmp.jump.replace("fail");
            return token.fail;
        }
    };
    if (token.test) {
        next = record.call(this,token.test(Item, item));
    }
    for (var i=0,ilen=token.execs.length;i<ilen;i++) {
        exec = token.execs[i];
        maybenext = exec.call(token, this, Item, item);
        if (maybenext) {
            next = maybenext;
        }
    }
    //SNIP-START
    if (debug) {
        CSL.debug(token.name + " (" + token.tokentype + ") ---> done");
    }
    //SNIP-END
    return next;
};

/**
 * Macro expander.
 * <p>Called on the state object.</p>
 */
CSL.expandMacro = function (macro_key_token, target) {
    var mkey, macro_nodes, end_of_macro, func;

    mkey = macro_key_token.postponed_macro;

    var sort_direction = macro_key_token.strings.sort_direction;
    
    // Decorations and affixes are in wrapper applied in cs:text
    macro_key_token = new CSL.Token("group", CSL.START);
    
    var hasDate = false;
    var macroid = false;
    macro_nodes = this.cslXml.getNodesByName(this.cslXml.dataObj, 'macro', mkey);
    if (macro_nodes.length) {
        macroid = this.cslXml.getAttributeValue(macro_nodes[0],'cslid');
        hasDate = this.cslXml.getAttributeValue(macro_nodes[0], "macro-has-date");
    }
    if (hasDate) {
        mkey = mkey + "@" + this.build.current_default_locale;
        func = function (state) {
            if (state.tmp.extension) {
                state.tmp["doing-macro-with-date"] = true;
            }
        };
        macro_key_token.execs.push(func);
    }

    if (this.build.macro_stack.indexOf(mkey) > -1) {
        CSL.error("CSL processor error: call to macro \"" + mkey + "\" would cause an infinite loop");
    } else {
        this.build.macro_stack.push(mkey);
    }

    macro_key_token.cslid = macroid;

    if (CSL.MODULE_MACROS[mkey]) {
        macro_key_token.juris = mkey;
        this.opt.update_mode = CSL.POSITION;
    }
    // Macro group is treated as a real node in the style
    CSL.Node.group.build.call(macro_key_token, this, target, true);

    // Node does not exist in the CSL
    if (!this.cslXml.getNodeValue(macro_nodes)) {
        CSL.error("CSL style error: undefined macro \"" + mkey + "\"");
    }

    // Let's macro
    var mytarget = CSL.getMacroTarget.call(this, mkey);
    if (mytarget) {
        CSL.buildMacro.call(this, mytarget, macro_nodes);
        CSL.configureMacro.call(this, mytarget);
    }
    if (!this.build.extension) {
        var func = (function(macro_name) {
            return function (state, Item, item) {
                var next = 0;
                while (next < state.macros[macro_name].length) {
                    next = CSL.tokenExec.call(state, state.macros[macro_name][next], Item, item);
                }
            };
        }(mkey));
        var text_node = new CSL.Token("text", CSL.SINGLETON);
        text_node.execs.push(func);
        target.push(text_node);
    }

    // Decorations and affixes are in wrapper applied in cs:text
    end_of_macro = new CSL.Token("group", CSL.END);
    end_of_macro.strings.sort_direction = sort_direction;
    
    if (hasDate) {
        func = function (state) {
            if (state.tmp.extension) {
                state.tmp["doing-macro-with-date"] = false;
            }
        };
        end_of_macro.execs.push(func);
    }
    if (macro_key_token.juris) {
        end_of_macro.juris = mkey;
     }
    // Macro group is treated as a real node in the style
    CSL.Node.group.build.call(end_of_macro, this, target, true);

    this.build.macro_stack.pop();
};

CSL.getMacroTarget = function (mkey) {
    var mytarget = false;
    if (this.build.extension) {
        mytarget = this[this.build.root + this.build.extension].tokens;
    } else if (!this.macros[mkey]) {
        mytarget = [];
        this.macros[mkey] = mytarget;
    }
    return mytarget;
};

CSL.buildMacro = function (mytarget, macro_nodes) {
    var builder = CSL.makeBuilder(this, mytarget);
    var mynode;
    if ("undefined" === typeof macro_nodes.length) {
        mynode = macro_nodes;
    } else {
        mynode = macro_nodes[0];
    }
    builder(mynode);
};

CSL.configureMacro = function (mytarget) {
    if (!this.build.extension) {
        this.configureTokenList(mytarget);
    }
};


/**
 * Convert XML node to token.
 * <p>This is called on an XML node.  After extracting the name and attribute
 * information from the node, it performs three operations.  Attribute information
 * relating to output formatting is stored on the node as an array of tuples,
 * which fixes the sequence of execution of output functions to be invoked
 * in the next phase of processing.  Other attribute information is reduced
 * to functions, and is pushed into an array on the token in no particular
 * order, for later execution.  The element name is used as a key to
 * invoke the relevant <code>build</code> method of the target element.
 * Element methods are defined in {@link CSL.Node}.</p>
 * @param {Object} state  The state object returned by {@link CSL.Engine}.
 * @param {Int} tokentype  A CSL namespace constant (<code>CSL.START</code>,
 * <code>CSL.END</code> or <code>CSL.SINGLETON</code>.
 */
CSL.XmlToToken = function (state, tokentype, explicitTarget, var_stack) {
    var name, txt, attrfuncs, attributes, decorations, token, key, target;
    name = state.cslXml.nodename(this);
    //CSL.debug(tokentype + " : " + name);
    if (state.build.skip && state.build.skip !== name) {
        return;
    }
    if (!name) {
        txt = state.cslXml.content(this);
        if (txt) {
            state.build.text = txt;
        }
        return;
    }
    if (!CSL.Node[state.cslXml.nodename(this)]) {
        CSL.error("Undefined node name \"" + name + "\".");
    }
    attrfuncs = [];
    attributes = state.cslXml.attributes(this);
    decorations = CSL.setDecorations.call(this, state, attributes);
    token = new CSL.Token(name, tokentype);
    if (tokentype !== CSL.END || name === "if" || name === "else-if" || name === "layout") {
        //
        // xml: more xml stuff
        //
        for (var key in attributes) {
            if (attributes.hasOwnProperty(key)) {
                if (tokentype === CSL.END && key !== "@language" && key !== "@locale") {
                    continue;
                }
                if (attributes.hasOwnProperty(key)) {
                    if (CSL.Attributes[key]) {
                        try {
                            CSL.Attributes[key].call(token, state, "" + attributes[key]);
                        } catch (e) {
                            CSL.error(key + " attribute: " + e);
                        }
                    } else {
                        CSL.debug("warning: undefined attribute \""+key+"\" in style");
                    }
                }
            }
        }
        token.decorations = decorations;
        if (CSL.DATE_VARIABLES.indexOf(attributes['@variable']) > -1) {
            var_stack.push(token.variables);
        }
    } else if (tokentype === CSL.END && attributes['@variable']) {
        token.hasVariable = true;
        if (CSL.DATE_VARIABLES.indexOf(attributes['@variable']) > -1) {
            token.variables = var_stack.pop();
        }
    }
    //
    // !!!!!: eliminate diversion of tokens to separate
    // token list (formerly used for reading in macros
    // and terms).
    //
    if (explicitTarget) {
        target = explicitTarget;
    } else {
        target = state[state.build.area].tokens;
    }
    // True flags real nodes in the style
    CSL.Node[name].build.call(token, state, target, true);
};



/*global CSL: true */


CSL.DateParser = function () {

    /*
     * Fixed values
     */

    // jse imperial years
    var epochPairs = [
        ["\u660E\u6CBB", 1867],
        ["\u5927\u6B63", 1911],
        ["\u662D\u548C", 1925],
        ["\u5E73\u6210", 1988]
    ];

    // years by jse imperial epoch
    var epochYearByName = {};
    for (var i=0,ilen=epochPairs.length; i<ilen; i++) {
        var key = epochPairs[i][0];
        var val = epochPairs[i][1];
        epochYearByName[key] = val;
    }
    
    var epochMatchStrings = [];
    var epochMap = {};
    for (var i=0,ilen=epochPairs.length; i<ilen; i++) {
        var pair = epochPairs[i];
        var val = pair[0];
        epochMatchStrings.push(val);
        epochMap[pair[0]] = pair[1];
    }
    var epochMatchString = epochMatchStrings.join("|");

    // regular expression to trap year name and year
    // (splitter and matcher, to cope with ancient JS implementations)
    var epochSplitter = new RegExp("(?:" + epochMatchString + ")(?:[0-9]+)");
    var epochMatcher = new RegExp("(?:" + epochMatchString + ")(?:[0-9]+)", "g");

    // regular expression for month or day kanji label
    var kanjiMonthDay = /(\u6708|\u5E74)/g;

    // regular expression for year kanji label
    var kanjiYear = /\u65E5/g;

    // regular expression for double-width Japanese range marker
    var kanjiRange = /\u301c/g;

    // parsing regexps for normalized strings
    //   raw materials
    var yearLast = "(?:[?0-9]{1,2}%%NUMD%%){0,2}[?0-9]{4}(?![0-9])";
    var yearFirst = "[?0-9]{4}(?:%%NUMD%%[?0-9]{1,2}){0,2}(?![0-9])";
    var numberVal = "[?0-9]{1,3}";
    var rangeSeparator = "[%%DATED%%]";
    var fuzzyChar = "[?~]";
    var chars = "[^\-\/\~\?0-9]+";
    var rexString = "(" + yearFirst + "|" + yearLast + "|" + numberVal + "|" + rangeSeparator + "|" + fuzzyChar + "|" + chars + ")";
    //   composed regexps
    var rexDash = new RegExp(rexString.replace(/%%NUMD%%/g, "-").replace(/%%DATED%%/g, "-"));
    var rexDashSlash = new RegExp(rexString.replace(/%%NUMD%%/g, "-").replace(/%%DATED%%/g, "\/"));
    var rexSlashDash = new RegExp(rexString.replace(/%%NUMD%%/g, "\/").replace(/%%DATED%%/g, "-"));

    /*
     * Mutable values
     */

    // months
    var monthString = "january february march april may june july august september october november december spring summer fall winter spring summer";
    this.monthStrings = monthString.split(" ");

    /*
     * Configuration functions
     */

    this.setOrderDayMonth = function() {
        // preferred ordering for numeric dates
        this.monthGuess = 1;
        this.dayGuess = 0;
    };

    this.setOrderMonthDay = function() {
        // preferred ordering for numeric dates
        this.monthGuess = 0;
        this.dayGuess = 1;
    };

    this.resetDateParserMonths = function() {
        // Function to reset months to default.
        this.monthSets = [];
        for (var i=0,ilen=this.monthStrings.length; i<ilen; i++) {
            this.monthSets.push([this.monthStrings[i]]);
        }
        this.monthAbbrevs = [];
        for (var i=0,ilen=this.monthSets.length; i<ilen; i++) {
            this.monthAbbrevs.push([]);
            for (var j=0,jlen=this.monthSets[i].length; j<jlen; j++) {
                this.monthAbbrevs[i].push(this.monthSets[i][0].slice(0, 3));
            }
        }
        this.monthRexes = [];
        for (var i=0,ilen=this.monthAbbrevs.length; i<ilen; i++) {
            this.monthRexes.push(new RegExp("(?:" + this.monthAbbrevs[i].join("|") + ")"));
        }
    };

    this.addDateParserMonths = function(lst) {
        // Extend list of months with an additional set of month abbreviations,
        // extending strings as required to resolve ambiguities.

        // Normalize string to list
        if ("string" === typeof lst) {
            lst = lst.split(/\s+/);
        }

        // Check that there are twelve (or sixteen) to add
        if (lst.length !== 12 && lst.length !== 16) {
            CSL.debug("month [+season] list of "+lst.length+", expected 12 or 16. Ignoring.");
            return;
        }

        // Extend as necessary to resolve ambiguities
        // For each new month string ...
        for (var i=0,ilen=lst.length; i<ilen; i++) {
            var abbrevLength = null;
            var skip = false;
            var insert = 3;
            var extendedSets = {};
            for (var j=0,jlen=this.monthAbbrevs.length; j<jlen; j++) {
                extendedSets[j] = {};
                if (j === i) {
                    // Mark for skipping if same as an existing abbreviation of same month
                    for (var k=0,klen=this.monthAbbrevs[i].length; k<klen; k++) {
                        if (this.monthAbbrevs[i][k] === lst[i].slice(0, this.monthAbbrevs[i][k].length)) {
                            skip = true;
                            break;
                        }
                    }
                } else {
                    // Mark for extending if same as existing abbreviation of any expression of another month
                    for (var k=0,klen=this.monthAbbrevs[j].length; k<klen; k++) {
                        abbrevLength = this.monthAbbrevs[j][k].length;
                        if (this.monthAbbrevs[j][k] === lst[i].slice(0, abbrevLength)) {
                            while (this.monthSets[j][k].slice(0, abbrevLength) === lst[i].slice(0, abbrevLength)) {
                                // Abort when full length is hit, otherwise extend
                                if (abbrevLength > lst[i].length || abbrevLength > this.monthSets[j][k].length) {
                                    CSL.debug("unable to disambiguate month string in date parser: "+lst[i]);
                                    break;
                                } else {
                                    // Mark both new entry and existing abbrev for extension
                                    abbrevLength += 1;
                                }
                            }
                            insert = abbrevLength;
                            extendedSets[j][k] = abbrevLength;
                        }
                    }
                }
                for (var jKey in extendedSets) {
                    for (var kKey in extendedSets[jKey]) {
                        abbrevLength = extendedSets[jKey][kKey];
                        jKey = parseInt(jKey, 10);
                        kKey = parseInt(kKey, 10);
                        this.monthAbbrevs[jKey][kKey] = this.monthSets[jKey][kKey].slice(0, abbrevLength);
                    }
                }
            }
            // Insert here
            if (!skip) {
                this.monthSets[i].push(lst[i]);
                this.monthAbbrevs[i].push(lst[i].slice(0, insert));
            }
        }

        // Compose
        this.monthRexes = [];
        this.monthRexStrs = [];
        for (var i=0,ilen=this.monthAbbrevs.length; i<ilen; i++) {
            this.monthRexes.push(new RegExp("^(?:" + this.monthAbbrevs[i].join("|") + ")"));
            this.monthRexStrs.push("^(?:" + this.monthAbbrevs[i].join("|") + ")");
        }
        if (this.monthAbbrevs.length === 18) {
            for (var i=12,ilen=14; i<ilen; i++) {
                this.monthRexes[i+4] = new RegExp("^(?:" + this.monthAbbrevs[i].join("|") + ")");
                this.monthRexStrs[i+4] = "^(?:" + this.monthAbbrevs[i].join("|") + ")";
            }
        }
    };

    /*
     * Conversion functions
     */

    this.convertDateObjectToArray = function (thedate) {
        // Converts object in place and returns object
        thedate["date-parts"] = [];
        thedate["date-parts"].push([]);
        var slicelen = 0;
        var part;
        for (var i=0,ilen=3; i<ilen; i++) {
            part = ["year", "month", "day"][i];
            if (!thedate[part]) {
                break;
            }
            slicelen += 1;
            thedate["date-parts"][0].push(thedate[part]);
            delete thedate[part];
        }
        thedate["date-parts"].push([]);
        for (var i=0, ilen=slicelen; i<ilen; i++) {
            part = ["year_end", "month_end", "day_end"][i];
            if (!thedate[part]) {
                break;
            }
            thedate["date-parts"][1].push(thedate[part]);
            delete thedate[part];
        }
        if (thedate["date-parts"][0].length !== thedate["date-parts"][1].length) {
            thedate["date-parts"].pop();
        }
        return thedate;
    };

    // XXXX String output is currently unable to represent ranges
    this.convertDateObjectToString = function(thedate) {
        // Returns string
        var ret = [];
        for (var i = 0, ilen = 3; i < ilen; i += 1) {
            if (thedate[CSL.DATE_PARTS_ALL[i]]) {
                ret.push(thedate[CSL.DATE_PARTS_ALL[i]]);
            } else {
                break;
            }
        }
        return ret.join("-");
    };

    /*
     * Utility function
     */

    this._parseNumericDate = function (ret, delim, suff, txt) {
        if (!suff) {
            suff = "";
        }
        var lst = txt.split(delim);
        
        for (var i=0, ilen=lst.length; i<ilen; i++) {
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
        for (var i=0,ilen=lst.length; i<ilen; i++) {
            lst[i] = parseInt(lst[i], 10);
        }
        if (lst.length === 1 || (lst.length === 2 && !lst[1])) {
            ret[("month" + suff)] = "" + lst[0];
        } else if (lst.length === 2) {
            if (lst[this.monthGuess] > 12) {
                ret[("month" + suff)] = "" + lst[this.dayGuess];
                ret[("day" + suff)] = "" + lst[this.monthGuess];
            } else {
                ret[("month" + suff)] = "" + lst[this.monthGuess];
                ret[("day" + suff)] = "" + lst[this.dayGuess];
            }
        }
    };

    /*
     * Parsing functions
     */

    this.parseDateToObject = function (txt) {
        //
        // Normalize the format and the year if it's a Japanese date
        //
        var orig = txt;
        var slashPos = -1;
        var dashPos = -1;
        var yearIsNegative = false;
        var lst;
        if (txt) {
            // If string leads with a minus sign, strip and memo it.
            if (txt.slice(0, 1) === "-") {
                yearIsNegative = true;
                txt = txt.slice(1);
            }
            
            // If string is a number of 1 to 3 characters only, treat as year.
            if (txt.match(/^[0-9]{1,3}$/)) {
                while (txt.length < 4) {
                    txt = "0" + txt;
                }
            }
            
            // Normalize to string
            txt = "" + txt;
            // Remove things that look like times
            txt = txt.replace(/\s*[0-9]{2}:[0-9]{2}(?::[0-9]+)/,"");
            var m = txt.match(kanjiMonthDay);
            if (m) {
                txt = txt.replace(/\s+/g, "");
                txt = txt.replace(kanjiYear, "");
                txt = txt.replace(kanjiMonthDay, "-");
                txt = txt.replace(kanjiRange, "/");
                txt = txt.replace(/\-\//g, "/");
                txt = txt.replace(/-$/g,"");

                // Tortuous workaround for IE6
                var slst = txt.split(epochSplitter);
                lst = [];
                var mm = txt.match(epochMatcher);
                if (mm) {
                    var mmx = [];
                    for (var i=0,ilen=mm.length; i<ilen; i++) {
                        mmx = mmx.concat(mm[i].match(/([^0-9]+)([0-9]+)/).slice(1));
                    }
                    for (var i=0,ilen=slst.length; i<ilen; i++) {
                        lst.push(slst[i]);
                        if (i !== (ilen - 1)) {
                            // pos is undeclared, and multiplying by 2 here is insane.
                            var mmpos = (i * 2);
                            lst.push(mmx[mmpos]);
                            lst.push(mmx[mmpos + 1]);
                        }
                    }
                } else {
                    lst = slst;
                }
                // workaround duly applied, this now works
                for (var i=1,ilen=lst.length; i<ilen; i+=3) {
                    lst[i + 1] = epochMap[lst[i]] + parseInt(lst[i + 1], 10);
                    lst[i] = "";
                }
                txt = lst.join("");
                txt = txt.replace(/\s*-\s*$/, "").replace(/\s*-\s*\//, "/");
                //
                // normalize date and identify delimiters
                //
                txt = txt.replace(/\.\s*$/, "");

                // not sure what this is meant to do
                txt = txt.replace(/\.(?! )/, "");

                slashPos = txt.indexOf("/");
                dashPos = txt.indexOf("-");
            }
        }
        // drop punctuation from a.d., b.c.
        txt = txt.replace(/([A-Za-z])\./g, "$1");

        var number = "";
        var note = "";
        var thedate = {};
        var rangeDelim;
        var dateDelim;
        if (txt.slice(0, 1) === "\"" && txt.slice(-1) === "\"") {
            thedate.literal = txt.slice(1, -1);
            return thedate;
        }
        if (slashPos > -1 && dashPos > -1) {
            var slashCount = txt.split("/");
            if (slashCount.length > 3) {
                rangeDelim = "-";
                txt = txt.replace(/\_/g, "-");
                dateDelim = "/";
                lst = txt.split(rexSlashDash);
            } else {
                rangeDelim = "/";
                txt = txt.replace(/\_/g, "/");
                dateDelim = "-";
                lst = txt.split(rexDashSlash);
            }
        } else {
            txt = txt.replace(/\//g, "-");
            txt = txt.replace(/\_/g, "-");
            rangeDelim = "-";
            dateDelim = "-";
            lst = txt.split(rexDash);
        }
        var ret = [];
        for (var i=0,ilen=lst.length; i<ilen; i++) {
            var m = lst[i].match(/^\s*([\-\/]|[^\-\/\~\?0-9]+|[\-~?0-9]+)\s*$/);
            if (m) {
                ret.push(m[1]);
            }
        }
        //
        // Phase 2
        //
        var delimPos = ret.indexOf(rangeDelim);
        var delims = [];
        var isRange = false;
        if (delimPos > -1) {
            delims.push([0, delimPos]);
            delims.push([(delimPos + 1), ret.length]);
            isRange = true;
        } else {
            delims.push([0, ret.length]);
        }
        //
        // For each side of a range divide ...
        //
        var suff = "";
        
        for (var i=0,ilen=delims.length; i<ilen; i++) {
            var delim = delims[i];
            //
            // Process each element ...
            //
            var date = ret.slice(delim[0], delim[1]);
            outer: 
            for (var j=0,jlen=date.length; j<jlen; j++) {
                var element = date[j];
                //
                // If it's a numeric date, process it.
                //
                if (element.indexOf(dateDelim) > -1) {
                    this._parseNumericDate(thedate, dateDelim, suff, element);
                    continue;
                }
                //
                // If it's an obvious year, record it.
                //
                if (element.match(/[0-9]{4}/)) {
                    thedate[("year" + suff)] = element.replace(/^0*/, "");
                    continue;
                }
                //
                // If it's a fuzzy marker, record it.
                //
                if (element === "~" || element === "?" || element === "c" || element.match(/^cir/)) {
                    thedate.circa = true;
                }
                //
                // If it's a month, record it.
                //
                for (var k=0,klen=this.monthRexes.length; k<klen; k++) {
                    if (element.toLocaleLowerCase().match(this.monthRexes[k])) {
                        thedate[("month" + suff)] = "" + (parseInt(k, 10) + 1);
                        continue outer;
                    }
                }
                //
                // If it's a number, make a note of it
                //
                if (element.match(/^[0-9]+$/)) {
                    number = element;
                }
                //
                // If it's a BC or AD marker, make a year of
                // any note.  Separate, reverse the sign of the year
                // if it's BC.
                //
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
                //
                // If it's cruft, make a note of it
                //
                if (element.toLocaleLowerCase().match(/(?:mic|tri|hil|eas)/) && !thedate[("season" + suff)]) {
                    note = element;
                    continue;
                }
            }
            //
            // If at the end of the string there's still a note
            // hanging around, make a day of it.
            //
            if (number) {
                thedate[("day" + suff)] = number;
                number = "";
            }
            //
            // If at the end of the string there's cruft lying
            // around, and the season field is empty, put the
            // cruft there.
            //
            if (note && !thedate[("season" + suff)]) {
                thedate[("season" + suff)] = note.trim();
                note = "";
            }
            suff = "_end";
        }
        //
        // update any missing elements on each side of the divide
        // from the other
        //
        if (isRange) {
            for (var j=0,jlen=CSL.DATE_PARTS_ALL.length; j<jlen; j++) {
                var item = CSL.DATE_PARTS_ALL[j];
                if (thedate[item] && !thedate[(item + "_end")]) {
                    thedate[(item + "_end")] = thedate[item];
                } else if (!thedate[item] && thedate[(item + "_end")]) {
                    thedate[item] = thedate[(item + "_end")];
                }
            }
        }
        //
        // If there's no year, or if there only a year and a day, it's a failure; pass through the literal
        //
        if (!thedate.year || (thedate.year && thedate.day && !thedate.month)) {
            thedate = { "literal": orig };
        }
        var parts = ["year", "month", "day", "year_end", "month_end", "day_end"];
        for (var i=0,ilen=parts.length; i<ilen; i++) {
            var part = parts[i];
            if ("string" === typeof thedate[part] && thedate[part].match(/^[0-9]+$/)) {
                thedate[part] = parseInt(thedate[part], 10);
            }
            
        }
        if (yearIsNegative && Object.keys(thedate).indexOf("year") > -1) {
            thedate.year = (thedate.year * -1);
        }
        return thedate;
    };

    this.parseDateToArray = function(txt) {
        return this.convertDateObjectToArray(this.parseDateToObject(txt));            
    };

    this.parseDateToString = function(txt) {
        return this.convertDateObjectToString(this.parseDateToObject(txt));
    };
    
    this.parse = function(txt) {
        return this.parseDateToObject(txt);
    };
    
    /*

     * Setup
     */

    this.setOrderMonthDay();
    this.resetDateParserMonths();
};
CSL.DateParser = new CSL.DateParser();

/*global CSL: true */

CSL.Engine = function (sys, style, lang, forceLang) {
    var attrs, langspec;
    this.processor_version = CSL.PROCESSOR_VERSION;
    this.csl_version = "1.0";
    this.sys = sys;
    
    if (typeof Object.assign != 'function') {
        // Must be writable: true, enumerable: false, configurable: true
        Object.defineProperty(Object, "assign", {
            value: function assign(target) { // .length of function is 2
                'use strict';
                if (target == null) { // TypeError if undefined or null
                    throw new TypeError('Cannot convert undefined or null to object');
                }

                var to = Object(target);

                for (var index = 1; index < arguments.length; index++) {
                    var nextSource = arguments[index];

                    if (nextSource != null) { // Skip over if undefined or null
                        for (var nextKey in nextSource) {
                            // Avoid bugs when hasOwnProperty is shadowed
                            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                                to[nextKey] = nextSource[nextKey];
                            }
                        }
                    }
                }
                return to;
            },
            writable: true,
            configurable: true
        });
    }

    // XXX This may be excess code. Given the normalization performed on
    // XXX the output queue before variableWrapper() is run, a single
    // XXX space should be the most cruft that we ever see before a variable.
    if (sys.variableWrapper) {
        CSL.VARIABLE_WRAPPER_PREPUNCT_REX = new RegExp('^([' + [" "].concat(CSL.SWAPPING_PUNCTUATION).join("") + ']*)(.*)');
    }
    // XXXX This should be restored -- temporarily suspended for testing of JSON style support.
    if (CSL.retrieveStyleModule) {
        this.sys.retrieveStyleModule = CSL.retrieveStyleModule;
    }
    if (CSL.getAbbreviation) {
        this.sys.getAbbreviation = CSL.getAbbreviation;
    }
    if (this.sys.stringCompare) {
        CSL.stringCompare = this.sys.stringCompare;
    }
    this.sys.AbbreviationSegments = CSL.AbbreviationSegments;
    this.parallel = new CSL.Parallel(this);
    //this.parallel.use_parallels = true;

    this.transform = new CSL.Transform(this);
    // true or false
    this.setParseNames = function (val) {
        this.opt['parse-names'] = val;
    };
    
    this.opt = new CSL.Engine.Opt();
    this.tmp = new CSL.Engine.Tmp();
    this.build = new CSL.Engine.Build();
    this.fun = new CSL.Engine.Fun(this);

    this.configure = new CSL.Engine.Configure();
    // Build citation before citation_sort in order to pick up
    // state.opt.update_mode, needed it determine whether
    // a grouped sort should be performed.
    this.citation_sort = new CSL.Engine.CitationSort();
    this.bibliography_sort = new CSL.Engine.BibliographySort();
    this.citation = new CSL.Engine.Citation(this);
    this.bibliography = new CSL.Engine.Bibliography();
    this.intext = new CSL.Engine.InText();

    this.output = new CSL.Output.Queue(this);

    //this.render = new CSL.Render(this);
    //
    // This latter queue is used for formatting date chunks
    // before they are folded back into the main queue.
    //
    this.dateput = new CSL.Output.Queue(this);

    this.cslXml = CSL.setupXml(style);

    for (var i in CSL.SYS_OPTIONS) {
        var option = CSL.SYS_OPTIONS[i];
        if ("boolean" === typeof this.sys[option]) {
            this.opt.development_extensions[option] = this.sys[option];
        }
        
    }
    if (this.opt.development_extensions.uppercase_subtitles) {
        this.opt.development_extensions.main_title_from_short_title = true;
    }
    if (this.opt.development_extensions.csl_reverse_lookup_support) {
        this.build.cslNodeId = 0;
        this.setCslNodeIds = function(myxml, nodename) {
            var children = this.cslXml.children(myxml);
            this.cslXml.setAttribute(myxml, 'cslid', this.build.cslNodeId);
            this.opt.nodenames.push(nodename);
            this.build.cslNodeId += 1;
            for (var i = 0, ilen = this.cslXml.numberofnodes(children); i < ilen; i += 1) {
                nodename = this.cslXml.nodename(children[i]);
                if (nodename) {
                    this.setCslNodeIds(children[i], nodename);
                }
            }
        };
        this.setCslNodeIds(this.cslXml.dataObj, "style");
    }
    // Preprocessing ops for the XML input
    this.cslXml.addMissingNameNodes(this.cslXml.dataObj);
    this.cslXml.addInstitutionNodes(this.cslXml.dataObj);
    this.cslXml.insertPublisherAndPlace(this.cslXml.dataObj);
    this.cslXml.flagDateMacros(this.cslXml.dataObj);
    attrs = this.cslXml.attributes(this.cslXml.dataObj);
    if ("undefined" === typeof attrs["@sort-separator"]) {
        this.cslXml.setAttribute(this.cslXml.dataObj, "sort-separator", ", ");
    }
    // This setting does the right thing and seems not to be side-effects
    this.opt["initialize-with-hyphen"] = true;

    // Locale resolution
    //
    // (1) Get three locale strings 
    //     -- default-locale (stripped)
    //     -- processor-locale
    //     -- en_US
    
    this.setStyleAttributes();

    this.opt.xclass = this.cslXml.getAttributeValue(this.cslXml.dataObj, "class");
    this.opt["class"] = this.opt.xclass;
    this.opt.styleID = this.cslXml.getStyleId(this.cslXml.dataObj);
    this.opt.styleName = this.cslXml.getStyleId(this.cslXml.dataObj, true);

    if (this.opt.version.slice(0,4) === "1.1m") {
        this.opt.development_extensions.static_statute_locator = true;
        this.opt.development_extensions.handle_parallel_articles = true;
        this.opt.development_extensions.main_title_from_short_title = true;
        this.opt.development_extensions.expect_and_symbol_form = true;
        this.opt.development_extensions.require_explicit_legal_case_title_short = true;
        this.opt.development_extensions.force_jurisdiction = true;
    }
    // We seem to have two language specs flying around:
    //   this.opt["default-locale"], and this.opt.lang
    // Keeping them aligned for safety's sake, pending
    // eventual cleanup.
    if (lang) {
        lang = lang.replace("_", "-");
        lang = CSL.normalizeLocaleStr(lang);
    }
    if (this.opt["default-locale"][0]) {
        this.opt["default-locale"][0] = this.opt["default-locale"][0].replace("_", "-");
        this.opt["default-locale"][0] = CSL.normalizeLocaleStr(this.opt["default-locale"][0]);
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
    if (!this.opt["default-locale-sort"]) {
        this.opt["default-locale-sort"] = this.opt["default-locale"][0];
    }
    // Test processor against JS engine locale mess to find a field separator that works
    if ('dale|'.localeCompare('daleb', this.opt["default-locale-sort"]) > -1) {
        this.opt.sort_sep = "@";
    } else {
        this.opt.sort_sep = "|";
    }
    this.localeConfigure(langspec);

    // Build skip-word regexp
    function makeRegExp(lst) {
        var lst = lst.slice();
        var ret = new RegExp( "(?:(?:[?!:]*\\s+|-|^)(?:" + lst.join("|") + ")(?=[!?:]*\\s+|-|$))", "g");
        return ret;
    }
    this.locale[this.opt.lang].opts["skip-words-regexp"] = makeRegExp(this.locale[this.opt.lang].opts["skip-words"]);

    this.output.adjust = new CSL.Output.Queue.adjust(this.getOpt('punctuation-in-quote'));

    this.registry = new CSL.Registry(this);

    // XXX For modular jurisdiction support, parameterize buildTokenLists().
    // XXX Feed as arguments:
    // XXX * actual node to be walked (cslXml)
    // XXX * actual target array

    this.macros = {};

    this.build.area = "citation";
    var area_nodes = this.cslXml.getNodesByName(this.cslXml.dataObj, this.build.area);
    this.buildTokenLists(area_nodes, this[this.build.area].tokens);

    this.build.area = "bibliography";
    var area_nodes = this.cslXml.getNodesByName(this.cslXml.dataObj, this.build.area);
    this.buildTokenLists(area_nodes, this[this.build.area].tokens);

    this.build.area = "intext";
    var area_nodes = this.cslXml.getNodesByName(this.cslXml.dataObj, this.build.area);
    this.buildTokenLists(area_nodes, this[this.build.area].tokens);

    this.juris = {};

    this.configureTokenLists();

    this.disambiguate = new CSL.Disambiguation(this);

    this.splice_delimiter = false;

    //
    // date parser
    //
    this.fun.dateparser = CSL.DateParser;
    //
    // flip-flopper for inline markup
    //
    this.fun.flipflopper = new CSL.Util.FlipFlopper(this);
    //
    // utility functions for quotes
    //
    this.setCloseQuotesArray();
    //
    // configure ordinal numbers generator
    //
    this.fun.ordinalizer.init(this);
    //
    // configure long ordinal numbers generator
    //
    this.fun.long_ordinalizer.init(this);
    //
    // set up page mangler
    //
    this.fun.page_mangler = CSL.Util.PageRangeMangler.getFunction(this, "page");
    this.fun.year_mangler = CSL.Util.PageRangeMangler.getFunction(this, "year");

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

// Walker for preparsed XML input
CSL.makeBuilder = function (me, target) {
    var var_stack = [];
    var node_stack = [];
    function runStart (node) {
        node_stack.push(node);
        CSL.XmlToToken.call(node, me, CSL.START, target, var_stack);
    }
    function runEnd () {
        var node = node_stack.pop();
        CSL.XmlToToken.call(node, me, CSL.END, target, var_stack);
    }
    function runSingle (node) {
        CSL.XmlToToken.call(node, me, CSL.SINGLETON, target, var_stack);
    }
    function buildStyle (nodes, parent, node_stack) {
        if (!node_stack) {
            node_stack = [];
        }
        if (!nodes) {
            nodes = [];
        }
        if ("undefined" === typeof nodes.length) {
            nodes = [nodes];
        }
        for (var i=0; i<nodes.length; i++) {
            var node = nodes[i];
            if (me.cslXml.nodename(node) === null) {
                continue;
            }
            if (parent && me.cslXml.nodename(node) === "date") {
                CSL.Util.fixDateNode.call(me, parent, i, node);
                node = me.cslXml.children(parent)[i];
            }
            if (me.cslXml.numberofnodes(me.cslXml.children(node))) {
                runStart(node);
                buildStyle(me.cslXml.children(node), node, node_stack);
                runEnd();
            } else {
                runSingle(node);
            }
        }
    }
    return buildStyle;
};


CSL.Engine.prototype.buildTokenLists = function (area_nodes, target) {
    if (!this.cslXml.getNodeValue(area_nodes)) {
        return;
    }
    var builder = CSL.makeBuilder(this, target);
    var mynode;
    if ("undefined" === typeof area_nodes.length) {
        mynode = area_nodes;
    } else {
        mynode = area_nodes[0];
    }
    builder(mynode);
};


CSL.Engine.prototype.setStyleAttributes = function () {
    var dummy, attributes, attrname;
    // Protect against DOM engines that deliver a top-level document
    // (needed for createElement) that does not contain our top-level node.
    // 
    // The string coercion on this.cslXml.tagName addresses a bizarre
    // condition on the top-level node in jsdom running under node.js, in which:
    //   (1) typeof this.cslXml.tagName === "undefined"; and
    //   (2) !this.cslXml.tagName === false
    // Coerced, it becomes an empty string.
    var dummy = {};
    dummy.name = this.cslXml.nodename(this.cslXml.dataObj);
    attributes = this.cslXml.attributes(this.cslXml.dataObj);
    for (attrname in attributes) {
        if (attributes.hasOwnProperty(attrname)) {
            // attr = attributes[key];
            CSL.Attributes[attrname].call(dummy, this, attributes[attrname]);
        }
    }
};

CSL.Engine.prototype.getTerm = function (term, form, plural, gender, mode, forceDefaultLocale) {
    if (term && term.match(/[A-Z]/) && term === term.toUpperCase()) {
        CSL.debug("Warning: term key is in uppercase form: "+term);
        term = term.toLowerCase();
    }
    var lang;
    if (forceDefaultLocale) {
        lang = this.opt["default-locale"][0];
    } else {
        lang = this.opt.lang;
    }
    var ret = CSL.Engine.getField(CSL.LOOSE, this.locale[lang].terms, term, form, plural, gender);
    // XXXXX Temporary, until locale term is deployed in CSL.
    if (!ret && term === "range-delimiter") {
        ret = "\u2013";
    }
    // XXXXX Not so good if mode is neither strict nor tolerant ...
    if (typeof ret === "undefined") {
        if (mode === CSL.STRICT) {
            CSL.error("Error in getTerm: term \"" + term + "\" does not exist.");
        } else if (mode === CSL.TOLERANT) {
            ret = "";
        }
    }
    if (ret) {
        this.tmp.cite_renders_content = true;
    }
    return ret;
};

CSL.Engine.prototype.getDate = function (form, forceDefaultLocale) {
    var lang;
    if (forceDefaultLocale) {
        lang = this.opt["default-locale"];
    } else {
        lang = this.opt.lang;
    }
    if (this.locale[lang].dates[form]) {
        return this.locale[lang].dates[form];
    } else {
        return false;
    }
};

CSL.Engine.prototype.getOpt = function (arg) {
    if ("undefined" !== typeof this.locale[this.opt.lang].opts[arg]) {
        return this.locale[this.opt.lang].opts[arg];
    } else {
        return false;
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
            CSL.error("Error in getField: term \"" + term + "\" does not exist.");
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
    var area, pos, len;
    //for each (var area in ["citation", "citation_sort", "bibliography","bibliography_sort"]) {
    len = CSL.AREAS.length;
    for (pos = 0; pos < len; pos += 1) {
        //var ret = [];
        area = CSL.AREAS[pos];
        var tokens = this[area].tokens;
        this.configureTokenList(tokens);
    }
    this.version = CSL.version;
    return this.state;
};

CSL.Engine.prototype.configureTokenList = function (tokens) {
    var dateparts_master, token, dateparts, part, ppos, pppos, llen, lllen;
    dateparts_master = ["year", "month", "day"];
    llen = tokens.length - 1;
    for (ppos = llen; ppos > -1; ppos += -1) {
        token = tokens[ppos];
        //token.pos = ppos;
        //ret.push(token);
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
};

CSL.Engine.prototype.refetchItems = function (ids) {
    var ret = [];
    for (var i = 0, ilen = ids.length; i < ilen; i += 1) {
        ret.push(this.refetchItem("" + ids[i]));
    }
    return ret;
};

CSL.ITERATION = 0;

// Wrapper for sys.retrieveItem supplied by calling application.
// Adds experimental fields embedded in the note field for
// style development trial and testing purposes.
CSL.Engine.prototype.retrieveItem = function (id) {
    var Item, m, i;

    if (!this.tmp.loadedItemIDs[id]) {
        this.tmp.loadedItemIDs[id] = true;
    } else {
        return this.registry.refhash[id];
    }

    if (this.opt.development_extensions.normalize_lang_keys_to_lowercase &&
        "boolean" === typeof this.opt.development_extensions.normalize_lang_keys_to_lowercase) {
        // This is a hack. Should properly be configured by a processor method after build.
        for (var i=0,ilen=this.opt["default-locale"].length; i<ilen; i+=1) {
            this.opt["default-locale"][i] = this.opt["default-locale"][i].toLowerCase();
        }
        for (var i=0,ilen=this.opt["locale-translit"].length; i<ilen; i+=1) {
            this.opt["locale-translit"][i] = this.opt["locale-translit"][i].toLowerCase();
        }
        for (var i=0,ilen=this.opt["locale-translat"].length; i<ilen; i+=1) {
            this.opt["locale-translat"][i] = this.opt["locale-translat"][i].toLowerCase();
        }
        this.opt.development_extensions.normalize_lang_keys_to_lowercase = 100;
    }

    //Zotero.debug("XXX === ITERATION " + CSL.ITERATION + " "+ id +" ===");
    CSL.ITERATION += 1;

    Item = JSON.parse(JSON.stringify(this.sys.retrieveItem("" + id)));

    // Optionally normalize keys to lowercase()
    if (this.opt.development_extensions.normalize_lang_keys_to_lowercase) {
        if (Item.multi) {
            if (Item.multi._keys) {
                for (var field in Item.multi._keys) {
                    for (var key in Item.multi._keys[field]) {
                        if (key !== key.toLowerCase()) {
                            Item.multi._keys[field][key.toLowerCase()] = Item.multi._keys[field][key];
                            delete Item.multi._keys[field][key];
                        }
                    }
                }
            }
            if (Item.multi.main) {
                for (var field in Item.multi.main) {
                    Item.multi.main[field] = Item.multi.main[field].toLowerCase();
                }
            }
        }
        for (var i=0, ilen=CSL.NAME_VARIABLES.length; i>ilen; i+=1) {
            var ctype = CSL.NAME_VARIABLES[i];
            if (Item[ctype] && Item[ctype].multi) {
                for (var j=0, jlen=Item[ctype].length; j<jlen; j+=1) {
                    var creator = Item[ctype][j];
                    if (creator.multi) {
                        if (creator.multi._key) {
                            for (var key in creator.multi._key) {
                                if (key !== key.toLowerCase()) {
                                    creator.multi._key[key.toLowerCase()] = creator.multi._key[key];
                                    delete creator.multi._key[key];
                                }
                            }
                        }
                        if (creator.multi.main) {
                            creator.multi.main = creator.multi.main.toLowerCase();
                        }
                    }
                }
            }
        }
    }

    // Normalize language field into "language" and "language-original"
    if (Item.language && Item.language.match(/[><]/)) {
        // Attempt to split field in two
        var m = Item.language.match(/(.*?)([<>])(.*)/);
        if (m[2] === "<") {
            Item["language-name"] = m[1];
            Item["language-name-original"] = m[3];
        } else {
            Item["language-name"] = m[3];
            Item["language-name-original"] = m[1];
        }
        if (this.opt.multi_layout) {
            if (Item["language-name-original"]) {
                Item.language = Item["language-name-original"];
            }
        } else {
            if (Item["language-name"]) {
                Item.language = Item["language-name"];
            }
        }
    }

    if (Item.page) {
        Item["page-first"] = Item.page;
        var num = "" + Item.page;
        var m = num.split(/\s*(?:&|, |-|\u2013)\s*/);
        if (m[0].slice(-1) !== "\\") {
            Item["page-first"] = m[0];
        }
    }
    // Optional development extensions
    if (this.opt.development_extensions.field_hack && Item.note) {
        // false is for validFieldsForType (all conforming entries scrubbed when false)
        CSL.parseNoteFieldHacks(Item, false, this.opt.development_extensions.allow_field_hack_date_override);
    }
    // not including locator-date
    for (var key in Item) {
        if (CSL.DATE_VARIABLES.indexOf(key.replace(/^alt-/, "")) > -1) {
            var dateobj = Item[key];
            if (dateobj) {
                // raw date parsing is harmless, but can be disabled if desired
                if (this.opt.development_extensions.raw_date_parsing) {
                    if (dateobj.raw && (!dateobj["date-parts"] || dateobj["date-parts"].length === 0)) {
                        dateobj = this.fun.dateparser.parseDateToObject(dateobj.raw);
                    }
                }
                Item[key] = this.dateParseArray(dateobj);
            }
        }
    }
    if (this.opt.development_extensions.static_statute_locator) {
        if (Item.type && ["bill","gazette","legislation","regulation","treaty"].indexOf(Item.type) > -1) {
            
            var varname;
            var elements = ["type", "title", "jurisdiction", "genre", "volume", "container-title"];
            var legislation_id = [];
            for (var i = 0, ilen = elements.length; i < ilen; i += 1) {
                varname = elements[i];
				if (Item[varname]) {
					legislation_id.push(Item[varname]);
				}
			}
            elements = ["original-date", "issued"];
			for (var i = 0, ilen=elements.length; i < ilen; i += 1) {
                varname = elements[i];
				if (Item[varname] && Item[varname].year) {
					var value = Item[varname].year;
					legislation_id.push(value);
					break;
				}
			}
			Item.legislation_id = legislation_id.join("::");
        }
    }
    // For authority to name shape in legal styles
    if (this.opt.development_extensions.force_jurisdiction) {
        if ("string" === typeof Item.authority) {
            Item.authority = [
                {
                    literal: Item.authority,
                    multi: {
                        _key: {}
                    }
                }
            ];
            if (Item.multi && Item.multi._keys && Item.multi._keys.authority) {
                Item.authority[0].multi._key = {};
                for (var key in Item.multi._keys.authority) {
                    Item.authority[0].multi._key[key] = {
                        literal: Item.multi._keys.authority[key]
                    };
                }
            }
        }
    }
    // Add getAbbreviation() call for title-short and container-title-short
    if (!Item["title-short"]) {
        Item["title-short"] = Item.shortTitle;
    }
    // Add support for main_title_from_short_title
    if (this.opt.development_extensions.main_title_from_short_title) {
        var narrowSpaceLocale = this.opt["default-locale"][0].slice(0, 2).toLowerCase() === "fr";
        CSL.extractTitleAndSubtitle.call(this, Item, narrowSpaceLocale);
    }
    var isLegalType = ["bill","legal_case","legislation","gazette","regulation"].indexOf(Item.type) > -1;
    if (this.opt.development_extensions.force_jurisdiction && isLegalType) {
        if (!Item.jurisdiction) {
            Item.jurisdiction = "us";
        }
    }
    var normalizedKey;
    if (!isLegalType && Item.title && this.sys.getAbbreviation) {
        var noHints = false;
        if (!Item.jurisdiction) {
            noHints = true;
        }
        if (this.sys.normalizeAbbrevsKey) {
            normalizedKey = this.sys.normalizeAbbrevsKey(Item.title);
        } else {
            normalizedKey = Item.title;
        }
        var jurisdiction = this.transform.loadAbbreviation(Item.jurisdiction, "title", normalizedKey, Item.type);
        if (this.transform.abbrevs[jurisdiction].title) {
            if (this.transform.abbrevs[jurisdiction].title[normalizedKey]) {
                Item["title-short"] = this.transform.abbrevs[jurisdiction].title[normalizedKey];
            }
        }
    }
    if (!Item["container-title-short"]) {
        Item["container-title-short"] = Item.journalAbbreviation;
    }
    if (Item["container-title"] && this.sys.getAbbreviation) {
        if (this.sys.normalizeAbbrevsKey) {
            normalizedKey = this.sys.normalizeAbbrevsKey(Item["container-title"]);
        } else {
            normalizedKey = Item["container-title"];
        }
        var jurisdiction = this.transform.loadAbbreviation(Item.jurisdiction, "container-title", normalizedKey);
        if (this.transform.abbrevs[jurisdiction]["container-title"]) {
            if (this.transform.abbrevs[jurisdiction]["container-title"][normalizedKey]) {
                Item["container-title-short"] = this.transform.abbrevs[jurisdiction]["container-title"][normalizedKey];
            }
        }
    }
    if (Item.jurisdiction) {
        Item.country = Item.jurisdiction.split(":")[0];
    }
    if (this.registry.refhash[id]) {
        if (JSON.stringify(this.registry.refhash[id]) != JSON.stringify(Item)) {
            for (var key in this.registry.refhash[id]) {
                delete this.registry.refhash[id][key];
            }
            this.tmp.taintedItemIDs[Item.id] = true;
            Object.assign(this.registry.refhash[id], Item);
        }
    } else {
        this.registry.refhash[id] = Item;
    }
    return this.registry.refhash[id];
};

CSL.Engine.prototype.refetchItem = function (id) {
    return this.registry.refhash[id];
};

CSL.Engine.prototype.refetchItem = function (id) {
    return this.registry.refhash[id];
}

// Executed during style build
CSL.Engine.prototype.setOpt = function (token, name, value) {
    if (token.name === "style" || token.name === "cslstyle") {
        this.opt.inheritedAttributes[name] = value;
        this.citation.opt.inheritedAttributes[name] = value;
        this.bibliography.opt.inheritedAttributes[name] = value;
    } else if (["citation", "bibliography"].indexOf(token.name) > -1) {
        this[token.name].opt.inheritedAttributes[name] = value;
    } else {
        token.strings[name] = value;
    }
};

// Executed at runtime, since macros can occur in the context of citation or bibliography
CSL.Engine.prototype.inheritOpt = function (token, attrname, parentname, defaultValue) {
    if ("undefined" !== typeof token.strings[attrname]) {
        return token.strings[attrname];
    } else {
        var parentValue = this[this.tmp.root].opt.inheritedAttributes[parentname ? parentname : attrname];
        if ("undefined" !== typeof parentValue) {
            return parentValue;
        } else {
            return defaultValue;
        }
    }
};

CSL.Engine.prototype.remapSectionVariable = function (inputList) {
    // We have items with a value in the section field (on Item) that must
    // be mapped to the locator field (on item). We simply prepend it as
    // a string here, and handle all parsing of the resulting string
    // in processNumber(). Plurals and numeric are set in processNumber().
    
    // Because the target is in the citation item (lowercase), the
    // remapping cannot take place when the Item data is received.
    // Citation provides a list of Item/item pairs, hence the iteration
    // used here.
    for (var i = 0, ilen = inputList.length; i < ilen; i += 1) {
        var Item = inputList[i][0];
        var item = inputList[i][1];

        if (["bill","gazette","legislation","regulation","treaty"].indexOf(Item.type) > -1) {
             // If a locator value exists, then
            //   (a) Leave be an overriding label at the start of the locator field, defaulting to label value
            if (item.locator) {
                item.locator = item.locator.trim();
                var m = item.locator.match(CSL.STATUTE_SUBDIV_PLAIN_REGEX_FRONT);
                if (!m) {
                    if (item.label) {
                        item.locator = CSL.STATUTE_SUBDIV_STRINGS_REVERSE[item.label] + " " + item.locator;
                    } else {
                        item.locator = "p. " + item.locator;
                    }
                }
            }
            // If a section value exists, then
            //   (a) Apply an overriding label at the start of the section field, defaulting to sec.
            var sectionMasterLabel = null;
            if (Item.section) {
                Item.section = Item.section.trim();
                var m = Item.section.match(CSL.STATUTE_SUBDIV_PLAIN_REGEX_FRONT);
                if (!m) {
                    Item.section = "sec. " + Item.section;
                    sectionMasterLabel = "sec.";
                } else {
                    sectionMasterLabel = m[0].trim();
                }
            }
            // If section is nil, then
            //   (a) Do nothing
            if (Item.section) {
            // If section exists and locator is nil
            //   (a) Set section string in locator field
                if (!item.locator) {
                    item.locator = Item.section;
                } else {
            // If both section and locator exist, then
            //   (a) If locator starts with p., remove p., merge with space or no-space, and set in locator field
            //   (b) If locator starts with non-p., prepend section value to locator with space, and set in locator field
                    var m = item.locator.match(/^([^ ]*)\s*(.*)/);
                    var space = " ";
                    if (m) {
                        if (m[1] === "p." && sectionMasterLabel !== "p.") {
                            item.locator = m[2];
                        }
                        if (["[", "(", ".", ",", ";", ":", "?"].indexOf(item.locator.slice(0, 1)) > -1) {
                            space = "";
                        }
                    } else {
                       space = ""; 
                    }
                    item.locator = Item.section + space + item.locator;
                }
                //Item.section = "";
            }
            item.label = "";
            // And that's it. Pre-parse complete.
        }
    }
};


CSL.Engine.prototype.setNumberLabels = function (Item) {
     if (Item.number
        && ["bill", "gazette", "legislation","regulation","treaty"].indexOf(Item.type) > -1
        && this.opt.development_extensions.static_statute_locator
        && !this.tmp.shadow_numbers["number"]) {

        this.tmp.shadow_numbers["number"] = {};
        this.tmp.shadow_numbers["number"].values = [];
        this.tmp.shadow_numbers["number"].plural = 0;
        this.tmp.shadow_numbers["number"].numeric = false;
        this.tmp.shadow_numbers["number"].label = false;
        
        // Labels embedded in number variable
        var value = "" + Item.number;
        value = value.split("\\").join("");
        // Get first word, parse out labels only if it parses
        var firstword = value.split(/\s+/)[0];
        var firstlabel = CSL.STATUTE_SUBDIV_STRINGS[firstword];
        if (firstlabel) {
            // Get list and match
            var splt = value.split(CSL.STATUTE_SUBDIV_PLAIN_REGEX);
            if (splt.length > 1) {
                // Convert matches to localized form
                var lst = [];
                for (var j=1, jlen=splt.length; j < jlen; j += 1) {
                    lst.push(splt[j].replace(/\s*$/, "").replace(/^\s*/, ""));
                }
                // Preemptively save to shadow_numbers
                value = lst.join(" ");
            } else {
                value = splt[0];
            }
            this.tmp.shadow_numbers["number"].label = firstlabel;
            this.tmp.shadow_numbers["number"].values.push(["Blob", value, false]);
            this.tmp.shadow_numbers["number"].numeric = false;
        } else {
            this.tmp.shadow_numbers["number"].values.push(["Blob", value, false]);
            this.tmp.shadow_numbers["number"].numeric = true;
        }
    }
};

/*global CSL: true */

CSL.substituteOne = function (template) {
    return function (state, list) {
        if (!list) {
            return "";
        } else {
            // ("string" === typeof list)
            return template.replace("%%STRING%%", list);
        }
    };
};


/**
 * Two-tiered substitutions gadget.
 * <p>This is used for
 * options like (now defunct) "font-family", where the option value
 * cannot be determined until the attribute is processed.
 * Need for this function might be reviewed at some point ...</p>
 * @param {String} template A template containing
 * <code>%%STRING%%</code> and <code>%%PARAM%%</code>
 * placeholders.  See {@link CSL.Output.Formats.html} for
 * examples.
 */
CSL.substituteTwo = function (template) {
    return function (param) {
        var template2 = template.replace("%%PARAM%%", param);
        return function (state, list) {
            if (!list) {
                return "";
            } else {
                //("string" === typeof list){
                return template2.replace("%%STRING%%", list);
            }
        };
    };
};

/**
 * Generate string functions for designated output mode.
 * <p>Only "html" (the default) is supported at present.</p>
 * @param {String} mode Either "html" or "rtf", eventually.
 */
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
                CSL.error("Bad " + mode + " config entry for " + param + ": " + val);
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


/**
 * Generate a separate list of formatting attributes.
 * <p>This generates a list of tuples containing attribute
 * information relevant to output formatting, in the order
 * fixed in the constant {@link CSL.FORMAT_KEY_SEQUENCE}.
 * This function is called during {@link CSL.Core.Build}.
 * Formatting hints are distilled to functions
 * later, in the second compilation pass ({@link CSL.Core.Configure}).</p>
 * @param {Object} state The state object returned by
 * {@link CSL.Engine}.
 * @param {Object} attributes The hash object containing
 * the attributes and values extracted from an XML node.
 */
CSL.setDecorations = function (state, attributes) {
    var ret, key, pos;
    // This applies a fixed processing sequence
    ret = [];
    for (pos in CSL.FORMAT_KEY_SEQUENCE) {
        if (true) {
            var key = CSL.FORMAT_KEY_SEQUENCE[pos];
            if (attributes[key]) {
                ret.push([key, attributes[key]]);
                delete attributes[key];
            }
        }
    }
    return ret;
};

CSL.Doppeler = function(rexStr, stringMangler) {
    var matchRex = new RegExp("(" + rexStr + ")", "g");
    var splitRex = new RegExp(rexStr, "g");
    this.split = function (str) {
        // Normalize markup
        if (stringMangler) {
            str = stringMangler(str);
        }
        var match = str.match(matchRex);
        if (!match) {
            return {
                tags: [],
                strings: [str]
            };
        }
        var split = str.split(splitRex);
        for (var i=match.length-1; i> -1; i--) {
            if (typeof match[i] === "number") {
                match[i] = "";
            }
            var tag = match[i];
            if (tag === "\'" && split[i+1].length > 0) {
                // Fixes https://forums.zotero.org/discussion/comment/294317
                split[i+1] = match[i] + split[i+1];
                match[i] = "";
            }
        }
        return {
            tags: match,
            strings: split,
            origStrings: split.slice()
        };
    };
    this.join = function (obj) {
        var lst = obj.strings.slice(-1);
        for (var i=obj.tags.length-1; i>-1; i--) {
            lst.push(obj.tags[i]);
            lst.push(obj.strings[i]);
        }
        lst.reverse();
        return lst.join("");
    };
};

CSL.Engine.prototype.normalDecorIsOrphan = function (blob, params) {
    //print("params: "+JSON.stringify(params));
    if (params[1] === "normal") {
        var use_param = false;
        var all_the_decor;
        if (this.tmp.area === "citation") {
            all_the_decor = [this.citation.opt.layout_decorations].concat(blob.alldecor);
        } else {
            all_the_decor = blob.alldecor;
        }
        for (var k = all_the_decor.length - 1; k > -1; k += -1) {
            //print("  all decor: "+JSON.stringify(all_the_decor[k]));
            for (var n = all_the_decor[k].length - 1; n > -1; n += -1) {
                //print("  superior param"+n+": "+all_the_decor[k][n][0]);
                if (all_the_decor[k][n][0] === params[0]) {
                    //print("  HIT!");
                    if (all_the_decor[k][n][1] !== "normal") {
                        use_param = true;
                    }
                }
            }
        }
        if (!use_param) {
            return true;
        }
    }
    return false;
};

/*global CSL: true */


CSL.Engine.prototype.getCitationLabel = function (Item) {
    var label = "";
    var params = this.getTrigraphParams();
    var config = params[0];
    var myname = this.getTerm("reference", "short", 0);
    if ("undefined" === typeof myname) {
        myname = "reference";
    }
    myname = myname.replace(".", "");
    myname = myname.slice(0, 1).toUpperCase() + myname.slice(1);
    for (var i = 0, ilen = CSL.NAME_VARIABLES.length; i < ilen; i += 1) {
        var n = CSL.NAME_VARIABLES[i];
        if (Item[n]) {
            var names = Item[n];
            if (names.length > params.length) {
                config = params[params.length - 1];
            } else {
                config = params[names.length - 1];
            }
            for (var j = 0, jlen = names.length; j < jlen; j += 1) {
                if (j === config.authors.length) {
                    break;
                }
                var res = this.nameOutput.getName(names[j], "locale-translit", true);
                var name = res.name;
                if (name && name.family) {
                    myname = name.family;
                    myname = myname.replace(/^([ \'\u2019a-z]+\s+)/, "");

                } else if (name && name.literal) {
                    myname = name.literal;
                }
                var m = myname.toLowerCase().match(/^(a\s+|the\s+|an\s+)/);
                if (m) {
                    myname = myname.slice(m[1].length);
                }
                myname = myname.replace(CSL.ROMANESQUE_NOT_REGEXP, "");
                if (!myname) {
                    break;
                }
                myname = myname.slice(0, config.authors[j]);
                if (myname.length > 1) {
                    myname = myname.slice(0, 1).toUpperCase() + myname.slice(1).toLowerCase();
                } else if (myname.length === 1) {
                    myname = myname.toUpperCase();
                }
                label += myname;
            }
            break;
        }
    }
    if (!label) {
        // Try for something using title
        if (Item.title) {
            var skipWords = this.locale[this.opt.lang].opts["skip-words"];
            var lst = Item.title.split(/\s+/);
            for (var i = lst.length - 1; i > -1; i--) {
                if (skipWords.indexOf(lst[i]) > -1) {
                    lst = lst.slice(0, i).concat(lst.slice(i + 1));
                }
            }
            var str = lst.join('');
            str = str.slice(0, params[0].authors[0]);
            if (str.length > 1) {
                str = str.slice(0, 1).toUpperCase() + str.slice(1).toLowerCase();
            } else if (str.length === 1) {
                str = str.toUpperCase();
            }
            label = str;
        }
    }
    var year = "0000";
    if (Item.issued) {
        if (Item.issued.year) {
            year = "" + Item.issued.year;
        }
    }
    year = year.slice((config.year * -1));
    label = label + year;
    return label;
};

CSL.Engine.prototype.getTrigraphParams = function () {
    var params = [];
    var ilst = this.opt.trigraph.split(":");
    if (!this.opt.trigraph || this.opt.trigraph.slice(0,1) !== "A") {
        CSL.error("Bad trigraph definition: "+this.opt.trigraph);
    }
    for (var i = 0, ilen = ilst.length; i < ilen; i += 1) {
        var str = ilst[i];
        var config = {authors:[], year:0};
        for (var j = 0, jlen = str.length; j < jlen; j += 1) {
            switch (str.slice(j,j+1)) {
            case "A":
                config.authors.push(1);
                break;
            case "a":
                config.authors[config.authors.length - 1] += 1;
                break;
            case "0":
                config.year += 1;
                break;
            default:
                CSL.error("Invalid character in trigraph definition: "+this.opt.trigraph);
            }
        }
        params.push(config);
    }
    return params;
};

/*global CSL: true */

CSL.Engine.prototype.setOutputFormat = function (mode) {
    this.opt.mode = mode;
    this.fun.decorate = CSL.Mode(mode);
    if (!this.output[mode]) {
        this.output[mode] = {};
        this.output[mode].tmp = {};
    }
};

CSL.Engine.prototype.getSortFunc = function () {
    return function (a,b) {
        a = a.split("-");
        b = b.split("-");
        if (a.length < b.length) {
            return 1;
        } else if (a.length > b.length) {
            return -1;
        } else {
            a = a.slice(-1)[0];
            b = b.slice(-1)[0];
            if (a.length < b.length) {
                return 1;
            } else if (a.length > b.length) {
                return -1;
            } else {
                return 0;
            }
        }
    };
};

CSL.Engine.prototype.setLangTagsForCslSort = function (tags) {
    var i, ilen;
    if (tags) {
        this.opt['locale-sort'] = [];
        for (i = 0, ilen = tags.length; i < ilen; i += 1) {
            this.opt['locale-sort'].push(tags[i]);
        }
    }
    this.opt['locale-sort'].sort(this.getSortFunc());
};
    
CSL.Engine.prototype.setLangTagsForCslTransliteration = function (tags) {
    var i, ilen;
    this.opt['locale-translit'] = [];
    if (tags) {
        for (i = 0, ilen = tags.length; i < ilen; i += 1) {
            this.opt['locale-translit'].push(tags[i]);
        }
    }
    this.opt['locale-translit'].sort(this.getSortFunc());
};
    
CSL.Engine.prototype.setLangTagsForCslTranslation = function (tags) {
    var i, ilen;
    this.opt['locale-translat'] = [];
    if (tags) {
        for (i = 0, ilen = tags.length; i < ilen; i += 1) {
            this.opt['locale-translat'].push(tags[i]);
        }
    }
    this.opt['locale-translat'].sort(this.getSortFunc());
};

CSL.Engine.prototype.setLangPrefsForCites = function (obj, conv) {
    var opt = this.opt['cite-lang-prefs'];
    if (!conv) {
        conv = function (key) {
            return key.toLowerCase();
        };
    }
    var segments = ['Persons', 'Institutions', 'Titles', 'Journals', 'Publishers', 'Places'];
    // Set values in place
    for (var i = 0, ilen = segments.length; i < ilen; i += 1) {
        var clientSegment = conv(segments[i]);
        var citeprocSegment = segments[i].toLowerCase();
        if (!obj[clientSegment]) {
            continue;
        }
        //
        // Normalize the sequence of secondary and tertiary
        // in the provided obj segment list.
        //
        var supplements = [];
        while (obj[clientSegment].length > 1) {
            supplements.push(obj[clientSegment].pop());
        }
        var sortval = {orig:1,translit:2,translat:3};
        if (supplements.length === 2 && sortval[supplements[0]] < sortval[supplements[1]]) {
            supplements.reverse();
        }
        while (supplements.length) {
            obj[clientSegment].push(supplements.pop());
        }
        //
        // normalization done.
        //
        var lst = opt[citeprocSegment];
        while (lst.length) {
            lst.pop();
        }
        for (var j = 0, jlen = obj[clientSegment].length; j < jlen; j += 1) {
            lst.push(obj[clientSegment][j]);
        }
    }
};

CSL.Engine.prototype.setLangPrefsForCiteAffixes = function (affixList) {
    if (affixList && affixList.length === 48) {
        var affixes = this.opt.citeAffixes;
        var count = 0;
        var settings = ["persons", "institutions", "titles", "journals", "publishers", "places"];
        var forms = ["translit", "orig", "translit", "translat"];
        var value;
        for (var i = 0, ilen = settings.length; i < ilen; i += 1) {
            for (var j = 0, jlen = forms.length; j < jlen; j += 1) {
                value = "";
                if ((count % 8) === 4) {
                    if (!affixes[settings[i]]["locale-"+forms[j]].prefix
                        && !affixes[settings[i]]["locale-"+forms[j]].suffix) {

                        value = affixList[count] ? affixList[count] : "";
                        affixes[settings[i]]["locale-" + forms[j]].prefix = value;
                        value = affixList[count] ? affixList[count + 1] : "";
                        affixes[settings[i]]["locale-" + forms[j]].suffix = value;
                    }
                } else {
                    value = affixList[count] ? affixList[count] : "";
                    affixes[settings[i]]["locale-" + forms[j]].prefix = value;
                    value = affixList[count] ? affixList[count + 1] : "";
                    affixes[settings[i]]["locale-" + forms[j]].suffix = value;
                }
                count += 2;
            }
        }
        this.opt.citeAffixes = affixes;
    }
};

CSL.Engine.prototype.setAutoVietnameseNamesOption = function (arg) {
    if (arg) {
        this.opt["auto-vietnamese-names"] = true;
    } else {
        this.opt["auto-vietnamese-names"] = false;
    }
};

CSL.Engine.prototype.setAbbreviations = function (arg) {
    if (this.sys.setAbbreviations) {
        this.sys.setAbbreviations(arg);
    }
};

CSL.Engine.prototype.setSuppressTrailingPunctuation = function (arg) {
    this.citation.opt.suppressTrailingPunctuation = !!arg;
};

/*global CSL: true */

CSL.Output = {};
/**
 * Output queue object.
 * @class
 */
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

// XXX This works, but causes a mismatch in api_cite
// Could insert a placeholder
// Better to have a function that spits out an independent blob.
// Is that possible though?
// Okay. Use queue.append() with fake_queue instead.
CSL.Output.Queue.prototype.pop = function () {
    // For some reason, state.output.current.value() here can be an array, 
    // not a blob ... ?
    var drip = this.current.value();
    if (drip.length) {
        return drip.pop();
    } else {
        return drip.blobs.pop();
    }
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
        var key = "";
        for (var key in base_token.strings) {
            if (base_token.strings.hasOwnProperty(key)) {
                ret.strings[key] = base_token.strings[key];
            }
        }
        for (var key in modifier_token.strings) {
            if (modifier_token.strings.hasOwnProperty(key)) {
                ret.strings[key] = modifier_token.strings[key];
            }
        }
        ret.decorations = base_token.decorations.concat(modifier_token.decorations);
    }
    return ret;
};

// Store a new output format token based on another
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

//
// newFormat adds a new bundle of formatting tokens to
// the queue's internal stack of such bundles
CSL.Output.Queue.prototype.pushFormats = function (tokenstore) {
    if (!tokenstore) {
        tokenstore = {};
    }
    tokenstore.empty = this.empty;
    this.formats.push(tokenstore);
};


CSL.Output.Queue.prototype.popFormats = function () {
    this.formats.pop();
};

CSL.Output.Queue.prototype.startTag = function (name, token) {
    var tokenstore = {};
    if (this.state.tmp["doing-macro-with-date"] && this.state.tmp.extension) {
        token = this.empty;
        name = "empty";
    }
    tokenstore[name] = token;
    this.pushFormats(tokenstore);
    this.openLevel(name);
};

CSL.Output.Queue.prototype.endTag = function (name) {
    this.closeLevel(name);
    this.popFormats();
};

//
// newlevel adds a new blob object to the end of the current
// list, and adjusts the current pointer so that subsequent
// appends are made to blob list of the new object.

CSL.Output.Queue.prototype.openLevel = function (token) {
    var blob, curr;
    if ("object" === typeof token) {
        // delimiter, prefix, suffix, decorations from token
        blob = new CSL.Blob(undefined, token);
    } else if ("undefined" === typeof token) {
        blob = new CSL.Blob(undefined, this.formats.value().empty, "empty");
    } else {
        if (!this.formats.value() || !this.formats.value()[token]) {
            CSL.error("CSL processor error: call to nonexistent format token \"" + token + "\"");
        }
        // delimiter, prefix, suffix, decorations from token
        blob = new CSL.Blob(undefined, this.formats.value()[token], token);
    }
    curr = this.current.value();
    if (!this.state.tmp.just_looking && this.checkNestedBrace) {
        blob.strings.prefix = this.checkNestedBrace.update(blob.strings.prefix);
    }
    curr.push(blob);
    this.current.push(blob);
};

/**
 * "merge" used to be real complicated, now it's real simple.
 */
CSL.Output.Queue.prototype.closeLevel = function (name) {
    // CLEANUP: Okay, so this.current.value() holds the blob at the
    // end of the current list.  This is wrong.  It should
    // be the parent, so that we have  the choice of reading
    // the affixes and decorations, or appending to its
    // content.  The code that manipulates blobs will be
    // much simpler that way.
    if (name && name !== this.current.value().levelname) {
        CSL.error("Level mismatch error:  wanted " + name + " but found " + this.current.value().levelname);
    }
    var blob = this.current.pop();
    if (!this.state.tmp.just_looking && this.checkNestedBrace) {
        blob.strings.suffix = this.checkNestedBrace.update(blob.strings.suffix);
    }
};

//
// append does the same thing as newlevel, except
// that the blob it pushes has text content,
// and the current pointer is not moved after the push.

CSL.Output.Queue.prototype.append = function (str, tokname, notSerious, ignorePredecessor, noStripPeriods) {
    var token, blob, curr;
    var useblob = true;
    if (notSerious) {
        ignorePredecessor = true;
    }
    // XXXXX Nasty workaround, but still an improvement
    // over the reverse calls to the cs:date node build
    // function that we had before.
    if (this.state.tmp["doing-macro-with-date"] && !notSerious) {
        if (tokname !== "macro-with-date") {
            return false;
        }
        if (tokname === "macro-with-date") {
            tokname = "empty";
        }
    }
    if ("undefined" === typeof str) {
        return false;
    }
    if ("number" === typeof str) {
        str = "" + str;
    }
    if (!notSerious 
        && this.state.tmp.element_trace 
        && this.state.tmp.element_trace.value() === "suppress-me") {
        
        return false;
    }
    blob = false;
    if (!tokname) {
        token = this.formats.value().empty;
    } else if (tokname === "literal") {
        token = true;
        useblob = false;
    } else if ("string" === typeof tokname) {
        token = this.formats.value()[tokname];
    } else {
        token = tokname;
    }
    if (!token) {
        CSL.error("CSL processor error: unknown format token name: " + tokname);
    }
    // Unset delimiters must be left undefined until they reach the queue
    // in order to discriminate unset from explicitly empty delimiters
    // when inheriting a default value from a superior node. [??? really ???]
    if (token.strings && "undefined" === typeof token.strings.delimiter) {
        token.strings.delimiter = "";
    }
    if ("string" === typeof str && str.length) {

        // Source (;?!»«): http://en.wikipedia.org/wiki/Space_(punctuation)#Breaking_and_non-breaking_spaces
        // Source (:): http://forums.zotero.org/discussion/4933/localized-quotes/#Comment_88384
        str = str.replace(/ ([:;?!\u00bb])/g, "\u202f$1").replace(/\u00ab /g, "\u00ab\u202f");

        this.last_char_rendered = str.slice(-1);
        // This, and not the str argument below on flipflop, is the
        // source of the flipflopper string source.
        str = str.replace(/\s+'/g, " \'");
        if (!notSerious) {
            // this condition for sort_LeadingApostropheOnNameParticle
            str = str.replace(/^'/g, " \'");
        }

        // signal whether we end with terminal punctuation?
        if (!ignorePredecessor) {
            this.state.tmp.term_predecessor = true;
            this.state.tmp.in_cite_predecessor = true;
        } else if (notSerious) {
            this.state.tmp.term_predecessor_name = true;
        }
    }
    blob = new CSL.Blob(str, token);
    curr = this.current.value();
    if ("undefined" === typeof curr && this.current.mystack.length === 0) {
        // XXXX An operation like this is missing somewhere, this should NOT be necessary.
        // Addresses error triggered in multi-layouts.
        this.current.mystack.push([]);
        curr = this.current.value();
    }
    if ("string" === typeof blob.blobs) {
        if (!ignorePredecessor) {
            this.state.tmp.term_predecessor = true;
            this.state.tmp.in_cite_predecessor = true;
        } else if (notSerious) {
            this.state.tmp.term_predecessor_name = true;
        }
    }
    //
    // Caution: The parallel detection machinery will blow up if tracking
    // variables are not properly initialized elsewhere.
    //
    if ("string" === typeof str) {
        if ("string" === typeof blob.blobs) {
            if (blob.blobs.slice(0, 1) !== " ") {
                var blobPrefix = "";
                var blobBlobs = blob.blobs;
                while (CSL.TERMINAL_PUNCTUATION.indexOf(blobBlobs.slice(0, 1)) > -1) {
                    blobPrefix = blobPrefix + blobBlobs.slice(0, 1);
                    blobBlobs = blobBlobs.slice(1);
                }
                if (blobBlobs && blobPrefix) {
                    blob.strings.prefix = blob.strings.prefix + blobPrefix;
                    blob.blobs = blobBlobs;
                }
            }
        }
        if (blob.strings["text-case"]) {
            //
            // This one is _particularly_ hard to follow.  It's not obvious,
            // but the blob already contains the input string at this
            // point, as blob.blobs -- it's a terminal node, as it were.
            // The str variable also contains the input string, but
            // that copy is not used for onward processing.  We have to
            // apply our changes to the blob copy.
            //
            blob.blobs = CSL.Output.Formatters[blob.strings["text-case"]](this.state, str);
        }
        if (this.state.tmp.strip_periods && !noStripPeriods) {
            blob.blobs = blob.blobs.replace(/\.([^a-z]|$)/g, "$1");
        }
        for (var i = blob.decorations.length - 1; i > -1; i += -1) {
            if (blob.decorations[i][0] === "@quotes" && blob.decorations[i][1] !== "false") {
                blob.punctuation_in_quote = this.state.getOpt("punctuation-in-quote");
            }
            if (!blob.blobs.match(CSL.ROMANESQUE_REGEXP)) {
                if (blob.decorations[i][0] === "@font-style") {
                    blob.decorations = blob.decorations.slice(0, i).concat(blob.decorations.slice(i + 1));
                }
            }
        }
        //
        // XXX: Beware superfluous code in your code.  str in this
        // case is not the source of the final rendered string.
        // See note above.
        //
        curr.push(blob);
        this.state.fun.flipflopper.processTags(blob);
    } else if (useblob) {
        curr.push(blob);
    } else {
        curr.push(str);
    }
    return true;
};

CSL.Output.Queue.prototype.string = function (state, myblobs, blob) {
    var i, ilen, j, jlen, b;
    //if (blob && blob.strings.delimiter) {
    //    print("DELIMITER: "+blob.strings.delimiter+" on "+[x.blobs[0].num for each (x in myblobs)]);
    //}
    //var blobs, ret, blob_delimiter, i, params, blobjr, last_str, last_char, b, use_suffix, qres, addtoret, span_split, j, res, blobs_start, blobs_end, key, pos, len, ppos, llen, ttype, ltype, terminal, leading, delimiters, use_prefix, txt_esc;
    var txt_esc = CSL.getSafeEscape(this.state);
    var blobs = myblobs.slice();
    var ret = [];
    
    if (blobs.length === 0) {
        return ret;
    }

    var blob_delimiter = "";
    if (blob) {
        blob_delimiter = blob.strings.delimiter;
    } else {
        //print("=== Setting false to start ===");
        state.tmp.count_offset_characters = false;
        state.tmp.offset_characters = 0;
    }

    if (blob && blob.new_locale) {
        blob.old_locale = state.opt.lang;
        state.opt.lang = blob.new_locale;
    }

    var blobjr, use_suffix, use_prefix, params;
    for (var i = 0, ilen = blobs.length; i < ilen; i += 1) {
        blobjr = blobs[i];

        if (blobjr.strings.first_blob) {
            // Being the Item.id of the the entry being rendered.
            //print("  -- turning on counting");
            state.tmp.count_offset_characters = blobjr.strings.first_blob;
        }

        if ("string" === typeof blobjr.blobs) {
            if ("number" === typeof blobjr.num) {
                ret.push(blobjr);
            } else if (blobjr.blobs) {
                if (blobjr.particle) {
                    blobjr.blobs = blobjr.particle + blobjr.blobs;
                    blobjr.particle = "";
                }
                // (skips empty strings)
                //b = txt_esc(blobjr.blobs);
                b = txt_esc(blobjr.blobs);
                var blen = b.length;

                if (!state.tmp.suppress_decorations) {
                    for (j = 0, jlen = blobjr.decorations.length; j < jlen; j += 1) {
                        params = blobjr.decorations[j];
                        if (params[0] === "@showid") {
                            continue;
                        }
                        if (state.normalDecorIsOrphan(blobjr, params)) {
                            continue;
                        }
                        b = state.fun.decorate[params[0]][params[1]].call(blobjr, state, b, params[2]);
                    }
                }
                //
                // because we will rip out portions of the output
                // queue before rendering, group wrappers need
                // to produce no output if they are found to be
                // empty.
                if (b && b.length) {
                    b = txt_esc(blobjr.strings.prefix) + b + txt_esc(blobjr.strings.suffix);
                    if (state.opt.development_extensions.csl_reverse_lookup_support && !state.tmp.suppress_decorations) {
                        for (j = 0, jlen = blobjr.decorations.length; j < jlen; j += 1) {
                            params = blobjr.decorations[j];

                            if (params[0] === "@showid") {
                                b = state.fun.decorate[params[0]][params[1]].call(blobjr, state, b, params[2]);
                            }
                        }
                    }
                    ret.push(b);
                    if (state.tmp.count_offset_characters) {
                        state.tmp.offset_characters += (blen + blobjr.strings.suffix.length + blobjr.strings.prefix.length);
                    }
                }
            }
        } else if (blobjr.blobs.length) {
            var addtoret = state.output.string(state, blobjr.blobs, blobjr);
            if (blob) {
                // Patch up world-class weird bug in the ill-constructed code of mine.
                if ("string" !== addtoret && addtoret.length > 1 && blobjr.strings.delimiter) {
                    var numberSeen = false;
                    for (var j=0,jlen=addtoret.length;j<jlen;j++) {
                        if ("string" !== typeof addtoret[j]) {
                            numberSeen = true;
                        } else if (numberSeen) {
                            addtoret[j] = (blobjr.strings.delimiter + addtoret[j]);
                        }
                    }
                }
            }
            ret = ret.concat(addtoret);
        }
        if (blobjr.strings.first_blob && state.registry.registry[blobjr.strings.first_blob]) {
            // The Item.id of the entry being rendered.
            state.registry.registry[blobjr.strings.first_blob].offset = state.tmp.offset_characters;
            state.tmp.count_offset_characters = false;
        }
    }

    // Provide delimiters on adjacent numeric blobs
    for (i=0,ilen=ret.length - 1;i<ilen;i+=1) {
        if ("number" === typeof ret[i].num && "number" === typeof ret[i+1].num && !ret[i+1].UGLY_DELIMITER_SUPPRESS_HACK) {
            // XXX watch this
            ret[i].strings.suffix = ret[i].strings.suffix + (blob_delimiter ? blob_delimiter : "");
            ret[i+1].successor_prefix = "";
            ret[i+1].UGLY_DELIMITER_SUPPRESS_HACK = true;
        }
    }

    var span_split = 0;
    for (var i = 0, ilen = ret.length; i < ilen; i += 1) {
        if ("string" === typeof ret[i]) {
            span_split = (parseInt(i, 10) + 1);
            if (i < ret.length - 1  && "object" === typeof ret[i + 1]) {
                if (blob_delimiter && !ret[i + 1].UGLY_DELIMITER_SUPPRESS_HACK) {
                    ret[i] += txt_esc(blob_delimiter);
                }
                // One bite of the apple
                ret[i + 1].UGLY_DELIMITER_SUPPRESS_HACK = true;
            }
            //span_split = ret.length;
            //print("XXX ret: "+ret+" -- "+blob_delimiter);
        }
    }
/*
    if (blob && (blob.decorations.length || blob.strings.suffix || blob.strings.prefix)) {
        span_split = ret.length;
    }
*/
    if (blob && (blob.decorations.length || blob.strings.suffix)) {
        span_split = ret.length;
    } else if (blob && blob.strings.prefix) {
        for (var i=0,ilen=ret.length;i<ilen;i++) {
            if ("undefined" !== typeof ret[i].num) {
                span_split = i;
                if (i === 0) {
                    ret[i].strings.prefix = blob.strings.prefix + ret[i].strings.prefix;
                }
                break;
            }
        }
    }

    var blobs_start = state.output.renderBlobs(ret.slice(0, span_split), blob_delimiter, false, blob);
    if (blobs_start && blob && (blob.decorations.length || blob.strings.suffix || blob.strings.prefix)) {
        if (!state.tmp.suppress_decorations) {
            for (var i = 0, ilen = blob.decorations.length; i < ilen; i += 1) {
                params = blob.decorations[i];
                if (["@cite","@bibliography", "@display", "@showid"].indexOf(params[0]) > -1) {
                    continue;
                }
                if (state.normalDecorIsOrphan(blobjr, params)) {
                    continue;
                }
                if ("string" === typeof blobs_start) {
                    blobs_start = state.fun.decorate[params[0]][params[1]].call(blob, state, blobs_start, params[2]);
                }
            }
        }
        //
        // XXXX: cut-and-paste warning.  same as a code block above.
        //
        b = blobs_start;
        use_suffix = blob.strings.suffix;
        if (b && b.length) {
            use_prefix = blob.strings.prefix;
            b = txt_esc(use_prefix) + b + txt_esc(use_suffix);
            if (state.tmp.count_offset_characters) {
                state.tmp.offset_characters += (use_prefix.length + use_suffix.length);
            }
        }
        blobs_start = b;
        if (!state.tmp.suppress_decorations) {
            for (var i = 0, ilen = blob.decorations.length; i < ilen; i += 1) {
                params = blob.decorations[i];
                if (["@cite","@bibliography", "@display", "@showid"].indexOf(params[0]) === -1) {
                    continue;
                }
                if ("string" === typeof blobs_start) {
                    blobs_start = state.fun.decorate[params[0]][params[1]].call(blob, state, blobs_start, params[2]);
                }
            }
        }
    }

    var blobs_end = ret.slice(span_split, ret.length);
    if (!blobs_end.length && blobs_start) {
        ret = [blobs_start];
    } else if (blobs_end.length && !blobs_start) {
        ret = blobs_end;
    } else if (blobs_start && blobs_end.length) {
        ret = [blobs_start].concat(blobs_end);
    }
    //
    // Blobs is now definitely a string with
    // trailing blobs.  Return it.
    if ("undefined" === typeof blob) {
        this.queue = [];
        this.current.mystack = [];
        this.current.mystack.push(this.queue);
        if (state.tmp.suppress_decorations) {
            ret = state.output.renderBlobs(ret, undefined, false);
        }
    } else if ("boolean" === typeof blob) {
        ret = state.output.renderBlobs(ret, undefined, true);
    }

    if (blob && blob.new_locale) {
        state.opt.lang = blob.old_locale;
    }
    //if (!blob && !state.tmp.just_looking) {
    //  print("QUEUE ("+ state.tmp.just_looking +"): "+JSON.stringify(state.output.queue, ["num", "strings", "decorations", "blobs", "prefix", "suffix", "delimiter"], 2));
    //}
    return ret;
};

CSL.Output.Queue.prototype.clearlevel = function () {
    var blob, pos, len;
    blob = this.current.value();
    len = blob.blobs.length;
    for (pos = 0; pos < len; pos += 1) {
        blob.blobs.pop();
    }
};

CSL.Output.Queue.prototype.renderBlobs = function (blobs, delim, in_cite, parent) {
    var state, ret, ret_last_char, use_delim, blob, pos, len, ppos, llen, str, params, txt_esc;
    txt_esc = CSL.getSafeEscape(this.state);
    if (!delim) {
        delim = "";
    }
    state = this.state;
    ret = "";
    ret_last_char = [];
    use_delim = "";
    len = blobs.length;
    if (this.state.tmp.area === "citation" && !this.state.tmp.just_looking && len === 1 && typeof blobs[0] === "object" && parent) {
        blobs[0].strings.prefix = parent.strings.prefix + blobs[0].strings.prefix;
        blobs[0].strings.suffix = blobs[0].strings.suffix + parent.strings.suffix;
        blobs[0].decorations = blobs[0].decorations.concat(parent.decorations);
        blobs[0].params = parent.params;
        return blobs[0];
    }
    var start = true;
    for (pos = 0; pos < len; pos += 1) {
        if (blobs[pos].checkNext) {
            blobs[pos].checkNext(blobs[pos + 1],start);
            start = false;
        } else if (blobs[pos+1] && blobs[pos+1].splice_prefix) {
            start = false;
            //blobs[pos+1].checkNext(blobs[pos + 1],start);
        } else {
            start = true;
        }
    }
    
    // print("LEN="+len+" "+JSON.stringify(blobs, null, 2));
    // Fix last non-range join
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
        if ("string" === typeof blob) {
            ret += txt_esc(use_delim);
            // XXX Blob should be run through flipflop and flattened here.
            // (I think it must be a fragment of text around a numeric
            // variable)
            ret += blob;
            if (state.tmp.count_offset_characters) {
                //state.tmp.offset_characters += (use_delim.length + blob.length);
                state.tmp.offset_characters += (use_delim.length);
            }
        } else if (in_cite) {
            // pass
            // Okay, so this does it -- but we're now not able to return a string!
            if (ret) {
                ret = [ret, blob];
            } else {
                ret = [blob];
            }
        } else if (blob.status !== CSL.SUPPRESS) {
            if (blob.particle) {
                str = blob.particle + blob.num;
            } else {
                str = blob.formatter.format(blob.num, blob.gender);
            }
            // Workaround to get a more or less accurate value.
            var strlen = str.replace(/<[^>]*>/g, "").length;
            // notSerious
            this.append(str, "empty", true);
            var str_blob = this.pop();
            var count_offset_characters = state.tmp.count_offset_characters;
            str = this.string(state, [str_blob], false);
            state.tmp.count_offset_characters = count_offset_characters;
            if (blob.strings["text-case"]) {
                str = CSL.Output.Formatters[blob.strings["text-case"]](this.state, str);
            }
            if (str && this.state.tmp.strip_periods) {
                str = str.replace(/\.([^a-z]|$)/g, "$1");
            }
            if (!state.tmp.suppress_decorations) {
                llen = blob.decorations.length;
                for (ppos = 0; ppos < llen; ppos += 1) {
                    params = blob.decorations[ppos];
                    if (state.normalDecorIsOrphan(blob, params)) {
                        continue;
                    }
                    str = state.fun.decorate[params[0]][params[1]].call(blob, state, str, params[2]);
                }
            }
            str = txt_esc(blob.strings.prefix) + str + txt_esc(blob.strings.suffix);
            var addme = "";
            if (blob.status === CSL.END) {
                //print("  CSL.END");
                addme = txt_esc(blob.range_prefix);
            } else if (blob.status === CSL.SUCCESSOR) {
                //print("  CSL.SUCCESSOR");
                addme = txt_esc(blob.successor_prefix);
            } else if (blob.status === CSL.START) {
                //print("  CSL.START");
                if (pos > 0 && !blob.suppress_splice_prefix) {
                    addme = txt_esc(blob.splice_prefix);
                } else {
                    addme = "";
                }
            } else if (blob.status === CSL.SEEN) {
                //print("  CSL.SEEN");

                // THIS IS NOT THE PROPER FUNCTION OF CSL.SEEN, IS IT?

                addme = txt_esc(blob.splice_prefix);
            }
            ret += addme;
            ret += str;
            if (state.tmp.count_offset_characters) {
                state.tmp.offset_characters += (addme.length + blob.strings.prefix.length + strlen + blob.strings.suffix.length);
            }
        }
    }
    return ret;
};

CSL.Output.Queue.purgeEmptyBlobs = function (parent) {
    //print("START1");
    if ("object" !== typeof parent || "object" !== typeof parent.blobs || !parent.blobs.length) {
        return;
    }
    // back-to-front, bottom-first
    for (var i=parent.blobs.length-1;i>-1;i--) {
        CSL.Output.Queue.purgeEmptyBlobs(parent.blobs[i]);
        var child = parent.blobs[i];
        if (!child || !child.blobs || !child.blobs.length) {
            var buf = [];
            while ((parent.blobs.length-1) > i) {
                buf.push(parent.blobs.pop());
            }
            parent.blobs.pop();
            while (buf.length) {
                parent.blobs.push(buf.pop());
            }
        }
    }
    //print("   end");
};

// Adjustments to be made:
//
// * Never migrate beyond a @quotes node
// * Never migrate into a num node.

CSL.Output.Queue.adjust = function (punctInQuote) {

    var NO_SWAP_IN = {
        ";": true,
        ":": true
    };

    var NO_SWAP_OUT = {
        ".": true,
        "!": true,
        "?": true
    };

    var LtoR_MAP = {
        "!": {
            ".": "!",
            "?": "!?",
            ":": "!",
            ",": "!,",
            ";": "!;"
        },
        "?": {
            "!": "?!",
            ".": "?",
            ":": "?",
            ",": "?,",
            ";": "?;"
        },
        ".": {
            "!": ".!",
            "?": ".?",
            ":": ".:",
            ",": ".,",
            ";": ".;"
        },
        ":": {
            "!": "!",
            "?": "?",
            ".": ":",
            ",": ":,",
            ";": ":;"
        },
        ",": {
            "!": ",!",
            "?": ",?",
            ":": ",:",
            ".": ",.",
            ";": ",;"
        },
        ";": {
            "!": "!",
            "?": "?",
            ":": ";",
            ",": ";,",
            ".": ";"
        }
    };

    var SWAP_IN = {};
    var SWAP_OUT = {};
    var PUNCT = {};
    var PUNCT_OR_SPACE = {};
    for (var key in LtoR_MAP) {
        PUNCT[key] = true;
        PUNCT_OR_SPACE[key] = true;
        if (!NO_SWAP_IN[key]) {
            SWAP_IN[key] = true;
        }
        if (!NO_SWAP_OUT[key]) {
            SWAP_OUT[key] = true;
        }
    }
    PUNCT_OR_SPACE[" "] = true;
    PUNCT_OR_SPACE[" "] = true;

    var RtoL_MAP = {};
    for (var key in LtoR_MAP) {
        for (var subkey in LtoR_MAP[key]) {
            if (!RtoL_MAP[subkey]) {
                RtoL_MAP[subkey] = {};
            }
            RtoL_MAP[subkey][key] = LtoR_MAP[key][subkey];
        }
    }

    function blobIsNumber(blob) {
        return ("number" === typeof blob.num || (blob.blobs && blob.blobs.length === 1 && "number" === typeof blob.blobs[0].num));
    }

    function blobEndsInNumber(blob) {
        if ("number" === typeof blob.num) {
            return true;
        }
        if (!blob.blobs || "object" !==  typeof blob.blobs) {
            return false;
        }
        if (blobEndsInNumber(blob.blobs[blob.blobs.length-1])) {
            return true;
        }
    }
    
    function blobHasDecorations(blob,includeQuotes) {
        var ret = false;
        var decorlist = ['@font-style','@font-variant','@font-weight','@text-decoration','@vertical-align'];
        if (includeQuotes) {
            decorlist.push('@quotes');
        }
        if (blob.decorations) {
            for (var i=0,ilen=blob.decorations.length;i<ilen;i++) {
                if (decorlist.indexOf(blob.decorations[i][0]) > -1) {
                    ret = true;
                    break;
                }
            }
        }
        return ret;
    }
    
    function blobHasDescendantQuotes(blob) {
        if (blob.decorations) {
            for (var i=0,ilen=blob.decorations.length;i<ilen;i++) {
                if (blob.decorations[i][0] === '@quotes' && blob.decorations[i][1] !== "false") {
                    return true;
                }
            }
        }
        if ("object" !== typeof blob.blobs) {
            return false;
        }
        return blobHasDescendantQuotes(blob.blobs[blob.blobs.length-1]);
        //if (blobHasDescendantQuotes(blob.blobs[blob.blobs.length-1])) {
        //    return true
        //};
        //return false;
    }
    
    function blobHasDescendantMergingPunctuation(parentChar,blob) {
        var childChar = blob.strings.suffix.slice(-1);
        if (!childChar && "string" === typeof blob.blobs) {
            childChar = blob.blobs.slice(-1);
        }
        var mergedChars = RtoL_MAP[parentChar][childChar];
        if (mergedChars && mergedChars.length === 1) {
            return true;
        }
        if ("object" !== typeof blob.blobs) {
            return false;
        }
        if (blobHasDescendantMergingPunctuation(parentChar,blob.blobs[blob.blobs.length-1])) {
            return true;
        }
        return false;
    }
    
    function matchLastChar(blob, chr) {
        if (!PUNCT[chr]) {
            return false;
        }
        if ("string" === typeof blob.blobs) {

            if (blob.blobs.slice(-1) === chr) {
                return true;
            } else {
                return false;
            }
        } else {
            var child = blob.blobs[blob.blobs.length-1];
            if (child) {
                var childChar = child.strings.suffix.slice(-1);
                if (!childChar) {
                    return matchLastChar(child,chr);
                } else if (child.strings.suffix.slice(-1) == chr) {
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }
    }
    
    function mergeChars (First, first, Second, second, merge_right) {
        var FirstStrings = "blobs" === first ? First : First.strings;
        var SecondStrings = "blobs" === second ? Second: Second.strings;
        var firstChar = FirstStrings[first].slice(-1);
        var secondChar = SecondStrings[second].slice(0,1);
        function cullRight () {
            SecondStrings[second] = SecondStrings[second].slice(1);
        }
        function cullLeft () {
            FirstStrings[first] = FirstStrings[first].slice(0,-1);
        }
        function addRight (chr) {
            SecondStrings[second] = chr + SecondStrings[second];
        }
        function addLeft (chr) {
            FirstStrings[first] += chr;
        }
        var cull = merge_right ? cullLeft : cullRight;
        function matchOnRight () {
            return RtoL_MAP[secondChar];
        }
        function matchOnLeft () {
            return LtoR_MAP[firstChar];
        }
        var match = merge_right ? matchOnLeft : matchOnRight;
        function mergeToRight () {
            var chr = LtoR_MAP[firstChar][secondChar];
            if ("string" === typeof chr) {
                cullLeft();
                cullRight();
                addRight(chr);
            } else {
                addRight(firstChar);
                cullLeft();
            }
        }
        function mergeToLeft () {
            var chr = RtoL_MAP[secondChar][firstChar];
            if ("string" === typeof chr) {
                cullLeft();
                cullRight();
                addLeft(chr);
            } else {
                addLeft(secondChar);
                cullRight();
            }
        }
        var merge = merge_right ? mergeToRight: mergeToLeft;

        var isDuplicate = firstChar === secondChar;
        if (isDuplicate) {
            cull();
        } else {
            if (match()) {
                merge();
            }
        }
    }

    function upward (parent) {
        //print("START2");
        // Terminus if no blobs
        if (parent.blobs && "string" == typeof parent.blobs) {
            if (PUNCT[parent.strings.suffix.slice(0,1)]
                && parent.strings.suffix.slice(0,1) === parent.blobs.slice(-1)) {

                parent.strings.suffix = parent.strings.suffix.slice(1);
            }
            return;
        } else if ("object" !== typeof parent || "object" !== typeof parent.blobs || !parent.blobs.length) {
            return;
        }

        // back-to-front, bottom-first
        var parentDecorations = blobHasDecorations(parent,true);
        for (var i=parent.blobs.length-1;i>-1;i--) {
            this.upward(parent.blobs[i]);
            var parentStrings = parent.strings;
            var childStrings = parent.blobs[i].strings;
            if (i === 0) {
                // Remove leading space on first-position child node prefix if there is a trailing space on the node prefix above 
                if (" " === parentStrings.prefix.slice(-1) && " " === childStrings.prefix.slice(0, 1)) {
                    childStrings.prefix = childStrings.prefix.slice(1);
                }
                // Migrate leading punctuation or space on a first-position prefix upward
                var childChar = childStrings.prefix.slice(0, 1);
                if (!parentDecorations && PUNCT_OR_SPACE[childChar] && !parentStrings.prefix) {
                    parentStrings.prefix += childChar;
                    childStrings.prefix = childStrings.prefix.slice(1);
                }
            }
            if (i === (parent.blobs.length - 1)) {
                // Migrate trailing space ONLY on a last-position suffix upward, controlling for duplicates
                var childChar = childStrings.suffix.slice(-1);
                // ZZZ Loosened to fix initialized names wrapped in a span and followed by a period
                if (!parentDecorations && [" "].indexOf(childChar) > -1) {
                    if (parentStrings.suffix.slice(0,1) !== childChar) {
                        parentStrings.suffix = childChar + parentStrings.suffix;
                    }
                    childStrings.suffix = childStrings.suffix.slice(0, -1);
                }
            }
            if (parentStrings.delimiter && i > 0) {
                // Remove leading space on mid-position child node prefix if there is a trailing space on delimiter above
                if (PUNCT_OR_SPACE[parentStrings.delimiter.slice(-1)]
                    && parentStrings.delimiter.slice(-1) === childStrings.prefix.slice(0, 1)) {

                    childStrings.prefix = childStrings.prefix.slice(1);
                }
            }
            // Siblings are handled in adjustNearsideSuffixes()
        }
        //print("   end");
    }

    function leftward (parent) {
        // Terminus if no blobs
        if ("object" !== typeof parent || "object" !== typeof parent.blobs || !parent.blobs.length) {
            return;
        }

        for (var i=parent.blobs.length-1;i>-1;i--) {
            this.leftward(parent.blobs[i]);
            // This is a delicate one.
            //
            // Migrate if:
            // * there is no umbrella delimiter [ok]
            // * neither the child nor its sibling is a number [ok]
            // * decorations exist neither on the child nor on the sibling [ok]
            // * sibling prefix char is a swapping char [ok]
            //
            // Suppress without migration if:
            // * sibling prefix char matches child suffix char or
            // * child suffix is empty and sibling prefix char match last field char
            if ((i < parent.blobs.length -1) && !parent.strings.delimiter) {
                // If there is a trailing swappable character on a sibling prefix with no intervening delimiter, copy it to suffix,
                // controlling for duplicates
                var child = parent.blobs[i];
                var childChar = child.strings.suffix.slice(-1);
                var sibling = parent.blobs[i+1];
                var siblingChar = sibling.strings.prefix.slice(0, 1);
                var hasDecorations = blobHasDecorations(child) || blobHasDecorations(sibling);
                var hasNumber = "number" === typeof childChar || "number" === typeof siblingChar;

                if (!hasDecorations && !hasNumber && PUNCT[siblingChar] && !hasNumber) {
                    var suffixAndPrefixMatch = siblingChar === child.strings.suffix.slice(-1);
                    var suffixAndFieldMatch = (!child.strings.suffix && "string" === typeof child.blobs && child.blobs.slice(-1) === siblingChar);
                    if (!suffixAndPrefixMatch && !suffixAndFieldMatch) {
                        mergeChars(child, 'suffix', sibling, 'prefix');
                        //child.strings.suffix += siblingChar;
                    } else {
                        sibling.strings.prefix = sibling.strings.prefix.slice(1);
                    }
                }
            }
        }
    }

    function downward (parent) {
        //print("START3");
        // Terminus if no blobs
        if (parent.blobs && "string" == typeof parent.blobs) {
            if (PUNCT[parent.strings.suffix.slice(0,1)]
                && parent.strings.suffix.slice(0,1) === parent.blobs.slice(-1)) {

                parent.strings.suffix = parent.strings.suffix.slice(1);
            }
            return;
        } else if ("object" !== typeof parent || "object" !== typeof parent.blobs || !parent.blobs.length) {
            return;
        }
        //if (top) {
        //    print("JSON "+JSON.stringify(parent, ["strings", "decorations", "blobs", "prefix", "suffix", "delimiter"], 2));
        //}

        var parentStrings = parent.strings;
        // Check for numeric child
        var someChildrenAreNumbers = false;
        for (var i=0,ilen=parent.blobs.length;i<ilen;i++) {
            if (blobIsNumber(parent.blobs[i])) {
                someChildrenAreNumbers = true;
                break;
            }
        }
        if (true || !someChildrenAreNumbers) {
            // If there is a leading swappable character on delimiter, copy it to suffixes IFF none of the targets are numbers
            if (parentStrings.delimiter && PUNCT[parentStrings.delimiter.slice(0, 1)]) {
                var delimChar = parentStrings.delimiter.slice(0, 1);
                for (var i=parent.blobs.length-2;i>-1;i--) {
                    var childStrings = parent.blobs[i].strings;
                    if (childStrings.suffix.slice(-1) !== delimChar) {
                        childStrings.suffix += delimChar;
                    }
                }
                parentStrings.delimiter = parentStrings.delimiter.slice(1);
            }
        }
        // back-to-front, top-first
        for (var i=parent.blobs.length-1;i>-1;i--) {
            var child = parent.blobs[i];
            var childStrings = parent.blobs[i].strings;
            var childDecorations = blobHasDecorations(child, true);
            var childIsNumber = blobIsNumber(child);

            if (i === (parent.blobs.length - 1)) {

                //if (blobHasDescendantQuotes(child)) {
                //    print("JSON "+JSON.stringify(parent, ["strings", "decorations", "blobs", "prefix", "suffix", "delimiter"]));
                //}

                if (true || !someChildrenAreNumbers) {
                    // If we have decorations, drill down to see if there are quotes below.
                    // If so, we allow migration anyway.
                    // Original discussion is here:
                    // https://forums.zotero.org/discussion/37091/citeproc-bug-punctuation-in-quotes/
                    var parentChar = parentStrings.suffix.slice(0, 1);

                    // Hmm.
                    // Consider writing out the matching child from blobHasDescendant functions.
                    // It should save some cycles, and produce the same result.

                    var allowMigration = false;
                    if (PUNCT[parentChar]) {
                        allowMigration = blobHasDescendantMergingPunctuation(parentChar,child);
                        if (!allowMigration && punctInQuote) {
                            allowMigration = blobHasDescendantQuotes(child);
                        }
                    }
                    if (allowMigration) {
                        if (PUNCT[parentChar]) {
                            if (!blobEndsInNumber(child)) {
                                if ("string" === typeof child.blobs) {
                                    mergeChars(child, 'blobs', parent, 'suffix');
                                } else {
                                    mergeChars(child, 'suffix', parent, 'suffix');
                                }
                                if (parentStrings.suffix.slice(0,1) === ".") {
                                    childStrings.suffix += parentStrings.suffix.slice(0,1);
                                    parentStrings.suffix = parentStrings.suffix.slice(1);
                                }
                            }
                        }
                    }
                    if (childStrings.suffix.slice(-1) === " " && parentStrings.suffix.slice(0,1) === " ") {
                        parentStrings.suffix = parentStrings.suffix.slice(1);
                    }
                    // More duplicates control
                    if (PUNCT_OR_SPACE[childStrings.suffix.slice(0,1)]) {
                        if ("string" === typeof child.blobs && child.blobs.slice(-1) === childStrings.suffix.slice(0,1)) {
                            // Remove parent punctuation of it duplicates the last character of a field
                            childStrings.suffix = childStrings.suffix.slice(1);
                        }
                        if (childStrings.suffix.slice(-1) === parentStrings.suffix.slice(0, 1)) {
                            // Remove duplicate punctuation on child suffix
                            parentStrings.suffix = parentStrings.suffix.slice(0, -1);
                        }
                    }
                }
                // Squash dupes
                if (matchLastChar(parent,parent.strings.suffix.slice(0,1))) {
                    parent.strings.suffix = parent.strings.suffix.slice(1);
                }
            } else if (parentStrings.delimiter) {
                // Remove trailing space on mid-position child node suffix if there is a leading space on delimiter above
                if (PUNCT_OR_SPACE[parentStrings.delimiter.slice(0,1)]
                    && parentStrings.delimiter.slice(0, 1) === childStrings.suffix.slice(-1)) {

                    parent.blobs[i].strings.suffix = parent.blobs[i].strings.suffix.slice(0, -1);
                    
                }
            } else {
                // Otherwise it's a sibling. We don't care about moving spaces here, just suppress a duplicate
                var siblingStrings = parent.blobs[i+1].strings;
                if (!blobIsNumber(child) 
                    && !childDecorations
                    && PUNCT_OR_SPACE[childStrings.suffix.slice(-1)]
                    && childStrings.suffix.slice(-1) === siblingStrings.prefix.slice(0, 1)) {

                    siblingStrings.prefix = siblingStrings.prefix.slice(1);
                }
            }
            // If field content ends with swappable punctuation, suppress swappable punctuation in style suffix.
            if (!childIsNumber && !childDecorations && PUNCT[childStrings.suffix.slice(0,1)]
                && "string" === typeof child.blobs) {
                
                mergeChars(child, 'blobs', child, 'suffix');
            }
            this.downward(parent.blobs[i]);
        }
/*
        if (top) {

            var seen = [];
            print(JSON.stringify(parent, function(key, val) {
                if (!val || key === 'alldecor') return;
                if (typeof val == "object") {
                    if (seen.indexOf(val) >= 0)
                        return
                    seen.push(val)
                }
                return val
            },2));
        }
*/

        //print("  end");
    }
    // Abstract out a couple of utility functions, used in fix() below.
    function swapToTheLeft (child) {
        var childChar = child.strings.suffix.slice(0,1);
        if ("string" === typeof child.blobs) {
            while (SWAP_IN[childChar]) {
                mergeChars(child, 'blobs', child, 'suffix');
                childChar = child.strings.suffix.slice(0,1);
            }                                
        } else {
            while (SWAP_IN[childChar]) {
                mergeChars(child.blobs[child.blobs.length-1], 'suffix', child, 'suffix');
                childChar = child.strings.suffix.slice(0,1);
            }
        }
    }
    function swapToTheRight (child) {
        if ("string" === typeof child.blobs) {
            var childChar = child.blobs.slice(-1);
            while (SWAP_OUT[childChar]) {
                mergeChars(child, 'blobs', child, 'suffix', true);
                childChar = child.blobs.slice(-1);
            }
        } else {
            var childChar = child.blobs[child.blobs.length-1].strings.suffix.slice(-1);
            while (SWAP_OUT[childChar]) {
                mergeChars(child.blobs[child.blobs.length-1], 'suffix', child, 'suffix', true);
                childChar = child.blobs[child.blobs.length-1].strings.suffix.slice(-1);
            }
        }
    }

    function fix (parent) {
        // Terminus if no blobs
        if ("object" !== typeof parent || "object" !== typeof parent.blobs || !parent.blobs.length) {
            return;
        }
        
        //print("START4");
        // Do the swap, front-to-back, bottom-first
        var lastChar;

        // XXX Two things to fix with this:
        // XXX (1) Stalls after one character
        // XXX (2) Moves colon and semicolon, both of which SHOULD stall

        for (var i=0,ilen=parent.blobs.length;i<ilen;i++) {
            var child = parent.blobs[i];
            var quoteSwap = false;
            for (var j=0,jlen=child.decorations.length;j<jlen;j++) {
                var decoration = child.decorations[j];
                if (decoration[0] === "@quotes" && decoration[1] !== "false") {
                    quoteSwap = true;
                }
            }
            if (quoteSwap) {
                if (punctInQuote) {
                    swapToTheLeft(child);
                } else {
                    swapToTheRight(child);
                }
            }
            lastChar = this.fix(parent.blobs[i]);
            if (child.blobs && "string" === typeof child.blobs) {
                lastChar = child.blobs.slice(-1);
            }
        }
        return lastChar;
    }
    this.upward = upward;
    this.leftward = leftward;
    this.downward = downward;
    this.fix = fix;
};

/*global CSL: true */

CSL.Engine.Opt = function () {
    this.has_disambiguate = false;
    this.mode = "html";
    this.dates = {};
    this.jurisdictions_seen = {};
    this.suppressedJurisdictions = {};
    this.inheritedAttributes = {};
    this["locale-sort"] = [];
    this["locale-translit"] = [];
    this["locale-translat"] = [];
    this.citeAffixes = {
        persons:{
            "locale-orig":{
                prefix:"",
                suffix:""
            },
            "locale-translit":{
                prefix:"",
                suffix:""
            },
            "locale-translat":{
                prefix:"",
                suffix:""
            }
        },
        institutions:{
            "locale-orig":{
                prefix:"",
                suffix:""
            },
            "locale-translit":{
                prefix:"",
                suffix:""
            },
            "locale-translat":{
                prefix:"",
                suffix:""
            }
        },
        titles:{
            "locale-orig":{
                prefix:"",
                suffix:""
            },
            "locale-translit":{
                prefix:"",
                suffix:""
            },
            "locale-translat":{
                prefix:"",
                suffix:""
            }
        },
        journals:{
            "locale-orig":{
                prefix:"",
                suffix:""
            },
            "locale-translit":{
                prefix:"",
                suffix:""
            },
            "locale-translat":{
                prefix:"",
                suffix:""
            }
        },
        publishers:{
            "locale-orig":{
                prefix:"",
                suffix:""
            },
            "locale-translit":{
                prefix:"",
                suffix:""
            },
            "locale-translat":{
                prefix:"",
                suffix:""
            }
        },
        places:{
            "locale-orig":{
                prefix:"",
                suffix:""
            },
            "locale-translit":{
                prefix:"",
                suffix:""
            },
            "locale-translat":{
                prefix:"",
                suffix:""
            }
        }
    };
    this["default-locale"] = [];
    this.update_mode = CSL.NONE;
    this.bib_mode = CSL.NONE;
    this.sort_citations = false;
    /*
     * Default values.
     * The various et-al values are set globally,
     * and the appropriate value is set by the names start
     * tag at runtime, depending on whether the Item is a
     * first or a subsequent reference.
     */
    this["et-al-min"] = 0;
    this["et-al-use-first"] = 1;
    this["et-al-use-last"] = false;
    this["et-al-subsequent-min"] = false;
    this["et-al-subsequent-use-first"] = false;

    this["demote-non-dropping-particle"] = "display-and-sort";
    // default of true, because none of our consuming
    // applications so far store the various prefixes and 
    // suffixes we support in separate fields.
    this["parse-names"] = true;
    // this["auto-vietnamese-names"] = true;

    this.citation_number_slug = false;
    this.trigraph = "Aaaa00:AaAa00:AaAA00:AAAA00";

    this.nodenames = [];

    this.gender = {};
    this['cite-lang-prefs'] = {
        persons:['orig'],
        institutions:['orig'],
        titles:['orig'],
        journals:['orig'],
        publishers:['orig'],
        places:['orig'],
        number:['orig']
    };

    this.has_layout_locale = false;

    this.development_extensions = {};
    this.development_extensions.field_hack = true;
    this.development_extensions.allow_field_hack_date_override = true;
    this.development_extensions.locator_date_and_revision = true;
    this.development_extensions.locator_label_parse = true;
    this.development_extensions.raw_date_parsing = true;
    this.development_extensions.clean_up_csl_flaws = true;
    this.development_extensions.static_statute_locator = false;
    this.development_extensions.csl_reverse_lookup_support = false;
    this.development_extensions.wrap_url_and_doi = false;
    this.development_extensions.handle_parallel_articles = false;
    this.development_extensions.thin_non_breaking_space_html_hack = false;
    this.development_extensions.apply_citation_wrapper = false;
    this.development_extensions.main_title_from_short_title = false;
    this.development_extensions.uppercase_subtitles = false;
    this.development_extensions.normalize_lang_keys_to_lowercase = false;
    this.development_extensions.strict_text_case_locales = false;
    this.development_extensions.expect_and_symbol_form = false;
    this.development_extensions.require_explicit_legal_case_title_short = false;
    this.development_extensions.spoof_institutional_affiliations = false;
    this.development_extensions.force_jurisdiction = false;
    this.development_extensions.parse_names = true;
    this.development_extensions.hanging_indent_legacy_number = false;
    this.development_extensions.throw_on_empty = false;
    this.development_extensions.strict_inputs = true;
    this.development_extensions.prioritize_disambiguate_condition = false;
    this.development_extensions.force_short_title_casing_alignment = true;
};

CSL.Engine.Tmp = function () {
    //
    // scratch variable to display the total
    // number of names in all rendered variables
    // in a cite.  initialized to zero by the
    // citation element, incremented by each
    // name variable actually rendered
    this.names_max = new CSL.Stack();
    this.names_base = new CSL.Stack();
    this.givens_base = new CSL.Stack();
    //
    // this holds the field values collected by the @value
    // and @variable attributes, for processing by the
    // element functions.
    this.value = [];
    /**
     * Object to hold the decorations declared by a name-part
     * element.
     */
    this.namepart_decorations = {};
    /**
     * String variable to hold the type of a name-part
     * element.
     */
    this.namepart_type = false;
    //
    // scratch variable to flag whether we are processing
    // a citation or a bibiliography.  this diverts token and
    // configuration to the appropriateo objects inside
    // state.  the default is "citation".
    this.area = "citation";
    this.root = "citation";
    this.extension = "";
    //
    // controls the implicit conditional wrappers applied
    // to top-level elements inside a names substitute span.
    // false by default, names start tag pushes a new true level,
    // names end tag pops it.  Output value check in @variable
    // function of attributes.js sets level to false.  closing names
    // tag maps a false value to superior level.
    this.can_substitute = new CSL.Stack(0, CSL.LITERAL);
    //
    // notes whether the formatted elements of a date span
    // rendered anything.  controls whether literal fallback
    // is used.
    this.element_rendered_ok = false;
    //
    // element_trace keeps a record of rendered elements.
    // used to implement author-only.
    //
    this.element_trace = new CSL.Stack("style");
    //
    // counter for total namesets
    this.nameset_counter = 0;
    //
    /////  this.fun.check_for_output = CSL.check_for_output;
    //
    // stack flag used for term handling.  Set to true
    // if at least one variable has tried to render, and
    // no variables had content.
    this.group_context = new CSL.Stack({
        term_intended: false,
        variable_attempt: false,
        variable_success: false,
        output_tip: undefined,
        label_form:  undefined,
        parallel_condition: undefined,
        parallel_result: undefined,
        no_repeat_condition: undefined,
        parallel_repeats: undefined,
        condition: false,
        force_suppress: false,
        done_vars: []
    });
    //
    // boolean flag used to control first-letter capitalization
    // of terms.  Set to true if any item preceding the term
    // being handled has rendered successfully, otherwise
    // false.
    this.term_predecessor = false;
    //
    // boolean flag to control use of layout delimiter
    // immediately before numbers. This hack is needed for
    // some numeric styles.
    this.in_cite_predecessor = false;
    //
    // stack flag used to control jumps in the closing
    // token of a conditional.
    this.jump = new CSL.Stack(0, CSL.LITERAL);
    //
    // holds string parameters for group formatting, between
    // the start of a group and the closing token.
    this.decorations = new CSL.Stack();
    //
    // token store stack.
    this.tokenstore_stack = new CSL.Stack();

    // for collapsing
    this.last_suffix_used = "";
    this.last_names_used = [];
    this.last_years_used = [];
    this.years_used = [];
    this.names_used = [];

    this.taintedItemIDs = {};
    this.taintedCitationIDs = {};
    //
    // scratch stack containing initialize-with strings or null values
    this.initialize_with = new CSL.Stack();
    //
    // this is used to set a requested set of
    // disambiguation parameters in the output.
    // for the array elements, the base array
    // (either zero for each nameset, or full-up
    // if givens are already used) is set
    // during names processing, if no value
    // is set in the processor before a rendering
    // run.  to simplify things for the calling
    // function, these are just bog-standard arrays,
    // and can be safely overwritten.
    this.disambig_request = false;
    //
    // scratch variable to toggle an attempt to set a
    // name in sort order rather than display
    // order.
    this["name-as-sort-order"] = false;
    //
    // suppress decorations (used for generating
    // sort keys and disambiguation keys)
    this.suppress_decorations = false;
    //
    // empty settings array, used to report settings used
    // if disambig_request is not set at runtime
    this.disambig_settings = new CSL.AmbigConfig();
    //
    // sort key array
    this.bib_sort_keys = [];
    //
    // holds the prefix between the start of a group
    // and the closing token.
    this.prefix = new CSL.Stack("", CSL.LITERAL);
    //
    // holds the suffix between the start of a group
    // and the closing token.
    this.suffix = new CSL.Stack("", CSL.LITERAL);
    //
    // holds the group delimiter between the start of a group
    // and the closing token.
    this.delimiter = new CSL.Stack("", CSL.LITERAL);
    //
    // Used for conditional locale switching.
    this.cite_locales = [];
    this.cite_affixes = {
        citation: false, 
        bibliography: false,
        citation_sort: false, 
        bibliography_sort: false
    };
    this.strip_periods = 0;
    this.shadow_numbers = {};
    this.authority_stop_last = 0;
    this.loadedItemIDs = {};
    //
    // Push/pop array for set/unset of opt.lang setting, used
    // in if locale="XX" to force terms to language of item.
    // @locale tests track their nesting level in a counter,
    // and push the current value of state.opt.lang to one array,
    // and the counter value to another. On the way back up,
    // closing node decrements the counter, compares its value
    // with the trailing value on the array, and pops both
    // arrays, resetting state.opt.lang to the previous value.
    // A hack to solve a surprisingly difficult problem caused
    // by the use of an execution stack for the nested structure.
    this.condition_counter = 0; //incremented/decremented on ALL conditions
    this.condition_lang_val_arr = [];
    this.condition_lang_counter_arr = [];
};


CSL.Engine.Fun = function (state) {
    //
    // matcher
    this.match = new CSL.Util.Match();
    //
    // utility to get standard suffixes for disambiguation
    this.suffixator = new CSL.Util.Suffixator(CSL.SUFFIX_CHARS);
    //
    // utility to romanize a numeric value
    this.romanizer = new CSL.Util.Romanizer();
    //
    // utility to make an ordinal form of a number
    this.ordinalizer = new CSL.Util.Ordinalizer(state);
    //
    // utility to make the long ordinal form of a number, if possible
    this.long_ordinalizer = new CSL.Util.LongOrdinalizer();
};


CSL.Engine.Build = function () {
    // Alternate et-al term
    // Holds the localization key of the alternative term
    // to be used for et-al in a names environment.  Reduced
    // to a term object when the element tag is processed during
    // Build.
    this["alternate-term"] = false;
    //
    // flags that we are in the bibliography area.
    // used by sort.
    this.in_bibliography = false;
    //
    // scratch variable to alter behaviour when processing
    // locale files
    this.in_style = false;
    //
    // used to ignore info
    this.skip = false;
    //
    // the macro ATTRIBUTE stores a macro name on this
    // scratch variable anywhere outside the layout area
    // during build.  The macro name is picked up when
    // the token is encountered inside the layout area,
    // either through a direct call, or as part of a nested
    // macro expansion, and the macro content is exploded
    // into the token list.
    this.postponed_macro = false;
    //
    // used especially for controlling macro expansion
    // during Build.
    this.layout_flag = false;
    //
    // (was buffer_name)
    // scratch variable to hold the name of a macro
    // or a term until its children have been collected.
    this.name = false;
    this.names_variables = [[]];
    this.name_label = [{}];
    //
    // scratch variable to hold the value of a form
    // attribute until other attributes needed for
    // processing have been collected.
    this.form = false;
    this.term = false;
    //
    // the macros themselves are discarded after Build
    this.macro = {};
    //
    // the macro build stack.  used to raise an error
    // when macros would attempt to call themselves.
    this.macro_stack = [];
    //
    // stores the content of an XML text node during processing
    this.text = false;
    //
    // this is a scratch variable for holding an attribute
    // value during processing
    this.lang = false;
    //
    // should be able to run uninitialized; may attract some
    // cruft this way.
    this.area = "citation";
    this.root = "citation";
    this.extension = "";
    //
    // controls the application of implicit conditional wrappers
    // to top-level elements inside a names substitute span.
    // zero by default, build of names tag pushes a
    // new level with value 1.  group start tag increments by 1,
    // group end tag decrements by 1.  conditional wrappers are
    // only applied if value is exactly 1.
    this.substitute_level = new CSL.Stack(0, CSL.LITERAL);
    this.names_level = 0;
    this.render_nesting_level = 0;
    this.render_seen = false;
    this.bibliography_key_pos = 0;
};


CSL.Engine.Configure = function () {
    //
    // the fail and succeed arrays are used for stack
    // processing during configure.
    this.tests = [];
    this.fail = [];
    this.succeed = [];
};


CSL.Engine.Citation = function (state) {
     // Citation options area.
     // Holds a mixture of persistent and ephemeral
     // options and scratch data used during processing of
     // a citation.</p>
    this.opt = {
        inheritedAttributes: {}
    };

    this.tokens = [];
    // Placeholder function
    this.srt = new CSL.Registry.Comparifier(state, "citation_sort");
    //
    // configuration array to hold the collapse
    // options, if any.
    this.opt.collapse = [];
    //
    // disambiguate options
    this.opt["disambiguate-add-names"] = false;
    this.opt["disambiguate-add-givenname"] = false;
    this.opt["disambiguate-add-year-suffix"] = false;
    this.opt["givenname-disambiguation-rule"] = "by-cite";
    this.opt["near-note-distance"] = 5;

    this.opt.topdecor = [];
    this.opt.layout_decorations = [];
    this.opt.layout_prefix = "";
    this.opt.layout_suffix = "";
    this.opt.layout_delimiter = "";
    //
    // sorting
    this.opt.sort_locales = [];
    this.opt.max_number_of_names = 0;
    this.root = "citation";
};


CSL.Engine.Bibliography = function () {
    this.opt = {
        inheritedAttributes: {}
    };
    this.tokens = [];

    this.opt.collapse = [];

    this.opt.topdecor = [];
    this.opt.layout_decorations = [];
    this.opt.layout_prefix = "";
    this.opt.layout_suffix = "";
    this.opt.layout_delimiter = "";
    this.opt["line-spacing"] = 1;
    this.opt["entry-spacing"] = 1;
    //
    // sorting
    this.opt.sort_locales = [];
    this.opt.max_number_of_names = 0;
    this.root = "bibliography";
};


CSL.Engine.BibliographySort = function () {
    this.tokens = [];
    this.opt = {};
    this.opt.sort_directions = [];
    this.opt.topdecor = [];
    // Holds the final citation-number sort direction, for use
    // in applying numbers in cs:citation and cs:bibliography.
    // Value is exclusively controlled by cs:key in bibliography_sort
    this.opt.citation_number_sort_direction = CSL.ASCENDING;
    this.opt.citation_number_secondary = false;
    this.tmp = {};
    this.keys = [];
    this.root = "bibliography";
};


CSL.Engine.CitationSort = function () {
    this.tokens = [];
    this.opt = {};
    this.opt.sort_directions = [];
    this.keys = [];
    this.opt.topdecor = [];
    this.root = "citation";
};

CSL.Engine.InText = function () {
     // InText options area.
     // Holds a mixture of persistent and ephemeral
     // options and scratch data used during processing of
     // a citation.</p>
    this.opt = {
        inheritedAttributes: {}
    };

    this.tokens = [];
    // Placeholder function
    //this.srt = new CSL.Registry.Comparifier(state, "citation_sort");
    //
    // configuration array to hold the collapse
    // options, if any.
    this.opt.collapse = [];
    //
    // disambiguate options
    this.opt["disambiguate-add-names"] = false;
    this.opt["disambiguate-add-givenname"] = false;
    this.opt["disambiguate-add-year-suffix"] = false;
    this.opt["givenname-disambiguation-rule"] = "by-cite";
    this.opt["near-note-distance"] = 5;

    this.opt.topdecor = [];
    this.opt.layout_decorations = [];
    this.opt.layout_prefix = "";
    this.opt.layout_suffix = "";
    this.opt.layout_delimiter = "";
    //
    // sorting
    this.opt.sort_locales = [];
    this.opt.max_number_of_names = 0;
    this.root = "intext";
};

/*global CSL: true */

CSL.Engine.prototype.previewCitationCluster = function (citation, citationsPre, citationsPost, newMode) {
    // Generate output for a hypothetical citation at the current position,
    // Leave the registry in the same state in which it was found.
    //print("################### previewCitationCluster() #################");
    var oldMode = this.opt.mode;
    this.setOutputFormat(newMode);
    // Avoids generating unwanted ibids, if the citationID already exists in document
	if (citation.citationID) {
		delete citation.citationID;
	}
    var ret = this.processCitationCluster(citation, citationsPre, citationsPost, CSL.PREVIEW);

    this.setOutputFormat(oldMode);
    return ret[1];
};

CSL.Engine.prototype.appendCitationCluster = function (citation) {
    var citationsPre = [];
    var len = this.registry.citationreg.citationByIndex.length;
    for (var pos = 0; pos < len; pos += 1) {
        var c = this.registry.citationreg.citationByIndex[pos];
        citationsPre.push(["" + c.citationID, c.properties.noteIndex]);
    }
    // Drop the data segment to return a list of pos/string pairs.
    return this.processCitationCluster(citation, citationsPre, [])[1];
};


CSL.Engine.prototype.processCitationCluster = function (citation, citationsPre, citationsPost, flag) {
    var c, preCitation, postCitation, i, ilen, j, jlen, k, klen, n, nlen, key, Item, item, noteCitations, textCitations, m, citationsInNote;
    this.debug = false;
    this.tmp.loadedItemIDs = {};

    // Revert citation dereference from 2ffc4664ae
    //citation = JSON.parse(JSON.stringify(citation));
    
    //print("################### processCitationCluster() #################");
    this.tmp.citation_errors = [];
    this.registry.return_data = {"bibchange": false};

    // make sure this citation has a unique ID, and register it in citationById.
    this.setCitationId(citation);

    var oldCitationList;
    var oldItemList;
    var oldAmbigs;
    if (flag === CSL.PREVIEW) {
        //SNIP-START
        if (this.debug) {
            CSL.debug("****** start state save *********");
        }
        //SNIP-END
        //
        // Simplify.

        // Take a slice of existing citations.
        oldCitationList = this.registry.citationreg.citationByIndex.slice();

        // Take a slice of current items, for later use with update.
        oldItemList = this.registry.reflist.slice();

        // Make a list of preview citation ref objects. Omit the current
        // citation, because it will not exist in registry if: (a) this is
        // a new citation; or (b) the calling application is assigning
        // new citationIDs for every transaction.
        var newCitationList = citationsPre.concat(citationsPost);

        // Make a full list of desired ids, for use in preview update,
        // and a hash list of same while we're at it.
        // First step through known citations, then step through
        // the items in the citation for preview.
        var newItemIds = {};
        var newItemIdsList = [];
        for (var i = 0, ilen = newCitationList.length; i < ilen; i += 1) {
            c = this.registry.citationreg.citationById[newCitationList[i][0]];
            for (j = 0, jlen = c.citationItems.length; j < jlen; j += 1) {
                newItemIds[c.citationItems[j].id] = true;
                newItemIdsList.push("" + c.citationItems[j].id);
            }
        }
        for (j = 0, jlen = citation.citationItems.length; j < jlen; j += 1) {
            newItemIds[citation.citationItems[j].id] = true;
            newItemIdsList.push("" + citation.citationItems[j].id);
        }

        // Clone and save off disambigs of items that will be lost.
        oldAmbigs = {};
        for (var i = 0, ilen = oldItemList.length; i < ilen; i += 1) {
            if (!newItemIds[oldItemList[i].id]) {
                var oldAkey = this.registry.registry[oldItemList[i].id].ambig;
                var ids = this.registry.ambigcites[oldAkey];
                if (ids) {
                    for (j = 0, jlen = ids.length; j < jlen; j += 1) {
                        oldAmbigs[ids[j]] = CSL.cloneAmbigConfig(this.registry.registry[ids[j]].disambig);
                    }
                }
            }
        }

        // Update items.  This will produce the base name data and sort things.
        // Possibly unnecessary?
        //this.updateItems(this.registry.mylist.concat(tmpItems));

        //SNIP-START
        if (this.debug) {
            CSL.debug("****** end state save *********");
        }
        //SNIP-END
    }

    this.tmp.taintedCitationIDs = {};
    var sortedItems = [];

    // Styles that use note backreferencing with a by-cite
    // givenname disambiguation rule include the note number
    // in the cite for disambiguation purposes. Correct resolution
    // of disambiguate="true" conditions on first-reference cites 
    // in certain editing scenarios (e.g. where a cite is moved across
    // notes) requires that disambiguation be rerun on cites
    // affected by the edit.
    var rerunAkeys = {};

    // retrieve item data and compose items for use in rendering
    // attach pointer to item data to shared copy for good measure
    for (var i = 0, ilen = citation.citationItems.length; i < ilen; i += 1) {
        // Protect against caller-side overwrites to locator strings etc
        item = {};
        for (var key in citation.citationItems[i]) {
            item[key] = citation.citationItems[i][key];
        }
        Item = this.retrieveItem("" + item.id);
        if (Item.id) {
            this.transform.loadAbbreviation("default", "hereinafter", Item.id);
        }
        item = CSL.parseLocator.call(this, item);
        if (this.opt.development_extensions.static_statute_locator) {
            this.remapSectionVariable([[Item,item]]);
        }
        if (this.opt.development_extensions.locator_label_parse) {
            if (item.locator && ["bill","gazette","legislation","regulation","treaty"].indexOf(Item.type) === -1 && (!item.label || item.label === 'page')) {
                var m = CSL.LOCATOR_LABELS_REGEXP.exec(item.locator);
                if (m) {
                    var tryLabel = CSL.LOCATOR_LABELS_MAP[m[2]];
                    if (this.getTerm(tryLabel)) {
                        item.label = tryLabel;
                        item.locator = m[3];
                    }
                }
            }
        }
        var newitem = [Item, item];
        sortedItems.push(newitem);
        citation.citationItems[i].item = Item;
    }

    // ZZZ sort stuff moved from here.

    // attach the sorted list to the citation item
    citation.sortedItems = sortedItems;
    
    // build reconstituted citations list in current document order
    var citationByIndex = [];
    var citationById = {};
    var lastNotePos;
    for (i=0, ilen=citationsPre.length; i<ilen; i += 1) {
        preCitation = citationsPre[i];
        if (this.opt.development_extensions.strict_inputs) {
            if (citationById[preCitation[0]]) {
                CSL.error("Previously referenced citationID " + preCitation[0] + " encountered in citationsPre");
            }
            if (preCitation[1]) {
                if (lastNotePos > preCitation[1]) {
                    CSL.debug("Note index sequence is not sane at citationsPre[" + i + "]");
                }
                lastNotePos = preCitation[1];
            }
        }
        this.registry.citationreg.citationById[preCitation[0]].properties.noteIndex = preCitation[1];
        citationByIndex.push(this.registry.citationreg.citationById[preCitation[0]]);
        citationById[preCitation[0]] = this.registry.citationreg.citationById[preCitation[0]];
    }
    if (!citation.properties) {
        citation.properties = {
            noteIndex: 0
        };
    }
    if (this.opt.development_extensions.strict_inputs) {
        if (citationById[citation.citationID]) {
            CSL.error("Citation with previously referenced citationID " + citation.citationID);
        }
        if (citation.properties.noteIndex) {
            if (lastNotePos > citation.properties.noteIndex) {
                CSL.debug("Note index sequence is not sane for citation " + citation.citationID);
            }
            lastNotePos = citation.properties.noteIndex;
        }
    }
    citationByIndex.push(citation);
    citationById[citation.citationID] = citation;
    for (i=0, ilen=citationsPost.length; i<ilen; i += 1) {
        postCitation = citationsPost[i];
        if (this.opt.development_extensions.strict_inputs) {
            if (citationById[postCitation[0]]) {
                CSL.error("Previously referenced citationID " + postCitation[0] + " encountered in citationsPost");
            }
            if (postCitation[1]) {
                if (lastNotePos > postCitation[1]) {
                    CSL.debug("Note index sequence is not sane at postCitation[" + i + "]");
                }
                lastNotePos = postCitation[1];
            }
        }
        this.registry.citationreg.citationById[postCitation[0]].properties.noteIndex = postCitation[1];
        citationByIndex.push(this.registry.citationreg.citationById[postCitation[0]]);
        citationById[postCitation[0]] = this.registry.citationreg.citationById[postCitation[0]];
    }
    this.registry.citationreg.citationByIndex = citationByIndex;
    this.registry.citationreg.citationById = citationById;

    //
    // The processor provides three facilities to support
    // updates following position reevaluation.
    //
    // (1) The updateItems() function reports tainted ItemIDs
    // to state.tmp.taintedItemIDs.
    //
    // (2) The processor memos the type of style referencing as
    // CSL.NONE, CSL.NUMERIC or CSL.POSITION in state.opt.update_mode.
    //
    // XXXX: NO LONGER
    // (3) For citations containing cites with backreference note numbers,
    // a string image of the rendered citation is held in
    // citation.properties.backref_citation, and a list of
    // ItemIDs to be used to update the backreference note numbers
    // is memoed at citation.properties.backref_index.  When such
    // citations change position, they can be updated with a
    // series of simple find and replace operations, without
    // need for rerendering.
    //

    //
    // Position evaluation!
    //
    // set positions in reconstituted list, noting taints
    this.registry.citationreg.citationsByItemId = {};
    if (this.opt.update_mode === CSL.POSITION) {
        textCitations = [];
        noteCitations = [];
        citationsInNote = {};
    }
    var update_items = [];
    for (var i = 0, ilen = citationByIndex.length; i < ilen; i += 1) {
        citationByIndex[i].properties.index = i;
        for (j = 0, jlen = citationByIndex[i].sortedItems.length; j < jlen; j += 1) {
            item = citationByIndex[i].sortedItems[j];
            if (!this.registry.citationreg.citationsByItemId[item[1].id]) {
                this.registry.citationreg.citationsByItemId[item[1].id] = [];
                update_items.push("" + item[1].id);
            }
            if (this.registry.citationreg.citationsByItemId[item[1].id].indexOf(citationByIndex[i]) === -1) {
                this.registry.citationreg.citationsByItemId[item[1].id].push(citationByIndex[i]);
            }
        }
        if (this.opt.update_mode === CSL.POSITION) {
            if (citationByIndex[i].properties.noteIndex) {
                noteCitations.push(citationByIndex[i]);
            } else {
                citationByIndex[i].properties.noteIndex = 0;
                textCitations.push(citationByIndex[i]);
            }
        }
    }
    //
    // update bibliography items here
    //
    if (flag !== CSL.ASSUME_ALL_ITEMS_REGISTERED) {
        //SNIP-START
        if (this.debug) {
            CSL.debug("****** start update items *********");
        }
        //SNIP-END
        // true signals implicit updateItems (will not rerun sys.retrieveItem())
        this.updateItems(update_items, null, null, true);
        //SNIP-START
        if (this.debug) {
            CSL.debug("****** endo update items *********");
        }
        //SNIP-END
    }

    if (!this.opt.citation_number_sort && sortedItems && sortedItems.length > 1 && this.citation_sort.tokens.length > 0) {
        for (var i = 0, ilen = sortedItems.length; i < ilen; i += 1) {
            sortedItems[i][1].sortkeys = CSL.getSortKeys.call(this, sortedItems[i][0], "citation_sort");
        }

        /* 
         * Grouped sort stuff (start)
         */

        if (this.opt.grouped_sort &&  !citation.properties.unsorted) {
            // Insert authorstring as key.
            for (var i = 0, ilen = sortedItems.length; i < ilen; i += 1) {
                var sortkeys = sortedItems[i][1].sortkeys;
                this.tmp.authorstring_request = true;
                // Run getAmbiguousCite() with the current disambig
                // parameters, and pick up authorstring from the registry.
                var mydisambig = this.registry.registry[sortedItems[i][0].id].disambig;
                
                this.tmp.authorstring_request = true;
                CSL.getAmbiguousCite.call(this, sortedItems[i][0], mydisambig);
                var authorstring = this.registry.authorstrings[sortedItems[i][0].id];
                this.tmp.authorstring_request = false;

                sortedItems[i][1].sortkeys = [authorstring].concat(sortkeys);
            }

            sortedItems.sort(this.citation.srt.compareCompositeKeys);
            // Replace authorstring key in items with same (authorstring) with the 
            // keystring of first normal key. This forces grouped sorts,
            // as discussed here:
            // https://github.com/citation-style-language/schema/issues/40
            var lastauthor = false;
            var thiskey = false;
            var thisauthor = false;
            for (var i = 0, ilen = sortedItems.length; i < ilen; i += 1) {
                if (sortedItems[i][1].sortkeys[0] !== lastauthor) {
                    thisauthor = sortedItems[i][1].sortkeys[0];
                    thiskey =  sortedItems[i][1].sortkeys[1];
                }
                sortedItems[i][1].sortkeys[0] = "" + thiskey + i;
                lastauthor = thisauthor;
            }
        }
        /*
         * Grouped sort stuff (end)
         */

        if (!citation.properties.unsorted) {
            sortedItems.sort(this.citation.srt.compareCompositeKeys);
        }
    }

    // evaluate parallels
    this.parallel.StartCitation(citation.sortedItems);

    var citations;
    if (this.opt.update_mode === CSL.POSITION) {
        for (var i = 0; i < 2; i += 1) {
            citations = [textCitations, noteCitations][i];
            var first_ref = {};
            var last_ref = {};
            for (j = 0, jlen = citations.length; j < jlen; j += 1) {
                var onecitation = citations[j];
                if (!citations[j].properties.noteIndex) {
                    citations[j].properties.noteIndex = 0;
                }
                citations[j].properties.noteIndex = parseInt(citations[j].properties.noteIndex, 10);
                if (j > 0 && citations[j - 1].properties.noteIndex > citations[j].properties.noteIndex) {
                    citationsInNote = {};
                    first_ref = {};
                    last_ref = {};
                }
                for (k = 0, klen = onecitation.sortedItems.length; k < klen; k += 1) {
                    if (onecitation.sortedItems[k][1].parallel && onecitation.sortedItems[k][1].parallel !== "first") {
                        continue;
                    }
                    if (!citationsInNote[onecitation.properties.noteIndex]) {
                        citationsInNote[onecitation.properties.noteIndex] = 1;
                    } else {
                        citationsInNote[onecitation.properties.noteIndex] += 1;
                    }
                }
                // Set the following:
                //
                // (1) position as required (as per current Zotero)
                // (2) first-reference-note-number as required (on onecitation item)
                // (3) near-note as required (on onecitation item, according to
                //     state.opt["near-note-distance"] parameter)
                // (4) state.registry.citationreg.citationsByItemId.
                //
                // Any state changes caused by unsetting or resetting should
                // trigger a single entry for the citations in
                // state.tmp.taintedCitationIDs (can block on presence of
                // state.registry.citationreg.citationsByItemId).
                //
                for (k = 0, klen = citations[j].sortedItems.length; k < klen; k += 1) {
                    item = citations[j].sortedItems[k];
                    var myid = item[0].id;
                    var myxloc = item[1]["locator-extra"];
                    var mylocator = item[1].locator;
                    var mylabel = item[1].label;
                    if (item[0].legislation_id) {
                        myid = item[0].legislation_id;
                    }
                    var incitationid;
                    var incitationxloc;
                    if (k > 0) {
                        // incitationid is only reached in the else branch
                        // following "undefined" === typeof first_ref[myid]
                        // below
                        if (onecitation.sortedItems[k - 1][0].legislation_id) {
                            incitationid = onecitation.sortedItems[k - 1][0].legislation_id;
                        } else {
                            incitationid = onecitation.sortedItems[k - 1][1].id;
                            incitationxloc = onecitation.sortedItems[k - 1][1]["locator-extra"];
                            //if (onecitation.sortedItems[k-1][1].parallel === "last") {
                                for (var l=k-2; l>-1; l--) {
                                    if (onecitation.sortedItems[l][1].parallel === "first") {
                                        incitationid = onecitation.sortedItems[l][1].id;
                                        incitationxloc = onecitation.sortedItems[l][1]["locator-extra"];
                                    }
                                }
                            //}
                        }
                    }
                    // Don't touch item data of other cites when previewing
                    if (flag === CSL.PREVIEW) {
                        if (onecitation.citationID != citation.citationID) {
                            if ("undefined" === typeof first_ref[item[1].id]) {
                                first_ref[myid] = onecitation.properties.noteIndex;
                                last_ref[myid] = onecitation.properties.noteIndex;
                            } else {
                                last_ref[myid] = onecitation.properties.noteIndex;
                            }
                            continue;
                        }
                    }
                    var oldvalue = {};
                    oldvalue.position = item[1].position;
                    oldvalue["first-reference-note-number"] = item[1]["first-reference-note-number"];
                    oldvalue["near-note"] = item[1]["near-note"];
                    item[1]["first-reference-note-number"] = 0;
                    item[1]["near-note"] = false;
                    if (this.registry.citationreg.citationsByItemId[myid]) {
                        if (this.opt.xclass === 'note' && this.opt.has_disambiguate) {
                            var oldCount = this.registry.registry[myid]["citation-count"];
                            var newCount = this.registry.citationreg.citationsByItemId[myid].length;
                            this.registry.registry[myid]["citation-count"] = this.registry.citationreg.citationsByItemId[myid].length;
                            if ("number" === typeof oldCount) {
                                var oldCountCheck = (oldCount < 2);
                                var newCountCheck = (newCount < 2);
                                if (oldCountCheck !== newCountCheck) {
                                    for (var l=0,llen=this.registry.citationreg.citationsByItemId[myid].length;l<llen;l++) {
                                        rerunAkeys[this.registry.registry[myid].ambig] = true;
                                        this.tmp.taintedCitationIDs[this.registry.citationreg.citationsByItemId[myid][l].citationID] = true;
                                    }
                                }
                            } else {
                                for (var l=0,llen=this.registry.citationreg.citationsByItemId[myid].length;l<llen;l++) {
                                    rerunAkeys[this.registry.registry[myid].ambig] = true;
                                    this.tmp.taintedCitationIDs[this.registry.citationreg.citationsByItemId[myid][l].citationID] = true;
                                }
                            }
                        }
                    }
                    var oldlastid;
                    var oldlastxloc;

                    if ("undefined" === typeof first_ref[myid] && onecitation.properties.mode !== "author-only") {
                        first_ref[myid] = onecitation.properties.noteIndex;
                        if (this.registry.registry[myid]) {
                            this.registry.registry[myid]['first-reference-note-number'] = onecitation.properties.noteIndex;
                        }
                        last_ref[myid] = onecitation.properties.noteIndex;
                        item[1].position = CSL.POSITION_FIRST;
                    } else {
                        //
                        // backward-looking position evaluation happens here.
                        //
                        //
                        //
                        var ibidme = false;
                        var suprame = false;
                        var prevCitation = null;
                        if (j > 0) {
                            var prevCitation = citations[j-1];
                        }
                        var thisCitation = citations[j];
                        // XXX Ugly, but This is used in the second else-if branch condition below.
                        if (j > 0) {
                            var old_last_id_offset = 1;
                            if (prevCitation.properties.mode === "author-only" && j > 1) {
                                old_last_id_offset = 2;
                            }
                            oldlastid =  citations[j - old_last_id_offset].sortedItems.slice(-1)[0][1].id;
                            oldlastxloc =  citations[j - old_last_id_offset].sortedItems.slice(-1)[0][1]["locator-extra"];
                            if (prevCitation.sortedItems[0].slice(-1)[0].legislation_id) {
                                oldlastid = prevCitation.sortedItems[0].slice(-1)[0].legislation_id;
                            }
                        }
                        if (j > 0 && k === 0 && prevCitation.properties.noteIndex !== thisCitation.properties.noteIndex) {
                            // Case 1: source in previous onecitation
                            // (1) Threshold conditions
                            //     (a) there must be a previous onecitation with one item
                            //     (b) this item must be the first in this onecitation
                            //     (c) the previous onecitation must contain a reference
                            //         to the same item ...
                            //     (d) the note numbers must be the same or consecutive.
                            // (this has some jiggery-pokery in it for parallels)
                            var useme = false;
                            // XXX Can oldid be equated with oldlastid, I wonder ...
                            var oldid = prevCitation.sortedItems[0][0].id;
                            if (prevCitation.sortedItems[0][0].legislation_id) {
                                oldid = prevCitation.sortedItems[0][0].legislation_id;
                            }
                            if ((oldid  == myid && prevCitation.properties.noteIndex >= (thisCitation.properties.noteIndex - 1))) {
                                var prevxloc = prevCitation.sortedItems[0][1]["locator-extra"];
                                var thisxloc = thisCitation.sortedItems[0][1]["locator-extra"];
                                if ((citationsInNote[prevCitation.properties.noteIndex] === 1 || prevCitation.properties.noteIndex === 0) && prevxloc === thisxloc) {
                                    useme = true;
                                }
                            }
                            if (useme) {
                                ibidme = true;
                            } else {
                                suprame = true;
                            }
                        } else if (k > 0 && incitationid == myid && incitationxloc == myxloc) {
                            // Case 2: immediately preceding source in this onecitation
                            // (1) Threshold conditions
                            //     (a) there must be an imediately preceding reference to  the
                            //         same item in this onecitation; and
                            ibidme = true;
                        } else if (k === 0 && j > 0 && prevCitation.properties.noteIndex == thisCitation.properties.noteIndex
                                   && prevCitation.sortedItems.length 
                                   && oldlastid == myid && oldlastxloc == myxloc) {
                            // ... in case there are separate citations in the same note ...
                            // Case 2 [take 2]: immediately preceding source in this onecitation
                            // (1) Threshold conditions
                            //     (a) there must be an imediately preceding reference to  the
                            //         same item in this onecitation; and
                            ibidme = true;
                        } else {
                            // everything else is definitely subsequent
                            suprame = true;
                        }
                        // conditions
                        var prev, prev_locator, prev_label, curr_locator, curr_label;
                        if (ibidme) {
                            if (k > 0) {
                                prev = onecitation.sortedItems[(k - 1)][1];
                            } else {
                                prev = citations[(j - 1)].sortedItems[0][1];
                            }
                            if (prev.locator) {
                                if (prev.label) {
                                    prev_label = prev.label;
                                } else {
                                    prev_label = "";
                                }
                                prev_locator = "" + prev.locator + prev_label;
                            } else {
                                prev_locator = prev.locator;
                            }
                            if (mylocator) {
                                if (mylabel) {
                                    curr_label = mylabel;
                                } else {
                                    curr_label = "";
                                }
                                curr_locator = "" + mylocator + curr_label;
                            } else {
                                curr_locator = mylocator;
                            }
                        }
                        // triage
                        if (ibidme && prev_locator && !curr_locator) {
                            ibidme = false;
                            suprame = true;

                        }
                        if (ibidme) {
                            if (!prev_locator && curr_locator) {
                                //     (a) if the previous onecitation had no locator
                                //         and this onecitation has one, use ibid+pages
                                item[1].position = CSL.POSITION_IBID_WITH_LOCATOR;
                            } else if (!prev_locator && !curr_locator) {
                                //     (b) if the previous onecitation had no locator
                                //         and this onecitation also has none, use ibid
                                item[1].position = CSL.POSITION_IBID;
                                //print("setting ibid in cmd_cite()");
                            } else if (prev_locator && curr_locator === prev_locator) {
                                //     (c) if the previous onecitation had a locator
                                //         (page number, etc.) and this onecitation has
                                //         a locator that is identical, use ibid

                                item[1].position = CSL.POSITION_IBID;
                                //print("setting ibid in cmd_cite() [2]");
                            } else if (prev_locator && curr_locator && curr_locator !== prev_locator) {
                                //     (d) if the previous onecitation had a locator,
                                //         and this onecitation has one that differs,
                                //         use ibid+pages
                                item[1].position = CSL.POSITION_IBID_WITH_LOCATOR;
                            } else {
                                //     (e) if the previous onecitation had a locator
                                //         and this onecitation has none, use subsequent
                                //
                                //     ... and everything else would be subsequent also
                                ibidme = false; // just to be clear
                                suprame = true;
                            }
                        }
                        if (suprame) {
                            item[1].position = CSL.POSITION_SUBSEQUENT;
                        }
                        if (suprame || ibidme) {
                            if (onecitation.properties.mode === "author-only") {
                                item[1].position = CSL.POSITION_FIRST;
                            }
                            if (first_ref[myid] != onecitation.properties.noteIndex) {
                                item[1]["first-reference-note-number"] = first_ref[myid];
                                if (this.registry.registry[myid]) {
                                    // This is either the earliest recorded number, or the number of the current citation, whichever is smaller.
                                    var oldFirst = this.registry.citationreg.citationsByItemId[myid][0].properties.noteIndex;
                                    var newFirst = onecitation.properties.noteIndex;
                                    this.registry.registry[myid]['first-reference-note-number'] = newFirst < oldFirst ? newFirst: oldFirst;
                                }
                            }
                        }
                    }
                    if (onecitation.properties.noteIndex) {
                        var note_distance = parseInt(onecitation.properties.noteIndex, 10) - parseInt(last_ref[myid], 10);
                        if (item[1].position !== CSL.POSITION_FIRST 
                            && note_distance <= this.citation.opt["near-note-distance"]) {
                            item[1]["near-note"] = true;
                        }
                        last_ref[myid] = onecitation.properties.noteIndex;
                    }
                    if (onecitation.citationID != citation.citationID) {
                        for (n = 0, nlen = CSL.POSITION_TEST_VARS.length; n < nlen; n += 1) {
                            var param = CSL.POSITION_TEST_VARS[n];
                            if (item[1][param] !== oldvalue[param]) {
                                if (this.registry.registry[myid]) {
                                    if (param === 'first-reference-note-number') {
                                        rerunAkeys[this.registry.registry[myid].ambig] = true;
                                        this.tmp.taintedItemIDs[myid] = true;
                                    }
                                }
                                this.tmp.taintedCitationIDs[onecitation.citationID] = true;
                            }
                        }
                    }
                    if (this.sys.variableWrapper) {
                        item[1].index = onecitation.properties.index;
                        item[1].noteIndex = onecitation.properties.noteIndex;
                    }
                }
            }
        }
    }
    if (this.opt.citation_number_sort && sortedItems && sortedItems.length > 1 && this.citation_sort.tokens.length > 0) {
        if (!citation.properties.unsorted) {
            for (var i = 0, ilen = sortedItems.length; i < ilen; i += 1) {
                sortedItems[i][1].sortkeys = CSL.getSortKeys.call(this, sortedItems[i][0], "citation_sort");
            }
            sortedItems.sort(this.citation.srt.compareCompositeKeys);
        }
    }
    for (var key in this.tmp.taintedItemIDs) {
        if (this.tmp.taintedItemIDs.hasOwnProperty(key)) {
            citations = this.registry.citationreg.citationsByItemId[key];
            // Current citation may be tainted but will not exist
            // during previewing.
            if (citations) {
                for (var i = 0, ilen = citations.length; i < ilen; i += 1) {
                    this.tmp.taintedCitationIDs[citations[i].citationID] = true;
                }
            }
        }
    }

    var ret = [];
    if (flag === CSL.PREVIEW) {
        // If previewing, return only a rendered string
        //SNIP-START
        if (this.debug) {
            CSL.debug("****** start run processor *********");
        }
        //SNIP-END
        try {
            ret = this.process_CitationCluster.call(this, citation.sortedItems, citation);
        } catch (e) {
            CSL.error("Error running CSL processor for preview: "+e);
        }
            
        //SNIP-START
        if (this.debug) {
            CSL.debug("****** end run processor *********");
            CSL.debug("****** start state restore *********");
        }
        //SNIP-END
        // Wind out anything related to new items added for the preview.
        // This means (1) names, (2) disambig state for affected items,
        // (3) keys registered in the ambigs pool arrays, and (4) registry
        // items.
        //

        // restore sliced citations
        this.registry.citationreg.citationByIndex = oldCitationList;
        this.registry.citationreg.citationById = {};
        for (var i = 0, ilen = oldCitationList.length; i < ilen; i += 1) {
            this.registry.citationreg.citationById[oldCitationList[i].citationID] = oldCitationList[i];
        }

        //SNIP-START
        if (this.debug) {
            CSL.debug("****** start final update *********");
        }
        //SNIP-END
        var oldItemIds = [];
        for (var i = 0, ilen = oldItemList.length; i < ilen; i += 1) {
            oldItemIds.push("" + oldItemList[i].id);
        }
        this.updateItems(oldItemIds, null, null, true);
        //SNIP-START
        if (this.debug) {
            CSL.debug("****** end final update *********");
        }
        //SNIP-END
        // Roll back disambig states
        for (var key in oldAmbigs) {
            if (oldAmbigs.hasOwnProperty(key)) {
                this.registry.registry[key].disambig = oldAmbigs[key];
            }
        }
        //SNIP-START
        if (this.debug) {
            CSL.debug("****** end state restore *********");
        }
        //SNIP-END
    } else {
        // Rerun cites that have moved across citations or had a change
        // in their number of subsequent references, so that disambiguate
        // and subsequent-reference-count conditions are applied
        // correctly in output.
        for (var rerunAkey in rerunAkeys) {
            this.disambiguate.run(rerunAkey, citation);
        }
        // Run taints only if not previewing
        //
        // Push taints to the return object
        //
        var obj;
        for (var key in this.tmp.taintedCitationIDs) {
            if (key == citation.citationID) {
                continue;
            }
            var mycitation = this.registry.citationreg.citationById[key];
            if (!mycitation.properties.unsorted) {
                for (var i = 0, ilen = mycitation.sortedItems.length; i < ilen; i += 1) {
                    mycitation.sortedItems[i][1].sortkeys = CSL.getSortKeys.call(this, mycitation.sortedItems[i][0], "citation_sort");
                }
                mycitation.sortedItems.sort(this.citation.srt.compareCompositeKeys);
            }
            // For error reporting
            this.tmp.citation_pos = mycitation.properties.index;
            this.tmp.citation_note_index = mycitation.properties.noteIndex;
            this.tmp.citation_id = "" + mycitation.citationID;
            obj = [];
            obj.push(mycitation.properties.index);
            obj.push(this.process_CitationCluster.call(this, mycitation.sortedItems, mycitation));
            obj.push(mycitation.citationID);
            ret.push(obj);
        }
        this.tmp.taintedItemIDs = {};
        this.tmp.taintedCitationIDs = {};

        // For error reporting again
        this.tmp.citation_pos = citation.properties.index;
        this.tmp.citation_note_index = citation.properties.noteIndex;
        this.tmp.citation_id = "" + citation.citationID;

        obj = [];
        obj.push(citationsPre.length);
        obj.push(this.process_CitationCluster.call(this, sortedItems, citation));
        obj.push(citation.citationID);
        ret.push(obj);
        //
        // note for posterity: Rhino and Spidermonkey produce different
        // sort results for items with matching keys.  That discrepancy
        // turned up a subtle bug in the parallel detection code, trapped
        // at line 266, above, and in line 94 of util_parallel.js.
        //
        ret.sort(function (a, b) {
            if (a[0] > b[0]) {
                return 1;
            } else if (a[0] < b[0]) {
                return -1;
            } else {
                return 0;
            }
        });
        //
        // In normal rendering, return is a list of two-part arrays, with the first element
        // a citation index number, and the second the text to be inserted.
        //
    }
    this.registry.return_data.citation_errors = this.tmp.citation_errors.slice();
    return [this.registry.return_data, ret];
};

CSL.Engine.prototype.process_CitationCluster = function (sortedItems, citation) {
    var str = "";
    // Parallels must be evaluated in the calling function
    //this.parallel.StartCitation(sortedItems);
    if (citation && citation.properties && citation.properties.mode === "composite") {
        citation.properties.mode = "author-only";
        var firstChunk = CSL.getCitationCluster.call(this, sortedItems, citation);
        citation.properties.mode = "suppress-author";
        var secondChunk = "";
        if (citation.properties.infix) {
            this.output.append(citation.properties.infix);
            secondChunk = this.output.string(this, this.output.queue);
            // Had no idea this could return a single-element array! Go figure.
            if ("object" === typeof secondChunk) {
                secondChunk = secondChunk.join("");
            }
        }
        var thirdChunk = CSL.getCitationCluster.call(this, sortedItems, citation);
        citation.properties.mode = "composite";
        if (firstChunk && secondChunk && CSL.SWAPPING_PUNCTUATION.concat(["\u2019", "\'"]).indexOf(secondChunk[0]) > -1) {
            firstChunk += secondChunk;
            secondChunk = false;
        }
        str = [firstChunk, secondChunk, thirdChunk].filter(function(obj) {
            return obj;
        }).join(" ");
    } else {
        str = CSL.getCitationCluster.call(this, sortedItems, citation);
    }
    return str;
};

CSL.Engine.prototype.makeCitationCluster = function (rawList) {
    var inputList, newitem, str, pos, len, item, Item;
    inputList = [];
    len = rawList.length;
    for (pos = 0; pos < len; pos += 1) {
        item = {};
        for (var key in rawList[pos]) {
            item[key] = rawList[pos][key];
        }
        Item = this.retrieveItem("" + item.id);
        // Code block is copied from processCitationCluster() above
        if (this.opt.development_extensions.locator_label_parse) {
            if (item.locator && ["bill","gazette","legislation","regulation","treaty"].indexOf(Item.type) === -1 && (!item.label || item.label === 'page')) {
                var m = CSL.LOCATOR_LABELS_REGEXP.exec(item.locator);
                if (m) {
                    var tryLabel = CSL.LOCATOR_LABELS_MAP[m[2]];
                    if (this.getTerm(tryLabel)) {
                        item.label = tryLabel;
                        item.locator = m[3];
                    }
                }
            }
        }
        if (item.locator) {
            item.locator = ("" + item.locator).replace(/\s+$/, '');
        }
        newitem = [Item, item];
        inputList.push(newitem);
    }
    if (this.opt.development_extensions.static_statute_locator) {
        this.remapSectionVariable(inputList);
    }
    if (inputList && inputList.length > 1 && this.citation_sort.tokens.length > 0) {
        len = inputList.length;
        for (pos = 0; pos < len; pos += 1) {
            inputList[pos][1].sortkeys = CSL.getSortKeys.call(this, inputList[pos][0], "citation_sort");
        }
        inputList.sort(this.citation.srt.compareCompositeKeys);
    }
    this.tmp.citation_errors = [];
    this.parallel.StartCitation(inputList);
    var str = CSL.getCitationCluster.call(this, inputList);
    return str;
};


/**
 * Get the undisambiguated version of a cite, without decorations
 * <p>This is used internally by the Registry.</p>
 *
 * [object] CSL Item
 * [object] disambiguation parameters
 * [boolean] If true, include first-reference-note-number value in cite
 */
CSL.getAmbiguousCite = function (Item, disambig, visualForm, item) {
    var ret;
    var flags = this.tmp.group_context.tip;
    var oldTermSiblingLayer = {
        term_intended: flags.term_intended,
        variable_attempt: flags.variable_attempt,
        variable_success: flags.variable_success,
        output_tip: flags.output_tip,
        label_form: flags.label_form,
        parallel_condition: flags.parallel_condition,
        parallel_result: flags.parallel_result,
        no_repeat_condition: flags.no_repeat_condition,
        parallel_repeats: flags.parallel_result,
        condition: flags.condition,
        force_suppress: flags.force_suppress,
        done_vars: flags.done_vars.slice()
    };
    if (disambig) {
        this.tmp.disambig_request = disambig;
    } else {
        this.tmp.disambig_request = false;
    }
    var itemSupp = {
        position: 1,
        "near-note": true
    };

    if (item) {
        itemSupp.locator = item.locator;
        itemSupp.label = item.label;
    }

    if (this.registry.registry[Item.id] 
        && this.registry.citationreg.citationsByItemId
        && this.registry.citationreg.citationsByItemId[Item.id]
        && this.registry.citationreg.citationsByItemId[Item.id].length 
        && visualForm) {
        if (this.citation.opt["givenname-disambiguation-rule"] === "by-cite") {
            itemSupp['first-reference-note-number'] = this.registry.registry[Item.id]['first-reference-note-number'];
        }
    }
    this.tmp.area = "citation";
    this.tmp.root = "citation";
    var origSuppressDecorations = this.tmp.suppress_decorations;
    this.tmp.suppress_decorations = true;
    this.tmp.just_looking = true;

    CSL.getCite.call(this, Item, itemSupp, null, false);
    // !!!
    for (var i=0,ilen=this.output.queue.length;i<ilen;i+=1) {
        CSL.Output.Queue.purgeEmptyBlobs(this.output.queue[i]);
    }
    if (this.opt.development_extensions.clean_up_csl_flaws) {
        for (var j=0,jlen=this.output.queue.length;j<jlen;j+=1) {
            this.output.adjust.upward(this.output.queue[j]);
            this.output.adjust.leftward(this.output.queue[j]);
            this.output.adjust.downward(this.output.queue[j]);
            this.output.adjust.fix(this.output.queue[j]);
        }
    }
    var ret = this.output.string(this, this.output.queue);
    this.tmp.just_looking = false;
    this.tmp.suppress_decorations = origSuppressDecorations;
    // Cache the result.
    this.tmp.group_context.replace(oldTermSiblingLayer);
    return ret;
};

/**
 * Return delimiter for use in join
 * <p>Splice evaluation is done during cite
 * rendering, and this method returns the
 * result.  Evaluation requires three items
 * of information from the preceding cite, if
 * one is present: the names used; the years
 * used; and the suffix appended to the
 * citation.  These details are copied into
 * the state object before processing begins,
 * and are cleared by the processor on
 * completion of the run.</p>
 */

CSL.getSpliceDelimiter = function (last_locator, last_collapsed, pos) {
    //print(pos +  " after-collapse-delimiter="+this.citation.opt["after-collapse-delimiter"] + "\n  cite_group_delimiter=" + this.tmp.use_cite_group_delimiter + "\n  last_collapsed=" +last_collapsed + "\n  have_collapsed=" +this.tmp.have_collapsed + "\n  last_locator=" + last_locator)
    if (undefined !== this.citation.opt["after-collapse-delimiter"]) {
        if (last_locator) {
            this.tmp.splice_delimiter = this.citation.opt["after-collapse-delimiter"];
        } else if (last_collapsed && !this.tmp.have_collapsed) {
            this.tmp.splice_delimiter = this.citation.opt["after-collapse-delimiter"];
        } else if (!last_collapsed && !this.tmp.have_collapsed && this.citation.opt.collapse !== "year-suffix") {
            this.tmp.splice_delimiter = this.citation.opt["after-collapse-delimiter"];
        } else {
            this.tmp.splice_delimiter = this.citation.opt.layout_delimiter;
        }
    } else if (this.tmp.use_cite_group_delimiter) {
        this.tmp.splice_delimiter = this.citation.opt.cite_group_delimiter;
    } else {
        if (this.tmp.have_collapsed && this.opt.xclass === "in-text" && this.opt.update_mode !== CSL.NUMERIC) {
            this.tmp.splice_delimiter = ", ";
        } else if (this.tmp.cite_locales[pos - 1]) {
            //
            // Must have a value to take effect.  Use zero width space to force empty delimiter.
            var alt_affixes = this.tmp.cite_affixes[this.tmp.area][this.tmp.cite_locales[pos - 1]];
            if (alt_affixes && alt_affixes.delimiter) {
                this.tmp.splice_delimiter = alt_affixes.delimiter;
            }
        } else if (!this.tmp.splice_delimiter) {
            // This happens when no delimiter is set on cs:layout under cs:citation
            this.tmp.splice_delimiter = "";
        }
    }

/*
    if (last_locator && "string" === typeof this.citation.opt["after-collapse-delimiter"]) {
        this.tmp.splice_delimiter = this.citation.opt["after-collapse-delimiter"];
    } else if (last_collapsed && !this.tmp.have_collapsed && "string" === typeof this.citation.opt["after-collapse-delimiter"]) {
        this.tmp.splice_delimiter = this.citation.opt["after-collapse-delimiter"];
    } else if (!last_collapsed && !this.tmp.have_collapsed && "string" === typeof this.citation.opt["after-collapse-delimiter"] && !this.citation.opt.collapse === "year-suffix") {
        this.tmp.splice_delimiter = this.citation.opt["after-collapse-delimiter"];
    } else if (this.tmp.use_cite_group_delimiter) {
        this.tmp.splice_delimiter = this.citation.opt.cite_group_delimiter;
    } else if (this.tmp.have_collapsed && this.opt.xclass === "in-text" && this.opt.update_mode !== CSL.NUMERIC) {
        this.tmp.splice_delimiter = ", ";
    } else if (this.tmp.cite_locales[pos - 1]) {
        //
        // Must have a value to take effect.  Use zero width space to force empty delimiter.
        var alt_affixes = this.tmp.cite_affixes[this.tmp.area][this.tmp.cite_locales[pos - 1]];
        if (alt_affixes && alt_affixes.delimiter) {
            this.tmp.splice_delimiter = alt_affixes.delimiter;
        }
    } else if (!this.tmp.splice_delimiter) {
        // This happens when no delimiter is set on cs:layout under cs:citation
        this.tmp.splice_delimiter = "";
    }
*/
    // Paranoia
    //if (!this.tmp.splice_delimiter) {
    //    this.tmp.splice_delimiter = "";
    //}
    return this.tmp.splice_delimiter;
};

/*
 * Compose individual cites into a single string, with
 * flexible inter-cite splicing.
 */
CSL.getCitationCluster = function (inputList, citation) {
    var result, objects, myparams, len, pos, item, last_collapsed, params, empties, composite, compie, myblobs, Item, llen, ppos, obj, preceding_item, txt_esc, error_object, citationID, authorOnly, suppressAuthor;
    var citation_prefix = "";
    this.output.checkNestedBrace = new CSL.checkNestedBrace(this);
    if (citation) {
        citationID = citation.citationID;
        authorOnly = citation.properties.mode === "author-only" ? !!citation.properties.mode : false;
        if (this.opt.xclass !== "note") {
            suppressAuthor = citation.properties.mode === "suppress-author" ? !!citation.properties.mode : false;
        }
        if (citation.properties.prefix) {
            citation_prefix = CSL.checkPrefixSpaceAppend(this, citation.properties.prefix);
        }
    }
    inputList = inputList ? inputList : [];
    this.tmp.last_primary_names_string = false;
    txt_esc = CSL.getSafeEscape(this);
    this.tmp.area = "citation";
    this.tmp.root = "citation";
    result = "";
    objects = [];
    this.tmp.last_suffix_used = "";
    this.tmp.last_names_used = [];
    this.tmp.last_years_used = [];
    this.tmp.backref_index = [];
    this.tmp.cite_locales = [];

    var use_layout_prefix = this.output.checkNestedBrace.update(this.citation.opt.layout_prefix + citation_prefix);
    //var use_layout_prefix = this.citation.opt.layout_prefix;

    var suppressTrailingPunctuation = false;
    if (this.opt.xclass === "note" && this.citation.opt.suppressTrailingPunctuation) {
        suppressTrailingPunctuation = true;
    }
    if (citationID) {
        //this.registry.citationreg.citationById[citationID].properties.backref_index = false;
        //this.registry.citationreg.citationById[citationID].properties.backref_citation = false;
        if (this.registry.citationreg.citationById[citationID].properties["suppress-trailing-punctuation"]) {
            suppressTrailingPunctuation = true;
        }
    }

    // Adjust locator positions if that looks like a sensible thing to do.
    if (this.opt.xclass === "note") {
        var parasets = [];
        var lastTitle = false;
        var lastPosition = false;
        var lastID = false;
        var lst = [];
        for (var i=0, ilen = inputList.length; i < ilen; i += 1) {
            var type = inputList[i][0].type;
            var title = inputList[i][0].title;
            var position = inputList[i][1].position;
            var id = inputList[i][0].id;
            if (title && type === "legal_case" && id !== lastID && position) {
                // Start a fresh sublist if the item title does not match the last one
                if (title !== lastTitle || parasets.length === 0) {
                    lst = [];
                    parasets.push(lst);
                }
                lst.push(inputList[i][1]);
            }
            lastTitle = title;
            lastPosition = position;
            lastID = id;
        }
        // We now have a list of sublists, each w/matching titles
        for (i=0, ilen=parasets.length; i < ilen; i += 1) {
            lst = parasets[i];
            if (lst.length < 2) {
                continue;
            }
            // Get the locator in last position, but only if it's the only one in the set.
            var locatorInLastPosition = lst.slice(-1)[0].locator;
            if (locatorInLastPosition) {
                for (var j=0, jlen=lst.length - 1; j < jlen; j += 1) {
                    if (lst[j].locator) {
                        locatorInLastPosition = false;
                    }
                }
            }
            // move the locator here, if it's called for.
            if (locatorInLastPosition) {
                lst[0].locator = locatorInLastPosition;
                delete lst.slice(-1)[0].locator;
                lst[0].label = lst.slice(-1)[0].label;
                if (lst.slice(-1)[0].label) {
                    delete lst.slice(-1)[0].label;
                }
            }
       }
    }
    myparams = [];
    len = inputList.length;
    if (inputList[0] && inputList[0][1]) {
        if (authorOnly) {
            delete inputList[0][1]["suppress-author"];
            inputList[0][1]["author-only"] = true;
        } else if (suppressAuthor) {
            delete inputList[0][1]["author-only"];
            inputList[0][1]["suppress-author"] = true;
        }
    }
    for (pos = 0; pos < len; pos += 1) {
        Item = inputList[pos][0];
        item = inputList[pos][1];
        item = CSL.parseLocator.call(this, item);
        last_collapsed = this.tmp.have_collapsed;
        var last_locator = false;
        if (pos > 0 && inputList[pos-1][1]) {
            last_locator = !!inputList[pos-1][1].locator;
        }
        params = {};
        
        // Reset shadow_numbers here, suppress reset in getCite()
        this.tmp.shadow_numbers = {};
        if (!this.tmp.just_looking && this.opt.hasPlaceholderTerm) {
            var output = this.output;
            this.output = new CSL.Output.Queue(this);
            this.output.adjust = new CSL.Output.Queue.adjust();
            CSL.getAmbiguousCite.call(this, Item, null, false, item);
            this.output = output;
        }

        this.tmp.in_cite_predecessor = false;
        // true is to block reset of shadow numbers
        if (pos > 0) {
            CSL.getCite.call(this, Item, item, "" + inputList[(pos - 1)][0].id, true);
        } else {
            this.tmp.term_predecessor = false;
            CSL.getCite.call(this, Item, item, null, true);
        }

        // Make a note of any errors
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
        params.splice_delimiter = CSL.getSpliceDelimiter.call(this, last_locator, last_collapsed, pos);
        // XXX This appears to be superfluous.
        if (item && item["author-only"]) {
            this.tmp.suppress_decorations = true;
        }

        if (pos > 0) {
            preceding_item = inputList[pos - 1][1];

            // XXX OR if preceding suffix is empty, and the current prefix begins with a full stop.

            var precedingEndsInPeriodOrComma = preceding_item.suffix && [";", ".", ","].indexOf(preceding_item.suffix.slice(-1)) > -1;
            var currentStartsWithPeriodOrComma = !preceding_item.suffix && item.prefix && [";", ".", ","].indexOf(item.prefix.slice(0, 1)) > -1;
            if (precedingEndsInPeriodOrComma || currentStartsWithPeriodOrComma) {
                var spaceidx = params.splice_delimiter.indexOf(" ");
                if (spaceidx > -1 && !currentStartsWithPeriodOrComma) {
                    params.splice_delimiter = params.splice_delimiter.slice(spaceidx);
                } else {
                    params.splice_delimiter = "";
                }
            }
        }
        params.suppress_decorations = this.tmp.suppress_decorations;
        params.have_collapsed = this.tmp.have_collapsed;
        //
        // XXXXX: capture parameters to an array, which
        // will be of the same length as this.output.queue,
        // corresponding to each element.
        //
        myparams.push(params);
        if (item["author-only"]) {
            break;
        }
    }

    this.parallel.purgeGroupsIfParallel();
    //
    // output.queue is a simple array.  do a slice
    // of it to get each cite item, setting params from
    // the array that was built in the preceding loop.
    //
    empties = 0;
    myblobs = this.output.queue.slice();

    var citation_suffix = "";
    if (citation) {
        citation_suffix = CSL.checkSuffixSpacePrepend(this, citation.properties.suffix);
    }
    var suffix = this.citation.opt.layout_suffix;
    var last_locale = this.tmp.cite_locales[this.tmp.cite_locales.length - 1];
    //
    // Must have a value to take effect.  Use zero width space to force empty suffix.
    if (last_locale && this.tmp.cite_affixes[this.tmp.area][last_locale] && this.tmp.cite_affixes[this.tmp.area][last_locale].suffix) {
        suffix = this.tmp.cite_affixes[this.tmp.area][last_locale].suffix;
    }
    if (CSL.TERMINAL_PUNCTUATION.slice(0, -1).indexOf(suffix.slice(0, 1)) > -1) {
        suffix = suffix.slice(0, 1);
    }
    //print("=== FROM CITE ===");
    suffix = this.output.checkNestedBrace.update(citation_suffix + suffix);


    for (var i=0,ilen=this.output.queue.length;i<ilen;i+=1) {
        CSL.Output.Queue.purgeEmptyBlobs(this.output.queue[i]);
    }
    if (!this.tmp.suppress_decorations && this.output.queue.length) {
        if (!(this.opt.development_extensions.apply_citation_wrapper
              && this.sys.wrapCitationEntry
               && !this.tmp.just_looking
              && this.tmp.area === "citation")) { 

            if (!suppressTrailingPunctuation) {
                this.output.queue[this.output.queue.length - 1].strings.suffix = suffix;
            }
            this.output.queue[0].strings.prefix = use_layout_prefix;
        }
    }
    if (this.opt.development_extensions.clean_up_csl_flaws) {
        for (var j=0,jlen=this.output.queue.length;j<jlen;j+=1) {
            //print("OUTPUT[5]: "+JSON.stringify(this.output.queue[j],['strings','prefix','suffix','delimiter','blobs','decorations'],2))
            this.output.adjust.upward(this.output.queue[j]);
            //print("OUTPUT[4]: "+JSON.stringify(this.output.queue[j],['strings','prefix','suffix','delimiter','blobs','decorations'],2))
            this.output.adjust.leftward(this.output.queue[j]);
            //print("OUTPUT[3]: "+JSON.stringify(this.output.queue[j],['strings','prefix','suffix','delimiter','blobs','decorations'],2))
            this.output.adjust.downward(this.output.queue[j]);
            //print("OUTPUT[2]: "+JSON.stringify(this.output.queue[j],['strings','prefix','suffix','delimiter','blobs','decorations'],2))
            this.tmp.last_chr = this.output.adjust.fix(this.output.queue[j]);
            //print("OUTPUT[1]: "+JSON.stringify(this.output.queue[j],['strings','prefix','suffix','delimiter','blobs','decorations','num'],2))
        }
    }
    //print("this.tmp.last_chr="+this.tmp.last_chr);
    for (pos = 0, len = myblobs.length; pos < len; pos += 1) {
        var buffer = [];
        this.output.queue = [myblobs[pos]];
        this.tmp.suppress_decorations = myparams[pos].suppress_decorations;
        this.tmp.splice_delimiter = myparams[pos].splice_delimiter;
        //
        // oh, one last second thought on delimiters ...
        //

        if (myblobs[pos].parallel_delimiter) {
            this.tmp.splice_delimiter = myblobs[pos].parallel_delimiter;
        }
        this.tmp.have_collapsed = myparams[pos].have_collapsed;

        composite = this.output.string(this, this.output.queue);

        this.tmp.suppress_decorations = false;
        // meaningless assignment
        // this.tmp.handle_ranges = false;
        if ("string" === typeof composite) {
            this.tmp.suppress_decorations = false;
            if (!composite) {
                if (this.opt.development_extensions.throw_on_empty) {
                    CSL.error("Citation would render no content");
                } else {
                    composite = "[NO_PRINTED_FORM]"
                }
            }
            return composite;
        }
        if ("object" === typeof composite && composite.length === 0 && !item["suppress-author"]) {
            var errStr = "[CSL STYLE ERROR: reference with no printed form.]";
            var preStr = pos === 0 ? txt_esc(this.citation.opt.layout_prefix) : "";
            var sufStr = pos === (myblobs.length - 1) ? txt_esc(this.citation.opt.layout_suffix) : "";
            composite.push(preStr + errStr + sufStr);
        }
        if (buffer.length && "string" === typeof composite[0]) {
            composite.reverse();
            var tmpstr = composite.pop();
            if (tmpstr && tmpstr.slice(0, 1) === ",") {
                buffer.push(tmpstr);
            } else if ("string" == typeof buffer.slice(-1)[0] && buffer.slice(-1)[0].slice(-1) === ",") {
                buffer.push(" " + tmpstr);
            } else if (tmpstr) {
                buffer.push(txt_esc(this.tmp.splice_delimiter) + tmpstr);
            }
        } else {
            composite.reverse();
            compie = composite.pop();
            if ("undefined" !== typeof compie) {
                if (buffer.length && "string" === typeof buffer[buffer.length - 1]) {
                    buffer[buffer.length - 1] += compie.successor_prefix;
                }
                buffer.push(compie);
            }
        }
        // Seems odd, but this was unnecessary and broken.
        //composite.reverse();
        llen = composite.length;
        for (ppos = 0; ppos < llen; ppos += 1) {
            obj = composite[ppos];
            if ("string" === typeof obj) {
                buffer.push(txt_esc(this.tmp.splice_delimiter) + obj);
                continue;
            }
            compie = composite.pop();
            if ("undefined" !== typeof compie) {
                buffer.push(compie);
            }
        }
        if (buffer.length === 0 && !inputList[pos][1]["suppress-author"]) {
            empties += 1;
        }
        if (buffer.length > 1 && typeof buffer[0] !== "string") {
            buffer = [this.output.renderBlobs(buffer)];
        }
        if (buffer.length) {
            if ("string" === typeof buffer[0]) {
                if (pos > 0) {
                    buffer[0] = txt_esc(this.tmp.splice_delimiter) + buffer[0];
                }
            } else {
                if (pos > 0) {
                    buffer[0].splice_prefix = this.tmp.splice_delimiter;
                } else {
                    buffer[0].splice_prefix = "";
                }
            }
        }
        objects = objects.concat(buffer);
    }
    // print("OBJECTS="+objects);
    result += this.output.renderBlobs(objects);

    if (result) {
        //if (CSL.TERMINAL_PUNCTUATION.indexOf(this.tmp.last_chr) > -1 
        //    && this.tmp.last_chr === use_layout_suffix.slice(0, 1)) {
        //    use_layout_suffix = use_layout_suffix.slice(1);
        //}
        if (!this.tmp.suppress_decorations) {
            len = this.citation.opt.layout_decorations.length;
            for (pos = 0; pos < len; pos += 1) {
                params = this.citation.opt.layout_decorations[pos];
                // The "normal" formats in some output modes expect
                // a superior nested decoration environment, and
                // so should produce no output here.
                if (params[1] === "normal") {
                    continue;
                }
                if (!item || !item["author-only"]) {
                    result = this.fun.decorate[params[0]][params[1]](this, result);
                }
            }
        }
    }
    this.tmp.suppress_decorations = false;
    if (!result) {
        if (this.opt.development_extensions.throw_on_empty) {
            CSL.error("Citation would render no content");
        } else {
            result = "[NO_PRINTED_FORM]"
        }
    }
    return result;
};

/*
 * Render a single cite item.
 *
 * This is called on the state object, with a single
 * Item as input.  It iterates exactly once over the style
 * citation tokens, and leaves the result of rendering in
 * the top-level list in the relevant *.opt.output
 * stack, as a list item consisting of a single string.
 *
 * (This is dual-purposed for generating individual
 * entries in a bibliography.)
 */
CSL.getCite = function (Item, item, prevItemID, blockShadowNumberReset) {
    var next, error_object;
    var areaOrig = this.tmp.area;
    if (item && item["author-only"] && this.intext && this.intext.tokens.length > 0) {
            this.tmp.area = "intext";
    }
    this.tmp.cite_renders_content = false;
    this.tmp.probably_rendered_something = false;

    CSL.citeStart.call(this, Item, item, blockShadowNumberReset);
    next = 0;
    this.tmp.name_node = {};
    this.nameOutput = new CSL.NameOutput(this, Item, item);

    // rerun?
    while (next < this[this.tmp.area].tokens.length) {
        next = CSL.tokenExec.call(this, this[this.tmp.area].tokens[next], Item, item);
    }

    CSL.citeEnd.call(this, Item, item);
    // Odd place for this, but it seems to fit here
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
    this.tmp.area = areaOrig;
    return "" + Item.id;
};


CSL.citeStart = function (Item, item, blockShadowNumberReset) {
    if (!blockShadowNumberReset) {
        this.tmp.shadow_numbers = {};
    }
    this.tmp.disambiguate_count = 0;
    this.tmp.disambiguate_maxMax = 0;
    this.tmp.same_author_as_previous_cite = false;
    if (!this.tmp.suppress_decorations) {
        this.tmp.subsequent_author_substitute_ok = true;
    } else {
        this.tmp.subsequent_author_substitute_ok = false;
    }
    this.tmp.lastchr = "";
    if (this.tmp.area === "citation" && this.citation.opt.collapse && this.citation.opt.collapse.length) {
        //this.tmp.have_collapsed = "year";
        this.tmp.have_collapsed = true;
    } else {
        this.tmp.have_collapsed = false;
    }
    this.tmp.render_seen = false;
    if (this.tmp.disambig_request  && ! this.tmp.disambig_override) {
        this.tmp.disambig_settings = this.tmp.disambig_request;
    } else if (this.registry.registry[Item.id] && ! this.tmp.disambig_override) {
        this.tmp.disambig_request = this.registry.registry[Item.id].disambig;
        this.tmp.disambig_settings = this.registry.registry[Item.id].disambig;
    } else {
        this.tmp.disambig_settings = new CSL.AmbigConfig();
    }
    if (this.tmp.area !== 'citation') {
        if (!this.registry.registry[Item.id]) {
            this.tmp.disambig_restore = new CSL.AmbigConfig();
        } else {
            this.tmp.disambig_restore = CSL.cloneAmbigConfig(this.registry.registry[Item.id].disambig);
            if (this.tmp.area === 'bibliography' && this.tmp.disambig_settings && this.tmp.disambig_override) {
                if (this.opt["disambiguate-add-names"]) {
                    this.tmp.disambig_settings.names = this.registry.registry[Item.id].disambig.names.slice();
                    if (this.tmp.disambig_request) {
                        this.tmp.disambig_request.names = this.registry.registry[Item.id].disambig.names.slice();
                    }
                }
                if (this.opt["disambiguate-add-givenname"]) {
                    // This is weird and delicate and not fully understood
                    this.tmp.disambig_request = this.tmp.disambig_settings;
                    this.tmp.disambig_settings.givens = this.registry.registry[Item.id].disambig.givens.slice();
                    this.tmp.disambig_request.givens = this.registry.registry[Item.id].disambig.givens.slice();
                    for (var i=0,ilen=this.tmp.disambig_settings.givens.length;i<ilen;i+=1) {
                        this.tmp.disambig_settings.givens[i] = this.registry.registry[Item.id].disambig.givens[i].slice();
                    }
                    for (var i=0,ilen=this.tmp.disambig_request.givens.length;i<ilen;i+=1) {
                        this.tmp.disambig_request.givens[i] = this.registry.registry[Item.id].disambig.givens[i].slice();
                    }
                }
            }
        }
    }

    this.tmp.names_used = [];
    this.tmp.nameset_counter = 0;
    this.tmp.years_used = [];
    this.tmp.names_max.clear();

    this.tmp.splice_delimiter = this[this.tmp.area].opt.layout_delimiter;
    //this.tmp.splice_delimiter = this[this.tmp.area].opt.delimiter;

    this.bibliography_sort.keys = [];
    this.citation_sort.keys = [];

    this.tmp.has_done_year_suffix = false;
    this.tmp.last_cite_locale = false;
    // SAVE PARAMETERS HERE, IF APPROPRIATE
    // (promiscuous addition of global parameters => death by a thousand cuts)
    if (!this.tmp.just_looking && item && !item.position && this.registry.registry[Item.id]) {
        this.tmp.disambig_restore = CSL.cloneAmbigConfig(this.registry.registry[Item.id].disambig);
    }
    // XXX This only applied to the "number" variable itself? Huh?
    //this.setNumberLabels(Item);
    this.tmp.first_name_string = false;
    this.tmp.authority_stop_last = 0;
};

CSL.citeEnd = function (Item, item) {
    // RESTORE PARAMETERS IF APPROPRIATE
    if (this.tmp.disambig_restore && this.registry.registry[Item.id]) {
        this.registry.registry[Item.id].disambig.names = this.tmp.disambig_restore.names.slice();
        this.registry.registry[Item.id].disambig.givens = this.tmp.disambig_restore.givens.slice();
        for (var i=0,ilen=this.registry.registry[Item.id].disambig.givens.length;i<ilen;i+=1) {
            this.registry.registry[Item.id].disambig.givens[i] = this.tmp.disambig_restore.givens[i].slice();
        }
    }
    this.tmp.disambig_restore = false;

    if (item && item.suffix) {
        //this.tmp.last_suffix_used = this.tmp.suffix.value();
        this.tmp.last_suffix_used = item.suffix;
    } else {
        this.tmp.last_suffix_used = "";
    }
    this.tmp.last_years_used = this.tmp.years_used.slice();
    this.tmp.last_names_used = this.tmp.names_used.slice();
    this.tmp.cut_var = false;

    // This is a hack, in a way; I have lost track of where
    // the disambig (name rendering) settings used for rendering work their way
    // into the registry.  This resets defaults to the subsequent form,
    // when first cites are rendered.
    //if (this.tmp.disambig_restore && this.registry.registry[Item.id]) {
    //    this.registry.registry[Item.id].disambig = this.tmp.disambig_restore;
    //}
    //this.tmp.disambig_restore = false;
    this.tmp.disambig_request = false;

    this.tmp.cite_locales.push(this.tmp.last_cite_locale);

    if (this.tmp.issued_date && this.tmp.renders_collection_number) {
        var buf = [];
        for (var i = this.tmp.issued_date.list.length - 1; i > this.tmp.issued_date.pos; i += -1) {
            buf.push(this.tmp.issued_date.list.pop());
        }
        // Throw away the unwanted blob
        this.tmp.issued_date.list.pop();
        // Put the other stuff back
        for (i = buf.length - 1; i > -1; i += -1) {
            this.tmp.issued_date.list.push(buf.pop());
        }
    }
    this.tmp.issued_date = false;
    this.tmp.renders_collection_number = false;

};

/*global CSL: true */

CSL.Engine.prototype.makeBibliography = function (bibsection) {
    var debug, ret, params, maxoffset, item, len, pos, tok, tokk, tokkk, entry_ids, entry_strings;
    debug = false;
    if (!bibsection && (this.bibliography.opt.exclude_types || this.bibliography.opt.exclude_with_fields)) {
        bibsection = {
            exclude: []
        };
        if (this.bibliography.opt.exclude_types) {
            for (var i in this.bibliography.opt.exclude_types) {
                var val = this.bibliography.opt.exclude_types[i];
                bibsection.exclude.push({
                    field: "type",
                    value: val
                });
            }
        }
        if (this.bibliography.opt.exclude_with_fields) {
            for (var i in this.bibliography.opt.exclude_with_fields) {
                var field = this.bibliography.opt.exclude_with_fields[i];
                bibsection.exclude.push({
                    field: field, value: true
                });
            }
        }
    }
    // API change: added in version 1.0.51
    if (!this.bibliography.tokens.length) {
        return false;
    }
    if ("string" === typeof bibsection) {
        this.opt.citation_number_slug = bibsection;
        bibsection = false;
    }
    //SNIP-START
    if (debug) {
        len = this.bibliography.tokens.length;
        for (pos = 0; pos < len; pos += 1) {
            tok = this.bibliography.tokens[pos];
            CSL.debug("bibtok: " + tok.name);
        }
        CSL.debug("---");
        len = this.citation.tokens.length;
        for (pos = 0; pos < len; pos += 1) {
            tokk = this.citation.tokens[pos];
            CSL.debug("cittok: " + tok.name);
        }
        CSL.debug("---");
        len = this.bibliography_sort.tokens.length;
        for (pos = 0; pos < len; pos += 1) {
            tokkk = this.bibliography_sort.tokens[pos];
            CSL.debug("bibsorttok: " + tok.name);
        }
    }
    //SNIP-END

    // For paged returns
    ret = CSL.getBibliographyEntries.call(this, bibsection);
    entry_ids = ret[0];
    entry_strings = ret[1];

    // For paged returns
    var done = ret[2];

    params = {
        "maxoffset": 0,
        "entryspacing": this.bibliography.opt["entry-spacing"],
        "linespacing": this.bibliography.opt["line-spacing"],
        "second-field-align": false,
        "entry_ids": entry_ids,
        "bibliography_errors": this.tmp.bibliography_errors.slice(),
        "done": done
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

/*
 * Compose individual cites into a single string.
 */
CSL.getBibliographyEntries = function (bibsection) {
    var ret, input, include, anymatch, allmatch, bib_entry, res, item, spec, lllen, pppos, topblobs, entry_item_ids, debug, collapse_parallel, i, ilen, siblings, skips, sortedItems, eyetem, entry_item_data, j, jlen;
    ret = [];
    entry_item_data = [];
    this.tmp.area = "bibliography";
    this.tmp.root = "bibliography";
    this.tmp.last_rendered_name = false;
    this.tmp.bibliography_errors = [];
    this.tmp.bibliography_pos = 0;

    // For paged returns: disable generated entries and
    // do not fetch full items as a batch (input variable
    // consists of ids only in this case)
    if (bibsection && bibsection.page_start && bibsection.page_length) {
        input = this.registry.getSortedIds();        
    } else {
        input = this.refetchItems(this.registry.getSortedIds());
    }
    
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
        if ("boolean" === typeof a || !a) {
            if (a) {
                return !!b;
            } else {
                return !b;
            }
        } else {
            if ("string" === typeof b) {
                return eval_string(a, b);
            } else if (!b) {
                return false;
            } else {
                return eval_list(a, b);
            }
        }
    }

    skips = {};

    // For paged returns
    var page_item_count;
    if (bibsection && bibsection.page_start && bibsection.page_length) {
        page_item_count = 0;
        if (bibsection.page_start !== true) {
            for (i = 0, ilen = input.length; i < ilen; i += 1) {
                skips[input[i]] = true;
                if (bibsection.page_start == input[i]) {
                    break;
                }
            }
        }
    }

    var processed_item_ids = [];

    for (i = 0, ilen = input.length; i < ilen; i += 1) {
        
        // For paged returns
        if (bibsection && bibsection.page_start && bibsection.page_length) {
            if (skips[input[i]]) {
                continue;
            }
            item = this.refetchItem(input[i]);
            if (page_item_count === bibsection.page_length) {
                break;
            }
        } else {
            item = input[i];
            if (skips[item.id]) {
                continue;
            }
        }
        if (bibsection) {
            include = true;
            if (bibsection.include) {
                //
                // Opt-in: these are OR-ed.
                //
                include = false;
                for (j = 0, jlen = bibsection.include.length; j < jlen; j += 1) {
                    spec = bibsection.include[j];
                    if (eval_spec(spec.value, item[spec.field])) {
                        include = true;
                        break;
                    }
                }
            } else if (bibsection.exclude) {
                //
                // Opt-out: these are also OR-ed.
                //
                anymatch = false;
                for (j = 0, jlen = bibsection.exclude.length; j < jlen; j += 1) {
                    spec = bibsection.exclude[j];
                    if (eval_spec(spec.value, item[spec.field])) {
                        anymatch = true;
                        break;
                    }
                }
                if (anymatch) {
                    include = false;
                }
            } else if (bibsection.select) {
                //
                // Multiple condition opt-in: these are AND-ed.
                //
                include = false;
                allmatch = true;
                for (j = 0, jlen = bibsection.select.length; j < jlen; j += 1) {
                    spec = bibsection.select[j];
                    if (!eval_spec(spec.value, item[spec.field])) {
                        allmatch = false;
                    }
                }
                if (allmatch) {
                    include = true;
                }
            }
            if (bibsection.quash) {
                //
                // Stop criteria: These are AND-ed.
                //
                allmatch = true;
                for (j = 0, jlen = bibsection.quash.length; j < jlen; j += 1) {
                    spec = bibsection.quash[j];
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
        //SNIP-START
        if (debug) {
            CSL.debug("BIB: " + item.id);
        }
        //SNIP-END
        bib_entry = new CSL.Token("group", CSL.START);
        bib_entry.decorations = [["@bibliography", "entry"]].concat(this.bibliography.opt.layout_decorations);
        this.output.startTag("bib_entry", bib_entry);
        if (item.system_id && this.sys.embedBibliographyEntry) {
            this.output.current.value().item_id = item.system_id;
        } else {
            this.output.current.value().system_id = item.id;
        }

        // 2019-06-25 Hacked to conform to new parallels evaluation method
        entry_item_ids = [];
        if (this.registry.registry[item.id].master
            && !(bibsection && bibsection.page_start && bibsection.page_length)) {

            sortedItems = [[item, {id: item.id}]];
            var siblings = this.registry.registry[item.id].siblings;
            for (var j=0,jlen=siblings.length; j<jlen; j++) {
                sortedItems.push([{id: siblings[j]}, {id: siblings[j]}]);
            }
            collapse_parallel = true;
            this.parallel.StartCitation(sortedItems);
            this.output.queue[0].strings.delimiter = ", ";
            this.tmp.term_predecessor = false;
            entry_item_ids.push("" + CSL.getCite.call(this, item, sortedItems[0][1]));
            skips[item.id] = true;
            siblings = this.registry.registry[item.id].siblings;
            for (j = 0, jlen = siblings.length; j < jlen; j += 1) {
                var k = this.registry.registry[item.id].siblings[j];
                eyetem = this.refetchItem(k);
                entry_item_ids.push("" + CSL.getCite.call(this, eyetem, sortedItems[j+1][1]));
                skips[eyetem.id] = true;
            }
            this.parallel.purgeGroupsIfParallel();
        } else if (!this.registry.registry[item.id].siblings) {
            this.tmp.term_predecessor = false;
            entry_item_ids.push("" + CSL.getCite.call(this, item));
            if (bibsection && bibsection.page_start && bibsection.page_length) {
                page_item_count += 1;
            }
            //skips[item.id] = true;
        }
        // For RDF support
        entry_item_data.push("");

        this.tmp.bibliography_pos += 1;

        processed_item_ids.push(entry_item_ids);
        //
        // XXX: loop to render parallels goes here
        // XXX: just have to mark them somehow ...
        //
        this.output.endTag("bib_entry");
        //
        // place layout prefix on first blob of each cite, and suffix
        // on the last non-empty blob of each cite.  there be dragons
        // here.
        //
        if (this.output.queue[0].blobs.length && this.output.queue[0].blobs[0].blobs.length) {
            // The output queue stuff needs cleaning up.  the result of
            // output.current.value() is sometimes a blob, sometimes its list
            // of blobs.  this inconsistency is a source of confusion, and
            // should be cleaned up across the code base in the first
            // instance, before making any other changes to output code.
            if (collapse_parallel || !this.output.queue[0].blobs[0].blobs[0].strings) {
                topblobs = this.output.queue[0].blobs;
                collapse_parallel = false;
            } else {
                topblobs = this.output.queue[0].blobs[0].blobs;
            }
            topblobs[0].strings.prefix = this.bibliography.opt.layout_prefix + topblobs[0].strings.prefix;
        }
        for (j=0,jlen=this.output.queue.length;j<jlen;j+=1) {
            CSL.Output.Queue.purgeEmptyBlobs(this.output.queue[j]);
            //print("XXX: "+JSON.stringify(this.output.queue[j],['strings','prefix','suffix','delimiter','blobs','decorations'],2))
        }
        for (j=0,jlen=this.output.queue.length;j<jlen;j+=1) {
            this.output.adjust.upward(this.output.queue[j]);
            this.output.adjust.leftward(this.output.queue[j]);
            this.output.adjust.downward(this.output.queue[j],true);
            this.output.adjust.fix(this.output.queue[j]);
            //print("OUTPUT: "+JSON.stringify(this.output.queue[j],['strings','prefix','suffix','delimiter','blobs','decorations'],2))
        }

        //print("DUMP "+JSON.stringify(this.output.queue, ["strings", "decorations", "prefix", "suffix", "delimiter", "blobs"], 2));

        // XXX Need to account for numeric blobs in input.
        // XXX No idea how this could have worked previously.

        //print("BLOBS "+this.output.queue[0].blobs[0].blobs);

        //print("JSON "+JSON.stringify(this.output.queue[0].blobs, null, 2));

        res = this.output.string(this, this.output.queue)[0];
        
        if (!res && this.opt.update_mode === CSL.NUMERIC) {
            var err = (ret.length + 1) + ". [CSL STYLE ERROR: reference with no printed form.]";
            res = CSL.Output.Formats[this.opt.mode]["@bibliography/entry"](this, err);
        }
        if (res) {
            ret.push(res);
        }
    }

    var done = false;
    if (bibsection && bibsection.page_start && bibsection.page_length) {
        var last_expected_id = input.slice(-1)[0];
        var last_seen_id = processed_item_ids.slice(-1)[0];
        if (!last_expected_id || !last_seen_id || last_expected_id == last_seen_id) {
            done = true;
        }
    }
    this.tmp.disambig_override = false;

    // XXX done
    return [processed_item_ids, ret, done];
};

/*global CSL: true */


CSL.Engine.prototype.setCitationId = function (citation, force) {
    var ret, id, direction;
    ret = false;
    if (!citation.citationID || force) {
        id = Math.floor(Math.random() * 100000000000000);
        while (true) {
            direction = 0;
            if (!this.registry.citationreg.citationById[id]) {
                // In case the ID is used as an HTML identifier in the
                // calling application.
                //   https://github.com/Juris-M/citeproc-js/issues/22
                citation.citationID = "a" + id.toString(32);
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

CSL.Engine.prototype.rebuildProcessorState = function (citations, mode, uncitedItemIDs) {
    // Rebuilds the processor from scratch, based on a list of citation
    // objects. In a dynamic application, once the internal state of processor
    // is established, citations should edited with individual invocations
    // of processCitationCluster().

    // citations is a list of citation objects in document order.
    // mode is one of "html", "text" or "rtf".
    // uncitedItemIDs is a list of itemIDs or a JS object with itemIDs as keys.
    // Returns a list of [citationID,noteIndex,string] triples in document order.
    // Set citation.properties.noteIndex to 0 for in-text citations.
    // It is not necessary to run updateItems() before this function.
    if (!citations) {
        citations = [];
    }
    if (!mode) {
        mode = 'html';
    }
    var doneIDs = {};
    var itemIDs = [];
    for (var i=0,ilen=citations.length;i<ilen;i+=1) {
        for (var j=0,jlen=citations[i].citationItems.length;j<jlen;j+=1) {
            var itemID = "" + citations[i].citationItems[j].id;
            if (!doneIDs[itemID]) {
                itemIDs.push(itemID);
            }
            doneIDs[itemID] = true;
        }
    }
    this.updateItems(itemIDs);
    var pre = [];
    var post = [];
    var ret = [];
    var oldMode = this.opt.mode;
    this.setOutputFormat(mode);
    for (var i=0,ilen=citations.length;i<ilen;i+=1) {
        // res contains a result report and a list of [index,string] pairs
        // index begins at 0
        var res = this.processCitationCluster(citations[i],pre,post,CSL.ASSUME_ALL_ITEMS_REGISTERED);
        pre.push([citations[i].citationID,citations[i].properties.noteIndex]);
        for (var j=0,jlen=res[1].length;j<jlen;j+=1) {
            var index = res[1][j][0];
            ret[index] = [
                pre[index][0],
                pre[index][1],
                res[1][j][1]
            ];
        }
    }
    this.updateUncitedItems(uncitedItemIDs);
    this.setOutputFormat(oldMode);
    return ret;
};


CSL.Engine.prototype.restoreProcessorState = function (citations) {
    var i, ilen, j, jlen, item, Item, newitem, citationList, itemList, sortedItems;
    
    // This function is deprecated.
    // Use rebuildProcessorState() instead.

    // Quickly restore state from citation details retained by
    // calling application.
    //
    // if citations are provided, position details and sortkeys 
    // on the citation objects are are assumed to be correct.  Item
    // data is retrieved, and sortedItems arrays are created and
    // sorted as required by the current style.
    //
    // If citations is an empty list or nil, reset processor to
    // empty state.
    citationList = [];
    itemList = [];
    if (!citations) {
        citations = [];
    }
    // Adjust citationIDs to avoid duplicates, save off index numbers
    var indexNumbers = [];
    var citationIds = {};
    for (i = 0, ilen = citations.length; i < ilen; i += 1) {
        if (citationIds[citations[i].citationID]) {
            this.setCitationId(citations[i], true);
        }
        citationIds[citations[i].citationID] = true;
        indexNumbers.push(citations[i].properties.index);
    }
    // Slice citations and sort by their declared index positions, if any,
    // then reassign index and noteIndex numbers.
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
    for (i = 0, ilen = oldCitations.length; i < ilen; i += 1) {
        oldCitations[i].properties.index = i;
    }
    for (i = 0, ilen = oldCitations.length; i < ilen; i += 1) {
        sortedItems = [];
        for (j = 0, jlen = oldCitations[i].citationItems.length; j < jlen; j += 1) {
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
        // Save citation data in registry
        this.registry.citationreg.citationById[oldCitations[i].citationID] = oldCitations[i];
    }
    // Register Items
    this.updateItems(itemList);

    // Construct citationList from original copy
    for (i = 0, ilen = citations.length; i < ilen; i += 1) {
        citationList.push(["" + citations[i].citationID, citations[i].properties.noteIndex]);
    }

    var ret = [];
    if (citations && citations.length) {
        // Rendering one citation restores remainder of processor state.
        // If citations is empty, rest to empty state.
        ret = this.processCitationCluster(citations[0], [], citationList.slice(1));
    } else {
        this.registry = new CSL.Registry(this);
        this.tmp = new CSL.Engine.Tmp();
        this.disambiguate = new CSL.Disambiguation(this);
    }
    return ret;
};


CSL.Engine.prototype.updateItems = function (idList, nosort, rerun_ambigs, implicitUpdate) {
    var debug = false;
    var oldArea = this.tmp.area;
    var oldRoot = this.tmp.root;
    var oldExtension = this.tmp.extension;
    if (this.bibliography_sort.tokens.length === 0) {
        nosort = true;
    }
    this.tmp.area = "citation";
    this.tmp.root = "citation";
    this.tmp.extension = "";
    if (!implicitUpdate) {
        this.tmp.loadedItemIDs = {};
    }
    //CSL.debug = print
    //SNIP-START
    if (debug) {
        CSL.debug("--> init <--");
    }
    //SNIP-END
    this.registry.init(idList);

	if (rerun_ambigs) {
		for (var ambig in this.registry.ambigcites) {
			this.registry.ambigsTouched[ambig] = true;
		}
	}

    this.registry.dodeletes(this.registry.myhash);
    
    this.registry.doinserts(this.registry.mylist);
    
    this.registry.dorefreshes();

    // *** affects reflist
    this.registry.rebuildlist(nosort);
    
    this.registry.setsortkeys();

    // taints always
    this.registry.setdisambigs();

    // *** affects reflist
    this.registry.sorttokens(nosort);

    // *** affects reflist
    // taints if numbered style
    this.registry.renumber();
    
    // taints always
    //this.registry.yearsuffix();

    this.tmp.extension = oldExtension;
    this.tmp.area = oldArea;
    this.tmp.root = oldRoot;

    return this.registry.getSortedIds();
};

CSL.Engine.prototype.updateUncitedItems = function (idList, nosort) {
    var idHash;
    var oldArea = this.tmp.area;
    var oldRoot = this.tmp.root;
    var oldExtension = this.tmp.extension;
    if (this.bibliography_sort.tokens.length === 0) {
        nosort = true;
    }
    this.tmp.area = "citation";
    this.tmp.root = "citation";
    this.tmp.extension = "";
    this.tmp.loadedItemIDs = {};
    // This should be a utility function
    if (!idList) {
        idList = [];
    }
    if ("object" == typeof idList) {
        if ("undefined" == typeof idList.length) {
            idHash = idList;
            idList = [];
            for (var key in idHash) {
                idList.push(key);
            }
        } else if ("number" == typeof idList.length) {
            idHash = {};
            for (var i=0,ilen=idList.length;i<ilen;i+=1) {
                idHash[idList[i]] = true;
            }
        }
    }

    // prepare extended list of items
    this.registry.init(idList, true);

    // Use purge instead of delete.
    // this.registry.dodeletes(this.registry.myhash);
    this.registry.dopurge(idHash);

    // everything else is the same as updateItems()
    this.registry.doinserts(this.registry.mylist);

    this.registry.dorefreshes();

    this.registry.rebuildlist(nosort);

    this.registry.setsortkeys();

    this.registry.setdisambigs();

    this.registry.sorttokens(nosort);

    this.registry.renumber();

    this.tmp.extension = oldExtension;
    this.tmp.area = oldArea;
    this.tmp.root = oldRoot;

    return this.registry.getSortedIds();
};

/*global CSL: true */

CSL.localeResolve = function (langstr, defaultLocale) {
    var ret, langlst;
    if (!defaultLocale) {
        defaultLocale = "en-US";
    }
    if (!langstr) {
        langstr = defaultLocale;
    }
    ret = {};
    //if ("undefined" === typeof langstr) {
    //    langstr = "en_US";
    //}
    langlst = langstr.split(/[\-_]/);
    ret.base = CSL.LANG_BASES[langlst[0]];
    if ("undefined" === typeof ret.base) {
        //CSL.debug("Warning: unknown locale "+langstr+", setting fallback to "+defaultLocale);
        return {base:defaultLocale, best:langstr, bare:langlst[0]};
    }
    if (langlst.length === 1) {
        ret.generic = true;
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

// Use call to invoke this.
CSL.Engine.prototype.localeConfigure = function (langspec, beShy) {
    var localexml;
    if (beShy && this.locale[langspec.best]) {
        return;
    }
    if (langspec.best === "en-US") {
        localexml = CSL.setupXml(this.sys.retrieveLocale("en-US"));
        this.localeSet(localexml, "en-US", langspec.best);
    } else if (langspec.best !== "en-US") {
        if (langspec.base !== langspec.best) {
            localexml = CSL.setupXml(this.sys.retrieveLocale(langspec.base));
            this.localeSet(localexml, langspec.base, langspec.best);
        }
        localexml = CSL.setupXml(this.sys.retrieveLocale(langspec.best));
        this.localeSet(localexml, langspec.best, langspec.best);        
    }
    this.localeSet(this.cslXml, "", langspec.best);
    this.localeSet(this.cslXml, langspec.bare, langspec.best);
    if (langspec.base !== langspec.best) {
        this.localeSet(this.cslXml, langspec.base, langspec.best);
    }
    this.localeSet(this.cslXml, langspec.best, langspec.best);
    if ("undefined" === typeof this.locale[langspec.best].terms["page-range-delimiter"]) {
        if (["fr", "pt"].indexOf(langspec.best.slice(0, 2).toLowerCase()) > -1) {
            this.locale[langspec.best].terms["page-range-delimiter"] = "-";
        } else {
            this.locale[langspec.best].terms["page-range-delimiter"] = "\u2013";
        }
    }
    if ("undefined" === typeof this.locale[langspec.best].terms["year-range-delimiter"]) {
        this.locale[langspec.best].terms["year-range-delimiter"] = "\u2013";
    }
    if ("undefined" === typeof this.locale[langspec.best].terms["citation-range-delimiter"]) {
        this.locale[langspec.best].terms["citation-range-delimiter"] = "\u2013";
    }
    if (this.opt.development_extensions.normalize_lang_keys_to_lowercase) {
        var localeLists = ["default-locale","locale-sort","locale-translit","locale-translat"];
        for (var i=0,ilen=localeLists.length;i<ilen;i+=1) {
            for (var j=0,jlen=this.opt[localeLists[i]].length;j<jlen;j+=1) {
                this.opt[localeLists[i]][j] = this.opt[localeLists[i]][j].toLowerCase();
            }
        }
        this.opt.lang = this.opt.lang.toLowerCase();
    }
};
    
//
// XXXXX: Got it.  The locales objects need to be reorganized,
// with a top-level local specifier, and terms, opts, dates
// below.
//
CSL.Engine.prototype.localeSet = function (myxml, lang_in, lang_out) {
    var blob, locale, nodes, attributes, pos, term, form, termname, styleopts, date, attrname, len, genderform, target, i, ilen;
    lang_in = lang_in.replace("_", "-");
    lang_out = lang_out.replace("_", "-");

    if (this.opt.development_extensions.normalize_lang_keys_to_lowercase) {
        lang_in = lang_in.toLowerCase();
        lang_out = lang_out.toLowerCase();
    }

    if (!this.locale[lang_out]) {
        this.locale[lang_out] = {};
        this.locale[lang_out].terms = {};
        this.locale[lang_out].opts = {};
        // Set default skip words. Can be overridden in locale by attribute on style-options node.
        this.locale[lang_out].opts["skip-words"] = CSL.SKIP_WORDS;
        // Initialise leading noise word to false. Actual assignment is below. Empty by default, can be overridden in locale by attribute on style-options node.
        if (!this.locale[lang_out].opts["leading-noise-words"]) {
            this.locale[lang_out].opts["leading-noise-words"] = [];
        }
        this.locale[lang_out].dates = {};
        // For ordinals
        this.locale[lang_out].ord = {'1.0.1':false,keys:{}};
        this.locale[lang_out]["noun-genders"] = {};
    }

    //
    // Xml: Test if node is "locale" (nb: ns declarations need to be invoked
    // on every access to the xml object; bundle this with the functions
    //
    locale = myxml.makeXml();
    if (myxml.nodeNameIs(myxml.dataObj, 'locale')) {
        locale = myxml.dataObj;
    } else {
        //
        // Xml: get a list of all "locale" nodes
        //
        nodes = myxml.getNodesByName(myxml.dataObj, "locale");
        for (pos = 0, len = myxml.numberofnodes(nodes); pos < len; pos += 1) {
            blob = nodes[pos];
            //
            // Xml: get locale xml:lang
            //
            if (myxml.getAttributeValue(blob, 'lang', 'xml') === lang_in) {
                locale = blob;
                break;
            }
        }
    }
    //
    // Xml: get a list of any cs:type nodes within locale
    //
    nodes = myxml.getNodesByName(locale, 'type');
    for (i = 0, ilen = myxml.numberofnodes(nodes); i < ilen; i += 1) {
        var typenode = nodes[i];
        var type = myxml.getAttributeValue(typenode, 'name');
        var gender = myxml.getAttributeValue(typenode, 'gender');
        this.opt.gender[type] = gender;
    }
    //
    // Xml: get a list of term nodes within locale
    //

    // If we are setting CSL 1.0.1 ordinals inside a style, wipe the
    // slate clean and start over.
    var hasCslOrdinals101 = myxml.getNodesByName(locale, 'term', 'ordinal').length;
    if (hasCslOrdinals101) {
        for (var key in this.locale[lang_out].ord.keys) {
            delete this.locale[lang_out].terms[key];
        }
        this.locale[lang_out].ord = {"1.0.1":false,keys:{}};
    }

    nodes = myxml.getNodesByName(locale, 'term');
    // Collect ordinals info as for 1.0.1, but save only if 1.0.1 toggle triggers
    var ordinals101 = {"last-digit":{},"last-two-digits":{},"whole-number":{}};
    var ordinals101_toggle = false;
    var genderized_terms = {};
    for (pos = 0, len = myxml.numberofnodes(nodes); pos < len; pos += 1) {
        term = nodes[pos];
        //
        // Xml: get string value of attribute
        //
        termname = myxml.getAttributeValue(term, 'name');
        if (termname === "sub verbo") {
            termname = "sub-verbo";
        }
        if (termname.slice(0,7) === "ordinal") {
            if (termname === "ordinal") {
                ordinals101_toggle = true;
            } else {
                var match = myxml.getAttributeValue(term, 'match');
                var termstub = termname.slice(8);
                var genderform = myxml.getAttributeValue(term, 'gender-form');
                if (!genderform) {
                    genderform = "neuter";
                }
                if (!match) {
                    match = "last-two-digits";
                    if (termstub.slice(0,1) === "0") {
                        match = "last-digit";
                    }
                }
                if (termstub.slice(0,1) === "0") {
                    termstub = termstub.slice(1);
                }
                if (!ordinals101[match][termstub]) {
                    ordinals101[match][termstub] = {};
                }
                ordinals101[match][termstub][genderform] = termname;
            }
            this.locale[lang_out].ord.keys[termname] = true;
        }
        if ("undefined" === typeof this.locale[lang_out].terms[termname]) {
            this.locale[lang_out].terms[termname] = {};
        }
        form = "long";
        genderform = false;
        //
        // Xml: get string value of form attribute, if any
        //
        if (myxml.getAttributeValue(term, 'form')) {
            form = myxml.getAttributeValue(term, 'form');
        }
        //
        // Xml: get string value of gender attribute, if any
        // 
        if (myxml.getAttributeValue(term, 'gender-form')) {
            genderform = myxml.getAttributeValue(term, 'gender-form');
        }
        //
        // Xml: set global gender assignment for variable associated
        // with term name
        // 
        if (myxml.getAttributeValue(term, 'gender')) {
            this.locale[lang_out]["noun-genders"][termname] = myxml.getAttributeValue(term, 'gender');
        }
        // Work on main segment or gender-specific sub-segment as appropriate
        if (genderform) {
            this.locale[lang_out].terms[termname][genderform] = {};
            this.locale[lang_out].terms[termname][genderform][form] = [];
            target = this.locale[lang_out].terms[termname][genderform];
            genderized_terms[termname] = true;
        } else {
            this.locale[lang_out].terms[termname][form] = [];
            target = this.locale[lang_out].terms[termname];
        }
        //
        // Xml: test of existence of node
        //
        if (myxml.numberofnodes(myxml.getNodesByName(term, 'multiple'))) {
            //
            // Xml: get string value of attribute, plus
            // Xml: get string value of node content
            //
            target[form][0] = myxml.getNodeValue(term, 'single');
            if (target[form][0].indexOf("%s") > -1) {
                this.opt.hasPlaceholderTerm = true;
            }
            //
            // Xml: get string value of attribute, plus
            // Xml: get string value of node content
            //
            target[form][1] = myxml.getNodeValue(term, 'multiple');
            if (target[form][1].indexOf("%s") > -1) {
                this.opt.hasPlaceholderTerm = true;
            }
        } else {
            //
            // Xml: get string value of attribute, plus
            // Xml: get string value of node content
            //
            target[form] = myxml.getNodeValue(term);
            if (target[form].indexOf("%s") > -1) {
                this.opt.hasPlaceholderTerm = true;
            }
        }
    }
    if (!this.locale[lang_out].terms.supplement) {
        this.locale[lang_out].terms.supplement = {};
    }
    if (!this.locale[lang_out].terms.supplement["long"]) {
        this.locale[lang_out].terms.supplement["long"] = ["supplement", "supplements"];
    }
    // If locale had a CSL 1.0.1-style ordinal definition, install the logic object
    // and iterate over gendered terms, filling in default values for use by getTerm.
    if (ordinals101_toggle) {
        for (var ikey in genderized_terms) {
            var gender_segments = {};
            var form_segments = 0;
            for (var jkey in this.locale[lang_out].terms[ikey]) {
                if (["masculine","feminine"].indexOf(jkey) > -1) {
                    gender_segments[jkey] = this.locale[lang_out].terms[ikey][jkey];
                } else {
                    form_segments += 1;
                }
            }
            if (!form_segments) {
                if (gender_segments.feminine) {
                    // Link each feminine form segment to default
                    // (no need to filter, these will not have gender segments mixed in)
                    for (var jkey in gender_segments.feminine) {
                        this.locale[lang_out].terms[ikey][jkey] = gender_segments.feminine[jkey];
                    }
                } else if (gender_segments.masculine) {
                    // Otherwise link each masculine form segment to default 
                    for (var jkey in gender_segments.masculine) {
                        this.locale[lang_out].terms[ikey][jkey] = gender_segments.masculine[jkey];
                    }
                }
            }
        }
        this.locale[lang_out].ord['1.0.1'] = ordinals101;
    }

    // Iterate over main segments, and fill in any holes in gender-specific data
    // sub-segments
    for (termname in this.locale[lang_out].terms) {
        for (i = 0, ilen = 2; i < ilen; i += 1) {
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
    //
    // Xml: get list of nodes by node type
    //
    nodes = myxml.getNodesByName(locale, 'style-options');
    for (pos = 0, len = myxml.numberofnodes(nodes); pos < len; pos += 1) {
        if (true) {
            styleopts = nodes[pos];
            //
            // Xml: get list of attributes on a node
            //
            attributes = myxml.attributes(styleopts);
            for (attrname in attributes) {
                if (attributes.hasOwnProperty(attrname)) {
                    if (attrname === "@punctuation-in-quote" || attrname === "@limit-day-ordinals-to-day-1") {
                        if (attributes[attrname] === "true") {
                            // trim off leading @
                            this.locale[lang_out].opts[attrname.slice(1)] = true;
                        } else {
                            // trim off leading @
                            this.locale[lang_out].opts[attrname.slice(1)] = false;
                        }
                    } else if (attrname === "@jurisdiction-preference") {
                        var jurisdiction_preference = attributes[attrname].split(/\s+/);
                        this.locale[lang_out].opts[attrname.slice(1)] = jurisdiction_preference;
                    } else if (attrname === "@skip-words") {
                        var skip_words = attributes[attrname].split(/\s*,\s*/);
                        this.locale[lang_out].opts[attrname.slice(1)] = skip_words;
                    } else if (attrname === "@leading-noise-words") {
                        var val = attributes[attrname].split(/\s*,\s*/);
                        this.locale[lang_out].opts["leading-noise-words"] = val;
                    } else if (attrname === "@name-as-sort-order") {
                        // Fallback is okay here.
                        this.locale[lang_out].opts["name-as-sort-order"] = {};
                        var lst = attributes[attrname].split(/\s+/);
                        for (var i=0,ilen=lst.length;i<ilen;i+=1) {
                            this.locale[lang_out].opts["name-as-sort-order"][lst[i]] = true;
                        }
                    } else if (attrname === "@name-as-reverse-order") {
                        // Fallback is okay here.
                        this.locale[lang_out].opts["name-as-reverse-order"] = {};
                        var lst = attributes[attrname].split(/\s+/);
                        for (var i=0,ilen=lst.length;i<ilen;i+=1) {
                            this.locale[lang_out].opts["name-as-reverse-order"][lst[i]] = true;
                        }
                    } else if (attrname === "@name-never-short") {
                        // Here too.
                        this.locale[lang_out].opts["name-never-short"] = {};
                        var lst = attributes[attrname].split(/\s+/);
                        for (var i=0,ilen=lst.length;i<ilen;i+=1) {
                            this.locale[lang_out].opts["name-never-short"][lst[i]] = true;
                        }
                    }
                }
            }
        }
    }
    //
    // Xml: get list of nodes by type
    //
    nodes = myxml.getNodesByName(locale, 'date');
    for (pos = 0, len = myxml.numberofnodes(nodes); pos < len; pos += 1) {
        if (true) {
            var date = nodes[pos];
            //
            // Xml: get string value of attribute
            //
            this.locale[lang_out].dates[myxml.getAttributeValue(date, "form")] = date;
        }
    }
};


CSL.getLocaleNames = function (myxml, preferredLocale) {
    var stylexml = CSL.setupXml(myxml);

    function extendLocaleList(localeList, locale) {
        var forms = ["base", "best"];
        if (locale) {
            var normalizedLocale = CSL.localeResolve(locale);
            for (var i=0,ilen=forms.length;i<ilen;i++) {
                if (normalizedLocale[forms[i]] && localeList.indexOf(normalizedLocale[forms[i]]) === -1) {
                    localeList.push(normalizedLocale[forms[i]]);
                }
            }
        }
    }
    
    var localeIDs = ["en-US"];
    
    function sniffLocaleOnOneNodeName(nodeName) {
        var nodes = stylexml.getNodesByName(stylexml.dataObj, nodeName);
        for (var i=0,ilen=nodes.length;i<ilen;i++) {
            var nodeLocales = stylexml.getAttributeValue(nodes[i], "locale");
            if (nodeLocales) {
                nodeLocales = nodeLocales.split(/ +/);
                for (var j=0,jlen=nodeLocales.length;j<jlen;j++) {
                    this.extendLocaleList(localeIDs, nodeLocales[j]);
                }
            }
        }
    }

    extendLocaleList(localeIDs, preferredLocale);

    var styleNode = stylexml.getNodesByName(stylexml.dataObj, "style")[0];
    var defaultLocale = stylexml.getAttributeValue(styleNode, "default-locale");
    extendLocaleList(localeIDs, defaultLocale);

    var nodeNames = ["layout", "if", "else-if", "condition"];
    for (var i=0,ilen=nodeNames.length;i<ilen;i++) {
        sniffLocaleOnOneNodeName(stylexml, localeIDs, nodeNames[i]);
    }
    return localeIDs;
};

/*global CSL: true */

CSL.Node = {};

CSL.Node.bibliography = {
    build: function (state, target) {
        if (this.tokentype === CSL.START) {

            state.build.area = "bibliography";
            state.build.root = "bibliography";
            state.build.extension = "";

            var func = function(state) {
                state.tmp.area = "bibliography";
                state.tmp.root = "bibliography";
                state.tmp.extension = "";
            };
            this.execs.push(func);

            //state.parallel.use_parallels = false;
/*
            state.fixOpt(this, "names-delimiter", "delimiter");
            state.fixOpt(this, "name-delimiter", "delimiter");
            state.fixOpt(this, "name-form", "form");

            state.fixOpt(this, "and", "and");
            state.fixOpt(this, "delimiter-precedes-last", "delimiter-precedes-last");
            state.fixOpt(this, "delimiter-precedes-et-al", "delimiter-precedes-et-al");
            print("PUSH bibliography");
            state.fixOpt(this, "initialize-with", "initialize-with");
            state.fixOpt(this, "initialize", "initialize");
            state.fixOpt(this, "name-as-sort-order", "name-as-sort-order");
            state.fixOpt(this, "sort-separator", "sort-separator");
            state.fixOpt(this, "and", "and");

            state.fixOpt(this, "et-al-min", "et-al-min");
            state.fixOpt(this, "et-al-use-first", "et-al-use-first");
            state.fixOpt(this, "et-al-use-last", "et-al-use-last");
            state.fixOpt(this, "et-al-subsequent-min", "et-al-subsequent-min");
            state.fixOpt(this, "et-al-subsequent-use-first", "et-al-subsequent-use-first");
*/
        }
        target.push(this);
    }
};


/*global CSL: true */

CSL.Node.choose = {
    build: function (state, target) {
        var func;
        if (this.tokentype === CSL.START) {
            //open condition
            func = function (state) {
                state.tmp.jump.push(undefined, CSL.LITERAL);
            };
        }
        if (this.tokentype === CSL.END) {
            //close condition
            func = function (state) {
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

/*global CSL: true */

CSL.Node.citation = {
    build: function (state, target) {
        if (this.tokentype === CSL.START) {

            state.build.area = "citation";
            state.build.root = "citation";
            state.build.extension = "";


            var func = function(state) {
                state.tmp.area = "citation";
                state.tmp.root = "citation";
                state.tmp.extension = "";
            };
            this.execs.push(func);

/*
            state.build.root = "citation";

            OK state.fixOpt(this, "names-delimiter", "delimiter");
            OK state.fixOpt(this, "name-delimiter", "delimiter");
            OK state.fixOpt(this, "name-form", "form");
            OK state.fixOpt(this, "and", "and");
            OK state.fixOpt(this, "delimiter-precedes-last", "delimiter-precedes-last");
            OK state.fixOpt(this, "delimiter-precedes-et-al", "delimiter-precedes-et-al");
            OK state.fixOpt(this, "initialize-with", "initialize-with");
            OK state.fixOpt(this, "initialize", "initialize");
            OK state.fixOpt(this, "name-as-sort-order", "name-as-sort-order");
            OK state.fixOpt(this, "sort-separator", "sort-separator");

            OK state.fixOpt(this, "et-al-min", "et-al-min");
            OK state.fixOpt(this, "et-al-use-first", "et-al-use-first");
            OK state.fixOpt(this, "et-al-use-last", "et-al-use-last");
            state.fixOpt(this, "et-al-subsequent-min", "et-al-subsequent-min");
            state.fixOpt(this, "et-al-subsequent-use-first", "et-al-subsequent-use-first");
*/
        }
        if (this.tokentype === CSL.END) {

            // Open an extra key at first position for use in
            // grouped sorts.
            // print("in cs:citation END");
            state.opt.grouped_sort = state.opt.xclass === "in-text" 
                && (state.citation.opt.collapse 
                    && state.citation.opt.collapse.length)
                || (state.citation.opt.cite_group_delimiter
                    && state.citation.opt.cite_group_delimiter.length)
                && state.opt.update_mode !== CSL.POSITION
                && state.opt.update_mode !== CSL.NUMERIC;
            
            if (state.opt.grouped_sort 
                && state.citation_sort.opt.sort_directions.length) {
                
                var firstkey = state.citation_sort.opt.sort_directions[0].slice();
                //print("extending sort keys "+state.citation_sort.opt.sort_directions+" with "+firstkey);
                state.citation_sort.opt.sort_directions = [firstkey].concat(state.citation_sort.opt.sort_directions);
                // print("new key directions in effect: "+state.citation_sort.opt.sort_directions);
            }
            // print("creating new comparifier");
            state.citation.srt = new CSL.Registry.Comparifier(state, "citation_sort");
        }
        target.push(this);
    }
};


/*global CSL: true */

CSL.Node["#comment"] = {
       // This is a comment in the CSL file.
       build: function () {
        // Save some space in the log files -- no need to mention this, really.
        // CSL.debug("CSL processor warning: comment node reached");
       }
};

/*global CSL: true */

CSL.Node.date = {
    build: function (state, target) {
        var func, date_obj, len, pos, part, dpx, parts, mypos, start, end;
        if (this.tokentype === CSL.START || this.tokentype === CSL.SINGLETON) {
            // used to collect rendered date part names in node_datepart,
            // for passing through to node_key, for use in dates embedded
            // in macros
            state.dateput.string(state, state.dateput.queue);
            state.tmp.date_token = CSL.Util.cloneToken(this);
            state.tmp.date_token.strings.prefix = "";
            state.tmp.date_token.strings.suffix = "";
            state.dateput.openLevel(this);
            state.build.date_parts = [];
            state.build.date_variables = this.variables;
            if (!state.build.extension) {
                CSL.Util.substituteStart.call(this, state, target);
            }
            if (state.build.extension) {
                func = CSL.dateMacroAsSortKey;
            } else {
                func = function (state, Item, item) {
                    var dp;
                    state.tmp.element_rendered_ok = false;
                    state.tmp.donesies = [];
                    state.tmp.dateparts = [];
                    dp = [];
                    //if (this.variables.length && Item[this.variables[0]]){
                    if (this.variables.length
                        && !(state.tmp.just_looking
                             && this.variables[0] === "accessed")) {
                        
                        date_obj = Item[this.variables[0]];
                        if ("undefined" === typeof date_obj) {
                            date_obj = {"date-parts": [[0]] };
                            if (state.opt.development_extensions.locator_date_and_revision) {
                                if (item && this.variables[0] === "locator-date" && item["locator-date"]) {
                                    date_obj = item["locator-date"];
                                }
                            }
                        }
                        state.tmp.date_object = date_obj;
                        //
                        // Call a function here to analyze the
                        // data and set the name of the date-part that
                        // should collapse for this range, if any.
                        //
                        // (1) build a filtered list, in y-m-d order,
                        // consisting only of items that are (a) in the
                        // date-parts and (b) in the *_end data.
                        // (note to self: remember that season is a
                        // fallback var when month and day are empty)
                        
                        //if ("undefined" === typeof this.dateparts) {
                        //    this.dateparts = ["year", "month", "day"];
                        //}
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
                        //
                        // (2) Reverse the list and step through in
                        // reverse order, popping each item if the
                        // primary and *_end data match.
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
                        
                        //
                        // (3) When finished, the first item in the
                        // list, if any, is the date-part where
                        // the collapse should occur.

                        // XXXXX: was that it?
                        state.tmp.date_collapse_at = dp.slice(mypos);
                        //
                        // The collapse itself will be done by appending
                        // string output for the date, less suffix,
                        // placing a delimiter on output, then then
                        // doing the *_end of the range, dropping only
                        // the prefix.  That should give us concise expressions
                        // of ranges.
                        //
                        // Numeric dates should not collapse, though,
                        // and should probably use a slash delimiter.
                        // Scope for configurability will remain (all over
                        // the place), but this will do to get this feature
                        // started.
                        //
                    } else {
                        state.tmp.date_object = false;
                    }
                };
            }
            this.execs.push(func);

            // newoutput
            func = function (state, Item) {
                if (!Item[this.variables[0]]) {
                    return;
                }
                state.output.startTag("date", this);
                if (this.variables[0] === "issued"
                    && Item.type === "legal_case"
                    && !state.tmp.extension
                    && "" + Item["collection-number"] === "" + state.tmp.date_object.year
                    && this.dateparts.length === 1
                    && this.dateparts[0] === "year") {

                    // Set up to (maybe) suppress the year if we're not sorting, and
                    // it's the same as the collection-number, and we would render
                    // only the year, with not month or day, and this is a legal_case item.
                    // We save a pointer to the blob parent and its position here. The
                    // blob will be popped from output if at the end of processing for
                    // this cite we find that we have rendered the collection-number
                    // variable also.
                    for (var key in state.tmp.date_object) {
                        if (state.tmp.date_object.hasOwnProperty(key)) {
                            if (key.slice(0, 4) === "year") {

                                state.tmp.issued_date = {};
                                var lst = state.output.current.mystack.slice(-2)[0].blobs;
                                state.tmp.issued_date.list = lst;
                                state.tmp.issued_date.pos = lst.length - 1;
                            }
                        }
                    }
                }
            };
            this.execs.push(func);
        }

        if (!state.build.extension && (this.tokentype === CSL.END || this.tokentype === CSL.SINGLETON)) {
            // mergeoutput
            func = function (state, Item) {
                if (!Item[this.variables[0]]) {
                    return;
                }
                state.output.endTag();
            };
            this.execs.push(func);
        }
        target.push(this);

        if (this.tokentype === CSL.END || this.tokentype === CSL.SINGLETON) {
            if (!state.build.extension) {
                CSL.Util.substituteEnd.call(this, state, target);
            }
        }
    }
};

/*global CSL: true */

CSL.Node["date-part"] = {
    build: function (state, target) {
        var func, pos, len, first_date, value, value_end, real, have_collapsed, invoked, precondition, known_year, bc, ad, bc_end, ad_end, ready, curr, dcurr, number, num, formatter, item;
        if (!this.strings.form) {
            this.strings.form = "long";
        }
        // used in node_date, to send a list of rendering date parts
        // to node_key, for dates embedded in macros.
        state.build.date_parts.push(this.strings.name);
        //
        // Set delimiter here, if poss.
        //

        var date_variable = state.build.date_variables[0];

        function formatAndStrip(myform, gender, val) {
            if (!val) {
                return val;
            }
            val = "" + CSL.Util.Dates[this.strings.name][myform](state, val, gender, this.default_locale);
            if ("month" === this.strings.name) {
                if (state.tmp.strip_periods) {
                    val = val.replace(/\./g, "");
                } else {
                    for (var i = 0, ilen = this.decorations.length; i < ilen; i += 1) {
                        if ("@strip-periods" === this.decorations[i][0] && "true" === this.decorations[i][1]) {
                            val = val.replace(/\./g, "");
                            break;
                        }
                    }
                }
            }
            return val;
        }

        func = function (state, Item) {

            if (!state.tmp.date_object) {
                return;
            } else {
                state.tmp.probably_rendered_something = true;
            }

            first_date = true;
            value = "";
            value_end = "";
            state.tmp.donesies.push(this.strings.name);

            // Render literal only when year is included in date output
            if (state.tmp.date_object.literal && "year" === this.strings.name) {
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

                // For gendered locales
                var monthnameid = ""+state.tmp.date_object.month;
                while (monthnameid.length < 2) {
                    monthnameid = "0"+monthnameid;
                }
                monthnameid = "month-"+monthnameid;
                var gender = state.locale[state.opt.lang]["noun-genders"][monthnameid];
                if (this.strings.form) {
                    var myform = this.strings.form;
                    if (this.strings.name === "day") {
                        if (myform === "ordinal"
                            && state.locale[state.opt.lang].opts["limit-day-ordinals-to-day-1"]
                            && ("" + value) !== "1") {

                            myform = "numeric";
                        }
                    }
                    value = formatAndStrip.call(this, myform, gender, value);
                    value_end = formatAndStrip.call(this, myform, gender, value_end);
                }
                state.output.openLevel("empty");
                if (state.tmp.date_collapse_at.length) {
                    //state.output.startTag(this.strings.name,this);
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

                            // OK! So if the actual data has no month, day or season,
                            // and we reach this block, then we can combine the dates
                            // to a string, run minimial-two, and output the trailing
                            // year right here. No impact on other functionality.
                            
                            if (state.opt["year-range-format"]
                                && state.opt["year-range-format"] !== "expanded"
                                && !state.tmp.date_object.day
                                && !state.tmp.date_object.month
                                && !state.tmp.date_object.season
                                && this.strings.name === "year"
                                && value && value_end) {
                                
                                // second argument adjusts collapse as required for years
                                // See OSCOLA section 1.3.2
                                value_end = state.fun.year_mangler(value + "-" + value_end, true);
                                var range_delimiter = state.getTerm("year-range-delimiter");
                                value_end = value_end.slice(value_end.indexOf(range_delimiter) + 1);
                            }
                            state.dateput.append(value_end, this);
                            if (first_date) {
                                state.dateput.current.value().blobs[0].strings.prefix = "";
                            }
                        }
                        state.output.append(value, this);
                        curr = state.output.current.value();
                        curr.blobs[(curr.blobs.length - 1)].strings.suffix = "";
                        if (this.strings["range-delimiter"]) {
                            state.output.append(this.strings["range-delimiter"]);
                        } else {
                            state.output.append(state.getTerm("year-range-delimiter"), "empty");
                        }
                        state.dateput.closeLevel();
                        dcurr = state.dateput.current.value();
                        curr.blobs = curr.blobs.concat(dcurr);
                        // This may leave the stack pointer on a lower level.
                        // It's not a problem because the stack will be clobbered
                        // when the queue is initialized by the next cs:date node.
                        state.dateput.string(state, state.dateput.queue);
                        state.dateput.openLevel(state.tmp.date_token);
                        state.tmp.date_collapse_at = [];
                    } else {
                        state.output.append(value, this);
                        // print("collapse_at: "+state.tmp.date_collapse_at);
                        if (state.tmp.date_collapse_at.indexOf(this.strings.name) > -1) {
                            //
                            // Use ghost dateput queue
                            //
                            if ("" + value_end !== "0") {
                                //
                                // XXXXX: It's a workaround.  It's ugly.
                                // There's another one above.
                                //
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
                //state.output.endTag();
            } else if ("month" === this.strings.name) {
                // XXX The simpler solution here will be to
                // directly install season and season_end on
                // month, with a value of 13, 14, 15, 16, or
                // (to allow correct ranging with Down Under
                // dates) 17 or 18.  That will allow ranging
                // to take place in the normal way.  With this
                // "approach", it doesn't.
                //
                // No value for this target variable
                //
                if (state.tmp.date_object.season) {
                    value = "" + state.tmp.date_object.season;
                    if (value && value.match(/^[1-4]$/)) {
                        // XXXXXXXXXXXXXXXXXXX was replace([false, false, true]);
                        //state.tmp.group_context.replace([false, false, true]);
                        state.tmp.group_context.tip.variable_success = true;
                        state.output.append(state.getTerm(("season-0" + value)), this);
                    } else if (value) {
                        state.output.append(value, this);
                    }
                }
            }
            state.tmp.value = [];
            if (Item[date_variable] && (value || state.tmp.have_collapsed) && !state.opt.has_year_suffix && "year" === this.strings.name && !state.tmp.just_looking) {
                if (state.registry.registry[Item.id] && state.registry.registry[Item.id].disambig.year_suffix !== false && !state.tmp.has_done_year_suffix) {
                    state.tmp.has_done_year_suffix = true;
                    num = parseInt(state.registry.registry[Item.id].disambig.year_suffix, 10);
                    // first argument is for number particle [a-zA-Z], never present on dates
                    number = new CSL.NumericBlob(false, num, this, Item.id);
                    this.successor_prefix = state[state.build.area].opt.layout_delimiter;
                    this.splice_prefix = state[state.build.area].opt.layout_delimiter;
                    formatter = new CSL.Util.Suffixator(CSL.SUFFIX_CHARS);
                    number.setFormatter(formatter);
                    if (state[state.tmp.area].opt.collapse === "year-suffix-ranged") {
                        number.range_prefix = state.getTerm("citation-range-delimiter");
                    }
                    if (state[state.tmp.area].opt.cite_group_delimiter) {
                        number.successor_prefix = state[state.tmp.area].opt.cite_group_delimiter;
                    } else if (state[state.tmp.area].opt["year-suffix-delimiter"]) {
                        number.successor_prefix = state[state.tmp.area].opt["year-suffix-delimiter"];
                    } else {
                        number.successor_prefix = state[state.tmp.area].opt.layout_delimiter;
                    }
                    number.UGLY_DELIMITER_SUPPRESS_HACK = true;
                    state.output.append(number, "literal");
                }
            }

        };
        this.execs.push(func);
        target.push(this);
    }
};



/*global CSL: true */

CSL.Node["else-if"] = {
    //
    // these function are the same as those in if, might just clone
    build: function (state, target) {
        CSL.Conditions.TopNode.call(this, state, target);
        target.push(this);
    },
    configure: function (state, pos) {
        CSL.Conditions.Configure.call(this, state, pos);
    }
};

/*global CSL: true */

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


/*global CSL: true */

CSL.Node["et-al"] = {
    build: function (state, target) {
        if (state.build.area === "citation" || state.build.area === "bibliography") {
            var func = function (state) {
                state.tmp.etal_node = this;
                if ("string" === typeof this.strings.term) {
                    state.tmp.etal_term = this.strings.term;
                }
            };
            this.execs.push(func);
        }
        target.push(this);
    }
};

/*global CSL: true */

CSL.Node.group = {
    build: function (state, target, realGroup) {
        var func, execs, done_vars;
        this.realGroup = realGroup;
        if (this.tokentype === CSL.START) {
            CSL.Util.substituteStart.call(this, state, target);
            if (state.build.substitute_level.value()) {
                state.build.substitute_level.replace((state.build.substitute_level.value() + 1));
            }
            if (!this.juris) {
                target.push(this);
            }

            // newoutput
            func = function (state) {
                state.output.startTag("group", this);
                
                if (this.strings.label_form_override) {
                    if (!state.tmp.group_context.tip.label_form) {
                        state.tmp.group_context.tip.label_form = this.strings.label_form_override;
                    }
                }
                
                if (this.strings.label_capitalize_if_first_override) {
                    if (!state.tmp.group_context.tip.label_capitalize_if_first) {
                        state.tmp.group_context.tip.label_capitalize_if_first = this.strings.label_capitalize_if_first_override;
                    }
                }
                
                if (this.realGroup) {
                    var condition = false;
                    var force_suppress = false;

                    // XXX Can we do something better for length here?
                    if (state.tmp.group_context.mystack.length) {
                        state.output.current.value().parent = state.tmp.group_context.tip.output_tip;
                    }
                    
                    // fieldcontextflag
                    var label_form = state.tmp.group_context.tip.label_form;
                    if (!label_form) {
                        label_form = this.strings.label_form_override;
                    }
                    
                    var label_capitalize_if_first = state.tmp.group_context.tip.label_capitalize_if_first;
                    if (!label_capitalize_if_first) {
                        label_capitalize_if_first = this.strings.label_capitalize_if_first;
                    }
                    if (state.tmp.group_context.tip.condition) {
                        condition = state.tmp.group_context.tip.condition;
                        force_suppress = state.tmp.group_context.tip.force_suppress;
                        //force_suppress: false;
                    } else if (this.strings.reject) {
                        condition = {
                            test: this.strings.reject,
                            not: true
                        };
                        done_vars = [];
                    } else if (this.strings.require) {
                        condition = {
                            test: this.strings.require,
                            not: false
                        };
                        done_vars = [];
                    }
                    // CONDITION
                    //if (!state.tmp.just_looking) {
                    //    print("  pushing condition[" + state.tmp.group_context.mystack.length + "]: "+condition+" "+force_suppress);
                    //}
                    //if (!state.tmp.just_looking) {
                    //    var params = ["variable_success", "force_suppress","term_intended", "variable_attempt"]
                    //    print("PUSH parent="+JSON.stringify(state.tmp.group_context.tip, params))
                    //}
                    state.tmp.group_context.push({
                        old_term_predecessor: state.tmp.term_predecessor,
                        term_intended: false,
                        variable_attempt: false,
                        variable_success: false,
                        variable_success_parent: state.tmp.group_context.tip.variable_success,
                        output_tip: state.output.current.tip,
                        label_form: label_form,
                        label_capitalize_if_first: label_capitalize_if_first,
                        parallel_condition: this.strings.set_parallel_condition,
                        no_repeat_condition: this.strings.set_no_repeat_condition,
                        parallel_result: undefined,
                        parallel_repeats: undefined,
                        condition: condition,
                        force_suppress: force_suppress,
                        done_vars: state.tmp.group_context.tip.done_vars.slice()
                    });
                    //if (!state.tmp.just_looking) {
                    //    print("       flags="+JSON.stringify(state.tmp.group_context.tip, params))
                    //}
                }
            };
            //
            // Paranoia.  Assure that this init function is the first executed.
            execs = [];
            execs.push(func);
            this.execs = execs.concat(this.execs);

            // "Special handling" for nodes that contain only
            // publisher and place, with no affixes. For such
            // nodes only, parallel publisher/place pairs
            // will be parsed out and properly joined, piggybacking on
            // join parameters set on cs:citation or cs:bibliography.
            if (this.strings["has-publisher-and-publisher-place"]) {
                // Pass variable string values to the closing
                // tag via a global, iff they conform to expectations.
                state.build["publisher-special"] = true;
                if (this.strings["subgroup-delimiter"]) {
                    // Set the handling function only if name-delimiter
                    // is set on the parent cs:citation or cs:bibliography
                    // node.
                    func = function (state, Item) {
                        if (Item.publisher && Item["publisher-place"]) {
                            var publisher_lst = Item.publisher.split(/;\s*/);
                            var publisher_place_lst = Item["publisher-place"].split(/;\s*/);
                            if (publisher_lst.length > 1
                                && publisher_lst.length === publisher_place_lst.length) {
                                state.publisherOutput = new CSL.PublisherOutput(state, this);
                                state.publisherOutput["publisher-list"] = publisher_lst;
                                state.publisherOutput["publisher-place-list"] = publisher_place_lst;
                            }
                        }
                    };
                    this.execs.push(func);
                }
            }

            if (this.juris) {
                // "Special handling" for jurisdiction macros
                // We try to instantiate these as standalone token lists.
                // If available, the token list is executed,
                // the result is written directly into output,
                // and control returns here.

                // So we'll have something like this:
                // * expandMacro() in util_node.js flags juris- macros
                //   on build. [DONE]
                // * Those are picked up here, and
                //   - A runtime function attempts to fetch and instantiate
                //     the macros in separate token lists under a segment
                //     opened for the jurisdiction. We assume that the
                //     jurisdiction has a full set of macros. That will need
                //     to be enforced by validation. [DONE HERE, function is TODO]
                //   - Success or failure is marked in a runtime flag object
                //     (in citeproc.opt). [DONE]
                //   - After the instantiation function comes a test, for
                //     juris- macros only, which either runs diverted code,
                //     or proceeds as per normal through the token list. [TODO]
                // I think that's all there is to it.
                
                // Code for fetching an instantiating?

                var choose_start = new CSL.Token("choose", CSL.START);
                CSL.Node.choose.build.call(choose_start, state, target);
                
                var if_start = new CSL.Token("if", CSL.START);

                func = (function (macroName) {
                    return function (Item) {
                        if (!state.sys.retrieveStyleModule || !CSL.MODULE_MACROS[macroName] || !Item.jurisdiction) {
                            return false;
                        }
                        var jurisdictionList = state.getJurisdictionList(Item.jurisdiction);
                        // Set up a list of jurisdictions here, we will reuse it
                        if (!state.opt.jurisdictions_seen[jurisdictionList[0]]) {
                            var res = state.retrieveAllStyleModules(jurisdictionList);
                            // Okay. We have code for each of the novel modules in the
                            // hierarchy. Load them all into the processor.
                            for (var jurisdiction in res) {
                                var macroCount = 0;
                                state.juris[jurisdiction] = {};
                                var myXml = CSL.setupXml(res[jurisdiction]);
                                var myNodes = myXml.getNodesByName(myXml.dataObj, "law-module");
                                for (var i=0,ilen=myNodes.length;i<ilen;i++) {
                                    var myTypes = myXml.getAttributeValue(myNodes[i],"types");
                                    if (myTypes) {
                                        state.juris[jurisdiction].types = {};
                                        myTypes =  myTypes.split(/\s+/);
                                        for (var j=0,jlen=myTypes.length;j<jlen;j++) {
                                            state.juris[jurisdiction].types[myTypes[j]] = true;
                                        }
                                    }
                                }
                                if (!state.juris[jurisdiction].types) {
                                    state.juris[jurisdiction].types = CSL.MODULE_TYPES;
                                }
                                var myNodes = myXml.getNodesByName(myXml.dataObj, "macro");
                                for (var i=0,ilen=myNodes.length;i<ilen;i++) {
                                    var myName = myXml.getAttributeValue(myNodes[i], "name");
                                    if (!CSL.MODULE_MACROS[myName]) {
                                        CSL.debug("CSL: skipping non-modular macro name \"" + myName + "\" in module context");
                                        continue;
                                    }
                                    macroCount++;
                                    state.juris[jurisdiction][myName] = [];
                                    // Must use the same XML parser for style and modules.
                                    state.buildTokenLists(myNodes[i], state.juris[jurisdiction][myName]);
                                    state.configureTokenList(state.juris[jurisdiction][myName]);
                                }
                                //if (macroCount < Object.keys(CSL.MODULE_MACROS).length) {
                                //    var missing = [];
                                //    throw "CSL ERROR: Incomplete jurisdiction style module for: " + jurisdiction;
                                //}
                            }
                        }
                        // Identify the best jurisdiction for the item and return true, otherwise return false
                        for (var i=0,ilen=jurisdictionList.length;i<ilen;i++) {
                            var jurisdiction = jurisdictionList[i];
                            if(state.juris[jurisdiction] && state.juris[jurisdiction].types[Item.type]) {
                                Item["best-jurisdiction"] = jurisdiction;
                                return true;
                            }
                        }
                        return false;
                    };
                }(this.juris));
                
                if_start.tests ? {} : if_start.tests = [];
                if_start.tests.push(func);
                if_start.test = state.fun.match.any(if_start, state, if_start.tests);
                target.push(if_start);
                var text_node = new CSL.Token("text", CSL.SINGLETON);
                func = function (state, Item, item) {
                    // This will run the juris- token list.
                    var next = 0;
                    if (state.juris[Item["best-jurisdiction"]][this.juris]) {
                        while (next < state.juris[Item["best-jurisdiction"]][this.juris].length) {
                            next = CSL.tokenExec.call(state, state.juris[Item["best-jurisdiction"]][this.juris][next], Item, item);
                        }
                    }
                };
                text_node.juris = this.juris;
                text_node.execs.push(func);
                target.push(text_node);

                var if_end = new CSL.Token("if", CSL.END);
                CSL.Node["if"].build.call(if_end, state, target);
                var else_start = new CSL.Token("else", CSL.START);
                CSL.Node["else"].build.call(else_start, state, target);
            }
        }

        if (this.tokentype === CSL.END) {
            
            // Unbundle and print publisher lists
            // Same constraints on creating the necessary function here
            // as above. The full content of the group formatting token
            // is apparently not available on the closing tag here,
            // hence the global flag on state.build.
            if (state.build["publisher-special"]) {
                state.build["publisher-special"] = false;
                func = function (state) {
                    if (state.publisherOutput) {
                        state.publisherOutput.render();
                        state.publisherOutput = false;
                    }
                };
                this.execs.push(func);
            }
            
            // quashnonfields
            func = function (state, Item) {
                state.output.endTag();
                if (this.realGroup) {
                    var flags = state.tmp.group_context.pop();
                    if (state.tmp.area === "bibliography_sort") {
                        var citationNumberIdx = flags.done_vars.indexOf("citation-number");
                        if (this.strings.sort_direction && citationNumberIdx > -1 && state.tmp.group_context.length() == 1) {
                            if (this.strings.sort_direction === CSL.DESCENDING) {
                                state.bibliography_sort.opt.citation_number_sort_direction = CSL.DESCENDING;
                            } else {
                                state.bibliography_sort.opt.citation_number_sort_direction = CSL.ASCENDING;
                            }
                            flags.done_vars = flags.done_vars.slice(0, citationNumberIdx).concat(flags.done_vars.slice(citationNumberIdx + 1))
                        }
                    }
                    //var params = ["condition", "variable_success", "force_suppress","term_intended", "variable_attempt"]
                    //if (!state.tmp.just_looking) {
                    //    print("POP parent="+JSON.stringify(state.tmp.group_context.tip, params))
                    //    print("    flags="+JSON.stringify(flags, params));
                    //}
                    if (flags.condition) {
                        flags.force_suppress = CSL.EVALUATE_GROUP_CONDITION(state, flags);
                    }
                    if (state.tmp.group_context.tip.condition) {
                        state.tmp.group_context.tip.force_suppress = flags.force_suppress;
                    }
                    if (!flags.force_suppress && (flags.variable_success || (flags.term_intended && !flags.variable_attempt))) {
                        if (!this.isJurisLocatorLabel) {
                            state.tmp.group_context.tip.variable_success = true;
                        }
                        var blobs = state.output.current.value().blobs;
                        var pos = state.output.current.value().blobs.length - 1;
                        if (!state.tmp.just_looking && (flags.parallel_condition || flags.no_repeat_condition)) {
                            var parallel_condition_object = {
                                blobs: blobs,
                                condition: flags.parallel_condition,
                                result: flags.parallel_result,
                                norepeat: flags.no_repeat_condition,
                                repeats: flags.parallel_repeats,
                                id: Item.id,
                                pos: pos
                            };
                            state.parallel.parallel_conditional_blobs_list.push(parallel_condition_object);
                        }
                    } else {
                        state.tmp.term_predecessor = flags.old_term_predecessor;
                        state.tmp.group_context.tip.variable_attempt = flags.variable_attempt;
                        if (flags.force_suppress && !state.tmp.group_context.tip.condition) {
                            state.tmp.group_context.tip.variable_attempt = true;
                            state.tmp.group_context.tip.variable_success = flags.variable_success_parent;
                        }
                        if (flags.force_suppress) {
                            // 2019-04-15
                            // This is removing variables done within the group we're leaveing from global
                            // done_vars? How does that make sense?
                            // Ah. This is a FAILURE. So removing from done_vars allows it to re-render
                            // later in the cite if desired.
                            // Currently no tests fail from removing the condition, but leaving it in.
                            for (var i=0,ilen=flags.done_vars.length;i<ilen;i++) {
                                var doneVar = flags.done_vars[i];
                                for (var j=0,jlen=state.tmp.done_vars.length; j<jlen; j++) {
                                    if (state.tmp.done_vars[j] === doneVar) {
                                        state.tmp.done_vars = state.tmp.done_vars.slice(0, j).concat(state.tmp.done_vars.slice(j+1));
                                    }
                                }
                            }
                        }
                        if (state.output.current.value().blobs) {
                            state.output.current.value().blobs.pop();
                        }
                    }
                }
            };
            this.execs.push(func);
            
            if (this.juris) {
                var else_end = new CSL.Token("else", CSL.END);
                CSL.Node["else"].build.call(else_end, state, target);
                var choose_end = new CSL.Token("choose", CSL.END);
                CSL.Node.choose.build.call(choose_end, state, target);
            }
        }

        if (this.tokentype === CSL.END) {
            if (!this.juris) {
                target.push(this);
            }
            if (state.build.substitute_level.value()) {
                state.build.substitute_level.replace((state.build.substitute_level.value() - 1));
            }
            CSL.Util.substituteEnd.call(this, state, target);
        }
    }
};


/*global CSL: true */

CSL.Node["if"] = {
    build: function (state, target) {
        CSL.Conditions.TopNode.call(this, state, target);
        target.push(this);
    },
    configure: function (state, pos) {
        CSL.Conditions.Configure.call(this, state, pos);
    }
};


CSL.Node["conditions"] = {
    build: function (state) {
        if (this.tokentype === CSL.START) {
            state.tmp.conditions.addMatch(this.match);
        }
        if (this.tokentype === CSL.END) {
            state.tmp.conditions.matchCombine();
        }
    }
};

CSL.Node["condition"] = {
    build: function (state) {
        if (this.tokentype === CSL.SINGLETON) {
            var test = state.fun.match[this.match](this, state, this.tests);
            state.tmp.conditions.addTest(test);
        }
    }
};

CSL.Conditions = {};

CSL.Conditions.TopNode = function (state) {
    var func;
    if (this.tokentype === CSL.START || this.tokentype === CSL.SINGLETON) {
        if (this.locale) {
            state.opt.lang = this.locale;
        }
        if (!this.tests || !this.tests.length) {
            // Set up the condition compiler with our current context
            state.tmp.conditions = new CSL.Conditions.Engine(state, this);
        } else {
            // The usual.
            this.test = state.fun.match[this.match](this, state, this.tests);
        }
        if (state.build.substitute_level.value() === 0) {
            func = function(state) {
                state.tmp.condition_counter++;
            }
            this.execs.push(func);
        }
    }
    if (this.tokentype === CSL.END || this.tokentype === CSL.SINGLETON) {
        if (state.build.substitute_level.value() === 0) {
            func = function (state) {
                state.tmp.condition_counter--;
                if (state.tmp.condition_lang_counter_arr.length > 0) {
                    var counter = state.tmp.condition_lang_counter_arr.slice(-1)[0];
                    if (counter === state.tmp.condition_counter) {
                        state.opt.lang = state.tmp.condition_lang_val_arr.pop();
                        state.tmp.condition_lang_counter_arr.pop();
                    }
                }
                if (this.locale_default) {
                    // Open output tag with locale marker
                    state.output.current.value().old_locale = this.locale_default;
                    state.output.closeLevel("empty");
                    state.opt.lang = this.locale_default;
                }
            };
            this.execs.push(func);
        }
        // closingjump
        func = function (state) {
            var next = this[state.tmp.jump.value()];
            return next;
        };
        this.execs.push(func);
        if (this.locale_default) {
            state.opt.lang = this.locale_default;
        }
    }
};

CSL.Conditions.Configure = function (state, pos) {
    if (this.tokentype === CSL.START) {
        // jump index on failure
        this.fail = state.configure.fail.slice(-1)[0];
        this.succeed = this.next;
        state.configure.fail[(state.configure.fail.length - 1)] = pos;
    } else if (this.tokentype === CSL.SINGLETON) {
        // jump index on failure
        this.fail = this.next;
        this.succeed = state.configure.succeed.slice(-1)[0];
        state.configure.fail[(state.configure.fail.length - 1)] = pos;
    } else {
        // jump index on success
        this.succeed = state.configure.succeed.slice(-1)[0];
        this.fail = this.next;
    }
};

CSL.Conditions.Engine = function (state, token) {
    this.token = token;
    this.state = state;
};

CSL.Conditions.Engine.prototype.addTest = function (test) {
    this.token.tests ? {} : this.token.tests = [];
    this.token.tests.push(test);
};

CSL.Conditions.Engine.prototype.addMatch = function (match) {
    this.token.match = match;
};

CSL.Conditions.Engine.prototype.matchCombine = function () {
    this.token.test = this.state.fun.match[this.token.match](this.token, this.state, this.token.tests);
};

/*global CSL: true */

CSL.Node.info = {
    build: function (state) {
        if (this.tokentype === CSL.START) {
            state.build.skip = "info";
        } else {
            state.build.skip = false;
        }
    }
};


/*global CSL: true */

CSL.Node.institution = {
    build: function (state, target) {
        if ([CSL.SINGLETON, CSL.START].indexOf(this.tokentype) > -1) {

            var func = function (state) {
                if ("string" === typeof this.strings.delimiter) {
                    state.tmp.institution_delimiter = this.strings.delimiter;
                } else {
                    state.tmp.institution_delimiter = state.tmp.name_delimiter;
                }

                // This is the same code for the same result as in node_name.js, 
                // but when cs:institution comes on stream, it may produce
                // different results.
                if ("text" === state.inheritOpt(this, "and")) {
                    this.and_term = state.getTerm("and", "long", 0);
                } else if ("symbol" === state.inheritOpt(this, "and")) {
                    if (state.opt.development_extensions.expect_and_symbol_form) {
                        this.and_term = state.getTerm("and", "symbol", 0);
                    } else {
                        this.and_term = "&";
                    }
                } else if ("none" === state.inheritOpt(this, "and")) {
                    this.and_term = state.tmp.institution_delimiter;
                }
                if ("undefined" === typeof this.and_term && state.tmp.and_term) {
                    this.and_term = state.getTerm("and", "long", 0);
                }
                if (CSL.STARTSWITH_ROMANESQUE_REGEXP.test(this.and_term)) {
                    this.and_prefix_single = " ";
                    this.and_prefix_multiple = ", ";
                    if ("string" === typeof state.tmp.institution_delimiter) {
                        this.and_prefix_multiple = state.tmp.institution_delimiter;
                    }
                    this.and_suffix = " ";
                } else {
                    this.and_prefix_single = "";
                    this.and_prefix_multiple = "";
                    this.and_suffix = "";
                }
                if (state.inheritOpt(this, "delimiter-precedes-last") === "always") {
                    this.and_prefix_single = state.tmp.institution_delimiter;
                } else if (state.inheritOpt(this, "delimiter-precedes-last") === "never") {
                    // Slightly fragile: could test for charset here to make
                    // this more certain.
                    if (this.and_prefix_multiple) {
                        this.and_prefix_multiple = " ";
                    }
                }
                
                this.and = {};
                if ("undefined" !== typeof this.and_term) {
                    state.output.append(this.and_term, "empty", true);
                    this.and.single = state.output.pop();
                    this.and.single.strings.prefix = this.and_prefix_single;
                    this.and.single.strings.suffix = this.and_suffix;
                    state.output.append(this.and_term, "empty", true);
                    this.and.multiple = state.output.pop();
                    this.and.multiple.strings.prefix = this.and_prefix_multiple;
                    this.and.multiple.strings.suffix = this.and_suffix;
                } else if ("undefined" !== this.strings.delimiter) {
                    this.and.single = new CSL.Blob(state.tmp.institution_delimiter);
                    this.and.single.strings.prefix = "";
                    this.and.single.strings.suffix = "";
                    this.and.multiple = new CSL.Blob(state.tmp.institution_delimiter);
                    this.and.multiple.strings.prefix = "";
                    this.and.multiple.strings.suffix = "";
                }
                state.nameOutput.institution = this;
            };
            this.execs.push(func);
        }
        target.push(this);
    },
    configure: function (state) {
        if ([CSL.SINGLETON, CSL.START].indexOf(this.tokentype) > -1) {
            state.build.has_institution = true;
        }
    }
};

/*global CSL: true */

CSL.Node["institution-part"] = {
    build: function (state, target) {
        var func;
        if ("long" === this.strings.name) {
            if (this.strings["if-short"]) {
                func = function (state) {
                    state.nameOutput.institutionpart["long-with-short"] = this;
                };
            } else {
                func = function (state) {
                    state.nameOutput.institutionpart["long"] = this;
                };
            }
        } else if ("short" === this.strings.name) {
            func = function (state) {
                state.nameOutput.institutionpart["short"] = this;
            };
        }
        this.execs.push(func);
        target.push(this);
    }
};

/*global CSL: true */

CSL.Node.key = {
    build: function (state, target) {
        
        target = state[state.build.root + "_sort"].tokens;

        var func;
        var debug = false;
        var start_key = new CSL.Token("key", CSL.START);

        state.tmp.root = state.build.root;

        // The params object for build and runtime (tmp) really shouldn't have been separated.
        // Oh, well.
        start_key.strings["et-al-min"] = state.inheritOpt(this, "et-al-min");
        start_key.strings["et-al-use-first"] = state.inheritOpt(this, "et-al-use-first");
        start_key.strings["et-al-use-last"] = state.inheritOpt(this, "et-al-use-last");


        // initialize done vars
        func = function (state) {
            state.tmp.done_vars = [];
        };
        start_key.execs.push(func);

        // initialize output queue
        func = function (state) {
            state.output.openLevel("empty");
        };
        start_key.execs.push(func);

        // sort direction
        var sort_direction = [];
        if (this.strings.sort_direction === CSL.DESCENDING) {
            //print("sort: descending on "+state.tmp.area);
            sort_direction.push(1);
            sort_direction.push(-1);
        } else {
            //print("sort: ascending");
            sort_direction.push(-1);
            sort_direction.push(1);
        }
        state[state.build.area].opt.sort_directions.push(sort_direction);

        if (CSL.DATE_VARIABLES.indexOf(this.variables[0]) > -1) {
            state.build.date_key = true;
        }

        // et al init
        func = function (state) {
            state.tmp.sort_key_flag = true;
            //print("== key node function ==");
            if (state.inheritOpt(this, "et-al-min")) {
                state.tmp["et-al-min"] = state.inheritOpt(this, "et-al-min");
            }
            if (state.inheritOpt(this, "et-al-use-first")) {
                state.tmp["et-al-use-first"] = state.inheritOpt(this, "et-al-use-first");
            }
            if ("boolean" === typeof state.inheritOpt(this, "et-al-use-last")) {
                state.tmp["et-al-use-last"] = state.inheritOpt(this, "et-al-use-last");
                //print("  set tmp et-al-use-last: "+this.strings["et-al-use-last"])
            }
        };
        start_key.execs.push(func);
        target.push(start_key);
        
        //
        // ops to initialize the key's output structures
        if (this.variables.length) {
            var variable = this.variables[0];
            if (CSL.NAME_VARIABLES.indexOf(variable) > -1) {
                //
                // Start tag
                var names_start_token = new CSL.Token("names", CSL.START);
                names_start_token.tokentype = CSL.START;
                names_start_token.variables = this.variables;
                CSL.Node.names.build.call(names_start_token, state, target);
                //
                // Name tag
                var name_token = new CSL.Token("name", CSL.SINGLETON);
                name_token.tokentype = CSL.SINGLETON;
                name_token.strings["name-as-sort-order"] = "all";
                name_token.strings["sort-separator"] = " ";
                name_token.strings["et-al-use-last"] = state.inheritOpt(this, "et-al-use-last");
                name_token.strings["et-al-min"] = state.inheritOpt(this, "et-al-min");
                name_token.strings["et-al-use-first"] = state.inheritOpt(this, "et-al-use-first");
                CSL.Node.name.build.call(name_token, state, target);
                //
                // Institution tag
                var institution_token = new CSL.Token("institution", CSL.SINGLETON);
                institution_token.tokentype = CSL.SINGLETON;
                CSL.Node.institution.build.call(institution_token, state, target);
                //
                // End tag
                var names_end_token = new CSL.Token("names", CSL.END);
                names_end_token.tokentype = CSL.END;
                CSL.Node.names.build.call(names_end_token, state, target);
            } else {
                var single_text = new CSL.Token("text", CSL.SINGLETON);
                single_text.strings.sort_direction = this.strings.sort_direction;
                single_text.dateparts = this.dateparts;
                if (CSL.NUMERIC_VARIABLES.indexOf(variable) > -1) {
                    // citation-number is virtualized. As a sort key it has no effect on registry
                    // sort order per se, but if set to DESCENDING, it reverses the sequence of numbers representing
                    // bib entries.
                    if (variable === "citation-number") {
                        func = function (state, Item) {
                            if (state.tmp.area === "bibliography_sort") {
                                if (this.strings.sort_direction === CSL.DESCENDING) {
                                    state.bibliography_sort.opt.citation_number_sort_direction = CSL.DESCENDING;
                                } else {
                                    state.bibliography_sort.opt.citation_number_sort_direction = CSL.ASCENDING;
                                }
                            }
                            if (state.tmp.area === "citation_sort" && state.bibliography_sort.tmp.citation_number_map) {
                                var num = state.bibliography_sort.tmp.citation_number_map[state.registry.registry[Item.id].seq];
                            } else {
                                var num = state.registry.registry[Item.id].seq;
                            }
                            if (num) {
                                // Code currently in util_number.js
                                num = CSL.Util.padding("" + num);
                            }
                            state.output.append(num, this);
                        };
                    } else {
                        func = function (state, Item) {
                            var num = false;
                            num = Item[variable];
                            // XXX What if this is NaN?
                            if (num) {
                                // Code currently in util_number.js
                                num = CSL.Util.padding(num);
                            }
                            state.output.append(num, this);
                        };
                    }
                } else if (variable === "citation-label") {
                    func = function (state, Item) {
                        var trigraph = state.getCitationLabel(Item);
                        state.output.append(trigraph, this);
                    };
                } else if (CSL.DATE_VARIABLES.indexOf(variable) > -1) {
                    func = CSL.dateAsSortKey;
                    single_text.variables = this.variables;
                } else if ("title" === variable) {
                    var abbrevfam = "title";
                    var abbrfall = false;
                    var altvar = false;
                    var transfall = true;
                    func = state.transform.getOutputFunction(this.variables, abbrevfam, abbrfall, altvar, transfall);
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
            //
            // if it's not a variable, it's a macro
            var token = new CSL.Token("text", CSL.SINGLETON);
            token.strings.sort_direction = this.strings.sort_direction;
            token.postponed_macro = this.postponed_macro;
            CSL.expandMacro.call(state, token, target);
        }
        //
        // ops to output the key string result to an array go
        // on the closing "key" tag before it is pushed.
        // Do not close the level.
        var end_key = new CSL.Token("key", CSL.END);

        // Eliminated at revision 1.0.159.
        // Was causing non-fatal error "wanted empty but found group".
        // Possible contributor to weird "PAGES" bug?
        //func = function (state, Item) {
        //state.output.closeLevel("empty");
        //};
        //end_key.execs.push(func);
        
        // store key for use
        func = function (state) {
            var keystring = state.output.string(state, state.output.queue);
            if (state.sys.normalizeUnicode) {
                keystring = state.sys.normalizeUnicode(keystring);
            }
            keystring = keystring ? (keystring.split(" ").join(state.opt.sort_sep) + state.opt.sort_sep) : "";
            //SNIP-START
            if (debug) {
                CSL.debug("keystring: " + keystring + " " + typeof keystring);
            }
            //print("keystring: (" + keystring + ") " + typeof keystring + " " + state.tmp.area);
            //SNIP-END
            //state.sys.print("keystring: (" + keystring + ") " + typeof keystring + " " + state.tmp.area);
            if ("" === keystring) {
                keystring = undefined;
            }
            if ("string" !== typeof keystring || state.tmp.empty_date) {
                keystring = undefined;
                state.tmp.empty_date = false;
            }
            state[state[state.tmp.area].root + "_sort"].keys.push(keystring);
            state.tmp.value = [];
        };
        end_key.execs.push(func);

        // Set year-suffix key on anything that looks like a date
        if (state.build.date_key) {
            if (state.build.area === "citation" && state.build.extension === "_sort") {
                // ascending sort always
                state[state.build.area].opt.sort_directions.push([-1,1]);
                func = function (state, Item) {
                    // year-suffix Key
                    var year_suffix = state.registry.registry[Item.id].disambig.year_suffix;
                    if (!year_suffix) {
                        year_suffix = 0;
                    }
                    var key = CSL.Util.padding("" + year_suffix);
                    state[state.tmp.area].keys.push(key);
                };
                end_key.execs.push(func);
            }
            state.build.date_key = false;
        }

        // reset key params
        func = function (state) {
            // state.tmp.name_quash = new Object();

            // XXX This should work, should be necessary, but doesn't and isn't.
            //state.output.closeLevel("empty");

            state.tmp["et-al-min"] = undefined;
            state.tmp["et-al-use-first"] = undefined;
            state.tmp["et-al-use-last"] = undefined;
            state.tmp.sort_key_flag = false;
        };
        end_key.execs.push(func);
        target.push(end_key);
    }
};

/*global CSL: true */

CSL.Node.label = {
    build: function (state, target) {
        
        if (this.strings.term) {
            // Non-names labels
            var func = function (state, Item, item) {
                // Must accomplish this without touching strings
                // shared with the calling application: "sub verbo"
                // and "sub-verbo" must both pass, as they stand.
                //if (item && item.label === "sub verbo") {
                //    item.label = "sub-verbo";
                //}
                // This is abstracted away, because the same
                // logic must be run in cs:names.
                var termtxt = CSL.evaluateLabel(this, state, Item, item);
                if (item && this.strings.term === "locator") {

                    item.section_form_override = this.strings.form;

                }
                if (termtxt) {
                    state.tmp.group_context.tip.term_intended = true;
                }
                CSL.UPDATE_GROUP_CONTEXT_CONDITION(state, termtxt);
                if (termtxt.indexOf("%s") === -1) {
                    // ^ Suppress output here if we have an embedded term
                    if (this.strings.capitalize_if_first) {
                        if (!state.tmp.term_predecessor && !(state.opt["class"] === "in-text" && state.tmp.area === "citation")) {
                            termtxt = CSL.Output.Formatters["capitalize-first"](state, termtxt);
                        }
                    }
                    state.output.append(termtxt, this);
                }
            };
            this.execs.push(func);
        } else {
            if (!this.strings.form) {
                this.strings.form = "long";
            }
            // Names labels
            // Picked up in names END
            var namevars = state.build.names_variables[state.build.names_variables.length-1];
            var namelabels = state.build.name_label[state.build.name_label.length-1];
            for (var i = 0, ilen = namevars.length; i < ilen; i += 1) {
                if (!namelabels[namevars[i]]) {
                    namelabels[namevars[i]] = {};
                }
            }
            if (!state.build.name_flag) {
                for (var i = 0, ilen = namevars.length; i < ilen; i += 1) {
                    namelabels[namevars[i]].before = this;
                }
            } else {
                for (var i = 0, ilen = namevars.length; i < ilen; i += 1) {
                    namelabels[namevars[i]].after = this;
                }
            }
        }
        target.push(this);
    }
};

/*global CSL: true */

CSL.Node.layout = {
    build: function (state, target) {
        var func, prefix_token, suffix_token, tok;

        function setSuffix() {
            if (state.build.area === "bibliography") {
                suffix_token = new CSL.Token("text", CSL.SINGLETON);
                func = function(state) {
                    var suffix;
                    if (state.tmp.cite_affixes[state.tmp.area][state.tmp.last_cite_locale]) {
                        suffix = state.tmp.cite_affixes[state.tmp.area][state.tmp.last_cite_locale].suffix;
                    } else {
                        suffix = state.bibliography.opt.layout_suffix;
                    }

                    // If @display is used, layout suffix is placed on the last
                    // immediate child of the layout, which we assume will be a
                    // @display group node.
                    var topblob = state.output.current.value();
                    if (state.opt.using_display) {
                        topblob.blobs[topblob.blobs.length-1].strings.suffix = suffix;
                    } else {
                        topblob.strings.suffix = suffix;
                    }
                    if (state.bibliography.opt["second-field-align"]) {
                        // closes bib_other
                        state.output.endTag("bib_other");
                    }
                };
                suffix_token.execs.push(func);
                target.push(suffix_token);
            }
        }

        if (this.tokentype === CSL.START) {

            if (this.locale_raw) {
                state.build.current_default_locale = this.locale_raw;
            } else {
                state.build.current_default_locale = state.opt["default-locale"];
            }

            func = function (state, Item, item) {
                if (state.opt.development_extensions.apply_citation_wrapper
                    && state.sys.wrapCitationEntry
                    && !state.tmp.just_looking
                    && Item.system_id 
                    && state.tmp.area === "citation") { 

                    var cite_entry = new CSL.Token("group", CSL.START);
                    cite_entry.decorations = [["@cite", "entry"]];
                    state.output.startTag("cite_entry", cite_entry);
                    state.output.current.value().item_id = Item.system_id;
                    if (item) {
                        state.output.current.value().locator_txt = item.locator_txt;
                        state.output.current.value().suffix_txt = item.suffix_txt;
                    }
                }
            };
            this.execs.push(func);
        }

        // XXX Works, but using state.tmp looks wrong here? We're in the build layer ...
        if (this.tokentype === CSL.START && !state.tmp.cite_affixes[state.build.area]) {
            //
            // done_vars is used to prevent the repeated
            // rendering of variables
            //
            // initalize done vars
            func = function (state, Item) {

                state.tmp.done_vars = [];
                if (state.opt.suppressedJurisdictions[Item["country"]]
                    && Item["country"]
                    && ["treaty", "patent"].indexOf(Item.type) === -1) {
                    
                    state.tmp.done_vars.push("country");
                }
                if (!state.tmp.just_looking && state.registry.registry[Item.id] && state.registry.registry[Item.id].parallel) {
                    state.tmp.done_vars.push("first-reference-note-number");
                }
                //CSL.debug(" === init rendered_name === ");
                state.tmp.rendered_name = false;
            };
            this.execs.push(func);
            // set opt delimiter
            func = function (state) {
                // just in case
                state.tmp.sort_key_flag = false;
            };
            this.execs.push(func);
            
            // reset nameset counter [all nodes]
            func = function (state) {
                state.tmp.nameset_counter = 0;
            };
            this.execs.push(func);

            func = function (state, Item) {
                var tok = new CSL.Token();
                state.output.openLevel(tok);
            };
            this.execs.push(func);
            target.push(this);

            if (state.build.area === "citation") {
                prefix_token = new CSL.Token("text", CSL.SINGLETON);
                func = function (state, Item, item) {
                    if (item && item.prefix) {
                        var prefix = CSL.checkPrefixSpaceAppend(state, item.prefix);
                        if (!state.tmp.just_looking) {
                            prefix = state.output.checkNestedBrace.update(prefix);
                        }
                        var ignorePredecessor = CSL.checkIgnorePredecessor(state, prefix);
                        state.output.append(prefix, this, false, ignorePredecessor);
                    }
                };
                prefix_token.execs.push(func);
                target.push(prefix_token);
            }
        }

        // Cast token to be used in one of the configurations below.
        var my_tok;
        if (this.locale_raw) {
            my_tok = new CSL.Token("dummy", CSL.START);
            my_tok.locale = this.locale_raw;
            my_tok.strings.delimiter = this.strings.delimiter;
            my_tok.strings.suffix = this.strings.suffix;
            if (!state.tmp.cite_affixes[state.build.area]) {
                state.tmp.cite_affixes[state.build.area] = {};
            }
        }

        if (this.tokentype === CSL.START) {
            state.build.layout_flag = true;
                            
            // Only run the following once, to set up the final layout node ...
            if (!this.locale_raw) {
                //
                // save out decorations for flipflop processing [final node only]
                //
                state[state.tmp.area].opt.topdecor = [this.decorations];
                state[(state.tmp.area + "_sort")].opt.topdecor = [this.decorations];

                state[state.build.area].opt.layout_prefix = this.strings.prefix;
                state[state.build.area].opt.layout_suffix = this.strings.suffix;
                state[state.build.area].opt.layout_delimiter = this.strings.delimiter;

                state[state.build.area].opt.layout_decorations = this.decorations;
                
                // Only do this if we're running conditionals
                if (state.tmp.cite_affixes[state.build.area]) {
                    // if build_layout_locale_flag is true,
                    // write cs:else START to the token list.
                    tok = new CSL.Token("else", CSL.START);
                    CSL.Node["else"].build.call(tok, state, target);
                }

            } // !this.locale_raw

            // Conditionals
            if (this.locale_raw) {
                if (!state.build.layout_locale_flag) {
                    // if layout_locale_flag is untrue,
                    // write cs:choose START and cs:if START
                    // to the token list.
                    var choose_tok = new CSL.Token("choose", CSL.START);
                    CSL.Node.choose.build.call(choose_tok, state, target);
                    my_tok.name = "if";
                    CSL.Attributes["@locale-internal"].call(my_tok, state, this.locale_raw);
                    CSL.Node["if"].build.call(my_tok, state, target);
                } else {
                    // if build_layout_locale_flag is true,
                    // write cs:else-if START to the token list.
                    my_tok.name = "else-if";
                    CSL.Attributes["@locale-internal"].call(my_tok, state, this.locale_raw);
                    CSL.Node["else-if"].build.call(my_tok, state, target);
                }
                // cite_affixes for this node
                state.tmp.cite_affixes[state.build.area][my_tok.locale] = {};
                state.tmp.cite_affixes[state.build.area][my_tok.locale].delimiter = this.strings.delimiter;
                state.tmp.cite_affixes[state.build.area][my_tok.locale].suffix = this.strings.suffix;
            }
        }
        if (this.tokentype === CSL.END) {
            if (this.locale_raw) {
                setSuffix();
                if (!state.build.layout_locale_flag) {
                    // If layout_locale_flag is untrue, write cs:if END
                    // to the token list.
                    my_tok.name = "if";
                    my_tok.tokentype = CSL.END;
                    CSL.Attributes["@locale-internal"].call(my_tok, state, this.locale_raw);
                    CSL.Node["if"].build.call(my_tok, state, target);
                    state.build.layout_locale_flag = true;
                } else {
                    // If layout_locale_flag is true, write cs:else-if END
                    // to the token list.
                    my_tok.name = "else-if";
                    my_tok.tokentype = CSL.END;
                    CSL.Attributes["@locale-internal"].call(my_tok, state, this.locale_raw);
                    CSL.Node["else-if"].build.call(my_tok, state, target);
                }
            }
            if (!this.locale_raw) {
                setSuffix();
                // Only add this if we're running conditionals
                if (state.tmp.cite_affixes[state.build.area]) {
                    // If layout_locale_flag is true, write cs:else END
                    // and cs:choose END to the token list.
                    if (state.build.layout_locale_flag) {
                        tok = new CSL.Token("else", CSL.END);
                        CSL.Node["else"].build.call(tok, state, target);
                        tok = new CSL.Token("choose", CSL.END);
                        CSL.Node.choose.build.call(tok, state, target);
                    }
                }
                state.build_layout_locale_flag = true;
                if (state.build.area === "citation") {
                    suffix_token = new CSL.Token("text", CSL.SINGLETON);
                    func = function (state, Item, item) {
                        var sp;
                        if (item && item.suffix) {
                            var suffix = CSL.checkSuffixSpacePrepend(state, item.suffix);
                            if (!state.tmp.just_looking) {
                                suffix = state.output.checkNestedBrace.update(suffix);
                            }
                            state.output.append((suffix), this);
                        }
                    };
                    suffix_token.execs.push(func);
                    target.push(suffix_token);
                }

                // Closes wrapper token
                func = function (state) {
                    state.output.closeLevel();
                };
                this.execs.push(func);
                func = function (state, Item) {
                    if (state.opt.development_extensions.apply_citation_wrapper
                        && state.sys.wrapCitationEntry
                        && !state.tmp.just_looking
                        && Item.system_id 
                        && state.tmp.area === "citation") { 
                        
                        state.output.endTag(); // closes citation link wrapper
                    }
                };
                this.execs.push(func);
                target.push(this);
                state.build.layout_flag = false;
                state.build.layout_locale_flag = false;
            } // !this.layout_raw
        }
    }
};

/*global CSL: true */

CSL.Node.macro = {
    build: function () {}
};

/*global CSL: true */

CSL.Node.alternative = {
    build: function (state, target) {
        if (this.tokentype === CSL.START) {

            var choose_tok = new CSL.Token("choose", CSL.START);
            CSL.Node["choose"].build.call(choose_tok, state, target);

            var if_tok = new CSL.Token("if", CSL.START);
            CSL.Attributes["@alternative-node-internal"].call(if_tok, state);
            CSL.Node["if"].build.call(if_tok, state, target);

            var func = function(state, Item) {

                state.tmp.oldItem = Item;
                state.tmp.oldLang = state.opt.lang;
                state.tmp.abort_alternative = true;

                if (Item["language-name"] && Item["language-name-original"]) {

                    var newItem = JSON.parse(JSON.stringify(Item));

                    newItem.language = newItem["language-name"];
                    var langspec = CSL.localeResolve(newItem.language, state.opt["default-locale"][0]);

                    if (state.opt.multi_layout) {
                        for (var i in state.opt.multi_layout) {
                            var locale_list = state.opt.multi_layout[i];
                            var gotlang = false;
                            for (var j in locale_list) {
                                var tryspec = locale_list[j];
                                if (langspec.best === tryspec.best || langspec.base === tryspec.base || langspec.bare === tryspec.bare) {
                                    gotlang = locale_list[0].best;
                                    break;
                                }
                            }
                            if (!gotlang) {
                                gotlang = state.opt["default-locale"][0];
                            }
                            state.opt.lang = gotlang;
                        }
                    }

                    for (var key in newItem) {
                        if (["id", "type", "language", "multi"].indexOf(key) === -1 && key.slice(0, 4) !== "alt-") {
                            if (newItem.multi && newItem.multi._keys[key]) {
                                var deleteme = true;
                                for (var lang in newItem.multi._keys[key]) {
                                    if (langspec.bare === lang.replace(/^([a-zA-Z]+).*/, "$1")) {
                                        deleteme = false;
                                        break;
                                    }
                                }
                                if (deleteme) {
                                    delete newItem[key];
                                }
                            } else {
                                delete newItem[key];
                            }
                        }
                    }
                    for (var key in newItem) {
                        if (key.slice(0, 4) === "alt-") {
                            newItem[key.slice(4)] = newItem[key];
                            state.tmp.abort_alternative = false;
                        } else {
                            if (newItem.multi && newItem.multi._keys) {
                                if (!newItem["alt-" + key] && newItem.multi._keys[key]) {
                                    if (newItem.multi._keys[key][langspec.best]) {
                                        newItem[key] = newItem.multi._keys[key][langspec.best];
                                        state.tmp.abort_alternative = false;
                                    } else if (newItem.multi._keys[key][langspec.base]) {
                                        newItem[key] = newItem.multi._keys[key][langspec.base];
                                        state.tmp.abort_alternative = false;
                                    } else if (newItem.multi._keys[key][langspec.bare]) {
                                        newItem[key] = newItem.multi._keys[key][langspec.bare];
                                        state.tmp.abort_alternative = false;
                                    }
                                }
                            }
                        }
                    }
                }

                state.output.openLevel(this);
                state.registry.refhash[Item.id] = newItem;
                state.nameOutput = new CSL.NameOutput(state, newItem);
            };
            this.execs.push(func);
            target.push(this);

            var choose_tok = new CSL.Token("choose", CSL.START);
            CSL.Node["choose"].build.call(choose_tok, state, target);

            var if_tok = new CSL.Token("if", CSL.START);
            CSL.Attributes["@alternative-node-internal"].call(if_tok, state);
            var func = function(state) {
                state.tmp.abort_alternative = true;
            }
            if_tok.execs.push(func);
            CSL.Node["if"].build.call(if_tok, state, target);

        } else if (this.tokentype === CSL.END) {

            var if_tok = new CSL.Token("if", CSL.END);
            CSL.Node["if"].build.call(if_tok, state, target);

            var choose_tok = new CSL.Token("choose", CSL.END);
            CSL.Node["choose"].build.call(choose_tok, state, target);

            var func = function(state, Item) {
                state.output.closeLevel();
                state.registry.refhash[Item.id] = state.tmp.oldItem;
                state.opt.lang = state.tmp.oldLang;
                state.nameOutput = new CSL.NameOutput(state, state.tmp.oldItem);
                state.tmp.abort_alternative = false;
            };
            this.execs.push(func);
            target.push(this);

            var if_tok = new CSL.Token("if", CSL.END);
            CSL.Node["if"].build.call(if_tok, state, target);

            var choose_tok = new CSL.Token("choose", CSL.END);
            CSL.Node["choose"].build.call(choose_tok, state, target);

        }
    }
};

CSL.Node["alternative-text"] = {
    build: function (state, target) {
        if (this.tokentype === CSL.SINGLETON) {
            // do stuff
            var func = function(state, Item) {
                var Item = state.refetchItem(Item.id);
                CSL.getCite.call(state, Item);
            };
            this.execs.push(func);
        }
        target.push(this);
    }
};



/*global CSL: true */

CSL.NameOutput = function(state, Item, item) {
    this.debug = false;
    //SNIP-START
    if (this.debug) {
        print("(1)");
    }
    //SNIP-END
    this.state = state;
    this.Item = Item;
    this.item = item;
    this.nameset_base = 0;
    this.etal_spec = {};
    this._first_creator_variable = false;
    this._please_chop = false;
};

CSL.NameOutput.prototype.init = function (names) {
    this.requireMatch = names.requireMatch;
    if (this.state.tmp.term_predecessor) {
        this.state.tmp.subsequent_author_substitute_ok = false;
    }
    if (this.nameset_offset) {
        this.nameset_base = this.nameset_base + this.nameset_offset;
    }
    this.nameset_offset = 0;
    this.names = names;
    this.variables = names.variables;

    this.state.tmp.value = [];
    this.state.tmp.rendered_name = [];
    this.state.tmp.label_blob = false;
    this.state.tmp.etal_node = false;
    this.state.tmp.etal_term = false;
    for (var i = 0, ilen = this.variables.length; i < ilen; i += 1) {
        if (this.Item[this.variables[i]] && this.Item[this.variables[i]].length) {
            this.state.tmp.value = this.state.tmp.value.concat(this.Item[this.variables[i]]);
        }
    }
    this["et-al"] = undefined;
    // REMOVE THIS
    this["with"] = undefined;

    this.name = undefined;
    // long, long-with-short, short
    this.institutionpart = {};
    // family, given
    //this.namepart = {};
    // before, after
    //this.label = {};

    this.state.tmp.group_context.tip.variable_attempt = true;

    this.labelVariable = this.variables[0];

    if (!this.state.tmp.value.length) {
        return;
    }

    // Abort and proceed to the next substitution if a match is required,
    // two variables are called, and they do not match.
    var checkCommonTerm = this.checkCommonAuthor(this.requireMatch);
    if (checkCommonTerm) {
        this.state.tmp.can_substitute.pop();
        this.state.tmp.can_substitute.push(true);
        //this.state.tmp.group_context.mystack[this.state.tmp.group_context.mystack.length-1].variable_success = false;
        for (var i in this.variables) {
            var idx = this.state.tmp.done_vars.indexOf(this.variables[i]);
            if (idx > -1) {
                this.state.tmp.done_vars = this.state.tmp.done_vars.slice(0, idx).concat(this.state.tmp.done_vars.slice(i+1));
            }
        }
        this.state.tmp.common_term_match_fail = true;
        this.variables = [];
    }
};


CSL.NameOutput.prototype.reinit = function (names, labelVariable) {
    this.requireMatch = names.requireMatch;
    this.labelVariable = labelVariable;

    if (this.state.tmp.can_substitute.value()) {
        this.nameset_offset = 0;
        // What-all should be carried across from the subsidiary
        // names node, and on what conditions? For each attribute,
        // and decoration, is it an override, or is it additive?
        this.variables = names.variables;
        
        // Not sure why this is necessary. Guards against a memory leak perhaps?
        var oldval = this.state.tmp.value.slice();
        this.state.tmp.value = [];

        for (var i = 0, ilen = this.variables.length; i < ilen; i += 1) {
            if (this.Item[this.variables[i]] && this.Item[this.variables[i]].length) {
                this.state.tmp.value = this.state.tmp.value.concat(this.Item[this.variables[i]]);
            }
        }
        if (this.state.tmp.value.length) {
            this.state.tmp.can_substitute.replace(false, CSL.LITERAL);
        }

        this.state.tmp.value = oldval;

    }
    // Abort and proceed to the next substitution if a match is required,
    // two variables are called, and they do not match.
    var checkCommonTerm = this.checkCommonAuthor(this.requireMatch);
    if (checkCommonTerm) {
        this.state.tmp.can_substitute.pop();
        this.state.tmp.can_substitute.push(true);
        for (var i in this.variables) {
            var idx = this.state.tmp.done_vars.indexOf(this.variables[i]);
            if (idx > -1) {
                this.state.tmp.done_vars = this.state.tmp.done_vars.slice(0, idx).concat(this.state.tmp.done_vars.slice(i+1));
            }
        }
        this.variables = [];
    }
};

CSL.NameOutput.prototype.outputNames = function () {
    var i, ilen;
    var variables = this.variables;
    if (this.institution.and) {
        if (!this.institution.and.single.blobs || !this.institution.and.single.blobs.length) {
            this.institution.and.single.blobs = this.name.and.single.blobs;
        }
        if (!this.institution.and.multiple.blobs || !this.institution.and.multiple.blobs.length) {
            this.institution.and.multiple.blobs = this.name.and.multiple.blobs;
        }
    }

    this.variable_offset = {};
    if (this.family) {
        this.family_decor = CSL.Util.cloneToken(this.family);
        this.family_decor.strings.prefix = "";
        this.family_decor.strings.suffix = "";
        // Sets text-case value (text-case="title" is suppressed for items
        // non-English with non-English value in Item.language)
        for (i = 0, ilen = this.family.execs.length; i < ilen; i += 1) {
            this.family.execs[i].call(this.family_decor, this.state, this.Item);
        }
    } else {
        this.family_decor = false;
    }

    if (this.given) {
        this.given_decor = CSL.Util.cloneToken(this.given);
        this.given_decor.strings.prefix = "";
        this.given_decor.strings.suffix = "";
        // Sets text-case value (text-case="title" is suppressed for items
        // non-English with non-English value in Item.language)
        for (i = 0, ilen = this.given.execs.length; i < ilen; i += 1) {
            this.given.execs[i].call(this.given_decor, this.state, this.Item);
        }
    } else {
        this.given_decor = false;
    }

    //SNIP-START
    if (this.debug) {
        print("(2)");
    }
    //SNIP-END
    // util_names_etalconfig.js
    this.getEtAlConfig();
    //SNIP-START
    if (this.debug) {
        print("(3)");
    }
    //SNIP-END
    // util_names_divide.js
    this.divideAndTransliterateNames();
    //SNIP-START
    if (this.debug) {
        print("(4)");
    }
    //SNIP-END
    // util_names_truncate.js

    this.truncatePersonalNameLists();
    //SNIP-START
    if (this.debug) {
        print("(5)");
    }
    //SNIP-END

    //SNIP-START
    if (this.debug) {
        print("(6)");
    }
    //SNIP-END
    // util_names_disambig.js
    this.disambigNames();

    // util_names_constraints.js
    this.constrainNames();
    //SNIP-START
    if (this.debug) {
        print("(7)");
    }
    //SNIP-END
    // form="count"
    if (this.name.strings.form === "count") {
        if (this.state.tmp.extension || this.names_count != 0) {
            this.state.output.append(this.names_count, "empty");
            this.state.tmp.group_context.tip.variable_success = true;
        }
        return;
    }

    //SNIP-START
    if (this.debug) {
        print("(8)");
    }
    //SNIP-END
    this.setEtAlParameters();
    //SNIP-START
    if (this.debug) {
        print("(9)");
    }
    //SNIP-END
    this.setCommonTerm(this.requireMatch);
    //SNIP-START
    if (this.debug) {
        print("(10)");
    }
    //SNIP-END
    this.state.tmp.name_node = {};
    this.state.tmp.name_node.children = [];
    this.renderAllNames();
    //SNIP-START
    if (this.debug) {
        print("(11)");
    }
    //SNIP-END
    var blob_list = [];
    for (i = 0, ilen = variables.length; i < ilen; i += 1) {
        var v = variables[i];
        var institution_sets = [];
        var institutions = false;
        var varblob = null;
        if (!this.state.opt.development_extensions.spoof_institutional_affiliations) {
            varblob = this._join([this.freeters[v]], "");
        } else {
            //SNIP-START
            if (this.debug) {
                print("(11a)");
            }
            //SNIP-END
            for (var j = 0, jlen = this.institutions[v].length; j < jlen; j += 1) {
                institution_sets.push(this.joinPersonsAndInstitutions([this.persons[v][j], this.institutions[v][j]]));
            }
            //SNIP-START
            if (this.debug) {
                print("(11b)");
            }
            //SNIP-END
            if (this.institutions[v].length) {
                var pos = this.nameset_base + this.variable_offset[v];
                if (this.freeters[v].length) {
                    pos += 1;
                }
                institutions = this.joinInstitutionSets(institution_sets, pos);
            }
            //SNIP-START
            if (this.debug) {
                print("(11c)");
            }
            //SNIP-END
            var varblob = this.joinFreetersAndInstitutionSets([this.freeters[v], institutions]);
            //SNIP-START
            if (this.debug) {
                print("(11d)");
            }
            //SNIP-END
        }
        if (varblob) {
            // Apply labels, if any
            if (!this.state.tmp.extension) {
                varblob = this._applyLabels(varblob, v);
            }
            blob_list.push(varblob);
        }
        //SNIP-START
        if (this.debug) {
            print("(11e)");
        }
        //SNIP-END
        if (this.common_term) {
            break;
        }
    }
    //SNIP-START
    if (this.debug) {
        print("(12)");
    }
    //SNIP-END
    this.state.output.openLevel("empty");
    this.state.output.current.value().strings.delimiter = this.state.inheritOpt(this.names, "delimiter", "names-delimiter");
    //SNIP-START
    if (this.debug) {
        print("(13)");
    }
    //SNIP-END
    for (i = 0, ilen = blob_list.length; i < ilen; i += 1) {
        // notSerious
        this.state.output.append(blob_list[i], "literal", true);
    }
    if (!this.state.tmp.just_looking && blob_list.length > 0) {
        this.state.tmp.probably_rendered_something = true;
    }
    //SNIP-START
    if (this.debug) {
        print("(14)");
    }
    //SNIP-END
    this.state.output.closeLevel("empty");
    //SNIP-START
    if (this.debug) {
        print("(15)");
    }
    //SNIP-END
    var blob = this.state.output.pop();
    this.state.tmp.name_node.top = blob;
    //SNIP-START
    if (this.debug) {
        print("(16)");
    }
    //SNIP-END

    // Append will drop the names on the floor here if suppress-me is
    // set on element_trace.
    // Need to rescue the value for collapse comparison.
    var namesToken = CSL.Util.cloneToken(this.names);
    this.state.output.append(blob, namesToken);
    if (this.state.tmp.term_predecessor_name) {
        this.state.tmp.term_predecessor = true;
    }
    //SNIP-START
    if (this.debug) {
        print("(17)");
    }
    //SNIP-END
    // Also used in CSL.Util.substituteEnd (which could do with
    // some cleanup at this writing).
    //SNIP-START
    if (this.debug) {
        print("(18)");
    }
    //SNIP-END
    if (variables[0] !== "authority") {
        // Just grab the string values in the name
        var name_node_string = [];
        var nameobjs = this.Item[variables[0]];
        if (nameobjs) {
            for (var i = 0, ilen = nameobjs.length; i < ilen; i += 1) {
                var substring = CSL.Util.Names.getRawName(nameobjs[i]);
                if (substring) {
                    name_node_string.push(substring);
                }
            }
        }
        name_node_string = name_node_string.join(", ");
        if (name_node_string) {
            this.state.tmp.name_node.string = name_node_string;
        }
    }
    // for classic support
    // This may be more convoluted than it needs to be. Or maybe not.
    //
    // Check for classic abbreviation
    //
    // If found, then (1) suppress title rendering, (2) replace the node
    // with the abbreviation output [and (3) do not run this._collapseAuthor() ?]
    if (this.state.tmp.name_node.string && !this.state.tmp.first_name_string) {
        this.state.tmp.first_name_string = this.state.tmp.name_node.string;
    }
    if ("classic" === this.Item.type) {
        if (this.state.tmp.first_name_string) {
            var author_title = [];
            author_title.push(this.state.tmp.first_name_string);
            if (this.Item.title) {
                author_title.push(this.Item.title);
            }
            author_title = author_title.join(", ");
            if (author_title && this.state.sys.getAbbreviation) {
                this.state.transform.loadAbbreviation("default", "classic", author_title);
                if (this.state.transform.abbrevs["default"].classic[author_title]) {
                    this.state.tmp.done_vars.push("title");
                    this.state.output.append(this.state.transform.abbrevs["default"].classic[author_title], "empty", true);
                    blob = this.state.output.pop();
				    this.state.tmp.name_node.top.blobs.pop();
                    this.state.tmp.name_node.top.blobs.push(blob);
                }
            }
        }
    }

    // Let's try something clever here.
    this._collapseAuthor();

    // For name_SubstituteOnNamesSpanNamesSpanFail
    this.variables = [];
    //SNIP-START
    if (this.debug) {
        print("(19)");
    }
    //SNIP-END
};

CSL.NameOutput.prototype._applyLabels = function (blob, v) {
    var txt;
    if (!this.label || !this.label[this.labelVariable]) {
        return blob;
    }
    var plural = 0;
    var num = this.freeters_count[v] + this.institutions_count[v];
    if (num > 1) {
        plural = 1;
    } else {
        for (var i = 0, ilen = this.persons[v].length; i < ilen; i += 1) {
            num += this.persons_count[v][i];
        }
        if (num > 1) {
            plural = 1;
        }
    }
    // Some code duplication here, should be factored out.
    if (this.label[this.labelVariable].before) {
        if ("number" === typeof this.label[this.labelVariable].before.strings.plural) {
            plural = this.label[this.labelVariable].before.strings.plural;
        }
        txt = this._buildLabel(v, plural, "before", this.labelVariable);
        this.state.output.openLevel("empty");
        this.state.output.append(txt, this.label[this.labelVariable].before, true);
        this.state.output.append(blob, "literal", true);
        this.state.output.closeLevel("empty");
        blob = this.state.output.pop();
    } else if (this.label[this.labelVariable].after) {
        if ("number" === typeof this.label[this.labelVariable].after.strings.plural) {
            plural = this.label[this.labelVariable].after.strings.plural;
        }
        txt = this._buildLabel(v, plural, "after", this.labelVariable);
        this.state.output.openLevel("empty");
        this.state.output.append(blob, "literal", true);
        this.state.output.append(txt, this.label[this.labelVariable].after, true);
        this.state.tmp.label_blob = this.state.output.pop();
        this.state.output.append(this.state.tmp.label_blob,"literal",true);
        this.state.output.closeLevel("empty");
        blob = this.state.output.pop();
    }
    return blob;
};

CSL.NameOutput.prototype._buildLabel = function (term, plural, position, v) {
    if (this.common_term) {
        term = this.common_term;
    }

    var ret = false;
    var node = this.label[v][position];
    if (node) {
        ret = CSL.castLabel(this.state, node, term, plural, CSL.TOLERANT);
    }
    return ret;
};


CSL.NameOutput.prototype._collapseAuthor = function () {
    var myqueue, mystr, oldchars;
    // collapse can be undefined, an array of length zero, and probably
    // other things ... ugh.
    if (this.state.tmp.name_node.top.blobs.length === 0) {
        return;
    }
    if (this.nameset_base === 0 && this.Item[this.variables[0]] && !this._first_creator_variable) {
        this._first_creator_variable = this.variables[0];
    }
    if ((this.state[this.state.tmp.area].opt.collapse
            && this.state[this.state.tmp.area].opt.collapse.length)
        || (this.state[this.state.tmp.area].opt.cite_group_delimiter 
            && this.state[this.state.tmp.area].opt.cite_group_delimiter.length)) {

        if (this.state.tmp.authorstring_request) {
            // Avoid running this on every call to getAmbiguousCite()?
            mystr = "";
            myqueue = this.state.tmp.name_node.top.blobs.slice(-1)[0].blobs;
            oldchars = this.state.tmp.offset_characters;
            if (myqueue) {
                mystr = this.state.output.string(this.state, myqueue, false);
            }
            // Avoid side-effects on character counting: we're only interested
            // in the final rendering.
            this.state.tmp.offset_characters = oldchars;
            this.state.registry.authorstrings[this.Item.id] = mystr;
        } else if (!this.state.tmp.just_looking
                   && !this.state.tmp.suppress_decorations && ((this.state[this.state.tmp.area].opt.collapse && this.state[this.state.tmp.area].opt.collapse.length) || this.state[this.state.tmp.area].opt.cite_group_delimiter && this.state[this.state.tmp.area].opt.cite_group_delimiter)) {
            // XX1 print("RENDER: "+this.Item.id);
            mystr = "";
            myqueue = this.state.tmp.name_node.top.blobs.slice(-1)[0].blobs;
            oldchars = this.state.tmp.offset_characters;
            if (myqueue) {
                mystr = this.state.output.string(this.state, myqueue, false);
            }
            if (mystr === this.state.tmp.last_primary_names_string) {
                if (this.item["suppress-author"] || (this.state[this.state.tmp.area].opt.collapse && this.state[this.state.tmp.area].opt.collapse.length)) {
                    // XX1 print("    CUT!");
                    this.state.tmp.name_node.top.blobs.pop();
                    this.state.tmp.name_node.children = [];
                    // If popped, avoid side-effects on character counting: we're only interested
                    // in things that actually render.
                    this.state.tmp.offset_characters = oldchars;
                }
                // Needed
                if (this.state[this.state.tmp.area].opt.cite_group_delimiter && this.state[this.state.tmp.area].opt.cite_group_delimiter) {
                    this.state.tmp.use_cite_group_delimiter = true;
                }
            } else {
                // XX1 print("remembering: "+mystr);
                this.state.tmp.last_primary_names_string = mystr;
                // XXXXX A little more precision would be nice.
                // This will clobber variable="author editor" as well as variable="author".

                if (this.variables.indexOf(this._first_creator_variable) > -1 && this.item && this.item["suppress-author"] && this.Item.type !== "legal_case") {
                    this.state.tmp.name_node.top.blobs.pop();
                    this.state.tmp.name_node.children = [];
                    // If popped, avoid side-effects on character counting: we're only interested
                    // in things that actually render.
                    this.state.tmp.offset_characters = oldchars;

                    // A wild guess, but will usually be correct
                    this.state.tmp.term_predecessor = false;
                }
                // Arcane and probably unnecessarily complicated?
                this.state.tmp.have_collapsed = false;
                // Needed
                if (this.state[this.state.tmp.area].opt.cite_group_delimiter && this.state[this.state.tmp.area].opt.cite_group_delimiter) {
                    this.state.tmp.use_cite_group_delimiter = false;
                }
            }
        }
    }
};

/*
CSL.NameOutput.prototype.suppressNames = function() {
    suppress_condition = suppress_min && display_names.length >= suppress_min;
    if (suppress_condition) {
        continue;
    }
}
*/

/*global CSL: true */

CSL.NameOutput.prototype.isPerson = function (value) {
    if (value.literal
        || (!value.given && value.family && value.isInstitution)) {
        
        return false;
    } else {
        return true;
    }
};

/*global CSL: true */

CSL.NameOutput.prototype.truncatePersonalNameLists = function () {
    var v, i, ilen, j, jlen, chopvar, values;
    // XXX Before truncation, make a note of the original number
    // of names, for use in et-al evaluation.
    this.freeters_count = {};
    this.persons_count = {};
    this.institutions_count = {};
    // By key is okay here, as we don't care about sequence.
    for (v in this.freeters) {
        if (this.freeters.hasOwnProperty(v)) {
            this.freeters_count[v] = this.freeters[v].length;
            this.freeters[v] = this._truncateNameList(this.freeters, v);
        }
    }

    for (v in this.persons) {
        if (this.persons.hasOwnProperty(v)) {
            this.institutions_count[v] = this.institutions[v].length;
            this._truncateNameList(this.institutions, v);
            this.persons[v] = this.persons[v].slice(0, this.institutions[v].length);
            this.persons_count[v] = [];
            for (j = 0, jlen = this.persons[v].length; j < jlen; j += 1) {
                this.persons_count[v][j] = this.persons[v][j].length;
                this.persons[v][j] = this._truncateNameList(this.persons, v, j);
            }
        }
    }
    // Could be factored out to a separate function for clarity.
    if (this.etal_min === 1 && this.etal_use_first === 1 
        && !(this.state.tmp.extension
             || this.state.tmp.just_looking)) {
        chopvar = v;
    } else {
        chopvar = false;
    }
    if (chopvar || this._please_chop) {
        for (i = 0, ilen = this.variables.length; i < ilen; i += 1) {
            v = this.variables[i];
            if (this.freeters[v].length) {
                if (this._please_chop === v) {
                    this.freeters[v] = this.freeters[v].slice(1);
                    this.freeters_count[v] += -1;
                    this._please_chop = false;
                } else if (chopvar && !this._please_chop) {
                    this.freeters[v] = this.freeters[v].slice(0, 1);
                    this.freeters_count[v] = 1;
                    this.institutions[v] = [];
                    this.persons[v] = [];
                    this._please_chop = chopvar;
                }
            }
            for (var j=0,jlen = this.persons[v].length;j<jlen;j++) {
                if (this.persons[v][j].length) {
                    if (this._please_chop === v) {
                        this.persons[v][j] = this.persons[v][j].slice(1);
                        this.persons_count[v][j] += -1;
                        this._please_chop = false;
                        break;
                    } else if (chopvar && !this._please_chop) {
                        this.freeters[v] = this.persons[v][j].slice(0, 1);
                        this.freeters_count[v] = 1;
                        this.institutions[v] = [];
                        this.persons[v] = [];
                        values = [];
                        this._please_chop = chopvar;
                        break;
                    }
                }
            }
            if (this.institutions[v].length) {
                if (this._please_chop === v) {
                    this.institutions[v] = this.institutions[v].slice(1);
                    this.institutions_count[v] += -1;
                    this._please_chop = false;
                } else if (chopvar && !this._please_chop) {
                    this.institutions[v] = this.institutions[v].slice(0, 1);
                    this.institutions_count[v] = 1;
                    values = [];
                    this._please_chop = chopvar;
                }
            }
        }
    }

    // Transliteration and abbreviation mapping

    // Hmm. This could produce three lists for each nameset:
    //   - primary (transformed in place)
    //   - secondary
    //   - tertiary
    // with items that produce no result in the secondary and tertiary
    // transforms set to false. Maybe.

    // Actually that would be insane, so forget it.
    // What we need is to add suitable parameters to getName(), and merge
    // the single-name-level operations below into that function. Then the
    // operation can be applied in util_names_render.js, and the logic
    // becomes very similar to what we already have running in util_transform.js.

/*
    for (v in this.freeters) {
        this._transformNameset(this.freeters[v]);
    }
    for (v in this.persons) {
        for (i = 0, ilen = this.persons[v].length; i < ilen; i += 1) {
            this._transformNameset(this.persons[v][i]);
        }
        this._transformNameset(this.institutions[v]);
    }
*/

    // Could also be factored out to a separate function for clarity.
    // ???? XXX Does this belong?
    for (i = 0, ilen = this.variables.length; i < ilen; i += 1) {
        if (this.institutions[v].length) {
            this.nameset_offset += 1;
        }
        for (var j=0,jlen=this.persons[v].length;j<jlen;j++) {
            if (this.persons[v][j].length) {
                this.nameset_offset += 1;
            }
            // this.institutions[v][i] = this._splitInstitution(this.institutions[v][i], v, i);
        }
    }
};

CSL.NameOutput.prototype._truncateNameList = function (container, variable, index) {
    var lst;
    if ("undefined" === typeof index) {
        lst = container[variable];
    } else {
        lst = container[variable][index];
    }
    if (this.state[this.state[this.state.tmp.area].root].opt.max_number_of_names 
        && lst.length > 50 
        && lst.length > (this.state[this.state[this.state.tmp.area].root].opt.max_number_of_names + 2)) {

        // Preserve the last name in the list, in case we're rendering with a PI ellipsis (et-al-use-last)
        var limit = this.state[this.state[this.state.tmp.area].root].opt.max_number_of_names;
        lst = lst.slice(0, limit+1).concat(lst.slice(-1));
    }
    return lst;
};


/*global CSL: true */

CSL.NameOutput.prototype.divideAndTransliterateNames = function () {
    var i, ilen, j, jlen;
    var Item = this.Item;
    var variables = this.variables;
    this.varnames = variables.slice();
    this.freeters = {};
    this.persons = {};
    this.institutions = {};
    for (i = 0, ilen = variables.length; i < ilen; i += 1) {
        var v = variables[i];
        this.variable_offset[v] = this.nameset_offset;
        var values = this._normalizeVariableValue(Item, v);
        if (this.name.strings["suppress-min"] && values.length >= this.name.strings["suppress-min"]) {
            values = [];
        }
        if (this.name.strings["suppress-max"] && values.length <= this.name.strings["suppress-max"]) {
            values = [];
        }
        this._getFreeters(v, values);
        this._getPersonsAndInstitutions(v, values);
        if (this.state.opt.development_extensions.spoof_institutional_affiliations) {
            if (this.name.strings["suppress-min"] === 0) {
                this.freeters[v] = [];
                for (j = 0, jlen = this.persons[v].length; j < jlen; j += 1) {
                    this.persons[v][j] = [];
                }
            } else if (this.institution.strings["suppress-min"] === 0) {
                this.institutions[v] = [];
                this.freeters[v] = this.freeters[v].concat(this.persons[v]);
                for (j = 0, jlen = this.persons[v].length; j < jlen; j += 1) {
                    for (var k = 0, klen = this.persons[v][j].length; k < klen; k += 1) {
                        this.freeters[v].push(this.persons[v][j][k]);
                    }
                }
                this.persons[v] = [];
            }
        }
    }
};

CSL.NameOutput.prototype._normalizeVariableValue = function (Item, variable) {
    var names;
    if ("string" === typeof Item[variable] || "number" === typeof Item[variable]) {
        CSL.debug("name variable \"" + variable + "\" is string or number, not array. Attempting to fix.");
        names = [{literal: Item[variable] + ""}];
    } else if (!Item[variable]) {
        names = [];
    } else if ("number" !== typeof Item[variable].length) {
        CSL.debug("name variable \"" + variable + "\" is object, not array. Attempting to fix.");
        Item[variable] = [Item[variable]];
        names = Item[variable].slice();
    } else {
        names = Item[variable].slice();
    }
    return names;
};

CSL.NameOutput.prototype._getFreeters = function (v, values) {
    this.freeters[v] = [];
    if (this.state.opt.development_extensions.spoof_institutional_affiliations) {
        for (var i=values.length-1;i>-1;i--) {
            if (this.isPerson(values[i])) {
                var value = this._checkNickname(values.pop());
                if (value) {
                    this.freeters[v].push(value);
                }
            } else {
                break;
            }
        }
    } else {
        for (var i=values.length-1;i>-1;i--) {
            var value = values.pop();
            if (this.isPerson(value)) {
                var value = this._checkNickname(value);
            }
            this.freeters[v].push(value);
        }
    }
    this.freeters[v].reverse();
    if (this.freeters[v].length) {
        this.nameset_offset += 1;
    }
};

CSL.NameOutput.prototype._getPersonsAndInstitutions = function (v, values) {
    this.persons[v] = [];
    this.institutions[v] = [];
    if (!this.state.opt.development_extensions.spoof_institutional_affiliations) {
        return;
    }
    var persons = [];
    var has_affiliates = false;
    var first = true;
    for (var i = values.length - 1; i > -1; i += -1) {
        if (this.isPerson(values[i])) {
            var value = this._checkNickname(values[i]);
            if (value) {
                persons.push(value);
            }
        } else {
            has_affiliates = true;
            this.institutions[v].push(values[i]);
            if (!first) {
                persons.reverse();
                this.persons[v].push(persons);
                persons = [];
            }
            first = false;
        }
    }
    if (has_affiliates) {
        persons.reverse();
        this.persons[v].push(persons);
        this.persons[v].reverse();
        this.institutions[v].reverse();
    }
};

CSL.NameOutput.prototype._clearValues = function (values) {
    for (var i = values.length - 1; i > -1; i += -1) {
        values.pop();
    }
};

CSL.NameOutput.prototype._checkNickname = function (name) {
    if (["interview", "personal_communication"].indexOf(this.Item.type) > -1) {
        var author = "";
        author = CSL.Util.Names.getRawName(name);
        if (author && this.state.sys.getAbbreviation && !(this.item && this.item["suppress-author"])) {
            var normalizedKey = author;
            if (this.state.sys.normalizeAbbrevsKey) {
                // The first argument does not have to be the exact variable name.
                normalizedKey = this.state.sys.normalizeAbbrevsKey("author", author);
            }
            this.state.transform.loadAbbreviation("default", "nickname", normalizedKey);
            // XXX Why does this have to happen here?
            var myLocalName = this.state.transform.abbrevs["default"].nickname[normalizedKey];
            if (myLocalName) {
                if (myLocalName === "!here>>>") {
                    name = false;
                } else {
                    name = {family:myLocalName,given:''};
                }
            }
        }
    }
    return name;
};

/*global CSL: true */

CSL.NameOutput.prototype.joinPersons = function (blobs, pos, j, tokenname) {
    var ret;
    if (!tokenname) {
        tokenname = "name";
    }
    if ("undefined" === typeof j) {
        if (this.etal_spec[pos].freeters === 1) {
           ret = this._joinEtAl(blobs, tokenname);
        } else if (this.etal_spec[pos].freeters === 2) {
            ret = this._joinEllipsis(blobs, tokenname);
        } else if (!this.state.tmp.sort_key_flag) {
            ret = this._joinAnd(blobs, tokenname);
        } else {
            ret = this._join(blobs, " ");
        }
    } else {
        if (this.etal_spec[pos].persons[j] === 1) {
            ret = this._joinEtAl(blobs, tokenname);
        } else if (this.etal_spec[pos].persons[j] === 2) {
            ret = this._joinEllipsis(blobs, tokenname);
        } else if (!this.state.tmp.sort_key_flag) {
            ret = this._joinAnd(blobs, tokenname);
        } else {
            ret = this._join(blobs, " ");
        }
    }
    return ret;
};


CSL.NameOutput.prototype.joinInstitutionSets = function (blobs, pos) {
    var ret;
    if (this.etal_spec[pos].institutions === 1) {
        ret = this._joinEtAl(blobs, "institution");
    } else if (this.etal_spec[pos].institutions === 2) {
        ret = this._joinEllipsis(blobs, "institution");
    } else {
        ret = this._joinAnd(blobs, "institution");
    }
    return ret;
};


CSL.NameOutput.prototype.joinPersonsAndInstitutions = function (blobs) {
    //
    return this._join(blobs, this.state.tmp.name_delimiter);
};

// LEGACY
// This should go away eventually
CSL.NameOutput.prototype.joinFreetersAndInstitutionSets = function (blobs) {
    // Nothing, one or two, never more
    var ret = this._join(blobs, "[never here]", this["with"].single, this["with"].multiple);
    //var ret = this._join(blobs, "");
    return ret;
};

CSL.NameOutput.prototype._joinEtAl = function (blobs, tokenname) {
    //
    var blob = this._join(blobs, this.state.tmp.name_delimiter);
    
    // notSerious
    this.state.output.openLevel(this._getToken(tokenname));
    // Delimiter is applied from separately saved source in this case,
    // for discriminate application of single and multiple joins.
    this.state.output.current.value().strings.delimiter = "";
    this.state.output.append(blob, "literal", true);
    if (blobs.length > 1) {
        this.state.output.append(this["et-al"].multiple, "literal", true);
    } else if (blobs.length === 1) {
        this.state.output.append(this["et-al"].single, "literal", true);
    }
    this.state.output.closeLevel();
    return this.state.output.pop();
};


CSL.NameOutput.prototype._joinEllipsis = function (blobs, tokenname) {
    return this._join(blobs, this.state.tmp.name_delimiter, this.name.ellipsis.single, this.name.ellipsis.multiple, tokenname);
};


CSL.NameOutput.prototype._joinAnd = function (blobs, tokenname) {
    return this._join(blobs, this.state.inheritOpt(this[tokenname], "delimiter", (tokenname + "-delimiter"), ", "), this[tokenname].and.single, this[tokenname].and.multiple, tokenname);
};


CSL.NameOutput.prototype._join = function (blobs, delimiter, single, multiple) {
    var i, ilen;
    if (!blobs) {
        return false;
    }
    // Eliminate false and empty blobs
    for (i = blobs.length - 1; i > -1; i += -1) {
        if (!blobs[i] || blobs[i].length === 0 || !blobs[i].blobs.length) {
            blobs = blobs.slice(0, i).concat(blobs.slice(i + 1));
        }
    }
    // XXXX This needs some attention before moving further.
    // Code is not sufficiently transparent.
    if (!blobs.length) {
        return false;
    } else if (single && blobs.length === 2) {
        // Clone to avoid corruption of style by affix migration during output
        if (single) {
            single = new CSL.Blob(single.blobs,single);
        }
        blobs = [blobs[0], single, blobs[1]];
    } else {
        var delimiter_offset;
        if (multiple) {
            delimiter_offset = 2;
        } else {
            delimiter_offset = 1;
        }
        // It kind of makes sense down to here.
        for (i = 0, ilen = blobs.length - delimiter_offset; i < ilen; i += 1) {
            blobs[i].strings.suffix += delimiter;
        }
        if (blobs.length > 1) {
            var blob = blobs.pop();
            if (multiple) {
                // Clone to avoid corruption of style by affix migration during output
                multiple = new CSL.Blob(multiple.blobs,multiple);
                blobs.push(multiple);
            } else {
                // Clone to avoid corruption of style by affix migration during output
                if (single) {
                    single = new CSL.Blob(single.blobs,single);
                }
                blobs.push(single);
            }
            blobs.push(blob);
        }
    }

    //this.state.output.openLevel(this._getToken(tokenname));
    this.state.output.openLevel();

    //this.state.output.openLevel(this._getToken("empty"));
    // Delimiter is applied from separately saved source in this case,
    // for discriminate application of single and multiple joins.
    if (single && multiple) {
        this.state.output.current.value().strings.delimiter = "";
    }
    for (i = 0, ilen = blobs.length; i < ilen; i += 1) {
        this.state.output.append(blobs[i], false, true);
    }
    this.state.output.closeLevel();
    return this.state.output.pop();
};


CSL.NameOutput.prototype._getToken = function (tokenname) {
    var token = this[tokenname];
    if (tokenname === "institution") {
        var newtoken = new CSL.Token();
        // Which, hmm, is the same thing as "empty"
        // Oh, well.
        //newtoken.strings.prefix = token.prefix;
        //newtoken.strings.suffix = token.suffix;
        return newtoken;
    }
    return token;
};

/*global CSL: true */

CSL.NameOutput.prototype.checkCommonAuthor = function(requireMatch) {
    if (!requireMatch) {
        return false;
    }
    var common_term = false;
    if (this.variables.length === 2) {
        var variables = this.variables;
        var varnames = variables.slice();
        varnames.sort();
        common_term = varnames.join("");
    }
    if (!common_term) {
        return false;
    }
    var has_term = false;
    if (this.state.locale[this.state.opt.lang].terms[common_term]) {
        has_term = true;
    }
    if (!has_term) {
        this.state.tmp.done_vars.push(this.variables[0]);
        this.state.tmp.done_vars.push(this.variables[1]);
        return false;
    }
    var firstSet = this.Item[this.variables[0]];
    var secondSet = this.Item[this.variables[1]];
    var perfectMatch = this._compareNamesets(firstSet, secondSet);
    if (perfectMatch === true) {
        this.state.tmp.done_vars.push(this.variables[0]);
        this.state.tmp.done_vars.push(this.variables[1]);
    }
    // This may be counter-intuitive.
    // This check controls whether we will fail on the this attempt at rendering
    // and proceed with substitution. If the names match exactly (true), then
    // we do *not* want to abort and continue with substitution.
    return !perfectMatch;
};

CSL.NameOutput.prototype.setCommonTerm = function () {
    var variables = this.variables;
    var varnames = variables.slice();
    varnames.sort();
    this.common_term = varnames.join("");
    // When no varnames are on offer
    if (!this.common_term) {
        return;
    }
    var has_term = false;
    if (this.label && this.label[this.variables[0]]) {
        if (this.label[this.variables[0]].before) {
            has_term = this.state.getTerm(this.common_term, this.label[this.variables[0]].before.strings.form, 0);
        } else if (this.label[this.variables[0]].after) {
            has_term = this.state.getTerm(this.common_term, this.label[this.variables[0]].after.strings.form, 0);
        }
     }

    // When there is no common term
    if (!this.state.locale[this.state.opt.lang].terms[this.common_term]
        || !has_term
        || this.variables.length < 2) {
        this.common_term = false;
        return;
    }
    var freeters_offset = 0;
    for (var i = 0, ilen = this.variables.length - 1; i < ilen; i += 1) {
        var v = this.variables[i];
        var vv = this.variables[i + 1];
        if (this.freeters[v].length || this.freeters[vv].length) {
            if (this.etal_spec[v].freeters !== this.etal_spec[vv].freeters
                || !this._compareNamesets(this.freeters[v], this.freeters[vv])) {
                this.common_term = false;
                return;
            }
            freeters_offset += 1;
        }
        if (this.persons[v].length !== this.persons[vv].length) {
            this.common_term = false;
            return;
        }
        for (var j = 0, jlen = this.persons[v].length; j < jlen; j += 1) {
            if (this.etal_spec[v].persons[j] !== this.etal_spec[vv].persons[j]
                || !this._compareNamesets(this.persons[v][j], this.persons[vv][j])) {
                this.common_term = false;
                return;
            }
        }
    }
};

CSL.NameOutput.prototype._compareNamesets = function (base_nameset, nameset) {
    if (!base_nameset || !nameset || base_nameset.length !== nameset.length) {
        return false;
    }
    for (var i = 0, ilen = nameset.length; i < ilen; i += 1) {
        for (var j = 0, jlen = CSL.NAME_PARTS.length; j < jlen; j += 1) {
            var part = CSL.NAME_PARTS[j];
            if (!base_nameset[i] || base_nameset[i][part] != nameset[i][part]) {
                return false;
            }
        }
    }
    return true;
};

/*global CSL: true */

CSL.NameOutput.prototype.constrainNames = function () {
    // figure out how many names to include, in light of the disambig params
    //
    this.names_count = 0;
    //var pos = 0;
    var pos;
    for (var i = 0, ilen = this.variables.length; i < ilen; i += 1) {
        var v = this.variables[i];
        pos = this.nameset_base + i;
        // Constrain independent authors here
        if (this.freeters[v].length) {
            this.state.tmp.names_max.push(this.freeters[v].length, "literal");
            this._imposeNameConstraints(this.freeters, this.freeters_count, v, pos);
            this.names_count += this.freeters[v].length;
        }

        // Constrain institutions here
        if (this.institutions[v].length) {
            this.state.tmp.names_max.push(this.institutions[v].length, "literal");
            this._imposeNameConstraints(this.institutions, this.institutions_count, v, pos);
            this.persons[v] = this.persons[v].slice(0, this.institutions[v].length);
            this.names_count += this.institutions[v].length;
        }

        for (var j = 0, jlen = this.persons[v].length; j < jlen; j += 1) {
            // Constrain affiliated authors here
            if (this.persons[v][j].length) {
                this.state.tmp.names_max.push(this.persons[v][j].length, "literal");
                this._imposeNameConstraints(this.persons[v], this.persons_count[v], j, pos);
                this.names_count += this.persons[v][j].length;
            }
        }
    }
};

CSL.NameOutput.prototype._imposeNameConstraints = function (lst, count, key, pos) {
    // display_names starts as the original length of this list of names.
    var display_names = lst[key];
    var discretionary_names_length = this.state.tmp["et-al-min"];
    
    // Mappings, to allow existing disambiguation machinery to
    // remain untouched.
    if (this.state.tmp.suppress_decorations) {
        if (this.state.tmp.disambig_request && this.state.tmp.disambig_request.names[pos]) {
            // Oh. Trouble.
            // state.tmp.nameset_counter is the number of the nameset
            // in the disambiguation try-sequence. Ouch.
            discretionary_names_length = this.state.tmp.disambig_request.names[pos];
        } else if (count[key] >= this.etal_min) {
            discretionary_names_length = this.etal_use_first;
        }
    } else {
        if (this.state.tmp.disambig_request 
            && this.state.tmp.disambig_request.names[pos] > this.etal_use_first) {

            if (count[key] < this.etal_min) {
                discretionary_names_length = count[key];
            } else {
                discretionary_names_length = this.state.tmp.disambig_request.names[pos];
            }
        } else if (count[key] >= this.etal_min) {
            //discretionary_names_length = this.state.tmp["et-al-use-first"];
            discretionary_names_length = this.etal_use_first;
        }
        // XXXX: This is a workaround. Under some conditions.
        // Where namesets disambiguate on one of the two names
        // dropped here, it is possible for more than one
        // in-text citation to be close (and indistinguishable)
        // matches to a single bibliography entry.
        //
        // 
        if (this.etal_use_last && discretionary_names_length > (this.etal_min - 2)) {
            discretionary_names_length = this.etal_min - 2;
        }
    }
    var sane = this.etal_min >= this.etal_use_first;
    var overlength = count[key] > discretionary_names_length;
    // This var is used to control contextual join, and
    // lies about the number of names when forceEtAl is true,
    // unless normalized.
    if (discretionary_names_length > count[key]) {

        // Use actual truncated list length, to avoid overrun.
        discretionary_names_length = display_names.length;
    }
    // forceEtAl is relevant when the author list is
    // truncated to eliminate clutter.
    if (sane && overlength) {
        if (this.etal_use_last) {
            lst[key] = display_names.slice(0, discretionary_names_length).concat(display_names.slice(-1));
        } else {
            lst[key] = display_names.slice(0, discretionary_names_length);
        }
    }
    this.state.tmp.disambig_settings.names[pos] = lst[key].length;
    this.state.disambiguate.padBase(this.state.tmp.disambig_settings);
    

    // ???
    //if (!this.state.tmp.disambig_request) {
    //    this.state.tmp.disambig_settings.givens[pos] = [];
    //}
};

// Disambiguate names (the number of names is controlled externally, by successive
// runs of the processor).

/*global CSL: true */

CSL.NameOutput.prototype.disambigNames = function () {
    var pos;
    for (var i = 0, ilen = this.variables.length; i < ilen; i += 1) {
        var v = this.variables[i];
        pos = this.nameset_base + i;
        if (this.freeters[v].length) {
            this._runDisambigNames(this.freeters[v], pos);
        }
        // Is this even necessary???
        if (this.institutions[v].length) {
            if ("undefined" === typeof this.state.tmp.disambig_settings.givens[pos]) {
                this.state.tmp.disambig_settings.givens[pos] = [];
            }
            for (var j=0,jlen=this.institutions[v].length;j<jlen;j+=1) {
                if ("undefined" === typeof this.state.tmp.disambig_settings.givens[pos][j]) {
                    this.state.tmp.disambig_settings.givens[pos].push(2);
                }
            }
        }
        for (var j = 0, jlen = this.persons[v].length; j < jlen; j += 1) {
            if (this.persons[v][j].length) {
                this._runDisambigNames(this.persons[v][j], pos);
            }
        }
    }
};

CSL.NameOutput.prototype._runDisambigNames = function (lst, pos) {
    var chk, myform, myinitials, param, i, ilen, paramx;
    //if (this.state.tmp.root === "bibliography") {
    //    return;
    //}
    for (i = 0, ilen = lst.length; i < ilen; i += 1) {
        //
        // register the name in the global names disambiguation
        // registry

        if (!lst[i].given && !lst[i].family) {
            continue;
        }

        myinitials = this.state.inheritOpt(this.name, "initialize-with");
        this.state.registry.namereg.addname("" + this.Item.id, lst[i], i);
        chk = this.state.tmp.disambig_settings.givens[pos];
        if ("undefined" === typeof chk) {
            // Holes can appear in the list, probably due to institutional
            // names that this doesn't touch. Maybe. This fills them up.
            for (var j = 0, jlen = pos + 1; j < jlen; j += 1) {
                if (!this.state.tmp.disambig_settings.givens[j]) {
                    this.state.tmp.disambig_settings.givens[j] = [];
                }
            }
        }
        chk = this.state.tmp.disambig_settings.givens[pos][i];
        //if ("undefined" !== typeof chk && this.state.tmp.root === 'citation') {
            //this.state.tmp.disambig_settings.givens[pos] = [];
            //chk = undefined;
        //}
        if ("undefined" === typeof chk) {
            myform = this.state.inheritOpt(this.name, "form", "name-form", "long");
            param = this.state.registry.namereg.evalname("" + this.Item.id, lst[i], i, 0, myform, myinitials);
            this.state.tmp.disambig_settings.givens[pos].push(param);
        }
        //
        // set the display mode default for givennames if required
        myform = this.state.inheritOpt(this.name, "form", "name-form", "long");
        paramx = this.state.registry.namereg.evalname("" + this.Item.id, lst[i], i, 0, myform, myinitials);
        // this.state.registry.namereg.evalname("" + this.Item.id, lst[i], i, 0, myform, myinitials);
        if (this.state.tmp.disambig_request) {
            //
            // fix a request for initials that makes no sense.
            // can't do this in disambig, because the availability
            // of initials is not a global parameter.
            var val = this.state.tmp.disambig_settings.givens[pos][i];
            // This is limited to by-cite disambiguation.
            // 2012-09-13: added lst[i].given check to condition
            if (val === 1 && 
                this.state.citation.opt["givenname-disambiguation-rule"] === "by-cite" && 
                ("undefined" === typeof this.state.inheritOpt(this.name, "initialize-with")
                 || "undefined" === typeof lst[i].given)) {
                val = 2;
            }
            param = val;
            // 2012-09-13: lst[i].given check protects against personal names
            // that have no first name element. These were causing an infinite loop,
            // this prevents that.
            if (this.state.opt["disambiguate-add-givenname"] && lst[i].given) {
                param = this.state.registry.namereg.evalname("" + this.Item.id, lst[i], i, param, this.state.inheritOpt(this.name, "form", "name-form", "long"), this.state.inheritOpt(this.name, "initialize-with"));
            }
        } else {
            //
            // it clicks.  here is where we will put the
            // call to the names register, to get the floor value
            // for an individual name.
            //
            param = paramx;
        }
        // Need to save off the settings based on subsequent
        // form, when first cites are rendered.
        if (!this.state.tmp.just_looking && this.item && this.item.position === CSL.POSITION_FIRST) {
            if (paramx > param) {
                param = paramx;
            }
        }
        if (!this.state.tmp.sort_key_flag) {
            this.state.tmp.disambig_settings.givens[pos][i] = param;
            if ("string" === typeof myinitials
                && ("undefined" === typeof this.name.strings["initialize"]
                    || true === this.name.strings["initialize"])) {

                this.state.tmp.disambig_settings.use_initials = true;
            }
        }
    }
    //this.state.registry.registry[this.Item.id].disambig.givens = this.state.tmp.disambig_settings.givens.slice();
};

/*global CSL: true */

CSL.NameOutput.prototype.getEtAlConfig = function () {
    var item = this.item;
    this["et-al"] = {};

    this.state.output.append(this.etal_term, this.etal_style, true);
    this["et-al"].single = this.state.output.pop();
    this["et-al"].single.strings.suffix = this.etal_suffix;
    this["et-al"].single.strings.prefix = this.etal_prefix_single;
    
    this.state.output.append(this.etal_term, this.etal_style, true);
    this["et-al"].multiple = this.state.output.pop();
    this["et-al"].multiple.strings.suffix = this.etal_suffix;
    this["et-al"].multiple.strings.prefix = this.etal_prefix_multiple;

    // Et-al style parameters (may be sidestepped by disambiguation
    // in util_names_constraints.js)
    if ("undefined" === typeof item) {
        item = {};
    }
    //print("== getEtAlConfig() == "+this.state.tmp.area);

    if (item.position) {
        if (this.state.inheritOpt(this.name, "et-al-subsequent-min")) {
            // XX
            this.etal_min = this.state.inheritOpt(this.name, "et-al-subsequent-min");
        } else {
            // XX
            this.etal_min = this.state.inheritOpt(this.name, "et-al-min");
        }
        if (this.state.inheritOpt(this.name, "et-al-subsequent-use-first")) {
            // XX
            this.etal_use_first = this.state.inheritOpt(this.name, "et-al-subsequent-use-first");
        } else {
            // XX
            this.etal_use_first = this.state.inheritOpt(this.name, "et-al-use-first");
        }
    } else {
        if (this.state.tmp["et-al-min"]) {
            this.etal_min = this.state.tmp["et-al-min"];
        } else {
            // XX
            this.etal_min = this.state.inheritOpt(this.name, "et-al-min");
        }
        if (this.state.tmp["et-al-use-first"]) {
            this.etal_use_first = this.state.tmp["et-al-use-first"];
        } else {
            // XX
            this.etal_use_first = this.state.inheritOpt(this.name, "et-al-use-first");
        }
        if ("boolean" === typeof this.state.tmp["et-al-use-last"]) {
            //print("  etal_use_last from tmp: "+this.state.tmp["et-al-use-last"]);
            this.etal_use_last = this.state.tmp["et-al-use-last"];
        } else {
            //print("  etal_use_last from name: "+this.name.strings["et-al-use-last"]);
            // XX
            this.etal_use_last = this.state.inheritOpt(this.name, "et-al-use-last");
        }
        //print("  etal_use_last: "+this.etal_use_last);
    }
    // Provided for use as the starting level for disambiguation.
    if (!this.state.tmp["et-al-min"]) {
        this.state.tmp["et-al-min"] = this.etal_min;
    }
};

/*global CSL: true */

CSL.NameOutput.prototype.setEtAlParameters = function () {
    var i, ilen, j, jlen;
    for (i = 0, ilen = this.variables.length; i < ilen; i += 1) {
        var v = this.variables[i];
        if ("undefined" === typeof this.etal_spec[v]) {
            this.etal_spec[v] = {freeters:0,institutions:0,persons:[]};
        }
        this.etal_spec[this.nameset_base + i] = this.etal_spec[v];
        if (this.freeters[v].length) {
            this._setEtAlParameter("freeters", v);
        }
        for (j = 0, jlen = this.persons[v].length; j < jlen; j += 1) {
            if ("undefined" === typeof this.etal_spec[v][j]) {
                this.etal_spec[v].persons[j] = 0;
            }
            this._setEtAlParameter("persons", v, j);
        }
        if (this.institutions[v].length) {
            this._setEtAlParameter("institutions", v);
        }
    }
};

CSL.NameOutput.prototype._setEtAlParameter = function (type, v, j) {
    var lst, count;
    if (type === "persons") {
        lst = this.persons[v][j];
        count = this.persons_count[v][j];
    } else {
        lst = this[type][v];
        count = this[type + "_count"][v];
    }
    if (lst.length < count && !this.state.tmp.sort_key_flag) {
        if (this.etal_use_last) {
            if (type === "persons") {
                this.etal_spec[v].persons[j] = 2;
            } else {
                this.etal_spec[v][type] = 2;
            }
        } else {
            if (type === "persons") {
                this.etal_spec[v].persons[j] = 1;
            } else {
                this.etal_spec[v][type] = 1;
            }
        }
    } else {
        if (type === "persons") {
            this.etal_spec[v].persons[j] = 0;
        } else {
            this.etal_spec[v][type] = 0;
        }
    }
};

/*global CSL: true */

CSL.NameOutput.prototype.renderAllNames = function () {
    // Note that et-al/ellipsis parameters are set on the basis
    // of rendering order through the whole cite.
    var pos;
    for (var i = 0, ilen = this.variables.length; i < ilen; i += 1) {
        var v = this.variables[i];

        if (this.freeters[v].length || this.institutions[v].length) {
            if (!this.state.tmp.group_context.tip.condition) {
                this.state.tmp.just_did_number = false;
            }
        }
        
        pos = this.nameset_base + i;
        if (this.freeters[v].length) {
            this.freeters[v] = this._renderNames(v, this.freeters[v], pos);
        }
        for (var j = 0, jlen = this.institutions[v].length; j < jlen; j += 1) {
            this.persons[v][j] = this._renderNames(v, this.persons[v][j], pos, j);
        }
    }
    this.renderInstitutionNames();
};

CSL.NameOutput.prototype.renderInstitutionNames = function () {
    // Institutions are split to string list as
    // this.institutions[v]["long"] and this.institutions[v]["short"]
    for (var i = 0, ilen = this.variables.length; i < ilen; i += 1) {
        var v = this.variables[i];
        for (var j = 0, jlen = this.institutions[v].length; j < jlen; j += 1) {
            var institution;

            var name = this.institutions[v][j];

            

            // XXX Start here for institutions
            // Figure out the three segments: primary, secondary, tertiary
            var j, jlen, localesets;
            if (this.state.tmp.extension) {
                localesets = ["sort"];
            } else if (name.isInstitution || name.literal) {
                // Will never hit this in this function, but preserving
                // in case we factor this out.
                localesets = this.state.opt['cite-lang-prefs'].institutions;
            } else {
                localesets = this.state.opt['cite-lang-prefs'].persons;
            }

            var slot = {primary:'locale-orig',secondary:false,tertiary:false};
	        if (localesets) {
		        var slotnames = ["primary", "secondary", "tertiary"];
		        for (var k = 0, klen = slotnames.length; k < klen; k += 1) {
			        if (localesets.length - 1 <  k) {
				        break;
			        }
                    if (localesets[k]) {
			            slot[slotnames[k]] = 'locale-' + localesets[k];
                    }
		        }
	        } else {
		        slot.primary = 'locale-translat';
	        }
	        if (this.state.tmp.area !== "bibliography"
		        && !(this.state.tmp.area === "citation"
			         && this.state.opt.xclass === "note"
			         && this.item && !this.item.position)) {
                
		        slot.secondary = false;
		        slot.tertiary = false;
	        }
            // Get normalized name object for a start.
            // true invokes fallback
            this.setRenderedName(name);

            // XXXX FROM HERE (instututions)
            var institution = this._renderInstitutionName(v, name, slot, j);
            //this.institutions[v][j] = this._join(institution, "");
            this.institutions[v][j] = institution;
        }
    }
};

CSL.NameOutput.prototype._renderInstitutionName = function (v, name, slot, j) {
    var secondary, tertiary, long_style, short_style, institution, institution_short, institution_long;
    var res = this.getName(name, slot.primary, true);
    var primary = res.name;
    var usedOrig = res.usedOrig;
    if (primary) {
        //print("primary, v, j = "+primary+", "+v+", "+j);
        primary = this.fixupInstitution(primary, v, j);
    }
	secondary = false;
	if (slot.secondary) {
        res = this.getName(name, slot.secondary, false, usedOrig);
        var secondary = res.name;
        usedOrig = res.usedOrig;
        if (secondary) {
			secondary = this.fixupInstitution(secondary, v, j);
        }
	}
    //Zotero.debug("XXX [2] secondary: "+secondary["long"].literal+", slot.secondary: "+slot.secondary);
	tertiary = false;
	if (slot.tertiary) {
        res = this.getName(name, slot.tertiary, false, usedOrig);
        tertiary = res.name;
        if (tertiary) {
			tertiary = this.fixupInstitution(tertiary, v, j);
        }
	}
    var n = {
        l: {
            pri: false,
            sec: false,
            ter: false
        },
        s: {
            pri: false,
            sec: false,
            ter: false
        }
    };
    if (primary) {
        n.l.pri = primary["long"];
        n.s.pri = primary["short"].length ? primary["short"] : primary["long"];
    }
    if (secondary) {
        n.l.sec = secondary["long"];
        n.s.sec = secondary["short"].length ? secondary["short"] : secondary["long"];
    }
    if (tertiary) {
        n.l.ter = tertiary["long"];
        n.s.ter = tertiary["short"].length ? tertiary["short"] : tertiary["long"];
    }
    switch (this.institution.strings["institution-parts"]) {
    case "short":
        // No multilingual for pure short form institution names.
        if (primary["short"].length) {
            short_style = this._getShortStyle();
            institution = [this._composeOneInstitutionPart([n.s.pri, n.s.sec, n.s.ter], slot, short_style, v)];
        } else {
            // Fail over to long.
            long_style = this._getLongStyle(primary, v, j);
            institution = [this._composeOneInstitutionPart([n.l.pri, n.l.sec, n.l.ter], slot, long_style, v)];
        }
        break;
    case "short-long":
        long_style = this._getLongStyle(primary, v, j);
        short_style = this._getShortStyle();
        institution_short = this._renderOneInstitutionPart(primary["short"], short_style);
        // true is to include multilingual supplement
        institution_long = this._composeOneInstitutionPart([n.l.pri, n.l.sec, n.l.ter], slot, long_style, v);
        institution = [institution_short, institution_long];
        break;
    case "long-short":
        long_style = this._getLongStyle(primary, v, j);
        short_style = this._getShortStyle();
        institution_short = this._renderOneInstitutionPart(primary["short"], short_style);
        // true is to include multilingual supplement
        institution_long = this._composeOneInstitutionPart([n.l.pri, n.l.sec, n.l.ter], slot, long_style, v);
        institution = [institution_long, institution_short];
        break;
    default:
        long_style = this._getLongStyle(primary, v, j);
        // true is to include multilingual supplement
        institution = [this._composeOneInstitutionPart([n.l.pri, n.l.sec, n.l.ter], slot, long_style, v)];
        break;
    }
    var blob = this._join(institution, " ");
    this.state.tmp.name_node.children.push(blob);
    return blob;
};

CSL.NameOutput.prototype._composeOneInstitutionPart = function (names, slot, style) {
    var primary = false, secondary = false, tertiary = false, primary_tok, secondary_tok, tertiary_tok;
    if (names[0]) {
        primary_tok = CSL.Util.cloneToken(style);
        if (this.state.opt.citeAffixes[slot.primary]){
            if ("<i>" === this.state.opt.citeAffixes.institutions[slot.primary].prefix) {
                var hasItalic = false;
                for (var i = 0, ilen = primary_tok.decorations.length; i < ilen; i += 1) {
                    if (style.decorations[i][0] === "@font-style"
                        && primary_tok.decorations[i][1] === "italic") {
                        hasItalic = true;
                    }
                }
                if (!hasItalic) {
                    primary_tok.decorations.push(["@font-style", "italic"]);
                }
            }
        }
        primary = this._renderOneInstitutionPart(names[0], primary_tok);
     }
    if (names[1]) {
        secondary = this._renderOneInstitutionPart(names[1], style);
    }
    if (names[2]) {
        tertiary = this._renderOneInstitutionPart(names[2], style);
    }
    // Compose
    var institutionblob;
    if (secondary || tertiary) {
        this.state.output.openLevel("empty");

        this.state.output.append(primary);

        secondary_tok = CSL.Util.cloneToken(style);
        if (slot.secondary) {
            secondary_tok.strings.prefix = this.state.opt.citeAffixes.institutions[slot.secondary].prefix;
            secondary_tok.strings.suffix = this.state.opt.citeAffixes.institutions[slot.secondary].suffix;
            // Add a space if empty
            if (!secondary_tok.strings.prefix) {
                secondary_tok.strings.prefix = " ";
            }
        }
        var secondary_outer = new CSL.Token();
        secondary_outer.decorations.push(["@font-style", "normal"]);
        secondary_outer.decorations.push(["@font-weight", "normal"]);
        this.state.output.openLevel(secondary_outer);
        this.state.output.append(secondary, secondary_tok);
        this.state.output.closeLevel();

        tertiary_tok = CSL.Util.cloneToken(style);
        if (slot.tertiary) {
            tertiary_tok.strings.prefix = this.state.opt.citeAffixes.institutions[slot.tertiary].prefix;
            tertiary_tok.strings.suffix = this.state.opt.citeAffixes.institutions[slot.tertiary].suffix;
            // Add a space if empty
            if (!tertiary_tok.strings.prefix) {
                tertiary_tok.strings.prefix = " ";
            }
        }
        var tertiary_outer = new CSL.Token();
        tertiary_outer.decorations.push(["@font-style", "normal"]);
        tertiary_outer.decorations.push(["@font-weight", "normal"]);
        this.state.output.openLevel(tertiary_outer);
        this.state.output.append(tertiary, tertiary_tok);
        this.state.output.closeLevel();

        this.state.output.closeLevel();

        institutionblob = this.state.output.pop();
    } else {
        institutionblob = primary;
    }
    return institutionblob;
};

CSL.NameOutput.prototype._renderOneInstitutionPart = function (blobs, style) {
    for (var i = 0, ilen = blobs.length; i < ilen; i += 1) {
        if (blobs[i]) {
            var str = blobs[i];
            // XXXXX Cut-and-paste code in multiple locations. This code block should be
            // collected in a function.
            // Tag: strip-periods-block
            if (this.state.tmp.strip_periods) {
                str = str.replace(/\./g, "");
            } else {
                for (var j = 0, jlen = style.decorations.length; j < jlen; j += 1) {
                    if ("@strip-periods" === style.decorations[j][0] && "true" === style.decorations[j][1]) {
                        str = str.replace(/\./g, "");
                        break;
                    }
                }
            }
            //this.state.output.append(blobs[i], style, true);
            this.state.tmp.group_context.tip.variable_success = true;
            this.state.tmp.can_substitute.replace(false, CSL.LITERAL);
            if (str === "!here>>>") {
                blobs[i] = false;
            } else {
                this.state.output.append(str, style, true);
                blobs[i] = this.state.output.pop();
            }
        }
    }
    if ("undefined" === typeof this.institution.strings["part-separator"]) {
        this.institution.strings["part-separator"] = this.state.tmp.name_delimiter;
    }
    return this._join(blobs, this.institution.strings["part-separator"]);
};

CSL.NameOutput.prototype._renderNames = function (v, values, pos, j) {
    //
    var ret = false;
    if (values.length) {
        var names = [];
        for (var i = 0, ilen = values.length; i < ilen; i += 1) {
            var name = values[i];
            
            // XXX We'll start here with attempts.
            // Figure out the three segments: primary, secondary, tertiary
            var ret, localesets;
            
            if (this.state.tmp.extension) {
                localesets = ["sort"];
            } else if (name.isInstitution || name.literal) {
                // Will never hit this in this function, but preserving
                // in case we factor this out.
                localesets = this.state.opt['cite-lang-prefs'].institutions;
            } else {
                localesets = this.state.opt['cite-lang-prefs'].persons;
            }
            var slot = {primary:'locale-orig',secondary:false,tertiary:false};
	        if (localesets) {
		        var slotnames = ["primary", "secondary", "tertiary"];
		        for (var k = 0, klen = slotnames.length; k < klen; k += 1) {
			        if (localesets.length - 1 <  k) {
				        break;
			        }
			        slot[slotnames[k]] = 'locale-' + localesets[k];
		        }
	        } else {
		        slot.primary = 'locale-translat';
	        }
	        if (this.state.tmp.sort_key_flag || (this.state.tmp.area !== "bibliography"
		        && !(this.state.tmp.area === "citation"
			         && this.state.opt.xclass === "note"
			         && this.item && !this.item.position))) {
                
		        slot.secondary = false;
		        slot.tertiary = false;
	        }

            // primary
            // true is for fallback
            this.setRenderedName(name);

            if (!name.literal && !name.isInstitution) {
                var nameBlob = this._renderPersonalName(v, name, slot, pos, i, j);
                var nameToken = CSL.Util.cloneToken(this.name);
                this.state.output.append(nameBlob, nameToken, true);
                names.push(this.state.output.pop());
            } else {
                names.push(this._renderInstitutionName(v, name, slot, j));
            }
        }
        //ret = this._join(names, "");
        ret = this.joinPersons(names, pos, j);
    }
    return ret;
};


CSL.NameOutput.prototype._renderPersonalName = function (v, name, slot, pos, i, j) {
    // XXXX FROM HERE (persons)

    var res = this.getName(name, slot.primary, true);
    var primary = this._renderOnePersonalName(res.name, pos, i, j);
	var secondary = false;
	if (slot.secondary) {
        res = this.getName(name, slot.secondary, false, res.usedOrig);
        if (res.name) {
			secondary = this._renderOnePersonalName(res.name, pos, i, j);
        }
	}
	var tertiary = false;
	if (slot.tertiary) {
        res = this.getName(name, slot.tertiary, false, res.usedOrig);
        if (res.name) {
			tertiary = this._renderOnePersonalName(res.name, pos, i, j);
        }
	}
    // Now compose them to a unit
    var personblob;
    if (secondary || tertiary) {

        this.state.output.openLevel("empty");

        this.state.output.append(primary);

        var secondary_tok = new CSL.Token();
        if (slot.secondary) {
            secondary_tok.strings.prefix = this.state.opt.citeAffixes.persons[slot.secondary].prefix;
            secondary_tok.strings.suffix = this.state.opt.citeAffixes.persons[slot.secondary].suffix;
            // Add a space if empty
            if (!secondary_tok.strings.prefix) {
                secondary_tok.strings.prefix = " ";
            }
        }
        this.state.output.append(secondary, secondary_tok);

        var tertiary_tok = new CSL.Token();
        if (slot.tertiary) {
            tertiary_tok.strings.prefix = this.state.opt.citeAffixes.persons[slot.tertiary].prefix;
            tertiary_tok.strings.suffix = this.state.opt.citeAffixes.persons[slot.tertiary].suffix;
            // Add a space if empty
            if (!tertiary_tok.strings.prefix) {
                tertiary_tok.strings.prefix = " ";
            }
        }
        this.state.output.append(tertiary, tertiary_tok);

        this.state.output.closeLevel();

        personblob = this.state.output.pop();
    } else {
        personblob = primary;
    }
    return personblob;
};

CSL.NameOutput.prototype._isRomanesque = function (name) {
    // 0 = entirely non-romanesque
    // 1 = mixed content
    // 2 = pure romanesque
    var ret = 2;
    if (!name.family.replace(/\"/g, '').match(CSL.ROMANESQUE_REGEXP)) {
        ret = 0;
    }
    if (!ret && name.given && name.given.match(CSL.STARTSWITH_ROMANESQUE_REGEXP)) {
        ret = 1;
    }
    var top_locale;
    if (ret == 2) {
        if (name.multi && name.multi.main) {
            top_locale = name.multi.main.slice(0, 2);
        } else if (this.Item.language) {
            top_locale = this.Item.language.slice(0, 2);
        }
        if (["ja", "zh"].indexOf(top_locale) > -1) {
            ret = 1;
        }
    }
    //print("name: "+name.given+", multi: "+name.multi+", ret: "+ret);
    return ret;
};

CSL.NameOutput.prototype._renderOnePersonalName = function (value, pos, i, j) {
    var name = value;
    var dropping_particle = this._droppingParticle(name, pos, j);
    var family = this._familyName(name);
    var non_dropping_particle = this._nonDroppingParticle(name);
    var given = this._givenName(name, pos, i);
    var suffix = this._nameSuffix(name);
    if (given === false) {
        dropping_particle = false;
        suffix = false;
    }
    var sort_sep = this.state.inheritOpt(this.name, "sort-separator");
    if (!sort_sep) {
        sort_sep = "";
    }
    var suffix_sep;
    if (name["comma-suffix"]) {
        suffix_sep = ", ";
    } else {
        suffix_sep = " ";
    }
    var romanesque = this._isRomanesque(name);
    function hasJoiningPunctuation(blob) {
        if (!blob) {
            return false;
        } else if ("string" === typeof blob.blobs) {
            if (["\u2019", "\'", "-", " "].indexOf(blob.blobs.slice(-1)) > -1) {
                return true;
            } else {
                return false;
            }
        } else {
            return hasJoiningPunctuation(blob.blobs[blob.blobs.length-1]);
        }
    }
    var has_hyphenated_non_dropping_particle = hasJoiningPunctuation(non_dropping_particle);

    var blob, merged, first, second;
    if (romanesque === 0) {
        // XXX handle affixes for given and family
        blob = this._join([non_dropping_particle, family, given], "");
    } else if (romanesque === 1 || name["static-ordering"]) { // entry likes sort order
        blob = this._join([non_dropping_particle, family, given], " ");
    } else if (name["reverse-ordering"]) { // entry likes reverse order
        blob = this._join([given, non_dropping_particle, family], " ");
    } else if (this.state.tmp.sort_key_flag) {
        // ok with no affixes here
        if (this.state.opt["demote-non-dropping-particle"] === "never") {
            first = this._join([non_dropping_particle, family, dropping_particle], " ");
            merged = this._join([first, given], this.state.opt.sort_sep);
            blob = this._join([merged, suffix], " ");
        } else {
            second = this._join([given, dropping_particle, non_dropping_particle], " ");
            merged = this._join([family, second], this.state.opt.sort_sep);
            blob = this._join([merged, suffix], " ");
        }
    } else if (this.state.inheritOpt(this.name, "name-as-sort-order") === "all" || (this.state.inheritOpt(this.name, "name-as-sort-order") === "first" && i === 0 && (j === 0 || "undefined" === typeof j))) {
        //
        // Discretionary sort ordering and inversions
        //
        if (["Lord", "Lady"].indexOf(name.given) > -1) {
            sort_sep = ", ";
        }

        // XXX Needs a more robust solution than this
        // XXX See https://forums.zotero.org/discussion/30974/any-idea-why-an-a-author-comes-last-in-the-bibliography/#Item_30

        //if (["always", "display-and-sort"].indexOf(this.state.opt["demote-non-dropping-particle"]) > -1 && !has_hyphenated_non_dropping_particle) {
        if (["always", "display-and-sort"].indexOf(this.state.opt["demote-non-dropping-particle"]) > -1) {
            // Drop non-dropping particle
            //second = this._join([given, dropping_particle, non_dropping_particle], " ");
            second = this._join([given, dropping_particle], (name["comma-dropping-particle"] + " "));
        
            // This would be a problem with al-Ghazali. Avoided by has_hyphenated_non_dropping_particle check above.
            second = this._join([second, non_dropping_particle], " ");
            if (second && this.given) {
                second.strings.prefix = this.given.strings.prefix;
                second.strings.suffix = this.given.strings.suffix;
            }
            if (family && this.family) {
                family.strings.prefix = this.family.strings.prefix;
                family.strings.suffix = this.family.strings.suffix;
            }
            merged = this._join([family, second], sort_sep);
            blob = this._join([merged, suffix], sort_sep);
        } else {
            // Don't drop particle.
            // Don't do this
            //if (this.state.tmp.area === "bibliography" && !this.state.tmp.term_predecessor && non_dropping_particle) {
            //    if (!has_hyphenated_non_dropping_particle) {
            //        non_dropping_particle.blobs = CSL.Output.Formatters["capitalize-first"](this.state, non_dropping_particle.blobs)
            //    }
            //}
            if (has_hyphenated_non_dropping_particle) {
                first = this._join([non_dropping_particle, family], "");
            } else {
                first = this._join([non_dropping_particle, family], " ");
            }
            if (first && this.family) {
                first.strings.prefix = this.family.strings.prefix;
                first.strings.suffix = this.family.strings.suffix;
            }

            second = this._join([given, dropping_particle], (name["comma-dropping-particle"] + " "));
            //second = this._join([given, dropping_particle], " ");
            if (second && this.given) {
                second.strings.prefix = this.given.strings.prefix;
                second.strings.suffix = this.given.strings.suffix;
            }

            merged = this._join([first, second], sort_sep);
            blob = this._join([merged, suffix], sort_sep);
        }
    } else { // plain vanilla
        if (name["dropping-particle"] && name.family && !name["non-dropping-particle"]) {
            var dp = name["dropping-particle"];
            var apostrophes = ["'","\u02bc","\u2019","-"];
            if (apostrophes.indexOf(dp.slice(-1)) > -1 && dp.slice(0, -1) !== "de") {
                family = this._join([dropping_particle, family], "");
                dropping_particle = false;
            }
        }

        var space = " ";
        if (this.state.inheritOpt(this.name, "initialize-with")
            && this.state.inheritOpt(this.name, "initialize-with").match(/[\u00a0\ufeff]/)
            && ["fr", "ru", "cs"].indexOf(this.state.opt["default-locale"][0].slice(0, 2)) > -1) {
            space = "\u00a0";
        }

        if (has_hyphenated_non_dropping_particle) {
            second = this._join([non_dropping_particle, family], "");
            second = this._join([dropping_particle, second], space);
        } else {
            second = this._join([dropping_particle, non_dropping_particle, family], space);
        }
        second = this._join([second, suffix], suffix_sep);
        if (second && this.family) {
            second.strings.prefix = this.family.strings.prefix;
            second.strings.suffix = this.family.strings.suffix;
        }
        if (given && this.given) {
            given.strings.prefix = this.given.strings.prefix;
            given.strings.suffix = this.given.strings.suffix;
        }
        if (second.strings.prefix) {
            name["comma-dropping-particle"] = "";
        }
        blob = this._join([given, second], (name["comma-dropping-particle"] + space));
    }
    // XXX Just generally assume for the present that personal names render something
    this.state.tmp.group_context.tip.variable_success = true;
    this.state.tmp.can_substitute.replace(false, CSL.LITERAL);
    this.state.tmp.term_predecessor = true;
    // notSerious
    //this.state.output.append(blob, "literal", true);
    //var ret = this.state.output.pop();
    this.state.tmp.name_node.children.push(blob);
    return blob;
};

/*
        // Do not include given name, dropping particle or suffix in strict short form of name

        // initialize if appropriate
*/

// Input names should be touched by _normalizeNameInput()
// exactly once: this is not idempotent.
CSL.NameOutput.prototype._normalizeNameInput = function (value) {
    var name = {
        literal:value.literal,
        family:value.family,
        isInstitution:value.isInstitution,
        given:value.given,
        suffix:value.suffix,
        "comma-suffix":value["comma-suffix"],
        "non-dropping-particle":value["non-dropping-particle"],
        "dropping-particle":value["dropping-particle"],
        "static-ordering":value["static-ordering"],
        "static-particles":value["static-particles"],
        "reverse-ordering":value["reverse-ordering"],
        "full-form-always": value["full-form-always"],
        "parse-names":value["parse-names"],
        "comma-dropping-particle": "",
        block_initialize:value.block_initialize,
        multi:value.multi
    };
    this._parseName(name);
    return name;
};

// _transformNameset() replaced with enhanced transform.name().

CSL.NameOutput.prototype._stripPeriods = function (tokname, str) {
    var decor_tok = this[tokname + "_decor"];
    if (str) {
        if (this.state.tmp.strip_periods) {
            str = str.replace(/\./g, "");
        } else  if (decor_tok) {
            for (var i = 0, ilen = decor_tok.decorations.length; i < ilen; i += 1) {
                if ("@strip-periods" === decor_tok.decorations[i][0] && "true" === decor_tok.decorations[i][1]) {
                    str = str.replace(/\./g, "");
                    break;
                }
            }
        }
    }
    return str;
};

CSL.NameOutput.prototype._nonDroppingParticle = function (name) {
    var ndp = name["non-dropping-particle"];
    if (ndp && this.state.tmp.sort_key_flag) {
        ndp = ndp.replace(/[\'\u2019]/, "");
    }
    var str = this._stripPeriods("family", ndp);
    if (this.state.output.append(str, this.family_decor, true)) {
        return this.state.output.pop();
    }
    return false;
};

CSL.NameOutput.prototype._droppingParticle = function (name, pos, j) {
    var dp = name["dropping-particle"];
    if (dp && this.state.tmp.sort_key_flag) {
        dp = dp.replace(/[\'\u2019]/, "");
    }
    var str = this._stripPeriods("given", dp);
    if (name["dropping-particle"] && name["dropping-particle"].match(/^et.?al[^a-z]$/)) {
        if (this.state.inheritOpt(this.name, "et-al-use-last")) {
            if ("undefined" === typeof j) { 
                this.etal_spec[pos].freeters = 2;
            } else {
                this.etal_spec[pos].persons = 2;
            }
        } else {
            if ("undefined" === typeof j) { 
                this.etal_spec[pos].freeters = 1;
            } else {
                this.etal_spec[pos].persons = 1;
            }
        }
        name["comma-dropping-particle"] = "";
    } else if (this.state.output.append(str, this.given_decor, true)) {
        return this.state.output.pop();
    }
    return false;
};

CSL.NameOutput.prototype._familyName = function (name) {
    var str = this._stripPeriods("family", name.family);
    if (this.state.output.append(str, this.family_decor, true)) {
        return this.state.output.pop();
    }
    return false;
};

CSL.NameOutput.prototype._givenName = function (name, pos, i) {
    var ret;
    // citation
    //   use disambig as-is
    // biblography
    //   use disambig only if it boosts over the default
    //   SO WHAT IS THE DEFAULT?
    //   A: If "form" is short, it's 0.
    //      If "form" is long, initialize-with exists (and initialize is not false) it's 1
    //      If "form" is long, and initialize_with does not exist, it's 2.
    var formIsShort = this.state.inheritOpt(this.name, "form", "name-form", "long") !== "long";
    var initializeIsTurnedOn = this.state.inheritOpt(this.name, "initialize") !== false;
    var hasInitializeWith = "string" === typeof this.state.inheritOpt(this.name, "initialize-with") && !name.block_initialize;
    var defaultLevel;
    var useLevel;
    if (name["full-form-always"]) {
        useLevel = 2;
    } else {
        if (formIsShort) {
            defaultLevel = 0;
        } else if (hasInitializeWith) {
            defaultLevel = 1;
        } else {
            defaultLevel = 2;
        }
        var requestedLevel = this.state.tmp.disambig_settings.givens[pos][i];
        if (requestedLevel > defaultLevel) {
            useLevel = requestedLevel;
        } else {
            useLevel = defaultLevel;
        }
    }
    var gdropt = this.state.citation.opt["givenname-disambiguation-rule"];
   if (gdropt && gdropt.slice(-14) === "-with-initials") {
        hasInitializeWith = true;
    }
    if (name.family && useLevel === 1) {
        if (hasInitializeWith) {
            var initialize_with = this.state.inheritOpt(this.name, "initialize-with", false, "");
            name.given = CSL.Util.Names.initializeWith(this.state, name.given, initialize_with, !initializeIsTurnedOn);
        } else {
            name.given = CSL.Util.Names.unInitialize(this.state, name.given);
        }
    } else if (useLevel === 0) {
        return false;
    } else if (useLevel === 2) {
        name.given = CSL.Util.Names.unInitialize(this.state, name.given);
    }

    var str = this._stripPeriods("given", name.given);
    var rendered = this.state.output.append(str, this.given_decor, true);
    if (rendered) {
        ret = this.state.output.pop();
	    return ret;
    }
    return false;
};

CSL.NameOutput.prototype._nameSuffix = function (name) {

    var str = name.suffix, ret;

    if ("string" === typeof this.state.inheritOpt(this.name, "initialize-with")) {
        str = CSL.Util.Names.initializeWith(this.state, name.suffix, this.state.inheritOpt(this.name, "initialize-with"), true);
    }

    str = this._stripPeriods("family", str);
    var toSuffix = '';
    if (str && str.slice(-1) === '.') {
	str = str.slice(0, -1);
	toSuffix = '.';
    }
    var rendered = this.state.output.append(str, "empty", true);
    if (rendered) {
        ret = this.state.output.pop();
	ret.strings.suffix = toSuffix + ret.strings.suffix;
	return ret;
    }
    return false;
};

CSL.NameOutput.prototype._getLongStyle = function (name) {
    var long_style;
    if (name["short"].length) {
        if (this.institutionpart["long-with-short"]) {
            long_style = this.institutionpart["long-with-short"];
        } else {
            long_style = this.institutionpart["long"];
        }
    } else {
        long_style = this.institutionpart["long"];
    }
    if (!long_style) {
        long_style = new CSL.Token();
    }
    return long_style;
};

CSL.NameOutput.prototype._getShortStyle = function () {
    var short_style;
    if (this.institutionpart["short"]) {
        short_style = this.institutionpart["short"];
    } else {
        short_style = new CSL.Token();
    }
    return short_style;
};

CSL.NameOutput.prototype._parseName = function (name) {
    if (!name["parse-names"] && "undefined" !== typeof name["parse-names"]) {
        return name;
    }
    if (name.family && !name.given && name.isInstitution) {
        name.literal = name.family;
        name.family = undefined;
        name.isInstitution = undefined;
    }
    var noparse;
    if (name.family 
        && (name.family.slice(0, 1) === '"' && name.family.slice(-1) === '"')
        || (!name["parse-names"] && "undefined" !== typeof name["parse-names"])) {

        name.family = name.family.slice(1, -1);
        noparse = true;
        name["parse-names"] = 0;
    } else {
        noparse = false;
    }
    if (this.state.opt.development_extensions.parse_names) {
        if (!name["non-dropping-particle"] && name.family && !noparse && name.given) {
            if (!name["static-particles"]) {
                CSL.parseParticles(name, true);
            }
        }
    }
};

/*
 * Return a single name object
  */

// The interface is a mess, but this should serve.

CSL.NameOutput.prototype.getName = function (name, slotLocaleset, fallback, stopOrig) {

    // Needs to tell us whether we used orig or not.
    
    if (stopOrig && slotLocaleset === 'locale-orig') {
        return {name:false,usedOrig:stopOrig};
    }

    // Normalize to string
    if (!name.family) {
        name.family = "";
    }
    if (!name.given) {
        name.given = "";
    }

    // Recognized params are:
    //  block-initialize
    //  transliterated
    //  static-ordering
    //  full-form-always
    // All default to false, except for static-ordering, which is initialized
    // with a sniff.
    var name_params = {};
    // Determines the default static-order setting based on the characters
    // used in the headline field. Will be overridden by locale-based
    // parameters evaluated against explicit lang tags set on the (sub)field.
    name_params["static-ordering"] = this.getStaticOrder(name);

    var foundTag = true;
    var langTag;
    if (slotLocaleset !== 'locale-orig') {
        foundTag = false;
        if (name.multi) {
            var langTags = this.state.opt[slotLocaleset];
            for (var i = 0, ilen = langTags.length; i < ilen; i += 1) {
                langTag = langTags[i];
                if (name.multi._key[langTag]) {
                    foundTag = true;
                    var isInstitution = name.isInstitution;
                    name = name.multi._key[langTag];
                    name.isInstitution = isInstitution;
                    // Set name formatting params
                    name_params = this.getNameParams(langTag);
                    name_params.transliterated = true;
                    break;
                }
            }
        }
    }

    if (!foundTag) {
        langTag = false;
        if (name.multi && name.multi.main) {
            langTag = name.multi.main;
        } else if (this.Item.language) {
            langTag = this.Item.language;
        }
        if (langTag) {
            name_params = this.getNameParams(langTag);
        }
    }

    if (!fallback && !foundTag) {
        return {name:false,usedOrig:stopOrig};
    }
    
    // Normalize to string (again)
    if (!name.family) {
        name.family = "";
    }
    if (!name.given) {
        name.given = "";
    }
    if (name.literal) {
        delete name.family;
        delete name.given;
    }
    // var clone the item before writing into it
    name = {
        family:name.family,
        given:name.given,
        "non-dropping-particle":name["non-dropping-particle"],
        "dropping-particle":name["dropping-particle"],
        suffix:name.suffix,
        "static-ordering":name_params["static-ordering"],
        "static-particles":name["static-particles"],
        "reverse-ordering":name_params["reverse-ordering"],
        "full-form-always": name_params["full-form-always"],
        "parse-names":name["parse-names"],
        "comma-suffix":name["comma-suffix"],
        "comma-dropping-particle":name["comma-dropping-particle"],
        transliterated: name_params.transliterated,
        block_initialize: name_params["block-initialize"],
        literal:name.literal,
        isInstitution:name.isInstitution,
        multi:name.multi
    };
    
    if (!name.literal && (!name.given && name.family && name.isInstitution)) {
        name.literal = name.family;
    }
    if (name.literal) {
        delete name.family;
        delete name.given;
    }
    name = this._normalizeNameInput(name);
    var usedOrig;
    if (stopOrig) {
        usedOrig = stopOrig;
    } else {
        usedOrig = !foundTag;
    }
    return {name:name,usedOrig:usedOrig};
};

CSL.NameOutput.prototype.getNameParams = function (langTag) {
    var ret = {};
    var langspec = CSL.localeResolve(this.Item.language, this.state.opt["default-locale"][0]);
    var try_locale = this.state.locale[langspec.best] ? langspec.best : this.state.opt["default-locale"][0];
    var name_as_sort_order = this.state.locale[try_locale].opts["name-as-sort-order"];
    var name_as_reverse_order = this.state.locale[try_locale].opts["name-as-reverse-order"];
    var name_never_short = this.state.locale[try_locale].opts["name-never-short"];
    var field_lang_bare = langTag.split("-")[0];
    if (name_as_sort_order && name_as_sort_order[field_lang_bare]) {
        ret["static-ordering"] = true;
        ret["reverse-ordering"] = false;
    }
    if (name_as_reverse_order && name_as_reverse_order[field_lang_bare]) {
        ret["reverse-ordering"] = true;
        ret["static-ordering"] = false;
    }
    if (name_never_short && name_never_short[field_lang_bare]) {
        ret["full-form-always"] = true;
    }
    
    if (ret["static-ordering"]) {
        ret["block-initialize"] = true;
    }
    return ret;
};

CSL.NameOutput.prototype.setRenderedName = function (name) {
    if (this.state.tmp.area === "bibliography") {
        var strname = "";
        for (var j=0,jlen=CSL.NAME_PARTS.length;j<jlen;j+=1) {
            if (name[CSL.NAME_PARTS[j]]) {
                strname += name[CSL.NAME_PARTS[j]];
            }
        }
        this.state.tmp.rendered_name.push(strname);
    }
};

CSL.NameOutput.prototype.fixupInstitution = function (name, varname, listpos) {
    name = this._splitInstitution(name, varname, listpos);
    // XXX This should be embedded in the institution name function.
    if (this.institution.strings["reverse-order"]) {
        name["long"].reverse();
    }
        
    var long_form = name["long"];
    var short_form = name["long"].slice();
    var use_short_form = false;
    if (this.state.sys.getAbbreviation) {
        var jurisdiction = this.Item.jurisdiction;
        for (var j = 0, jlen = long_form.length; j < jlen; j += 1) {
            var abbrevKey = long_form[j];
            jurisdiction = this.state.transform.loadAbbreviation(jurisdiction, "institution-part", abbrevKey);
            if (this.state.transform.abbrevs[jurisdiction]["institution-part"][abbrevKey]) {
                short_form[j] = this.state.transform.abbrevs[jurisdiction]["institution-part"][abbrevKey];
                use_short_form = true;
            }
        }
    }
    if (use_short_form) {
        name["short"] = short_form;
    } else {
        name["short"] = [];
    }
    return name;
};


CSL.NameOutput.prototype.getStaticOrder = function (name, refresh) {
    var static_ordering_val = false;
    if (!refresh && name["static-ordering"]) {
        static_ordering_val = true;
    } else if (this._isRomanesque(name) === 0) {
        static_ordering_val = true;
    } else if ((!name.multi || !name.multi.main) && this.Item.language && ['vi', 'hu'].indexOf(this.Item.language) > -1) {
        static_ordering_val = true;
    } else if (name.multi && name.multi.main && ['vi', 'hu'].indexOf(name.multi.main.slice(0,2)) > -1) {
        static_ordering_val = true;
    } else {
        if (this.state.opt['auto-vietnamese-names']
            && (CSL.VIETNAMESE_NAMES.exec(name.family + " " + name.given)
                && CSL.VIETNAMESE_SPECIALS.exec(name.family + name.given))) {
            
            static_ordering_val = true;
        }
    }
    return static_ordering_val;
};


CSL.NameOutput.prototype._splitInstitution = function (value, v, i) {
    var ret = {};
    // Due to a bug in Juris-M, there are a small number of items in my accounts that have
    // a institution parent, and a personal child. The bug that created them was fixed before
    // release, but this hack keeps them from crashing the processor.
    if (!value.literal && value.family) {
        value.literal = value.family;
        delete value.family;
    }
    var splitInstitution = value.literal.replace(/\s*\|\s*/g, "|");
    // check for total and utter abbreviation IFF form="short"
    splitInstitution = splitInstitution.split("|");
    if (this.institution.strings.form === "short" && this.state.sys.getAbbreviation) {
        // On a match, drop unused elements to yield a single key.
        var jurisdiction = this.Item.jurisdiction;
        for (var j = splitInstitution.length; j > 0; j += -1) {
            var str = splitInstitution.slice(0, j).join("|");
            var abbrevKey = str;
            jurisdiction = this.state.transform.loadAbbreviation(jurisdiction, "institution-entire", abbrevKey);
            if (this.state.transform.abbrevs[jurisdiction]["institution-entire"][abbrevKey]) {
                var splitLst = this.state.transform.abbrevs[jurisdiction]["institution-entire"][abbrevKey];

                splitLst = this.state.transform.quashCheck(splitLst);

                // If the abbreviation has date cut-offs, find the most recent
                // abbreviation within scope.
                var splitSplitLst = splitLst.split(/>>[0-9]{4}>>/);
                var m = splitLst.match(/>>([0-9]{4})>>/);
                splitLst = splitSplitLst.pop();
                if (splitSplitLst.length > 0 && this.Item["original-date"] && this.Item["original-date"].year) {
                    for (var k=m.length - 1; k > 0; k += -1) {
                        if (parseInt(this.Item["original-date"].year, 10) >= parseInt(m[k], 10)) {
                            break;
                        }
                        splitLst = splitSplitLst.pop();
                    }
                }
                splitLst = splitLst.replace(/\s*\|\s*/g, "|");
                splitInstitution = [splitLst];
                break;
            }
        }
    }
    splitInstitution.reverse();
    //print("into _trimInstitution with splitInstitution, v, i = "+splitInstitution+", "+v+", "+i);
    ret["long"] = this._trimInstitution(splitInstitution, v, i);
    return ret;
};

CSL.NameOutput.prototype._trimInstitution = function (subunits, v) {
	// 
    var use_first = false;
    var append_last = false;
    var s = subunits.slice();
    var stop_last = false;
    if (this.institution) {
        if ("undefined" !== typeof this.institution.strings["use-first"]) {
            use_first = this.institution.strings["use-first"];
        }
        if ("undefined" !== typeof this.institution.strings["stop-last"]) {
            // stop-last is negative when present
            stop_last = this.institution.strings["stop-last"];
        } else if ("authority" === v && this.state.tmp.authority_stop_last) {
            stop_last = this.state.tmp.authority_stop_last;
        }
        if (stop_last) {
            s = s.slice(0, stop_last);
            subunits = subunits.slice(0, stop_last);
        }
        if ("undefined" !== typeof this.institution.strings["use-last"]) {
            append_last = this.institution.strings["use-last"];
        }
        if ("authority" === v) {
            if (stop_last) {
                this.state.tmp.authority_stop_last = stop_last;
            }
            if (append_last)  {
                this.state.tmp.authority_stop_last += (append_last * -1);
            }
        }
    }
    if (false === use_first) {
        if (this.persons[v].length === 0) {
            use_first = this.institution.strings["substitute-use-first"];
        }
        if (!use_first) {
            use_first = 0;
        }
    }
    if (false === append_last) {
        if (!use_first) {
            append_last = subunits.length;
        } else {
            append_last = 0;
        }
    }
    // Now that we've determined the value of append_last
    // (use-last), avoid overlaps.
    if (use_first > subunits.length - append_last) {
        use_first = subunits.length - append_last;
    }

    // This could be more clear. use-last takes priority
    // in the event of overlap, because of adjustment above
    subunits = subunits.slice(0, use_first);
    s = s.slice(use_first);
    if (append_last) {
        if (append_last > s.length) {
            append_last = s.length;
        }
        if (append_last) {
            subunits = subunits.concat(s.slice((s.length - append_last)));
        }
    }
    return subunits;
};

/*global CSL: true */

CSL.PublisherOutput = function (state, group_tok) {
    this.state = state;
    this.group_tok = group_tok;
    this.varlist = [];
};

CSL.PublisherOutput.prototype.render = function () {
    this.clearVars();
    this.composeAndBlob();
    this.composeElements();
    this.composePublishers();
    this.joinPublishers();
};


// XXX Figure out how to adapt this to the House of Lords / House of Commons
// joint committee case

// name_delimiter
// delimiter_precedes_last
// and

CSL.PublisherOutput.prototype.composeAndBlob = function () {
    this.and_blob = {};
    var and_term = false;
    if (this.group_tok.strings.and === "text") {
        and_term = this.state.getTerm("and");
    } else if (this.group_tok.strings.and === "symbol") {
        and_term = "&";
    }
    var tok = new CSL.Token();
    tok.strings.suffix = " ";
    tok.strings.prefix = " ";
    this.state.output.append(and_term, tok, true);
    var no_delim = this.state.output.pop();

    tok.strings.prefix = this.group_tok.strings["subgroup-delimiter"];
    this.state.output.append(and_term, tok, true);
    var with_delim = this.state.output.pop();
    
    this.and_blob.single = false;
    this.and_blob.multiple = false;
    if (and_term) {
        if (this.group_tok.strings["subgroup-delimiter-precedes-last"] === "always") {
            this.and_blob.single = with_delim;
        } else if (this.group_tok.strings["subgroup-delimiter-precedes-last"] === "never") {
            this.and_blob.single = no_delim;
            this.and_blob.multiple = no_delim;
        } else {
            this.and_blob.single = no_delim;
            this.and_blob.multiple = with_delim;
        }
    }
};


CSL.PublisherOutput.prototype.composeElements = function () {
    for (var i = 0, ilen = 2; i < ilen; i += 1) {
        var varname = ["publisher", "publisher-place"][i];
        for (var j = 0, jlen = this["publisher-list"].length; j < jlen; j += 1) {
            var str = this[varname + "-list"][j];
            var tok = this[varname + "-token"];
            // notSerious
            this.state.output.append(str, tok, true);
            this[varname + "-list"][j] = this.state.output.pop();
        }
    }
};


CSL.PublisherOutput.prototype.composePublishers = function () {
    var blobs;
    for (var i = 0, ilen = this["publisher-list"].length; i < ilen; i += 1) {
        blobs = [this[this.varlist[0] + "-list"][i], this[this.varlist[1] + "-list"][i]];
        this["publisher-list"][i] = this._join(blobs, this.group_tok.strings.delimiter);
    }
};


CSL.PublisherOutput.prototype.joinPublishers = function () {
    var blobs = this["publisher-list"];
    var publishers = this._join(blobs, this.group_tok.strings["subgroup-delimiter"], this.and_blob.single, this.and_blob.multiple, this.group_tok);
    this.state.output.append(publishers, "literal");
};


// blobs, delimiter, single, multiple, tokenname
// Tokenname is a key at top level of this object.
CSL.PublisherOutput.prototype._join = CSL.NameOutput.prototype._join;
CSL.PublisherOutput.prototype._getToken = CSL.NameOutput.prototype._getToken;


CSL.PublisherOutput.prototype.clearVars = function () {
    this.state.tmp["publisher-list"] = false;
    this.state.tmp["publisher-place-list"] = false;
    this.state.tmp["publisher-group-token"] = false;
    this.state.tmp["publisher-token"] = false;
    this.state.tmp["publisher-place-token"] = false;
};

/*global CSL: true */

CSL.evaluateLabel = function (node, state, Item, item) {
    var myterm;
    if ("locator" === node.strings.term) {
        if (item && item.label) {
            if (item.label === "sub verbo") {
                myterm = "sub-verbo";
            } else {
                myterm = item.label;
            }
        }
        if (!myterm) {
            myterm = "page";
        }
    } else {
        myterm = node.strings.term;
    }
    
    // Plurals detection.
    var plural = node.strings.plural;
    if ("number" !== typeof plural) {
        // (node, ItemObject, variable, type)
        var theItem = (item && node.strings.term === "locator") ? item : Item;
        if (theItem[node.strings.term]) {
            state.processNumber(false, theItem, node.strings.term, Item.type);
            plural = state.tmp.shadow_numbers[node.strings.term].plural;
            if (!state.tmp.shadow_numbers[node.strings.term].labelForm
                && !state.tmp.shadow_numbers[node.strings.term].labelDecorations) {
                state.tmp.shadow_numbers[node.strings.term].labelForm = node.strings.form;
                state.tmp.shadow_numbers[node.strings.term].labelCapitalizeIfFirst = node.strings.capitalize_if_first;
                state.tmp.shadow_numbers[node.strings.term].labelDecorations = node.decorations.slice();
            }
            
            if (["locator", "number", "page"].indexOf(node.strings.term) > -1 && state.tmp.shadow_numbers[node.strings.term].label) {
                myterm = state.tmp.shadow_numbers[node.strings.term].label;
            }
            if (node.decorations && state.opt.development_extensions.csl_reverse_lookup_support) {
                node.decorations.reverse();
                node.decorations.push(["@showid","true", node.cslid]);
                node.decorations.reverse();
            }
        }
    }
    return CSL.castLabel(state, node, myterm, plural, CSL.TOLERANT);
};

CSL.castLabel = function (state, node, term, plural, mode) {
    var label_form = node.strings.form;
    var label_capitalize_if_first = node.strings.capitalize_if_first;
    if (state.tmp.group_context.tip.label_form && label_form !== "static") {
        label_form = state.tmp.group_context.tip.label_form;
    }
    if (state.tmp.group_context.tip.label_capitalize_if_first) {
        label_capitalize_if_first = state.tmp.group_context.tip.label_capitalize_if_first;
    }
    var ret = state.getTerm(term, label_form, plural, false, mode, node.default_locale);
    if (label_capitalize_if_first) {
        ret = CSL.Output.Formatters["capitalize-first"](state, ret);
    }
    // XXXXX Cut-and-paste code in multiple locations. This code block should be
    // collected in a function.
    // Tag: strip-periods-block
    if (state.tmp.strip_periods) {
        ret = ret.replace(/\./g, "");
    } else {
        for (var i = 0, ilen = node.decorations.length; i < ilen; i += 1) {
            if ("@strip-periods" === node.decorations[i][0] && "true" === node.decorations[i][1]) {
                ret = ret.replace(/\./g, "");
                break;
            }
        }
    }
    return ret;
};

/*global CSL: true */

CSL.Node.name = {
    build: function (state, target) {
        var func;
        if ([CSL.SINGLETON, CSL.START].indexOf(this.tokentype) > -1) {
            var oldTmpRoot;
            if ("undefined" === typeof state.tmp.root) {
                oldTmpRoot = undefined;
                state.tmp.root = "citation";
            } else {
                oldTmpRoot = state.tmp.root;
            }
            // Many CSL styles set et-al-[min|use-first]
            // and et-al-subsequent-[min|use-first] to the same
            // value.
            // Set state.opt.update_mode = CSL.POSITION if
            // et-al-subsequent-min or et-al-subsequent-use-first
            // are set AND their value differs from their plain
            // counterparts.
            if (state.inheritOpt(this, "et-al-subsequent-min")
                && (state.inheritOpt(this, "et-al-subsequent-min") !== state.inheritOpt(this, "et-al-min"))) {
                
                state.opt.update_mode = CSL.POSITION;
            }
            if (state.inheritOpt(this, "et-al-subsequent-use-first")
                && (state.inheritOpt(this, "et-al-subsequent-use-first") !== state.inheritOpt(this, "et-al-use-first"))) {
                
                state.opt.update_mode = CSL.POSITION;
            }

            state.tmp.root = oldTmpRoot;

            func = function (state) {
                // Et-al (onward processing in node_etal.js and node_names.js)
                // XXXXX Why is this necessary? This is available on this.name, right?
                state.tmp.etal_term = "et-al";

                // Use default delimiter as fallback, in a way that allows explicit
                // empty strings.
                state.tmp.name_delimiter = state.inheritOpt(this, "delimiter", "name-delimiter", ", ");
                state.tmp["delimiter-precedes-et-al"] = state.inheritOpt(this, "delimiter-precedes-et-al");
                
                // And
                if ("text" === state.inheritOpt(this, "and")) {
                    this.and_term = state.getTerm("and", "long", 0);
                } else if ("symbol" === state.inheritOpt(this, "and")) {
                    if (state.opt.development_extensions.expect_and_symbol_form) {
                        this.and_term = state.getTerm("and", "symbol", 0);
                    } else {
                        this.and_term = "&";
                    }
                }
                state.tmp.and_term = this.and_term;
                if (CSL.STARTSWITH_ROMANESQUE_REGEXP.test(this.and_term)) {
                    this.and_prefix_single = " ";
                    this.and_prefix_multiple = ", ";
                    // Workaround to allow explicit empty string
                    // on cs:name delimiter.
                    if ("string" === typeof state.tmp.name_delimiter) {
                        this.and_prefix_multiple = state.tmp.name_delimiter;
                    }
                    this.and_suffix = " ";

                    // Really can't inspect these values in the build phase. Sorry.
                    //state.build.name_delimiter = this.strings.delimiter;

                } else {
                    this.and_prefix_single = "";
                    this.and_prefix_multiple = "";
                    this.and_suffix = "";
                }
                if (state.inheritOpt(this, "delimiter-precedes-last") === "always") {
                    this.and_prefix_single = state.tmp.name_delimiter;
                } else if (state.inheritOpt(this, "delimiter-precedes-last") === "never") {
                    // Slightly fragile: could test for charset here to make
                    // this more certain.
                    if (this.and_prefix_multiple) {
                        this.and_prefix_multiple = " ";
                    }
                } else if (state.inheritOpt(this, "delimiter-precedes-last") === "after-inverted-name") {
                    if (this.and_prefix_single) {
                        this.and_prefix_single = state.tmp.name_delimiter;
                    }
                    if (this.and_prefix_multiple) {
                        this.and_prefix_multiple = " ";
                    }
                }

                this.and = {};
                if (state.inheritOpt(this, "and")) {
                    state.output.append(this.and_term, "empty", true);
                    this.and.single = state.output.pop();
                    this.and.single.strings.prefix = this.and_prefix_single;
                    this.and.single.strings.suffix = this.and_suffix;
                    state.output.append(this.and_term, "empty", true);
                    this.and.multiple = state.output.pop();
                    this.and.multiple.strings.prefix = this.and_prefix_multiple;
                    this.and.multiple.strings.suffix = this.and_suffix;
                } else if (state.tmp.name_delimiter) {
                    // This is a little weird, but it works.
                    this.and.single = new CSL.Blob(state.tmp.name_delimiter);
                    this.and.single.strings.prefix = "";
                    this.and.single.strings.suffix = "";
                    this.and.multiple = new CSL.Blob(state.tmp.name_delimiter);
                    this.and.multiple.strings.prefix = "";
                    this.and.multiple.strings.suffix = "";
                }

                this.ellipsis = {};
                if (state.inheritOpt(this, "et-al-use-last")) {
                    // We use the dedicated Unicode ellipsis character because
                    // it is recommended by some editors, and can be more easily
                    // identified for find and replace operations.
                    // Source: http://en.wikipedia.org/wiki/Ellipsis#Computer_representations
                    //
                    
                    // Eventually, this should be localized as a term in CSL, with some
                    // mechanism for triggering appropriate punctuation handling around
                    // the ellipsis placeholder (Polish is a particularly tough case for that).
                    this.ellipsis_term = "\u2026";
                    // Similar treatment to "and", above, will be needed
                    // here when this becomes a locale term.
                    this.ellipsis_prefix_single = " ";
                    this.ellipsis_prefix_multiple =  state.inheritOpt(this, "delimiter", "name-delimiter", ", ");
                    this.ellipsis_suffix = " ";
                    this.ellipsis.single = new CSL.Blob(this.ellipsis_term);
                    this.ellipsis.single.strings.prefix = this.ellipsis_prefix_single;
                    this.ellipsis.single.strings.suffix = this.ellipsis_suffix;
                    this.ellipsis.multiple = new CSL.Blob(this.ellipsis_term);
                    this.ellipsis.multiple.strings.prefix = this.ellipsis_prefix_multiple;
                    this.ellipsis.multiple.strings.suffix = this.ellipsis_suffix;
                }

                // et-al parameters are annoyingly incomprehensible
                // again.
                //
                // Explanation probably just adds a further layer of
                // irritation, but what's INTENDED here is that
                // the state.tmp et-al variables are set from the
                // cs:key element when composing sort keys, and a
                // macro containing a name can be called from cs:key.
                // So when cs:key sets et-al attributes, they are
                // set on state.tmp, and when the key is finished
                // processing, the state.tmp variables are reset to
                // undefined. IN THEORY the state.tmp et-al variables
                // will not be used in other contexts. I hope.
                //
                // Anyway, the current tests now seem to pass.
                if ("undefined" === typeof state.tmp["et-al-min"]) {
                    state.tmp["et-al-min"] = state.inheritOpt(this, "et-al-min");
                }
                if ("undefined" === typeof state.tmp["et-al-use-first"]) {
                    state.tmp["et-al-use-first"] = state.inheritOpt(this, "et-al-use-first");
                }
                if ("undefined" === typeof state.tmp["et-al-use-last"]) {
                    //print("  setting et-al-use-last from name: "+this.strings["et-al-use-last"]);
                    state.tmp["et-al-use-last"] = state.inheritOpt(this, "et-al-use-last");
                }

                state.nameOutput.name = this;
            };
            
            state.build.name_flag = true;

            this.execs.push(func);
        }
        target.push(this);
    }
};



/*global CSL: true */

CSL.Node["name-part"] = {
    build: function (state) {
        state.build[this.strings.name] = this;
    }
};

/*global CSL: true */

CSL.Node.names = {
    build: function (state, target) {
        var func;
        // CSL.debug = print;

        if (this.tokentype === CSL.START || this.tokentype === CSL.SINGLETON) {
            CSL.Util.substituteStart.call(this, state, target);
            state.build.substitute_level.push(1);
        }
        
        if (this.tokentype === CSL.SINGLETON) {
            state.build.names_variables[state.build.names_variables.length-1].concat(this.variables);
            for (var i in this.variables) {
                var variable = this.variables[i];
                var name_labels = state.build.name_label[state.build.name_label.length-1];
                if (Object.keys(name_labels).length) {
                    name_labels[variable] = name_labels[Object.keys(name_labels)[0]];
                }
            }
            func = function (state) {
                state.nameOutput.reinit(this, this.variables_real[0]);
            };
            this.execs.push(func);
        }

        if (this.tokentype === CSL.START) {

            state.build.names_flag = true;
            state.build.name_flag = false;
            state.build.names_level += 1;
            state.build.names_variables.push(this.variables);
            state.build.name_label.push({});
            // init can substitute
            // init names
            func = function (state) {
                state.tmp.can_substitute.push(true);
                state.nameOutput.init(this);
            };
            this.execs.push(func);

        }
        
        if (this.tokentype === CSL.END) {

            // Set/reset name blobs if they exist, for processing
            // by namesOutput()
            for (var i = 0, ilen = 3; i < ilen; i += 1) {
                var key = ["family", "given", "et-al"][i];
                this[key] = state.build[key];
                if (state.build.names_level === 1) {
                    state.build[key] = undefined;
                }
            }
            // Labels, if any
            this.label = state.build.name_label[state.build.name_label.length-1];
            state.build.names_level += -1;
            state.build.names_variables.pop();
            state.build.name_label.pop();

            // The with term. This isn't the right place
            // for this, but it's all hard-wired at the
            // moment.

            // "and" and "ellipsis" are set in node_name.js
            func = function (state) {
                // Et-al (strings only)
                // Blob production has to happen inside nameOutput()
                // since proper escaping requires access to the output
                // queue.
                if (state.tmp.etal_node) {
                    this.etal_style = state.tmp.etal_node;
                } else {
                    this.etal_style = "empty";
                }

                this.etal_term = state.getTerm(state.tmp.etal_term, "long", 0);
                this.etal_prefix_single = " ";
                // Should be name delimiter, not hard-wired.
                this.etal_prefix_multiple = state.tmp.name_delimiter;
                if (state.tmp["delimiter-precedes-et-al"] === "always") {
                    this.etal_prefix_single = state.tmp.name_delimiter;
                } else if (state.tmp["delimiter-precedes-et-al"] === "never") {
                    this.etal_prefix_multiple = " ";
                } else if (state.tmp["delimiter-precedes-et-al"] === "after-inverted-name") {
                    this.etal_prefix_single = state.tmp.name_delimiter;
                    this.etal_prefix_multiple = " ";
                }
                this.etal_suffix = "";
                if (!CSL.STARTSWITH_ROMANESQUE_REGEXP.test(this.etal_term)) {
                    // Not sure what the correct treatment is here, but we should not suppress
                    // a comma-space.
                    // https://forums.zotero.org/discussion/76679/delimiter-precedes-et-al-always-dose-not-work-in-locale-zh-cn
                    if (this.etal_prefix_single === " ") {
                        this.etal_prefix_single = "";
                    }
                    if (this.etal_prefix_multiple === " ") {
                        this.etal_prefix_multiple = "";
                    }
                    if (this.etal_suffix === " ") {
                        this.etal_suffix = "";
                    }
                }
                // et-al affixes are further adjusted in nameOutput(),
                // after the term (possibly changed in cs:et-al) is known.


                for (var i = 0, ilen = 3; i < ilen; i += 1) {
                    var key = ["family", "given"][i];
                    state.nameOutput[key] = this[key];
                }
                state.nameOutput["with"] = this["with"];

                // REMOVE THIS
                var mywith = "with";
                var with_default_prefix = "";
                var with_suffix = "";
                if (CSL.STARTSWITH_ROMANESQUE_REGEXP.test(mywith)) {
                    with_default_prefix = " ";
                    with_suffix = " ";
                }
                var thewith = {};
                thewith.single = new CSL.Blob(mywith);
                thewith.single.strings.suffix = with_suffix;
                thewith.multiple = new CSL.Blob(mywith);
                thewith.multiple.strings.suffix = with_suffix;
                if (state.inheritOpt(state.nameOutput.name, "delimiter-precedes-last") === "always") {
                    thewith.single.strings.prefix = state.inheritOpt(this, "delimiter", "names-delimiter");
                    thewith.multiple.strings.prefix = state.inheritOpt(this, "delimiter", "names-delimiter");
                } else if (state.inheritOpt(state.nameOutput.name, "delimiter-precedes-last") === "contextual") {
                    thewith.single.strings.prefix = with_default_prefix;
                    thewith.multiple.strings.prefix = state.inheritOpt(this, "delimiter", "names-delimiter");
                } else if (state.inheritOpt(state.nameOutput.name, "delimiter-precedes-last") === "after-inverted-name") {
                    thewith.single.strings.prefix = state.inheritOpt(this, "delimiter", "names-delimiter");
                    thewith.multiple.strings.prefix = with_default_prefix;
                } else {
                    thewith.single.strings.prefix = with_default_prefix;
                    thewith.multiple.strings.prefix = with_default_prefix;
                }
                state.nameOutput["with"] = thewith;


                // XXX label style should be set per variable, since they may differ
                // XXX with full-form nested names constructs
                state.nameOutput.label = this.label;

                state.nameOutput.etal_style = this.etal_style;
                state.nameOutput.etal_term = this.etal_term;
                state.nameOutput.etal_prefix_single = this.etal_prefix_single;
                state.nameOutput.etal_prefix_multiple = this.etal_prefix_multiple;
                state.nameOutput.etal_suffix = this.etal_suffix;
                state.nameOutput.outputNames();
                state.tmp["et-al-use-first"] = undefined;
                state.tmp["et-al-min"] = undefined;
                state.tmp["et-al-use-last"] = undefined;
            };
            this.execs.push(func);

            // unsets
            func = function (state) {
                if (!state.tmp.can_substitute.pop()) {
                    state.tmp.can_substitute.replace(false, CSL.LITERAL);
                }
                
                // For posterity ...
                //
                // This was enough to fix the issue reported here:
                //
                //   http://forums.zotero.org/discussion/25223/citeproc-bug-substitute-doesnt-work-correctly-for-title-macro/
                //
                // The remainder of the changes applied in the same patch
                // relate to a label assignments, which were found to be
                // buggy while working on the issue. The test covering
                // both problems is here:
                //
                //   https://bitbucket.org/bdarcus/citeproc-test/src/ab136a6aa8f2/processor-tests/humans/substitute_SuppressOrdinaryVariable.txt
                if (state.tmp.can_substitute.mystack.length === 1) {
                    state.tmp.can_block_substitute = false;
                }
            };
            this.execs.push(func);

            state.build.name_flag = false;
        }
        target.push(this);

        if (this.tokentype === CSL.END || this.tokentype === CSL.SINGLETON) {
            state.build.substitute_level.pop();
            CSL.Util.substituteEnd.call(this, state, target);
        }
    }
};

/*global CSL: true */

CSL.Node.number = {
    build: function (state, target) {
        var func;
        CSL.Util.substituteStart.call(this, state, target);
        //
        // This should push a rangeable object to the queue.
        //
        if (this.strings.form === "roman") {
            this.formatter = state.fun.romanizer;
        } else if (this.strings.form === "ordinal") {
            this.formatter = state.fun.ordinalizer;
        } else if (this.strings.form === "long-ordinal") {
            this.formatter = state.fun.long_ordinalizer;
        }
        if ("undefined" === typeof this.successor_prefix) {
            this.successor_prefix = state[state.build.area].opt.layout_delimiter;
        }
        if ("undefined" === typeof this.splice_prefix) {
            this.splice_prefix = state[state.build.area].opt.layout_delimiter;
        }
        // is this needed?
        //if ("undefined" === typeof this.splice_prefix){
        //    this.splice_prefix = state[state.tmp.area].opt.layout_delimiter;
        //}
        //
        // Whether we actually stick a number object on
        // the output queue depends on whether the field
        // contains a pure number.
        //
        // push number or text
        func = function (state, Item, item) {
            // NOTE: this works because this is the ONLY function in this node.
            // If further functions are added, they need to start with the same
            // abort condition.
            if (this.variables.length === 0) {
                return;
            }
            var varname;
            varname = this.variables[0];
            if ("undefined" === typeof item) {
                var item = {};
            }
            if (["locator", "locator-extra"].indexOf(varname) > -1) {
                if (state.tmp.just_looking) {
                    return;
                }
                if (!item[varname]) {
                    return;
                }
            } else {
                if (!Item[varname]) {
                    return;
                }
            }

            if (varname === 'collection-number' && Item.type === 'legal_case') {
                state.tmp.renders_collection_number = true;
            }
            
            // For bill or legislation items that have a label-form
            // attribute set on the cs:number node rendering the locator,
            // the form and pluralism of locator terms are controlled
            // separately from those of the initial label. Form is
            // straightforward: the label uses the value set on
            // the cs:label node that renders it, and the embedded
            // labels use the value of label-form set on the cs:number
            // node. Both default to "long".
            //
            // Pluralism is more complicated. For embedded labels,
            // pluralism is evaluated using a simple heuristic that
            // can be found below (it just looks for comma, ampersand etc).
            // The item.label rendered independently via cs:label
            // defaults to singular. It is always singular if embedded
            // labels exist that (when expanded to their valid CSL
            // value) do not match the value of item.label. Otherwise,
            // if one or more matching embedded labels exist, the
            // cs:label is set to plural.
            //
            // The code that does all this is divided between this module,
            // util_static_locator.js, and util_label.js. It's not easy
            // to follow, but seems to do the job. Let's home for good
            // luck out there in the wild.
            
            var node = this;

            if (state.tmp.group_context.tip.force_suppress) {
                return false;
            }

            if (["locator", "locator-extra"].indexOf(varname) > -1) {
                // amazing that we reach this. should abort sooner if no content?
                state.processNumber.call(state, node, item, varname, Item.type);
            } else {
                if (!state.tmp.group_context.tip.condition) {
                    state.tmp.just_did_number = true;
                }
                state.processNumber.call(state, node, Item, varname, Item.type);
            }

            CSL.Util.outputNumericField(state, varname, Item.id);

            if (["locator", "locator-extra"].indexOf(this.variables_real[0]) > -1
               && !state.tmp.just_looking) {
                state.tmp.done_vars.push(this.variables_real[0]);
                state.tmp.group_context.tip.done_vars.push(this.variables_real[0]);
            }
        };
        this.execs.push(func);
        target.push(this);
        
        CSL.Util.substituteEnd.call(this, state, target);
    }
};

/*global CSL: true */

/*
 * Yikes, these functions were running out of scope for yonks.
 * now that they are set in the correct token list,
 * they might be useful for things.
 * FB 2013.11.09
*/

CSL.Node.sort = {
    build: function (state, target) {
        target = state[state.build.root + "_sort"].tokens;
        if (this.tokentype === CSL.START) {
            if (state.build.area === "citation") {
                state.parallel.use_parallels = false;
                state.opt.sort_citations = true;
            }
            state.build.area = state.build.root + "_sort";
            state.build.extension = "_sort";
            
            var func = function (state, Item) {
                //state.tmp.area = state.tmp.root + "_sort";
                //state.tmp.extension = "_sort";
                if (state.opt.has_layout_locale) {
                    var langspec = CSL.localeResolve(Item.language, state.opt["default-locale"][0]);
                    var sort_locales = state[state.tmp.area.slice(0,-5)].opt.sort_locales;
                    var langForItem;
                    for (var i=0,ilen=sort_locales.length;i<ilen;i+=1) {
                        langForItem = sort_locales[i][langspec.bare];
                        if (!langForItem) {
                            langForItem = sort_locales[i][langspec.best];
                        }
                        if (langForItem) {
                            break;
                        }
                    }
                    if (!langForItem) {
                        langForItem = state.opt["default-locale"][0];
                    }
                    state.tmp.lang_sort_hold = state.opt.lang;
                    state.opt.lang = langForItem;
                }
            };
            this.execs.push(func);
            
        }
        if (this.tokentype === CSL.END) {
            state.build.area = state.build.root;
            state.build.extension = "";
            var func = function (state) {
                if (state.opt.has_layout_locale) {
                    state.opt.lang = state.tmp.lang_sort_hold;
                    delete state.tmp.lang_sort_hold;
                }
                //state.tmp.area = state.tmp.root;
                //state.tmp.extension = "";
            };
            this.execs.push(func);
            /*
            var func = function (state, Item) {
                state.tmp.area = state.tmp.root;
                state.tmp.extension = "";
            }
            this.execs.push(func);
            */
        }
        target.push(this);
    }
};



/*global CSL: true */

CSL.Node.substitute = {
    build: function (state, target) {
        var func;
        if (this.tokentype === CSL.START) {
            /* */
            // set conditional
            var choose_start = new CSL.Token("choose", CSL.START);
            CSL.Node.choose.build.call(choose_start, state, target);
            var if_singleton = new CSL.Token("if", CSL.SINGLETON);
            func = function() {
                if (state.tmp.value.length && !state.tmp.common_term_match_fail) {
                    return true;
                }
                return false;
            }
            if_singleton.tests = [func];
            if_singleton.test = state.fun.match.any(if_singleton, state, if_singleton.tests);
            target.push(if_singleton);

            func = function (state) {
                state.tmp.can_block_substitute = true;
                if (state.tmp.value.length && !state.tmp.common_term_match_fail) {
                    state.tmp.can_substitute.replace(false, CSL.LITERAL);
                }
                state.tmp.common_term_match_fail = false;
            };
            this.execs.push(func);
            target.push(this);
            /* */
        }
        if (this.tokentype === CSL.END) {
            //var if_end = new CSL.Token("if", CSL.END);
            //CSL.Node["if"].build.call(if_end, state, target);
            /* */
            target.push(this);
            var choose_end = new CSL.Token("choose", CSL.END);
            CSL.Node.choose.build.call(choose_end, state, target);
            /* */
        }
    }
};



/*global CSL: true */

CSL.Node.text = {
    build: function (state, target) {
        var func, form, plural, id, num, number, formatter, firstoutput, specialdelimiter, label, suffix, term;
        if (this.postponed_macro) {
            var group_start = CSL.Util.cloneToken(this);
            group_start.name = "group";
            group_start.tokentype = CSL.START;
            CSL.Node.group.build.call(group_start, state, target);

            CSL.expandMacro.call(state, this, target);

            var group_end = CSL.Util.cloneToken(this);
            group_end.name = "group";
            group_end.tokentype = CSL.END;
            if (this.postponed_macro === 'juris-locator-label') {
                group_end.isJurisLocatorLabel = true;
            }
            CSL.Node.group.build.call(group_end, state, target);

        } else {
            CSL.Util.substituteStart.call(this, state, target);
            // ...
            //
            // Do non-macro stuff
            
            // Guess again. this.variables is ephemeral, adjusted by an initial
            // function set on the node via @variable attribute setup.
            //variable = this.variables[0];
            
            if (!this.variables_real) {
                this.variables_real = [];
            }
            if (!this.variables) {
                this.variables = [];
            }

            form = "long";
            plural = 0;
            if (this.strings.form) {
                form = this.strings.form;
            }
            if (this.strings.plural) {
                plural = this.strings.plural;
            }
            if ("citation-number" === this.variables_real[0] || "year-suffix" === this.variables_real[0] || "citation-label" === this.variables_real[0]) {
                //
                // citation-number and year-suffix are super special,
                // because they are rangeables, and require a completely
                // different set of formatting parameters on the output
                // queue.
                if (this.variables_real[0] === "citation-number") {

                    if (state.build.root === "citation") {
                        state.opt.update_mode = CSL.NUMERIC;
                    }
                    if (state.build.root === "bibliography") {
                        state.opt.bib_mode = CSL.NUMERIC;
                    }
                    //this.strings.is_rangeable = true;
                    if ("citation-number" === state[state.tmp.area].opt.collapse) {
                        this.range_prefix = state.getTerm("citation-range-delimiter");
                    }
                    this.successor_prefix = state[state.build.area].opt.layout_delimiter;
                    this.splice_prefix = state[state.build.area].opt.layout_delimiter;
                    func = function (state, Item, item) {

                        id = "" + Item.id;
                        if (!state.tmp.just_looking) {
                            if (state.tmp.area.slice(-5) === "_sort" && this.variables[0] === "citation-number") {
                                if (state.tmp.area === "bibliography_sort") {
                                    state.tmp.group_context.tip.done_vars.push("citation-number");
                                }
                                if (state.tmp.area === "citation_sort" && state.bibliography_sort.tmp.citation_number_map) {
                                    var num = state.bibliography_sort.tmp.citation_number_map[state.registry.registry[Item.id].seq];
                                } else {
                                    var num = state.registry.registry[Item.id].seq;
                                }
                                if (num) {
                                    // Code currently in util_number.js
                                    num = CSL.Util.padding("" + num);
                                }
                                state.output.append(num, this);
                                return;
                            }
                            if (item && item["author-only"]) {
                                state.tmp.element_trace.replace("suppress-me");
                            }
                            if (state.tmp.area !== "bibliography_sort" && state.bibliography_sort.tmp.citation_number_map && state.bibliography_sort.opt.citation_number_sort_direction === CSL.DESCENDING) {
                                num = state.bibliography_sort.tmp.citation_number_map[state.registry.registry[id].seq];
                            } else {
                                num = state.registry.registry[id].seq;
                            }
                            if (state.opt.citation_number_slug) {
                                state.output.append(state.opt.citation_number_slug, this);
                            } else {
                                number = new CSL.NumericBlob(false, num, this, Item.id);
                                if (state.tmp.in_cite_predecessor) {
                                    number.suppress_splice_prefix = true;
                                }
                                state.output.append(number, "literal");
                            }
                        }
                    };
                    this.execs.push(func);
                } else if (this.variables_real[0] === "year-suffix") {

                    state.opt.has_year_suffix = true;

                    if (state[state.tmp.area].opt.collapse === "year-suffix-ranged") {
                        //this.range_prefix = "-";
                        this.range_prefix = state.getTerm("citation-range-delimiter");
                    }
                    this.successor_prefix = state[state.build.area].opt.layout_delimiter;
                    if (state[state.tmp.area].opt["year-suffix-delimiter"]) {
                        this.successor_prefix = state[state.build.area].opt["year-suffix-delimiter"];
                    }
                    func = function (state, Item) {
                        if (state.registry.registry[Item.id] && state.registry.registry[Item.id].disambig.year_suffix !== false && !state.tmp.just_looking) {
                            //state.output.append(state.registry.registry[Item.id].disambig[2],this);
                            num = parseInt(state.registry.registry[Item.id].disambig.year_suffix, 10);

                            //if (state[state.tmp.area].opt.collapse === "year-suffix-ranged") {
                            //    //this.range_prefix = "-";
                            //    this.range_prefix = state.getTerm("citation-range-delimiter");
                            //}
                            //this.successor_prefix = state[state.tmp.area].opt.layout_delimiter;
                            if (state[state.tmp.area].opt.cite_group_delimiter) {
                                this.successor_prefix = state[state.tmp.area].opt.cite_group_delimiter;
                            }
                            number = new CSL.NumericBlob(false, num, this, Item.id);
                            formatter = new CSL.Util.Suffixator(CSL.SUFFIX_CHARS);
                            number.setFormatter(formatter);
                            state.output.append(number, "literal");
                            firstoutput = false;
                            // XXX Can we do something better for length here?
                            for (var i=0,ilen=state.tmp.group_context.mystack.length; i<ilen; i++) {
                                var flags = state.tmp.group_context.mystack[i];
                                if (!flags.variable_success && (flags.variable_attempt || (!flags.variable_attempt && !flags.term_intended))) {
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
                } else if (this.variables_real[0] === "citation-label") {
                    if (state.build.root === "bibliography") {
                        state.opt.bib_mode = CSL.TRIGRAPH;
                    }
                    state.opt.has_year_suffix = true;
                    func = function (state, Item) {
                        label = Item["citation-label"];
                        if (!label) {
                            label = state.getCitationLabel(Item);
                        }
                        if (!state.tmp.just_looking) {
                            suffix = "";
                            if (state.registry.registry[Item.id] && state.registry.registry[Item.id].disambig.year_suffix !== false) {
                                num = parseInt(state.registry.registry[Item.id].disambig.year_suffix, 10);
                                suffix = state.fun.suffixator.format(num);
                            }
                            label += suffix;
                        }
                        state.output.append(label, this);
                    };
                    this.execs.push(func);
                }
            } else {
                if (this.strings.term) {
                    
                    // printterm
                    func = function (state, Item) {
                        var gender = state.opt.gender[Item.type];
                        var term = this.strings.term;
                        term = state.getTerm(term, form, plural, gender, CSL.TOLERANT, this.default_locale);
                        var myterm;
                        // if the term is not an empty string, say
                        // that we rendered a term
                        if (term !== "") {
                            state.tmp.group_context.tip.term_intended = true;
                        }
                        CSL.UPDATE_GROUP_CONTEXT_CONDITION(state, term);
                        
                        // capitalize the first letter of a term, if it is the
                        // first thing rendered in a citation (or if it is
                        // being rendered immediately after terminal punctuation,
                        // I guess, actually).
                        if (!state.tmp.term_predecessor && !(state.opt["class"] === "in-text" && state.tmp.area === "citation")) {
                            myterm = CSL.Output.Formatters["capitalize-first"](state, term);
                            //CSL.debug("Capitalize");
                        } else {
                            myterm = term;
                        }
                        
                        // XXXXX Cut-and-paste code in multiple locations. This code block should be
                        // collected in a function.
                        // Tag: strip-periods-block
                        if (state.tmp.strip_periods) {
                            myterm = myterm.replace(/\./g, "");
                        } else {
                            for (var i = 0, ilen = this.decorations.length; i < ilen; i += 1) {
                                if ("@strip-periods" === this.decorations[i][0] && "true" === this.decorations[i][1]) {
                                    myterm = myterm.replace(/\./g, "");
                                    break;
                                }
                            }
                        }
                        state.output.append(myterm, this);
                    };
                    this.execs.push(func);
                    state.build.term = false;
                    state.build.form = false;
                    state.build.plural = false;
                } else if (this.variables_real.length) {
                    func = function (state, Item) {

                        // If some text variable is rendered, we're not collapsing.
                        if (this.variables_real[0] !== "locator") {
                            state.tmp.have_collapsed = false;
                        }

                        if (!state.tmp.group_context.tip.condition && Item[this.variables[0]]) {
                            state.tmp.just_did_number = false;
                        }
                        var val = Item[this.variables[0]];
                        if (val && !state.tmp.group_context.tip.condition) {
                            if (("" + val).slice(-1).match(/[0-9]/)) {
                                state.tmp.just_did_number = true;
                            } else {
                                state.tmp.just_did_number = false;
                            }
                        }
                    };
                    this.execs.push(func);

                    // plain string fields

                    // Deal with multi-fields and ordinary fields separately.
                    if (CSL.MULTI_FIELDS.indexOf(this.variables_real[0]) > -1
                        || ["language-name", "language-name-original"].indexOf(this.variables_real[0]) > -1) {

                        // multi-fields
                        // Initialize transform factory according to whether
                        // abbreviation is desired.
                        var abbrevfam = this.variables[0];
                        var abbrfall = false;
                        var altvar = false;
                        var transfall = false;
                        if (form === "short") {
                            if (this.variables_real[0].slice(-6) !== "-short") {
                                altvar = this.variables_real[0] + "-short";
                            }
                        } else {
                            abbrevfam = false;
                        }
                        if (state.build.extension) {
                            // multi-fields for sorting get a sort transform,
                            // (abbreviated if the short form was selected)
                            transfall = true;
                        } else {
                            transfall = true;
                            abbrfall = true;
						}

                        func = state.transform.getOutputFunction(this.variables, abbrevfam, abbrfall, altvar, transfall);
                    } else {
                        // ordinary fields
                        if (CSL.CITE_FIELDS.indexOf(this.variables_real[0]) > -1) {
                            // per-cite fields are read from item, rather than Item
                            func = function (state, Item, item) {
                                if (item && item[this.variables[0]]) {
                                    // Code copied to page variable as well; both
                                    // become cs:number in MLZ extended schema
                                    
                                    // If locator, use cs:number. Otherwise, render
                                    // normally.

                                    // XXX The code below is pretty-much copied from
                                    // XXX node_number.js. Should be a common function.
                                    // XXX BEGIN
                                    state.processNumber(this, item, this.variables[0], Item.type);
                                    CSL.Util.outputNumericField(state, this.variables[0], Item.id);
                                    // XXX END

                                    if (["locator", "locator-extra"].indexOf(this.variables_real[0]) > -1
                                       && !state.tmp.just_looking) { 
                                        state.tmp.done_vars.push(this.variables_real[0]);
                                    }
                                }
                            };
                        } else  if (["page", "page-first", "chapter-number", "collection-number", "edition", "issue", "number", "number-of-pages", "number-of-volumes", "volume"].indexOf(this.variables_real[0]) > -1) {
                            // page gets mangled with the correct collapsing
                            // algorithm
                            func = function(state, Item) {
                                state.processNumber(this, Item, this.variables[0], Item.type);
                                CSL.Util.outputNumericField(state, this.variables[0], Item.id);
                            };
                        } else if (["URL", "DOI"].indexOf(this.variables_real[0]) > -1) {
                            func = function (state, Item) {
                                var value;
                                if (this.variables[0]) {
                                    value = state.getVariable(Item, this.variables[0], form);
                                    if (value) {
                                        if (this.variables[0] === "URL" && form === "short") {
                                            value = value.replace(/(.*\.[^\/]+)\/.*/, "$1");
                                            if (value.match(/\/\/www\./)) {
                                                value = value.replace(/https?:\/\//, "");
                                            }
                                        }
                                        // true is for non-suppression of periods
                                        if (state.opt.development_extensions.wrap_url_and_doi) {
                                            if (!this.decorations.length || this.decorations[0][0] !== "@" + this.variables[0]) {
                                                // Special-casing to fix https://github.com/Juris-M/citeproc-js/issues/57
                                                // clone current token, to avoid collateral damage
                                                var clonetoken = CSL.Util.cloneToken(this);
                                                // cast a group blob
                                                var groupblob = new CSL.Blob(null, null, "url-wrapper");
                                                // set the DOI decoration on the blob
                                                groupblob.decorations.push(["@DOI", "true"]);
                                                if (this.variables_real[0] === "DOI") {
                                                    // strip a proper DOI prefix
                                                    var prefix;
                                                    if (this.strings.prefix && this.strings.prefix.match(/^.*https:\/\/doi\.org\/$/)) {
                                                        value = value.replace(/^https?:\/\/doi\.org\//, "");
                                                        if (value.match(/^https?:\/\//)) {
                                                            // Do not tamper with another protocol + domain if already set in field value
                                                            prefix = "";
                                                        } else {
                                                            // Otherwise https + domain
                                                            prefix = "https://doi.org/";
                                                        }
                                                        // set any string prefix on the clone
                                                        clonetoken.strings.prefix = this.strings.prefix.slice(0, clonetoken.strings.prefix.length-16);
                                                    }
                                                    // cast a text blob
                                                    // set the prefix as the content of the blob
                                                    var prefixblob = new CSL.Blob(prefix);
                                                    // cast another text blob
                                                    // set the value as the content of the second blob
                                                    var valueblob = new CSL.Blob(value);
                                                    // append new text token and clone to group token
                                                    groupblob.push(prefixblob);
                                                    groupblob.push(valueblob);
                                                    // append group token to output
                                                    state.output.append(groupblob, clonetoken, false, false, true);
                                                } else {
                                                    var valueblob = new CSL.Blob(value);
                                                    // append new text token and clone to group token
                                                    groupblob.push(valueblob);
                                                    // append group token to output
                                                    //this.decorations = [["@" + this.variables[0], "true"]].concat(this.decorations);
                                                    state.output.append(groupblob, clonetoken, false, false, true);
                                                }
                                            } else {
                                                state.output.append(value, this, false, false, true);
                                            }
                                        } else {
                                            // This is totally unnecessary, isn't it?
                                            if (this.decorations.length) {
                                                for (var i=this.decorations.length-1; i>-1; i--) {
                                                    if (this.decorations[i][0] === "@" + this.variables[0]) {
                                                        this.decorations = this.decorations.slice(0, i).concat(this.decorations.slice(i+1));
                                                    }
                                                }
                                            }
                                            state.output.append(value, this, false, false, true);
                                        }
                                    }
                                }
                            };
                        } else if (this.variables_real[0] === "section") {
                            // Sections for statutes are special. This is an uncommon
                            // variable, so we save the cost of the runtime check
                            // unless it's being used.
                            func = function (state, Item) {
                                var value;
                                value = state.getVariable(Item, this.variables[0], form);
                                if (value) {
                                    state.output.append(value, this);
                                }
                            };
                        } else if (this.variables_real[0] === "hereinafter") {
                            func = function (state, Item) {
                                var value = state.transform.abbrevs["default"]["hereinafter"][Item.id];
                                if (value) {
                                    state.output.append(value, this);
                                    state.tmp.group_context.tip.variable_success = true;
                                }
                            };
                        } else {
                            // anything left over just gets output in the normal way.
                            func = function (state, Item) {
                                var value;
                                if (this.variables[0]) {
                                    value = state.getVariable(Item, this.variables[0], form);
                                    if (value) {
                                        value = "" + value;
                                        value = value.split("\\").join("");
                                        state.output.append(value, this);
                                    }
                                }
                            };
                        }
                    }
                    this.execs.push(func);
                } else if (this.strings.value) {
                    // for the text value attribute.
                    func = function (state) {
                        state.tmp.group_context.tip.term_intended = true;
                        // true flags that this is a literal-value term
                        CSL.UPDATE_GROUP_CONTEXT_CONDITION(state, this.strings.value, true);
                        state.output.append(this.strings.value, this);
                    };
                    this.execs.push(func);
                    // otherwise no output
                }
            }
            target.push(this);
            CSL.Util.substituteEnd.call(this, state, target);
        }
    }
};



/*global CSL: true */

CSL.Node.intext = {
    build: function (state, target) {
        if (this.tokentype === CSL.START) {

            state.build.area = "intext";
            state.build.root = "intext";
            state.build.extension = "";

            var func = function(state, Item) {
                state.tmp.area = "intext";
                state.tmp.root = "intext";
                state.tmp.extension = "";
            }
            this.execs.push(func);
        }
        if (this.tokentype === CSL.END) {

            // Do whatever cs:citation does with sorting.
            state.intext_sort = {
                opt: {
                    sort_directions: state.citation_sort.opt.sort_directions
                }
            }
            state.intext.srt = state.citation.srt;
        }
        target.push(this);
    }
};


/*global CSL: true */

CSL.Attributes = {};

CSL.Attributes["@disambiguate"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    if (arg === "true") {
        state.opt.has_disambiguate = true;
        var func = function (Item) {
            if (state.tmp.area === "bibliography") {
                if (state.tmp.disambiguate_count < state.registry.registry[Item.id].disambig.disambiguate) {
                    state.tmp.disambiguate_count += 1;
                    return true;
                }
            } else {
                state.tmp.disambiguate_maxMax += 1;
                if (state.tmp.disambig_settings.disambiguate
                    && state.tmp.disambiguate_count < state.tmp.disambig_settings.disambiguate) {
                    state.tmp.disambiguate_count += 1;
                    return true;
                }
            }
            return false;
        };
        this.tests.push(func);
    } else if (arg === "check-ambiguity-and-backreference") {
        var func = function (Item) {
            if (state.registry.registry[Item.id].disambig.disambiguate && state.registry.registry[Item.id]["citation-count"] > 1) {
                return true;
            }
            return false;
        };
        this.tests.push(func);
    }
};

CSL.Attributes["@is-numeric"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var variables = arg.split(/\s+/);
    var maketest = function(variable) {
        return function (Item, item) {
            var myitem = Item;
            if (item && ["locator","locator-extra"].indexOf(variable) > -1) {
                myitem = item;
            }
            if (!myitem[variable]) {
                return false;
            }
            if (CSL.NUMERIC_VARIABLES.indexOf(variable) > -1) {
                if (!state.tmp.shadow_numbers[variable]) {
                    state.processNumber(false, myitem, variable, Item.type);
                }
                if (state.tmp.shadow_numbers[variable].numeric) {
                    return true;
                }
            } else if (["title", "locator-extra","version"].indexOf(variable) > -1) {
                if (myitem[variable].slice(-1) === "" + parseInt(myitem[variable].slice(-1), 10)) {
                    return true;
                }
            }
            return false;
        };
    };
    for (var i=0; i<variables.length; i+=1) {
        this.tests.push(maketest(variables[i]));
    }
};


CSL.Attributes["@is-uncertain-date"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var variables = arg.split(/\s+/);
    // Strip off any boolean prefix.
    var maketest = function (myvariable) {
        return function(Item) {
            if (Item[myvariable] && Item[myvariable].circa) {
                return true;
            } else {
                return false;
            }
        };
    };
    for (var i=0,ilen=variables.length;i<ilen;i+=1) {
        this.tests.push(maketest(variables[i]));
    }
};


CSL.Attributes["@locator"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var trylabels = arg.replace("sub verbo", "sub-verbo");
    trylabels = trylabels.split(/\s+/);
    // Strip off any boolean prefix.
    var maketest = function (trylabel) {
        return function(Item, item) {
            var label;
            state.processNumber(false, item, "locator");
            label = state.tmp.shadow_numbers.locator.label;
            if (trylabel === label) {
                return true;
            } else {
                return false;
            }
        };
    };
    for (var i=0,ilen=trylabels.length;i<ilen;i+=1) {
        this.tests.push(maketest(trylabels[i]));
    }
};


CSL.Attributes["@position"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var tryposition;
    state.opt.update_mode = CSL.POSITION;
    state.parallel.use_parallels = null;
    var trypositions = arg.split(/\s+/);
    var testSubsequentNear = function (Item, item) {
        if (item && item.position >= CSL.POSITION_SUBSEQUENT && item["near-note"]) {
            return true;
        }
        return false;
    };
    var testSubsequentNotNear = function (Item, item) {
        if (item && item.position == CSL.POSITION_SUBSEQUENT && !item["near-note"]) {
            return true;
        }
        return false;
    };
    var maketest = function(tryposition) {
        return function (Item, item) {
            if (state.tmp.area === "bibliography") {
                return false;
            }
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
    for (var i=0,ilen=trypositions.length;i<ilen;i+=1) {
        var tryposition = trypositions[i];
        if (tryposition === "first") {
            tryposition = CSL.POSITION_FIRST;
        } else if (tryposition === "subsequent") {
            tryposition = CSL.POSITION_SUBSEQUENT;
        } else if (tryposition === "ibid") {
            tryposition = CSL.POSITION_IBID;
        } else if (tryposition === "ibid-with-locator") {
            tryposition = CSL.POSITION_IBID_WITH_LOCATOR;
        }
        if ("near-note" === tryposition) {
            this.tests.push(testSubsequentNear);
        } else if ("far-note" === tryposition) {
            this.tests.push(testSubsequentNotNear);
        } else {
            this.tests.push(maketest(tryposition));
        }
    }
};

CSL.Attributes["@type"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    // XXX This is ALWAYS composed as an "any" match
    var types = arg.split(/\s+/);
    // Strip off any boolean prefix.
    var maketest = function (mytype) {
        return function(Item) {
            var ret = (Item.type === mytype);
            if (ret) {
                return true;
            } else {
                return false;
            }
        };
    };
    var tests = [];
    for (var i=0,ilen=types.length;i<ilen;i+=1) {
        tests.push(maketest(types[i]));
    }
    this.tests.push(state.fun.match.any(this, state, tests));
};

CSL.Attributes["@variable"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var func;
    this.variables = arg.split(/\s+/);
    this.variables_real = this.variables.slice();

    // First the non-conditional code.
    if ("label" === this.name && this.variables[0]) {
        this.strings.term = this.variables[0];
    } else if (["names", "date", "text", "number"].indexOf(this.name) > -1) {
        //
        // An oddity of variable handling is that this.variables
        // is actually ephemeral; the full list of variables is
        // held in the variables_real var, and pushed into this.variables
        // conditionally in order to suppress repeat renderings of
        // the same item variable.  [STILL FUNCTIONAL? 2010.01.15]
        //
        // set variable names
        func = function (state, Item, item) {
            // Clear this.variables in place
            for (var i = this.variables.length - 1; i > -1; i += -1) {
                this.variables.pop();
            }
            for (var i=0,ilen=this.variables_real.length;i<ilen;i++) {
                // set variable name if not quashed, and if not the title of a legal case w/suppress-author
                if (state.tmp.done_vars.indexOf(this.variables_real[i]) === -1 
// This looks nuts. Why suppress a case name if not required by context?
//                    && !(item && Item.type === "legal_case" && item["suppress-author"] && this.variables_real[i] === "title")
                   ) {
                    this.variables.push(this.variables_real[i]);
                }
                if (state.tmp.can_block_substitute) {
                    state.tmp.done_vars.push(this.variables_real[i]);
                }
            }
        };
        this.execs.push(func);

        // check for output
        func = function (state, Item, item) {
            var output = false;
            for (var i=0,ilen=this.variables.length;i<ilen;i++) {
                var variable = this.variables[i];
                if (["authority", "committee"].indexOf(variable) > -1
                    && "string" === typeof Item[variable]
                    && "names" === this.name) {

                    // Great! So for each of these, we split.
                    // And we only recombine everything if the length
                    // of all the splits matches.
                    
                    // Preflight
                    var isValid = true;
                    var rawNames = Item[variable].split(/\s*;\s*/);
                    var rawMultiNames = {};
                    if (Item.multi && Item.multi._keys[variable]) {
                        for (var langTag in Item.multi._keys[variable]) {
                            rawMultiNames[langTag] = Item.multi._keys[variable][langTag].split(/\s*;\s*/);
                            if (rawMultiNames[langTag].length !== rawNames.length) {
                                isValid = false;
                                break;
                            }
                        }
                    }
                    if (!isValid) {
                        rawNames = [Item[variable]];
                        rawMultiNames = Item.multi._keys[variable];
                    }
                    for (var j = 0, jlen = rawNames.length; j < jlen; j++) {
                        var creatorParent = {
                            literal:rawNames[j],
                            multi:{
                                _key:{}
                            }
                        };
                        for (var langTag in rawMultiNames) {
                            var creatorChild = {
                                literal:rawMultiNames[langTag][j]
                            };
                            creatorParent.multi._key[langTag] = creatorChild;
                        }
                        rawNames[j] = creatorParent;
                    }
                    Item[variable] = rawNames;
                }
                if (this.strings.form === "short" && !Item[variable]) {
                    if (variable === "title") {
                        variable = "title-short";
                    } else if (variable === "container-title") {
                        variable = "container-title-short";
                    }
                }
                if (variable === "year-suffix") {
                    // year-suffix always signals that it produces output,
                    // even when it doesn't. This permits it to be used with
                    // the "no date" term inside a group used exclusively
                    // to control formatting.
                    output = true;
                    break;
                } else if (CSL.DATE_VARIABLES.indexOf(variable) > -1) {
                    if (state.opt.development_extensions.locator_date_and_revision && "locator-date" === variable) {
                        // If locator-date is set, it's valid.
                        output = true;
                        break;
                    }
                    if (Item[variable]) {
                        for (var key in Item[variable]) {
                            if (this.dateparts.indexOf(key) === -1 && "literal" !== key) {
                                continue;
                            }
                            if (Item[variable][key]) {
                                output = true;
                                break;
                            }
                        }
                        if (output) {
                            break;
                        }
                    }
                } else if ("locator" === variable) {
                    if (item && item.locator) {
                        output = true;
                    }
                    break;
                } else if ("locator-extra" === variable) {
                    if (item && item["locator-extra"]) {
                        output = true;
                    }
                    break;
                } else if (["citation-number","citation-label"].indexOf(variable) > -1) {
                    output = true;
                    break;
                } else if ("first-reference-note-number" === variable) {
                    if (item && item["first-reference-note-number"]) {
                        output = true;
                    }
                    break;
                } else if ("hereinafter" === variable) {
                    if (state.transform.abbrevs["default"].hereinafter[Item.id]
                        && state.sys.getAbbreviation
                        && Item.id) {
						
                        output = true;
                    }
                    break;
                } else if ("object" === typeof Item[variable]) {
                    break;
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
            //print("-- VAR: "+variable);
            //flag = state.tmp.group_context.tip;
            if (output) {
                for (var i=0,ilen=this.variables_real.length;i<ilen;i++) {
                    var variable = this.variables_real[i];
                    if (variable !== "citation-number" || state.tmp.area !== "bibliography") {
                        state.tmp.cite_renders_content = true;
                    }
                    //print("  setting [2] to true based on: " + arg);
                    state.tmp.group_context.tip.variable_success = true;
                    // For util_substitute.js, subsequent-author-substitute
                    if (state.tmp.can_substitute.value() 
                        && state.tmp.area === "bibliography"
                        && "string" === typeof Item[variable]) {

                        state.tmp.name_node.top = state.output.current.value();
                        state.tmp.rendered_name.push(Item[variable]);
                    }
                }
                state.tmp.can_substitute.replace(false,  CSL.LITERAL);
            } else {
                //print("  setting [1] to true based on: " + arg);
                state.tmp.group_context.tip.variable_attempt = true;
            }
            //state.tmp.group_context.replace(flag);
        };
        this.execs.push(func);
    } else if (["if",  "else-if", "condition"].indexOf(this.name) > -1) {
        // Strip off any boolean prefix.
        // Now the conditionals.
        var maketest = function (variable) {
            return function(Item,item){
                var myitem = Item;
                if (item && ["locator", "locator-extra", "first-reference-note-number", "locator-date"].indexOf(variable) > -1) {
                    myitem = item;
                }
                // We don't run loadAbbreviation() here; it is run by the application-supplied
                // retrieveItem() if hereinafter functionality is to be used, so this key will
                // always exist in memory, possibly with a nil value.
                if (variable === "hereinafter" && state.sys.getAbbreviation && myitem.id) {
                    if (state.transform.abbrevs["default"].hereinafter[myitem.id]) {
                        return true;
                    }
                } else if (myitem[variable]) {
                    if ("number" === typeof myitem[variable] || "string" === typeof myitem[variable]) {
                        return true;
                    } else if ("object" === typeof myitem[variable]) {
                        //
                        // this will turn true only for hash objects
                        // that have at least one attribute, or for a
                        // non-zero-length list
                        //
                        for (var key in myitem[variable]) {
                            if (myitem[variable][key]) {
                                return true;
                            }
                        }
                    }
                }
                return false;
            };
        };
        for (var i=0,ilen=this.variables.length;i<ilen;i+=1) {
            this.tests.push(maketest(this.variables[i]));
        }
    }
};


CSL.Attributes["@page"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var trylabels = arg.replace("sub verbo", "sub-verbo");
    trylabels = trylabels.split(/\s+/);
    // Strip off any boolean prefix.
    var maketest = function (trylabel) {
        return function(Item) {
            var label;
            state.processNumber(false, Item, "page", Item.type);
            if (!state.tmp.shadow_numbers.page.label) {
                label = "page";
            } else if (state.tmp.shadow_numbers.page.label === "sub verbo") {
                label = "sub-verbo";
            } else {
                label = state.tmp.shadow_numbers.page.label;
            }
            if (trylabel === label) {
                return true;
            } else {
                return false;
            }
        };
    };
    for (var i=0,ilen=trylabels.length;i<ilen;i+=1) {
        this.tests.push(maketest(trylabels[i]));
    }
};


// a near duplicate of code above
CSL.Attributes["@number"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var trylabels = arg.split(/\s+/);
    var maketest = function(trylabel) {
        return function (Item) {
            var label;
            state.processNumber(false, Item, "number", Item.type);
            if (!state.tmp.shadow_numbers.number.label) {
                label = "number";
            } else {
                label = state.tmp.shadow_numbers.number.label;
            }
            if (trylabel === label) {
                return true;
            } else {
                return false;
            }
        };
    };
    for (var i=0,ilen=trylabels.length;i<ilen;i+=1) {
        this.tests.push(maketest(trylabels[i]));
    }
};

CSL.Attributes["@jurisdiction"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var tryjurisdictions = arg.split(/\s+/);
    // Strip off any boolean prefix.
    for (var i=0,ilen=tryjurisdictions.length;i<ilen;i+=1) {
        tryjurisdictions[i] = tryjurisdictions[i].split(":");
    }
    var maketests = function (tryjurisdiction) {
        return function(Item) {
            if (!Item.jurisdiction) {
                return false;
            }
            var jurisdictions = Item.jurisdiction.split(":");
            for (var i=0,ilen=jurisdictions.length;i<ilen;i+=1) {
                jurisdictions[i] = jurisdictions[i].split(":");
            }
            for (i=tryjurisdiction.length;i>0;i+=-1) {
                var tryjurisdictionStr = tryjurisdiction.slice(0,i).join(":");
                var jurisdiction = jurisdictions.slice(0,i).join(":");
                if (tryjurisdictionStr !== jurisdiction) {
                    return false;
                }
                // this should be okay to enable.
                // break;
            }
            return true;
        };
    };
    for (var i=0,ilen=tryjurisdictions.length;i<ilen;i+=1) {
        var tryjurisdictionSlice = tryjurisdictions[i].slice();
        this.tests.push(maketests(tryjurisdictionSlice));
    }
};


CSL.Attributes["@context"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var func = function () {
        if (["bibliography", "citation"].indexOf(arg) > -1) {
		    var area = state.tmp.area.slice(0, arg.length);
		    if (area === arg) {
			    return true;
		    }
		    return false;
        } else if ("alternative" === arg) {
            return !!state.tmp.abort_alternative;
        }
    };
    this.tests.push(func);
};

CSL.Attributes["@has-year-only"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var trydates = arg.split(/\s+/);
    var maketest = function (trydate) {
        return function(Item) {
            var date = Item[trydate];
            if (!date || date.month || date.season) {
                return false;
            } else {
                return true;
            }
        };
    };
    for (var i=0,ilen=trydates.length;i<ilen;i+=1) {
        this.tests.push(maketest(trydates[i]));
    }
};

CSL.Attributes["@has-to-month-or-season"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var trydates = arg.split(/\s+/);
    var maketest = function (trydate) {
        return function(Item) {
            var date = Item[trydate];
            if (!date || (!date.month && !date.season) || date.day) {
                return false;
            } else {
                return true;
            }
        };
    };
    for (var i=0,ilen=trydates.length;i<ilen;i+=1) {
        this.tests.push(maketest(trydates[i]));
    }
};

CSL.Attributes["@has-day"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var trydates = arg.split(/\s+/);
    var maketest = function (trydate) {
        return function(Item) {
            var date = Item[trydate];
            if (!date || !date.day) {
                return false;
            } else {
                return true;
            }
        };
    };
    for (var i=0,ilen=trydates.length;i<ilen;i+=1) {
        this.tests.push(maketest(trydates[i]));
    }
};

CSL.Attributes["@is-plural"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var func = function (Item) {
        var nameList = Item[arg];
        if (nameList && nameList.length) {
            var persons = 0;
            var institutions = 0;
            var last_is_person = false;
            for (var i = 0, ilen = nameList.length; i < ilen; i += 1) {
                if (state.opt.development_extensions.spoof_institutional_affiliations
                    && (nameList[i].literal || (nameList[i].isInstitution && nameList[i].family && !nameList[i].given))) {
                    institutions += 1;
                    last_is_person = false;
                } else {
                    persons += 1;
                    last_is_person = true;
                }
            }
            if (persons > 1) {
                return true;
            } else if (institutions > 1) {
                return true;
            } else if (institutions && last_is_person) {
                return true;
            }
        }
        return false;
    };
    this.tests.push(func);
};

CSL.Attributes["@locale"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var ret, langspec, lang, lst, i, ilen;
    // Style default
    var locale_default = state.opt["default-locale"][0];

    if (this.name === "layout") {
        // For layout
        this.locale_raw = arg;
        if (this.tokentype === CSL.START) {
            if (!state.opt.multi_layout) {
                state.opt.multi_layout = [];
            }
            var locale_data = [];
            // Register the primary locale in the set, and others that "map" to it, 
            // so that they can be used when generating sort keys. See node_sort.js.
            // Not idempotent. Only do this once.
            var locales = arg.split(/\s+/);
            var sort_locale = {};
            var localeMaster = CSL.localeResolve(locales[0], locale_default);
            locale_data.push(localeMaster);
            if (localeMaster.generic) {
                sort_locale[localeMaster.generic] = localeMaster.best;
            } else {
                sort_locale[localeMaster.best] = localeMaster.best;
            }
            for (var i=1,ilen=locales.length;i<ilen;i+=1) {
                var localeServant = CSL.localeResolve(locales[i], locale_default);
                locale_data.push(localeServant);
                if (localeServant.generic) {
                    sort_locale[localeServant.generic] = localeMaster.best;
                } else {
                    sort_locale[localeServant.best] = localeMaster.best;
                }

            }
            state[state.build.area].opt.sort_locales.push(sort_locale);
            state.opt.multi_layout.push(locale_data);
        }
        state.opt.has_layout_locale = true;
    } else {
        // For if and if-else

        // Split argument
        lst = arg.split(/\s+/);

        // Expand each list element
        var locale_bares = [];
        for (i = 0, ilen = lst.length; i < ilen; i += 1) {
            // Parse out language string
            lang = lst[i];
        
            // Analyze the locale
            langspec = CSL.localeResolve(lang, locale_default);
            if (lst[i].length === 2) {
                // For fallback
                locale_bares.push(langspec.bare);
            }
            // Load the locale terms etc.
            // (second argument causes immediate return if locale already exists)
            state.localeConfigure(langspec, true);
            
            // Replace string with locale spec object
            lst[i] = langspec;
        }
        // Locales to test
        var locale_list = lst.slice();

        // check for variable value
        // Closure probably not necessary here.
        var maketest = function (locale_list, locale_default,locale_bares) {
            return function (Item) {
                var res;
                ret = [];
                res = false;
                var langspec = false;

                var lang;
                if (!Item.language) {
                    lang = locale_default;
                } else {
                    lang = Item.language;
                }
                langspec = CSL.localeResolve(lang, locale_default);
                for (i = 0, ilen = locale_list.length; i < ilen; i += 1) {
                    if (langspec.best === locale_list[i].best) {
                        state.tmp.condition_lang_counter_arr.push(state.tmp.condition_counter);
                        state.tmp.condition_lang_val_arr.push(state.opt.lang);
                        state.opt.lang = locale_list[0].best;
                        res = true;
                        break;
                    }
                }
                if (!res && locale_bares.indexOf(langspec.bare) > -1) {
                    state.tmp.condition_lang_counter_arr.push(state.tmp.condition_counter);
                    state.tmp.condition_lang_val_arr.push(state.opt.lang);
                    state.opt.lang = locale_list[0].best;
                    res = true;
                }
                return res;
            };
        };
        this.tests.push(maketest(locale_list,locale_default,locale_bares));
    }
};

CSL.Attributes["@alternative-node-internal"] = function (state) {
    this.tests ? {} : this.tests = [];
    var maketest = function () {
        return function() {
            return !state.tmp.abort_alternative;
        };
    };
    var me = this;
    this.tests.push(maketest(me));
};

CSL.Attributes["@locale-internal"] = function (state, arg) {
    this.tests ? {} : this.tests = [];
    var langspec, lang, lst, i, ilen;
        // For if and if-else

        // Split argument
        lst = arg.split(/\s+/);

        // Expand each list element
        this.locale_bares = [];
        for (i = 0, ilen = lst.length; i < ilen; i += 1) {
            // Parse out language string
            lang = lst[i];
        
            // Analyze the locale
            langspec = CSL.localeResolve(lang, state.opt["default-locale"][0]);
            if (lst[i].length === 2) {
                // For fallback
                this.locale_bares.push(langspec.bare);
            }
            // Load the locale terms etc.
            state.localeConfigure(langspec);
            
            // Replace string with locale spec object
            lst[i] = langspec;
        }
        // Set locale tag on node
        this.locale_default = state.opt["default-locale"][0];
        // The locale to set on node children if match is successful
        this.locale = lst[0].best;
        // Locales to test
        this.locale_list = lst.slice();
        
        // check for variable value
        // Closure probably not necessary here.
        var maketest = function (me) {
            return function (Item) {
                var ret, res;
                ret = [];
                res = false;
                var langspec = false;
                if (Item.language) {
                    lang = Item.language;
                    langspec = CSL.localeResolve(lang, state.opt["default-locale"][0]);
                    if (langspec.best === state.opt["default-locale"][0]) {
                        langspec = false;
                    }
                }
                if (langspec) {
                    // We attempt to match a specific locale from the
                    // list of parameters.  If that fails, we fall back
                    // to the base locale of the first element.  The
                    // locale applied is always the first local 
                    // in the list of parameters (or base locale, for a 
                    // single two-character language code) 
                    for (i = 0, ilen = me.locale_list.length; i < ilen; i += 1) {
                        if (langspec.best === me.locale_list[i].best) {
                            state.opt.lang = me.locale;
                            state.tmp.last_cite_locale = me.locale;
                            // Set empty group open tag with locale set marker
                            state.output.openLevel("empty");
                            state.output.current.value().new_locale = me.locale;
                            res = true;
                            break;
                        }
                    }
                    if (!res && me.locale_bares.indexOf(langspec.bare) > -1) {
                        state.opt.lang = me.locale;
                        state.tmp.last_cite_locale = me.locale;
                        // Set empty group open tag with locale set marker
                        state.output.openLevel("empty");
                        state.output.current.value().new_locale = me.locale;
                        res = true;
                    }
                }
                return res;
            };
        };
        var me = this;
        this.tests.push(maketest(me));
};


// These are not evaluated as conditions immediately: they only
// set parameters that are picked up during processing.
CSL.Attributes["@is-parallel"] = function (state, arg) {
    this.strings.set_parallel_condition = arg;
};
CSL.Attributes["@no-repeat"] = function (state, arg) {
    this.strings.set_no_repeat_condition = arg.split(/\s+/);
};



CSL.Attributes["@require"] = function (state, arg) {
    this.strings.require = arg;

    // Introduced to constrain rendering of the group with a
    // requirement that it either render an alpha term via cs:label or
    // cs:text at least once, or render without any label. That
    // behaviour is invoked with "label-empty-or-alpha" as arg.

    // This attribute is a complement to @label-form and modular
    // jurisdiction support, as it makes macros that adapt to shifting
    // local term definitions possible.
};

CSL.Attributes["@reject"] = function (state, arg) {
    this.strings.reject = arg;

    // Introduced to constrain rendering of the group with a
    // requirement that it render some label via cs:label or cs:text,
    // and that it NOT be alpha. That behaviour is invoked with
    // "label-empty-or-alpha" as arg.

    // This attribute is a complement to @label-form and modular
    // jurisdiction support, as it makes macros that adapt to shifting
    // local term definitions possible.
};

CSL.Attributes["@gender"] = function (state, arg) {
    this.gender = arg;
};

CSL.Attributes["@cslid"] = function (state, arg) {
    // @cslid is a noop
    // The value set on this attribute is used to
    // generate reverse lookup wrappers on output when 
    // this.development_extensions.csl_reverse_lookup_support is
    // set to true in state.js (there is no runtime option,
    // it must be set in state.js)
    //
    // See the @showid method in the html output
    // section of formats.js for the function that
    // renders the wrappers.
    this.cslid = parseInt(arg, 10);
};

CSL.Attributes["@capitalize-if-first"] = function (state, arg) {
    this.strings.capitalize_if_first_override = arg;
};

CSL.Attributes["@label-capitalize-if-first"] = function (state, arg) {
    this.strings.label_capitalize_if_first_override = arg;
};

CSL.Attributes["@label-form"] = function (state, arg) {
    this.strings.label_form_override = arg;
};

CSL.Attributes["@part-separator"] = function (state, arg) {
    this.strings["part-separator"] = arg;
};

CSL.Attributes["@leading-noise-words"] = function (state, arg) {
    this["leading-noise-words"] = arg;
};

CSL.Attributes["@name-never-short"] = function (state, arg) {
    this["name-never-short"] = arg;
};

CSL.Attributes["@class"] = function (state, arg) {
    state.opt["class"] = arg;
};

CSL.Attributes["@version"] = function (state, arg) {
    state.opt.version = arg;
};

/**
 * Store the value attribute on the token.
 * @name CSL.Attributes.@value
 * @function
 */
CSL.Attributes["@value"] = function (state, arg) {
    this.strings.value = arg;
};


/**
 * Store the name attribute (of a macro or term node)
 * on the state object.
 * <p>For reference when the closing node of a macro
 * or locale definition is encountered.</p>
 * @name CSL.Attributes.@name
 * @function
 */
CSL.Attributes["@name"] = function (state, arg) {
    this.strings.name = arg;
};

/**
 * Store the form attribute (of a term node) on the state object.
 * <p>For reference when the closing node of a macro
 * or locale definition is encountered.</p>
 * @name CSL.Attributes.@form
 * @function
 */
CSL.Attributes["@form"] = function (state, arg) {
    this.strings.form = arg;
};

CSL.Attributes["@date-parts"] = function (state, arg) {
    this.strings["date-parts"] = arg;
};

CSL.Attributes["@range-delimiter"] = function (state, arg) {
    this.strings["range-delimiter"] = arg;
};

/**
 * Store macro tokens in a buffer on the state object.
 * <p>For reference when the enclosing text token is
 * processed.</p>
 * @name CSL.Attributes.@macro
 * @function
 */
CSL.Attributes["@macro"] = function (state, arg) {
    this.postponed_macro = arg;
};

/*
 * CSL.Attributes["@prefer-jurisdiction"] = function (state, arg) {
 *    this.prefer_jurisdiction = true;
 * };
 */

CSL.Attributes["@term"] = function (state, arg) {
    if (arg === "sub verbo") {
        this.strings.term = "sub-verbo";
    } else {
        this.strings.term = arg;
    }
};


/*
 * Ignore xmlns attribute.
 * <p>This should always be <p>http://purl.org/net/xbiblio/csl</code>
 * anyway.  At least for the present we will blindly assume
 * that it is.</p>
 * @name CSL.Attributes.@xmlns
 * @function
 */
CSL.Attributes["@xmlns"] = function () {};


/*
 * Store language attribute to a buffer field.
 * <p>Will be placed in the appropriate location
 * when the element is processed.</p>
 * @name CSL.Attributes.@lang
 * @function
 */
CSL.Attributes["@lang"] = function (state, arg) {
    if (arg) {
        state.build.lang = arg;
    }
};


// Used as a flag during dates processing
CSL.Attributes["@lingo"] = function () {};

// Used as a flag during dates processing
CSL.Attributes["@macro-has-date"] = function () {
    this["macro-has-date"] = true;
};

/*
 * Store suffix string on token.
 * @name CSL.Attributes.@suffix
 * @function
 */
CSL.Attributes["@suffix"] = function (state, arg) {
    this.strings.suffix = arg;
};


/*
 * Store prefix string on token.
 * @name CSL.Attributes.@prefix
 * @function
 */
CSL.Attributes["@prefix"] = function (state, arg) {
    this.strings.prefix = arg;
};


/*
 * Store delimiter string on token.
 * @name CSL.Attributes.@delimiter
 * @function
 */
CSL.Attributes["@delimiter"] = function (state, arg) {
    this.strings.delimiter = arg;
};


/*
 * Store match evaluator on token.
 */
CSL.Attributes["@match"] = function (state, arg) {
    this.match = arg;
};


CSL.Attributes["@names-min"] = function (state, arg) {
    var val = parseInt(arg, 10);
    if (state[state.build.area].opt.max_number_of_names < val) {
        state[state.build.area].opt.max_number_of_names = val;
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
    // Accepted values of plural attribute differ on cs:text
    // and cs:label nodes.
    if ("always" === arg || "true" === arg) {
        this.strings.plural = 1;
    } else if ("never" === arg || "false" === arg) {
        this.strings.plural = 0;
    } else if ("contextual" === arg) {
        this.strings.plural = false;
    }
};

CSL.Attributes["@has-publisher-and-publisher-place"] = function () {
    this.strings["has-publisher-and-publisher-place"] = true;
};

CSL.Attributes["@publisher-delimiter-precedes-last"] = function (state, arg) {
    this.strings["publisher-delimiter-precedes-last"] = arg;
};

CSL.Attributes["@publisher-delimiter"] = function (state, arg) {
    this.strings["publisher-delimiter"] = arg;
};

CSL.Attributes["@publisher-and"] = function (state, arg) {
    this.strings["publisher-and"] = arg;
};

CSL.Attributes["@givenname-disambiguation-rule"] = function (state, arg) {
    if (CSL.GIVENNAME_DISAMBIGUATION_RULES.indexOf(arg) > -1) {
        state.citation.opt["givenname-disambiguation-rule"] = arg;
    }
};

CSL.Attributes["@collapse"] = function (state, arg) {
    // only one collapse value will be honoured.
    if (arg) {
        state[this.name].opt.collapse = arg;
    }
};

CSL.Attributes["@cite-group-delimiter"] = function (state, arg) {
    if (arg) {
        state[state.tmp.area].opt.cite_group_delimiter = arg;
    }
};



CSL.Attributes["@names-delimiter"] = function (state, arg) {
    state.setOpt(this, "names-delimiter", arg);
};

CSL.Attributes["@name-form"] = function (state, arg) {
    state.setOpt(this, "name-form", arg);
};

CSL.Attributes["@subgroup-delimiter"] = function (state, arg) {
    this.strings["subgroup-delimiter"] = arg;
};

CSL.Attributes["@subgroup-delimiter-precedes-last"] = function (state, arg) {
    this.strings["subgroup-delimiter-precedes-last"] = arg;
};


CSL.Attributes["@name-delimiter"] = function (state, arg) {
    state.setOpt(this, "name-delimiter", arg);
};

CSL.Attributes["@et-al-min"] = function (state, arg) {
    var val = parseInt(arg, 10);
    if (state[state.build.area].opt.max_number_of_names < val) {
        state[state.build.area].opt.max_number_of_names = val;
    }
    state.setOpt(this, "et-al-min", val);
};

CSL.Attributes["@et-al-use-first"] = function (state, arg) {
    state.setOpt(this, "et-al-use-first", parseInt(arg, 10));
};

CSL.Attributes["@et-al-use-last"] = function (state, arg) {
    if (arg === "true") {
        state.setOpt(this, "et-al-use-last", true);
    } else {
        state.setOpt(this, "et-al-use-last", false);
    }
};

CSL.Attributes["@et-al-subsequent-min"] = function (state, arg) {
    var val = parseInt(arg, 10);
    if (state[state.build.area].opt.max_number_of_names < val) {
        state[state.build.area].opt.max_number_of_names = val;
    }
    state.setOpt(this, "et-al-subsequent-min", val);
};

CSL.Attributes["@et-al-subsequent-use-first"] = function (state, arg) {
    state.setOpt(this, "et-al-subsequent-use-first", parseInt(arg, 10));
};

CSL.Attributes["@suppress-min"] = function (state, arg) {
    this.strings["suppress-min"] = parseInt(arg, 10);
};

CSL.Attributes["@suppress-max"] = function (state, arg) {
    this.strings["suppress-max"] = parseInt(arg, 10);
};


CSL.Attributes["@and"] = function (state, arg) {
    state.setOpt(this, "and", arg);
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

CSL.Attributes["@initialize"] = function (state, arg) {
    if (arg === "false") {
        state.setOpt(this, "initialize", false);
    }
};

CSL.Attributes["@name-as-reverse-order"] = function (state, arg) {
    this["name-as-reverse-order"] = arg;
};

CSL.Attributes["@name-as-sort-order"] = function (state, arg) {
    if (this.name === "style-options") {
        this["name-as-sort-order"] = arg;
    } else {
        state.setOpt(this, "name-as-sort-order", arg);
    }
};

CSL.Attributes["@sort-separator"] = function (state, arg) {
    state.setOpt(this, "sort-separator", arg);
};

CSL.Attributes["@require-match"] = function (state, arg) {
    if (arg === "true") {
        this.requireMatch = true;
    }
};

CSL.Attributes["@exclude-types"] = function (state, arg) {
    state.bibliography.opt.exclude_types = arg.split(/\s+/);
};

CSL.Attributes["@exclude-with-fields"] = function (state, arg) {
    state.bibliography.opt.exclude_with_fields = arg.split(/\s+/);
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

CSL.Attributes["@subsequent-author-substitute-rule"] = function (state, arg) {
    state[this.name].opt["subsequent-author-substitute-rule"] = arg;
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
    if (arg === "true" && state.opt.xclass !== "numeric") {
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
        if (state.opt.development_extensions.hanging_indent_legacy_number) {
            state[this.name].opt.hangingindent = 2;
	    } else {
            state[this.name].opt.hangingindent = true;
	    }
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

CSL.Attributes["@text-case"] = function (state, arg) {
    var func = function (state, Item) {
        if (arg === "normal") {
            this.text_case_normal = true;
        } else {
            this.strings["text-case"] = arg;
            if (arg === "title") {
                if (Item.jurisdiction) {
                    this.strings["text-case"] = "passthrough";
                }
            }
        }
    };
    this.execs.push(func);
};


CSL.Attributes["@page-range-format"] = function (state, arg) {
    state.opt["page-range-format"] = arg;
};


CSL.Attributes["@year-range-format"] = function (state, arg) {
    state.opt["year-range-format"] = arg;
};


CSL.Attributes["@default-locale"] = function (state, arg) {
    if (this.name === 'style') {
        var lst, len, pos, m, ret;
        //
        // Workaround for Internet Exploder 6 (doesn't recognize
        // groups in str.split(/something(braced-group)something/)
        //
        var m = arg.match(/-x-(sort|translit|translat)-/g);
        if (m) {
            for (pos = 0, len = m.length; pos < len; pos += 1) {
                m[pos] = m[pos].replace(/^-x-/, "").replace(/-$/, "");
            }
        }
        lst = arg.split(/-x-(?:sort|translit|translat)-/);
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
    } else if (arg === "true") {
        this.default_locale = true;
    }
};

CSL.Attributes["@default-locale-sort"] = function (state, arg) {
    state.opt["default-locale-sort"] = arg;
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

CSL.Attributes["@stop-last"] = function (state, arg) {
    this.strings["stop-last"] = parseInt(arg, 10) * -1;
};

CSL.Attributes["@use-last"] = function (state, arg) {
    this.strings["use-last"] = parseInt(arg, 10);
};


CSL.Attributes["@reverse-order"] = function (state, arg) {
    if ("true" === arg) {
        this.strings["reverse-order"] = true;
    }
};

CSL.Attributes["@display"] = function (state, arg) {
    if (state.bibliography.tokens.length === 2) {
        state.opt.using_display = true;
    }
    this.strings.cls = arg;
};


/*global CSL: true */


/**
 * String stack object.
 * <p>Numerous string stacks are used to track nested
 * parameters at runtime.  This class provides methods
 * that remove some of the aggravation of managing
 * them.</p>
 * @class
 */
CSL.Stack = function (val, literal) {
    this.mystack = [];
    if (literal || val) {
        this.mystack.push(val);
    }
    this.tip = this.mystack[0];
};

/**
 * Push a value onto the stack.
 * <p>This just does what it says.</p>
 */
CSL.Stack.prototype.push = function (val, literal) {
    if (literal || val) {
        this.mystack.push(val);
    } else {
        this.mystack.push("");
    }
    this.tip = this.mystack[this.mystack.length - 1];
};

/**
 * Clear the stack
 */
CSL.Stack.prototype.clear = function () {
    this.mystack = [];
    this.tip = {};
};

/**
 * Replace the top value on the stack.
 * <p>This removes some ugly syntax from the
 * main code.</p>
 */
CSL.Stack.prototype.replace = function (val, literal) {
    //
    // safety fix after a bug was chased down.  Rhino
    // JS will process a negative index without error (!).
    if (this.mystack.length === 0) {
        CSL.error("Internal CSL processor error: attempt to replace nonexistent stack item with " + val);
    }
    if (literal || val) {
        this.mystack[(this.mystack.length - 1)] = val;
    } else {
        this.mystack[(this.mystack.length - 1)] = "";
    }
    this.tip = this.mystack[this.mystack.length - 1];
};


/**
 * Remove the top value from the stack.
 * <p>Just does what it says.</p>
 */
CSL.Stack.prototype.pop = function () {
    var ret = this.mystack.pop();
    if (this.mystack.length) {
        this.tip = this.mystack[this.mystack.length - 1];
    } else {
        this.tip = {};
    }
    return ret;
};


/**
 * Return the top value on the stack.
 * <p>Removes a little hideous complication from
 * the main code.</p>
 */
CSL.Stack.prototype.value = function () {
    return this.mystack.slice(-1)[0];
};


/**
 * Return length (depth) of stack.
 * <p>Used to identify if there is content to
 * be handled on the stack</p>
 */
CSL.Stack.prototype.length = function () {
    return this.mystack.length;
};

/*global CSL: true */

/**
 * Initializes the parallel cite tracking arrays
 */
CSL.Parallel = function (state) {
    this.state = state;
    this.info = {};
};

CSL.Parallel.prototype.setSeriesRels = function(prevID, currID, seriesRels) {
    if (this.info[prevID][currID]) {
        if (!seriesRels) {
            seriesRels = JSON.parse(JSON.stringify(this.info[prevID]));
        }
    } else {
        seriesRels = false;
    }
    return seriesRels;
}

CSL.Parallel.prototype.getRepeats = function(prev, curr) {
    var rex = /(?:type|id|seeAlso|.*-sub|.*-subjoin|.*-main)/;
    var ret = {};
    for (var key in prev) {
        if (key.match(rex)) {
            continue;
        }
        if (typeof prev[key] === "string" || !prev[key]) {
            if (prev[key] && prev[key] === curr[key]) {
                ret[key] = true;
            }
        } else if (typeof prev[key] === "object") {
            // Could do better than this.
            if (JSON.stringify(prev[key]) === JSON.stringify(curr[key])) {
                ret[key] = true;
            }
        }
    }
    return ret;
}

CSL.Parallel.prototype.StartCitation = function (sortedItems, out) {
    this.parallel_conditional_blobs_list = [];
    this.info = {};
    if (sortedItems.length > 1) {
        // Harder than it looks.
        // On a first pass, get the seeAlso of each item.
        for (var i=0,ilen=sortedItems.length; i<ilen; i++) {
            var curr = sortedItems[i][0];
            this.info[curr.id] = {};
            if (curr.seeAlso) {
                for (var j=0,jlen=curr.seeAlso.length; j<jlen; j++) {
                    if (curr.id === curr.seeAlso[j]) {
                        continue;
                    }
                    this.info[curr.id][curr.seeAlso[j]] = true;
                }
            }
        }
        // On a second pass, set an item to FIRST if the current
        // item is in its seeAlso. The seeAlso of the FIRST item control
        // until (a) a non-member is encountered at CURRENT, or
        // (b) the end of the array is reached.
        // The seeAlso keys are deleted as each is seen.
        // If neither (a) nor (b), set the current item to MID.
        // If (a) and the previous item is FIRST, delete its
        // parallel marker.
        // If (b) and the current item is FIRST, delete its
        // parallel marker.
        // If (a) and the previous item is not FIRST, set it to
        // LAST, and reset seeAlso from the current item.
        // If (b) and the current item is not FIRST, set it to
        // LAST.
        var seriesRels = false;
        var masterID = false;
        for (var i=1,ilen=sortedItems.length; i<ilen; i++) {
            var prev = sortedItems[i-1][0];
            var curr = sortedItems[i][0];
            var newSeriesRels = this.setSeriesRels(prev.id, curr.id, seriesRels);
            if (!seriesRels) {
                if (newSeriesRels) {
                    // first
                    seriesRels = newSeriesRels;
                    delete seriesRels[curr.id];
                    sortedItems[i-1][1].parallel = "first";
                    sortedItems[i][1].parallel = "mid";
                    sortedItems[i][1].repeats = this.getRepeats(prev, curr);
                    sortedItems[i-1][1].repeats = sortedItems[i][1].repeats;
                    if (!sortedItems[i][1].prefix) {
                        sortedItems[i][1].prefix = ", ";
                    }
                    masterID = prev.id;
                    this.state.registry.registry[masterID].master = true;
                    this.state.registry.registry[masterID].siblings = [curr.id];

                }
            } else {
                if (seriesRels[curr.id]) {
                    sortedItems[i][1].parallel = "mid";
                    if (!sortedItems[i][1].prefix) {
                        sortedItems[i][1].prefix = ", ";
                    }
                    delete seriesRels[curr.id];
                    sortedItems[i][1].repeats = this.getRepeats(prev, curr);
                    //sortedItems[i-1][1].repeats = sortedItems[i][1].repeats;
                    this.state.registry.registry[masterID].siblings.push(curr.id);
                } else {
                    sortedItems[i-1][1].parallel = "last";
                    sortedItems[i][1].repeats = this.getRepeats(prev, curr);
                    seriesRels = false;
                }
            }
            if (i === (sortedItems.length-1)) {
                if (sortedItems[i][1].parallel === "mid") {
                    sortedItems[i][1].parallel = "last";
                    sortedItems[i][1].repeats = this.getRepeats(prev, curr);
                } else if (sortedItems[i][1].parallel !== "last") {
                    delete sortedItems[i][1].repeats;
                }
            }
        }
    }
};


CSL.Parallel.prototype.purgeGroupsIfParallel = function () {
    for (var i = this.parallel_conditional_blobs_list.length - 1; i > -1; i += -1) {
        var obj = this.parallel_conditional_blobs_list[i];
        if (!obj.result && !obj.repeats) {
            purgeme = false;
        } else {
            if (obj.condition) {
                var purgeme = true;
                if (obj.result === obj.condition) {
                    purgeme = false;
                }
            }
            if (purgeme && obj.norepeat && obj.repeats) {
                purgeme = false;
                var matches = 0;
                for (var j=0,jlen=obj.norepeat.length; j<jlen; j++) {
                    if (obj.repeats[obj.norepeat[j]]) {
                        matches += 1;
                    }
                }
                if (matches === obj.norepeat.length) {
                    purgeme = true;
                }
            }
        }
        if (purgeme) {
            var buffer = [];
            while (obj.blobs.length > obj.pos) {
                buffer.push(obj.blobs.pop());
            }
            if (buffer.length) {
                buffer.pop();
            }
            while (buffer.length) {
                obj.blobs.push(buffer.pop());
            }
        }
        this.parallel_conditional_blobs_list.pop();
    }
};

/*global CSL: true */


CSL.Util = {};

CSL.Util.Match = function () {

    this.any = function (token, state, tests) {
        return function (Item, item) {
            for (var i=0, ilen=tests.length; i < ilen; i += 1) {
                var result = tests[i](Item, item);
                if (result) {
                    return true;
                }
            }
            return false;
        };
    };

    this.none = function (token, state, tests) {
        return function (Item, item) {
            for (var i=0,ilen=tests.length;i<ilen;i+=1) {
                var result = tests[i](Item,item);
                if (result) {
                    return false;
                }
            }
            return true;
        };
    };

    this.all = function (token, state, tests) {
        return function (Item, item) {
            for (var i=0,ilen=tests.length;i<ilen;i+=1) {
                var result = tests[i](Item,item);
                if (!result) {
                    return false;
                }
            }
            return true;
        };
    };

    this[undefined] = this.all;

    this.nand = function (token, state, tests) {
        return function (Item, item) {
            for (var i=0,ilen=tests.length;i<ilen;i+=1) {
                var result = tests[i](Item,item);
                if (!result) {
                    return true;
                }
            }
            return false;
        };
    };

};

/*global CSL: true */

/*
 * Fields can be transformed by translation/transliteration, or by
 * abbreviation.  Transformations are performed in that order.
 *
 * Renderings of original, translated or transliterated content
 * (followed by abbreviation if requested) are placed in the primary
 * output slot or the (implicitly punctuated) secondary and tertiary
 * output slots according to the settings registered in the
 * state.opt['cite-lang-prefs'] arrays. The array has six segments:
 * 'persons', 'institutions', 'titles', 'journals', 'publishers', and
 * 'places'. Each segment always contains at least one item, and may
 * hold values 'orig', 'translit' or 'translat'. The array defaults to
 * a single item 'orig'.
 *
 * All multilingual variables are associated with segments,
 * with the exception of 'edition' and 'genre'. These two
 * exceptions are always rendered with the first matching
 * language form found in state.opt['locale-translit'] or, if
 * composing a sort key, state.opt['locale-sort']. No secondary
 * slot rendering is performed for this two variables.
 *
 * The balance of multilingual variables are rendered with
 * the first matching value in the transform locales spec
 * (no transform, state.opt['locale-translit'], or 
 * state.opt['locale-translat']) mapped to the target
 * slot.
 *
 * Full primary+secondary+tertiary rendering is performed only in
 * note-style citations and the bibliography.  In-text citations are
 * rendered in the primary output slot only, following the same spec
 * parameters.
 *
 *   Optional setters:
 *     .setAbbreviationFallback(); fallback flag
 *       (if true, a failed abbreviation will fallback to long)
 *
 *     .setAlternativeVariableName(): alternative variable name in Item,
 *       for use as a fallback abbreviation source
 *
 * Translation/transliteration
 *
 *   Optional setter:
 *     .setTransformFallback():
 *       default flag (if true, the original field value will be used as a fallback)
 *
 * The getTextSubField() method may be used to obtain a string transform
 * of a field, without abbreviation, as needed for setting sort keys
 * (for example).
 *
 */

CSL.Transform = function (state) {
    // Abbreviation families
    this.abbrevs = {};
    this.abbrevs["default"] = new state.sys.AbbreviationSegments();

    function getCountryOrJurisdiction(variable, normalizedKey, quashCountry) {
        var value = "";
        if (state.sys.getHumanForm) {
            if (variable === "country") {
                value = state.sys.getHumanForm(normalizedKey.toLowerCase(), false, true);
                value = value.split("|")[0];
            } else if (variable === "jurisdiction") {
                value = state.sys.getHumanForm(normalizedKey.toLowerCase(), false, true);
                if (!quashCountry) {
                    value = value.split("|").slice(1).join(", ");
                } else {
                    // Bare country name is rendered by "country", not "jurisdiction"
                    value = "";
                }
            }
	    }
	    return value;
    }
    
    // Internal function
    function abbreviate(state, tok, Item, altvar, basevalue, family_var, use_field) {
        var value = "";
        var myabbrev_family = CSL.FIELD_CATEGORY_REMAP[family_var];
        var preferredJurisdiction;
        if (!myabbrev_family) {
            return basevalue;
        }

        var variable = family_var;
        var normalizedKey = basevalue;
        if (state.sys.normalizeAbbrevsKey) {
            normalizedKey = state.sys.normalizeAbbrevsKey(family_var, basevalue);
        }
        var quashCountry = false;
        if (variable === "jurisdiction" && normalizedKey) {
            quashCountry = normalizedKey.indexOf(":") === -1;
        }
        
        // Lazy retrieval of abbreviations.
        if (state.sys.getAbbreviation) {

            if (["jurisdiction", "country", "language-name", "language-name-original"].indexOf(variable) > -1) {
                preferredJurisdiction = "default";
            } else if (Item.jurisdiction) {
                preferredJurisdiction = Item.jurisdiction;
            } else {
                preferredJurisdiction = "default";
            }
            var jurisdiction = state.transform.loadAbbreviation(preferredJurisdiction, myabbrev_family, normalizedKey, Item.type);

            // Some rules:
            // # variable === "country"
            // (1) If an abbreviation is associated with the code, then:
            //     (a) return the abbreviated form if form="short"
            // (2) Otherwise:
            //     (a) return the human-readable country name, or whatever is there if it's not a code
            // # variable === "jurisdiction"
            // (1) If !!getHumanForm(jurisdictionID, false, false):
            //     (a) If the code is top-level (i.e. a country):
            //         (i) return nothing -- this is what the "country" variable is for.
            //     (b) otherwise:
            //         (i) If an abbreviation is associated with the code, then:
            //             (A) return the abbreviated form
            //         (ii) Otherwise
            //             (A) return the human-readable form, with the country name & code removed from the front
            // (2) Otherwise:
            //     (a) abbreviate as per normal.
            // # other variables
            // (1) Abbreviate as per normal.

            if (state.transform.abbrevs[jurisdiction][myabbrev_family] && normalizedKey) {
                // Safe to test presence of abbrev against raw object in this block
                var abbrev = state.transform.abbrevs[jurisdiction][myabbrev_family][normalizedKey];
                if (tok.strings.form === "short" && abbrev) {
                    if (quashCountry) {
                        value = "";
                    } else {
                        value = abbrev;
                    }
                } else {
	                value = getCountryOrJurisdiction(variable, normalizedKey, quashCountry);
                }
            }
        }
        
        // Was for: 
        if (!value 
            && (!state.opt.development_extensions.require_explicit_legal_case_title_short || Item.type !== 'legal_case') 
            && altvar && Item[altvar] && use_field) {
            value = Item[altvar];
        }
        if (!value && !state.sys.getAbbreviation && state.sys.getHumanForm) {
	        value = getCountryOrJurisdiction(variable, normalizedKey, quashCountry);
	    }
        if (!value && !quashCountry && (!state.sys.getHumanForm || variable !== "jurisdiction")) {
            value = basevalue;
        }
        return value;
    }

    function getFieldLocale(Item,field) {
        var ret = state.opt["default-locale"][0].slice(0, 2);
        var localeRex;
        if (state.opt.development_extensions.strict_text_case_locales) {
            localeRex = new RegExp("^([a-zA-Z]{2})(?:$|-.*| .*)");
        } else {
            localeRex = new RegExp("^([a-zA-Z]{2})(?:$|-.*|.*)");
        }
        if (Item.language) {
            var m = ("" + Item.language).match(localeRex);
            if (m) {
                ret = m[1];
            } else {
                // Set garbage to "Klingon".
                ret = "tlh";
            }
        }
        if (Item.multi && Item.multi && Item.multi.main && Item.multi.main[field]) {
            ret = Item.multi.main[field];
        }
        if (!state.opt.development_extensions.strict_text_case_locales
            || state.opt.development_extensions.normalize_lang_keys_to_lowercase) {

            ret = ret.toLowerCase();
        }
        return ret;
    }

    // Internal functions
    function getTextSubField (Item, field, locale_type, use_default, stopOrig, family_var) {
        var opt, o, ret, opts;
        var usedOrig = stopOrig;
        var usingOrig = false;

        if (!Item[field]) {
            return {
                name:"",
                usedOrig:stopOrig,
                token: CSL.Util.cloneToken(this)
            };
        }
        // If form="short" is selected ("family_var" is a misnomer
        // here, it means short-form requested), and the variable
        // has a short-form partner (i.e. it is in array
        // VARIABLES_WITH_SHORT_FORM), then it is run here as *-short".
        var stickyLongForm = false;
        if (CSL.VARIABLES_WITH_SHORT_FORM.indexOf(field) > -1
            && family_var) {

            field = field + "-short";
            stickyLongForm = true;
        }
        var breakMe = false;
        var firstValue = null;
        var fieldsToTry = [];
        if (field.slice(-6) === "-short") {
            fieldsToTry.push(field);
            fieldsToTry.push(field.slice(0, -6))
        } else {
            fieldsToTry.push(field);
        }

        for (var h=0,hlen=fieldsToTry.length; h<hlen; h++) {
            var variantMatch = false;
            var field = fieldsToTry[h];

            ret = {name:"", usedOrig:stopOrig,locale:getFieldLocale(Item,field)};

            opts = state.opt[locale_type];
            var hasVal = false;

            if (locale_type === 'locale-orig') {
                if (stopOrig) {
                    ret = {name:"", usedOrig:stopOrig};
                } else {
                    ret = {name:Item[field], usedOrig:false, locale:getFieldLocale(Item,field)};
                }
                hasVal = true;
                usingOrig = true;
            } else if (use_default && ("undefined" === typeof opts || opts.length === 0)) {
                // If we want the original, or if we don't have any specific guidance and we 
                // definitely want output, just return the original value.
                var ret = {name:Item[field], usedOrig:true, locale:getFieldLocale(Item,field)};
                hasVal = true;
                usingOrig = true;
            }

            if (!hasVal) {
                for (var i = 0, ilen = opts.length; i < ilen; i += 1) {
                    opt = opts[i];
                    o = opt.split(/[\-_]/)[0];
                    if (opt && Item.multi && Item.multi._keys[field] && Item.multi._keys[field][opt]) {
                        ret.name = Item.multi._keys[field][opt];
                        ret.locale = opt;
                        hasVal = true;
                        variantMatch = true;
                        usingOrig = false;
                        break;
                    } else if (o && Item.multi && Item.multi._keys[field] && Item.multi._keys[field][o]) {
                        ret.name = Item.multi._keys[field][o];
                        ret.locale = o;
                        hasVal = true;
                        variantMatch = true;
                        usingOrig = false;
                        break;
                    }
                }
                if (!ret.name && use_default) {
                    ret = {name:Item[field], usedOrig:true, locale:getFieldLocale(Item,field)};
                    usingOrig = true;
                }
            }
            ret.token = CSL.Util.cloneToken(this);
            if (h === 0) {
                if (variantMatch) {
                    ret.found_variant_ok = true;
                }
                firstValue = ret;
                if (!stickyLongForm && ("undefined" === typeof opts || opts.length === 0)) {
                    breakMe = true;
                }
                if (variantMatch) {
                    breakMe = true;
                }
            } else {
                if (!stickyLongForm && !variantMatch && firstValue) {
                    ret = firstValue;
                    field = fieldsToTry[0];
                } else if (variantMatch) {
                    ret.found_variant_ok = true;
                }
            }
            if (["title", "container-title"].indexOf(field) > -1) {
                if (!usedOrig
                    && (!ret.token.strings["text-case"]
                        || ret.token.strings["text-case"] === "sentence"
                        || ret.token.strings["text-case"] === "normal")) {
                    var locale = state.opt.lang;
                    var lang;
                    if (usingOrig) {
                        lang = false;
                    } else {
                        lang = ret.locale;
                    }
                    var seg = field.slice(0,-5);
                    var sentenceCase = ret.token.strings["text-case"] === "sentence" ? true : false;
                    ret.name = CSL.titlecaseSentenceOrNormal(state, Item, seg, lang, sentenceCase);
                    delete ret.token.strings["text-case"];
                }
            }
            if (breakMe) {
                break;
            }
        }
        return ret;
    }
    this.getTextSubField = getTextSubField;
    
    // Setter for abbreviation lists
    // This initializes a single abbreviation based on known
    // data.
    function loadAbbreviation(jurisdiction, category, orig, itemType) {
        if (!jurisdiction) {
            jurisdiction = "default";
        }
        if (!orig) {
            if (!state.transform.abbrevs[jurisdiction]) {
                state.transform.abbrevs[jurisdiction] = new state.sys.AbbreviationSegments();
            }
            if (!state.transform.abbrevs[jurisdiction][category]) {
                state.transform.abbrevs[jurisdiction][category] = {};
            }
            return jurisdiction;
        }
        // The getAbbreviation() function should check the
        // external DB for the content key. If a value exists
        // in this[category] and no value exists in DB, the entry
        // in memory is left untouched. If a value does exist in
        // DB, the memory value is created.
        //
        // See testrunner_stdrhino.js for an example.
        if (state.sys.getAbbreviation) {
            jurisdiction = state.sys.getAbbreviation(state.opt.styleID, state.transform.abbrevs, jurisdiction, category, orig, itemType, true);
            if (!jurisdiction) {
                jurisdiction = "default";
            }
        }
        return jurisdiction;
    }
    this.loadAbbreviation = loadAbbreviation;

    function publisherCheck (tok, Item, primary, family_var) {
        var varname = tok.variables[0];
        if (state.publisherOutput && primary) {
            if (["publisher","publisher-place"].indexOf(varname) === -1) {
                return false;
            } else {
                // In this case, the publisher bundle will be rendered
                // at the close of the group, by the closing group node.
                state.publisherOutput[varname + "-token"] = tok;
                state.publisherOutput.varlist.push(varname);
                var lst = primary.split(/;\s*/);
                if (lst.length === state.publisherOutput[varname + "-list"].length) {
                    state.publisherOutput[varname + "-list"] = lst;
                }
                // Abbreviate each of the items in the list here!
                for (var i = 0, ilen = lst.length; i < ilen; i += 1) {
                    lst[i] = abbreviate(state, tok, Item, false, lst[i], family_var, true);
                }
                state.tmp[varname + "-token"] = tok;
                return true;
            }
        }
        return false;
    }


    // The name transform code is placed here to keep similar things
    // in one place.  Obviously this module could do with a little
    // tidying up.
    function quashCheck(value) {
        var m = value.match(/^!([-,_a-z]+)>>>/);
        if (m) {
            var fields = m[1].split(",");
            value = value.slice(m[0].length);
            for (var i = 0, ilen = fields.length; i < ilen; i += 1) {
                if (state.tmp.done_vars.indexOf(fields[i]) === -1) {
                    state.tmp.done_vars.push(fields[i]);
                }
            }
        }
        return value;
    }
    this.quashCheck = quashCheck;

    // Return function appropriate to selected options
    function getOutputFunction(variables, family_var, abbreviation_fallback, alternative_varname) {
        // var mytoken;

        // Set the primary_locale and secondary_locale lists appropriately.
        // No instance helper function for this; everything can be derived
        // from processor settings and rendering context.

        var localesets;
        var langPrefs = CSL.LangPrefsMap[variables[0]];
        if (!langPrefs) {
            localesets = false;
        } else {
            localesets = state.opt['cite-lang-prefs'][langPrefs];
        }

        return function (state, Item, item) {
            var primary, primary_locale, secondary, secondary_locale, tertiary, tertiary_locale, primary_tok;
            if (!variables[0] || (!Item[variables[0]] && !Item[alternative_varname])) {
                return null;
            }
            //
            // Exploring the edges here.
            // "suppress-author" for string variables (mostly titles).
            //
            if (!state.tmp.just_looking && item && item["suppress-author"]) {
                if (!state.tmp.probably_rendered_something && state.tmp.can_substitute.length() > 1) {
                    return null;
                }
            }
            var slot = {primary:false, secondary:false, tertiary:false};
            if (state.tmp.area.slice(-5) === "_sort") {
                slot.primary = 'locale-sort';
            } else {
                if (localesets && localesets.length === 1 && localesets[0] === "locale-orig") {
                    slot.primary = "locale-orig";
                    localesets = false;
                } else if (localesets && !state.tmp.multi_layout) {
                    var slotnames = ["primary", "secondary", "tertiary"];
                    for (var i = 0, ilen = slotnames.length; i < ilen; i += 1) {
                        if (localesets.length - 1 <  i) {
                            break;
                        }
                        if (localesets[i]) {
                            slot[slotnames[i]] = 'locale-' + localesets[i];
                        }
                    }
                } else {
                    slot.primary = 'locale-orig';
                }
            }
            
            if (variables[0] === "title-short" 
                || (state.tmp.area !== "bibliography"
                    && !(state.tmp.area === "citation"
                         && state.opt.xclass === "note"
                         && item && !item.position))) {
                
                slot.secondary = false;
                slot.tertiary = false;
            }

            if (state.tmp.multi_layout) {
                slot.secondary = false;
                slot.tertiary = false;
            }
            
            // Problem for multilingual: we really should be
            // checking for sanity on the basis of the output
            // strings to be actually used. (also below)
            if (state.tmp["publisher-list"]) {
                if (variables[0] === "publisher") {
                    state.tmp["publisher-token"] = this;
                } else if (variables[0] === "publisher-place") {
                    state.tmp["publisher-place-token"] = this;
                }
                return null;
            }
            // True is for transform fallback
            var res = getTextSubField.call(this, Item, variables[0], slot.primary, true, null, family_var);
            primary = res.name;
            primary_locale = res.locale;
            var primary_tok = res.token;
            var primaryUsedOrig = res.usedOrig;
            if (family_var && !res.found_variant_ok) {
                primary = abbreviate(state, primary_tok, Item, alternative_varname, primary, family_var, true);
                // Suppress subsequent use of another variable if requested by
                // hack syntax in this abbreviation short form.
                if (primary) {
                    // The abbreviate() function could use a cleanup, after Zotero correct to use title-short
                    primary = quashCheck(primary);
                }
            }
            if (publisherCheck(this, Item, primary, family_var)) {
                return null;
            }

            // No fallback for secondary and tertiary
            secondary = false;
            tertiary = false;
            var secondary_tok;
            var tertiary_tok;
            if (slot.secondary) {
                res = getTextSubField.call(this, Item, variables[0], slot.secondary, false, res.usedOrig, null, family_var);
                secondary = res.name;
                secondary_locale = res.locale;
                secondary_tok = res.token;
                if (family_var && !res.found_variant_ok) {
                    if (secondary) {
                        // The abbreviate() function could use a cleanup, after Zotero correct to use title-short
                        secondary = abbreviate(state, secondary_tok, Item, false, secondary, family_var, true);
                    }
                }
                //print("XXX secondary_locale: "+secondary_locale);
            }
            if (slot.tertiary) {
                res = getTextSubField.call(this, Item, variables[0], slot.tertiary, false, res.usedOrig, null, family_var);
                tertiary = res.name;
                tertiary_locale = res.locale;
                tertiary_tok = res.token;
                if (family_var && !res.found_variant_ok) {
                    if (tertiary) {
                        // The abbreviate() function could use a cleanup, after Zotero correct to use title-short
                        tertiary = abbreviate(state, tertiary_tok, Item, false, tertiary, family_var, true);
                    }
                }
                //print("XXX tertiary_locale: "+tertiary_locale);
            }
            
            // Decoration of primary (currently translit only) goes here
            var primaryPrefix;
            if (slot.primary === "locale-translit") {
                primaryPrefix = state.opt.citeAffixes[langPrefs][slot.primary].prefix;
            }                
            // XXX This should probably protect against italics at higher
            // levels.

            if (primaryPrefix === "<i>" && variables[0] === 'title' && !primaryUsedOrig) {
                var hasItalic = false;
                for (var i = 0, ilen = primary_tok.decorations.length; i < ilen; i += 1) {
                    if (primary_tok.decorations[i][0] === "@font-style"
                        && primary_tok.decorations[i][1] === "italic") {
                        
                        hasItalic = true;
                    }
                }
                if (!hasItalic) {
                    primary_tok.decorations.push(["@font-style", "italic"]);
                }
            }

            //print("XXX "+primary_tok.strings["text-case"]);
            if (primary_locale !== "en" && primary_tok.strings["text-case"] === "title") {
                primary_tok.strings["text-case"] = "passthrough";
            }
            
            if ("title" === variables[0]) {
                primary = CSL.demoteNoiseWords(state, primary, this["leading-noise-words"]);
            }

            if (secondary || tertiary) {

                state.output.openLevel("empty");

                // A little too aggressive maybe.
                primary_tok.strings.suffix = primary_tok.strings.suffix.replace(/[ .,]+$/,"");
                state.output.append(primary, primary_tok);
                state.tmp.probably_rendered_something = true;
                
                if (secondary) {
                    secondary_tok.strings.prefix = state.opt.citeAffixes[langPrefs][slot.secondary].prefix;
                    secondary_tok.strings.suffix = state.opt.citeAffixes[langPrefs][slot.secondary].suffix;
                    // Add a space if empty
                    if (!secondary_tok.strings.prefix) {
                        secondary_tok.strings.prefix = " ";
                    }
                    // Remove quotes
                    for (var i = secondary_tok.decorations.length - 1; i > -1; i += -1) {
                        if (['@quotes/true', '@font-style/italic', '@font-style/oblique', '@font-weight/bold'].indexOf(secondary_tok.decorations[i].join('/')) > -1) {
                            secondary_tok.decorations = secondary_tok.decorations.slice(0, i).concat(secondary_tok.decorations.slice(i + 1));
                        }
                    }
                    if (secondary_locale !== "en" && secondary_tok.strings["text-case"] === "title") {
                        secondary_tok.strings["text-case"] = "passthrough";
                    }
                    var secondary_outer = new CSL.Token();
                    secondary_outer.decorations.push(["@font-style", "normal"]);
                    secondary_outer.decorations.push(["@font-weight", "normal"]);
                    state.output.openLevel(secondary_outer);
                    state.output.append(secondary, secondary_tok);
                    state.output.closeLevel();

                    var blob_obj = state.output.current.value();
                    var blobs_pos = state.output.current.value().blobs.length - 1;
                    // Suppress supplementary multilingual info on subsequent
                    // partners of a parallel cite?
                }
                if (tertiary) {
                    tertiary_tok.strings.prefix = state.opt.citeAffixes[langPrefs][slot.tertiary].prefix;
                    tertiary_tok.strings.suffix = state.opt.citeAffixes[langPrefs][slot.tertiary].suffix;
                    // Add a space if empty
                    if (!tertiary_tok.strings.prefix) {
                        tertiary_tok.strings.prefix = " ";
                    }
                    // Remove quotes
                    for (var i = tertiary_tok.decorations.length - 1; i > -1; i += -1) {
                        if (['@quotes/true', '@font-style/italic', '@font-style/oblique', '@font-weight/bold'].indexOf(tertiary_tok.decorations[i].join('/')) > -1) {
                            tertiary_tok.decorations = tertiary_tok.decorations.slice(0, i).concat(tertiary_tok.decorations.slice(i + 1));
                        }
                    }
                    if (tertiary_locale !== "en" && tertiary_tok.strings["text-case"] === "title") {
                        tertiary_tok.strings["text-case"] = "passthrough";
                    }
                    var tertiary_outer = new CSL.Token();
                    tertiary_outer.decorations.push(["@font-style", "normal"]);
                    tertiary_outer.decorations.push(["@font-weight", "normal"]);
                    state.output.openLevel(tertiary_outer);
                    state.output.append(tertiary, tertiary_tok);
                    state.output.closeLevel();

                    var blob_obj = state.output.current.value();
                    var blobs_pos = state.output.current.value().blobs.length - 1;
                    // Suppress supplementary multilingual info on subsequent
                    // partners of a parallel cite?
                    // See note above.
                }
                state.output.closeLevel();
            } else {
                state.output.append(primary, primary_tok);
                state.tmp.probably_rendered_something = true;
            }
            return null;
        };
    }
    this.getOutputFunction = getOutputFunction;
};

/*global CSL: true */

/**
 * Style token.
 * <p>This class provides the tokens that define
 * the runtime version of the style.  The tokens are
 * instantiated by {@link CSL.Core.Build}, but the token list
 * must be post-processed with
 * {@link CSL.Core.Configure} before it can be used to generate
 * citations.</p>
 * @param {String} name The node name represented by this token.
 * @param {Int} tokentype A flag indicating whether this token
 * marks the start of a node, the end of a node, or is a singleton.
 * @class
 */
CSL.Token = function (name, tokentype, conditional) {
    /**
     * Name of the element.
     * <p>This corresponds to the element name of the
     * relevant tag in the CSL file.
     */
    this.name = name;
    /**
     * Strings and other static content specific to the element.
     */
    this.strings = {};
    this.strings.delimiter = undefined;
    this.strings.prefix = "";
    this.strings.suffix = "";
    /**
     * Formatting parameters.
     * <p>This is a placeholder at instantiation.  It is
     * replaced by the result of {@link CSL.setDecorations}
     * when the tag is created and configured during {@link CSL.Core.Build}
     * by {@link CSL.XmlToToken}.  The parameters for particular
     * formatting attributes are stored as string arrays, which
     * map to formatting functions at runtime,
     * when the output format is known.  Note that the order in which
     * parameters are registered is fixed by the constant
     * {@link CSL.FORMAT_KEY_SEQUENCE}.
     */
    this.decorations = [];
    this.variables = [];
    /**
     * Element functions.
     * <p>Functions implementing the styling behaviour of the element
     * are pushed into this array in the {@link CSL.Core.Build} phase.
     */
    this.execs = [];
    /**
     * Token type.
     * <p>This is a flag constant indicating whether the token represents
     * a start tag, an end tag, or is a singleton.</p>
     */
    this.tokentype = tokentype;

    // Conditional attributes added to bare tokens at runtime
    
    /**
     * Condition evaluator.
     * <p>This is a placeholder that receives a single function, and is
     * only relevant for a conditional branching tag (<code>if</code> or
     * <code>else-if</code>).  The function implements the argument to
     * the <code>match=</code> attribute (<code>any</code>, <code>all</code>
     * or <code>none</code>), by executing the functions registered in the
     * <code>tests</code> array (see below), and reacting accordingly.  This
     * function is invoked by the execution wrappers found in
     * {@link CSL.Engine}.</p>
     */
    // this.evaluator = false;
    /**
     * Conditions.
     * <p>Functions that evaluate to true or false, implementing
     * various posisble attributes to the conditional branching tags,
     * are registered here during {@link CSL.Core.Build}.
     * </p>
     */
    // this.tests = [];
    /**
     * Jump point on success.
     * <p>This holds the list jump point to be used when the
     * <code>evaluator</code> function of a conditional tag
     * returns true (success).  The jump index value is set during the
     * back-to-front token pass performed during {@link CSL.Core.Configure}.
     * </p>
     */
    // this.succeed = false;
    /**
     * Jump point on failure.
     * <p>This holds the list jump point to be used when the
     * <code>evaluator</code> function of a conditional tag
     * returns false (failure).  Jump index values are set during the
     * back-to-front token pass performed during {@link CSL.Core.Configure}.
     * </p>
     */
    // this.fail = false;
    /**
     * Index of next token.
     * <p>This holds the index of the next token in the
     * token list, which is the default "jump-point" for ordinary
     * processing.  Jump index values are set during the
     * back-to-front token pass performed during {@link CSL.Core.Configure}.
     * </p>
     */
    // this.next = false;
};

// Have needed this for yonks
CSL.Util.cloneToken = function (token) {
    var newtok, key, pos, len;
    if ("string" === typeof token) {
        return token;
    }
    newtok = new CSL.Token(token.name, token.tokentype);
    for (var key in token.strings) {
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
    if (token.variables) {
        newtok.variables = token.variables.slice();
    }
    // Probably overkill; this is only used for cloning formatting
    // tokens.
    if (token.execs) {
        newtok.execs = token.execs.slice();
        if (token.tests) {
            newtok.tests = token.tests.slice();
        }
    }
    return newtok;
};

/*global CSL: true */

/**
 * Ambiguous Cite Configuration Object
 * @class
 */
CSL.AmbigConfig = function () {
    this.maxvals = [];
    this.minval = 1;
    this.names = [];
    this.givens = [];
    this.year_suffix = false;
    this.disambiguate = 0;
};

/*global CSL: true */

CSL.Blob = function (str, token, levelname) {
    var len, pos, key;
    this.levelname = levelname;
    //print(levelname);
    if (token) {
        this.strings = {"prefix":"","suffix":""};
        for (var key in token.strings) {
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
    } else if (str) {
        this.blobs = [str];
    } else {
        this.blobs = [];
    }
    this.alldecor = [this.decorations];
};


CSL.Blob.prototype.push = function (blob) {
    if ("string" === typeof this.blobs) {
        CSL.error("Attempt to push blob onto string object");
    } else if (false !== blob) {
        blob.alldecor = blob.alldecor.concat(this.alldecor);
        this.blobs.push(blob);
    }
};

/*global CSL: true */

/**
 * An output instance object representing a number or a range
 *
 * with attributes next and start, and
 * methods isRange(), renderStart(), renderEnd() and renderRange().
 * At render time, the output queue will perform optional
 * collapsing of these objects in the queue, according to
 * configurable options, and apply any decorations registered
 * in the object to the output elements.
 * @namespace Range object and friends.
 */

CSL.NumericBlob = function (particle, num, mother_token, id) {
    // item id is used to assure that prefix delimiter is invoked only
    // when joining blobs across items
    this.id = id;
    this.alldecor = [];
    this.num = num;
    this.particle = particle;
    this.blobs = num.toString();
    this.status = CSL.START;
    this.strings = {};
    if (mother_token) {
        this.gender = mother_token.gender;
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

CSL.NumericBlob.prototype.checkNext = function (next,start) {
    if (start) {
        this.status = CSL.START;
        if ("object" === typeof next) {
            if (next.num === (this.num + 1)) {
                next.status = CSL.SUCCESSOR;
            } else {
                next.status = CSL.SEEN;
            }
        }
    } else if (! next || !next.num || this.type !== next.type || next.num !== (this.num + 1)) {
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
        // wakes up the correct delimiter.
        //if (this.status === CSL.SEEN) {
        //    this.status = CSL.SUCCESSOR;
        //}
    }
};


CSL.NumericBlob.prototype.checkLast = function (last) {
    // Used to adjust final non-range join
    if (this.status === CSL.SEEN 
    || (last.num !== (this.num - 1) && this.status === CSL.SUCCESSOR)) {
        this.status = CSL.SUCCESSOR;
        return true;
    }
    return false;
};

/*global CSL: true */

CSL.Util.fixDateNode = function (parent, pos, node) {
    var form, variable, datexml, subnode, partname, attr, val, prefix, suffix, children, subchildren, display, cslid;
    
    var lingo = this.cslXml.getAttributeValue(node, "lingo");

    var default_locale = this.cslXml.getAttributeValue(node, "default-locale");

    // Raise date flag, used to control inclusion of year-suffix key in sorts
    // This may be a little reckless: not sure what happens on no-date conditions
    this.build.date_key = true;

    form = this.cslXml.getAttributeValue(node, "form");
    var lingo;
    if (default_locale) {
        lingo = this.opt["default-locale"][0];
    } else {
        lingo = this.cslXml.getAttributeValue(node, "lingo");
    }

    if (!this.getDate(form, default_locale)) {
        return parent;
    }

    var dateparts = this.cslXml.getAttributeValue(node, "date-parts");

    variable = this.cslXml.getAttributeValue(node, "variable");
    prefix = this.cslXml.getAttributeValue(node, "prefix");
    suffix = this.cslXml.getAttributeValue(node, "suffix");
    display = this.cslXml.getAttributeValue(node, "display");
    cslid = this.cslXml.getAttributeValue(node, "cslid");

    //
    // Xml: Copy a node
    //
    datexml = this.cslXml.nodeCopy(this.getDate(form, default_locale));
    this.cslXml.setAttribute(datexml, 'lingo', this.opt.lang);
    this.cslXml.setAttribute(datexml, 'form', form);
    this.cslXml.setAttribute(datexml, 'date-parts', dateparts);
    this.cslXml.setAttribute(datexml, "cslid", cslid);
    //
    // Xml: Set attribute
    //
    this.cslXml.setAttribute(datexml, 'variable', variable);
    this.cslXml.setAttribute(datexml, 'default-locale', default_locale);
    //
    // Xml: Set flag
    //
    if (prefix) {
        //
        // Xml: Set attribute
        //
        this.cslXml.setAttribute(datexml, "prefix", prefix);
    }
    if (suffix) {
        //
        // Xml: Set attribute
        //
        this.cslXml.setAttribute(datexml, "suffix", suffix);
    }
    if (display) {
        //
        // Xml: Set attribute
        //
        this.cslXml.setAttribute(datexml, "display", display);
    }
    //
    // Step through any date-part children of the layout date node,
    // and lay their attributes onto the corresponding node in the
    // locale template node copy.
    //
    // tests: language_BaseLocale
    // tests: date_LocalizedTextInStyleLocaleWithTextCase
    //
    children = this.cslXml.children(datexml);
    for (var key in children) {
        subnode = children[key];
        if ("date-part" === this.cslXml.nodename(subnode)) {
            partname = this.cslXml.getAttributeValue(subnode, "name");
            if (default_locale) {
                this.cslXml.setAttributeOnNodeIdentifiedByNameAttribute(datexml, "date-part", partname, "@default-locale", "true");
            }
        }
    }

    children = this.cslXml.children(node);
    for (var key in children) {
        subnode = children[key];
        if ("date-part" === this.cslXml.nodename(subnode)) {
            partname = this.cslXml.getAttributeValue(subnode, "name");
            subchildren = this.cslXml.attributes(subnode);
            for (attr in subchildren) {
                if ("@name" === attr) {
                    continue;
                }
                if (lingo && lingo !== this.opt.lang) {
                    if (["@suffix", "@prefix", "@form"].indexOf(attr) > -1) {
                        continue;
                    }
                }
                val = subchildren[attr];
                this.cslXml.setAttributeOnNodeIdentifiedByNameAttribute(datexml, "date-part", partname, attr, val);
            }
        }
    }
    
    if ("year" === this.cslXml.getAttributeValue(node, "date-parts")) {

        //
        // Xml: Find one node by attribute and delete
        //
        this.cslXml.deleteNodeByNameAttribute(datexml, 'month');
        //
        // Xml: Find one node by attribute and delete
        //
        this.cslXml.deleteNodeByNameAttribute(datexml, 'day');
        
    } else if ("year-month" === this.cslXml.getAttributeValue(node, "date-parts")) {
        //
        // Xml: Find one node by attribute and delete
        //
        this.cslXml.deleteNodeByNameAttribute(datexml, 'day');
    } else if ("month-day" === this.cslXml.getAttributeValue(node, "date-parts")) {
        //
        // Xml: Get child nodes
        //
        var childNodes = this.cslXml.children(datexml);
        for (var i=1,ilen=this.cslXml.numberofnodes(childNodes);i<ilen;i++) {
            //
            // Xml: Get attribute value (for string comparison)
            //
            if (this.cslXml.getAttributeValue(childNodes[i], 'name') === "year") {
                //
                // Xml: Set attribute value
                //
                this.cslXml.setAttribute(childNodes[i-1], "suffix", "");
                break;
            }
        }
        //
        // Xml: Find one node by attribute and delete
        //
        this.cslXml.deleteNodeByNameAttribute(datexml, 'year');
    }
    return this.cslXml.insertChildNodeAfter(parent, node, pos, datexml);
};

/*global CSL: true */

CSL.dateMacroAsSortKey = function (state, Item) {
    CSL.dateAsSortKey.call(this, state, Item, true);
};


CSL.dateAsSortKey = function (state, Item, isMacro) {
    var dp, elem, value, e, yr, prefix, i, ilen;
    var variable = this.variables[0];
    var macroFlag = "empty";
    if (isMacro && state.tmp.extension) {
        macroFlag = "macro-with-date";
    }
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
        dp = state.fun.dateparser.parseDateToArray(dp.raw);
    } else if (dp["date-parts"]) {
        dp = state.dateParseArray(dp);
    }
    if ("undefined" === typeof dp) {
        dp = {};
    }
    for (i = 0, ilen = CSL.DATE_PARTS_INTERNAL.length; i < ilen; i += 1) {
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
            var prefix = "Y";
            if (yr[0] === "-") {
                prefix = "X";
                yr = yr.slice(1);
                yr = 9999 - parseInt(yr, 10);
            }
            state.output.append(CSL.Util.Dates[elem.slice(0, 4)].numeric(state, (prefix + yr)), macroFlag);
        } else {
            value = CSL.Util.Dates[e]["numeric-leading-zeros"](state, value);
            // Ugh.
            if (!value) {
                value = "00";
            }
            state.output.append(value, macroFlag);
        }
    }
};

CSL.Engine.prototype.dateParseArray = function (date_obj) {
    var ret, field, dp, exts;
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
            for (var i = 0, ilen = dp.length; i < ilen; i += 1) {
                for (var j = 0, jlen = CSL.DATE_PARTS.length; j < jlen; j += 1) {
                    if (isNaN(parseInt(dp[i][j], 10))) {
                        ret[(CSL.DATE_PARTS[j] + exts[i])] = undefined;
                    } else {
                        ret[(CSL.DATE_PARTS[j] + exts[i])] = parseInt(dp[i][j], 10);
                    }
                }
            }
        } else if (date_obj.hasOwnProperty(field)) {

            // XXXX: temporary workaround

            if (field === "literal" && "object" === typeof date_obj.literal && "string" === typeof date_obj.literal.part) {
                CSL.debug("Warning: fixing up weird literal date value");
                ret.literal = date_obj.literal.part;
            } else {
                ret[field] = date_obj[field];
            }
        }
    }
    return ret;
};

/*global CSL: true */

CSL.Util.Names = {};

CSL.Util.Names.compareNamesets = CSL.NameOutput.prototype._compareNamesets;

/**
 * Un-initialize a name (quash caps after first character)
 */
CSL.Util.Names.unInitialize = function (state, name) {
    var i, ilen, namelist, punctlist, ret;
    if (!name) {
        return "";
    }
    namelist = name.split(/(?:\-|\s+)/);
    punctlist = name.match(/(\-|\s+)/g);
    ret = "";
    for (i = 0, ilen = namelist.length; i < ilen; i += 1) {
        // if (CSL.ALL_ROMANESQUE_REGEXP.exec(namelist[i].slice(0,-1)) 
        //    && namelist[i] 
        //    && namelist[i] !== namelist[i].toUpperCase()) {

            // More or less like this, to address the following fault report:
            // http://forums.zotero.org/discussion/17610/apsa-problems-with-capitalization-of-mc-mac-etc/

            // Leaving the name string untouched because name capitalization is varied and wonderful.
            // https://github.com/Juris-M/citeproc-js/issues/43
            
            //namelist[i] = namelist[i].slice(0, 1) + namelist[i].slice(1, 2).toLowerCase() + namelist[i].slice(2);
        // }
        ret += namelist[i];
        if (i < ilen - 1) {
            ret += punctlist[i];
        }
    }
    return ret;
};

/**
 * Initialize a name.
 */
CSL.Util.Names.initializeWith = function (state, name, terminator, normalizeOnly) {
    var i, ilen, mm, lst, ret;
    if (!name) {
        return "";
    }
    if (!terminator) {
        terminator = "";
    }
    if (["Lord", "Lady"].indexOf(name) > -1
        || (!name.match(CSL.STARTSWITH_ROMANESQUE_REGEXP)
            && !terminator.match("%s"))) {
        return name;
    }
    var namelist = name;
    if (state.opt["initialize-with-hyphen"] === false) {
        namelist = namelist.replace(/\-/g, " ");
    }

    // Oh boy.
    // We need to suss out what is a set of initials or abbreviation,
    // so that they can be selectively normalized. Steps might be:
    //   (1) Split the string
    //   (2) Step through the string, deleting periods and, if initalize="false", then
    //       (a) note abbreviations and initials (separately).
    //   (3) If initialize="false" then:
    //       (a) Do the thing below, but only pushing terminator; or else
    //       (b) Do the thing below

    // (1) Split the string
    namelist = namelist.replace(/\s*\-\s*/g, "-").replace(/\s+/g, " ");
    namelist = namelist.replace(/-([a-z])/g, "\u2013$1");

    for (var i=namelist.length-2; i>-1; i += -1) {
        if (namelist.slice(i, i+1) === "." && namelist.slice(i+1, i+2) !== " ") {
            namelist = namelist.slice(0, i) + ". " + namelist.slice(i+1);
        }
    }

    // Workaround for Internet Explorer
    //namelist = namelist.split(/(\-|\s+)/);
    // Workaround for Internet Explorer
    mm = namelist.match(/[\-\s]+/g);
    lst = namelist.split(/[\-\s]+/);
    if (mm === null) {
        var mmm = lst[0].match(/[^\.]+$/);
        if (mmm && mmm[0].length === 1 && mmm[0] !== mmm[0].toLowerCase()) {
            lst[0] += ".";
        }
    }

    if (lst.length === 0) {
        // This doesn't make much sense, and may be impossible.
        namelist = mm;
    } else {
        namelist = [lst[0]];
        for (i = 1, ilen = lst.length; i < ilen; i += 1) {
            namelist.push(mm[i - 1]);
            namelist.push(lst[i]);
        }
    }
    lst = namelist;

    // Use doInitializeName or doNormalizeName, depending on requirements.
    if (normalizeOnly) {
        ret = CSL.Util.Names.doNormalize(state, lst, terminator);
    } else {
        ret = CSL.Util.Names.doInitialize(state, lst, terminator);
    }
    ret = ret.replace(/\u2013([a-z])/g, "-$1");
    return ret;
};

CSL.Util.Names.doNormalize = function (state, namelist, terminator) {
    var i, ilen;
    // namelist is a flat list of given-name elements and space-like separators between them
    terminator = terminator ? terminator : "";
    // Flag elements that look like abbreviations
    var isAbbrev = [];
    for (i = 0, ilen = namelist.length; i < ilen; i += 1) {
        if (namelist[i].length > 1 && namelist[i].slice(-1) === ".") {
            namelist[i] = namelist[i].slice(0, -1);
            isAbbrev.push(true);
        } else if (namelist[i].length === 1 && namelist[i].toUpperCase() === namelist[i]) {
            isAbbrev.push(true);
        } else {
            isAbbrev.push(false);
        }
    }
    // Step through the elements of the givenname array
    for (i = 0, ilen = namelist.length; i < ilen; i += 2) {
        // If the element is not an abbreviation, leave it and its trailing spaces alone
        if (isAbbrev[i]) {
            // For all elements but the last
            if (i < namelist.length - 2) {
                // Start from scratch on space-like things following an abbreviation
                namelist[i + 1] = "";

                if (!isAbbrev[i+2]) {
                    namelist[i + 1] = " ";
                }
                
                // Add the terminator to the element
                // If the following element is not a single-character abbreviation, remove a trailing zero-width non-break space, if present
                // These ops may leave some duplicate cruft in the elements and separators. This will be cleaned at the end of the function.
                if (namelist[i + 2].length > 1) {
                    namelist[i] = namelist[i] + terminator.replace(/\ufeff$/, "");
                } else {
                    namelist[i] = namelist[i] + terminator;
                }
            }
            // For the last element (if it is an abbreviation), just append the terminator
            if (i === namelist.length - 1) {
                namelist[i] = namelist[i] + terminator;
            }
        }
    }
    // Remove trailing cruft and duplicate spaces, and return
    return namelist.join("").replace(/[\u0009\u000a\u000b\u000c\u000d\u0020\ufeff\u00a0]+$/,"").replace(/\s*\-\s*/g, "-").replace(/[\u0009\u000a\u000b\u000c\u000d\u0020]+/g, " ");
};

CSL.Util.Names.doInitialize = function (state, namelist, terminator) {
    var i, ilen, m, j, jlen, lst, n;
    for (i = 0, ilen = namelist.length; i < ilen; i += 2) {
        n = namelist[i];
        if (!n) {
            continue;
        }
        m = n.match(CSL.NAME_INITIAL_REGEXP);
        if (!m && (!n.match(CSL.STARTSWITH_ROMANESQUE_REGEXP) && n.length > 1 && terminator.match("%s"))) {
            m = n.match(/(.)(.*)/);
        }
        if (m && m[2] && m[3]) {
            m[1] = m[1] + m[2];
            m[2] = "";
        }
        if (m && m[1].slice(0, 1) === m[1].slice(0, 1).toUpperCase()) {
            var extra = "";
            if (m[2]) {
                var s = "";
                lst = m[2].split("");
                for (j = 0, jlen = lst.length; j < jlen; j += 1) {
                    var c = lst[j];
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
            // namelist[i] = m[1].toLocaleUpperCase() + extra;
            namelist[i] = m[1] + extra;
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
        } else if (n.match(CSL.ROMANESQUE_REGEXP) && (!m || !m[3])) {
            namelist[i] = " " + n;
        }
    }
    var ret = namelist.join("");
    ret = ret.replace(/[\u0009\u000a\u000b\u000c\u000d\u0020\ufeff\u00a0]+$/,"").replace(/\s*\-\s*/g, "-").replace(/[\u0009\u000a\u000b\u000c\u000d\u0020]+/g, " ");
    return ret;
};

CSL.Util.Names.getRawName = function (name) {
    var ret = [];
    if (name.literal) {
        ret.push(name.literal);
    } else {
        if (name.given) {
            ret.push(name.given);
        }
        if (name.family) {
            ret.push(name.family);
        }
    }
    return ret.join(" ");
};

// deleted CSL.Util.Names.initNameSlices()
// no longer used.

// deleted CSL.Util.Names,rescueNameElements()
// apparently not used.



/*global CSL: true */

/**
 * Date mangling functions.
 * @namespace Date construction utilities
 */
CSL.Util.Dates = {};

/**
 * Year manglers
 * <p>short, long</p>
 */
CSL.Util.Dates.year = {};

/**
 * Convert year to long form
 * <p>This just passes the number back as a string.</p>
 */
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

/**
 * Crudely convert to Japanese Imperial form.
 * <p>Returns the result as a string.</p>
 */
CSL.Util.Dates.year.imperial = function (state, num, end) {
    var year = "";
    if (!num) {
        if ("boolean" === typeof num) {
            num = "";
        } else {
            num = 0;
        }
    }
    end = end ? "_end" : "";
    var month = state.tmp.date_object["month" + end];
    month = month ? ""+month : "1";
    while (month.length < 2) {
        month = "0" + month;
    }
    var day = state.tmp.date_object["day" + end];
    day = day ? ""+day : "1";
    while (day.length < 2) {
        day = "0" + day;
    }
    var date = parseInt(num + month + day, 10);
    var label;
    var offset;
    if (date >= 18680908 && date < 19120730) {
        label = '\u660e\u6cbb';
        offset = 1867;
    } else if (date >= 19120730 && date < 19261225) {
        label = '\u5927\u6b63';
        offset = 1911;
    } else if (date >= 19261225 && date < 19890108) {
        label = '\u662d\u548c';
        offset = 1925;
    } else if (date >= 19890108) {
        label = '\u5e73\u6210';
        offset = 1988;
    }
    if (label && offset) {
        var normalizedKey = label;
        if (state.sys.normalizeAbbrevsKey) {
            // The first argument does not need to specify the exact variable
            // name.
            normalizedKey = state.sys.normalizeAbbrevsKey("number", label);
        }
        if (!state.transform.abbrevs['default']['number'][normalizedKey]) {
            state.transform.loadAbbreviation('default', "number", normalizedKey);
        }
        if (state.transform.abbrevs['default']['number'][normalizedKey]) {
            label = state.transform.abbrevs['default']['number'][normalizedKey];
        }
        year = label + (num - offset);
    }
    return year;
};

/**
 * Convert year to short form
 * <p>Just crops any 4-digit year to the last two digits.</p>
 */
CSL.Util.Dates.year["short"] = function (state, num) {
    num = num.toString();
    if (num && num.length === 4) {
        return num.substr(2);
    }
};


/**
 * Convert year to short form
 * <p>Just crops any 4-digit year to the last two digits.</p>
 */
CSL.Util.Dates.year.numeric = function (state, num) {
    var m, pre;
    num = "" + num;
    var m = num.match(/([0-9]*)$/);
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


/*
 * MONTH manglers
 * normalize
 * long, short, numeric, numeric-leading-zeros
 */
CSL.Util.Dates.normalizeMonth = function (num, useSeason) {
    var ret;
    if (!num) {
        num = 0;
    }
    num = "" + num;
    if (!num.match(/^[0-9]+$/)) {
        num = 0;
    }
    num = parseInt(num, 10);
    if (useSeason) {
        var res = {stub: "month-", num: num};
        if (res.num < 1 || res.num > 24) {
            res.num = 0;
        } else {
            while (res.num > 16) {
                res.num = res.num - 4;
            }
            if (res.num > 12) {
                res.stub = "season-";
                res.num = res.num - 12;
            }
        }
        ret = res;
    } else {
        if (num < 1 || num > 12) {
            num = 0;
        }
        ret = num;
    }
    return ret;
};

CSL.Util.Dates.month = {};

/**
 * Convert month to numeric form
 * <p>This just passes the number back as a string.</p>
 */
CSL.Util.Dates.month.numeric = function (state, num) {
    var num = CSL.Util.Dates.normalizeMonth(num);
    if (!num) {
        num = "";
    }
    return num;
};

/**
 * Convert month to numeric-leading-zeros form
 * <p>This just passes the number back as string padded with zeros.</p>
 */
CSL.Util.Dates.month["numeric-leading-zeros"] = function (state, num) {
    var num = CSL.Util.Dates.normalizeMonth(num);
    if (!num) {
        num = "";
    } else {
        num = "" + num;
        while (num.length < 2) {
            num = "0" + num;
        }
    }
    return num;
};

/**
 * Convert month to long form
 * <p>This passes back the month of the locale in long form.</p>
 */

// Gender is not currently used. Is it needed?

CSL.Util.Dates.month["long"] = function (state, num, gender, forceDefaultLocale) {
    var res = CSL.Util.Dates.normalizeMonth(num, true);
    var num = res.num;
    if (!num) {
        num = "";
    } else {
        num = "" + num;
        while (num.length < 2) {
            num = "0" + num;
        }
        num = state.getTerm(res.stub + num, "long", 0, 0, false, forceDefaultLocale);
    }
    return num;
};

/**
 * Convert month to long form
 * <p>This passes back the month of the locale in short form.</p>
 */

// See above.

CSL.Util.Dates.month["short"] = function (state, num, gender, forceDefaultLocale) {
    var res = CSL.Util.Dates.normalizeMonth(num, true);
    var num = res.num;
    if (!num) {
        num = "";
    } else {
        num = "" + num;
        while (num.length < 2) {
            num = "0" + num;
        }
        num = state.getTerm(res.stub + num, "short", 0, 0, false, forceDefaultLocale);
    }
    return num;
};

/*
 * DAY manglers
 * numeric, numeric-leading-zeros, ordinal
 */
CSL.Util.Dates.day = {};

/**
 * Convert day to numeric form
 * <p>This just passes the number back as a string.</p>
 */
CSL.Util.Dates.day.numeric = function (state, num) {
    return num.toString();
};

CSL.Util.Dates.day["long"] = CSL.Util.Dates.day.numeric;

/**
 * Convert day to numeric-leading-zeros form
 * <p>This just passes the number back as a string padded with zeros.</p>
 */
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

/**
 * Convert day to ordinal form
 * <p>This will one day pass back the number as a string with the
 * ordinal suffix appropriate to the locale.  For the present,
 * it just does what is most of the time right for English.</p>
 */
CSL.Util.Dates.day.ordinal = function (state, num, gender) {
    return state.fun.ordinalizer.format(num, gender);
};

/*global CSL: true */

/**
 * Helper functions for constructing sort keys.
 * @namespace Sort key utilities
 */
CSL.Util.Sort = {};

/**
 * Strip prepositions from a string
 * <p>Used when generating sort keys.</p>
 */
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

/*global CSL: true */

CSL.Util.substituteStart = function (state, target) {
    var element_trace, display, bib_first, func, choose_start, if_start, nodetypes;
    func = function (state, Item, item) {
        if (item && item.parallel) {
            state.tmp.group_context.tip.parallel_result = item.parallel;
        }
        if (item && item.repeats && Object.keys(item.repeats).length > 0) {
            state.tmp.group_context.tip.parallel_repeats = item.repeats;
        }
        for (var i = 0, ilen = this.decorations.length; i < ilen; i += 1) {
            if ("@strip-periods" === this.decorations[i][0] && "true" === this.decorations[i][1]) {
                state.tmp.strip_periods += 1;
                break;
            }
        }
    };
    this.execs.push(func);
    if (this.decorations && state.opt.development_extensions.csl_reverse_lookup_support) {
        this.decorations.reverse();
        this.decorations.push(["@showid","true", this.cslid]);
        this.decorations.reverse();
    }
    //
    // Contains body code for both substitute and first-field/remaining-fields
    // formatting.
    //
    nodetypes = ["number", "date", "names"];
    if (("text" === this.name && !this.postponed_macro) || nodetypes.indexOf(this.name) > -1) {
        element_trace = function (state, Item, item) {
            if (state.tmp.element_trace.value() === "author" || "names" === this.name) {
                if (!state.tmp.just_looking && item && item["author-only"] && state.tmp.area !== "intext") {
                    if (!state.tmp.probably_rendered_something) {
                    } else {
                        state.tmp.element_trace.push("suppress-me");
                    }
                }
                if (!state.tmp.just_looking && item && item["suppress-author"]) {
                    if (!state.tmp.probably_rendered_something) {
                        state.tmp.element_trace.push("suppress-me");
                    }
                }
            }
            else if ("date" === this.name) {
                if (!state.tmp.just_looking && item && item["author-only"] && state.tmp.area !== "intext") {
                    if (state.tmp.probably_rendered_something) {
                        state.tmp.element_trace.push("suppress-me");
                    }
                }
                /*
                if (!state.tmp.just_looking && item && item["suppress-author"]) {
                    if (state.tmp.probably_rendered_something) {
                        //state.tmp.element_trace.push("suppress-me");
                    }
                }
                */
            } else {
                if (!state.tmp.just_looking && item && item["author-only"] && state.tmp.area !== "intext") {
                    // XXX can_block_substitute probably is doing nothing here. The value is always true.
                    if (!state.tmp.probably_rendered_something && state.tmp.can_block_substitute) {
                    } else {
                        state.tmp.element_trace.push("suppress-me");
                    }
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
        //
        // The markup formerly known as @bibliography/first
        //
        // Separate second-field-align from the generic display logic.
        // There will be some code replication, but not in the
        // assembled style.
        //
        if (state.build.area === "bibliography" && state.bibliography.opt["second-field-align"]) {
            bib_first = new CSL.Token("group", CSL.START);
            bib_first.decorations = [["@display", "left-margin"]];
            func = function (state, Item) {
                if (!state.tmp.render_seen) {
                    bib_first.strings.first_blob = Item.id;
                    state.output.startTag("bib_first", bib_first);
                }
            };
            bib_first.execs.push(func);
            target.push(bib_first);
        } else if (CSL.DISPLAY_CLASSES.indexOf(display) > -1) {
            bib_first = new CSL.Token("group", CSL.START);
            bib_first.decorations = [["@display", display]];
            func = function (state, Item) {
                bib_first.strings.first_blob = Item.id;
                state.output.startTag("bib_first", bib_first);
            };
            bib_first.execs.push(func);
            target.push(bib_first);
        }
        state.build.cls = display;
    }
    state.build.render_nesting_level += 1;
    // Should this be render_nesting_level, with the increment
    // below? ... ?
    if (state.build.substitute_level.value() === 1) {
        //
        // All top-level elements in a substitute environment get
        // wrapped in conditionals.  The substitute_level variable
        // is a stack, because spanned names elements (with their
        // own substitute environments) can be nested inside
        // a substitute environment.
        //
        // (okay, we use conditionals a lot more than that.
        // we slot them in for author-only as well...)
        choose_start = new CSL.Token("choose", CSL.START);
        CSL.Node.choose.build.call(choose_start, state, target);
        if_start = new CSL.Token("if", CSL.START);
        //
        // Set a test of the shadow if token to skip this
        // macro if we have acquired a name value.

        // check for variable
        func = function () {
            if (state.tmp.can_substitute.value()) {
                return true;
            }
            return false;
        };
        if_start.tests ? {} : if_start.tests = [];
        if_start.tests.push(func);
        if_start.test = state.fun.match.any(this, state, if_start.tests);
        target.push(if_start);
    }

    if (state.sys.variableWrapper
        && this.variables_real
        && this.variables_real.length) {

        func = function (state, Item, item) {
            if (!state.tmp.just_looking && !state.tmp.suppress_decorations) {
                // Attach item data and variable names.
                // Do with them what you will.
                var variable_entry = new CSL.Token("text", CSL.START);
                variable_entry.decorations = [["@showid", "true"]];
                state.output.startTag("variable_entry", variable_entry);
                var position = null;
                if (item) {
                    position = item.position;
                }
                if (!position) {
                    position = 0;
                }
                var positionMap = [
                    "first",
                    "subsequent",
                    "ibid",
                    "ibid-with-locator"
                ];
                var noteNumber = 0;
                if (item && item.noteIndex) {
                    noteNumber = item.noteIndex;
                }
                var firstReferenceNoteNumber = 0;
                if (item && item['first-reference-note-number']) {
                    firstReferenceNoteNumber = item['first-reference-note-number'];
                }
                var citationNumber = 0;
                // XXX Will this EVER happen?
                if (item && item['citation-number']) {
                    citationNumber = item['citation-number'];
                }
                var index = 0;
                if (item && item.index) {
                    index = item.index;
                }
                var params = {
                    itemData: Item,
                    variableNames: this.variables,
                    context: state.tmp.area,
                    xclass: state.opt.xclass,
                    position: positionMap[position],
                    "note-number": noteNumber,
                    "first-reference-note-number": firstReferenceNoteNumber,
                    "citation-number": citationNumber,
                    "index": index,
                    "mode": state.opt.mode
                };
                state.output.current.value().params = params;
            }
        };
        this.execs.push(func);
    }
};


CSL.Util.substituteEnd = function (state, target) {
    var func, bib_first_end, bib_other, if_end, choose_end, author_substitute, str;

    if (state.sys.variableWrapper
        && (this.hasVariable || (this.variables_real && this.variables_real.length))) {
        
        func = function (state) {
            if (!state.tmp.just_looking && !state.tmp.suppress_decorations) {
                state.output.endTag("variable_entry");
            }
        };
        this.execs.push(func);
    }

    func = function (state) {
        for (var i = 0, ilen = this.decorations.length; i < ilen; i += 1) {
            if ("@strip-periods" === this.decorations[i][0] && "true" === this.decorations[i][1]) {
                state.tmp.strip_periods += -1;
                break;
            }
        }
    };
    this.execs.push(func);

    state.build.render_nesting_level += -1;
    if (state.build.render_nesting_level === 0) {
        if (state.build.cls) {
            func = function (state) {
                state.output.endTag("bib_first");
            };
            this.execs.push(func);
            state.build.cls = false;
        } else if (state.build.area === "bibliography" && state.bibliography.opt["second-field-align"]) {
            bib_first_end = new CSL.Token("group", CSL.END);
            // first func end
            func = function (state) {
                if (!state.tmp.render_seen) {
                    state.output.endTag("bib_first"); // closes bib_first
                }
            };
            bib_first_end.execs.push(func);
            target.push(bib_first_end);
            bib_other = new CSL.Token("group", CSL.START);
            bib_other.decorations = [["@display", "right-inline"]];
            func = function (state) {
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

    if ("names" === this.name || ("text" === this.name && this.variables_real !== "title")) {
        author_substitute = new CSL.Token("text", CSL.SINGLETON);
        func = function (state, Item) {
            if (state.tmp.area !== "bibliography") {
                return;
            }
            if ("string" !== typeof state.bibliography.opt["subsequent-author-substitute"]) {
                return;
            }
            if (this.variables_real && !Item[this.variables_real]) {
                return;
            }
            if (state.tmp.substituted_variable !== this.variables_real) {
                return;
            }

            var subrule = state.bibliography.opt["subsequent-author-substitute-rule"];
            var i, ilen;
            //var text_esc = CSL.getSafeEscape(state);
            var printing = !state.tmp.suppress_decorations;
            if (printing && state.tmp.subsequent_author_substitute_ok) {
                if (state.tmp.rendered_name) {
                    if ("partial-each" === subrule || "partial-first" === subrule) {
                        var dosub = true;
                        var rendered_name = [];
                        // This is a wee bit risky, as we're assuming that the name
                        // children and the list of stringified names are congruent.
                        // That *should* always be true, but you never know.
                        for (i = 0, ilen = state.tmp.name_node.children.length; i < ilen; i += 1) {
                            var name = state.tmp.rendered_name[i];
                            if (dosub
                                && state.tmp.last_rendered_name && state.tmp.last_rendered_name.length > (i - 1)
                                && name && !name.localeCompare(state.tmp.last_rendered_name[i])) {
                                
                                str = new CSL.Blob(state[state.tmp.area].opt["subsequent-author-substitute"]);
                                state.tmp.name_node.children[i].blobs = [str];
                                if ("partial-first" === subrule) {
                                    dosub = false;
                                }
                            } else {
                                dosub = false;
                            }
                            rendered_name.push(name);
                        }
                        // might want to slice this?
                        state.tmp.last_rendered_name = rendered_name;
                    } else if ("complete-each" === subrule) {
                        var rendered_name = state.tmp.rendered_name.join(",");
                        if (rendered_name) {
                            if (state.tmp.last_rendered_name && !rendered_name.localeCompare(state.tmp.last_rendered_name)) {
                                for (i = 0, ilen = state.tmp.name_node.children.length; i < ilen; i += 1) {
                                    str = new CSL.Blob(state[state.tmp.area].opt["subsequent-author-substitute"]);
                                    state.tmp.name_node.children[i].blobs = [str];
                                }
                            }
                            state.tmp.last_rendered_name = rendered_name;
                        }
                    } else {
                        var rendered_name = state.tmp.rendered_name.join(",");
                        if (rendered_name) {
                            if (state.tmp.last_rendered_name && !rendered_name.localeCompare(state.tmp.last_rendered_name)) {
                                str = new CSL.Blob(state[state.tmp.area].opt["subsequent-author-substitute"]);
                                if (state.tmp.label_blob) {
                                    state.tmp.name_node.top.blobs = [str,state.tmp.label_blob];
                                } else if (state.tmp.name_node.top.blobs.length) {
                                    state.tmp.name_node.top.blobs[0].blobs = [str];
                                } else {
                                    state.tmp.name_node.top.blobs = [str];
                                }
                                state.tmp.substituted_variable = this.variables_real;
                            }
                            state.tmp.last_rendered_name = rendered_name;
                        }
                    }
                    state.tmp.subsequent_author_substitute_ok = false;
                }
            }
        };
        this.execs.push(func);
    }

    if (("text" === this.name && !this.postponed_macro) || ["number", "date", "names"].indexOf(this.name) > -1) {
        // element trace
        func = function (state, Item) {
            // element_trace is a mess, but it's trying to do something simple.
            // A queue append is done, and element_trace.value() returns "suppress-me"
            // the append is aborted. That's it.
            // It seems only to be used on numeric elements of numeric styles ATM.
            // If used only for that purpose, it could be greatly simplified.
            // If cleaned up, it could do more interesting things, like control
            // the suppression of names set later than first position.
            if (state.tmp.element_trace.mystack.length>1) {
                state.tmp.element_trace.pop();
            }
        };
        this.execs.push(func);
    }
};

/*global CSL: true */

CSL.Util.padding = function (num) {
    var m = num.match(/\s*(-{0,1}[0-9]+)/);
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
};

CSL.Util.LongOrdinalizer = function () {};

CSL.Util.LongOrdinalizer.prototype.init = function (state) {
    this.state = state;
};

CSL.Util.LongOrdinalizer.prototype.format = function (num, gender) {
    if (num < 10) {
        num = "0" + num;
    }
    // Argument true means "loose".
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
    // Probably too optimistic -- what if only renders in _sort?
    this.state.tmp.cite_renders_content = true;
    return ret;
};


CSL.Util.Ordinalizer = function (state) {
    this.state = state;
    this.suffixes = {};
};

CSL.Util.Ordinalizer.prototype.init = function () {
    if (!this.suffixes[this.state.opt.lang]) {
        this.suffixes[this.state.opt.lang] = {};
        for (var i = 0, ilen = 3; i < ilen; i += 1) {
            var gender = [undefined, "masculine", "feminine"][i];
            this.suffixes[this.state.opt.lang][gender] = [];
            for (var j = 1; j < 5; j += 1) {
                var ordinal = this.state.getTerm("ordinal-0" + j, "long", false, gender);
                if ("undefined" === typeof ordinal) {
                    delete this.suffixes[this.state.opt.lang][gender];
                    break;
                }
                this.suffixes[this.state.opt.lang][gender].push(ordinal);
            }
        }
    }
};

CSL.Util.Ordinalizer.prototype.format = function (num, gender) {
    var str;
    num = parseInt(num, 10);
    str = "" + num;
    var suffix = "";
    var trygenders = [];
    if (gender) {
        trygenders.push(gender);
    }
    trygenders.push("neuter");
    if (this.state.locale[this.state.opt.lang].ord["1.0.1"]) {
        suffix = this.state.getTerm("ordinal",false,0,gender);
        var trygender;
        for (var i = 0, ilen = trygenders.length; i < ilen; i += 1) {
            trygender = trygenders[i];
            var ordinfo = this.state.locale[this.state.opt.lang].ord["1.0.1"];
            if (ordinfo["whole-number"][str] && ordinfo["whole-number"][str][trygender]) {
                suffix = this.state.getTerm(this.state.locale[this.state.opt.lang].ord["1.0.1"]["whole-number"][str][trygender],false,0,gender);
            } else if (ordinfo["last-two-digits"][str.slice(str.length - 2)] && ordinfo["last-two-digits"][str.slice(str.length - 2)][trygender]) {
                suffix = this.state.getTerm(this.state.locale[this.state.opt.lang].ord["1.0.1"]["last-two-digits"][str.slice(str.length - 2)][trygender],false,0,gender);
            } else if (ordinfo["last-digit"][str.slice(str.length - 1)] && ordinfo["last-digit"][str.slice(str.length - 1)][trygender]) {
                suffix = this.state.getTerm(this.state.locale[this.state.opt.lang].ord["1.0.1"]["last-digit"][str.slice(str.length - 1)][trygender],false,0,gender);
            }
            if (suffix) {
                break;
            }
        }
    } else {
        if (!gender) {
            // XXX hack to prevent crash on CSL 1.0 styles.
            // Reported by Carles.
            gender = undefined;
        }
        this.state.fun.ordinalizer.init();
        if ((num / 10) % 10 === 1 || (num > 10 && num < 20)) {
            suffix = this.suffixes[this.state.opt.lang][gender][3];
        } else if (num % 10 === 1 && num % 100 !== 11) {
            suffix = this.suffixes[this.state.opt.lang][gender][0];
        } else if (num % 10 === 2 && num % 100 !== 12) {
            suffix = this.suffixes[this.state.opt.lang][gender][1];
        } else if (num % 10 === 3 && num % 100 !== 13) {
            suffix = this.suffixes[this.state.opt.lang][gender][2];
        } else {
            suffix = this.suffixes[this.state.opt.lang][gender][3];
        }
    }
    str = str += suffix;
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


/**
 * Create a suffix formed from a list of arbitrary characters of arbitrary length.
 * <p>This is a <i>lot</i> harder than it seems.</p>
 */
CSL.Util.Suffixator = function (slist) {
    if (!slist) {
        slist = CSL.SUFFIX_CHARS;
    }
    this.slist = slist.split(",");
};

/**
 * The format method.
 * <p>This method is used in generating ranges.  Every numeric
 * formatter (of which Suffixator is one) must be an instantiated
 * object with such a "format" method.</p>
 */

CSL.Util.Suffixator.prototype.format = function (N) {
    // Many thanks to Avram Lyon for this code, and good
    // riddance to the several functions that it replaces.
    var X;
    N += 1;
    var key = "";
    do {
        X = ((N % 26) === 0) ? 26 : (N % 26);
        var key = this.slist[X-1] + key;
        N = (N - X) / 26;
    } while ( N !== 0 );
    return key;
};


CSL.Engine.prototype.processNumber = function (node, ItemObject, variable) {
    //print("** processNumber() ItemObject[variable]="+ItemObject[variable]);
    var val;

    var me = this;
    
    var fullformAnd = ",\\s+and\\s+|\\s+and\\s+";
    if (this.opt.lang.slice(0, 2) !== "en") {
        fullformAnd += "|,\\s+" + this.getTerm("and") + "\\s+|\\s+" + this.getTerm("and") + "\\s+";
    }
    var symbolAnd = "\\s*&\\s*";
    var andRex = new RegExp("^" + symbolAnd+ "$");
    var joinerMatchRex = new RegExp("(" + symbolAnd + "|" + fullformAnd + "|;\\s+|,\\s+|\\s*\\\\*[\\-\\u2013]+\\s*)", "g");
    var joinerSplitRex = new RegExp("(?:" + symbolAnd + "|" + fullformAnd + "|;\\s+|,\\s+|\\s*\\\\*[\\-\\u2013]+\\s*|\\s*&\\s*)");

    // This guesses whether the symbol form is defined or not.
    // It's the best we can do, because when locales are built, all of the
    // holes are filled explictly with fallback values: the symbol form is never undefined.
    var localeAnd = this.getTerm("and");
    var localeAmpersand = this.getTerm("and", "symbol");
    if (localeAnd === localeAmpersand) {
        localeAmpersand = "&";
    }
    
    // XXXX shadow_numbers should carry an array of objects with
    // XXXX full data for each. The test of a number should be
    // XXXX a separate function, possibly supported by a splitter
    // XXXX method also used here. Keep code for each action in one place,
    // XXXX to prevent debugging from becoming a nightmare.

    // The capture pattern below would apply affixes to all sub-elements,
    // which is not what we want. Sub-elements should nest within, or
    // affixes should be edited. The latter is probably easier to handle.
    
    // values = [
    //   {
    //     label: "sec.",
    //     label-form: "plural",
    //     value: 100,
    //     styling: [object],
    //     numeric: true
    //     joiningSuffix: " & ",
    //   },
    //   {
    //     label: "sec.",
    //     label-form: "none",
    //     value: 103,
    //     styling: [object],
    //     numeric: true,
    //     joiningSuffix: ""
    //   }
    // ]
    
    function normalizeFieldValue(str) {
        str = str.trim();
        var m = str.match(/^([^ ]+)/);
        if (m && !CSL.STATUTE_SUBDIV_STRINGS[m[1]]) {
            var embeddedLabel = null;
            if (["locator", "locator-extra"].indexOf(variable) > -1) {
                if (ItemObject.label) {
                    embeddedLabel = CSL.STATUTE_SUBDIV_STRINGS_REVERSE[ItemObject.label];
                } else {
                    embeddedLabel = "p.";
                }
            } else {
                embeddedLabel = CSL.STATUTE_SUBDIV_STRINGS_REVERSE[variable];
            }
            if (embeddedLabel) {
                str = embeddedLabel + " " + str;
            }
        }
        return str;
    }
    

    function composeNumberInfo(origLabel, label, val, joiningSuffix) {
        joiningSuffix = joiningSuffix ? joiningSuffix : "";
        var info = {};

        if (!label && !CSL.STATUTE_SUBDIV_STRINGS_REVERSE[variable]) {
                label = "var:"+variable;
        }
        
        if (label) {
            var m = label.match(/(\s*)([^\s]+)(\s*)/);
            info.label = m[2];
            info.origLabel = origLabel;
            info.labelSuffix = m[3] ? m[3] : "";
            info.plural = 0;
            info.labelVisibility = false;
        }
        
        var m = val.match(/^([0-9]*[a-zA-Z]+0*)?([0-9]+(?:[a-zA-Z]*|[-,a-zA-Z]+))$/);
        //var m = val.match(/^([0-9]*[a-zA-Z]0*)([0-9]+(?:[a-zA-Z]*|[-,a-zA-Z]+))$/);
        if (m) {
            info.particle = m[1] ? m[1] : "";
            info.value = m[2];
        } else {
            info.particle = "";
            info.value = val;
        }
        info.joiningSuffix = joiningSuffix.replace(/\s*-\s*/, "-");
        return info;
    }

    function fixupSubsections(elems) {
        // This catches things like p. 12a-c, recombining content to yield
        // numeric true despite the hyphen.
        for (var i=elems.length-2;i>-1;i-=2) {
            if (elems[i] === "-"
               && elems[i-1].match(/^(?:(?:[a-z]|[a-z][a-z]|[a-z][a-z][a-z]|[a-z][a-z][a-z][a-z])\.  *)*[0-9]+[,a-zA-Z]+$/)
               && elems[i+1].match(/^[,a-zA-Z]+$/)) {
                elems[i-1] = elems.slice(i-1,i+2).join("");
                elems = elems.slice(0,i).concat(elems.slice(i+2));
            }
        }
        return elems;
    }

    function parseString(str, defaultLabel) {
        defaultLabel = defaultLabel ? defaultLabel : "";
        
        str = normalizeFieldValue(str, defaultLabel);

        // Split chunks and collate delimiters.
        var elems = [];
        var m = str.match(joinerMatchRex);
        if (m) {
            for (var i=0, ilen=m.length; i<ilen; i++) {
                if (m[i].match(andRex)) {
                    m[i] = " " + localeAmpersand + " ";
                }
            }
            var lst = str.split(joinerSplitRex);
            var recombine = false;
            for (var i in lst) {
                if (("" + lst[i]).replace(/^[a-z]\.\s+/, "").match(/[^\s0-9ivxlcmIVXLCM]/)) {
                    //recombine = true;
                    break;
                }
            }
            if (recombine) {
                elems = [str];
            } else {
                for (var i=0,ilen=lst.length-1; i<ilen; i++) {
                    elems.push(lst[i]);
                    elems.push(m[i]);
                }
                elems.push(lst[lst.length-1]);
                //print("ELEMS: "+elems);
                elems = fixupSubsections(elems);
                //print("  fixup: "+elems);
            }
        } else {
            var elems = [str];
        }
        // Split elements within each chunk build list of value objects.
        var values = [];
        var label = defaultLabel;
        var origLabel = "";
        for (var i=0,ilen=elems.length;i<ilen;i += 2) {
            var m = elems[i].match(/((?:^| )(?:[a-z]|[a-z][a-z]|[a-z][a-z][a-z]|[a-z][a-z][a-z][a-z])(?:\.| ) *)/g);
            if (m) {
                var lst = elems[i].split(/(?:(?:^| )(?:[a-z]|[a-z][a-z]|[a-z][a-z][a-z]|[a-z][a-z][a-z][a-z])(?:\.| ) *)/);
                // Head off disaster by merging parsed labels on non-numeric values into content
                for (var j=lst.length-1;j>0;j--) {
                    if (lst[j-1] && (!lst[j].match(/^[0-9]+([-;,:a-zA-Z]*)$/) || !lst[j-1].match(/^[0-9]+([-;,:a-zA-Z]*)$/))) {
                        lst[j-1] = lst[j-1] + m[j-1] + lst[j];
                        lst = lst.slice(0,j).concat(lst.slice(j+1));
                        m = m.slice(0,j-1).concat(m.slice(j));
                    }
                }
                // merge bad leading label into content
                if (m.length > 0) {
                    var slug = m[0].trim();
                    var notAlabel = !CSL.STATUTE_SUBDIV_STRINGS[slug]
                        || !me.getTerm(CSL.STATUTE_SUBDIV_STRINGS[slug])
                        || (["locator", "number", "locator-extra"].indexOf(variable) === -1 && CSL.STATUTE_SUBDIV_STRINGS[slug] !== variable);
                    if (notAlabel) {
                        if (i === 0) {
                            m = m.slice(1);
                            lst[0] = lst[0] + " " + slug + " " + lst[1];
                            lst = lst.slice(0,1).concat(lst.slice(2));
                        }
                    } else {
                        origLabel = slug;
                    }
                }

                for (var j=0,jlen=lst.length; j<jlen; j++) {
                    if (lst[j] || j === (lst.length-1)) {
                        var filteredOrigLabel;
                        label = m[j-1] ? m[j-1] : label;
                        if (origLabel === label.trim()) {
                            filteredOrigLabel = "";
                        } else {
                            filteredOrigLabel = origLabel;
                        }
                        //var origLabel = j > 1 ? m[j-1] : "";
                        str = lst[j] ? lst[j].trim() : "";
                        if (j === (lst.length-1)) {
                            values.push(composeNumberInfo(filteredOrigLabel, label, str, elems[i+1]));
                        } else {
                            values.push(composeNumberInfo(filteredOrigLabel, label, str));
                        }
                    }
                }
            } else {
                var filteredOrigLabel;
                if (origLabel === label.trim()) {
                    filteredOrigLabel = "";
                } else {
                    filteredOrigLabel = origLabel;
                }
                values.push(composeNumberInfo(filteredOrigLabel, label, elems[i], elems[i+1]));
            }
        }
        return values;
    }

    function setSpaces(values) {
        // Add space joins (is this really right?)
        for (var i=0,ilen=values.length-1;i<ilen;i++) {
            if (!values[i].joiningSuffix && values[i+1].label) {
                values[i].joiningSuffix = " ";
            }
        }
    }

    function fixNumericAndCount(values, i, currentLabelInfo) {
        var master = values[currentLabelInfo.pos];
        var val = values[i].value;
        var isEscapedHyphen = master.joiningSuffix === "\\-";
        if (val.particle && val.particle !== master.particle) {
            currentLabelInfo.collapsible = false;
        }
        var mVal = val.match(/^[0-9]+([-,:a-zA-Z]*)$/);
        var mCurrentLabel = master.value.match(/^[0-9]+([-,:a-zA-Z]*)$/);
        if (!val || !mVal || !mCurrentLabel || isEscapedHyphen) {
            currentLabelInfo.collapsible = false;
            if (!val || !mCurrentLabel) {
                currentLabelInfo.numeric = false;
            }
            if (isEscapedHyphen) {
                currentLabelInfo.count--;
            }
        }
        if ((mVal && mVal[1]) || (mCurrentLabel && mCurrentLabel[1])) {
            currentLabelInfo.collapsible = false;
        }
        if (undefined === values[i].collapsible) {
            for (var j=i,jlen=i+currentLabelInfo.count;j<jlen;j++) {
                if (isNaN(parseInt(values[j].value)) && !values[j].value.match(/^[ivxlcmIVXLCM]+$/)) {
                    values[j].collapsible = false;
                } else {
                    values[j].collapsible = true;
                }
            }
            currentLabelInfo.collapsible = values[i].collapsible;
        }
        var isCollapsible = currentLabelInfo.collapsible;
        for (var j=currentLabelInfo.pos,jlen=(currentLabelInfo.pos + currentLabelInfo.count); j<jlen; j++) {
            if (currentLabelInfo.count > 1 && isCollapsible) {
                values[j].plural = 1;
            }
            values[j].numeric = currentLabelInfo.numeric;
            values[j].collapsible = currentLabelInfo.collapsible;
        }
    }

    function fixLabelVisibility(values, groupStartPos, currentLabelInfo) {
        if (currentLabelInfo.label.slice(0, 4) !== "var:") {
            if (currentLabelInfo.pos === 0) {
                if (["locator", "number", "locator-extra"].indexOf(variable) > -1) {
                    // Actually, shouldn't we do this always?
                    if (!me.getTerm(CSL.STATUTE_SUBDIV_STRINGS[currentLabelInfo.label])) {
                        values[currentLabelInfo.pos].labelVisibility = true;
                    }
                }
                // If there is an explicit
                // label embedded at the start of a field that
                // does not match the context, it should be
                // marked for rendering.
                if (["locator", "number", "locator-extra"].indexOf(variable) === -1) {
                    if (CSL.STATUTE_SUBDIV_STRINGS[currentLabelInfo.label] !== variable) {
                        values[0].labelVisibility = true;
                    }
                }
            } else {
                // Also, mark initial mid-field labels for
                // rendering.
                //if (values[i-1].label !== values[i].label && currentLabelInfo.label.slice(0, 4) !== "var:") {
                values[currentLabelInfo.pos].labelVisibility = true;
                //}
            }
        }
    }
    
    function setPluralsAndNumerics(values) {
        if (values.length === 0) {
            return;
        }
        var groupStartPos = 0;
        var groupCount = 1;
        
        for (var i=1,ilen=values.length;i<ilen;i++) {
            var lastVal = values[i-1];
            var thisVal = values[i];
            if (lastVal.label === thisVal.label && lastVal.particle === lastVal.particle) {
                groupCount++;
            } else {
                var currentLabelInfo = JSON.parse(JSON.stringify(values[groupStartPos]));
                currentLabelInfo.pos = groupStartPos;
                currentLabelInfo.count = groupCount;
                currentLabelInfo.numeric = true;
                fixNumericAndCount(values, groupStartPos, currentLabelInfo);
                if (lastVal.label !== thisVal.label) {
                    fixLabelVisibility(values, groupStartPos, currentLabelInfo);
                }
                groupStartPos = i;
                groupCount = 1;
            }
        }
        // Not sure why this repetition is necessary?
        var currentLabelInfo = JSON.parse(JSON.stringify(values[groupStartPos]));
        currentLabelInfo.pos = groupStartPos;
        currentLabelInfo.count = groupCount;
        currentLabelInfo.numeric = true;
        fixNumericAndCount(values, groupStartPos, currentLabelInfo);
        fixLabelVisibility(values, groupStartPos, currentLabelInfo);
        if (values.length && values[0].numeric && variable.slice(0, 10) === "number-of-") {
            if (parseInt(ItemObject[variable], 10) > 1) {
                values[0].plural = 1;
            }
        }
    }        

    function stripHyphenBackslash(joiningSuffix) {
        return joiningSuffix.replace("\\-", "-");
    }

    function setStyling(values) {
        var masterNode = CSL.Util.cloneToken(node);
        var masterStyling = new CSL.Token();
        if (!me.tmp.just_looking) {
            // Per discussion @ https://discourse.citationstyles.org/t/formatting-attributes-and-hyphen/1518
            masterStyling.decorations = masterNode.decorations;
            masterNode.decorations = [];
            //for (var j=masterNode.decorations.length-1;j>-1;j--) {
            //    if (masterNode.decorations[j][0] === "@quotes") {
            //        // Add to styling
            //        masterStyling.decorations = masterStyling.decorations.concat(masterNode.decorations.slice(j, j+1));
            //        // Remove from node
            //        masterNode.decorations = masterNode.decorations.slice(0, j).concat(masterNode.decorations.slice(j+1));
            //    }
            //}
            masterStyling.strings.prefix = masterNode.strings.prefix;
            masterNode.strings.prefix = "";
            masterStyling.strings.suffix = masterNode.strings.suffix;
            masterNode.strings.suffix = "";
        }
        var masterLabel = values.length ? values[0].label : null;
        if (values.length) {
            for (var i=0,ilen=values.length; i<ilen; i++) {
                var val = values[i];
                // Clone node, make styling parameters on each instance sane.
                var newnode = CSL.Util.cloneToken(masterNode);
                newnode.gender = node.gender;
                if (masterLabel === val.label) {
                    newnode.formatter = node.formatter;
                }
                if (val.numeric) {
                    newnode.successor_prefix = val.successor_prefix;
                }
                newnode.strings.suffix = newnode.strings.suffix + stripHyphenBackslash(val.joiningSuffix);
                val.styling = newnode;
            }
            if (!me.tmp.just_looking) {
                if (values[0].value.slice(0,1) === "\"" && values[values.length-1].value.slice(-1) === "\"") {
                    values[0].value = values[0].value.slice(1);
                    values[values.length-1].value = values[values.length-1].value.slice(0,-1);
                    masterStyling.decorations.push(["@quotes", true]);
                }
            }
        }
        return masterStyling;
    }

    function checkTerm(variable, val) {
        var ret = true;
        if (["locator", "locator-extra"].indexOf(variable) > -1) {
            var label;
            if (val.origLabel) {
                label = val.origLabel;
            } else {
                label = val.label;
            }
            ret = !!me.getTerm(CSL.STATUTE_SUBDIV_STRINGS[label]);
        }
        return ret;
    }

    function checkPage(variable, val) {
        return variable === "page" 
            || (["locator", "locator-extra"].indexOf(variable) > -1 && (["p."].indexOf(val.label) > -1 || ["p."].indexOf(val.origLabel) > -1));
    }
    
    function fixupRangeDelimiter(variable, val, rangeDelimiter, isNumeric) {
        var isPage = checkPage(variable, val);
        var hasTerm = checkTerm(variable, val);
        if (hasTerm && rangeDelimiter === "-") {
            if (isNumeric) {
                if (isPage || ["locator", "locator-extra", "issue", "volume", "edition", "number"].indexOf(variable) > -1) {
                    rangeDelimiter = me.getTerm("page-range-delimiter");
                    if (!rangeDelimiter) {
                        rangeDelimiter = "\u2013";
                    }
                }
                if (variable === "collection-number") {
                    rangeDelimiter = me.getTerm("year-range-delimiter");
                    if (!rangeDelimiter) {
                        rangeDelimiter = "\u2013";
                    }
                }
            }
        }
        //if (rangeDelimiter === "\\-") {
        //    rangeDelimiter = "-";
        //}
        return rangeDelimiter;
    }

    function manglePageNumbers(values, i, currentInfo) {
        if (i<1) {
            return;
        }
        if (currentInfo.count !== 2) {
            return;
        }
        if (values[i-1].particle !== values[i].particle) {
            return;
        }
        if (values[i-1].joiningSuffix !== "-") {
            currentInfo.count = 1;
            return;
        }
        if (!me.opt["page-range-format"] && (parseInt(values[i-1].value, 10) > parseInt(values[i].value, 10))) {
            values[i-1].joiningSuffix = fixupRangeDelimiter(variable, values[i], values[i-1].joiningSuffix, true);
            return;
        }
        var val = values[i];

        var isPage = checkPage(variable, val);
        var str;
        if (isPage && !isNaN(parseInt(values[i-1].value)) && !isNaN(parseInt(values[i].value))) {
            str = values[i-1].particle + values[i-1].value + " - " + values[i].particle + values[i].value;
            str = me.fun.page_mangler(str);
        } else {
            // if (("" + values[i-1].value).match(/[0-9]$/) && ("" + values[i].value).match(/^[0-9]/)) {
            if (("" + values[i-1].value).match(/^([0-9]+|[ivxlcmIVXLCM]+)$/) && ("" + values[i].value).match(/^([0-9]+|[ivxlcmIVXLCM]+)$/)) {
                values[i-1].joiningSuffix = me.getTerm("page-range-delimiter");
            }
            str = values[i-1].value + stripHyphenBackslash(values[i-1].joiningSuffix) + values[i].value;
        }
        var m = str.match(/^((?:[0-9]*[a-zA-Z]+0*))?([0-9]+[a-z]*)(\s*[^0-9]+\s*)([-,a-zA-Z]?0*)([0-9]+[a-z]*)$/);
        // var m = str.match(/^((?:[0-9]*[a-zA-Z]+0*))?([0-9]+[a-z]*)(\s*[^0-9]+\s*)([-,a-zA-Z]?0*)([0-9]+[a-z]*)$/);
        if (m) {
            var rangeDelimiter = m[3];
            rangeDelimiter = fixupRangeDelimiter(variable, val, rangeDelimiter, values[i].numeric);
            values[i-1].particle = m[1];
            values[i-1].value = m[2];
            values[i-1].joiningSuffix = rangeDelimiter;
            values[i].particle = m[4];
            values[i].value = m[5];
        }
        currentInfo.count = 0;
    }
    
    function fixRanges(values) {

        if (!node) {
            return;
        }
        if (["page", "page-first", "chapter-number", "collection-number", "edition", "issue", "number", "number-of-pages", "number-of-volumes", "volume", "locator", "locator-extra"].indexOf(variable) === -1) {
            return;
        }

        var currentInfo = {
            count: 0,
            label: null,
            lastHadRangeDelimiter: false
        };

        for (var i=0,ilen=values.length; i<ilen; i++) {
            var val = values[i];
            if (!val.collapsible) {
                currentInfo.count = 0;
                currentInfo.label = null;
                var isNumeric = val.numeric;
                val.joiningSuffix = fixupRangeDelimiter(variable, val, val.joiningSuffix, isNumeric);
            } else if (currentInfo.label === val.label && val.joiningSuffix === "-") {
                // So if there is a hyphen here, and none previous, reset to 1
                currentInfo.count = 1;
            } else if (currentInfo.label === val.label && val.joiningSuffix !== "-") {
                // If there is NO hyphen here, count up
                currentInfo.count++;
                if (currentInfo.count === 2) {
                    manglePageNumbers(values, i, currentInfo);
                }
            } else if (currentInfo.label !== val.label) {
                // If the label doesn't match and count is 2, process
                currentInfo.label = val.label;
                currentInfo.count = 1;
            } else {
                // Safety belt: label doesn't match and count is some other value, so reset to 1
                // This never happens, though.
                currentInfo.count = 1;
                currentInfo.label = val.label;
            }
        }
        // Finally clear, if needed
        if (currentInfo.count === 2) {
            manglePageNumbers(values, values.length-1, currentInfo);
        }
    }

    function setVariableParams(shadow_numbers, variable, values) {
        var obj = shadow_numbers[variable];
        if (values.length) {
            obj.numeric = values[0].numeric;
            obj.collapsible = values[0].collapsible;
            obj.plural = values[0].plural;
            obj.label = CSL.STATUTE_SUBDIV_STRINGS[values[0].label];
            if (variable === "number" && obj.label === "issue" && me.getTerm("number")) {
                obj.label = "number";
            }
        }
    }

    // Split out the labels and values.

    // short-circuit if object exists: if numeric, set styling, no other action
    if (node && this.tmp.shadow_numbers[variable] && this.tmp.shadow_numbers[variable].values.length) {
        var values = this.tmp.shadow_numbers[variable].values;
        fixRanges(values);
        //if (!this.tmp.shadow_numbers[variable].masterStyling && !this.tmp.just_looking) {
            this.tmp.shadow_numbers[variable].masterStyling = setStyling(values);
        //}
        return;
    }

    // info.styling = node;

    // This carries value, pluralization and numeric info for use in other contexts.
    // XXX We used to use one set of params for the entire variable value.
    // XXX Now params are set on individual objects, of which there may be several after parsing.
    if (!this.tmp.shadow_numbers[variable]) {
        this.tmp.shadow_numbers[variable] = {
            values:[]
        };
    }
    //this.tmp.shadow_numbers[variable].values = [];
    //this.tmp.shadow_numbers[variable].plural = 0;
    //this.tmp.shadow_numbers[variable].numeric = false;
    //this.tmp.shadow_numbers[variable].label = false;

    if (!ItemObject) {
        return;
    }

    // Possibly apply multilingual transform
    var languageRole = CSL.LangPrefsMap[variable];
    if (languageRole) {
        var localeType = this.opt["cite-lang-prefs"][languageRole][0];
        val = this.transform.getTextSubField(ItemObject, variable, "locale-"+localeType, true);
        val = val.name;
    } else {
        val = ItemObject[variable];
    }

    // XXX HOLDING THIS
    // Apply short form ONLY if first element tests is-numeric=false
    if (val && this.sys.getAbbreviation) {
        // RefMe bug report: print("XX D'oh! (3): "+num);
        // true as the fourth argument suppresses update of the UI

        // No need for this.
        //val = ("" + val).replace(/^\"/, "").replace(/\"$/, "");

        var jurisdiction = this.transform.loadAbbreviation(ItemObject.jurisdiction, "number", val);
        if (this.transform.abbrevs[jurisdiction].number) {
            if (this.transform.abbrevs[jurisdiction].number[val]) {
                val = this.transform.abbrevs[jurisdiction].number[val];
            } else {
                // Strings rendered via cs:number should not be added to the abbreviations
                // UI unless they test non-numeric. The test happens below.
                if ("undefined" !== typeof this.transform.abbrevs[jurisdiction].number[val]) {
                    delete this.transform.abbrevs[jurisdiction].number[val];
                }
            }
        }
    }

    //   {
    //     label: "sec.",
    //     labelForm: "plural",
    //     labelVisibility: true,
    //     value: 100,
    //     styling: [object],
    //     numeric: true
    //     joiningSuffix: " & ",
    //   },

    // Process only if there is a value.
    if ("undefined" !== typeof val && ("string" === typeof val || "number" === typeof val)) {

        if ("number" === typeof val) {
            val = "" + val;
        }
        var defaultLabel = CSL.STATUTE_SUBDIV_STRINGS_REVERSE[variable];

        if (!this.tmp.shadow_numbers.values) {
            // XXX
            var values = parseString(val, defaultLabel);
            
            setSpaces(values);
            //print("setSpaces(): "+JSON.stringify(values, null, 2));

            setPluralsAndNumerics(values);
            //print("setPluralsAndNumerics(): "+JSON.stringify(values, null, 2));

            this.tmp.shadow_numbers[variable].values = values;

        }

        if (node) {
            fixRanges(values);

            this.tmp.shadow_numbers[variable].masterStyling = setStyling(values);
            //print("setStyling(): "+JSON.stringify(values, null, 2));
        }

        setVariableParams(this.tmp.shadow_numbers, variable, values);
        //print("OK "+JSON.stringify(values, ["label", "origLabel", "labelSuffix", "particle", "collapsible", "value", "numeric", "joiningSuffix", "labelVisibility", "plural"], 2));
    }
};

CSL.Util.outputNumericField = function(state, varname, itemID) {

    state.output.openLevel(state.tmp.shadow_numbers[varname].masterStyling);
    var nums = state.tmp.shadow_numbers[varname].values;
    var masterLabel = nums.length ? nums[0].label : null;
    var labelForm = state.tmp.shadow_numbers[varname].labelForm;
    var embeddedLabelForm;
    if (labelForm) {
        embeddedLabelForm = labelForm;
    } else {
        embeddedLabelForm = "short";
        //labelForm = "short";
    }
    var labelCapitalizeIfFirst = state.tmp.shadow_numbers[varname].labelCapitalizeIfFirst;
    var labelDecorations = state.tmp.shadow_numbers[varname].labelDecorations;
    var lastLabelName = null;
    for (var i=0,ilen=nums.length;i<ilen;i++) {
        var num = nums[i];
        var label = "";
        var labelName;
        if (num.label) {
            if ('var:' === num.label.slice(0,4)) {
                labelName = num.label.slice(4);
            } else {
                labelName = CSL.STATUTE_SUBDIV_STRINGS[num.label];
            }
            if (labelName) {
                if (num.label === masterLabel) {
                    label = state.getTerm(labelName, labelForm, num.plural);
                } else {
                    label = state.getTerm(labelName, embeddedLabelForm, num.plural);
                }
                if (labelCapitalizeIfFirst) {
                    label = CSL.Output.Formatters["capitalize-first"](state, label);
                }
            }
        }
        var labelPlaceholderPos = -1;
        if (label) {
            labelPlaceholderPos = label.indexOf("%s");
        }
        var numStyling = CSL.Util.cloneToken(num.styling);
        numStyling.formatter = num.styling.formatter;
        numStyling.type = num.styling.type;
        numStyling.num = num.styling.num;
        numStyling.gender = num.styling.gender;
        if (labelPlaceholderPos > 0 && labelPlaceholderPos < (label.length-2)) {
            numStyling.strings.prefix += label.slice(0,labelPlaceholderPos);
            numStyling.strings.suffix = label.slice(labelPlaceholderPos+2) + numStyling.strings.suffix;
        } else if (num.labelVisibility) {
            if (!label) {
                label = num.label;
                labelName = num.label;
            }
            if (labelPlaceholderPos > 0) {
                var prefixLabelStyling = new CSL.Token();
                prefixLabelStyling.decorations = labelDecorations;
                state.output.append(label.slice(0,labelPlaceholderPos), prefixLabelStyling);
            } else if (labelPlaceholderPos === (label.length-2) || labelPlaceholderPos === -1) {
                // And add a trailing delimiter.
                state.output.append(label+num.labelSuffix, "empty");
            }
        }
        if (num.collapsible) {
            var blob;
            if (num.value.match(/^[1-9][0-9]*$/)) {
                blob = new CSL.NumericBlob(num.particle, parseInt(num.value, 10), numStyling, itemID);
            } else {
                blob = new CSL.NumericBlob(num.particle, num.value, numStyling, itemID);
            }
            if ("undefined" === typeof blob.gender) {
                blob.gender = state.locale[state.opt.lang]["noun-genders"][varname];
            }
            state.output.append(blob, "literal");
        } else {
            state.output.append(num.particle + num.value, numStyling);
        }
        if (labelPlaceholderPos === 0 && labelPlaceholderPos < (label.length-2)) {
            // Only and always if this is the last entry of this label
            if (lastLabelName === null) {
                lastLabelName = labelName;
            }
            if (labelName !== lastLabelName || i === (nums.length-1)) {
                var suffixLabelStyling = new CSL.Token();
                suffixLabelStyling.decorations = labelDecorations;
                state.output.append(label.slice(labelPlaceholderPos+2), suffixLabelStyling);
            }
        }
        lastLabelName = labelName;
        state.tmp.term_predecessor = true;
    }
    state.output.closeLevel();
};

/*global CSL: true */

CSL.Util.PageRangeMangler = {};

CSL.Util.PageRangeMangler.getFunction = function (state, rangeType) {
    var rangerex, pos, len, stringify, listify, expand, minimize, minimize_internal, chicago, lst, m, b, e, ret, begin, end, ret_func;
    
    var range_delimiter = state.getTerm(rangeType + "-range-delimiter");

    rangerex = /([0-9]*[a-zA-Z]+0*)?([0-9]+[a-z]*)\s*(?:\u2013|-)\s*([0-9]*[a-zA-Z]+0*)?([0-9]+[a-z]*)/;

    stringify = function (lst) {
        len = lst.length;
        for (pos = 1; pos < len; pos += 2) {
            if ("object" === typeof lst[pos]) {
                lst[pos] = lst[pos].join("");
            }
        }
        var ret = lst.join("");
        ret = ret.replace(/([^\\])\-/g, "$1"+state.getTerm(rangeType + "-range-delimiter"));
        return ret;
    };

    listify = function (str) {
        var m, lst, ret;
        // Normalized delimiter form, for use in regexps
        var hyphens = "\\s+\\-\\s+";
        // Normalize delimiters to hyphen wrapped in single spaces
        var this_range_delimiter = range_delimiter === "-" ? "" : range_delimiter;
        var delimRex = new RegExp("([^\\\\])[-" + this_range_delimiter + "\\u2013]", "g");
        str = str.replace(delimRex, "$1 - ").replace(/\s+-\s+/g, " - ");
        // Workaround for Internet Explorer
        //var rexm = new RegExp("((?:[0-9]*[a-zA-Z]+)?[0-9]+" + hyphens + "(?:[0-9]*[a-zA-Z]+)?[0-9]+)", "g");
        //var rexlst = new RegExp("(?:[0-9]*[a-zA-Z]+)?[0-9]+" + hyphens + "(?:[0-9]*[a-zA-Z]+)?[0-9]+");
        var rexm = new RegExp("((?:[0-9]*[a-zA-Z]+0*)?[0-9]+[a-z]*" + hyphens + "(?:[0-9]*[a-zA-Z]+0*)?[0-9]+[a-z]*)", "g");
        var rexlst = new RegExp("(?:[0-9]*[a-zA-Z]+0*)?[0-9]+[a-z]*" + hyphens + "(?:[0-9]*[a-zA-Z]+0*)?[0-9]+[a-z]*");
        m = str.match(rexm);
        lst = str.split(rexlst);
        if (lst.length === 0) {
            ret = m;
        } else {
            ret = [lst[0]];
            for (pos = 1, len = lst.length; pos < len; pos += 1) {
                ret.push(m[pos - 1].replace(/\s*\-\s*/g, "-"));
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
                        m[3] = range_delimiter + (m[1] ? m[1] : "");
                        lst[pos] = m.slice(1);
                    }
                }
            }
            if ("string" === typeof lst[pos]) {
                lst[pos] = lst[pos].replace(/\-/g, range_delimiter);
            }
        }
        return lst;
    };

    minimize = function (lst, minchars, isyear) {
        len = lst.length;
        for (var i = 1, ilen = lst.length; i < ilen; i += 2) {
            if ("object" === typeof lst[i]) {
                lst[i][3] = minimize_internal(lst[i][1], lst[i][3], minchars, isyear);
                if (lst[i][2].slice(1) === lst[i][0]) {
                    lst[i][2] = range_delimiter;
                }
            }
        }
        return stringify(lst);
    };

    minimize_internal = function (begin, end, minchars, isyear) {
        if (!minchars) {
            minchars = 0;
        }
        b = ("" + begin).split("");
        e = ("" + end).split("");
        ret = e.slice();
        ret.reverse();
        if (b.length === e.length) {
            for (var i = 0, ilen = b.length; i < ilen; i += 1) {
                if (b[i] === e[i] && ret.length > minchars) {
                    ret.pop();
                } else {
                    if (minchars && isyear && ret.length === 3) {
                        var front = b.slice(0, i);
                        front.reverse();
                        ret = ret.concat(front);
                    }
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
                m[2] = range_delimiter;
            }
        }
        return stringify(lst);
    };

    //
    // The top-level option handlers.
    //
    var sniff = function (str, func, minchars, isyear) {
        var ret;
		str = "" + str;
		var lst = expand(str);
        var ret = func(lst, minchars, isyear);
        return ret;
    };
    if (!state.opt[rangeType + "-range-format"]) {
        ret_func = function (str) {
            //return str.replace("-", "\u2013", "g");
            return sniff(str, stringify);
        };
    } else if (state.opt[rangeType + "-range-format"] === "expanded") {
        ret_func = function (str) {
            return sniff(str, stringify);
        };
    } else if (state.opt[rangeType + "-range-format"] === "minimal") {
        ret_func = function (str) {
            return sniff(str, minimize);
        };
    } else if (state.opt[rangeType + "-range-format"] === "minimal-two") {
        ret_func = function (str, isyear) {
            return sniff(str, minimize, 2, isyear);
        };
    } else if (state.opt[rangeType + "-range-format"] === "chicago") {
        ret_func = function (str) {
            return sniff(str, chicago);
        };
    }

    return ret_func;
};


/*global CSL: true */

// Use a state machine

// Okay, good!
// Needs some tweaks:
// 1. First pass: quotes only
//    Special: Convert all sandwiched single-quote markup to apostrophe
// 2. Second pass: tags

CSL.Util.FlipFlopper = function(state) {
    
    /**
     * INTERNAL
     */

    var _nestingState = [];

    var _nestingData = {
        "<span class=\"nocase\">": {
            type: "nocase",
            opener: "<span class=\"nocase\">",
            closer: "</span>",
            attr: null,
            outer: null,
            flipflop: null
        },
        "<span class=\"nodecor\">": {
            type: "nodecor",
            opener: "<span class=\"nodecor\">",
            closer: "</span>",
            attr: "@class",
            outer: "nodecor",
            flipflop: {
                "nodecor": "nodecor"
            }
        },
        "<span style=\"font-variant:small-caps;\">": {
            type: "tag",
            opener: "<span style=\"font-variant:small-caps;\">",
            closer: "</span>",
            attr: "@font-variant",
            outer: "small-caps",
            flipflop: {
                "small-caps": "normal",
                "normal": "small-caps"
            }
        },
        "<sc>": {
            type: "tag",
            opener: "<sc>",
            closer: "</sc>",
            attr: "@font-variant",
            outer: "small-caps",
            flipflop: {
                "small-caps": "normal",
                "normal": "small-caps"
            }
        },
        "<i>": {
            type: "tag",
            opener: "<i>",
            closer: "</i>",
            attr: "@font-style",
            outer: "italic",
            flipflop: {
                "italic": "normal",
                "normal": "italic"
            }
        },
        "<b>": {
            type: "tag",
            opener: "<b>",
            closer: "</b>",
            attr: "@font-weight",
            outer: "bold",
            flipflop: {
                "bold": "normal",
                "normal": "bold"
            }
        },
        "<sup>": {
            type: "tag",
            opener: "<sup>",
            closer: "</sup>",
            attr: "@vertical-align",
            outer: "sup",
            flipflop: {
                "sub": "sup",
                "sup": "sup"
            }
        },
        "<sub>": {
            type: "tag",
            opener: "<sub>",
            closer: "</sub>",
            attr: "@vertical-align",
            outer: "sub",
            flipflop: {
                "sup": "sub",
                "sub": "sub"
            }
        },
        " \"": {
            type: "quote",
            opener: " \"",
            closer: "\"",
            attr: "@quotes",
            outer: "true",
            flipflop: {
                "true": "inner",
                "inner": "true",
                "false": "true"
            }
        },
        " \'": {
            type: "quote",
            opener: " \'",
            closer: "\'",
            attr: "@quotes",
            outer: "inner",
            flipflop: {
                "true": "inner",
                "inner": "true",
                "false": "true"
            }
        }
    };

    _nestingData["(\""] = _nestingData[" \""];
    _nestingData["(\'"] = _nestingData[" \'"];

    var localeOpenQuote = state.getTerm("open-quote");
    var localeCloseQuote = state.getTerm("close-quote");
    var localeOpenInnerQuote = state.getTerm("open-inner-quote");
    var localeCloseInnerQuote = state.getTerm("close-inner-quote");

    // If locale uses straight quotes, do not register them. All will be well.
    // Otherwise, clone straight-quote data, and adjust.
    if (localeOpenQuote && localeCloseQuote && [" \""," \'","\"","\'"].indexOf(localeOpenQuote) === -1) {
        _nestingData[localeOpenQuote] = JSON.parse(JSON.stringify(_nestingData[" \""]));
        _nestingData[localeOpenQuote].opener = localeOpenQuote;
        _nestingData[localeOpenQuote].closer = localeCloseQuote;
    }
    
    if (localeOpenInnerQuote && localeCloseInnerQuote && [" \""," \'","\"","\'"].indexOf(localeOpenInnerQuote) === -1) {
        _nestingData[localeOpenInnerQuote] = JSON.parse(JSON.stringify(_nestingData[" \'"]));
        _nestingData[localeOpenInnerQuote].opener = localeOpenInnerQuote;
        _nestingData[localeOpenInnerQuote].closer = localeCloseInnerQuote;
    }
    
    function _setOuterQuoteForm(quot) {
        var flip = {
            " \'": " \"",
            " \"": " \'",
            "(\"": "(\'",
            "(\'": "(\""
        };
        _nestingData[quot].outer = "true";
        _nestingData[flip[quot]].outer = "inner";
    }
    
    function _getNestingOpenerParams(opener) {
        var openers = [];
        var keys = Object.keys(_nestingData);
        for (var i = 0, l = keys.length; i < l; i++) {
            var key = keys[i];
            if (_nestingData[opener].type !== "quote" || !_nestingData[opener]) {
                openers.push(key);
            }
        }
        var ret = _nestingData[opener];
        ret.opener = new RegExp("^(?:" + openers.map(function(str){
            return str.replace("(", "\\(");
        }).join("|") + ")");
        return ret;
    }

    var _nestingParams = (function() {
        var ret = {};
        var keys = Object.keys(_nestingData);
        for (var i = 0, l = keys.length; i < l; i++) {
            var key = keys[i];
            ret[key] = _getNestingOpenerParams(key);
        }
        return ret;
    }());

    var _tagRex = (function() {
        var openers = [];
        var closers = [];
        var vals = {};
        for (var opener in _nestingParams) {
            openers.push(opener);
            vals[_nestingParams[opener].closer] = true;
        }
        var keys = Object.keys(vals);
        for (var i = 0, l = keys.length; i < l; i++) {
            var closer = keys[i];
            closers.push(closer);
        }

        var all = openers.concat(closers).map(function(str){
            return str.replace("(", "\\(");
        }).join("|");

        return {
            matchAll: new RegExp("((?:" + all + "))", "g"),
            splitAll: new RegExp("(?:" + all + ")", "g"),
            open: new RegExp("(^(?:" + openers.map(function(str){
                return str.replace("(", "\\(");
            }).join("|") + ")$)"),
            close: new RegExp("(^(?:" + closers.join("|") + ")$)"),
        };
    }());

    function _tryOpen(tag, pos) {
        var params = _nestingState[_nestingState.length - 1];
        if (!params || tag.match(params.opener)) {
            _nestingState.push({
                type: _nestingParams[tag].type,
                opener: _nestingParams[tag].opener,
                closer: _nestingParams[tag].closer,
                pos: pos
            });
            return false;
        } else {
            _nestingState.pop();
            _nestingState.push({
                type: _nestingParams[tag].type,
                opener: _nestingParams[tag].opener,
                closer: _nestingParams[tag].closer,
                pos: pos
            });
            return {
                fixtag: params.pos
            };
        }
    }
    
    function _tryClose(tag, pos) {
        var params = _nestingState[_nestingState.length - 1];
        if (params && tag === params.closer) {
            _nestingState.pop();
            if (params.type === "nocase") {
                return {
                    nocase: {
                        open: params.pos,
                        close: pos
                    }
                };
            } else {
                return false;
            }
        } else {
            if (params) {
                return {
                    fixtag: params.pos
                };
            } else {
                return {
                    fixtag: pos
                };
            }
        }
    }
    
    function _pushNestingState(tag, pos) {
        if (tag.match(_tagRex.open)) {
            return _tryOpen(tag, pos);
        } else {
            return _tryClose(tag, pos);
        }
    }
    
    function _nestingFix (tag, pos) {
        return _pushNestingState(tag, pos);
    }
    
    function _doppelString(str) {
        var forcedSpaces = [];
        // Normalize markup
        str = str.replace(/(<span)\s+(style=\"font-variant:)\s*(small-caps);?\"[^>]*(>)/g, "$1 $2$3;\"$4");
        str = str.replace(/(<span)\s+(class=\"no(?:case|decor)\")[^>]*(>)/g, "$1 $2$3");

        var match = str.match(_tagRex.matchAll);
        if (!match) {
            return {
                tags: [],
                strings: [str],
                forcedSpaces: []
            };
        }
        var split = str.split(_tagRex.splitAll);

        for (var i=0,ilen=match.length-1;i<ilen;i++) {
            if (_nestingData[match[i]]) {
                if (split[i+1] === "" && ["\"", "'"].indexOf(match[i+1]) > -1) {
                    match[i+1] = " " + match[i+1];
                    forcedSpaces.push(true);
                } else {
                    forcedSpaces.push(false);
                }
            }
        }
        return {
            tags: match,
            strings: split,
            forcedSpaces: forcedSpaces
        };
    }

    var TagReg = function(blob) {
        var _stack = [];
        this.set = function (tag) {
            var attr = _nestingData[tag].attr;
            var decor = null;
            for (var i=_stack.length-1;i>-1;i--) {
                var _decor = _stack[i];
                if (_decor[0] === attr) {
                    decor = _decor;
                    break;
                }
            }
            if (!decor) {
                var allTheDecor = [state[state.tmp.area].opt.layout_decorations].concat(blob.alldecor);
                outer:
                for (var i=allTheDecor.length-1;i>-1;i--) {
                    var decorset = allTheDecor[i];
                    if (!decorset) {
                        continue;
                    }
                    for (var j=decorset.length-1;j>-1;j--) {
                        var _decor = decorset[j];
                        if (_decor[0] === attr) {
                            decor = _decor;
                            break outer;
                        }
                    }
                }
            }
            if (!decor) {
                decor = [attr, _nestingData[tag].outer];
            } else {
                decor = [attr, _nestingData[tag].flipflop[decor[1]]];
            }
            _stack.push(decor);
        };
        this.pair = function () {
            return _stack[_stack.length-1];
        };
        this.pop = function () {
            _stack.pop();
        };
    };
    
    function _apostropheForce(tag, str) {
        if (tag === "\'") {
            if (str && str.match(/^[^\,\.\?\:\;\ ]/)) {
                return true;
            }
        } else if (tag === " \'" && str && str.match(/^[\ ]/)) {
            return true;
        }
        return false;
    }

    function _undoppelToQueue(blob, doppel, leadingSpace) {
        var firstString = true;
        var tagReg = new TagReg(blob);
        blob.blobs = [];
        function Stack (blob) {
            this.stack = [blob];
            this.latest = blob;
            this.addStyling = function(str, decor) {
                if (firstString) {
                    if (str.slice(0, 1) === " ") {
                        str = str.slice(1);
                    }
                    if (str.slice(0, 1) === " ") {
                        str = str.slice(1);
                    }
                    firstString = false;
                }
                this.latest = this.stack[this.stack.length-1];
                if (decor) {
                    if ("string" === typeof this.latest.blobs) {
                        var child = new CSL.Blob();
                        child.blobs = this.latest.blobs;
                        child.alldecor = this.latest.alldecor.slice();
                        this.latest.blobs = [child];
                    }
                    var tok = new CSL.Token();
                    var newblob = new CSL.Blob(null, tok);
                    newblob.alldecor = this.latest.alldecor.slice();
                    
                    // AHA! Bad naming. There is _decorset from the list, and
                    // there WAS decorset that we are building. Dumb. Fix the
                    // names and fix it up.
                    
                    if (decor[0] === "@class" && decor[1] === "nodecor") {
                        var newdecorset = [];
                        var seen = {};
                        var allTheDecor = [state[state.tmp.area].opt.layout_decorations].concat(newblob.alldecor);
                        for (var i=allTheDecor.length-1;i>-1;i--) {
                            var _decorset = allTheDecor[i];
                            if (!_decorset) {
                                continue;
                            }
                            for (var j=_decorset.length-1;j>-1;j--) {
                                var _olddecor = _decorset[j];
                                if (["@font-weight", "@font-style", "@font-variant"].indexOf(_olddecor[0]) > -1
                                    && !seen[_olddecor[0]]) {
                                    
                                    if (decor[1] !== "normal") {
                                        newblob.decorations.push([_olddecor[0], "normal"]);
                                        newdecorset.push([_olddecor[0], "normal"]);
                                    }
                                    seen[_olddecor[0]] = true;
                                }
                            }
                        }
                        newblob.alldecor.push(newdecorset);
                        
                    } else {
                        newblob.decorations.push(decor);
                        newblob.alldecor.push([decor]);
                    }
                    this.latest.blobs.push(newblob);
                    this.stack.push(newblob);
                    this.latest = newblob;
                    if (str) {
                        var tok = new CSL.Token();
                        var newblob = new CSL.Blob(null, tok);
                        newblob.blobs = str;
                        newblob.alldecor = this.latest.alldecor.slice();
                        this.latest.blobs.push(newblob);
                    }
                } else {
                    if (str) {
                        var child = new CSL.Blob();
                        child.blobs = str;
                        child.alldecor = this.latest.alldecor.slice();
                        this.latest.blobs.push(child);
                    }
                }
            };
            this.popStyling = function() {
                this.stack.pop();
            };
        }
        var stack = new Stack(blob);
        if (doppel.strings.length) {
            var str = doppel.strings[0];
            if (leadingSpace) {
                str = " " + str;
            }
            stack.addStyling(str);
        }
        for (var i=0,ilen=doppel.tags.length;i<ilen;i++) {
            var tag = doppel.tags[i];
            var str = doppel.strings[i+1];
            if (tag.match(_tagRex.open)) {
                tagReg.set(tag);
                stack.addStyling(str, tagReg.pair());
            } else {
                tagReg.pop();
                stack.popStyling();
                stack.addStyling(str);
            }
        }
    }

    /**
     * PUBLIC
     */

    this.processTags = function (blob) {
        var str = blob.blobs;
        var leadingSpace = false;
        if (str.slice(0, 1) === " " && !str.match(/^\s+[\'\"]/)) {
            leadingSpace = true;
        }
        var rex = new RegExp("(" + CSL.ROMANESQUE_REGEXP.source + ")\u2019(" + CSL.ROMANESQUE_REGEXP.source + ")", "g");
        var str = " " + str.replace(rex, "$1\'$2");
        var doppel = _doppelString(str);
        if (doppel.tags.length === 0) {
            return;
        }
        var quoteFormSeen = false;
        // ZZZ
        // It is inside THIS loop that we can convert the nocase and nodecor
        // tags and companion spans to string
        // Um. Maybe. Or maybe it needs to happen inside _nestingFix() somewhere.
        
    	for (var i=0,ilen=doppel.tags.length;i<ilen;i++) {
            var tag = doppel.tags[i];
            var str = doppel.strings[i+1];
            if (_apostropheForce(tag, str)) {
                if (tag === " \'") {
                    doppel.strings[i+1] = " \u2019" + doppel.strings[i+1];
                } else {
                    doppel.strings[i+1] = "\u2019" + doppel.strings[i+1];
                }
                doppel.tags[i] = "";
            } else {
                var tagInfo;
                while (true) {
                    tagInfo = _nestingFix(tag, i);
                    if (tagInfo) {
                        if (Object.keys(tagInfo).indexOf("fixtag") > -1) {
                            if (tag.match(_tagRex.close)
                                && tag === "\'") {
                                
                                doppel.strings[i+1] = "\u2019" + doppel.strings[i+1];
                                doppel.tags[i] = "";
                            } else {
                                var failedTag = doppel.tags[tagInfo.fixtag];
                                if (doppel.forcedSpaces[tagInfo.fixtag-1]) {
                                    failedTag = failedTag.slice(1);
                                }
                                doppel.strings[tagInfo.fixtag+1] = failedTag + doppel.strings[tagInfo.fixtag+1];
                                doppel.tags[tagInfo.fixtag] = "";
                            }
                            if (_nestingState.length > 0) {
                                _nestingState.pop();
                            } else {
                                break;
                            }
                        } else if (tagInfo.nocase) {
                            doppel.tags[tagInfo.nocase.open] = "";
                            doppel.tags[tagInfo.nocase.close] = "";
                            break;
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                if (tagInfo && (tagInfo.fixtag|| tagInfo.fixtag === 0)) {
                    doppel.strings[i+1] = doppel.tags[i] + doppel.strings[i+1];
                    doppel.tags[i] = "";
                }
            }
        }
        // Stray tags are neutralized here
        for (var i=_nestingState.length-1;i>-1;i--) {
            var tagPos = _nestingState[i].pos;
            var tag = doppel.tags[tagPos];
            if (tag === " \'" || tag === "\'") {

                doppel.strings[tagPos+1] = " \u2019" + doppel.strings[tagPos+1];
            } else {
                doppel.strings[tagPos+1] = doppel.tags[tagPos] + doppel.strings[tagPos+1];
            }
            doppel.tags[tagPos] = "";
            _nestingState.pop();
        }
        for (var i=doppel.tags.length-1;i>-1;i--) {
            if (!doppel.tags[i]) {
                doppel.tags = doppel.tags.slice(0,i).concat(doppel.tags.slice(i+1));
                doppel.strings[i] = doppel.strings[i] + doppel.strings[i+1];
                doppel.strings = doppel.strings.slice(0,i+1).concat(doppel.strings.slice(i+2));
            }
        }
        // Sniff initial (outer) quote form (single or double) and configure parser
        // Also add leading spaces.
        for (var i=0,ilen=doppel.tags.length;i<ilen;i++) {
            var tag = doppel.tags[i];
            var forcedSpace = doppel.forcedSpaces[i-1];
            if ([" \"", " \'", "(\"", "(\'"].indexOf(tag) > -1) {
                if (!quoteFormSeen) {
                    _setOuterQuoteForm(tag);
                    quoteFormSeen = true;
                }
                if (!forcedSpace) {
                    doppel.strings[i] += tag.slice(0, 1);
                }
            }
        }
        //print(JSON.stringify(doppel, null, 2))
        //print(_undoppelString(doppel));
        _undoppelToQueue(blob, doppel, leadingSpace);
    };
};

/*global CSL: true */

CSL.Output.Formatters = (function () {
    var rexStr = "(?:\u2018|\u2019|\u201C|\u201D| \"| \'|\"|\'|[-\u2013\u2014\/.,;?!:]|\\[|\\]|\\(|\\)|<span style=\"font-variant: small-caps;\">|<span class=\"no(?:case|decor)\">|<\/span>|<\/?(?:i|sc|b|sub|sup)>)";
    var tagDoppel = new CSL.Doppeler(rexStr, function(str) {
        return str.replace(/(<span)\s+(class=\"no(?:case|decor)\")[^>]*(>)/g, "$1 $2$3").replace(/(<span)\s+(style=\"font-variant:)\s*(small-caps);?(\")[^>]*(>)/g, "$1 $2 $3;$4$5");
    });
    
    var wordDoppel = new CSL.Doppeler("(?:[\u0020\u00A0\u2000-\u200B\u205F\u3000]+)");
    
    /**
     * INTERNAL
     */

    var _tagParams = {
        "<span style=\"font-variant: small-caps;\">": "</span>",
        "<span class=\"nocase\">": "</span>",
        "<span class=\"nodecor\">": "</span>",
        "<sc>": "</sc>",
        "<sub>": "</sub>",
        "<sup>": "</sup>"
    };

    function _capitalise (word) {
        // Weird stuff is (.) transpiled with regexpu
        //   https://github.com/mathiasbynens/regexpu
        var m = word.match(/(^\s*)((?:[\0-\t\x0B\f\x0E-\u2027\u202A-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]))(.*)/);
        // Do not uppercase lone Greek letters
        // (No case transforms in Greek citations, but chars used in titles to science papers)
        if (m && !(m[2].match(/^[\u0370-\u03FF]$/) && !m[3])) {
            return m[1] + m[2].toUpperCase() + m[3];
        }
        return word;
    }

    function _textcaseEngine(config, string) {
        if (!string) {
            return "";
        }
        config.doppel = tagDoppel.split(string);
        var quoteParams = {
            " \"": {
                opener: " \'",
                closer: "\""
            },
            " \'": {
                opener: " \"",
                closer: "\'"
            },
            "\u2018": {
                opener: "\u2018",
                closer: "\u2019"
            },
            "\u201C": {
                opener: "\u201C",
                closer: "\u201D"
            },
        };
        function tryOpen(tag, pos) {
            if (config.quoteState.length === 0 || tag === config.quoteState[config.quoteState.length - 1].opener) {
                config.quoteState.push({
                    opener: quoteParams[tag].opener,
                    closer: quoteParams[tag].closer,
                    pos: pos
                });
                return false;
            } else {
                var prevPos = config.quoteState[config.quoteState.length-1].pos;
                config.quoteState.pop();
                config.quoteState.push({
                    opener: quoteParams[tag].opener,
                    closer: quoteParams[tag].closer,
                    positions: pos
                });
                return prevPos;
            }
        }
        function tryClose(tag, pos) {
            if (config.quoteState.length > 0 && tag === config.quoteState[config.quoteState.length - 1].closer) {
                config.quoteState.pop();
            } else {
                return pos;
            }
        }
        function pushQuoteState(tag, pos) {
            var isOpener = ["\u201C", "\u2018", " \"", " \'"].indexOf(tag) > -1 ? true : false;
            if (isOpener) {
                return tryOpen(tag, pos);
            } else {
                return tryClose(tag, pos);
            }
        }
        function quoteFix (tag, positions) {
            var m = tag.match(/(^(?:\u2018|\u2019|\u201C|\u201D|\"|\')|(?: \"| \')$)/);
            if (m) {
                return pushQuoteState(m[1], positions);
            }
        }
        // Run state machine
        if (config.doppel.strings.length && config.doppel.strings[0].trim()) {
            config.doppel.strings[0] = config.capitaliseWords(config.doppel.strings[0], 0, config.doppel.tags[0]);
        }

    	for (var i=0,ilen=config.doppel.tags.length;i<ilen;i++) {
            var tag = config.doppel.tags[i];
            var str = config.doppel.strings[i+1];

            if (config.tagState !== null) {
                // Evaluate tag state for current string
                if (_tagParams[tag]) {
                    config.tagState.push(_tagParams[tag]);
                } else if (config.tagState.length && tag === config.tagState[config.tagState.length - 1]) {
                    config.tagState.pop();
                }
            }

            if (config.afterPunct !== null) {
                // Evaluate punctuation state of current string
                if (tag.match(/[\!\?\:]$/)) {
                    config.afterPunct = true;
                }
            }

            // Process if outside tag scope, else noop for upper-casing
            if (config.tagState.length === 0) {
                config.doppel.strings[i+1] = config.capitaliseWords(str, i+1, config.doppel,config.doppel.tags[i+1]);
                
            } else if (config.doppel.strings[i+1].trim()) {
                config.lastWordPos = null;
            }
            
            if (config.quoteState !== null) {
                // Evaluate quote state of current string and fix chars that have flown
                var quotePos = quoteFix(tag, i);
                if (quotePos || quotePos === 0) {
                    var origChar = config.doppel.origStrings[quotePos+1].slice(0, 1);
                    config.doppel.strings[quotePos+1] = origChar + config.doppel.strings[quotePos+1].slice(1);
                    config.lastWordPos = null;
                }
            }

            // If there was a printable string, unset first-word and after-punctuation
            if (config.isFirst) {
                if (str.trim()) {
                    config.isFirst = false;
                }
            }
            if (config.afterPunct) {
                if (str.trim()) {
                    config.afterPunct = false;
                }
            }
        }
        if (config.quoteState) {
            for (var i=0,ilen=config.quoteState.length;i<ilen;i++) {
                var quotePos = config.quoteState[i].pos;
                // Test for quotePos avoids a crashing error:
                //   https://github.com/citation-style-language/test-suite/blob/master/processor-tests/humans/flipflop_OrphanQuote.txt
                if (typeof quotePos !== 'undefined') {
                    var origChar = config.doppel.origStrings[quotePos+1].slice(0, 1);
                    config.doppel.strings[quotePos+1] = origChar + config.doppel.strings[quotePos+1].slice(1);
                }
            }
        }
        // Specially capitalize the last word if necessary (invert stop-word list)
        if (config.lastWordPos) {
            var lastWords = wordDoppel.split(config.doppel.strings[config.lastWordPos.strings]);
            var lastWord = lastWords.strings[config.lastWordPos.words];
            if (lastWord.length > 1 && lastWord.toLowerCase().match(config.skipWordsRex)) {
                lastWord = _capitalise(lastWord);
                lastWords.strings[config.lastWordPos.words] = lastWord;
            }
            config.doppel.strings[config.lastWordPos.strings] = wordDoppel.join(lastWords);
        }

        // Recombine the string
        return tagDoppel.join(config.doppel);
    }

    /**
     * PUBLIC
     */

    /**
     * A noop that just delivers the string.
     */
    function passthrough (state, str) {
        return str;
    }

    /**
     * Force all letters in the string to lowercase, skipping nocase spans
     */
    function lowercase(state, string) {
        var config = {
            quoteState: null,
            capitaliseWords: function(str) {
                var words = str.split(" ");
                for (var i=0,ilen=words.length;i<ilen;i++) {
                    var word = words[i];
                    if (word) {
                        words[i] = word.toLowerCase();
                    }
                }
                return words.join(" ");
            },
            skipWordsRex: null,
            tagState: [],
            afterPunct: null,
            isFirst: null
        };
        return _textcaseEngine(config, string);
    }

    /**
     * Force all letters in the string to uppercase.
     */
    function uppercase(state, string) {
        var config = {
            quoteState: null,
            capitaliseWords: function(str) {
                var words = str.split(" ");
                for (var i=0,ilen=words.length;i<ilen;i++) {
                    var word = words[i];
                    if (word) {
                        words[i] = word.toUpperCase();
                    }
                }
                return words.join(" ");
            },
            skipWordsRex: null,
            tagState: [],
            afterPunct: null,
            isFirst: null
        };
        return _textcaseEngine(config, string);
    }

    /**
     * Similar to <b>capitalize_first</b>, but force the
     * subsequent characters to lowercase.
     */
    function sentence(state, string) {
        var config = {
            quoteState: [],
            capitaliseWords: function(str) {
                var words = str.split(" ");
                for (var i=0,ilen=words.length;i<ilen;i++) {
                    var word = words[i];
                    if (word) {
                        if (config.isFirst) {
                            words[i] = _capitalise(word);
                            config.isFirst = false;
                        } else {
                            words[i] = word.toLowerCase();
                        }
                    }
                }
                return words.join(" ");
            },
            skipWordsRex: null,
            tagState: [],
            afterPunct: null,
            isFirst: true
        };
        return _textcaseEngine(config, string);
    }

    function title(state, string) {
        var config = {
            quoteState: [],
            capitaliseWords: function(str, i, followingTag) {
                if (str.trim()) {
                    var words = str.split(/[ \u00A0]+/);
                    var wordle = wordDoppel.split(str);
                    var words = wordle.strings;
                    for (var j=0,jlen=words.length;j<jlen;j++) {
                        var word = words[j];
                        if (!word) {
                            continue;
                        }
                        if (word.length > 1 && !word.toLowerCase().match(config.skipWordsRex)) {
                            // Capitalize every word that is not a stop-word
                            words[j] = _capitalise(words[j]);
                        } else if (j === (words.length - 1) && followingTag === "-") {
                            words[j] = _capitalise(words[j]);
                        } else if (config.isFirst) {
                            // Capitalize first word, even if a stop-word
                            words[j] = _capitalise(words[j]);
                        } else if (config.afterPunct) {
                            // Capitalize after punctuation
                            words[j] = _capitalise(words[j]);
                        }
                        config.afterPunct = false;
                        config.isFirst = false;
                        config.lastWordPos = {
                            strings: i,
                            words: j
                        };
                    }
                    str = wordDoppel.join(wordle);
                }
                return str;
            },
            skipWordsRex: state.locale[state.opt.lang].opts["skip-words-regexp"],
            tagState: [],
            afterPunct: false,
            isFirst: true
        };
        return _textcaseEngine(config, string);
    }
    
    
    /**
     * Force capitalization of the first letter in the string, leave
     * the rest of the characters untouched.
     */
    function capitalizeFirst(state, string) {
        var config = {
            quoteState: [],
            capitaliseWords: function(str) {
                var words = str.split(" ");
                for (var i=0,ilen=words.length;i<ilen;i++) {
                    var word = words[i];
                    if (word) {
                        if (config.isFirst) {
                            words[i] = _capitalise(word);
                            config.isFirst = false;
                            break;
                        }
                    }
                }
                return words.join(" ");
            },
            skipWordsRex: null,
            tagState: [],
            afterPunct: null,
            isFirst: true
        };
        return _textcaseEngine(config, string);
    }

    /**
     * Force the first letter of each space-delimited
     * word in the string to uppercase, and leave the remainder
     * of the string untouched.  Single characters are forced
     * to uppercase.
     */
    function capitalizeAll (state, string) {
        var config = {
            quoteState: [],
            capitaliseWords: function(str) {
                var words = str.split(" ");
                for (var i=0,ilen=words.length;i<ilen;i++) {
                    var word = words[i];
                    if (word) {
                        words[i] = _capitalise(word);
                    }
                }
                return words.join(" ");
            },
            skipWordsRex: null,
            tagState: [],
            afterPunct: null,
            isFirst: null
        };
        return _textcaseEngine(config, string);
    }
    return {
        passthrough: passthrough,
        lowercase: lowercase,
        uppercase: uppercase,
        sentence: sentence,
        title: title,
        "capitalize-first": capitalizeFirst,
        "capitalize-all": capitalizeAll
    };
}());

/*global CSL: true */


/**
 * Output specifications.
 * @class
 */
CSL.Output.Formats = function () {};

/**
 * HTML output format specification.
 * <p>The headline says it all.  The source code for this
 * object can be used as a template for producing other
 * output modes.</p>
 */
CSL.Output.Formats.prototype.html = {
    //
    // text_escape: Format-specific function for escaping text destined
    // for output.  Takes the text to be escaped as sole argument.  Function
    // will be run only once across each portion of text to be escaped, it
    // need not be idempotent.
    //
    "text_escape": function (text) {
        // Numeric entities, in case the output is processed as
        // xml in an environment in which HTML named entities are
        // not declared.
        if (!text) {
            text = "";
        }
        return text.replace(/&/g, "&#38;")
            .replace(/</g, "&#60;")
            .replace(/>/g, "&#62;")
            .replace(/\s\s/g, "\u00A0 ")
            .replace(CSL.SUPERSCRIPTS_REGEXP,
                     function(aChar) {
                         // return "&#60;sup&#62;" + CSL.SUPERSCRIPTS[aChar] + "&#60;/sup&#62;";
                         return "<sup>" + CSL.SUPERSCRIPTS[aChar] + "</sup>";
                     });
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
    "@strip-periods/true": CSL.Output.Formatters.passthrough,
    "@strip-periods/false": CSL.Output.Formatters.passthrough,
    "@quotes/true": function (state, str) {
        if ("undefined" === typeof str) {
            return state.getTerm("open-quote");
        }
        return state.getTerm("open-quote") + str + state.getTerm("close-quote");
    },
    "@quotes/inner": function (state, str) {
        if ("undefined" === typeof str) {
            //
            // Mostly right by being wrong (for apostrophes)
            //
            return "\u2019";
        }
        return state.getTerm("open-inner-quote") + str + state.getTerm("close-inner-quote");
    },
    "@quotes/false": false,
    //"@bibliography/body": function (state,str){
    //    return "<div class=\"csl-bib-body\">\n"+str+"</div>";
    //},
    "@cite/entry": function (state, str) {
        return state.sys.wrapCitationEntry(str, this.item_id, this.locator_txt, this.suffix_txt);
	},
    "@bibliography/entry": function (state, str) {
        // Test for this.item_id to add decorations to
        // bibliography output of individual entries.
        //
        // Full item content can be obtained from
        // state.registry.registry[id].ref, using
        // CSL variable keys.
        //
        // Example:
        //
        //   print(state.registry.registry[this.item_id].ref["title"]);
        //
        // At present, for parallel citations, only the
        // id of the master item is supplied on this.item_id.
        var insert = "";
        if (state.sys.embedBibliographyEntry) {
            insert = state.sys.embedBibliographyEntry(this.item_id) + "\n";
        }
        return "  <div class=\"csl-entry\">" + str + "</div>\n" + insert;
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
    },
    "@showid/true": function (state, str, cslid) {
        if (!state.tmp.just_looking && ! state.tmp.suppress_decorations) {
            if (cslid) {
                return "<span class=\"" + state.opt.nodenames[cslid] + "\" cslid=\"" + cslid + "\">" + str + "</span>";
            } else if (this.params && "string" === typeof str) {
                var prePunct = "";
                if (str) {
                    var m = str.match(CSL.VARIABLE_WRAPPER_PREPUNCT_REX);
                    prePunct = m[1];
                    str = m[2];
                }
                var postPunct = "";
                if (str && CSL.SWAPPING_PUNCTUATION.indexOf(str.slice(-1)) > -1) {
                    postPunct = str.slice(-1);
                    str = str.slice(0,-1);
                }
                return state.sys.variableWrapper(this.params, prePunct, str, postPunct);
            } else {
                return str;
            }
        } else {
            return str;
        }
    },
    "@URL/true": function (state, str) {
        return "<a href=\"" + str + "\">" + str + "</a>";
    },
    "@DOI/true": function (state, str) {
        var doiurl = str;
        if (!str.match(/^https?:\/\//)) {
            doiurl = "https://doi.org/" + str;
        }
        return "<a href=\"" + doiurl + "\">" + str + "</a>";
    }
};

/**
 * Plain text output specification.
 *
 * (Code contributed by Simon Kornblith, Center for History and New Media,
 * George Mason University.)
 */
CSL.Output.Formats.prototype.text = {
    //
    // text_escape: Format-specific function for escaping text destined
    // for output.  Takes the text to be escaped as sole argument.  Function
    // will be run only once across each portion of text to be escaped, it
    // need not be idempotent.
    //
    "text_escape": function (text) {
        if (!text) {
            text = "";
        }
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
    "@strip-periods/true": CSL.Output.Formatters.passthrough,
    "@strip-periods/false": CSL.Output.Formatters.passthrough,
    "@quotes/true": function (state, str) {
        if ("undefined" === typeof str) {
            return state.getTerm("open-quote");
        }
        return state.getTerm("open-quote") + str + state.getTerm("close-quote");
    },
    "@quotes/inner": function (state, str) {
        if ("undefined" === typeof str) {
            //
            // Mostly right by being wrong (for apostrophes)
            //
            return "\u2019";
        }
        return state.getTerm("open-inner-quote") + str + state.getTerm("close-inner-quote");
    },
    "@quotes/false": false,
    //"@bibliography/body": function (state,str){
    //    return "<div class=\"csl-bib-body\">\n"+str+"</div>";
    //},
    "@cite/entry": function (state, str) {
		return state.sys.wrapCitationEntry(str, this.item_id, this.locator_txt, this.suffix_txt);
	},
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
    },
    "@showid/true": function (state, str) {
        return str;
    },
    "@URL/true": function (state, str) {
        return str;
    },
    "@DOI/true": function (state, str) {
        return str;
    }
};

/**
 * Plain text output specification.
 *
 * (Code contributed by Simon Kornblith, Center for History and New Media,
 * George Mason University.)
 */
CSL.Output.Formats.prototype.rtf = {
    //
    // text_escape: Format-specific function for escaping text destined
    // for output.  Takes the text to be escaped as sole argument.  Function
    // will be run only once across each portion of text to be escaped, it
    // need not be idempotent.
    //
    "text_escape": function (text) {
        if (!text) {
            text = "";
        }
        return text
        .replace(/([\\{}])/g, "\\$1")
        .replace(CSL.SUPERSCRIPTS_REGEXP,
                 function(aChar) {
                     return "\\super " + CSL.SUPERSCRIPTS[aChar] + "\\nosupersub{}";
                 })
        .replace(/[\u007F-\uFFFF]/g,
                 function(aChar) { return "\\uc0\\u"+aChar.charCodeAt(0).toString()+"{}"; })
        .split("\t").join("\\tab{}");
    },
    "@passthrough/true": CSL.Output.Formatters.passthrough,
    "@font-style/italic":"{\\i{}%%STRING%%}",
    "@font-style/normal":"{\\i0{}%%STRING%%}",
    "@font-style/oblique":"{\\i{}%%STRING%%}",
    "@font-variant/small-caps":"{\\scaps %%STRING%%}",
    "@font-variant/normal":"{\\scaps0{}%%STRING%%}",
    "@font-weight/bold":"{\\b{}%%STRING%%}",
    "@font-weight/normal":"{\\b0{}%%STRING%%}",
    "@font-weight/light":false,
    "@text-decoration/none":false,
    "@text-decoration/underline":"{\\ul{}%%STRING%%}",
    "@vertical-align/baseline":false,
    "@vertical-align/sup":"\\super %%STRING%%\\nosupersub{}",
    "@vertical-align/sub":"\\sub %%STRING%%\\nosupersub{}",
    "@strip-periods/true": CSL.Output.Formatters.passthrough,
    "@strip-periods/false": CSL.Output.Formatters.passthrough,
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
    "@display/block": "\\line{}%%STRING%%\\line\r\n",
    "@cite/entry": function (state, str) {
        // If wrapCitationEntry does not exist, cite/entry 
        // is not applied.
		return state.sys.wrapCitationEntry(str, this.item_id, this.locator_txt, this.suffix_txt);
	},
    "@bibliography/entry": function(state,str){
        return str;
    },
    "@display/left-margin": function(state,str){
        return str+"\\tab ";
    },
    "@display/right-inline": function (state, str) {
        return str+"\r\n";
    },
    "@display/indent": function (state, str) {
        return "\n\\tab "+str+"\\line\r\n";
    },
    "@showid/true": function (state, str) {
        if (!state.tmp.just_looking && ! state.tmp.suppress_decorations) {
            var prePunct = "";
            if (str) {
                var m = str.match(CSL.VARIABLE_WRAPPER_PREPUNCT_REX);
                prePunct = m[1];
                str = m[2];
            }
            var postPunct = "";
            if (str && CSL.SWAPPING_PUNCTUATION.indexOf(str.slice(-1)) > -1) {
                postPunct = str.slice(-1);
                str = str.slice(0,-1);
            }
            return state.sys.variableWrapper(this.params, prePunct, str, postPunct);
        } else {
            return str;
        }
    },
    "@URL/true": function (state, str) {
        return str;
    },
    "@DOI/true": function (state, str) {
        return str;
    }
};

/*

    This does not seem to work in Zotero plugins. For some reason the scope of the link does not
    close when interpreted by the LibreOffice. Perhaps this creates a field within a field,
    and that is not allowed?

    "@URL/true": function (state, str) {
        return "\\field{\\*\\fldinst{HYPERLINK \"" + str + "\"}}{\\fldrslt{"+ str +"}}";
    },
    "@DOI/true": function (state, str) {
        return "\\field{\\*\\fldinst{HYPERLINK \"https://doi.org/" + str + "\"}}{\\fldrslt{"+ str +"}}";
    }
*/

/**
 * AsciiDoc output specification.
 *
 * See http://asciidoc.org/ or https://asciidoctor.org/
 */
CSL.Output.Formats.prototype.asciidoc = {
    "text_escape": function (text) {
        if (!text) {
            text = "";
        }
        return text.replace("*", "pass:[*]", "g")
            .replace("_", "pass:[_]", "g")
            .replace("#", "pass:[#]", "g")
            .replace("^", "pass:[^]", "g")
            .replace("~", "pass:[~]", "g")
            .replace("[[", "pass:[[[]", "g")
            .replace("  ", "&#160; ", "g")
            .replace(CSL.SUPERSCRIPTS_REGEXP, function(aChar) {
                return "^" + CSL.SUPERSCRIPTS[aChar] + "^";
            });
    },
    "bibstart": "",
    "bibend": "",
    "@passthrough/true": CSL.Output.Formatters.passthrough,
    "@font-style/italic": "__%%STRING%%__",
    "@font-style/oblique": "__%%STRING%%__",
    "@font-style/normal": false,
    "@font-variant/small-caps": "[small-caps]#%%STRING%%#",
    "@font-variant/normal": false,
    "@font-weight/bold": "**%%STRING%%**",
    "@font-weight/normal": false,
    "@font-weight/light": false,
    "@text-decoration/none": false,
    "@text-decoration/underline": "[underline]##%%STRING%%##",
    "@vertical-align/sup": "^^%%STRING%%^^",
    "@vertical-align/sub": "~~%%STRING%%~~",
    "@vertical-align/baseline": false,
    "@strip-periods/true": CSL.Output.Formatters.passthrough,
    "@strip-periods/false": CSL.Output.Formatters.passthrough,
    "@quotes/true": function (state, str) {
        if ("undefined" === typeof str) {
            return "``";
        }
        return "``" + str + "''";
    },
    "@quotes/inner": function (state, str) {
        if ("undefined" === typeof str) {
            return "`";
        }
        return "`" + str + "'";
    },
    "@quotes/false": false,
    "@cite/entry": function (state, str) {
        // if wrapCitationEntry does not exist, cite/entry is not applied
        return state.sys.wrapCitationEntry(str, this.item_id, this.locator_txt, this.suffix_txt);
    },
    "@bibliography/entry": function (state, str) {
        return str + "\n";
    },
    "@display/block": function (state, str) {
        return str;
    },
    "@display/left-margin": function (state, str) {
        return str;
    },
    "@display/right-inline": function (state, str) {
        return " " + str;
    },
    "@display/indent": function (state, str) {
        return " " + str;
    },
    "@showid/true": function (state, str) {
        if (!state.tmp.just_looking && !state.tmp.suppress_decorations && this.params && "string" === typeof str) {
            var prePunct = "";
            if (str) {
                var m = str.match(CSL.VARIABLE_WRAPPER_PREPUNCT_REX);
                prePunct = m[1];
                str = m[2];
            }
            var postPunct = "";
            if (str && CSL.SWAPPING_PUNCTUATION.indexOf(str.slice(-1)) > -1) {
                postPunct = str.slice(-1);
                str = str.slice(0,-1);
            }
            return state.sys.variableWrapper(this.params, prePunct, str, postPunct);
        } else {
            return str;
        }
    },
    "@URL/true": function (state, str) {
        // AsciiDoc renders URLs automatically as links
        return str;
    },
    "@DOI/true": function (state, str) {
        var doiurl = str;
        if (!str.match(/^https?:\/\//)) {
            doiurl = "https://doi.org/" + str;
        }
        return doiurl + "[" + str + "]";
    }
};

/**
 * Output specification for XSL-FO (Extensible Stylesheet
 * Language - Formatting Objects)
 *
 * See https://www.w3.org/TR/xsl11/#fo-section
 */
CSL.Output.Formats.prototype.fo = {
    "text_escape": function (text) {
        if (!text) {
            text = "";
        }
        return text.replace(/&/g, "&#38;")
            .replace(/</g, "&#60;")
            .replace(/>/g, "&#62;")
            .replace("  ", "&#160; ", "g")
            .replace(CSL.SUPERSCRIPTS_REGEXP, function(aChar) {
                return "<fo:inline vertical-align=\"super\">" + CSL.SUPERSCRIPTS[aChar] + "</fo:inline>";
            });
    },
    "bibstart": "",
    "bibend": "",
    "@passthrough/true": CSL.Output.Formatters.passthrough,
    "@font-style/italic": "<fo:inline font-style=\"italic\">%%STRING%%</fo:inline>",
    "@font-style/oblique": "<fo:inline font-style=\"oblique\">%%STRING%%</fo:inline>",
    "@font-style/normal": "<fo:inline font-style=\"normal\">%%STRING%%</fo:inline>",
    "@font-variant/small-caps": "<fo:inline font-variant=\"small-caps\">%%STRING%%</fo:inline>",
    "@font-variant/normal": "<fo:inline font-variant=\"normal\">%%STRING%%</fo:inline>",
    "@font-weight/bold": "<fo:inline font-weight=\"bold\">%%STRING%%</fo:inline>",
    "@font-weight/normal": "<fo:inline font-weight=\"normal\">%%STRING%%</fo:inline>",
    "@font-weight/light": "<fo:inline font-weight=\"lighter\">%%STRING%%</fo:inline>",
    "@text-decoration/none": "<fo:inline text-decoration=\"none\">%%STRING%%</fo:inline>",
    "@text-decoration/underline": "<fo:inline text-decoration=\"underline\">%%STRING%%</fo:inline>",
    "@vertical-align/sup": "<fo:inline vertical-align=\"super\">%%STRING%%</fo:inline>",
    "@vertical-align/sub": "<fo:inline vertical-align=\"sub\">%%STRING%%</fo:inline>",
    "@vertical-align/baseline": "<fo:inline vertical-align=\"baseline\">%%STRING%%</fo:inline>",
    "@strip-periods/true": CSL.Output.Formatters.passthrough,
    "@strip-periods/false": CSL.Output.Formatters.passthrough,
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
    "@cite/entry": function (state, str) {
        return state.sys.wrapCitationEntry(str, this.item_id, this.locator_txt, this.suffix_txt);
    },
    "@bibliography/entry": function (state, str) {
        var indent = "";
        if (state.bibliography && state.bibliography.opt && state.bibliography.opt.hangingindent) {
            var hi = state.bibliography.opt.hangingindent;
            indent = " start-indent=\"" + hi +"em\" text-indent=\"-" + hi + "em\"";
        }
        var insert = "";
        if (state.sys.embedBibliographyEntry) {
            insert = state.sys.embedBibliographyEntry(this.item_id) + "\n";
        }
        return "<fo:block id=\"" + this.system_id + "\"" + indent + ">" + str + "</fo:block>\n" + insert;
    },
    "@display/block": function (state, str) {
        return "\n  <fo:block>" + str + "</fo:block>\n";
    },
    "@display/left-margin": function (state, str) {
        return "\n  <fo:table table-layout=\"fixed\" width=\"100%\">\n    " +
                "<fo:table-column column-number=\"1\" column-width=\"$$$__COLUMN_WIDTH_1__$$$\"/>\n    " +
                "<fo:table-column column-number=\"2\" column-width=\"proportional-column-width(1)\"/>\n    " +
                "<fo:table-body>\n      " +
                    "<fo:table-row>\n        " +
                        "<fo:table-cell>\n          " +
                            "<fo:block>" + str + "</fo:block>\n        " +
                        "</fo:table-cell>\n        ";
    },
    "@display/right-inline": function (state, str) {
        return "<fo:table-cell>\n          " +
                "<fo:block>" + str + "</fo:block>\n        " +
            "</fo:table-cell>\n      " +
            "</fo:table-row>\n    " +
            "</fo:table-body>\n  " +
            "</fo:table>\n";
    },
    "@display/indent": function (state, str) {
        return "<fo:block margin-left=\"2em\">" + str + "</fo:block>\n";
    },
    "@showid/true": function (state, str) {
        if (!state.tmp.just_looking && !state.tmp.suppress_decorations && this.params && "string" === typeof str) {
            var prePunct = "";
            if (str) {
                var m = str.match(CSL.VARIABLE_WRAPPER_PREPUNCT_REX);
                prePunct = m[1];
                str = m[2];
            }
            var postPunct = "";
            if (str && CSL.SWAPPING_PUNCTUATION.indexOf(str.slice(-1)) > -1) {
                postPunct = str.slice(-1);
                str = str.slice(0,-1);
            }
            return state.sys.variableWrapper(this.params, prePunct, str, postPunct);
        } else {
            return str;
        }
    },
    "@URL/true": function (state, str) {
        return "<fo:basic-link external-destination=\"url('" + str + "')\">" + str + "</fo:basic-link>";
    },
    "@DOI/true": function (state, str) {
        var doiurl = str;
        if (!str.match(/^https?:\/\//)) {
            doiurl = "https://doi.org/" + str;
        }
        return "<fo:basic-link external-destination=\"url('" + doiurl + "')\">" + str + "</fo:basic-link>";
    }
};

/**
 * LaTeX .bbl output.
 *
 * (Code contributed by Egon Willighagen, based on the prototype.text code.)
 */
CSL.Output.Formats.prototype.latex = {
    "text_escape": function (text) {
        if (!text) {
            text = "";
        }
        return text;
    },
    "bibstart": "\\begin{thebibliography}{4}",
    "bibend": "\end{thebibliography}",
    "@font-style/italic": "{\\em %%STRING%%}",
    "@font-style/oblique": false,
    "@font-style/normal": false,
    "@font-variant/small-caps": false,
    "@passthrough/true": CSL.Output.Formatters.passthrough,
    "@font-variant/normal": false,
    "@font-weight/bold": "{\\bf %%STRING%%}",
    "@font-weight/normal": false,
    "@font-weight/light": false,
    "@text-decoration/none": false,
    "@text-decoration/underline": false,
    "@vertical-align/baseline": false,
    "@vertical-align/sup": false,
    "@vertical-align/sub": false,
    "@strip-periods/true": CSL.Output.Formatters.passthrough,
    "@strip-periods/false": CSL.Output.Formatters.passthrough,
    "@quotes/true": function (state, str) {
        if ("undefined" === typeof str) {
            return state.getTerm("open-quote");
        }
        return state.getTerm("open-quote") + str + state.getTerm("close-quote");
    },
    "@quotes/inner": function (state, str) {
        if ("undefined" === typeof str) {
            //
            // Mostly right by being wrong (for apostrophes)
            //
            return "\u2019";
        }
        return state.getTerm("open-inner-quote") + str + state.getTerm("close-inner-quote");
    },
    "@quotes/false": false,
    //"@bibliography/body": function (state,str){
    //    return "<div class=\"csl-bib-body\">\n"+str+"</div>";
    //},
    "@cite/entry": function (state, str) {
		return state.sys.wrapCitationEntry(str, this.item_id, this.locator_txt, this.suffix_txt);
	},
    "@bibliography/entry": function (state, str) {
        return "\\bibitem{" + state.sys.embedBibliographyEntry(this.item_id) + "}\n";
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
    },
    "@showid/true": function (state, str, cslid) {
        return str;
    },
    "@URL/true": function (state, str) {
        return str;
    },
    "@DOI/true": function (state, str) {
        return str;
    }
};

CSL.Output.Formats = new CSL.Output.Formats();

/*global CSL: true */


//
// Time for a rewrite of this module.
//
// Simon has pointed out that list and hash behavior can
// be obtained by ... just using a list and a hash.  This
// is faster for batched operations, because sorting is
// greatly optimized.  Since most of the interaction
// with plugins at runtime will involve batches of
// references, there will be solid gains if the current,
// one-reference-at-a-time approach implemented here
// can be replaced with something that leverages the native
// sort method of the Array() type.
//
// That's going to take some redesign, but it will simplify
// things in the long run, so it might as well happen now.
//
// We'll keep makeCitationCluster and makeBibliography as
// simple methods that return a string.  Neither should
// have any effect on internal state.  This will be a change
// in behavior for makeCitationCluster.
//
// A new updateItems command will be introduced, to replace
// insertItems.  It will be a simple list of IDs, in the
// sequence of first reference in the document.
//
// The calling application should always invoke updateItems
// before makeCitationCluster.
//

//
// should allow batched registration of items by
// key.  should behave as an update, with deletion
// of items and the tainting of disambiguation
// partner sets affected by a deletes and additions.
//
//
// we'll need a reset method, to clear the decks
// in the citation area and start over.

/**
 * Registry of cited items.
 * <p>This is a persistent store of disambiguation and
 * sort order information relating to individual items
 * for which rendering is requested.  Item data is stored
 * in a hash, with the item key as hash key, for quick
 * retrieval.  A virtual sequence within the hashed store
 * is maintained on the fly as items are added to the
 * store, using <code>*_next</code> and <code>*_prev</code>
 * attributes on each item.  A separate hash of items
 * based on their undisambiguated cite form is
 * maintained, and the item id list and disambiguation
 * level for each set of disambiguation partners is shared
 * through the registry item.</p>
 * @class
 */
CSL.Registry = function (state) {
    this.debug = false;
    this.state = state;
    this.registry = {};
    this.reflist = [];
    this.refhash = {};
    this.namereg = new CSL.Registry.NameReg(state);
    this.citationreg = new CSL.Registry.CitationReg(state);
    // See CSL.NameOutput.prototype.outputNames
    // and CSL.Registry.prototype.doinserts
    this.authorstrings = {};

    //
    // shared scratch vars
    this.mylist = [];
    this.myhash = {};
    this.deletes = [];
    this.inserts = [];
    this.uncited = {};
    this.refreshes = {};
    this.akeys = {};
    this.oldseq = {};
    this.return_data = {};
    //
    // each ambig is a list of the ids of other objects
    // that have the same base-level rendering
    this.ambigcites = {};
    this.ambigresets = {};
    this.sorter = new CSL.Registry.Comparifier(state, "bibliography_sort");
    //this.modes = CSL.getModes.call(this.state);
    //this.checkerator = new CSL.Checkerator();

    this.getSortedIds = function () {
        var ret = [];
        for (var i = 0, ilen = this.reflist.length; i < ilen; i += 1) {
            ret.push("" + this.reflist[i].id);
        }
        return ret;
    };

    this.getSortedRegistryItems = function () {
        var ret = [];
        for (var i = 0, ilen = this.reflist.length; i < ilen; i += 1) {
            ret.push(this.reflist[i]);
        }
        return ret;
    };
};

//
// Here's the sequence of operations to be performed on
// update:
//
//  1.  (o) [init] Receive list as function argument, store as hash and as list.
//  2.  (o) [init] Initialize refresh list.  Never needs sorting, only hash required.

//  3.  (o) [dodeletes] Delete loop.
//  3a. (o) [dodeletes] Delete names in items to be deleted from names reg.
//  3b. (o) [dodeletes] Complement refreshes list with items affected by
//      possible name changes.  We'll actually perform the refresh once
//      all of the necessary data and parameters have been established
//      in the registry.
//  3c. (o) [dodeletes] Delete all items to be deleted from their disambig pools.
//  3d. (o) [dodeletes] Delete all items in deletion list from hash.

//  4.  (o) [doinserts] Insert loop.
//  4a. (o) [doinserts] Retrieve entries for items to insert.
//  4b. (o) [doinserts] Generate ambig key.
//  4c. (o) [doinserts] Add names in items to be inserted to names reg
//      (implicit in getAmbiguousCite).
//  4d. (o) [doinserts] Record ambig pool key on akey list (used for updating further
//      down the chain).
//  4e. (o) [doinserts] Create registry token.
//  4f. (o) [doinserts] Add item ID to hash.
//  4g. (o) [doinserts] Set and record the base token to hold disambiguation
//      results ("disambig" in the object above).
//  5.  (o) [rebuildlist] Create "new" list of hash pointers, in the order given
//          in the argument to the update function.
//  6.  (o) [rebuildlist] Apply citation numbers to new list.
//  7.  (o) [dorefreshes] Refresh items requiring update.



//  5. (o) [delnames] Delete names in items to be deleted from names reg, and obtain IDs
//         of other items that would be affected by changes around that surname.
//  6. (o) [delnames] Complement delete and insert lists with items affected by
//         possible name changes.
//  7. (o) [delambigs] Delete all items to be deleted from their disambig pools.
//  8. (o) [delhash] Delete all items in deletion list from hash.

//  9. (o) [addtohash] Retrieve entries for items to insert.
// 10. (o) [addtohash] Add items to be inserted to their disambig pools.
// 11. (o) [addtohash] Add names in items to be inserted to names reg
//         (implicit in getAmbiguousCite).
// 12. (o) [addtohash] Create registry token for each item to be inserted.
// 13. (o) [addtohash] Add items for insert to hash.

// 14. (o) [buildlist] Create "new" list of hash pointers, in the order given in the argument
//         to the update function.
// 15. (o) [renumber] Apply citation numbers to new list.
// 16. (o) [setdisambigs] Set disambiguation parameters on each inserted item token.
// 17. (o) [setsortkeys] Set sort keys on each item token.
// 18. (o) [sorttokens] Resort token list
// 19. (o) [renumber] Reset citation numbers on list items
//

CSL.Registry.prototype.init = function (itemIDs, uncited_flag) {
    var i, ilen;
    this.oldseq = {};
    //  1. Receive list as function argument, store as hash and as list.
    //
    // Result:
    //   this.mylist: a list of all itemIDs of referenced items, cited and uncited.
    //   this.myhash: a hash of index positions in this.mylist.
    //   this.uncited: hash of uncited itemIDs.
    //
    // Proceed as follows.
    //
    if (uncited_flag) {
        // If uncited_flag is non-nil, add any missing itemIDs to this.mylist
        // from itemIDs input list, and set the itemIDs in itemIDs on this.uncited.
        this.uncited = {};
        for (var i=0,ilen=itemIDs.length;i<ilen; i += 1) {
            if (!this.myhash[itemIDs[i]]) {
                this.mylist.push("" + itemIDs[i]);
            }
            this.uncited[itemIDs[i]] = true;
            this.myhash[itemIDs[i]] = true;
        }
    } else {
        // If uncited_flag is nil, remove duplicate itemIDs from itemIDs input
        // list, set the result on this.mylist, and add missing itemIDs to
        // this.mylist from itemIDs input list.
        for (var key in this.uncited) {
            itemIDs.push(key);
        }
        var myhash = {};
        for (i=itemIDs.length-1;i>-1; i += -1) {
            if (myhash[itemIDs[i]]) {
                itemIDs = itemIDs.slice(0, i).concat(itemIDs.slice(i + 1));
            } else {
                myhash[itemIDs[i]] = true;
            }
        }
        this.mylist = itemIDs;
        this.myhash = myhash;
    }
    //
    //  2. Initialize refresh list.  Never needs sorting, only hash required.
    //
    this.refreshes = {};
    this.touched = {};
    this.ambigsTouched = {};
    this.ambigresets = {};
};

CSL.Registry.prototype.dopurge = function (myhash) {
    // Remove any uncited items not in myhash
    for (var i=this.mylist.length-1;i>-1;i+=-1) {
        // Might not want to be quite this restrictive.
        if (this.citationreg.citationsByItemId) {
            if (!this.citationreg.citationsByItemId[this.mylist[i]] && !myhash[this.mylist[i]]) {
                delete this.myhash[this.mylist[i]];
                this.mylist = this.mylist.slice(0,i).concat(this.mylist.slice(i+1));
            }
        }
    }
    this.dodeletes(this.myhash);
};

CSL.Registry.prototype.dodeletes = function (myhash) {
    var otheritems, key, ambig, pos, len, items, kkey, mypos, id;
    if ("string" === typeof myhash) {
        var key = myhash;
        myhash = {};
        myhash[key] = true;
    }
    //
    //  3. Delete loop.
    //
    for (var key in this.registry) {
        if (!myhash[key]) {
            // skip items explicitly marked as uncited
            if (this.uncited[key]) {
                continue;
            }
            //
            //  3a. Delete names in items to be deleted from names reg.
            //
            otheritems = this.namereg.delitems(key);
            //
            //  3b. Complement refreshes list with items affected by
            //      possible name changes.  We'll actually perform the refresh once
            //      all of the necessary data and parameters have been established
            //      in the registry.
            //
            for (kkey in otheritems) {
                this.refreshes[kkey] = true;
            }
            //
            //  3c. Delete all items to be deleted from their disambig pools.
            //
            ambig = this.registry[key].ambig;
            mypos = this.ambigcites[ambig].indexOf(key);
            if (mypos > -1) {
                items = this.ambigcites[ambig].slice();
                this.ambigcites[ambig] = items.slice(0, mypos).concat(items.slice(mypos+1, items.length));
                this.ambigresets[ambig] = this.ambigcites[ambig].length;
            }
            //
            // XX. What we've missed is to provide an update of all
            // items sharing the same ambig  += -1 the remaining items in
            // ambigcites.  So let's do that here, just in case the
            // names update above doesn't catch them all.
            //
            len = this.ambigcites[ambig].length;
            for (pos = 0; pos < len; pos += 1) {
                id = "" + this.ambigcites[ambig][pos];
                this.refreshes[id] = true;
            }
            //
            // 3d-0. Remove parallel id references and realign
            // parallel ID refs.
            //
            if (this.registry[key].siblings) {
                if (this.registry[key].siblings.length == 1) {
                    var loneSiblingID = this.registry[key].siblings[0];
                    this.registry[loneSiblingID].master = true;
                    this.registry[loneSiblingID].siblings.pop();
                    this.registry[loneSiblingID].parallel = false;
                } else if (this.registry[key].siblings.length > 1) {
                    var removeIDs = [key];
                    if (this.registry[key].master) {
                        var newmasterID = this.registry[key].siblings[0];
                        var newmaster = this.registry[newmasterID];
                        newmaster.master = true;
                        newmaster.parallel = false;
                        removeIDs.push(newmasterID);
                        for (var k = 0, klen = this.registry[key].siblings.length; k < klen; k += 1) {
                            this.registry[this.registry[key].siblings[k]].parallel = newmasterID;
                        }
                    }
                    var buffer = [];
                    for (var k = this.registry[key].siblings.length - 1; k > -1; k += -1) {
                        var siblingID = this.registry[key].siblings.pop();
                        if (removeIDs.indexOf(siblingID) === -1) {
                            buffer.push(siblingID);
                        }
                    }
                    for (var k = buffer.length - 1; k > -1; k += -1) {
                        this.registry[key].siblings.push(buffer[k]);
                    }
                }
            }
            //
            // 3d-1. Remove item from reflist
            for (var i=this.reflist.length-1;i>-1;i--) {
                if (this.reflist[i].id === key) {
                    this.reflist = this.reflist.slice(0, i).concat(this.reflist.slice(i+1));
                }
            }
            //
            //  3d. Delete all items in deletion list from hash.
            //
            delete this.registry[key];
            delete this.refhash[key];

            // For processCitationCluster()
            this.return_data.bibchange = true;
        }
    }
    // Disabled.  See formats.js for code.
    // this.state.fun.decorate.items_delete( this.state.output[this.state.opt.mode].tmp, myhash );
};

CSL.Registry.prototype.doinserts = function (mylist) {
    var item, Item, akey, newitem, abase, i, ilen;
    if ("string" === typeof mylist) {
        mylist = [mylist];
    }
    //
    //  4. Insert loop.
    //
    for (var i = 0, ilen = mylist.length; i < ilen; i += 1) {
        item = mylist[i];
        if (!this.registry[item]) {
            //
            //  4a. Retrieve entries for items to insert.
            //
            Item = this.state.retrieveItem(item);

            //
            //  4b. Generate ambig key.
            //
            // AND
            //
            //  4c. Add names in items to be inserted to names reg
            //      (implicit in getAmbiguousCite).
            //
            akey = CSL.getAmbiguousCite.call(this.state, Item);
            this.ambigsTouched[akey] = true;
            //
            //  4d. Record ambig pool key on akey list (used for updating further
            //      down the chain).
            //
            if (!Item.legislation_id) {
                this.akeys[akey] = true;
            }
            //
            //  4e. Create registry token.
            //
            newitem = {
                "id": "" + item,
                "seq": 0,
                "offset": 0,
                "sortkeys": false,
                "ambig": false,
                "rendered": false,
                "disambig": false,
                "ref": Item,
                "newItem": true
            };
            //
            //
            //  4f. Add item ID to hash.
            //
            this.registry[item] = newitem;
            //
            //  4f(a). Add first reference note number
            //         (this may be redundant)
            if (this.citationreg.citationsByItemId && this.citationreg.citationsByItemId[item]) {
                this.registry[item]["first-reference-note-number"] = this.citationreg.citationsByItemId[item][0].properties.noteIndex;
            }

            //
            //  4g. Set and record the base token to hold disambiguation
            //      results ("disambig" in the object above).
            //
            abase = CSL.getAmbigConfig.call(this.state);
            this.registerAmbigToken(akey, item, abase);

            //if (!this.ambigcites[akey]){
            //    this.ambigcites[akey] = [];
            //}
            //CSL.debug("Run: "+item+"("+this.ambigcites[akey]+")");
            //if (this.ambigcites[akey].indexOf(item) === -1){
            //    CSL.debug("  Add: "+item);
            //    this.ambigcites[akey].push(item);
            //}
            //
            //  4h. Make a note that this item needs its sort keys refreshed.
            //
            this.touched[item] = true;
            // For processCitationCluster()
            this.return_data.bibchange = true;
        }
    }
    // Disabled.  See formats.js for code.
    // this.state.fun.decorate.items_add( this.state.output[this.state.opt.mode].tmp, mylist );
};

/*
// No longer required.
CSL.Registry.prototype.douncited = function () {
    var pos, len;
    var cited_len = this.mylist.length - this.uncited.length;
    for (pos = 0, len = cited_len; pos < len; pos += 1) {
        this.registry[this.mylist[pos]].uncited = false;
    }
    for (pos = cited_len, len = this.mylist.length; pos < len; pos += 1) {
        this.registry[this.mylist[pos]].uncited = true;
    }
};
*/

CSL.Registry.prototype.rebuildlist = function (nosort) {
    var len, pos, item, Item;
    //
    //  5. Create "new" list of hash pointers, in the order given in the argument
    //     to the update function.
    //
    //
    // XXX Keep reflist in place.
    //
    if (!nosort) {
        this.reflist_inserts = [];
        //
        //  6. Apply citation numbers to new list,
        //     saving off old sequence numbers as we go.
        //
        // XXX Just memo inserts -- actual insert happens below, at last "sort"
        //
        len = this.mylist.length;
        for (pos = 0; pos < len; pos += 1) {
            item = this.mylist[pos];
            Item = this.registry[item];
            if (Item.newItem) {
                this.reflist_inserts.push(Item);
            }
            this.oldseq[item] = this.registry[item].seq;
            this.registry[item].seq = (pos + 1);
        }
    } else {
        this.reflist = [];
        len = this.mylist.length;
        for (pos = 0; pos < len; pos += 1) {
            item = this.mylist[pos];
            Item = this.registry[item];
            this.reflist.push(Item);
            this.oldseq[item] = this.registry[item].seq;
            this.registry[item].seq = (pos + 1);
        }
    }
};

/*
 * Okay, at this point we should have a numbered list
 * of registry tokens in the notional order requested,
 * with sequence numbers to reconstruct the ordering
 * if the list is remangled.  So far so good.
 */

CSL.Registry.prototype.dorefreshes = function () {
    var key, regtoken, Item, akey, abase;
    //
    //  7. Refresh items requiring update.
    //
    // It looks like we need to do four things on each cite for refresh:
    // (1) Generate the akey for the cite.
    // (2) Register it on the ambig token.
    // (3) Register the akey in this.akeys
    // (4) Register the item ID in this.touched
    //
    for (var key in this.refreshes) {
        regtoken = this.registry[key];
        if (!regtoken) {
            continue;
        }
        regtoken.sortkeys = undefined;
        Item = this.state.refetchItem(key);
        var akey = regtoken.ambig;

        if ("undefined" === typeof akey) {
            this.state.tmp.disambig_settings = false;
            akey = CSL.getAmbiguousCite.call(this.state, Item);
            abase = CSL.getAmbigConfig.call(this.state);
            this.registerAmbigToken(akey, key, abase);
        }
        for (var akkey in this.ambigresets) {
            if (this.ambigresets[akkey] === 1) {
                var loneKey = this.ambigcites[akey][0];
                var Item = this.state.refetchItem(loneKey);
                this.registry[loneKey].disambig = new CSL.AmbigConfig();
                this.state.tmp.disambig_settings = false;
                var akey = CSL.getAmbiguousCite.call(this.state, Item);
                var abase = CSL.getAmbigConfig.call(this.state);
                this.registerAmbigToken(akey, loneKey, abase);
            }
        }
        this.state.tmp.taintedItemIDs[key] = true;
        this.ambigsTouched[akey] = true;
        if (!Item.legislation_id) {
            this.akeys[akey] = true;
        }
        this.touched[key] = true;
    }
};

/*
 * Main disambiguation  += -1 can everything for disambiguation be
 * crunched into this function?
 */
CSL.Registry.prototype.setdisambigs = function () {
    //
    // Okay, more changes.  Here is where we resolve all disambiguation
    // issues for cites touched by the update.  The this.ambigcites set is
    // based on the complete short form of citations, and is the basis on
    // which names are added and minimal adding of initials or given names
    // is performed.
    //

    //
    //  8.  Set disambiguation parameters on each inserted item token.
    //
    for (var akey in this.ambigsTouched) {
        //
        // Disambiguation is fully encapsulated.
        // Disambiguator will run only if there are multiple
        // items, and at least one disambiguation mode is
        // in effect.
        this.state.disambiguate.run(akey);
    }
    this.ambigsTouched = {};
    this.akeys = {};
};



CSL.Registry.prototype.renumber = function () {
    var len, pos, item;
    //
    // 19. Reset citation numbers on list items
    //
    if (this.state.bibliography_sort.opt.citation_number_sort_direction === CSL.DESCENDING) {
        this.state.bibliography_sort.tmp.citation_number_map = {};
    }
    len = this.reflist.length;
    for (pos = 0; pos < len; pos += 1) {
        item = this.reflist[pos];
        // save the overhead of rerenderings if citation-number is not
        // used in the style.
        item.seq = (pos + 1);
        if (this.state.bibliography_sort.opt.citation_number_sort_direction === CSL.DESCENDING) {
            this.state.bibliography_sort.tmp.citation_number_map[item.seq] = (this.reflist.length - item.seq + 1);
        }
        // update_mode is set to CSL.NUMERIC if citation-number is rendered
        // in citations.
        if (this.state.opt.update_mode === CSL.NUMERIC && item.seq != this.oldseq[item.id]) {
            this.state.tmp.taintedItemIDs[item.id] = true;
        }
        if (item.seq != this.oldseq[item.id]) {
            this.return_data.bibchange = true;
        }
    }
};

CSL.Registry.prototype.setsortkeys = function () {
    var key;
    //
    // 17. Set sort keys on each item token.
    //
    for (var i = 0, ilen = this.mylist.length; i < ilen; i += 1) {
        var key = this.mylist[i];
        // The last of these conditions may create some thrashing on styles that do not require sorting.
        if (this.touched[key] || this.state.tmp.taintedItemIDs[key] || !this.registry[key].sortkeys) {
            this.registry[key].sortkeys = CSL.getSortKeys.call(this.state, this.state.retrieveItem(key), "bibliography_sort");
        }
    }
};

CSL.Registry.prototype._insertItem = function(element, array) {
    array.splice(this._locationOf(element, array) + 1, 0, element);
    return array;
};

CSL.Registry.prototype._locationOf = function(element, array, start, end) {
    if (array.length === 0) {
        return -1;
    }
    start = start || 0;
    end = end || array.length;
    var pivot = (start + end) >> 1;  // should be faster than dividing by 2
    
    var c = this.sorter.compareKeys(element, array[pivot]);
    if (end - start <= 1) {
        return c == -1 ? pivot - 1 : pivot;
    }
    switch (c) {
        case -1: return this._locationOf(element, array, start, pivot);
        case 0: return pivot;
        case 1: return this._locationOf(element, array, pivot, end);
    }
};

CSL.Registry.prototype.sorttokens = function (nosort) {
    var len, item, Item, pos;
    //
    // 18. Resort token list.
    //
    if (!nosort) {
        this.reflist_inserts = [];
        len = this.mylist.length;
        for (pos = 0; pos < len; pos += 1) {
            item = this.mylist[pos];
            Item = this.registry[item];
            if (Item.newItem) {
                this.reflist_inserts.push(Item);
            }
        }
        // There is a thin possibility that tainted items in a sorted list
        // will change position due to disambiguation. We cover for that here.
        for (var key in this.state.tmp.taintedItemIDs) {
            if (this.registry[key] && !this.registry[key].newItem) {
                // Move tainted items from reflist to reflist_inserts
                for (var i=this.reflist.length-1;i>-1;i--) {
                    if (this.reflist[i].id === key) {
                        this.reflist_inserts.push(this.reflist[i]);
                        this.reflist = this.reflist.slice(0, i).concat(this.reflist.slice(i+1));
                    }
                }
            }
        }
        for (var i=0,ilen=this.reflist_inserts.length;i<ilen;i++) {
            var Item = this.reflist_inserts[i];
            delete Item.newItem;
            this.reflist = this._insertItem(Item, this.reflist);
        }
        for (pos = 0; pos < len; pos += 1) {
            item = this.mylist[pos];
            Item = this.registry[item];
            this.registry[item].seq = (pos + 1);
        }
    }
};

/**
 * Compare two sort keys
 * <p>Nested, because keys are an array.</p>
 */
CSL.Registry.Comparifier = function (state, keyset) {
    var sort_directions, len, pos, compareKeys;
    var sortCompare = CSL.getSortCompare(state.opt["default-locale-sort"]);
    sort_directions = state[keyset].opt.sort_directions;
    this.compareKeys = function (a, b) {
        len = a.sortkeys ? a.sortkeys.length : 0;
        for (pos = 0; pos < len; pos += 1) {
            //
            // for ascending sort 1 uses 1, -1 uses -1.
            // For descending sort, the values are reversed.
            //
            // Need to handle undefined values.  No way around it.
            // So have to screen .localeCompare (which is also
            // needed) from undefined values.  Everywhere, in all
            // compares.
            //
            var cmp = 0;
            if (a.sortkeys[pos] === b.sortkeys[pos]) {
                cmp = 0;
            } else if ("undefined" === typeof a.sortkeys[pos]) {
                cmp = sort_directions[pos][1];
            } else if ("undefined" === typeof b.sortkeys[pos]) {
                cmp = sort_directions[pos][0];
            } else {
                // cmp = a.sortkeys[pos].localeCompare(b.sortkeys[pos]);
                cmp = sortCompare(a.sortkeys[pos], b.sortkeys[pos]);
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


/**
 * Compare two disambiguation tokens by their registry sort order
 * <p>Disambiguation lists need to be sorted this way, to
 * obtain the correct year-suffix when that's used.</p>
 */
CSL.Registry.prototype.compareRegistryTokens = function (a, b) {
    if (a.seq > b.seq) {
        return 1;
    } else if (a.seq < b.seq) {
        return -1;
    }
    return 0;
};

CSL.Registry.prototype.registerAmbigToken = function (akey, id, ambig_config) {
    //SNIP-START
    if (!this.registry[id]) {
        CSL.debug("Warning: unregistered item: itemID=("+id+"), akey=("+akey+")");
    }
    //SNIP-END
    // Taint if number of names to be included has changed
    if (this.registry[id] && this.registry[id].disambig && this.registry[id].disambig.names) {
        for (var i = 0, ilen = ambig_config.names.length; i < ilen; i += 1) {
            var new_names_params = ambig_config.names[i];
            var old_names_params = this.registry[id].disambig.names[i];
            if (new_names_params !== old_names_params) {
                this.state.tmp.taintedItemIDs[id] = true;
            } else if (ambig_config.givens[i]) {
                // Compare givenses only if the number of names is aligned.
                for (var j=0,jlen=ambig_config.givens[i].length;j<jlen;j+=1) {
                    var new_gnames_params = ambig_config.givens[i][j];
                    var old_gnames_params = this.registry[id].disambig.givens[i][j];
                    if (new_gnames_params !== old_gnames_params) {
                        this.state.tmp.taintedItemIDs[id] = true;
                    }
                }
            }
        }
    }

    if (!this.ambigcites[akey]) {
        this.ambigcites[akey] = [];
    }
    if (this.ambigcites[akey].indexOf("" + id) === -1) {
        this.ambigcites[akey].push("" + id);
    }
    this.registry[id].ambig = akey;
    this.registry[id].disambig = CSL.cloneAmbigConfig(ambig_config);
};


/**
 * Get the sort key of an item, without decorations
 * <p>This is used internally by the Registry.</p>
 */
CSL.getSortKeys = function (Item, key_type) {
    var area, root, extension, strip_prepositions, len, pos;
    //SNIP-START
    if (false) {
        CSL.debug("KEY TYPE: " + key_type);
    }
    //SNIP-END
    area = this.tmp.area;
    root = this.tmp.root;
    extension = this.tmp.extension;
    strip_prepositions = CSL.Util.Sort.strip_prepositions;
    this.tmp.area = key_type;
    // Gawdawful, this.
    this.tmp.root = key_type.indexOf("_") > -1 ? key_type.slice(0,-5) : key_type;
    this.tmp.extension = "_sort";
    this.tmp.disambig_override = true;
    this.tmp.disambig_request = false;
    this.parallel.use_parallels = (this.parallel.use_parallels === true || this.parallel.use_parallels === null) ? null : false;
    this.tmp.suppress_decorations = true;
    CSL.getCite.call(this, Item);
    this.tmp.suppress_decorations = false;
    this.parallel.use_parallels = this.parallel.use_parallels === null ? true : false;
    this.tmp.disambig_override = false;
    len = this[key_type].keys.length;
    for (pos = 0; pos < len; pos += 1) {
        this[key_type].keys[pos] = strip_prepositions(this[key_type].keys[pos]);
    }
    //SNIP-START
    if (false) {
        CSL.debug("sort keys (" + key_type + "): " + this[key_type].keys);
    }
    //SNIP-END
    
    this.tmp.area = area;
    this.tmp.root = root;
    this.tmp.extension = extension;
    return this[key_type].keys;
};


/*global CSL: true */

CSL.Registry.NameReg = function (state) {
    var pkey, ikey, skey, dagopt, gdropt, items, strip_periods, set_keys, evalname, delitems, addname, myitems;
    this.state = state;
    this.namereg = {};
    this.nameind = {};
    // used for restoring state following preview
    this.nameindpkeys = {};
    //
    // family, initials form, fullname (with given stripped of periods)
    //
    // keys registered, indexed by ID
    this.itemkeyreg = {};

    strip_periods = function (str) {
        if (!str) {
            str = "";
        }
        return str.replace(/\./g, " ").replace(/\s+/g, " ").replace(/\s+$/,"");
    };

    set_keys = function (state, itemid, nameobj) {
        pkey = strip_periods(nameobj.family);
        skey = strip_periods(nameobj.given);
        // Drop lowercase suffixes (such as et al.) from given name field
        // for disambiguation purposes.
        var m = skey.match(/[,\!]* ([^,]+)$/);
        if (m && m[1] === m[1].toLowerCase()) {
            skey = skey.replace(/[,\!]* [^,]+$/, "");
        }
        // The %s terminator enables normal initialization behavior
        // with non-Byzantine names.
        ikey = CSL.Util.Names.initializeWith(state, skey, "%s");
        if (state.citation.opt["givenname-disambiguation-rule"] === "by-cite") {
            pkey = "" + itemid + pkey;
        }
    };

    evalname = function (item_id, nameobj, namenum, request_base, form, initials) {
        var param;
        // XXX THIS CAN NO LONGER HAPPEN
        if (state.tmp.area.slice(0, 12) === "bibliography" && !form) {
            if ("string" === typeof initials) {
                return 1;
            } else {
                return 2;
            }
        }
        var res = state.nameOutput.getName(nameobj, "locale-translit", true);
        nameobj = res.name;
        set_keys(this.state, "" + item_id, nameobj);
        //
        // possible options are:
        //
        // <option disambiguate-add-givenname value="true"/> (a)
        // <option disambiguate-add-givenname value="all-names"/> (a)
        // <option disambiguate-add-givenname value="all-names-with-initials"/> (b)
        // <option disambiguate-add-givenname value="primary-name"/> (d)
        // <option disambiguate-add-givenname value="primary-name-with-initials"/> (e)
        // <option disambiguate-add-givenname value="by-cite"/> (g)
        //
        param = 2;
        dagopt = state.opt["disambiguate-add-givenname"];
        gdropt = state.citation.opt["givenname-disambiguation-rule"];
        var gdropt_orig = gdropt;
        if (gdropt === "by-cite") {
            gdropt = "all-names";
        }
        //
        // set initial value
        //
        if ("short" === form) {
            param = 0;
        } else if ("string" === typeof initials) {
            param = 1;
        }
        //
        // give literals a pass
        if ("undefined" === typeof this.namereg[pkey] || "undefined" === typeof this.namereg[pkey].ikey[ikey]) {
            return param;
        }
        //
        // adjust value upward if appropriate -- only if running
        // a non-names-global disambiguation strategy
        //
        if (gdropt_orig === "by-cite" && param <= request_base) {
            //param = request_base;
            return request_base;
        }
        if (!dagopt) {
            return param;
        }
        if ("string" === typeof gdropt && gdropt.slice(0, 12) === "primary-name" && namenum > 0) {
            return param;
        }
        //
        // the last composite condition is for backward compatibility
        //
        if (!gdropt || gdropt === "all-names" || gdropt === "primary-name") {
            if (this.namereg[pkey].count > 1) {
                param = 1;
            }
            if ((this.namereg[pkey].ikey 
                 && this.namereg[pkey].ikey[ikey].count > 1)
                || (this.namereg[pkey].count > 1 
                    && "string" !== typeof initials)) {

                param = 2;
            }
        } else if (gdropt === "all-names-with-initials" || gdropt === "primary-name-with-initials") {
            if (this.namereg[pkey].count > 1) {
                param = 1;
            } else {
                param = 0;
            }
        }
        if (!state.registry.registry[item_id]) {
            if (form == "short") {
                return 0;
            } else if ("string" == typeof initials) {
                return 1;
            }
        } else {
            return param;
        }
    };

    //
    // The operation of this function does not show up in the
    // standard test suite, but it has been hand-tested with
    // a print trace, and seems to work okay.
    //
    delitems = function (ids) {
        var pos, len, posB, id, fullkey;
        if ("string" === typeof ids || "number" === typeof ids) {
            ids = ["" + ids];
        }
        // ret carries the IDs of other items using this name.
        var ret = {};
        len = ids.length;
        for (pos = 0; pos < len; pos += 1) {
            id = "" + ids[pos];
            if (!this.nameind[id]) {
                continue;
            }
            for (fullkey in this.nameind[id]) {
                if (this.nameind[id].hasOwnProperty(fullkey)) {
                    var key = fullkey.split("::");
                    pkey = key[0];
                    ikey = key[1];
                    skey = key[2];
                    // Skip names that have been deleted already.
                    // Needed to clear integration DisambiguateAddGivenname1.txt
                    // and integration DisambiguateAddGivenname2.txt
                    if ("undefined" === typeof this.namereg[pkey]) {
                        continue;
                    }

                    // ????
                    //posA = this.namereg[pkey].items.indexOf(posA);

                    items = this.namereg[pkey].items;
                    // This was really, really unperceptive. They key elements
                    // have absolutely nothing to do with whether there was ever
                    // a registration at each key level.
                    if (skey && this.namereg[pkey].ikey[ikey] && this.namereg[pkey].ikey[ikey].skey[skey]) {
                        myitems = this.namereg[pkey].ikey[ikey].skey[skey].items;
                        posB = myitems.indexOf("" + id);
                        if (posB > -1) {
                            this.namereg[pkey].ikey[ikey].skey[skey].items = myitems.slice(0, posB).concat(myitems.slice([(posB + 1)]));
                        }
                        if (this.namereg[pkey].ikey[ikey].skey[skey].items.length === 0) {
                            delete this.namereg[pkey].ikey[ikey].skey[skey];
                            this.namereg[pkey].ikey[ikey].count += -1;
                            if (this.namereg[pkey].ikey[ikey].count < 2) {
                                for (var i = 0, ilen = this.namereg[pkey].ikey[ikey].items.length; i < ilen; i += 1) {
                                    state.tmp.taintedItemIDs[this.namereg[pkey].ikey[ikey].items[i]] = true;
                                }
                            }
                        }
                    }
                    if (ikey && this.namereg[pkey].ikey[ikey]) {
                        posB = this.namereg[pkey].ikey[ikey].items.indexOf("" + id);
                        if (posB > -1) {
                            items = this.namereg[pkey].ikey[ikey].items.slice();
                            this.namereg[pkey].ikey[ikey].items = items.slice(0, posB).concat(items.slice([posB + 1]));
                        }
                        if (this.namereg[pkey].ikey[ikey].items.length === 0) {
                            delete this.namereg[pkey].ikey[ikey];
                            this.namereg[pkey].count += -1;
                            if (this.namereg[pkey].count < 2) {
                                for (var i = 0, ilen = this.namereg[pkey].items.length; i < ilen; i += 1) {
                                    state.tmp.taintedItemIDs[this.namereg[pkey].items[i]] = true;
                                }
                            }
                        }
                    }
                    if (pkey) {
                        posB = this.namereg[pkey].items.indexOf("" + id);
                        if (posB > -1) {
                            items = this.namereg[pkey].items.slice();
                            this.namereg[pkey].items = items.slice(0, posB).concat(items.slice([posB + 1], items.length));
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
    //
    // Run ALL
    // renderings with disambiguate-add-givenname set to a value
    // with the by-cite behaviour, and then set the names-based
    // expanded form when the final makeCitationCluster rendering
    // is output.  This could be done with a single var set on
    // the state object in the execution wrappers that run the
    // style.
    //
    addname = function (item_id, nameobj, pos) {
        var i, ilen;
        var res = state.nameOutput.getName(nameobj, "locale-translit", true);
        nameobj = res.name;

        if (state.citation.opt["givenname-disambiguation-rule"]
            && state.citation.opt["givenname-disambiguation-rule"].slice(0, 8) === "primary-"
            && pos !== 0) {
                return;
        }
        //CSL.debug("INS");
        set_keys(this.state, "" + item_id, nameobj);
        // pkey, ikey and skey should be stored in separate cascading objects.
        // there should also be a kkey, on each, which holds the item ids using
        // that form of the name.
        //
        // (later note: well, we seem to have slipped a notch here.
        // Adding lists of IDs all over the place here makes no sense;
        // the lists need to include _only_ the items currently rendered
        // at the given level, and the place to do that is in evalname,
        // and in delnames, not here.)
        if (pkey) {
            if ("undefined" === typeof this.namereg[pkey]) {
                this.namereg[pkey] = {};
                this.namereg[pkey].count = 0;
                this.namereg[pkey].ikey = {};
                this.namereg[pkey].items = [item_id];
            } else if (this.namereg[pkey].items.indexOf(item_id) === -1) {
                this.namereg[pkey].items.push(item_id);
            }
//            if (this.namereg[pkey].items.indexOf(item_id) === -1) {
//                this.namereg[pkey].items.push(item_id);
//            }
        }
        if (pkey && ikey) {
            if ("undefined" === typeof this.namereg[pkey].ikey[ikey]) {
                this.namereg[pkey].ikey[ikey] = {};
                this.namereg[pkey].ikey[ikey].count = 0;
                this.namereg[pkey].ikey[ikey].skey = {};
                this.namereg[pkey].ikey[ikey].items = [item_id];
                this.namereg[pkey].count += 1;
                if (this.namereg[pkey].count === 2) {
                    for (var i = 0, ilen = this.namereg[pkey].items.length; i < ilen; i += 1) {
                        state.tmp.taintedItemIDs[this.namereg[pkey].items[i]] = true;
                    }
                }
            } else if (this.namereg[pkey].ikey[ikey].items.indexOf(item_id) === -1) {
                this.namereg[pkey].ikey[ikey].items.push(item_id);
            }
//            if (this.namereg[pkey].ikey[ikey].items.indexOf(item_id) === -1) {
//                this.namereg[pkey].ikey[ikey].items.push(item_id);
//            }
        }
        if (pkey && ikey && skey) {
            if ("undefined" === typeof this.namereg[pkey].ikey[ikey].skey[skey]) {
                this.namereg[pkey].ikey[ikey].skey[skey] = {};
                this.namereg[pkey].ikey[ikey].skey[skey].items = [item_id];
                this.namereg[pkey].ikey[ikey].count += 1;
                if (this.namereg[pkey].ikey[ikey].count === 2) {
                    for (var i = 0, ilen = this.namereg[pkey].ikey[ikey].items.length; i < ilen; i += 1) {
                        state.tmp.taintedItemIDs[this.namereg[pkey].ikey[ikey].items[i]] = true;
                    }
                }
            } else if (this.namereg[pkey].ikey[ikey].skey[skey].items.indexOf(item_id) === -1) {
                this.namereg[pkey].ikey[ikey].skey[skey].items.push(item_id);
            }
//            if (this.namereg[pkey].ikey[ikey].skey[skey].items.indexOf(item_id) === -1) {
//                this.namereg[pkey].ikey[ikey].skey[skey].items.push(item_id);
//            }
        }
        if ("undefined" === typeof this.nameind[item_id]) {
            this.nameind[item_id] = {};
            this.nameindpkeys[item_id] = {};
        }
        //CSL.debug("INS-A: [" + pkey + "] [" + ikey + "] [" + skey + "]");
        if (pkey) {
            this.nameind[item_id][pkey + "::" + ikey + "::" + skey] = true;
            this.nameindpkeys[item_id][pkey] = this.namereg[pkey];
        }
        //CSL.debug("INS-B");
    };
    this.addname = addname;
    this.delitems = delitems;
    this.evalname = evalname;
};

/*global CSL: true */

CSL.Registry.CitationReg = function () {
    this.citationById = {};
    this.citationByIndex = [];
};

/*global CSL: true */

CSL.Disambiguation = function (state) {
    this.state = state;
    this.sys = this.state.sys;
    this.registry = state.registry.registry;
    this.ambigcites = state.registry.ambigcites;
    this.configModes();
    this.debug = false;
};

CSL.Disambiguation.prototype.run = function(akey) {
    if (!this.modes.length) {
        return;
    }
    //SNIP-START
    if (this.debug) {
        print("[A] === RUN ===");
    }
    //SNIP-END
    this.akey = akey;
    if (this.initVars(akey)) {
        this.runDisambig();
    }

};

CSL.Disambiguation.prototype.runDisambig = function () {
    var ismax;
    //SNIP-START
    if (this.debug) {
        print("[C] === runDisambig() ===");
    }
    //SNIP-END
    this.initGivens = true;
    //
    // Length of list may change during processing
    while (this.lists.length) {
        this.gnameset = 0;
        this.gname = 0;
        this.clashes = [1, 0];
        // each list is scanned repeatedly until all
        // items either succeed or ultimately fail.
        while(this.lists[0][1].length) {
            this.listpos = 0;
            if (!this.base) {
                this.base = this.lists[0][0];
            }
            ismax = this.incrementDisambig();
            this.scanItems(this.lists[0]);
            this.evalScan(ismax);
        }
        this.lists = this.lists.slice(1);
    }
};

CSL.Disambiguation.prototype.scanItems = function (list) {
    var pos, len, otherItem;
    //SNIP-START
    if (this.debug) {
        print("[2] === scanItems() ===");
    }
    //SNIP-END

    this.Item = list[1][0];
    this.ItemCite = CSL.getAmbiguousCite.call(this.state, this.Item, this.base, true);

    this.scanlist = list[1];
    this.partners = [];
    this.partners.push(this.Item);
    this.nonpartners = [];
    var clashes = 0;

    for (var pos = 1, len = list[1].length; pos < len; pos += 1) {
        otherItem = list[1][pos];
        var otherItemCite = CSL.getAmbiguousCite.call(this.state, otherItem, this.base, true);
        //SNIP-START
        if (this.debug) {
            if (pos > 1) {
                print("  -----------");
            }
        }
        //SNIP-END
        if (this.ItemCite === otherItemCite) {
            //SNIP-START
            if (this.debug) {
                print("  [CLASH]--> "+this.Item.id+": "+this.ItemCite);
                print("             "+otherItem.id+": "+otherItemCite);
            }
            //SNIP-END
            clashes += 1;
            this.partners.push(otherItem);
        } else {
            //SNIP-START
            if (this.debug) {
                print("  [clear]--> "+this.Item.id+": "+this.ItemCite);
                print("             "+otherItem.id+": "+otherItemCite);
            }
            //SNIP-END
            this.nonpartners.push(otherItem);
        }
    }
    this.clashes[0] = this.clashes[1];
    this.clashes[1] = clashes;
};

CSL.Disambiguation.prototype.evalScan = function (maxed) {
    this[this.modes[this.modeindex]](maxed);
    if (maxed) {
        if (this.modeindex < this.modes.length - 1) {
            this.modeindex += 1;
        } else {
            this.lists[this.listpos + 1] = [this.base, []];
        }
    }
};

CSL.Disambiguation.prototype.disNames = function (ismax) {
    var i, ilen;
    
    //SNIP-START
    if (this.debug) {
        print("[3] == disNames() ==");
        //print("       partners: "+[this.partners[i].id for (i in this.partners)].join(", "));
        //print("    nonpartners: "+[this.nonpartners[i].id for (i in this.nonpartners)].join(", "));
    }
    //SNIP-END

    // New design
    // this.base is a forward-only counter. Values are never
    // reduced, and the counter object is never overwritten.
    // It is methodically pushed forward in single-unit increments
    // in incrementDisambig() until disNames() wipes out the list.

    // this.betterbase is cloned from this.base exactly once,
    // at the start of a disambiguation run. Whenever an operation
    // results in improvement, the just-incremented elements
    // identified as this.base.names[this.gnameset] (number of
    // names)and as this.base.givens[this.gnameset][this.gname]
    // (level of given name) are copied from this.base.

    // The this.base object is used to control disambiguation
    // renderings. These will be more fully expanded than the final
    // text, but the flip side of the fact that the extra data does
    // not contribute anything to disambiguation is that leaving
    // it in does no harm -- think of it as the Cold Dark Matter of
    // disambiguation.

    if (this.clashes[1] === 0 && this.nonpartners.length === 1) {
        this.captureStepToBase();
        //SNIP-START
        if (this.debug) {
            print("  ** RESOLUTION [a]: lone partner, one nonpartner");
            print("  registering "+this.partners[0].id+" and "+this.nonpartners[0].id);
        }
        //SNIP-END
        this.state.registry.registerAmbigToken(this.akey, "" + this.nonpartners[0].id, this.betterbase);
        this.state.registry.registerAmbigToken(this.akey, "" + this.partners[0].id, this.betterbase);
        this.lists[this.listpos] = [this.betterbase, []];
    } else if (this.clashes[1] === 0) {
        this.captureStepToBase();
        //SNIP-START
        if (this.debug) {
            print("  ** RESOLUTION [b]: lone partner, unknown number of remaining nonpartners");
            print("  registering "+this.partners[0].id);
        }
        //SNIP-END
        this.state.registry.registerAmbigToken(this.akey, "" + this.partners[0].id, this.betterbase);
        this.lists[this.listpos] = [this.betterbase, this.nonpartners];
        if (this.nonpartners.length) {
            this.initGivens = true;
        }
    } else if (this.nonpartners.length === 1) {
        this.captureStepToBase();
        //SNIP-START
        if (this.debug) {
            print("  ** RESOLUTION [c]: lone nonpartner, unknown number of partners remaining");
            print("  registering "+this.nonpartners[0].id);
        }
        //SNIP-END
        this.state.registry.registerAmbigToken(this.akey, "" + this.nonpartners[0].id, this.betterbase);
        //this.lists[this.listpos] = [this.betterbase, this.partners];
        this.lists[this.listpos] = [this.betterbase, this.partners];
    } else if (this.clashes[1] < this.clashes[0]) {
        this.captureStepToBase();
        //SNIP-START
        if (this.debug) {
            print("  ** RESOLUTION [d]: better result, but no entries safe to register");
        }
        //SNIP-END
        this.lists[this.listpos] = [this.betterbase, this.partners];
        this.lists.push([this.betterbase, this.nonpartners]);
    } else {
        //SNIP-START
        if (this.debug) {
            print("  ** RESOLUTION [e]: no improvement, and clashes remain");
        }
        //SNIP-END
        if (ismax) {
            this.lists[this.listpos] = [this.betterbase, this.nonpartners];
            this.lists.push([this.betterbase, this.partners]);
            if (this.modeindex === this.modes.length - 1) {
                //SNIP-START
                if (this.debug) {
                    print("     (registering clashing entries because we've run out of options)");
                }
                //SNIP-END
                for (var i = 0, ilen = this.partners.length; i < ilen; i += 1) {
                    this.state.registry.registerAmbigToken(this.akey, "" + this.partners[i].id, this.betterbase);
                }
                this.lists[this.listpos] = [this.betterbase, []];
            }
        }
    }
};

CSL.Disambiguation.prototype.disExtraText = function () {
    //SNIP-START
    if (this.debug) {
        print("[3] === disExtraText ==");
    }
    //SNIP-END
    
    var done = false;

    if (this.clashes[1] === 0 && this.nonpartners.length < 2) {
        done = true;
    }

    // If first encounter in this cycle and multiple modes are
    // available, decrement mode and reset base
    if (!done && (!this.base.disambiguate || this.state.tmp.disambiguate_count !== this.state.tmp.disambiguate_maxMax)) {
        // Rerun everything on each subcycle? This doesn't work currently.
        //this.initVars(this.akey)
        this.modeindex = 0;
        this.base.disambiguate = this.state.tmp.disambiguate_count;
        this.betterbase.disambiguate = this.state.tmp.disambiguate_count;
        if (!this.base.disambiguate) {
            // Evaluate here?
            this.initGivens = true;
            // If disambiguate is false set to true
            this.base.disambiguate = 1;
            // There may be changes
            for (var i = 0, ilen = this.lists[this.listpos][1].length; i < ilen; i += 1) {
                this.state.tmp.taintedItemIDs[this.lists[this.listpos][1][i].id] = true;
            }
        } else {
            this.disNames();
        }
    } else if (done || this.state.tmp.disambiguate_count === this.state.tmp.disambiguate_maxMax) {
        if (done || this.modeindex === this.modes.length - 1) {
            // If this is the end, disambiguation failed.
            // Discard disambiguate=true (?) and set parameters
            var base = this.lists[this.listpos][0];
            for (var i = 0, ilen = this.lists[this.listpos][1].length; i < ilen; i += 1) {
                this.state.tmp.taintedItemIDs[this.lists[this.listpos][1][i].id] = true;
                this.state.registry.registerAmbigToken(this.akey, "" + this.lists[this.listpos][1][i].id, base);
            }
            this.lists[this.listpos] = [this.betterbase, []];
        } else {
            // If this is followed by year-suffix, keep
            // parameters and set disambiguate=true since it MIGHT
            // include the date, needed for year-suffix.
            // This may be a bit over-aggressive for cases in which the
            // disambiguate condition does not add the date
            this.modeindex = this.modes.length - 1;
            var base = this.lists[this.listpos][0];
            base.disambiguate = true;
            for (var i = 0, ilen = this.lists[this.listpos][1].length; i < ilen; i += 1) {
                // Always tainting here might be a little over-aggressive, but a taint may be required.
                this.state.tmp.taintedItemIDs[this.lists[this.listpos][1][i].id] = true;
                this.state.registry.registerAmbigToken(this.akey, "" + this.lists[this.listpos][1][i].id, base);
            }
        }
    }
};

CSL.Disambiguation.prototype.disYears = function () {
    var pos, len, tokens, token;
    //SNIP-START
    if (this.debug) {
        print("[3] === disYears ==");
    }
    //SNIP-END
    tokens = [];
    var base = this.lists[this.listpos][0];
    if (this.clashes[1]) {
        // That is, if the initial increment on the ambigs group returns no
        // clashes, don't apply suffix. The condition is a necessary failsafe.
		// In original submission order
		for (var i = 0, ilen = this.state.registry.mylist.length; i < ilen; i += 1) {
			var origid = this.state.registry.mylist[i];
			for (var j = 0, jlen = this.lists[this.listpos][1].length; j < jlen; j += 1) {
				var token = this.lists[this.listpos][1][j];
				// Warning: token.id can be number. This should be fixed at a higher level in citeproc-js if poss.
				if (token.id == origid) {
					tokens.push(this.registry[token.id]);
					break;
				}
			}
		}
    }
    tokens.sort(this.state.registry.sorter.compareKeys);
    for (var pos = 0, len = tokens.length; pos < len; pos += 1) {
        base.year_suffix = ""+pos;
        var oldBase = this.state.registry.registry[tokens[pos].id].disambig;
        this.state.registry.registerAmbigToken(this.akey, "" + tokens[pos].id, base);
        if (CSL.ambigConfigDiff(oldBase,base)) {
            this.state.tmp.taintedItemIDs[tokens[pos].id] = true;
        }
    }
    this.lists[this.listpos] = [this.betterbase, []];
};

CSL.Disambiguation.prototype.incrementDisambig = function () {
    //SNIP-START
    if (this.debug) {
        print("\n[1] === incrementDisambig() ===");
    }
    //SNIP-END
    if (this.initGivens) {
        this.initGivens = false;
        return false;
    }
    var maxed = false;
    var increment_names = true;
    if ("disNames" === this.modes[this.modeindex]) {
        // this.gnameset: the index pos of the current nameset
        // this.gname: the index pos of the current name w/in the current nameset
        
        // Stages:
        // - Increment givenname (optional)
        // - Add a name (optional)
        // - Move to next nameset

        // Incrementing is done forward-only on this.base. Values
        // that improve disambiguation results are copied to
        // this.betterbase, which is used to set the disambig parameters
        // in the processor registry.
        

        // Increment
        // Max val is always true if a level is inactive.
        increment_names = false;
        if ("number" !== typeof this.givensMax) {
            increment_names = true;
        }
        var increment_namesets = false;
        if ("number" !== typeof this.namesMax) {
            increment_namesets = true;
        }
        if ("number" === typeof this.givensMax) {
            if (this.base.givens.length && this.base.givens[this.gnameset][this.gname] < this.givensMax) {
                this.base.givens[this.gnameset][this.gname] += 1;
            } else {
                increment_names = true;
            }
        }
        if ("number" === typeof this.namesMax 
            && increment_names) {
            if (this.state.opt["disambiguate-add-names"]) {
                increment_namesets = false;
                if (this.gname < this.namesMax) {
                    this.base.names[this.gnameset] += 1;
                    this.gname += 1;
                } else {
                    increment_namesets = true;
                }
            } else {
                increment_namesets = true;
            }
        }
        if ("number" === typeof this.namesetsMax && increment_namesets) {
            if (this.gnameset < this.namesetsMax) {
                this.gnameset += 1;
                this.base.names[this.gnameset] = 1;
                this.gname = 0;
            }
        }
        //SNIP-START
        if (this.debug) {
            print("    ------------------");
            print("    incremented values");
            print("    ------------------");
            print("    | gnameset: "+this.gnameset);
            print("    | gname: "+this.gname);
            print("    | names value: "+this.base.names[this.gnameset]);
            if (this.base.givens.length) {
                print("    | givens value: "+this.base.givens[this.gnameset][this.gname]);
            } else {
                print("    | givens value: nil");
            }
            print("    | namesetsMax: "+this.namesetsMax);
            print("    | namesMax: "+this.namesMax);
            print("    | givensMax: "+this.givensMax);
        }
        //SNIP-END
        if (("number" !== typeof this.namesetsMax || this.namesetsMax === -1 || this.gnameset === this.namesetsMax)
            && (!this.state.opt["disambiguate-add-names"] || "number" !== typeof this.namesMax || this.gname === this.namesMax)
            && ("number" != typeof this.givensMax || "undefined" === typeof this.base.givens[this.gnameset] || "undefined" === typeof this.base.givens[this.gnameset][this.gname] || this.base.givens[this.gnameset][this.gname] === this.givensMax)) {
  

            maxed = true;
            //SNIP-START
            if (this.debug) {
                print("    MAXED");
            }
            //SNIP-END
        }
    } else if ("disExtraText" === this.modes[this.modeindex]) {
        this.base.disambiguate += 1;
        this.betterbase.disambiguate += 1;
    }
    return maxed;
};

CSL.Disambiguation.prototype.initVars = function (akey) {
    var i, ilen, myIds, myItemBundles, myItems;
    //SNIP-START
    if (this.debug) {
        print("[B] === initVars() ===");
    }
    //SNIP-END
    this.lists = [];
    this.base = false;
    this.betterbase = false;
    this.akey = akey;

    this.maxNamesByItemId = {};


    myItemBundles = [];
    myIds = this.ambigcites[akey];
    if (!myIds || !myIds.length) {
        return false;
    }
    var myItem = this.state.refetchItem("" + myIds[0]);
    this.getCiteData(myItem);
    this.base = CSL.getAmbigConfig.call(this.state);
    if (myIds && myIds.length > 1) {
        myItemBundles.push([this.maxNamesByItemId[myItem.id], myItem]);
        // Build a composite list of Items and associated
        // max names. This is messy, but it's the only
        // way to get the items sorted by the number of names
        // to be disambiguated. If they are in descending order
        // with name expansions, the processor will hang.
        for (var i = 1, ilen = myIds.length; i < ilen; i += 1) {
            myItem = this.state.refetchItem("" + myIds[i]);
            this.getCiteData(myItem, this.base);
            myItemBundles.push([this.maxNamesByItemId[myItem.id], myItem]);
        }
        myItemBundles.sort(
            function (a, b) {
                if (a[0] > b[0]) {
                    return 1;
                } else if (a[0] < b[0]) {
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
        myItems = [];
        for (var i = 0, ilen = myItemBundles.length; i < ilen; i += 1) {
            myItems.push(myItemBundles[i][1]);
        }
        this.lists.push([this.base, myItems]);
        this.Item = this.lists[0][1][0];
    } else {
        this.Item = this.state.refetchItem("" + myIds[0]);
    }

    this.modeindex = 0;
    if (this.state.citation.opt["disambiguate-add-names"] || true) {
        this.namesMax = this.maxNamesByItemId[this.Item.id][0];
    } else {
        var namesMax = this.base.names[0];
        for (var i=1,ilen=this.base.names.length;i<ilen;i+=1){
            namesMax = Math.max(namesMax,this.base.names.names[i]);
        }
    }


    this.padBase(this.base);
    this.padBase(this.betterbase);
    this.base.year_suffix = false;
    this.base.disambiguate = false;
    this.betterbase.year_suffix = false;
    this.betterbase.disambiguate = false;
    if (this.state.citation.opt["givenname-disambiguation-rule"] === "by-cite"
       && this.state.opt["disambiguate-add-givenname"]) {
        this.givensMax = 2;
    }
    return true;
};


CSL.Disambiguation.prototype.padBase = function (base) {
    for (var i = 0, ilen = base.names.length; i < ilen; i += 1) {
        if (!base.givens[i]) {
            base.givens[i] = [];
        }
        for (var j=0,jlen=base.names[i];j<jlen;j+=1) {
            if (!base.givens[i][j]) {
                base.givens[i][j] = 0;
            }
        }
    }
};

/**
 * Set available modes for disambiguation
 */
CSL.Disambiguation.prototype.configModes = function () {
    var dagopt, gdropt;
    // Modes are function names prototyped to this instance.
    this.modes = [];
    dagopt = this.state.opt["disambiguate-add-givenname"];
    gdropt = this.state.citation.opt["givenname-disambiguation-rule"];
    if (this.state.opt['disambiguate-add-names'] || (dagopt && gdropt === "by-cite")) {
        this.modes.push("disNames");
    }

    if (this.state.opt.development_extensions.prioritize_disambiguate_condition) {
        if (this.state.opt.has_disambiguate) {
            this.modes.push("disExtraText");
        }
        if (this.state.opt["disambiguate-add-year-suffix"]) {
            this.modes.push("disYears");
        }
    } else {
        if (this.state.opt["disambiguate-add-year-suffix"]) {
            this.modes.push("disYears");
        }
        if (this.state.opt.has_disambiguate) {
            this.modes.push("disExtraText");
        }
    }
};

CSL.Disambiguation.prototype.getCiteData = function(Item, base) {
    // Initialize base if first set item seen
    if (!this.maxNamesByItemId[Item.id]) {
        CSL.getAmbiguousCite.call(this.state, Item, base);
        base = CSL.getAmbigConfig.call(this.state);
        this.maxNamesByItemId[Item.id] = CSL.getMaxVals.call(this.state);
        this.state.registry.registry[Item.id].disambig.givens = this.state.tmp.disambig_settings.givens.slice();
        // Slice the nested lists as well. Without this, disambiguate_YearSuffixFiftyTwoEntriesByCite fails.
        for (var i=0,ilen=this.state.registry.registry[Item.id].disambig.givens.length;i<ilen;i+=1) {
            this.state.registry.registry[Item.id].disambig.givens[i] = this.state.tmp.disambig_settings.givens[i].slice();
        }
        this.namesetsMax = this.state.registry.registry[Item.id].disambig.names.length - 1;
        if (!this.base) {
            this.base = base;
            this.betterbase = CSL.cloneAmbigConfig(base);
        }
        if (base.names.length < this.base.names.length) {
            // I don't know what would happen with discrepancies in the number
            // of namesets rendered on items, so we use the fewer of the two
            // and limit the other to that size.
            this.base = base;
        }
        // Padding. Within namesets, we use the longer of the two throughout.
        for (var i = 0, ilen = base.names.length; i < ilen; i += 1) {
            if (base.names[i] > this.base.names[i]) {
                // XXX The old must have been wrong surely. The new, I'm not sure.
                //this.base.givens[i] = this.base.givens[i].concat(this.base.givens[i].slice(this.base.names[i]));
                this.base.givens[i] = base.givens[i].slice();
                this.base.names[i] = base.names[i];
                this.betterbase.names = this.base.names.slice();
                this.betterbase.givens = this.base.givens.slice();
                this.padBase(this.base);
                this.padBase(this.betterbase);
            }
        }
        // This shouldn't be necessary
        // getAmbiguousCite() should return a valid and complete
        // givens segment under all conditions, but it does not
        // do so for institution authors, so we clean up after it
        // here.
        // Relevant test: sort_ChicagoYearSuffix2
        this.betterbase.givens = this.base.givens.slice();
        for (var j = 0, jlen = this.base.givens.length; j < jlen; j += 1) {
            this.betterbase.givens[j] = this.base.givens[j].slice();
        }
    }
};

CSL.Disambiguation.prototype.captureStepToBase = function() {
    // Be paranoid about the presence of givens
    if (this.state.citation.opt["givenname-disambiguation-rule"] === "by-cite"
        && this.base.givens && this.base.givens.length) {
        if ("undefined" !== typeof this.base.givens[this.gnameset][this.gname]) {
            if (this.betterbase.givens.length < this.base.givens.length) {
                this.betterbase.givens = JSON.parse(JSON.stringify(this.base.givens));
            }
            this.betterbase.givens[this.gnameset][this.gname] = this.base.givens[this.gnameset][this.gname];
        }
    }
    this.betterbase.names[this.gnameset] = this.base.names[this.gnameset];
};

CSL.Engine.prototype.getJurisdictionList = function (jurisdiction) {
    var jurisdictionList = [];
    var jurisdictionElems = jurisdiction.split(":");
    for (var j=jurisdictionElems.length;j>0;j--) {
        jurisdictionList.push(jurisdictionElems.slice(0,j).join(":"));
    }
    if (jurisdictionList.indexOf("us") === -1) {
        jurisdictionList.push("us");
    }
    return jurisdictionList;
};

CSL.Engine.prototype.retrieveAllStyleModules = function (jurisdictionList) {
    var ret = {};
    var preferences = this.locale[this.opt.lang].opts["jurisdiction-preference"];
    preferences = preferences ? preferences : [];
    preferences = [""].concat(preferences);
    for (var i=preferences.length-1;i>-1;i--) {
        var preference = preferences[i];
        for (var j=0,jlen=jurisdictionList.length;j<jlen;j++) {
            var jurisdiction = jurisdictionList[j];
            // If we've "seen" it, we have it already, or we're not going to get it.
            if (this.opt.jurisdictions_seen[jurisdiction]) {
                continue;
            }
            // Try to get the module
            var res = this.sys.retrieveStyleModule(jurisdiction, preference);
            // If we fail and we've run out of preferences, mark as "seen"
            // Otherwise mark as "seen" if we get something.
            if ((!res && !preference) || res) {
                this.opt.jurisdictions_seen[jurisdiction] = true;
            }
            // Don't memo unless get got style code.
            if (!res) {
                continue;
            }
            ret[jurisdiction] = res;
        }
    }
    // Give 'em what we got.
    return ret;
};

CSL.ParticleList = (function() {
	var always_dropping_1 = [[[0,1], null]];
	var always_dropping_3 = [[[0,3], null]];
	var always_non_dropping_1 = [[null, [0,1]]];
	var always_non_dropping_2 = [[null, [0,2]]];
	var always_non_dropping_3 = [[null, [0,3]]];
	var either_1 = [[null, [0,1]],[[0,1],null]];
	var either_2 = [[null, [0,2]],[[0,2],null]];
	var either_1_dropping_best = [[[0,1],null],[null, [0,1]]];
	var either_2_dropping_best = [[[0,2],null],[null, [0,2]]];
	var either_3_dropping_best = [[[0,3],null],[null, [0,3]]];
	var non_dropping_2_alt_dropping_1_non_dropping_1 = [[null, [0,2]], [[0,1], [1,2]]];
	var PARTICLES = [
		["'s", always_non_dropping_1],
		["'s-", always_non_dropping_1],
		["'t", always_non_dropping_1],
		["a", 	always_non_dropping_1],
		["aan 't", always_non_dropping_2],
		["aan de", always_non_dropping_2],
		["aan den", always_non_dropping_2],
		["aan der", always_non_dropping_2],
		["aan het", always_non_dropping_2],
		["aan t", always_non_dropping_2],
		["aan", always_non_dropping_1],
		["ad-", either_1],
		["adh-", either_1],
		["af", either_1],
		["al", either_1],
		["al-", either_1],
		["am de", always_non_dropping_2],
		["am", always_non_dropping_1],
		["an-", either_1],
		["ar-", either_1],
		["as-", either_1],
		["ash-", either_1],
		["at-", either_1],
		["ath-", either_1],
		["auf dem", either_2_dropping_best],
		["auf den", either_2_dropping_best],
		["auf der", either_2_dropping_best],
		["auf ter", always_non_dropping_2],
		["auf", either_1_dropping_best],
		["aus 'm", either_2_dropping_best],
		["aus dem", either_2_dropping_best],
		["aus den", either_2_dropping_best],
		["aus der", either_2_dropping_best],
		["aus m", either_2_dropping_best],
		["aus", either_1_dropping_best],
		["aus'm", either_2_dropping_best],
		["az-", either_1],
		["aš-", either_1],
		["aḍ-", either_1],
		["aḏ-", either_1],
		["aṣ-", either_1],
		["aṭ-", either_1],
		["aṯ-", either_1],
		["aẓ-", either_1],
		["ben", always_non_dropping_1],
		["bij 't", always_non_dropping_2],
		["bij de", always_non_dropping_2],
		["bij den", always_non_dropping_2],
		["bij het", always_non_dropping_2],
		["bij t", always_non_dropping_2],
		["bij", always_non_dropping_1],
		["bin", always_non_dropping_1],
		["boven d", always_non_dropping_2],
		["boven d'", always_non_dropping_2],
		["d", always_non_dropping_1],
		["d'", either_1],
		["da", either_1],
		["dal", always_non_dropping_1],
		["dal'", always_non_dropping_1],
		["dall'", always_non_dropping_1],
		["dalla", always_non_dropping_1],
		["das", either_1],
		["de die le", always_non_dropping_3],
		["de die", always_non_dropping_2],
		["de l", always_non_dropping_2],
		["de l'", always_non_dropping_2],
		["de la", non_dropping_2_alt_dropping_1_non_dropping_1],
		["de las", non_dropping_2_alt_dropping_1_non_dropping_1],
		["de le", always_non_dropping_2],
		["de li", either_2],
		["de van der", always_non_dropping_3],
		["de", either_1],
		["de'", either_1],
		["deca", always_non_dropping_1],
		["degli", either_1],
		["dei", either_1],
		["del", either_1],
		["dela", always_dropping_1],
		["dell'", either_1],
		["della", either_1],
		["delle", either_1],
		["dello", either_1],
		["den", either_1],
		["der", either_1],
		["des", either_1],
		["di", either_1],
		["die le", always_non_dropping_2],
		["do", always_non_dropping_1],
		["don", always_non_dropping_1],
		["dos", either_1],
		["du", either_1],
		["ed-", either_1],
		["edh-", either_1],
		["el", either_1],
		["el-", either_1],
		["en-", either_1],
		["er-", either_1],
		["es-", either_1],
		["esh-", either_1],
		["et-", either_1],
		["eth-", either_1],
		["ez-", either_1],
		["eš-", either_1],
		["eḍ-", either_1],
		["eḏ-", either_1],
		["eṣ-", either_1],
		["eṭ-", either_1],
		["eṯ-", either_1],
		["eẓ-", either_1],
		["het", always_non_dropping_1],
		["i", always_non_dropping_1],
		["il", always_dropping_1],
		["im", always_non_dropping_1],
		["in 't", always_non_dropping_2],
		["in de", always_non_dropping_2],
		["in den", always_non_dropping_2],
		["in der", either_2],
		["in het", always_non_dropping_2],
		["in t", always_non_dropping_2],
		["in", always_non_dropping_1],
		["l", always_non_dropping_1],
		["l'", always_non_dropping_1],
		["la", always_non_dropping_1],
		["las", always_non_dropping_1],
		["le", always_non_dropping_1],
		["les", either_1],
		["lo", either_1],
		["los", always_non_dropping_1],
		["lou", always_non_dropping_1],
		["of", always_non_dropping_1],
		["onder 't", always_non_dropping_2],
		["onder de", always_non_dropping_2],
		["onder den", always_non_dropping_2],
		["onder het", always_non_dropping_2],
		["onder t", always_non_dropping_2],
		["onder", always_non_dropping_1],
		["op 't", always_non_dropping_2],
		["op de", either_2],
		["op den", always_non_dropping_2],
		["op der", always_non_dropping_2],
		["op gen", always_non_dropping_2],
		["op het", always_non_dropping_2],
		["op t", always_non_dropping_2],
		["op ten", always_non_dropping_2],
		["op", always_non_dropping_1],
		["over 't", always_non_dropping_2],
		["over de", always_non_dropping_2],
		["over den", always_non_dropping_2],
		["over het", always_non_dropping_2],
		["over t", always_non_dropping_2],
		["over", always_non_dropping_1],
		["s", always_non_dropping_1],
		["s'", always_non_dropping_1],
		["sen", always_dropping_1],
		["t", always_non_dropping_1],
		["te", always_non_dropping_1],
		["ten", always_non_dropping_1],
		["ter", always_non_dropping_1],
		["tho", always_non_dropping_1],
		["thoe", always_non_dropping_1],
		["thor", always_non_dropping_1],
		["to", always_non_dropping_1],
		["toe", always_non_dropping_1],
		["tot", always_non_dropping_1],
		["uijt 't", always_non_dropping_2],
		["uijt de", always_non_dropping_2],
		["uijt den", always_non_dropping_2],
		["uijt te de", always_non_dropping_3],
		["uijt ten", always_non_dropping_2],
		["uijt", always_non_dropping_1],
		["uit 't", always_non_dropping_2],
		["uit de", always_non_dropping_2],
		["uit den", always_non_dropping_2],
		["uit het", always_non_dropping_2],
		["uit t", always_non_dropping_2],
		["uit te de", always_non_dropping_3],
		["uit ten", always_non_dropping_2],
		["uit", always_non_dropping_1],
		["unter", always_non_dropping_1],
		["v", always_non_dropping_1],
		["v.", always_non_dropping_1],
		["v.d.", always_non_dropping_1],
		["van 't", always_non_dropping_2],
		["van de l", always_non_dropping_3],
		["van de l'", always_non_dropping_3],
		["van de", always_non_dropping_2],
		["van de", always_non_dropping_2],
		["van den", always_non_dropping_2],
		["van der", always_non_dropping_2],
		["van gen", always_non_dropping_2],
		["van het", always_non_dropping_2],
		["van la", always_non_dropping_2],
		["van t", always_non_dropping_2],
		["van ter", always_non_dropping_2],
		["van van de", always_non_dropping_3],
		["van", either_1],
		["vander", always_non_dropping_1],
		["vd", always_non_dropping_1],
		["ver", always_non_dropping_1],
		["vom und zum", always_dropping_3],
		["vom", either_1],
		["von 't", always_non_dropping_2],
		["von dem", either_2_dropping_best],
		["von den", either_2_dropping_best],
		["von der", either_2_dropping_best],
		["von t", always_non_dropping_2],
		["von und zu", either_3_dropping_best],
		["von zu", either_2_dropping_best],
		["von", either_1_dropping_best],
		["voor 't", always_non_dropping_2],
		["voor de", always_non_dropping_2],
		["voor den", always_non_dropping_2],
		["voor in 't", always_non_dropping_3],
		["voor in t", always_non_dropping_3],
		["voor", always_non_dropping_1],
		["vor der", either_2_dropping_best],
		["vor", either_1_dropping_best],
		["z", always_dropping_1],
		["ze", always_dropping_1],
		["zu", either_1_dropping_best],
		["zum", either_1],
		["zur", either_1]
	];
    return PARTICLES;
}());

CSL.parseParticles = (function(){
    function splitParticles(nameValue, firstNameFlag, caseOverride) {
		// Parse particles out from name fields.
		// * nameValue (string) is the field content to be parsed.
		// * firstNameFlag (boolean) parse trailing particles
		//	 (default is to parse leading particles)
		// * caseOverride (boolean) include all but one word in particle set
		//	 (default is to include only words with lowercase first char)
        //   [caseOverride is not used in this application]
		// Returns an array with:
		// * (boolean) flag indicating whether a particle was found
		// * (string) the name after removal of particles
		// * (array) the list of particles found
		var origNameValue = nameValue;
		nameValue = caseOverride ? nameValue.toLowerCase() : nameValue;
		var particleList = [];
		var rex;
        var hasParticle;
		if (firstNameFlag) {
			nameValue = nameValue.split("").reverse().join("");
			rex = CSL.PARTICLE_GIVEN_REGEXP;
		} else {
			rex = CSL.PARTICLE_FAMILY_REGEXP;
		}
		var m = nameValue.match(rex);
		while (m) {
			var m1 = firstNameFlag ? m[1].split("").reverse().join("") : m[1];
			var firstChar = m ? m1 : false;
			var firstChar = firstChar ? m1.replace(/^[-\'\u02bb\u2019\s]*(.).*$/, "$1") : false;
			hasParticle = firstChar ? firstChar.toUpperCase() !== firstChar : false;
			if (!hasParticle) {
                break;
            }
			if (firstNameFlag) {
				particleList.push(origNameValue.slice(m1.length * -1));
				origNameValue = origNameValue.slice(0,m1.length * -1);
			} else {
				particleList.push(origNameValue.slice(0,m1.length));
				origNameValue = origNameValue.slice(m1.length);
			}
			//particleList.push(m1);
			nameValue = m[2];
			m = nameValue.match(rex);
		}
		if (firstNameFlag) {
			nameValue = nameValue.split("").reverse().join("");
			particleList.reverse();
			for (var i=1,ilen=particleList.length;i<ilen;i++) {
				if (particleList[i].slice(0, 1) == " ") {
					particleList[i-1] += " ";
				}
			}
			for (var i=0,ilen=particleList.length;i<ilen;i++) {
				if (particleList[i].slice(0, 1) == " ") {
					particleList[i] = particleList[i].slice(1);
				}
			}
			nameValue = origNameValue.slice(0, nameValue.length);
		} else {
			nameValue = origNameValue.slice(nameValue.length * -1);
		}
		return [hasParticle, nameValue, particleList];
	}
    function trimLast(str) {
        var lastChar = str.slice(-1);
        str = str.trim();
        if (lastChar === " " && ["\'", "\u2019"].indexOf(str.slice(-1)) > -1) {
            str += " ";
        }
        return str;
    }
    function parseSuffix(nameObj) {
        if (!nameObj.suffix && nameObj.given) {
            var m = nameObj.given.match(/(\s*,!*\s*)/);
            if (m) {
                var idx = nameObj.given.indexOf(m[1]);
                var possible_suffix = nameObj.given.slice(idx + m[1].length);
                var possible_comma = nameObj.given.slice(idx, idx + m[1].length).replace(/\s*/g, "");
                if (possible_suffix.replace(/\./g, "") === 'et al' && !nameObj["dropping-particle"]) {
                    // This hack covers the case where "et al." is explicitly used in the
                    // authorship information of the work.
                    nameObj["dropping-particle"] = possible_suffix;
                    nameObj["comma-dropping-particle"] = ",";
                } else {
                    if (possible_comma.length === 2) {
                        nameObj["comma-suffix"] = true;
                    }
                    nameObj.suffix = possible_suffix;
                }
                nameObj.given = nameObj.given.slice(0, idx);
            }
        }
    }
    return function(nameObj) {
        // Extract and set non-dropping particle(s) from family name field
        var res = splitParticles(nameObj.family);
        var lastNameValue = res[1];
        var lastParticleList = res[2];
        nameObj.family = lastNameValue;
        var nonDroppingParticle = trimLast(lastParticleList.join(""));
        if (nonDroppingParticle) {
            nameObj['non-dropping-particle'] = nonDroppingParticle;
        }
        // Split off suffix first of all
        parseSuffix(nameObj);
        // Extract and set dropping particle(s) from given name field
        var res = splitParticles(nameObj.given, true);
        var firstNameValue = res[1];
        var firstParticleList = res[2];
        nameObj.given = firstNameValue;
        var droppingParticle = firstParticleList.join("").trim();
        if (droppingParticle) {
            nameObj['dropping-particle'] = droppingParticle;
        }
    };
}());

