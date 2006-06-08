Scholar.Schema = new function(){
	var _dbVersions = [];
	var _schemaVersions = [];
	
	this.updateSchema = updateSchema;
	
	/*
	 * Checks if the DB schema exists and is up-to-date, updating if necessary
	 */
	function updateSchema(){
		var dbVersion = _getDBVersion();
		var schemaVersion = _getSchemaSQLVersion();
		
		if (dbVersion == schemaVersion){
			if (SCHOLAR_CONFIG['DB_REBUILD']){
				if (confirm('Erase all data and recreate database from schema?')){
					_initializeSchema();
					return;
				}
			}
			
			_updateScrapers();
			return;
		}
		// If DB version is less than schema file, create or update
		else if (dbVersion < schemaVersion){
			if (!dbVersion){
				Scholar.debug('Database does not exist -- creating\n');
				_initializeSchema();
				return;
			}
			
			_migrateSchema(dbVersion);
			_updateScrapers();
			return;
		}
		else {
			throw("Scholar DB version is newer than schema version");
		}
	}
	
	
	/////////////////////////////////////////////////////////////////
	//
	// Private methods
	//
	/////////////////////////////////////////////////////////////////
	
	/*
	 * Retrieve the DB schema version
	 */
	function _getDBVersion(schema){
		// Default to schema.sql
		if (!schema){
			schema = 'schema';
		}
		
		if (_dbVersions[schema]){
			return _dbVersions[schema];
		}
		
		if (Scholar.DB.tableExists('version')){
			try {
				var dbVersion = Scholar.DB.valueQuery("SELECT version FROM "
					+ "version WHERE schema='" + schema + "'");
			}
			// DEBUG: this is temporary to handle version table schema change
			catch(e){
				if (e=='no such column: schema'){
					Scholar.debug(e, 1);
					return false;
				}
				
				// If some other problem, bail
				throw(e);
			}
			_dbVersions[schema] = dbVersion;
			return dbVersion;
		}
		return false;
	}
	
	
	/*
	 * Retrieve the version from the top line of the schema SQL file
	 */
	function _getSchemaSQLVersion(schema){
		// Default to schema.sql
		if (!schema){
			schema = 'schema';
		}
		
		var schemaFile = schema + '.sql';
		
		if (_schemaVersions[schema]){
			return _schemaVersions[schema];
		}
		
		var file = Components.classes["@mozilla.org/extensions/manager;1"]
                    .getService(Components.interfaces.nsIExtensionManager)
                    .getInstallLocation(SCHOLAR_CONFIG['GUID'])
                    .getItemLocation(SCHOLAR_CONFIG['GUID']); 
		file.append(schemaFile);
		
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
		
		_schemaVersions[schema] = schemaVersion;
		return schemaVersion;
	}
	
	
	/*
	 * Load in SQL schema
	 *
	 * Returns an _array_ of SQL statements for feeding into query()
	 */
	function _getSchemaSQL(schema){
		// Default to schema.sql
		if (!schema){
			schema = 'schema';
		}
		
		var schemaFile = schema + '.sql';
		
		// We pull the schema from an external file so we only have to process
		// it when necessary
		var file = Components.classes["@mozilla.org/extensions/manager;1"]
                    .getService(Components.interfaces.nsIExtensionManager)
                    .getInstallLocation(SCHOLAR_CONFIG['GUID'])
                    .getItemLocation(SCHOLAR_CONFIG['GUID']); 
		file.append(schemaFile);
		
		// Open an input stream from file
		var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		istream.init(file, 0x01, 0444, 0);
		istream.QueryInterface(Components.interfaces.nsILineInputStream);
		
		var line = {}, sql = '', hasmore;
		
		// Skip the first line, which contains the schema version
		istream.readLine(line);
		//var schemaVersion = line.value.match(/-- ([0-9]+)/)[1];
		
		do {
			hasmore = istream.readLine(line);
			sql += line.value + "\n";
		} while(hasmore);
		
		istream.close();
		
		return sql;
	}
	
	
	/*
	 * Create new DB schema
	 */
	function _initializeSchema(){
		try {
			Scholar.DB.beginTransaction();
			Scholar.DB.query(_getSchemaSQL());
			Scholar.DB.query("INSERT INTO version VALUES ('schema', "
				+ _getSchemaSQLVersion() + ")");
			Scholar.DB.query(_getSchemaSQL('scrapers'));
			Scholar.DB.query("INSERT INTO version VALUES ('scrapers', "
				+ _getSchemaSQLVersion('scrapers') + ")");
			Scholar.DB.commitTransaction();
		}
		catch(e){
			alert(e);
			Scholar.DB.rollbackTransaction();
		}
	}
	
	
	/*
	 * Update a DB schema version tag in an existing database
	 */
	function _updateDBVersion(schema, version){
		return Scholar.DB.query("UPDATE version SET version=" + version
			+ " WHERE schema='" + schema + "'");
	}
	
	
	/*
	 * Update the scrapers in the DB to the latest bundled versions
	 */
	function _updateScrapers(){
		var dbVersion = _getDBVersion('scrapers');
		var schemaVersion = _getSchemaSQLVersion('scrapers');
		
		if (dbVersion == schemaVersion){
			return;
		}
		else if (dbVersion < schemaVersion){
			Scholar.DB.beginTransaction();
			Scholar.DB.query(_getSchemaSQL('scrapers'));
			_updateDBVersion('scrapers', schemaVersion);
			Scholar.DB.commitTransaction();
			return;
		}
		else {
			throw("Scraper set in DB is newer than schema version");
		}
	}
	
	
	/*
	 * Migrate schema from an older version, preserving data
	 */
	function _migrateSchema(fromVersion){
		//
		// Change this value to match the schema version
		//
		var toVersion = 16;
		
		if (toVersion != _getSchemaSQLVersion()){
			throw('Schema version does not match version in _migrateSchema()');
		}
		
		Scholar.debug('Updating DB from version ' + fromVersion + ' to ' + toVersion + '\n');
		
		Scholar.DB.beginTransaction();
		
		// Step through version changes until we reach the current version
		//
		// Each block performs the changes necessary to move from the
		// previous revision to that one.
		for (var i=parseInt(fromVersion) + 1; i<=toVersion; i++){
			if (i==16){
				_initializeSchema();
			}
		}
		
		_updateDBVersion('schema', i-1);
		Scholar.DB.commitTransaction();
	}
}
