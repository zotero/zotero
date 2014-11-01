/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

Zotero.Search = function() {
	Zotero.Search._super.apply(this);
	
	this._name = null;
	
	this._scope = null;
	this._scopeIncludeChildren = null;
	this._sql = null;
	this._sqlParams = false;
	this._maxSearchConditionID = 0;
	this._conditions = [];
	this._hasPrimaryConditions = false;
}

Zotero.Search._super = Zotero.DataObject;
Zotero.Search.prototype = Object.create(Zotero.Search._super.prototype);
Zotero.Search.constructor = Zotero.Search;

Zotero.Search.prototype._objectType = 'search';
Zotero.Search.prototype._dataTypes = Zotero.Search._super.prototype._dataTypes.concat([
	'primaryData',
	'conditions'
]);

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


Zotero.Search.prototype.__defineGetter__('id', function () { return this._get('id'); });
Zotero.Search.prototype.__defineSetter__('id', function (val) { this._set('id', val); });
Zotero.Search.prototype.__defineGetter__('libraryID', function () { return this._get('libraryID'); });
Zotero.Search.prototype.__defineSetter__('libraryID', function (val) { return this._set('libraryID', val); });
Zotero.Search.prototype.__defineGetter__('key', function () { return this._get('key'); });
Zotero.Search.prototype.__defineSetter__('key', function (val) { this._set('key', val) });
Zotero.Search.prototype.__defineGetter__('name', function () { return this._get('name'); });
Zotero.Search.prototype.__defineSetter__('name', function (val) { this._set('name', val); });
Zotero.Search.prototype.__defineGetter__('version', function () { return this._get('version'); });
Zotero.Search.prototype.__defineSetter__('version', function (val) { this._set('version', val); });
Zotero.Search.prototype.__defineGetter__('synced', function () { return this._get('synced'); });
Zotero.Search.prototype.__defineSetter__('synced', function (val) { this._set('synced', val); });

Zotero.Search.prototype.__defineGetter__('conditions', function (arr) { this.getSearchConditions(); });

Zotero.Search.prototype._set = function (field, value) {
	if (field == 'id' || field == 'libraryID' || field == 'key') {
		return this._setIdentifier(field, value);
	}
	
	switch (field) {
	case 'name':
		value = value.trim();
		break;
	
	case 'version':
		value = parseInt(value);
		break;
	
	case 'synced':
		value = !!value;
		break;
	}
	
	this._requireData('primaryData');
	
	if (this['_' + field] != value) {
		this._markFieldChange(field, this['_' + field]);
		this._changed.primaryData = true;
		
		switch (field) {
			default:
				this['_' + field] = value;
		}
	}
}


/*
 * Load a saved search from the DB
 */
Zotero.Search.prototype.loadPrimaryData = Zotero.Promise.coroutine(function* (reload) {
	if (this._loaded.primaryData && !reload) return;
	
	var id = this._id;
	var key = this._key;
	var libraryID = this._libraryID;
	var desc = id ? id : libraryID + "/" + key;
	
	if (!id && !key) {
		throw new Error('ID or key not set');
	}
	
	var sql = Zotero.Searches.getPrimaryDataSQL()
	if (id) {
		sql += " AND savedSearchID=?";
		var params = id;
	}
	else {
		sql += " AND key=? AND libraryID=?";
		var params = [key, libraryID];
	}
	var data = yield Zotero.DB.rowQueryAsync(sql, params);
	
	this._loaded.primaryData = true;
	this._clearChanged('primaryData');
	
	if (!data) {
		return;
	}
	
	this.loadFromRow(data);
});


Zotero.Search.prototype.loadFromRow = function (row) {
	this._id = row.savedSearchID;
	this._libraryID = row.libraryID;
	this._key = row.key;
	this._name = row.savedSearchName;
	this._version = row.version;
	this._synced = !!row.synced;
	
	this._loaded.primaryData = true;
	this._clearChanged('primaryData');
	this._identified = true;
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
Zotero.Search.prototype.save = Zotero.Promise.coroutine(function* (fixGaps) {
	try {
		Zotero.Searches.editCheck(this);
		
		if (!this.name) {
			throw('Name not provided for saved search');
		}
		
		var isNew = !this.id;
		
		// Register this item's identifiers in Zotero.DataObjects on transaction commit,
		// before other callbacks run
		var searchID, libraryID, key;
		if (isNew) {
			var transactionOptions = {
				onCommit: function () {
					Zotero.Searches.registerIdentifiers(searchID, libraryID, key);
				}
			};
		}
		else {
			var transactionOptions = null;
		}
		
		return Zotero.DB.executeTransaction(function* () {
			searchID = this._id = this.id ? this.id : yield Zotero.ID.get('savedSearches');
			libraryID = this.libraryID;
			key = this._key = this.key ? this.key : this._generateKey();
			
			Zotero.debug("Saving " + (isNew ? 'new ' : '') + "search " + this.id);
			
			var columns = [
				'savedSearchID',
				'savedSearchName',
				'clientDateModified',
				'libraryID',
				'key',
				'version',
				'synced'
			];
			var placeholders = columns.map(function () '?').join();
			var sqlValues = [
				searchID ? { int: searchID } : null,
				{ string: this.name },
				Zotero.DB.transactionDateTime,
				this.libraryID ? this.libraryID : 0,
				key,
				this.version ? this.version : 0,
				this.synced ? 1 : 0
			];
			
			var sql = "REPLACE INTO savedSearches (" + columns.join(', ') + ") "
				+ "VALUES (" + placeholders + ")";
			var insertID = yield Zotero.DB.queryAsync(sql, sqlValues);
			if (!searchID) {
				searchID = insertID;
			}
			
			if (!isNew) {
				var sql = "DELETE FROM savedSearchConditions WHERE savedSearchID=?";
				yield Zotero.DB.queryAsync(sql, this.id);
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
			
			for (var i in this._conditions){
				var sql = "INSERT INTO savedSearchConditions (savedSearchID, "
					+ "searchConditionID, condition, operator, value, required) "
					+ "VALUES (?,?,?,?,?,?)";
				
				// Convert condition and mode to "condition[/mode]"
				var condition = this._conditions[i].mode ?
					this._conditions[i].condition + '/' + this._conditions[i].mode :
					this._conditions[i].condition
				
				var sqlParams = [
					searchID,
					i,
					condition,
					this._conditions[i].operator ? this._conditions[i].operator : null,
					this._conditions[i].value ? this._conditions[i].value : null,
					this._conditions[i].required ? 1 : null
				];
				yield Zotero.DB.queryAsync(sql, sqlParams);
			}
			
			
			if (isNew) {
				Zotero.Notifier.trigger('add', 'search', this.id);
			}
			else {
				Zotero.Notifier.trigger('modify', 'search', this.id, this._previousData);
			}
			
			if (isNew && this.libraryID) {
				var groupID = Zotero.Groups.getGroupIDFromLibraryID(this.libraryID);
				var group = yield Zotero.Groups.get(groupID);
				group.clearSearchCache();
			}
			
			if (isNew) {
				var id = this.id;
				this._disabled = true;
				return id;
			}
			
			yield this.reload();
			this._clearChanged();
			
			return isNew ? this.id : true;
		}.bind(this), transactionOptions);
	}
	catch (e) {
		try {
			yield this.reload();
			this._clearChanged();
		}
		catch (e2) {
			Zotero.debug(e2, 1);
		}
		
		Zotero.debug(e, 1);
		throw e;
	}
});


Zotero.Search.prototype.clone = Zotero.Promise.coroutine(function* (libraryID) {
	var s = new Zotero.Search();
	s.libraryID = libraryID === undefined ? this.libraryID : libraryID;
	
	var conditions = this.getSearchConditions();
	
	for each(var condition in conditions) {
		var name = condition.mode ?
			condition.condition + '/' + condition.mode :
			condition.condition
			
		yield s.addCondition(name, condition.operator, condition.value,
			condition.required);
	}
	
	return s;
});


Zotero.Search.prototype.addCondition = Zotero.Promise.coroutine(function* (condition, operator, value, required) {
	this._requireData('conditions');
	
	if (!Zotero.SearchConditions.hasOperator(condition, operator)){
		throw ("Invalid operator '" + operator + "' for condition " + condition);
	}
	
	// Shortcut to add a condition on every table -- does not return an id
	if (condition.match(/^quicksearch/)) {
		var parts = Zotero.SearchConditions.parseSearchString(value);
		
		for each(var part in parts) {
			yield this.addCondition('blockStart');
			
			// If search string is 8 characters, see if this is a item key
			if (operator == 'contains' && part.text.length == 8) {
				yield this.addCondition('key', 'is', part.text, false);
			}
			
			if (condition == 'quicksearch-titleCreatorYear') {
				yield this.addCondition('title', operator, part.text, false);
				yield this.addCondition('publicationTitle', operator, part.text, false);
				yield this.addCondition('year', operator, part.text, false);
			}
			else {
				yield this.addCondition('field', operator, part.text, false);
				yield this.addCondition('tag', operator, part.text, false);
				yield this.addCondition('note', operator, part.text, false);
			}
			yield this.addCondition('creator', operator, part.text, false);
			
			if (condition == 'quicksearch-everything') {
				yield this.addCondition('annotation', operator, part.text, false);
				
				if (part.inQuotes) {
					yield this.addCondition('fulltextContent', operator, part.text, false);
				}
				else {
					var splits = Zotero.Fulltext.semanticSplitter(part.text);
					for each(var split in splits) {
						yield this.addCondition('fulltextWord', operator, split, false);
					}
				}
			}
			
			yield this.addCondition('blockEnd');
		}
		
		if (condition == 'quicksearch-titleCreatorYear') {
			yield this.addCondition('noChildren', 'true');
		}
		
		return false;
	}
	// Shortcut to add a collection
	else if (condition == 'collectionID') {
		var c = yield Zotero.Collections.getAsync(value);
		if (!c) {
			var msg = "Collection " + value + " not found";
			Zotero.debug(msg, 2);
			Components.utils.reportError(msg);
			return;
		}
		return this.addCondition('collection', operator, c.key, required);
	}
	// Shortcut to add a saved search
	else if (condition == 'savedSearchID') {
		var s = yield Zotero.Searches.getAsync(value);
		if (!s) {
			var msg = "Saved search " + value + " not found";
			Zotero.debug(msg, 2);
			Components.utils.reportError(msg);
			return;
		}
		return this.addCondition('savedSearch', operator, s.key, required);
	}
	
	var searchConditionID = ++this._maxSearchConditionID;
	
	let mode;
	[condition, mode] = Zotero.SearchConditions.parseCondition(condition);
	
	this._conditions[searchConditionID] = {
		id: searchConditionID,
		condition: condition,
		mode: mode,
		operator: operator,
		value: value,
		required: required
	};
	
	this._sql = null;
	this._sqlParams = false;
	return searchConditionID;
});


/*
 * Sets scope of search to the results of the passed Search object
 */
Zotero.Search.prototype.setScope = function (searchObj, includeChildren) {
	this._scope = searchObj;
	this._scopeIncludeChildren = includeChildren;
}


/**
 * @param {Number} searchConditionID
 * @param {String} condition
 * @param {String} operator
 * @param {String} value
 * @param {Boolean} [required]
 * @return {Promise}
 */
Zotero.Search.prototype.updateCondition = Zotero.Promise.coroutine(function* (searchConditionID, condition, operator, value, required){
	yield this.loadPrimaryData();
	
	if (typeof this._conditions[searchConditionID] == 'undefined'){
		throw new Error('Invalid searchConditionID ' + searchConditionID);
	}
	
	if (!Zotero.SearchConditions.hasOperator(condition, operator)){
		throw new Error("Invalid operator '" + operator + "' for condition " + condition);
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
	this._sqlParams = false;
});


Zotero.Search.prototype.removeCondition = Zotero.Promise.coroutine(function* (searchConditionID){
	yield this.loadPrimaryData();
	
	if (typeof this._conditions[searchConditionID] == 'undefined'){
		throw ('Invalid searchConditionID ' + searchConditionID + ' in removeCondition()');
	}
	
	delete this._conditions[searchConditionID];
});


/*
 * Returns an array with 'condition', 'operator', 'value', 'required'
 * for the given searchConditionID
 */
Zotero.Search.prototype.getSearchCondition = function(searchConditionID){
	this._requireData('conditions');
	return this._conditions[searchConditionID];
}


/*
 * Returns a multidimensional array of conditions/operator/value sets
 * used in the search, indexed by searchConditionID
 */
Zotero.Search.prototype.getSearchConditions = function(){
	this._requireData('conditions');
	var conditions = [];
	for (var id in this._conditions) {
		var condition = this._conditions[id];
		conditions[id] = {
			id: id,
			condition: condition.condition,
			mode: condition.mode,
			operator: condition.operator,
			value: condition.value,
			required: condition.required
		};
	}
	return conditions;
}


Zotero.Search.prototype.hasPostSearchFilter = function() {
	this._requireData('conditions');
	for each(var i in this._conditions){
		if (i.condition == 'fulltextContent'){
			return true;
		}
	}
	return false;
}


/**
 * Run the search and return an array of item ids for results
 *
 * @param {Boolean} [asTempTable=false]
 * @return {Promise}
 */
Zotero.Search.prototype.search = Zotero.Promise.coroutine(function* (asTempTable) {
	var tmpTable;
	
	if (this._identified) {
		yield this.loadConditions();
	}
	// Mark conditions as loaded
	else {
		this._requireData('conditions');
	}
	
	try {
		if (!this._sql){
			yield this._buildQuery();
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
			if (this._scope._identified) {
				yield this._scope.loadPrimaryData();
				yield this._scope.loadConditions();
			}
			
			// If subsearch has post-search filter, run and insert ids into temp table
			if (this._scope.hasPostSearchFilter()) {
				var ids = yield this._scope.search();
				if (!ids) {
					return [];
				}
				
				Zotero.debug('g');
				Zotero.debug(ids);
				tmpTable = yield Zotero.Search.idsToTempTable(ids);
			}
			// Otherwise, just copy to temp table directly
			else {
				tmpTable = "tmpSearchResults_" + Zotero.randomString(8);
				var sql = "CREATE TEMPORARY TABLE " + tmpTable + " AS "
					+ (yield this._scope.getSQL());
				yield Zotero.DB.queryAsync(sql, yield this._scope.getSQLParams());
				var sql = "CREATE INDEX " + tmpTable + "_itemID ON " + tmpTable + "(itemID)";
				yield Zotero.DB.queryAsync(sql);
			}
			
			// Search ids in temp table
			var sql = "SELECT GROUP_CONCAT(itemID) FROM items WHERE itemID IN (" + this._sql + ") "
				+ "AND ("
				+ "itemID IN (SELECT itemID FROM " + tmpTable + ")";
			
			if (this._scopeIncludeChildren) {
				sql += " OR itemID IN (SELECT itemID FROM itemAttachments"
				+ " WHERE parentItemID IN (SELECT itemID FROM " + tmpTable + ")) OR "
				+ "itemID IN (SELECT itemID FROM itemNotes"
				+ " WHERE parentItemID IN (SELECT itemID FROM " + tmpTable + "))";
			}
			sql += ")";
			
			var res = yield Zotero.DB.valueQueryAsync(sql, this._sqlParams);
			var ids = res ? res.split(",") : [];
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
			var ids = yield Zotero.DB.columnQueryAsync(this._sql, this._sqlParams);
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
				var fulltextWordIntersectionFilter = function (val, index, array) !!hash[val];
				var fulltextWordIntersectionConditionFilter = function(val, index, array) {
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
							Zotero.debug('=');
							Zotero.debug(ids);
							tmpTable = yield Zotero.Search.idsToTempTable(ids);
						}
						
						var sql = "SELECT GROUP_CONCAT(itemID) FROM items WHERE "
							+ "itemID NOT IN (SELECT itemID FROM " + tmpTable + ")";
						var res = yield Zotero.DB.valueQueryAsync(sql);
						var scopeIDs = res ? res.split(",") : [];
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
						yield s.addCondition(c.condition, c.operator, c.value);
					}
					
					var splits = Zotero.Fulltext.semanticSplitter(condition.value);
					for each(var split in splits){
						yield s.addCondition('fulltextWord', condition.operator, split);
					}
					var fulltextWordIDs = yield s.search();
					
					//Zotero.debug("Fulltext word IDs");
					//Zotero.debug(fulltextWordIDs);
					
					// If ALL mode, set intersection of main search and fulltext word index
					// as the scope for the fulltext content search
					if (joinMode == 'all' && !hasQuicksearch) {
						var hash = {};
						for (let i=0; i<fulltextWordIDs.length; i++) {
							hash[fulltextWordIDs[i].id] = true;
						}
						
						if (ids) {
							var scopeIDs = ids.filter(fulltextWordIntersectionFilter);
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
					var fulltextIDs = yield Zotero.Fulltext.findTextInItems(scopeIDs,
						condition['value'], condition['mode']);
					
					var hash = {};
					for (let i=0; i<fulltextIDs.length; i++) {
						hash[fulltextIDs[i].id] = true;
					}
					
					filteredIDs = scopeIDs.filter(fulltextWordIntersectionConditionFilter);
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
					for (let i=0; i<filteredIDs.length; i++) {
						let id = filteredIDs[i];
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
		
		if (this.hasPostSearchFilter() &&
				(includeParentsAndChildren || includeParents || includeChildren)) {
		Zotero.debug('b');
		Zotero.debug(ids);
			var tmpTable = yield Zotero.Search.idsToTempTable(ids);
			
			if (includeParentsAndChildren || includeParents) {
				//Zotero.debug("Adding parent items to result set");
				var sql = "SELECT parentItemID FROM itemAttachments "
					+ "WHERE itemID IN (SELECT itemID FROM " + tmpTable + ") "
						+ " AND parentItemID IS NOT NULL "
					+ "UNION SELECT parentItemID FROM itemNotes "
						+ "WHERE itemID IN (SELECT itemID FROM " + tmpTable + ")"
						+ " AND parentItemID IS NOT NULL";
			}
			
			if (includeParentsAndChildren || includeChildren) {
				//Zotero.debug("Adding child items to result set");
				var childrenSQL = "SELECT itemID FROM itemAttachments WHERE "
					+ "parentItemID IN (SELECT itemID FROM " + tmpTable + ") UNION "
					+ "SELECT itemID FROM itemNotes WHERE parentItemID IN "
					+ "(SELECT itemID FROM " + tmpTable + ")";
					
				if (includeParentsAndChildren || includeParents) {
					sql += " UNION " + childrenSQL;
				}
				else {
					sql = childrenSQL;
				}
			}
			
			sql = "SELECT GROUP_CONCAT(itemID) FROM items WHERE itemID IN (" + sql + ")";
			var res = yield Zotero.DB.valueQueryAsync(sql);
			var parentChildIDs = res ? res.split(",") : [];
			
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
	}
	finally {
		if (tmpTable && !asTempTable) {
			yield Zotero.DB.queryAsync("DROP TABLE IF EXISTS " + tmpTable);
		}
	}
	
	//Zotero.debug('Final result set');
	//Zotero.debug(ids);
	
	if (!ids || !ids.length) {
		return [];
	}
	
	if (asTempTable) {
		Zotero.debug('c');
		Zotero.debug(ids);
		return Zotero.Search.idsToTempTable(ids);
	}
	return ids;
});


Zotero.Search.prototype.serialize = function() {
	var obj = {
		primary: {
			id: this.id,
			libraryID: this.libraryID,
			key: this.key
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
Zotero.Search.prototype.getSQL = Zotero.Promise.coroutine(function* () {
	if (!this._sql) {
		yield this.loadConditions();
		yield this._buildQuery();
	}
	return this._sql;
});


Zotero.Search.prototype.getSQLParams = Zotero.Promise.coroutine(function* () {
	if (!this._sql) {
		yield this.loadConditions();
		yield this._buildQuery();
	}
	return this._sqlParams;
});


Zotero.Search.prototype.loadConditions = Zotero.Promise.coroutine(function* (reload) {
	Zotero.debug("Loading conditions for search " + this.libraryKey);
	
	if (this._loaded.conditions && !reload) {
		return;
	}
	
	if (!this.id) {
		throw new Error('ID not set for object before attempting to load conditions');
	}
	
	var sql = "SELECT * FROM savedSearchConditions "
		+ "WHERE savedSearchID=? ORDER BY searchConditionID";
	var conditions = yield Zotero.DB.queryAsync(sql, this.id);
	
	if (conditions.length) {
		this._maxSearchConditionID = conditions[conditions.length - 1].searchConditionID;
	}
	
	// Reindex conditions, in case they're not contiguous in the DB
	var conditionID = 1;
	
	for (let i=0; i<conditions.length; i++) {
		// Parse "condition[/mode]"
		var [condition, mode] =
			Zotero.SearchConditions.parseCondition(conditions[i]['condition']);
		
		var cond = Zotero.SearchConditions.get(condition);
		if (!cond || cond.noLoad) {
			Zotero.debug("Invalid saved search condition '" + condition + "' -- skipping", 2);
			continue;
		}
		
		// Convert itemTypeID to itemType
		//
		// TEMP: This can be removed at some point
		if (condition == 'itemTypeID') {
			condition = 'itemType';
			conditions[i].value = Zotero.ItemTypes.getName(conditions[i].value);
		}
		
		this._conditions[conditionID] = {
			id: conditionID,
			condition: condition,
			mode: mode,
			operator: conditions[i].operator,
			value: conditions[i].value,
			required: conditions[i].required
		};
		
		conditionID++;
	}
	
	this._loaded.conditions = true;
});


/*
 * Batch insert
 */
Zotero.Search.idsToTempTable = function (ids) {
	const N_COMBINED_INSERTS = 128;
	
	var tmpTable = "tmpSearchResults_" + Zotero.randomString(8);
	
	return Zotero.DB.executeTransaction(function* () {
		var sql = "CREATE TEMPORARY TABLE " + tmpTable + " (itemID INT)";
		yield Zotero.DB.queryAsync(sql);
		
		var ids2 = ids ? ids.concat() : [];
		while (ids2.length) {
			let chunk = ids2.splice(0, N_COMBINED_INSERTS);
			let sql = 'INSERT INTO ' + tmpTable + ' '
				+ chunk.map(function () "SELECT ?").join(" UNION ");
			yield Zotero.DB.queryAsync(sql, chunk, { debug: false });
		}
		
		var sql = "CREATE INDEX " + tmpTable + "_itemID ON " + tmpTable + "(itemID)";
		yield Zotero.DB.queryAsync(sql);
		
		return tmpTable;
	});
}


/*
 * Build the SQL query for the search
 */
Zotero.Search.prototype._buildQuery = Zotero.Promise.coroutine(function* () {
	this._requireData('conditions');
	
	var sql = 'SELECT itemID FROM items';
	var sqlParams = [];
	// Separate ANY conditions for 'required' condition support
	var anySQL = '';
	var anySQLParams = [];
	
	var conditions = [];
	
	for (var i in this._conditions){
		var data = Zotero.SearchConditions.get(this._conditions[i]['condition']);
		
		// Has a table (or 'savedSearch', which doesn't have a table but isn't special)
		if (data.table || data.name == 'savedSearch' || data.name == 'tempTable') {
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
				
				case 'unfiled':
					this._conditions[i]['operator']
					var unfiled = this._conditions[i]['operator'] == 'true';
					continue;
				
				// Search subcollections
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
				+ "WHERE parentItemID IS NOT NULL AND "
				+ "parentItemID IN (SELECT itemID FROM deletedItems) "
				+ "UNION "
				+ "SELECT itemID FROM itemAttachments "
				+ "WHERE parentItemID IS NOT NULL AND "
				+ "parentItemID IN (SELECT itemID FROM deletedItems) "
			+ ")";
	
	if (noChildren){
		sql += " AND (itemID NOT IN (SELECT itemID FROM itemNotes "
			+ "WHERE parentItemID IS NOT NULL) AND itemID NOT IN "
			+ "(SELECT itemID FROM itemAttachments "
			+ "WHERE parentItemID IS NOT NULL))";
	}
	
	if (unfiled) {
		sql += " AND (itemID NOT IN (SELECT itemID FROM collectionItems) "
			// Exclude children
			+ "AND itemID NOT IN "
			+ "(SELECT itemID FROM itemAttachments WHERE parentItemID IS NOT NULL "
			+ "UNION SELECT itemID FROM itemNotes WHERE parentItemID IS NOT NULL)"
			+ ")";
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
					
					case 'year':
						condSQLParams.push(Zotero.ItemFields.getID('date'));
						//Add base field
						var dateFields = Zotero.ItemFields.getTypeFieldsFromBase('date');
						if (dateFields) {
							condSQL += 'fieldID IN (?,';																
							// Add type-specific date fields (dateEnacted, dateDecided, issueDate)
							for each(var fieldID in dateFields) {
								condSQL += '?,';
								condSQLParams.push(fieldID);
							}
							condSQL = condSQL.substr(0, condSQL.length - 1);
							condSQL += ') AND ';
						}
					
						condSQL += "valueID IN (SELECT valueID FROM "
							+ "itemDataValues WHERE ";
						
						openParens++;
						break;
					
					case 'collection':
					case 'savedSearch':
						let obj;
						let objLibraryID;
						let objKey = condition.value;
						let objectType = condition.name == 'collection' ? 'collection' : 'search';
						let objectTypeClass = Zotero.DataObjectUtilities.getClassForObjectType(objectType);
						
						// Old-style library-key hash
						if (objKey.contains('_')) {
							[objLibraryID, objKey] = objKey.split('_');
						}
						// libraryID assigned on search
						else if (this.libraryID !== null) {
							objLibraryID = this.libraryID;
						}
						
						// If search doesn't have a libraryID, check all possible libraries
						// for the collection/search
						if (objLibraryID === undefined) {
							let foundLibraryID = false;
							for each (let c in this._conditions) {
								if (c.condition == 'libraryID' && c.operator == 'is') {
									foundLibraryID = true;
									obj = yield objectTypeClass.getByLibraryAndKeyAsync(
										c.value, objKey
									);
									if (obj) {
										break;
									}
								}
							}
							if (!foundLibraryID) {
								Zotero.debug("WARNING: libraryID condition not found for "
									+ objectType + " in search", 2);
							}
						}
						else {
							col = yield objectTypeClass.getByLibraryAndKeyAsync(
								objLibraryID, objKey
							);
						}
						if (!obj) {
							var msg = objectType.charAt(0).toUpperCase() + objectType.substr(1)
								+ " " + objKey + " specified in search not found";
							Zotero.debug(msg, 2);
							Zotero.log(msg, 'warning', 'chrome://zotero/content/xpcom/search.js');
							if (objectType == 'search') {
								continue;
							}
							obj = {
								id: 0
							};
						}
						
						if (objectType == 'collection') {
							var q = ['?'];
							var p = [obj.id];
							
							// Search descendent collections if recursive search
							if (recursive){
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
						}
						else {
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
								let subids = yield search.search();
								condSQL += subids.join();
							}
							// Otherwise just put the SQL in a subquery
							else {
								condSQL += yield search.getSQL();
								let subpar = yield search.getSQLParams();
								for (let k in subpar){
									condSQLParams.push(subpar[k]);
								}
							}
							condSQL += ")";
						}
						
						skipOperators = true;
						break;
					
					case 'itemType':
						condSQL += "itemTypeID IN (SELECT itemTypeID FROM itemTypesCombined WHERE ";
						openParens++;
						break;
					
					case 'fileTypeID':
						var ftSQL = 'SELECT mimeType FROM fileTypeMimeTypes '
							+ 'WHERE fileTypeID IN ('
							+ 'SELECT fileTypeID FROM fileTypes WHERE '
							+ 'fileTypeID=?)';
						var patterns = yield Zotero.DB.columnQueryAsync(ftSQL, { int: condition.value });
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
						condSQL += "creatorID IN (SELECT creatorID FROM creators WHERE ";
						openParens++;
						break;
					
					case 'childNote':
						condSQL += "itemID IN (SELECT parentItemID FROM "
							+ "itemNotes WHERE ";
						openParens++;
						break;
					
					case 'fulltextWord':
						condSQL += "wordID IN (SELECT wordID FROM fulltextWords "
							+ "WHERE ";
						openParens++;
						break;
					
					case 'tempTable':
						if (!condition.value.match(/^[a-zA-Z0-9]+$/)) {
							throw ("Invalid temp table '" + condition.value + "'");
						}
						condSQL += "itemID IN (SELECT id FROM " + condition.value + ")";
						skipOperators = true;
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
							var dateparts = Zotero.Date.strToDate(condition.value);
							
							// Search on SQL date -- underscore is
							// single-character wildcard
							//
							// If isBefore or isAfter, month and day fall back
							// to '00' so that a search for just a year works
							// (and no year will just not find anything)
							var sqldate = dateparts.year ?
								Zotero.Utilities.lpad(dateparts.year, '0', 4) : '____';
							sqldate += '-'
							sqldate += dateparts.month || dateparts.month === 0 ?
								Zotero.Utilities.lpad(dateparts.month + 1, '0', 2) : alt;
							sqldate += '-';
							sqldate += dateparts.day ?
								Zotero.Utilities.lpad(dateparts.day, '0', 2) : alt;
							
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
						+ "itemID IN (SELECT parentItemID FROM itemAttachments "
							+ "WHERE itemID IN (" + condSQL + ")) "
						+ "OR itemID IN (SELECT parentItemID FROM itemNotes "
							+ "WHERE itemID IN (" + condSQL + ")) ";
					var parentSQLParams = condSQLParams.concat(condSQLParams);
				}
				
				if (includeParentsAndChildren || includeChildren) {
					var childrenSQL = "SELECT itemID FROM itemAttachments WHERE "
						+ "parentItemID IN (" + condSQL + ") UNION "
						+ "SELECT itemID FROM itemNotes "
						+ "WHERE parentItemID IN (" + condSQL + ")";
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
	this._sqlParams = sqlParams.length ? sqlParams : false;
});

Zotero.Searches = new function(){
	Zotero.DataObjects.apply(this, ['search', 'searches', 'savedSearch', 'savedSearches']);
	this.constructor.prototype = new Zotero.DataObjects();
	
	Object.defineProperty(this, "_primaryDataSQLParts", {
		get: function () {
			return _primaryDataSQLParts ?  _primaryDataSQLParts : (_primaryDataSQLParts = {
				savedSearchID: "O.savedSearchID",
				name: "O.savedSearchName",
				libraryID: "O.libraryID",
				key: "O.key",
				version: "O.version",
				synced: "O.synced"
			});
		}
	});
	
	
	var _primaryDataSQLParts;
	
	
	this.init = Zotero.Promise.coroutine(function* () {
		yield this.constructor.prototype.init.apply(this);
		yield Zotero.SearchConditions.init();
	});
	
	
	/**
	 * Returns an array of Zotero.Search objects, ordered by name
	 *
	 * @param	{Integer}	[libraryID=0]
	 */
	this.getAll = Zotero.Promise.coroutine(function* (libraryID) {
		var sql = "SELECT savedSearchID AS id, savedSearchName AS name "
				+ "FROM savedSearches WHERE libraryID=?";
		sql += " ORDER BY name COLLATE NOCASE";
		var rows = yield Zotero.DB.queryAsync(sql, [libraryID ? libraryID : 0]);
		if (!rows) {
			return [];
		}
		
		// Do proper collation sort
		var collation = Zotero.getLocaleCollation();
		rows.sort(function (a, b) {
			return collation.compareString(1, a.name, b.name);
		});
		
		var searches = [];
		for (var i=0; i<rows.length; i++) {
			let search = new Zotero.Search;
			search.id = rows[i].id;
			yield search.loadPrimaryData();
			searches.push(search);
		}
		return searches;
	});
	
	
	/*
	 * Delete a given saved search from the DB
	 */
	this.erase = Zotero.Promise.coroutine(function* (ids) {
		ids = Zotero.flattenArguments(ids);
		var notifierData = {};
		
		yield Zotero.DB.executeTransaction(function* () {
			for (let i=0; i<ids.length; i++) {
				let id = ids[i];
				var search = new Zotero.Search;
				search.id = id;
				yield search.loadPrimaryData();
				yield search.loadConditions();
				notifierData[id] = { old: search.serialize() };
				
				var sql = "DELETE FROM savedSearchConditions WHERE savedSearchID=?";
				yield Zotero.DB.queryAsync(sql, id);
				
				var sql = "DELETE FROM savedSearches WHERE savedSearchID=?";
				yield Zotero.DB.queryAsync(sql, id);
			}
		});
		
		Zotero.Notifier.trigger('delete', 'search', ids, notifierData);
	});
	
	
	this.getPrimaryDataSQL = function () {
		// This should be the same as the query in Zotero.Search.loadPrimaryData(),
		// just without a specific savedSearchID
		return "SELECT "
			+ Object.keys(this._primaryDataSQLParts).map(key => this._primaryDataSQLParts[key]).join(", ") + " "
			+ "FROM savedSearches O WHERE 1";
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
	var _conditions;
	var _standardConditions;
	
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
	 *  - special (don't show in search window menu)
	 *  - template (special handling)
	 *  - noLoad (can't load from saved search)
	 */
	this.init = Zotero.Promise.coroutine(function* () {
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
				name: 'unfiled',
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
			
			{
				name: 'quicksearch-titleCreatorYear',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				noLoad: true
			},
			
			{
				name: 'quicksearch-fields',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				noLoad: true
			},
			
			{
				name: 'quicksearch-everything',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				noLoad: true
			},
			
			// Deprecated
			{
				name: 'quicksearch',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				noLoad: true
			},
			
			// Quicksearch block markers
			{
				name: 'blockStart',
				noLoad: true
			},
			
			{
				name: 'blockEnd',
				noLoad: true
			},
			
			// Shortcuts for adding collections and searches by id
			{
				name: 'collectionID',
				operators: {
					is: true,
					isNot: true
				},
				noLoad: true
			},
			
			{
				name: 'savedSearchID',
				operators: {
					is: true,
					isNot: true
				},
				noLoad: true
			},
			
			
			//
			// Standard conditions
			//
			
			// Collection id to search within
			{
				name: 'collection',
				operators: {
					is: true,
					isNot: true
				},
				table: 'collectionItems',
				field: 'collectionID'
			},
			
			// Saved search to search within
			{
				name: 'savedSearch',
				operators: {
					is: true,
					isNot: true
				},
				special: false
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
			
			// Deprecated
			{
				name: 'itemTypeID',
				operators: {
					is: true,
					isNot: true
				},
				table: 'items',
				field: 'itemTypeID',
				special: true
			},
			
			{
				name: 'itemType',
				operators: {
					is: true,
					isNot: true
				},
				table: 'items',
				field: 'typeName'
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
				field: "TRIM(firstName || ' ' || lastName)"
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
				aliases: yield Zotero.DB.columnQueryAsync("SELECT fieldName FROM fieldsCombined "
					+ "WHERE fieldName NOT IN ('accessDate', 'date', 'pages', "
					+ "'section','seriesNumber','issue')"),
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
				aliases: ['accessDate', 'date', 'dateDue', 'accepted'], // TEMP - NSF
				template: true // mark for special handling
			},
			
			{
				name: 'year',
				operators: {
					is: true,
					isNot: true,
					contains: true,
					doesNotContain: true
				},
				table: 'itemData',
				field: 'SUBSTR(value, 1, 4)',
				special: true
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
				special: true,
				noLoad: true
			},
			
			{
				name: 'key',
				operators: {
					is: true,
					isNot: true,
					beginsWith: true
				},
				table: 'items',
				field: 'key',
				special: true,
				noLoad: true
			},
			
			{
				name: 'itemID',
				operators: {
					is: true,
					isNot: true
				},
				table: 'items',
				field: 'itemID',
				special: true,
				noLoad: true
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
			},
			
			{
				name: 'tempTable',
				operators: {
					is: true
				}
			}
		];
		
		// Index conditions by name and aliases
		_conditions = {};
		for (var i in conditions) {
			_conditions[conditions[i]['name']] = conditions[i];
			if (conditions[i]['aliases']) {
				for (var j in conditions[i]['aliases']) {
					// TEMP - NSF
					switch (conditions[i]['aliases'][j]) {
						case 'dateDue':
						case 'accepted':
							if (!Zotero.ItemTypes.getID('nsfReviewer')) {
								continue;
							}
					}
					_conditions[conditions[i]['aliases'][j]] = conditions[i];
				}
			}
			_conditions[conditions[i]['name']] = conditions[i];
		}
		
		_standardConditions = [];
		
		var baseMappedFields = Zotero.ItemFields.getBaseMappedFields();
		var locale = Zotero.locale;
		
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
			
			let localized = self.getLocalizedName(i);
			// Hack to use a different name for "issue" in French locale,
			// where 'number' and 'issue' are translated the same
			// https://forums.zotero.org/discussion/14942/
			if (fieldID == 5 && locale.substr(0, 2).toLowerCase() == 'fr') {
				localized = "Num\u00E9ro (p\u00E9riodique)";
			}
			
			_standardConditions.push({
				name: i,
				localized: localized,
				operators: _conditions[i]['operators'],
				flags: _conditions[i]['flags']
			});
		}
		
		var collation = Zotero.getLocaleCollation();
		_standardConditions.sort(function(a, b) {
			return collation.compareString(1, a.localized, b.localized);
		});
	});
	
	
	/*
	 * Get condition data
	 */
	function get(condition){
		return _conditions[condition];
	}
	
	
	/*
	 * Returns array of possible conditions
	 *
	 * Does not include special conditions, only ones that would show in a drop-down list
	 */
	function getStandardConditions(){
		// TODO: return copy instead
		return _standardConditions;
	}
	
	
	/*
	 * Check if an operator is valid for a given condition
	 */
	function hasOperator(condition, operator){
		var [condition, mode] = this.parseCondition(condition);
		
		if (!_conditions) {
			throw new Zotero.Exception.UnloadedDataException("Search conditions not yet loaded");
		}
		
		if (!_conditions[condition]){
			throw ("Invalid condition '" + condition + "' in hasOperator()");
		}
		
		if (!operator && typeof _conditions[condition]['operators'] == 'undefined'){
			return true;
		}
		
		return !!_conditions[condition]['operators'][operator];
	}
	
	
	function getLocalizedName(str) {
		// TEMP
		if (str == 'itemType') {
			str = 'itemTypeID';
		}
		
		try {
			return Zotero.getString('searchConditions.' + str)
		}
		catch (e) {
			return Zotero.ItemFields.getLocalizedString(null, str);
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
			if (!part || !part.length) {
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
