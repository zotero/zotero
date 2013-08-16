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
	var _repositoryTimer;
	var _remoteUpdateInProgress = false, _localUpdateInProgress = false;
	
	var self = this;
	
	/*
	 * Retrieve the DB schema version
	 */
	this.getDBVersion = function (schema) {
		if (_dbVersions[schema]){
			return Q(_dbVersions[schema]);
		}
		
		if (!Zotero.DB.tableExists('version')) {
			return Q(false)
		}
		
		var sql = "SELECT version FROM version WHERE schema='" + schema + "'";
		return Zotero.DB.valueQueryAsync(sql)
		.then(function (dbVersion) {
			if (dbVersion) {
				dbVersion = parseInt(dbVersion);
				_dbVersions[schema] = dbVersion;
			}
			return dbVersion;
		});
	}
	
	
	/*
	 * Checks if the DB schema exists and is up-to-date, updating if necessary
	 */
	this.updateSchema = function () {
		return Q.all([this.getDBVersion('userdata'), this.getDBVersion('userdata3')])
		.spread(function (oldDBVersion, dbVersion) {
			if (!oldDBVersion) {
				Zotero.debug('Database does not exist -- creating\n');
				return _initializeSchema().thenResolve(true);
			}
			
			if (oldDBVersion < 76) {
				// TODO: localize
				let msg = "Zotero found a pre–Zotero 2.1 database that cannot be upgraded to "
					+ "work with this version of Zotero. To continue, either upgrade your "
					+ "database using an earlier version of Zotero or delete your "
					+ "Zotero data directory to start with a new database."
				throw new Error(msg);
			}
			
			return _getSchemaSQLVersion('userdata3')
			// If upgrading userdata, make backup of database first
			.then(function (schemaVersion) {
				if (dbVersion < schemaVersion) {
					return Zotero.DB.backupDatabase(dbVersion);
				}
			})
			.then(function () {
				return Zotero.DB.executeTransaction(function (conn) {
					var up1 = yield _updateSchema('system');
					
					// Update custom tables if they exist so that changes are in
					// place before user data migration
					if (Zotero.DB.tableExists('customItemTypes')) {
						yield Zotero.Schema.updateCustomTables(up1);
					}
					var up2 = yield _migrateUserDataSchema(dbVersion);
					yield _updateSchema('triggers');
					
					Zotero.DB.asyncResult(up2);
				})
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
							var maxPrevious = dbVersion - 1;
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
						Zotero.initializationPromise
						.delay(5000)
						.then(function () Zotero.Schema.updateBundledFiles(null, false, true))
						.done();
						
						return updated;
					});
				});
			});
		});
	}
	
	
	// This is mostly temporary
	// TEMP - NSF
	this.importSchema = function (str, uri) {
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
					Zotero.Searches.erase(id);
				}
			}
			
			_reloadSchema();
			
			ps.alert(null, "Zotero Item Type Removed", "The 'NSF Reviewer' item type has been uninstalled.");
		}
	}
	
	function _reloadSchema() {
		Zotero.Schema.updateCustomTables()
		.then(function () {
			Zotero.ItemTypes.reload();
			Zotero.ItemFields.reload();
			Zotero.SearchConditions.reload();
			
			// Update item type menus in every open window
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						.getService(Components.interfaces.nsIWindowMediator);
			var enumerator = wm.getEnumerator("navigator:browser");
			while (enumerator.hasMoreElements()) {
				var win = enumerator.getNext();
				win.ZoteroPane.buildItemTypeSubMenu();
				win.document.getElementById('zotero-editpane-item-box').buildItemTypeMenu();
			}
		})
		.done();
	}
	
	
	this.updateCustomTables = function (skipDelete, skipSystem) {
		return Zotero.DB.executeTransaction(function (conn) {
			Zotero.debug("Updating custom tables");
			
			if (!skipDelete) {
				yield Zotero.DB.queryAsync("DELETE FROM itemTypesCombined");
				yield Zotero.DB.queryAsync("DELETE FROM fieldsCombined");
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
				"INSERT INTO fieldsCombined "
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
		if (_localUpdateInProgress) return Q();
		
		return Q.fcall(function () {
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
			var deferred = Q.defer();
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
	this.updateFromRepository = function (force) {
		return Q.fcall(function () {
			if (force) return true;
			
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
			return self.getDBVersion('lastcheck')
			.then(function (lastCheck) {
				var nextCheck = new Date();
				nextCheck.setTime((lastCheck + ZOTERO_CONFIG.REPOSITORY_CHECK_INTERVAL) * 1000);
				
				var now = new Date();
				
				// If enough time hasn't passed, don't update
				if (now < nextCheck) {
					Zotero.debug('Not enough time since last update -- not checking repository', 4);
					// Set the repository timer to the remaining time
					_setRepositoryTimer(Math.round((nextCheck.getTime() - now.getTime()) / 1000));
					return false;
				}
				
				return true;
			});
		})
		.then(function (update) {
			if (!update) return;
			
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
			if (Zotero.DB.transactionInProgress()) {
				Zotero.debug('Transaction in progress -- delaying repository check', 4)
				_setRepositoryTimer(600);
				return;
			}
			
			// Get the last timestamp we got from the server
			return self.getDBVersion('repository')
			.then(function (lastUpdated) {
				var url = ZOTERO_CONFIG['REPOSITORY_URL'] + '/updated?'
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
				
				return Zotero.HTTP.promise("POST", url, { body: body })
				.then(function (xmlhttp) {
					return _updateFromRepositoryCallback(xmlhttp, !!force);
				})
				.catch(function (e) {
					if (e instanceof Zotero.HTTP.BrowserOfflineException || e.xmlhttp) {
						var msg = " -- retrying in " + ZOTERO_CONFIG.REPOSITORY_RETRY_INTERVAL
						if (e instanceof Zotero.HTTP.BrowserOfflineException) {
							Zotero.debug("Browser is offline" + msg);
						}
						else {
							Components.utils.reportError(e);
							Zotero.debug("Error updating from repository " + msg);
						}
						// TODO: instead, add an observer to start and stop timer on online state change
						_setRepositoryTimer(ZOTERO_CONFIG.REPOSITORY_RETRY_INTERVAL);
						return;
					}
					throw e;
				});
			})
			.finally(function () _remoteUpdateInProgress = false);
		});
	}
	
	
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
	
	
	this.integrityCheck = function (fix) {
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
				"SELECT COUNT(*) FROM itemData WHERE fieldID NOT IN (SELECT fieldID FROM fields)",
				"DELETE FROM itemData WHERE fieldID NOT IN (SELECT fieldID FROM fields)",
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
				"SELECT COUNT(*) FROM itemData WHERE fieldID NOT IN (SELECT fieldID FROM itemTypeFields WHERE itemTypeID=(SELECT itemTypeID FROM items WHERE itemID=itemData.itemID))",
				"DELETE FROM itemData WHERE fieldID NOT IN (SELECT fieldID FROM itemTypeFields WHERE itemTypeID=(SELECT itemTypeID FROM items WHERE itemID=itemData.itemID))",
			],
			// Missing itemAttachments row
			[
				"SELECT COUNT(*) FROM items WHERE itemTypeID=14 AND itemID NOT IN (SELECT itemID FROM itemAttachments)",
				"INSERT INTO itemAttachments (itemID, linkMode) SELECT itemID, 0 FROM items WHERE itemTypeID=14 AND itemID NOT IN (SELECT itemID FROM itemAttachments)",
			],
			// Note/child parents
			[
				"SELECT COUNT(*) FROM itemAttachments WHERE sourceItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (1,14))",
				"UPDATE itemAttachments SET sourceItemID=NULL WHERE sourceItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (1,14))",
			],
			[
				"SELECT COUNT(*) FROM itemNotes WHERE sourceItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (1,14))",
				"UPDATE itemNotes SET sourceItemID=NULL WHERE sourceItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (1,14))",
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
				"SELECT COUNT(*) FROM creatorData WHERE firstName='' AND lastName=''",
				[
					"DELETE FROM itemCreators WHERE creatorID IN (SELECT creatorID FROM creators WHERE creatorDataID IN (SELECT creatorDataID FROM creatorData WHERE firstName='' AND lastName=''))",
					"DELETE FROM creators WHERE creatorDataID IN (SELECT creatorDataID FROM creatorData WHERE firstName='' AND lastName='')",
					"DELETE FROM creatorData WHERE firstName='' AND lastName=''"
				],
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
			]
		];
		
		for each(var sql in queries) {
			if (Zotero.DB.valueQuery(sql[0])) {
				Zotero.debug("Test failed!", 1);
				
				if (fix) {
					try {
						// Single query
						if (typeof sql[1] == 'string') {
							Zotero.DB.valueQuery(sql[1]);
						}
						// Multiple queries
						else {
							for each(var s in sql[1]) {
								Zotero.DB.valueQuery(s);
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
		}
		
		return true;
	}
	
	
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
		// TEMP
		if (schema == 'userdata3') {
			schema = 'userdata';
			var newUserdata = true;
		}
		return _getSchemaSQL(schema)
		.then(function (sql) {
			// Fetch the schema version from the first line of the file
			var schemaVersion = parseInt(sql.match(/^-- ([0-9]+)/)[1]);
			
			// TEMP: For 'userdata', cap the version at 76
			// For 'userdata3', versions > 76 are allowed.
			if (schema == 'userdata' && !newUserdata) {
				schemaVersion = Math.min(76, schemaVersion);
			}
			
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
		return Zotero.DB.executeTransaction(function (conn) {
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
			
			yield _getSchemaSQLVersion('system').then(function (sql) {
				return _updateDBVersion('system', sql);
			});
			yield _getSchemaSQLVersion('userdata').then(function (sql) {
				return _updateDBVersion('userdata', sql);
			});
			yield _getSchemaSQLVersion('userdata3').then(function (sql) {
				return _updateDBVersion('userdata3', sql);
			});
			yield _getSchemaSQLVersion('triggers').then(function (sql) {
				return _updateDBVersion('triggers', sql);
			});
			
			if (!Zotero.Schema.skipDefaultData) {
				// Quick Start Guide web page item
				var sql = "INSERT INTO items VALUES(1, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, 'ABCD2345')";
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
				var sql = "INSERT INTO creatorData VALUES (1, '', 'Center for History and New Media', '', 1, NULL)";
				yield Zotero.DB.queryAsync(sql);
				var sql = "INSERT INTO creators VALUES (1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, 'ABCD2345')";
				yield Zotero.DB.queryAsync(sql);
				var sql = "INSERT INTO itemCreators VALUES (1, 1, 1, 0)";
				yield Zotero.DB.queryAsync(sql);
				
				// Welcome note
				var sql = "INSERT INTO items VALUES(2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, 'ABCD3456')";
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
		return Q.all([Zotero.Schema.getDBVersion(schema), _getSchemaSQLVersion(schema)])
		.spread(function (dbVersion, schemaVersion) {
			if (dbVersion == schemaVersion) {
				return false;
			}
			else if (dbVersion < schemaVersion) {
				return _getSchemaSQL(schema)
				.then(function (sql) {
					return Zotero.DB.queryAsync(sql);
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
			
			return Q(false);
		}
		
		var currentTime = xmlhttp.responseXML.
			getElementsByTagName('currentTime')[0].firstChild.nodeValue;
		var lastCheckTime = Math.round(new Date().getTime()/1000);
		var translatorUpdates = xmlhttp.responseXML.getElementsByTagName('translator');
		var styleUpdates = xmlhttp.responseXML.getElementsByTagName('style');
		
		if (!translatorUpdates.length && !styleUpdates.length){
			return Zotero.DB.executeTransaction(function (conn) {
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
				return Q(true);
			});
		}
		
		return Q.async(function () {
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
				Q.return(false);
			}
			
			Q.return(true);
		})()
		.then(function (update) {
			if (!update) return false;
			
			return Zotero.DB.executeTransaction(function (conn) {
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
	// Replace customBaseFieldMappings to fix FK fields/customField -> customFields->customFieldID
	// If libraryID set, make sure no relations still use a local user key, and then remove on-error code in sync.js
	
	function _migrateUserDataSchema(fromVersion) {
		return _getSchemaSQLVersion('userdata3')
		.then(function (toVersion) {
			if (!fromVersion) {
				fromVersion = 76;
			}
			
			if (fromVersion >= toVersion) {
				return false;
			}
			
			Zotero.debug('Updating user data tables from version ' + fromVersion + ' to ' + toVersion);
			
			return Zotero.DB.executeTransaction(function (conn) {
				// Step through version changes until we reach the current version
				//
				// Each block performs the changes necessary to move from the
				// previous revision to that one.
				for (var i=fromVersion + 1; i<=toVersion; i++) {
					if (i == 77) {
						yield Zotero.DB.queryAsync("CREATE TABLE IF NOT EXISTS syncedSettings (\n    setting TEXT NOT NULL,\n    libraryID INT NOT NULL,\n    value NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    PRIMARY KEY (setting, libraryID)\n)");
						yield Zotero.DB.queryAsync("INSERT OR IGNORE INTO syncObjectTypes VALUES (7, 'setting')");
					}
					
					if (i == 78) {
						yield Zotero.DB.queryAsync("CREATE INDEX IF NOT EXISTS creatorData_name ON creatorData(lastName, firstName)");
					}
					
					if (i == 79) {
						yield Zotero.DB.queryAsync("DELETE FROM version WHERE schema='userdata2'");
					}
				}
				
				yield _updateDBVersion('userdata3', toVersion);
			})
			.then(function () true);
		})
	}
}
