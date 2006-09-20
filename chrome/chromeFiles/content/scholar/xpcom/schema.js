Scholar.Schema = new function(){
	var _dbVersions = [];
	var _schemaVersions = [];
	var _repositoryTimer;
	
	this.updateSchema = updateSchema;
	this.updateScrapersRemote = updateScrapersRemote;
	this.stopRepositoryTimer = stopRepositoryTimer;
	
	/*
	 * Checks if the DB schema exists and is up-to-date, updating if necessary
	 */
	function updateSchema(){
		var dbVersion = _getDBVersion('user');
		
		// 'schema' check is for old (<= 1.0b1) schema system
		if (!dbVersion && !_getDBVersion('schema')){
			Scholar.debug('Database does not exist -- creating\n');
			_initializeSchema();
			return;
		}
		
		// Old schema system
		if (!dbVersion){
			dbVersion = 0;
		}
		
		var schemaVersion = _getSchemaSQLVersion('user');
		
		Scholar.DB.beginTransaction();
		
		try {
			_migrateUserSchema(dbVersion);
			_updateSchema('system');
			_updateSchema('scrapers');
			Scholar.DB.commitTransaction();
		}
		catch(e){
			Scholar.debug(e);
			Scholar.DB.rollbackTransaction();
			throw(e);
		}
		return;
	}
	
	
	/**
	* Send XMLHTTP request for updated scrapers to the central repository
	*
	* _force_ forces a repository query regardless of how long it's been
	* 	since the last check
	**/
	function updateScrapersRemote(force){
		if (!force){
			// Check user preference for automatic updates
			if (!Scholar.Prefs.get('automaticScraperUpdates')){
				Scholar.debug('Automatic scraper updating disabled -- not checking repository', 4);
				return false;
			}
			
			// Determine the earliest local time that we'd query the repository again
			var nextCheck = new Date();
			nextCheck.setTime((parseInt(_getDBVersion('lastcheck'))
				+ SCHOLAR_CONFIG['REPOSITORY_CHECK_INTERVAL']) * 1000); // JS uses ms
			var now = new Date();
			
			// If enough time hasn't passed, don't update
			if (now < nextCheck){
				Scholar.debug('Not enough time since last update -- not checking repository', 4);
				// Set the repository timer to the remaining time
				_setRepositoryTimer(Math.round((nextCheck.getTime() - now.getTime()) / 1000));
				return false;
			}
		}
		
		// If transaction already in progress, delay by a few seconds
		if (Scholar.DB.transactionInProgress()){
			Scholar.debug('Transaction in progress -- delaying repository check', 4)
			_setRepositoryTimer(30);
			return false;
		}
		
		// Get the last timestamp we got from the server
		var lastUpdated = _getDBVersion('repository');
		
		var url = SCHOLAR_CONFIG['REPOSITORY_URL'] + '/updated?'
			+ (lastUpdated ? 'last=' + lastUpdated + '&' : '')
			+ 'version=' + Scholar.version;
		
		Scholar.debug('Checking repository for updates (' + url + ')');
		var get = Scholar.Utilities.HTTP.doGet(url, _updateScrapersRemoteCallback);
		
		// TODO: instead, add an observer to start and stop timer on online state change
		if (!get){
			Scholar.debug('Browser is offline -- skipping check');
			_setRepositoryTimer(SCHOLAR_CONFIG['REPOSITORY_RETRY_INTERVAL']);
		}
	}
	
	
	function stopRepositoryTimer(){
		if (_repositoryTimer){
			Scholar.debug('Stopping repository check timer');
			_repositoryTimer.cancel();
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
			var dbVersion = Scholar.DB.valueQuery("SELECT version FROM "
				+ "version WHERE schema='" + schema + "'");
			_dbVersions[schema] = dbVersion;
			return dbVersion;
		}
		return false;
	}
	
	
	/*
	 * Retrieve the version from the top line of the schema SQL file
	 */
	function _getSchemaSQLVersion(schema){
		if (!schema){
			throw ('Schema type not provided to _getSchemaSQLVersion()');
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
	 * Returns the contents of an SQL file for feeding into query()
	 */
	function _getSchemaSQL(schema){
		if (!schema){
			throw ('Schema type not provided to _getSchemaSQL()');
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
	 * Determine the SQL statements necessary to drop the tables and indexed
	 * in a given schema file
	 *
	 * NOTE: This is not currently used.
	 *
	 * Returns the SQL statements as a string for feeding into query()
	 */
	function _getDropCommands(schema){
		if (!schema){
			throw ('Schema type not provided to _getSchemaSQL()');
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
		
		var line = {}, str = '', hasmore;
		
		// Skip the first line, which contains the schema version
		istream.readLine(line);
		
		do {
			hasmore = istream.readLine(line);
			var matches =
				line.value.match(/CREATE (TABLE|INDEX) IF NOT EXISTS ([^\s]+)/);
			if (matches){
				str += "DROP " + matches[1] + " IF EXISTS " + matches[2] + ";\n";
			}
		} while(hasmore);
		
		istream.close();
		
		return str;
	}
	
	
	/*
	 * Create new DB schema
	 */
	function _initializeSchema(){
		Scholar.DB.beginTransaction();
		try {
			Scholar.DB.query(_getSchemaSQL('user'));
			_updateDBVersion('user', _getSchemaSQLVersion('user'));
			
			Scholar.DB.query(_getSchemaSQL('system'));
			_updateDBVersion('system', _getSchemaSQLVersion('system'));
			
			Scholar.DB.query(_getSchemaSQL('scrapers'));
			_updateDBVersion('scrapers', _getSchemaSQLVersion('scrapers'));
			
			var sql = "INSERT INTO items VALUES(1233, 14, "
				+ "'Zotero - Quick Start Guide', '2006-08-31 20:00:00', "
				+ "'2006-08-31 20:00:00')";
			Scholar.DB.query(sql);
			var sql = "INSERT INTO itemAttachments VALUES(1233, NULL, 3, "
				+ "'text/html', 25, "
				+ "'http://www.zotero.org/docs/quick_start_guide.php', NULL)";
			Scholar.DB.query(sql);
			
			Scholar.DB.commitTransaction();
		}
		catch(e){
			Scholar.debug(e, 1);
			Scholar.DB.rollbackTransaction();
			alert('Error initializing Zotero database'); // TODO: localize
			throw(e);
		}
	}
	
	
	/*
	 * Update a DB schema version tag in an existing database
	 */
	function _updateDBVersion(schema, version){
		_dbVersions[schema] = version;
		var sql = "REPLACE INTO version (schema,version) VALUES (?,?)";
		return Scholar.DB.query(sql, [{'string':schema},{'int':version}]);
	}
	
	
	function _updateSchema(schema){
		var dbVersion = _getDBVersion(schema);
		var schemaVersion = _getSchemaSQLVersion(schema);
		
		if (dbVersion == schemaVersion){
			return;
		}
		else if (dbVersion < schemaVersion){
			Scholar.DB.beginTransaction();
			try {
				Scholar.DB.query(_getSchemaSQL(schema));
				_updateDBVersion(schema, schemaVersion);
				Scholar.DB.commitTransaction();
			}
			catch (e){
				Scholar.debug(e, 1);
				Scholar.DB.rollbackTransaction();
				alert('Error updating Zotero database'); // TODO: localize
				throw(e);
			}
			return;
		}
		else {
			throw("Zotero '" + schema + "' DB version is newer than SQL file");
		}
	}
	
	
	/**
	* Process the response from the repository
	**/
	function _updateScrapersRemoteCallback(xmlhttp){
		if (!xmlhttp.responseXML){
			if (xmlhttp.status>1000){
				Scholar.debug('No network connection', 2);
			}
			else {
				Scholar.debug('Invalid response from repository', 2);
			}
			_setRepositoryTimer(SCHOLAR_CONFIG['REPOSITORY_RETRY_INTERVAL']);
			return false;
		}
		
		var currentTime = xmlhttp.responseXML.
			getElementsByTagName('currentTime')[0].firstChild.nodeValue;
		var updates = xmlhttp.responseXML.getElementsByTagName('translator');
		
		Scholar.DB.beginTransaction();
		
		// Store the timestamp provided by the server
		_updateDBVersion('repository', currentTime);
		
		// And the local timestamp of the update time
		var d = new Date();
		_updateDBVersion('lastcheck', Math.round(d.getTime()/1000)); // JS uses ms
		
		if (!updates.length){
			Scholar.debug('All scrapers are up-to-date');
			Scholar.DB.commitTransaction();
			_setRepositoryTimer(SCHOLAR_CONFIG['REPOSITORY_CHECK_INTERVAL']);
			return false;
		}
		
		for (var i=0, len=updates.length; i<len; i++){
			try {
				_scraperXMLToDBQuery(updates[i]);
			}
			catch (e) {
				Scholar.debug(e, 1);
				Scholar.DB.rollbackTransaction();
				var breakout = true;
				break;
			}
		}
		
		if (!breakout){
			Scholar.DB.commitTransaction();
			_setRepositoryTimer(SCHOLAR_CONFIG['REPOSITORY_CHECK_INTERVAL']);
		}
	}
	
	
	/**
	* Set the interval between repository queries
	*
	* We add an additional two seconds to avoid race conditions
	**/
	function _setRepositoryTimer(interval){
		if (!interval){
			interval = SCHOLAR_CONFIG['REPOSITORY_CHECK_INTERVAL'];
		}
		
		var fudge = 2; // two seconds
		var displayInterval = interval + fudge;
		var interval = (interval + fudge) * 1000; // convert to ms
		
		if (!_repositoryTimer || _repositoryTimer.delay!=interval){
			Scholar.debug('Setting repository check interval to ' + displayInterval + ' seconds');
			_repositoryTimer = Components.classes["@mozilla.org/timer;1"].
				createInstance(Components.interfaces.nsITimer);
			_repositoryTimer.initWithCallback({
				// implements nsITimerCallback
				notify: function(timer){
					Scholar.Schema.updateScrapersRemote();
				}
			}, interval, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
		}
	}
	
	
	/**
	* Traverse an XML scraper node from the repository and
	* update the local scrapers table with the scraper data
	**/
	function _scraperXMLToDBQuery(xmlnode){
		var sqlValues = [
			{'string':xmlnode.getAttribute('id')},
			{'string':xmlnode.getAttribute('lastUpdated')},
			{'string':xmlnode.getAttribute('type')},
			{'string':xmlnode.getElementsByTagName('label')[0].firstChild.nodeValue},
			{'string':xmlnode.getElementsByTagName('creator')[0].firstChild.nodeValue},
			// target
			(xmlnode.getElementsByTagName('target').item(0) &&
				xmlnode.getElementsByTagName('target')[0].firstChild)
				? {'string':xmlnode.getElementsByTagName('target')[0].firstChild.nodeValue}
				: {'null':true},
			// detectCode can not exist or be empty
			(xmlnode.getElementsByTagName('detectCode').item(0) &&
				xmlnode.getElementsByTagName('detectCode')[0].firstChild)
				? {'string':xmlnode.getElementsByTagName('detectCode')[0].firstChild.nodeValue}
				: {'null':true},
			{'string':xmlnode.getElementsByTagName('code')[0].firstChild.nodeValue}
		]
		
		var sql = "REPLACE INTO translators VALUES (?,?,?,?,?,?,?,?)";
		return Scholar.DB.query(sql, sqlValues);
	}
	
	
	/*
	 * Migrate user schema from an older version, preserving data
	 */
	function _migrateUserSchema(fromVersion){
		toVersion = _getSchemaSQLVersion('user');
		
		if (fromVersion==toVersion){
			return false;
		}
		
		if (fromVersion > toVersion){
			throw("Zotero user DB version is newer than SQL file");
		}
		
		Scholar.debug('Updating user tables from version ' + fromVersion + ' to ' + toVersion);
		
		Scholar.DB.beginTransaction();
		
		try {
			// Step through version changes until we reach the current version
			//
			// Each block performs the changes necessary to move from the
			// previous revision to that one.
			for (var i=fromVersion + 1; i<=toVersion; i++){
				if (i==1){
					Scholar.DB.query("DELETE FROM version WHERE schema='schema'");
				}
			}
			
			_updateSchema('user');
			Scholar.DB.commitTransaction();
		}
		catch(e){
			Scholar.debug(e);
			alert('Error migrating Zotero database');
			throw(e);
		}
	}
}
