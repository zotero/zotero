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
	
	Components.utils.import("resource://gre/modules/Sqlite.jsm", this);
	
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
	this._connectionAsync = null;
	this._transactionDate = null;
	this._lastTransactionDate = null;
	this._transactionRollback = false;
	this._transactionNestingLevel = 0;
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
	
	this._transactionPromise = null;
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
	return this._getConnectionAsync().return();
}

Zotero.DBConnection.prototype.getAsyncStatement = Zotero.Promise.coroutine(function* (sql) {
	var conn = yield this._getConnectionAsync();
	conn = conn._connection;
	
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
 * @param {mozIStorageAsyncStatement} statement - Statement to run
 * @param {Function} [progressHandler] - Function to pass each available row to for SELECT queries
 * @return {Promise} - Resolved on completion, rejected with a reason on error
 */
Zotero.DBConnection.prototype.executeAsyncStatement = Zotero.Promise.method(function (statement, progressHandler) {
	var resolve;
	var reject;
	statement.executeAsync({
		handleResult: function (resultSet) {
			if (progressHandler) {
				progressHandler(resultSet.getNextRow());
			}
		},
		
		handleError: function (e) {
			reject(e);
		},
		
		handleCompletion: function (reason) {
			if (reason != Components.interfaces.mozIStorageStatementCallback.REASON_FINISHED) {
				reject(reason);
			}
			resolve();
		}
	});
	return new Zotero.Promise(function () {
		resolve = arguments[0];
		reject = arguments[1];
	});
});



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


/*
 * Used on shutdown to rollback all open transactions
 *
 * TODO: update or remove
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


Zotero.DBConnection.prototype.getColumns = function (table) {
	return Zotero.DB.queryAsync("PRAGMA table_info(" + table + ")")
	.then(function (rows) {
		return [row.name for each (row in rows)];
	})
	.catch(function (e) {
		this._debug(e, 1);
		return false;
	});
}


/**
* Find the next lowest numeric suffix for a value in table column
*
* For example, if "Untitled" and "Untitled 2" and "Untitled 4",
* returns "Untitled 3"
*
* If _name_ alone is available, returns that
**/
Zotero.DBConnection.prototype.getNextName = Zotero.Promise.coroutine(function* (libraryID, table, field, name)
{
	if (typeof name == 'undefined') {
		Zotero.debug("WARNING: The parameters of Zotero.DB.getNextName() have changed -- update your code", 2);
		[libraryID, table, field, name] = [null, libraryID, table, field];
	}
	
	var sql = "SELECT SUBSTR(" + field + ", " + (name.length + 1) + ") "
				+ "FROM " + table + " "
				+ "WHERE libraryID=? AND "
				+ field + " LIKE '" + name + "%' "
				+ " ORDER BY " + field;
	var params = [libraryID];
	var suffixes = yield this.columnQueryAsync(sql, params);
	suffixes.filter(function (x) x.match(/^( [0-9]+)?$/));
	
	// If none found or first one has a suffix, use default name
	if (!suffixes.length || suffixes[0]) {
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
});


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
Zotero.DBConnection.prototype.executeTransaction = Zotero.Promise.coroutine(function* (func, options) {
	// Set temporary options for this transaction that will be reset at the end
	var origOptions = {};
	if (options) {
		for (let option in options) {
			origOptions[option] = this[option];
			this[option] = options[option];
		}
	}
	
	var conn = yield this._getConnectionAsync(options);
	try {
		if (conn.transactionInProgress) {
			Zotero.debug("Async DB transaction in progress -- increasing level to "
				+ ++this._asyncTransactionNestingLevel, 5);
			
			if (options) {
				if (options.onCommit) {
					this._callbacks.current.commit.push(options.onCommit);
				}
				if (options.onRollback) {
					this._callbacks.current.rollback.push(options.onRollback);
				}
			}
			
			try {
				var result = yield Zotero.Promise.coroutine(func)();
			}
			catch (e) {
				Zotero.debug("Rolled back nested async DB transaction", 5);
				this._asyncTransactionNestingLevel = 0;
				throw e;
			}
			
			Zotero.debug("Decreasing async DB transaction level to "
				+ --this._asyncTransactionNestingLevel, 5);
			return result;
		}
		else {
			Zotero.debug("Beginning async DB transaction", 5);
			
			var resolve;
			var reject;
			this._transactionPromise = new Zotero.Promise(function () {
				resolve = arguments[0];
				reject = arguments[1];
			});
			
			// Set a timestamp for this transaction
			this._transactionDate = new Date(Math.floor(new Date / 1000) * 1000);
			
			// Run begin callbacks
			for (var i=0; i<this._callbacks.begin.length; i++) {
				if (this._callbacks.begin[i]) {
					this._callbacks.begin[i]();
				}
			}
			var result = yield conn.executeTransaction(func);
			Zotero.debug("Committed async DB transaction", 5);
			
			// Clear transaction time
			if (this._transactionDate) {
				this._transactionDate = null;
			}
			
			if (options) {
				// Function to run once transaction has been committed but before any
				// permanent callbacks
				if (options.onCommit) {
					this._callbacks.current.commit.push(options.onCommit);
				}
				this._callbacks.current.rollback = [];
				
				if (options.vacuumOnCommit) {
					Zotero.debug('Vacuuming database');
					yield Zotero.DB.queryAsync('VACUUM');
				}
			}
			
			// Run temporary commit callbacks
			var f;
			while (f = this._callbacks.current.commit.shift()) {
				yield Zotero.Promise.resolve(f());
			}
			
			// Run commit callbacks
			for (var i=0; i<this._callbacks.commit.length; i++) {
				if (this._callbacks.commit[i]) {
					yield this._callbacks.commit[i]();
				}
			}
			
			setTimeout(resolve, 0);
			
			return result;
		}
	}
	catch (e) {
		Zotero.debug("Rolled back async DB transaction", 5);
		Zotero.debug(e, 1);
		
		if (options) {
			// Function to run once transaction has been committed but before any
			// permanent callbacks
			if (options.onRollback) {
				this._callbacks.current.rollback.push(options.onRollback);
			}
		}
		
		// Run temporary commit callbacks
		var f;
		while (f = this._callbacks.current.rollback.shift()) {
			yield Zotero.Promise.resolve(f());
		}
		
		// Run rollback callbacks
		for (var i=0; i<this._callbacks.rollback.length; i++) {
			if (this._callbacks.rollback[i]) {
				yield Zotero.Promise.resolve(this._callbacks.rollback[i]());
			}
		}
		
		if (reject) {
			setTimeout(function () {
				reject(e);
			}, 0);
		}
		
		throw e;
	}
	finally {
		// Reset options back to their previous values
		if (options) {
			for (let option in options) {
				this[option] = origOptions[option];
			}
		}
	}
});


Zotero.DBConnection.prototype.waitForTransaction = function () {
	if (!this._transactionPromise) {
		return Zotero.Promise.resolve();
	}
	Zotero.debug("Waiting for transaction to finish");
	return this._transactionPromise.then(function () {
		Zotero.debug("Done waiting for transaction");
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
	return this._getConnectionAsync(options)
	.then(function (c) {
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
			// Errors in onRow don't stop the query unless StopIteration is thrown
			onRow = function (row) {
				try {
					options.onRow(row);
				}
				catch (e) {
					if (e instanceof StopIteration) {
						Zotero.debug("Query cancelled");
						throw e;
					}
					Zotero.debug(e, 1);
					Components.utils.reportError(e);
					throw StopIteration;
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
						Zotero.debug(e, 1);
						var msg = "DB column '" + name + "' not found";
						Zotero.debug(msg, 1);
						throw new Error(msg);
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
 * @return {Promise<Array|Boolean>}  A promise for either the value or FALSE if no result
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
 * @return {Promise<Array>}  A promise for an array of values in the column
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


Zotero.DBConnection.prototype.tableExists = function (table) {
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
	
	return this.executeTransaction(function* () {
		var statement;
		while (statement = statements.shift()) {
			yield Zotero.DB.queryAsync(statement);
		}
	});
}


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


Zotero.DBConnection.prototype.integrityCheck = Zotero.Promise.coroutine(function* () {
	var ok = yield this.valueQueryAsync("PRAGMA integrity_check");
	return ok == 'ok';
});


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
Zotero.DBConnection.prototype.closeDatabase = Zotero.Promise.coroutine(function* (permanent) {
	if (this._connectionAsync) {
		Zotero.debug("Closing database");
		yield this._connectionAsync.close();
		this._connectionAsync = undefined;
		this._connectionAsync = permanent ? false : null;
		Zotero.debug("Database closed");
	}
});


Zotero.DBConnection.prototype.backupDatabase = Zotero.Promise.coroutine(function* (suffix, force) {
	var storageService = Components.classes["@mozilla.org/storage/service;1"]
		.getService(Components.interfaces.mozIStorageService);
	
	if (!suffix) {
		var numBackups = Zotero.Prefs.get("backup.numBackups");
		if (numBackups < 1) {
			return false;
		}
		if (numBackups > 24) {
			numBackups = 24;
		}
	}
	
	if (Zotero.locked && !force) {
		this._debug("Zotero is locked -- skipping backup of DB '" + this._dbName + "'", 2);
		return false;
	}
	
	if (this._backupPromise && this._backupPromise.isPending()) {
		this._debug("Database " + this._dbName + " is already being backed up -- skipping", 2);
		return false;
	}
	
	// Start a promise that will be resolved when the backup is finished
	var resolveBackupPromise;
	yield this.waitForTransaction();
	this._backupPromise = new Zotero.Promise(function () {
		resolveBackupPromise = arguments[0];
	});
	
	try {
		var corruptMarker = Zotero.getZoteroDatabase(this._dbName, 'is.corrupt');
		
		if (this.skipBackup || Zotero.skipLoading) {
			this._debug("Skipping backup of database '" + this._dbName + "'", 1);
			return false;
		}
		else if (this._dbIsCorrupt || corruptMarker.exists()) {
			this._debug("Database '" + this._dbName + "' is marked as corrupt -- skipping backup", 1);
			return false;
		}
		
		var file = Zotero.getZoteroDatabase(this._dbName);
		
		// For standard backup, make sure last backup is old enough to replace
		if (!suffix && !force) {
			var backupFile = Zotero.getZoteroDatabase(this._dbName, 'bak');
			if (yield OS.File.exists(backupFile.path)) {
				var currentDBTime = (yield OS.File.stat(file.path)).lastModificationDate;
				var lastBackupTime = (yield OS.File.stat(backupFile.path)).lastModificationDate;
				if (currentDBTime == lastBackupTime) {
					Zotero.debug("Database '" + this._dbName + "' hasn't changed -- skipping backup");
					return;
				}
				
				var now = new Date();
				var intervalMinutes = Zotero.Prefs.get('backup.interval');
				var interval = intervalMinutes * 60 *  1000;
				if ((now - lastBackupTime) < interval) {
					Zotero.debug("Last backup of database '" + this._dbName
						+ "' was less than " + intervalMinutes + " minutes ago -- skipping backup");
					return;
				}
			}
		}
		
		this._debug("Backing up database '" + this._dbName + "'");
		
		// Copy via a temporary file so we don't run into disk space issues
		// after deleting the old backup file
		var tmpFile = Zotero.getZoteroDatabase(this._dbName, 'tmp');
		if (yield OS.File.exists(tmpFile.path)) {
			try {
				yield OS.File.remove(tmpFile.path);
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
				yield this.queryAsync("PRAGMA locking_mode=NORMAL", false, { inBackup: true });
			}
			storageService.backupDatabaseFile(file, tmpFile.leafName, file.parent);
		}
		catch (e) {
			Zotero.debug(e);
			Components.utils.reportError(e);
			return false;
		}
		finally {
			if (DB_LOCK_EXCLUSIVE) {
				yield this.queryAsync("PRAGMA locking_mode=EXCLUSIVE", false, { inBackup: true });
			}
		}
		
		// Open the backup to check for corruption
		try {
			var connection = storageService.openDatabase(tmpFile);
		}
		catch (e) {
			this._debug("Database file '" + tmpFile.leafName + "' is corrupt -- skipping backup");
			if (yield OS.File.exists(tmpFile.path)) {
				yield OS.File.remove(tmpFile.path);
			}
			return false;
		}
		finally {
			let resolve;
			connection.asyncClose({
				complete: function () {
					resolve();
				}
			});
			yield new Zotero.Promise(function () {
				resolve = arguments[0];
			});
		}
		
		// Special backup
		if (!suffix && numBackups > 1) {
			// Remove oldest backup file
			var targetFile = Zotero.getZoteroDatabase(this._dbName, (numBackups - 1) + '.bak')
			if (yield OS.File.exists(targetFile.path)) {
				yield OS.File.remove(targetFile.path);
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
				
				if (!(yield OS.File.exists(sourceFile.path))) {
					continue;
				}
				
				Zotero.debug("Moving " + sourceFile.leafName + " to " + targetFile.leafName);
				yield OS.File.move(sourceFile.path, targetFile.path);
			}
		}
		
		var backupFile = Zotero.getZoteroDatabase(
			this._dbName, (suffix ? suffix + '.' : '') + 'bak'
		);
		
		// Remove old backup file
		if (yield OS.File.exists(backupFile.path)) {
			OS.File.remove(backupFile.path);
		}
		
		yield OS.File.move(tmpFile.path, backupFile.path);
		Zotero.debug("Backed up to " + backupFile.leafName);
		
		return true;
	}
	finally {
		resolveBackupPromise();
	}
});


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
 * Retrieve a link to the data store asynchronously
 */
Zotero.DBConnection.prototype._getConnectionAsync = Zotero.Promise.coroutine(function* (options) {
	// If a backup is in progress, wait until it's done
	if (this._backupPromise && this._backupPromise.isPending() && (!options || !options.inBackup)) {
		Zotero.debug("Waiting for database backup to complete", 2);
		yield this._backupPromise;
	}
	
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
