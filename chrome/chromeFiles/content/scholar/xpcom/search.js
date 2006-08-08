Scholar.Search = function(){
	this._sql = null;
	this._sqlParams = null;
	this._maxSearchConditionID = 0;
	this._conditions = [];
	this._savedSearchID = null;
	this._savedSearchName = null;
}


/*
 * Set the name for the saved search
 *
 * Must be called before save() for new searches
 */
Scholar.Search.prototype.setName = function(name){
	if (!name){
		throw("Invalid saved search name '" + name + '"');
	}
	
	this._savedSearchName = name;
}


/*
 * Load a saved search from the DB
 */
Scholar.Search.prototype.load = function(savedSearchID){
	var sql = "SELECT savedSearchName, MAX(searchConditionID) AS maxID "
		+ "FROM savedSearches NATURAL JOIN savedSearchConditions "
		+ "WHERE savedSearchID=" + savedSearchID + " GROUP BY savedSearchID";
	var row = Scholar.DB.rowQuery(sql);
	
	if (!row){
		throw('Saved search ' + savedSearchID + ' does not exist');
	}
	
	this._sql = null;
	this._sqlParams = null;
	this._maxSearchConditionID = row['maxID'];
	this._conditions = [];
	this._savedSearchID = savedSearchID;
	this._savedSearchName = row['savedSearchName'];
	
	var conditions = Scholar.DB.query("SELECT * FROM savedSearchConditions "
		+ "WHERE savedSearchID=" + savedSearchID + " ORDER BY searchConditionID");
	
	for (var i in conditions){
		this._conditions[conditions[i]['searchConditionID']] = {
			condition: conditions[i]['condition'],
			operator: conditions[i]['operator'],
			value: conditions[i]['value']
		};
	}
}


/*
 * Save the search to the DB and return a savedSearchID
 *
 * For new searches, setName() must be called before saving
 */
Scholar.Search.prototype.save = function(){
	if (!this._savedSearchName){
		throw('Name not provided for saved search');
	}
	
	Scholar.DB.beginTransaction();
	
	if (this._savedSearchID){
		var sql = "UPDATE savedSearches SET savedSearchName=? WHERE savedSearchID=?";
		Scholar.DB.query(sql, [this._savedSearchName, this._savedSearchID]);
		
		Scholar.DB.query("DELETE FROM savedSearchConditions "
			+ "WHERE savedSearchID=" + this._savedSearchID);
	}
	else {
		this._savedSearchID
			= Scholar.getRandomID('savedSearches', 'savedSearchID');
		
		var sql = "INSERT INTO savedSearches (savedSearchID, savedSearchName) "
			+ "VALUES (?,?)";
		Scholar.DB.query(sql,
			[this._savedSearchID, {string: this._savedSearchName}]);
	}
	
	// TODO: use proper bound parameters once DB class is updated
	for (var i in this._conditions){
		var sql = "INSERT INTO savedSearchConditions (savedSearchID, "
			+ "searchConditionID, condition, operator, value) VALUES (?,?,?,?,?)";
		
		var sqlParams = [this._savedSearchID, i, this._conditions[i]['condition'],
			this._conditions[i]['operator']
				? this._conditions[i]['operator'] : null,
			this._conditions[i]['value']
				? this._conditions[i]['value'] : null];
		Scholar.DB.query(sql, sqlParams);
	}
	
	Scholar.DB.commitTransaction();
	
	return this._savedSearchID;
}


Scholar.Search.prototype.addCondition = function(condition, operator, value){
	if (!Scholar.SearchConditions.hasOperator(condition, operator)){
		throw ("Invalid operator '" + operator + "' for condition " + condition);
	}
	
	var searchConditionID = this._maxSearchConditionID++;
	
	this._conditions[searchConditionID] = {
		condition: condition,
		operator: operator,
		value: value
	};
	
	this._sql = null;
	this._sqlParams = null;
	return searchConditionID;
}


Scholar.Search.prototype.updateCondition = function(searchConditionID, condition, operator, value){
	if (typeof this._conditions[searchConditionID] == 'undefined'){
		throw ('Invalid searchConditionID ' + searchConditionID + ' in updateCondition()');
	}
	
	if (!Scholar.SearchConditions.hasOperator(condition, operator)){
		throw ("Invalid operator '" + operator + "' for condition " + condition);
	}
	
	this._conditions[searchConditionID] = {
		condition: condition,
		operator: operator,
		value: value
	};
	
	this._sql = null;
	this._sqlParams = null;
}


Scholar.Search.prototype.removeCondition = function(searchConditionID){
	if (typeof this._conditions[searchConditionID] == 'undefined'){
		throw ('Invalid searchConditionID ' + searchConditionID + ' in removeCondition()');
	}
	
	delete this._conditions[searchConditionID];
	
	var i = searchConditionID + 1;
	while (typeof this._conditions[i] != 'undefined'){
		this._conditions[i-1] = this._conditions[i];
		delete this._conditions[i];
		i++;
	}
	
	this._maxSearchConditionID--;
}


/*
 * Returns an array with 'condition', 'operator', and 'value'
 * for the given searchConditionID
 */
Scholar.Search.prototype.getSearchCondition = function(searchConditionID){
	return this._conditions[searchConditionID];
}


/*
 * Returns a multidimensional array of conditions/operator/value sets
 * used in the search, indexed by searchConditionID
 */
Scholar.Search.prototype.getSearchConditions = function(){
	// TODO: make copy
	return this._conditions;
}


/*
 * Run the search and return an array of item ids for results
 */
Scholar.Search.prototype.search = function(){
	if (!this._sql){
		this._buildQuery();
	}
	
	return Scholar.DB.columnQuery(this._sql, this._sqlParams);
}


/*
 * Get the SQL string for the search
 */
Scholar.Search.prototype.getSQL = function(){
	if (!this._sql){
		this._buildQuery();
	}
	
	return this._sql;
}


/*
 * Build the SQL query for the search
 */
Scholar.Search.prototype._buildQuery = function(){
	var sql = 'SELECT itemID FROM items';
	var sqlParams = [];
	
	var tables = [];
	
	for (var i in this._conditions){
		var data = Scholar.SearchConditions.get(this._conditions[i]['condition']);
		
		// Group standard conditions by table
		if (data['table']){
			if (!tables[data['table']]){
				tables[data['table']] = [];
			}
			
			tables[data['table']].push({
				name: data['name'],
				alias: data['name']!=this._conditions[i]['condition']
					? this._conditions[i]['condition'] : false,
				field: data['field'],
				operator: this._conditions[i]['operator'],
				value: this._conditions[i]['value']
			});
			
			var hasConditions = true;
		}
		
		// Handle special conditions
		else {
			switch (data['name']){
				// Collection to search in
				case 'context':
					var parentCollectionID = this._conditions[i]['value'];
					continue;
					
				// Search subfolders
				case 'recursive':
					var recursive = this._conditions[i]['operator']=='true';
					continue;
					
				// Join mode ('any' or 'all')
				case 'joinMode':
					var joinMode = this._conditions[i]['operator'].toUpperCase();
					continue;
			}
			
			throw ('Unhandled special condition ' + this._conditions[i]['condition']);
		}
	}
	
	if (hasConditions){
		sql += " WHERE ";
		
		// Join conditions using appropriate operator
		if (joinMode=='ALL'){
			var binOp = ' AND ';
		}
		else {
			var binOp = ' OR ';
		}
		
		for (i in tables){
			for (var j in tables[i]){
				// Special table handling
				switch (i){
					case 'items':
						break;
					default:
						sql += 'itemID IN (SELECT itemID FROM ' + i + ' WHERE (';
						var openParens = 2;
				}
				
				// For itemData fields, include fieldID
				if (tables[i][j]['name']=='field'){
					sql += 'fieldID=? AND ';
					sqlParams.push(Scholar.ItemFields.getID(tables[i][j]['alias']));
				}
				
				sql += tables[i][j]['field'];
				switch (tables[i][j]['operator']){
					case 'contains':
						sql += ' LIKE ?';
						sqlParams.push('%' + tables[i][j]['value'] + '%');
						break;
						
					case 'doesNotContain':
						sql += ' NOT LIKE ?';
						sqlParams.push('%' + tables[i][j]['value'] + '%');
						break;
						
					case 'is':
						sql += '=?';
						sqlParams.push(tables[i][j]['value']);
						break;
						
					case 'isNot':
						sql += '!=?';
						sqlParams.push(tables[i][j]['value']);
						break;
						
					case 'greaterThan':
						sql += '>?';
						sqlParams.push({int:tables[i][j]['value']});
						break;
						
					case 'lessThan':
						sql += '<?';
						sqlParams.push({int:tables[i][j]['value']});
						break;
					
					case 'isBefore':
						// TODO
						break;
					
					case 'isAfter':
						// TODO
						break;
				}
				
				// Close open parentheses
				for (k=openParens; k>0; k--){
					sql += ')';
				}
				
				sql += binOp;
			}
		}
		
		sql = sql.substring(0, sql.length-binOp.length);
	}
	
	if (parentCollectionID){
		sql = "SELECT itemID FROM (" + sql + ") WHERE itemID IN "
			+ "(SELECT itemID FROM collectionItems WHERE collectionID IN ("
		
		sql += "?,";
		sqlParams.push({int:parentCollectionID});
		
		if (recursive){
			var col = Scholar.Collections.get(parentCollectionID);
			var descendents = col.getDescendents(false, 'collection');
			if (descendents){
				for (var i in descendents){
					sql += '?,';
					sqlParams.push(descendents[i]['id']);
				}
			}
		}
		
		// Strip final comma
		sql = sql.substring(0, sql.length-1) + "))";
	}
	
	this._sql = sql;
	this._sqlParams = sqlParams.length ? sqlParams : null;
}


Scholar.Searches = new function(){
	this.getAll = getAll;
	this.erase = erase;
	
	/*
	 * Returns an array of saved searches with 'id' and 'name', ordered by name
	 */
	function getAll(){
		var sql = "SELECT savedSearchID AS id, savedSearchName AS name "
			+ "FROM savedSearches ORDER BY name";
		return Scholar.DB.query(sql);
	}
	
	
	/*
	 * Delete a given saved search from the DB
	 */
	function erase(savedSearchID){
		Scholar.DB.beginTransaction();
		var sql = "DELETE FROM savedSearchConditions WHERE savedSearchID="
			+ savedSearchID;
		Scholar.DB.query(sql);
		
		var sql = "DELETE FROM savedSearches WHERE savedSearchID="
			+ savedSearchID;
		Scholar.DB.query(sql);
		Scholar.DB.commitTransaction();
	}
}


Scholar.SearchConditions = new function(){
	this.get = get;
	this.getStandardConditions = getStandardConditions;
	this.hasOperator = hasOperator;
	
	var _initialized = false;
	var _conditions = [];
	var _standardConditions = [];
	
	/*
	 * Define the advanced search operators
	 */
	var _operators = {
		// Standard
		is: true,
		isNot: true,
		contains: true,
		doesNotContain: true,
		lessThan: true,
		greaterThan: true,
		isBefore: true,
		isAfter: true,
		
		// Special
		any: true,
		all: true,
		true: true,
		false: true
	};
	
	
	/*
	 * Define and set up the available advanced search conditions
	 */
	function _init(){
		_conditions = [
			//
			// Special conditions
			//
			
			// Context (i.e. collection id to search within)
			{
				name: 'context'
			},
			
			// Search recursively
			{
				name: 'recursive',
				operators: {
					true: true,
					false: true
				}
			},
			
			// Join mode
			{
				name: 'joinMode',
				operators: {
					any: true,
					all: true
				}
			},
			
			//
			// Standard conditions
			//
			
			{
				name: 'title',
				operators: {
					contains: true,
					doesNotContain: true
				},
				table: 'items',
				field: 'title'
			},
			
			{
				name: 'itemType',
				operators: {
					is: true,
					isNot: true
				},
				table: 'items',
				field: 'itemTypeID'
			},
			
			{
				name: 'field',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				table: 'itemData',
				field: 'value',
				aliases: Scholar.DB.columnQuery("SELECT fieldName FROM fields"),
				template: true // mark for special handling
			}
		];
		
		// Index conditions by name and aliases
		for (var i in _conditions){
			_conditions[_conditions[i]['name']] = _conditions[i];
			if (_conditions[i]['aliases']){
				for (var j in _conditions[i]['aliases']){
					_conditions[_conditions[i]['aliases'][j]] = _conditions[i];
				}
			}
			_conditions[_conditions[i]['name']] = _conditions[i];
			delete _conditions[i];
		}
		
		// Separate standard conditions for menu display
		for (var i in _conditions){
			// Standard conditions a have associated tables
			if (_conditions[i]['table'] &&
				// If a template condition, not the original (e.g. 'field')
				(!_conditions[i]['template'] || i!=_conditions[i]['name'])){
				_standardConditions.push({
					name: i,
					operators: _conditions[i]['operators']
				});
			}
		}
		
		_initialized = true;
	}
	
	
	/*
	 * Get condition data
	 */
	function get(condition){
		if (!_initialized){
			_init();
		}
		
		return _conditions[condition];
	}
	
	
	/*
	 * Returns array of possible conditions
	 *
	 * Does not include special conditions, only ones that would show in a drop-down list
	 */
	function getStandardConditions(){
		if (!_initialized){
			_init();
		}
		
		// TODO: return copy instead
		return _standardConditions;
	}
	
	
	/*
	 * Check if an operator is valid for a given condition
	 */
	function hasOperator(condition, operator){
		if (!_initialized){
			_init();
		}
		
		if (!_conditions[condition]){
			throw ("Invalid condition '" + condition + "' in hasOperator()");
		}
		
		if (!operator && typeof _conditions[condition]['operators'] == 'undefined'){
			return true;
		}
		
		return !!_conditions[condition]['operators'][operator];
	}
}
