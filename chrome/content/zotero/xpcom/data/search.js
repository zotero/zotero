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

Zotero.Search = function(params = {}) {
	Zotero.Search._super.apply(this);
	
	this._name = null;
	
	this._scope = null;
	this._scopeIncludeChildren = null;
	this._sql = null;
	this._sqlParams = false;
	this._maxSearchConditionID = -1;
	this._conditions = {};
	this._hasPrimaryConditions = false;
	
	Zotero.Utilities.assignProps(this, params, ['name', 'libraryID']);
}

Zotero.extendClass(Zotero.DataObject, Zotero.Search);

Zotero.Search.prototype._objectType = 'search';
Zotero.Search.prototype._dataTypes = Zotero.Search._super.prototype._dataTypes.concat([
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

Zotero.defineProperty(Zotero.Search.prototype, 'id', {
	get: function() { return this._get('id'); },
	set: function(val) { return this._set('id', val); }
});
Zotero.defineProperty(Zotero.Search.prototype, 'libraryID', {
	get: function() { return this._get('libraryID'); },
	set: function(val) { return this._set('libraryID', val); }
});
Zotero.defineProperty(Zotero.Search.prototype, 'key', {
	get: function() { return this._get('key'); },
	set: function(val) { return this._set('key', val); }
});
Zotero.defineProperty(Zotero.Search.prototype, 'name', {
	get: function() { return this._get('name'); },
	set: function(val) { return this._set('name', val); }
});
Zotero.defineProperty(Zotero.Search.prototype, 'version', {
	get: function() { return this._get('version'); },
	set: function(val) { return this._set('version', val); }
});
Zotero.defineProperty(Zotero.Search.prototype, 'synced', {
	get: function() { return this._get('synced'); },
	set: function(val) { return this._set('synced', val); }
});
Zotero.defineProperty(Zotero.Search.prototype, 'conditions', {
	get: function() { return this.getConditions(); }
});
Zotero.defineProperty(Zotero.Search.prototype, '_canHaveParent', {
	value: false
});

Zotero.defineProperty(Zotero.Search.prototype, 'treeViewID', {
	get: function () {
		return "S" + this.id
	}
});

Zotero.defineProperty(Zotero.Search.prototype, 'treeViewImage', {
	get: function () {
		if (Zotero.isMac) {
			return `chrome://zotero-platform/content/treesource-search${Zotero.hiDPISuffix}.png`;
		}
		return "chrome://zotero/skin/treesource-search" + Zotero.hiDPISuffix + ".png";
	}
});

Zotero.Search.prototype.loadFromRow = function (row) {
	var primaryFields = this._ObjectsClass.primaryFields;
	for (let i=0; i<primaryFields.length; i++) {
		let col = primaryFields[i];
		try {
			var val = row[col];
		}
		catch (e) {
			Zotero.debug('Skipping missing ' + this._objectType + ' field ' + col);
			continue;
		}
		
		switch (col) {
		case this._ObjectsClass.idColumn:
			col = 'id';
			break;
		
		// Integer
		case 'libraryID':
			val = parseInt(val);
			break;
		
		// Integer or 0
		case 'version':
			val = val ? parseInt(val) : 0;
			break;
		
		// Boolean
		case 'synced':
			val = !!val;
			break;
		
		default:
			val = val || '';
		}
		
		this['_' + col] = val;
	}
	
	this._loaded.primaryData = true;
	this._clearChanged('primaryData');
	this._identified = true;
}

Zotero.Search.prototype._initSave = Zotero.Promise.coroutine(function* (env) {
	if (!this.name) {
		throw new Error('Name not provided for saved search');
	}
	return Zotero.Search._super.prototype._initSave.apply(this, arguments);
});

Zotero.Search.prototype._saveData = Zotero.Promise.coroutine(function* (env) {
	var isNew = env.isNew;
	var options = env.options;
	
	var searchID = this._id = this.id ? this.id : Zotero.ID.get('savedSearches');
	
	env.sqlColumns.push(
		'savedSearchName'
	);
	env.sqlValues.push(
		{ string: this.name }
	);
	
	if (env.sqlColumns.length) {
		if (isNew) {
			env.sqlColumns.unshift('savedSearchID');
			env.sqlValues.unshift(searchID ? { int: searchID } : null);
			
			let placeholders = env.sqlColumns.map(() => '?').join();
			let sql = "INSERT INTO savedSearches (" + env.sqlColumns.join(', ') + ") "
				+ "VALUES (" + placeholders + ")";
			yield Zotero.DB.queryAsync(sql, env.sqlValues);
		}
		else {
			let sql = 'UPDATE savedSearches SET '
				+ env.sqlColumns.map(x => x + '=?').join(', ') + ' WHERE savedSearchID=?';
			env.sqlValues.push(searchID ? { int: searchID } : null);
			yield Zotero.DB.queryAsync(sql, env.sqlValues);
		}
	}
	
	if (this._changed.conditions) {
		if (!isNew) {
			var sql = "DELETE FROM savedSearchConditions WHERE savedSearchID=?";
			yield Zotero.DB.queryAsync(sql, this.id);
		}
		
		var i = 0;
		var sql = "INSERT INTO savedSearchConditions "
			+ "(savedSearchID, searchConditionID, condition, operator, value, required) "
			+ "VALUES (?,?,?,?,?,?)";
		for (let id in this._conditions) {
			let condition = this._conditions[id];
			
			// Convert condition and mode to "condition[/mode]"
			let conditionString = condition.mode ?
				condition.condition + '/' + condition.mode :
				condition.condition
			
			var sqlParams = [
				searchID,
				i,
				conditionString,
				condition.operator ? condition.operator : null,
				condition.value ? condition.value : null,
				condition.required ? 1 : null
			];
			yield Zotero.DB.queryAsync(sql, sqlParams);
			i++;
		}
	}
});

Zotero.Search.prototype._finalizeSave = Zotero.Promise.coroutine(function* (env) {
	if (env.isNew) {
		// Update library searches status
		yield Zotero.Libraries.get(this.libraryID).updateSearches();
		
		Zotero.Notifier.queue('add', 'search', this.id, env.notifierData, env.options.notifierQueue);
	}
	else if (!env.options.skipNotifier) {
		Zotero.Notifier.queue('modify', 'search', this.id, env.notifierData, env.options.notifierQueue);
	}
	
	if (env.isNew && Zotero.Libraries.isGroupLibrary(this.libraryID)) {
		var groupID = Zotero.Groups.getGroupIDFromLibraryID(this.libraryID);
		var group = yield Zotero.Groups.get(groupID);
		group.clearSearchCache();
	}
	
	if (!env.skipCache) {
		yield this.reload();
		// If new, there's no other data we don't have, so we can mark everything as loaded
		if (env.isNew) {
			this._markAllDataTypeLoadStates(true);
		}
		this._clearChanged();
	}
	
	return env.isNew ? this.id : true;
});


Zotero.Search.prototype.clone = function (libraryID) {
	var s = new Zotero.Search();
	s.libraryID = libraryID === undefined ? this.libraryID : libraryID;
	s.fromJSON(this.toJSON());
	return s;
};


Zotero.Search.prototype._eraseData = Zotero.Promise.coroutine(function* (env) {
	Zotero.DB.requireTransaction();
	
	var sql = "DELETE FROM savedSearchConditions WHERE savedSearchID=?";
	yield Zotero.DB.queryAsync(sql, this.id);
	
	var sql = "DELETE FROM savedSearches WHERE savedSearchID=?";
	yield Zotero.DB.queryAsync(sql, this.id);
});

Zotero.Search.prototype._finalizeErase = Zotero.Promise.coroutine(function* (env) {
	yield Zotero.Search._super.prototype._finalizeErase.call(this, env);
	
	// Update library searches status
	yield Zotero.Libraries.get(this.libraryID).updateSearches();
});


Zotero.Search.prototype.addCondition = function (condition, operator, value, required) {
	this._requireData('conditions');
	
	if (!Zotero.SearchConditions.hasOperator(condition, operator)){
		let e = new Error("Invalid operator '" + operator + "' for condition " + condition);
		e.name = "ZoteroInvalidDataError";
		throw e;
	}
	
	// Shortcut to add a condition on every table -- does not return an id
	if (condition.match(/^quicksearch/)) {
		var parts = Zotero.SearchConditions.parseSearchString(value);
		
		for (let part of parts) {
			this.addCondition('blockStart');
			
			// Allow searching for exact object key
			if (operator == 'contains' && Zotero.Utilities.isValidObjectKey(part.text)) {
				this.addCondition('key', 'is', part.text, false);
			}
			
			if (condition == 'quicksearch-titleCreatorYear') {
				this.addCondition('title', operator, part.text, false);
				this.addCondition('publicationTitle', operator, part.text, false);
				this.addCondition('shortTitle', operator, part.text, false);
				this.addCondition('court', operator, part.text, false);
				this.addCondition('year', operator, part.text, false);
			}
			else {
				this.addCondition('field', operator, part.text, false);
				this.addCondition('tag', operator, part.text, false);
				this.addCondition('note', operator, part.text, false);
			}
			this.addCondition('creator', operator, part.text, false);
			
			if (condition == 'quicksearch-everything') {
				this.addCondition('annotation', operator, part.text, false);
				
				if (part.inQuotes) {
					this.addCondition('fulltextContent', operator, part.text, false);
				}
				else {
					var splits = Zotero.Fulltext.semanticSplitter(part.text);
					for (let split of splits) {
						this.addCondition('fulltextWord', operator, split, false);
					}
				}
			}
			
			this.addCondition('blockEnd');
		}
		
		if (condition == 'quicksearch-titleCreatorYear') {
			this.addCondition('noChildren', 'true');
		}
		
		return false;
	}
	// Shortcut to add a collection (which must be loaded first)
	else if (condition == 'collectionID') {
		let {libraryID, key} = Zotero.Collections.getLibraryAndKeyFromID(value);
		if (!key) {
			let msg = "Collection " + value + " not found";
			Zotero.debug(msg, 2);
			Components.utils.reportError(msg);
			return;
		}
		if (this.libraryID && libraryID != this.libraryID) {
			Zotero.logError(new Error("Collection " + value + " is in different library"));
			return;
		}
		return this.addCondition('collection', operator, key, required);
	}
	// Shortcut to add a saved search (which must be loaded first)
	else if (condition == 'savedSearchID') {
		let {libraryID, key} = Zotero.Searches.getLibraryAndKeyFromID(value);
		if (!key) {
			let msg = "Saved search " + value + " not found";
			Zotero.debug(msg, 2);
			Components.utils.reportError(msg);
			return;
		}
		if (this.libraryID && libraryID != this.libraryID) {
			Zotero.logError(new Error("Collection " + value + " is in different library"));
			return;
		}
		return this.addCondition('savedSearch', operator, key, required);
	}
	// Parse old-style collection/savedSearch conditions ('0_ABCD2345' -> 'ABCD2345')
	else if (condition == 'collection' || condition == 'savedSearch') {
		if (value.includes('_')) {
			Zotero.logError(`'condition' value '${value}' should be an object key`);
			let [_, objKey] = value.split('_');
			value = objKey;
		}
	}
	
	var searchConditionID = ++this._maxSearchConditionID;
	
	let mode;
	[condition, mode] = Zotero.SearchConditions.parseCondition(condition);
	
	if (typeof value == 'string') value = value.normalize();
	
	this._conditions[searchConditionID] = {
		id: searchConditionID,
		condition: condition,
		mode: mode,
		operator: operator,
		value: value,
		required: !!required
	};
	
	this._sql = null;
	this._sqlParams = false;
	this._markFieldChange('conditions', this._conditions);
	this._changed.conditions = true;
	
	return searchConditionID;
}


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
Zotero.Search.prototype.updateCondition = function (searchConditionID, condition, operator, value, required) {
	this._requireData('conditions');
	
	if (typeof this._conditions[searchConditionID] == 'undefined'){
		throw new Error('Invalid searchConditionID ' + searchConditionID);
	}
	
	if (!Zotero.SearchConditions.hasOperator(condition, operator)){
		let e = new Error("Invalid operator '" + operator + "' for condition " + condition);
		e.name = "ZoteroInvalidDataError";
		throw e;
	}
	
	var [condition, mode] = Zotero.SearchConditions.parseCondition(condition);
	
	if (typeof value == 'string') value = value.normalize();
	
	this._conditions[searchConditionID] = {
		id: parseInt(searchConditionID),
		condition: condition,
		mode: mode,
		operator: operator,
		value: value,
		required: !!required
	};
	
	this._sql = null;
	this._sqlParams = false;
	this._markFieldChange('conditions', this._conditions);
	this._changed.conditions = true;
}


Zotero.Search.prototype.removeCondition = function (searchConditionID) {
	this._requireData('conditions');
	
	if (typeof this._conditions[searchConditionID] == 'undefined'){
		throw new Error('Invalid searchConditionID ' + searchConditionID + ' in removeCondition()');
	}
	
	delete this._conditions[searchConditionID];
	this._maxSearchConditionID--;
	this._markFieldChange('conditions', this._conditions);
	this._changed.conditions = true;
}


/*
 * Returns an array with 'condition', 'operator', 'value', 'required'
 * for the given searchConditionID
 */
Zotero.Search.prototype.getCondition = function(searchConditionID){
	this._requireData('conditions');
	return this._conditions[searchConditionID];
}


/*
 * Returns an object of conditions/operator/value sets used in the search,
 * indexed by searchConditionID
 */
Zotero.Search.prototype.getConditions = function(){
	this._requireData('conditions');
	var conditions = {};
	for (let id in this._conditions) {
		let condition = this._conditions[id];
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
	for (let i of Object.values(this._conditions)) {
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
	
	// Mark conditions as loaded
	// TODO: Necessary?
	if (!this._identified) {
		this._requireData('conditions');
	}
	try {
		if (!this._sql){
			yield this._buildQuery();
		}
		
		// Default to 'all' mode
		var joinMode = 'all';
		
		// Set some variables for conditions to avoid further lookups
		for (let condition of Object.values(this._conditions)) {
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
			// If subsearch has post-search filter, run and insert ids into temp table
			if (this._scope.hasPostSearchFilter()) {
				var ids = yield this._scope.search();
				if (!ids) {
					return [];
				}
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
			var ids = res ? res.split(",").map(id => parseInt(id)) : [];
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
		
		// Filter results with full-text search
		//
		// If join mode ALL, return the (intersection of main and full-text word search)
		// filtered by full-text content.
		//
		// If join mode ANY or there's a quicksearch (which we assume fulltextContent is part of)
		// and the main search is filtered by other conditions, return the union of the main search
		// and (separate full-text word searches filtered by fulltext content).
		//
		// If join mode ANY or there's a quicksearch and the main search isn't filtered, return just
		// the union of (separate full-text word searches filtered by full-text content).
		var fullTextResults;
		var joinModeAny = joinMode == 'any' || hasQuicksearch;
		for (let condition of Object.values(this._conditions)) {
			if (condition.condition != 'fulltextContent') continue;
			
			if (!fullTextResults) {
				// For join mode ANY, if we already filtered the main set, add those as results.
				// Otherwise, start with an empty set.
				fullTextResults = joinModeAny && this._hasPrimaryConditions
					? ids
					: [];
			}
			
			let scopeIDs;
			// Regexp mode -- don't use full-text word index
			let numSplits;
			if (condition.mode && condition.mode.startsWith('regexp')) {
				// In ANY mode, include items that haven't already been found, as long as they're in
				// the right library
				if (joinModeAny) {
					let tmpTable = yield Zotero.Search.idsToTempTable(fullTextResults);
					let sql = "SELECT GROUP_CONCAT(itemID) FROM items WHERE "
						+ "itemID NOT IN (SELECT itemID FROM " + tmpTable + ")";
					if (this.libraryID) {
						sql += " AND libraryID=?";
					}
					let res = yield Zotero.DB.valueQueryAsync(sql, this.libraryID);
					scopeIDs = res ? res.split(",").map(id => parseInt(id)) : [];
					yield Zotero.DB.queryAsync("DROP TABLE " + tmpTable);
				}
				// In ALL mode, include remaining items from the main search
				else {
					scopeIDs = ids;
				}
			}
			// If not regexp mode, run a new search against the full-text word index for words in
			// this phrase
			else {
				//Zotero.debug('Running subsearch against full-text word index');
				let s = new Zotero.Search();
				if (this.libraryID) {
					s.libraryID = this.libraryID;
				}
				let splits = Zotero.Fulltext.semanticSplitter(condition.value);
				for (let split of splits){
					s.addCondition('fulltextWord', condition.operator, split);
				}
				numSplits = splits.length;
				let wordMatches = yield s.search();
				
				//Zotero.debug("Word index matches");
				//Zotero.debug(wordMatches);
				
				// In ANY mode, include hits from word index that aren't already in the results
				if (joinModeAny) {
					let resultsSet = new Set(fullTextResults);
					scopeIDs = wordMatches.filter(id => !resultsSet.has(id));
				}
				// In ALL mode, include the intersection of hits from word index and remaining
				// main search matches
				else {
					let wordIDs = new Set(wordMatches);
					scopeIDs = ids.filter(id => wordIDs.has(id));
				}
			}
			
			// If only one word, just use the results from the word index
			let filteredIDs = [];
			if (numSplits === 1) {
				filteredIDs = scopeIDs;
			}
			// Search the full-text content
			else if (scopeIDs.length) {
				let found = new Set(
					yield Zotero.Fulltext.findTextInItems(
						scopeIDs,
						condition.value,
						condition.mode
					).map(x => x.id)
				);
				// Either include or exclude the results, depending on the operator
				filteredIDs = scopeIDs.filter((id) => {
					return found.has(id)
						? condition.operator == 'contains'
						: condition.operator == 'doesNotContain';
				});
			}
			
			//Zotero.debug("Filtered IDs:")
			//Zotero.debug(filteredIDs);
			
			// If join mode ANY, add any new items from the full-text content search to the results,
			// and remove from the scope so that we don't search through items we already matched
			if (joinModeAny) {
				//Zotero.debug("Adding filtered IDs to results and removing from scope");
				fullTextResults = fullTextResults.concat(filteredIDs);
				
				let idSet = new Set(ids);
				for (let id of filteredIDs) {
					idSet.delete(id);
				}
				ids = Array.from(idSet);
			}
			else {
				//Zotero.debug("Replacing results with filtered IDs");
				ids = filteredIDs;
				fullTextResults = filteredIDs;
			}
		}
		if (fullTextResults) {
			ids = Array.from(new Set(fullTextResults));
		}
		
		if (this.hasPostSearchFilter() &&
				(includeParentsAndChildren || includeParents || includeChildren)) {
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
			var parentChildIDs = res ? res.split(",").map(id => parseInt(id)) : [];
			
			// Add parents and children to main ids
			for (let id of parentChildIDs) {
				if (!ids.includes(id)) {
					ids.push(id);
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
		return Zotero.Search.idsToTempTable(ids);
	}
	return ids;
});


/**
 * Populate the object's data from an API JSON data object
 *
 * If this object is identified (has an id or library/key), loadAll() must have been called.
 *
 * @param {Object} json
 * @param {Object} [options]
 * @param {Boolean} [options.strict = false] - Throw on unknown property
 */
Zotero.Search.prototype.fromJSON = function (json, options = {}) {
	if (options.strict) {
		for (let prop in json) {
			switch (prop) {
			case 'key':
			case 'version':
			case 'name':
			case 'conditions':
				break;
			
			default:
				let e = new Error(`Unknown search property '${prop}'`);
				e.name = "ZoteroInvalidDataError";
				throw e;
			}
		}
	}
	
	if (json.name) {
		this.name = json.name;
	}
	
	Object.keys(this.getConditions()).forEach(id => this.removeCondition(id));
	for (let i = 0; i < json.conditions.length; i++) {
		let condition = json.conditions[i];
		this.addCondition(
			condition.condition,
			condition.operator,
			condition.value
		);
	}
}


Zotero.Search.prototype.toJSON = function (options = {}) {
	var env = this._preToJSON(options);
	var mode = env.mode;
	
	var obj = env.obj = {};
	obj.key = this.key;
	obj.version = this.version;
	obj.name = this.name;
	var conditions = this.getConditions();
	obj.conditions = Object.keys(conditions)
		.map(x => ({
			condition: conditions[x].condition
				+ (conditions[x].mode !== false ? "/" + conditions[x].mode : ""),
			operator: conditions[x].operator,
			// TODO: Change joinMode to use 'is' + 'any' instead of operator 'any'?
			value: conditions[x].value ? conditions[x].value : ""
		}));
	return this._postToJSON(env);
}


/*
 * Get the SQL string for the search
 */
Zotero.Search.prototype.getSQL = Zotero.Promise.coroutine(function* () {
	if (!this._sql) {
		yield this._buildQuery();
	}
	return this._sql;
});


Zotero.Search.prototype.getSQLParams = Zotero.Promise.coroutine(function* () {
	if (!this._sql) {
		yield this._buildQuery();
	}
	return this._sqlParams;
});


/*
 * Batch insert
 */
Zotero.Search.idsToTempTable = Zotero.Promise.coroutine(function* (ids) {
	var tmpTable = "tmpSearchResults_" + Zotero.randomString(8);
	
	Zotero.debug(`Creating ${tmpTable} with ${ids.length} item${ids.length != 1 ? 's' : ''}`);
	var sql = "CREATE TEMPORARY TABLE " + tmpTable;
	if (ids.length) {
		sql += " AS "
		+ "WITH cte(itemID) AS ("
			+ "VALUES " + ids.map(id => "(" + parseInt(id) + ")").join(',')
		+ ") "
		+ "SELECT * FROM cte";
	}
	else {
		sql += " (itemID INTEGER PRIMARY KEY)";
	}
	yield Zotero.DB.queryAsync(sql, false, { debug: false });
	if (ids.length) {
		yield Zotero.DB.queryAsync(`CREATE UNIQUE INDEX ${tmpTable}_itemID ON ${tmpTable}(itemID)`);
	}
	
	return tmpTable;
});


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
	
	let lastCondition;
	for (let condition of Object.values(this._conditions)) {
		let name = condition.condition;
		let conditionData = Zotero.SearchConditions.get(name);
		
		// Has a table (or 'savedSearch', which doesn't have a table but isn't special)
		if (conditionData.table || name == 'savedSearch' || name == 'tempTable') {
			// For conditions with an inline filter using 'is'/'isNot', combine with last condition
			// if the same
			if (lastCondition
					&& ((!lastCondition.alias && !condition.alias && name == lastCondition.name)
						|| (lastCondition.alias && condition.alias && lastCondition.alias == condition.alias))
					&& condition.operator.startsWith('is')
					&& condition.operator == lastCondition.operator
					&& conditionData.inlineFilter) {
				if (!Array.isArray(lastCondition.value)) {
					lastCondition.value = [lastCondition.value];
				}
				lastCondition.value.push(condition.value);
				continue;
			}
			
			lastCondition = {
				name: conditionData.name,
				alias: conditionData.name != name ? name : false,
				table: conditionData.table,
				field: conditionData.field,
				operator: condition.operator,
				value: condition.value,
				flags: conditionData.flags,
				required: condition.required,
				inlineFilter: conditionData.inlineFilter
			};
			conditions.push(lastCondition);
			
			this._hasPrimaryConditions = true;
		}
		
		// Handle special conditions
		else {
			switch (conditionData.name) {
				case 'deleted':
					var deleted = condition.operator == 'true';
					continue;
				
				case 'noChildren':
					var noChildren = condition.operator == 'true';
					continue;
				
				case 'includeParentsAndChildren':
					var includeParentsAndChildren = condition.operator == 'true';
					continue;
					
				case 'includeParents':
					var includeParents = condition.operator == 'true';
					continue;
				
				case 'includeChildren':
					var includeChildren = condition.operator == 'true';
					continue;
				
				case 'unfiled':
					var unfiled = condition.operator == 'true';
					continue;
				
				case 'retracted':
					var retracted = condition.operator == 'true';
					continue;
				
				case 'publications':
					var publications = condition.operator == 'true';
					continue;
				
				// Search subcollections
				case 'recursive':
					var recursive = condition.operator == 'true';
					continue;
				
				// Join mode ('any' or 'all')
				case 'joinMode':
					var joinMode = condition.operator.toUpperCase();
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
			
			throw new Error('Unhandled special condition ' + name);
		}
	}
	
	// Exclude deleted items (and their child items) by default
	let not = deleted ? "" : "NOT ";
	let op = deleted ? "OR" : "AND";
	sql += " WHERE ("
		+ `itemID ${not} IN (SELECT itemID FROM deletedItems) `
		+ `${op} itemID ${not}IN (SELECT itemID FROM itemNotes `
				+ "WHERE parentItemID IS NOT NULL AND "
				+ "parentItemID IN (SELECT itemID FROM deletedItems)) "
		+ `${op} itemID ${not}IN (SELECT itemID FROM itemAttachments `
				+ "WHERE parentItemID IS NOT NULL AND "
				+ "parentItemID IN (SELECT itemID FROM deletedItems))"
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
			+ ") "
			// Exclude My Publications
			+ "AND itemID NOT IN (SELECT itemID FROM publicationsItems)";
	}
	
	if (retracted) {
		sql += " AND (itemID IN (SELECT itemID FROM retractedItems WHERE flag=0))";
	}
	
	if (publications) {
		sql += " AND (itemID IN (SELECT itemID FROM publicationsItems))";
	}
	
	// Limit to library search belongs to
	//
	// This is equivalent to adding libraryID as a search condition,
	// but it works with ANY
	if (this.libraryID !== null) {
		sql += " AND (itemID IN (SELECT itemID FROM items WHERE libraryID=?))";
		sqlParams.push(this.libraryID);
	}
	
	if (this._hasPrimaryConditions) {
		sql += " AND ";
		
		for (let condition of Object.values(conditions)){
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
								for (let fieldID of typeFields) {
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
							for (let fieldID of dateFields) {
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
						let objectTypeClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
						let forceNoResults = false;
						
						// libraryID assigned on search
						if (this.libraryID !== null) {
							objLibraryID = this.libraryID;
						}
						
						// If search doesn't have a libraryID, check all possible libraries
						// for the collection/search
						if (objLibraryID === undefined) {
							let foundLibraryID = false;
							for (let c of Object.values(this._conditions)) {
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
							obj = yield objectTypeClass.getByLibraryAndKeyAsync(
								objLibraryID, objKey
							);
						}
						if (obj) {
							if (objectType == 'search' && obj == this) {
								Zotero.warn(`Search "${this.name}" references itself -- skipping condition`);
								continue;
							}
						}
						else {
							let msg = objectType.charAt(0).toUpperCase() + objectType.substr(1)
								+ " " + objKey + " specified in search not found";
							Zotero.debug(msg, 2);
							Zotero.log(msg, 'warning', 'chrome://zotero/content/xpcom/search.js');
							forceNoResults = true;
						}
						
						if (forceNoResults) {
							condSQL += '0=1';
						}
						else if (objectType == 'collection') {
							let ids = [obj.id];
							
							// Search descendent collections if recursive search
							if (recursive){
								ids = ids.concat(obj.getDescendents(false, 'collection').map(d => d.id));
							}
							
							condSQL += 'collectionID IN (' + ids.join(', ') + ')';
						}
						// Saved search
						else {
							// Check if there are any post-search filters
							var hasFilter = obj.hasPostSearchFilter();
							
							// This is an ugly and inefficient way of doing a
							// subsearch, but it's necessary if there are any
							// post-search filters (e.g. fulltext scanning) in the
							// subsearch
							//
							// DEBUG: it's possible there's a query length limit here
							// or that this slows things down with large libraries
							// -- should probably use a temporary table instead
							if (hasFilter){
								let subids = yield obj.search();
								condSQL += "itemID ";
								if (condition.operator == 'isNot') {
									condSQL += "NOT ";
								}
								condSQL += "IN (" + subids.join();
							}
							// Otherwise just put the SQL in a subquery
							else {
								condSQL += "itemID ";
								if (condition.operator == 'isNot') {
									condSQL += "NOT ";
								}
								condSQL += "IN (";
								condSQL += yield obj.getSQL();
								let subpar = yield obj.getSQLParams();
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
							for (let str of patterns) {
								condSQL += 'contentType LIKE ? OR ';
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
								for (let part of parts) {
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
								// If inline filter is available, embed value directly to get around
								// the max bound parameter limit
								if (condition.inlineFilter) {
									let src = Array.isArray(condition.value)
										? condition.value : [condition.value];
									let values = [];
									
									for (let val of src) {
										val = condition.inlineFilter(val);
										if (val) {
											values.push(val);
										}
									}
									
									if (!values.length) {
										continue;
									}
									
									condSQL += values.length > 1
										? ` IN (${values.join(', ')})`
										: `=${values[0]}`;
								}
								else {
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
								}
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
