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

// Exclusive locking mode (default) prevents access to Zotero database while Zotero is open
// and speeds up DB access (http://www.sqlite.org/pragma.html#pragma_locking_mode).
// Normal mode is more convenient for development, but risks database corruption, particularly if
// the same database is accessed simultaneously by multiple Zotero instances.
const DB_LOCK_EXCLUSIVE = true;

Zotero.DBConnection = function(dbName) {
	if (!dbName) {
		throw ('DB name not provided in Zotero.DBConnection()');
	}
	
	this.MAX_BOUND_PARAMETERS = 999;
	
	Components.utils.import("resource://gre/modules/Task.jsm", this);
	// Use the Fx24 Sqlite.jsm, because the Sqlite.jsm in Firefox 25 breaks
	// locking_mode=EXCLUSIVE with async DB access. In the Fx24 version,
	// the main-thread DB connection is still used for async access.
	//Components.utils.import("resource://gre/modules/Sqlite.jsm", this);
	Components.utils.import("resource://zotero/Sqlite.jsm", this);
	
	this.skipBackup = false;
	this.transactionVacuum = false;
	
	// JS Date
	this.__defineGetter__('transactionDate', function () {
		if (this._transactionDate) {
			this._lastTransactionDate = this._transactionDate;
			return this._transactionDate;
		}
		
		Zotero.debug("Zotero.DB.transactionDate retrieved with no transaction", 2);
		
		// Use second granularity rather than millisecond
		// for comparison purposes
		var d = new Date(Math.floor(new Date / 1000) * 1000);
		this._lastTransactionDate = d;
		return d;
	});
	// SQL DATETIME
	this.__defineGetter__('transactionDateTime', function () {
		var d = this.transactionDate;
		return Zotero.Date.dateToSQL(d, true);
	});
	// Unix timestamp
	this.__defineGetter__('transactionTimestamp', function () {
		var d = this.transactionDate;
		return Zotero.Date.toUnixTimestamp(d);
	});
	
	// Private members
	this._dbName = dbName;
	this._shutdown = false;
	this._connection = null;
	this._connectionAsync = null;
	this._transactionDate = null;
	this._lastTransactionDate = null;
	this._transactionRollback = false;
	this._transactionNestingLevel = 0;
	this._transactionWaitLevel = 0;
	this._asyncTransactionNestingLevel = 0;
	this._callbacks = {
		begin: [],
		commit: [],
		rollback: [],
		current: {
			commit: [],
			rollback: []
		}
	};
	this._dbIsCorrupt = null
	this._self = this;
}

/////////////////////////////////////////////////////////////////
//
// Public methods
//
/////////////////////////////////////////////////////////////////

/**
 * Test a read-only connection to the database, throwing any errors that occur
 *
 * @return	void
 */
Zotero.DBConnection.prototype.test = function () {
	this._getDBConnection();
}

/*
 * Run an SQL query
 *
 *  Optional _params_ is an array of bind parameters in the form
 *		[1,"hello",3] or [{'int':2},{'string':'foobar'}]
 *
 * 	Returns:
 *  	 - Associative array (similar to mysql_fetch_assoc) for SELECT's
 *	 - lastInsertId for INSERT's
 *	 - TRUE for other successful queries
 *	 - FALSE on error
 */
Zotero.DBConnection.prototype.query = function (sql,params) {
	Zotero.debug("WARNING: Zotero.DBConnection.prototype.query() is deprecated "
		+ "-- use queryAsync() instead [QUERY: " + sql + "]", 2);
	
	var db = this._getDBConnection();
	
	try {
		// Parse out the SQL command being used
		var op = sql.match(/^[^a-z]*[^ ]+/i);
		if (op) {
			op = op.toString().toLowerCase();
		}
		
		// If SELECT statement, return result
		if (op == 'select' || op == 'pragma') {
			// Until the native dataset methods work (or at least exist),
			// we build a multi-dimensional associative array manually
			
			var statement = this.getStatement(sql, params, {
				checkParams: true
			});
			
			// Get column names
			var columns = [];
			var numCols = statement.columnCount;
			for (var i=0; i<numCols; i++) {
				let colName = statement.getColumnName(i);
				columns.push(colName);
			}
			
			var dataset = [];
			while (statement.executeStep()) {
				var row = [];
				for(var i=0; i<numCols; i++) {
					row[columns[i]] = this._getTypedValue(statement, i);
				}
				dataset.push(row);
			}
			statement.finalize();
			
			return dataset.length ? dataset : false;
		}
		else {
			if (params) {
				var statement = this.getStatement(sql, params, {
					checkParams: true
				});
				statement.execute();
			}
			else {
				let sql2;
				[sql2, ] = this.parseQueryAndParams(sql, params);
				this._debug(sql2, 5);
				db.executeSimpleSQL(sql2);
			}
			
			if (op == 'insert' || op == 'replace') {
				return db.lastInsertRowID;
			}
			// DEBUG: Can't get affected rows for UPDATE or DELETE?
			else {
				return true;
			}
		}
	}
	catch (e) {
		this.checkException(e);
		
		try {
			[sql, params] = this.parseQueryAndParams(sql, params);
		}
		catch (e2) {}
		
		var dberr = (db.lastErrorString!='not an error')
			? ' [ERROR: ' + db.lastErrorString + ']' : '';
		throw new Error(e + ' [QUERY: ' + sql + ']' + dberr);
	}
}


/*
 * Query a single value and return it
 */
Zotero.DBConnection.prototype.valueQuery = function (sql,params) {
	var statement = this.getStatement(sql, params, {
		checkParams: true
	});
	
	// No rows
	if (!statement.executeStep()) {
		statement.finalize();
		return false;
	}
	
	var value = this._getTypedValue(statement, 0);
	statement.finalize();
	return value;
}


/*
 * Run a query and return the first row
 */
Zotero.DBConnection.prototype.rowQuery = function (sql,params) {
	var result = this.query(sql,params);
	if (result) {
		return result[0];
	}
}


/*
 * Run a query and return the first column as a numerically-indexed array
 */
Zotero.DBConnection.prototype.columnQuery = function (sql,params) {
	var statement = this.getStatement(sql, params, {
		checkParams: true
	});
	
	if (statement) {
		var column = new Array();
		while (statement.executeStep()) {
			column.push(this._getTypedValue(statement, 0));
		}
		statement.finalize();
		return column.length ? column : false;
	}
	return false;
}


/*
/*
 * Get a raw mozStorage statement from the DB for manual processing
 *
 * This should only be used externally for manual parameter binding for
 * large repeated queries
 *
 *  Optional _params_ is an array of bind parameters in the form
 *		[1,"hello",3] or [{'int':2},{'string':'foobar'}]
 */
Zotero.DBConnection.prototype.getStatement = function (sql, params, options) {
	var db = this._getDBConnection();
	
	// TODO: limit to Zotero.DB, not all Zotero.DBConnections?
	if (db.transactionInProgress && Zotero.waiting > this._transactionWaitLevel) {
		throw ("Cannot access database layer from a higher wait level if a transaction is open");
	}
	
	[sql, params] = this.parseQueryAndParams(sql, params, options);
	
	try {
		this._debug(sql,5);
		
		var statement = db.createStatement(sql);
	}
	catch (e) {
		var dberr = (db.lastErrorString!='not an error')
			? ' [ERROR: ' + db.lastErrorString + ']' : '';
		throw new Error(e + ' [QUERY: ' + sql + ']' + dberr);
	}
	
	var numParams = statement.parameterCount;
	
	if (params.length) {
		for (var i=0; i<params.length; i++) {
			var value = params[i];
			
			// Bind the parameter as the correct type
			switch (typeof value) {
				case 'number':
					// Store as 32-bit signed integer
					if (value <= 2147483647) {
						this._debug('Binding parameter ' + (i+1)
							+ ' of type int: ' + value, 5);
						statement.bindInt32Parameter(i, value);
					}
					// Store as 64-bit signed integer
					//
					// Note: 9007199254740992 (2^53) is JS's upper bound for decimal integers
					else {
						this._debug('Binding parameter ' + (i + 1) + ' of type int64: ' + value, 5);
						statement.bindInt64Parameter(i, value);
					}
					
					break;
					
				case 'string':
					this._debug('Binding parameter ' + (i+1)
						+ ' of type string: "' + value + '"', 5);
					statement.bindUTF8StringParameter(i, value);
					break;
					
				case 'object':
					if (value !== null) {
						let msg = 'Invalid bound parameter ' + value
							+ ' in ' + Zotero.Utilities.varDump(params)
							+ ' [QUERY: ' + sql + ']';
						Zotero.debug(msg);
						throw new Error(msg);
					}
					
					this._debug('Binding parameter ' + (i+1) + ' of type NULL', 5);
					statement.bindNullParameter(i);
					break;
			}
		}
	}
	return statement;
}


Zotero.DBConnection.prototype.getAsyncStatement = Zotero.Promise.coroutine(function* (sql) {
	var conn = yield this._getConnectionAsync();
	conn = conn._connection;
	
	// TODO: limit to Zotero.DB, not all Zotero.DBConnections?
	if (conn.transactionInProgress && Zotero.waiting > this._transactionWaitLevel) {
		throw ("Cannot access database layer from a higher wait level if a transaction is open");
	}
	
	try {
		this._debug(sql, 5);
		return conn.createAsyncStatement(sql);
	}
	catch (e) {
		var dberr = (conn.lastErrorString != 'not an error')
			? ' [ERROR: ' + conn.lastErrorString + ']' : '';
		throw new Error(e + ' [QUERY: ' + sql + ']' + dberr); 
	}
});


Zotero.DBConnection.prototype.parseQueryAndParams = function (sql, params, options) {
	// If single scalar value, wrap in an array
	if (!Array.isArray(params)) {
		if (typeof params == 'string' || typeof params == 'number' || params === null) {
			params = [params];
		}
		else {
			params = [];
		}
	}
	// Otherwise, since we might make changes, only work on a copy of the array
	else {
		params = params.concat();
	}
	
	// Find placeholders
	var placeholderRE = /\s*[=,(]\s*\?/g;
	
	if (params.length) {
		if (options && options.checkParams) {
			let matches = sql.match(placeholderRE);
			
			if (!matches) {
				throw new Error("Parameters provided for query without placeholders "
					+ "[QUERY: " + sql + "]");
			}
			else if (matches.length != params.length) {
				throw new Error("Incorrect number of parameters provided for query "
					+ "(" + params.length + ", expecting " + matches.length + ") "
					+ "[QUERY: " + sql + "]");
			}
		}
		
		// First, determine the type of query using first word
		var matches = sql.match(/^[^\s\(]*/);
		var queryMethod = matches[0].toLowerCase();
		
		// Reset lastIndex, since regexp isn't recompiled dynamically
		placeholderRE.lastIndex = 0;
		var lastNullParamIndex = -1;
		for (var i=0; i<params.length; i++) {
			if (typeof params[i] == 'boolean') {
				throw new Error("Invalid boolean parameter " + i + " '" + params[i] + "' "
					+ "[QUERY: " + sql + "]");
			}
			else if (params[i] === undefined) {
				throw new Error('Parameter ' + i + ' is undefined [QUERY: ' + sql + ']');
			}
			
			if (params[i] !== null) {
				// Force parameter type if specified
				
				// Int
				if (typeof params[i]['int'] != 'undefined') {
					params[i] = parseInt(params[i]['int']);
					if (isNaN(params[i])) {
						throw new Error("Invalid bound parameter " + i + " integer value '" + params[i] + "' "
							+ "[QUERY: " + sql + "]")
					}
				}
				// String
				else if (typeof params[i]['string'] != 'undefined') {
					params[i] = params[i]['string'] + "";
				}
				
				continue;
			}
			
			//
			// Replace NULL bound parameters with hard-coded NULLs
			//
			
			// Find index of this parameter, skipping previous ones
			do {
				var matches = placeholderRE.exec(sql);
				lastNullParamIndex++;
			}
			while (lastNullParamIndex < i);
			lastNullParamIndex = i;
			
			if (!matches) {
				throw new Error("Null parameter provided for a query without placeholders "
					+ "-- use false or undefined [QUERY: " + sql + "]");
			}
			
			if (matches[0].indexOf('=') == -1) {
				// mozStorage supports null bound parameters in value lists (e.g., "(?,?)") natively
				continue;
			}
			else if (queryMethod == 'select') {
				var repl = ' IS NULL';
			}
			else {
				var repl = '=NULL';
			}
			
			var subpos = matches.index;
			var sublen = matches[0].length;
			sql = sql.substring(0, subpos) + repl + sql.substr(subpos + sublen);
			
			//Zotero.debug("Hard-coding null bound parameter " + i);
			
			params.splice(i, 1);
			i--;
			lastNullParamIndex--;
			continue;
		}
		if (!params.length) {
			params = [];
		}
	}
	else if (options && options.checkParams && placeholderRE.test(sql)) {
		throw new Error("Parameters not provided for query containing placeholders "
			+ "[QUERY: " + sql + "]");
	}
	
	return [sql, params];
};


/**
 * Execute an asynchronous statement with previously bound parameters
 *
 * Warning: This will freeze if used with a write statement within executeTransaction()!
 *
 * @param  {mozIStorageAsyncStatement}  statement
 * @return {Promise}  Resolved on completion, rejected with a reason on error,
 *                    and progressed with a mozIStorageRow for SELECT queries
 */
Zotero.DBConnection.prototype.executeAsyncStatement = function (statement) {
	var deferred = Zotero.Promise.defer();
	statement.executeAsync({
		handleResult: function (resultSet) {
			deferred.progress(resultSet.getNextRow());
		},
		
		handleError: function (e) {
			deferred.reject(e);
		},
		
		handleCompletion: function (reason) {
			if (reason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
				deferred.reject(reason);
			}
			deferred.resolve();
		}
	});
	return deferred.promise;
}

/*
 * Only for use externally with this.getStatement()
 */
Zotero.DBConnection.prototype.getLastInsertID = function () {
	var db = this._getDBConnection();
	return db.lastInsertRowID;
}


/*
 * Only for use externally with this.getStatement()
 */
Zotero.DBConnection.prototype.getLastErrorString = function () {
	var db = this._getDBConnection();
	return db.lastErrorString;
}


Zotero.DBConnection.prototype.beginTransaction = function () {
	var db = this._getDBConnection();
	
	if (db.transactionInProgress) {
		// TODO: limit to Zotero.DB, not all Zotero.DBConnections?
		if (Zotero.waiting != this._transactionWaitLevel) {
			var msg = "Cannot start a DB transaction from a different wait level";
			Zotero.debug(msg, 2);
			throw (msg);
		}
		
		this._transactionNestingLevel++;
		this._debug('Transaction in progress -- increasing level to '
			+ this._transactionNestingLevel, 5);
	}
	else {
		this._transactionWaitLevel = Zotero.waiting;
		
		this._debug('Beginning DB transaction', 5);
		db.beginTransaction();
		
		// Set a timestamp for this transaction
		this._transactionDate = new Date(Math.floor(new Date / 1000) * 1000);
		
		// If transaction time hasn't changed since last used transaction time,
		// add a second -- this is a hack to get around a sync problem when
		// multiple sync sessions run within the same second
		if (this._lastTransactionDate &&
				this._transactionDate.getTime() <= this._lastTransactionDate.getTime()) {
			this._transactionDate = new Date(this._lastTransactionDate.getTime() + 1000)
		}
		
		// Run callbacks
		for (var i=0; i<this._callbacks.begin.length; i++) {
			if (this._callbacks.begin[i]) {
				this._callbacks.begin[i]();
			}
		}
	}
}


Zotero.DBConnection.prototype.commitTransaction = function () {
	var db = this._getDBConnection();
	
	if (this._transactionNestingLevel) {
		this._transactionNestingLevel--;
		this._debug('Decreasing transaction level to ' + this._transactionNestingLevel, 5);
	}
	else if (this._transactionRollback) {
		this._debug('Rolling back previously flagged transaction', 5);
		this.rollbackTransaction();
	}
	else {
		this._debug('Committing transaction',5);
		
		// Clear transaction time
		if (this._transactionDate) {
			this._transactionDate = null;
		}
		
		try {
			if (!db.transactionInProgress) {
				throw new Error("No transaction in progress");
			}
			
			db.commitTransaction();
			
			if (this.transactionVacuum) {
				Zotero.debug('Vacuuming database');
				db.executeSimpleSQL('VACUUM');
				this.transactionVacuum = false;
			}
			
			// Run callbacks
			for (var i=0; i<this._callbacks.commit.length; i++) {
				if (this._callbacks.commit[i]) {
					this._callbacks.commit[i]();
				}
			}
		}
		catch(e) {
			var dberr = (db.lastErrorString!='not an error')
				? ' [ERROR: ' + db.lastErrorString + ']' : '';
			throw(e + dberr);
		}
	}
}


Zotero.DBConnection.prototype.rollbackTransaction = function () {
	var db = this._getDBConnection();
	
	if (!db.transactionInProgress) {
		this._debug("Transaction is not in progress in rollbackTransaction()", 2);
		return;
	}
	
	if (this._transactionNestingLevel) {
		this._transactionNestingLevel--;
		this._transactionRollback = true;
		this._debug('Flagging nested transaction for rollback', 5);
	}
	else {
		this._debug('Rolling back transaction', 5);
		this._transactionRollback = false;
		try {
			db.rollbackTransaction();
			
			// Run callbacks
			for (var i=0; i<this._callbacks.rollback.length; i++) {
				if (this._callbacks.rollback[i]) {
					this._callbacks.rollback[i]();
				}
			}
		}
		catch(e) {
			var dberr = (db.lastErrorString!='not an error')
				? ' [ERROR: ' + db.lastErrorString + ']' : '';
			throw(e + dberr);
		}
	}
}


Zotero.DBConnection.prototype.addCallback = function (type, cb) {
	switch (type) {
		case 'begin':
		case 'commit':
		case 'rollback':
			break;
			
		default:
			throw ("Invalid callback type '" + type + "' in DB.addCallback()");
	}
	
	var id = this._callbacks[type].length;
	this._callbacks[type][id] = cb;
	return id;
}


Zotero.DBConnection.prototype.removeCallback = function (type, id) {
	switch (type) {
		case 'begin':
		case 'commit':
		case 'rollback':
			break;
			
		default:
			throw ("Invalid callback type '" + type + "' in DB.removeCallback()");
	}
	
	delete this._callbacks[type][id];
}


Zotero.DBConnection.prototype.transactionInProgress = function () {
	var db = this._getDBConnection();
	return db.transactionInProgress;
}


/**
 * Safety function used on shutdown to make sure we're not stuck in the
 * middle of a transaction
 *
 * NOTE: No longer used
 */
Zotero.DBConnection.prototype.commitAllTransactions = function () {
	if (this.transactionInProgress()) {
		var level = this._transactionNestingLevel;
		this._transactionNestingLevel = 0;
		try {
			this.commitTransaction();
		}
		catch (e) {}
		return level ? level : true;
	}
	return false;
}


/*
 * Used on shutdown to rollback all open transactions
 */
Zotero.DBConnection.prototype.rollbackAllTransactions = function () {
	if (this.transactionInProgress()) {
		var level = this._transactionNestingLevel;
		this._transactionNestingLevel = 0;
		try {
			this.rollbackTransaction();
		}
		catch (e) {}
		return level ? level : true;
	}
	return false;
}


Zotero.DBConnection.prototype.tableExists = function (table) {
	return this._getDBConnection().tableExists(table);
}


Zotero.DBConnection.prototype.getColumns = function (table) {
	try {
		var rows = this.query("PRAGMA table_info(" + table + ")");
		return [row.name for each (row in rows)];
	}
	catch (e) {
		this._debug(e,1);
		return false;
	}
}


Zotero.DBConnection.prototype.getColumnsAsync = function (table) {
	return Zotero.DB.queryAsync("PRAGMA table_info(" + table + ")")
	.then(function (rows) {
		return [row.name for each (row in rows)];
	})
	.catch(function (e) {
		this._debug(e, 1);
		return false;
	});
}


Zotero.DBConnection.prototype.getColumnHash = function (table) {
	var cols = this.getColumns(table);
	var hash = {};
	if (cols.length) {
		for (var i=0; i<cols.length; i++) {
			hash[cols[i]] = true;
		}
	}
	return hash;
}


/**
* Find the lowest unused integer >0 in a table column
*
* Note: This retrieves all the rows of the column, so it's not really
*	meant for particularly large tables.
**/
Zotero.DBConnection.prototype.getNextID = function (table, column) {
	var sql = 'SELECT ' + column + ' FROM ' + table + ' ORDER BY ' + column;
	var vals = this.columnQuery(sql);
	
	if (!vals) {
		return 1;
	}
	
	if (vals[0] === '0') {
		vals.shift();
	}
	
	for (var i=0, len=vals.length; i<len; i++) {
		if (vals[i] != i+1) {
			break;
		}
	}
	
	return i+1;
}


/**
* Find the next lowest numeric suffix for a value in table column
*
* For example, if "Untitled" and "Untitled 2" and "Untitled 4",
* returns "Untitled 3"
*
* DEBUG: doesn't work once there's an "Untitled 10"
*
* If _name_ alone is available, returns that
**/
Zotero.DBConnection.prototype.getNextName = function (libraryID, table, field, name)
{
	if (typeof name == 'undefined') {
		Zotero.debug("WARNING: The parameters of Zotero.DB.getNextName() have changed -- update your code", 2);
		[libraryID, table, field, name] = [null, libraryID, table, field];
	}
	
	var sql = "SELECT TRIM(SUBSTR(" + field + ", " + (name.length + 1) + ")) "
				+ "FROM " + table + " "
				+ "WHERE " + field + " REGEXP '^" + name + "( [0-9]+)?$' "
				+ "AND libraryID=?"
				+ " ORDER BY " + field;
	var params = [libraryID];
	var suffixes = this.columnQuery(sql, params);
	// If none found or first one has a suffix, use default name
	if (!suffixes || suffixes[0]) {
		return name;
	}
	
	suffixes.sort(function (a, b) {
		return parseInt(a) - parseInt(b);
	});
	
	var i = 1;
	while (suffixes[i] === "") {
		i++;
	}
	var num = 2;
	while (suffixes[i] == num) {
		while (suffixes[i+1] && suffixes[i] == suffixes[i+1]) {
			i++;
		}
		i++;
		num++;
	}
	return name + ' ' + num;
}


//
// Async methods
//
//
// Zotero.DB.executeTransaction(function* (conn) {
//     var created = yield Zotero.DB.queryAsync("CREATE TEMPORARY TABLE tmpFoo (foo TEXT, bar INT)");
//     
//     // created == true
//     
//     var result = yield Zotero.DB.queryAsync("INSERT INTO tmpFoo VALUES ('a', ?)", 1);
//     
//     // result == 1
//     
//     yield Zotero.DB.queryAsync("INSERT INTO tmpFoo VALUES ('b', 2)");
//     yield Zotero.DB.queryAsync("INSERT INTO tmpFoo VALUES ('c', 3)");
//     yield Zotero.DB.queryAsync("INSERT INTO tmpFoo VALUES ('d', 4)");
//     
//     var value = yield Zotero.DB.valueQueryAsync("SELECT foo FROM tmpFoo WHERE bar=?", 2);
//     
//     // value == "b"
//     
//     var vals = yield Zotero.DB.columnQueryAsync("SELECT foo FROM tmpFoo");
//     
//     // '0' => "a"
//     // '1' => "b"
//     // '2' => "c"
//     // '3' => "d"
//     
//     let rows = yield Zotero.DB.queryAsync("SELECT * FROM tmpFoo");
//     for (let i=0; i<rows.length; i++) {
//         let row = rows[i];
//         // row.foo == 'a', row.bar == 1
//         // row.foo == 'b', row.bar == 2
//         // row.foo == 'c', row.bar == 3
//         // row.foo == 'd', row.bar == 4
//     }
//     
//    return rows;
// })
// .then(function (rows) {
//     // rows == same as above
// });
//
/**
 * @param {Function} func - Generator function that yields promises,
 *                          generally from queryAsync() and similar
 * @return {Promise} - Promise for result of generator function
 */
Zotero.DBConnection.prototype.executeTransaction = function (func, options) {
	var self = this;
	
	// Set temporary options for this transaction that will be reset at the end
	var origOptions = {};
	if (options) {
		for (let option in options) {
			origOptions[option] = this[option];
			this[option] = options[option];
		}
	}
	
	return this._getConnectionAsync()
	.then(function (conn) {
		if (conn.transactionInProgress) {
			Zotero.debug("Async DB transaction in progress -- increasing level to "
				+ ++self._asyncTransactionNestingLevel, 5);
			return self.Task.spawn(func)
			.then(
				function (result) {
					if (options) {
						if (options.onCommit) {
							self._callbacks.current.commit.push(options.onCommit);
						}
						if (options.onRollback) {
							self._callbacks.current.rollback.push(options.onRollback);
						}
					}
					
					Zotero.debug("Decreasing async DB transaction level to "
						+ --self._asyncTransactionNestingLevel, 5);
					return result;
				},
				function (e) {
					Zotero.debug("Rolled back nested async DB transaction", 5);
					self._asyncTransactionNestingLevel = 0;
					throw e;
				}
			);
		}
		else {
			Zotero.debug("Beginning async DB transaction", 5);
			
			// Set a timestamp for this transaction
			self._transactionDate = new Date(Math.floor(new Date / 1000) * 1000);
			
			// Run begin callbacks
			for (var i=0; i<self._callbacks.begin.length; i++) {
				if (self._callbacks.begin[i]) {
					self._callbacks.begin[i]();
				}
			}
			return conn.executeTransaction(func)
			.then(Zotero.Promise.coroutine(function* (result) {
				Zotero.debug("Committed async DB transaction", 5);
				
				// Clear transaction time
				if (self._transactionDate) {
					self._transactionDate = null;
				}
				
				if (options) {
					// Function to run once transaction has been committed but before any
					// permanent callbacks
					if (options.onCommit) {
						self._callbacks.current.commit.push(options.onCommit);
					}
					self._callbacks.current.rollback = [];
					
					if (options.vacuumOnCommit) {
						Zotero.debug('Vacuuming database');
						yield Zotero.DB.queryAsync('VACUUM');
					}
				}
				
				// Run temporary commit callbacks
				var f;
				while (f = self._callbacks.current.commit.shift()) {
					yield Zotero.Promise.resolve(f());
				}
				
				// Run commit callbacks
				for (var i=0; i<self._callbacks.commit.length; i++) {
					if (self._callbacks.commit[i]) {
						yield self._callbacks.commit[i]();
					}
				}
				
				return result;
			}))
			.catch(Zotero.Promise.coroutine(function* (e) {
				Zotero.debug("Rolled back async DB transaction", 5);
				
				Zotero.debug(e, 1);
				
				if (options) {
					// Function to run once transaction has been committed but before any
					// permanent callbacks
					if (options.onRollback) {
						self._callbacks.current.rollback.push(options.onRollback);
					}
				}
				
				// Run temporary commit callbacks
				var f;
				while (f = self._callbacks.current.rollback.shift()) {
					yield Zotero.Promise.resolve(f());
				}
				
				// Run rollback callbacks
				for (var i=0; i<self._callbacks.rollback.length; i++) {
					if (self._callbacks.rollback[i]) {
						yield Zotero.Promise.resolve(self._callbacks.rollback[i]());
					}
				}
				
				throw e;
			}));
		}
	})
	.finally(function () {
		// Reset options back to their previous values
		if (options) {
			for (let option in options) {
				self[option] = origOptions[option];
			}
		}
	});
};


/**
 * @param {String} sql SQL statement to run
 * @param {Array|String|Integer} [params] SQL parameters to bind
 * @return {Promise|Array} A promise for an array of rows. The individual
 *                         rows are Proxy objects that return values from the
 *                         underlying mozIStorageRows based on column names.
 */
Zotero.DBConnection.prototype.queryAsync = function (sql, params, options) {
	let conn;
	let self = this;
	let onRow = null;
	return this._getConnectionAsync().
	then(function (c) {
		conn = c;
		[sql, params] = self.parseQueryAndParams(sql, params);
		if (Zotero.Debug.enabled && (!options || options.debug === undefined || options.debug === true)) {
			Zotero.debug(sql, 5);
			for each(let param in params) {
				let paramType = typeof param;
				let msg = "Binding parameter of type " + paramType + ": ";
				msg += paramType == 'string' ? "'" + param + "'" : param;
				Zotero.debug(msg, 5);
			}
		}
		if (options && options.onRow) {
			// Errors in onRow aren't shown by default, so we wrap them in a try/catch
			onRow = function (row) {
				try {
					options.onRow(row);
				}
				catch (e) {
					Zotero.debug(e, 1);
					Components.utils.reportError(e);
					throw e;
				}
			}
		}
		return conn.executeCached(sql, params, onRow);
	})
	.then(function (rows) {
		// Parse out the SQL command being used
		var op = sql.match(/^[^a-z]*[^ ]+/i);
		if (op) {
			op = op.toString().toLowerCase();
		}
		
		// If SELECT statement, return result
		if (op == 'select' || op == 'pragma') {
			if (onRow) {
				return;
			}
			// Fake an associative array with a proxy
			let handler = {
				get: function(target, name) {
					// Ignore promise check
					if (name == 'then') {
						return undefined;
					}
					
					try {
						return target.getResultByName(name);
					}
					catch (e) {
						Zotero.debug("DB column '" + name + "' not found");
						return undefined;
					}
				}
			};
			for (let i=0, len=rows.length; i<len; i++) {
				rows[i] = new Proxy(rows[i], handler);
			}
			return rows;
		}
		else {
			if (op == 'insert' || op == 'replace') {
				return conn.lastInsertRowID;
			}
			else if (op == 'create') {
				return true;
			}
			else {
				return conn.affectedRows;
			}
		}
	})
	.catch(function (e) {
		if (e.errors && e.errors[0]) {
			var eStr = e + "";
			eStr = eStr.indexOf("Error: ") == 0 ? eStr.substr(7): e;
			throw new Error(eStr + ' [QUERY: ' + sql + '] [ERROR: ' + e.errors[0].message + ']');
		}
		else {
			throw e;
		}
	});
};


/**
 * @param {String} sql  SQL statement to run
 * @param {Array|String|Integer} [params]  SQL parameters to bind
 * @return {Promise<Array|Boolean>}  A Q promise for either the value or FALSE if no result
 */
Zotero.DBConnection.prototype.valueQueryAsync = function (sql, params) {
	let self = this;
	return this._getConnectionAsync()
	.then(function (conn) {
		[sql, params] = self.parseQueryAndParams(sql, params);
		if (Zotero.Debug.enabled) {
			Zotero.debug(sql, 5);
			for each(let param in params) {
				let paramType = typeof param;
				let msg = "Binding parameter of type " + paramType + ": ";
				msg += paramType == 'string' ? "'" + param + "'" : param;
				Zotero.debug(msg, 5);
			}
		}
		return conn.executeCached(sql, params);
	})
	.then(function (rows) {
		return rows.length ? rows[0].getResultByIndex(0) : false;
	})
	.catch(function (e) {
		if (e.errors && e.errors[0]) {
			var eStr = e + "";
			eStr = eStr.indexOf("Error: ") == 0 ? eStr.substr(7): e;
			throw new Error(eStr + ' [QUERY: ' + sql + '] [ERROR: ' + e.errors[0].message + ']');
		}
		else {
			throw e;
		}
	});
};


/**
 * @param {String} sql SQL statement to run
 * @param {Array|String|Integer} [params] SQL parameters to bind
 * @return {Promise<Object>}  A promise for a proxied storage row
 */
Zotero.DBConnection.prototype.rowQueryAsync = function (sql, params) {
	return this.queryAsync(sql, params)
	.then(function (rows) {
		return rows.length ? rows[0] : false;
	});
};


/**
 * @param {String} sql SQL statement to run
 * @param {Array|String|Integer} [params] SQL parameters to bind
 * @return {Promise<Array>}  A Q promise for an array of values in the column
 */
Zotero.DBConnection.prototype.columnQueryAsync = function (sql, params) {
	let conn;
	let self = this;
	return this._getConnectionAsync().
	then(function (c) {
		conn = c;
		[sql, params] = self.parseQueryAndParams(sql, params);
		if (Zotero.Debug.enabled) {
			Zotero.debug(sql, 5);
			for each(let param in params) {
				let paramType = typeof param;
				let msg = "Binding parameter of type " + paramType + ": ";
				msg += paramType == 'string' ? "'" + param + "'" : param;
				Zotero.debug(msg, 5);
			}
		}
		return conn.executeCached(sql, params);
	})
	.then(function (rows) {
		var column = [];
		for (let i=0, len=rows.length; i<len; i++) {
			column.push(rows[i].getResultByIndex(0));
		}
		return column;
	})
	.catch(function (e) {
		if (e.errors && e.errors[0]) {
			var eStr = e + "";
			eStr = eStr.indexOf("Error: ") == 0 ? eStr.substr(7): e;
			throw new Error(eStr + ' [QUERY: ' + sql + '] [ERROR: ' + e.errors[0].message + ']');
		}
		else {
			throw e;
		}
	});
};


Zotero.DBConnection.prototype.tableExistsAsync = function (table) {
	return this._getConnectionAsync()
	.then(function () {
		var sql = "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND tbl_name=?";
		return Zotero.DB.valueQueryAsync(sql, [table]);
	})
	.then(function (count) {
		return !!count;
	});
}


/**
 * Parse SQL string and execute transaction with all statements
 *
 * @return {Promise}
 */
Zotero.DBConnection.prototype.executeSQLFile = function (sql) {
	var nonCommentRE = /^[^-]/;
	var trailingCommentRE = /^(.*?)(?:--.+)?$/;
	
	sql = sql.trim()
		// Ugly hack to parse triggers with embedded semicolons
		.replace(/;---/g, "TEMPSEMI")
		.split("\n")
		.filter(function (x) nonCommentRE.test(x))
		.map(function (x) x.match(trailingCommentRE)[1])
		.join("");
	if (sql.substr(-1) == ";") {
		sql = sql.substr(0, sql.length - 1);
	}
	
	var statements = sql.split(";")
		.map(function (x) x.replace(/TEMPSEMI/g, ";"));
	
	return this.executeTransaction(function () {
		var statement;
		while (statement = statements.shift()) {
			yield Zotero.DB.queryAsync(statement);
		}
	});
}



/**
 * Generator functions can't return values, but Task.js-style generators,
 * as used by executeTransaction(), can throw a special exception in order
 * to do so. This function throws such an exception for passed value and
 * can be used at the end of executeTransaction() to return a value to the
 * next promise handler.
 */
Zotero.DBConnection.prototype.asyncResult = function (val) {
	throw new this.Task.Result(val);
};


/*
 * Implements nsIObserver
 */
Zotero.DBConnection.prototype.observe = function(subject, topic, data) {
	switch (topic) {
		case 'idle':
			this.backupDatabase();
			break;
	}
}


Zotero.DBConnection.prototype.integrityCheck = function () {
	var ok = this.valueQuery("PRAGMA integrity_check");
	return ok == 'ok';
}


Zotero.DBConnection.prototype.checkException = function (e) {
	if (e.name && e.name == 'NS_ERROR_FILE_CORRUPTED') {
		// Write corrupt marker to data directory
		var file = Zotero.getZoteroDatabase(this._dbName, 'is.corrupt');
		Zotero.File.putContents(file, '');
		
		this._dbIsCorrupt = true;
		
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING);
		
		var index = ps.confirmEx(null,
			Zotero.getString('general.error'),
			Zotero.getString('db.dbCorrupted', this._dbName) + '\n\n' + Zotero.getString('db.dbCorrupted.restart', Zotero.appName),
			buttonFlags,
			Zotero.getString('general.restartNow'),
			Zotero.getString('general.restartLater'),
			null, null, {});
		
		if (index == 0) {
			var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
					.getService(Components.interfaces.nsIAppStartup);
			appStartup.quit(Components.interfaces.nsIAppStartup.eRestart);
			appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
		}
		
		Zotero.skipLoading = true;
		return false;
	}
	return true;
}


/**
 * Close the database
 * @param {Boolean} [permanent] If true, throw an error instead of
 *     allowing code to re-open the database again
 */
Zotero.DBConnection.prototype.closeDatabase = function (permanent) {
	if (this._connection || this._connectionAsync) {
		var deferred = Zotero.Promise.defer();
		
		Zotero.Promise.all([this._connection.asyncClose, this._connectionAsync.asyncClose])
		.then(function () {
			this._connection = undefined;
			this._connection = permanent ? false : null;
			this._connectionAsync = undefined;
			this._connectionAsync = permanent ? false : null;
		}.bind(this))
		.then(function () {
			deferred.resolve();
		});
		
		return deferred.promise;
	}
	return Zotero.Promise.resolve();
}


Zotero.DBConnection.prototype.backupDatabase = function (suffix, force) {
	if (!suffix) {
		var numBackups = Zotero.Prefs.get("backup.numBackups");
		if (numBackups < 1) {
			return false;
		}
		if (numBackups > 24) {
			numBackups = 24;
		}
	}
	
	if (Zotero.locked) {
		this._debug("Zotero is locked -- skipping backup of DB '" + this._dbName + "'", 2);
		return false;
	}
	
	if (this.transactionInProgress()) {
		//this._debug("Transaction in progress--skipping backup of DB '" + this._dbName + "'", 2);
		return false;
	}
	
	var corruptMarker = Zotero.getZoteroDatabase(this._dbName, 'is.corrupt');
	
	if (this.skipBackup || Zotero.skipLoading) {
		this._debug("Skipping backup of database '" + this._dbName + "'", 1);
		return false;
	}
	else if (this._dbIsCorrupt || corruptMarker.exists()) {
		this._debug("Database '" + this._dbName + "' is marked as corrupt--skipping backup", 1);
		return false;
	}
	
	var file = Zotero.getZoteroDatabase(this._dbName);
	
	// For standard backup, make sure last backup is old enough to replace
	if (!suffix && !force) {
		var backupFile = Zotero.getZoteroDatabase(this._dbName, 'bak');
		if (backupFile.exists()) {
			var currentDBTime = file.lastModifiedTime;
			var lastBackupTime = backupFile.lastModifiedTime;
			if (currentDBTime == lastBackupTime) {
				//Zotero.debug("Database '" + this._dbName + "' hasn't changed -- skipping backup");
				return;
			}
			
			var now = new Date();
			var intervalMinutes = Zotero.Prefs.get('backup.interval');
			var interval = intervalMinutes * 60 *  1000;
			if ((now - lastBackupTime) < interval) {
				//Zotero.debug("Last backup of database '" + this._dbName
				//	+ "' was less than " + intervalMinutes + " minutes ago -- skipping backup");
				return;
			}
		}
	}
	
	this._debug("Backing up database '" + this._dbName + "'");
	
	// Copy via a temporary file so we don't run into disk space issues
	// after deleting the old backup file
	var tmpFile = Zotero.getZoteroDatabase(this._dbName, 'tmp');
	if (tmpFile.exists()) {
		try {
			tmpFile.remove(false);
		}
		catch (e) {
			if (e.name == 'NS_ERROR_FILE_ACCESS_DENIED') {
				alert("Cannot delete " + tmpFile.leafName);
			}
			throw (e);
		}
	}
	
	// Turn off DB locking before backup and reenable after, since otherwise
	// the lock is lost
	try {
		if (DB_LOCK_EXCLUSIVE) {
			this.query("PRAGMA locking_mode=NORMAL");
		}
		
		var store = Components.classes["@mozilla.org/storage/service;1"].
			getService(Components.interfaces.mozIStorageService);
		store.backupDatabaseFile(file, tmpFile.leafName, file.parent);
	}
	catch (e) {
		Zotero.debug(e);
		Components.utils.reportError(e);
		return false;
	}
	finally {
		if (DB_LOCK_EXCLUSIVE) {
			this.query("PRAGMA locking_mode=EXCLUSIVE");
		}
	}
	
	// Opened database files can't be moved on Windows, so we have to skip
	// the extra integrity check (unless we wanted to write two copies of
	// the database, but that doesn't seem like a great idea)
	if (!Zotero.isWin) {
		try {
			var store = Components.classes["@mozilla.org/storage/service;1"].
				getService(Components.interfaces.mozIStorageService);
				
			var connection = store.openDatabase(tmpFile);
		}
		catch (e){
			this._debug("Database file '" + tmpFile.leafName + "' is corrupt--skipping backup");
			if (tmpFile.exists()) {
				tmpFile.remove(null);
			}
			return false;
		}
	}
	
	// Special backup
	if (!suffix && numBackups > 1) {
		var zdir = Zotero.getZoteroDirectory();
		
		// Remove oldest backup file
		var targetFile = Zotero.getZoteroDatabase(this._dbName, (numBackups - 1) + '.bak')
		if (targetFile.exists()) {
			targetFile.remove(false);
		}
		
		// Shift old versions up
		for (var i=(numBackups - 1); i>=1; i--) {
			var targetNum = i;
			var sourceNum = targetNum - 1;
			
			var targetFile = Zotero.getZoteroDatabase(
				this._dbName, targetNum + '.bak'
			);
			var sourceFile = Zotero.getZoteroDatabase(
				this._dbName, sourceNum ? sourceNum + '.bak' : 'bak'
			);
			
			if (!sourceFile.exists()) {
				continue;
			}
			
			Zotero.debug("Moving " + sourceFile.leafName + " to " + targetFile.leafName);
			sourceFile.moveTo(zdir, targetFile.leafName);
		}
	}
	
	var backupFile = Zotero.getZoteroDatabase(
		this._dbName, (suffix ? suffix + '.' : '') + 'bak'
	);
	
	// Remove old backup file
	if (backupFile.exists()) {
		backupFile.remove(false);
	}
	
	Zotero.debug("Backed up to " + backupFile.leafName);
	tmpFile.moveTo(tmpFile.parent, backupFile.leafName);
	
	return true;
}


/**
 * Determine the necessary data type for SQLite parameter binding
 *
 * @return	int		0 for string, 32 for int32, 64 for int64
 */
Zotero.DBConnection.prototype.getSQLDataType = function(value) {
	var strVal = value + '';
	if (strVal.match(/^[1-9]+[0-9]*$/)) {
		// These upper bounds also specified in Zotero.DB
		//
		// Store as 32-bit signed integer
		if (value <= 2147483647) {
			return 32;
		}
		// Store as 64-bit signed integer
		// 2^53 is JS's upper-bound for decimal integers
		else if (value < 9007199254740992) {
			return 64;
		}
	}
	return 0;
}


/////////////////////////////////////////////////////////////////
//
// Private methods
//
/////////////////////////////////////////////////////////////////

/*
 * Retrieve a link to the data store
 */
Zotero.DBConnection.prototype._getDBConnection = function () {
	if (this._connection) {
		return this._connection;
	} else if (this._connection === false) {
		throw new Error("Database permanently closed; not re-opening");
	}
	
	this._debug("Opening database '" + this._dbName + "'");
	
	// Get the storage service
	var store = Components.classes["@mozilla.org/storage/service;1"].
		getService(Components.interfaces.mozIStorageService);
	
	var file = Zotero.getZoteroDatabase(this._dbName);
	var backupFile = Zotero.getZoteroDatabase(this._dbName, 'bak');
	
	var fileName = this._dbName + '.sqlite';
	
	var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		.getService(Components.interfaces.nsIPromptService);
	
	catchBlock: try {
		var corruptMarker = Zotero.getZoteroDatabase(this._dbName, 'is.corrupt');
		if (corruptMarker.exists()) {
			throw({ name: 'NS_ERROR_FILE_CORRUPTED' })
		}
		this._connection = store.openDatabase(file);
	}
	catch (e) {
		if (e.name=='NS_ERROR_FILE_CORRUPTED') {
			this._debug("Database file '" + file.leafName + "' is marked as corrupted", 1);
			
			// No backup file! Eek!
			if (!backupFile.exists()) {
				this._debug("No backup file for DB '" + this._dbName + "' exists", 1);
				
				// Save damaged file if it exists
				if (file.exists()) {
					this._debug('Saving damaged DB file with .damaged extension', 1);
					var damagedFile = Zotero.getZoteroDatabase(this._dbName, 'damaged');
					Zotero.moveToUnique(file, damagedFile);
				}
				else {
					this._debug(file.leafName + " does not exist -- creating new database");
				}
				
				// Create new main database
				var file = Zotero.getZoteroDatabase(this._dbName);
				this._connection = store.openDatabase(file);
				
				if (corruptMarker.exists()) {
					corruptMarker.remove(null);
				}
				
				// FIXME: If damaged file didn't exist, it won't be saved, as the message claims
				let msg = Zotero.getString('db.dbCorruptedNoBackup', fileName);
				Zotero.debug(msg, 1);
				ps.alert(null, Zotero.getString('general.warning'), msg);
				break catchBlock;
			}
			
			// Save damaged file if it exists
			if (file.exists()) {
				this._debug('Saving damaged DB file with .damaged extension', 1);
				var damagedFile = Zotero.getZoteroDatabase(this._dbName, 'damaged');
				Zotero.moveToUnique(file, damagedFile);
			}
			else {
				this._debug(file.leafName + " does not exist");
			}
			
			// Test the backup file
			try {
				this._connection = store.openDatabase(backupFile);
			}
			// Can't open backup either
			catch (e) {
				// Create new main database
				var file = Zotero.getZoteroDatabase(this._dbName);
				this._connection = store.openDatabase(file);
				
				let msg = Zotero.getString('db.dbRestoreFailed', fileName);
				Zotero.debug(msg, 1);
				ps.alert(null, Zotero.getString('general.warning'), msg);
				
				if (corruptMarker.exists()) {
					corruptMarker.remove(null);
				}
				
				break catchBlock;
			}
			
			this._connection = undefined;
			
			// Copy backup file to main DB file
			this._debug("Restoring database '" + this._dbName + "' from backup file", 1);
			try {
				backupFile.copyTo(backupFile.parent, fileName);
			}
			catch (e) {
				// TODO: deal with low disk space
				throw (e);
			}
			
			// Open restored database
			var file = Zotero.getZoteroDirectory();
			file.append(fileName);
			this._connection = store.openDatabase(file);
			this._debug('Database restored', 1);
			// FIXME: If damaged file didn't exist, it won't be saved, as the message claims
			var msg = Zotero.getString('db.dbRestored', [
				fileName,
				Zotero.Date.getFileDateString(backupFile),
				Zotero.Date.getFileTimeString(backupFile)
			]);
			Zotero.debug(msg, 1);
			ps.alert(
				null,
				Zotero.getString('general.warning'),
				msg
			);
			
			if (corruptMarker.exists()) {
				corruptMarker.remove(null);
			}
			
			break catchBlock;
		}
		
		// Some other error that we don't yet know how to deal with
		throw (e);
	}
	
	if (DB_LOCK_EXCLUSIVE) {
		Zotero.DB.query("PRAGMA locking_mode=EXCLUSIVE");
	}
	else {
		Zotero.DB.query("PRAGMA locking_mode=NORMAL");
	}
	
	// Set page cache size to 8MB
	var pageSize = Zotero.DB.valueQuery("PRAGMA page_size");
	var cacheSize = 8192000 / pageSize;
	Zotero.DB.query("PRAGMA cache_size=" + cacheSize);
	
	// Enable foreign key checks
	Zotero.DB.query("PRAGMA foreign_keys=1");
	
	// Register idle and shutdown handlers to call this.observe() for DB backup
	var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
			.getService(Components.interfaces.nsIIdleService);
	idleService.addIdleObserver(this, 60);
	idleService = null;
	
	// User-defined functions
	// TODO: move somewhere else?
	
	// Levenshtein distance UDF
	var lev = {
		onFunctionCall: function (arg) {
			var a = arg.getUTF8String(0);
			var b = arg.getUTF8String(1);
			return Zotero.Utilities.levenshtein(a, b);
		}
	};
	this._connection.createFunction('levenshtein', 2, lev);
	
	// Regexp UDF
	var rx = {
		onFunctionCall: function (arg) {
			var re = new RegExp(arg.getUTF8String(0));
			var str = arg.getUTF8String(1);
			return re.test(str);
		}
	};
	this._connection.createFunction('regexp', 2, rx);
	
	// text2html UDF
	var rx = {
		onFunctionCall: function (arg) {
			var str = arg.getUTF8String(0);
			return Zotero.Utilities.text2html(str, true);
		}
	};
	this._connection.createFunction('text2html', 1, rx);
	
	return this._connection;
};


/*
 * Retrieve a link to the data store asynchronously
 */
Zotero.DBConnection.prototype._getConnectionAsync = Zotero.Promise.coroutine(function* () {
	if (this._connectionAsync) {
		return this._connectionAsync;
	}
	else if (this._connectionAsync === false) {
		throw new Error("Database permanently closed; not re-opening");
	}
	
	this._debug("Asynchronously opening database '" + this._dbName + "'");
	
	// Get the storage service
	var store = Components.classes["@mozilla.org/storage/service;1"].
		getService(Components.interfaces.mozIStorageService);
	
	var file = Zotero.getZoteroDatabase(this._dbName);
	var backupFile = Zotero.getZoteroDatabase(this._dbName, 'bak');
	
	var fileName = this._dbName + '.sqlite';
	
	catchBlock: try {
		var corruptMarker = Zotero.getZoteroDatabase(this._dbName, 'is.corrupt');
		if (corruptMarker.exists()) {
			throw {
				name: 'NS_ERROR_FILE_CORRUPTED'
			};
		}
		this._connectionAsync = yield Zotero.Promise.resolve(this.Sqlite.openConnection({
			path: file.path
		}));
	}
	catch (e) {
		if (e.name=='NS_ERROR_FILE_CORRUPTED') {
			this._debug("Database file '" + file.leafName + "' corrupted", 1);
			
			// No backup file! Eek!
			if (!backupFile.exists()) {
				this._debug("No backup file for DB '" + this._dbName + "' exists", 1);
				
				// Save damaged filed
				this._debug('Saving damaged DB file with .damaged extension', 1);
				var damagedFile = Zotero.getZoteroDatabase(this._dbName, 'damaged');
				Zotero.moveToUnique(file, damagedFile);
				
				// Create new main database
				var file = Zotero.getZoteroDatabase(this._dbName);
				this._connectionAsync = store.openDatabase(file);
				
				if (corruptMarker.exists()) {
					corruptMarker.remove(null);
				}
				
				alert(Zotero.getString('db.dbCorruptedNoBackup', fileName));
				break catchBlock;
			}
			
			// Save damaged file
			this._debug('Saving damaged DB file with .damaged extension', 1);
			var damagedFile = Zotero.getZoteroDatabase(this._dbName, 'damaged');
			Zotero.moveToUnique(file, damagedFile);
			
			// Test the backup file
			try {
				Zotero.debug("Asynchronously opening DB connection");
				this._connectionAsync = yield Zotero.Promise.resolve(this.Sqlite.openConnection({
					path: backupFile.path
				}));
			}
			// Can't open backup either
			catch (e) {
				// Create new main database
				var file = Zotero.getZoteroDatabase(this._dbName);
				this._connectionAsync = yield Zotero.Promise.resolve(this.Sqlite.openConnection({
					path: file.path
				}));
				
				alert(Zotero.getString('db.dbRestoreFailed', fileName));
				
				if (corruptMarker.exists()) {
					corruptMarker.remove(null);
				}
				
				break catchBlock;
			}
			
			this._connectionAsync = undefined;
			
			// Copy backup file to main DB file
			this._debug("Restoring database '" + this._dbName + "' from backup file", 1);
			try {
				backupFile.copyTo(backupFile.parent, fileName);
			}
			catch (e) {
				// TODO: deal with low disk space
				throw (e);
			}
			
			// Open restored database
			var file = Zotero.getZoteroDirectory();
			file.append(fileName);
			this._connectionAsync = yield Zotero.Promise.resolve(this.Sqlite.openConnection({
				path: file.path
			}));
			this._debug('Database restored', 1);
			var msg = Zotero.getString('db.dbRestored', [
				fileName,
				Zotero.Date.getFileDateString(backupFile),
				Zotero.Date.getFileTimeString(backupFile)
			]);
			alert(msg);
			
			if (corruptMarker.exists()) {
				corruptMarker.remove(null);
			}
			
			break catchBlock;
		}
		
		// Some other error that we don't yet know how to deal with
		throw (e);
	}
	
	if (DB_LOCK_EXCLUSIVE) {
		yield Zotero.DB.queryAsync("PRAGMA locking_mode=EXCLUSIVE");
	}
	else {
		yield Zotero.DB.queryAsync("PRAGMA locking_mode=NORMAL");
	}
	
	// Set page cache size to 8MB
	var pageSize = yield Zotero.DB.valueQueryAsync("PRAGMA page_size");
	var cacheSize = 8192000 / pageSize;
	yield Zotero.DB.queryAsync("PRAGMA cache_size=" + cacheSize);
	
	// Enable foreign key checks
	yield Zotero.DB.queryAsync("PRAGMA foreign_keys=true");
	
	// Register idle and shutdown handlers to call this.observe() for DB backup
	var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
			.getService(Components.interfaces.nsIIdleService);
	idleService.addIdleObserver(this, 60);
	idleService = null;
	
	/*// User-defined functions
	// TODO: move somewhere else?
	
	// Levenshtein distance UDF
	var lev = {
		onFunctionCall: function (arg) {
			var a = arg.getUTF8String(0);
			var b = arg.getUTF8String(1);
			return Zotero.Utilities.levenshtein(a, b);
		}
	};
	this._connection.createFunction('levenshtein', 2, lev);
	
	// Regexp UDF
	var rx = {
		onFunctionCall: function (arg) {
			var re = new RegExp(arg.getUTF8String(0));
			var str = arg.getUTF8String(1);
			return re.test(str);
		}
	};
	this._connection.createFunction('regexp', 2, rx);
	
	// text2html UDF
	var rx = {
		onFunctionCall: function (arg) {
			var str = arg.getUTF8String(0);
			return Zotero.Utilities.text2html(str, true);
		}
	};
	this._connection.createFunction('text2html', 1, rx);*/
	
	return this._connectionAsync;
});


Zotero.DBConnection.prototype._debug = function (str, level) {
	var prefix = this._dbName == 'zotero' ? '' : '[' + this._dbName + '] ';
	Zotero.debug(prefix + str, level);
}


Zotero.DBConnection.prototype._getTypedValue = function (statement, i) {
	var type = statement.getTypeOfIndex(i);
	// For performance, we hard-code these constants
	switch (type) {
		case 1: //VALUE_TYPE_INTEGER
			return statement.getInt64(i);
		case 3: //VALUE_TYPE_TEXT
			return statement.getUTF8String(i);
		case 0: //VALUE_TYPE_NULL
			return null;
		case 2: //VALUE_TYPE_FLOAT
			return statement.getDouble(i);
		case 4: //VALUE_TYPE_BLOB
			return statement.getBlob(i, {});
	}
}


// Initialize main database connection
Zotero.DB = new Zotero.DBConnection('zotero');
