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
	this.skipDefaultData = false;
	this.dbInitialized = false;
	this.goToChangeLog = false;
	
	var _schemaUpdateDeferred = Zotero.Promise.defer();
	this.schemaUpdatePromise = _schemaUpdateDeferred.promise;
	
	var _dbVersions = [];
	var _schemaVersions = [];
	var _maxCompatibility = 1;
	var _repositoryTimer;
	var _remoteUpdateInProgress = false, _localUpdateInProgress = false;
	
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
	this.updateSchema = Zotero.Promise.coroutine(function* () {
		// TODO: Check database integrity first with Zotero.DB.integrityCheck()
		
		// 'userdata' is the last upgrade step run in _migrateUserDataSchema() based on the
		// version in the schema file. Upgrade steps may or may not break DB compatibility.
		//
		// 'compatibility' is incremented manually by upgrade steps in order to break DB
		// compatibility with older versions.
		var versions = yield Zotero.Promise.all([
			this.getDBVersion('userdata'), this.getDBVersion('compatibility')
		]);
		var [userdata, compatibility] = versions;
		if (!userdata) {
			Zotero.debug('Database does not exist -- creating\n');
			return _initializeSchema()
			.then(function() {
				Zotero.initializationPromise
				.then(1000)
				.then(function () {
					return Zotero.Schema.updateBundledFiles();
				})
				.then(function () {
					_schemaUpdateDeferred.resolve(true);
				});
			});
		}
		
		// We don't handle upgrades from pre-Zotero 2.1 databases
		if (userdata < 76) {
			let msg = Zotero.getString('upgrade.nonupgradeableDB1')
				+ "\n\n" + Zotero.getString('upgrade.nonupgradeableDB2', "4.0");
			throw new Error(msg);
		}
		
		if (compatibility > _maxCompatibility) {
			throw new Error("Database is incompatible this Zotero version "
				+ "(" + compatibility + " > "  + _maxCompatibility + ")");
		}
		
		var schemaVersion = yield _getSchemaSQLVersion('userdata');
		
		// If upgrading userdata, make backup of database first
		if (userdata < schemaVersion) {
			yield Zotero.DB.backupDatabase(userdata, true);
		}
		
		var updated = yield Zotero.DB.executeTransaction(function* (conn) {
			yield Zotero.DB.queryAsync("PRAGMA defer_foreign_keys = true");
			
			var updated = yield _updateSchema('system');
			
			// Update custom tables if they exist so that changes are in
			// place before user data migration
			if (Zotero.DB.tableExists('customItemTypes')) {
				yield _updateCustomTables(updated);
			}
			updated = yield _migrateUserDataSchema(userdata);
			yield _updateSchema('triggers');
			
			// Populate combined tables for custom types and fields -- this is likely temporary
			//
			// We do this again in case custom fields were changed during user data migration
			yield _updateCustomTables()
			
			return updated;
		}.bind(this));
		
		if (updated) {
			// Upgrade seems to have been a success -- delete any previous backups
			var maxPrevious = userdata - 1;
			var file = Zotero.getZoteroDirectory();
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
				for each(var file in toDelete) {
					Zotero.debug('Removing previous backup file ' + file.leafName);
					file.remove(false);
				}
			}
			catch (e) {
				Zotero.debug(e);
			}
		}
		
		Zotero.initializationPromise
		.then(1000)
		.then(function () {
			return Zotero.Schema.updateBundledFiles();
		})
		.then(function () {
			_schemaUpdateDeferred.resolve(true);
		});
		
		return updated;
	});
	
	
	// This is mostly temporary
	// TEMP - NSF
	// TODO: async
	this.importSchema = Zotero.Promise.coroutine(function* (str, uri) {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		
		if (!uri.match(/https?:\/\/([^\.]+\.)?zotero.org\//)) {
			Zotero.debug("Ignoring schema file from non-zotero.org domain");
			return;
		}
		
		str = Zotero.Utilities.trim(str);
		
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
			
			Zotero.DB.beginTransaction();
			
			Zotero.DB.query("INSERT INTO customItemTypes VALUES (?, 'nsfReviewer', 'NSF Reviewer', 1, 'chrome://zotero/skin/report_user.png')", itemTypeID);
			
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
					Zotero.DB.query("INSERT INTO customFields VALUES (?, ?, ?)", [fieldID, fields[i][0], fields[i][1]]);
					Zotero.DB.query("INSERT INTO customItemTypeFields VALUES (?, NULL, ?, 1, ?)", [itemTypeID, fieldID, i+1]);
				}
				else {
					Zotero.DB.query("INSERT INTO customItemTypeFields VALUES (?, ?, NULL, 1, ?)", [itemTypeID, fieldID, i+1]);
				}
				
				switch (fields[i][0]) {
					case 'name':
						var baseFieldID = 110; // title
						break;
					
					case 'dateSent':
						var baseFieldID = 14; // date
						break;
					
					case 'homepage':
						var baseFieldID = 1; // URL
						break;
					
					default:
						var baseFieldID = null;
				}
				
				if (baseFieldID) {
					Zotero.DB.query("INSERT INTO customBaseFieldMappings VALUES (?, ?, ?)", [itemTypeID, baseFieldID, fieldID]);
				}
			}
			
			Zotero.DB.commitTransaction();
			
			_reloadSchema();
			
			var s = new Zotero.Search;
			s.name = "Overdue NSF Reviewers";
			s.addCondition('itemType', 'is', 'nsfReviewer');
			s.addCondition('dateDue', 'isBefore', 'today');
			s.addCondition('tag', 'isNot', 'Completed');
			s.save();
			
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
			if (s.search() || s2.search()) {
				ps.alert(null, "Error", "All 'NSF Reviewer' items must be deleted before the item type can be removed from Zotero.");
				return;
			}
			
			Zotero.debug("Uninstalling nsfReviewer item type");
			Zotero.DB.beginTransaction();
			Zotero.DB.query("DELETE FROM customItemTypes WHERE customItemTypeID=?", itemTypeID - Zotero.ItemTypes.customIDOffset);
			var fields = Zotero.ItemFields.getItemTypeFields(itemTypeID);
			for each(var fieldID in fields) {
				if (Zotero.ItemFields.isCustom(fieldID)) {
					Zotero.DB.query("DELETE FROM customFields WHERE customFieldID=?", fieldID - Zotero.ItemTypes.customIDOffset);
				}
			}
			Zotero.DB.commitTransaction();
			
			var searches = Zotero.Searches.getAll();
			for each(var search in searches) {
				if (search.name == 'Overdue NSF Reviewers') {
					var id = search.id;
					yield Zotero.Searches.erase(id);
				}
			}
			
			_reloadSchema();
			
			ps.alert(null, "Zotero Item Type Removed", "The 'NSF Reviewer' item type has been uninstalled.");
		}
	});
	
	var _reloadSchema = Zotero.Promise.coroutine(function* () {
		yield _updateCustomTables();
		yield Zotero.ItemTypes.load();
		yield Zotero.ItemFields.load();
		yield Zotero.SearchConditions.init();
		
		// Update item type menus in every open window
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					.getService(Components.interfaces.nsIWindowMediator);
		var enumerator = wm.getEnumerator("navigator:browser");
		while (enumerator.hasMoreElements()) {
			var win = enumerator.getNext();
			win.ZoteroPane.buildItemTypeSubMenu();
			win.document.getElementById('zotero-editpane-item-box').buildItemTypeMenu();
		}
	});
	
	
	var _updateCustomTables = Zotero.Promise.coroutine(function* (skipDelete, skipSystem) {
		Zotero.debug("Updating custom tables");
		
		Zotero.DB.requireTransaction();
		
		if (!skipDelete) {
			yield Zotero.DB.queryAsync("DELETE FROM itemTypesCombined");
			yield Zotero.DB.queryAsync("DELETE FROM fieldsCombined WHERE fieldID NOT IN (SELECT fieldID FROM itemData)");
			yield Zotero.DB.queryAsync("DELETE FROM itemTypeFieldsCombined");
			yield Zotero.DB.queryAsync("DELETE FROM baseFieldMappingsCombined");
		}
		
		var offset = Zotero.ItemTypes.customIDOffset;
		yield Zotero.DB.queryAsync(
			"INSERT INTO itemTypesCombined "
				+ (
					skipSystem
					? ""
					: "SELECT itemTypeID, typeName, display, 0 AS custom FROM itemTypes UNION "
				)
				+ "SELECT customItemTypeID + " + offset + " AS itemTypeID, typeName, display, 1 AS custom FROM customItemTypes"
		);
		yield Zotero.DB.queryAsync(
			"INSERT OR IGNORE INTO fieldsCombined "
				+ (
					skipSystem
					? ""
					: "SELECT fieldID, fieldName, NULL AS label, fieldFormatID, 0 AS custom FROM fields UNION "
				)
				+ "SELECT customFieldID + " + offset + " AS fieldID, fieldName, label, NULL, 1 AS custom FROM customFields"
		);
		yield Zotero.DB.queryAsync(
			"INSERT INTO itemTypeFieldsCombined "
				+ (
					skipSystem
					? ""
					: "SELECT itemTypeID, fieldID, hide, orderIndex FROM itemTypeFields UNION "
				)
				+ "SELECT customItemTypeID + " + offset + " AS itemTypeID, "
					+ "COALESCE(fieldID, customFieldID + " + offset + ") AS fieldID, hide, orderIndex FROM customItemTypeFields"
		);
		yield Zotero.DB.queryAsync(
			"INSERT INTO baseFieldMappingsCombined "
				+ (
					skipSystem
					? ""
					: "SELECT itemTypeID, baseFieldID, fieldID FROM baseFieldMappings UNION "
				)
				+ "SELECT customItemTypeID + " + offset + " AS itemTypeID, baseFieldID, "
					+ "customFieldID + " + offset + " AS fieldID FROM customBaseFieldMappings"
		);
	});
	
	
	/**
	 * Update styles and translators in data directory with versions from
	 * ZIP file (XPI) or directory (source) in extension directory
	 *
	 * @param {String} [mode] - 'translators' or 'styles'
	 * @return {Promise}
	 */
	this.updateBundledFiles = Zotero.Promise.coroutine(function* (mode) {
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
			yield Zotero.proxyAuthComplete.delay(1000);
			
			// Get path to add-on
			
			// Synchronous in Standalone
			if (Zotero.isStandalone) {
				var installLocation = Components.classes["@mozilla.org/file/directory_service;1"]
					.getService(Components.interfaces.nsIProperties)
					.get("AChrom", Components.interfaces.nsIFile).parent;
				installLocation.append("zotero.jar");
			}
			// Asynchronous in Firefox
			else {
				let resolve, reject;
				let promise = new Zotero.Promise(function () {
					resolve = arguments[0];
					reject = arguments[1];
				});
				Components.utils.import("resource://gre/modules/AddonManager.jsm");
				AddonManager.getAddonByID(
					ZOTERO_CONFIG.GUID,
					function (addon) {
						try {
							installLocation = addon.getResourceURI()
								.QueryInterface(Components.interfaces.nsIFileURL).file;
						}
						catch (e) {
							reject(e);
							return;
						}
						resolve();
					}
				);
				yield promise;
			}
			installLocation = installLocation.path;
			
			// Update files
			switch (mode) {
			case 'styles':
				yield Zotero.Styles.init();
				var updated = yield _updateBundledFilesAtLocation(installLocation, mode);
			
			case 'translators':
				yield Zotero.Translators.init();
				var updated = yield _updateBundledFilesAtLocation(installLocation, mode);
			
			default:
				yield Zotero.Translators.init();
				let up1 = yield _updateBundledFilesAtLocation(installLocation, 'translators', true);
				yield Zotero.Styles.init();
				let up2 = yield _updateBundledFilesAtLocation(installLocation, 'styles');
				var updated = up1 || up2;
			}
		}
		finally {
			_localUpdateInProgress = false;
		}
		
		if (updated) {
			if (Zotero.Prefs.get('automaticScraperUpdates')) {
				yield Zotero.Schema.updateFromRepository(2);
			}
		}
		else {
			yield Zotero.Schema.updateFromRepository(false);
		}
	});
	
	/**
	 * Update bundled files in a given location
	 *
	 * @param {String} installLocation - Path to XPI or source dir
	 * @param {'translators','styles'} mode
	 * @param {Boolean} [skipVersionUpdates=false]
	 */
	var _updateBundledFilesAtLocation = Zotero.Promise.coroutine(function* (installLocation, mode, skipVersionUpdates) {
		Components.utils.import("resource://gre/modules/FileUtils.jsm");
		
		var isUnpacked = (yield OS.File.stat(installLocation)).isDir;
		if(!isUnpacked) {
			var xpiZipReader = Components.classes["@mozilla.org/libjar/zip-reader;1"]
					.createInstance(Components.interfaces.nsIZipReader);
			xpiZipReader.open(new FileUtils.File(installLocation));
			
			if(Zotero.isStandalone && !xpiZipReader.hasEntry("translators.index")) {
				// Symlinked dev Standalone build
				let parentDir = OS.Path.dirname(installLocation);
				let translatorsDir = OS.Path.join(parentDir, 'translators');
				if (yield OS.File.exists(translatorsDir)) {
					installLocation = parentDir;
					isUnpacked = true;
					xpiZipReader.close();
				}
			}
			else {
				var zipFileName = OS.Path.basename(installLocation);
			}
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
		
		var repotime = yield Zotero.File.getContentsFromURLAsync("resource://zotero/schema/repotime.txt");
		var date = Zotero.Date.sqlToDate(repotime, true);
		repotime = Zotero.Date.toUnixTimestamp(date);
		
		var fileNameRE = new RegExp("^[^\.].+\\" + fileExt + "$");
		
		// If directory is empty, force reinstall
		var forceReinstall = true;
		let iterator = new OS.File.DirectoryIterator(destDir);
		try {
			outer:
			while (true) {
				let entries = yield iterator.nextBatch(10);
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
		var lastVersion = yield Zotero.DB.valueQueryAsync(sql);
		
		if(isUnpacked) {
			var deleted = OS.Path.join(installLocation, 'deleted.txt');
			// In source builds, deleted.txt is in the translators directory
			if (!(yield OS.File.exists(deleted))) {
				deleted = OS.Path.join(installLocation, 'translators', 'deleted.txt');
				if (!(yield OS.File.exists(deleted))) {
					deleted = false;
				}
			}
		} else {
			var deleted = xpiZipReader.getInputStream("deleted.txt");
		}
		
		deleted = yield Zotero.File.getContentsAsync(deleted);
		deleted = deleted.match(/^([^\s]+)/gm);
		var version = deleted.shift();
		
		if (!lastVersion || lastVersion < version) {
			var toDelete = [];
			let iterator = new OS.File.DirectoryIterator(destDir);
			try {
				while (true) {
					let entries = yield iterator.nextBatch(10);
					if (!entries.length) break;
					for (let i = 0; i < entries.length; i++) {
						let entry = entries[i];
						
						if ((entry.isSymLink && !(yield OS.File.exists(entry.path))) // symlink to non-existent file
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
									let str = yield Zotero.File.getContentsAsync(entry.path, false, 300);
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
							let newObj = new Zotero[Mode].loadFromFile(entry.path);
							if (deleted.indexOf(newObj[modeType + "ID"]) == -1) {
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
					yield OS.File.remove(path);
				}
				catch (e) {
					Components.utils.reportError(e);
					Zotero.debug(e, 1);
				}
			}
			
			if (!skipVersionUpdates) {
				let sql = "REPLACE INTO version (schema, version) VALUES ('delete', ?)";
				yield Zotero.DB.queryAsync(sql, version);
			}
		}
		
		//
		// Update files
		//
		var sql = "SELECT version FROM version WHERE schema=?";
		var lastModTime = yield Zotero.DB.valueQueryAsync(sql, mode);
		var cache = {};
		
		// XPI installation
		if (!isUnpacked) {
			var modTime = Math.round(
				(yield OS.File.stat(installLocation)).lastModificationDate.getTime() / 1000
			);
			
			if (!forceReinstall && lastModTime && modTime <= lastModTime) {
				Zotero.debug("Installed " + mode + " are up-to-date with " + zipFileName);
				return false;
			}
			
			Zotero.debug("Updating installed " + mode + " from " + zipFileName);
			
			let tmpDir = Zotero.getTempDirectory().path;
			
			if (mode == 'translators') {
				// Parse translators.index
				if (!xpiZipReader.hasEntry("translators.index")) {
					Components.utils.reportError("translators.index not found");
					return false;
				}
				let indexFile = xpiZipReader.getInputStream("translators.index");
				
				indexFile = yield Zotero.File.getContentsAsync(indexFile);
				indexFile = indexFile.split("\n");
				let index = {};
				for (let i = 0; i < indexFile.length; i++) {
					let line = indexFile[i];
					if (!line) {
						continue;
					}
					let [translatorID, label, lastUpdated] = line.split(',');
					if (!translatorID) {
						Components.utils.reportError("Invalid translatorID '" + translatorID + "'");
						return false;
					}
					index[translatorID] = {
						label: label,
						lastUpdated: lastUpdated,
						extract: true
					};
				}
				
				let sql = "SELECT metadataJSON FROM translatorCache";
				let dbCache = yield Zotero.DB.columnQueryAsync(sql);
				// If there's anything in the cache, see what we actually need to extract
				if (dbCache) {
					for (let i = 0; i < dbCache.length; i++) {
						let metadata = JSON.parse(dbCache[i]);
						let id = metadata.translatorID;
						if (index[id] && index[id].lastUpdated == metadata.lastUpdated) {
							index[id].extract = false;
						}
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
					yield Zotero.File.removeIfExists(tmpFile);
					xpiZipReader.extract("translators/" + entry.fileName, new FileUtils.File(tmpFile));
					
					var existingObj = Zotero.Translators.get(translatorID);
					if (!existingObj) {
						Zotero.debug("Installing translator '" + entry.label + "'");
					}
					else {
						Zotero.debug("Updating translator '" + existingObj.label + "'");
						yield Zotero.File.removeIfExists(existingObj.path);
					}
					
					let fileName = Zotero.Translators.getFileNameFromLabel(
						entry.label, translatorID
					);
					
					let destFile = OS.Path.join(destDir, fileName);
					try {
						yield OS.File.move(tmpFile, destFile, {
							noOverwrite: true
						});
					}
					catch (e) {
						if (e instanceof OS.File.Error && e.becauseExists) {
							// Could overwrite automatically, but we want to log this
							let msg = "Overwriting translator with same filename '" + fileName + "'";
							Zotero.debug(msg, 1);
							Components.utils.reportError(msg);
							yield OS.File.move(tmpFile, destFile);
						}
						else {
							throw e;
						}
					}
				}
			}
			// Styles
			else {
				let entries = zipReader.findEntries('styles/*.csl');
				while (entries.hasMore()) {
					let entry = entries.getNext();
					let fileName = entry.substr(7); // strip 'styles/'
					
					let tmpFile = OS.Path.join(tmpDir, fileName);
					yield Zotero.File.removeIfExists(tmpFile);
					zipReader.extract(entry, new FileUtils.File(tmpFile));
					let code = yield Zotero.File.getContentsAsync(tmpFile);
					let newObj = new Zotero.Style(code);
					
					let existingObj = Zotero.Styles.get(newObj[modeType + "ID"]);
					if (!existingObj) {
						Zotero.debug("Installing style '" + newObj[titleField] + "'");
					}
					else {
						Zotero.debug("Updating "
							+ (existingObj.hidden ? "hidden " : "")
							+ "style '" + existingObj[titleField] + "'");
						yield Zotero.File.removeIfExists(existingObj.path);
					}
					
					if (!existingObj || !existingObj.hidden) {
						yield OS.File.move(tmpFile, OS.Path.join(destDir, fileName));
					}
					else {
						yield OS.File.move(tmpFile, OS.Path.join(hiddenDir, fileName));
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
					let entries = yield iterator.nextBatch(10); // TODO: adjust as necessary
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
							d = (yield OS.File.stat(entry.path)).lastModificationDate;
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
					let entries = yield iterator.nextBatch(10); // TODO: adjust as necessary
					if (!entries.length) break;
					
					for (let i = 0; i < entries.length; i++) {
						let entry = entries[i];
						if (!entry.name.match(fileNameRE) || entry.isDir) {
							continue;
						}
						let newObj;
						if (mode == 'styles') {
							let code = yield Zotero.File.getContentsAsync(entry.path);
							newObj = new Zotero.Style(code);
						}
						else if (mode == 'translators') {
							newObj = yield Zotero.Translators.loadFromFile(entry.path);
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
							yield Zotero.File.removeIfExists(existingObj.path);
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
								yield OS.File.copy(entry.path, destFile, { noOverwrite: true });
							}
							catch (e) {
								if (e instanceof OS.File.Error && e.becauseExists) {
									// Could overwrite automatically, but we want to log this
									let msg = "Overwriting " + modeType + " with same filename "
										+ "'" + fileName + "'";
									Zotero.debug(msg, 1);
									Components.utils.reportError(msg);
									yield OS.File.copy(entry.path, destFile);
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
		
		yield Zotero.DB.executeTransaction(function* () {
			var sql = "REPLACE INTO version VALUES (?, ?)";
			yield Zotero.DB.queryAsync(sql, [mode, modTime]);
			
			if (!skipVersionUpdates) {
				sql = "REPLACE INTO version VALUES ('repository', ?)";
				yield Zotero.DB.queryAsync(sql, repotime);
			}
		});
		
		yield Zotero[Mode].reinit(cache);
		
		return true;
	});
	
	
	/**
	 * Send XMLHTTP request for updated translators and styles to the central repository
	 *
	 * @param	{Boolean}	force	Force a repository query regardless of how
	 *									long it's been since the last check
	 */
	this.updateFromRepository = Zotero.Promise.coroutine(function* (force) {
		if (!force) {
			if (_remoteUpdateInProgress) {
				Zotero.debug("A remote update is already in progress -- not checking repository");
				return false;
			}
			
			// Check user preference for automatic updates
			if (!Zotero.Prefs.get('automaticScraperUpdates')) {
				Zotero.debug('Automatic repository updating disabled -- not checking repository', 4);
				return false;
			}
			
			// Determine the earliest local time that we'd query the repository again
			let lastCheck = yield this.getDBVersion('lastcheck');
			let nextCheck = new Date();
			nextCheck.setTime((lastCheck + ZOTERO_CONFIG.REPOSITORY_CHECK_INTERVAL) * 1000);
			
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
			return;
		}
		
		if (Zotero.locked) {
			Zotero.debug('Zotero is locked -- delaying repository check', 4);
			_setRepositoryTimer(600);
			return;
		}
		
		// If transaction already in progress, delay by ten minutes
		yield Zotero.DB.waitForTransaction();
		
		// Get the last timestamp we got from the server
		var lastUpdated = yield this.getDBVersion('repository');
		
		try {
			var url = ZOTERO_CONFIG.REPOSITORY_URL + 'updated?'
				+ (lastUpdated ? 'last=' + lastUpdated + '&' : '')
				+ 'version=' + Zotero.version;
			
			Zotero.debug('Checking repository for updates');
			
			_remoteUpdateInProgress = true;
			
			if (force) {
				if (force == 2) {
					url += '&m=2';
				}
				else {
					url += '&m=1';
				}
			}
			
			// Send list of installed styles
			var styles = yield Zotero.Styles.getAll();
			var styleTimestamps = [];
			for (var id in styles) {
				var updated = Zotero.Date.sqlToDate(styles[id].updated);
				updated = updated ? updated.getTime() / 1000 : 0;
				var selfLink = styles[id].url;
				var data = {
					id: id,
					updated: updated
				};
				if (selfLink) {
					data.url = selfLink;
				}
				styleTimestamps.push(data);
			}
			var body = 'styles=' + encodeURIComponent(JSON.stringify(styleTimestamps));
			
			try {
				var xmlhttp = yield Zotero.HTTP.request("POST", url, { body: body });
				return _updateFromRepositoryCallback(xmlhttp, !!force);
			}
			catch (e) {
				if (e instanceof Zotero.HTTP.BrowserOfflineException || e.xmlhttp) {
					let msg = " -- retrying in " + ZOTERO_CONFIG.REPOSITORY_RETRY_INTERVAL
					if (e instanceof Zotero.HTTP.BrowserOfflineException) {
						Zotero.debug("Browser is offline" + msg, 2);
					}
					else {
						Components.utils.reportError(e);
						Zotero.debug(xmlhttp.status, 1);
						Zotero.debug(xmlhttp.responseText, 1);
						Zotero.debug("Error updating from repository " + msg, 1);
					}
					// TODO: instead, add an observer to start and stop timer on online state change
					_setRepositoryTimer(ZOTERO_CONFIG.REPOSITORY_RETRY_INTERVAL);
					return;
				}
				if (xmlhttp) {
					Zotero.debug(xmlhttp.status, 1);
					Zotero.debug(xmlhttp.responseText, 1);
				}
				throw e;
			};
		}
		finally {
			_remoteUpdateInProgress = false;
		}
	});
	
	
	this.stopRepositoryTimer = function () {
		if (_repositoryTimer){
			Zotero.debug('Stopping repository check timer');
			_repositoryTimer.cancel();
		}
	}
	
	
	this.resetTranslatorsAndStyles = Zotero.Promise.coroutine(function* () {
		Zotero.debug("Resetting translators and styles");
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('translators', 'styles', 'repository', 'lastcheck')";
		yield Zotero.DB.queryAsync(sql);
		_dbVersions.repository = null;
		_dbVersions.lastcheck = null;
		
		var translatorsDir = Zotero.getTranslatorsDirectory();
		var stylesDir = Zotero.getStylesDirectory();
		
		translatorsDir.remove(true);
		stylesDir.remove(true);
		
		// Recreate directories
		Zotero.getTranslatorsDirectory();
		Zotero.getStylesDirectory();
		
		yield Zotero.Promise.all(Zotero.Translators.reinit(), Zotero.Styles.reinit());
		yield this.updateBundledFiles();
	});
	
	
	this.resetTranslators = Zotero.Promise.coroutine(function* () {
		Zotero.debug("Resetting translators");
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('translators', 'repository', 'lastcheck')";
		yield Zotero.DB.queryAsync(sql);
		_dbVersions.repository = null;
		_dbVersions.lastcheck = null;
		
		var translatorsDir = Zotero.getTranslatorsDirectory();
		translatorsDir.remove(true);
		Zotero.getTranslatorsDirectory(); // recreate directory
		yield Zotero.Translators.reinit();
		return this.updateBundledFiles('translators');
	});
	
	
	this.resetStyles = Zotero.Promise.coroutine(function* () {
		Zotero.debug("Resetting translators and styles");
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('styles', 'repository', 'lastcheck')";
		yield Zotero.DB.queryAsync(sql);
		_dbVersions.repository = null;
		_dbVersions.lastcheck = null;
		
		var stylesDir = Zotero.getStylesDirectory();
		stylesDir.remove(true);
		Zotero.getStylesDirectory(); // recreate directory
		yield Zotero.Styles.reinit()
		return this.updateBundledFiles('styles');
	});
	
	
	this.integrityCheck = Zotero.Promise.coroutine(function* (fix) {
		var userLibraryID = Zotero.Libraries.userLibraryID;
		
		// Just as a sanity check, make sure combined field tables are populated,
		// so that we don't try to wipe out all data
		if (!(yield Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM fieldsCombined"))
				|| !(yield Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM itemTypeFieldsCombined"))) {
			return false;
		}
		
		// There should be an equivalent SELECT COUNT(*) statement for every
		// statement run by the DB Repair Tool
		var queries = [
			[
				"SELECT COUNT(*) FROM annotations WHERE itemID NOT IN (SELECT itemID FROM items)",
				"DELETE FROM annotations WHERE itemID NOT IN (SELECT itemID FROM items)"
			],
			[
				"SELECT COUNT(*) FROM collectionItems WHERE itemID NOT IN (SELECT itemID FROM items)",
				"DELETE FROM collectionItems WHERE itemID NOT IN (SELECT itemID FROM items)"
			],
			[
				"SELECT COUNT(*) FROM fulltextItems WHERE itemID NOT IN (SELECT itemID FROM items)",
				"DELETE FROM fulltextItems WHERE itemID NOT IN (SELECT itemID FROM items)"
			],
			[
				"SELECT COUNT(*) FROM fulltextItemWords WHERE itemID NOT IN (SELECT itemID FROM items)",
				"DELETE FROM fulltextItemWords WHERE itemID NOT IN (SELECT itemID FROM items)",
			],
			[
				"SELECT COUNT(*) FROM fulltextItemWords WHERE itemID NOT IN (SELECT itemID FROM fulltextItems)",
				"DELETE FROM fulltextItemWords WHERE itemID NOT IN (SELECT itemID FROM fulltextItems)",
			],
			[
				"SELECT COUNT(*) FROM highlights WHERE itemID NOT IN (SELECT itemID FROM items)",
				"DELETE FROM highlights WHERE itemID NOT IN (SELECT itemID FROM items)",
			],
			[
				"SELECT COUNT(*) FROM itemAttachments WHERE itemID NOT IN (SELECT itemID FROM items)",
				"DELETE FROM itemAttachments WHERE itemID NOT IN (SELECT itemID FROM items)",
			],
			[
				"SELECT COUNT(*) FROM itemCreators WHERE itemID NOT IN (SELECT itemID FROM items)",
				"DELETE FROM itemCreators WHERE itemID NOT IN (SELECT itemID FROM items)",
			],
			[
				"SELECT COUNT(*) FROM itemData WHERE itemID NOT IN (SELECT itemID FROM items)",
				"DELETE FROM itemData WHERE itemID NOT IN (SELECT itemID FROM items)",
			],
			[
				"SELECT COUNT(*) FROM itemNotes WHERE itemID NOT IN (SELECT itemID FROM items)",
				"DELETE FROM itemNotes WHERE itemID NOT IN (SELECT itemID FROM items)",
			],
			[
				"SELECT COUNT(*) FROM itemSeeAlso WHERE itemID NOT IN (SELECT itemID FROM items)",
				"DELETE FROM itemSeeAlso WHERE itemID NOT IN (SELECT itemID FROM items)",
			],
			[
				"SELECT COUNT(*) FROM itemSeeAlso WHERE linkedItemID NOT IN (SELECT itemID FROM items)",
				"DELETE FROM itemSeeAlso WHERE linkedItemID NOT IN (SELECT itemID FROM items)",
			],
			[
				"SELECT COUNT(*) FROM itemTags WHERE itemID NOT IN (SELECT itemID FROM items)",
				"DELETE FROM itemTags WHERE itemID NOT IN (SELECT itemID FROM items)",
			],
			[
				"SELECT COUNT(*) FROM itemTags WHERE tagID NOT IN (SELECT tagID FROM tags)",
				"DELETE FROM itemTags WHERE tagID NOT IN (SELECT tagID FROM tags)",
			],
			[
				"SELECT COUNT(*) FROM savedSearchConditions WHERE savedSearchID NOT IN (select savedSearchID FROM savedSearches)",
				"DELETE FROM savedSearchConditions WHERE savedSearchID NOT IN (select savedSearchID FROM savedSearches)",
			],
			[
				"SELECT COUNT(*) FROM items WHERE itemTypeID IS NULL",
				"DELETE FROM items WHERE itemTypeID IS NULL",
			],
			
			
			[
				"SELECT COUNT(*) FROM itemData WHERE valueID NOT IN (SELECT valueID FROM itemDataValues)",
				"DELETE FROM itemData WHERE valueID NOT IN (SELECT valueID FROM itemDataValues)",
			],
			[
				"SELECT COUNT(*) FROM fulltextItemWords WHERE wordID NOT IN (SELECT wordID FROM fulltextWords)",
				"DELETE FROM fulltextItemWords WHERE wordID NOT IN (SELECT wordID FROM fulltextWords)",
			],
			[
				"SELECT COUNT(*) FROM collectionItems WHERE collectionID NOT IN (SELECT collectionID FROM collections)",
				"DELETE FROM collectionItems WHERE collectionID NOT IN (SELECT collectionID FROM collections)",
			],
			[
				"SELECT COUNT(*) FROM itemCreators WHERE creatorID NOT IN (SELECT creatorID FROM creators)",
				"DELETE FROM itemCreators WHERE creatorID NOT IN (SELECT creatorID FROM creators)",
			],
			[
				"SELECT COUNT(*) FROM itemData WHERE fieldID NOT IN (SELECT fieldID FROM fieldsCombined)",
				"DELETE FROM itemData WHERE fieldID NOT IN (SELECT fieldID FROM fieldsCombined)",
			],
			[
				"SELECT COUNT(*) FROM itemData WHERE valueID NOT IN (SELECT valueID FROM itemDataValues)",
				"DELETE FROM itemData WHERE valueID NOT IN (SELECT valueID FROM itemDataValues)",
			],
			
			
			// Attachments row with itemTypeID != 14
			[
				"SELECT COUNT(*) FROM itemAttachments JOIN items USING (itemID) WHERE itemTypeID != 14",
				"UPDATE items SET itemTypeID=14, clientDateModified=CURRENT_TIMESTAMP WHERE itemTypeID != 14 AND itemID IN (SELECT itemID FROM itemAttachments)",
			],
			// Fields not in type
			[
				"SELECT COUNT(*) FROM itemData WHERE fieldID NOT IN (SELECT fieldID FROM itemTypeFieldsCombined WHERE itemTypeID=(SELECT itemTypeID FROM items WHERE itemID=itemData.itemID))",
				"DELETE FROM itemData WHERE fieldID NOT IN (SELECT fieldID FROM itemTypeFieldsCombined WHERE itemTypeID=(SELECT itemTypeID FROM items WHERE itemID=itemData.itemID))",
			],
			// Missing itemAttachments row
			[
				"SELECT COUNT(*) FROM items WHERE itemTypeID=14 AND itemID NOT IN (SELECT itemID FROM itemAttachments)",
				"INSERT INTO itemAttachments (itemID, linkMode) SELECT itemID, 0 FROM items WHERE itemTypeID=14 AND itemID NOT IN (SELECT itemID FROM itemAttachments)",
			],
			// Note/child parents
			[
				"SELECT COUNT(*) FROM itemAttachments WHERE parentItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (1,14))",
				"UPDATE itemAttachments SET parentItemID=NULL WHERE parentItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (1,14))",
			],
			[
				"SELECT COUNT(*) FROM itemNotes WHERE parentItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (1,14))",
				"UPDATE itemNotes SET parentItemID=NULL WHERE parentItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (1,14))",
			],
			
			// Wrong library tags
			[
				"SELECT COUNT(*) FROM tags NATURAL JOIN itemTags JOIN items USING (itemID) WHERE "
					+ "IFNULL(tags.libraryID, " + userLibraryID + ") != IFNULL(items.libraryID, " + userLibraryID + ")",
				[
					"CREATE TEMPORARY TABLE tmpWrongLibraryTags AS "
						+ "SELECT itemTags.ROWID AS tagRowID, tagID, name, itemID, "
						+ "IFNULL(tags.libraryID, " + userLibraryID + ") AS tagLibraryID, "
						+ "IFNULL(items.libraryID, " + userLibraryID + ") AS itemLibraryID "
						+ "FROM tags NATURAL JOIN itemTags JOIN items USING (itemID) "
						+ "WHERE IFNULL(tags.libraryID, " + userLibraryID + ") != IFNULL(items.libraryID, " + userLibraryID + ")",
					"DELETE FROM itemTags WHERE ROWID IN (SELECT tagRowID FROM tmpWrongLibraryTags)",
					"DROP TABLE tmpWrongLibraryTags"
				]
			],
			[
				"SELECT COUNT(*) FROM itemTags WHERE tagID IS NULL",
				"DELETE FROM itemTags WHERE tagID IS NULL",
			],
			[
				"SELECT COUNT(*) FROM itemAttachments WHERE charsetID='NULL'",
				"UPDATE itemAttachments SET charsetID=NULL WHERE charsetID='NULL'",
			],
			
			// Reported by one user
			// http://forums.zotero.org/discussion/19347/continual-synching-error-message/
			// TODO: check 'libraries', not 'groups', but first add a
			// migration step to delete 'libraries' rows not in 'groups'
			//"SELECT COUNT(*) FROM syncDeleteLog WHERE libraryID != 0 AND libraryID NOT IN (SELECT libraryID FROM libraries)"
			[
				"SELECT COUNT(*) FROM syncDeleteLog WHERE libraryID != " + userLibraryID + " AND libraryID NOT IN (SELECT libraryID FROM groups)",
				"DELETE FROM syncDeleteLog WHERE libraryID != " + userLibraryID + " AND libraryID NOT IN (SELECT libraryID FROM libraries)",
			],
			
			
			// Delete empty creators
			// This may cause itemCreator gaps, but that's better than empty creators
			[
				"SELECT COUNT(*) FROM creators WHERE firstName='' AND lastName=''",
				"DELETE FROM creators WHERE firstName='' AND lastName=''"
			],
			
			// Non-attachment items in the full-text index
			[
				"SELECT COUNT(*) FROM fulltextItemWords WHERE itemID NOT IN (SELECT itemID FROM items WHERE itemTypeID=14)",
				[
					"DELETE FROM fulltextItemWords WHERE itemID NOT IN (SELECT itemID FROM items WHERE itemTypeID=14)",
					"SELECT 1"
				]
			],
			[
				"SELECT COUNT(*) FROM fulltextItems WHERE itemID NOT IN (SELECT itemID FROM items WHERE itemTypeID=14)",
				"DELETE FROM fulltextItems WHERE itemID NOT IN (SELECT itemID FROM items WHERE itemTypeID=14)"
			],
			[
				"SELECT COUNT(*) FROM syncedSettings WHERE libraryID != " + userLibraryID + " AND libraryID NOT IN (SELECT libraryID FROM libraries)",
				"DELETE FROM syncedSettings WHERE libraryID != " + userLibraryID + " AND libraryID NOT IN (SELECT libraryID FROM libraries)"
			]
		];
		
		for each(var sql in queries) {
			let errorsFound = yield Zotero.DB.valueQueryAsync(sql[0]);
			if (!errorsFound) {
				continue;
			}
			
			Zotero.debug("Test failed!", 1);
			
			if (fix) {
				try {
					// Single query
					if (typeof sql[1] == 'string') {
						yield Zotero.DB.queryAsync(sql[1]);
					}
					// Multiple queries
					else {
						for each(var s in sql[1]) {
							yield Zotero.DB.queryAsync(s);
						}
					}
					continue;
				}
				catch (e) {
					Zotero.debug(e);
					Components.utils.reportError(e);
				}
			}
			
			return false;
		}
		
		return true;
	});
	
	
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
		
		return Zotero.File.getContentsFromURLAsync("resource://zotero/schema/" + schema + ".sql");
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
	function _initializeSchema(){
		return Zotero.DB.executeTransaction(function* (conn) {
			var userLibraryID = 1;
			
			// Enable auto-vacuuming
			yield Zotero.DB.queryAsync("PRAGMA page_size = 4096");
			yield Zotero.DB.queryAsync("PRAGMA encoding = 'UTF-8'");
			yield Zotero.DB.queryAsync("PRAGMA auto_vacuum = 1");
			
			yield _getSchemaSQL('system').then(function (sql) {
				return Zotero.DB.executeSQLFile(sql);
			});
			yield _getSchemaSQL('userdata').then(function (sql) {
				return Zotero.DB.executeSQLFile(sql);
			});
			yield _getSchemaSQL('triggers').then(function (sql) {
				return Zotero.DB.executeSQLFile(sql);
			});
			yield _updateCustomTables(true);
			
			yield _getSchemaSQLVersion('system').then(function (version) {
				return _updateDBVersion('system', version);
			});
			yield _getSchemaSQLVersion('userdata').then(function (version) {
				return _updateDBVersion('userdata', version);
			});
			yield _getSchemaSQLVersion('triggers').then(function (version) {
				return _updateDBVersion('triggers', version);
			});
			yield _updateDBVersion('compatibility', _maxCompatibility);
			
			var sql = "INSERT INTO libraries (libraryID, libraryType, editable, filesEditable) "
				+ "VALUES "
				+ "(?, 'user', 1, 1), "
				+ "(4, 'publications', 1, 1)"
			yield Zotero.DB.queryAsync(sql, userLibraryID);
			
			if (!Zotero.Schema.skipDefaultData) {
				// Quick Start Guide web page item
				var sql = "INSERT INTO items VALUES(1, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, 'ABCD2345', 0, 0)";
				yield Zotero.DB.queryAsync(sql, userLibraryID);
				var sql = "INSERT INTO itemDataValues VALUES (1, ?)";
				yield Zotero.DB.queryAsync(sql, Zotero.getString('install.quickStartGuide'));
				var sql = "INSERT INTO itemData VALUES (1, 110, 1)";
				yield Zotero.DB.queryAsync(sql);
				var sql = "INSERT INTO itemDataValues VALUES (2, 'https://www.zotero.org/support/quick_start_guide')";
				yield Zotero.DB.queryAsync(sql);
				var sql = "INSERT INTO itemData VALUES (1, 1, 2)";
				yield Zotero.DB.queryAsync(sql);
				
				// CHNM as creator
				var sql = "INSERT INTO creators VALUES (1, '', 'Center for History and New Media', 1)";
				yield Zotero.DB.queryAsync(sql);
				var sql = "INSERT INTO itemCreators VALUES (1, 1, 1, 0)";
				yield Zotero.DB.queryAsync(sql);
				
				// Welcome note
				var sql = "INSERT INTO items VALUES(2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, 'ABCD3456', 0, 0)";
				yield Zotero.DB.queryAsync(sql, userLibraryID);
				var welcomeTitle = Zotero.getString('install.quickStartGuide.message.welcome');
				var welcomeMsg = '<div class="zotero-note znv1"><p><strong>' + welcomeTitle + '</strong></p>'
					+ '<p>' + Zotero.getString('install.quickStartGuide.message.view') + '</p>'
					+ '<p>' + Zotero.getString('install.quickStartGuide.message.thanks') + '</p></div>';
				var sql = "INSERT INTO itemNotes VALUES (2, 1, ?, ?)";
				yield Zotero.DB.queryAsync(sql, [welcomeMsg, welcomeTitle]);
			}
			
			self.dbInitialized = true;
		})
		.catch(function (e) {
			Zotero.debug(e, 1);
			Components.utils.reportError(e);
			let ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Components.interfaces.nsIPromptService);
			ps.alert(null, Zotero.getString('general.error'), Zotero.getString('startupError'));
			throw e;
		});
	}
	
	
	/*
	 * Update a DB schema version tag in an existing database
	 */
	function _updateDBVersion(schema, version) {
		_dbVersions[schema] = version;
		var sql = "REPLACE INTO version (schema,version) VALUES (?,?)";
		return Zotero.DB.queryAsync(sql, [schema, parseInt(version)]);
	}
	
	
	function _updateSchema(schema){
		return Zotero.Promise.all([Zotero.Schema.getDBVersion(schema), _getSchemaSQLVersion(schema)])
		.spread(function (dbVersion, schemaVersion) {
			if (dbVersion == schemaVersion) {
				return false;
			}
			else if (dbVersion < schemaVersion) {
				return _getSchemaSQL(schema)
				.then(function (sql) {
					return Zotero.DB.executeSQLFile(sql);
				})
				.then(function () {
					return _updateDBVersion(schema, schemaVersion);
				});
			}
			
			throw new Error("Zotero '" + schema + "' DB version (" + dbVersion
				+ ") is newer than SQL file (" + schemaVersion + ")");
		});
	}
	
	
	/**
	 * Process the response from the repository
	 *
	 * @return {Promise:Boolean} A promise for whether the update suceeded
	 **/
	function _updateFromRepositoryCallback(xmlhttp, manual) {
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
			
			if (!manual){
				_setRepositoryTimer(ZOTERO_CONFIG['REPOSITORY_RETRY_INTERVAL']);
			}
			
			return Zotero.Promise.resolve(false);
		}
		
		var currentTime = xmlhttp.responseXML.
			getElementsByTagName('currentTime')[0].firstChild.nodeValue;
		var lastCheckTime = Math.round(new Date().getTime()/1000);
		var translatorUpdates = xmlhttp.responseXML.getElementsByTagName('translator');
		var styleUpdates = xmlhttp.responseXML.getElementsByTagName('style');
		
		var updatePDFTools = function () {
			// No updates for PPC
			if (Zotero.platform == 'MacPPC') return;
			
			let pdfToolsUpdates = xmlhttp.responseXML.getElementsByTagName('pdftools');
			if (pdfToolsUpdates.length) {
				let availableVersion = pdfToolsUpdates[0].getAttribute('version');
				let installInfo = false;
				let installConverter = false;
				
				// Don't auto-install if not installed
				if (!Zotero.Fulltext.pdfInfoIsRegistered() && !Zotero.Fulltext.pdfConverterIsRegistered()) {
					return;
				}
				
				// TEMP
				if (Zotero.isWin) {
					if (Zotero.Fulltext.pdfInfoIsRegistered()) {
						if (Zotero.Fulltext.pdfInfoVersion != '3.02a') {
							installInfo = true;
						}
					}
					// Install missing component if one is installed
					else if (Zotero.Fulltext.pdfConverterIsRegistered()) {
						installInfo = true;
					}
					if (Zotero.Fulltext.pdfConverterIsRegistered()) {
						if (Zotero.Fulltext.pdfConverterVersion != '3.02a') {
							installConverter = true;
						}
					}
					// Install missing component if one is installed
					else if (Zotero.Fulltext.pdfInfoIsRegistered()) {
						installConverter = true;
					}
					availableVersion = '3.02';
				}
				else {
					if (Zotero.Fulltext.pdfInfoIsRegistered()) {
						let currentVersion = Zotero.Fulltext.pdfInfoVersion;
						if (currentVersion < availableVersion || currentVersion.startsWith('3.02')
								|| currentVersion == 'UNKNOWN') {
							installInfo = true;
						}
					}
					// Install missing component if one is installed
					else if (Zotero.Fulltext.pdfConverterIsRegistered()) {
						installInfo = true;
					}
					if (Zotero.Fulltext.pdfConverterIsRegistered()) {
						let currentVersion = Zotero.Fulltext.pdfConverterVersion;
						if (currentVersion < availableVersion || currentVersion.startsWith('3.02')
								|| currentVersion == 'UNKNOWN') {
							installConverter = true;
						}
					}
					// Install missing component if one is installed
					else if (Zotero.Fulltext.pdfInfoIsRegistered()) {
						installConverter = true;
					}
				}
				
				let prefKey = 'pdfToolsInstallError';
				let lastTry = 0, delay = 43200000; // half a day, so doubles to a day initially
				try {
					[lastTry, delay] = Zotero.Prefs.get(prefKey).split(';');
				}
				catch (e) {}
				
				// Allow an additional minute, since repo updates might not be exact
				if (Date.now() < (parseInt(lastTry) + parseInt(delay) - 60000)) {
					Zotero.debug("Now enough time since last PDF tools installation failure -- skipping", 2);
					return;
				}
				
				var checkResult = function (success) {
					if (success) {
						try {
							Zotero.Prefs.clear(prefKey);
						}
						catch (e) {}
					}
					else {
						// Keep doubling delay, to a max of 1 week
						Zotero.Prefs.set(prefKey, Date.now() + ";" + Math.min(delay * 2, 7*24*60*60*1000));
						
						let msg = "Error downloading PDF tool";
						Zotero.debug(msg, 1);
						throw new Error(msg);
					}
				};
				
				if (installConverter && installInfo) {
					Zotero.Fulltext.downloadPDFTool('converter', availableVersion, function (success) {
						checkResult(success);
						Zotero.Fulltext.downloadPDFTool('info', availableVersion, checkResult);
					});
				}
				else if (installConverter) {
					Zotero.Fulltext.downloadPDFTool('converter', availableVersion, checkResult);
				}
				else if (installInfo) {
					Zotero.Fulltext.downloadPDFTool('info', availableVersion, checkResult);
				}
				else {
					Zotero.debug("PDF tools are up to date");
				}
			}
		};
		
		if (!translatorUpdates.length && !styleUpdates.length){
			return Zotero.DB.executeTransaction(function* (conn) {
				// Store the timestamp provided by the server
				yield _updateDBVersion('repository', currentTime);
				
				// And the local timestamp of the update time
				yield _updateDBVersion('lastcheck', lastCheckTime);
			})
			.then(function () {
				Zotero.debug('All translators and styles are up-to-date');
				if (!manual) {
					_setRepositoryTimer(ZOTERO_CONFIG['REPOSITORY_CHECK_INTERVAL']);
				}
				
				return Zotero.Promise.resolve(true);
			})
			.tap(function () {
				updatePDFTools();
			});
		}
		
		return Zotero.spawn(function* () {
			try {
				for (var i=0, len=translatorUpdates.length; i<len; i++){
					yield _translatorXMLToFile(translatorUpdates[i]);
				}
				
				for (var i=0, len=styleUpdates.length; i<len; i++){
					yield _styleXMLToFile(styleUpdates[i]);
				}
				
				// Rebuild caches
				yield Zotero.Translators.reinit();
				yield Zotero.Styles.reinit();
			}
			catch (e) {
				Zotero.debug(e, 1);
				if (!manual){
					_setRepositoryTimer(ZOTERO_CONFIG['REPOSITORY_RETRY_INTERVAL']);
				}
				return false;
			}
			
			return true;
		})
		.then(function (update) {
			if (!update) return false;
			
			return Zotero.DB.executeTransaction(function* (conn) {
				// Store the timestamp provided by the server
				yield _updateDBVersion('repository', currentTime);
				
				// And the local timestamp of the update time
				yield _updateDBVersion('lastcheck', lastCheckTime);
			})
			.then(function () {
				if (!manual) {
					_setRepositoryTimer(ZOTERO_CONFIG['REPOSITORY_CHECK_INTERVAL']);
				}
				
				return true;
			});
		})
		.tap(function () {
			updatePDFTools();
		});
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
					Zotero.Schema.updateFromRepository();
				}
			}, interval, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
		}
	}
	
	
	/**
	 * Traverse an XML translator node from the repository and
	 * update the local translators folder with the translator data
	 *
	 * @return {Promise}
	 */
	var _translatorXMLToFile = Zotero.Promise.coroutine(function* (xmlnode) {
		// Don't split >4K chunks into multiple nodes
		// https://bugzilla.mozilla.org/show_bug.cgi?id=194231
		xmlnode.normalize();
		var translatorID = xmlnode.getAttribute('id');
		var translator = Zotero.Translators.get(translatorID);
		
		// Delete local version of remote translators with priority 0
		if (xmlnode.getElementsByTagName('priority')[0].firstChild.nodeValue === "0") {
			if (translator && (yield OS.File.exists(translator.path))) {
				Zotero.debug("Deleting translator '" + translator.label + "'");
				yield OS.File.remove(translator.path);
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
	});
	
	
	/**
	 * Traverse an XML style node from the repository and
	 * update the local styles folder with the style data
	 */
	var _styleXMLToFile = Zotero.Promise.coroutine(function* (xmlnode) {
		// Don't split >4K chunks into multiple nodes
		// https://bugzilla.mozilla.org/show_bug.cgi?id=194231
		xmlnode.normalize();
		
		var uri = xmlnode.getAttribute('id');
		var shortName = uri.replace("http://www.zotero.org/styles/", "");
		
		// Delete local style if CSL code is empty
		if (!xmlnode.firstChild) {
			var style = Zotero.Styles.get(uri);
			if (style) {
				yield OS.File.remove(style.path);
			}
			return;
		}
		
		// Remove renamed styles, as instructed by the server
		var oldID = xmlnode.getAttribute('oldID');
		if (oldID) {
			var style = Zotero.Styles.get(oldID, true);
			if (style && (yield OS.File.exists(style.path))) {
				Zotero.debug("Deleting renamed style '" + oldID + "'");
				yield OS.File.remove(style.path);
			}
		}
		
		var str = xmlnode.firstChild.nodeValue;
		var style = Zotero.Styles.get(uri);
		if (style) {
			yield Zotero.File.removeIfExists(style.path);
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
			if (yield OS.File.exists(destFile)) {
				throw new Error("Different style with filename '" + matches[1]
					+ "' already exists");
			}
		}
		
		Zotero.debug("Saving style '" + uri + "'");
		return Zotero.File.putContentsAsync(destFile, str);
	});
	
	
	// TODO
	//
	// If libraryID set, make sure no relations still use a local user key, and then remove on-error code in sync.js
	
	var _migrateUserDataSchema = Zotero.Promise.coroutine(function* (fromVersion) {
		var toVersion = yield _getSchemaSQLVersion('userdata');
		
		if (fromVersion >= toVersion) {
			return false;
		}
		
		Zotero.debug('Updating user data tables from version ' + fromVersion + ' to ' + toVersion);
		
		Zotero.DB.requireTransaction();
		
		// Step through version changes until we reach the current version
		//
		// Each block performs the changes necessary to move from the
		// previous revision to that one.
		for (let i = fromVersion + 1; i <= toVersion; i++) {
			if (i == 80) {
				yield _updateDBVersion('compatibility', 1);
				
				yield Zotero.DB.queryAsync("ALTER TABLE libraries RENAME TO librariesOld");
				yield Zotero.DB.queryAsync("CREATE TABLE libraries (\n    libraryID INTEGER PRIMARY KEY,\n    libraryType TEXT NOT NULL,\n    editable INT NOT NULL,\n    filesEditable INT NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    lastsync INT NOT NULL DEFAULT 0\n)");
				yield Zotero.DB.queryAsync("INSERT INTO libraries (libraryID, libraryType, editable, filesEditable) VALUES (1, 'user', 1, 1)");
				yield Zotero.DB.queryAsync("INSERT INTO libraries (libraryID, libraryType, editable, filesEditable) VALUES (4, 'publications', 1, 1)");
				yield Zotero.DB.queryAsync("INSERT INTO libraries SELECT libraryID, libraryType, editable, filesEditable, 0, 0 FROM librariesOld JOIN groups USING (libraryID)");
				
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO syncObjectTypes VALUES (7, 'setting')");
				yield Zotero.DB.queryAsync("DELETE FROM version WHERE schema IN ('userdata2', 'userdata3')");
				
				yield Zotero.DB.queryAsync("CREATE TABLE syncCache (\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    syncObjectTypeID INT NOT NULL,\n    version INT NOT NULL,\n    data TEXT,\n    PRIMARY KEY (libraryID, key, syncObjectTypeID, version),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE,\n    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID)\n)");
				
				yield Zotero.DB.queryAsync("DROP TABLE translatorCache");
				yield Zotero.DB.queryAsync("CREATE TABLE translatorCache (\n    fileName TEXT PRIMARY KEY,\n    metadataJSON TEXT,\n    lastModifiedTime INT\n);");
				
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_annotations_itemID_itemAttachments_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_annotations_itemID_itemAttachments_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_annotations_itemID_itemAttachments_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemAttachments_itemID_annotations_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_collections_parentCollectionID_collections_collectionID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_collections_parentCollectionID_collections_collectionID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_collections_parentCollectionID_collections_collectionID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_collections_collectionID_collections_parentCollectionID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_collectionItems_collectionID_collections_collectionID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_collectionItems_collectionID_collections_collectionID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_collectionItems_collectionID_collections_collectionID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_collections_collectionID_collectionItems_collectionID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_collectionItems_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_collectionItems_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_collectionItems_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_collectionItems_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_creators_creatorDataID_creatorData_creatorDataID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_creators_creatorDataID_creatorData_creatorDataID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_creators_creatorDataID_creatorData_creatorDataID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_creatorData_creatorDataID_creators_creatorDataID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_customBaseFieldMappings_customItemTypeID_customItemTypes_customItemTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customItemTypes_customItemTypeID_customBaseFieldMappings_customItemTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_customBaseFieldMappings_baseFieldID_fields_fieldID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customBaseFieldMappings_baseFieldID_fields_fieldID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_customBaseFieldMappings_customFieldID_customFields_customFieldID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customBaseFieldMappings_customFieldID_customFields_customFieldID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_customBaseFieldMappings_customFieldID_customFields_customFieldID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customFields_customFieldID_customBaseFieldMappings_customFieldID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_customItemTypeFields_customItemTypeID_customItemTypes_customItemTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customItemTypes_customItemTypeID_customItemTypeFields_customItemTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_customItemTypeFields_fieldID_fields_fieldID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customItemTypeFields_fieldID_fields_fieldID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customItemTypeFields_customFieldID_customFields_customFieldID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_customItemTypeFields_customFieldID_customFields_customFieldID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_customFields_customFieldID_customItemTypeFields_customFieldID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_fulltextItems_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_fulltextItems_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_fulltextItems_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_fulltextItems_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_fulltextItemWords_wordID_fulltextWords_wordID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_fulltextItemWords_wordID_fulltextWords_wordID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_fulltextItemWords_wordID_fulltextWords_wordID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_fulltextWords_wordID_fulltextItemWords_wordID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_fulltextItemWords_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_fulltextItemWords_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_fulltextItemWords_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_fulltextItemWords_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_groups_libraryID_libraries_libraryID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_groups_libraryID_libraries_libraryID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_groups_libraryID_libraries_libraryID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_libraries_libraryID_groups_libraryID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_groupItems_createdByUserID_users_userID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_groupItems_createdByUserID_users_userID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_groupItems_createdByUserID_users_userID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_users_userID_groupItems_createdByUserID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_groupItems_lastModifiedByUserID_users_userID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_groupItems_lastModifiedByUserID_users_userID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_groupItems_lastModifiedByUserID_users_userID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_users_userID_groupItems_lastModifiedByUserID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_highlights_itemID_itemAttachments_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_highlights_itemID_itemAttachments_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_highlights_itemID_itemAttachments_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemAttachments_itemID_highlights_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemAttachments_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemAttachments_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemAttachments_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemAttachments_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemAttachments_sourceItemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemAttachments_sourceItemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemAttachments_sourceItemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemAttachments_sourceItemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemCreators_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemCreators_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemCreators_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemCreators_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemCreators_creatorID_creators_creatorID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemCreators_creatorID_creators_creatorID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemCreators_creatorID_creators_creatorID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_creators_creatorID_itemCreators_creatorID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemCreators_creatorTypeID_creatorTypes_creatorTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemCreators_creatorTypeID_creatorTypes_creatorTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemCreators_creatorTypeID_creatorTypes_creatorTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_creatorTypes_creatorTypeID_itemCreators_creatorTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemCreators_libraryID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemCreators_libraryID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemData_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemData_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemData_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemData_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemData_fieldID_fields_fieldID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemData_fieldID_fields_fieldID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemData_valueID_itemDataValues_valueID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemData_valueID_itemDataValues_valueID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemData_valueID_itemDataValues_valueID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemDataValues_valueID_itemData_valueID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemNotes_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemNotes_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemNotes_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemNotes_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemNotes_sourceItemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemNotes_sourceItemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemNotes_sourceItemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemNotes_sourceItemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_items_libraryID_libraries_libraryID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_libraryID_libraries_libraryID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_items_libraryID_libraries_libraryID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_libraries_libraryID_items_libraryID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemSeeAlso_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemSeeAlso_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemSeeAlso_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemSeeAlso_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemSeeAlso_linkedItemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemSeeAlso_linkedItemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemSeeAlso_linkedItemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_itemSeeAlso_linkedItemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemTags_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemTags_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemTags_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_items_itemID_itemTags_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_itemTags_tagID_tags_tagID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_itemTags_tagID_tags_tagID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_itemTags_tagID_tags_tagID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_tags_tagID_itemTags_tagID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_savedSearchConditions_savedSearchID_savedSearches_savedSearchID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_savedSearchConditions_savedSearchID_savedSearches_savedSearchID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_savedSearchConditions_savedSearchID_savedSearches_savedSearchID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_savedSearches_savedSearchID_savedSearchConditions_savedSearchID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_deletedItems_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_deletedItems_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_deletedItems_itemID_items_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_items_itemID_deletedItems_itemID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_syncDeleteLog_syncObjectTypeID_syncObjectTypes_syncObjectTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_syncObjectTypes_syncObjectTypeID_syncDeleteLog_syncObjectTypeID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fki_proxyHosts_proxyID_proxies_proxyID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_proxyHosts_proxyID_proxies_proxyID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fkd_proxyHosts_proxyID_proxies_proxyID");
				yield Zotero.DB.queryAsync("DROP TRIGGER IF EXISTS fku_proxies_proxyID_proxyHosts_proxyID");
				
				yield Zotero.DB.queryAsync("ALTER TABLE collections RENAME TO collectionsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE collections (\n    collectionID INTEGER PRIMARY KEY,\n    collectionName TEXT NOT NULL,\n    parentCollectionID INT DEFAULT NULL,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    UNIQUE (libraryID, key),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE,\n    FOREIGN KEY (parentCollectionID) REFERENCES collections(collectionID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO collections SELECT collectionID, collectionName, parentCollectionID, clientDateModified, IFNULL(libraryID, 1), key, 0, 0 FROM collectionsOld ORDER BY collectionID DESC");
				yield Zotero.DB.queryAsync("CREATE INDEX collections_synced ON collections(synced)");
				
				yield Zotero.DB.queryAsync("ALTER TABLE items RENAME TO itemsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE items (\n    itemID INTEGER PRIMARY KEY,\n    itemTypeID INT NOT NULL,\n    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    UNIQUE (libraryID, key),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO items SELECT itemID, itemTypeID, dateAdded, dateModified, clientDateModified, IFNULL(libraryID, 1), key, 0, 0 FROM itemsOld ORDER BY dateAdded DESC");
				yield Zotero.DB.queryAsync("CREATE INDEX items_synced ON items(synced)");
				
				yield Zotero.DB.queryAsync("ALTER TABLE creators RENAME TO creatorsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE creators (\n    creatorID INTEGER PRIMARY KEY,\n    firstName TEXT,\n    lastName TEXT,\n    fieldMode INT,\n    UNIQUE (lastName, firstName, fieldMode)\n)");
				yield Zotero.DB.queryAsync("INSERT INTO creators SELECT creatorDataID, firstName, lastName, fieldMode FROM creatorData");
				yield Zotero.DB.queryAsync("ALTER TABLE itemCreators RENAME TO itemCreatorsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE itemCreators (\n    itemID INT NOT NULL,\n    creatorID INT NOT NULL,\n    creatorTypeID INT NOT NULL DEFAULT 1,\n    orderIndex INT NOT NULL DEFAULT 0,\n    PRIMARY KEY (itemID, creatorID, creatorTypeID, orderIndex),\n    UNIQUE (itemID, orderIndex),\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (creatorID) REFERENCES creators(creatorID) ON DELETE CASCADE,\n    FOREIGN KEY (creatorTypeID) REFERENCES creatorTypes(creatorTypeID)\n)");
				yield Zotero.DB.queryAsync("CREATE INDEX itemCreators_creatorTypeID ON itemCreators(creatorTypeID)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemCreators SELECT itemID, C.creatorID, creatorTypeID, orderIndex FROM itemCreatorsOld ICO JOIN creatorsOld CO USING (creatorID) JOIN creators C ON (CO.creatorDataID=C.creatorID)");
				
				yield Zotero.DB.queryAsync("ALTER TABLE savedSearches RENAME TO savedSearchesOld");
				yield Zotero.DB.queryAsync("CREATE TABLE savedSearches (\n    savedSearchID INTEGER PRIMARY KEY,\n    savedSearchName TEXT NOT NULL,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    UNIQUE (libraryID, key),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO savedSearches SELECT savedSearchID, savedSearchName, clientDateModified, IFNULL(libraryID, 1), key, 0, 0 FROM savedSearchesOld ORDER BY savedSearchID DESC");
				yield Zotero.DB.queryAsync("CREATE INDEX savedSearches_synced ON savedSearches(synced)");
				
				yield Zotero.DB.queryAsync("ALTER TABLE tags RENAME TO tagsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE tags (\n    tagID INTEGER PRIMARY KEY,\n    name TEXT NOT NULL UNIQUE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO tags SELECT tagID, name FROM tagsOld");
				yield Zotero.DB.queryAsync("ALTER TABLE itemTags RENAME TO itemTagsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE itemTags (\n    itemID INT NOT NULL,\n    tagID INT NOT NULL,\n    type INT NOT NULL,\n    PRIMARY KEY (itemID, tagID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (tagID) REFERENCES tags(tagID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemTags SELECT itemID, T.tagID, TOld.type FROM itemTagsOld ITO JOIN tagsOld TOld USING (tagID) JOIN tags T ON (TOld.name=T.name COLLATE BINARY)");
				yield Zotero.DB.queryAsync("DROP INDEX IF EXISTS itemTags_tagID");
				yield Zotero.DB.queryAsync("CREATE INDEX itemTags_tagID ON itemTags(tagID)");
				
				yield Zotero.DB.queryAsync("CREATE TABLE IF NOT EXISTS syncedSettings (\n    setting TEXT NOT NULL,\n    libraryID INT NOT NULL,\n    value NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    PRIMARY KEY (setting, libraryID)\n)");
				yield Zotero.DB.queryAsync("ALTER TABLE syncedSettings RENAME TO syncedSettingsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE syncedSettings (\n    setting TEXT NOT NULL,\n    libraryID INT NOT NULL,\n    value NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    PRIMARY KEY (setting, libraryID),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("UPDATE syncedSettingsOld SET libraryID=1 WHERE libraryID=0");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO syncedSettings SELECT * FROM syncedSettingsOld");
				
				yield Zotero.DB.queryAsync("ALTER TABLE itemData RENAME TO itemDataOld");
				yield Zotero.DB.queryAsync("CREATE TABLE itemData (\n    itemID INT,\n    fieldID INT,\n    valueID,\n    PRIMARY KEY (itemID, fieldID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (fieldID) REFERENCES fieldsCombined(fieldID),\n    FOREIGN KEY (valueID) REFERENCES itemDataValues(valueID)\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemData SELECT * FROM itemDataOld");
				yield Zotero.DB.queryAsync("DROP INDEX IF EXISTS itemData_fieldID");
				yield Zotero.DB.queryAsync("CREATE INDEX itemData_fieldID ON itemData(fieldID)");
				
				yield Zotero.DB.queryAsync("ALTER TABLE itemNotes RENAME TO itemNotesOld");
				yield Zotero.DB.queryAsync("CREATE TABLE itemNotes (\n    itemID INTEGER PRIMARY KEY,\n    parentItemID INT,\n    note TEXT,\n    title TEXT,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (parentItemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemNotes SELECT * FROM itemNotesOld");
				yield Zotero.DB.queryAsync("CREATE INDEX itemNotes_parentItemID ON itemNotes(parentItemID)");
				
				yield Zotero.DB.queryAsync("CREATE TEMPORARY TABLE charsetsOld (charsetID INT, charset UNIQUE, canonical, PRIMARY KEY (charsetID))");
				yield Zotero.DB.queryAsync("INSERT INTO charsetsOld VALUES (1,'utf-8','utf-8'), (2,'ascii','windows-1252'), (3,'windows-1250','windows-1250'), (4,'windows-1251','windows-1251'), (5,'windows-1252','windows-1252'), (6,'windows-1253','windows-1253'), (7,'windows-1254','windows-1254'), (8,'windows-1257','windows-1257'), (9,'us',NULL), (10,'us-ascii','windows-1252'), (11,'utf-7',NULL), (12,'iso8859-1','windows-1252'), (13,'iso8859-15','iso-8859-15'), (14,'iso_646.irv:1991',NULL), (15,'iso_8859-1','windows-1252'), (16,'iso_8859-1:1987','windows-1252'), (17,'iso_8859-2','iso-8859-2'), (18,'iso_8859-2:1987','iso-8859-2'), (19,'iso_8859-4','iso-8859-4'), (20,'iso_8859-4:1988','iso-8859-4'), (21,'iso_8859-5','iso-8859-5'), (22,'iso_8859-5:1988','iso-8859-5'), (23,'iso_8859-7','iso-8859-7'), (24,'iso_8859-7:1987','iso-8859-7'), (25,'iso-8859-1','windows-1252'), (26,'iso-8859-1-windows-3.0-latin-1',NULL), (27,'iso-8859-1-windows-3.1-latin-1',NULL), (28,'iso-8859-15','iso-8859-15'), (29,'iso-8859-2','iso-8859-2'), (30,'iso-8859-2-windows-latin-2',NULL), (31,'iso-8859-3','iso-8859-3'), (32,'iso-8859-4','iso-8859-4'), (33,'iso-8859-5','iso-8859-5'), (34,'iso-8859-5-windows-latin-5',NULL), (35,'iso-8859-6','iso-8859-6'), (36,'iso-8859-7','iso-8859-7'), (37,'iso-8859-8','iso-8859-8'), (38,'iso-8859-9','windows-1254'), (39,'l1','windows-1252'), (40,'l2','iso-8859-2'), (41,'l4','iso-8859-4'), (42,'latin1','windows-1252'), (43,'latin2','iso-8859-2'), (44,'latin4','iso-8859-4'), (45,'x-mac-ce',NULL), (46,'x-mac-cyrillic','x-mac-cyrillic'), (47,'x-mac-greek',NULL), (48,'x-mac-roman','macintosh'), (49,'x-mac-turkish',NULL), (50,'adobe-symbol-encoding',NULL), (51,'ansi_x3.4-1968','windows-1252'), (52,'ansi_x3.4-1986',NULL), (53,'big5','big5'), (54,'chinese','gbk'), (55,'cn-big5','big5'), (56,'cn-gb',NULL), (57,'cn-gb-isoir165',NULL), (58,'cp367',NULL), (59,'cp819','windows-1252'), (60,'cp850',NULL), (61,'cp852',NULL), (62,'cp855',NULL), (63,'cp857',NULL), (64,'cp862',NULL), (65,'cp864',NULL), (66,'cp866','ibm866'), (67,'csascii',NULL), (68,'csbig5','big5'), (69,'cseuckr','euc-kr'), (70,'cseucpkdfmtjapanese','euc-jp'), (71,'csgb2312','gbk'), (72,'cshalfwidthkatakana',NULL), (73,'cshppsmath',NULL), (74,'csiso103t618bit',NULL), (75,'csiso159jisx02121990',NULL), (76,'csiso2022jp','iso-2022-jp'), (77,'csiso2022jp2',NULL), (78,'csiso2022kr','replacement'), (79,'csiso58gb231280','gbk'), (80,'csisolatin4','iso-8859-4'), (81,'csisolatincyrillic','iso-8859-5'), (82,'csisolatingreek','iso-8859-7'), (83,'cskoi8r','koi8-r'), (84,'csksc56011987','euc-kr'), (85,'csshiftjis','shift_jis'), (86,'csunicode11',NULL), (87,'csunicode11utf7',NULL), (88,'csunicodeascii',NULL), (89,'csunicodelatin1',NULL), (90,'cswindows31latin5',NULL), (91,'cyrillic','iso-8859-5'), (92,'ecma-118','iso-8859-7'), (93,'elot_928','iso-8859-7'), (94,'euc-jp','euc-jp'), (95,'euc-kr','euc-kr'), (96,'extended_unix_code_packed_format_for_japanese',NULL), (97,'gb2312','gbk'), (98,'gb_2312-80','gbk'), (99,'greek','iso-8859-7'), (100,'greek8','iso-8859-7'), (101,'hz-gb-2312','replacement'), (102,'ibm367',NULL), (103,'ibm819','windows-1252'), (104,'ibm850',NULL), (105,'ibm852',NULL), (106,'ibm855',NULL), (107,'ibm857',NULL), (108,'ibm862',NULL), (109,'ibm864',NULL), (110,'ibm866','ibm866'), (111,'iso-10646',NULL), (112,'iso-10646-j-1',NULL), (113,'iso-10646-ucs-2',NULL), (114,'iso-10646-ucs-4',NULL), (115,'iso-10646-ucs-basic',NULL), (116,'iso-10646-unicode-latin1',NULL), (117,'iso-2022-jp','iso-2022-jp'), (118,'iso-2022-jp-2',NULL), (119,'iso-2022-kr','replacement'), (120,'iso-ir-100','windows-1252'), (121,'iso-ir-101','iso-8859-2'), (122,'iso-ir-103',NULL), (123,'iso-ir-110','iso-8859-4'), (124,'iso-ir-126','iso-8859-7'), (125,'iso-ir-144','iso-8859-5'), (126,'iso-ir-149','euc-kr'), (127,'iso-ir-159',NULL), (128,'iso-ir-58','gbk'), (129,'iso-ir-6',NULL), (130,'iso646-us',NULL), (131,'jis_x0201',NULL), (132,'jis_x0208-1983',NULL), (133,'jis_x0212-1990',NULL), (134,'koi8-r','koi8-r'), (135,'korean','euc-kr'), (136,'ks_c_5601',NULL), (137,'ks_c_5601-1987','euc-kr'), (138,'ks_c_5601-1989','euc-kr'), (139,'ksc5601','euc-kr'), (140,'ksc_5601','euc-kr'), (141,'ms_kanji','shift_jis'), (142,'shift_jis','shift_jis'), (143,'t.61',NULL), (144,'t.61-8bit',NULL), (145,'unicode-1-1-utf-7',NULL), (146,'unicode-1-1-utf-8','utf-8'), (147,'unicode-2-0-utf-7',NULL), (148,'windows-31j','shift_jis'), (149,'x-cns11643-1',NULL), (150,'x-cns11643-1110',NULL), (151,'x-cns11643-2',NULL), (152,'x-cp1250','windows-1250'), (153,'x-cp1251','windows-1251'), (154,'x-cp1253','windows-1253'), (155,'x-dectech',NULL), (156,'x-dingbats',NULL), (157,'x-euc-jp','euc-jp'), (158,'x-euc-tw',NULL), (159,'x-gb2312-11',NULL), (160,'x-imap4-modified-utf7',NULL), (161,'x-jisx0208-11',NULL), (162,'x-ksc5601-11',NULL), (163,'x-sjis','shift_jis'), (164,'x-tis620',NULL), (165,'x-unicode-2-0-utf-7',NULL), (166,'x-x-big5','big5'), (167,'x0201',NULL), (168,'x0212',NULL)");
				yield Zotero.DB.queryAsync("CREATE INDEX charsetsOld_canonical ON charsetsOld(canonical)");
				
				yield Zotero.DB.queryAsync("ALTER TABLE itemAttachments RENAME TO itemAttachmentsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE itemAttachments (\n    itemID INTEGER PRIMARY KEY,\n    parentItemID INT,\n    linkMode INT,\n    contentType TEXT,\n    charsetID INT,\n    path TEXT,\n    syncState INT DEFAULT 0,\n    storageModTime INT,\n    storageHash TEXT,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (parentItemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (charsetID) REFERENCES charsets(charsetID) ON DELETE SET NULL\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemAttachments SELECT itemID, sourceItemID, linkMode, mimeType, C.charsetID, path, syncState, storageModTime, storageHash FROM itemAttachmentsOld IA LEFT JOIN charsetsOld CO ON (IA.charsetID=CO.charsetID) LEFT JOIN charsets C ON (CO.canonical=C.charset)");
				yield Zotero.DB.queryAsync("CREATE INDEX itemAttachments_parentItemID ON itemAttachments(parentItemID)");
				yield Zotero.DB.queryAsync("CREATE INDEX itemAttachments_charsetID ON itemAttachments(charsetID)");
				yield Zotero.DB.queryAsync("CREATE INDEX itemAttachments_contentType ON itemAttachments(contentType)");
				yield Zotero.DB.queryAsync("DROP INDEX IF EXISTS itemAttachments_syncState");
				yield Zotero.DB.queryAsync("CREATE INDEX itemAttachments_syncState ON itemAttachments(syncState)");
				
				yield Zotero.DB.queryAsync("ALTER TABLE collectionItems RENAME TO collectionItemsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE collectionItems (\n    collectionID INT NOT NULL,\n    itemID INT NOT NULL,\n    orderIndex INT NOT NULL DEFAULT 0,\n    PRIMARY KEY (collectionID, itemID),\n    FOREIGN KEY (collectionID) REFERENCES collections(collectionID) ON DELETE CASCADE,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO collectionItems SELECT * FROM collectionItemsOld");
				yield Zotero.DB.queryAsync("DROP INDEX IF EXISTS itemID"); // incorrect old name
				yield Zotero.DB.queryAsync("CREATE INDEX collectionItems_itemID ON collectionItems(itemID)");
				
				yield Zotero.DB.queryAsync("ALTER TABLE savedSearchConditions RENAME TO savedSearchConditionsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE savedSearchConditions (\n    savedSearchID INT NOT NULL,\n    searchConditionID INT NOT NULL,\n    condition TEXT NOT NULL,\n    operator TEXT,\n    value TEXT,\n    required NONE,\n    PRIMARY KEY (savedSearchID, searchConditionID),\n    FOREIGN KEY (savedSearchID) REFERENCES savedSearches(savedSearchID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO savedSearchConditions SELECT * FROM savedSearchConditionsOld");
				yield Zotero.DB.queryAsync("DROP TABLE savedSearchConditionsOld");
				
				yield Zotero.DB.queryAsync("ALTER TABLE deletedItems RENAME TO deletedItemsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE deletedItems (\n    itemID INTEGER PRIMARY KEY,\n    dateDeleted DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO deletedItems SELECT * FROM deletedItemsOld");
				yield Zotero.DB.queryAsync("DROP INDEX IF EXISTS deletedItems_dateDeleted");
				yield Zotero.DB.queryAsync("CREATE INDEX deletedItems_dateDeleted ON deletedItems(dateDeleted)");
				
				yield _migrateUserData_80_relations();
				
				yield Zotero.DB.queryAsync("ALTER TABLE groups RENAME TO groupsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE groups (\n    groupID INTEGER PRIMARY KEY,\n    libraryID INT NOT NULL UNIQUE,\n    name TEXT NOT NULL,\n    description TEXT NOT NULL,\n    version INT NOT NULL,\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO groups SELECT groupID, libraryID, name, description, 0 FROM groupsOld");
				
				yield Zotero.DB.queryAsync("ALTER TABLE groupItems RENAME TO groupItemsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE groupItems (\n    itemID INTEGER PRIMARY KEY,\n    createdByUserID INT,\n    lastModifiedByUserID INT,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (createdByUserID) REFERENCES users(userID) ON DELETE SET NULL,\n    FOREIGN KEY (lastModifiedByUserID) REFERENCES users(userID) ON DELETE SET NULL\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO groupItems SELECT * FROM groupItemsOld");
				
				let cols = yield Zotero.DB.getColumns('fulltextItems');
				if (cols.indexOf("synced") == -1) {
					Zotero.DB.queryAsync("ALTER TABLE fulltextItems ADD COLUMN synced INT DEFAULT 0");
					Zotero.DB.queryAsync("REPLACE INTO settings (setting, key, value) VALUES ('fulltext', 'downloadAll', 1)");
				}
				yield Zotero.DB.queryAsync("ALTER TABLE fulltextItems RENAME TO fulltextItemsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE fulltextItems (\n    itemID INTEGER PRIMARY KEY,\n    version INT,\n    indexedPages INT,\n    totalPages INT,\n    indexedChars INT,\n    totalChars INT,\n    synced INT DEFAULT 0,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO fulltextItems SELECT * FROM fulltextItemsOld");
				
				yield Zotero.DB.queryAsync("ALTER TABLE fulltextItemWords RENAME TO fulltextItemWordsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE fulltextItemWords (\n    wordID INT,\n    itemID INT,\n    PRIMARY KEY (wordID, itemID),\n    FOREIGN KEY (wordID) REFERENCES fulltextWords(wordID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO fulltextItemWords SELECT * FROM fulltextItemWordsOld");
				
				yield Zotero.DB.queryAsync("DROP INDEX IF EXISTS fulltextItems_version");
				yield Zotero.DB.queryAsync("DROP INDEX IF EXISTS fulltextItemWords_itemID");
				yield Zotero.DB.queryAsync("CREATE INDEX fulltextItems_version ON fulltextItems(version)");
				yield Zotero.DB.queryAsync("CREATE INDEX fulltextItemWords_itemID ON fulltextItemWords(itemID)");
				
				yield Zotero.DB.queryAsync("UPDATE syncDeleteLog SET libraryID=1 WHERE libraryID=0");
				yield Zotero.DB.queryAsync("ALTER TABLE syncDeleteLog RENAME TO syncDeleteLogOld");
				yield Zotero.DB.queryAsync("CREATE TABLE syncDeleteLog (\n    syncObjectTypeID INT NOT NULL,\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    synced INT NOT NULL DEFAULT 0,\n    UNIQUE (syncObjectTypeID, libraryID, key),\n    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO syncDeleteLog SELECT * FROM syncDeleteLogOld");
				yield Zotero.DB.queryAsync("DROP INDEX IF EXISTS syncDeleteLog_timestamp");
				yield Zotero.DB.queryAsync("CREATE INDEX syncDeleteLog_synced ON syncDeleteLog(synced)");
				
				yield Zotero.DB.queryAsync("ALTER TABLE storageDeleteLog RENAME TO storageDeleteLogOld");
				yield Zotero.DB.queryAsync("CREATE TABLE storageDeleteLog (\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    synced INT NOT NULL DEFAULT 0,\n    PRIMARY KEY (libraryID, key),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO storageDeleteLog SELECT * FROM storageDeleteLogOld");
				yield Zotero.DB.queryAsync("DROP INDEX IF EXISTS storageDeleteLog_timestamp");
				yield Zotero.DB.queryAsync("CREATE INDEX storageDeleteLog_synced ON storageDeleteLog(synced)");
				
				yield Zotero.DB.queryAsync("ALTER TABLE annotations RENAME TO annotationsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE annotations (\n    annotationID INTEGER PRIMARY KEY,\n    itemID INT NOT NULL,\n    parent TEXT,\n    textNode INT,\n    offset INT,\n    x INT,\n    y INT,\n    cols INT,\n    rows INT,\n    text TEXT,\n    collapsed BOOL,\n    dateModified DATE,\n    FOREIGN KEY (itemID) REFERENCES itemAttachments(itemID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO annotations SELECT * FROM annotationsOld");
				yield Zotero.DB.queryAsync("DROP INDEX IF EXISTS annotations_itemID");
				yield Zotero.DB.queryAsync("CREATE INDEX annotations_itemID ON annotations(itemID)");
				
				yield Zotero.DB.queryAsync("ALTER TABLE highlights RENAME TO highlightsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE highlights (\n    highlightID INTEGER PRIMARY KEY,\n    itemID INT NOT NULL,\n    startParent TEXT,\n    startTextNode INT,\n    startOffset INT,\n    endParent TEXT,\n    endTextNode INT,\n    endOffset INT,\n    dateModified DATE,\n    FOREIGN KEY (itemID) REFERENCES itemAttachments(itemID) ON DELETE CASCADE\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO highlights SELECT * FROM highlightsOld");
				yield Zotero.DB.queryAsync("DROP INDEX IF EXISTS highlights_itemID");
				yield Zotero.DB.queryAsync("CREATE INDEX highlights_itemID ON highlights(itemID)");
				
				yield Zotero.DB.queryAsync("ALTER TABLE customBaseFieldMappings RENAME TO customBaseFieldMappingsOld");
				yield Zotero.DB.queryAsync("CREATE TABLE customBaseFieldMappings (\n    customItemTypeID INT,\n    baseFieldID INT,\n    customFieldID INT,\n    PRIMARY KEY (customItemTypeID, baseFieldID, customFieldID),\n    FOREIGN KEY (customItemTypeID) REFERENCES customItemTypes(customItemTypeID),\n    FOREIGN KEY (baseFieldID) REFERENCES fields(fieldID),\n    FOREIGN KEY (customFieldID) REFERENCES customFields(customFieldID)\n)");
				yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO customBaseFieldMappings SELECT * FROM customBaseFieldMappingsOld");
				yield Zotero.DB.queryAsync("DROP INDEX IF EXISTS customBaseFieldMappings_baseFieldID");
				yield Zotero.DB.queryAsync("DROP INDEX IF EXISTS customBaseFieldMappings_customFieldID");
				yield Zotero.DB.queryAsync("CREATE INDEX customBaseFieldMappings_baseFieldID ON customBaseFieldMappings(baseFieldID)");
				yield Zotero.DB.queryAsync("CREATE INDEX customBaseFieldMappings_customFieldID ON customBaseFieldMappings(customFieldID)");
				
				yield Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='account' AND key='libraryID'");
				
				yield Zotero.DB.queryAsync("DROP TABLE annotationsOld");
				yield Zotero.DB.queryAsync("DROP TABLE collectionItemsOld");
				yield Zotero.DB.queryAsync("DROP TABLE charsetsOld");
				yield Zotero.DB.queryAsync("DROP TABLE customBaseFieldMappingsOld");
				yield Zotero.DB.queryAsync("DROP TABLE deletedItemsOld");
				yield Zotero.DB.queryAsync("DROP TABLE fulltextItemWordsOld");
				yield Zotero.DB.queryAsync("DROP TABLE fulltextItemsOld");
				yield Zotero.DB.queryAsync("DROP TABLE groupItemsOld");
				yield Zotero.DB.queryAsync("DROP TABLE groupsOld");
				yield Zotero.DB.queryAsync("DROP TABLE highlightsOld");
				yield Zotero.DB.queryAsync("DROP TABLE itemAttachmentsOld");
				yield Zotero.DB.queryAsync("DROP TABLE itemCreatorsOld");
				yield Zotero.DB.queryAsync("DROP TABLE itemDataOld");
				yield Zotero.DB.queryAsync("DROP TABLE itemNotesOld");
				yield Zotero.DB.queryAsync("DROP TABLE itemTagsOld");
				yield Zotero.DB.queryAsync("DROP TABLE savedSearchesOld");
				yield Zotero.DB.queryAsync("DROP TABLE storageDeleteLogOld");
				yield Zotero.DB.queryAsync("DROP TABLE syncDeleteLogOld");
				yield Zotero.DB.queryAsync("DROP TABLE syncedSettingsOld");
				yield Zotero.DB.queryAsync("DROP TABLE collectionsOld");
				yield Zotero.DB.queryAsync("DROP TABLE creatorsOld");
				yield Zotero.DB.queryAsync("DROP TABLE creatorData");
				yield Zotero.DB.queryAsync("DROP TABLE itemsOld");
				yield Zotero.DB.queryAsync("DROP TABLE tagsOld");
				yield Zotero.DB.queryAsync("DROP TABLE librariesOld");
			}
		}
		
		yield _updateDBVersion('userdata', toVersion);
		return true;
	});
	
	
	//
	// Longer functions for specific upgrade steps
	//
	var _migrateUserData_80_relations = Zotero.Promise.coroutine(function* () {
		yield Zotero.DB.queryAsync("CREATE TABLE relationPredicates (\n    predicateID INTEGER PRIMARY KEY,\n    predicate TEXT UNIQUE\n)");
		
		yield Zotero.DB.queryAsync("CREATE TABLE collectionRelations (\n    collectionID INT NOT NULL,\n    predicateID INT NOT NULL,\n    object TEXT NOT NULL,\n    PRIMARY KEY (collectionID, predicateID, object),\n    FOREIGN KEY (collectionID) REFERENCES collections(collectionID) ON DELETE CASCADE,\n    FOREIGN KEY (predicateID) REFERENCES relationPredicates(predicateID) ON DELETE CASCADE\n)");
		yield Zotero.DB.queryAsync("CREATE INDEX collectionRelations_predicateID ON collectionRelations(predicateID)");
		yield Zotero.DB.queryAsync("CREATE INDEX collectionRelations_object ON collectionRelations(object);");
		yield Zotero.DB.queryAsync("CREATE TABLE itemRelations (\n    itemID INT NOT NULL,\n    predicateID INT NOT NULL,\n    object TEXT NOT NULL,\n    PRIMARY KEY (itemID, predicateID, object),\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (predicateID) REFERENCES relationPredicates(predicateID) ON DELETE CASCADE\n)");
		yield Zotero.DB.queryAsync("CREATE INDEX itemRelations_predicateID ON itemRelations(predicateID)");
		yield Zotero.DB.queryAsync("CREATE INDEX itemRelations_object ON itemRelations(object);");
		
		yield Zotero.DB.queryAsync("UPDATE relations SET subject=object, predicate='dc:replaces', object=subject WHERE predicate='dc:isReplacedBy'");
		
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
		var resolveLibrary = Zotero.Promise.coroutine(function* (usersOrGroups, id) {
			if (usersOrGroups == 'users') return 1;
			if (groupLibraryIDMap[id] !== undefined) return groupLibraryIDMap[id];
			return groupLibraryIDMap[id] = (yield Zotero.DB.valueQueryAsync("SELECT libraryID FROM groups WHERE libraryID=?", id));
		});
		var predicateMap = {};
		var resolvePredicate = Zotero.Promise.coroutine(function* (predicate) {
			if (predicateMap[predicate]) return predicateMap[predicate];
			yield Zotero.DB.queryAsync("INSERT INTO relationPredicates (predicateID, predicate) VALUES (NULL, ?)", predicate);
			return predicateMap[predicate] = Zotero.DB.valueQueryAsync("SELECT predicateID FROM relationPredicates WHERE predicate=?", predicate);
		});
		while (true) {
			let rows = yield Zotero.DB.queryAsync("SELECT subject, predicate, object FROM relations LIMIT ?, ?", [start, limit]);
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
							Zotero.logError("No match for relation subject or object: " + concat);
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
							subjectLibraryID = (yield resolveLibrary(subjectMatch[1], subjectMatch[2])) || false;
							subjectType = subjectMatch[3];
						}
						if (objectMatch) {
							objectLibraryID = (yield resolveLibrary(objectMatch[1], objectMatch[2])) || false;
							objectType = objectMatch[3];
						}
						// Use subject if it's a user library or it isn't but neither is object, and if object can be found
						if (subjectLibraryID && (subjectLibraryID == 1 || objectLibraryID != 1)) {
							let key = subjectMatch[4];
							if (subjectType == 'collection') {
								let collectionID = yield Zotero.DB.valueQueryAsync("SELECT collectionID FROM collections WHERE libraryID=? AND key=?", [subjectLibraryID, key]);
								if (collectionID) {
									collectionRels.push([collectionID, row.predicate, row.object]);
									continue;
								}
							}
							else {
								let itemID = yield Zotero.DB.valueQueryAsync("SELECT itemID FROM items WHERE libraryID=? AND key=?", [subjectLibraryID, key]);
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
								let collectionID = yield Zotero.DB.valueQueryAsync("SELECT collectionID FROM collections WHERE libraryID=? AND key=?", [objectLibraryID, key]);
								if (collectionID) {
									collectionRels.push([collectionID, row.predicate, row.subject]);
									continue;
								}
							}
							else {
								let itemID = yield Zotero.DB.valueQueryAsync("SELECT itemID FROM items WHERE libraryID=? AND key=?", [objectLibraryID, key]);
								if (itemID) {
									itemRels.push([itemID, row.predicate, row.subject]);
									continue;
								}
							}
							Zotero.logError("Neither subject nor object found: " + concat);
							report += concat + "\n";
						}
						break;
					
					case 'dc:replaces':
						let match = row.subject.match(itemRE);
						if (!match) {
							Zotero.logError("Unrecognized subject: " + concat);
							report += concat + "\n";
							continue;
						}
						// Remove empty captured groups
						match = match.filter(x => x);
						let libraryID;
						// Users
						if (match[1] == 'users') {
							let itemID = yield Zotero.DB.valueQueryAsync("SELECT itemID FROM items WHERE libraryID=? AND key=?", [1, match[3]]);
							if (!itemID) {
								Zotero.logError("Subject not found: " + concat);
								report += concat + "\n";
								continue;
							}
							itemRels.push([itemID, row.predicate, row.object]);
						}
						// Groups
						else {
							let itemID = yield Zotero.DB.valueQueryAsync("SELECT itemID FROM items JOIN groups USING (libraryID) WHERE groupID=? AND key=?", [match[2], match[3]]);
							if (!itemID) {
								Zotero.logError("Subject not found: " + concat);
								report += concat + "\n";
								continue;
							}
							itemRels.push([itemID, row.predicate, row.object]);
						}
						break;
					
					default:
						Zotero.logError("Unknown predicate '" + row.predicate + "': " + concat);
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
					collectionRels[i][1] = yield resolvePredicate(collectionRels[i][1]);
				}
				yield Zotero.DB.queryAsync(collectionSQL + collectionRels.map(() => "(?, ?, ?)").join(", "), collectionRels.reduce((x, y) => x.concat(y)));
			}
			if (itemRels.length) {
				for (let i = 0; i < itemRels.length; i++) {
					itemRels[i][1] = yield resolvePredicate(itemRels[i][1]);
				}
				yield Zotero.DB.queryAsync(itemSQL + itemRels.map(() => "(?, ?, ?)").join(", "), itemRels.reduce((x, y) => x.concat(y)));
			}
			
			start += limit;
		}
		if (report.length) {
			report = "Removed relations:\n\n" + report;
			Zotero.debug(report);
		}
		yield Zotero.DB.queryAsync("DROP TABLE relations");
		
		//
		// Migrate related items
		//
		// If no user id and no local key, create a local key
		if (!(yield Zotero.DB.valueQueryAsync("SELECT value FROM settings WHERE setting='account' AND key='userID'"))
				&& !(yield Zotero.DB.valueQueryAsync("SELECT value FROM settings WHERE setting='account' AND key='localUserKey'"))) {
			yield Zotero.DB.queryAsync("INSERT INTO settings (setting, key, value) VALUES ('account', 'localUserKey', ?)", Zotero.randomString(8));
		}
		var predicateID = predicateMap["dc:relation"];
		if (!predicateID) {
			yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO relationPredicates VALUES (NULL, 'dc:relation')");
			predicateID = yield Zotero.DB.valueQueryAsync("SELECT predicateID FROM relationPredicates WHERE predicate=?", 'dc:relation');
		}
		yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemRelations SELECT ISA.itemID, " + predicateID + ", 'http://zotero.org/' || (CASE WHEN G.libraryID IS NULL THEN 'users/' || IFNULL((SELECT value FROM settings WHERE setting='account' AND key='userID'), (SELECT value FROM settings WHERE setting='account' AND key='localUserKey')) ELSE 'groups/' || G.groupID END) || '/' || I.key FROM itemSeeAlso ISA JOIN items I ON (ISA.linkedItemID=I.itemID) LEFT JOIN groups G USING (libraryID)");
		yield Zotero.DB.queryAsync("DROP TABLE itemSeeAlso");
	});
}
