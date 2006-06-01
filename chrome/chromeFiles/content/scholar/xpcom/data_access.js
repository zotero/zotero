/*
 * Constructor for Item object
 *
 * Generally should be called through Scholar.Items rather than directly
 */
Scholar.Item = function(){
	this._init();
	
	// Accept itemTypeIDin constructor
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
	var sql = 'SELECT I.*, lastName AS firstCreator '
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
	
	if (this._creators.has(orderIndex) &&
		this._creators.get(orderIndex)['firstName']==firstName &&
		this._creators.get(orderIndex)['lastName']==lastName &&
		this._creators.get(orderIndex)['creatorTypeID']==creatorTypeID){
		return true;
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
		if (this._itemData[fieldID] && this._itemData[fieldID]==value){
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
			
			if (this._changed.has('itemTypeID')){
				sql += "itemTypeID='" +  this.getField('itemTypeID') + "', ";
			}
			if (this._changed.has('title')){
				sql += "title='" +  this.getField('title') + "', ";
			}
			
			// Always update modified time
			sql += "dateModified=CURRENT_TIMESTAMP ";
			sql += "WHERE itemID=" + this.getID() + ";\n";
			
			
			//
			// Creators
			//
			if (this._changedCreators.length){
				for (orderIndex in this._changedCreators.items){
					Scholar.debug('Creator ' + orderIndex + ' has changed', 4);
					
					var creator = this.getCreator(orderIndex);
					
					// If empty, delete at position
					if (!creator['firstName'] && !creator['lastName']){
						sql2 = 'DELETE FROM itemCreators '
							+ ' WHERE itemID=' + this.getID()
							+ ' AND orderIndex=' + orderIndex;
						Scholar.DB.query(sql2);
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
					
					
					// If there's a creator at this position, update
					// with new creator data
					sql2 = 'SELECT COUNT(*) FROM itemCreators'
						+ ' WHERE itemID=' + this.getID()
						+ ' AND orderIndex=' + orderIndex;
					
					if (Scholar.DB.valueQuery(sql2)){
						sql += 'UPDATE itemCreators SET '
							+ 'creatorID=' + creatorID +', '
							+ 'creatorTypeID=' + creator['creatorTypeID'] + ' '
							+ 'WHERE itemID=' + this.getID()
							+ ' AND orderIndex=' + orderIndex + ";\n";
					}
					// Otherwise insert
					else {
						sql += 'INSERT INTO itemCreators VALUES ('
							+ itemID + ', ' + creatorID + ', '
							+ creator['creatorTypeID'] + ', ' + orderIndex
							+ ");\n";
					}
				}
				
				// Append the SQL to delete obsolete creators
				//
				// TODO: fix this so it actually purges the internal memory
				sql += Scholar.Creators.purge(true) + "\n";
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
							sql += "UPDATE itemData SET value=";
							// Take advantage of SQLite's manifest typing
							if (Scholar.ItemFields.isInteger(fieldID)){
								sql += this.getField(fieldID);
							}
							else {
								sql += "'" + this.getField(fieldID) + "'";
							}
							sql += " WHERE itemID=" + this.getID()
								+ ' AND fieldID=' + fieldID + ";\n";
						}
						else {
							sql += 'INSERT INTO itemData VALUES ('
								+ this.getID() + ',' + fieldID + ',';
								
							if (Scholar.ItemFields.isInteger(fieldID)){
								sql += this.getField(fieldID);
							}
							else {
								sql += "'" + this.getField(fieldID) + "'";
							}
							sql += ");\n";
						}
					}
					// If field changed and is empty, mark row for deletion
					else {
						del.push(fieldID);
					}
				}
				
				// Delete blank fields
				if (del.length){
					sql += 'DELETE from itemData '
						+ 'WHERE itemID=' + this.getID() + ' '
						+ 'AND fieldID IN (' + del.join() + ");\n";
				}
			}
			
			
			Scholar.DB.query(sql);
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
					
					sql += 'INSERT INTO itemCreators VALUES ('
						+ itemID + ',' + creatorID + ','
						+ creator['creatorTypeID'] + ', ' + orderIndex
						+ ");\n";
				}
			}
			
			
			//
			// itemData fields
			//
			var sql = "INSERT INTO items (" + sqlColumns.join() + ')'
				+ ' VALUES (';
			// Insert placeholders for bind parameters
			for (var i=0; i<sqlValues.length; i++){
				sql += '?,';
			}
			sql = sql.substring(0,sql.length-1) + ");\n";
			
			// Save basic data to items table and get new ID
			var itemID = Scholar.DB.query(sql,sqlValues);
			this._data['itemID'] = itemID;
			
			// Set itemData
			if (this._changedItemData.length){
				sql = '';
				for (fieldID in this._changedItemData.items){
					if (!this.getField(fieldID)){
						continue;
					}
					
					sql += 'INSERT INTO itemData VALUES (' +
						itemID + ',' + fieldID + ',';
						if (Scholar.ItemFields.isInteger(fieldID)){
							sql += this.getField(fieldID);
						}
						else {
							sql += "'" + this.getField(fieldID) + "'";
						}
						sql += ");\n";
				}
				
				if (sql){
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
	
	return isNew ? this.getID() : true;
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
	
	sql += 'DELETE FROM itemCreators WHERE itemID=' + this.getID() + ";\n";
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
	
	// TODO: trigger reloading of treeview
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
	this.erase = erase;
	this.unload = unload;
	
	/*
	 * Retrieves (and loads, if necessary) an arbitrary number of items
	 *
	 * Can be passed ids as individual parameters or as an array of ids, or both
	 *
	 * If only one argument and it's an id, return object directly;
	 * otherwise, return array indexed by itemID
	 */
	function get(){
		var toLoad = new Array();
		var loaded = new Array();
		
		if (!arguments[0]){
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
		if (arguments[0] && typeof arguments[0]!='Object'
				&& typeof arguments[1]=='undefined'){
			return _items[arguments[0]];
		}
		
		// Otherwise, build return array
		for (i=0; i<ids.length; i++){
			loaded[ids[i]] = _items[ids[i]];
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
	 * Reloads all currently cached items
	 */
	function reloadAll(){
		var ids = new Array();
		for (itemID in _items){
			ids.push(itemID);
		}
		_load(ids);
		return true;
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
	* Delete item from database and clear from internal array
	**/
	function erase(id){
		var obj = this.get(id);
		obj.erase(); // calls unload()
		obj = undefined;
		
		// TODO: trigger reload of treeview
	}
	
	
	/**
	* Clear item from internal array (used by Scholar.Item.erase())
	**/
	function unload(id){
		delete _items[id];
	}
	
	
	function _load(){
		if (!arguments){
			return false;
		}
		
		// Should be the same as query in Scholar.Item.loadFromID, just
		// without itemID clause
		var sql = 'SELECT I.*, lastName AS firstCreator '
			+ 'FROM items I '
			+ 'LEFT JOIN itemCreators IC ON (I.itemID=IC.itemID) '
			+ 'LEFT JOIN creators C ON (IC.creatorID=C.creatorID) '
			+ 'WHERE IC.orderIndex=0 OR IC.orderIndex IS NULL';
		
		if (arguments[0]!='all'){
			sql += ' AND I.itemID IN (' + Scholar.join(arguments,',') + ')';
		}
		
		var result = Scholar.DB.query(sql);
		
		if (result){
			for (var i=0,len=result.length; i<len; i++){
				var obj = new Scholar.Item();
				obj.loadFromRow(result[i]);
				_items[result[i]['itemID']] = obj;
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
	this._hasChildItems = true;
}

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
	}
}


Scholar.Collection.prototype.hasItem = function(itemID){
	if (!this._childItemsLoaded){
		this._loadChildItems();
	}
	return this._childItems.has(itemID);
}




/**
* Deletes a collection and all descendent collections and items
**/
Scholar.Collection.prototype.erase = function(deleteItems){
	Scholar.DB.beginTransaction();
	
	var descendents = this._getDescendents();
	var collections = new Array(this._id);
	
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
			}
		}
	}
	
	// Remove item associations for all descendent collections
	Scholar.DB.query('DELETE FROM itemCollections WHERE collectionID IN ('
		+ collections.join() + ')');
	
	// And delete all descendent collections
	Scholar.DB.query('DELETE FROM collection WHERE collectionID IN ('
		+ collections.join() + ')');
	
	// Clear deleted collection from internal memory
	Scholar.Collections.unload(collections);
	
	Scholar.DB.commitTransaction();
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
			
			for(var j=0, len=descendents.length; j<len; j++){
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
		
		var result = Scholar.DB.query(sql);
		
		if (!result){
			throw ('No collections exist');
		}
		
		for (var i=0; i<result.length; i++){
			var collection = new Scholar.Collection();
			collection.loadFromRow(result[i]);
			_collections[collection.getID()] = collection;
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
		
		var sql = 'INSERT INTO creators '
			+ 'VALUES (?,?,?)';
		
		// Use a random integer for the creatorID
		var tries = 10; // # of tries to find a unique id
		var max = 65535;
		do {
			// If no luck after 10 tries, try a larger range
			if (!tries){
				tries = 10;
				max = max * 10;
			}
			var rnd = Math.floor(Math.random()*max);
			var sql2 = 'SELECT COUNT(*) FROM creators WHERE creatorID=' + rnd;
			var exists = Scholar.DB.valueQuery(sql2);
			tries--;
		}
		while (exists);
		
		var params = [
			{'int': rnd}, {'string': firstName}, {'string': lastName}
		];
		
		Scholar.DB.query(sql, params);
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




Scholar.ItemTypes = new function(){
	this.getTypes = getTypes;
	this.getTypeName = getTypeName;
	
	function getTypes(){
		return Scholar.DB.query('SELECT itemTypeID AS id, typeName AS name '
			+ 'FROM itemTypes order BY typeName');
	}
	
	function getTypeName(itemTypeID){
		return Scholar.DB.valueQuery('SELECT typeName FROM itemTypes '
			+ 'WHERE itemTypeID=' + itemTypeID);
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
		return !!_fields[fieldID]['itemTypes'][itemTypeID];
	}
	
	
	function isInteger(fieldID){
		if (!_fields.length){
			_loadFields();
		}
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




Scholar.CreatorTypes = new function(){
	this.getTypes = getTypes;
	this.getTypeName = getTypeName;
	
	function getTypes(){
		return Scholar.DB.query('SELECT creatorTypeID AS id, '
			+ 'creatorType AS name FROM creatorTypes order BY creatorType');
	}
	
	function getTypeName(creatorTypeID){
		return Scholar.DB.valueQuery('SELECT creatorType FROM creatorTypes '
			+ 'WHERE creatorTypeID=' + creatorTypeID);
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
	
	for (var i=0, len=children.length; i<len; i++){
		var obj = Scholar.Items.get(children[i]);
		if (!obj){
			throw ('Item ' + children[i] + ' not found');
		}
		
		toReturn.push(obj);
	}
	
	return toReturn;
}
