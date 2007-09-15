/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/

/*
 * Constructor for Item object
 *
 * Generally should be called through Zotero.Items rather than directly
 */
Zotero.Item = function(itemTypeOrID){
	this._init(itemTypeOrID);
	
	if (itemTypeOrID) {
		this._changed.set('itemTypeID');
	}
}

Zotero.Item.prototype._init = function(itemTypeOrID, create) {
	//
	// These members are public so that they can be accessed by public methods
	// -- do not access directly
	//
	this._data = {};
	this.isPrimaryField('itemID'); // make sure primary field hash array exists
	for (var field in Zotero.Item.primaryFields) {
		this._data[field] = null;
	}
	
	this._creators = [];
	this._itemData = null;
	
	if (itemTypeOrID) {
		// setType initializes type-specific properties in this._itemData
		this.setType(Zotero.ItemTypes.getID(itemTypeOrID), true);
	}
	
	this._creatorsLoaded = false;
	this._itemDataLoaded = false;
	
	this._changed = new Zotero.Hash();
	this._changedCreators = new Zotero.Hash();
	this._changedItemData = new Zotero.Hash();
	
	this._preChangeArray = null;
	
	this._noteTitle = null;
	this._noteText = null;
	this._noteAccessTime = null;
	
	this._fileLinkMode = null;
}


//////////////////////////////////////////////////////////////////////////////
//
// Public Zotero.Item methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Check if the specified field is a primary field from the items table
 */
Zotero.Item.prototype.isPrimaryField = function(field){
	// Create primaryFields hash array if not yet created
	if (!Zotero.Item.primaryFields){
		Zotero.Item.primaryFields = Zotero.DB.getColumnHash('items');
		Zotero.Item.primaryFields['firstCreator'] = true;
		Zotero.Item.primaryFields['numNotes'] = true;
		Zotero.Item.primaryFields['numAttachments'] = true;
	}
	
	return !!Zotero.Item.primaryFields[field];
}

/*
 * Build object from database
 */
Zotero.Item.prototype.loadFromID = function(id) {
	var columns = [], join = [], where = [];
	for (var field in Zotero.Item.primaryFields) {
		var colSQL = null, joinSQL = null, whereSQL = null;
		// If field not already set
		if (this._data[field] === null) {
			// Parts should be the same as query in Zotero.Items._load, just
			// without itemID clause
			switch (field) {
				case 'itemTypeID':
				case 'dateAdded':
				case 'dateModified':
					colSQL = 'I.' + field;
					break;
				
				case 'firstCreator':
					colSQL = Zotero.Items.getfirstCreatorSQL();
					break;
					
				case 'numNotes':
					colSQL = '(SELECT COUNT(*) FROM itemNotes '
						+ 'WHERE sourceItemID=I.itemID) AS numNotes';
					break;
					
				case 'numAttachments':
					colSQL = '(SELECT COUNT(*) FROM itemAttachments '
						+ 'WHERE sourceItemID=I.itemID) AS numAttachments';
					break;
			}
			if (colSQL) {
				columns.push(colSQL);
			}
			if (joinSQL) {
				join.push(joinSQL);
			}
			if (whereSQL) {
				where.push(whereSQL);
			}
		}
	}
	
	var sql = 'SELECT I.itemID' + (columns.length ? ', ' + columns.join(', ') : '')
		+ " FROM items I " + (join.length ? join.join(' ') + ' ' : '')
		+ "WHERE I.itemID=" + id + (where.length ? ' AND ' + where.join(' AND ') : '');
	var row = Zotero.DB.rowQuery(sql);
	this.loadFromRow(row);
}


/*
 * Populate basic item data from a database row
 */
Zotero.Item.prototype.loadFromRow = function(row, reload) {
	// If necessary or reloading, set the type, initialize this._itemData,
	// and reset _itemDataLoaded
	if (reload || (!this.getType() && row['itemTypeID'])) {
		this.setType(row['itemTypeID'], true);
	}
	
	// This is a quick hack to reset the creators on reload --
	// there's probably a better place for this
	this._creatorsLoaded = false;
	this._changedCreators = new Zotero.Hash();
	this._creators = [];
	
	for (var col in row){
		// Only accept primary field data through loadFromRow()
		if (this.isPrimaryField(col)){
			//Zotero.debug('Setting field ' + col + ' for item ' + this.getID());
			this._data[col] = row[col] ? row[col] : false;
		}
		else {
			Zotero.debug(col + ' is not a valid primary field');
		}
	}
}


/*
 * Check if any data fields have changed since last save
 */
Zotero.Item.prototype.hasChanged = function(){
	return (this._changed.length || this._changedCreators.length ||
		this._changedItemData.length);
}


Zotero.Item.prototype.getID = function(){
	return this._data['itemID'] ? this._data['itemID'] : false;
}


Zotero.Item.prototype.getType = function(){
	return this._data['itemTypeID'] ? this._data['itemTypeID'] : false;
}


/*
 * Set or change the item's type
 */
Zotero.Item.prototype.setType = function(itemTypeID, loadIn) {
	if (itemTypeID==this.getType()){
		return true;
	}
	
	// If there's an existing type
	if (this.getType()){
		var copiedFields = [];
		
		var obsoleteFields = this.getFieldsNotInType(itemTypeID);
		if (obsoleteFields) {
			for each(var oldFieldID in obsoleteFields) {
				// Try to get a base type for this field
				var baseFieldID =
					Zotero.ItemFields.getBaseIDFromTypeAndField(this.getType(), oldFieldID);
				
				if (baseFieldID) {
					var newFieldID =
						Zotero.ItemFields.getFieldIDFromTypeAndBase(itemTypeID, baseFieldID);
						
					// If so, save value to copy to new field
					if (newFieldID) {
						copiedFields.push([newFieldID, this.getField(oldFieldID)]);
					}
				}
				
				// Clear old field
				this.setField(oldFieldID, false);
			}
		}
		
		if (!loadIn) {
			for (var fieldID in this._itemData) {
				if (this._itemData[fieldID] &&
						(!obsoleteFields || obsoleteFields.indexOf(fieldID) == -1)) {
					copiedFields.push([fieldID, this.getField(fieldID)]);
				}
			}
		}
		
		// And reset custom creator types to the default
		var creators = this.getCreators();
		if (creators){
			for (var i in creators){
				if (!Zotero.CreatorTypes.isValidForItemType(creators[i].creatorTypeID, itemTypeID))
				{
					// Reset to contributor (creatorTypeID 2), which exists in all
					this.setCreator(i, creators[i].firstName,
						creators[i].lastName, 2, creators[i].fieldMode);
				}
			}
		}
	}
	
	this._data['itemTypeID'] = itemTypeID;
	
	// Initialize this._itemData with type-specific fields
	this._itemData = {};
	var fields = Zotero.ItemFields.getItemTypeFields(itemTypeID);
	for each(var fieldID in fields) {
		this._itemData[fieldID] = null;
	}
	
	if (copiedFields) {
		for each(var f in copiedFields) {
			this.setField(f[0], f[1]);
		}
	}
	
	if (loadIn) {
		this._itemDataLoaded = false;
	}
	else {
		this._changed.set('itemTypeID');
	}
	
	return true;
}


/*
 * Find existing fields from current type that aren't in another
 *
 * If _allowBaseConversion_, don't return fields that can be converted
 * via base fields (e.g. label => publisher => studio)
 */
Zotero.Item.prototype.getFieldsNotInType = function (itemTypeID, allowBaseConversion) {
	var sql = "SELECT fieldID FROM itemTypeFields WHERE itemTypeID=?1 AND "
		+ "fieldID IN (SELECT fieldID FROM itemData WHERE itemID=?2) AND "
		+ "fieldID NOT IN (SELECT fieldID FROM itemTypeFields WHERE itemTypeID=?3)";
		
	if (allowBaseConversion) {
		// Not the type-specific field for a base field in the new type
		sql += " AND fieldID NOT IN (SELECT fieldID FROM baseFieldMappings "
			+ "WHERE itemTypeID=?1 AND baseFieldID IN "
			+ "(SELECT fieldID FROM itemTypeFields WHERE itemTypeID=?3)) AND ";
		// And not a base field with a type-specific field in the new type
		sql += "fieldID NOT IN (SELECT baseFieldID FROM baseFieldMappings "
			+ "WHERE itemTypeID=?3) AND ";
		// And not the type-specific field for a base field that has
		// a type-specific field in the new type
		sql += "fieldID NOT IN (SELECT fieldID FROM baseFieldMappings "
			+ "WHERE itemTypeID=?1 AND baseFieldID IN "
			+ "(SELECT baseFieldID FROM baseFieldMappings WHERE itemTypeID=?3))";
	}
	
	return Zotero.DB.columnQuery(sql, [this.getType(), this.getID(), {int: itemTypeID}]);
}


/**
* Return an array of collectionIDs for all collections the item belongs to
**/
Zotero.Item.prototype.getCollections = function(){
	return Zotero.DB.columnQuery("SELECT collectionID FROM collectionItems "
		+ "WHERE itemID=" + this.getID());
}


/**
* Determine whether the item belongs to a given collectionID
**/
Zotero.Item.prototype.inCollection = function(collectionID){
	return !!parseInt(Zotero.DB.valueQuery("SELECT COUNT(*) "
		+ "FROM collectionItems WHERE collectionID=" + collectionID + " AND "
		+ "itemID=" + this.getID()));
}


/*
 * Returns the number of creators for this item
 */
Zotero.Item.prototype.numCreators = function(){
	if (this.getID() && !this._creatorsLoaded){
		this._loadCreators();
	}
	return this._creators.length;
}


Zotero.Item.prototype.hasCreatorAt = function(pos){
	if (this.getID() && !this._creatorsLoaded){
		this._loadCreators();
	}
	
	return !!this._creators[pos];
}


/*
 * Returns an array of the creator data at the given position, or false if none
 *
 * Note: Creator data array is returned by reference
 */
Zotero.Item.prototype.getCreator = function(pos){
	if (this.getID() && !this._creatorsLoaded){
		this._loadCreators();
	}
	
	return this._creators[pos] ? this._creators[pos] : false;
}


/*
 * Returns a multidimensional array of creators, or an empty array if none
 *
 * Note: Creator data array is returned by reference
 */
Zotero.Item.prototype.getCreators = function(){
	if (this.getID() && !this._creatorsLoaded){
		this._loadCreators();
	}
	
	var creators = [];
	for (var i=0; i<this._creators.length; i++){
		creators.push(this.getCreator(i));
	}
	return creators;
}


/*
 * Set or update the creator at the specified position
 *
 * _orderIndex_: the position of this creator in the item (from 0)
 * _creatorTypeID_: id or type name
 * _fieldMode_: 0 for double-field, 1 for single-field mode (default 0)
 *
 * If fieldMode==1, _firstName_ is ignored
 */
Zotero.Item.prototype.setCreator = function(orderIndex, firstName, lastName, creatorTypeID, fieldMode){
	if (this.getID() && !this._creatorsLoaded){
		this._loadCreators();
	}
	
	// Default to double-field mode if not specified
	if (!fieldMode){
		fieldMode = 0;
	}
	
	if (fieldMode==1 || !firstName){
		firstName = '';
	}
	
	if (!lastName){
		lastName = '';
	}
	
	creatorTypeID = Zotero.CreatorTypes.getID(creatorTypeID);
	
	// If creator at this position hasn't changed, cancel
	if (this._creators[orderIndex] &&
		this._creators[orderIndex]['firstName']==firstName &&
		this._creators[orderIndex]['lastName']==lastName &&
		this._creators[orderIndex]['creatorTypeID']==creatorTypeID &&
		this._creators[orderIndex]['fieldMode']==fieldMode){
		return false;
	}
	
	if (!creatorTypeID){
		creatorTypeID = 1;
	}
	
	var creator = {
		firstName: firstName,
		lastName: lastName,
		creatorTypeID: creatorTypeID,
		fieldMode: fieldMode
	}
	
	this._creators[orderIndex] = creator;
	this._changedCreators.set(orderIndex);
	return true;
}


/*
 * Remove a creator and shift others down
 */
Zotero.Item.prototype.removeCreator = function(orderIndex){
	if (this.getID() && !this._creatorsLoaded){
		this._loadCreators();
	}
	
	if (!this._creators[orderIndex]){
		throw ('No creator exists at position ' + orderIndex);
	}
	this._creators[orderIndex] = false;
	
	// Shift creator orderIndexes down, going to length+1 so we clear the last one
	for (var i=orderIndex, max=this._creators.length+1; i<max; i++){
		var next = this._creators[i+1] ? this._creators[i+1] : false;
		if (next) {
			this._creators[i] = next;
		}
		else {
			delete this._creators[i];
		}
		this._changedCreators.set(i);
	}
	return true;
}


// Currently unused
Zotero.Item.prototype.creatorExists = function(firstName, lastName, creatorTypeID, fieldMode, skipIndex){
	if (fieldMode==1 || !firstName){
		firstName = '';
	}
	
	if (!lastName){
		lastName = '';
	}
	
	for (var j=0, len=this.numCreators(); j<len; j++){
		if (typeof skipIndex!='undefined' && skipIndex==j){
			continue;
		}
		
		var creator2 = this.getCreator(j);
		
		if (firstName==creator2['firstName'] &&
			lastName==creator2['lastName'] &&
			creatorTypeID==creator2['creatorTypeID'] &&
			fieldMode==creator2['fieldMode']){
			return true;
		}
	}
	return false;
}


/*
 * Retrieves (and loads from DB, if necessary) an itemData field value
 *
 * Field can be passed as fieldID or fieldName
 *
 * If |unformatted| is true, skip any special processing of DB value
 *		(e.g. multipart date field) (default false)
 *
 * If |includeBaseMapped| is true and field is a base field, returns value of
 * 		type-specific field instead (e.g. 'label' for 'publisher' in 'audioRecording')
 */
Zotero.Item.prototype.getField = function(field, unformatted, includeBaseMapped) {
	//Zotero.debug('Requesting field ' + field + ' for item ' + this.getID(), 4);
	if (this.isPrimaryField(field)){
		if (this.getID() && this._data[field] === null) {
			this.loadFromID(this.getID());
		}
		//Zotero.debug('Returning ' + (this._data[field] ? this._data[field] : ''));
		return this._data[field] ? this._data[field] : '';
	}
	
	if (this.isNote()) {
		switch (Zotero.ItemFields.getName(field)) {
			case 'title':
				return this.getNoteTitle();
				
			default:
				return '';
		}
	}
	
	if (includeBaseMapped) {
		var fieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(
			this.getType(), field
		);
	}
	
	if (!fieldID) {
		var fieldID = Zotero.ItemFields.getID(field);
	}
	
	if (typeof this._itemData[fieldID] == 'undefined') {
		//Zotero.debug('Returning blank for ' + field + ' in ' + this.getType());
		return '';
	}
	
	if (this.getID() && this._itemData[fieldID] === null && !this._itemDataLoaded) {
		this._loadItemData();
	}
	
	var value = this._itemData[fieldID] ? this._itemData[fieldID] : '';
	
	if (!unformatted){
		// Multipart date fields
		if (Zotero.ItemFields.isFieldOfBase(fieldID, 'date')) {
			value = Zotero.Date.multipartToStr(value);
		}
	}
	//Zotero.debug('Returning ' + value);
	return value;
}


/*
 * Set a field value, loading existing itemData first if necessary
 *
 * Field can be passed as fieldID or fieldName
 */
Zotero.Item.prototype.setField = function(field, value, loadIn){
	if (!field){
		throw ("Field not specified in Item.setField()");
	}
	
	// Primary field
	if (this.isPrimaryField(field)){
		throw ('Primary field ' + field + ' cannot be changed through setField');
	}
	
	if (!this.getType()){
		throw ('Item type must be set before setting field data.');
	}
	
	// If existing item, load field data first unless we're already in
	// the middle of a load
	if (this.getID() && !loadIn && !this._itemDataLoaded) {
		this._loadItemData();
	}
	
	var fieldID = Zotero.ItemFields.getID(field);
	
	if (!fieldID){
		throw ('"' + field + '" is not a valid itemData field.');
	}
	
	if (loadIn && this.isNote() && field == 110) { // title
		this._noteTitle = value;
		return true;
	}
	
	if (!Zotero.ItemFields.isValidForType(fieldID, this.getType())){
		throw ('"' + field + "' is not a valid field for type " + this.getType());
	}
	
	if (!loadIn){
		// Save date field as multipart date
		if (Zotero.ItemFields.isFieldOfBase(fieldID, 'date') &&
				!Zotero.Date.isMultipart(value)) {
			value = Zotero.Date.strToMultipart(value);
		}
		// Validate access date
		else if (fieldID == Zotero.ItemFields.getID('accessDate')) {
			if (value && (!Zotero.Date.isSQLDate(value) &&
					!Zotero.Date.isSQLDateTime(value) &&
					value != 'CURRENT_TIMESTAMP')) {
				Zotero.debug("Discarding invalid accessDate '" + value
					+ "' in Item.setField()");
				return false;
			}
		}
		
		// If existing value, make sure it's actually changing
		if ((!this._itemData[fieldID] && !value) ||
				(this._itemData[fieldID] && this._itemData[fieldID]==value)) {
			return false;
		}
		
		// Save a copy of the object before modifying
		if (!this._preChangeArray) {
			this._preChangeArray = this.toArray();
		}
	}
	
	this._itemData[fieldID] = value;
	
	if (!loadIn) {
		this._changedItemData.set(fieldID);
	}
	return true;
}


/*
 * Save changes back to database
 *
 * Returns true on item update or itemID of new item
 */
Zotero.Item.prototype.save = function(){
	if (!this.hasChanged()){
		Zotero.debug('Item ' + this.getID() + ' has not changed', 4);
		return false;
	}
	
	// Make sure there are no gaps in the creator indexes
	var creators = this.getCreators();
	for (var i=0; i<creators.length; i++){
		if (!creators[i] || (!creators[i].firstName && !creators[i].lastName)){
			var lastCreator = true;
			continue;
		}
		if (lastCreator){
			throw("Creator indices not contiguous or don't start at 0");
		}
	}
	
	//
	// Existing item, update
	//
	if (this.getID()){
		Zotero.debug('Updating database with new item data', 4);
		
		var itemID = this.getID();
		
		try {
			Zotero.DB.beginTransaction();
			
			// Begin history transaction
			Zotero.History.begin('modify-item', this.getID());
			
			//
			// Primary fields
			//
			Zotero.History.modify('items', 'itemID', this.getID());
			
			var sql = "UPDATE items SET ";
			var sql2;
			var sqlValues = [];
			
			if (this._changed.has('itemTypeID')){
				sql += "itemTypeID=?, ";
				sqlValues.push({'int':this.getField('itemTypeID')});
			}
			
			// Always update modified time
			sql += "dateModified=CURRENT_TIMESTAMP ";
			sql += "WHERE itemID=?";
			sqlValues.push({'int':this.getID()});
			
			Zotero.DB.query(sql, sqlValues);
			
			//
			// Creators
			//
			if (this._changedCreators.length){
				for (orderIndex in this._changedCreators.items){
					Zotero.debug('Creator ' + orderIndex + ' has changed', 4);
					
					var creator = this.getCreator(orderIndex);
					
					// Delete at position
					Zotero.History.remove('itemCreators', 'itemID-orderIndex',
						[this.getID(), orderIndex]);
					
					sql2 = 'DELETE FROM itemCreators'
						+ ' WHERE itemID=' + this.getID()
						+ ' AND orderIndex=' + orderIndex;
					Zotero.DB.query(sql2);
					
					// If empty, move on
					if (!creator['firstName'] && !creator['lastName']){
						continue;
					}
					
					// See if this is an existing creator
					var creatorID = Zotero.Creators.getID(
							creator['firstName'],
							creator['lastName'],
							creator['fieldMode']
					);
					
					// If not, add it
					if (!creatorID){
						creatorID = Zotero.Creators.add(
							creator['firstName'],
							creator['lastName'],
							creator['fieldMode']
						);
						Zotero.History.add('creators', 'creatorID', creatorID);
					}
					
					sql = "INSERT INTO itemCreators VALUES (?,?,?,?)";
					
					sqlValues = [
						{'int':itemID},
						{'int':creatorID},
						{'int':creator['creatorTypeID']},
						{'int':orderIndex}
					];
					
					Zotero.DB.query(sql, sqlValues);
					
					Zotero.History.add('itemCreators',
						'itemID-creatorID-creatorTypeID',
						[this.getID(), creatorID, creator['creatorTypeID']]);
				}
			}
			
			
			//
			// ItemData
			//
			if (this._changedItemData.length){
				var del = new Array();
				
				sql = "SELECT valueID FROM itemDataValues WHERE value=?";
				var valueStatement = Zotero.DB.getStatement(sql);
				
				sql = "INSERT INTO itemDataValues VALUES (?,?)";
				var insertStatement = Zotero.DB.getStatement(sql);
				
				sql = "REPLACE INTO itemData VALUES (?,?,?)";
				var replaceStatement = Zotero.DB.getStatement(sql);
				
				for (fieldID in this._changedItemData.items){
					var value = this.getField(fieldID, true);
					if (value) {
						// Field exists
						if (this._preChangeArray[Zotero.ItemFields.getName(fieldID)]) {
							Zotero.History.modify('itemData', 'itemID-fieldID',
								[this.getID(), fieldID]);
						}
						// Field is new
						else {
							Zotero.History.add('itemData', 'itemID-fieldID',
								[this.getID(), fieldID]);
						}
						
						valueStatement.bindUTF8StringParameter(0, value);
						if (valueStatement.executeStep()) {
							var valueID = valueStatement.getInt32(0);
						}
						else {
							var valueID = null;
						}
						valueStatement.reset();
						
						if (!valueID) {
							valueID = Zotero.getRandomID('itemDataValues', 'valueID', 2097152); // stored in 3 bytes
							insertStatement.bindInt32Parameter(0, valueID);
							
							if (Zotero.ItemFields.getID('accessDate') == fieldID
									&& this.getField(fieldID) == 'CURRENT_TIMESTAMP') {
								sql = "INSERT INTO itemDataValues VALUES "
									+ "(?,CURRENT_TIMESTAMP)";
								Zotero.DB.query(sql, {int: valueID});
							}
							else {
								if (Zotero.ItemFields.isInteger(fieldID)) {
									insertStatement.
										bindInt32Parameter(1, value);
								}
								else {
									insertStatement.
										bindUTF8StringParameter(1, value);
								}
								try {
									insertStatement.execute();
								}
								catch (e) {
									throw (Zotero.DB.getLastErrorString());
								}
							}
						}
						
						replaceStatement.bindInt32Parameter(0, this.getID());
						replaceStatement.bindInt32Parameter(1, fieldID);
						replaceStatement.bindInt32Parameter(2, valueID);
							
						try {
							replaceStatement.execute();
						}
						catch (e) {
							throw (Zotero.DB.getLastErrorString());
						}
					}
					
					// If field changed and is empty, mark row for deletion
					else {
						del.push(fieldID);
					}
				}
				
				insertStatement.reset();
				replaceStatement.reset();
				
				// Delete blank fields
				if (del.length){
					// Add to history
					for (var i in del){
						Zotero.History.remove('itemData', 'itemID-fieldID',
							[this.getID(), del[i]]);
					}
					
					sql = 'DELETE from itemData '
						+ 'WHERE itemID=' + this.getID() + ' '
						+ 'AND fieldID IN (' + del.join() + ")";
					Zotero.DB.query(sql);
				}
			}
			
			Zotero.History.commit();
			Zotero.DB.commitTransaction();
		}
		catch (e){
			Zotero.History.cancel();
			Zotero.DB.rollbackTransaction();
			throw(e);
		}
	}
	
	//
	// New item, insert and return id
	//
	else {
		Zotero.debug('Saving data for new item to database');
		
		var isNew = true;
		var sqlColumns = new Array();
		var sqlValues = new Array();
		
		//
		// Primary fields
		//
		sqlColumns.push('itemID');
		var itemID = Zotero.getRandomID('items', 'itemID');
		sqlValues.push(itemID);
		
		sqlColumns.push('itemTypeID');
		sqlValues.push({'int':this.getField('itemTypeID')});
		
		try {
			Zotero.DB.beginTransaction();
			
			// Begin history transaction
			// No associated id yet, so we use false
			Zotero.History.begin('add-item', false);
			
			//
			// Primary fields
			//
			var sql = "INSERT INTO items (" + sqlColumns.join() + ')'
				+ ' VALUES (';
			// Insert placeholders for bind parameters
			for (var i=0; i<sqlValues.length; i++){
				sql += '?,';
			}
			sql = sql.substring(0,sql.length-1) + ")";
			
			// Save basic data to items table
			Zotero.DB.query(sql, sqlValues);
			this._data['itemID'] = itemID;
			
			Zotero.History.setAssociatedID(itemID);
			Zotero.History.add('items', 'itemID', itemID);
			
			//
			// ItemData
			//
			if (this._changedItemData.length){
				// Use manual bound parameters to speed things up
				sql = "SELECT valueID FROM itemDataValues WHERE value=?";
				var valueStatement = Zotero.DB.getStatement(sql);
				
				sql = "INSERT INTO itemDataValues VALUES (?,?)";
				var insertValueStatement = Zotero.DB.getStatement(sql);
				
				sql = "INSERT INTO itemData VALUES (?,?,?)";
				var insertStatement = Zotero.DB.getStatement(sql);
				
				for (fieldID in this._changedItemData.items){
					var value = this.getField(fieldID, true);
					if (!value) {
						continue;
					}
					
					valueStatement.bindUTF8StringParameter(0, value);
					if (valueStatement.executeStep()) {
						var valueID = valueStatement.getInt32(0);
					}
					else {
						var valueID = null;
					}
					valueStatement.reset();
					
					if (!valueID) {
						valueID = Zotero.getRandomID('itemDataValues', 'valueID', 2097152); // stored in 3 bytes
						insertValueStatement.bindInt32Parameter(0, valueID);
						
						if (Zotero.ItemFields.getID('accessDate') == fieldID
								&& this.getField(fieldID) == 'CURRENT_TIMESTAMP') {
							sql = "INSERT INTO itemDataValues VALUES "
								+ "(?,CURRENT_TIMESTAMP)";
							Zotero.DB.query(sql, {int: valueID});
						}
						else {
							if (Zotero.ItemFields.isInteger(fieldID)) {
								insertValueStatement.
									bindInt32Parameter(1, value);
							}
							else {
								insertValueStatement.
									bindUTF8StringParameter(1, value);
							}
							try {
								insertValueStatement.execute();
							}
							catch (e) {
								throw (Zotero.DB.getLastErrorString());
							}
						}
					}
					
					insertStatement.bindInt32Parameter(0, this.getID());
					insertStatement.bindInt32Parameter(1, fieldID);
					insertStatement.bindInt32Parameter(2, valueID);
					
					try {
						insertStatement.execute();
					}
					catch(e) {
						throw(Zotero.DB.getLastErrorString());
					}
					
					Zotero.History.add('itemData', 'itemID-fieldID',
						[itemID, fieldID]);
				}
				
				insertValueStatement.reset();
				insertStatement.reset();
			}
			
			//
			// Creators
			//
			if (this._changedCreators.length){
				for (orderIndex in this._changedCreators.items){
					var creator = this.getCreator(orderIndex);
					
					// If empty, skip
					if (!creator['firstName'] && !creator['lastName']){
						continue;
					}
					
					// See if this is an existing creator
					var creatorID = Zotero.Creators.getID(
							creator['firstName'],
							creator['lastName'],
							creator['fieldMode']
					);
					
					// If not, add it
					if (!creatorID){
						creatorID = Zotero.Creators.add(
							creator['firstName'],
							creator['lastName'],
							creator['fieldMode']
						);
						Zotero.History.add('creators', 'creatorID', creatorID);
					}
					
					sql = 'INSERT INTO itemCreators VALUES ('
						+ itemID + ',' + creatorID + ','
						+ creator['creatorTypeID'] + ',' + orderIndex
						+ ")";
					Zotero.DB.query(sql);
					
					Zotero.History.add('itemCreators',
						'itemID-creatorID-creatorTypeID',
						[this.getID(), creatorID, creator['creatorTypeID']]);
				}
			}
			
			Zotero.History.commit();
			Zotero.DB.commitTransaction();
			
			// Reload collection to update isEmpty,
			// in case this was the first item in a collection
			Zotero.Collections.reloadAll();
		}
		catch (e){
			Zotero.History.cancel();
			Zotero.DB.rollbackTransaction();
			throw(e);
		}
	}
	
	Zotero.Items.reload(this.getID());
	
	if (isNew){
		Zotero.Notifier.trigger('add', 'item', this.getID());
		return this.getID();
	}
	else {
		Zotero.Notifier.trigger('modify', 'item', this.getID(), { old: this._preChangeArray });
		return true;
	}
}


Zotero.Item.prototype.updateDateModified = function(){
	Zotero.DB.query("UPDATE items SET dateModified=CURRENT_TIMESTAMP "
		+ "WHERE itemID=" + this.getID());
	var date = Zotero.DB.valueQuery("SELECT dateModified FROM items "
		+ "WHERE itemID=" + this.getID());
	this._data['dateModified'] = date;
}


Zotero.Item.prototype.isRegularItem = function(){
	return !(this.isNote() || this.isAttachment());
}


Zotero.Item.prototype.numChildren = function(){
	return this.numNotes() + this.numAttachments();
}


////////////////////////////////////////////////////////
//
// Methods dealing with note items
//
// save() is not required for note functions
//
////////////////////////////////////////////////////////
Zotero.Item.prototype.incrementNoteCount = function(){
	this._data['numNotes']++;
}


Zotero.Item.prototype.decrementNoteCount = function(){
	this._data['numNotes']--;
}


/**
* Determine if an item is a note
**/
Zotero.Item.prototype.isNote = function(){
	return Zotero.ItemTypes.getName(this.getType())=='note';
}


/**
* Update an item note
*
* Note: This can only be called on notes and attachments
**/
Zotero.Item.prototype.updateNote = function(text){
	if (!this.isNote() && !this.isAttachment()){
		throw ("updateNote() can only be called on notes and attachments");
	}
	
	if (!this.getID()){
		throw ("Cannot call updateNote() on unsaved item");
	}
	
	Zotero.DB.beginTransaction();
	
	var preItemArray = this.toArray();
	
	var title = Zotero.Notes.noteToTitle(text);
	
	if (this.isNote()){
		var sourceItemID = this.getSource();
		
		Zotero.DB.query("REPLACE INTO itemNoteTitles VALUES (?,?)",
			[this.getID(), {string: title}]);
	}
	
	if (sourceItemID)
	{
		var sql = "REPLACE INTO itemNotes VALUES (?,?,?)";
		var bindParams = [this.getID(), sourceItemID, {string:text}];
	}
	else
	{
		var sql = "REPLACE INTO itemNotes (note, itemID) VALUES (?,?)";
		var bindParams = [{string:text}, this.getID()];
	}
	
	var updated = Zotero.DB.query(sql, bindParams);
	if (updated){
		this.updateDateModified();
		Zotero.DB.commitTransaction();
		
		this._noteText = text ? text : '';
		this._noteTitle = title ? title : '';
		
		Zotero.Notifier.trigger('modify', 'item', this.getID(), { old: preItemArray });
	}
	else {
		Zotero.DB.commitTransaction();
	}
}


/*
 * Update the cached value of the note
 */
Zotero.Item.prototype.updateNoteCache = function(text, title) {
	this._noteText = text ? text : '';
	this._noteTitle = title ? title : '';
}


Zotero.Item.prototype.setSource = function(sourceItemID){
	if (this.isNote()){
		var type = 'note';
		var Type = 'Note';
	}
	else if (this.isAttachment()){
		var type = 'attachment';
		var Type = 'Attachment';
	}
	else {
		throw ("setSource() can only be called on items of type 'note' or 'attachment'");
	}
	
	if (!this.getID()){
		throw ("Cannot call setSource() on unsaved " + type);
	}
	
	Zotero.DB.beginTransaction();
	
	var preItemArray = this.toArray();
	
	var newItem = Zotero.Items.get(sourceItemID);
	// FK check
	if (newItem) {
		if (sourceItemID) {
			var preNewItemArray = newItem.toArray();
		}
		else {
			Zotero.DB.rollbackTransaction();
			throw ("Cannot set " + type + " source to invalid item " + sourceItemID);
		}
	}
	
	var oldSourceItemID = this.getSource();
	
	if (oldSourceItemID==sourceItemID){
		Zotero.debug(Type + " source hasn't changed", 4);
		Zotero.DB.commitTransaction();
		return false;
	}
	
	var oldItem = Zotero.Items.get(oldSourceItemID);
	if (oldSourceItemID && oldItem) {
		var preOldItemArray = oldItem.toArray();
	}
	else {
		var preOldItemArray = false;
		Zotero.debug("Old source item " + oldSourceItemID + "didn't exist in setSource()", 2);
	}
	
	// If this was an independent item, remove from any collections where it
	// existed previously and add source instead if there is one
	if (!oldSourceItemID){
		var sql = "SELECT collectionID FROM collectionItems WHERE itemID=?";
		var changedCollections = Zotero.DB.columnQuery(sql, this.getID());
		if (changedCollections){
			if (sourceItemID){
				var sql = "UPDATE OR REPLACE collectionItems "
					+ "SET itemID=? WHERE itemID=?";
				Zotero.DB.query(sql, [sourceItemID, this.getID()]);
			}
			else {
				var sql = "DELETE FROM collectionItems WHERE itemID=?";
				Zotero.DB.query(sql, this.getID());
			}
		}
	}
	
	var sql = "UPDATE item" + Type + "s SET sourceItemID=? WHERE itemID=?";
	var bindParams = [sourceItemID ? {int:sourceItemID} : null, this.getID()];
	Zotero.DB.query(sql, bindParams);
	this.updateDateModified();
	Zotero.DB.commitTransaction();
	
	Zotero.Notifier.trigger('modify', 'item', this.getID(), { old: preItemArray });
	
	// Update the counts of the previous and new sources
	if (oldItem){
		switch (type){
			case 'note':
				oldItem.decrementNoteCount();
				break;
			case 'attachment':
				oldItem.decrementAttachmentCount();
				break;
		}
		Zotero.Notifier.trigger('modify', 'item', oldSourceItemID, { old: preOldItemArray });
	}
	
	if (newItem){
		switch (type){
			case 'note':
				newItem.incrementNoteCount();
				break;
			case 'attachment':
				newItem.incrementAttachmentCount();
				break;
		}
		Zotero.Notifier.trigger('modify', 'item', sourceItemID, { old: preNewItemArray });
	}
	
	return true;
}


/**
* Returns number of notes in item
**/
Zotero.Item.prototype.numNotes = function(){
	if (this.isNote()){
		throw ("numNotes() cannot be called on items of type 'note'");
	}
	
	if (!this.getID()){
		return 0;
	}
	
	return this._data['numNotes'];
}


/**
* Get the first line of the note for display in the items list
**/
Zotero.Item.prototype.getNoteTitle = function(){
	if (!this.isNote() && !this.isAttachment()){
		throw ("getNoteTitle() can only be called on notes and attachments");
	}
	
	if (this._noteTitle !== null){
		return this._noteTitle;
	}
	
	var sql = "SELECT title FROM itemNoteTitles WHERE itemID=" + this.getID();
	var title = Zotero.DB.valueQuery(sql);
	
	this._noteTitle = title ? title : '';
	
	return title ? title : '';
}


/**
* Get the text of an item note
**/
Zotero.Item.prototype.getNote = function(){
	if (!this.isNote() && !this.isAttachment()){
		throw ("getNote() can only be called on notes and attachments");
	}
	
	if (!this.getID()) {
		return '';
	}
	
	// Store access time for later garbage collection
	this._noteAccessTime = new Date();
	
	if (this._noteText !== null){
		return this._noteText;
	}
	
	var sql = "SELECT note FROM itemNotes WHERE itemID=" + this.getID();
	var note = Zotero.DB.valueQuery(sql);
	
	this._noteText = note ? note : '';
	
	return note ? note : '';
}


/**
* Get the itemID of the source item for a note or file
**/
Zotero.Item.prototype.getSource = function(){
	if (!this.getID()) {
		return false;
	}
	
	if (this.isNote()){
		var Type = 'Note';
	}
	else if (this.isAttachment()){
		var Type = 'Attachment';
	}
	else {
		return false;
	}
	
	var sql = "SELECT sourceItemID FROM item" + Type + "s WHERE itemID=" + this.getID();
	return Zotero.DB.valueQuery(sql);
}


/**
* Returns an array of note itemIDs for this item
**/
Zotero.Item.prototype.getNotes = function(){
	if (this.isNote()){
		throw ("getNotes() cannot be called on items of type 'note'");
	}
	
	if (!this.getID()){
		return [];
	}
	
	var sql = "SELECT itemID FROM itemNotes NATURAL JOIN items "
		+ "WHERE sourceItemID=" + this.getID() + " ORDER BY dateAdded";
	return Zotero.DB.columnQuery(sql);
}









////////////////////////////////////////////////////////
//
// Methods dealing with attachments
//
// save() is not required for attachment functions
//
///////////////////////////////////////////////////////
Zotero.Item.prototype.incrementAttachmentCount = function(){
	this._data['numAttachments']++;
}


Zotero.Item.prototype.decrementAttachmentCount = function(){
	this._data['numAttachments']--;
}


/**
* Determine if an item is an attachment
**/
Zotero.Item.prototype.isAttachment = function(){
	return Zotero.ItemTypes.getName(this.getType())=='attachment';
}


/**
* Returns number of files in item
**/
Zotero.Item.prototype.numAttachments = function(){
	if (this.isAttachment()){
		throw ("numAttachments() cannot be called on items of type 'attachment'");
	}
	
	if (!this.getID()){
		return 0;
	}
	
	return this._data['numAttachments'];
}


/**
* Get an nsILocalFile for the attachment, or false if the associated file
* doesn't exist
*
* _row_ is optional itemAttachments row if available to skip query
*
* Note: Always returns false for items with LINK_MODE_LINKED_URL,
* since they have no files -- use getField('url') instead
**/
Zotero.Item.prototype.getFile = function(row, skipExistsCheck) {
	if (!this.isAttachment()){
		throw ("getFile() can only be called on items of type 'attachment'");
	}
	
	if (!row){
		var sql = "SELECT linkMode, path FROM itemAttachments WHERE itemID="
			+ this.getID();
		var row = Zotero.DB.rowQuery(sql);
	}
	
	if (!row){
		throw ('Attachment data not found for item ' + this.getID()
			+ ' in getFile()');
	}
	
	// No associated files for linked URLs
	if (row['linkMode']==Zotero.Attachments.LINK_MODE_LINKED_URL){
		return false;
	}
	
	var file = Components.classes["@mozilla.org/file/local;1"].
		createInstance(Components.interfaces.nsILocalFile);
	
	if (row['linkMode']==Zotero.Attachments.LINK_MODE_IMPORTED_URL ||
			row['linkMode']==Zotero.Attachments.LINK_MODE_IMPORTED_FILE){
		try {
			var storageDir = Zotero.getStorageDirectory();
			storageDir.QueryInterface(Components.interfaces.nsILocalFile);
			file.setRelativeDescriptor(storageDir, row['path']);
			if (!file.exists()){
				throw('Invalid relative descriptor');
			}
		}
		catch (e){
			// See if this is a persistent path
			// (deprecated for imported attachments)
			Zotero.debug('Invalid relative descriptor -- trying persistent');
			try {
				file.persistentDescriptor = row['path'];
				
				var storageDir = Zotero.getStorageDirectory();
				storageDir.QueryInterface(Components.interfaces.nsILocalFile);
				var path = file.getRelativeDescriptor(storageDir);
				
				// If valid, convert this to a relative descriptor
				if (file.exists()){
					Zotero.DB.query("UPDATE itemAttachments SET path=? WHERE itemID=?",
						[path, this.getID()]);
				}
			}
			catch (e){
				Zotero.debug('Invalid persistent descriptor');
			}
		}
	}
	else {
		try {
			file.persistentDescriptor = row['path'];
		}
		catch (e){
			// See if this is an old relative path (deprecated)
			Zotero.debug('Invalid persistent descriptor -- trying relative');
			try {
				var refDir = (row['linkMode']==this.LINK_MODE_LINKED_FILE)
					? Zotero.getZoteroDirectory() : Zotero.getStorageDirectory();
				file.setRelativeDescriptor(refDir, row['path']);
				// If valid, convert this to a persistent descriptor
				if (file.exists()){
					Zotero.DB.query("UPDATE itemAttachments SET path=? WHERE itemID=?",
						[file.persistentDescriptor, this.getID()]);
				}
			}
			catch (e){
				Zotero.debug('Invalid relative descriptor');
			}
		}
	}
	
	if (!skipExistsCheck && !file.exists()){
		return false;
	}
	
	return file;
}


/*
 * Rename file associated with an attachment
 *
 * -1   		Destination file exists -- use _force_ to overwrite
 * -2		Error renaming
 * false		Attachment file not found or other error
 */
Zotero.Item.prototype.renameAttachmentFile = function(newName, overwrite) {
	var file = this.getFile();
	if (!file) {
		return false;
	}
	
	try {
		if (file.leafName == newName) {
			return true;
		}
		
		var dest = file.parent;
		dest.append(newName);
		
		if (overwrite) {
			dest.remove(null);
		}
		else if (dest.exists()) {
			return -1;
		}
		
		file.moveTo(file.parent, newName);
		this.relinkAttachmentFile(file);
		
		return true;
	}
	catch (e) {
		return -2;
	}
}


Zotero.Item.prototype.relinkAttachmentFile = function(file) {
	var linkMode = this.getAttachmentLinkMode();
	
	if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
		throw('Cannot relink linked URL in Zotero.Items.relinkAttachmentFile()');
	}
	
	var path = Zotero.Attachments.getPath(file, linkMode);
	
	var sql = "UPDATE itemAttachments SET path=? WHERE itemID=?";
	Zotero.DB.query(sql, [path, this.getID()]);
}



/*
 * Return a file:/// URL path to files and snapshots
 */
Zotero.Item.prototype.getLocalFileURL = function(){
	if (!this.isAttachment){
		throw ("getLocalFileURL() can only be called on items of type 'attachment'");
	}
	
	var file = this.getFile();
	
	var nsIFPH = Components.classes["@mozilla.org/network/protocol;1?name=file"]
			.getService(Components.interfaces.nsIFileProtocolHandler);
	
	return nsIFPH.getURLSpecFromFile(file);
}


/**
* Get the link mode of an attachment
*
* Possible return values specified as constants in Zotero.Attachments
* (e.g. Zotero.Attachments.LINK_MODE_LINKED_FILE)
**/
Zotero.Item.prototype.getAttachmentLinkMode = function(){
	if (!this.isAttachment()){
		throw ("getAttachmentLinkMode() can only be called on items of type 'attachment'");
	}
	
	if (this._fileLinkMode !==null && this._fileLinkMode !==false){
		return this._fileLinkMode;
	}
	
	var sql = "SELECT linkMode FROM itemAttachments WHERE itemID=" + this.getID();
	this._fileLinkMode = Zotero.DB.valueQuery(sql);
	return this._fileLinkMode;
}


/**
* Get the mime type of an attachment (e.g. text/plain)
**/
Zotero.Item.prototype.getAttachmentMimeType = function(){
	if (!this.isAttachment()){
		throw ("getAttachmentMIMEType() can only be called on items of type 'attachment'");
	}
	
	var sql = "SELECT mimeType FROM itemAttachments WHERE itemID=" + this.getID();
	return Zotero.DB.valueQuery(sql);
}


/**
* Get the character set id of an attachment
**/
Zotero.Item.prototype.getAttachmentCharset = function(){
	if (!this.isAttachment()){
		throw ("getAttachmentCharset() can only be called on items of type 'attachment'");
	}
	
	var sql = "SELECT charsetID FROM itemAttachments WHERE itemID=" + this.getID();
	return Zotero.DB.valueQuery(sql);
}


/**
* Returns an array of attachment itemIDs that have this item as a source,
* or FALSE if none
**/
Zotero.Item.prototype.getAttachments = function(){
	if (this.isAttachment()){
		throw ("getAttachments() cannot be called on items of type 'attachment'");
	}
	
	if (!this.getID()){
		return [];
	}
	
	var sql = "SELECT itemID FROM itemAttachments NATURAL JOIN items "
		+ "WHERE sourceItemID=" + this.getID() + " ORDER BY dateAdded";
	return Zotero.DB.columnQuery(sql);
}


/*
 * Returns the itemID of the latest child snapshot of this item with the
 * same URL as the item itself, or false if none
 */
Zotero.Item.prototype.getBestSnapshot = function(){
	if (!this.isRegularItem()){
		throw ("getBestSnapshot() can only be called on regular items");
	}
	
	if (!this.getField('url')){
		return false;
	}
	
	var sql = "SELECT IA.itemID FROM itemAttachments IA NATURAL JOIN items I "
		+ "LEFT JOIN itemData ID ON (IA.itemID=ID.itemID AND fieldID=1) "
		+ "NATURAL JOIN ItemDataValues "
		+ "WHERE sourceItemID=? AND linkMode=? AND value=? "
		+ "ORDER BY dateAdded DESC LIMIT 1";
		
	return Zotero.DB.valueQuery(sql, [this.getID(),
		Zotero.Attachments.LINK_MODE_IMPORTED_URL, {string:this.getField('url')}]);
}


//
// Methods dealing with item tags
//
// save() is not required for tag functions
//
Zotero.Item.prototype.addTag = function(tag, type){
	if (!this.getID()){
		throw ('Cannot add tag to unsaved item in Item.addTag()');
	}
	
	if (!tag){
		Zotero.debug('Not saving empty tag in Item.addTag()', 2);
		return false;
	}
	
	if (!type) {
		type = 0;
	}
	
	if (type !=0 && type !=1) {
		throw ('Invalid tag type in Item.addTag()');
	}
	
	Zotero.DB.beginTransaction();
	var tagID = Zotero.Tags.getID(tag, type);
	var existingTypes = Zotero.Tags.getTypes(tag);
	
	if (existingTypes) {
		// If existing automatic and adding identical user, remove automatic
		if (type == 0 && existingTypes.indexOf(1) != -1) {
			this.removeTag(Zotero.Tags.getID(tag, 1));
		}
		// If existing user and adding automatic, skip
		else if (type == 1 && existingTypes.indexOf(0) != -1) {
			Zotero.debug('Identical user tag already exists -- skipping automatic tag add');
			Zotero.DB.commitTransaction();
			return false;
		}
	}
	
	if (!tagID) {
		var tagID = Zotero.Tags.add(tag, type);
	}
	
	try {
		var result = this.addTagByID(tagID);
		Zotero.DB.commitTransaction();
	}
	catch (e) {
		Zotero.DB.rollbackTransaction();
		throw (e);
	}
	
	return result ? tagID : false;
}


Zotero.Item.prototype.addTagByID = function(tagID) {
	if (!this.getID()) {
		throw ('Cannot add tag to unsaved item in Item.addTagByID()');
	}
	
	if (!tagID) {
		Zotero.debug('Not saving nonexistent tag in Item.addTagByID()', 2);
		return false;
	}
	
	var sql = "SELECT COUNT(*) FROM tags WHERE tagID = ?";
	var count = !!Zotero.DB.valueQuery(sql, tagID);
	
	if (!count) {
		throw ('Cannot add invalid tag id ' + tagID + ' in Item.addTagByID()');
	}
	
	Zotero.DB.beginTransaction();
	
	// If INSERT OR IGNORE gave us affected rows, we wouldn't need this...
	if (this.hasTag(tagID)) {
		Zotero.debug('Item ' + this.getID() + ' already has tag ' + tagID + ' in Item.addTagByID()');
		Zotero.DB.commitTransaction();
		return false;
	}
	
	var sql = "INSERT INTO itemTags VALUES (?,?)";
	Zotero.DB.query(sql, [this.getID(), tagID]);
	
	Zotero.DB.commitTransaction();
	Zotero.Notifier.trigger('modify', 'item', this.getID());
	Zotero.Notifier.trigger('add', 'item-tag', this.getID() + '-' + tagID);
	
	return true;
}

Zotero.Item.prototype.hasTag = function(tagID) {
	return this.hasTags(tagID);
}

/*
 * Returns true if the item has one or more of |tagIDs|
 *
 * |tagIDs| can be an int or array of ints
 */
Zotero.Item.prototype.hasTags = function(tagIDs) {
	var tagIDs = Zotero.flattenArguments(tagIDs);
	
	var sql = "SELECT COUNT(*) FROM itemTags WHERE itemID=? AND tagID IN (";
	var q = [];
	var p = [this.getID()];
	for each(var tagID in tagIDs) {
		q.push('?');
		p.push(tagID);
	}
	sql += q.join();
	sql += ")";
	return !!Zotero.DB.valueQuery(sql, p);
}

Zotero.Item.prototype.getTags = function(){
	if (!this.getID()) {
		return false;
	}
	var sql = "SELECT tagID AS id, tag, tagType AS type FROM tags WHERE tagID IN "
		+ "(SELECT tagID FROM itemTags WHERE itemID=" + this.getID() + ")";
	
	var tags = Zotero.DB.query(sql);
	if (!tags) {
		return false;
	}
	
	var collation = Zotero.getLocaleCollation();
	tags.sort(function(a, b) {
		return collation.compareString(1, a.tag, b.tag);
	});
	return tags;
}

Zotero.Item.prototype.getTagIDs = function(){
	var sql = "SELECT tagID FROM itemTags WHERE itemID=" + this.getID();
	return Zotero.DB.columnQuery(sql);
}

Zotero.Item.prototype.replaceTag = function(oldTagID, newTag){
	if (!this.getID()){
		throw ('Cannot replace tag on unsaved item');
	}
	
	if (!newTag){
		Zotero.debug('Not replacing with empty tag', 2);
		return false;
	}
	
	Zotero.DB.beginTransaction();
	
	var oldTag = Zotero.Tags.getName(oldTagID);
	if (oldTag==newTag){
		Zotero.DB.commitTransaction();
		return false;
	}
	
	this.removeTag(oldTagID);
	var id = this.addTag(newTag);
	Zotero.DB.commitTransaction();
	Zotero.Notifier.trigger('modify', 'item', this.getID());
	Zotero.Notifier.trigger('remove', 'item-tag', this.getID() + '-' + oldTagID);
	Zotero.Notifier.trigger('add', 'item-tag', this.getID() + '-' + id);
	return id;
}

Zotero.Item.prototype.removeTag = function(tagID){
	if (!this.getID()){
		throw ('Cannot remove tag on unsaved item');
	}
	
	Zotero.DB.beginTransaction();
	var sql = "DELETE FROM itemTags WHERE itemID=? AND tagID=?";
	Zotero.DB.query(sql, [this.getID(), tagID]);
	Zotero.Tags.purge();
	Zotero.DB.commitTransaction();
	Zotero.Notifier.trigger('modify', 'item', this.getID());
	Zotero.Notifier.trigger('remove', 'item-tag', this.getID() + '-' + tagID);
}

Zotero.Item.prototype.removeAllTags = function(){
	if (!this.getID()) {
		throw ('Cannot remove tags on unsaved item');
	}
	
	Zotero.DB.beginTransaction();
	var tagIDs = this.getTagIDs();
	if (!tagIDs) {
		Zotero.DB.commitTransaction();
		return;
	}
	
	Zotero.DB.query("DELETE FROM itemTags WHERE itemID=?", this.getID());
	Zotero.Tags.purge();
	Zotero.DB.commitTransaction();
	Zotero.Notifier.trigger('modify', 'item', this.getID());
	
	for (var i in tagIDs) {
		tagIDs[i] = this.getID() + '-' + tagIDs[i];
	}
	Zotero.Notifier.trigger('remove', 'item-tag', tagIDs);
}


//
// Methods dealing with See Also links
//
// save() is not required for See Also functions
//
Zotero.Item.prototype.addSeeAlso = function(itemID){
	if (itemID==this.getID()){
		Zotero.debug('Cannot add item as See Also of itself', 2);
		return false;
	}
	
	Zotero.DB.beginTransaction();
	
	var relatedItem = Zotero.Items.get(itemID);
	
	if (!relatedItem){
		Zotero.DB.commitTransaction();
		throw ("Cannot add invalid item " + itemID + " as See Also");
		return false;
	}
	
	// Check both ways, using a UNION to take advantage of indexes
	var sql = "SELECT (SELECT COUNT(*) FROM itemSeeAlso WHERE itemID=?1 AND "
		+ "linkedItemID=?2) + (SELECT COUNT(*) FROM itemSeeAlso WHERE "
		+ "linkedItemID=?1 AND itemID=?2)";
	if (Zotero.DB.valueQuery(sql, [this.getID(), itemID])){
		Zotero.DB.commitTransaction();
		Zotero.debug("Item " + itemID + " already linked", 2);
		return false;
	}
	
	var notifierData = [
		{ old: this.toArray() },
		{ old: relatedItem.toArray() }
	];
	
	var sql = "INSERT INTO itemSeeAlso VALUES (?,?)";
	Zotero.DB.query(sql, [this.getID(), {int:itemID}]);
	Zotero.DB.commitTransaction();
	Zotero.Notifier.trigger('modify', 'item', [this.getID(), itemID], notifierData);
	return true;
}

Zotero.Item.prototype.removeSeeAlso = function(itemID){
	if (!this.getID()) {
		throw ('Cannot remove related item of unsaved item');
	}
	
	Zotero.DB.beginTransaction();
	
	var relatedItem = Zotero.Items.get(itemID);
	if (!relatedItem) {
		Zotero.DB.commitTransaction();
		throw ("Cannot remove invalid item " + itemID + " as See Also");
		return false;
	}
	
	var notifierData = [
		{ old: this.toArray() },
		{ old: relatedItem.toArray() }
	];
	
	var sql = "DELETE FROM itemSeeAlso WHERE itemID=? AND linkedItemID=?";
	Zotero.DB.query(sql, [this.getID(), itemID]);
	var sql = "DELETE FROM itemSeeAlso WHERE itemID=? AND linkedItemID=?";
	Zotero.DB.query(sql, [itemID, this.getID()]);
	Zotero.DB.commitTransaction();
	Zotero.Notifier.trigger('modify', 'item', [this.getID(), itemID], notifierData);
}

Zotero.Item.prototype.removeAllRelated = function() {
	if (!this.getID()) {
		throw ('Cannot remove related items of unsaved item');
	}
	
	Zotero.DB.beginTransaction();
	var relateds = this.getSeeAlso();
	if (!relateds) {
		Zotero.DB.commitTransaction();
		return;
	}
	
	var notifierData = [ { old: this.toArray() } ];
	for each(var id in relateds) {
		var item = Zotero.Items.get(id);
		notifierData.push(item ? { old: item.toArray() } : false);
	}
	
	Zotero.DB.query("DELETE FROM itemSeeAlso WHERE itemID=?", this.getID());
	Zotero.DB.query("DELETE FROM itemSeeAlso WHERE linkedItemID=?", this.getID());
	Zotero.DB.commitTransaction();
	
	var ids = [this.getID()].concat(relateds);
	
	Zotero.Notifier.trigger('modify', 'item', ids, notifierData);
}

Zotero.Item.prototype.getSeeAlso = function(){
	if (!this.getID()) {
		return false;
	}
	// Check both ways, using a UNION to take advantage of indexes
	var sql ="SELECT linkedItemID FROM itemSeeAlso WHERE itemID=?1 UNION "
		+ "SELECT itemID FROM itemSeeAlso WHERE linkedItemID=?1";
	return Zotero.DB.columnQuery(sql, this.getID());
}


Zotero.Item.prototype.getImageSrc = function() {
	var itemType = Zotero.ItemTypes.getName(this.getType());
	if (itemType == 'attachment') {
		var linkMode = this.getAttachmentLinkMode();
		if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE) {
			itemType = itemType + "-file";
		}
		else if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
			itemType = itemType + "-link";
		}
		else if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL) {
			itemType = itemType + "-snapshot";
		}
		else if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
			itemType = itemType + "-web-link";
		}
	}
	
	return Zotero.ItemTypes.getImageSrc(itemType);
}


Zotero.Item.prototype.clone = function() {
	if (!this.getID()) {
		throw ('Cannot clone unsaved item in Zotero.Item.clone()');
	}
	
	if (this.isAttachment()) {
		throw ('Cloning attachment items not supported in Zotero.Item.clone()');
	}
	
	Zotero.DB.beginTransaction();
	
	var obj = this.toArray();
	
	// Note
	if (this.isNote()) {
		var newItemID = Zotero.Notes.add(this.getNote(), this.getSource());
		var newItem = Zotero.Items.get(newItemID);
	}
	
	// Regular item
	else {
		var itemTypeID = this.getType();
		var newItem = new Zotero.Item(itemTypeID);
		
		for (var i in obj) {
			switch (i) {
				case 'creators':
					var i = 0;
					for each(var c in obj.creators) {
						newItem.setCreator(i, c.firstName, c.lastName,
							c.creatorType, c.fieldMode ? c.fieldMode : null);
						i++;
					}
					continue;
			}
			
			var fieldID = Zotero.ItemFields.getID(i);
			if (fieldID && Zotero.ItemFields.isValidForType(fieldID, itemTypeID)) {
				newItem.setField(i, obj[i]);
			}
		}
		
		newItem.save();
	}
	
	if (obj.tags) {
		for each(var tag in obj.tags) {
			newItem.addTagByID(tag.id);
		}
	}
	
	if (obj.seeAlso) {
		for each(var id in obj.seeAlso) {
			newItem.addSeeAlso(id)
		}
	}
	
	Zotero.DB.commitTransaction();
	return newItem.getID();
}


/**
* Delete item from database and clear from Zotero.Items internal array
*
* Items.erase() should be used instead of this
**/
Zotero.Item.prototype.erase = function(deleteChildren){
	if (!this.getID()){
		return false;
	}
	
	Zotero.debug('Deleting item ' + this.getID());
	
	var changedItems = [];
	
	Zotero.DB.beginTransaction();
	
	// For Notifier
	var preItemArray = this.toArray();
	var notifierData = [];
	
	// Remove item from parent collections
	var parentCollectionIDs = this.getCollections();
	if (parentCollectionIDs){
		for (var i=0; i<parentCollectionIDs.length; i++){
			Zotero.Collections.get(parentCollectionIDs[i]).removeItem(this.getID());
		}
	}
	
	// Note
	if (this.isNote()){
		// Decrement note count of source items
		var sql = "SELECT sourceItemID FROM itemNotes WHERE itemID=" + this.getID();
		var sourceItemID = Zotero.DB.valueQuery(sql);
		if (sourceItemID){
			var sourceItem = Zotero.Items.get(sourceItemID);
			notifierData.push({ old: sourceItem.toArray() });
			sourceItem.decrementNoteCount();
			changedItems.push(sourceItemID);
		}
	}
	// Attachment
	else if (this.isAttachment()){
		// Decrement file count of source items
		var sql = "SELECT sourceItemID FROM itemAttachments WHERE itemID=" + this.getID();
		var sourceItemID = Zotero.DB.valueQuery(sql);
		if (sourceItemID){
			var sourceItem = Zotero.Items.get(sourceItemID);
			notifierData.push({ old: sourceItem.toArray() });
			sourceItem.decrementAttachmentCount();
			changedItems.push(sourceItemID);
		}
		
		// Delete associated files
		var linkMode = this.getAttachmentLinkMode();
		switch (linkMode){
			// Link only -- nothing to delete
			case Zotero.Attachments.LINK_MODE_LINKED_URL:
				break;
			default:
				try {
					var file = Zotero.getStorageDirectory();
					file.append(this.getID());
					if (file.exists()){
						file.remove(true);
					}
				}
				catch (e) {
					Components.utils.reportError(e);
				}
		}
	}
	
	// Regular item
	
	// If flag given, delete child notes and files
	else if (deleteChildren){
		var sql = "SELECT itemID FROM itemNotes WHERE sourceItemID=?1 UNION "
			+ "SELECT itemID FROM itemAttachments WHERE sourceItemID=?1";
		var toDelete = Zotero.DB.columnQuery(sql, [this.getID()]);
		
		if (toDelete){
			for (var i in toDelete){
				var obj = Zotero.Items.get(toDelete[i]);
				obj.erase(true);
			}
		}
	}
	
	// Otherwise just unlink any child notes or files without deleting
	else {
		// Notes
		var sql = "SELECT itemID FROM itemNotes WHERE sourceItemID=" + this.getID();
		var childNotes = Zotero.DB.columnQuery(sql);
		if (childNotes){
			for each(var id in childNotes) {
				var i = Zotero.Items.get(id);
				notifierData.push({ old: i.toArray() });
			}
			changedItems.push(childNotes);
		}
		var sql = "UPDATE itemNotes SET sourceItemID=NULL WHERE sourceItemID="
			+ this.getID();
		Zotero.DB.query(sql);
		
		// Attachments
		var sql = "SELECT itemID FROM itemAttachments WHERE sourceItemID=" + this.getID();
		var childAttachments = Zotero.DB.columnQuery(sql);
		if (childAttachments){
			for each(var id in childAttachments) {
				var i = Zotero.Items.get(id);
				notifierData.push({ old: i.toArray() });
			}
			changedItems.push(childAttachments);
		}
		var sql = "UPDATE itemAttachments SET sourceItemID=NULL WHERE sourceItemID="
			+ this.getID();
		Zotero.DB.query(sql);
	}
	
	// Flag See Also links for notification
	var relateds = this.getSeeAlso();
	if (relateds){
		for each(var id in relateds) {
			var i = Zotero.Items.get(id);
			notifierData.push({ old: i.toArray() });
		}
		changedItems = changedItems.concat(relateds);
	}
	
	// Clear fulltext cache
	if (this.isAttachment()) {
		Zotero.Fulltext.clearItemWords(this.getID());
		//Zotero.Fulltext.clearItemContent(this.getID());
	}
	
	sql = 'DELETE FROM itemCreators WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemNotes WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemNoteTitles WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemAttachments WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemSeeAlso WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemSeeAlso WHERE linkedItemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemTags WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemData WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM items WHERE itemID=' + this.getID() + ";\n";
	
	Zotero.DB.query(sql);
	
	try {
		Zotero.DB.commitTransaction();
	}
	catch (e){
		// On failure, reset count of source items
		if (sourceItem){
			if (this.isNote()){
				sourceItem.incrementNoteCount();
			}
			else if (this.isAttachment()){
				sourceItem.incrementAttachmentCount();
			}
		}
		Zotero.DB.rollbackTransaction();
		throw (e);
	}
	
	Zotero.Items.unload(this.getID());
	
	// Send notification of changed items
	if (changedItems.length){
		Zotero.Notifier.trigger('modify', 'item', changedItems, notifierData);
	}
	
	Zotero.Notifier.trigger('delete', 'item', this.getID(), { old: preItemArray });
}


Zotero.Item.prototype.isCollection = function(){
	return false;
}


/**
* Convert the item data into a multidimensional associative array
*	for use by the export functions
**/
Zotero.Item.prototype.toArray = function(){
	if (this.getID() && !this._itemDataLoaded){
		this._loadItemData();
	}
	
	var arr = [];
	
	// Primary fields
	for (var i in this._data){
		switch (i){
			case 'itemTypeID':
				arr['itemType'] = Zotero.ItemTypes.getName(this._data[i]);
				break;
			
			// Skip certain fields
			//case 'firstCreator':
			case 'numNotes':
			case 'numAttachments':
				continue;
			
			case 'firstCreator':
				if (!this.isRegularItem()) {
					continue;
				}
				// fall through
			
			// For the rest, just copy over
			default:
				arr[i] = this._data[i];
		}
	}
	
	// Item metadata
	for (var i in this._itemData){
		arr[Zotero.ItemFields.getName(i)] = this._itemData[i] ? this._itemData[i] : '';
	}
	
	if (!this.isNote() && !this.isAttachment()){
		// Creators
		arr['creators'] = [];
		var creators = this.getCreators();
		for (var i in creators){
			arr['creators'][i] = [];
			arr['creators'][i]['firstName'] = creators[i]['firstName'];
			arr['creators'][i]['lastName'] = creators[i]['lastName'];
			arr['creators'][i]['fieldMode'] = creators[i]['fieldMode'];
			// Convert creatorTypeIDs to text
			arr['creators'][i]['creatorType'] =
				Zotero.CreatorTypes.getName(creators[i]['creatorTypeID']);
		}
	}
	
	// Notes
	if (this.isNote()) {
		arr['note'] = this.getNote();
		if (this.getSource()){
			arr['sourceItemID'] = this.getSource();
		}
	}
	
	// Attachments
	if (this.isAttachment()){
		// Attachments can have embedded notes
		arr['note'] = this.getNote();
		
		if (this.getSource()){
			arr['sourceItemID'] = this.getSource();
		}
	}
	
	// Attach children of regular items
	if (this.isRegularItem()){
		// Append attached notes
		arr['notes'] = [];
		var notes = this.getNotes();
		for (var i in notes){
			var note = Zotero.Items.get(notes[i]);
			arr['notes'].push(note.toArray());
		}
		
		arr['attachments'] = [];
		var attachments = this.getAttachments();
		for (var i in attachments){
			var attachment = Zotero.Items.get(attachments[i]);
			arr['attachments'].push(attachment.toArray());
		}
	}
	
	arr['tags'] = this.getTags();
	arr['seeAlso'] = this.getSeeAlso();
	
	return arr;
}



//////////////////////////////////////////////////////////////////////////////
//
// Private Zotero.Item methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Load in the creators from the database
 */
Zotero.Item.prototype._loadCreators = function(){
	if (!this.getID()){
		throw ('ItemID not set for item before attempting to load creators');
	}
	
	var sql = 'SELECT C.creatorID, C.*, creatorTypeID, orderIndex '
		+ 'FROM itemCreators IC '
		+ 'LEFT JOIN creators C USING (creatorID) '
		+ 'WHERE itemID=' + this.getID() + ' ORDER BY orderIndex';
	var creators = Zotero.DB.query(sql);
	
	this._creatorsLoaded = true;
	
	if (!creators){
		return true;
	}
	
	this._creators = [];
	for (var i=0; i<creators.length; i++){
		this._creators[creators[i]['orderIndex']] = {
			firstName: creators[i]['firstName'],
			lastName: creators[i]['lastName'],
			creatorTypeID: creators[i]['creatorTypeID'],
			fieldMode: creators[i]['fieldMode']
		};
	}
	
	return true;
}


/*
 * Load in the field data from the database
 */
Zotero.Item.prototype._loadItemData = function(){
	if (!this.getID()){
		throw ('ItemID not set for object before attempting to load data');
	}
	
	var sql = "SELECT fieldID, value FROM itemData NATURAL JOIN itemDataValues "
		+ "WHERE itemID=?";
	var fields = Zotero.DB.query(sql, this.getID());
	
	var itemTypeFields = Zotero.ItemFields.getItemTypeFields(this.getType());
	
	for each(var field in fields) {
		this.setField(field['fieldID'], field['value'], true);
	}
	
	// Mark nonexistent fields as loaded
	for each(var fieldID in itemTypeFields) {
		if (this._itemData[fieldID] === null) {
			this._itemData[fieldID] = false;
		}
	}
	
	this._itemDataLoaded = true;
}



/*
 * Primary interface for accessing Zotero items
 */
Zotero.Items = new function(){
	// Privileged methods
	this.get = get;
	this.getAll = getAll;
	this.add = add;
	this.reload = reload;
	this.cacheFields = cacheFields;
	this.erase = erase;
	this.purge = purge;
	this.unload = unload;
	
	// Private members
	var _items = [];
	var _itemsLoaded = false;
	var _cachedFields = [];
	var _firstCreatorSQL = '';
	
	
	/*
	 * Retrieves (and loads, if necessary) an arbitrary number of items
	 *
	 * Can be passed ids as individual parameters or as an array of ids, or both
	 *
	 * If only one argument and it's an id, return object directly;
	 * otherwise, return array
	 */
	function get(){
		var toLoad = new Array();
		var loaded = new Array();
		
		if (!arguments[0]){
			Zotero.debug('No arguments provided to Items.get()');
			return false;
		}
		
		var ids = Zotero.flattenArguments(arguments);
		
		for (var i=0; i<ids.length; i++){
			// Check if already loaded
			if (!_items[ids[i]]){
				toLoad.push(ids[i]);
			}
		}
		
		// New items to load
		if (toLoad.length){
			_load(toLoad);
		}
		
		// If single id, return the object directly
		if (arguments[0] && typeof arguments[0]!='object'
				&& typeof arguments[1]=='undefined'){
			if (!_items[arguments[0]]) {
				Zotero.debug("Item " + arguments[0] + " doesn't exist", 2);
				return false;
			}
			return _items[arguments[0]];
		}
		
		// Otherwise, build return array
		for (i=0; i<ids.length; i++){
			if (!_items[ids[i]]){
				Zotero.debug("Item " + ids[i] + " doesn't exist", 2);
				continue;
			}
			loaded.push(_items[ids[i]]);
		}
		
		return loaded;
	}
	
	
	/*
	 * Returns all items in the database
	 *
	 * If |onlyTopLevel|, don't include child items
	 */
	function getAll(onlyTopLevel) {
		var sql = 'SELECT itemID FROM items';
		if (onlyTopLevel) {
			sql += ' A LEFT JOIN itemNotes B USING (itemID) '
			+ 'LEFT JOIN itemAttachments C ON (C.itemID=A.itemID) '
			+ 'WHERE B.sourceItemID IS NULL AND C.sourceItemID IS NULL';
		}
		
		var ids = Zotero.DB.columnQuery(sql);
		return this.get(ids);
	}
	
	
	/*
	 * Create a new item with optional metadata and pass back the primary reference
	 *
	 * Using "var item = new Zotero.Item()" and "item.save()" directly results
	 * in an orphaned reference to the created item. If other code retrieves the
	 * new item with Zotero.Items.get() and modifies it, the original reference
	 * will not reflect the changes.
	 *
	 * Using this method avoids the need to call Zotero.Items.get() after save()
	 * in order to get the primary item reference. Since it accepts metadata
	 * as a JavaScript object, it also offers a simpler syntax than
	 * item.setField() and item.setCreator().
	 *
	 * Callers with no need for an up-to-date reference after save() (or who
	 * don't mind doing an extra Zotero.Items.get()) can use Zotero.Item
	 * directly if they prefer.
	 *
	 * Sample usage:
	 *
	 * var data = {
	 *     title: "Shakespeare: The Invention of the Human",
	 *     publisher: "Riverhead Hardcover",
	 *     date: '1998-10-26',
	 *     ISBN: 1573221201,
	 *     pages: 745,
	 *     creators: [
	 *         ['Harold', 'Bloom', 'author']
	 *     ]
	 * };
	 * var item = Zotero.Items.add('book', data);
	 */
	function add(itemTypeOrID, data) {
		var item = new Zotero.Item(itemTypeOrID);
		for (var field in data){
			if (field == 'creators') {
				var i = 0;
				for each(var creator in data.creators) {
					// TODO: accept format from toArray()
					item.setCreator(i, creator[0], creator[1], creator[2], creator[3] ? creator[3] : null);
					i++;
				}
			}
			else {
				item.setField(field, data[field]);
			}
		}
		var id = item.save();
		
		return this.get(id);
	}
	
	
	/*
	 * Reloads data for specified items into internal array
	 *
	 * Can be passed ids as individual parameters or as an array of ids, or both
	 */
	function reload(){
		if (!arguments[0]){
			return false;
		}
		
		var ids = Zotero.flattenArguments(arguments);
		Zotero.debug('Reloading ' + ids);
		_load(ids);
		
		return true;
	}
	
	
	function cacheFields(fields, items) {
		Zotero.debug("Caching fields [" + fields.join() + "]"
			+ (items ? " for " + items + " items" : ''));
		_load(items);
		
		var primaryFields = [];
		var fieldIDs = [];
		for each(var field in fields) {
			// Check if field already cached
			if (_cachedFields.indexOf(field) != -1) {
				continue;
			}
			
			_cachedFields.push(field);
			
			if (Zotero.Item.prototype.isPrimaryField(field)) {
				primaryFields.push(field);
			}
			else {
				fieldIDs.push(Zotero.ItemFields.getID(field));
				if (Zotero.ItemFields.isBaseField(field)) {
					fieldIDs = fieldIDs.concat(Zotero.ItemFields.getTypeFieldsFromBase(field));
				}
			}
		}
		
		if (primaryFields.length) {
			var sql = "SELECT itemID, " + primaryFields.join(', ') + " FROM items";
			if (items) {
				sql += " WHERE itemID IN (" + items.join() + ")";
			}
			var rows = Zotero.DB.query(sql);
			for each(var row in rows) {
				//Zotero.debug('Calling loadFromRow for item ' + row['itemID']);
				_items[row['itemID']].loadFromRow(row);
			}
		}
		
		// All fields already cached
		if (!fieldIDs.length) {
			return;
		}
		
		var allItemIDs = Zotero.DB.columnQuery("SELECT itemID FROM items");
		var itemFieldsCached = {};
		
		var sql = "SELECT itemID, fieldID, value FROM itemData "
			+ "NATURAL JOIN itemDataValues WHERE ";
		if (items) {
			sql += "itemID IN (" + items.join() + ") AND ";
		}
		sql += "fieldID IN (" + fieldIDs.join() + ")";
		
		var itemDataRows = Zotero.DB.query(sql);
		for each(var row in itemDataRows) {
			//Zotero.debug('Setting field for item ' + row['itemID']);
			if (_items[row['itemID']]) {
				_items[row['itemID']].setField(row['fieldID'], row['value'], true);
			}
			else {
				if (!missingItems) {
					var missingItems = {};
				}
				if (!missingItems[row['itemID']]) {
					missingItems[row['itemID']] = true;
					Components.utils.reportError("itemData row references nonexistent item " + row['itemID']);
				}
			}
			
			if (!itemFieldsCached[row['itemID']]) {
				itemFieldsCached[row['itemID']] = {};
			}
			itemFieldsCached[row['itemID']][row['fieldID']] = true;
		}
		
		// If 'title' is one of the fields, load in noteTitles
		if (fields.indexOf('title') != -1) {
			var titleFieldID = Zotero.ItemFields.getID('title');
			var sql = 'SELECT itemID, title FROM itemNoteTitles';
			if (items) {
				sql += " WHERE itemID IN (" + items.join() + ")";
			}
			
			var rows = Zotero.DB.query(sql);
			for each(var row in rows) {
				//Zotero.debug('Setting title for note ' + row['itemID']);
				if (_items[row['itemID']]) {
					_items[row['itemID']].setField(titleFieldID, row['title'], true);
				}
				else {
					if (!missingItems) {
						var missingItems = {};
					}
					if (!missingItems[row['itemID']]) {
						missingItems[row['itemID']] = true;
						Components.utils.reportError("itemData row references nonexistent item " + row['itemID']);
					}
				}
			}
		}
		
		// Set nonexistent fields in the cache list to false (instead of null)
		for each(var itemID in allItemIDs) {
			for each(var fieldID in fieldIDs) {
				if (Zotero.ItemFields.isValidForType(fieldID, _items[itemID].getType())) {
					if (!itemFieldsCached[itemID] || !itemFieldsCached[itemID][fieldID]) {
						//Zotero.debug('Setting field ' + fieldID + ' to false for item ' + itemID);
						_items[itemID].setField(fieldID, false, true);
					}
				}
			}
		}
	}
	
	
	/**
	* Delete item(s) from database and clear from internal array
	*
	* If _eraseChildren_ is true, erase child items as well
	**/
	function erase(ids, eraseChildren){
		var unlock = Zotero.Notifier.begin(true);
		Zotero.UnresponsiveScriptIndicator.disable();
		try {
			Zotero.DB.beginTransaction();
			for each(var id in ids) {
				var item = this.get(id);
				if (!item) {
					Zotero.debug('Item ' + id + ' does not exist in Items.erase()!', 1);
					Zotero.Notifier.trigger('delete', 'item', id, [false]);
					continue;
				}
				item.erase(eraseChildren); // calls unload()
				item = undefined;
			}
			this.purge();
			Zotero.DB.commitTransaction();
		}
		catch (e) {
			Zotero.DB.rollbackTransaction();
			throw (e);
		}
		finally {
			Zotero.Notifier.commit(unlock);
			Zotero.UnresponsiveScriptIndicator.enable();
		}
	}
	
	
	/*
	 * Clear entries from various tables that no longer exist
	 *
	 * This is called automatically by Items.erase() but must be called
	 * manually after Item.erase()
	 */
	function purge() {
		Zotero.Creators.purge();
		Zotero.Tags.purge();
		Zotero.Fulltext.purgeUnusedWords();
		// TODO: purge itemDataValues?
	}
	
	
	/**
	* Clear item from internal array (used by Zotero.Item.erase())
	**/
	function unload(id){
		delete _items[id];
	}
	
	
	/*
	 * Generate SQL to retrieve firstCreator field
	 *
	 * Why do we do this entirely in SQL? Because we're crazy. Crazy like foxes.
	 */
	function getFirstCreatorSQL() {
		if (_firstCreatorSQL) {
			return _firstCreatorSQL;
		}
		
		/* This whole block is to get the firstCreator */
		var localizedAnd = Zotero.getString('general.and');
		var sql = "COALESCE(" +
			// First try for primary creator types
			"CASE (" +
				"SELECT COUNT(*) FROM itemCreators IC " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=I.itemTypeID) " +
				"WHERE itemID=I.itemID AND primaryField=1" +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT lastName FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=I.itemTypeID) " +
				"WHERE itemID=I.itemID AND primaryField=1" +
			") " +
			"WHEN 2 THEN (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=I.itemTypeID) " +
				"WHERE itemID=I.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1)" +
				" || ' " + localizedAnd + " ' || " +
				"(SELECT lastName FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=I.itemTypeID) " +
				"WHERE itemID=I.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1,1)" +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators IC NATURAL JOIN creators " +
				"LEFT JOIN itemTypeCreatorTypes ITCT " +
				"ON (IC.creatorTypeID=ITCT.creatorTypeID AND ITCT.itemTypeID=I.itemTypeID) " +
				"WHERE itemID=I.itemID AND primaryField=1 ORDER BY orderIndex LIMIT 1)" +
				" || ' et al.' " +
			") " +
			"END, " +
			
			// Then try editors
			"CASE (" +
				"SELECT COUNT(*) FROM itemCreators " +
				"NATURAL JOIN creatorTypes WHERE itemID=I.itemID AND creatorTypeID IN (3)" +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=I.itemID AND creatorTypeID IN (3)" +
			") " +
			"WHEN 2 THEN (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators WHERE itemID=I.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 1)" +
				" || ' " + localizedAnd + " ' || " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators WHERE itemID=I.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 1,1) " +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators WHERE itemID=I.itemID AND creatorTypeID IN (3) ORDER BY orderIndex LIMIT 1)" +
				" || ' et al.' " +
			") " +
			"END, " +
			
			// Then try contributors
			"CASE (" +
				"SELECT COUNT(*) FROM itemCreators " +
				"NATURAL JOIN creatorTypes WHERE itemID=I.itemID AND creatorTypeID IN (2)" +
			") " +
			"WHEN 0 THEN NULL " +
			"WHEN 1 THEN (" +
				"SELECT lastName FROM itemCreators NATURAL JOIN creators " +
				"WHERE itemID=I.itemID AND creatorTypeID IN (2)" +
			") " +
			"WHEN 2 THEN (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators WHERE itemID=I.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 1)" +
				" || ' " + localizedAnd + " ' || " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators WHERE itemID=I.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 1,1) " +
			") " +
			"ELSE (" +
				"SELECT " +
				"(SELECT lastName FROM itemCreators NATURAL JOIN creators WHERE itemID=I.itemID AND creatorTypeID IN (2) ORDER BY orderIndex LIMIT 1)" +
				" || ' et al.' " +
			") " +
			"END" +
		") AS firstCreator";
		
		_firstCreatorSQL = sql;
		return sql;
	}
	
	
	function _load() {
		if (!arguments[0] && _itemsLoaded) {
			return;
		}
		
		// Should be the same as parts in Zotero.Item.loadFromID
		var sql = 'SELECT I.itemID, I.itemTypeID, I.dateAdded, I.dateModified, '
			+ getFirstCreatorSQL() + ', '
			+ "(SELECT COUNT(*) FROM itemNotes WHERE sourceItemID=I.itemID) AS numNotes, "
			+ "(SELECT COUNT(*) FROM itemAttachments WHERE sourceItemID=I.itemID) AS numAttachments "
			+ 'FROM items I WHERE 1';
		
		if (arguments[0]){
			sql += ' AND I.itemID IN (' + Zotero.join(arguments,',') + ')';
		}
		var itemsRows = Zotero.DB.query(sql);
		
		for each(var row in itemsRows) {
			// Item doesn't exist -- create new object and stuff in array
			if (!_items[row['itemID']]){
				var item = new Zotero.Item();
				item.loadFromRow(row, true);
				_items[row['itemID']] = item;
			}
			// Existing item -- reload in place
			else {
				_items[row['itemID']].loadFromRow(row, true);
			}
		}
		
		if (!arguments[0]) {
			_itemsLoaded = true;
			_cachedFields = ['itemID', 'itemTypeID', 'dateAdded', 'dateModified',
				'firstCreator', 'numNotes', 'numAttachments', 'numChildren'];
		}
	}
}




Zotero.Notes = new function(){
	this.add = add;
	this.noteToTitle = noteToTitle;
	
	/**
	* Create a new item of type 'note' and add the note text to the itemNotes table
	*
	* Returns the itemID of the new note item
	**/
	function add(text, sourceItemID){
		Zotero.DB.beginTransaction();
		
		if (sourceItemID){
			var sourceItem = Zotero.Items.get(sourceItemID);
			if (!sourceItem){
				Zotero.DB.commitTransaction();
				throw ("Cannot set note source to invalid item " + sourceItemID);
			}
			if (!sourceItem.isRegularItem()){
				Zotero.DB.commitTransaction();
				throw ("Cannot set note source to a note or attachment (" + sourceItemID + ")");
			}
		}
		
		var note = new Zotero.Item('note');
		note.save();
		
		var title = text ? this.noteToTitle(text) : '';
		var sql = "INSERT INTO itemNoteTitles VALUES (?,?)";
		Zotero.DB.query(sql, [note.getID(), title]);
		
		var sql = "INSERT INTO itemNotes VALUES (?,?,?)";
		var bindParams = [
			note.getID(),
			(sourceItemID ? {int:sourceItemID} : null),
			{string: text ? text : ''}
		];
		Zotero.DB.query(sql, bindParams);
		Zotero.DB.commitTransaction();
		
		// Switch to Zotero.Items version
		var note = Zotero.Items.get(note.getID());
		note.updateNoteCache(text, title);
		
		if (sourceItemID){
			var notifierData = { old: sourceItem.toArray() };
			sourceItem.incrementNoteCount();
			Zotero.Notifier.trigger('modify', 'item', sourceItemID, notifierData);
		}
		
		return note.getID();
	}
	
	
	/**
	* Return first line (or first MAX_LENGTH characters) of note content
	**/
	function noteToTitle(text) {
		var MAX_LENGTH = 80;
		
		var t = text.substring(0, MAX_LENGTH);
		var ln = t.indexOf("\n");
		if (ln>-1 && ln<MAX_LENGTH){
			t = t.substring(0, ln);
		}
		return t;
	}

}




/*
 * Constructor for Collection object
 *
 * Generally should be called from Zotero.Collection rather than directly
 */
Zotero.Collection = function(){
	 this._init();
}

Zotero.Collection.prototype._init = function(){
	//
	// Public members for access by public methods -- do not access directly
	//
	this._id = null;
	this._name = null;
	this._parent = null;
	this._hasChildCollections = false;
	this._hasChildItems = false;
	this._childItems = new Zotero.Hash();
	this._childItemsLoaded = false;
}

/*
 * Build collection from database
 */
Zotero.Collection.prototype.loadFromID = function(id){
	// Should be same as query in Zotero.Collections, just with collectionID
	var sql = "SELECT collectionID, collectionName, parentCollectionID, "
		+ "(SELECT COUNT(*) FROM collections WHERE "
		+ "parentCollectionID=C.collectionID)!=0 AS hasChildCollections, "
		+ "(SELECT COUNT(*) FROM collectionItems WHERE "
		+ "collectionID=C.collectionID)!=0 AS hasChildItems "
		+ "FROM collections C "
		+ "WHERE collectionID=" + id;
	
	var row = Zotero.DB.rowQuery(sql);
	this.loadFromRow(row);
}


/*
 * Populate collection data from a database row
 */
Zotero.Collection.prototype.loadFromRow = function(row){
	this._init();
	this._id = row['collectionID'];
	this._name = row['collectionName'];
	this._parent = row['parentCollectionID'];
	this._hasChildCollections = row['hasChildCollections'];
	this._hasChildItems = row['hasChildItems'];
	this._loadChildItems();
}


Zotero.Collection.prototype.getID = function(){
	return this._id;
}

Zotero.Collection.prototype.getName = function(){
	return this._name;
}

/**
* Returns collectionID of the parent collection
**/
Zotero.Collection.prototype.getParent = function(){
	return this._parent;
}


Zotero.Collection.prototype.isEmpty = function(){
	return !(parseInt(this._hasChildCollections)) && !(parseInt(this._hasChildItems));
}

Zotero.Collection.prototype.hasChildCollections = function(){
	return !!(parseInt(this._hasChildCollections));
}

Zotero.Collection.prototype.hasChildItems = function(){
	return !!(parseInt(this._hasChildItems));
}

/**
* Rename the collection
*
* _name_ is non-empty string
*
* Returns true on success, or false on error
**/
Zotero.Collection.prototype.rename = function(name){
	if (!name){
		return false;
	}
	
	var notifierData = { old: this.toArray() };
	
	var sql = "UPDATE collections SET collectionName=? "
		+ "WHERE collectionID=?";
	Zotero.DB.query(sql, [{'string':name},{'int':this.getID()}]);
	this._name = name;
	
	Zotero.Notifier.trigger('modify', 'collection', this.getID(), notifierData);
	return true;
}


/**
* Change the parentCollectionID of a collection
*
* Returns TRUE on success, FALSE on error
**/
Zotero.Collection.prototype.changeParent = function(parent){
	if (!parent){
		parent = null;
	}
	
	var previousParent = this.getParent();
	
	if (parent==previousParent){
		Zotero.debug('Collection ' + this.getID() + ' is already in '
			+ (parent ? 'collection ' + parent : 'root collection'), 2);
		return false;
	}
	
	if (parent && !Zotero.Collections.get(parent)){
		throw('Invalid parentCollectionID ' + parent + ' in changeParent()');
	}
	
	if (parent && parent==this.getID()){
		Zotero.debug('Cannot move collection into itself!', 2);
		return false;
	}
	
	if (parent){
		if (this.hasDescendent('collection', parent)){
			Zotero.debug('Cannot move collection into one of its own '
				+ 'descendents!', 2);
			return false;
		}
	}
	
	var notifierData = { old: this.toArray() };
	
	var parentParam = parent ? {'int':parent} : {'null':true};
	
	var sql = "UPDATE collections SET parentCollectionID=? "
		+ "WHERE collectionID=?";
	
	Zotero.DB.query(sql, [parentParam, {'int':this.getID()}]);
	this._parent = parent;
	
	var notifyIDs = [
		this.getID(),
		(previousParent ? previousParent : null),
		(parent ? parent : null)
	];
	
	Zotero.Collections.reloadAll();
	
	Zotero.Notifier.trigger('move', 'collection', notifyIDs, notifierData);
	return true;
}


/**
* Add an item to the collection
**/
Zotero.Collection.prototype.addItem = function(itemID){
	Zotero.DB.beginTransaction();
	
	if (!Zotero.Items.get(itemID)){
		Zotero.DB.rollbackTransaction();	
		throw(itemID + ' is not a valid item id');
	}
	
	var nextOrderIndex = Zotero.DB.valueQuery("SELECT IFNULL(MAX(orderIndex)+1, 0) "
		+ "FROM collectionItems WHERE collectionID=" + this._id);
	
	var sql = "INSERT OR IGNORE INTO collectionItems VALUES "
		+ "(" + this._id + ", " + itemID + ", " + nextOrderIndex + ")";
	
	Zotero.DB.query(sql);
	Zotero.DB.commitTransaction();
	
	this._childItems.set(itemID);
	
	// If this was previously empty, update and send a notification to the tree
	if (!this._hasChildItems){
		this._hasChildItems = true;
	}
	
	Zotero.Notifier.trigger('add', 'collection-item', this.getID() + '-' + itemID);
}


/**
 * Add multiple items to the collection in batch
 */
Zotero.Collection.prototype.addItems = function(itemIDs) {
	if (!itemIDs || !itemIDs.length) {
		return;
	}
	
	Zotero.DB.beginTransaction();
	for (var i=0; i<itemIDs.length; i++) {
		this.addItem(itemIDs[i]);
	}
	Zotero.DB.commitTransaction();
}


/**
* Remove an item from the collection (does not delete item from library)
**/
Zotero.Collection.prototype.removeItem = function(itemID){
	var sql = "DELETE FROM collectionItems WHERE collectionID=" + this._id
		+ " AND itemID=" + itemID;
	Zotero.DB.query(sql);
	
	this._childItems.remove(itemID);
	
	// If this was the last item, set collection to empty
	if (!this._childItems.length){
		this._hasChildItems = false;
	}
	
	Zotero.Notifier.trigger('remove', 'collection-item', this.getID() + '-' + itemID);
}


/**
 * Remove multiple items from the collection in batch
 * (does not delete item from library)
 */
Zotero.Collection.prototype.removeItems = function(itemIDs) {
	if (!itemIDs || !itemIDs.length) {
		return;
	}
	
	Zotero.DB.beginTransaction();
	for (var i=0; i<itemIDs.length; i++) {
		this.removeItem(itemIDs[i]);
	}
	Zotero.DB.commitTransaction();
}


/*
 * Returns an array of child items of this collecetion as Zotero.Item instances,
 * or FALSE if none
 */
Zotero.Collection.prototype.getChildItems = function () {
	if (!this._childItemsLoaded){
		this._loadChildItems();
	}
	
	if (this._childItems.length == 0) {
		return false;
	}
	
	var toLoad = [];
	for (var id in this._childItems.items) {
		toLoad.push(id);
	}
	
	return Zotero.Items.get(toLoad);
}


/**
* Check if an item belongs to the collection
**/
Zotero.Collection.prototype.hasItem = function(itemID){
	if (!this._childItemsLoaded){
		this._loadChildItems();
	}
	return this._childItems.has(itemID);
}


Zotero.Collection.prototype.hasDescendent = function(type, id){
	var descendents = this.getDescendents();
	for (var i=0, len=descendents.length; i<len; i++){
		if (descendents[i]['type']==type && descendents[i]['id']==id){
			return true;
		}
	}
	return false;
}


/**
* Deletes collection and all descendent collections and items
**/
Zotero.Collection.prototype.erase = function(deleteItems){
	Zotero.DB.beginTransaction();
	
	var descendents = this.getDescendents();
	var collections = [this.getID()], items = [];
	var notifierData = [{ old: this.toArray() }];
	
	for(var i=0, len=descendents.length; i<len; i++){
		// Descendent collections
		if (descendents[i]['type']=='collection'){
			collections.push(descendents[i]['id']);
			var c = Zotero.Collections.get(descendents[i]['id']);
			notifierData.push(c ? { old: c.toArray() } : false);
		}
		// Descendent items
		else {
			if (deleteItems){
				// Delete items from DB
				Zotero.Items.get(descendents[i]['id']).erase();
			}
		}
	}
	
	// Remove item associations for all descendent collections
	Zotero.DB.query('DELETE FROM collectionItems WHERE collectionID IN ('
		+ collections.join() + ')');
	
	// And delete all descendent collections
	Zotero.DB.query('DELETE FROM collections WHERE collectionID IN ('
		+ collections.join() + ')');
	
	Zotero.DB.commitTransaction();
	
	// Clear deleted collection from internal memory
	Zotero.Collections.unload(collections);
	
	Zotero.Collections.reloadAll();
	
	Zotero.Notifier.trigger('delete', 'collection', collections, notifierData);
}


Zotero.Collection.prototype.isCollection = function(){
	return true;
}


Zotero.Collection.prototype.toArray = function() {
	return {
		id: this.getID(),
		name: this.getName(),
		parent: this.getParent(),
		descendents: this.getDescendents(true)
	};
}


Zotero.Collection.prototype._loadChildItems = function(){
	this._childItems = new Zotero.Hash();
	
	var sql = "SELECT itemID FROM collectionItems WHERE collectionID=" + this._id;
	var itemIDs = Zotero.DB.columnQuery(sql);
	
	if (itemIDs){
		for (var i=0; i<itemIDs.length; i++){
			this._childItems.set(itemIDs[i]);
		}
	}
	
	this._childItemsLoaded = true;
}


/**
* Returns an array of descendent collections and items
*	(rows of 'id', 'type' ('item' or 'collection'), and, if collection, 'name'
*	and the nesting 'level')
*
* nested: Return multidimensional array with 'children' nodes instead of flat array
**/
Zotero.Collection.prototype.getDescendents = function(nested, type, level){
	var toReturn = new Array();
	
	if (!level) {
		level = 1;
	}
	
	// 0 == collection
	// 1 == item
	var children = Zotero.DB.query('SELECT collectionID AS id, '
		+ "0 AS type, collectionName AS collectionName "
		+ 'FROM collections WHERE parentCollectionID=' + this._id
		+ ' UNION SELECT itemID AS id, 1 AS type, NULL AS collectionName '
		+ 'FROM collectionItems WHERE collectionID=' + this._id);
	
	if (type){
		switch (type){
			case 'item':
			case 'collection':
				break;
			default:
				throw ("Invalid type '" + type + "' in Collection.getDescendents()");
		}
	}
	
	for(var i=0, len=children.length; i<len; i++){
		// This seems to not work without parseInt() even though
		// typeof children[i]['type'] == 'number' and
		// children[i]['type'] === parseInt(children[i]['type']),
		// which sure seems like a bug to me
		switch (parseInt(children[i]['type'])){
			case 0:
				if (!type || type=='collection'){
					toReturn.push({
						id: children[i]['id'],
						name: children[i]['collectionName'],
						type: 'collection',
						level: level
					});
				}
				
				var descendents =
					Zotero.Collections.get(children[i]['id']).getDescendents(nested, type, level+1);
				
				if (nested){
					toReturn[toReturn.length-1]['children'] = descendents;
				}
				else {
					for(var j=0, len2=descendents.length; j<len2; j++){
						toReturn.push(descendents[j]);
					}
				}
			break;
			
			case 1:
				if (!type || type=='item'){
					toReturn.push({
						id: children[i]['id'],
						type: 'item'
					});
				}
			break;
		}
	}
	
	return toReturn;
}




/*
 * Primary interface for accessing Zotero collection
 */
Zotero.Collections = new function(){
	var _collections = new Array();
	var _collectionsLoaded = false;
	
	this.get = get;
	this.add = add;
	this.getCollectionsContainingItems = getCollectionsContainingItems;
	this.reloadAll = reloadAll;
	this.unload = unload;
	
	/*
	 * Returns a Zotero.Collection object for a collectionID
	 */
	function get(id){
		if (!_collectionsLoaded){
			this.reloadAll();
		}
		return (typeof _collections[id]!='undefined') ? _collections[id] : false;
	}
	
	
	/**
	* Add new collection to DB and return Collection object
	*
	* _name_ is non-empty string
	* _parent_ is optional collectionID -- creates root collection by default
	*
	* Returns true on success; false on error
	**/
	function add(name, parent){
		if (!name){
			return false;
		}
		
		Zotero.DB.beginTransaction();
		
		if (parent && !this.get(parent)){
			Zotero.DB.rollbackTransaction();
			throw('Cannot add collection to invalid parent ' + parent);
		}
		
		var parentParam = parent ? {'int':parent} : {'null':true};
		
		var rnd = Zotero.getRandomID('collections', 'collectionID');
		
		var sql = "INSERT INTO collections VALUES (?,?,?)";
		var sqlValues = [ {'int':rnd}, {'string':name}, parentParam ];
		Zotero.DB.query(sql, sqlValues);
		
		Zotero.DB.commitTransaction();
		
		this.reloadAll();
		
		Zotero.Notifier.trigger('add', 'collection', rnd);
		
		return this.get(rnd);
	}
	
	
	function getCollectionsContainingItems(itemIDs, asIDs) {
		var sql = "SELECT collectionID FROM collections WHERE ";
		var sqlParams = [];
		for each(var id in itemIDs) {
			sql += "collectionID IN (SELECT collectionID FROM collectionItems "
				+ "WHERE itemID=?) AND "
			sqlParams.push(id);
		}
		sql = sql.substring(0, sql.length - 5);
		var collectionIDs = Zotero.DB.columnQuery(sql, sqlParams);
		
		if (asIDs) {
			return collectionIDs;
		}
		
		return Zotero.Collections.get(collectionIDs);
	}
	
	
	
	/**
	* Clear collection from internal cache (used by Zotero.Collection.erase())
	*
	* Can be passed ids as individual parameters or as an array of ids, or both
	**/
	function unload(){
		var ids = Zotero.flattenArguments(arguments);
		
		for(var i=0; i<ids.length; i++){
			delete _collections[ids[i]];
		}
	}
	
	
	/**
	* Loads collection data from DB and adds to internal cache
	**/
	function reloadAll() {
		// This should be the same as the query in Zotero.Collection.loadFromID,
		// just without a specific collectionID
		var sql = "SELECT collectionID, collectionName, parentCollectionID, "
			+ "(SELECT COUNT(*) FROM collections WHERE "
			+ "parentCollectionID=C.collectionID)!=0 AS hasChildCollections, "
			+ "(SELECT COUNT(*) FROM collectionItems WHERE "
			+ "collectionID=C.collectionID)!=0 AS hasChildItems "
			+ "FROM collections C";
		
		var ids = Zotero.flattenArguments(arguments)
		if (ids.length){
			sql += " WHERE collectionID IN (" + ids.join() + ")";
		}
		
		var result = Zotero.DB.query(sql);
		
		var collectionIDs = [];
		
		if (result){
			for (var i=0; i<result.length; i++){
				var collectionID = result[i]['collectionID'];
				collectionIDs.push(collectionID);
				
				// If collection doesn't exist, create new object and stuff in array
				if (!_collections[collectionID]){
					var collection = new Zotero.Collection();
					collection.loadFromRow(result[i]);
					_collections[collectionID] = collection;
				}
				// If existing collection, reload in place
				else {
					_collections[collectionID].loadFromRow(result[i]);
				}
			}
		}
		
		// Remove old collections that no longer exist
		for each(var c in _collections) {
			if (collectionIDs.indexOf(c.getID()) == -1) {
				this.unload(c.getID());
			}
		}
		
		_collectionsLoaded = true;
	}
}



/*
 * Same structure as Zotero.Tags -- make changes in both places if possible
 */
Zotero.Creators = new function(){
	var _creators = new Array; // indexed by first%%%last%%%fieldMode hash
	var _creatorsByID = new Array; // indexed by creatorID
	
	this.get = get;
	this.getID = getID;
	this.add = add;
	this.purge = purge;
	
	var self = this;
	
	/*
	 * Returns an array of creator data for a given creatorID
	 */
	function get(creatorID){
		if (_creatorsByID[creatorID]){
			return _creatorsByID[creatorID];
		}
		
		var sql = 'SELECT * FROM creators WHERE creatorID=' + creatorID;
		var result = Zotero.DB.rowQuery(sql);
		
		if (!result){
			return false;
		}
		
		_creatorsByID[creatorID] = result;
		return result;
	}
	
	
	/*
	 * Returns the creatorID matching given name and type
	 */
	function getID(firstName, lastName, fieldMode){
		if (!firstName){
			firstName = '';
		}
		if (!lastName){
			lastName = '';
		}
		
		// Only two modes for now
		if (fieldMode){
			firstName = '';
			fieldMode = 1;
		}
		else {
			fieldMode = 0;
		}
		
		var hash = firstName + '%%%' + lastName + '%%%' + fieldMode;
		
		if (_creators[hash]){
			return _creators[hash];
		}
		
		var sql = 'SELECT creatorID FROM creators '
			+ 'WHERE firstName=? AND lastName=? AND fieldMode=?';
		var params = [{string: firstName}, {string: lastName}, fieldMode];
		var creatorID = Zotero.DB.valueQuery(sql, params);
		
		if (creatorID){
			_creators[hash] = creatorID;
		}
		
		return creatorID;
	}
	
	
	/*
	 * Add a new creator to the database
	 *
	 * Returns new creatorID
	 */
	function add(firstName, lastName, fieldMode){
		Zotero.debug('Adding new creator', 4);
		
		Zotero.DB.beginTransaction();
		
		var sql = 'INSERT INTO creators VALUES (?,?,?,?)';
		var rnd = Zotero.getRandomID('creators', 'creatorID');
		var params = [
			rnd, fieldMode ? '' : {string: firstName}, {string: lastName},
			fieldMode ? 1 : 0
		];
		Zotero.DB.query(sql, params);
		
		Zotero.DB.commitTransaction();
		return rnd;
	}
	
	
	/*
	 * Delete obsolete creators from database and clear internal array entries
	 *
	 * Returns removed creatorIDs on success
	 */
	function purge(){
		var sql = 'SELECT creatorID FROM creators WHERE creatorID NOT IN '
			+ '(SELECT creatorID FROM itemCreators);';
		var toDelete = Zotero.DB.columnQuery(sql);
		
		if (!toDelete){
			return false;
		}
		
		// Clear creator entries in internal array
		for (var i=0; i<toDelete.length; i++){
			var hash = _getHash(toDelete[i]);
			delete _creators[hash];
			delete _creatorsByID[toDelete[i]];
		}
		
		sql = 'DELETE FROM creators WHERE creatorID NOT IN '
			+ '(SELECT creatorID FROM itemCreators);';
		var result = Zotero.DB.query(sql);
		
		return toDelete;
	}
	
	
	function _getHash(creatorID){
		var creator = self.get(creatorID);
		if (!creator){
			return false;
		}
		return creator['firstName'] + '%%%' + creator['lastName'] + '%%%' +
			creator['fieldMode'];
	}
}


/*
 * Same structure as Zotero.Creators -- make changes in both places if possible
 */
Zotero.Tags = new function(){
	var _tags = []; // indexed by tag text
	var _tagsByID = []; // indexed by tagID
	
	this.get = get;
	this.getName = getName;
	this.getID = getID;
	this.getIDs = getIDs;
	this.getTypes = getTypes;
	this.getAll = getAll;
	this.getAllWithinSearch = getAllWithinSearch;
	this.getTagItems = getTagItems;
	this.search = search;
	this.add = add;
	this.rename = rename;
	this.remove = remove;
	this.purge = purge;
	this.toArray = toArray;
	
	
	/*
	 * Returns a tag and type for a given tagID
	 */
	function get(tagID) {
		if (_tagsByID[tagID]){
			return _tagsByID[tagID];
		}
		
		var sql = 'SELECT tag, tagType FROM tags WHERE tagID=?';
		var result = Zotero.DB.rowQuery(sql, tagID);
		
		if (!result){
			return false;
		}
		
		_tagsByID[tagID] = {
			tag: result.tag,
			type: result.tagType
		};
		return result;
	}
	
	
	/*
	 * Returns a tag for a given tagID
	 */
	function getName(tagID) {
		if (_tagsByID[tagID]){
			return _tagsByID[tagID].tag;
		}
		
		var tag = this.get(tagID);
		
		return _tagsByID[tagID] ? _tagsByID[tagID].tag : false;
	}
	
	
	/*
	 * Returns the tagID matching given tag and type
	 */
	function getID(tag, type) {
		if (_tags[type] && _tags[type]['_' + tag]){
			return _tags[type]['_' + tag];
		}
		
		var sql = 'SELECT tagID FROM tags WHERE tag=? AND tagType=?';
		var tagID = Zotero.DB.valueQuery(sql, [tag, type]);
		
		if (tagID) {
			if (!_tags[type]) {
				_tags[type] = [];
			}
			_tags[type]['_' + tag] = tagID;
		}
		
		return tagID;
	}
	
	
	/*
	 * Returns all tagIDs for this tag (of all types)
	 */
	function getIDs(tag) {
		var sql = 'SELECT tagID FROM tags WHERE tag=?';
		return Zotero.DB.columnQuery(sql, [tag]);
	}
	
	
	/*
	 * Returns an array of tagTypes for tags matching given tag
	 */
	function getTypes(tag) {
		var sql = 'SELECT tagType FROM tags WHERE tag=?';
		return Zotero.DB.columnQuery(sql, [tag]);
	}
	
	
	/**
	 * Get all tags indexed by tagID
	 *
	 * _types_ is an optional array of tagTypes to fetch
	 */
	function getAll(types) {
		var sql = "SELECT tagID, tag, tagType FROM tags ";
		if (types) {
			sql += "WHERE tagType IN (" + types.join() + ") ";
		}
		var tags = Zotero.DB.query(sql);
		if (!tags) {
			return {};
		}
		
		var collation = Zotero.getLocaleCollation();
		tags.sort(function(a, b) {
			return collation.compareString(1, a.tag, b.tag);
		});
		
		var indexed = {};
		for (var i=0; i<tags.length; i++) {
			indexed[tags[i].tagID] = {
				tag: tags[i].tag,
				type: tags[i].tagType
			};
		}
		return indexed;
	}
	
	
	/*
	 * Get all tags within the items of a Zotero.Search object
	 *
	 * _types_ is an optional array of tagTypes to fetch
	 */
	function getAllWithinSearch(search, types) {
		// Save search results to temporary table
		try {
			var tmpTable = search.search(true);
		}
		catch (e) {
			if (e.match(/Saved search [0-9]+ does not exist/)) {
				Zotero.DB.rollbackTransaction();
				Zotero.debug(e, 2);
			}
			else {
				throw (e);
			}
		}
		if (!tmpTable) {
			return {};
		}
		
		var sql = "SELECT DISTINCT tagID, tag, tagType FROM itemTags "
			+ "NATURAL JOIN tags WHERE itemID IN "
			+ "(SELECT itemID FROM " + tmpTable + ") ";
		if (types) {
			sql += "AND tagType IN (" + types.join() + ") ";
		}
		var tags = Zotero.DB.query(sql);
		
		Zotero.DB.query("DROP TABLE " + tmpTable);
		
		if (!tags) {
			return {};
		}
		
		var collation = Zotero.getLocaleCollation();
		tags.sort(function(a, b) {
			return collation.compareString(1, a.tag, b.tag);
		});
		
		var indexed = {};
		for (var i=0; i<tags.length; i++) {
			indexed[tags[i].tagID] = {
				tag: tags[i].tag,
				type: tags[i].tagType
			};
		}
		return indexed;
	}
	
	
	function getTagItems(tagID) {
		var sql = "SELECT itemID FROM itemTags WHERE tagID=?";
		return Zotero.DB.columnQuery(sql, tagID);
	}
	
	
	function search(str){
		var sql = 'SELECT tagID, tag, tagType FROM tags';
		if (str) {
			sql += ' WHERE tag LIKE ?';
		}
		sql += ' ORDER BY tag COLLATE NOCASE';
		var tags = Zotero.DB.query(sql, str ? '%' + str + '%' : undefined);
		var indexed = {};
		for each(var tag in tags) {
			indexed[tag.tagID] = {
				tag: tag.tag,
				type: tag.tagType
			};
		}
		return indexed;
	}
	
	
	/*
	 * Add a new tag to the database
	 *
	 * Returns new tagID
	 */
	function add(tag, type){
		if (type != 0 && type != 1) {
			throw ('Invalid tag type ' + type + ' in Tags.add()');
		}
		
		if (!type) {
			type = 0;
		}
		
		Zotero.debug('Adding new tag of type ' + type, 4);
		
		Zotero.DB.beginTransaction();
		
		var sql = 'INSERT INTO tags VALUES (?,?,?)';
		var rnd = Zotero.getRandomID('tags', 'tagID');
		Zotero.DB.query(sql, [{int: rnd}, {string: tag}, {int: type}]);
		
		Zotero.DB.commitTransaction();
		Zotero.Notifier.trigger('add', 'tag', rnd);
		return rnd;
	}
	
	
	function rename(tagID, tag) {
		Zotero.debug('Renaming tag', 4);
		
		Zotero.DB.beginTransaction();
		
		var tagObj = this.get(tagID);
		var oldName = tagObj.tag;
		var oldType = tagObj.type;
		var notifierData = [{ old: this.toArray() }];
		
		if (oldName == tag) {
			if (oldType != 0) {
				var sql = "UPDATE tags SET tagType=0 WHERE tagID=?";
				Zotero.DB.query(sql, tagID);
				Zotero.Notifier.trigger('modify', 'tag', tagID, notifierData);
			}
			Zotero.DB.commitTransaction();
			return;
		}
		
		// Check if the new tag already exists
		var sql = "SELECT tagID FROM tags WHERE tag=? AND tagType=0";
		var existingTagID = Zotero.DB.valueQuery(sql, tag);
		if (existingTagID) {
			var itemIDs = this.getTagItems(tagID);
			var existingItemIDs = this.getTagItems(existingTagID);
			
			// Would be easier to just call removeTag(tagID) and addTag(existingID)
			// here, but this is considerably more efficient
			var sql = "UPDATE OR REPLACE itemTags SET tagID=? WHERE tagID=?";
			Zotero.DB.query(sql, [existingTagID, tagID]);
			
			// Manual purge of old tag
			var sql = "DELETE FROM tags WHERE tagID=?";
			Zotero.DB.query(sql, tagID);
			if (_tags[oldType]) {
				delete _tags[oldType]['_' + oldName];
			}
			delete _tagsByID[tagID];
			Zotero.Notifier.trigger('delete', 'tag', tagID, notifierData);
			
			// Simulate tag removal on items that used old tag
			var itemTags = [];
			for (var i in itemIDs) {
				itemTags.push(itemIDs[i] + '-' + tagID);
			}
			Zotero.Notifier.trigger('remove', 'item-tag', itemTags);
			
			// And send tag add for new tag (except for those that already had it)
			var itemTags = [];
			for (var i in itemIDs) {
				if (existingItemIDs.indexOf(itemIDs[i]) == -1) {
					itemTags.push(itemIDs[i] + '-' + existingTagID);
				}
			}
			Zotero.Notifier.trigger('add', 'item-tag', itemTags);
			
			Zotero.Notifier.trigger('modify', 'item', itemIDs);
			Zotero.DB.commitTransaction();
			return;
		}
		
		// 0 == user tag -- we set all renamed tags to 0
		var sql = "UPDATE tags SET tag=?, tagType=0 WHERE tagID=?";
		Zotero.DB.query(sql, [{string: tag}, tagID]);
		
		var itemIDs = this.getTagItems(tagID);
		
		if (_tags[oldType]) {
			delete _tags[oldType]['_' + oldName];
		}
		delete _tagsByID[tagID];
		
		Zotero.DB.commitTransaction();
		
		Zotero.Notifier.trigger('modify', 'item', itemIDs);
		Zotero.Notifier.trigger('modify', 'tag', tagID, notifierData);
	}
	
	
	function remove(tagID) {
		Zotero.DB.beginTransaction();
		
		var sql  = "SELECT itemID FROM itemTags WHERE tagID=?";
		var itemIDs = Zotero.DB.columnQuery(sql, tagID);
		
		if (!itemIDs) {
			Zotero.DB.commitTransaction();
			return;
		}
		
		var sql = "DELETE FROM itemTags WHERE tagID=?";
		Zotero.DB.query(sql, tagID);
		
		Zotero.Notifier.trigger('modify', 'item', itemIDs)
		var itemTags = [];
		for (var i in itemIDs) {
			itemTags.push(itemIDs[i] + '-' + tagID);
		}
		Zotero.Notifier.trigger('remove', 'item-tag', itemTags);
		
		this.purge();
		Zotero.DB.commitTransaction();
		return;
	}
	
	
	/*
	 * Delete obsolete tags from database and clear internal array entries
	 *
	 * Returns removed tagIDs on success
	 */
	function purge(){
		Zotero.DB.beginTransaction();
		
		var sql = 'SELECT tagID, tag, tagType FROM tags WHERE tagID '
			+ 'NOT IN (SELECT tagID FROM itemTags);';
		var toDelete = Zotero.DB.query(sql);
		
		if (!toDelete){
			Zotero.DB.commitTransaction();
			return false;
		}
		
		var purged = [];
		var notifierData = [];
		
		// Clear tag entries in internal array
		for each(var tag in toDelete) {
			notifierData.push(Zotero.Tags.toArray(tag.tagID));
			
			purged.push(tag.tagID);
			if (_tags[tag.tagType]) {
				delete _tags[tag.tagType]['_' + tag.tag];
			}
			delete _tagsByID[tag.tagID];
		}
		
		sql = 'DELETE FROM tags WHERE tagID NOT IN '
			+ '(SELECT tagID FROM itemTags);';
		var result = Zotero.DB.query(sql);
		
		Zotero.DB.commitTransaction();
		
		Zotero.Notifier.trigger('delete', 'tag', purged, notifierData);
		
		return toDelete;
	}
	
	
	function toArray(tagID) {
		var obj = this.get(tagID);
		obj.id = tagID;
		return obj;
	}
}




/*
 * Base function for retrieving ids and names of static types stored in the DB
 * (e.g. creatorType, fileType, charset, itemType)
 *
 * Extend using the following code within a child constructor:
 *
 * 	Zotero.CachedTypes.apply(this, arguments);
 *  this.constructor.prototype = new Zotero.CachedTypes();
 *
 * And the following properties:
 *
 *	this._typeDesc = 'c';
 *	this._idCol = '';
 *	this._nameCol = '';
 *	this._table = '';
 *	this._ignoreCase = false;
 * 
 */
Zotero.CachedTypes = function(){
	var _types = [];
	var _typesLoaded;
	var self = this;
	
	// Override these variables in child classes
	this._typeDesc = '';
	this._idCol = '';
	this._nameCol = '';
	this._table = '';
	this._ignoreCase = false;
	
	this.getName = getName;
	this.getID = getID;
	this.getTypes = getTypes;
	
	function getName(idOrName){
		if (!_typesLoaded){
			_load();
		}
		
		if (this._ignoreCase){
			idOrName = idOrName + '';
			idOrName = idOrName.toLowerCase();
		}
		
		if (!_types['_' + idOrName]){
			Zotero.debug('Invalid ' + this._typeDesc + ' ' + idOrName, 1);
			return '';
		}
		
		return _types['_' + idOrName]['name'];
	}
	
	
	function getID(idOrName){
		if (!_typesLoaded){
			_load();
		}
		
		if (this._ignoreCase){
			idOrName = idOrName + '';
			idOrName = idOrName.toLowerCase();
		}
		
		if (!_types['_' + idOrName]){
			Zotero.debug('Invalid ' + this._typeDesc + ' ' + idOrName, 1);
			return false;
		}
		
		return _types['_' + idOrName]['id'];
	}
	
	
	function getTypes(where){
		return Zotero.DB.query('SELECT ' + this._idCol + ' AS id, '
			+ this._nameCol + ' AS name FROM ' + this._table
			+ (where ? ' ' + where : '') + ' ORDER BY ' + this._nameCol);
	}
	
	
	function _load(){
		var types = self.getTypes();
		
		for (i in types){
			// Store as both id and name for access by either
			var typeData = {
				id: types[i]['id'],
				name: types[i]['name']
			}
			_types['_' + types[i]['id']] = typeData;
			if (self._ignoreCase){
				_types['_' + types[i]['name'].toLowerCase()] = _types['_' + types[i]['id']];
			}
			else {
				_types['_' + types[i]['name']] = _types['_' + types[i]['id']];
			}
		}
		
		_typesLoaded = true;
	}
}


Zotero.CreatorTypes = new function(){
	Zotero.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Zotero.CachedTypes();
	
	this.getTypesForItemType = getTypesForItemType;
	this.isValidForItemType = isValidForItemType;
	this.getPrimaryIDForType = getPrimaryIDForType;
	
	this._typeDesc = 'creator type';
	this._idCol = 'creatorTypeID';
	this._nameCol = 'creatorType';
	this._table = 'creatorTypes';
	
	function getTypesForItemType(itemTypeID){
		var sql = "SELECT creatorTypeID AS id, creatorType AS name "
			+ "FROM itemTypeCreatorTypes NATURAL JOIN creatorTypes "
			// DEBUG: sort needs to be on localized strings in itemPane.js
			// (though still put primary field at top)
			+ "WHERE itemTypeID=? ORDER BY primaryField=1 DESC, name";
		return Zotero.DB.query(sql, itemTypeID);
	}
	
	
	function isValidForItemType(creatorTypeID, itemTypeID){
		var sql = "SELECT COUNT(*) FROM itemTypeCreatorTypes "
			+ "WHERE itemTypeID=? AND creatorTypeID=?";
		return !!Zotero.DB.valueQuery(sql, [itemTypeID, creatorTypeID]);
	}
	
	
	function getPrimaryIDForType(itemTypeID){
		var sql = "SELECT creatorTypeID FROM itemTypeCreatorTypes "
			+ "WHERE itemTypeID=? AND primaryField=1";
		return Zotero.DB.valueQuery(sql, itemTypeID);
	}
}


Zotero.ItemTypes = new function(){
	Zotero.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Zotero.CachedTypes();
	
	this.getPrimaryTypes = getPrimaryTypes;
	this.getSecondaryTypes = getSecondaryTypes;
	this.getHiddenTypes = getHiddenTypes;
	this.getImageSrc = getImageSrc;
	
	this._typeDesc = 'item type';
	this._idCol = 'itemTypeID';
	this._nameCol = 'typeName';
	this._table = 'itemTypes';

	function getPrimaryTypes(){
		return this.getTypes('WHERE display=2');
	}

	function getSecondaryTypes(){
		return this.getTypes('WHERE display=1');
	}
	
	function getHiddenTypes(){
		return this.getTypes('WHERE display=0');
	}
	
	function getImageSrc(itemType) {
		// DEBUG: only have icons for some types so far
		switch (itemType) {
			case 'attachment-file':
			case 'attachment-link':
			case 'attachment-snapshot':
			case 'attachment-web-link':
			case 'artwork':
			case 'audioRecording':
			case 'blogPost':
			case 'book':
			case 'bookSection':
			case 'computerProgram':
			case 'conferencePaper':
			case 'email':
			case 'film':
			case 'forumPost':
			case 'interview':
			case 'journalArticle':
			case 'letter':
			case 'magazineArticle':
			case 'manuscript':
			case 'map':
			case 'newspaperArticle':
			case 'note':
			case 'podcast':
			case 'radioBroadcast':
			case 'report':
			case 'thesis':
			case 'tvBroadcast':
			case 'videoRecording':
			case 'webpage':
				
				return "chrome://zotero/skin/treeitem-" + itemType + ".png";
		}
		
		return "chrome://zotero/skin/treeitem.png";
	}
}


Zotero.FileTypes = new function(){
	Zotero.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Zotero.CachedTypes();
	
	this._typeDesc = 'file type';
	this._idCol = 'fileTypeID';
	this._nameCol = 'fileType';
	this._table = 'fileTypes';
	
	this.getIDFromMIMEType = getIDFromMIMEType;
	
	function getIDFromMIMEType(mimeType){
		var sql = "SELECT fileTypeID FROM fileTypeMIMETypes "
			+ "WHERE ? LIKE mimeType || '%'";
			
		return Zotero.DB.valueQuery(sql, [mimeType]);
	}
}


Zotero.CharacterSets = new function(){
	Zotero.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Zotero.CachedTypes();
	
	this._typeDesc = 'character sets';
	this._idCol = 'charsetID';
	this._nameCol = 'charset';
	this._table = 'charsets';
	this._ignoreCase = true;
	
	this.getAll = getAll;
	
	function getAll(){
		return this.getTypes();
	}
}




Zotero.ItemFields = new function(){
	// Private members
	var _fields = {};
	var _fieldsLoaded;
	var _fieldFormats = [];
	var _itemTypeFields = [];
	var _baseTypeFields = [];
	var _typeFieldIDsByBase = {};
	var _typeFieldNamesByBase = {};
	
	var self = this;
	
	// Privileged methods
	this.getName = getName;
	this.getID = getID;
	this.getLocalizedString = getLocalizedString;
	this.isValidForType = isValidForType;
	this.isInteger = isInteger;
	this.getItemTypeFields = getItemTypeFields;
	this.isBaseField = isBaseField;
	this.isFieldOfBase = isFieldOfBase;
	this.getBaseMappedFields = getBaseMappedFields;
	this.getFieldIDFromTypeAndBase = getFieldIDFromTypeAndBase;
	this.getBaseIDFromTypeAndField = getBaseIDFromTypeAndField;
	this.getTypeFieldsFromBase = getTypeFieldsFromBase;
	
	
	/*
	 * Return the fieldID for a passed fieldID or fieldName
	 */
	function getID(field){
		if (!_fieldsLoaded){
			_loadFields();
		}
		
		if (typeof field == 'number') {
			return field;
		}
		
		return _fields[field] ? _fields[field]['id'] : false;
	}
	
	
	/*
	 * Return the fieldName for a passed fieldID or fieldName
	 */
	function getName(field){
		if (!_fieldsLoaded){
			_loadFields();
		}
		
		return _fields[field] ? _fields[field]['name'] : false;
	}
	
	
	function getLocalizedString(itemType, field) {
		// unused currently
		//var typeName = Zotero.ItemTypes.getName(itemType);
		var fieldName = this.getName(field);
		
		// Fields in the items table are special cases
		switch (field) {
			case 'dateAdded':
			case 'dateModified':
			case 'itemType':
				fieldName = field;
		}
		
		// TODO: different labels for different item types
		
		return Zotero.getString("itemFields." + fieldName);
	}
	
	
	function isValidForType(fieldID, itemTypeID){
		if (!_fieldsLoaded){
			_loadFields();
		}
		
		_fieldCheck(fieldID, 'isValidForType');
		
		if (!_fields[fieldID]['itemTypes']){
			return false;
		}
		
		return !!_fields[fieldID]['itemTypes'][itemTypeID];
	}
	
	
	function isInteger(fieldID){
		if (!_fieldsLoaded){
			_loadFields();
		}
		
		_fieldCheck(fieldID, 'isInteger');
		
		var ffid = _fields[fieldID]['formatID'];
		return _fieldFormats[ffid] ? _fieldFormats[ffid]['isInteger'] : false;
	}
	
	
	/*
	 * Returns an array of fieldIDs for a given item type
	 */
	function getItemTypeFields(itemTypeID){
		if (_itemTypeFields[itemTypeID]){
			return _itemTypeFields[itemTypeID];
		}
		
		if (!itemTypeID){
			throw("Invalid item type id '" + itemTypeID
				+ "' provided to getItemTypeFields()");
		}
		
		var sql = 'SELECT fieldID FROM itemTypeFields '
			+ 'WHERE itemTypeID=' + itemTypeID + ' ORDER BY orderIndex';
		var fields = Zotero.DB.columnQuery(sql);
		
		_itemTypeFields[itemTypeID] = fields ? fields : [];
		return _itemTypeFields[itemTypeID];
	}
	
	
	function isBaseField(field) {
		if (!_fieldsLoaded){
			_loadFields();
		}
		
		_fieldCheck(field, arguments.callee.name);
		
		return _fields[field]['isBaseField'];
	}
	
	
	function isFieldOfBase(field, baseField) {
		var fieldID = _fieldCheck(field, 'isFieldOfBase');
		
		var baseFieldID = this.getID(baseField);
		if (!baseFieldID) {
			throw ("Invalid field '" + baseField + '" for base field in ItemFields.getFieldIDFromTypeAndBase()');
		}
		
		if (fieldID == baseFieldID) {
			return true;
		}
		
		var typeFields = this.getTypeFieldsFromBase(baseFieldID);
		return typeFields.indexOf(fieldID) != -1;
	}
	
	
	function getBaseMappedFields() {
		return Zotero.DB.columnQuery("SELECT DISTINCT fieldID FROM baseFieldMappings");
	}
	
	
	/*
	 * Returns the fieldID of a type-specific field for a given base field
	 * 		or false if none
	 *
	 * Examples:
	 *
	 * 'audioRecording' and 'publisher' returns label's fieldID
	 * 'book' and 'publisher' returns publisher's fieldID
	 * 'audioRecording' and 'number' returns false
	 *
	 * Accepts names or ids
	 */
	function getFieldIDFromTypeAndBase(itemType, baseField) {
		if (!_fieldsLoaded){
			_loadFields();
		}
		
		var itemTypeID = Zotero.ItemTypes.getID(itemType);
		if (!itemTypeID) {
			throw ("Invalid item type '" + itemType + "' in ItemFields.getFieldIDFromTypeAndBase()");
		}
		
		var baseFieldID = this.getID(baseField);
		if (!baseFieldID) {
			throw ("Invalid field '" + baseField + '" for base field in ItemFields.getFieldIDFromTypeAndBase()');
		}
		
		return _baseTypeFields[itemTypeID][baseFieldID];
	}
	
	
	/*
	 * Returns the fieldID of the base field for a given type-specific field
	 * 		or false if none
	 *
	 * Examples:
	 *
	 * 'audioRecording' and 'label' returns publisher's fieldID
	 * 'book' and 'publisher' returns publisher's fieldID
	 * 'audioRecording' and 'runningTime' returns false
	 *
	 * Accepts names or ids
	 */
	function getBaseIDFromTypeAndField(itemType, typeField) {
		var itemTypeID = Zotero.ItemTypes.getID(itemType);
		var typeFieldID = this.getID(typeField);
		
		if (!itemTypeID) {
			throw ("Invalid item type '" + itemType + "' in ItemFields.getBaseIDFromTypeAndField()");
		}
		
		_fieldCheck(typeField, 'getBaseIDFromTypeAndField');
		
		if (!this.isValidForType(typeFieldID, itemTypeID)) {
			throw ("'" + typeField + "' is not a valid field for '" + itemType + "' in ItemFields.getBaseIDFromTypeAndField()");
		}
		
		// If typeField is already a base field, just return that
		if (this.isBaseField(typeFieldID)) {
			return typeFieldID;
		}
		
		return Zotero.DB.valueQuery("SELECT baseFieldID FROM baseFieldMappings "
			+ "WHERE itemTypeID=? AND fieldID=?", [itemTypeID, typeFieldID]);
	}
	
	
	/*
	 * Returns an array of fieldIDs associated with a given base field
	 *
	 * e.g. 'publisher' returns fieldIDs for [university, studio, label, network]
	 */
	function getTypeFieldsFromBase(baseField, asNames) {
		var baseFieldID = this.getID(baseField);
		if (!baseFieldID) {
			throw ("Invalid base field '" + baseField + '" in ItemFields.getTypeFieldsFromBase()');
		}
		
		if (asNames) {
			return _typeFieldNamesByBase[baseFieldID] ?
				_typeFieldNamesByBase[baseFieldID] : false;
		}
		
		return _typeFieldIDsByBase[baseFieldID] ?
			_typeFieldIDsByBase[baseFieldID] : false;
	}
	
	
	/**
	* Check whether a field is valid, throwing an exception if not
	* (since it should never actually happen)
	**/
	function _fieldCheck(field, func) {
		var fieldID = self.getID(field);
		if (!fieldID) {
			throw ("Invalid field '" + field + (func ? "' in ItemFields." + func + "()" : "'"));
		}
		return fieldID;
	}
	
	
	/*
	 * Returns hash array of itemTypeIDs for which a given field is valid
	 */
	function _getFieldItemTypes(){
		var sql = 'SELECT fieldID, itemTypeID FROM itemTypeFields';
		
		var results = Zotero.DB.query(sql);
		
		if (!results){
			throw ('No fields in itemTypeFields!');
		}
		var fields = new Array();
		for (var i=0; i<results.length; i++){
			if (!fields[results[i]['fieldID']]){
				fields[results[i]['fieldID']] = new Array();
			}
			fields[results[i]['fieldID']][results[i]['itemTypeID']] = true;
		}
		return fields;
	}
	
	
	/*
	 * Build a lookup table for base field mappings
	 */
	function _loadBaseTypeFields() {
		// Grab all fields, base field or not
		var sql = "SELECT IT.itemTypeID, F.fieldID AS baseFieldID, BFM.fieldID "
			+ "FROM itemTypes IT LEFT JOIN fields F "
			+ "LEFT JOIN baseFieldMappings BFM"
			+ " ON (IT.itemTypeID=BFM.itemTypeID AND F.fieldID=BFM.baseFieldID)";
		var rows = Zotero.DB.query(sql);
		
		var sql = "SELECT DISTINCT baseFieldID FROM baseFieldMappings";
		var baseFields = Zotero.DB.columnQuery(sql);
		
		var fields = [];
		for each(var row in rows) {
			if (!fields[row.itemTypeID]) {
				fields[row.itemTypeID] = [];
			}
			if (row.fieldID) {
				fields[row.itemTypeID][row.baseFieldID] = row.fieldID;
			}
			// If a base field and already valid for the type, just use that
			else if (isBaseField(row.baseFieldID) &&
					isValidForType(row.baseFieldID, row.itemTypeID)) {
				fields[row.itemTypeID][row.baseFieldID] = row.baseFieldID;
			}
			// Set false for other fields so that we don't need to test for
			// existence
			else {
				fields[row.itemTypeID][row.baseFieldID] = false;
			}
		}
		
		_baseTypeFields = fields;
		
		
		var sql = "SELECT baseFieldID, fieldID, fieldName "
			+ "FROM baseFieldMappings JOIN fields USING (fieldID)";
		var rows = Zotero.DB.query(sql);
		for each(var row in rows) {
			if (!_typeFieldIDsByBase[row['baseFieldID']]) {
				_typeFieldIDsByBase[row['baseFieldID']] = [];
				_typeFieldNamesByBase[row['baseFieldID']] = [];
			}
			_typeFieldIDsByBase[row['baseFieldID']].push(row['fieldID']);
			_typeFieldNamesByBase[row['baseFieldID']].push(row['fieldName']);
		}
	}
	
	
	/*
	 * Load all fields into an internal hash array
	 */
	function _loadFields(){
		var result = Zotero.DB.query('SELECT * FROM fieldFormats');
		
		for (var i=0; i<result.length; i++){
			_fieldFormats[result[i]['fieldFormatID']] = {
				regex: result[i]['regex'],
				isInteger: result[i]['isInteger']
			};
		}
		
		var fields = Zotero.DB.query('SELECT * FROM fields');
		
		var fieldItemTypes = _getFieldItemTypes();
		
		var sql = "SELECT DISTINCT baseFieldID FROM baseFieldMappings";
		var baseFields = Zotero.DB.columnQuery(sql);
		
		for each(var field in fields){
			_fields[field['fieldID']] = {
				id: field['fieldID'],
				name: field['fieldName'],
				isBaseField: (baseFields.indexOf(field['fieldID']) != -1),
				formatID: field['fieldFormatID'],
				itemTypes: fieldItemTypes[field['fieldID']]
			};
			// Store by name as well as id
			_fields[field['fieldName']] = _fields[field['fieldID']];
		}
		
		_fieldsLoaded = true;
		
		_loadBaseTypeFields();
	}
}






/*
 * Zotero.getCollections(parent)
 *
 * Returns an array of all collections are children of a collection
 * as Zotero.Collection instances
 *
 * Takes parent collectionID as optional parameter;
 * by default, returns root collections
 */
Zotero.getCollections = function(parent, recursive){
	var toReturn = new Array();
	
	if (!parent){
		parent = null;
	}
	
	var sql = "SELECT collectionID AS id, collectionName AS name FROM collections C "
		+ "WHERE parentCollectionID " + (parent ? '=' + parent : ' IS NULL');
	var children = Zotero.DB.query(sql);
	
	if (!children){
		Zotero.debug('No child collections of collection ' + parent, 5);
		return toReturn;
	}
	
	// Do proper collation sort
	var collation = Zotero.getLocaleCollation();
	children.sort(function (a, b) {
		return collation.compareString(1, a.name, b.name);
	});
	
	for (var i=0, len=children.length; i<len; i++){
		var obj = Zotero.Collections.get(children[i].id);
		if (!obj){
			throw ('Collection ' + children[i].id + ' not found');
		}
		
		toReturn.push(obj);
		
		// If recursive, get descendents
		if (recursive){
			var desc = obj.getDescendents(false, 'collection');
			for (var j in desc){
				var obj2 = Zotero.Collections.get(desc[j]['id']);
				if (!obj2){
					throw ('Collection ' + desc[j] + ' not found');
				}
				
				// TODO: This is a quick hack so that we can indent subcollections
				// in the search dialog -- ideally collections would have a
				// getLevel() method, but there's no particularly quick way
				// of calculating that without either storing it in the DB or
				// changing the schema to Modified Preorder Tree Traversal,
				// and I don't know if we'll actually need it anywhere else.
				obj2.level = desc[j].level;
				
				toReturn.push(obj2);
			}
		}
	}
	
	return toReturn;
}
