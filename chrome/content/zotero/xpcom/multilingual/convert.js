// For creators?
Zotero.MultiConvert = function () {};

Zotero.MultiConvert.prototype.fixItems = function () {
	// Item fields
	var sql = "SELECT itemID,fieldID,value FROM itemData NATURAL JOIN itemDataValues " +
		"WHERE SUBSTR(value,1,1)='#'"
	var rows = Zotero.DB.query(sql);
	var lastItem = false;
	for (var i = 0, ilen = rows.length; i < ilen; i += 1) {
		var itemID = rows[i].itemID;
		var fieldID = rows[i].fieldID;
		var value = rows[i].value;
		if (lastItem !== itemID) {
			if (lastItem) {
				this.fixItemFields(lastItem,fieldIDs,values);
			}
			var fieldIDs = [];
			var values = [];
			lastItem = itemID;
		}
		fieldIDs.push(fieldID);
		values.push(value);
	}
	if (lastItem) {
		this.fixItemFields(lastItem,fieldIDs,values);
	}

	// Item creators
	// Conversion of creators works in two stages.

	// Get a list of creatorIDs that will be deleted
	var sql = "SELECT creatorID FROM creators " +
		"NATURAL JOIN creatorData " +
		"WHERE SUBSTR(lastName,1,1)='#'";
	var affectedCreatorIds = Zotero.DB.columnQuery(sql);

	// Get a list of itemIDs that will be affected
	var sql = "SELECT DISTINCT IC.itemID AS itemID FROM itemCreators IC LEFT JOIN creators C ON " +
		"IC.creatorID=C.creatorID JOIN creatorData CD ON CD.creatorDataID=C.creatorDataID " +
		"WHERE SUBSTR(CD.lastName,1,1)='#'";
	var affectedItemIds = Zotero.DB.columnQuery(sql);


	// In the first stage, we convert creators in much the same
	// way as item fields, working from the creators table.
	var sql = "SELECT C.creatorID,C.creatorDataID,"+
		"C.dateAdded,C.dateModified,C.clientDateModified,C.libraryID,C.key,CD.lastName,CD.firstName "+
		"FROM itemCreators IC " +
		"LEFT JOIN creators C ON IC.creatorID=C.creatorID " +
		"JOIN creatorData CD ON C.creatorDataID=CD.creatorDataID " +
		"WHERE itemID in (" +
			"SELECT itemID FROM itemCreators WIC " +
			"LEFT JOIN creators WC ON WIC.creatorID=WC.creatorID " +
			"JOIN creatorData WCD on WC.creatorDataID=WCD.creatorDataID " +
			"WHERE SUBSTR(WCD.lastName,1,1)='#' GROUP BY itemID" +
		") ORDER BY IC.itemID,IC.orderIndex";
	var rows = Zotero.DB.query(sql);

	for (var i = 0, ilen = rows.length; i < ilen; i += 1) {
		var row = rows[i];
		if (row.lastName && row.lastName[0] !== '#') {
			var creatorID = row.creatorID;
		} else {
			if (!row.firstName && !row.lastName) {
				continue;
			}
			var langTag = this.parseServantLang(row.lastName)[1];
			var lastName = row.lastName.slice(6 + langTag.length);
			// get creatorDataID
			var fields = {};
			fields.lastName = lastName;
			fields.firstName = row.firstName;
			fields.shortName = '';
			fields.birthYear = '';
			if (!fields.firstName) {
				fields.fieldMode = 1;
			} else {
				fields.fieldMode = 0;
			}
			
			var sql = "SELECT creatorDataAltID FROM creatorDataAlt WHERE firstName=? AND lastName=? AND shortName=?";
			var creatorDataAltID = Zotero.DB.valueQuery(sql, [fields.firstName, fields.lastName, fields.shortName]);
			if (!creatorDataAltID) {
				var idgen = new Zotero.ID_Tracker;
				creatorDataAltID = idgen.get("creatorDataAlt");
				sql = "INSERT INTO creatorDataAlt VALUES (?, ?, ?, ?)";
				Zotero.DB.query(sql, [creatorDataAltID, fields.firstName, fields.lastName, '']);
			}
			
			var sql = "SELECT COUNT (*) FROM creatorsAlt " +
				"WHERE creatorID=? AND libraryID=? AND key=? AND languageTag=?";
			var hasCreatorAlt = Zotero.DB.valueQuery(sql, [creatorID,row.libraryID,row.key,langTag]);
			if (!hasCreatorAlt) {
				// Create creatorsAlt entry, linked to creatorID
				// that will remain in itemCreators
				var sql = "INSERT INTO creatorsAlt VALUES (?,?,?,?,?,?,?,?)";
				var values = [
					creatorID,
					creatorDataAltID,
					row.dateAdded,
					row.dateModified,
					row.clientDateModified,
					row.libraryID,
					row.key,
					langTag
				];
				Zotero.DB.query(sql,values);
			}
		}
	}

	// In the second stage, we delete multi creators from
	// the itemCreators table, and refresh the orderIndex values
	// to eliminate gaps in the sequence.
	for (var i = 0, ilen = affectedCreatorIds.length; i < ilen; i += 1) {
		// Creator to be deleted
		var sql = "DELETE FROM itemCreators WHERE creatorID=?";
		Zotero.DB.query(sql,[affectedCreatorIds[i]]);
	} 
	for (var i = 0, ilen = affectedItemIds.length; i < ilen; i += 1) {
		var itemID = affectedItemIds[i];
		var sql = "SELECT creatorID,creatorTypeID,orderIndex FROM itemCreators WHERE itemID=? ORDER BY orderIndex";
		var itemCreatorRows = Zotero.DB.query(sql,[itemID]);
		var orderIndex = 0;
		for (var j = 0, jlen = itemCreatorRows.length; j < jlen; j += 1) {
			var creatorID = itemCreatorRows[j].creatorID;
			var creatorTypeID = itemCreatorRows[j].creatorTypeID;
			var oldOrderIndex = itemCreatorRows[j].orderIndex;
			sql = "DELETE FROM itemCreators WHERE creatorID=? AND creatorTypeID=? AND itemID=? AND orderIndex=?";
			Zotero.DB.query(sql,[creatorID,creatorTypeID,itemID,oldOrderIndex]);
			sql = "INSERT INTO itemCreators VALUES (?,?,?,?)";
			Zotero.DB.query(sql,[itemID,creatorID,creatorTypeID,orderIndex]);
			orderIndex++;
		}
	}
	sql = "DELETE FROM creators WHERE creatorID NOT IN (SELECT creatorID FROM itemCreators)";
	Zotero.DB.query(sql);
	var sql = "DELETE FROM creatorData WHERE creatorDataID NOT IN (SELECT creatorDataID FROM creators)"
	Zotero.DB.query(sql);
};

Zotero.MultiConvert.prototype.fixItemFields = function (itemID,fieldIDs,values) {
	// Clear variables and acquire an item, which is assumed to exist.
	for (var i = 0, ilen = fieldIDs.length; i < ilen; i += 1) {
		var fieldID = fieldIDs[i];
		var value = values[i];

		// Get field variants
		var multi = this.parseSerializedMultiField(value);

		// Get or create valueID
		var valueID = this.getValueIdFor(multi[0]);

		// Update the headline entry
		sql = "REPLACE INTO itemData VALUES (?,?,?)";
		Zotero.DB.query(sql, [itemID,fieldID,valueID]);

		for (var langTag in multi[1]) {
			// Get valueID
			var valueID = this.getValueIdFor(multi[1][langTag]);

			// Create multilingual entry
			sql = "INSERT INTO itemDataAlt VALUES (?,?,?,?)";
			Zotero.DB.query(sql, [itemID,fieldID,langTag,valueID]);
		}
	}
};

Zotero.MultiConvert.prototype.getValueIdFor = function(value) {
	// Get valueID
	sql = "SELECT valueID FROM itemDataValues WHERE value=?";
	var valueID = Zotero.DB.valueQuery(sql, [value]);

	// If no valueID available, create new one
	if (!valueID) {
		valueID = Zotero.ID.get('itemDataValues');
		var sql = "INSERT INTO itemDataValues VALUES (?,?)";
		Zotero.DB.query(sql, [valueID,value]);
	}
	return valueID;
}

Zotero.MultiConvert.prototype.parseServantLang = function (s) {
	// Parse the language of a multilingual creator.
	var m, o, i;
	m = s.match(/^#([0-9]{3})([0-9]{2})[-0-9a-zA-Z]+/);
	if (m) {
		i = parseInt(m[1], 10);
		o = parseInt(m[2], 10);
		var rawTag = s.slice(6, o + 6);
		if(Zotero.zlsValidator.validate(rawTag)) {
			langTag = Zotero.zlsValidator.getTag();
			return [i, langTag];
		}
		return [0, ''];
	} else {
		return [0, ''];
	}
};

// For ordinary fields
Zotero.MultiConvert.prototype.parseSerializedMultiField = function (s) {
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

			if(Zotero.zlsValidator.validate(code)) {
				langTag = Zotero.zlsValidator.getTag();
				multi[langTag] = text;
			}

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
