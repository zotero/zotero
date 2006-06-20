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
	var sql = 'SELECT I.*, lastName || '
		+ 'CASE ((SELECT COUNT(*) FROM itemCreators WHERE itemID=' + id + ')>1) '
		+ "WHEN 0 THEN '' ELSE ' et al.' END AS firstCreator "
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


/*
 * Returns an array of the creator data at the given position, or false if none
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
 * Set or update the creator at the specified position
 */
Scholar.Item.prototype.setCreator = function(orderIndex, firstName, lastName, creatorTypeID){
	if (this.getID() && !this._creatorsLoaded){
		this._loadCreators();
	}
	
	if (!firstName){
		firstName = '';
	}
	
	if (!lastName){
		lastName = '';
	}
	
	// If creator at this position hasn't changed, cancel
	if (this._creators.has(orderIndex) &&
		this._creators.get(orderIndex)['firstName']==firstName &&
		this._creators.get(orderIndex)['lastName']==lastName &&
		this._creators.get(orderIndex)['creatorTypeID']==creatorTypeID){
		return false;
	}
	
	if (!creatorTypeID){
		creatorTypeID = 1;
	}
	
	var creator = new Array();
	creator['firstName'] = firstName;
	creator['lastName'] = lastName;
	creator['creatorTypeID'] = creatorTypeID;
	
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


Scholar.Item.prototype.creatorExists = function(firstName, lastName, creatorTypeID, skipIndex){
	for (var j=0, len=this.numCreators(); j<len; j++){
		if (typeof skipIndex!='undefined' && skipIndex==j){
			continue;
		}
		var creator2 = this.getCreator(j);
		
		if (firstName==creator2['firstName'] &&
			lastName==creator2['lastName'] &&
			creatorTypeID==creator2['creatorTypeID']){
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
		this._changed.set(field);
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
			
			//
			// Primary fields
			//
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
				for (var i=0, len=this.numCreators(); i<len; i++){
					var creator = this.getCreator(i);
					if (this.creatorExists(creator['firstName'],
							creator['lastName'], creator['creatorTypeID'], i)){
						throw('Cannot add duplicate creator/creatorType '
							+ 'to item ' + this.getID());
					}
				}
				
				for (orderIndex in this._changedCreators.items){
					Scholar.debug('Creator ' + orderIndex + ' has changed', 4);
					
					var creator = this.getCreator(orderIndex);
					
					// Delete at position
					sql2 = 'DELETE FROM itemCreators'
						+ ' WHERE itemID=' + this.getID()
						+ ' AND orderIndex=' + orderIndex;
					Scholar.DB.query(sql2);
					
					// If empty, move on
					if (!creator['firstName'] && !creator['lastName']){
						continue;
					}
					
					// See if this is an existing creator
					var creatorID = Scholar.Creators.getID(
							creator['firstName'],
							creator['lastName']
					);
					
					// If not, add it
					if (!creatorID){
						creatorID = Scholar.Creators.add(
							creator['firstName'],
							creator['lastName']
						);
					}
					
					// If this creator and creatorType exists elsewhere, move it
					sql2 = 'SELECT COUNT(*) FROM itemCreators'
						+ ' WHERE itemID=' + this.getID()
						+ ' AND creatorID=' + creatorID
						+ ' AND creatorTypeID=' + creator['creatorTypeID'];
					
					if (Scholar.DB.valueQuery(sql2)){
						sql = 'UPDATE itemCreators SET orderIndex=? '
							+ "WHERE itemID=? AND creatorID=? AND "
							+ "creatorTypeID=?";
							
						sqlValues = [
							{'int':orderIndex},
							{'int':this.getID()},
							{'int':creatorID},
							{'int':creator['creatorTypeID']}
						];
						
						Scholar.DB.query(sql, sqlValues);
					}
					// Otherwise insert
					else {
						sql = "INSERT INTO itemCreators VALUES (?,?,?,?)";
						
						sqlValues = [
							{'int':itemID},
							{'int':creatorID},
							{'int':creator['creatorTypeID']},
							{'int':orderIndex}
						];
						
						Scholar.DB.query(sql, sqlValues);
					}
				}
				
				// Append the SQL to delete obsolete creators
				//
				// TODO: fix this so it actually purges the internal memory
				if (sql = Scholar.Creators.purge(true)){
					Scholar.DB.query(sql);
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
						
						if (Scholar.DB.valueQuery(sql2)){
							sqlValues = [];
							
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
						else {
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
					sql = 'DELETE from itemData '
						+ 'WHERE itemID=' + this.getID() + ' '
						+ 'AND fieldID IN (' + del.join() + ")";
					Scholar.DB.query(sql);
				}
			}
			
			Scholar.DB.commitTransaction();
		}
		catch (e){
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
		sqlColumns.push('itemTypeID');
		sqlValues.push({'int':this.getField('itemTypeID')});
		
		if (this._changed.has('title')){
			sqlColumns.push('title');
			sqlValues.push({'string':this.getField('title')});
		}
		
		try {
			Scholar.DB.beginTransaction();
			
			//
			// itemData fields
			//
			var sql = "INSERT INTO items (" + sqlColumns.join() + ')'
				+ ' VALUES (';
			// Insert placeholders for bind parameters
			for (var i=0; i<sqlValues.length; i++){
				sql += '?,';
			}
			sql = sql.substring(0,sql.length-1) + ")";
			
			// Save basic data to items table and get new ID
			var itemID = Scholar.DB.query(sql,sqlValues);
			this._data['itemID'] = itemID;
			
			// Set itemData
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
							creator['lastName']
					);
					
					// If not, add it
					if (!creatorID){
						creatorID = Scholar.Creators.add(
							creator['firstName'],
							creator['lastName']
						);
					}
					
					sql = 'INSERT INTO itemCreators VALUES ('
						+ itemID + ',' + creatorID + ','
						+ creator['creatorTypeID'] + ', ' + orderIndex
						+ ")";
					Scholar.DB.query(sql);
				}
			}
			
			Scholar.DB.commitTransaction();
			
			// Reload collection to update isEmpty,
			// in case this was the first item in a collection
			Scholar.Collections.reloadAll();
		}
		catch (e){
			Scholar.DB.rollbackTransaction();
			throw(e);
		}
	}
	
	Scholar.Items.reload(this.getID());
	
	if (isNew){
		Scholar.Notifier.trigger('add', 'item', this.getID());
		return this.getID();
	}
	else {
		Scholar.Notifier.trigger('modify', 'item', this.getID());
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


//
// Methods dealing with item notes
//
// save() is not required for note functions
//
/**
* Add a new note to an item and return the noteID
**/
Scholar.Item.prototype.addNote = function(text){
	Scholar.DB.beginTransaction();
	var noteID = Scholar.getRandomID('itemNotes', 'noteID', 65535);
	var sql = "INSERT INTO itemNotes (noteID, itemID, note) VALUES (?,?,?)";
	Scholar.DB.query(sql,
		[{'int':noteID}, {'int':this.getID()}, {'string':text}]
	);
	this.updateDateModified();
	Scholar.DB.commitTransaction();
	Scholar.Notifier.trigger('modify', 'item', this.getID());
	return noteID;
}

/**
* Update an item note
**/
Scholar.Item.prototype.updateNote = function(noteID, text){
	Scholar.DB.beginTransaction();
	var sql = "UPDATE itemNotes SET note=?, dateModified=CURRENT_TIMESTAMP "
		+ "WHERE itemID=? AND noteID=?";
	Scholar.DB.query(sql,
		[{'string':text}, {'int':this.getID()}, {'int':noteID}]
	);
	this.updateDateModified();
	Scholar.DB.commitTransaction();
	Scholar.Notifier.trigger('modify', 'item', this.getID());
}

/**
* Delete an item note
**/
Scholar.Item.prototype.removeNote = function(noteID){
	Scholar.DB.beginTransaction();
	var sql = "DELETE FROM itemNotes WHERE itemID=" + this.getID()
		+ " AND noteID=" + noteID;
	Scholar.DB.query(sql);
	this.updateDateModified();
	Scholar.DB.commitTransaction();
	Scholar.Notifier.trigger('modify', 'item', this.getID());
}

/**
* Returns number of notes in item
**/
Scholar.Item.prototype.numNotes = function(){
	if (!this.getID()){
		return 0;
	}
	
	var sql = "SELECT COUNT(*) FROM itemNotes WHERE itemID=" + this.getID();
	return parseInt(Scholar.DB.valueQuery(sql));
}

/**
* Get the text of an item note
**/
Scholar.Item.prototype.getNote = function(noteID){
	var sql = "SELECT note FROM itemNotes WHERE itemID=" + this.getID()
		+ " AND noteID=" + noteID;
	return Scholar.DB.valueQuery(sql);
}

/**
* Returns an array of noteIDs for this item
**/
Scholar.Item.prototype.getNotes = function(){
	if (!this.getID()){
		return [];
	}
	
	var sql = "SELECT noteID FROM itemNotes WHERE itemID=" + this.getID()
		+ " ORDER BY dateCreated";
	return Scholar.DB.columnQuery(sql);
}


/**
* Delete item from database and clear from Scholar.Items internal array
**/
Scholar.Item.prototype.erase = function(){
	if (!this.getID()){
		return false;
	}
	
	Scholar.debug('Deleting item ' + this.getID());
		
	Scholar.DB.beginTransaction();
	
	// Remove item from parent collections
	var parentCollectionIDs = this.getCollections();
	for (var i=0; i<parentCollectionIDs.length; i++){
		Scholar.Collections.get(parentCollectionIDs[i]).removeItem(this.getID());
	}
	
	sql = 'DELETE FROM itemCreators WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemNotes WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemKeywords WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM itemData WHERE itemID=' + this.getID() + ";\n";
	sql += 'DELETE FROM items WHERE itemID=' + this.getID() + ";\n";
	
	Scholar.DB.query(sql);
	Scholar.Creators.purge();
	
	try {
		Scholar.DB.commitTransaction();
	}
	catch (e){
		Scholar.DB.rollbackTransaction();
		throw (e);
	}
	
	Scholar.Items.unload(this.getID());
	
	// If we're not in the middle of a larger commit, trigger the notifier now
	if (!Scholar.DB.transactionInProgress()){
		Scholar.Notifier.trigger('delete', 'item', this.getID());
	}
}


Scholar.Item.prototype.isCollection = function(){
	return false;
}


Scholar.Item.prototype.toString = function(){
	return this.getTitle();
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
			+ "SELECT itemID FROM itemKeywords WHERE keywordID IN "
			+ "(SELECT keywordID FROM keywords WHERE keyword LIKE ?1) UNION "
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
			+ "WHEN 0 THEN '' ELSE ' et al.' END AS firstCreator "
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
		Scholar.Notifier.trigger('modify', 'collections', this.getID());
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
	var descendents = this._getDescendents();
	for (var i=0, len=descendents.length; i<len; i++){
		// TODO: fix this to work with smart collections
		if (((type=='collection' && descendents[i]['isCollection']) ||
			(type=='item' && !descendents[i]['isCollection']))
			&& id==descendents[i]['id']){
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
	
	var descendents = this._getDescendents();
	var collections = [this.getID()], items = [];
	
	for(var i=0, len=descendents.length; i<len; i++){
		// Descendent collections
		if (descendents[i]['isCollection']){
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
* Returns an array of descendent collections and items (rows of 'id' and 'isCollection')
**/
Scholar.Collection.prototype._getDescendents = function(){
	var toReturn = new Array();
	
	var children = Scholar.DB.query('SELECT collectionID AS id, '
		+ '1 AS isCollection FROM collections '
		+ 'WHERE parentCollectionID=' + this._id
		+ ' UNION SELECT itemID AS id, 0 AS isCollection FROM collectionItems '
		+ 'WHERE collectionID=' + this._id);
	
	for(var i=0, len=children.length; i<len; i++){
		if (parseInt(children[i]['isCollection'])){
			toReturn.push({
				id: children[i]['id'],
				isCollection: true
			});
			
			var descendents =
				Scholar.Collections.get(children[i]['id'])._getDescendents();
			
			for(var j=0, len2=descendents.length; j<len2; j++){
				toReturn.push(descendents[j]);
			}
		}
		else {
			toReturn.push({
				id: children[i]['id'],
				isCollection: false
			});
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




Scholar.Creators = new function(){
	var _creators = new Array; // indexed by first%%%last hash
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
	function getID(firstName, lastName){
		var hash = firstName + '%%%' + lastName;
		
		if (_creators[hash]){
			return _creators[hash];
		}
		
		var sql = 'SELECT creatorID FROM creators '
			+ 'WHERE firstName=? AND lastName=?';
		var params = [
			{'string': firstName}, {'string': lastName}
		];
		var creatorID = Scholar.DB.valueQuery(sql,params);
		
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
	function add(firstName, lastName){
		Scholar.debug('Adding new creator', 4);
		
		Scholar.DB.beginTransaction();
		
		var sql = 'INSERT INTO creators '
			+ 'VALUES (?,?,?)';
		
		var rnd = Scholar.getRandomID('creators', 'creatorID');
		
		var params = [
			{'int': rnd}, {'string': firstName}, {'string': lastName}
		];
		
		Scholar.DB.query(sql, params);
		
		Scholar.DB.commitTransaction();
		return rnd;
	}
	
	
	/*
	 * Delete obsolete creators from database and clear internal array entries
	 *
	 * Returns TRUE on success, or SQL query to run in returnSQL mode
	 */
	function purge(returnSQL){
		var sql = 'SELECT creatorID FROM creators WHERE creatorID NOT IN '
			+ '(SELECT creatorID FROM itemCreators);';
		var toDelete = Scholar.DB.columnQuery(sql);
		
		if (!toDelete){
			return returnSQL ? '' : false;
		}
		
		sql = 'DELETE FROM creators WHERE creatorID NOT IN '
			+ '(SELECT creatorID FROM itemCreators);';
		
		if (!returnSQL){
			var result = Scholar.DB.query(sql);
		}
		
		// Clear creator entries in internal array
		for (var i=0; i<toDelete.length; i++){
			var hash = _getHash(toDelete[i]);
			delete _creators[hash];
			delete _creatorsByID[toDelete[i]];
		}
		
		return returnSQL ? sql : result;
	}
	
	
	function _getHash(creatorID){
		var creator = self.get(creatorID);
		if (!creator){
			return false;
		}
		return creator['firstName'] + '%%%' + creator['lastName'];
	}
}




Scholar.CreatorTypes = new function(){
	var _creatorTypes = new Array();
	var _creatorTypesLoaded;
	var self = this;
	
	this.getTypes = getTypes;
	this.getTypeName = getTypeName;
	
	function getTypes(){
		return Scholar.DB.query('SELECT creatorTypeID AS id, '
			+ 'creatorType AS name FROM creatorTypes order BY creatorType');
	}
	
	function getTypeName(creatorTypeID){
		if (!_creatorTypesLoaded){
			_load();
		}
		
		if (!_creatorTypes[creatorTypeID]){
			Scholar.debug('Invalid creator type ' + creatorTypeID, 1);
		}
		
		return _creatorTypes[creatorTypeID];
	}
	
	function _load(){
		var types = self.getTypes();
		
		for (i in types){
			_creatorTypes[types[i]['id']] = types[i]['name'];
		}
		
		_creatorTypesLoaded = true;
	}
}




Scholar.ItemTypes = new function(){
	var _itemTypes = new Array();
	var _itemTypesLoaded;
	var self = this;
	
	this.getTypes = getTypes;
	this.getTypeName = getTypeName;
	
	function getTypes(){
		return Scholar.DB.query('SELECT itemTypeID AS id, typeName AS name '
			+ 'FROM itemTypes order BY typeName');
	}
	
	function getTypeName(itemTypeID){
		if (!_itemTypesLoaded){
			_load();
		}
		
		if (!_itemTypes[itemTypeID]){
			Scholar.debug('Invalid item type ' + itemTypeID, 1);
		}
		
		return _itemTypes[itemTypeID];
	}
	
	function _load(){
		var types = self.getTypes();
		
		for (i in types){
			_itemTypes[types[i]['id']] = types[i]['name'];
		}
		
		_itemTypesLoaded = true;
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
		var sql = 'SELECT itemID FROM items';
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
