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

Zotero.Schema = new function(){
	this.userDataUpgradeRequired = userDataUpgradeRequired;
	this.showUpgradeWizard = showUpgradeWizard;
	this.updateSchema = updateSchema;
	this.updateScrapersRemote = updateScrapersRemote;
	this.stopRepositoryTimer = stopRepositoryTimer;
	
	this.upgradeFinished = false;
	this.goToChangeLog = false;
	
	var _dbVersions = [];
	var _schemaVersions = [];
	var _repositoryTimer;
	var _remoteUpdateInProgress = false;
	
	
	function userDataUpgradeRequired() {
		var dbVersion = _getDBVersion('userdata');
		var schemaVersion = _getSchemaSQLVersion('userdata');
		
		return dbVersion && (dbVersion < schemaVersion);
	}
	
	
	function showUpgradeWizard() {
		var dbVersion = _getDBVersion('userdata');
		var schemaVersion = _getSchemaSQLVersion('userdata');
		
		var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
				   .getService(Components.interfaces.nsIWindowWatcher);
		var obj = { Zotero: Zotero, data: { success: false } };
		var io = { wrappedJSObject: obj };
		var win = ww.openWindow(null, "chrome://zotero/content/upgrade.xul",
					"zotero-schema-upgrade", "chrome,centerscreen,modal", io);
		
		if (obj.data.e) {
			var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
					   .getService(Components.interfaces.nsIWindowWatcher);
			var data = {
				msg: obj.data.msg,
				e: obj.data.e,
				extraData: "Schema upgrade from " + dbVersion + " to " + schemaVersion
			};
			var io = { wrappedJSObject: { Zotero: Zotero, data:  data } };
			var win = ww.openWindow(null, "chrome://zotero/content/errorReport.xul",
						"zotero-error-report", "chrome,centerscreen,modal", io);
		}
		
		return obj.data.success;
	}
	
	
	/*
	 * Checks if the DB schema exists and is up-to-date, updating if necessary
	 */
	function updateSchema(){
		var dbVersion = _getDBVersion('userdata');
		
		// 'schema' check is for old (<= 1.0b1) schema system,
		// 'user' is for pre-1.0b2 'user' table
		if (!dbVersion && !_getDBVersion('schema') && !_getDBVersion('user')){
			Zotero.debug('Database does not exist -- creating\n');
			_initializeSchema();
			return;
		}
		
		var schemaVersion = _getSchemaSQLVersion('userdata');
		
		try {
			Zotero.UnresponsiveScriptIndicator.disable();
			
			// If upgrading userdata, make backup of database first
			if (dbVersion < schemaVersion){
				Zotero.DB.backupDatabase(dbVersion);
			}
			
			Zotero.DB.beginTransaction();
			
			try {
				// Old schema system
				if (!dbVersion){
					// Check for pre-1.0b2 'user' table
					 var user = _getDBVersion('user');
					 if (user)
					 {
						 dbVersion = user;
						 var sql = "UPDATE version SET schema=? WHERE schema=?";
						 Zotero.DB.query(sql, ['userdata', 'user']);
					 }
					 else
					 {
						 dbVersion = 0;
					 }
				}
				
				var up1 = _migrateUserDataSchema(dbVersion);
				var up2 = _updateSchema('system');
				var up3 = _updateSchema('scrapers');
				
				// Rebuild fulltext cache if necessary
				if (Zotero.Fulltext.cacheIsOutdated()){
					Zotero.Fulltext.rebuildCache();
				}
				Zotero.DB.commitTransaction();
			}
			catch(e){
				Zotero.debug(e);
				Zotero.DB.rollbackTransaction();
				throw(e);
			}
			
			if (up1) {
				// Upgrade seems to have been a success -- delete any previous backups
				var maxPrevious = dbVersion - 1;
				var file = Zotero.getZoteroDirectory();
				// directoryEntries.hasMoreElements() throws an error (possibly
				// because of the temporary SQLite journal file?), so we just look
				// for all versions
				for (var i=maxPrevious; i>=29; i--) {
					var fileName = 'zotero.sqlite.' + i + '.bak';
					file.append(fileName);
					if (file.exists()) {
						Zotero.debug('Removing previous backup file ' + fileName);
						file.remove(null);
					}
					file = file.parent;
				}
			}
			
			if (up2 || up3) {
				// Run a manual scraper update if upgraded and pref set
				if (Zotero.Prefs.get('automaticScraperUpdates')){
					this.updateScrapersRemote(2);
				}
			}
		}
		finally {
			Zotero.UnresponsiveScriptIndicator.enable();
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
			if (_remoteUpdateInProgress) {
				Zotero.debug("A remote update is already in progress -- not checking repository");
				return false;
			}
			
			// Check user preference for automatic updates
			if (!Zotero.Prefs.get('automaticScraperUpdates')){
				Zotero.debug('Automatic scraper updating disabled -- not checking repository', 4);
				return false;
			}
			
			// Determine the earliest local time that we'd query the repository again
			var nextCheck = new Date();
			nextCheck.setTime((parseInt(_getDBVersion('lastcheck'))
				+ ZOTERO_CONFIG['REPOSITORY_CHECK_INTERVAL']) * 1000); // JS uses ms
			var now = new Date();
			
			// If enough time hasn't passed, don't update
			if (now < nextCheck){
				Zotero.debug('Not enough time since last update -- not checking repository', 4);
				// Set the repository timer to the remaining time
				_setRepositoryTimer(Math.round((nextCheck.getTime() - now.getTime()) / 1000));
				return false;
			}
		}
		
		// If transaction already in progress, delay by ten minutes
		if (Zotero.DB.transactionInProgress()){
			Zotero.debug('Transaction in progress -- delaying repository check', 4)
			_setRepositoryTimer(600);
			return false;
		}
		
		// Get the last timestamp we got from the server
		var lastUpdated = _getDBVersion('repository');
		
		var url = ZOTERO_CONFIG['REPOSITORY_URL'] + '/updated?'
			+ (lastUpdated ? 'last=' + lastUpdated + '&' : '')
			+ 'version=' + Zotero.version;
		
		Zotero.debug('Checking repository for updates (' + url + ')');
		
		_remoteUpdateInProgress = true;
		
		if (force === true) {
			url += '&m=1';
			var get = Zotero.Utilities.HTTP.doGet(url, _updateScrapersRemoteCallbackManual);
		}
		else {
			if (force == 2) {
				url += '&m=2';
			}
			var get = Zotero.Utilities.HTTP.doGet(url, _updateScrapersRemoteCallback);
		}
		
		// TODO: instead, add an observer to start and stop timer on online state change
		if (!get){
			Zotero.debug('Browser is offline -- skipping check');
			_setRepositoryTimer(ZOTERO_CONFIG['REPOSITORY_RETRY_INTERVAL']);
		}
	}
	
	
	function stopRepositoryTimer(){
		if (_repositoryTimer){
			Zotero.debug('Stopping repository check timer');
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
		
		if (Zotero.DB.tableExists('version')){
			var dbVersion = Zotero.DB.valueQuery("SELECT version FROM "
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
                    .getInstallLocation(ZOTERO_CONFIG['GUID'])
                    .getItemLocation(ZOTERO_CONFIG['GUID']); 
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
                    .getInstallLocation(ZOTERO_CONFIG['GUID'])
                    .getItemLocation(ZOTERO_CONFIG['GUID']); 
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
                    .getInstallLocation(ZOTERO_CONFIG['GUID'])
                    .getItemLocation(ZOTERO_CONFIG['GUID']); 
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
		Zotero.DB.beginTransaction();
		try {
			// Enable auto-vacuuming
			Zotero.DB.query("PRAGMA auto_vacuum = 1");
			
			Zotero.DB.query(_getSchemaSQL('userdata'));
			_updateFailsafeSchema();
			_updateDBVersion('userdata', _getSchemaSQLVersion('userdata'));
			
			Zotero.DB.query(_getSchemaSQL('system'));
			_updateDBVersion('system', _getSchemaSQLVersion('system'));
			
			Zotero.DB.query(_getSchemaSQL('scrapers'));
			_updateDBVersion('scrapers', _getSchemaSQLVersion('scrapers'));
			
			var sql = "INSERT INTO items VALUES(123456789, 14, '2006-10-05 14:00:00', '2006-10-05 14:00:00')";
			Zotero.DB.query(sql);
			var sql = "INSERT INTO itemAttachments VALUES(123456789, NULL, 3, 'text/html', 25, NULL, NULL)";
			Zotero.DB.query(sql);
			var sql = "INSERT INTO itemDataValues VALUES (1, 'Zotero - Quick Start Guide')";
			Zotero.DB.query(sql);
			var sql = "INSERT INTO itemData VALUES(123456789, 110, 1)";
			Zotero.DB.query(sql);
			var sql = "INSERT INTO itemDataValues VALUES (2, 'http://www.zotero.org/documentation/quick_start_guide')";
			Zotero.DB.query(sql);
			var sql = "INSERT INTO itemData VALUES(123456789, 1, 2)";
			Zotero.DB.query(sql);
			var sql = "INSERT INTO itemDataValues VALUES (3, '2006-10-05 14:00:00')";
			Zotero.DB.query(sql);
			var sql = "INSERT INTO itemData VALUES(123456789, 27, 3)";
			Zotero.DB.query(sql);
			var sql = "INSERT INTO itemNotes (itemID, sourceItemID, note) VALUES(123456789, NULL, ?)";
			var msg = "Welcome to Zotero! Click the \"View Page\" button above to visit our Quick Start Guide and learn how to get started collecting, managing, and citing your research.\n\nThanks for trying Zotero, and be sure to tell your friends about it.";
			Zotero.DB.query(sql, msg);
			Zotero.DB.commitTransaction();
		}
		catch(e){
			Zotero.debug(e, 1);
			Components.utils.reportError(e);
			Zotero.DB.rollbackTransaction();
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
		return Zotero.DB.query(sql, [{'string':schema},{'int':version}]);
	}
	
	
	function _updateSchema(schema){
		var dbVersion = _getDBVersion(schema);
		var schemaVersion = _getSchemaSQLVersion(schema);
		
		if (dbVersion == schemaVersion){
			return false;
		}
		else if (dbVersion < schemaVersion){
			Zotero.DB.beginTransaction();
			try {
				Zotero.DB.query(_getSchemaSQL(schema));
				_updateDBVersion(schema, schemaVersion);
				Zotero.DB.commitTransaction();
			}
			catch (e){
				Zotero.debug(e, 1);
				Zotero.DB.rollbackTransaction();
				throw(e);
			}
			return true;
		}
		
		throw("Zotero '" + schema + "' DB version is newer than SQL file");
	}
	
	
	/**
	* Process the response from the repository
	**/
	function _updateScrapersRemoteCallback(xmlhttp, manual){
		if (!xmlhttp.responseXML){
			try {
				if (xmlhttp.status>1000){
					Zotero.debug('No network connection', 2);
				}
				else {
					Zotero.debug('Invalid response from repository', 2);
				}
			}
			catch (e){
				Zotero.debug('Repository cannot be contacted');
			}
			
			if (!manual){
				_setRepositoryTimer(ZOTERO_CONFIG['REPOSITORY_RETRY_INTERVAL']);
			}
			
			_remoteUpdateInProgress = false;
			return false;
		}
		
		var currentTime = xmlhttp.responseXML.
			getElementsByTagName('currentTime')[0].firstChild.nodeValue;
		var translatorUpdates = xmlhttp.responseXML.getElementsByTagName('translator');
		var styleUpdates = xmlhttp.responseXML.getElementsByTagName('style');
		
		Zotero.DB.beginTransaction();
		
		// Store the timestamp provided by the server
		_updateDBVersion('repository', currentTime);
		
		if (!manual){
			// And the local timestamp of the update time
			var d = new Date();
			_updateDBVersion('lastcheck', Math.round(d.getTime()/1000)); // JS uses ms
		}
		
		if (!translatorUpdates.length && !styleUpdates.length){
			Zotero.debug('All translators and styles are up-to-date');
			Zotero.DB.commitTransaction();
			if (!manual){
				_setRepositoryTimer(ZOTERO_CONFIG['REPOSITORY_CHECK_INTERVAL']);
			}
			_remoteUpdateInProgress = false;
			return -1;
		}
		
		try {
			for (var i=0, len=translatorUpdates.length; i<len; i++){
				_translatorXMLToDB(translatorUpdates[i]);
			}
			
			for (var i=0, len=styleUpdates.length; i<len; i++){
				_styleXMLToDB(styleUpdates[i]);
			}
		}
		catch (e) {
			Zotero.debug(e, 1);
			Zotero.DB.rollbackTransaction();
			if (!manual){
				_setRepositoryTimer(ZOTERO_CONFIG['REPOSITORY_RETRY_INTERVAL']);
			}
			_remoteUpdateInProgress = false;
			return false;
		}
		
		Zotero.DB.commitTransaction();
		if (!manual){
			_setRepositoryTimer(ZOTERO_CONFIG['REPOSITORY_CHECK_INTERVAL']);
		}
		_remoteUpdateInProgress = false;
		return true;
	}
	
	
	function _updateScrapersRemoteCallbackManual(xmlhttp){
		var updated = _updateScrapersRemoteCallback(xmlhttp, true);
		
		// Update the "Update Now" button in the pref dialog with the result
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
		var enumerator = wm.getEnumerator('zotero:pref');
		while (enumerator.hasMoreElements()){
			var win = enumerator.getNext();
			var button = win.window.document.getElementById('updateButton');
			if (button){
				if (updated===-1){
					var label = Zotero.getString('zotero.preferences.update.upToDate');
				}
				else if (updated){
					var label = Zotero.getString('zotero.preferences.update.updated');
				}
				else {
					var label = Zotero.getString('zotero.preferences.update.error');
				}
				button.setAttribute('label', label);
			}
		}
	}
	
	
	/**
	* Set the interval between repository queries
	*
	* We add an additional two seconds to avoid race conditions
	**/
	function _setRepositoryTimer(interval){
		if (!interval){
			interval = ZOTERO_CONFIG['REPOSITORY_CHECK_INTERVAL'];
		}
		
		var fudge = 2; // two seconds
		var displayInterval = interval + fudge;
		var interval = (interval + fudge) * 1000; // convert to ms
		
		if (!_repositoryTimer || _repositoryTimer.delay!=interval){
			Zotero.debug('Setting repository check interval to ' + displayInterval + ' seconds');
			_repositoryTimer = Components.classes["@mozilla.org/timer;1"].
				createInstance(Components.interfaces.nsITimer);
			_repositoryTimer.initWithCallback({
				// implements nsITimerCallback
				notify: function(timer){
					Zotero.Schema.updateScrapersRemote();
				}
			}, interval, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
		}
	}
	
	
	/**
	* Traverse an XML translator node from the repository and
	* update the local scrapers table with the scraper data
	**/
	function _translatorXMLToDB(xmlnode){
		// Don't split >4K chunks into multiple nodes
		// https://bugzilla.mozilla.org/show_bug.cgi?id=194231
		xmlnode.normalize();
		
		// Delete local version of remote translators with priority 0
		if (xmlnode.getElementsByTagName('priority')[0].firstChild.nodeValue === "0") {
			var sql = "DELETE FROM translators WHERE translatorID=?";
			return Zotero.DB.query(sql, {string: xmlnode.getAttribute('id')});
		}
		
		var sqlValues = [
			{string: xmlnode.getAttribute('id')},
			{string: xmlnode.getAttribute('minVersion')},
			{string: xmlnode.getAttribute('maxVersion')},
			{string: xmlnode.getAttribute('lastUpdated')},
			1, // inRepository
			{int: xmlnode.getElementsByTagName('priority')[0].firstChild.nodeValue},
			{int: xmlnode.getAttribute('type')},
			{string: xmlnode.getElementsByTagName('label')[0].firstChild.nodeValue},
			{string: xmlnode.getElementsByTagName('creator')[0].firstChild.nodeValue},
			// target
			(xmlnode.getElementsByTagName('target').item(0) &&
				xmlnode.getElementsByTagName('target')[0].firstChild)
				? {string: xmlnode.getElementsByTagName('target')[0].firstChild.nodeValue}
				: {null: true},
			// detectCode can not exist or be empty
			(xmlnode.getElementsByTagName('detectCode').item(0) &&
				xmlnode.getElementsByTagName('detectCode')[0].firstChild)
				? {string: xmlnode.getElementsByTagName('detectCode')[0].firstChild.nodeValue}
				: {null: true},
			{string: xmlnode.getElementsByTagName('code')[0].firstChild.nodeValue}
		];
		
		var sql = "REPLACE INTO translators VALUES (?,?,?,?,?,?,?,?,?,?,?,?)";
		return Zotero.DB.query(sql, sqlValues);
	}
	
	
	/**
	* Traverse an XML style node from the repository and
	* update the local csl table with the style data
	**/
	function _styleXMLToDB(xmlnode){
		var sqlValues = [
			{string: xmlnode.getAttribute('id')},
			{string: xmlnode.getAttribute('updated')},
			{string: xmlnode.getElementsByTagName('title')[0].firstChild.nodeValue},
			{string: xmlnode.getElementsByTagName('csl')[0].firstChild.nodeValue}
		];
		
		var sql = "REPLACE INTO csl VALUES (?,?,?,?)";
		return Zotero.DB.query(sql, sqlValues);
	}
	
	
	/*
	 * Migrate user data schema from an older version, preserving data
	 */
	function _migrateUserDataSchema(fromVersion){
		var toVersion = _getSchemaSQLVersion('userdata');
		
		if (fromVersion==toVersion){
			return false;
		}
		
		if (fromVersion > toVersion){
			throw("Zotero user data DB version is newer than SQL file");
		}
		
		Zotero.debug('Updating user data tables from version ' + fromVersion + ' to ' + toVersion);
		
		Zotero.DB.beginTransaction();
		
		try {
			// Step through version changes until we reach the current version
			//
			// Each block performs the changes necessary to move from the
			// previous revision to that one.
			for (var i=fromVersion + 1; i<=toVersion; i++){
				if (i==1){
					Zotero.DB.query("DELETE FROM version WHERE schema='schema'");
				}
				
				if (i==5){
					Zotero.DB.query("REPLACE INTO itemData SELECT itemID, 1, originalPath FROM itemAttachments WHERE linkMode=1");
					Zotero.DB.query("REPLACE INTO itemData SELECT itemID, 1, path FROM itemAttachments WHERE linkMode=3");
					Zotero.DB.query("REPLACE INTO itemData SELECT itemID, 27, dateAdded FROM items NATURAL JOIN itemAttachments WHERE linkMode IN (1,3)");
					Zotero.DB.query("UPDATE itemAttachments SET originalPath=NULL WHERE linkMode=1");
					Zotero.DB.query("UPDATE itemAttachments SET path=NULL WHERE linkMode=3");
					try { Zotero.DB.query("DELETE FROM fulltextItems WHERE itemID IS NULL"); } catch(e){}
				}
				
				if (i==6){
					Zotero.DB.query("CREATE TABLE creatorsTemp (creatorID INT, firstName INT, lastName INT, fieldMode INT)");
					Zotero.DB.query("INSERT INTO creatorsTemp SELECT * FROM creators");
					Zotero.DB.query("DROP TABLE creators");
					Zotero.DB.query("CREATE TABLE creators (\n    creatorID INT,\n    firstName INT,\n    lastName INT,\n    fieldMode INT,\n    PRIMARY KEY (creatorID)\n);");
					Zotero.DB.query("INSERT INTO creators SELECT * FROM creatorsTemp");
					Zotero.DB.query("DROP TABLE creatorsTemp");
				}
				
				if (i==7){
					Zotero.DB.query("DELETE FROM itemData WHERE fieldID=17");
					Zotero.DB.query("UPDATE itemData SET fieldID=64 WHERE fieldID=20");
					Zotero.DB.query("UPDATE itemData SET fieldID=69 WHERE fieldID=24 AND itemID IN (SELECT itemID FROM items WHERE itemTypeID=7)");
					Zotero.DB.query("UPDATE itemData SET fieldID=65 WHERE fieldID=24 AND itemID IN (SELECT itemID FROM items WHERE itemTypeID=8)");
					Zotero.DB.query("UPDATE itemData SET fieldID=66 WHERE fieldID=24 AND itemID IN (SELECT itemID FROM items WHERE itemTypeID=9)");
					Zotero.DB.query("UPDATE itemData SET fieldID=59 WHERE fieldID=24 AND itemID IN (SELECT itemID FROM items WHERE itemTypeID=12)");
				}
				
				if (i==8){
					Zotero.DB.query("DROP TABLE IF EXISTS translators");
					Zotero.DB.query("DROP TABLE IF EXISTS csl");
				}
				
				// 1.0b2 (1.0.0b2.r1)
				
				if (i==9){
					var attachments = Zotero.DB.query("SELECT itemID, linkMode, path FROM itemAttachments");
					for each(var row in attachments){
						var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
						try {
							var refDir = (row.linkMode==Zotero.Attachments.LINK_MODE_LINKED_FILE) ? Zotero.getZoteroDirectory() : Zotero.getStorageDirectory();
							file.setRelativeDescriptor(refDir, row.path);
							Zotero.DB.query("UPDATE itemAttachments SET path=? WHERE itemID=?", [file.persistentDescriptor, row.itemID]);
						}
						catch (e){}
					}
				}
				
				// 1.0.0b2.r2
				
				if (i==10){
					var dates = Zotero.DB.query("SELECT itemID, value FROM itemData WHERE fieldID=14");
					for each(var row in dates){
						if (!Zotero.Date.isMultipart(row.value)){
							Zotero.DB.query("UPDATE itemData SET value=? WHERE itemID=? AND fieldID=14", [Zotero.Date.strToMultipart(row.value), row.itemID]);
						}
					}
				}
				
				if (i==11){
					var attachments = Zotero.DB.query("SELECT itemID, linkMode, path FROM itemAttachments WHERE linkMode IN (0,1)");
					for each(var row in attachments){
						var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
						try {
							file.persistentDescriptor = row.path;
							var storageDir = Zotero.getStorageDirectory();
							storageDir.QueryInterface(Components.interfaces.nsILocalFile);
							var path = file.getRelativeDescriptor(storageDir);
							Zotero.DB.query("UPDATE itemAttachments SET path=? WHERE itemID=?", [path, row.itemID]);
						}
						catch (e){}
					}
				}
				
				if (i==12){
					Zotero.DB.query("CREATE TABLE translatorsTemp (translatorID TEXT PRIMARY KEY, lastUpdated DATETIME, inRepository INT, priority INT, translatorType INT, label TEXT, creator TEXT, target TEXT, detectCode TEXT, code TEXT);");
					if (Zotero.DB.tableExists('translators')) {
						Zotero.DB.query("INSERT INTO translatorsTemp SELECT * FROM translators");
						Zotero.DB.query("DROP TABLE translators");
					}
					Zotero.DB.query("CREATE TABLE translators (\n    translatorID TEXT PRIMARY KEY,\n    minVersion TEXT,\n    maxVersion TEXT,\n    lastUpdated DATETIME,\n    inRepository INT,\n    priority INT,\n    translatorType INT,\n    label TEXT,\n    creator TEXT,\n    target TEXT,\n    detectCode TEXT,\n    code TEXT\n);");
					Zotero.DB.query("INSERT INTO translators SELECT translatorID, '', '', lastUpdated, inRepository, priority, translatorType, label, creator, target, detectCode, code FROM translatorsTemp");
					Zotero.DB.query("CREATE INDEX translators_type ON translators(translatorType)");
					Zotero.DB.query("DROP TABLE translatorsTemp");
				}
				
				if (i==13) {
					Zotero.DB.query("CREATE TABLE itemNotesTemp (itemID INT, sourceItemID INT, note TEXT, PRIMARY KEY (itemID), FOREIGN KEY (itemID) REFERENCES items(itemID), FOREIGN KEY (sourceItemID) REFERENCES items(itemID))");
					Zotero.DB.query("INSERT INTO itemNotesTemp SELECT * FROM itemNotes");
					Zotero.DB.query("DROP TABLE itemNotes");
					Zotero.DB.query("CREATE TABLE itemNotes (\n    itemID INT,\n    sourceItemID INT,\n    note TEXT,\n    isAbstract INT DEFAULT NULL,\n    PRIMARY KEY (itemID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID),\n    FOREIGN KEY (sourceItemID) REFERENCES items(itemID)\n);");
					Zotero.DB.query("INSERT INTO itemNotes SELECT itemID, sourceItemID, note, NULL FROM itemNotesTemp");
					Zotero.DB.query("CREATE INDEX itemNotes_sourceItemID ON itemNotes(sourceItemID)");
					Zotero.DB.query("DROP TABLE itemNotesTemp");
				}
				
				// 1.0.0b3.r1
				
				// Repair for interrupted B4 upgrades
				if (i==14) {
					var hash = Zotero.DB.getColumnHash('itemNotes');
					if (!hash.isAbstract) {
						// See if itemDataValues exists
						if (!Zotero.DB.tableExists('itemDataValues')) {
							// Copied from step 23
							var notes = Zotero.DB.query("SELECT itemID, note FROM itemNotes WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=1)");
							if (notes) {
								var f = function(text) { var t = text.substring(0, 80); var ln = t.indexOf("\n"); if (ln>-1 && ln<80) { t = t.substring(0, ln); } return t; }
								for (var j=0; j<notes.length; j++) {
									Zotero.DB.query("REPLACE INTO itemNoteTitles VALUES (?,?)", [notes[j]['itemID'], f(notes[j]['note'])]);
								}
							}
							
							Zotero.DB.query("CREATE TABLE itemDataValues (\n    valueID INT,\n    value,\n    PRIMARY KEY (valueID)\n);");
							var values = Zotero.DB.columnQuery("SELECT DISTINCT value FROM itemData");
							if (values) {
								for (var j=0; j<values.length; j++) {
									var valueID = Zotero.getRandomID('itemDataValues', 'valueID', 2097152); // Stored in 3 bytes
									Zotero.DB.query("INSERT INTO itemDataValues VALUES (?,?)", [valueID, values[j]]);
								}
							}
							
							Zotero.DB.query("CREATE TEMPORARY TABLE itemDataTemp AS SELECT itemID, fieldID, (SELECT valueID FROM itemDataValues WHERE value=ID.value) AS valueID FROM itemData ID");
							Zotero.DB.query("DROP TABLE itemData");
							Zotero.DB.query("CREATE TABLE itemData (\n    itemID INT,\n    fieldID INT,\n    valueID INT,\n    PRIMARY KEY (itemID, fieldID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID),\n    FOREIGN KEY (fieldID) REFERENCES fields(fieldID)\n    FOREIGN KEY (valueID) REFERENCES itemDataValues(valueID)\n);");
							Zotero.DB.query("INSERT INTO itemData SELECT * FROM itemDataTemp");
							Zotero.DB.query("DROP TABLE itemDataTemp");
							
							i = 23;
							continue;
						}
						
						var rows = Zotero.DB.query("SELECT * FROM itemData WHERE valueID NOT IN (SELECT valueID FROM itemDataValues)");
						if (rows) {
							for (var j=0; j<rows.length; j++) {
								for (var j=0; j<values.length; j++) {
									var valueID = Zotero.getRandomID('itemDataValues', 'valueID', 2097152); // Stored in 3 bytes
									Zotero.DB.query("INSERT INTO itemDataValues VALUES (?,?)", [valueID, values[j]]);
									Zotero.DB.query("UPDATE itemData SET valueID=? WHERE itemID=? AND fieldID=?", [valueID, rows[j]['itemID'], rows[j]['fieldID']]);
								}
							}
							i = 23;
							continue;
						}
						
						i = 27;
						continue;
					}
				}
				
				if (i==15) {
					Zotero.DB.query("DROP TABLE IF EXISTS annotations");
				}
				
				if (i==16) {
					Zotero.DB.query("CREATE TABLE tagsTemp (tagID INT, tag TEXT, PRIMARY KEY (tagID))");
					if (Zotero.DB.tableExists("tags")) {
						Zotero.DB.query("INSERT INTO tagsTemp SELECT * FROM tags");
						Zotero.DB.query("DROP TABLE tags");
					}
					Zotero.DB.query("CREATE TABLE tags (\n    tagID INT,\n    tag TEXT,\n    tagType INT,\n    PRIMARY KEY (tagID),\n    UNIQUE (tag, tagType)\n);");
					Zotero.DB.query("INSERT INTO tags SELECT tagID, tag, 0 FROM tagsTemp");
					Zotero.DB.query("DROP TABLE tagsTemp");
					
					// Compensate for csl table drop in step 8 for upgraders from early versions,
					// in case we do something with it in a later step
					Zotero.DB.query("CREATE TABLE IF NOT EXISTS csl (\n    cslID TEXT PRIMARY KEY,\n    updated DATETIME,\n    title TEXT,\n    csl TEXT\n);");
				}
				
				if (i==17) {
					Zotero.DB.query("UPDATE itemData SET fieldID=89 WHERE fieldID=8 AND itemID IN (SELECT itemID FROM items WHERE itemTypeID=7)");
				}
				
				if (i==19) {
					Zotero.DB.query("INSERT INTO itemData SELECT sourceItemID, 90, note FROM itemNotes WHERE isAbstract=1");
					Zotero.DB.query("DELETE FROM items WHERE itemID IN (SELECT itemID FROM itemNotes WHERE isAbstract=1)");
					Zotero.DB.query("DELETE FROM itemData WHERE itemID IN (SELECT itemID FROM itemNotes WHERE isAbstract=1)");
					Zotero.DB.query("CREATE TEMPORARY TABLE itemNotesTemp (itemID INT, sourceItemID INT, note TEXT)");
					Zotero.DB.query("INSERT INTO itemNotesTemp SELECT itemID, sourceItemID, note FROM itemNotes WHERE isAbstract IS NULL");
					Zotero.DB.query("DROP TABLE itemNotes");
					Zotero.DB.query("CREATE TABLE itemNotes (\n    itemID INT,\n    sourceItemID INT,\n    note TEXT,    \n    PRIMARY KEY (itemID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID),\n    FOREIGN KEY (sourceItemID) REFERENCES items(itemID)\n);");
					Zotero.DB.query("INSERT INTO itemNotes SELECT * FROM itemNotesTemp")
					Zotero.DB.query("DROP TABLE itemNotesTemp");
				}
				
				if (i==20) {
					Zotero.DB.query("UPDATE itemData SET fieldID=91 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=13) AND fieldID=12;");
					Zotero.DB.query("UPDATE itemData SET fieldID=92 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=15) AND fieldID=60;");
					Zotero.DB.query("UPDATE itemData SET fieldID=93 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=16) AND fieldID=60;");
					Zotero.DB.query("UPDATE itemData SET fieldID=94 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=16) AND fieldID=4;");
					Zotero.DB.query("UPDATE itemData SET fieldID=95 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=16) AND fieldID=10;");
					Zotero.DB.query("UPDATE itemData SET fieldID=96 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=17) AND fieldID=14;");
					Zotero.DB.query("UPDATE itemData SET fieldID=97 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=17) AND fieldID=4;");
					Zotero.DB.query("UPDATE itemData SET fieldID=98 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=17) AND fieldID=10;");
					Zotero.DB.query("UPDATE itemData SET fieldID=99 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=18) AND fieldID=60;");
					Zotero.DB.query("UPDATE itemData SET fieldID=100 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=20) AND fieldID=14;");
					Zotero.DB.query("UPDATE itemData SET fieldID=101 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=20) AND fieldID=60;");
					Zotero.DB.query("UPDATE itemData SET fieldID=102 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=19) AND fieldID=7;");
					Zotero.DB.query("UPDATE itemData SET fieldID=103 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=19) AND fieldID=60;");
					Zotero.DB.query("UPDATE itemData SET fieldID=104 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=25) AND fieldID=12;");
					Zotero.DB.query("UPDATE itemData SET fieldID=105 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=29) AND fieldID=60;");
					Zotero.DB.query("UPDATE itemData SET fieldID=105 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=30) AND fieldID=60;");
					Zotero.DB.query("UPDATE itemData SET fieldID=105 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=31) AND fieldID=60;");
					Zotero.DB.query("UPDATE itemData SET fieldID=107 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=23) AND fieldID=12;");
					Zotero.DB.query("INSERT OR IGNORE INTO itemData SELECT itemID, 52, value FROM itemData WHERE fieldID IN (14, 52) AND itemID IN (SELECT itemID FROM items WHERE itemTypeID=19) LIMIT 1");
					Zotero.DB.query("DELETE FROM itemData WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=19) AND fieldID=14");
				}
				
				if (i==21) {
					Zotero.DB.query("INSERT INTO itemData SELECT itemID, 110, title FROM items WHERE title IS NOT NULL AND itemTypeID NOT IN (1,17,20,21)");
					Zotero.DB.query("INSERT INTO itemData SELECT itemID, 111, title FROM items WHERE title IS NOT NULL AND itemTypeID = 17");
					Zotero.DB.query("INSERT INTO itemData SELECT itemID, 112, title FROM items WHERE title IS NOT NULL AND itemTypeID = 20");
					Zotero.DB.query("INSERT INTO itemData SELECT itemID, 113, title FROM items WHERE title IS NOT NULL AND itemTypeID = 21");
					Zotero.DB.query("CREATE TEMPORARY TABLE itemsTemp AS SELECT itemID, itemTypeID, dateAdded, dateModified FROM items");
					Zotero.DB.query("DROP TABLE items");
					Zotero.DB.query("CREATE TABLE IF NOT EXISTS items (\n    itemID INTEGER PRIMARY KEY,\n    itemTypeID INT,\n    dateAdded DATETIME DEFAULT CURRENT_TIMESTAMP,\n    dateModified DATETIME DEFAULT CURRENT_TIMESTAMP\n);");
					Zotero.DB.query("INSERT INTO items SELECT * FROM itemsTemp");
					Zotero.DB.query("DROP TABLE itemsTemp");
				}
				
				if (i==22) {
					if (Zotero.DB.valueQuery("SELECT COUNT(*) FROM items WHERE itemID=0")) {
						var itemID = Zotero.getRandomID('items', 'itemID');
						Zotero.DB.query("UPDATE items SET itemID=? WHERE itemID=?", [itemID, 0]);
						Zotero.DB.query("UPDATE itemData SET itemID=? WHERE itemID=?", [itemID, 0]);
						Zotero.DB.query("UPDATE itemNotes SET itemID=? WHERE itemID=?", [itemID, 0]);
						Zotero.DB.query("UPDATE itemAttachments SET itemID=? WHERE itemID=?", [itemID, 0]);
					}
					if (Zotero.DB.valueQuery("SELECT COUNT(*) FROM collections WHERE collectionID=0")) {
						var collectionID = Zotero.getRandomID('collections', 'collectionID');
						Zotero.DB.query("UPDATE collections SET collectionID=? WHERE collectionID=0", [collectionID]);
						Zotero.DB.query("UPDATE collectionItems SET collectionID=? WHERE collectionID=0", [collectionID]);
					}
					Zotero.DB.query("DELETE FROM tags WHERE tagID=0");
					Zotero.DB.query("DELETE FROM itemTags WHERE tagID=0");
					Zotero.DB.query("DELETE FROM savedSearches WHERE savedSearchID=0");
				}
				
				if (i==23) {
					Zotero.DB.query("CREATE TABLE IF NOT EXISTS itemNoteTitles (\n    itemID INT,\n    title TEXT,\n    PRIMARY KEY (itemID),\n    FOREIGN KEY (itemID) REFERENCES itemNotes(itemID)\n);");
					var notes = Zotero.DB.query("SELECT itemID, note FROM itemNotes WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=1)");
					if (notes) {
					var f = function(text) { var t = text.substring(0, 80); var ln = t.indexOf("\n"); if (ln>-1 && ln<80) { t = t.substring(0, ln); } return t; }
						for (var j=0; j<notes.length; j++) {
							Zotero.DB.query("INSERT INTO itemNoteTitles VALUES (?,?)", [notes[j]['itemID'], f(notes[j]['note'])]);
						}
					}
					
					Zotero.DB.query("CREATE TABLE IF NOT EXISTS itemDataValues (\n    valueID INT,\n    value,\n    PRIMARY KEY (valueID)\n);");
					var values = Zotero.DB.columnQuery("SELECT DISTINCT value FROM itemData");
					if (values) {
						for (var j=0; j<values.length; j++) {
							var valueID = Zotero.getRandomID('itemDataValues', 'valueID', 2097152); // Stored in 3 bytes
							Zotero.DB.query("INSERT INTO itemDataValues VALUES (?,?)", [valueID, values[j]]);
						}
					}
					
					Zotero.DB.query("CREATE TEMPORARY TABLE itemDataTemp AS SELECT itemID, fieldID, (SELECT valueID FROM itemDataValues WHERE value=ID.value) AS valueID FROM itemData ID");
					Zotero.DB.query("DROP TABLE itemData");
					Zotero.DB.query("CREATE TABLE itemData (\n    itemID INT,\n    fieldID INT,\n    valueID INT,\n    PRIMARY KEY (itemID, fieldID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID),\n    FOREIGN KEY (fieldID) REFERENCES fields(fieldID)\n    FOREIGN KEY (valueID) REFERENCES itemDataValues(valueID)\n);");
					Zotero.DB.query("INSERT INTO itemData SELECT * FROM itemDataTemp");
					Zotero.DB.query("DROP TABLE itemDataTemp");
				}
				
				if (i==24) {
					var rows = Zotero.DB.query("SELECT * FROM itemData NATURAL JOIN itemDataValues WHERE fieldID IN (52,96,100)");
					if (rows) {
						for (var j=0; j<rows.length; j++) {
							if (!Zotero.Date.isMultipart(rows[j]['value'])) {
								var value = Zotero.Date.strToMultipart(rows[j]['value']);
								var valueID = Zotero.DB.valueQuery("SELECT valueID FROM itemDataValues WHERE value=?", rows[j]['value']);
								if (!valueID) {
									var valueID = Zotero.getRandomID('itemDataValues', 'valueID', 2097152);
									Zotero.DB.query("INSERT INTO itemDataValues VALUES (?,?)", [valueID, value]);
								}
								Zotero.DB.query("UPDATE itemData SET valueID=? WHERE itemID=? AND fieldID=?", [valueID, rows[j]['itemID'], rows[j]['fieldID']]);
							}
						}
					}
				}
				
				if (i==25) {
					Zotero.DB.query("UPDATE itemData SET fieldID=100 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=15) AND fieldID=14;")
				}
				
				if (i==26) {
					Zotero.DB.query("INSERT INTO itemData SELECT itemID, 114, valueID FROM itemData WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=33) AND fieldID=84");
				}
				
				if (i==27) {
					Zotero.DB.query("UPDATE itemData SET fieldID=115 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=3) AND fieldID=12");
				}
				
				// 1.0.0b4.r1
				
				if (i==28) {
					var childNotes = Zotero.DB.query("SELECT * FROM itemNotes WHERE itemID IN (SELECT itemID FROM items) AND sourceItemID IS NOT NULL");
					if (!childNotes.length) {
						continue;
					}
					Zotero.DB.query("CREATE TEMPORARY TABLE itemNotesTemp AS SELECT * FROM itemNotes WHERE note IN (SELECT itemID FROM items) AND sourceItemID IS NOT NULL");
					Zotero.DB.query("CREATE INDEX tmp_itemNotes_pk ON itemNotesTemp(note, sourceItemID);");
					var num = Zotero.DB.valueQuery("SELECT COUNT(*) FROM itemNotesTemp");
					if (!num) {
						continue;
					}
					for (var j=0; j<childNotes.length; j++) {
						var reversed = Zotero.DB.query("SELECT * FROM itemNotesTemp WHERE note=? AND sourceItemID=?", [childNotes[j].itemID, childNotes[j].sourceItemID]);
						if (!reversed.length) {
							continue;
						}
						var maxLength = 0;
						for (var k=0; k<reversed.length; k++) {
							if (reversed[k].itemID.length > maxLength) {
								maxLength = reversed[k].itemID.length;
								var maxLengthIndex = k;
							}
						}
						if (maxLengthIndex) {
							Zotero.DB.query("UPDATE itemNotes SET note=? WHERE itemID=?", [reversed[maxLengthIndex].itemID, childNotes[j].itemID]);
							var f = function(text) { var t = text.substring(0, 80); var ln = t.indexOf("\n"); if (ln>-1 && ln<80) { t = t.substring(0, ln); } return t; }
							Zotero.DB.query("UPDATE itemNoteTitles SET title=? WHERE itemID=?", [f(reversed[maxLengthIndex].itemID), childNotes[j].itemID]);
						}
						Zotero.DB.query("DELETE FROM itemNotes WHERE note=? AND sourceItemID=?", [childNotes[j].itemID, childNotes[j].sourceItemID]);
					}
				}
				
				// 1.0.0b4.r2
				
				if (i==29) {
					Zotero.DB.query("CREATE TABLE IF NOT EXISTS settings (\n    setting TEXT,\n    key TEXT,\n    value,\n    PRIMARY KEY (setting, key)\n);");
				}
			}
			
			_updateSchema('userdata');
			_updateFailsafeSchema();
			
			Zotero.DB.commitTransaction();
		}
		catch(e){
			Zotero.DB.rollbackTransaction();
			throw(e);
		}
		
		return true;
	}
	
	
	function _updateFailsafeSchema(){
		// This is super-annoying, but SQLite didn't have IF [NOT] EXISTS
		// on trigger statements until 3.3.8, which didn't make it into
		// Firefox 2.0, so we just throw the triggers at the DB on every
		// userdata update and catch errors individually
		//
		
		try { Zotero.DB.query("DROP TRIGGER insert_date_field"); } catch (e) {}
		try { Zotero.DB.query("DROP TRIGGER update_date_field"); } catch (e) {}
		
		var itemDataTrigger = "  FOR EACH ROW WHEN NEW.fieldID IN (14, 27, 52, 96, 100)\n"
			+ "  BEGIN\n"
			+ "    SELECT CASE\n"
			+ "        CAST(SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 1, 4) AS INT) BETWEEN 0 AND 9999 AND\n"
			+ "        SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 5, 1) = '-' AND\n"
			+ "        CAST(SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 6, 2) AS INT) BETWEEN 0 AND 12 AND\n"
			+ "        SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 8, 1) = '-' AND\n"
			+ "        CAST(SUBSTR((SELECT value FROM itemDataValues WHERE valueID=NEW.valueID), 9, 2) AS INT) BETWEEN 0 AND 31\n"
			+ "      WHEN 0 THEN RAISE (ABORT, 'Date field must begin with SQL date') END;\n"
			+ "  END;\n";
		
		try {
			var sql = "CREATE TRIGGER insert_date_field BEFORE INSERT ON itemData\n"
				+ itemDataTrigger;
			Zotero.DB.query(sql);
		}
		catch (e){}
		
		try {
			var sql = "CREATE TRIGGER update_date_field BEFORE UPDATE ON itemData\n"
				+ itemDataTrigger;
			Zotero.DB.query(sql);
		}
		catch (e){}
	}
}
