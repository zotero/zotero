var scholarDB = new Scholar_DB();

/*
 * DB connection and schema management class
 */
function Scholar_DB(){
	// Private members
	var _connection;
	
	// Privileged methods
	this.query = query;
	this.valueQuery = valueQuery;
	this.rowQuery = rowQuery;
	this.statementQuery = statementQuery;
	this.updateSchema = updateSchema;
	
	
	/////////////////////////////////////////////////////////////////
	//
	// Privileged methods
	//
	/////////////////////////////////////////////////////////////////
	
	/*
	 * Run an SQL query
	 *
	 * 	Returns:
	 *  	 - mozIStorageStatementWrapper for SELECT's
	 *	 - lastInsertId for INSERT's
	 *	 - TRUE for other successful queries
	 *	 - FALSE on error
	 */
	function query(sql){
		var db = _getDBConnection();
		
		try {
			// Parse out the SQL command being used
			var op = sql.match(/^[^a-z]*[^ ]+/i).toString().toLowerCase();
			
			// If SELECT statement, return result
			if (op=='select'){
				var wrapper =
					Components.classes['@mozilla.org/storage/statement-wrapper;1']
					.createInstance(Components.interfaces.mozIStorageStatementWrapper);
				
				wrapper.initialize(db.createStatement(sql));
				return wrapper;
			}
			else {
				db.executeSimpleSQL(sql);
				
				if (op=='insert'){
					return db.lastInsertId;
				}
				// DEBUG: Can't get affected rows for UPDATE or DELETE?
				else {
					return true;
				}
			}
		}
		catch(ex){
			alert(db.lastErrorString);
			return false;
		}
	}
	
	
	/*
	 * Query a single value and return it
	 */
	function valueQuery(sql){
		var db = _getDBConnection();
		try {
			var statement = db.createStatement(sql);
		}
		catch (e){
			alert(db.lastErrorString);
			return false;
		}
		
		// No rows
		if (!statement.executeStep()){
			return false;
		}
		var value = statement.getAsUTF8String(0);
		statement.reset();
		return value;
	}
	
	
	/*
	 * Run a query and return the first row
	 */
	function rowQuery(sql){
		var result = query(sql);
		if (result && result.step()){
			return result.row;
		}
	}
	
	
	/*
	 * Run a query, returning a mozIStorageStatement for direct manipulation
	 */
	function statementQuery(sql){
		var db = _getDBConnection();
		
		try {
			return db.createStatement(sql);
		}
		catch (e){
			return false;
		}
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
				dump('Database does not exist -- creating\n');
				return _initializeSchema();
			}
			
			return _migrateSchema(DBVersion);
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
	 */
	function _getSchemaSQL(){
		// We pull the schema from an external file so we only have to process
		// it when necessary
		var req = new XMLHttpRequest();
		req.open("GET", "chrome://scholar/content/schema.xml", false);
		req.send(null);
		
		var schemaVersion =
			req.responseXML.documentElement.getAttribute('version');
		
		if (schemaVersion!=SCHOLAR_CONFIG['DB_VERSION']){
			throw("Scholar config version does not match schema version");
		}
		
		return req.responseXML.documentElement.firstChild.data;
	}
	
	
	/*
	 * Retrieve the version attribute of the schema SQL XML
	 */
	function _getSchemaSQLVersion(){
		var req = new XMLHttpRequest();
		req.open("GET", "chrome://scholar/content/schema.xml", false);
		req.send(null);
		return req.responseXML.documentElement.getAttribute('version');
	}
	
	
	/*
	 * Create new DB schema
	 */
	function _initializeSchema(){
		query(_getSchemaSQL());
		query("INSERT INTO version VALUES (" + SCHOLAR_CONFIG['DB_VERSION'] + ")");
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
		
		dump('Updating DB from version ' + fromVersion + ' to ' + toVersion + '\n');
		
		// Step through version changes until we reach the current version
		//
		// Each block performs the changes necessary to move from the
		// previous revision to that one. 
		//
		// N.B. Be sure to call _updateDBVersion(i) at the end of each block!
		for (var i=fromVersion+1; i<=toVersion; i++){
			
			if (i==1){
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
