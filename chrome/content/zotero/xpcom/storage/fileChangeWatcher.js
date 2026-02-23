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
 * On unsupported platforms or on error, falls back to the existing scan logic.
 */
Zotero.Sync.Storage.FileChangeWatcher = {
	available: false,
	_backend: null,

	// Cached storage root path (normalized, with trailing separator)
	_storageRoot: null,

	// Key validation pattern
	_keyPattern: /^[A-Z0-9]{8}$/,

	// For live watcher backends (RDCW and inotify), track whether the first call has happened
	// (returns null to trigger a full scan) and enforce periodic full scans every
	// _MAX_WATCHER_AGE ms
	_liveWatcherFirstCall: true,
	_liveWatcherLastFullScanTime: 0,
	_MAX_WATCHER_AGE: 10800000, // 3 hours -- matches storageEngine.maxCheckAge

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
		}
	},

	/**
	 * Get the set of item keys whose storage files have changed since the last call to this method.
	 *
	 * @return {Set|null} Set of 8-char item keys, or null to signal that the caller should fall
	 * back to a full scan
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
			Zotero.logError(e);
			Zotero.debug("FileChangeWatcher: getChangedItemKeys() failed -- signaling fallback");
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
	},

	//
	// Common helpers
	//

	/**
	 * For live watcher backends (RDCW and inotify), check whether we should return null to
	 * trigger a full scan (first call or periodic refresh).
	 *
	 * @return {boolean} true if getChangedItemKeys should return null
	 */
	_liveWatcherNeedsFullScan() {
		if (this._liveWatcherFirstCall) {
			this._liveWatcherFirstCall = false;
			this._liveWatcherLastFullScanTime = Date.now();
			return true;
		}
		if (Date.now() - this._liveWatcherLastFullScanTime
				> this._MAX_WATCHER_AGE) {
			this._liveWatcherLastFullScanTime = Date.now();
			return true;
		}
		return false;
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
