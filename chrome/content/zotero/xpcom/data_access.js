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
Zotero.Item = function(){
	this._init();
	
	// Accept itemTypeID in constructor
	if (arguments.length){
		this.setType(Zotero.ItemTypes.getID(arguments[0]));
	}
}

Zotero.Item.prototype._init = function(){
	//
	// Public members for access by public methods -- do not access directly
	//
	this._data = [];
	this._creators = [];
	this._itemData = [];
	
	this._creatorsLoaded = false;
	this._itemDataLoaded = false;
	
	this._changed = new Zotero.Hash();
	this._changedCreators = new Zotero.Hash();
	this._changedItemData = new Zotero.Hash();
	
	this._noteText = null;
	this._noteIsAbstract = null
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
		Zotero.Item.primaryFields['numChildren'] = true;
		Zotero.Item.primaryFields['numNotes'] = true;
		Zotero.Item.primaryFields['numAttachments'] = true;
	}
	
	return !!Zotero.Item.primaryFields[field];
}

Zotero.Item.editableFields = {
	title: true
};

/*
 * Check if the specified primary field can be changed with setField()
 */
Zotero.Item.prototype.isEditableField = function(field){
	return !!Zotero.Item.editableFields[field];
}


/*
 * Build object from database
 */
Zotero.Item.prototype.loadFromID = function(id){
	// Should be the same as query in Zotero.Items.loadFromID, just
	// without itemID clause
	var sql = 'SELECT I.*, lastName || '
		+ 'CASE ((SELECT COUNT(*) FROM itemCreators WHERE itemID=' + id + ')>1) '
		+ "WHEN 0 THEN '' ELSE ' et al.' END AS firstCreator, "
		+ "(SELECT COUNT(*) FROM itemNotes WHERE sourceItemID=I.itemID) AS numNotes, "
		+ "(SELECT COUNT(*) FROM itemAttachments WHERE sourceItemID=I.itemID) AS numAttachments "
		+ 'FROM items I '
		+ 'LEFT JOIN itemCreators IC ON (I.itemID=IC.itemID) '
		+ 'LEFT JOIN creators C ON (IC.creatorID=C.creatorID) '
		+ 'WHERE itemID=' + id
		+ ' AND (IC.orderIndex=0 OR IC.orderIndex IS NULL)'; // first creator
	var row = Zotero.DB.rowQuery(sql);
	this.loadFromRow(row);
}


/*
 * Populate basic item data from a database row
 */
Zotero.Item.prototype.loadFromRow = function(row){
	this._init();
	for (col in row){
		// Only accept primary field data through loadFromRow()
		if (this.isPrimaryField(col)){
			// Return first line of content for note items
			if (col=='title' && this.isNote()){
				row[col] = this._noteToTitle();
			}
			
			this._data[col] = row[col];
		}
		else {
			Zotero.debug(col + ' is not a valid primary field');
		}
	}
	return true;
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
Zotero.Item.prototype.setType = function(itemTypeID){
	if (itemTypeID==this.getType()){
		return true;
	}
	
	// If existing type
	if (this.getType()){
		// Clear fields from old type that aren't in new one
		var sql = 'SELECT fieldID FROM itemTypeFields '
			+ 'WHERE itemTypeID=' + this.getType() + ' AND fieldID NOT IN '
			+ '(SELECT fieldID FROM itemTypeFields WHERE itemTypeID='
			+ itemTypeID + ')';
		var obsoleteFields = Zotero.DB.columnQuery(sql);
		
		if (obsoleteFields){
			for (var i=0; i<obsoleteFields.length; i++){
				this.setField(obsoleteFields[i],false);
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
	this._changed.set('itemTypeID');
	return true;
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
	return !!parseInt(Zotero.DB.valueQuery("SELECT COUNT(*) collectionID "
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
	
	// Go to length+1 so we clear the last one
	for (var i=orderIndex, max=this._creators.length+1; i<max; i++){
		var next = this._creators[i+1] ? this._creators[i+1] : false;
		this._creators[i] = next;
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
 * If _unformatted_ is true, skip any special processing of DB value
 *		(e.g. multipart date field) (default false)
 */
Zotero.Item.prototype.getField = function(field, unformatted){
	//Zotero.debug('Requesting field ' + field + ' for item ' + this.getID(), 4);
	if (this.isPrimaryField(field)){
		return this._data[field] ? this._data[field] : '';
	}
	else {
		if (this.getID() && !this._itemDataLoaded){
			this._loadItemData();
		}
		
		var fieldID = Zotero.ItemFields.getID(field);
		
		var value = this._itemData[fieldID] ? this._itemData[fieldID] : '';
		
		if (!unformatted){
			if (fieldID==Zotero.ItemFields.getID('date')){
				value = Zotero.Date.multipartToStr(value);
			}
		}
		
		return value;
	}
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
		if (!this.isEditableField(field)){
			throw ('Primary field ' + field + ' cannot be changed through ' +
				'setField');
		}
		
		if (this._data[field] != undefined && this._data[field]==value){
			return false;
		}
		this._data[field] = value;
		if (!loadIn){
			this._changed.set(field);
		}
		return true;
	}
	// Type-specific field
	else {
		if (!this.getType()){
			throw ('Item type must be set before setting field data.');
		}
		
		// If existing item, load field data first unless we're already in
		// the middle of a load
		if (this.getID() && !loadIn && !this._itemDataLoaded){
			this._loadItemData();
		}
		
		var fieldID = Zotero.ItemFields.getID(field);
		
		if (!fieldID){
			throw (field + ' is not a valid itemData field.');
		}
		
		if (!Zotero.ItemFields.isValidForType(fieldID, this.getType())){
			throw (field + ' is not a valid field for this type.');
		}
		
		// Save date field as multipart date
		if (!loadIn){
			if (fieldID==Zotero.ItemFields.getID('date') &&
					!Zotero.Date.isMultipart(value)){
				value = Zotero.Date.strToMultipart(value);
			}
		}
		
		// If existing value, make sure it's actually changing
		if ((!this._itemData[fieldID] && !value) ||
			(this._itemData[fieldID] && this._itemData[fieldID]==value)){
			return false;
		}
		this._itemData[fieldID] = value;
		if (!loadIn){
			this._changedItemData.set(fieldID);
		}
		return true;
	}
}


/*
 * Save changes back to database
 *
 * Note: Does not call notify() if transaction is in progress
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
			if (this._changed.has('title')){
				sql += "title=?, ";
				sqlValues.push({'string':this.getField('title')});
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
				
				// Delete obsolete creators
				var deleted;
				if (deleted = Zotero.Creators.purge()){
					for (var i in deleted){
						// Add purged creators to history
						Zotero.History.remove('creators', 'creatorID', i);
					}
				}
			}
			
			
			//
			// ItemData
			//
			if (this._changedItemData.length){
				var del = new Array();
				
				sql = "SELECT COUNT(*) FROM itemData WHERE itemID=? AND fieldID=?";
				var countStatement = Zotero.DB.getStatement(sql);
				
				sql = "UPDATE itemData SET value=? WHERE itemID=? AND fieldID=?";
				var updateStatement = Zotero.DB.getStatement(sql);
				
				sql = "INSERT INTO itemData VALUES (?,?,?)";
				var insertStatement = Zotero.DB.getStatement(sql);
				
				for (fieldID in this._changedItemData.items){
					if (this.getField(fieldID)){
						// Oh, for an INSERT...ON DUPLICATE KEY UPDATE
						countStatement.bindInt32Parameter(0, this.getID());
						countStatement.bindInt32Parameter(1, fieldID);
						countStatement.executeStep();
						var exists = countStatement.getInt64(0);
						countStatement.reset();
						
						// Update
						if (exists){
							updateStatement.bindInt32Parameter(1, this.getID());
							
							Zotero.History.modify('itemData', 'itemID-fieldID',
								[this.getID(), fieldID]);
							
							// Don't bind CURRENT_TIMESTAMP as string
							if (Zotero.ItemFields.getID('accessDate')==fieldID
								&& this.getField(fieldID)=='CURRENT_TIMESTAMP')
							{
								sql = "UPDATE itemData SET value=CURRENT_TIMESTAMP"
									+ " WHERE itemID=? AND fieldID=?";
								Zotero.DB.query(sql,
									[{int:this.getID()}, {int:fieldID}]);
							}
							else {
								// Take advantage of SQLite's manifest typing
								if (Zotero.ItemFields.isInteger(fieldID)){
									updateStatement.bindInt32Parameter(0,
										this.getField(fieldID, true));
								}
								else {
									updateStatement.bindUTF8StringParameter(0,
										this.getField(fieldID, true));
								}
								updateStatement.bindInt32Parameter(2, fieldID);
								try {
									updateStatement.execute();
								}
								catch(e){
									throw(Zotero.DB.getLastErrorString());
								}
							}
						}
						
						// Insert
						else {
							Zotero.History.add('itemData', 'itemID-fieldID',
								[this.getID(), fieldID]);
							
							insertStatement.bindInt32Parameter(0, this.getID());
							insertStatement.bindInt32Parameter(1, fieldID);
							
							if (Zotero.ItemFields.getID('accessDate')==fieldID
								&& this.getField(fieldID)=='CURRENT_TIMESTAMP')
							{
								sql = "INSERT INTO itemData VALUES "
									+ "(?,?,CURRENT_TIMESTAMP)";
								
								Zotero.DB.query(sql,
									[{int:this.getID()}, {int:fieldID}]);
							}
							else {
								if (Zotero.ItemFields.isInteger(fieldID)){
									insertStatement.bindInt32Parameter(2,
										this.getField(fieldID, true));
								}
								else {
									insertStatement.bindUTF8StringParameter(2,
										this.getField(fieldID, true));
								}
								
								try {
									insertStatement.execute();
								}
								catch(e){
									throw(Zotero.DB.getLastErrorString());
								}
							}
						}
					}
					
					// If field changed and is empty, mark row for deletion
					else {
						del.push(fieldID);
					}
				}
				
				countStatement.reset();
				updateStatement.reset();
				insertStatement.reset();
				
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
		
		if (this._changed.has('title')){
			sqlColumns.push('title');
			sqlValues.push({'string':this.getField('title')});
		}
		
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
				var statement =
					Zotero.DB.getStatement("INSERT INTO itemData VALUES (?,?,?)");
				
				for (fieldID in this._changedItemData.items){
					if (!this.getField(fieldID, true)){
						continue;
					}
					
					statement.bindInt32Parameter(0, this.getID());
					statement.bindInt32Parameter(1, fieldID);
					
					if (Zotero.ItemFields.getID('accessDate')==fieldID
						&& this.getField(fieldID)=='CURRENT_TIMESTAMP')
					{
						sql = "INSERT INTO itemData VALUES (?,?,CURRENT_TIMESTAMP)";
						Zotero.DB.query(sql, [{int:this.getID()}, {int:fieldID}])
					}
					else {
						if (Zotero.ItemFields.isInteger(fieldID)){
							statement.bindInt32Parameter(2, this.getField(fieldID, true));
						}
						else {
							statement.bindUTF8StringParameter(2, this.getField(fieldID, true));
						}
						try {
							statement.execute();
						}
						catch(e){
							throw(Zotero.DB.getLastErrorString());
						}
					}
					
					Zotero.History.add('itemData', 'itemID-fieldID',
						[itemID, fieldID]);
				}
				
				statement.reset();
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
		if (!Zotero.DB.transactionInProgress()){
			Zotero.Notifier.trigger('add', 'item', this.getID());
		}
		return this.getID();
	}
	else {
		if (!Zotero.DB.transactionInProgress()){
			Zotero.Notifier.trigger('modify', 'item', this.getID());
		}
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
	
	if (this.isNote()){
		var sourceItemID = this.getSource();
	}
	
	if (sourceItemID)
	{
		var sql = "REPLACE INTO itemNotes (note, sourceItemID, itemID, isAbstract) "
			+ "VALUES (?,?,?,?)";
		var bindParams = [{string:text}, sourceItemID, this.getID(), this.isAbstract() ? 1 : null];
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
		this.updateNoteCache(text, this.isAbstract());
		
		Zotero.Notifier.trigger('modify', 'item', this.getID());
	}
	else {
		Zotero.DB.commitTransaction();
	}
}


Zotero.Item.prototype.updateNoteCache = function(text, isAbstract){
	// Update cached values
	this._noteText = text ? text : '';
	if (this.isNote()){
		this._noteIsAbstract = !!isAbstract;
		this.setField('title', this._noteToTitle(), true);
	}
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
	
	var newItem = Zotero.Items.get(sourceItemID);
	// FK check
	if (sourceItemID && !newItem){
		Zotero.DB.rollbackTransaction();
		throw ("Cannot set " + type + " source to invalid item " + sourceItemID);
	}
	
	var oldSourceItemID = this.getSource();
	
	if (oldSourceItemID==sourceItemID){
		Zotero.debug(Type + " source hasn't changed", 4);
		Zotero.DB.commitTransaction();
		return false;
	}
	
	var oldItem = Zotero.Items.get(oldSourceItemID);
	if (oldSourceItemID && !oldItem){
		Zotero.debug("Old source item " + oldSourceItemID
			+ "didn't exist in setSource()", 2);
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
	
	if (this.isAbstract()) {
		// If making an independent note or if new item already has an
		// abstract, clear abstract status
		if (!sourceItemID || newItem.getAbstract()) {
			this.setAbstract(false);
		}
	}
	
	var sql = "UPDATE item" + Type + "s SET sourceItemID=? WHERE itemID=?";
	var bindParams = [sourceItemID ? {int:sourceItemID} : null, this.getID()];
	Zotero.DB.query(sql, bindParams);
	this.updateDateModified();
	Zotero.DB.commitTransaction();
	
	Zotero.Notifier.trigger('modify', 'item', this.getID());
	
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
		Zotero.Notifier.trigger('modify', 'item', oldSourceItemID);
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
		Zotero.Notifier.trigger('modify', 'item', sourceItemID);
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
* Get the text of an item note
**/
Zotero.Item.prototype.getNote = function(){
	if (!this.isNote() && !this.isAttachment()){
		throw ("getNote() can only be called on notes and attachments");
	}
	
	if (this._noteText !== null){
		// Store access time for later garbage collection
		this._noteAccessTime = new Date();
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
		+ "WHERE sourceItemID=" + this.getID() + " ORDER BY isAbstract IS NULL, dateAdded";
	return Zotero.DB.columnQuery(sql);
}


/*
 * Return true if a note item is an abstract, false otherwise
 */
Zotero.Item.prototype.isAbstract = function() {
	if (this.isAttachment()) {
		return false;
	}
	
	if (!this.isNote()) {
		throw ("isAbstract() can only be called on note items");
	}
	
	if (!this.getID()) {
		throw ("Cannot call isAbstract() on unsaved item");
	}
	
	if (this._noteIsAbstract !== null) {
		return this._noteIsAbstract;
	}
	
	var sql = "SELECT isAbstract FROM itemNotes WHERE itemID=?";
	var isAbstract = !!Zotero.DB.valueQuery(sql, this.getID());
	
	this._noteIsAbstract = isAbstract;
	return isAbstract;
}


/*
 * Make a note item an abstract or clear abstract status
 */
Zotero.Item.prototype.setAbstract = function(set) {
	if (!this.isNote()) {
		throw ("setAbstract() can only be called on note items");
	}
	
	if (!this.getID()) {
		throw ("Cannot call setAbstract() on unsaved item");
	}
	
	if (!!set == !!this.isAbstract()) {
		Zotero.debug('Abstract status has not changed', 4);
		return;
	}
	
	Zotero.DB.beginTransaction();
	
	var sourceItemID = this.getSource();
	
	if (!sourceItemID) {
		Zotero.DB.rollbackTransaction();
		throw ("Cannot make a non-child note an abstract");
	}
	
	if (set) {
		// If existing abstract, clear it
		var oldAbstractID = Zotero.Items.get(sourceItemID).getAbstract();
		if (oldAbstractID) {
			var oldAbstractItem = Zotero.Items.get(oldAbstractID);
			oldAbstractItem.setAbstract(false);
		}
	}
	
	var sql = "UPDATE itemNotes SET isAbstract=NULL WHERE sourceItemID=?";
	Zotero.DB.query(sql, sourceItemID);
	
	var sql = "UPDATE itemNotes SET isAbstract=? WHERE itemID=?";
	Zotero.DB.valueQuery(sql, [set ? 1 : null, this.getID()]);
	
	this.removeAllRelated();
	this.removeAllTags();
	
	Zotero.DB.commitTransaction();
	
	this._noteIsAbstract = !!set;
	
	Zotero.Notifier.trigger('modify', 'item', [this.getID(), sourceItemID]);
}


/*
 * Return the itemID of a parent item's abstract note, or false if none
 */
Zotero.Item.prototype.getAbstract = function() {
	if (!this.isRegularItem()) {
		throw ("getAbstract() can only be called on regular items");
	}
	
	if (!this.getID()) {
		throw ("Cannot call getAbstract() on unsaved item");
	}
	
	var sql = "SELECT itemID FROM itemNotes WHERE sourceItemID=? AND isAbstract=1";
	return Zotero.DB.valueQuery(sql, this.getID());
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
Zotero.Item.prototype.getFile = function(row){
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
	
	if (!file.exists()){
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
Zotero.Item.prototype.renameAttachmentFile = function(newName, force) {
	var file = this.getFile();
	if (!file) {
		return false;
	}
	
	try {
		var dest = file.parent;
		dest.append(newName);
		
		if (force) {
			dest.remove(null);
		}
		else if (dest.exists()) {
			return -1;
		}
		
		file.moveTo(file.parent, newName);
		
		var linkMode = this.getAttachmentLinkMode();
		var path = Zotero.Attachments.getPath(file, linkMode);
		
		var sql = "UPDATE itemAttachments SET path=? WHERE itemID=?";
		Zotero.DB.query(sql, [path, this.getID()]);
		
		return true;
	}
	catch (e) {
		return -2;
	}
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
	
	if (this._fileLinkMode!==null){
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
* Returns an array of attachment itemIDs that have this item as a source
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
Zotero.Item.prototype.addTag = function(tag){
	if (!this.getID()){
		throw ('Cannot add tag to unsaved item in Item.addTag()');
	}
	
	if (this.isAbstract()) {
		throw ('Cannot add tag to abstract note');
	}
	
	if (!tag){
		Zotero.debug('Not saving empty tag in Item.addTag()', 2);
		return false;
	}
	
	Zotero.DB.beginTransaction();
	var tagID = Zotero.Tags.getID(tag);
	if (!tagID){
		var tagID = Zotero.Tags.add(tag);
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
	
	if (this.isAbstract()) {
		throw ('Cannot add tag to abstract note');
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
	
	return true;
}

Zotero.Item.prototype.hasTag = function(tagID) {
	var sql = "SELECT COUNT(*) FROM itemTags WHERE itemID=? AND tagID=?";
	return !!Zotero.DB.valueQuery(sql, [this.getID(), tagID]);
}

Zotero.Item.prototype.getTags = function(){
	var sql = "SELECT tag FROM tags WHERE tagID IN "
		+ "(SELECT tagID FROM itemTags WHERE itemID=" + this.getID() + ") "
		+ "ORDER BY tag COLLATE NOCASE";
	return Zotero.DB.columnQuery(sql);
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
}

Zotero.Item.prototype.removeAllTags = function(){
	if (!this.getID()) {
		throw ('Cannot remove tags on unsaved item');
	}
	
	Zotero.DB.beginTransaction();
	Zotero.DB.query("DELETE FROM itemTags WHERE itemID=?", this.getID());
	Zotero.Tags.purge();
	Zotero.DB.commitTransaction();
	Zotero.Notifier.trigger('modify', 'item', this.getID());
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
	
	if (this.isAbstract()) {
		throw ('Cannot add Related item to abstract note');
	}
	
	Zotero.DB.beginTransaction();
	
	if (!Zotero.Items.get(itemID)){
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
	
	var sql = "INSERT INTO itemSeeAlso VALUES (?,?)";
	Zotero.DB.query(sql, [this.getID(), {int:itemID}]);
	Zotero.DB.commitTransaction();
	Zotero.Notifier.trigger('modify', 'item', [this.getID(), itemID]);
	return true;
}

Zotero.Item.prototype.removeSeeAlso = function(itemID){
	if (!this.getID()) {
		throw ('Cannot remove related item of unsaved item');
	}
	
	Zotero.DB.beginTransaction();
	var sql = "DELETE FROM itemSeeAlso WHERE itemID=? AND linkedItemID=?";
	Zotero.DB.query(sql, [this.getID(), itemID]);
	var sql = "DELETE FROM itemSeeAlso WHERE itemID=? AND linkedItemID=?";
	Zotero.DB.query(sql, [itemID, this.getID()]);
	Zotero.DB.commitTransaction();
	Zotero.Notifier.trigger('modify', 'item', [this.getID(), itemID]);
}

Zotero.Item.prototype.removeAllRelated = function() {
	if (!this.getID()) {
		throw ('Cannot remove related items of unsaved item');
	}
	
	Zotero.DB.beginTransaction();
	var relateds = this.getSeeAlso();
	Zotero.DB.query("DELETE FROM itemSeeAlso WHERE itemID=?", this.getID());
	Zotero.DB.query("DELETE FROM itemSeeAlso WHERE linkedItemID=?", this.getID());
	Zotero.DB.commitTransaction();
	
	if (relateds) {
		Zotero.Notifier.trigger('modify', 'item', relateds);
	}
}

Zotero.Item.prototype.getSeeAlso = function(){
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
	
	if (itemType == 'note' && this.isAbstract()) {
		itemType = 'note-abstract';
	}
	
	return Zotero.ItemTypes.getImageSrc(itemType);
}


/**
* Delete item from database and clear from Zotero.Items internal array
**/
Zotero.Item.prototype.erase = function(deleteChildren){
	if (!this.getID()){
		return false;
	}
	
	Zotero.debug('Deleting item ' + this.getID());
	
	var changedItems = [];
	
	Zotero.DB.beginTransaction();
	
	// Remove item from parent collections
	var parentCollectionIDs = this.getCollections();
	if (parentCollectionIDs){
		var notifierState = Zotero.Notifier.isEnabled();
		Zotero.Notifier.disable();
		
		for (var i=0; i<parentCollectionIDs.length; i++){
			Zotero.Collections.get(parentCollectionIDs[i]).removeItem(this.getID());
		}
		
		if (notifierState){
			Zotero.Notifier.enable();
		}
		else {
			Zotero.Notifier.disable();
		}
	}
	
	// Note
	if (this.isNote()){
		// Decrement note count of source items
		var sql = "SELECT sourceItemID FROM itemNotes WHERE itemID=" + this.getID();
		var sourceItemID = Zotero.DB.valueQuery(sql);
		if (sourceItemID){
			var sourceItem = Zotero.Items.get(sourceItemID);
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
			sourceItem.decrementAttachmentCount();
			changedItems.push(sourceItemID);
		}
		
		// Delete associated files
		var linkMode = this.getAttachmentLinkMode();
		switch (linkMode){
			case Zotero.Attachments.LINK_MODE_LINKED_FILE:
			case Zotero.Attachments.LINK_MODE_LINKED_URL:
				// Links only -- nothing to delete
				break;
			default:
				var file = Zotero.getStorageDirectory();
				file.append(this.getID());
				if (file.exists()){
					file.remove(true);
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
			changedItems.push(childNotes);
		}
		var sql = "UPDATE itemNotes SET sourceItemID=NULL WHERE sourceItemID="
			+ this.getID();
		Zotero.DB.query(sql);
		
		// Attachments
		var sql = "SELECT itemID FROM itemAttachments WHERE sourceItemID=" + this.getID();
		var childAttachments = Zotero.DB.columnQuery(sql);
		if (childAttachments){
			changedItems.push(childAttachments);
		}
		var sql = "UPDATE itemAttachments SET sourceItemID=NULL WHERE sourceItemID="
			+ this.getID();
		Zotero.DB.query(sql);
	}
	
	// Flag See Also links for notification
	var seeAlso = this.getSeeAlso();
	if (seeAlso){
		changedItems = changedItems.concat(seeAlso);
	}
	
	// Clear fulltext cache
	Zotero.Fulltext.clearItemWords(this.getID());
	//Zotero.Fulltext.clearItemContent(this.getID());
	Zotero.Fulltext.purgeUnusedWords();
	
	sql = 'DELETE FROM itemCreators WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemNotes WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemAttachments WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemSeeAlso WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemSeeAlso WHERE linkedItemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemTags WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemData WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM items WHERE itemID=' + this.getID() + ";\n";
	
	Zotero.DB.query(sql);
	Zotero.Creators.purge();
	Zotero.Tags.purge();
	
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
		Zotero.Notifier.trigger('modify', 'item', changedItems);
	}
	
	// If we're not in the middle of a larger commit, trigger the notifier now
	Zotero.Notifier.trigger('delete', 'item', this.getID());
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
			
			// For the rest, just copy over
			default:
				arr[i] = this._data[i];
		}
	}
	
	// Item metadata
	for (var i in this._itemData){
		arr[Zotero.ItemFields.getName(i)] = this._itemData[i];
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
	if (this.isNote()){
		// Don't need title for notes
		delete arr['title'];
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
	
	arr['tags'] = this.getTags();
	arr['seeAlso'] = this.getSeeAlso();
	
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
	
	var sql = 'SELECT ID.fieldID, value FROM itemData ID JOIN '
		+ 'itemTypeFields ITF ON (ITF.itemTypeID=(SELECT itemTypeID FROM '
		+ 'items WHERE itemID=?1) AND ITF.fieldID=ID.fieldID) '
		+ 'WHERE itemID=?1 ORDER BY orderIndex';
		
	var result = Zotero.DB.query(sql,[{'int':this._data['itemID']}]);
	
	this._itemDataLoaded = true;
	
	if (result){
		for (var i=0,len=result.length; i<len; i++){
			this.setField(result[i]['fieldID'], result[i]['value'], true);
		}
		return true;
	}
	else {
		return false;
	}
}


/**
* Return first line (or first MAX_LENGTH characters) of note content
**/
Zotero.Item.prototype._noteToTitle = function(){
	var MAX_LENGTH = 80;
	
	var t = this.getNote().substring(0, MAX_LENGTH);
	var ln = t.indexOf("\n");
	if (ln>-1 && ln<MAX_LENGTH){
		t = t.substring(0, ln);
	}
	return t;
}




/*
 * Primary interface for accessing Zotero items
 */
Zotero.Items = new function(){
	// Private members
	var _items = new Array();
	
	// Privileged methods
	this.get = get;
	this.getAll = getAll;
	this.reload = reload;
	this.reloadAll = reloadAll;
	this.getNewItemByType = getNewItemByType;
	this.search = search;
	this.erase = erase;
	this.unload = unload;
	
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
			return _items[arguments[0]];
		}
		
		// Otherwise, build return array
		for (i=0; i<ids.length; i++){
			if (!_items[ids[i]]){
				Zotero.debug("Item " + ids[i] + " not loaded -- this shouldn't happen", 2);
			}
			loaded.push(_items[ids[i]]);
		}
		
		return loaded;
	}
	
	
	/*
	 * Returns all items in the database
	 */
	function getAll(){
		var sql = 'SELECT itemID FROM items';
		// DEBUG: default order?
		
		var ids = Zotero.DB.columnQuery(sql);
		return this.get(ids);
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
	
	
	/*
	 * Reloads all items
	 */
	function reloadAll(){
		_items = new Array();
		_load();
	}
	
	
	function getNewItemByType(itemTypeID){
		return new Zotero.Item(itemTypeID);
	}
	
	
	function add(data, itemTypeID){
		var insert = new Array();
		
		var obj = new Zotero.Item(itemTypeID);
		
		for (field in data){
			obj.setField(data[field]);
		}
		
		var id = obj.save();
		
		return this.get(id);
	}
	
	
	/**
	* Fulltext search on all fields
	*
	* TODO: more
	**/
	function search(text, parentCollectionID){
		if (!text){
			text = '';
		}
		
		var sql = "SELECT itemID FROM items WHERE title LIKE ?1 UNION "
			+ "SELECT itemID FROM itemData WHERE value LIKE ?1 UNION "
			+ "SELECT itemID FROM itemCreators WHERE creatorID IN "
			+ "(SELECT creatorID FROM creators WHERE firstName LIKE ?1 "
				+ "OR lastName LIKE ?1) UNION "
			+ "SELECT itemID FROM itemTags WHERE tagID IN "
			+ "(SELECT tagID FROM tags WHERE tag LIKE ?1) UNION "
			+ "SELECT itemID FROM itemNotes WHERE note LIKE ?1";
		
		var sqlParams = [{'string':'%' + text + '%'}];
		
		if (parentCollectionID){
			sql = "SELECT itemID FROM (" + sql + ") WHERE itemID IN "
				+ "(SELECT itemID FROM collectionItems WHERE collectionID=?2)";
			sqlParams.push({'int':parentCollectionID});
		}
		
		return Zotero.DB.columnQuery(sql, sqlParams);
	}
	
	
	/**
	* Delete item(s) from database and clear from internal array
	*
	* If _eraseChildren_ is true, erase child items as well
	**/
	function erase(ids, eraseChildren){
		var unlock = Zotero.Notifier.begin(true);
		try {
			for each(var id in ids) {
				var item = this.get(id);
				if (!item) {
					Zotero.debug('Item ' + id + ' does not exist in Items.erase()!', 1);
					Zotero.Notifier.trigger('item', 'delete', id);
					continue;
				}
				item.erase(eraseChildren); // calls unload()
				item = undefined;
			}
		}
		finally {
			Zotero.Notifier.commit(unlock);
		}
	}
	
	
	/**
	* Clear item from internal array (used by Zotero.Item.erase())
	**/
	function unload(id){
		delete _items[id];
	}
	
	
	function _load(){
		// Should be the same as query in Zotero.Item.loadFromID, just
		// without itemID clause
		var sql = 'SELECT I.*, lastName || '
			+ 'CASE ((SELECT COUNT(*) FROM itemCreators WHERE itemID=I.itemID)>1) '
			+ "WHEN 0 THEN '' ELSE ' et al.' END AS firstCreator, "
			+ "(SELECT COUNT(*) FROM itemNotes WHERE sourceItemID=I.itemID) AS numNotes, "
			+ "(SELECT COUNT(*) FROM itemAttachments WHERE sourceItemID=I.itemID) AS numAttachments "
			+ 'FROM items I '
			+ 'LEFT JOIN itemCreators IC ON (I.itemID=IC.itemID) '
			+ 'LEFT JOIN creators C ON (IC.creatorID=C.creatorID) '
			+ 'WHERE (IC.orderIndex=0 OR IC.orderIndex IS NULL)';
		
		if (arguments[0]){
			sql += ' AND I.itemID IN (' + Zotero.join(arguments,',') + ')';
		}
		
		var result = Zotero.DB.query(sql);
		
		if (result){
			for (var i=0,len=result.length; i<len; i++){
				// Item doesn't exist -- create new object and stuff in array
				if (!_items[result[i]['itemID']]){
					var obj = new Zotero.Item();
					obj.loadFromRow(result[i]);
					_items[result[i]['itemID']] = obj;
				}
				// Existing item -- reload in place
				else {
					_items[result[i]['itemID']].loadFromRow(result[i]);
				}
			}
		}
		return true;
	}
}




Zotero.Notes = new function(){
	this.add = add;
	
	/**
	* Create a new item of type 'note' and add the note text to the itemNotes table
	*
	* Returns the itemID of the new note item
	**/
	function add(text, sourceItemID, isAbstract){
		Zotero.DB.beginTransaction();
		
		if (sourceItemID){
			var sourceItem = Zotero.Items.get(sourceItemID);
			if (!sourceItem){
				Zotero.DB.commitTransaction();
				throw ("Cannot set note source to invalid item " + sourceItemID);
			}
			if (sourceItem.isNote()){
				Zotero.DB.commitTransaction();
				throw ("Cannot set note source to another note (" + sourceItemID + ")");
			}
		}
		
		// If creating abstract, clear abstract status of existing abstract
		// for source item
		if (isAbstract && sourceItemID) {
			var oldAbstractID = Zotero.Items.get(sourceItemID).getAbstract();
			if (oldAbstractID) {
				var oldAbstractItem = Zotero.Items.get(oldAbstractID);
				oldAbstractItem.setAbstract(false);
			}
		}
		
		var note = Zotero.Items.getNewItemByType(Zotero.ItemTypes.getID('note'));
		note.save();
		
		var sql = "INSERT INTO itemNotes VALUES (?,?,?,?)";
		var bindParams = [
			note.getID(),
			(sourceItemID ? {int:sourceItemID} : null),
			{string: text ? text : ''},
			isAbstract ? 1 : null,
		];
		Zotero.DB.query(sql, bindParams);
		Zotero.DB.commitTransaction();
		
		// Switch to Zotero.Items version
		var note = Zotero.Items.get(note.getID());
		note.updateNoteCache(text, isAbstract);
		
		if (sourceItemID){
			sourceItem.incrementNoteCount();
			Zotero.Notifier.trigger('modify', 'item', sourceItemID);
		}
		
		Zotero.Notifier.trigger('add', 'item', note.getID());
		
		return note.getID();
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
	
	var sql = "UPDATE collections SET collectionName=? "
		+ "WHERE collectionID=?";
	Zotero.DB.query(sql, [{'string':name},{'int':this.getID()}]);
	this._name = name;
	
	Zotero.Notifier.trigger('modify', 'collection', this.getID());
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
	
	// TODO: only reload the necessary ones
	Zotero.Collections.reloadAll();
	Zotero.Notifier.trigger('move', 'collection', notifyIDs);
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
		// DEBUG: is this necessary?
		Zotero.Notifier.trigger('modify', 'collection', this.getID());
	}
	
	Zotero.Notifier.trigger('add', 'item', itemID);
}


/**
* Remove an item from the collection (does not delete item from library)
**/
Zotero.Collection.prototype.removeItem = function(itemID){
	Zotero.DB.beginTransaction();
	
	var sql = "SELECT orderIndex FROM collectionItems "
		+ "WHERE collectionID=" + this._id + " AND itemID=" + itemID;
	var orderIndex = Zotero.DB.valueQuery(sql);
	
	if (orderIndex===false){
		Zotero.debug('Item ' + itemID + ' is not a child of collection '
			+ this._id);
		Zotero.DB.rollbackTransaction();
		return false;
	}
	
	var sql = "DELETE FROM collectionItems WHERE collectionID=" + this._id
		+ " AND itemID=" + itemID;
	Zotero.DB.query(sql);
	
	// Move down items above deleted item in collection
	sql = 'UPDATE collectionItems SET orderIndex=orderIndex-1 '
		+ 'WHERE collectionID=' + this._id
		+ ' AND orderIndex>' + orderIndex;
	Zotero.DB.query(sql);
	
	Zotero.DB.commitTransaction();
	this._childItems.remove(itemID);
	
	// If this was the last item, set collection to empty
	if (!this._childItems.length){
		this._hasChildItems = false;
		// DEBUG: is this necessary? if so, it's no longer called during item deletes...
		Zotero.Notifier.trigger('modify', 'collection', this.getID());
	}
	
	Zotero.Notifier.trigger('remove', 'item', itemID);
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
	
	for(var i=0, len=descendents.length; i<len; i++){
		// Descendent collections
		if (descendents[i]['type']=='collection'){
			collections.push(descendents[i]['id']);
		}
		// Descendent items
		else {
			if (deleteItems){
				// Delete items from DB
				Zotero.Items.get(descendents[i]['id']).erase();
				items.push(descendents[i]['id']);
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
	
	Zotero.Notifier.trigger('delete', 'collection', collections);
	if (items.length){
		Zotero.Notifier.trigger('delete', 'item', items);
	}
}


Zotero.Collection.prototype.isCollection = function(){
	return true;
}


Zotero.Collection.prototype.toArray = function(){
	return this.getDescendents(true);
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
	else {
		Zotero.debug('Collection ' + this._id + ' has no child items');
	}
	
	this._childItemsLoaded = true;
}


/**
* Returns an array of descendent collections and items
* 	(rows of 'id', 'type' ('item' or 'collection'), and, if collection, 'name')
*
* nested: Return multidimensional array with 'children' nodes instead of flat array
**/
Zotero.Collection.prototype.getDescendents = function(nested, type){
	var toReturn = new Array();
	
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
						type: 'collection'
					});
				}
				
				var descendents =
					Zotero.Collections.get(children[i]['id']).getDescendents(nested, type);
				
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
	this.reloadAll = reloadAll;
	this.unload = unload;
	
	/*
	 * Returns a Zotero.Collection object for a collectionID
	 */
	function get(id){
		if (!_collectionsLoaded){
			_load();
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
		
		_load(rnd);
		Zotero.Notifier.trigger('add', 'collection', rnd);
		
		return this.get(rnd);
	}
	
	
	/**
	* Clears internal cache and reloads collection data from DB
	**/
	function reloadAll(){
		_collections = new Array();
		_load();
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
	function _load(){
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
		
		if (result){
			for (var i=0; i<result.length; i++){
				var collectionID = result[i]['collectionID'];
				
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
	var _tags = new Array; // indexed by tag text
	var _tagsByID = new Array; // indexed by tagID
	
	this.getName = getName;
	this.getID = getID;
	this.getAll = getAll;
	this.getAllWithinSearch = getAllWithinSearch;
	this.getTagItems = getTagItems;
	this.search = search;
	this.add = add;
	this.rename = rename;
	this.remove = remove;
	this.purge = purge;
	
	/*
	 * Returns a tag for a given tagID
	 */
	function getName(tagID){
		if (_tagsByID[tagID]){
			return _tagsByID[tagID];
		}
		
		var sql = 'SELECT tag FROM tags WHERE tagID=' + tagID;
		var result = Zotero.DB.valueQuery(sql);
		
		if (!result){
			return false;
		}
		
		_tagsByID[tagID] = result;
		return result;
	}
	
	
	/*
	 * Returns the tagID matching given tag
	 */
	function getID(tag){
		if (_tags[tag]){
			return _tags[tag];
		}
		
		var sql = 'SELECT tagID FROM tags WHERE tag=?';
		var tagID = Zotero.DB.valueQuery(sql, [{string:tag}]);
		
		if (tagID){
			_tags[tag] = tagID;
		}
		
		return tagID;
	}
	
	
	/**
	 * Get all tags indexed by tagID
	 */
	function getAll(){
		var sql = 'SELECT tagID, tag FROM tags ORDER BY tag COLLATE NOCASE';
		var tags = Zotero.DB.query(sql);
		var indexed = {};
		for (var i in tags){
			indexed[tags[i]['tagID']] = tags[i]['tag'];
		}
		return indexed;
	}
	
	
	/*
	 * Get all tags within the items of a Zotero.Search object
	 */
	function getAllWithinSearch(search) {
		var searchSQL = search.getSQL();
		var searchParams = search.getSQLParams();
		
		var sql = "SELECT DISTINCT tagID, tag FROM itemTags NATURAL JOIN tags "
			+ "WHERE itemID IN (" + searchSQL + ") ORDER BY tag COLLATE NOCASE";
		var tags = Zotero.DB.query(sql, searchParams);
		var indexed = {};
		for (var i in tags){
			indexed[tags[i]['tagID']] = tags[i]['tag'];
		}
		return indexed;
	}
	
	
	function getTagItems(tagID) {
		var sql = "SELECT itemID FROM itemTags WHERE tagID=?";
		return Zotero.DB.columnQuery(sql, tagID);
	}
	
	
	function search(str){
		var sql = 'SELECT tagID, tag FROM tags WHERE tag LIKE ? '
			+ 'ORDER BY tag COLLATE NOCASE';
		var tags = Zotero.DB.query(sql, '%' + str + '%');
		var indexed = {};
		for (var i in tags){
			indexed[tags[i]['tagID']] = tags[i]['tag'];
		}
		return indexed;
	}
	
	
	/*
	 * Add a new tag to the database
	 *
	 * Returns new tagID
	 */
	function add(tag){
		Zotero.debug('Adding new tag', 4);
		
		Zotero.DB.beginTransaction();
		
		var sql = 'INSERT INTO tags VALUES (?,?)';
		var rnd = Zotero.getRandomID('tags', 'tagID');
		Zotero.DB.query(sql, [{int: rnd}, {string: tag}]);
		
		Zotero.DB.commitTransaction();
		Zotero.Notifier.trigger('add', 'tag', rnd);
		return rnd;
	}
	
	
	function rename(tagID, tag) {
		Zotero.debug('Renaming tag', 4);
		
		Zotero.DB.beginTransaction();
		var sql = "UPDATE tags SET tag=? WHERE tagID=?";
		Zotero.DB.query(sql, [{string: tag}, {int: tagID}]);
		
		var itemIDs = this.getTagItems(tagID);
		
		delete _tags[_tagsByID[tagID]];
		delete _tagsByID[tagID];
		
		Zotero.DB.commitTransaction();
		
		Zotero.Notifier.trigger('modify', 'item', itemIDs);
		Zotero.Notifier.trigger('modify', 'tag', tagID);
	}
	
	
	function remove(tagID) {
		Zotero.DB.beginTransaction();
		
		var sql  = "SELECT itemID FROM itemTags WHERE tagID=?";
		var items = Zotero.DB.columnQuery(sql, tagID);
		
		if (!items) {
			return;
		}
		
		var sql = "DELETE FROM itemTags WHERE tagID=?";
		Zotero.DB.query(sql, tagID);
		Zotero.Notifier.trigger('modify', 'item', items)
		
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
		var sql = 'SELECT tagID FROM tags WHERE tagID NOT IN '
			+ '(SELECT tagID FROM itemTags);';
		var toDelete = Zotero.DB.columnQuery(sql);
		
		if (!toDelete){
			return false;
		}
		
		// Clear tag entries in internal array
		for (var i=0; i<toDelete.length; i++){
			var tag = this.getName(toDelete[i]);
			delete _tags[tag];
			delete _tagsByID[toDelete[i]];
		}
		
		sql = 'DELETE FROM tags WHERE tagID NOT IN '
			+ '(SELECT tagID FROM itemTags);';
		var result = Zotero.DB.query(sql);
		
		Zotero.Notifier.trigger('delete', 'tag', toDelete);
		
		return toDelete;
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
	var _types = new Array();
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
		
		if (!_types[idOrName]){
			Zotero.debug('Invalid ' + this._typeDesc + ' ' + idOrName, 1);
			return '';
		}
		
		return _types[idOrName]['name'];
	}
	
	
	function getID(idOrName){
		if (!_typesLoaded){
			_load();
		}
		
		if (this._ignoreCase){
			idOrName = idOrName + '';
			idOrName = idOrName.toLowerCase();
		}
		
		if (!_types[idOrName]){
			Zotero.debug('Invalid ' + this._typeDesc + ' ' + idOrName, 1);
			return false;
		}
		
		return _types[idOrName]['id'];
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
			_types[types[i]['id']] = typeData;
			if (self._ignoreCase){
				_types[types[i]['name'].toLowerCase()] = _types[types[i]['id']];
			}
			else {
				_types[types[i]['name']] = _types[types[i]['id']];
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
			case 'note-abstract':
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
	var _fields = new Array();
	var _fieldFormats = new Array();
	var _itemTypeFields = new Array();
	
	// Privileged methods
	this.getName = getName;
	this.getID = getID;
	this.isValidForType = isValidForType;
	this.isInteger = isInteger;
	this.getItemTypeFields = getItemTypeFields;
	
	/*
	 * Return the fieldName for a passed fieldID or fieldName
	 */
	function getName(field){
		if (!_fields.length){
			_loadFields();
		}
		return _fields[field] ? _fields[field]['name'] : false;
	}
	
	
	/*
	 * Return the fieldID for a passed fieldID or fieldName
	 */
	function getID(field){
		if (!_fields.length){
			_loadFields();
		}
		return _fields[field] ? _fields[field]['id'] : false;
	}
	
	
	function isValidForType(fieldID, itemTypeID){
		if (!_fields.length){
			_loadFields();
		}
		
		_fieldCheck(fieldID);
		
		if (!_fields[fieldID]['itemTypes']){
			throw('No associated itemTypes for fieldID ' + fieldID);
		}
		
		return !!_fields[fieldID]['itemTypes'][itemTypeID];
	}
	
	
	function isInteger(fieldID){
		if (!_fields.length){
			_loadFields();
		}
		
		_fieldCheck(fieldID);
		
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
			Zotero.debug("Invalid item type id '" + itemTypeID
				+ "' provided to getItemTypeFields()", 1);
			return [];
		}
		
		var sql = 'SELECT fieldID FROM itemTypeFields '
			+ 'WHERE itemTypeID=' + itemTypeID + ' ORDER BY orderIndex';
		
		_itemTypeFields[itemTypeID] = Zotero.DB.columnQuery(sql);
		return _itemTypeFields[itemTypeID];
	}
	
	
	/**
	* Check whether a fieldID is valid, throwing an exception if not
	* (since it should never actually happen)
	**/
	function _fieldCheck(fieldID){
		if (!_fields.length){
			_loadFields();
		}
		if (typeof _fields[fieldID]=='undefined'){
			throw('Invalid fieldID ' + fieldID);
		}
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
	 * Load all fields into an internal hash array
	 */
	function _loadFields(){
		var i,len;
		
		var result = Zotero.DB.query('SELECT * FROM fieldFormats');
		
		for (i=0; i<result.length; i++){
			_fieldFormats[result[i]['fieldFormatID']] = {
				regex: result[i]['regex'],
				isInteger: result[i]['isInteger']
			};
		}
		
		result = Zotero.DB.query('SELECT * FROM fields');
		
		if (!result.length){
			throw ('No fields in database!');
		}
		
		var fieldItemTypes = _getFieldItemTypes();
		
		for (i=0,len=result.length; i<len; i++){
			_fields[result[i]['fieldID']] = {
				id: result[i]['fieldID'],
				name: result[i]['fieldName'],
				formatID: result[i]['fieldFormatID'],
				itemTypes: fieldItemTypes[result[i]['fieldID']]
			};
			// Store by name as well as id
			_fields[result[i]['fieldName']] = _fields[result[i]['fieldID']];
		}
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
	
	var sql = 'SELECT collectionID FROM collections C WHERE parentCollectionID';
	sql += parent ? '=' + parent : ' IS NULL';
	
	sql += ' ORDER BY collectionName COLLATE NOCASE';
	
	var children = Zotero.DB.columnQuery(sql);
	
	if (!children){
		Zotero.debug('No child collections of collection ' + parent, 5);
		return toReturn;
	}
	
	for (var i=0, len=children.length; i<len; i++){
		var obj = Zotero.Collections.get(children[i]);
		if (!obj){
			throw ('Collection ' + children[i] + ' not found');
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
				
				toReturn.push(obj2);
			}
		}
	}
	
	return toReturn;
}


/*
 * Zotero.getItems(parent)
 *
 * Returns an array of all items that are children of a collection--or all
 * items if no parent provided--as Zotero.Item instances
 */
Zotero.getItems = function(parent){
	var toReturn = new Array();
	
	if (!parent){
		// Not child items
		var sql = "SELECT A.itemID FROM items A LEFT JOIN itemNotes B USING (itemID) "
			+ "LEFT JOIN itemAttachments C ON (C.itemID=A.itemID) WHERE B.sourceItemID IS NULL"
			+ " AND C.sourceItemID IS NULL";
	}
	else {
		var sql = 'SELECT itemID FROM collectionItems '
			+ 'WHERE collectionID=' + parent;
	}
	
	var children = Zotero.DB.columnQuery(sql);
	
	if (!children){
		if (!parent){
			Zotero.debug('No items in library', 5);
		}
		else {
			Zotero.debug('No child items of collection ' + parent, 5);
		}
		return toReturn;
	}
	
	return Zotero.Items.get(children);
}


Zotero.getAttachments = function(){
	var toReturn = [];
	
	var sql = "SELECT A.itemID FROM items A JOIN itemAttachments B ON "
		+ "(B.itemID=A.itemID) WHERE B.sourceItemID IS NULL";
	var items = Zotero.DB.query(itemAttachments);
	
	return Zotero.Items.get(items);
}
