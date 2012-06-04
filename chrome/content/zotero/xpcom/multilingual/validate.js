// XXXZ Some changes needed to move to a new, purely
// tables-based data model suitable for syncing.
//
// - Add three tables
//   o creatorsMulti (reference table)
//   o fieldsMulti (reference table)
//   o languageTagData (data table)
//
// - Treat languageTagData as a pool of pre-validated
//   tags in Zotero.ZlsValidator() (i.e. return
//   ASAP with proper values in the validator
//   if the tag is known (not required, but might
//   save a few cycles).
//
// - Provide a method for purging unused language
//   tags, and invoke it where unused creators
//   are purged, which should be safe.
//
// - Provide utility methods for retrieval and
//   storage, as needed to support the UI.
// 
// - Set up a mapping layer for 639-2 tags not
//   known to IANA Language Subtag Registry.

Zotero.ZlsValidator = function () {
	this._cache = {};

	this.getTag = function () {
		return [Zotero.zlsValidator.tagdata[i].subtag for (i in Zotero.zlsValidator.tagdata)].join("-");
	}

	this.validate = function (tag) {
		Zotero.debug("Zotero.ZlsValidator.validate:", 3);
		this.tag = tag;
		this.tagdata = false;
		this.remnant = [];
		if (this._cache[tag]) {
			this.tagdata = this._cache[tag];
			Zotero.debug("Tagdata from cache:", 3);
			Zotero.debug(this.tagdata, 3);
			return true;
		}
		
		try {
			this.getPrimary();
			this.getScript();
			this.getRegion();
			// Need to use a loop here, but it must
			// always terminate, even if unmatched
			// items remain. Loop within getVariant()
			// itself seems safest.
			this.getVariant();
			this._cache[tag] = this.tagdata;
			return true;
		} catch (e) {
			Zotero.debug("Language tag validation failed: "+e);
			return false;
		}
	};

	this.getPrimary = function () {
		var primary_subtag = false, invalid = false;
		var grandpaws = [
			"en-GB-oed","i-ami","i-bnn","i-default","i-enochian","i-hak",
			"i-klingon","i-lux","i-mingo","i-navajo","i-pwn","i-tao","i-tay",
			"i-tsu","sgn-BE-FR","sgn-BE-NL","sgn-CH-DE","art-lojban",
			"cel-gaulish","no-bok","no-nyn","zh-guoyu","zh-hakka","zh-min",
			"zh-min-nan","zh-xiang"
		];
		for (var i = 0, ilen = grandpaws.length; i < ilen; i += 1) {
			if (this.tag.slice(0,grandpaws[i].length).toLowerCase()===grandpaws[i].toLowerCase()) {
				primary_subtag = grandpaws[i];
				var frag = this.tag.slice(grandpaws[i].length);
				if (frag.length === 0) {
					this.remnant = [];
				} else if (frag.slice(0,1) === "-") {
					this.remnant = frag.slice(1).split("-");
				} else {
					throw "Invalid primary language tag (corrupt grandfathered stub)";
				}
				break;
			}
		}
		if (!primary_subtag) {
			this.remnant = this.tag.split("-");
			if (this.remnant.length && this.remnant[0]) {
				this.remnant[0] = this.remnant[0].toLowerCase();
				// Fix up ISO 639-2 codes that may not appear in
				// the IANA Subtag Registry.  Fault reported by
				// Avram Lyon in connection with MARC translators.
				//
				// Need to continue processing for script tags
				// pointed out by Florian Ziche.
				var sql = 'SELECT iana FROM isoTagMap WHERE iso=?';
				var res = Zotero.DB.valueQuery(sql, [this.remnant[0]]);
				if (res) {
					this.remnant[0] = res;
				}
				var testlen = this.remnant[0].length;
			}
			this.testPrimary(2);
			while (this.testPrimary(3)) {
				// ZZZ Nothing to see here
			};
		};
		if (!this.tagdata) {
			throw "Invalid primary language tag (no conformant tag found in first position)";
		};
		return this.tagdata;
	};

	/*
	 * Take a number representing a required tag length (2 or 3, by the
	 * current standard) as argument.
	 * 
	 * Return true if a valid tag is found 
	 */
	this.testPrimary = function(len) {
		var primary_subtag;
		if (!this.remnant.length) {
			return false;
		}
		primary_subtag = this.remnant[0];
		if (primary_subtag.match(/^[0-9]{3}$/)) {
			return false;
		}
		if (primary_subtag.length === len) {
			this.checkPrimarySql(primary_subtag);
			if (this.tagdata) {
				this.remnant = this.remnant.slice(1);
				return true;
			} else {
				return false;
			}
		} else {
			return false;
		}
	};

	/*
	 * Take a string representing a subtag as argument.
	 * 
	 * Set the subtag object as the first-position value in
	 * self.tagdata if found.  Otherwise, set self.tagdata
	 * to false.
	 */
	this.checkPrimarySql = function (primary) {
		var sql = 'SELECT TA.value AS subtag, D.value AS description FROM zlsSubtags S '
			+ 'LEFT JOIN zlsSubTagData TA ON S.subtag=TA.id '
			+ 'LEFT JOIN zlsSubtagData TY ON S.type=TY.id '
			+ 'LEFT JOIN zlsSubtagData D ON S.description=D.id '
			+ 'LEFT JOIN zlsSubtagData SC ON S.scope=SC.id '
			+ 'WHERE TA.value=? '
			+ 'AND TY.value=? '
			+ 'AND ('
			+ 'S.scope IS NULL '
			+ 'OR NOT SC.value=?'
			+ ')';
		var res = Zotero.DB.rowQuery(sql, [primary,'language','collection']);
		if (res) {
			res.type = 'primary';
			this.tagdata = [res];
		} else {
			this.tagdata = false;
		}
	};

	this.getScript = function () {
		if (!this.remnant.length) {
			return;
		}
		this.remnant[0] = this.remnant[0][0].toUpperCase() + this.remnant[0].slice(1).toLowerCase();
		var sql = 'SELECT TA.value AS subtag, D.value AS description FROM zlsSubtags S '
			+ 'LEFT JOIN zlsSubTagData TA ON S.subtag=TA.id '
			+ 'LEFT JOIN zlsSubTagData TY ON S.type=TY.id '
			+ 'LEFT JOIN zlsSubTagData D ON S.description=D.id '
			+ 'WHERE TY.value=? AND TA.value=?';
		var res = Zotero.DB.rowQuery(sql,['script',this.remnant[0]]);
		if (res) {
			res.type = 'script';
			this.tagdata.push(res);
			this.remnant = this.remnant.slice(1);
		};
	};


	this.getRegion = function () {
		if (!this.remnant.length) {
			return;
		}
		this.remnant[0] = this.remnant[0].toUpperCase();
		var sql = 'SELECT TA.value AS subtag, D.value AS description FROM zlsSubtags S '
			+ 'LEFT JOIN zlsSubTagData TA ON S.subtag=TA.id '
			+ 'LEFT JOIN zlsSubTagData TY ON S.type=TY.id '
			+ 'LEFT JOIN zlsSubTagData D ON S.description=D.id '
			+ 'WHERE TY.value=? AND TA.value=?';
		var res = Zotero.DB.rowQuery(sql,['region',this.remnant[0]]);
		if (res) {
			res.type = 'region';
			this.tagdata.push(res);
			this.remnant = this.remnant.slice(1);
		}
	};


	this.getVariant = function () {
		if (!this.remnant.length) {
			return;
		}
		// This will cause a small amount of thrashing when invalid
		// tags interfere with further processing. The overhead is
		// probably acceptable, though.
		for (var i = 0, ilen = this.remnant.length; i < ilen; i += 1) {
			this._getVariant();
		}
	};
	
	this._getVariant = function () {
		var myprefix = [];
		for (var i = 0, ilen = this.tagdata.length; i < ilen; i += 1) {
			if (this.tagdata[i].type === 'variant') {
				if (this.tagdata[i].subtag.toLowerCase() === this.remnant[0].toLowerCase()) {
					throw "Repeat use of variant subtag";
				}
			}
			// If relaxing of prefix restraint works out well, we won't
			// need to do this.
			if (this.tagdata[i].type !== 'region') {
				myprefix.push(this.tagdata[i].subtag);
			}
		}
		myprefix = myprefix.join("-");
		this.remnant[0] = this.remnant[0].toLowerCase();
		var sql = 'SELECT TA.value AS subtag, D.value AS description FROM zlsSubtags S '
			+ 'LEFT JOIN zlsSubTagData TA ON S.subtag=TA.id '
			+ 'LEFT JOIN zlsSubTagData TY ON S.type=TY.id '
			+ 'LEFT JOIN zlsSubTagData PR ON S.prefix=PR.id '
			+ 'LEFT JOIN zlsSubTagData D ON S.description=D.id '
			+ 'WHERE TY.value=? AND TA.value=?';
			// Releasing prefix restraint to align this with UI menus
			// + 'WHERE TY.value=? AND TA.value=? AND (S.prefix IS NULL OR PR.value=?)';
		var res = Zotero.DB.rowQuery(sql,['variant',this.remnant[0]]);		
		if (res) {
			res.type = 'variant';
			this.tagdata.push(res);
			this.remnant = this.remnant.slice(1);
		};
	};
};

Zotero.zlsValidator = new Zotero.ZlsValidator;
