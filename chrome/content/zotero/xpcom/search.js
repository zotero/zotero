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

Zotero.Search = function() {
	if (arguments[0]) {
		throw ("Zotero.Search constructor doesn't take any parameters");
	}
	
	this._loaded = false;
	this._init();
}


Zotero.Search.prototype._init = function () {
	// Public members for access by public methods -- do not access directly
	this._id = null;
	this._libraryID = null;
	this._key = null;
	this._name = null;
	this._dateAdded = null;
	this._dateModified = null;
	
	this._changed = false;
	this._previousData = false;
	
	this._scope = null;
	this._scopeIncludeChildren = null;
	this._sql = null;
	this._sqlParams = null;
	this._maxSearchConditionID = 0;
	this._conditions = [];
	this._hasPrimaryConditions = false;
}



Zotero.Search.prototype.getID = function(){
	Zotero.debug('Zotero.Search.getName() is deprecated -- use Search.id');
	return this._id;
}

Zotero.Search.prototype.getName = function() {
	Zotero.debug('Zotero.Search.getName() is deprecated -- use Search.name');
	return this.name;
}

Zotero.Search.prototype.setName = function(val) {
	Zotero.debug('Zotero.Search.setName() is deprecated -- use Search.name');
	this.name = val;
}


Zotero.Search.prototype.__defineGetter__('objectType', function () { return 'search'; });
Zotero.Search.prototype.__defineGetter__('id', function () { return this._get('id'); });
Zotero.Search.prototype.__defineSetter__('id', function (val) { this._set('id', val); });
Zotero.Search.prototype.__defineGetter__('libraryID', function () { return this._get('libraryID'); });
Zotero.Search.prototype.__defineSetter__('libraryID', function (val) { return this._set('libraryID', val); });
Zotero.Search.prototype.__defineGetter__('key', function () { return this._get('key'); });
Zotero.Search.prototype.__defineSetter__('key', function (val) { this._set('key', val) });
Zotero.Search.prototype.__defineGetter__('name', function () { return this._get('name'); });
Zotero.Search.prototype.__defineSetter__('name', function (val) { this._set('name', val); });
Zotero.Search.prototype.__defineGetter__('dateAdded', function () { return this._get('dateAdded'); });
Zotero.Search.prototype.__defineSetter__('dateAdded', function (val) { this._set('dateAdded', val); });
Zotero.Search.prototype.__defineGetter__('dateModified', function () { return this._get('dateModified'); });
Zotero.Search.prototype.__defineSetter__('dateModified', function (val) { this._set('dateModified', val); });

Zotero.Search.prototype.__defineGetter__('conditions', function (arr) { this.getSearchConditions(); });


Zotero.Search.prototype._get = function (field) {
	if ((this._id || this._key) && !this._loaded) {
		this.load();
	}
	return this['_' + field];
}


Zotero.Search.prototype._set = function (field, val) {
	switch (field) {
		case 'id':
		case 'libraryID':
		case 'key':
			if (val == this['_' + field]) {
				return;
			}
			
			if (this._loaded) {
				throw ("Cannot set " + field + " after object is already loaded in Zotero.Search._set()");
			}
			//this._checkValue(field, val);
			this['_' + field] = val;
			return;
		
		case 'name':
			val = Zotero.Utilities.prototype.trim(val);
			break;
	}
	
	if (this.id || this.key) {
		if (!this._loaded) {
			this.load();
		}
	}
	else {
		this._loaded = true;
	}
	
	if (this['_' + field] != val) {
		this._prepFieldChange(field);
		
		switch (field) {
			default:
				this['_' + field] = val;
		}
	}
}


/**
 * Check if saved search exists in the database
 *
 * @return	bool			TRUE if the search exists, FALSE if not
 */
Zotero.Search.prototype.exists = function() {
	if (!this.id) {
		throw ('searchID not set in Zotero.Search.exists()');
	}
	
	var sql = "SELECT COUNT(*) FROM savedSearches WHERE savedSearchID=?";
	return !!Zotero.DB.valueQuery(sql, this.id);
}


/*
 * Load a saved search from the DB
 */
Zotero.Search.prototype.load = function() {
	// Changed in 1.5
	if (arguments[0]) {
		throw ('Parameter no longer allowed in Zotero.Search.load()');
	}
	
	var id = this._id;
	var key = this._key;
	var libraryID = this._libraryID;
	var desc = id ? id : libraryID + "/" + key;
	
	var sql = "SELECT S.*, "
		+ "MAX(searchConditionID) AS maxID "
		+ "FROM savedSearches S LEFT JOIN savedSearchConditions "
		+ "USING (savedSearchID) WHERE ";
	if (id) {
		sql += "savedSearchID=?";
		var params = id;
	}
	else {
		sql += "key=?";
		var params = [key];
		if (libraryID) {
			sql += " AND libraryID=?";
			params.push(libraryID);
		}
		else {
			sql += " AND libraryID IS NULL";
		}
	}
	sql += " GROUP BY savedSearchID";
	var data = Zotero.DB.rowQuery(sql, params);
	
	this._loaded = true;
	
	if (!data) {
		return;
	}
	
	this._init();
	this._id = data.savedSearchID;
	this._libraryID = data.libraryID;
	this._key = data.key;
	this._name = data.savedSearchName;
	this._dateAdded = data.dateAdded;
	this._dateModified = data.dateModified;
	this._maxSearchConditionID = data.maxID;
	
	var sql = "SELECT * FROM savedSearchConditions "
		+ "WHERE savedSearchID=? ORDER BY searchConditionID";
	var conditions = Zotero.DB.query(sql, this._id);
	
	for (var i in conditions) {
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


/*
 * Save the search to the DB and return a savedSearchID
 *
 * If there are gaps in the searchConditionIDs, |fixGaps| must be true
 * and the caller must dispose of the search or reload the condition ids,
 * which may change after the save.
 *
 * For new searches, name must be set called before saving
 */
Zotero.Search.prototype.save = function(fixGaps) {
	Zotero.Searches.editCheck(this);
	
	if (!this.name) {
		throw('Name not provided for saved search');
	}
	
	Zotero.DB.beginTransaction();
	
	var isNew = !this.id || !this.exists();
	
	try {
		var searchID = this.id ? this.id : Zotero.ID.get('savedSearches');
		
		Zotero.debug("Saving " + (isNew ? 'new ' : '') + "search " + this.id);
		
		var key = this.key ? this.key : this._generateKey();
		
		var columns = [
			'savedSearchID',
			'savedSearchName',
			'dateAdded',
			'dateModified',
			'clientDateModified',
			'libraryID',
			'key'
		];
		var placeholders = ['?', '?', '?', '?', '?', '?', '?'];
		var sqlValues = [
			searchID ? { int: searchID } : null,
			{ string: this.name },
			// If date added isn't set, use current timestamp
			this.dateAdded ? this.dateAdded : Zotero.DB.transactionDateTime,
			// If date modified hasn't changed, use current timestamp
			this._changed.dateModified ?
				this.dateModified : Zotero.DB.transactionDateTime,
			Zotero.DB.transactionDateTime,
			this.libraryID ? this.libraryID : this.libraryID,
			key
		];
		
		var sql = "REPLACE INTO savedSearches (" + columns.join(', ') + ") VALUES ("
			+ placeholders.join(', ') + ")";
		var insertID = Zotero.DB.query(sql, sqlValues);
		if (!searchID) {
			searchID = insertID;
		}
		
		if (!isNew) {
			var sql = "DELETE FROM savedSearchConditions WHERE savedSearchID=?";
			Zotero.DB.query(sql, this.id);
		}
		
		// Close gaps in savedSearchIDs
		var saveConditions = {};
		var i = 1;
		for (var id in this._conditions) {
			if (!fixGaps && id != i) {
				Zotero.DB.rollbackTransaction();
				throw ('searchConditionIDs not contiguous and |fixGaps| not set in save() of saved search ' + this._id);
			}
			saveConditions[i] = this._conditions[id];
			i++;
		}
		
		this._conditions = saveConditions;
		
		// TODO: use proper bound parameters once DB class is updated
		for (var i in this._conditions){
			var sql = "INSERT INTO savedSearchConditions (savedSearchID, "
				+ "searchConditionID, condition, operator, value, required) "
				+ "VALUES (?,?,?,?,?,?)";
			
			// Convert condition and mode to "condition[/mode]"
			var condition = this._conditions[i].mode ?
				this._conditions[i].condition + '/' + this._conditions[i].mode :
				this._conditions[i].condition
			
			var sqlParams = [
				searchID, i, condition,
				this._conditions[i].operator
					? this._conditions[i].operator : null,
				this._conditions[i].value
					? this._conditions[i].value : null,
				this._conditions[i].required
					? 1 : null
			];
			Zotero.DB.query(sql, sqlParams);
		}
		
		Zotero.DB.commitTransaction();
	}
	catch (e) {
		Zotero.DB.rollbackTransaction();
		throw (e);
	}
	
	// If successful, set values in object
	if (!this.id) {
		this._id = searchID;
	}
	
	if (!this.key) {
		this._key = key;
	}
	
	if (isNew) {
		Zotero.Notifier.trigger('add', 'search', this.id);
	}
	else {
		Zotero.Notifier.trigger('modify', 'search', this.id, this._previousData);
	}
	
	return this._id;
}


Zotero.Search.prototype.clone = function() {
	var s = new Zotero.Search();
	
	var conditions = this.getSearchConditions();
	
	for each(var condition in conditions) {
		var name = condition.mode ?
			condition.condition + '/' + condition.mode :
			condition.condition
			
		s.addCondition(name, condition.operator, condition.value,
			condition.required);
	}
	
	return s;
}


Zotero.Search.prototype.addCondition = function(condition, operator, value, required) {
	if ((this.id || this.key) && !this._loaded) {
		this.load();
	}
	
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
			this.addCondition('annotation', operator, part.text, false);
			
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
	if ((this.id || this.key) && !this._loaded) {
		this.load();
	}
	
	if (typeof this._conditions[searchConditionID] == 'undefined'){
		throw ('Invalid searchConditionID ' + searchConditionID + ' in updateCondition()');
	}
	
	if (!Zotero.SearchConditions.hasOperator(condition, operator)){
		throw ("Invalid operator '" + operator + "' for condition " + condition);
	}
	
	var [condition, mode] = Zotero.SearchConditions.parseCondition(condition);
	
	this._conditions[searchConditionID] = {
		id: parseInt(searchConditionID),
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
	if ((this.id || this.key) && !this._loaded) {
		this.load();
	}
	
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
	if ((this.id || this.key) && !this._loaded) {
		this.load();
	}
	return this._conditions[searchConditionID];
}


/*
 * Returns a multidimensional array of conditions/operator/value sets
 * used in the search, indexed by searchConditionID
 */
Zotero.Search.prototype.getSearchConditions = function(){
	if ((this.id || this.key) && !this._loaded) {
		this.load();
	}
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
	if ((this.id || this.key) && !this._loaded) {
		this.load();
	}
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
	if ((this.id || this.key) && !this._loaded) {
		this.load();
	}
	
	if (!this._sql){
		this._buildQuery();
	}
	
	// Default to 'all' mode
	var joinMode = 'all';
	
	// Set some variables for conditions to avoid further lookups
	for each(var condition in this._conditions) {
		switch (condition.condition) {
			case 'joinMode':
				if (condition.operator == 'any') {
					joinMode = 'any';
				}
				break;
			
			case 'fulltextContent':
				var fulltextContent = true;
				break;
			
			case 'includeParentsAndChildren':
				if (condition.operator == 'true') {
					var includeParentsAndChildren = true;
				}
				break;
			
			case 'includeParents':
				if (condition.operator == 'true') {
					var includeParents = true;
				}
				break;
			
			case 'includeChildren':
				if (condition.operator == 'true') {
					var includeChildren = true;
				}
				break;
			
			case 'blockStart':
				var hasQuicksearch = true;
				break;
		}
	}
	
	// Run a subsearch to define the superset of possible results
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
		/*
		// DEBUG: Should this be here?
		//
		if (!ids) {
			Zotero.DB.query("DROP TABLE " + tmpTable);
			Zotero.DB.commitTransaction();
			return false;
		}
		*/
	}
	// Or just run main search
	else {
		var ids = Zotero.DB.columnQuery(this._sql, this._sqlParams);
	}
	
	//Zotero.debug('IDs from main search or subsearch: ');
	//Zotero.debug(ids);
	
	//Zotero.debug('Join mode: ' + joinMode);
	
	// Filter results with fulltext search
	//
	// If join mode ALL, return the (intersection of main and fulltext word search)
	// filtered by fulltext content
	//
	// If join mode ANY or there's a quicksearch (which we assume
	// fulltextContent is part of), return the union of the main search and
	// (a separate fulltext word search filtered by fulltext content)
	for each(var condition in this._conditions){
		if (condition['condition']=='fulltextContent'){
			var filter = function(val, index, array) {
				return hash[val] ?
					(condition.operator == 'contains') :
					(condition.operator == 'doesNotContain');
			};
			
			// Regexp mode -- don't use fulltext word index
			if (condition.mode && condition.mode.indexOf('regexp') == 0) {
				// In an ANY search, only bother scanning items that
				// haven't already been found by the main search
				if (joinMode == 'any') {
					if (!tmpTable) {
						Zotero.DB.beginTransaction();
						var tmpTable = this._idsToTempTable(ids);
					}
					
					var sql = "SELECT itemID FROM items WHERE "
						+ "itemID NOT IN (SELECT itemID FROM " + tmpTable + ")";
					var scopeIDs = Zotero.DB.columnQuery(sql);
				}
				// If an ALL search, scan only items from the main search
				else {
					var scopeIDs = ids;
				}
			}
			// If not regexp mode, run a new search against the fulltext word
			// index for words in this phrase
			else {
				Zotero.debug('Running subsearch against fulltext word index');
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
				
				//Zotero.debug("Fulltext word IDs");
				//Zotero.debug(fulltextWordIDs);
				
				// If ALL mode, set intersection of main search and fulltext word index
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
			}
			
			if (scopeIDs && scopeIDs.length) {
				var fulltextIDs = Zotero.Fulltext.findTextInItems(scopeIDs,
					condition['value'], condition['mode']);
				
				var hash = {};
				for each(var val in fulltextIDs){
					hash[val.id] = true;
				}
				
				filteredIDs = scopeIDs.filter(filter);
			}
			else {
				var filteredIDs = [];
			}
			
			//Zotero.debug("Filtered IDs:")
			//Zotero.debug(filteredIDs);
			
			// If join mode ANY, add any new items from the fulltext content
			// search to the main search results
			//
			// We only do this if there are primary conditions that alter the
			// main search, since otherwise all items will match
			if (this._hasPrimaryConditions &&
					(joinMode == 'any' || hasQuicksearch) && ids) {
				//Zotero.debug("Adding filtered IDs to main set");
				for each(var id in filteredIDs) {
					if (ids.indexOf(id) == -1) {
						ids.push(id);
					}
				}
			}
			else {
				//Zotero.debug("Replacing main set with filtered IDs");
				ids = filteredIDs;
			}
		}
	}
	
	if (tmpTable) {
		Zotero.DB.query("DROP TABLE " + tmpTable);
		Zotero.DB.commitTransaction();
	}
	
	if (this.hasPostSearchFilter() &&
			(includeParentsAndChildren || includeParents || includeChildren)) {
		Zotero.DB.beginTransaction();
		var tmpTable = this._idsToTempTable(ids);
		
		if (includeParentsAndChildren || includeParents) {
			//Zotero.debug("Adding parent items to result set");
			var sql = "SELECT sourceItemID FROM itemAttachments "
				+ "WHERE itemID IN (SELECT itemID FROM " + tmpTable + ") "
					+ " AND sourceItemID IS NOT NULL "
				+ "UNION SELECT sourceItemID FROM itemNotes "
					+ "WHERE itemID IN (SELECT itemID FROM " + tmpTable + ")"
					+ " AND sourceItemID IS NOT NULL";
		}
		
		if (includeParentsAndChildren || includeChildren) {
			//Zotero.debug("Adding child items to result set");
			var childrenSQL = "SELECT itemID FROM itemAttachments WHERE "
				+ "sourceItemID IN (SELECT itemID FROM " + tmpTable + ") UNION "
				+ "SELECT itemID FROM itemNotes WHERE sourceItemID IN "
				+ "(SELECT itemID FROM " + tmpTable + ")";
				
			if (includeParentsAndChildren || includeParents) {
				sql += " UNION " + childrenSQL;
			}
			else {
				sql = childrenSQL;
			}
		}
		
		sql = "SELECT itemID FROM items WHERE itemID IN (" + sql + ")";
		var parentChildIDs = Zotero.DB.columnQuery(sql);
		Zotero.DB.query("DROP TABLE " + tmpTable);
		Zotero.DB.commitTransaction();
		
		// Add parents and children to main ids
		if (parentChildIDs) {
			for (var i=0; i<parentChildIDs.length; i++) {
				var id = parentChildIDs[i];
				if (ids.indexOf(id) == -1) {
					ids.push(id);
				}
			}
		}
	}
	
	//Zotero.debug('Final result set');
	//Zotero.debug(ids);
	
	if (!ids || !ids.length) {
		return false;
	}
	
	if (asTempTable) {
		return this._idsToTempTable(ids);
	}
	
	return ids;
}


Zotero.Search.prototype.serialize = function() {
	var obj = {
		primary: {
			id: this.id,
			libraryID: this.libraryID,
			key: this.key,
			dateAdded: this.dateAdded,
			dateModified: this.dateModified
		},
		fields: {
			name: this.name,
		},
		conditions: this.getSearchConditions()
	};
	return obj;
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


Zotero.Search.prototype._prepFieldChange = function (field) {
	if (!this._changed) {
		this._changed = {};
	}
	this._changed[field] = true;
	
	// Save a copy of the data before changing
	// TODO: only save previous data if search exists
	if (this.id && this.exists() && !this._previousData) {
		this._previousData = this.serialize();
	}
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
				flags: data['flags'],
				required: this._conditions[i]['required']
			});
			
			this._hasPrimaryConditions = true;
		}
		
		// Handle special conditions
		else {
			switch (data['name']){
				case 'deleted':
					var deleted = this._conditions[i].operator == 'true';
					continue;
				
				case 'noChildren':
					var noChildren = this._conditions[i]['operator']=='true';
					continue;
				
				case 'includeParentsAndChildren':
					var includeParentsAndChildren = this._conditions[i]['operator'] == 'true';
					continue;
					
				case 'includeParents':
					var includeParents = this._conditions[i]['operator'] == 'true';
					continue;
				
				case 'includeChildren':
					var includeChildren = this._conditions[i]['operator'] == 'true';
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
	
	// Exclude deleted items (and their child items) by default
	sql += " WHERE itemID " + (deleted ? "" : "NOT ") + "IN "
			+ "("
				+ "SELECT itemID FROM deletedItems "
				+ "UNION "
				+ "SELECT itemID FROM itemNotes "
				+ "WHERE sourceItemID IS NOT NULL AND "
				+ "sourceItemID IN (SELECT itemID FROM deletedItems) "
				+ "UNION "
				+ "SELECT itemID FROM itemAttachments "
				+ "WHERE sourceItemID IS NOT NULL AND "
				+ "sourceItemID IN (SELECT itemID FROM deletedItems) "
			+ ")";
	
	if (noChildren){
		sql += " AND (itemID NOT IN (SELECT itemID FROM itemNotes "
			+ "WHERE sourceItemID IS NOT NULL) AND itemID NOT IN "
			+ "(SELECT itemID FROM itemAttachments "
			+ "WHERE sourceItemID IS NOT NULL))";
	}
	
	if (this._hasPrimaryConditions) {
		sql += " AND ";
		
		for each(var condition in conditions){
				var skipOperators = false;
				var openParens = 0;
				var condSQL = '';
				var selectOpenParens = 0;
				var condSelectSQL = '';
				var condSQLParams = [];
				
				//
				// Special table handling
				//
				if (condition['table']){
					switch (condition['table']){
						case 'savedSearches':
							break;
						default:
							condSelectSQL += 'itemID '
							switch (condition['operator']){
								case 'isNot':
								case 'doesNotContain':
									condSelectSQL += 'NOT ';
									break;
							}
							condSelectSQL += 'IN (';
							selectOpenParens = 1;
							condSQL += 'SELECT itemID FROM ' +
								condition['table'] + ' WHERE (';
							openParens = 1;
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
							if (!col) {
								var msg = "Collection " + condition['value'] + " specified in saved search doesn't exist";
								Zotero.debug(msg, 2);
								Zotero.log(msg, 'warning', 'chrome://zotero/content/xpcom/search.js');
								continue;
							}
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
						search.id = condition.value;
						
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
						var ftSQL = 'SELECT mimeType FROM fileTypeMimeTypes '
							+ 'WHERE fileTypeID IN ('
							+ 'SELECT fileTypeID FROM fileTypes WHERE '
							+ 'fileTypeID=?)';
						var patterns = Zotero.DB.columnQuery(ftSQL, { int: condition.value });
						if (patterns) {
							for each(str in patterns) {
								condSQL += 'mimeType LIKE ? OR ';
								condSQLParams.push(str + '%');
							}
							condSQL = condSQL.substring(0, condSQL.length - 4);
						}
						else {
							throw ("Invalid fileTypeID '" + condition.value + "' specified in search.js")
						}
						skipOperators = true;
						break;
					
					case 'tag':
						condSQL += "tagID IN (SELECT tagID FROM tags WHERE ";
						openParens++;
						break;
					
					case 'creator':
					case 'lastName':
						condSQL += "creatorID IN (SELECT creatorID FROM creators "
							+ "NATURAL JOIN creatorData WHERE ";
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
					// need to be handled specially
					if ((condition['name']=='dateAdded' ||
							condition['name']=='dateModified' ||
							condition['name']=='datefield') &&
							!Zotero.Date.isSQLDateTime(condition['value'])){
						
						// TODO: document these flags
						var parseDate = null;
						var alt = null;
						var useFreeform = null;
						
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
						switch (condition.operator) {
							// Cast strings as integers for < and > comparisons,
							// at least until 
							case 'isLessThan':
							case 'isGreaterThan':
								condSQL += "CAST(" + condition['field'] + " AS INT)";
								// Make sure either field is an integer or
								// converting to an integer and back to a string
								// yields the same result (i.e. it's numeric)
								var opAppend = " AND (TYPEOF("
									+ condition['field'] + ") = 'integer' OR "
									+ "CAST("
										+ "CAST(" + condition['field'] + " AS INT)"
									+ " AS STRING) = " + condition['field'] + ")"
								break;
								
							default:
								condSQL += condition['field'];
						}
						
						switch (condition['operator']){
							case 'contains':
							case 'doesNotContain': // excluded with NOT IN above
								condSQL += ' LIKE ?';
								// For fields with 'leftbound' flag, perform a
								// leftbound search even for 'contains' condition
								if (condition['flags'] &&
										condition['flags']['leftbound'] &&
										Zotero.Prefs.get('search.useLeftBound')) {
									condSQLParams.push(condition['value'] + '%');
								}
								else {
									condSQLParams.push('%' + condition['value'] + '%');
								}
								break;
								
							case 'is':
							case 'isNot': // excluded with NOT IN above
								// Automatically cast values which might
								// have been stored as integers
								if (condition.value && typeof condition.value == 'string'
										&& condition.value.match(/^[1-9]+[0-9]*$/)) {
									condSQL += ' LIKE ?';
								}
								else if (condition.value === null) {
									condSQL += ' IS NULL';
									break;
								}
								else {
									condSQL += '=?';
								}
								condSQLParams.push(condition['value']);
								break;
							
							case 'beginsWith':
								condSQL += ' LIKE ?';
								condSQLParams.push(condition['value'] + '%');
								break;
							
							case 'isLessThan':
								condSQL += '<?';
								condSQLParams.push({int:condition['value']});
								condSQL += opAppend;
								break;
								
							case 'isGreaterThan':
								condSQL += '>?';
								condSQLParams.push({int:condition['value']});
								condSQL += opAppend;
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
				
				if (includeParentsAndChildren || includeParents) {
					var parentSQL = "SELECT itemID FROM items WHERE "
						+ "itemID IN (SELECT sourceItemID FROM itemAttachments "
							+ "WHERE itemID IN (" + condSQL + ")) "
						+ "OR itemID IN (SELECT sourceItemID FROM itemNotes "
							+ "WHERE itemID IN (" + condSQL + ")) ";
					var parentSQLParams = condSQLParams.concat(condSQLParams);
				}
				
				if (includeParentsAndChildren || includeChildren) {
					var childrenSQL = "SELECT itemID FROM itemAttachments WHERE "
						+ "sourceItemID IN (" + condSQL + ") UNION "
						+ "SELECT itemID FROM itemNotes "
						+ "WHERE sourceItemID IN (" + condSQL + ")";
					var childSQLParams = condSQLParams.concat(condSQLParams);
				}
				
				if (includeParentsAndChildren || includeParents) {
					condSQL += " UNION " + parentSQL;
					condSQLParams = condSQLParams.concat(parentSQLParams);
				}
				
				if (includeParentsAndChildren || includeChildren) {
					condSQL += " UNION " + childrenSQL;
					condSQLParams = condSQLParams.concat(childSQLParams);
				}
				
				condSQL = condSelectSQL + condSQL;
				
				// Close open parentheses
				for (var k=selectOpenParens; k>0; k--) {
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
					anySQL += condSQL + ' OR ';
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
			sql = sql.substring(0, sql.length-4); // remove last ' OR '
			sql += ')';
		}
		else {
			sql = sql.substring(0, sql.length-5); // remove last ' AND '
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


Zotero.Search.prototype._generateKey = function () {
	return Zotero.ID.getKey();
}



Zotero.Searches = new function(){
	Zotero.DataObjects.apply(this, ['search', 'searches', 'savedSearch', 'savedSearches']);
	this.constructor.prototype = new Zotero.DataObjects();
	
	this.get = get;
	this.getAll = getAll;
	this.erase = erase;
	
	
	/**
	 * Retrieve a saved search
	 *
	 * @param	int				id		savedSearchID
	 * @return	object|bool				Zotero.Search object,
	 *										or false if it doesn't exist
	 */
	function get(id) {
		var sql = "SELECT COUNT(*) FROM savedSearches WHERE savedSearchID=?";
		if (Zotero.DB.valueQuery(sql, id)) {
			var search = new Zotero.Search;
			search.id = id;
			return search;
		}
		return false;
	}
	
	
	/*
	 * Returns an array of saved searches with 'id' and 'name', ordered by name
	 */
	function getAll(){
		var sql = "SELECT savedSearchID AS id, savedSearchName AS name "
			+ "FROM savedSearches ORDER BY name COLLATE NOCASE";
		var searches = Zotero.DB.query(sql);
		if (!searches) {
			return [];
		}
		// Do proper collation sort
		var collation = Zotero.getLocaleCollation();
		searches.sort(function (a, b) {
			return collation.compareString(1, a.name, b.name);
		});
		return searches;
	}
	
	
	/*
	 * Delete a given saved search from the DB
	 */
	function erase(ids) {
		ids = Zotero.flattenArguments(ids);
		var notifierData = {};
		
		Zotero.DB.beginTransaction();
		for each(var id in ids) {
			var search = new Zotero.Search;
			search.id = id;
			notifierData[id] = { old: search.serialize() };
			
			var sql = "DELETE FROM savedSearchConditions WHERE savedSearchID=?";
			Zotero.DB.query(sql, id);
			
			var sql = "DELETE FROM savedSearches WHERE savedSearchID=?";
			Zotero.DB.query(sql, id);
		}
		Zotero.DB.commitTransaction();
		
		Zotero.Notifier.trigger('delete', 'search', ids, notifierData);
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
	var _conditions = {};
	var _standardConditions = [];
	
	var self = this;
	
	/*
	 * Define the advanced search operators
	 */
	var _operators = {
		// Standard -- these need to match those in zoterosearch.xml
		is: true,
		isNot: true,
		beginsWith: true,
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
	 *
	 * Flags:
	 *  - special
	 *  - template
	 */
	function _init(){
		var conditions = [
			//
			// Special conditions
			//
			
			
			{
				name: 'deleted',
				operators: {
					true: true,
					false: true
				}
			},
			
			// Don't include child items
			{
				name: 'noChildren',
				operators: {
					true: true,
					false: true
				}
			},
			
			{
				name: 'includeParentsAndChildren',
				operators: {
					true: true,
					false: true
				}
			},
			
			{
				name: 'includeParents',
				operators: {
					true: true,
					false: true
				}
			},
			
			{
				name: 'includeChildren',
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
				field: 'name'
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
				name: 'lastName',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				table: 'itemCreators',
				field: 'lastName',
				special: true
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
				name: 'libraryID',
				operators: {
					is: true,
					isNot: true
				},
				table: 'items',
				field: 'libraryID',
				special: true
			},
			
			{
				name: 'annotation',
				operators: {
					contains: true,
					doesNotContain: true
				},
				table: 'annotations',
				field: 'text'
			},
			
			{
				name: 'fulltextWord',
				operators: {
					contains: true,
					doesNotContain: true
				},
				table: 'fulltextItemWords',
				field: 'word',
				flags: {
					leftbound: true
				},
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
		for (var i in conditions) {
			_conditions[conditions[i]['name']] = conditions[i];
			if (conditions[i]['aliases']) {
				for (var j in conditions[i]['aliases']) {
					_conditions[conditions[i]['aliases'][j]] = conditions[i];
				}
			}
			_conditions[conditions[i]['name']] = conditions[i];
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
				operators: _conditions[i]['operators'],
				flags: _conditions[i]['flags']
			};
		}
		
		// Alphabetize by localized name
		// TODO: locale collation sort
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
