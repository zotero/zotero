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

Zotero.Search = function(){
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
Zotero.Search.prototype.setName = function(name){
	if (!name){
		throw("Invalid saved search name '" + name + '"');
	}
	
	this._savedSearchName = name;
}


/*
 * Load a saved search from the DB
 */
Zotero.Search.prototype.load = function(savedSearchID){
	var sql = "SELECT savedSearchName, MAX(searchConditionID) AS maxID "
		+ "FROM savedSearches LEFT JOIN savedSearchConditions "
		+ "USING (savedSearchID) WHERE savedSearchID=" + savedSearchID
		+ " GROUP BY savedSearchID";
	var row = Zotero.DB.rowQuery(sql);
	
	if (!row){
		throw('Saved search ' + savedSearchID + ' does not exist');
	}
	
	this._sql = null;
	this._sqlParams = null;
	this._maxSearchConditionID = row['maxID'];
	this._conditions = [];
	this._savedSearchID = savedSearchID;
	this._savedSearchName = row['savedSearchName'];
	
	var conditions = Zotero.DB.query("SELECT * FROM savedSearchConditions "
		+ "WHERE savedSearchID=" + savedSearchID + " ORDER BY searchConditionID");
	
	for (var i in conditions){
		// Parse "condition[/mode]"
		var [condition, mode] =
			Zotero.SearchConditions.parseCondition(conditions[i]['condition']);
		
		if (!Zotero.SearchConditions.get(condition)){
			Zotero.debug("Invalid saved search condition '"
				+ condition + "' -- skipping", 2);
			continue;
		}
		
		this._conditions[conditions[i]['searchConditionID']] = {
			id: conditions[i]['searchConditionID'],
			condition: condition,
			mode: mode,
			operator: conditions[i]['operator'],
			value: conditions[i]['value'],
			required: conditions[i]['required']
		};
	}
}


Zotero.Search.prototype.getID = function(){
	return this._savedSearchID;
}


Zotero.Search.prototype.getName = function(){
	return this._savedSearchName;
}


/*
 * Save the search to the DB and return a savedSearchID
 *
 * For new searches, setName() must be called before saving
 */
Zotero.Search.prototype.save = function(){
	if (!this._savedSearchName){
		throw('Name not provided for saved search');
	}
	
	Zotero.DB.beginTransaction();
	
	if (this._savedSearchID){
		var sql = "UPDATE savedSearches SET savedSearchName=? WHERE savedSearchID=?";
		Zotero.DB.query(sql, [this._savedSearchName, this._savedSearchID]);
		
		Zotero.DB.query("DELETE FROM savedSearchConditions "
			+ "WHERE savedSearchID=" + this._savedSearchID);
	}
	else {
		var isNew = true;
		
		this._savedSearchID
			= Zotero.getRandomID('savedSearches', 'savedSearchID');
		
		var sql = "INSERT INTO savedSearches (savedSearchID, savedSearchName) "
			+ "VALUES (?,?)";
		Zotero.DB.query(sql,
			[this._savedSearchID, {string: this._savedSearchName}]);
	}
	
	// TODO: use proper bound parameters once DB class is updated
	for (var i in this._conditions){
		var sql = "INSERT INTO savedSearchConditions (savedSearchID, "
			+ "searchConditionID, condition, operator, value, required) "
			+ "VALUES (?,?,?,?,?,?)";
		
		// Convert condition and mode to "condition[/mode]"
		var condition = this._conditions[i]['mode'] ?
			this._conditions[i]['condition'] + '/' + this._conditions[i]['mode'] :
			this._conditions[i]['condition']
		
		var sqlParams = [
			this._savedSearchID, i, condition,
			this._conditions[i]['operator']
				? this._conditions[i]['operator'] : null,
			this._conditions[i]['value']
				? this._conditions[i]['value'] : null,
			this._conditions[i]['required']
				? 1 : null
		];
		Zotero.DB.query(sql, sqlParams);
	}
	
	Zotero.DB.commitTransaction();
	Zotero.Notifier.trigger(
		(isNew ? 'add' : 'modify'), 'search', this._savedSearchID
	);
	return this._savedSearchID;
}


Zotero.Search.prototype.addCondition = function(condition, operator, value, required){
	if (!Zotero.SearchConditions.hasOperator(condition, operator)){
		throw ("Invalid operator '" + operator + "' for condition " + condition);
	}
	
	// Shortcut to add a condition on every table -- does not return an id
	if (condition=='quicksearch'){
		this.addCondition('joinMode', 'any');
		
		// Quicksearch words don't need to be phrases
		var words = Zotero.Fulltext.semanticSplitter(value);
		for each(var i in words){
			this.addCondition('blockStart');
			this.addCondition('title', operator, i, false);
			this.addCondition('field', operator, i, false);
			this.addCondition('numberfield', operator, i, false);
			this.addCondition('creator', operator, i, false);
			this.addCondition('tag', operator, i, false);
			this.addCondition('note', operator, i, false);
			this.addCondition('fulltextWord', operator, i, false);
			this.addCondition('blockEnd');
		}
		return false;
	}
	
	var searchConditionID = ++this._maxSearchConditionID;
	
	var [condition, mode] = Zotero.SearchConditions.parseCondition(condition);
	
	this._conditions[searchConditionID] = {
		id: searchConditionID,
		condition: condition,
		mode: mode,
		operator: operator,
		value: value,
		required: required
	};
	
	this._sql = null;
	this._sqlParams = null;
	return searchConditionID;
}


Zotero.Search.prototype.updateCondition = function(searchConditionID, condition, operator, value, required){
	if (typeof this._conditions[searchConditionID] == 'undefined'){
		throw ('Invalid searchConditionID ' + searchConditionID + ' in updateCondition()');
	}
	
	if (!Zotero.SearchConditions.hasOperator(condition, operator)){
		throw ("Invalid operator '" + operator + "' for condition " + condition);
	}
	
	this._conditions[searchConditionID] = {
		id: searchConditionID,
		condition: condition,
		operator: operator,
		value: value,
		required: required
	};
	
	this._sql = null;
	this._sqlParams = null;
}


Zotero.Search.prototype.removeCondition = function(searchConditionID){
	if (typeof this._conditions[searchConditionID] == 'undefined'){
		throw ('Invalid searchConditionID ' + searchConditionID + ' in removeCondition()');
	}
	
	delete this._conditions[searchConditionID];
}


/*
 * Returns an array with 'condition', 'operator', 'value', 'required'
 * for the given searchConditionID
 */
Zotero.Search.prototype.getSearchCondition = function(searchConditionID){
	return this._conditions[searchConditionID];
}


/*
 * Returns a multidimensional array of conditions/operator/value sets
 * used in the search, indexed by searchConditionID
 */
Zotero.Search.prototype.getSearchConditions = function(){
	// TODO: make copy
	return this._conditions;
}


/*
 * Run the search and return an array of item ids for results
 */
Zotero.Search.prototype.search = function(){
	if (!this._sql){
		this._buildQuery();
	}
	
	var ids = Zotero.DB.columnQuery(this._sql, this._sqlParams);
	
	if (!ids){
		return false;
	}
	
	// Filter results with fulltext search
	for each(var condition in this._conditions){
		if (condition['condition']=='fulltextContent'){
			var fulltextIDs = Zotero.Fulltext.findTextInItems(ids,
				condition['value'],	condition['mode']);
			
			var hash = {};
			for each(var val in fulltextIDs){
				hash[val.id] = true;
			}
			
			switch (condition['operator']){
				case 'contains':
					var filter = function(val,  index, array){
						return hash[val] ? true : false;
					}
					break;
				
				case 'doesNotContain':
					var filter = function(val,  index, array){
						return hash[val] ? false : true;
					}
					break;
					
				default:
					continue;
			}
			
			var ids = ids.filter(filter);
		}
	}
	
	return ids;
}


/*
 * Get the SQL string for the search
 */
Zotero.Search.prototype.getSQL = function(){
	if (!this._sql){
		this._buildQuery();
	}
	return this._sql;
}


Zotero.Search.prototype.getSQLParams = function(){
	if (!this._sql){
		this._buildQuery();
	}
	return this._sqlParams;
}


/*
 * Build the SQL query for the search
 */
Zotero.Search.prototype._buildQuery = function(){
	var sql = 'SELECT itemID FROM items';
	var sqlParams = [];
	// Separate ANY conditions for 'required' condition support
	var anySQL = '';
	var anySQLParams = [];
	
	var conditions = [];
	
	for (var i in this._conditions){
		var data = Zotero.SearchConditions.get(this._conditions[i]['condition']);
		
		if (data['table']){
			conditions.push({
				name: data['name'],
				alias: data['name']!=this._conditions[i]['condition']
					? this._conditions[i]['condition'] : false,
				table: data['table'],
				field: data['field'],
				operator: this._conditions[i]['operator'],
				value: this._conditions[i]['value'],
				required: this._conditions[i]['required']
			});
			
			var hasConditions = true;
		}
		
		// Handle special conditions
		else {
			switch (data['name']){
				// Search subfolders
				case 'recursive':
					var recursive = this._conditions[i]['operator']=='true';
					continue;
					
				// Join mode ('any' or 'all')
				case 'joinMode':
					var joinMode = this._conditions[i]['operator'].toUpperCase();
					continue;
				
				case 'fulltextContent':
					// Handled in Search.search()
					continue;
				
				// For quicksearch block markers
				case 'blockStart':
					conditions.push({name:'blockStart'});
					continue;
				case 'blockEnd':
					conditions.push({name:'blockEnd'});
					continue;
			}
			
			throw ('Unhandled special condition ' + this._conditions[i]['condition']);
		}
	}
	
	if (hasConditions){
		sql += " WHERE ";
		
		for each(var condition in conditions){
				var openParens = 0;
				var skipOperators = false;
				var condSQL = '';
				var condSQLParams = [];
				
				//
				// Special table handling
				//
				if (condition['table']){
					switch (condition['table']){
						case 'savedSearches':
							break;
						default:
							condSQL += 'itemID '
							switch (condition['operator']){
								case 'isNot':
								case 'doesNotContain':
									condSQL += 'NOT ';
									break;
							}
							condSQL += 'IN (SELECT itemID FROM ' +
								condition['table'] + ' WHERE (';
							openParens = 2;
					}
				}
				
				//
				// Special condition handling
				//
				switch (condition['name']){
					case 'field':
					case 'datefield':
						if (!condition['alias']){
							break;
						}
						condSQL += 'fieldID=? AND ';
						condSQLParams.push(
							Zotero.ItemFields.getID(condition['alias'])
						);
						break;
					
					case 'collectionID':
						condSQL += "collectionID IN (?,";
						condSQLParams.push({int:condition['value']});
						
						// And descendents if recursive search
						if (recursive){
							var col = Zotero.Collections.get(condition['value']);
							var descendents = col.getDescendents(false, 'collection');
							if (descendents){
								for (var k in descendents){
									condSQL += '?,';
									condSQLParams.push(descendents[k]['id']);
								}
							}
						}
						
						// Strip final comma
						condSQL = condSQL.substring(0, condSQL.length-1) + ")";
						
						skipOperators = true;
						break;
					
					case 'savedSearchID':
						condSQL += "itemID ";
						if (condition['operator']=='isNot'){
							condSQL += "NOT ";
						}
						condSQL += "IN (";
						var search = new Zotero.Search();
						search.load(condition['value']);
						
						// Check if there are any post-search filters
						var subconds = search.getSearchConditions();
						var hasFilter;
						for each(var k in subconds){
							if (k.condition == 'fulltextContent'){
								hasFilter = true;
								break;
							}
						}
						// This is an ugly and inefficient way of doing a
						// subsearch, but it's necessary if there are any
						// post-search filters (e.g. fulltext scanning)
						if (hasFilter){
							var subids = search.search();
							condSQL += subids.join();
						}
						// Otherwise just put the SQL in a subquery
						else {
							condSQL += search.getSQL();
							var subpar = search.getSQLParams();
							for (var k in subpar){
								condSQLParams.push(subpar[k]);
							}
						}
						condSQL += ")";
						
						skipOperators = true;
						break;
					
					case 'tag':
						condSQL += "tagID IN (SELECT tagID FROM tags WHERE ";
						openParens++;
						break;
					
					case 'creator':
						condSQL += "creatorID IN (SELECT creatorID FROM creators "
							+ "WHERE ";
						openParens++;
						break;
					
					case 'fulltextWord':
						condSQL += "wordID IN (SELECT wordID FROM fulltextWords "
							+ "WHERE ";
						openParens++;
						break;
					
					// For quicksearch blocks
					case 'blockStart':
					case 'blockEnd':
						skipOperators = true;
						break;
				}
				
				if (!skipOperators){
					condSQL += condition['field'];
					switch (condition['operator']){
						case 'contains':
						case 'doesNotContain': // excluded with NOT IN above
							condSQL += ' LIKE ?';
							condSQLParams.push('%' + condition['value'] + '%');
							break;
							
						case 'is':
						case 'isNot': // excluded with NOT IN above
							condSQL += '=?';
							condSQLParams.push(condition['value']);
							break;
						
						/*
						case 'beginsWith':
							condSQL += '=?';
							condSQLParams.push(condition['value'] + '%');
							break;
						*/
						
						case 'isLessThan':
							condSQL += '<?';
							condSQLParams.push({int:condition['value']});
							break;
							
						case 'isGreaterThan':
							condSQL += '>?';
							condSQLParams.push({int:condition['value']});
							break;
							
						case 'isBefore':
							condSQL += '<?';
							condSQLParams.push({string:condition['value']});
							break;
							
						case 'isAfter':
							condSQL += '>?';
							condSQLParams.push({string:condition['value']});
							break;
					}
				}
				
				// Close open parentheses
				for (var k=openParens; k>0; k--){
					condSQL += ')';
				}
				
				// Keep non-required conditions separate if in ANY mode
				if (!condition['required'] && joinMode=='ANY'){
					// Little hack to allow multiple quicksearch words
					if (condition['name'] == 'blockStart'){
						condSQL += '(';
					}
					else if (condition['name'] == 'blockEnd'){
						// Strip ' OR ' from last condition
						anySQL = anySQL.substring(0, anySQL.length-4);
						condSQL += ') AND ';
					}
					else {
						condSQL += ' OR ';
					}
					anySQL += condSQL;
					anySQLParams = anySQLParams.concat(condSQLParams);
				}
				else {
					condSQL += ' AND ';
					sql += condSQL;
					sqlParams = sqlParams.concat(condSQLParams);
				}
		}
		
		// Add on ANY conditions
		if (anySQL){
			sql += '(' + anySQL;
			sqlParams = sqlParams.concat(anySQLParams);
			// If we ended with a block, remove ' AND ', otherwise ' OR '
			var remlen = condition['name']=='blockEnd' ? 5 : 4;
			sql = sql.substring(0, sql.length-remlen);
			sql += ')';
		}
		else {
			sql = sql.substring(0, sql.length-5); // remove last ' AND '
		}
	}
	
	this._sql = sql;
	this._sqlParams = sqlParams.length ? sqlParams : null;
}


Zotero.Searches = new function(){
	this.get = get;
	this.getAll = getAll;
	this.erase = erase;
	
	
	function get(id){
		var sql = "SELECT savedSearchID AS id, savedSearchName AS name "
			+ "FROM savedSearches WHERE savedSearchID=?";
		return Zotero.DB.rowQuery(sql, [id]);
	}
	
	
	/*
	 * Returns an array of saved searches with 'id' and 'name', ordered by name
	 */
	function getAll(){
		var sql = "SELECT savedSearchID AS id, savedSearchName AS name "
			+ "FROM savedSearches ORDER BY name";
		return Zotero.DB.query(sql);
	}
	
	
	/*
	 * Delete a given saved search from the DB
	 */
	function erase(savedSearchID){
		Zotero.DB.beginTransaction();
		var sql = "DELETE FROM savedSearchConditions WHERE savedSearchID="
			+ savedSearchID;
		Zotero.DB.query(sql);
		
		var sql = "DELETE FROM savedSearches WHERE savedSearchID="
			+ savedSearchID;
		Zotero.DB.query(sql);
		Zotero.DB.commitTransaction();
		
		Zotero.Notifier.trigger('remove', 'search', savedSearchID);
	}
}


Zotero.SearchConditions = new function(){
	this.get = get;
	this.getStandardConditions = getStandardConditions;
	this.hasOperator = hasOperator;
	this.parseCondition = parseCondition;
	
	var _initialized = false;
	var _conditions = [];
	var _standardConditions = [];
	
	/*
	 * Define the advanced search operators
	 */
	var _operators = {
		// Standard -- these need to match those in zoterosearch.xml
		is: true,
		isNot: true,
		contains: true,
		doesNotContain: true,
		isLessThan: true,
		isGreaterThan: true,
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
			
			// Saved search to search within
			{
				name: 'savedSearchID',
				operators: {
					is: true,
					isNot: true
				},
				table: 'savedSearches',
				field: 'savedSearchID',
				special: true
			},
			
			{
				name: 'quicksearch',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				}
			},
			
			// Quicksearch block markers
			{
				name: 'blockStart'
			},
			
			{
				name: 'blockEnd'
			},
			
			//
			// Standard conditions
			//
			
			// Collection id to search within
			{
				name: 'collectionID',
				operators: {
					is: true,
					isNot: true
				},
				table: 'collectionItems',
				field: 'collectionID'
			},
			
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
				name: 'dateAdded',
				operators: {
					is: true,
					isNot: true,
					isBefore: true,
					isAfter: true
				},
				table: 'items',
				field: 'DATE(dateAdded)'
			},
			
			{
				name: 'dateModified',
				operators: {
					is: true,
					isNot: true,
					isBefore: true,
					isAfter: true
				},
				table: 'items',
				field: 'DATE(dateModified)'
			},
			
			{
				name: 'itemTypeID',
				operators: {
					is: true,
					isNot: true
				},
				table: 'items',
				field: 'itemTypeID'
			},
			
			{
				name: 'tagID',
				operators: {
					is: true,
					isNot: true
				},
				table: 'itemTags',
				field: 'tagID',
				special: true
			},
			
			{
				name: 'tag',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				table: 'itemTags',
				field: 'tag'
			},
			
			{
				name: 'note',
				operators: {
					contains: true,
					doesNotContain: true
				},
				table: 'itemNotes',
				field: 'note'
			},
			
			{
				name: 'creator',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				table: 'itemCreators',
				field: "firstName || ' ' || lastName"
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
				aliases: Zotero.DB.columnQuery("SELECT fieldName FROM fields " +
					"WHERE fieldName NOT IN ('accessDate', 'date', 'pages', " +
					"'section','accessionNumber','seriesNumber','issue')"),
				template: true // mark for special handling
			},
			
			{
				name: 'datefield',
				operators: {
					is: true,
					isNot: true,
					isBefore: true,
					isAfter: true
				},
				table: 'itemData',
				field: 'DATE(value)',
				aliases: ['accessDate', 'date'],
				template: true // mark for special handling
			},
			
			{
				name: 'numberfield',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true,
					isLessThan: true,
					isGreaterThan: true
				},
				table: 'itemData',
				field: 'value',
				aliases: ['pages', 'section', 'accessionNumber',
					'seriesNumber','issue'],
				template: true // mark for special handling
			},
			
			{
				name: 'fulltextWord',
				operators: {
					contains: true,
					doesNotContain: true
				},
				table: 'fulltextItems',
				field: 'word',
				special: true
			},
			
			
			{
				name: 'fulltextContent',
				operators: {
					contains: true,
					doesNotContain: true
				},
				special: false
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
		
		var sortKeys = [];
		var sortValues = [];
		
		// Separate standard conditions for menu display
		for (var i in _conditions){
			// If explicitly special or a template master (e.g. 'field') or
			// no table and not explicitly unspecial, skip
			if (_conditions[i]['special'] ||
				(_conditions[i]['template'] && i==_conditions[i]['name']) ||
				(!_conditions[i]['table'] &&
					typeof _conditions[i]['special'] == 'undefined')){
				continue;
			}
			
			try {
				var localized = Zotero.getString('searchConditions.' + i)
			}
			catch (e){
				var localized = Zotero.getString('itemFields.' + i);
			}
			
			sortKeys.push(localized);
			sortValues[localized] = {
				name: i,
				localized: localized,
				operators: _conditions[i]['operators']
			};
		}
		
		// Alphabetize by localized name
		sortKeys = sortKeys.sort();
		for each(var i in sortKeys){
			_standardConditions.push(sortValues[i]);
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
		
		var [condition, mode] = this.parseCondition(condition);
		
		if (!_conditions[condition]){
			throw ("Invalid condition '" + condition + "' in hasOperator()");
		}
		
		if (!operator && typeof _conditions[condition]['operators'] == 'undefined'){
			return true;
		}
		
		return !!_conditions[condition]['operators'][operator];
	}
	
	
	function parseCondition(condition){
		var mode = false;
		var pos = condition.indexOf('/');
		if (pos != -1){
			mode = condition.substr(pos+1);
			condition = condition.substr(0, pos);
		}
		
		return [condition, mode];
	}
}
