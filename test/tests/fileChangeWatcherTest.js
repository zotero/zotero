describe("Zotero.Sync.Storage.FileChangeWatcher", function () {
	let watcher = Zotero.Sync.Storage.FileChangeWatcher;

	// Pref keys used by the watcher
	let PREF_FSEVENTS_EVENT_ID = "sync.storage.watcher.fsEventsEventID";
	let PREF_FSEVENTS_STORAGE_PATH = "sync.storage.watcher.fsEventsStoragePath";

	function clearWatcherPrefs() {
		Zotero.Prefs.clear(PREF_FSEVENTS_EVENT_ID);
		Zotero.Prefs.clear(PREF_FSEVENTS_STORAGE_PATH);
	}

	// The Set returned by getChangedItemKeys() is created in the XPCOM
	// context, so instanceof Set doesn't work across contexts. Use
	// duck-typing instead.
	function assertIsSet(val, msg) {
		assert.isNotNull(val, msg);
		assert.isFunction(val.has, msg);
		assert.isNumber(val.size, msg);
	}

	describe("FSEvents backend (macOS)", function () {
		before(async function () {
			if (!Zotero.isMac) {
				this.skip();
			}
			// Ensure the storage directory exists (it may not yet in
			// the test environment)
			let storageDir = PathUtils.join(
				Zotero.DataDirectory.dir, "storage"
			);
			await IOUtils.makeDirectory(storageDir, {
				ignoreExisting: true
			});
			// Close any watcher initialized at startup
			watcher.close();
			clearWatcherPrefs();
		});

		afterEach(function () {
			watcher.close();
			clearWatcherPrefs();
		});

		after(function () {
			// Re-init the watcher so it's available for normal operation
			// after the test suite
			watcher.init();
		});

		it("should initialize successfully", function () {
			watcher.init();
			assert.isTrue(watcher.available);
			assert.equal(watcher._backend, 'fsevents');
			assert.ok(watcher._storageRoot, "Storage root should be set");
		});

		it("should return null on first call with no saved event ID", function () {
			watcher.init();
			let result = watcher.getChangedItemKeys();
			assert.isNull(result, "First call should return null");
			// Should have saved a baseline event ID
			let savedId = Zotero.Prefs.get(PREF_FSEVENTS_EVENT_ID);
			assert.isString(savedId);
			assert.notEqual(savedId, "0");
		});

		it("should return an empty set when no files have changed", function () {
			watcher.init();
			// Establish baseline
			watcher.getChangedItemKeys();

			// Second call -- no changes
			let result = watcher.getChangedItemKeys();
			assertIsSet(result);
			assert.equal(result.size, 0);
		});

		it("should detect a modified attachment file", async function () {
			this.timeout(15000);

			let item = await importFileAttachment('test.png');

			try {
				watcher.init();
				// Establish baseline
				watcher.getChangedItemKeys();

				// Modify the file
				let path = await item.getFilePathAsync();
				await Zotero.File.putContentsAsync(
					path, Zotero.Utilities.randomString()
				);

				// Wait for FSEvents to register
				await Zotero.Promise.delay(1000);

				let result = watcher.getChangedItemKeys();
				assertIsSet(result);
				assert.isTrue(
					result.has(item.key),
					"Should contain the key of the modified item"
				);
			}
			finally {
				await item.eraseTx();
			}
		});

		it("should detect changes across multiple items", async function () {
			this.timeout(15000);

			let item1 = await importFileAttachment('test.png');
			let item2 = await importTextAttachment();
			let item3 = await importFileAttachment('test.png');

			try {
				watcher.init();
				// Wait for FSEvents from item creation to flush
				// before establishing baseline
				await Zotero.Promise.delay(1000);
				watcher.getChangedItemKeys();

				// Modify only items 1 and 3
				let path1 = await item1.getFilePathAsync();
				await Zotero.File.putContentsAsync(
					path1, Zotero.Utilities.randomString()
				);
				let path3 = await item3.getFilePathAsync();
				await Zotero.File.putContentsAsync(
					path3, Zotero.Utilities.randomString()
				);

				await Zotero.Promise.delay(1000);

				let result = watcher.getChangedItemKeys();
				assertIsSet(result);
				assert.isTrue(result.has(item1.key),
					"Should contain key of first modified item");
				assert.isFalse(result.has(item2.key),
					"Should not contain key of unmodified item");
				assert.isTrue(result.has(item3.key),
					"Should contain key of second modified item");
			}
			finally {
				await item1.eraseTx();
				await item2.eraseTx();
				await item3.eraseTx();
			}
		});

		it("should not report the same changes twice", async function () {
			this.timeout(15000);

			let item = await importFileAttachment('test.png');

			try {
				watcher.init();
				watcher.getChangedItemKeys();

				// Modify file
				let path = await item.getFilePathAsync();
				await Zotero.File.putContentsAsync(
					path, Zotero.Utilities.randomString()
				);

				await Zotero.Promise.delay(1000);

				// First query picks up the change
				let result1 = watcher.getChangedItemKeys();
				assertIsSet(result1);
				assert.isTrue(result1.has(item.key));

				// Second query should be empty
				let result2 = watcher.getChangedItemKeys();
				assertIsSet(result2);
				assert.equal(result2.size, 0,
					"Should not report the same change twice");
			}
			finally {
				await item.eraseTx();
			}
		});

		it("should detect a new file added to a storage directory", async function () {
			this.timeout(15000);

			let item = await importFileAttachment('test.png');

			try {
				watcher.init();
				watcher.getChangedItemKeys();

				// Add a new file to the item's storage directory
				let storageDir = Zotero.Attachments.getStorageDirectory(item).path;
				let newFile = PathUtils.join(storageDir, "extra.txt");
				await Zotero.File.putContentsAsync(newFile, "extra content");

				await Zotero.Promise.delay(1000);

				let result = watcher.getChangedItemKeys();
				assertIsSet(result);
				assert.isTrue(result.has(item.key),
					"Should detect new file in storage directory");
			}
			finally {
				await item.eraseTx();
			}
		});

		it("should return null when storage path has changed", function () {
			// Simulate a previous run with a different storage path
			Zotero.Prefs.set(PREF_FSEVENTS_STORAGE_PATH, "/some/other/path/");
			Zotero.Prefs.set(PREF_FSEVENTS_EVENT_ID, "12345");

			watcher.init();

			// The saved event ID should have been cleared
			let result = watcher.getChangedItemKeys();
			assert.isNull(result,
				"Should return null after storage path change");
		});

		it("should persist event ID across close/init cycles", async function () {
			this.timeout(15000);

			let item = await importFileAttachment('test.png');

			try {
				watcher.init();
				// Establish baseline
				watcher.getChangedItemKeys();

				let savedId = Zotero.Prefs.get(PREF_FSEVENTS_EVENT_ID);
				assert.ok(savedId, "Event ID should be saved");

				// Close and re-init (simulating restart)
				watcher.close();
				watcher.init();

				// Should not return null -- saved event ID should be used
				let result = watcher.getChangedItemKeys();
				assertIsSet(result,
					"Should return a Set (not null) after re-init "
					+ "with saved event ID");
			}
			finally {
				await item.eraseTx();
			}
		});

		it("should detect changes that happened while watcher was closed", async function () {
			this.timeout(15000);

			let item = await importFileAttachment('test.png');

			try {
				watcher.init();
				watcher.getChangedItemKeys();

				// Close the watcher
				watcher.close();

				// Modify file while watcher is closed
				let path = await item.getFilePathAsync();
				await Zotero.File.putContentsAsync(
					path, Zotero.Utilities.randomString()
				);

				await Zotero.Promise.delay(1000);

				// Re-init and query -- FSEvents journal should have
				// the change even though the watcher was closed
				watcher.init();
				let result = watcher.getChangedItemKeys();
				assertIsSet(result);
				assert.isTrue(result.has(item.key),
					"Should detect changes that occurred while "
					+ "watcher was closed");
			}
			finally {
				await item.eraseTx();
			}
		});

		it("should only report valid 8-char item keys", async function () {
			this.timeout(15000);

			watcher.init();
			watcher.getChangedItemKeys();

			// Create a non-standard directory name in the storage root
			let storageRoot = watcher._storageRoot;
			let invalidDir = PathUtils.join(storageRoot, "not-a-key");
			await IOUtils.makeDirectory(invalidDir, { ignoreExisting: true });
			let testFile = PathUtils.join(invalidDir, "test.txt");
			await IOUtils.writeUTF8(testFile, "test");

			await Zotero.Promise.delay(1000);

			try {
				let result = watcher.getChangedItemKeys();
				assertIsSet(result);
				// Should not contain the invalid directory name
				for (let key of result) {
					assert.match(key, /^[A-Z0-9]{8}$/,
						"All returned keys should match the 8-char "
						+ "pattern");
				}
			}
			finally {
				await IOUtils.remove(invalidDir, { recursive: true });
			}
		});
	});

	describe("integration with storageEngine", function () {
		before(async function () {
			if (!Zotero.isMac) {
				this.skip();
			}
			let storageDir = PathUtils.join(
				Zotero.DataDirectory.dir, "storage"
			);
			await IOUtils.makeDirectory(storageDir, {
				ignoreExisting: true
			});
			watcher.close();
			clearWatcherPrefs();
		});

		afterEach(function () {
			watcher.close();
			clearWatcherPrefs();
		});

		after(function () {
			watcher.init();
		});

		it("should be checked before falling back to legacy scanning", async function () {
			this.timeout(15000);

			let item = await importFileAttachment('test.png');
			let hash = await item.attachmentHash;
			let mtime = (Math.floor(new Date().getTime() / 1000) * 1000) - 1000;
			await OS.File.setDates(
				(await item.getFilePathAsync()), null, mtime
			);

			// Mark as synced
			item.attachmentSyncedModificationTime = mtime;
			item.attachmentSyncedHash = hash;
			item.attachmentSyncState = "in_sync";
			await item.saveTx({ skipAll: true });

			try {
				watcher.init();
				// Establish baseline
				watcher.getChangedItemKeys();

				// Modify the file
				let path = await item.getFilePathAsync();
				await OS.File.setDates(path);
				await Zotero.File.putContentsAsync(
					path, Zotero.Utilities.randomString()
				);

				await Zotero.Promise.delay(1000);

				// Verify the watcher reports the change
				let changedKeys = watcher.getChangedItemKeys();
				assertIsSet(changedKeys);
				assert.isTrue(changedKeys.has(item.key));

				// Map keys to itemIDs as storageEngine does
				let libraryID = Zotero.Libraries.userLibraryID;
				let itemIDs = await Zotero.DB.columnQueryAsync(
					"SELECT itemID FROM items WHERE libraryID=?"
						+ " AND key IN ("
						+ Array.from(changedKeys).map(() => '?')
							.join(',')
						+ ")",
					[libraryID, ...changedKeys]
				);
				assert.include(itemIDs, item.id);

				// checkForUpdatedFiles should flag it for upload
				let changed = await Zotero.Sync.Storage.Local
					.checkForUpdatedFiles(libraryID, itemIDs);
				assert.isTrue(changed);
				assert.equal(
					item.attachmentSyncState,
					Zotero.Sync.Storage.Local.SYNC_STATE_TO_UPLOAD
				);
			}
			finally {
				await item.eraseTx();
			}
		});
	});

	describe("ReadDirectoryChangesW backend (Windows)", function () {
		before(async function () {
			if (!Zotero.isWin) {
				this.skip();
			}
			let storageDir = PathUtils.join(
				Zotero.DataDirectory.dir, "storage"
			);
			await IOUtils.makeDirectory(storageDir, {
				ignoreExisting: true
			});
			watcher.close();
		});

		afterEach(function () {
			watcher.close();
		});

		after(function () {
			watcher.init();
		});

		it("should initialize successfully");
		it("should return null on first call (no persistent journal)");
		it("should return an empty set when no files have changed");
		it("should detect a modified attachment file");
		it("should detect changes across multiple items");
		it("should not report the same changes twice");
		it("should detect a new file added to a storage directory");
		it("should re-arm overlapped I/O after draining notifications");
		it("should return null on buffer overflow and re-arm");
		it("should return null for periodic full scan after max age");
		it("should only report valid 8-char item keys");
	});

	describe("inotify backend (Linux)", function () {
		before(async function () {
			if (!Zotero.isLinux) {
				this.skip();
			}
			let storageDir = PathUtils.join(
				Zotero.DataDirectory.dir, "storage"
			);
			await IOUtils.makeDirectory(storageDir, {
				ignoreExisting: true
			});
			watcher.close();
			clearWatcherPrefs();
		});

		afterEach(function () {
			watcher.close();
			clearWatcherPrefs();
		});

		after(function () {
			watcher.init();
		});

		it("should initialize successfully");
		it("should return null on first call (no persistent journal)");
		it("should return an empty set when no files have changed");
		it("should detect a modified attachment file");
		it("should detect changes across multiple items");
		it("should not report the same changes twice");
		it("should detect a new file added to a storage directory");
		it("should auto-watch newly created storage subdirectories");
		it("should return null for periodic full scan after max age");
		it("should only report valid 8-char item keys");
	});

	describe("fallback behavior", function () {
		it("should return null from getChangedItemKeys() when unavailable", function () {
			let savedAvailable = watcher.available;
			let savedBackend = watcher._backend;
			watcher.available = false;
			watcher._backend = null;
			try {
				let result = watcher.getChangedItemKeys();
				assert.isNull(result);
			}
			finally {
				watcher.available = savedAvailable;
				watcher._backend = savedBackend;
			}
		});

		it("should set available to false after close()", function () {
			if (!Zotero.isMac) {
				this.skip();
			}
			watcher.init();
			assert.isTrue(watcher.available);
			watcher.close();
			assert.isFalse(watcher.available);
			assert.isNull(watcher._backend);
			// Re-init for other tests
			clearWatcherPrefs();
			watcher.init();
		});
	});
});
