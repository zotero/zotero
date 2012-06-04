/*
 * Old-style multilingual parsing and data mangling helper functions
 */

Zotero.Multi.parseServantLang = function (s) {
	var m, o, i;
	m = s.match(/^#([0-9]{3})([0-9]{2})[-0-9a-zA-Z]+/);
	if (m) {
		i = parseInt(m[1], 10);
		o = parseInt(m[2], 10);
		return [i, s.slice(6, o + 6)];
	} else {
		return [0, ''];
	}
}

Zotero.Multi.mangle = function (fields) {
	// Format is:
	//   #00105ja-jpThis is a pen.
	// #
	// + master creator index
	// + length of lang code
	// + lang code

	if (fields.lastName) {
		var servantLang = '';
		var masterIndex = '';
		var servantLangLen = '';
		//Zotero.debug("XXX ======== mangle ============");
		//Zotero.debug("XXX lastName: "+fields.lastName);
		//Zotero.debug("XXX servantLang: "+fields.servantLang);
		//Zotero.debug("XXX masterIndex: "+fields.masterIndex + " of type "+typeof fields.masterIndex);
		if (fields.servantLang && "number" === typeof fields.masterIndex) {
			servantLang = '' + fields.servantLang;
			masterIndex = '' + fields.masterIndex;
			while (masterIndex.length < 3) {
				masterIndex = '0' + masterIndex;
			}
			servantLangLen= "" + servantLang.length;
			while (servantLangLen.length < 2) {
				servantLangLen = '0' + servantLangLen;
			}
			masterIndex = '#' + masterIndex;
		}
		fields.lastName = masterIndex + servantLangLen + servantLang + fields.lastName;
		//Zotero.debug("XXX storing in DB: "+fields.lastName);
	}
	var newfields = [];
	for each (key in Zotero.Creators.fields.slice(0, 5)) {
		newfields[key] = fields[key];
	}
	return newfields;
}

Zotero.Multi.stripMark = function (s) {
	var m, o;
	m = s.match(/^#[0-9]{3}([0-9]{2})[-0-9a-zA-Z]+/);
	if (m) {
		o = parseInt(m[1], 10);
		return s.slice(6 + o);
	}
	return s;
};

Zotero.Multi.parseSerializedMultiField = function (s) {
	var base, m, texts, codes, base_len, mm, text_len, code_len, code, text;
	base = '';
	var multi = {};
	m = s.match(/^#([0-9]{4})[0-9]{6}00/);
	if (m) {
		var text_offset = parseInt(m[1], 10);
		texts = s.slice(5 + text_offset);
		codes = s.slice(5, 5 + text_offset);

		base_len = parseInt(codes.slice(0, 6), 10);
		base = texts.slice(0, base_len);
		texts = texts.slice(base_len);
		codes = codes.slice(8);

		mm = codes.match(/([0-9]{6})([0-9]{2})[-A-Za-z0-9]+/);
		while (mm) {
			text_len = parseInt(mm[1], 10);
			code_len = parseInt(mm[2], 10);

			code = codes.slice(8, 8 + code_len);
			codes = codes.slice(8 + code_len);

			text = texts.slice(0, text_len);
			texts = texts.slice(text_len);
			multi[code] = text;

			mm = codes.match(/([0-9]{6})([0-9]{2})[-A-Za-z0-9]+/);
		}
		if (texts.length) {
			base = '[corrupt field content: ' + texts + '] ' + base;
		}
	} else {
		base = s;
	}
	return [base, multi];
}


// XXXZ
Zotero.Item.prototype.setMultiField = function (field, val, lang) {
	var text, texts, code, codes, s, tlen, clen, key, codeslen;

	var fieldID = Zotero.ItemFields.getID(field);
	
	// No need to protect against invalid fields in this function,
	// if invoked only through setField().

	if (this._itemData[fieldID] && this._itemData[fieldID].slice(0, 1) === '#') {
		if (!this._multiBase[fieldID]) {
			this._loadMulti(fieldID);
		}
	}

	// Beware: the __count__ trick no longer works in rhino.
	// This code was used for migration from old data model
	// to new SQL layout. It should no longer be needed and
	// both the code and migration support should be dropped.

	if (!lang) {
		if (!this._multiField[fieldID] || !this._multiField[fieldID].__count__) {
			this._itemData[fieldID] = val;
			this._multiBase[fieldID] = null;
		} else {
			this._multiBase[fieldID] = val;
		}
	} else {
		// Handle lang entry deletion
		if (!val && this._multiField[fieldID][lang]) {
			delete this._multiField[fieldID][lang];
		} else if (val) {
			if (!this._multiField[fieldID]) {
				this._multiField[fieldID] = {};
			}
			this._multiField[fieldID][lang] = val;
		}
	}
	//
	if (!this._multiField[fieldID] || !this._multiField[fieldID].__count__) {
		if (this._multiBase[fieldID]) {
			this._itemData[fieldID] = this._multiBase[fieldID];
			this._multiBase[fieldID] = null;
		}
	} else {
		codes = '';
		texts = '';
		if (this._itemData[fieldID] && this._itemData[fieldID].slice(0, 1) !== '#') {
			this._multiBase[fieldID] = this._itemData[fieldID];
		}
		text = this._multiBase[fieldID];
		tlen = '' + text.length;
		while (tlen.length < 6) {
			tlen = '0' + tlen;
		}
		code = tlen + '00';
		codes += code;
		texts += text;
		for (key in this._multiField[fieldID]) {
			text = this._multiField[fieldID][key];
			tlen = '' + text.length;
			while (tlen.length < 6) {
				tlen = '0' + tlen;
			}
			clen = '' + key.length;
			while (clen.length < 2) {
				clen = '0' + clen;
			}
			code = tlen + clen + key;
			codes += code;
			texts += text;
		}
		codeslen = '' + codes.length;
		while (codeslen.length < 4) {
			codeslen = '0' + codeslen;
		}

		this._itemData[fieldID] = '#' + codeslen + codes + texts;

	}
	// Over-aggressive.  Should check for equality.
	if (!this._changedItemData) {
		this._changedItemData = {};
	}
	this._changedItemData[fieldID] = true;
};



// XXXZ
Zotero.Item.prototype._loadMulti = function (fieldID) {
	var base, m, mm, base_len, text_len, code_len, code, text, codes, texts, s, multi;

	// This is invoked once, at item instantiation
	// Reads then play off of the multi object, and
	// writes update both the multi object and the field.
	// Sync of the flattened data in the field happens
	// in the normal way.

	// Data format that can be used to split the field reliably
	// in SQL.

	// Field format is:
	//   Offset to text field content (4 digits)
	//     Text field length (6 digits)
	//     Language code length (2 digits)
	//     Language code (variable length)

	s = this._itemData[fieldID];
	if (!s) {
		return;
	}
	[base, multi] = Zotero.Multi.parseSerializedMultiField(s);
	this._multiBase[fieldID] = base;
	this._multiField[fieldID] = multi;
};

