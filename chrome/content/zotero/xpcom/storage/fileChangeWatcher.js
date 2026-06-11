/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
	                 Vienna, Virginia, USA
	                 https://www.zotero.org

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

/**
 * File change watcher for storage sync
 *
 * Uses platform-native file change APIs to track which stored-file attachments have been modified,
 * avoiding expensive full scans of all attachment files.
 *
 * Backends (loaded from separate files):
 *   macOS   -- FSEvents (persistent event journal, survives restarts)
 *   Windows -- ReadDirectoryChangesW (live recursive directory watch)
 *   Linux   -- inotify (live per-directory watches)
 *
 * The storage directory is shared by all libraries, so backend events are drained once per sync
 * session via snapshot(), which maps the changed item keys to items across all libraries and
 * immediately runs the modification check on them, recording any changes in the database. The
 * per-library storage engines then only need to ask needsFullScan() whether the watcher can be
 * relied on for their library or a full scan is required -- because the library hasn't been
 * scanned since a point where events may have been missed (watcher startup on the live-watcher
 * platforms, or a backend fallback signal such as a missing event journal baseline, a buffer
 * overflow, or an error). As insurance against silently dropped events, the live-watcher
 * platforms also do a full scan on every manual sync and daily on background syncs.
 *
 * On macOS the set of libraries scanned since the last journal discontinuity is persisted to a
 * pref, since the FSEvents journal survives restarts and full scans would otherwise be repeated
 * (or, worse, skipped) after a restart. An absent pref means no library has been scanned, so
 * every library gets one full scan the first time this code runs.
 *
 * On unsupported platforms or on error, falls back to the existing scan logic.
 */
Zotero.Sync.Storage.FileChangeWatcher = {
	available: false,
	_backend: null,

	// Cached storage root path (normalized, with trailing separator)
	_storageRoot: null,

	// Key validation pattern
	_keyPattern: /^[A-Z0-9]{8}$/,

	// Whether snapshot() has been called since init
	_snapshotTaken: false,

	// macOS: libraries fully scanned since the last event journal discontinuity (persisted)
	_scannedLibraries: null,

	// Windows/Linux: libraryID -> time of the last full scan this session
	_lastFullScan: {},

	_SCANNED_LIBRARIES_PREF: 'sync.storage.watcher.scannedLibraries',

	// How long watcher results can be relied on for background syncs on the live-watcher
	// platforms before a full scan is done as insurance against silently dropped events
	_MAX_WATCHER_AGE: 86400000, // 24 hours

	init() {
		try {
			// Ensure the storage directory exists -- on a new installation it may not have
			// been created yet, and the backends need it to set up their watches
			let storageDir = Zotero.getStorageDirectory();
			storageDir.normalize();
			let sep = Zotero.isWin ? "\\" : "/";
			let path = storageDir.path;
			if (!path.endsWith(sep)) {
				path += sep;
			}
			this._storageRoot = path;
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.debug("FileChangeWatcher: Could not resolve storage root");
			return;
		}

		let initFn;
		let backendName;
		if (Zotero.isMac) {
			initFn = '_initFSEvents';
			backendName = 'fsevents';
		}
		else if (Zotero.isWin) {
			initFn = '_initRDCW';
			backendName = 'rdcw';
		}
		else if (Zotero.isLinux) {
			initFn = '_initInotify';
			backendName = 'inotify';
		}
		else {
			Zotero.debug("FileChangeWatcher: No backend available for this platform");
			return;
		}

		try {
			this[initFn]();
			this._backend = backendName;
			this.available = true;
			Zotero.debug(`FileChangeWatcher: ${backendName} backend initialized`);
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.debug("FileChangeWatcher: " + backendName + " init failed -- "
				+ "falling back to legacy scanning");
			return;
		}

		this._snapshotTaken = false;
		this._lastFullScan = {};
		this._loadScannedLibraries();
	},

	/**
	 * Drain changed item keys from the backend, map them to items across all libraries, and run
	 * the modification check on them, marking any changed files for upload in the database
	 *
	 * Called once per sync session, before the per-library storage engines run.
	 */
	async snapshot() {
		if (!this.available) {
			return;
		}
		this._snapshotTaken = true;
		this._pruneScannedLibraries();
		let keys;
		try {
			keys = this.getChangedItemKeys();
		}
		catch (e) {
			Zotero.logError(e);
			keys = null;
		}
		if (!keys) {
			// Backend signaled fallback -- events may have been missed for any library, so
			// require a full scan of each library
			this._requireFullScans();
			return;
		}
		if (!keys.size) {
			return;
		}
		try {
			// Map keys to items across all libraries -- a key can match items in multiple
			// libraries, and checkForUpdatedFiles() filters out unchanged files by mtime/hash
			let itemIDsByLibrary = {};
			await Zotero.Utilities.Internal.forEachChunkAsync(
				[...keys],
				500,
				async (chunk) => {
					let rows = await Zotero.DB.queryAsync(
						"SELECT libraryID, itemID FROM items WHERE key IN ("
							+ chunk.map(() => '?').join(',') + ")",
						chunk
					);
					for (let row of rows) {
						if (!itemIDsByLibrary[row.libraryID]) {
							itemIDsByLibrary[row.libraryID] = [];
						}
						itemIDsByLibrary[row.libraryID].push(row.itemID);
					}
				}
			);
			for (let libraryID in itemIDsByLibrary) {
				await Zotero.Sync.Storage.Local.checkForUpdatedFiles(
					parseInt(libraryID), itemIDsByLibrary[libraryID]
				);
			}
		}
		catch (e) {
			// Don't lose changes if the check failed
			Zotero.logError(e);
			this._requireFullScans();
		}
	},

	/**
	 * Whether a library needs a full modification scan instead of relying on watcher results
	 *
	 * The caller should call recordFullScan() once the scan has completed.
	 *
	 * @param {Integer} libraryID
	 * @param {Boolean} background - Whether this is a background sync -- on the live-watcher
	 *     platforms, manual syncs always do a full scan as a user-triggered recovery mechanism
	 * @return {Boolean}
	 */
	needsFullScan(libraryID, background) {
		if (!this.available) {
			return true;
		}
		let reason = null;
		if (!this._snapshotTaken) {
			reason = "no snapshot taken";
		}
		else if (this._backend == 'fsevents') {
			if (!this._scannedLibraries.has(libraryID)) {
				reason = "library not scanned since last event journal reset";
			}
		}
		else if (!background) {
			reason = "manual sync";
		}
		else {
			let lastFullScan = this._lastFullScan[libraryID] || 0;
			if (!lastFullScan) {
				reason = "library not yet scanned this session";
			}
			else if (Date.now() - lastFullScan > this._MAX_WATCHER_AGE) {
				reason = "daily refresh";
			}
		}
		if (!reason) {
			return false;
		}
		Zotero.debug("FileChangeWatcher: Full scan needed for library " + libraryID
			+ " -- " + reason);
		return true;
	},

	/**
	 * Record that a full modification scan of a library was completed
	 *
	 * @param {Integer} libraryID
	 */
	recordFullScan(libraryID) {
		this._lastFullScan[libraryID] = Date.now();
		this._scannedLibraries.add(libraryID);
		if (this._backend == 'fsevents') {
			this._saveScannedLibraries();
		}
	},

	/**
	 * Drain the set of item keys whose storage files have changed since the last drain from the
	 * platform backend
	 *
	 * @return {Set|null} Set of 8-char item keys, or null to signal that events may have been
	 * missed and callers should fall back to full scans
	 */
	getChangedItemKeys() {
		if (!this.available) {
			return null;
		}
		try {
			switch (this._backend) {
				case 'fsevents':
					return this._getChangedItemKeysFSEvents();
				case 'rdcw':
					return this._getChangedItemKeysRDCW();
				case 'inotify':
					return this._getChangedItemKeysInotify();
			}
		}
		catch (e) {
			// A backend exception means the watcher can no longer be trusted (e.g., the
			// inotify watch limit was reached), so disable it and let the legacy scan logic
			// take over for the rest of the session
			Zotero.logError(e);
			Zotero.debug("FileChangeWatcher: getChangedItemKeys() failed -- disabling for "
				+ "this session and falling back to legacy scanning");
			this.close();
		}
		return null;
	},

	close() {
		switch (this._backend) {
			case 'fsevents':
				this._closeFSEvents();
				break;
			case 'rdcw':
				this._closeRDCW();
				break;
			case 'inotify':
				this._closeInotify();
				break;
		}
		this._backend = null;
		this.available = false;
		this._snapshotTaken = false;
	},

	//
	// Common helpers
	//

	/**
	 * Remove scan records for libraries that no longer exist, both to keep the pref from
	 * accumulating cruft and because SQLite can reuse the libraryID of a deleted library for a
	 * new one, which shouldn't inherit the old library's scan record
	 */
	_pruneScannedLibraries() {
		let libraryIDs = new Set(Zotero.Libraries.getAll().map(library => library.libraryID));
		let pruned = false;
		for (let libraryID of this._scannedLibraries) {
			if (!libraryIDs.has(libraryID)) {
				this._scannedLibraries.delete(libraryID);
				pruned = true;
			}
		}
		for (let libraryID in this._lastFullScan) {
			if (!libraryIDs.has(parseInt(libraryID))) {
				delete this._lastFullScan[libraryID];
			}
		}
		if (pruned && this._backend == 'fsevents') {
			this._saveScannedLibraries();
		}
	},

	_requireFullScans() {
		this._scannedLibraries.clear();
		this._lastFullScan = {};
		if (this._backend == 'fsevents') {
			this._saveScannedLibraries();
		}
	},

	_loadScannedLibraries() {
		this._scannedLibraries = new Set();
		if (this._backend != 'fsevents') {
			return;
		}
		try {
			let scanned = Zotero.Prefs.get(this._SCANNED_LIBRARIES_PREF);
			if (scanned) {
				this._scannedLibraries = new Set(JSON.parse(scanned));
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
	},

	_saveScannedLibraries() {
		Zotero.Prefs.set(
			this._SCANNED_LIBRARIES_PREF, JSON.stringify([...this._scannedLibraries])
		);
	},

	/**
	 * Log changed key count or "no changes" and return the Set.
	 *
	 * @param {Set} keys
	 * @return {Set}
	 */
	_returnKeys(keys) {
		if (keys.size > 0) {
			Zotero.debug("FileChangeWatcher: " + keys.size + " changed key(s): "
				+ [...keys].join(", "));
		}
		else {
			Zotero.debug("FileChangeWatcher: No changes detected");
		}
		return keys;
	},
};
