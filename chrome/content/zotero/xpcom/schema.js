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
	this.updateSchema = function () {
		// TODO: Check database integrity first with Zotero.DB.integrityCheck()
		
		// 'userdata' is the last upgrade step run in _migrateUserDataSchema() based on the
		// version in the schema file. Upgrade steps may or may not break DB compatibility.
		//
		// 'compatibility' is incremented manually by upgrade steps in order to break DB
		// compatibility with older versions.
		return Zotero.Promise.all([this.getDBVersion('userdata'), this.getDBVersion('compatibility')])
		.spread(function (userdata, compatibility) {
			if (!userdata) {
				Zotero.debug('Database does not exist -- creating\n');
				return _initializeSchema().return(true);
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
			
			return _getSchemaSQLVersion('userdata')
			// If upgrading userdata, make backup of database first
			.then(function (schemaVersion) {
				if (userdata < schemaVersion) {
					return Zotero.DB.backupDatabase(userdata);
				}
			})
			.then(function () {
				return Zotero.DB.executeTransaction(function* (conn) {
					var updated = yield _updateSchema('system');
					
					// Update custom tables if they exist so that changes are in
					// place before user data migration
					if (Zotero.DB.tableExists('customItemTypes')) {
						yield Zotero.Schema.updateCustomTables(updated);
					}
					updated = yield _migrateUserDataSchema(userdata);
					yield _updateSchema('triggers');
					
					return updated;
				}.bind(this))
				.then(function (updated) {
					// Populate combined tables for custom types and fields
					// -- this is likely temporary
					//
					// We do this even if updated in case custom fields were
					// changed during user data migration
					return Zotero.Schema.updateCustomTables()
					.then(function () {
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
						
						// After a delay, start update of bundled files and repo updates
						//
						// **************
						// TEMP TEMP TEMP
						// **************
						//
						/*Zotero.initializationPromise
						.delay(5000)
						.then(function () Zotero.Schema.updateBundledFiles(null, false, true))
						.done();*/
						
						return updated;
					});
				});
			});
		});
	}
	
	
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
		yield Zotero.Schema.updateCustomTables();
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
	
	
	this.updateCustomTables = function (skipDelete, skipSystem) {
		return Zotero.DB.executeTransaction(function* (conn) {
			Zotero.debug("Updating custom tables");
			
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
	}
	
	
	/**
	 * Update styles and translators in data directory with versions from
	 * ZIP file (XPI) or directory (source) in extension directory
	 *
	 * @param	{String}	[mode]					'translators' or 'styles'
	 * @param	{Boolean}	[skipDeleteUpdated]		Skip updating of the file deleting version --
	 *												since deleting uses a single version table key,
	 * 												it should only be updated the last time through
	 * @return {Promise}
	 */
	this.updateBundledFiles = function(mode, skipDeleteUpdate, runRemoteUpdateWhenComplete) {
		if (_localUpdateInProgress) return Zotero.Promise.resolve();
		
		return Zotero.Promise.try(function () {
			_localUpdateInProgress = true;
			
			// Get path to addon and then call updateBundledFilesCallback
			
			// Synchronous in Standalone
			if (Zotero.isStandalone) {
				var jar = Components.classes["@mozilla.org/file/directory_service;1"]
					.getService(Components.interfaces.nsIProperties)
					.get("AChrom", Components.interfaces.nsIFile).parent;
				jar.append("zotero.jar");
				return _updateBundledFilesCallback(jar, mode, skipDeleteUpdate);
			}
			
			// Asynchronous in Firefox
			var deferred = Zotero.Promise.defer();
			Components.utils.import("resource://gre/modules/AddonManager.jsm");
			AddonManager.getAddonByID(
				ZOTERO_CONFIG['GUID'],
				function(addon) {
					var up = _updateBundledFilesCallback(
						addon.getResourceURI().QueryInterface(Components.interfaces.nsIFileURL).file,
						mode,
						skipDeleteUpdate
					);
					deferred.resolve(up);
				}
			);
			return deferred.promise;
		})
		.then(function (updated) {
			if (runRemoteUpdateWhenComplete) {
				if (updated) {
					if (Zotero.Prefs.get('automaticScraperUpdates')) {
						Zotero.unlockPromise
						.then(Zotero.proxyAuthComplete)
						.delay(1000)
						.then(function () Zotero.Schema.updateFromRepository(2))
						.done();
					}
				}
				else {
					Zotero.unlockPromise
					.then(Zotero.proxyAuthComplete)
					.delay(1000)
					.then(function () Zotero.Schema.updateFromRepository(false))
					.done();
				}
			}
		});
	}
	
	/**
	 * Callback to update bundled files, after finding the path to the Zotero install location
	 */
	function _updateBundledFilesCallback(installLocation, mode, skipDeleteUpdate) {
		_localUpdateInProgress = false;
		
		if (!mode) {
			var up1 = _updateBundledFilesCallback(installLocation, 'translators', true);
			var up2 = _updateBundledFilesCallback(installLocation, 'styles', false);
			return up1 || up2;
		}
		
		var xpiZipReader, isUnpacked = installLocation.isDirectory();
		if(!isUnpacked) {
			xpiZipReader = Components.classes["@mozilla.org/libjar/zip-reader;1"]
					.createInstance(Components.interfaces.nsIZipReader);
			xpiZipReader.open(installLocation);

			if(Zotero.isStandalone && !xpiZipReader.hasEntry("translators.index")) {
				// Symlinked dev Standalone build
				var installLocation2 = installLocation.parent,
					translatorsDir = installLocation2.clone();
				translatorsDir.append("translators");
				if(translatorsDir.exists()) {
					installLocation = installLocation2;
					isUnpacked = true;
					xpiZipReader.close();
				}
			}
		}
		
		switch (mode) {
			case "translators":
				var titleField = 'label';
				var fileExt = ".js";
				break;
			
			case "styles":
				var titleField = 'title';
				var fileExt = ".csl";
				var hiddenDir = Zotero.getStylesDirectory();
				hiddenDir.append('hidden');
				break;
			
			default:
				throw ("Invalid mode '" + mode + "' in Zotero.Schema.updateBundledFiles()");
		}
		
		var modes = mode;
		mode = mode.substr(0, mode.length - 1);
		var Mode = mode[0].toUpperCase() + mode.substr(1);
		var Modes = Mode + "s";
		
		var repotime = Zotero.File.getContentsFromURL("resource://zotero/schema/repotime.txt");
		var date = Zotero.Date.sqlToDate(repotime, true);
		repotime = Zotero.Date.toUnixTimestamp(date);
		
		var fileNameRE = new RegExp("^[^\.].+\\" + fileExt + "$");
		
		var destDir = Zotero["get" + Modes + "Directory"]();
		
		// If directory is empty, force reinstall
		var forceReinstall = true;
		var entries = destDir.directoryEntries;
		while (entries.hasMoreElements()) {
			var file = entries.getNext();
			file.QueryInterface(Components.interfaces.nsIFile);
			if (!file.leafName.match(fileNameRE) || file.isDirectory()) {
				continue;
			}
			// Not empty
			forceReinstall = false;
			break;
		}
		
		//
		// Delete obsolete files
		//
		var sql = "SELECT version FROM version WHERE schema='delete'";
		var lastVersion = Zotero.DB.valueQuery(sql);
		
		if(isUnpacked) {
			var deleted = installLocation.clone();
			deleted.append('deleted.txt');
			// In source builds, deleted.txt is in the translators directory
			if (!deleted.exists()) {
				deleted = installLocation.clone();
				deleted.append('translators');
				deleted.append('deleted.txt');
			}
			if (!deleted.exists()) {
				deleted = false;
			}
		} else {
			var deleted = xpiZipReader.getInputStream("deleted.txt");
		}
		
		deleted = Zotero.File.getContents(deleted);
		deleted = deleted.match(/^([^\s]+)/gm);
		var version = deleted.shift();
		
		if (!lastVersion || lastVersion < version) {
			var toDelete = [];
			var entries = destDir.directoryEntries;
			while (entries.hasMoreElements()) {
				var file = entries.getNext();
				file.QueryInterface(Components.interfaces.nsIFile);
				
				if (!file.exists() // symlink to non-existent file
						|| file.isDirectory()) {
					continue;
				}
				
				switch (file.leafName) {
					// Delete incorrectly named files saved via repo pre-1.5b3
					case 'ama':
					case 'apa':
					case 'apsa':
					case 'asa':
					case 'chicago-author-date':
					case 'chicago-fullnote-bibliography':
					case 'chicago-note':
					case 'chicago-note-bibliography':
					case 'harvard1':
					case 'ieee':
					case 'mhra':
					case 'mhra_note_without_bibliography':
					case 'mla':
					case 'nature':
					case 'nlm':
					case 'vancouver':
					
					// Remove update script (included with 3.0 accidentally)
					case 'update':
					
					// Delete renamed/obsolete files
					case 'chicago-note.csl':
					case 'mhra_note_without_bibliography.csl':
					case 'mhra.csl':
					case 'mla.csl':
						toDelete.push(file);
						continue;
					
					// Be a little more careful with this one, in case someone
					// created a custom 'aaa' style
					case 'aaa.csl':
						var str = Zotero.File.getContents(file, false, 300);
						if (str.indexOf("<title>American Anthropological Association</title>") != -1) {
							toDelete.push(file);
						}
						continue;
				}
				
				if (forceReinstall || !file.leafName.match(fileNameRE)) {
					continue;
				}
				
				var newObj = new Zotero[Mode](file);
				if (deleted.indexOf(newObj[mode + "ID"]) == -1) {
					continue;
				}
				toDelete.push(file);
			}
			
			for each(var file in toDelete) {
				Zotero.debug("Deleting " + file.path);
				try {
					file.remove(false);
				}
				catch (e) {
					Zotero.debug(e);
				}
			}
			
			if (!skipDeleteUpdate) {
				sql = "REPLACE INTO version (schema, version) VALUES ('delete', ?)";
				Zotero.DB.query(sql, version);
			}
		}
		
		//
		// Update files
		//
		var sql = "SELECT version FROM version WHERE schema=?";
		var lastModTime = Zotero.DB.valueQuery(sql, modes);
		
		var zipFileName = modes + ".zip", zipFile;
		if(isUnpacked) {
			zipFile = installLocation.clone();
			zipFile.append(zipFileName);
			if(!zipFile.exists()) zipFile = undefined;
		} else {
			if(xpiZipReader.hasEntry(zipFileName)) {
				zipFile = xpiZipReader.getEntry(zipFileName);
			}
		}
		
		// XPI installation
		if (zipFile) {
			var modTime = Math.round(zipFile.lastModifiedTime / 1000);
			
			if (!forceReinstall && lastModTime && modTime <= lastModTime) {
				Zotero.debug("Installed " + modes + " are up-to-date with " + zipFileName);
				return false;
			}
			
			Zotero.debug("Updating installed " + modes + " from " + zipFileName);
			
			if (mode == 'translator') {
				// Parse translators.index
				var indexFile;
				if(isUnpacked) {
					indexFile = installLocation.clone();
					indexFile.append('translators.index');
					if (!indexFile.exists()) {
						Components.utils.reportError("translators.index not found in Zotero.Schema.updateBundledFiles()");
						return false;
					}
				} else {
					if(!xpiZipReader.hasEntry("translators.index")) {
						Components.utils.reportError("translators.index not found in Zotero.Schema.updateBundledFiles()");
						return false;
					}
					var indexFile = xpiZipReader.getInputStream("translators.index");
				}
				
				indexFile = Zotero.File.getContents(indexFile);
				indexFile = indexFile.split("\n");
				var index = {};
				for each(var line in indexFile) {
					if (!line) {
						continue;
					}
					var [fileName, translatorID, label, lastUpdated] = line.split(',');
					if (!translatorID) {
						Components.utils.reportError("Invalid translatorID '" + translatorID + "' in Zotero.Schema.updateBundledFiles()");
						return false;
					}
					index[translatorID] = {
						label: label,
						lastUpdated: lastUpdated,
						fileName: fileName, // Numbered JS file within ZIP
						extract: true
					};
				}
				
				var sql = "SELECT translatorJSON FROM translatorCache";
				var dbCache = Zotero.DB.columnQuery(sql);
				// If there's anything in the cache, see what we actually need to extract
				if (dbCache) {
					for each(var json in dbCache) {
						var metadata = JSON.parse(json);
						var id = metadata.translatorID;
						if (index[id] && index[id].lastUpdated == metadata.lastUpdated) {
							index[id].extract = false;
						}
					}
				}
			}
			
			var zipReader = Components.classes["@mozilla.org/libjar/zip-reader;1"]
					.createInstance(Components.interfaces.nsIZipReader);
			if(isUnpacked) {
				zipReader.open(zipFile);
			} else {
				zipReader.openInner(xpiZipReader, zipFileName);
			}
			var tmpDir = Zotero.getTempDirectory();
			
			if (mode == 'translator') {
				for (var translatorID in index) {
					// Use index file and DB cache for translator entries,
					// extracting only what's necessary
					var entry = index[translatorID];
					if (!entry.extract) {
						//Zotero.debug("Not extracting '" + entry.label + "' -- same version already in cache");
						continue;
					}
					
					var tmpFile = tmpDir.clone();
					tmpFile.append(entry.fileName);
					if (tmpFile.exists()) {
						tmpFile.remove(false);
					}
					zipReader.extract(entry.fileName, tmpFile);
					
					var existingObj = Zotero.Translators.get(translatorID);
					if (!existingObj) {
						Zotero.debug("Installing translator '" + entry.label + "'");
					}
					else {
						Zotero.debug("Updating translator '" + existingObj.label + "'");
						if (existingObj.file.exists()) {
							existingObj.file.remove(false);
						}
					}
					
					var fileName = Zotero.Translators.getFileNameFromLabel(
						entry.label, translatorID
					);
					
					var destFile = destDir.clone();
					destFile.append(fileName);
					if (destFile.exists()) {
						var msg = "Overwriting translator with same filename '"
							+ fileName + "'";
						Zotero.debug(msg, 1);
						Components.utils.reportError(msg + " in Zotero.Schema.updateBundledFiles()");
						destFile.remove(false);
					}
					
					tmpFile.moveTo(destDir, fileName);
					
					Zotero.wait();
				}
			}
			// Styles
			else {
				var entries = zipReader.findEntries(null);
				while (entries.hasMore()) {
					var entry = entries.getNext();
					
					var tmpFile = tmpDir.clone();
					tmpFile.append(entry);
					if (tmpFile.exists()) {
						tmpFile.remove(false);
					}
					zipReader.extract(entry, tmpFile);
					var newObj = new Zotero[Mode](tmpFile);
					
					var existingObj = Zotero[Modes].get(newObj[mode + "ID"]);
					if (!existingObj) {
						Zotero.debug("Installing " + mode + " '" + newObj[titleField] + "'");
					}
					else {
						Zotero.debug("Updating "
							+ (existingObj.hidden ? "hidden " : "")
							+ mode + " '" + existingObj[titleField] + "'");
						if (existingObj.file.exists()) {
							existingObj.file.remove(false);
						}
					}
					
					var fileName = tmpFile.leafName;
					
					if (!existingObj || !existingObj.hidden) {
						tmpFile.moveTo(destDir, fileName);
					}
					else {
						tmpFile.moveTo(hiddenDir, fileName);
					}
					
					Zotero.wait();
				}
			}
			
			zipReader.close();
			if(xpiZipReader) xpiZipReader.close();
		}
		// Source installation
		else {
			var sourceDir = installLocation.clone();
			sourceDir.append(modes);
			if (!sourceDir.exists()) {
				Components.utils.reportError("No " + modes + " ZIP file or directory "
					+ " in Zotero.Schema.updateBundledFiles()");
				return false;
			}
			
			var entries = sourceDir.directoryEntries;
			var modTime = 0;
			var sourceFilesExist = false;
			while (entries.hasMoreElements()) {
				var file = entries.getNext();
				file.QueryInterface(Components.interfaces.nsIFile);
				// File might not exist in an source build with style symlinks
				if (!file.exists()
						|| !file.leafName.match(fileNameRE)
						|| file.isDirectory()) {
					continue;
				}
				sourceFilesExist = true;
				var fileModTime = Math.round(file.lastModifiedTime / 1000);
				if (fileModTime > modTime) {
					modTime = fileModTime;
				}
			}
			
			// Don't attempt installation for source build with missing styles
			if (!sourceFilesExist) {
				Zotero.debug("No source " + mode + " files exist -- skipping update");
				return false;
			}
			
			if (!forceReinstall && lastModTime && modTime <= lastModTime) {
				Zotero.debug("Installed " + modes + " are up-to-date with " + modes + " directory");
				return false;
			}
			
			Zotero.debug("Updating installed " + modes + " from " + modes + " directory");
			
			var entries = sourceDir.directoryEntries;
			while (entries.hasMoreElements()) {
				var file = entries.getNext();
				file.QueryInterface(Components.interfaces.nsIFile);
				if (!file.exists() || !file.leafName.match(fileNameRE) || file.isDirectory()) {
					continue;
				}
				var newObj = new Zotero[Mode](file);
				var existingObj = Zotero[Modes].get(newObj[mode + "ID"]);
				if (!existingObj) {
					Zotero.debug("Installing " + mode + " '" + newObj[titleField] + "'");
				}
				else {
					Zotero.debug("Updating "
						+ (existingObj.hidden ? "hidden " : "")
						+ mode + " '" + existingObj[titleField] + "'");
					if (existingObj.file.exists()) {
						existingObj.file.remove(false);
					}
				}
				
				if (mode == 'translator') {
					var fileName = Zotero.Translators.getFileNameFromLabel(
						newObj[titleField], newObj.translatorID
					);
				}
				else if (mode == 'style') {
					var fileName = file.leafName;
				}
				
				try {
					var destFile = destDir.clone();
					destFile.append(fileName);
					if (destFile.exists()) {
						var msg = "Overwriting " + mode + " with same filename '"
							+ fileName + "'";
						Zotero.debug(msg, 1);
						Components.utils.reportError(msg + " in Zotero.Schema.updateBundledFiles()");
						destFile.remove(false);
					}
					
					if (!existingObj || !existingObj.hidden) {
						file.copyTo(destDir, fileName);
					}
					else {
						file.copyTo(hiddenDir, fileName);
					}
				}
				catch (e) {
					Components.utils.reportError("Error copying file " + fileName + ": " + e);
				}
				
				Zotero.wait();
			}
		}
		
		Zotero.DB.beginTransaction();
		
		var sql = "REPLACE INTO version VALUES (?, ?)";
		Zotero.DB.query(sql, [modes, modTime]);
		
		var sql = "REPLACE INTO version VALUES ('repository', ?)";
		Zotero.DB.query(sql, repotime);
		
		Zotero.DB.commitTransaction();
		
		Zotero[Modes].init();
		
		return true;
	}
	
	
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
			var url = ZOTERO_CONFIG.REPOSITORY_URL + '/updated?'
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
			var styles = Zotero.Styles.getAll();
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
				let xmlhttp = Zotero.HTTP.promise("POST", url, { body: body });
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
						Zotero.debug("Error updating from repository " + msg, 1);
					}
					// TODO: instead, add an observer to start and stop timer on online state change
					_setRepositoryTimer(ZOTERO_CONFIG.REPOSITORY_RETRY_INTERVAL);
					return;
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
	
	
	this.resetTranslatorsAndStyles = function (callback) {
		Zotero.debug("Resetting translators and styles");
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('translators', 'styles', 'repository', 'lastcheck')";
		Zotero.DB.query(sql);
		_dbVersions.repository = null;
		_dbVersions.lastcheck = null;
		
		var translatorsDir = Zotero.getTranslatorsDirectory();
		translatorsDir.remove(true);
		Zotero.getTranslatorsDirectory(); // recreate directory
		return Zotero.Translators.reinit()
		.then(function () self.updateBundledFiles('translators', null, false))
		.then(function () {
			var stylesDir = Zotero.getStylesDirectory();
			stylesDir.remove(true);
			Zotero.getStylesDirectory(); // recreate directory
			Zotero.Styles.init();
			return self.updateBundledFiles('styles', null, true);
		})
		.then(callback);
	}
	
	
	this.resetTranslators = function (callback, skipUpdate) {
		Zotero.debug("Resetting translators");
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('translators', 'repository', 'lastcheck')";
		Zotero.DB.query(sql);
		_dbVersions.repository = null;
		_dbVersions.lastcheck = null;
		
		var translatorsDir = Zotero.getTranslatorsDirectory();
		translatorsDir.remove(true);
		Zotero.getTranslatorsDirectory(); // recreate directory
		return Zotero.Translators.reinit()
		.then(function () self.updateBundledFiles('translators', null, true))
		.then(callback);
	}
	
	
	this.resetStyles = function (callback) {
		Zotero.debug("Resetting translators and styles");
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('styles', 'repository', 'lastcheck')";
		Zotero.DB.query(sql);
		_dbVersions.repository = null;
		_dbVersions.lastcheck = null;
		
		var stylesDir = Zotero.getStylesDirectory();
		stylesDir.remove(true);
		Zotero.getStylesDirectory(); // recreate directory
		return Zotero.Styles.init()
		.then(function () self.updateBundledFiles('styles', null, true))
		.then(callback);
	}
	
	
	this.integrityCheck = Zotero.Promise.coroutine(function* (fix) {
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
				"SELECT COUNT(*) FROM tags NATURAL JOIN itemTags JOIN items USING (itemID) WHERE IFNULL(tags.libraryID, 0)!=IFNULL(items.libraryID,0)",
				[
					"CREATE TEMPORARY TABLE tmpWrongLibraryTags AS SELECT itemTags.ROWID AS tagRowID, tagID, name, itemID, IFNULL(tags.libraryID,0) AS tagLibraryID, IFNULL(items.libraryID,0) AS itemLibraryID FROM tags NATURAL JOIN itemTags JOIN items USING (itemID) WHERE IFNULL(tags.libraryID, 0)!=IFNULL(items.libraryID,0)",
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
				"SELECT COUNT(*) FROM syncDeleteLog WHERE libraryID != 0 AND libraryID NOT IN (SELECT libraryID FROM groups)",
				"DELETE FROM syncDeleteLog WHERE libraryID != 0 AND libraryID NOT IN (SELECT libraryID FROM libraries)",
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
				"SELECT COUNT(*) FROM syncedSettings WHERE libraryID != 0 AND libraryID NOT IN (SELECT libraryID FROM libraries)",
				"DELETE FROM syncedSettings WHERE libraryID != 0 AND libraryID NOT IN (SELECT libraryID FROM libraries)"
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
			yield Zotero.Schema.updateCustomTables(true);
			
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
			
			if (!Zotero.Schema.skipDefaultData) {
				// Quick Start Guide web page item
				var sql = "INSERT INTO items VALUES(1, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 'ABCD2345', 0, 0)";
				yield Zotero.DB.queryAsync(sql);
				var sql = "INSERT INTO itemDataValues VALUES (1, ?)";
				yield Zotero.DB.queryAsync(sql, Zotero.getString('install.quickStartGuide'));
				var sql = "INSERT INTO itemData VALUES (1, 110, 1)";
				yield Zotero.DB.queryAsync(sql);
				var sql = "INSERT INTO itemDataValues VALUES (2, 'http://zotero.org/support/quick_start_guide')";
				yield Zotero.DB.queryAsync(sql);
				var sql = "INSERT INTO itemData VALUES (1, 1, 2)";
				yield Zotero.DB.queryAsync(sql);
				
				// CHNM as creator
				var sql = "INSERT INTO creators VALUES (1, '', 'Center for History and New Media', 1)";
				yield Zotero.DB.queryAsync(sql);
				var sql = "INSERT INTO itemCreators VALUES (1, 1, 1, 0)";
				yield Zotero.DB.queryAsync(sql);
				
				// Welcome note
				var sql = "INSERT INTO items VALUES(2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 'ABCD3456', 0, 0)";
				yield Zotero.DB.queryAsync(sql);
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
			alert('Error initializing Zotero database');
			throw e;
		})
		.then(function () {
			return Zotero.Schema.updateBundledFiles(null, null, true)
			.catch(function (e) {
				Zotero.debug(e);
				Zotero.logError(e);
				alert('Error updating Zotero translators and styles');
			});
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
				Zotero.Styles.init();
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
	function _translatorXMLToFile(xmlnode) {
		// Don't split >4K chunks into multiple nodes
		// https://bugzilla.mozilla.org/show_bug.cgi?id=194231
		xmlnode.normalize();
		var translatorID = xmlnode.getAttribute('id');
		var translator = Zotero.Translators.get(translatorID);
		
		// Delete local version of remote translators with priority 0
		if (xmlnode.getElementsByTagName('priority')[0].firstChild.nodeValue === "0") {
			if (translator && translator.file.exists()) {
				Zotero.debug("Deleting translator '" + translator.label + "'");
				translator.file.remove(false);
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
		
		for each(var attr in ["configOptions", "displayOptions", "hiddenPrefs"]) {
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
	}
	
	
	/**
	 * Traverse an XML style node from the repository and
	 * update the local styles folder with the style data
	 */
	function _styleXMLToFile(xmlnode) {
		// Don't split >4K chunks into multiple nodes
		// https://bugzilla.mozilla.org/show_bug.cgi?id=194231
		xmlnode.normalize();
		
		var uri = xmlnode.getAttribute('id');
		var shortName = uri.replace("http://www.zotero.org/styles/", "");
		
		// Delete local style if CSL code is empty
		if (!xmlnode.firstChild) {
			var style = Zotero.Styles.get(uri);
			if (style) {
				style.file.remove(null);
			}
			return;
		}
		
		// Remove renamed styles, as instructed by the server
		var oldID = xmlnode.getAttribute('oldID');
		if (oldID) {
			var style = Zotero.Styles.get(oldID, true);
			if (style && style.file.exists()) {
				Zotero.debug("Deleting renamed style '" + oldID + "'");
				style.file.remove(false);
			}
		}
		
		var str = xmlnode.firstChild.nodeValue;
		var style = Zotero.Styles.get(uri);
		if (style) {
			if (style.file.exists()) {
				style.file.remove(false);
			}
			var destFile = style.file;
		}
		else {
			// Get last part of URI for filename
			var matches = uri.match(/([^\/]+)$/);
			if (!matches) {
				throw ("Invalid style URI '" + uri + "' from repository");
			}
			var destFile = Zotero.getStylesDirectory();
			destFile.append(matches[1] + ".csl");
			if (destFile.exists()) {
				throw ("Different style with filename '" + matches[1]
					+ "' already exists in Zotero.Schema._styleXMLToFile()");
			}
		}
		
		Zotero.debug("Saving style '" + uri + "'");
		return Zotero.File.putContentsAsync(destFile, str);
	}
	
	
	// TODO
	//
	// If libraryID set, make sure no relations still use a local user key, and then remove on-error code in sync.js
	
	function _migrateUserDataSchema(fromVersion) {
		return _getSchemaSQLVersion('userdata')
		.then(function (toVersion) {
			if (fromVersion >= toVersion) {
				return false;
			}
			
			Zotero.debug('Updating user data tables from version ' + fromVersion + ' to ' + toVersion);
			
			return Zotero.DB.executeTransaction(function* (conn) {
				// Step through version changes until we reach the current version
				//
				// Each block performs the changes necessary to move from the
				// previous revision to that one.
				for (let i = fromVersion + 1; i <= toVersion; i++) {
					if (i == 80) {
						yield _updateDBVersion('compatibility', 1);
						
						yield Zotero.DB.queryAsync("CREATE TABLE IF NOT EXISTS syncedSettings (\n    setting TEXT NOT NULL,\n    libraryID INT NOT NULL,\n    value NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    PRIMARY KEY (setting, libraryID)\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO syncObjectTypes VALUES (7, 'setting')");
						yield Zotero.DB.queryAsync("DELETE FROM version WHERE schema IN ('userdata2', 'userdata3')");
						
						yield Zotero.DB.queryAsync("INSERT INTO libraries VALUES (0, 'user')");
						yield Zotero.DB.queryAsync("ALTER TABLE libraries ADD COLUMN version INT NOT NULL DEFAULT 0");
						yield Zotero.DB.queryAsync("CREATE TABLE syncCache (\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    syncObjectTypeID INT NOT NULL,\n    version INT NOT NULL,\n    data TEXT,\n    PRIMARY KEY (libraryID, key, syncObjectTypeID),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE,\n    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID)\n)");
						
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
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO collections SELECT collectionID, collectionName, parentCollectionID, clientDateModified, IFNULL(libraryID, 0), key, 0, 0 FROM collectionsOld ORDER BY collectionID DESC");
						yield Zotero.DB.queryAsync("CREATE INDEX collections_synced ON collections(synced)");
						
						yield Zotero.DB.queryAsync("ALTER TABLE items RENAME TO itemsOld");
						yield Zotero.DB.queryAsync("CREATE TABLE items (\n    itemID INTEGER PRIMARY KEY,\n    itemTypeID INT NOT NULL,\n    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    UNIQUE (libraryID, key),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO items SELECT itemID, itemTypeID, dateAdded, dateModified, clientDateModified, IFNULL(libraryID, 0), key, 0, 0 FROM itemsOld ORDER BY dateAdded DESC");
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
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO savedSearches SELECT savedSearchID, savedSearchName, clientDateModified, IFNULL(libraryID, 0), key, 0, 0 FROM savedSearchesOld ORDER BY savedSearchID DESC");
						yield Zotero.DB.queryAsync("CREATE INDEX savedSearches_synced ON savedSearches(synced)");
						
						yield Zotero.DB.queryAsync("ALTER TABLE tags RENAME TO tagsOld");
						yield Zotero.DB.queryAsync("CREATE TABLE tags (\n    tagID INTEGER PRIMARY KEY,\n    libraryID INT NOT NULL,\n    name TEXT NOT NULL,\n    UNIQUE (libraryID, name)\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO tags SELECT tagID, IFNULL(libraryID, 0), name FROM tagsOld");
						yield Zotero.DB.queryAsync("ALTER TABLE itemTags RENAME TO itemTagsOld");
						yield Zotero.DB.queryAsync("CREATE TABLE itemTags (\n    itemID INT NOT NULL,\n    tagID INT NOT NULL,\n    type INT NOT NULL,\n    PRIMARY KEY (itemID, tagID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (tagID) REFERENCES tags(tagID) ON DELETE CASCADE\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemTags SELECT itemID, T.tagID, TOld.type FROM itemTagsOld ITO JOIN tagsOld TOld USING (tagID) JOIN tags T ON (IFNULL(TOld.libraryID, 0)=T.libraryID AND TOld.name=T.name COLLATE BINARY)");
						yield Zotero.DB.queryAsync("DROP INDEX itemTags_tagID");
						yield Zotero.DB.queryAsync("CREATE INDEX itemTags_tagID ON itemTags(tagID)");
						
						yield Zotero.DB.queryAsync("ALTER TABLE syncedSettings RENAME TO syncedSettingsOld");
						yield Zotero.DB.queryAsync("CREATE TABLE syncedSettings (\n    setting TEXT NOT NULL,\n    libraryID INT NOT NULL,\n    value NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    PRIMARY KEY (setting, libraryID),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO syncedSettings SELECT * FROM syncedSettingsOld");
						
						yield Zotero.DB.queryAsync("ALTER TABLE itemData RENAME TO itemDataOld");
						yield Zotero.DB.queryAsync("CREATE TABLE itemData (\n    itemID INT,\n    fieldID INT,\n    valueID,\n    PRIMARY KEY (itemID, fieldID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (fieldID) REFERENCES fieldsCombined(fieldID),\n    FOREIGN KEY (valueID) REFERENCES itemDataValues(valueID)\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemData SELECT * FROM itemDataOld");
						yield Zotero.DB.queryAsync("DROP INDEX itemData_fieldID");
						yield Zotero.DB.queryAsync("CREATE INDEX itemData_fieldID ON itemData(fieldID)");
						
						yield Zotero.DB.queryAsync("ALTER TABLE itemNotes RENAME TO itemNotesOld");
						yield Zotero.DB.queryAsync("CREATE TABLE itemNotes (\n    itemID INTEGER PRIMARY KEY,\n    parentItemID INT,\n    note TEXT,\n    title TEXT,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (parentItemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemNotes SELECT * FROM itemNotesOld");
						yield Zotero.DB.queryAsync("CREATE INDEX itemNotes_parentItemID ON itemNotes(parentItemID)");
						
						yield Zotero.DB.queryAsync("ALTER TABLE itemAttachments RENAME TO itemAttachmentsOld");
						yield Zotero.DB.queryAsync("CREATE TABLE itemAttachments (\n    itemID INTEGER PRIMARY KEY,\n    parentItemID INT,\n    linkMode INT,\n    contentType TEXT,\n    charsetID INT,\n    path TEXT,\n    originalPath TEXT,\n    syncState INT DEFAULT 0,\n    storageModTime INT,\n    storageHash TEXT,\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (parentItemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemAttachments SELECT * FROM itemAttachmentsOld");
						yield Zotero.DB.queryAsync("CREATE INDEX itemAttachments_parentItemID ON itemAttachments(parentItemID)");
						yield Zotero.DB.queryAsync("CREATE INDEX itemAttachments_contentType ON itemAttachments(contentType)");
						yield Zotero.DB.queryAsync("DROP INDEX itemAttachments_syncState");
						yield Zotero.DB.queryAsync("CREATE INDEX itemAttachments_syncState ON itemAttachments(syncState)");
						
						yield Zotero.DB.queryAsync("ALTER TABLE itemSeeAlso RENAME TO itemSeeAlsoOld");
						yield Zotero.DB.queryAsync("CREATE TABLE itemSeeAlso (\n    itemID INT NOT NULL,\n    linkedItemID INT NOT NULL,\n    PRIMARY KEY (itemID, linkedItemID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE,\n    FOREIGN KEY (linkedItemID) REFERENCES items(itemID) ON DELETE CASCADE\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO itemSeeAlso SELECT * FROM itemSeeAlsoOld");
						yield Zotero.DB.queryAsync("DROP INDEX itemSeeAlso_linkedItemID");
						yield Zotero.DB.queryAsync("CREATE INDEX itemSeeAlso_linkedItemID ON itemSeeAlso(linkedItemID)");
						
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
						yield Zotero.DB.queryAsync("DROP INDEX deletedItems_dateDeleted");
						yield Zotero.DB.queryAsync("CREATE INDEX deletedItems_dateDeleted ON deletedItems(dateDeleted)");
						
						yield Zotero.DB.queryAsync("UPDATE relations SET libraryID=0 WHERE libraryID=(SELECT value FROM settings WHERE setting='account' AND key='libraryID')");
						yield Zotero.DB.queryAsync("ALTER TABLE relations RENAME TO relationsOld");
						yield Zotero.DB.queryAsync("CREATE TABLE relations (\n    libraryID INT NOT NULL,\n    subject TEXT NOT NULL,\n    predicate TEXT NOT NULL,\n    object TEXT NOT NULL,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    PRIMARY KEY (subject, predicate, object),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO relations SELECT * FROM relationsOld");
						yield Zotero.DB.queryAsync("DROP INDEX relations_object");
						yield Zotero.DB.queryAsync("CREATE INDEX relations_object ON relations(object)");
						
						yield Zotero.DB.queryAsync("ALTER TABLE groups RENAME TO groupsOld");
						yield Zotero.DB.queryAsync("CREATE TABLE groups (\n    groupID INTEGER PRIMARY KEY,\n    libraryID INT NOT NULL UNIQUE,\n    name TEXT NOT NULL,\n    description TEXT NOT NULL,\n    editable INT NOT NULL,\n    filesEditable INT NOT NULL,\n    etag TEXT NOT NULL DEFAULT '',\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO groups SELECT groupID, libraryID, name, description, editable, filesEditable, '' FROM groupsOld");
						
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
						
						yield Zotero.DB.queryAsync("DROP INDEX fulltextItems_version");
						yield Zotero.DB.queryAsync("DROP INDEX fulltextItemWords_itemID");
						yield Zotero.DB.queryAsync("CREATE INDEX fulltextItems_version ON fulltextItems(version)");
						yield Zotero.DB.queryAsync("CREATE INDEX fulltextItemWords_itemID ON fulltextItemWords(itemID)");
						
						yield Zotero.DB.queryAsync("UPDATE syncDeleteLog SET libraryID=0 WHERE libraryID=(SELECT value FROM settings WHERE setting='account' AND key='libraryID')");
						yield Zotero.DB.queryAsync("ALTER TABLE syncDeleteLog RENAME TO syncDeleteLogOld");
						yield Zotero.DB.queryAsync("CREATE TABLE syncDeleteLog (\n    syncObjectTypeID INT NOT NULL,\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    timestamp INT NOT NULL,\n    UNIQUE (syncObjectTypeID, libraryID, key),\n    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO syncDeleteLog SELECT * FROM syncDeleteLogOld");
						yield Zotero.DB.queryAsync("DROP INDEX syncDeleteLog_timestamp");
						yield Zotero.DB.queryAsync("CREATE INDEX syncDeleteLog_timestamp ON syncDeleteLog(timestamp)");
						
						yield Zotero.DB.queryAsync("ALTER TABLE storageDeleteLog RENAME TO storageDeleteLogOld");
						yield Zotero.DB.queryAsync("CREATE TABLE storageDeleteLog (\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    timestamp INT NOT NULL,\n    PRIMARY KEY (libraryID, key),\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID) ON DELETE CASCADE\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO storageDeleteLog SELECT * FROM storageDeleteLogOld");
						yield Zotero.DB.queryAsync("DROP INDEX storageDeleteLog_timestamp");
						yield Zotero.DB.queryAsync("CREATE INDEX storageDeleteLog_timestamp ON storageDeleteLog(timestamp)");
						
						yield Zotero.DB.queryAsync("ALTER TABLE annotations RENAME TO annotationsOld");
						yield Zotero.DB.queryAsync("CREATE TABLE annotations (\n    annotationID INTEGER PRIMARY KEY,\n    itemID INT NOT NULL,\n    parent TEXT,\n    textNode INT,\n    offset INT,\n    x INT,\n    y INT,\n    cols INT,\n    rows INT,\n    text TEXT,\n    collapsed BOOL,\n    dateModified DATE,\n    FOREIGN KEY (itemID) REFERENCES itemAttachments(itemID) ON DELETE CASCADE\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO annotations SELECT * FROM annotationsOld");
						yield Zotero.DB.queryAsync("DROP INDEX annotations_itemID");
						yield Zotero.DB.queryAsync("CREATE INDEX annotations_itemID ON annotations(itemID)");
						
						yield Zotero.DB.queryAsync("ALTER TABLE highlights RENAME TO highlightsOld");
						yield Zotero.DB.queryAsync("CREATE TABLE highlights (\n    highlightID INTEGER PRIMARY KEY,\n    itemID INT NOT NULL,\n    startParent TEXT,\n    startTextNode INT,\n    startOffset INT,\n    endParent TEXT,\n    endTextNode INT,\n    endOffset INT,\n    dateModified DATE,\n    FOREIGN KEY (itemID) REFERENCES itemAttachments(itemID) ON DELETE CASCADE\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO highlights SELECT * FROM highlightsOld");
						yield Zotero.DB.queryAsync("DROP INDEX highlights_itemID");
						yield Zotero.DB.queryAsync("CREATE INDEX highlights_itemID ON highlights(itemID)");
						
						yield Zotero.DB.queryAsync("ALTER TABLE customBaseFieldMappings RENAME TO customBaseFieldMappingsOld");
						yield Zotero.DB.queryAsync("CREATE TABLE customBaseFieldMappings (\n    customItemTypeID INT,\n    baseFieldID INT,\n    customFieldID INT,\n    PRIMARY KEY (customItemTypeID, baseFieldID, customFieldID),\n    FOREIGN KEY (customItemTypeID) REFERENCES customItemTypes(customItemTypeID),\n    FOREIGN KEY (baseFieldID) REFERENCES fields(fieldID),\n    FOREIGN KEY (customFieldID) REFERENCES customFields(customFieldID)\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO customBaseFieldMappings SELECT * FROM customBaseFieldMappingsOld");
						yield Zotero.DB.queryAsync("DROP INDEX customBaseFieldMappings_baseFieldID");
						yield Zotero.DB.queryAsync("DROP INDEX customBaseFieldMappings_customFieldID");
						yield Zotero.DB.queryAsync("CREATE INDEX customBaseFieldMappings_baseFieldID ON customBaseFieldMappings(baseFieldID)");
						yield Zotero.DB.queryAsync("CREATE INDEX customBaseFieldMappings_customFieldID ON customBaseFieldMappings(customFieldID)");
						
						yield Zotero.DB.queryAsync("DROP TABLE annotationsOld");
						yield Zotero.DB.queryAsync("DROP TABLE collectionItemsOld");
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
						yield Zotero.DB.queryAsync("DROP TABLE itemSeeAlsoOld");
						yield Zotero.DB.queryAsync("DROP TABLE itemTagsOld");
						yield Zotero.DB.queryAsync("DROP TABLE relationsOld");
						yield Zotero.DB.queryAsync("DROP TABLE savedSearchesOld");
						yield Zotero.DB.queryAsync("DROP TABLE storageDeleteLogOld");
						yield Zotero.DB.queryAsync("DROP TABLE syncDeleteLogOld");
						yield Zotero.DB.queryAsync("DROP TABLE syncedSettingsOld");
						yield Zotero.DB.queryAsync("DROP TABLE collectionsOld");
						yield Zotero.DB.queryAsync("DROP TABLE creatorsOld");
						yield Zotero.DB.queryAsync("DROP TABLE creatorData");
						yield Zotero.DB.queryAsync("DROP TABLE itemsOld");
						yield Zotero.DB.queryAsync("DROP TABLE tagsOld");
					}
				}
				
				yield _updateDBVersion('userdata', toVersion);
			})
			.return(true);
		})
	}
}
