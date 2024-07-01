/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

Zotero.Schema = new function(){
	this.dbInitialized = false;
	this.goToChangeLog = false;
	
	this.REPO_UPDATE_PERIODIC = 0;
	this.REPO_UPDATE_MANUAL = 1;
	this.REPO_UPDATE_INITIAL = 2;
	this.REPO_UPDATE_STARTUP = 3;
	this.REPO_UPDATE_NOTIFICATION = 4;
	
	var _schemaUpdateDeferred = Zotero.Promise.defer();
	this.schemaUpdatePromise = _schemaUpdateDeferred.promise;
	
	const REPOSITORY_CHECK_INTERVAL = 86400;
	const REPOSITORY_RETRY_INTERVAL = 3600;
	
	// If updating from this userdata version or later, don't show "Upgrading database…" and don't make
	// DB backup first. This should be set to false when breaking compatibility or making major changes.
	const minorUpdateFrom = 112;
	
	var _dbVersions = [];
	var _schemaVersions = [];
	// Update when adding _updateCompatibility() line to schema update step
	var _maxCompatibility = 7;
	
	var _repositoryTimerID;
	var _repositoryNotificationTimerID;
	var _nextRepositoryUpdate;
	var _remoteUpdateInProgress = false;
	var _localUpdateInProgress = false;
	var _hiddenNoticesWithoutIDs = new Map();
	
	var self = this;
	
	/*
	 * Retrieve the DB schema version
	 */
	this.getDBVersion = function (schema) {
		if (_dbVersions[schema]){
			return Zotero.Promise.resolve(_dbVersions[schema]);
		}
		
		var sql = "SELECT version FROM version WHERE schema='" + schema + "'";
		return Zotero.DB.valueQueryAsync(sql)
		.then(function (dbVersion) {
			if (dbVersion) {
				dbVersion = parseInt(dbVersion);
				_dbVersions[schema] = dbVersion;
			}
			return dbVersion;
		})
		.catch(function (e) {
			return Zotero.DB.tableExists('version')
			.then(function (exists) {
				if (exists) {
					throw e;
				}
				return false;
			});
		});
	}
	
	
	/*
	 * Checks if the DB schema exists and is up-to-date, updating if necessary
	 */
	this.updateSchema = async function (options = {}) {
		// TODO: Check database integrity first with Zotero.DB.integrityCheck()
		
		// 'userdata' is the last upgrade step run in _migrateUserDataSchema() based on the
		// version in the schema file. Upgrade steps may or may not break DB compatibility.
		//
		// 'compatibility' is incremented manually by upgrade steps in order to break DB
		// compatibility with older versions.
		var versions = await Zotero.Promise.all([
			this.getDBVersion('userdata'), this.getDBVersion('compatibility')
		]);
		var [userdata, compatibility] = versions;
		if (!userdata) {
			Zotero.debug('Database does not exist -- creating\n');
			return _initializeSchema()
			.then(function() {
				// Don't load bundled files until after UI is ready, unless this is a test run,
				// in which case tests can run without a window open
				(!Zotero.test ? Zotero.uiReadyPromise : Zotero.initializationPromise)
				.delay(1000)
				.then(async function () {
					await this.updateBundledFiles();
					if (Zotero.Prefs.get('automaticScraperUpdates')) {
						try {
							await this.updateFromRepository(this.REPO_UPDATE_INITIAL);
						}
						catch (e) {
							Zotero.logError(e);
						}
					}
					_schemaUpdateDeferred.resolve(true);
				}.bind(this))
			}.bind(this));
		}
		
		// We don't handle upgrades from pre-Zotero 2.1 databases
		if (userdata < 76) {
			let msg = Zotero.getString('upgrade.nonupgradeableDB1')
				+ "\n\n" + Zotero.getString('upgrade.nonupgradeableDB2', "4.0");
			throw new Error(msg);
		}
		
		if (compatibility > _maxCompatibility) {
			let dbClientVersion = await Zotero.DB.valueQueryAsync(
				"SELECT value FROM settings "
				+ "WHERE setting='client' AND key='lastCompatibleVersion'"
			);
			let msg = "Database is incompatible with this Zotero version "
				+ `(${compatibility} > ${_maxCompatibility})`
			throw new Zotero.DB.IncompatibleVersionException(msg, dbClientVersion);
		}
		
		// Check if DB is coming from the DB Repair Tool and should be checked
		var integrityCheckRequired = await this.integrityCheckRequired();
		
		// Check whether bundled global schema file is newer than DB
		var bundledGlobalSchema = await _readGlobalSchemaFromFile();
		var bundledGlobalSchemaVersionCompare = await _globalSchemaVersionCompare(
			bundledGlobalSchema.version
		);
		
		// Check whether bundled userdata schema has been updated
		var userdataVersion = await _getSchemaSQLVersion('userdata');
		options.minor = minorUpdateFrom && userdata >= minorUpdateFrom;
		
		// If non-minor userdata upgrade, make backup of database first
		if (userdata < userdataVersion && !options.minor) {
			await Zotero.DB.backupDatabase(userdata, true);
		}
		// Automatic backup
		else if (integrityCheckRequired || bundledGlobalSchemaVersionCompare === 1) {
			await Zotero.DB.backupDatabase(false, true);
		}
		
		var logLines = [];
		var listener = function (line) {
			logLines.push(line);
		}
		Zotero.Debug.addListener(listener);
		
		var updated;
		await Zotero.DB.queryAsync("PRAGMA foreign_keys = false");
		try {
			// Auto-repair databases flagged for repair or coming from the DB Repair Tool
			//
			// If we need to run migration steps, skip the check until after the update, since
			// the integrity check is expecting to run on the current data model.
			let integrityCheckDone = false;
			let toVersion = await _getSchemaSQLVersion('userdata');
			if (integrityCheckRequired && userdata >= toVersion) {
				await this.integrityCheck(true);
				integrityCheckDone = true;
			}
			
			// TEMP
			try {
				await _fixSciteValues();
			}
			catch (e) {
				Zotero.logError(e);
			}
			
			updated = await Zotero.DB.executeTransaction(async function (conn) {
				var updated = await _updateSchema('system');
				
				// Update custom tables if they exist so that changes are in
				// place before user data migration
				if (Zotero.DB.tableExists('customItemTypes')) {
					await _updateCustomTables();
				}
				
				updated = await _migrateUserDataSchema(userdata, options);
				await _updateSchema('triggers');
				
				// Populate combined tables for custom types and fields -- this is likely temporary
				//
				// We do this again in case custom fields were changed during user data migration
				await _updateCustomTables();
				
				return updated;
			}.bind(this));
			
			// If we updated the DB, also do an integrity check for good measure
			if (updated && !integrityCheckDone) {
				await this.integrityCheck(true);
			}
			
			// If bundled global schema file is newer than DB, apply it
			if (bundledGlobalSchemaVersionCompare === 1) {
				await Zotero.DB.executeTransaction(async function () {
					await _updateGlobalSchema(bundledGlobalSchema);
				});
			}
			else {
				let data;
				// If bundled global schema is up to date, use it
				if (bundledGlobalSchemaVersionCompare === 0) {
					data = bundledGlobalSchema;
				}
				// If bundled global schema is older than the DB (because of a downgrade), use the
				// DB version, which will match the mapping tables
				else if (bundledGlobalSchemaVersionCompare === -1) {
					data = await _readGlobalSchemaFromDB();
				}
				await _loadGlobalSchema(data, bundledGlobalSchema.version);
			}
		}
		finally {
			await Zotero.DB.queryAsync("PRAGMA foreign_keys = true");
			
			Zotero.Debug.removeListener(listener);
			
			// If upgrade succeeded or failed (but not if there was nothing to do), save a log file
			// in logs/upgrade.log in the data directory
			if (updated || updated === undefined) {
				Zotero.getSystemInfo()
					.then(async function (sysInfo) {
						var logDir = OS.Path.join(Zotero.DataDirectory.dir, 'logs');
						Zotero.File.createDirectoryIfMissing(logDir)
						
						await OS.Path
						var output = Zotero.getErrors(true).join('\n\n')
							+ "\n\n" + sysInfo + "\n\n"
							+ "=========================================================\n\n"
							+ logLines.join('\n\n');
						return Zotero.File.putContentsAsync(
							OS.Path.join(logDir, 'upgrade.log'),
							output
						);
					});
			}
		}
		
		if (updated) {
			// Upgrade seems to have been a success -- delete any previous backups
			var maxPrevious = userdata - 1;
			var file = Zotero.File.pathToFile(Zotero.DataDirectory.dir);
			var toDelete = [];
			try {
				var files = file.directoryEntries;
				while (files.hasMoreElements()) {
					var file = files.getNext();
					file.QueryInterface(Components.interfaces.nsIFile);
					if (file.isDirectory()) {
						continue;
					}
					var matches = file.leafName.match(/zotero\.sqlite\.([0-9]{2,})\.bak/);
					if (!matches) {
						continue;
					}
					if (matches[1]>=28 && matches[1]<=maxPrevious) {
						toDelete.push(file);
					}
				}
				for (let file of toDelete) {
					Zotero.debug('Removing previous backup file ' + file.leafName);
					file.remove(false);
				}
			}
			catch (e) {
				Zotero.debug(e);
			}
		}
		
		// Reset sync queue tries if new version
		await _checkClientVersion();
		
		// See above
		(!Zotero.test ? Zotero.uiReadyPromise : Zotero.initializationPromise)
		.then(() => {
			setTimeout(async function () {
				try {
					await this.updateBundledFiles();
					if (Zotero.Prefs.get('automaticScraperUpdates')) {
						try {
							await this.updateFromRepository(this.REPO_UPDATE_STARTUP);
						}
						catch (e) {
							Zotero.logError(e);
						}
					}
					_schemaUpdateDeferred.resolve(true);
				}
				catch (e) {
					// DB corruption already shows an alert
					if (Zotero.DB.isCorruptionError(e)) {
						_schemaUpdateDeferred.reject(e);
						return;
					}
					
					let kbURL = 'https://www.zotero.org/support/kb/unable_to_load_translators_and_styles';
					let msg = Zotero.getString('startupError.bundledFileUpdateError', Zotero.clientName);
					
					let ps = Services.prompt;
					let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
						+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
						+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
					let index = ps.confirmEx(
						null,
						Zotero.getString('general.error'),
						msg,
						buttonFlags,
						Zotero.getString('general.moreInformation'),
						"",
						Zotero.getString('errorReport.reportError'),
						null, {}
					);
					
					_schemaUpdateDeferred.reject(e);
					
					if (index == 0) {
						Zotero.launchURL(kbURL);
					}
					else if (index == 2) {
						setTimeout(function () {
							Zotero.getActiveZoteroPane().reportErrors();
						}, 250);
					}
				}
			}.bind(this), 1000);
		});
		
		return updated;
	};
	
	
	/**
	 * Get bundled schema from disk
	 *
	 * @return {Object}
	 */
	async function _readGlobalSchemaFromFile() {
		return JSON.parse(
			await Zotero.File.getResourceAsync('resource://zotero/schema/global/schema.json')
		);
	}
	
	
	/**
	 * Get schema from database
	 *
	 * Doesn't include the .itemTypes property, which was already applied to the mapping tables
	 */
	async function _readGlobalSchemaFromDB() {
		var data = await Zotero.DB.valueQueryAsync(
			"SELECT value FROM settings WHERE setting='globalSchema' AND key='data'"
		);
		if (data) {
			try {
				let pako = require('pako');
				return JSON.parse(pako.inflate(data, { to: 'string' }));
			}
			catch (e) {
				Zotero.warn("Unable to extract global schema -- falling back to file: " + e);
			}
		}
		else {
			Zotero.warn("Global schema not found in DB -- falling back to file");
		}
		
		// If the data is missing or unreadable in the DB for some reason (e.g., DB corruption),
		// fall back to the file, though it might be out of date
		data = await _readGlobalSchemaFromFile();
		
		return data;
	}
	
	
	/**
	 * Compares a given version number to the version of the schema in the database
	 *
	 * @return {Number} - 1 if provided version is greater than DB (i.e., DB needs update), 0 if
	 *     the same, -1 if DB version is newer
	 */
	async function _globalSchemaVersionCompare(version) {
		if (!version) {
			throw new Error("version not specified");
		}
		
		var dbVersion = await Zotero.Schema.getDBVersion('globalSchema') || null;
		if (dbVersion > version) {
			Zotero.debug(`Database has newer global schema (${dbVersion} > ${version}) `
				+ `-- skipping update and using schema from DB`);
			return -1;
		}
		else if (dbVersion == version) {
			Zotero.debug(`Database is up to date with global schema version ${version} -- skipping update`);
			return 0;
		}
		
		Zotero.debug(`Global schema needs update from ${dbVersion} to ${version}`);
		return 1;
	}
	
	
	/**
	 * Update the item-type/field/creator mapping tables based on the passed schema
	 */
	async function _updateGlobalSchema(data, options) {
		Zotero.debug("Updating global schema to version " + data.version);
		
		Zotero.DB.requireTransaction();
		
		await Zotero.ID.init();
		
		var preItemTypeRows = await Zotero.DB.queryAsync(
			"SELECT itemTypeID AS id, typeName AS name FROM itemTypes"
		);
		var preFieldRows = await Zotero.DB.queryAsync(
			"SELECT fieldID AS id, fieldName AS name FROM fields"
		);
		var preCreatorTypeRows = await Zotero.DB.queryAsync(
			"SELECT creatorTypeID AS id, creatorType AS name FROM creatorTypes"
		);
		var preFields = new Set(preFieldRows.map(x => x.name));
		var preCreatorTypes = new Set(preCreatorTypeRows.map(x => x.name));
		var preItemTypeIDsByName = new Map(preItemTypeRows.map(x => [x.name, x.id]));
		var preFieldIDsByName = new Map(preFieldRows.map(x => [x.name, x.id]));
		var preCreatorTypeIDsByName = new Map(preCreatorTypeRows.map(x => [x.name, x.id]));
		var postFields = new Set();
		var postCreatorTypes = new Set();
		var postFieldIDsByName = new Map();
		var postCreatorTypeIDsByName = new Map();
		
		// Add new fields and creator types
		for (let { fields, creatorTypes } of data.itemTypes) {
			for (let { field, baseField } of fields) {
				postFields.add(field);
				if (baseField) {
					postFields.add(baseField);
				}
			}
			
			for (let { creatorType } of creatorTypes) {
				postCreatorTypes.add(creatorType);
			}
		}
		var fieldsValueSets = [];
		var fieldsParams = [];
		for (let field of postFields) {
			if (preFields.has(field)) {
				postFieldIDsByName.set(field, preFieldIDsByName.get(field));
			}
			else {
				let id = Zotero.ID.get('fields');
				fieldsValueSets.push("(?, ?, NULL)");
				fieldsParams.push(id, field);
				postFieldIDsByName.set(field, id);
			}
		}
		if (fieldsValueSets.length) {
			await Zotero.DB.queryAsync(
				"INSERT INTO fields VALUES " + fieldsValueSets.join(", "),
				fieldsParams
			);
		}
		var creatorTypesValueSets = [];
		var creatorTypesParams = [];
		for (let type of postCreatorTypes) {
			if (preCreatorTypes.has(type)) {
				postCreatorTypeIDsByName.set(type, preCreatorTypeIDsByName.get(type));
			}
			else {
				let id = Zotero.ID.get('creatorTypes');
				creatorTypesValueSets.push("(?, ?)");
				creatorTypesParams.push(id, type);
				postCreatorTypeIDsByName.set(type, id);
			}
		}
		if (creatorTypesValueSets.length) {
			await Zotero.DB.queryAsync(
				"INSERT INTO creatorTypes VALUES " + creatorTypesValueSets.join(", "),
				creatorTypesParams
			);
		}
		
		// Apply changes to DB
		let itemTypeFieldsValueSets = [];
		let baseFieldMappingsValueSets = [];
		let itemTypeCreatorTypesValueSets = [];
		for (let { itemType, fields, creatorTypes } of data.itemTypes) {
			let itemTypeID = preItemTypeIDsByName.get(itemType);
			// let preItemTypeCreatorTypeIDs = [];
			if (itemTypeID) {
				// Unused
				/*preItemTypeCreatorTypeIDs = await Zotero.DB.columnQueryAsync(
					"SELECT creatorTypeID FROM itemTypeCreatorTypes WHERE itemTypeID=?",
					itemTypeID
				);*/
			}
			// New item type
			else {
				itemTypeID = Zotero.ID.get('itemTypes');
				await Zotero.DB.queryAsync(
					"INSERT INTO itemTypes VALUES (?, ?, NULL, 1)",
					[itemTypeID, itemType]
				);
			}
			
			// Fields
			let index = 0;
			let postItemTypeFieldIDs = new Set();
			for (let { field, baseField } of fields) {
				let fieldID = postFieldIDsByName.get(field);
				postItemTypeFieldIDs.add(fieldID);
				itemTypeFieldsValueSets.push(`(${itemTypeID}, ${fieldID}, 0, ${index++})`);
				if (baseField) {
					let baseFieldID = postFieldIDsByName.get(baseField);
					baseFieldMappingsValueSets.push(`(${itemTypeID}, ${baseFieldID}, ${fieldID})`);
				}
			}
			
			
			// TODO: Check for fields removed from this item type
			// throw new Error(`Field ${id} was removed from ${itemType}`);
			
			// Creator types
			for (let { creatorType, primary } of creatorTypes) {
				let typeID = postCreatorTypeIDsByName.get(creatorType);
				itemTypeCreatorTypesValueSets.push(`(${itemTypeID}, ${typeID}, ${primary ? 1 : 0})`);
			}
			
			// TODO: Check for creator types removed from this item type
			// throw new Error(`Creator type ${id} was removed from ${itemType}`);
			
			// TODO: Deal with existing types not in the schema, and their items
		}
		
		await Zotero.DB.queryAsync("DELETE FROM itemTypeFields");
		await Zotero.DB.queryAsync("DELETE FROM baseFieldMappings");
		await Zotero.DB.queryAsync("DELETE FROM itemTypeCreatorTypes");
		
		await Zotero.DB.queryAsync("INSERT INTO itemTypeFields VALUES "
			+ itemTypeFieldsValueSets.join(", "));
		await Zotero.DB.queryAsync("INSERT INTO baseFieldMappings VALUES "
			+ baseFieldMappingsValueSets.join(", "));
		await Zotero.DB.queryAsync("INSERT INTO itemTypeCreatorTypes VALUES "
			+ itemTypeCreatorTypesValueSets.join(", "));
		
		// Store data in DB as compressed binary string. This lets us use a schema that matches the
		// DB tables even if the user downgrades to a version with an earlier bundled schema file.
		var pako = require('pako');
		var dbData = { ...data };
		// Don't include types and fields, which are already in the mapping tables
		delete dbData.itemTypes;
		await Zotero.DB.queryAsync(
			"REPLACE INTO settings VALUES ('globalSchema', 'data', :data)",
			{ data: pako.deflate(JSON.stringify(dbData)) },
			{
				// Hack to pass named parameter to Sqlite.jsm, which in Fx60 treats an object passed
				// as the the first parameter in a parameter array as an object of named parameters
				noParseParams: true,
				debugParams: false
			}
		);
		await _updateDBVersion('globalSchema', data.version);
		
		var bundledVersion = (await _readGlobalSchemaFromFile()).version;
		await _loadGlobalSchema(data, bundledVersion);
		await _reloadSchema(options);
		// Mark that we need to migrate Extra values to any newly available fields in
		// Zotero.Schema.migrateExtraFields()
		await Zotero.DB.queryAsync(
			"REPLACE INTO settings VALUES ('globalSchema', 'migrateExtra', 1)"
		);
		
		return true;
	}
	
	
	this._updateGlobalSchemaForTest = async function (schema) {
		await Zotero.DB.executeTransaction(async function () {
			await _updateGlobalSchema(schema);
		}.bind(this), { disableForeignKeys: true });
	};
	
	
	
	/**
	 * Set properties on Zotero.Schema based on the passed data
	 *
	 * @param {Object} data - Global schema data ('version', 'itemTypes', 'locales', etc.)
	 * @param {Number} bundledVersion - Version of the bundled schema.json file
	 */
	async function _loadGlobalSchema(data, bundledVersion) {
		if (!data) {
			throw new Error("Data not provided");
		}
		Zotero.Schema.globalSchemaVersion = data.version;
		var locale = Zotero.Utilities.Internal.resolveLocale(
			Zotero.locale,
			Object.keys(data.locales)
		);
		Zotero.Schema.globalSchemaLocale = data.locales[locale];
		Zotero.Schema.globalSchemaMeta = data.meta;
		
		//
		// Keep in sync with the connector's gulpfile.js
		//
		
		// CSL mappings
		Zotero.Schema.CSL_TYPE_MAPPINGS = {};
		Zotero.Schema.CSL_TYPE_MAPPINGS_REVERSE = {};
		for (let cslType in data.csl.types) {
			for (let zoteroType of data.csl.types[cslType]) {
				Zotero.Schema.CSL_TYPE_MAPPINGS[zoteroType] = cslType;
			}
			// Add the first mapped Zotero type
			Zotero.Schema.CSL_TYPE_MAPPINGS_REVERSE[cslType] = [...data.csl.types[cslType]];
		}
		Zotero.Schema.CSL_TEXT_MAPPINGS = data.csl.fields.text;
		Zotero.Schema.CSL_DATE_MAPPINGS = data.csl.fields.date;
		Zotero.Schema.CSL_NAME_MAPPINGS = data.csl.names;
		
		// Map Zotero fields to CSL fields
		Zotero.Schema.CSL_FIELD_MAPPINGS_REVERSE = {};
		for (let cslField in data.csl.fields.text) {
			for (let zoteroField of data.csl.fields.text[cslField]) {
				Zotero.Schema.CSL_FIELD_MAPPINGS_REVERSE[zoteroField] = cslField;
			}
		}
		for (let cslField in data.csl.fields.date) {
			let zoteroField = data.csl.fields.date[cslField];
			Zotero.Schema.CSL_FIELD_MAPPINGS_REVERSE[zoteroField] = cslField;
		}
	}
	
	
	/**
	 * Migrate values from item Extra fields that can be moved to regular item fields after a global
	 * schema update
	 *
	 * This needs the data object architecture to be initialized, so it's called from zotero.js
	 * rather than in _updateGlobalSchema().
	 */
	this.migrateExtraFields = async function () {
		// Check for a flag set by _updateGlobalSchema()
		var needsUpdate = await Zotero.DB.valueQueryAsync(
			"SELECT COUNT(*) FROM settings WHERE setting='globalSchema' AND key='migrateExtra'"
		);
		if (!needsUpdate) {
			return;
		}
		
		var fieldID = Zotero.ItemFields.getID('extra');
		var sql = "SELECT itemID, value FROM itemData "
			+ "JOIN itemDataValues USING (valueID) "
			+ "WHERE fieldID=?";
		var rows = await Zotero.DB.queryAsync(sql, fieldID);
		var itemIDs = [];
		for (let row of rows) {
			let { itemType, fields, creators } = Zotero.Utilities.Internal.extractExtraFields(
				row.value
			);
			if (itemType || fields.size || creators.length) {
				itemIDs.push(row.itemID);
			}
		}
		
		var items = await Zotero.Items.getAsync(itemIDs);
		await Zotero.Items.loadDataTypes(items);
		for (let item of items) {
			let changed = item.migrateExtraFields();
			if (!changed) continue;
			await item.saveTx({
				skipDateModifiedUpdate: true,
				skipSelect: true
			});
		}
		
		await Zotero.DB.queryAsync(
			"DELETE FROM settings WHERE setting='globalSchema' AND key='migrateExtra'"
		);
	};
	
	
	// https://www.zotero.org/support/nsf
	//
	// This is mostly temporary
	// TEMP - NSF
	this.importSchema = Zotero.Promise.coroutine(function* (str, uri) {
		var ps = Services.prompt;
		
		if (!uri.match(/https?:\/\/([^\.]+\.)?zotero.org\//)) {
			Zotero.debug("Ignoring schema file from non-zotero.org domain");
			return;
		}
		
		str = str.trim();
		
		Zotero.debug(str);
		
		if (str == "%%%ZOTERO_NSF_TEMP_INSTALL%%%") {
			Zotero.debug(Zotero.ItemTypes.getID("nsfReviewer"));
			if (Zotero.ItemTypes.getID("nsfReviewer")) {
				ps.alert(null, "Zotero Item Type Already Exists", "The 'NSF Reviewer' item type already exists in Zotero.");
				Zotero.debug("nsfReviewer item type already exists");
				return;
			}
			
			Zotero.debug("Installing nsfReviewer item type");
			
			var itemTypeID = Zotero.ID.get('customItemTypes');
			
			yield Zotero.DB.executeTransaction(async function () {
				await Zotero.DB.queryAsync("INSERT INTO customItemTypes VALUES (?, 'nsfReviewer', 'NSF Reviewer', 1, 'chrome://zotero/skin/report_user.png')", itemTypeID);
				
				var fields = [
					['name', 'Name'],
					['institution', 'Institution'],
					['address', 'Address'],
					['telephone', 'Telephone'],
					['email', 'Email'],
					['homepage', 'Webpage'],
					['discipline', 'Discipline'],
					['nsfID', 'NSF ID'],
					['dateSent', 'Date Sent'],
					['dateDue', 'Date Due'],
					['accepted', 'Accepted'],
					['programDirector', 'Program Director']
				];
				for (var i=0; i<fields.length; i++) {
					var fieldID = Zotero.ItemFields.getID(fields[i][0]);
					if (!fieldID) {
						var fieldID = Zotero.ID.get('customFields');
						await Zotero.DB.queryAsync("INSERT INTO customFields VALUES (?, ?, ?)", [fieldID, fields[i][0], fields[i][1]]);
						await Zotero.DB.queryAsync("INSERT INTO customItemTypeFields VALUES (?, NULL, ?, 1, ?)", [itemTypeID, fieldID, i+1]);
					}
					else {
						await Zotero.DB.queryAsync("INSERT INTO customItemTypeFields VALUES (?, ?, NULL, 1, ?)", [itemTypeID, fieldID, i+1]);
					}
					
					switch (fields[i][0]) {
						case 'name':
							var baseFieldID = Zotero.ItemFields.getID('title');
							break;
						
						case 'dateSent':
							var baseFieldID = Zotero.ItemFields.getID('date');
							break;
						
						case 'homepage':
							var baseFieldID = Zotero.ItemFields.getID('url');
							break;
						
						default:
							var baseFieldID = null;
					}
					
					if (baseFieldID) {
						await Zotero.DB.queryAsync("INSERT INTO customBaseFieldMappings VALUES (?, ?, ?)", [itemTypeID, baseFieldID, fieldID]);
					}
				}
				
				await _reloadSchema();
			}, { disableForeignKeys: true });
			
			var s = new Zotero.Search;
			s.name = "Overdue NSF Reviewers";
			s.addCondition('itemType', 'is', 'nsfReviewer');
			s.addCondition('dateDue', 'isBefore', 'today');
			s.addCondition('tag', 'isNot', 'Completed');
			yield s.saveTx();
			
			ps.alert(null, "Zotero Item Type Added", "The 'NSF Reviewer' item type and 'Overdue NSF Reviewers' saved search have been installed.");
		}
		else if (str == "%%%ZOTERO_NSF_TEMP_UNINSTALL%%%") {
			var itemTypeID = Zotero.ItemTypes.getID('nsfReviewer');
			if (!itemTypeID) {
				ps.alert(null, "Zotero Item Type Does Not Exist", "The 'NSF Reviewer' item type does not exist in Zotero.");
				Zotero.debug("nsfReviewer item types doesn't exist", 2);
				return;
			}
			
			var s = new Zotero.Search;
			s.addCondition('itemType', 'is', 'nsfReviewer');
			var s2 = new Zotero.Search;
			s2.addCondition('itemType', 'is', 'nsfReviewer');
			s2.addCondition('deleted', 'true');
			if ((yield s.search()).length || (yield s2.search()).length) {
				ps.alert(null, "Error", "All 'NSF Reviewer' items must be deleted before the item type can be removed from Zotero.");
				return;
			}
			
			Zotero.debug("Uninstalling nsfReviewer item type");
			yield Zotero.DB.executeTransaction(async function () {
				await Zotero.DB.queryAsync("DELETE FROM customItemTypeFields WHERE customItemTypeID=?", itemTypeID - Zotero.ItemTypes.customIDOffset);
				await Zotero.DB.queryAsync("DELETE FROM customBaseFieldMappings WHERE customItemTypeID=?", itemTypeID - Zotero.ItemTypes.customIDOffset);
				var fields = Zotero.ItemFields.getItemTypeFields(itemTypeID);
				for (let fieldID of fields) {
					if (Zotero.ItemFields.isCustom(fieldID)) {
						await Zotero.DB.queryAsync("DELETE FROM customFields WHERE customFieldID=?", fieldID - Zotero.ItemTypes.customIDOffset);
					}
				}
				await Zotero.DB.queryAsync("DELETE FROM customItemTypes WHERE customItemTypeID=?", itemTypeID - Zotero.ItemTypes.customIDOffset);
				
				var searches = Zotero.Searches.getByLibrary(Zotero.Libraries.userLibraryID);
				for (let search of searches) {
					if (search.name == 'Overdue NSF Reviewers') {
						await search.erase();
					}
				}
				
				await _reloadSchema();
			}.bind(this), { disableForeignKeys: true });
			
			ps.alert(null, "Zotero Item Type Removed", "The 'NSF Reviewer' item type has been uninstalled.");
		}
	});
	
	async function _reloadSchema(options) {
		await _updateCustomTables(options);
		await Zotero.ItemTypes.init();
		await Zotero.ItemFields.init();
		await Zotero.CreatorTypes.init();
		await Zotero.SearchConditions.init();
		
		// Update item type menus in every open window
		// TODO: Remove?
		Zotero.Schema.schemaUpdatePromise.then(function () {
			var enumerator = Services.wm.getEnumerator("navigator:browser");
			while (enumerator.hasMoreElements()) {
				let win = enumerator.getNext();
				//win.document.getElementById('zotero-editpane-item-box').buildItemTypeMenu();
			}
		});
	}
	
	
	var _updateCustomTables = async function (options) {
		Zotero.debug("Updating custom tables");
		
		Zotero.DB.requireTransaction();
		
		if (!options?.foreignKeyChecksAllowed) {
			if (await Zotero.DB.valueQueryAsync("PRAGMA foreign_keys")) {
				throw new Error("Foreign key checks must be disabled before updating custom tables");
			}
		}
		
		await Zotero.DB.queryAsync("DELETE FROM itemTypesCombined");
		await Zotero.DB.queryAsync("DELETE FROM fieldsCombined");
		await Zotero.DB.queryAsync("DELETE FROM itemTypeFieldsCombined");
		await Zotero.DB.queryAsync("DELETE FROM baseFieldMappingsCombined");
		
		var offset = Zotero.ItemTypes.customIDOffset;
		await Zotero.DB.queryAsync(
			"INSERT INTO itemTypesCombined "
				+ "SELECT itemTypeID, typeName, display, 0 AS custom FROM itemTypes UNION "
				+ "SELECT customItemTypeID + " + offset + " AS itemTypeID, typeName, display, 1 AS custom FROM customItemTypes"
		);
		await Zotero.DB.queryAsync(
			"INSERT INTO fieldsCombined "
				+ "SELECT fieldID, fieldName, NULL AS label, fieldFormatID, 0 AS custom FROM fields UNION "
				+ "SELECT customFieldID + " + offset + " AS fieldID, fieldName, label, NULL, 1 AS custom FROM customFields"
		);
		await Zotero.DB.queryAsync(
			"INSERT INTO itemTypeFieldsCombined "
				+ "SELECT itemTypeID, fieldID, hide, orderIndex FROM itemTypeFields UNION "
				+ "SELECT customItemTypeID + " + offset + " AS itemTypeID, "
					+ "COALESCE(fieldID, customFieldID + " + offset + ") AS fieldID, hide, orderIndex FROM customItemTypeFields"
		);
		await Zotero.DB.queryAsync(
			"INSERT INTO baseFieldMappingsCombined "
				+ "SELECT itemTypeID, baseFieldID, fieldID FROM baseFieldMappings UNION "
				+ "SELECT customItemTypeID + " + offset + " AS itemTypeID, baseFieldID, "
					+ "customFieldID + " + offset + " AS fieldID FROM customBaseFieldMappings"
		);
	};
	
	
	/**
	 * Update styles and translators in data directory with versions from
	 * ZIP file (XPI) or directory (source) in extension directory
	 *
	 * @param {String} [mode] - 'translators' or 'styles'
	 * @return {Promise}
	 */
	this.updateBundledFiles = async function (mode) {
		if (Zotero.skipBundledFiles) {
			Zotero.debug("Skipping bundled file installation");
			return;
		}
		
		if (_localUpdateInProgress) {
			Zotero.debug("Bundled file update already in progress", 2);
			return;
		}
		
		_localUpdateInProgress = true;
		
		try {
			await Zotero.proxyAuthComplete.delay(1000);
			
			Zotero.debug("Updating bundled " + (mode || "files"));
			
			// Get path to add-on
			
			var installLocation = Components.classes["@mozilla.org/file/directory_service;1"]
				.getService(Components.interfaces.nsIProperties)
				.get("AChrom", Components.interfaces.nsIFile).parent;
			installLocation.append("omni.ja");
			installLocation = installLocation.path;
			
			let initOpts = { fromSchemaUpdate: true };
			
			// Update files
			switch (mode) {
			case 'styles':
				await Zotero.Styles.init(initOpts);
				var updated = await _updateBundledFilesAtLocation(installLocation, mode);
				break;
			
			case 'translators':
				await Zotero.Translators.init(initOpts);
				var updated = await _updateBundledFilesAtLocation(installLocation, mode);
				break;
			
			default:
				await Zotero.Translators.init(initOpts);
				let up1 = await _updateBundledFilesAtLocation(installLocation, 'translators', true);
				await Zotero.Styles.init(initOpts);
				let up2 = await _updateBundledFilesAtLocation(installLocation, 'styles');
				var updated = up1 || up2;
			}
		}
		finally {
			_localUpdateInProgress = false;
		}
		
		return updated;
	};
	
	/**
	 * Update bundled files in a given location
	 *
	 * @param {String} installLocation - Path to XPI or source dir
	 * @param {'translators','styles'} mode
	 * @param {Boolean} [skipVersionUpdates=false]
	 */
	var _updateBundledFilesAtLocation = async function (installLocation, mode, skipVersionUpdates) {
		Components.utils.import("resource://gre/modules/FileUtils.jsm");
		
		var isUnpacked = (await OS.File.stat(installLocation)).isDir;
		if(!isUnpacked) {
			var xpiZipReader = Components.classes["@mozilla.org/libjar/zip-reader;1"]
					.createInstance(Components.interfaces.nsIZipReader);
			xpiZipReader.open(new FileUtils.File(installLocation));
		}
		
		switch (mode) {
			case "translators":
				var titleField = 'label';
				var fileExt = ".js";
				var destDir = Zotero.getTranslatorsDirectory().path;
				break;
			
			case "styles":
				var titleField = 'title';
				var fileExt = ".csl";
				var destDir = Zotero.getStylesDirectory().path;
				var hiddenDir = OS.Path.join(destDir, 'hidden');
				break;
			
			default:
				throw new Error("Invalid mode '" + mode + "'");
		}
		
		var modeType = mode.substr(0, mode.length - 1);
		var ModeType = Zotero.Utilities.capitalize(modeType);
		var Mode = Zotero.Utilities.capitalize(mode);
		
		var repotime = await Zotero.File.getResourceAsync("resource://zotero/schema/repotime.txt");
		var date = Zotero.Date.sqlToDate(repotime.trim(), true);
		repotime = Zotero.Date.toUnixTimestamp(date);
		
		var fileNameRE = new RegExp("^[^\.].+\\" + fileExt + "$");
		
		// If directory is empty, force reinstall
		var forceReinstall = true;
		let iterator = new OS.File.DirectoryIterator(destDir);
		try {
			outer:
			while (true) {
				let entries = await iterator.nextBatch(10);
				if (!entries.length) break;
				for (let i = 0; i < entries.length; i++) {
					let entry = entries[i];
					if (!entry.name.match(fileNameRE) || entry.isDir) {
						continue;
					}
					// Not empty
					forceReinstall = false;
					break outer;
				}
			}
		}
		finally {
			iterator.close();
		}
		
		//
		// Delete obsolete files
		//
		var sql = "SELECT version FROM version WHERE schema='delete'";
		var lastVersion = await Zotero.DB.valueQueryAsync(sql);
		
		if(isUnpacked) {
			var deleted = OS.Path.join(installLocation, 'deleted.txt');
			// In source builds, deleted.txt is in the translators directory
			if (!(await OS.File.exists(deleted))) {
				deleted = OS.Path.join(installLocation, 'translators', 'deleted.txt');
				if (!(await OS.File.exists(deleted))) {
					deleted = false;
				}
			}
		} else {
			var deleted = xpiZipReader.getInputStream("deleted.txt");
		}
		
		let deletedVersion;
		if (deleted) {
			deleted = await Zotero.File.getContentsAsync(deleted);
			deleted = deleted.match(/^([^\s]+)/gm);
			deletedVersion = deleted.shift();
		}
		
		if (!lastVersion || lastVersion < deletedVersion) {
			var toDelete = [];
			let iterator = new OS.File.DirectoryIterator(destDir);
			try {
				while (true) {
					let entries = await iterator.nextBatch(10);
					if (!entries.length) break;
					for (let i = 0; i < entries.length; i++) {
						let entry = entries[i];
						
						if ((entry.isSymLink && !(await OS.File.exists(entry.path))) // symlink to non-existent file
								|| entry.isDir) {
							continue;
						}
						
						if (mode == 'styles') {
							switch (entry.name) {
								// Remove update script (included with 3.0 accidentally)
								case 'update':
								
								// Delete renamed/obsolete files
								case 'chicago-note.csl':
								case 'mhra_note_without_bibliography.csl':
								case 'mhra.csl':
								case 'mla.csl':
									toDelete.push(entry.path);
									continue;
								
								// Be a little more careful with this one, in case someone
								// created a custom 'aaa' style
								case 'aaa.csl':
									let str = await Zotero.File.getContentsAsync(entry.path, false, 300);
									if (str.indexOf("<title>American Anthropological Association</title>") != -1) {
										toDelete.push(entry.path);
									}
									continue;
							}
						}
						
						if (forceReinstall || !entry.name.match(fileNameRE)) {
							continue;
						}
						
						if (mode == 'translators') {
							// TODO: Change if the APIs change
							let newObj = await Zotero[Mode].loadFromFile(entry.path);
							if (!deleted.includes(newObj[modeType + "ID"])) {
								continue;
							}
							toDelete.push(entry.path);
						}
					}
				}
			}
			finally {
				iterator.close();
			}
			
			for (let i = 0; i < toDelete.length; i++) {
				let path = toDelete[i];
				Zotero.debug("Deleting " + path);
				try {
					await OS.File.remove(path);
				}
				catch (e) {
					Components.utils.reportError(e);
					Zotero.debug(e, 1);
				}
			}
			
			if (!skipVersionUpdates) {
				let sql = "REPLACE INTO version (schema, version) VALUES ('delete', ?)";
				await Zotero.DB.queryAsync(sql, deletedVersion);
			}
		}
		
		//
		// Update files
		//
		var sql = "SELECT version FROM version WHERE schema=?";
		var lastModTime = await Zotero.DB.valueQueryAsync(sql, mode);
		// Fix millisecond times (possible in 4.0?)
		if (lastModTime > 9999999999) {
			lastModTime = Math.round(lastModTime / 1000);
		}
		var cache = {};
		
		// XPI installation
		if (!isUnpacked) {
			var modTime = Math.round(
				(await OS.File.stat(installLocation)).lastModificationDate.getTime() / 1000
			);
			
			if (!forceReinstall && lastModTime && modTime <= lastModTime) {
				Zotero.debug("Installed " + mode + " are up-to-date with XPI");
				return false;
			}
			
			Zotero.debug("Updating installed " + mode + " from XPI");
			
			let tmpDir = Zotero.getTempDirectory().path;
			
			if (mode == 'translators') {
				// Parse translators.json
				if (!xpiZipReader.hasEntry("translators.json")) {
					Zotero.logError("translators.json not found");
					return false;
				}
				let index = JSON.parse(await Zotero.File.getContentsAsync(
					xpiZipReader.getInputStream("translators.json"))
				);
				for (let id in index) {
					index[id].extract = true;
				}
				
				let sql = "SELECT rowid, fileName, metadataJSON FROM translatorCache";
				let rows = await Zotero.DB.queryAsync(sql);
				// If there's anything in the cache, see what we actually need to extract
				for (let i = 0; i < rows.length; i++) {
					let json = rows[i].metadataJSON;
					try {
						let metadata = JSON.parse(json);
						let id = metadata.translatorID;
						if (index[id] && index[id].lastUpdated <= metadata.lastUpdated) {
							index[id].extract = false;
						}
					}
					catch (e) {
						Zotero.logError(e);
						Zotero.debug(json, 1);
						
						// If JSON is invalid, clear from cache
						await Zotero.DB.queryAsync(
							"DELETE FROM translatorCache WHERE rowid=?",
							rows[i].rowid
						);
					}
				}
				
				for (let translatorID in index) {
					// Use index file and DB cache for translator entries,
					// extracting only what's necessary
					let entry = index[translatorID];
					if (!entry.extract) {
						//Zotero.debug("Not extracting '" + entry.label + "' -- same version already in cache");
						continue;
					}
					
					let tmpFile = OS.Path.join(tmpDir, entry.fileName)
					await Zotero.File.removeIfExists(tmpFile);
					xpiZipReader.extract("translators/" + entry.fileName, new FileUtils.File(tmpFile));
					
					var existingObj = Zotero.Translators.get(translatorID);
					if (!existingObj) {
						Zotero.debug("Installing translator '" + entry.label + "'");
					}
					else {
						Zotero.debug("Updating translator '" + existingObj.label + "'");
						await Zotero.File.removeIfExists(existingObj.path);
					}
					
					let destFile = OS.Path.join(destDir, entry.fileName);
					try {
						await OS.File.move(tmpFile, destFile, {
							noOverwrite: true
						});
					}
					catch (e) {
						if (e instanceof OS.File.Error && e.becauseExists) {
							// Could overwrite automatically, but we want to log this
							Zotero.warn("Overwriting translator with same filename '"
								+ entry.fileName + "'");
							await OS.File.move(tmpFile, destFile);
						}
						else {
							throw e;
						}
					}
				}
			}
			// Styles
			else {
				let entries = xpiZipReader.findEntries('styles/*.csl');
				while (entries.hasMore()) {
					let entry = entries.getNext();
					let fileName = entry.substr(7); // strip 'styles/'
					
					let tmpFile = OS.Path.join(tmpDir, fileName);
					await Zotero.File.removeIfExists(tmpFile);
					xpiZipReader.extract(entry, new FileUtils.File(tmpFile));
					let code = await Zotero.File.getContentsAsync(tmpFile);
					let newObj = new Zotero.Style(code);
					
					let existingObj = Zotero.Styles.get(newObj[modeType + "ID"]);
					if (!existingObj) {
						Zotero.debug("Installing style '" + newObj[titleField] + "'");
					}
					else {
						Zotero.debug("Updating "
							+ (existingObj.hidden ? "hidden " : "")
							+ "style '" + existingObj[titleField] + "'");
						await Zotero.File.removeIfExists(existingObj.path);
					}
					
					if (!existingObj || !existingObj.hidden) {
						await OS.File.move(tmpFile, OS.Path.join(destDir, fileName));
					}
					else {
						await OS.File.move(tmpFile, OS.Path.join(hiddenDir, fileName));
					}
				}
			}
			
			if(xpiZipReader) xpiZipReader.close();
		}
		// Source installation
		else {
			let sourceDir = OS.Path.join(installLocation, mode);
			
			var modTime = 0;
			let sourceFilesExist = false;
			let iterator;
			try {
				iterator = new OS.File.DirectoryIterator(sourceDir);
			}
			catch (e) {
				if (e instanceof OS.File.Error && e.becauseNoSuchFile) {
					let msg = "No " + mode + " directory";
					Zotero.debug(msg, 1);
					Components.utils.reportError(msg);
					return false;
				}
				throw e;
			}
			try {
				while (true) {
					let entries = await iterator.nextBatch(10); // TODO: adjust as necessary
					if (!entries.length) break;
					for (let i = 0; i < entries.length; i++) {
						let entry = entries[i];
						if (!entry.name.match(fileNameRE) || entry.isDir) {
							continue;
						}
						sourceFilesExist = true;
						let d;
						if ('winLastWriteDate' in entry) {
							d = entry.winLastWriteDate;
						}
						else {
							d = (await OS.File.stat(entry.path)).lastModificationDate;
						}
						let fileModTime = Math.round(d.getTime() / 1000);
						if (fileModTime > modTime) {
							modTime = fileModTime;
						}
					}
				}
			}
			finally {
				iterator.close();
			}
			
			// Don't attempt installation for source build with missing styles
			if (!sourceFilesExist) {
				Zotero.debug("No source " + modeType + " files exist -- skipping update");
				return false;
			}
			
			if (!forceReinstall && lastModTime && modTime <= lastModTime) {
				Zotero.debug("Installed " + mode + " are up-to-date with " + mode + " directory");
				return false;
			}
			
			Zotero.debug("Updating installed " + mode + " from " + mode + " directory");
			
			iterator = new OS.File.DirectoryIterator(sourceDir);
			try {
				while (true) {
					let entries = await iterator.nextBatch(10); // TODO: adjust as necessary
					if (!entries.length) break;
					
					for (let i = 0; i < entries.length; i++) {
						let entry = entries[i];
						if (!entry.name.match(fileNameRE) || entry.isDir) {
							continue;
						}
						let newObj;
						if (mode == 'styles') {
							let code = await Zotero.File.getContentsAsync(entry.path);
							newObj = new Zotero.Style(code);
						}
						else if (mode == 'translators') {
							newObj = await Zotero.Translators.loadFromFile(entry.path);
						}
						else {
							throw new Error("Invalid mode '" + mode + "'");
						}
						let existingObj = Zotero[Mode].get(newObj[modeType + "ID"]);
						if (!existingObj) {
							Zotero.debug("Installing " + modeType + " '" + newObj[titleField] + "'");
						}
						else {
							Zotero.debug("Updating "
								+ (existingObj.hidden ? "hidden " : "")
								+ modeType + " '" + existingObj[titleField] + "'");
							await Zotero.File.removeIfExists(existingObj.path);
						}
						
						let fileName;
						if (mode == 'translators') {
							fileName = Zotero.Translators.getFileNameFromLabel(
								newObj[titleField], newObj.translatorID
							);
						}
						else if (mode == 'styles') {
							fileName = entry.name;
						}
						
						try {
							let destFile;
							if (!existingObj || !existingObj.hidden) {
								destFile = OS.Path.join(destDir, fileName);
							}
							else {
								destFile = OS.Path.join(hiddenDir, fileName)
							}
							
							try {
								await OS.File.copy(entry.path, destFile, { noOverwrite: true });
							}
							catch (e) {
								if (e instanceof OS.File.Error && e.becauseExists) {
									// Could overwrite automatically, but we want to log this
									Zotero.warn("Overwriting " + modeType + " with same filename "
										+ "'" + fileName + "'", 1);
									await OS.File.copy(entry.path, destFile);
								}
								else {
									throw e;
								}
							}
							
							if (mode == 'translators') {
								cache[fileName] = newObj.metadata;
							}
						}
						catch (e) {
							Components.utils.reportError("Error copying file " + fileName + ": " + e);
						}
					}
				}
			}
			finally {
				iterator.close();
			}
		}
		
		await Zotero.DB.executeTransaction(async function () {
			var sql = "REPLACE INTO version VALUES (?, ?)";
			await Zotero.DB.queryAsync(sql, [mode, modTime]);
			
			if (!skipVersionUpdates) {
				sql = "REPLACE INTO version VALUES ('repository', ?)";
				await Zotero.DB.queryAsync(sql, repotime);
			}
		});
		
		await Zotero[Mode].reinit({
			metadataCache: cache,
			fromSchemaUpdate: true
		});
		
		return true;
	};
	
	
	this.onUpdateNotification = async function (delay) {
		if (!Zotero.Prefs.get('automaticScraperUpdates')) {
			return;
		}
		
		// If another repository check -- either from notification or daily check -- is scheduled
		// before delay, just wait for that one
		if (_nextRepositoryUpdate) {
			if (_nextRepositoryUpdate <= (Date.now() + delay)) {
				Zotero.debug("Next scheduled update from repository is in "
					+ Math.round((_nextRepositoryUpdate - Date.now()) / 1000) + " seconds "
					+ "-- ignoring notification");
				return;
			}
			if (_repositoryNotificationTimerID) {
				clearTimeout(_repositoryNotificationTimerID);
			}
		}
		
		_nextRepositoryUpdate = Date.now() + delay;
		Zotero.debug(`Updating from repository in ${Math.round(delay / 1000)} seconds`);
		_repositoryNotificationTimerID = setTimeout(() => {
			this.updateFromRepository(this.REPO_UPDATE_NOTIFICATION)
		}, delay);
	};
	
	
	/**
	 * Send XMLHTTP request for updated translators and styles to the central repository
	 *
	 * @param {Integer} [mode=0] - If non-zero, force a repository query regardless of how long it's
	 *     been since the last check. Should be a REPO_UPDATE_* constant.
	 */
	this.updateFromRepository = async function (mode = 0) {
		if (Zotero.skipBundledFiles) {
			Zotero.debug("No bundled files -- skipping repository update");
			return;
		}
		
		if (_remoteUpdateInProgress) {
			Zotero.debug("A remote update is already in progress -- not checking repository");
			return false;
		}
		
		if (mode == this.REPO_UPDATE_PERIODIC) {
			// Check user preference for automatic updates
			if (!Zotero.Prefs.get('automaticScraperUpdates')) {
				Zotero.debug('Automatic repository updating disabled -- not checking repository', 4);
				return false;
			}
			
			// Determine the earliest local time that we'd query the repository again
			let lastCheck = await this.getDBVersion('lastcheck');
			let nextCheck = new Date();
			nextCheck.setTime((lastCheck + REPOSITORY_CHECK_INTERVAL) * 1000);
			
			// If enough time hasn't passed, don't update
			var now = new Date();
			if (now < nextCheck) {
				Zotero.debug('Not enough time since last update -- not checking repository', 4);
				// Set the repository timer to the remaining time
				_setRepositoryTimer(Math.round((nextCheck.getTime() - now.getTime()) / 1000));
				return false;
			}
		}
		
		if (_localUpdateInProgress) {
			Zotero.debug('A local update is already in progress -- delaying repository check', 4);
			_setRepositoryTimer(600);
			return false;
		}
		
		if (Zotero.locked) {
			Zotero.debug('Zotero is locked -- delaying repository check', 4);
			_setRepositoryTimer(600);
			return false;
		}
		
		// If an update from a notification is queued, stop it, since we're updating now
		if (_repositoryNotificationTimerID) {
			clearTimeout(_repositoryNotificationTimerID);
			_repositoryNotificationTimerID = null;
			_nextRepositoryUpdate = null;
		}
		
		if (Zotero.DB.inTransaction()) {
			await Zotero.DB.waitForTransaction();
		}
		
		if (mode == this.REPO_UPDATE_PERIODIC || mode == this.REPO_UPDATE_STARTUP) {
			try {
				await Zotero.Retractions.updateFromServer();
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		
		// Get the last timestamp we got from the server
		var lastUpdated = await this.getDBVersion('repository');
		var updated = false;
		
		try {
			var url = ZOTERO_CONFIG.REPOSITORY_URL + 'updated?'
				+ (lastUpdated ? 'last=' + lastUpdated + '&' : '')
				+ 'version=' + Zotero.version;
			
			Zotero.debug('Checking repository for translator and style updates');
			
			_remoteUpdateInProgress = true;
			
			if (mode) {
				url += '&m=' + mode;
			}
			
			// Send list of installed styles
			var styles = Zotero.Styles.getAll();
			var styleTimestamps = [];
			for (let id in styles) {
				let styleUpdated = Zotero.Date.sqlToDate(styles[id].updated, true);
				styleUpdated = styleUpdated ? styleUpdated.getTime() / 1000 : 0;
				var selfLink = styles[id].url;
				var data = {
					id: id,
					updated: styleUpdated
				};
				if (selfLink) {
					data.url = selfLink;
				}
				styleTimestamps.push(data);
			}
			var body = 'styles=' + encodeURIComponent(JSON.stringify(styleTimestamps));
			
			try {
				var xmlhttp = await Zotero.HTTP.request(
					"POST",
					url,
					{
						body,
						errorDelayMax: 5000,
						errorDelayIntervals: [5000]
					}
				);
				updated = await _handleRepositoryResponse(xmlhttp, mode);
			}
			catch (e) {
				if (mode == this.REPO_UPDATE_PERIODIC) {
					if (e instanceof Zotero.HTTP.UnexpectedStatusException
							|| e instanceof Zotero.HTTP.BrowserOfflineException) {
						let msg = " -- retrying in " + REPOSITORY_RETRY_INTERVAL
						if (e instanceof Zotero.HTTP.BrowserOfflineException) {
							Zotero.debug("Browser is offline" + msg, 2);
						}
						else {
							Zotero.logError(e);
							Zotero.debug(e.status, 1);
							Zotero.debug(e.xmlhttp.responseText, 1);
							Zotero.debug("Error updating from repository " + msg, 1);
						}
						// TODO: instead, add an observer to start and stop timer on online state change
						_setRepositoryTimer(REPOSITORY_RETRY_INTERVAL);
						return;
					}
				}
				if (xmlhttp) {
					Zotero.debug(xmlhttp.status, 1);
					Zotero.debug(xmlhttp.responseText, 1);
				}
				throw e;
			};
		}
		finally {
			if (mode == this.REPO_UPDATE_PERIODIC) {
				_setRepositoryTimer(REPOSITORY_RETRY_INTERVAL);
			}
			_remoteUpdateInProgress = false;
		}
		
		return updated;
	};
	
	
	this.stopRepositoryTimer = function () {
		if (_repositoryTimerID) {
			Zotero.debug('Stopping repository check timer');
			clearTimeout(_repositoryTimerID);
			_repositoryTimerID = null;
		}
		if (_repositoryNotificationTimerID) {
			Zotero.debug('Stopping repository notification update timer');
			clearTimeout(_repositoryNotificationTimerID);
			_repositoryNotificationTimerID = null
		}
		_nextRepositoryUpdate = null;
	}
	
	
	this.resetTranslatorsAndStyles = async function () {
		Zotero.debug("Resetting translators and styles");
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('translators', 'styles', 'repository', 'lastcheck')";
		await Zotero.DB.queryAsync(sql);
		
		sql = "DELETE FROM translatorCache";
		await Zotero.DB.queryAsync(sql);
		
		_dbVersions.repository = null;
		_dbVersions.lastcheck = null;
		
		var translatorsDir = Zotero.getTranslatorsDirectory();
		var stylesDir = Zotero.getStylesDirectory();
		
		translatorsDir.remove(true);
		stylesDir.remove(true);
		
		// Recreate directories
		Zotero.getTranslatorsDirectory();
		Zotero.getStylesDirectory();
		
		await Zotero.Promise.all(Zotero.Translators.reinit(), Zotero.Styles.reinit());
		var updated = await this.updateBundledFiles();
		if (updated && Zotero.Prefs.get('automaticScraperUpdates')) {
			await Zotero.Schema.updateFromRepository(this.REPO_UPDATE_MANUAL);
		}
		return updated;
	};
	
	
	this.resetTranslators = async function () {
		Zotero.debug("Resetting translators");
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('translators', 'repository', 'lastcheck')";
		await Zotero.DB.queryAsync(sql);
		
		sql = "DELETE FROM translatorCache";
		await Zotero.DB.queryAsync(sql);
		
		_dbVersions.repository = null;
		_dbVersions.lastcheck = null;
		
		var translatorsDir = Zotero.getTranslatorsDirectory();
		translatorsDir.remove(true);
		Zotero.getTranslatorsDirectory(); // recreate directory
		await Zotero.Translators.reinit();
		var updated = await this.updateBundledFiles('translators');
		if (updated && Zotero.Prefs.get('automaticScraperUpdates')) {
			await Zotero.Schema.updateFromRepository(this.REPO_UPDATE_MANUAL);
		}
		return updated;
	};
	
	
	this.resetStyles = async function () {
		Zotero.debug("Resetting styles");
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('styles', 'repository', 'lastcheck')";
		await Zotero.DB.queryAsync(sql);
		_dbVersions.repository = null;
		_dbVersions.lastcheck = null;
		
		var stylesDir = Zotero.getStylesDirectory();
		stylesDir.remove(true);
		Zotero.getStylesDirectory(); // recreate directory
		await Zotero.Styles.reinit()
		var updated = await this.updateBundledFiles('styles');
		if (updated && Zotero.Prefs.get('automaticScraperUpdates')) {
			await Zotero.Schema.updateFromRepository(this.REPO_UPDATE_MANUAL);
		}
		return updated;
	};
	
	
	this.integrityCheckRequired = async function () {
		return !!await Zotero.DB.valueQueryAsync(
			"SELECT value FROM settings WHERE setting='db' AND key='integrityCheck'"
		);
	};
	
	
	this.setIntegrityCheckRequired = async function (required) {
		var sql;
		if (required) {
			sql = "REPLACE INTO settings VALUES ('db', 'integrityCheck', 1)";
		}
		else {
			sql = "DELETE FROM settings WHERE setting='db' AND key='integrityCheck'";
		}
		await Zotero.DB.queryAsync(sql);
	};
	
	
	/**
	 * @param {Boolean} [fix=false]
	 * @param {Object} [options]
	 * @param {Boolean} [options.skipReconcile=false] - Don't reconcile the schema to create tables
	 *     and indexes that should have been created and drop existing ones that should have been
	 *     deleted
	 */
	this.integrityCheck = async function (fix, options = {}) {
		Zotero.debug("Checking database schema integrity");
		
		// Just as a sanity check, make sure combined field tables are populated,
		// so that we don't try to wipe out all data
		if (!(await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM fieldsCombined"))
				|| !(await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM itemTypeFieldsCombined"))) {
			Zotero.logError("Combined field tables are empty -- skipping integrity check");
			return false;
		}
		
		var attachmentID = parseInt(await Zotero.DB.valueQueryAsync(
			"SELECT itemTypeID FROM itemTypes WHERE typeName='attachment'"
		));
		var noteID = parseInt(await Zotero.DB.valueQueryAsync(
			"SELECT itemTypeID FROM itemTypes WHERE typeName='note'"
		));
		var annotationID = parseInt((await Zotero.DB.valueQueryAsync(
			"SELECT itemTypeID FROM itemTypes WHERE typeName='annotation'"
		)) || -1);
		
		// The first position is for testing and the second is for repairing. Can be either SQL
		// statements or promise-returning functions. For statements, the repair entry can be either
		// a string or an array with multiple statements. Check functions should return false if no
		// error, and either true or data to pass to the repair function on error. Functions should
		// avoid assuming any global state (e.g., loaded data).
		var checks = [
			[
				// Create any tables or indexes that are missing and delete any tables or triggers
				// that still exist but should have been deleted
				//
				// This is skipped for automatic checks, because it can cause problems with schema
				// update steps that don't expect tables to exist.
				async function () {
					var statementsToRun = [];
					
					// Get all existing tables, indexes, and triggers
					var sql = "SELECT "
						+ "CASE type "
						+ "WHEN 'table' THEN 'table:' || tbl_name "
						+ "WHEN 'index' THEN 'index:' || name "
						+ "WHEN 'trigger' THEN 'trigger:' || name "
						+ "END "
						+ "FROM sqlite_master WHERE type IN ('table', 'index', 'trigger')";
					var schema = new Set(await Zotero.DB.columnQueryAsync(sql));
					
					// Check for deleted tables and triggers that still exist
					var deletedTables = [
						"transactionSets",
						"transactions",
						"transactionLog",
					];
					var deletedTriggers = [
						"insert_date_field",
						"update_date_field",
						"fki_itemAttachments",
						"fku_itemAttachments",
						"fki_itemNotes",
						"fku_itemNotes",
					];
					for (let table of deletedTables) {
						if (schema.has('table:' + table)) {
							statementsToRun.push("DROP TABLE " + table);
						}
					}
					for (let trigger of deletedTriggers) {
						if (schema.has('trigger:' + trigger)) {
							statementsToRun.push("DROP TRIGGER " + trigger);
						}
					}
					
					// Check for missing tables and indexes
					var statements = await Zotero.DB.parseSQLFile(await _getSchemaSQL('userdata'));
					for (let statement of statements) {
						var matches = statement.match(/^CREATE TABLE\s+([^\s]+)/);
						if (matches) {
							let table = matches[1];
							if (!schema.has('table:' + table)) {
								Zotero.debug(`Table ${table} is missing`, 2);
								statementsToRun.push(statement);
							}
							continue;
						}
						
						matches = statement.match(/^CREATE INDEX\s+([^\s]+)/);
						if (matches) {
							let index = matches[1];
							if (!schema.has('index:' + index)) {
								Zotero.debug(`Index ${index} is missing`, 2);
								statementsToRun.push(statement);
							}
							continue;
						}
					}
					
					return statementsToRun.length ? statementsToRun : false;
				},
				async function (statements) {
					for (let statement of statements) {
						await Zotero.DB.queryAsync(statement);
					}
				},
				{
					reconcile: true
				}
			],
		
			// Foreign key checks
			[
				async function () {
					var rows = await Zotero.DB.queryAsync("PRAGMA foreign_key_check");
					if (!rows.length) return false;
					var suffix1 = rows.length == 1 ? '' : 's';
					var suffix2 = rows.length == 1 ? 's' : '';
					Zotero.debug(`Found ${rows.length} row${suffix1} that violate${suffix2} foreign key constraints`, 1);
					return rows;
				},
				// If fixing, delete rows that violate FK constraints
				async function (rows) {
					for (let row of rows) {
						await Zotero.DB.queryAsync(`DELETE FROM ${row.table} WHERE ROWID=?`, row.rowid);
					}
				}
			],
			
			// Can't be a FK with itemTypesCombined
			[
				"SELECT COUNT(*) > 0 FROM items WHERE itemTypeID IS NULL",
				"DELETE FROM items WHERE itemTypeID IS NULL",
			],
			// Non-attachment items in attachments table
			[
				`SELECT COUNT(*) > 0 FROM itemAttachments JOIN items USING (itemID) WHERE itemTypeID != ${attachmentID}`,
				`UPDATE items SET itemTypeID=${attachmentID}, clientDateModified=CURRENT_TIMESTAMP WHERE itemTypeID != ${attachmentID} AND itemID IN (SELECT itemID FROM itemAttachments)`,
			],
			// Fields not in type
			[
				"SELECT COUNT(*) > 0 FROM itemData WHERE fieldID NOT IN (SELECT fieldID FROM itemTypeFieldsCombined WHERE itemTypeID=(SELECT itemTypeID FROM items WHERE itemID=itemData.itemID))",
				"DELETE FROM itemData WHERE fieldID NOT IN (SELECT fieldID FROM itemTypeFieldsCombined WHERE itemTypeID=(SELECT itemTypeID FROM items WHERE itemID=itemData.itemID))",
			],
			// Missing itemAttachments rows
			[
				`SELECT COUNT(*) > 0 FROM items WHERE itemTypeID=${attachmentID} AND itemID NOT IN (SELECT itemID FROM itemAttachments)`,
				`INSERT INTO itemAttachments (itemID, linkMode) SELECT itemID, 0 FROM items WHERE itemTypeID=${attachmentID} AND itemID NOT IN (SELECT itemID FROM itemAttachments)`,
			],
			// Attachments with note parents, unless they're embedded-image attachments
			[
				`SELECT COUNT(*) > 0 FROM itemAttachments `
					+ `WHERE parentItemID IN (SELECT itemID FROM items WHERE itemTypeID=${noteID}) `
					+ `AND linkMode != ${Zotero.Attachments.LINK_MODE_EMBEDDED_IMAGE}`,
				`UPDATE itemAttachments SET parentItemID=NULL `
					+ `WHERE parentItemID IN (SELECT itemID FROM items WHERE itemTypeID=${noteID}) `
					+ `AND linkMode != ${Zotero.Attachments.LINK_MODE_EMBEDDED_IMAGE}`,
			],
			// Attachments with attachment or annotation parents
			[
				`SELECT COUNT(*) > 0 FROM itemAttachments `
					+ `WHERE parentItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (${attachmentID}, ${annotationID}))`,
				`UPDATE itemAttachments SET parentItemID=NULL `
					+ `WHERE parentItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (${attachmentID}, ${annotationID}))`,
			],
			// Notes with note/attachment/annotation parents
			[
				`SELECT COUNT(*) > 0 FROM itemNotes `
					+ `WHERE parentItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (${noteID}, ${attachmentID}, ${annotationID}))`,
				`UPDATE itemNotes SET parentItemID=NULL `
					+ `WHERE parentItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (${noteID}, ${attachmentID}, ${annotationID}))`,
			],
			// Delete empty creators
			// This may cause itemCreator gaps, but that's better than empty creators
			[
				"SELECT COUNT(*) > 0 FROM creators WHERE firstName='' AND lastName=''",
				"DELETE FROM creators WHERE firstName='' AND lastName=''"
			],
			
			// Non-attachment items in the full-text index
			[
				`SELECT COUNT(*) > 0 FROM fulltextItemWords WHERE itemID NOT IN (SELECT itemID FROM items WHERE itemTypeID=${attachmentID})`,
				`DELETE FROM fulltextItemWords WHERE itemID NOT IN (SELECT itemID FROM items WHERE itemTypeID=${attachmentID})`
			],
			// Full-text items must be attachments
			[
				`SELECT COUNT(*) > 0 FROM fulltextItems WHERE itemID NOT IN (SELECT itemID FROM items WHERE itemTypeID=${attachmentID})`,
				`DELETE FROM fulltextItems WHERE itemID NOT IN (SELECT itemID FROM items WHERE itemTypeID=${attachmentID})`
			],
			// Invalid link mode -- set to imported url
			[
				"SELECT COUNT(*) > 0 FROM itemAttachments WHERE linkMode NOT IN (0,1,2,3,4)",
				"UPDATE itemAttachments SET linkMode=1 WHERE linkMode NOT IN (0,1,2,3,4)"
			],
			// Creators with first name can't be fieldMode 1
			[
				"SELECT COUNT(*) > 0 FROM creators WHERE fieldMode = 1 AND firstName != ''",
				function () {
					return Zotero.DB.executeTransaction(async function () {
						var rows = await Zotero.DB.queryAsync("SELECT * FROM creators WHERE fieldMode = 1 AND firstName != ''");
						for (let row of rows) {
							// Find existing fieldMode 0 row and use that if available
							let newID = await Zotero.DB.valueQueryAsync("SELECT creatorID FROM creators WHERE firstName=? AND lastName=? AND fieldMode=0", [row.firstName, row.lastName]);
							if (newID) {
								await Zotero.DB.queryAsync("UPDATE itemCreators SET creatorID=? WHERE creatorID=?", [newID, row.creatorID]);
								await Zotero.DB.queryAsync("DELETE FROM creators WHERE creatorID=?", row.creatorID);
							}
							// Otherwise convert this one to fieldMode 0
							else {
								await Zotero.DB.queryAsync("UPDATE creators SET fieldMode=0 WHERE creatorID=?", row.creatorID);
							}
						}
					});
				}
			],
			// TEXT userID
			[
				"SELECT COUNT(*) > 0 FROM settings WHERE setting='account' AND key='userID' AND TYPEOF(value)='text'",
				async function () {
					let userID = await Zotero.DB.valueQueryAsync("SELECT value FROM settings WHERE setting='account' AND key='userID'");
					await Zotero.DB.queryAsync("UPDATE settings SET value=? WHERE setting='account' AND key='userID'", parseInt(userID.trim()));
				}
			],
			// Invalid collections nesting
			[
				async function () {
					let rows = await Zotero.DB.queryAsync(
						"SELECT collectionID, parentCollectionID FROM collections"
					);
					let map = new Map();
					let ids = [];
					for (let row of rows) {
						map.set(row.collectionID, row.parentCollectionID);
						ids.push(row.collectionID);
					}
					for (let id of ids) {
						// Keep track of collections we've seen
						let seen = new Set([id]);
						while (true) {
							let parent = map.get(id);
							if (!parent) {
								break;
							}
							if (seen.has(parent)) {
								Zotero.debug(`Collection ${id} parent ${parent} was already seen`, 2);
								return true;
							}
							seen.add(parent);
							id = parent;
						}
					}
					return false;
				},
				async function () {
					let fix = async function () {
						let rows = await Zotero.DB.queryAsync(
							"SELECT collectionID, parentCollectionID FROM collections"
						);
						let map = new Map();
						let ids = [];
						for (let row of rows) {
							map.set(row.collectionID, row.parentCollectionID);
							ids.push(row.collectionID);
						}
						for (let id of ids) {
							let seen = new Set([id]);
							while (true) {
								let parent = map.get(id);
								if (!parent) {
									break;
								}
								if (seen.has(parent)) {
									await Zotero.DB.queryAsync(
										"UPDATE collections SET parentCollectionID = NULL "
											+ "WHERE collectionID = ?",
										id
									);
									// Restart
									return true;
								}
								seen.add(parent);
								id = parent;
							}
						}
						// Done
						return false;
					};
					
					while (await fix()) {}
				}
			]
		];
		
		// Remove reconcile steps
		if (options && options.skipReconcile) {
			checks = checks.filter(x => !x[2] || !x[2].reconcile);
		}
	
		for (let check of checks) {
			let errorsFound = false;
			// SQL statement
			if (typeof check[0] == 'string') {
				errorsFound = await Zotero.DB.valueQueryAsync(check[0]);
			}
			// Function
			else {
				errorsFound = await check[0]();
			}
			if (!errorsFound) {
				continue;
			}
			
			Zotero.debug("Test failed!", 1);
			
			if (fix) {
				try {
					// Single query
					if (typeof check[1] == 'string') {
						await Zotero.DB.queryAsync(check[1]);
					}
					// Multiple queries
					else if (Array.isArray(check[1])) {
						for (let s of check[1]) {
							await Zotero.DB.queryAsync(s);
						}
					}
					// Function
					else {
						// If data was provided by the check function, pass that to the fix function
						let checkData = typeof errorsFound != 'boolean' ? errorsFound : null;
						await check[1](checkData);
					}
					continue;
				}
				catch (e) {
					Zotero.logError(e);
					// Clear flag on failure, to avoid showing an error on every startup if someone
					// doesn't know how to deal with it
					await this.setIntegrityCheckRequired(false);
				}
			}
			
			return false;
		}
		
		// Clear flag on success
		if (fix) {
			await this.setIntegrityCheckRequired(false);
		}
		
		return true;
	};
	
	
	/////////////////////////////////////////////////////////////////
	//
	// Private methods
	//
	/////////////////////////////////////////////////////////////////
	
	/**
	 * Retrieve the version from the top line of the schema SQL file
	 *
	 * @return {Promise:String} A promise for the SQL file's version number
	 */
	function _getSchemaSQLVersion(schema){
		return _getSchemaSQL(schema)
		.then(function (sql) {
			// Fetch the schema version from the first line of the file
			var schemaVersion = parseInt(sql.match(/^-- ([0-9]+)/)[1]);
			_schemaVersions[schema] = schemaVersion;
			return schemaVersion;
		});
	}
	
	
	/**
	 * Load in SQL schema
	 *
	 * @return {Promise:String} A promise for the contents of a schema SQL file
	 */
	function _getSchemaSQL(schema){
		if (!schema){
			throw ('Schema type not provided to _getSchemaSQL()');
		}
		
		return Zotero.File.getResourceAsync(`resource://zotero/schema/${schema}.sql`);
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
		var sql = _getSchemaSQL(schema); // FIXME: now a promise
		
		const re = /(?:[\r\n]|^)CREATE (TABLE|INDEX) IF NOT EXISTS ([^\s]+)/;
		var m, str="";
		while(matches = re.exec(sql)) {
			str += "DROP " + matches[1] + " IF EXISTS " + matches[2] + ";\n";
		}
		
		return str;
	}
	
	
	/*
	 * Create new DB schema
	 */
	async function _initializeSchema() {
		await Zotero.DB.executeTransaction(async function (conn) {
			try {
				var userLibraryID = 1;
				
				// Enable auto-vacuuming
				await Zotero.DB.queryAsync("PRAGMA page_size = 4096");
				await Zotero.DB.queryAsync("PRAGMA encoding = 'UTF-8'");
				await Zotero.DB.queryAsync("PRAGMA auto_vacuum = 1");
				
				var sql = await _getSchemaSQL('system');
				await Zotero.DB.executeSQLFile(sql);
				
				sql = await _getSchemaSQL('userdata');
				await Zotero.DB.executeSQLFile(sql);
				
				sql = await _getSchemaSQL('triggers');
				await Zotero.DB.executeSQLFile(sql);
				
				var schema = await _readGlobalSchemaFromFile();
				await _updateGlobalSchema(schema, { foreignKeyChecksAllowed: true });
				
				var version = await _getSchemaSQLVersion('system');
				await _updateDBVersion('system', version);
				
				version = await _getSchemaSQLVersion('userdata');
				await _updateDBVersion('userdata', version);
				
				version = await _getSchemaSQLVersion('triggers');
				await _updateDBVersion('triggers', version);
				
				sql = "INSERT INTO libraries (libraryID, type, editable, filesEditable) "
					+ "VALUES "
					+ "(?, 'user', 1, 1)";
				await Zotero.DB.queryAsync(sql, userLibraryID);
				
				await _updateLastClientVersion();
				await _updateCompatibility(_maxCompatibility);
				
				this.dbInitialized = true;
			}
			catch (e) {
				Zotero.debug(e, 1);
				Components.utils.reportError(e);
				let ps = Services.prompt;
				ps.alert(
					null,
					Zotero.getString('general.error'),
					Zotero.getString('startupError', Zotero.appName)
				);
				throw e;
			}
		}.bind(this));
	}
	
	
	/*
	 * Update a DB schema version tag in an existing database
	 */
	async function _updateDBVersion(schema, version) {
		_dbVersions[schema] = version;
		var sql = "REPLACE INTO version (schema,version) VALUES (?,?)";
		return Zotero.DB.queryAsync(sql, [schema, parseInt(version)]);
	}
	
	
	/**
	 * Requires a transaction
	 */
	var _updateSchema = async function (schema) {
		var [dbVersion, schemaVersion] = await Zotero.Promise.all(
			[Zotero.Schema.getDBVersion(schema), _getSchemaSQLVersion(schema)]
		);
		if (dbVersion == schemaVersion) {
			return false;
		}
		if (dbVersion > schemaVersion) {
			let dbClientVersion = await Zotero.DB.valueQueryAsync(
				"SELECT value FROM settings WHERE setting='client' AND key='lastCompatibleVersion'"
			);
			throw new Zotero.DB.IncompatibleVersionException(
				`Zotero '${schema}' DB version (${dbVersion}) is newer than SQL file (${schemaVersion})`,
				dbClientVersion
			);
		}
		let sql = await _getSchemaSQL(schema);
		await Zotero.DB.executeSQLFile(sql);
		return _updateDBVersion(schema, schemaVersion);
	};
	
	
	var _updateCompatibility = async function (version) {
		if (version > _maxCompatibility) {
			throw new Error("Can't set compatibility greater than _maxCompatibility");
		}
		
		await Zotero.DB.queryAsync(
			"REPLACE INTO settings VALUES ('client', 'lastCompatibleVersion', ?)", [Zotero.version]
		);
		await _updateDBVersion('compatibility', version);
	};
	
	
	function _checkClientVersion() {
		return Zotero.DB.executeTransaction(async function () {
			var lastVersion = await _getLastClientVersion();
			var currentVersion = Zotero.version;
			
			if (currentVersion == lastVersion) {
				return false;
			}
			
			Zotero.debug(`Client version has changed from ${lastVersion} to ${currentVersion}`);
			
			// Retry all queued objects immediately on upgrade
			await Zotero.Sync.Data.Local.resetSyncQueueTries();
			
			// Update version
			await _updateLastClientVersion();
			
			return true;
		}.bind(this));
	}
	
	
	function _getLastClientVersion() {
		var sql = "SELECT value FROM settings WHERE setting='client' AND key='lastVersion'";
		return Zotero.DB.valueQueryAsync(sql);
	}
	
	
	function _updateLastClientVersion() {
		var sql = "REPLACE INTO settings (setting, key, value) VALUES ('client', 'lastVersion', ?)";
		return Zotero.DB.queryAsync(sql, Zotero.version);
	}
	
	
	/**
	 * Process the response from the repository
	 *
	 * @return {Promise:Boolean} A promise for whether the update succeeded
	 **/
	async function _handleRepositoryResponse(xmlhttp, mode) {
		if (!xmlhttp.responseXML){
			try {
				if (xmlhttp.status>1000){
					Zotero.debug('No network connection', 2);
				}
				else {
					Zotero.debug(xmlhttp.status);
					Zotero.debug(xmlhttp.responseText);
					Zotero.debug('Invalid response from repository', 2);
				}
			}
			catch (e){
				Zotero.debug('Repository cannot be contacted');
			}
			return false;
		}
		
		var currentTime = xmlhttp.responseXML.
			getElementsByTagName('currentTime')[0].firstChild.nodeValue;
		var lastCheckTime = Math.round(new Date().getTime()/1000);
		var translatorUpdates = xmlhttp.responseXML.getElementsByTagName('translator');
		var styleUpdates = xmlhttp.responseXML.getElementsByTagName('style');
		
		_showRepositoryMessage(xmlhttp.responseXML);
		_checkRepositoryPrefs(xmlhttp.responseXML);
		
		if (!translatorUpdates.length && !styleUpdates.length){
			await Zotero.DB.executeTransaction(async function (conn) {
				// Store the timestamp provided by the server
				await _updateDBVersion('repository', currentTime);
				
				// And the local timestamp of the update time
				await _updateDBVersion('lastcheck', lastCheckTime);
			});
			
			Zotero.debug('All translators and styles are up-to-date');
			if (mode == this.REPO_UPDATE_PERIODIC) {
				_setRepositoryTimer(REPOSITORY_CHECK_INTERVAL);
			}
			return true;
		}
		
		var updated = false;
		try {
			for (var i=0, len=translatorUpdates.length; i<len; i++){
				await _translatorXMLToFile(translatorUpdates[i]);
			}
			
			for (var i=0, len=styleUpdates.length; i<len; i++){
				await _styleXMLToFile(styleUpdates[i]);
			}
			
			// Rebuild caches
			let fromSchemaUpdate = mode != this.REPO_UPDATE_MANUAL;
			await Zotero.Translators.reinit({ fromSchemaUpdate });
			await Zotero.Styles.reinit({ fromSchemaUpdate });
			
			updated = true;
		}
		catch (e) {
			Zotero.logError(e);
		}
		
		if (updated) {
			await Zotero.DB.executeTransaction(async function (conn) {
				// Store the timestamp provided by the server
				await _updateDBVersion('repository', currentTime);
				
				// And the local timestamp of the update time
				await _updateDBVersion('lastcheck', lastCheckTime);
			});
		}
		
		return updated;
	}
	
	
	/**
	 * Show dialog if repo returns a message
	 */
	function _showRepositoryMessage(responseXML) {
		try {
			var messageElem = responseXML.querySelector('message');
			if (!messageElem || !messageElem.textContent) {
				return;
			}
			
			let hiddenNotices = Zotero.Prefs.get('hiddenNotices') || '{}';
			try {
				hiddenNotices = JSON.parse(hiddenNotices);
			}
			catch (e) {
				Zotero.logError(e);
				hiddenNotices = {};
			}
			
			let id = messageElem.getAttribute('id');
			let title = messageElem.getAttribute('title');
			let text = messageElem.textContent;
			let url = messageElem.getAttribute('infoURL');
			let now = Math.round(Date.now() / 1000);
			let thirtyDays = 86400 * 30;
			
			if (id) {
				if (hiddenNotices[id] && hiddenNotices[id] > now) {
					Zotero.debug("Not showing hidden notice " + id, 2);
					Zotero.debug(text, 2);
					return;
				}
			}
			else {
				let exp = _hiddenNoticesWithoutIDs.get(text);
				if (exp && exp > now) {
					Zotero.debug("Not showing hidden notice", 2);
					Zotero.debug(text, 2);
					return;
				}
			}
			
			setTimeout(() => {
				Zotero.debug(text, 2);
				
				var ps = Services.prompt;
				var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_OK
					+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
				var checkState = {};
				var index = ps.confirmEx(
					null,
					title || Zotero.getString('general.warning'),
					text,
					buttonFlags,
					"",
					// Show "More Information" button if repo includes a URL
					url ? Zotero.getString('general.moreInformation') : "",
					"",
					// Show "Don't show again for 30 days" if repo includes an id
					id ? Zotero.getString('general.dontShowAgainFor', 30, 30) : null,
					checkState
				);
				
				if (index == 1) {
					setTimeout(function () {
						Zotero.launchURL(url);
					}, 1);
				}
				// Handle "Don't show again for 30 days" checkbox
				if (id) {
					if (checkState.value) {
						hiddenNotices[id] = now + thirtyDays;
					}
					// If not checked, still don't show again for a day
					else {
						hiddenNotices[id] = now + 86400;
					}
					// Remove expired hidden notices
					for (let i in hiddenNotices) {
						if (hiddenNotices[i] < now) {
							delete hiddenNotices[i];
						}
					}
					if (Object.keys(hiddenNotices).length) {
						Zotero.Prefs.set('hiddenNotices', JSON.stringify(hiddenNotices));
					}
					else {
						Zotero.Prefs.clear('hiddenNotices');
					}
				}
				else {
					// Don't show id-less messages again for a day
					_hiddenNoticesWithoutIDs.set(text, now + 86400);
				}
			}, 500);
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	
	
	/**
	 * Check for remotely set preferences
	 *
	 * Format:
	 *
	 * <prefs>
	 *     <prefset version="1">
	 *         <pref name="extensions.zotero.import.mendeleyUseOAuth" value="true" />
	 *     </prefset>
	 * </prefs>
	 *
	 * Prefsets must be in increasing order
	 *
	 * @param {XMLDocument} responseXML - Response document from repository
	 */
	function _checkRepositoryPrefs(responseXML) {
		const allowedPrefs = new Set([
			'extensions.zotero.import.mendeleyUseOAuth'
		]);
		try {
			var prefsElem = responseXML.querySelector('prefs');
			if (!prefsElem) {
				return;
			}
			var prefsets = prefsElem.querySelectorAll('prefset');
			for (let prefset of prefsets) {
				let version = parseInt(prefset.getAttribute('version'));
				let pref = prefset.querySelector('pref');
				if (!pref) {
					Zotero.logError('<pref> not found within <prefset>');
					continue;
				}
				if (version <= Zotero.Prefs.get('prefVersion.remote')) {
					break;
				}
				let name = pref.getAttribute('name');
				if (!allowedPrefs.has(name)) {
					Zotero.logError(`${name} cannot be set remotely`);
					continue;
				}
				let value = pref.getAttribute('value');
				if (value == "true") value = true;
				if (value == "false") value = false;
				Zotero.Prefs.set(name, value, true);
				Zotero.Prefs.set('prefVersion.remote', version);
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	
	
	/**
	* Set the interval between repository queries
	*
	* We add an additional two seconds to avoid race conditions
	**/
	function _setRepositoryTimer(delay) {
		var fudge = 2; // two seconds
		var displayInterval = delay + fudge;
		delay = (delay + fudge) * 1000; // convert to ms
		
		if (_repositoryTimerID) {
			clearTimeout(_repositoryTimerID);
			_repositoryTimerID = null;
		}
		if (_repositoryNotificationTimerID) {
			clearTimeout(_repositoryNotificationTimerID);
			_repositoryNotificationTimerID = null;
		}
		
		Zotero.debug('Scheduling next repository check in ' + displayInterval + ' seconds');
		_repositoryTimerID = setTimeout(() => Zotero.Schema.updateFromRepository(), delay);
		_nextRepositoryUpdate = Date.now() + delay;
	}
	
	
	/**
	 * Traverse an XML translator node from the repository and
	 * update the local translators folder with the translator data
	 *
	 * @return {Promise}
	 */
	var _translatorXMLToFile = async function (xmlnode) {
		// Don't split >4K chunks into multiple nodes
		// https://bugzilla.mozilla.org/show_bug.cgi?id=194231
		xmlnode.normalize();
		var translatorID = xmlnode.getAttribute('id');
		var translator = Zotero.Translators.get(translatorID);
		
		// Delete local version of remote translators with priority 0
		if (xmlnode.getElementsByTagName('priority')[0].firstChild.nodeValue === "0") {
			if (translator && (await OS.File.exists(translator.path))) {
				Zotero.debug("Deleting translator '" + translator.label + "'");
				await OS.File.remove(translator.path);
			}
			return false;
		}
		
		var metadata = {
			translatorID: translatorID,
			translatorType: parseInt(xmlnode.getAttribute('type')),
			label: xmlnode.getElementsByTagName('label')[0].firstChild.nodeValue,
			creator: xmlnode.getElementsByTagName('creator')[0].firstChild.nodeValue,
			target: (xmlnode.getElementsByTagName('target').item(0) &&
						xmlnode.getElementsByTagName('target')[0].firstChild)
					? xmlnode.getElementsByTagName('target')[0].firstChild.nodeValue
					: null,
			minVersion: xmlnode.getAttribute('minVersion'),
			maxVersion: xmlnode.getAttribute('maxVersion'),
			priority: parseInt(
				xmlnode.getElementsByTagName('priority')[0].firstChild.nodeValue
			),
			inRepository: true,
		};
		
		var browserSupport = xmlnode.getAttribute('browserSupport');
		if (browserSupport) {
			metadata.browserSupport = browserSupport;
		}
		
		for (let attr of ["configOptions", "displayOptions", "hiddenPrefs"]) {
			try {
				var tags = xmlnode.getElementsByTagName(attr);
				if(tags.length && tags[0].firstChild) {
					metadata[attr] = JSON.parse(tags[0].firstChild.nodeValue);
				}
			} catch(e) {
				Zotero.logError("Invalid JSON for "+attr+" in new version of "+metadata.label+" ("+translatorID+") from repository");
				return;
			}
		}
		
		metadata.lastUpdated = xmlnode.getAttribute('lastUpdated');
		
		// detectCode can not exist or be empty
		var detectCode = (xmlnode.getElementsByTagName('detectCode').item(0) &&
					xmlnode.getElementsByTagName('detectCode')[0].firstChild)
				? xmlnode.getElementsByTagName('detectCode')[0].firstChild.nodeValue
				: null;
		var code = xmlnode.getElementsByTagName('code')[0].firstChild.nodeValue;
		code = (detectCode ? detectCode + "\n\n" : "") + code;
		
		return Zotero.Translators.save(metadata, code);
	};
	
	
	/**
	 * Traverse an XML style node from the repository and
	 * update the local styles folder with the style data
	 */
	var _styleXMLToFile = async function (xmlnode) {
		// Don't split >4K chunks into multiple nodes
		// https://bugzilla.mozilla.org/show_bug.cgi?id=194231
		xmlnode.normalize();
		
		var uri = xmlnode.getAttribute('id');
		var shortName = uri.replace("http://www.zotero.org/styles/", "");
		
		// Delete local style if CSL code is empty
		if (!xmlnode.firstChild) {
			var style = Zotero.Styles.get(uri);
			if (style) {
				await OS.File.remove(style.path);
			}
			return;
		}
		
		// Remove renamed styles, as instructed by the server
		var oldID = xmlnode.getAttribute('oldID');
		if (oldID) {
			var style = Zotero.Styles.get(oldID, true);
			if (style && (await OS.File.exists(style.path))) {
				Zotero.debug("Deleting renamed style '" + oldID + "'");
				await OS.File.remove(style.path);
			}
		}
		
		var str = xmlnode.firstChild.nodeValue;
		var style = Zotero.Styles.get(uri);
		if (style) {
			await Zotero.File.removeIfExists(style.path);
			var destFile = style.path;
		}
		else {
			// Get last part of URI for filename
			var matches = uri.match(/([^\/]+)$/);
			if (!matches) {
				throw ("Invalid style URI '" + uri + "' from repository");
			}
			var destFile = OS.Path.join(
				Zotero.getStylesDirectory().path,
				matches[1] + ".csl"
			);
			if (await OS.File.exists(destFile)) {
				throw new Error("Different style with filename '" + matches[1]
					+ "' already exists");
			}
		}
		
		Zotero.debug("Saving style '" + uri + "'");
		return Zotero.File.putContentsAsync(destFile, str);
	};
	
	
	// TODO
	//
	// If libraryID set, make sure no relations still use a local user key, and then remove on-error code in sync.js
	
	var _migrateUserDataSchema = async function (fromVersion, options = {}) {
		var toVersion = await _getSchemaSQLVersion('userdata');
		
		if (fromVersion >= toVersion) {
			return false;
		}
		
		Zotero.debug('Updating user data tables from version ' + fromVersion + ' to ' + toVersion);
		
		if (options.onBeforeUpdate) {
			let maybePromise = options.onBeforeUpdate({ minor: options.minor });
			if (maybePromise && maybePromise.then) {
				await maybePromise;
			}
		}
		
		Zotero.DB.requireTransaction();
		
		// Use old rename/FK behavior from SQLite <3.25
		// https://stackoverflow.com/a/57275538
		if (fromVersion <= 113) {
			await Zotero.DB.queryAsync("PRAGMA legacy_alter_table=ON");
		}
		
		// Step through version changes until we reach the current version
		//
		// Each block performs the changes necessary to move from the
		// previous revision to that one.
		for (let i = fromVersion + 1; i <= toVersion; i++) {
			if (i == 80) {
				await _updateCompatibility(1);
				
				let userID = await Zotero.DB.valueQueryAsync("SELECT value FROM settings WHERE setting='account' AND key='userID'");
				if (userID && typeof userID == 'string') {
					userID = userID.trim();
					if (userID) {
						await Zotero.DB.queryAsync("UPDATE settings SET value=? WHERE setting='account' AND key='userID'", parseInt(userID));
					}
				}
				
				// Delete 'libraries' rows not in 'groups', which shouldn't exist
				await Zotero.DB.queryAsync("DELETE FROM libraries WHERE libraryID != 0 AND libraryID NOT IN (SELECT libraryID FROM groups)");
				
				await Zotero.DB.queryAsync("ALTER TABLE libraries RENAME TO librariesOld");
				await Zotero.DB.queryAsync("CREATE TABLE libraries (\n    libraryID INTEGER PRIMARY KEY,\n    type TEXT NOT NULL,\n    editable INT NOT NULL,\n    filesEditable INT NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    lastSync INT NOT NULL DEFAULT 0,\n    lastStorageSync INT NOT NULL DEFAULT 0\n)");
				await Zotero.DB.queryAsync("INSERT INTO libraries (libraryID, type, editable, filesEditable) VALUES (1, 'user', 1, 1)");
				await Zotero.DB.queryAsync("INSERT INTO libraries (libraryID, type, editable, filesEditable) VALUES (4, 'publications', 1, 1)");
				await Zotero.DB.queryAsync("INSERT INTO libraries SELECT libraryID, libraryType, editable, filesEditable, 0, 0, 0 FROM librariesOld JOIN groups USING (libraryID)");
				
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO syncObjectTypes VALUES (7, 'setting')");
				await Zotero.DB.queryAsync("DELETE FROM version WHERE schema IN ('userdata2', 'userdata3')");
				
				await Zotero.DB.queryAsync("CREATE TABLE syncCache (\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    syncObjectTypeID INT NOT NULL,\n    version INT NOT NULL,\n    data TEXT,\n    PRIMARY KEY (libraryID, key, syncObjectTypeID, version),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE,\n    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID)\n)");
				
				await Zotero.DB.queryAsync("DROP TABLE translatorCache");
				await Zotero.DB.queryAsync("CREATE TABLE translatorCache (\n    fileName TEXT PRIMARY KEY,\n    metadataJSON TEXT,\n    lastModifiedTime INT\n);");
				
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_annotations_itemID_itemAttachments_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_annotations_itemID_itemAttachments_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_annotations_itemID_itemAttachments_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemAttachments_itemID_annotations_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_collections_parentCollectionID_collections_collectionID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_collections_parentCollectionID_collections_collectionID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_collections_parentCollectionID_collections_collectionID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_collections_collectionID_collections_parentCollectionID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_collectionItems_collectionID_collections_collectionID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_collectionItems_collectionID_collections_collectionID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_collectionItems_collectionID_collections_collectionID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_collections_collectionID_collectionItems_collectionID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_collectionItems_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_collectionItems_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_collectionItems_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_collectionItems_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_creators_creatorDataID_creatorData_creatorDataID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_creators_creatorDataID_creatorData_creatorDataID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_creators_creatorDataID_creatorData_creatorDataID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_creatorData_creatorDataID_creators_creatorDataID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customItemTypes_customItemTypeID_customBaseFieldMappings_customItemTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_customBaseFieldMappings_baseFieldID_fields_fieldID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customBaseFieldMappings_baseFieldID_fields_fieldID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_customBaseFieldMappings_customFieldID_customFields_customFieldID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customBaseFieldMappings_customFieldID_customFields_customFieldID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_customBaseFieldMappings_customFieldID_customFields_customFieldID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customFields_customFieldID_customBaseFieldMappings_customFieldID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customItemTypes_customItemTypeID_customItemTypeFields_customItemTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_customItemTypeFields_fieldID_fields_fieldID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customItemTypeFields_fieldID_fields_fieldID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customItemTypeFields_customFieldID_customFields_customFieldID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_customItemTypeFields_customFieldID_customFields_customFieldID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customFields_customFieldID_customItemTypeFields_customFieldID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_fulltextItems_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_fulltextItems_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_fulltextItems_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_fulltextItems_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_fulltextItemWords_wordID_fulltextWords_wordID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_fulltextItemWords_wordID_fulltextWords_wordID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_fulltextItemWords_wordID_fulltextWords_wordID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_fulltextWords_wordID_fulltextItemWords_wordID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_fulltextItemWords_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_fulltextItemWords_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_fulltextItemWords_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_fulltextItemWords_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_groups_libraryID_libraries_libraryID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_groups_libraryID_libraries_libraryID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_groups_libraryID_libraries_libraryID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_libraries_libraryID_groups_libraryID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_groupItems_createdByUserID_users_userID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_groupItems_createdByUserID_users_userID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_groupItems_createdByUserID_users_userID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_users_userID_groupItems_createdByUserID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_groupItems_lastModifiedByUserID_users_userID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_groupItems_lastModifiedByUserID_users_userID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_groupItems_lastModifiedByUserID_users_userID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_users_userID_groupItems_lastModifiedByUserID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_highlights_itemID_itemAttachments_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_highlights_itemID_itemAttachments_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_highlights_itemID_itemAttachments_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemAttachments_itemID_highlights_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemAttachments_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemAttachments_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemAttachments_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemAttachments_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemAttachments_sourceItemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemAttachments_sourceItemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemAttachments_sourceItemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemAttachments_sourceItemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemCreators_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemCreators_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemCreators_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemCreators_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemCreators_creatorID_creators_creatorID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemCreators_creatorID_creators_creatorID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemCreators_creatorID_creators_creatorID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_creators_creatorID_itemCreators_creatorID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemCreators_creatorTypeID_creatorTypes_creatorTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemCreators_creatorTypeID_creatorTypes_creatorTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemCreators_creatorTypeID_creatorTypes_creatorTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_creatorTypes_creatorTypeID_itemCreators_creatorTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemCreators_libraryID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemCreators_libraryID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemData_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemData_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemData_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemData_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemData_fieldID_fields_fieldID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemData_fieldID_fields_fieldID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemData_valueID_itemDataValues_valueID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemData_valueID_itemDataValues_valueID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemData_valueID_itemDataValues_valueID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemDataValues_valueID_itemData_valueID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemNotes_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemNotes_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemNotes_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemNotes_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemNotes_sourceItemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemNotes_sourceItemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemNotes_sourceItemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemNotes_sourceItemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_items_libraryID_libraries_libraryID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_libraryID_libraries_libraryID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_items_libraryID_libraries_libraryID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_libraries_libraryID_items_libraryID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemSeeAlso_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemSeeAlso_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemSeeAlso_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemSeeAlso_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemSeeAlso_linkedItemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemSeeAlso_linkedItemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemSeeAlso_linkedItemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemSeeAlso_linkedItemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemTags_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemTags_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemTags_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_items_itemID_itemTags_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemTags_tagID_tags_tagID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemTags_tagID_tags_tagID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemTags_tagID_tags_tagID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_tags_tagID_itemTags_tagID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_savedSearchConditions_savedSearchID_savedSearches_savedSearchID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_savedSearchConditions_savedSearchID_savedSearches_savedSearchID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_savedSearchConditions_savedSearchID_savedSearches_savedSearchID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_savedSearches_savedSearchID_savedSearchConditions_savedSearchID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_deletedItems_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_deletedItems_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_deletedItems_itemID_items_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_deletedItems_itemID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_syncObjectTypes_syncObjectTypeID_syncDeleteLog_syncObjectTypeID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_proxyHosts_proxyID_proxies_proxyID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_proxyHosts_proxyID_proxies_proxyID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_proxyHosts_proxyID_proxies_proxyID");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_proxies_proxyID_proxyHosts_proxyID");
				
				await Zotero.DB.queryAsync("ALTER TABLE collections RENAME TO collectionsOld");
				await Zotero.DB.queryAsync("CREATE TABLE collections (\n    collectionID INTEGER PRIMARY KEY,\n    collectionName TEXT NOT NULL,\n    parentCollectionID INT DEFAULT NULL,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    UNIQUE (libraryID, key),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE,\n    FOREIGN KEY (parentCollectionID) REFERENCES collections(collectionID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO collections SELECT collectionID, collectionName, parentCollectionID, clientDateModified, IFNULL(libraryID, 1), key, 0, 0 FROM collectionsOld ORDER BY collectionID DESC");
				await Zotero.DB.queryAsync("CREATE INDEX collections_synced ON collections(synced)");
				
				await Zotero.DB.queryAsync("ALTER TABLE items RENAME TO itemsOld");
				await Zotero.DB.queryAsync("CREATE TABLE items (\n    itemID INTEGER PRIMARY KEY,\n    itemTypeID INT NOT NULL,\n    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    UNIQUE (libraryID, key),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO items SELECT itemID, itemTypeID, dateAdded, dateModified, clientDateModified, IFNULL(libraryID, 1), key, 0, 0 FROM itemsOld ORDER BY dateAdded DESC");
				await Zotero.DB.queryAsync("CREATE INDEX items_synced ON items(synced)");
				
				let rows = await Zotero.DB.queryAsync("SELECT firstName, lastName, fieldMode, COUNT(*) FROM creatorData GROUP BY firstName, lastName, fieldMode HAVING COUNT(*) > 1");
				for (let row of rows) {
					let ids = await Zotero.DB.columnQueryAsync("SELECT creatorDataID FROM creatorData WHERE firstName=? AND lastName=? AND fieldMode=?", [row.firstName, row.lastName, row.fieldMode]);
					await Zotero.DB.queryAsync("UPDATE creators SET creatorDataID=" + ids[0] + " WHERE creatorDataID IN (" + ids.slice(1).join(", ") + ")");
				}
				await Zotero.DB.queryAsync("DELETE FROM creatorData WHERE creatorDataID NOT IN (SELECT creatorDataID FROM creators)");
				await Zotero.DB.queryAsync("ALTER TABLE creators RENAME TO creatorsOld");
				await Zotero.DB.queryAsync("CREATE TABLE creators (\n    creatorID INTEGER PRIMARY KEY,\n    firstName TEXT,\n    lastName TEXT,\n    fieldMode INT,\n    UNIQUE (lastName, firstName, fieldMode)\n)");
				await Zotero.DB.queryAsync("INSERT INTO creators SELECT creatorDataID, firstName, lastName, fieldMode FROM creatorData");
				await Zotero.DB.queryAsync("ALTER TABLE itemCreators RENAME TO itemCreatorsOld");
				await Zotero.DB.queryAsync("CREATE TABLE itemCreators (\n    itemID INT NOT NULL,\n    creatorID INT NOT NULL,\n    creatorTypeID INT NOT NULL DEFAULT 1,\n    orderIndex INT NOT NULL DEFAULT 0,\n    PRIMARY KEY (itemID, creatorID, creatorTypeID, orderIndex),\n    UNIQUE (itemID, orderIndex),\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (creatorID) REFERENCES creators(creatorID) ON DELETE CASCADE,\n    FOREIGN KEY (creatorTypeID) REFERENCES creatorTypes(creatorTypeID)\n)");
				await Zotero.DB.queryAsync("CREATE INDEX itemCreators_creatorTypeID ON itemCreators(creatorTypeID)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemCreators SELECT itemID, C.creatorID, creatorTypeID, orderIndex FROM itemCreatorsOld ICO JOIN creatorsOld CO USING (creatorID) JOIN creators C ON (CO.creatorDataID=C.creatorID)");
				
				await Zotero.DB.queryAsync("ALTER TABLE savedSearches RENAME TO savedSearchesOld");
				await Zotero.DB.queryAsync("CREATE TABLE savedSearches (\n    savedSearchID INTEGER PRIMARY KEY,\n    savedSearchName TEXT NOT NULL,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    UNIQUE (libraryID, key),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO savedSearches SELECT savedSearchID, savedSearchName, clientDateModified, IFNULL(libraryID, 1), key, 0, 0 FROM savedSearchesOld ORDER BY savedSearchID DESC");
				await Zotero.DB.queryAsync("CREATE INDEX savedSearches_synced ON savedSearches(synced)");
				
				await Zotero.DB.queryAsync("ALTER TABLE tags RENAME TO tagsOld");
				await Zotero.DB.queryAsync("CREATE TABLE tags (\n    tagID INTEGER PRIMARY KEY,\n    name TEXT NOT NULL UNIQUE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO tags SELECT tagID, name FROM tagsOld");
				await Zotero.DB.queryAsync("ALTER TABLE itemTags RENAME TO itemTagsOld");
				await Zotero.DB.queryAsync("CREATE TABLE itemTags (\n    itemID INT NOT NULL,\n    tagID INT NOT NULL,\n    type INT NOT NULL,\n    PRIMARY KEY (itemID, tagID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (tagID) REFERENCES tags(tagID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemTags SELECT itemID, T.tagID, TOld.type FROM itemTagsOld ITO JOIN tagsOld TOld USING (tagID) JOIN tags T ON (TOld.name=T.name COLLATE BINARY)");
				await Zotero.DB.queryAsync("DROP INDEX IF EXISTS itemTags_tagID");
				await Zotero.DB.queryAsync("CREATE INDEX itemTags_tagID ON itemTags(tagID)");
				
				await Zotero.DB.queryAsync("CREATE TABLE IF NOT EXISTS syncedSettings (\n    setting TEXT NOT NULL,\n    libraryID INT NOT NULL,\n    value NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    PRIMARY KEY (setting, libraryID)\n)");
				await Zotero.DB.queryAsync("ALTER TABLE syncedSettings RENAME TO syncedSettingsOld");
				await Zotero.DB.queryAsync("CREATE TABLE syncedSettings (\n    setting TEXT NOT NULL,\n    libraryID INT NOT NULL,\n    value NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    PRIMARY KEY (setting, libraryID),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("UPDATE syncedSettingsOld SET libraryID=1 WHERE libraryID=0");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO syncedSettings SELECT * FROM syncedSettingsOld");
				
				await Zotero.DB.queryAsync("ALTER TABLE itemData RENAME TO itemDataOld");
				await Zotero.DB.queryAsync("CREATE TABLE itemData (\n    itemID INT,\n    fieldID INT,\n    valueID,\n    PRIMARY KEY (itemID, fieldID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (fieldID) REFERENCES fieldsCombined(fieldID),\n    FOREIGN KEY (valueID) REFERENCES itemDataValues(valueID)\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemData SELECT * FROM itemDataOld");
				await Zotero.DB.queryAsync("DROP INDEX IF EXISTS itemData_fieldID");
				await Zotero.DB.queryAsync("CREATE INDEX itemData_fieldID ON itemData(fieldID)");
				
				await Zotero.DB.queryAsync("ALTER TABLE itemNotes RENAME TO itemNotesOld");
				await Zotero.DB.queryAsync("CREATE TABLE itemNotes (\n    itemID INTEGER PRIMARY KEY,\n    parentItemID INT,\n    note TEXT,\n    title TEXT,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (parentItemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemNotes SELECT * FROM itemNotesOld");
				await Zotero.DB.queryAsync("CREATE INDEX itemNotes_parentItemID ON itemNotes(parentItemID)");
				
				await Zotero.DB.queryAsync("CREATE TEMPORARY TABLE charsetsOld (charsetID INT, charset UNIQUE, canonical, PRIMARY KEY (charsetID))");
				await Zotero.DB.queryAsync("INSERT INTO charsetsOld VALUES (1,'utf-8','utf-8'), (2,'ascii','windows-1252'), (3,'windows-1250','windows-1250'), (4,'windows-1251','windows-1251'), (5,'windows-1252','windows-1252'), (6,'windows-1253','windows-1253'), (7,'windows-1254','windows-1254'), (8,'windows-1257','windows-1257'), (9,'us',NULL), (10,'us-ascii','windows-1252'), (11,'utf-7',NULL), (12,'iso8859-1','windows-1252'), (13,'iso8859-15','iso-8859-15'), (14,'iso_646.irv:1991',NULL), (15,'iso_8859-1','windows-1252'), (16,'iso_8859-1:1987','windows-1252'), (17,'iso_8859-2','iso-8859-2'), (18,'iso_8859-2:1987','iso-8859-2'), (19,'iso_8859-4','iso-8859-4'), (20,'iso_8859-4:1988','iso-8859-4'), (21,'iso_8859-5','iso-8859-5'), (22,'iso_8859-5:1988','iso-8859-5'), (23,'iso_8859-7','iso-8859-7'), (24,'iso_8859-7:1987','iso-8859-7'), (25,'iso-8859-1','windows-1252'), (26,'iso-8859-1-windows-3.0-latin-1',NULL), (27,'iso-8859-1-windows-3.1-latin-1',NULL), (28,'iso-8859-15','iso-8859-15'), (29,'iso-8859-2','iso-8859-2'), (30,'iso-8859-2-windows-latin-2',NULL), (31,'iso-8859-3','iso-8859-3'), (32,'iso-8859-4','iso-8859-4'), (33,'iso-8859-5','iso-8859-5'), (34,'iso-8859-5-windows-latin-5',NULL), (35,'iso-8859-6','iso-8859-6'), (36,'iso-8859-7','iso-8859-7'), (37,'iso-8859-8','iso-8859-8'), (38,'iso-8859-9','windows-1254'), (39,'l1','windows-1252'), (40,'l2','iso-8859-2'), (41,'l4','iso-8859-4'), (42,'latin1','windows-1252'), (43,'latin2','iso-8859-2'), (44,'latin4','iso-8859-4'), (45,'x-mac-ce',NULL), (46,'x-mac-cyrillic','x-mac-cyrillic'), (47,'x-mac-greek',NULL), (48,'x-mac-roman','macintosh'), (49,'x-mac-turkish',NULL), (50,'adobe-symbol-encoding',NULL), (51,'ansi_x3.4-1968','windows-1252'), (52,'ansi_x3.4-1986',NULL), (53,'big5','big5'), (54,'chinese','gbk'), (55,'cn-big5','big5'), (56,'cn-gb',NULL), (57,'cn-gb-isoir165',NULL), (58,'cp367',NULL), (59,'cp819','windows-1252'), (60,'cp850',NULL), (61,'cp852',NULL), (62,'cp855',NULL), (63,'cp857',NULL), (64,'cp862',NULL), (65,'cp864',NULL), (66,'cp866','ibm866'), (67,'csascii',NULL), (68,'csbig5','big5'), (69,'cseuckr','euc-kr'), (70,'cseucpkdfmtjapanese','euc-jp'), (71,'csgb2312','gbk'), (72,'cshalfwidthkatakana',NULL), (73,'cshppsmath',NULL), (74,'csiso103t618bit',NULL), (75,'csiso159jisx02121990',NULL), (76,'csiso2022jp','iso-2022-jp'), (77,'csiso2022jp2',NULL), (78,'csiso2022kr','replacement'), (79,'csiso58gb231280','gbk'), (80,'csisolatin4','iso-8859-4'), (81,'csisolatincyrillic','iso-8859-5'), (82,'csisolatingreek','iso-8859-7'), (83,'cskoi8r','koi8-r'), (84,'csksc56011987','euc-kr'), (85,'csshiftjis','shift_jis'), (86,'csunicode11',NULL), (87,'csunicode11utf7',NULL), (88,'csunicodeascii',NULL), (89,'csunicodelatin1',NULL), (90,'cswindows31latin5',NULL), (91,'cyrillic','iso-8859-5'), (92,'ecma-118','iso-8859-7'), (93,'elot_928','iso-8859-7'), (94,'euc-jp','euc-jp'), (95,'euc-kr','euc-kr'), (96,'extended_unix_code_packed_format_for_japanese',NULL), (97,'gb2312','gbk'), (98,'gb_2312-80','gbk'), (99,'greek','iso-8859-7'), (100,'greek8','iso-8859-7'), (101,'hz-gb-2312','replacement'), (102,'ibm367',NULL), (103,'ibm819','windows-1252'), (104,'ibm850',NULL), (105,'ibm852',NULL), (106,'ibm855',NULL), (107,'ibm857',NULL), (108,'ibm862',NULL), (109,'ibm864',NULL), (110,'ibm866','ibm866'), (111,'iso-10646',NULL), (112,'iso-10646-j-1',NULL), (113,'iso-10646-ucs-2',NULL), (114,'iso-10646-ucs-4',NULL), (115,'iso-10646-ucs-basic',NULL), (116,'iso-10646-unicode-latin1',NULL), (117,'iso-2022-jp','iso-2022-jp'), (118,'iso-2022-jp-2',NULL), (119,'iso-2022-kr','replacement'), (120,'iso-ir-100','windows-1252'), (121,'iso-ir-101','iso-8859-2'), (122,'iso-ir-103',NULL), (123,'iso-ir-110','iso-8859-4'), (124,'iso-ir-126','iso-8859-7'), (125,'iso-ir-144','iso-8859-5'), (126,'iso-ir-149','euc-kr'), (127,'iso-ir-159',NULL), (128,'iso-ir-58','gbk'), (129,'iso-ir-6',NULL), (130,'iso646-us',NULL), (131,'jis_x0201',NULL), (132,'jis_x0208-1983',NULL), (133,'jis_x0212-1990',NULL), (134,'koi8-r','koi8-r'), (135,'korean','euc-kr'), (136,'ks_c_5601',NULL), (137,'ks_c_5601-1987','euc-kr'), (138,'ks_c_5601-1989','euc-kr'), (139,'ksc5601','euc-kr'), (140,'ksc_5601','euc-kr'), (141,'ms_kanji','shift_jis'), (142,'shift_jis','shift_jis'), (143,'t.61',NULL), (144,'t.61-8bit',NULL), (145,'unicode-1-1-utf-7',NULL), (146,'unicode-1-1-utf-8','utf-8'), (147,'unicode-2-0-utf-7',NULL), (148,'windows-31j','shift_jis'), (149,'x-cns11643-1',NULL), (150,'x-cns11643-1110',NULL), (151,'x-cns11643-2',NULL), (152,'x-cp1250','windows-1250'), (153,'x-cp1251','windows-1251'), (154,'x-cp1253','windows-1253'), (155,'x-dectech',NULL), (156,'x-dingbats',NULL), (157,'x-euc-jp','euc-jp'), (158,'x-euc-tw',NULL), (159,'x-gb2312-11',NULL), (160,'x-imap4-modified-utf7',NULL), (161,'x-jisx0208-11',NULL), (162,'x-ksc5601-11',NULL), (163,'x-sjis','shift_jis'), (164,'x-tis620',NULL), (165,'x-unicode-2-0-utf-7',NULL), (166,'x-x-big5','big5'), (167,'x0201',NULL), (168,'x0212',NULL)");
				await Zotero.DB.queryAsync("CREATE INDEX charsetsOld_canonical ON charsetsOld(canonical)");
				
				await Zotero.DB.queryAsync("ALTER TABLE itemAttachments RENAME TO itemAttachmentsOld");
				await Zotero.DB.queryAsync("CREATE TABLE itemAttachments (\n    itemID INTEGER PRIMARY KEY,\n    parentItemID INT,\n    linkMode INT,\n    contentType TEXT,\n    charsetID INT,\n    path TEXT,\n    syncState INT DEFAULT 0,\n    storageModTime INT,\n    storageHash TEXT,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (parentItemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (charsetID) REFERENCES charsets(charsetID) ON DELETE SET NULL\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemAttachments SELECT itemID, sourceItemID, linkMode, mimeType, C.charsetID, path, syncState, storageModTime, storageHash FROM itemAttachmentsOld IA LEFT JOIN charsetsOld CO ON (IA.charsetID=CO.charsetID) LEFT JOIN charsets C ON (CO.canonical=C.charset)");
				await Zotero.DB.queryAsync("CREATE INDEX itemAttachments_parentItemID ON itemAttachments(parentItemID)");
				await Zotero.DB.queryAsync("CREATE INDEX itemAttachments_charsetID ON itemAttachments(charsetID)");
				await Zotero.DB.queryAsync("CREATE INDEX itemAttachments_contentType ON itemAttachments(contentType)");
				await Zotero.DB.queryAsync("DROP INDEX IF EXISTS itemAttachments_syncState");
				await Zotero.DB.queryAsync("CREATE INDEX itemAttachments_syncState ON itemAttachments(syncState)");
				
				await _migrateUserData_80_filePaths();
				
				await Zotero.DB.queryAsync("ALTER TABLE collectionItems RENAME TO collectionItemsOld");
				await Zotero.DB.queryAsync("CREATE TABLE collectionItems (\n    collectionID INT NOT NULL,\n    itemID INT NOT NULL,\n    orderIndex INT NOT NULL DEFAULT 0,\n    PRIMARY KEY (collectionID, itemID),\n    FOREIGN KEY (collectionID) REFERENCES collections(collectionID) ON DELETE CASCADE,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO collectionItems SELECT * FROM collectionItemsOld");
				await Zotero.DB.queryAsync("DROP INDEX IF EXISTS itemID"); // incorrect old name
				await Zotero.DB.queryAsync("CREATE INDEX collectionItems_itemID ON collectionItems(itemID)");
				
				await Zotero.DB.queryAsync("ALTER TABLE savedSearchConditions RENAME TO savedSearchConditionsOld");
				await Zotero.DB.queryAsync("CREATE TABLE savedSearchConditions (\n    savedSearchID INT NOT NULL,\n    searchConditionID INT NOT NULL,\n    condition TEXT NOT NULL,\n    operator TEXT,\n    value TEXT,\n    required NONE,\n    PRIMARY KEY (savedSearchID, searchConditionID),\n    FOREIGN KEY (savedSearchID) REFERENCES savedSearches(savedSearchID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO savedSearchConditions SELECT * FROM savedSearchConditionsOld");
				await Zotero.DB.queryAsync("DROP TABLE savedSearchConditionsOld");
				
				await Zotero.DB.queryAsync("ALTER TABLE deletedItems RENAME TO deletedItemsOld");
				await Zotero.DB.queryAsync("CREATE TABLE deletedItems (\n    itemID INTEGER PRIMARY KEY,\n    dateDeleted DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO deletedItems SELECT * FROM deletedItemsOld");
				await Zotero.DB.queryAsync("DROP INDEX IF EXISTS deletedItems_dateDeleted");
				await Zotero.DB.queryAsync("CREATE INDEX deletedItems_dateDeleted ON deletedItems(dateDeleted)");
				
				await _migrateUserData_80_relations();
				
				await Zotero.DB.queryAsync("ALTER TABLE groups RENAME TO groupsOld");
				await Zotero.DB.queryAsync("CREATE TABLE groups (\n    groupID INTEGER PRIMARY KEY,\n    libraryID INT NOT NULL UNIQUE,\n    name TEXT NOT NULL,\n    description TEXT NOT NULL,\n    version INT NOT NULL,\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO groups SELECT groupID, libraryID, name, description, 0 FROM groupsOld");
				
				await Zotero.DB.queryAsync("ALTER TABLE groupItems RENAME TO groupItemsOld");
				await Zotero.DB.queryAsync("CREATE TABLE groupItems (\n    itemID INTEGER PRIMARY KEY,\n    createdByUserID INT,\n    lastModifiedByUserID INT,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (createdByUserID) REFERENCES users(userID) ON DELETE SET NULL,\n    FOREIGN KEY (lastModifiedByUserID) REFERENCES users(userID) ON DELETE SET NULL\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO groupItems SELECT * FROM groupItemsOld");
				
				let cols = await Zotero.DB.getColumns('fulltextItems');
				if (cols.indexOf("synced") == -1) {
					Zotero.DB.queryAsync("ALTER TABLE fulltextItems ADD COLUMN synced INT DEFAULT 0");
				}
				await Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='fulltext'");
				await Zotero.DB.queryAsync("ALTER TABLE fulltextItems RENAME TO fulltextItemsOld");
				await Zotero.DB.queryAsync("CREATE TABLE fulltextItems (\n    itemID INTEGER PRIMARY KEY,\n    indexedPages INT,\n    totalPages INT,\n    indexedChars INT,\n    totalChars INT,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO fulltextItems SELECT itemID, indexedPages, totalPages, indexedChars, totalChars, version, synced FROM fulltextItemsOld");
				await Zotero.DB.queryAsync("DROP INDEX IF EXISTS fulltextItems_version");
				await Zotero.DB.queryAsync("CREATE INDEX fulltextItems_synced ON fulltextItems(synced)");
				await Zotero.DB.queryAsync("CREATE INDEX fulltextItems_version ON fulltextItems(version)");
				
				await Zotero.DB.queryAsync("ALTER TABLE fulltextItemWords RENAME TO fulltextItemWordsOld");
				await Zotero.DB.queryAsync("CREATE TABLE fulltextItemWords (\n    wordID INT,\n    itemID INT,\n    PRIMARY KEY (wordID, itemID),\n    FOREIGN KEY (wordID) REFERENCES fulltextWords(wordID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO fulltextItemWords SELECT * FROM fulltextItemWordsOld");
				await Zotero.DB.queryAsync("DROP INDEX IF EXISTS fulltextItemWords_itemID");
				await Zotero.DB.queryAsync("CREATE INDEX fulltextItemWords_itemID ON fulltextItemWords(itemID)");
				
				await Zotero.DB.queryAsync("UPDATE syncDeleteLog SET libraryID=1 WHERE libraryID=0");
				await Zotero.DB.queryAsync("ALTER TABLE syncDeleteLog RENAME TO syncDeleteLogOld");
				await Zotero.DB.queryAsync("CREATE TABLE syncDeleteLog (\n    syncObjectTypeID INT NOT NULL,\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    dateDeleted TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    UNIQUE (syncObjectTypeID, libraryID, key),\n    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO syncDeleteLog SELECT syncObjectTypeID, libraryID, key, timestamp FROM syncDeleteLogOld");
				await Zotero.DB.queryAsync("DROP INDEX IF EXISTS syncDeleteLog_timestamp");
				// TODO: Something special for tag deletions?
				//await Zotero.DB.queryAsync("DELETE FROM syncDeleteLog WHERE syncObjectTypeID IN (2, 5, 6)");
				//await Zotero.DB.queryAsync("DELETE FROM syncObjectTypes WHERE syncObjectTypeID IN (2, 5, 6)");
				
				await Zotero.DB.queryAsync("UPDATE storageDeleteLog SET libraryID=1 WHERE libraryID=0");
				await Zotero.DB.queryAsync("ALTER TABLE storageDeleteLog RENAME TO storageDeleteLogOld");
				await Zotero.DB.queryAsync("CREATE TABLE storageDeleteLog (\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    dateDeleted TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    PRIMARY KEY (libraryID, key),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO storageDeleteLog SELECT libraryID, key, timestamp FROM storageDeleteLogOld");
				await Zotero.DB.queryAsync("DROP INDEX IF EXISTS storageDeleteLog_timestamp");
				
				await Zotero.DB.queryAsync("ALTER TABLE annotations RENAME TO annotationsOld");
				await Zotero.DB.queryAsync("CREATE TABLE annotations (\n    annotationID INTEGER PRIMARY KEY,\n    itemID INT NOT NULL,\n    parent TEXT,\n    textNode INT,\n    offset INT,\n    x INT,\n    y INT,\n    cols INT,\n    rows INT,\n    text TEXT,\n    collapsed BOOL,\n    dateModified DATE,\n    FOREIGN KEY (itemID) REFERENCES itemAttachments(itemID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO annotations SELECT * FROM annotationsOld");
				await Zotero.DB.queryAsync("DROP INDEX IF EXISTS annotations_itemID");
				await Zotero.DB.queryAsync("CREATE INDEX annotations_itemID ON annotations(itemID)");
				
				await Zotero.DB.queryAsync("ALTER TABLE highlights RENAME TO highlightsOld");
				await Zotero.DB.queryAsync("CREATE TABLE highlights (\n    highlightID INTEGER PRIMARY KEY,\n    itemID INT NOT NULL,\n    startParent TEXT,\n    startTextNode INT,\n    startOffset INT,\n    endParent TEXT,\n    endTextNode INT,\n    endOffset INT,\n    dateModified DATE,\n    FOREIGN KEY (itemID) REFERENCES itemAttachments(itemID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO highlights SELECT * FROM highlightsOld");
				await Zotero.DB.queryAsync("DROP INDEX IF EXISTS highlights_itemID");
				await Zotero.DB.queryAsync("CREATE INDEX highlights_itemID ON highlights(itemID)");
				
				await Zotero.DB.queryAsync("ALTER TABLE customBaseFieldMappings RENAME TO customBaseFieldMappingsOld");
				await Zotero.DB.queryAsync("CREATE TABLE customBaseFieldMappings (\n    customItemTypeID INT,\n    baseFieldID INT,\n    customFieldID INT,\n    PRIMARY KEY (customItemTypeID, baseFieldID, customFieldID),\n    FOREIGN KEY (customItemTypeID) REFERENCES customItemTypes(customItemTypeID),\n    FOREIGN KEY (baseFieldID) REFERENCES fields(fieldID),\n    FOREIGN KEY (customFieldID) REFERENCES customFields(customFieldID)\n)");
				await Zotero.DB.queryAsync("INSERT OR IGNORE INTO customBaseFieldMappings SELECT * FROM customBaseFieldMappingsOld");
				await Zotero.DB.queryAsync("DROP INDEX IF EXISTS customBaseFieldMappings_baseFieldID");
				await Zotero.DB.queryAsync("DROP INDEX IF EXISTS customBaseFieldMappings_customFieldID");
				await Zotero.DB.queryAsync("CREATE INDEX customBaseFieldMappings_baseFieldID ON customBaseFieldMappings(baseFieldID)");
				await Zotero.DB.queryAsync("CREATE INDEX customBaseFieldMappings_customFieldID ON customBaseFieldMappings(customFieldID)");
				
				await Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='account' AND key='libraryID'");
				
				await Zotero.DB.queryAsync("DROP TABLE annotationsOld");
				await Zotero.DB.queryAsync("DROP TABLE collectionItemsOld");
				await Zotero.DB.queryAsync("DROP TABLE charsetsOld");
				await Zotero.DB.queryAsync("DROP TABLE customBaseFieldMappingsOld");
				await Zotero.DB.queryAsync("DROP TABLE deletedItemsOld");
				await Zotero.DB.queryAsync("DROP TABLE fulltextItemWordsOld");
				await Zotero.DB.queryAsync("DROP TABLE fulltextItemsOld");
				await Zotero.DB.queryAsync("DROP TABLE groupItemsOld");
				await Zotero.DB.queryAsync("DROP TABLE groupsOld");
				await Zotero.DB.queryAsync("DROP TABLE highlightsOld");
				await Zotero.DB.queryAsync("DROP TABLE itemAttachmentsOld");
				await Zotero.DB.queryAsync("DROP TABLE itemCreatorsOld");
				await Zotero.DB.queryAsync("DROP TABLE itemDataOld");
				await Zotero.DB.queryAsync("DROP TABLE itemNotesOld");
				await Zotero.DB.queryAsync("DROP TABLE itemTagsOld");
				await Zotero.DB.queryAsync("DROP TABLE savedSearchesOld");
				await Zotero.DB.queryAsync("DROP TABLE storageDeleteLogOld");
				await Zotero.DB.queryAsync("DROP TABLE syncDeleteLogOld");
				await Zotero.DB.queryAsync("DROP TABLE syncedSettingsOld");
				await Zotero.DB.queryAsync("DROP TABLE collectionsOld");
				await Zotero.DB.queryAsync("DROP TABLE creatorsOld");
				await Zotero.DB.queryAsync("DROP TABLE creatorData");
				await Zotero.DB.queryAsync("DROP TABLE itemsOld");
				await Zotero.DB.queryAsync("DROP TABLE tagsOld");
				await Zotero.DB.queryAsync("DROP TABLE librariesOld");
				
			}
			
			else if (i == 81) {
				await _updateCompatibility(2);
				
				await Zotero.DB.queryAsync("ALTER TABLE libraries RENAME TO librariesOld");
				await Zotero.DB.queryAsync("CREATE TABLE libraries (\n    libraryID INTEGER PRIMARY KEY,\n    type TEXT NOT NULL,\n    editable INT NOT NULL,\n    filesEditable INT NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    storageVersion INT NOT NULL DEFAULT 0,\n    lastSync INT NOT NULL DEFAULT 0\n)");
				await Zotero.DB.queryAsync("INSERT INTO libraries SELECT libraryID, type, editable, filesEditable, version, 0, lastSync FROM librariesOld");
				await Zotero.DB.queryAsync("DROP TABLE librariesOld");
				
				await Zotero.DB.queryAsync("DELETE FROM version WHERE schema LIKE ?", "storage_%");
			}
			
			else if (i == 82) {
				await Zotero.DB.queryAsync("DELETE FROM itemTypeFields WHERE itemTypeID=17 AND orderIndex BETWEEN 3 AND 9");
				await Zotero.DB.queryAsync("INSERT INTO itemTypeFields VALUES (17, 44, NULL, 3)");
				await Zotero.DB.queryAsync("INSERT INTO itemTypeFields VALUES (17, 96, NULL, 4)");
				await Zotero.DB.queryAsync("INSERT INTO itemTypeFields VALUES (17, 117, NULL, 5)");
				await Zotero.DB.queryAsync("INSERT INTO itemTypeFields VALUES (17, 43, NULL, 6)");
				await Zotero.DB.queryAsync("INSERT INTO itemTypeFields VALUES (17, 97, NULL, 7)");
				await Zotero.DB.queryAsync("INSERT INTO itemTypeFields VALUES (17, 98, NULL, 8)");
				await Zotero.DB.queryAsync("INSERT INTO itemTypeFields VALUES (17, 42, NULL, 9)");
			}
			
			else if (i == 83) {
				// Feeds
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS feeds");
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS feedItems");
				await Zotero.DB.queryAsync("CREATE TABLE feeds (\n    libraryID INTEGER PRIMARY KEY,\n    name TEXT NOT NULL,\n    url TEXT NOT NULL UNIQUE,\n    lastUpdate TIMESTAMP,\n    lastCheck TIMESTAMP,\n    lastCheckError TEXT,\n    cleanupAfter INT,\n    refreshInterval INT,\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("CREATE TABLE feedItems (\n    itemID INTEGER PRIMARY KEY,\n    guid TEXT NOT NULL UNIQUE,\n    readTime TIMESTAMP,\n    translatedTime TIMESTAMP,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
			}
			
			else if (i == 84) {
				await Zotero.DB.queryAsync("CREATE TABLE syncQueue (\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    syncObjectTypeID INT NOT NULL,\n    lastCheck TIMESTAMP,\n    tries INT,\n    PRIMARY KEY (libraryID, key, syncObjectTypeID),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE,\n    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID) ON DELETE CASCADE\n)");
			}
			
			else if (i == 85) {
				await Zotero.DB.queryAsync("DELETE FROM version WHERE schema IN ('sync', 'syncdeletelog')");
			}
			
			else if (i == 86) {
				let rows = await Zotero.DB.queryAsync("SELECT ROWID AS id, * FROM itemRelations WHERE SUBSTR(object, 1, 18)='http://zotero.org/' AND NOT INSTR(object, 'item')");
				for (let i = 0; i < rows.length; i++) {
					// http://zotero.org/users/local/aFeGasdGSdH/8QZ36WQ3 -> http://zotero.org/users/local/aFeGasdGSdH/items/8QZ36WQ3
					// http://zotero.org/users/12341/8QZ36WQ3 -> http://zotero.org/users/12341/items/8QZ36WQ3
					// http://zotero.org/groups/12341/8QZ36WQ3 -> http://zotero.org/groups/12341/items/8QZ36WQ3
					let newObject = rows[i].object.replace(/^(http:\/\/zotero.org\/(?:(?:users|groups)\/\d+|users\/local\/[^\/]+))\/([A-Z0-9]{8})$/, '$1/items/$2');
					await Zotero.DB.queryAsync("UPDATE itemRelations SET object=? WHERE ROWID=?", [newObject, rows[i].id]);
				}
			}
			
			else if (i == 87) {
				await _updateCompatibility(3);
				let rows = await Zotero.DB.queryAsync("SELECT valueID, value FROM itemDataValues WHERE TYPEOF(value) = 'integer'");
				for (let i = 0; i < rows.length; i++) {
					let row = rows[i];
					let valueID = await Zotero.DB.valueQueryAsync("SELECT valueID FROM itemDataValues WHERE value=?", "" + row.value);
					if (valueID) {
						await Zotero.DB.queryAsync("UPDATE itemData SET valueID=? WHERE valueID=?", [valueID, row.valueID]);
						await Zotero.DB.queryAsync("DELETE FROM itemDataValues WHERE valueID=?", row.valueID);
					}
					else {
						await Zotero.DB.queryAsync("UPDATE itemDataValues SET value=? WHERE valueID=?", ["" + row.value, row.valueID]);
					}
				}
			}
			
			else if (i == 89) {
				let groupLibraryMap = {};
				let libraryGroupMap = {};
				let resolveLibrary = async function (usersOrGroups, id) {
					if (usersOrGroups == 'users') return 1;
					if (groupLibraryMap[id] !== undefined) return groupLibraryMap[id];
					return groupLibraryMap[id] = (await Zotero.DB.valueQueryAsync("SELECT libraryID FROM groups WHERE groupID=?", id));
				};
				let resolveGroup = async function (id) {
					if (libraryGroupMap[id] !== undefined) return libraryGroupMap[id];
					return libraryGroupMap[id] = (await Zotero.DB.valueQueryAsync("SELECT groupID FROM groups WHERE libraryID=?", id));
				};
				
				let userSegment = await Zotero.DB.valueQueryAsync("SELECT IFNULL((SELECT value FROM settings WHERE setting='account' AND key='userID'), 'local/' || (SELECT value FROM settings WHERE setting='account' AND key='localUserKey'))");
				
				let predicateID = await Zotero.DB.valueQueryAsync("SELECT predicateID FROM relationPredicates WHERE predicate='dc:relation'");
				if (!predicateID) continue;
				let rows = await Zotero.DB.queryAsync("SELECT ROWID AS id, * FROM itemRelations WHERE predicateID=?", predicateID);
				for (let i = 0; i < rows.length; i++) {
					let row = rows[i];
					let newSubjectlibraryID, newSubjectKey, newObjectKey;
					
					let object = row.object;
					if (!object.startsWith('http://zotero.org/')) continue;
					object = object.substr(18);
					let newObjectURI = 'http://zotero.org/';
					
					// Fix missing 'local' from 80
					let matches = object.match(/^users\/([a-zA-Z0-9]{8})\/items\/([A-Z0-9]{8})$/);
					// http://zotero.org/users/aFeGasdG/items/8QZ36WQ3 -> http://zotero.org/users/local/aFeGasdG/items/8QZ36WQ3
					if (matches) {
						object = `users/local/${matches[1]}/items/${matches[2]}`;
						let uri = `http://zotero.org/users/local/${matches[1]}/items/${matches[2]}`;
						await Zotero.DB.queryAsync("UPDATE itemRelations SET object=? WHERE ROWID=?", [uri, row.id]);
					}
					
					// Add missing bidirectional from 80
					if (object.startsWith('users')) {
						matches = object.match(/^users\/(local\/\w+|\d+)\/items\/([A-Z0-9]{8})$/);
						if (!matches) continue;
						newSubjectlibraryID = 1;
						newSubjectKey = matches[2];
					}
					else if (object.startsWith('groups')) {
						matches = object.match(/^groups\/(\d+)\/items\/([A-Z0-9]{8})$/);
						if (!matches) continue;
						newSubjectlibraryID = await resolveLibrary('groups', matches[1]);
						newSubjectKey = matches[2];
					}
					else {
						continue;
					}
					let newSubjectID = await Zotero.DB.valueQueryAsync("SELECT itemID FROM items WHERE libraryID=? AND key=?", [newSubjectlibraryID, newSubjectKey]);
					if (!newSubjectID) continue;
					let { libraryID, key } = await Zotero.DB.rowQueryAsync("SELECT libraryID, key FROM items WHERE itemID=?", row.itemID);
					if (libraryID == 1) {
						newObjectURI += `users/${userSegment}/items/${key}`;
					}
					else {
						let groupID = await resolveGroup(libraryID);
						newObjectURI += `groups/${groupID}/items/${key}`;
					}
					await Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemRelations VALUES (?, ?, ?)", [newSubjectID, predicateID, newObjectURI]);
				}
			}
			
			else if (i == 90) {
				await _updateCompatibility(4);
				await Zotero.DB.queryAsync("ALTER TABLE feeds RENAME TO feedsOld");
				await Zotero.DB.queryAsync("CREATE TABLE feeds (\n    libraryID INTEGER PRIMARY KEY,\n    name TEXT NOT NULL,\n    url TEXT NOT NULL UNIQUE,\n    lastUpdate TIMESTAMP,\n    lastCheck TIMESTAMP,\n    lastCheckError TEXT,\n    cleanupReadAfter INT,\n    cleanupUnreadAfter INT,\n    refreshInterval INT,\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("INSERT INTO feeds SELECT libraryID, name, url, lastUpdate, lastCheck, lastCheckError, 30, cleanupAfter, refreshInterval FROM feedsOld");
				await Zotero.DB.queryAsync("DROP TABLE feedsOld");
			}
			
			else if (i == 91) {
				await Zotero.DB.queryAsync("ALTER TABLE libraries ADD COLUMN archived INT NOT NULL DEFAULT 0");
			}
			
			else if (i == 92) {
				let userID = await Zotero.DB.valueQueryAsync("SELECT value FROM settings WHERE setting='account' AND key='userID'");
				if (userID) {
					await Zotero.DB.queryAsync("UPDATE itemRelations SET object='http://zotero.org/users/' || ? || SUBSTR(object, 39) WHERE object LIKE ?", [userID, 'http://zotero.org/users/local/%']);
				}
			}
			
			else if (i == 93) {
				await _updateCompatibility(5);
				await Zotero.DB.queryAsync("CREATE TABLE publicationsItems (\n    itemID INTEGER PRIMARY KEY\n);");
				await Zotero.DB.queryAsync("INSERT INTO publicationsItems SELECT itemID FROM items WHERE libraryID=4");
				await Zotero.DB.queryAsync("UPDATE OR IGNORE items SET libraryID=1, synced=0 WHERE libraryID=4");
				await Zotero.DB.queryAsync("DELETE FROM itemRelations WHERE object LIKE ? AND object LIKE ?", ['http://zotero.org/users/%', '%/publications/items%']);
				await Zotero.DB.queryAsync("DELETE FROM libraries WHERE libraryID=4");
				
				let rows = await Zotero.DB.queryAsync("SELECT itemID, data FROM syncCache JOIN items USING (libraryID, key, version) WHERE syncObjectTypeID=3");
				let ids = [];
				for (let row of rows) {
					let json = JSON.parse(row.data);
					if (json.data && json.data.inPublications) {
						ids.push(row.itemID);
					}
				}
				if (ids.length) {
					await Zotero.DB.queryAsync("INSERT INTO publicationsItems (itemID) VALUES "
						+ ids.map(id => `(${id})`).join(', '));
				}
			}
			
			else if (i == 94) {
				let ids = await Zotero.DB.columnQueryAsync("SELECT itemID FROM publicationsItems WHERE itemID IN (SELECT itemID FROM items JOIN itemAttachments USING (itemID) WHERE linkMode=2)");
				for (let id of ids) {
					await Zotero.DB.queryAsync("UPDATE items SET synced=0, clientDateModified=CURRENT_TIMESTAMP WHERE itemID=?", id);
				}
				await Zotero.DB.queryAsync("DELETE FROM publicationsItems WHERE itemID IN (SELECT itemID FROM items JOIN itemAttachments USING (itemID) WHERE linkMode=2)");
			}
			
			else if (i == 95) {
				await Zotero.DB.queryAsync("DELETE FROM publicationsItems WHERE itemID NOT IN (SELECT itemID FROM items WHERE libraryID=1)");
			}
			
			else if (i == 96) {
				await Zotero.DB.queryAsync("REPLACE INTO fileTypeMIMETypes VALUES(7, 'application/vnd.ms-powerpoint')");
			}
			
			else if (i == 97) {
				let where = "WHERE predicate IN (" + Array.from(Array(20).keys()).map(i => `'${i}'`).join(', ') + ")";
				let rows = await Zotero.DB.queryAsync("SELECT * FROM relationPredicates " + where);
				for (let row of rows) {
					await Zotero.DB.columnQueryAsync("UPDATE items SET synced=0 WHERE itemID IN (SELECT itemID FROM itemRelations WHERE predicateID=?)", row.predicateID);
					await Zotero.DB.queryAsync("DELETE FROM itemRelations WHERE predicateID=?", row.predicateID);
				}
				await Zotero.DB.queryAsync("DELETE FROM relationPredicates " + where);
			}
			
			else if (i == 98) {
				await Zotero.DB.queryAsync("DELETE FROM itemRelations WHERE predicateID=(SELECT predicateID FROM relationPredicates WHERE predicate='owl:sameAs') AND object LIKE ?", 'http://www.archive.org/%');
			}
			
			else if (i == 99) {
				await Zotero.DB.queryAsync("DELETE FROM itemRelations WHERE predicateID=(SELECT predicateID FROM relationPredicates WHERE predicate='dc:isReplacedBy')");
				await Zotero.DB.queryAsync("DELETE FROM relationPredicates WHERE predicate='dc:isReplacedBy'");
			}
			
			else if (i == 100) {
				let userID = await Zotero.DB.valueQueryAsync("SELECT value FROM settings WHERE setting='account' AND key='userID'");
				let predicateID = await Zotero.DB.valueQueryAsync("SELECT predicateID FROM relationPredicates WHERE predicate='dc:relation'");
				if (userID && predicateID) {
					let rows = await Zotero.DB.queryAsync("SELECT itemID, object FROM items JOIN itemRelations IR USING (itemID) WHERE libraryID=? AND predicateID=?", [1, predicateID]);
					for (let row of rows) {
						let matches = row.object.match(/^http:\/\/zotero.org\/users\/(\d+)\/items\/([A-Z0-9]+)$/);
						if (matches) {
							// Wrong libraryID
							if (matches[1] != userID) {
								await Zotero.DB.queryAsync(`UPDATE OR REPLACE itemRelations SET object='http://zotero.org/users/${userID}/items/${matches[2]}' WHERE itemID=? AND predicateID=?`, [row.itemID, predicateID]);
							}
						}
					}
				}
			}
			
			else if (i == 101) {
				Components.utils.import("chrome://zotero/content/import/mendeley/mendeleyImport.js");
				let importer = new Zotero_Import_Mendeley();
				if (await importer.hasImportedFiles()) {
					await importer.queueFileCleanup();
				}
			}
			
			else if (i == 102) {
				let userID = await Zotero.DB.valueQueryAsync("SELECT value FROM settings WHERE setting='account' AND key='userID'");
				if (userID && typeof userID == 'string') {
					userID = userID.trim();
					if (userID) {
						await Zotero.DB.queryAsync("UPDATE settings SET value=? WHERE setting='account' AND key='userID'", parseInt(userID));
					}
				}
			}
			
			else if (i == 105) {
				// This was originally in 103 and then 104, but some schema update steps are being
				// missed for some people, so run again with IF NOT EXISTS until we figure out
				// what's going on.
				await Zotero.DB.queryAsync("CREATE TABLE IF NOT EXISTS retractedItems (\n	itemID INTEGER PRIMARY KEY,\n	data TEXT,\n	FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE\n);");
				
				try {
					await Zotero.DB.queryAsync("ALTER TABLE retractedItems ADD COLUMN flag INT DEFAULT 0");
				}
				catch (e) {}
			}
			
			else if (i == 106) {
				await _updateCompatibility(6);
				
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS insert_date_field");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS update_date_field");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemAttachments");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemAttachments");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemNotes");
				await Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemNotes");
				
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS transactionSets");
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS transactions");
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS transactionLog");
			}
			
			else if (i == 107) {
				if (!(await Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM itemTypes"))) {
					let sql = await _getSchemaSQL('system-107');
					await Zotero.DB.executeSQLFile(sql);
				}
			}
			
			else if (i == 108) {
				await Zotero.DB.queryAsync(`DELETE FROM itemRelations WHERE predicateID=(SELECT predicateID FROM relationPredicates WHERE predicate='owl:sameAs') AND object LIKE ?`, 'http://zotero.org/users/local/%');
			}
			
			else if (i == 109) {
				await Zotero.DB.queryAsync("CREATE TABLE IF NOT EXISTS dbDebug1 (\n    a INTEGER PRIMARY KEY\n)");
			}
			
			else if (i == 110) {
				await Zotero.DB.queryAsync("UPDATE itemAttachments SET parentItemID=NULL WHERE itemID=parentItemID");
				await Zotero.DB.queryAsync("UPDATE itemNotes SET parentItemID=NULL WHERE itemID=parentItemID");
			}
			
			else if (i == 111) {
				await Zotero.DB.queryAsync("CREATE TABLE deletedCollections (\n    collectionID INTEGER PRIMARY KEY,\n    dateDeleted DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    FOREIGN KEY (collectionID) REFERENCES collections(collectionID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("CREATE INDEX deletedCollections_dateDeleted ON deletedCollections(dateDeleted)");
				await Zotero.DB.queryAsync("CREATE TABLE deletedSearches (\n    savedSearchID INTEGER PRIMARY KEY,\n    dateDeleted DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    FOREIGN KEY (savedSearchID) REFERENCES savedSearches(savedSearchID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("CREATE INDEX deletedSearches_dateDeleted ON deletedSearches(dateDeleted)");
			}
			
			else if (i == 112) {
				await _updateCompatibility(7);
				
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS annotations");
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS highlights");
				
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS users");
				await Zotero.DB.queryAsync("CREATE TABLE users (\n    userID INTEGER PRIMARY KEY,\n    name TEXT NOT NULL\n)");
				
				await Zotero.DB.queryAsync("CREATE TABLE itemAnnotations (\n    itemID INTEGER PRIMARY KEY,\n    parentItemID INT NOT NULL,\n    type INTEGER NOT NULL,\n    text TEXT,\n    comment TEXT,\n    color TEXT,\n    pageLabel TEXT,\n    sortIndex TEXT NOT NULL,\n    position TEXT NOT NULL,\n    isExternal INT NOT NULL,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (parentItemID) REFERENCES itemAttachments(itemID) ON DELETE CASCADE\n)");
				await Zotero.DB.queryAsync("CREATE INDEX itemAnnotations_parentItemID ON itemAnnotations(parentItemID)");
				
				await Zotero.DB.queryAsync("ALTER TABLE itemAttachments ADD COLUMN lastProcessedModificationTime INT");
				await Zotero.DB.queryAsync("CREATE INDEX itemAttachments_lastProcessedModificationTime ON itemAttachments(lastProcessedModificationTime)");
			}
			
			else if (i == 113) {
				await Zotero.DB.queryAsync("ALTER TABLE itemAnnotations RENAME TO itemAnnotationsOld");
				await Zotero.DB.queryAsync("CREATE TABLE itemAnnotations (\n    itemID INTEGER PRIMARY KEY,\n    parentItemID INT NOT NULL,\n    type INTEGER NOT NULL,\n    text TEXT,\n    comment TEXT,\n    color TEXT,\n    pageLabel TEXT,\n    sortIndex TEXT NOT NULL,\n    position TEXT NOT NULL,\n    isExternal INT NOT NULL,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (parentItemID) REFERENCES itemAttachments(itemID)\n)");
				await Zotero.DB.queryAsync("INSERT INTO itemAnnotations SELECT * FROM itemAnnotationsOld");
				await Zotero.DB.queryAsync("DROP TABLE itemAnnotationsOld");
				await Zotero.DB.queryAsync("CREATE INDEX itemAnnotations_parentItemID ON itemAnnotations(parentItemID)");
				
				let annotationID = parseInt((await Zotero.DB.valueQueryAsync(
					"SELECT itemTypeID FROM itemTypes WHERE typeName='annotation'"
				)) || -1);
				let syncObjectTypeID = await Zotero.DB.valueQueryAsync("SELECT syncObjectTypeID FROM syncObjectTypes WHERE name='item'");
				let rows = await Zotero.DB.queryAsync("SELECT libraryID, key FROM items WHERE itemTypeID=? AND itemID NOT IN (SELECT itemID FROM itemAnnotations)", annotationID);
				for (let row of rows) {
					await Zotero.DB.queryAsync("REPLACE INTO syncDeleteLog (syncObjectTypeID, libraryID, key) VALUES (?, ?, ?)", [syncObjectTypeID, row.libraryID, row.key]);
				}
				await Zotero.DB.queryAsync("DELETE FROM items WHERE itemTypeID=? AND itemID NOT IN (SELECT itemID FROM itemAnnotations)", annotationID);
			}
			
			else if (i == 114) {
				await Zotero.DB.queryAsync("UPDATE itemAnnotations SET color='#ffff00' WHERE color='#ffff0'");
			}
			
			else if (i == 115) {
				await Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='quickCopySite' AND key=?", [""]);
			}
			
			else if (i == 116) {
				await Zotero.DB.queryAsync("UPDATE itemAnnotations SET color='#000000' WHERE color='#000'");
			}
			
			else if (i == 117) {
				let versionFieldID = await Zotero.DB.valueQueryAsync("SELECT fieldID FROM fields WHERE fieldName='version'");
				if (versionFieldID) {
					let versionNumberFieldID = await Zotero.DB.valueQueryAsync("SELECT fieldID FROM fields WHERE fieldName='versionNumber'");
					if (versionNumberFieldID) {
						await Zotero.DB.queryAsync("UPDATE itemData SET fieldID=? WHERE fieldID=?", [versionNumberFieldID, versionFieldID]);
						await Zotero.DB.queryAsync("DELETE FROM fields WHERE fieldID=?", versionFieldID);
					}
					else {
						await Zotero.DB.queryAsync("UPDATE fields SET fieldName=? WHERE fieldName=?", ['versionNumber', 'version']);
					}
				}
			}
			
			else if (i == 118) {
				// Switch to new rename/FK behavior. All further table rebuilds must create a new
				// table with a temporary name, do an INSERT...SELECT (with default/missing values
				// as appropriate), delete the old table, and rename the new one back to the
				// original name. https://stackoverflow.com/a/57275538
				await Zotero.DB.queryAsync("PRAGMA legacy_alter_table=OFF");
			}
			
			else if (i == 119) {
				await Zotero.DB.queryAsync("CREATE TABLE itemAnnotationsTemp (\n    itemID INTEGER PRIMARY KEY,\n    parentItemID INT NOT NULL,\n    type INTEGER NOT NULL,\n    authorName TEXT,\n    text TEXT,\n    comment TEXT,\n    color TEXT,\n    pageLabel TEXT,\n    sortIndex TEXT NOT NULL,\n    position TEXT NOT NULL,\n    isExternal INT NOT NULL,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (parentItemID) REFERENCES itemAttachments(itemID)\n)");
				await Zotero.DB.queryAsync("INSERT INTO itemAnnotationsTemp SELECT itemID, parentItemID, type, '', text, comment, color, pageLabel, sortIndex, position, isExternal FROM itemAnnotations");
				await Zotero.DB.queryAsync("DROP TABLE itemAnnotations");
				await Zotero.DB.queryAsync("ALTER TABLE itemAnnotationsTemp RENAME TO itemAnnotations");
				await Zotero.DB.queryAsync("CREATE INDEX itemAnnotations_parentItemID ON itemAnnotations(parentItemID)");
			}
			
			else if (i == 120) {
				// Repeat 119 if it didn't go through
				if (!await Zotero.DB.columnExists('itemAnnotations', 'authorName')) {
					await Zotero.DB.queryAsync("CREATE TABLE itemAnnotationsTemp (\n    itemID INTEGER PRIMARY KEY,\n    parentItemID INT NOT NULL,\n    type INTEGER NOT NULL,\n    authorName TEXT,\n    text TEXT,\n    comment TEXT,\n    color TEXT,\n    pageLabel TEXT,\n    sortIndex TEXT NOT NULL,\n    position TEXT NOT NULL,\n    isExternal INT NOT NULL,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (parentItemID) REFERENCES itemAttachments(itemID)\n)");
					await Zotero.DB.queryAsync("INSERT INTO itemAnnotationsTemp SELECT itemID, parentItemID, type, '', text, comment, color, pageLabel, sortIndex, position, isExternal FROM itemAnnotations");
					await Zotero.DB.queryAsync("DROP TABLE itemAnnotations");
					await Zotero.DB.queryAsync("ALTER TABLE itemAnnotationsTemp RENAME TO itemAnnotations");
					await Zotero.DB.queryAsync("CREATE INDEX itemAnnotations_parentItemID ON itemAnnotations(parentItemID)");
				}
			}
			
			else if (i == 121) {
				let datasetItemTypeID = await Zotero.DB.valueQueryAsync("SELECT itemTypeID FROM itemTypes WHERE typeName='dataset'");
				let numberFieldID = await Zotero.DB.valueQueryAsync("SELECT fieldID FROM fields WHERE fieldName='number'");
				if (datasetItemTypeID && numberFieldID) {
					await Zotero.DB.queryAsync("DELETE FROM itemData WHERE fieldID=? AND itemID IN (SELECT itemID FROM items WHERE itemTypeID=?)", [numberFieldID, datasetItemTypeID]);
					await Zotero.DB.queryAsync("DELETE FROM itemTypeFields WHERE itemTypeID=? AND fieldID=?", [datasetItemTypeID, numberFieldID]);
				}
			}
			
			else if (i == 122) {
				await Zotero.DB.queryAsync("REPLACE INTO fileTypes VALUES(8, 'ebook')");
				await Zotero.DB.queryAsync("REPLACE INTO fileTypeMIMETypes VALUES(8, 'application/epub+zip')");
				// Incorrect, for compatibility
				await Zotero.DB.queryAsync("REPLACE INTO fileTypeMIMETypes VALUES(8, 'application/epub')");
			}
			
			else if (i == 123) {
				await Zotero.DB.queryAsync("CREATE INDEX itemData_valueID ON itemData(valueID)");
			}
			
			// If breaking compatibility or doing anything dangerous, clear minorUpdateFrom
		}
		
		await _updateDBVersion('userdata', toVersion);
		return true;
	};
	
	
	//
	// Longer functions for specific upgrade steps
	//
	
	/**
	 * Convert Mozilla-specific relative descriptors below storage and base directories to UTF-8
	 * paths using '/' separators
	 */
	var _migrateUserData_80_filePaths = async function () {
		var rows = await Zotero.DB.queryAsync("SELECT itemID, libraryID, key, linkMode, path FROM items JOIN itemAttachments USING (itemID) WHERE path != ''");
		var tmpDirFile = Zotero.getTempDirectory();
		var tmpFilePath = OS.Path.normalize(tmpDirFile.path)
			// Since relative paths can be applied on different platforms,
			// just use "/" everywhere for oonsistency, and convert on use
			.replace(/\\/g, '/');
		
		for (let i = 0; i < rows.length; i++) {
			let row = rows[i];
			let libraryKey = row.libraryID + "/" + row.key;
			let path = row.path;
			let prefix = path.match(/^(attachments|storage):/);
			if (prefix) {
				prefix = prefix[0];
				let relPath = path.substr(prefix.length)
				let file = tmpDirFile.clone();
				file.setRelativeDescriptor(file, relPath);
				path = OS.Path.normalize(file.path).replace(/\\/g, '/');
				
				// setRelativeDescriptor() silently uses the parent directory on Windows
				// if the filename contains certain characters, so strip them —
				// but don't skip characters outside of XML range, since they may be
				// correct in the opaque relative descriptor string
				//
				// This is a bad place for this, since the change doesn't make it
				// back up to the sync server, but we do it to make sure we don't
				// accidentally use the parent dir.
				if (path == tmpFilePath) {
					file.setRelativeDescriptor(file, Zotero.File.getValidFileName(relPath, true));
					path = OS.Path.normalize(file.path);
					if (path == tmpFilePath) {
						Zotero.logError("Cannot fix relative descriptor for item " + libraryKey + " -- not converting path");
						continue;
					}
					else {
						Zotero.logError("Filtered relative descriptor for item " + libraryKey);
					}
				}
				
				if (!path.startsWith(tmpFilePath)) {
					Zotero.logError(path + " does not start with " + tmpFilePath
						+ " -- not converting relative path for item " + libraryKey);
					continue;
				}
				path = prefix + path.substr(tmpFilePath.length + 1);
			}
			else {
				let file = Components.classes["@mozilla.org/file/local;1"]
					.createInstance(Components.interfaces.nsIFile);
				try {
					file.persistentDescriptor = path;
				}
				catch (e) {
					Zotero.logError("Invalid persistent descriptor for item " + libraryKey + " -- not converting path");
					continue;
				}
				path = file.path;
			}
			
			await Zotero.DB.queryAsync("UPDATE itemAttachments SET path=? WHERE itemID=?", [path, row.itemID]);
		}
	};
	
	var _migrateUserData_80_relations = async function () {
		await Zotero.DB.queryAsync("CREATE TABLE relationPredicates (\n    predicateID INTEGER PRIMARY KEY,\n    predicate TEXT UNIQUE\n)");
		
		await Zotero.DB.queryAsync("CREATE TABLE collectionRelations (\n    collectionID INT NOT NULL,\n    predicateID INT NOT NULL,\n    object TEXT NOT NULL,\n    PRIMARY KEY (collectionID, predicateID, object),\n    FOREIGN KEY (collectionID) REFERENCES collections(collectionID) ON DELETE CASCADE,\n    FOREIGN KEY (predicateID) REFERENCES relationPredicates(predicateID) ON DELETE CASCADE\n)");
		await Zotero.DB.queryAsync("CREATE INDEX collectionRelations_predicateID ON collectionRelations(predicateID)");
		await Zotero.DB.queryAsync("CREATE INDEX collectionRelations_object ON collectionRelations(object);");
		await Zotero.DB.queryAsync("CREATE TABLE itemRelations (\n    itemID INT NOT NULL,\n    predicateID INT NOT NULL,\n    object TEXT NOT NULL,\n    PRIMARY KEY (itemID, predicateID, object),\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (predicateID) REFERENCES relationPredicates(predicateID) ON DELETE CASCADE\n)");
		await Zotero.DB.queryAsync("CREATE INDEX itemRelations_predicateID ON itemRelations(predicateID)");
		await Zotero.DB.queryAsync("CREATE INDEX itemRelations_object ON itemRelations(object);");
		
		await Zotero.DB.queryAsync("UPDATE relations SET subject=object, predicate='dc:replaces', object=subject WHERE predicate='dc:isReplacedBy'");
		
		var start = 0;
		var limit = 100;
		var collectionSQL = "INSERT OR IGNORE INTO collectionRelations (collectionID, predicateID, object) VALUES ";
		var itemSQL = "INSERT OR IGNORE INTO itemRelations (itemID, predicateID, object) VALUES ";
		//                  1        2                1         2       3                    4
		var objectRE = /(?:(users)\/(\d+|local\/\w+)|(groups)\/(\d+))\/(collections|items)\/([A-Z0-9]{8})/;
		//                1        2                1         2               3
		var itemRE = /(?:(users)\/(\d+|local\/\w+)|(groups)\/(\d+))\/items\/([A-Z0-9]{8})/;
		var report = "";
		var groupLibraryIDMap = {};
		var resolveLibrary = async function (usersOrGroups, id) {
			if (usersOrGroups == 'users') return 1;
			if (groupLibraryIDMap[id] !== undefined) return groupLibraryIDMap[id];
			return groupLibraryIDMap[id] = (await Zotero.DB.valueQueryAsync("SELECT libraryID FROM groups WHERE groupID=?", id));
		};
		var predicateMap = {};
		var resolvePredicate = async function (predicate) {
			if (predicateMap[predicate]) return predicateMap[predicate];
			await Zotero.DB.queryAsync("INSERT INTO relationPredicates (predicateID, predicate) VALUES (NULL, ?)", predicate);
			return predicateMap[predicate] = Zotero.DB.valueQueryAsync("SELECT predicateID FROM relationPredicates WHERE predicate=?", predicate);
		};
		while (true) {
			let rows = await Zotero.DB.queryAsync("SELECT subject, predicate, object FROM relations LIMIT ?, ?", [start, limit]);
			if (!rows.length) {
				break;
			}
			
			let collectionRels = [];
			let itemRels = [];
			
			for (let i = 0; i < rows.length; i++) {
				let row = rows[i];
				let concat = row.subject + " - " + row.predicate + " - " + row.object;
				
				try {
					switch (row.predicate) {
					case 'owl:sameAs':
						let subjectMatch = row.subject.match(objectRE);
						let objectMatch = row.object.match(objectRE);
						if (!subjectMatch && !objectMatch) {
							Zotero.debug("No match for relation subject or object: " + concat, 2);
							report += concat + "\n";
							continue;
						}
						// Remove empty captured groups
						subjectMatch = subjectMatch ? subjectMatch.filter(x => x) : false;
						objectMatch = objectMatch ? objectMatch.filter(x => x) : false;
						let subjectLibraryID = false;
						let subjectType = false;
						let subject = false;
						let objectLibraryID = false;
						let objectType = false;
						let object = false;
						if (subjectMatch) {
							subjectLibraryID = (await resolveLibrary(subjectMatch[1], subjectMatch[2])) || false;
							subjectType = subjectMatch[3];
						}
						if (objectMatch) {
							objectLibraryID = (await resolveLibrary(objectMatch[1], objectMatch[2])) || false;
							objectType = objectMatch[3];
						}
						// Use subject if it's a user library or it isn't but neither is object, and if object can be found
						if (subjectLibraryID && (subjectLibraryID == 1 || objectLibraryID != 1)) {
							let key = subjectMatch[4];
							if (subjectType == 'collection') {
								let collectionID = await Zotero.DB.valueQueryAsync("SELECT collectionID FROM collections WHERE libraryID=? AND key=?", [subjectLibraryID, key]);
								if (collectionID) {
									collectionRels.push([collectionID, row.predicate, row.object]);
									continue;
								}
							}
							else {
								let itemID = await Zotero.DB.valueQueryAsync("SELECT itemID FROM items WHERE libraryID=? AND key=?", [subjectLibraryID, key]);
								if (itemID) {
									itemRels.push([itemID, row.predicate, row.object]);
									continue;
								}
							}
						}
						
						// Otherwise use object if it can be found
						if (objectLibraryID) {
							let key = objectMatch[4];
							if (objectType == 'collection') {
								let collectionID = await Zotero.DB.valueQueryAsync("SELECT collectionID FROM collections WHERE libraryID=? AND key=?", [objectLibraryID, key]);
								if (collectionID) {
									collectionRels.push([collectionID, row.predicate, row.subject]);
									continue;
								}
							}
							else {
								let itemID = await Zotero.DB.valueQueryAsync("SELECT itemID FROM items WHERE libraryID=? AND key=?", [objectLibraryID, key]);
								if (itemID) {
									itemRels.push([itemID, row.predicate, row.subject]);
									continue;
								}
							}
							Zotero.debug("Neither subject nor object found: " + concat, 2);
							report += concat + "\n";
						}
						break;
					
					case 'dc:replaces':
						let match = row.subject.match(itemRE);
						if (!match) {
							Zotero.debug("Unrecognized subject: " + concat, 2);
							report += concat + "\n";
							continue;
						}
						// Remove empty captured groups
						match = match.filter(x => x);
						let libraryID;
						// Users
						if (match[1] == 'users') {
							let itemID = await Zotero.DB.valueQueryAsync("SELECT itemID FROM items WHERE libraryID=? AND key=?", [1, match[3]]);
							if (!itemID) {
								Zotero.debug("Subject not found: " + concat, 2);
								report += concat + "\n";
								continue;
							}
							itemRels.push([itemID, row.predicate, row.object]);
						}
						// Groups
						else {
							let itemID = await Zotero.DB.valueQueryAsync("SELECT itemID FROM items JOIN groups USING (libraryID) WHERE groupID=? AND key=?", [match[2], match[3]]);
							if (!itemID) {
								Zotero.debug("Subject not found: " + concat, 2);
								report += concat + "\n";
								continue;
							}
							itemRels.push([itemID, row.predicate, row.object]);
						}
						break;
					
					default:
						Zotero.debug("Unknown predicate '" + row.predicate + "': " + concat, 2);
						report += concat + "\n";
						continue;
					}
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			
			if (collectionRels.length) {
				for (let i = 0; i < collectionRels.length; i++) {
					collectionRels[i][1] = await resolvePredicate(collectionRels[i][1]);
				}
				await Zotero.DB.queryAsync(collectionSQL + collectionRels.map(() => "(?, ?, ?)").join(", "), collectionRels.reduce((x, y) => x.concat(y)));
			}
			if (itemRels.length) {
				for (let i = 0; i < itemRels.length; i++) {
					itemRels[i][1] = await resolvePredicate(itemRels[i][1]);
				}
				await Zotero.DB.queryAsync(itemSQL + itemRels.map(() => "(?, ?, ?)").join(", "), itemRels.reduce((x, y) => x.concat(y)));
			}
			
			start += limit;
		}
		if (report.length) {
			report = "Removed relations:\n\n" + report;
			Zotero.debug(report);
		}
		await Zotero.DB.queryAsync("DROP TABLE relations");
		
		//
		// Migrate related items
		//
		// If no user id and no local key, create a local key
		if (!(await Zotero.DB.valueQueryAsync("SELECT value FROM settings WHERE setting='account' AND key='userID'"))
				&& !(await Zotero.DB.valueQueryAsync("SELECT value FROM settings WHERE setting='account' AND key='localUserKey'"))) {
			await Zotero.DB.queryAsync("INSERT INTO settings (setting, key, value) VALUES ('account', 'localUserKey', ?)", Zotero.randomString(8));
		}
		var predicateID = predicateMap["dc:relation"];
		if (!predicateID) {
			await Zotero.DB.queryAsync("INSERT OR IGNORE INTO relationPredicates VALUES (NULL, 'dc:relation')");
			predicateID = await Zotero.DB.valueQueryAsync("SELECT predicateID FROM relationPredicates WHERE predicate=?", 'dc:relation');
		}
		await Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemRelations SELECT ISA.itemID, " + predicateID + ", 'http://zotero.org/' || (CASE WHEN G.libraryID IS NULL THEN 'users/' || IFNULL((SELECT value FROM settings WHERE setting='account' AND key='userID'), 'local/' || (SELECT value FROM settings WHERE setting='account' AND key='localUserKey')) ELSE 'groups/' || G.groupID END) || '/items/' || I.key FROM itemSeeAlso ISA JOIN items I ON (ISA.linkedItemID=I.itemID) LEFT JOIN groups G USING (libraryID)");
		await Zotero.DB.queryAsync("DROP TABLE itemSeeAlso");
	};
	
	async function _fixSciteValues() {
		// See if there are any bad values
		var badData = await Zotero.DB.rowQueryAsync("SELECT 1 FROM itemDataValues WHERE value=0 LIMIT 1");
		if (!badData) {
			return;
		}
		
		var replacementValueID = await Zotero.DB.valueQueryAsync("SELECT valueID FROM itemDataValues WHERE value='INVALID_SCITE_VALUE'");
		// We already replaced some rows
		if (replacementValueID) {
			let invalidValueID = await Zotero.DB.valueQueryAsync("SELECT valueID FROM itemDataValues WHERE value=0");
			await Zotero.DB.queryAsync("UPDATE itemData SET valueID=? WHERE valueID=?", [replacementValueID, invalidValueID]);
			await Zotero.DB.queryAsync("DELETE FROM itemDataValues WHERE valueID=?", invalidValueID);
			await Zotero.DB.queryAsync("DELETE FROM itemData WHERE fieldID=(SELECT fieldID FROM fields WHERE fieldName='accessDate') AND valueID=?", replacementValueID);
		}
		else {
			await Zotero.DB.queryAsync("UPDATE itemDataValues SET value='INVALID_SCITE_VALUE' WHERE value=0");
			await Zotero.DB.queryAsync("DELETE FROM itemData WHERE fieldID=(SELECT fieldID FROM fields WHERE fieldName='accessDate') AND valueID=(SELECT valueID FROM itemDataValues WHERE value='INVALID_SCITE_VALUE')");
		}
	}
}
