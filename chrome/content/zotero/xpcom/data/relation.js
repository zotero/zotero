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
    
    ***** END LICENSE BLOCK *****
*/

Zotero.Relation = function () {
	this._id = null;
	this._libraryID = null;
	this._subject = null;
	this._predicate = null;
	this._object = null;
	this._clientDateModified = null;
	
	this._loaded = false;
}

Zotero.Relation.prototype.__defineGetter__('objectType', function () 'relation');
Zotero.Relation.prototype.__defineGetter__('id', function () this._id);
Zotero.Relation.prototype.__defineSetter__('id', function (val) { this._set('id', val); });
Zotero.Relation.prototype.__defineGetter__('libraryID', function () this._get('libraryID'));
Zotero.Relation.prototype.__defineSetter__('libraryID', function (val) { return this._set('libraryID', val); });
Zotero.Relation.prototype.__defineGetter__('key', function () this._id);
//Zotero.Relation.prototype.__defineSetter__('key', function (val) { this._set('key', val) });
Zotero.Relation.prototype.__defineGetter__('dateModified', function () this._get('dateModified'));
Zotero.Relation.prototype.__defineGetter__('subject', function () this._get('subject'));
Zotero.Relation.prototype.__defineSetter__('subject', function (val) { this._set('subject', val); });
Zotero.Relation.prototype.__defineGetter__('predicate', function () this._get('predicate'));
Zotero.Relation.prototype.__defineSetter__('predicate', function (val) { this._set('predicate', val); });
Zotero.Relation.prototype.__defineGetter__('object', function () this._get('object'));
Zotero.Relation.prototype.__defineSetter__('object', function (val) { this._set('object', val); });


Zotero.Relation.prototype._get = function (field) {
	if (this._id && !this._loaded) {
		this.load();
	}
	return this['_' + field];
}


Zotero.Relation.prototype._set = function (field, val) {
	switch (field) {
		case 'id':
		case 'libraryID':
			if (field == 'libraryID' && !val) {
				throw ("libraryID cannot be empty in Zotero.Relation._set()");
			}
			
			if (val == this['_' + field]) {
				return;
			}
			
			if (this._loaded) {
				throw ("Cannot set " + field + " after object is already loaded in Zotero.Relation._set()");
			}
			this['_' + field] = val;
			return;
	}
	
	if (this.id) {
		if (!this._loaded) {
			this.load();
		}
	}
	else {
		this._loaded = true;
	}
	
	if (this['_' + field] != val) {
		//this._prepFieldChange(field);
		
		switch (field) {
			default:
				this['_' + field] = val;
		}
	}
}


/**
 * Check if search exists in the database
 *
 * @return	bool			TRUE if the relation exists, FALSE if not
 */
Zotero.Relation.prototype.exists = function () {
	if (this.id) {
		var sql = "SELECT COUNT(*) FROM relations WHERE relationID=?";
		return !!Zotero.DB.valueQuery(sql, this.id);
	}
	
	if (this.libraryID && this.subject && this.predicate && this.object) {
		var sql = "SELECT COUNT(*) FROM relations WHERE libraryID=? AND "
					+ "subject=? AND predicate=? AND object=?";
		var params = [this.libraryID, this.subject, this.predicate, this.object];
		return !!Zotero.DB.valueQuery(sql, params);
	}
	
	throw ("ID or libraryID/subject/predicate/object not set in Zotero.Relation.exists()");
}



Zotero.Relation.prototype.load = function () {
	var id = this._id;
	if (!id) {
		throw ("ID not set in Zotero.Relation.load()");
	}
	
	var sql = "SELECT * FROM relations WHERE ROWID=?";
	var row = Zotero.DB.rowQuery(sql, id);
	if (!row) {
		return;
	}
	
	this._libraryID = row.libraryID;
	this._subject = row.subject;
	this._predicate = row.predicate;
	this._object = row.object;
	this._clientDateModified = row.clientDateModified;
	this._loaded = true;
	
	return true;
}


Zotero.Relation.prototype.save = function () {
	if (this.id) {
		throw ("Existing relations cannot currently be altered in Zotero.Relation.save()");
	}
	
	if (!this.subject) {
		throw ("Missing subject in Zotero.Relation.save()");
	}
	if (!this.predicate) {
		throw ("Missing predicate in Zotero.Relation.save()");
	}
	if (!this.object) {
		throw ("Missing object in Zotero.Relation.save()");
	}
	
	Zotero.Relations.editCheck(this);
	
	var sql = "INSERT INTO relations "
				+ "(libraryID, subject, predicate, object, clientDateModified) "
				+ "VALUES (?, ?, ?, ?, ?)";
	try {
		var insertID = Zotero.DB.query(
			sql,
			[
				this.libraryID,
				this.subject,
				this.predicate,
				this.object,
				Zotero.DB.transactionDateTime
			]
		);
	}
	catch (e) {
		// If above failed, try deleting existing row, in case libraryID has changed
		Zotero.DB.beginTransaction();
		
		var sql2 = "SELECT COUNT(*) FROM relations WHERE subject=? AND predicate=? AND object=?";
		if (Zotero.DB.valueQuery(sql2, [this.subject, this.predicate, this.object])) {
			// Delete
			sql2 = "DELETE FROM relations WHERE subject=? AND predicate=? AND object=?";
			Zotero.DB.query(sql2, [this.subject, this.predicate, this.object]);
			
			// Insert with original query
			var insertID = Zotero.DB.query(
				sql,
				[
					this.libraryID,
					this.subject,
					this.predicate,
					this.object,
					Zotero.DB.transactionDateTime
				]
			);
		}
		
		Zotero.DB.commitTransaction();
	}
	return insertID;
}


Zotero.Relation.prototype.erase = function () {
	if (!this.id) {
		throw ("ID not set in Zotero.Relation.erase()");
	}
	
	Zotero.DB.beginTransaction();
	
	var deleteData = {};
	deleteData[this.id] = {
		old: this.serialize()
	}
	
	var sql = "DELETE FROM relations WHERE ROWID=?";
	Zotero.DB.query(sql, [this.id]);
	
	Zotero.DB.commitTransaction();
	
	Zotero.Notifier.trigger('delete', 'relation', [this.id], deleteData);
}


Zotero.Relation.prototype.toXML = function (doc) {
	var relationXML = doc.createElement('relation');
	relationXML.setAttribute('libraryID', this.libraryID);
	
	var elem = doc.createElement('subject');
	elem.appendChild(doc.createTextNode(this.subject));
	relationXML.appendChild(elem);
	
	var elem = doc.createElement('predicate');
	elem.appendChild(doc.createTextNode(this.predicate));
	relationXML.appendChild(elem);
	
	var elem = doc.createElement('object');
	elem.appendChild(doc.createTextNode(this.object));
	relationXML.appendChild(elem);
	
	return relationXML;
}


Zotero.Relation.prototype.serialize = function () {
	// Use a hash of the parts as the object key
	var key = Zotero.Utilities.Internal.md5(this.subject + "_" + this.predicate + "_" + this.object);
	
	var obj = {
		primary: {
			libraryID: this.libraryID,
			key: key,
		},
		fields: {
			subject: this.subject,
			predicate: this.predicate,
			object: this.object
		}
	};
	return obj;
}
