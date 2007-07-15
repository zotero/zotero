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

Zotero.Search = function(savedSearchID){
	this._scope = null;
	this._scopeIncludeChildren = null;
	this._sql = null;
	this._sqlParams = null;
	this._maxSearchConditionID = 0;
	this._conditions = [];
	this._savedSearchID = null;
	this._savedSearchName = null;
	
	if (savedSearchID) {
		this.load(savedSearchID);
	}
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


Zotero.Search.prototype.clone = function() {
	var s = new Zotero.Search();
	
	var conditions = this.getSearchConditions();
	
	for each(var condition in conditions) {
		s.addCondition(condition.condition, condition.operator, condition.value,
			condition.required);
	}
	
	return s;
}


Zotero.Search.prototype.addCondition = function(condition, operator, value, required){
	if (!Zotero.SearchConditions.hasOperator(condition, operator)){
		throw ("Invalid operator '" + operator + "' for condition " + condition);
	}
	
	// Shortcut to add a condition on every table -- does not return an id
	if (condition=='quicksearch'){
		var parts = Zotero.SearchConditions.parseSearchString(value);
		
		for each(var part in parts) {
			this.addCondition('blockStart');
			this.addCondition('field', operator, part.text, false);
			this.addCondition('creator', operator, part.text, false);
			this.addCondition('tag', operator, part.text, false);
			this.addCondition('note', operator, part.text, false);
			
			if (part.inQuotes) {
				this.addCondition('fulltextContent', operator, part.text, false);
			}
			else {
				var splits = Zotero.Fulltext.semanticSplitter(part.text);
				for each(var split in splits) {
					this.addCondition('fulltextWord', operator, split, false);
				}
			}
			
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


/*
 * Sets scope of search to the results of the passed Search object
 */
Zotero.Search.prototype.setScope = function (searchObj, includeChildren) {
	this._scope = searchObj;
	this._scopeIncludeChildren = includeChildren;
}


Zotero.Search.prototype.updateCondition = function(searchConditionID, condition, operator, value, required){
	if (typeof this._conditions[searchConditionID] == 'undefined'){
		throw ('Invalid searchConditionID ' + searchConditionID + ' in updateCondition()');
	}
	
	if (!Zotero.SearchConditions.hasOperator(condition, operator)){
		throw ("Invalid operator '" + operator + "' for condition " + condition);
	}
	
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
	var conditions = [];
	var i = 1;
	for each(var condition in this._conditions) {
		conditions[i] = {
			id: i,
			condition: condition.condition,
			mode: condition.mode,
			operator: condition.operator,
			value: condition.value,
			required: condition.required
		};
		i++;
	}
	return conditions;
}


Zotero.Search.prototype.hasPostSearchFilter = function() {
	for each(var i in this._conditions){
		if (i.condition == 'fulltextContent'){
			return true;
		}
	}
	return false;
}


/*
 * Run the search and return an array of item ids for results
 */
Zotero.Search.prototype.search = function(asTempTable){
	if (!this._sql){
		this._buildQuery();
	}
	
	var joinMode = 'all';
	for each(var condition in this._conditions) {
		switch (condition.condition) {
			case 'joinMode':
				if (condition.operator == 'any') {
					joinMode = 'any';
				}
				break;
			
			case 'blockStart':
				var hasQuicksearch = true;
				break;
		}
	}
	
	if (this._scope) {
		Zotero.DB.beginTransaction();
		
		// If subsearch has post-search filter, run and insert ids into temp table
		if (this._scope.hasPostSearchFilter()) {
			var ids = this._scope.search();
			if (!ids) {
				Zotero.DB.commitTransaction();
				return false;
			}
			
			var tmpTable = this._idsToTempTable(ids);
		}
		// Otherwise, just copy to temp table directly
		else {
			var tmpTable = "tmpSearchResults_" + Zotero.randomString(8);
			var sql = "CREATE TEMPORARY TABLE " + tmpTable + " AS "
				+ this._scope.getSQL();
			Zotero.DB.query(sql, this._scope.getSQLParams());
			var sql = "CREATE INDEX " + tmpTable + "_itemID ON " + tmpTable + "(itemID)";
			Zotero.DB.query(sql);
		}
		
		// Search ids in temp table
		var sql = "SELECT itemID FROM items WHERE itemID IN (" + this._sql + ") "
			+ "AND ("
			+ "itemID IN (SELECT itemID FROM " + tmpTable + ")";
		
		if (this._scopeIncludeChildren) {
			sql += " OR itemID IN (SELECT itemID FROM itemAttachments"
			+ " WHERE sourceItemID IN (SELECT itemID FROM " + tmpTable + ")) OR "
			+ "itemID IN (SELECT itemID FROM itemNotes"
			+ " WHERE sourceItemID IN (SELECT itemID FROM " + tmpTable + "))";
		}
		sql += ")";
		
		var ids = Zotero.DB.columnQuery(sql, this._sqlParams);
		Zotero.DB.query("DROP TABLE " + tmpTable);
		Zotero.DB.commitTransaction();
	}
	else {
		var ids = Zotero.DB.columnQuery(this._sql, this._sqlParams);
	}
	
	//Zotero.debug('IDs from main search: ');
	//Zotero.debug(ids);
	
	
	//Zotero.debug('Join mode: ' + joinMode);
	
	// Filter results with fulltext search
	//
	// If join mode ALL, return the (union of main and fulltext word search)
	// filtered by fulltext content
	//
	// If join mode ANY or there's a quicksearch (which we assume
	// fulltextContent is part of), return the superset of the main search and
	// (a separate fulltext word search filtered by fulltext content)
	for each(var condition in this._conditions){
		if (condition['condition']=='fulltextContent'){
			//Zotero.debug('Running subsearch against fulltext word index');
			
			// Run a new search against the fulltext word index
			// for words in this phrase
			var s = new Zotero.Search();
			
			// Add any necessary conditions to the fulltext word search --
			// those that are required in an ANY search and any outside the
			// quicksearch in an ALL search
			for each(var c in this._conditions) {
				if (c.condition == 'blockStart') {
					var inQS = true;
					continue;
				}
				else if (c.condition == 'blockEnd') {
					inQS = false;
					continue;
				}
				else if (c.condition == 'fulltextContent' ||
						c.condition == 'fulltextContent' ||
							inQS) {
					continue;
				}
				else if (joinMode == 'any' && !c.required) {
					continue;
				}
				s.addCondition(c.condition, c.operator, c.value);
			}
			
			var splits = Zotero.Fulltext.semanticSplitter(condition.value);
			for each(var split in splits){
				s.addCondition('fulltextWord', condition.operator, split);
			}
			var fulltextWordIDs = s.search();
			
			var filter = function(val, index, array) {
				return hash[val] ?
					(condition.operator == 'contains') :
					(condition.operator == 'doesNotContain');
			};
			
			// If ALL mode, set union of main search and fulltext word index
			// as the scope for the fulltext content search
			if (joinMode == 'all' && !hasQuicksearch) {
				var hash = {};
				for each(var id in fulltextWordIDs){
					hash[id] = true;
				}
				
				if (ids) {
					var scopeIDs = ids.filter(filter);
				}
				else {
					var scopeIDs = [];
				}
			}
			// If ANY mode, just use fulltext word index hits for content search,
			// since the main results will be added in below
			else {
				var scopeIDs = fulltextWordIDs;
			}
			
			var fulltextIDs = Zotero.Fulltext.findTextInItems(scopeIDs,
				condition['value'],	condition['mode']);
			
			if (scopeIDs) {
				var hash = {};
				for each(var val in fulltextIDs){
					hash[val.id] = true;
				}
				
				var filteredIDs = scopeIDs.filter(filter);
			}
			else {
				var filteredIDs = [];
			}
			
			// If join mode ANY, add any new items from the fulltext content
			// search to the main search results
			if ((joinMode == 'any' || hasQuicksearch) && ids) {
				for each(var id in filteredIDs) {
					if (ids.indexOf(id) == -1) {
						ids.push(id);
					}
				}
			}
			else {
				ids = filteredIDs;
			}
		}
	}
	
	//Zotero.debug('Final result set');
	//Zotero.debug(ids);
	
	if (asTempTable) {
		if (!ids) {
			return false;
		}
		
		return this._idsToTempTable(ids);
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
 * Batch insert
 */
Zotero.Search.prototype._idsToTempTable = function (ids) {
	var tmpTable = "tmpSearchResults_" + Zotero.randomString(8);
	
	Zotero.DB.beginTransaction();
	
	var sql = "CREATE TEMPORARY TABLE " + tmpTable + " (itemID INT)";
	Zotero.DB.query(sql);
	var sql = "INSERT INTO " + tmpTable + " VALUES (?)";
	var insertStatement = Zotero.DB.getStatement(sql);
	for (var i=0; i<ids.length; i++) {
		insertStatement.bindInt32Parameter(0, ids[i]);
		try {
			insertStatement.execute();
		}
		catch (e) {
			throw (Zotero.DB.getLastErrorString());
		}
	}
	insertStatement.reset();
	
	var sql = "CREATE INDEX " + tmpTable + "_itemID ON " + tmpTable + "(itemID)";
	Zotero.DB.query(sql);
	
	Zotero.DB.commitTransaction();
	
	return tmpTable;
}


/*
 * Build the SQL query for the search
 */
Zotero.Search.prototype._buildQuery = function(){
	var utils = new Zotero.Utilities();
	
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
				case 'noChildren':
					var noChildren = this._conditions[i]['operator']=='true';
					continue;
				
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
	
	if (noChildren){
		sql += " WHERE (itemID NOT IN (SELECT itemID FROM itemNotes "
			+ "WHERE sourceItemID IS NOT NULL) AND itemID NOT IN "
			+ "(SELECT itemID FROM itemAttachments "
			+ "WHERE sourceItemID IS NOT NULL))";
	}
		
	if (hasConditions){
		if (noChildren){
			sql += " AND ";
		}
		else {
			sql += " WHERE ";
		}
		
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
					case 'numberfield':
						if (condition['alias']) {
							// Add base field
							condSQLParams.push(
								Zotero.ItemFields.getID(condition['alias'])
							);
							var typeFields = Zotero.ItemFields.getTypeFieldsFromBase(condition['alias']);
							if (typeFields) {
								condSQL += 'fieldID IN (?,';
								// Add type-specific fields
								for each(var fieldID in typeFields) {
									condSQL += '?,';
									condSQLParams.push(fieldID);
								}
								condSQL = condSQL.substr(0, condSQL.length - 1);
								condSQL += ') AND ';
							}
							else {
								condSQL += 'fieldID=? AND ';
							}
						}
						
						condSQL += "valueID IN (SELECT valueID FROM "
							+ "itemDataValues WHERE ";
						openParens++;
						break;
					
					case 'collectionID':
						var q = ['?'];
						var p = [{int:condition['value']}];
						
						// Search descendent collections if recursive search
						if (recursive){
							var col = Zotero.Collections.get(condition['value']);
							var descendents = col.getDescendents(false, 'collection');
							if (descendents){
								for (var k in descendents){
									q.push('?');
									p.push({int:descendents[k]['id']});
								}
							}
						}
						
						condSQL += "collectionID IN (" + q.join() + ")";
						condSQLParams = condSQLParams.concat(p);
						
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
						var hasFilter = search.hasPostSearchFilter();
						
						// This is an ugly and inefficient way of doing a
						// subsearch, but it's necessary if there are any
						// post-search filters (e.g. fulltext scanning) in the
						// subsearch
						//
						// DEBUG: it's possible there's a query length limit here
						// or that this slows things down with large libraries
						// -- should probably use a temporary table instead
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
					
					case 'fileTypeID':
						condSQL += 'mimeType IN (SELECT mimeType FROM '
							+ 'fileTypeMimeTypes WHERE fileTypeID IN ('
							+ 'SELECT fileTypeID FROM fileTypes WHERE ';
						openParens = openParens + 2;
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
					
					case 'childNote':
						condSQL += "itemID IN (SELECT sourceItemID FROM "
							+ "itemNotes WHERE ";
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
					// Special handling for date fields
					//
					// Note: We assume full datetimes are already UTC and don't
					// need to be handle specially
					if ((condition['name']=='dateAdded' ||
							condition['name']=='dateModified' ||
							condition['name']=='datefield') &&
							!Zotero.Date.isSQLDateTime(condition['value'])){
						
						switch (condition['operator']){
							case 'is':
							case 'isNot':
								var parseDate = true;
								var alt = '__';
								var useFreeform = true;
								break;
							
							case 'isBefore':
								var parseDate = true;
								var alt = '00';
								var useFreeform = false;
								break;
								
							case 'isAfter':
								var parseDate = true;
								// '__' used here just so the > string comparison
								// doesn't match dates in the specified year
								var alt = '__';
								var useFreeform = false;
								break;
								
							case 'isInTheLast':
								var parseDate = false;
								break;
								
							default:
								throw ('Invalid date field operator in search');
						}
						
						// Convert stored UTC dates to localtime
						//
						// It'd be nice not to deal with time zones here at all,
						// but otherwise searching for the date part of a field
						// stored as UTC that wraps midnight would be unsuccessful
						if (condition['name']=='dateAdded' ||
								condition['name']=='dateModified' ||
								condition['alias']=='accessDate'){
							condSQL += "DATE(" + condition['field'] + ", 'localtime')";
						}
						// Only use first (SQL) part of multipart dates
						else {
							condSQL += "SUBSTR(" + condition['field'] + ", 1, 10)";
						}
						
						if (parseDate){
							var go = false;
							var dateparts = Zotero.Date.strToDate(condition['value']);
							
							// Search on SQL date -- underscore is
							// single-character wildcard
							//
							// If isBefore or isAfter, month and day fall back
							// to '00' so that a search for just a year works
							// (and no year will just not find anything)
							var sqldate = dateparts['year'] ?
								utils.lpad(dateparts['year'], '0', 4) : '____';
							sqldate += '-'
							sqldate += dateparts['month'] ?
								utils.lpad(dateparts['month'] + 1, '0', 2) : alt;
							sqldate += '-';
							sqldate += dateparts['day'] ?
								utils.lpad(dateparts['day'], '0', 2) : alt;
							
							if (sqldate!='____-__-__'){
								go = true;
								
								switch (condition['operator']){
									case 'is':
									case 'isNot':
										condSQL += ' LIKE ?';
										break;
									
									case 'isBefore':
										condSQL += '<?';
										condSQL += ' AND ' + condition['field'] +
											">'0000-00-00'";
										break;
										
									case 'isAfter':
										condSQL += '>?';
										break;
								}
								
								condSQLParams.push({string:sqldate});
							}
							
							// Search for any remaining parts individually
							if (useFreeform && dateparts['part']){
								go = true;
								var parts = dateparts['part'].split(' ');
								for each (var part in parts){
									condSQL += " AND SUBSTR(" + condition['field'] + ", 12, 100)";
									condSQL += " LIKE ?";
									condSQLParams.push('%' + part  + '%');
								}
							}
							
							// If neither part used, invalidate clause
							if (!go){
								condSQL += '=0';
							}
						}
						
						else {
							switch (condition['operator']){
								case 'isInTheLast':
									condSQL += ">DATE('NOW', 'localtime', ?)"; // e.g. ('NOW', '-10 DAYS')
									condSQLParams.push({string: '-' + condition['value']});
									break;
							}
						}
					}
					
					// Non-date fields
					else {
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
							
							// Next two only used with full datetimes
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
				}
				
				// Close open parentheses
				for (var k=openParens; k>0; k--){
					condSQL += ')';
				}
				
				// Little hack to support multiple quicksearch words
				if (condition['name'] == 'blockStart') {
					var inQS = true;
					var qsSQL = '';
					var qsParams = [];
					continue;
				}
				else if (condition['name'] == 'blockEnd') {
					inQS = false;
					// Strip ' OR ' from last condition
					qsSQL = qsSQL.substring(0, qsSQL.length-4);
					
					// Add to existing quicksearch words
					if (!quicksearchSQLSet) {
						var quicksearchSQLSet = [];
						var quicksearchParamsSet = [];
					}
					quicksearchSQLSet.push(qsSQL);
					quicksearchParamsSet.push(qsParams);
				}
				else if (inQS) {
					qsSQL += condSQL + ' OR ';
					qsParams = qsParams.concat(condSQLParams);
				}
				// Keep non-required conditions separate if in ANY mode
				else if (!condition['required'] && joinMode == 'ANY') {
					var nonQSConditions = true;
					anySQL += condSQL + ' OR ';
					anySQLParams = anySQLParams.concat(condSQLParams);
				}
				else {
					var nonQSConditions = true;
					condSQL += ' AND ';
					sql += condSQL;
					sqlParams = sqlParams.concat(condSQLParams);
				}
		}
		
		// Add on ANY conditions
		if (anySQL){
			sql += '(' + anySQL;
			sqlParams = sqlParams.concat(anySQLParams);
			sql = sql.substring(0, sql.length-4); // remove last ' OR '
			sql += ')';
		}
		else if (nonQSConditions) {
			sql = sql.substring(0, sql.length-5); // remove last ' AND '
		}
		else {
			sql = sql.substring(0, sql.length-7); // remove ' WHERE '
		}
		
		// Add on quicksearch conditions
		if (quicksearchSQLSet) {
			sql = "SELECT itemID FROM items WHERE itemID IN (" + sql + ") "
				+ "AND ((" + quicksearchSQLSet.join(') AND (') + "))";
			
			for (var k=0; k<quicksearchParamsSet.length; k++) {
				sqlParams = sqlParams.concat(quicksearchParamsSet[k]);
			}
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
			+ "FROM savedSearches ORDER BY name COLLATE NOCASE";
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
		
		Zotero.Notifier.trigger('delete', 'search', savedSearchID);
	}
}


Zotero.SearchConditions = new function(){
	this.get = get;
	this.getStandardConditions = getStandardConditions;
	this.hasOperator = hasOperator;
	this.getLocalizedName = getLocalizedName;
	this.parseSearchString = parseSearchString;
	this.parseCondition = parseCondition;
	
	var _initialized = false;
	var _conditions = [];
	var _standardConditions = [];
	
	var self = this;
	
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
		isInTheLast: true,
		
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
			
			// Don't include child items
			{
				name: 'noChildren',
				operators: {
					true: true,
					false: true
				}
			},
			
			// Search recursively within collections
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
				name: 'dateAdded',
				operators: {
					is: true,
					isNot: true,
					isBefore: true,
					isAfter: true,
					isInTheLast: true
				},
				table: 'items',
				field: 'dateAdded'
			},
			
			{
				name: 'dateModified',
				operators: {
					is: true,
					isNot: true,
					isBefore: true,
					isAfter: true,
					isInTheLast: true
				},
				table: 'items',
				field: 'dateModified'
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
				name: 'fileTypeID',
				operators: {
					is: true,
					isNot: true
				},
				table: 'itemAttachments',
				field: 'fileTypeID'
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
				name: 'childNote',
				operators: {
					contains: true,
					doesNotContain: true
				},
				table: 'items',
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
					"'section','seriesNumber','issue')"),
				template: true // mark for special handling
			},
			
			{
				name: 'datefield',
				operators: {
					is: true,
					isNot: true,
					isBefore: true,
					isAfter: true,
					isInTheLast: true
				},
				table: 'itemData',
				field: 'value',
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
				aliases: ['pages', 'section', 'seriesNumber','issue'],
				template: true // mark for special handling
			},
			
			{
				name: 'fulltextWord',
				operators: {
					contains: true,
					doesNotContain: true
				},
				table: 'fulltextItemWords',
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
		
		var baseMappedFields = Zotero.ItemFields.getBaseMappedFields();
		
		// Separate standard conditions for menu display
		for (var i in _conditions){
			var fieldID = false;
			if (['field', 'datefield', 'numberfield'].indexOf(_conditions[i]['name']) != -1) {
				fieldID = Zotero.ItemFields.getID(i);
			}
			
			// If explicitly special...
			if (_conditions[i]['special'] ||
				// or a template master (e.g. 'field')...
				(_conditions[i]['template'] && i==_conditions[i]['name']) ||
				// or no table and not explicitly unspecial...
				(!_conditions[i]['table'] &&
					typeof _conditions[i]['special'] == 'undefined') ||
				// or field is a type-specific version of a base field...
				(fieldID && baseMappedFields.indexOf(fieldID) != -1)) {
				// ...then skip
				continue;
			}
			
			var localized = self.getLocalizedName(i);
			
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
	
	
	function getLocalizedName(str) {
		try {
			return Zotero.getString('searchConditions.' + str)
		}
		catch (e) {
			return Zotero.getString('itemFields.' + str);
		}
	}
	
	
	/*
	 * Parses a search into words and "double-quoted phrases"
	 *
	 * Also strips unpaired quotes at the beginning and end of words
	 *
	 * Returns array of objects containing 'text' and 'inQuotes'
	 */
	function parseSearchString(str) {
		var parts = str.split(/\s*("[^"]*")\s*|"\s|\s"|^"|"$|'\s|\s'|^'|'$|\s/m);
		var parsed = [];
		
		for (var i in parts) {
			var part = parts[i];
			if (!part.length) {
				continue;
			}
			
			if (part.charAt(0)=='"' && part.charAt(part.length-1)=='"') {
				parsed.push({
					text: part.substring(1, part.length-1),
					inQuotes: true
				});
			}
			else {
				parsed.push({
					text: part,
					inQuotes: false
				});
			}
		}
		
		return parsed;
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
