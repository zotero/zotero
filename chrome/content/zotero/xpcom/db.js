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

"use strict";

// Exclusive locking mode (default) prevents access to Zotero database while Zotero is open
// and speeds up DB access (http://www.sqlite.org/pragma.html#pragma_locking_mode).
// Normal mode is more convenient for development, but risks database corruption, particularly if
// the same database is accessed simultaneously by multiple Zotero instances.
const DB_LOCK_EXCLUSIVE = true;

Zotero.DBConnection = function(dbNameOrPath) {
	if (!dbNameOrPath) {
		throw ('DB name not provided in Zotero.DBConnection()');
	}
	
	this.MAX_BOUND_PARAMETERS = 999;
	this.DB_CORRUPTION_STRING = "2152857611";
	
	Components.utils.import("resource://gre/modules/Sqlite.jsm", this);
	
	this.closed = false;
	this.skipBackup = false;
	
	// JS Date
	this.__defineGetter__('transactionDate', function () {
		if (this._transactionDate) {
			this._lastTransactionDate = this._transactionDate;
			return this._transactionDate;
		}
		
		throw new Error("Transaction not in progress");
		
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
	
	// Absolute path to DB
	if (dbNameOrPath.startsWith('/') || (Zotero.isWin && dbNameOrPath.includes('\\'))) {
		this._dbName = OS.Path.basename(dbNameOrPath).replace(/\.sqlite$/, '');
		this._dbPath = dbNameOrPath;
		this._externalDB = true;
	}
	// DB name in data directory
	else {
		this._dbName = dbNameOrPath;
		this._dbPath = Zotero.DataDirectory.getDatabase(dbNameOrPath);
		this._externalDB = false;
	}
	this._shutdown = false;
	this._connection = null;
	this._transactionID = null;
	this._transactionDate = null;
	this._lastTransactionDate = null;
	this._transactionRollback = false;
	this._transactionNestingLevel = 0;
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
	
	this._transactionPromise = null;
	
	if (dbNameOrPath == 'zotero') {
		this.IncompatibleVersionException = function (msg, dbClientVersion) {
			this.message = msg;
			this.dbClientVersion = dbClientVersion;
		}
		this.IncompatibleVersionException.prototype = Object.create(Error.prototype);
	}
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
	return this._getConnectionAsync().then(() => {});
}


Zotero.DBConnection.prototype.parseQueryAndParams = function (sql, params) {
	// If single scalar value, wrap in an array
	if (!Array.isArray(params)) {
		if (typeof params == 'string' || typeof params == 'number' || typeof params == 'object'
				|| params === null) {
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
	if (params.length) {
		let matches = sql.match(/\?\d*/g);
		if (!matches) {
			throw new Error("Parameters provided for query without placeholders "
				+ "[QUERY: " + sql + "]");
		}
		else {
			// Count numbered parameters (?1) properly
			let num = 0;
			let numbered = {};
			for (let i = 0; i < matches.length; i++) {
				let match = matches[i];
				if (match == '?') {
					num++;
				}
				else {
					numbered[match] = true;
				}
			}
			num += Object.keys(numbered).length;
			
			if (params.length != num) {
				throw new Error("Incorrect number of parameters provided for query "
					+ "(" + params.length + ", expecting " + num + ") "
					+ "[QUERY: " + sql + "]");
			}
		}
		
		// First, determine the type of query using first word
		let queryMethod = sql.match(/^[^\s\(]*/)[0].toLowerCase();
		
		// Reset lastIndex, since regexp isn't recompiled dynamically
		let placeholderRE = /\s*[=,(]\s*\?/g;
		for (var i=0; i<params.length; i++) {
			// Find index of this parameter, skipping previous ones
			matches = placeholderRE.exec(sql);
			
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
			if (!matches) {
				throw new Error("Null parameter provided for a query without placeholders "
					+ "-- use false or undefined [QUERY: " + sql + "]");
			}
			
			if (matches[0].trim().indexOf('=') == -1) {
				if (queryMethod == 'select') {
					throw new Error("NULL cannot be used for parenthesized placeholders "
						+ "in SELECT queries [QUERY: " + sql + "]");
				}
				var repl = matches[0].replace('?', 'NULL');
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
		}
		if (!params.length) {
			params = [];
		}
	}
	else if (/\?/g.test(sql)) {
		throw new Error("Parameters not provided for query containing placeholders "
			+ "[QUERY: " + sql + "]");
	}
	
	return [sql, params];
};


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


Zotero.DBConnection.prototype.addCurrentCallback = function (type, cb) {
	this.requireTransaction();
	this._callbacks.current[type].push(cb);
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
	return this.queryAsync("PRAGMA table_info(" + table + ")")
	.then(function (rows) {
		return rows.map(row => row.name);
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
	Zotero.debug("WARNING: Zotero.DB.getNextName() is deprecated -- "
		+ "use Zotero.Utilities.Internal.getNextName() instead", 2);
	
	if (typeof name == 'undefined') {
		[libraryID, table, field, name] = [null, libraryID, table, field];
	}
	
	var sql = "SELECT SUBSTR(" + field + ", " + (name.length + 1) + ") FROM " + table
		+ " WHERE libraryID=? AND " + field + " LIKE ? ORDER BY " + field;
	var params = [libraryID, name + "%"];
	var suffixes = yield this.columnQueryAsync(sql, params);
	suffixes.filter(x => x.match(/^( [0-9]+)?$/));
	
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
	options = options || {};
	var resolve;
	
	// Set temporary options for this transaction that will be reset at the end
	var origOptions = {};
	if (options) {
		for (let option in options) {
			origOptions[option] = this[option];
			this[option] = options[option];
		}
	}
	
	var startedTransaction = false;
	var id = Zotero.Utilities.randomString();
	
	try {
		while (this._transactionID) {
			yield this.waitForTransaction(id).timeout(options.waitTimeout || 30000);
		}
		startedTransaction = true;
		this._transactionID = id;
		
		Zotero.debug(`Beginning DB transaction ${id}`, 4);
		
		this._transactionPromise = new Zotero.Promise(function () {
			resolve = arguments[0];
		});
		
		// Set a timestamp for this transaction
		this._transactionDate = new Date(Math.floor(new Date / 1000) * 1000);
		
		// Run begin callbacks
		for (var i=0; i<this._callbacks.begin.length; i++) {
			if (this._callbacks.begin[i]) {
				this._callbacks.begin[i](id);
			}
		}
		var conn = this._getConnection(options) || (yield this._getConnectionAsync(options));
		var result = yield conn.executeTransaction(func);
		Zotero.debug(`Committed DB transaction ${id}`, 4);
		
		// Clear transaction time
		if (this._transactionDate) {
			this._transactionDate = null;
		}
		
		if (options.vacuumOnCommit) {
			Zotero.debug('Vacuuming database');
			yield this.queryAsync('VACUUM');
			Zotero.debug('Done vacuuming');
			
		}
		
		this._transactionID = null;
		
		// Function to run once transaction has been committed but before any
		// permanent callbacks
		if (options.onCommit) {
			this._callbacks.current.commit.push(options.onCommit);
		}
		this._callbacks.current.rollback = [];
		
		// Run temporary commit callbacks
		var f;
		while (f = this._callbacks.current.commit.shift()) {
			yield Zotero.Promise.resolve(f(id));
		}
		
		// Run commit callbacks
		for (var i=0; i<this._callbacks.commit.length; i++) {
			if (this._callbacks.commit[i]) {
				yield this._callbacks.commit[i](id);
			}
		}
		
		return result;
	}
	catch (e) {
		if (e.name == "TimeoutError") {
			Zotero.debug(`Timed out waiting for transaction ${id}`, 1);
		}
		else {
			Zotero.debug(`Rolled back DB transaction ${id}`, 1);
			Zotero.debug(e.message, 1);
		}
		if (startedTransaction) {
			this._transactionID = null;
		}
		
		// Function to run once transaction has been committed but before any
		// permanent callbacks
		if (options.onRollback) {
			this._callbacks.current.rollback.push(options.onRollback);
		}
		
		// Run temporary commit callbacks
		var f;
		while (f = this._callbacks.current.rollback.shift()) {
			yield Zotero.Promise.resolve(f(id));
		}
		
		// Run rollback callbacks
		for (var i=0; i<this._callbacks.rollback.length; i++) {
			if (this._callbacks.rollback[i]) {
				yield Zotero.Promise.resolve(this._callbacks.rollback[i](id));
			}
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
		
		// Process all resolvers
		if (resolve) {
			resolve.call();
		}
	}
});


Zotero.DBConnection.prototype.inTransaction = function () {
	return !!this._transactionID;
}


Zotero.DBConnection.prototype.waitForTransaction = function (id) {
	if (!this._transactionID) {
		return Zotero.Promise.resolve();
	}
	if (Zotero.Debug.enabled) {
		Zotero.debug(`Waiting for DB transaction ${this._transactionID} to finish`
			+ (id ? ` to start ${id}` : ""), 4);
		Zotero.debug(Zotero.Debug.filterStack((new Error).stack), 5);
	}
	return this._transactionPromise;
};


Zotero.DBConnection.prototype.requireTransaction = function () {
	if (!this._transactionID) {
		throw new Error("Not in transaction");
	}
};


/**
 * @param {String} sql SQL statement to run
 * @param {Array|String|Integer} [params] SQL parameters to bind
 * @return {Promise|Array} A promise for an array of rows. The individual
 *                         rows are Proxy objects that return values from the
 *                         underlying mozIStorageRows based on column names.
 */
Zotero.DBConnection.prototype.queryAsync = Zotero.Promise.coroutine(function* (sql, params, options) {
	try {
		let onRow = null;
		let conn = this._getConnection(options) || (yield this._getConnectionAsync(options));
		[sql, params] = this.parseQueryAndParams(sql, params);
		if (Zotero.Debug.enabled) {
			this.logQuery(sql, params, options);
		}
		var failed = false;
		if (options && options.onRow) {
			// Errors in onRow don't stop the query unless the 'cancel' function is called
			onRow = function (row, cancel) {
				try {
					options.onRow(row, cancel);
				}
				catch (e) {
					failed = e;
					cancel();
				}
			}
		}
		let rows;
		if (options && options.noCache) {
			rows = yield conn.execute(sql, params, onRow);
		}
		else {
			rows = yield conn.executeCached(sql, params, onRow);
		}
		if (failed) {
			throw failed;
		}
		// Parse out the SQL command being used
		let op = sql.match(/^[^a-z]*[^ ]+/i);
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
				},
				has: function(target, name) {
					try {
						return !!target.getResultByName(name);
					} catch (e) {
						return false;
					}
				}
			};
			for (let i=0, len=rows.length; i<len; i++) {
				rows[i] = new Proxy(rows[i], handler);
			}
			return rows;
		}
		else {
			// lastInsertRowID is unreliable for async queries, so we don't bother
			// returning it for INSERT and REPLACE queries
			return;
		}
	}
	catch (e) {
		if (e.errors && e.errors[0]) {
			var eStr = e + "";
			eStr = eStr.indexOf("Error: ") == 0 ? eStr.substr(7): e;
			throw new Error(eStr + ' [QUERY: ' + sql + '] '
				+ (params ? '[PARAMS: ' + params.join(', ') + '] ' : '')
				+ '[ERROR: ' + e.errors[0].message + ']');
		}
		else {
			throw e;
		}
	}
});


Zotero.DBConnection.prototype.queryTx = function (sql, params, options) {
	return this.executeTransaction(function* () {
		options = options || {};
		delete options.tx;
		return this.queryAsync(sql, params, options);
	}.bind(this));
};


/**
 * @param {String} sql  SQL statement to run
 * @param {Array|String|Integer} [params]  SQL parameters to bind
 * @return {Promise<Array|Boolean>}  A promise for either the value or FALSE if no result
 */
Zotero.DBConnection.prototype.valueQueryAsync = Zotero.Promise.coroutine(function* (sql, params, options = {}) {
	try {
		let conn = this._getConnection(options) || (yield this._getConnectionAsync(options));
		[sql, params] = this.parseQueryAndParams(sql, params);
		if (Zotero.Debug.enabled) {
			this.logQuery(sql, params, options);
		}
		let rows = yield conn.executeCached(sql, params);
		return rows.length ? rows[0].getResultByIndex(0) : false;
	}
	catch (e) {
		if (e.errors && e.errors[0]) {
			var eStr = e + "";
			eStr = eStr.indexOf("Error: ") == 0 ? eStr.substr(7): e;
			throw new Error(eStr + ' [QUERY: ' + sql + '] '
				+ (params ? '[PARAMS: ' + params.join(', ') + '] ' : '')
				+ '[ERROR: ' + e.errors[0].message + ']');
		}
		else {
			throw e;
		}
	}
});


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
Zotero.DBConnection.prototype.columnQueryAsync = Zotero.Promise.coroutine(function* (sql, params, options = {}) {
	try {
		let conn = this._getConnection(options) || (yield this._getConnectionAsync(options));
		[sql, params] = this.parseQueryAndParams(sql, params);
		if (Zotero.Debug.enabled) {
			this.logQuery(sql, params, options);
		}
		let rows = yield conn.executeCached(sql, params);
		var column = [];
		for (let i=0, len=rows.length; i<len; i++) {
			column.push(rows[i].getResultByIndex(0));
		}
		return column;
	}
	catch (e) {
		if (e.errors && e.errors[0]) {
			var eStr = e + "";
			eStr = eStr.indexOf("Error: ") == 0 ? eStr.substr(7): e;
			throw new Error(eStr + ' [QUERY: ' + sql + '] '
				+ (params ? '[PARAMS: ' + params.join(', ') + '] ' : '')
				+ '[ERROR: ' + e.errors[0].message + ']');
		}
		else {
			throw e;
		}
	}
});


Zotero.DBConnection.prototype.logQuery = function (sql, params = [], options) {
	if (options && options.debug === false) return;
	var msg = sql;
	if (params.length && (!options || options.debugParams !== false)) {
		msg += " [";
		for (let i = 0; i < params.length; i++) {
			let param = params[i];
			let paramType = typeof param;
			if (paramType == 'string') {
				msg += "'" + param + "', ";
			}
			else {
				msg += param + ", ";
			}
		}
		msg = msg.substr(0, msg.length - 2) + "]";
	}
	Zotero.debug(msg, 4);
}


Zotero.DBConnection.prototype.tableExists = Zotero.Promise.coroutine(function* (table, db) {
	yield this._getConnectionAsync();
	var prefix = db ? db + '.' : '';
	var sql = `SELECT COUNT(*) FROM ${prefix}sqlite_master WHERE type='table' AND tbl_name=?`;
	var count = yield this.valueQueryAsync(sql, [table]);
	return !!count;
});


/**
 * Parse SQL string and execute transaction with all statements
 *
 * @return {Promise}
 */
Zotero.DBConnection.prototype.executeSQLFile = Zotero.Promise.coroutine(function* (sql) {
	var nonCommentRE = /^[^-]/;
	var trailingCommentRE = /^(.*?)(?:--.+)?$/;
	
	sql = sql.trim()
		// Ugly hack to parse triggers with embedded semicolons
		.replace(/;---/g, "TEMPSEMI")
		.split("\n")
		.filter(x => nonCommentRE.test(x))
		.map(x => x.match(trailingCommentRE)[1])
		.join("");
	if (sql.substr(-1) == ";") {
		sql = sql.substr(0, sql.length - 1);
	}
	
	var statements = sql.split(";")
		.map(x => x.replace(/TEMPSEMI/g, ";"));
	
	this.requireTransaction();
	
	var statement;
	while (statement = statements.shift()) {
		yield this.queryAsync(statement);
	}
});


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


// TEMP
Zotero.DBConnection.prototype.vacuum = function () {
	return this.executeTransaction(function* () {}, { vacuumOnCommit: true });
};


// TEMP
Zotero.DBConnection.prototype.info = Zotero.Promise.coroutine(function* () {
	var info = {};
	var pragmas = ['auto_vacuum', 'cache_size', 'main.locking_mode', 'page_size'];
	for (let p of pragmas) {
		info[p] = yield Zotero.DB.valueQueryAsync(`PRAGMA ${p}`);
	}
	return info;
});


Zotero.DBConnection.prototype.integrityCheck = Zotero.Promise.coroutine(function* () {
	var ok = yield this.valueQueryAsync("PRAGMA integrity_check");
	return ok == 'ok';
});


Zotero.DBConnection.prototype.checkException = function (e) {
	if (this._externalDB) {
		return true;
	}
	
	if (e.message.includes(this.DB_CORRUPTION_STRING)) {
		// Write corrupt marker to data directory
		var file = Zotero.File.pathToFile(this._dbPath + '.is.corrupt');
		Zotero.File.putContents(file, '');
		
		this._dbIsCorrupt = true;
		
		var ps = Services.prompt;
		
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
			var appStartup = Services.startup;
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
	if (this._connection) {
		Zotero.debug("Closing database");
		this.closed = true;
		yield this._connection.close();
		this._connection = undefined;
		this._connection = permanent ? false : null;
		Zotero.debug("Database closed");
	}
});


Zotero.DBConnection.prototype.backupDatabase = Zotero.Promise.coroutine(function* (suffix, force) {
	if (this.skipBackup || this._externalDB || Zotero.skipLoading) {
		this._debug("Skipping backup of database '" + this._dbName + "'", 1);
		return false;
	}
	
	var storageService = Services.storage;
	
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
	if (this.inTransaction()) {
		yield this.waitForTransaction();
	}
	this._backupPromise = new Zotero.Promise(function () {
		resolveBackupPromise = arguments[0];
	});
	
	try {
		let corruptMarker = Zotero.File.pathToFile(this._dbPath + '.is.corrupt');
		
		if (this._dbIsCorrupt || corruptMarker.exists()) {
			this._debug("Database '" + this._dbName + "' is marked as corrupt -- skipping backup", 1);
			return false;
		}
		
		let file = this._dbPath;
		
		// For standard backup, make sure last backup is old enough to replace
		if (!suffix && !force) {
			let backupFile = this._dbPath + '.bak';
			if (yield OS.File.exists(backupFile)) {
				let currentDBTime = (yield OS.File.stat(file)).lastModificationDate;
				let lastBackupTime = (yield OS.File.stat(backupFile)).lastModificationDate;
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
		var tmpFile = this._dbPath + '.tmp';
		if (yield OS.File.exists(tmpFile)) {
			try {
				yield OS.File.remove(tmpFile);
			}
			catch (e) {
				if (e.name == 'NS_ERROR_FILE_ACCESS_DENIED') {
					alert("Cannot delete " + OS.Path.basename(tmpFile));
				}
				throw (e);
			}
		}
		
		// Turn off DB locking before backup and reenable after, since otherwise
		// the lock is lost
		try {
			if (DB_LOCK_EXCLUSIVE) {
				yield this.queryAsync("PRAGMA main.locking_mode=NORMAL", false, { inBackup: true });
			}
			storageService.backupDatabaseFile(
				Zotero.File.pathToFile(file),
				OS.Path.basename(tmpFile),
				Zotero.File.pathToFile(file).parent
			);
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
		finally {
			if (DB_LOCK_EXCLUSIVE) {
				yield this.queryAsync("PRAGMA main.locking_mode=EXCLUSIVE", false, { inBackup: true });
			}
		}
		
		// Open the backup to check for corruption
		try {
			var connection = storageService.openDatabase(Zotero.File.pathToFile(tmpFile));
		}
		catch (e) {
			Zotero.logError(e);
			this._debug("Database file '" + OS.Path.basename(tmpFile) + "' can't be opened -- skipping backup");
			if (yield OS.File.exists(tmpFile)) {
				yield OS.File.remove(tmpFile);
			}
			return false;
		}
		finally {
			if (connection) {
				let deferred = Zotero.Promise.defer();
				connection.asyncClose({
					complete: function () {
						deferred.resolve();
					}
				});
				yield deferred.promise;
			}
        }
		
		// Special backup
		if (!suffix && numBackups > 1) {
			// Remove oldest backup file
			let targetFile = this._dbPath + '.' + (numBackups - 1) + '.bak';
			if (yield OS.File.exists(targetFile)) {
				yield OS.File.remove(targetFile);
			}
			
			// Shift old versions up
			for (var i=(numBackups - 1); i>=1; i--) {
				var targetNum = i;
				var sourceNum = targetNum - 1;
				
				let targetFile = this._dbPath + '.' + targetNum + '.bak';
				let sourceFile = this._dbPath + '.' + (sourceNum ? sourceNum + '.bak' : 'bak')
				
				if (!(yield OS.File.exists(sourceFile))) {
					continue;
				}
				
				Zotero.debug("Moving " + OS.Path.basename(sourceFile)
					+ " to " + OS.Path.basename(targetFile));
				yield OS.File.move(sourceFile, targetFile);
			}
		}
		
		let backupFile = this._dbPath + '.' + (suffix ? suffix + '.' : '') + 'bak';
		
		// Remove old backup file
		if (yield OS.File.exists(backupFile)) {
			OS.File.remove(backupFile);
		}
		
		yield OS.File.move(tmpFile, backupFile);
		Zotero.debug("Backed up to " + OS.Path.basename(backupFile));
		
		return true;
	}
	finally {
		resolveBackupPromise();
	}
});


/**
 * Escape '_', '%', and '\' in an SQL LIKE expression so that it can be used with ESCAPE '\' to
 * prevent the wildcards from having special meaning
 */
Zotero.DBConnection.prototype.escapeSQLExpression = function (expr) {
	return expr.replace(/([_%\\])/g, '\\$1');
};


/////////////////////////////////////////////////////////////////
//
// Private methods
//
/////////////////////////////////////////////////////////////////

Zotero.DBConnection.prototype._getConnection = function (options) {
	if (this._backupPromise && this._backupPromise.isPending() && (!options || !options.inBackup)) {
		return false;
	}
	if (this._connection === false) {
		throw new Error("Database permanently closed; not re-opening");
	}
	return this._connection || false;
}

/*
 * Retrieve a link to the data store asynchronously
 */
Zotero.DBConnection.prototype._getConnectionAsync = async function (options) {
	// If a backup is in progress, wait until it's done
	if (this._backupPromise && this._backupPromise.isPending() && (!options || !options.inBackup)) {
		Zotero.debug("Waiting for database backup to complete", 2);
		await this._backupPromise;
	}
	
	if (this._connection) {
		return this._connection;
	}
	else if (this._connection === false) {
		throw new Error("Database permanently closed; not re-opening");
	}
	
	this._debug("Asynchronously opening database '" + this._dbName + "'");
	Zotero.debug(this._dbPath);
	
	// Get the storage service
	var store = Services.storage;
	
	var file = this._dbPath;
	var backupFile = this._dbPath + '.bak';
	var fileName = OS.Path.basename(file);
	var corruptMarker = this._dbPath + '.is.corrupt';
	
	catchBlock: try {
		if (await OS.File.exists(corruptMarker)) {
			throw new Error(this.DB_CORRUPTION_STRING);
		}
		this._connection = await Zotero.Promise.resolve(this.Sqlite.openConnection({
			path: file
		}));
	}
	catch (e) {
		// Don't deal with corrupted external dbs
		if (this._externalDB) {
			throw e;
		}
		
		Zotero.logError(e);
		
		if (e.message.includes(this.DB_CORRUPTION_STRING)) {
			this._debug(`Database file '${fileName}' corrupted`, 1);
			
			// No backup file! Eek!
			if (!await OS.File.exists(backupFile)) {
				this._debug("No backup file for DB '" + this._dbName + "' exists", 1);
				
				// Save damaged filed
				this._debug('Saving damaged DB file with .damaged extension', 1);
				let damagedFile = this._dbPath + '.damaged';
				await Zotero.File.moveToUnique(file, damagedFile);
				
				// Create new main database
				this._connection = store.openDatabase(file);
				
				if (await OS.File.exists(corruptMarker)) {
					await OS.File.remove(corruptMarker);
				}
				
				Zotero.alert(
					null,
					Zotero.getString('startupError'),
					Zotero.getString('db.dbCorruptedNoBackup', fileName)
				);
				break catchBlock;
			}
			
			// Save damaged file
			this._debug('Saving damaged DB file with .damaged extension', 1);
			let damagedFile = this._dbPath + '.damaged';
			await Zotero.File.moveToUnique(file, damagedFile);
			
			// Test the backup file
			try {
				Zotero.debug("Asynchronously opening DB connection");
				this._connection = await Zotero.Promise.resolve(this.Sqlite.openConnection({
					path: backupFile
				}));
			}
			// Can't open backup either
			catch (e) {
				// Create new main database
				this._connection = await Zotero.Promise.resolve(this.Sqlite.openConnection({
					path: file
				}));
				
				Zotero.alert(
					null,
					Zotero.getString('general.error'),
					Zotero.getString('db.dbRestoreFailed', fileName)
				);
				
				if (await OS.File.exists(corruptMarker)) {
					await OS.File.remove(corruptMarker);
				}
				
				break catchBlock;
			}
			
			this._connection = undefined;
			
			// Copy backup file to main DB file
			this._debug("Restoring database '" + this._dbName + "' from backup file", 1);
			try {
				await OS.File.copy(backupFile, file);
			}
			catch (e) {
				// TODO: deal with low disk space
				throw (e);
			}
			
			// Open restored database
			this._connection = await Zotero.Promise.resolve(this.Sqlite.openConnection({
				path: file
			}));
			this._debug('Database restored', 1);
			Zotero.alert(
				null,
				Zotero.getString('general.warning'),
				Zotero.getString('db.dbRestored', [
					fileName,
					Zotero.Date.getFileDateString(Zotero.File.pathToFile(backupFile)),
					Zotero.Date.getFileTimeString(Zotero.File.pathToFile(backupFile))
				])
			);
			
			if (await OS.File.exists(corruptMarker)) {
				await OS.File.remove(corruptMarker);
			}
			
			break catchBlock;
		}
		
		// Some other error that we don't yet know how to deal with
		throw (e);
	}
	
	if (!this._externalDB) {
		if (DB_LOCK_EXCLUSIVE) {
			await this.queryAsync("PRAGMA main.locking_mode=EXCLUSIVE");
		}
		else {
			await this.queryAsync("PRAGMA main.locking_mode=NORMAL");
		}
		
		// Set page cache size to 8MB
		let pageSize = await this.valueQueryAsync("PRAGMA page_size");
		let cacheSize = 8192000 / pageSize;
		await this.queryAsync("PRAGMA cache_size=" + cacheSize);
		
		// Enable foreign key checks
		await this.queryAsync("PRAGMA foreign_keys=true");
		
		// Register idle observer for DB backup
		Zotero.Schema.schemaUpdatePromise.then(() => {
			Zotero.debug("Initializing DB backup idle observer");
			var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
				.getService(Components.interfaces.nsIIdleService);
			idleService.addIdleObserver(this, 300);
		});
	}
	
	return this._connection;
};


Zotero.DBConnection.prototype._debug = function (str, level) {
	var prefix = this._dbName == 'zotero' ? '' : '[' + this._dbName + '] ';
	Zotero.debug(prefix + str, level);
}
