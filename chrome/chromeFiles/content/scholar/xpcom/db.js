/*
 * DB connection and schema management class
 */
Scholar.DB = new function(){
	// Private members
	var _connection;
	var _transactionRollback;
	var _transactionNestingLevel = 0;
	
	// Privileged methods
	this.query = query;
	this.valueQuery = valueQuery;
	this.rowQuery = rowQuery;
	this.columnQuery = columnQuery;
	this.statementQuery = statementQuery;
	this.getColumns = getColumns;
	this.getColumnHash = getColumnHash;
	this.beginTransaction = beginTransaction;
	this.commitTransaction = commitTransaction;
	this.rollbackTransaction = rollbackTransaction;
	this.transactionInProgress = transactionInProgress;
	this.tableExists = tableExists;
	
	/////////////////////////////////////////////////////////////////
	//
	// Privileged methods
	//
	/////////////////////////////////////////////////////////////////
	
	/*
	 * Run an SQL query
	 *
	 *  Optional _params_ is an array of bind parameters in the form
	 *		[{'int':2},{'string':'foobar'}]
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
				
				var statement = statementQuery(sql,params);
				
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
					var statement = statementQuery(sql,params);
					statement.execute();
				}
				else {
					Scholar.debug(sql,5);
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
			throw(e + ' [QUERY: ' + sql + '] [ERROR: ' + db.lastErrorString + ']');
		}
	}
	
	
	/*
	 * Query a single value and return it
	 */
	function valueQuery(sql,params){
		var db = _getDBConnection();
		try {
			var statement = statementQuery(sql,params);
		}
		catch (e){
			throw(db.lastErrorString);
		}
		
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
		var statement = statementQuery(sql,params);
		
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
	 * Run a query, returning a mozIStorageStatement for direct manipulation
	 *
	 *  Optional _params_ is an array of bind parameters in the form
	 *		[{'int':2},{'string':'foobar'}]
	 */
	function statementQuery(sql,params){
		var db = _getDBConnection();
		
		try {
			Scholar.debug(sql,5);
			var statement = db.createStatement(sql);
		}
		catch (e){
			throw('[QUERY: ' + sql + '] [ERROR: ' + db.lastErrorString + ']');
		}
		
		if (statement && params){
			for (var i=0; i<params.length; i++){
				// Int
				if (typeof params[i]['int'] != 'undefined'){
					Scholar.debug('Binding parameter ' + (i+1) + ' of type int: ' +
						params[i]['int'],5);
					statement.bindInt32Parameter(i,params[i]['int']);
				}
				// String
				else if (typeof params[i]['string'] != 'undefined'){
					Scholar.debug('Binding parameter ' + (i+1) + ' of type string: "' +
						params[i]['string'] + '"',5);
					statement.bindUTF8StringParameter(i,params[i]['string']);
				}
				// Null
				else if (typeof params[i]['null'] != 'undefined'){
					Scholar.debug('Binding parameter ' + (i+1) + ' of type NULL', 5);
					statement.bindNullParameter(i);
				}
			}
		}
		return statement;
	}
	
	
	function beginTransaction(){
		var db = _getDBConnection();
		
		if (db.transactionInProgress){
			_transactionNestingLevel++;
			Scholar.debug('Transaction in progress -- increasing level to '
				+ _transactionNestingLevel, 5);
		}
		else {
			Scholar.debug('Beginning DB transaction', 5);
			db.beginTransaction();
		}
	}
	
	
	function commitTransaction(){
		var db = _getDBConnection();
		
		if (_transactionNestingLevel){
			_transactionNestingLevel--;
			Scholar.debug('Decreasing transaction level to ' + _transactionNestingLevel, 5);
		}
		else if (_transactionRollback){
			Scholar.debug('Rolling back previously flagged transaction', 5);
			db.rollbackTransaction();
		}
		else {
			Scholar.debug('Committing transaction',5);
			try {
				db.commitTransaction();
			}
			catch(e){
				throw(e + ' [ERROR: ' + db.lastErrorString + ']');
			}
		}
	}
	
	
	function rollbackTransaction(){
		var db = _getDBConnection();
		
		if (_transactionNestingLevel){
			Scholar.debug('Flagging nested transaction for rollback', 5);
			_transactionRollback = true;
		}
		else {
			Scholar.debug('Rolling back transaction', 5);
			_transactionRollback = false;
			try {
				db.rollbackTransaction();
			}
			catch(e){
				throw(e + ' [ERROR: ' + db.lastErrorString + ']');
			}
		}
	}
	
	
	function transactionInProgress(){
		var db = _getDBConnection();
		return db.transactionInProgress;
	}
	
	
	function tableExists(table){
		return _getDBConnection().tableExists(table);
	}
	
	
	function getColumns(table){
		var db = _getDBConnection();
		
		try {
			var sql = "SELECT * FROM " + table + " LIMIT 1";
			var statement = statementQuery(sql);
			
			var cols = new Array();
			for (var i=0,len=statement.columnCount; i<len; i++){
				cols.push(statement.getColumnName(i));
			}
			return cols;
		}
		catch (e){
			Scholar.debug(e,1);
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
		
		// Get the profile directory
		var file = Components.classes["@mozilla.org/file/directory_service;1"]
			.getService(Components.interfaces.nsIProperties)
			.get("ProfD", Components.interfaces.nsILocalFile);
		
		// This makes file point to PROFILE_DIR/<scholar database file>
		file.append(SCHOLAR_CONFIG['DB_FILE']);
		
		_connection = store.openDatabase(file);
		
		return _connection;
	}
	
	
	function _getTypedValue(statement, i){
		var type = statement.getTypeOfIndex(i);
		switch (type){
			case statement.VALUE_TYPE_INTEGER:
				var func = statement.getInt32;
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
