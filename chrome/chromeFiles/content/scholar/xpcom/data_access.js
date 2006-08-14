/*
 * Constructor for Item object
 *
 * Generally should be called through Scholar.Items rather than directly
 */
Scholar.Item = function(){
	this._init();
	
	// Accept itemTypeID in constructor
	if (arguments.length){
		this.setType(arguments[0]);
	}
}

Scholar.Item.prototype._init = function(){
	//
	// Public members for access by public methods -- do not access directly
	//
	this._data = new Array();
	this._creators = new Scholar.Hash();
	this._itemData = new Array();
	
	this._creatorsLoaded = false;
	this._itemDataLoaded = false;
	
	this._changed = new Scholar.Hash();
	this._changedCreators = new Scholar.Hash();
	this._changedItemData = new Scholar.Hash();
	
	this._noteData = null;
	this._noteDataAccessTime = null;
	
	this._fileLinkMode = null;
}


//////////////////////////////////////////////////////////////////////////////
//
// Public Scholar.Item methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Check if the specified field is a primary field from the items table
 */
Scholar.Item.prototype.isPrimaryField = function(field){
	// Create primaryFields hash array if not yet created
	if (!Scholar.Item.primaryFields){
		Scholar.Item.primaryFields = Scholar.DB.getColumnHash('items');
		Scholar.Item.primaryFields['firstCreator'] = true;
		Scholar.Item.primaryFields['numNotes'] = true;
		Scholar.Item.primaryFields['numAttachments'] = true;
	}
	
	return !!Scholar.Item.primaryFields[field];
}

Scholar.Item.editableFields = {
	title: true
};

/*
 * Check if the specified primary field can be changed with setField()
 */
Scholar.Item.prototype.isEditableField = function(field){
	return !!Scholar.Item.editableFields[field];
}


/*
 * Build object from database
 */
Scholar.Item.prototype.loadFromID = function(id){
	// Should be the same as query in Scholar.Items.loadFromID, just
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
	var row = Scholar.DB.rowQuery(sql);
	this.loadFromRow(row);
}


/*
 * Populate basic item data from a database row
 */
Scholar.Item.prototype.loadFromRow = function(row){
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
			Scholar.debug(col + ' is not a valid primary field');
		}
	}
	return true;
}


/*
 * Check if any data fields have changed since last save
 */
Scholar.Item.prototype.hasChanged = function(){
	return (this._changed.length || this._changedCreators.length ||
		this._changedItemData.length);
}


Scholar.Item.prototype.getID = function(){
	return this._data['itemID'] ? this._data['itemID'] : false;
}


Scholar.Item.prototype.getType = function(){
	return this._data['itemTypeID'] ? this._data['itemTypeID'] : false;
}


/*
 * Set or change the item's type
 */
Scholar.Item.prototype.setType = function(itemTypeID){
	if (itemTypeID==this.getType()){
		return true;
	}
	
	// If existing type, clear fields from old type that aren't in new one
	if (this.getType()){
		var sql = 'SELECT fieldID FROM itemTypeFields '
			+ 'WHERE itemTypeID=' + this.getType() + ' AND fieldID NOT IN '
			+ '(SELECT fieldID FROM itemTypeFields WHERE itemTypeID='
			+ itemTypeID + ')';
		var obsoleteFields = Scholar.DB.columnQuery(sql);
		
		if (obsoleteFields){
			for (var i=0; i<obsoleteFields.length; i++){
				this.setField(obsoleteFields[i],false);
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
Scholar.Item.prototype.getCollections = function(){
	return Scholar.DB.columnQuery("SELECT collectionID FROM collectionItems "
		+ "WHERE itemID=" + this.getID());
}


/**
* Determine whether the item belongs to a given collectionID
**/
Scholar.Item.prototype.inCollection = function(collectionID){
	return !!parseInt(Scholar.DB.valueQuery("SELECT COUNT(*) collectionID "
		+ "FROM collectionItems WHERE collectionID=" + collectionID + " AND "
		+ "itemID=" + this.getID()));
}


/*
 * Returns the number of creators for this item
 */
Scholar.Item.prototype.numCreators = function(){
	if (this.getID() && !this._creatorsLoaded){
		this._loadCreators();
	}
	return this._creators.length;
}


Scholar.Item.prototype.hasCreatorAt = function(pos){
	if (this.getID() && !this._creatorsLoaded){
		this._loadCreators();
	}
	
	return this._creators.has(pos);
}


/*
 * Returns an array of the creator data at the given position, or false if none
 *
 * Note: Creator data array is returned by reference
 */
Scholar.Item.prototype.getCreator = function(pos){
	if (this.getID() && !this._creatorsLoaded){
		this._loadCreators();
	}
	
	if (!this._creators.items[pos]){
		return false;
	}
	return this._creators.items[pos];
}


/*
 * Returns a multidimensional array of creators, or an empty array if none
 *
 * Note: Creator data array is returned by reference
 */
Scholar.Item.prototype.getCreators = function(){
	var creators = [];
	for (var i=0, len=this.numCreators(); i<len; i++){
		creators.push(this.getCreator(i));
	}
	return creators;
}


/*
 * Set or update the creator at the specified position
 */
Scholar.Item.prototype.setCreator = function(orderIndex, firstName, lastName, creatorTypeID, isInstitution){
	if (this.getID() && !this._creatorsLoaded){
		this._loadCreators();
	}
	
	if (isInstitution || !firstName){
		firstName = '';
	}
	
	if (!lastName){
		lastName = '';
	}
	
	isInstitution = !!isInstitution;
	
	// If creator at this position hasn't changed, cancel
	if (this._creators.has(orderIndex) &&
		this._creators.get(orderIndex)['firstName']==firstName &&
		this._creators.get(orderIndex)['lastName']==lastName &&
		this._creators.get(orderIndex)['creatorTypeID']==creatorTypeID &&
		this._creators.get(orderIndex)['isInstitution']==isInstitution){
		return false;
	}
	
	if (!creatorTypeID){
		creatorTypeID = 1;
	}
	
	var creator = new Array();
	creator['firstName'] = firstName;
	creator['lastName'] = lastName;
	creator['creatorTypeID'] = creatorTypeID;
	creator['isInstitution'] = isInstitution;
	
	this._creators.set(orderIndex, creator);
	this._changedCreators.set(orderIndex);
	return true;
}


/*
 * Remove a creator and shift others down
 */
Scholar.Item.prototype.removeCreator = function(orderIndex){
	if (this.getID() && !this._creatorsLoaded){
		this._loadCreators();
	}
	
	if (!this._creators.has(orderIndex)){
		throw ('No creator exists at position ' + orderIndex);
	}
	this._creators.remove(orderIndex);
	
	// Go to length+1 so we clear the last one
	for (var i=orderIndex, max=this._creators.length+1; i<max; i++){
		var next =
			this._creators.items[i+1] ? this._creators.items[i+1] : false;
		this._creators.set(i, next);
		this._changedCreators.set(i);
	}
	return true;
}


// Currently unused
Scholar.Item.prototype.creatorExists = function(firstName, lastName, creatorTypeID, isInstitution, skipIndex){
	if (isInstitution || !firstName){
		firstName = '';
	}
	
	if (!lastName){
		lastName = '';
	}
	
	isInstitution = !!isInstitution;
	
	for (var j=0, len=this.numCreators(); j<len; j++){
		if (typeof skipIndex!='undefined' && skipIndex==j){
			continue;
		}
		
		var creator2 = this.getCreator(j);
		
		if (firstName==creator2['firstName'] &&
			lastName==creator2['lastName'] &&
			creatorTypeID==creator2['creatorTypeID'] &&
			isInstitution==creator2['isInstitution']){
			return true;
		}
	}
	return false;
}


/*
 * Retrieves (and loads from DB, if necessary) an itemData field value
 *
 * Field can be passed as fieldID or fieldName
 */
Scholar.Item.prototype.getField = function(field){
	//Scholar.debug('Requesting field ' + field + ' for item ' + this.getID(), 4);
	if (this.isPrimaryField(field)){
		return this._data[field] ? this._data[field] : '';
	}
	else {
		if (this.getID() && !this._itemDataLoaded){
			this._loadItemData();
		}
		
		var fieldID = Scholar.ItemFields.getID(field);
		
		return this._itemData[fieldID] ? this._itemData[fieldID] : '';
	}
}


/*
 * Set a field value, loading existing itemData first if necessary
 *
 * Field can be passed as fieldID or fieldName
 */
Scholar.Item.prototype.setField = function(field, value, loadIn){
	// Primary field
	if (this.isPrimaryField(field)){
		if (!this.isEditableField(field)){
			throw ('Primary field ' + field + ' cannot be changed through ' +
				'setField');
		}
		
		if (this._data[field] && this._data[field]==value){
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
		
		var fieldID = Scholar.ItemFields.getID(field);
		
		if (!fieldID){
			throw (field + ' is not a valid itemData field.');
		}
		
		if (!Scholar.ItemFields.isValidForType(fieldID, this.getType())){
			throw (field + ' is not a valid field for this type.');
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
Scholar.Item.prototype.save = function(){
	if (!this.hasChanged()){
		Scholar.debug('Item ' + this.getID() + ' has not changed', 4);
		return !!this.getID();
	}
	
	//
	// Existing item, update
	//
	if (this.getID()){
		Scholar.debug('Updating database with new item data', 4);
		
		var itemID = this.getID();
		
		try {
			Scholar.DB.beginTransaction();
			
			// Begin history transaction
			Scholar.History.begin('modify-item', this.getID());
			
			//
			// Primary fields
			//
			Scholar.History.modify('items', 'itemID', this.getID());
			
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
			
			Scholar.DB.query(sql, sqlValues);
			
			//
			// Creators
			//
			if (this._changedCreators.length){
				for (orderIndex in this._changedCreators.items){
					Scholar.debug('Creator ' + orderIndex + ' has changed', 4);
					
					var creator = this.getCreator(orderIndex);
					
					// Delete at position
					Scholar.History.remove('itemCreators', 'itemID-orderIndex',
						[this.getID(), orderIndex]);
					
					sql2 = 'DELETE FROM itemCreators'
						+ ' WHERE itemID=' + this.getID()
						+ ' AND orderIndex=' + orderIndex;
					Scholar.DB.query(sql2);
					
					// If empty, move on
					if (typeof creator['firstName'] == 'undefined'
						&& typeof creator['lastName'] == 'undefined'){
						continue;
					}
					
					// See if this is an existing creator
					var creatorID = Scholar.Creators.getID(
							creator['firstName'],
							creator['lastName'],
							creator['isInstitution']
					);
					
					// If not, add it
					if (!creatorID){
						creatorID = Scholar.Creators.add(
							creator['firstName'],
							creator['lastName'],
							creator['isInstitution']
						);
						Scholar.History.add('creators', 'creatorID', creatorID);
					}
					
					
					sql2 = 'SELECT COUNT(*) FROM itemCreators'
						+ ' WHERE itemID=' + this.getID()
						+ ' AND creatorID=' + creatorID
						+ ' AND creatorTypeID=' + creator['creatorTypeID'];
						
					sql = "INSERT INTO itemCreators VALUES (?,?,?,?)";
					
					sqlValues = [
						{'int':itemID},
						{'int':creatorID},
						{'int':creator['creatorTypeID']},
						{'int':orderIndex}
					];
					
					Scholar.DB.query(sql, sqlValues);
					
					Scholar.History.add('itemCreators',
						'itemID-creatorID-creatorTypeID',
						[this.getID(), creatorID, creator['creatorTypeID']]);
				}
				
				// Delete obsolete creators
				var deleted;
				if (deleted = Scholar.Creators.purge()){
					for (var i in deleted){
						// Add purged creators to history
						Scholar.History.remove('creators', 'creatorID', i);
					}
				}
			}
			
			
			//
			// ItemData
			//
			if (this._changedItemData.length){
				var del = new Array();
				for (fieldID in this._changedItemData.items){
					if (this.getField(fieldID)){
						// Oh, for an INSERT...ON DUPLICATE KEY UPDATE
						sql2 = 'SELECT COUNT(*) FROM itemData '
							+ 'WHERE itemID=' + this.getID()
							+ ' AND fieldID=' + fieldID;
						
						// Update
						if (Scholar.DB.valueQuery(sql2)){
							sqlValues = [];
							
							Scholar.History.modify('itemData', 'itemID-fieldID',
								[this.getID(), fieldID]);
							
							sql = "UPDATE itemData SET value=?";
							// Take advantage of SQLite's manifest typing
							if (Scholar.ItemFields.isInteger(fieldID)){
								sqlValues.push({'int':this.getField(fieldID)});
							}
							else {
								sqlValues.push({'string':this.getField(fieldID)});
							}
							sql += " WHERE itemID=? AND fieldID=?";
							
							sqlValues.push(
								{'int':this.getID()},
								{'int':fieldID}
							);
							
							Scholar.DB.query(sql, sqlValues);
						}
						
						// Insert
						else {
							Scholar.History.add('itemData', 'itemID-fieldID',
								[this.getID(), fieldID]);
							
							sql = "INSERT INTO itemData VALUES (?,?,?)";
							
							sqlValues = [
								{'int':this.getID()},
								{'int':fieldID},
							];
							
							if (Scholar.ItemFields.isInteger(fieldID)){
								sqlValues.push({'int':this.getField(fieldID)});
							}
							else {
								sqlValues.push({'string':this.getField(fieldID)});
							}
							
							Scholar.DB.query(sql, sqlValues);
						}
					}
					
					// If field changed and is empty, mark row for deletion
					else {
						del.push(fieldID);
					}
				}
				
				// Delete blank fields
				if (del.length){
					// Add to history
					for (var i in del){
						Scholar.History.remove('itemData', 'itemID-fieldID',
							[this.getID(), del[i]]);
					}
					
					sql = 'DELETE from itemData '
						+ 'WHERE itemID=' + this.getID() + ' '
						+ 'AND fieldID IN (' + del.join() + ")";
					Scholar.DB.query(sql);
				}
			}
			
			Scholar.History.commit();
			Scholar.DB.commitTransaction();
		}
		catch (e){
			Scholar.History.cancel();
			Scholar.DB.rollbackTransaction();
			throw(e);
		}
	}
	
	//
	// New item, insert and return id
	//
	else {
		Scholar.debug('Saving data for new item to database');
		
		var isNew = true;
		var sqlColumns = new Array();
		var sqlValues = new Array();
		
		//
		// Primary fields
		//
		sqlColumns.push('itemID');
		var itemID = Scholar.getRandomID('items', 'itemID');
		sqlValues.push(itemID);
		
		sqlColumns.push('itemTypeID');
		sqlValues.push({'int':this.getField('itemTypeID')});
		
		if (this._changed.has('title')){
			sqlColumns.push('title');
			sqlValues.push({'string':this.getField('title')});
		}
		
		try {
			Scholar.DB.beginTransaction();
			
			// Begin history transaction
			// No associated id yet, so we use false
			Scholar.History.begin('add-item', false);
			
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
			Scholar.DB.query(sql, sqlValues);
			this._data['itemID'] = itemID;
			
			Scholar.History.setAssociatedID(itemID);
			Scholar.History.add('items', 'itemID', itemID);
			
			//
			// ItemData
			//
			if (this._changedItemData.length){
				for (fieldID in this._changedItemData.items){
					if (!this.getField(fieldID)){
						continue;
					}
					
					// TODO: update DB methods so that this can be
					// implemented as a prepared statement that gets
					// called multiple times
					sql = "INSERT INTO itemData VALUES (?,?,?)";
					
					sqlValues = [
						{'int':itemID},
						{'int':fieldID}
					];
					
					if (Scholar.ItemFields.isInteger(fieldID)){
						sqlValues.push({'int':this.getField(fieldID)});
					}
					else {
						sqlValues.push({'string':this.getField(fieldID)});
					}
					
					Scholar.DB.query(sql, sqlValues);
					
					Scholar.History.add('itemData', 'itemID-fieldID',
						[itemID, fieldID]);
				}
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
					var creatorID = Scholar.Creators.getID(
							creator['firstName'],
							creator['lastName'],
							creator['isInstitution']
					);
					
					// If not, add it
					if (!creatorID){
						creatorID = Scholar.Creators.add(
							creator['firstName'],
							creator['lastName'],
							creator['isInstitution']
						);
						Scholar.History.add('creators', 'creatorID', creatorID);
					}
					
					sql = 'INSERT INTO itemCreators VALUES ('
						+ itemID + ',' + creatorID + ','
						+ creator['creatorTypeID'] + ', ' + orderIndex
						+ ")";
					Scholar.DB.query(sql);
					
					Scholar.History.add('itemCreators',
						'itemID-creatorID-creatorTypeID',
						[this.getID(), creatorID, creator['creatorTypeID']]);
				}
			}
			
			Scholar.History.commit();
			Scholar.DB.commitTransaction();
			
			// Reload collection to update isEmpty,
			// in case this was the first item in a collection
			Scholar.Collections.reloadAll();
		}
		catch (e){
			Scholar.History.cancel();
			Scholar.DB.rollbackTransaction();
			throw(e);
		}
	}
	
	Scholar.Items.reload(this.getID());
	
	if (isNew){
		if (!Scholar.DB.transactionInProgress()){
			Scholar.Notifier.trigger('add', 'item', this.getID());
		}
		return this.getID();
	}
	else {
		if (!Scholar.DB.transactionInProgress()){
			Scholar.Notifier.trigger('modify', 'item', this.getID());
		}
		return true;
	}
}


Scholar.Item.prototype.updateDateModified = function(){
	Scholar.DB.query("UPDATE items SET dateModified=CURRENT_TIMESTAMP "
		+ "WHERE itemID=" + this.getID());
	var date = Scholar.DB.valueQuery("SELECT dateModified FROM items "
		+ "WHERE itemID=" + this.getID());
	this._data['dateModified'] = date;
}


Scholar.Item.prototype.isRegularItem = function(){
	return !(this.isNote() || this.isAttachment());
}


////////////////////////////////////////////////////////
//
// Methods dealing with note items
//
// save() is not required for note functions
//
////////////////////////////////////////////////////////
Scholar.Item.prototype.incrementNoteCount = function(){
	this._data['numNotes']++;
}


Scholar.Item.prototype.decrementNoteCount = function(){
	this._data['numNotes']--;
}


/**
* Determine if an item is a note
**/
Scholar.Item.prototype.isNote = function(){
	return Scholar.ItemTypes.getName(this.getType())=='note';
}


/**
* Update an item note
*
* Note: This can only be called on note items.
**/
Scholar.Item.prototype.updateNote = function(text){
	if (!this.isNote()){
		throw ("updateNote() can only be called on items of type 'note'");
	}
	
	if (!this.getID()){
		throw ("Cannot call updateNote() on unsaved note");
	}
	
	Scholar.DB.beginTransaction();
	
	var sql = "UPDATE itemNotes SET note=? WHERE itemID=?";
	bindParams = [{string:text}, this.getID()];
	var updated = Scholar.DB.query(sql, bindParams);
	if (updated){
		this.updateDateModified();
		Scholar.DB.commitTransaction();
		this.updateNoteCache(text);
		
		Scholar.Notifier.trigger('modify', 'item', this.getID());
	}
	else {
		Scholar.DB.commitTransaction();
	}
}


Scholar.Item.prototype.updateNoteCache = function(text){
	// Update cached values
	this._noteData = text ? text : '';
	this.setField('title', this._noteToTitle(), true);
}


Scholar.Item.prototype.setSource = function(sourceItemID){
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
	
	Scholar.DB.beginTransaction();
	
	var newItem = Scholar.Items.get(sourceItemID);
	// FK check
	if (sourceItemID && !newItem){
		Scholar.DB.rollbackTransaction();
		throw ("Cannot set " + type + " source to invalid item " + sourceItemID);
	}
	
	// Get previous source item id
	var sql = "SELECT sourceItemID FROM item" + Type + "s WHERE item=" + this.getID();
	var oldSourceItemID = Scholar.DB.valueQuery(sql);
	
	if (oldSourceItemID==sourceItemID){
		Scholar.debug(Type + " source hasn't changed", 4);
		Scholar.DB.commitTransaction();
		return false;
	}
	
	var oldItem = Scholar.Items.get(oldSourceItemID);
	if (oldSourceItemID && !oldItem){
		Scholar.debug("Old source item " + oldSourceItemID
			+ "didn't exist in setSource()", 2);
	}
	
	var sql = "UPDATE item" + Type + "s SET sourceItemID=? WHERE itemID=?";
	var bindParams = [sourceItemID ? {int:sourceItemID} : null, this.getID()];
	Scholar.DB.query(sql, bindParams);
	this.updateDateModified();
	Scholar.DB.commitTransaction();
	
	Scholar.Notifier.trigger('modify', 'item', this.getID());
	
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
		Scholar.Notifier.trigger('modify', 'item', oldSourceItemID);
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
		Scholar.Notifier.trigger('modify', 'item', sourceItemID);
	}
	
	return true;
}


/**
* Returns number of notes in item
**/
Scholar.Item.prototype.numNotes = function(){
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
Scholar.Item.prototype.getNote = function(){
	if (!this.isNote()){
		throw ("getNote() can only be called on items of type 'note'");
	}
	
	if (this._noteData !== null){
		// Store access time for later garbage collection
		this._noteDataAccessTime = new Date();
		return this._noteData;
	}
	
	var sql = "SELECT note FROM itemNotes WHERE itemID=" + this.getID();
	var note = Scholar.DB.valueQuery(sql);
	
	this._noteData = note ? note : '';
	
	return note ? note : '';
}


/**
* Get the itemID of the source item for a note or file
**/
Scholar.Item.prototype.getSource = function(){
	if (this.isNote()){
		var Type = 'Note';
	}
	else if (this.isAttachment()){
		var Type = 'Attachment';
	}
	else {
		throw ("getSource() can only be called on items of type 'note' or 'attachment'");
	}
	
	var sql = "SELECT sourceItemID FROM item" + Type + "s WHERE itemID=" + this.getID();
	return Scholar.DB.valueQuery(sql);
}


/**
* Returns an array of note itemIDs for this item
**/
Scholar.Item.prototype.getNotes = function(){
	if (this.isNote()){
		throw ("getNotes() cannot be called on items of type 'note'");
	}
	
	if (!this.getID()){
		return [];
	}
	
	var sql = "SELECT itemID FROM itemNotes NATURAL JOIN items "
		+ "WHERE sourceItemID=" + this.getID() + " ORDER BY dateAdded";
	return Scholar.DB.columnQuery(sql);
}



////////////////////////////////////////////////////////
//
// Methods dealing with attachments
//
// save() is not required for attachment functions
//
///////////////////////////////////////////////////////
Scholar.Item.prototype.incrementAttachmentCount = function(){
	this._data['numAttachments']++;
}


Scholar.Item.prototype.decrementAttachmentCount = function(){
	this._data['numAttachments']--;
}


/**
* Determine if an item is an attachment
**/
Scholar.Item.prototype.isAttachment = function(){
	return Scholar.ItemTypes.getName(this.getType())=='attachment';
}


/**
* Returns number of files in item
**/
Scholar.Item.prototype.numAttachments = function(){
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
* Note: Always returns false for items with LINK_MODE_LINKED_URL,
* since they have no files -- use getURL() instead
**/
Scholar.Item.prototype.getFile = function(){
	if (!this.isAttachment()){
		throw ("getFile() can only be called on items of type 'attachment'");
	}
	
	var sql = "SELECT linkMode, path FROM itemAttachments WHERE itemID=" + this.getID();
	var row = Scholar.DB.rowQuery(sql);
	
	if (!row){
		throw ('Attachment data not found for item ' + this.getID() + ' in getFile()');
	}
	
	// No associated files for linked URLs
	if (row['linkMode']==Scholar.Attachments.LINK_MODE_LINKED_URL){
		return false;
	}
	
	var file = Components.classes["@mozilla.org/file/local;1"].
		createInstance(Components.interfaces.nsILocalFile);
	
	var refDir = (row['linkMode']==this.LINK_MODE_LINKED_FILE)
		? Scholar.getScholarDirectory() : Scholar.getStorageDirectory();
	file.setRelativeDescriptor(refDir, row['path']);
	
	if (!file.exists()){
		return false;
	}
	
	return file;
}


/*
 * Return the URL string associated with a linked or imported URL
 */
Scholar.Item.prototype.getURL = function(){
	if (!this.isAttachment()){
		throw ("getURL() can only be called on items of type 'attachment'");
	}
	
	var sql = "SELECT linkMode, path, originalPath FROM itemAttachments "
		+ "WHERE itemID=" + this.getID();
	var row = Scholar.DB.rowQuery(sql);
	
	if (!row){
		throw ('Attachment data not found for item ' + this.getID() + ' in getURL()');
	}
	
	switch (row['linkMode']){
		case Scholar.Attachments.LINK_MODE_LINKED_URL:
			return row['path'];
		case Scholar.Attachments.LINK_MODE_IMPORTED_URL:
			return row['originalPath'];
		default:
			throw ('getURL() cannot be called on attachments without associated URLs');
	}
}


/*
 * Return a file:/// URL path to files and snapshots
 */
Scholar.Item.prototype.getLocalFileURL = function(){
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
* Possible return values specified as constants in Scholar.Attachments
* (e.g. Scholar.Attachments.LINK_MODE_LINKED_FILE)
**/
Scholar.Item.prototype.getAttachmentLinkMode = function(){
	if (!this.isAttachment()){
		throw ("getAttachmentLinkMode() can only be called on items of type 'attachment'");
	}
	
	if (this._fileLinkMode!==null){
		return this._fileLinkMode;
	}
	
	var sql = "SELECT linkMode FROM itemAttachments WHERE itemID=" + this.getID();
	this._fileLinkMode = Scholar.DB.valueQuery(sql);
	return this._fileLinkMode;
}


/**
* Get the mime type of an attachment (e.g. text/plain)
**/
Scholar.Item.prototype.getAttachmentMimeType = function(){
	if (!this.isAttachment()){
		throw ("getAttachmentMIMEType() can only be called on items of type 'attachment'");
	}
	
	var sql = "SELECT mimeType FROM itemAttachments WHERE itemID=" + this.getID();
	return Scholar.DB.valueQuery(sql);
}


/**
* Get the character set id of an attachment
**/
Scholar.Item.prototype.getAttachmentCharset = function(){
	if (!this.isAttachment()){
		throw ("getAttachmentCharset() can only be called on items of type 'attachment'");
	}
	
	var sql = "SELECT charsetID FROM itemAttachments WHERE itemID=" + this.getID();
	return Scholar.DB.valueQuery(sql);
}


/**
* Returns an array of attachment itemIDs that have this item as a source
**/
Scholar.Item.prototype.getAttachments = function(){
	if (this.isAttachment()){
		throw ("getAttachments() cannot be called on items of type 'attachment'");
	}
	
	if (!this.getID()){
		return [];
	}
	
	var sql = "SELECT itemID FROM itemAttachments NATURAL JOIN items "
		+ "WHERE sourceItemID=" + this.getID() + " ORDER BY dateAdded";
	return Scholar.DB.columnQuery(sql);
}



//
// Methods dealing with item tags
//
// save() is not required for tag functions
//
Scholar.Item.prototype.addTag = function(tag){
	if (!this.getID()){
		this.save();
	}
	
	Scholar.DB.beginTransaction();
	var tagID = Scholar.Tags.getID(tag);
	if (!tagID){
		var tagID = Scholar.Tags.add(tag);
	}
	
	var sql = "INSERT OR IGNORE INTO itemTags VALUES (?,?)";
	Scholar.DB.query(sql, [this.getID(), tagID]);
	
	Scholar.DB.commitTransaction();
	Scholar.Notifier.trigger('modify', 'item', this.getID());
	
	return tagID;
}

Scholar.Item.prototype.getTags = function(){
	var sql = "SELECT tag FROM tags WHERE tagID IN "
		+ "(SELECT tagID FROM itemTags WHERE itemID=" + this.getID() + ")";
	return Scholar.DB.columnQuery(sql);
}

Scholar.Item.prototype.getTagIDs = function(){
	var sql = "SELECT tagID FROM itemTags WHERE itemID=" + this.getID();
	return Scholar.DB.columnQuery(sql);
}

Scholar.Item.prototype.removeTag = function(tagID){
	if (!this.getID()){
		throw ('Cannot remove tag on unsaved item');
	}
	
	Scholar.DB.beginTransaction();
	var sql = "DELETE FROM itemTags WHERE itemID=? AND tagID=?";
	Scholar.DB.query(sql, [this.getID(), tagID]);
	Scholar.Tags.purge();
	Scholar.DB.commitTransaction();
	Scholar.Notifier.trigger('modify', 'item', this.getID());
}


//
// Methods dealing with See Also links
//
// save() is not required for See Also functions
//
Scholar.Item.prototype.addSeeAlso = function(itemID){
	if (itemID==this.getID()){
		Scholar.debug('Cannot add item as See Also of itself', 2);
		return false;
	}
	
	Scholar.DB.beginTransaction();
	
	if (!Scholar.Items.get(itemID)){
		Scholar.DB.commitTransaction();
		throw ("Cannot add invalid item " + itemID + " as See Also");
		return false;
	}
	
	// Check both ways, using a UNION to take advantage of indexes
	var sql = "SELECT (SELECT COUNT(*) FROM itemSeeAlso WHERE itemID=?1 AND "
		+ "linkedItemID=?2) + (SELECT COUNT(*) FROM itemSeeAlso WHERE "
		+ "linkedItemID=?1 AND itemID=?2)";
	if (Scholar.DB.valueQuery(sql, [this.getID(), itemID])){
		Scholar.DB.commitTransaction();
		Scholar.debug("Item " + itemID + " already linked", 2);
		return false;
	}
	
	var sql = "INSERT INTO itemSeeAlso VALUES (?,?)";
	Scholar.DB.query(sql, [this.getID(), {int:itemID}]);
	Scholar.DB.commitTransaction();
	Scholar.Notifier.trigger('modify', 'item', [this.getID(), itemID]);
	return true;
}

Scholar.Item.prototype.removeSeeAlso = function(itemID){
	Scholar.DB.beginTransaction();
	var sql = "DELETE FROM itemSeeAlso WHERE itemID=? AND linkedItemID=?";
	Scholar.DB.query(sql, [this.getID(), itemID]);
	var sql = "DELETE FROM itemSeeAlso WHERE itemID=? AND linkedItemID=?";
	Scholar.DB.query(sql, [itemID, this.getID()]);
	Scholar.DB.commitTransaction();
	Scholar.Notifier.trigger('modify', 'item', [this.getID(), itemID]);
}

Scholar.Item.prototype.getSeeAlso = function(){
	// Check both ways, using a UNION to take advantage of indexes
	var sql ="SELECT linkedItemID FROM itemSeeAlso WHERE itemID=?1 UNION "
		+ "SELECT itemID FROM itemSeeAlso WHERE linkedItemID=?1";
	return Scholar.DB.columnQuery(sql, this.getID());
}


/**
* Delete item from database and clear from Scholar.Items internal array
**/
Scholar.Item.prototype.erase = function(deleteChildren){
	if (!this.getID()){
		return false;
	}
	
	Scholar.debug('Deleting item ' + this.getID());
	
	var changedItems = [];
	
	Scholar.DB.beginTransaction();
	
	// Remove item from parent collections
	var parentCollectionIDs = this.getCollections();
	for (var i=0; i<parentCollectionIDs.length; i++){
		Scholar.Collections.get(parentCollectionIDs[i]).removeItem(this.getID());
	}
	
	// Note
	if (this.isNote()){
		// Decrement note count of source items
		var sql = "SELECT sourceItemID FROM itemNotes WHERE itemID=" + this.getID();
		var sourceItemID = Scholar.DB.valueQuery(sql);
		if (sourceItemID){
			var sourceItem = Scholar.Items.get(sourceItemID);
			sourceItem.decrementNoteCount();
			changedItems.push(sourceItemID);
		}
	}
	// Attachment
	else if (this.isAttachment()){
		// Decrement file count of source items
		var sql = "SELECT sourceItemID FROM itemAttachments WHERE itemID=" + this.getID();
		var sourceItemID = Scholar.DB.valueQuery(sql);
		if (sourceItemID){
			var sourceItem = Scholar.Items.get(sourceItemID);
			sourceItem.decrementAttachmentCount();
			changedItems.push(sourceItemID);
		}
		
		// Delete associated files
		var linkMode = this.getAttachmentLinkMode();
		switch (linkMode){
			case Scholar.Attachments.LINK_MODE_LINKED_FILE:
			case Scholar.Attachments.LINK_MODE_LINKED_URL:
				// Links only -- nothing to delete
				break;
			default:
				var file = Scholar.getStorageDirectory();
				file.append(this.getID());
				if (file.exists()){
					file.remove(true);
				}
		}
	}
	
	// Regular item
	
	// Delete child notes and files
	else if (deleteChildren){
		var sql = "SELECT itemID FROM itemNotes WHERE sourceItemID=?1 UNION "
			+ "SELECT itemID FROM itemAttachments WHERE sourceItemID=?1";
		var toDelete = Scholar.DB.columnQuery(sql, [this.getID()]);
		
		if (toDelete){
			for (var i in toDelete){
				var obj = Scholar.Items.get(toDelete[i]);
				obj.erase(true);
			}
		}
	}
	
	// Just unlink any child notes or files without deleting
	else {
		// Notes
		var sql = "SELECT itemID FROM itemNotes WHERE sourceItemID=" + this.getID();
		var childNotes = Scholar.DB.columnQuery(sql);
		if (childNotes){
			changedItems.push(childNotes);
		}
		var sql = "UPDATE itemNotes SET sourceItemID=NULL WHERE sourceItemID="
			+ this.getID();
		Scholar.DB.query(sql);
		
		// Attachments
		var sql = "SELECT itemID FROM itemAttachments WHERE sourceItemID=" + this.getID();
		var childAttachments = Scholar.DB.columnQuery(sql);
		if (childAttachments){
			changedItems.push(childAttachments);
		}
		var sql = "UPDATE itemAttachments SET sourceItemID=NULL WHERE sourceItemID="
			+ this.getID();
		Scholar.DB.query(sql);
	}
	
	// Flag See Also links for notification
	var seeAlso = this.getSeeAlso();
	if (seeAlso){
		changedItems = changedItems.concat(seeAlso);
	}
	
	sql = 'DELETE FROM itemCreators WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemNotes WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemAttachments WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemSeeAlso WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemSeeAlso WHERE linkedItemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemTags WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemData WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM items WHERE itemID=' + this.getID() + ";\n";
	
	Scholar.DB.query(sql);
	Scholar.Creators.purge();
	
	try {
		Scholar.DB.commitTransaction();
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
		Scholar.DB.rollbackTransaction();
		throw (e);
	}
	
	Scholar.Items.unload(this.getID());
	
	// Send notification of changed items
	if (changedItems.length){
		Scholar.Notifier.trigger('modify', 'item', changedItems);
	}
	
	// If we're not in the middle of a larger commit, trigger the notifier now
	if (!Scholar.DB.transactionInProgress()){
		Scholar.Notifier.trigger('delete', 'item', this.getID());
	}
}


Scholar.Item.prototype.isCollection = function(){
	return false;
}


/**
* Convert the item data into a multidimensional associative array
*	for use by the export functions
**/
Scholar.Item.prototype.toArray = function(){
	if (this.getID() && !this._itemDataLoaded){
		this._loadItemData();
	}
	
	var arr = [];
	
	// Primary fields
	for (var i in this._data){
		switch (i){
			case 'itemTypeID':
				arr['itemType'] = Scholar.ItemTypes.getName(this._data[i]);
				break;
			
			// Skip certain fields
			case 'firstCreator':
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
		arr[Scholar.ItemFields.getName(i)] = this._itemData[i];
	}
	
	if (!this.isNote() && !this.isAttachment()){
		// Creators
		arr['creators'] = [];
		var creators = this.getCreators();
		for (var i in creators){
			arr['creators'][i] = [];
			arr['creators'][i]['firstName'] = creators[i]['firstName'];
			arr['creators'][i]['lastName'] = creators[i]['lastName'];
			arr['creators'][i]['isInstitution'] = creators[i]['isInstitution'];
			// Convert creatorTypeIDs to text
			arr['creators'][i]['creatorType'] =
				Scholar.CreatorTypes.getName(creators[i]['creatorTypeID']);
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
	// If not note, append attached notes
	else {
		arr['notes'] = [];
		var notes = this.getNotes();
		for (var i in notes){
			var note = Scholar.Items.get(notes[i]);
			arr['notes'].push({
				itemID: note.getID(),
				note: note.getNote(),
				tags: note.getTags(),
				seeAlso: note.getSeeAlso()
			});
		}
	}
	
	// Attachments
	if (this.isAttachment()){
		// TODO: file data
		
		if (this.getSource()){
			arr['sourceItemID'] = this.getSource();
		}
	}
	
	// If not file, append child attachments
	else {
		arr['attachments'] = [];
		var files = this.getAttachments();
		for (var i in files){
			var file = Scholar.Items.get(files[i]);
			arr['attachments'].push({
				itemID: file.getID(),
				// TODO
				tags: file.getTags(),
				seeAlso: file.getSeeAlso()
			});
		}
	}
	
	
	arr['tags'] = this.getTags();
	arr['seeAlso'] = this.getSeeAlso();
	
	return arr;
}



//////////////////////////////////////////////////////////////////////////////
//
// Private Scholar.Item methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Load in the creators from the database
 */
Scholar.Item.prototype._loadCreators = function(){
	if (!this.getID()){
		throw ('ItemID not set for item before attempting to load creators');
	}
	
	var sql = 'SELECT C.creatorID, C.*, creatorTypeID, orderIndex '
		+ 'FROM itemCreators IC '
		+ 'LEFT JOIN creators C USING (creatorID) '
		+ 'WHERE itemID=' + this.getID() + ' ORDER BY orderIndex';
	var creators = Scholar.DB.query(sql);
	
	this._creatorsLoaded = true;
	
	if (!creators){
		return true;
	}
	
	this._creators = new Scholar.Hash();
	for (var i=0; i<creators.length; i++){
		var creator = new Array();
		creator['firstName'] = creators[i]['firstName'];
		creator['lastName'] = creators[i]['lastName'];
		creator['isInstitution'] = creators[i]['isInstitution'];
		creator['creatorTypeID'] = creators[i]['creatorTypeID'];
		// Save creator data into Hash, indexed by orderIndex
		this._creators.set(creators[i]['orderIndex'], creator);
	}
	
	return true;
}


/*
 * Load in the field data from the database
 */
Scholar.Item.prototype._loadItemData = function(){
	if (!this.getID()){
		throw ('ItemID not set for object before attempting to load data');
	}
	
	var sql = 'SELECT ID.fieldID, value FROM itemData ID JOIN '
		+ 'itemTypeFields ITF ON (ITF.itemTypeID=(SELECT itemTypeID FROM '
		+ 'items WHERE itemID=?1) AND ITF.fieldID=ID.fieldID) '
		+ 'WHERE itemID=?1 ORDER BY orderIndex';
		
	var result = Scholar.DB.query(sql,[{'int':this._data['itemID']}]);
	
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
Scholar.Item.prototype._noteToTitle = function(){
	var MAX_LENGTH = 80;
	
	var t = this.getNote().substring(0, MAX_LENGTH);
	var ln = t.indexOf("\n");
	if (ln>-1 && ln<MAX_LENGTH){
		t = t.substring(0, ln);
	}
	return t;
}




/*
 * Primary interface for accessing Scholar items
 */
Scholar.Items = new function(){
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
			Scholar.debug('No arguments provided to Items.get()');
			return false;
		}
		
		var ids = Scholar.flattenArguments(arguments);
		
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
		
		var ids = Scholar.DB.columnQuery(sql);
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
		
		var ids = Scholar.flattenArguments(arguments);
		Scholar.debug('Reloading ' + ids);
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
		return new Scholar.Item(itemTypeID);
	}
	
	
	function add(data, itemTypeID){
		var insert = new Array();
		
		var obj = new Scholar.Item(itemTypeID);
		
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
		
		return Scholar.DB.columnQuery(sql, sqlParams);
	}
	
	
	/**
	* Delete item from database and clear from internal array
	**/
	function erase(id){
		var obj = this.get(id);
		obj.erase(); // calls unload()
		obj = undefined;
	}
	
	
	/**
	* Clear item from internal array (used by Scholar.Item.erase())
	**/
	function unload(id){
		delete _items[id];
	}
	
	
	function _load(){
		// Should be the same as query in Scholar.Item.loadFromID, just
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
			sql += ' AND I.itemID IN (' + Scholar.join(arguments,',') + ')';
		}
		
		var result = Scholar.DB.query(sql);
		
		if (result){
			for (var i=0,len=result.length; i<len; i++){
				// Item doesn't exist -- create new object and stuff in array
				if (!_items[result[i]['itemID']]){
					var obj = new Scholar.Item();
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




Scholar.Notes = new function(){
	this.add = add;
	
	/**
	* Create a new item of type 'note' and add the note text to the itemNotes table
	*
	* Returns the itemID of the new note item
	**/
	function add(text, sourceItemID){
		Scholar.DB.beginTransaction();
		
		if (sourceItemID){
			var sourceItem = Scholar.Items.get(sourceItemID);
			if (!sourceItem){
				Scholar.DB.commitTransaction();
				throw ("Cannot set note source to invalid item " + sourceItemID);
			}
			if (sourceItem.isNote()){
				Scholar.DB.commitTransaction();
				throw ("Cannot set note source to another note (" + sourceItemID + ")");
			}
		}
		
		var note = Scholar.Items.getNewItemByType(Scholar.ItemTypes.getID('note'));
		note.save();
		
		var sql = "INSERT INTO itemNotes VALUES (?,?,?)";
		var bindParams = [
			note.getID(),
			(sourceItemID ? {int:sourceItemID} : null),
			{string:text}
		];
		Scholar.DB.query(sql, bindParams);
		Scholar.DB.commitTransaction();
		
		// Switch to Scholar.Items version
		var note = Scholar.Items.get(note.getID());
		note.updateNoteCache(text);
		
		if (sourceItemID){
			sourceItem.incrementNoteCount();
			Scholar.Notifier.trigger('modify', 'item', sourceItemID);
		}
		
		Scholar.Notifier.trigger('add', 'item', note.getID());
		
		return note.getID();
	}
}



Scholar.Attachments = new function(){
	this.LINK_MODE_IMPORTED_FILE = 0;
	this.LINK_MODE_IMPORTED_URL = 1;
	this.LINK_MODE_LINKED_FILE = 2;
	this.LINK_MODE_LINKED_URL = 3;
	
	this.importFromFile = importFromFile;
	this.linkFromFile = linkFromFile;
	this.importFromURL = importFromURL;
	this.linkFromURL = linkFromURL;
	this.linkFromDocument = linkFromDocument;
	this.importFromDocument = importFromDocument;
	
	var self = this;
	
	function importFromFile(file, sourceItemID){
		var title = file.leafName;
		
		Scholar.DB.beginTransaction();
		
		// Create a new attachment
		var attachmentItem = Scholar.Items.getNewItemByType(Scholar.ItemTypes.getID('attachment'));
		attachmentItem.setField('title', title);
		attachmentItem.save();
		var itemID = attachmentItem.getID();
		
		// Create directory for attachment files within storage directory
		var destDir = Scholar.getStorageDirectory();
		destDir.append(itemID);
		destDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0644);
		
		try {
			file.copyTo(destDir, null);
		}
		catch (e){
			// hmph
			Scholar.DB.rollbackTransaction();
			destDir.remove(true);
			throw (e);
		}
		
		// Point to copied file
		var newFile = Components.classes["@mozilla.org/file/local;1"]
						.createInstance(Components.interfaces.nsILocalFile);
		newFile.initWithFile(destDir);
		newFile.append(title);
		
		var mimeType = Scholar.File.getMIMETypeFromFile(newFile);
		var charsetID = _getCharsetIDFromFile(newFile);
		
		_addToDB(newFile, null, null, this.LINK_MODE_IMPORTED_FILE, mimeType, charsetID, sourceItemID, itemID);
		Scholar.DB.commitTransaction();
		return itemID;
	}
	
	
	function linkFromFile(file, sourceItemID){
		var title = file.leafName;
		var mimeType = Scholar.File.getMIMETypeFromFile(file);
		var charsetID = _getCharsetIDFromFile(file);
		return _addToDB(file, null, title, this.LINK_MODE_LINKED_FILE, mimeType, charsetID, sourceItemID);
	}
	
	
	function importFromURL(url, sourceItemID){
		var browser = Scholar.Browser.createHiddenBrowser();
		browser.addEventListener("pageshow", function(){
			Scholar.Attachments.importFromDocument(browser.contentDocument, sourceItemID);
			browser.removeEventListener("pageshow", arguments.callee, true);
			Scholar.Browser.deleteHiddenBrowser(browser);
		}, true);
		browser.loadURI(url, null, null, null, null);
	}
	
	
	function linkFromURL(url, sourceItemID, mimeType, title){
		// If no title provided, figure it out from the URL
		if (!title){
			title = url.substring(url.lastIndexOf('/')+1);
		}
		
		// If we have the title and mime type, skip loading
		if (title && mimeType){
			_addToDB(null, url, title, this.LINK_MODE_LINKED_URL, mimeType,
				null, sourceItemID);
			return;
		}
		
		// Otherwise do a head request for the mime type
		Scholar.Utilities.HTTP.doHead(url, function(obj){
			_addToDB(null, url, title, Scholar.Attachments.LINK_MODE_LINKED_URL,
				obj.channel.contentType, null, sourceItemID);
		});
	}
	
	
	// TODO: what if called on file:// document?
	function linkFromDocument(document, sourceItemID){
		var url = document.location;
		var title = document.title; // TODO: don't use Mozilla-generated title for images, etc.
		var mimeType = document.contentType;
		var charsetID = Scholar.CharacterSets.getID(document.characterSet);
		
		return _addToDB(null, url, title, this.LINK_MODE_LINKED_URL, mimeType, charsetID, sourceItemID);
	}
	
	
	function importFromDocument(document, sourceItemID){
		var url = document.location;
		var title = document.title;
		var mimeType = document.contentType;
		var charsetID = Scholar.CharacterSets.getID(document.characterSet);
		
		const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
		var wbp = Components
			.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
			.createInstance(nsIWBP);
		//wbp.persistFlags = nsIWBP.PERSIST_FLAGS...;
		var encodingFlags = false;
		
		Scholar.DB.beginTransaction();
		
		// Create a new attachment
		var attachmentItem = Scholar.Items.getNewItemByType(Scholar.ItemTypes.getID('attachment'));
		attachmentItem.setField('title', title);
		attachmentItem.save();
		var itemID = attachmentItem.getID();
		
		// Create a new folder for this item in the storage directory
		var destDir = Scholar.getStorageDirectory();
		destDir.append(itemID);
		destDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0644);
		
		var file = Components.classes["@mozilla.org/file/local;1"].
				createInstance(Components.interfaces.nsILocalFile);
		file.initWithFile(destDir);
		file.append(_getFileNameFromURL(url, mimeType));
		
		wbp.saveDocument(document, file, destDir, mimeType, encodingFlags, false);
		
		_addToDB(file, url, title, this.LINK_MODE_IMPORTED_URL, mimeType, charsetID, sourceItemID, itemID);
		
		Scholar.DB.commitTransaction();
		return itemID;
	}
	
	
	function _getCharsetIDFromFile(file){
		// TODO: Not yet implemented
		return null;
	}
	
	
	function _getFileNameFromURL(url, mimeType){
		var nsIURL = Components.classes["@mozilla.org/network/standard-url;1"]
					.createInstance(Components.interfaces.nsIURL);
		nsIURL.spec = url;
		
		if (nsIURL.fileName){
			return nsIURL.fileName;
		}
		
		if (mimeType){
			var ext = Components.classes["@mozilla.org/mime;1"]
				.getService(Components.interfaces.nsIMIMEService)
				.getPrimaryExtension(mimeType, nsIURL.fileExt ? nsIURL.fileExt : null);
		}
		
		return nsIURL.host + (ext ? '.' + ext : '');
	}
	
	
	/**
	* Create a new item of type 'attachment' and add to the itemAttachments table
	*
	* Passing an itemID causes it to skip new item creation and use the specified
	* item instead -- used when importing files (since we have to know
	* the itemID before copying in a file and don't want to update the DB before
	* the file is saved)
	*
	* Returns the itemID of the new attachment
	**/
	function _addToDB(file, url, title, linkMode, mimeType, charsetID, sourceItemID, itemID){
		if (url){
			var path = url;
		}
		if (file){
			if (linkMode==self.LINK_MODE_IMPORTED_URL){
				var originalPath = path;
			}
			
			// Path relative to Scholar directory for external files and relative
			// to storage directory for imported files
			var refDir = (linkMode==this.LINK_MODE_LINKED_FILE)
				? Scholar.getScholarDirectory() : Scholar.getStorageDirectory();
			var path = file.getRelativeDescriptor(refDir);
		}
		
		Scholar.DB.beginTransaction();
		
		if (sourceItemID){
			var sourceItem = Scholar.Items.get(sourceItemID);
			if (!sourceItem){
				Scholar.DB.commitTransaction();
				throw ("Cannot set attachment source to invalid item " + sourceItemID);
			}
			if (sourceItem.isAttachment()){
				Scholar.DB.commitTransaction();
				throw ("Cannot set attachment source to another file (" + sourceItemID + ")");
			}
		}
		
		// If an itemID is provided, use that
		if (itemID){
			var attachmentItem = Scholar.Items.get(itemID);
			if (!attachmentItem.isAttachment()){
				throw ("Item " + itemID + " is not a valid attachment in _addToDB()");
			}
		}
		// Otherwise create a new attachment
		else {
			var attachmentItem = Scholar.Items.getNewItemByType(Scholar.ItemTypes.getID('attachment'));
			attachmentItem.setField('title', title);
			attachmentItem.save();
		}
		
		var sql = "INSERT INTO itemAttachments (itemID, sourceItemID, linkMode, "
			+ "mimeType, charsetID, path, originalPath) VALUES (?,?,?,?,?,?,?)";
		var bindParams = [
			attachmentItem.getID(),
			(sourceItemID ? {int:sourceItemID} : null),
			{int:linkMode},
			{string:mimeType},
			(charsetID ? {int:charsetID} : null),
			{string:path},
			(originalPath ? {string:originalPath} : null)
		];
		Scholar.DB.query(sql, bindParams);
		Scholar.DB.commitTransaction();
		
		if (sourceItemID){
			sourceItem.incrementNoteCount();
			Scholar.Notifier.trigger('modify', 'item', sourceItemID);
		}
		
		Scholar.Notifier.trigger('add', 'item', attachmentItem.getID());
		
		return attachmentItem.getID();
	}
}

/*
 * Constructor for Collection object
 *
 * Generally should be called from Scholar.Collection rather than directly
 */
Scholar.Collection = function(){
	 this._init();
}

Scholar.Collection.prototype._init = function(){
	//
	// Public members for access by public methods -- do not access directly
	//
	this._id;
	this._name;
	this._parent;
	this._hasChildCollections;
	this._hasChildItems;
	this._childItems = new Scholar.Hash();
	this._childItemsLoaded;
}

/*
 * Build collection from database
 */
Scholar.Collection.prototype.loadFromID = function(id){
	// Should be same as query in Scholar.Collections, just with collectionID
	var sql = "SELECT collectionID, collectionName, parentCollectionID, "
		+ "(SELECT COUNT(*) FROM collections WHERE "
		+ "parentCollectionID=C.collectionID)!=0 AS hasChildCollections, "
		+ "(SELECT COUNT(*) FROM collectionItems WHERE "
		+ "collectionID=C.collectionID)!=0 AS hasChildItems "
		+ "FROM collections C "
		+ "WHERE collectionID=" + id;
	
	var row = Scholar.DB.rowQuery(sql);
	this.loadFromRow(row);
}


/*
 * Populate collection data from a database row
 */
Scholar.Collection.prototype.loadFromRow = function(row){
	this._init();
	this._id = row['collectionID'];
	this._name = row['collectionName'];
	this._parent = row['parentCollectionID'];
	this._hasChildCollections = row['hasChildCollections'];
	this._hasChildItems = row['hasChildItems'];
}


Scholar.Collection.prototype.getID = function(){
	return this._id;
}

Scholar.Collection.prototype.getName = function(){
	return this._name;
}

/**
* Returns collectionID of the parent collection
**/
Scholar.Collection.prototype.getParent = function(){
	return this._parent;
}


Scholar.Collection.prototype.isEmpty = function(){
	return !(parseInt(this._hasChildCollections)) && !(parseInt(this._hasChildItems));
}

Scholar.Collection.prototype.hasChildCollections = function(){
	return !!(parseInt(this._hasChildCollections));
}

Scholar.Collection.prototype.hasChildItems = function(){
	return !!(parseInt(this._hasChildItems));
}

/**
* Rename the collection
*
* _name_ is non-empty string
*
* Returns true on success, or false on error
**/
Scholar.Collection.prototype.rename = function(name){
	if (!name){
		return false;
	}
	
	var sql = "UPDATE collections SET collectionName=? "
		+ "WHERE collectionID=?";
	Scholar.DB.query(sql, [{'string':name},{'int':this.getID()}]);
	this._name = name;
	
	Scholar.Notifier.trigger('modify', 'collection', this.getID());
	return true;
}


/**
* Change the parentCollectionID of a collection
*
* Returns TRUE on success, FALSE on error
**/
Scholar.Collection.prototype.changeParent = function(parent){
	if (!parent){
		parent = null;
	}
	
	var previousParent = this.getParent();
	
	if (parent==previousParent){
		Scholar.debug('Collection ' + this.getID() + ' is already in '
			+ (parent ? 'collection ' + parent : 'root collection'), 2);
		return false;
	}
	
	if (parent && !Scholar.Collections.get(parent)){
		throw('Invalid parentCollectionID ' + parent + ' in changeParent()');
	}
	
	if (parent && parent==this.getID()){
		Scholar.debug('Cannot move collection into itself!', 2);
		return false;
	}
	
	if (parent){
		if (this.hasDescendent('collection', parent)){
			Scholar.debug('Cannot move collection into one of its own '
				+ 'descendents!', 2);
			return false;
		}
	}
	
	var parentParam = parent ? {'int':parent} : {'null':true};
	
	var sql = "UPDATE collections SET parentCollectionID=? "
		+ "WHERE collectionID=?";
	
	Scholar.DB.query(sql, [parentParam, {'int':this.getID()}]);
	this._parent = parent;
	
	var notifyIDs = [
		this.getID(),
		(previousParent ? previousParent : null),
		(parent ? parent : null)
	];
	
	// TODO: only reload the necessary ones
	Scholar.Collections.reloadAll();
	Scholar.Notifier.trigger('move', 'collection', notifyIDs);
	return true;
}


/**
* Add an item to the collection
**/
Scholar.Collection.prototype.addItem = function(itemID){
	Scholar.DB.beginTransaction();
	
	if (!Scholar.Items.get(itemID)){
		Scholar.DB.rollbackTransaction();	
		throw(itemID + ' is not a valid item id');
	}
	
	var nextOrderIndex = Scholar.DB.valueQuery("SELECT IFNULL(MAX(orderIndex)+1, 0) "
		+ "FROM collectionItems WHERE collectionID=" + this._id);
	
	var sql = "INSERT OR IGNORE INTO collectionItems VALUES "
		+ "(" + this._id + ", " + itemID + ", " + nextOrderIndex + ")";
	
	Scholar.DB.query(sql);
	Scholar.DB.commitTransaction();
	
	this._childItems.set(itemID);
	
	// If this was previously empty, update and send a notification to the tree
	if (!this._hasChildItems){
		this._hasChildItems = true;
		Scholar.Notifier.trigger('modify', 'collection', this.getID());
	}
	
	Scholar.Notifier.trigger('add', 'item', itemID);
}


/**
* Remove an item from the collection (does not delete item from library)
**/
Scholar.Collection.prototype.removeItem = function(itemID){
	Scholar.DB.beginTransaction();
	
	var sql = "SELECT orderIndex FROM collectionItems "
		+ "WHERE collectionID=" + this._id + " AND itemID=" + itemID;
	var orderIndex = Scholar.DB.valueQuery(sql);
	
	if (orderIndex===false){
		Scholar.debug('Item ' + itemID + ' is not a child of collection '
			+ this._id);
		Scholar.DB.rollbackTransaction();
		return false;
	}
	
	var sql = "DELETE FROM collectionItems WHERE collectionID=" + this._id
		+ " AND itemID=" + itemID;
	Scholar.DB.query(sql);
	
	// Move down items above deleted item in collection
	sql = 'UPDATE collectionItems SET orderIndex=orderIndex-1 '
		+ 'WHERE collectionID=' + this._id
		+ ' AND orderIndex>' + orderIndex;
	Scholar.DB.query(sql);
	
	Scholar.DB.commitTransaction();
	this._childItems.remove(itemID);
	
	// If this was the last item, set collection to empty
	if (!this._childItems.length){
		this._hasChildItems = false;
		Scholar.Notifier.trigger('modify', 'collection', this.getID());
	}
	
	Scholar.Notifier.trigger('remove', 'item', itemID);
}


/**
* Check if an item belongs to the collection
**/
Scholar.Collection.prototype.hasItem = function(itemID){
	if (!this._childItemsLoaded){
		this._loadChildItems();
	}
	return this._childItems.has(itemID);
}


Scholar.Collection.prototype.hasDescendent = function(type, id){
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
Scholar.Collection.prototype.erase = function(deleteItems){
	Scholar.DB.beginTransaction();
	
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
				Scholar.Items.get(descendents[i]['id']).erase();
				items.push(descendents[i]['id']);
			}
		}
	}
	
	// Remove item associations for all descendent collections
	Scholar.DB.query('DELETE FROM collectionItems WHERE collectionID IN ('
		+ collections.join() + ')');
	
	// And delete all descendent collections
	Scholar.DB.query('DELETE FROM collections WHERE collectionID IN ('
		+ collections.join() + ')');
	
	Scholar.DB.commitTransaction();
	
	// Clear deleted collection from internal memory
	Scholar.Collections.unload(collections);
	
	Scholar.Notifier.trigger('remove', 'collection', collections);
	if (items.length){
		Scholar.Notifier.trigger('delete', 'item', items);
	}
}


Scholar.Collection.prototype.isCollection = function(){
	return true;
}


Scholar.Collection.prototype.toArray = function(){
	return this.getDescendents(true);
}


Scholar.Collection.prototype._loadChildItems = function(){
	this._childItems = new Scholar.Hash();
	
	var sql = "SELECT itemID FROM collectionItems WHERE collectionID=" + this._id;
	var itemIDs = Scholar.DB.columnQuery(sql);
	
	if (!itemIDs){
		Scholar.debug('Collection ' + this._id + ' has no child items');
	}
	
	for (var i=0; i<itemIDs.length; i++){
		this._childItems.set(itemIDs[i]);
	}
	this._childItemsLoaded = true;
}


/**
* Returns an array of descendent collections and items
* 	(rows of 'id', 'type' ('item' or 'collection'), and, if collection, 'name')
*
* nested: Return multidimensional array with 'children' nodes instead of flat array
**/
Scholar.Collection.prototype.getDescendents = function(nested, type){
	var toReturn = new Array();
	
	// 0 == collection
	// 1 == item
	var children = Scholar.DB.query('SELECT collectionID AS id, '
		+ "0 AS type, collectionName AS collectionName "
		+ 'FROM collections WHERE parentCollectionID=' + this._id
		+ ' UNION SELECT itemID AS id, 1 AS type, NULL AS collectionName '
		+ 'FROM collectionItems WHERE collectionID=' + this._id);
	
	for(var i=0, len=children.length; i<len; i++){
		switch (children[i]['type']){
			case 0:
				if (!type || type=='collection'){
					toReturn.push({
						id: children[i]['id'],
						name: children[i]['collectionName'],
						type: 'collection'
					});
				}
				
				var descendents =
					Scholar.Collections.get(children[i]['id']).getDescendents(nested, type);
				
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
 * Primary interface for accessing Scholar collection
 */
Scholar.Collections = new function(){
	var _collections = new Array();
	var _collectionsLoaded = false;
	
	this.get = get;
	this.add = add;
	this.reloadAll = reloadAll;
	this.unload = unload;
	
	/*
	 * Returns a Scholar.Collection object for a collectionID
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
		
		Scholar.DB.beginTransaction();
		
		if (parent && !this.get(parent)){
			Scholar.DB.rollbackTransaction();
			throw('Cannot add collection to invalid parent ' + parent);
		}
		
		var parentParam = parent ? {'int':parent} : {'null':true};
		
		var rnd = Scholar.getRandomID('collections', 'collectionID');
		
		var sql = "INSERT INTO collections VALUES (?,?,?)";
		var sqlValues = [ {'int':rnd}, {'string':name}, parentParam ];
		Scholar.DB.query(sql, sqlValues);
		
		Scholar.DB.commitTransaction();
		
		_load(rnd);
		Scholar.Notifier.trigger('add', 'collection', rnd);
		
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
	* Clear collection from internal cache (used by Scholar.Collection.erase())
	*
	* Can be passed ids as individual parameters or as an array of ids, or both
	**/
	function unload(){
		var ids = Scholar.flattenArguments(arguments);
		
		for(var i=0; i<ids.length; i++){
			delete _collections[ids[i]];
		}
	}
	
	
	/**
	* Loads collection data from DB and adds to internal cache
	**/
	function _load(){
		// This should be the same as the query in Scholar.Collection.loadFromID,
		// just without a specific collectionID
		var sql = "SELECT collectionID, collectionName, parentCollectionID, "
			+ "(SELECT COUNT(*) FROM collections WHERE "
			+ "parentCollectionID=C.collectionID)!=0 AS hasChildCollections, "
			+ "(SELECT COUNT(*) FROM collectionItems WHERE "
			+ "collectionID=C.collectionID)!=0 AS hasChildItems "
			+ "FROM collections C";
		
		var ids = Scholar.flattenArguments(arguments)
		if (ids.length){
			sql += " WHERE collectionID IN (" + ids.join() + ")";
		}
		
		var result = Scholar.DB.query(sql);
		
		if (!result){
			throw ('No collections found');
		}
		
		for (var i=0; i<result.length; i++){
			var collectionID = result[i]['collectionID'];
			
			// If collection doesn't exist, create new object and stuff in array
			if (!_collections[collectionID]){
				var collection = new Scholar.Collection();
				collection.loadFromRow(result[i]);
				_collections[collectionID] = collection;
			}
			// If existing collection, reload in place
			else {
				_collections[collectionID].loadFromRow(result[i]);
			}
		}
		_collectionsLoaded = true;
	}
}



/*
 * Same structure as Scholar.Tags -- make changes in both places if possible
 */
Scholar.Creators = new function(){
	var _creators = new Array; // indexed by first%%%last%%%isInstitution hash
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
		var result = Scholar.DB.rowQuery(sql);
		
		if (!result){
			return false;
		}
		
		_creatorsByID[creatorID] = result;
		return result;
	}
	
	
	/*
	 * Returns the creatorID matching given name and type
	 */
	function getID(firstName, lastName, isInstitution){
		if (!firstName){
			firstName = '';
		}
		if (!lastName){
			lastName = '';
		}
		
		if (isInstitution){
			firstName = '';
			isInstitution = 1;
		}
		else {
			isInstitution = 0;
		}
		
		var hash = firstName + '%%%' + lastName + '%%%' + isInstitution;
		
		if (_creators[hash]){
			return _creators[hash];
		}
		
		var sql = 'SELECT creatorID FROM creators '
			+ 'WHERE firstName=? AND lastName=? AND isInstitution=?';
		var params = [{string: firstName}, {string: lastName}, isInstitution];
		var creatorID = Scholar.DB.valueQuery(sql, params);
		
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
	function add(firstName, lastName, isInstitution){
		Scholar.debug('Adding new creator', 4);
		
		Scholar.DB.beginTransaction();
		
		var sql = 'INSERT INTO creators VALUES (?,?,?,?)';
		var rnd = Scholar.getRandomID('creators', 'creatorID');
		var params = [
			rnd, isInstitution ? '' : {string: firstName}, {string: lastName},
			isInstitution ? 1 : 0
		];
		Scholar.DB.query(sql, params);
		
		Scholar.DB.commitTransaction();
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
		var toDelete = Scholar.DB.columnQuery(sql);
		
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
		var result = Scholar.DB.query(sql);
		
		return toDelete;
	}
	
	
	function _getHash(creatorID){
		var creator = self.get(creatorID);
		if (!creator){
			return false;
		}
		return creator['firstName'] + '%%%' + creator['lastName'] + '%%%' +
			creator['isInstitution'];
	}
}


/*
 * Same structure as Scholar.Creators -- make changes in both places if possible
 */
Scholar.Tags = new function(){
	var _tags = new Array; // indexed by tag text
	var _tagsByID = new Array; // indexed by tagID
	
	this.getName = getName;
	this.getID = getID;
	this.add = add;
	this.purge = purge;
	
	/*
	 * Returns a tag for a given tagID
	 */
	function getName(tagID){
		if (_tagsByID[tagID]){
			return _tagsByID[tagID];
		}
		
		var sql = 'SELECT tag FROM tags WHERE tagID=' + tagID;
		var result = Scholar.DB.valueQuery(sql);
		
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
		var tagID = Scholar.DB.valueQuery(sql, [{string:tag}]);
		
		if (tagID){
			_tags[tag] = tagID;
		}
		
		return tagID;
	}
	
	
	/*
	 * Add a new tag to the database
	 *
	 * Returns new tagID
	 */
	function add(tag){
		Scholar.debug('Adding new tag', 4);
		
		Scholar.DB.beginTransaction();
		
		var sql = 'INSERT INTO tags VALUES (?,?)';
		var rnd = Scholar.getRandomID('tags', 'tagID');
		Scholar.DB.query(sql, [{int: rnd}, {string: tag}]);
		
		Scholar.DB.commitTransaction();
		return rnd;
	}
	
	
	/*
	 * Delete obsolete tags from database and clear internal array entries
	 *
	 * Returns removed tagIDs on success
	 */
	function purge(){
		var sql = 'SELECT tagID FROM tags WHERE tagID NOT IN '
			+ '(SELECT tagID FROM itemTags);';
		var toDelete = Scholar.DB.columnQuery(sql);
		
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
		var result = Scholar.DB.query(sql);
		
		return toDelete;
	}
}




/*
 * Base function for retrieving ids and names of static types stored in the DB
 * (e.g. creatorType, fileType, charset, itemType)
 *
 * Extend using the following code within a child constructor:
 *
 * 	Scholar.CachedTypes.apply(this, arguments);
 *  this.constructor.prototype = new Scholar.CachedTypes();
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
Scholar.CachedTypes = function(){
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
			Scholar.debug('Invalid ' + this._typeDesc + ' ' + idOrName, 1);
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
			Scholar.debug('Invalid ' + this._typeDesc + ' ' + idOrName, 1);
			return false;
		}
		
		return _types[idOrName]['id'];
	}
	
	
	function getTypes(){
		return Scholar.DB.query('SELECT ' + this._idCol + ' AS id, '
			+ this._nameCol + ' AS name FROM ' + this._table + ' order BY ' + this._nameCol);
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


Scholar.CreatorTypes = new function(){
	Scholar.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Scholar.CachedTypes();
	
	this._typeDesc = 'creator type';
	this._idCol = 'creatorTypeID';
	this._nameCol = 'creatorType';
	this._table = 'creatorTypes';
}


Scholar.ItemTypes = new function(){
	Scholar.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Scholar.CachedTypes();
	
	this._typeDesc = 'item type';
	this._idCol = 'itemTypeID';
	this._nameCol = 'typeName';
	this._table = 'itemTypes';
}


Scholar.FileTypes = new function(){
	Scholar.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Scholar.CachedTypes();
	
	this._typeDesc = 'file type';
	this._idCol = 'fileTypeID';
	this._nameCol = 'fileType';
	this._table = 'fileTypes';
	
	this.getIDFromMIMEType = getIDFromMIMEType;
	
	function getIDFromMIMEType(mimeType){
		var sql = "SELECT fileTypeID FROM fileTypeMIMETypes "
			+ "WHERE ? LIKE mimeType || '%'";
			
		return Scholar.DB.valueQuery(sql, [mimeType]);
	}
}


Scholar.CharacterSets = new function(){
	Scholar.CachedTypes.apply(this, arguments);
	this.constructor.prototype = new Scholar.CachedTypes();
	
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




Scholar.ItemFields = new function(){
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
		
		var sql = 'SELECT fieldID FROM itemTypeFields '
			+ 'WHERE itemTypeID=' + itemTypeID + ' ORDER BY orderIndex';
		
		_itemTypeFields[itemTypeID] = Scholar.DB.columnQuery(sql);
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
		
		var results = Scholar.DB.query(sql);
		
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
		
		var result = Scholar.DB.query('SELECT * FROM fieldFormats');
		
		for (i=0; i<result.length; i++){
			_fieldFormats[result[i]['fieldFormatID']] = {
				regex: result[i]['regex'],
				isInteger: result[i]['isInteger']
			};
		}
		
		result = Scholar.DB.query('SELECT * FROM fields');
		
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
 * Scholar.getCollections(parent)
 *
 * Returns an array of all collections are children of a collection
 * as Scholar.Collection instances
 *
 * Takes parent collectionID as optional parameter;
 * by default, returns root collections
 */
Scholar.getCollections = function(parent){
	var toReturn = new Array();
	
	if (!parent){
		parent = null;
	}
	
	var sql = 'SELECT collectionID FROM collections C WHERE parentCollectionID';
	sql += parent ? '=' + parent : ' IS NULL';
	
	sql += ' ORDER BY collectionName';
	
	var children = Scholar.DB.columnQuery(sql);
	
	if (!children){
		Scholar.debug('No child collections of collection ' + parent, 5);
		return toReturn;
	}
	
	for (var i=0, len=children.length; i<len; i++){
		var obj = Scholar.Collections.get(children[i]);
		if (!obj){
			throw ('Collection ' + children[i] + ' not found');
		}
		
		toReturn.push(obj);
	}
	
	return toReturn;
}


/*
 * Scholar.getItems(parent)
 *
 * Returns an array of all items that are children of a collection--or all
 * items if no parent provided--as Scholar.Item instances
 */
Scholar.getItems = function(parent){
	var toReturn = new Array();
	
	if (!parent){
		var sql = "SELECT A.itemID FROM items A LEFT JOIN itemNotes B USING (itemID) "
			+ "LEFT JOIN itemAttachments C ON (C.itemID=A.itemID) WHERE B.sourceItemID IS NULL"
			+ " AND C.sourceItemID IS NULL";
	}
	else {
		var sql = 'SELECT itemID FROM collectionItems '
			+ 'WHERE collectionID=' + parent;
	}
	
	var children = Scholar.DB.columnQuery(sql);
	
	if (!children){
		if (!parent){
			Scholar.debug('No items in library', 5);
		}
		else {
			Scholar.debug('No child items of collection ' + parent, 5);
		}
		return toReturn;
	}
	
	return Scholar.Items.get(children);
}
