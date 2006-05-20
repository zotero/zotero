/*
 * Constructor for Item object
 *
 * Generally should be called through Scholar.Items rather than directly
 */
Scholar.Item = function(){
	this._init();
	
	// Accept itemTypeID, folderID and orderIndex in constructor
	if (arguments.length){
		this.setType(arguments[0]);
		if (arguments.length>1){
			this.setPosition(arguments[1], arguments[2] ? arguments[2] : false);
		}
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
	if (!Scholar.Item.primaryFields){
		Scholar.Item.primaryFields = Scholar.DB.getColumnHash('items');
		Scholar.Item.primaryFields['firstCreator'] = true;
		Scholar.Item.primaryFields['parentFolderID'] = true;
		Scholar.Item.primaryFields['orderIndex'] = true;
	}
	
	return !!Scholar.Item.primaryFields[field];
}

Scholar.Item.editableFields = {
	title: true,
	source: true,
	rights: true
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
	var sql = 'SELECT I.*, lastName AS firstCreator, TS.parentFolderID, '
		+ 'TS.orderIndex '
		+ 'FROM items I '
		+ 'LEFT JOIN treeStructure TS ON (I.itemID=TS.id AND isFolder=0) '
		+ 'LEFT JOIN itemCreators IC ON (I.itemID=IC.itemID) '
		+ 'LEFT JOIN creators C ON (IC.creatorID=C.creatorID) '
		+ 'WHERE itemID=' + id
		+ ' AND (IC.orderIndex=0 OR IC.orderIndex IS NULL)';
	var row = Scholar.DB.rowQuery(sql);
	this.loadFromRow(row);
}


/*
 * Populate basic item data from a database row
 */
Scholar.Item.prototype.loadFromRow = function(row){
	this._init();
	for (col in row){
		if (this.isPrimaryField(col) || col=='firstCreator'){
			this._data[col] = row[col];
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


Scholar.Item.prototype.getParent = function(){
	return this._data['parentFolderID'] ? this._data['parentFolderID'] : false;
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
 * Move item to new position and shift surrounding items
 *
 * N.B. Unless isNew is set or the item doesn't yet have an id,
 * this function updates the DB immediately and
 * reloads all cached items -- a save() is not required
 *
 * If isNew is true, a transaction is not started or committed, so if
 * the item has an id it should only be run from an existing transaction
 * within Scholar.Item.save()
 */
Scholar.Item.prototype.setPosition = function(newFolder, newPos, isNew){
	var oldFolder = this.getField('parentFolderID');
	var oldPos = this.getField('orderIndex');
	
	if (this.getID()){
		if (!isNew && newFolder==oldFolder && newPos==oldPos){
			return true;
		}
		
		if (!isNew){
			Scholar.DB.beginTransaction();
		}
		
		if (!newFolder){
			newFolder = 0;
		}
		// Do a foreign key check manually
		else if (!parseInt(Scholar.DB.valueQuery('SELECT COUNT(*) FROM folders '
				+ 'WHERE folderID=' + newFolder))){
			throw('Attempt to add item to invalid folder');
		}
		
		// If no position provided, drop at end of folder
		if (!newPos){
			newPos = Scholar.DB.valueQuery('SELECT MAX(orderIndex)+1 FROM ' +
				'treeStructure WHERE parentFolderID=' + newFolder);
		}
		// Otherwise shift down above it in old folder and shift up at it or
		// above it in new folder
		else {
			sql = 'UPDATE treeStructure SET orderIndex=orderIndex-1 ' +
				'WHERE parentFolderID=' + oldFolder +
				' AND orderIndex>' + oldPos + ";\n";
		
			sql += 'UPDATE treeStructure SET orderIndex=orderIndex+1 ' +
				'WHERE parentFolderID=' + newFolder +
				' AND orderIndex>=' + newPos + ";\n";
				
			Scholar.DB.query(sql);
		}
		
		// If a new item, insert
		if (isNew){
			var sql = 'INSERT INTO treeStructure '
				+ '(id, isFolder, orderIndex, parentFolderID) VALUES ('
				+ this.getID() + ', 0, ' + newPos + ', ' + newFolder + ')';
		}
		// Otherwise update
		else {
			var sql = 'UPDATE treeStructure SET parentFolderID=' + newFolder +
				', orderIndex=' + newPos + ' WHERE id=' + this.getID() +
				" AND isFolder=0;\n";
		}
		Scholar.DB.query(sql);
		
		if (!isNew){
			Scholar.DB.commitTransaction();
		}
	}
	
	this._data['parentFolderID'] = newFolder;
	this._data['orderIndex'] = newPos;
	
	if (this.getID() && !isNew){
		Scholar.Items.reloadAll();
		Scholar.Folders.reloadAll(); // needed to recheck isEmpty
	}
	return true;
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
			if (this._changed.has('source')){
				sql += "source='" +  this.getField('source') + "', ";
			}
			if (this._changed.has('rights')){
				sql += "rights='" +  this.getField('rights') + "', ";
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
						sql += 'UPDATE itemCreators SET creatorID='
							+ creatorID + ', creatorTypeID='
							+ creator['creatorTypeID'] + ', '
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
		if (this._changed.has('source')){
			sqlColumns.push('source');
			sqlValues.push({'string':this.getField('source')});
		}
		if (this._changed.has('rights')){
			sqlColumns.push('rights');
			sqlValues.push({'string':this.getField('rights')});
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
			
			// Set the position of the new item
			var newFolder = this.getField('parentFolderID')
				? this.getField('parentFolderID') : 0;
			
			var newPos = this.getField('orderIndex')
				? this.getField('orderIndex') : false;
			
			this.setPosition(newFolder, newPos, true);
			
			Scholar.DB.commitTransaction();
			
			// Reload folders to update isEmpty,
			// in case this was the first item in a folder
			Scholar.Folders.reloadAll();
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
	
	
	var parentFolderID = this.getField('parentFolderID');
	var orderIndex = this.getField('orderIndex');
	
	var sql = 'DELETE FROM treeStructure WHERE id=' + this.getID() + ";\n";
	
	sql += 'UPDATE treeStructure SET orderIndex=orderIndex-1 ' +
		'WHERE parentFolderID=' + parentFolderID +
		' AND orderIndex>' + orderIndex + ";\n\n";
	
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


Scholar.Item.prototype.isFolder = function(){
	return false;
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
	this.getTreeRows = getTreeRows;
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
		var sql = 'SELECT I.itemID FROM items I '
			+ 'LEFT JOIN treeStructure TS ON (I.itemID=TS.id AND isFolder=0) '
			+ 'ORDER BY orderIndex';
		
		var ids = Scholar.DB.columnQuery(sql);
		return this.get(ids);
	}
	
	
	/*
	 * Returns an array of all folders and items that are children of a folder
	 * as Scholar.Folder and Scholar.Item instances
	 *
	 * Takes parent folderID as optional parameter; by default, returns root items
	 *
	 * Type can tested with instanceof (e.g. if (obj instanceof Scholar.Folder)) or isFolder()
	 */
	function getTreeRows(parent){
		var toReturn = new Array();
		
		/*
		// To return all items (no longer used)
		var sql = 'SELECT * FROM treeStructure WHERE id>0 ORDER BY orderIndex';
		*/
		
		if (!parent){
			parent = 0;
		}
		
		var sql = 'SELECT * FROM treeStructure TS '
			+ 'WHERE parentFolderID=' + parent + ' ORDER BY orderIndex';
		
		var tree = Scholar.DB.query(sql);
		
		if (!tree){
			Scholar.debug('No children of folder ' + parent, 5);
			return toReturn;
		}
		
		_load('all');
		
		for (var i=0, len=tree.length; i<len; i++){
			if (parseInt(tree[i]['isFolder'])){
				var obj = Scholar.Folders.get(tree[i]['id']);
				if (!obj){
					throw ('Folder ' + tree[i]['id'] + ' not found');
				}
			}
			else {
				var obj = Scholar.Items.get(tree[i]['id']);
				if (!obj){
					throw ('Item ' + tree[i]['id'] + ' not found');
				}
			}
			
			toReturn.push(obj);
		}
		
		return toReturn;
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
	
	
	function getNewItemByType(itemTypeID, parentFolderID, orderIndex){
		return new Scholar.Item(itemTypeID, parentFolderID, orderIndex);
	}
	
	
	function add(data, itemTypeID, folderID, orderIndex){
		var insert = new Array();
		
		var obj = new Scholar.Item(itemTypeID, folderID, orderIndex);
		
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
		var sql = 'SELECT I.*, lastName AS firstCreator, TS.parentFolderID, '
			+ 'TS.orderIndex '
			+ 'FROM items I '
			+ 'LEFT JOIN treeStructure TS ON (I.itemID=TS.id AND isFolder=0) '
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
 * Constructor for Folder object
 *
 * Generally should be called from Scholar.Folders rather than directly
 */
Scholar.Folder = function(){
	this._id;
	this._name;
	this._parent;
}


/*
 * Build folder from database
 */
Scholar.Folder.prototype.loadFromID = function(id){
	// Should be same as query in Scholar.Folders, just with folderID
	var sql = "SELECT folderID, folderName, parentFolderID, "
		+ "(SELECT COUNT(*) FROM treeStructure WHERE parentFolderID=" +
		id + ")=0 AS isEmpty FROM folders F "
		+ "JOIN treeStructure TS ON (F.folderID=TS.id AND TS.isFolder=1) "
		+ "WHERE folderID=" + id;
	
	var row = Scholar.DB.rowQuery(sql);
	this.loadFromRow(row);
}


/*
 * Populate folder data from a database row
 */
Scholar.Folder.prototype.loadFromRow = function(row){
	this._id = row['folderID'];
	this._name = row['folderName'];
	this._parent = row['parentFolderID'];
	this._empty = row['isEmpty'];
}

Scholar.Folder.prototype.getID = function(){
	return this._id;
}

Scholar.Folder.prototype.getName = function(){
	return this._name;
}

Scholar.Folder.prototype.isFolder = function(){
	return true;
}

Scholar.Folder.prototype.getParent = function(){
	return this._parent;
}

Scholar.Folder.prototype.isEmpty = function(){
	return !!parseInt(this._empty);
}


/*
 * Primary interface for accessing Scholar folders
 */
Scholar.Folders = new function(){
	var _folders = new Array();
	var _foldersLoaded = false;
	
	this.get = get;
	this.reloadAll = reloadAll;
	
	/*
	 * Returns a Scholar.Folder object for a folderID
	 */
	function get(id){
		if (!_foldersLoaded){
			_load();
		}
		return (typeof _folders[id]!='undefined') ? _folders[id] : false;
	}
	
	
	function reloadAll(){
		_folders = new Array();
		_load();
	}
	
	function _load(){
		var sql = "SELECT folderID, folderName, parentFolderID, "
			+ "(SELECT COUNT(*) FROM treeStructure WHERE "
			+ "parentFolderID=TS.id)=0 AS isEmpty FROM folders F "
			+ "JOIN treeStructure TS ON (F.folderID=TS.id AND TS.isFolder=1) "
			+ "WHERE folderID>0"; // skip 'root' folder
		var result = Scholar.DB.query(sql);
		
		if (!result){
			throw ('No folders exist');
		}
		
		for (var i=0; i<result.length; i++){
			var folder = new Scholar.Folder();
			folder.loadFromRow(result[i]);
			_folders[folder.getID()] = folder;
		}
		_foldersLoaded = true;
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
var items = Scholar.Items.getAll();

var obj = items[9];
for (var i=0,len=obj.numCreators(); i<len; i++){
	Scholar.debug(Scholar.varDump(obj.getCreator(i)));
}

obj.setCreator(2,'bob','smith');

for (var i=0,len=obj.numCreators(); i<len; i++){
	Scholar.debug(Scholar.varDump(obj.getCreator(i)));
}
obj.save();
*/
