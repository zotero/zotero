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

Zotero.DBConnection = function(dbName) {
	if (!dbName) {
		throw ('DB name not provided in Zotero.DBConnection()');
	}
	
	this.skipBackup = false;
	this.transactionVacuum = false;
	
	// JS Date
	this.__defineGetter__('transactionDate', function () {
		if (this._transactionDate) {
			return this._transactionDate;
		}
		// Use second granularity rather than millisecond
		// for comparison purposes
		return new Date(Math.floor(new Date / 1000) * 1000);
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
	this._transactionDate = null;
	this._transactionRollback = null;
	this._transactionNestingLevel = 0;
	this._callbacks = { begin: [], commit: [], rollback: [] };
	this._dbIsCorrupt = null
	this._self = this;
}

/////////////////////////////////////////////////////////////////
//
// Public methods
//
/////////////////////////////////////////////////////////////////

/**
 * Test a connection to the database, throwing any errors that occur
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
	var db = this._getDBConnection();
	
	try {
		// Parse out the SQL command being used
		var op = sql.match(/^[^a-z]*[^ ]+/i);
		if (op) {
			op = op.toString().toLowerCase();
		}
		
		// If SELECT statement, return result
		if (op == 'select') {
			// Until the native dataset methods work (or at least exist),
			// we build a multi-dimensional associative array manually
			
			var statement = this.getStatement(sql, params, true);
			
			var dataset = new Array();
			while (statement.executeStep()) {
				var row = new Array();
				
				for(var i=0, len=statement.columnCount; i<len; i++) {
					row[statement.getColumnName(i)] = this._getTypedValue(statement, i);
				}
				dataset.push(row);
			}
			statement.reset();
			
			return dataset.length ? dataset : false;
		}
		else {
			if (params) {
				var statement = this.getStatement(sql, params, true);
				statement.execute();
			}
			else {
				this._debug(sql,5);
				db.executeSimpleSQL(sql);
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
		
		var dberr = (db.lastErrorString!='not an error')
			? ' [ERROR: ' + db.lastErrorString + ']' : '';
		throw(e + ' [QUERY: ' + sql + ']' + dberr);
	}
}


/*
 * Query a single value and return it
 */
Zotero.DBConnection.prototype.valueQuery = function (sql,params) {
	var statement = this.getStatement(sql, params, true);
	
	// No rows
	if (!statement.executeStep()) {
		statement.reset();
		return false;
	}
	
	var value = this._getTypedValue(statement, 0);
	statement.reset();
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
	var statement = this.getStatement(sql, params, true);
	
	if (statement) {
		var column = new Array();
		while (statement.executeStep()) {
			column.push(this._getTypedValue(statement, 0));
		}
		statement.reset();
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
Zotero.DBConnection.prototype.getStatement = function (sql, params, checkParams) {
	var db = this._getDBConnection();
	
	try {
		this._debug(sql,5);
		var statement = db.createStatement(sql);
	}
	catch (e) {
		var dberr = (db.lastErrorString!='not an error')
			? ' [ERROR: ' + db.lastErrorString + ']' : '';
		throw(e + ' [QUERY: ' + sql + ']' + dberr);
	}
	
	var numParams = statement.parameterCount;
	
	if (params) {
		// If single scalar value or single non-array object, wrap in an array
		if (typeof params != 'object' || params === null ||
			(params && typeof params == 'object' && !params.length)) {
			params = [params];
		}
		
		if (checkParams) {
			if (numParams == 0) {
				throw ("Parameters provided for query without placeholders");
			}
			else if (numParams != params.length) {
				throw ("Incorrect number of parameters provided for query "
					+ "(" + params.length + ", expecting " + numParams + ")");
			}
		}
		
		for (var i=0; i<params.length; i++) {
			// Integer
			if (params[i]!==null && typeof params[i]['int'] != 'undefined') {
				var type = 'int';
				var value = params[i]['int'];
			}
			// String
			else if (params[i]!==null && typeof params[i]['string'] != 'undefined') {
				var type = 'string';
				var value = params[i]['string'];
			}
			// Null
			else if (params[i]!==null && typeof params[i]['null'] != 'undefined') {
				var type = 'null';
			}
			// Automatic (trust the JS type)
			else {
				switch (typeof params[i]) {
					case 'string':
						var type = 'string';
						break;
					case 'number':
						var type = 'int';
						break;
					// Object
					default:
						if (params[i]===null) {
							var type = 'null';
						}
						else {
							throw('Invalid bound parameter ' + params[i] +
								' in ' + Zotero.varDump(params));
						}
				}
				var value = params[i];
			}
			
			// Bind the parameter as the correct type
			switch (type) {
				case 'int':
					var intVal = parseInt(value);
					if (isNaN(intVal)) {
						throw ("Invalid integer value '" + value + "'")
					}
					
					// Store as 32-bit signed integer
					if (intVal <= 2147483647) {
						this._debug('Binding parameter ' + (i+1)
							+ ' of type int: ' + value, 5);
						statement.bindInt32Parameter(i, intVal);
					}
					// Store as 64-bit signed integer
					// 2^53 is JS's upper-bound for decimal integers
					else if (intVal < 9007199254740992) {
						this._debug('Binding parameter ' + (i+1)
							+ ' of type int64: ' + value, 5);
						statement.bindInt64Parameter(i, intVal);
					}
					else {
						throw ("Integer value '" + intVal + "' too large");
					}
					
					break;
					
				case 'string':
					this._debug('Binding parameter ' + (i+1)
						+ ' of type string: "' + value + '"', 5);
					statement.bindUTF8StringParameter(i, value);
					break;
					
				case 'null':
					this._debug('Binding parameter ' + (i+1)
						+ ' of type NULL', 5);
					statement.bindNullParameter(i);
					break;
			}
		}
	}
	else {
		if (checkParams && numParams > 0) {
			throw ("No parameters provided for query containing placeholders");
		}
	}
	return statement;
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
		this._transactionNestingLevel++;
		this._debug('Transaction in progress -- increasing level to '
			+ this._transactionNestingLevel, 5);
	}
	else {
		this._debug('Beginning DB transaction', 5);
		db.beginTransaction();
		
		// Set a timestamp for this transaction
		this._transactionDate = new Date(Math.floor(new Date / 1000) * 1000);
		
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
		
		// Clear transaction timestamp
		this._transactionDate = null;
		
		try {
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
	var db = this._getDBConnection();
	
	try {
		var sql = "SELECT * FROM " + table + " LIMIT 1";
		var statement = this.getStatement(sql);
		var cols = new Array();
		for (var i=0,len=statement.columnCount; i<len; i++) {
			cols.push(statement.getColumnName(i));
		}
		statement.reset();
		return cols;
	}
	catch (e) {
		this._debug(e,1);
		return false;
	}
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
Zotero.DBConnection.prototype.getNextName = function (table, field, name)
{
	var sql = "SELECT " + field + " FROM " + table + " WHERE " + field
		+ " LIKE ? ORDER BY " + field + " COLLATE NOCASE";
	var untitleds = this.columnQuery(sql, name + '%');
	
	if (!untitleds || untitleds[0]!=name) {
		return name;
	}
	
	var i = 1;
	var num = 2;
	while (untitleds[i] && untitleds[i]==(name + ' ' + num)) {
		while (untitleds[i+1] && untitleds[i]==untitleds[i+1]) {
			this._debug('Next ' + i + ' is ' + untitleds[i]);
			i++;
		}
		
		i++;
		num++;
	}
	
	return name + ' ' + num;
}


/*
 * Shutdown observer -- implements nsIObserver
 */
Zotero.DBConnection.prototype.observe = function(subject, topic, data) {
	switch (topic) {
		case 'xpcom-shutdown':
			if (this._shutdown) {
				this._debug('returning');
				return;
			}
			
			// NOTE: disabled
			//var level = this.commitAllTransactions();
			var level = this.rollbackAllTransactions()
			if (level) {
				level = level === true ? '0' : level;
				this._debug("A transaction in DB '" + this._dbName + "' was still open! (level " + level + ")", 2);
			}
			
			this._shutdown = true;
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
		var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
						 .createInstance(Components.interfaces.nsIFileOutputStream);
		foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0); // write, create, truncate
		foStream.write('', 0);
		foStream.close();
		
		this._dbIsCorrupt = true;
		
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING);
		
		var index = ps.confirmEx(null,
			Zotero.getString('general.error'),
			Zotero.getString('db.dbCorrupted', this._dbName) + '\n\n' + Zotero.getString('db.dbCorrupted.restart'),
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


Zotero.DBConnection.prototype.backupDatabase = function (suffix) {
	if (this.transactionInProgress()) {
		this._debug("Transaction in progress--skipping backup of DB '" + this._dbName + "'", 2);
		return false;
	}
	
	var corruptMarker = Zotero.getZoteroDatabase(this._dbName, 'is.corrupt').exists();
	
	if (this.skipBackup) {
		this._debug("Skipping backup of database '" + this._dbName + "'", 1);
		return false;
	}
	else if (this._dbIsCorrupt || corruptMarker) {
		this._debug("Database '" + this._dbName + "' is marked as corrupt--skipping backup", 1);
		return false;
	}
	
	this._debug("Backing up database '" + this._dbName + "'");
	
	var file = Zotero.getZoteroDatabase(this._dbName);
	var backupFile = Zotero.getZoteroDatabase(this._dbName,
		(suffix ? suffix + '.' : '') + 'bak');
	
	// Copy via a temporary file so we don't run into disk space issues
	// after deleting the old backup file
	var tmpFile = Zotero.getZoteroDatabase(this._dbName, 'tmp');
	if (tmpFile.exists()) {
		tmpFile.remove(null);
	}
	
	try {
		file.copyTo(file.parent, tmpFile.leafName);
	}
	catch (e){
		// TODO: deal with low disk space
		throw (e);
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
	
	// Remove old backup file
	if (backupFile.exists()) {
		backupFile.remove(null);
	}
	
	tmpFile.moveTo(tmpFile.parent, backupFile.leafName);
	
	return true;
}


/*
 * Keep the SQLite shared cache live between transactions with a dummy statement,
 * which speeds up DB access dramatically (at least on Windows and Linux--OS X
 * seems to be much faster already, perhaps due to its own disk cache)
 *
 * This is the same technique used by Mozilla code. The one downside is that it
 * prevents schema changes, so this is called after schema updating. If the
 * schema really needs to be updated at another point, use stopDummyStatement().
 *
 * See http://developer.mozilla.org/en/docs/Storage:Performance for more info.
 */
Zotero.DBConnection.prototype.startDummyStatement = function () {
	try {
		if (!this._dummyConnection) {
			this._debug("Opening database '" + this._dbName + " for dummy statement");
			// Get the storage service
			var store = Components.classes["@mozilla.org/storage/service;1"].
				getService(Components.interfaces.mozIStorageService);
			var file = Zotero.getZoteroDatabase(this._dbName);
			this._dummyConnection = store.openDatabase(file);
		}
		
		if (this._dummyStatement) {
			Zotero.debug("Dummy statement is already open");
			return;
		}
		
		Zotero.debug("Initializing dummy statement for '" + this._dbName + "'");
		
		var sql = "CREATE TABLE IF NOT EXISTS zoteroDummyTable (id INTEGER PRIMARY KEY)";
		this._dummyConnection.executeSimpleSQL(sql);
		
		sql = "INSERT OR IGNORE INTO zoteroDummyTable VALUES (1)";
		this._dummyConnection.executeSimpleSQL(sql);
		
		sql = "SELECT id FROM zoteroDummyTable LIMIT 1"
		this._dummyStatement = this._dummyConnection.createStatement(sql)
		this._dummyStatement.executeStep()
	
	}
	catch (e) {
		Components.utils.reportError(e);
		Zotero.debug(e);
	}
}


/*
 * Stop the dummy statement temporarily to allow for schema changess
 *
 * The statement needs to be started again or performance will suffer.
 */
Zotero.DBConnection.prototype.stopDummyStatement = function () {
	if (!this._dummyStatement) {
		return;
	}
	
	Zotero.debug("Stopping dummy statement for '" + this._dbName + "'");
	this._dummyStatement.reset();
	this._dummyStatement = null;
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
	}
	
	this._debug("Opening database '" + this._dbName + "'");
	
	// Get the storage service
	var store = Components.classes["@mozilla.org/storage/service;1"].
		getService(Components.interfaces.mozIStorageService);
	
	var file = Zotero.getZoteroDatabase(this._dbName);
	var backupFile = Zotero.getZoteroDatabase(this._dbName, 'bak');
	
	var fileName = this._dbName + '.sqlite';
	
	if (this._dbName == 'zotero' && ZOTERO_CONFIG['DB_REBUILD']) {
		if (confirm('Erase all user data and recreate database from schema?')) {
			// Delete existing Zotero database
			if (file.exists()) {
				file.remove(null);
			}
			
			// Delete existing storage folder
			var dir = Zotero.getStorageDirectory();
			if (dir.exists()) {
				dir.remove(true);
			}
		}
	}
	
	catchBlock: try {
		var corruptMarker = Zotero.getZoteroDatabase(this._dbName, 'is.corrupt');
		if (corruptMarker.exists()) {
			throw({ name: 'NS_ERROR_FILE_CORRUPTED' })
		}
		this._connection = store.openDatabase(file);
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
				this._connection = store.openDatabase(file);
				
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
				this._connection = store.openDatabase(backupFile);
			}
			// Can't open backup either
			catch (e) {
				// Create new main database
				var file = Zotero.getZoteroDatabase(this._dbName);
				this._connection = store.openDatabase(file);
				
				alert(Zotero.getString('db.dbRestoreFailed', fileName));
				
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
	
	// Exclusive locking mode (default) prevents access to Zotero database
	// while Firefox is open -- normal mode is more convenient for development
	if (Zotero.Prefs.get('dbLockExclusive')) {
		Zotero.DB.query("PRAGMA locking_mode=EXCLUSIVE");
	}
	else {
		Zotero.DB.query("PRAGMA locking_mode=NORMAL");
	}
	
	// Register shutdown handler to call this.observe() for DB backup
	var observerService = Components.classes["@mozilla.org/observer-service;1"]
		.getService(Components.interfaces.nsIObserverService);
	observerService.addObserver(this, "xpcom-shutdown", false);
	observerService = null;
	
	// User-defined functions
	// TODO: move somewhere else?
	
	// Levenshtein distance UDF
	var lev = {
		ZU: new Zotero.Utilities,
		onFunctionCall: function (arg) {
			var a = arg.getUTF8String(0);
			var b = arg.getUTF8String(1);
			return this.ZU.levenshtein(a, b);
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
	
	
	return this._connection;
}


Zotero.DBConnection.prototype._debug = function (str, level) {
	var prefix = this._dbName == 'zotero' ? '' : '[' + this._dbName + '] ';
	Zotero.debug(prefix + str, level);
}


Zotero.DBConnection.prototype._getTypedValue = function (statement, i) {
	var type = statement.getTypeOfIndex(i);
	switch (type) {
		case statement.VALUE_TYPE_INTEGER:
			var func = statement.getInt64;
			break;
		case statement.VALUE_TYPE_TEXT:
			var func = statement.getUTF8String;
			break;
		case statement.VALUE_TYPE_NULL:
			return null;
		case statement.VALUE_TYPE_FLOAT:
			var func = statement.getDouble;
			break;
		case statement.VALUE_TYPE_BLOB:
			var func = statement.getBlob;
			break;
	}
	
	return func(i);
}


// Initialize main database connection
Zotero.DB = new Zotero.DBConnection('zotero');
