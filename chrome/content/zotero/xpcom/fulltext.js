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

Zotero.Fulltext = Zotero.FullText = new function () {
	this.__defineGetter__("fulltextCacheFile", function () { return '.zotero-ft-cache'; });

	this.INDEX_STATE_UNAVAILABLE = 0;
	this.INDEX_STATE_UNINDEXED = 1;
	this.INDEX_STATE_PARTIAL = 2;
	this.INDEX_STATE_INDEXED = 3;
	this.INDEX_STATE_QUEUED = 4;
	
	this.SYNC_STATE_UNSYNCED = 0;
	this.SYNC_STATE_IN_SYNC = 1;
	this.SYNC_STATE_TO_PROCESS = 2;
	this.SYNC_STATE_TO_DOWNLOAD = 3;
	this.SYNC_STATE_MISSING = 4;
	
	const _processorCacheFile = '.zotero-ft-unprocessed';

	// Schema version of the attached content database (fulltext.sqlite)
	const _contentDBVersion = 1;
	// Version of the content index format. Bump to force a rebuild of the index from the cached
	// text (e.g., after a tokenizer or normalization change) -- items recorded at a lower version
	// in fulltextIndexState are re-indexed by the background queue processor.
	const _contentIndexVersion = 1;

	const kWbClassSpace =            0;
	const kWbClassAlphaLetter =      1;
	const kWbClassPunct =            2;
	const kWbClassHanLetter =        3;
	const kWbClassKatakanaLetter =   4;
	const kWbClassHiraganaLetter =   5;
	const kWbClassHWKatakanaLetter = 6;
	const kWbClassThaiLetter =       7;
	
	var _pdfConverter = null; // nsIFile to executable
	var _pdfInfo = null; // nsIFile to executable
	var _pdfData = null;
	
	var _idleObserverIsRegistered = false;
	var _idleObserverDelay = 30;
	// Shorter idle threshold (seconds) for the index drain than the sync content processor's, so
	// indexing ramps back up a few seconds after the user pauses rather than waiting a full 30
	var _drainIdleDelay = 3;
	var _syncContentTimeoutID = null;
	var _queueDrainTimerID = null;
	var _indexingInProgress = false;
	// Ordered itemID cursors for the queue processors, so each drain advances through the source
	// tables once rather than rescanning already-indexed rows from the start on every batch. Reset
	// to 0 when a pass reaches the end, to pick up anything re-queued below the cursor.
	var _attachmentIndexQueueCursor = 0;
	var _attachmentExtractionQueueCursor = 0;
	// Flush a content batch to the index once it reaches this many characters, so peak memory stays
	// bounded by the budget rather than by item size (each up to fulltext.textMaxLength)
	const _maxContentBatchChars = 2000000;
	var _processingSyncedContent = false;
	var _reindexLimitTimeoutIDs = {};
	var _syncContentBlacklist = {};
	var _upgradeCheck = true;
	var _syncLibraryVersion = 0;
	
	this.init = async function () {
		// Set up the full-text content index: a contentless trigram FTS5 table in a separate
		// attached database (fulltext.sqlite), used for content searching. It's a local,
		// rebuildable index kept out of zotero.sqlite (so it doesn't bloat the main DB or its
		// backups), versioned independently via PRAGMA user_version. The original extracted text
		// still lives in the .zotero-ft-cache files; the index stores only normalized trigrams.
		//
		// FTS5 is a bundled SQLite extension. It's loaded once here; DBConnection re-loads it
		// automatically after a reconnect (before this callback runs), so it's available for the
		// FTS5 tables below.
		await Zotero.DB.loadExtension('fts5');
		let setUpContentDB = async () => {
			let path = Zotero.DataDirectory.getDatabase('fulltext');
			await Zotero.DB.queryAsync("ATTACH DATABASE ? AS ftindex", [path]);
			// The index is keyed by local itemID, which is reassigned whenever zotero.sqlite is
			// recreated (e.g., deleted and re-synced from the server). An index built against a
			// different database instance would map its rows to the wrong items, so it has to be
			// discarded and rebuilt rather than reused. Detect that by comparing the localUserKey
			// the index was stamped with against the current one. The extracted text still lives in
			// the .zotero-ft-cache files, so the background queue repopulates the index.
			let localUserKey = Zotero.Users.getLocalUserKey();
			let version = await Zotero.DB.valueQueryAsync("PRAGMA ftindex.user_version");
			let indexedUserKey = version >= _contentDBVersion
				? await Zotero.DB.valueQueryAsync(
					"SELECT value FROM ftindex.fulltextIndexMeta WHERE key='localUserKey'")
				: false;
			if (version < _contentDBVersion || indexedUserKey != localUserKey) {
				// Drop any existing tables so a stale or mismatched index is rebuilt from scratch
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS ftindex.fulltextContent");
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS ftindex.fulltextContentCJK");
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS ftindex.fulltextIndexState");
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS ftindex.fulltextIndexMeta");
				// Latin (and CJK runs of 3+ chars): trigram index over the normalized text
				await Zotero.DB.queryAsync(
					"CREATE VIRTUAL TABLE ftindex.fulltextContent USING fts5("
					+ "text, tokenize='trigram', content='', contentless_delete=1)"
				);
				// CJK: overlapping 2-grams of CJK runs only, space-separated, indexed with the
				// ascii tokenizer (which leaves multibyte characters intact and splits on the
				// spaces). The trigram tokenizer can't match the 1-2-character queries common in
				// CJK, so those go here instead.
				await Zotero.DB.queryAsync(
					"CREATE VIRTUAL TABLE ftindex.fulltextContentCJK USING fts5("
					+ "text, tokenize='ascii', content='', contentless_delete=1)"
				);
				// Records which items are in the content index and at what format version. The
				// contentless FTS5 tables can't be queried for this, so this side table makes the
				// queue (items not yet indexed at the current version) a countable,
				// resumable query.
				await Zotero.DB.queryAsync(
					"CREATE TABLE ftindex.fulltextIndexState (\n"
					+ "    itemID INTEGER PRIMARY KEY,\n"
					+ "    version INT NOT NULL\n"
					+ ")"
				);
				// Index metadata, including the localUserKey the index was built against (above)
				await Zotero.DB.queryAsync(
					"CREATE TABLE ftindex.fulltextIndexMeta (\n"
					+ "    key TEXT PRIMARY KEY,\n"
					+ "    value NOT NULL\n"
					+ ")"
				);
				await Zotero.DB.queryAsync(
					"REPLACE INTO ftindex.fulltextIndexMeta (key, value) VALUES ('localUserKey', ?)",
					[localUserKey]
				);
				await Zotero.DB.queryAsync("PRAGMA ftindex.user_version = " + _contentDBVersion);
			}
		};
		// Rebuild the index if its file is found corrupt. A malformed page can surface from any
		// query -- setup, a search, or the background queue -- so recovery is driven by the
		// corruption handler: drop the file and recreate it (it's derived, so the queue repopulates
		// it from the cache files). DBConnection confirms the main
		// database is intact before calling this, so a disposable index failure never triggers
		// main-database recovery.
		let rebuildingContentDB = false;
		let rebuildContentDB = async () => {
			if (rebuildingContentDB) {
				return;
			}
			rebuildingContentDB = true;
			try {
				Zotero.debug("Rebuilding corrupt full-text index", 1);
				let path = Zotero.DataDirectory.getDatabase('fulltext');
				// Detach before touching the file. If this fails (e.g., a transaction is in
				// progress), stop rather than delete a still-attached database or reattach under a
				// name that's still in use -- the index stays as it was, and a later corruption
				// error or the next startup retries.
				await Zotero.DB.queryAsync("DETACH DATABASE ftindex");
				// Best-effort removal; if it fails, setUpContentDB reattaches the old file and a
				// later corruption error retries, rather than leaving ftindex detached
				try {
					await IOUtils.remove(path, { ignoreAbsent: true });
					await IOUtils.remove(path + "-wal", { ignoreAbsent: true });
					await IOUtils.remove(path + "-shm", { ignoreAbsent: true });
				}
				catch (e) {
					Zotero.logError(e);
				}
				await setUpContentDB();
				this.registerQueueDrainObserver();
			}
			catch (e) {
				Zotero.logError(e);
			}
			finally {
				rebuildingContentDB = false;
			}
		};
		Zotero.DB.addCorruptionHandler(rebuildContentDB);
		// A corrupt index throws when first read here; the handler rebuilds it (deferred, after this
		// unwinds). Any non-corruption error is unexpected.
		try {
			await setUpContentDB();
		}
		catch (e) {
			if (!Zotero.DB.isCorruptionError(e)) {
				throw e;
			}
			Zotero.logError(e);
		}
		// An ATTACHed database doesn't survive a connection reopen (e.g., after vacuum), so re-run
		// the setup on every reconnect
		Zotero.DB.onConnect(setUpContentDB);
		// The main-database vacuum doesn't reach the attached index, so reclaim its space during the
		// same idle maintenance
		Zotero.DB.onIdle(() => this.vacuumContentIndex());

		let pdfConverterFileName = "pdftotext";
		let pdfInfoFileName = "pdfinfo";
		
		if (Zotero.isWin) {
			pdfConverterFileName += '.exe';
			pdfInfoFileName += '.exe';
		}
		
		// AChrome is app/chrome
		let dir = FileUtils.getDir('AChrom', []).parent.parent;
		
		_pdfData = dir.clone();
		_pdfData.append('poppler-data');
		_pdfData = _pdfData.path;
		
		_pdfConverter = dir.clone();
		_pdfInfo = dir.clone();
		
		if(Zotero.isMac) {
			_pdfConverter = _pdfConverter.parent;
			_pdfConverter.append('MacOS');
			
			_pdfInfo = _pdfInfo.parent;
			_pdfInfo.append('MacOS');
		}

		_pdfConverter.append(pdfConverterFileName);
		_pdfInfo.append(pdfInfoFileName);
		
		Zotero.uiReadyPromise.then(async () => {
			await Zotero.Promise.delay(30000);
			
			this.registerSyncContentProcessor();
			Zotero.addShutdownListener(this.unregisterSyncContentProcessor.bind(this));
			
			// Start/stop content processor with full-text content syncing pref
			Zotero.Prefs.registerObserver('sync.fulltext.enabled', (enabled) => {
				if (enabled) {
					this.registerSyncContentProcessor();
				}
				else {
					this.unregisterSyncContentProcessor();
				}
			});

			// When a full-text limit is raised, re-extract just the items it affects rather than
			// forcing a full rebuild (which would re-upload everything). Debounced and reading the
			// settled value, so adjusting the limit -- or typing it in digit by digit -- only acts
			// once it stops changing; bumping it up and back down doesn't trigger re-extraction.
			// Gated in tests, which toggle these prefs without wanting indexing side effects.
			if (!Zotero.test) {
				let scheduleReindex = (type, pref) => {
					if (_reindexLimitTimeoutIDs[type]) {
						clearTimeout(_reindexLimitTimeoutIDs[type]);
					}
					_reindexLimitTimeoutIDs[type] = setTimeout(() => {
						_reindexLimitTimeoutIDs[type] = null;
						this.reindexTruncated(type, Zotero.Prefs.get(pref))
							.catch(e => Zotero.logError(e));
					}, 5000);
				};
				Zotero.Prefs.registerObserver('fulltext.textMaxLength', () => {
					scheduleReindex('chars', 'fulltext.textMaxLength');
				});
				Zotero.Prefs.registerObserver('fulltext.pdfMaxPages', () => {
					scheduleReindex('pages', 'fulltext.pdfMaxPages');
				});
			}
			
			// Stop content processor during syncs
			Zotero.Notifier.registerObserver(
				{
					notify: function (event, type, ids, extraData) {
						if (event == 'start') {
							this.unregisterSyncContentProcessor();
						}
						else if (event == 'stop') {
							this.registerSyncContentProcessor();
							// Index any content the sync just delivered right away, rather than
							// waiting for the idle observer -- the user may want to search it, and
							// in on-demand file-download mode it's their only searchable source.
							// Not awaited; runs in the background.
							if (!Zotero.test) {
								this.processSyncedContentNow();
							}
						}
					}.bind(this)
				},
				['sync'],
				'fulltext'
			);
		});

		// Bring the content index up to date for items full-text indexed before the index existed
		// (or before a format-version bump), then index any never-before-indexed attachments on
		// idle. Independent of full-text content syncing -- it indexes local text.
		Zotero.uiReadyPromise.then(async () => {
			await Zotero.Promise.delay(5000);
			Zotero.addShutdownListener(this.unregisterQueueDrainObserver.bind(this));
			await this.startQueueDrain();
		});
	};
	
	
	this.setPDFConverterPath = function (path) {
		_pdfConverter = Zotero.File.pathToFile(path);
	};
	
	
	this.setPDFInfoPath = function (path) {
		_pdfInfo = Zotero.File.pathToFile(path);
		
	};
	
	
	this.setPDFDataPath = function (path) {
		_pdfData = path;
	};
	
	
	this.getLibraryVersion = function (libraryID) {
		if (!libraryID) throw new Error("libraryID not provided");
		return Zotero.DB.valueQueryAsync(
			"SELECT version FROM version WHERE schema=?", "fulltext_" + libraryID
		)
	};
	
	
	this.setLibraryVersion = async function (libraryID, version) {
		if (!libraryID) throw new Error("libraryID not provided");
		await Zotero.DB.queryAsync(
			"REPLACE INTO version VALUES (?, ?)", ["fulltext_" + libraryID, version]
		);
	};
	
	
	this.clearLibraryVersion = function (libraryID) {
		return Zotero.DB.queryAsync("DELETE FROM version WHERE schema=?", "fulltext_" + libraryID);
	};
	
	
	this.getItemVersion = async function (itemID) {
		return Zotero.DB.valueQueryAsync(
			"SELECT version FROM fulltextItems WHERE itemID=?", itemID
		)
	};
	
	
	this.setItemSynced = function (itemID, version) {
		return Zotero.DB.queryAsync(
			"UPDATE fulltextItems SET synced=?, version=? WHERE itemID=?",
			[this.SYNC_STATE_IN_SYNC, version, itemID]
		);
	};
	
	
	// this is a port from http://mxr.mozilla.org/mozilla-central/source/intl/lwbrk/src/nsSampleWordBreaker.cpp to
	// Javascript to avoid the overhead of xpcom calls. The port keeps to the mozilla naming of interfaces/constants as
	// closely as possible.
	function getClass(c, cc) {
		if (cc < 0x2E80) { //alphabetical script
			if ((cc & 0xFF80) == 0) { // ascii
				if (c == ' '  || c == "\t" || c == "\r" || c == "\n") { return kWbClassSpace; }
				if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) { return kWbClassAlphaLetter; }
				return kWbClassPunct;
			}
			if ((0xFF80 & cc) == 0x0E00) { return kWbClassThaiLetter; }
			if (cc == 0x00A0/*NBSP*/) { return kWbClassSpace; }
			
			// General and Supplemental Unicode punctuation
			if ((cc >= 0x2000 && cc <= 0x206f) || (cc >= 0x2e00 && cc <= 0x2e7f)) { return kWbClassPunct; }
			
			return kWbClassAlphaLetter;
		}

		if ((cc >= 0x3400 && cc <= 0x9fff) || (cc>= 0xf900 && cc <= 0xfaff)) /*han*/ { return kWbClassHanLetter; }
		if (cc >= 0x30A0 && cc <= 0x30FF) { return kWbClassKatakanaLetter; }
		if (cc >= 0x3040 && cc <= 0x309F) { return kWbClassHiraganaLetter; }
		if (cc>= 0xFF60 && cc <= 0xFF9F) { return kWbClassHWKatakanaLetter; }
		return kWbClassAlphaLetter;
	}
	
	
	this.getPDFConverterExecAndArgs = function () {
		return {
			exec: _pdfConverter,
			args: ['-datadir', _pdfData]
		}
	};
	
	
	/*
	 * Returns true if MIME type is converted to text and cached before indexing
	 *   (e.g. application/pdf is run through pdftotext)
	 */
	this.isCachedMIMEType = function (mimeType) {
		switch (mimeType) {
			case 'application/pdf':
			case 'text/html':
			case 'application/epub+zip':
				return true;
		}
		return false;
	};
	
	
	/**
	 * Record an item's full-text indexing stats (indexed/total chars and pages, sync state) in
	 * fulltextItems
	 *
	 * @requireTransaction
	 * @param {Number} itemID
	 * @return {Promise}
	 */
	var setFulltextItem = async function (itemID, stats, version, synced) {
		Zotero.DB.requireTransaction();

		var cols = ['itemID', 'version', 'synced'];
		var params = [
			itemID,
			version ? parseInt(version) : 0,
			synced ? parseInt(synced) : Zotero.FullText.SYNC_STATE_UNSYNCED
		];
		if (stats) {
			for (let stat in stats) {
				cols.push(stat);
				params.push(stats[stat] ? parseInt(stats[stat]) : null);
			}
		}
		var sql = `REPLACE INTO fulltextItems (${cols.join(', ')}) `
			+ `VALUES (${cols.map(_ => '?').join(', ')})`;
		await Zotero.DB.queryAsync(sql, params);
	};
	
	
	/**
	 * @return {Promise}
	 */
	var indexString = async function (text, itemID, stats, version, synced) {
		if (itemID != parseInt(itemID)) {
			throw new Error("itemID not provided");
		}
		
		while (Zotero.DB.inTransaction()) {
			await Zotero.DB.waitForTransaction('indexString()');
		}

		await Zotero.DB.executeTransaction(async function () {
			await this.clearItemWords(itemID, true);
			await setFulltextItem(itemID, stats, version, synced);

			// Index the extracted text for content searching (FTS5 trigram + CJK 2-gram tables,
			// plus the index-state row). The original text stays in the .zotero-ft-cache file.
			await setContentIndex(itemID, text);

			Zotero.Notifier.queue('index', 'item', itemID);
			Zotero.Notifier.queue('refresh', 'item', itemID);
		}.bind(this));
		
		// If there's a processor cache file, delete it (whether or not we just used it)
		var item = await Zotero.Items.getAsync(itemID);
		var cacheFile = this.getSyncedContentCacheFile(item);
		if (cacheFile.exists()) {
			cacheFile.remove(false);
		}
	}.bind(this);
	
	
	/**
	 * @param {Document} document
	 * @param {Number} itemID
	 * @return {Promise}
	 */
	this.indexDocument = async function (document, itemID) {
		if (!itemID){
			throw ('Item ID not provided to indexDocument()');
		}
		
		Zotero.debug("Indexing document '" + document.title + "'");
		
		if (!Zotero.MIME.isTextType(document.contentType)) {
			Zotero.debug(document.contentType + " document is not text", 2);
			return false;
		}
		
		if (!document.body) {
			Zotero.debug("Cannot index " + document.contentType + " file", 2);
			return false;
		}
		
		if (!document.characterSet){
			Zotero.debug("Text file didn't have charset", 2);
			return false;
		}
		
		var maxLength = Zotero.Prefs.get('fulltext.textMaxLength');
		if (!maxLength) {
			return false;
		}
		var text = document.documentElement.innerText;
		var totalChars = text.length;
		var item = Zotero.Items.get(itemID);
		if (document.contentType == 'text/html') {
			await writeCacheFile(item, text, maxLength);
		}
		
		if (totalChars > maxLength) {
			Zotero.debug('Only indexing first ' + maxLength + ' characters of item '
				+ itemID + ' in indexDocument()');
		}
		
		await indexString(
			text,
			itemID,
			{ indexedChars: text.length, totalChars }
		);
	};
	

	/**
	 * Index PDF file and store the fulltext content in a file
	 *
	 * @param {String} filePath
	 * @param {Number} itemID
	 * @param {Boolean} [allPages] - If true, index all pages rather than pdfMaxPages
	 * @return {Promise}
	 */
	this.indexPDF = async function (filePath, itemID, allPages) {
		var maxPages = Zotero.Prefs.get('fulltext.pdfMaxPages');
		if (maxPages == 0) {
			return false;
		}
		var item = await Zotero.Items.getAsync(itemID);
		var linkMode = item.attachmentLinkMode;
		// If the file is stored outside of Zotero, the cache file is saved in
		// the item's storage directory
		var parentDirPath = linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE
			? Zotero.Attachments.getStorageDirectory(item).path
			: PathUtils.parent(filePath);
		var cacheFilePath = OS.Path.join(parentDirPath, this.fulltextCacheFile);
		if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
			// Create only if missing -- don't use createDirectoryForItem(),
			// which deletes and recreates the directory and would destroy
			// other files stored there (e.g., the SDT cache)
			await Zotero.File.createDirectoryIfMissingAsync(parentDirPath);
			// Remove any previous cache file, which createDirectoryForItem()
			// did implicitly, so that a failed re-extraction below can't
			// leave a replaced file's old text in place
			await IOUtils.remove(cacheFilePath, { ignoreAbsent: true });
		}
		try {
			var {
				text,
				extractedPages,
				totalPages
			} = await Zotero.PDFWorker.getFullText(itemID, allPages ? null : maxPages);
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
		if (!text || !extractedPages) {
			return false;
		}
		await Zotero.File.putContentsAsync(cacheFilePath, text);
		var stats = { indexedPages: extractedPages, totalPages };
		await indexString(text, itemID, stats);
		return true;
	};


	/**
	 * Index EPUB file and store the fulltext content in a file
	 *
	 * @param {String} filePath
	 * @param {Number} itemID
	 * @param {Boolean} [allText] If true, index all text rather than textMaxLength
	 * @return {Promise}
	 */
	this.indexEPUB = async function (filePath, itemID, allText) {
		const { EPUB } = ChromeUtils.importESModule("chrome://zotero/content/EPUB.mjs");
		
		let maxLength = Zotero.Prefs.get('fulltext.textMaxLength');
		if (maxLength === 0) {
			return false;
		}
		let item = await Zotero.Items.getAsync(itemID);
		let epub = new EPUB(filePath);
		
		try {
			let text = '';
			let totalChars = 0;
			for await (let { href, doc } of epub.getSectionDocuments(filePath)) {
				if (!doc.body) {
					Zotero.debug(`Skipping EPUB entry '${href}' with no body`);
					continue;
				}
				
				let bodyText = doc.body.innerText;
				totalChars += bodyText.length;
				if (!allText) {
					bodyText = bodyText.substring(0, maxLength - text.length);
				}
				text += bodyText;
			}
			
			await writeCacheFile(item, text, maxLength, allText);
			await indexString(text, itemID, { indexedChars: text.length, totalChars });
			return true;
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
		finally {
			epub.close();
		}
	};
	
	
	/**
	 * @param {Integer[]|Integer} items - One or more itemIDs
	 * @param {Object} [options]
	 * @param {Boolean} [options.complete=false] - Ignore page/character limits
	 * @param {Boolean} [options.ignoreErrors=false] - Continue on error instead of throwing
	 */
	this.indexItems = async function (itemIDs, options = {}) {
		var complete;
		var ignoreErrors;
		if (typeof options == 'boolean') {
			Zotero.logError("indexItems() now takes an 'options' object -- please update your code");
			complete = options;
			ignoreErrors = arguments[2];
		}
		else {
			complete = options.complete;
			ignoreErrors = options.ignoreErrors;
		}
		
		if (!Array.isArray(itemIDs)) {
			itemIDs = [itemIDs];
		}
		var items = await Zotero.Items.getAsync(itemIDs);
		for (let item of items) {
			if (!item.isAttachment()) {
				continue;
			}
			
			Zotero.debug("Indexing item " + item.libraryKey);
			let itemID = item.id;
			
			// If there's a processor cache file from syncing, use it
			let processorCacheFile = this.getSyncedContentCacheFile(item).path;
			if (await OS.File.exists(processorCacheFile)) {
				let indexed = await Zotero.Fulltext.indexSyncedContent(itemID);
				if (indexed) {
					continue;
				}
			}
			
			var path = await item.getFilePathAsync();
			if (!path) {
				Zotero.debug("No file to index for item " + item.libraryKey);
				continue;
			}
			
			try {
				await indexItem(item, path, complete);
			}
			catch (e) {
				if (ignoreErrors) {
					Zotero.logError("Error indexing " + path);
					Zotero.logError(e);
					continue;
				}
				throw e;
			}
		}
	};
	
	
	var indexItem = async function (item, path, complete) {
		if (!(await OS.File.exists(path))) {
			Zotero.debug(`${path} does not exist in indexItem()`, 2);
			return false;
		}
		
		var contentType = item.attachmentContentType;
		var charset = item.attachmentCharset;
		
		if (!contentType) {
			Zotero.debug("No content type in indexItem()", 2);
			return false;
		}
		
		var maxLength = Zotero.Prefs.get('fulltext.textMaxLength');
		if (!maxLength) {
			Zotero.debug('fulltext.textMaxLength is 0 -- skipping indexing');
			return false;
		}
		
		if (contentType == 'application/pdf') {
			return this.indexPDF(path, item.id, complete);
		}
		
		if (contentType == 'application/epub+zip') {
			return this.indexEPUB(path, item.id, complete);
		}

		if (!Zotero.MIME.isTextType(contentType)) {
			Zotero.debug('File is not text in indexItem()', 2);
			return false;
		}
		
		Zotero.debug('Indexing file ' + path);
		
		var text;
		
		// If it's a plain-text file and we know the charset, just get the contents
		if (contentType == 'text/plain' && charset) {
			text = await Zotero.File.getContentsAsync(path, charset);
		}
		// Otherwise load it in a hidden browser
		else {
			// If the file's content type can't be displayed in a browser, treat it as text/plain
			if (!Cc["@mozilla.org/webnavigation-info;1"].getService(Ci.nsIWebNavigationInfo)
					.isTypeSupported(contentType)) {
				contentType = 'text/plain';
			}
			
			let pageData = await getPageData(path, contentType);
			text = pageData.bodyText;
			if (!charset) {
				charset = pageData.characterSet;
			}
			if (contentType == 'text/html') {
				await writeCacheFile(item, text, maxLength, complete);
			}
			
			// If the item didn't have a charset assigned and the library is editable, update it now
			if (charset && !item.attachmentCharset && item.library.editable) {
				let canonical = Zotero.CharacterSets.toCanonical(charset);
				let msg = `Character set is ${canonical}`;
				if (charset != canonical) {
					msg += ` (detected: ${charset})`;
					charset = canonical;
				}
				Zotero.debug(msg);
				
				if (charset) {
					item.attachmentCharset = charset;
					await item.saveTx({
						skipNotifier: true
					});
				}
			}
			
			if (!charset) {
				Zotero.debug(`Couldn't detect character set for ${item.libraryKey} -- using UTF-8`);
				charset = 'utf-8';
			}
		}
		
		var totalChars = text.length;
		if (!complete) {
			text = text.substr(0, maxLength);
		}
		var stats = { indexedChars: text.length, totalChars };
		await indexString(text, item.id, stats);
	}.bind(this);
	
	
	// TEMP: Temporary mechanism to serialize indexing of new attachments
	//
	// This should instead save the itemID to a table that's read by the content processor
	var _queue = [];
	var _indexing = false;
	var _nextIndexTime;
	var _indexDelay = 5000;
	var _indexInterval = 500;
	var _indexNextInTest = false;
	
	this.queueItem = async function (item) {
		// Index files immediately during tests that enable it
		if (Zotero.test) {
			if (_indexNextInTest) {
				_indexNextInTest = false;
				await this.indexItems([item.id]);
			}
			return;
		}
		
		_queue.push(item.id);
		_nextIndexTime = Date.now() + _indexDelay;
		setTimeout(() => {
			_processNextItem()
		}, _indexDelay);
	};
	
	this.indexNextInTest = function () {
		_indexNextInTest = true;
	};
	
	async function _processNextItem() {
		if (!_queue.length) return;
		// Another _processNextItem() was scheduled
		if (Date.now() < _nextIndexTime) return;
		// If indexing is already running, _processNextItem() will be called when it's done
		if (_indexing) return;
		_indexing = true;
		var itemID = _queue.shift();
		try {
			await Zotero.FullText.indexItems([itemID], { ignoreErrors: true });
		}
		finally {
			_indexing = false;
		}
		setTimeout(() => {
			_processNextItem();
		}, _indexInterval);
	};
	
	
	//
	// Full-text content syncing
	//
	/**
	 * Get content and stats that haven't yet been synced
	 *
	 * @param {Integer} libraryID
	 * @param {Integer} [options]
	 * @param {Integer} [options.maxSize]
	 * @param {Integer} [options.maxItems]
	 * @param {Integer} [options.lastItemID] - Only return content for items above this id
	 * @return {Promise<Array<Object>>}
	 */
	this.getUnsyncedContent = async function (libraryID, options = {}) {
		var contentItems = [];
		var sql = "SELECT itemID, indexedChars, totalChars, indexedPages, totalPages "
			+ "FROM fulltextItems FI JOIN items I USING (itemID) WHERE libraryID=? AND "
			+ "FI.synced=? AND I.synced=1 ";
		var params = [libraryID, this.SYNC_STATE_UNSYNCED];
		if (options.lastItemID) {
			sql += "AND itemID>?";
			params.push(options.lastItemID);
		}
		sql += "ORDER BY itemID";
		var rows = await Zotero.DB.queryAsync(sql, params);
		var contentSize = 0;
		for (let i = 0; i < rows.length; i++) {
			let row = rows[i];
			let content;
			let itemID = row.itemID;
			let item = await Zotero.Items.getAsync(itemID);
			let libraryKey = item.libraryKey;
			let contentType = item.attachmentContentType;
			if (contentType && (this.isCachedMIMEType(contentType) || Zotero.MIME.isTextType(contentType))) {
				try {
					let cacheFile = this.getItemCacheFile(item).path;
					if (await OS.File.exists(cacheFile)) {
						Zotero.debug("Getting full-text content from cache "
							+ "file for item " + libraryKey);
						content = await Zotero.File.getContentsAsync(cacheFile);
					}
					else {
						// If a cache file is required, mark the full text as missing
						if (this.isCachedMIMEType(contentType)) {
							Zotero.debug("Full-text content cache file doesn't exist for item "
								+ libraryKey, 2);
							let sql = "UPDATE fulltextItems SET synced=? WHERE itemID=?";
							await Zotero.DB.queryAsync(sql, [this.SYNC_STATE_MISSING, item.id]);
							continue;
						}
						
						// Same for missing attachments
						let path = await item.getFilePathAsync();
						if (!path) {
							Zotero.debug("File doesn't exist getting full-text content for item "
								+ libraryKey, 2);
							let sql = "UPDATE fulltextItems SET synced=? WHERE itemID=?";
							await Zotero.DB.queryAsync(sql, [this.SYNC_STATE_MISSING, item.id]);
							continue;
						}
						
						Zotero.debug("Getting full-text content from file for item " + libraryKey);
						content = await Zotero.File.getContentsAsync(path, item.attachmentCharset);
						
						// Include only as many characters as we've indexed
						content = content.substr(0, row.indexedChars);
					}
				}
				catch (e) {
					Zotero.logError(e);
					continue;
				}
			}
			else {
				Zotero.debug("Skipping non-text file getting full-text content for item "
					+ `${libraryKey} (contentType: ${contentType})`, 2);
				
				// Delete rows for items that weren't supposed to be indexed
				await Zotero.DB.executeTransaction(async function () {
					await this.clearItemWords(itemID);
				}.bind(this));
				continue;
			}
			
			// If this isn't the first item and it would put us over the size limit, stop
			if (contentItems.length && options.maxSize && contentSize + content.length > options.maxSize) {
				break;
			}
			
			contentItems.push({
				itemID: item.id,
				key: item.key,
				content,
				indexedChars: row.indexedChars ? row.indexedChars : 0,
				totalChars: row.totalChars ? row.totalChars : 0,
				indexedPages: row.indexedPages ? row.indexedPages : 0,
				totalPages: row.totalPages ? row.totalPages : 0
			});
			
			if (options.maxItems && contentItems.length >= options.maxItems) {
				break;
			}
			contentSize += content.length;
		}
		return contentItems;
	};
	
	
	/**
	 * @return {String}  PHP-formatted POST data for items not yet downloaded
	 */
	this.getUndownloadedPostData = async function () {
		// TODO: Redo for API syncing
		
		// On upgrade, get all content
		var sql = "SELECT value FROM settings WHERE setting='fulltext' AND key='downloadAll'";
		if (await Zotero.DB.valueQueryAsync(sql)) {
			return "&ftkeys=all";
		}
		
		var sql = "SELECT itemID FROM fulltextItems WHERE synced=" + this.SYNC_STATE_TO_DOWNLOAD;
		var itemIDs = await Zotero.DB.columnQueryAsync(sql);
		if (!itemIDs) {
			return "";
		}
		var undownloaded = {};
		for (let i=0; i<itemIDs.length; i++) {
			let itemID = itemIDs[i];
			let item = await Zotero.Items.getAsync(itemID);
			let libraryID = item.libraryID
			if (!undownloaded[libraryID]) {
				undownloaded[libraryID] = [];
			}
			undownloaded[libraryID].push(item.key);
		}
		var data = "";
		for (let libraryID in undownloaded) {
			for (let i = 0; i < undownloaded[libraryID].length; i++) {
				data += "&" + encodeURIComponent("ftkeys[" + libraryID + "][" + i + "]")
					+ "=" + undownloaded[libraryID][i];
			}
		}
		return data;
	};
	
	
	/**
	 * Save full-text content and stats to a cache file
	 *
	 * @param {Integer} libraryID
	 * @param {String} key - Item key
	 * @param {Object} data
	 * @param {String} data.content
	 * @param {Integer} [data.indexedChars]
	 * @param {Integer} [data.totalChars]
	 * @param {Integer} [data.indexedPages]
	 * @param {Integer} [data.totalPages]
	 * @param {Integer} version
	 * @return {Promise}
	 */
	this.setItemContent = async function (libraryID, key, data, version) {
		var libraryKey = libraryID + "/" + key;
		var item = Zotero.Items.getByLibraryAndKey(libraryID, key);
		if (!item) {
			let msg = "Item " + libraryKey + " not found setting full-text content";
			Zotero.logError(msg);
			return;
		}
		var itemID = item.id;
		var currentVersion = await this.getItemVersion(itemID)
		
		var processorCacheFile = this.getSyncedContentCacheFile(item).path; // .zotero-ft-unprocessed
		var itemCacheFile = this.getItemCacheFile(item).path; // .zotero-ft-cache
		
		// If a storage directory doesn't exist, create it
		if (!((await OS.File.exists(PathUtils.parent(processorCacheFile))))) {
			await Zotero.Attachments.createDirectoryForItem(item);
		}
		
		// If indexed previously and the existing extracted text matches the new text,
		// just update the version
		if (currentVersion !== false
				&& ((await OS.File.exists(itemCacheFile)))
				&& ((await Zotero.File.getContentsAsync(itemCacheFile))) == data.content) {
			Zotero.debug("Current full-text content matches remote for item "
				+ libraryKey + " -- updating version");
			return Zotero.DB.queryAsync(
				"UPDATE fulltextItems SET version=?, synced=? WHERE itemID=?",
				[version, this.SYNC_STATE_IN_SYNC, itemID]
			);
		}
		
		// Otherwise save data to -unprocessed file
		Zotero.debug("Writing full-text content and data for item " + libraryKey
			+ " to " + processorCacheFile);
		await Zotero.File.putContentsAsync(processorCacheFile, JSON.stringify({
			indexedChars: data.indexedChars,
			totalChars: data.totalChars,
			indexedPages: data.indexedPages,
			totalPages: data.totalPages,
			version,
			text: data.content
		}));
		var synced = this.SYNC_STATE_TO_PROCESS;
		// If indexed previously, update the sync state
		if (currentVersion !== false) {
			await Zotero.DB.queryAsync("UPDATE fulltextItems SET synced=? WHERE itemID=?", [synced, itemID]);
		}
		// If not yet indexed, add an empty row
		else {
			await Zotero.DB.queryAsync(
				"REPLACE INTO fulltextItems (itemID, version, synced) VALUES (?, 0, ?)",
				[itemID, synced]
			);
		}
		
		this.registerSyncContentProcessor();
	};
	
	
	/**
	 * Start the idle observer for the background content processor
	 */
	this.registerSyncContentProcessor = function () {
		// Don't start idle observer during tests
		if (Zotero.test) return;
		if (!Zotero.Prefs.get('sync.fulltext.enabled')) return;
		
		if (!_idleObserverIsRegistered) {
			Zotero.debug("Starting full-text content processor");
			var idleService = Components.classes["@mozilla.org/widget/useridleservice;1"]
					.getService(Components.interfaces.nsIUserIdleService);
			idleService.addIdleObserver(this._syncContentIdleObserver, _idleObserverDelay);
			_idleObserverIsRegistered = true;
		}
	}
	
	
	this.unregisterSyncContentProcessor = function () {
		if (_idleObserverIsRegistered) {
			Zotero.debug("Unregistering full-text content processor idle observer");
			var idleService = Components.classes["@mozilla.org/widget/useridleservice;1"]
				.getService(Components.interfaces.nsIUserIdleService);
			idleService.removeIdleObserver(this._syncContentIdleObserver, _idleObserverDelay);
			_idleObserverIsRegistered = false;
		}
		
		this.stopSyncContentProcessor();
	}
	
	
	/**
	 * Stop the idle observer and a running timer, if there is one
	 */
	this.stopSyncContentProcessor = function () {
		Zotero.debug("Stopping full-text content processor");
		if (_syncContentTimeoutID) {
			clearTimeout(_syncContentTimeoutID);
			_syncContentTimeoutID = null;
		}
	}
	
	/**
	 * Find items marked as having unprocessed cache files, run cache file processing on one item, and
	 * after a short delay call self again with the remaining items
	 *
	 * @param {Array<Integer>} itemIDs  An array of itemIDs to process; if this
	 *                                  is omitted, a database query is made
	 *                                  to find unprocessed content
	 * @return {Boolean}  TRUE if there's more content to process; FALSE otherwise
	 */
	this.processSyncedContent = async function (itemIDs) {
		// Defer to a prompt post-sync burst if one is running, so the two don't process the same
		// items concurrently
		if (!itemIDs && _processingSyncedContent) {
			return;
		}
		// Idle observer can take a little while to trigger and may not cancel the setTimeout()
		// in time, so check idle time directly
		var idleService = Components.classes["@mozilla.org/widget/useridleservice;1"]
			.getService(Components.interfaces.nsIUserIdleService);
		if (idleService.idleTime < _idleObserverDelay * 1000) {
			return;
		}
		
		if (!itemIDs) {
			Zotero.debug("Checking for unprocessed full-text content");
			let sql = "SELECT itemID FROM fulltextItems WHERE synced=" + this.SYNC_STATE_TO_PROCESS;
			itemIDs = await Zotero.DB.columnQueryAsync(sql);
		}
		
		var origLen = itemIDs.length;
		itemIDs = itemIDs.filter(function (id) {
			return !(id in _syncContentBlacklist);
		});
		if (itemIDs.length < origLen) {
			let skipped = (origLen - itemIDs.length);
			Zotero.debug("Skipping large full-text content for " + skipped
				+ " item" + (skipped == 1 ? '' : 's'));
		}
		
		// If there's no more unprocessed content, stop the idle observer
		if (!itemIDs.length) {
			Zotero.debug("No unprocessed full-text content found");
			this.unregisterSyncContentProcessor();
			return;
		}
		
		let itemID = itemIDs.shift();
		let item = await Zotero.Items.getAsync(itemID);
		
		Zotero.debug("Processing full-text content for item " + item.libraryKey);
		
		await Zotero.Fulltext.indexSyncedContent(itemID);
		
		if (!itemIDs.length || idleService.idleTime < _idleObserverDelay * 1000) {
			return;
		}
		
		// If there are remaining items, call self again after a short delay. The delay allows
		// for processing to be interrupted if the user returns from idle. At least on macOS,
		// when Zotero is in the background this can be throttled to 10 seconds.
		_syncContentTimeoutID = setTimeout(() => this.processSyncedContent(itemIDs), 200);
	};


	/**
	 * Process sync-delivered full-text content (marked SYNC_STATE_TO_PROCESS) into the index right
	 * away, without waiting for the idle observer. Called when a sync finishes, since the user may
	 * want to search the content they just synced -- and in on-demand file-download mode synced
	 * content is their only searchable source. Yields between items so it doesn't block the UI, and
	 * stops if another sync starts.
	 *
	 * @return {Promise}
	 */
	this.processSyncedContentNow = async function () {
		// One drain at a time; the idle observer defers to this while it's running
		if (_processingSyncedContent) {
			return;
		}
		_processingSyncedContent = true;
		try {
			let sql = "SELECT itemID FROM fulltextItems WHERE synced=" + this.SYNC_STATE_TO_PROCESS;
			let itemIDs = (await Zotero.DB.columnQueryAsync(sql))
				.filter(id => !(id in _syncContentBlacklist));
			if (itemIDs.length) {
				Zotero.debug("Processing " + itemIDs.length + " "
					+ Zotero.Utilities.pluralize(itemIDs.length, 'item') + " of synced full-text content");
			}
			for (let itemID of itemIDs) {
				// A new sync started -- leave the rest to it and the idle observer
				if (Zotero.Sync.Runner.syncInProgress) {
					break;
				}
				await this.indexSyncedContent(itemID);
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		finally {
			_processingSyncedContent = false;
		}
	};

	this._syncContentIdleObserver = {
		observe: function (subject, topic, data) {
			// On idle, start the background processor
			if (topic == 'idle') {
				this.processSyncedContent();
			}
			// When back from idle, stop the processor (but keep the idle observer registered)
			else if (topic == 'active') {
				this.stopSyncContentProcessor();
			}
		}.bind(this)
	};


	//
	// Content index queue
	//
	// Builds the content FTS5 indexes from the cached text of items that were full-text indexed
	// before the index existed (or before a format-version bump). The work list is a query against
	// fulltextIndexState, so progress is countable and resumable across restarts. New indexing goes
	// through indexString(), which keeps the index current; this only drains the queue.
	//

	/**
	 * Number of full-text-indexed items not yet in the content index at the current version
	 * (i.e., the size of the content index queue). Suitable for showing indexing progress.
	 *
	 * @return {Promise<Integer>}
	 */
	this.getAttachmentIndexQueueCount = async function () {
		return Zotero.DB.valueQueryAsync(
			"SELECT COUNT(*) FROM fulltextItems FI "
			+ "LEFT JOIN ftindex.fulltextIndexState S USING (itemID) "
			+ "WHERE S.itemID IS NULL OR S.version<?",
			[_contentIndexVersion]
		);
	};


	/**
	 * Process the content index queue, reading each item's cached text and indexing it.
	 *
	 * @param {Object} [options]
	 * @param {Integer} [options.maxTime] - Stop after roughly this many ms (for a bounded startup
	 *     burst); omit to drain the whole queue
	 * @param {Boolean} [options.checkIdle] - Stop as soon as the user is no longer idle (for the
	 *     idle-driven drain)
	 * @return {Promise<Integer>} The number of items processed
	 */
	this.processAttachmentIndexQueue = async function ({ maxTime = null, checkIdle = false, onProgress = null } = {}) {
		// Only one drain at a time -- the startup burst, the idle observer, and the prefs pane can
		// all call this (and the unindexed-items pass below), and concurrent runs would process the
		// same items or pile on the load
		if (_indexingInProgress) {
			return 0;
		}
		_indexingInProgress = true;
		let start = Date.now();
		let processed = 0;
		try {
			while (true) {
				// Don't compete with syncing -- especially full-text content downloads, which would
				// otherwise race with re-extraction here. Resume on a later idle once sync is done.
				if (Zotero.Sync.Runner.syncInProgress) {
					return processed;
				}
				if (checkIdle && !_canDrainIndex()) {
					return processed;
				}
				let itemIDs = await Zotero.DB.columnQueryAsync(
					"SELECT FI.itemID FROM fulltextItems FI "
					+ "LEFT JOIN ftindex.fulltextIndexState S USING (itemID) "
					+ "WHERE (S.itemID IS NULL OR S.version<?) AND FI.itemID>? "
					+ "ORDER BY FI.itemID LIMIT 50",
					[_contentIndexVersion, _attachmentIndexQueueCursor]
				);
				if (!itemIDs.length) {
					// Nothing left above the cursor; restart from the beginning to catch anything
					// re-queued below it, and stop only when a full pass finds nothing
					if (_attachmentIndexQueueCursor) {
						_attachmentIndexQueueCursor = 0;
						continue;
					}
					Zotero.debug("No queued full-text content to index");
					return processed;
				}
				Zotero.debug("Indexing " + itemIDs.length + " "
					+ Zotero.Utilities.pluralize(itemIDs.length, 'item') + " into the full-text content index");
				// Read text and write it in batched transactions, but cap each batch at a
				// character budget so peak memory doesn't scale with item size
				let batch = [];
				let batchChars = 0;
				let flushBatch = async () => {
					if (!batch.length) {
						return;
					}
					await Zotero.DB.executeTransaction(async function () {
						for (let [itemID, text] of batch) {
							await setContentIndex(itemID, text);
						}
					});
					processed += batch.length;
					batch = [];
					batchChars = 0;
				};
				for (let itemID of itemIDs) {
					let text = await _readContentForIndex(itemID);
					// null -> re-extracted from the file by indexItems(), which already wrote it
					if (text === null) {
						processed++;
						continue;
					}
					batch.push([itemID, text]);
					batchChars += text.length;
					if (batchChars >= _maxContentBatchChars) {
						await flushBatch();
					}
				}
				await flushBatch();
				// The whole batch is indexed now (re-extracted or written above), so advance past it
				_attachmentIndexQueueCursor = itemIDs[itemIDs.length - 1];
				if (onProgress) {
					onProgress(processed);
				}
				if (maxTime && (Date.now() - start) >= maxTime) {
					return processed;
				}
			}
		}
		finally {
			_indexingInProgress = false;
		}
	};


	// Query for indexable attachments with no fulltextItems row yet -- the work list for
	// processAttachmentExtractionQueue and the pending count. Skips types whose extraction is currently turned
	// off, so they neither loop nor count as pending: a textMaxLength of 0 disables all indexing
	// (returns null), and a pdfMaxPages of 0 disables PDFs. They become eligible again if the limit
	// is raised.
	function _attachmentExtractionSQL(select) {
		if (!Zotero.Prefs.get('fulltext.textMaxLength')) {
			return null;
		}
		// The text types use a LIKE, which the DB layer requires be a bound parameter, so 'text/%' is
		// passed by callers rather than inlined alongside the other content types here
		let types = Zotero.Prefs.get('fulltext.pdfMaxPages') > 0
			? "contentType IN ('application/pdf', 'application/epub+zip') OR contentType LIKE ?"
			: "contentType = 'application/epub+zip' OR contentType LIKE ?";
		return "SELECT " + select + " FROM itemAttachments "
			+ "WHERE linkMode != " + Zotero.Attachments.LINK_MODE_LINKED_URL + " "
			+ "AND (" + types + ") "
			+ "AND itemID NOT IN (SELECT itemID FROM fulltextItems)";
	}


	// Record an attachment as having no indexable content: an empty fulltextItems row (marked
	// missing) plus an empty content-index entry, so it leaves both the unindexed queue and the
	// content index queue.
	async function recordMissingContent(itemID) {
		await Zotero.DB.executeTransaction(async function () {
			await Zotero.DB.queryAsync(
				"INSERT OR IGNORE INTO fulltextItems (itemID, version, synced) VALUES (?, 0, ?)",
				[itemID, Zotero.FullText.SYNC_STATE_MISSING]
			);
			await setContentIndex(itemID, '');
		});
	}


	/**
	 * Number of indexable attachments with no full-text content yet (no fulltextItems row). These
	 * are extracted (or marked missing) by processAttachmentExtractionQueue() on the same triggers as the
	 * content index queue.
	 *
	 * @return {Promise<Integer>}
	 */
	this.getAttachmentExtractionQueueCount = async function () {
		let sql = _attachmentExtractionSQL("COUNT(*)");
		if (!sql) {
			return 0;
		}
		return Zotero.DB.valueQueryAsync(sql, ['text/%']);
	};


	/**
	 * Index attachments that have no full-text content yet: extract any with a local file, and
	 * record those with no local file (and therefore no cache) as missing, so they leave the queue
	 * and are left for full-text content or file sync to fill in. Runs alongside the content index
	 * queue, on the same startup/idle/prefs-pane triggers.
	 *
	 * @param {Object} [options]
	 * @param {Integer} [options.maxTime] - Stop after roughly this many ms
	 * @param {Boolean} [options.checkIdle] - Stop as soon as the user is no longer idle
	 * @return {Promise<Integer>} The number of items processed
	 */
	this.processAttachmentExtractionQueue = async function ({ maxTime = null, checkIdle = false } = {}) {
		if (_indexingInProgress) {
			return 0;
		}
		_indexingInProgress = true;
		let start = Date.now();
		let processed = 0;
		try {
			let sql = _attachmentExtractionSQL("itemID");
			// Indexing is turned off entirely (textMaxLength is 0) -- nothing to extract
			if (!sql) {
				return processed;
			}
			while (true) {
				if (Zotero.Sync.Runner.syncInProgress) {
					return processed;
				}
				let itemIDs = await Zotero.DB.columnQueryAsync(
					sql + " AND itemID>? ORDER BY itemID LIMIT 50", ['text/%', _attachmentExtractionQueueCursor]
				);
				if (!itemIDs.length) {
					// Nothing left above the cursor; restart from the beginning to catch anything
					// newly unindexed below it
					if (_attachmentExtractionQueueCursor) {
						_attachmentExtractionQueueCursor = 0;
						continue;
					}
					Zotero.debug("No attachments awaiting full-text extraction");
					return processed;
				}
				Zotero.debug("Extracting full-text content for " + itemIDs.length + " "
					+ Zotero.Utilities.pluralize(itemIDs.length, 'attachment'));
				for (let itemID of itemIDs) {
					if (checkIdle && !_canDrainIndex()) {
						return processed;
					}
					let item = await Zotero.Items.getAsync(itemID);
					if (await item.getFilePathAsync()) {
						await this.indexItems([itemID], { ignoreErrors: true });
						// indexItems() writes nothing when there's no text to index -- an unreadable
						// file, a scanned PDF with no text, or an extraction error. Record an empty
						// entry so the item leaves the queue instead of being retried every pass; it
						// can be reindexed from its context menu or once its file changes.
						if (!(await Zotero.DB.valueQueryAsync(
								"SELECT 1 FROM fulltextItems WHERE itemID=?", itemID))) {
							await recordMissingContent(itemID);
						}
					}
					else {
						// No local file -- and so no cache -- so there's nothing to index. Record it
						// as missing (with an empty index entry, so it leaves both queues); full-text
						// content or file sync will fill it in later.
						await recordMissingContent(itemID);
					}
					processed++;
					// Advance per item, not per batch, since this loop can return mid-batch
					_attachmentExtractionQueueCursor = itemID;
					if (maxTime && (Date.now() - start) >= maxTime) {
						return processed;
					}
				}
			}
		}
		finally {
			_indexingInProgress = false;
		}
	};


	/**
	 * Index an item into the content tables for the queue, recording it in fulltextIndexState.
	 * Normally this reads the item's already-extracted cache file (cheap). If the cache file is
	 * missing but the attachment file is present, it re-extracts from the file instead, which
	 * writes the cache and indexes the content. With no text available at all, the item is still
	 * recorded (with no content) so it leaves the queue; it'll be re-indexed normally if its text
	 * later arrives.
	 */
	// Read an item's already-extracted text for the content index, so the caller can write a
	// batch of items in one transaction. Returns the text to index (possibly ''), or null if the
	// item was re-extracted here (indexItems() already wrote it, so there's nothing to batch).
	async function _readContentForIndex(itemID) {
		try {
			let item = await Zotero.Items.getAsync(itemID);
			if (item && item.isAttachment()) {
				let maxLength = Zotero.Prefs.get('fulltext.textMaxLength');
				let mimeType = item.attachmentContentType;
				// PDFs/EPUBs/HTML keep their extracted text in the cache file; plain-text types are
				// read from the file itself -- same sources findTextInItems() uses
				if (Zotero.FullText.isCachedMIMEType(mimeType)) {
					let cacheFile = Zotero.FullText.getItemCacheFile(item).path;
					if (await OS.File.exists(cacheFile)) {
						return await Zotero.File.getContentsAsync(cacheFile, 'utf-8', maxLength);
					}
					else if (await item.getFilePathAsync()) {
						// Re-extract from the file; indexItems() writes the cache and indexes it
						await Zotero.FullText.indexItems([itemID]);
						return null;
					}
				}
				else if (Zotero.MIME.isTextType(mimeType)) {
					let path = await item.getFilePathAsync();
					if (path) {
						return await Zotero.File.getContentsAsync(path, item.attachmentCharset, maxLength);
					}
				}
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		return '';
	}


	function _isUserIdle() {
		let idleService = Components.classes["@mozilla.org/widget/useridleservice;1"]
			.getService(Components.interfaces.nsIUserIdleService);
		return idleService.idleTime >= _drainIdleDelay * 1000;
	}


	function _isZoteroActive() {
		// Whether the user is currently interacting with a Zotero window, so the DB may be serving
		// their actions. document.hasFocus() is true only when a Zotero window is the focused window
		// of the foreground app, so this is false whenever Zotero is in the background.
		for (let win of Zotero.getMainWindows()) {
			if (win.document && win.document.hasFocus()) {
				return true;
			}
		}
		return false;
	}


	function _canDrainIndex() {
		// Background indexing competes with the user's own queries only through the shared DB
		// connection, so the goal is just to not add latency to their actions: index when Zotero is
		// in the background (their input is going elsewhere) or when it's focused but they've gone
		// idle. Sync is handled separately, in the drain loops.
		return !_isZoteroActive() || _isUserIdle();
	}


	/**
	 * Bring the content index up to date after an upgrade by draining the already-extracted text
	 * into the search index, then hand any never-before-indexed attachments to the idle observer.
	 */
	this.startQueueDrain = async function () {
		if (Zotero.test) return;
		let progressWin;
		let itemProgress;
		let startTime = Date.now();
		try {
			// Restore content search after an upgrade by draining the queue of already-extracted
			// text into the search index. Run this to completion proactively -- not gated on idle
			// like the background work below -- because until it finishes content search is
			// incomplete. Pause for syncs so it doesn't compete with full-text content downloads.
			let total = await this.getAttachmentIndexQueueCount();
			// Items drained so far, tracked across processor calls so the bar can advance after each
			// batch within a call rather than only once per loop iteration
			let done = 0;
			let updateProgress = (n) => {
				if (itemProgress && total > 0) {
					itemProgress.setProgress(Math.min(100, Math.round(n / total * 100)));
				}
			};
			while (true) {
				if (Zotero.Sync.Runner.syncInProgress) {
					await Zotero.Promise.delay(5000);
					continue;
				}
				let remaining = await this.getAttachmentIndexQueueCount();
				if (remaining == 0) {
					break;
				}
				// Run at full speed while the user isn't actively using Zotero (idle or in another
				// app), but yield between slices when they are, so the migration doesn't tie up the
				// shared connection and main thread. It still always runs to completion.
				if (!_canDrainIndex()) {
					await Zotero.Promise.delay(250);
				}
				// Show a progress window once it's clear this will take a moment (like the
				// normalized-column backfill), tracking progress as the queue drains
				if (!progressWin && Date.now() - startTime > 1500) {
					progressWin = new Zotero.ProgressWindow({ closeOnClick: false });
					progressWin.changeHeadline(Zotero.getString('upgrade.status'));
					itemProgress = new progressWin.ItemProgress(
						'journalArticle',
						Zotero.getString('search-normalization-progress-message')
					);
					progressWin.show();
				}
				updateProgress(done);
				let base = done;
				done = base + await this.processAttachmentIndexQueue(
					{ maxTime: 1000, onProgress: n => updateProgress(base + n) }
				);
			}
			if (itemProgress) {
				itemProgress.setProgress(100);
			}
			await this.optimizeContentIndex();
			if (total > 0) {
				Zotero.debug("Indexed " + done + " " + Zotero.Utilities.pluralize(done, 'item')
					+ " for search in " + (Date.now() - startTime) + " ms");
			}
			if (progressWin) {
				progressWin.startCloseTimer(3000);
			}
			// Index never-before-indexed attachments (e.g., added while indexing was off) gently in
			// the background -- they were never searchable, so unlike the migration above they can
			// wait for idle
			if ((await this.getAttachmentIndexQueueCount()) > 0
					|| (await this.getAttachmentExtractionQueueCount()) > 0) {
				this.registerQueueDrainObserver();
			}
		}
		catch (e) {
			Zotero.logError(e);
			if (itemProgress) {
				itemProgress.setError();
			}
		}
	};


	/**
	 * Merge the content index's FTS5 segments into one for faster queries. Called when the content
	 * index queue drains, which can insert a burst of rows that FTS5 leaves as many segments for
	 * searches to merge on the fly; 'optimize' merges them once instead. The trickle of inline
	 * indexing during normal use doesn't need this -- FTS5 auto-merges those incremental writes --
	 * and the extracted text lives in the cache files regardless, so a failure here is harmless.
	 */
	this.optimizeContentIndex = async function () {
		try {
			await Zotero.DB.queryAsync(
				"INSERT INTO ftindex.fulltextContent(fulltextContent) VALUES('optimize')"
			);
			await Zotero.DB.queryAsync(
				"INSERT INTO ftindex.fulltextContentCJK(fulltextContentCJK) VALUES('optimize')"
			);
		}
		catch (e) {
			Zotero.logError(e);
		}
	};


	/**
	 * Reclaim disk space in the content index. The FTS5 tables reuse freed pages but never return
	 * them to the OS, so a large drop in indexed content (e.g., adding and then deleting many
	 * items) can leave fulltext.sqlite much bigger than its contents. The main database vacuum
	 * covers only the main database, so the attached content index is vacuumed here. Like that
	 * vacuum, this is gated on the freelist threshold, which makes it self-throttling: a vacuum
	 * empties the freelist, so it won't run again until content drops substantially. Called from
	 * the idle maintenance pass; pass force to skip the checks (e.g., from tests).
	 *
	 * @param {Object} [options]
	 * @param {Boolean} [options.force] - Skip the freelist and disk-space checks
	 * @return {Promise<Boolean>} - Whether the index was vacuumed
	 */
	this.vacuumContentIndex = async function ({ force = false } = {}) {
		if (!force) {
			let freelistCount = await Zotero.DB.valueQueryAsync("PRAGMA ftindex.freelist_count");
			let pageCount = await Zotero.DB.valueQueryAsync("PRAGMA ftindex.page_count");
			let threshold = Zotero.Prefs.get('vacuum.freelistThreshold') || 10;
			if (!(pageCount > 0) || (freelistCount / pageCount * 100) < threshold) {
				return false;
			}
			// In-place VACUUM needs temporary space roughly the size of the database
			let path = Zotero.DataDirectory.getDatabase('fulltext');
			let size = (await IOUtils.stat(path)).size;
			if (Zotero.File.pathToFile(path).diskSpaceAvailable < size) {
				Zotero.debug("Not enough disk space to vacuum full-text content index -- skipping");
				return false;
			}
		}
		Zotero.debug("Vacuuming full-text content index");
		let t = new Date();
		await Zotero.DB.queryAsync("VACUUM ftindex");
		Zotero.debug("Vacuumed full-text content index in " + (new Date() - t) + " ms");
		return true;
	};


	this.registerQueueDrainObserver = function () {
		if (Zotero.test) return;
		if (_queueDrainTimerID) {
			return;
		}
		Zotero.debug("Starting full-text content index queue processor");
		_scheduleQueueDrain(_drainIdleDelay * 1000);
	};


	this.unregisterQueueDrainObserver = function () {
		if (_queueDrainTimerID) {
			clearTimeout(_queueDrainTimerID);
			_queueDrainTimerID = null;
		}
	};


	// Drain the content and unindexed-item queues in the background on a self-rescheduling timer.
	// Unlike an OS idle observer, this keeps making progress while Zotero is in the background and
	// the user works in other apps, and it backs off the moment they return to Zotero.
	function _scheduleQueueDrain(delay) {
		_queueDrainTimerID = setTimeout(async () => {
			_queueDrainTimerID = null;
			let self = Zotero.FullText;
			try {
				if (!_canDrainIndex() || Zotero.Sync.Runner.syncInProgress) {
					_scheduleQueueDrain(_drainIdleDelay * 1000);
					return;
				}
				if ((await self.getAttachmentIndexQueueCount()) == 0
						&& (await self.getAttachmentExtractionQueueCount()) == 0) {
					// Drained -- compact the index and stop
					await self.optimizeContentIndex();
					return;
				}
				Zotero.debug("Processing full-text index queues in the background ("
					+ (_isZoteroActive() ? "focused but idle" : "not focused") + ")");
				await self.processAttachmentIndexQueue({ maxTime: 1000, checkIdle: true });
				await self.processAttachmentExtractionQueue({ maxTime: 1000, checkIdle: true });
				_scheduleQueueDrain(250);
			}
			catch (e) {
				// Stop on error instead of retrying, so a persistent failure (e.g., a full disk)
				// doesn't spin. The drain starts again on the next trigger, such as a restart or a
				// newly queued item.
				Zotero.logError(e);
			}
		}, delay);
	}


	
	/**
	 * @param {Number} itemID
	 * @return {Promise<Boolean>}
	 */
	this.indexSyncedContent = async function (itemID) {
		try {
			var item = await Zotero.Items.getAsync(itemID);
			var cacheFile = this.getSyncedContentCacheFile(item).path;
			if (!((await OS.File.exists(cacheFile))))  {
				Zotero.debug("Full-text content processor cache file doesn't exist for item " + itemID);
				await Zotero.DB.queryAsync(
					"UPDATE fulltextItems SET synced=? WHERE itemID=?",
					[this.SYNC_STATE_UNSYNCED, itemID]
				);
				return false;
			}
			
			var json = await Zotero.File.getContentsAsync(cacheFile);
			var data = JSON.parse(json);
			
			// Write the text content to the regular cache file
			var item = await Zotero.Items.getAsync(itemID);
			cacheFile = this.getItemCacheFile(item).path;
			Zotero.debug("Writing full-text content to " + cacheFile);
			await Zotero.File.putContentsAsync(cacheFile, data.text);
			
			await indexString(
				data.text,
				itemID,
				{
					indexedChars: data.indexedChars,
					totalChars: data.totalChars,
					indexedPages: data.indexedPages,
					totalPages: data.totalPages
				},
				data.version,
				this.SYNC_STATE_IN_SYNC
			);
			
			return true;
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		};
	};
	
	//
	// End full-text content syncing
	//
	
	
	/*
	 * Scan a string for another string
	 *
	 * _items_ -- one or more attachment items to search
	 * _searchText_ -- text pattern to search for
	 * _mode_:
	 *    'regexp' -- regular expression (case-insensitive)
	 *    'regexpCS' -- regular expression (case-sensitive)
	 *
	 * - Slashes in regex are optional
	 */
	function findTextInString(content, searchText, mode) {
		switch (mode){
			case 'regexp':
			case 'regexpCS':
			case 'regexpBinary':
			case 'regexpCSBinary':
				// Do a multiline search by default
				var flags = 'm';
				var parts = searchText.match(/^\/(.*)\/([^\/]*)/);
				if (parts){
					searchText = parts[1];
					// Ignore user-supplied flags
					//flags = parts[2];
				}
				
				if (mode.indexOf('regexpCS')==-1){
					flags += 'i';
				}
				
				try {
					var re = new RegExp(searchText, flags);
					var matches = re.exec(content);
				}
				catch (e) {
					Zotero.debug(e, 1);
					Components.utils.reportError(e);
				}
				if (matches){
					Zotero.debug("Text found");
					return true;
				}

				break;

			default:
				// Case- and diacritic-insensitive, to match the content index (findItemsWithContent)
				searchText = Zotero.Utilities.Internal.normalizeForSearch(searchText);
				content = Zotero.Utilities.Internal.normalizeForSearch(content);
				if (content.includes(searchText)){
					Zotero.debug('Text found');
					return true;
				}
		}

		return false;
	}
	
	/**
	 * Scan item files for a text string
	 *
	 * _items_ -- one or more attachment items to search
	 * _searchText_ -- text pattern to search for
	 * _mode_:
	 *    'phrase'
	 *    'regexp'
	 *    'regexpCS' -- case-sensitive regular expression
	 *
	 * Note:
	 *  - Slashes in regex are optional
	 *  - Add 'Binary' to the mode to search all files, not just text files
	 *
	 * @return {Promise<Array<Object>>} A promise for an array of objects with an 'id' property
	 *                                  containing the itemID of each matching item
	 */
	// CJK scripts (Han/Hiragana/Katakana/Hangul) -- indexed as 2-grams rather than 3-grams,
	// since CJK queries are commonly 1-2 characters
	const _cjkCharRE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
	const _cjkRunRE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu;

	/**
	 * Build a space-separated list of overlapping 2-grams of the CJK runs in `text`, for the
	 * ascii-tokenized CJK index. Only CJK characters are bigrammed -- everything else is handled
	 * by the trigram index -- so non-CJK text produces an empty string.
	 *
	 * @param {String} text - Normalized text (via normalizeForSearch)
	 * @return {String}
	 */
	function getCJKBigrams(text) {
		if (!text) {
			return '';
		}
		let bigrams = [];
		for (let match of text.matchAll(_cjkRunRE)) {
			let run = match[0];
			for (let i = 0; i < run.length - 1; i++) {
				bigrams.push(run.substr(i, 2));
			}
		}
		return bigrams.join(' ');
	}


	/**
	 * Index an item's extracted text into the content FTS5 tables and record it in the index-state
	 * table at the current version. Replaces any existing entries for the item. `text` may be empty
	 * (e.g., no cache file), in which case the item is simply recorded as indexed with no content.
	 *
	 * Must be called within a transaction.
	 */
	async function setContentIndex(itemID, text) {
		await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContent WHERE rowid=?", itemID);
		await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContentCJK WHERE rowid=?", itemID);
		if (text) {
			// Skip logging the params, which includes the full text
			let normalized = Zotero.Utilities.Internal.normalizeForSearch(text) || '';
			await Zotero.DB.queryAsync(
				"INSERT INTO ftindex.fulltextContent (rowid, text) VALUES (?, ?)",
				[itemID, normalized],
				{ debugParams: false }
			);
			let cjk = getCJKBigrams(normalized);
			if (cjk) {
				await Zotero.DB.queryAsync(
					"INSERT INTO ftindex.fulltextContentCJK (rowid, text) VALUES (?, ?)",
					[itemID, cjk],
					{ debugParams: false }
				);
			}
		}
		await Zotero.DB.queryAsync(
			"REPLACE INTO ftindex.fulltextIndexState (itemID, version) VALUES (?, ?)",
			[itemID, _contentIndexVersion]
		);
	}


	/**
	 * Remove an item's entries from the content FTS5 tables and the index-state table.
	 *
	 * Must be called within a transaction.
	 */
	async function clearContentIndex(itemID) {
		await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContent WHERE rowid=?", itemID);
		await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContentCJK WHERE rowid=?", itemID);
		await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextIndexState WHERE itemID=?", itemID);
	}


	/**
	 * Resolve a search term to the FTS5 table and MATCH expression that find it as a substring
	 * (case- and diacritic-insensitively, via normalizeForSearch): the trigram index for Latin,
	 * the 2-gram index for pure CJK. Returns null when the index can't answer the term -- too short
	 * for the trigram index, or a mix of CJK and non-CJK that neither index covers alone.
	 *
	 * @return {Object|null} { table, match } or null
	 */
	function getContentMatchClause(searchText) {
		let normalized = Zotero.Utilities.Internal.normalizeForSearch(searchText);
		if (!normalized) {
			return null;
		}
		let hasCJK = _cjkCharRE.test(normalized);
		let hasNonCJK = /[a-z0-9]/.test(normalized);
		// Pure CJK: match the term's 2-grams as a contiguous phrase against the CJK index
		if (hasCJK && !hasNonCJK) {
			let bigrams = getCJKBigrams(normalized);
			// A single CJK character has no 2-gram
			if (!bigrams) {
				return null;
			}
			return { table: 'fulltextContentCJK', match: '"' + bigrams + '"' };
		}
		// Pure non-CJK: match the whole term as a contiguous phrase (substring) against the
		// trigram index, which only indexes runs of 3+ characters
		if (!hasCJK && normalized.length >= 3) {
			return { table: 'fulltextContent', match: '"' + normalized.replace(/"/g, '""') + '"' };
		}
		return null;
	}


	/**
	 * Whether a term can be matched against the content index rather than needing a fallback scan
	 * of the cached text. Quick search uses this to skip content matching for terms too short for
	 * the index, avoiding a per-keystroke scan.
	 *
	 * @param {String} searchText
	 * @return {Boolean}
	 */
	this.canSearchContent = function (searchText) {
		return getContentMatchClause(searchText) !== null;
	};


	/**
	 * Return the ids of attachment items in the given library whose full-text content contains
	 * `searchText` as a substring. This is the non-regexp path for the 'fulltextContent' search
	 * condition; callers intersect the result with their own scope/result sets.
	 *
	 * Returns null when the term can't be answered from the index (see getContentMatchClause), so
	 * the caller can fall back to scanning the cached text.
	 *
	 * @param {String} searchText
	 * @param {Integer|null} [libraryID] - Restrict to this library, or null/undefined for all
	 * @return {Promise<Integer[]|null>}
	 */
	this.findItemsWithContent = async function (searchText, libraryID) {
		let clause = getContentMatchClause(searchText);
		if (!clause) {
			return null;
		}
		let sql = "SELECT C.rowid FROM ftindex." + clause.table + " C JOIN items I ON (I.itemID = C.rowid) "
			+ "WHERE C." + clause.table + " MATCH ?";
		let params = [clause.match];
		if (libraryID !== null && libraryID !== undefined) {
			sql += " AND I.libraryID=?";
			params.push(libraryID);
		}
		return Zotero.DB.columnQueryAsync(sql, params);
	};


	/**
	 * A subquery selecting the itemIDs whose full-text content matches `searchText` as a substring
	 * via the content index, for embedding directly in a search's SQL (e.g. `itemID IN (<subquery>)`)
	 * rather than materializing every match into an itemID list. The caller applies the surrounding
	 * scope and the IN/NOT IN for the operator.
	 *
	 * Returns null when the term can't be answered from the index (see getContentMatchClause), so
	 * the caller can fall back to scanning the cached text.
	 *
	 * @param {String} searchText
	 * @return {Object|null} { sql, params }
	 */
	this.getContentSearchSQL = function (searchText) {
		let clause = getContentMatchClause(searchText);
		if (!clause) {
			return null;
		}
		return {
			sql: "SELECT rowid FROM ftindex." + clause.table + " WHERE " + clause.table + " MATCH ?",
			params: [clause.match]
		};
	};


	this.findTextInItems = async function (items, searchText, mode) {
		if (!searchText){
			return [];
		}
		
		var items = await Zotero.Items.getAsync(items);
		var found = [];
		
		for (let i=0; i<items.length; i++) {
			let item = items[i];
			if (!item.isAttachment()) {
				continue;
			}
			
			let itemID = item.id;
			let content;
			let mimeType = item.attachmentContentType;
			let maxLength = Zotero.Prefs.get('fulltext.textMaxLength');
			let binaryMode = mode && mode.indexOf('Binary') != -1;
			
			if (this.isCachedMIMEType(mimeType)) {
				let file = this.getItemCacheFile(item).path;
				if (!((await OS.File.exists(file)))) {
					Zotero.debug("No cache file at " + file, 2);
					// TODO: Index on-demand?
					// What about a cleared full-text index?
					continue;
				}
				
				Zotero.debug("Searching for text '" + searchText + "' in " + file);
				content = await Zotero.File.getContentsAsync(file, 'utf-8', maxLength);
			}
			else {
				// If not binary mode, only scan plaintext files
				if (!binaryMode) {
					if (!Zotero.MIME.isTextType(mimeType)) {
						Zotero.debug('Not scanning MIME type ' + mimeType, 4);
						continue;
					}
				}
				
				let path = await item.getFilePathAsync();
				if (!path) {
					continue;
				}
				
				Zotero.debug("Searching for text '" + searchText + "' in " + path);
				content = await Zotero.File.getContentsAsync(path, item.attachmentCharset, maxLength);
			}
			
			if (findTextInString(content, searchText, mode)) {
				found.push({ id: itemID });
			}
		}
		
		return found;
	};
	
	
	this.transferItemIndex = async function (fromItem, toItem) {
		await this.clearItemWords(toItem.id);
		
		// Copy cache file if it exists
		var cacheFile = this.getItemCacheFile(fromItem).path;
		if (await OS.File.exists(cacheFile)) {
			try {
				await OS.File.move(cacheFile, this.getItemCacheFile(toItem).path);
			}
			catch (e) {
				Zotero.logError(e);
				return;
			}
		}
		
		// Update database with new item id
		await Zotero.DB.queryAsync("PRAGMA foreign_keys = false");
		try {
			await Zotero.DB.queryAsync(
				"UPDATE fulltextItems SET itemID=? WHERE itemID=?",
				[toItem.id, fromItem.id]
			);
		}
		catch (e) {
			await Zotero.DB.queryAsync("PRAGMA foreign_keys = true");
		}
		// The content index is keyed by rowid and can't be re-keyed in place, so drop the source
		// item's now-orphaned entry; toItem has the moved fulltextItems row but no index entry, so
		// the queue will re-index it from the moved cache file.
		await clearContentIndex(fromItem.id);
	};
	
	
	/**
	 * @requireTransaction
	 */
	this.clearItemWords = async function (itemID, skipCacheClear) {
		Zotero.DB.requireTransaction();
		
		var sql = "SELECT rowid FROM fulltextItems WHERE itemID=? LIMIT 1";
		var indexed = await Zotero.DB.valueQueryAsync(sql, itemID);
		if (indexed) {
			await Zotero.DB.queryAsync("DELETE FROM fulltextItems WHERE itemID=?", itemID);
		}
		// Remove the content index entries too (the content DB can't FK-cascade to zotero.sqlite)
		await clearContentIndex(itemID);

		if (!skipCacheClear) {
			// Delete fulltext cache file if there is one
			await clearCacheFile(itemID);
		}
	};
	
	
	/**
	 * @return {Promise}
	 */
	this.getPages = function (itemID) {
		var sql = "SELECT indexedPages, totalPages AS total "
			+ "FROM fulltextItems WHERE itemID=?";
		return Zotero.DB.rowQueryAsync(sql, itemID);
	}


	/**
	 * @return {Promise}
	 */
	function getChars(itemID) {
		var sql = "SELECT indexedChars, totalChars AS total "
			+ "FROM fulltextItems WHERE itemID=?";
		return Zotero.DB.rowQueryAsync(sql, itemID);
	}
	
	
	/**
	 * Gets the number of characters from the PDF converter cache file
	 *
	 * @return {Promise}
	 */
	var getTotalCharsFromFile = async function (itemID) {
		var item = await Zotero.Items.getAsync(itemID);
		switch (item.attachmentContentType) {
			case 'application/pdf':
				var file = OS.Path.join(
					Zotero.Attachments.getStorageDirectory(item).path,
					this.fulltextCacheFile
				);
				if (!((await OS.File.exists(file)))) {
					return false;
				}
				break;
				
			default:
				var file = await item.getFilePathAsync();
				if (!file) {
					return false;
				}
		}
		
		var contents = await Zotero.File.getContentsAsync(file);
		return contents.length;
	};
	
	
	/**
	 * @return {Promise}
	 */
	function setPages(itemID, obj) {
		var sql = "UPDATE fulltextItems SET indexedPages=?, totalPages=? WHERE itemID=?";
		return Zotero.DB.queryAsync(
			sql,
			[
				obj.indexed ? parseInt(obj.indexed) : null,
				obj.total ? parseInt(obj.total) : null,
				itemID
			]
		);
	}
	
	
	/**
	 * @param {Number} itemID
	 * @param {Object} obj
	 * @return {Promise}
	 */
	function setChars(itemID, obj) {
		var sql = "UPDATE fulltextItems SET indexedChars=?, totalChars=? WHERE itemID=?";
		return Zotero.DB.queryAsync(
			sql,
			[
				obj.indexed ? parseInt(obj.indexed) : null,
				obj.total ? parseInt(obj.total) : null,
				itemID
			]
		);
	}
	
	
	/*
	 * Gets the indexed state of an item, 
	 */
	this.getIndexedState = async function (item) {
		if (!item.isAttachment()) {
			throw new Error('Item is not an attachment');
		}
		
		// If the file or cache file wasn't available during syncing, mark as unindexed
		var synced = await Zotero.DB.valueQueryAsync(
			"SELECT synced FROM fulltextItems WHERE itemID=?", item.id
		);
		if (synced === false || synced == this.SYNC_STATE_MISSING) {
			return this.INDEX_STATE_UNINDEXED;
		}
		
		var itemID = item.id;
		var state = this.INDEX_STATE_UNINDEXED;
		switch (item.attachmentContentType) {
			// Use pages for PDFs
			case 'application/pdf':
				var o = await this.getPages(itemID);
				if (o) {
					var stats = {
						indexed: o.indexedPages,
						total: o.total
					};
				}
				break;
			
			default:
				var o = await getChars(itemID);
				if (o) {
					var stats = {
						indexed: o.indexedChars,
						total: o.total
					};
				}
		}
		
		if (stats) {
			if (!stats.total && !stats.indexed) {
				let queued = false;
				try {
					queued = await OS.File.exists(this.getSyncedContentCacheFile(item).path);
				}
				catch (e) {
					Zotero.logError(e);
				}
				state = queued ? this.INDEX_STATE_QUEUED : this.INDEX_STATE_UNAVAILABLE;
			}
			else if (!stats.indexed) {
				state = this.INDEX_STATE_UNINDEXED;
			}
			else if (stats.indexed < stats.total) {
				state = this.INDEX_STATE_PARTIAL;
			}
			else {
				state = this.INDEX_STATE_INDEXED;
			}
		}
		return state;
	};
	
	
	this.isFullyIndexed = async function (item) {
		return ((await this.getIndexedState(item))) == this.INDEX_STATE_INDEXED;
	};
	
	
	/**
	 * @return {Promise}
	 */
	this.getIndexStats = async function () {
		// Indexed/Partial count items actually in the search index at the current version (joined to
		// fulltextIndexState), so they reflect what's searchable rather than just extracted -- which
		// keeps them disjoint from the backfill still in progress (remaining) and makes their sum the
		// bar's numerator
		var sql = "SELECT COUNT(*) FROM fulltextItems FI "
			+ "JOIN ftindex.fulltextIndexState S USING (itemID) "
			+ "WHERE S.version >= ? AND FI.synced != ? AND "
			+ "((indexedPages IS NOT NULL AND indexedPages=totalPages) OR "
			+ "(indexedChars IS NOT NULL AND indexedChars=totalChars))";
		var indexed = await Zotero.DB.valueQueryAsync(sql, [_contentIndexVersion, this.SYNC_STATE_MISSING]);

		var sql = "SELECT COUNT(*) FROM fulltextItems FI "
			+ "JOIN ftindex.fulltextIndexState S USING (itemID) "
			+ "WHERE S.version >= ? AND "
			+ "((indexedPages IS NOT NULL AND indexedPages<totalPages) OR "
			+ "(indexedChars IS NOT NULL AND indexedChars<totalChars))";
		var partial = await Zotero.DB.valueQueryAsync(sql, _contentIndexVersion);
		
		// Items with neither a local file nor full-text content (so nothing to index locally),
		// recorded as missing -- shown as such rather than as a fixable "not indexed" count
		var sql = "SELECT COUNT(*) FROM fulltextItems WHERE synced = ?";
		var notAvailable = await Zotero.DB.valueQueryAsync(sql, this.SYNC_STATE_MISSING);

		// Pending work, both auto-draining: items with extracted content not yet in the search index
		// (remaining) and indexable attachments not yet extracted (unindexedQueue)
		var remaining = await this.getAttachmentIndexQueueCount();
		var unindexedQueue = await this.getAttachmentExtractionQueueCount();

		return { indexed, partial, notAvailable, remaining, unindexedQueue };
	};
	
	
	this.getItemCacheFile = function (item) {
		var cacheFile = Zotero.Attachments.getStorageDirectory(item);
		cacheFile.append(this.fulltextCacheFile);
		return cacheFile;
	}
	
	
	this.getSyncedContentCacheFile = function (item) {
		var cacheFile = Zotero.Attachments.getStorageDirectory(item);
		cacheFile.append(_processorCacheFile);
		return cacheFile;
	}
	
	
	this.canIndex = function (item) {
		if (!item.isAttachment()
				|| item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
			return false;
		}
		var contentType = item.attachmentContentType;
		return contentType
			&& (contentType == 'application/pdf'
				|| contentType == 'application/epub+zip'
				|| Zotero.MIME.isTextType(contentType));
	};
	
	
	/*
	 * Returns true if an item can be reindexed
	 *
	 * Item must be a non-web-link attachment that isn't already fully indexed
	 */
	this.canReindex = async function (item) {
		if (!this.canIndex(item)) {
			return false;
		}
		switch (await this.getIndexedState(item)) {
			case this.INDEX_STATE_UNAVAILABLE:
			case this.INDEX_STATE_UNINDEXED:
			case this.INDEX_STATE_PARTIAL:
			case this.INDEX_STATE_QUEUED:
			// TODO: automatically reindex already-indexed attachments?
			case this.INDEX_STATE_INDEXED:
				return true;
		}
		return false;
	};
	
	
	/**
	 * @return {Promise}
	 */
	this.rebuildIndex = async function (unindexedOnly) {
		// Get all attachments other than web links
		var sql = "SELECT itemID FROM itemAttachments WHERE linkMode!="
			+ Zotero.Attachments.LINK_MODE_LINKED_URL;
		var params = [];
		if (unindexedOnly) {
			sql += " AND itemID NOT IN (SELECT itemID FROM fulltextItems "
				+ "WHERE synced != ? AND (indexedChars IS NOT NULL OR indexedPages IS NOT NULL))";
			params.push(this.SYNC_STATE_MISSING);
		}
		var itemIDs = await Zotero.DB.columnQueryAsync(sql, params);
		if (!itemIDs.length) {
			Zotero.debug("No items to index");
			return;
		}
		
		// If rebuilding from scratch, delete any processor cache files so they're not used.
		// Otherwise, indexing unindexed items will force indexing of processor cache files
		// without waiting for idle processing.
		if (!unindexedOnly) {
			for (let itemID of itemIDs) {
				let item = await Zotero.Items.getAsync(itemID);
				let cacheFile = this.getSyncedContentCacheFile(item).path;
				try {
					await OS.File.remove(cacheFile, { ignoreAbsent: true });
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
		}
		
		await this.indexItems(itemIDs, { ignoreErrors: true });
	};


	/**
	 * Re-extract items whose content was truncated by a lower full-text limit, after that limit is
	 * raised. Only the affected items are re-indexed, so raising a limit doesn't force a blanket
	 * rebuild-and-reupload of everything. Items truncated by the character limit and the page limit
	 * are tracked separately, via indexedChars/totalChars and indexedPages/totalPages.
	 *
	 * @param {String} type - 'chars' or 'pages'
	 * @param {Integer} newLimit - The limit's new value
	 * @return {Promise}
	 */
	this.reindexTruncated = async function (type, newLimit) {
		newLimit = parseInt(newLimit);
		// 0 (or invalid) means "don't index", which is handled at index time -- nothing to re-extract
		if (!(newLimit > 0)) {
			return;
		}
		// Items that were truncated (more content exists than was indexed) and that the higher limit
		// would actually extend (the old ceiling was below the new one)
		var sql = type == 'chars'
			? "SELECT itemID FROM fulltextItems "
				+ "WHERE indexedChars IS NOT NULL AND indexedChars < totalChars AND indexedChars < ?"
			: "SELECT itemID FROM fulltextItems "
				+ "WHERE indexedPages IS NOT NULL AND indexedPages < totalPages AND indexedPages < ?";
		var itemIDs = await Zotero.DB.columnQueryAsync(sql, [newLimit]);
		if (!itemIDs.length) {
			return;
		}
		Zotero.debug(`Re-extracting ${itemIDs.length} `
			+ `${Zotero.Utilities.pluralize(itemIDs.length, 'item')} truncated below the new full-text `
			+ (type == 'chars' ? 'character' : 'page') + ' limit');
		await this.indexItems(itemIDs, { ignoreErrors: true });
	};


	/**
	 * Clears the full-text index and all full-text cache files
	 *
	 * @return {Promise}
	 */
	this.clearIndex = async function () {
		await Zotero.DB.executeTransaction(async function () {
			await Zotero.DB.queryAsync("DELETE FROM fulltextItems");

			// Drop content index entries for items no longer in fulltextItems
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContent "
				+ "WHERE rowid NOT IN (SELECT itemID FROM fulltextItems)");
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContentCJK "
				+ "WHERE rowid NOT IN (SELECT itemID FROM fulltextItems)");
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextIndexState "
				+ "WHERE itemID NOT IN (SELECT itemID FROM fulltextItems)");
		});

		await clearCacheFiles();
	}


	/**
	 * Remove content index entries for items that no longer exist. Normal deletion clears these
	 * via clearItemWords(), but the content database can't FK-cascade to zotero.sqlite, so this is
	 * a periodic safety net for items removed through a path that bypassed Item.erase().
	 *
	 * @return {Promise}
	 */
	this.purgeOrphanedContent = async function () {
		await Zotero.DB.executeTransaction(async function () {
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContent "
				+ "WHERE rowid NOT IN (SELECT itemID FROM fulltextItems)");
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextContentCJK "
				+ "WHERE rowid NOT IN (SELECT itemID FROM fulltextItems)");
			await Zotero.DB.queryAsync("DELETE FROM ftindex.fulltextIndexState "
				+ "WHERE itemID NOT IN (SELECT itemID FROM fulltextItems)");
		});
	};


	/*
	 * Clears cache file for an item
	 */
	var clearCacheFile = async function (itemID) {
		var item = await Zotero.Items.getAsync(itemID);
		if (!item) {
			return;
		}
		
		if (!item.isAttachment()) {
			Zotero.debug("Item " + itemID + " is not an attachment in Zotero.Fulltext.clearCacheFile()");
			return;
		}
		
		Zotero.debug('Clearing full-text cache file for item ' + itemID);
		var cacheFile = Zotero.Fulltext.getItemCacheFile(item);
		if (cacheFile.exists()) {
			try {
				cacheFile.remove(false);
			}
			catch (e) {
				Zotero.File.checkFileAccessError(e, cacheFile, 'delete');
			}
		}
	};
	
	
	/*
	 * Clear cache files for all attachments
	 */
	var clearCacheFiles = async function () {
		var sql = "SELECT itemID FROM itemAttachments";
		var items = await Zotero.DB.columnQueryAsync(sql);
		for (var i=0; i<items.length; i++) {
			await clearCacheFile(items[i]);
		}
	};
	
	
	/*
	function clearItemContent(itemID){
		Zotero.DB.query("DELETE FROM fulltextContent WHERE itemID=" + itemID);
	}
	*/
	
	
	async function getPageData(path, contentType) {
		const { HiddenBrowser } = ChromeUtils.importESModule("chrome://zotero/content/HiddenBrowser.mjs");
		var blobURL;
		var browser;
		var pageData;
		try {
			// Wrap the file in a blob to set its content type
			let arrayBuffer = await (await fetch(Zotero.File.pathToFileURI(path))).arrayBuffer();
			let blob = new Blob([arrayBuffer], { type: contentType });
			blobURL = URL.createObjectURL(blob);
			browser = new HiddenBrowser({ blockRemoteResources: true });
			await browser.load(blobURL);
			pageData = await browser.getPageData(['characterSet', 'bodyText']);
		}
		finally {
			if (blobURL) {
				URL.revokeObjectURL(blobURL);
			}
			if (browser) {
				browser.destroy();
			}
		}
		return {
			characterSet: pageData.characterSet,
			bodyText: pageData.bodyText
		};
	}
	
	
	/**
	 * Write the converted text to a cache file
	 */
	var writeCacheFile = async function (item, text, maxLength, complete) {
		if (!complete) {
			text = text.substr(0, maxLength);
		}
		var cacheFile = this.getItemCacheFile(item).path;
		Zotero.debug("Writing converted full-text content to " + cacheFile);
		if (!(await OS.File.exists(PathUtils.parent(cacheFile)))) {
			await Zotero.Attachments.createDirectoryForItem(item);
		}
		try {
			await Zotero.File.putContentsAsync(cacheFile, text);
		}
		catch (e) {
			Zotero.logError(e);
		}
	}.bind(this);
	
	
	/**
	 * @param {String} text
	 * @param {String} [charset]
	 * @return {Array<String>}
	 */
	this.semanticSplitter = function (text, charset) {
		if (!text){
			Zotero.debug('No text to index');
			return [];
		}
		
		var words = {};
		var word = '';
		var cclass = null;
		var strlen = text.length;
		for (var i = 0; i < strlen; i++) {
			var charCode = text.charCodeAt(i);
			var cc = null;
			
			// Adjustments
			if (charCode == 8216 || charCode == 8217) {
				// Curly quotes to straight
				var c = "'";
			}
			else {
				var c = text.charAt(i);
			}
			
			// Consider single quote in the middle of a word a letter
			if (c == "'" && word !== '') {
				cc = kWbClassAlphaLetter;
			}
			
			if (!cc) {
				cc = getClass(c, charCode);
			}
			
			// When we reach space or punctuation, store the previous word if there is one
			if (cc == kWbClassSpace || cc == kWbClassPunct) {
				if (word != '') {
					words[word] = true;
					word = '';
				}
			// When we reach Han character, store previous word and add Han character
			} else if (cc == kWbClassHanLetter) {
				if (word !== '') {
					words[word] = true;
					word = '';
				}
				words[c] = true;
			// Otherwise, if character class hasn't changed, keep adding characters to previous word
			} else if (cc == cclass) {
				word += c.toLowerCase();
			// If character class is different, store previous word and start new word
			} else {
				if (word !== '') {
					words[word] = true;
				}
				word = c.toLowerCase();
			}
			cclass = cc;
		}
		if (word !== '') {
			words[word] = true;
		}
		
		return Object.keys(words).map(function (w) {
			// Trim trailing single quotes
			if (w.slice(-1) == "'") {
				w = w.substr(0, w.length - 1);
			}
			return w;
		});
	}
	
	function _getScriptExtension() {
		return Zotero.isWin ? 'vbs' : 'sh';
	}

}
