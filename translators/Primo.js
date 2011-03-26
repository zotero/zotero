{
	"translatorID":"1300cd65-d23a-4bbf-93e5-a3c9e00d1066",
	"translatorType":4,
	"label":"Primo",
	"creator":"Matt Burton, Avram Lyon, Etienne Cavalié",
	"target":"/primo_library/",
	"minVersion":"2.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2010-06-08 07:15:00"
}

/*
Supports Primo 2:
Université de Nice, France (http://catalogue.unice.fr/)
Supports Primo 3
Boston College (http://www.bc.edu/supersleuth),
Oxford Libraries (http://solo.ouls.ox.ac.uk/)
*/

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		
		if (doc.evaluate('//span[@class="results_corner EXLResultsTitleCorner"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ) { 
			 return 'multiple';
		}
		else if (doc.evaluate('//div[@class="EXLContent EXLBriefDisplay"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ) { 
			 return 'multiple';
		}
		else if (doc.evaluate('//div[@class="results2 EXLFullResultsHeader"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ) { 
			return 'book';
		}
		else if (doc.evaluate('//div[@class="EXLContent EXLFullDisplay"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ) { 
			return 'book';
		}
}

// There is code for handling RIS, but let's stick with PNX for now.

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
	var links = new Array();
	
	if (detectWeb(doc,url) == 'multiple') {
			var items = new Object();
			
			var linkIterator = "";
			var titleIterator = "";
			if (doc.evaluate('//h2[contains(@class, "EXLResultTitle")]/a/@href', doc, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength == 0)
			{
				// Primo v2
				linkIterator = doc.evaluate('//div[contains(@class, "title")]/a/@href', doc, nsResolver, XPathResult.ANY_TYPE, null);
				titleIterator = doc.evaluate('//div[contains(@class, "title")]/a/span', doc, nsResolver, XPathResult.ANY_TYPE, null);
			}
			else
			{
				// Primo v3
				linkIterator = doc.evaluate('//h2[contains(@class, "EXLResultTitle")]/a/@href', doc, nsResolver, XPathResult.ANY_TYPE, null);
				titleIterator = doc.evaluate('//h2[contains(@class, "EXLResultTitle")]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
			}

			
			// try/catch for the case when there are no search results, let doc.evealuate fail quietly
			try {
				while (link = linkIterator.iterateNext(), title = titleIterator.iterateNext()) {
					
					// create an array containing the links and add '&showPnx=true' to the end
					var xmlLink = Zotero.Utilities.trimInternal(link.textContent)+'&showPnx=true';
					Zotero.debug(xmlLink);
					var title = Zotero.Utilities.trimInternal(title.textContent);
					items[xmlLink] = title;
				}
				items = Zotero.selectItems(items);
				for(var link in items) {
					links.push(link);
				}
			} catch(e) {
				Zotero.debug("Search results contained zero items. "+e);
				return;
			}

	} else {
		links.push(url+'&showPnx=true');
	}
	
	Zotero.Utilities.HTTP.doGet(links, function(text) {
	
		text = text.replace(/^<\?xml\s+version\s*=\s*(["'])[^\1]+\1[^?]*\?>/, ""); //because E4X is full of FAIL
		var xmldoc = new XML(text);
		
		if (xmldoc.display.type.toString() == 'book') {
			var item = new Zotero.Item("book");
		} else if (xmldoc.display.type.toString() == 'audio') {
			var item = new Zotero.Item("audioRecording");
		} else if (xmldoc.display.type.toString() == 'video') {
			var item = new Zotero.Item("videoRecording");
		} else {
			var item = new Zotero.Item("document");
		}
		item.title = xmldoc.display.title.toString();
		
		var creators = xmldoc.display.creator.toString().replace(/\d{4}-(\d{4})?/, '').split("; ");
		var contributors = xmldoc.display.contributor.toString().replace(/\d{4}-(\d{4})?/, '').split("; ");
		
		if (!creators[0]) { // <contributor> not available using <contributor> as author instead
			creators = contributors;
			contributors = null;
		}
		for (creator in creators) {
			if (creators[creator]) {
				item.creators.push(Zotero.Utilities.cleanAuthor(creators[creator], "author"));
			}
		}
		
		for (contributor in contributors) {
			if (contributors[contributor]) {
				item.creators.push(Zotero.Utilities.cleanAuthor(contributors[contributor], "contributor"));
			}
		}
		
		var pubplace = xmldoc.display.publisher.toString().split(" : ");
		if (pubplace) {
			item.place = pubplace[0];
			item.publisher = pubplace[1];
		}
		
		var date = xmldoc.display.creationdate.toString();
		if (date) item.date = date.match(/\d+/)[0];
		
		var language = xmldoc.display.language.toString();
		// We really hope that Primo always uses ISO 639-2
		// This looks odd, but it just means that we're using the verbatim
		// content if it isn't in our ISO 639-2 hash.
		if (language)
			if(!(item.language = iso6392(language)))
				item.language = language;

		
		var pages = xmldoc.display.format.toString().match(/(\d+)\sp\./);
		if (pages) item.pages = pages[1];
	
		// The identifier field is supposed to have standardized format, but
		// the super-tolerant idCheck should be better than a regex.
		// (although note that it will reject invalid ISBNs)	
		var locators = idCheck(xmldoc.display.identifier.toString());
		if (locators.isbn10) item.ISBN = locators.isbn10;
		if (locators.isbn13) item.ISBN = locators.isbn13;
		if (locators.issn) item.ISSN = locators.issn;
		
		var edition = xmldoc.display.edition.toString();
		if (edition) item.edition = edition;
		
		for each (subject in xmldoc.search.subject) {
			item.tags.push(subject.toString());
		}
		// does callNumber get stored anywhere else in the xml?
		item.callNumber = xmldoc.enrichment.classificationlcc[0];
		
		item.complete();
		
	}, function() {Zotero.done();});
	Zotero.wait();

}

/* The next two functions are logic that could be bundled away into the translator toolkit. */

// Implementation of ISBN and ISSN check-digit verification
// Based on ISBN Users' Manual (http://www.isbn.org/standards/home/isbn/international/html/usm4.htm)
// and the Wikipedia treatment of ISBN (http://en.wikipedia.org/wiki/International_Standard_Book_Number)
// and the Wikipedia treatment of ISSN (http://en.wikipedia.org/wiki/International_Standard_Serial_Number)

// This will also check ISMN validity, although it does not distinguish from their
// neighbors in namespace, ISBN-13. It does not handle pre-2008 M-prefixed ISMNs; see
// http://en.wikipedia.org/wiki/International_Standard_Music_Number

// This does not validate multiple identifiers in one field,
// but it will gracefully ignore all non-number detritus,
// such as extraneous hyphens, spaces, and comments.

// It currently maintains hyphens in non-initial and non-final position,
// discarding consecutive ones beyond the first as well.

// It also adds the customary hyphen to valid ISSNs.

// Takes the first 8 valid digits and tries to read an ISSN,
// takes the first 10 valid digits and tries to read an ISBN 10,
// and takes the first 13 valid digits to try to read an ISBN 13
// Returns an object with three attributes:
// 	"issn" 
// 	"isbn10"
// 	"isbn13"
// Each will be set to a valid identifier if found, and otherwise be a
// boolean false.

// There could conceivably be a valid ISBN-13 with an ISBN-10
// substring; this should probably be interpreted as the latter, but it is a
// client UI issue.
idCheck = function(isbn) {
	// For ISBN 10, multiple by these coefficients, take the sum mod 11
	// and subtract from 11
	var isbn10 = [10, 9, 8, 7, 6, 5, 4, 3, 2];

	// For ISBN 13, multiple by these coefficients, take the sum mod 10
	// and subtract from 10
	var isbn13 = [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3];

	// For ISSN, multiply by these coefficients, take the sum mod 11
	// and subtract from 11
	var issn = [8, 7, 6, 5, 4, 3, 2];

	// We make a single pass through the provided string, interpreting the
	// first 10 valid characters as an ISBN-10, and the first 13 as an
	// ISBN-13. We then return an array of booleans and valid detected
	// ISBNs.

	var j = 0;
	var sum8 = 0;
	var num8 = "";
	var sum10 = 0;
	var num10 = "";
	var sum13 = 0;
	var num13 = "";
	var chars = [];

	for (var i=0; i < isbn.length; i++) {
		if (isbn.charAt(i) == " ") {
			// Since the space character evaluates as a number,
			// it is a special case.
		} else if (j > 0 && isbn.charAt(i) == "-" && isbn.charAt(i-1) != "-") {
			// Preserve hyphens, except in initial and final position
			// Also discard consecutive hyphens
			if(j < 7) num8 += "-";
			if(j < 10) num10 += "-";
			if(j < 13) num13 += "-";
		} else if (j < 7 && ((isbn.charAt(i) - 0) == isbn.charAt(i))) {
			sum8 += isbn.charAt(i) * issn[j];
			sum10 += isbn.charAt(i) * isbn10[j];
			sum13 += isbn.charAt(i) * isbn13[j];
			num8 += isbn.charAt(i);
			num10 += isbn.charAt(i);
			num13 += isbn.charAt(i);
			j++;
		} else if (j == 7 &&
			(isbn.charAt(i) == "X" || isbn.charAt(i) == "x" ||
				((isbn.charAt(i) - 0) == isbn.charAt(i)))) {
			// In ISSN, an X represents the check digit "10".
			if(isbn.charAt(i) == "X" || isbn.charAt(i) == "x") {
				var check8 = 10;
				num8 += "X";
			} else {
				var check8 = isbn.charAt(i);
				sum10 += isbn.charAt(i) * isbn10[j];
				sum13 += isbn.charAt(i) * isbn13[j];
				num8 += isbn.charAt(i);
				num10 += isbn.charAt(i);
				num13 += isbn.charAt(i);
				j++;
			}
		} else if (j < 9 && ((isbn.charAt(i) - 0) == isbn.charAt(i))) {
			sum10 += isbn.charAt(i) * isbn10[j];
			sum13 += isbn.charAt(i) * isbn13[j];
			num10 += isbn.charAt(i);
			num13 += isbn.charAt(i);
			j++;
		} else if (j == 9 &&
			(isbn.charAt(i) == "X" || isbn.charAt(i) == "x" ||
				((isbn.charAt(i) - 0) == isbn.charAt(i)))) {
			// In ISBN-10, an X represents the check digit "10".
			if(isbn.charAt(i) == "X" || isbn.charAt(i) == "x") {
				var check10 = 10;
				num10 += "X";
			} else {
				var check10 = isbn.charAt(i);
				sum13 += isbn.charAt(i) * isbn13[j];
				num10 += isbn.charAt(i);
				num13 += isbn.charAt(i);
				j++;
			}
		} else if(j < 12 && ((isbn.charAt(i) - 0) == isbn.charAt(i))) {
			sum13 += isbn.charAt(i) * isbn13[j];
			num13 += isbn.charAt(i);
			j++;
		} else if (j == 12 && ((isbn.charAt(i) - 0) == isbn.charAt(i))) {
			var check13 = isbn.charAt(i);
			num13 += isbn.charAt(i);
		}
	}
	var valid8  = ((11 - sum8 % 11) % 11) == check8;
	var valid10 = ((11 - sum10 % 11) % 11) == check10;
	var valid13 = (10 - sum13 % 10 == check13);
	var matches = false;
	
	// Since ISSNs have a standard hyphen placement, we can add a hyphen
	if (valid8 && (matches = num8.match(/([0-9]{4})([0-9]{3}[0-9Xx])/))) {
		num8 = matches[1] + '-' + matches[2];
	} 

	if(!valid8) {num8 = false};
	if(!valid10) {num10 = false};
	if(!valid13) {num13 = false};
	return {"isbn10" : num10, "isbn13" : num13, "issn" : num8};
}

// This function should be replaced by a lookup from the multilingual machinery in multilingual builds of Zotero
// Gives name for three-letter code
function iso6392(code) {
MAP_ISO6391_ISO6392 = {'aar' : 'Afar',
'abk' : 'Abkhazian',
'ace' : 'Achinese',
'ach' : 'Acoli',
'ada' : 'Adangme',
'ady' : 'Adyghe; Adygei',
'afa' : 'Afro-Asiatic languages',
'afh' : 'Afrihili',
'afr' : 'Afrikaans',
'ain' : 'Ainu',
'aka' : 'Akan',
'akk' : 'Akkadian',
'alb' : 'Albanian',
'ale' : 'Aleut',
'alg' : 'Algonquian languages',
'alt' : 'Southern Altai',
'amh' : 'Amharic',
'ang' : 'English, Old (ca.450-1100)',
'anp' : 'Angika',
'apa' : 'Apache languages',
'ara' : 'Arabic',
'arc' : 'Official Aramaic (700-300 BCE); Imperial Aramaic (700-300 BCE)',
'arg' : 'Aragonese',
'arm' : 'Armenian',
'arn' : 'Mapudungun; Mapuche',
'arp' : 'Arapaho',
'art' : 'Artificial languages',
'arw' : 'Arawak',
'asm' : 'Assamese',
'ast' : 'Asturian; Bable; Leonese; Asturleonese',
'ath' : 'Athapascan languages',
'aus' : 'Australian languages',
'ava' : 'Avaric',
'ave' : 'Avestan',
'awa' : 'Awadhi',
'aym' : 'Aymara',
'aze' : 'Azerbaijani',
'bad' : 'Banda languages',
'bai' : 'Bamileke languages',
'bak' : 'Bashkir',
'bal' : 'Baluchi',
'bam' : 'Bambara',
'ban' : 'Balinese',
'baq' : 'Basque',
'bas' : 'Basa',
'bat' : 'Baltic languages',
'bej' : 'Beja; Bedawiyet',
'bel' : 'Belarusian',
'bem' : 'Bemba',
'ben' : 'Bengali',
'ber' : 'Berber languages',
'bho' : 'Bhojpuri',
'bih' : 'Bihari languages',
'bik' : 'Bikol',
'bin' : 'Bini; Edo',
'bis' : 'Bislama',
'bla' : 'Siksika',
'bnt' : 'Bantu languages',
'tib' : 'Tibetan',
'bos' : 'Bosnian',
'bra' : 'Braj',
'bre' : 'Breton',
'btk' : 'Batak languages',
'bua' : 'Buriat',
'bug' : 'Buginese',
'bul' : 'Bulgarian',
'bur' : 'Burmese',
'byn' : 'Blin; Bilin',
'cad' : 'Caddo',
'cai' : 'Central American Indian languages',
'car' : 'Galibi Carib',
'cat' : 'Catalan; Valencian',
'cau' : 'Caucasian languages',
'ceb' : 'Cebuano',
'cel' : 'Celtic languages',
'cze' : 'Czech',
'cha' : 'Chamorro',
'chb' : 'Chibcha',
'che' : 'Chechen',
'chg' : 'Chagatai',
'chi' : 'Chinese',
'chk' : 'Chuukese',
'chm' : 'Mari',
'chn' : 'Chinook jargon',
'cho' : 'Choctaw',
'chp' : 'Chipewyan; Dene Suline',
'chr' : 'Cherokee',
'chu' : 'Church Slavic; Old Slavonic; Church Slavonic; Old Bulgarian; Old Church Slavonic',
'chv' : 'Chuvash',
'chy' : 'Cheyenne',
'cmc' : 'Chamic languages',
'cop' : 'Coptic',
'cor' : 'Cornish',
'cos' : 'Corsican',
'cpe' : 'Creoles and pidgins, English based',
'cpf' : 'Creoles and pidgins, French-based',
'cpp' : 'Creoles and pidgins, Portuguese-based',
'cre' : 'Cree',
'crh' : 'Crimean Tatar; Crimean Turkish',
'crp' : 'Creoles and pidgins',
'csb' : 'Kashubian',
'cus' : 'Cushitic languages',
'wel' : 'Welsh',
'cze' : 'Czech',
'dak' : 'Dakota',
'dan' : 'Danish',
'dar' : 'Dargwa',
'day' : 'Land Dayak languages',
'del' : 'Delaware',
'den' : 'Slave (Athapascan)',
'ger' : 'German',
'dgr' : 'Dogrib',
'din' : 'Dinka',
'div' : 'Divehi; Dhivehi; Maldivian',
'doi' : 'Dogri',
'dra' : 'Dravidian languages',
'dsb' : 'Lower Sorbian',
'dua' : 'Duala',
'dum' : 'Dutch, Middle (ca.1050-1350)',
'dut' : 'Dutch; Flemish',
'dyu' : 'Dyula',
'dzo' : 'Dzongkha',
'efi' : 'Efik',
'egy' : 'Egyptian (Ancient)',
'eka' : 'Ekajuk',
'gre' : 'Greek, Modern (1453-)',
'elx' : 'Elamite',
'eng' : 'English',
'enm' : 'English, Middle (1100-1500)',
'epo' : 'Esperanto',
'est' : 'Estonian',
'baq' : 'Basque',
'ewe' : 'Ewe',
'ewo' : 'Ewondo',
'fan' : 'Fang',
'fao' : 'Faroese',
'per' : 'Persian',
'fat' : 'Fanti',
'fij' : 'Fijian',
'fil' : 'Filipino; Pilipino',
'fin' : 'Finnish',
'fiu' : 'Finno-Ugrian languages',
'fon' : 'Fon',
'fre' : 'French',
'fre' : 'French',
'frm' : 'French, Middle (ca.1400-1600)',
'fro' : 'French, Old (842-ca.1400)',
'frr' : 'Northern Frisian',
'frs' : 'Eastern Frisian',
'fry' : 'Western Frisian',
'ful' : 'Fulah',
'fur' : 'Friulian',
'gaa' : 'Ga',
'gay' : 'Gayo',
'gba' : 'Gbaya',
'gem' : 'Germanic languages',
'geo' : 'Georgian',
'ger' : 'German',
'gez' : 'Geez',
'gil' : 'Gilbertese',
'gla' : 'Gaelic; Scottish Gaelic',
'gle' : 'Irish',
'glg' : 'Galician',
'glv' : 'Manx',
'gmh' : 'German, Middle High (ca.1050-1500)',
'goh' : 'German, Old High (ca.750-1050)',
'gon' : 'Gondi',
'gor' : 'Gorontalo',
'got' : 'Gothic',
'grb' : 'Grebo',
'grc' : 'Greek, Ancient (to 1453)',
'gre' : 'Greek, Modern (1453-)',
'grn' : 'Guarani',
'gsw' : 'Swiss German; Alemannic; Alsatian',
'guj' : 'Gujarati',
'gwi' : 'Gwich\'in',
'hai' : 'Haida',
'hat' : 'Haitian; Haitian Creole',
'hau' : 'Hausa',
'haw' : 'Hawaiian',
'heb' : 'Hebrew',
'her' : 'Herero',
'hil' : 'Hiligaynon',
'him' : 'Himachali languages; Western Pahari languages',
'hin' : 'Hindi',
'hit' : 'Hittite',
'hmn' : 'Hmong',
'hmo' : 'Hiri Motu',
'hrv' : 'Croatian',
'hsb' : 'Upper Sorbian',
'hun' : 'Hungarian',
'hup' : 'Hupa',
'arm' : 'Armenian',
'iba' : 'Iban',
'ibo' : 'Igbo',
'ice' : 'Icelandic',
'ido' : 'Ido',
'iii' : 'Sichuan Yi; Nuosu',
'ijo' : 'Ijo languages',
'iku' : 'Inuktitut',
'ile' : 'Interlingue; Occidental',
'ilo' : 'Iloko',
'ina' : 'Interlingua (International Auxiliary Language Association)',
'inc' : 'Indic languages',
'ind' : 'Indonesian',
'ine' : 'Indo-European languages',
'inh' : 'Ingush',
'ipk' : 'Inupiaq',
'ira' : 'Iranian languages',
'iro' : 'Iroquoian languages',
'ice' : 'Icelandic',
'ita' : 'Italian',
'jav' : 'Javanese',
'jbo' : 'Lojban',
'jpn' : 'Japanese',
'jpr' : 'Judeo-Persian',
'jrb' : 'Judeo-Arabic',
'kaa' : 'Kara-Kalpak',
'kab' : 'Kabyle',
'kac' : 'Kachin; Jingpho',
'kal' : 'Kalaallisut; Greenlandic',
'kam' : 'Kamba',
'kan' : 'Kannada',
'kar' : 'Karen languages',
'kas' : 'Kashmiri',
'geo' : 'Georgian',
'kau' : 'Kanuri',
'kaw' : 'Kawi',
'kaz' : 'Kazakh',
'kbd' : 'Kabardian',
'kha' : 'Khasi',
'khi' : 'Khoisan languages',
'khm' : 'Central Khmer',
'kho' : 'Khotanese; Sakan',
'kik' : 'Kikuyu; Gikuyu',
'kin' : 'Kinyarwanda',
'kir' : 'Kirghiz; Kyrgyz',
'kmb' : 'Kimbundu',
'kok' : 'Konkani',
'kom' : 'Komi',
'kon' : 'Kongo',
'kor' : 'Korean',
'kos' : 'Kosraean',
'kpe' : 'Kpelle',
'krc' : 'Karachay-Balkar',
'krl' : 'Karelian',
'kro' : 'Kru languages',
'kru' : 'Kurukh',
'kua' : 'Kuanyama; Kwanyama',
'kum' : 'Kumyk',
'kur' : 'Kurdish',
'kut' : 'Kutenai',
'lad' : 'Ladino',
'lah' : 'Lahnda',
'lam' : 'Lamba',
'lao' : 'Lao',
'lat' : 'Latin',
'lav' : 'Latvian',
'lez' : 'Lezghian',
'lim' : 'Limburgan; Limburger; Limburgish',
'lin' : 'Lingala',
'lit' : 'Lithuanian',
'lol' : 'Mongo',
'loz' : 'Lozi',
'ltz' : 'Luxembourgish; Letzeburgesch',
'lua' : 'Luba-Lulua',
'lub' : 'Luba-Katanga',
'lug' : 'Ganda',
'lui' : 'Luiseno',
'lun' : 'Lunda',
'luo' : 'Luo (Kenya and Tanzania)',
'lus' : 'Lushai',
'mac' : 'Macedonian',
'mad' : 'Madurese',
'mag' : 'Magahi',
'mah' : 'Marshallese',
'mai' : 'Maithili',
'mak' : 'Makasar',
'mal' : 'Malayalam',
'man' : 'Mandingo',
'mao' : 'Maori',
'map' : 'Austronesian languages',
'mar' : 'Marathi',
'mas' : 'Masai',
'may' : 'Malay',
'mdf' : 'Moksha',
'mdr' : 'Mandar',
'men' : 'Mende',
'mga' : 'Irish, Middle (900-1200)',
'mic' : 'Mi\'kmaq; Micmac',
'min' : 'Minangkabau',
'mis' : 'Uncoded languages',
'mac' : 'Macedonian',
'mkh' : 'Mon-Khmer languages',
'mlg' : 'Malagasy',
'mlt' : 'Maltese',
'mnc' : 'Manchu',
'mni' : 'Manipuri',
'mno' : 'Manobo languages',
'moh' : 'Mohawk',
'mon' : 'Mongolian',
'mos' : 'Mossi',
'mao' : 'Maori',
'may' : 'Malay',
'mul' : 'Multiple languages',
'mun' : 'Munda languages',
'mus' : 'Creek',
'mwl' : 'Mirandese',
'mwr' : 'Marwari',
'bur' : 'Burmese',
'myn' : 'Mayan languages',
'myv' : 'Erzya',
'nah' : 'Nahuatl languages',
'nai' : 'North American Indian languages',
'nap' : 'Neapolitan',
'nau' : 'Nauru',
'nav' : 'Navajo; Navaho',
'nbl' : 'Ndebele, South; South Ndebele',
'nde' : 'Ndebele, North; North Ndebele',
'ndo' : 'Ndonga',
'nds' : 'Low German; Low Saxon; German, Low; Saxon, Low',
'nep' : 'Nepali',
'new' : 'Nepal Bhasa; Newari',
'nia' : 'Nias',
'nic' : 'Niger-Kordofanian languages',
'niu' : 'Niuean',
'dut' : 'Dutch; Flemish',
'nno' : 'Norwegian Nynorsk; Nynorsk, Norwegian',
'nob' : 'Bokmål, Norwegian; Norwegian Bokmål',
'nog' : 'Nogai',
'non' : 'Norse, Old',
'nor' : 'Norwegian',
'nqo' : 'N\'Ko',
'nso' : 'Pedi; Sepedi; Northern Sotho',
'nub' : 'Nubian languages',
'nwc' : 'Classical Newari; Old Newari; Classical Nepal Bhasa',
'nya' : 'Chichewa; Chewa; Nyanja',
'nym' : 'Nyamwezi',
'nyn' : 'Nyankole',
'nyo' : 'Nyoro',
'nzi' : 'Nzima',
'oci' : 'Occitan (post 1500)',
'oji' : 'Ojibwa',
'ori' : 'Oriya',
'orm' : 'Oromo',
'osa' : 'Osage',
'oss' : 'Ossetian; Ossetic',
'ota' : 'Turkish, Ottoman (1500-1928)',
'oto' : 'Otomian languages',
'paa' : 'Papuan languages',
'pag' : 'Pangasinan',
'pal' : 'Pahlavi',
'pam' : 'Pampanga; Kapampangan',
'pan' : 'Panjabi; Punjabi',
'pap' : 'Papiamento',
'pau' : 'Palauan',
'peo' : 'Persian, Old (ca.600-400 B.C.)',
'per' : 'Persian',
'phi' : 'Philippine languages',
'phn' : 'Phoenician',
'pli' : 'Pali',
'pol' : 'Polish',
'pon' : 'Pohnpeian',
'por' : 'Portuguese',
'pra' : 'Prakrit languages',
'pro' : 'Provençal, Old (to 1500);Occitan, Old (to 1500)',
'pus' : 'Pushto; Pashto',
'qaa' : 'Reserved for local use',
'que' : 'Quechua',
'raj' : 'Rajasthani',
'rap' : 'Rapanui',
'rar' : 'Rarotongan; Cook Islands Maori',
'roa' : 'Romance languages',
'roh' : 'Romansh',
'rom' : 'Romany',
'rum' : 'Romanian; Moldavian; Moldovan',
'rum' : 'Romanian; Moldavian; Moldovan',
'run' : 'Rundi',
'rup' : 'Aromanian; Arumanian; Macedo-Romanian',
'rus' : 'Russian',
'sad' : 'Sandawe',
'sag' : 'Sango',
'sah' : 'Yakut',
'sai' : 'South American Indian languages',
'sal' : 'Salishan languages',
'sam' : 'Samaritan Aramaic',
'san' : 'Sanskrit',
'sas' : 'Sasak',
'sat' : 'Santali',
'scn' : 'Sicilian',
'sco' : 'Scots',
'sel' : 'Selkup',
'sem' : 'Semitic languages',
'sga' : 'Irish, Old (to 900)',
'sgn' : 'Sign Languages',
'shn' : 'Shan',
'sid' : 'Sidamo',
'sin' : 'Sinhala; Sinhalese',
'sio' : 'Siouan languages',
'sit' : 'Sino-Tibetan languages',
'sla' : 'Slavic languages',
'slo' : 'Slovak',
'slo' : 'Slovak',
'slv' : 'Slovenian',
'sma' : 'Southern Sami',
'sme' : 'Northern Sami',
'smi' : 'Sami languages',
'smj' : 'Lule Sami',
'smn' : 'Inari Sami',
'smo' : 'Samoan',
'sms' : 'Skolt Sami',
'sna' : 'Shona',
'snd' : 'Sindhi',
'snk' : 'Soninke',
'sog' : 'Sogdian',
'som' : 'Somali',
'son' : 'Songhai languages',
'sot' : 'Sotho, Southern',
'spa' : 'Spanish; Castilian',
'alb' : 'Albanian',
'srd' : 'Sardinian',
'srn' : 'Sranan Tongo',
'srp' : 'Serbian',
'srr' : 'Serer',
'ssa' : 'Nilo-Saharan languages',
'ssw' : 'Swati',
'suk' : 'Sukuma',
'sun' : 'Sundanese',
'sus' : 'Susu',
'sux' : 'Sumerian',
'swa' : 'Swahili',
'swe' : 'Swedish',
'syc' : 'Classical Syriac',
'syr' : 'Syriac',
'tah' : 'Tahitian',
'tai' : 'Tai languages',
'tam' : 'Tamil',
'tat' : 'Tatar',
'tel' : 'Telugu',
'tem' : 'Timne',
'ter' : 'Tereno',
'tet' : 'Tetum',
'tgk' : 'Tajik',
'tgl' : 'Tagalog',
'tha' : 'Thai',
'tib' : 'Tibetan',
'tig' : 'Tigre',
'tir' : 'Tigrinya',
'tiv' : 'Tiv',
'tkl' : 'Tokelau',
'tlh' : 'Klingon; tlhIngan-Hol',
'tli' : 'Tlingit',
'tmh' : 'Tamashek',
'tog' : 'Tonga (Nyasa)',
'ton' : 'Tonga (Tonga Islands)',
'tpi' : 'Tok Pisin',
'tsi' : 'Tsimshian',
'tsn' : 'Tswana',
'tso' : 'Tsonga',
'tuk' : 'Turkmen',
'tum' : 'Tumbuka',
'tup' : 'Tupi languages',
'tur' : 'Turkish',
'tut' : 'Altaic languages',
'tvl' : 'Tuvalu',
'twi' : 'Twi',
'tyv' : 'Tuvinian',
'udm' : 'Udmurt',
'uga' : 'Ugaritic',
'uig' : 'Uighur; Uyghur',
'ukr' : 'Ukrainian',
'umb' : 'Umbundu',
'und' : 'Undetermined',
'urd' : 'Urdu',
'uzb' : 'Uzbek',
'vai' : 'Vai',
'ven' : 'Venda',
'vie' : 'Vietnamese',
'vol' : 'Volapük',
'vot' : 'Votic',
'wak' : 'Wakashan languages',
'wal' : 'Wolaitta; Wolaytta',
'war' : 'Waray',
'was' : 'Washo',
'wel' : 'Welsh',
'wen' : 'Sorbian languages',
'wln' : 'Walloon',
'wol' : 'Wolof',
'xal' : 'Kalmyk; Oirat',
'xho' : 'Xhosa',
'yao' : 'Yao',
'yap' : 'Yapese',
'yid' : 'Yiddish',
'yor' : 'Yoruba',
'ypk' : 'Yupik languages',
'zap' : 'Zapotec',
'zbl' : 'Blissymbols; Blissymbolics; Bliss',
'zen' : 'Zenaga',
'zha' : 'Zhuang; Chuang',
'chi' : 'Chinese',
'znd' : 'Zande languages',
'zul' : 'Zulu',
'zun' : 'Zuni',
'zxx' : 'No linguistic content; Not applicable',
'zza' : 'Zaza; Dimili; Dimli; Kirdki; Kirmanjki; Zazaki'};
	var lang;
	return ((lang = MAP_ISO6391_ISO6392[code]) !== null) ? lang : false;
}
