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

Zotero.Search = function (params = {}) {
	Zotero.Search._super.apply(this);
	
	this._name = null;
	
	this._scope = null;
	this._scopeIncludeChildren = null;
	this._sql = null;
	this._sqlParams = false;
	this._maxSearchConditionID = -1;
	this._conditions = {};
	this._hasPrimaryConditions = false;
	
	Zotero.Utilities.Internal.assignProps(this, params, ['name', 'libraryID']);
}

Zotero.extendClass(Zotero.DataObject, Zotero.Search);

Zotero.Search.prototype._objectType = 'search';
Zotero.Search.prototype._dataTypes = Zotero.Search._super.prototype._dataTypes.concat([
	'conditions'
]);

Zotero.Search.prototype.getID = function (){
	Zotero.debug('Zotero.Search.getName() is deprecated -- use Search.id');
	return this._id;
}

Zotero.Search.prototype.getName = function () {
	Zotero.debug('Zotero.Search.getName() is deprecated -- use Search.name');
	return this.name;
}

Zotero.Search.prototype.setName = function (val) {
	Zotero.debug('Zotero.Search.setName() is deprecated -- use Search.name');
	this.name = val;
}

Zotero.defineProperty(Zotero.Search.prototype, 'id', {
	get: function () { return this._get('id'); },
	set: function (val) { return this._set('id', val); }
});
Zotero.defineProperty(Zotero.Search.prototype, 'libraryID', {
	get: function () { return this._get('libraryID'); },
	set: function (val) { return this._set('libraryID', val); }
});
Zotero.defineProperty(Zotero.Search.prototype, 'key', {
	get: function () { return this._get('key'); },
	set: function (val) { return this._set('key', val); }
});
Zotero.defineProperty(Zotero.Search.prototype, 'name', {
	get: function () { return this._get('name'); },
	set: function (val) {
		if (!val) {
			throw new Error("Saved search name cannot be empty");
		}
		return this._set('name', val);
	}
});
Zotero.defineProperty(Zotero.Search.prototype, 'version', {
	get: function () { return this._get('version'); },
	set: function (val) { return this._set('version', val); }
});
Zotero.defineProperty(Zotero.Search.prototype, 'synced', {
	get: function () { return this._get('synced'); },
	set: function (val) { return this._set('synced', val); }
});
Zotero.defineProperty(Zotero.Search.prototype, 'conditions', {
	get: function () { return this.getConditions(); }
});
Zotero.defineProperty(Zotero.Search.prototype, 'scope', {
	get: function() { return this._scope; }
});
Zotero.defineProperty(Zotero.Search.prototype, '_canHaveParent', {
	value: false
});

Zotero.defineProperty(Zotero.Search.prototype, 'treeViewID', {
	get: function () {
		return "S" + this.id;
	}
});

Zotero.defineProperty(Zotero.Search.prototype, 'treeViewImage', {
	get: function () {
		return "chrome://zotero/skin/16/universal/saved-search.svg";
	}
});

// Properties for a search to "pretend" to be an item for trash itemTree
Object.assign(Zotero.Search.prototype, Zotero.DataObjectUtilities.itemTreeMockProperties);

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
		case 'deleted':
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

Zotero.Search.prototype._initSave = async function (env) {
	if (!this.name) {
		throw new Error('Name not provided for saved search');
	}
	return Zotero.Search._super.prototype._initSave.apply(this, arguments);
};

Zotero.Search.prototype._saveData = async function (env) {
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
			await Zotero.DB.queryAsync(sql, env.sqlValues);
		}
		else {
			let sql = 'UPDATE savedSearches SET '
				+ env.sqlColumns.map(x => x + '=?').join(', ') + ' WHERE savedSearchID=?';
			env.sqlValues.push(searchID ? { int: searchID } : null);
			await Zotero.DB.queryAsync(sql, env.sqlValues);
		}
	}
	
	if (this._changed.conditions) {
		if (!isNew) {
			var sql = "DELETE FROM savedSearchConditions WHERE savedSearchID=?";
			await Zotero.DB.queryAsync(sql, this.id);
		}
		
		var i = 0;
		var sql = "INSERT INTO savedSearchConditions "
			+ "(savedSearchID, searchConditionID, condition, operator, value) "
			+ "VALUES (?,?,?,?,?)";
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
				condition.value ? condition.value : null
			];
			await Zotero.DB.queryAsync(sql, sqlParams);
			i++;
		}
	}
	
	// Trashed status
	if (this._changedData.deleted !== undefined) {
		if (this._changedData.deleted) {
			sql = "INSERT OR IGNORE INTO deletedSearches (savedSearchID) VALUES (?)";
		}
		else {
			sql = "DELETE FROM deletedSearches WHERE savedSearchID=?";
		}
		await Zotero.DB.queryAsync(sql, searchID);
		
		this._clearChanged('deleted');
		this._markForReload('primaryData');
	}
};

Zotero.Search.prototype._finalizeSave = async function (env) {
	if (env.isNew) {
		// Update library searches status
		await Zotero.Libraries.get(this.libraryID).updateSearches();
		
		Zotero.Notifier.queue('add', 'search', this.id, env.notifierData, env.options.notifierQueue);
	}
	else if (!env.options.skipNotifier) {
		Zotero.Notifier.queue('modify', 'search', this.id, env.notifierData, env.options.notifierQueue);
	}
	
	if (!env.skipCache) {
		await this.reload();
		// If new, there's no other data we don't have, so we can mark everything as loaded
		if (env.isNew) {
			this._markAllDataTypeLoadStates(true);
		}
		this._clearChanged();
	}
	
	return env.isNew ? this.id : true;
};


Zotero.Search.prototype.clone = function (libraryID) {
	var s = new Zotero.Search();
	s.libraryID = libraryID === undefined ? this.libraryID : libraryID;
	s.fromJSON(this.toJSON());
	return s;
};


Zotero.Search.prototype._eraseData = async function (env) {
	Zotero.DB.requireTransaction();
	
	var sql = "DELETE FROM savedSearchConditions WHERE savedSearchID=?";
	await Zotero.DB.queryAsync(sql, this.id);
	
	var sql = "DELETE FROM savedSearches WHERE savedSearchID=?";
	await Zotero.DB.queryAsync(sql, this.id);
};

Zotero.Search.prototype._finalizeErase = async function (env) {
	await Zotero.Search._super.prototype._finalizeErase.call(this, env);
	
	// Update library searches status
	await Zotero.Libraries.get(this.libraryID).updateSearches();
};


Zotero.Search.prototype.addCondition = function (condition, operator, value, required) {
	this._requireData('conditions');
	
	if (required) {
		throw new Error("The 'required' parameter is no longer supported; use a condition group");
	}

	if (!Zotero.SearchConditions.hasOperator(condition, operator)){
		let e = new Error("Invalid operator '" + operator + "' for condition " + condition);
		e.name = "ZoteroInvalidDataError";
		throw e;
	}
	
	// Shortcut to add a condition on every table -- does not return an id
	if (condition.match(/^quicksearch/)) {
		var parts = Zotero.SearchConditions.parseSearchString(value);

		for (let part of parts) {
			if (condition == 'quicksearch-titleCreatorYearNote') {
				this.addCondition('note', operator, part.text, false);
				continue;
			}

			// Each word is an OR-group over the fields below
			this.addCondition('groupStart', 'true', '');
			this.addCondition('joinMode', 'any');

			// Allow searching for exact object key
			if (operator == 'contains' && Zotero.Utilities.isValidObjectKey(part.text)) {
				this.addCondition('key', 'is', part.text, false);
			}

			if (condition.startsWith('quicksearch-titleCreatorYear')) {
				this.addCondition('title', operator, part.text, false);
				this.addCondition('publicationTitle', operator, part.text, false);
				this.addCondition('shortTitle', operator, part.text, false);
				this.addCondition('court', operator, part.text, false);
				this.addCondition('year', operator, part.text, false);
				this.addCondition('citationKey', operator, part.text, false);
			}
			else {
				this.addCondition('field', operator, part.text, false);
				this.addCondition('tag', operator, part.text, false);
				this.addCondition('note', operator, part.text, false);
				this.addCondition('annotationText', operator, part.text, false);
				this.addCondition('annotationComment', operator, part.text, false);
			}
			this.addCondition('creator', operator, part.text, false);

			if (condition == 'quicksearch-everything') {
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

			this.addCondition('groupEnd', 'true', '');
		}
		
		if (condition == 'quicksearch-titleCreatorYear') {
			this.addCondition('noChildren', 'true');
		}
		else if (condition == 'quicksearch-titleCreatorYearNote') {
			this.addCondition('itemType', 'is', 'note');
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
		value: value
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
 * @return {Promise}
 */
Zotero.Search.prototype.updateCondition = function (searchConditionID, condition, operator, value, required) {
	this._requireData('conditions');
	
	if (required) {
		throw new Error("The 'required' parameter is no longer supported; use a condition group");
	}
	
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
		value: value
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
	
	searchConditionID = String(searchConditionID);
	// Decrement the id of all conditions following
	// the condition to be deleted. It ensures that
	// all conditions remain in stict arithmetic sequence and prevents
	// conditionIDs from colliding
	let conditionIDs = Object.keys(this._conditions);
	let conditionIndex = conditionIDs.indexOf(searchConditionID);
	for (let i = conditionIndex + 1; i < conditionIDs.length; i++) {
		let conditionID = conditionIDs[i];
		this._conditions[conditionID - 1] = this._conditions[conditionID];
		this._conditions[conditionID - 1].id = conditionID - 1;
	}
	// After all conditions are shifted, delete the last, empty one
	delete this._conditions[this._maxSearchConditionID];
	this._maxSearchConditionID--;
	this._markFieldChange('conditions', this._conditions);
	this._changed.conditions = true;
}


/*
 * Returns an array with 'condition', 'operator', 'value'
 * for the given searchConditionID
 */
Zotero.Search.prototype.getCondition = function (searchConditionID){
	this._requireData('conditions');
	return this._conditions[searchConditionID];
}


/*
 * Returns an object of conditions/operator/value sets used in the search,
 * indexed by searchConditionID
 */
Zotero.Search.prototype.getConditions = function (){
	this._requireData('conditions');
	var conditions = {};
	for (let id in this._conditions) {
		let condition = this._conditions[id];
		conditions[id] = {
			id: id,
			condition: condition.condition,
			mode: condition.mode,
			operator: condition.operator,
			value: condition.value
		};
	}
	return conditions;
}


Zotero.Search.prototype.hasPostSearchFilter = function () {
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
Zotero.Search.prototype.search = async function (asTempTable) {
	var tmpTable;
	
	// Mark conditions as loaded
	// TODO: Necessary?
	if (!this._identified) {
		this._requireData('conditions');
	}
	try {
		// Rebuild each run when a grouped fulltextContent is materialized into the SQL, so
		// its matches reflect current full-text content rather than a cached set
		if (!this._sql || this._hasEagerFullText){
			await this._buildQuery();
		}
		
		// Set some variables for conditions to avoid further lookups
		for (let condition of Object.values(this._conditions)) {
			switch (condition.condition) {
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
			}
		}
		
		// Run a subsearch to define the superset of possible results
		if (this._scope) {
			// If subsearch has post-search filter or a recursive scope,
			// run and insert ids into temp table
			if (this._scope.hasPostSearchFilter() || this._scope._scope) {
				var ids = await this._scope.search();
				if (!ids) {
					return [];
				}
				tmpTable = await Zotero.Search.idsToTempTable(ids);
			}
			// Otherwise, just copy to temp table directly
			else {
				tmpTable = "tmpSearchResults_" + Zotero.randomString(8);
				var sql = "CREATE TEMPORARY TABLE " + tmpTable + " AS "
					+ ((await this._scope.getSQL()));
				await Zotero.DB.queryAsync(sql, await this._scope.getSQLParams(), { noCache: true });
				var sql = "CREATE INDEX " + tmpTable + "_itemID ON " + tmpTable + "(itemID)";
				await Zotero.DB.queryAsync(sql, false, { noCache: true });
			}
			
			// Search ids in temp table
			var sql = "SELECT GROUP_CONCAT(itemID) FROM items WHERE itemID IN (" + this._sql + ") "
				+ "AND ("
				+ "itemID IN (SELECT itemID FROM " + tmpTable + ")";
			
			if (this._scopeIncludeChildren) {
				sql += " OR itemID IN (SELECT itemID FROM itemAttachments"
				+ " WHERE parentItemID IN (SELECT itemID FROM " + tmpTable + ")) OR "
				+ "itemID IN (SELECT itemID FROM itemNotes"
				+ " WHERE parentItemID IN (SELECT itemID FROM " + tmpTable + "))"
				// Match annotations of attachments of top-level items in scope
				+ " OR itemID IN ( SELECT itemID FROM itemAnnotations WHERE "
				+ " parentItemID IN ( SELECT itemID FROM itemAttachments WHERE "
				+ " parentItemID IN ( SELECT itemID FROM " + tmpTable + ")))"
				// Match annotations of top-level attachments in scope
				+ " OR itemID IN (SELECT itemID FROM itemAnnotations"
				+ " WHERE parentItemID IN (SELECT itemID FROM " + tmpTable + "))";
			}
			sql += ")";
			
			var res = await Zotero.DB.valueQueryAsync(sql, this._sqlParams, { noCache: true });
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
			var ids = await Zotero.DB.columnQueryAsync(this._sql, this._sqlParams, { noCache: true });
		}
		
		//Zotero.debug('IDs from main search or subsearch: ');
		//Zotero.debug(ids);
		//Zotero.debug('Join mode: ' + this._joinMode);
		
		// Filter top-level fulltextContent conditions with a full-text search (grouped
		// ones are already in the SQL; see _buildQuery).
		//
		// If join mode ALL, return the intersection of the main search and full-text word
		// search, filtered by full-text content.
		//
		// If join mode ANY and the main search is filtered by other conditions, return the
		// union of the main search and (separate full-text word searches filtered by
		// full-text content).
		//
		// If join mode ANY and the main search isn't filtered, return just the union of
		// (separate full-text word searches filtered by full-text content).
		var fullTextResults;
		var joinModeAny = this._joinMode == 'any';
		for (let condition of Object.values(this._conditions)) {
			if (condition.condition != 'fulltextContent') continue;
			// Grouped fulltextContent is already in the SQL (materialized in _buildQuery)
			if (this._eagerFullTextConditionIDs.has(condition.id)) continue;

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
					let tmpTable = await Zotero.Search.idsToTempTable(fullTextResults);
					let sql = "SELECT GROUP_CONCAT(itemID) FROM items WHERE "
						+ "itemID NOT IN (SELECT itemID FROM " + tmpTable + ")";
					if (this.libraryID) {
						sql += " AND libraryID=?";
					}
					let res = await Zotero.DB.valueQueryAsync(sql, this.libraryID, { noCache: true });
					scopeIDs = res ? res.split(",").map(id => parseInt(id)) : [];
					await Zotero.DB.queryAsync("DROP TABLE " + tmpTable, false, { noCache: true });
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
				// If applicable, only search for words within specified scope (e.g. collection)
				if (this._scope) {
					s.setScope(this._scope, true);
				}
				numSplits = splits.length;
				let wordMatches = await s.search();
				
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
					(await Zotero.Fulltext.findTextInItems(
						scopeIDs,
						condition.value,
						condition.mode
					)).map(x => x.id)
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
			var tmpTable = await Zotero.Search.idsToTempTable(ids);
			
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
			var res = await Zotero.DB.valueQueryAsync(sql, false, { noCache: true });
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
			await Zotero.DB.queryAsync("DROP TABLE IF EXISTS " + tmpTable, false, { noCache: true });
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
};


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
			case 'deleted':
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
	
	// Remove all conditions
	while (Object.keys(this._conditions).length) {
		this.removeCondition(Object.keys(this._conditions)[0]);
	}
	for (let i = 0; i < json.conditions.length; i++) {
		let condition = json.conditions[i];
		// The obsolete `childNote` condition is replaced by `note` (see _loadConditions)
		let name = condition.condition == 'childNote' ? 'note' : condition.condition;
		this.addCondition(name, condition.operator, condition.value);
	}
	// `childNote` returned the parent of a matching child note, so seed an item result level to
	// roll the migrated `note` up to it (see _loadConditions)
	if (json.conditions.some(c => c.condition == 'childNote')) {
		this.addCondition('resultLevel', 'item');
	}

	if (json.deleted || this.deleted) {
		this.deleted = !!json.deleted;
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
Zotero.Search.prototype.getSQL = async function () {
	if (!this._sql) {
		await this._buildQuery();
	}
	return this._sql;
};


Zotero.Search.prototype.getSQLParams = async function () {
	if (!this._sql) {
		await this._buildQuery();
	}
	return this._sqlParams;
};


/*
 * Batch insert
 */
Zotero.Search.idsToTempTable = async function (ids, { idColumn = 'itemID' } = {}) {
	var tmpTable = "tmpSearchResults_" + Zotero.randomString(8);

	Zotero.debug(`Creating ${tmpTable} with ${ids.length} item${ids.length != 1 ? 's' : ''}`);
	var sql = "CREATE TEMPORARY TABLE " + tmpTable;
	if (ids.length) {
		sql += " AS "
		+ `WITH cte(${idColumn}) AS (`
			+ "VALUES " + ids.map(id => "(" + parseInt(id) + ")").join(',')
		+ ") "
		+ "SELECT * FROM cte";
	}
	else {
		sql += ` (${idColumn} INTEGER PRIMARY KEY)`;
	}
	await Zotero.DB.queryAsync(sql, false, { debug: false, noCache: true });
	if (ids.length) {
		await Zotero.DB.queryAsync(
			`CREATE UNIQUE INDEX ${tmpTable}_${idColumn} ON ${tmpTable}(${idColumn})`,
			false,
			{
				noCache: true
			}
		);
	}
	
	return tmpTable;
};


/**
 * Resolve the itemIDs in this search's library/scope whose full-text content matches `value`
 * (per `mode`). Used to materialize a fulltextContent condition that sits inside a group, so it
 * can take part in the SQL AND/OR tree (see _buildQuery). Always returns the *matching* set; the
 * caller applies IN/NOT IN for the contains/doesNotContain operator.
 */
Zotero.Search.prototype._fullTextContentMatches = async function (value, mode) {
	var scopeIDs;
	// Regexp can't use the word index, so scan every item in the library/scope
	if (mode && mode.startsWith('regexp')) {
		let s = new Zotero.Search();
		if (this.libraryID !== null) {
			s.libraryID = this.libraryID;
		}
		if (this._scope) {
			s.setScope(this._scope, true);
		}
		scopeIDs = await s.search();
	}
	// Otherwise narrow to items matching the words via the full-text word index
	else {
		let splits = Zotero.Fulltext.semanticSplitter(value);
		if (!splits.length) {
			return [];
		}
		let s = new Zotero.Search();
		if (this.libraryID !== null) {
			s.libraryID = this.libraryID;
		}
		for (let split of splits) {
			s.addCondition('fulltextWord', 'contains', split);
		}
		if (this._scope) {
			s.setScope(this._scope, true);
		}
		scopeIDs = await s.search();
		// A single word is fully resolved by the word index -- no phrase to verify
		if (splits.length == 1) {
			return scopeIDs;
		}
	}
	if (!scopeIDs.length) {
		return [];
	}
	let found = await Zotero.Fulltext.findTextInItems(scopeIDs, value, mode);
	return found.map(x => x.id);
};


/*
 * Build the SQL query for the search
 */
Zotero.Search.prototype._buildQuery = async function () {
	this._requireData('conditions');

	// fulltextContent conditions nested inside a group are materialized into the SQL tree
	// below (a plain itemID IN/NOT IN predicate) so they combine like any other condition.
	// Track them so search()'s post-filter skips them, and so the query is rebuilt each run
	// (full-text then reflects current content, as the post-filter does for top-level ones).
	this._eagerFullTextConditionIDs = new Set();
	this._hasEagerFullText = false;

	var sql = 'SELECT itemID FROM items';
	
	var sqlParams = [];

	var conditions = [];

	let lastCondition;
	// Group nesting depth as the conditions are processed, so a fulltextContent inside a
	// group can be told apart from a top-level one
	let loopDepth = 0;
	let conditionsToProcess = Object.values(this._conditions);

	// The search's top-level join mode, used by the full-text result merging in
	// search(). Per-group join modes (including nested groups) are resolved from the
	// 'joinMode' markers when the condition tree is assembled below, so the joinMode
	// conditions are left in the stream rather than spliced out here. Only the
	// top-level joinMode counts here, so skip any nested inside a group.
	this._joinMode = 'all';
	// The result level the whole search returns. A top-level 'resultLevel' condition sets it;
	// the default 'any' keeps the existing mixed-level behavior (no mapping, no
	// level constraint on the result set).
	let resultLevel = 'any';
	let groupDepth = 0;
	let foundJoinMode = false;
	for (let cond of conditionsToProcess) {
		if (cond.condition == 'groupStart') {
			groupDepth++;
		}
		else if (cond.condition == 'groupEnd') {
			groupDepth--;
		}
		else if (groupDepth == 0 && cond.condition == 'joinMode' && !foundJoinMode) {
			this._joinMode = cond.operator;
			foundJoinMode = true;
		}
		else if (groupDepth == 0 && cond.condition == 'resultLevel') {
			resultLevel = cond.operator;
		}
	}
	
	// Index-based so anyField can splice its expansion in place (see below)
	for (let conditionIndex = 0; conditionIndex < conditionsToProcess.length; conditionIndex++) {
		let condition = conditionsToProcess[conditionIndex];
		let name = condition.condition;
		let conditionData = Zotero.SearchConditions.get(name);
		
		// Has a table (or 'savedSearch'/'tempTable', which don't have a table but aren't special)
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
				inlineFilter: conditionData.inlineFilter,
				// Item level(s) this condition matches at, for cross-level mapping
				level: Zotero.Search._conditionLevel(name, conditionData)
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

				case 'includeDeleted':
					var includeDeleted = condition.operator == 'true';
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

				case 'feed':
					var feed = condition.operator == 'true';
					continue;
				
				// Search subcollections
				case 'recursive':
					var recursive = condition.operator == 'true';
					continue;
				
				case 'fulltextContent':
					// A fulltextContent inside a group -- or at the top level when a result
					// level is set -- is materialized into an itemID predicate so it joins
					// the SQL AND/OR tree and can be mapped to that level (full-text is
					// indexed per attachment). A plain top-level one with no result level is
					// left for the post-filter in search() (unchanged behavior).
					if (loopDepth > 0 || resultLevel != 'any') {
						let matchIDs = await this._fullTextContentMatches(
							condition.value, condition.mode
						);
						this._eagerFullTextConditionIDs.add(condition.id);
						this._hasEagerFullText = true;
						conditions.push({
							name: '_fulltextContentPredicate',
							operator: condition.operator,
							matchIDs,
							// Full-text content is indexed per attachment, so matches are at
							// the attachment level for cross-level mapping
							level: 'attachment'
						});
						this._hasPrimaryConditions = true;
					}
					continue;

				// Group markers, passed through to the condition tree assembled after the
				// main loop. Reset lastCondition so inline-filter merging doesn't combine
				// conditions across a group boundary.
				case 'joinMode':
					lastCondition = null;
					conditions.push({ name: 'joinMode', operator: condition.operator });
					continue;
				case 'resultLevel':
					lastCondition = null;
					conditions.push({ name: 'resultLevel', operator: condition.operator });
					continue;
				case 'groupStart':
					lastCondition = null;
					loopDepth++;
					conditions.push({ name: 'groupStart' });
					continue;
				case 'groupEnd':
					lastCondition = null;
					loopDepth--;
					conditions.push({ name: 'groupEnd' });
					continue;
				
				case 'anyField': {
					// Expand to the same field set as 'quicksearch-fields' (without key
					// detection or quoted/unquoted splitting). Done here rather than in
					// addCondition() so the expansion isn't saved in the search object.
					// Splice it in right after this condition so it's processed at the same
					// nesting depth -- "Any Field" inside a group stays in that group.
					// Always an OR-group: "Any Field" means "matches in any one of these
					// fields", correct whether the surrounding join mode is 'all' or 'any'
					// (an OR-group nested in an 'any' group flattens out).
					let op = condition.operator;
					let val = condition.value;
					conditionsToProcess.splice(conditionIndex + 1, 0,
						{ condition: 'groupStart', operator: 'true', value: '' },
						{ condition: 'joinMode', operator: 'any' },
						{ condition: 'field', operator: op, value: val },
						{ condition: 'tag', operator: op, value: val },
						{ condition: 'note', operator: op, value: val },
						{ condition: 'annotationText', operator: op, value: val },
						{ condition: 'annotationComment', operator: op, value: val },
						{ condition: 'creator', operator: op, value: val },
						{ condition: 'groupEnd', operator: 'true', value: '' }
					);
					continue;
				}
				
				case 'titleCreatorYear': {
					// Expand to the same field set as 'quicksearch-titleCreatorYear' (without
					// key detection or the top-level-only restriction, which the result level
					// now handles). Spliced in after this condition like 'anyField' above, as
					// an OR-group so it matches in any one of these fields.
					let op = condition.operator;
					let val = condition.value;
					conditionsToProcess.splice(conditionIndex + 1, 0,
						{ condition: 'groupStart', operator: 'true', value: '' },
						{ condition: 'joinMode', operator: 'any' },
						{ condition: 'title', operator: op, value: val },
						{ condition: 'publicationTitle', operator: op, value: val },
						{ condition: 'shortTitle', operator: op, value: val },
						{ condition: 'court', operator: op, value: val },
						{ condition: 'year', operator: op, value: val },
						{ condition: 'citationKey', operator: op, value: val },
						{ condition: 'creator', operator: op, value: val },
						{ condition: 'groupEnd', operator: 'true', value: '' }
					);
					continue;
				}
			}
			
			throw new Error('Unhandled special condition ' + name);
		}
	}
	
	// Exclude deleted items (and their child items) by default, unless includeDeleted is true
	if (includeDeleted) {
		sql += " WHERE 1";
	}
	else {
		let not = deleted ? "" : "NOT ";
		sql += ` WHERE (itemID ${not} IN (`
				// Deleted items
				+ "SELECT itemID FROM deletedItems "
				// Child notes of deleted items
				+ "UNION SELECT itemID FROM itemNotes "
					+ "WHERE parentItemID IS NOT NULL AND "
					+ "parentItemID IN (SELECT itemID FROM deletedItems) "
				// Child attachments of deleted items
				+ "UNION SELECT itemID FROM itemAttachments "
					+ "WHERE parentItemID IS NOT NULL AND "
					+ "parentItemID IN (SELECT itemID FROM deletedItems)"
				// Annotations of deleted attachments
				+ "UNION SELECT itemID FROM itemAnnotations "
					+ "WHERE parentItemID IN (SELECT itemID FROM deletedItems)"
				// Annotations of attachments of deleted items
				+ "UNION SELECT itemID FROM itemAnnotations "
					+ "WHERE parentItemID IN (SELECT itemID FROM itemAttachments WHERE parentItemID IN (SELECT itemID FROM deletedItems))"
			+ "))";
	}
	
	if (noChildren){
		sql += " AND (itemID NOT IN (SELECT itemID FROM itemNotes "
			+ "WHERE parentItemID IS NOT NULL) AND itemID NOT IN "
			+ "(SELECT itemID FROM itemAttachments "
			+ "WHERE parentItemID IS NOT NULL) AND itemID NOT IN "
			+ "(SELECT itemID FROM itemAnnotations "
			+ "WHERE parentItemID IS NOT NULL))";
	}
	
	if (unfiled) {
		sql += " AND (itemID NOT IN ("
			// Exclude items that belong to non-trashed collections
			+ "SELECT itemID FROM collectionItems WHERE collectionID NOT IN (SELECT collectionID FROM deletedCollections) "
			// Exclude children
			+ "UNION SELECT itemID FROM itemAttachments WHERE parentItemID IS NOT NULL "
			+ "UNION SELECT itemID FROM itemNotes WHERE parentItemID IS NOT NULL "
			+ "UNION SELECT itemID FROM itemAnnotations "
			// Exclude My Publications
			+ "UNION SELECT itemID FROM publicationsItems "
			+ "))";
	}
	
	if (retracted) {
		sql += " AND (itemID IN (SELECT itemID FROM retractedItems WHERE flag=0))";
	}
	
	if (publications) {
		sql += " AND (itemID IN (SELECT itemID FROM publicationsItems))";
	}

	if (feed) {
		sql += " AND (itemID IN (SELECT itemID FROM feedItems))";
	}
	
	// Limit to library search belongs to
	//
	// This is equivalent to adding libraryID as a search condition,
	// but it works with ANY
	if (this.libraryID !== null) {
		sql += " AND (itemID IN (SELECT itemID FROM items WHERE libraryID=?))";
		sqlParams.push(this.libraryID);
	}

	// Result level: constrain the result set to one item level. The default
	// ('any') leaves the mixed-level result unchanged.
	switch (resultLevel) {
		case 'item':
			// Top-level items only (exclude child attachments/notes and annotations)
			sql += " AND (itemID NOT IN (SELECT itemID FROM itemAttachments WHERE parentItemID IS NOT NULL) "
				+ "AND itemID NOT IN (SELECT itemID FROM itemNotes WHERE parentItemID IS NOT NULL) "
				+ "AND itemID NOT IN (SELECT itemID FROM itemAnnotations))";
			break;
		case 'attachment':
			sql += " AND (itemID IN (SELECT itemID FROM itemAttachments))";
			break;
		case 'note':
			sql += " AND (itemID IN (SELECT itemID FROM itemNotes))";
			break;
		case 'annotation':
			sql += " AND (itemID IN (SELECT itemID FROM itemAnnotations))";
			break;
	}

	if (this._hasPrimaryConditions) {
		// Each condition produces a self-contained "itemID [NOT] IN (...)" predicate.
		// Markers and predicates are collected here in document order, then assembled
		// into a (possibly nested) tree of AND/OR groups below.
		let builtConditions = [];

		for (let condition of Object.values(conditions)){
				// Group markers and per-group join modes are handled when the tree is
				// assembled, not as SQL predicates
				if (condition.name == 'groupStart') {
					builtConditions.push({ marker: 'groupStart' });
					continue;
				}
				if (condition.name == 'groupEnd') {
					builtConditions.push({ marker: 'groupEnd' });
					continue;
				}
				if (condition.name == 'joinMode') {
					builtConditions.push({ marker: 'joinMode', operator: condition.operator });
					continue;
				}
				if (condition.name == 'resultLevel') {
					builtConditions.push({ marker: 'resultLevel', operator: condition.operator });
					continue;
				}
				// A grouped fulltextContent materialized into an itemID set (above)
				if (condition.name == '_fulltextContentPredicate') {
					let sql;
					if (!condition.matchIDs.length) {
						// No matches: 'contains' matches nothing, 'doesNotContain' matches all
						sql = condition.operator == 'doesNotContain' ? '1' : '0';
					}
					else {
						let op = condition.operator == 'doesNotContain' ? 'NOT IN' : 'IN';
						sql = 'itemID ' + op + ' (' + condition.matchIDs.join(',') + ')';
					}
					builtConditions.push({ sql, params: [], level: condition.level });
					continue;
				}

				var skipOperators = false;
				var openParens = 0;
				var condSQL = '';
				var selectOpenParens = 0;
				var condSelectSQL = '';
				var condSQLParams = [];
				let forceNoResults = false;
				
				//
				// Special table handling
				//
				if (condition.table) {
					let negationOperators = ['isNot', 'doesNotContain'];
					let isNegationOperator = negationOperators.includes(condition.operator);
					
					condSelectSQL += 'itemID '
					if (isNegationOperator) {
						condSelectSQL += 'NOT ';
					}
					condSelectSQL += 'IN (';
					selectOpenParens = 1;

					// A negation matches every item that lacks the value, but only one item level
					// is a plausible match: a non-annotation condition (item metadata, tags) would
					// otherwise return nearly every annotation, and an annotation condition (text,
					// color, etc.) would return nearly every non-annotation. Exclude the wrong
					// level. When a result level is set, the result-level constraint already
					// restricts to that level (and the cross-level mapping handles negation), so
					// this only applies to the default path.
					if (isNegationOperator && resultLevel == 'any') {
						condSelectSQL += "SELECT itemID FROM items WHERE itemTypeID"
							+ (condition.level == 'annotation' ? "!=" : "=")
							+ Zotero.ItemTypes.getID('annotation') + " UNION ";
					}

					condSQL += `SELECT itemID FROM ${condition.table} WHERE (`;

					openParens = 1;
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
									obj = await objectTypeClass.getByLibraryAndKeyAsync(
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
							obj = await objectTypeClass.getByLibraryAndKeyAsync(
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
							condSQL += 'itemID IN (0)';
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
								let subids = await obj.search();
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
								condSQL += await obj.getSQL();
								let subpar = await obj.getSQLParams();
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
						var patterns = await Zotero.DB.columnQueryAsync(ftSQL, { int: condition.value });
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

					case 'author':
					case 'editor':
					case 'bookAuthor': {
						let creatorTypeID = Zotero.CreatorTypes.getID(condition.name);
						condSQL += `creatorTypeID = ${creatorTypeID} AND creatorID IN (SELECT creatorID FROM creators WHERE `;
						openParens++;
						break;
					}
					
					// The annotation's creator lives in groupItems, so restrict the annotation
					// FROM above to items created by the given user
					case 'annotationAuthor':
						condSQL += "itemID IN (SELECT itemID FROM groupItems WHERE ";
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
				}
				
				if (!skipOperators) {
					// Special handling for date fields
					//
					// Note: We assume full datetimes are already UTC and don't
					// need to be handled specially
					if ((condition.name == 'dateAdded'
							|| condition.name == 'dateModified'
							|| condition.name == 'lastRead'
							|| condition.name == 'datefield')
							&& !Zotero.Date.isSQLDateTime(condition.value)) {
						
						// TODO: document these flags
						var parseDate = null;
						var alt = null;
						var useFreeform = null;
						
						switch (condition.operator) {
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
								throw new Error('Invalid date field operator in search');
						}
						
						// Convert stored UTC dates to localtime
						//
						// It'd be nice not to deal with time zones here at all,
						// but otherwise searching for the date part of a field
						// stored as UTC that wraps midnight would be unsuccessful
						//
						// lastRead is a UNIX timestamp in seconds, so we need to
						// explicitly pass 'unixepoch'
						if (condition.name == 'lastRead') {
							condSQL += "DATE(" + condition.field + ", 'unixepoch', 'localtime')";
						}
						else if (condition.name == 'dateAdded'
									|| condition.name == 'dateModified'
									|| condition.alias == 'accessDate') {
							condSQL += "DATE(" + condition.field + ", 'localtime')";
						}
						// Only use first (SQL) part of multipart dates
						else {
							condSQL += "SUBSTR(" + condition.field + ", 1, 10)";
						}
						
						if (parseDate){
							var go = false;
							let value = condition.value;
							
							// Parse 'yesterday'/'today'/'tomorrow'
							let lc = value.toLowerCase();
							if (lc == 'yesterday' || lc == Zotero.getString('date.yesterday')) {
								value = Zotero.Date.dateToSQL(new Date(Date.now() - 1000 * 60 * 60 * 24)).substr(0, 10);
							}
							else if (lc == 'today' || lc == Zotero.getString('date.today')) {
								value = Zotero.Date.dateToSQL(new Date()).substr(0, 10);
							}
							else if (lc == 'tomorrow' || lc == Zotero.getString('date.tomorrow')) {
								value = Zotero.Date.dateToSQL(new Date(Date.now() + 1000 * 60 * 60 * 24)).substr(0, 10);
							}
							
							let dateparts = Zotero.Date.strToDate(value);
							
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
				
				if (!forceNoResults) {
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
				}
				
				condSQL = condSelectSQL + condSQL;
				
				// Close open parentheses
				for (var k=selectOpenParens; k>0; k--) {
					condSQL += ')';
				}
				
				builtConditions.push({
					sql: condSQL,
					params: condSQLParams,
					level: condition.level || 'item',
					negate: condition.operator == 'isNot' || condition.operator == 'doesNotContain'
				});
		}

		// Combine the collected predicates and group markers into a single predicate
		// (see Zotero.Search.combineConditions)
		let combined = Zotero.Search.combineConditions(builtConditions, resultLevel);
		if (combined.sql) {
			sql += " AND " + combined.sql;
			sqlParams = sqlParams.concat(combined.params);
		}
	}
	
	this._sql = sql;
	this._sqlParams = sqlParams.length ? sqlParams : false;
};


/**
 * Combine an ordered list of built condition predicates and group markers into a single SQL
 * predicate.
 *
 * Each item in `builtConditions` is either a predicate { sql, params } or a group
 * marker { marker: 'groupStart' | 'groupEnd' | 'joinMode', operator }. groupStart/groupEnd
 * delimit nested groups and a 'joinMode' marker sets its enclosing group's mode.
 *
 * For example, conditions built as
 *
 *   search.addCondition('joinMode', 'all');
 *   search.addCondition('title', 'contains', 'foo');
 *   search.addCondition('groupStart', 'true', '');
 *   search.addCondition('joinMode', 'any');
 *   search.addCondition('tag', 'is', 'x');
 *   search.addCondition('tag', 'is', 'y');
 *   search.addCondition('groupEnd', 'true', '');
 *
 * combine to "title contains 'foo' AND (tag is 'x' OR tag is 'y')". The 'true' operator on the
 * group markers is an unused placeholder -- they carry no value, but a condition's operator
 * can't be empty.
 *
 * In 'all' mode a group's children are ANDed; in 'any' mode they're ORed.
 *
 * A group may also carry a 'resultLevel' marker (a level: 'item'/'attachment'/'note'/'annotation'),
 * placed inside the group like 'joinMode'. When the result level is a descendant level of the
 * enclosing row, the group's conditions are matched against descendants and mapped up to
 * the parent (see Zotero.Search.mapPredicate) -- e.g., "the item has an annotation
 * matching these conditions".
 *
 * @param {Object[]} builtConditions
 * @param {String} [rootLevel='any'] - The result level the whole search returns ('any' leaves
 *     the mixed-level default unchanged; otherwise each condition is mapped to this level)
 * @return {{ sql: String, params: Array }} Combined predicate (sql is '' if nothing to combine)
 */
Zotero.Search.combineConditions = function (builtConditions, rootLevel = 'any') {
	let root = { children: [] };
	let groupStack = [root];
	for (let item of builtConditions) {
		let group = groupStack[groupStack.length - 1];
		if (item.marker == 'groupStart') {
			let child = { children: [] };
			group.children.push(child);
			groupStack.push(child);
		}
		else if (item.marker == 'groupEnd') {
			// Ignore an unbalanced end marker rather than popping the root
			if (groupStack.length > 1) {
				groupStack.pop();
			}
		}
		else if (item.marker == 'joinMode') {
			// First one wins, matching _buildQuery()
			if (!group.joinMode) {
				group.joinMode = item.operator;
			}
		}
		else if (item.marker == 'resultLevel') {
			group.level = item.operator;
		}
		else {
			group.children.push(item);
		}
	}

	// Reduce a group node to a single { sql, params } predicate. parentLevel is the level the
	// enclosing row is at; the root is a top-level item.
	let combineGroup = (node, parentLevel) => {
		// The level this group's children are matched at -- its own result level if set, otherwise
		// the enclosing level
		let level = node.level || parentLevel;
		let requiredParts = [];
		let requiredParams = [];
		let optionalParts = [];
		let optionalParams = [];
		for (let child of node.children) {
			let result = child.children ? combineGroup(child, level) : child;
			if (!result.sql) {
				continue;
			}
			// A leaf condition's predicate selects itemIDs at its own natural level; if that
			// differs from this group's level, map it to that level so the group's
			// children combine at a single level. Nested groups are already mapped to
			// their own level by the combineGroup() call above.
			let childSQL = result.sql;
			if (!child.children) {
				childSQL = Zotero.Search.mapPredicate(childSQL, result.level || 'item', level, result.negate);
			}
			// When mapping reduces a predicate to a constant ('0'/'1' -- e.g., a condition
			// whose level can't reach the result level), its placeholders are gone, so drop its params
			let childParams = (childSQL === '0' || childSQL === '1') ? [] : result.params;
			// Unset joinMode means the default 'all'
			if (node.joinMode != 'any') {
				requiredParts.push(childSQL);
				requiredParams = requiredParams.concat(childParams);
			}
			else {
				optionalParts.push(childSQL);
				optionalParams = optionalParams.concat(childParams);
			}
		}
		let parts = [];
		let params = [];
		if (requiredParts.length) {
			parts.push(requiredParts.join(' AND '));
			params = params.concat(requiredParams);
		}
		if (optionalParts.length) {
			parts.push(optionalParts.length > 1
				? '(' + optionalParts.join(' OR ') + ')'
				: optionalParts[0]);
			params = params.concat(optionalParams);
		}
		if (!parts.length) {
			return { sql: '', params: [] };
		}
		let sql = parts.length > 1 ? '(' + parts.join(' AND ') + ')' : parts[0];
		// Map this group to the enclosing row's level. A 'any' enclosing level (the
		// mixed-level default) has no row level of its own, so a descendant group with a result level
		// anchors to the top-level item ("the item has a descendant match").
		let target = parentLevel == 'any' ? 'item' : parentLevel;
		if (node.level && node.level != 'any' && node.level != target) {
			sql = Zotero.Search.mapPredicate(sql, node.level, target);
		}
		return {
			sql,
			// Mapping to a constant drops the placeholders, so drop the params too
			params: (sql === '0' || sql === '1') ? [] : params
		};
	};

	return combineGroup(root, rootLevel);
};


// The item hierarchy used for cross-level mapping: each child level maps to its parent
// level via (itemID -> parentItemID) in the given table. 'item' is the top level.
Zotero.Search._levelParent = {
	annotation: 'attachment',
	attachment: 'item',
	note: 'item'
};
Zotero.Search._levelChildTable = {
	annotation: 'itemAnnotations',
	attachment: 'itemAttachments',
	note: 'itemNotes'
};
// Attachments and notes can be top-level (parentItemID NULL); annotations always have a parent
Zotero.Search._levelCanBeStandalone = {
	annotation: false,
	attachment: true,
	note: true
};

/**
 * Whether `anc` is an ancestor level of `desc` in the item hierarchy (e.g., 'item' is an
 * ancestor of 'annotation'; 'attachment' is an ancestor of 'annotation'; 'note' and
 * 'annotation' are unrelated).
 */
Zotero.Search._isAncestorLevel = function (anc, desc) {
	let l = desc;
	while (l != 'item') {
		l = Zotero.Search._levelParent[l];
		if (!l) {
			return false;
		}
		if (l == anc) {
			return true;
		}
	}
	return false;
};

/**
 * The number of parent hops between two levels in either direction, or null if they're on
 * unrelated branches (e.g., note and annotation).
 */
Zotero.Search._levelDistance = function (a, b) {
	let l = a;
	let d = 0;
	while (l && l != b) {
		l = Zotero.Search._levelParent[l];
		d++;
	}
	if (l == b) {
		return d;
	}
	l = b;
	d = 0;
	while (l && l != a) {
		l = Zotero.Search._levelParent[l];
		d++;
	}
	return l == a ? d : null;
};

/**
 * Given the levels a condition matches at, return the one closest (fewest hops) to `toLevel`,
 * or null if none is related to it. Used to map a multi-level field from a single level.
 */
Zotero.Search._closestRelatedLevel = function (levels, toLevel) {
	let best = null;
	let bestDist = Infinity;
	for (let level of levels) {
		if (level == 'any') {
			continue;
		}
		let d = Zotero.Search._levelDistance(level, toLevel);
		if (d !== null && d < bestDist) {
			best = level;
			bestDist = d;
		}
	}
	return best;
};

/**
 * The item level(s) a condition matches at, for cross-level mapping. A condition
 * definition can set `level` explicitly; otherwise it defaults to the top-level item, except
 * for the few itemData fields that attachments also have (title, url, accessDate per the
 * schema), which match at either the item or the attachment level.
 */
Zotero.Search._conditionLevel = function (name, conditionData) {
	if (conditionData.level) {
		return conditionData.level;
	}
	if (conditionData.table == 'itemData') {
		let fieldID = Zotero.ItemFields.getID(name);
		if (fieldID
				&& Zotero.ItemFields.isValidForType(fieldID, Zotero.ItemTypes.getID('attachment'))) {
			return ['item', 'attachment'];
		}
	}
	return 'item';
};

/**
 * Rewrite a predicate that selects itemIDs at `fromLevel` so it instead constrains itemIDs at
 * `toLevel`, mapping through the item hierarchy:
 *
 *   - `toLevel` of 'any', or `toLevel` is one of the levels the condition matches at -- the
 *     condition natively selects rows at the result level, so it's returned unchanged (the
 *     result-level FROM filters to the right rows). This is how a multi-level field like title
 *     matches item titles at the item level and attachment titles at the attachment level.
 *   - `fromLevel` 'any' (level-agnostic, e.g., tag) -- the match rolls UP to the result level:
 *     a `toLevel` item matches if it or any descendant carries it. Up only -- a parent's tag
 *     isn't the child's. Skipped for a negated match (rolling up "isn't tagged" is ambiguous).
 *   - `toLevel` an ancestor of `fromLevel` -- "the row has a descendant matching" (map up)
 *   - `toLevel` a descendant of `fromLevel` -- "the row's ancestor matches" (map down)
 *   - unrelated branches (e.g., note vs annotation) -- nothing can satisfy both, so '0'
 *
 * @param {String} sql - A predicate in terms of the `fromLevel` itemID
 * @param {String|String[]} fromLevel - The level(s) the predicate selects ('item'/'attachment'/
 *     'note'/'annotation'/'any'); an array for a field that exists at more than one level
 * @param {String} toLevel - The level to constrain instead
 * @param {Boolean} [negated] - Whether the predicate is a negation (isNot/doesNotContain); a
 *     negated level-agnostic match is left at its own level rather than rolled up
 * @return {String} A predicate in terms of the `toLevel` itemID
 */
Zotero.Search.mapPredicate = function (sql, fromLevel, toLevel, negated = false) {
	if (toLevel == 'any') {
		return sql;
	}

	// A condition may match at more than one level (e.g., an itemData field like title, which
	// exists on both top-level items and attachments), so normalize to an array
	let fromLevels = Array.isArray(fromLevel) ? fromLevel : [fromLevel];

	if (fromLevels.length == 1 && fromLevels[0] == 'any') {
		// Level-agnostic (e.g., tag): roll a positive match up to the result level; leave a
		// negation at its carrying level (see above)
		return negated ? sql : Zotero.Search._rollUpAnyToLevel(sql, toLevel);
	}

	// The condition already selects rows at the result level (it natively matches there), so
	// the result-level FROM filters to the right rows -- no mapping needed
	if (fromLevels.includes(toLevel)) {
		return sql;
	}

	// Otherwise map from the one level in the set closest to the result level -- a
	// descendant match up or an ancestor match down. Referencing the predicate's SQL exactly
	// once keeps its bound parameters from being duplicated, so map from a single level.
	let from = Zotero.Search._closestRelatedLevel(fromLevels, toLevel);
	if (!from) {
		// No level in the set is related to the result level (e.g., note vs annotation)
		return '0';
	}

	// itemIDs at `from` matching the predicate
	let matches = `SELECT itemID FROM items WHERE ${sql}`;

	// Walk a child level up to its parent: SELECT the parentItemID of matching child rows.
	// A standalone-capable level (attachment/note) can be a top-level item itself, so map a
	// standalone row (no parent) to its own itemID rather than dropping it, matching the
	// level-agnostic roll-up in _rollUpAnyToLevel.
	let mapUp = (inner, from, to) => {
		let l = from;
		let s = inner;
		while (l != to) {
			let table = Zotero.Search._levelChildTable[l];
			let select = Zotero.Search._levelCanBeStandalone[l]
				? 'COALESCE(parentItemID, itemID)' : 'parentItemID';
			s = `SELECT ${select} FROM ${table} WHERE itemID IN (${s})`;
			l = Zotero.Search._levelParent[l];
			if (!l) {
				return null;
			}
		}
		return s;
	};

	// Walk an ancestor level down to a descendant: SELECT the child rows whose parent matches,
	// repeated for each step from `from` down to `to`
	let mapDown = (inner, from, to) => {
		let path = [];
		let l = to;
		while (l != from) {
			path.push(l);
			l = Zotero.Search._levelParent[l];
			if (!l) {
				return null;
			}
		}
		let s = inner;
		for (let i = path.length - 1; i >= 0; i--) {
			let table = Zotero.Search._levelChildTable[path[i]];
			s = `SELECT itemID FROM ${table} WHERE parentItemID IN (${s})`;
		}
		return s;
	};

	// A multi-level field (e.g. title, which exists on both the top-level item and an attachment)
	// targeting a descendant should match if *any* of those ancestor levels has the value -- an
	// annotation matches when its parent attachment OR its top-level item has the title (and a
	// snapshot's URL stays matchable at the attachment level). Map down from each such ancestor
	// and union them, testing the predicate once (a single `anc IN (...)`) so its bound parameters
	// aren't duplicated. A negation keeps the single-level behavior below.
	let ancestorLevels = fromLevels.filter(
		l => l != 'any' && Zotero.Search._isAncestorLevel(l, toLevel));
	if (!negated && ancestorLevels.length > 1) {
		// (toLevel itemID, ancestor itemID) pairs, walking from toLevel up to `anc`. A standalone
		// attachment/note has no parent, so it stands in as its own top-level item (COALESCE).
		let pairsTo = (anc) => {
			let levels = [];
			let l = toLevel;
			while (l != anc) {
				levels.push(l);
				l = Zotero.Search._levelParent[l];
			}
			let aliases = levels.map((_, i) => 't' + i);
			let fromSQL = `${Zotero.Search._levelChildTable[levels[0]]} ${aliases[0]}`;
			for (let i = 1; i < levels.length; i++) {
				fromSQL += ` JOIN ${Zotero.Search._levelChildTable[levels[i]]} ${aliases[i]}`
					+ ` ON ${aliases[i]}.itemID = ${aliases[i - 1]}.parentItemID`;
			}
			let last = aliases[aliases.length - 1];
			let lastLevel = levels[levels.length - 1];
			let ancExpr = Zotero.Search._levelCanBeStandalone[lastLevel]
				? `COALESCE(${last}.parentItemID, ${last}.itemID)`
				: `${last}.parentItemID`;
			return `SELECT ${aliases[0]}.itemID AS itemID, ${ancExpr} AS anc FROM ${fromSQL}`;
		};
		let union = ancestorLevels.map(pairsTo).join(' UNION ALL ');
		return `itemID IN (SELECT itemID FROM (${union}) WHERE anc IN (${matches}))`;
	}

	let mapped = Zotero.Search._isAncestorLevel(toLevel, from)
		? mapUp(matches, from, toLevel)
		: mapDown(matches, from, toLevel);
	if (mapped === null) {
		return '0';
	}
	return `itemID IN (${mapped})`;
};


/**
 * Roll a level-agnostic predicate (e.g., tag) up to a result level: select `toLevel` items
 * that themselves -- or any descendant -- match. Up only (an ancestor's match doesn't count).
 *
 * The predicate's own SQL is referenced exactly once (inside a subquery) so its bound
 * parameters aren't duplicated.
 *
 * @param {String} sql - A predicate in terms of an itemID at any level
 * @param {String} toLevel - 'item' / 'attachment' / 'note' / 'annotation'
 * @return {String} A predicate in terms of the `toLevel` itemID
 */
Zotero.Search._rollUpAnyToLevel = function (sql, toLevel) {
	let matches = `SELECT itemID FROM items WHERE ${sql}`;
	switch (toLevel) {
		// No descendants below these, so only a match at the level itself counts
		case 'annotation':
			return `itemID IN (SELECT itemID FROM itemAnnotations WHERE itemID IN (${matches}))`;
		case 'note':
			return `itemID IN (SELECT itemID FROM itemNotes WHERE itemID IN (${matches}))`;
		// An attachment matches if it, or one of its annotations, matches
		case 'attachment':
			return "itemID IN ("
				+ "SELECT COALESCE(att.itemID, annot.parentItemID) "
				+ `FROM (${matches}) m `
				+ "LEFT JOIN itemAttachments att ON att.itemID = m.itemID "
				+ "LEFT JOIN itemAnnotations annot ON annot.itemID = m.itemID "
				+ "WHERE att.itemID IS NOT NULL OR annot.itemID IS NOT NULL)";
		// A top-level item matches if it, or any descendant (attachment, note, or an
		// annotation of an attachment), matches
		case 'item':
		default:
			return "itemID IN ("
				+ "SELECT COALESCE(aAtt.parentItemID, att.parentItemID, note.parentItemID, m.itemID) "
				+ `FROM (${matches}) m `
				+ "LEFT JOIN itemAttachments att ON att.itemID = m.itemID AND att.parentItemID IS NOT NULL "
				+ "LEFT JOIN itemNotes note ON note.itemID = m.itemID AND note.parentItemID IS NOT NULL "
				+ "LEFT JOIN itemAnnotations annot ON annot.itemID = m.itemID "
				+ "LEFT JOIN itemAttachments aAtt ON aAtt.itemID = annot.parentItemID AND aAtt.parentItemID IS NOT NULL"
				+ ")";
	}
};
