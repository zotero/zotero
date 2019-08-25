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

import FilePicker from 'zotero/filePicker';

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
		if (Zotero.test) {
			return OS.Path.join(OS.Path.dirname(OS.Constants.Path.profileDir), "Zotero");
		}
		return OS.Path.join(OS.Constants.Path.homeDir, ZOTERO_CONFIG.CLIENT_NAME);
	},
	
	get legacyDirName() {
		return ZOTERO_CONFIG.ID;
	},
	
	_dir: null,
	_warnOnUnsafeLocation: true,
	
	
	init: Zotero.Promise.coroutine(function* () {
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
				// Ignore non-absolute paths
				if ("winIsAbsolute" in OS.Path) {
					if (!OS.Path.winIsAbsolute(dir)) {
						dir = false;
					}
				}
				else if (!dir.startsWith('/')) {
					dir = false;
				}
				if (!dir) {
					throw `-datadir requires an absolute path or 'profile' ('${Zotero.forceDataDir}' given)`;
				}
				
				// Require parent directory to exist
				if (!(yield OS.File.exists(OS.Path.dirname(dir)))) {
					throw `Parent directory of -datadir ${dir} not found`;
				}
				
				dataDir = dir;
			}
		}
		else if (Zotero.Prefs.get('useDataDir')) {
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
					Zotero.debug("Persistent descriptor in extensions.zotero.dataDir did not resolve", 1);
					e = { name: "NS_ERROR_FILE_NOT_FOUND" };
					throw e;
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
				
				if ((yield OS.File.exists(migrationMarker)) && !(yield OS.File.exists(dbFile))) {
					let contents = yield Zotero.File.getContentsAsync(migrationMarker);
					try {
						let { sourceDir } = JSON.parse(contents);
						dataDir = OS.Path.normalize(sourceDir);
					}
					catch (e) {
						Zotero.logError(e);
						Zotero.debug(`Invalid marker file:\n\n${contents}`, 1);
						throw { name: "NS_ERROR_FILE_NOT_FOUND" };
					}
				}
				else {
					try {
						dataDir = OS.Path.normalize(prefVal);
					}
					catch (e) {
						Zotero.logError(e);
						Zotero.debug(`Invalid path '${prefVal}' in dataDir pref`, 1);
						throw { name: "NS_ERROR_FILE_NOT_FOUND" };
					}
				}
			}
			
			if (!(yield OS.File.exists(dataDir)) && dataDir != this.defaultDir) {
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
					Zotero.debug(`Custom data directory ${dataDir} not found`, 1);
					throw { name: "NS_ERROR_FILE_NOT_FOUND" };
				}
			}
			
			try {
				if (dataDir != this.defaultDir
						&& this.isLegacy(dataDir)
						&& (yield OS.File.exists(OS.Path.join(this.defaultDir, 'move-to-old')))) {
					let newPath = this.defaultDir + '-Old';
					if (yield OS.File.exists(newPath)) {
						newPath += "-1";
					}
					yield Zotero.File.moveDirectory(this.defaultDir, newPath);
					yield OS.File.remove(OS.Path.join(newPath, 'move-to-old'));
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		// New installation of 5.0+ with no data directory specified, so check all the places the data
		// could be
		else {
			Zotero.fxProfileAccessError = false;
			
			dataDir = this.defaultDir;
			
			// If there's already a profile pointing to the default location, use a different
			// data directory named after the profile, as long as one either doesn't exist yet or
			// one does and it contains a database
			try {
				if ((yield Zotero.Profile.findOtherProfilesUsingDataDirectory(dataDir, false)).length) {
					let profileName = OS.Path.basename(Zotero.Profile.dir).match(/[^.]+\.(.+)/)[1];
					let newDataDir = this.defaultDir + ' ' + profileName;
					if (!(yield OS.File.exists(newDataDir))
							|| (yield OS.File.exists(OS.Path.join(newDataDir, dbFilename)))) {
						dataDir = newDataDir;
					}
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
			
			// Check for ~/Zotero/zotero.sqlite
			let dbFile = OS.Path.join(dataDir, dbFilename);
			if (yield OS.File.exists(dbFile)) {
				Zotero.debug("Using data directory " + dataDir);
				this._cache(dataDir);
				
				// Set as a custom data directory so that 4.0 uses it
				this.set(dataDir);
				
				return dataDir;
			}
			
			let useProfile = false;
			let useFirefoxProfile = false;
			let useFirefoxProfileCustom = false;
			
			// Check for <profile dir>/zotero/zotero.sqlite
			let profileSubdirModTime;
			try {
				let dir = OS.Path.join(Zotero.Profile.dir, this.legacyDirName);
				let dbFile = OS.Path.join(dir, dbFilename);
				profileSubdirModTime = (yield OS.File.stat(dbFile)).lastModificationDate;
				Zotero.debug(`Database found at ${dbFile}, last modified ${profileSubdirModTime}`);
				dataDir = dir;
				useProfile = true;
			}
			catch (e) {
				if (!(e instanceof OS.File.Error && e.becauseNoSuchFile)) {
					throw e;
				}
			}
			
			//
			// Check Firefox directory
			//
			let profilesParent = OS.Path.dirname(Zotero.Profile.getOtherAppProfilesDir());
			Zotero.debug("Looking for Firefox profile in " + profilesParent);
			
			// get default profile
			var defProfile;
			try {
				defProfile = yield Zotero.Profile.getDefaultInProfilesDir(profilesParent);
			}
			catch (e) {
				Zotero.debug("An error occurred locating the Firefox profile; "
					+ "not attempting to migrate from Zotero for Firefox");
				Zotero.logError(e);
				Zotero.fxProfileAccessError = true;
			}
			if (defProfile) {
				let profileDir = defProfile[0];
				Zotero.debug("Found default profile at " + profileDir);
				
				// Read in prefs
				let prefsFile = OS.Path.join(profileDir, "prefs.js");
				if (yield OS.File.exists(prefsFile)) {
					let prefs = yield Zotero.Profile.readPrefsFromFile(prefsFile);
					
					// Check for data dir pref
					if (prefs['extensions.zotero.dataDir'] && prefs['extensions.zotero.useDataDir']) {
						Zotero.debug(`Found custom dataDir of ${prefs['extensions.zotero.dataDir']}`);
						let nsIFile;
						try {
							nsIFile = Components.classes["@mozilla.org/file/local;1"]
								.createInstance(Components.interfaces.nsIFile);
							nsIFile.persistentDescriptor = prefs['extensions.zotero.dataDir'];
						}
						catch (e) {
							Zotero.logError(e);
							if (!useProfile) {
								Zotero.debug("Persistent descriptor in extensions.zotero.dataDir "
									+ "did not resolve", 1);
								throw { name: "NS_ERROR_FILE_NOT_FOUND" };
							}
						}
						try {
							let dbFile = OS.Path.join(nsIFile.path, dbFilename);
							let mtime = (yield OS.File.stat(dbFile)).lastModificationDate;
							Zotero.debug(`Database found at ${dbFile}, last modified ${mtime}`);
							// If custom location has a newer DB, use that
							if (!useProfile || mtime > profileSubdirModTime) {
								dataDir = nsIFile.path;
								useFirefoxProfileCustom = true;
								useProfile = false;
							}
						}
						catch (e) {
							Zotero.logError(e);
							// If we have a DB in the Zotero profile and get an error trying to
							// access the custom location in Firefox, use the Zotero profile, since
							// there's at least some chance it's right. Otherwise, throw an error.
							if (!useProfile) {
								// The error message normally gets the path from the pref, but
								// we got it from the prefs file, so include it here
								e.dataDir = nsIFile.path;
								throw e;
							}
							Zotero.fxProfileAccessError = true;
						}
					}
					// If no custom dir specified, check for a subdirectory
					else {
						try {
							let dir = OS.Path.join(profileDir, this.legacyDirName);
							let dbFile = OS.Path.join(dir, dbFilename);
							let mtime = (yield OS.File.stat(dbFile)).lastModificationDate;
							Zotero.debug(`Database found at ${dbFile}, last modified ${mtime}`);
							// If newer than Zotero profile directory, use this one
							if (!useProfile || mtime > profileSubdirModTime) {
								dataDir = dir;
								useFirefoxProfile = true;
								useProfile = false;
							}
						}
						// Legacy subdirectory doesn't exist or there was a problem accessing it, so
						// just fall through to default location
						catch (e) {
							if (!(e instanceof OS.File.Error && e.becauseNoSuchFile)) {
								Zotero.logError(e);
								Zotero.fxProfileAccessError = true;
							}
						}
					}
					
					// If using data directory from Zotero for Firefox, transfer those prefs, because
					// the fact that that DB was more recent and wasn't set in the Zotero profile prefs
					// means that they were using Firefox.
					if (useFirefoxProfile || useFirefoxProfileCustom) {
						for (let key in prefs) {
							if (key.substr(0, ZOTERO_CONFIG.PREF_BRANCH.length) === ZOTERO_CONFIG.PREF_BRANCH
									&& key !== "extensions.zotero.firstRun2") {
								Zotero.Prefs.set(key.substr(ZOTERO_CONFIG.PREF_BRANCH.length), prefs[key]);
							}
						}
						
						// If data directory setting was transferred, use that
						if (Zotero.Prefs.get('useDataDir')) {
							return this.init();
						}
					}
				}
			}
			
			this.set(dataDir);
		}
		
		Zotero.debug("Using data directory " + dataDir);
		try {
			yield Zotero.File.createDirectoryIfMissingAsync(dataDir);
		}
		catch (e) {
			if (e instanceof OS.File.Error
					&& (('unixErrno' in e && e.unixErrno == OS.Constants.libc.EACCES)
						|| ('winLastError' in e && e.winLastError == OS.Constants.Win.ERROR_ACCESS_DENIED))) {
				Zotero.restarting = true;
				let isDefaultDir = dataDir == Zotero.DataDirectory.defaultDir;
				let ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.createInstance(Components.interfaces.nsIPromptService);
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
						let changed = yield Zotero.DataDirectory.choose(true);
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
						let changed = yield Zotero.DataDirectory.choose(true);
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
	}),
	
	
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
	
	
	choose: async function (forceQuitNow, useHomeDir, moreInfoCallback) {
		var win = Services.wm.getMostRecentWindow('navigator:browser');
		var ps = Services.prompt;
		
		if (useHomeDir) {
			let changed = this.set(this.defaultDir);
			if (!changed) {
				return false;
			}
		}
		else {
			while (true) {
				let fp = new FilePicker();
				fp.init(win, Zotero.getString('dataDir.selectDir'), fp.modeGetFolder);
				fp.displayDirectory = this._dir ? this._dir : OS.Path.dirname(this.defaultDir);
				fp.appendFilters(fp.filterAll);
				if (await fp.show() == fp.returnOK) {
					let file = Zotero.File.pathToFile(fp.file);
					let dialogText = '';
					let dialogTitle = '';
					
					if (file.path == (Zotero.Prefs.get('lastDataDir') || Zotero.Prefs.get('dataDir'))) {
						Zotero.debug("Data directory hasn't changed");
						return false;
					}
					
					// In dropbox folder
					if (Zotero.File.isDropboxDirectory(file.path)) {
						dialogTitle = Zotero.getString('general.warning');
						dialogText = Zotero.getString('dataDir.unsafeLocation.selected.dropbox') + "\n\n"
								+ Zotero.getString('dataDir.unsafeLocation.selected.useAnyway');
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
		
		return useHomeDir ? true : file;
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
			if (await fp.show() == fp.returnOK) {
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
	
	
	checkForUnsafeLocation: Zotero.Promise.coroutine(function* (path) {
		if (this._warnOnUnsafeLocation && Zotero.File.isDropboxDirectory(path)
				&& Zotero.Prefs.get('warnOnUnsafeDataDir')) {
			this._warnOnUnsafeLocation = false;
			let check = {value: false};
			let index = Services.prompt.confirmEx(
				null,
				Zotero.getString('general.warning'),
				Zotero.getString('dataDir.unsafeLocation.existing.dropbox') + "\n\n"
					+ Zotero.getString('dataDir.unsafeLocation.existing.chooseDifferent'),
				Services.prompt.STD_YES_NO_BUTTONS,
				null, null, null,
				Zotero.getString('general.dontShowWarningAgain'),
				check
			);

			// Yes - display dialog.
			if (index == 0) {
				yield this.choose(true);
			}
			if (check.value) {
				Zotero.Prefs.set('warnOnUnsafeDataDir', false);
			}
		}
	}),
	
	
	isLegacy: function (dir) {
		// 'zotero'
		return OS.Path.basename(dir) == this.legacyDirName
				// '69pmactz.default'
				&& OS.Path.basename(OS.Path.dirname(dir)).match(/^[0-9a-z]{8}\..+/)
				// 'Profiles'
				&& OS.Path.basename(OS.Path.dirname(OS.Path.dirname(dir))) == 'Profiles';
	},
	
	
	isNewDirOnDifferentDrive: Zotero.Promise.coroutine(function* (oldDir, newDir) {
		var filename = 'zotero-migration.tmp';
		var tmpFile = OS.Path.join(Zotero.getTempDirectory().path, filename);
		yield Zotero.File.putContentsAsync(tmpFile, ' ');
		var testPath = OS.Path.normalize(OS.Path.join(newDir, '..', filename));
		try {
			// Attempt moving the marker with noCopy
			yield OS.File.move(tmpFile, testPath, { noCopy: true });
		} catch(e) {
			yield OS.File.remove(tmpFile);
			
			Components.classes["@mozilla.org/net/osfileconstantsservice;1"].
				getService(Components.interfaces.nsIOSFileConstantsService).
				init();	
			if (e instanceof OS.File.Error) {
				if (e.unixErrno != undefined && e.unixErrno == OS.Constants.libc.EXDEV) {
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
		yield OS.File.remove(testPath);
		return false;
	}),
	
	
	// TODO: Remove after 5.0 upgrades
	checkForLostLegacy: async function () {
		var currentDir = this.dir;
		if (currentDir != this.defaultDir) return;
		if (Zotero.Prefs.get('ignoreLegacyDataDir.auto') || Zotero.Prefs.get('ignoreLegacyDataDir.explicit')) return;
		try {
			let profilesParent = OS.Path.dirname(Zotero.Profile.getOtherAppProfilesDir());
			Zotero.debug("Looking for Firefox profile in " + profilesParent);
			
			// get default profile
			var defProfile;
			try {
				defProfile = await Zotero.Profile.getDefaultInProfilesDir(profilesParent);
			}
			catch (e) {
				Zotero.logError(e);
				return;
			}
			if (!defProfile) {
				return;
			}
			let profileDir = defProfile[0];
			Zotero.debug("Found default profile at " + profileDir);
			
			let dir;
			let mtime;
			try {
				dir = OS.Path.join(profileDir, this.legacyDirName);
				let dbFile = OS.Path.join(dir, this.getDatabaseFilename());
				let info = await OS.File.stat(dbFile);
				if (info.size < 1200000) {
					Zotero.debug(`Legacy database is ${info.size} bytes -- ignoring`);
					Zotero.Prefs.set('ignoreLegacyDataDir.auto', true);
					return;
				}
				mtime = info.lastModificationDate;
				if (mtime < new Date(2017, 6, 1)) {
					Zotero.debug(`Legacy database was last modified on ${mtime.toString()} -- ignoring`);
					Zotero.Prefs.set('ignoreLegacyDataDir.auto', true);
					return;
				}
				Zotero.debug(`Legacy database found at ${dbFile}, last modified ${mtime}`);
			}
			catch (e) {
				Zotero.Prefs.set('ignoreLegacyDataDir.auto', true);
				if (e.becauseNoSuchFile) {
					return;
				}
				throw e;
			}
			
			let ps = Services.prompt;
			let buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
				+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
				+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_IS_STRING);
			let dontAskAgain = {};
			let index = ps.confirmEx(null,
				"Other Data Directory Found",
				"Zotero found a previous data directory within your Firefox profile, "
					+ `last modified on ${mtime.toLocaleDateString()}. `
					+ "If items or files are missing from Zotero that were present in Zotero for Firefox, "
					+ "your previous data directory may not have been properly migrated to the new default location "
					+ `in ${this.defaultDir}.\n\n`
					+ `Do you wish to continue using the current data directory or switch to the previous one?\n\n`
					+ `If you switch, your current data directory will be moved to ${this.defaultDir + '-Old'}, `
					+ `and the previous directory will be migrated to ${this.defaultDir}.`,
				buttonFlags,
				"Use Current Directory",
				null,
				"Switch to Previous Directory",
				"Don\u0027t ask me again",
				dontAskAgain
			);
			if (index == 1) {
				return;
			}
			if (dontAskAgain.value) {
				Zotero.Prefs.set('ignoreLegacyDataDir.explicit', true);
			}
			if (index == 0) {
				return;
			}
			
			// Switch to previous directory
			this.set(dir);
			// Set a marker to rename the current ~/Zotero directory
			try {
				await Zotero.File.putContentsAsync(OS.Path.join(this.defaultDir, 'move-to-old'), '');
			}
			catch (e) {
				Zotero.logError(e);
			}
			Zotero.Utilities.Internal.quit(true);
		}
		catch (e) {
			Zotero.logError(e);
		}
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
	checkForMigration: Zotero.Promise.coroutine(function* (dataDir, newDir) {
		if (!this.canMigrate(dataDir)) {
			return false;
		}
		
		let migrationMarker = OS.Path.join(dataDir, this.MIGRATION_MARKER);
		try {
			var exists = yield OS.File.exists(migrationMarker)
		}
		catch (e) {
			Zotero.logError(e);
		}
		let automatic = false;
		if (!exists) {
			automatic = true;
			
			// Skip automatic migration if there's a non-empty directory at the new location
			// TODO: Notify user
			if ((yield OS.File.exists(newDir)) && !(yield Zotero.File.directoryIsEmpty(newDir))) {
				Zotero.debug(`${newDir} exists and is non-empty -- skipping migration`);
				return false;
			}
		}
		
		// Skip migration if new dir on different drive and prompt
		try {
			if (yield this.isNewDirOnDifferentDrive(dataDir, newDir)) {
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
		
		// Check for an existing pipe from other running versions of Zotero pointing at the same data
		// directory, and skip migration if found
		try {
			let foundPipe = yield Zotero.IPC.pipeExists();
			if (foundPipe) {
				Zotero.debug("Found existing pipe -- skipping migration");
				
				if (!automatic) {
					let ps = Services.prompt;
					let buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
						+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING);
					let index = ps.confirmEx(null,
						Zotero.getString('dataDir.migration.failure.title'),
						Zotero.getString('dataDir.migration.failure.full.firefoxOpen'),
						buttonFlags,
						Zotero.getString('general.tryAgain'),
						Zotero.getString('general.tryLater'),
						null, null, {}
					);
					
					if (index == 0) {
						return this.checkForMigration(newDir, newDir);
					}
				}
				
				return false;
			}
		}
		catch (e) {
			Zotero.logError("Error checking for pipe -- skipping migration:\n\n" + e);
			return false;
		}
		
		// If there are other profiles pointing to the old directory, make sure we can edit the prefs.js
		// file before doing anything, or else we risk orphaning a 4.0 installation
		try {
			let otherProfiles = yield Zotero.Profile.findOtherProfilesUsingDataDirectory(dataDir);
			// 'touch' each prefs.js file to make sure we can access it
			for (let dir of otherProfiles) {
				let prefs = OS.Path.join(dir, "prefs.js");
				yield OS.File.setDates(prefs);
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
			yield this.markForMigration(dataDir, true);
		}
		
		let sourceDir;
		let oldDir;
		let partial = false;
		
		// Check whether this is an automatic or manual migration
		let contents;
		try {
			contents = yield Zotero.File.getContentsAsync(migrationMarker);
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
				Zotero.isStandalone
			);
		}
		catch (e) {
			Zotero.logError(e);
		}
		try {
			errors = yield this.migrate(oldDir, newDir, partial, progressHandler);
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
			yield this.fullMigrationFailurePrompt(oldDir, newDir, error);
			
			// Clear status line from progress meter
			try {
				Zotero.showZoteroPaneProgressMeter("", false, null, Zotero.isStandalone);
			}
			catch (e) {
				Zotero.logError(e);
			}
			return;
		}
		
		// Set data directory again
		Zotero.debug("Using new data directory " + newDir);
		this._cache(newDir);
		// Tell Zotero for Firefox in connector mode to reload and find the new data directory
		if (Zotero.isStandalone) {
			Zotero.IPC.broadcast('reinit');
		}
		
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
					yield Zotero.File.iterateDirectory(oldDir, function (entry, index, iterator) {
						firstEntry = entry;
						iterator.close();
					});
					if (firstEntry) {
						yield Zotero.File.reveal(firstEntry.path);
					}
					// Focus the database file in the new directory
					yield Zotero.File.reveal(OS.Path.join(newDir, this.getDatabaseFilename()));
				}
				catch (e) {
					Zotero.logError(e);
				}
				
				Zotero.skipLoading = true;
				Zotero.Utilities.Internal.quitZotero();
				return;
			}
		}
	}),
	
	
	fullMigrationFailurePrompt: Zotero.Promise.coroutine(function* (oldDir, newDir, error) {
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
			yield Zotero.File.reveal(oldDir);
			Zotero.skipLoading = true;
			Zotero.Utilities.Internal.quitZotero();
		}
	}),
	
	
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
	migrate: Zotero.Promise.coroutine(function* (oldDir, newDir, partial) {
		var dbName = this.getDatabaseFilename();
		var errors = [];
		
		function addError(e) {
			errors.push(e);
			Zotero.logError(e);
		}
		
		if (!(yield OS.File.exists(oldDir))) {
			Zotero.debug(`Old directory ${oldDir} doesn't exist -- nothing to migrate`);
			try {
				let newMigrationMarker = OS.Path.join(newDir, this.MIGRATION_MARKER);
				Zotero.debug("Removing " + newMigrationMarker);
				yield OS.File.remove(newMigrationMarker);
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
			yield OS.File.makeDir(
				newDir,
				{
					ignoreExisting: false,
					unixMode: 0o755
				}
			);
		}
		
		// Copy marker
		let oldMarkerFile = OS.Path.join(oldDir, this.MIGRATION_MARKER);
		// Marker won't exist on subsequent attempts after partial failure
		if (yield OS.File.exists(oldMarkerFile)) {
			yield OS.File.copy(oldMarkerFile, OS.Path.join(newDir, this.MIGRATION_MARKER));
		}
		
		// Update the data directory setting first so that a failure immediately after the move won't
		// leave the database stranded
		this.set(newDir);
		
		// Move database
		if (!partial) {
			Zotero.debug("Moving " + dbName);
			try {
				yield OS.File.move(OS.Path.join(oldDir, dbName), OS.Path.join(newDir, dbName));
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
					yield OS.File.remove(oldMarkerFile, { ignoreAbsent: true });
				}
				catch (e) {
					Zotero.logError(e);
				}
				try {
					yield OS.File.remove(OS.Path.join(newDir, this.MIGRATION_MARKER));
					yield OS.File.removeEmptyDir(newDir);
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
			yield OS.File.remove(OS.Path.join(oldDir, this.MIGRATION_MARKER));
		}
		catch (e) {
			addError(e);
		}
		
		errors = errors.concat(yield Zotero.File.moveDirectory(
			oldDir,
			newDir,
			{
				allowExistingTarget: true,
				// Don't overwrite root files (except for hidden files like .DS_Store)
				noOverwrite: path => {
					return OS.Path.dirname(path) == oldDir && !OS.Path.basename(path).startsWith('.')
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
				yield OS.File.remove(newMigrationMarker);
				
				Zotero.debug("Migration successful");
			}
			catch (e) {
				addError(e);
			}
		}
		
		// Update setting in other profiles that point to this data directory
		try {
			let otherProfiles = yield Zotero.Profile.findOtherProfilesUsingDataDirectory(oldDir);
			for (let dir of otherProfiles) {
				try {
					yield Zotero.Profile.updateProfileDataDirectory(dir, oldDir, newDir);
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
	}),
	
	
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
