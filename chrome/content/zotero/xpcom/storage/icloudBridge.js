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
 * Platform bridge for the iCloud Drive storage backend.
 *
 * iCloud Drive is fundamentally different from WebDAV/ZFS: there is no HTTP API.
 * Files live inside a local "ubiquitous container" that macOS/iOS replicate out of
 * band. This bridge abstracts the filesystem operations the controller needs and
 * isolates the (macOS-only) iCloud specifics -- placeholder materialization and
 * coordinated I/O -- so that storage/icloud.js stays platform-agnostic and testable.
 *
 * Two layers:
 *
 *   1. A portable filesystem layer built on IOUtils/PathUtils. This makes the bridge
 *      fully functional against any directory (the "plain folder" model), which is what
 *      runs today and what the unit tests exercise with a mock container.
 *
 *   2. Hooks for the native iCloud APIs (NSFileManager / NSFileCoordinator) that must
 *      be wired through js-ctypes (or a small bundled Obj-C helper) to (a) trigger
 *      download of evicted placeholders and (b) perform coordinated reads/writes so we
 *      never observe a half-synced file. These are the `_native*` methods below; until
 *      they are implemented they return `null`/`false` and the bridge degrades to the
 *      portable layer. They are the only remaining platform-specific work.
 *
 * @namespace
 */
Zotero.Sync.Storage.iCloudBridge = {
	// iCloud evicts file contents to save disk and leaves a hidden ".<name>.icloud"
	// placeholder sibling. We detect that to know whether a file needs materializing.
	PLACEHOLDER_PREFIX: ".",
	PLACEHOLDER_SUFFIX: ".icloud",

	// How long to wait for an evicted file to materialize before giving up
	MATERIALIZE_TIMEOUT_MS: 120000,
	MATERIALIZE_POLL_MS: 500,

	/**
	 * Whether iCloud Drive storage is usable on this platform.
	 *
	 * Phase 1 ships macOS only. A user-configured container path is honored on any
	 * platform (e.g. the iCloud for Windows "iCloudDrive" folder) for testing, but the
	 * native materialization layer only exists on macOS.
	 *
	 * @return {Boolean}
	 */
	get available() {
		return Zotero.isMac || !!Zotero.Prefs.get('sync.storage.icloud.containerPath');
	},

	/**
	 * Absolute path to the Zotero storage directory inside the iCloud container.
	 *
	 * Resolution order:
	 *   1. Explicit `sync.storage.icloud.containerPath` pref (advanced / non-mac)
	 *   2. The app's default ubiquitous container under
	 *      ~/Library/Mobile Documents/<container-id>/Documents
	 *
	 * The trailing "storage" subdirectory keeps Zotero files namespaced within the
	 * container so the container can be shared with other Zotero data if desired.
	 *
	 * @return {String}
	 * @throws {Error} if no container can be resolved
	 */
	getStorageDirectory: function () {
		var base = Zotero.Prefs.get('sync.storage.icloud.containerPath');
		if (!base) {
			base = this._getDefaultContainerPath();
		}
		if (!base) {
			throw new Error("iCloud container path could not be resolved");
		}
		return PathUtils.join(base, 'storage');
	},

	/**
	 * Best-effort default container path on macOS.
	 *
	 * The real container id is "<TeamID>~<reverse-bundle-id>" and on a packaged build
	 * should be obtained from the native layer (`_nativeContainerURL`). We try that
	 * first and fall back to the conventional location so a dev build still works.
	 *
	 * @return {String|false}
	 */
	_getDefaultContainerPath: function () {
		let native = this._nativeContainerURL();
		if (native) {
			return native;
		}
		if (!Zotero.isMac) {
			return false;
		}
		// Conventional location; the leaf container id is build-specific and should be
		// replaced by the native lookup above in a packaged build.
		let home = Services.dirsvc.get("Home", Components.interfaces.nsIFile).path;
		return PathUtils.join(
			home,
			'Library', 'Mobile Documents', 'iCloud~org~zotero~zotero', 'Documents'
		);
	},

	/**
	 * Ensure the storage directory exists.
	 *
	 * @return {Promise}
	 */
	ensureStorageDirectory: async function () {
		var dir = this.getStorageDirectory();
		await IOUtils.makeDirectory(dir, { createAncestors: true, ignoreExisting: true });
		return dir;
	},

	/**
	 * @param {String} path
	 * @return {Promise<Boolean>}
	 */
	exists: async function (path) {
		return IOUtils.exists(path);
	},

	/**
	 * Whether the file's contents are present locally (not an evicted placeholder).
	 *
	 * @param {String} path
	 * @return {Promise<Boolean>}
	 */
	isMaterialized: async function (path) {
		if (await IOUtils.exists(path)) {
			return true;
		}
		// If only the placeholder exists, the file is evicted but does exist remotely
		return false;
	},

	/**
	 * Whether a file exists either materialized or as an evicted placeholder.
	 *
	 * @param {String} path
	 * @return {Promise<Boolean>}
	 */
	existsOrPlaceholder: async function (path) {
		if (await IOUtils.exists(path)) {
			return true;
		}
		return IOUtils.exists(this._placeholderPath(path));
	},

	/**
	 * Trigger download of an evicted file and wait until its contents are local.
	 *
	 * @param {String} path
	 * @param {Integer} [timeout]
	 * @return {Promise<Boolean>} - true if materialized, false if it never appeared
	 */
	materialize: async function (path, timeout = this.MATERIALIZE_TIMEOUT_MS) {
		if (await IOUtils.exists(path)) {
			return true;
		}
		// Ask iCloud to start downloading the evicted item (macOS native)
		this._nativeStartDownloading(path);

		var waited = 0;
		while (waited < timeout) {
			if (await IOUtils.exists(path)) {
				return true;
			}
			await Zotero.Promise.delay(this.MATERIALIZE_POLL_MS);
			waited += this.MATERIALIZE_POLL_MS;
		}
		Zotero.logError(`iCloud item did not materialize within ${timeout}ms: ${path}`);
		return false;
	},

	/**
	 * Read a (materialized) file as text, materializing first if needed.
	 *
	 * @param {String} path
	 * @return {Promise<String|false>} - file contents, or false if not present
	 */
	readUTF8: async function (path) {
		if (!(await this.existsOrPlaceholder(path))) {
			return false;
		}
		if (!(await this.materialize(path))) {
			return false;
		}
		return this._nativeCoordinatedReadUTF8(path)
			?? IOUtils.readUTF8(path);
	},

	/**
	 * Copy a (materialized) file out of the container to a local destination.
	 *
	 * @param {String} srcPath - path inside the container
	 * @param {String} destPath - local destination (e.g. temp dir)
	 * @return {Promise<Boolean>}
	 */
	copyOut: async function (srcPath, destPath) {
		if (!(await this.existsOrPlaceholder(srcPath))) {
			return false;
		}
		if (!(await this.materialize(srcPath))) {
			return false;
		}
		await IOUtils.copy(srcPath, destPath);
		return true;
	},

	/**
	 * Atomically write text into the container using coordinated I/O when available.
	 *
	 * @param {String} path
	 * @param {String} text
	 * @return {Promise}
	 */
	writeUTF8: async function (path, text) {
		await IOUtils.makeDirectory(PathUtils.parent(path),
			{ createAncestors: true, ignoreExisting: true });
		if (this._nativeCoordinatedWriteUTF8(path, text)) {
			return;
		}
		// Atomic write via temp file + rename so iCloud never replicates a partial file
		await IOUtils.writeUTF8(path, text, { tmpPath: path + '.tmp' });
	},

	/**
	 * Atomically copy a local file into the container.
	 *
	 * @param {String} srcPath - local source
	 * @param {String} destPath - path inside the container
	 * @return {Promise}
	 */
	copyIn: async function (srcPath, destPath) {
		await IOUtils.makeDirectory(PathUtils.parent(destPath),
			{ createAncestors: true, ignoreExisting: true });
		// Copy to a temp name in the same dir, then move into place atomically
		var tmp = destPath + '.uploadtmp';
		await IOUtils.copy(srcPath, tmp);
		await IOUtils.move(tmp, destPath);
	},

	/**
	 * Remove a file (and any placeholder sibling) from the container.
	 *
	 * @param {String} path
	 * @return {Promise<Boolean>} - true if something was removed
	 */
	remove: async function (path) {
		var removed = false;
		if (await IOUtils.exists(path)) {
			await IOUtils.remove(path, { ignoreAbsent: true });
			removed = true;
		}
		let placeholder = this._placeholderPath(path);
		if (await IOUtils.exists(placeholder)) {
			await IOUtils.remove(placeholder, { ignoreAbsent: true });
			removed = true;
		}
		return removed;
	},

	/**
	 * List entries in the storage directory. Returns base names (with extensions),
	 * with any ".icloud" placeholder names normalized back to the real name.
	 *
	 * @return {Promise<String[]>}
	 */
	listStorageDirectory: async function () {
		var dir = this.getStorageDirectory();
		if (!(await IOUtils.exists(dir))) {
			return [];
		}
		var children = await IOUtils.getChildren(dir);
		return children.map(p => this._normalizePlaceholderName(PathUtils.filename(p)));
	},

	/**
	 * Last-modified time (ms) of a container file, materializing metadata if needed.
	 * Placeholder stats are sufficient (mtime is preserved on the placeholder).
	 *
	 * @param {String} path
	 * @return {Promise<Number|false>}
	 */
	getLastModified: async function (path) {
		let target = path;
		if (!(await IOUtils.exists(path))) {
			let placeholder = this._placeholderPath(path);
			if (!(await IOUtils.exists(placeholder))) {
				return false;
			}
			target = placeholder;
		}
		let info = await IOUtils.stat(target);
		return info.lastModified;
	},


	// -- Placeholder name helpers -------------------------------------------------

	_placeholderPath: function (path) {
		let dir = PathUtils.parent(path);
		let name = PathUtils.filename(path);
		return PathUtils.join(dir, this.PLACEHOLDER_PREFIX + name + this.PLACEHOLDER_SUFFIX);
	},

	_normalizePlaceholderName: function (name) {
		if (name.startsWith(this.PLACEHOLDER_PREFIX) && name.endsWith(this.PLACEHOLDER_SUFFIX)) {
			return name.slice(
				this.PLACEHOLDER_PREFIX.length,
				name.length - this.PLACEHOLDER_SUFFIX.length
			);
		}
		return name;
	},


	// -- Native iCloud layer (macOS) ---------------------------------------------
	//
	// These wrap NSFileManager / NSFileCoordinator via js-ctypes (or a bundled Obj-C
	// helper). They are intentionally stubbed to return null/false so the bridge runs
	// on the portable layer until the native layer lands. Implementing them is the
	// remaining platform-specific task (see Phase 1 in the plan):
	//
	//   _nativeContainerURL()      -> -[NSFileManager URLForUbiquityContainerIdentifier:]
	//   _nativeStartDownloading()  -> -[NSFileManager startDownloadingUbiquitousItemAtURL:error:]
	//   _nativeEvict()             -> -[NSFileManager evictUbiquitousItemAtURL:error:]
	//   _nativeCoordinatedRead()   -> NSFileCoordinator coordinateReadingItemAtURL:
	//   _nativeCoordinatedWrite()  -> NSFileCoordinator coordinateWritingItemAtURL:
	//
	// Returning a falsy value means "not implemented -- use the portable fallback".

	_nativeContainerURL: function () {
		return null;
	},

	_nativeStartDownloading: function (_path) {
		return false;
	},

	/**
	 * Evict a materialized file's contents to reclaim local disk (optional).
	 * @return {Boolean}
	 */
	evict: function (_path) {
		return this._nativeEvict(_path);
	},

	_nativeEvict: function (_path) {
		return false;
	},

	_nativeCoordinatedReadUTF8: function (_path) {
		return null;
	},

	_nativeCoordinatedWriteUTF8: function (_path, _text) {
		return false;
	},

	/**
	 * Whether the user is signed into iCloud and the container is reachable.
	 * Without the native layer we approximate by checking the container directory.
	 *
	 * @return {Promise<Boolean>}
	 */
	isAccountAvailable: async function () {
		if (!this.available) {
			return false;
		}
		try {
			let base = Zotero.Prefs.get('sync.storage.icloud.containerPath')
				|| this._getDefaultContainerPath();
			if (!base) {
				return false;
			}
			return IOUtils.exists(base);
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
	}
};
