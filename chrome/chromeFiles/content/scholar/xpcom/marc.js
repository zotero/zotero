/*
* Scholar.Ingester.MARC_Record.js
* Stefano Bargioni, Pontificia Universitˆ della Santa Croce - Biblioteca
* Trattamento di record MARC in JavaScript
*
* Original version copyright (C) 2005 Stefano Bargioni, licensed under the LGPL
* (Available at http://www.pusc.it/bib/mel/Scholar.Ingester.MARC_Record.js)
*
* This library is free software; you can redistribute it or
* modify it under the terms of the GNU Lesser General Public
* License as published by the Free Software Foundation; either
* version 2.1 of the License, or (at your option) any later version.
*
* This library is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
* Lesser General Public License for more details.
*/

Scholar.Ingester.MARC_Record = function() { // new MARC record
	this.VERSIONE = '2.6.6b';
	this.VERSIONE_data ='2005-05-10';
	
	this.leader = {
		record_length:'00000',
		record_status:'n', // acdnp
		type_of_record:' ',
		bibliographic_level:' ',
		type_of_control:' ',
		character_coding_scheme:' ',
		indicator_count:'2',
		subfield_code_length:'2',
		base_address_of_data:'00000',
		encoding_level:' ',
		descriptive_cataloging_form:' ',
		linked_record_requirement:' ',
		entry_map:'4500'
	}; // 24 chars

	this.field_terminator   = '\x1E';
	this.record_terminator  = '\x1D';
	this.subfield_delimiter = '\x1F';
	this.directory = '';
	this.directory_terminator = this.field_terminator;
	this.variable_fields = new Array();
	return this;
}

Scholar.Ingester.MARC_Record.prototype.load = function(s,f) { // loads record s passed in format f
	if (f == 'binary') {
		this.leader.record_length = '00000';
		this.leader.record_status = s.substr(5,1);
		this.leader.type_of_record = s.substr(6,1);
		this.leader.bibliographic_level = s.substr(7,1);
		this.leader.type_of_control = s.substr(8,1);
		this.leader.character_coding_scheme = s.substr(9,1);
		this.leader.indicator_count = '2';
		this.leader.subfield_code_length = '2';
		this.leader.base_address_of_data = '00000';
		this.leader.encoding_level = s.substr(17,1);
		this.leader.descriptive_cataloging_form = s.substr(18,1);
		this.leader.linked_record_requirement = s.substr(19,1);
		this.leader.entry_map = '4500';
		
		this.directory = '';
		this.directory_terminator = this.field_terminator;
		this.variable_fields = new Array();
	
		// loads fields
		var campi = s.split(this.field_terminator);
		var k;
		for (k=1; k<-1+campi.length; k++) { // the first and the last are unuseful
			// the first is the header + directory, the last is the this.record_terminator
			var tag = campi[0].substr(24+(k-1)*12,3);
			var ind1 = ''; var ind2 = ''; var value = campi[k];
			if (tag.substr(0,2) != '00') {
				ind1  = campi[k].substr(0,1);
				ind2  = campi[k].substr(1,1);
				value = campi[k].substr(2);
			}
			this.add_field(tag,ind1,ind2,value);
		}
	} else if (f == 'MARC_Harvard') {
		var linee = s.split('\n');
		for (var i=0; i<linee.length; i++) {
			linee[i] = this._trim(linee[i]);
			if (linee[i] == '') continue; // jumps empty lines
			// linee[i] = linee[i].replace(/\t/g,' ');
			linee[i] = linee[i].replace(/ \t/g,'\t');
			linee[i] = linee[i].replace(/\xA0/g,' '); // in some browsers, nbsp is copied as xA0
			var tranche = linee[i].split('|a ');
			var tag, ind1, ind2, value;
			if (tranche.length == 1) {
				tag   = linee[i].substr(0,3);
				value = linee[i].substr(4);
			}
			else {
				tag   = tranche[0].substr(0,3);
				ind1  = tranche[0].substr(3,1);
				ind2  = tranche[0].substr(4,1);
				value = tranche[1];
				value = this._trim(value);
				var replacer = this.subfield_delimiter+'$1';
				value = value.replace(/\|(.) /g,replacer);
			}
			if (tag == 'LDR') {
				this.leader.record_length = '00000';
				this.leader.record_status = value.substr(5,1);
				this.leader.type_of_record = value.substr(6,1);
				this.leader.bibliographic_level = value.substr(7,1);
				this.leader.type_of_control = value.substr(8,1);
				this.leader.character_coding_scheme = value.substr(9,1);
				this.leader.indicator_count = '2';
				this.leader.subfield_code_length = '2';
				this.leader.base_address_of_data = '00000';
				this.leader.encoding_level = value.substr(17,1);
				this.leader.descriptive_cataloging_form = value.substr(18,1);
				this.leader.linked_record_requirement = value.substr(19,1);
				this.leader.entry_map = '4500';
				
				this.directory = '';
				this.directory_terminator = this.field_terminator;
				this.variable_fields = new Array();
			}
			else if (tag > '008' && tag < '899') { // jumps low and high tags, also H03 and similia
				if (tag != '040') this.add_field(tag,ind1,ind2,value);
			}
		}
		this.add_field_005();
	} else if (f == 'MARC_BNI') {
		var linee = s.split('\n');
		for (var i=0; i<linee.length; i++) {
			linee[i] = this._trim(linee[i]);
			if (linee[i] == '') continue; // jumps empty lines
			linee[i] = linee[i].replace(/\xA0/g,' '); // in some browsers, nbsp is copied as xA0
			linee[i] = linee[i].replace(/\|/g,' ');
			linee[i] = linee[i].replace(/_/g,' ');
			linee[i] = linee[i].replace(/\$/g,this.subfield_delimiter);
			var tranche = linee[i].split('\t');
			var tag   = tranche[0];
			var ind1  = tranche[1].substr(0,1);
			var ind2  = tranche[1].substr(1,1);
			var value = this._trim(tranche[2]);
			if (tag == 'LEA') {
				this.leader.record_length = '00000';
				this.leader.record_status = value.substr(5,1);
				this.leader.type_of_record = value.substr(6,1);
				this.leader.bibliographic_level = value.substr(7,1);
				this.leader.type_of_control = value.substr(8,1);
				this.leader.character_coding_scheme = value.substr(9,1);
				this.leader.indicator_count = '2';
				this.leader.subfield_code_length = '2';
				this.leader.base_address_of_data = '00000';
				this.leader.encoding_level = value.substr(17,1);
				this.leader.descriptive_cataloging_form = value.substr(18,1);
				this.leader.linked_record_requirement = value.substr(19,1);
				this.leader.entry_map = '4500';
				
				this.directory = '';
				this.directory_terminator = this.field_terminator;
				this.variable_fields = new Array();
			}
			else if (tag > '008' && tag < '899') { // jumps low and high tags
				if (tag != '040') this.add_field(tag,ind1,ind2,value);
			}
		}
		this.add_field_005();
	} else if (f == 'MARC_Loc') { // MARC copiato dal browser dal sito catalog.loc.gov 
		var linee = s.split('\n');
		for (var i=0; i<linee.length; i++) {
			linee[i] = this._trim(linee[i]);
			if (linee[i] == '') continue; // jumps empty lines
			linee[i] = linee[i].replace(/\xA0/g,' '); // in some browsers, nbsp is copied as xA0
			linee[i] = linee[i].replace(/_/g,' ');
			linee[i] = linee[i].replace(/\t/g,'');
			var replacer = this.subfield_delimiter+'$1';
			linee[i]  = linee[i].replace(/\|(.) /g,replacer);
			linee[i]  = linee[i].replace(/\|/g,this.subfield_delimiter);
			var tag   = linee[i].substr(0,3);
			var ind1  = linee[i].substr(4,1);
			var ind2  = linee[i].substr(5,1);
			var value = linee[i].substr(7);
			if (tag == '000') {
				linee[i] = linee[i].replace(/    /,' ');
				value = linee[i].substr(4);
				this.leader.record_length = '00000';
				this.leader.record_status = value.substr(5,1);
				this.leader.type_of_record = value.substr(6,1);
				this.leader.bibliographic_level = value.substr(7,1);
				this.leader.type_of_control = value.substr(8,1);
				this.leader.character_coding_scheme = value.substr(9,1);
				this.leader.indicator_count = '2';
				this.leader.subfield_code_length = '2';
				this.leader.base_address_of_data = '00000';
				this.leader.encoding_level = value.substr(17,1);
				this.leader.descriptive_cataloging_form = value.substr(18,1);
				this.leader.linked_record_requirement = value.substr(19,1);
				this.leader.entry_map = '4500';
				
				this.directory = '';
				this.directory_terminator = this.field_terminator;
				this.variable_fields = new Array();
			}
			else if (tag > '008' && tag < '899') { // jumps low and high tags
				if (tag != '040') this.add_field(tag,ind1,ind2,value);
			}
		}
		this.add_field_005();
	} else if (f == 'MARC_PAC') {
		var linee = s.split('\n');
		for (var i=0; i<linee.length; i++) {
			linee[i] = linee[i].replace(/\xA0/g,' '); // in some browsers, nbsp is copied as xA0
			linee[i] = linee[i].replace(/_/g,' ');
			linee[i] = linee[i].replace(/\t/g,'');
			linee[i] = this._trim(linee[i]);
			if (linee[i] == '') continue; // jumps empty lines
			var replacer = this.subfield_delimiter+'$1';
			linee[i]  = linee[i].replace(/\|(.)/g,replacer);
			linee[i]  = linee[i].replace(/\|/g,this.subfield_delimiter);
			var tag   = linee[i].substr(0,3);
			var ind1  = linee[i].substr(4,1);
			var ind2  = linee[i].substr(5,1);
			var value = this.subfield_delimiter+'a'+linee[i].substr(7);
			if(linee[i].substr(0, 6) == "LEADER") {
				value = linee[i].substr(7);
				this.leader.record_length = '00000';
				this.leader.record_status = value.substr(5,1);
				this.leader.type_of_record = value.substr(6,1);
				this.leader.bibliographic_level = value.substr(7,1);
				this.leader.type_of_control = value.substr(8,1);
				this.leader.character_coding_scheme = value.substr(9,1);
				this.leader.indicator_count = '2';
				this.leader.subfield_code_length = '2';
				this.leader.base_address_of_data = '00000';
				this.leader.encoding_level = value.substr(17,1);
				this.leader.descriptive_cataloging_form = value.substr(18,1);
				this.leader.linked_record_requirement = value.substr(19,1);
				this.leader.entry_map = '4500';
				
				this.directory = '';
				this.directory_terminator = this.field_terminator;
				this.variable_fields = new Array();
			}
			else if (tag > '008' && tag < '899') { // jumps low and high tags
				if (tag != '040') this.add_field(tag,ind1,ind2,value);
			}
		}
		this.add_field_005();
	}
	
	this.update_record_length();
	this.update_base_address_of_data();
	return this;
}

Scholar.Ingester.MARC_Record.prototype.update_base_address_of_data = function() { // updates the base_address
	this.leader.base_address_of_data = this._zero_fill(24+this.variable_fields.length*12+1,5);
	return this.leader.base_address_of_data;
}

Scholar.Ingester.MARC_Record.prototype.update_displacements = function() { // rebuilds the directory
	var displ = 0;
	this.directory = '';
	for (var i=0; i<this.variable_fields.length; i++) {
		var len = this.variable_fields[i].value.length + 1 +
				 this.variable_fields[i].ind1.length  +
				 this.variable_fields[i].ind2.length;
		this.directory += this.variable_fields[i].tag +
						  this._zero_fill(len,4) + this._zero_fill(displ,5);
		displ += len;
	}
	return true;
}
Scholar.Ingester.MARC_Record.prototype.update_record_length = function() { // updates total record length
	var fields_total_length = 0; var f;
	for (f=0; f<this.variable_fields.length;f++) {
		fields_total_length += this.variable_fields[f].ind1.length+this.variable_fields[f].ind2.length+this.variable_fields[f].value.length + 1;
	}
	var rl = 24+this.directory.length+1+fields_total_length+1;
	this.leader.record_length = this._zero_fill(rl,5);
}

Scholar.Ingester.MARC_Record.prototype.sort_directory = function() { // sorts directory and array variable_fields by tag and occ
	// ordinamento della directory
	if (this.directory.length <= 12) { return true; } // already sorted
	var directory_entries = new Array();
	var i;
	for (i=0; i<this.directory.length; i=i+12) {
		directory_entries[directory_entries.length] = this.directory.substr(i,12);
	}
	directory_entries.sort();
	this.directory = directory_entries.join('');
	// sorts array variable_fields
	this.variable_fields.sort(function(a,b) { return a.tag - b.tag + a.occ - b.occ; });
	return true;
}

Scholar.Ingester.MARC_Record.prototype.show_leader = function() {
	var leader = ''; var f;
	for (f in this.leader) { leader += this.leader[f]; }
	return leader;
}

Scholar.Ingester.MARC_Record.prototype.show_fields = function() {
	var fields = ''; var f;
	for (f=0; f<this.variable_fields.length;f++) {
		fields += this.variable_fields[f].ind1  +
				  this.variable_fields[f].ind2  +
				  this.variable_fields[f].value +
				  this.field_terminator;
	}
	return fields;
}

Scholar.Ingester.MARC_Record.prototype.show_directory = function() {
	var d = '';
	for (var i = 0; i<this.directory.length; i+=12) {
		d += this.directory.substr(i,3)   + ' ' +
			 this.directory.substr(i+3,4) + ' ' +
			 this.directory.substr(i+7,5) + '\n';
	}
	return d;
}

Scholar.Ingester.MARC_Record.prototype.add_field_005 = function() {
	var now = new Date();
	now = now.getFullYear() + 
		  this._zero_fill(now.getMonth()+1,2) + 
		  this._zero_fill(now.getDate(),2) +
		  this._zero_fill(now.getHours(),2) + 
		  this._zero_fill(now.getMinutes(),2) +
		  this._zero_fill(now.getSeconds(),2) + '.0';
	this.add_field('005','','',now);
	return now;
}

Scholar.Ingester.MARC_Record.prototype.count_occ = function(tag) { // counts occ of tag
	var n = 0;
	for (var i=0; i<this.variable_fields.length; i++) {
		if (this.variable_fields[i].tag == tag) { n++; }
	}
	return n;
}

Scholar.Ingester.MARC_Record.prototype.exists = function(tag) { // field existence
	if (this.count_occ(tag) > 0) return true;
	return false;
}

Scholar.Ingester.MARC_Record.prototype.MARC_field = function(rec,tag,ind1,ind2,value) { // new MARC gield
	this.tag = tag;
	this.occ = rec.count_occ(tag)+1; // occurrence order no.
	this.ind1 = ind1; if (this.ind1 == '') this.ind1 = ' ';
	this.ind2 = ind2; if (this.ind2 == '') this.ind2 = ' ';
	if (tag.substr(0,2) == '00') {
		this.ind1 = ''; this.ind2 = '';
	}
	this.value = value;
	return this;
}

Scholar.Ingester.MARC_Record.prototype.display = function(type) { // displays record in format type
	type = type.toLowerCase();
	if (type == 'binary') return this.show_leader() +
								 this.directory     +
								 this.field_terminator   +
								 this.show_fields() +
								 this.record_terminator;
	if (type == 'html') {
		var s = '<table class="record_table">';
		var l = R.show_leader();
		s += '<tr><td class="tag">000</td><td class="ind"></td><td class="ind"></td><td class="record_value">'+l+'</td></tr>';
		var i;
		for (i=0; i<this.variable_fields.length; i++) {
			var ind1 = this.variable_fields[i].ind1; if (ind1 == ' ') { ind1 = '&#160'; }
			var ind2 = this.variable_fields[i].ind2; if (ind2 == ' ') { ind2 = '&#160'; }
			s += '<tr>';
			s += '<td class="tag">'+this.variable_fields[i].tag+'</td>';
			s += '<td class="ind">'+ind1+'</td>';
			s += '<td class="ind">'+ind2+'</td>';
			var v = this.variable_fields[i].value;
			if (this.variable_fields[i].tag == '008') v = v.replace(/ /g,'&#160;');
			s += '<td class="record_value">'+this._ddagger(v)+'</td>';
			s += '</tr>';
		}
		s += '</table>';
		return s;
	}
	if (type == 'xml') {
		s = '';
		s += '<?xml version="1.0" encoding="iso-8859-1"?><collection xmlns="http://www.loc.gov/MARC21/slim"><record>';
		s += '<leader>'+this.show_leader()+'</leader>';
		// var i;
		for (i=0; i<this.variable_fields.length; i++) {
			ind1 = this.variable_fields[i].ind1; if (ind1 != '') ind1 = ' ind1="'+ind1+'"';
			ind2 = this.variable_fields[i].ind2; if (ind2 != '') ind2 = ' ind2="'+ind2+'"';
			if (this.variable_fields[i].tag.substr(0,2) == '00') s += '<controlfield tag="'+this.variable_fields[i].tag+'">'+this.variable_fields[i].value+'</controlfield>';
			else {
				var subfields = this.variable_fields[i].value.split(this.subfield_delimiter);
				// alert(this.variable_fields[i].value+' '+subfields.length); // test
				if (subfields.length == 1) subfields[1] = '?'+this.variable_fields[i].value;
				var sf = '';
				for (var j=1; j<subfields.length; j++) {
					sf += '<subfield code="'+subfields[j].substr(0,1)+'">'+subfields[j].substr(1)+'</subfield>';
				}
				s += '<datafield tag="' + this.variable_fields[i].tag + '"' + ind1 + ind2 + '>' + sf + '</datafield>';
			}
		}
		s += '</record></collection>';
		return s;
	}
	if (type == 'xml-html') {
		s = this.display('xml');
		// abbellimenti
		s = s.replace(/\<leader\>/,'\n <leader>');
		s = s.replace(/\<controlfield/g,'\n <controlfield');
		s = s.replace(/\<datafield/g,'\n  <datafield');
		s = s.replace(/\<collection/g,'\n<collection');
		s = s.replace(/\<record/g,'\n<record');
		s = s.replace(/\<\/datafield/g,'\n  </datafield');
		s = s.replace(/\<\/collection/g,'\n</collection');
		s = s.replace(/\<\/record/g,'\n</record');
		s = s.replace(/\<subfield/g,'\n   <subfield');
		s = s.replace(/\x1F/g,'%1F'); s = this._ddagger(s);
		// escape chars < e >
		s = s.replace(/\</g,'&lt;');
		s = s.replace(/\>/g,'&gt;');
		// colore alle keyword
		s = s.replace(/(controlfield|datafield|collection|record|leader|subfield)/g,'<span class="cdfield">$1</span>');
		s = s.replace(/(tag|code|ind1|ind2)=/g,'<span class="attrib">$1=</span>');
		return s;
	}
	return false;
}

Scholar.Ingester.MARC_Record.prototype.get_field = function(tag) { // returns an array of values, one for each occurrence
	var v = new Array(); var i;
	for (i=0; i<this.variable_fields.length; i++) {
		if (this.variable_fields[i].tag == tag) {
			v[v.length] = this.variable_fields[i].ind1 +
			this.variable_fields[i].ind2 + 
			this.variable_fields[i].value;
		}
	}
	return v;
}

// This function added by Simon Kornblith
Scholar.Ingester.MARC_Record.prototype.get_field_subfields = function(tag) { // returns a two-dimensional array of values
	var field = this.get_field(tag);
	var return_me = new Array();
	for(var i in field) {
		return_me[i] = new Object();
		var subfields = field[i].split(this.subfield_delimiter);
		if (subfields.length == 1) {
			return_me[i]['?'] = field[i];
		} else {
			for (var j=1; j<subfields.length; j++) {
				return_me[i][subfields[j].substr(0,1)] = subfields[j].substr(1);
			}
		}
	}
	return return_me;
}

Scholar.Ingester.MARC_Record.prototype.add_field = function(tag,ind1,ind2,value) { // adds a field to the record
	if (tag.length != 3) { return false; }
	var F = new this.MARC_field(this,tag,ind1,ind2,value);
	// adds pointer to list of fields
	this.variable_fields[this.variable_fields.length] = F;
	// adds the entry to the directory
	this.directory += F.tag+this._zero_fill(F.ind1.length+F.ind2.length+F.value.length+1,4)+'00000';
	// sorts the directory
	this.sort_directory();
	// updates lengths
	this.update_base_address_of_data();
	this.update_displacements();
	this.update_record_length();
	return F;
}

Scholar.Ingester.MARC_Record.prototype.delete_field = function(tag,occurrence) {
	// lookup and delete the occurrence from array variable_fields
	var i;
	for (i=0; i<this.variable_fields.length; i++) {
		if (this.variable_fields[i].tag == tag && this.variable_fields[i].occ == occurrence) break;
	}
	if (i==this.variable_fields.length) return false; // campo non trovato
	// deletes the occ. i from array variable_fields scaling next values
	var j;
	for (j=i+1; j<this.variable_fields.length; j++) {
		this.variable_fields[i++]=this.variable_fields[j];
	}
	this.variable_fields.length--; // deletes last element
	// lookup and delete the occurrence from directory (must exist; no sort is needed)
	var nocc = 0;
	// var i;
	for (i=0; i<this.directory.length;i=i+12) {
		if (this.directory.substr(i,3) == tag) nocc++;
		if (occurrence == nocc) { // occ found
			break;
		}
	}
	if (i >= this.directory.length) alert('Internal error!');
	this.directory = this.directory.substr(0,i) + this.directory.substr(i+12);
	// updates lengths
	this.update_base_address_of_data();
	this.update_displacements();
	this.update_record_length();
	return true;
}

Scholar.Ingester.MARC_Record.prototype._ddagger = function(s) { // display doubledagger in html code
	s = s.replace(/\%1F(.)/g, "<span class=\"this._ddagger\">&#135;$1</span>");
	s = s.replace(/\x1F(.)/g, "<span class=\"this._ddagger\">&#135;$1</span>");
	return s;
}

Scholar.Ingester.MARC_Record.prototype._trim = function(s) { // eliminates blanks from both sides
	s = s.replace(/\s+$/,'');
	return s.replace(/^\s+/,'');
}

Scholar.Ingester.MARC_Record.prototype._zero_fill = function(s,l) { // left '0' padding of s, up to l (l<=15)
	var t = '000000000000000';
	t = t+s;
	return t.substr(t.length-l,l);
}

Scholar.Ingester.MARC_Record.prototype.version = function() { // returns version and date
	return 'MARC Editor Lite '+this.VERSIONE+' ('+this.VERSIONE_data+')';
}