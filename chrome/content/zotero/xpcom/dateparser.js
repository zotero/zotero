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

/*global Zotero: true */

/*
 * Code from citeproc-js
 */

// Instantiated below
Zotero.DateParser = function () {
	var gi, gilen;

	/*
	 * Interface methods 
	 * 
	 * this.parseDateToObject = parseDateToObject;
	 * this.parseDateToArray = parseDateToArray;
	 * this.convertDateObjectToArray = convertDateObjectToArray;
	 * this.resetDateParserMonths = resetDateParserMonths;
	 * this.addDateParserMonths = addDateParserMonths;
	*/

	// Private variables shared across functions
	var msets = [];
	var mabbrevs = [];
	var mrexes = [];
	var DATE_PARTS_ALL = ["year", "month", "day", "season"];

	// japanese imperial years
	var jiy_list = [];
	jiy_list.push(["\u660E\u6CBB", 1867]);
	jiy_list.push(["\u5927\u6B63", 1911]);
	jiy_list.push(["\u662D\u548C", 1925]);
	jiy_list.push(["\u5E73\u6210", 1988]);

	// regular expression to trap year name and year (jiysplitter)
	var jiy = {};
	for (gi = 0, gilen = jiy_list.length; gi < gilen; gi += 1) {
		jiy[jiy_list[gi][0]] = jiy_list[gi][1];
	}
	var jiymatchstring = [];
	for (gi = 0, gilen = jiy_list.length; gi < gilen; gi += 1) {
		jiymatchstring.push(jiy_list[gi][0]);
	}
	jiymatchstring = jiymatchstring.join("|");

	// Painful code for IE6 compatibility
	var jiysplitter = new RegExp("(?:" + jiymatchstring + ")(?:[0-9]+)");
	// for IE6 workaround
	var jiymatcher = new RegExp("(?:" + jiymatchstring + ")(?:[0-9]+)", "g");

	// CJK regular expression, for month or day, year, and range
	var jmd = /(\s*\u6708\s*|\s*\u5E74\s*)/g;
	var jy = /\s*\u65E5\s*/;
	var jr = /\s*\u301c\s*/g;
	// Other regular expression bits and pieces
	var yearlast = "(?:[?0-9]{1,2}%%NUMD%%){0,2}[?0-9]{4}(?![0-9])";
	var yearfirst = "[?0-9]{4}(?:%%NUMD%%[?0-9]{1,2}){0,2}(?![0-9])";
	var number = "[?0-9]{1,3}";
	var rangesep = "[%%DATED%%]";
	var fuzzychar = "[?~]";
	var chars = "[a-zA-Z]+";

	// Regular expression template
	var rex = "(" + yearfirst + "|" + yearlast + "|" + number + "|" + rangesep + "|" + fuzzychar + "|" + chars + ")";

	// Compiled regular expressions
	var rexdash = new RegExp(rex.replace(/%%NUMD%%/g, "-").replace(/%%DATED%%/g, "-"));
	var rexdashslash = new RegExp(rex.replace(/%%NUMD%%/g, "-").replace(/%%DATED%%/g, "\/"));
	var rexslashdash = new RegExp(rex.replace(/%%NUMD%%/g, "\/").replace(/%%DATED%%/g, "-"));

	// Seasons
	var seasonstrs = [];
	var seasonrexes = [];
	var seasonrex;
	for (gi = 0, gilen = seasonstrs.length; gi < gilen; gi += 1) {
		seasonrex = new RegExp(seasonstrs[gi] + ".*");
		seasonrexes.push(seasonrex);
	}

	// Months (English as the base, subject to extension)
	var mstrings = "january february march april may june july august september october november december spring summer fall winter spring summer";
	mstrings = mstrings.split(" ");

	// Configuration methods
	var monthguess, dayguess;
	function setDateOrderDayMonth () {
		// preferred ordering for year-last numeric dates
		monthguess = 1;
		dayguess = 0;
	}
	function setDateOrderMonthDay () {
		// preferred ordering for year-last numeric dates
		monthguess = 0;
		dayguess = 1;
	}
	setDateOrderMonthDay();

	function resetDateParserMonths () {
		var i, ilen, j, jlen;
		// Function to reset months to default.
		msets = [];
		for (i = 0, ilen = mstrings.length; i < ilen; i += 1) {
			msets.push([mstrings[i]]);
		}
		mabbrevs = [];
		for (i = 0, ilen = msets.length; i < ilen; i += 1) {
			// XXX Aha.  Needs to nest here.
			mabbrevs.push([]);
			for (j = 0, jlen = msets[i].length; j < jlen; j += 1) {
				mabbrevs[i].push(msets[i][0].slice(0, 3));
			}
		}
		mrexes = [];
		for (i = 0, ilen = mabbrevs.length; i < ilen; i += 1) {
			mrexes.push(new RegExp("(?:" + mabbrevs[i].join("|") + ")"));
		}
	}
	resetDateParserMonths();

	function addDateParserMonths (lst) {
		var i, ilen, j, jlen, k, klen;
		// Function to extend the month regexes with an additional
		// set of month strings, extending strings as required to
		// resolve ambiguities.
		
		// Normalize string to list
		if ("string" === typeof lst) {
			lst = lst.split(/\s+/);
		}
		
		// Check that there are twelve (or sixteen) to add
		if (lst.length !== 12 && lst.length !== 16) {
			Zotero.debug("month [+season] list of "+lst.length+", expected 12 or 16. Ignoring.");
			return;
		}
		
		// Extend as necessary to resolve ambiguities
		var othermatch = [];
		var thismatch = [];
		// For each new month string ...
		for (i = 0, ilen = lst.length; i < ilen; i += 1) {
			// Compare with each existing abbreviation and ...
			var abbrevlen = false;
			var skip = false;
			var insert = 3;
			var extend = {};
			for (j = 0, jlen = mabbrevs.length; j < jlen; j += 1) {
				// Set default abbrevlen
				extend[j] = {};
				if (j === i) {
					// Mark for skipping if same as an existing abbreviation of same month
					for (k = 0, klen = mabbrevs[i].length; k < klen; k += 1) {
						if (mabbrevs[i][k] === lst[i].slice(0, mabbrevs[i][k].length)) {
							skip = true;
							break;
						}
					}
				} else {
					// Mark for extending if same as existing abbreviation of any other month
					for (k = 0, klen = mabbrevs[j].length; k < klen; k += 1) {
						abbrevlen = mabbrevs[j][k].length;
						if (mabbrevs[j][k] === lst[i].slice(0, abbrevlen)) {
							while (msets[j][k].slice(0, abbrevlen) === lst[i].slice(0, abbrevlen)) {
								// Abort when full length is hit, otherwise extend
								if (abbrevlen > lst[i].length || abbrevlen > msets[j][k].length) {
									Zotero.debug("unable to disambiguate month string in date parser: "+lst[i]);
									break;
								} else {
									// Mark both new entry and existing abbrev for extension
									abbrevlen += 1;
								}
							}
							insert = abbrevlen;
							extend[j][k] = abbrevlen;
						}
					}
				}
				for (var jkey in extend) {
					if (extend.hasOwnProperty(jkey)) {
						for (var kkey in extend[jkey]) {
							if (extend[jkey].hasOwnProperty(kkey)) {
								abbrevlen = extend[jkey][kkey];
								jkey = parseInt(jkey, 10);
								kkey = parseInt(kkey, 10);
								mabbrevs[jkey][kkey] = msets[jkey][kkey].slice(0, abbrevlen);
							}
						}
					}
				}
			}
			// Insert here
			if (!skip) {
				msets[i].push(lst[i]);
				mabbrevs[i].push(lst[i].slice(0, insert));
			}
		}
		
		// Compose
		mrexes = [];
		for (i = 0, ilen = mabbrevs.length; i < ilen; i += 1) {
			mrexes.push(new RegExp("(?:" + mabbrevs[i].join("|") + ")"));
		}
	}
	
	function parseNumericDate (ret, delim, suff, txt) {
		var i, ilen;
		var lst = txt.split(delim);
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
		//
		// month and day parse
		//
		if (lst.length === 1) {
			ret[("month" + suff)] = "" + lst[0];
		} else if (lst.length === 2) {
			if (lst[monthguess] > 12) {
				ret[("month" + suff)] = "" + lst[dayguess];
				ret[("day" + suff)] = "" + lst[monthguess];
			} else {
				ret[("month" + suff)] = "" + lst[monthguess];
				ret[("day" + suff)] = "" + lst[dayguess];
			}
		}
	}

	function convertDateObjectToArray (thedate) {
		var i, ilen;
		thedate["date-parts"] = [];
		thedate["date-parts"].push([]);
		var slicelen = 0;
		var part;
		for (i = 0, ilen = 3; i < ilen; i += 1) {
			part = ["year", "month", "day"][i];
			if (!thedate[part]) {
				break;
			}
			slicelen += 1;
			thedate["date-parts"][0].push(thedate[part]);
			delete thedate[part];
		}
		for (i = 0, ilen = slicelen; i < ilen; i += 1) {
			part = ["year_end", "month_end", "day_end"][i];
			if (thedate[part] && thedate["date-parts"].length === 1) {
				thedate["date-parts"].push([]);
			}
			thedate["date-parts"][1].push(thedate[part]);
			delete thedate[part];
		}
	}

	function parse (txt) {
		var lst, i, ilen, j, jlen, k, klen;
		//
		// Normalize the format and the year if it's a Japanese date
		//
	if (txt) {
        txt = "" + txt;
        // Remove things that look like times
        txt = txt.replace(/\s*[0-9]{2}:[0-9]{2}(?::[0-9]+)/,"");
        m = txt.match(jmd);
		var m = txt.match(jmd);
		if (m) {
            txt = txt.replace(/\s+/, "", "g");
			txt = txt.replace(jy, "", "g");
			txt = txt.replace(jmd, "-", "g");
			txt = txt.replace(jr, "/", "g");
			txt = txt.replace("-/", "/", "g");
			txt = txt.replace(/-$/,"", "g");
			
			// Not IE6 safe, applying tortuous workaround
			var slst = txt.split(jiysplitter);
			lst = [];
			var mm = txt.match(jiymatcher);
			var mmx = [];
			for (i = 0, ilen = mm.length; i < ilen; i += 1) {
				mmx = mmx.concat(mm[i].match(/([^0-9]+)([0-9]+)/).slice(1));
			}
			for (i = 0, ilen = slst.length; i < ilen; i += 1) {
				lst.push(slst[i]);
				if (i !== (ilen - 1)) {
					var mmpos = (i * 2);
					lst.push(mmx[mmpos]);
					lst.push(mmx[mmpos + 1]);
				}
			}
			// workaround duly applied, this now works
			for	(i = 1, ilen = lst.length; i < ilen; i += 3) {
				//Zotero.debug("XXX lst[i + 1]=("+jiy[lst[i]]+" plus "+lst[i + 1]+")");
				lst[i + 1] = jiy[lst[i]] + parseInt(lst[i + 1], 10);
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
		}
		// drop punctuation from a.d., b.c.
		txt = txt.replace(/([A-Za-z])\./g, "$1");
		
		var number = "";
		var note = "";
		var thedate = {};
		if (txt.slice(0, 1) === "\"" && txt.slice(-1) === "\"") {
			thedate.literal = txt.slice(1, -1);
			return thedate;
		}
		var has_slash = txt.indexOf("/") > -1;
		var has_dash = txt.indexOf("-") > -1;
		var range_delim, date_delim;
		if (has_slash && has_dash) {
			var slashcount = txt.split("/");
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
		var ret = [];
		for (i = 0, ilen = lst.length; i < ilen; i += 1) {
			var item = lst[i];
			m = item.match(/^\s*([\-\/]|[a-zA-Z]+|[\-~?0-9]+)\s*$/);
			if (m) {
				ret.push(m[1]);
			}
		}
		//
		// Phase 2
		//
		var delim_pos = ret.indexOf(range_delim);
		var delims = [];
		var isrange = false;
		if (delim_pos > -1) {
			delims.push([0, delim_pos]);
			delims.push([(delim_pos + 1), ret.length]);
			isrange = true;
		} else {
			delims.push([0, ret.length]);
		}
		//
		// For each side of a range divide ...
		//
		var suff = "";
		for (i = 0, ilen = delims.length; i < ilen; i += 1) {
			var delim = delims[i];
			//
			// Process each element ...
			//
			var date = ret.slice(delim[0], delim[1]);
			for (j = 0, jlen = date.length; j < jlen; j += 1) {
				var element = date[j];
				//
				// If it's a numeric date, process it.
				//
				if (element.indexOf(date_delim) > -1) {
					parseNumericDate(thedate, date_delim, suff, element);
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
				// If it's a month, record it.
				//
				var breakme = false;
				for (k = 0, klen = mrexes.length; k < klen; k += 1) {
					if (element.toLocaleLowerCase().match(mrexes[k])) {
						thedate[("month" + suff)] = "" + (parseInt(k, 10) + 1);
						breakme = true;
						break;
					}
					if (breakme) {
						continue;
					}
					//
					// If it's a number, make a note of it
					//
					if (element.match(/^[0-9]+$/)) {
						number = parseInt(element, 10);
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
				}
				//
				// If it's a season, record it.
				//
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
				//
				// If it's a fuzzy marker, record it.
				//
				if (element === "~" || element === "?" || element === "c" || element.match(/^cir/)) {
					thedate.circa = "" + 1;
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
				thedate[("season" + suff)] = note;
				note = "";
			}
			suff = "_end";
		}
		//
		// update any missing elements on each side of the divide
		// from the other
		//
		if (isrange) {
			var part;
			for (j = 0, jlen = DATE_PARTS_ALL.length; j < jlen; j += 1) {
				part = DATE_PARTS_ALL[j];
				if (thedate[part] && !thedate[(part + "_end")]) {
					thedate[(part + "_end")] = thedate[part];
				} else if (!thedate[part] && thedate[(part + "_end")]) {
					thedate[part] = thedate[(part + "_end")];
				}
			}
		}
		//
		// If there's no year, it's a failure; pass through the literal
		//
		if (!thedate.year) {
			thedate = { "literal": txt };
		}
		return thedate;
	}
    }

	// XXXX Should be extended when date ranges are supported in the DB.
	function convertDateObjectToString (thedate) {
		var ret = [];
		for (var i = 0, ilen = 3; i < ilen; i += 1) {
			if (thedate[DATE_PARTS_ALL[i]]) {
				ret.push(thedate[DATE_PARTS_ALL[i]]);
			} else {
				break;
			}
		}
		return ret.join("-");
	}

	function parseDateToObject (txt) {
		return parse(txt);
	}

	function parseDateToArray (txt) {
		return convertDateObjectToArray(parse(txt));
	}

	function parseDateToString (txt) {
		return convertDateObjectToString(parse(txt));
	}

	this.parseDateToObject = parseDateToObject;
	this.parseDateToArray = parseDateToArray;
	this.parseDateToString = parseDateToString;
	this.convertDateObjectToArray = convertDateObjectToArray;
	this.convertDateObjectToString = convertDateObjectToString;
	this.resetDateParserMonths = resetDateParserMonths;
	this.addDateParserMonths = addDateParserMonths;
};
Zotero.DateParser = new Zotero.DateParser();
