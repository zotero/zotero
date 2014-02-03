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
	var _renamedStylesByNew = null;
	
	var self = this;
	
	/*
	 * Multilingual Zotero schema upgrade notes
	 *
	 * With MLZ easing its way into wider use, we need more orderly
	 * code for the upgrade process. The challenge is that upgrades
	 * may appear in the Zotero source on which the project is based
	 * (Z-upgrades). Going forward, these may require special handling
	 * to apply correctly against an MLZ database, and may impact
	 * Multilingual Zotero upgrades (M-upgrades).
	 * 
	 * The previous M-upgrade code assumed no Z-upgrade activity.
	 * This worked as a short-term assumption, but we are now starting
	 * to see activity, and a major refactoring of the Zotero schema
	 * is likely to arrive this year or next. When that emerges, it is
	 * important that we be able to follow the changes smoothly in MLZ.
	 *
	 * The current release MLZ client as of this writing brings the
	 * schema safely to version userdata:77. Our difficulties involve
	 * version levels beyond this point, where sequential increments
	 * of userdata.sql in Zotero and MLZ will become ambiguous.
	 *
	 * To avoid ambiguity, the schema version baseline for MLZ clients
	 * will be bumped to 10000. To permit Z-updates to be applied in a
	 * controlled way, the Z version level at which the DB was
	 * migrated to MLZ will be recorded as "mlzSchemaEntryLevel" in
	 * the version table.
	 *
	 * Happily, the existing multilingual.sql schema version record
	 * provides a means of identifying MLZ clients that may require
	 * record conversion: 1 is for old-style client; 2 is for
	 * new-style clients. Old-style MLZ clients can be assumed to be
	 * at schema version 76, and so receive that value as
	 * mlzSchemaEntryLevel.
	 * 
	 * 
	 * 
	 * 
	 */

	/*
	 * Retrieve the DB schema version
	 */
	this.getDBVersion = function (schema) {
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
	
	
	this.userDataUpgradeRequired = function () {
		var dbVersion = this.getDBVersion('userdata');
		var schemaVersion = _getSchemaSQLVersion('userdata');
		// MLZ: upgrade if proposed userdata.sql version is greater than
		// database record, or if existing DB is not MLZ
		var multilingualVersion = this.getDBVersion('multilingual');
		return dbVersion && (!multilingualVersion || (dbVersion < schemaVersion));
	}
	
	this.showUpgradeWizard = function () {
		var dbVersion = this.getDBVersion('userdata');
		var schemaVersion = _getSchemaSQLVersion('userdata');
		
		// Upgrading from 1.0 or earlier
		if (dbVersion <= 36) {
			var integrityCheck = true;
			var majorUpgrade = true;
		}
		else {
			var integrityCheck = false;
			var majorUpgrade = false;
		}
		
		var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
					.getService(Components.interfaces.nsIWindowWatcher);
		var data = {
			success: false,
			majorUpgrade: majorUpgrade,
			integrityCheck: integrityCheck
		};
		var obj = { Zotero: Zotero, data: data };
		var io = { wrappedJSObject: obj };
		var win = ww.openWindow(null, "chrome://zotero/content/upgrade.xul",
					"zotero-schema-upgrade", "chrome,centerscreen,modal", io);
		
		if (obj.data.e) {
			if (obj.data.e.name && obj.data.e.name == "NS_ERROR_FAILURE" && obj.data.e.message.match(/nsIFile\.moveTo/)) {
				Zotero.logError(obj.data.e);
				return false;
			}
			
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
	this.updateSchema = function () {
		var dbVersion = this.getDBVersion('userdata');
 		
		// 'schema' check is for old (<= 1.0b1) schema system,
		// 'user' is for pre-1.0b2 'user' table
		if (!dbVersion && !this.getDBVersion('schema') && !this.getDBVersion('user')) {
			Zotero.debug('Database does not exist -- creating MLZ database\n');
			_initializeSchema();
			return true;
		}

		var schemaVersion = _getSchemaSQLVersion('userdata');

		try {
			Zotero.UnresponsiveScriptIndicator.disable();
			
			// If upgrading userdata, make backup of database first
			if (dbVersion < schemaVersion){
				Zotero.DB.backupDatabase(dbVersion);
				Zotero.wait(1000);
			}
			
			Zotero.DB.beginTransaction();
			
			try {
				// Old schema system
				if (!dbVersion){
					// Check for pre-1.0b2 'user' table
					 var user = this.getDBVersion('user');
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
				
				var up1 = _updateSchema('system');
				// Update custom tables if they exist so that changes are in place before user data migration
				if (Zotero.DB.tableExists('customItemTypes')) {
					this.updateCustomTables(up1);
				}
				if(up1) Zotero.wait();

				// If first-time install of multilingual against an existing DB,
				// make a permanent note of its version number, and bump the
				// "multilingual" version flag down to 1 to request extra-field-hack
				// record conversion.
				// Earlier (Z-compatible) MLZ clients have schema version 76
				var mlzVersion = this.getDBVersion('multilingual');
				if (!mlzVersion) {
					_updateSchema('multilingual');
					Zotero.wait();
   					_updateDBVersion('mlzSchemaEntryLevel', dbVersion);
					// Set entry level to userdata2 level, if available
					var dbVersion2 = this.getDBVersion('userdata2');
					if (dbVersion2) {
   						_updateDBVersion('mlzSchemaEntryLevel', dbVersion2);
					}
					_updateDBVersion('multilingual', 1);
				} else if (mlzVersion === 1) {
					_updateDBVersion('mlzSchemaEntryLevel', 76);
				}

				var up2 = _migrateUserDataSchema(dbVersion);

				var up4 = _updateSchema('triggers');
				if (up2) {
					// Update custom tables again in case custom fields were changed during user data migration
					this.updateCustomTables();
					Zotero.wait()
				}
				
				// MLZ: update language tables if required.
				var up5 = _updateSchema('zls')
				if (up5) Zotero.wait();

				Zotero.DB.commitTransaction();
			}
			catch(e){
				Zotero.debug(e);
				Zotero.DB.rollbackTransaction();
				throw(e);
			}
			
			if (up2) {
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
		}
		finally {
			Zotero.UnresponsiveScriptIndicator.enable();
		}
		
		// After a delay, start update of bundled files and repo updates
		setTimeout(function () {
			Zotero.UnresponsiveScriptIndicator.disable();
			Zotero.Schema.updateBundledFiles(null, false, true)
			.finally(function () {
				Zotero.UnresponsiveScriptIndicator.enable();
			})
			.done();
		}, 5000);
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
		Zotero.Schema.updateCustomTables();
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
	}
	
	
	this.updateCustomTables = function (skipDelete, skipSystem) {
		Zotero.debug("Updating custom tables");
		
		if (!skipDelete) {
			Zotero.DB.query("DELETE FROM itemTypesCombined");
			Zotero.DB.query("DELETE FROM fieldsCombined");
			Zotero.DB.query("DELETE FROM itemTypeFieldsCombined");
			Zotero.DB.query("DELETE FROM baseFieldMappingsCombined");
		}
		var offset = Zotero.ItemTypes.customIDOffset;
		Zotero.DB.query(
			"INSERT INTO itemTypesCombined "
				+ (
					skipSystem
					? ""
					: "SELECT itemTypeID, typeName, display, 0 AS custom FROM itemTypes UNION "
				)
				+ "SELECT customItemTypeID + " + offset + " AS itemTypeID, typeName, display, 1 AS custom FROM customItemTypes"
		);
		Zotero.DB.query(
			"INSERT INTO fieldsCombined "
				+ (
					skipSystem
					? ""
					: "SELECT fieldID, fieldName, NULL AS label, fieldFormatID, 0 AS custom FROM fields UNION "
				)
				+ "SELECT customFieldID + " + offset + " AS fieldID, fieldName, label, NULL, 1 AS custom FROM customFields"
		);
		Zotero.DB.query(
			"INSERT INTO itemTypeFieldsCombined "
				+ (
					skipSystem
					? ""
					: "SELECT itemTypeID, fieldID, hide, orderIndex FROM itemTypeFields UNION "
				)
				+ "SELECT customItemTypeID + " + offset + " AS itemTypeID, "
					+ "COALESCE(fieldID, customFieldID + " + offset + ") AS fieldID, hide, orderIndex FROM customItemTypeFields"
		);
		Zotero.DB.query(
			"INSERT INTO baseFieldMappingsCombined "
				+ (
					skipSystem
					? ""
					: "SELECT itemTypeID, baseFieldID, fieldID FROM baseFieldMappings UNION "
				)
				+ "SELECT customItemTypeID + " + offset + " AS itemTypeID, baseFieldID, "
					+ "customFieldID + " + offset + " AS fieldID FROM customBaseFieldMappings"
		);
	}
	
	
	/**
	 * Update styles and translators in data directory with versions from
	 * ZIP file (XPI) or directory (source) in extension directory
	 *
	 * @param	{String}	[mode]					'translators' or 'styles'
	 * @param	{Boolean}	[skipDeleteUpdated]		Skip updating of the file deleting version --
	 *												since deleting uses a single version table key,
	 * 												it should only be updated the last time through
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
				var deferred = Q.defer();
				if (updated) {
					if (Zotero.Prefs.get('automaticScraperUpdates')) {
						Zotero.proxyAuthComplete
						.then(function () {
							Zotero.Schema.updateFromRepository(2, function () deferred.resolve());
						})
					}
				}
				else {
					Zotero.proxyAuthComplete
					.then(function () {
						Zotero.Schema.updateFromRepository(false, function () deferred.resolve());
					})
					.done();
				}
				return deferred.promise;
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
		
		// MLZ: temporary
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
	 * @param	{Function}	callback
	 */
	this.updateFromRepository = function (force, callback) {
		if (!force){
			if (_remoteUpdateInProgress) {
				Zotero.debug("A remote update is already in progress -- not checking repository");
				return false;
			}
			
			// Check user preference for automatic updates
			if (!Zotero.Prefs.get('automaticScraperUpdates')){
				Zotero.debug('Automatic repository updating disabled -- not checking repository', 4);
				return false;
			}
			
			// Determine the earliest local time that we'd query the repository again
			var nextCheck = new Date();
			nextCheck.setTime((parseInt(this.getDBVersion('lastcheck'))
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
		
		// If transaction already in progress, delay by ten minutes
		if (Zotero.DB.transactionInProgress()){
			Zotero.debug('Transaction in progress -- delaying repository check', 4)
			_setRepositoryTimer(600);
			return false;
		}
		
		// Get the last timestamp we got from the server
		var lastUpdated = this.getDBVersion('repository');
		
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
		
		var get = Zotero.HTTP.doPost(url, body, function (xmlhttp) {
			var updated = _updateFromRepositoryCallback(xmlhttp, !!force);
			if (callback) {
				callback(xmlhttp, updated)
			}
		});
		
		// TODO: instead, add an observer to start and stop timer on online state change
		if (!get){
			Zotero.debug('Browser is offline -- skipping check');
			_setRepositoryTimer(ZOTERO_CONFIG['REPOSITORY_RETRY_INTERVAL']);
		}
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
		Zotero.Translators.init();
		this.updateBundledFiles('translators', null, false);
		
		var stylesDir = Zotero.getStylesDirectory();
		stylesDir.remove(true);
		Zotero.getStylesDirectory(); // recreate directory
		Zotero.Styles.init();
		this.updateBundledFiles('styles', null, true)
		.then(function () {
			if (callback) {
				callback();
			}
		})
		.done();
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
		Zotero.Translators.init();
		this.updateBundledFiles('translators', null, true)
		.then(function () {
			if (callback) {
				callback();
			}
		})
		.done();
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
		Zotero.Styles.init();
		this.updateBundledFiles('styles', null, true)
		.then(function () {
			if (callback) {
				callback();
			}
		})
		.done();
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
	
	/*
	 * Retrieve the version from the top line of the schema SQL file
	 */
	function _getSchemaSQLVersion(schema){
		var sql = _getSchemaSQL(schema);
		
		// Fetch the schema version from the first line of the file
		var schemaVersion = parseInt(sql.match(/^-- ([0-9]+)/)[1]);
		
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
		
		return Zotero.File.getContentsFromURL("resource://zotero/schema/"+schema+".sql");
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
		var sql = _getSchemaSQL(schema);
		
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
		Zotero.DB.beginTransaction();
		try {
			// Enable auto-vacuuming
			Zotero.DB.query("PRAGMA page_size = 4096");
			Zotero.DB.query("PRAGMA encoding = 'UTF-8'");
			Zotero.DB.query("PRAGMA auto_vacuum = 1");
			
			Zotero.DB.query(_getSchemaSQL('system'));
			Zotero.DB.query(_getSchemaSQL('userdata'));
			Zotero.DB.query(_getSchemaSQL('triggers'));
			Zotero.DB.query(_getSchemaSQL('multilingual'));
			Zotero.DB.query(_getSchemaSQL('zls'));
			Zotero.Schema.updateCustomTables(true);
			
			_updateDBVersion('system', _getSchemaSQLVersion('system'));
			_updateDBVersion('userdata', _getSchemaSQLVersion('userdata'));
			_updateDBVersion('triggers', _getSchemaSQLVersion('triggers'));
			_updateDBVersion('multilingual', _getSchemaSQLVersion('multilingual'));
			_updateDBVersion('zls', _getSchemaSQLVersion('zls'));
			
			if (!Zotero.Schema.skipDefaultData) {
				// Quick Start Guide web page item
				var sql = "INSERT INTO items VALUES(1, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, 'ABCD2345')";
				Zotero.DB.query(sql);
				var sql = "INSERT INTO itemDataValues VALUES (1, ?)";
				Zotero.DB.query(sql, Zotero.getString('install.quickStartGuide'));
				var sql = "INSERT INTO itemData VALUES (1, 110, 1)";
				Zotero.DB.query(sql);
				var sql = "INSERT INTO itemDataValues VALUES (2, 'http://zotero.org/support/quick_start_guide')";
				Zotero.DB.query(sql);
				var sql = "INSERT INTO itemData VALUES (1, 1, 2)";
				Zotero.DB.query(sql);
				
				// CHNM as creator
				var sql = "INSERT INTO creatorData VALUES (1, '', 'Center for History and New Media', '', 1, NULL)";
				Zotero.DB.query(sql);
				var sql = "INSERT INTO creators VALUES (1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, 'ABCD2345')";
				Zotero.DB.query(sql);
				var sql = "INSERT INTO itemCreators VALUES (1, 1, 1, 0)";
				Zotero.DB.query(sql);
				
				// Welcome note
				var sql = "INSERT INTO items VALUES(2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL, 'ABCD3456')";
				Zotero.DB.query(sql);
				var welcomeTitle = Zotero.getString('install.quickStartGuide.message.welcome');
				var welcomeMsg = '<div class="zotero-note znv1"><p><strong>' + welcomeTitle + '</strong></p>'
					+ '<p>' + Zotero.getString('install.quickStartGuide.message.view') + '</p>'
					+ '<p>' + Zotero.getString('install.quickStartGuide.message.thanks') + '</p></div>';
				var sql = "INSERT INTO itemNotes VALUES (2, 1, ?, ?)";
				Zotero.DB.query(sql, [welcomeMsg, welcomeTitle]);
			}
			Zotero.DB.commitTransaction();
			
			self.dbInitialized = true;
		}
		catch(e){
			Zotero.debug(e, 1);
			Zotero.logError(e);
			Zotero.DB.rollbackTransaction();
			alert('Error initializing Zotero database');
			throw(e);
		}
		
		Zotero.Schema.updateBundledFiles(null, null, true)
		.catch(function (e) {
			Zotero.debug(e);
			Zotero.logError(e);
			alert('Error updating Zotero translators and styles');
		});
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
		var dbVersion = Zotero.Schema.getDBVersion(schema);
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

		// MLZ: decommissioning this code use for very early MLZ migrations.
		// It is not conceivable that instances of the early client schema are still in service.
		//
		//else if (dbVersion == 32 && schemaVersion == 31 && !Zotero.Schema.getDBVersion('multilingual')) {
		//	_updateDBVersion(schema, schemaVersion);
		//	return false;
		//}
		
		throw ("Zotero '" + schema + "' DB version (" + dbVersion
			+ ") is newer than SQL file (" + schemaVersion + ")");
	}
	
	
	function _tableExists (tablename) {
		var sql = "SELECT count(*) FROM sqlite_master WHERE name=? AND type='table'";
		if (Zotero.DB.valueQuery(sql, [tablename])) {
			return true;
		} else {
			return false;
		}
	};

	/**
	* Process the response from the repository
	**/
	function _updateFromRepositoryCallback(xmlhttp, manual){
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
		
		// TODO: clear DB version 'sync' from removed _updateDBVersion()
		
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
				_translatorXMLToFile(translatorUpdates[i]);
			}
			
			for (var i=0, len=styleUpdates.length; i<len; i++){
				_styleXMLToFile(styleUpdates[i]);
			}
			
			// Rebuild caches
			Zotero.Translators.init();
			Zotero.Styles.init();
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
	**/
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
		Zotero.File.putContents(destFile, str);
		return;
	}
	

	/*
	 * Migrate user data schema from an older version, preserving data
	 */
	function _migrateUserDataSchema(fromVersion){
		// MLZ: get multilingual database version record (i.e. multilingual fromVersion)
		var dbMultilingualVersion = Zotero.Schema.getDBVersion('multilingual');
		var mlzSchemaEntryLevel = Zotero.Schema.getDBVersion('mlzSchemaEntryLevel');
		var toVersion = _getSchemaSQLVersion('userdata');

		if (fromVersion==toVersion){
			return false;
		}
		
		// 77 is a hack for full-text content syncing
		if (fromVersion == 77) {
            // Uncommenting this will cause MLZ to superfluously request
            // an upgrade every time Firefox is started.
			//return false;
		}
		else if (fromVersion > toVersion) {
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
								var f = function(text) { text = text + ''; var t = text.substring(0, 80); var ln = t.indexOf("\n"); if (ln>-1 && ln<80) { t = t.substring(0, ln); } return t; }
								for (var j=0; j<notes.length; j++) {
									Zotero.DB.query("REPLACE INTO itemNoteTitles VALUES (?,?)", [notes[j]['itemID'], f(notes[j]['note'])]);
								}
							}
							
							Zotero.DB.query("CREATE TABLE itemDataValues (\n    valueID INT,\n    value,\n    PRIMARY KEY (valueID)\n);");
							var values = Zotero.DB.columnQuery("SELECT DISTINCT value FROM itemData");
							if (values) {
								for (var j=0; j<values.length; j++) {
									var valueID = Zotero.ID.get('itemDataValues');
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
									var valueID = Zotero.ID.get('itemDataValues');
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
						var itemID = Zotero.ID.get('items', true);
						Zotero.DB.query("UPDATE items SET itemID=? WHERE itemID=?", [itemID, 0]);
						Zotero.DB.query("UPDATE itemData SET itemID=? WHERE itemID=?", [itemID, 0]);
						Zotero.DB.query("UPDATE itemNotes SET itemID=? WHERE itemID=?", [itemID, 0]);
						Zotero.DB.query("UPDATE itemAttachments SET itemID=? WHERE itemID=?", [itemID, 0]);
					}
					if (Zotero.DB.valueQuery("SELECT COUNT(*) FROM collections WHERE collectionID=0")) {
						var collectionID = Zotero.ID.get('collections', true);
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
							var valueID = Zotero.ID.get('itemDataValues');
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
									var valueID = Zotero.ID.get('itemDataValues');
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
							var f = function(text) { text = text + ''; var t = text.substring(0, 80); var ln = t.indexOf("\n"); if (ln>-1 && ln<80) { t = t.substring(0, ln); } return t; }
							Zotero.DB.query("UPDATE itemNoteTitles SET title=? WHERE itemID=?", [f(reversed[maxLengthIndex].itemID), childNotes[j].itemID]);
						}
						Zotero.DB.query("DELETE FROM itemNotes WHERE note=? AND sourceItemID=?", [childNotes[j].itemID, childNotes[j].sourceItemID]);
					}
				}
				
				// 1.0.0b4.r2
				
				if (i==29) {
					Zotero.DB.query("CREATE TABLE IF NOT EXISTS settings (\n    setting TEXT,\n    key TEXT,\n    value,\n    PRIMARY KEY (setting, key)\n);");
				}
				
				if (i==31) {
					Zotero.DB.query("UPDATE itemData SET fieldID=14 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=15) AND fieldID=100");
				}
				
				if (i==32) {
					Zotero.DB.query("UPDATE itemData SET fieldID=100 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=20) AND fieldID=14;");
				}
				
				// 1.0.0b4.r3
				
				if (i==33) {
					var rows = Zotero.DB.query("SELECT * FROM itemNotes WHERE itemID NOT IN (SELECT itemID FROM items)");
					if (rows) {
						var colID = Zotero.ID.get('collections');
						Zotero.DB.query("INSERT INTO collections VALUES (?,?,?)", [colID, "[Recovered Notes]", null]);
						
						for (var j=0; j<rows.length; j++) {
							if (rows[j].sourceItemID) {
								var count = Zotero.DB.valueQuery("SELECT COUNT(*) FROM items WHERE itemID=?", rows[j].sourceItemID);
								if (count == 0) {
									Zotero.DB.query("UPDATE itemNotes SET sourceItemID=NULL WHERE itemID=?", rows[j].sourceItemID);
								}
							}
							var parsedID = parseInt(rows[j].itemID);
							if ((parsedID + '').length != rows[j].itemID) {
								if (parseInt(rows[j].note) != rows[j].note ||
										(parseInt(rows[j].note) + '').length != rows[j].note.length) {
									Zotero.DB.query("DELETE FROM itemNotes WHERE itemID=?", rows[j].itemID);
									continue;
								}
								var exists = Zotero.DB.valueQuery("SELECT COUNT(*) FROM itemNotes WHERE itemID=?", rows[j].note);
								if (exists) {
									var noteItemID = Zotero.ID.get('items', true);
								}
								else {
									var noteItemID = rows[j].note;
								}
								Zotero.DB.query("UPDATE itemNotes SET itemID=?, sourceItemID=NULL, note=? WHERE itemID=? AND sourceItemID=?", [noteItemID, rows[j].itemID, rows[j].itemID, rows[j].sourceItemID]);
								var f = function(text) { text = text + ''; var t = text.substring(0, 80); var ln = t.indexOf("\n"); if (ln>-1 && ln<80) { t = t.substring(0, ln); } return t; }
								Zotero.DB.query("REPLACE INTO itemNoteTitles VALUES (?,?)", [noteItemID, f(rows[j].itemID)]);
								Zotero.DB.query("INSERT OR IGNORE INTO items (itemID, itemTypeID) VALUES (?,?)", [noteItemID, 1]);
								var max = Zotero.DB.valueQuery("SELECT COUNT(*) FROM collectionItems WHERE collectionID=?", colID);
								Zotero.DB.query("INSERT OR IGNORE INTO collectionItems VALUES (?,?,?)", [colID, noteItemID, max]);
								continue;
							}
							else if (parsedID != rows[j].itemID) {
								Zotero.DB.query("DELETE FROM itemNotes WHERE itemID=?", rows[j].itemID);
								continue;
							}
							Zotero.DB.query("INSERT INTO items (itemID, itemTypeID) VALUES (?,?)", [rows[j].itemID, 1]);
							var max = Zotero.DB.valueQuery("SELECT COUNT(*) FROM collectionItems WHERE collectionID=?", colID);
							Zotero.DB.query("INSERT INTO collectionItems VALUES (?,?,?)", [colID, rows[j].itemID, max]);
						}
					}
				}
				
				// 1.0.0b4.r5
				
				if (i==34) {
					if (!Zotero.DB.tableExists('annotations')) {
						Zotero.DB.query("CREATE TABLE annotations (\n    annotationID INTEGER PRIMARY KEY,\n    itemID INT,\n    parent TEXT,\n    textNode INT,\n    offset INT,\n    x INT,\n    y INT,\n    cols INT,\n    rows INT,\n    text TEXT,\n    collapsed BOOL,\n    dateModified DATE,\n    FOREIGN KEY (itemID) REFERENCES itemAttachments(itemID)\n)");
						Zotero.DB.query("CREATE INDEX annotations_itemID ON annotations(itemID)");
					}
					else {
						Zotero.DB.query("ALTER TABLE annotations ADD collapsed BOOL");
						Zotero.DB.query("ALTER TABLE annotations ADD dateModified DATETIME");
					}
					if (!Zotero.DB.tableExists('highlights')) {
						Zotero.DB.query("CREATE TABLE highlights (\n    highlightID INTEGER PRIMARY KEY,\n    itemID INTEGER,\n    startParent TEXT,\n    startTextNode INT,\n    startOffset INT,\n    endParent TEXT,\n    endTextNode INT,\n    endOffset INT,\n    dateModified DATE,\n    FOREIGN KEY (itemID) REFERENCES itemAttachments(itemID)\n)");
						Zotero.DB.query("CREATE INDEX highlights_itemID ON highlights(itemID)");
					}
					else {
						Zotero.DB.query("ALTER TABLE highlights ADD dateModified DATETIME");
					}
					Zotero.DB.query("UPDATE annotations SET dateModified = DATETIME('now')");
					Zotero.DB.query("UPDATE highlights SET dateModified = DATETIME('now')");
				}
				
				if (i==35) {
					Zotero.DB.query("ALTER TABLE fulltextItems RENAME TO fulltextItemWords");
					Zotero.DB.query("CREATE TABLE fulltextItems (\n    itemID INT,\n    version INT,\n    PRIMARY KEY (itemID),\n    FOREIGN KEY (itemID) REFERENCES items(itemID)\n);");
				}
				
				if (i==36) {
					Zotero.DB.query("ALTER TABLE fulltextItems ADD indexedPages INT");
					Zotero.DB.query("ALTER TABLE fulltextItems ADD totalPages INT");
					Zotero.DB.query("ALTER TABLE fulltextItems ADD indexedChars INT");
					Zotero.DB.query("ALTER TABLE fulltextItems ADD totalChars INT");
					Zotero.DB.query("DELETE FROM version WHERE schema='fulltext'");
				}
				
				// 1.5 Sync Preview 1
				if (i==37) {
					// Some data cleanup from the pre-FK-trigger days
					Zotero.DB.query("DELETE FROM annotations WHERE itemID NOT IN (SELECT itemID FROM items)");
					Zotero.DB.query("DELETE FROM collectionItems WHERE itemID NOT IN (SELECT itemID FROM items)");
					Zotero.DB.query("DELETE FROM fulltextItems WHERE itemID NOT IN (SELECT itemID FROM items)");
					Zotero.DB.query("DELETE FROM fulltextItemWords WHERE itemID NOT IN (SELECT itemID FROM items)");
					Zotero.DB.query("DELETE FROM highlights WHERE itemID NOT IN (SELECT itemID FROM items)");
					Zotero.DB.query("DELETE FROM itemAttachments WHERE itemID NOT IN (SELECT itemID FROM items)");
					Zotero.DB.query("DELETE FROM itemCreators WHERE itemID NOT IN (SELECT itemID FROM items)");
					Zotero.DB.query("DELETE FROM itemData WHERE itemID NOT IN (SELECT itemID FROM items)");
					Zotero.DB.query("DELETE FROM itemNotes WHERE itemID NOT IN (SELECT itemID FROM items)");
					Zotero.DB.query("DELETE FROM itemNoteTitles WHERE itemID NOT IN (SELECT itemID FROM itemNotes)");
					Zotero.DB.query("DELETE FROM itemSeeAlso WHERE itemID NOT IN (SELECT itemID FROM items)");
					Zotero.DB.query("DELETE FROM itemSeeAlso WHERE linkedItemID NOT IN (SELECT itemID FROM items)");
					Zotero.DB.query("DELETE FROM itemTags WHERE itemID NOT IN (SELECT itemID FROM items)");
					Zotero.DB.query("DELETE FROM itemTags WHERE tagID NOT IN (SELECT tagID FROM tags)");
					Zotero.DB.query("DELETE FROM savedSearchConditions WHERE savedSearchID NOT IN (select savedSearchID FROM savedSearches)");
					Zotero.DB.query("DELETE FROM items WHERE itemTypeID IS NULL");
					
					Zotero.DB.query("DELETE FROM itemData WHERE valueID NOT IN (SELECT valueID FROM itemDataValues)");
					Zotero.DB.query("DELETE FROM fulltextItemWords WHERE wordID NOT IN (SELECT wordID FROM fulltextWords)");
					Zotero.DB.query("DELETE FROM collectionItems WHERE collectionID NOT IN (SELECT collectionID FROM collections)");
					Zotero.DB.query("DELETE FROM itemCreators WHERE creatorID NOT IN (SELECT creatorID FROM creators)");
					Zotero.DB.query("DELETE FROM itemTags WHERE tagID NOT IN (SELECT tagID FROM tags)");
					Zotero.DB.query("DELETE FROM itemData WHERE fieldID NOT IN (SELECT fieldID FROM fields)");
					Zotero.DB.query("DELETE FROM itemData WHERE valueID NOT IN (SELECT valueID FROM itemDataValues)");
					
					Zotero.DB.query("DROP TABLE IF EXISTS userFieldMask");
					Zotero.DB.query("DROP TABLE IF EXISTS userItemTypes");
					Zotero.DB.query("DROP TABLE IF EXISTS userItemTypeMask");
					Zotero.DB.query("DROP TABLE IF EXISTS userFields");
					Zotero.DB.query("DROP TABLE IF EXISTS userItemTypeFields");
					
					Zotero.wait();
					
					// Index corruption can allow duplicate values
					var wordIDs = Zotero.DB.columnQuery("SELECT GROUP_CONCAT(wordID) AS wordIDs FROM fulltextWords GROUP BY word HAVING COUNT(*)>1");
					if (wordIDs.length) {
						Zotero.DB.query("CREATE TEMPORARY TABLE deleteWordIDs (wordID INTEGER PRIMARY KEY)");
						for (var j=0, len=wordIDs.length; j<len; j++) {
							var ids = wordIDs[j].split(',');
							for (var k=1; k<ids.length; k++) {
								Zotero.DB.query("INSERT INTO deleteWordIDs VALUES (?)", ids[k]);
							}
						}
						Zotero.DB.query("DELETE FROM fulltextWords WHERE wordID IN (SELECT wordID FROM deleteWordIDs)");
						Zotero.DB.query("DROP TABLE deleteWordIDs");
					}
					
					Zotero.DB.query("DROP INDEX IF EXISTS fulltextWords_word");
					
					Zotero.wait();
					
					Zotero.DB.query("REINDEX");
					Zotero.DB.transactionVacuum = true;
					
					Zotero.wait();
					
					// Set page cache size to 8MB
					var pageSize = Zotero.DB.valueQuery("PRAGMA page_size");
					var cacheSize = 8192000 / pageSize;
					Zotero.DB.query("PRAGMA default_cache_size=" + cacheSize);
					
					// Orphaned child attachment
					Zotero.DB.query("UPDATE itemAttachments SET sourceItemID=NULL WHERE sourceItemID NOT IN (SELECT itemID FROM items)");
					Zotero.DB.query("UPDATE itemNotes SET sourceItemID=NULL WHERE sourceItemID NOT IN (SELECT itemID FROM items)");
					
					// Create sync delete log
					Zotero.DB.query("CREATE TABLE syncDeleteLog (\n    syncObjectTypeID INT NOT NULL,\n    objectID INT NOT NULL,\n    key TEXT NOT NULL,\n    timestamp INT NOT NULL,\n    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID)\n);");
					Zotero.DB.query("CREATE INDEX syncDeleteLog_timestamp ON syncDeleteLog(timestamp);");
					
					Zotero.wait();
					
					// Note titles
					Zotero.DB.query("ALTER TABLE itemNotes ADD COLUMN title TEXT");
					var notes = Zotero.DB.query("SELECT itemID, title FROM itemNoteTitles");
					if (notes) {
						var statement = Zotero.DB.getStatement("UPDATE itemNotes SET title=? WHERE itemID=?");
						for (var j=0, len=notes.length; j<len; j++) {
							statement.bindUTF8StringParameter(0, notes[j].title);
							statement.bindInt32Parameter(1, notes[j].itemID);
							try {
								statement.execute();
							}
							catch (e) {
								throw (Zotero.DB.getLastErrorString());
							}
						}
						statement.reset();
					}
					Zotero.DB.query("DROP TABLE itemNoteTitles");
					
					Zotero.wait();
					
					// Creator data
					Zotero.DB.query("CREATE TABLE creatorData (\n    creatorDataID INTEGER PRIMARY KEY,\n    firstName TEXT,\n    lastName TEXT,\n    shortName TEXT,\n    fieldMode INT,\n    birthYear INT\n)");
					Zotero.DB.query("INSERT INTO creatorData SELECT DISTINCT NULL, firstName, lastName, NULL, fieldMode, NULL FROM creators WHERE creatorID IN (SELECT creatorID FROM itemCreators)");
					Zotero.DB.query("CREATE TEMPORARY TABLE itemCreatorsTemp AS SELECT * FROM itemCreators NATURAL JOIN creators");
					Zotero.DB.query("DROP TABLE creators");
					Zotero.DB.query("CREATE TABLE creators (\n    creatorID INTEGER PRIMARY KEY,\n    creatorDataID INT,\n    dateModified DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    key TEXT NOT NULL,\n    FOREIGN KEY (creatorDataID) REFERENCES creatorData(creatorDataID)\n);");
					
					Zotero.wait();
					
					var data = Zotero.DB.query("SELECT * FROM creatorData");
					if (data) {
						Zotero.DB.query("CREATE INDEX itemCreatorsTemp_names ON itemCreatorsTemp(lastName, firstName)");
						Zotero.DB.query("DELETE FROM itemCreators");

						// For each distinct data row, create a new creator
						var insertStatement = Zotero.DB.getStatement("INSERT INTO creators (creatorID, creatorDataID, key) VALUES (?, ?, ?)");
						for (var j=0, len=data.length; j<len; j++) {
							insertStatement.bindInt32Parameter(0, data[j].creatorDataID);
							insertStatement.bindInt32Parameter(1, data[j].creatorDataID);
							var key = Zotero.Utilities.generateObjectKey();
							insertStatement.bindStringParameter(2, key);
							try {
								insertStatement.execute();
							}
							catch (e) {
								throw (Zotero.DB.getLastErrorString());
							}
						}
						insertStatement.reset();
						
						Zotero.DB.query("INSERT INTO itemCreators SELECT itemID, C.creatorID, creatorTypeID, orderIndex FROM itemCreatorsTemp ICT JOIN creatorData CD ON (ICT.firstName=CD.firstName AND ICT.lastName=CD.lastName AND ICT.fieldMode=CD.fieldMode) JOIN creators C ON (CD.creatorDataID=C.creatorDataID)");
					}
					Zotero.DB.query("DROP TABLE itemCreatorsTemp");
					Zotero.DB.query("CREATE INDEX creators_creatorDataID ON creators(creatorDataID)");
					
					Zotero.wait();
					
					// Items
					Zotero.DB.query("ALTER TABLE items ADD COLUMN key TEXT");
					
					var items = Zotero.DB.query("SELECT itemID, itemTypeID, dateAdded FROM items");
					var titles = Zotero.DB.query("SELECT itemID, value FROM itemData NATURAL JOIN itemDataValues WHERE fieldID BETWEEN 110 AND 112");
					var statement = Zotero.DB.getStatement("UPDATE items SET key=? WHERE itemID=?");
					for (var j=0, len=items.length; j<len; j++) {
						var key = Zotero.Utilities.generateObjectKey();
						if (key == 'AJ4PT6IT') {
							j--;
							continue;
						}
						else if (items[j].itemID == 123456789) {
							key = 'AJ4PT6IT';
						}
						statement.bindStringParameter(0, key);
						statement.bindInt32Parameter(1, items[j].itemID);
						try {
							statement.execute();
						}
						catch (e) {
							throw (Zotero.DB.getLastErrorString());
						}
					}
					statement.reset();
					Zotero.DB.query("CREATE UNIQUE INDEX items_key ON items(key)");
					
					Zotero.wait();
					
					var rows = Zotero.DB.columnQuery("SELECT GROUP_CONCAT(valueID) FROM itemDataValues GROUP BY value HAVING COUNT(*) > 1");
					for each(var row in rows) {
						var ids = row.split(',');
						var id = parseInt(ids[0]);
						var deleteIDs = [];
						for (var j=1; j<ids.length; j++) {
							deleteIDs.push(parseInt(ids[j]));
						}
						
						var done = 0;
						var max = 998; // compiled limit
						var num = deleteIDs.length;
						
						do {
							var chunk = deleteIDs.splice(0, max);
							
							Zotero.DB.query("UPDATE itemData SET valueID=? WHERE valueID IN (" + chunk.map(function () '?').join() + ")", [id].concat(chunk));
							Zotero.DB.query("DELETE FROM itemDataValues WHERE valueID IN (" + chunk.map(function () '?').join() + ")", chunk);
							
							done += chunk.length;
						}
						while (done < num);
					}
					Zotero.DB.query("CREATE UNIQUE INDEX itemDataValues_value ON itemDataValues(value)");
					
					Zotero.wait();
					
					// Collections
					var collections = Zotero.DB.query("SELECT * FROM collections");
					Zotero.DB.query("DROP TABLE collections");
					Zotero.DB.query("CREATE TABLE collections (\n    collectionID INTEGER PRIMARY KEY,\n    collectionName TEXT,\n    parentCollectionID INT,\n    dateModified DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    key TEXT NOT NULL UNIQUE,\n    FOREIGN KEY (parentCollectionID) REFERENCES collections(collectionID)\n);");
					var statement = Zotero.DB.getStatement("INSERT INTO collections (collectionID, collectionName, parentCollectionID, key) VALUES (?,?,?,?)");
					for (var j=0, len=collections.length; j<len; j++) {
						statement.bindInt32Parameter(0, collections[j].collectionID);
						statement.bindUTF8StringParameter(1, collections[j].collectionName);
						if (collections[j].parentCollectionID) {
							statement.bindInt32Parameter(2, collections[j].parentCollectionID);
						}
						else {
							statement.bindNullParameter(2);
						}
						var key = Zotero.Utilities.generateObjectKey();
						statement.bindStringParameter(3, key);
						
						try {
							statement.execute();
						}
						catch (e) {
							throw (Zotero.DB.getLastErrorString());
						}
					}
					statement.reset();
					
					Zotero.wait();
					
					// Saved searches
					var searches = Zotero.DB.query("SELECT * FROM savedSearches");
					Zotero.DB.query("DROP TABLE savedSearches");
					Zotero.DB.query("CREATE TABLE savedSearches (\n    savedSearchID INTEGER PRIMARY KEY,\n    savedSearchName TEXT,\n    dateModified DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    key TEXT NOT NULL UNIQUE\n);");
					var statement = Zotero.DB.getStatement("INSERT INTO savedSearches (savedSearchID, savedSearchName, key) VALUES (?,?,?)");
					for (var j=0, len=searches.length; j<len; j++) {
						statement.bindInt32Parameter(0, searches[j].savedSearchID);
						statement.bindUTF8StringParameter(1, searches[j].savedSearchName);
						var key = Zotero.Utilities.generateObjectKey();
						statement.bindStringParameter(2, key);

						try {
							statement.execute();
						}
						catch (e) {
							throw (Zotero.DB.getLastErrorString());
						}
					}
					statement.reset();
					
					Zotero.wait();
					
					// Tags
					var tags = Zotero.DB.query("SELECT tagID, tag AS tag, tagType FROM tags");
					var newTags = [];
					var cases = {};
					if (tags) {
						// Find tags with multiple case forms
						for each(var row in tags) {
							var l = '_' + row.tag.toLowerCase();
							if (!cases[l]) {
								cases[l] = [];
							}
							if (cases[l].indexOf(row.tag) == -1) {
								cases[l].push(row.tag);
							}
						}
						var done = {};
						for each(var row in tags) {
							var l = row.tag.toLowerCase();
							var lk = '_' + l;
							
							if (done[lk]) {
								continue;
							}
							done[lk] = true;
							
							// Only one tag -- use
							if (cases[lk].length == 1) {
								newTags.push(row);
								continue;
							}
							
							var counts = Zotero.DB.query("SELECT tag, COUNT(*) AS numItems FROM tags NATURAL JOIN itemTags WHERE tag LIKE ? ESCAPE '`' GROUP BY tag ORDER BY numItems DESC", l.replace('_', '`_').replace('%', '`%'));
							// If not associated with any items, use all lowercase
							if (!counts) {
								var newTag = l;
							}
							// Use most frequent
							else if (counts[0].numItems != counts[1].numItems) {
								var newTag = counts[0].tag;
							}
							// Use earliest
							else {
								var newTag = Zotero.DB.valueQuery("SELECT tag FROM tags NATURAL JOIN itemTags WHERE tag IN (SELECT tag FROM tags NATURAL JOIN itemTags NATURAL JOIN items WHERE tag LIKE ? ESCAPE '`' ORDER BY dateAdded LIMIT 1) GROUP BY tag", l.replace('_', '`_').replace('%', '`%'));
							}
							
							// Point old to new
							var types = Zotero.DB.columnQuery("SELECT DISTINCT tagType FROM tags WHERE tag LIKE ? ESCAPE '`'", l.replace('_', '`_').replace('%', '`%'));
							for each(var type in types) {
								var newTagID = Zotero.DB.valueQuery("SELECT tagID FROM tags WHERE tag=? AND tagType=?", [newTag, type]);
								var oldIDs = Zotero.DB.columnQuery("SELECT tagID FROM tags WHERE tag LIKE ? ESCAPE '`' AND tag != ? AND tagType=?", [l.replace('_', '`_').replace('%', '`%'), newTag, type]);
								if (oldIDs) {
									if (!newTagID) {
										newTagID = oldIDs[0];
									}
									Zotero.DB.query("UPDATE OR REPLACE itemTags SET tagID=? WHERE tagID IN (" + oldIDs.map(function () '?').join() + ")", [newTagID].concat(oldIDs));
								}
								newTags.push({ tagID: newTagID, tag: newTag, tagType: type });
							}
						}
					}
					
					Zotero.wait();
					
					Zotero.DB.query("DROP TABLE tags");
					Zotero.DB.query("CREATE TABLE tags (\n    tagID INTEGER PRIMARY KEY,\n    name TEXT COLLATE NOCASE,\n    type INT,\n    dateModified DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    key TEXT NOT NULL UNIQUE,\n    UNIQUE (name, type)\n)");
					var statement = Zotero.DB.getStatement("INSERT INTO tags (tagID, name, type, key) VALUES (?,?,?,?)");
					for (var j=0, len=newTags.length; j<len; j++) {
						statement.bindInt32Parameter(0, newTags[j].tagID);
						statement.bindUTF8StringParameter(1, newTags[j].tag);
						statement.bindInt32Parameter(2, newTags[j].tagType);
						var key = Zotero.Utilities.generateObjectKey();
						statement.bindStringParameter(3, key);

						try {
							statement.execute();
						}
						catch (e) {
							throw (Zotero.DB.getLastErrorString());
						}
					}
					statement.reset();
					
					Zotero.wait();
					
					// Migrate attachment folders to secondary keys
					Zotero.DB.query("UPDATE itemAttachments SET path=REPLACE(path, itemID || '/', 'storage:') WHERE path REGEXP '^[0-9]+/'");
					
					if (Zotero.Prefs.get('useDataDir')) {
						var dataDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
						dataDir.persistentDescriptor = Zotero.Prefs.get('dataDir');
					}
					else {
						var dataDir = Zotero.getProfileDirectory();
						dataDir.append('zotero');
					}
					if (!dataDir.exists() || !dataDir.isDirectory()){
						var e = { name: "NS_ERROR_FILE_NOT_FOUND" };
						throw (e);
					}
					var movedFiles37 = {};
					var moveReport = '';
					var orphaned = dataDir.clone();
					var storage37 = dataDir.clone();
					var moveReportFile = dataDir.clone();
					orphaned.append('orphaned-files');
					storage37.append('storage');
					moveReportFile.append('zotero.moved-files.' + fromVersion + '.bak');
					var keys = {};
					var rows = Zotero.DB.query("SELECT itemID, key FROM items");
					for each(var row in rows) {
						keys[row.itemID] = row.key;
					}

					if (storage37.exists()) {
						var entries = storage37.directoryEntries;
						entries.QueryInterface(Components.interfaces.nsIDirectoryEnumerator);
						var file;
						var renameQueue = [];
						var orphanQueue = [];
						while (file = entries.nextFile) {
							var id = parseInt(file.leafName);
							if (!file.isDirectory() || file.leafName != id) {
								continue;
							}
							if (keys[id]) {
								var renameTarget = storage37.clone();
								renameTarget.append(keys[id]);
								if (renameTarget.exists()) {
									orphanQueue.push({
										id: id,
										file: renameTarget
									});
								}
								renameQueue.push({
									id: id,
									file: file,
									key: keys[id]
								});
							} else {
								orphanQueue.push({
									id: id,
									file: file
								});
							}
						}
						entries.close();
						
						Zotero.wait();
						
						if (orphanQueue.length) {
							if (!orphaned.exists()) {
								orphaned.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
							}
							for each(var orphan in orphanQueue) {
								var target = orphaned.clone();
								target.append(orphan.file.leafName);
								var newName = null;
								if (target.exists()) {
									try {
										target.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
										newName = target.leafName;
									}
									catch (e) {
										// DEBUG: Work around createUnique() brokenness on Windows
										// as of Fx3.0.4 (https://bugzilla.mozilla.org/show_bug.cgi?id=452217)
										//
										// We just delete the conflicting file
										if (Zotero.isWin && e.name == 'NS_ERROR_FILE_ACCESS_DENIED') {
											target.remove(true);
										}
										else {
											throw (e);
										}
									}
									if (newName) {
										target.remove(false);
									}
								}
								try {
									orphan.file.moveTo(orphaned, newName);
								}
								catch (e) {
									if (e.name == 'NS_ERROR_FILE_ACCESS_DENIED') {
										throw ("Zotero cannot move orphaned file '" + orphan.file.path + "'");
									}
									else {
										Components.utils.reportError("Error moving orphaned file '" + orphan.file.leafName + "'");
										throw (e);
									}
								}
								movedFiles37[orphan.id] = orphan.file;
							}
						}
						
						Zotero.wait();
						
						for each(var dir in renameQueue) {
							Zotero.debug("Moving " + dir.file.leafName + " to " + dir.key);
							dir.file.moveTo(null, dir.key);
							moveReport += dir.key + ' ' + dir.id + "\n";
							movedFiles37[dir.id] = dir.file;
						}
						
						if (moveReport) {
							moveReport = 'The following directory names in storage were changed:\n'
										+ '------------------------------------------------------\n'
										+ moveReport;
							Zotero.File.putContents(moveReportFile, moveReport);
						}
					}
					
					Zotero.wait();
					
					// Migrate big integers
					var itemIDs = Zotero.DB.columnQuery("SELECT itemID FROM items WHERE itemID>16777215");
					var smalls = Zotero.DB.columnQuery("SELECT itemID FROM items WHERE itemID<300000");
					var newID = smalls ? Math.max.apply(this, smalls) : 0;
					for each(var oldID in itemIDs) { 
						do {
							newID = newID + 1;
							var exists = Zotero.DB.valueQuery("SELECT COUNT(*) FROM items WHERE itemID=?", newID);
						}
						while (exists);
						var params = [newID, oldID];
						Zotero.DB.query("UPDATE items SET itemID=? WHERE itemID=?", params);
						Zotero.DB.query("UPDATE annotations SET itemID=? WHERE itemID=?", params);
						Zotero.DB.query("UPDATE collectionItems SET itemID=? WHERE itemID=?", params);
						Zotero.DB.query("UPDATE highlights SET itemID=? WHERE itemID=?", params);
						Zotero.DB.query("UPDATE itemCreators SET itemID=? WHERE itemID=?", params);
						Zotero.DB.query("UPDATE itemAttachments SET itemID=? WHERE itemID=?", params);
						Zotero.DB.query("UPDATE itemAttachments SET sourceItemID=? WHERE sourceItemID=?", params);
						Zotero.DB.query("UPDATE itemData SET itemID=? WHERE itemID=?", params);
						Zotero.DB.query("UPDATE itemNotes SET itemID=? WHERE itemID=?", params);
						Zotero.DB.query("UPDATE itemNotes SET sourceItemID=? WHERE sourceItemID=?", params);
						Zotero.DB.query("UPDATE itemSeeAlso SET itemID=? WHERE itemID=?", params);
						Zotero.DB.query("UPDATE itemSeeAlso SET linkedItemID=? WHERE linkedItemID=?", params);
						Zotero.DB.query("UPDATE itemTags SET itemID=? WHERE itemID=?", params);
						Zotero.DB.query("UPDATE fulltextItemWords SET itemID=? WHERE itemID=?", params);
						Zotero.DB.query("UPDATE fulltextItems SET itemID=? WHERE itemID=?", params);
					}
				}
				
				// 1.5 Sync Preview 2
				if (i==38) {
					var ids = Zotero.DB.columnQuery("SELECT itemID FROM items WHERE itemTypeID=14 AND itemID NOT IN (SELECT itemID FROM itemAttachments)");
					for each(var id in ids) {
						Zotero.DB.query("INSERT INTO itemAttachments (itemID, linkMode) VALUES (?, ?)", [id, 3]);
					}
				}
				
				if (i==39) {
					Zotero.DB.query("CREATE TABLE proxies (\n    proxyID INTEGER PRIMARY KEY,\n    multiHost INT,\n    autoAssociate INT,\n    scheme TEXT\n)");
					Zotero.DB.query("CREATE TABLE proxyHosts (\n    hostID INTEGER PRIMARY KEY,\n    proxyID INTEGER,\n    hostname TEXT,\n    FOREIGN KEY (proxyID) REFERENCES proxies(proxyID)\n)");
					Zotero.DB.query("CREATE INDEX proxyHosts_proxyID ON proxyHosts(proxyID)");
				}
				
				if (i==40) {
					Zotero.DB.query("ALTER TABLE itemAttachments ADD COLUMN syncState INT DEFAULT 0");
					Zotero.DB.query("ALTER TABLE itemAttachments ADD COLUMN storageModTime INT");
					Zotero.DB.query("CREATE INDEX itemAttachments_syncState ON itemAttachments(syncState)");
					Zotero.DB.query("CREATE TABLE storageDeleteLog (\n    key TEXT PRIMARY KEY,\n    timestamp INT NOT NULL\n)");
					Zotero.DB.query("CREATE INDEX storageDeleteLog_timestamp ON storageDeleteLog(timestamp)");
				}
				
				// 1.5 Sync Preview 2.2
				if (i==41) {
					var translators = Zotero.DB.query("SELECT * FROM translators WHERE inRepository!=1");
					if (translators) {
						var dir = Zotero.getTranslatorsDirectory();
						if (dir.exists()) {
							dir.remove(true);
						}
						Zotero.getTranslatorsDirectory()
						for each(var row in translators) {
							var file = dir.clone();
							var fileName = Zotero.Translators.getFileNameFromLabel(row.label);
							file.append(fileName);
							var metadata = { translatorID: row.translatorID, translatorType: parseInt(row.translatorType), label: row.label, creator: row.creator, target: row.target ? row.target : null, minVersion: row.minVersion, maxVersion: row.maxVersion, priority: parseInt(row.priority), inRepository: row.inRepository == 1 ? true : false, lastUpdated: row.lastUpdated };
							var metadataJSON = JSON.stringify(metadata, null, "\t");
							var str = metadataJSON + "\n\n" + (row.detectCode ? row.detectCode + "\n\n" : "") + row.code;
							Zotero.debug("Extracting translator '" + row.label + "' from database");
							Zotero.File.putContents(file, str);
							Zotero.wait();
						}
					}
					var styles = Zotero.DB.query("SELECT * FROM csl");
					if (styles) {
						var dir = Zotero.getStylesDirectory();
						if (dir.exists()) {
							dir.remove(true);
						}
						Zotero.getStylesDirectory()
						for each(var row in styles) {
							var file = dir.clone();
							var matches = row.cslID.match(/([^\/]+)$/);
							if (!matches) {
								continue;
							}
							try {
								Zotero.debug("Extracting styles '" + matches[1] + "' from database");
								file.append(matches[1]);
								Zotero.File.putContents(file, row.csl);
								Zotero.wait();
							}
							catch (e) {
								Zotero.debug(e);
								Components.utils.reportError("Skipping style '" + matches[1] + "'");
							}
						}
						Zotero.Styles.init();
					}
					Zotero.DB.query("DROP TABLE translators");
					Zotero.DB.query("DROP TABLE csl");
				}
				
				if (i==42) {
					Zotero.DB.query("UPDATE itemAttachments SET syncState=0");
				}
				
				// 1.5 Sync Preview 2.3
				if (i==43) {
					Zotero.DB.query("UPDATE itemNotes SET note='<div class=\"zotero-note znv1\">' || TEXT2HTML(note) || '</div>' WHERE note NOT LIKE '<div class=\"zotero-note %'");
				}
				
				// 1.5 Sync Preview 3 (i==44)
				// 1.5 Sync Preview 3.1
				if (i==45) {
					Zotero.DB.query("DELETE FROM itemData WHERE valueID IN (SELECT valueID FROM itemDataValues WHERE value REGEXP '^\\s*$')");
					Zotero.DB.query("DELETE FROM itemDataValues WHERE value REGEXP '^\\s*$'");
					var rows = Zotero.DB.query("SELECT * FROM itemDataValues WHERE value REGEXP '(^\\s+|\\s+$)'");
					if (rows) {
						for each(var row in rows) {
							var trimmed = Zotero.Utilities.trim(row.value);
							var valueID = Zotero.DB.valueQuery("SELECT valueID FROM itemDataValues WHERE value=?", trimmed);
							if (valueID) {
								Zotero.DB.query("UPDATE OR REPLACE itemData SET valueID=? WHERE valueID=?", [valueID, row.valueID]);
								Zotero.DB.query("DELETE FROM itemDataValues WHERE valueID=?", row.valueID);
							}
							else {
								Zotero.DB.query("UPDATE itemDataValues SET value=? WHERE valueID=?", [trimmed, row.valueID]);
							}
							Zotero.wait();
						}
					}
					
					Zotero.DB.query("UPDATE creatorData SET firstName=TRIM(firstName), lastName=TRIM(lastName)");
					var rows = Zotero.DB.query("SELECT * FROM creatorData ORDER BY lastName, firstName, creatorDataID");
					if (rows) {
						for (var j=0; j<rows.length-1; j++) {
							var k = j + 1;
							while (k < rows.length &&
									rows[k].lastName == rows[j].lastName &&
									rows[k].firstName == rows[j].firstName &&
									rows[k].fieldMode == rows[j].fieldMode) {
								Zotero.DB.query("UPDATE creators SET creatorDataID=? WHERE creatorDataID=?", [rows[j].creatorDataID, rows[k].creatorDataID]);
								Zotero.DB.query("DELETE FROM creatorData WHERE creatorDataID=?", rows[k].creatorDataID);
								k++;
							}
						}
					}
					
					Zotero.wait();
					
					Zotero.DB.query("DELETE FROM itemTags WHERE tagID IN (SELECT tagID FROM tags WHERE name REGEXP '^\\s*$')");
					Zotero.DB.query("DELETE FROM tags WHERE name REGEXP '^\\s*$'");
					var rows = Zotero.DB.query("SELECT * FROM tags WHERE name REGEXP '(^\\s+|\\s+$)'");
					if (rows) {
						for each(var row in rows) {
							var trimmed = Zotero.Utilities.trim(row.name);
							var tagID = Zotero.DB.valueQuery("SELECT tagID FROM tags WHERE name=?", trimmed);
							if (tagID) {
								Zotero.DB.query("UPDATE OR REPLACE itemTags SET tagID=? WHERE tagID=?", [tagID, row.tagID]);
								Zotero.DB.query("DELETE FROM tags WHERE tagID=?", row.tagID);
							}
							else {
								Zotero.DB.query("UPDATE tags SET name=? WHERE tagID=?", [trimmed, row.tagID]);
							}
							Zotero.wait();
						}
					}
					
					Zotero.DB.query("UPDATE itemNotes SET note=TRIM(note)");
					Zotero.DB.query("UPDATE collections SET collectionName=TRIM(collectionName)");
					Zotero.DB.query("UPDATE savedSearches SET savedSearchName=TRIM(savedSearchName)");
				}
				
				// 1.5 Sync Preview 3.2
				if (i==46) {
					if (fromVersion < 37) {
						continue;
					}
					
					if (Zotero.Prefs.get('useDataDir')) {
						var dataDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
						dataDir.persistentDescriptor = Zotero.Prefs.get('dataDir');
					}
					else {
						var dataDir = Zotero.getProfileDirectory();
						dataDir.append('zotero');
					}
					if (!dataDir.exists() || !dataDir.isDirectory()){
						var e = { name: "NS_ERROR_FILE_NOT_FOUND" };
						throw (e);
					}
					var movedFiles46 = {};
					var orphaned = dataDir.clone();
					var storage46 = dataDir.clone();
					orphaned.append('orphaned-files');
					storage46.append('storage');
					var keys = {};
					var rows = Zotero.DB.query("SELECT itemID, key FROM items NATURAL JOIN itemAttachments");
					for each(var row in rows) {
						keys[row.itemID] = row.key;
					}
					if (storage46.exists()) {
						var entries = storage46.directoryEntries;
						entries.QueryInterface(Components.interfaces.nsIDirectoryEnumerator);
						var file;
						var renameQueue = [];
						var orphanQueue = [];
						while (file = entries.nextFile) {
							var id = parseInt(file.leafName);
							if (!file.isDirectory() || file.leafName != id) {
								continue;
							}
							if (keys[id]) {
								var renameTarget = storage46.clone();
								renameTarget.append(keys[id]);
								if (renameTarget.exists()) {
									orphanQueue.push({
										id: id,
										file: renameTarget
									});
								}
								renameQueue.push({
									id: id,
									file: file,
									key: keys[id]
								});
							}
							else {
								orphanQueue.push({
									id: id,
									file: file
								});
							}
						}
						entries.close();
						
						Zotero.wait();
						
						if (orphanQueue.length) {
							if (!orphaned.exists()) {
								orphaned.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
							}
							for each(var orphan in orphanQueue) {
								var target = orphaned.clone();
								target.append(orphan.file.leafName);
								var newName = null;
								if (target.exists()) {
									try {
										target.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
										newName = target.leafName;
									}
									catch (e) {
										// DEBUG: Work around createUnique() brokenness on Windows
										// as of Fx3.0.4 (https://bugzilla.mozilla.org/show_bug.cgi?id=452217)
										//
										// We just delete the conflicting file
										if (Zotero.isWin && e.name == 'NS_ERROR_FILE_ACCESS_DENIED') {
											target.remove(true);
										}
										else {
											throw (e);
										}
									}
									if (newName) {
										target.remove(false);
									}
								}
								try {
									orphan.file.moveTo(orphaned, newName);
								}
								catch (e) {
									if (e.name == 'NS_ERROR_FILE_ACCESS_DENIED') {
										throw ("Zotero cannot move orphaned file '" + orphan.file.path + "'");
									}
									else {
										Components.utils.reportError("Error moving orphaned file '" + orphan.file.leafName + "'");
										throw (e);
									}
								}
								movedFiles46[orphan.id] = orphan.file;
							}
						}
						
						Zotero.wait();
						
						for each(var dir in renameQueue) {
							Zotero.debug("Moving " + dir.file.leafName + " to " + dir.key);
							dir.file.moveTo(null, dir.key);
							movedFiles46[dir.id] = dir.file;
						}
					}
				}
				
				// 1.5 Sync Preview 3.6
				if (i==47) {
					Zotero.DB.query("ALTER TABLE syncDeleteLog RENAME TO syncDeleteLogOld");
					Zotero.DB.query("DROP INDEX syncDeleteLog_timestamp");
					Zotero.DB.query("CREATE TABLE syncDeleteLog (\n    syncObjectTypeID INT NOT NULL,\n    key TEXT NOT NULL UNIQUE,\n    timestamp INT NOT NULL,\n    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID)\n);");
					Zotero.DB.query("CREATE INDEX syncDeleteLog_timestamp ON syncDeleteLog(timestamp);");
					Zotero.DB.query("INSERT OR IGNORE INTO syncDeleteLog SELECT syncObjectTypeID, key, timestamp FROM syncDeleteLogOld ORDER BY timestamp DESC");
					Zotero.DB.query("DROP TABLE syncDeleteLogOld");
				}
				
				// 1.5 Sync Preview 3.7
				if (i==48) {
					Zotero.DB.query("CREATE TABLE deletedItems (\n    itemID INTEGER PRIMARY KEY,\n    dateDeleted DEFAULT CURRENT_TIMESTAMP NOT NULL\n);");
				}
				
				if (i==49) {
					Zotero.DB.query("ALTER TABLE collections RENAME TO collectionsOld");
					Zotero.DB.query("DROP INDEX creators_creatorDataID");
					Zotero.DB.query("ALTER TABLE creators RENAME TO creatorsOld");
					Zotero.DB.query("ALTER TABLE savedSearches RENAME TO savedSearchesOld");
					Zotero.DB.query("ALTER TABLE tags RENAME TO tagsOld");
					
					Zotero.wait();
					
					Zotero.DB.query("CREATE TABLE collections (\n    collectionID INTEGER PRIMARY KEY,\n    collectionName TEXT,\n    parentCollectionID INT,\n    dateAdded DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    dateModified DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    key TEXT NOT NULL UNIQUE,\n    FOREIGN KEY (parentCollectionID) REFERENCES collections(collectionID)\n);");
					Zotero.DB.query("CREATE TABLE creators (\n    creatorID INTEGER PRIMARY KEY,\n    creatorDataID INT NOT NULL,\n    dateAdded DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    dateModified DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    key TEXT NOT NULL UNIQUE,\n    FOREIGN KEY (creatorDataID) REFERENCES creatorData(creatorDataID)\n);");
					Zotero.DB.query("CREATE TABLE savedSearches (\n    savedSearchID INTEGER PRIMARY KEY,\n    savedSearchName TEXT,\n    dateAdded DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    dateModified DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    key TEXT NOT NULL UNIQUE\n);");
					Zotero.DB.query("CREATE TABLE tags (\n    tagID INTEGER PRIMARY KEY,\n    name TEXT COLLATE NOCASE,\n    type INT NOT NULL,\n    dateAdded DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    dateModified DEFAULT CURRENT_TIMESTAMP NOT NULL,\n    key TEXT NOT NULL UNIQUE,\n    UNIQUE (name, type)\n);");
					
					Zotero.wait();
					
					Zotero.DB.query("INSERT INTO collections SELECT collectionID, collectionName, parentCollectionID, dateModified, dateModified, key FROM collectionsOld");
					Zotero.DB.query("INSERT INTO creators SELECT creatorID, creatorDataID, dateModified, dateModified, key FROM creatorsOld");
					Zotero.DB.query("INSERT INTO savedSearches SELECT savedSearchID, savedSearchName, dateModified, dateModified, key FROM savedSearchesOld");
					Zotero.DB.query("INSERT INTO tags SELECT tagID, name, type, dateModified, dateModified, key FROM tagsOld");
					
					Zotero.wait();
					
					Zotero.DB.query("CREATE INDEX creators_creatorDataID ON creators(creatorDataID);");
					
					Zotero.DB.query("DROP TABLE collectionsOld");
					Zotero.DB.query("DROP TABLE creatorsOld");
					Zotero.DB.query("DROP TABLE savedSearchesOld");
					Zotero.DB.query("DROP TABLE tagsOld");
				}
				
				// 1.5 Beta 3
				if (i==50) {
					Zotero.DB.query("DELETE FROM proxyHosts");
					Zotero.DB.query("DELETE FROM proxies");
				}
				
				if (i==51) {
					Zotero.DB.query("ALTER TABLE collections RENAME TO collectionsOld");
					Zotero.DB.query("DROP INDEX creators_creatorDataID");
					Zotero.DB.query("ALTER TABLE creators RENAME TO creatorsOld");
					Zotero.DB.query("ALTER TABLE items RENAME TO itemsOld")
					Zotero.DB.query("ALTER TABLE savedSearches RENAME TO savedSearchesOld");
					Zotero.DB.query("ALTER TABLE tags RENAME TO tagsOld");
					
					Zotero.DB.query("CREATE TABLE collections (\n    collectionID INTEGER PRIMARY KEY,\n    collectionName TEXT NOT NULL,\n    parentCollectionID INT DEFAULT NULL,\n    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    libraryID INT,\n    key TEXT NOT NULL,\n    UNIQUE (libraryID, key),\n    FOREIGN KEY (parentCollectionID) REFERENCES collections(collectionID)\n);");
					Zotero.DB.query("CREATE TABLE creators (\n    creatorID INTEGER PRIMARY KEY,\n    creatorDataID INT NOT NULL,\n    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    libraryID INT,\n    key TEXT NOT NULL,\n    UNIQUE (libraryID, key),\n    FOREIGN KEY (creatorDataID) REFERENCES creatorData(creatorDataID)\n);");
					Zotero.DB.query("CREATE TABLE items (\n    itemID INTEGER PRIMARY KEY,\n    itemTypeID INT NOT NULL,\n    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    libraryID INT,\n    key TEXT NOT NULL,\n    UNIQUE (libraryID, key)\n);");
					Zotero.DB.query("CREATE TABLE savedSearches (\n    savedSearchID INTEGER PRIMARY KEY,\n    savedSearchName TEXT NOT NULL,\n    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    libraryID INT,\n    key TEXT NOT NULL,\n    UNIQUE (libraryID, key)\n);");
					Zotero.DB.query("CREATE TABLE tags (\n    tagID INTEGER PRIMARY KEY,\n    name TEXT NOT NULL COLLATE NOCASE,\n    type INT NOT NULL,\n    dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    libraryID INT,\n    key TEXT NOT NULL,\n    UNIQUE (libraryID, name, type),\n    UNIQUE (libraryID, key)\n);\n");
					
					Zotero.DB.query("INSERT INTO collections SELECT collectionID, collectionName, parentCollectionID, dateAdded, dateModified, dateModified, NULL, key FROM collectionsOld");
					Zotero.DB.query("INSERT INTO creators SELECT creatorID, creatorDataID, dateAdded, dateModified, dateModified, NULL, key FROM creatorsOld");
					Zotero.DB.query("INSERT INTO items SELECT itemID, itemTypeID, dateAdded, dateModified, dateModified, NULL, key FROM itemsOld");
					Zotero.DB.query("INSERT INTO savedSearches SELECT savedSearchID, savedSearchName, dateAdded, dateModified, dateModified, NULL, key FROM savedSearchesOld");
					Zotero.DB.query("INSERT INTO tags SELECT tagID, name, type, dateAdded, dateModified, dateModified, NULL, key FROM tagsOld");
					
					Zotero.wait();
					
					Zotero.DB.query("CREATE INDEX creators_creatorDataID ON creators(creatorDataID);");
					
					Zotero.DB.query("DROP TABLE collectionsOld");
					Zotero.DB.query("DROP TABLE creatorsOld");
					Zotero.DB.query("DROP TABLE itemsOld");
					Zotero.DB.query("DROP TABLE savedSearchesOld");
					Zotero.DB.query("DROP TABLE tagsOld");
					
					Zotero.DB.query("CREATE TABLE libraries (\n    libraryID INTEGER PRIMARY KEY,\n    libraryType TEXT NOT NULL\n);");
					Zotero.DB.query("CREATE TABLE users (\n    userID INTEGER PRIMARY KEY,\n    username TEXT NOT NULL\n);");
					Zotero.DB.query("CREATE TABLE groups (\n    groupID INTEGER PRIMARY KEY,\n    libraryID INT NOT NULL UNIQUE,\n    name TEXT NOT NULL,\n    description TEXT NOT NULL,\n    editable INT NOT NULL,\n    filesEditable INT NOT NULL,\n    FOREIGN KEY (libraryID) REFERENCES libraries(libraryID)\n);");
					Zotero.DB.query("CREATE TABLE groupItems (\n    itemID INTEGER PRIMARY KEY,\n    createdByUserID INT NOT NULL,\n    lastModifiedByUserID INT NOT NULL,\n    FOREIGN KEY (createdByUserID) REFERENCES users(userID),\n    FOREIGN KEY (lastModifiedByUserID) REFERENCES users(userID)\n);");
					
					Zotero.DB.query("ALTER TABLE syncDeleteLog RENAME TO syncDeleteLogOld");
					Zotero.DB.query("DROP INDEX syncDeleteLog_timestamp");
					Zotero.DB.query("CREATE TABLE syncDeleteLog (\n    syncObjectTypeID INT NOT NULL,\n    libraryID INT,\n    key TEXT NOT NULL,\n    timestamp INT NOT NULL,\n    UNIQUE (libraryID, key),\n    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID)\n);");
					Zotero.DB.query("INSERT INTO syncDeleteLog SELECT syncObjectTypeID, NULL, key, timestamp FROM syncDeleteLogOld");
					Zotero.DB.query("CREATE INDEX syncDeleteLog_timestamp ON syncDeleteLog(timestamp)");
					Zotero.DB.query("DROP TABLE syncDeleteLogOld");
					
					Zotero.wait();
					
					Zotero.DB.query("ALTER TABLE storageDeleteLog RENAME TO storageDeleteLogOld");
					Zotero.DB.query("DROP INDEX storageDeleteLog_timestamp");
					Zotero.DB.query("CREATE TABLE storageDeleteLog (\n    libraryID INT,\n    key TEXT NOT NULL,\n    timestamp INT NOT NULL,\n    PRIMARY KEY (libraryID, key)\n);");
					Zotero.DB.query("INSERT INTO storageDeleteLog SELECT NULL, key, timestamp FROM storageDeleteLogOld");
					Zotero.DB.query("CREATE INDEX storageDeleteLog_timestamp ON storageDeleteLog(timestamp)");
					Zotero.DB.query("DROP TABLE storageDeleteLogOld");
					
					Zotero.DB.query("CREATE TEMPORARY TABLE tmpUpdatedItems (itemID INTEGER PRIMARY KEY)");
					Zotero.DB.query("INSERT INTO tmpUpdatedItems SELECT itemID FROM items NATURAL JOIN itemData WHERE fieldID=10 AND itemTypeID IN (2,9)");
					Zotero.DB.query("UPDATE itemData SET fieldID=118 WHERE fieldID=10 AND itemID IN (SELECT itemID FROM tmpUpdatedItems)");
					Zotero.DB.query("DROP TABLE tmpUpdatedItems");
				}
				
				if (i==52) {
					Zotero.DB.query("CREATE TABLE relations (\n    libraryID INT NOT NULL,\n    subject TEXT NOT NULL,\n    predicate TEXT NOT NULL,\n    object TEXT NOT NULL,\n    clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    PRIMARY KEY (libraryID, subject, predicate, object)\n)");
					Zotero.DB.query("CREATE INDEX relations_object ON relations(libraryID, object)")
				}
				
				if (i==53) {
					Zotero.DB.query("DELETE FROM collectionItems WHERE itemID IN (SELECT itemID FROM items WHERE itemID IN (SELECT itemID FROM itemAttachments WHERE sourceItemID IS NOT NULL) OR itemID IN (SELECT itemID FROM itemNotes WHERE sourceItemID IS NOT NULL))");
				}
				
				if (i==54) {
					Zotero.DB.query("UPDATE creatorData SET shortName='' WHERE shortName IS NULL");
					Zotero.DB.query("UPDATE creatorData SET birthYear=NULL WHERE birthYear=''");
				}
				
				if (i==55) {
					Zotero.DB.query("CREATE TEMPORARY TABLE tmpEmptyCreators AS SELECT creatorID FROM creators WHERE creatorDataID IN (SELECT creatorDataID FROM creatorData WHERE firstName='' AND lastName='')");
					Zotero.DB.query("INSERT INTO syncDeleteLog SELECT 2, libraryID, key, CURRENT_TIMESTAMP FROM creators WHERE creatorID IN (SELECT creatorID FROM tmpEmptyCreators)");
					var rows = Zotero.DB.query("SELECT * FROM itemCreators WHERE creatorID IN (SELECT creatorID FROM tmpEmptyCreators) ORDER BY orderIndex DESC");
					for each(var row in rows) {
						Zotero.DB.query("DELETE FROM itemCreators WHERE itemID=? AND creatorID=? AND orderIndex=?", [row.itemID, row.creatorID, row.orderIndex]);
						Zotero.DB.query("UPDATE itemCreators SET orderIndex=orderIndex-1 WHERE itemID=? AND orderIndex>?", [row.itemID, row.orderIndex]);
					}
					Zotero.DB.query("DELETE FROM itemCreators WHERE creatorID IN (SELECT creatorID FROM tmpEmptyCreators)");
					Zotero.DB.query("DELETE FROM creators WHERE creatorDataID IN (SELECT creatorDataID FROM creatorData WHERE firstName='' AND lastName='')");
					Zotero.DB.query("DROP TABLE tmpEmptyCreators");
					Zotero.DB.query("DELETE FROM creatorData WHERE firstName='' AND lastName=''");
				}
				
				if (i==56) {
					Zotero.DB.query("UPDATE itemAttachments SET mimeType=charsetID, charsetID=NULL WHERE charsetID REGEXP '[a-zA-Z0-9\-]+/[a-zA-Z0-9\-]'");
				}
				
				if (i==57) {
					Zotero.DB.query("UPDATE itemAttachments SET linkMode=0, mimeType=NULL WHERE linkMode IS NULL AND mimeType=0");
				}
				
				if (i==58) {
					if (!Zotero.DB.valueQuery("SELECT COUNT(*) FROM version WHERE schema='syncdeletelog'") && Zotero.DB.valueQuery("SELECT COUNT(*) FROM syncDeleteLog")) {
						Zotero.DB.query("INSERT INTO version VALUES ('syncdeletelog', CURRENT_TIMESTAMP)");
					}
				}
				
				if (i==59) {
					var namestr = '[Missing Name]';
					var id = Zotero.DB.valueQuery("SELECT creatorDataID FROM creatorData WHERE firstName='' AND lastName=? AND fieldMode=1", namestr);
					if (!id) {
						id = Zotero.DB.query("INSERT INTO creatorData (firstName, lastName, fieldMode) VALUES ('', ?, 1)", namestr);
					}
					var creatorID = Zotero.DB.valueQuery("SELECT creatorID FROM creators WHERE creatorDataID=?", id);
					if (!creatorID) {
						var key = Zotero.Utilities.generateObjectKey();
						creatorID = Zotero.DB.query("INSERT INTO creators (creatorDataID, key) VALUES (?, ?)", [id, key]);
					}
					Zotero.DB.query("UPDATE itemCreators SET creatorID=? WHERE creatorID NOT IN (SELECT creatorID FROM creators)", creatorID);
				}
				
				if (i==60) {
					Zotero.DB.query("DROP TRIGGER IF EXISTS fki_itemAttachments_libraryID");
					Zotero.DB.query("DROP TRIGGER IF EXISTS fku_itemAttachments_libraryID");
					Zotero.DB.query("DROP TRIGGER IF EXISTS fki_itemNotes_libraryID");
					Zotero.DB.query("DROP TRIGGER IF EXISTS fku_itemNotes_libraryID");
					Zotero.DB.query("DELETE FROM collectionItems WHERE itemID IN (SELECT itemID FROM items NATURAL JOIN itemAttachments WHERE sourceItemID IS NOT NULL UNION SELECT itemID FROM items NATURAL JOIN itemNotes WHERE sourceItemID IS NOT NULL)");
					Zotero.DB.query("UPDATE itemAttachments SET sourceItemID=NULL WHERE sourceItemID=itemID");
					Zotero.DB.query("UPDATE itemNotes SET sourceItemID=NULL WHERE sourceItemID=itemID");
				}
				
				if (i==61) {
					Zotero.DB.query("UPDATE itemAttachments SET storageModTime=NULL WHERE storageModTime<0");
				}
				
				if (i==62) {
					Zotero.DB.query("CREATE INDEX IF NOT EXISTS itemData_fieldID ON itemData(fieldID)");
				}
				
				if (i==63) {
					Zotero.DB.query("ALTER TABLE itemAttachments ADD COLUMN storageHash TEXT");
					
					var url = Zotero.Prefs.get('sync.storage.url');
					if (url) {
						var protocol = Zotero.Prefs.get('sync.storage.protocol');
						if (protocol == 'webdav') {
							Zotero.Prefs.set('sync.storage.scheme', 'http');
						}
						else {
							Zotero.Prefs.set('sync.storage.protocol', 'webdav');
							Zotero.Prefs.set('sync.storage.scheme', 'https');
						}
					}
					else {
						Zotero.Prefs.set('sync.storage.protocol', 'zotero');
					}
					
					Zotero.DB.query("UPDATE version SET schema='storage_webdav' WHERE schema='storage'");
				}
				
				if (i==64) {
					Zotero.DB.query("ALTER TABLE syncDeleteLog RENAME TO syncDeleteLogOld");
					Zotero.DB.query("CREATE TABLE syncDeleteLog (\n    syncObjectTypeID INT NOT NULL,\n    libraryID INT NOT NULL,\n    key TEXT NOT NULL,\n    timestamp INT NOT NULL,\n    UNIQUE (syncObjectTypeID, libraryID, key),\n    FOREIGN KEY (syncObjectTypeID) REFERENCES syncObjectTypes(syncObjectTypeID)\n)");
					Zotero.DB.query("INSERT INTO syncDeleteLog SELECT syncObjectTypeID, IFNULL(libraryID, 0) AS libraryID, key, timestamp FROM syncDeleteLogOld");
					Zotero.DB.query("DROP TABLE syncDeleteLogOld");
				}
				
				if (i==65) {
					Zotero.DB.query("UPDATE itemAttachments SET sourceItemID=NULL WHERE sourceItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (1,14))");
					Zotero.DB.query("UPDATE itemNotes SET sourceItemID=NULL WHERE sourceItemID IN (SELECT itemID FROM items WHERE itemTypeID IN (1,14))");
				}
				
				if (i==66) {
					Zotero.DB.query("DELETE FROM itemTags WHERE tagID IN (SELECT tagID FROM tags WHERE TRIM(name)='')");
					Zotero.DB.query("DELETE FROM tags WHERE TRIM(name)=''");
				}
				
				if (i==67) {
					var rows = Zotero.DB.query("SELECT * FROM savedSearchConditions WHERE condition='collectionID'");
					for each(var row in rows) {
						var key = Zotero.DB.valueQuery("SELECT key FROM collections WHERE collectionID=?", row.value);
						var newVal = key ? '0_' + key : null;
						Zotero.DB.query("UPDATE savedSearchConditions SET condition='collection', value=? WHERE savedSearchID=? AND searchConditionID=?", [newVal, row.savedSearchID, row.searchConditionID]);
					}
					var rows = Zotero.DB.query("SELECT * FROM savedSearchConditions WHERE condition='savedSearchID'");
					for each(var row in rows) {
						var key = Zotero.DB.valueQuery("SELECT key FROM savedSearches WHERE savedSearchID=?", row.value);
						var newVal = key ? '0_' + key : null;
						Zotero.DB.query("UPDATE savedSearchConditions SET condition='savedSearch', value=? WHERE savedSearchID=? AND searchConditionID=?", [newVal, row.savedSearchID, row.searchConditionID]);
					}
				}
				
				if (i==68) {
					Zotero.DB.query("DROP TRIGGER IF EXISTS fkd_itemData_fieldID_fields_fieldID");
					Zotero.DB.query("DROP TRIGGER IF EXISTS fku_fields_fieldID_itemData_fieldID");
					Zotero.DB.query("UPDATE savedSearchConditions SET condition='itemType', value=(SELECT typeName FROM itemTypes WHERE itemTypeID=value) WHERE condition='itemTypeID'");
					
					Zotero.DB.query("CREATE TABLE customItemTypes (\n    customItemTypeID INTEGER PRIMARY KEY,\n    typeName TEXT,\n    label TEXT,\n    display INT DEFAULT 1,\n    icon TEXT\n)");
					Zotero.DB.query("CREATE TABLE customFields (\n    customFieldID INTEGER PRIMARY KEY,\n    fieldName TEXT,\n    label TEXT\n)");
					Zotero.DB.query("CREATE TABLE customItemTypeFields (\n    customItemTypeID INT NOT NULL,\n    fieldID INT,\n    customFieldID INT,\n    hide INT NOT NULL,\n    orderIndex INT NOT NULL,\n    PRIMARY KEY (customItemTypeID, orderIndex),\n    FOREIGN KEY (customItemTypeID) REFERENCES customItemTypes(customItemTypeID),\n    FOREIGN KEY (fieldID) REFERENCES fields(fieldID),\n    FOREIGN KEY (customFieldID) REFERENCES customFields(customFieldID)\n)");
					Zotero.DB.query("CREATE INDEX customItemTypeFields_fieldID ON customItemTypeFields(fieldID)");
					Zotero.DB.query("CREATE INDEX customItemTypeFields_customFieldID ON customItemTypeFields(customFieldID)");
					Zotero.DB.query("CREATE TABLE customBaseFieldMappings (\n    customItemTypeID INT,\n    baseFieldID INT,\n    customFieldID INT,\n    PRIMARY KEY (customItemTypeID, baseFieldID, customFieldID),\n    FOREIGN KEY (customItemTypeID) REFERENCES customItemTypes(customItemTypeID),\n    FOREIGN KEY (baseFieldID) REFERENCES fields(fieldID),\n    FOREIGN KEY (customFieldID) REFERENCES fields(customFieldID)\n);\nCREATE INDEX customBaseFieldMappings_baseFieldID ON customBaseFieldMappings(baseFieldID)");
					Zotero.DB.query("CREATE INDEX customBaseFieldMappings_customFieldID ON customBaseFieldMappings(customFieldID)");
				}
				
				if (i==69) {
					Zotero.DB.query("DROP TRIGGER IF EXISTS fku_customFields_customFieldID_customFields_customFieldID");
				}
				
				if (i==70) {
					Zotero.DB.query("UPDATE itemData SET fieldID=118 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=7) AND fieldID=10");
					Zotero.DB.query("UPDATE itemData SET fieldID=119 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=29) AND fieldID=28");
					Zotero.DB.query("UPDATE itemData SET fieldID=119 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=30) AND fieldID=28");
					Zotero.DB.query("UPDATE itemData SET fieldID=121 WHERE itemID IN (SELECT itemID FROM items WHERE itemTypeID=19) AND fieldID=14");
				}
				
				// 2.0rc3
				if (i==71) {
					Zotero.DB.query("UPDATE itemAttachments SET storageModTime=storageModTime*1000 WHERE storageModTime<10000000000");
				}
				
				if (i==72) {
					Zotero.DB.query("UPDATE itemData SET fieldID=123 WHERE fieldID=62 AND itemID IN (SELECT itemID FROM items WHERE itemTypeID IN (SELECT itemTypeID FROM itemTypeFields WHERE fieldID=19) AND itemTypeID NOT IN (2,3,4,5,6,7))");
				}
				
				if (i==73) {
					Zotero.DB.query("UPDATE savedSearchConditions SET condition='libraryCatalog' WHERE condition='repository'");
				}

				// 2.1b1
				if (i==74) {
					Zotero.DB.query("CREATE INDEX deletedItems_dateDeleted ON deletedItems(dateDeleted)");
				}
				
				// 2.1b2
				if (i==75) {
					Zotero.DB.query("DROP TABLE IF EXISTS translatorCache");
					Zotero.DB.query("CREATE TABLE translatorCache (\n	leafName TEXT PRIMARY KEY,\n	translatorJSON TEXT,\n	code TEXT,\n	lastModifiedTime INT\n)");
				}
				
				if (i==76) {
					Zotero.DB.query("DELETE FROM itemTags WHERE tagID IS NULL");
				}
				
				// MLZ: multilingual controls updates from here

				// Do this one only if DB may contain extra-field-hack entries
				// Otherwise, skip it
				if (i==10000 && dbMultilingualVersion==1) {

					// Date field IDs
					var dateFieldIDs = [14, 27, 52, 96, 100, 121, 1265, 1266, 1268, 1272, 1277, 1278, 1279];

					// Mapping table for type conversions
					var typeMap = {};
					typeMap["classic"] = {
						newItemTypeID:1264,
						oldItemTypeID:2,
						fieldRemap:{},
						fieldRemove:[3,4,6,8,11,30,45],
						creatorRemap:{},
						creatorRemove:[3,5]
					};
					typeMap["periodical"] = {
						newItemTypeID:2,
						oldItemTypeID:2,
						fieldRemap:{},
						fieldRemove:[],
						creatorRemap:{},
						creatorRemove:[]
							};
					typeMap["treaty"] = {
						newItemTypeID:1262,
						oldItemTypeID:20,
						fieldRemap:{
							"100":14,
							"112":110,
							"36":43,
							"55":4
						},
						fieldRemove:[36,40,42,101],
						creatorRemap:{},
						creatorRemove:[]
					};
					typeMap["gazette"] = {
						newItemTypeID:1261,
						oldItemTypeID:20,
						fieldRemap:{},
						fieldRemove:[],
						creatorRemap:{},
						creatorRemove:[]
					};
					typeMap["regulation"] = {
						newItemTypeID:1263,
						oldItemTypeID:20,
						fieldRemap:{},
						fieldRemove:[],
						creatorRemap:{},
						creatorRemove:[]
					};

					// Mapping table for field and creator inserts
					var typeFieldsMap = {}
					// classic
					typeFieldsMap["1264"] = {
						fieldInsert: {"volume":4},
						creatorInsert: {}
					};
					// treaty
					typeFieldsMap["1262"] = {
						fieldInsert: {
							"container-title":43,
							"volume":4,
							"page":10,
							"available-date":1278,
							"original-date":1279,
							"event-date":1277
						},
						creatorInsert: {}
					};
					// regulation
					typeFieldsMap["1263"] = {
						fieldInsert: {
							"jurisdiction":1261,
							"publisher":8,
							"issued":1268
						},
						creatorInsert: {}
					};
					// gazette
					typeFieldsMap["1261"] = {
						fieldInsert: {
							"jurisdiction":1261,
							"volume":55
						},
						creatorInsert: {}
					};
					// report
					typeFieldsMap["15"] = {
						fieldInsert: {
							"jurisdiction":1261
						},
						creatorInsert: {}
					};
					// podcast
					typeFieldsMap["31"] = {
						fieldInsert: {
							"issued":14,
							"publisher":8
						},
						creatorInsert: {}
					};
					// audioRecording
					typeFieldsMap["26"] = {
						fieldInsert: {
							"container-title":1273,
							"issued":14,
							"original-date":1272,
							"publisher":8,
							"section":1274
						},
						creatorInsert: {}
					};
					// statute
					typeFieldsMap["20"] = {
						fieldInsert: {
							"jurisdiction":1261,
							"collection-number":1270,
							"genre":1269,
							"issued":1268,
							"publisher":8,
							"volume":55
						},
						creatorInsert: {}
					};
					// case
					typeFieldsMap["17"] = {
						fieldInsert: {
							"jurisdiction":1261,
							"archive":123,
							"archive_location":19,
							"collection-number":1267,
							"event-place":7,
							"genre":1271,
							"issue":5,
							"issued":1268,
							"original-date":14
						},
						creatorInsert: {}
					};
					// patent
					typeFieldsMap["19"] = {
						fieldInsert: {
							"jurisdiction":1261,
							"original-date":1266
						},
						creatorInsert: {"recipient":16}
					};
					// artwork
					typeFieldsMap["12"] = {
						fieldInsert: {
							"container-title":91
						},
						creatorInsert: {}
					};
					// hearing
					typeFieldsMap["18"] = {
						fieldInsert: {
							"jurisdiction":1261,
							"collection-number":1262,
							"event":1263,
							"genre":1264,
							"archive_location":19,
							"container-title":43,
							"chapter-number":1275
						},
						creatorInsert: {}
					};
					// bill
					typeFieldsMap["16"] = {
						fieldInsert: {
							"jurisdiction":1261,
							"event":1263,
							"collection-number":1262,
							"genre":1264,
							"archive_location":19,
							"container-title":43,
							"volume":94
						},
						creatorInsert: {
							"author":12,
							"original-author":12
						}
					};
					// newspaperArticle
					typeFieldsMap["6"] = {
						fieldInsert: {
							"jurisdiction":1261,
							"original-date":1265
						},
						creatorInsert: {}
					};
					// Do not touch records that have already been converted
					var extras = Zotero.DB.query("SELECT itemID,libraryID,key,itemTypeID,value FROM items NATURAL JOIN itemData NATURAL JOIN itemDataValues WHERE fieldID=22 AND value LIKE '%{:%' AND NOT value LIKE 'mlzsync1:%'");
					var t;
					for each(row in extras) {
						var itemTypeID = row.itemTypeID;
						// Fetch the Extra field content
						var extra = row.value;
						var extraSupp = "";
						var lst = extra.split(/({:[-_a-z]+:[^}]+})/);
						for (var j=lst.length-2; j>-1; j += -2) {
							var m = lst[j].match(/{:([-_a-z]+):\s*([^}]+)\s*}/);
							var cslKey = m[1];
							var val = m[2];

							// If a type is specified, convert the item, convert fields, and remove unused fields to Extra
							if (typeMap[m[2]]) {
								t = typeMap[m[2]];
								itemTypeID = t.newItemTypeID;
								// Change item type ID
								Zotero.DB.query("UPDATE items SET itemTypeID=? WHERE itemID=? AND itemTypeID=?",[t.newItemTypeID,row.itemID,t.oldItemTypeID]);
								// Change field IDs
								for (var oFieldID in t.fieldRemap) {
									Zotero.DB.query("UPDATE itemData SET fieldID=? WHERE itemID=? AND fieldID=?",[t.fieldRemap[oFieldID],row.itemID,oFieldID]);
								}
								// Change creator type IDs
								for (var oCreatorTypeID in t.creatorRemap) {

									Zotero.DB.query("UPDATE itemCreators SET creatorTypeID=? WHERE itemID=? AND creatorTypeID=?",[t.creatorRemap[oCreatorTypeID],row.itemID,oCreatorTypeID]);
								}
								// Remove creators (just a variation on remap in this case)
								for each(var oCreatorTypeID in t.creatorRemove) {
									Zotero.DB.query("UPDATE itemCreators SET creatorTypeID=? WHERE itemID=? AND creatorTypeID=?",[2,row.itemID,oCreatorTypeID]);
								}
								// Remove fields to Extra
								var fieldIDs = [];
								var fieldSQL = [];
								for each(var fieldID in t.fieldRemove) {
									fieldIDs.push(fieldID);
									fieldSQL.push('?');
								}
								if (fieldIDs.length) {
									fieldSQL = fieldSQL.join(",")
									var sql = "SELECT itemID,fieldName,fieldID,value FROM items NATURAL JOIN itemData NATURAL JOIN fields NATURAL JOIN itemDataValues WHERE itemID=? AND itemTypeID=? AND fieldID IN ("+fieldSQL+")";
									var removeFields = Zotero.DB.query(sql,[row.itemID,t.newItemTypeID].concat(fieldIDs));
									for (var j in removeFields) {
										var removeFieldInfo = removeFields[j];
										// Append the data to the Extra field content
										extraSupp = extraSupp + " [" + Zotero.getString("itemFields."+removeFieldInfo.fieldName)+": "+removeFieldInfo.value+"]";
										// Remove field row
										Zotero.DB.query("DELETE FROM itemData WHERE itemID=? AND fieldID=?",[row.itemID,removeFieldInfo.fieldID]);
									}
								}
								// Removing type hack code from Extra
								var m = extra.match(/(.*){:type:[^}]+}\s*(.*)/);
								if (m) {
									extra = m[1] + m[2];
								}
							}
						}
						for (var j=lst.length-2; j>-1; j += -2) {
							var m = lst[j].match(/{:([-_a-z]+):\s*([^}]+)\s*}/);
							var cslKey = m[1];
							var cslKeyVal = m[2];

							if (typeFieldsMap[itemTypeID]) {
								t = typeFieldsMap[itemTypeID];
								if (t.fieldInsert[cslKey]) {

									if (dateFieldIDs.indexOf(t.fieldInsert[cslKey]) > -1) {
										if (!cslKeyVal.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2} .*/)) {
											cslKeyVal = "0000-00-00 "+cslKeyVal;
										}
									}
									var hasFieldData = Zotero.DB.valueQuery("SELECT COUNT(*) FROM itemData WHERE itemID=? AND fieldID=?",[row.itemID,t.fieldInsert[cslKey]]);
									if (hasFieldData) {
										// Append to field? Or abort and leave on Extra? The latter, for now.
									} else {
										var hasDataValue = Zotero.DB.valueQuery("SELECT COUNT(*) FROM itemDataValues WHERE value=?",[cslKeyVal]);
										if (!hasDataValue) {
											Zotero.DB.query("INSERT INTO itemDataValues VALUES (NULL,?)",[cslKeyVal]);
										}
										var valueID = Zotero.DB.valueQuery("SELECT valueID FROM itemDataValues WHERE value=?",[cslKeyVal]);
										Zotero.DB.query("INSERT INTO itemData VALUES (?, ?, ?)",[row.itemID,t.fieldInsert[cslKey],valueID]);
										// Remove variable hack code from Extra
										// XXX Build a compiled regexp with the variable name
										var rex = new RegExp("(.*){:" + cslKey + ":[^}]+}\s*(.*)");
										var m = extra.match(rex);
										if (m) {
											extra = m[1] + m[2];
										}
									}
								}
								if (t.creatorInsert[cslKey]) {
									// Split the value to firstName and lastName and set fieldMode to 1 or 0
									var l = cslKeyVal.split(/\s*\|\|\s*/);
									var lastName = l[0];
									var firstName = l[1] ? l[1] : "";
									if (!lastName) {
										continue;
									}
									var fieldMode = 1;
									if (firstName) {
										fieldMode = 0;
									}
									// Look in creatorData for an entry with matching firstName and lastName, or matching combined
									var hasNameData;
									if (fieldMode) {
										hasNameData = Zotero.DB.valueQuery("SELECT COUNT(*) FROM creatorData WHERE firstName IS NULL AND lastName=? AND fieldMode=?",[lastName,fieldMode]);
									} else {
										hasNameData = Zotero.DB.valueQuery("SELECT COUNT(*) FROM creatorData WHERE firstName=? AND lastName=? AND fieldMode=?",[firstName,lastName,fieldMode]);
									}
									if (!hasNameData) {
										if (fieldMode === 1) {
											Zotero.DB.query("INSERT INTO creatorData VALUES (NULL, NULL, ?, NULL, ?, NULL)",[lastName,fieldMode]);
										} else {
											Zotero.DB.query("INSERT INTO creatorData VALUES (NULL, ?, ?, NULL, ?, NULL)",[firstName,lastName,fieldMode]);
										}
									}
									// Insert value if necessary and get creatorDataID
									var creatorDataID;
									if (fieldMode === 1) {
										creatorDataID = Zotero.DB.valueQuery("SELECT creatorDataID FROM creatorData WHERE firstName IS NULL AND lastName=? AND fieldMode=?",[lastName,fieldMode]);
									} else {
										creatorDataID = Zotero.DB.valueQuery("SELECT creatorDataID FROM creatorData WHERE firstName=? AND lastName=? AND fieldMode=?",[firstName,lastName,fieldMode]);
									}
									// Look in creators IN THIS LIBRARY for one carrying this creatorDataID
									var creatorID;
									if (!row.libraryID) {
										creatorID = Zotero.DB.valueQuery("SELECT creatorID FROM creators WHERE libraryID IS NULL AND creatorDataID=?",[creatorDataID])
									} else {
										creatorID = Zotero.DB.valueQuery("SELECT creatorID FROM creators WHERE libraryID=? AND creatorDataID=?",[row.libraryID,creatorDataID])
									}
									// Insert value if necessary and get creatorID
									if (!creatorID) {
										var creatorKey = Zotero.ID.getKey();
										if (!row.libraryID) {
											Zotero.DB.query("INSERT INTO creators VALUES (NULL, ?, ?, ?, ?, NULL, ?)",[creatorDataID,Zotero.DB.transactionDateTime,Zotero.DB.transactionDateTime,Zotero.DB.transactionDateTime,creatorKey]);
										} else {
											Zotero.DB.query("INSERT INTO creators VALUES (NULL, ?, ?, ?, ?, ?, ?)",[creatorDataID,Zotero.DB.transactionDateTime,Zotero.DB.transactionDateTime,Zotero.DB.transactionDateTime,row.libraryID,creatorKey]);
										}
									}
									var creatorID;
									if (!row.libraryID) {
										creatorID = Zotero.DB.valueQuery("SELECT creatorID FROM creators WHERE creatorDataID=? AND libraryID IS NULL",[creatorDataID]);
									} else {
										creatorID = Zotero.DB.valueQuery("SELECT creatorID FROM creators WHERE creatorDataID=? AND libraryID=?",[creatorDataID,row.libraryID]);
									}
									
									// Look in itemCreators on this itemID for creatorID with the same creatorTypeID
									var hasItemCreator = Zotero.DB.valueQuery("SELECT COUNT(*) FROM itemCreators WHERE itemID=? AND creatorID=? AND creatorTypeID=?",[row.itemID,creatorID,t.creatorInsert[cslKey]]);
									// If it's not already in there, insert it, incrementing the orderIndex
									if (!hasItemCreator) {
										var maxIndex = Zotero.DB.valueQuery("SELECT MAX(orderIndex) FROM itemCreators WHERE itemID=?",[row.itemID]);
										if ("number" === typeof maxIndex) {
											maxIndex += 1;
											Zotero.DB.query("INSERT INTO itemCreators VALUES (?, ?, ?, ?)",[row.itemID,creatorID,t.creatorInsert[cslKey],maxIndex]);
										} else {
											Zotero.DB.query("INSERT INTO itemCreators VALUES (?, ?, ?, ?)",[row.itemID,creatorID,t.creatorInsert[cslKey],0]);
										}
									}
									// Remove variable hack code from Extra
									// XXX Build a compiled regexp with the variable name
									var rex = new RegExp("(.*){:" + cslKey + ":[^}]+}\s*(.*)");
									var m = extra.match(rex);
									if (m) {
										extra = m[1] + m[2];
									}
								}
							}
						}
						// Remove actioned items from Extra, and append the data from those that were removed.
						extra += extraSupp;
						if (extra !== row.value) {
							if (extra) {
								// Get a data ID for the new content
								var hasValueID = Zotero.DB.valueQuery("SELECT COUNT(*) FROM itemDataValues WHERE value=?",[extra]);
								var valueID;
								if (!hasValueID) {
									Zotero.DB.query("INSERT INTO itemDataValues VALUES (NULL, ?)",[extra]);
								}
								valueID = Zotero.DB.valueQuery("SELECT valueID FROM itemDataValues WHERE value=?",[extra]);
								// Set the data ID on itemData
								Zotero.DB.query("UPDATE itemData SET valueID=? WHERE itemID=? AND fieldID=?",[valueID,row.itemID,22]);
								
							} else {
								Zotero.DB.query("DELETE from itemData WHERE itemID=? AND fieldID=?",[row.itemID,22]);
							}
							// Mark actioned items with current timestamp to force sync-up (if editable)
							Zotero.DB.query("UPDATE items SET clientDateModified=? WHERE itemID=? AND (libraryID IS NULL OR libraryID IN (SELECT libraryID FROM groups WHERE editable=1))",[Zotero.DB.transactionDateTime,row.itemID]);
						}
					}
					Zotero.wait();

					// Force update of any entries with multilingual content (if editable)
					var sql = "SELECT itemID FROM items"
						+ " WHERE"
						+ " itemID in (SELECT DISTINCT itemID FROM itemDataAlt) OR"
						+ " itemID in (SELECT DISTINCT itemID FROM itemCreatorsAlt)";
					var localMulti = Zotero.DB.query(sql);
					for each(row in localMulti) {
						Zotero.DB.query("UPDATE items SET clientDateModified=? WHERE itemID=? AND (libraryID IS NULL OR libraryID IN (SELECT libraryID FROM groups WHERE editable=1))",[Zotero.DB.transactionDateTime,row.itemID]);
					}
					Zotero.wait();
					_updateDBVersion('multilingual', 2);
					Zotero.wait();

				}

				if (i==10000 && mlzSchemaEntryLevel && mlzSchemaEntryLevel < 77) {
					Zotero.DB.query("CREATE TABLE IF NOT EXISTS syncedSettings (\n    setting TEXT NOT NULL,\n    libraryID INT NOT NULL,\n    value NOT NULL,\n    version INT NOT NULL DEFAULT 0,\n    synced INT NOT NULL DEFAULT 0,\n    PRIMARY KEY (setting, libraryID)\n)");
					Zotero.DB.query("INSERT OR IGNORE INTO syncObjectTypes VALUES (7, 'setting')");
					Zotero.wait();
				}

				if (i==10000 && mlzSchemaEntryLevel && mlzSchemaEntryLevel < 78) {
					Zotero.DB.query("CREATE INDEX IF NOT EXISTS creatorData_name ON creatorData(lastName, firstName)");
				}

				if (i==10001) {
					
					var sql = "SELECT IG.name AS itemgroup,CG.name AS creatorgroup,IDV.value AS title,CD.lastName AS name," +
						"ICA.itemID AS itemID,ICA.creatorID AS creatorID,ICA.creatorTypeID AS creatorTypeID,ICA.orderIndex AS orderIndex," +
						"C.creatorDataID AS creatorDataID,I.libraryID AS libraryID,ICA.languageTag AS languageTag " +
						"FROM " +
						"itemCreatorsAlt ICA " +
						"JOIN items I ON I.itemID=ICA.itemID " +
						"JOIN creators C ON ICA.creatorID=C.creatorID " +
						"JOIN creatorData CD ON C.creatorDataID=CD.creatorDataID " +
						"JOIN itemData ID ON I.itemID=ID.itemID " +
						"JOIN itemDataValues IDV ON ID.valueID=IDV.valueID " +
						"LEFT JOIN groups IG ON I.libraryID=IG.libraryID " +
						"LEFT JOIN groups CG ON C.libraryID=CG.libraryID " +
						"WHERE ((I.libraryID IS NULL AND C.libraryID IS NOT NULL) " +
						"OR (I.libraryID IS NOT NULL AND C.libraryID IS NULL) " +
						"OR (I.libraryID IS NOT NULL AND C.libraryID IS NOT NULL AND I.libraryID!=C.libraryID)) " +
						"AND ID.fieldID IN (110,112,113) ORDER BY IG.name,CG.name";
					var res = Zotero.DB.query(sql);

					for (var j=0,jlen=res.length;j<jlen;j+=1) {
						// Try to find an existing creator with the correct data
						var sql = "SELECT creatorID FROM creators " +
							"WHERE creatorDataID=? AND libraryID=?";
						var sqlParams = [
							res[j].creatorDataID,
							res[j].libraryID
						]
						var newCreatorID = Zotero.DB.valueQuery(sql, sqlParams);
						// If none is found, create one
						if (!newCreatorID) {
							var key = Zotero.ID.getKey();
							sql = "INSERT INTO creators VALUES (NULL,?,?,?,?,?,?)";
							sqlParams = [
								res[j].creatorDataID,
								Zotero.DB.transactionDateTime,
								Zotero.DB.transactionDateTime,
								Zotero.DB.transactionDateTime,
								res[j].libraryID,
								key
							]
							Zotero.DB.query(sql, sqlParams);
							sql = "SELECT creatorID FROM creators WHERE key=? AND libraryID=?";
							sqlParams = [
								key,
								res[j].libraryID
							]
							newCreatorID = Zotero.DB.valueQuery(sql, sqlParams);
						}
						// Point to the correct creator object
						sql = "UPDATE itemCreatorsAlt SET creatorID=? WHERE itemID=? AND orderIndex=? AND languageTag=?";
						sqlParams = [
							newCreatorID,
							res[j].itemID,
							res[j].orderIndex,
							res[j].languageTag
						];
						Zotero.DB.query(sql, sqlParams);

						// Flag the item as updated so it will sync (?)
						sql = "UPDATE items SET clientDateModified=? WHERE itemID=?";
						sqlParams = [
							Zotero.DB.transactionDateTime,
							res[j].itemID
						];
						Zotero.DB.query(sql, sqlParams);
					}
				}
				Zotero.wait();
			}
			
			// TODO
			//
			// Replace customBaseFieldMappings to fix FK fields/customField -> customFields->customFieldID
			// If libraryID set, make sure no relations still use a local user key, and then remove on-error code in sync.js
			
			_updateDBVersion('userdata', toVersion);
			
			Zotero.DB.commitTransaction();
		}
		catch (e) {
			if (movedFiles37) {
				for (var id in movedFiles37) {
					try {
						movedFiles37[id].moveTo(storage37, id);
					}
					catch (e2) { Zotero.debug(e2); }
				}
			}
			if (movedFiles46) {
				for (var id in movedFiles46) {
					try {
						movedFiles46[id].moveTo(storage46, id);
					}
					catch (e2) { Zotero.debug(e2); }
				}
			}
			Zotero.DB.rollbackTransaction();
			
			// Display more helpful message on errors due to open files
			//
			// Conditional should be same as in showUpgradeWizard()
			if (e.name && e.name == "NS_ERROR_FAILURE" && e.message.match(/nsIFile\.moveTo/)) {
				var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
				var title = Zotero.getString('upgrade.failed.title');
				ps.alert(null, title, Zotero.getString('upgrade.couldNotMigrate', Zotero.appName) + "\n\n" + Zotero.getString('upgrade.couldNotMigrate.restart'));
			}
			
			throw(e);
		}
		
		return true;
	}
}
