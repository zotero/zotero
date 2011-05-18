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

Zotero.History = new function(){
	this.begin = begin;
	this.setAssociatedID = setAssociatedID;
	this.add = add;
	this.modify = modify;
	this.remove = remove;
	this.commit = commit;
	this.cancel = cancel;
	this.getPreviousEvent = getPreviousEvent;
	this.getNextEvent = getNextEvent;
	this.undo = undo;
	this.redo = redo;
	this.clear = clear;
	this.clearAfter = clearAfter;
	
	var _firstTime = true;
	var _currentID = 0;
	var _activeID;
	var _activeEvent;
	var _maxID = 0;
	
	
	/**
	* Begin a transaction set
	*
	* event: 'item-add', 'item-delete', 'item-modify', 'collection-add',
	*		'collection-modify', 'collection-delete'...
	*
	* id: An id or array of ids that will be passed to
	* 		Zotero.Notifier.trigger() on an undo or redo
	**/
	function begin(event, id){
		if (_activeID){
			throw('History transaction set already in progress');
		}
		
		// If running for the first time this session or we're in the middle of
		// the history, clear any transaction sets after the current position
		if (_firstTime || _currentID<_maxID){
			_firstTime = false;
			this.clearAfter();
		}
		
		Zotero.debug('Beginning history transaction set ' + event);
		var sql = "INSERT INTO transactionSets (event, id) VALUES "
			+ "('" + event + "', ";
		if (!id){
			sql += '0';
		}
		// If array, insert hyphen-delimited string
		else if (typeof id=='object'){
			sql += "'" + id.join('-') + "'"
		}
		else {
			sql += id;
		}
		sql += ")";
		
		Zotero.DB.beginTransaction();
		_activeID = Zotero.DB.query(sql);
		_activeEvent = event;
	}
	
	
	/**
	* Associate an id or array of ids with the transaction set --
	* 	for use if the ids weren't available at when begin() was called
	*
	* id: An id or array of ids that will be passed to
	* 		Zotero.Notifier.trigger() on an undo or redo
	**/
	function setAssociatedID(id){
		if (!_activeID){
			throw('Cannot call setAssociatedID() with no history transaction set in progress');
		}
		
		var sql = "UPDATE transactionSets SET id=";
		if (!id){
			sql += '0';
		}
		// If array, insert hyphen-delimited string
		else if (typeof id=='object'){
			sql += "'" + id.join('-') + "'"
		}
		else {
			sql += id;
		}
		sql += " WHERE transactionSetID=" + _activeID;
		Zotero.DB.query(sql);
	}
	
	
	/**
	* Add an add transaction to the current set
	*
	* Can be called before or after an INSERT statement
	*
	* key is a hyphen-delimited list of columns identifying the row
	* 		e.g. 'itemID-creatorID'
	*
	* keyValues is a hyphen-delimited list of values matching the key parts
	* 		e.g. '1-1'
	**/
	function add(table, key, keyValues){
		return _addTransaction('add', table, key, keyValues);
	}
	
	
	/**
	* Add a modify transaction to the current set
	*
	* Must be called before an UPDATE statement
	*
	* key is a hyphen-delimited list of columns identifying the row
	* 		e.g. 'itemID-creatorID'
	*
	* keyValues is an array or hyphen-delimited string of values matching
	*	the key parts (e.g. [1, 1] or '1-1')
	*
	* _field_ is optional -- otherwise all fields are saved
	**/
	function modify(table, key, keyValues, field){
		return _addTransaction('modify', table, key, keyValues, field);
	}
	
	
	/**
	* Add a remove transaction to the current set
	*
	* Must be called before a DELETE statement
	*
	* key is a hyphen-delimited list of columns identifying the row
	* 		e.g. 'itemID-creatorID'
	*
	* keyValues is a hyphen-delimited list of values matching the key parts
	* 		e.g. '1-1'
	**/
	function remove(table, key, keyValues){
		return _addTransaction('remove', table, key, keyValues);
	}
	
	
	/**
	* Commit the current transaction set
	**/
	function commit(){
		Zotero.debug('Committing history transaction set ' + _activeEvent);
		Zotero.DB.commitTransaction();
		_currentID = _activeID;
		_maxID = _activeID;
		_activeID = null;
		_activeEvent = null;
	}
	
	
	/**
	* Cancel the current transaction set
	**/
	function cancel(){
		Zotero.debug('Cancelling history transaction set ' + _activeEvent);
		Zotero.DB.rollbackTransaction();
		_activeID = null;
		_activeEvent = null;
	}
	
	
	/**
	* Get the next event to undo, or false if none
	**/
	function getPreviousEvent(){
		if (!_currentID){
			return false;
		}
		
		var sql = "SELECT event FROM transactionSets WHERE transactionSetID="
			+ _currentID;
		return Zotero.DB.valueQuery(sql);
	}
	
	
	/**
	* Get the next event to redo, or false if none
	**/
	function getNextEvent(){
		var sql = "SELECT event FROM transactionSets WHERE transactionSetID="
			+ (_currentID + 1);
		return Zotero.DB.valueQuery(sql);
	}
	
	
	/**
	* Undo the last transaction set
	**/
	function undo(){
		if (!_currentID){
			throw('No transaction set to undo');
			return false;
		}
		
		var id = _currentID;
		Zotero.debug('Undoing transaction set ' + id);
		Zotero.DB.beginTransaction();
		var undone = _do('undo');
		_currentID--;
		Zotero.DB.commitTransaction();
		_reloadAndNotify(id);
		return true;
	}
	
	
	/**
	* Redo the next transaction set
	**/
	function redo(){
		var id = _currentID + 1;
		Zotero.debug('Redoing transaction set ' + id);
		Zotero.DB.beginTransaction();
		var redone = _do('redo');
		_currentID++;
		Zotero.DB.commitTransaction();
		_reloadAndNotify(id, true);
		return redone;
	}
	
	
	/**
	* Clear the entire history
	**/
	function clear(){
		Zotero.DB.beginTransaction();
		Zotero.DB.query("DELETE FROM transactionSets");
		Zotero.DB.query("DELETE FROM transactions");
		Zotero.DB.query("DELETE FROM transactionLog");
		_currentID = null;
		_activeID = null;
		_activeEvent = null;
		_maxID = null;
		Zotero.DB.commitTransaction();
	}
	
	
	/**
	* Clear all transactions in history after the current one
	**/
	function clearAfter(){
		Zotero.DB.beginTransaction();
		var min = Zotero.DB.valueQuery("SELECT MIN(transactionID) FROM "
			+ "transactions WHERE transactionSetID=" + (_currentID + 1));
		
		if (!min){
			Zotero.DB.commitTransaction();
			return;
		}
		
		Zotero.DB.query("DELETE FROM transactionLog "
			+ "WHERE transactionID>=" + min);
		Zotero.DB.query("DELETE FROM transactions "
			+ "WHERE transactionID>=" + min);
		Zotero.DB.query("DELETE FROM transactionSets "
			+ "WHERE transactionSetID>" + _currentID);
		
		_maxID = _currentID;
		_activeID = null;
		Zotero.DB.commitTransaction();
		return;
	}
	
	
	//
	// Private methods
	//
	
	function _addTransaction(action, table, key, keyValues, field){
		if (!_activeID){
			throw('Cannot add history transaction with no transaction set in progress');
		}
		
		if (typeof keyValues == 'object'){
			keyValues = keyValues.join('-');
		}
		
		var contextString = table + '.' + key + '.' + keyValues;
		var context = _parseContext(contextString);
		var fromClause = _contextToSQLFrom(context);
		
		var sql = "INSERT INTO transactions (transactionSetID, context, action) "
			+ "VALUES (" + _activeID + ", '" + contextString
			+ "', '" + action + "')";
			
		var transactionID = Zotero.DB.query(sql);
		
		switch (action){
			case 'add':
				// No need to store an add, since we'll just delete it to reverse
				break;
			case 'modify':
				// Only save one field -- _do() won't know about this, but the
				// UPDATE statements on the other fields just won't do anything
				if (field){
					var sql = "INSERT INTO transactionLog SELECT " + transactionID
						+ ", '" + field + "', " + field + fromClause;
					Zotero.DB.query(sql);
					break;
				}
				// Fall through if no field specified and save all
			case 'remove':
				var cols = Zotero.DB.getColumns(table);
				for (var i in cols){
					// If column is not part of the key, log it
					if (!context['keys'].indexOf(cols[i]) === -1){
						var sql = "INSERT INTO transactionLog "
							+ "SELECT " + transactionID + ", '" + cols[i]
							+ "', " + cols[i] + fromClause;
						Zotero.DB.query(sql);
					}
				}
				break;
			default:
				Zotero.DB.rollbackTransaction();
				throw("Invalid history action '" + action + "'");
		}
	}
	
	
	function _do(mode){
		switch (mode){
			case 'undo':
				var id = _currentID;
				break;
			case 'redo':
				var id = _currentID + 1;
				break;
		}
		
		var sql = "SELECT transactionID, context, action FROM transactions "
			+ "WHERE transactionSetID=" + id;
		var transactions = Zotero.DB.query(sql);
		
		if (!transactions){
			throw('Transaction set not found for '
				+ (mode=='undo' ? 'current' : 'next') + id);
		}
		
		for (var i in transactions){
			var transactionID = transactions[i]['transactionID'];
			var context = _parseContext(transactions[i]['context']);
			
			// If in redo mode, swap 'add' and 'remove'
			if (mode=='redo'){
				switch (transactions[i]['action']){
					case 'add':
						transactions[i]['action'] = 'remove';
						break;
					case 'remove':
						transactions[i]['action'] = 'add';
						break;
				}
			}
			
			switch (transactions[i]['action']){
				case 'add':
					var fromClause = _contextToSQLFrom(context);
					
					// First, store the row we're about to delete for later redo
					var cols = Zotero.DB.getColumns(context['table']);
					for (var i in cols){
						// If column is not part of the key, log it
						if (!context['keys'].indexOf(cols[i]) === -1){
							var sql = "INSERT INTO transactionLog "
								+ "SELECT " + transactionID + ", '" + cols[i]
								+ "', " + cols[i] + fromClause;
							Zotero.DB.query(sql);
						}
					}
					
					// And delete the row
					var sql = "DELETE" + fromClause;
					Zotero.DB.query(sql);
					break;
					
				case 'modify':
					// Retrieve old values
					var sql = "SELECT field, value FROM transactionLog "
						+ "WHERE transactionID=" + transactionID;
					var oldFieldValues = Zotero.DB.query(sql);
					
					// Retrieve new values
					var sql = "SELECT *" + _contextToSQLFrom(context);
					var newValues = Zotero.DB.rowQuery(sql);
					
					// Update row with old values
					var sql = "UPDATE " + context['table'] + " SET ";
					var values = [];
					for (var i in oldFieldValues){
						sql += oldFieldValues[i]['field'] + '=?, ';
						values.push(oldFieldValues[i]['value']);
					}
					sql = sql.substr(0, sql.length-2) + _contextToSQLWhere(context);
					Zotero.DB.query(sql, values);
					
					// Update log with new values for later redo
					for (var i in newValues){
						if (context['keys'].indexOf(i) === -1){
							var sql = "UPDATE transactionLog SET "
								+ "value=? WHERE transactionID=? AND field=?";
							Zotero.DB.query(sql, [i, newValues[i], transactionID]);
						}
					}
					break;
					
				case 'remove':
					// Retrieve old values
					var sql = "SELECT field, value FROM transactionLog "
						+ "WHERE transactionID=" + transactionID;
					var oldFieldValues = Zotero.DB.query(sql);
					
					// Add key to parameters
					var fields = [], values = [], marks = [];
					for (var i=0; i<context['keys'].length; i++){
						fields.push(context['keys'][i]);
						values.push(context['values'][i]);
						marks.push('?');
					}
					
					// Add other fields to parameters
					for (var i in oldFieldValues){
						fields.push(oldFieldValues[i]['field']);
						values.push(oldFieldValues[i]['value']);
						marks.push('?');
					}
					
					// Insert old values into table
					var sql = "INSERT INTO " + context['table'] + "("
						+ fields.join() + ") VALUES (" + marks.join() + ")";
					Zotero.DB.query(sql, values);
					
					// Delete restored data from transactionLog
					var sql = "DELETE FROM transactionLog WHERE transactionID="
						+ transactionID;
					Zotero.DB.query(sql);
					break;
			}
		}
	}
	
	
	function _parseContext(context){
		var parts = context.split('.');
		var parsed = {
			table:parts[0],
			keys:parts[1].split('-'),
			values:parts[2].split('-')
		}
		if (parsed['keys'].length!=parsed['values'].length){
			throw("Different number of keys and values in _parseContext('"
				+ context + "')");
		}
		
		return parsed;
	}
	
	
	function _contextToSQLFrom(parsed){
		return " FROM " + parsed['table'] + _contextToSQLWhere(parsed);
	}
	
	
	function _contextToSQLWhere(parsed){
		var sql = " WHERE ";
		for (var i=0; i<parsed['keys'].length; i++){
			// DEBUG: type?
			sql += parsed['keys'][i] + "='" + parsed['values'][i] + "' AND ";
		}
		return sql.substr(0, sql.length-5);
	}
	
	
	/**
	* Get the ids associated with a particular transaction set
	**/
	function _getSetData(transactionSetID){
		var sql = "SELECT event, id FROM transactionSets WHERE transactionSetID="
			+ transactionSetID;
		return Zotero.DB.rowQuery(sql);
	}
	
	
	function _reloadAndNotify(transactionSetID, redo){
		var data = _getSetData(transactionSetID);
		var eventParts = data['event'].split('-'); // e.g. modify-item
		if (redo){
			switch (eventParts[0]){
				case 'add':
					eventParts[0] = 'remove';
					break;
				case 'remove':
					eventParts[0] = 'add';
					break;
			}
		}
		switch (eventParts[1]){
			case 'item':
				Zotero.Items.reload(data['id']);
				break;
		}
		
		Zotero.Notifier.trigger(eventParts[0], eventParts[1], data['id']);
	}
}
