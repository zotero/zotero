Scholar.Schema = new function(){
	var _dbVersion;
	var _schemaVersion;
	
	this.updateSchema = updateSchema;
	
	/*
	 * Checks if the DB schema exists and is up-to-date, updating if necessary
	 */
	function updateSchema(){
		var dbVersion = _getDBVersion();
		var schemaVersion = _getSchemaSQLVersion();
		
		if (dbVersion > schemaVersion){
			throw("Scholar DB version is newer than schema version");
		}
		else if (dbVersion < schemaVersion){
			if (!dbVersion){
				Scholar.debug('Database does not exist -- creating\n');
				return _initializeSchema();
			}
			
			return _migrateSchema(dbVersion);
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
	 * Retrieve the DB schema version
	 */
	function _getDBVersion(){
		if (_dbVersion){
			return _dbVersion;
		}
		
		if (Scholar.DB.tableExists('version')){
			var dbVersion = Scholar.DB.valueQuery("SELECT version FROM version;");
			_dbVersion = dbVersion;
			return dbVersion;
		}
		return false;
	}
	
	
	/*
	 * Retrieve the version attribute of the schema SQL XML
	 */
	function _getSchemaSQLVersion(){
		if (_schemaVersion){
			return _schemaVersion;
		}
		
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
		
		_schemaVersion = schemaVersion;
		return schemaVersion;
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
			var sql = _getSchemaSQL();
			Scholar.DB.query(sql);
			Scholar.DB.query("INSERT INTO version VALUES (" + _getSchemaSQLVersion() + ")");
			Scholar.DB.commitTransaction();
		}
		catch(e){
			alert(e);
			Scholar.DB.rollbackTransaction();
		}
	}
	
	
	/*
	 * Migrate schema from an older version, preserving data
	 */
	function _migrateSchema(fromVersion){
		//
		// Change this value to match the schema version
		//
		var toVersion = 13;
		
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
			if (i==9){
				Scholar.DB.query("DROP TABLE IF EXISTS objectCreators; "
					+ "DROP TABLE IF EXISTS objectData; DROP TABLE IF EXISTS objectKeywords; "
					+ "DROP TABLE IF EXISTS objectTypeFields; DROP TABLE IF EXISTS objectTypes; "
					+ "DROP TABLE IF EXISTS objects; DROP TABLE IF EXISTS treeOrder;");
			}
			
			// For now, just wipe and recreate
			if (i==13){
				Scholar.DB.query("DROP TABLE IF EXISTS folders; "
					+ "DROP TABLE IF EXISTS treeStructure;");
				_initializeSchema();
			}
			
			if (i==14){
				// do stuff
			}
		}
		
		_updateDBVersion(i-1);
		Scholar.DB.commitTransaction();
	}
	
	
	/*
	 * Update the DB schema version tag of an existing database
	 */
	function _updateDBVersion(version){
		return Scholar.DB.query("UPDATE version SET version=" + version);
	}
}
