{
	"translatorID":"91acf493-0de7-4473-8b62-89fd141e6c74",
	"translatorType":1,
	"label":"MAB2",
	"creator":"Simon Kornblith. Adaptions for MAB2: Leon Krauthausen (FUB)",
	"target":"mab2",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-12 19:00:00"
}

function detectImport() {
	var mab2RecordRegexp = /^[0-9]{3}[a-z ]{2}[a-z ]{3}$/
	var read = Zotero.read(8);
	if(mab2RecordRegexp.test(read)) {
		return true;
	}
}

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
	value = value.replace(/<<+/g, '');
	value = value.replace(/>>+/g, '');
	value = value.replace(/ +/g, ' ');
	
	var char1 = value[0];
	var char2 = value[value.length-1];
	if((char1 == "[" && char2 == "]") || (char1 == "(" && char2 == ")")) {
		// chop of extraneous characters
		return value.substr(1, value.length-2);
	}
	
	return value;
}

function cleanTag(value) {
	// Chop off Authority-IDs
	value = value.slice(0, value.indexOf('|'));
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

// MAB2 author extraction 
// evaluates subfield $b and sets authType 
function authorMab(author, authType, useComma) {
		if(!authType) var authType='author';
		authType = authType.replace('[Hrsg.]', 'editor');
		authType = authType.replace('[Mitarb.]', 'contributor');
		authType = authType.replace('[Übers.]', 'translator');
		return Zotero.Utilities.cleanAuthor(author, authType, useComma);
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

// import a binary MAB2 record into this record
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

// add field to DB as tags
record.prototype._associateTags = function(item, fieldNo, part) {
	var field = this.getFieldSubfields(fieldNo);
	for(var i in field) {
		for(var j=0; j<part.length; j++) {
			var myPart = part[j];
			if(field[i][myPart]) {
				item.tags.push(cleanTag(field[i][myPart]));
			}
		}
	}
}

// this function loads a MAB2 record into our database
record.prototype.translate = function(item) {
	// get item type
	if(this.leader) {
		var marcType = this.leader[6];
		if(marcType == "g") {
			item.itemType = "film";
		} else if(marcType == "k" || marcType == "e" || marcType == "f") {
			item.itemType = "artwork";
		} else if(marcType == "t") {
			item.itemType = "manuscript";
		} else {
			item.itemType = "book";
		}
	} else {
		item.itemType = "book";
	}
	
	// Extract MAB2 fields
	// FUB Added language, edition, pages, url, edition, series, ISBN, url
	for (var i = 100; i <= 196; i++) {
		if (this.getFieldSubfields(i)[0]) {
			var field = this.getFieldSubfields(i)[0]['a'];
			var authType = this.getFieldSubfields(i)[0]['b'];
			this._associateDBField(item, i, "a", "creator", authorMab, authType, true);
		}
	}

	// if (this.getFieldSubfields("800")[0]) this._associateDBField(item, "800", "a", "creator", author, "author", true);
	if (!item.language) this._associateDBField(item, "037b", "a", "language");	
	this._associateDBField(item, "200", "a", "creator", corpAuthor);
	if (!item.title) this._associateDBField(item, "331", "a", "title");
	this._associateDBField(item, "304", "a", "extra");
	if (this.getFieldSubfields("335")[0]) {
		item.title = item.title + ": " + this.getFieldSubfields("335")[0]['a'];
	}	
	if (!item.edition) this._associateDBField(item, "403", "a", "edition");
	if (!item.place) this._associateDBField(item, "410", "a", "place");
	if (!item.publisher) this._associateDBField(item, "412", "a", "publisher");
	if (!item.title) this._associateDBField(item, "1300", "a", "title");
	if (!item.date) this._associateDBField(item, "425", "a", "date", pullNumber);
	if (!item.pages) this._associateDBField(item, "433", "a", "pages", pullNumber);
	if (!item.series) this._associateDBField(item, "451", "a", "series");
	this._associateDBField(item, "501", "a", "extra");
	this._associateDBField(item, "519", "a", "extra");
	if (!item.edition) this._associateDBField(item, "523", "a", "edition");
	if (!item.ISBN) this._associateDBField(item, "540", "a", "ISBN", pullISBN);
	if (!item.date) this._associateDBField(item, "595", "a", "date", pullNumber);
	if (!item.url) this._associateDBField(item, "655e", "u", "url");	

	// Extract German subject headings (RSWK) as tags
	this._associateTags(item, "902", "acfgpkstz");
	this._associateTags(item, "907", "acfgpkstz");	
	this._associateTags(item, "912", "acfgpkstz");	
	this._associateTags(item, "917", "acfgpkstz");	
	this._associateTags(item, "922", "acfgpkstz");	
	this._associateTags(item, "927", "acfgpkstz");	
	this._associateTags(item, "932", "acfgpkstz");	
	this._associateTags(item, "937", "acfgpkstz");	
	this._associateTags(item, "942", "acfgpkstz");	


}

function doImport() {
	var text;
	var holdOver = "";	// part of the text held over from the last loop
	
	Zotero.setCharacterSet("utf-8");
	
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