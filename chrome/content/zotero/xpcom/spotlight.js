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
 * macOS Spotlight integration: indexes library items into the system Core Spotlight
 * index via an in-process bridge dylib, so they're findable from ⌘-Space when Zotero is closed.
 * @namespace Zotero.Spotlight
 */
Zotero.Spotlight = new function () {
	const INDEX_SCHEMA_VERSION = 1;

	const DEBOUNCE_MS = 2000;

	// records per index() call, so a rebuild can yield between chunks
	const INDEX_CHUNK = 100;

	const MAX_CONTENT_CHARS = 50000;

	const FULLTEXT_RESERVE_CHARS = 20000;

	const PREF = 'spotlight.';

	var _available = false;
	var _enabled = false;
	var _appBundleID = null;

	// Only the "owner" install indexes at a time (see Ownership internals).
	var _dataDir = null;
	var _isOwner = false;

	var _notifierID = null;
	var _prefObserverIDs = [];

	var _pendingIndex = new Set(); // item ids to (re)index
	var _pendingRemove = new Set(); // zotero paths to remove

	var _reindexing = false;
	var _rebuildQueued = false;

	// configurable so tests can stub it
	Object.defineProperty(this, 'available', { get: () => _available, configurable: true });

	this.indexingAvailable = function () {
		return SpotlightBridge.indexingAvailable();
	};

	this.init = async function () {
		if (!Zotero.isMac) {
			return;
		}
		let darwin = parseInt(Services.sysinfo.getProperty("version"));
		let supported = !darwin || darwin >= 20; // macOS 11+
		if (!supported) {
			Zotero.debug("Spotlight: macOS < 11; integration disabled");
			return;
		}
		_available = await SpotlightBridge.load();
		if (!_available) {
			Zotero.debug("Spotlight: bridge dylib unavailable; integration disabled");
			return;
		}

		_dataDir = Zotero.DataDirectory.dir;
		_appBundleID = SpotlightBridge.bundleID();
		Zotero.debug(`Spotlight: bridge loaded (bundle=${_appBundleID}, `
			+ `indexingAvailable=${this.indexingAvailable()})`);

		_registerPrefObservers();

		_enabled = !!Zotero.Prefs.get(PREF + 'enabled');
		if (!_enabled) {
			return;
		}

		try {
			_isOwner = await SpotlightOwner.claim();
			if (_isOwner) {
				await this.start();
			}
			else {
				Zotero.debug("Spotlight: another install/profile owns the index; not indexing");
				await _cleanUpAsNonOwner();
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
	};

	this.start = async function () {
		if (!_available || !_isOwner) {
			return;
		}
		_registerNotifier();
		this.reconcile().catch(e => Zotero.logError(e));
	};

	this.stop = function () {
		_unregisterNotifier();
		_pendingIndex.clear();
		_pendingRemove.clear();
	};

	this.uninit = function () {
		this.stop();
		_unregisterPrefObservers();
	};

	function _yield() {
		return new Promise(resolve => setTimeout(resolve, 0));
	}

	this.rebuild = async function () {
		if (!_available) {
			return;
		}
		if (_reindexing) {
			_rebuildQueued = true;
			return;
		}
		_reindexing = true;
		try {
			SpotlightBridge.reset();
			for (let library of Zotero.Libraries.getAll()) {
				if (!SpotlightLibraries.indexable(library)) {
					continue;
				}
				let items = await Zotero.Items.getAll(library.libraryID, true, false, false);
				let chunk = [];
				for (let item of items) {
					let record = await SpotlightRecord.build(item, library);
					if (!record) {
						continue;
					}
					chunk.push(record);
					if (chunk.length >= INDEX_CHUNK) {
						SpotlightBridge.index(chunk);
						chunk = [];
						await _yield();
					}
				}
				if (chunk.length) {
					SpotlightBridge.index(chunk);
					await _yield();
				}
			}

			let signature = SpotlightLibraries.signature();
			Zotero.Prefs.set(PREF + 'indexSchemaVersion', INDEX_SCHEMA_VERSION);
			Zotero.Prefs.set(PREF + 'lastSignature', signature);
			SpotlightBridge.setClientState(INDEX_SCHEMA_VERSION + ':' + signature);
			await _yield();
			let err = SpotlightBridge.lastError();
			Zotero.debug(`Spotlight: rebuild complete (indexingAvailable=`
				+ `${this.indexingAvailable()}${err ? `, lastError=${err}` : ''})`);
		}
		finally {
			_reindexing = false;
			if (_rebuildQueued) {
				_rebuildQueued = false;
				this.rebuild().catch(e => Zotero.logError(e));
			}
		}
	};

	this.reconcile = async function () {
		if (!_enabled || !_available || !_isOwner || _reindexing) {
			return;
		}
		let signature = SpotlightLibraries.signature();
		let schema = Zotero.Prefs.get(PREF + 'indexSchemaVersion');
		let lastSig = Zotero.Prefs.get(PREF + 'lastSignature');
		let indexed = SpotlightBridge.clientState() === INDEX_SCHEMA_VERSION + ':' + signature;
		if (schema === INDEX_SCHEMA_VERSION && lastSig === signature && indexed) {
			Zotero.debug("Spotlight: index up to date; skipping reconcile");
			return;
		}
		await this.rebuild();
	};

	this.needsReindex = function () {
		if (!_enabled || !_available || !_isOwner) {
			return false;
		}
		return Zotero.Prefs.get(PREF + 'indexSchemaVersion') !== INDEX_SCHEMA_VERSION
			|| Zotero.Prefs.get(PREF + 'lastSignature') !== SpotlightLibraries.signature();
	};

	this.clearIndex = async function () {
		if (!_available) {
			return;
		}
		SpotlightBridge.reset();
		SpotlightBridge.setClientState('');
		Zotero.Prefs.clear(PREF + 'lastSignature');
	};

	/**
	 * Query the index and return the matching zotero paths (e.g. "library/items/KEY").
	 * For tests only.
	 *
	 * @param {String} query - Core Spotlight query, e.g. `title == "*x*"c`.
	 * @return {String[]}
	 */
	this.search = function (query) {
		let ids;
		try {
			ids = JSON.parse(SpotlightBridge.query(query));
		}
		catch (e) {
			Zotero.logError(e);
			return [];
		}
		if (!Array.isArray(ids)) {
			return [];
		}
		// The dylib keys items as "<bundleid>:<path>"; strip back to the path
		let prefix = (_appBundleID || '') + ':';
		return ids.map(function (id) {
			return (typeof id === 'string' && id.startsWith(prefix))
				? id.slice(prefix.length)
				: id;
		});
	};

	this.notify = async function (event, type, ids, extraData) {
		if (!_enabled || !_isOwner) {
			return;
		}
		if (type === 'group') {
			if (event === 'add') {
				_scheduleRebuild();
			}
			else if (event === 'delete') {
				SpotlightBridge.removeLibraries(ids.map(id => 'groups.' + id));
			}
			return;
		}
		if (type !== 'item') {
			return;
		}
		if (event === 'add' || event === 'modify') {
			for (let id of ids) {
				_pendingIndex.add(id);
			}
		}
		else if (event === 'trash') {
			for (let id of ids) {
				let item = Zotero.Items.get(id);
				let path = item && SpotlightLibraries.itemPath(item.libraryID, item.key);
				if (path) {
					_pendingRemove.add(path);
				}
				_pendingIndex.delete(id);
			}
		}
		else if (event === 'delete') {
			for (let id of ids) {
				let data = extraData && extraData[id];
				if (data && data.key) {
					let path = SpotlightLibraries.itemPath(data.libraryID, data.key);
					if (path) {
						_pendingRemove.add(path);
					}
				}
				_pendingIndex.delete(id);
			}
		}
		else {
			return;
		}
		_flush();
	};

	function _registerNotifier() {
		if (_notifierID) {
			return;
		}
		_notifierID = Zotero.Notifier.registerObserver(
			Zotero.Spotlight,
			['item', 'group'],
			'spotlight'
		);
	}

	function _unregisterNotifier() {
		if (_notifierID) {
			Zotero.Notifier.unregisterObserver(_notifierID);
			_notifierID = null;
		}
	}

	let _scheduleRebuild = Zotero.Utilities.debounce(
		() => Zotero.Spotlight.rebuild().catch(e => Zotero.logError(e)), DEBOUNCE_MS);

	let _flush = Zotero.Utilities.debounce(async function () {
		if (!_enabled || !_available || !_isOwner || _reindexing) {
			return;
		}
		try {
			let indexIDs = [..._pendingIndex];
			_pendingIndex.clear();
			let removePaths = new Set(_pendingRemove);
			_pendingRemove.clear();

			let records = [];
			for (let id of indexIDs) {
				let item = Zotero.Items.get(id);
				if (!item) {
					continue;
				}
				let library = Zotero.Libraries.get(item.libraryID);
				let record = (library && !item.deleted) ? await SpotlightRecord.build(item, library) : null;
				if (record) {
					records.push(record);
				}
				else {
					let path = SpotlightLibraries.itemPath(item.libraryID, item.key);
					if (path) {
						removePaths.add(path);
					}
				}
			}

			if (removePaths.size) {
				SpotlightBridge.remove([...removePaths]);
			}
			for (let i = 0; i < records.length; i += INDEX_CHUNK) {
				SpotlightBridge.index(records.slice(i, i + INDEX_CHUNK));
				await _yield();
			}

			// Keep the signature current so startup doesn't force a needless rebuild
			Zotero.Prefs.set(PREF + 'lastSignature', SpotlightLibraries.signature());
		}
		catch (e) {
			Zotero.logError(e);
		}
	}, DEBOUNCE_MS);

	function _registerPrefObservers() {
		// Only 'enabled' acts immediately; content prefs apply on the next rebuild.
		_prefObserverIDs.push(
			Zotero.Prefs.registerObserver(PREF + 'enabled', _onEnabledChanged)
		);
	}

	function _unregisterPrefObservers() {
		for (let id of _prefObserverIDs) {
			Zotero.Prefs.unregisterObserver(id);
		}
		_prefObserverIDs = [];
	}

	async function _onEnabledChanged() {
		let enabled = !!Zotero.Prefs.get(PREF + 'enabled');
		if (enabled === _enabled) {
			return;
		}
		_enabled = enabled;
		if (enabled) {
			_isOwner = await SpotlightOwner.claim();
			if (_isOwner) {
				await Zotero.Spotlight.start();
			}
			else {
				await _cleanUpAsNonOwner();
			}
		}
		else {
			Zotero.Spotlight.stop();
			// Only touch the shared index/ownership if we owned it, so a secondary
			// install turning off the feature can't wipe the owner's index.
			if (_isOwner) {
				await Zotero.Spotlight.clearIndex();
				await SpotlightOwner.release();
				_isOwner = false;
			}
		}
	}

	this.getForeignOwner = async function () {
		return _available ? SpotlightOwner.foreign() : null;
	};

	this.takeOwnership = async function () {
		if (!_available) {
			return;
		}
		await SpotlightOwner.write();
		_isOwner = true;
		SpotlightBridge.reset();
		Zotero.Prefs.clear(PREF + 'lastSignature');
		if (!_enabled) {
			// Triggers _onEnabledChanged, which will see _isOwner and start()
			Zotero.Prefs.set(PREF + 'enabled', true);
		}
		else {
			_registerNotifier();
			await this.rebuild();
		}
	};

	/**
	 * Enabled but another install owns the index: clear our leftovers only if it's
	 * a different channel; same-channel installs share the owner's domain.
	 */
	async function _cleanUpAsNonOwner() {
		let owner = await SpotlightOwner.read();
		if (owner && owner.bundleID !== _appBundleID) {
			SpotlightBridge.reset();
			Zotero.Prefs.clear(PREF + 'lastSignature');
		}
	}

	const SpotlightRecord = {

		/**
		 * The record to index for an item, or null if it shouldn't be indexed.
		 */
		async build(item, library) {
			if (!item || !item.isRegularItem() || item.deleted) {
				return null;
			}
			if (!SpotlightLibraries.indexable(library)) {
				return null;
			}
			let path = SpotlightLibraries.itemPath(library.libraryID, item.key);
			if (!path) {
				return null;
			}

			// Load everything we read below (item data, creators, tags, notes)
			await item.loadAllData();

			let titleTemplate = Zotero.Prefs.get(PREF + 'titleTemplate') || '{{ title }}';
			let descTemplate = Zotero.Prefs.get(PREF + 'descriptionTemplate')
				|| '{{ firstCreator }}{{ year prefix=" (" suffix=")" }}';

			let title = this._template(titleTemplate, item)
				|| item.getDisplayTitle()
				|| item.key;
			let description = this._template(descTemplate, item);

			let record = {
				path,
				title,
				library: SpotlightLibraries.domain(library),
				keywords: this._keywords(item, library)
			};
			if (description) {
				record.description = description;
			}
			let yearMatch = String(item.getField('date', true) || '').match(/\d{4}/);
			if (yearMatch) {
				record.date = yearMatch[0];
			}
			let content = await this._content(item);
			if (content) {
				record.content = content;
			}
			return record;
		},

		/**
		 * Searchable but hidden content for an item: fields, attachment names,
		 * notes, and full text, capped at MAX_CONTENT_CHARS.
		 */
		async _content(item) {
			let parts = [];
			let length = 0;
			let cap = MAX_CONTENT_CHARS;
			// Append as much of `text` as the current cap allows.
			let add = function (text) {
				let remaining = cap - length;
				if (!text || remaining <= 0) {
					return;
				}
				text = String(text);
				if (text.length > remaining) {
					text = text.slice(0, remaining);
				}
				parts.push(text);
				length += text.length + 1;
			};

			let includeFullText = !!Zotero.Prefs.get(PREF + 'indexFullText');

			// Load child attachments once; reused for names and (later) full text.
			let attachments = [];
			for (let id of item.getAttachments()) {
				let attachment = await Zotero.Items.getAsync(id);
				if (!attachment) {
					continue;
				}
				await attachment.loadAllData();
				attachments.push(attachment);
			}

			// Hold back budget for full text so fields/notes can't consume it all.
			if (includeFullText) {
				cap = MAX_CONTENT_CHARS - FULLTEXT_RESERVE_CHARS;
			}

			// Compact, high-value text first: item fields, then attachment names.
			for (let name of item.getUsedFields(true)) {
				add(item.getField(name));
			}
			for (let attachment of attachments) {
				add(attachment.getField('title'));
				add(attachment.attachmentFilename);
			}
			// Then notes (user-written, sometimes long).
			for (let noteID of item.getNotes()) {
				let note = await Zotero.Items.getAsync(noteID);
				if (!note) {
					continue;
				}
				await note.loadAllData();
				add(this._noteText(note));
			}

			// Finally attachment full text, free to use the reserved budget.
			if (includeFullText) {
				cap = MAX_CONTENT_CHARS;
				for (let attachment of attachments) {
					if (length >= cap) {
						break;
					}
					add(await this._attachmentText(attachment));
				}
			}

			return parts.join('\n');
		},

		_noteText(note) {
			let html = note.getNote();
			return html ? Zotero.Utilities.trimInternal(Zotero.Utilities.unescapeHTML(html)) : '';
		},

		async _attachmentText(attachment) {
			try {
				if (!attachment.isFileAttachment()) {
					return '';
				}
				let contentType = attachment.attachmentContentType;
				if (Zotero.FullText.isCachedMIMEType(contentType)) {
					let cacheFile = Zotero.FullText.getItemCacheFile(attachment).path;
					if (await IOUtils.exists(cacheFile)) {
						return await Zotero.File.getContentsAsync(cacheFile);
					}
				}
				else if (Zotero.MIME.isTextType(contentType)) {
					let path = await attachment.getFilePathAsync();
					if (path && await IOUtils.exists(path)) {
						return await Zotero.File.getContentsAsync(path, attachment.attachmentCharset);
					}
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
			return '';
		},

		_keywords(item, library) {
			let keywords = [library.name];
			for (let creator of item.getCreatorsJSON()) {
				let name = creator.name || [creator.firstName, creator.lastName].filter(Boolean).join(' ');
				if (name) {
					keywords.push(name);
				}
			}
			for (let tag of item.getTags()) {
				keywords.push(tag.tag);
			}
			let pub = item.getField('publicationTitle');
			if (pub) {
				keywords.push(pub);
			}
			keywords.push(Zotero.ItemTypes.getLocalizedString(item.itemTypeID));
			return keywords.filter(Boolean);
		},

		// Render a {{ variable }} template using the shared file-renaming variables.
		_template(template, item) {
			try {
				return Zotero.Attachments.getStringFromItemTemplate(item, { formatString: template });
			}
			catch (e) {
				Zotero.logError(e);
				return '';
			}
		}
	};

	const SpotlightLibraries = {
		indexable(library) {
			if (!library) {
				return false;
			}
			if (library.libraryType !== 'user' && library.libraryType !== 'group') {
				return false;
			}
			return !this.excluded().includes(library.libraryID);
		},

		excluded() {
			try {
				let raw = Zotero.Prefs.get(PREF + 'excludedLibraries');
				let arr = raw ? JSON.parse(raw) : [];
				return Array.isArray(arr) ? arr.map(Number) : [];
			}
			catch {
				return [];
			}
		},

		// "library/items/KEY" or "groups/123/items/KEY"
		itemPath(libraryID, key) {
			if (!key) {
				return null;
			}
			let library = Zotero.Libraries.get(libraryID);
			if (!library) {
				return null;
			}
			if (library.libraryType === 'user') {
				return `library/items/${key}`;
			}
			if (library.libraryType === 'group') {
				let groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
				return `groups/${groupID}/items/${key}`;
			}
			return null;
		},

		// "library" or "groups.123", for dropping library's index without a rebuild.
		domain(library) {
			if (library.libraryType === 'user') {
				return 'library';
			}
			if (library.libraryType === 'group') {
				return 'groups.' + Zotero.Groups.getGroupIDFromLibraryID(library.libraryID);
			}
			return null;
		},

		signature() {
			let parts = [];
			for (let library of Zotero.Libraries.getAll()) {
				if (!this.indexable(library)) {
					continue;
				}
				parts.push(library.libraryID + ':' + (library.libraryVersion || 0));
			}
			parts.sort();
			return JSON.stringify({
				libraries: parts,
				title: Zotero.Prefs.get(PREF + 'titleTemplate') || '',
				desc: Zotero.Prefs.get(PREF + 'descriptionTemplate') || '',
				excluded: this.excluded().slice().sort(),
				fullText: !!Zotero.Prefs.get(PREF + 'indexFullText')
			});
		}
	};

	const SpotlightBridge = {
		_ctypes: null,
		_lib: null,
		_fn: null,

		// Load the dylib and declare its entry points; returns whether it loaded.
		async load() {
			try {
				let dylib = PathUtils.join(Zotero.resourcesDir, 'libZoteroSpotlight.dylib');
				if (!await IOUtils.exists(dylib)) {
					return false;
				}
				let c = ChromeUtils.importESModule("resource://gre/modules/ctypes.sys.mjs").ctypes;
				this._ctypes = c;
				this._lib = c.open(dylib);
				this._fn = {
					bundleID: this._lib.declare("zotero_spotlight_bundle_id",
						c.default_abi, c.char.ptr),
					index: this._lib.declare("zotero_spotlight_index",
						c.default_abi, c.int, c.char.ptr),
					remove: this._lib.declare("zotero_spotlight_remove",
						c.default_abi, c.int, c.char.ptr),
					removeLibraries: this._lib.declare("zotero_spotlight_remove_libraries",
						c.default_abi, c.int, c.char.ptr),
					reset: this._lib.declare("zotero_spotlight_reset",
						c.default_abi, c.int),
					indexingAvailable: this._lib.declare("zotero_spotlight_indexing_available",
						c.default_abi, c.int),
					lastError: this._lib.declare("zotero_spotlight_last_error",
						c.default_abi, c.char.ptr),
					query: this._lib.declare("zotero_spotlight_query",
						c.default_abi, c.char.ptr, c.char.ptr),
					setClientState: this._lib.declare("zotero_spotlight_set_client_state",
						c.default_abi, c.int, c.char.ptr),
					getClientState: this._lib.declare("zotero_spotlight_get_client_state",
						c.default_abi, c.char.ptr)
				};
				return true;
			}
			catch (e) {
				Zotero.debug("Spotlight: failed to load bridge dylib: " + e);
				this._lib = null;
				this._fn = null;
				return false;
			}
		},

		_toCharPtr(str) {
			// js-ctypes UTF-8-encodes the string itself.
			return this._ctypes.char.array()(str);
		},

		bundleID() {
			try {
				return this._fn.bundleID().readString();
			}
			catch (e) {
				Zotero.logError(e);
				return null;
			}
		},

		indexingAvailable() {
			try {
				return !!this._fn && this._fn.indexingAvailable() === 1;
			}
			catch {
				return false;
			}
		},

		index(records) {
			if (!this._fn || !records.length) {
				return;
			}
			try {
				this._fn.index(this._toCharPtr(JSON.stringify(records)));
			}
			catch (e) {
				Zotero.logError(e);
			}
		},

		remove(paths) {
			if (!this._fn || !paths.length) {
				return;
			}
			try {
				this._fn.remove(this._toCharPtr(JSON.stringify(paths)));
			}
			catch (e) {
				Zotero.logError(e);
			}
		},

		removeLibraries(tokens) {
			if (!this._fn || !tokens.length) {
				return;
			}
			try {
				this._fn.removeLibraries(this._toCharPtr(JSON.stringify(tokens)));
			}
			catch (e) {
				Zotero.logError(e);
			}
		},

		reset() {
			if (!this._fn) {
				return;
			}
			try {
				this._fn.reset();
			}
			catch (e) {
				Zotero.logError(e);
			}
		},

		lastError() {
			try {
				let ptr = this._fn && this._fn.lastError();
				return ptr && !ptr.isNull() ? ptr.readString() : '';
			}
			catch {
				return '';
			}
		},

		/**
		 * For tests. Raw JSON array of matching unique identifiers (or '[]'); parsed by search().
		 * @param {String} queryString - Core Spotlight query, e.g. `title == "*x*"c`.
		 * @returns {String} JSON array of matching unique identifiers
		 */
		query(queryString) {
			if (!this._fn || !queryString) {
				return '[]';
			}
			try {
				let ptr = this._fn.query(this._toCharPtr(queryString));
				return (ptr && !ptr.isNull()) ? ptr.readString() : '[]';
			}
			catch (e) {
				Zotero.logError(e);
				return '[]';
			}
		},

		setClientState(state) {
			if (!this._fn) {
				return;
			}
			try {
				this._fn.setClientState(this._toCharPtr(String(state)));
			}
			catch (e) {
				Zotero.logError(e);
			}
		},

		clientState() {
			try {
				let ptr = this._fn && this._fn.getClientState();
				return (ptr && !ptr.isNull()) ? ptr.readString() : '';
			}
			catch (e) {
				Zotero.logError(e);
				return '';
			}
		}
	};

	const SpotlightOwner = {
		path() {
			let home = Services.env.get('HOME');
			return home
				? PathUtils.join(home, 'Library', 'Application Support', 'org.zotero.spotlight', 'owner.json')
				: null;
		},

		async read() {
			let path = this.path();
			if (!path) {
				return null;
			}
			try {
				let data = JSON.parse(await IOUtils.readUTF8(path));
				return (data && data.dataDir) ? data : null;
			}
			catch {
				return null;
			}
		},

		async write() {
			let path = this.path();
			if (!path) {
				return;
			}
			await IOUtils.makeDirectory(PathUtils.parent(path), {
				createAncestors: true,
				ignoreExisting: true
			});
			await IOUtils.writeUTF8(path, JSON.stringify({
				dataDir: _dataDir,
				bundleID: _appBundleID
			}));
		},

		isUs(record) {
			return !!record && record.dataDir === _dataDir && record.bundleID === _appBundleID;
		},

		/**
		 * The owner record if a *different* install/profile owns the index, else null
		 */
		async foreign() {
			let record = await this.read();
			return (record && !this.isUs(record)) ? record : null;
		},

		/**
		 * Become the owner if the index is unowned or already ours; returns whether we now own it
		 */
		async claim() {
			if (!this.path()) {
				return true;
			}
			let record = await this.read();
			if (!record || this.isUs(record)) {
				await this.write();
				return true;
			}
			return false;
		},

		async release() {
			let path = this.path();
			if (path && this.isUs(await this.read())) {
				try {
					await IOUtils.remove(path);
				}
				catch {}
			}
		}
	};
};
