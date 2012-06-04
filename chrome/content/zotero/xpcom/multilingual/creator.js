/*
 * Container object for multilingual creator data.
 * Used in both hot Zotero items and translator data carriers.
 */

Zotero.MultiCreator = function(parent, langTag){
	this.parent = parent;
	this.main = langTag;
	this._key = {};
	this._lst = [];
};

Zotero.MultiCreator.prototype.setFields = function (fields, lang) {
	if (!lang || lang === this.main) {
		this.parent.firstName = fields.firstName;
		this.parent.lastName = fields.lastName;
		this.parent.shortName = fields.shortName;
		if ("undefined" !== typeof fields.fieldMode) {
			this.parent.fieldMode = fields.fieldMode;
		}
		if ("undefined" !== typeof fields.birthYear) {
			this.parent.birthYear = fields.birthYear;
		}
	} else {
		if (!this._key[lang]) {
			this._key[lang] = new Zotero.Creator;
			this._lst.push(lang);
		}
		this._key[lang].firstName = Zotero.MultiCreator.tidy(fields.firstName);
		this._key[lang].lastName = Zotero.MultiCreator.tidy(fields.lastName);
		this._key[lang].shortName = Zotero.MultiCreator.tidy(fields.shortName);
		if ("undefined" !== typeof fields.fieldMode) {
			this._key[lang].fieldMode = this.parent.fieldMode;
		}
		if ("undefined" !== typeof fields.birthYear) {
			this._key[lang].birthYear = this.parent.birthYear;
		}

		this._key[lang]._changed = true;
	}
    this.parent._changed = true;
}

Zotero.MultiCreator.prototype.get = function (field, langs) {
	var lang = false;
	if ("object" === typeof langs) {
		for (var i = 0, ilen = langs.length; i < ilen; i += 1) {
			if (this._key[langs[i]]) {
				lang = langs[i];
				break;
			}
		}
	} else {
		lang = langs;
	}

	if (lang 
		&& lang !== this.main 
		&& this._key[lang]
		&& (field === 'firstName' || field === 'lastName' || field === 'shortName')) {
		return this._key[lang][field];
	} else {
		return this.parent[field];
	}
};

Zotero.MultiCreator.prototype.getCreator = function (langTag) {
	if (langTag === this.main) {
		return this.parent;
	} else {
		return this._key[langTag];
	}
};


Zotero.MultiCreator.prototype.langs = function () {
	if (!this.parent._loaded) {
		this.parent.load();
	}
	return this._lst;
};


Zotero.MultiCreator.prototype.data = function () {
	return [{languageTag: this._lst[i],value: this._key[this._lst[i]]} for (i in this._lst)];
};


Zotero.MultiCreator.prototype.hasLang = function (langTag) {
	if (this.main === langTag || this._key[langTag]) {
		return true;
	}
	return false;
};


Zotero.MultiCreator.prototype.changeLangTag = function (oldTag, newTag) {
	if (this.main === newTag || this._key[newTag]) {
		throw "Attempt to change to existing language tag in creator";
	}
	if (!oldTag || oldTag === this.main) {
		this.main = newTag;
		this.parent._changed = true;
	} else if (this._key[oldTag]) {
		for (var i = 0, ilen = this._lst.length; i < ilen; i += 1) {
			if (this._lst[i] === oldTag) {
				this._lst[i] = newTag;
				break;
			}
		}
		this._key[newTag] = this._key[oldTag];
		this._key[newTag]._changed = true;
	}
};

Zotero.MultiCreator.prototype.merge = function (item, orderIndex, otherCreator, shy) {
	if (!item._changedAltCreators) {
		item._changedAltCreators = {};
	}
	if (!item._changedAltCreators[orderIndex]) {
		item._changedAltCreators[orderIndex] = {};
	}
	for (var langTag in otherCreator.multi._key) {
		if (otherCreator.multi._key[langTag].fieldMode == this.parent.fieldMode) {
			if (!shy || (shy && !this._key[langTag])) {
				var newCreator = new Zotero.Creator;
				if (this._key[langTag]) {
					var fields = {};
					fields.lastName = this._key[langTag].lastName;
					fields.firstName = this._key[langTag].firstName;
					fields.birthYear = this._key[langTag].birthYear;
					fields.fieldMode = this._key[langTag].fieldMode;
					newCreator.setFields(fields);
				}
				newCreator.setFields(otherCreator.multi._key[langTag]);
				this._key[langTag] = newCreator;
				item._changedAltCreators[orderIndex][langTag] = true;
				this.parent._changed = true;
			}
		}
	}
};

Zotero.MultiCreator.prototype.clone = function (parent, parentLang, item, orderIndex) {
	var clone = new Zotero.MultiCreator(parent, parentLang);
	if (!item._changedAltCreators) {
		item._changedAltCreators = {};
	}
	if (!item._changedAltCreators[orderIndex]) {
		item._changedAltCreators[orderIndex] = {};
	}
	clone._lst = this._lst.slice();
	for (var langTag in this._key) {
		clone._key[langTag] = new Zotero.Creator;
		clone._key[langTag].lastName = this._key[langTag].lastName;
		clone._key[langTag].firstName = this._key[langTag].firstName;
		clone._key[langTag].shortName = this._key[langTag].shortName;
		clone._key[langTag].birthYear = this._key[langTag].birthYear;
		item._changedAltCreators[orderIndex][langTag] = true;
	}
	return clone;
};


Zotero.MultiCreator.prototype.equals = function (fields, languageTag) {
	return (fields.firstName == this._key[languageTag].firstName) &&
		(fields.lastName == this._key[languageTag].lastName) &&
		(fields.shortName == this._key[languageTag].shortName);
}


// Same treatment as provided by the setter method of Zotero.Creator.
Zotero.MultiCreator.tidy = function (val) {
	if (val) {
		val = Zotero.Utilities.trim(val);
	} else {
		val = '';
	}
	return val;
}
