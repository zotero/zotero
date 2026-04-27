/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2016 Center for History and New Media
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

"use strict";

var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');

Zotero.DataDirectory = {
	MIGRATION_MARKER: 'migrate-dir',
	
	get dir() {
		if (!this._dir) {
			throw new Error("Data directory not initialized");
		}
		return this._dir;
	},
	
	get defaultDir() {
		// Use special data directory for tests
		if (CommandLineOptions.test) {
			return OS.Path.join(PathUtils.parent(OS.Constants.Path.profileDir), "Zotero");
		}
		return OS.Path.join(OS.Constants.Path.homeDir, ZOTERO_CONFIG.CLIENT_NAME);
	},
	
	get legacyDirName() {
		return ZOTERO_CONFIG.ID;
	},
	
	_dir: null,
	_warnOnUnsafeLocation: true,
	
	
	init: async function () {
		var dataDir;
		var dbFilename = this.getDatabaseFilename();
		// Handle directory specified on command line
		if (Zotero.forceDataDir) {
			let dir = Zotero.forceDataDir;
			// Profile subdirectory
			if (dir == 'profile') {
				dataDir = OS.Path.join(Zotero.Profile.dir, this.legacyDirName);
			}
			// Absolute path
			else {
				if (!PathUtils.isAbsolute(dir)) {
					dir = false;
				}
				if (!dir) {
					throw `-datadir requires an absolute path or 'profile' ('${Zotero.forceDataDir}' given)`;
				}
				
				// Require parent directory to exist
				if (!((await OS.File.exists(PathUtils.parent(dir))))) {
					throw `Parent directory of -datadir ${dir} not found`;
				}
				
				dataDir = dir;
			}
		}
		else if (Zotero.Prefs.get('useDataDir') && Zotero.Prefs.get('dataDir')) {
			let prefVal = Zotero.Prefs.get('dataDir');
			// Convert old persistent descriptor pref to string path and clear obsolete lastDataDir pref
			//
			// persistentDescriptor now appears to return (and parse) a string path anyway on macOS,
			// which is the only place where it didn't use a string path to begin with, but be explicit
			// just in case there's some difference.
			//
			// A post-Mozilla prefs migration should do this same check, and then this conditional can
			// be removed.
			if (Zotero.Prefs.get('lastDataDir')) {
				let nsIFile;
				try {
					nsIFile = Components.classes["@mozilla.org/file/local;1"]
						.createInstance(Components.interfaces.nsIFile);
					nsIFile.persistentDescriptor = prefVal;
				}
				catch (e) {
					let msg = "Persistent descriptor in extensions.zotero.dataDir did not resolve";
					Zotero.debug(msg, 1);
					throw new DOMException(msg, 'NotFoundError');
				}
				// This removes lastDataDir
				this.set(nsIFile.path);
				dataDir = nsIFile.path;
			}
			else {
				// If there's a migration marker in this directory and no database, migration was
				// interrupted before the database could be moved (or moving failed), so use the source
				// directory specified in the marker file.
				let migrationMarker = OS.Path.join(prefVal, this.MIGRATION_MARKER);
				let dbFile = OS.Path.join(prefVal, dbFilename);
				
				if (((await OS.File.exists(migrationMarker))) && !((await OS.File.exists(dbFile)))) {
					let contents = await Zotero.File.getContentsAsync(migrationMarker);
					try {
						let { sourceDir } = JSON.parse(contents);
						dataDir = OS.Path.normalize(sourceDir);
					}
					catch (e) {
						Zotero.logError(e);
						let msg = `Invalid marker file:\n\n${contents}`;
						Zotero.debug(msg, 1);
						throw new DOMException(msg, 'NotFoundError');
					}
				}
				else {
					try {
						dataDir = OS.Path.normalize(prefVal);
					}
					catch (e) {
						Zotero.logError(e);
						let msg = `Invalid path '${prefVal}' in dataDir pref`;
						Zotero.debug(msg, 1);
						throw new DOMException(msg, 'NotFoundError');
					}
				}
			}
			
			if (!((await OS.File.exists(dataDir))) && dataDir != this.defaultDir) {
				// If set to a legacy directory that doesn't exist, forget about it and just use the
				// new default location, which will either exist or be created below. The most likely
				// cause of this is a migration, so don't bother looking in other-app profiles.
				if (this.isLegacy(dataDir)) {
					let newDefault = this.defaultDir;
					Zotero.debug(`Legacy data directory ${dataDir} from pref not found `
						+ `-- reverting to ${newDefault}`, 1);
					dataDir = newDefault;
					this.set(newDefault);
				}
				// For other custom directories that don't exist, show not-found dialog
				else {
					let msg = `Custom data directory ${dataDir} not found`;
					Zotero.debug(msg, 1);
					throw new DOMException(msg, 'NotFoundError');
				}
			}
			
			try {
				if (dataDir != this.defaultDir
						&& this.isLegacy(dataDir)
						&& ((await OS.File.exists(OS.Path.join(this.defaultDir, 'move-to-old'))))) {
					let newPath = this.defaultDir + '-Old';
					if (await OS.File.exists(newPath)) {
						newPath += "-1";
					}
					await Zotero.File.moveDirectory(this.defaultDir, newPath);
					await OS.File.remove(OS.Path.join(newPath, 'move-to-old'));
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		// New installation of 5.0+ with no data directory specified, so check all the places the data
		// could be
		else {
			dataDir = this.defaultDir;
			
			// If there's already a profile pointing to the default location, use a different
			// data directory named after the profile, as long as one either doesn't exist yet or
			// one does and it contains a database
			try {
				if (((await Zotero.Profile.findOtherProfilesUsingDataDirectory(dataDir))).length) {
					let profileName = PathUtils.filename(Zotero.Profile.dir).match(/[^.]+\.(.+)/)[1];
					let newDataDir = this.defaultDir + ' ' + profileName;
					if (!((await OS.File.exists(newDataDir)))
							|| ((await OS.File.exists(OS.Path.join(newDataDir, dbFilename))))) {
						dataDir = newDataDir;
					}
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
			
			// Check for ~/Zotero/zotero.sqlite
			let dbFile = OS.Path.join(dataDir, dbFilename);
			if (await OS.File.exists(dbFile)) {
				Zotero.debug("Using data directory " + dataDir);
				this._cache(dataDir);
				
				// Set as a custom data directory so that 4.0 uses it
				this.set(dataDir);
				
				return dataDir;
			}
			
			// Check for <profile dir>/zotero/zotero.sqlite (Zotero Standalone <5.0)
			try {
				let dir = OS.Path.join(Zotero.Profile.dir, this.legacyDirName);
				let dbFile = OS.Path.join(dir, dbFilename);
				let mtime = new Date(((await IOUtils.stat(dbFile))).lastModified);
				Zotero.debug(`Database found at ${dbFile}, last modified ${mtime}`);
				dataDir = dir;
			}
			catch (e) {
				if (e.name != 'NotFoundError') {
					throw e;
				}
			}
			
			this.set(dataDir);
		}
		
		Zotero.debug("Using data directory " + dataDir);
		try {
			await Zotero.File.createDirectoryIfMissingAsync(dataDir);
		}
		catch (e) {
			// TEMP: OS.Constants.Win.ERROR_ACCESS_DENIED no longer available, but we should
			// switch to IOUtils anyway
			const WIN_ERROR_ACCESS_DENIED = 5;
			if (e instanceof OS.File.Error
					&& (('unixErrno' in e && e.unixErrno == ChromeUtils.getLibcConstants().EACCES)
						|| ('winLastError' in e && e.winLastError == WIN_ERROR_ACCESS_DENIED))) {
				Zotero.restarting = true;
				let isDefaultDir = dataDir == Zotero.DataDirectory.defaultDir;
				let ps = Services.prompt;
				let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
					+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
				if (!isDefaultDir) {
					buttonFlags += ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
				}
				let title = Zotero.getString('general.accessDenied');
				let msg = Zotero.getString('dataDir.dirCannotBeCreated', [Zotero.appName, dataDir])
					+ "\n\n"
					+ Zotero.getString('dataDir.checkDirWriteAccess', Zotero.appName);
				
				let index;
				if (isDefaultDir) {
					index = ps.confirmEx(null,
						title,
						msg,
						buttonFlags,
						Zotero.getString('dataDir.chooseNewDataDirectory'),
						Zotero.getString('general.quit'),
						null, null, {}
					);
					if (index == 0) {
						let changed = await Zotero.DataDirectory.choose(true);
						if (!changed) {
							Zotero.Utilities.Internal.quit();
						}
					}
					else if (index == 1) {
						Zotero.Utilities.Internal.quit();
					}
				}
				else {
					index = ps.confirmEx(null,
						title,
						msg,
						buttonFlags,
						Zotero.getString('dataDir.useDefaultLocation'),
						Zotero.getString('general.quit'),
						Zotero.getString('dataDir.chooseNewDataDirectory'),
						null, {}
					);
					if (index == 0) {
						Zotero.DataDirectory.set(Zotero.DataDirectory.defaultDir);
						Zotero.Utilities.Internal.quit(true);
					}
					else if (index == 1) {
						Zotero.Utilities.Internal.quit();
					}
					else if (index == 2) {
						let changed = await Zotero.DataDirectory.choose(true);
						if (!changed) {
							Zotero.Utilities.Internal.quit();
							return;
						}
					}
				}
				return;
			}
		}
		this._cache(dataDir);
	},
	
	
	_cache: function (dir) {
		this._dir = dir;
	},
	
	
	/**
	 * @return {Boolean} - True if the directory changed; false otherwise
	 */
	set: function (path) {
		var origPath = Zotero.Prefs.get('dataDir');
		
		Zotero.Prefs.set('dataDir', path);
		// Clear legacy pref
		Zotero.Prefs.clear('lastDataDir');
		Zotero.Prefs.set('useDataDir', true);
		
		return path != origPath;
	},
	
	
	/**
	 * @return {String|false} - New path or false if not changed
	 */
	choose: async function (forceQuitNow, useHomeDir, moreInfoCallback) {
		var win = Services.wm.getMostRecentWindow('navigator:browser');
		var ps = Services.prompt;
		var newPath;
		
		if (useHomeDir) {
			let changed = this.set(this.defaultDir);
			if (!changed) {
				return false;
			}
			newPath = this.defaultDir;
		}
		else {
			while (true) {
				let fp = new FilePicker();
				fp.init(win, Zotero.getString('dataDir.selectDir'), fp.modeGetFolder);
				fp.displayDirectory = this._dir ? this._dir : PathUtils.parent(this.defaultDir);
				fp.appendFilters(fp.filterAll);
				if ((await fp.show()) == fp.returnOK) {
					let file = Zotero.File.pathToFile(fp.file);
					let dialogText = '';
					let dialogTitle = '';
					
					// If set to 'storage', offer to use the parent directory
					if (await this.isStorageDirectory(file.path)) {
						let buttonFlags = ps.STD_YES_NO_BUTTONS;
						let parentPath = PathUtils.parent(file.path);
						let index = ps.confirmEx(
							null,
							Zotero.getString('general.error'),
							Zotero.getString('dataDir.cannotBeSetWithAlternative', ['storage', parentPath]),
							buttonFlags,
							null, null, null, null, {}
						);
						if (index == 1) {
							continue;
						}
						file = Zotero.File.pathToFile(parentPath)
					}
					
					if (file.path == (Zotero.Prefs.get('lastDataDir') || Zotero.Prefs.get('dataDir'))) {
						Zotero.debug("Data directory hasn't changed");
						return false;
					}
					
					if (this.isLinkedAttachmentBaseDirectory(file.path)) {
						let dialogTitle = Zotero.getString('general.error');
						let dialogText = Zotero.getString('dataDir.cannotBeLinkedAttachmentBaseDirectory');
						ps.alert(null, dialogTitle, dialogText);
						continue;
					}
					
					// In a cloud storage folder (Dropbox, etc.)
					if (Zotero.File.isCloudStorageFolder(file.path)) {
						dialogTitle = Zotero.getString('general.warning');
						dialogText = Zotero.getString('dataDir.unsafeLocation.selected.cloud') + "\n\n"
							+ file.path + "\n\n"
							+ Zotero.getString('dataDir.unsafeLocation.selected.areYouSure');
						moreInfoCallback = () => {
							Zotero.launchURL('https://www.zotero.org/support/kb/data_directory_in_cloud_storage_folder');
						};
					}
					else if (file.directoryEntries.hasMoreElements()) {
						let dbfile = file.clone();
						dbfile.append(this.getDatabaseFilename());
						
						// Warn if non-empty and no zotero.sqlite
						if (!dbfile.exists()) {
							dialogTitle = Zotero.getString('dataDir.selectedDirNonEmpty.title');
							dialogText = Zotero.getString('dataDir.selectedDirNonEmpty.text');
						}
					}
					// Directory empty
					else {
						dialogTitle = Zotero.getString('dataDir.selectedDirEmpty.title');
						dialogText = Zotero.getString('dataDir.selectedDirEmpty.text', Zotero.appName) + '\n\n'
								+ Zotero.getString('dataDir.selectedDirEmpty.useNewDir');
					}
					// Warning dialog to be displayed
					if(dialogText !== '') {
						let buttonFlags = ps.STD_YES_NO_BUTTONS;
						if (moreInfoCallback) {
							buttonFlags += ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
						}
						let index = ps.confirmEx(null,
							dialogTitle,
							dialogText,
							buttonFlags,
							null,
							null,
							moreInfoCallback ? Zotero.getString('general.moreInformation') : null,
							null, {});

						// Not OK -- return to file picker
						if (index == 1) {
							continue;
						}
						else if (index == 2) {
							setTimeout(function () {
								moreInfoCallback();
							}, 1);
							return false;
						}
					}

					this.set(file.path);
					newPath = file.path;
					
					break;
				}
				else {
					return false;
				}
			}
		}
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING);
		if (!forceQuitNow) {
			buttonFlags += (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING);
		}
		var app = Zotero.appName;
		var index = ps.confirmEx(null,
			Zotero.getString('general.restartRequired'),
			Zotero.getString('general.restartRequiredForChange', app)
				+ "\n\n" + Zotero.getString('dataDir.moveFilesToNewLocation', app),
			buttonFlags,
			Zotero.getString('general.quitApp', app),
			forceQuitNow ? null : Zotero.getString('general.restartLater'),
			null, null, {});
		
		if (forceQuitNow || index == 0) {
			Services.startup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit);
		}
		
		return newPath;
	},
	
	
	forceChange: async function (win) {
		if (!win) {
			win = Services.wm.getMostRecentWindow('navigator:browser');
		}
		var ps = Services.prompt;
		
		while (true) {
			let fp = new FilePicker();
			fp.init(win, Zotero.getString('dataDir.selectNewDir', Zotero.clientName), fp.modeGetFolder);
			fp.displayDirectory = this.dir;
			fp.appendFilters(fp.filterAll);
			if ((await fp.show()) == fp.returnOK) {
				let file = Zotero.File.pathToFile(fp.file);
				
				if (file.directoryEntries.hasMoreElements()) {
					ps.alert(null,
						Zotero.getString('dataDir.mustSelectEmpty.title'),
						Zotero.getString('dataDir.mustSelectEmpty.text')
					);
					continue;
				}
				
				this.set(file.path);
				
				return file;
			} else {
				return false;
			}
		}
	},
	
	
	checkForUnsafeLocation: async function (path) {
		if (!this._warnOnUnsafeLocation || !Zotero.Prefs.get('warnOnUnsafeDataDir')) {
			return;
		}
		
		if (Zotero.File.isCloudStorageFolder(path)) {
			this._warnOnUnsafeLocation = false;
			let check = {value: false};
			let ps = Services.prompt;
			let index = Services.prompt.confirmEx(
				null,
				Zotero.getString('general.warning'),
				Zotero.getString('dataDir.unsafeLocation.existing.cloud', Zotero.appName) + "\n\n"
					+ path + "\n\n"
					+ Zotero.getString('dataDir.unsafeLocation.existing.chooseDifferent'),
				ps.STD_YES_NO_BUTTONS
					+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING,
				null, null,
				Zotero.getString('general.moreInformation'),
				Zotero.getString('general.dontShowWarningAgain'),
				check
			);

			// Yes - display dialog.
			if (index == 0) {
				await this.choose(true);
			}
			else if (index == 2) {
				Zotero.launchURL('https://www.zotero.org/support/kb/data_directory_in_cloud_storage_folder');
			}
			if (check.value) {
				Zotero.Prefs.set('warnOnUnsafeDataDir', false);
			}
		}
	},
	
	
	isLegacy: function (dir) {
		// 'zotero'
		return PathUtils.filename(dir) == this.legacyDirName
				// '69pmactz.default'
				&& PathUtils.filename(PathUtils.parent(dir)).match(/^[0-9a-z]{8}\..+/)
				// 'Profiles'
				&& PathUtils.filename(PathUtils.parent(PathUtils.parent(dir))) == 'Profiles';
	},
	
	
	isNewDirOnDifferentDrive: async function (oldDir, newDir) {
		var filename = 'zotero-migration.tmp';
		var tmpFile = OS.Path.join(Zotero.getTempDirectory().path, filename);
		await Zotero.File.putContentsAsync(tmpFile, ' ');
		var testPath = OS.Path.normalize(OS.Path.join(newDir, '..', filename));
		try {
			// Attempt moving the marker with noCopy
			await OS.File.move(tmpFile, testPath, { noCopy: true });
		} catch(e) {
			await OS.File.remove(tmpFile);
			
			if (e instanceof OS.File.Error) {
				if (e.unixErrno != undefined && e.unixErrno == ChromeUtils.getLibcConstants().EXDEV) {
					return true;
				}
				// ERROR_NOT_SAME_DEVICE is undefined
				// e.winLastError == OS.Constants.Win.ERROR_NOT_SAME_DEVICE
				if (e.winLastError != undefined && e.winLastError == 17) {
					return true;
				}
			}
			throw e;
		}
		await OS.File.remove(testPath);
		return false;
	},
	
	
	isStorageDirectory: async function (dir) {
		if (PathUtils.filename(dir) != 'storage') {
			return false;
		}
		let sqlitePath = OS.Path.join(PathUtils.parent(dir), 'zotero.sqlite');
		return OS.File.exists(sqlitePath);
	},
	
	
	isLinkedAttachmentBaseDirectory: function (dir) {
		var oldPath = Zotero.Prefs.get('baseAttachmentPath');
		if (!oldPath) return false;
		
		try {
			oldPath = OS.Path.normalize(oldPath);
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
		
		return oldPath === OS.Path.normalize(dir);
	},
	
	
	/**
	 * Determine if current data directory is in a legacy location
	 */
	canMigrate: function () {
		// If (not default location) && (not useDataDir or within legacy location)
		var currentDir = this.dir;
		if (currentDir == this.defaultDir) {
			return false;
		}
		
		if (this.newDirOnDifferentDrive) {
			return false;
		}
		
		if (Zotero.forceDataDir) {
			return false;
		}
		
		// Legacy default or set to legacy default from other program (Standalone/Z4Fx) to share data
		if (!Zotero.Prefs.get('useDataDir') || this.isLegacy(currentDir)) {
			return true;
		}
		
		return false;
	},
	
	
	reveal: function () {
		return Zotero.File.reveal(this.dir);
	},
	
	
	markForMigration: function (dir, automatic = false) {
		var path = OS.Path.join(dir, this.MIGRATION_MARKER);
		Zotero.debug("Creating migration marker at " + path);
		return Zotero.File.putContentsAsync(
			path,
			JSON.stringify({
				sourceDir: dir,
				automatic
			})
		);
	},
	
	
	/**
	 * Migrate data directory if necessary and show any errors
	 *
	 * @param {String} dataDir - Current directory
	 * @param {String} targetDir - Target directory, which may be the same; except in tests, this is
	 *     the default data directory
	 */
	checkForMigration: async function (dataDir, newDir) {
		if (!this.canMigrate(dataDir)) {
			return false;
		}
		
		let migrationMarker = OS.Path.join(dataDir, this.MIGRATION_MARKER);
		try {
			var exists = await OS.File.exists(migrationMarker)
		}
		catch (e) {
			Zotero.logError(e);
		}
		let automatic = false;
		if (!exists) {
			automatic = true;
			
			// Skip automatic migration if there's a non-empty directory at the new location
			// TODO: Notify user
			if (((await OS.File.exists(newDir))) && !((await Zotero.File.directoryIsEmpty(newDir)))) {
				Zotero.debug(`${newDir} exists and is non-empty -- skipping migration`);
				return false;
			}
		}
		
		// Skip migration if new dir on different drive and prompt
		try {
			if (await this.isNewDirOnDifferentDrive(dataDir, newDir)) {
				Zotero.debug(`New dataDir ${newDir} is on a different drive from ${dataDir} -- skipping migration`);
				Zotero.DataDirectory.newDirOnDifferentDrive = true;
				
				let error = Zotero.getString(`dataDir.migration.failure.full.automatic.newDirOnDifferentDrive`, Zotero.clientName)
					+ "\n\n"
					+ Zotero.getString(`dataDir.migration.failure.full.automatic.text2`, Zotero.appName);
				return this.fullMigrationFailurePrompt(dataDir, newDir, error);
			}
		}
		catch (e) {
			Zotero.logError("Error checking whether data directory is on different drive "
				+ "-- skipping migration:\n\n" + e);
			return false;
		}
		
		// If there are other profiles pointing to the old directory, make sure we can edit the prefs.js
		// file before doing anything, or else we risk orphaning a 4.0 installation
		try {
			let otherProfiles = await Zotero.Profile.findOtherProfilesUsingDataDirectory(dataDir);
			// 'touch' each prefs.js file to make sure we can access it
			for (let dir of otherProfiles) {
				let prefsFile = OS.Path.join(dir, "prefs.js");
				await IOUtils.setModificationTime(prefsFile);
			}
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.logError("Error checking other profiles -- skipping migration");
			// TODO: After 5.0 has been out a while, remove this and let migration continue even if
			// other profile directories can't be altered, with the assumption that they'll be running
			// 5.0 already and will be pick up the new data directory automatically.
			return false;
		}
		
		if (automatic) {
			await this.markForMigration(dataDir, true);
		}
		
		let sourceDir;
		let oldDir;
		let partial = false;
		
		// Check whether this is an automatic or manual migration
		let contents;
		try {
			contents = await Zotero.File.getContentsAsync(migrationMarker);
			({ sourceDir, automatic } = JSON.parse(contents));
		}
		catch (e) {
			if (contents !== undefined) {
				Zotero.debug(contents, 1);
			}
			Zotero.logError(e);
			return false;
		}
		
		// Not set to the default directory, so use current as old directory
		if (dataDir != newDir) {
			oldDir = dataDir;
		}
		// Unfinished migration -- already using new directory, so get path to previous
		// directory from the migration marker
		else {
			oldDir = sourceDir;
			partial = true;
		}
		
		// Not yet used
		let progressHandler = function (progress, progressMax) {
			this.updateZoteroPaneProgressMeter(Math.round(progress / progressMax));
		}.bind(this);
		
		let errors;
		let mode = automatic ? 'automatic' : 'manual';
		// This can seemingly fail due to a race condition building the Standalone window,
		// so just ignore it if it does
		try {
			Zotero.showZoteroPaneProgressMeter(
				Zotero.getString("dataDir.migration.inProgress"),
				false,
				null,
				// Don't show message in a popup in Standalone if pane isn't ready
				true
			);
		}
		catch (e) {
			Zotero.logError(e);
		}
		try {
			errors = await this.migrate(oldDir, newDir, partial, progressHandler);
		}
		catch (e) {
			// Complete failure (failed to create new directory, copy marker, or move database)
			Zotero.debug("Migration failed", 1);
			Zotero.logError(e);
			
			let error = Zotero.getString(`dataDir.migration.failure.full.${mode}.text1`, Zotero.clientName)
				+ "\n\n"
				+ e
				+ "\n\n"
				+ Zotero.getString(`dataDir.migration.failure.full.${mode}.text2`, Zotero.appName);
			await this.fullMigrationFailurePrompt(oldDir, newDir, error);
			
			// Clear status line from progress meter
			try {
				Zotero.showZoteroPaneProgressMeter("", false, null, true);
			}
			catch (e) {
				Zotero.logError(e);
			}
			return;
		}
		
		// Set data directory again
		Zotero.debug("Using new data directory " + newDir);
		this._cache(newDir);
		
		// At least the database was copied, but other things failed
		if (errors.length) {
			let ps = Services.prompt;
			let buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
				+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING)
				+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_IS_STRING);
			let index = ps.confirmEx(null,
				Zotero.getString('dataDir.migration.failure.title'),
				Zotero.getString(`dataDir.migration.failure.partial.${mode}.text`,
						[ZOTERO_CONFIG.CLIENT_NAME, Zotero.appName])
					+ "\n\n"
					+ Zotero.getString('dataDir.migration.failure.partial.old', oldDir)
					+ "\n\n"
					+ Zotero.getString('dataDir.migration.failure.partial.new', newDir),
				buttonFlags,
				Zotero.getString('general.tryAgain'),
				Zotero.getString('general.tryLater'),
				Zotero.getString('dataDir.migration.failure.partial.showDirectoriesAndQuit', Zotero.appName),
				null, {}
			);
			
			if (index == 0) {
				return this.checkForMigration(newDir, newDir);
			}
			// Focus the first file/folder in the old directory
			else if (index == 2) {
				try {
					let firstEntry;
					await Zotero.File.iterateDirectory(oldDir, function (entry, index, iterator) {
						firstEntry = entry;
						iterator.close();
					});
					if (firstEntry) {
						await Zotero.File.reveal(firstEntry.path);
					}
					// Focus the database file in the new directory
					await Zotero.File.reveal(OS.Path.join(newDir, this.getDatabaseFilename()));
				}
				catch (e) {
					Zotero.logError(e);
				}
				
				Zotero.skipLoading = true;
				Zotero.Utilities.Internal.quitZotero();
				return;
			}
		}
	},
	
	
	fullMigrationFailurePrompt: async function (oldDir, newDir, error) {
		let ps = Services.prompt;
		let buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING);
		let index = ps.confirmEx(null,
			Zotero.getString('dataDir.migration.failure.title'),
			error + "\n\n"
				+ Zotero.getString('dataDir.migration.failure.full.current', oldDir)
				+ "\n\n"
				+ Zotero.getString('dataDir.migration.failure.full.recommended', newDir),
			buttonFlags,
			Zotero.getString('dataDir.migration.failure.full.showCurrentDirectoryAndQuit', Zotero.appName),
			Zotero.getString('general.notNow'),
			null, null, {}
		);
		if (index == 0) {
			await Zotero.File.reveal(oldDir);
			Zotero.skipLoading = true;
			Zotero.Utilities.Internal.quitZotero();
		}
	},
	
	
	/**
	 * Recursively moves data directory from one location to another and updates the data directory
	 * setting in this profile and any profiles pointing to the old location
	 *
	 * If moving the database file fails, an error is thrown.
	 * Otherwise, an array of errors is returned.
	 *
	 * @param {String} oldDir
	 * @param {String} newDir
	 * @return {Error[]}
	 */
	migrate: async function (oldDir, newDir, partial) {
		var dbName = this.getDatabaseFilename();
		var errors = [];
		
		function addError(e) {
			errors.push(e);
			Zotero.logError(e);
		}
		
		if (!((await OS.File.exists(oldDir)))) {
			Zotero.debug(`Old directory ${oldDir} doesn't exist -- nothing to migrate`);
			try {
				let newMigrationMarker = OS.Path.join(newDir, this.MIGRATION_MARKER);
				Zotero.debug("Removing " + newMigrationMarker);
				await OS.File.remove(newMigrationMarker);
			}
			catch (e) {
				Zotero.logError(e);
			}
			return [];
		}
		
		if (partial) {
			Zotero.debug(`Continuing data directory migration from ${oldDir} to ${newDir}`);
		}
		else {
			Zotero.debug(`Migrating data directory from ${oldDir} to ${newDir}`);
		}
		
		// Create the new directory
		if (!partial) {
			await IOUtils.makeDirectory(
				newDir,
				{
					ignoreExisting: false,
					permissions: 0o755
				}
			);
		}
		
		// Copy marker
		let oldMarkerFile = OS.Path.join(oldDir, this.MIGRATION_MARKER);
		// Marker won't exist on subsequent attempts after partial failure
		if (await OS.File.exists(oldMarkerFile)) {
			await OS.File.copy(oldMarkerFile, OS.Path.join(newDir, this.MIGRATION_MARKER));
		}
		
		// Update the data directory setting first so that a failure immediately after the move won't
		// leave the database stranded
		this.set(newDir);
		
		// Move database
		if (!partial) {
			Zotero.debug("Moving " + dbName);
			try {
				await OS.File.move(OS.Path.join(oldDir, dbName), OS.Path.join(newDir, dbName));
			}
			// If moving the database failed, revert to the old data directory and clear marker files
			catch (e) {
				if (this.isLegacy(oldDir)) {
					Zotero.Prefs.clear('dataDir');
					Zotero.Prefs.clear('useDataDir');
				}
				else {
					this.set(oldDir);
				}
				try {
					await OS.File.remove(oldMarkerFile, { ignoreAbsent: true });
				}
				catch (e) {
					Zotero.logError(e);
				}
				try {
					await OS.File.remove(OS.Path.join(newDir, this.MIGRATION_MARKER));
					await OS.File.removeEmptyDir(newDir);
				}
				catch (e) {
					Zotero.logError(e);
				}
				throw e;
			}
		}
		
		// Once the database has been moved, we can clear the migration marker from the old directory.
		// If the migration is interrupted after this, it can be continued later based on the migration
		// marker in the new directory.
		try {
			await OS.File.remove(OS.Path.join(oldDir, this.MIGRATION_MARKER));
		}
		catch (e) {
			addError(e);
		}
		
		errors = errors.concat(await Zotero.File.moveDirectory(
			oldDir,
			newDir,
			{
				allowExistingTarget: true,
				// Don't overwrite root files (except for hidden files like .DS_Store)
				noOverwrite: path => {
					return PathUtils.parent(path) == oldDir && !PathUtils.filename(path).startsWith('.')
				},
			}
		));
		
		if (errors.length) {
			Zotero.logError("Not all files were transferred from " + oldDir + " to " + newDir);
		}
		else {
			try {
				let newMigrationMarker = OS.Path.join(newDir, this.MIGRATION_MARKER);
				Zotero.debug("Removing " + newMigrationMarker);
				await OS.File.remove(newMigrationMarker);
				
				Zotero.debug("Migration successful");
			}
			catch (e) {
				addError(e);
			}
		}
		
		// Update setting in other profiles that point to this data directory
		try {
			let otherProfiles = await Zotero.Profile.findOtherProfilesUsingDataDirectory(oldDir);
			for (let dir of otherProfiles) {
				try {
					await Zotero.Profile.updateProfileDataDirectory(dir, oldDir, newDir);
				}
				catch (e) {
					Zotero.logError("Error updating " + OS.Path.join(dir.path, "prefs.js"));
					Zotero.logError(e);
				}
			}
		}
		catch (e) {
			Zotero.logError("Error updating other profiles to point to new location");
		}
		
		return errors;
	},
	
	
	getDatabaseFilename: function (name) {
		return (name || ZOTERO_CONFIG.ID) + '.sqlite';
	},
	
	getDatabase: function (name, ext) {
		name = this.getDatabaseFilename(name);
		ext = ext ? '.' + ext : '';
		
		return OS.Path.join(this.dir, name + ext);
	},

	/**
	 * @param {String} name - the name of the subdirectory
	 * @param {Boolean} createIfMissing - ensure that the directory exists
	 * @return {String} the path to the subdirectory
	 */
	getSubdirectory: function (name, createIfMissing = false) {
		let dir = OS.Path.join(this.dir, name);
		if (createIfMissing) {
			Zotero.File.createDirectoryIfMissing(dir);
		}
		return dir;
	},

	/**
	 * @param {String} name - the name of the subdirectory
	 * @return {Promise<Boolean>} true if the subdirectory was deleted,
	 *   or false if it did not exist
	 */
	removeSubdirectory: function (name) {
		return OS.File.removeDir(OS.Path.join(this.dir, name), {ignoreAbsent: true});
	}
};
