{
	"translatorID":"9cb70025-a888-4a29-a210-93ec52da40d4",
	"translatorType":3,
	"label":"BibTeX",
	"creator":"Simon Kornblith",
	"target":"bib",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":200,
	"inRepository":true,
	"lastUpdated":"2008-08-06 13:00:00"
}

Zotero.configure("dataMode", "block");
Zotero.addOption("exportCharset", "UTF-8");

function detectImport() {
	var block = "";
	var read;
	
	var re = /^\s*@[a-zA-Z]+[\(\{]/;
	var lines_read = 0;
	while(read = Zotero.read(1)) {
		if(read == "%") {
			// read until next newline
			block = "";
			while((read = Zotero.read(1)) && read != "\r" && read != "\n") {}
		} else if((read == "\n" || read == "\r") && block) {
			// check if this is a BibTeX entry
			if(re.test(block)) {
				return true;
			}
			
			block = "";
		} else if(" \n\r\t".indexOf(read) == -1) {
			block += read;
		}
	}
}

//%a = first author surname
//%y = year
//%t = first word of title
var citeKeyFormat = "%a_%t_%y";

var fieldMap = {
	address:"place",
	chapter:"section",
	edition:"edition",
//	number:"issue",
	type:"type",
	series:"series",
	title:"title",
	volume:"volume",
	copyright:"rights",
	isbn:"ISBN",
	issn:"ISSN",
	lccn:"callNumber",
	location:"archiveLocation",
	url:"url",
	doi:"DOI",
	"abstract":"abstractNote"
};

var inputFieldMap = {
	booktitle :"publicationTitle",
	school:"publisher",
	institution:"publisher",
	publisher:"publisher"
};

var zotero2bibtexTypeMap = {
	"book":"book",
	"bookSection": function (item) {
		var hasAuthor = false;
		var hasEditor = false;
		for each(var creator in item.creators) {
			if (creator.creatorType == "editor") { hasEditor = true; }
			if (creator.creatorType == "author") { hasAuthor = true; }
		}
		if (hasAuthor && hasEditor) { return "incollection"; }
		return "inbook";
		},
	"journalArticle":"article",
	"magazineArticle":"article",
	"newspaperArticle":"article",
	"thesis":"phdthesis",
	"letter":"misc",
	"manuscript":"unpublished",
	"interview":"misc",
	"film":"misc",
	"artwork":"misc",
	"webpage":"misc",
	"conferencePaper":"inproceedings",
	"report":"techreport"
};

var bibtex2zoteroTypeMap = {
	"book":"book", // or booklet,  proceedings
	"inbook":"bookSection",
	"incollection":"bookSection",
	"article":"journalArticle", // or magazineArticle or newspaperArticle
	"phdthesis":"thesis",
	"unpublished":"manuscript",
	"inproceedings":"conferencePaper", // check for conference also
	"techreport":"report",
	"booklet":"book",
	"incollection":"bookSection",
	"manual":"book",
	"mastersthesis":"thesis",
	"misc":"book",
	"proceedings":"book"
};

/*
 * three-letter month abbreviations. i assume these are the same ones that the
 * docs say are defined in some appendix of the LaTeX book. (i don't have the
 * LaTeX book.)
 */
var months = ["jan", "feb", "mar", "apr", "may", "jun",
              "jul", "aug", "sep", "oct", "nov", "dec"]

/*
 * new mapping table based on that from Matthias Steffens,
 * then enhanced with some fields generated from the unicode table.
 */

var mappingTable = {
    "\u00A0":"~", // NO-BREAK SPACE
    "\u00A1":"{\\textexclamdown}", // INVERTED EXCLAMATION MARK
    "\u00A2":"{\\textcent}", // CENT SIGN
    "\u00A3":"{\\textsterling}", // POUND SIGN
    "\u00A5":"{\\textyen}", // YEN SIGN
    "\u00A6":"{\\textbrokenbar}", // BROKEN BAR
    "\u00A7":"{\\textsection}", // SECTION SIGN
    "\u00A8":"{\\textasciidieresis}", // DIAERESIS
    "\u00A9":"{\\textcopyright}", // COPYRIGHT SIGN
    "\u00AA":"{\\textordfeminine}", // FEMININE ORDINAL INDICATOR
    "\u00AB":"{\\guillemotleft}", // LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
    "\u00AC":"{\\textlnot}", // NOT SIGN
    "\u00AD":"-", // SOFT HYPHEN
    "\u00AE":"{\\textregistered}", // REGISTERED SIGN
    "\u00AF":"{\\textasciimacron}", // MACRON
    "\u00B0":"{\\textdegree}", // DEGREE SIGN
    "\u00B1":"{\\textpm}", // PLUS-MINUS SIGN
    "\u00B2":"{\\texttwosuperior}", // SUPERSCRIPT TWO
    "\u00B3":"{\\textthreesuperior}", // SUPERSCRIPT THREE
    "\u00B4":"{\\textasciiacute}", // ACUTE ACCENT
    "\u00B5":"{\\textmu}", // MICRO SIGN
    "\u00B6":"{\\textparagraph}", // PILCROW SIGN
    "\u00B7":"{\\textperiodcentered}", // MIDDLE DOT
    "\u00B8":"{\\c\\ }", // CEDILLA
    "\u00B9":"{\\textonesuperior}", // SUPERSCRIPT ONE
    "\u00BA":"{\\textordmasculine}", // MASCULINE ORDINAL INDICATOR
    "\u00BB":"{\\guillemotright}", // RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
    "\u00BC":"{\\textonequarter}", // VULGAR FRACTION ONE QUARTER
    "\u00BD":"{\\textonehalf}", // VULGAR FRACTION ONE HALF
    "\u00BE":"{\\textthreequarters}", // VULGAR FRACTION THREE QUARTERS
    "\u00BF":"{\\textquestiondown}", // INVERTED QUESTION MARK
    "\u00C6":"{\\AE}", // LATIN CAPITAL LETTER AE
    "\u00D0":"{\\DH}", // LATIN CAPITAL LETTER ETH
    "\u00D7":"{\\texttimes}", // MULTIPLICATION SIGN
    "\u00DE":"{\\TH}", // LATIN CAPITAL LETTER THORN
    "\u00DF":"{\\ss}", // LATIN SMALL LETTER SHARP S
    "\u00E6":"{\\ae}", // LATIN SMALL LETTER AE
    "\u00F0":"{\\dh}", // LATIN SMALL LETTER ETH
    "\u00F7":"{\\textdiv}", // DIVISION SIGN
    "\u00FE":"{\\th}", // LATIN SMALL LETTER THORN
    "\u0131":"{\\i}", // LATIN SMALL LETTER DOTLESS I
    "\u0132":"IJ", // LATIN CAPITAL LIGATURE IJ
    "\u0133":"ij", // LATIN SMALL LIGATURE IJ
    "\u0138":"k", // LATIN SMALL LETTER KRA
    "\u0149":"'n", // LATIN SMALL LETTER N PRECEDED BY APOSTROPHE
    "\u014A":"{\\NG}", // LATIN CAPITAL LETTER ENG
    "\u014B":"{\\ng}", // LATIN SMALL LETTER ENG
    "\u0152":"{\\OE}", // LATIN CAPITAL LIGATURE OE
    "\u0153":"{\\oe}", // LATIN SMALL LIGATURE OE
    "\u017F":"s", // LATIN SMALL LETTER LONG S
    "\u02B9":"'", // MODIFIER LETTER PRIME
    "\u02BB":"'", // MODIFIER LETTER TURNED COMMA
    "\u02BC":"'", // MODIFIER LETTER APOSTROPHE
    "\u02BD":"'", // MODIFIER LETTER REVERSED COMMA
    "\u02C6":"{\\textasciicircum}", // MODIFIER LETTER CIRCUMFLEX ACCENT
    "\u02C8":"'", // MODIFIER LETTER VERTICAL LINE
    "\u02C9":"-", // MODIFIER LETTER MACRON
    "\u02CC":",", // MODIFIER LETTER LOW VERTICAL LINE
    "\u02D0":":", // MODIFIER LETTER TRIANGULAR COLON
    "\u02DA":"o", // RING ABOVE
    "\u02DC":"\\~{}", // SMALL TILDE
    "\u02DD":"{\\textacutedbl}", // DOUBLE ACUTE ACCENT
    "\u0374":"'", // GREEK NUMERAL SIGN
    "\u0375":",", // GREEK LOWER NUMERAL SIGN
    "\u037E":";", // GREEK QUESTION MARK
    "\u2000":" ", // EN QUAD
    "\u2001":"  ", // EM QUAD
    "\u2002":" ", // EN SPACE
    "\u2003":"  ", // EM SPACE
    "\u2004":" ", // THREE-PER-EM SPACE
    "\u2005":" ", // FOUR-PER-EM SPACE
    "\u2006":" ", // SIX-PER-EM SPACE
    "\u2007":" ", // FIGURE SPACE
    "\u2008":" ", // PUNCTUATION SPACE
    "\u2009":" ", // THIN SPACE
    "\u2010":"-", // HYPHEN
    "\u2011":"-", // NON-BREAKING HYPHEN
    "\u2012":"-", // FIGURE DASH
    "\u2013":"{\\textendash}", // EN DASH
    "\u2014":"{\\textemdash}", // EM DASH
    "\u2015":"--", // HORIZONTAL BAR
    "\u2016":"{\\textbardbl}", // DOUBLE VERTICAL LINE
    "\u2017":"{\\textunderscore}", // DOUBLE LOW LINE
    "\u2018":"{\\textquoteleft}", // LEFT SINGLE QUOTATION MARK
    "\u2019":"{\\textquoteright}", // RIGHT SINGLE QUOTATION MARK
    "\u201A":"{\\quotesinglbase}", // SINGLE LOW-9 QUOTATION MARK
    "\u201B":"'", // SINGLE HIGH-REVERSED-9 QUOTATION MARK
    "\u201C":"{\\textquotedblleft}", // LEFT DOUBLE QUOTATION MARK
    "\u201D":"{\\textquotedblright}", // RIGHT DOUBLE QUOTATION MARK
    "\u201E":"{\\quotedblbase}", // DOUBLE LOW-9 QUOTATION MARK
    "\u201F":"{\\quotedblbase}", // DOUBLE HIGH-REVERSED-9 QUOTATION MARK
    "\u2020":"{\\textdagger}", // DAGGER
    "\u2021":"{\\textdaggerdbl}", // DOUBLE DAGGER
    "\u2022":"{\\textbullet}", // BULLET
    "\u2023":">", // TRIANGULAR BULLET
    "\u2024":".", // ONE DOT LEADER
    "\u2025":"..", // TWO DOT LEADER
    "\u2026":"{\\textellipsis}", // HORIZONTAL ELLIPSIS
    "\u2027":"-", // HYPHENATION POINT
    "\u202F":" ", // NARROW NO-BREAK SPACE
    "\u2030":"{\\textperthousand}", // PER MILLE SIGN
    "\u2032":"'", // PRIME
    "\u2033":"'", // DOUBLE PRIME
    "\u2034":"'''", // TRIPLE PRIME
    "\u2035":"`", // REVERSED PRIME
    "\u2036":"``", // REVERSED DOUBLE PRIME
    "\u2037":"```", // REVERSED TRIPLE PRIME
    "\u2039":"{\\guilsinglleft}", // SINGLE LEFT-POINTING ANGLE QUOTATION MARK
    "\u203A":"{\\guilsinglright}", // SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
    "\u203C":"!!", // DOUBLE EXCLAMATION MARK
    "\u203E":"-", // OVERLINE
    "\u2043":"-", // HYPHEN BULLET
    "\u2044":"{\\textfractionsolidus}", // FRACTION SLASH
    "\u2048":"?!", // QUESTION EXCLAMATION MARK
    "\u2049":"!?", // EXCLAMATION QUESTION MARK
    "\u204A":"7", // TIRONIAN SIGN ET
    "\u2070":"$^{0}$", // SUPERSCRIPT ZERO
    "\u2074":"$^{4}$", // SUPERSCRIPT FOUR
    "\u2075":"$^{5}$", // SUPERSCRIPT FIVE
    "\u2076":"$^{6}$", // SUPERSCRIPT SIX
    "\u2077":"$^{7}$", // SUPERSCRIPT SEVEN
    "\u2078":"$^{8}$", // SUPERSCRIPT EIGHT
    "\u2079":"$^{9}$", // SUPERSCRIPT NINE
    "\u207A":"$^{+}$", // SUPERSCRIPT PLUS SIGN
    "\u207B":"$^{-}$", // SUPERSCRIPT MINUS
    "\u207C":"$^{=}$", // SUPERSCRIPT EQUALS SIGN
    "\u207D":"$^{(}$", // SUPERSCRIPT LEFT PARENTHESIS
    "\u207E":"$^{)}$", // SUPERSCRIPT RIGHT PARENTHESIS
    "\u207F":"$^{n}$", // SUPERSCRIPT LATIN SMALL LETTER N
    "\u2080":"$_{0}$", // SUBSCRIPT ZERO
    "\u2081":"$_{1}$", // SUBSCRIPT ONE
    "\u2082":"$_{2}$", // SUBSCRIPT TWO
    "\u2083":"$_{3}$", // SUBSCRIPT THREE
    "\u2084":"$_{4}$", // SUBSCRIPT FOUR
    "\u2085":"$_{5}$", // SUBSCRIPT FIVE
    "\u2086":"$_{6}$", // SUBSCRIPT SIX
    "\u2087":"$_{7}$", // SUBSCRIPT SEVEN
    "\u2088":"$_{8}$", // SUBSCRIPT EIGHT
    "\u2089":"$_{9}$", // SUBSCRIPT NINE
    "\u208A":"$_{+}$", // SUBSCRIPT PLUS SIGN
    "\u208B":"$_{-}$", // SUBSCRIPT MINUS
    "\u208C":"$_{=}$", // SUBSCRIPT EQUALS SIGN
    "\u208D":"$_{(}$", // SUBSCRIPT LEFT PARENTHESIS
    "\u208E":"$_{)}$", // SUBSCRIPT RIGHT PARENTHESIS
    "\u20AC":"{\\texteuro}", // EURO SIGN
    "\u2100":"a/c", // ACCOUNT OF
    "\u2101":"a/s", // ADDRESSED TO THE SUBJECT
    "\u2103":"{\\textcelsius}", // DEGREE CELSIUS
    "\u2105":"c/o", // CARE OF
    "\u2106":"c/u", // CADA UNA
    "\u2109":"F", // DEGREE FAHRENHEIT
    "\u2113":"l", // SCRIPT SMALL L
    "\u2116":"{\\textnumero}", // NUMERO SIGN
    "\u2117":"{\\textcircledP}", // SOUND RECORDING COPYRIGHT
    "\u2120":"{\\textservicemark}", // SERVICE MARK
    "\u2121":"TEL", // TELEPHONE SIGN
    "\u2122":"{\\texttrademark}", // TRADE MARK SIGN
    "\u2126":"{\\textohm}", // OHM SIGN
    "\u212A":"K", // KELVIN SIGN
    "\u212B":"A", // ANGSTROM SIGN
    "\u212E":"{\\textestimated}", // ESTIMATED SYMBOL
    "\u2153":" 1/3", // VULGAR FRACTION ONE THIRD
    "\u2154":" 2/3", // VULGAR FRACTION TWO THIRDS
    "\u2155":" 1/5", // VULGAR FRACTION ONE FIFTH
    "\u2156":" 2/5", // VULGAR FRACTION TWO FIFTHS
    "\u2157":" 3/5", // VULGAR FRACTION THREE FIFTHS
    "\u2158":" 4/5", // VULGAR FRACTION FOUR FIFTHS
    "\u2159":" 1/6", // VULGAR FRACTION ONE SIXTH
    "\u215A":" 5/6", // VULGAR FRACTION FIVE SIXTHS
    "\u215B":" 1/8", // VULGAR FRACTION ONE EIGHTH
    "\u215C":" 3/8", // VULGAR FRACTION THREE EIGHTHS
    "\u215D":" 5/8", // VULGAR FRACTION FIVE EIGHTHS
    "\u215E":" 7/8", // VULGAR FRACTION SEVEN EIGHTHS
    "\u215F":" 1/", // FRACTION NUMERATOR ONE
    "\u2160":"I", // ROMAN NUMERAL ONE
    "\u2161":"II", // ROMAN NUMERAL TWO
    "\u2162":"III", // ROMAN NUMERAL THREE
    "\u2163":"IV", // ROMAN NUMERAL FOUR
    "\u2164":"V", // ROMAN NUMERAL FIVE
    "\u2165":"VI", // ROMAN NUMERAL SIX
    "\u2166":"VII", // ROMAN NUMERAL SEVEN
    "\u2167":"VIII", // ROMAN NUMERAL EIGHT
    "\u2168":"IX", // ROMAN NUMERAL NINE
    "\u2169":"X", // ROMAN NUMERAL TEN
    "\u216A":"XI", // ROMAN NUMERAL ELEVEN
    "\u216B":"XII", // ROMAN NUMERAL TWELVE
    "\u216C":"L", // ROMAN NUMERAL FIFTY
    "\u216D":"C", // ROMAN NUMERAL ONE HUNDRED
    "\u216E":"D", // ROMAN NUMERAL FIVE HUNDRED
    "\u216F":"M", // ROMAN NUMERAL ONE THOUSAND
    "\u2170":"i", // SMALL ROMAN NUMERAL ONE
    "\u2171":"ii", // SMALL ROMAN NUMERAL TWO
    "\u2172":"iii", // SMALL ROMAN NUMERAL THREE
    "\u2173":"iv", // SMALL ROMAN NUMERAL FOUR
    "\u2174":"v", // SMALL ROMAN NUMERAL FIVE
    "\u2175":"vi", // SMALL ROMAN NUMERAL SIX
    "\u2176":"vii", // SMALL ROMAN NUMERAL SEVEN
    "\u2177":"viii", // SMALL ROMAN NUMERAL EIGHT
    "\u2178":"ix", // SMALL ROMAN NUMERAL NINE
    "\u2179":"x", // SMALL ROMAN NUMERAL TEN
    "\u217A":"xi", // SMALL ROMAN NUMERAL ELEVEN
    "\u217B":"xii", // SMALL ROMAN NUMERAL TWELVE
    "\u217C":"l", // SMALL ROMAN NUMERAL FIFTY
    "\u217D":"c", // SMALL ROMAN NUMERAL ONE HUNDRED
    "\u217E":"d", // SMALL ROMAN NUMERAL FIVE HUNDRED
    "\u217F":"m", // SMALL ROMAN NUMERAL ONE THOUSAND
    "\u2190":"{\\textleftarrow}", // LEFTWARDS ARROW
    "\u2191":"{\\textuparrow}", // UPWARDS ARROW
    "\u2192":"{\\textrightarrow}", // RIGHTWARDS ARROW
    "\u2193":"{\\textdownarrow}", // DOWNWARDS ARROW
    "\u2194":"<->", // LEFT RIGHT ARROW
    "\u21D0":"<=", // LEFTWARDS DOUBLE ARROW
    "\u21D2":"=>", // RIGHTWARDS DOUBLE ARROW
    "\u21D4":"<=>", // LEFT RIGHT DOUBLE ARROW
    "\u2212":"-", // MINUS SIGN
    "\u2215":"/", // DIVISION SLASH
    "\u2216":"\\", // SET MINUS
    "\u2217":"*", // ASTERISK OPERATOR
    "\u2218":"o", // RING OPERATOR
    "\u2219":".", // BULLET OPERATOR
    "\u221E":"$\\infty$", // INFINITY
    "\u2223":"|", // DIVIDES
    "\u2225":"||", // PARALLEL TO
    "\u2236":":", // RATIO
    "\u223C":"\\~{}", // TILDE OPERATOR
    "\u2260":"/=", // NOT EQUAL TO
    "\u2261":"=", // IDENTICAL TO
    "\u2264":"<=", // LESS-THAN OR EQUAL TO
    "\u2265":">=", // GREATER-THAN OR EQUAL TO
    "\u226A":"<<", // MUCH LESS-THAN
    "\u226B":">>", // MUCH GREATER-THAN
    "\u2295":"(+)", // CIRCLED PLUS
    "\u2296":"(-)", // CIRCLED MINUS
    "\u2297":"(x)", // CIRCLED TIMES
    "\u2298":"(/)", // CIRCLED DIVISION SLASH
    "\u22A2":"|-", // RIGHT TACK
    "\u22A3":"-|", // LEFT TACK
    "\u22A6":"|-", // ASSERTION
    "\u22A7":"|=", // MODELS
    "\u22A8":"|=", // TRUE
    "\u22A9":"||-", // FORCES
    "\u22C5":".", // DOT OPERATOR
    "\u22C6":"*", // STAR OPERATOR
    "\u22D5":"$\\#$", // EQUAL AND PARALLEL TO
    "\u22D8":"<<<", // VERY MUCH LESS-THAN
    "\u22D9":">>>", // VERY MUCH GREATER-THAN
    "\u22EF":"...", // MIDLINE HORIZONTAL ELLIPSIS
    "\u2329":"{\\textlangle}", // LEFT-POINTING ANGLE BRACKET
    "\u232A":"{\\textrangle}", // RIGHT-POINTING ANGLE BRACKET
    "\u2400":"NUL", // SYMBOL FOR NULL
    "\u2401":"SOH", // SYMBOL FOR START OF HEADING
    "\u2402":"STX", // SYMBOL FOR START OF TEXT
    "\u2403":"ETX", // SYMBOL FOR END OF TEXT
    "\u2404":"EOT", // SYMBOL FOR END OF TRANSMISSION
    "\u2405":"ENQ", // SYMBOL FOR ENQUIRY
    "\u2406":"ACK", // SYMBOL FOR ACKNOWLEDGE
    "\u2407":"BEL", // SYMBOL FOR BELL
    "\u2408":"BS", // SYMBOL FOR BACKSPACE
    "\u2409":"HT", // SYMBOL FOR HORIZONTAL TABULATION
    "\u240A":"LF", // SYMBOL FOR LINE FEED
    "\u240B":"VT", // SYMBOL FOR VERTICAL TABULATION
    "\u240C":"FF", // SYMBOL FOR FORM FEED
    "\u240D":"CR", // SYMBOL FOR CARRIAGE RETURN
    "\u240E":"SO", // SYMBOL FOR SHIFT OUT
    "\u240F":"SI", // SYMBOL FOR SHIFT IN
    "\u2410":"DLE", // SYMBOL FOR DATA LINK ESCAPE
    "\u2411":"DC1", // SYMBOL FOR DEVICE CONTROL ONE
    "\u2412":"DC2", // SYMBOL FOR DEVICE CONTROL TWO
    "\u2413":"DC3", // SYMBOL FOR DEVICE CONTROL THREE
    "\u2414":"DC4", // SYMBOL FOR DEVICE CONTROL FOUR
    "\u2415":"NAK", // SYMBOL FOR NEGATIVE ACKNOWLEDGE
    "\u2416":"SYN", // SYMBOL FOR SYNCHRONOUS IDLE
    "\u2417":"ETB", // SYMBOL FOR END OF TRANSMISSION BLOCK
    "\u2418":"CAN", // SYMBOL FOR CANCEL
    "\u2419":"EM", // SYMBOL FOR END OF MEDIUM
    "\u241A":"SUB", // SYMBOL FOR SUBSTITUTE
    "\u241B":"ESC", // SYMBOL FOR ESCAPE
    "\u241C":"FS", // SYMBOL FOR FILE SEPARATOR
    "\u241D":"GS", // SYMBOL FOR GROUP SEPARATOR
    "\u241E":"RS", // SYMBOL FOR RECORD SEPARATOR
    "\u241F":"US", // SYMBOL FOR UNIT SEPARATOR
    "\u2420":"SP", // SYMBOL FOR SPACE
    "\u2421":"DEL", // SYMBOL FOR DELETE
    "\u2423":"{\\textvisiblespace}", // OPEN BOX
    "\u2424":"NL", // SYMBOL FOR NEWLINE
    "\u2425":"///", // SYMBOL FOR DELETE FORM TWO
    "\u2426":"?", // SYMBOL FOR SUBSTITUTE FORM TWO
    "\u2460":"(1)", // CIRCLED DIGIT ONE
    "\u2461":"(2)", // CIRCLED DIGIT TWO
    "\u2462":"(3)", // CIRCLED DIGIT THREE
    "\u2463":"(4)", // CIRCLED DIGIT FOUR
    "\u2464":"(5)", // CIRCLED DIGIT FIVE
    "\u2465":"(6)", // CIRCLED DIGIT SIX
    "\u2466":"(7)", // CIRCLED DIGIT SEVEN
    "\u2467":"(8)", // CIRCLED DIGIT EIGHT
    "\u2468":"(9)", // CIRCLED DIGIT NINE
    "\u2469":"(10)", // CIRCLED NUMBER TEN
    "\u246A":"(11)", // CIRCLED NUMBER ELEVEN
    "\u246B":"(12)", // CIRCLED NUMBER TWELVE
    "\u246C":"(13)", // CIRCLED NUMBER THIRTEEN
    "\u246D":"(14)", // CIRCLED NUMBER FOURTEEN
    "\u246E":"(15)", // CIRCLED NUMBER FIFTEEN
    "\u246F":"(16)", // CIRCLED NUMBER SIXTEEN
    "\u2470":"(17)", // CIRCLED NUMBER SEVENTEEN
    "\u2471":"(18)", // CIRCLED NUMBER EIGHTEEN
    "\u2472":"(19)", // CIRCLED NUMBER NINETEEN
    "\u2473":"(20)", // CIRCLED NUMBER TWENTY
    "\u2474":"(1)", // PARENTHESIZED DIGIT ONE
    "\u2475":"(2)", // PARENTHESIZED DIGIT TWO
    "\u2476":"(3)", // PARENTHESIZED DIGIT THREE
    "\u2477":"(4)", // PARENTHESIZED DIGIT FOUR
    "\u2478":"(5)", // PARENTHESIZED DIGIT FIVE
    "\u2479":"(6)", // PARENTHESIZED DIGIT SIX
    "\u247A":"(7)", // PARENTHESIZED DIGIT SEVEN
    "\u247B":"(8)", // PARENTHESIZED DIGIT EIGHT
    "\u247C":"(9)", // PARENTHESIZED DIGIT NINE
    "\u247D":"(10)", // PARENTHESIZED NUMBER TEN
    "\u247E":"(11)", // PARENTHESIZED NUMBER ELEVEN
    "\u247F":"(12)", // PARENTHESIZED NUMBER TWELVE
    "\u2480":"(13)", // PARENTHESIZED NUMBER THIRTEEN
    "\u2481":"(14)", // PARENTHESIZED NUMBER FOURTEEN
    "\u2482":"(15)", // PARENTHESIZED NUMBER FIFTEEN
    "\u2483":"(16)", // PARENTHESIZED NUMBER SIXTEEN
    "\u2484":"(17)", // PARENTHESIZED NUMBER SEVENTEEN
    "\u2485":"(18)", // PARENTHESIZED NUMBER EIGHTEEN
    "\u2486":"(19)", // PARENTHESIZED NUMBER NINETEEN
    "\u2487":"(20)", // PARENTHESIZED NUMBER TWENTY
    "\u2488":"1.", // DIGIT ONE FULL STOP
    "\u2489":"2.", // DIGIT TWO FULL STOP
    "\u248A":"3.", // DIGIT THREE FULL STOP
    "\u248B":"4.", // DIGIT FOUR FULL STOP
    "\u248C":"5.", // DIGIT FIVE FULL STOP
    "\u248D":"6.", // DIGIT SIX FULL STOP
    "\u248E":"7.", // DIGIT SEVEN FULL STOP
    "\u248F":"8.", // DIGIT EIGHT FULL STOP
    "\u2490":"9.", // DIGIT NINE FULL STOP
    "\u2491":"10.", // NUMBER TEN FULL STOP
    "\u2492":"11.", // NUMBER ELEVEN FULL STOP
    "\u2493":"12.", // NUMBER TWELVE FULL STOP
    "\u2494":"13.", // NUMBER THIRTEEN FULL STOP
    "\u2495":"14.", // NUMBER FOURTEEN FULL STOP
    "\u2496":"15.", // NUMBER FIFTEEN FULL STOP
    "\u2497":"16.", // NUMBER SIXTEEN FULL STOP
    "\u2498":"17.", // NUMBER SEVENTEEN FULL STOP
    "\u2499":"18.", // NUMBER EIGHTEEN FULL STOP
    "\u249A":"19.", // NUMBER NINETEEN FULL STOP
    "\u249B":"20.", // NUMBER TWENTY FULL STOP
    "\u249C":"(a)", // PARENTHESIZED LATIN SMALL LETTER A
    "\u249D":"(b)", // PARENTHESIZED LATIN SMALL LETTER B
    "\u249E":"(c)", // PARENTHESIZED LATIN SMALL LETTER C
    "\u249F":"(d)", // PARENTHESIZED LATIN SMALL LETTER D
    "\u24A0":"(e)", // PARENTHESIZED LATIN SMALL LETTER E
    "\u24A1":"(f)", // PARENTHESIZED LATIN SMALL LETTER F
    "\u24A2":"(g)", // PARENTHESIZED LATIN SMALL LETTER G
    "\u24A3":"(h)", // PARENTHESIZED LATIN SMALL LETTER H
    "\u24A4":"(i)", // PARENTHESIZED LATIN SMALL LETTER I
    "\u24A5":"(j)", // PARENTHESIZED LATIN SMALL LETTER J
    "\u24A6":"(k)", // PARENTHESIZED LATIN SMALL LETTER K
    "\u24A7":"(l)", // PARENTHESIZED LATIN SMALL LETTER L
    "\u24A8":"(m)", // PARENTHESIZED LATIN SMALL LETTER M
    "\u24A9":"(n)", // PARENTHESIZED LATIN SMALL LETTER N
    "\u24AA":"(o)", // PARENTHESIZED LATIN SMALL LETTER O
    "\u24AB":"(p)", // PARENTHESIZED LATIN SMALL LETTER P
    "\u24AC":"(q)", // PARENTHESIZED LATIN SMALL LETTER Q
    "\u24AD":"(r)", // PARENTHESIZED LATIN SMALL LETTER R
    "\u24AE":"(s)", // PARENTHESIZED LATIN SMALL LETTER S
    "\u24AF":"(t)", // PARENTHESIZED LATIN SMALL LETTER T
    "\u24B0":"(u)", // PARENTHESIZED LATIN SMALL LETTER U
    "\u24B1":"(v)", // PARENTHESIZED LATIN SMALL LETTER V
    "\u24B2":"(w)", // PARENTHESIZED LATIN SMALL LETTER W
    "\u24B3":"(x)", // PARENTHESIZED LATIN SMALL LETTER X
    "\u24B4":"(y)", // PARENTHESIZED LATIN SMALL LETTER Y
    "\u24B5":"(z)", // PARENTHESIZED LATIN SMALL LETTER Z
    "\u24B6":"(A)", // CIRCLED LATIN CAPITAL LETTER A
    "\u24B7":"(B)", // CIRCLED LATIN CAPITAL LETTER B
    "\u24B8":"(C)", // CIRCLED LATIN CAPITAL LETTER C
    "\u24B9":"(D)", // CIRCLED LATIN CAPITAL LETTER D
    "\u24BA":"(E)", // CIRCLED LATIN CAPITAL LETTER E
    "\u24BB":"(F)", // CIRCLED LATIN CAPITAL LETTER F
    "\u24BC":"(G)", // CIRCLED LATIN CAPITAL LETTER G
    "\u24BD":"(H)", // CIRCLED LATIN CAPITAL LETTER H
    "\u24BE":"(I)", // CIRCLED LATIN CAPITAL LETTER I
    "\u24BF":"(J)", // CIRCLED LATIN CAPITAL LETTER J
    "\u24C0":"(K)", // CIRCLED LATIN CAPITAL LETTER K
    "\u24C1":"(L)", // CIRCLED LATIN CAPITAL LETTER L
    "\u24C2":"(M)", // CIRCLED LATIN CAPITAL LETTER M
    "\u24C3":"(N)", // CIRCLED LATIN CAPITAL LETTER N
    "\u24C4":"(O)", // CIRCLED LATIN CAPITAL LETTER O
    "\u24C5":"(P)", // CIRCLED LATIN CAPITAL LETTER P
    "\u24C6":"(Q)", // CIRCLED LATIN CAPITAL LETTER Q
    "\u24C7":"(R)", // CIRCLED LATIN CAPITAL LETTER R
    "\u24C8":"(S)", // CIRCLED LATIN CAPITAL LETTER S
    "\u24C9":"(T)", // CIRCLED LATIN CAPITAL LETTER T
    "\u24CA":"(U)", // CIRCLED LATIN CAPITAL LETTER U
    "\u24CB":"(V)", // CIRCLED LATIN CAPITAL LETTER V
    "\u24CC":"(W)", // CIRCLED LATIN CAPITAL LETTER W
    "\u24CD":"(X)", // CIRCLED LATIN CAPITAL LETTER X
    "\u24CE":"(Y)", // CIRCLED LATIN CAPITAL LETTER Y
    "\u24CF":"(Z)", // CIRCLED LATIN CAPITAL LETTER Z
    "\u24D0":"(a)", // CIRCLED LATIN SMALL LETTER A
    "\u24D1":"(b)", // CIRCLED LATIN SMALL LETTER B
    "\u24D2":"(c)", // CIRCLED LATIN SMALL LETTER C
    "\u24D3":"(d)", // CIRCLED LATIN SMALL LETTER D
    "\u24D4":"(e)", // CIRCLED LATIN SMALL LETTER E
    "\u24D5":"(f)", // CIRCLED LATIN SMALL LETTER F
    "\u24D6":"(g)", // CIRCLED LATIN SMALL LETTER G
    "\u24D7":"(h)", // CIRCLED LATIN SMALL LETTER H
    "\u24D8":"(i)", // CIRCLED LATIN SMALL LETTER I
    "\u24D9":"(j)", // CIRCLED LATIN SMALL LETTER J
    "\u24DA":"(k)", // CIRCLED LATIN SMALL LETTER K
    "\u24DB":"(l)", // CIRCLED LATIN SMALL LETTER L
    "\u24DC":"(m)", // CIRCLED LATIN SMALL LETTER M
    "\u24DD":"(n)", // CIRCLED LATIN SMALL LETTER N
    "\u24DE":"(o)", // CIRCLED LATIN SMALL LETTER O
    "\u24DF":"(p)", // CIRCLED LATIN SMALL LETTER P
    "\u24E0":"(q)", // CIRCLED LATIN SMALL LETTER Q
    "\u24E1":"(r)", // CIRCLED LATIN SMALL LETTER R
    "\u24E2":"(s)", // CIRCLED LATIN SMALL LETTER S
    "\u24E3":"(t)", // CIRCLED LATIN SMALL LETTER T
    "\u24E4":"(u)", // CIRCLED LATIN SMALL LETTER U
    "\u24E5":"(v)", // CIRCLED LATIN SMALL LETTER V
    "\u24E6":"(w)", // CIRCLED LATIN SMALL LETTER W
    "\u24E7":"(x)", // CIRCLED LATIN SMALL LETTER X
    "\u24E8":"(y)", // CIRCLED LATIN SMALL LETTER Y
    "\u24E9":"(z)", // CIRCLED LATIN SMALL LETTER Z
    "\u24EA":"(0)", // CIRCLED DIGIT ZERO
    "\u2500":"-", // BOX DRAWINGS LIGHT HORIZONTAL
    "\u2501":"=", // BOX DRAWINGS HEAVY HORIZONTAL
    "\u2502":"|", // BOX DRAWINGS LIGHT VERTICAL
    "\u2503":"|", // BOX DRAWINGS HEAVY VERTICAL
    "\u2504":"-", // BOX DRAWINGS LIGHT TRIPLE DASH HORIZONTAL
    "\u2505":"=", // BOX DRAWINGS HEAVY TRIPLE DASH HORIZONTAL
    "\u2506":"|", // BOX DRAWINGS LIGHT TRIPLE DASH VERTICAL
    "\u2507":"|", // BOX DRAWINGS HEAVY TRIPLE DASH VERTICAL
    "\u2508":"-", // BOX DRAWINGS LIGHT QUADRUPLE DASH HORIZONTAL
    "\u2509":"=", // BOX DRAWINGS HEAVY QUADRUPLE DASH HORIZONTAL
    "\u250A":"|", // BOX DRAWINGS LIGHT QUADRUPLE DASH VERTICAL
    "\u250B":"|", // BOX DRAWINGS HEAVY QUADRUPLE DASH VERTICAL
    "\u250C":"+", // BOX DRAWINGS LIGHT DOWN AND RIGHT
    "\u250D":"+", // BOX DRAWINGS DOWN LIGHT AND RIGHT HEAVY
    "\u250E":"+", // BOX DRAWINGS DOWN HEAVY AND RIGHT LIGHT
    "\u250F":"+", // BOX DRAWINGS HEAVY DOWN AND RIGHT
    "\u2510":"+", // BOX DRAWINGS LIGHT DOWN AND LEFT
    "\u2511":"+", // BOX DRAWINGS DOWN LIGHT AND LEFT HEAVY
    "\u2512":"+", // BOX DRAWINGS DOWN HEAVY AND LEFT LIGHT
    "\u2513":"+", // BOX DRAWINGS HEAVY DOWN AND LEFT
    "\u2514":"+", // BOX DRAWINGS LIGHT UP AND RIGHT
    "\u2515":"+", // BOX DRAWINGS UP LIGHT AND RIGHT HEAVY
    "\u2516":"+", // BOX DRAWINGS UP HEAVY AND RIGHT LIGHT
    "\u2517":"+", // BOX DRAWINGS HEAVY UP AND RIGHT
    "\u2518":"+", // BOX DRAWINGS LIGHT UP AND LEFT
    "\u2519":"+", // BOX DRAWINGS UP LIGHT AND LEFT HEAVY
    "\u251A":"+", // BOX DRAWINGS UP HEAVY AND LEFT LIGHT
    "\u251B":"+", // BOX DRAWINGS HEAVY UP AND LEFT
    "\u251C":"+", // BOX DRAWINGS LIGHT VERTICAL AND RIGHT
    "\u251D":"+", // BOX DRAWINGS VERTICAL LIGHT AND RIGHT HEAVY
    "\u251E":"+", // BOX DRAWINGS UP HEAVY AND RIGHT DOWN LIGHT
    "\u251F":"+", // BOX DRAWINGS DOWN HEAVY AND RIGHT UP LIGHT
    "\u2520":"+", // BOX DRAWINGS VERTICAL HEAVY AND RIGHT LIGHT
    "\u2521":"+", // BOX DRAWINGS DOWN LIGHT AND RIGHT UP HEAVY
    "\u2522":"+", // BOX DRAWINGS UP LIGHT AND RIGHT DOWN HEAVY
    "\u2523":"+", // BOX DRAWINGS HEAVY VERTICAL AND RIGHT
    "\u2524":"+", // BOX DRAWINGS LIGHT VERTICAL AND LEFT
    "\u2525":"+", // BOX DRAWINGS VERTICAL LIGHT AND LEFT HEAVY
    "\u2526":"+", // BOX DRAWINGS UP HEAVY AND LEFT DOWN LIGHT
    "\u2527":"+", // BOX DRAWINGS DOWN HEAVY AND LEFT UP LIGHT
    "\u2528":"+", // BOX DRAWINGS VERTICAL HEAVY AND LEFT LIGHT
    "\u2529":"+", // BOX DRAWINGS DOWN LIGHT AND LEFT UP HEAVY
    "\u252A":"+", // BOX DRAWINGS UP LIGHT AND LEFT DOWN HEAVY
    "\u252B":"+", // BOX DRAWINGS HEAVY VERTICAL AND LEFT
    "\u252C":"+", // BOX DRAWINGS LIGHT DOWN AND HORIZONTAL
    "\u252D":"+", // BOX DRAWINGS LEFT HEAVY AND RIGHT DOWN LIGHT
    "\u252E":"+", // BOX DRAWINGS RIGHT HEAVY AND LEFT DOWN LIGHT
    "\u252F":"+", // BOX DRAWINGS DOWN LIGHT AND HORIZONTAL HEAVY
    "\u2530":"+", // BOX DRAWINGS DOWN HEAVY AND HORIZONTAL LIGHT
    "\u2531":"+", // BOX DRAWINGS RIGHT LIGHT AND LEFT DOWN HEAVY
    "\u2532":"+", // BOX DRAWINGS LEFT LIGHT AND RIGHT DOWN HEAVY
    "\u2533":"+", // BOX DRAWINGS HEAVY DOWN AND HORIZONTAL
    "\u2534":"+", // BOX DRAWINGS LIGHT UP AND HORIZONTAL
    "\u2535":"+", // BOX DRAWINGS LEFT HEAVY AND RIGHT UP LIGHT
    "\u2536":"+", // BOX DRAWINGS RIGHT HEAVY AND LEFT UP LIGHT
    "\u2537":"+", // BOX DRAWINGS UP LIGHT AND HORIZONTAL HEAVY
    "\u2538":"+", // BOX DRAWINGS UP HEAVY AND HORIZONTAL LIGHT
    "\u2539":"+", // BOX DRAWINGS RIGHT LIGHT AND LEFT UP HEAVY
    "\u253A":"+", // BOX DRAWINGS LEFT LIGHT AND RIGHT UP HEAVY
    "\u253B":"+", // BOX DRAWINGS HEAVY UP AND HORIZONTAL
    "\u253C":"+", // BOX DRAWINGS LIGHT VERTICAL AND HORIZONTAL
    "\u253D":"+", // BOX DRAWINGS LEFT HEAVY AND RIGHT VERTICAL LIGHT
    "\u253E":"+", // BOX DRAWINGS RIGHT HEAVY AND LEFT VERTICAL LIGHT
    "\u253F":"+", // BOX DRAWINGS VERTICAL LIGHT AND HORIZONTAL HEAVY
    "\u2540":"+", // BOX DRAWINGS UP HEAVY AND DOWN HORIZONTAL LIGHT
    "\u2541":"+", // BOX DRAWINGS DOWN HEAVY AND UP HORIZONTAL LIGHT
    "\u2542":"+", // BOX DRAWINGS VERTICAL HEAVY AND HORIZONTAL LIGHT
    "\u2543":"+", // BOX DRAWINGS LEFT UP HEAVY AND RIGHT DOWN LIGHT
    "\u2544":"+", // BOX DRAWINGS RIGHT UP HEAVY AND LEFT DOWN LIGHT
    "\u2545":"+", // BOX DRAWINGS LEFT DOWN HEAVY AND RIGHT UP LIGHT
    "\u2546":"+", // BOX DRAWINGS RIGHT DOWN HEAVY AND LEFT UP LIGHT
    "\u2547":"+", // BOX DRAWINGS DOWN LIGHT AND UP HORIZONTAL HEAVY
    "\u2548":"+", // BOX DRAWINGS UP LIGHT AND DOWN HORIZONTAL HEAVY
    "\u2549":"+", // BOX DRAWINGS RIGHT LIGHT AND LEFT VERTICAL HEAVY
    "\u254A":"+", // BOX DRAWINGS LEFT LIGHT AND RIGHT VERTICAL HEAVY
    "\u254B":"+", // BOX DRAWINGS HEAVY VERTICAL AND HORIZONTAL
    "\u254C":"-", // BOX DRAWINGS LIGHT DOUBLE DASH HORIZONTAL
    "\u254D":"=", // BOX DRAWINGS HEAVY DOUBLE DASH HORIZONTAL
    "\u254E":"|", // BOX DRAWINGS LIGHT DOUBLE DASH VERTICAL
    "\u254F":"|", // BOX DRAWINGS HEAVY DOUBLE DASH VERTICAL
    "\u2550":"=", // BOX DRAWINGS DOUBLE HORIZONTAL
    "\u2551":"|", // BOX DRAWINGS DOUBLE VERTICAL
    "\u2552":"+", // BOX DRAWINGS DOWN SINGLE AND RIGHT DOUBLE
    "\u2553":"+", // BOX DRAWINGS DOWN DOUBLE AND RIGHT SINGLE
    "\u2554":"+", // BOX DRAWINGS DOUBLE DOWN AND RIGHT
    "\u2555":"+", // BOX DRAWINGS DOWN SINGLE AND LEFT DOUBLE
    "\u2556":"+", // BOX DRAWINGS DOWN DOUBLE AND LEFT SINGLE
    "\u2557":"+", // BOX DRAWINGS DOUBLE DOWN AND LEFT
    "\u2558":"+", // BOX DRAWINGS UP SINGLE AND RIGHT DOUBLE
    "\u2559":"+", // BOX DRAWINGS UP DOUBLE AND RIGHT SINGLE
    "\u255A":"+", // BOX DRAWINGS DOUBLE UP AND RIGHT
    "\u255B":"+", // BOX DRAWINGS UP SINGLE AND LEFT DOUBLE
    "\u255C":"+", // BOX DRAWINGS UP DOUBLE AND LEFT SINGLE
    "\u255D":"+", // BOX DRAWINGS DOUBLE UP AND LEFT
    "\u255E":"+", // BOX DRAWINGS VERTICAL SINGLE AND RIGHT DOUBLE
    "\u255F":"+", // BOX DRAWINGS VERTICAL DOUBLE AND RIGHT SINGLE
    "\u2560":"+", // BOX DRAWINGS DOUBLE VERTICAL AND RIGHT
    "\u2561":"+", // BOX DRAWINGS VERTICAL SINGLE AND LEFT DOUBLE
    "\u2562":"+", // BOX DRAWINGS VERTICAL DOUBLE AND LEFT SINGLE
    "\u2563":"+", // BOX DRAWINGS DOUBLE VERTICAL AND LEFT
    "\u2564":"+", // BOX DRAWINGS DOWN SINGLE AND HORIZONTAL DOUBLE
    "\u2565":"+", // BOX DRAWINGS DOWN DOUBLE AND HORIZONTAL SINGLE
    "\u2566":"+", // BOX DRAWINGS DOUBLE DOWN AND HORIZONTAL
    "\u2567":"+", // BOX DRAWINGS UP SINGLE AND HORIZONTAL DOUBLE
    "\u2568":"+", // BOX DRAWINGS UP DOUBLE AND HORIZONTAL SINGLE
    "\u2569":"+", // BOX DRAWINGS DOUBLE UP AND HORIZONTAL
    "\u256A":"+", // BOX DRAWINGS VERTICAL SINGLE AND HORIZONTAL DOUBLE
    "\u256B":"+", // BOX DRAWINGS VERTICAL DOUBLE AND HORIZONTAL SINGLE
    "\u256C":"+", // BOX DRAWINGS DOUBLE VERTICAL AND HORIZONTAL
    "\u256D":"+", // BOX DRAWINGS LIGHT ARC DOWN AND RIGHT
    "\u256E":"+", // BOX DRAWINGS LIGHT ARC DOWN AND LEFT
    "\u256F":"+", // BOX DRAWINGS LIGHT ARC UP AND LEFT
    "\u2570":"+", // BOX DRAWINGS LIGHT ARC UP AND RIGHT
    "\u2571":"/", // BOX DRAWINGS LIGHT DIAGONAL UPPER RIGHT TO LOWER LEFT
    "\u2572":"\\", // BOX DRAWINGS LIGHT DIAGONAL UPPER LEFT TO LOWER RIGHT
    "\u2573":"X", // BOX DRAWINGS LIGHT DIAGONAL CROSS
    "\u257C":"-", // BOX DRAWINGS LIGHT LEFT AND HEAVY RIGHT
    "\u257D":"|", // BOX DRAWINGS LIGHT UP AND HEAVY DOWN
    "\u257E":"-", // BOX DRAWINGS HEAVY LEFT AND LIGHT RIGHT
    "\u257F":"|", // BOX DRAWINGS HEAVY UP AND LIGHT DOWN
    "\u25CB":"o", // WHITE CIRCLE
    "\u25E6":"{\\textopenbullet}", // WHITE BULLET
    "\u2605":"*", // BLACK STAR
    "\u2606":"*", // WHITE STAR
    "\u2612":"X", // BALLOT BOX WITH X
    "\u2613":"X", // SALTIRE
    "\u2639":":-(", // WHITE FROWNING FACE
    "\u263A":":-)", // WHITE SMILING FACE
    "\u263B":"(-:", // BLACK SMILING FACE
    "\u266D":"b", // MUSIC FLAT SIGN
    "\u266F":"$\\#$", // MUSIC SHARP SIGN
    "\u2701":"$\\%<$", // UPPER BLADE SCISSORS
    "\u2702":"$\\%<$", // BLACK SCISSORS
    "\u2703":"$\\%<$", // LOWER BLADE SCISSORS
    "\u2704":"$\\%<$", // WHITE SCISSORS
    "\u270C":"V", // VICTORY HAND
    "\u2713":"v", // CHECK MARK
    "\u2714":"V", // HEAVY CHECK MARK
    "\u2715":"x", // MULTIPLICATION X
    "\u2716":"x", // HEAVY MULTIPLICATION X
    "\u2717":"X", // BALLOT X
    "\u2718":"X", // HEAVY BALLOT X
    "\u2719":"+", // OUTLINED GREEK CROSS
    "\u271A":"+", // HEAVY GREEK CROSS
    "\u271B":"+", // OPEN CENTRE CROSS
    "\u271C":"+", // HEAVY OPEN CENTRE CROSS
    "\u271D":"+", // LATIN CROSS
    "\u271E":"+", // SHADOWED WHITE LATIN CROSS
    "\u271F":"+", // OUTLINED LATIN CROSS
    "\u2720":"+", // MALTESE CROSS
    "\u2721":"*", // STAR OF DAVID
    "\u2722":"+", // FOUR TEARDROP-SPOKED ASTERISK
    "\u2723":"+", // FOUR BALLOON-SPOKED ASTERISK
    "\u2724":"+", // HEAVY FOUR BALLOON-SPOKED ASTERISK
    "\u2725":"+", // FOUR CLUB-SPOKED ASTERISK
    "\u2726":"+", // BLACK FOUR POINTED STAR
    "\u2727":"+", // WHITE FOUR POINTED STAR
    "\u2729":"*", // STRESS OUTLINED WHITE STAR
    "\u272A":"*", // CIRCLED WHITE STAR
    "\u272B":"*", // OPEN CENTRE BLACK STAR
    "\u272C":"*", // BLACK CENTRE WHITE STAR
    "\u272D":"*", // OUTLINED BLACK STAR
    "\u272E":"*", // HEAVY OUTLINED BLACK STAR
    "\u272F":"*", // PINWHEEL STAR
    "\u2730":"*", // SHADOWED WHITE STAR
    "\u2731":"*", // HEAVY ASTERISK
    "\u2732":"*", // OPEN CENTRE ASTERISK
    "\u2733":"*", // EIGHT SPOKED ASTERISK
    "\u2734":"*", // EIGHT POINTED BLACK STAR
    "\u2735":"*", // EIGHT POINTED PINWHEEL STAR
    "\u2736":"*", // SIX POINTED BLACK STAR
    "\u2737":"*", // EIGHT POINTED RECTILINEAR BLACK STAR
    "\u2738":"*", // HEAVY EIGHT POINTED RECTILINEAR BLACK STAR
    "\u2739":"*", // TWELVE POINTED BLACK STAR
    "\u273A":"*", // SIXTEEN POINTED ASTERISK
    "\u273B":"*", // TEARDROP-SPOKED ASTERISK
    "\u273C":"*", // OPEN CENTRE TEARDROP-SPOKED ASTERISK
    "\u273D":"*", // HEAVY TEARDROP-SPOKED ASTERISK
    "\u273E":"*", // SIX PETALLED BLACK AND WHITE FLORETTE
    "\u273F":"*", // BLACK FLORETTE
    "\u2740":"*", // WHITE FLORETTE
    "\u2741":"*", // EIGHT PETALLED OUTLINED BLACK FLORETTE
    "\u2742":"*", // CIRCLED OPEN CENTRE EIGHT POINTED STAR
    "\u2743":"*", // HEAVY TEARDROP-SPOKED PINWHEEL ASTERISK
    "\u2744":"*", // SNOWFLAKE
    "\u2745":"*", // TIGHT TRIFOLIATE SNOWFLAKE
    "\u2746":"*", // HEAVY CHEVRON SNOWFLAKE
    "\u2747":"*", // SPARKLE
    "\u2748":"*", // HEAVY SPARKLE
    "\u2749":"*", // BALLOON-SPOKED ASTERISK
    "\u274A":"*", // EIGHT TEARDROP-SPOKED PROPELLER ASTERISK
    "\u274B":"*", // HEAVY EIGHT TEARDROP-SPOKED PROPELLER ASTERISK
    "\uFB00":"ff", // LATIN SMALL LIGATURE FF
    "\uFB01":"fi", // LATIN SMALL LIGATURE FI
    "\uFB02":"fl", // LATIN SMALL LIGATURE FL
    "\uFB03":"ffi", // LATIN SMALL LIGATURE FFI
    "\uFB04":"ffl", // LATIN SMALL LIGATURE FFL
    "\uFB05":"st", // LATIN SMALL LIGATURE LONG S T
    "\uFB06":"st", // LATIN SMALL LIGATURE ST
/* Derived accented characters */
    "\u00C0":"\\`{A}", // LATIN CAPITAL LETTER A WITH GRAVE
    "\u00C1":"\\'{A}", // LATIN CAPITAL LETTER A WITH ACUTE
    "\u00C2":"\\^{A}", // LATIN CAPITAL LETTER A WITH CIRCUMFLEX
    "\u00C3":"\\~{A}", // LATIN CAPITAL LETTER A WITH TILDE
    "\u00C4":"\\\"{A}", // LATIN CAPITAL LETTER A WITH DIAERESIS
    "\u00C7":"\\c{C}", // LATIN CAPITAL LETTER C WITH CEDILLA
    "\u00C8":"\\`{E}", // LATIN CAPITAL LETTER E WITH GRAVE
    "\u00C9":"\\'{E}", // LATIN CAPITAL LETTER E WITH ACUTE
    "\u00CA":"\\^{E}", // LATIN CAPITAL LETTER E WITH CIRCUMFLEX
    "\u00CB":"\\\"{E}", // LATIN CAPITAL LETTER E WITH DIAERESIS
    "\u00CC":"\\`{I}", // LATIN CAPITAL LETTER I WITH GRAVE
    "\u00CD":"\\'{I}", // LATIN CAPITAL LETTER I WITH ACUTE
    "\u00CE":"\\^{I}", // LATIN CAPITAL LETTER I WITH CIRCUMFLEX
    "\u00CF":"\\\"{I}", // LATIN CAPITAL LETTER I WITH DIAERESIS
    "\u00D1":"\\~{N}", // LATIN CAPITAL LETTER N WITH TILDE
    "\u00D2":"\\`{O}", // LATIN CAPITAL LETTER O WITH GRAVE
    "\u00D3":"\\'{O}", // LATIN CAPITAL LETTER O WITH ACUTE
    "\u00D4":"\\^{O}", // LATIN CAPITAL LETTER O WITH CIRCUMFLEX
    "\u00D5":"\\~{O}", // LATIN CAPITAL LETTER O WITH TILDE
    "\u00D6":"\\\"{O}", // LATIN CAPITAL LETTER O WITH DIAERESIS
    "\u00D9":"\\`{U}", // LATIN CAPITAL LETTER U WITH GRAVE
    "\u00DA":"\\'{U}", // LATIN CAPITAL LETTER U WITH ACUTE
    "\u00DB":"\\^{U}", // LATIN CAPITAL LETTER U WITH CIRCUMFLEX
    "\u00DC":"\\\"{U}", // LATIN CAPITAL LETTER U WITH DIAERESIS
    "\u00DD":"\\'{Y}", // LATIN CAPITAL LETTER Y WITH ACUTE
    "\u00E0":"\\`{a}", // LATIN SMALL LETTER A WITH GRAVE
    "\u00E1":"\\'{a}", // LATIN SMALL LETTER A WITH ACUTE
    "\u00E2":"\\^{a}", // LATIN SMALL LETTER A WITH CIRCUMFLEX
    "\u00E3":"\\~{a}", // LATIN SMALL LETTER A WITH TILDE
    "\u00E4":"\\\"{a}", // LATIN SMALL LETTER A WITH DIAERESIS
    "\u00E7":"\\c{c}", // LATIN SMALL LETTER C WITH CEDILLA
    "\u00E8":"\\`{e}", // LATIN SMALL LETTER E WITH GRAVE
    "\u00E9":"\\'{e}", // LATIN SMALL LETTER E WITH ACUTE
    "\u00EA":"\\^{e}", // LATIN SMALL LETTER E WITH CIRCUMFLEX
    "\u00EB":"\\\"{e}", // LATIN SMALL LETTER E WITH DIAERESIS
    "\u00EC":"\\`{i}", // LATIN SMALL LETTER I WITH GRAVE
    "\u00ED":"\\'{i}", // LATIN SMALL LETTER I WITH ACUTE
    "\u00EE":"\\^{i}", // LATIN SMALL LETTER I WITH CIRCUMFLEX
    "\u00EF":"\\\"{i}", // LATIN SMALL LETTER I WITH DIAERESIS
    "\u00F1":"\\~{n}", // LATIN SMALL LETTER N WITH TILDE
    "\u00F2":"\\`{o}", // LATIN SMALL LETTER O WITH GRAVE
    "\u00F3":"\\'{o}", // LATIN SMALL LETTER O WITH ACUTE
    "\u00F4":"\\^{o}", // LATIN SMALL LETTER O WITH CIRCUMFLEX
    "\u00F5":"\\~{o}", // LATIN SMALL LETTER O WITH TILDE
    "\u00F6":"\\\"{o}", // LATIN SMALL LETTER O WITH DIAERESIS
    "\u00F9":"\\`{u}", // LATIN SMALL LETTER U WITH GRAVE
    "\u00FA":"\\'{u}", // LATIN SMALL LETTER U WITH ACUTE
    "\u00FB":"\\^{u}", // LATIN SMALL LETTER U WITH CIRCUMFLEX
    "\u00FC":"\\\"{u}", // LATIN SMALL LETTER U WITH DIAERESIS
    "\u00FD":"\\'{y}", // LATIN SMALL LETTER Y WITH ACUTE
    "\u00FF":"\\\"{y}", // LATIN SMALL LETTER Y WITH DIAERESIS
    "\u0100":"\\={A}", // LATIN CAPITAL LETTER A WITH MACRON
    "\u0101":"\\={a}", // LATIN SMALL LETTER A WITH MACRON
    "\u0102":"\\u{A}", // LATIN CAPITAL LETTER A WITH BREVE
    "\u0103":"\\u{a}", // LATIN SMALL LETTER A WITH BREVE
    "\u0104":"\\k{A}", // LATIN CAPITAL LETTER A WITH OGONEK
    "\u0105":"\\k{a}", // LATIN SMALL LETTER A WITH OGONEK
    "\u0106":"\\'{C}", // LATIN CAPITAL LETTER C WITH ACUTE
    "\u0107":"\\'{c}", // LATIN SMALL LETTER C WITH ACUTE
    "\u0108":"\\^{C}", // LATIN CAPITAL LETTER C WITH CIRCUMFLEX
    "\u0109":"\\^{c}", // LATIN SMALL LETTER C WITH CIRCUMFLEX
    "\u010A":"\\.{C}", // LATIN CAPITAL LETTER C WITH DOT ABOVE
    "\u010B":"\\.{c}", // LATIN SMALL LETTER C WITH DOT ABOVE
    "\u010C":"\\v{C}", // LATIN CAPITAL LETTER C WITH CARON
    "\u010D":"\\v{c}", // LATIN SMALL LETTER C WITH CARON
    "\u010E":"\\v{D}", // LATIN CAPITAL LETTER D WITH CARON
    "\u010F":"\\v{d}", // LATIN SMALL LETTER D WITH CARON
    "\u0112":"\\={E}", // LATIN CAPITAL LETTER E WITH MACRON
    "\u0113":"\\={e}", // LATIN SMALL LETTER E WITH MACRON
    "\u0114":"\\u{E}", // LATIN CAPITAL LETTER E WITH BREVE
    "\u0115":"\\u{e}", // LATIN SMALL LETTER E WITH BREVE
    "\u0116":"\\.{E}", // LATIN CAPITAL LETTER E WITH DOT ABOVE
    "\u0117":"\\.{e}", // LATIN SMALL LETTER E WITH DOT ABOVE
    "\u0118":"\\k{E}", // LATIN CAPITAL LETTER E WITH OGONEK
    "\u0119":"\\k{e}", // LATIN SMALL LETTER E WITH OGONEK
    "\u011A":"\\v{E}", // LATIN CAPITAL LETTER E WITH CARON
    "\u011B":"\\v{e}", // LATIN SMALL LETTER E WITH CARON
    "\u011C":"\\^{G}", // LATIN CAPITAL LETTER G WITH CIRCUMFLEX
    "\u011D":"\\^{g}", // LATIN SMALL LETTER G WITH CIRCUMFLEX
    "\u011E":"\\u{G}", // LATIN CAPITAL LETTER G WITH BREVE
    "\u011F":"\\u{g}", // LATIN SMALL LETTER G WITH BREVE
    "\u0120":"\\.{G}", // LATIN CAPITAL LETTER G WITH DOT ABOVE
    "\u0121":"\\.{g}", // LATIN SMALL LETTER G WITH DOT ABOVE
    "\u0122":"\\c{G}", // LATIN CAPITAL LETTER G WITH CEDILLA
    "\u0123":"\\c{g}", // LATIN SMALL LETTER G WITH CEDILLA
    "\u0124":"\\^{H}", // LATIN CAPITAL LETTER H WITH CIRCUMFLEX
    "\u0125":"\\^{h}", // LATIN SMALL LETTER H WITH CIRCUMFLEX
    "\u0128":"\\~{I}", // LATIN CAPITAL LETTER I WITH TILDE
    "\u0129":"\\~{i}", // LATIN SMALL LETTER I WITH TILDE
    "\u012A":"\\={I}", // LATIN CAPITAL LETTER I WITH MACRON
    "\u012B":"\\={i}", // LATIN SMALL LETTER I WITH MACRON
    "\u012C":"\\u{I}", // LATIN CAPITAL LETTER I WITH BREVE
    "\u012D":"\\u{i}", // LATIN SMALL LETTER I WITH BREVE
    "\u012E":"\\k{I}", // LATIN CAPITAL LETTER I WITH OGONEK
    "\u012F":"\\k{i}", // LATIN SMALL LETTER I WITH OGONEK
    "\u0130":"\\.{I}", // LATIN CAPITAL LETTER I WITH DOT ABOVE
    "\u0134":"\\^{J}", // LATIN CAPITAL LETTER J WITH CIRCUMFLEX
    "\u0135":"\\^{j}", // LATIN SMALL LETTER J WITH CIRCUMFLEX
    "\u0136":"\\c{K}", // LATIN CAPITAL LETTER K WITH CEDILLA
    "\u0137":"\\c{k}", // LATIN SMALL LETTER K WITH CEDILLA
    "\u0139":"\\'{L}", // LATIN CAPITAL LETTER L WITH ACUTE
    "\u013A":"\\'{l}", // LATIN SMALL LETTER L WITH ACUTE
    "\u013B":"\\c{L}", // LATIN CAPITAL LETTER L WITH CEDILLA
    "\u013C":"\\c{l}", // LATIN SMALL LETTER L WITH CEDILLA
    "\u013D":"\\v{L}", // LATIN CAPITAL LETTER L WITH CARON
    "\u013E":"\\v{l}", // LATIN SMALL LETTER L WITH CARON
    "\u0143":"\\'{N}", // LATIN CAPITAL LETTER N WITH ACUTE
    "\u0144":"\\'{n}", // LATIN SMALL LETTER N WITH ACUTE
    "\u0145":"\\c{N}", // LATIN CAPITAL LETTER N WITH CEDILLA
    "\u0146":"\\c{n}", // LATIN SMALL LETTER N WITH CEDILLA
    "\u0147":"\\v{N}", // LATIN CAPITAL LETTER N WITH CARON
    "\u0148":"\\v{n}", // LATIN SMALL LETTER N WITH CARON
    "\u014C":"\\={O}", // LATIN CAPITAL LETTER O WITH MACRON
    "\u014D":"\\={o}", // LATIN SMALL LETTER O WITH MACRON
    "\u014E":"\\u{O}", // LATIN CAPITAL LETTER O WITH BREVE
    "\u014F":"\\u{o}", // LATIN SMALL LETTER O WITH BREVE
    "\u0150":"\\H{O}", // LATIN CAPITAL LETTER O WITH DOUBLE ACUTE
    "\u0151":"\\H{o}", // LATIN SMALL LETTER O WITH DOUBLE ACUTE
    "\u0154":"\\'{R}", // LATIN CAPITAL LETTER R WITH ACUTE
    "\u0155":"\\'{r}", // LATIN SMALL LETTER R WITH ACUTE
    "\u0156":"\\c{R}", // LATIN CAPITAL LETTER R WITH CEDILLA
    "\u0157":"\\c{r}", // LATIN SMALL LETTER R WITH CEDILLA
    "\u0158":"\\v{R}", // LATIN CAPITAL LETTER R WITH CARON
    "\u0159":"\\v{r}", // LATIN SMALL LETTER R WITH CARON
    "\u015A":"\\'{S}", // LATIN CAPITAL LETTER S WITH ACUTE
    "\u015B":"\\'{s}", // LATIN SMALL LETTER S WITH ACUTE
    "\u015C":"\\^{S}", // LATIN CAPITAL LETTER S WITH CIRCUMFLEX
    "\u015D":"\\^{s}", // LATIN SMALL LETTER S WITH CIRCUMFLEX
    "\u015E":"\\c{S}", // LATIN CAPITAL LETTER S WITH CEDILLA
    "\u015F":"\\c{s}", // LATIN SMALL LETTER S WITH CEDILLA
    "\u0160":"\\v{S}", // LATIN CAPITAL LETTER S WITH CARON
    "\u0161":"\\v{s}", // LATIN SMALL LETTER S WITH CARON
    "\u0162":"\\c{T}", // LATIN CAPITAL LETTER T WITH CEDILLA
    "\u0163":"\\c{t}", // LATIN SMALL LETTER T WITH CEDILLA
    "\u0164":"\\v{T}", // LATIN CAPITAL LETTER T WITH CARON
    "\u0165":"\\v{t}", // LATIN SMALL LETTER T WITH CARON
    "\u0168":"\\~{U}", // LATIN CAPITAL LETTER U WITH TILDE
    "\u0169":"\\~{u}", // LATIN SMALL LETTER U WITH TILDE
    "\u016A":"\\={U}", // LATIN CAPITAL LETTER U WITH MACRON
    "\u016B":"\\={u}", // LATIN SMALL LETTER U WITH MACRON
    "\u016C":"\\u{U}", // LATIN CAPITAL LETTER U WITH BREVE
    "\u016D":"\\u{u}", // LATIN SMALL LETTER U WITH BREVE
    "\u0170":"\\H{U}", // LATIN CAPITAL LETTER U WITH DOUBLE ACUTE
    "\u0171":"\\H{u}", // LATIN SMALL LETTER U WITH DOUBLE ACUTE
    "\u0172":"\\k{U}", // LATIN CAPITAL LETTER U WITH OGONEK
    "\u0173":"\\k{u}", // LATIN SMALL LETTER U WITH OGONEK
    "\u0174":"\\^{W}", // LATIN CAPITAL LETTER W WITH CIRCUMFLEX
    "\u0175":"\\^{w}", // LATIN SMALL LETTER W WITH CIRCUMFLEX
    "\u0176":"\\^{Y}", // LATIN CAPITAL LETTER Y WITH CIRCUMFLEX
    "\u0177":"\\^{y}", // LATIN SMALL LETTER Y WITH CIRCUMFLEX
    "\u0178":"\\\"{Y}", // LATIN CAPITAL LETTER Y WITH DIAERESIS
    "\u0179":"\\'{Z}", // LATIN CAPITAL LETTER Z WITH ACUTE
    "\u017A":"\\'{z}", // LATIN SMALL LETTER Z WITH ACUTE
    "\u017B":"\\.{Z}", // LATIN CAPITAL LETTER Z WITH DOT ABOVE
    "\u017C":"\\.{z}", // LATIN SMALL LETTER Z WITH DOT ABOVE
    "\u017D":"\\v{Z}", // LATIN CAPITAL LETTER Z WITH CARON
    "\u017E":"\\v{z}", // LATIN SMALL LETTER Z WITH CARON
    "\u01CD":"\\v{A}", // LATIN CAPITAL LETTER A WITH CARON
    "\u01CE":"\\v{a}", // LATIN SMALL LETTER A WITH CARON
    "\u01CF":"\\v{I}", // LATIN CAPITAL LETTER I WITH CARON
    "\u01D0":"\\v{i}", // LATIN SMALL LETTER I WITH CARON
    "\u01D1":"\\v{O}", // LATIN CAPITAL LETTER O WITH CARON
    "\u01D2":"\\v{o}", // LATIN SMALL LETTER O WITH CARON
    "\u01D3":"\\v{U}", // LATIN CAPITAL LETTER U WITH CARON
    "\u01D4":"\\v{u}", // LATIN SMALL LETTER U WITH CARON
    "\u01E6":"\\v{G}", // LATIN CAPITAL LETTER G WITH CARON
    "\u01E7":"\\v{g}", // LATIN SMALL LETTER G WITH CARON
    "\u01E8":"\\v{K}", // LATIN CAPITAL LETTER K WITH CARON
    "\u01E9":"\\v{k}", // LATIN SMALL LETTER K WITH CARON
    "\u01EA":"\\k{O}", // LATIN CAPITAL LETTER O WITH OGONEK
    "\u01EB":"\\k{o}", // LATIN SMALL LETTER O WITH OGONEK
    "\u01F0":"\\v{j}", // LATIN SMALL LETTER J WITH CARON
    "\u01F4":"\\'{G}", // LATIN CAPITAL LETTER G WITH ACUTE
    "\u01F5":"\\'{g}", // LATIN SMALL LETTER G WITH ACUTE
    "\u1E02":"\\.{B}", // LATIN CAPITAL LETTER B WITH DOT ABOVE
    "\u1E03":"\\.{b}", // LATIN SMALL LETTER B WITH DOT ABOVE
    "\u1E04":"\\d{B}", // LATIN CAPITAL LETTER B WITH DOT BELOW
    "\u1E05":"\\d{b}", // LATIN SMALL LETTER B WITH DOT BELOW
    "\u1E06":"\\b{B}", // LATIN CAPITAL LETTER B WITH LINE BELOW
    "\u1E07":"\\b{b}", // LATIN SMALL LETTER B WITH LINE BELOW
    "\u1E0A":"\\.{D}", // LATIN CAPITAL LETTER D WITH DOT ABOVE
    "\u1E0B":"\\.{d}", // LATIN SMALL LETTER D WITH DOT ABOVE
    "\u1E0C":"\\d{D}", // LATIN CAPITAL LETTER D WITH DOT BELOW
    "\u1E0D":"\\d{d}", // LATIN SMALL LETTER D WITH DOT BELOW
    "\u1E0E":"\\b{D}", // LATIN CAPITAL LETTER D WITH LINE BELOW
    "\u1E0F":"\\b{d}", // LATIN SMALL LETTER D WITH LINE BELOW
    "\u1E10":"\\c{D}", // LATIN CAPITAL LETTER D WITH CEDILLA
    "\u1E11":"\\c{d}", // LATIN SMALL LETTER D WITH CEDILLA
    "\u1E1E":"\\.{F}", // LATIN CAPITAL LETTER F WITH DOT ABOVE
    "\u1E1F":"\\.{f}", // LATIN SMALL LETTER F WITH DOT ABOVE
    "\u1E20":"\\={G}", // LATIN CAPITAL LETTER G WITH MACRON
    "\u1E21":"\\={g}", // LATIN SMALL LETTER G WITH MACRON
    "\u1E22":"\\.{H}", // LATIN CAPITAL LETTER H WITH DOT ABOVE
    "\u1E23":"\\.{h}", // LATIN SMALL LETTER H WITH DOT ABOVE
    "\u1E24":"\\d{H}", // LATIN CAPITAL LETTER H WITH DOT BELOW
    "\u1E25":"\\d{h}", // LATIN SMALL LETTER H WITH DOT BELOW
    "\u1E26":"\\\"{H}", // LATIN CAPITAL LETTER H WITH DIAERESIS
    "\u1E27":"\\\"{h}", // LATIN SMALL LETTER H WITH DIAERESIS
    "\u1E28":"\\c{H}", // LATIN CAPITAL LETTER H WITH CEDILLA
    "\u1E29":"\\c{h}", // LATIN SMALL LETTER H WITH CEDILLA
    "\u1E30":"\\'{K}", // LATIN CAPITAL LETTER K WITH ACUTE
    "\u1E31":"\\'{k}", // LATIN SMALL LETTER K WITH ACUTE
    "\u1E32":"\\d{K}", // LATIN CAPITAL LETTER K WITH DOT BELOW
    "\u1E33":"\\d{k}", // LATIN SMALL LETTER K WITH DOT BELOW
    "\u1E34":"\\b{K}", // LATIN CAPITAL LETTER K WITH LINE BELOW
    "\u1E35":"\\b{k}", // LATIN SMALL LETTER K WITH LINE BELOW
    "\u1E36":"\\d{L}", // LATIN CAPITAL LETTER L WITH DOT BELOW
    "\u1E37":"\\d{l}", // LATIN SMALL LETTER L WITH DOT BELOW
    "\u1E3A":"\\b{L}", // LATIN CAPITAL LETTER L WITH LINE BELOW
    "\u1E3B":"\\b{l}", // LATIN SMALL LETTER L WITH LINE BELOW
    "\u1E3E":"\\'{M}", // LATIN CAPITAL LETTER M WITH ACUTE
    "\u1E3F":"\\'{m}", // LATIN SMALL LETTER M WITH ACUTE
    "\u1E40":"\\.{M}", // LATIN CAPITAL LETTER M WITH DOT ABOVE
    "\u1E41":"\\.{m}", // LATIN SMALL LETTER M WITH DOT ABOVE
    "\u1E42":"\\d{M}", // LATIN CAPITAL LETTER M WITH DOT BELOW
    "\u1E43":"\\d{m}", // LATIN SMALL LETTER M WITH DOT BELOW
    "\u1E44":"\\.{N}", // LATIN CAPITAL LETTER N WITH DOT ABOVE
    "\u1E45":"\\.{n}", // LATIN SMALL LETTER N WITH DOT ABOVE
    "\u1E46":"\\d{N}", // LATIN CAPITAL LETTER N WITH DOT BELOW
    "\u1E47":"\\d{n}", // LATIN SMALL LETTER N WITH DOT BELOW
    "\u1E48":"\\b{N}", // LATIN CAPITAL LETTER N WITH LINE BELOW
    "\u1E49":"\\b{n}", // LATIN SMALL LETTER N WITH LINE BELOW
    "\u1E54":"\\'{P}", // LATIN CAPITAL LETTER P WITH ACUTE
    "\u1E55":"\\'{p}", // LATIN SMALL LETTER P WITH ACUTE
    "\u1E56":"\\.{P}", // LATIN CAPITAL LETTER P WITH DOT ABOVE
    "\u1E57":"\\.{p}", // LATIN SMALL LETTER P WITH DOT ABOVE
    "\u1E58":"\\.{R}", // LATIN CAPITAL LETTER R WITH DOT ABOVE
    "\u1E59":"\\.{r}", // LATIN SMALL LETTER R WITH DOT ABOVE
    "\u1E5A":"\\d{R}", // LATIN CAPITAL LETTER R WITH DOT BELOW
    "\u1E5B":"\\d{r}", // LATIN SMALL LETTER R WITH DOT BELOW
    "\u1E5E":"\\b{R}", // LATIN CAPITAL LETTER R WITH LINE BELOW
    "\u1E5F":"\\b{r}", // LATIN SMALL LETTER R WITH LINE BELOW
    "\u1E60":"\\.{S}", // LATIN CAPITAL LETTER S WITH DOT ABOVE
    "\u1E61":"\\.{s}", // LATIN SMALL LETTER S WITH DOT ABOVE
    "\u1E62":"\\d{S}", // LATIN CAPITAL LETTER S WITH DOT BELOW
    "\u1E63":"\\d{s}", // LATIN SMALL LETTER S WITH DOT BELOW
    "\u1E6A":"\\.{T}", // LATIN CAPITAL LETTER T WITH DOT ABOVE
    "\u1E6B":"\\.{t}", // LATIN SMALL LETTER T WITH DOT ABOVE
    "\u1E6C":"\\d{T}", // LATIN CAPITAL LETTER T WITH DOT BELOW
    "\u1E6D":"\\d{t}", // LATIN SMALL LETTER T WITH DOT BELOW
    "\u1E6E":"\\b{T}", // LATIN CAPITAL LETTER T WITH LINE BELOW
    "\u1E6F":"\\b{t}", // LATIN SMALL LETTER T WITH LINE BELOW
    "\u1E7C":"\\~{V}", // LATIN CAPITAL LETTER V WITH TILDE
    "\u1E7D":"\\~{v}", // LATIN SMALL LETTER V WITH TILDE
    "\u1E7E":"\\d{V}", // LATIN CAPITAL LETTER V WITH DOT BELOW
    "\u1E7F":"\\d{v}", // LATIN SMALL LETTER V WITH DOT BELOW
    "\u1E80":"\\`{W}", // LATIN CAPITAL LETTER W WITH GRAVE
    "\u1E81":"\\`{w}", // LATIN SMALL LETTER W WITH GRAVE
    "\u1E82":"\\'{W}", // LATIN CAPITAL LETTER W WITH ACUTE
    "\u1E83":"\\'{w}", // LATIN SMALL LETTER W WITH ACUTE
    "\u1E84":"\\\"{W}", // LATIN CAPITAL LETTER W WITH DIAERESIS
    "\u1E85":"\\\"{w}", // LATIN SMALL LETTER W WITH DIAERESIS
    "\u1E86":"\\.{W}", // LATIN CAPITAL LETTER W WITH DOT ABOVE
    "\u1E87":"\\.{w}", // LATIN SMALL LETTER W WITH DOT ABOVE
    "\u1E88":"\\d{W}", // LATIN CAPITAL LETTER W WITH DOT BELOW
    "\u1E89":"\\d{w}", // LATIN SMALL LETTER W WITH DOT BELOW
    "\u1E8A":"\\.{X}", // LATIN CAPITAL LETTER X WITH DOT ABOVE
    "\u1E8B":"\\.{x}", // LATIN SMALL LETTER X WITH DOT ABOVE
    "\u1E8C":"\\\"{X}", // LATIN CAPITAL LETTER X WITH DIAERESIS
    "\u1E8D":"\\\"{x}", // LATIN SMALL LETTER X WITH DIAERESIS
    "\u1E8E":"\\.{Y}", // LATIN CAPITAL LETTER Y WITH DOT ABOVE
    "\u1E8F":"\\.{y}", // LATIN SMALL LETTER Y WITH DOT ABOVE
    "\u1E90":"\\^{Z}", // LATIN CAPITAL LETTER Z WITH CIRCUMFLEX
    "\u1E91":"\\^{z}", // LATIN SMALL LETTER Z WITH CIRCUMFLEX
    "\u1E92":"\\d{Z}", // LATIN CAPITAL LETTER Z WITH DOT BELOW
    "\u1E93":"\\d{z}", // LATIN SMALL LETTER Z WITH DOT BELOW
    "\u1E94":"\\b{Z}", // LATIN CAPITAL LETTER Z WITH LINE BELOW
    "\u1E95":"\\b{z}", // LATIN SMALL LETTER Z WITH LINE BELOW
    "\u1E96":"\\b{h}", // LATIN SMALL LETTER H WITH LINE BELOW
    "\u1E97":"\\\"{t}", // LATIN SMALL LETTER T WITH DIAERESIS
    "\u1EA0":"\\d{A}", // LATIN CAPITAL LETTER A WITH DOT BELOW
    "\u1EA1":"\\d{a}", // LATIN SMALL LETTER A WITH DOT BELOW
    "\u1EB8":"\\d{E}", // LATIN CAPITAL LETTER E WITH DOT BELOW
    "\u1EB9":"\\d{e}", // LATIN SMALL LETTER E WITH DOT BELOW
    "\u1EBC":"\\~{E}", // LATIN CAPITAL LETTER E WITH TILDE
    "\u1EBD":"\\~{e}", // LATIN SMALL LETTER E WITH TILDE
    "\u1ECA":"\\d{I}", // LATIN CAPITAL LETTER I WITH DOT BELOW
    "\u1ECB":"\\d{i}", // LATIN SMALL LETTER I WITH DOT BELOW
    "\u1ECC":"\\d{O}", // LATIN CAPITAL LETTER O WITH DOT BELOW
    "\u1ECD":"\\d{o}", // LATIN SMALL LETTER O WITH DOT BELOW
    "\u1EE4":"\\d{U}", // LATIN CAPITAL LETTER U WITH DOT BELOW
    "\u1EE5":"\\d{u}", // LATIN SMALL LETTER U WITH DOT BELOW
    "\u1EF2":"\\`{Y}", // LATIN CAPITAL LETTER Y WITH GRAVE
    "\u1EF3":"\\`{y}", // LATIN SMALL LETTER Y WITH GRAVE
    "\u1EF4":"\\d{Y}", // LATIN CAPITAL LETTER Y WITH DOT BELOW
    "\u1EF5":"\\d{y}", // LATIN SMALL LETTER Y WITH DOT BELOW
    "\u1EF8":"\\~{Y}", // LATIN CAPITAL LETTER Y WITH TILDE
    "\u1EF9":"\\~{y}", // LATIN SMALL LETTER Y WITH TILDE

};

/* unfortunately the mapping isn't reversible - hence this second table - sigh! */
var reversemappingTable = {
    "\u00A0":"~", // NO-BREAK SPACE
    "\u00A1":"{\\textexclamdown}", // INVERTED EXCLAMATION MARK
    "\u00A2":"{\\textcent}", // CENT SIGN
    "\u00A3":"{\\textsterling}", // POUND SIGN
    "\u00A5":"{\\textyen}", // YEN SIGN
    "\u00A6":"{\\textbrokenbar}", // BROKEN BAR
    "\u00A7":"{\\textsection}", // SECTION SIGN
    "\u00A8":"{\\textasciidieresis}", // DIAERESIS
    "\u00A9":"{\\textcopyright}", // COPYRIGHT SIGN
    "\u00AA":"{\\textordfeminine}", // FEMININE ORDINAL INDICATOR
    "\u00AB":"{\\guillemotleft}", // LEFT-POINTING DOUBLE ANGLE QUOTATION MARK
    "\u00AC":"{\\textlnot}", // NOT SIGN
    "\u00AE":"{\\textregistered}", // REGISTERED SIGN
    "\u00AF":"{\\textasciimacron}", // MACRON
    "\u00B0":"{\\textdegree}", // DEGREE SIGN
    "\u00B1":"{\\textpm}", // PLUS-MINUS SIGN
    "\u00B2":"{\\texttwosuperior}", // SUPERSCRIPT TWO
    "\u00B3":"{\\textthreesuperior}", // SUPERSCRIPT THREE
    "\u00B4":"{\\textasciiacute}", // ACUTE ACCENT
    "\u00B5":"{\\textmu}", // MICRO SIGN
    "\u00B6":"{\\textparagraph}", // PILCROW SIGN
    "\u00B7":"{\\textperiodcentered}", // MIDDLE DOT
    "\u00B8":"{\\c\\ }", // CEDILLA
    "\u00B9":"{\\textonesuperior}", // SUPERSCRIPT ONE
    "\u00BA":"{\\textordmasculine}", // MASCULINE ORDINAL INDICATOR
    "\u00BB":"{\\guillemotright}", // RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK
    "\u00BC":"{\\textonequarter}", // VULGAR FRACTION ONE QUARTER
    "\u00BD":"{\\textonehalf}", // VULGAR FRACTION ONE HALF
    "\u00BE":"{\\textthreequarters}", // VULGAR FRACTION THREE QUARTERS
    "\u00BF":"{\\textquestiondown}", // INVERTED QUESTION MARK
    "\u00C6":"{\\AE}", // LATIN CAPITAL LETTER AE
    "\u00D0":"{\\DH}", // LATIN CAPITAL LETTER ETH
    "\u00D7":"{\\texttimes}", // MULTIPLICATION SIGN
    "\u00DE":"{\\TH}", // LATIN CAPITAL LETTER THORN
    "\u00DF":"{\\ss}", // LATIN SMALL LETTER SHARP S
    "\u00E6":"{\\ae}", // LATIN SMALL LETTER AE
    "\u00F0":"{\\dh}", // LATIN SMALL LETTER ETH
    "\u00F7":"{\\textdiv}", // DIVISION SIGN
    "\u00FE":"{\\th}", // LATIN SMALL LETTER THORN
    "\u0131":"{\\i}", // LATIN SMALL LETTER DOTLESS I
    "\u0149":"'n", // LATIN SMALL LETTER N PRECEDED BY APOSTROPHE
    "\u014A":"{\\NG}", // LATIN CAPITAL LETTER ENG
    "\u014B":"{\\ng}", // LATIN SMALL LETTER ENG
    "\u0152":"{\\OE}", // LATIN CAPITAL LIGATURE OE
    "\u0153":"{\\oe}", // LATIN SMALL LIGATURE OE
    "\u02C6":"{\\textasciicircum}", // MODIFIER LETTER CIRCUMFLEX ACCENT
    "\u02DC":"\\~{}", // SMALL TILDE
    "\u02DD":"{\\textacutedbl}", // DOUBLE ACUTE ACCENT
    "\u2013":"{\\textendash}", // EN DASH
    "\u2014":"{\\textemdash}", // EM DASH
    "\u2015":"--", // HORIZONTAL BAR
    "\u2016":"{\\textbardbl}", // DOUBLE VERTICAL LINE
    "\u2017":"{\\textunderscore}", // DOUBLE LOW LINE
    "\u2018":"{\\textquoteleft}", // LEFT SINGLE QUOTATION MARK
    "\u2019":"{\\textquoteright}", // RIGHT SINGLE QUOTATION MARK
    "\u201A":"{\\quotesinglbase}", // SINGLE LOW-9 QUOTATION MARK
    "\u201C":"{\\textquotedblleft}", // LEFT DOUBLE QUOTATION MARK
    "\u201D":"{\\textquotedblright}", // RIGHT DOUBLE QUOTATION MARK
    "\u201E":"{\\quotedblbase}", // DOUBLE LOW-9 QUOTATION MARK
    "\u201F":"{\\quotedblbase}", // DOUBLE HIGH-REVERSED-9 QUOTATION MARK
    "\u2020":"{\\textdagger}", // DAGGER
    "\u2021":"{\\textdaggerdbl}", // DOUBLE DAGGER
    "\u2022":"{\\textbullet}", // BULLET
    "\u2026":"{\\textellipsis}", // HORIZONTAL ELLIPSIS
    "\u2030":"{\\textperthousand}", // PER MILLE SIGN
    "\u2034":"'''", // TRIPLE PRIME
    "\u201D":"''", // RIGHT DOUBLE QUOTATION MARK (could be a double prime)
    "\u201C":"``", // LEFT DOUBLE QUOTATION MARK (could be a reversed double prime)
    "\u2037":"```", // REVERSED TRIPLE PRIME
    "\u2039":"{\\guilsinglleft}", // SINGLE LEFT-POINTING ANGLE QUOTATION MARK
    "\u203A":"{\\guilsinglright}", // SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
    "\u203C":"!!", // DOUBLE EXCLAMATION MARK
    "\u2044":"{\\textfractionsolidus}", // FRACTION SLASH
    "\u2048":"?!", // QUESTION EXCLAMATION MARK
    "\u2049":"!?", // EXCLAMATION QUESTION MARK
    "\u2070":"$^{0}$", // SUPERSCRIPT ZERO
    "\u2074":"$^{4}$", // SUPERSCRIPT FOUR
    "\u2075":"$^{5}$", // SUPERSCRIPT FIVE
    "\u2076":"$^{6}$", // SUPERSCRIPT SIX
    "\u2077":"$^{7}$", // SUPERSCRIPT SEVEN
    "\u2078":"$^{8}$", // SUPERSCRIPT EIGHT
    "\u2079":"$^{9}$", // SUPERSCRIPT NINE
    "\u207A":"$^{+}$", // SUPERSCRIPT PLUS SIGN
    "\u207B":"$^{-}$", // SUPERSCRIPT MINUS
    "\u207C":"$^{=}$", // SUPERSCRIPT EQUALS SIGN
    "\u207D":"$^{(}$", // SUPERSCRIPT LEFT PARENTHESIS
    "\u207E":"$^{)}$", // SUPERSCRIPT RIGHT PARENTHESIS
    "\u207F":"$^{n}$", // SUPERSCRIPT LATIN SMALL LETTER N
    "\u2080":"$_{0}$", // SUBSCRIPT ZERO
    "\u2081":"$_{1}$", // SUBSCRIPT ONE
    "\u2082":"$_{2}$", // SUBSCRIPT TWO
    "\u2083":"$_{3}$", // SUBSCRIPT THREE
    "\u2084":"$_{4}$", // SUBSCRIPT FOUR
    "\u2085":"$_{5}$", // SUBSCRIPT FIVE
    "\u2086":"$_{6}$", // SUBSCRIPT SIX
    "\u2087":"$_{7}$", // SUBSCRIPT SEVEN
    "\u2088":"$_{8}$", // SUBSCRIPT EIGHT
    "\u2089":"$_{9}$", // SUBSCRIPT NINE
    "\u208A":"$_{+}$", // SUBSCRIPT PLUS SIGN
    "\u208B":"$_{-}$", // SUBSCRIPT MINUS
    "\u208C":"$_{=}$", // SUBSCRIPT EQUALS SIGN
    "\u208D":"$_{(}$", // SUBSCRIPT LEFT PARENTHESIS
    "\u208E":"$_{)}$", // SUBSCRIPT RIGHT PARENTHESIS
    "\u20AC":"{\\texteuro}", // EURO SIGN
    "\u2100":"a/c", // ACCOUNT OF
    "\u2101":"a/s", // ADDRESSED TO THE SUBJECT
    "\u2103":"{\\textcelsius}", // DEGREE CELSIUS
    "\u2105":"c/o", // CARE OF
    "\u2106":"c/u", // CADA UNA
    "\u2116":"{\\textnumero}", // NUMERO SIGN
    "\u2117":"{\\textcircledP}", // SOUND RECORDING COPYRIGHT
    "\u2120":"{\\textservicemark}", // SERVICE MARK
    "\u2121":"{TEL}", // TELEPHONE SIGN
    "\u2122":"{\\texttrademark}", // TRADE MARK SIGN
    "\u2126":"{\\textohm}", // OHM SIGN
    "\u212E":"{\\textestimated}", // ESTIMATED SYMBOL
    "\u2153":" 1/3", // VULGAR FRACTION ONE THIRD
    "\u2154":" 2/3", // VULGAR FRACTION TWO THIRDS
    "\u2155":" 1/5", // VULGAR FRACTION ONE FIFTH
    "\u2156":" 2/5", // VULGAR FRACTION TWO FIFTHS
    "\u2157":" 3/5", // VULGAR FRACTION THREE FIFTHS
    "\u2158":" 4/5", // VULGAR FRACTION FOUR FIFTHS
    "\u2159":" 1/6", // VULGAR FRACTION ONE SIXTH
    "\u215A":" 5/6", // VULGAR FRACTION FIVE SIXTHS
    "\u215B":" 1/8", // VULGAR FRACTION ONE EIGHTH
    "\u215C":" 3/8", // VULGAR FRACTION THREE EIGHTHS
    "\u215D":" 5/8", // VULGAR FRACTION FIVE EIGHTHS
    "\u215E":" 7/8", // VULGAR FRACTION SEVEN EIGHTHS
    "\u215F":" 1/", // FRACTION NUMERATOR ONE
    "\u2190":"{\\textleftarrow}", // LEFTWARDS ARROW
    "\u2191":"{\\textuparrow}", // UPWARDS ARROW
    "\u2192":"{\\textrightarrow}", // RIGHTWARDS ARROW
    "\u2193":"{\\textdownarrow}", // DOWNWARDS ARROW
    "\u2194":"<->", // LEFT RIGHT ARROW
    "\u21D0":"<=", // LEFTWARDS DOUBLE ARROW
    "\u21D2":"=>", // RIGHTWARDS DOUBLE ARROW
    "\u21D4":"<=>", // LEFT RIGHT DOUBLE ARROW
    "\u221E":"$\\infty$", // INFINITY
    "\u2225":"||", // PARALLEL TO
    "\u223C":"\\~{}", // TILDE OPERATOR
    "\u2260":"/=", // NOT EQUAL TO
    "\u2264":"<=", // LESS-THAN OR EQUAL TO
    "\u2265":">=", // GREATER-THAN OR EQUAL TO
    "\u226A":"<<", // MUCH LESS-THAN
    "\u226B":">>", // MUCH GREATER-THAN
    "\u2295":"(+)", // CIRCLED PLUS
    "\u2296":"(-)", // CIRCLED MINUS
    "\u2297":"(x)", // CIRCLED TIMES
    "\u2298":"(/)", // CIRCLED DIVISION SLASH
    "\u22A2":"|-", // RIGHT TACK
    "\u22A3":"-|", // LEFT TACK
    "\u22A6":"|-", // ASSERTION
    "\u22A7":"|=", // MODELS
    "\u22A8":"|=", // TRUE
    "\u22A9":"||-", // FORCES
    "\u22D5":"$\\#$", // EQUAL AND PARALLEL TO
    "\u22D8":"<<<", // VERY MUCH LESS-THAN
    "\u22D9":">>>", // VERY MUCH GREATER-THAN
    "\u22EF":"...", // MIDLINE HORIZONTAL ELLIPSIS
    "\u2329":"{\\textlangle}", // LEFT-POINTING ANGLE BRACKET
    "\u232A":"{\\textrangle}", // RIGHT-POINTING ANGLE BRACKET
    "\u2423":"{\\textvisiblespace}", // OPEN BOX
    "\u2425":"///", // SYMBOL FOR DELETE FORM TWO
    "\u25E6":"{\\textopenbullet}", // WHITE BULLET
    "\u2639":":-(", // WHITE FROWNING FACE
    "\u263A":":-)", // WHITE SMILING FACE
    "\u263B":"(-:", // BLACK SMILING FACE
    "\u266F":"$\\#$", // MUSIC SHARP SIGN
    "\u2701":"$\\%<$", // UPPER BLADE SCISSORS
    "\u2702":"$\\%<$", // BLACK SCISSORS
    "\u2703":"$\\%<$", // LOWER BLADE SCISSORS
    "\u2704":"$\\%<$", // WHITE SCISSORS
/* Derived accented characters */
    "\u00C0":"\\`{A}", // LATIN CAPITAL LETTER A WITH GRAVE
    "\u00C1":"\\'{A}", // LATIN CAPITAL LETTER A WITH ACUTE
    "\u00C2":"\\^{A}", // LATIN CAPITAL LETTER A WITH CIRCUMFLEX
    "\u00C3":"\\~{A}", // LATIN CAPITAL LETTER A WITH TILDE
    "\u00C4":"\\\"{A}", // LATIN CAPITAL LETTER A WITH DIAERESIS
    "\u00C7":"\\c{C}", // LATIN CAPITAL LETTER C WITH CEDILLA
    "\u00C8":"\\`{E}", // LATIN CAPITAL LETTER E WITH GRAVE
    "\u00C9":"\\'{E}", // LATIN CAPITAL LETTER E WITH ACUTE
    "\u00CA":"\\^{E}", // LATIN CAPITAL LETTER E WITH CIRCUMFLEX
    "\u00CB":"\\\"{E}", // LATIN CAPITAL LETTER E WITH DIAERESIS
    "\u00CC":"\\`{I}", // LATIN CAPITAL LETTER I WITH GRAVE
    "\u00CD":"\\'{I}", // LATIN CAPITAL LETTER I WITH ACUTE
    "\u00CE":"\\^{I}", // LATIN CAPITAL LETTER I WITH CIRCUMFLEX
    "\u00CF":"\\\"{I}", // LATIN CAPITAL LETTER I WITH DIAERESIS
    "\u00D1":"\\~{N}", // LATIN CAPITAL LETTER N WITH TILDE
    "\u00D2":"\\`{O}", // LATIN CAPITAL LETTER O WITH GRAVE
    "\u00D3":"\\'{O}", // LATIN CAPITAL LETTER O WITH ACUTE
    "\u00D4":"\\^{O}", // LATIN CAPITAL LETTER O WITH CIRCUMFLEX
    "\u00D5":"\\~{O}", // LATIN CAPITAL LETTER O WITH TILDE
    "\u00D6":"\\\"{O}", // LATIN CAPITAL LETTER O WITH DIAERESIS
    "\u00D9":"\\`{U}", // LATIN CAPITAL LETTER U WITH GRAVE
    "\u00DA":"\\'{U}", // LATIN CAPITAL LETTER U WITH ACUTE
    "\u00DB":"\\^{U}", // LATIN CAPITAL LETTER U WITH CIRCUMFLEX
    "\u00DC":"\\\"{U}", // LATIN CAPITAL LETTER U WITH DIAERESIS
    "\u00DD":"\\'{Y}", // LATIN CAPITAL LETTER Y WITH ACUTE
    "\u00E0":"\\`{a}", // LATIN SMALL LETTER A WITH GRAVE
    "\u00E1":"\\'{a}", // LATIN SMALL LETTER A WITH ACUTE
    "\u00E2":"\\^{a}", // LATIN SMALL LETTER A WITH CIRCUMFLEX
    "\u00E3":"\\~{a}", // LATIN SMALL LETTER A WITH TILDE
    "\u00E4":"\\\"{a}", // LATIN SMALL LETTER A WITH DIAERESIS
    "\u00E7":"\\c{c}", // LATIN SMALL LETTER C WITH CEDILLA
    "\u00E8":"\\`{e}", // LATIN SMALL LETTER E WITH GRAVE
    "\u00E9":"\\'{e}", // LATIN SMALL LETTER E WITH ACUTE
    "\u00EA":"\\^{e}", // LATIN SMALL LETTER E WITH CIRCUMFLEX
    "\u00EB":"\\\"{e}", // LATIN SMALL LETTER E WITH DIAERESIS
    "\u00EC":"\\`{i}", // LATIN SMALL LETTER I WITH GRAVE
    "\u00ED":"\\'{i}", // LATIN SMALL LETTER I WITH ACUTE
    "\u00EE":"\\^{i}", // LATIN SMALL LETTER I WITH CIRCUMFLEX
    "\u00EF":"\\\"{i}", // LATIN SMALL LETTER I WITH DIAERESIS
    "\u00F1":"\\~{n}", // LATIN SMALL LETTER N WITH TILDE
    "\u00F2":"\\`{o}", // LATIN SMALL LETTER O WITH GRAVE
    "\u00F3":"\\'{o}", // LATIN SMALL LETTER O WITH ACUTE
    "\u00F4":"\\^{o}", // LATIN SMALL LETTER O WITH CIRCUMFLEX
    "\u00F5":"\\~{o}", // LATIN SMALL LETTER O WITH TILDE
    "\u00F6":"\\\"{o}", // LATIN SMALL LETTER O WITH DIAERESIS
    "\u00F9":"\\`{u}", // LATIN SMALL LETTER U WITH GRAVE
    "\u00FA":"\\'{u}", // LATIN SMALL LETTER U WITH ACUTE
    "\u00FB":"\\^{u}", // LATIN SMALL LETTER U WITH CIRCUMFLEX
    "\u00FC":"\\\"{u}", // LATIN SMALL LETTER U WITH DIAERESIS
    "\u00FD":"\\'{y}", // LATIN SMALL LETTER Y WITH ACUTE
    "\u00FF":"\\\"{y}", // LATIN SMALL LETTER Y WITH DIAERESIS
    "\u0100":"\\={A}", // LATIN CAPITAL LETTER A WITH MACRON
    "\u0101":"\\={a}", // LATIN SMALL LETTER A WITH MACRON
    "\u0102":"\\u{A}", // LATIN CAPITAL LETTER A WITH BREVE
    "\u0103":"\\u{a}", // LATIN SMALL LETTER A WITH BREVE
    "\u0104":"\\k{A}", // LATIN CAPITAL LETTER A WITH OGONEK
    "\u0105":"\\k{a}", // LATIN SMALL LETTER A WITH OGONEK
    "\u0106":"\\'{C}", // LATIN CAPITAL LETTER C WITH ACUTE
    "\u0107":"\\'{c}", // LATIN SMALL LETTER C WITH ACUTE
    "\u0108":"\\^{C}", // LATIN CAPITAL LETTER C WITH CIRCUMFLEX
    "\u0109":"\\^{c}", // LATIN SMALL LETTER C WITH CIRCUMFLEX
    "\u010A":"\\.{C}", // LATIN CAPITAL LETTER C WITH DOT ABOVE
    "\u010B":"\\.{c}", // LATIN SMALL LETTER C WITH DOT ABOVE
    "\u010C":"\\v{C}", // LATIN CAPITAL LETTER C WITH CARON
    "\u010D":"\\v{c}", // LATIN SMALL LETTER C WITH CARON
    "\u010E":"\\v{D}", // LATIN CAPITAL LETTER D WITH CARON
    "\u010F":"\\v{d}", // LATIN SMALL LETTER D WITH CARON
    "\u0112":"\\={E}", // LATIN CAPITAL LETTER E WITH MACRON
    "\u0113":"\\={e}", // LATIN SMALL LETTER E WITH MACRON
    "\u0114":"\\u{E}", // LATIN CAPITAL LETTER E WITH BREVE
    "\u0115":"\\u{e}", // LATIN SMALL LETTER E WITH BREVE
    "\u0116":"\\.{E}", // LATIN CAPITAL LETTER E WITH DOT ABOVE
    "\u0117":"\\.{e}", // LATIN SMALL LETTER E WITH DOT ABOVE
    "\u0118":"\\k{E}", // LATIN CAPITAL LETTER E WITH OGONEK
    "\u0119":"\\k{e}", // LATIN SMALL LETTER E WITH OGONEK
    "\u011A":"\\v{E}", // LATIN CAPITAL LETTER E WITH CARON
    "\u011B":"\\v{e}", // LATIN SMALL LETTER E WITH CARON
    "\u011C":"\\^{G}", // LATIN CAPITAL LETTER G WITH CIRCUMFLEX
    "\u011D":"\\^{g}", // LATIN SMALL LETTER G WITH CIRCUMFLEX
    "\u011E":"\\u{G}", // LATIN CAPITAL LETTER G WITH BREVE
    "\u011F":"\\u{g}", // LATIN SMALL LETTER G WITH BREVE
    "\u0120":"\\.{G}", // LATIN CAPITAL LETTER G WITH DOT ABOVE
    "\u0121":"\\.{g}", // LATIN SMALL LETTER G WITH DOT ABOVE
    "\u0122":"\\c{G}", // LATIN CAPITAL LETTER G WITH CEDILLA
    "\u0123":"\\c{g}", // LATIN SMALL LETTER G WITH CEDILLA
    "\u0124":"\\^{H}", // LATIN CAPITAL LETTER H WITH CIRCUMFLEX
    "\u0125":"\\^{h}", // LATIN SMALL LETTER H WITH CIRCUMFLEX
    "\u0128":"\\~{I}", // LATIN CAPITAL LETTER I WITH TILDE
    "\u0129":"\\~{i}", // LATIN SMALL LETTER I WITH TILDE
    "\u012A":"\\={I}", // LATIN CAPITAL LETTER I WITH MACRON
    "\u012B":"\\={i}", // LATIN SMALL LETTER I WITH MACRON
    "\u012C":"\\u{I}", // LATIN CAPITAL LETTER I WITH BREVE
    "\u012D":"\\u{i}", // LATIN SMALL LETTER I WITH BREVE
    "\u012E":"\\k{I}", // LATIN CAPITAL LETTER I WITH OGONEK
    "\u012F":"\\k{i}", // LATIN SMALL LETTER I WITH OGONEK
    "\u0130":"\\.{I}", // LATIN CAPITAL LETTER I WITH DOT ABOVE
    "\u0134":"\\^{J}", // LATIN CAPITAL LETTER J WITH CIRCUMFLEX
    "\u0135":"\\^{j}", // LATIN SMALL LETTER J WITH CIRCUMFLEX
    "\u0136":"\\c{K}", // LATIN CAPITAL LETTER K WITH CEDILLA
    "\u0137":"\\c{k}", // LATIN SMALL LETTER K WITH CEDILLA
    "\u0139":"\\'{L}", // LATIN CAPITAL LETTER L WITH ACUTE
    "\u013A":"\\'{l}", // LATIN SMALL LETTER L WITH ACUTE
    "\u013B":"\\c{L}", // LATIN CAPITAL LETTER L WITH CEDILLA
    "\u013C":"\\c{l}", // LATIN SMALL LETTER L WITH CEDILLA
    "\u013D":"\\v{L}", // LATIN CAPITAL LETTER L WITH CARON
    "\u013E":"\\v{l}", // LATIN SMALL LETTER L WITH CARON
    "\u0143":"\\'{N}", // LATIN CAPITAL LETTER N WITH ACUTE
    "\u0144":"\\'{n}", // LATIN SMALL LETTER N WITH ACUTE
    "\u0145":"\\c{N}", // LATIN CAPITAL LETTER N WITH CEDILLA
    "\u0146":"\\c{n}", // LATIN SMALL LETTER N WITH CEDILLA
    "\u0147":"\\v{N}", // LATIN CAPITAL LETTER N WITH CARON
    "\u0148":"\\v{n}", // LATIN SMALL LETTER N WITH CARON
    "\u014C":"\\={O}", // LATIN CAPITAL LETTER O WITH MACRON
    "\u014D":"\\={o}", // LATIN SMALL LETTER O WITH MACRON
    "\u014E":"\\u{O}", // LATIN CAPITAL LETTER O WITH BREVE
    "\u014F":"\\u{o}", // LATIN SMALL LETTER O WITH BREVE
    "\u0150":"\\H{O}", // LATIN CAPITAL LETTER O WITH DOUBLE ACUTE
    "\u0151":"\\H{o}", // LATIN SMALL LETTER O WITH DOUBLE ACUTE
    "\u0154":"\\'{R}", // LATIN CAPITAL LETTER R WITH ACUTE
    "\u0155":"\\'{r}", // LATIN SMALL LETTER R WITH ACUTE
    "\u0156":"\\c{R}", // LATIN CAPITAL LETTER R WITH CEDILLA
    "\u0157":"\\c{r}", // LATIN SMALL LETTER R WITH CEDILLA
    "\u0158":"\\v{R}", // LATIN CAPITAL LETTER R WITH CARON
    "\u0159":"\\v{r}", // LATIN SMALL LETTER R WITH CARON
    "\u015A":"\\'{S}", // LATIN CAPITAL LETTER S WITH ACUTE
    "\u015B":"\\'{s}", // LATIN SMALL LETTER S WITH ACUTE
    "\u015C":"\\^{S}", // LATIN CAPITAL LETTER S WITH CIRCUMFLEX
    "\u015D":"\\^{s}", // LATIN SMALL LETTER S WITH CIRCUMFLEX
    "\u015E":"\\c{S}", // LATIN CAPITAL LETTER S WITH CEDILLA
    "\u015F":"\\c{s}", // LATIN SMALL LETTER S WITH CEDILLA
    "\u0160":"\\v{S}", // LATIN CAPITAL LETTER S WITH CARON
    "\u0161":"\\v{s}", // LATIN SMALL LETTER S WITH CARON
    "\u0162":"\\c{T}", // LATIN CAPITAL LETTER T WITH CEDILLA
    "\u0163":"\\c{t}", // LATIN SMALL LETTER T WITH CEDILLA
    "\u0164":"\\v{T}", // LATIN CAPITAL LETTER T WITH CARON
    "\u0165":"\\v{t}", // LATIN SMALL LETTER T WITH CARON
    "\u0168":"\\~{U}", // LATIN CAPITAL LETTER U WITH TILDE
    "\u0169":"\\~{u}", // LATIN SMALL LETTER U WITH TILDE
    "\u016A":"\\={U}", // LATIN CAPITAL LETTER U WITH MACRON
    "\u016B":"\\={u}", // LATIN SMALL LETTER U WITH MACRON
    "\u016C":"\\u{U}", // LATIN CAPITAL LETTER U WITH BREVE
    "\u016D":"\\u{u}", // LATIN SMALL LETTER U WITH BREVE
    "\u0170":"\\H{U}", // LATIN CAPITAL LETTER U WITH DOUBLE ACUTE
    "\u0171":"\\H{u}", // LATIN SMALL LETTER U WITH DOUBLE ACUTE
    "\u0172":"\\k{U}", // LATIN CAPITAL LETTER U WITH OGONEK
    "\u0173":"\\k{u}", // LATIN SMALL LETTER U WITH OGONEK
    "\u0174":"\\^{W}", // LATIN CAPITAL LETTER W WITH CIRCUMFLEX
    "\u0175":"\\^{w}", // LATIN SMALL LETTER W WITH CIRCUMFLEX
    "\u0176":"\\^{Y}", // LATIN CAPITAL LETTER Y WITH CIRCUMFLEX
    "\u0177":"\\^{y}", // LATIN SMALL LETTER Y WITH CIRCUMFLEX
    "\u0178":"\\\"{Y}", // LATIN CAPITAL LETTER Y WITH DIAERESIS
    "\u0179":"\\'{Z}", // LATIN CAPITAL LETTER Z WITH ACUTE
    "\u017A":"\\'{z}", // LATIN SMALL LETTER Z WITH ACUTE
    "\u017B":"\\.{Z}", // LATIN CAPITAL LETTER Z WITH DOT ABOVE
    "\u017C":"\\.{z}", // LATIN SMALL LETTER Z WITH DOT ABOVE
    "\u017D":"\\v{Z}", // LATIN CAPITAL LETTER Z WITH CARON
    "\u017E":"\\v{z}", // LATIN SMALL LETTER Z WITH CARON
    "\u01CD":"\\v{A}", // LATIN CAPITAL LETTER A WITH CARON
    "\u01CE":"\\v{a}", // LATIN SMALL LETTER A WITH CARON
    "\u01CF":"\\v{I}", // LATIN CAPITAL LETTER I WITH CARON
    "\u01D0":"\\v{i}", // LATIN SMALL LETTER I WITH CARON
    "\u01D1":"\\v{O}", // LATIN CAPITAL LETTER O WITH CARON
    "\u01D2":"\\v{o}", // LATIN SMALL LETTER O WITH CARON
    "\u01D3":"\\v{U}", // LATIN CAPITAL LETTER U WITH CARON
    "\u01D4":"\\v{u}", // LATIN SMALL LETTER U WITH CARON
    "\u01E6":"\\v{G}", // LATIN CAPITAL LETTER G WITH CARON
    "\u01E7":"\\v{g}", // LATIN SMALL LETTER G WITH CARON
    "\u01E8":"\\v{K}", // LATIN CAPITAL LETTER K WITH CARON
    "\u01E9":"\\v{k}", // LATIN SMALL LETTER K WITH CARON
    "\u01EA":"\\k{O}", // LATIN CAPITAL LETTER O WITH OGONEK
    "\u01EB":"\\k{o}", // LATIN SMALL LETTER O WITH OGONEK
    "\u01F0":"\\v{j}", // LATIN SMALL LETTER J WITH CARON
    "\u01F4":"\\'{G}", // LATIN CAPITAL LETTER G WITH ACUTE
    "\u01F5":"\\'{g}", // LATIN SMALL LETTER G WITH ACUTE
    "\u1E02":"\\.{B}", // LATIN CAPITAL LETTER B WITH DOT ABOVE
    "\u1E03":"\\.{b}", // LATIN SMALL LETTER B WITH DOT ABOVE
    "\u1E04":"\\d{B}", // LATIN CAPITAL LETTER B WITH DOT BELOW
    "\u1E05":"\\d{b}", // LATIN SMALL LETTER B WITH DOT BELOW
    "\u1E06":"\\b{B}", // LATIN CAPITAL LETTER B WITH LINE BELOW
    "\u1E07":"\\b{b}", // LATIN SMALL LETTER B WITH LINE BELOW
    "\u1E0A":"\\.{D}", // LATIN CAPITAL LETTER D WITH DOT ABOVE
    "\u1E0B":"\\.{d}", // LATIN SMALL LETTER D WITH DOT ABOVE
    "\u1E0C":"\\d{D}", // LATIN CAPITAL LETTER D WITH DOT BELOW
    "\u1E0D":"\\d{d}", // LATIN SMALL LETTER D WITH DOT BELOW
    "\u1E0E":"\\b{D}", // LATIN CAPITAL LETTER D WITH LINE BELOW
    "\u1E0F":"\\b{d}", // LATIN SMALL LETTER D WITH LINE BELOW
    "\u1E10":"\\c{D}", // LATIN CAPITAL LETTER D WITH CEDILLA
    "\u1E11":"\\c{d}", // LATIN SMALL LETTER D WITH CEDILLA
    "\u1E1E":"\\.{F}", // LATIN CAPITAL LETTER F WITH DOT ABOVE
    "\u1E1F":"\\.{f}", // LATIN SMALL LETTER F WITH DOT ABOVE
    "\u1E20":"\\={G}", // LATIN CAPITAL LETTER G WITH MACRON
    "\u1E21":"\\={g}", // LATIN SMALL LETTER G WITH MACRON
    "\u1E22":"\\.{H}", // LATIN CAPITAL LETTER H WITH DOT ABOVE
    "\u1E23":"\\.{h}", // LATIN SMALL LETTER H WITH DOT ABOVE
    "\u1E24":"\\d{H}", // LATIN CAPITAL LETTER H WITH DOT BELOW
    "\u1E25":"\\d{h}", // LATIN SMALL LETTER H WITH DOT BELOW
    "\u1E26":"\\\"{H}", // LATIN CAPITAL LETTER H WITH DIAERESIS
    "\u1E27":"\\\"{h}", // LATIN SMALL LETTER H WITH DIAERESIS
    "\u1E28":"\\c{H}", // LATIN CAPITAL LETTER H WITH CEDILLA
    "\u1E29":"\\c{h}", // LATIN SMALL LETTER H WITH CEDILLA
    "\u1E30":"\\'{K}", // LATIN CAPITAL LETTER K WITH ACUTE
    "\u1E31":"\\'{k}", // LATIN SMALL LETTER K WITH ACUTE
    "\u1E32":"\\d{K}", // LATIN CAPITAL LETTER K WITH DOT BELOW
    "\u1E33":"\\d{k}", // LATIN SMALL LETTER K WITH DOT BELOW
    "\u1E34":"\\b{K}", // LATIN CAPITAL LETTER K WITH LINE BELOW
    "\u1E35":"\\b{k}", // LATIN SMALL LETTER K WITH LINE BELOW
    "\u1E36":"\\d{L}", // LATIN CAPITAL LETTER L WITH DOT BELOW
    "\u1E37":"\\d{l}", // LATIN SMALL LETTER L WITH DOT BELOW
    "\u1E3A":"\\b{L}", // LATIN CAPITAL LETTER L WITH LINE BELOW
    "\u1E3B":"\\b{l}", // LATIN SMALL LETTER L WITH LINE BELOW
    "\u1E3E":"\\'{M}", // LATIN CAPITAL LETTER M WITH ACUTE
    "\u1E3F":"\\'{m}", // LATIN SMALL LETTER M WITH ACUTE
    "\u1E40":"\\.{M}", // LATIN CAPITAL LETTER M WITH DOT ABOVE
    "\u1E41":"\\.{m}", // LATIN SMALL LETTER M WITH DOT ABOVE
    "\u1E42":"\\d{M}", // LATIN CAPITAL LETTER M WITH DOT BELOW
    "\u1E43":"\\d{m}", // LATIN SMALL LETTER M WITH DOT BELOW
    "\u1E44":"\\.{N}", // LATIN CAPITAL LETTER N WITH DOT ABOVE
    "\u1E45":"\\.{n}", // LATIN SMALL LETTER N WITH DOT ABOVE
    "\u1E46":"\\d{N}", // LATIN CAPITAL LETTER N WITH DOT BELOW
    "\u1E47":"\\d{n}", // LATIN SMALL LETTER N WITH DOT BELOW
    "\u1E48":"\\b{N}", // LATIN CAPITAL LETTER N WITH LINE BELOW
    "\u1E49":"\\b{n}", // LATIN SMALL LETTER N WITH LINE BELOW
    "\u1E54":"\\'{P}", // LATIN CAPITAL LETTER P WITH ACUTE
    "\u1E55":"\\'{p}", // LATIN SMALL LETTER P WITH ACUTE
    "\u1E56":"\\.{P}", // LATIN CAPITAL LETTER P WITH DOT ABOVE
    "\u1E57":"\\.{p}", // LATIN SMALL LETTER P WITH DOT ABOVE
    "\u1E58":"\\.{R}", // LATIN CAPITAL LETTER R WITH DOT ABOVE
    "\u1E59":"\\.{r}", // LATIN SMALL LETTER R WITH DOT ABOVE
    "\u1E5A":"\\d{R}", // LATIN CAPITAL LETTER R WITH DOT BELOW
    "\u1E5B":"\\d{r}", // LATIN SMALL LETTER R WITH DOT BELOW
    "\u1E5E":"\\b{R}", // LATIN CAPITAL LETTER R WITH LINE BELOW
    "\u1E5F":"\\b{r}", // LATIN SMALL LETTER R WITH LINE BELOW
    "\u1E60":"\\.{S}", // LATIN CAPITAL LETTER S WITH DOT ABOVE
    "\u1E61":"\\.{s}", // LATIN SMALL LETTER S WITH DOT ABOVE
    "\u1E62":"\\d{S}", // LATIN CAPITAL LETTER S WITH DOT BELOW
    "\u1E63":"\\d{s}", // LATIN SMALL LETTER S WITH DOT BELOW
    "\u1E6A":"\\.{T}", // LATIN CAPITAL LETTER T WITH DOT ABOVE
    "\u1E6B":"\\.{t}", // LATIN SMALL LETTER T WITH DOT ABOVE
    "\u1E6C":"\\d{T}", // LATIN CAPITAL LETTER T WITH DOT BELOW
    "\u1E6D":"\\d{t}", // LATIN SMALL LETTER T WITH DOT BELOW
    "\u1E6E":"\\b{T}", // LATIN CAPITAL LETTER T WITH LINE BELOW
    "\u1E6F":"\\b{t}", // LATIN SMALL LETTER T WITH LINE BELOW
    "\u1E7C":"\\~{V}", // LATIN CAPITAL LETTER V WITH TILDE
    "\u1E7D":"\\~{v}", // LATIN SMALL LETTER V WITH TILDE
    "\u1E7E":"\\d{V}", // LATIN CAPITAL LETTER V WITH DOT BELOW
    "\u1E7F":"\\d{v}", // LATIN SMALL LETTER V WITH DOT BELOW
    "\u1E80":"\\`{W}", // LATIN CAPITAL LETTER W WITH GRAVE
    "\u1E81":"\\`{w}", // LATIN SMALL LETTER W WITH GRAVE
    "\u1E82":"\\'{W}", // LATIN CAPITAL LETTER W WITH ACUTE
    "\u1E83":"\\'{w}", // LATIN SMALL LETTER W WITH ACUTE
    "\u1E84":"\\\"{W}", // LATIN CAPITAL LETTER W WITH DIAERESIS
    "\u1E85":"\\\"{w}", // LATIN SMALL LETTER W WITH DIAERESIS
    "\u1E86":"\\.{W}", // LATIN CAPITAL LETTER W WITH DOT ABOVE
    "\u1E87":"\\.{w}", // LATIN SMALL LETTER W WITH DOT ABOVE
    "\u1E88":"\\d{W}", // LATIN CAPITAL LETTER W WITH DOT BELOW
    "\u1E89":"\\d{w}", // LATIN SMALL LETTER W WITH DOT BELOW
    "\u1E8A":"\\.{X}", // LATIN CAPITAL LETTER X WITH DOT ABOVE
    "\u1E8B":"\\.{x}", // LATIN SMALL LETTER X WITH DOT ABOVE
    "\u1E8C":"\\\"{X}", // LATIN CAPITAL LETTER X WITH DIAERESIS
    "\u1E8D":"\\\"{x}", // LATIN SMALL LETTER X WITH DIAERESIS
    "\u1E8E":"\\.{Y}", // LATIN CAPITAL LETTER Y WITH DOT ABOVE
    "\u1E8F":"\\.{y}", // LATIN SMALL LETTER Y WITH DOT ABOVE
    "\u1E90":"\\^{Z}", // LATIN CAPITAL LETTER Z WITH CIRCUMFLEX
    "\u1E91":"\\^{z}", // LATIN SMALL LETTER Z WITH CIRCUMFLEX
    "\u1E92":"\\d{Z}", // LATIN CAPITAL LETTER Z WITH DOT BELOW
    "\u1E93":"\\d{z}", // LATIN SMALL LETTER Z WITH DOT BELOW
    "\u1E94":"\\b{Z}", // LATIN CAPITAL LETTER Z WITH LINE BELOW
    "\u1E95":"\\b{z}", // LATIN SMALL LETTER Z WITH LINE BELOW
    "\u1E96":"\\b{h}", // LATIN SMALL LETTER H WITH LINE BELOW
    "\u1E97":"\\\"{t}", // LATIN SMALL LETTER T WITH DIAERESIS
    "\u1EA0":"\\d{A}", // LATIN CAPITAL LETTER A WITH DOT BELOW
    "\u1EA1":"\\d{a}", // LATIN SMALL LETTER A WITH DOT BELOW
    "\u1EB8":"\\d{E}", // LATIN CAPITAL LETTER E WITH DOT BELOW
    "\u1EB9":"\\d{e}", // LATIN SMALL LETTER E WITH DOT BELOW
    "\u1EBC":"\\~{E}", // LATIN CAPITAL LETTER E WITH TILDE
    "\u1EBD":"\\~{e}", // LATIN SMALL LETTER E WITH TILDE
    "\u1ECA":"\\d{I}", // LATIN CAPITAL LETTER I WITH DOT BELOW
    "\u1ECB":"\\d{i}", // LATIN SMALL LETTER I WITH DOT BELOW
    "\u1ECC":"\\d{O}", // LATIN CAPITAL LETTER O WITH DOT BELOW
    "\u1ECD":"\\d{o}", // LATIN SMALL LETTER O WITH DOT BELOW
    "\u1EE4":"\\d{U}", // LATIN CAPITAL LETTER U WITH DOT BELOW
    "\u1EE5":"\\d{u}", // LATIN SMALL LETTER U WITH DOT BELOW
    "\u1EF2":"\\`{Y}", // LATIN CAPITAL LETTER Y WITH GRAVE
    "\u1EF3":"\\`{y}", // LATIN SMALL LETTER Y WITH GRAVE
    "\u1EF4":"\\d{Y}", // LATIN CAPITAL LETTER Y WITH DOT BELOW
    "\u1EF5":"\\d{y}", // LATIN SMALL LETTER Y WITH DOT BELOW
    "\u1EF8":"\\~{Y}", // LATIN CAPITAL LETTER Y WITH TILDE
    "\u1EF9":"\\~{y}", // LATIN SMALL LETTER Y WITH TILDE
	
};

var alwaysMap = {
	"|":"{\\textbar}",
	"<":"{\\textless}",
	">":"{\\textgreater}",
	"~":"{\\textasciitilde}",
	"^":"{\\textasciicircum}",
	"\\":"{\\textbackslash}"
};

var strings = new Object();
var keyRe = /[a-zA-Z0-9\-]/;

function processField(item, field, value) {
	if(fieldMap[field]) {
		item[fieldMap[field]] = value;
	} else if(inputFieldMap[field]) {
		item[inputFieldMap[field]] = value;
	} else if(field == "journal") {
		if(item.publicationTitle) {
			// we already had an fjournal
			item.journalAbbreviation = value
		} else {
			item.publicationTitle = value;
		}
	} else if(field == "fjournal") {
		if(item.publicationTitle) {
			// move publicationTitle to abbreviation
			item.journalAbbreviation = value;
		}
		item.publicationTitle = value;
	} else if(field == "author" || field == "editor") {
		// parse authors/editors
		var names = value.split(" and ");
		for each(var name in names) {
			item.creators.push(Zotero.Utilities.cleanAuthor(name, field,
			                                  (name.indexOf(",") != -1)));
		}
	} else if(field == "institution" || field == "organization") {
		item.backupPublisher = value;
	} else if(field == "number"){ // fix for techreport
		if (item.itemType == "report") {
			item.reportNumber = value;
		} else {
			item.issue = value;
		}
	} else if(field == "month") {
		var monthIndex = months.indexOf(value.toLowerCase());
		if(monthIndex != -1) {
			value = Zotero.Utilities.formatDate({month:monthIndex});
		} else {
			value += " ";
		}
		
		if(item.date) {
			if(value.indexOf(item.date) != -1) {
				// value contains year and more
				item.date = value;
			} else {
				item.date = value+item.date;
			}
		} else {
			item.date = value;
		}
	} else if(field == "year") {
		if(item.date) {
			if(item.date.indexOf(value) == -1) {
				// date does not already contain year
				item.date += value;
			}
		} else {
			item.date = value;
		}
	} else if(field == "pages") {
		item.pages = value.replace(/--/g, "-");
	} else if(field == "note" || field == "annote") {
		item.extra += "\n"+value;
	} else if(field == "howpublished") {
		if(value.length >= 7) {
			var str = value.substr(0, 7);
			if(str == "http://" || str == "https:/" || str == "mailto:") {
				item.url = value;
			} else {
				item.extra += "\nPublished: "+value;
			}
		}
	} else if(field == "keywords") {
		if(value.indexOf(",") == -1) {
			// keywords/tags
			item.tags = value.split(" ");
		} else {
			item.tags = value.split(/, ?/g);
		}
	} else if (field == "comment") {
		item.notes.push({note:value});
	} else if(field == "pdf") { // new code to handle PDF import. absolute file path should be specified in bibtex
        item.attachments = [{url:"file://"+value, mimeType:"application/pdf"}];
    }
}

function getFieldValue(read) {
	var value = "";
	// now, we have the first character of the field
	if(read == "{") {
		// character is a brace
		var openBraces = 1;
		while(read = Zotero.read(1)) {
			if(read == "{" && value[value.length-1] != "\\") {
				openBraces++;
				value += "{";
			} else if(read == "}" && value[value.length-1] != "\\") {
				openBraces--;
				if(openBraces == 0) {
					break;
				} else {
					value += "}";
				}
			} else {
				value += read;
			}
		}
	} else if(read == '"') {
		var openBraces = 0;
		while(read = Zotero.read(1)) {
			if(read == "{" && value[value.length-1] != "\\") {
				openBraces++;
				value += "{";
			} else if(read == "}" && value[value.length-1] != "\\") {
				openBraces--;
				value += "}";
			} else if(read == '"' && openBraces == 0) {
				break;
			} else {
				value += read;
			}
		}
	}
	
	if(value.length > 1) {
		// replace accented characters (yucky slow)
		value = value.replace(/{(\\[`"'^~=a-z])([A-Za-z])}/g, "$1{$2}");
		for (var i in reversemappingTable) { // really really slow!
			var mapped = reversemappingTable[i];
			if (value.indexOf(mapped) != -1) {
				Zotero.debug("Replace " + mapped + " in " + value + " with " + i);
				value = value.replace(mapped, i, "g");
			}
			mapped = mapped.replace(/[{}]/, "");
			if (value.indexOf(mapped) != -1) {
				Zotero.debug("Replace(2) " + mapped + " in " + value + " with " + i);
				value = value.replace(mapped, i, "g");
			}
		}
		
		// kill braces
		value = value.replace(/([^\\])[{}]+/g, "$1");
		if(value[0] == "{") {
			value = value.substr(1);
		}
		
		// chop off backslashes
		value = value.replace(/([^\\])\\([#$%&~_^\\{}])/g, "$1$2");
		value = value.replace(/([^\\])\\([#$%&~_^\\{}])/g, "$1$2");
		if(value[0] == "\\" && "#$%&~_^\\{}".indexOf(value[1]) != -1) {
			value = value.substr(1);
		}
		if(value[value.length-1] == "\\" &&  "#$%&~_^\\{}".indexOf(value[value.length-2]) != -1) {
			value = value.substr(0, value.length-1);
		}
		value = value.replace(/\\\\/g, "\\");
		value = value.replace(/\s+/g, " ");
	}
	
	return value;
}

function beginRecord(type, closeChar) {
	type = Zotero.Utilities.cleanString(type.toLowerCase());
	if(type != "string") {
		var zoteroType = bibtex2zoteroTypeMap[type];
		if (!zoteroType) {
			Zotero.debug("discarded item from BibTeX; type was "+type);
		}
		var item = new Zotero.Item(zoteroType);
		
		item.extra = "";
	}
	
	var field = "";
	
	// by setting dontRead to true, we can skip a read on the next iteration
	// of this loop. this is useful after we read past the end of a string.
	var dontRead = false;
	
	while(dontRead || (read = Zotero.read(1))) {
		dontRead = false;
		
		if(read == "=") {								// equals begin a field
		// read whitespace
			var read = Zotero.read(1);
			while(" \n\r\t".indexOf(read) != -1) {
				read = Zotero.read(1);
			}
			
			if(keyRe.test(read)) {
				// read numeric data here, since we might get an end bracket
				// that we should care about
				value = "";
				value += read;
				
				// character is a number
				while((read = Zotero.read(1)) && keyRe.test(read)) {
					value += read;
				}
				
				// don't read the next char; instead, process the character
				// we already read past the end of the string
				dontRead = true;
				
				// see if there's a defined string
				if(strings[value]) value = strings[value];
			} else {
				var value = getFieldValue(read);
			}
			
			if(item) {
				processField(item, field.toLowerCase(), value);
			} else if(type == "string") {
				strings[field] = value;
			}
			field = "";
		} else if(read == ",") {						// commas reset
			field = "";
		} else if(read == closeChar) {
			if(item) {
				if(item.extra) item.extra = item.extra.substr(1); // chop \n
				item.complete();
			}
			return;
		} else if(" \n\r\t".indexOf(read) == -1) {		// skip whitespace
			field += read;
		}
	}
}

function doImport() {
	var read = "", text = "", recordCloseElement = false;
	var type = false;
	
	while(read = Zotero.read(1)) {
		if(read == "@") {
			type = "";
		} else if(type !== false) {
			if(type == "comment") {
				type = false;
			} else if(read == "{") {		// possible open character
				beginRecord(type, "}");
				type = false;
			} else if(read == "(") {		// possible open character
				beginRecord(type, ")");
				type = false;
			} else {
				type += read;
			}
		}
	}
}

// some fields are, in fact, macros.  If that is the case then we should not put the
// data in the braces as it will cause the macros to not expand properly
function writeField(field, value, isMacro) {
	if(!value) return;
	value = value + ""; // convert integers to strings
	Zotero.write(",\n\t"+field+" = ");
	if(!isMacro) Zotero.write("{");
	// I hope these are all the escape characters!
	value = value.replace(/[|\<\>\~\^\\]/g, mapEscape).replace(/([\#\$\%\&\_])/g, "\\$1");
	if (!Zotero.getOption("UTF8")) {
		value = value.replace(/[\u0080-\uFFFF]/g, mapAccent);
	}
	Zotero.write(value);
	if(!isMacro) Zotero.write("}");
}

function mapEscape(character) {
	return alwaysMap[character];
}

function mapAccent(character) {
	return (mappingTable[character] ? mappingTable[character] : "?");
}

var numberRe = /^[0-9]+/;
// this is a list of words that should not appear as part of the citation key
var citeKeyTitleBannedRe = /(\s+|\b)(a|an|from|does|how|it\'s|its|on|some|the|this|why)(\s+|\b)/g;
var citeKeyConversionsRe = /%([a-zA-Z])/;
var citeKeyCleanRe = /[^a-z0-9\!\$\&\*\+\-\.\/\:\;\<\>\?\[\]\^\_\`\|]+/g;

var citeKeyConversions = {
    "a":function (flags, item) {
        if(item.creators && item.creators[0] && item.creators[0].lastName) {
            return item.creators[0].lastName.toLowerCase().replace(/ /g,"_").replace(/,/g,"");
        }
        return "";
    },
    "t":function (flags, item) {
        if (item["title"]) {
            return item["title"].toLowerCase().replace(citeKeyTitleBannedRe, "").split(" ")[0];
        }
        return "";
    },
    "y":function (flags, item) {
        if(item.date) {
            var date = Zotero.Utilities.strToDate(item.date);
            if(date.year && numberRe.test(date.year)) {
                return date.year;
            }
        }
        return "????";
    }
}


function buildCiteKey (item,citekeys) {
    var basekey = "";
    var counter = 0;
    citeKeyFormatRemaining = citeKeyFormat;
    while (citeKeyConversionsRe.test(citeKeyFormatRemaining)) {
        if (counter > 100) {
            Zotero.debug("Pathological BibTeX format: " + citeKeyFormat);
            break;
        }
        var m = citeKeyFormatRemaining.match(citeKeyConversionsRe);
        if (m.index > 0) {
            //add data before the conversion match to basekey
            basekey = basekey + citeKeyFormatRemaining.substr(0, m.index);
        }
        var flags = ""; // for now
        var f = citeKeyConversions[m[1]];
        if (typeof(f) == "function") {
            var value = f(flags, item);
            Zotero.debug("Got value " + value + " for %" + m[1]);
            //add conversion to basekey
            basekey = basekey + value;
        }
        citeKeyFormatRemaining = citeKeyFormatRemaining.substr(m.index + m.length);
        counter++;
    }
    if (citeKeyFormatRemaining.length > 0) {
        basekey = basekey + citeKeyFormatRemaining;
    }

    // for now, remove any characters not explicitly known to be allowed;
    // we might want to allow UTF-8 citation keys in the future, depending
    // on implementation support.
    //
    // no matter what, we want to make sure we exclude
    // " # % ' ( ) , = { } ~ and backslash

    basekey = basekey.replace(citeKeyCleanRe, "");
    var citekey = basekey;
    var i = 0;
    while(citekeys[citekey]) {
        i++;
        citekey = basekey + "-" + i;
    }
    citekeys[citekey] = true;
    return citekey;
}

function doExport() {
	//Zotero.write("% BibTeX export generated by Zotero "+Zotero.Utilities.getVersion());
	// to make sure the BOM gets ignored
	Zotero.write("\n");
	
	var first = true;
	var citekeys = new Object();
	var item;
	while(item = Zotero.nextItem()) {
		// determine type
		var type = zotero2bibtexTypeMap[item.itemType];
		if (typeof(type) == "function") { type = type(item); }
		if(!type) type = "misc";
		
		// create a unique citation key
		var citekey = buildCiteKey(item, citekeys);
		
		// write citation key
		Zotero.write((first ? "" : ",\n\n") + "@"+type+"{"+citekey);
		first = false;
		
		for(var field in fieldMap) {
			if(item[fieldMap[field]]) {
				writeField(field, item[fieldMap[field]]);
			}
		}

		if(item.reportNumber || item.issue) {
			writeField("number", item.reportNumber || item.issue);
		}

		if(item.publicationTitle) {
			if(item.itemType == "bookSection" || item.itemType == "conferencePaper") {
				writeField("booktitle", item.publicationTitle);
			} else {
				writeField("journal", item.publicationTitle);
			}
		}
		
		if(item.publisher) {
			if(item.itemType == "thesis") {
				writeField("school", item.publisher);
			} else if(item.itemType =="report") {
				writeField("institution", item.publisher);
			} else {
				writeField("publisher", item.publisher);
			}
		}
		
		if(item.creators && item.creators.length) {
			// split creators into subcategories
			var author = "";
			var editor = "";
			for each(var creator in item.creators) {
				var creatorString = creator.lastName;

				if (creator.firstName) {
					creatorString = creator.firstName + " " + creator.lastName;
				}

				if (creator.creatorType == "editor") {
					editor += " and "+creatorString;
				} else {
					author += " and "+creatorString;
				}
			}
			
			if(author) {
				writeField("author", author.substr(5));
			}
			if(editor) {
				writeField("editor", editor.substr(5));
			}
		}
		
		if(item.date) {
			var date = Zotero.Utilities.strToDate(item.date);
			// need to use non-localized abbreviation
			if(date.month) {
				writeField("month", months[date.month], true);
			}
			if(date.year) {
				writeField("year", date.year);
			}
		}
		
		if(item.extra) {
			writeField("note", item.extra);
		}
		
		if(item.tags && item.tags.length) {
			var tagString = "";
			for each(var tag in item.tags) {
				tagString += ","+tag.tag;
			}
			writeField("keywords", tagString.substr(1));
		}
		
		if(item.pages) {
			writeField("pages", item.pages.replace("-","--"));
		}
		
		if(item.itemType == "webpage") {
			writeField("howpublished", item.url);
		}
		if (item.notes) {
			for each (var note in item.notes) {
				writeField("comment", note["note"]);
			}
		}		
		Zotero.write("\n}");
	}
}