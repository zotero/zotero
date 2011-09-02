{
	"translatorID": "a6ee60df-1ddc-4aae-bb25-45e0537be973",
	"label": "MARC",
	"creator": "Simon Kornblith, Sylvain Machefert",
	"target": "marc",
	"minVersion": "2.1.9",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 1,
	"browserSupport": "gcsn",
	"lastUpdated": "2011-08-22 23:29:49"
}

function detectImport() {
	var marcRecordRegexp = /^[0-9]{5}[a-z ]{3}$/
	var read = Zotero.read(8);
	if(marcRecordRegexp.test(read)) {
		return true;
	}
}
//test
var fieldTerminator = "\x1E";
var recordTerminator = "\x1D";
var subfieldDelimiter = "\x1F";

/*
 * CLEANING FUNCTIONS
 */
 

 

// general purpose cleaning
function clean(value) {
	value = value.replace(/^[\s\.\,\/\:;]+/, '');
	value = value.replace(/[\s\.\,\/\:;]+$/, '');
	value = value.replace(/ +/g, ' ');
	
	var char1 = value[0];
	var char2 = value[value.length-1];
	if((char1 == "[" && char2 == "]") || (char1 == "(" && char2 == ")")) {
		// chop of extraneous characters
		return value.substr(1, value.length-2);
	}
	
	return value;
}

// number extraction
function pullNumber(text) {
	var pullRe = /[0-9]+/;
	var m = pullRe.exec(text);
	if(m) {
		return m[0];
	}
}

// ISBN extraction
function pullISBN(text) {
	var pullRe = /[0-9X\-]+/;
	var m = pullRe.exec(text);
	if(m) {
		return m[0];
	}
}

// corporate author extraction
function corpAuthor(author) {
	return {lastName:author, fieldMode:true};
}

// regular author extraction
function author(author, type, useComma) {
	return Zotero.Utilities.cleanAuthor(author, type, useComma);
}

/*
 * END CLEANING FUNCTIONS
 */

var record = function() {
	this.directory = new Object();
	this.leader = "";
	this.content = "";
	
	// defaults
	this.indicatorLength = 2;
	this.subfieldCodeLength = 2;
}

// import a binary MARC record into this record
record.prototype.importBinary = function(record) {
	// get directory and leader
	var directory = record.substr(0, record.indexOf(fieldTerminator));
	this.leader = directory.substr(0, 24);
	var directory = directory.substr(24);
	
	// get various data
	this.indicatorLength = parseInt(this.leader[10], 10);
	this.subfieldCodeLength = parseInt(this.leader[11], 10);
	var baseAddress = parseInt(this.leader.substr(12, 5), 10);
	
	// get record data
	var contentTmp = record.substr(baseAddress);
	
	// MARC wants one-byte characters, so when we have multi-byte UTF-8
	// sequences, add null characters so that the directory shows up right. we
	// can strip the nulls later.
	this.content = "";
	for(i=0; i<contentTmp.length; i++) {
		this.content += contentTmp[i];
		if(contentTmp.charCodeAt(i) > 0x00FFFF) {
			this.content += "\x00\x00\x00";
		} else if(contentTmp.charCodeAt(i) > 0x0007FF) {
			this.content += "\x00\x00";
		} else if(contentTmp.charCodeAt(i) > 0x00007F) {
			this.content += "\x00";
		}
	}
	
	// read directory
	for(var i=0; i<directory.length; i+=12) {
		var tag = parseInt(directory.substr(i, 3), 10);
		var fieldLength = parseInt(directory.substr(i+3, 4), 10);
		var fieldPosition = parseInt(directory.substr(i+7, 5), 10);
		
		if(!this.directory[tag]) {
			this.directory[tag] = new Array();
		}
		this.directory[tag].push([fieldPosition, fieldLength]);
	}
}

// add a field to this record
record.prototype.addField = function(field, indicator, value) {
	field = parseInt(field, 10);
	// make sure indicator is the right length
	if(indicator.length > this.indicatorLength) {
		indicator = indicator.substr(0, this.indicatorLength);
	} else if(indicator.length != this.indicatorLength) {
		indicator = Zotero.Utilities.lpad(indicator, " ", this.indicatorLength);
	}
	
	// add terminator
	value = indicator+value+fieldTerminator;
	
	// add field to directory
	if(!this.directory[field]) {
		this.directory[field] = new Array();
	}
	this.directory[field].push([this.content.length, value.length]);
	
	// add field to record
	this.content += value;
}

// get all fields with a certain field number
record.prototype.getField = function(field) {
	field = parseInt(field, 10);
	var fields = new Array();
	
	// make sure fields exist
	if(!this.directory[field]) {
		return fields;
	}
	
	// get fields
	for(var i in this.directory[field]) {
		var location = this.directory[field][i];
		
		// add to array, replacing null characters
		fields.push([this.content.substr(location[0], this.indicatorLength),
			this.content.substr(location[0]+this.indicatorLength,
			location[1]-this.indicatorLength-1).replace(/\x00/g, "")]);
	}
	
	return fields;
}

// get subfields from a field
record.prototype.getFieldSubfields = function(tag) { // returns a two-dimensional array of values
	var fields = this.getField(tag);
	var returnFields = new Array();
	
	for(var i in fields) {
		returnFields[i] = new Object();
		
		var subfields = fields[i][1].split(subfieldDelimiter);
		if (subfields.length == 1) {
			returnFields[i]["?"] = fields[i][1];
		} else {
			for(var j in subfields) {
				if(subfields[j]) {
					var subfieldIndex = subfields[j].substr(0, this.subfieldCodeLength-1);
					if(!returnFields[i][subfieldIndex]) {
						returnFields[i][subfieldIndex] = subfields[j].substr(this.subfieldCodeLength-1);
					} else {
						// Duplicate subfield
						Zotero.debug("Duplicate subfield '"+tag+" "+subfieldIndex+"="+subfields[j]);
						returnFields[i][subfieldIndex] = returnFields[i][subfieldIndex] + " " + subfields[j].substr(this.subfieldCodeLength-1);
					}
				}
			}
		}
	}
	
	return returnFields;
}

// add field to DB
record.prototype._associateDBField = function(item, fieldNo, part, fieldName, execMe, arg1, arg2) {
	var field = this.getFieldSubfields(fieldNo);
	
	Zotero.debug('MARC: found '+field.length+' matches for '+fieldNo+part);
	if(field) {
		for(var i in field) {
			var value = false;
			for(var j=0; j<part.length; j++) {
				var myPart = part[j];
				if(field[i][myPart]) {
					if(value) {
						value += " "+field[i][myPart];
					} else {
						value = field[i][myPart];
					}
				}
			}
			if(value) {
				value = clean(value);
				
				if(execMe) {
					value = execMe(value, arg1, arg2);
				}
				
				if(fieldName == "creator") {
					item.creators.push(value);
				} else {
					item[fieldName] = value;
					return;
				}
			}
		}
	}
}

// add field to DB as note
record.prototype._associateNotes = function(item, fieldNo, part) {
	var field = this.getFieldSubfields(fieldNo);
	var texts = [];	

	for(var i in field) {
		for(var j=0; j<part.length; j++) {
			var myPart = part[j];
			if(field[i][myPart]) {
				texts.push(clean(field[i][myPart]));
			}
		}
	}
	var text = texts.join(' ');
	if (text.trim() != "")
		item.notes.push({note: text});
}

// add field to DB as tags
record.prototype._associateTags = function(item, fieldNo, part) {
	var field = this.getFieldSubfields(fieldNo);
	
	for(var i in field) {
		for(var j=0; j<part.length; j++) {
			var myPart = part[j];
			if(field[i][myPart]) {
				item.tags.push(clean(field[i][myPart]));
			}
		}
	}
}

// this function loads a MARC record into our database
record.prototype.translate = function(item) {
	// get item type
	if(this.leader) {
		var marcType = this.leader[6];
		if(marcType == "g") {
			item.itemType = "film";
		} else if(marcType == "e" || marcType == "f") {
			item.itemType = "map";
		} else if(marcType == "k") {
			item.itemType = "artwork";
		} else if(marcType == "t" || marcType == "b") {
			// 20091210: in unimarc, the code for manuscript is b, unused in marc21.
			item.itemType = "manuscript";
		} else {
			item.itemType = "book";
		}
	} else {
		item.itemType = "book";
	}

	// Starting from there, we try to distinguish between unimarc and other marc flavours.
	// In unimarc, the title is in the 200 field and this field isn't used in marc-21 (at least)
	// In marc-21, the title is in the 245 field and this field isn't used in unimarc
	// So if we have a 200 and no 245, we can think we are with an unimarc record. 
	// Otherwise, we use the original association.
	if ( (this.getFieldSubfields("200")[0]) && (!(this.getFieldSubfields("245")[0])) )
	{
		// If we've got a 328 field, we're on a thesis
		if (this.getFieldSubfields("328")[0])
		{
			item.itemType = "thesis";
		}
		
		// Extract ISBNs
		this._associateDBField(item, "010", "a", "ISBN", pullISBN);
		// Extract ISSNs
		this._associateDBField(item, "011", "a", "ISSN", pullISBN);
		
		// Extract creators (700, 701 & 702)
		for (var i = 700; i < 703; i++)
		{
			var authorTab = this.getFieldSubfields(i);
			for (var j in authorTab) 
			{
				var aut = authorTab[j];
				var authorText = "";
				if (aut.b) {
					authorText = aut['a'] + ", " + aut['b'];
				} 
				else
				{
					authorText = aut['a'];
				}
				
				item.creators.push(Zotero.Utilities.cleanAuthor(authorText, "author", true));
			}
		}
		
		// Extract corporate creators (710, 711 & 712)
		for (var i = 710; i < 713; i++)
		{
			var authorTab = this.getFieldSubfields(i);
			for (var j in authorTab)
			{
				if (authorTab[j]['a'])
				{
					item.creators.push({lastName:authorTab[j]['a'], creatorType:"contributor", fieldMode:true});
				}
			}
		}
		
		// Extract language. In the 101$a there's a 3 chars code, would be better to
		// have a translation somewhere
		this._associateDBField(item, "101", "a", "language");
		
		// Extract abstractNote
		this._associateDBField(item, "328", "a", "abstractNote");
		this._associateDBField(item, "330", "a", "abstractNote");
		
		// Extract tags
		// TODO : Ajouter les autres champs en 6xx avec les autorités construites. 
		// nécessite de reconstruire les autorités
		this._associateTags(item, "610", "a");
		
		// Extract scale (for maps)
		this._associateDBField(item, "206", "a", "scale");
		
		// Extract title
		this._associateDBField(item, "200", "ae", "title");
		
		// Extract edition
		this._associateDBField(item, "205", "a", "edition");
		
		// Extract place info
		this._associateDBField(item, "210", "a", "place");
		
		// Extract publisher/distributor
		if(item.itemType == "film")
		{
			this._associateDBField(item, "210", "c", "distributor");
		}
		else
		{
			this._associateDBField(item, "210", "c", "publisher");
		}
		
		// Extract year
		this._associateDBField(item, "210", "d", "date", pullNumber);
		// Extract pages. Not working well because 215$a often contains pages + volume informations : 1 vol ()
		// this._associateDBField(item, "215", "a", "pages", pullNumber);
		
		// Extract series
		this._associateDBField(item, "225", "a", "series");
		// Extract series number
		this._associateDBField(item, "225", "v", "seriesNumber");
		
		// Extract call number
		this._associateDBField(item, "686", "ab", "callNumber");
		this._associateDBField(item, "676", "a", "callNumber");
		this._associateDBField(item, "675", "a", "callNumber");
		this._associateDBField(item, "680", "ab", "callNumber");
	}
	else
	{
		// Extract ISBNs
		this._associateDBField(item, "020", "a", "ISBN", pullISBN);
		// Extract ISSNs
		this._associateDBField(item, "022", "a", "ISSN", pullISBN);
		// Extract creators
		this._associateDBField(item, "100", "a", "creator", author, "author", true);
		this._associateDBField(item, "110", "a", "creator", corpAuthor, "author");
		this._associateDBField(item, "111", "a", "creator", corpAuthor, "author");
		this._associateDBField(item, "700", "a", "creator", author, "contributor", true);
		this._associateDBField(item, "710", "a", "creator", corpAuthor, "contributor");
		this._associateDBField(item, "711", "a", "creator", corpAuthor, "contributor");
		if(item.itemType == "book" && !item.creators.length) {
			// some LOC entries have no listed author, but have the author in the person subject field as the first entry
			var field = this.getFieldSubfields("600");
			if(field[0]) {
				item.creators.push(Zotero.Utilities.cleanAuthor(field[0]["a"], "author", true));	
			}
		}
		
		// Extract tags
		// personal
		this._associateTags(item, "600", "aqtxyz");
		// corporate
		this._associateTags(item, "611", "abtxyz");
		// meeting
		this._associateTags(item, "630", "acetxyz");
		// uniform title
		this._associateTags(item, "648", "atxyz");
		// chronological
		this._associateTags(item, "650", "axyz");
		// topical
		this._associateTags(item, "651", "abcxyz");
		// geographic
		this._associateTags(item, "653", "axyz");
		// uncontrolled
		this._associateTags(item, "653", "a");
		// faceted topical term (whatever that means)
		this._associateTags(item, "654", "abcyz");
		// genre/form
		this._associateTags(item, "655", "abcxyz");
		// occupation
		this._associateTags(item, "656", "axyz");
		// function
		this._associateTags(item, "657", "axyz");
		// curriculum objective
		this._associateTags(item, "658", "ab");
		// hierarchical geographic place name
		this._associateTags(item, "662", "abcdfgh");

		// Extract note fields
		// http://www.loc.gov/marc/bibliographic/bd5xx.html
		// general note
		this._associateNotes(item, "500", "a");
		// formatted contents (table of contents)
		this._associateNotes(item, "505", "art");
		// summary
		this._associateNotes(item, "520", "ab");
		// biographical or historical data
		this._associateNotes(item, "545", "ab");
		
		// Extract title
		this._associateDBField(item, "245", "ab", "title");
		// Extract edition
		this._associateDBField(item, "250", "a", "edition");
		// Extract place info
		this._associateDBField(item, "260", "a", "place");
		
		// Extract publisher/distributor
		if(item.itemType == "film") {
			this._associateDBField(item, "260", "b", "distributor");
		} else {
			this._associateDBField(item, "260", "b", "publisher");
		}
		
		// Extract year
		this._associateDBField(item, "260", "c", "date", pullNumber);
		// Extract pages
		this._associateDBField(item, "300", "a", "numPages", pullNumber);
		// Extract series and series number
		// The current preference is 490
		this._associateDBField(item, "490", "a", "series");
		this._associateDBField(item, "490", "v", "seriesNumber");
		// 440 was made obsolete as of 2008; see http://www.loc.gov/marc/bibliographic/bd4xx.html
		this._associateDBField(item, "440", "a", "series");
		this._associateDBField(item, "440", "v", "seriesNumber");
		// Extract call number
		this._associateDBField(item, "084", "ab", "callNumber");
		this._associateDBField(item, "082", "a", "callNumber");
		this._associateDBField(item, "080", "ab", "callNumber");
		this._associateDBField(item, "070", "ab", "callNumber");
		this._associateDBField(item, "060", "ab", "callNumber");
		this._associateDBField(item, "050", "ab", "callNumber");
		this._associateDBField(item, "090", "a", "callNumber");
		this._associateDBField(item, "099", "a", "callNumber");
		this._associateDBField(item, "852", "khim", "callNumber");
		
		//German
		if (!item.place) this._associateDBField(item, "410", "a", "place");
		if (!item.publisher) this._associateDBField(item, "412", "a", "publisher");
		if (!item.title) this._associateDBField(item, "331", "a", "title");
		if (!item.title) this._associateDBField(item, "1300", "a", "title");
		if (!item.date) this._associateDBField(item, "425", "a", "date", pullNumber);
		if (!item.date) this._associateDBField(item, "595", "a", "date", pullNumber);
		if (this.getFieldSubfields("104")[0]) this._associateDBField(item, "104", "a", "creator", author, "author", true);
		if (this.getFieldSubfields("800")[0]) this._associateDBField(item, "800", "a", "creator", author, "author", true);
		
		//Spanish
		if (!item.title) this._associateDBField(item, "200", "a", "title");
		if (!item.place) this._associateDBField(item, "210", "a", "place");
		if (!item.publisher) this._associateDBField(item, "210", "c", "publisher");
		if (!item.date) this._associateDBField(item, "210", "d", "date");
		if (!item.creators) {
			for (var i = 700; i < 703; i++) {
				if (this.getFieldSubfields(i)[0]) {
					Zotero.debug(i + " is AOK");
					Zotero.debug(this.getFieldSubfields(i.toString()));
					var aut = this.getFieldSubfields(i)[0];
					if (aut.b) {
						aut = aut['b'].replace(/,\W+/g, "") + " " + aut['a'].replace(/,\s/g, "");
					} else {
						aut = aut['a'].split(", ").join(" ");
					}
					item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
				}
			}
		}
		if(item.title) {
			item.title = Zotero.Utilities.capitalizeTitle(item.title);
		}
		if (this.getFieldSubfields("335")[0]) {
			item.title = item.title + ": " + this.getFieldSubfields("335")[0]['a'];
		}
	}
}

function doImport() {
	var text;
	var holdOver = "";	// part of the text held over from the last loop
	
	while(text = Zotero.read(4096)) {	// read in 4096 byte increments
		var records = text.split("\x1D");
		
		if(records.length > 1) {
			records[0] = holdOver + records[0];
			holdOver = records.pop(); // skip last record, since it's not done
			
			for(var i in records) {
				var newItem = new Zotero.Item();
				
				// create new record
				var rec = new record();	
				rec.importBinary(records[i]);
				rec.translate(newItem);
				
				newItem.complete();
			}
		} else {
			holdOver += text;
		}
	}
}

var exports = {
	"record":record,
	"fieldTerminator":fieldTerminator,
	"recordTerminator":recordTerminator,
	"subfieldDelimiter":subfieldDelimiter
};

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "import",
		"input": "01841cam a2200385Ma 45\u00020001000700000005001700007008004100024010001700065035002300082035001800105040003000123043001200153050001500165049001500180100003900195245028100234260005900515300006100574500019500635500014500830510003000975510002701005510004501032500002601077610004401103600004001147600004801187650004501235610004501280852005801325946003101383910001001414994001201424947001901436\u001e790862\u001e20080120004008.0\u001e880726s1687    sp bf         000 0cspa d\u001e  \u001fa   03021876 \u001e  \u001fa(OCoLC)ocm29051663\u001e  \u001fa(NBYdb)790862\u001e  \u001faMNU\u001fcMNU\u001fdOCL\u001fdDIBAM\u001fdIBV\u001e  \u001fas-py---\u001e0 \u001faF2681\u001fb.X3\u001e  \u001faIBVA\u001flbklr\u001e1 \u001faXarque, Francisco,\u001fdca. 1609-1691.\u001e10\u001faInsignes missioneros de la Compañia de Jesus en la prouincia del Paraguay :\u001fbestado presente de sus missiones en Tucuman, Paraguay, y Rio de la Plata, que comprehende su distrito /\u001fcpor el doct. d. Francisco Xarque, dean de la Catredral [sic] de Santa Maria de Albarrazin ...\u001e  \u001faEn Pamplona :\u001fbPor Juan Micòn, Impressor,\u001fcaño 1687.\u001e  \u001fa[24], 432 p., [1] folded leaf of plates :\u001fbmap ;\u001fc22 cm.\u001e  \u001faBrunet and Graesse both mention a map of Paraguay; this copy has a map of Chile with title: Tabula geocraphica [sic] regni Chile / studio et labore P. Procuratoris Chilensis Societatis Jesu.\u001e  \u001faIn 3 books; the first two are biographies of Jesuits, Simon Mazeta and Francisco Diaz Taño, the 3rd deals with Jesuit missions in Paraguay.\u001e4 \u001faNUC pre-1956,\u001fcNX0000604.\u001e4 \u001faSabin,\u001fc105716 (v.29).\u001e4 \u001faPalau y Dulcet (2nd ed.),\u001fc123233 (v.7).\u001e  \u001faHead and tail pieces.\u001e20\u001faJesuits\u001fzParaguay\u001fvEarly works to 1800.\u001e10\u001faMasseta, Simon,\u001fdca. 1582-ca. 1656.\u001e10\u001faCuellar y Mosquera, Gabriel de,\u001fd1593-1677.\u001e 0\u001faMissions\u001fzParaguay\u001fvEarly works to 1800.\u001e20\u001faJesuits\u001fvBiography\u001fvEarly works to 1800.\u001e8 \u001fbvau,ayer\u001fkVAULT\u001fhAyer\u001fi1343\u001fi.J515\u001fiP211\u001fiX2\u001fi1687\u001ft1\u001e  \u001faOCLC RECON PROJECT\u001farc3758\u001e  \u001fa35535\u001e  \u001fa02\u001fbIBV\u001e  \u001faMARS\u001fa20071227\u001e\u001d",
		"items": [
			{
				"itemType": "book",
				"creators": [
					{
						"firstName": "Francisco",
						"lastName": "Xarque",
						"creatorType": "author"
					}
				],
				"notes": [
					{
						"note": "Brunet and Graesse both mention a map of Paraguay; this copy has a map of Chile with title: Tabula geocraphica [sic] regni Chile / studio et labore P. Procuratoris Chilensis Societatis Jesu In 3 books; the first two are biographies of Jesuits, Simon Mazeta and Francisco Diaz Taño, the 3rd deals with Jesuit missions in Paraguay Head and tail pieces"
					}
				],
				"tags": [
					"Masseta, Simon",
					"Cuellar y Mosquera, Gabriel de",
					"Missions",
					"Paraguay"
				],
				"seeAlso": [],
				"attachments": [],
				"title": "Insignes missioneros de la Compañia de Jesus en la prouincia del Paraguay: estado presente de sus missiones en Tucuman, Paraguay, y Rio de la Plata, que comprehende su distrito",
				"place": "En Pamplona",
				"publisher": "Por Juan Micòn, Impressor",
				"date": "1687",
				"numPages": "24",
				"callNumber": "VAULT Ayer 1343 .J515 P211 X2 1687"
			}
		]
	}
]
/** END TEST CASES **/
