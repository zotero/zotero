var Scholar_ItemTypeManager = new function(){
	this.init = init;
	this.handleTypeSelect = handleTypeSelect;
	this.addField = addField;
	this.removeField = removeField;
	this.moveSelectedFieldUp = moveSelectedFieldUp;
	this.moveSelectedFieldDown = moveSelectedFieldDown;
	
	var _typesList;
	var _fieldsList;
	
	
	function init(){
		// Populate the listbox with item types
		_typesList = document.getElementById('item-type-list');
		_typeFieldsList = document.getElementById('item-type-fields-list');
		_fieldsList = document.getElementById('fields-list');
		
		var types = Scholar.ItemTypes.getTypes();
		
		for (var i in types){
			_typesList.appendItem(types[i]['name'], types[i]['id']);
		}
	}
	
	
	/**
	* Update the used and unused fields listboxes when an item type is selected
	**/
	function handleTypeSelect(){
		var id = _typesList.selectedItem.value;
		_populateTypeFieldsList(id);
		_populateFieldsList(id);
	}
	
	
	/**
	* Add a field to an item type
	*
	* _item_ is a listitem in the _fieldsList listbox
	**/
	function addField(item){
		Scholar.debug('Adding field ' + item.value + ' to item type '
			+ _getCurrentTypeID());
		
		Scholar.DB.beginTransaction();
		
		// Get the next available position
		var sql = "SELECT IFNULL(MAX(orderIndex)+1,1) FROM itemTypeFields "
			+ "WHERE itemTypeID=?";
		var nextIndex = Scholar.DB.valueQuery(sql, [_getCurrentTypeID()]);
		
		var sql = "INSERT INTO itemTypeFields VALUES (?,?,?)";
		Scholar.DB.query(sql, [_getCurrentTypeID(), item.value, nextIndex]);
		
		Scholar.DB.commitTransaction();
		
		var pos = _fieldsList.getIndexOfItem(item);
		_fieldsList.removeItemAt(pos);
		_populateTypeFieldsList(_getCurrentTypeID());
	}
	
	
	/**
	* Remove a field from an item type
	*
	* _item_ is a listitem in the _typeFieldsList listbox
	**/
	function removeField(item){
		Scholar.debug('Removing field ' + item.value + ' from item type '
			+ _getCurrentTypeID());
		
		Scholar.DB.beginTransaction();
		
		// Get the old position
		var sql = "SELECT orderIndex FROM itemTypeFields WHERE itemTypeID=? "
			+ "AND fieldID=?";
		var orderIndex = Scholar.DB.valueQuery(sql, [_getCurrentTypeID(), item.value]);
		
		var sql = "DELETE FROM itemTypeFields WHERE itemTypeID=? AND fieldID=?";
		Scholar.DB.query(sql, [_getCurrentTypeID(), item.value]);
		
		// Shift other fields down
		var sql = "UPDATE itemTypeFields SET orderIndex=orderIndex-1 WHERE "
			+ "itemTypeID=? AND orderIndex>?";
		Scholar.DB.query(sql, [_getCurrentTypeID(), orderIndex]);
		
		Scholar.DB.commitTransaction();
		
		var pos = _typeFieldsList.getIndexOfItem(item);
		_typeFieldsList.removeItemAt(pos);
		_populateFieldsList(_getCurrentTypeID());
	}
	
	
	function moveSelectedFieldUp(){
		if (_typeFieldsList.selectedItem){
			_moveFieldUp(_typeFieldsList.selectedItem);
		}
	}
	
	
	function moveSelectedFieldDown(){
		if (_typeFieldsList.selectedItem){
			_moveFieldDown(_typeFieldsList.selectedItem);
		}
	}
	
	
	
	/**
	* Return the currently selected item type
	**/
	function _getCurrentTypeID(){
		return _typesList.selectedItem.value;
	}
	
	
	/**
	* Return the field name for a given fieldID
	**/
	function _getFieldName(fieldID){
		return Scholar.DB.valueQuery("SELECT fieldName FROM fields "
			+ "WHERE fieldID=" + fieldID);
	}
	
	
	/**
	* Populate the listbox of fields used by this item type
	**/
	function _populateTypeFieldsList(itemTypeID){
		var sql = 'SELECT fieldID FROM itemTypeFields '
			+ 'WHERE itemTypeID=' + itemTypeID + ' ORDER BY orderIndex';
		var fields = Scholar.DB.columnQuery(sql);
		
		// Clear fields box
		while (_typeFieldsList.getRowCount()){
			_typeFieldsList.removeItemAt(0);
		}
		
		for (var i in fields){
			var item = _typeFieldsList.appendItem(_getFieldName(fields[i]), fields[i]);
			item.addEventListener('dblclick', new function(){
				return function(){
					Scholar_ItemTypeManager.removeField(this);
				}
			}, true);
		}
	}
	
	
	/**
	* Populate the listbox of fields NOT used by this item type
	**/
	function _populateFieldsList(itemTypeID){
		var sql = "SELECT fieldID FROM fields ORDER BY fieldName COLLATE NOCASE";
		var fields = Scholar.DB.columnQuery(sql);
		
		// Clear fields box
		while (_fieldsList.getRowCount()){
			_fieldsList.removeItemAt(0);
		}
		
		// Add all fields to listbox
		for (var i in fields){
			var item = _fieldsList.appendItem(_getFieldName(fields[i]), fields[i]);
			item.addEventListener('dblclick', new function(){
				return function(){
					Scholar_ItemTypeManager.addField(this);
				}
			}, true);
		}
		
		var sql = "SELECT fieldID FROM fields WHERE fieldID NOT IN "
			+ "(SELECT fieldID FROM itemTypeFields WHERE itemTypeID="
			+ itemTypeID + ")";
		var unusedFields = Scholar.DB.columnQuery(sql);
		
		// Remove fields that are already used
		for (var i=0; i<_fieldsList.getRowCount(); i++){
			if (!Scholar.inArray(_fieldsList.getItemAtIndex(i).value, unusedFields)){
				_fieldsList.removeItemAt(i);
				i--;
			}
		}
	}
	
	
	function _moveFieldUp(item){
		if (!_typeFieldsList.getPreviousItem(item, 1)){
			return false;
		}
		
		Scholar.DB.beginTransaction();
		
		var sql = "SELECT orderIndex FROM itemTypeFields WHERE itemTypeID=? "
			+ "AND fieldID=?";
		var orderIndex = Scholar.DB.valueQuery(sql, [_getCurrentTypeID(), item.value]);
		
		// Move down field above
		var sql = "UPDATE itemTypeFields SET orderIndex=orderIndex+1 WHERE "
			+ "itemTypeID=? AND orderIndex=?";
		Scholar.DB.query(sql, [_getCurrentTypeID(), orderIndex-1]);
		
		// Move field up
		var sql = "UPDATE itemTypeFields SET orderIndex=orderIndex-1 WHERE "
			 + "itemTypeID=? AND fieldID=?";
		 Scholar.DB.query(sql, [_getCurrentTypeID(), item.value]);
		
		 var index = _typeFieldsList.getIndexOfItem(item);
		 _typeFieldsList.removeItemAt(index);
		 var newItem = _typeFieldsList.insertItemAt(index-1, item.label, item.value);
		 _typeFieldsList.selectItem(newItem);
		 
		Scholar.DB.commitTransaction();
	}
	
	
	function _moveFieldDown(item){
		if (!_typeFieldsList.getNextItem(item, 1)){
			return false;
		}
		
		Scholar.DB.beginTransaction();
		
		var sql = "SELECT orderIndex FROM itemTypeFields WHERE itemTypeID=? "
			+ "AND fieldID=?";
		var orderIndex = Scholar.DB.valueQuery(sql, [_getCurrentTypeID(), item.value]);
		
		// Move up field below
		var sql = "UPDATE itemTypeFields SET orderIndex=orderIndex-1 WHERE "
			+ "itemTypeID=? AND orderIndex=?";
		Scholar.DB.query(sql, [_getCurrentTypeID(), orderIndex+1]);
		
		// Move field down
		var sql = "UPDATE itemTypeFields SET orderIndex=orderIndex+1 WHERE "
			+ "itemTypeID=? AND fieldID=?";
		Scholar.DB.query(sql, [_getCurrentTypeID(), item.value]);
		 
		 
		var index = _typeFieldsList.getIndexOfItem(item);
		_typeFieldsList.removeItemAt(index);
		if (_typeFieldsList.getRowCount()==index+1){
			var newItem = _typeFieldsList.appendItem(item.label, item.value);
		}
		else {
			var newItem = _typeFieldsList.insertItemAt(index+1, item.label, item.value);
		}
		_typeFieldsList.selectItem(newItem);
		
		Scholar.DB.commitTransaction();
	}
}

window.addEventListener('load', Scholar_ItemTypeManager.init, true);
