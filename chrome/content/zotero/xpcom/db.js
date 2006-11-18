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

Zotero.DB = new function(){
	// Private members
	var _connection;
	var _transactionRollback;
	var _transactionNestingLevel = 0;
	
	this.query = query;
	this.valueQuery = valueQuery;
	this.rowQuery = rowQuery;
	this.columnQuery = columnQuery;
	this.getStatement = getStatement;
	this.getLastInsertID = getLastInsertID;
	this.getLastErrorString = getLastErrorString;
	this.beginTransaction = beginTransaction;
	this.commitTransaction = commitTransaction;
	this.rollbackTransaction = rollbackTransaction;
	this.transactionInProgress = transactionInProgress;
	this.commitAllTransactions = commitAllTransactions;
	this.tableExists = tableExists;
	this.getColumns = getColumns;
	this.getColumnHash = getColumnHash;
	this.getNextID = getNextID;
	this.getNextName = getNextName;
	
	/////////////////////////////////////////////////////////////////
	//
	// Privileged methods
	//
	/////////////////////////////////////////////////////////////////
	
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
	function query(sql,params){
		var db = _getDBConnection();
		
		try {
			// Parse out the SQL command being used
			var op = sql.match(/^[^a-z]*[^ ]+/i);
			if (op){
				op = op.toString().toLowerCase();
			}
			
			// If SELECT statement, return result
			if (op=='select'){
				// Until the native dataset methods work (or at least exist),
				// we build a multi-dimensional associative array manually
				
				var statement = getStatement(sql, params);
				
				var dataset = new Array();
				while (statement.executeStep()){
					var row = new Array();
					
					for(var i=0; i<statement.columnCount; i++) {
						row[statement.getColumnName(i)] = _getTypedValue(statement, i);
					}
					dataset.push(row);
				}
				statement.reset();
				
				return dataset.length ? dataset : false;
			}
			else {
				if (params){
					var statement = getStatement(sql, params);
					statement.execute();
				}
				else {
					Zotero.debug(sql,5);
					db.executeSimpleSQL(sql);
				}
				
				if (op=='insert'){
					return db.lastInsertRowID;
				}
				// DEBUG: Can't get affected rows for UPDATE or DELETE?
				else {
					return true;
				}
			}
		}
		catch (e){
			var dberr = (db.lastErrorString!='not an error')
				? ' [ERROR: ' + db.lastErrorString + ']' : '';
			throw(e + ' [QUERY: ' + sql + ']' + dberr);
		}
	}
	
	
	/*
	 * Query a single value and return it
	 */
	function valueQuery(sql,params){
		var statement = getStatement(sql, params);
		
		// No rows
		if (!statement.executeStep()){
			statement.reset();
			return false;
		}
		
		var value = _getTypedValue(statement, 0);
		statement.reset();
		return value;
	}
	
	
	/*
	 * Run a query and return the first row
	 */
	function rowQuery(sql,params){
		var result = query(sql,params);
		if (result){
			return result[0];
		}
	}
	
	
	/*
	 * Run a query and return the first column as a numerically-indexed array
	 */
	function columnQuery(sql,params){
		var statement = getStatement(sql, params);
		
		if (statement){
			var column = new Array();
			while (statement.executeStep()){
				column.push(_getTypedValue(statement, 0));
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
	function getStatement(sql, params){
		var db = _getDBConnection();
		
		try {
			Zotero.debug(sql,5);
			var statement = db.createStatement(sql);
		}
		catch (e){
			var dberr = (db.lastErrorString!='not an error')
				? ' [ERROR: ' + db.lastErrorString + ']' : '';
			throw(e + ' [QUERY: ' + sql + ']' + dberr);
		}
		
		if (params){
			// If single scalar value or single non-array object, wrap in an array
			if (typeof params != 'object' || params===null ||
				(params && typeof params == 'object' && !params.length)){
				params = [params];
			}
			
			for (var i=0; i<params.length; i++){
				// Integer
				if (params[i]!==null && typeof params[i]['int'] != 'undefined'){
					var type = 'int';
					var value = params[i]['int'];
				}
				// String
				else if (params[i]!==null && typeof params[i]['string'] != 'undefined'){
					var type = 'string';
					var value = params[i]['string'];
				}
				// Null
				else if (params[i]!==null && typeof params[i]['null'] != 'undefined'){
					var type = 'null';
				}
				// Automatic (trust the JS type)
				else {
					switch (typeof params[i]){
						case 'string':
							var type = 'string';
							break;
						case 'number':
							var type = 'int';
							break;
						// Object
						default:
							if (params[i]===null){
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
				switch (type){
					case 'int':
						Zotero.debug('Binding parameter ' + (i+1)
							+ ' of type int: ' + value, 5);
						statement.bindInt32Parameter(i, value);
						break;
						
					case 'string':
						Zotero.debug('Binding parameter ' + (i+1)
							+ ' of type string: "' + value + '"', 5);
						statement.bindUTF8StringParameter(i, value);
						break;
						
					case 'null':
						Zotero.debug('Binding parameter ' + (i+1)
							+ ' of type NULL', 5);
						statement.bindNullParameter(i);
						break;
				}
			}
		}
		return statement;
	}
	
	
	/*
	 * Only for use externally with getStatement()
	 */
	function getLastInsertID(){
		var db = _getDBConnection();
		return db.lastInsertRowID;
	}
	
	
	/*
	 * Only for use externally with getStatement()
	 */
	function getLastErrorString(){
		var db = _getDBConnection();
		return db.lastErrorString;
	}
	
	
	function beginTransaction(){
		var db = _getDBConnection();
		
		if (db.transactionInProgress){
			_transactionNestingLevel++;
			Zotero.debug('Transaction in progress -- increasing level to '
				+ _transactionNestingLevel, 5);
		}
		else {
			Zotero.debug('Beginning DB transaction', 5);
			db.beginTransaction();
		}
	}
	
	
	function commitTransaction(){
		var db = _getDBConnection();
		
		if (_transactionNestingLevel){
			_transactionNestingLevel--;
			Zotero.debug('Decreasing transaction level to ' + _transactionNestingLevel, 5);
		}
		else if (_transactionRollback){
			Zotero.debug('Rolling back previously flagged transaction', 5);
			db.rollbackTransaction();
		}
		else {
			Zotero.debug('Committing transaction',5);
			try {
				db.commitTransaction();
			}
			catch(e){
				var dberr = (db.lastErrorString!='not an error')
					? ' [ERROR: ' + db.lastErrorString + ']' : '';
				throw(e + ' [QUERY: ' + sql + ']' + dberr);
			}
		}
	}
	
	
	function rollbackTransaction(){
		var db = _getDBConnection();
		
		if (_transactionNestingLevel){
			_transactionNestingLevel--;
			_transactionRollback = true;
			Zotero.debug('Flagging nested transaction for rollback', 5);
		}
		else {
			Zotero.debug('Rolling back transaction', 5);
			_transactionRollback = false;
			try {
				db.rollbackTransaction();
			}
			catch(e){
				var dberr = (db.lastErrorString!='not an error')
					? ' [ERROR: ' + db.lastErrorString + ']' : '';
				throw(e + dberr);
			}
		}
	}
	
	
	function transactionInProgress(){
		var db = _getDBConnection();
		return db.transactionInProgress;
	}
	
	
	/**
	 * Safety function used on shutdown to make sure we're not stuck in the
	 * middle of a transaction
	 */
	function commitAllTransactions(){
		if (transactionInProgress()){
			var level = _transactionNestingLevel;
			_transactionNestingLevel = 0;
			try {
				Zotero.DB.commitTransaction();
			}
			catch (e){}
			return level ? level : true;
		}
		return false;
	}
	
	
	function tableExists(table){
		return _getDBConnection().tableExists(table);
	}
	
	
	function getColumns(table){
		var db = _getDBConnection();
		
		try {
			var sql = "SELECT * FROM " + table + " LIMIT 1";
			var statement = getStatement(sql);
			var cols = new Array();
			for (var i=0,len=statement.columnCount; i<len; i++){
				cols.push(statement.getColumnName(i));
			}
			statement.reset();
			return cols;
		}
		catch (e){
			Zotero.debug(e,1);
			return false;
		}
	}
	
	
	function getColumnHash(table){
		var cols = getColumns(table);
		var hash = new Array();
		if (cols.length){
			for (var i=0; i<cols.length; i++){
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
	function getNextID(table, column){
		var sql = 'SELECT ' + column + ' FROM ' + table + ' ORDER BY ' + column;
		var vals = Zotero.DB.columnQuery(sql);
		
		if (!vals){
			return 1;
		}
		
		if (vals[0] === '0'){
			vals.shift();
		}
		
		for (var i=0, len=vals.length; i<len; i++){
			if (vals[i] != i+1){
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
	function getNextName(table, field, name)
	{
		var sql = "SELECT " + field + " FROM " + table + " WHERE " + field
			+ " LIKE ? ORDER BY " + field + " COLLATE NOCASE";
		var untitleds = Zotero.DB.columnQuery(sql, name + '%');
		
		if (!untitleds || untitleds[0]!=name){
			return name;
		}
		
		var i = 1;
		var num = 2;
		while (untitleds[i] && untitleds[i]==(name + ' ' + num)){
			while (untitleds[i+1] && untitleds[i]==untitleds[i+1]){
				Zotero.debug('Next ' + i + ' is ' + untitleds[i]);
				i++;
			}
			
			i++;
			num++;
		}
		
		return name + ' ' + num;
	}
	
	
	
	/////////////////////////////////////////////////////////////////
	//
	// Private methods
	//
	/////////////////////////////////////////////////////////////////
	
	/*
	 * Retrieve a link to the data store
	 */
	function _getDBConnection(){
		if (_connection){
			return _connection;
		}
		
		// Get the storage service
		var store = Components.classes["@mozilla.org/storage/service;1"].
			getService(Components.interfaces.mozIStorageService);
		
		var file = Zotero.getZoteroDatabase();
		var backupFile = Zotero.getZoteroDatabase('bak');
		
		if (ZOTERO_CONFIG['DB_REBUILD']){
			if (confirm('Erase all user data and recreate database from schema?')){
				// Delete existing Zotero database
				if (file.exists()){
					file.remove(null);
				}
				
				// Delete existing storage folder
				var dir = Zotero.getStorageDirectory();
				if (dir.exists()){
					dir.remove(true);
				}
			}
		}
		
		// DEBUG: Temporary check
		// Test the backup file (to make sure the backup mechanism is working)
		if (backupFile.exists()){
			try {
				_connection = store.openDatabase(backupFile);
			}
			catch (e){
				Zotero.debug('Backup file was corrupt', 1);
			}
			_connection = undefined;
		}
		
		catchBlock: try {
			_connection = store.openDatabase(file);
		}
		catch (e){
			if (e.name=='NS_ERROR_FILE_CORRUPTED'){
				Zotero.debug('Database file corrupted', 1);
				
				// No backup file! Eek!
				if (!backupFile.exists()){
					Zotero.debug('No backup file exists', 1);
					
					// Save damaged filed
					Zotero.debug('Saving damaged DB file with .damaged extension', 1);
					var damagedFile = Zotero.getZoteroDatabase('damaged');
					Zotero.moveToUnique(file, damagedFile);
					
					// Create new main database
					var file = Zotero.getZoteroDatabase();
					_connection = store.openDatabase(file);
					
					alert(Zotero.getString('db.dbCorruptedNoBackup'));
					break catchBlock;
				}
				
				// Save damaged file
				Zotero.debug('Saving damaged DB file with .damaged extension', 1);
				var damagedFile = Zotero.getZoteroDatabase('damaged');
				Zotero.moveToUnique(file, damagedFile);
				
				// Test the backup file
				try {
					_connection = store.openDatabase(backupFile);
				}
				// Can't open backup either
				catch (e){
					// Create new main database
					var file = Zotero.getZoteroDatabase();
					_connection = store.openDatabase(file);
					
					alert(Zotero.getString('db.dbRestoreFailed'));
					break catchBlock;
				}
				
				_connection = undefined;
				
				// Copy backup file to main DB file
				Zotero.debug('Restoring main database from backup file', 1);
				try {
					backupFile.copyTo(backupFile.parent, ZOTERO_CONFIG['DB_FILE']);
				}
				catch (e){
					// TODO: deal with low disk space
					throw (e);
				}
				
				// Open restored database
				var file = Zotero.getZoteroDirectory();
				file.append(ZOTERO_CONFIG['DB_FILE']);
				_connection = store.openDatabase(file);
				Zotero.debug('Database restored', 1);
				var msg = Zotero.getString('db.dbRestored', [
					Zotero.Date.getFileDateString(backupFile),
					Zotero.Date.getFileTimeString(backupFile)
				]);
				alert(msg);
				
				break catchBlock;
			}
			
			// Some other error that we don't yet know how to deal with
			throw (e);
		}
		
		return _connection;
	}
	
	
	function _getTypedValue(statement, i){
		var type = statement.getTypeOfIndex(i);
		switch (type){
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
}
