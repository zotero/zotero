var Scholar_ItemTypeManager = new function(){
	this.init = init;
	this.handleTypeSelect = handleTypeSelect;
	this.addFieldToType = addFieldToType;
	this.removeFieldFromType = removeFieldFromType;
	this.handleShowHide = handleShowHide;
	this.moveSelectedFieldUp = moveSelectedFieldUp;
	this.moveSelectedFieldDown = moveSelectedFieldDown;
	this.handleAddType = handleAddType;
	this.handleAddField = handleAddField;
	this.removeField = removeField;
	this.removeType = removeType;
	
	var _typesList;
	var _fieldsList;
	
	
	function init(){
		// Populate the listbox with item types
		_typesList = document.getElementById('item-type-list');
		_typeFieldsList = document.getElementById('item-type-fields-list');
		_fieldsList = document.getElementById('fields-list');
		
		if (_typesList.selectedItem){
			var selectedType = _typesList.selectedItem.label;
		}
		else {
			var selectedType = false;
		}
			
		_typesList.selectedIndex = -1;
		
		var types = Scholar.ItemTypes.getTypes();
		
		while (_typesList.getRowCount()){
			_typesList.removeItemAt(0);
		}
		
		for (var i in types){
			_typesList.appendItem(types[i]['name'], types[i]['id']);
			if (_typesList.lastChild.label==selectedType){
				_typesList.lastChild.click();
			}
		}
		
		if (_typesList.selectedIndex==-1){
			_typesList.selectedIndex=0;
		}
		_typesList.selectedItem.parentNode.focus();
	}
	
	
	/**
	* Update the used and unused fields listboxes when an item type is selected
	**/
	function handleTypeSelect(){
		if (_typesList.selectedIndex==-1){
			return false;
		}
		
		var id = _typesList.selectedItem.value;
		_populateTypeFieldsList(id);
		_populateFieldsList(id);
	}
	
	
	/**
	* Add a field to an item type
	*
	* _item_ is a listitem in the _fieldsList listbox
	**/
	function addFieldToType(item){
		Scholar.debug('Adding field ' + item.value + ' to item type '
			+ _getCurrentTypeID());
		
		Scholar.DB.beginTransaction();
		
		// Get the next available position
		var sql = "SELECT IFNULL(MAX(orderIndex)+1,1) FROM itemTypeFields "
			+ "WHERE itemTypeID=?";
		var nextIndex = Scholar.DB.valueQuery(sql, [_getCurrentTypeID()]);
		
		var sql = "INSERT INTO itemTypeFields VALUES (?,?,?,?)";
		Scholar.DB.query(sql, [_getCurrentTypeID(), item.value, null, nextIndex]);
		
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
	function removeFieldFromType(item){
		Scholar.debug('Removing field ' + item.value + ' from item type '
			+ _getCurrentTypeID());
		
		_DBUnmapField(_getCurrentTypeID(), item.value);
		
		var pos = _typeFieldsList.getIndexOfItem(item);
		_typeFieldsList.removeItemAt(pos);
		_populateFieldsList(_getCurrentTypeID());
	}
	
	
	function handleShowHide(listbox, event){
		if (event.keyCode!=event.DOM_VK_RETURN && listbox.selectedIndex>-1){
			return true;
		}
		
		var typeID = _getCurrentTypeID();
		
		Scholar.DB.beginTransaction();
		
		var sql = "SELECT fieldID FROM fields WHERE fieldName=?";
		var fieldID = Scholar.DB.valueQuery(sql, [listbox.selectedItem.label]);
		
		var sql = "SELECT hide FROM itemTypeFields WHERE itemTypeID=? AND "
			+ "fieldID=?";
		var hidden = Scholar.DB.valueQuery(sql, [typeID, fieldID]);
		
		var sql = "UPDATE itemTypeFields SET hide=? WHERE itemTypeID=? AND "
			+ "fieldID=?";
		Scholar.DB.query(sql, [hidden ? null : 1, typeID, fieldID]);
		
		Scholar.DB.commitTransaction();
		
		listbox.selectedItem.setAttribute('isHidden', !hidden);
		
		_setStatus();
		return true;
	}
	
	
	function moveSelectedFieldUp(){
		if (_typeFieldsList.selectedItem){
			_moveFieldUp(_typeFieldsList.selectedItem);
			_setStatus();
		}
	}
	
	
	function moveSelectedFieldDown(){
		if (_typeFieldsList.selectedItem){
			_moveFieldDown(_typeFieldsList.selectedItem);
			_setStatus();
		}
	}
	
	
	function handleAddType(box, event){
		return _handleAddEvent(box, event, 'type');
	}
	
	function handleAddField(box, event){
		return _handleAddEvent(box, event, 'field');
	}
	
	
	function _handleAddEvent(box, event, target){
		if (target=='type'){
			var existsFunc = _typeExists;
			var idCol = 'itemTypeID';
			var nameCol = 'typeName';
			var table = 'itemTypes';
			var Target = 'Item type';
		}
		else if (target=='field'){
			var existsFunc = _fieldExists;
			var idCol = 'fieldID';
			var nameCol = 'fieldName';
			var table = 'fields';
			var Target = 'Field';
		}
		
		if (event.keyCode!=event.DOM_VK_RETURN || !box.value){
			return true;
		}
		
		var name = box.value;
		
		if (existsFunc(name)){
			_setStatus(Target + " '" + name + "' already exists");
			
			box.value = "";
			return true;
		}
		
		var nextID = Scholar.DB.getNextID(table, idCol);
		
		var sql = "INSERT INTO " + table + " (" + idCol + ", "
			+ nameCol + ") VALUES (?,?)";
		Scholar.DB.query(sql, [nextID, name]);
		
		init();
		
		box.value = "";
		_setStatus(Target + " '" + name + "' added");
		return true;
	}
	
	
	/*
	 * Remove an item type from the DB
	 *
	 * Takes a listitem containing the item type to delete
	 */
	function removeType(obj){
		var type = obj.label;
		
		if (!_typeExists(type)){
			_setStatus("Type '" + type + "' does not exist");
			return true;
		}
		
		Scholar.DB.beginTransaction();
		
		var sql = "SELECT itemTypeID FROM itemTypes WHERE typeName=?";
		var id = Scholar.DB.valueQuery(sql, [type]);
		
		var sql = "DELETE FROM itemTypeFields WHERE itemTypeID=?";
		Scholar.DB.query(sql, [id]);
		
		var sql = "DELETE FROM itemTypes WHERE itemTypeID=?";
		Scholar.DB.query(sql, [id]);
		
		Scholar.DB.commitTransaction();
		
		this.init();
		
		_setStatus("Item type '" + type + "' removed");
		return true;
	}
	
	
	/*
	 * Remove a field from the DB
	 *
	 * Takes a listitem containing the field to delete
	 */
	function removeField(obj){
		var field = obj.label;
		
		if (!_fieldExists(field)){
			Scholar.debug("Field '" + field + "' does not exist", 1);
			return true;
		}
		
		Scholar.DB.beginTransaction();
		
		var sql = "SELECT fieldID FROM fields WHERE fieldName=?";
		var id = Scholar.DB.valueQuery(sql, [field]);
		
		var sql = "SELECT itemTypeID FROM itemTypeFields WHERE fieldID=?";
		var types = Scholar.DB.columnQuery(sql, [id]);
		
		for (var i in types){
			_DBUnmapField(types[i], id);
		}
		
		var sql = "DELETE FROM fields WHERE fieldID=?";
		Scholar.DB.query(sql, [id]);
		
		Scholar.DB.commitTransaction();
		
		this.init();
		
		_setStatus("Field '" + field + "' removed");
		return true;
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
		var sql = 'SELECT fieldID, hide FROM itemTypeFields '
			+ 'WHERE itemTypeID=' + itemTypeID + ' ORDER BY orderIndex';
		var fields = Scholar.DB.query(sql);
		
		// Clear fields box
		while (_typeFieldsList.getRowCount()){
			_typeFieldsList.removeItemAt(0);
		}
		
		for (var i in fields){
			var item = _typeFieldsList.appendItem(_getFieldName(fields[i]['fieldID']), fields[i]['fieldID']);
			
			item.addEventListener('dblclick', new function(){
				return function(){
					Scholar_ItemTypeManager.removeFieldFromType(this);
				}
			}, true);
			
			item.setAttribute('isHidden', !!fields[i]['hide']);
		}
	}
	
	
	/**
	* Populate the listbox of fields NOT used by this item type
	**/
	function _populateFieldsList(itemTypeID){
		var sql = "SELECT fieldID, fieldName FROM fields ORDER BY fieldName COLLATE NOCASE";
		var fields = Scholar.DB.query(sql);
		
		// Clear fields box
		while (_fieldsList.getRowCount()){
			_fieldsList.removeItemAt(0);
		}
		
		// Add all fields to listbox
		for (var i in fields){
			var item = _fieldsList.appendItem(fields[i]['fieldName'], fields[i]['fieldID']);
			item.addEventListener('dblclick', new function(){
				return function(){
					Scholar_ItemTypeManager.addFieldToType(this);
				}
			}, true);
		}
		
		var sql = "SELECT fieldID FROM fields WHERE fieldID NOT IN "
			+ "(SELECT fieldID FROM itemTypeFields WHERE itemTypeID="
			+ itemTypeID + ")";
		var unusedFields = Scholar.DB.columnQuery(sql);
		
		// Remove fields that are already used
		for (var i=0; i<_fieldsList.getRowCount(); i++){
			// N.B. Some values at the end of list can only be accessed via getAttribute()
			// in BonEcho, though .value works for all in Minefield
			if (!Scholar.inArray(_fieldsList.getItemAtIndex(i).getAttribute('value'), unusedFields)){
				_fieldsList.removeItemAt(i);
				i--;
			}
		}
	}
	
	
	/*
	 * Unmap a field from an item type in the DB
	 */
	function _DBUnmapField(itemTypeID, fieldID){
		Scholar.DB.beginTransaction();
		
		// Get the old position
		var sql = "SELECT orderIndex FROM itemTypeFields WHERE itemTypeID=? "
			+ "AND fieldID=?";
		var orderIndex = Scholar.DB.valueQuery(sql, [itemTypeID, fieldID]);
		
		var sql = "DELETE FROM itemTypeFields WHERE itemTypeID=? AND fieldID=?";
		Scholar.DB.query(sql, [itemTypeID, fieldID]);
		
		// Shift other fields down
		var sql = "UPDATE itemTypeFields SET orderIndex=orderIndex-1 WHERE "
			+ "itemTypeID=? AND orderIndex>?";
		Scholar.DB.query(sql, [itemTypeID, orderIndex]);
		
		Scholar.DB.commitTransaction();
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
	
	
	function _typeExists(type){
		return !!Scholar.DB.valueQuery("SELECT COUNT(*) FROM itemTypes WHERE "
			+ "typeName=?", [type])
	}
	
	
	function _fieldExists(field){
		return !!Scholar.DB.valueQuery("SELECT COUNT(*) FROM fields WHERE "
			+ "fieldName=?", [field])
	}
	
	
	function _setStatus(str){
		str = str ? str : '';
		document.getElementById('status-line').value = str;
	}
}

window.addEventListener('load', Scholar_ItemTypeManager.init, true);
