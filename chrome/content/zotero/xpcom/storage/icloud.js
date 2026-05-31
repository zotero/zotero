/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2026 Center for History and New Media
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


/**
 * iCloud Drive file-storage backend.
 *
 * A third attachment file-storage controller, peer to WebDAV and ZFS. It implements the
 * same controller contract the storage engine and sync runner expect (mode/name/verified,
 * cacheCredentials, checkServer, handleVerificationError, downloadFile, uploadFile,
 * purgeDeletedStorageFiles, purgeOrphanedStorageFiles).
 *
 * Unlike WebDAV (HTTP) or ZFS (Zotero API), the "remote" here is a local iCloud Drive
 * ubiquitous container that macOS replicates out of band. All transport details
 * (placeholder materialization, coordinated I/O) live in Zotero.Sync.Storage.iCloudBridge;
 * this controller deals only in items, zips, and .prop metadata.
 *
 * On-disk layout inside the container's storage directory mirrors WebDAV:
 *   <KEY>.zip   -- zipped attachment directory
 *   <KEY>.prop  -- XML metadata: <properties version="1"><mtime/><hash/></properties>
 *
 * Reusing the WebDAV .prop format means the mtime/md5 conflict-detection logic is
 * identical, which is what makes iCloud a true peer rather than a special case.
 */

if (!Zotero.Sync.Storage.Mode) {
	Zotero.Sync.Storage.Mode = {};
}

Zotero.Sync.Storage.Mode.iCloud = function (options) {
	this.options = options;

	this.VerificationError = function (error) {
		this.message = `iCloud verification error (${error})`;
		this.error = error;
	};
	this.VerificationError.prototype = Object.create(Error.prototype);
};

Zotero.Sync.Storage.Mode.iCloud.defaultError = "An iCloud file sync error occurred. Please try syncing again.";

Zotero.Sync.Storage.Mode.iCloud.prototype = {
	mode: "icloud",
	name: "iCloud",

	get verified() {
		return Zotero.Prefs.get("sync.storage.icloud.verified");
	},
	set verified(val) {
		Zotero.Prefs.set("sync.storage.icloud.verified", !!val);
	},

	_storageDir: null,

	get bridge() {
		return Zotero.Sync.Storage.iCloudBridge;
	},

	get storageDir() {
		if (!this._storageDir) {
			throw new Error("iCloud storage directory not initialized");
		}
		return this._storageDir;
	},


	/**
	 * Resolve and create the container storage directory.
	 *
	 * Analogous to WebDAV's _init(): cheap and idempotent; safe to call before every op.
	 */
	_init: async function () {
		if (this._storageDir) {
			return;
		}
		if (!this.bridge.available) {
			throw new this.VerificationError("UNSUPPORTED_PLATFORM");
		}
		this._storageDir = await this.bridge.ensureStorageDirectory();
	},


	/**
	 * No network credentials for iCloud; "caching credentials" just means resolving the
	 * container path up front so the per-file operations don't re-resolve it.
	 */
	cacheCredentials: async function () {
		await this._init();
	},


	clearCachedCredentials: function () {
		Zotero.debug("iCloud: Clearing cached container path");
		this._storageDir = null;
	},


	// -- Path helpers -------------------------------------------------------------

	_getItemFilePath: function (item) {
		return PathUtils.join(this.storageDir, item.key + '.zip');
	},

	_getItemPropPath: function (item) {
		return PathUtils.join(this.storageDir, item.key + '.prop');
	},


	/**
	 * Read mtime/hash metadata from an item's .prop file.
	 *
	 * Mirrors WebDAV._getStorageFileMetadata(), including deletion of invalid .prop files,
	 * so conflict detection behaves identically across backends.
	 *
	 * @param {Zotero.Item} item
	 * @return {Promise<Object|false>} - { mtime, md5 } or false if no metadata
	 */
	_getStorageFileMetadata: async function (item) {
		var propPath = this._getItemPropPath(item);
		var text = await this.bridge.readUTF8(propPath);
		if (!text) {
			return false;
		}

		var mtime = false;
		var md5 = false;
		try {
			let xml = new DOMParser().parseFromString(text, "text/xml");
			try {
				mtime = xml.getElementsByTagName('mtime')[0].textContent;
			}
			catch (e) {}
			try {
				md5 = xml.getElementsByTagName('hash')[0].textContent;
			}
			catch (e) {}
		}
		catch (e) {
			Zotero.logError(e);
		}

		// Delete invalid .prop files, matching WebDAV behavior
		if (!mtime || !String(mtime).match(/^[0-9]{1,13}$/)) {
			let msg = "Invalid mod date '" + Zotero.Utilities.ellipsize(String(mtime), 20)
				+ "' for item " + item.libraryKey;
			Zotero.logError(msg);
			await this.bridge.remove(propPath).catch(e => Zotero.logError(e));
			throw new Error(Zotero.Sync.Storage.Mode.iCloud.defaultError);
		}

		return {
			mtime: parseInt(mtime),
			md5
		};
	},


	/**
	 * Write an item's .prop file with the current local mtime/hash.
	 *
	 * @param {Zotero.Item} item
	 */
	_setStorageFileMetadata: async function (item) {
		var mtime = await item.attachmentModificationTime;
		var md5 = await item.attachmentHash;

		var xmlstr = '<properties version="1">'
			+ '<mtime>' + mtime + '</mtime>'
			+ '<hash>' + md5 + '</hash>'
			+ '</properties>';

		await this.bridge.writeUTF8(this._getItemPropPath(item), xmlstr);
	},


	// -- Download -----------------------------------------------------------------

	/**
	 * @param {Zotero.Sync.Storage.Request} request
	 * @return {Promise<Zotero.Sync.Storage.Result>}
	 */
	downloadFile: async function (request) {
		await this._init();

		var item = Zotero.Sync.Storage.Utilities.getItemFromRequest(request);
		if (!item) {
			throw new Error("Item '" + request.name + "' not found");
		}

		var path = item.getFilePath();
		if (!path) {
			Zotero.debug(`Cannot download file for attachment ${item.libraryKey} with no path`);
			return new Zotero.Sync.Storage.Result;
		}

		var metadata = await this._getStorageFileMetadata(item);

		if (!request.isRunning()) {
			Zotero.debug("Download request '" + request.name
				+ "' is no longer running after getting metadata");
			return new Zotero.Sync.Storage.Result;
		}

		// No remote file
		if (!metadata) {
			Zotero.debug("Remote file not found in iCloud for item " + item.libraryKey);
			item.attachmentSyncState = "in_sync";
			await item.saveTx({ skipAll: true });
			return new Zotero.Sync.Storage.Result;
		}

		// Up to date already -- skip download
		var fileModTime = await item.attachmentModificationTime;
		if (metadata.mtime == fileModTime) {
			Zotero.debug("File mod time matches remote file -- skipping download of "
				+ item.libraryKey);

			var updateItem = item.attachmentSyncState != 1;
			item.attachmentSyncedModificationTime = metadata.mtime;
			item.attachmentSyncState = "in_sync";
			await item.saveTx({ skipAll: true });
			if (updateItem) {
				await item.updateSynced(false);
			}

			return new Zotero.Sync.Storage.Result({
				localChanges: true
			});
		}

		var zipPath = this._getItemFilePath(item);
		var destPath = OS.Path.join(Zotero.getTempDirectory().path, item.key + '.tmp');
		await Zotero.File.removeIfExists(destPath);

		// Materialize (if evicted) and copy the zip out of the container into the temp dir,
		// where Local.processDownload() expects to find it as <key>.tmp
		var copied;
		try {
			copied = await this.bridge.copyOut(zipPath, destPath);
		}
		catch (e) {
			Zotero.logError(e);
			throw new Error(Zotero.Sync.Storage.Mode.iCloud.defaultError);
		}

		if (!copied) {
			// .prop exists but zip is missing/never materialized -- treat like WebDAV's 404:
			// drop the orphaned .prop and mark in sync
			let msg = "Remote ZIP file not found in iCloud for item " + item.libraryKey;
			Zotero.debug(msg, 2);
			Cu.reportError(msg);
			await this.bridge.remove(this._getItemPropPath(item)).catch(e => Zotero.logError(e));
			item.attachmentSyncState = "in_sync";
			await item.saveTx({ skipAll: true });
			return new Zotero.Sync.Storage.Result;
		}

		if (request.isFinished()) {
			Zotero.debug("Download request " + request.name
				+ " is no longer running after file copy");
			return new Zotero.Sync.Storage.Result;
		}

		Zotero.debug("Finished iCloud download of " + destPath);

		return Zotero.Sync.Storage.Local.processDownload({
			item,
			mtime: metadata.mtime,
			md5: metadata.md5,
			compressed: true
		});
	},


	// -- Upload -------------------------------------------------------------------

	uploadFile: async function (request) {
		await this._init();

		var item = Zotero.Sync.Storage.Utilities.getItemFromRequest(request);
		var params = {
			mtime: await item.attachmentModificationTime,
			md5: await item.attachmentHash
		};

		var metadata = await this._getStorageFileMetadata(item);

		if (!request.isRunning()) {
			Zotero.debug("Upload request '" + request.name
				+ "' is no longer running after getting metadata");
			return new Zotero.Sync.Storage.Result;
		}

		// This block mirrors WebDAV.uploadFile()'s already-uploaded / conflict handling so
		// that switching backends doesn't change conflict semantics.
		if (item.attachmentSyncState != Zotero.Sync.Storage.Local.SYNC_STATE_FORCE_UPLOAD) {
			if (metadata && metadata.mtime) {
				let fmtime = await item.attachmentModificationTime;
				let mtime = metadata.mtime;

				var changed = Zotero.Sync.Storage.Local.checkFileModTime(item, fmtime, mtime);
				if (!changed) {
					let hash = metadata.md5;
					if (hash) {
						let fhash = await item.attachmentHash;
						if (fhash != hash) {
							changed = true;
						}
					}

					// Remote already has this file -- just update synced properties
					if (!changed) {
						item.attachmentSyncedModificationTime = fmtime;
						if (hash) {
							item.attachmentSyncedHash = hash;
						}
						item.attachmentSyncState = "in_sync";
						await item.saveTx({ skipAll: true });
						await item.updateSynced(false);
						return new Zotero.Sync.Storage.Result({
							localChanges: true,
							syncRequired: true
						});
					}
				}

				// Conflict between our synced values and what's in the container
				let smtime = item.attachmentSyncedModificationTime;
				if (smtime != mtime) {
					let shash = item.attachmentSyncedHash;
					if (shash && metadata.md5 && shash == metadata.md5) {
						Zotero.debug(`Last synced mod time for item ${item.libraryKey} doesn't `
							+ "match time in iCloud but hash does -- using local file mtime");

						await this._setStorageFileMetadata(item);
						item.attachmentSyncedModificationTime = fmtime;
						item.attachmentSyncState = "in_sync";
						await item.saveTx({ skipAll: true });
						await item.updateSynced(false);

						return new Zotero.Sync.Storage.Result({
							localChanges: true,
							syncRequired: true
						});
					}

					Zotero.logError("Conflict -- last synced file mod time for item "
						+ item.libraryKey + " does not match time in iCloud"
						+ " (" + smtime + " != " + mtime + ")");

					item.attachmentSyncedModificationTime = mtime;
					item.attachmentSyncState = "in_conflict";
					await item.saveTx({ skipAll: true });

					return new Zotero.Sync.Storage.Result({
						fileSyncRequired: true
					});
				}
			}
			else {
				Zotero.debug("Remote file not found in iCloud for item " + item.id);
			}
		}

		var created = await Zotero.Sync.Storage.Utilities.createUploadFile(request);
		if (!created) {
			return new Zotero.Sync.Storage.Result;
		}

		if (!request.isRunning()) {
			Zotero.debug("Upload request '" + request.name
				+ "' is no longer running after creating ZIP");
			return new Zotero.Sync.Storage.Result;
		}

		// Remove a stale .prop before writing the new zip so a crash mid-upload can't leave
		// a .prop pointing at an old zip
		if (metadata) {
			await this.bridge.remove(this._getItemPropPath(item)).catch(e => Zotero.logError(e));
		}

		var tempZip = OS.Path.join(Zotero.getTempDirectory().path, item.key + '.zip');
		try {
			await this.bridge.copyIn(tempZip, this._getItemFilePath(item));
		}
		catch (e) {
			Zotero.logError(e);
			throw new Error(Zotero.Sync.Storage.Mode.iCloud.defaultError);
		}

		return this._onUploadComplete(request, item, params);
	},


	_onUploadComplete: async function (request, item, params) {
		Zotero.debug("iCloud upload of attachment " + item.key + " finished");

		// Write the .prop sidecar after the zip is in place
		await this._setStorageFileMetadata(item);

		item.attachmentSyncedModificationTime = params.mtime;
		item.attachmentSyncedHash = params.md5;
		item.attachmentSyncState = "in_sync";
		await item.saveTx({ skipAll: true });
		await item.updateSynced(false);

		try {
			await OS.File.remove(
				OS.Path.join(Zotero.getTempDirectory().path, item.key + '.zip')
			);
		}
		catch (e) {
			Zotero.logError(e);
		}

		return new Zotero.Sync.Storage.Result({
			localChanges: true,
			remoteChanges: true,
			syncRequired: true
		});
	},


	// -- Verification -------------------------------------------------------------

	/**
	 * Verify that iCloud Drive is usable: supported platform, account available, and the
	 * storage directory is writable (write/read/delete a probe file).
	 *
	 * @throws {Zotero.Sync.Storage.Mode.iCloud.VerificationError|Error}
	 */
	checkServer: async function (options = {}) {
		if (!this.bridge.available) {
			throw new this.VerificationError("UNSUPPORTED_PLATFORM");
		}
		if (!(await this.bridge.isAccountAvailable())) {
			throw new this.VerificationError("NO_ACCOUNT");
		}

		await this._init();

		// Read/write probe
		var probePath = PathUtils.join(this.storageDir, '.zotero-icloud-probe');
		var token = Zotero.Utilities.randomString(24);
		try {
			await this.bridge.writeUTF8(probePath, token);
			let readBack = await this.bridge.readUTF8(probePath);
			if (readBack != token) {
				throw new this.VerificationError("PROBE_MISMATCH");
			}
		}
		catch (e) {
			if (e instanceof this.VerificationError) {
				throw e;
			}
			Zotero.logError(e);
			throw new this.VerificationError("NOT_WRITABLE");
		}
		finally {
			await this.bridge.remove(probePath).catch(() => {});
		}

		if (options.onRequest) {
			options.onRequest();
		}

		this.verified = true;
		Zotero.debug(this.name + " file sync is successfully set up");
		return true;
	},


	/**
	 * Map a verification error to a user dialog. Returns true on (eventual) success.
	 */
	handleVerificationError: async function (err, window, skipSuccessMessage) {
		var promptService = Services.prompt;
		var errorTitle = this.name;
		var errorMsg;

		if (err instanceof this.VerificationError) {
			switch (err.error) {
				case "UNSUPPORTED_PLATFORM":
					errorMsg = Zotero.getString('sync.storage.error.icloud.unsupportedPlatform');
					break;
				case "NO_ACCOUNT":
					errorMsg = Zotero.getString('sync.storage.error.icloud.noAccount');
					break;
				case "NOT_WRITABLE":
				case "PROBE_MISMATCH":
					errorMsg = Zotero.getString('sync.storage.error.icloud.notWritable');
					break;
				default:
					errorMsg = Zotero.getString('sync.storage.error.icloud.default');
			}
		}
		else {
			errorMsg = (err && err.message)
				? err.message
				: Zotero.getString('sync.storage.error.icloud.default');
		}

		Zotero.logError(err);

		if (!window) {
			return false;
		}

		promptService.alert(window, errorTitle, errorMsg);
		return false;
	},


	// -- Maintenance --------------------------------------------------------------

	/**
	 * Delete container files for items deleted locally, then trim the delete log.
	 * Mirrors WebDAV.purgeDeletedStorageFiles().
	 */
	purgeDeletedStorageFiles: async function (libraryID) {
		await this._init();

		Zotero.debug("Purging deleted iCloud storage files");
		var keys = await Zotero.Sync.Storage.Local.getDeletedFiles(libraryID);
		if (!keys.length) {
			Zotero.debug("No files to delete remotely");
			return false;
		}

		var purged = [];
		for (let key of keys) {
			try {
				await this.bridge.remove(PathUtils.join(this.storageDir, key + '.zip'));
				await this.bridge.remove(PathUtils.join(this.storageDir, key + '.prop'));
				purged.push(key);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}

		if (purged.length) {
			await Zotero.Utilities.Internal.forEachChunkAsync(
				purged,
				Zotero.DB.MAX_BOUND_PARAMETERS - 1,
				function (chunk) {
					return Zotero.DB.executeTransaction(async function () {
						var sql = "DELETE FROM storageDeleteLog WHERE libraryID=? AND key IN ("
							+ chunk.map(() => '?').join() + ")";
						return Zotero.DB.queryAsync(sql, [libraryID].concat(chunk));
					});
				}
			);
		}

		Zotero.debug(`Purged ${purged.length} deleted iCloud storage files`);
		return { purged };
	},


	/**
	 * Remove container files that have no corresponding local attachment item.
	 * Mirrors WebDAV.purgeOrphanedStorageFiles(); throttled to once a week.
	 */
	purgeOrphanedStorageFiles: async function () {
		await this._init();

		const daysBetweenPurges = 7;
		var lastPurge = Zotero.Prefs.get('lastiCloudOrphanPurge');
		if (lastPurge) {
			try {
				let purgeAfter = lastPurge + (daysBetweenPurges * 24 * 60 * 60);
				if (new Date() < new Date(purgeAfter * 1000)) {
					return false;
				}
			}
			catch (e) {
				Zotero.Prefs.clear('lastiCloudOrphanPurge');
			}
		}

		Zotero.debug("Purging orphaned iCloud storage files");

		const libraryID = Zotero.Libraries.userLibraryID;
		var entries = await this.bridge.listStorageDirectory();
		var deleted = 0;
		for (let name of entries) {
			let match = name.match(/^([A-Z0-9]{8})\.(zip|prop)$/);
			if (!match) {
				continue;
			}
			let key = match[1];
			// Keep files that correspond to a current attachment
			if (Zotero.Items.getByLibraryAndKey(libraryID, key)) {
				continue;
			}
			try {
				await this.bridge.remove(PathUtils.join(this.storageDir, name));
				deleted++;
			}
			catch (e) {
				Zotero.logError(e);
			}
		}

		Zotero.Prefs.set('lastiCloudOrphanPurge', Math.round(Date.now() / 1000));
		Zotero.debug(`Purged ${deleted} orphaned iCloud storage files`);
		return { deleted };
	}
};
