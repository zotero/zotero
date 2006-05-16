/*
 * DB connection and schema management class
 */
Scholar.DB = new function(){
	// Private members
	var _connection;
	
	// Privileged methods
	this.query = query;
	this.valueQuery = valueQuery;
	this.rowQuery = rowQuery;
	this.columnQuery = columnQuery;
	this.statementQuery = statementQuery;
	this.getColumns = getColumns;
	this.getColumnHash = getColumnHash;
	this.updateSchema = updateSchema;
	this.beginTransaction = beginTransaction;
	this.commitTransaction = commitTransaction;
	this.rollbackTransaction = rollbackTransaction;
	
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
						row[statement.getColumnName(i)] = statement.getUTF8String(i);
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
			throw(e + ' (SQL error: ' + db.lastErrorString + ')');
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
		if (sql.indexOf('SELECT COUNT(*)') > -1){
			var value = statement.getInt32(0);
		}
		else {
			var value = statement.getUTF8String(0);
		}
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
				column.push(statement.getUTF8String(0));
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
			throw(db.lastErrorString);
		}
		
		if (statement && params){
			for (var i=0; i<params.length; i++){
				if (typeof params[i]['int'] != 'undefined'){
					Scholar.debug('Binding parameter ' + (i+1) + ': ' +
						params[i]['int'],5);
					statement.bindInt32Parameter(i,params[i]['int']);
				}
				else if (typeof params[i]['string'] != 'undefined'){
					Scholar.debug('Binding parameter ' + (i+1) + ': "' +
						params[i]['string'] + '"',5);
					statement.bindUTF8StringParameter(i,params[i]['string']);
				}
			}
		}
		return statement;
	}
	
	
	function beginTransaction(){
		var db = _getDBConnection();
		Scholar.debug('Beginning DB transaction',5);
		db.beginTransaction();
	}
	
	
	function commitTransaction(){
		var db = _getDBConnection();
		Scholar.debug('Committing transaction',5);
		db.commitTransaction();
	}
	
	
	function rollbackTransaction(){
		var db = _getDBConnection();
		Scholar.debug('Rolling back transaction',5);
		db.rollbackTransaction();
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
	
	/*
	 * Checks if the DB schema exists and is up-to-date, updating if necessary
	 */
	function updateSchema(){
		var DBVersion = _getDBVersion();
		
		if (DBVersion > SCHOLAR_CONFIG['DB_VERSION']){
			throw("Scholar DB version is newer than config version");
		}
		else if (DBVersion < SCHOLAR_CONFIG['DB_VERSION']){
			if (!DBVersion){
				Scholar.debug('Database does not exist -- creating\n');
				return _initializeSchema();
			}
			
			return _migrateSchema(DBVersion);
		}
		else if (SCHOLAR_CONFIG['DB_REBUILD']){
			if (confirm('Erase all data and recreate database from schema?')){
				return _initializeSchema();
			}
		}
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
	
	
	/*
	 * Retrieve the DB schema version
	 */
	function _getDBVersion(){
		if (_getDBConnection().tableExists('version')){
			return valueQuery("SELECT version FROM version;");
		}
		return false;
	}
	
	
	/*
	 * Load in SQL schema
	 *
	 * Returns an _array_ of SQL statements for feeding into query()
	 */
	function _getSchemaSQL(){
		// We pull the schema from an external file so we only have to process
		// it when necessary
		var file = Components.classes["@mozilla.org/extensions/manager;1"]
                    .getService(Components.interfaces.nsIExtensionManager)
                    .getInstallLocation(SCHOLAR_CONFIG['GUID'])
                    .getItemLocation(SCHOLAR_CONFIG['GUID']); 
		file.append('schema.sql');
		
		// Open an input stream from file
		var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		istream.init(file, 0x01, 0444, 0);
		istream.QueryInterface(Components.interfaces.nsILineInputStream);
		
		var line = {}, sql = '', hasmore;
		
		// Fetch the schema version from the first line of the file
		istream.readLine(line);
		var schemaVersion = line.value.match(/-- ([0-9]+)/)[1];
		
		do {
			hasmore = istream.readLine(line);
			sql += line.value + "\n";
		} while(hasmore);
		
		istream.close();
		
		if (schemaVersion!=SCHOLAR_CONFIG['DB_VERSION']){
			throw("Scholar config version does not match schema version");
		}
		
		return sql;
	}
	
	
	/*
	 * Retrieve the version attribute of the schema SQL XML
	 */
	function _getSchemaSQLVersion(){
		var file = Components.classes["@mozilla.org/extensions/manager;1"]
                    .getService(Components.interfaces.nsIExtensionManager)
                    .getInstallLocation(SCHOLAR_CONFIG['GUID'])
                    .getItemLocation(SCHOLAR_CONFIG['GUID']); 
		file.append('schema.sql');
		
		// Open an input stream from file
		var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		istream.init(file, 0x01, 0444, 0);
		istream.QueryInterface(Components.interfaces.nsILineInputStream);
		
		var line = {};
		
		// Fetch the schema version from the first line of the file
		istream.readLine(line);
		var schemaVersion = line.value.match(/-- ([0-9]+)/)[1];
		istream.close();
		
		return schemaVersion;
	}
	
	
	/*
	 * Create new DB schema
	 */
	function _initializeSchema(){
		try {
			beginTransaction();
			var sql = _getSchemaSQL();
			query(sql);
			query("INSERT INTO version VALUES (" + SCHOLAR_CONFIG['DB_VERSION'] + ")");
			commitTransaction();
		}
		catch(e){
			alert(e);
			rollbackTransaction();
		}
	}
	
	
	/*
	 * Migrate schema from an older version, preserving data
	 */
	function _migrateSchema(fromVersion){
		var toVersion = SCHOLAR_CONFIG['DB_VERSION'];
		var schemaVersion = _getSchemaSQLVersion();
		
		if (toVersion!=schemaVersion){
			throw("Scholar config version does not match schema version");
		}
		
		Scholar.debug('Updating DB from version ' + fromVersion + ' to ' + toVersion + '\n');
		
		// Step through version changes until we reach the current version
		//
		// Each block performs the changes necessary to move from the
		// previous revision to that one.
		//
		// N.B. Be sure to call _updateDBVersion(i) at the end of each block!
		for (var i=parseInt(fromVersion) + 1; i<=toVersion; i++){
			
			// For now, just wipe and recreate
			if (i==4){
				_initializeSchema();
			}
			
			if (i==5){
				query("UPDATE folders SET level=-1, parentFolderID=NULL WHERE folderID=0");
				_updateDBVersion(i);
			}
			
			if (i==6){
				// do stuff
				// _updateDBVersion(i);
			}
		}
	}
	
	
	/*
	 * Update the DB schema version tag of an existing database
	 */
	function _updateDBVersion(version){
		return query("UPDATE version SET version=" + version);
	}
}
