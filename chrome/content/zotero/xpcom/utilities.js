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

/*
 * Mappings for names
 * Note that this is the reverse of the text variable map, since all mappings should be one to one
 * and it makes the code cleaner
 */
const CSL_NAMES_MAPPINGS = {
	"author":"author",
	"editor":"editor",
	"bookAuthor":"container-author",
	"composer":"composer",
	"director":"director",
	"interviewer":"interviewer",
	"recipient":"recipient",
	"reviewedAuthor":"reviewed-author",
	"seriesEditor":"collection-editor",
	"translator":"translator"
}

/*
 * Mappings for text variables
 */
const CSL_TEXT_MAPPINGS = {
	"title":["title"],
	"container-title":["publicationTitle",  "reporter", "code"], /* reporter and code should move to SQL mapping tables */
	"collection-title":["seriesTitle", "series"],
	"collection-number":["seriesNumber"],
	"publisher":["publisher", "distributor"], /* distributor should move to SQL mapping tables */
	"publisher-place":["place"],
	"authority":["court"],
	"page":["pages"],
	"volume":["volume"],
	"issue":["issue"],
	"number-of-volumes":["numberOfVolumes"],
	"number-of-pages":["numPages"],	
	"edition":["edition"],
	"version":["version"],
	"section":["section"],
	"genre":["type"],
	"source":["libraryCatalog"],
	"dimensions": ["artworkSize", "runningTime"],
	"medium":["medium", "system"],
	"scale":["scale"],
	"archive":["archive"],
	"archive_location":["archiveLocation"],
	"event":["meetingName", "conferenceName"], /* these should be mapped to the same base field in SQL mapping tables */
	"event-place":["place"],
	"abstract":["abstractNote"],
	"URL":["url"],
	"DOI":["DOI"],
	"ISBN":["ISBN"],
	"ISSN":["ISSN"],
	"call-number":["callNumber"],
	"note":["extra"],
	"number":["number"],
	"references":["history"],
	"shortTitle":["shortTitle"],
	"journalAbbreviation":["journalAbbreviation"],
	"language":["language"]
}

/*
 * Mappings for dates
 */
const CSL_DATE_MAPPINGS = {
	"issued":"date",
	"accessed":"accessDate"
}

/*
 * Mappings for types
 */
const CSL_TYPE_MAPPINGS = {
	'book':"book",
	'bookSection':'chapter',
	'journalArticle':"article-journal",
	'magazineArticle':"article-magazine",
	'newspaperArticle':"article-newspaper",
	'thesis':"thesis",
	'encyclopediaArticle':"entry-encyclopedia",
	'dictionaryEntry':"entry-dictionary",
	'conferencePaper':"paper-conference",
	'letter':"personal_communication",
	'manuscript':"manuscript",
	'interview':"interview",
	'film':"motion_picture",
	'artwork':"graphic",
	'webpage':"webpage",
	'report':"report",
	'bill':"bill",
	'case':"legal_case",
	'hearing':"bill",				// ??
	'patent':"patent",
	'statute':"legislation",		// ??
	'email':"personal_communication",
	'map':"map",
	'blogPost':"post-weblog",
	'instantMessage':"personal_communication",
	'forumPost':"post",
	'audioRecording':"song",		// ??
	'presentation':"speech",
	'videoRecording':"motion_picture",
	'tvBroadcast':"broadcast",
	'radioBroadcast':"broadcast",
	'podcast':"song",			// ??
	'computerProgram':"book"		// ??
};

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
		var allCaps = 'A-Z' + 
									'\u0400-\u042f';		//cyrilic

		var allCapsRe = new RegExp('^[' + allCaps + ']+$');
		var initialRe = new RegExp('^-?[' + allCaps + ']$');

		if(typeof(author) != "string") {
			throw "cleanAuthor: author must be a string";
		}

		author = author.replace(/^[\s\u00A0\.\,\/\[\]\:]+/, '')
									  .replace(/[\s\u00A0\.\,\/\[\]\:]+$/, '')
									.replace(/[\s\u00A0]+/, ' ');

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

		//add periods after all the initials
		if(firstName) {
			var names = firstName.replace(/^[\s\.]+/,'')
						.replace(/[\s\,]+$/,'')
						//remove spaces surronding any dashes
						.replace(/\s*([\u002D\u00AD\u2010-\u2015\u2212\u2E3A\u2E3B])\s*/,'-')
						.split(/(?:[\s\.]+|(?=-))/);
			var newFirstName = '';
			for(var i=0, n=names.length; i<n; i++) {
				newFirstName += names[i];
				if(initialRe.test(names[i])) newFirstName += '.';
				newFirstName += ' ';
			}
			firstName = newFirstName.replace(/ -/g,'-').trim();
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
		
		var x = x.replace(/^[\x00-\x27\x29-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\s]+/, "");
		return x.replace(/[\x00-\x28\x2A-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F\s]+$/, "");
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

		var doi = x.match(/10\.[0-9]{4,}\/[^\s]*[^\s\.,]/);
		return doi ? doi[0] : null;
	},

	/**
	 * Clean and validate ISBN.
	 * Return isbn if valid, otherwise return false
	 */
	"cleanISBN":function(/**String*/ isbn) {
		isbn = isbn.replace(/[^0-9a-z]+/ig, '').toUpperCase()	//we only want to ignore punctuation, spaces
						.match(/(?:97[89][0-9]{10}|[0-9]{9}[0-9X])/);	//13 digit or 10 digit
		if(!isbn) return false;
		isbn = isbn[0];

		if(isbn.length == 10) {
			// Verify ISBN-10 checksum
			var sum = 0;
			for (var i = 0; i < 9; i++) {
				if(isbn[i] == 'X') return false;	//X can only be a check digit
				sum += isbn[i] * (10-i);
			}
			//check digit might be 'X'
			sum += (isbn[9] == 'X')? 10 : isbn[9]*1;

			return (sum % 11 == 0) ? isbn : false;
		}

		if(isbn.length == 13) {
			// Verify checksum
			var sum = 0;
			for (var i = 0; i < 12; i+=2) sum += isbn[i]*1;	//to make sure it's int
			for (var i = 1; i < 12; i+=2) sum += isbn[i]*3;
			sum += isbn[12]*1; //add the check digit

			return (sum % 10 == 0 )? isbn : false;
		}

		return false;
	},
	
	/**
	 * Hyphenate an ISBN based on the registrant table available from
	 * http://www.isbn-international.org/page/ranges
	 */
	"hyphenateISBN": (function() {
		var prefs={"978":{"0":["00","19","200","699","7000","8499","85000","89999","900000","949999","9500000","9999999"],"1":["00","09","100","399","4000","5499","55000","86979","869800","998999","9990000","9999999"],"2":["00","19","200","349","400","699","7000","8399","35000","39999","84000","89999","900000","949999","9500000","9999999"],"3":["00","02","04","19","030","033","200","699","0340","0369","7000","8499","03700","03999","85000","89999","95400","96999","99000","99499","99500","99999","900000","949999","9500000","9539999","9700000","9899999"],"5":["01","19","200","420","430","430","440","440","450","699","0050","0099","4210","4299","4310","4399","4410","4499","7000","8499","9200","9299","9501","9799","9910","9999","00000","00499","85000","89999","91000","91999","93000","94999","98000","98999","900000","909999","9500000","9500999","9900000","9909999"],"7":["00","09","100","499","5000","7999","80000","89999","900000","999999"],"80":["00","19","200","699","7000","8499","85000","89999","900000","999999"],"82":["00","19","200","699","7000","8999","90000","98999","990000","999999"],"83":["00","19","200","599","7000","8499","60000","69999","85000","89999","900000","999999"],"84":["00","13","140","149","200","699","7000","8499","9000","9199","9700","9999","15000","19999","85000","89999","92400","92999","95000","96999","920000","923999","930000","949999"],"85":["00","19","200","599","7000","8499","60000","69999","85000","89999","98000","99999","900000","979999"],"86":["00","29","300","599","6000","7999","80000","89999","900000","999999"],"87":["","","","","","","","","00","29","400","649","7000","7999","85000","94999","970000","999999"],"88":["00","19","200","599","910","929","6000","8499","9300","9399","85000","89999","95000","99999","900000","909999","940000","949999"],"89":["00","24","250","549","990","999","5500","8499","85000","94999","97000","98999","950000","969999"],"90":["","","","","00","19","90","90","94","94","200","499","5000","6999","8500","8999","70000","79999","800000","849999"],"91":["","","","","","","0","1","20","49","500","649","7000","7999","85000","94999","970000","999999"],"92":["0","5","60","79","800","899","9000","9499","95000","98999","990000","999999"],"93":["00","09","100","499","5000","7999","80000","94999","950000","999999"],"94":["000","599","6000","8999","90000","99999"],"600":["00","09","100","499","5000","8999","90000","99999"],"601":["00","19","85","99","200","699","7000","7999","80000","84999"],"602":["00","11","200","749","1200","1399","1500","1699","7500","7999","8000","9499","14000","14999","17000","17999","18000","18999","19000","19999","95000","99999"],"603":["00","04","05","49","500","799","8000","8999","90000","99999"],"604":["0","4","50","89","900","979","9800","9999"],"605":["","","01","09","90","99","100","399","4000","5999","60000","89999"],"606":["0","0","10","49","500","799","8000","9199","92000","99999"],"607":["00","39","400","749","7500","9499","95000","99999"],"608":["0","0","7","9","10","19","200","449","4500","6499","65000","69999"],"609":["00","39","400","799","8000","9499","95000","99999"],"611":["",""],"612":["00","29","50","99","300","399","4000","4499","45000","49999"],"613":["0","9"],"615":["","","00","09","100","499","5000","7999","80000","89999"],"616":["00","19","200","699","7000","8999","90000","99999"],"617":["00","49","500","699","7000","8999","90000","99999"],"618":["00","19","200","499","5000","7999","80000","99999"],"619":["00","14","150","699","7000","8999","90000","99999"],"621":["","","","","","","00","29","400","599","8000","8999","95000","99999"],"950":["00","49","500","899","9000","9899","99000","99999"],"951":["0","1","20","54","550","889","8900","9499","95000","99999"],"952":["00","19","60","65","80","94","200","499","5000","5999","6600","6699","7000","7999","9500","9899","67000","69999","99000","99999"],"953":["0","0","10","14","51","54","150","509","6000","9499","55000","59999","95000","99999"],"954":["00","28","300","799","2900","2999","8000","8999","9300","9999","90000","92999"],"955":["20","43","550","799","0000","1999","4500","4999","8000","9499","44000","44999","50000","54999","95000","99999"],"956":["00","19","200","699","7000","9999"],"957":["00","02","05","19","21","27","31","43","440","819","0300","0499","2000","2099","8200","9699","28000","30999","97000","99999"],"958":["00","56","600","799","8000","9499","57000","59999","95000","99999"],"959":["00","19","200","699","7000","8499","85000","99999"],"960":["00","19","93","93","200","659","690","699","6600","6899","7000","8499","9400","9799","85000","92999","98000","99999"],"961":["","","00","19","200","599","6000","8999","90000","94999"],"962":["00","19","200","699","900","999","7000","8499","8700","8999","85000","86999"],"963":["00","19","200","699","7000","8499","9000","9999","85000","89999"],"964":["00","14","150","249","300","549","970","989","2500","2999","5500","8999","9900","9999","90000","96999"],"965":["","","","","00","19","200","599","7000","7999","90000","99999"],"966":["00","12","14","14","130","139","170","199","279","289","300","699","910","949","980","999","1500","1699","2000","2789","2900","2999","7000","8999","90000","90999","95000","97999"],"967":["","","00","00","60","89","300","499","900","989","0100","0999","5000","5999","9900","9989","10000","19999","99900","99999"],"968":["01","39","400","499","800","899","5000","7999","9000","9999"],"969":["0","1","20","39","400","799","8000","9999"],"970":["01","59","600","899","9000","9099","9700","9999","91000","96999"],"971":["02","02","06","49","97","98","000","015","500","849","0160","0199","0300","0599","8500","9099","9600","9699","9900","9999","91000","95999"],"972":["0","1","20","54","550","799","8000","9499","95000","99999"],"973":["0","0","20","54","100","169","550","759","1700","1999","7600","8499","8900","9499","85000","88999","95000","99999"],"974":["00","19","200","699","7000","8499","9500","9999","85000","89999","90000","94999"],"975":["02","24","250","599","990","999","6000","9199","00000","01999","92000","98999"],"976":["0","3","40","59","600","799","8000","9499","95000","99999"],"977":["00","19","90","99","200","499","700","849","5000","6999","85000","89999"],"978":["000","199","900","999","2000","2999","8000","8999","30000","79999"],"979":["20","29","000","099","400","799","1000","1499","3000","3999","8000","9499","15000","19999","95000","99999"],"980":["00","19","200","599","6000","9999"],"981":["","","00","11","200","289","290","299","310","399","3000","3099","4000","9999"],"982":["00","09","70","89","100","699","9000","9799","98000","99999"],"983":["00","01","45","49","50","79","020","199","800","899","2000","3999","9000","9899","40000","44999","99000","99999"],"984":["00","39","400","799","8000","8999","90000","99999"],"985":["00","39","400","599","6000","8999","90000","99999"],"986":["00","11","120","559","5600","7999","80000","99999"],"987":["00","09","30","35","40","44","500","899","1000","1999","3600","3999","9000","9499","20000","29999","45000","49999","95000","99999"],"988":["00","11","200","799","8000","9699","12000","14999","15000","16999","17000","19999","97000","99999"],"9927":["","","00","09","100","399","4000","4999"],"9929":["0","3","40","54","550","799","8000","9999"],"9930":["00","49","500","939","9400","9999"],"9931":["00","29","300","899","9000","9999"],"9932":["00","39","400","849","8500","9999"],"9933":["0","0","10","39","400","899","9000","9999"],"9934":["0","0","10","49","500","799","8000","9999"],"9937":["0","2","30","49","500","799","8000","9999"],"9938":["00","79","800","949","9500","9999"],"9939":["0","4","50","79","800","899","9000","9999"],"9940":["0","1","20","49","500","899","9000","9999"],"9942":["00","84","900","984","8500","8999","9850","9999"],"9943":["00","29","300","399","4000","9999"],"9944":["60","69","80","89","100","499","700","799","900","999","0000","0999","5000","5999"],"9945":["00","00","08","39","57","57","010","079","400","569","580","849","8500","9999"],"9946":["0","1","20","39","400","899","9000","9999"],"9947":["0","1","20","79","800","999"],"9950":["00","29","300","849","8500","9999"],"9953":["0","0","10","39","60","89","400","599","9000","9999"],"9955":["00","39","400","929","9300","9999"],"9957":["00","39","70","84","88","99","400","699","8500","8799"],"9958":["00","03","10","18","20","49","040","089","500","899","0900","0999","1900","1999","9000","9999"],"9959":["0","1","20","79","98","99","800","949","970","979","9500","9699"],"9960":["00","59","600","899","9000","9999"],"9961":["0","2","30","69","700","949","9500","9999"],"9962":["00","54","56","59","600","849","5500","5599","8500","9999"],"9963":["0","1","20","24","30","54","250","279","550","734","2800","2999","7350","7499","7500","9999"],"9964":["0","6","70","94","950","999"],"9965":["00","39","400","899","9000","9999"],"9966":["20","69","000","149","750","959","1500","1999","7000","7499","9600","9999"],"9971":["0","5","60","89","900","989","9900","9999"],"9972":["1","1","00","09","30","59","200","249","600","899","2500","2999","9000","9999"],"9973":["00","05","10","69","060","089","700","969","0900","0999","9700","9999"],"9974":["0","2","30","54","95","99","550","749","7500","9499"],"9975":["0","0","45","89","100","399","900","949","4000","4499","9500","9999"],"9977":["00","89","900","989","9900","9999"],"9978":["00","29","40","94","300","399","950","989","9900","9999"],"9979":["0","4","50","64","66","75","650","659","760","899","9000","9999"],"9980":["0","3","40","89","900","989","9900","9999"],"9981":["00","09","20","79","100","159","800","949","1600","1999","9500","9999"],"9982":["00","79","800","989","9900","9999"],"9983":["","","80","94","950","989","9900","9999"],"9984":["00","49","500","899","9000","9999"],"9986":["00","39","97","99","400","899","940","969","9000","9399"],"9987":["00","39","400","879","8800","9999"],"9988":["0","2","30","54","550","749","7500","9999"],"9989":["0","0","30","59","100","199","600","949","2000","2999","9500","9999"],"99901":["00","49","80","99","500","799"],"99903":["0","1","20","89","900","999"],"99904":["0","5","60","89","900","999"],"99905":["0","3","40","79","800","999"],"99906":["0","2","30","59","70","89","90","94","600","699","950","999"],"99908":["0","0","10","89","900","999"],"99909":["0","3","40","94","950","999"],"99910":["0","2","30","89","900","999"],"99911":["00","59","600","999"],"99912":["0","3","60","89","400","599","900","999"],"99913":["","","","","0","2","30","35","600","604"],"99914":["0","4","50","89","900","999"],"99915":["0","4","50","79","800","999"],"99916":["0","2","30","69","700","999"],"99919":["0","2","40","69","70","79","300","399","800","849","850","899","900","999"],"99921":["0","1","8","8","20","69","90","99","700","799"],"99922":["0","3","40","69","700","999"],"99926":["0","0","10","59","90","99","600","899"],"99927":["0","2","30","59","600","999"],"99928":["0","0","10","79","800","999"],"99932":["0","0","7","7","10","59","80","99","600","699"],"99935":["0","2","7","8","30","59","90","99","600","699"],"99936":["0","0","10","59","600","999"],"99937":["0","1","20","59","600","999"],"99938":["0","1","20","59","90","99","600","899"],"99940":["0","0","10","69","700","999"],"99941":["0","2","30","79","800","999"],"99947":["0","2","30","69","96","99","700","959"],"99953":["0","2","30","79","94","99","800","939"],"99954":["0","2","30","69","88","99","700","879"],"99955":["0","1","20","59","80","99","600","799"],"99956":["00","59","86","99","600","859"],"99958":["0","4","50","94","950","999"],"99960":["0","0","10","94","950","999"],"99961":["0","3","40","89","900","999"],"99963":["00","49","500","999"],"99966":["","","","","0","2","30","69","700","799"],"99967":["","","0","1","20","59","600","899"],"99971":["0","5","60","84","850","999"],"99974":["","","40","79","800","999"]},"979":{"10":["00","19","200","699","7000","8999","90000","97599","976000","999999"],"11":["00","24","250","549","5500","8499","85000","94999","950000","999999"]}};
		prefs['978']['4']=prefs['978']['0']; prefs['978']['614']=prefs['978']['609']; prefs['978']['99902']=prefs['978']['99951']=prefs['978']['611']; prefs['978']['620']=prefs['978']['613']; prefs['978']['81']=prefs['978']['80']; prefs['978']['9936']=prefs['978']['9952']=prefs['978']['9954']=prefs['978']['969']; prefs['978']['989']=prefs['978']['972']; prefs['978']['9928']=prefs['978']['9927']; prefs['978']['9968']=prefs['978']['9930']; prefs['978']['9948']=prefs['978']['9951']=prefs['978']['9932']; prefs['978']['9935']=prefs['978']['9941']=prefs['978']['9949']=prefs['978']['9956']=prefs['978']['9933']; prefs['978']['9985']=prefs['978']['9939']; prefs['978']['99923']=prefs['978']['99924']=prefs['978']['99934']=prefs['978']['99957']=prefs['978']['99964']=prefs['978']['9947']; prefs['978']['9967']=prefs['978']['9970']=prefs['978']['9965']; prefs['978']['9976']=prefs['978']['9971']; prefs['978']['99949']=prefs['978']['99903']; prefs['978']['99939']=prefs['978']['99945']=prefs['978']['99904']; prefs['978']['99918']=prefs['978']['99925']=prefs['978']['99965']=prefs['978']['99973']=prefs['978']['99905']; prefs['978']['99917']=prefs['978']['99910']; prefs['978']['99968']=prefs['978']['99912']; prefs['978']['99920']=prefs['978']['99970']=prefs['978']['99972']=prefs['978']['99914']; prefs['978']['99929']=prefs['978']['99930']=prefs['978']['99931']=prefs['978']['99942']=prefs['978']['99944']=prefs['978']['99948']=prefs['978']['99950']=prefs['978']['99952']=prefs['978']['99962']=prefs['978']['99969']=prefs['978']['99915']; prefs['978']['99933']=prefs['978']['99943']=prefs['978']['99946']=prefs['978']['99959']=prefs['978']['99927'];
		return function(isbn) {
			isbn = (isbn + '').replace(/[^x\d]/ig, '');
			//pad just in case
			if(isbn && isbn.length < 10) {
				isbn = ('000000000' + isbn);
				isbn = isbn.substr(isbn.length-10);
			} else if(!isbn || isbn.length != 10 && isbn.length != 13) {
				return;
			}
			
			var parts = [];
			var uccPref = '978';
			if(isbn.length == 13) {
				uccPref = isbn.substr(0,3);
				parts.push(uccPref);
				isbn = isbn.substr(3);
			}
			
			if(!prefs[uccPref]) return;
			
			for(var i=1, pref=isbn[0]; !prefs[uccPref][pref] && i < isbn.length-2; pref += isbn[i++]) {}
			
			var regRanges = prefs[uccPref][pref];
			if(!regRanges) {
				return;
			}
			
			parts.push(pref);
			isbn = isbn.substr(pref.length);
			var reg = '';
			var done = false;
			for(var j=0; !done && j<isbn.length; j++) {
				reg+=isbn[j];
				for(var k=0, m=regRanges.length; k<m && reg.length >= regRanges[k].length; k++) {
					if(reg.length == regRanges[k].length && reg <= regRanges[k]) {
						if(k%2 || regRanges[k] == regRanges[k+1]) {
							done = true;
						}
						break;
					}
				}
			}
			
			if(!done) return;
			
			isbn = isbn.substr(reg.length);
			parts.push(reg);
			parts.push(isbn.substr(0,isbn.length-1));
			parts.push(isbn[isbn.length-1]);
			return parts.join('-');
		}
	})(),

	/**
	 * Clean and validate ISSN.
	 * Return issn if valid, otherwise return false
	 */
	"cleanISSN":function(/**String*/ issn) {
		issn = issn.replace(/[^0-9a-z]+/ig, '').toUpperCase()	//we only want to ignore punctuation, spaces
						.match(/[0-9]{7}[0-9X]/);	//13 digit or 10 digit
		if(!issn) return false;
		issn = issn[0];

		// Verify ISBN-10 checksum
		var sum = 0;
		for (var i = 0; i < 7; i++) {
			if(issn[i] == 'X') return false;	//X can only be a check digit
			sum += issn[i] * (8-i);
		}
		//check digit might be 'X'
		sum += (issn[9] == 'X')? 10 : issn[9]*1;

		return (sum % 11 == 0) ? issn.substring(0,4) + '-' + issn.substring(4) : false;
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
		if (typeof str != 'string') str = str.toString();
		
		if (!str) {
			return '';
		}
		
		return str
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/&lt;ZOTERO([^\/]+)\/&gt;/g, function (str, p1, offset, s) {
			switch (p1) {
				case 'BREAK':
					return '<br/>';
				case 'HELLIP':
					return '&#8230;';
				default:
					return p1;
			}
		});
	},

	/**
	 * Decodes HTML entities within a string, returning plain text
	 * @type String
	 */
	"unescapeHTML":new function() {
		var nsIScriptableUnescapeHTML, node;
		
		return function(/**String*/ str) {
			// If no tags, no need to unescape
			if(str.indexOf("<") === -1 && str.indexOf("&") === -1) return str;
			
			if(Zotero.isFx && !Zotero.isBookmarklet) {
				// Create a node and use the textContent property to do unescaping where
				// possible, because this approach preserves line endings in the HTML
				if(node === undefined) {
					var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
						 .createInstance(Components.interfaces.nsIDOMParser);
					var domDocument = parser.parseFromString("<!DOCTYPE html><html></html>",
						"text/html");
					node = domDocument.createElement("div");
				}
				
				node.innerHTML = str;
				return node.textContent.replace(/ {2,}/g, " ");
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
				if(!node) node = document.createElement("div");
				node.innerHTML = str;
				return ("textContent" in node ? node.textContent : node.innerText).replace(/ {2,}/g, " ");
			}
		};
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
		if (!Array.isArray(array1)) {
			throw ("array1 is not an array (" + array1 + ")");
		}
		if (!Array.isArray(array2)) {
			throw ("array2 is not an array (" + array2 + ")");
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
		const delimiterRegexp = /([ \/\u002D\u00AD\u2010-\u2015\u2212\u2E3A\u2E3B])/;
		
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
						words[i] = upperCaseVariant.substr(0, 1) + lowerCaseVariant.substr(1);
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
		// Short-circuit on the most basic input
		if (/^[a-zA-Z0-9_-]*$/.test(str)) return str;

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
			if(!obj.hasOwnProperty(i)) continue;
			
			if(typeof obj[i] === "object" && obj[i] !== null) {
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
	 * Determine whether a given field is valid for a given item type
	 *
	 * @param {String} field Field name
	 * @param {String} type Item type
	 * @type Boolean
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
		
		if(!("length" in elements)) elements = [elements];
		
		var results = [];
		for(var i=0, n=elements.length; i<n; i++) {
			var element = elements[i];
			
			// Firefox 5 hack, so we will preserve Fx5DOMWrappers
			var isWrapped = Zotero.Translate.DOMWrapper && Zotero.Translate.DOMWrapper.isWrapped(element);
			if(isWrapped) element = Zotero.Translate.DOMWrapper.unwrap(element);
			
			if(element.ownerDocument) {
				var rootDoc = element.ownerDocument;
			} else if(element.documentElement) {
				var rootDoc = element;
			} else if(Zotero.isIE && element.documentElement === null) {
				// IE: documentElement may be null if there is a parse error. In this
				// case, we don't match anything to mimic what would happen with DOMParser
				continue;
			} else {
				throw new Error("First argument must be either element(s) or document(s) in Zotero.Utilities.xpath(elements, '"+xpath+"')");
			}
			
			if(!Zotero.isIE || "evaluate" in rootDoc) {
				try {
					// This may result in a deprecation warning in the console due to
					// https://bugzilla.mozilla.org/show_bug.cgi?id=674437
					var xpathObject = rootDoc.evaluate(xpath, element, nsResolver, 5 /*ORDERED_NODE_ITERATOR_TYPE*/, null);
				} catch(e) {
					// rethrow so that we get a stack
					throw new Error(e.name+": "+e.message);
				}
				
				var newEl;
				while(newEl = xpathObject.iterateNext()) {
					// Firefox 5 hack
					results.push(isWrapped ? Zotero.Translate.DOMWrapper.wrap(newEl) : newEl);
				}
			} else if("selectNodes" in element) {
				// We use JavaScript-XPath in IE for HTML documents, but with an XML
				// document, we need to use selectNodes
				if(namespaces) {
					var ieNamespaces = [];
					for(var i in namespaces) {
						if(!i) continue;
						ieNamespaces.push('xmlns:'+i+'="'+Zotero.Utilities.htmlSpecialChars(namespaces[i])+'"');
					}
					rootDoc.setProperty("SelectionNamespaces", ieNamespaces.join(" "));
				}
				var nodes = element.selectNodes(xpath);
				for(var i=0; i<nodes.length; i++) {
					results.push(nodes[i]);
				}
			} else {
				throw new Error("XPath functionality not available");
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
		for(var i=0, n=elements.length; i<n; i++) {
			var el = elements[i];
			strings[i] =
				(el.nodeType === 2 /*ATTRIBUTE_NODE*/ && "value" in el) ? el.value
				: "textContent" in el ? el.textContent
				: "innerText" in el ? el.innerText
				: "text" in el ? el.text
				: el.nodeValue;
		}
		
		return strings.join(delimiter !== undefined ? delimiter : ", ");
	},
	
	/**
	 * Generate a random string of length 'len' (defaults to 8)
	 **/
	"randomString":function(len, chars) {
		if (!chars) {
			chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
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
	"varDump":function(arr,level,maxLevel,parentObjects,path) {
		var dumped_text = "";
		if (level === undefined){
			level = 0;
		}

		if (maxLevel === undefined) {
			maxLevel = 4;
		}

		// The padding given at the beginning of the line.
		var level_padding = "";
		for (var j=0;j<level+1;j++){
			level_padding += "    ";
		}

		if (level > maxLevel){
			return dumped_text + level_padding + "<<Maximum depth reached>>...\n";
		}
		
		if (typeof(arr) == 'object') { // Array/Hashes/Objects
			var isRequest = Zotero.isFx && !Zotero.isBookmarklet
				&& arr instanceof Components.interfaces.nsIRequest;
			
			//array for checking recursion
			//initialise at first itteration
			if(!parentObjects) {
				parentObjects = [arr];
				path = ['ROOT'];
			}

			for (var item in arr) {
				try {
					// Don't display nsIRequest.name, which can contain password
					if (isRequest && item == 'name') {
						dumped_text += level_padding + "'" + item + "' => <<Skipped>>\n";
						continue;
					}
					
					var value = arr[item];
				} catch(e) {
					dumped_text += level_padding + "'" + item + "' => <<Access Denied>>\n";
					continue;
				}
				
				if (typeof(value) == 'object') { // If it is an array
					//check for recursion
					var i = parentObjects.indexOf(value);
					if(i != -1) {
						var parentName = path.slice(0,i+1).join('->');
						dumped_text += level_padding + "'" + item + "' => <<Reference to parent object " + parentName + " >>\n";
						continue;
					}

					var openBrace = '{', closeBrace = '}';
					var type = Object.prototype.toString.call(value);
					if(type == '[object Array]') {
						openBrace = '[';
						closeBrace = ']';
					}

					dumped_text += level_padding + "'" + item + "' => " + type + ' ' + openBrace;
					//only recurse if there's anything in the object, purely cosmetical
					try {
						for(var i in value) {
							dumped_text += "\n" + Zotero.Utilities.varDump(value,level+1,maxLevel,parentObjects.concat([value]),path.concat([item])) + level_padding;
							break;
						}
					} catch(e) {
						dumped_text += "<<Error processing object:\n" + e + ">>\n";
					}
					dumped_text += closeBrace + "\n";
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
		const CREATE_ARRAYS = ['creators', 'notes', 'tags', 'seeAlso', 'attachments'];
		for(var i=0; i<CREATE_ARRAYS.length; i++) {
			var createArray = CREATE_ARRAYS[i];
			if(!item[createArray]) item[createArray] = [];
		}
		
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
	 * Converts an item from toArray() format to an array of items in
	 * the content=json format used by the server
	 */
	"itemToServerJSON":function(item) {
		var newItem = {
				"itemKey":Zotero.Utilities.generateObjectKey(),
				"itemVersion":0
			},
			newItems = [newItem];
		
		var typeID = Zotero.ItemTypes.getID(item.itemType);
		if(!typeID) {
			Zotero.debug("itemToServerJSON: Invalid itemType "+item.itemType+"; using webpage");
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
				var newCreators = newItem.creators = [];
				for(var j=0; j<n; j++) {
					var creator = val[j];
					
					if(!creator.firstName && !creator.lastName) {
						Zotero.debug("itemToServerJSON: Silently dropping empty creator");
						continue;
					}
					
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
							Zotero.debug("itemToServerJSON: Invalid creator type "+creator.creatorType+"; falling back to author");
						}
					}
					if(!newCreator.creatorType) newCreator.creatorType = "author";
					
					newCreators.push(newCreator);
				}
			} else if(field === "tags") {
				// normalize tags
				var n = val.length;
				var newTags = newItem.tags = [];
				for(var j=0; j<n; j++) {
					var tag = val[j];
					if(typeof tag === "object") {
						if(tag.tag) {
							tag = tag.tag;
						} else if(tag.name) {
							tag = tag.name;
						} else {
							Zotero.debug("itemToServerJSON: Discarded invalid tag");
							continue;
						}
					} else if(tag === "") {
						continue;
					}
					newTags.push({"tag":tag.toString(), "type":1});
				}
			} else if(field === "notes") {
				// normalize notes
				var n = val.length;
				for(var j=0; j<n; j++) {
					var note = val[j];
					if(typeof note === "object") {
						if(!note.note) {
							Zotero.debug("itemToServerJSON: Discarded invalid note");
							continue;
						}
						note = note.note;
					}
					newItems.push({"itemType":"note", "parentItem":newItem.itemKey,
						"note":note.toString()});
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
					var fieldName = Zotero.ItemFields.getName(itemFieldID);
					// Only map if item field does not exist
					if(fieldName !== field && !newItem[fieldName]) newItem[fieldName] = val;
					continue;	// already know this is valid
				}
				
				// if field is valid for this type, set field
				if(Zotero.ItemFields.isValidForType(fieldID, typeID)) {
					newItem[field] = val;
				} else {
					Zotero.debug("itemToServerJSON: Discarded field "+field+": field not valid for type "+item.itemType, 3);
				}
			} else {
				Zotero.debug("itemToServerJSON: Discarded unknown field "+field, 3);
			}
		}
		
		return newItems;
	},
	
	/**
	 * Converts an item from toArray() format to citeproc-js JSON
	 * @param {Zotero.Item} item
	 * @return {Object} The CSL item
	 */
	"itemToCSLJSON":function(item) {
		if(item instanceof Zotero.Item) {
			item = item.toArray();
		}
		
		var itemType = item.itemType;
		var cslType = CSL_TYPE_MAPPINGS[itemType];
		if(!cslType) cslType = "article";
		
		var cslItem = {
			'id':item.itemID,
			'type':cslType
		};
		
		// Map text fields
		var itemTypeID = Zotero.ItemTypes.getID(itemType);
		for(var variable in CSL_TEXT_MAPPINGS) {
			var fields = CSL_TEXT_MAPPINGS[variable];
			for(var i=0, n=fields.length; i<n; i++) {
				var field = fields[i], value = undefined;
				
				if(field in item) {
					value = item[field];
				} else {
					var fieldID = Zotero.ItemFields.getID(field),
						baseMapping
					if(Zotero.ItemFields.isValidForType(fieldID, itemTypeID)
							&& (baseMapping = Zotero.ItemFields.getBaseIDFromTypeAndField(itemTypeID, fieldID))) {
						value = item[Zotero.ItemTypes.getName(baseMapping)];
					}
				}
				
				if(!value) continue;
				
				var valueLength = value.length;
				if(valueLength) {
					// Strip enclosing quotes
					if(value[0] === '"' && value[valueLength-1] === '"') {
						value = value.substr(1, valueLength-2);
					}
				}
				
				cslItem[variable] = value;
				break;
			}
		}
		
		// separate name variables
		var authorID = Zotero.CreatorTypes.getPrimaryIDForType(item.itemType);
		var creators = item.creators;
		if(creators) {
			for(var i=0, n=creators.length; i<n; i++) {
				var creator = creators[i];
				
				if(creator.creatorTypeID == authorID) {
					var creatorType = "author";
				} else {
					var creatorType = CSL_NAMES_MAPPINGS[creator.creatorType]
				}
				
				if(!creatorType) continue;
				
				if(creator.fieldMode == 1) {
					var nameObj = {'literal':creator.lastName};
				} else {
					var nameObj = {'family':creator.lastName, 'given':creator.firstName};
				}
				
				if(cslItem[creatorType]) {
					cslItem[creatorType].push(nameObj);
				} else {
					cslItem[creatorType] = [nameObj];
				}
			}
		}
		
		// get date variables
		for(var variable in CSL_DATE_MAPPINGS) {
			var date = item[CSL_DATE_MAPPINGS[variable]];
			if(date) {
				var dateObj = Zotero.Date.strToDate(date);
				// otherwise, use date-parts
				var dateParts = [];
				if(dateObj.year) {
					// add year, month, and day, if they exist
					dateParts.push(dateObj.year);
					if(dateObj.month !== undefined) {
						dateParts.push(dateObj.month+1);
						if(dateObj.day) {
							dateParts.push(dateObj.day);
						}
					}
					cslItem[variable] = {"date-parts":[dateParts]};
					
					// if no month, use season as month
					if(dateObj.part && !dateObj.month) {
						cslItem[variable].season = dateObj.part;
					}
				} else {
					// if no year, pass date literally
					cslItem[variable] = {"literal":date};
				}
			}
		}
		
		//this._cache[item.id] = cslItem;
		return cslItem;
	},
	
	/**
	 * Converts an item in CSL JSON format to a Zotero tiem
	 * @param {Zotero.Item} item
	 * @param {Object} cslItem
	 */
	"itemFromCSLJSON":function(item, cslItem) {
		var isZoteroItem = item instanceof Zotero.Item, zoteroType;
		
		for(var type in CSL_TYPE_MAPPINGS) {
			if(CSL_TYPE_MAPPINGS[type] == cslItem.type) {
				zoteroType = type;
				break;
			}
		}
		if(!zoteroType) zoteroType = "document";
		
		var itemTypeID = Zotero.ItemTypes.getID(zoteroType);
		if(isZoteroItem) {
			item.setType(itemTypeID);
		} else {
			item.itemID = cslItem.id;
			item.itemType = zoteroType;
		}
		
		// map text fields
		for(var variable in CSL_TEXT_MAPPINGS) {
			if(variable in cslItem) {
				var textMappings = CSL_TEXT_MAPPINGS[variable];
				for(var i in textMappings) {
					var field = textMappings[i],
						fieldID = Zotero.ItemFields.getID(field);
					if(Zotero.ItemFields.isBaseField(fieldID)) {
						var newFieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(itemTypeID, fieldID);
						if(newFieldID) fieldID = newFieldID;
					}
					
					if(Zotero.ItemFields.isValidForType(fieldID, itemTypeID)) {
						if(isZoteroItem) {
							item.setField(fieldID, cslItem[variable], true);
						} else {
							item[field] = cslItem[variable];
						}
					}
				}
			}
		}
		
		// separate name variables
		for(var field in CSL_NAMES_MAPPINGS) {
			if(CSL_NAMES_MAPPINGS[field] in cslItem) {
				var creatorTypeID = Zotero.CreatorTypes.getID(field);
				if(!Zotero.CreatorTypes.isValidForItemType(creatorTypeID, itemTypeID)) {
					creatorTypeID = Zotero.CreatorTypes.getPrimaryIDForType(itemTypeID);
				}
				
				var nameMappings = cslItem[CSL_NAMES_MAPPINGS[field]];
				for(var i in nameMappings) {
					var cslAuthor = nameMappings[i],
						creator = isZoteroItem ? new Zotero.Creator() : {};
					if(cslAuthor.family || cslAuthor.given) {
						if(cslAuthor.family) creator.lastName = cslAuthor.family;
						if(cslAuthor.given) creator.firstName = cslAuthor.given;
					} else if(cslAuthor.literal) {
						creator.lastName = cslAuthor.literal;
						creator.fieldMode = 1;
					} else {
						continue;
					}
					
					if(isZoteroItem) {
						item.setCreator(item.getCreators().length, creator, creatorTypeID);
					} else {
						creator.creatorType = Zotero.CreatorTypes.getName(creatorTypeID);
						item.creators.push(creator);
					}
				}
			}
		}
		
		// get date variables
		for(var variable in CSL_DATE_MAPPINGS) {
			if(variable in cslItem) {
				var field = CSL_DATE_MAPPINGS[variable],
					fieldID = Zotero.ItemFields.getID(field),
					cslDate = cslItem[variable];
				var fieldID = Zotero.ItemFields.getID(field);
				if(Zotero.ItemFields.isBaseField(fieldID)) {
					var newFieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(itemTypeID, fieldID);
					if(newFieldID) fieldID = newFieldID;
				}
				
				if(Zotero.ItemFields.isValidForType(fieldID, itemTypeID)) {
					var date = "";
					if(cslDate.literal) {
						if(variable === "accessed") {
							date = strToISO(cslDate.literal);
						} else {
							date = cslDate.literal;
						}
					} else {
						var newDate = Zotero.Utilities.deepCopy(cslDate);
						if(cslDate["date-parts"] && typeof cslDate["date-parts"] === "object"
								&& cslDate["date-parts"] !== null
								&& typeof cslDate["date-parts"][0] === "object"
								&& cslDate["date-parts"][0] !== null) {
							if(cslDate["date-parts"][0][0]) newDate.year = cslDate["date-parts"][0][0];
							if(cslDate["date-parts"][0][1]) newDate.month = cslDate["date-parts"][0][1];
							if(cslDate["date-parts"][0][2]) newDate.day = cslDate["date-parts"][0][2];
						}
						
						if(newDate.year) {
							if(variable === "accessed") {
								// Need to convert to SQL
								var date = Zotero.Utilities.lpad(newDate.year, "0", 4);
								if(newDate.month) {
									date += "-"+Zotero.Utilities.lpad(newDate.month, "0", 2);
									if(newDate.day) {
										date += "-"+Zotero.Utilities.lpad(newDate.day, "0", 2);
									}
								}
							} else {
								if(newDate.month) newDate.month--;
								date = Zotero.Date.formatDate(newDate);
								if(newDate.season) {
									date = newDate.season+" "+date;
								}
							}
						}
					}
					
					if(isZoteroItem) {
						item.setField(fieldID, date);
					} else {
						item[field] = date;
					}
				}
			}
		}
	},
	
	/**
	 * Get the real target URL from an intermediate URL
	 */
	"resolveIntermediateURL":function(url) {
		var patterns = [
			// Google search results
			{
				regexp: /^https?:\/\/(www.)?google\.(com|(com?\.)?[a-z]{2})\/url\?/,
				variable: "url"
			}
		];
		
		for (var i=0, len=patterns.length; i<len; i++) {
			if (!url.match(patterns[i].regexp)) {
				continue;
			}
			var matches = url.match(new RegExp("&" + patterns[i].variable + "=(.+?)(&|$)"));
			if (!matches) {
				continue;
			}
			return decodeURIComponent(matches[1]);
		}
		
		return url;
	},
	
	/**
	 * Adds a string to a given array at a given offset, converted to UTF-8
	 * @param {String} string The string to convert to UTF-8
	 * @param {Array|Uint8Array} array The array to which to add the string
	 * @param {Integer} [offset] Offset at which to add the string
	 */
	"stringToUTF8Array":function(string, array, offset) {
		if(!offset) offset = 0;
		var n = string.length;
		for(var i=0; i<n; i++) {
			var val = string.charCodeAt(i);
			if(val >= 128) {
				if(val >= 2048) {
					array[offset] = (val >>> 12) | 224;
					array[offset+1] = ((val >>> 6) & 63) | 128;
					array[offset+2] = (val & 63) | 128;
					offset += 3;
				} else {
					array[offset] = ((val >>> 6) | 192);
					array[offset+1] = (val & 63) | 128;
					offset += 2;
				}
			} else {
				array[offset++] = val;
			}
		}
	},
	
	/**
	 * Gets the byte length of the UTF-8 representation of a given string
	 * @param {String} string
	 * @return {Integer}
	 */
	"getStringByteLength":function(string) {
		var length = 0, n = string.length;
		for(var i=0; i<n; i++) {
			var val = string.charCodeAt(i);
			if(val >= 128) {
				if(val >= 2048) {
					length += 3;
				} else {
					length += 2;
				}
			} else {
				length += 1;
			}
		}
		return length;
	},
	
	/**
	 * Gets the icon for a JSON-style attachment
	 */
	"determineAttachmentIcon":function(attachment) {
		if(attachment.linkMode === "linked_url") {
			return Zotero.ItemTypes.getImageSrc("attachment-web-link");
		}
		return Zotero.ItemTypes.getImageSrc(attachment.mimeType === "application/pdf"
							? "attachment-pdf" : "attachment-snapshot");
	},

	/**
	 * Generates a valid object key for the server API
	 */
	"generateObjectKey":function generateObjectKey() {
		// TODO: add 'L' and 'Y' after 3.0.11 cut-off
		var baseString = "23456789ABCDEFGHIJKMNPQRSTUVWXZ";
		return Zotero.Utilities.randomString(8, baseString);
	},

	/**
	 * Provides unicode support and other additional features for regular expressions
	 * See https://github.com/slevithan/xregexp for usage
	 */
	 "XRegExp": XRegExp
}
