/*
 * Copyright (c) 2009-2014 Frank G. Bennett
 * 
 * Unless otherwise indicated, the files in this repository are subject
 * to the Common Public Attribution License Version 1.0 (the “License”);
 * you may not use this file except in compliance with the License. You
 * may obtain a copy of the License at:
 * 
 * http://bitbucket.org/fbennett/citeproc-js/src/tip/LICENSE.
 * 
 * (See also the note on attribution information below)
 * 
 * The License is based on the Mozilla Public License Version 1.1 but
 * Sections 1.13, 14 and 15 have been added to cover use of software over a
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
 * under the ./tests subdirectory of the distribution archive.
 * 
 * The Original Developer is not the Initial Developer and is
 * __________. If left blank, the Original Developer is the Initial
 * Developer.
 * 
 * The Initial Developer of the Original Code is Frank Bennett. All
 * portions of the code written by Frank Bennett are Copyright (c)
 * 2009-2014 Frank Bennett.
 * 
 * ***
 * 
 * Alternatively, the files in this repository may be used under the
 * terms of the GNU Affero General Public License (the [AGPLv3] License),
 * in which case the provisions of [AGPLv3] License are applicable
 * instead of those above. If you wish to allow use of your version of
 * this file only under the terms of the [AGPLv3] License and not to
 * allow others to use your version of this file under the CPAL, indicate
 * your decision by deleting the provisions above and replace them with
 * the notice and other provisions required by the [AGPLv3] License. If
 * you do not delete the provisions above, a recipient may use your
 * version of this file under either the CPAL or the [AGPLv3] License.
 * 
 * ***
 * 
 * Attribution Information (CPAL)
 * 
 * Attribution Copyright Notice: [no separate attribution copyright notice is required]
 * 
 * Attribution Phrase: "Citations by CSL (citeproc-js)"
 * 
 * Attribution URL: http://citationstyles.org/
 * 
 * Graphic Image: [there is no requirement to display a Graphic Image]
 * 
 * Display of Attribution Information is REQUIRED in Larger Works which
 * are defined in the CPAL as a work which combines Covered Code or
 * portions thereof with code not governed by the terms of the CPAL.
 * 
 * Display of Attribution Information is also REQUIRED on Associated
 * Websites.
 * 
 * [ citeproc-js license :: version 1.1 :: 2012.06.30 ]
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
    PROCESSOR_VERSION: "1.0.533",
    CONDITION_LEVEL_TOP: 1,
    CONDITION_LEVEL_BOTTOM: 2,
    PLAIN_HYPHEN_REGEX: /(?:[^\\]-|\u2013)/,
    LOCATOR_LABELS_REGEXP: new RegExp("^((art|ch|Ch|subch|col|fig|l|n|no|op|p|pp|para|subpara|pt|r|sec|subsec|Sec|sv|sch|tit|vrs|vol)\\.)\\s+(.*)"),
    STATUTE_SUBDIV_GROUPED_REGEX: /((?:^| )(?:art|ch|Ch|subch|p|pp|para|subpara|pt|r|sec|subsec|Sec|sch|tit)\.)/g,
    STATUTE_SUBDIV_PLAIN_REGEX: /(?:(?:^| )(?:art|ch|Ch|subch|p|pp|para|subpara|pt|r|sec|subsec|Sec|sch|tit)\.)/,
    STATUTE_SUBDIV_STRINGS: {
        "art.": "article",
        "bk.": "book",
        "ch.": "chapter",
        "Ch.": "Chapter",
        "subch.": "subchapter",
        "p.": "page",
        "pp.": "page",
        "para.": "paragraph",
        "subpara.": "subparagraph",
        "pt.": "part",
        "r.": "rule",
        "sec.": "section",
        "subsec.": "subsection",
        "Sec.": "Section",
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
        "Chapter": "Ch.",
        "subchapter": "subch.",
        "page": "p.",
        "paragraph": "para.",
        "subparagraph": "subpara.",
        "part": "pt.",
        "rule": "r.",
        "section": "sec.",
        "subsection": "subsec.",
        "Section": "Sec.",
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
        "Ch": "Chapter",
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
        "Sec": "Section",
		"sv": "sub-verbo",
        "sch": "schedule",
        "tit": "title",
        "vrs": "verse",
        "vol": "volume"
    },
    NestedBraces: [
        ["(", "["],
        [")", "]"]
    ],
    checkNestedBraceOpen: new RegExp(".*\\("),
    checkNestedBraceClose: new RegExp(".*\\)"),
    LangPrefsMap: {
        "title":"titles",
        "title-short":"titles",
        "container-title":"journals",
        "collection-title":"journals",
        "publisher":"publishers",
        "authority":"publishers",
        "publisher-place": "places",
        "event-place": "places",
        "number": "number",
        "edition":"number",
        "issue":"number",
        "volume":"number"
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
    MULTI_FIELDS: ["event", "publisher", "publisher-place", "event-place", "title", "container-title", "collection-title", "authority","edition","genre","title-short","medium","jurisdiction","archive","archive-place"],
    CITE_FIELDS: ["first-reference-note-number", "locator", "locator-revision"],
    MINIMAL_NAME_FIELDS: ["literal", "family"],
    SWAPPING_PUNCTUATION: [".", "!", "?", ":",","],
    TERMINAL_PUNCTUATION: [":", ".", ";", "!", "?", " "],
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
    NAME_INITIAL_REGEXP: /^([A-Z\u0590-\u05ff\u0080-\u017f\u0400-\u042f\u0600-\u06ff\u0370\u0372\u0376\u0386\u0388-\u03ab\u03e2\u03e4\u03e6\u03e8\u03ea\u03ec\u03ee\u03f4\u03f7\u03fd-\u03ff])([a-zA-Z\u0080-\u017f\u0400-\u052f\u0600-\u06ff\u0370-\u03ff\u1f00-\u1fff]*|)/,
    ROMANESQUE_REGEXP: /[-0-9a-zA-Z\u0590-\u05d4\u05d6-\u05ff\u0080-\u017f\u0400-\u052f\u0370-\u03ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]/,
    ROMANESQUE_NOT_REGEXP: /[^a-zA-Z\u0590-\u05ff\u0080-\u017f\u0400-\u052f\u0370-\u03ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]/g,
    STARTSWITH_ROMANESQUE_REGEXP: /^[&a-zA-Z\u0590-\u05d4\u05d6-\u05ff\u0080-\u017f\u0400-\u052f\u0370-\u03ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]/,
    ENDSWITH_ROMANESQUE_REGEXP: /[.;:&a-zA-Z\u0590-\u05d4\u05d6-\u05ff\u0080-\u017f\u0400-\u052f\u0370-\u03ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]$/,
    ALL_ROMANESQUE_REGEXP: /^[a-zA-Z\u0590-\u05ff\u0080-\u017f\u0400-\u052f\u0370-\u03ff\u1f00-\u1fff\u0600-\u06ff\u200c\u200d\u200e\u0218\u0219\u021a\u021b\u202a-\u202e]+$/,
    VIETNAMESE_SPECIALS: /[\u00c0-\u00c3\u00c8-\u00ca\u00cc\u00cd\u00d2-\u00d5\u00d9\u00da\u00dd\u00e0-\u00e3\u00e8-\u00ea\u00ec\u00ed\u00f2-\u00f5\u00f9\u00fa\u00fd\u0101\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]/,
    VIETNAMESE_NAMES: /^(?:(?:[.AaBbCcDdEeGgHhIiKkLlMmNnOoPpQqRrSsTtUuVvXxYy \u00c0-\u00c3\u00c8-\u00ca\u00cc\u00cd\u00d2-\u00d5\u00d9\u00da\u00dd\u00e0-\u00e3\u00e8-\u00ea\u00ec\u00ed\u00f2-\u00f5\u00f9\u00fa\u00fd\u0101\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]{2,6})(\s+|$))+$/,
    NOTE_FIELDS_REGEXP: /\{:(?:[\-_a-z]+|[A-Z]+):[^\}]+\}/g,
    NOTE_FIELD_REGEXP: /\{:([\-_a-z]+|[A-Z]+):\s*([^\}]+)\}/,
    DISPLAY_CLASSES: ["block", "left-margin", "right-inline", "indent"],
    NAME_VARIABLES: [
        "author",
        "editor",
        "translator",
        "contributor",
        "collection-editor",
        "composer",
        "container-author",
        "director",
        "editorial-director",
        "interviewer",
        "original-author",
        "recipient"
    ],
    NUMERIC_VARIABLES: [
        "call-number",
        "chapter-number",
        "collection-number",
        "edition",
        "page",
        "issue",
        "locator",
        "number",
        "number-of-pages",
        "number-of-volumes",
        "volume",
        "citation-number"
    ],
    DATE_VARIABLES: [
        "locator-date", 
        "issued", 
        "event-date", 
        "accessed", 
        "container", 
        "original-date",
        "publication-date",
        "original-date",
        "available-date",
        "submitted"
    ],
    TAG_ESCAPE: function (str) {
        var mx, lst, len, pos, m, buf1, buf2, idx, ret, myret;
        mx = str.match(/((?:\"|\')|(?:(?:<span\s+class=\"no(?:case|decor)\">).*?(?:<\/span>|<\/?(?:i|sc|b)>)))/g);
        lst = str.split(/(?:(?:\"|\')|(?:(?:<span\s+class=\"no(?:case|decor)\">).*?(?:<\/span>|<\/?(?:i|sc|b)>)))/g);
        myret = [lst[0]];
        for (pos = 1, len = lst.length; pos < len; pos += 1) {
            myret.push(mx[pos - 1]);
            myret.push(lst[pos]);
        }
        lst = myret.slice();
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
    SKIP_WORDS: ["about","above","across","afore","after","against","along","alongside","amid","amidst","among","amongst","anenst","apropos","apud","around","as","aside","astride","at","athwart","atop","barring","before","behind","below","beneath","beside","besides","between","beyond","but","by","circa","despite","down","during","except","for","forenenst","from","given","in","inside","into","lest","like","modulo","near","next","notwithstanding","of","off","on","onto","out","over","per","plus","pro","qua","sans","since","than","through"," thru","throughout","thruout","till","to","toward","towards","under","underneath","until","unto","up","upon","versus","vs.","v.","vs","v","via","vis-à-vis","with","within","without","according to","ahead of","apart from","as for","as of","as per","as regards","aside from","back to","because of","close to","due to","except for","far from","inside of","instead of","near to","next to","on to","out from","out of","outside of","prior to","pursuant to","rather than","regardless of","such as","that of","up to","where as","or", "yet", "so", "for", "and", "nor", "a", "an", "the", "de", "d'", "von", "van", "c", "et", "ca"],
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
    LANGS: {
        "af-ZA":"Afrikaans",
        "ar-AR":"Arabic",
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
        "uk-UA":"Ukranian",
        "vi-VN":"Vietnamese",
        "zh-CN":"Chinese (CN)",
        "zh-TW":"Chinese (TW)"
    },
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
        eu: "eu",
        fa: "fa_IR",
        fi: "fi_FI",
        fr: "fr_FR",
        he: "he_IL",
        hu: "hu_HU",
        is: "is_IS",
        it: "it_IT",
        ja: "ja_JP",
        km: "km_KH",
        ko: "ko_KR",
        lt: "lt_LT",
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
    locale: {},
    locale_opts: {},
    locale_dates: {}
};
if (typeof require !== "undefined" && typeof module !== 'undefined' && "exports" in module) {
    var CSL_IS_NODEJS = true;
    var CSL_NODEJS = require("./csl_nodejs_jsdom").CSL_NODEJS_JSDOM;
    exports.CSL = CSL;
}
CSL.TERMINAL_PUNCTUATION_REGEXP = new RegExp("^([" + CSL.TERMINAL_PUNCTUATION.slice(0, -1).join("") + "])(.*)");
CSL.CLOSURES = new RegExp(".*[\\]\\)]");
CSL.debug = function (str) {
    Zotero.debug("CSL: " + str);
};
CSL.error = function (str) {
    Zotero.debug("CSL error: " + str);
};
function DOMParser() {
	return Components.classes["@mozilla.org/xmlextras/domparser;1"]
		.createInstance(Components.interfaces.nsIDOMParser);
};
if ("undefined" === typeof CSL_IS_IE) {
    var CSL_IS_IE;
};
var CSL_CHROME = function () {
    if ("undefined" == typeof DOMParser || CSL_IS_IE) {
        CSL_IS_IE = true;
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
        if ("undefined" == typeof doc.importNode) {
            var ret = this._importNode(doc, srcElement, true);
        } else {
            var ret = doc.importNode(srcElement, true);
        }
        return ret;
    };
    this._importNode = function(doc, node, allChildren) {
        switch (node.nodeType) {
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
        }
    };
    this.parser = new DOMParser();
    var str = "<docco><institution institution-parts=\"long\" delimiter=\", \" substitute-use-first=\"1\" use-last=\"1\"><institution-part name=\"long\"/></institution></docco>";
    var inst_doc = this.parser.parseFromString(str, "text/xml");
    var inst_node = inst_doc.getElementsByTagName("institution");
    this.institution = inst_node.item(0);
    var inst_part_node = inst_doc.getElementsByTagName("institution-part");
    this.institutionpart = inst_part_node.item(0);
    this.ns = "http://purl.org/net/xbiblio/csl";
};
CSL_CHROME.prototype.clean = function (xml) {
    xml = xml.replace(/<\?[^?]+\?>/g, "");
    xml = xml.replace(/<![^>]+>/g, "");
    xml = xml.replace(/^\s+/, "");
    xml = xml.replace(/\s+$/, "");
    xml = xml.replace(/^\n*/, "");
    return xml;
};
CSL_CHROME.prototype.getStyleId = function (myxml, styleName) {
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
        text = node.textContent;
    }
    if (!text) {
        text = node.innerText;
    }
    if (!text) {
        text = node.innerHTML;
    }
    return text;
};
CSL_CHROME.prototype.children = function (myxml) {
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
CSL_CHROME.prototype.nodename = function (myxml) {
    var ret = myxml.nodeName;
    return ret;
};
CSL_CHROME.prototype.attributes = function (myxml) {
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
CSL_CHROME.prototype.content = function (myxml) {
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
CSL_CHROME.prototype.namespace = {
    "xml":"http://www.w3.org/XML/1998/namespace"
}
CSL_CHROME.prototype.numberofnodes = function (myxml) {
    if (myxml) {
        return myxml.length;
    } else {
        return 0;
    }
};
CSL_CHROME.prototype.getAttributeName = function (attr) {
    var ret = attr.name;
    return ret;
}
CSL_CHROME.prototype.getAttributeValue = function (myxml,name,namespace) {
    var ret = "";
    if (namespace) {
        name = namespace+":"+name;
    }
    if (myxml && this.hasAttributes(myxml) && myxml.getAttribute(name)) {
        ret = myxml.getAttribute(name);
    }
    return ret;
}
CSL_CHROME.prototype.getNodeValue = function (myxml,name) {
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
CSL_CHROME.prototype.setAttributeOnNodeIdentifiedByNameAttribute = function (myxml,nodename,partname,attrname,val) {
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
CSL_CHROME.prototype.deleteNodeByNameAttribute = function (myxml,val) {
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
CSL_CHROME.prototype.deleteAttribute = function (myxml,attr) {
    myxml.removeAttribute(attr);
}
CSL_CHROME.prototype.setAttribute = function (myxml,attr,val) {
    if (!myxml.ownerDocument) {
        myxml = myxml.firstChild;
    }
    if (["function", "unknown"].indexOf(typeof myxml.setAttribute) > -1) {
        myxml.setAttribute(attr, val);
    }
    return false;
}
CSL_CHROME.prototype.nodeCopy = function (myxml) {
    var cloned_node = myxml.cloneNode(true);
    return cloned_node;
}
CSL_CHROME.prototype.getNodesByName = function (myxml,name,nameattrval) {
    var ret, nodes, node, pos, len;
    ret = [];
    nodes = myxml.getElementsByTagName(name);
    for (pos = 0, len = nodes.length; pos < len; pos += 1) {
        node = nodes.item(pos);
        if (nameattrval && !(this.hasAttributes(node) && node.getAttribute("name") == nameattrval)) {
            continue;
        }
        ret.push(node);
    }
    return ret;
}
CSL_CHROME.prototype.nodeNameIs = function (myxml,name) {
    if (name == myxml.nodeName) {
        return true;
    }
    return false;
}
CSL_CHROME.prototype.makeXml = function (myxml) {
    var ret, topnode;
    if (!myxml) {
        myxml = "<docco><bogus/></docco>";
    }
    myxml = myxml.replace(/\s*<\?[^>]*\?>\s*\n*/g, "");
    var nodetree = this.parser.parseFromString(myxml, "application/xml");
    return nodetree.firstChild;
};
CSL_CHROME.prototype.insertChildNodeAfter = function (parent,node,pos,datexml) {
    var myxml, xml;
    myxml = this.importNode(node.ownerDocument, datexml);
    parent.replaceChild(myxml, node);
     return parent;
};
CSL_CHROME.prototype.insertPublisherAndPlace = function(myxml) {
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
CSL_CHROME.prototype.addMissingNameNodes = function(myxml) {
    var nameslist = myxml.getElementsByTagName("names");
    for (var i = 0, ilen = nameslist.length; i < ilen; i += 1) {
        var names = nameslist.item(i);
        var namelist = names.getElementsByTagName("name");
        if ((!namelist || namelist.length === 0)
            && names.parentNode.tagName.toLowerCase() !== "substitute") {
            var doc = names.ownerDocument;
            var name = doc.createElement("name");
            names.appendChild(name);
        }
    }
};
CSL_CHROME.prototype.addInstitutionNodes = function(myxml) {
    var names, thenames, institution, theinstitution, name, thename, xml, pos, len;
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
CSL_CHROME.prototype.flagDateMacros = function(myxml) {
    var pos, len, thenode, thedate;
    nodes = myxml.getElementsByTagName("macro");
    for (pos = 0, len = nodes.length; pos < len; pos += 1) {
        thenode = nodes.item(pos);
        thedate = thenode.getElementsByTagName("date");
        if (thedate.length) {
            thenode.setAttribute('macro-has-date', 'true');
        }
    }
};
var XML_PARSING;
if ("undefined" !== typeof CSL_IS_NODEJS) {
    XML_PARSING = CSL_NODEJS;
} else if ("undefined" !== typeof CSL_E4X) {
    XML_PARSING = CSL_E4X;
} else if ("undefined" !== typeof CSL_JSON) {
    XML_PARSING = CSL_JSON;
} else {
    XML_PARSING = CSL_CHROME;
}
CSL.System = {};
CSL.System.Xml = {
    "Parsing": XML_PARSING
};
CSL.getSortCompare = function (default_locale) {
    if (CSL.stringCompare) {
        return CSL.stringCompare;
    }
    var strcmp;
    if (!default_locale) {
        default_locale = "en-US";
    }
    strcmp = function (a, b) {
        return a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase());
    };
    var stripPunct = function (str) {
        return str.replace(/^[\[\]\'\"]*/g, "");
    }
    var getBracketPreSort = function () {
        if (!strcmp("[x","x")) {
            return false;
        } else {
            return function (a, b) {
                return strcmp(stripPunct(a), stripPunct(b));
            }
        }
    }
    var bracketPreSort = getBracketPreSort();
    var sortCompare = function (a, b) {
        if (bracketPreSort) {
            return bracketPreSort(a, b);
        } else {
            return strcmp(a, b);
        }
    }
    return sortCompare;
};
CSL.ambigConfigDiff = function(a, b) {
    var ret, pos, len, ppos, llen;
    if (a.names.length !== b.names.length) {
        return 1;
    } else {
        for (pos = 0, len = a.names.length; pos < len; pos += 1) {
            if (a.names[pos] !== b.names[pos]) {
                return 1;
            } else {
                for (ppos = 0, llen = a.givens[pos]; ppos < llen; ppos += 1) {
                    if (a.givens[pos][ppos] !== b.givens[pos][ppos]) {
                        return 1;
                    }
                }
            }
        }
    }
    if (a.disambiguate != b.disambiguate) {
        return 1;
    }
    if (a.year_suffix !== b.year_suffix) {
        return 1;
    }
    return 0;
};
CSL.cloneAmbigConfig = function (config, oldconfig, tainters) {
    var i, ilen, j, jlen, k, klen, param;
    var ret = {};
    ret.names = [];
    ret.givens = [];
    ret.year_suffix = false;
    ret.disambiguate = false;
    for (i = 0, ilen = config.names.length; i < ilen; i += 1) {
        param = config.names[i];
        ret.names[i] = param;
    }
    for (i  = 0, ilen = config.givens.length; i < ilen; i += 1) {
        param = [];
        for (j = 0, jlen = config.givens[i].length; j < jlen; j += 1) {
            param.push(config.givens[i][j]);
        }
        ret.givens.push(param);
    }
    if (oldconfig) {
        ret.year_suffix = oldconfig.year_suffix;
        ret.disambiguate = oldconfig.disambiguate;
    } else {
        ret.year_suffix = config.year_suffix;
        ret.disambiguate = config.disambiguate;
    }
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
    var record = function (result) {
        if (result) {
            this.tmp.jump.replace("succeed");
            return token.succeed;
        } else {
            this.tmp.jump.replace("fail");
            return token.fail;
        }
    }
    if (token.test) {
        next = record.call(this,token.test(Item, item));
    }
    len = token.execs.length;
    for (pos = 0; pos < len; pos += 1) {
        exec = token.execs[pos];
        maybenext = exec.call(token, this, Item, item);
        if (maybenext) {
            next = maybenext;
        }
    }
    return next;
};
CSL.expandMacro = function (macro_key_token) {
    var mkey, start_token, key, end_token, navi, macro_nodes, newoutput, mergeoutput, end_of_macro, func;
    mkey = macro_key_token.postponed_macro;
    if (this.build.macro_stack.indexOf(mkey) > -1) {
        throw "CSL processor error: call to macro \"" + mkey + "\" would cause an infinite loop";
    } else {
        this.build.macro_stack.push(mkey);
    }
    var hasDate = false;
    var macroid = false;
    macro_nodes = this.sys.xml.getNodesByName(this.cslXml, 'macro', mkey);
    if (macro_nodes.length) {
        macroid = this.sys.xml.getAttributeValue(macro_nodes[0],'cslid');
        hasDate = this.sys.xml.getAttributeValue(macro_nodes[0], "macro-has-date");
    }
    if (hasDate) {
        func = function (state, Item) {
            if (state.tmp.extension) {
                state.tmp["doing-macro-with-date"] = true;
            }
        };
        macro_key_token.execs.push(func);
    }
    macro_key_token.tokentype = CSL.START;
    macro_key_token.cslid = macroid;
    CSL.Node.group.build.call(macro_key_token, this, this[this.build.area].tokens, true);
    if (!this.sys.xml.getNodeValue(macro_nodes)) {
        throw "CSL style error: undefined macro \"" + mkey + "\"";
    }
    var builder = CSL.makeBuilder(this);
    builder(macro_nodes[0]);
    end_of_macro = new CSL.Token("group", CSL.END);
	if (macro_key_token.decorations) {
		end_of_macro.decorations = macro_key_token.decorations.slice();
    }
    if (hasDate) {
        func = function (state, Item) {
            if (state.tmp.extension) {
                state.tmp["doing-macro-with-date"] = false;
            }
        };
        end_of_macro.execs.push(func);
    }
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
            if (attributes.hasOwnProperty(key)) {
                if (tokentype === CSL.END && key !== "@language" && key !== "@locale") {
                    continue;
                }
                if (attributes.hasOwnProperty(key)) {
                    if (CSL.Attributes[key]) {
                        try {
                            CSL.Attributes[key].call(token, state, "" + attributes[key]);
                        } catch (e) {
                            CSL.error(e);
                            throw "CSL processor error, " + key + " attribute: " + e;
                        }
                    } else {
                        CSL.debug("warning: undefined attribute \""+key+"\" in style");
                    }
                }
            }
        }
        token.decorations = decorations;
    } else if (tokentype === CSL.END && attributes['@variable']) {
        token.hasVariable = true;
    }
    target = state[state.build.area].tokens;
    CSL.Node[name].build.call(token, state, target);
};
CSL.DateParser = function () {
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
    };
    this.setOrderMonthDay = function() {
        this.monthguess = 0;
        this.dayguess = 1;
    };
    this.setOrderMonthDay();
    this.resetMonths = function() {
        var i, ilen, j, jlen;
        this.msets = [];
        for (i = 0, ilen = this.mstrings.length; i < ilen; i += 1) {
            this.msets.push([this.mstrings[i]]);
        }
        this.mabbrevs = [];
        for (i = 0, ilen = this.msets.length; i < ilen; i += 1) {
            this.mabbrevs.push([]);
            for (j = 0, jlen = this.msets[i].length; j < jlen; j += 1) {
                this.mabbrevs[i].push(this.msets[i][0].slice(0, 3));
            }
        }
        this.mrexes = [];
        for (i = 0, ilen = this.mabbrevs.length; i < ilen; i += 1) {
            this.mrexes.push(new RegExp("(?:" + this.mabbrevs[i].join("|") + ")"));
        }
    };
    this.resetMonths();
    this.addMonths = function(lst) {
        var i, ilen, j, jlen, k, klen, jkey, kkey;
        if ("string" === typeof lst) {
            lst = lst.split(/\s+/);
        }
        if (lst.length !== 12 && lst.length !== 16) {
            CSL.debug("month [+season] list of "+lst.length+", expected 12 or 16. Ignoring.");
            return;
        }
        var othermatch = [];
        var thismatch = [];
        for (i = 0, ilen = lst.length; i < ilen; i += 1) {
            var abbrevlen = false;
            var skip = false;
            var insert = 3;
            var extend = {};
            for (j = 0, jlen = this.mabbrevs.length; j < jlen; j += 1) {
                extend[j] = {};
                if (j === i) {
                    for (k = 0, klen = this.mabbrevs[i].length; k < klen; k += 1) {
                        if (this.mabbrevs[i][k] === lst[i].slice(0, this.mabbrevs[i][k].length)) {
                            skip = true;
                            break;
                        }
                    }
                } else {
                    for (k = 0, klen = this.mabbrevs[j].length; k < klen; k += 1) {
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
                for (jkey in extend) {
                    if (extend.hasOwnProperty(jkey)) {
                        for (kkey in extend[jkey]) {
                            if (extend[jkey].hasOwnProperty(kkey)) {
                                abbrevlen = extend[jkey][kkey];
                                jkey = parseInt(jkey, 10);
                                kkey = parseInt(kkey, 10);
                                this.mabbrevs[jkey][kkey] = this.msets[jkey][kkey].slice(0, abbrevlen);
                            }
                        }
                    }
                }
            }
            if (!skip) {
                this.msets[i].push(lst[i]);
                this.mabbrevs[i].push(lst[i].slice(0, insert));
            }
        }
        this.mrexes = [];
        for (i = 0, ilen = this.mabbrevs.length; i < ilen; i += 1) {
            this.mrexes.push(new RegExp("(?:" + this.mabbrevs[i].join("|") + ")"));
        }
    };
    this.parse = function (txt) {
        var slash, dash, lst, l, m, number, note, thedate, slashcount, range_delim, date_delim, ret, delim_pos, delims, isrange, suff, date, breakme, item, delim, element, mm, slst, mmpos, i, ilen, j, jlen, k, klen;
	if (txt) {
        txt = "" + txt;
        txt = txt.replace(/\s*[0-9]{2}:[0-9]{2}(?::[0-9]+)/,"");
        m = txt.match(jmd);
        if (m) {
            txt = txt.replace(/\s+/, "", "g");
            txt = txt.replace(jy, "", "g");
            txt = txt.replace(jmd, "-", "g");
            txt = txt.replace(jr, "/", "g");
            txt = txt.replace("-/", "/", "g");
            txt = txt.replace(/-$/,"", "g");
            slst = txt.split(jiysplitter);
            lst = [];
            mm = txt.match(jiymatcher);
            if (mm) {
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
            } else {
                lst = slst;
            }
            l = lst.length;
            for    (pos = 1; pos < l; pos += 3) {
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
    };
    this.returnAsKeys = function () {
        this.use_array = false;
    };
    this.toArray = function (thedate) {
        var i, ilen, part;
        thedate["date-parts"] = [];
        thedate["date-parts"].push([]);
        var slicelen = 0;
        for (i = 0, ilen = 3; i < ilen; i += 1) {
            part = ["year", "month", "day"][i];
            if (!thedate[part]) {
                break;
            }
            slicelen += 1;
            thedate["date-parts"][0].push(thedate[part]);
            delete thedate[part];
        }
        thedate["date-parts"].push([]);
        for (i = 0, ilen = slicelen; i < ilen; i += 1) {
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
    };
    this.parseNumericDate = function (ret, delim, suff, txt) {
        var lst, i, ilen;
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
        if (lst.length === 1 || (lst.length === 2 && !lst[1])) {
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
    this.processor_version = CSL.PROCESSOR_VERSION;
    this.csl_version = "1.0";
    this.sys = sys;
    if (sys.variableWrapper) {
        CSL.VARIABLE_WRAPPER_PREPUNCT_REX = new RegExp('^([' + [" "].concat(CSL.SWAPPING_PUNCTUATION).join("") + ']*)(.*)');
    }
    this.sys.xml = new CSL.System.Xml.Parsing();
    if ("undefined" === typeof CSL_JSON && "string" !== typeof style) {
        style = "";
    }
    if (CSL.getAbbreviation) {
        this.sys.getAbbreviation = CSL.getAbbreviation;
    }
    if (this.sys.stringCompare) {
        CSL.stringCompare = this.sys.stringCompare;
    }
    this.sys.AbbreviationSegments = CSL.AbbreviationSegments;
    this.parallel = new CSL.Parallel(this);
    this.transform = new CSL.Transform(this);
    this.setParseNames = function (val) {
        this.opt['parse-names'] = val;
    };
    this.opt = new CSL.Engine.Opt();
    this.tmp = new CSL.Engine.Tmp();
    this.build = new CSL.Engine.Build();
    this.fun = new CSL.Engine.Fun(this);
    this.configure = new CSL.Engine.Configure();
    this.citation_sort = new CSL.Engine.CitationSort();
    this.bibliography_sort = new CSL.Engine.BibliographySort();
    this.citation = new CSL.Engine.Citation(this);
    this.bibliography = new CSL.Engine.Bibliography();
    this.output = new CSL.Output.Queue(this);
    this.dateput = new CSL.Output.Queue(this);
    this.cslXml = this.sys.xml.makeXml(style);
    if (this.opt.development_extensions.csl_reverse_lookup_support) {
        this.build.cslNodeId = 0;
        this.setCslNodeIds = function(myxml, nodename) {
            var children = this.sys.xml.children(myxml);
            this.sys.xml.setAttribute(myxml, 'cslid', this.build.cslNodeId);
            this.opt.nodenames.push(nodename);
            this.build.cslNodeId += 1;
            for (var i = 0, ilen = this.sys.xml.numberofnodes(children); i < ilen; i += 1) {
                nodename = this.sys.xml.nodename(children[i]);
                if (nodename) {
                    this.setCslNodeIds(children[i], nodename);
                }
            }
        };
        this.setCslNodeIds(this.cslXml, "style");
    }
    this.sys.xml.addMissingNameNodes(this.cslXml);
    this.sys.xml.addInstitutionNodes(this.cslXml);
    this.sys.xml.insertPublisherAndPlace(this.cslXml);
    this.sys.xml.flagDateMacros(this.cslXml);
    attrs = this.sys.xml.attributes(this.cslXml);
    if ("undefined" === typeof attrs["@sort-separator"]) {
        this.sys.xml.setAttribute(this.cslXml, "sort-separator", ", ");
    }
    this.opt["initialize-with-hyphen"] = true;
    this.setStyleAttributes();
    this.opt.xclass = sys.xml.getAttributeValue(this.cslXml, "class");
    this.opt.styleID = this.sys.xml.getStyleId(this.cslXml);
    this.opt.styleName = this.sys.xml.getStyleId(this.cslXml, true);
    if (CSL.getSuppressJurisdictions) {
        this.opt.suppressJurisdictions = CSL.getSuppressJurisdictions(this.opt.styleID);
    }
    if (this.opt.version.slice(0,4) === "1.1m") {
        this.opt.development_extensions.static_statute_locator = true;
        this.opt.development_extensions.handle_parallel_articles = true;
        this.opt.development_extensions.main_title_from_short_title = true;
        this.opt.development_extensions.strict_page_numbers = true;
        this.opt.development_extensions.rtl_support = true;
        this.opt.development_extensions.expect_and_symbol_form = true;
        this.opt.development_extensions.require_explicit_legal_case_title_short = true;
    }
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
    if (!this.opt["default-locale-sort"]) {
        this.opt["default-locale-sort"] = this.opt["default-locale"][0];
    }
    this.localeConfigure(langspec);
    function makeRegExp(lst) {
        var lst = lst.slice();
        var ret = new RegExp( "((?:[?!:]*\\s+|-|^)(?:" + lst.join("|") + ")(?=[!?:]*\\s+|-|$))" );
        return ret;
    }
    this.locale[this.opt.lang].opts["skip-words-regexp"] = makeRegExp(this.locale[this.opt.lang].opts["skip-words"]);
    this.output.adjust = new CSL.Output.Queue.adjust(this.getOpt('punctuation-in-quote'));
    this.registry = new CSL.Registry(this);
    this.buildTokenLists("citation");
    this.buildTokenLists("bibliography");
    this.configureTokenLists();
    this.disambiguate = new CSL.Disambiguation(this);
    this.splice_delimiter = false;
    this.fun.dateparser = new CSL.DateParser();
    this.fun.flipflopper = new CSL.Util.FlipFlopper(this);
    this.setCloseQuotesArray();
    this.fun.ordinalizer.init(this);
    this.fun.long_ordinalizer.init(this);
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
CSL.makeBuilder = function (me) {
    function enterFunc (node) {
        CSL.XmlToToken.call(node, me, CSL.START);
    };
    function leaveFunc (node) {
        CSL.XmlToToken.call(node, me, CSL.END);
    };
    function singletonFunc (node) {
        CSL.XmlToToken.call(node, me, CSL.SINGLETON);
    };
    function buildStyle (node) {
        var starttag, origparent;
        if (me.sys.xml.numberofnodes(me.sys.xml.children(node))) {
            origparent = node;
            enterFunc(origparent);
            for (var i=0;i<me.sys.xml.numberofnodes(me.sys.xml.children(origparent));i+=1) {
                node = me.sys.xml.children(origparent)[i];
                if (me.sys.xml.nodename(node) === null) {
                    continue;
                }
                if (me.sys.xml.nodename(node) === "date") {
                    CSL.Util.fixDateNode.call(me, origparent, i, node)
                    node = me.sys.xml.children(origparent)[i];
                }
                buildStyle(node, enterFunc, leaveFunc, singletonFunc);
            }
            leaveFunc(origparent);
        } else {
            singletonFunc(node);
        }
    }
    return buildStyle;
};
CSL.Engine.prototype.buildTokenLists = function (area) {
    var builder = CSL.makeBuilder(this);
    var area_nodes;
    area_nodes = this.sys.xml.getNodesByName(this.cslXml, area);
    if (!this.sys.xml.getNodeValue(area_nodes)) {
        return;
    }
    this.build.area = area;
    var mynode = area_nodes[0];
    builder(mynode);
};
CSL.Engine.prototype.setStyleAttributes = function () {
    var dummy, attr, key, attributes, attrname;
    dummy = {};
    var cslXml = this.cslXml;
    if (!this.cslXml.tagName || ("" + this.cslXml.tagName).toLowerCase() !== 'style') {
        if (this.cslXml.getElementsByTagName) {
            var cslXml = this.cslXml.getElementsByTagName('style')[0];
        }
    }
    dummy.name = this.sys.xml.nodename(cslXml);
    attributes = this.sys.xml.attributes(cslXml);
    for (attrname in attributes) {
        if (attributes.hasOwnProperty(attrname)) {
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
    if (!ret && term === "range-delimiter") {
        ret = "\u2013";
    }
    if (typeof ret === "undefined") {
        if (mode === CSL.STRICT) {
            throw "Error in getTerm: term \"" + term + "\" does not exist.";
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
    for (var i = 0, ilen = ids.length; i < ilen; i += 1) {
        ret.push(this.retrieveItem("" + ids[i]));
    }
    return ret;
};
CSL.ITERATION = 0;
CSL.Engine.prototype.retrieveItem = function (id) {
    var Item, m, pos, len, mm;
    if (this.opt.development_extensions.normalize_lang_keys_to_lowercase &&
        "boolean" === typeof this.opt.development_extensions.normalize_lang_keys_to_lowercase) {
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
    CSL.ITERATION += 1;
    Item = this.sys.retrieveItem("" + id);
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
        for (var i=0, ilen=CSL.CREATORS.length; i>ilen; i+=1) {
            var ctype = CSL.CREATORS[i];
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
    if (Item.page) {
        Item["page-first"] = Item.page;
        var num = "" + Item.page;
        m = num.split(/\s*(?:&|,|-|\u2013)\s*/);
        if (m[0].slice(-1) !== "\\") {
            Item["page-first"] = m[0];
        }
    }
    if (this.opt.development_extensions.field_hack && Item.note) {
        m = Item.note.match(CSL.NOTE_FIELDS_REGEXP);
        if (m) {
            var names = {};
            for (pos = 0, len = m.length; pos < len; pos += 1) {
                mm = m[pos].match(CSL.NOTE_FIELD_REGEXP);
                if (!Item[mm[1]] && CSL.DATE_VARIABLES.indexOf(mm[1]) > -1) {
                    Item[mm[1]] = {raw:mm[2]};
                } else if (!Item[mm[1]] && CSL.NAME_VARIABLES.indexOf(mm[1]) > -1) {
                    if (!Item[mm[1]]) {
                        Item[mm[1]] = [];
                    }
                    var lst = mm[2].split(/\s*\|\|\s*/);
                    if (lst.length === 1) {
                        Item[mm[1]].push({family:lst[0],isInstitution:true});
                    } else if (lst.length === 2) {
                        Item[mm[1]].push({family:lst[0],given:lst[1]});
                    }
                } else if (!Item[mm[1]] || mm[1] === "type") {
                    Item[mm[1]] = mm[2].replace(/^\s+/, "").replace(/\s+$/, "");
                }
                Item.note.replace(CSL.NOTE_FIELD_REGEXP, "");
            }
        }
    }
    for (var i = 1, ilen = CSL.DATE_VARIABLES.length; i < ilen; i += 1) {
        var dateobj = Item[CSL.DATE_VARIABLES[i]];
        if (dateobj) {
            if (this.opt.development_extensions.raw_date_parsing) {
                if (dateobj.raw) {
                    dateobj = this.fun.dateparser.parse(dateobj.raw);
                }
            }
            Item[CSL.DATE_VARIABLES[i]] = this.dateParseArray(dateobj);
        }
    }
    if (this.opt.development_extensions.static_statute_locator) {
        if (Item.type && ["bill","gazette","legislation","treaty"].indexOf(Item.type) > -1) {
            var varname;
            var elements = ["type", "title", "jurisdiction", "genre", "volume", "container-title"];
            var legislation_id = [];
            for (i = 0, ilen = elements.length; i < ilen; i += 1) {
                varname = elements[i];
				if (Item[varname]) {
					legislation_id.push(Item[varname]);
				}
			}
            elements = ["original-date", "issued"];
			for (i = 0, elements.length; i < ilen; i += 1) {
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
    if (!Item["title-short"]) {
        Item["title-short"] = Item.shortTitle;
    }
    if (this.opt.development_extensions.main_title_from_short_title) {
        Item["title-main"] = Item.title;
        Item["title-sub"] = false;
        if (Item.title && Item['title-short']) {
            var shortTitle = Item['title-short'];
            offset = shortTitle.length;
            if (Item.title.slice(0,offset) === shortTitle && Item.title.slice(offset).match(/^\s*:/)) {
                Item["title-main"] = Item.title.slice(0,offset).replace(/\s+$/,"");
                Item["title-sub"] = Item.title.slice(offset).replace(/^\s*:\s*/,"");
            }
        }
    }
    var isLegalType = ["legal_case","legislation","gazette","regulation"].indexOf(Item.type) > -1;
    if (!isLegalType && Item.title && this.sys.getAbbreviation) {
        var noHints = false;
        if (!Item.jurisdiction) {
            noHints = true;
        }
        var jurisdiction = this.transform.loadAbbreviation(Item.jurisdiction, "title", Item.title, Item.type, true);
        if (this.transform.abbrevs[jurisdiction].title) {
            if (this.transform.abbrevs[jurisdiction].title[Item.title]) {
                Item["title-short"] = this.transform.abbrevs[jurisdiction].title[Item.title];
            }
        }
    }
    Item["container-title-short"] = Item.journalAbbreviation;
    if (Item["container-title"] && this.sys.getAbbreviation) {
        var jurisdiction = this.transform.loadAbbreviation(Item.jurisdiction, "container-title", Item["container-title"]);
        if (this.transform.abbrevs[jurisdiction]["container-title"]) {
            if (this.transform.abbrevs[jurisdiction]["container-title"][Item["container-title"]]) {
                Item["container-title-short"] = this.transform.abbrevs[jurisdiction]["container-title"][Item["container-title"]];
            }
        }
    }
    return Item;
};
CSL.Engine.prototype.setOpt = function (token, name, value) {
    if (token.name === "style" || token.name === "cslstyle") {
        this.opt[name] = value;
    } else if (["citation", "bibliography"].indexOf(token.name) > -1) {
        this[token.name].opt[name] = value;
    } else if (["name-form", "name-delimiter", "names-delimiter"].indexOf(name) === -1) {
        token.strings[name] = value;
    }
};
CSL.Engine.prototype.fixOpt = function (token, name, localname) {
    if (["citation", "bibliography"].indexOf(token.name) > -1) {
        if (! this[token.name].opt[name] && "undefined" !== typeof this.opt[name]) {
            this[token.name].opt[name] = this.opt[name];
        }
    }
    if ("name" === token.name || "names" === token.name) {
        if ("undefined" === typeof token.strings[localname] && "undefined" !== typeof this[this.build.root].opt[name]) {
            token.strings[localname] = this[this.build.root].opt[name];
        }
    }
};
CSL.Engine.prototype.remapSectionVariable = function (inputList) {
    for (var i = 0, ilen = inputList.length; i < ilen; i += 1) {
        var Item = inputList[i][0];
        var item = inputList[i][1];
        var section_label_count = 0;
        var later_label = false;
        var value = false;
        if (["bill","gazette","legislation","treaty"].indexOf(Item.type) > -1) {
            item.force_pluralism = 0;
            if (!item.label) {
                item.label = "page"
            }
            var loci = ["section","","",""];
            var split;
            if (this.opt.development_extensions.static_statute_locator && Item.section) {
                splt = Item.section.replace(/^\s+/,"").replace(/\s+$/, "").split(/\s+/);
                if (CSL.STATUTE_SUBDIV_STRINGS[splt[0]]) {
                    loci[0] = " " + splt[0] + " ";
                    loci[1] = splt.slice(1).join(" ");
                } else {
                    loci[0] = " sec. ";
                    loci[1] = splt.slice(0).join(" ");
                }
            } else {
                if (this.opt.development_extensions.clobber_locator_if_no_statute_section) {
                    item.locator = undefined;
                    item.label = undefined;
                }
            }
            if (item.locator) {
                var splt = item.locator.replace(/^\s+/,"").replace(/\s+$/, "").split(/\s+/);
                if (CSL.STATUTE_SUBDIV_STRINGS[splt[0]]) {
                    loci[2] = " " + splt[0] + " ";
                    loci[3] = splt.slice(1).join(" ");
                } else if (item.label) {
                    loci[2] = " " + CSL.STATUTE_SUBDIV_STRINGS_REVERSE[item.label] + " ";
                    loci[3] = splt.slice(0).join(" ");
                } else {
                    loci[3] = splt.join(" ")
                }
                if (loci[3] && loci[3].slice(0,1) === "&") {
                    loci[3] = " " + loci[3];
                }
            }
            if (!loci[2]) {
                loci[2] = loci[0];
            }
            if (loci[3]) {
                if (loci[3].match(/^[^0-9a-zA-Z]/)) {
                    var loclst = loci[3].split(/\s+/);
                    if (loci[0] === loci[2] && loclst[1] && !CSL.STATUTE_SUBDIV_STRINGS[loclst[1].replace(/\s+/, "").replace(/\s+/, "")]) {
                        item.force_pluralism = 1;
                    }
                    loci[2] = "";
                }
            } else {
                loci[2] = "";
            }
            if (!loci[1]) {
                loci[0] = "";
            }
            var value = loci.join("");
            value = value.replace(/^\s+/,"").replace(/\s+$/, "");
            if (value) {
                splt = value.split(/\s+/);
                if (CSL.STATUTE_SUBDIV_STRINGS[splt[0]]) {
                    var has_other = false;
                    for (var j = splt.length - 2; j > 0; j += -2) {
                        if (splt[j] === splt[0]) {
                            item.force_pluralism = 1;
                            splt = splt.slice(0,j).concat(splt.slice(j + 1));
                        }
                    }
                    item.label = CSL.STATUTE_SUBDIV_STRINGS[splt[0]];
                    item.locator = splt.slice(1).join(" ");
                    if (item.force_pluralism === 0) {
                        delete item.force_pluralism;
                    }
                } else {
                    item.locator = splt.slice(0).join(" ");
                }
            }
        }
    }
}
CSL.Engine.prototype.setNumberLabels = function (Item) {
    if (Item.number
        && ["bill", "gazette", "legislation", "treaty"].indexOf(Item.type) > -1
        && this.opt.development_extensions.static_statute_locator
        && !this.tmp.shadow_numbers["number"]) {
        this.tmp.shadow_numbers["number"] = {};
        this.tmp.shadow_numbers["number"].values = [];
        this.tmp.shadow_numbers["number"].plural = 0;
        this.tmp.shadow_numbers["number"].numeric = false;
        this.tmp.shadow_numbers["number"].label = false;
        var value = "" + Item.number;
        value = value.replace("\\", "", "g");
        var firstword = value.split(/\s/)[0];
        var firstlabel = CSL.STATUTE_SUBDIV_STRINGS[firstword];
        if (firstlabel) {
            var m = value.match(CSL.STATUTE_SUBDIV_GROUPED_REGEX);
            var splt = value.split(CSL.STATUTE_SUBDIV_PLAIN_REGEX);
            if (splt.length > 1) {
                var lst = [];
                for (var j=1, jlen=splt.length; j < jlen; j += 1) {
                    var subdiv = m[j - 1].replace(/^\s*/, "");
                    lst.push(subdiv.replace("sec.", "Sec.").replace("ch.", "Ch."));
                    lst.push(splt[j].replace(/\s*$/, "").replace(/^\s*/, ""));
                }
                value = lst.join(" ");
            } else {
                value = splt[0];
            }
            this.tmp.shadow_numbers["number"].values.push(["Blob", value, false]);
            this.tmp.shadow_numbers["number"].numeric = false;
        } else {
            this.tmp.shadow_numbers["number"].values.push(["Blob", value, false]);
            this.tmp.shadow_numbers["number"].numeric = true;
        }
    }
}
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
CSL.Engine.prototype.normalDecorIsOrphan = function (blob, params) {
    if (params[1] === "normal") {
        var use_param = false;
        var all_the_decor;
        if (this.tmp.area === "citation") {
            all_the_decor = [this.citation.opt.layout_decorations].concat(blob.alldecor);
        } else {
            all_the_decor = blob.alldecor;
        }
        for (var k = all_the_decor.length - 1; k > -1; k += -1) {
            for (var n = all_the_decor[k].length - 1; n > -1; n += -1) {
                if (all_the_decor[k][n][0] === params[0]) {
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
    for (var i = 0, ilen = CSL.CREATORS.length; i < ilen; i += 1) {
        var n = CSL.CREATORS[i];
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
                myname = myname.replace(CSL.ROMANESQUE_NOT_REGEXP, "", "g");
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
        throw "Bad trigraph definition: "+this.opt.trigraph;
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
                throw "Invalid character in trigraph definition: "+this.opt.trigraph;
            }
        }
        params.push(config);
    }
    return params;
};
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
            return 1
        } else if (a.length > b.length) {
            return -1
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
    for (var i = 0, ilen = segments.length; i < ilen; i += 1) {
        var clientSegment = conv(segments[i]);
        var citeprocSegment = segments[i].toLowerCase();
        if (!obj[clientSegment]) {
            continue;
        }
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
CSL.Output.Queue.prototype.pop = function () {
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
    if (this.state.tmp["doing-macro-with-date"] && this.state.tmp.extension) {
        token = this.empty;
        name = "empty";
    }
    tokenstore[name] = token;
    this.pushFormats(tokenstore);
    this.openLevel(name);
};
CSL.Output.Queue.prototype.endTag = function (name) {
    this.closeLevel();
    this.popFormats();
};
CSL.Output.Queue.prototype.openLevel = function (token, ephemeral) {
    var blob, curr, x, has_ephemeral;
    if ("object" === typeof token) {
        blob = new CSL.Blob(undefined, token);
    } else if ("undefined" === typeof token) {
        blob = new CSL.Blob(undefined, this.formats.value().empty, "empty");
    } else {
        if (!this.formats.value() || !this.formats.value()[token]) {
            throw "CSL processor error: call to nonexistent format token \"" + token + "\"";
        }
        blob = new CSL.Blob(undefined, this.formats.value()[token], token);
    }
    if (this.nestedBraces) {
        blob.strings.prefix = blob.strings.prefix.replace(this.nestedBraces[0][0], this.nestedBraces[0][1]);
        blob.strings.prefix = blob.strings.prefix.replace(this.nestedBraces[1][0], this.nestedBraces[1][1]);
        blob.strings.suffix = blob.strings.suffix.replace(this.nestedBraces[0][0], this.nestedBraces[0][1]);
        blob.strings.suffix = blob.strings.suffix.replace(this.nestedBraces[1][0], this.nestedBraces[1][1]);
    }
    curr = this.current.value();
    curr.push(blob);
    this.current.push(blob);
};
CSL.Output.Queue.prototype.closeLevel = function (name) {
    if (name && name !== this.current.value().levelname) {
        CSL.error("Level mismatch error:  wanted " + name + " but found " + this.current.value().levelname);
    }
    this.current.pop();
};
CSL.Output.Queue.prototype.append = function (str, tokname, notSerious, ignorePredecessor, noStripPeriods) {
    var token, blob, curr;
    var useblob = true;
    if (notSerious) {
        ignorePredecessor = true;
    }
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
        throw "CSL processor error: unknown format token name: " + tokname;
    }
    if (token.strings && "undefined" === typeof token.strings.delimiter) {
        token.strings.delimiter = "";
    }
    if ("string" === typeof str && str.length) {
        str = str.replace(/ ([:;?!\u00bb])/g, "\u202f$1").replace(/\u00ab /g, "\u00ab\u202f");
        this.last_char_rendered = str.slice(-1);
        str = str.replace(/\s+'/g, "  \'").replace(/^'/g, " \'");
        if (!ignorePredecessor) {
            this.state.tmp.term_predecessor = true;
        } else if (notSerious) {
            this.state.tmp.term_predecessor_name = true;
        }
    }
    blob = new CSL.Blob(str, token);
    if (this.nestedBraces) {
        blob.strings.prefix = blob.strings.prefix.replace(this.nestedBraces[0][0], this.nestedBraces[0][1]);
        blob.strings.prefix = blob.strings.prefix.replace(this.nestedBraces[1][0], this.nestedBraces[1][1]);
        blob.strings.suffix = blob.strings.suffix.replace(this.nestedBraces[0][0], this.nestedBraces[0][1]);
        blob.strings.suffix = blob.strings.suffix.replace(this.nestedBraces[1][0], this.nestedBraces[1][1]);
    }
    curr = this.current.value();
    if ("undefined" === typeof curr && this.current.mystack.length === 0) {
        this.current.mystack.push([]);
        curr = this.current.value();
    }
    if ("string" === typeof blob.blobs) {
        if (!ignorePredecessor) {
            this.state.tmp.term_predecessor = true;
        } else if (notSerious) {
            this.state.tmp.term_predecessor_name = true;
        }
    }
    if (!notSerious) {
        this.state.parallel.AppendBlobPointer(curr);
    }
    if ("string" === typeof str) {
        curr.push(blob);
        if (blob.strings["text-case"]) {
            blob.blobs = CSL.Output.Formatters[blob.strings["text-case"]](this.state, str);
        }
        if (this.state.tmp.strip_periods && !noStripPeriods) {
            blob.blobs = blob.blobs.replace(/\.([^a-z]|$)/g, "$1");
        }
        for (var i = blob.decorations.length - 1; i > -1; i += -1) {
            if (blob.decorations[i][0] === "@quotes" && blob.decorations[i][1] === "true") {
                blob.punctuation_in_quote = this.state.getOpt("punctuation-in-quote");
            }
            if (!blob.blobs.match(CSL.ROMANESQUE_REGEXP)) {
                if (blob.decorations[i][0] === "@font-style") {
                    blob.decorations = blob.decorations.slice(0, i).concat(blob.decorations.slice(i + 1));
                }
            }
        }
        this.state.fun.flipflopper.init(str, blob);
        this.state.fun.flipflopper.processTags();
    } else if (useblob) {
        curr.push(blob);
    } else {
        curr.push(str);
    }
    return true;
};
CSL.Output.Queue.prototype.string = function (state, myblobs, blob) {
    var i, ilen, j, jlen, b;
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
        state.tmp.count_offset_characters = false;
        state.tmp.offset_characters = 0;
    }
    if (blob && blob.new_locale) {
        blob.old_locale = state.opt.lang;
        state.opt.lang = blob.new_locale;
    }
    var blobjr, use_suffix, use_prefix, params;
    for (i = 0, ilen = blobs.length; i < ilen; i += 1) {
        blobjr = blobs[i];
        if (blobjr.strings.first_blob) {
            state.tmp.count_offset_characters = blobjr.strings.first_blob;
        }
        if ("string" === typeof blobjr.blobs) {
            if ("number" === typeof blobjr.num) {
                ret.push(blobjr);
            } else if (blobjr.blobs) {
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
                if (b && b.length) {
                    b = txt_esc(blobjr.strings.prefix, state.tmp.nestedBraces) + b + txt_esc(blobjr.strings.suffix, state.tmp.nestedBraces);
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
            ret = ret.concat(addtoret);
        }
        if (blobjr.strings.first_blob) {
            state.registry.registry[blobjr.strings.first_blob].offset = state.tmp.offset_characters;
            state.tmp.count_offset_characters = false;
        }
    }
    for (i=0,ilen=ret.length - 1;i<ilen;i+=1) {
        if ("number" === typeof ret[i].num && "number" === typeof ret[i+1].num && !ret[i+1].UGLY_DELIMITER_SUPPRESS_HACK) {
            ret[i].strings.suffix = ret[i].strings.suffix + (blob_delimiter ? blob_delimiter : "");
            ret[i+1].successor_prefix = "";
            ret[i+1].UGLY_DELIMITER_SUPPRESS_HACK = true;
        }
    }
    var span_split = 0;
    for (i = 0, ilen = ret.length; i < ilen; i += 1) {
        if ("string" === typeof ret[i]) {
            span_split = (parseInt(i, 10) + 1);
            if (i < ret.length - 1  && "object" === typeof ret[i + 1]) {
                if (blob_delimiter && !ret[i + 1].UGLY_DELIMITER_SUPPRESS_HACK) {
                    ret[i] += txt_esc(blob_delimiter);
                }
                ret[i + 1].UGLY_DELIMITER_SUPPRESS_HACK = true;
            }
        }
    }
    if (blob && (blob.decorations.length || blob.strings.suffix || blob.strings.prefix)) {
        span_split = ret.length;
    }
    var blobs_start = state.output.renderBlobs(ret.slice(0, span_split), blob_delimiter, true, blob);
    if (blobs_start && blob && (blob.decorations.length || blob.strings.suffix || blob.strings.prefix)) {
        if (!state.tmp.suppress_decorations) {
            for (i = 0, ilen = blob.decorations.length; i < ilen; i += 1) {
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
        b = blobs_start;
        use_suffix = blob.strings.suffix;
        if (b && b.length) {
            use_prefix = blob.strings.prefix;
            b = txt_esc(use_prefix, state.tmp.nestedBraces) + b + txt_esc(use_suffix, state.tmp.nestedBraces);
            if (state.tmp.count_offset_characters) {
                state.tmp.offset_characters += (use_prefix.length + use_suffix.length);
            }
        }
        blobs_start = b;
        if (!state.tmp.suppress_decorations) {
            for (i = 0, ilen = blob.decorations.length; i < ilen; i += 1) {
                params = blob.decorations[i];
                if (["@cite","@bibliography", "@display", "@showid"].indexOf(params[0]) === -1) {
                    continue;
                }
                blobs_start = state.fun.decorate[params[0]][params[1]].call(blob, state, blobs_start, params[2]);
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
    if ("undefined" === typeof blob) {
        this.queue = [];
        this.current.mystack = [];
        this.current.mystack.push(this.queue);
        if (state.tmp.suppress_decorations) {
            ret = state.output.renderBlobs(ret, undefined, true);
        }
    } else if ("boolean" === typeof blob) {
        ret = state.output.renderBlobs(ret, undefined, true);
    }
    if (blob && blob.new_locale) {
        state.opt.lang = blob.old_locale;
    }
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
    var state, ret, ret_last_char, use_delim, i, blob, pos, len, ppos, llen, pppos, lllen, res, str, params, txt_esc;
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
            blobs[pos].checkNext(blobs[(pos + 1)],start);
            start = false;
        } else {
            start = true;
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
        if ("string" === typeof blob) {
            ret += txt_esc(use_delim);
            ret += blob;
            if (state.tmp.count_offset_characters) {
                state.tmp.offset_characters += (use_delim.length);
            }
        } else if (blob.status !== CSL.SUPPRESS) {
            str = blob.formatter.format(blob.num, blob.gender);
            var strlen = str.replace(/<[^>]*>/g, "").length;
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
                addme = txt_esc(blob.range_prefix);
            } else if (blob.status === CSL.SUCCESSOR) {
                addme = txt_esc(blob.successor_prefix);
            } else if (blob.status === CSL.START) {
                addme = "";
            } else if (blob.status === CSL.SEEN) {
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
    if ("object" !== typeof parent || "object" !== typeof parent.blobs || !parent.blobs.length) {
        return;
    }
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
};
CSL.Output.Queue.adjust = function (punctInQuote) {
    var NO_SWAP_IN = {
        ";": true,
        ":": true
    }
    var NO_SWAP_OUT = {
        ".": true,
        "!": true,
        "?": true
    }
    this.upward = upward;
    this.leftward = leftward;
    this.downward = downward;
    this.fix = fix;
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
    }
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
    };
    function blobEndsInNumber(blob) {
        if ("number" === typeof blob.num) {
            return true;
        }
        if (!blob.blobs || "object" !==  typeof blob.blobs) return false;
        if (blobEndsInNumber(blob.blobs[blob.blobs.length-1])) return true;
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
    };
    function blobHasDescendantQuotes(blob) {
        if (blob.decorations) {
            for (var i=0,ilen=blob.decorations.length;i<ilen;i++) {
                if (blob.decorations[i][0] === '@quotes') {
                    return true;
                }
            }
        }
        if ("object" !== typeof blob.blobs) return false;
        if (blobHasDescendantQuotes(blob.blobs[blob.blobs.length-1])) return true;
        return false;
    }
    function matchLastChar(blob, chr) {
        if (blob.strings.suffix.slice(0, 1) === chr) {
            return true;
        } else if ("string" === typeof blob.blobs) {
            if (blob.blobs.slice(-1) === chr) {
                return true;
            } else {
                return false;
            }
        }
        for (var i=0,ilen=blob.blobs.length;i<ilen;i++) {
            if (matchLastChar(blob.blobs[i])) return true;
        }
        return false;
    };
    function mergeChars (First, first, Second, second, merge_right) {
        FirstStrings = "blobs" === first ? First : First.strings;
        SecondStrings = "blobs" === second ? Second: Second.strings;
        var firstChar = FirstStrings[first].slice(-1);
        var secondChar = SecondStrings[second].slice(0,1);
        function cullRight () {
            SecondStrings[second] = SecondStrings[second].slice(1);
        };
        function cullLeft () {
            FirstStrings[first] = FirstStrings[first].slice(0,-1);
        };
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
            var chr = FirstStrings[first].slice(-1);
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
    };
    function upward (parent) {
        if ("object" !== typeof parent || "object" !== typeof parent.blobs || !parent.blobs.length) {
            return;
        }
        var parentDecorations = blobHasDecorations(parent,true);
        for (var i=parent.blobs.length-1;i>-1;i--) {
            var endFlag = i === (parent.blobs.length-1);
            this.upward(parent.blobs[i]);
            var parentStrings = parent.strings;
            var childStrings = parent.blobs[i].strings;
            if (i === 0) {
                if (" " === parentStrings.prefix.slice(-1) && " " === childStrings.prefix.slice(0, 1)) {
                    childStrings.prefix = childStrings.prefix.slice(1);
                }
                var childChar = childStrings.prefix.slice(0, 1);
                if (!parentDecorations && PUNCT_OR_SPACE[childChar] && !parentStrings.prefix) {
                    parentStrings.prefix += childChar;
                    childStrings.prefix = childStrings.prefix.slice(1);
                }
            }
            if (i === (parent.blobs.length - 1)) {
                var childChar = childStrings.suffix.slice(-1);
                if (!parentDecorations && [" "].indexOf(childChar) > -1) {
                    if (parentStrings.suffix.slice(0,1) !== childChar) {
                        parentStrings.suffix = childChar + parentStrings.suffix;
                    }
                    childStrings.suffix = childStrings.suffix.slice(0, -1);
                }
            }
            if (parentStrings.delimiter && i > 0) {
                if (PUNCT_OR_SPACE[parentStrings.delimiter.slice(-1)]
                    && parentStrings.delimiter.slice(-1) === childStrings.prefix.slice(0, 1)) {
                    childStrings.prefix = childStrings.prefix.slice(1);
                }
            }
        }
    };
    function leftward (parent) {
        if ("object" !== typeof parent || "object" !== typeof parent.blobs || !parent.blobs.length) {
            return;
        }
        for (var i=parent.blobs.length-1;i>-1;i--) {
            this.leftward(parent.blobs[i]);
            if ((i < parent.blobs.length -1) && !parent.strings.delimiter) {
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
                    } else {
                        sibling.strings.prefix = sibling.strings.prefix.slice(1);
                    }
                }
            }
        }
    };
    function downward (parent) {
        if ("object" !== typeof parent || "object" !== typeof parent.blobs || !parent.blobs.length) {
            return;
        }
        var parentStrings = parent.strings;
        var someChildrenAreNumbers = false;
        for (var i=0,ilen=parent.blobs.length;i<ilen;i++) {
            if (blobIsNumber(parent.blobs[i])) {
                someChildrenAreNumbers = true;
                break;
            }
        }
        if (!someChildrenAreNumbers) {
            if (parentStrings.delimiter && PUNCT[parentStrings.delimiter.slice(0, 1)]) {
                var delimChar = parentStrings.delimiter.slice(0, 1);
                for (var i=parent.blobs.length-2;i>-1;i--) {
                    var childStrings = parent.blobs[i].strings;
                    childStrings.suffix += delimChar;
                }
                parentStrings.delimiter = parentStrings.delimiter.slice(1);
            }
        }
        var parentDecorations = blobHasDecorations(parent, true);
        var parentIsNumber = blobIsNumber(parent);
        for (var i=parent.blobs.length-1;i>-1;i--) {
            var child = parent.blobs[i];
            var childStrings = parent.blobs[i].strings;
            var childDecorations = blobHasDecorations(child, true);
            var childIsNumber = blobIsNumber(child);
            if (i === (parent.blobs.length - 1)) {
                if (true || !someChildrenAreNumbers) {
                    if (!parentDecorations || blobHasDescendantQuotes(child)) {
                        var parentChar = parentStrings.suffix.slice(0, 1);
                        if (PUNCT[parentChar]) {
                            if (!blobEndsInNumber(child)) {
                                mergeChars(child, 'suffix', parent, 'suffix');
                            }
                        }
                        if (childStrings.suffix.slice(-1) === " " && parentStrings.suffix.slice(0,1)) {
                            parentStrings.suffix = parentStrings.suffix.slice(1);
                        }
                    } else {
                        if (matchLastChar(child,parent.strings.suffix.slice(0,1))) {
                            parent.strings.suffix = parent.strings.suffix.slice(1);
                        }   
                    }
                    if (PUNCT_OR_SPACE[childStrings.suffix.slice(0,1)]) {
                        if ("string" === typeof child.blobs && child.blobs.slice(-1) === childStrings.suffix.slice(0,1)) {
                            childStrings.suffix = childStrings.suffix.slice(1);
                        }
                        if (childStrings.suffix.slice(-1) === parentStrings.suffix.slice(0, 1)) {
                            childStrings.suffix = childStrings.suffix.slice(0, -1);
                        }
                    }
                }
            } else if (parentStrings.delimiter) {
                if (PUNCT_OR_SPACE[parentStrings.delimiter.slice(0,1)]
                    && parentStrings.delimiter.slice(0, 1) === childStrings.suffix.slice(-1)) {
                    parent.blobs[i].strings.suffix = parent.blobs[i].strings.suffix.slice(0, -1);
                }
            } else {
                var siblingStrings = parent.blobs[i+1].strings;
                if (!blobIsNumber(child) 
                    && !childDecorations
                    && PUNCT_OR_SPACE[childStrings.suffix.slice(-1)]
                    && childStrings.suffix.slice(-1) === siblingStrings.prefix.slice(0, 1)) {
                    siblingStrings.prefix = siblingStrings.prefix.slice(1);
                }
            }
            if (!childIsNumber && !childDecorations && PUNCT[childStrings.suffix.slice(0,1)]
                && "string" === typeof child.blobs) {
                mergeChars(child, 'blobs', child, 'suffix')
            }
            this.downward(parent.blobs[i]);
        }
    };
    function fix (parent) {
        if ("object" !== typeof parent || "object" !== typeof parent.blobs || !parent.blobs.length) {
            return;
        }
        var lastChar;
        for (var i=0,ilen=parent.blobs.length;i<ilen;i++) {
            var child = parent.blobs[i];
            var quoteSwap = false;
            for (var j=0,jlen=child.decorations.length;j<jlen;j++) {
                var decoration = child.decorations[j];
                if (decoration[0] === "@quotes") {
                    quoteSwap = true;
                }
            }
            if (quoteSwap) {
                if (punctInQuote) {
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
                } else {
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
            }
            lastChar = this.fix(parent.blobs[i]);
            if (child.blobs && "string" === typeof child.blobs) {
                lastChar = child.blobs.slice(-1);
            }
        }
        return lastChar;
    };
}
CSL.Engine.Opt = function () {
    this.has_disambiguate = false;
    this.mode = "html";
    this.dates = {};
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
    this["et-al-min"] = 0;
    this["et-al-use-first"] = 1;
    this["et-al-use-last"] = false;
    this["et-al-subsequent-min"] = false;
    this["et-al-subsequent-use-first"] = false;
    this["demote-non-dropping-particle"] = "display-and-sort";
    this["parse-names"] = true;
    this.citation_number_slug = false;
    this.trigraph = "Aaaa00:AaAa00:AaAA00:AAAA00";
    this.development_extensions = {};
    this.development_extensions.field_hack = true;
    this.development_extensions.locator_date_and_revision = true;
    this.development_extensions.locator_parsing_for_plurals = true;
    this.development_extensions.locator_label_parse = true;
    this.development_extensions.raw_date_parsing = true;
    this.development_extensions.clean_up_csl_flaws = true;
    this.development_extensions.flip_parentheses_to_braces = true;
    this.development_extensions.jurisdiction_subfield = true;
    this.development_extensions.static_statute_locator = false;
    this.development_extensions.csl_reverse_lookup_support = false;
    this.development_extensions.clobber_locator_if_no_statute_section = false;
    this.development_extensions.wrap_url_and_doi = false;
    this.development_extensions.allow_force_lowercase = false;
    this.development_extensions.handle_parallel_articles = false;
    this.development_extensions.thin_non_breaking_space_html_hack = false;
    this.development_extensions.apply_citation_wrapper = false;
    this.development_extensions.main_title_from_short_title = false;
    this.development_extensions.normalize_lang_keys_to_lowercase = false;
    this.development_extensions.strict_text_case_locales = false;
    this.development_extensions.rtl_support = false;
    this.development_extensions.strict_page_numbers = false;
    this.development_extensions.expect_and_symbol_form = false;
    this.development_extensions.require_explicit_legal_case_title_short = false;
    this.nodenames = [];
    this.gender = {};
    this['cite-lang-prefs'] = {
        persons:['orig'],
        institutions:['orig'],
        titles:['orig','translat'],
        journals:['translit'],
        publishers:['orig'],
        places:['orig'],
        number:['translat']
    };
    this.has_layout_locale = false;
};
CSL.Engine.Tmp = function () {
    this.names_max = new CSL.Stack();
    this.names_base = new CSL.Stack();
    this.givens_base = new CSL.Stack();
    this.value = [];
    this.namepart_decorations = {};
    this.namepart_type = false;
    this.area = "citation";
    this.root = "citation";
    this.extension = "";
    this.can_substitute = new CSL.Stack(0, CSL.LITERAL);
    this.element_rendered_ok = false;
    this.element_trace = new CSL.Stack("style");
    this.nameset_counter = 0;
    this.group_context = new CSL.Stack([false, false, false], CSL.LITERAL);
    this.term_predecessor = false;
    this.jump = new CSL.Stack(0, CSL.LITERAL);
    this.decorations = new CSL.Stack();
    this.tokenstore_stack = new CSL.Stack();
    this.last_suffix_used = "";
    this.last_names_used = [];
    this.last_years_used = [];
    this.years_used = [];
    this.names_used = [];
    this.taintedItemIDs = {};
    this.taintedCitationIDs = {};
    this.initialize_with = new CSL.Stack();
    this.disambig_request = false;
    this["name-as-sort-order"] = false;
    this.suppress_decorations = false;
    this.disambig_settings = new CSL.AmbigConfig();
    this.bib_sort_keys = [];
    this.prefix = new CSL.Stack("", CSL.LITERAL);
    this.suffix = new CSL.Stack("", CSL.LITERAL);
    this.delimiter = new CSL.Stack("", CSL.LITERAL);
    this.cite_locales = [];
    this.cite_affixes = {
        citation: false, 
        bibliography: false,
        citation_sort: false, 
        bibliography_sort: false
    };
    this.strip_periods = 0;
    this.shadow_numbers = {};
};
CSL.Engine.Fun = function (state) {
    this.match = new CSL.Util.Match;
    this.suffixator = new CSL.Util.Suffixator(CSL.SUFFIX_CHARS);
    this.romanizer = new CSL.Util.Romanizer();
    this.ordinalizer = new CSL.Util.Ordinalizer(state);
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
    this.root = "citation";
    this.extension = "";
    this.substitute_level = new CSL.Stack(0, CSL.LITERAL);
    this.names_level = 0;
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
    this.opt["givenname-disambiguation-rule"] = "by-cite";
    this.opt["near-note-distance"] = 5;
    this.opt.topdecor = [];
    this.opt.layout_decorations = [];
    this.opt.layout_prefix = "";
    this.opt.layout_suffix = "";
    this.opt.layout_delimiter = "";
    this.opt.sort_locales = [];
    this.opt.max_number_of_names = 0;
    this.root = "citation";
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
    this.opt.sort_locales = [];
    this.opt.max_number_of_names = 0;
    this.root = "bibliography";
};
CSL.Engine.BibliographySort = function () {
    this.tokens = [];
    this.opt = {};
    this.opt.sort_directions = [];
    this.keys = [];
    this.opt.topdecor = [];
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
CSL.Engine.prototype.previewCitationCluster = function (citation, citationsPre, citationsPost, newMode) {
    var oldMode = this.opt.mode;
    this.setOutputFormat(newMode);
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
    return this.processCitationCluster(citation, citationsPre, [])[1];
};
CSL.Engine.prototype.processCitationCluster = function (citation, citationsPre, citationsPost, flag) {
    var c, i, ilen, j, jlen, k, klen, n, nlen, key, Item, item, noteCitations, textCitations, m, citationsInNote;
    this.debug = false;
    this.tmp.citation_errors = [];
    var return_data = {"bibchange": false};
    this.setCitationId(citation);
    var oldCitationList;
    var oldItemList;
    var oldAmbigs;
    if (flag === CSL.PREVIEW) {
        oldCitationList = this.registry.citationreg.citationByIndex.slice();
        oldItemList = this.registry.reflist.slice();
        var newCitationList = citationsPre.concat([["" + citation.citationID, citation.properties.noteIndex]]).concat(citationsPost);
        var newItemIds = {};
        var newItemIdsList = [];
        for (i = 0, ilen = newCitationList.length; i < ilen; i += 1) {
            c = this.registry.citationreg.citationById[newCitationList[i][0]];
            for (j = 0, jlen = c.citationItems.length; j < jlen; j += 1) {
                newItemIds[c.citationItems[j].id] = true;
                newItemIdsList.push("" + c.citationItems[j].id);
            }
        }
        oldAmbigs = {};
        for (i = 0, ilen = oldItemList.length; i < ilen; i += 1) {
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
    }
    this.tmp.taintedCitationIDs = {};
    var sortedItems = [];
    var rerunAkeys = {};
    for (i = 0, ilen = citation.citationItems.length; i < ilen; i += 1) {
        item = {};
        for (key in citation.citationItems[i]) {
            item[key] = citation.citationItems[i][key];
        }
        Item = this.retrieveItem("" + item.id);
        if (Item.id) {
            this.transform.loadAbbreviation("default", "hereinafter", Item.id);
        }
        this.remapSectionVariable([[Item,item]]);
        if (this.opt.development_extensions.locator_date_and_revision) {
            if (item.locator) {
                item.locator = "" + item.locator;
                var idx = item.locator.indexOf("|");
                if (idx > -1) {
                    var raw_locator = item.locator;
                    item.locator = raw_locator.slice(0, idx);
                    raw_locator = raw_locator.slice(idx + 1);
                    m = raw_locator.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2}).*/);
                    if (m) {
                        item["locator-date"] = this.fun.dateparser.parse(m[1]);
                        raw_locator = raw_locator.slice(m[1].length);
                    }
                    item["locator-revision"] = raw_locator.replace(/^\s+/, "").replace(/\s+$/, "");
                }
            }
        }
        if (this.opt.development_extensions.locator_label_parse) {
            if (item.locator && ["bill","gazette","legislation","treaty"].indexOf(Item.type) === -1 && (!item.label || item.label === 'page')) {
                m = CSL.LOCATOR_LABELS_REGEXP.exec(item.locator);
                if (m) {
                    item.label = CSL.LOCATOR_LABELS_MAP[m[2]];
                    item.locator = m[3];
                }
            }
        }
        var newitem = [Item, item];
        sortedItems.push(newitem);
        citation.citationItems[i].item = Item;
    }
    citation.sortedItems = sortedItems;
    var citationByIndex = [];
    for (i = 0, ilen = citationsPre.length; i < ilen; i += 1) {
        c = citationsPre[i];
        this.registry.citationreg.citationById[c[0]].properties.noteIndex = c[1];
        citationByIndex.push(this.registry.citationreg.citationById[c[0]]);
    }
    citationByIndex.push(citation);
    for (i = 0, ilen = citationsPost.length; i < ilen; i += 1) {
        c = citationsPost[i];
        this.registry.citationreg.citationById[c[0]].properties.noteIndex = c[1];
        citationByIndex.push(this.registry.citationreg.citationById[c[0]]);
    }
    this.registry.citationreg.citationByIndex = citationByIndex;
    this.registry.citationreg.citationsByItemId = {};
    if (this.opt.update_mode === CSL.POSITION) {
        textCitations = [];
        noteCitations = [];
        citationsInNote = {};
    }
    var update_items = [];
    for (i = 0, ilen = citationByIndex.length; i < ilen; i += 1) {
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
    if (flag !== CSL.ASSUME_ALL_ITEMS_REGISTERED) {
        this.updateItems(update_items);
    }
    if (!this.opt.citation_number_sort && sortedItems && sortedItems.length > 1 && this.citation_sort.tokens.length > 0) {
        for (i = 0, ilen = sortedItems.length; i < ilen; i += 1) {
            sortedItems[i][1].sortkeys = CSL.getSortKeys.call(this, sortedItems[i][0], "citation_sort");
        }
        if (this.opt.grouped_sort &&  !citation.properties.unsorted) {
            for (i = 0, ilen = sortedItems.length; i < ilen; i += 1) {
                var sortkeys = sortedItems[i][1].sortkeys;
                this.tmp.authorstring_request = true;
                var mydisambig = this.registry.registry[sortedItems[i][0].id].disambig;
                this.tmp.authorstring_request = true;
                CSL.getAmbiguousCite.call(this, sortedItems[i][0], mydisambig);
                var authorstring = this.registry.authorstrings[sortedItems[i][0].id];
                this.tmp.authorstring_request = false;
                sortedItems[i][1].sortkeys = [authorstring].concat(sortkeys);
            }
            sortedItems.sort(this.citation.srt.compareCompositeKeys);
            var lastauthor = false;
            var thiskey = false;
            var thisauthor = false;
            for (i = 0, ilen = sortedItems.length; i < ilen; i += 1) {
                if (sortedItems[i][1].sortkeys[0] !== lastauthor) {
                    thisauthor = sortedItems[i][1].sortkeys[0];
                    thiskey =  sortedItems[i][1].sortkeys[1];
                }
                sortedItems[i][1].sortkeys[0] = "" + thiskey + i;
                lastauthor = thisauthor;
            }
        }
        if (!citation.properties.unsorted) {
            sortedItems.sort(this.citation.srt.compareCompositeKeys);
        }
    }
    var citations;
    if (this.opt.update_mode === CSL.POSITION) {
        for (i = 0; i < 2; i += 1) {
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
                    if (!this.registry.registry[onecitation.sortedItems[k][1].id].parallel) {
                        if (!citationsInNote[onecitation.properties.noteIndex]) {
                            citationsInNote[onecitation.properties.noteIndex] = 1;
                        } else {
                            citationsInNote[onecitation.properties.noteIndex] += 1;
                        }
                    }
                }
                for (k = 0, klen = citations[j].sortedItems.length; k < klen; k += 1) {
                    item = citations[j].sortedItems[k];
                    var myid = item[0].id;
                    var mylocator = item[1].locator;
                    var mylabel = item[1].label;
                    if (item[0].legislation_id) {
                        myid = item[0].legislation_id;
                    }
                    var incitationid;
                    if (k > 0) {
                        if (onecitation.sortedItems[k - 1][0].legislation_id) {
                            incitationid = onecitation.sortedItems[k - 1][0].legislation_id;
                        } else {
                            incitationid = onecitation.sortedItems[k - 1][1].id;
                        }
                    }
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
                            var oldCount = this.registry.registry[myid]["citation-count"]
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
                    if ("undefined" === typeof first_ref[myid]) {
                        first_ref[myid] = onecitation.properties.noteIndex;
                        if (this.registry.registry[myid]) {
                            this.registry.registry[myid]['first-reference-note-number'] = onecitation.properties.noteIndex;
                        }
                        last_ref[myid] = onecitation.properties.noteIndex;
                        item[1].position = CSL.POSITION_FIRST;
                    } else {
                        var ibidme = false;
                        var suprame = false;
                        if (j > 0) {
                            oldlastid =  citations[j - 1].sortedItems.slice(-1)[0][1].id;
                            if (citations[j - 1].sortedItems[0].slice(-1)[0].legislation_id) {
                                oldlastid = citations[j - 1].sortedItems[0].slice(-1)[0].legislation_id;
                            }
                        }
                        if (j > 0 && parseInt(k, 10) === 0 && citations[j - 1].properties.noteIndex !== citations[j].properties.noteIndex) {
                            var items = citations[(j - 1)].sortedItems;
                            var useme = false;
                            var oldid = citations[j - 1].sortedItems[0][0].id;
                            if (citations[j - 1].sortedItems[0][0].legislation_id) {
                                oldid = citations[j - 1].sortedItems[0][0].legislation_id;
                            }
                            if ((oldid  == myid && citations[j - 1].properties.noteIndex >= (citations[j].properties.noteIndex - 1)) || citations[j - 1].sortedItems[0][1].id == this.registry.registry[item[1].id].parallel) {
                                if (citationsInNote[citations[j - 1].properties.noteIndex] === 1 || citations[j - 1].properties.noteIndex === 0) {
                                    useme = true;
                                }
                            }
                            for (n = 0, nlen = items.slice(1).length; n < nlen; n += 1) {
                                var itmp = items.slice(1)[n];
                                if (!this.registry.registry[itmp[1].id].parallel || this.registry.registry[itmp[1].id].parallel == this.registry.registry[itmp[1].id]) {
                                    useme = false;
                                }
                            }
                            if (useme) {
                                ibidme = true;
                            } else {
                                suprame = true;
                            }
                        } else if (k > 0 && incitationid == myid) {
                            ibidme = true;
                        } else if (k === 0 && citations[j - 1].properties.noteIndex == citations[j].properties.noteIndex
                                   && citations[j - 1].sortedItems.length 
                                   && oldlastid == myid) {
                            ibidme = true;
                        } else {
                            suprame = true;
                        }
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
                        }
                        if (suprame || ibidme) {
                            if (first_ref[myid] != onecitation.properties.noteIndex) {
                                item[1]["first-reference-note-number"] = first_ref[myid];
                                if (this.registry.registry[myid]) {
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
                                if (param === 'first-reference-note-number') {
                                    rerunAkeys[this.registry.registry[myid].ambig] = true;
                                }
                                this.tmp.taintedCitationIDs[onecitation.citationID] = true;
                                if (param === 'first-reference-note-number') {
                                    this.tmp.taintedItemIDs[myid] = true;
                                }
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
        for (i = 0, ilen = sortedItems.length; i < ilen; i += 1) {
            sortedItems[i][1].sortkeys = CSL.getSortKeys.call(this, sortedItems[i][0], "citation_sort");
        }
        if (!citation.properties.unsorted) {
            sortedItems.sort(this.citation.srt.compareCompositeKeys);
        }
    }
    for (key in this.tmp.taintedItemIDs) {
        if (this.tmp.taintedItemIDs.hasOwnProperty(key)) {
            citations = this.registry.citationreg.citationsByItemId[key];
            if (citations) {
                for (i = 0, ilen = citations.length; i < ilen; i += 1) {
                    this.tmp.taintedCitationIDs[citations[i].citationID] = true;
                }
            }
        }
    }
    var ret = [];
    if (flag === CSL.PREVIEW) {
        try {
            ret = this.process_CitationCluster.call(this, citation.sortedItems, citation.citationID);
        } catch (e) {
            CSL.error("Error running CSL processor for preview: "+e);
        }
        this.registry.citationreg.citationByIndex = oldCitationList;
        this.registry.citationreg.citationById = {};
        for (i = 0, ilen = oldCitationList.length; i < ilen; i += 1) {
            this.registry.citationreg.citationById[oldCitationList[i].citationID] = oldCitationList[i];
        }
        var oldItemIds = [];
        for (i = 0, ilen = oldItemList.length; i < ilen; i += 1) {
            oldItemIds.push("" + oldItemList[i].id);
        }
        this.updateItems(oldItemIds);
        for (key in oldAmbigs) {
            if (oldAmbigs.hasOwnProperty(key)) {
                this.registry.registry[key].disambig = oldAmbigs[key];
            }
        }
    } else {
        for (var rerunAkey in rerunAkeys) {
            this.disambiguate.run(rerunAkey, citation);
        }
        var obj;
        for (key in this.tmp.taintedCitationIDs) {
            if (key == citation.citationID) {
                continue;
            }
            var mycitation = this.registry.citationreg.citationById[key];
            this.tmp.citation_pos = mycitation.properties.index;
            this.tmp.citation_note_index = mycitation.properties.noteIndex;
            this.tmp.citation_id = "" + mycitation.citationID;
            obj = [];
            obj.push(mycitation.properties.index);
            obj.push(this.process_CitationCluster.call(this, mycitation.sortedItems, mycitation.citationID));
            ret.push(obj);
        }
        this.tmp.taintedItemIDs = {};
        this.tmp.taintedCitationIDs = {};
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
CSL.Engine.prototype.process_CitationCluster = function (sortedItems, citationID) {
    var str;
    this.parallel.StartCitation(sortedItems);
    str = CSL.getCitationCluster.call(this, sortedItems, citationID);
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
        if (this.opt.development_extensions.locator_label_parse) {
            if (item.locator && ["bill","gazette","legislation","treaty"].indexOf(Item.type) === -1 && (!item.label || item.label === 'page')) {
                var m = CSL.LOCATOR_LABELS_REGEXP.exec(item.locator);
                if (m) {
                    item.label = CSL.LOCATOR_LABELS_MAP[m[2]];
                    item.locator = m[3];
                }
            }
        }
        newitem = [Item, item];
        inputList.push(newitem);
    }
    this.remapSectionVariable(inputList);
    if (inputList && inputList.length > 1 && this.citation_sort.tokens.length > 0) {
        len = inputList.length;
        for (pos = 0; pos < len; pos += 1) {
            inputList[pos][1].sortkeys = CSL.getSortKeys.call(this, inputList[pos][0], "citation_sort");
        }
        inputList.sort(this.citation.srt.compareCompositeKeys);
    }
    this.tmp.citation_errors = [];
    this.parallel.StartCitation(inputList);
    str = CSL.getCitationCluster.call(this, inputList);
    return str;
};
CSL.getAmbiguousCite = function (Item, disambig, visualForm) {
    var use_parallels, ret;
    var oldTermSiblingLayer = this.tmp.group_context.value().slice();
    if (disambig) {
        this.tmp.disambig_request = disambig;
    } else {
        this.tmp.disambig_request = false;
    }
    var itemSupp = {
        position: 1
    };
    if (this.registry.registry[Item.id] 
        && this.registry.citationreg.citationsByItemId
        && this.registry.citationreg.citationsByItemId[Item.id].length 
        && visualForm) {
        if (this.citation.opt["givenname-disambiguation-rule"] === "by-cite") {
            itemSupp['first-reference-note-number'] = this.registry.registry[Item.id]['first-reference-note-number'];
        }
    }
    this.tmp.area = "citation";
    use_parallels = this.parallel.use_parallels;
    this.parallel.use_parallels = false;
    this.tmp.suppress_decorations = true;
    this.tmp.just_looking = true;
    CSL.getCite.call(this, Item, itemSupp);
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
    ret = this.output.string(this, this.output.queue);
    this.tmp.just_looking = false;
    this.tmp.suppress_decorations = false;
    this.parallel.use_parallels = use_parallels;
    this.tmp.group_context.replace(oldTermSiblingLayer, "literal");
    return ret;
};
CSL.getSpliceDelimiter = function (last_collapsed, pos) {
    if (last_collapsed && ! this.tmp.have_collapsed && "string" === typeof this.citation.opt["after-collapse-delimiter"]) {
        this.tmp.splice_delimiter = this.citation.opt["after-collapse-delimiter"];
    } else if (this.tmp.have_collapsed && this.opt.xclass === "in-text" && this.opt.update_mode !== CSL.NUMERIC) {
        this.tmp.splice_delimiter = ", ";
    } else if (this.tmp.use_cite_group_delimiter) {
        this.tmp.splice_delimiter = this.citation.opt.cite_group_delimiter;
    } else if (this.tmp.cite_locales[pos - 1]) {
        var alt_affixes = this.tmp.cite_affixes[this.tmp.area][this.tmp.cite_locales[pos - 1]];
        if (alt_affixes && alt_affixes.delimiter) {
            this.tmp.splice_delimiter = alt_affixes.delimiter;
        }
    }
    if (!this.tmp.splice_delimiter) {
        this.tmp.splice_delimiter = "";
    }
    return this.tmp.splice_delimiter;
};
CSL.getCitationCluster = function (inputList, citationID) {
    var result, objects, myparams, len, pos, item, last_collapsed, params, empties, composite, compie, myblobs, Item, llen, ppos, obj, preceding_item, txt_esc, error_object;
    this.tmp.last_primary_names_string = false;
    this.tmp.nestedBraces = false;
    txt_esc = CSL.getSafeEscape(this);
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
        for (i=0, ilen=parasets.length; i < ilen; i += 1) {
            lst = parasets[i];
            if (lst.length < 2) {
                continue;
            }
            var locatorInLastPosition = lst.slice(-1)[0].locator;
            if (locatorInLastPosition) {
                for (var j=0, jlen=lst.length - 1; j < jlen; j += 1) {
                    if (lst[j].locator) {
                        locatorInLastPosition = false;
                    }
                }
            }
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
    for (pos = 0; pos < len; pos += 1) {
        Item = inputList[pos][0];
        item = inputList[pos][1];
        last_collapsed = this.tmp.have_collapsed;
        params = {};
        if (pos > 0) {
            CSL.getCite.call(this, Item, item, "" + inputList[(pos - 1)][0].id);
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
            var precedingEndsInPeriod = preceding_item.suffix && preceding_item.suffix.slice(-1) === ".";
            var currentStartsWithPeriod = !preceding_item.suffix && item.prefix && item.prefix.slice(0, 1) === ".";
            if (precedingEndsInPeriod || currentStartsWithPeriod) {
                var spaceidx = params.splice_delimiter.indexOf(" ");
                if (spaceidx > -1 && !currentStartsWithPeriod) {
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
    this.tmp.has_purged_parallel = false;
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
    if (last_locale && this.tmp.cite_affixes[this.tmp.area][last_locale] && this.tmp.cite_affixes[this.tmp.area][last_locale].suffix) {
        suffix = this.tmp.cite_affixes[this.tmp.area][last_locale].suffix;
    }
    if (CSL.TERMINAL_PUNCTUATION.slice(0, -1).indexOf(suffix.slice(0, 1)) > -1) {
        suffix = suffix.slice(0, 1);
    }
    var delimiter = this.citation.opt.layout_delimiter;
    if (!delimiter) {
        delimiter = "";
    }
    if (CSL.TERMINAL_PUNCTUATION.slice(0, -1).indexOf(delimiter.slice(0, 1)) > -1) {
        delimiter = delimiter.slice(0, 1);
    }
    var use_layout_suffix = suffix;
    for (var i=0,ilen=this.output.queue.length;i<ilen;i+=1) {
        CSL.Output.Queue.purgeEmptyBlobs(this.output.queue[i]);
    }
    if (!this.tmp.suppress_decorations) {
        if (!(this.opt.development_extensions.apply_citation_wrapper
              && this.sys.wrapCitationEntry
              && !this.tmp.just_looking
              && this.tmp.area === "citation")) { 
            this.output.queue[this.output.queue.length - 1].strings.suffix = use_layout_suffix;
            this.output.queue[0].strings.prefix = this.citation.opt.layout_prefix;
        }
    }
    if (this.opt.development_extensions.clean_up_csl_flaws) {
        for (var j=0,jlen=this.output.queue.length;j<jlen;j+=1) {
            this.output.adjust.upward(this.output.queue[j]);
            this.output.adjust.leftward(this.output.queue[j]);
            this.output.adjust.downward(this.output.queue[j]);
            this.tmp.last_chr = this.output.adjust.fix(this.output.queue[j]);
        }
    }
    for (pos = 0, len = myblobs.length; pos < len; pos += 1) {
        this.output.queue = [myblobs[pos]];
        this.tmp.suppress_decorations = myparams[pos].suppress_decorations;
        this.tmp.splice_delimiter = myparams[pos].splice_delimiter;
        if (myblobs[pos].parallel_delimiter) {
            this.tmp.splice_delimiter = myblobs[pos].parallel_delimiter;
        }
        this.tmp.have_collapsed = myparams[pos].have_collapsed;
        composite = this.output.string(this, this.output.queue);
        this.tmp.suppress_decorations = false;
        if ("string" === typeof composite) {
            this.tmp.suppress_decorations = false;
            return composite;
        }
        if ("object" === typeof composite && composite.length === 0 && !item["suppress-author"]) {
            if (this.tmp.has_purged_parallel) {
                composite.push("");
            } else {
                var errStr = "[CSL STYLE ERROR: reference with no printed form.]";
                var preStr = pos === 0 ? txt_esc(this.citation.opt.layout_prefix) : "";
                var sufStr = pos === (myblobs.length - 1) ? txt_esc(this.citation.opt.layout_suffix) : "";
                composite.push(preStr + errStr + sufStr);
            }
        }
        if (objects.length && "string" === typeof composite[0]) {
            composite.reverse();
            var tmpstr = composite.pop();
            if (tmpstr && tmpstr.slice(0, 1) === ",") {
                objects.push(tmpstr);
            } else if ("string" == typeof objects.slice(-1)[0] && objects.slice(-1)[0].slice(-1) === ",") {
                objects.push(" " + tmpstr);
            } else if (tmpstr) {
                objects.push(txt_esc(this.tmp.splice_delimiter) + tmpstr);
            }
        } else {
            composite.reverse();
            compie = composite.pop();
            if ("undefined" !== typeof compie) {
                if (objects.length && "string" === typeof objects[objects.length - 1]) {
                    objects[objects.length - 1] += compie.successor_prefix;
                }
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
        this.output.nestedBraces = false;
        if (!this.tmp.suppress_decorations) {
            len = this.citation.opt.layout_decorations.length;
            for (pos = 0; pos < len; pos += 1) {
                params = this.citation.opt.layout_decorations[pos];
                if (params[1] === "normal") {
                    continue;
                }
                result = this.fun.decorate[params[0]][params[1]](this, result);
            }
        }
    }
    this.tmp.suppress_decorations = false;
    return result;
};
CSL.getCite = function (Item, item, prevItemID) {
    var next, error_object;
    this.tmp.cite_renders_content = false;
    this.parallel.StartCite(Item, item, prevItemID);
    CSL.citeStart.call(this, Item, item);
    next = 0;
    this.nameOutput = new CSL.NameOutput(this, Item, item);
    while (next < this[this.tmp.area].tokens.length) {
        next = CSL.tokenExec.call(this, this[this.tmp.area].tokens[next], Item, item);
    }
    CSL.citeEnd.call(this, Item, item);
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
CSL.citeStart = function (Item, item) {
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
    if (this.tmp.area !== 'citation' && this.registry.registry[Item.id]) {
        this.tmp.disambig_restore = CSL.cloneAmbigConfig(this.registry.registry[Item.id].disambig);
        if (this.tmp.area === 'bibliography' && this.tmp.disambig_settings && this.tmp.disambig_override) {
            if (this.opt["disambiguate-add-names"]) {
                this.tmp.disambig_settings.names = this.registry.registry[Item.id].disambig.names.slice();
                this.tmp.disambig_request.names = this.registry.registry[Item.id].disambig.names.slice();
            }
            if (this.opt["disambiguate-add-givenname"]) {
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
    this.tmp.names_used = [];
    this.tmp.nameset_counter = 0;
    this.tmp.years_used = [];
    this.tmp.names_max.clear();
    this.tmp.splice_delimiter = this[this.tmp.area].opt.layout_delimiter;
    this.bibliography_sort.keys = [];
    this.citation_sort.keys = [];
    this.tmp.has_done_year_suffix = false;
    this.tmp.last_cite_locale = false;
    if (!this.tmp.just_looking && item && !item.position && this.registry.registry[Item.id]) {
        this.tmp.disambig_restore = CSL.cloneAmbigConfig(this.registry.registry[Item.id].disambig);
    }
    this.tmp.shadow_numbers = {};
    this.setNumberLabels(Item);
    this.tmp.first_name_string = false;
    if (this.opt.development_extensions.flip_parentheses_to_braces && item && item.prefix) {
        var openBrace = CSL.checkNestedBraceOpen.exec(item.prefix);
        var closeBrace = CSL.checkNestedBraceClose.exec(item.prefix);
        if (openBrace) {
            if (!closeBrace) {
                this.output.nestedBraces = CSL.NestedBraces;
            } else if (closeBrace[0].length < openBrace[0].length) {
                this.output.nestedBraces = CSL.NestedBraces;
            } else {
                this.output.nestedBraces = false;
            }
        } else if (closeBrace) {
            this.output.nestedBraces = false;
        }
    }
};
CSL.citeEnd = function (Item, item) {
    if (this.tmp.disambig_restore) {
        this.registry.registry[Item.id].disambig.names = this.tmp.disambig_restore.names.slice();
        this.registry.registry[Item.id].disambig.givens = this.tmp.disambig_restore.givens.slice();
        for (var i=0,ilen=this.registry.registry[Item.id].disambig.givens.length;i<ilen;i+=1) {
            this.registry.registry[Item.id].disambig.givens[i] = this.tmp.disambig_restore.givens[i].slice();
        }
    }
    this.tmp.disambig_restore = false;
    if (item && item.suffix) {
        this.tmp.last_suffix_used = item.suffix;
    } else {
        this.tmp.last_suffix_used = "";
    }
    this.tmp.last_years_used = this.tmp.years_used.slice();
    this.tmp.last_names_used = this.tmp.names_used.slice();
    this.tmp.cut_var = false;
    this.tmp.disambig_request = false;
    this.tmp.cite_locales.push(this.tmp.last_cite_locale);
    if (this.tmp.issued_date && this.tmp.renders_collection_number) {
        var buf = [];
        for (var i = this.tmp.issued_date.list.length - 1; i > this.tmp.issued_date.pos; i += -1) {
            buf.push(this.tmp.issued_date.list.pop());
        }
        this.tmp.issued_date.list.pop();
        for (i = buf.length - 1; i > -1; i += -1) {
            this.tmp.issued_date.list.push(buf.pop());
        }
        if (this.parallel.use_parallels) {
            this.parallel.cite["issued"] = false;
        }
    }
    this.tmp.issued_date = false;
    this.tmp.renders_collection_number = false;
    if (this.opt.development_extensions.flip_parentheses_to_braces && item && item.suffix) {
        var openBrace = CSL.checkNestedBraceOpen.exec(item.suffix);
        var closeBrace = CSL.checkNestedBraceClose.exec(item.suffix);
        if (closeBrace) {
            if (!openBrace) {
                this.output.nestedBraces = false;
            } else if (openBrace[0].length < closeBrace[0].length) {
                this.output.nestedBraces = false;
            } else {
                this.output.nestedBraces = CSL.NestedBraces;
            }
        } else if (openBrace) {
            this.output.nestedBraces = CSL.NestedBraces;
        }
    }
};
CSL.Engine.prototype.makeBibliography = function (bibsection) {
    var debug, ret, params, maxoffset, item, len, pos, tok, tokk, tokkk, entry_ids, entry_strings, bibliography_errors;
    debug = false;
    if (!this.bibliography.tokens.length) {
        return false;
    }
    if ("string" === typeof bibsection) {
        this.opt.citation_number_slug = bibsection;
        bibsection = false;
    }
    ret = CSL.getBibliographyEntries.call(this, bibsection);
    entry_ids = ret[0];
    entry_strings = ret[1];
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
CSL.getBibliographyEntries = function (bibsection) {
    var ret, input, include, anymatch, allmatch, bib_entry, res, len, pos, item, llen, ppos, spec, lllen, pppos, bib_layout, topblobs, all_item_ids, entry_item_ids, debug, collapse_parallel, i, ilen, siblings, skips, sortedItems, eyetem, chr, entry_item_data, j, jlen, newIDs, originalIDs;
    ret = [];
    entry_item_data = [];
    this.tmp.area = "bibliography";
    this.tmp.last_rendered_name = false;
    this.tmp.bibliography_errors = [];
    this.tmp.bibliography_pos = 0;
    if (bibsection && bibsection.page_start && bibsection.page_length) {
        input = this.registry.getSortedIds();        
    } else {
        input = this.retrieveItems(this.registry.getSortedIds());
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
        if (bibsection && bibsection.page_start && bibsection.page_length) {
            if (skips[input[i]]) {
                continue;
            }
            item = this.retrieveItem(input[i]);
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
                include = false;
                for (j = 0, jlen = bibsection.include.length; j < jlen; j += 1) {
                    spec = bibsection.include[j];
                    if (eval_spec(spec.value, item[spec.field])) {
                        include = true;
                        break;
                    }
                }
            } else if (bibsection.exclude) {
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
        bib_entry = new CSL.Token("group", CSL.START);
        bib_entry.decorations = [["@bibliography", "entry"]].concat(this.bibliography.opt.layout_decorations);
        this.output.startTag("bib_entry", bib_entry);
        if (item.system_id && this.sys.embedBibliographyEntry) {
            this.output.current.value().item_id = item.system_id;
        } else {
            this.output.current.value().system_id = item.id;
        }
        sortedItems = [[{id: "" + item.id}, item]];
        entry_item_ids = [];
        if (this.registry.registry[item.id].master 
            && !(bibsection && bibsection.page_start && bibsection.page_length)) {
            collapse_parallel = true;
            this.parallel.StartCitation(sortedItems);
            this.output.queue[0].strings.delimiter = ", ";
            this.tmp.term_predecessor = false;
            entry_item_ids.push("" + CSL.getCite.call(this, item));
            skips[item.id] = true;
            siblings = this.registry.registry[item.id].siblings;
            for (j = 0, jlen = siblings.length; j < jlen; j += 1) {
                var k = this.registry.registry[item.id].siblings[j];
                eyetem = this.retrieveItem(k);
                entry_item_ids.push("" + CSL.getCite.call(this, eyetem));
                skips[eyetem.id] = true;
            }
            this.parallel.ComposeSet();
            this.parallel.PruneOutputQueue();
        } else if (!this.registry.registry[item.id].siblings) {
            this.parallel.StartCitation(sortedItems);
            this.tmp.term_predecessor = false;
            entry_item_ids.push("" + CSL.getCite.call(this, item));
            if (bibsection && bibsection.page_start && bibsection.page_length) {
                page_item_count += 1;
            }
        }
        entry_item_data.push("");
        this.tmp.bibliography_pos += 1;
        processed_item_ids.push(entry_item_ids);
        this.output.endTag("bib_entry");
        if (this.output.queue[0].blobs.length && this.output.queue[0].blobs[0].blobs.length) {
            if (collapse_parallel || !this.output.queue[0].blobs[0].blobs[0].strings) {
                topblobs = this.output.queue[0].blobs;
                collapse_parallel = false;
            } else {
                topblobs = this.output.queue[0].blobs[0].blobs;
            }
            for (j  = topblobs.length - 1; j > -1; j += -1) {
                if (topblobs[j].blobs && topblobs[j].blobs.length !== 0) {
                    var last_locale = this.tmp.cite_locales[this.tmp.cite_locales.length - 1];
                    var suffix;
                    if (this.tmp.cite_affixes[this.tmp.area][last_locale]) {
                        suffix = this.tmp.cite_affixes[this.tmp.area][last_locale].suffix;
                    } else {
                        suffix = this.bibliography.opt.layout_suffix;
                    }
                    chr = suffix.slice(0, 1);
                    if (chr && topblobs[j].strings.suffix.slice(-1) === chr) {
                        topblobs[j].strings.suffix = topblobs[j].strings.suffix.slice(0, -1);
                    }
                    topblobs[j].strings.suffix += suffix;
                    break;
                }
            }
            topblobs[0].strings.prefix = this.bibliography.opt.layout_prefix + topblobs[0].strings.prefix;
        }
        for (var j=0,jlen=this.output.queue.length;j<jlen;j+=1) {
            CSL.Output.Queue.purgeEmptyBlobs(this.output.queue[j]);
        }
        for (var j=0,jlen=this.output.queue.length;j<jlen;j+=1) {
            this.output.adjust.upward(this.output.queue[j]);
            this.output.adjust.leftward(this.output.queue[j]);
            this.output.adjust.downward(this.output.queue[j]);
            this.output.adjust.fix(this.output.queue[j]);
        }
        res = this.output.string(this, this.output.queue)[0];
        if (!res) {
            res = "\n[CSL STYLE ERROR: reference with no printed form.]\n";
        }
        ret.push(res);
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
    return [processed_item_ids, ret, done];
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
CSL.Engine.prototype.rebuildProcessorState = function (citations, mode, uncitedItemIDs) {
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
}
CSL.Engine.prototype.restoreProcessorState = function (citations) {
    var i, ilen, j, jlen, item, Item, newitem, citationList, itemList, sortedItems;
    citationList = [];
    itemList = [];
    if (!citations) {
        citations = [];
    }
    var indexNumbers = [];
    var citationIds = {};
    for (i = 0, ilen = citations.length; i < ilen; i += 1) {
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
        this.registry.citationreg.citationById[oldCitations[i].citationID] = oldCitations[i];
    }
    this.updateItems(itemList);
    for (i = 0, ilen = citations.length; i < ilen; i += 1) {
        citationList.push(["" + citations[i].citationID, citations[i].properties.noteIndex]);
    }
    var ret = [];
    if (citations && citations.length) {
        ret = this.processCitationCluster(citations[0], [], citationList.slice(1));
    } else {
        this.registry = new CSL.Registry(this);
        this.tmp = new CSL.Engine.Tmp();
        this.disambiguate = new CSL.Disambiguation(this);
    }
    return ret;
};
CSL.Engine.prototype.updateItems = function (idList, nosort, rerun_ambigs) {
    var debug = false;
    var oldArea = this.tmp.area;
    this.registry.init(idList);
	if (rerun_ambigs) {
		for (var ambig in this.registry.ambigcites) {
			this.registry.ambigsTouched[ambig] = true;
		}
	}
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
    this.tmp.area = oldArea;
    return this.registry.getSortedIds();
};
CSL.Engine.prototype.updateUncitedItems = function (idList, nosort) {
    var debug = false;
    if (!idList) {
        idList = [];
    }
    if ("object" == typeof idList) {
        if ("undefined" == typeof idList.length) {
            var idHash = idList;
            idList = [];
            for (var key in idHash) {
                idList.push(key);
            }
        } else if ("number" == typeof idList.length) {
            var idHash = {};
            for (var i=0,ilen=idList.length;i<ilen;i+=1) {
                idHash[idList[i]] = true;
            }
        }
    }
    this.registry.init(idList, true);
    this.registry.dopurge(idHash);
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
CSL.localeResolve = function (langstr, defaultLocale) {
    var ret, langlst;
    if (!defaultLocale) {
        defaultLocale = "en-US";
    }
    if (!langstr) {
        langstr = defaultLocale;
    }
    ret = {};
    langlst = langstr.split(/[\-_]/);
    ret.base = CSL.LANG_BASES[langlst[0]];
    if ("undefined" === typeof ret.base) {
        CSL.debug("Warning: unknown locale "+langstr+", setting fallback to "+defaultLocale);
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
CSL.Engine.prototype.localeConfigure = function (langspec, beShy) {
    var localexml;
    if (this.opt.development_extensions.normalize_lang_keys_to_lowercase) {
        langspec.best = langspec.best.toLowerCase();
        langspec.bare = langspec.bare.toLowerCase();
        langspec.base = langspec.base.toLowerCase();
    }
    if (beShy && this.locale[langspec.best]) {
        return;
    }
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
CSL.Engine.prototype.localeSet = function (myxml, lang_in, lang_out) {
    var blob, locale, nodes, attributes, pos, ppos, term, form, termname, styleopts, attr, date, attrname, len, genderform, target, i, ilen;
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
        this.locale[lang_out].opts["skip-words"] = CSL.SKIP_WORDS;
        if (!this.locale[lang_out].opts["leading-noise-words"]) {
            this.locale[lang_out].opts["leading-noise-words"] = [];
        }
        this.locale[lang_out].dates = {};
        this.locale[lang_out].ord = {'1.0.1':false,keys:{}};
        this.locale[lang_out]["noun-genders"] = {};
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
    nodes = this.sys.xml.getNodesByName(locale, 'type');
    for (i = 0, ilen = this.sys.xml.numberofnodes(nodes); i < ilen; i += 1) {
        var typenode = nodes[i];
        var type = this.sys.xml.getAttributeValue(typenode, 'name');
        var gender = this.sys.xml.getAttributeValue(typenode, 'gender');
        this.opt.gender[type] = gender;
    }
    var hasCslOrdinals101 = this.sys.xml.getNodesByName(locale, 'term', 'ordinal').length;
    if (hasCslOrdinals101) {
        for (var key in this.locale[lang_out].ord.keys) {
            delete this.locale[lang_out].terms[key];
        }
        this.locale[lang_out].ord = {"1.0.1":false,keys:{}};
    }
    nodes = this.sys.xml.getNodesByName(locale, 'term');
    var ordinals101 = {"last-digit":{},"last-two-digits":{},"whole-number":{}};
    var ordinals101_toggle = false;
    var genderized_terms = {};
    for (pos = 0, len = this.sys.xml.numberofnodes(nodes); pos < len; pos += 1) {
        term = nodes[pos];
        termname = this.sys.xml.getAttributeValue(term, 'name');
        if (termname === "sub verbo") {
            termname = "sub-verbo";
        }
        if (termname.slice(0,7) === "ordinal") {
            var termstring = this.sys.xml.getNodeValue(term);
            if (termname === "ordinal") {
                ordinals101_toggle = true;
            } else {
                var match = this.sys.xml.getAttributeValue(term, 'match');
                var termstub = termname.slice(8);
                var genderform = this.sys.xml.getAttributeValue(term, 'gender-form');
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
        if (this.sys.xml.getAttributeValue(term, 'form')) {
            form = this.sys.xml.getAttributeValue(term, 'form');
        }
        if (this.sys.xml.getAttributeValue(term, 'gender-form')) {
            genderform = this.sys.xml.getAttributeValue(term, 'gender-form');
        }
        if (this.sys.xml.getAttributeValue(term, 'gender')) {
            this.locale[lang_out]["noun-genders"][termname] = this.sys.xml.getAttributeValue(term, 'gender');
        }
        if (genderform) {
            this.locale[lang_out].terms[termname][genderform] = {};
            this.locale[lang_out].terms[termname][genderform][form] = [];
            target = this.locale[lang_out].terms[termname][genderform];
            genderized_terms[termname] = true;
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
                    for (var jkey in gender_segments.feminine) {
                        this.locale[lang_out].terms[ikey][jkey] = gender_segments.feminine[jkey];
                    }
                } else if (gender_segments.masculine) {
                    for (var jkey in gender_segments.masculine) {
                        this.locale[lang_out].terms[ikey][jkey] = gender_segments.masculine[jkey];
                    }
                }
            }
        }
        this.locale[lang_out].ord['1.0.1'] = ordinals101;
    }
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
    nodes = this.sys.xml.getNodesByName(locale, 'style-options');
    for (pos = 0, len = this.sys.xml.numberofnodes(nodes); pos < len; pos += 1) {
        if (true) {
            styleopts = nodes[pos];
            attributes = this.sys.xml.attributes(styleopts);
            for (attrname in attributes) {
                if (attributes.hasOwnProperty(attrname)) {
                    if (attrname === "@punctuation-in-quote" || attrname === "@limit-day-ordinals-to-day-1") {
                        if (attributes[attrname] === "true") {
                            this.locale[lang_out].opts[attrname.slice(1)] = true;
                        } else {
                            this.locale[lang_out].opts[attrname.slice(1)] = false;
                        }
                    } else if (attrname === "@skip-words") {
                        var skip_words = attributes[attrname].split(/\s*,\s*/);
                        this.locale[lang_out].opts[attrname.slice(1)] = skip_words;
                    } else if (attrname === "@leading-noise-words" && lang_in === lang_out) {
                        var val = attributes[attrname].split(/\s*,\s*/);
                        this.locale[lang_out].opts["leading-noise-words"] = val;
                    } else if (attrname === "@name-as-sort-order") {
                        this.locale[lang_out].opts["name-as-sort-order"] = {};
                        var lst = attributes[attrname].split(/\s+/);
                        for (var i=0,ilen=lst.length;i<ilen;i+=1) {
                            this.locale[lang_out].opts["name-as-sort-order"][lst[i]] = true;
                        }
                    } else if (attrname === "@name-as-reverse-order") {
                        this.locale[lang_out].opts["name-as-reverse-order"] = {};
                        var lst = attributes[attrname].split(/\s+/);
                        for (var i=0,ilen=lst.length;i<ilen;i+=1) {
                            this.locale[lang_out].opts["name-as-reverse-order"][lst[i]] = true;
                        }
                    } else if (attrname === "@name-never-short") {
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
    nodes = this.sys.xml.getNodesByName(locale, 'date');
    for (pos = 0, len = this.sys.xml.numberofnodes(nodes); pos < len; pos += 1) {
        if (true) {
            date = nodes[pos];
            this.locale[lang_out].dates[this.sys.xml.getAttributeValue(date, "form")] = date;
        }
    }
};
CSL.Node = {};
CSL.Node.bibliography = {
    build: function (state, target) {
        if (this.tokentype === CSL.START) {
            state.build.area = "bibliography";
            state.build.root = "bibliography";
            state.fixOpt(this, "names-delimiter", "delimiter");
            state.fixOpt(this, "name-delimiter", "delimiter");
            state.fixOpt(this, "name-form", "form");
            state.fixOpt(this, "and", "and");
            state.fixOpt(this, "delimiter-precedes-last", "delimiter-precedes-last");
            state.fixOpt(this, "delimiter-precedes-et-al", "delimiter-precedes-et-al");
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
            state.fixOpt(this, "initialize", "initialize");
            state.fixOpt(this, "name-as-sort-order", "name-as-sort-order");
            state.fixOpt(this, "sort-separator", "sort-separator");
            state.fixOpt(this, "and", "and");
            state.fixOpt(this, "et-al-min", "et-al-min");
            state.fixOpt(this, "et-al-use-first", "et-al-use-first");
            state.fixOpt(this, "et-al-use-last", "et-al-use-last");
            state.fixOpt(this, "et-al-subsequent-min", "et-al-subsequent-min");
            state.fixOpt(this, "et-al-subsequent-use-first", "et-al-subsequent-use-first");
            state.build.area = "citation";
        }
        if (this.tokentype === CSL.END) {
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
                state.citation_sort.opt.sort_directions = [firstkey].concat(state.citation_sort.opt.sort_directions);
            }
            state.citation.srt = new CSL.Registry.Comparifier(state, "citation_sort");
        }
    }
};
CSL.Node["#comment"] = {
       build: function (state, target) {
       }
};
CSL.Node.date = {
    build: function (state, target) {
        var func, date_obj, tok, len, pos, part, dpx, parts, mypos, start, end;
        if (this.tokentype === CSL.START || this.tokentype === CSL.SINGLETON) {
            state.build.date_parts = [];
            state.build.date_variables = this.variables;
            if (!state.build.extension) {
                CSL.Util.substituteStart.call(this, state, target);
            }
            if (state.build.extension) {
                func = CSL.dateMacroAsSortKey;
            } else {
                func = function (state, Item, item) {
                    var key, dp;
                    state.tmp.element_rendered_ok = false;
                    state.tmp.donesies = [];
                    state.tmp.dateparts = [];
                    dp = [];
                    if (this.variables.length
                        && !(state.tmp.just_looking
                             && this.variables[0] !== "issued")) {
                        state.parallel.StartVariable(this.variables[0]);
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
            }
            this.execs.push(func);
            func = function (state, Item) {
                state.output.startTag("date", this);
                if (this.variables[0] === "issued"
                    && Item.type === "legal_case"
                    && !state.tmp.extension
                    && "" + Item["collection-number"] === "" + state.tmp.date_object.year
                    && this.dateparts.length === 1
                    && this.dateparts[0] === "year") {
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
            func = function (state, Item) {
                state.output.endTag();
                state.parallel.CloseVariable("date");
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
CSL.Node["date-part"] = {
    build: function (state, target) {
        var func, pos, len, decor, first_date, value, value_end, real, have_collapsed, invoked, precondition, known_year, bc, ad, bc_end, ad_end, ready, curr, dcurr, number, num, formatter, item, i, ilen;
        if (!this.strings.form) {
            this.strings.form = "long";
        }
        state.build.date_parts.push(this.strings.name);
        var date_variable = state.build.date_variables[0];
        func = function (state, Item) {
            if (!state.tmp.date_object) {
                return;
            }
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
                    value = CSL.Util.Dates[this.strings.name][myform](state, value, gender, ("accessed" === date_variable));
                    if ("month" === this.strings.name) {
                        if (state.tmp.strip_periods) {
                            value = value.replace(/\./g, "");
                        } else {
                            for (i = 0, ilen = this.decorations.length; i < ilen; i += 1) {
                                if ("@strip-periods" === this.decorations[i][0] && "true" === this.decorations[i][1]) {
                                    value = value.replace(/\./g, "");
                                    break;
                                }
                            }
                        }
                    }
                    if (value_end) {
                        value_end = CSL.Util.Dates[this.strings.name][myform](state, value_end, gender, ("accessed" === date_variable), "_end");
                        if (state.tmp.strip_periods) {
                            value_end = value_end.replace(/\./g, "");
                        } else {
                            for (i = 0, ilen = this.decorations.length; i < ilen; i += 1) {
                                if ("@strip-periods" === this.decorations[i][0] && "true" === this.decorations[i][1]) {
                                    value_end = value_end.replace(/\./g, "");
                                    break;
                                }
                            }
                        }
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
                            if (state.opt["year-range-format"]
                                && state.opt["year-range-format"] !== "expanded"
                                && !state.tmp.date_object.day
                                && !state.tmp.date_object.month
                                && !state.tmp.date_object.season
                                && this.strings.name === "year"
                                && value && value_end) {
                                value_end = state.fun.year_mangler(value + "-" + value_end, true);
                                var range_delimiter = state.getTerm("year-range-delimiter");
                                value_end = value_end.slice(value_end.indexOf(range_delimiter) + 1);
                            }
                            state.dateput.append(value_end, this);
                            if (first_date) {
                                state.dateput.current.value()[0].strings.prefix = "";
                            }
                        }
                        state.output.append(value, this);
                        curr = state.output.current.value();
                        curr.blobs[(curr.blobs.length - 1)].strings.suffix = "";
                        state.output.append(state.getTerm("year-range-delimiter"), "empty");
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
                        state.tmp.group_context.replace([false, false, true]);
                        state.output.append(state.getTerm(("season-0" + value)), this);
                    } else if (value) {
                        state.output.append(value, this);
                    }
                }
            }
            state.tmp.value = [];
            if ((value || state.tmp.have_collapsed) && !state.opt.has_year_suffix && "year" === this.strings.name && !state.tmp.just_looking) {
                if (state.registry.registry[Item.id] && state.registry.registry[Item.id].disambig.year_suffix !== false && !state.tmp.has_done_year_suffix) {
                    state.tmp.has_done_year_suffix = true;
                    num = parseInt(state.registry.registry[Item.id].disambig.year_suffix, 10);
                    number = new CSL.NumericBlob(num, this, Item.id);
                    this.successor_prefix = state[state.build.area].opt.layout_delimiter;
                    this.splice_prefix = state[state.build.area].opt.layout_delimiter;
                    formatter = new CSL.Util.Suffixator(CSL.SUFFIX_CHARS);
                    number.setFormatter(formatter);
                    if (state[state.tmp.area].opt.collapse === "year-suffix-ranged") {
                        number.range_prefix = state.getTerm("citation-range-delimiter");
                    }
                    if (state[state.tmp.area].opt["year-suffix-delimiter"]) {
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
CSL.Node["else-if"] = {
    build: function (state, target) {
        CSL.Conditions.TopNode.call(this, state, target);
        target.push(this);
    },
    configure: function (state, pos) {
        CSL.Conditions.Configure.call(this, state, pos);
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
CSL.Node["et-al"] = {
    build: function (state, target) {
        if (state.build.area === "citation" || state.build.area === "bibliography") {
            var func = function (state, Item, item) {
                state.tmp.etal_node = this;
                if ("string" === typeof this.strings.term) {
                    state.tmp.etal_term = this.strings.term;
                }
            }
            this.execs.push(func);
        }
        target.push(this);
    }
};
CSL.Node.group = {
    build: function (state, target) {
        var func, execs;
        if (this.tokentype === CSL.START) {
            CSL.Util.substituteStart.call(this, state, target);
            if (state.build.substitute_level.value()) {
                state.build.substitute_level.replace((state.build.substitute_level.value() + 1));
            }
            func = function (state, Item) {
                state.output.startTag("group", this);
                if (state.tmp.group_context.mystack.length) {
                    state.output.current.value().parent = state.tmp.group_context.value()[4];
                }
                var label_form = state.tmp.group_context.value()[5];
                if (!label_form && this.strings.label_form_override) {
                    label_form = this.strings.label_form_override;
                }
                state.tmp.group_context.push([false, false, false, false, state.output.current.value(), label_form, this.strings.set_parallel_condition], CSL.LITERAL);
                if (this.strings.oops) {
                    state.tmp.group_context.value()[3] = this.strings.oops;
                }
            };
            execs = [];
            execs.push(func);
            this.execs = execs.concat(this.execs);
            if (this.strings["has-publisher-and-publisher-place"]) {
                state.build["publisher-special"] = true;
                func = function (state, Item) {
                    if (this.strings["subgroup-delimiter"]
                        && Item.publisher && Item["publisher-place"]) {
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
        } else {
            if (state.build["publisher-special"]) {
                state.build["publisher-special"] = false;
                if ("string" === typeof state[state.build.root].opt["name-delimiter"]) {
                    func = function (state, Item) {
                        if (state.publisherOutput) {
                            state.publisherOutput.render();
                            state.publisherOutput = false;
                        }
                    };
                    this.execs.push(func);
                }
            }
            func = function (state, Item) {
                var flag = state.tmp.group_context.pop();
                state.output.endTag();
                var upperflag = state.tmp.group_context.value();
                if (flag[1]) {
                    state.tmp.group_context.value()[1] = true;
                }
                if (flag[2] || (flag[0] && !flag[1])) {
                    state.tmp.group_context.value()[2] = true;
                    var blobs = state.output.current.value().blobs;
                    var pos = state.output.current.value().blobs.length - 1;
                    if (!state.tmp.just_looking && "undefined" !== typeof flag[6]) {
                        var parallel_condition_object = {
                            blobs: blobs,
                            conditions: flag[6],
                            id: Item.id,
                            pos: pos
                        };
                        state.parallel.parallel_conditional_blobs_list.push(parallel_condition_object);
                    }
                } else {
                    if (state.output.current.value().blobs) {
                        state.output.current.value().blobs.pop();
                    }
                    if (state.tmp.group_context.value()[3]) {
                        state.output.current.mystack[state.output.current.mystack.length - 2].strings.delimiter = state.tmp.group_context.value()[3];
                    }
                }
            };
            this.execs.push(func);
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
        CSL.Conditions.TopNode.call(this, state, target);
        target.push(this);
    },
    configure: function (state, pos) {
        CSL.Conditions.Configure.call(this, state, pos);
    }
};
CSL.Node["conditions"] = {
    build: function (state, target) {
        if (this.tokentype === CSL.START) {
            state.tmp.conditions.addMatch(this.match);
        }
        if (this.tokentype === CSL.END) {
            state.tmp.conditions.matchCombine();
        }
    }
};
CSL.Node["condition"] = {
    build: function (state, target) {
        if (this.tokentype === CSL.SINGLETON) {
            var test = state.fun.match[this.match](this, state, this.tests);
            state.tmp.conditions.addTest(test);
        }
    }
};
CSL.Conditions = {};
CSL.Conditions.TopNode = function (state, target) {
    var func;
    if (this.tokentype === CSL.START || this.tokentype === CSL.SINGLETON) {
        if (this.locale) {
            state.opt.lang = this.locale;
        }
        if (!this.tests || !this.tests.length) {
            state.tmp.conditions = new CSL.Conditions.Engine(state, this);
        } else {
            this.test = state.fun.match[this.match](this, state, this.tests);
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
};
CSL.Conditions.Configure = function (state, pos) {
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
};
CSL.Conditions.Engine = function (state, token) {
    this.token = token;
    this.state = state;
};
CSL.Conditions.Engine.prototype.addTest = function (test) {
    this.token.tests.push(test);
};
CSL.Conditions.Engine.prototype.addMatch = function (match) {
    this.token.match = match;
};
CSL.Conditions.Engine.prototype.matchCombine = function () {
    this.token.test = this.state.fun.match[this.token.match](this.token, this.state, this.token.tests);
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
                if ("string" === typeof state.build.name_delimiter && !this.strings.delimiter) {
                    this.strings.delimiter = state.tmp.name_delimiter;
                }
                var myand, and_default_prefix, and_suffix;
                if ("text" === this.strings.and) {
                    this.and_term = state.getTerm("and", "long", 0);
                } else if ("symbol" === this.strings.and) {
                    if (state.opt.development_extensions.expect_and_symbol_form) {
                        this.and_term = state.getTerm("and", "symbol", 0);
                    } else {
                        this.and_term = "&";
                    }
                } else if ("none" === this.strings.and) {
                    this.and_term = this.strings.delimiter;
                }
                if ("undefined" === typeof this.and_term && state.tmp.and_term) {
                    this.and_term = state.getTerm("and", "long", 0);
                }
                if (CSL.STARTSWITH_ROMANESQUE_REGEXP.test(this.and_term)) {
                    this.and_prefix_single = " ";
                    this.and_prefix_multiple = ", ";
                    if ("string" === typeof this.strings.delimiter) {
                        this.and_prefix_multiple = this.strings.delimiter;
                    }
                    this.and_suffix = " ";
                } else {
                    this.and_prefix_single = "";
                    this.and_prefix_multiple = "";
                    this.and_suffix = "";
                }
                if (this.strings["delimiter-precedes-last"] === "always") {
                    this.and_prefix_single = this.strings.delimiter;
                } else if (this.strings["delimiter-precedes-last"] === "never") {
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
                    this.and.single = new CSL.Blob(this.strings.delimiter);
                    this.and.single.strings.prefix = "";
                    this.and.single.strings.suffix = "";
                    this.and.multiple = new CSL.Blob(this.strings.delimiter);
                    this.and.multiple.strings.prefix = "";
                    this.and.multiple.strings.suffix = "";
                }
                state.nameOutput.institution = this;
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
                    state.nameOutput.institutionpart["long-with-short"] = this;
                };
            } else {
                func = function (state, Item) {
                    state.nameOutput.institutionpart["long"] = this;
                };
            }
        } else if ("short" === this.strings.name) {
            func = function (state, Item) {
                state.nameOutput.institutionpart["short"] = this;
            };
        }
        this.execs.push(func);
        target.push(this);
    }
};
CSL.Node.key = {
    build: function (state, target) {
        var func, i, ilen;
        var debug = false;
        var start_key = new CSL.Token("key", CSL.START);
        start_key.strings["et-al-min"] = this.strings["et-al-min"];
        start_key.strings["et-al-use-first"] = this.strings["et-al-use-first"];
        start_key.strings["et-al-use-last"] = this.strings["et-al-use-last"];
        func = function (state, Item) {
            state.tmp.done_vars = [];
        };
        start_key.execs.push(func);
        state.opt.citation_number_sort_direction = this.strings.sort_direction;
        func = function (state, Item) {
            state.output.openLevel("empty");
        };
        start_key.execs.push(func);
        var sort_direction = [];
        if (this.strings.sort_direction === CSL.DESCENDING) {
            sort_direction.push(1);
            sort_direction.push(-1);
        } else {
            sort_direction.push(-1);
            sort_direction.push(1);
        }
        state[state.build.area].opt.sort_directions.push(sort_direction);
        if (CSL.DATE_VARIABLES.indexOf(this.variables[0]) > -1) {
            state.build.date_key = true;
        }
        func = function (state, Item) {
            state.tmp.sort_key_flag = true;
            if (this.strings["et-al-min"]) {
                state.tmp["et-al-min"] = this.strings["et-al-min"];
            }
            if (this.strings["et-al-use-first"]) {
                state.tmp["et-al-use-first"] = this.strings["et-al-use-first"];
            }
            if ("boolean" === typeof this.strings["et-al-use-last"]) {
                state.tmp["et-al-use-last"] = this.strings["et-al-use-last"];
            }
        };
        start_key.execs.push(func);
        target.push(start_key);
        if (this.variables.length) {
            var variable = this.variables[0];
            if (variable === "citation-number") {
                if (state.build.area === "citation_sort") {
                    state.opt.citation_number_sort = true;
                }
                if (state.build.area === "bibliography_sort") {
                    state.opt.citation_number_sort_used = true;
                }
            }
            if (CSL.CREATORS.indexOf(variable) > -1) {
                var names_start_token = new CSL.Token("names", CSL.START);
                names_start_token.tokentype = CSL.START;
                names_start_token.variables = this.variables;
                CSL.Node.names.build.call(names_start_token, state, target);
                var name_token = new CSL.Token("name", CSL.SINGLETON);
                name_token.tokentype = CSL.SINGLETON;
                name_token.strings["name-as-sort-order"] = "all";
                name_token.strings["sort-separator"] = " ";
                name_token.strings["et-al-use-last"] = this.strings["et-al-use-last"];
                name_token.strings["et-al-min"] = this.strings["et-al-min"];
                name_token.strings["et-al-use-first"] = this.strings["et-al-use-first"];
                CSL.Node.name.build.call(name_token, state, target);
                var institution_token = new CSL.Token("institution", CSL.SINGLETON);
                institution_token.tokentype = CSL.SINGLETON;
                CSL.Node.institution.build.call(institution_token, state, target);
                var names_end_token = new CSL.Token("names", CSL.END);
                names_end_token.tokentype = CSL.END;
                CSL.Node.names.build.call(names_end_token, state, target);
            } else {
                var single_text = new CSL.Token("text", CSL.SINGLETON);
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
            var token = new CSL.Token("text", CSL.SINGLETON);
            token.postponed_macro = this.postponed_macro;
            CSL.expandMacro.call(state, token);
        }
        var end_key = new CSL.Token("key", CSL.END);
        func = function (state, Item) {
            var keystring = state.output.string(state, state.output.queue);
            if (state.sys.normalizeUnicode) {
                keystring = state.sys.normalizeUnicode(keystring);
            }
            if ("" === keystring) {
                keystring = undefined;
            }
            if ("string" !== typeof keystring || state.tmp.empty_date) {
                keystring = undefined;
                state.tmp.empty_date = false;
            }
            state[state.tmp.area].keys.push(keystring);
            state.tmp.value = [];
        };
        end_key.execs.push(func);
        if (state.build.date_key) {
            if (state.build.area === "citation_sort") {
                state[state.build.area].opt.sort_directions.push([-1,1]);
                func = function (state, Item) {
                    var year_suffix = state.registry.registry[Item.id].disambig.year_suffix;
                    if (!year_suffix) {
                        year_suffix = 0;
                    }
                    var key = CSL.Util.padding("" + year_suffix);
                    state[state.tmp.area].keys.push(key);
                }
                end_key.execs.push(func);
            }
            state.build.date_key = false;
        }
        func = function (state, Item) {
            state.tmp["et-al-min"] = undefined;
            state.tmp["et-al-use-first"] = undefined;
            state.tmp["et-al-use-last"] = undefined;
            state.tmp.sort_key_flag = false;
        };
        end_key.execs.push(func);
        target.push(end_key);
    }
};
CSL.Node.label = {
    build: function (state, target) {
        var debug = false;
        if (this.strings.term) {
            var plural = false;
            if (!this.strings.form) {
                this.strings.form = "long";
            }
            var func = function (state, Item, item) {
                var termtxt = CSL.evaluateLabel(this, state, Item, item);
                if (item && this.strings.term === "locator") {
                    state.parallel.StartVariable("label");
                    state.parallel.AppendToVariable(item.label);
                    item.section_form_override = this.strings.form;
                }
                state.output.append(termtxt, this);
                if (item && this.strings.term === "locator") {
                    state.parallel.CloseVariable();
                }
            };
            this.execs.push(func);
        } else {
            var namevars = state.build.names_variables.slice(-1)[0];
            if (!state.build.name_label) {
                state.build.name_label = {};
            }
            for (var i = 0, ilen = namevars.length; i < ilen; i += 1) {
                if (!state.build.name_label[namevars[i]]) {
                    state.build.name_label[namevars[i]] = {};
                }
            }
            if (!state.build.name_flag) {
                for (var i = 0, ilen = namevars.length; i < ilen; i += 1) {
                    state.build.name_label[namevars[i]].before = this;
                }
            } else {
                for (var i = 0, ilen = namevars.length; i < ilen; i += 1) {
                    state.build.name_label[namevars[i]].after = this;
                }
            }
        }
        target.push(this);
    }
};
CSL.Node.layout = {
    build: function (state, target) {
        var func, prefix_token, suffix_token, tok;
        if (this.tokentype === CSL.START) {
            func = function (state, Item, item) {
                if (state.opt.development_extensions.apply_citation_wrapper
                    && state.sys.wrapCitationEntry
                    && !state.tmp.just_looking
                    && Item.system_id 
                    && state.tmp.area === "citation") { 
                    cite_entry = new CSL.Token("group", CSL.START);
                    cite_entry.decorations = [["@cite", "entry"]];
                    state.output.startTag("cite_entry", cite_entry);
                    state.output.current.value().item_id = Item.system_id;
                    if (item) {
                        state.output.current.value().locator_txt = item.locator_txt;
                        state.output.current.value().suffix_txt = item.suffix_txt;
                    }
                }
            }
            this.execs.push(func);
        }
        if (this.tokentype === CSL.START && !state.tmp.cite_affixes[state.build.area]) {
            func = function (state, Item) {
                state.tmp.done_vars = [];
                if (!state.tmp.just_looking && state.registry.registry[Item.id].parallel) {
                    state.tmp.done_vars.push("first-reference-note-number");
                }
                state.tmp.rendered_name = false;
                state.tmp.name_node = {};
            };
            this.execs.push(func);
            func = function (state, Item) {
                state.tmp.sort_key_flag = false;
            };
            this.execs.push(func);
            func = function (state, Item) {
                state.tmp.nameset_counter = 0;
            };
            this.execs.push(func);
            func = function (state, Item) {
                var tok = "empty";
                if (state.opt.development_extensions.rtl_support) {
                    if (["ar", "he", "fa", "ur", "yi", "ps", "syr"].indexOf(Item.language) > -1) {
                        tok = new CSL.Token();
                        tok.strings.prefix = "\u202b";
                        tok.strings.suffix = "\u202c";
                    }
                }
                state.output.openLevel(tok);
            }
            this.execs.push(func);
            target.push(this);
            if (state.opt.development_extensions.rtl_support && false) {
                this.strings.prefix = this.strings.prefix.replace(/\((.|$)/g,"(\u200e$1");
                this.strings.suffix = this.strings.suffix.replace(/\)(.|$)/g,")\u200e$1");
            }
            if (state.build.area === "citation") {
                prefix_token = new CSL.Token("text", CSL.SINGLETON);
                func = function (state, Item, item) {
                    var sp;
                    if (item && item.prefix) {
                        sp = "";
                        var prefix = item.prefix.replace(/<[^>]+>/g, "").replace(/["'\u201d\u2019]/g,"").replace(/\s+$/, "").replace(/^[.\s]+/, "");
                        if (prefix.match(CSL.ENDSWITH_ROMANESQUE_REGEXP)) {
                            sp = " ";
                        }
                        var ignorePredecessor = false;
                        if (CSL.TERMINAL_PUNCTUATION.slice(0,-1).indexOf(prefix.slice(-1)) > -1
                            && prefix.slice(0, 1) != prefix.slice(0, 1).toLowerCase()) {
                            state.tmp.term_predecessor = false;
                            ignorePredecessor = true;
                        }
                        prefix = (item.prefix + sp).replace(/\s+/g, " ");
                        state.output.append(prefix, this, false, ignorePredecessor);
                    }
                };
                prefix_token.execs.push(func);
                target.push(prefix_token);
            }
        }
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
            if (!this.locale_raw) {
                state[state.tmp.area].opt.topdecor = [this.decorations];
                state[(state.tmp.area + "_sort")].opt.topdecor = [this.decorations];
                state[state.build.area].opt.layout_prefix = this.strings.prefix;
                state[state.build.area].opt.layout_suffix = this.strings.suffix;
                state[state.build.area].opt.layout_delimiter = this.strings.delimiter;
                state[state.build.area].opt.layout_decorations = this.decorations;
                if (state.tmp.cite_affixes[state.build.area]) {
                    tok = new CSL.Token("else", CSL.START);
                    CSL.Node["else"].build.call(tok, state, target);
                }
            } // !this.locale_raw
            if (this.locale_raw) {
                if (!state.build.layout_locale_flag) {
                    var choose_tok = new CSL.Token("choose", CSL.START);
                    CSL.Node.choose.build.call(choose_tok, state, target);
                    my_tok.name = "if";
                    CSL.Attributes["@locale-internal"].call(my_tok, state, this.locale_raw);
                    CSL.Node["if"].build.call(my_tok, state, target);
                } else {
                    my_tok.name = "else-if";
                    CSL.Attributes["@locale-internal"].call(my_tok, state, this.locale_raw);
                    CSL.Node["else-if"].build.call(my_tok, state, target);
                }
                state.tmp.cite_affixes[state.build.area][my_tok.locale] = {};
                state.tmp.cite_affixes[state.build.area][my_tok.locale].delimiter = this.strings.delimiter;
                state.tmp.cite_affixes[state.build.area][my_tok.locale].suffix = this.strings.suffix;
            }
        }
        if (this.tokentype === CSL.END) {
            if (this.locale_raw) {
                if (!state.build.layout_locale_flag) {
                    my_tok.name = "if";
                    my_tok.tokentype = CSL.END;
                    CSL.Attributes["@locale-internal"].call(my_tok, state, this.locale_raw);
                    CSL.Node["if"].build.call(my_tok, state, target);
                    state.build.layout_locale_flag = true;
                } else {
                    my_tok.name = "else-if";
                    my_tok.tokentype = CSL.END;
                    CSL.Attributes["@locale-internal"].call(my_tok, state, this.locale_raw);
                    CSL.Node["else-if"].build.call(my_tok, state, target);
                }
            }
            if (!this.locale_raw) {
                if (state.tmp.cite_affixes[state.build.area]) {
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
                            sp = "";
                            if (item.suffix.match(CSL.STARTSWITH_ROMANESQUE_REGEXP)
                                || ['[','('].indexOf(item.suffix.slice(0,1)) > -1) {
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
                func = function (state, Item) {
                    if (state.opt.development_extensions.apply_citation_wrapper
                        && state.sys.wrapCitationEntry
                        && !state.tmp.just_looking
                        && Item.system_id 
                        && state.tmp.area === "citation") { 
                        state.output.endTag(); // closes citation link wrapper
                    }
                }
                this.execs.push(func);
                target.push(this);
                state.build.layout_flag = false;
                state.build.layout_locale_flag = false;
            } // !this.layout_raw
        }
    }
};
CSL.Node.macro = {
    build: function (state, target) {}
};
CSL.NameOutput = function(state, Item, item, variables) {
    this.debug = false;
    this.state = state;
    this.Item = Item;
    this.item = item;
    this.nameset_base = 0;
    this.etal_spec = {};
    this._first_creator_variable = false;
    this._please_chop = false;
};
CSL.NameOutput.prototype.init = function (names) {
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
    this["with"] = undefined;
    this.name = undefined;
    this.institutionpart = {};
    this.state.tmp.group_context.value()[1] = true;
    if (!this.state.tmp.value.length) {
        return;
    }
};
CSL.NameOutput.prototype.reinit = function (names) {
    if (this.state.tmp.can_substitute.value()) {
        this.nameset_offset = 0;
        this.variables = names.variables;
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
        for (i = 0, ilen = this.given.execs.length; i < ilen; i += 1) {
            this.given.execs[i].call(this.given_decor, this.state, this.Item);
        }
    } else {
        this.given_decor = false;
    }
    this.getEtAlConfig();
    this.divideAndTransliterateNames();
    this.truncatePersonalNameLists();
    this.disambigNames();
    this.constrainNames();
    if (this.name.strings.form === "count") {
        if (this.state.tmp.extension || this.names_count != 0) {
            this.state.output.append(this.names_count, "empty");
            this.state.tmp.group_context.value()[2] = true;
        }
        return;
    }
    this.setEtAlParameters();
    this.setCommonTerm();
    this.state.tmp.name_node = {};
    this.state.tmp.name_node.children = [];
    this.renderAllNames();
    var blob_list = [];
    for (i = 0, ilen = variables.length; i < ilen; i += 1) {
        var v = variables[i];
        var institution_sets = [];
        var institutions = false;
        for (var j = 0, jlen = this.institutions[v].length; j < jlen; j += 1) {
            institution_sets.push(this.joinPersonsAndInstitutions([this.persons[v][j], this.institutions[v][j]]));
        }
        if (this.institutions[v].length) {
            var pos = this.nameset_base + this.variable_offset[v];
            if (this.freeters[v].length) {
                pos += 1;
            }
            institutions = this.joinInstitutionSets(institution_sets, pos);
        }
        var varblob = this.joinFreetersAndInstitutionSets([this.freeters[v], institutions]);
        if (varblob) {
            if (this.state.tmp.area.slice(-5) !== "_sort") {
                varblob = this._applyLabels(varblob, v);
            }
            blob_list.push(varblob);
        }
        if (this.common_term) {
            break;
        }
    }
    this.state.output.openLevel("empty");
    this.state.output.current.value().strings.delimiter = this.names.strings.delimiter;
    for (i = 0, ilen = blob_list.length; i < ilen; i += 1) {
        this.state.output.append(blob_list[i], "literal", true);
    }
    this.state.output.closeLevel("empty");
    var blob = this.state.output.pop();
    this.state.output.append(blob, this.names);
    if (this.state.tmp.term_predecessor_name) {
        this.state.tmp.term_predecessor = true;
    }
    this.state.tmp.name_node.top = this.state.output.current.value();
    if (variables[0] !== "authority") {
        var name_node_string = [];
        var nameobjs = this.Item[variables[0]];
        if (nameobjs) {
            for (var i = 0, ilen = nameobjs.length; i < ilen; i += 1) {
                substring = CSL.Util.Names.getRawName(nameobjs[i]);
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
    if (this.state.tmp.name_node.string && !this.state.tmp.first_name_string) {
        this.state.tmp.first_name_string = this.state.tmp.name_node.string;
    }
    if ("classic" === this.Item.type) {
        var author_title = [];
        if (this.state.tmp.first_name_string) {
            author_title.push(this.state.tmp.first_name_string);
        }
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
    this._collapseAuthor();
    this.variables = [];
};
CSL.NameOutput.prototype._applyLabels = function (blob, v) {
    var txt;
    if (!this.label || !this.label[v]) {
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
    if (this.label[v].before) {
        if ("number" === typeof this.label[v].before.strings.plural) {
            plural = this.label[v].before.strings.plural;
        }
        txt = this._buildLabel(v, plural, "before", v);
        this.state.output.openLevel("empty");
        this.state.output.append(txt, this.label[v].before, true);
        this.state.output.append(blob, "literal", true);
        this.state.output.closeLevel("empty");
        blob = this.state.output.pop();
    }
    if (this.label[v].after) {
        if ("number" === typeof this.label[v].after.strings.plural) {
            plural = this.label[v].after.strings.plural;
        }
        txt = this._buildLabel(v, plural, "after", v);
        this.state.output.openLevel("empty");
        this.state.output.append(blob, "literal", true);
        this.state.output.append(txt, this.label[v].after, true);
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
    if (this.nameset_base === 0 && this.Item[this.variables[0]] && !this._first_creator_variable) {
        this._first_creator_variable = this.variables[0];
    }
    if ((this.item && this.item["suppress-author"] && this._first_creator_variable == this.variables[0])
        || (this.state[this.state.tmp.area].opt.collapse 
            && this.state[this.state.tmp.area].opt.collapse.length)
        || (this.state[this.state.tmp.area].opt.cite_group_delimiter 
            && this.state[this.state.tmp.area].opt.cite_group_delimiter.length)) {
        if (this.state.tmp.authorstring_request) {
            mystr = "";
            myqueue = this.state.tmp.name_node.top.blobs.slice(-1)[0].blobs;
            oldchars = this.state.tmp.offset_characters;
            if (myqueue) {
                mystr = this.state.output.string(this.state, myqueue, false);
            }
            this.state.tmp.offset_characters = oldchars;
            this.state.registry.authorstrings[this.Item.id] = mystr;
        } else if (!this.state.tmp.just_looking
                   && !this.state.tmp.suppress_decorations && (this.item["suppress-author"] || (this.state[this.state.tmp.area].opt.collapse && this.state[this.state.tmp.area].opt.collapse.length) || this.state[this.state.tmp.area].opt.cite_group_delimiter && this.state[this.state.tmp.area].opt.cite_group_delimiter)) {
            mystr = "";
            myqueue = this.state.tmp.name_node.top.blobs.slice(-1)[0].blobs;
            oldchars = this.state.tmp.offset_characters;
            if (myqueue) {
                mystr = this.state.output.string(this.state, myqueue, false);
            }
            if (mystr === this.state.tmp.last_primary_names_string) {
                if (this.item["suppress-author"] || (this.state[this.state.tmp.area].opt.collapse && this.state[this.state.tmp.area].opt.collapse.length)) {
                    this.state.tmp.name_node.top.blobs.pop();
                    this.state.tmp.name_node.children = [];
                    this.state.tmp.offset_characters = oldchars;
                }
                if (this.state[this.state.tmp.area].opt.cite_group_delimiter && this.state[this.state.tmp.area].opt.cite_group_delimiter) {
                    this.state.tmp.use_cite_group_delimiter = true;
                }
            } else {
                this.state.tmp.last_primary_names_string = mystr;
                if (this.variables.indexOf(this._first_creator_variable) > -1 && this.item && this.item["suppress-author"] && this.Item.type !== "legal_case") {
                    this.state.tmp.name_node.top.blobs.pop();
                    this.state.tmp.name_node.children = [];
                    this.state.tmp.offset_characters = oldchars;
                    this.state.tmp.term_predecessor = false;
                }
                this.state.tmp.have_collapsed = false;
                if (this.state[this.state.tmp.area].opt.cite_group_delimiter && this.state[this.state.tmp.area].opt.cite_group_delimiter) {
                    this.state.tmp.use_cite_group_delimiter = false;
                }
            }
        }
    }
};
CSL.NameOutput.prototype.isPerson = function (value) {
    if (value.literal
        || (!value.given && value.family && value.isInstitution)) {
        return false;
    } else {
        return true;
    }
};
CSL.NameOutput.prototype.truncatePersonalNameLists = function () {
    var v, i, ilen, j, jlen, chopvar, values;
    this.freeters_count = {};
    this.persons_count = {};
    this.institutions_count = {};
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
            for (i = 0, ilen = this.persons[v].length; i < ilen; i += 1) {
                if (this.persons[v][i].length) {
                    if (this._please_chop === v) {
                        this.persons[v][i] = this.persons[v][i].slice(1);
                        this.persons_count[v][i] += -1;
                        this._please_chop = false;
                        break;
                    } else if (chopvar && !this._please_chop) {
                        this.freeters[v] = this.persons[v][i].slice(0, 1);
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
    for (i = 0, ilen = this.variables.length; i < ilen; i += 1) {
        if (this.institutions[v].length) {
            this.nameset_offset += 1;
        }
        for (i = 0, ilen = this.persons[v].length; i < ilen; i += 1) {
            if (this.persons[v][i].length) {
                this.nameset_offset += 1;
            }
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
        lst = lst.slice(0, this.state[this.state[this.state.tmp.area].root].opt.max_number_of_names + 2);
    }
    return lst;
};
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
};
CSL.NameOutput.prototype._normalizeVariableValue = function (Item, variable) {
    var names, name, i, ilen;
    if ("string" === typeof Item[variable]) {
        names = [{literal: Item[variable]}];
    } else if (!Item[variable]) {
        names = [];
    } else {
        names = Item[variable].slice();
    }
    return names;
};
CSL.NameOutput.prototype._getFreeters = function (v, values) {
    this.freeters[v] = [];
    for (var i = values.length - 1; i > -1; i += -1) {
        if (this.isPerson(values[i])) {
            var value = this._checkNickname(values.pop());
            if (value) {
                this.freeters[v].push(value);
            }
        } else {
            break;
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
            this.state.transform.loadAbbreviation("default", "nickname", author);
            var myLocalName = this.state.transform.abbrevs["default"].nickname[author];
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
CSL.NameOutput.prototype.joinPersons = function (blobs, pos, j) {
    var ret;
    if ("undefined" === typeof j) {
        if (this.etal_spec[pos].freeters === 1) {
            ret = this._joinEtAl(blobs, "name");
        } else if (this.etal_spec[pos].freeters === 2) {
            ret = this._joinEllipsis(blobs, "name");
        } else if (!this.state.tmp.sort_key_flag) {
            ret = this._joinAnd(blobs, "name");
        } else {
            ret = this._join(blobs, " ");
        }
    } else {
        if (this.etal_spec[pos].persons[j] === 1) {
            ret = this._joinEtAl(blobs, "name");
        } else if (this.etal_spec[pos].persons[j] === 2) {
            ret = this._joinEllipsis(blobs, "name");
        } else if (!this.state.tmp.sort_key_flag) {
            ret = this._joinAnd(blobs, "name");
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
    return this._join(blobs, this.name.strings.delimiter);
};
CSL.NameOutput.prototype.joinFreetersAndInstitutionSets = function (blobs) {
    var ret = this._join(blobs, "[never here]", this["with"].single, this["with"].multiple);
    return ret;
};
CSL.NameOutput.prototype._joinEtAl = function (blobs, tokenname) {
    var blob = this._join(blobs, this.name.strings.delimiter);
    this.state.output.openLevel(this._getToken(tokenname));
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
    return this._join(blobs, this.name.strings.delimiter, this.name.ellipsis.single, this.name.ellipsis.multiple, tokenname);
};
CSL.NameOutput.prototype._joinAnd = function (blobs, tokenname) {
    return this._join(blobs, this[tokenname].strings.delimiter, this[tokenname].and.single, this[tokenname].and.multiple, tokenname);
};
CSL.NameOutput.prototype._join = function (blobs, delimiter, single, multiple, tokenname) {
    var i, ilen;
    if (!blobs) {
        return false;
    }
    for (i = blobs.length - 1; i > -1; i += -1) {
        if (!blobs[i] || blobs[i].length === 0 || !blobs[i].blobs.length) {
            blobs = blobs.slice(0, i).concat(blobs.slice(i + 1));
        }
    }
    if (!blobs.length) {
        return false;
    } else if (single && blobs.length === 2) {
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
        for (i = 0, ilen = blobs.length - delimiter_offset; i < ilen; i += 1) {
            blobs[i].strings.suffix += delimiter;
        }
        if (blobs.length > 1) {
            var blob = blobs.pop();
            if (multiple) {
                multiple = new CSL.Blob(multiple.blobs,multiple);
                blobs.push(multiple);
            } else {
                if (single) {
                    single = new CSL.Blob(single.blobs,single);
                }
                blobs.push(single);
            }
            blobs.push(blob);
        }
    }
    this.state.output.openLevel(this._getToken(tokenname));
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
        return newtoken;
    }
    return token;
};
CSL.NameOutput.prototype.setCommonTerm = function () {
    var variables = this.variables;
    var varnames = variables.slice();
    varnames.sort();
    this.common_term = varnames.join("");
    if (!this.common_term) {
        return false;
    }
    var has_term = false;
    if (this.label && this.label[this.variables[0]]) {
        if (this.label[this.variables[0]].before) {
            has_term = this.state.getTerm(this.common_term, this.label[this.variables[0]].before.strings.form, 0);
        } else if (this.label[this.variables[0]].after) {
            has_term = this.state.getTerm(this.common_term, this.label[this.variables[0]].after.strings.form, 0);
        }
    }
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
    if (base_nameset.length !== nameset.length) {
        return false;
    }
    for (var i = 0, ilen = nameset.length; i < ilen; i += 1) {
        var name = nameset[i];
        for (var j = 0, jlen = CSL.NAME_PARTS.length; j < jlen; j += 1) {
            var part = CSL.NAME_PARTS[j];
            if (!base_nameset[i] || base_nameset[i][part] != nameset[i][part]) {
                return false;
            }
        }
    }
    return true;
};
CSL.NameOutput.prototype.constrainNames = function () {
    this.names_count = 0;
    var pos;
    for (var i = 0, ilen = this.variables.length; i < ilen; i += 1) {
        var v = this.variables[i];
        pos = this.nameset_base + i;
        if (this.freeters[v].length) {
            this.state.tmp.names_max.push(this.freeters[v].length, "literal");
            this._imposeNameConstraints(this.freeters, this.freeters_count, v, pos);
            this.names_count += this.freeters[v].length;
        }
        if (this.institutions[v].length) {
            this.state.tmp.names_max.push(this.institutions[v].length, "literal");
            this._imposeNameConstraints(this.institutions, this.institutions_count, v, pos);
            this.persons[v] = this.persons[v].slice(0, this.institutions[v].length);
            this.names_count += this.institutions[v].length;
        }
        for (var j = 0, jlen = this.persons[v].length; j < jlen; j += 1) {
            if (this.persons[v][j].length) {
                this.state.tmp.names_max.push(this.persons[v][j].length, "literal");
                this._imposeNameConstraints(this.persons[v], this.persons_count[v], j, pos);
                this.names_count += this.persons[v][j].length;
            }
        }
    }
};
CSL.NameOutput.prototype._imposeNameConstraints = function (lst, count, key, pos) {
    var display_names = lst[key];
    var discretionary_names_length = this.state.tmp["et-al-min"];
    if (this.state.tmp.suppress_decorations) {
        if (this.state.tmp.disambig_request && this.state.tmp.disambig_request.names[pos]) {
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
            discretionary_names_length = this.etal_use_first;
        }
        if (this.etal_use_last && discretionary_names_length > (this.etal_min - 2)) {
            discretionary_names_length = this.etal_min - 2;
        }
    }
    var sane = this.etal_min >= this.etal_use_first;
    var overlength = count[key] > discretionary_names_length;
    if (discretionary_names_length > count[key]) {
        discretionary_names_length = display_names.length;
    }
    if (sane && overlength) {
        if (this.etal_use_last) {
            lst[key] = display_names.slice(0, discretionary_names_length).concat(display_names.slice(-1));
        } else {
            lst[key] = display_names.slice(0, discretionary_names_length);
        }
    }
    this.state.tmp.disambig_settings.names[pos] = lst[key].length;
    this.state.disambiguate.padBase(this.state.tmp.disambig_settings);
};
CSL.NameOutput.prototype.disambigNames = function () {
    var pos;
    for (var i = 0, ilen = this.variables.length; i < ilen; i += 1) {
        var v = this.variables[i];
        pos = this.nameset_base + i;
        if (this.freeters[v].length) {
            this._runDisambigNames(this.freeters[v], pos);
        }
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
    for (i = 0, ilen = lst.length; i < ilen; i += 1) {
        if (!lst[i].given && !lst[i].family) {
            continue;
        }
        myinitials = this.name.strings["initialize-with"];
        this.state.registry.namereg.addname("" + this.Item.id, lst[i], i);
        chk = this.state.tmp.disambig_settings.givens[pos];
        if ("undefined" === typeof chk) {
            for (var j = 0, jlen = pos + 1; j < jlen; j += 1) {
                if (!this.state.tmp.disambig_settings.givens[j]) {
                    this.state.tmp.disambig_settings.givens[j] = [];
                }
            }
        }
        chk = this.state.tmp.disambig_settings.givens[pos][i];
        if ("undefined" === typeof chk) {
            myform = this.name.strings.form;
            param = this.state.registry.namereg.evalname("" + this.Item.id, lst[i], i, 0, myform, myinitials);
            this.state.tmp.disambig_settings.givens[pos].push(param);
        }
        myform = this.name.strings.form;
        paramx = this.state.registry.namereg.evalname("" + this.Item.id, lst[i], i, 0, myform, myinitials);
        if (this.state.tmp.disambig_request) {
            var val = this.state.tmp.disambig_settings.givens[pos][i];
            if (val === 1 && 
                this.state.citation.opt["givenname-disambiguation-rule"] === "by-cite" && 
                ("undefined" === typeof this.name.strings["initialize-with"]
                 || "undefined" === typeof lst[i].given)) {
                val = 2;
            }
            param = val;
            if (this.state.opt["disambiguate-add-givenname"] && lst[i].given) {
                param = this.state.registry.namereg.evalname("" + this.Item.id, lst[i], i, param, this.name.strings.form, this.name.strings["initialize-with"]);
            }
        } else {
            param = paramx;
        }
        if (!this.state.tmp.just_looking && this.item && this.item.position === CSL.POSITION_FIRST) {
            param = paramx;
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
};
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
    if ("undefined" === typeof item) {
        item = {};
    }
    if (item.position) {
        if (this.name.strings["et-al-subsequent-min"]) {
            this.etal_min = this.name.strings["et-al-subsequent-min"];
        } else {
            this.etal_min = this.name.strings["et-al-min"];
        }
        if (this.name.strings["et-al-subsequent-use-first"]) {
            this.etal_use_first = this.name.strings["et-al-subsequent-use-first"];
        } else {
            this.etal_use_first = this.name.strings["et-al-use-first"];
        }
    } else {
        if (this.state.tmp["et-al-min"]) {
            this.etal_min = this.state.tmp["et-al-min"];
        } else {
            this.etal_min = this.name.strings["et-al-min"];
        }
        if (this.state.tmp["et-al-use-first"]) {
            this.etal_use_first = this.state.tmp["et-al-use-first"];
        } else {
            this.etal_use_first = this.name.strings["et-al-use-first"];
        }
        if ("boolean" === typeof this.state.tmp["et-al-use-last"]) {
            this.etal_use_last = this.state.tmp["et-al-use-last"];
        } else {
            this.etal_use_last = this.name.strings["et-al-use-last"];
        }
    }
    if (!this.state.tmp["et-al-min"]) {
        this.state.tmp["et-al-min"] = this.etal_min;
    }
};
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
                this.etal_spec[v].persons[j] = 2
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
CSL.NameOutput.prototype.renderAllNames = function () {
    var pos;
    for (var i = 0, ilen = this.variables.length; i < ilen; i += 1) {
        var v = this.variables[i];
        pos = this.nameset_base + i;
        if (this.freeters[v].length) {
            this.freeters[v] = this._renderPersonalNames(this.freeters[v], pos);
        }
        for (var j = 0, jlen = this.institutions[v].length; j < jlen; j += 1) {
            this.persons[v][j] = this._renderPersonalNames(this.persons[v][j], pos, j);
        }
    }
    this.renderInstitutionNames();
};
CSL.NameOutput.prototype.renderInstitutionNames = function () {
    for (var i = 0, ilen = this.variables.length; i < ilen; i += 1) {
        var v = this.variables[i];
        for (var j = 0, jlen = this.institutions[v].length; j < jlen; j += 1) {
            var institution, institution_short, institution_long, short_style, long_style;
            var name = this.institutions[v][j];
            var j, ret, optLangTag, jlen, key, localesets;
            if (this.state.tmp.extension) {
                localesets = ["sort"];
            } else if (name.isInstitution) {
                localesets = this.state.opt['cite-lang-prefs'].institutions;
            } else {
                localesets = this.state.opt['cite-lang-prefs'].persons;
            }
            slot = {primary:'locale-orig',secondary:false,tertiary:false};
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
            var res;
            this.setRenderedName(name);
            res = this.getName(name, slot.primary, true);
            var primary = res.name;
            var usedOrig = res.usedOrig;
            if (primary) {
                primary = this.fixupInstitution(primary, v, j);
            }
			secondary = false;
			if (slot.secondary) {
                res = this.getName(name, slot.secondary, false, usedOrig);
                secondary = res.name;
                usedOrig = res.usedOrig;
                if (secondary) {
				    secondary = this.fixupInstitution(secondary, v, j);
                }
			}
			tertiary = false;
			if (slot.tertiary) {
                res = this.getName(name, slot.tertiary, false, usedOrig);
                tertiary = res.name;
                if (tertiary) {
				    tertiary = this.fixupInstitution(tertiary, v, j);
                }
			}
            switch (this.institution.strings["institution-parts"]) {
            case "short":
                if (primary["short"].length) {
                    short_style = this._getShortStyle();
                    institution = [this._renderOneInstitutionPart(primary["short"], short_style)];
                } else {
                    long_style = this._getLongStyle(primary, v, j);
                    institution = [this._renderOneInstitutionPart(primary["long"], long_style)];
                }
                break;
            case "short-long":
                long_style = this._getLongStyle(primary, v, j);
                short_style = this._getShortStyle();
                institution_short = this._renderOneInstitutionPart(primary["short"], short_style);
                institution_long = this._composeOneInstitutionPart([primary, secondary, tertiary], slot, long_style);
                institution = [institution_short, institution_long];
                break;
            case "long-short":
                long_style = this._getLongStyle(primary, v, j);
                short_style = this._getShortStyle();
                institution_short = this._renderOneInstitutionPart(primary["short"], short_style);
                institution_long = this._composeOneInstitutionPart([primary, secondary, tertiary], slot, long_style, true);
                institution = [institution_long, institution_short];
                break;
            default:
                long_style = this._getLongStyle(primary, v, j);
                institution = [this._composeOneInstitutionPart([primary, secondary, tertiary], slot, long_style)];
                break;
            }
            this.institutions[v][j] = this._join(institution, "");
        }
    }
};
CSL.NameOutput.prototype._composeOneInstitutionPart = function (names, slot, style) {
    var primary = false, secondary = false, tertiary = false;
    if (names[0]) {
        primary = this._renderOneInstitutionPart(names[0]["long"], style);
    }
    if (names[1]) {
        secondary = this._renderOneInstitutionPart(names[1]["long"], style);
    }
    if (names[2]) {
        tertiary = this._renderOneInstitutionPart(names[2]["long"], style);
    }
    var institutionblob;
    if (secondary || tertiary) {
        this.state.output.openLevel("empty");
        this.state.output.append(primary);
        secondary_tok = CSL.Util.cloneToken(style);
        if (slot.secondary) {
            secondary_tok.strings.prefix = this.state.opt.citeAffixes.institutions[slot.secondary].prefix;
            secondary_tok.strings.suffix = this.state.opt.citeAffixes.institutions[slot.secondary].suffix;
            if (!secondary_tok.strings.prefix) {
                secondary_tok.strings.prefix = " ";
            }
        }
        this.state.output.append(secondary, secondary_tok);
        tertiary_tok = CSL.Util.cloneToken(style);
        if (slot.tertiary) {
            tertiary_tok.strings.prefix = this.state.opt.citeAffixes.institutions[slot.tertiary].prefix;
            tertiary_tok.strings.suffix = this.state.opt.citeAffixes.institutions[slot.tertiary].suffix;
            if (!tertiary_tok.strings.prefix) {
                tertiary_tok.strings.prefix = " ";
            }
        }
        this.state.output.append(tertiary, tertiary_tok);
        this.state.output.closeLevel();
        institutionblob = this.state.output.pop();
    } else {
        institutionblob = primary;
    }
    return institutionblob;
}
CSL.NameOutput.prototype._renderOneInstitutionPart = function (blobs, style) {
    for (var i = 0, ilen = blobs.length; i < ilen; i += 1) {
        if (blobs[i]) {
            var str = blobs[i];
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
            this.state.tmp.group_context.value()[2] = true;
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
        this.institution.strings["part-separator"] = this.name.strings.delimiter;
    }
    return this._join(blobs, this.institution.strings["part-separator"]);
};
CSL.NameOutput.prototype._renderPersonalNames = function (values, pos, j) {
    var ret = false;
    if (values.length) {
        var names = [];
        for (var i = 0, ilen = values.length; i < ilen; i += 1) {
            var name = values[i];
            var ret, optLangTag, jlen, key, localesets;
            if (this.state.tmp.extension) {
                localesets = ["sort"];
            } else if (name.isInstitution) {
                localesets = this.state.opt['cite-lang-prefs'].institutions;
            } else {
                localesets = this.state.opt['cite-lang-prefs'].persons;
            }
            slot = {primary:'locale-orig',secondary:false,tertiary:false};
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
            this.setRenderedName(name);
            var res = this.getName(name, slot.primary, true);
            var primary = this._renderOnePersonalName(res.name, pos, i, j);
			secondary = false;
			if (slot.secondary) {
                res = this.getName(name, slot.secondary, false, res.usedOrig);
                if (res.name) {
				    secondary = this._renderOnePersonalName(res.name, pos, i, j);
                }
			}
			tertiary = false;
			if (slot.tertiary) {
                res = this.getName(name, slot.tertiary, false, res.usedOrig);
                if (res.name) {
				    tertiary = this._renderOnePersonalName(res.name, pos, i, j);
                }
			}
            var personblob;
            if (secondary || tertiary) {
                this.state.output.openLevel("empty");
                this.state.output.append(primary);
                secondary_tok = new CSL.Token();
                if (slot.secondary) {
                    secondary_tok.strings.prefix = this.state.opt.citeAffixes.persons[slot.secondary].prefix;
                    secondary_tok.strings.suffix = this.state.opt.citeAffixes.persons[slot.secondary].suffix;
                    if (!secondary_tok.strings.prefix) {
                        secondary_tok.strings.prefix = " ";
                    }
                }
                this.state.output.append(secondary, secondary_tok);
                tertiary_tok = new CSL.Token();
                if (slot.tertiary) {
                    tertiary_tok.strings.prefix = this.state.opt.citeAffixes.persons[slot.tertiary].prefix;
                    tertiary_tok.strings.suffix = this.state.opt.citeAffixes.persons[slot.tertiary].suffix;
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
            names.push(personblob);
        }
        ret = this.joinPersons(names, pos, j);
    }
    return ret;
};
CSL.NameOutput.prototype._isRomanesque = function (name) {
    var ret = 2;
    if (!name.family.replace('"', '', 'g').match(CSL.ROMANESQUE_REGEXP)) {
        ret = 0;
    }
    if (!ret && name.given && name.given.match(CSL.STARTSWITH_ROMANESQUE_REGEXP)) {
        ret = 1;
    }
    if (ret == 2) {
        if (name.multi && name.multi.main) {
            var top_locale = name.multi.main.slice(0, 2);
        } else if (this.Item.language) {
            top_locale = this.Item.language.slice(0, 2);
        }
        if (["ja", "zh"].indexOf(top_locale) > -1) {
            ret = 1;
        }
    }
    return ret;
};
CSL.NameOutput.prototype._renderOnePersonalName = function (value, pos, i, j) {
    var name = value;
    var dropping_particle = this._droppingParticle(name, pos, j);
    var family = this._familyName(name);
    var non_dropping_particle = this._nonDroppingParticle(name);
    var given = this._givenName(name, pos, i);
    var suffix = this._nameSuffix(name);
    if (this._isShort(pos, i) && !name["full-form-always"]) {
        dropping_particle = false;
        given = false;
        suffix = false;
    }
    var sort_sep = this.name.strings["sort-separator"];
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
    var has_hyphenated_non_dropping_particle = non_dropping_particle && non_dropping_particle.blobs.slice(-1) === "-";
    var blob, merged, first, second;
    if (romanesque === 0) {
        blob = this._join([non_dropping_particle, family, given], "");
    } else if (romanesque === 1 || name["static-ordering"]) { // entry likes sort order
        blob = this._join([non_dropping_particle, family, given], " ");
    } else if (name["reverse-ordering"]) { // entry likes reverse order
        blob = this._join([given, non_dropping_particle, family], " ");
    } else if (this.state.tmp.sort_key_flag) {
        if (this.state.opt["demote-non-dropping-particle"] === "never") {
            first = this._join([non_dropping_particle, family, dropping_particle], " ");
            merged = this._join([first, given], " ");
            blob = this._join([merged, suffix], " ");
        } else {
            second = this._join([given, dropping_particle, non_dropping_particle], " ");
            merged = this._join([family, second], " ");
            blob = this._join([merged, suffix], " ");
        }
    } else if (this.name.strings["name-as-sort-order"] === "all" || (this.name.strings["name-as-sort-order"] === "first" && i === 0 && (j === 0 || "undefined" === typeof j))) {
        if (["Lord", "Lady"].indexOf(name.given) > -1) {
            sort_sep = ", ";
        }
        if (["always", "display-and-sort"].indexOf(this.state.opt["demote-non-dropping-particle"]) > -1 && !has_hyphenated_non_dropping_particle) {
            second = this._join([given, dropping_particle], (name["comma-dropping-particle"] + " "));
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
            if (this.state.tmp.area === "bibliography" && !this.state.tmp.term_predecessor && non_dropping_particle) {
                if (!has_hyphenated_non_dropping_particle) {
                    non_dropping_particle.blobs = CSL.Output.Formatters["capitalize-first"](this.state, non_dropping_particle.blobs)
                }
            }
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
            if (second && this.given) {
                second.strings.prefix = this.given.strings.prefix;
                second.strings.suffix = this.given.strings.suffix;
            }
            merged = this._join([first, second], sort_sep);
            blob = this._join([merged, suffix], sort_sep);
        }
    } else { // plain vanilla
        if (name["dropping-particle"] && name.family && !name["non-dropping-particle"]) {
            if (["'","\u02bc","\u2019"].indexOf(name["dropping-particle"].slice(-1)) > -1) {
                family = this._join([dropping_particle, family], "");
                dropping_particle = false;
            }
        }
        if (!this.state.tmp.term_predecessor) {
            if (!given && this.state.tmp.area === "bibliography") {
                if (!dropping_particle && non_dropping_particle) {
                    if (!has_hyphenated_non_dropping_particle) {
                        non_dropping_particle.blobs = CSL.Output.Formatters["capitalize-first"](this.state, non_dropping_particle.blobs)
                    }
                } else if (dropping_particle) {
                    dropping_particle.blobs = CSL.Output.Formatters["capitalize-first"](this.state, dropping_particle.blobs)
                }
            }
        }
        if (has_hyphenated_non_dropping_particle) {
            second = this._join([non_dropping_particle, family], "");
            second = this._join([dropping_particle, second], " ");
        } else {
            second = this._join([dropping_particle, non_dropping_particle, family], " ");
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
        blob = this._join([given, second], (name["comma-dropping-particle"] + " "));
    }
    this.state.tmp.group_context.value()[2] = true;
    this.state.tmp.can_substitute.replace(false, CSL.LITERAL);
    this.state.tmp.term_predecessor = true;
    this.state.tmp.name_node.children.push(blob);
    return blob;
};
CSL.NameOutput.prototype._isShort = function (pos, i) {
    if (0 === this.state.tmp.disambig_settings.givens[pos][i]) {
        return true;
    } else {
        return false;
    }
};
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
        if (this.name.strings["et-al-use-last"]) {
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
    if (this.name.strings.initialize === false) {
        if (name.family && name.given && this.name.strings.initialize === false) {
            name.given = CSL.Util.Names.initializeWith(this.state, name.given, this.name.strings["initialize-with"], true);
        }
        name.given = CSL.Util.Names.unInitialize(this.state, name.given);
    } else {
        if (name.family && 1 === this.state.tmp.disambig_settings.givens[pos][i] && !name.block_initialize) {
            var initialize_with = this.name.strings["initialize-with"];
            name.given = CSL.Util.Names.initializeWith(this.state, name.given, initialize_with);
        } else {
            name.given = CSL.Util.Names.unInitialize(this.state, name.given);
        }
    }
    var str = this._stripPeriods("given", name.given);
    if (this.state.output.append(str, this.given_decor, true)) {
        return this.state.output.pop();
    }
    return false;
};
CSL.NameOutput.prototype._nameSuffix = function (name) {
    var str = name.suffix;
    if ("string" === typeof this.name.strings["initialize-with"]) {
        str = CSL.Util.Names.initializeWith(this.state, name.suffix, this.name.strings["initialize-with"], true);
    }
    str = this._stripPeriods("family", str);
    if (this.state.output.append(str, "empty", true)) {
        return this.state.output.pop();
    }
    return false;
};
CSL.NameOutput.prototype._getLongStyle = function (name, v, i) {
    var long_style, short_style;
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
    var m, idx;
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
    if (!name["non-dropping-particle"] && name.family && !noparse && name.given) {
        m = name.family.match(/^((?:[\'\u2019a-z][ \'\u2019a-z]*[-\s\'\u2019]+|[ABDVL][^ ][-\s]+[a-z]*\s*|[ABDVL][^ ][^ ][-\s]+[a-z]*\s*))/);
        if (m) {
            name.family = name.family.slice(m[1].length);
            name["non-dropping-particle"] = m[1].replace(/\s+$/, "").replace("'", "\u2019");
        }
    }
    if (!name.suffix && name.given) {
        m = name.given.match(/(\s*,!*\s*)/);
        if (m) {
            idx = name.given.indexOf(m[1]);
            var possible_suffix = name.given.slice(idx + m[1].length);
            var possible_comma = name.given.slice(idx, idx + m[1].length).replace(/\s*/g, "");
            if (possible_suffix.length <= 3) {
                if (possible_comma.length === 2) {
                    name["comma-suffix"] = true;
                }
                name.suffix = possible_suffix;
            } else if (!name["dropping-particle"] && name.given) {
                name["dropping-particle"] = possible_suffix;
                name["comma-dropping-particle"] = ",";
            }
            name.given = name.given.slice(0, idx);
        }
    }
    if (!name["dropping-particle"] && name.given) {
        m = name.given.match(/(\s+)([a-z][ \'\u2019a-z]*)$/);
        if (m) {
            name.given = name.given.slice(0, (m[1].length + m[2].length) * -1);
            name["dropping-particle"] = m[2];
        }
    }
};
CSL.NameOutput.prototype.getName = function (name, slotLocaleset, fallback, stopOrig) {
    if (stopOrig && slotLocaleset === 'locale-orig') {
        return {name:false,usedOrig:stopOrig};
    }
    if (!name.family) {
        name.family = "";
    }
    if (!name.given) {
        name.given = "";
    }
    var name_params = {};
    name_params["static-ordering"] = this.getStaticOrder(name);
    var foundTag = true;
    if (slotLocaleset !== 'locale-orig') {
        foundTag = false;
        if (name.multi) {
            var langTags = this.state.opt[slotLocaleset]
            for (i = 0, ilen = langTags.length; i < ilen; i += 1) {
                langTag = langTags[i];
                if (name.multi._key[langTag]) {
                    foundTag = true;
                    name = name.multi._key[langTag];
                    name_params = this.getNameParams(langTag);
                    name_params.transliterated = true;
                    break;
                }
            }
        }
    }
    if (!foundTag) {
        var langTag = false;
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
    if (!name.family) {
        name.family = "";
    }
    if (!name.given) {
        name.given = "";
    }
    name = {
        family:name.family,
        given:name.given,
        "non-dropping-particle":name["non-dropping-particle"],
        "dropping-particle":name["dropping-particle"],
        suffix:name.suffix,
        "static-ordering":name_params["static-ordering"],
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
}
CSL.NameOutput.prototype.getNameParams = function (langTag) {
    var ret = {};
    var langspec = CSL.localeResolve(this.Item.language, this.state.opt["default-locale"][0]);
    var try_locale = this.state.locale[langspec.best] ? langspec.best : this.state.opt["default-locale"][0];
    var name_as_sort_order = this.state.locale[try_locale].opts["name-as-sort-order"]
    var name_as_reverse_order = this.state.locale[try_locale].opts["name-as-reverse-order"]
    var name_never_short = this.state.locale[try_locale].opts["name-never-short"]
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
}
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
}
CSL.NameOutput.prototype.fixupInstitution = function (name, varname, listpos) {
    name = this._splitInstitution(name, varname, listpos);
    if (this.institution.strings["reverse-order"]) {
        name["long"].reverse();
    }
    var long_form = name["long"];
    var short_form = long_form.slice();
    if (this.state.sys.getAbbreviation) {
        var jurisdiction = this.Item.jurisdiction;
        for (var j = 0, jlen = long_form.length; j < jlen; j += 1) {
            jurisdiction = this.state.transform.loadAbbreviation(jurisdiction, "institution-part", long_form[j]);
            if (this.state.transform.abbrevs[jurisdiction]["institution-part"][long_form[j]]) {
                short_form[j] = this.state.transform.abbrevs[jurisdiction]["institution-part"][long_form[j]];
            }
        }
    }
    name["short"] = short_form;
    return name;
}
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
}
CSL.NameOutput.prototype._splitInstitution = function (value, v, i) {
    var ret = {};
    var splitInstitution = value.literal.replace(/\s*\|\s*/g, "|");
    splitInstitution = splitInstitution.split("|");
    if (this.institution.strings.form === "short" && this.state.sys.getAbbreviation) {
        var jurisdiction = this.Item.jurisdiction;
        for (var j = splitInstitution.length; j > 0; j += -1) {
            var str = splitInstitution.slice(0, j).join("|");
            jurisdiction = this.state.transform.loadAbbreviation(jurisdiction, "institution-entire", str);
            if (this.state.transform.abbrevs[jurisdiction]["institution-entire"][str]) {
                var splitLst = this.state.transform.abbrevs[jurisdiction]["institution-entire"][str];
                splitLst = this.state.transform.quashCheck(splitLst);
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
            }
        }
    }
    splitInstitution.reverse();
    ret["long"] = this._trimInstitution(splitInstitution, v, i);
    return ret;
};
CSL.NameOutput.prototype._trimInstitution = function (subunits, v, i) {
    var use_first = false;
    var append_last = false;
    var stop_last = false;
    var s = subunits.slice();
    if (this.institution) {
        if ("undefined" !== typeof this.institution.strings["use-first"]) {
            use_first = this.institution.strings["use-first"];
        }
        if ("undefined" !== typeof this.institution.strings["stop-last"]) {
            s = s.slice(0, this.institution.strings["stop-last"]);
            subunits = subunits.slice(0, this.institution.strings["stop-last"]);
        }
        if ("undefined" !== typeof this.institution.strings["use-last"]) {
            append_last = this.institution.strings["use-last"];
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
    if (use_first > subunits.length - append_last) {
        use_first = subunits.length - append_last;
    }
    if (stop_last) {
        append_last = 0;
    }
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
            this.state.output.append(str, tok, true);
            this[varname + "-list"][j] = this.state.output.pop();
        }
    }
};
CSL.PublisherOutput.prototype.composePublishers = function () {
    var blobs;
    for (var i = 0, ilen = this["publisher-list"].length; i < ilen; i += 1) {
        var ordered_list = [];
        blobs = [this[this.varlist[0] + "-list"][i], this[this.varlist[1] + "-list"][i]];
        this["publisher-list"][i] = this._join(blobs, this.group_tok.strings.delimiter);
    }
};
CSL.PublisherOutput.prototype.joinPublishers = function () {
    var blobs = this["publisher-list"];
    var delim = this.name_delimiter;
    var publishers = this._join(blobs, this.group_tok.strings["subgroup-delimiter"], this.and_blob.single, this.and_blob.multiple, this.group_tok);
    this.state.output.append(publishers, "literal");
};
CSL.PublisherOutput.prototype._join = CSL.NameOutput.prototype._join;
CSL.PublisherOutput.prototype._getToken = CSL.NameOutput.prototype._getToken;
CSL.PublisherOutput.prototype.clearVars = function () {
    this.state.tmp["publisher-list"] = false;
    this.state.tmp["publisher-place-list"] = false;
    this.state.tmp["publisher-group-token"] = false;
    this.state.tmp["publisher-token"] = false;
    this.state.tmp["publisher-place-token"] = false;
};
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
    var plural = node.strings.plural;
    if (item && "number" === typeof item.force_pluralism) {
        plural = item.force_pluralism;
    } else if ("number" !== typeof plural) {
        if ("locator" === node.strings.term) {
            if (item && item.locator) {
                if (state.opt.development_extensions.locator_parsing_for_plurals) {
                    if (!state.tmp.shadow_numbers.locator) {
                        state.processNumber(false, item, "locator", Item.type);
                    }
                    plural = state.tmp.shadow_numbers.locator.plural;
                } else {
                    plural = CSL.evaluateStringPluralism(item.locator);
                }
            }
        } else if (["page", "page-first"].indexOf(node.variables[0]) > -1) {
            state.processNumber(false, Item, myterm, Item.type);
            plural = state.tmp.shadow_numbers[myterm].plural;
            myterm = state.tmp.shadow_numbers[myterm].label;
        } else {
            if (!state.tmp.shadow_numbers[myterm]) {
                state.processNumber(false, Item, myterm, Item.type);
            }
            plural = state.tmp.shadow_numbers[myterm].plural;
        }
        if (node.decorations && state.opt.development_extensions.csl_reverse_lookup_support) {
            node.decorations.reverse();
            node.decorations.push(["@showid","true", node.cslid]);
            node.decorations.reverse();
        }
    }
    return CSL.castLabel(state, node, myterm, plural, CSL.TOLERANT);
};
CSL.evaluateStringPluralism = function (str) {
    if (str) {
        var m = str.match(/(?:[0-9],\s*[0-9]|\s+and\s+|&|([0-9]+)\s*[\-\u2013]\s*([0-9]+))/);
        if (m && (!m[1] || parseInt(m[1], 10) < parseInt(m[2], 10))) {
            return 1;
        }
    }
    return 0;
};
CSL.castLabel = function (state, node, term, plural, mode) {
    var label_form = node.strings.form;
    if (state.tmp.group_context.value()[5]) {
        label_form = state.tmp.group_context.value()[5];
    }
    var ret = state.getTerm(term, label_form, plural, false, mode);
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
CSL.Node.name = {
    build: function (state, target) {
        var func, pos, len, attrname;
        if ([CSL.SINGLETON, CSL.START].indexOf(this.tokentype) > -1) {
            state.fixOpt(this, "name-delimiter", "name_delimiter");
            state.fixOpt(this, "name-form", "form");
            state.fixOpt(this, "and", "and");
            state.fixOpt(this, "delimiter-precedes-last", "delimiter-precedes-last");
            state.fixOpt(this, "delimiter-precedes-et-al", "delimiter-precedes-et-al");
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
            if (this.strings["et-al-subsequent-min"]
                && (this.strings["et-al-subsequent-min"] !== this.strings["et-al-min"])) {
                state.opt.update_mode = CSL.POSITION;
            }
            if (this.strings["et-al-subsequent-use-first"]
                && (this.strings["et-al-subsequent-use-first"] !== this.strings["et-al-use-first"])) {
                state.opt.update_mode = CSL.POSITION;
            }
            if ("undefined" == typeof this.strings.name_delimiter) {
                this.strings.delimiter = ", ";
            } else {
                this.strings.delimiter = this.strings.name_delimiter;
            }
            if (this.strings["et-al-use-last"]) {
                this.ellipsis_term = "\u2026";
                this.ellipsis_prefix_single = " ";
                this.ellipsis_prefix_multiple =  this.strings.delimiter;
                this.ellipsis_suffix = " ";
            }
            func = function (state, Item) {
                state.tmp.etal_term = "et-al";
                state.tmp.name_delimiter = this.strings.delimiter;
                state.tmp["delimiter-precedes-et-al"] = this.strings["delimiter-precedes-et-al"];
                if ("text" === this.strings.and) {
                    this.and_term = state.getTerm("and", "long", 0);
                } else if ("symbol" === this.strings.and) {
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
                    if ("string" === typeof this.strings.delimiter) {
                        this.and_prefix_multiple = this.strings.delimiter;
                    }
                    this.and_suffix = " ";
                    state.build.name_delimiter = this.strings.delimiter;
                } else {
                    this.and_prefix_single = "";
                    this.and_prefix_multiple = "";
                    this.and_suffix = "";
                }
                if (this.strings["delimiter-precedes-last"] === "always") {
                    this.and_prefix_single = this.strings.delimiter;
                } else if (this.strings["delimiter-precedes-last"] === "never") {
                    if (this.and_prefix_multiple) {
                        this.and_prefix_multiple = " ";
                    }
                } else if (this.strings["delimiter-precedes-last"] === "after-inverted-name") {
                    if (this.and_prefix_single) {
                        this.and_prefix_single = this.strings.delimiter;;
                    }
                    if (this.and_prefix_multiple) {
                        this.and_prefix_multiple = " ";
                    }
                }
                this.and = {};
                if (this.strings.and) {
                    state.output.append(this.and_term, "empty", true);
                    this.and.single = state.output.pop();
                    this.and.single.strings.prefix = this.and_prefix_single;
                    this.and.single.strings.suffix = this.and_suffix;
                    state.output.append(this.and_term, "empty", true);
                    this.and.multiple = state.output.pop();
                    this.and.multiple.strings.prefix = this.and_prefix_multiple;
                    this.and.multiple.strings.suffix = this.and_suffix;
                } else if (this.strings.delimiter) {
                    this.and.single = new CSL.Blob(this.strings.delimiter);
                    this.and.single.strings.prefix = "";
                    this.and.single.strings.suffix = "";
                    this.and.multiple = new CSL.Blob(this.strings.delimiter);
                    this.and.multiple.strings.prefix = "";
                    this.and.multiple.strings.suffix = "";
                }
                this.ellipsis = {};
                if (this.strings["et-al-use-last"]) {
                    this.ellipsis.single = new CSL.Blob(this.ellipsis_term);
                    this.ellipsis.single.strings.prefix = this.ellipsis_prefix_single;
                    this.ellipsis.single.strings.suffix = this.ellipsis_suffix;
                    this.ellipsis.multiple = new CSL.Blob(this.ellipsis_term);
                    this.ellipsis.multiple.strings.prefix = this.ellipsis_prefix_multiple;
                    this.ellipsis.multiple.strings.suffix = this.ellipsis_suffix;
                }
                if ("undefined" === typeof state.tmp["et-al-min"]) {
                    state.tmp["et-al-min"] = this.strings["et-al-min"];
                }
                if ("undefined" === typeof state.tmp["et-al-use-first"]) {
                    state.tmp["et-al-use-first"] = this.strings["et-al-use-first"];
                }
                if ("undefined" === typeof state.tmp["et-al-use-last"]) {
                    state.tmp["et-al-use-last"] = this.strings["et-al-use-last"];
                }
                state.nameOutput.name = this;
            };
            state.build.name_flag = true;
            this.execs.push(func);
        }
        target.push(this);
    }
};
CSL.Node["name-part"] = {
    build: function (state, target) {
        state.build[this.strings.name] = this;
    }
};
CSL.Node.names = {
    build: function (state, target) {
        var func, len, pos, attrname;
        var debug = false;
        if (this.tokentype === CSL.START || this.tokentype === CSL.SINGLETON) {
            CSL.Util.substituteStart.call(this, state, target);
            state.build.substitute_level.push(1);
            state.fixOpt(this, "names-delimiter", "delimiter");
        }
        if (this.tokentype === CSL.SINGLETON) {
            state.build.names_variables.push(this.variables);
            for (var i = 0, ilen = this.variables.length; i < ilen; i += 1) {
                state.build.name_label[this.variables[i]] = state.build.name_label[state.build.names_variables.slice(0)[0]];
            }
            func = function (state, Item, item) {
                state.nameOutput.reinit(this);
            };
            this.execs.push(func);
        }
        if (this.tokentype === CSL.START) {
            state.build.names_flag = true;
            state.build.names_level += 1;
            if (state.build.names_level === 1) {
                state.build.names_variables = [];
                state.build.name_label = {};
            }
            state.build.names_variables.push(this.variables);
            func = function (state, Item, item) {
                state.tmp.can_substitute.push(true);
                state.parallel.StartVariable("names",this.variables[0]);
                state.nameOutput.init(this);
            };
            this.execs.push(func);
        }
        if (this.tokentype === CSL.END) {
            for (var i = 0, ilen = 3; i < ilen; i += 1) {
                var key = ["family", "given", "et-al"][i];
                this[key] = state.build[key];
                if (state.build.names_level === 1) {
                    state.build[key] = undefined;
                }
            }
            this.label = state.build.name_label;
            if (state.build.names_level === 1) {
                state.build.name_label = {};
            }
            state.build.names_level += -1;
            state.build.names_variables.pop();
            var mywith = "with";
            var with_default_prefix = "";
            var with_suffix = "";
            if (CSL.STARTSWITH_ROMANESQUE_REGEXP.test(mywith)) {
                with_default_prefix = " ";
                with_suffix = " ";
            }
            this["with"] = {};
            this["with"].single = new CSL.Blob(mywith);
            this["with"].single.strings.suffix = with_suffix;
            this["with"].multiple = new CSL.Blob(mywith);
            this["with"].multiple.strings.suffix = with_suffix;
            if (this.strings["delimiter-precedes-last"] === "always") {
                this["with"].single.strings.prefix = this.strings.delimiter;
                this["with"].multiple.strings.prefix = this.strings.delimiter;
            } else if (this.strings["delimiter-precedes-last"] === "contextual") {
                this["with"].single.strings.prefix = with_default_prefix;
                this["with"].multiple.strings.prefix = this.strings.delimiter;
            } else if (this.strings["delimiter-precedes-last"] === "after-inverted-name") {
                this["with"].single.strings.prefix = this.strings.delimiter;
                this["with"].multiple.strings.prefix = with_default_prefix;
            } else {
                this["with"].single.strings.prefix = with_default_prefix;
                this["with"].multiple.strings.prefix = with_default_prefix;
            }
            func = function (state, Item, item) {
                if (state.tmp.etal_node) {
                    this.etal_style = state.tmp.etal_node;
                } else {
                    this.etal_style = "empty";
                }
                this.etal_term = state.getTerm(state.tmp.etal_term, "long", 0);
                if (CSL.STARTSWITH_ROMANESQUE_REGEXP.test(this.etal_term)) {
                    this.etal_prefix_single = " ";
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
                } else {
                    this.etal_prefix_single = "";
                    this.etal_prefix_multiple = "";
                    this.etal_suffix = "";
                }
                for (var i = 0, ilen = 3; i < ilen; i += 1) {
                    var key = ["family", "given"][i];
                    state.nameOutput[key] = this[key];
                }
                state.nameOutput["with"] = this["with"];
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
            func = function (state, Item) {
                if (!state.tmp.can_substitute.pop()) {
                    state.tmp.can_substitute.replace(false, CSL.LITERAL);
                }
                state.parallel.CloseVariable("names");
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
            this.successor_prefix = state[state.build.area].opt.layout_delimiter;
        }
        if ("undefined" === typeof this.splice_prefix) {
            this.splice_prefix = state[state.build.area].opt.layout_delimiter;
        }
        func = function (state, Item, item) {
            var i, ilen, newlst, lst;
            if (this.variables.length === 0) {
                return;
            }
            if ("undefined" === typeof item) {
                var item = {};
            }
            var varname, num, number, m, j, jlen;
            varname = this.variables[0];
            if (varname === "locator" && state.tmp.just_looking) {
                return;
            }
            state.parallel.StartVariable(this.variables[0]);
            if (this.variables[0] === "locator") {
                state.parallel.AppendToVariable(Item.section);
            } else {
                state.parallel.AppendToVariable(Item[this.variables[0]]);
            }
            var rex = new RegExp("(?:&|, | and |" + state.getTerm("page-range-delimiter") + ")");
            if (varname === 'collection-number' && Item.type === 'legal_case') {
                state.tmp.renders_collection_number = true;
            }
            var value = Item[this.variables[0]];
            var form = "long";
            if (this.strings.label_form_override) {
                form = this.strings.label_form_override;
            }
            if (varname === "locator"
                && item.locator) {
                item.locator = item.locator.replace(/([^\\])\s*-\s*/, "$1" + state.getTerm("page-range-delimiter"));
                m = item.locator.match(CSL.STATUTE_SUBDIV_GROUPED_REGEX);
                if (m) {
                    lst = item.locator.split(CSL.STATUTE_SUBDIV_PLAIN_REGEX);
                    for (i = 0, ilen = lst.length; i < ilen; i += 1) {
                        lst[i] = state.fun.page_mangler(lst[i]);
                    }
                    newlst = [lst[0]];
                    if (!this.strings.label_form_override && state.tmp.group_context.value()[5]) {
                        form = state.tmp.group_context.value()[5];
                    }
                    for (i = 1, ilen = lst.length; i < ilen; i += 1) {
                        var subplural = 0;
                        if (lst[i].match(rex)) {
                            subplural = 1;
                        }
                        var term = CSL.STATUTE_SUBDIV_STRINGS[m[i - 1].replace(/^\s*/,"")];
                        var myform = form;
                        if (item.section_label_count > i && item.section_form_override) {
                            myform = item.section_form_override;
                        }
                        newlst.push(state.getTerm(term, myform, subplural));
                        newlst.push(lst[i].replace(/^\s*/,""));
                    }
                    value = newlst.join(" ");
                    value = value.replace(/\\/, "", "g");
                    state.output.append(value, this);
                } else {
                    value = state.fun.page_mangler(item.locator);
                    value = value.replace(/\\/, "", "g");
                    state.output.append(value, this);
                }
            } else {
                var node = this;
                if (!state.tmp.shadow_numbers[varname] 
                    || (state.tmp.shadow_numbers[varname].values.length 
                        && state.tmp.shadow_numbers[varname].values[0][2] === false)) {
                    if (varname === "locator") {
                        state.processNumber(node, item, varname, Item.type);
                    } else {
                        state.processNumber(node, Item, varname, Item.type);
                    }
                }
                var values = state.tmp.shadow_numbers[varname].values;
                var blob;
                var newstr = "";
                var rangeType = "page";
                if (["bill","gazette","legislation","legal_case","treaty"].indexOf(Item.type) > -1
                    && varname === "collection-number") {
                    rangeType = "year";
                }
                if (((varname === "number" 
                      && ["bill","gazette","legislation","treaty"].indexOf(Item.type) > -1)
                     || state.opt[rangeType + "-range-format"]) 
                    && !this.strings.prefix && !this.strings.suffix
                    && !this.strings.form) {
                    for (i = 0, ilen = values.length; i < ilen; i += 1) {
                        newstr += values[i][1];
                    }
                }
                if (newstr && !newstr.match(/^[\-.\u20130-9]+$/)) {
                    if (varname === "number" 
                        && ["bill","gazette","legislation","treaty"].indexOf(Item.type) > -1) {
                        var firstword = newstr.split(/\s/)[0];
                        if (firstword) {
                            newlst = [];
                            m = newstr.match(CSL.STATUTE_SUBDIV_GROUPED_REGEX);
                            if (m) {
                                lst = newstr.split(CSL.STATUTE_SUBDIV_PLAIN_REGEX);
                                for (i = 1, ilen = lst.length; i < ilen; i += 1) {
                                    newlst.push(state.getTerm(CSL.STATUTE_SUBDIV_STRINGS[m[i - 1].replace(/^\s+/, "")], this.strings.label_form_override));
                                    newlst.push(lst[i].replace(/^\s+/, ""));
                                }
                                newstr = newlst.join(" ");
                            }
                        }
                    }
                    state.output.append(newstr, this);
                } else {
                    if (values.length) {
                        state.output.openLevel("empty");
                        for (i = 0, ilen = values.length; i < ilen; i += 1) {
                            blob = new CSL[values[i][0]](values[i][1], values[i][2], Item.id);
                            if (i > 0) {
                                blob.strings.prefix = blob.strings.prefix.replace(/^\s*/, "");
                            }
                            if (i < values.length - 1) {
                                blob.strings.suffix = blob.strings.suffix.replace(/\s*$/, "");
                            }
                            if ("undefined" === typeof blob.gender) {
                                blob.gender = state.locale[state.opt.lang]["noun-genders"][varname];
                            }
                            state.output.append(blob, "literal", false, false, true);
                        }
                        state.output.closeLevel("empty");
                    }
                }
            }
            if (varname === "locator") {
                state.tmp.done_vars.push("locator");
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
        target = state[state.build.root + "_sort"].tokens;
        if (this.tokentype === CSL.START) {
            if (state.build.area === "citation") {
                state.parallel.use_parallels = false;
                state.opt.sort_citations = true;
            }
            state.build.area = state.build.root + "_sort";
            state.build.extension = "_sort";
            var func = function (state, Item) {
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
            }
            this.execs.push(func);
        }
        if (this.tokentype === CSL.END) {
            state.build.area = state.build.root;
            state.build.extension = "";
            var func = function (state, Item) {
                if (state.opt.has_layout_locale) {
                    state.opt.lang = state.tmp.lang_sort_hold;
                    delete state.tmp.lang_sort_hold;
                }
            }
            this.execs.push(func);
        }
        target.push(this);
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
        if (this.postponed_macro) {
            return CSL.expandMacro.call(state, this);
        } else {
            CSL.Util.substituteStart.call(this, state, target);
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
                if (this.variables_real[0] === "citation-number") {
                    if (state.build.root === "citation") {
                        state.opt.update_mode = CSL.NUMERIC;
                    }
                    if (state.build.root === "bibliography") {
                        state.opt.bib_mode = CSL.NUMERIC;
                    }
                    if (state.build.area === "bibliography_sort") {
                        state.opt.citation_number_sort_used = true;
                    }
                    if ("citation-number" === state[state.tmp.area].opt.collapse) {
                        this.range_prefix = state.getTerm("citation-range-delimiter");
                    }
                    this.successor_prefix = state[state.build.area].opt.layout_delimiter;
                    this.splice_prefix = state[state.build.area].opt.layout_delimiter;
                    func = function (state, Item, item) {
                        id = "" + Item.id;
                        if (!state.tmp.just_looking) {
                            if (item && item["author-only"]) {
                                state.tmp.element_trace.replace("do-not-suppress-me");
                                var reference_term = state.getTerm("reference", "long", "singular");
                                if ("undefined" === typeof reference_term) {
                                    reference_term = "reference";
                                }
                                term = CSL.Output.Formatters["capitalize-first"](state, reference_term);
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
                                number = new CSL.NumericBlob(num, this, Item.id);
                                state.output.append(number, "literal");
                            }
                        }
                    };
                    this.execs.push(func);
                } else if (this.variables_real[0] === "year-suffix") {
                    state.opt.has_year_suffix = true;
                    if (state[state.tmp.area].opt.collapse === "year-suffix-ranged") {
                        this.range_prefix = state.getTerm("citation-range-delimiter");
                    }
                    this.successor_prefix = state[state.build.area].opt.layout_delimiter;
                    if (state[state.tmp.area].opt["year-suffix-delimiter"]) {
                        this.successor_prefix = state[state.build.area].opt["year-suffix-delimiter"];
                    }
                    func = function (state, Item) {
                        if (state.registry.registry[Item.id] && state.registry.registry[Item.id].disambig.year_suffix !== false && !state.tmp.just_looking) {
                            num = parseInt(state.registry.registry[Item.id].disambig.year_suffix, 10);
                            number = new CSL.NumericBlob(num, this, Item.id);
                            formatter = new CSL.Util.Suffixator(CSL.SUFFIX_CHARS);
                            number.setFormatter(formatter);
                            state.output.append(number, "literal");
                            firstoutput = false;
                            len = state.tmp.group_context.mystack.length;
                            for (pos = 0; pos < len; pos += 1) {
                                flag = state.tmp.group_context.mystack[pos];
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
                } else if (this.variables_real[0] === "citation-label") {
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
                    func = function (state, Item, item) {
                        var gender = state.opt.gender[Item.type];
                        var term = this.strings.term;
                        term = state.getTerm(term, form, plural, gender, false, ("accessed" === term));
                        var myterm;
                        if (term !== "") {
                            flag = state.tmp.group_context.value();
                            flag[0] = true;
                            state.tmp.group_context.replace(flag);
                        }
                        if (!state.tmp.term_predecessor && !(state.opt["class"] === "in-text" && state.tmp.area === "citation")) {
                            myterm = CSL.Output.Formatters["capitalize-first"](state, term);
                        } else {
                            myterm = term;
                        }
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
                    func = function (state, Item, item) {
                        var parallel_variable = this.variables[0];
                        if (parallel_variable === "title" 
                            && (form === "short" || Item["title-short"])) { 
                            parallel_variable = "title-short";
                        }
                        state.parallel.StartVariable(parallel_variable);
                        state.parallel.AppendToVariable(Item[parallel_variable],parallel_variable);
                    };
                    this.execs.push(func);
                    if (CSL.MULTI_FIELDS.indexOf(this.variables_real[0]) > -1) {
                        var abbrevfam = this.variables[0];
                        var abbrfall = false;
                        var altvar = false;
                        var transfall = false;
                        if (form === "short") {
                            if (this.variables_real[0] === "container-title") {
                                altvar = "journalAbbreviation";
                            } else if (this.variables_real[0] === "title") {
                                altvar = "title-short";
                            }
                        } else {
                            abbrevfam = false;
                        }
                        if (state.build.extension) {
                            transfall = true;
                        } else {
                            transfall = true;
                            abbrfall = true;
						}
                        func = state.transform.getOutputFunction(this.variables, abbrevfam, abbrfall, altvar, transfall);
                    } else {
                        if (CSL.CITE_FIELDS.indexOf(this.variables_real[0]) > -1) {
                            func = function (state, Item, item) {
                                if (item && item[this.variables[0]]) {
                                    var value = "" + item[this.variables[0]];
                                    value = value.replace(/([^\\])--*/g,"$1"+state.getTerm("page-range-delimiter"));
                                    value = value.replace(/\\-/g,"-");
                                    state.output.append(value, this, false, false, true);
                                    if (this.variables[0] === "locator-revision") { 
                                        state.tmp.done_vars.push("locator-revision");
                                    }
                                }
                            };
                        } else if (this.variables_real[0] === "page-first") {
                            func = function (state, Item) {
                                var idx, value;
                                value = state.getVariable(Item, "page-first", form);
                                if (value) {
                                    value = value.replace("\\", "");
                                    state.output.append(value, this, false, false, true);
                                }
                            };
                        } else  if (this.variables_real[0] === "page") {
                            func = function (state, Item) {
                                var value = state.getVariable(Item, "page", form);
                                if (value) {
                                    value = ""+value;
                                    value = value.replace(/([^\\])--*/g,"$1"+state.getTerm("page-range-delimiter"));
                                    value = value.replace(/\\-/g,"-");
                                    value = state.fun.page_mangler(value);
                                    state.output.append(value, this, false, false, true);
                                }
                            };
                        } else if (this.variables_real[0] === "volume") {
                            func = function (state, Item) {
                                if (this.variables[0]) {
                                    var value = state.getVariable(Item, this.variables[0], form);
                                    if (value) {
                                        state.output.append(value, this);
                                    }
                                }
                            };
                        } else if (["URL", "DOI"].indexOf(this.variables_real[0]) > -1) {
                            func = function (state, Item) {
                                var value;
                                if (this.variables[0]) {
                                    value = state.getVariable(Item, this.variables[0], form);
                                    if (value) {
                                        if (state.opt.development_extensions.wrap_url_and_doi) {
                                            if (!this.decorations.length || this.decorations[0][0] !== "@" + this.variables[0]) {
                                                this.decorations = [["@" + this.variables[0], "true"]].concat(this.decorations);
                                            }
                                        } else {
                                            if (this.decorations.length && this.decorations[0][0] === "@" + this.variables[0]) {
                                                this.decorations = this.decorations.slice(1);
                                            }
                                        }
                                        state.output.append(value, this, false, false, true);
                                    }
                                }
                            };
                        } else if (this.variables_real[0] === "section") {
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
                                    state.tmp.group_context.value()[2] = true;
                                }
                            }
                        } else {
                            func = function (state, Item) {
                                var value;
                                if (this.variables[0]) {
                                    value = state.getVariable(Item, this.variables[0], form);
                                    if (value) {
                                        value = "" + value;
                                        value = value.replace("\\", "", "g");
                                        state.output.append(value, this);
                                    }
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
                        flag = state.tmp.group_context.value();
                        flag[0] = true;
                        state.tmp.group_context.replace(flag);
                        state.output.append(this.strings.value, this);
                    };
                    this.execs.push(func);
                }
            }
            target.push(this);
            CSL.Util.substituteEnd.call(this, state, target);
        }
    }
};
CSL.Attributes = {};
CSL.Attributes["@genre"] = function (state, arg) {
    arg = arg.replace("-", " ");
    var func = function (Item, item) {
        var ret;
        if (arg === Item.genre) {
            return true;
        }
        return false;
    }
    this.tests.push(func);
}
CSL.Attributes["@disambiguate"] = function (state, arg) {
    if (arg === "true") {
        state.opt.has_disambiguate = true;
        var func = function (Item, item) {
            state.tmp.disambiguate_maxMax += 1;
            if (state.tmp.disambig_settings.disambiguate
                && state.tmp.disambiguate_count < state.tmp.disambig_settings.disambiguate) {
                state.tmp.disambiguate_count += 1;
                return true;
            }
            return false;
        };
        this.tests.push(func);
    } else if (arg === "check-ambiguity-and-backreference") {
        var func = function (Item, item) {
            if (state.registry.registry[Item.id].disambig.disambiguate && state.registry.registry[Item.id]["citation-count"] > 1) {
                return true;
            }
            return false;
        };
        this.tests.push(func);
    }
};
CSL.Attributes["@is-numeric"] = function (state, arg, joiner) {
    var variables = arg.split(/\s+/);
    var maketest = function(variable) {
        return function (Item, item) {
            var myitem = Item;
            if (["locator","locator-revision"].indexOf(variable) > -1) {
                myitem = item;
            }
            if ("undefined" === typeof myitem) {
                return false;
            }
            if (CSL.NUMERIC_VARIABLES.indexOf(variable) > -1) {
                if (!state.tmp.shadow_numbers[variable]) {
                    state.processNumber(false, myitem, variable, Item.type);
                }
                if (myitem[variable] && state.tmp.shadow_numbers[variable].numeric) {
                    return true;
                }
            } else if (["title", "locator-revision","version"].indexOf(variable) > -1) {
                if (myitem[variable]) {
                    if (myitem[variable].slice(-1) === "" + parseInt(myitem[variable].slice(-1), 10)) {
                        return true;
                    }
                }
            }
            return false;
        }
    }
    for (var i=0; i<variables.length; i+=1) {
        this.tests.push(maketest(variables[i]));
    }
};
CSL.Attributes["@is-uncertain-date"] = function (state, arg) {
    var variables = arg.split(/\s+/);
    var maketest = function (myvariable) {
        return function(Item, item) {
            if (Item[myvariable] && Item[myvariable].circa) {
                return true;
            } else {
                return false;
            }
        }
    }
    for (var i=0,ilen=variables.length;i<ilen;i+=1) {
        this.tests.push(maketest(variables[i]));
    };
};
CSL.Attributes["@locator"] = function (state, arg) {
    var trylabels = arg.replace("sub verbo", "sub-verbo");
    trylabels = trylabels.split(/\s+/);
    var maketest = function (trylabel) {
        return function(Item, item) {
            var label;
            if ("undefined" === typeof item || !item.label) {
                label = "page";
            } else if (item.label === "sub verbo") {
                label = "sub-verbo";
            } else {
                label = item.label;
            }
            if (trylabel === label) {
                return true;
            } else {
                return false;
            }
        }
    }
    for (var i=0,ilen=trylabels.length;i<ilen;i+=1) {
        this.tests.push(maketest(trylabels[i]));
    }
};
CSL.Attributes["@position"] = function (state, arg) {
    var tryposition;
    state.opt.update_mode = CSL.POSITION;
    state.parallel.use_parallels = true;
    var trypositions = arg.split(/\s+/);
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
        }
    }
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
            this.tests.push(function (Item, item) {
                if (item && item.position >= CSL.POSITION_SUBSEQUENT && item["near-note"]) {
                    return true;
                }
                return false;
            });
        } else {
            this.tests.push(maketest(tryposition));
        }
    }
};
CSL.Attributes["@type"] = function (state, arg) {
    var types = arg.split(/\s+/);
    var maketest = function (mytype) {
        return function(Item,item) {
            var ret = (Item.type === mytype);
            if (ret) {
                return true;
            } else {
                return false;
            }
        }
    }
    var tests = [];
    for (var i=0,ilen=types.length;i<ilen;i+=1) {
        tests.push(maketest(types[i]));
    }
    this.tests.push(state.fun.match.any(this, state, tests));
};
CSL.Attributes["@variable"] = function (state, arg) {
    var func;
    this.variables = arg.split(/\s+/);
    this.variables_real = this.variables.slice();
    if ("label" === this.name && this.variables[0]) {
        this.strings.term = this.variables[0];
    } else if (["names", "date", "text", "number"].indexOf(this.name) > -1) {
        func = function (state, Item, item) {
            variables = this.variables_real.slice();
            for (var i = this.variables.length - 1; i > -1; i += -1) {
                this.variables.pop();
            }
            len = variables.length;
            for (pos = 0; pos < len; pos += 1) {
                if (state.tmp.done_vars.indexOf(variables[pos]) === -1 && !(item && Item.type === "legal_case" && item["suppress-author"] && variables[pos] === "title")) {
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
                if (variable === "authority"
                    && "string" === typeof Item[variable]
                    && "names" === this.name) {
                    var creatorParent = {
                        family:Item[variable],
                        isInstitution:true,
                        multi:{
                            _key:{}
                        }
                    };
                    if (Item.multi && Item.multi._keys && Item.multi._keys[variable]) {
                        for (var langTag in Item.multi._keys[variable]) {
                            creatorChild = {
                                family:Item.multi._keys[variable][langTag],
                                isInstitution:true
                            }
                            creatorParent.multi._key[langTag] = creatorChild;
                        }
                    }
                    Item[variable] = [creatorParent];
                }
                if (this.strings.form === "short" && !Item[variable]) {
                    if (variable === "title") {
                        variable = "title-short";
                    } else if (variable === "container-title") {
                        variable = "journalAbbreviation";
                    }
                }
                if (variable === "year-suffix") {
                    output = true;
                    break;
                } else if (CSL.DATE_VARIABLES.indexOf(variable) > -1) {
                    if (state.opt.development_extensions.locator_date_and_revision && "locator-date" === variable) {
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
                } else if ("locator-revision" === variable) {
                    if (item && item["locator-revision"]) {
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
                    if (Item[variable].length) {
                    }
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
            flag = state.tmp.group_context.value();
            if (output) {
                if (variable !== "citation-number" || state.tmp.area !== "bibliography") {
                    state.tmp.cite_renders_content = true;
                }
                flag[2] = true;
                state.tmp.group_context.replace(flag);
                if (state.tmp.can_substitute.value() 
                    && state.tmp.area === "bibliography"
                    && "string" === typeof Item[variable]) {
                    state.tmp.rendered_name.push(Item[variable]);
                }
                state.tmp.can_substitute.replace(false,  CSL.LITERAL);
            } else {
                flag[1] = true;
            }
        };
        this.execs.push(func);
    } else if (["if",  "else-if", "condition"].indexOf(this.name) > -1) {
        var maketest = function (variable) {
            return function(Item,item){
                var myitem = Item;
                if (item && ["locator", "locator-revision", "first-reference-note-number", "locator-date"].indexOf(variable) > -1) {
                    myitem = item;
                }
                if (variable === "hereinafter" && state.sys.getAbbreviation && myitem.id) {
                    if (state.transform.abbrevs["default"].hereinafter[myitem.id]) {
                        return true;
                    }
                } else if (myitem[variable]) {
                    if ("number" === typeof myitem[variable] || "string" === typeof myitem[variable]) {
                        return true;
                    } else if ("object" === typeof myitem[variable]) {
                        for (key in myitem[variable]) {
                            if (myitem[variable][key]) {
                                return true;
                            }
                        }
                    }
                }
                return false;
            }
        }
        for (var i=0,ilen=this.variables.length;i<ilen;i+=1) {
            this.tests.push(maketest(this.variables[i]));
        }
    }
};
CSL.Attributes["@page"] = function (state, arg) {
    var trylabels = arg.replace("sub verbo", "sub-verbo");
    trylabels = trylabels.split(/\s+/);
    var maketest = function (trylabel) {
        return function(Item, item) {
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
        }
    }
    for (var i=0,ilen=trylabels.length;i<ilen;i+=1) {
        this.tests.push(maketest(trylabels[i]));
    }
};
CSL.Attributes["@jurisdiction"] = function (state, arg) {
    var tryjurisdictions = arg.split(/\s+/);
    for (var i=0,ilen=tryjurisdictions.length;i<ilen;i+=1) {
        tryjurisdictions[i] = tryjurisdictions[i].split(";");
    }
    var maketests = function (tryjurisdiction) {
        return function(Item,item){
            if (!Item.jurisdiction) {
                return false;
            }
            var jurisdictions = Item.jurisdiction.split(";");
            for (var i=0,ilen=jurisdictions.length;i<ilen;i+=1) {
                jurisdictions[i] = jurisdictions[i].split(";");
            }
            for (i=tryjurisdiction.length;i>0;i+=-1) {
                var tryjurisdictionStr = tryjurisdiction.slice(0,i).join(";");
                var jurisdiction = jurisdictions.slice(0,i).join(";");
                if (tryjurisdictionStr !== jurisdiction) {
                    return false;
                }
            }
            return true;
        }
    }
    for (var i=0,ilen=tryjurisdictions.length;i<ilen;i+=1) {
        var tryjurisdictionSlice = tryjurisdictions[i].slice();
        this.tests.push(maketests(tryjurisdictionSlice));
    }
};
CSL.Attributes["@context"] = function (state, arg) {
    var func = function (Item, item) {
		var area = state.tmp.area.slice(0, arg.length);
		if (area === arg) {
			return true;
		}
		return false;
    };
    this.tests.push(func);
};
CSL.Attributes["@has-year-only"] = function (state, arg) {
    var trydates = arg.split(/\s+/);
    var maketest = function (trydate) {
        return function(Item,item){
            var date = Item[trydate];
            if (!date || date.month || date.season) {
                return false;
            } else {
                return true;
            }
        }
    }
    for (var i=0,ilen=trydates.length;i<ilen;i+=1) {
        this.tests.push(maketest(trydates[i]));
    }
};
CSL.Attributes["@has-to-month-or-season"] = function (state, arg) {
    var trydates = arg.split(/\s+/);
    var maketest = function (trydate) {
        return function(Item,item){
            var date = Item[trydate];
            if (!date || (!date.month && !date.season) || date.day) {
                return false;
            } else {
                return true;
            }
        }
    }
    for (var i=0,ilen=trydates.length;i<ilen;i+=1) {
        this.tests.push(maketest(trydates[i]));
    }
};
CSL.Attributes["@has-day"] = function (state, arg) {
    var trydates = arg.split(/\s+/);
    var maketest = function (trydate) {
        return function(Item,item){
            var date = Item[trydate];
            if (!date || !date.day) {
                return false;
            } else {
                return true;
            }
        }
    }
    for (var i=0,ilen=trydates.length;i<ilen;i+=1) {
        this.tests.push(maketest(trydates[i]));
    };
};
CSL.Attributes["@subjurisdictions"] = function (state, arg) {
    var trysubjurisdictions = parseInt(arg, 10);
    var func = function (Item, item) {
        var subjurisdictions = 0;
        if (Item.jurisdiction) {
            subjurisdictions = Item.jurisdiction.split(";").length;
        }
        if (subjurisdictions) {
            subjurisdictions += -1;
        }
        if (subjurisdictions >= trysubjurisdictions) {
            return true;
        }
        return false;
    };
    this.tests.push(func);
};
CSL.Attributes["@is-plural"] = function (state, arg) {
    var func = function (Item, item) {
        var nameList = Item[arg];
        if (nameList && nameList.length) {
            var persons = 0;
            var institutions = 0;
            var last_is_person = false;
            for (var i = 0, ilen = nameList.length; i < ilen; i += 1) {
                if (nameList[i].isInstitution && (nameList[i].literal || (nameList[i].family && !nameList[i].given))) {
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
    var func, ret, len, pos, variable, myitem, langspec, lang, lst, i, ilen, fallback;
    var locale_default = state.opt["default-locale"][0];
    if (this.name === "layout") {
        this.locale_raw = arg;
        if (this.tokentype === CSL.START) {
            var locales = arg.split(/\s+/);
            var sort_locale = {};
            var localeMaster = CSL.localeResolve(locales[0], locale_default);
            if (localeMaster.generic) {
                sort_locale[localeMaster.generic] = localeMaster.best;
            } else {
                sort_locale[localeMaster.best] = localeMaster.best;
            }
            for (var i=1,ilen=locales.length;i<ilen;i+=1) {
                var localeServant = CSL.localeResolve(locales[i], locale_default);
                if (localeServant.generic) {
                    sort_locale[localeServant.generic] = localeMaster.best;
                } else {
                    sort_locale[localeServant.best] = localeMaster.best;
                }
            }
            state[state.build.area].opt.sort_locales.push(sort_locale);
        }
        state.opt.has_layout_locale = true;
    } else {
        lst = arg.split(/\s+/);
        var locale_bares = [];
        for (i = 0, ilen = lst.length; i < ilen; i += 1) {
            lang = lst[i];
            langspec = CSL.localeResolve(lang, locale_default);
            if (lst[i].length === 2) {
                locale_bares.push(langspec.bare);
            }
            state.localeConfigure(langspec, true);
            lst[i] = langspec;
        }
        var locale_list = lst.slice();
        var maketest = function (locale_list, locale_default,locale_bares) {
            return function (Item, item) {
                var key, res;
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
                        res = true;
                        break;
                    }
                }
                if (!res && locale_bares.indexOf(langspec.bare) > -1) {
                    res = true;
                }
                return res;
            }
        }
        this.tests.push(maketest(locale_list,locale_default,locale_bares));
    }
};
CSL.Attributes["@locale-internal"] = function (state, arg) {
    var func, ret, len, pos, variable, myitem, langspec, lang, lst, i, ilen, fallback;
        lst = arg.split(/\s+/);
        this.locale_bares = [];
        for (i = 0, ilen = lst.length; i < ilen; i += 1) {
            lang = lst[i];
            langspec = CSL.localeResolve(lang, state.opt["default-locale"][0]);
            if (lst[i].length === 2) {
                this.locale_bares.push(langspec.bare);
            }
            state.localeConfigure(langspec);
            lst[i] = langspec;
        }
        this.locale_default = state.opt["default-locale"][0];
        this.locale = lst[0].best;
        this.locale_list = lst.slice();
        var maketest = function (me) {
            return function (Item, item) {
                var key, res;
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
                    for (i = 0, ilen = me.locale_list.length; i < ilen; i += 1) {
                        if (langspec.best === me.locale_list[i].best) {
                            state.opt.lang = me.locale;
                            state.tmp.last_cite_locale = me.locale;
                            state.output.openLevel("empty");
                            state.output.current.value().new_locale = me.locale;
                            res = true;
                            break;
                        }
                    }
                    if (!res && me.locale_bares.indexOf(langspec.bare) > -1) {
                        state.opt.lang = me.locale;
                        state.tmp.last_cite_locale = me.locale;
                        state.output.openLevel("empty");
                        state.output.current.value().new_locale = me.locale;
                        res = true;
                    }
                }
                return res;
            }
        }
        var me = this;
        this.tests.push(maketest(me));
}
CSL.Attributes["@is-parallel"] = function (state, arg) {
    var values = arg.split(" ");
    for (var i = 0, ilen = values.length; i < ilen; i += 1) {
        if (values[i] === "true") {
            values[i] = true;
        } else if (values[i] === "false") {
            values[i] = false;
        }
    }
    this.strings.set_parallel_condition = values;
};
CSL.Attributes["@gender"] = function (state, arg) {
    this.gender = arg;
}
CSL.Attributes["@cslid"] = function (state, arg) {
    this.cslid = parseInt(arg, 10);
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
    if (arg === "sub verbo") {
        this.strings.term = "sub-verbo";
    } else {
        this.strings.term = arg;
    }
};
CSL.Attributes["@xmlns"] = function (state, arg) {};
CSL.Attributes["@lang"] = function (state, arg) {
    if (arg) {
        state.build.lang = arg;
    }
};
CSL.Attributes["@lingo"] = function (state, arg) {
};
CSL.Attributes["@macro-has-date"] = function (state, arg) {
    this["macro-has-date"] = true;
};
CSL.Attributes["@suffix"] = function (state, arg) {
    this.strings.suffix = arg;
};
CSL.Attributes["@prefix"] = function (state, arg) {
    this.strings.prefix = arg;
};
CSL.Attributes["@delimiter"] = function (state, arg) {
    if ("name" == this.name) {
        this.strings.name_delimiter = arg;
    } else {
        this.strings.delimiter = arg;
    }
};
CSL.Attributes["@match"] = function (state, arg) {
    this.match = arg;
};
CSL.Attributes["@names-min"] = function (state, arg) {
    var val = parseInt(arg, 10);
    if (state[state.tmp.area].opt.max_number_of_names < val) {
        state[state.tmp.area].opt.max_number_of_names = val;
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
CSL.Attributes["@number"] = function (state, arg) {
    var func;
    var trylabels = arg.replace("sub verbo", "sub-verbo");
    trylabels = trylabels.split(/\s+/);
    if (["if",  "else-if"].indexOf(this.name) > -1) {
        func = function (state, Item, item) {
            var ret = [];
            var label;
            state.processNumber(false, Item, "number", Item.type);
            if (!state.tmp.shadow_numbers.number.label) {
                label = "number";
            } else if (state.tmp.shadow_numbers.number.label === "sub verbo") {
                label = "sub-verbo";
            } else {
                label = state.tmp.shadow_numbers.number.label;
            }
            for (var i = 0, ilen = trylabels.length; i < ilen; i += 1) {
                if (trylabels[i] === label) {
                    ret.push(true);
                } else {
                    ret.push(false);
                }
            }
            return ret;
        };
        this.tests.push(func);
    }
};
CSL.Attributes["@has-publisher-and-publisher-place"] = function (state, arg) {
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
CSL.Attributes["@newdate"] = function (state, arg) {
};
CSL.Attributes["@givenname-disambiguation-rule"] = function (state, arg) {
    if (CSL.GIVENNAME_DISAMBIGUATION_RULES.indexOf(arg) > -1) {
        state.citation.opt["givenname-disambiguation-rule"] = arg;
    }
};
CSL.Attributes["@collapse"] = function (state, arg) {
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
    if (state[state.tmp.area].opt.max_number_of_names < val) {
        state[state.tmp.area].opt.max_number_of_names = val;
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
    if (state[state.tmp.area].opt.max_number_of_names < val) {
        state[state.tmp.area].opt.max_number_of_names = val;
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
CSL.Attributes["@text-case"] = function (state, arg) {
    var func = function (state, Item) {
        if (arg === "normal") {
            this.text_case_normal = true;
        } else {
            this.strings["text-case"] = arg;
            if (arg === "title") {
                var m = false;
                var default_locale = state.opt["default-locale"][0].slice(0, 2);
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
    var lst, len, pos, m, ret;
    m = arg.match(/-x-(sort|translit|translat)-/g);
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
};
CSL.Attributes["@default-locale-sort"] = function (state, arg) {
    var lst, len, pos, m, ret;
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
CSL.Attributes["@oops"] = function (state, arg) {
    this.strings.oops = arg;
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
    this.strings.cls = arg;
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
CSL.Parallel = function (state) {
    this.state = state;
    this.sets = new CSL.Stack([]);
    this.try_cite = true;
    this.use_parallels = false;
    this.midVars = ["section", "volume", "container-title", "collection-number", "issue", "page-first", "page", "number"];
    this.ignoreVarsLawGeneral = ["first-reference-note-number", "locator", "label","page-first","page","genre"];
    this.ignoreVarsLawProceduralHistory = ["issued", "first-reference-note-number", "locator", "label","page-first","page","genre","jurisdiction"];
    this.ignoreVarsOrders = ["first-reference-note-number"];
    this.ignoreVarsOther = ["first-reference-note-number", "locator", "label","section","page-first","page"];
};
CSL.Parallel.prototype.isMid = function (variable) {
    return (this.midVars.indexOf(variable) > -1);
};
CSL.Parallel.prototype.StartCitation = function (sortedItems, out) {
    this.parallel_conditional_blobs_list = [];
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
        this.master_was_neutral_cite = true;
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
        var has_required_var = false;
        for (var i = 0, ilen = CSL.PARALLEL_MATCH_VARS.length; i < ilen; i += 1) {
            if (Item[CSL.PARALLEL_MATCH_VARS[i]]) {
                has_required_var = true;
                break;
            }
        }
        var basics_ok = true;
        var last_cite = this.sets.value().slice(-1)[0];
        if (last_cite && last_cite.Item) {
            if (last_cite.Item.title !== Item.title) {
                basics_ok = false;
            } else if (last_cite.Item.type !== Item.type) {
                basics_ok = false;
            } else if (["article-journal","article-magazine"].indexOf(Item.type) > -1) {
                if (!this.state.opt.development_extensions.handle_parallel_articles
                   || last_cite.Item["container-title"] !== Item["container-title"]) {
                    basics_ok = false;
                }
            }
        }
        if (!basics_ok || !has_required_var || CSL.PARALLEL_TYPES.indexOf(Item.type) === -1) {
            this.try_cite = true;
            if (this.in_series) {
                this.in_series = false;
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
        if (["treaty"].indexOf(Item.type) > -1) {
            this.ignoreVars = this.ignoreVarsOrders;
        } else if (["article-journal","article-magazine"].indexOf(Item.type) > -1) {
            this.ignoreVars = this.ignoreVarsOther;
        } else if (item && item.prefix) {
            this.ignoreVars = this.ignoreVarsLawProceduralHistory;
            this.cite.useProceduralHistory = true;
            var prev = this.sets.value()[(this.sets.value().length - 1)];
            if (prev && prev.back) {
                for (var i=prev.back.length-1;i>-1;i+=-1) {
                    if (prev.back[i] && prev[prev.back[i]]) {
                        delete prev[prev.back[i]];
                    }
                }
            }
        } else {
            this.ignoreVars = this.ignoreVarsLawGeneral;
        }
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
        } else if (this.state.registry.registry[Item.id]) {
            this.state.registry.registry[Item.id].parallel = false;
        } else {
            this.try_cite = false;
            this.force_collapse = false;
            return;
        }
        this.force_collapse = false;
        if (this.state.registry.registry[Item.id].parallel) {
            this.force_collapse = true;
        }
    }
};
CSL.Parallel.prototype.StartVariable = function (variable, real_variable) {
    if (this.use_parallels && (this.try_cite || this.force_collapse)) {
        if (variable === "names") {
            this.variable = variable + ":" + this.target;
        } else {
            this.variable = variable;
        }
        if (this.ignoreVars.indexOf(variable) > -1) {
            return;
        }
        if (variable === "container-title" && this.sets.value().length === 0) {
            this.master_was_neutral_cite = false;
        }
        this.data = {};
        this.data.value = "";
        this.data.blobs = [];
        var is_mid = this.isMid(variable);
        if (real_variable === "authority" && this.variable === "names:front") {
            this.try_cite = true;
            this.in_series = false;
        } else if (this.target === "front" && is_mid) {
            this.target = "mid";
        } else if (this.target === "mid" && !is_mid && this.cite.Item.title && variable !== "names") {
            this.target = "back";
        } else if (this.target === "back" && is_mid) {
            this.try_cite = true;
            this.in_series = false;
        }
        if (variable === "number") {
            this.cite.front.push(this.variable);
        } else if (CSL.PARALLEL_COLLAPSING_MID_VARSET.indexOf(variable) > -1) {
            if (["article-journal","article-magazine"].indexOf(this.cite.Item.type) > -1) {
                this.cite.mid.push(this.variable);
            } else {
                this.cite.front.push(this.variable);
            }
        } else {
            this.cite[this.target].push(this.variable);
        }
   }
};
CSL.Parallel.prototype.AppendBlobPointer = function (blob) {
    if (this.use_parallels) {
        if (this.ignoreVars.indexOf(this.variable) > -1) {
            return;
        }
        if (this.use_parallels && (this.force_collapse || this.try_cite)) {
            if (["article-journal", "article-magazine"].indexOf(this.cite.Item.type) > -1) {
                if (["volume","page","page-first","issue"].indexOf(this.variable) > -1) {
                    return;
                }
                if ("container-title" === this.variable && this.cite.mid.length > 1) {
                    return;
                }
            }
            if (this.variable && (this.try_cite || this.force_collapse) && blob && blob.blobs) {
                if (!(this.cite.useProceduralHistory && this.target === "back")) {
                    this.data.blobs.push([blob, blob.blobs.length]);
                }
            }
        }
    }
};
CSL.Parallel.prototype.AppendToVariable = function (str, varname) {
    if (this.use_parallels) {
        if (this.ignoreVars.indexOf(this.variable) > -1) {
            return;
        }
        if (this.try_cite || this.force_collapse) {
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
    }
};
CSL.Parallel.prototype.CloseVariable = function () {
    if (this.use_parallels) {
        if (this.ignoreVars.indexOf(this.variable) > -1) {
            return;
        }
        if (this.try_cite || this.force_collapse) {
            this.cite[this.variable] = this.data;
            if (this.sets.value().length > 0) {
                var prev = this.sets.value()[(this.sets.value().length - 1)];
                if (this.target === "front" && this.variable === "issued") {
                    if (this.data.value && this.master_was_neutral_cite) {
                        this.target = "mid";
                    }
                }
                if (this.target === "front") {
                    if ((prev[this.variable] || this.data.value) && (!prev[this.variable] || this.data.value !== prev[this.variable].value)) {
                        if ("issued" !== this.variable) {
                            this.in_series = false;
                        }
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
                        if (this.data.value !== prev[this.variable].value 
                            && this.sets.value().slice(-1)[0].back_forceme.indexOf(this.variable) === -1) {
                            this.in_series = false;
                        }
                    }
                }
            }
        }
        this.variable = false;
    }
};
CSL.Parallel.prototype.CloseCite = function () {
    var x, pos, len, has_issued, use_journal_info, volume_pos, container_title_pos, section_pos;
    if (this.use_parallels && (this.force_collapse || this.try_cite)) {
        use_journal_info = false;
        if (!this.cite.front_collapse["container-title"]) {
            use_journal_info = true;
        }
        if (this.cite.front_collapse.volume === false) {
            use_journal_info = true;
        }
        if (this.cite.front_collapse["collection-number"] === false) {
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
            collection_number_pos = this.cite.front.indexOf("collection-number");
            if (collection_number_pos > -1) {
                this.cite.front = this.cite.front.slice(0,collection_number_pos).concat(this.cite.front.slice(collection_number_pos + 1));
            }
        }
        if (!this.in_series && !this.force_collapse) {
            this.ComposeSet(true);
        }
        if (this.sets.value().length === 0) {
            has_date = false;
            for (pos = 0, len = this.cite.back.length; pos < len; pos += 1) {
                x = this.cite.back[pos];
                if (x === "issued" && this.cite["issued"] && this.cite["issued"].value) {
                    has_date = true;
                    break;
                }
            }
            if (!has_date) {
                this.cite.back_forceme.push("issued");
            }
        } else {
            var idx = this.cite.front.indexOf("issued");
            if (idx === -1 || this.master_was_neutral_cite) {
                this.cite.back_forceme = this.sets.value().slice(-1)[0].back_forceme;
            }
            if (idx > -1) {
                var prev = this.sets.value()[this.sets.value().length - 1];
                if (!prev["issued"]) {
                    this.cite.front = this.cite.front.slice(0, idx).concat(this.cite.front.slice(idx + 1));
                }
            }
            if (this.master_was_neutral_cite && this.cite.mid.indexOf("names:mid") > -1) {
                this.cite.front.push("names:mid");
            }
        }
        this.sets.value().push(this.cite);
    }
};
CSL.Parallel.prototype.ComposeSet = function (next_output_in_progress) {
    var cite, pos, master, len;
    if (this.use_parallels && (this.force_collapse || this.try_cite)) {
        var lengthCheck = this.sets.value().length;
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
                        this.state.registry.registry[cite.itemId].parallel = false;
                    } else {
                        if (cite.prevItemID) {
                            if (!this.state.registry.registry[cite.prevItemID].parallel) {
                                this.state.registry.registry[cite.itemId].parallel = cite.prevItemID;
                            } else {
                                this.state.registry.registry[cite.itemId].parallel = this.state.registry.registry[cite.prevItemID].parallel;
                            }
                            this.state.registry.registry[cite.itemId].siblings = this.state.registry.registry[cite.prevItemID].siblings;
                            if (!this.state.registry.registry[cite.itemId].siblings) {
                                this.state.registry.registry[cite.itemId].siblings = [];
                                CSL.debug("WARNING: adding missing siblings array to registry object");
                            }
                            this.state.registry.registry[cite.itemId].siblings.push(cite.itemId);
                        }
                    }
                }
            }
            this.sets.push([]);
        }
        if (lengthCheck < 2) {
            this.purgeGroupsIfParallel(false);
        } else {
            this.purgeGroupsIfParallel(true);
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
                    this.state.tmp.has_purged_parallel = true;
                    if (b[0] && b[0].strings && "string" == typeof b[0].strings.oops
                        && b[0].parent && b[0].parent) {
                        b[0].parent.parent.strings.delimiter = b[0].strings.oops;
                    }
                }
            }
        }
    }
};
CSL.Parallel.prototype.purgeGroupsIfParallel = function (original_condition) {
    for (var i = this.parallel_conditional_blobs_list.length - 1; i > -1; i += -1) {
        var obj = this.parallel_conditional_blobs_list[i];
        var purgeme = true;
        for (var j = 0, jlen = obj.conditions.length; j < jlen; j += 1) {
            if (!(!obj.conditions[j] === !!original_condition
                || ("master" === obj.conditions[j]
                    && !this.state.registry.registry[obj.id].master)
                || ("servant" === obj.conditions[j]
                    && !this.state.registry.registry[obj.id].parallel))) {
                var purgeme = false;
                break;
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
}
CSL.Util = {};
CSL.Util.Match = function () {
    this.any = function (token, state, tests) {
        return function (Item, item) {
            for (var i=0, ilen=tests.length; i < ilen; i += 1) {
                result = tests[i](Item, item);
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
                result = tests[i](Item,item);
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
                result = tests[i](Item,item);
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
                result = tests[i](Item,item);
                if (!result) {
                    return true;
                }
            }
            return false;
        };
    };
};
CSL.Transform = function (state) {
    var debug = false, abbreviations, token, fieldname, abbrev_family, opt;
    this.abbrevs = {};
    this.abbrevs["default"] = new state.sys.AbbreviationSegments();
    this.getTextSubField = getTextSubField;
    function abbreviate(state, Item, altvar, basevalue, myabbrev_family, use_field) {
        var value;
        if (!myabbrev_family) {
            return basevalue;
        }
        var variable = myabbrev_family;
        var noHints = false;
        if (["title", "title-short"].indexOf(variable) > -1 && !Item.jurisdiction) {
            noHints = true;
        }
        if (CSL.NUMERIC_VARIABLES.indexOf(myabbrev_family) > -1) {
            myabbrev_family = "number";
        }
        if (["publisher-place", "event-place", "jurisdiction", "archive-place"].indexOf(myabbrev_family) > -1) {
            myabbrev_family = "place";
        }
        if (["publisher", "authority"].indexOf(myabbrev_family) > -1) {
            myabbrev_family = "institution-part";
        }
        if (["genre", "event", "medium", "title-short"].indexOf(myabbrev_family) > -1) {
            myabbrev_family = "title";
        }
        if (["archive"].indexOf(myabbrev_family) > -1) {
            myabbrev_family = "collection-title";
        }
        value = "";
        if (state.sys.getAbbreviation) {
            var jurisdiction = state.transform.loadAbbreviation(Item.jurisdiction, myabbrev_family, basevalue, Item.type, noHints);
            if (state.transform.abbrevs[jurisdiction][myabbrev_family] && basevalue && state.sys.getAbbreviation) {
                if (state.transform.abbrevs[jurisdiction][myabbrev_family][basevalue]) {
                    value = state.transform.abbrevs[jurisdiction][myabbrev_family][basevalue].replace("{stet}",basevalue);
                }
            }
        }
        if (!value 
            && (!state.opt.development_extensions.require_explicit_legal_case_title_short || Item.type !== 'legal_case') 
            && altvar && Item[altvar] && use_field) {
            value = Item[altvar];
        }
        if (!value) {
            value = basevalue;
        }
        if (value && value.slice(0, 10) === "!here>>>") {
            if (variable === "jurisdiction" && ["treaty", "patent"].indexOf(variable) > -1) {
                value = value.slice(10);
            } else {
                value = false;
            }
        } 
        return value;
    }
    function getFieldLocale(Item,field) {
        var ret = state.opt["default-locale"][0].slice(0, 2)
        var localeRex;
        if (state.opt.development_extensions.strict_text_case_locales) {
            localeRex = new RegExp("^([a-zA-Z]{2})(?:$|-.*| .*)");
        } else {
            localeRex = new RegExp("^([a-zA-Z]{2})(?:$|-.*|.*)");
        }
        if (Item.language) {
            m = ("" + Item.language).match(localeRex);
            if (m) {
                ret = m[1];
            } else {
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
    };
    function getTextSubField(Item, field, locale_type, use_default, stopOrig) {
        var m, lst, opt, o, oo, pos, key, ret, len, myret, opts;
        var usedOrig = stopOrig;
        if (!Item[field]) {
            return {name:"", usedOrig:stopOrig};
        }
        ret = {name:"", usedOrig:stopOrig,locale:getFieldLocale(Item,field)};
        opts = state.opt[locale_type];
        if (locale_type === 'locale-orig') {
            if (stopOrig) {
                ret = {name:"", usedOrig:stopOrig};
            } else {
                ret = {name:Item[field], usedOrig:false, locale:getFieldLocale(Item,field)};
            }
            return ret;
        } else if (use_default && ("undefined" === typeof opts || opts.length === 0)) {
            return {name:Item[field], usedOrig:true, locale:getFieldLocale(Item,field)};
        }
        for (var i = 0, ilen = opts.length; i < ilen; i += 1) {
            opt = opts[i];
            o = opt.split(/[\-_]/)[0];
            if (opt && Item.multi && Item.multi._keys[field] && Item.multi._keys[field][opt]) {
                ret.name = Item.multi._keys[field][opt];
                ret.locale = o;
                break;
            } else if (o && Item.multi && Item.multi._keys[field] && Item.multi._keys[field][o]) {
                ret.name = Item.multi._keys[field][o];
                ret.locale = o;
                break;
            }
        }
        if (!ret.name && use_default) {
            ret = {name:Item[field], usedOrig:true, locale:getFieldLocale(Item,field)};
        }
        return ret;
    }
    function loadAbbreviation(jurisdiction, category, orig, itemType, noHints) {
        var pos, len;
        if (!jurisdiction) {
            jurisdiction = "default";
        }
        if (!orig) {
            if (!state.transform.abbrevs[jurisdiction]) {
                state.transform.abbrevs[jurisdiction] = new state.sys.AbbreviationSegments();
            }
            return jurisdiction;
        }
        if (state.sys.getAbbreviation) {
            var tryList = ['default'];
            if (jurisdiction !== 'default') {
                var workLst = jurisdiction.split(/\s*;\s*/);
                for (var i=0, ilen=workLst.length; i < ilen; i += 1) {
                    tryList.push(workLst.slice(0,i+1).join(';'));
                }
            }
            for (var i=tryList.length - 1; i > -1; i += -1) {
                if (!state.transform.abbrevs[tryList[i]]) {
                    state.transform.abbrevs[tryList[i]] = new state.sys.AbbreviationSegments();
                }
                if (!state.transform.abbrevs[tryList[i]][category][orig]) {
                    state.sys.getAbbreviation(state.opt.styleID, state.transform.abbrevs, tryList[i], category, orig, itemType, noHints);
                }
                if (state.transform.abbrevs[tryList[i]][category][orig]) {
                    if (i < tryList.length) {
                        state.transform.abbrevs[jurisdiction][category][orig] = state.transform.abbrevs[tryList[i]][category][orig];
                    }
                    break;
                }
            }
        }
        return jurisdiction;
    }
    this.loadAbbreviation = loadAbbreviation;
    function publisherCheck (tok, Item, primary, myabbrev_family) {
        var varname = tok.variables[0];
        if (state.publisherOutput && primary) {
            if (["publisher","publisher-place"].indexOf(varname) === -1) {
                return false;
            } else {
                state.publisherOutput[varname + "-token"] = tok;
                state.publisherOutput.varlist.push(varname);
                var lst = primary.split(/;\s*/);
                if (lst.length === state.publisherOutput[varname + "-list"].length) {
                    state.publisherOutput[varname + "-list"] = lst;
                }
                for (var i = 0, ilen = lst.length; i < ilen; i += 1) {
                    lst[i] = abbreviate(state, Item, false, lst[i], myabbrev_family, true);
                }
                state.tmp[varname + "-token"] = tok;
                return true;
            }
        }
        return false;
    }
    function getOutputFunction(variables, myabbrev_family, abbreviation_fallback, alternative_varname, transform_fallback) {
        var localesets;
        var langPrefs = CSL.LangPrefsMap[variables[0]];
        if (!langPrefs) {
            localesets = false;
        } else {
            localesets = state.opt['cite-lang-prefs'][langPrefs];
        }
        return function (state, Item, item, usedOrig) {
            var primary, primary_locale, secondary, secondary_locale, tertiary, tertiary_locale, primary_tok, group_tok, key;
            if (!variables[0] || (!Item[variables[0]] && !Item[alternative_varname])) {
                return null;
            }
            if (state.opt.suppressJurisdictions
                && variables[0] === "jurisdiction" 
                && state.opt.suppressJurisdictions[Item.jurisdiction]
                && ["legal_case","gazette","regulation","legislation"].indexOf(Item.type) > -1) {
                return null;
            }
            var slot = {primary:false, secondary:false, tertiary:false};
            if (state.tmp.area.slice(-5) === "_sort") {
                slot.primary = 'locale-sort';
            } else {
                if (localesets) {
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
            if ((state.tmp.area !== "bibliography"
                 && !(state.tmp.area === "citation"
                      && state.opt.xclass === "note"
                      && item && !item.position))) {
                slot.secondary = false;
                slot.tertiary = false;
            }
            if (state.tmp["publisher-list"]) {
                if (variables[0] === "publisher") {
                    state.tmp["publisher-token"] = this;
                } else if (variables[0] === "publisher-place") {
                    state.tmp["publisher-place-token"] = this;
                }
                return null;
            }
            var res = getTextSubField(Item, variables[0], slot.primary, true);
            primary = res.name;
            primary_locale = res.locale;
            var primaryUsedOrig = res.usedOrig;
            if (publisherCheck(this, Item, primary, myabbrev_family)) {
                return null;
            }
            secondary = false;
            tertiary = false;
            if (slot.secondary) {
                res = getTextSubField(Item, variables[0], slot.secondary, false, res.usedOrig);
                secondary = res.name;
                secondary_locale = res.locale;
            }
            if (slot.tertiary) {
                res = getTextSubField(Item, variables[0], slot.tertiary, false, res.usedOrig);
                tertiary = res.name;
                tertiary_locale = res.locale;
            }
            if (myabbrev_family) {
                primary = abbreviate(state, Item, alternative_varname, primary, myabbrev_family, true);
                if (primary) {
                    primary = quashCheck(primary);
                }
                secondary = abbreviate(state, Item, false, secondary, myabbrev_family, true);
                tertiary = abbreviate(state, Item, false, tertiary, myabbrev_family, true);
            }
            var template_tok = CSL.Util.cloneToken(this);
            var primary_tok = CSL.Util.cloneToken(this);
            var primaryPrefix;
            if (slot.primary === "locale-translit") {
                primaryPrefix = state.opt.citeAffixes[langPrefs][slot.primary].prefix;
            }                
            if (primaryPrefix === "<i>" && variables[0] === 'title' && !primaryUsedOrig) {
                var hasItalic = false;
                for (var i = 0, ilen = primary_tok.decorations.length; i < ilen; i += 1) {
                    if (primary_tok.decorations[i][0] === "@font-style"
                        && primary_tok.decorations[i][1] === "italic") {
                        hasItalic = true;
                    }
                }
                if (!hasItalic) {
                    primary_tok.decorations.push(["@font-style", "italic"])
                }
            }
            if (primary_locale !== "en" && primary_tok.strings["text-case"] === "title") {
                primary_tok.strings["text-case"] = "passthrough";
            }
            if ("title" === variables[0]) {
                primary = CSL.demoteNoiseWords(state, primary, this["leading-noise-words"]);
            }
            if (secondary || tertiary) {
                state.output.openLevel("empty");
                primary_tok.strings.suffix = primary_tok.strings.suffix.replace(/[ .,]+$/,"");
                state.output.append(primary, primary_tok);
                if (secondary) {
                    secondary_tok = CSL.Util.cloneToken(template_tok);
                    secondary_tok.strings.prefix = state.opt.citeAffixes[langPrefs][slot.secondary].prefix;
                    secondary_tok.strings.suffix = state.opt.citeAffixes[langPrefs][slot.secondary].suffix;
                    if (!secondary_tok.strings.prefix) {
                        secondary_tok.strings.prefix = " ";
                    }
                    for (var i = secondary_tok.decorations.length - 1; i > -1; i += -1) {
                        if (['@quotes/true','@font-style/italic','@font-style/oblique','@font-weight/bold'].indexOf(secondary_tok.decorations[i].join('/')) > -1) {
                            secondary_tok.decorations = secondary_tok.decorations.slice(0, i).concat(secondary_tok.decorations.slice(i + 1))
                        }
                    }
                    if (secondary_locale !== "en" && secondary_tok.strings["text-case"] === "title") {
                        secondary_tok.strings["text-case"] = "passthrough";
                    }
                    state.output.append(secondary, secondary_tok);
                    var blob_obj = state.output.current.value();
                    var blobs_pos = state.output.current.value().blobs.length - 1;
                    if (state.parallel.use_parallels) {
                        state.parallel.cite.front.push(variables[0] + ":secondary");
                        state.parallel.cite[variables[0] + ":secondary"] = {blobs:[[blob_obj, blobs_pos]]};
                    }
                }
                if (tertiary) {
                    tertiary_tok = CSL.Util.cloneToken(template_tok);
                    tertiary_tok.strings.prefix = state.opt.citeAffixes[langPrefs][slot.tertiary].prefix;
                    tertiary_tok.strings.suffix = state.opt.citeAffixes[langPrefs][slot.tertiary].suffix;
                    if (!tertiary_tok.strings.prefix) {
                        tertiary_tok.strings.prefix = " ";
                    }
                    for (var i = tertiary_tok.decorations.length - 1; i > -1; i += -1) {
                        if (['@quotes/true','@font-style/italic','@font-style/oblique','@font-weight/bold'].indexOf(tertiary_tok.decorations[i].join('/')) > -1) {
                            tertiary_tok.decorations = tertiary_tok.decorations.slice(0, i).concat(tertiary_tok.decorations.slice(i + 1))
                        }
                    }
                    if (tertiary_locale !== "en" && tertiary_tok.strings["text-case"] === "title") {
                        tertiary_tok.strings["text-case"] = "passthrough";
                    }
                    state.output.append(tertiary, tertiary_tok);
                    var blob_obj = state.output.current.value();
                    var blobs_pos = state.output.current.value().blobs.length - 1;
                    if (state.parallel.use_parallels) {
                        state.parallel.cite.front.push(variables[0] + ":tertiary");
                        state.parallel.cite[variables[0] + ":tertiary"] = {blobs:[[blob_obj, blobs_pos]]};
                    }
                }
                state.output.closeLevel();
            } else {
                state.output.append(primary, primary_tok);
            }
            return null;
        };
    }
    this.getOutputFunction = getOutputFunction;
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
};
CSL.Token = function (name, tokentype) {
    this.name = name;
    this.strings = {};
    this.strings.delimiter = undefined;
    this.strings.prefix = "";
    this.strings.suffix = "";
    this.decorations = [];
    this.variables = [];
    this.execs = [];
    this.tokentype = tokentype;
    this.evaluator = false;
    this.tests = [];
    this.rawtests = [];
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
    if (token.variables) {
        newtok.variables = token.variables.slice();
    }
    if (token.execs) {
        newtok.execs = token.execs.slice();
        newtok.tests = token.tests.slice();
        newtok.rawtests = token.tests.slice();
    }
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
CSL.Blob = function (str, token, levelname) {
    var len, pos, key;
    this.levelname = levelname;
    if (token) {
        this.strings = {"prefix":"","suffix":""};
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
    } else if (str) {
        this.blobs = [str];
    } else {
        this.blobs = [];
    }
    this.alldecor = [this.decorations];
};
CSL.Blob.prototype.push = function (blob) {
    if ("string" === typeof this.blobs) {
        throw "Attempt to push blob onto string object";
    } else if (false !== blob) {
        blob.alldecor = blob.alldecor.concat(this.alldecor);
        this.blobs.push(blob);
    }
};
CSL.NumericBlob = function (num, mother_token, id) {
    this.id = id;
    this.alldecor = [];
    this.num = num;
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
    var form, variable, datexml, subnode, partname, attr, val, prefix, suffix, children, key, subchildren, kkey, display, cslid;
    this.build.date_key = true;
    form = this.sys.xml.getAttributeValue(node, "form");
    var lingo;
    if ("accessed" === this.sys.xml.getAttributeValue(node, "variable")) {
        lingo = this.opt["default-locale"][0];
    } else {
        lingo = this.sys.xml.getAttributeValue(node, "lingo");
    }
    if (!this.getDate(form)) {
        return parent;
    }
    var dateparts = this.sys.xml.getAttributeValue(node, "date-parts");
    variable = this.sys.xml.getAttributeValue(node, "variable");
    prefix = this.sys.xml.getAttributeValue(node, "prefix");
    suffix = this.sys.xml.getAttributeValue(node, "suffix");
    display = this.sys.xml.getAttributeValue(node, "display");
    cslid = this.sys.xml.getAttributeValue(node, "cslid");
    datexml = this.sys.xml.nodeCopy(this.getDate(form, ("accessed" === variable)));
    this.sys.xml.setAttribute(datexml, 'lingo', this.opt.lang);
    this.sys.xml.setAttribute(datexml, 'form', form);
    this.sys.xml.setAttribute(datexml, 'date-parts', dateparts);
    this.sys.xml.setAttribute(datexml, "cslid", cslid);
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
                        if (lingo && lingo !== this.opt.lang) {
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
CSL.dateMacroAsSortKey = function (state, Item) {
    CSL.dateAsSortKey.call(this, state, Item, true);
};
CSL.dateAsSortKey = function (state, Item, isMacro) {
    var dp, elem, value, e, yr, prefix, i, ilen, num;
    var variable = this.variables[0];
    var macroFlag = "empty";
    if (isMacro) {
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
        dp = state.fun.dateparser.parse(dp.raw);
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
            prefix = "Y";
            if (yr[0] === "-") {
                prefix = "X";
                yr = yr.slice(1);
                yr = 9999 - parseInt(yr, 10);
            }
            state.output.append(CSL.Util.Dates[elem.slice(0, 4)].numeric(state, (prefix + yr)), macroFlag);
        } else {
            value = CSL.Util.Dates[e]["numeric-leading-zeros"](state, value);
            if (!value) {
                value = "00";
            }
            state.output.append(value, macroFlag);
        }
    }
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
            for (var i = 0, ilen = dp.length; i < ilen; i += 1) {
                for (var j = 0, jlen = CSL.DATE_PARTS.length; j < jlen; j += 1) {
                    if ("undefined" === typeof dp[i][j]) {
                        ret[(CSL.DATE_PARTS[j] + exts[i])] = dp[i][j];
                    } else {
                        ret[(CSL.DATE_PARTS[j] + exts[i])] = parseInt(dp[i][j], 10);
                    }
                }
            }
        } else if (date_obj.hasOwnProperty(field)) {
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
CSL.Util.Names = {};
CSL.Util.Names.compareNamesets = CSL.NameOutput.prototype._compareNamesets;
CSL.Util.Names.unInitialize = function (state, name) {
    var i, ilen, namelist, punctlist, ret;
    if (!name) {
        return "";
    }
    namelist = name.split(/(?:\-|\s+)/);
    punctlist = name.match(/(\-|\s+)/g);
    ret = "";
    for (i = 0, ilen = namelist.length; i < ilen; i += 1) {
        if (CSL.ALL_ROMANESQUE_REGEXP.exec(namelist[i].slice(0,-1)) 
            && namelist[i] 
            && namelist[i] !== namelist[i].toUpperCase()) {
            namelist[i] = namelist[i].slice(0, 1) + namelist[i].slice(1, 2).toLowerCase() + namelist[i].slice(2);
        }
        ret += namelist[i];
        if (i < ilen - 1) {
            ret += punctlist[i];
        }
    }
    return ret;
};
CSL.Util.Names.initializeWith = function (state, name, terminator, normalizeOnly) {
    var i, ilen, j, jlen, n, m, mm, str, lst, ret;
    if (!name) {
        return "";
    }
    if (["Lord", "Lady"].indexOf(name) > -1
        || (!name.match(CSL.STARTSWITH_ROMANESQUE_REGEXP)
            && !terminator.match("%s"))) {
        return name;
    }
    if (!terminator) {
        terminator = "";
    }
    var namelist = name;
    if (state.opt["initialize-with-hyphen"] === false) {
        namelist = namelist.replace(/\-/g, " ");
    }
    namelist = namelist.replace(/\s*\-\s*/g, "-").replace(/\s+/g, " ");
    namelist = namelist.replace(/-([a-z])/g, "\u2013$1");
    mm = namelist.match(/[\-\s]+/g);
    lst = namelist.split(/[\-\s]+/);
    if (lst.length === 0) {
        namelist = mm;
    } else {
        namelist = [lst[0]];
        for (i = 1, ilen = lst.length; i < ilen; i += 1) {
            namelist.push(mm[i - 1]);
            namelist.push(lst[i]);
        }
    }
    lst = namelist;
    for (i = lst.length -1; i > -1; i += -1) {
        if (lst[i] && lst[i].slice(0, -1).indexOf(".") > -1) {
            var lstend = lst.slice(i + 1);
            var lstmid = lst[i].slice(0, -1).split(".");
            lst = lst.slice(0, i);
            for (j = 0, jlen = lstmid.length; j < jlen; j += 1) {
                lst.push(lstmid[j] + ".");
                if (j < lstmid.length - 1) {
                    lst.push(" ");
                }
            }
            lst = lst.concat(lstend);
        }
    }
    if (normalizeOnly) {
        ret = CSL.Util.Names.doNormalize(state, lst, terminator);
    } else {
        ret = CSL.Util.Names.doInitialize(state, lst, terminator);
    }
    ret = ret.replace(/\u2013([a-z])/g, "-$1");
    return ret;
};
CSL.Util.Names.doNormalize = function (state, namelist, terminator, mode) {
    var i, ilen;
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
    var ret = [];
    for (i = 0, ilen = namelist.length; i < ilen; i += 2) {
        if (isAbbrev[i]) {
            if (i < namelist.length - 2) {
                namelist[i + 1] = "";
                if ((!terminator || terminator.slice(-1) && terminator.slice(-1) !== " ")
                    && namelist[i].length && namelist[i].match(CSL.ALL_ROMANESQUE_REGEXP)
                    && (namelist[i].length > 1 || namelist[i + 2].length > 1)) {
                    namelist[i + 1] = " ";
                }
                namelist[i] = namelist[i] + terminator;
            }
            if (i === namelist.length - 1) {
                namelist[i] = namelist[i] + terminator;
            }
        }
    }
    return namelist.join("").replace(/\s+$/,"");
};
CSL.Util.Names.doInitialize = function (state, namelist, terminator, mode) {
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
        if (m && m[1] === m[1].toUpperCase()) {
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
    var ret = namelist.join("");
    ret = ret.replace(/\s+$/,"").replace(/\s*\-\s*/g, "-").replace(/\s+/g, " ");
    return ret;
};
CSL.Util.Names.getRawName = function (name) {
    var ret = [];
    if (name.given) {
        ret.push(name.given);
    }
    if (name.family) {
        ret.push(name.family);
    }
    return ret.join(" ");
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
CSL.Util.Dates.year.imperial = function (state, num, end, makeShort) {
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
        if (!state.transform.abbrevs['default']['number'][label]) {
            state.transform.loadAbbreviation('default', "number", label);
        }
        if (state.transform.abbrevs['default']['number'][label]) {
            label = state.transform.abbrevs['default']['number'][label];
        };
        year = label + (num - offset);
    }
    return year;
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
        if (res.num < 1 || res.num > 20) {
            res.num = 0;
        } else if (res.num > 16) {
            res.stub = "season-";
            res.num = res.num - 16;
        } else if (res.num > 12) {
            res.stub = "season-";
            res.num = res.num - 12;
        }
        ret = res;
    } else {
        if (num < 1 || num > 12) {
            num = 0;
        }
        ret = num;
    }
    return ret;
}
CSL.Util.Dates.month = {};
CSL.Util.Dates.month.numeric = function (state, num) {
    var num = CSL.Util.Dates.normalizeMonth(num);
    if (!num) {
        num = "";
    }
    return num;
};
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
    func = function (state, Item) {
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
    nodetypes = ["number", "date", "names"];
    if (("text" === this.name && !this.postponed_macro) || nodetypes.indexOf(this.name) > -1) {
        element_trace = function (state, Item, item) {
            if (state.tmp.element_trace.value() === "author" || "names" === this.name) {
                if (item && item["author-only"]) {
                    state.tmp.element_trace.push("do-not-suppress-me");
                } else if (item && item["suppress-author"]) {
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
    if (state.build.substitute_level.value() === 1) {
        choose_start = new CSL.Token("choose", CSL.START);
        CSL.Node.choose.build.call(choose_start, state, target);
        if_start = new CSL.Token("if", CSL.START);
        func = function (Item,item) {
            if (state.tmp.can_substitute.value()) {
                return true;
            }
            return false;
        };
        if_start.tests.push(func);
        if_start.test = state.fun.match.any(this, state, if_start.tests);
        target.push(if_start);
    }
    if (state.sys.variableWrapper
        && this.variables_real
        && this.variables_real.length) {
        func = function (state, Item, item) {
            if (!state.tmp.just_looking && !state.tmp.suppress_decorations) {
                variable_entry = new CSL.Token("text", CSL.START);
                variable_entry.decorations = [["@showid", "true"]];
                state.output.startTag("variable_entry", variable_entry);
                var position = null;
                if (item) {
                    position = item.position;
                }
                if (!position) position = 0;
                var positionMap = [
                    "first",
                    "subsequent",
                    "ibid",
                    "ibid-with-locator"
                ]
                var noteNumber = 0;
                if (item && item.noteIndex) {
                    noteNumber = item.noteIndex;
                }
                var firstReferenceNoteNumber = 0;
                if (item && item['first-reference-note-number']) {
                    firstReferenceNoteNumber = item['first-reference-note-number'];
                }
                var citationNumber = 0;
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
        }
        this.execs.push(func);
    }
};
CSL.Util.substituteEnd = function (state, target) {
    var func, bib_first_end, bib_other, if_end, choose_end, toplevel, hasval, author_substitute, str;
    if (state.sys.variableWrapper
        && (this.hasVariable || (this.variables_real && this.variables_real.length))) {
        func = function (state,Item) {
            if (!state.tmp.just_looking && !state.tmp.suppress_decorations) {
                state.output.endTag("variable_entry");
            }
        }
        this.execs.push(func);
    }
    func = function (state, Item) {
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
            func = function (state, Item) {
                state.output.endTag("bib_first");
            };
            this.execs.push(func);
            state.build.cls = false;
        } else if (state.build.area === "bibliography" && state.bibliography.opt["second-field-align"]) {
            bib_first_end = new CSL.Token("group", CSL.END);
            func = function (state, Item) {
                if (!state.tmp.render_seen) {
                    state.output.endTag(); // closes bib_first
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
    var subrule = state[state.build.area].opt["subsequent-author-substitute-rule"];
    if (toplevel && hasval) {
        author_substitute = new CSL.Token("text", CSL.SINGLETON);
        func = function (state, Item) {
            var i, ilen;
            var printing = !state.tmp.suppress_decorations;
            if (printing && state.tmp.area === "bibliography" && state.tmp.subsequent_author_substitute_ok) {
                if (state.tmp.rendered_name) {
                    if ("partial-each" === subrule || "partial-first" === subrule) {
                        var dosub = true;
                        var rendered_name = [];
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
                        state.tmp.last_rendered_name = rendered_name;
                    } else if ("complete-each" === subrule) {
                        var rendered_name = state.tmp.rendered_name.join(",");
                        if (rendered_name) {
                            if (!rendered_name.localeCompare(state.tmp.last_rendered_name)) {
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
                            if (!rendered_name.localeCompare(state.tmp.last_rendered_name)) {
                                str = new CSL.Blob(state[state.tmp.area].opt["subsequent-author-substitute"]);
                                if (state.tmp.label_blob) {
                                    state.tmp.name_node.top.blobs = [str,state.tmp.label_blob];
                                } else {
                                    state.tmp.name_node.top.blobs = [str];
                                }
                            }
                            state.tmp.last_rendered_name = rendered_name;
                        }
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
CSL.Util.Suffixator = function (slist) {
    if (!slist) {
        slist = CSL.SUFFIX_CHARS;
    }
    this.slist = slist.split(",");
};
CSL.Util.Suffixator.prototype.format = function (N) {
    var X;
    N += 1;
    var key = "";
    do {
        X = ((N % 26) === 0) ? 26 : (N % 26);
        key = this.slist[X-1] + key;
        N = (N - X) / 26;
    } while ( N !== 0 );
    return key;
};
CSL.Engine.prototype.processNumber = function (node, ItemObject, variable, type) {
    var num, m, i, ilen, j, jlen;
    var debug = false;
    if (this.tmp.shadow_numbers[variable]) {
        if (this.tmp.shadow_numbers[variable].numeric) {
            for (var i = 0, ilen = this.tmp.shadow_numbers[variable].values.length; i < ilen; i += 2) {
                this.tmp.shadow_numbers[variable].values[i][2] = node;
            }
        }
        return;
    }
    this.tmp.shadow_numbers[variable] = {};
    this.tmp.shadow_numbers[variable].values = [];
    this.tmp.shadow_numbers[variable].plural = 0;
    this.tmp.shadow_numbers[variable].numeric = false;
    this.tmp.shadow_numbers[variable].label = false;
    if (!ItemObject) {
        return;
    }
    var languageRole = CSL.LangPrefsMap[variable];
    if (languageRole) {
        var localeType = this.opt["cite-lang-prefs"][languageRole][0];
        num = this.transform.getTextSubField(ItemObject, variable, "locale-"+localeType, true);
        num = num.name;
    } else {
        num = ItemObject[variable];
    }
    if (num && this.sys.getAbbreviation) {
        num = ("" + num).replace(/^\"/, "").replace(/\"$/, "");
        var jurisdiction = this.transform.loadAbbreviation(ItemObject.jurisdiction, "number", num);
        if (this.transform.abbrevs[jurisdiction].number[num]) {
            num = this.transform.abbrevs[jurisdiction].number[num];
        } else {
            if ("undefined" !== typeof this.transform.abbrevs[jurisdiction].number[num]) {
                delete this.transform.abbrevs[jurisdiction].number[num];
            }
        }
    }
    if ("undefined" !== typeof num) {
        if ("number" === typeof num) {
            num = "" + num;
        }
        this.tmp.shadow_numbers[variable].label = variable;
        if (num.slice(0, 1) === '"' && num.slice(-1) === '"') {
            num = num.slice(1, -1);
        }
        if (num && ["number-of-volumes","number-of-pages"].indexOf(variable) > -1) {
            var m = num.match(/[^0-9]*([0-9]+).*/);
            if (m) {
                this.tmp.shadow_numbers[variable].numeric = true;
                if (m[1] !== "1") {
                    this.tmp.shadow_numbers[variable].plural = 1;
                }
            }
        }
        if ("locator" === variable
            && ["bill","gazette","legislation","treaty"].indexOf(type) > -1) {
            num = num.split(CSL.STATUTE_SUBDIV_PLAIN_REGEX)[0];
        }
        var rangeType = "page";
        if (["bill","gazette","legislation","legal_case","treaty"].indexOf(type) > -1
            && variable === "collection-number") {
            rangeType = "year";
        }
        if (["page", "page-first"].indexOf(variable) > -1) {
            var m = num.split(" ")[0].match(CSL.STATUTE_SUBDIV_GROUPED_REGEX);
            if (m){
                if (this.opt.development_extensions.static_statute_locator) {
                    this.tmp.shadow_numbers[variable].label = CSL.STATUTE_SUBDIV_STRINGS[m[0]];
                }
                var mm = num.match(/[^ ]+\s+(.*)/);
                if (mm) {
                    num = mm[1];
                }
            }
        }
        var lst = num.split(/(?:,\s+|\s*\\*[\-\u2013]+\s*|\s*&\s*)/);
        var m = num.match(/(,\s+|\s*\\*[\-\u2013]+\s*|\s*&\s*)/g);
        var elements = [];
        for (var i = 0, ilen = lst.length - 1; i < ilen; i += 1) {
            elements.push(lst[i]);
            elements.push(m[i]);
        }
        elements.push(lst[lst.length - 1]);
        var count = 0;
        var numeric = true;
        for (var i = 0, ilen = elements.length; i < ilen; i += 1) {
            var odd = ((i%2) === 0);
            if (odd) {
                if (elements[i]) {
                    if (elements[i].match(/(?:[0-9]|[xivcmlXIVCML])/)) {
                        if (elements[i - 1] && elements[i - 1].match(/^\s*\\*[\-\u2013]+\s*$/)) {
                            var middle = this.tmp.shadow_numbers[variable].values.slice(-1);
                            if (middle[0][1].indexOf("\\") == -1) {
                                if (elements[i - 2] && ("" + elements[i - 2]).match(/(:?[a-zA-Z]*[0-9]+$|^[ivxlcmIVXLCM]+$)/)
                                    && elements[i].match(/(?:^[a-zA-Z]*[0-9]+|^[ivxlcmIVXLCM]+$)/)) {
                                    var start = this.tmp.shadow_numbers[variable].values.slice(-2);
                                    middle[0][1] = this.getTerm(rangeType + "-range-delimiter");
                                    if (this.opt[rangeType + "-range-format"] ) {
                                        var newstr = this.fun[rangeType + "_mangler"](start[0][1] +"-"+elements[i]);
                                        newstr = newstr.split(this.getTerm(rangeType + "-range-delimiter"));
                                        elements[i] = newstr[1];
                                    }
                                    count = count + 1;
                                }
                                if (middle[0][1].indexOf("--") > -1) {
                                    middle[0][1] = middle[0][1].replace(/--*/, "\u2013");
                                }
                            } else {
                                middle[0][1] = middle[0][1].replace(/\\/, "", "g");
                            }
                        } else if (elements[i].indexOf(" ") === -1) {
                            count = count + 1;
                        }
                    }
                    var subelements = elements[i].split(/\s+/);
                    for (var j = 0, jlen = subelements.length; j < jlen; j += 1) {
                        if (this.opt.development_extensions.strict_page_numbers
                            && variable === "page"
                            && !subelements[j].match(/^-*[0-9]/)) {
                            numeric = false;
                        } else if (!subelements[j].match(/[-0-9]/)) {
                            numeric = false;
                        }
                    }
                    if (elements[i].match(/^[1-9][0-9]*$/)) {
                        elements[i] = parseInt(elements[i], 10);
                        if (node && "undefined" === typeof node.gender) {
                            node.gender = this.locale[this.opt.lang]["noun-genders"][variable];
                            if (!node.gender) {
                                node.gender = "";
                            }
                        }
                        this.tmp.shadow_numbers[variable].values.push(["NumericBlob", elements[i], node]);
                    } else {
                        var str = elements[i];
                        this.tmp.shadow_numbers[variable].values.push(["Blob", str, node]);
                    }
                }
            } else {
                if (elements[i]) {
                    this.tmp.shadow_numbers[variable].values.push(["Blob", elements[i], undefined]);
                }
            }
        };
        if (this.opt.development_extensions.strict_page_numbers && variable === "page") {
            if (num.indexOf(" ") === -1 && num.match(/^-*[0-9]/)) {
                this.tmp.shadow_numbers[variable].numeric = true;
            } else {
                this.tmp.shadow_numbers[variable].numeric = numeric;
            }
        } else {
            if (num.indexOf(" ") === -1 && num.match(/[0-9]/)) {
                this.tmp.shadow_numbers[variable].numeric = true;
            } else {
                this.tmp.shadow_numbers[variable].numeric = numeric;
            }
        }
        if (!this.tmp.shadow_numbers[variable].numeric) {
            this.transform.loadAbbreviation(ItemObject.jurisdiction, "number", num);
        }
        if (count > 1) {
            this.tmp.shadow_numbers[variable].plural = 1;
        }
        if (ItemObject.force_pluralism === 1) {
            this.tmp.shadow_numbers[variable].plural = 1;
        } else if (ItemObject.force_pluralism === 0) {
            this.tmp.shadow_numbers[variable].plural = 0;
        }
    }
};
CSL.Util.PageRangeMangler = {};
CSL.Util.PageRangeMangler.getFunction = function (state, rangeType) {
    var rangerex, pos, len, stringify, listify, expand, minimize, minimize_internal, chicago, lst, m, b, e, ret, begin, end, ret_func, ppos, llen;
    var range_delimiter = state.getTerm(rangeType + "-range-delimiter");
    rangerex = /([a-zA-Z]*)([0-9]+)\s*(?:\u2013|-)\s*([a-zA-Z]*)([0-9]+)/;
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
        var hyphens = "\\s+\\-\\s+";
        var delimRex = new RegExp("([^\\\\])[" + range_delimiter + "\\u2013]", "g");
        str = str.replace(delimRex, "$1 - ").replace(/\s+-\s+/g, " - ");
        var rexm = new RegExp("([a-zA-Z]*[0-9]+" + hyphens + "[a-zA-Z]*[0-9]+)", "g");
        var rexlst = new RegExp("[a-zA-Z]*[0-9]+" + hyphens + "[a-zA-Z]*[0-9]+");
        m = str.match(rexm);
        lst = str.split(rexlst);
        if (lst.length === 0) {
            ret = m;
        } else {
            ret = [lst[0]];
            for (pos = 1, len = lst.length; pos < len; pos += 1) {
                ret.push(m[pos - 1].replace(/\s*\-\s*/, "-", "g"));
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
                        m[3] = range_delimiter + m[1];
                        lst[pos] = m.slice(1);
                    }
                }
            }
            if ("string" === typeof lst[pos]) {
                lst[pos] = lst[pos].replace("-", range_delimiter, "g");
            }
        }
        return lst;
    };
    minimize = function (lst, minchars, isyear) {
        len = lst.length;
        for (var i = 1, ilen = lst.length; i < ilen; i += 2) {
            lst[i][3] = minimize_internal(lst[i][1], lst[i][3], minchars, isyear);
            if (lst[i][2].slice(1) === lst[i][0]) {
                lst[i][2] = range_delimiter;
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
    var sniff = function (str, func, minchars, isyear) {
        var ret;
		str = "" + str;
		var lst = expand(str);
        var ret = func(lst, minchars, isyear);
        return ret;
    }
    if (!state.opt[rangeType + "-range-format"]) {
        ret_func = function (str) {
            return str;
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
CSL.Util.FlipFlopper = function (state) {
    var tagdefs, pos, len, p, entry, allTags, ret, def, esc, makeHashes, closeTags, flipTags, openToClose, openToDecorations, okReverse, hashes, allTagsLst, lst;
    this.state = state;
    this.blob = false;
    this.quotechars = ['"', "'"];
    tagdefs = [
        ["<i>", "</i>", "italics", "@font-style", ["italic", "normal","normal"], true],
        ["<b>", "</b>", "bold", "@font-weight", ["bold", "normal","normal"], true],
        ["<sup>", "</sup>", "superscript", "@vertical-align", ["sup", "sup","baseline"], true],
        ["<sub>", "</sub>", "subscript", "@vertical-align", ["sub", "sub","baseline"], true],
        ["<sc>", "</sc>", "smallcaps", "@font-variant", ["small-caps", "small-caps","normal"], true],
        ["<span style=\"font-variant:small-caps;\">", "</span>", "smallcaps", "@font-variant", ["small-caps", "normal","normal"], true],
        ["<span class=\"nocase\">", "</span>", "passthrough", "@passthrough", ["true", "true","true"], true],
        ["<span class=\"nodecor\">", "</span>", "passthrough", "@passthrough", ["true", "true","true"], true],
        ['"',  '"',  "quotes",  "@quotes",  ["true",  "inner","true"],  "'"],
        [" '",  "'",  "quotes",  "@quotes",  ["inner",  "true","true"],  '"']
    ];
    for (pos = 0; pos < 2; pos += 1) {
        p = ["-", "-inner-"][pos];
        entry = [];
        var openq = state.getTerm(("open" + p + "quote"));
        entry.push(openq);
        this.quotechars.push(openq);
        var closeq = state.getTerm(("close" + p + "quote"));
        entry.push(closeq);
        this.quotechars.push(closeq);
        entry.push(("quote" + "s"));
        entry.push(("@" + "quote" + "s"));
        if ("-" === p) {
            entry.push(["true", "inner"]);
        } else {
            entry.push(["inner", "true"]);
        }
        entry.push(true);
        if ("-" === p) {
            entry.push(state.getTerm(("close-inner-quote")));
        } else {
            entry.push(state.getTerm(("close-quote")));
        }
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
    this.txt_esc = CSL.getSafeEscape(this.state);
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
CSL.Util.FlipFlopper.prototype._normalizeString = function (str) {
    var i, ilen;
    str = str.replace(/\s+'\s+/," ’ ","g");
    if (str.indexOf(this.quotechars[0]) > -1) {
        for (i = 0, ilen = 2; i < ilen; i += 1) {
            if (this.quotechars[i + 2]) {
                str = str.replace(this.quotechars[i + 2], this.quotechars[0]);
            }
        }
    }
    if (str.indexOf(this.quotechars[1]) > -1) {
        for (i = 0, ilen = 2; i < ilen; i += 1) {
            if (this.quotechars[i + 4]) {
                if (i === 0) {
                    str = str.replace(this.quotechars[i + 4], " " + this.quotechars[1]);
                } else {
                    str = str.replace(this.quotechars[i + 4], this.quotechars[1]);
                }
            }
        }
    }
    return str;
};
CSL.Util.FlipFlopper.prototype.getSplitStrings = function (str) {
    var strs, pos, len, newstr, head, tail, expected_closers, expected_openers, expected_flips, tagstack, badTagStack, posA, sameAsOpen, openRev, flipRev, tag, ibeenrunned, posB, wanted_closer, posC, sep, resplice, params, lenA, lenB, lenC, badTagPos, mx, myret;
    str = this._normalizeString(str);
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
        if (sep.length && sep[0] !== "<" && this.openToDecorations[sep] && this.quotechars.indexOf(sep.replace(/\s+/g,"")) === -1) {
            params = this.openToDecorations[sep];
            sep = this.state.fun.decorate[params[0]][params[1][0]](this.state);
        }
        resplice = strs[(badTagPos - 1)] + sep + strs[(badTagPos + 1)];
        head.push(resplice);
        strs = head.concat(tail);
    }
    len = strs.length;
    for (pos = 0; pos < len; pos += 2) {
        strs[pos] = strs[pos].replace("'", "\u2019", "g");
        strs[pos] = strs[pos].replace("  \u2019", " \u2019", "g");
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
                newblob = new CSL.Blob(prestr);
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
                newblob = new CSL.Blob(str);
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
CSL.getSafeEscape = function(state) {
    if (["bibliography", "citation"].indexOf(state.tmp.area) > -1) {
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
            }
        } else {
            return CSL.Output.Formats[state.opt.mode].text_escape;
        }
    } else {
        return function (txt) { return txt; };
    }
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
    var str = CSL.Output.Formatters.doppelString(string, CSL.TAG_ESCAPE);
    var strings = str.string.split(" ");
    for (var i = 0, ilen = strings.length; i < ilen; i += 1) {
        if (strings[i].length > 1) {
			if (state.opt.development_extensions.allow_force_lowercase) {
				strings[i] = strings[i].slice(0, 1).toUpperCase() + strings[i].substr(1).toLowerCase();
			} else {
				strings[i] = strings[i].slice(0, 1).toUpperCase() + strings[i].substr(1);
			}
        } else if (strings[i].length === 1) {
            strings[i] = strings[i].toUpperCase();
        }
    }
    str.string = strings.join(" ");
    return CSL.Output.Formatters.undoppelString(str);
};
CSL.Output.Formatters.title = function (state, string) {
    var str, words, isAllUpperCase, newString, lastWordIndex, previousWordIndex, upperCaseVariant, lowerCaseVariant, pos, skip, notfirst, notlast, aftercolon, len, idx, tmp, skipword, ppos, mx, lst, myret;
    var SKIP_WORDS = state.locale[state.opt.lang].opts["skip-words"];
    if (!string) {
        return "";
    }
    var doppel = CSL.Output.Formatters.doppelString(string, CSL.TAG_ESCAPE);
    function capitalise (word) {
        var m = word.match(/([:?!]+\s+|-|^)(.)(.*)/);
        if (m) {
            return m[1] + m[2].toUpperCase() + m[3];
        }
        return word;
    }
    var str = doppel.string;
    var lst = str.split(state.locale[state.opt.lang].opts["skip-words-regexp"])
    for (i=1,ilen=lst.length;i<ilen;i+=2) {
        if (lst[i].match(/^[:?!]/)) {
            lst[i] = capitalise(lst[i]);
        }
    }
    if (!lst[0]) {
        lst[1] = capitalise(lst[1]);
    }
    if (lst.length > 2 && !lst[lst.length-1]) {
        lst[lst.length-2] = capitalise(lst[lst.length-2]);
    }
    for (var i=0,ilen=lst.length;i<ilen;i+=2) {
        var words = lst[i].split(/([:?!]*\s+|-)/);
        for (var k=0,klen=words.length;k<klen;k+=2) {
            if (words[k].length !== 0) {
                upperCaseVariant = words[k].toUpperCase();
                lowerCaseVariant = words[k].toLowerCase();
                if (words[k].match(/[0-9]/)) {
                    continue;
                }
                if (words[k] === lowerCaseVariant) {
                    words[k] = capitalise(words[k]);
                }
            }
        }
        lst[i] = words.join("");
    }
    doppel.string = lst.join("");
    var ret = CSL.Output.Formatters.undoppelString(doppel);
    return ret;
};
CSL.Output.Formatters.doppelString = function (string, rex) {
    var ret, pos, len;
    ret = {};
    ret.array = rex(string);
    ret.string = "";
    for (var i=0,ilen=ret.array.length; i<ilen; i += 2) {
        if (ret.array[i-1] === "-" && false) {
            ret.string += " " + ret.array[i];
        } else {
            ret.string += ret.array[i];
        }
    }
    return ret;
};
CSL.Output.Formatters.undoppelString = function (str) {
    var ret, len, pos;
    ret = "";
    for (var i=0,ilen=str.array.length; i<ilen; i+=1) {
        if ((i % 2)) {
            ret += str.array[i];
        } else {
            if (str.array[i-1] === "-" && false) {
                ret += str.string.slice(0, str.array[i].length+1).slice(1);
                str.string = str.string.slice(str.array[i].length+1);
            } else {
                ret += str.string.slice(0, str.array[i].length);
                str.string = str.string.slice(str.array[i].length);
            }
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
CSL.demoteNoiseWords = function (state, fld, drop_or_demote) {
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
};
CSL.Output.Formats = function () {};
CSL.Output.Formats.prototype.html = {
    "text_escape": function (text) {
        if (!text) {
            text = "";
        }
        return text.replace(/&/g, "&#38;")
            .replace(/</g, "&#60;")
            .replace(/>/g, "&#62;")
            .replace("  ", "&#160; ", "g")
            .replace(CSL.SUPERSCRIPTS_REGEXP,
                     function(aChar) {
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
            return "\u2019";
        }
        return state.getTerm("open-inner-quote") + str + state.getTerm("close-inner-quote");
    },
    "@quotes/false": false,
    "@cite/entry": function (state, str) {
        return state.sys.wrapCitationEntry(str, this.item_id, this.locator_txt, this.suffix_txt);
	},
    "@bibliography/entry": function (state, str) {
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
            } else if ("string" === typeof str) {
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
        return "<a href=\"http://dx.doi.org/" + str + "\">" + str + "</a>";
    }
};
CSL.Output.Formats.prototype.text = {
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
            return "\u2019";
        }
        return state.getTerm("open-inner-quote") + str + state.getTerm("close-inner-quote");
    },
    "@quotes/false": false,
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
CSL.Output.Formats.prototype.rtf = {
    "text_escape": function (text) {
        if (!text) {
            text = "";
        }
        return text
        .replace(/([\\{}])/g, "\\$1", "g")
        .replace(CSL.SUPERSCRIPTS_REGEXP,
                 function(aChar) {
                     return "\\super " + CSL.SUPERSCRIPTS[aChar] + "\\nosupersub{}";
                 })
        .replace(/[\u007F-\uFFFF]/g,
                 function(aChar) { return "\\uc0\\u"+aChar.charCodeAt(0).toString()+"{}"; })
        .replace("\t", "\\tab{}", "g");
    },
    "@passthrough/true": CSL.Output.Formatters.passthrough,
    "@font-style/italic":"\\i %%STRING%%\\i0{}",
    "@font-style/normal":"\\i0{}%%STRING%%\\i{}",
    "@font-style/oblique":"\\i %%STRING%%\\i0{}",
    "@font-variant/small-caps":"\\scaps %%STRING%%\\scaps0{}",
    "@font-variant/normal":"\\scaps0{}%%STRING%%\\scaps{}",
    "@font-weight/bold":"\\b %%STRING%%\\b0{}",
    "@font-weight/normal":"\\b0{}%%STRING%%\\b{}",
    "@font-weight/light":false,
    "@text-decoration/none":false,
    "@text-decoration/underline":"\\ul %%STRING%%\\ul0{}",
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
        return str;
	},
    "@cite/entry": function (state, str) {
		return state.sys.wrapCitationEntry(str, this.item_id, this.locator_txt, this.suffix_txt);
	},
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
    },
    "@showid/true": function (state, str, cslid) {
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
CSL.Output.Formats = new CSL.Output.Formats();
CSL.Registry = function (state) {
    var pos, len, ret, i, ilen;
    this.debug = false;
    this.state = state;
    this.registry = {};
    this.reflist = [];
    this.namereg = new CSL.Registry.NameReg(state);
    this.citationreg = new CSL.Registry.CitationReg(state);
    this.authorstrings = {};
    this.mylist = [];
    this.myhash = {};
    this.deletes = [];
    this.inserts = [];
    this.uncited = {};
    this.refreshes = {};
    this.akeys = {};
    this.oldseq = {};
    this.return_data = {};
    this.ambigcites = {};
    this.ambigresets = {};
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
CSL.Registry.prototype.init = function (itemIDs, uncited_flag) {
    var i, ilen;
    this.oldseq = {};
    if (uncited_flag) {
        this.uncited = {};
        for (var i=0,ilen=itemIDs.length;i<ilen; i += 1) {
            if (!this.myhash[itemIDs[i]]) {
                this.mylist.push("" + itemIDs[i]);
            }
            this.uncited[itemIDs[i]] = true;
            this.myhash[itemIDs[i]] = true;
        }
    } else {
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
        this.mylist = [];
        for (var i=0,ilen=itemIDs.length;i<ilen;i+=1) {
            this.mylist.push("" + itemIDs[i]);
        }
        this.myhash = myhash;
    }
    this.refreshes = {};
    this.touched = {};
    this.ambigsTouched = {};
    this.ambigresets = {};
};
CSL.Registry.prototype.dopurge = function (myhash) {
    for (var i=this.mylist.length-1;i>-1;i+=-1) {
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
        myhash = {};
        myhash[myhash] = true;
    }
    for (key in this.registry) {
        if (!myhash[key]) {
            if (this.uncited[key]) {
                continue;
            }
            otheritems = this.namereg.delitems(key);
            for (kkey in otheritems) {
                this.refreshes[kkey] = true;
            }
            ambig = this.registry[key].ambig;
            mypos = this.ambigcites[ambig].indexOf(key);
            if (mypos > -1) {
                items = this.ambigcites[ambig].slice();
                this.ambigcites[ambig] = items.slice(0, mypos).concat(items.slice(mypos+1, items.length));
                this.ambigresets[ambig] = this.ambigcites[ambig].length;
            }
            len = this.ambigcites[ambig].length;
            for (pos = 0; pos < len; pos += 1) {
                id = "" + this.ambigcites[ambig][pos];
                this.refreshes[id] = true;
            }
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
                            buffer.push(siblingID)
                        }
                    }
                    for (var k = buffer.length - 1; k > -1; k += -1) {
                        this.registry[key].siblings.push(buffer[k]);
                    }
                }
            }
            delete this.registry[key];
            this.return_data.bibchange = true;
        }
    }
};
CSL.Registry.prototype.doinserts = function (mylist) {
    var len, pos, item, Item, akey, newitem, abase, j, jlen, k, klen, i, ilen;
    if ("string" === typeof mylist) {
        mylist = [mylist];
    }
    for (i = 0, ilen = mylist.length; i < ilen; i += 1) {
        item = mylist[i];
        if (!this.registry[item]) {
            Item = this.state.retrieveItem(item);
            akey = CSL.getAmbiguousCite.call(this.state, Item);
            this.ambigsTouched[akey] = true;
            if (!Item.legislation_id) {
                this.akeys[akey] = true;
            }
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
            if (this.citationreg.citationsByItemId && this.citationreg.citationsByItemId[item]) {
                this.registry[item]["first-reference-note-number"] = this.citationreg.citationsByItemId[item][0].properties.noteIndex;
            }
            abase = CSL.getAmbigConfig.call(this.state);
            this.registerAmbigToken(akey, item, abase);
            this.touched[item] = true;
            this.return_data.bibchange = true;
        }
    }
};
CSL.Registry.prototype.rebuildlist = function () {
    var count, len, pos, item;
    this.reflist = [];
    if (this.state.opt.citation_number_sort_direction === CSL.DESCENDING
       && this.state.opt.citation_number_sort_used) {
    }
    len = this.mylist.length;
    for (pos = 0; pos < len; pos += 1) {
        item = this.mylist[pos];
        this.reflist.push(this.registry[item]);
        this.oldseq[item] = this.registry[item].seq;
        this.registry[item].seq = (pos + 1);
    }
    if (this.state.opt.citation_number_sort_direction === CSL.DESCENDING
       && this.state.opt.citation_number_sort_used) {
    }
};
CSL.Registry.prototype.dorefreshes = function () {
    var key, regtoken, Item, old_akey, akey, abase;
    for (key in this.refreshes) {
        regtoken = this.registry[key];
        if (!regtoken) {
            continue;
        }
        regtoken.sortkeys = undefined;
        Item = this.state.retrieveItem(key);
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
                var Item = this.state.retrieveItem(loneKey);
                this.registry[loneKey].disambig = new CSL.AmbigConfig;
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
CSL.Registry.prototype.setdisambigs = function () {
    var akey, leftovers, key, pos, len, id;
    this.leftovers = [];
    for (akey in this.ambigsTouched) {
        this.state.disambiguate.run(akey);
    }
    this.ambigsTouched = {};
    this.akeys = {};
};
CSL.Registry.prototype.renumber = function () {
    var len, pos, item;
    if (this.state.opt.citation_number_sort_direction === CSL.DESCENDING
       && this.state.opt.citation_number_sort_used) {
    }
    len = this.reflist.length;
    for (pos = 0; pos < len; pos += 1) {
        item = this.reflist[pos];
        item.seq = (pos + 1);
        if (this.state.opt.update_mode === CSL.NUMERIC && item.seq != this.oldseq[item.id]) {
            this.state.tmp.taintedItemIDs[item.id] = true;
        }
        if (this.state.opt.bib_mode === CSL.NUMERIC && item.seq != this.oldseq[item.id]) {
            this.return_data.bibchange = true;
        }
    }
    if (this.state.opt.citation_number_sort_direction === CSL.DESCENDING
       && this.state.opt.citation_number_sort_used) {
        this.reflist.reverse();
    }
};
CSL.Registry.prototype.setsortkeys = function () {
    var key;
    for (var i = 0, ilen = this.mylist.length; i < ilen; i += 1) {
        var key = this.mylist[i];
        if (this.touched[key] || this.state.tmp.taintedItemIDs[key] || !this.registry[key].sortkeys) {
            this.registry[key].sortkeys = CSL.getSortKeys.call(this.state, this.state.retrieveItem(key), "bibliography_sort");
        }
    }
};
CSL.Registry.prototype.sorttokens = function () {
    this.reflist.sort(this.sorter.compareKeys);
};
CSL.Registry.Comparifier = function (state, keyset) {
    var sort_directions, len, pos, compareKeys;
    var sortCompare = CSL.getSortCompare(state.opt["default-locale-sort"]);
    sort_directions = state[keyset].opt.sort_directions;
    this.compareKeys = function (a, b) {
        len = a.sortkeys ? a.sortkeys.length : 0;
        for (pos = 0; pos < len; pos += 1) {
            var cmp = 0;
            if (a.sortkeys[pos] === b.sortkeys[pos]) {
                cmp = 0;
            } else if ("undefined" === typeof a.sortkeys[pos]) {
                cmp = sort_directions[pos][1];
            } else if ("undefined" === typeof b.sortkeys[pos]) {
                cmp = sort_directions[pos][0];
            } else {
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
CSL.Registry.prototype.compareRegistryTokens = function (a, b) {
    if (a.seq > b.seq) {
        return 1;
    } else if (a.seq < b.seq) {
        return -1;
    }
    return 0;
};
CSL.Registry.prototype.registerAmbigToken = function (akey, id, ambig_config) {
    if (this.registry[id] && this.registry[id].disambig && this.registry[id].disambig.names) {
        for (var i = 0, ilen = ambig_config.names.length; i < ilen; i += 1) {
            var new_names_params = ambig_config.names[i];
            var old_names_params = this.registry[id].disambig.names[i];
            if (new_names_params !== old_names_params) {
                this.state.tmp.taintedItemIDs[id] = true;
            } else if (ambig_config.givens[i]) {
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
    var dome = false;
    this.registry[id].disambig = CSL.cloneAmbigConfig(ambig_config);
};
CSL.getSortKeys = function (Item, key_type) {
    var area, extension, strip_prepositions, use_parallels, len, pos;
    area = this.tmp.area;
    extension = this.tmp.extension;
    strip_prepositions = CSL.Util.Sort.strip_prepositions;
    this.tmp.area = key_type;
    this.tmp.extension = "_sort";
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
    this.tmp.extension = extension;
    return this[key_type].keys;
};
CSL.Registry.NameReg = function (state) {
    var pkey, ikey, skey, floor, ceiling, dagopt, gdropt, ret, pos, items, strip_periods, set_keys, evalname, delitems, addname, key, myitems, i, ilen;
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
        var m = skey.match(/[,\!]* ([^,]+)$/);
        if (m && m[1] === m[1].toLowerCase()) {
            skey = skey.replace(/[,\!]* [^,]+$/, "");
        }
        ikey = CSL.Util.Names.initializeWith(state, skey, "%s");
        if (state.citation.opt["givenname-disambiguation-rule"] === "by-cite") {
            pkey = "" + itemid + pkey;
        }
    };
    evalname = function (item_id, nameobj, namenum, request_base, form, initials) {
        var pos, len, items, param;
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
        param = 2;
        dagopt = state.opt["disambiguate-add-givenname"];
        gdropt = state.citation.opt["givenname-disambiguation-rule"];
        var gdropt_orig = gdropt;
        if (gdropt === "by-cite") {
            gdropt = "all-names";
        }
        if ("short" === form) {
            param = 0;
        } else if ("string" === typeof initials) {
            param = 1;
        }
        if ("undefined" === typeof this.namereg[pkey] || "undefined" === typeof this.namereg[pkey].ikey[ikey]) {
            return param;
        }
        if (gdropt_orig === "by-cite" && param <= request_base) {
            return request_base;
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
    delitems = function (ids) {
        var item, pos, len, posA, posB, id, fullkey, llen, ppos, otherid;
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
                    items = this.namereg[pkey].items;
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
                                for (i = 0, ilen = this.namereg[pkey].ikey[ikey].items.length; i < ilen; i += 1) {
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
                                for (i = 0, ilen = this.namereg[pkey].items.length; i < ilen; i += 1) {
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
    addname = function (item_id, nameobj, pos) {
        var i, ilen;
        var res = state.nameOutput.getName(nameobj, "locale-translit", true);
        nameobj = res.name;
        if (state.citation.opt["givenname-disambiguation-rule"]
            && state.citation.opt["givenname-disambiguation-rule"].slice(0, 8) === "primary-"
            && pos !== 0) {
                return;
        }
        set_keys(this.state, "" + item_id, nameobj);
        if (pkey) {
            if ("undefined" === typeof this.namereg[pkey]) {
                this.namereg[pkey] = {};
                this.namereg[pkey].count = 0;
                this.namereg[pkey].ikey = {};
                this.namereg[pkey].items = [item_id];
            } else if (this.namereg[pkey].items.indexOf(item_id) === -1) {
                this.namereg[pkey].items.push(item_id);
            }
        }
        if (pkey && ikey) {
            if ("undefined" === typeof this.namereg[pkey].ikey[ikey]) {
                this.namereg[pkey].ikey[ikey] = {};
                this.namereg[pkey].ikey[ikey].count = 0;
                this.namereg[pkey].ikey[ikey].skey = {};
                this.namereg[pkey].ikey[ikey].items = [item_id];
                this.namereg[pkey].count += 1;
                if (this.namereg[pkey].count === 2) {
                    for (i = 0, ilen = this.namereg[pkey].items.length; i < ilen; i += 1) {
                        state.tmp.taintedItemIDs[this.namereg[pkey].items[i]] = true;
                    }
                }
            } else if (this.namereg[pkey].ikey[ikey].items.indexOf(item_id) === -1) {
                this.namereg[pkey].ikey[ikey].items.push(item_id);
            }
        }
        if (pkey && ikey && skey) {
            if ("undefined" === typeof this.namereg[pkey].ikey[ikey].skey[skey]) {
                this.namereg[pkey].ikey[ikey].skey[skey] = {};
                this.namereg[pkey].ikey[ikey].skey[skey].items = [item_id];
                this.namereg[pkey].ikey[ikey].count += 1;
                if (this.namereg[pkey].ikey[ikey].count === 2) {
                    for (i = 0, ilen = this.namereg[pkey].ikey[ikey].items.length; i < ilen; i += 1) {
                        state.tmp.taintedItemIDs[this.namereg[pkey].ikey[ikey].items[i]] = true;
                    }
                }
            } else if (this.namereg[pkey].ikey[ikey].skey[skey].items.indexOf(item_id) === -1) {
                this.namereg[pkey].ikey[ikey].skey[skey].items.push(item_id);
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
CSL.Registry.CitationReg = function (state) {
    this.citationById = {};
    this.citationByIndex = [];
};
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
    this.akey = akey;
    if (this.initVars(akey)) {
        this.runDisambig();
    }
};
CSL.Disambiguation.prototype.runDisambig = function () {
    var pos, len, ppos, llen, pppos, lllen, ismax;
    this.initGivens = true;
    while (this.lists.length) {
        this.gnameset = 0;
        this.gname = 0;
        this.clashes = [1, 0];
        while(this.lists[0][1].length) {
            this.listpos = 0;
            if (!this.base) {
                this.base = this.lists[0][0];
            }
            var names_used = [];
            ismax = this.incrementDisambig();
            this.scanItems(this.lists[0]);
            this.evalScan(ismax);
        }
        this.lists = this.lists.slice(1);
    }
};
CSL.Disambiguation.prototype.scanItems = function (list) {
    var pos, len, Item, otherItem, ItemCite, ignore, base;
    this.Item = list[1][0];
    this.ItemCite = CSL.getAmbiguousCite.call(this.state, this.Item, this.base, true);
    this.scanlist = list[1];
    this.partners = [];
    this.partners.push(this.Item);
    this.nonpartners = [];
    var clashes = 0;
    for (pos = 1, len = list[1].length; pos < len; pos += 1) {
        otherItem = list[1][pos];
        var otherItemCite = CSL.getAmbiguousCite.call(this.state, otherItem, this.base, true);
        if (this.ItemCite === otherItemCite) {
            clashes += 1;
            this.partners.push(otherItem);
        } else {
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
    var pos, len, mybase, i, ilen;
    if (this.clashes[1] === 0 && this.nonpartners.length === 1) {
        this.captureStepToBase();
        this.state.registry.registerAmbigToken(this.akey, "" + this.nonpartners[0].id, this.betterbase);
        this.state.registry.registerAmbigToken(this.akey, "" + this.partners[0].id, this.betterbase);
        this.lists[this.listpos] = [this.betterbase, []];
    } else if (this.clashes[1] === 0) {
        this.captureStepToBase();
        this.state.registry.registerAmbigToken(this.akey, "" + this.partners[0].id, this.betterbase);
        this.lists[this.listpos] = [this.betterbase, this.nonpartners];
        if (this.nonpartners.length) {
            this.initGivens = true;
        }
    } else if (this.nonpartners.length === 1) {
        this.captureStepToBase();
        this.state.registry.registerAmbigToken(this.akey, "" + this.nonpartners[0].id, this.betterbase);
        this.lists[this.listpos] = [this.betterbase, this.partners];
    } else if (this.clashes[1] < this.clashes[0]) {
        this.captureStepToBase();
        this.lists[this.listpos] = [this.betterbase, this.partners];
        this.lists.push([this.betterbase, this.nonpartners]);
    } else {
        if (ismax) {
            this.lists[this.listpos] = [this.betterbase, this.nonpartners];
            this.lists.push([this.betterbase, this.partners]);
            if (this.modeindex === this.modes.length - 1) {
                for (i = 0, ilen = this.partners.length; i < ilen; i += 1) {
                    this.state.registry.registerAmbigToken(this.akey, "" + this.partners[i].id, this.betterbase);
                }
                this.lists[this.listpos] = [this.betterbase, []];
            }
        }
    }
};
CSL.Disambiguation.prototype.disExtraText = function () {
    var pos, len, mybase;
    var done = false;
    if (this.clashes[1] === 0 && this.nonpartners.length < 2) {
        done = true;
    }
    if (!done && (!this.base.disambiguate || this.state.tmp.disambiguate_count !== this.state.tmp.disambiguate_maxMax)) {
        this.modeindex = 0;
        this.base.disambiguate = this.state.tmp.disambiguate_count;
        this.betterbase.disambiguate = this.state.tmp.disambiguate_count;
        if (!this.base.disambiguate) {
            this.initGivens = true;
            this.base.disambiguate = 1;
            for (var i = 0, ilen = this.lists[this.listpos][1].length; i < ilen; i += 1) {
                this.state.tmp.taintedItemIDs[this.lists[this.listpos][1][i].id] = true;
            }
        } else {
            this.disNames();
        }
    } else if (done || this.state.tmp.disambiguate_count === this.state.tmp.disambiguate_maxMax) {
        if (done || this.modeindex === this.modes.length - 1) {
            var base = this.lists[this.listpos][0];
            for (var i = 0, ilen = this.lists[this.listpos][1].length; i < ilen; i += 1) {
                this.state.tmp.taintedItemIDs[this.lists[this.listpos][1][i].id] = true;
                this.state.registry.registerAmbigToken(this.akey, "" + this.lists[this.listpos][1][i].id, base);
            }
            this.lists[this.listpos] = [this.betterbase, []];
        } else {
            this.modeindex = this.modes.length - 1;
            var base = this.lists[this.listpos][0];
            base.disambiguate = true;
            for (var i = 0, ilen = this.lists[this.listpos][1].length; i < ilen; i += 1) {
                this.state.tmp.taintedItemIDs[this.lists[this.listpos][1][i].id] = true;
                this.state.registry.registerAmbigToken(this.akey, "" + this.lists[this.listpos][1][i].id, base);
            }
        }
    }
};
CSL.Disambiguation.prototype.disYears = function () {
    var pos, len, tokens, token, item;
    tokens = [];
    var base = this.lists[this.listpos][0];
    if (this.clashes[1]) {
		for (var i = 0, ilen = this.state.registry.mylist.length; i < ilen; i += 1) {
			var origid = this.state.registry.mylist[i];
			for (var j = 0, jlen = this.lists[this.listpos][1].length; j < jlen; j += 1) {
				var token = this.lists[this.listpos][1][j];
				if (token.id == origid) {
					tokens.push(this.registry[token.id]);
					break;
				}
			}
		}
    }
    tokens.sort(this.state.registry.sorter.compareKeys);
    for (pos = 0, len = tokens.length; pos < len; pos += 1) {
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
    var val;
    if (this.initGivens) {
        this.initGivens = false;
        return false;
    }
    var maxed = false;
    var increment_names = true;
    var increment_givens = true;
    if ("disNames" === this.modes[this.modeindex]) {
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
            } else {
                var increment_mode = true;
            }
        }
        if (("number" !== typeof this.namesetsMax || this.namesetsMax === -1 || this.gnameset === this.namesetsMax)
            && (!this.state.opt["disambiguate-add-names"] || "number" !== typeof this.namesMax || this.gname === this.namesMax)
            && ("number" != typeof this.givensMax || "undefined" === typeof this.base.givens[this.gnameset] || "undefined" === typeof this.base.givens[this.gnameset][this.gname] || this.base.givens[this.gnameset][this.gname] === this.givensMax)) {
            maxed = true;
        }
    } else if ("disExtraText" === this.modes[this.modeindex]) {
        this.base.disambiguate += 1;
        this.betterbase.disambiguate += 1;
    }
    return maxed;
};
CSL.Disambiguation.prototype.initVars = function (akey) {
    var i, ilen, myIds, myItemBundles, myItems;
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
    var Item = false;
    var myItem = this.state.retrieveItem("" + myIds[0]);
    this.getCiteData(myItem);
    this.base = CSL.getAmbigConfig.call(this.state);
    if (myIds && myIds.length > 1) {
        myItemBundles.push([this.maxNamesByItemId[myItem.id], myItem]);
        for (i = 1, ilen = myIds.length; i < ilen; i += 1) {
            myItem = this.state.retrieveItem("" + myIds[i]);
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
        for (i = 0, ilen = myItemBundles.length; i < ilen; i += 1) {
            myItems.push(myItemBundles[i][1]);
        }
        this.lists.push([this.base, myItems]);
        this.Item = this.lists[0][1][0];
    } else {
        this.Item = this.state.retrieveItem("" + myIds[0]);
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
}
CSL.Disambiguation.prototype.configModes = function () {
    var dagopt, gdropt;
    this.modes = [];
    dagopt = this.state.opt["disambiguate-add-givenname"];
    gdropt = this.state.citation.opt["givenname-disambiguation-rule"];
    if (this.state.opt['disambiguate-add-names'] || (dagopt && gdropt === "by-cite")) {
        this.modes.push("disNames");
    }
    if (this.state.opt.has_disambiguate) {
        this.modes.push("disExtraText");
    }
    if (this.state.opt["disambiguate-add-year-suffix"]) {
        this.modes.push("disYears");
    }
};
CSL.Disambiguation.prototype.getCiteData = function(Item, base) {
    if (!this.maxNamesByItemId[Item.id]) {
        CSL.getAmbiguousCite.call(this.state, Item, base);
        base = CSL.getAmbigConfig.call(this.state);
        this.maxNamesByItemId[Item.id] = CSL.getMaxVals.call(this.state);
        this.state.registry.registry[Item.id].disambig.givens = this.state.tmp.disambig_settings.givens.slice();
        for (var i=0,ilen=this.state.registry.registry[Item.id].disambig.givens.length;i<ilen;i+=1) {
            this.state.registry.registry[Item.id].disambig.givens[i] = this.state.tmp.disambig_settings.givens[i].slice();
        }
        this.namesetsMax = this.state.registry.registry[Item.id].disambig.names.length - 1;
        if (!this.base) {
            this.base = base;
            this.betterbase = CSL.cloneAmbigConfig(base);
        }
        if (base.names.length < this.base.names.length) {
            this.base = base;
        }
        var update = false;
        for (var i = 0, ilen = base.names.length; i < ilen; i += 1) {
            if (base.names[i] > this.base.names[i]) {
                this.base.givens[i] = base.givens[i].slice();
                this.base.names[i] = base.names[i];
                this.betterbase.names = this.base.names.slice();
                this.betterbase.givens = this.base.givens.slice();
                this.padBase(this.base);
                this.padBase(this.betterbase);
            }
        }
        this.betterbase.givens = this.base.givens.slice();
        for (var j = 0, jlen = this.base.givens.length; j < jlen; j += 1) {
            this.betterbase.givens[j] = this.base.givens[j].slice();
        }
    }
};
CSL.Disambiguation.prototype.captureStepToBase = function() {
    if (this.state.citation.opt["givenname-disambiguation-rule"] === "by-cite"
        && this.base.givens && this.base.givens.length) {
        if ("undefined" !== typeof this.base.givens[this.gnameset][this.gname]) {
            this.betterbase.givens[this.gnameset][this.gname] = this.base.givens[this.gnameset][this.gname];
        }
    }
    this.betterbase.names[this.gnameset] = this.base.names[this.gnameset];
};
