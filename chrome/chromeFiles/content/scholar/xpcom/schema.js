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
		var dbVersion = _getDBVersion();
		var schemaVersion = _getSchemaSQLVersion();
		
		if (dbVersion == schemaVersion){
			if (SCHOLAR_CONFIG['DB_REBUILD']){
				if (confirm('Erase all data and recreate database from schema?')){
					_initializeSchema();
					return;
				}
			}
			
			_updateScrapersLocal();
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
			_updateScrapersLocal();
			return;
		}
		else {
			throw("Scholar DB version is newer than schema version");
		}
	}
	
	
	/**
	* Send XMLHTTP request for updated scrapers to the central repository
	*
	* _force_ forces a repository query regardless of how long it's been
	* 	since the last check
	**/
	function updateScrapersRemote(force){
		// Determine the earliest local time that we'd query the repository again
		var nextCheck = new Date();
		nextCheck.setTime((parseInt(_getDBVersion('lastcheck'))
			+ SCHOLAR_CONFIG['REPOSITORY_CHECK_INTERVAL']) * 1000); // JS uses ms
		var now = new Date();
		
		// If enough time hasn't passed and it's not being forced, don't update
		if (!force && now < nextCheck){
			Scholar.debug('Too soon since last update -- not checking repository', 4);
			// Set the repository timer to the remaining time
			_setRepositoryTimer(Math.round((nextCheck.getTime() - now.getTime()) / 1000));
			return false;
		}
		
		// Get the last timestamp we got from the server
		var lastUpdated = _getDBVersion('repository');
		
		var url = SCHOLAR_CONFIG['REPOSITORY_URL'] + '/updated?'
			+ (lastUpdated ? 'last=' + lastUpdated + '&' : '')
			+ 'version=' + Scholar.version;
		
		Scholar.debug('Checking repository for updates (' + url + ')');
		var get = Scholar.HTTP.doGet(url, false, _updateScrapersRemoteCallback);
		
		// TODO: instead, add an observer to start and stop timer on online state change
		if (!get){
			Scholar.debug('Browser is offline -- skipping check');
			_setRepositoryTimer(SCHOLAR_CONFIG['REPOSITORY_CHECK_RETRY']);
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
			_updateDBVersion('schema', _getSchemaSQLVersion());
			Scholar.DB.query(_getSchemaSQL('scrapers'));
			_updateDBVersion('scrapers', _getSchemaSQLVersion('scrapers'));
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
		_dbVersions[schema] = version;
		var sql = "REPLACE INTO version (schema,version) VALUES (?,?)";
		return Scholar.DB.query(sql, [{'string':schema},{'int':version}]);
	}
	
	
	/*
	 * Update the scrapers in the DB to the latest bundled versions
	 */
	function _updateScrapersLocal(){
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
	
	
	/**
	* Process the response from the repository
	**/
	function _updateScrapersRemoteCallback(xmlhttp){
		// TODO: error handling
		var currentTime = xmlhttp.responseXML.
			getElementsByTagName('currentTime')[0].firstChild.nodeValue;
		var updates = xmlhttp.responseXML.getElementsByTagName('scraper');
		
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
			{'string':centralLastUpdated = xmlnode.getAttribute('lastUpdated')},
			{'string':xmlnode.getElementsByTagName('label')[0].firstChild.nodeValue},
			{'string':xmlnode.getElementsByTagName('creator')[0].firstChild.nodeValue},
			{'string':xmlnode.getElementsByTagName('urlPattern')[0].firstChild.nodeValue},
			// scraperDetectCode can not exist or be empty
			(xmlnode.getElementsByTagName('scraperDetectCode').item(0) &&
				xmlnode.getElementsByTagName('scraperDetectCode')[0].firstChild)
				? {'string':xmlnode.getElementsByTagName('scraperDetectCode')[0].firstChild.nodeValue}
				: {'null':true},
			{'string':xmlnode.getElementsByTagName('scraperJavaScript')[0].firstChild.nodeValue}
		]
		
		var sql = "REPLACE INTO scrapers VALUES (?,?,?,?,?,?,?)";
		return Scholar.DB.query(sql, sqlValues);
	}
	
	
	/*
	 * Migrate schema from an older version, preserving data
	 */
	function _migrateSchema(fromVersion){
		//
		// Change this value to match the schema version
		//
		var toVersion = 19;
		
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
			if (i==19){
				_initializeSchema();
			}
		}
		
		_updateDBVersion('schema', i-1);
		Scholar.DB.commitTransaction();
	}
}
