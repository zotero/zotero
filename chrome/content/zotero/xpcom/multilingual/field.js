/*
 * Container object for multilingual field data.
 * Used by both hot Zotero items and translator data carriers.
 * Use accessors instead of direct reads or writes to the
 * JS primitives.
 * 
 * multi.set(fieldID, value, [lang])
 *   (value can be nil, but blocks on main entry if alternatives exist)
 *
 * multi.get(fieldID, langs, honorEmpty)
 */

Zotero.MultiField = function(parent){
	this.parent = parent;
	this.main = {};
	this._keys = {};
	this._lsts = {};
};

Zotero.MultiField.prototype._set = function (fieldID, value, lang, force_top) {

	if (!fieldID) {
		Zotero.debug("MultiField.set called without specifying fieldID");
		return;
	}

	// Add or edit (if field is empty, deletion will be handled
	// in item.save())
	if (!lang || (lang === this.main[fieldID] || force_top)) {
		if (value || !this._lsts[fieldID] || !this._lsts[fieldID].length) {
			this.parent[fieldID] = value;
			if (lang && force_top) {
				this.main[fieldID] = lang;
			}
		}
	} else {
		if (!this._keys[fieldID]) {
			this._keys[fieldID] = {};
			this._lsts[fieldID] = [];
		}
		if (!this._keys[fieldID][lang]) {
			this._lsts[fieldID].push(lang);
		}
		this._keys[fieldID][lang] = value;
	}
};

Zotero.MultiField.prototype.get = function (fieldID, langs, honorEmpty) {
	var val, lang;
	if (!this.parent._itemDataLoaded) {
		this.parent._loadItemData();
	}
	fieldID = Zotero.ItemFields.getID(fieldID);
	if ("object" === typeof langs) {
		for (var i = 0, ilen = langs.length; i < ilen; i += 1) {
			if (this._keys[fieldID] && this._keys[fieldID][langs[i]]) {
				lang = langs[i];
				break;
			}
		}
	} else {
		lang = langs;
	}

	if (!lang || lang === this.main[fieldID]) {
		val = this.parent._itemData[fieldID];
	} else {
		if (this._keys[fieldID] && this._keys[fieldID][lang]) {
			val = this._keys[fieldID][lang];
		} else if (!honorEmpty) {
			val = this.parent._itemData[fieldID];
		}
	}
	return val ? val : '';
};

Zotero.MultiField.prototype.langs = function (fieldID) {
	fieldID = Zotero.ItemFields.getID(fieldID);
	if (this._lsts[fieldID]) {
		return this._lsts[fieldID];
	}
	return [];
};


Zotero.MultiField.prototype.hasLang = function (langTag, field) {
	var fieldID = Zotero.ItemFields.getID(field);
	if (this.main[fieldID] === langTag || (this._keys[fieldID] && this._keys[fieldID][langTag])) {
		return true;
	}
	return false;
};

Zotero.MultiField.prototype.changeLangTag = function (oldTag, newTag, field) {
	var fieldID = Zotero.ItemFields.getID(field);
	if (this.main[fieldID] === newTag || (this._keys[fieldID] && this._keys[fieldID][newTag])) {
		throw "Attempt to change to existing language tag in creator";
	}
	if (!oldTag || oldTag === this.main[fieldID]) {
		this.main[fieldID] = newTag;
		if (!this.parent._changedItemData) {
	   		this.parent._changedItemData = {};
	   		this.parent._changedItemData.main = {};
	   		this.parent._changedItemData.alt = {};
		}
		this.parent._changedItemData.main[fieldID] = true;
	} else if (this._keys[fieldID] && this._keys[fieldID][oldTag]) {
		for (var i = 0, ilen = this._lsts[fieldID].length; i < ilen; i += 1) {
			if (this._lsts[fieldID][i] === oldTag) {
				this._lsts[fieldID][i] = newTag;
				break;
			}
		}
		this._keys[fieldID][newTag] = this._keys[fieldID][oldTag];
		this._keys[fieldID][oldTag] = '';
		if (!this.parent._changedItemData) {
	   		this.parent._changedItemData = {};
	   		this.parent._changedItemData.main = {};
	   		this.parent._changedItemData.alt = {};
		}
		this.parent._changedItemData.alt[fieldID] = true;
	}
};

Zotero.MultiField.prototype.merge = function (otherItem, shy) {
	for (var fieldID in otherItem.multi._keys) {
		if (!this.parent._itemData[fieldID]) {
			continue;
		}
		if (!this._lsts[fieldID]) {
			this._lsts[fieldID] = [];
			this._keys[fieldID] = {};
		}
		for (var langTag in otherItem.multi._keys[fieldID]) {
			if (!shy || (shy && !this._keys[fieldID][langTag])) {
				if (!this._lsts[fieldID].indexOf(langTag) === -1) {
					this._lsts[fieldID].push(langTag);
				}
				if (this._keys[fieldID][langTag] != otherItem.multi._keys[fieldID][langTag]) {
					if (!this.parent._changedItemData) {
						this.parent._changedItemData = {};
	   					this.parent._changedItemData.main = {};
	   					this.parent._changedItemData.alt = {};
					}
					this._keys[fieldID][langTag] = otherItem.multi._keys[fieldID][langTag];
					this.parent._changedItemData.alt[fieldID] = true;
					this.parent._changed = true;
				}
			}
		}
	}
}

Zotero.MultiField.prototype.data = function (fieldID) {
	var fieldID = Zotero.ItemFields.getID(fieldID);
	return [{languageTag: this._lsts[fieldID][i],value: this._keys[fieldID][this._lsts[fieldID][i]]} for (i in this._lsts[fieldID])];
};


Zotero.MultiField.prototype.clone = function (parent) {
	var clone = new Zotero.MultiField(parent);
	if (!clone.parent._changedItemData) {
		clone.parent._changedItemData = {};
	   	clone.parent._changedItemData.main = {};
	   	clone.parent._changedItemData.alt = {};
	}
	for (var fieldID in this._lsts) {
		clone._lsts[fieldID] = this._lsts[fieldID].slice();
	}
	for (var fieldID in this._keys) {
		clone._keys[fieldID] = {};
		for (var langTag in this._keys[fieldID]) {
			clone._keys[fieldID][langTag] = this._keys[fieldID][langTag];
			clone.parent._changedItemData.alt[fieldID] = true;
		}
	}
	return clone;
};
