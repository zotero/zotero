'use strict';

describe('Zotero.Sync.Storage.Cache', function () {
	beforeEach(async function () {
		await resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
	});
	afterEach(function () {
		sinon.restore();
	});


	describe('#cleanCacheForLibrary()', function () {
		it('should create a promise if non exists', async function () {
			let executeResolve;
			let executePromise = new Zotero.Promise((resolve) =>  {
				executeResolve = resolve;
			});

			// Stub out execute and return a promise we can resolve
			let stub = sinon.stub(Zotero.Sync.Storage.Cache, '_executeCleanForLibrary');
			stub.returns(executePromise);

			// Start the clean
			let cleaning = Zotero.Sync.Storage.Cache.cleanCacheForLibrary(0);

			// Check to make sure a cleaning promise was properly made
			assert.propertyVal(
				Zotero.Sync.Storage.Cache._cleaningCachePromises,
				0,
				executePromise
			);

			// Finish up execution
			executeResolve();
			await cleaning;

			assert.isTrue(stub.calledOnce);
			// Ensure we have deleted the promise
			assert.isEmpty(Zotero.Sync.Storage.Cache._cleaningCachePromises);
		});

		it('should await the cleaning promise if it already exists', async function () {
			let executeResolve;
			let executePromise = new Zotero.Promise((resolve) =>  {
				executeResolve = resolve;
			});

			// Set up an existing promise
			Zotero.Sync.Storage.Cache._cleaningCachePromises[0] = executePromise;

			// Start the clean
			let cleaning = Zotero.Sync.Storage.Cache.cleanCacheForLibrary(0);

			// Check to make sure we did not override promise
			assert.propertyVal(
				Zotero.Sync.Storage.Cache._cleaningCachePromises,
				0,
				executePromise
			);

			// Finish up execution
			executeResolve();
			await cleaning;

			// Ensure we have deleted the promise
			assert.isEmpty(Zotero.Sync.Storage.Cache._cleaningCachePromises);
		});
	});


	describe('#_executeCleanForLibrary()', function () {
		it('should set lastCleanCache value for given libraryID', async function () {
			let preTimestamp = Date.now();
			await Zotero.Sync.Storage.Cache
				._executeCleanForLibrary(Zotero.Libraries.userLibraryID);

			assert.hasAllKeys(
				Zotero.Sync.Storage.Local.lastCacheClean,
				[Zotero.Libraries.userLibraryID]
			);
			assert.isAtLeast(
				Zotero.Sync.Storage.Local.lastCacheClean.get(Zotero.Libraries.userLibraryID),
				preTimestamp
			);
			assert.isAtMost(
				Zotero.Sync.Storage.Local.lastCacheClean.get(Zotero.Libraries.userLibraryID),
				Date.now()
			);
		});
	});


	describe('#_getAllImportedAttachments()', function () {
		it('should return imported attachments of top-level items', async function () {
			let item = await createDataObject('item', false, { skipSelect: true });
			let importedAttachment = await importFileAttachment(
				'test.png',
				{ parentItemID: item.id }
			);
			let _linkedAttachment = await Zotero.Attachments.linkFromFile({
				file: OS.Path.join(getTestDataDirectory().path, 'test.pdf'),
				parentItemID: item.id
			});
			// Ensure the test is set up properly
			assert.lengthOf(item.getAttachments(), 2);

			let attachments = await Zotero.Sync.Storage.Cache
				._getAllImportedAttachments([item]);

			assert.lengthOf(attachments, 1);
			assert.equal(attachments[0].id, importedAttachment.id);
		});

		it('should return top-level imported attachment items', async function () {
			let importedAttachment = await importFileAttachment('test.png');
			let linkedAttachment = await Zotero.Attachments.linkFromFile({
				file: OS.Path.join(getTestDataDirectory().path, 'test.pdf')
			});

			let attachments = await Zotero.Sync.Storage.Cache
				._getAllImportedAttachments([importedAttachment, linkedAttachment]);

			assert.lengthOf(attachments, 1);
			assert.equal(attachments[0].id, importedAttachment.id);
		});

		it('should return unique set of attachment items', async function () {
			let item = await createDataObject('item', false, { skipSelect: true });
			let importedAttachment = await importFileAttachment(
				'test.png',
				{ parentItemID: item.id }
			);

			let attachments = await Zotero.Sync.Storage.Cache
				._getAllImportedAttachments([item, importedAttachment]);

			assert.lengthOf(attachments, 1);
			assert.equal(attachments[0].id, importedAttachment.id);
		});
	});

	describe('#_cacheLimitForLibrary()', function () {
		let userLibraryID;
		let group;

		beforeEach(async function () {
			group = await createGroup();
			userLibraryID = Zotero.Libraries.userLibraryID;
			Zotero.Prefs.set('sync.storage.timeToLive.enabled', true);
			Zotero.Prefs.set('sync.storage.timeToLive.value', 3);
		});

		it('should check personal library is enabled', async function () {
			Zotero.Prefs.set('sync.storage.timeToLive.enabled', false);

			assert.isFalse(
				Zotero.Sync.Storage.Cache._cacheLimitForLibrary(userLibraryID)
			);
		});

		it('should retrieve personal library value', async function () {
			assert.equal(
				Zotero.Sync.Storage.Cache._cacheLimitForLibrary(userLibraryID),
				3
			);
		});

		it('should check group library is enabled', async function () {
			Zotero.Prefs.set('sync.storage.timeToLive.enabled', false);

			assert.isFalse(
				Zotero.Sync.Storage.Cache._cacheLimitForLibrary(group.libraryID)
			);
		});

		it('should retrieve group library value', async function () {
			assert.equal(
				Zotero.Sync.Storage.Cache._cacheLimitForLibrary(group.libraryID),
				3
			);
		});
	});

	describe('#_deleteItemFiles()', function () {
		it('should handle multiple items', async function () {
			let attachment = await Zotero.Attachments.linkFromFile({
				file: OS.Path.join(getTestDataDirectory().path, 'test.pdf')
			});
			let deleted = await Zotero.Sync.Storage.Cache._deleteItemFiles(
				[attachment, attachment]
			);

			assert.equal(deleted, 0);
		});

		it('should check item is an imported attachment', async function () {
			let attachment = await Zotero.Attachments.linkFromFile({
				file: OS.Path.join(getTestDataDirectory().path, 'test.pdf')
			});
			let deleted = await Zotero.Sync.Storage.Cache._deleteItemFiles([attachment]);

			assert.equal(deleted, 0);
		});

		it('should check item is marked as in sync', async function () {
			// Stub out remote file existence check
			let stub = sinon.stub(Zotero.Sync.Runner, 'checkFileExists');
			stub.returns(false);

			let attachment = await importFileAttachment('test.png');
			attachment.attachmentSyncState
				= Zotero.Sync.Storage.Local.SYNC_STATE_TO_UPLOAD;
			await attachment.saveTx({ skipAll: true });

			let deleted = await Zotero.Sync.Storage.Cache._deleteItemFiles([attachment]);

			assert.equal(deleted, 0);
			assert.isFalse(stub.calledOnce);
		});

		it('should check for existence on the server before deleting', async function () {
			// Stub out remote file existence check
			let stub = sinon.stub(Zotero.Sync.Runner, 'checkFileExists');
			stub.returns(false);

			let attachment = await importFileAttachment('test.png');
			attachment.attachmentSyncState
				= Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC;
			await attachment.saveTx({ skipAll: true });

			let deleted = await Zotero.Sync.Storage.Cache._deleteItemFiles([attachment]);

			assert.equal(deleted, 0);
			assert.isTrue(stub.calledOnce);
		});

		it('should remove all non-hidden files and sub-directories', async function () {
			// Stub out remote file existence check
			let stub = sinon.stub(Zotero.Sync.Runner, 'checkFileExists');
			stub.returns(true);

			let attachment = await importFileAttachment('test.png');
			attachment.attachmentSyncState
				= Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC;
			let attachmentFilePath = await attachment.getFilePath();
			assert.isTrue(await OS.File.exists(attachmentFilePath));

			// Add a hidden file
			let attachmentDirectory = OS.Path.dirname(attachmentFilePath);
			let hiddenFilePath = OS.Path.join(attachmentDirectory, '.hidden');
			await Zotero.File.putContentsAsync(hiddenFilePath, 'contents');

			// Add a sub-directory with a file
			let subDirectoryPath = OS.Path.join(attachmentDirectory, 'sub');
			await OS.File.makeDir(subDirectoryPath);
			await Zotero.File.putContentsAsync(
				OS.Path.join(subDirectoryPath, 'subfile.txt'),
				'sub-file contents'
			);

			// Run delete
			let deleted = await Zotero.Sync.Storage.Cache._deleteItemFiles([attachment]);
			assert.equal(deleted, 1);

			// Attachment file is gone
			assert.isFalse(await OS.File.exists(attachmentFilePath));
			// Sub-directory is gone
			assert.isFalse(await OS.File.exists(subDirectoryPath));
			// Hidden file still exists
			assert.isTrue(await OS.File.exists(hiddenFilePath));
			assert.equal(
				await Zotero.File.getContentsAsync(hiddenFilePath),
				'contents'
			);
			assert.isTrue(stub.calledOnce);
		});

		it('should update sync state of affected item', async function () {
			// Stub out remote file existence check
			let stub = sinon.stub(Zotero.Sync.Runner, 'checkFileExists');
			stub.returns(true);

			// Create attachment marked as synced
			let attachment = await importFileAttachment('test.png');
			attachment.attachmentSyncState
				= Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC;
			await attachment.saveTx({ skipAll: true });

			// Run delete
			let deleted = await Zotero.Sync.Storage.Cache._deleteItemFiles([attachment]);
			assert.equal(deleted, 1);

			// Check for updated status
			assert.equal(
				attachment.attachmentSyncState,
				Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD
			);
			assert.isTrue(stub.calledOnce);
		});

		it('should rate limit file deletion', async function () {
			// Stub out remote file existence check
			let stub = sinon.stub(Zotero.Sync.Runner, 'checkFileExists');
			stub.returns(true);

			let attachment = await importFileAttachment('test.png');
			attachment.attachmentSyncState
				= Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC;
			await attachment.saveTx({ skipAll: true });

			// Slow down the sleep period
			Zotero.Sync.Storage.Cache._fileDeletionSleepPeriod = 2000;

			let startTime = Date.now();
			let deleted = await Zotero.Sync.Storage.Cache._deleteItemFiles([attachment]);
			let totalTime = Date.now() - startTime;

			assert.equal(deleted, 1);
			assert.isAtLeast(totalTime, 2000);
			assert.isTrue(stub.calledOnce);
		});
	});

	describe('#_getExpiredItemsForLibrary()', function () {
		let userLibraryID;
		let group;
		let twoDaysAgo;

		beforeEach(async function () {
			group = await createGroup();
			userLibraryID = Zotero.Libraries.userLibraryID;

			// Set dummy data for sync
			await Zotero.Users.setCurrentUserID(1);
			await Zotero.Users.setCurrentUsername('A');

			// Set up default to on
			Zotero.Prefs.set('sync.storage.enabled', true);
			Zotero.Prefs.set('sync.storage.downloadMode.personal', 'on-demand');
			Zotero.Prefs.set('sync.storage.timeToLive.enabled', true);
			Zotero.Prefs.set('sync.storage.timeToLive.value', 1);

			twoDaysAgo = Date.now() - 172800000;

			// Speed up our loop time
			Zotero.Sync.Storage.Cache._dbScanSleepPeriod = 10;
		});

		/**
		 * Helper to make attachment items
		 *
		 * @param {Object} [options]
		 * @param {Integer} [options.libraryID]
		 * @param {Integer} [options.attachmentSyncState] - From Zotero.Sync.Storage.Local
		 * @param {Integer} [options.attachmentLastAccessed]
		 * @return {Promise<Zotero.Item>}
		 */
		const createAttachmentItem = async (options = {}) => {
			let item = await importFileAttachment(
				'test.png',
				{ libraryID: options.libraryID || userLibraryID }
			);
			item.attachmentLastAccessed = options.attachmentLastAccessed || twoDaysAgo;
			item.attachmentSyncState = options.attachmentSyncState
				|| Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC;
			await item.saveTx({});

			return item;
		};

		it('should check library has storage enabled', async function () {
			Zotero.Prefs.set('sync.storage.enabled', false);

			assert.isFalse(await Zotero.Sync.Storage.Cache
				._getExpiredItemsForLibrary(userLibraryID));
		});

		it('should check library has on-demand downloading', async function () {
			Zotero.Prefs.set('sync.storage.downloadMode.personal', 'on-sync');

			assert.isFalse(await Zotero.Sync.Storage.Cache
				._getExpiredItemsForLibrary(userLibraryID));
		});

		it('should check library has cache eviction enabled', async function () {
			Zotero.Prefs.set('sync.storage.timeToLive.enabled', false);

			assert.isFalse(await Zotero.Sync.Storage.Cache
				._getExpiredItemsForLibrary(userLibraryID));
		});

		it('should only include items in given library', async function () {
			let item1 = await createAttachmentItem();
			let _item2 = await createAttachmentItem({ libraryID: group.libraryID });

			let items = await Zotero.Sync.Storage.Cache
				._getExpiredItemsForLibrary(userLibraryID);

			assert.lengthOf(items, 1);
			assert.equal(items[0].id, item1.id);
		});

		it('should only include importedAttachments', async function () {
			let item1 = await createAttachmentItem();

			let _item2 = await Zotero.Attachments.linkFromFile({
				file: OS.Path.join(getTestDataDirectory().path, 'test.png')
			});

			let items = await Zotero.Sync.Storage.Cache
				._getExpiredItemsForLibrary(userLibraryID);

			assert.lengthOf(items, 1);
			assert.equal(items[0].id, item1.id);
		});

		it('should only include fully synced items', async function () {
			let item1 = await createAttachmentItem();
			let _item2 = await createAttachmentItem(
				{ attachmentSyncState: Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD }
			);

			let items = await Zotero.Sync.Storage.Cache
				._getExpiredItemsForLibrary(userLibraryID);

			assert.lengthOf(items, 1);
			assert.equal(items[0].id, item1.id);
		});

		it('should include items based on lastAccessed and dateModified', async function () {
			// Old `lastAccessed` and recent `dateModified` - include
			let item1 = await createAttachmentItem();

			// No `lastAccessed` and old `dateModified` - include
			let item2 = await importFileAttachment('test.png');
			item2.dateModified = Zotero.Date.dateToSQL(new Date(twoDaysAgo));
			item2.attachmentSyncState = Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC;
			await item2.saveTx({ skipDateModifiedUpdate: true });

			// No `lastAccessed` and recent `dateModified`  - exclude
			let item3 = await importFileAttachment('test.png');
			item3.attachmentSyncState = Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC;
			await item3.saveTx({});

			// Recent `lastAccessed` and recent `dateModified` - exclude
			let _item4 = await createAttachmentItem({ attachmentLastAccessed: Date.now() });

			let items = await Zotero.Sync.Storage.Cache
				._getExpiredItemsForLibrary(userLibraryID);

			assert.lengthOf(items, 2);
			assert.equal(items[0].id, item1.id);
			assert.equal(items[1].id, item2.id);
		});

		it('should combine results when records exceed looping limit', async function () {
			// 6 items to test repeating on `lastAccessed` and ending with zero records
			// returned (2, 2, 2, 0 for each SQL statement).
			await Zotero.Promise.all(Array(6).fill(1).map(async () => {
				await createAttachmentItem();
			}));

			// 7 items to test repeating on `dateModified` and ending with one record
			// returned (2, 2, 2, 1 for each SQL statement).
			await Zotero.Promise.all(Array(7).fill(1).map(async () => {
				// No `lastAccessed` and old `dateModified` - include
				let item2 = await importFileAttachment('test.png');
				item2.dateModified = Zotero.Date.dateToSQL(new Date(twoDaysAgo));
				item2.attachmentSyncState = Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC;
				await item2.saveTx({ skipDateModifiedUpdate: true });
			}));

			// Make our loop small
			Zotero.Sync.Storage.Cache._dbScanRecordLimit = 2;

			let items = await Zotero.Sync.Storage.Cache
				._getExpiredItemsForLibrary(userLibraryID);

			assert.lengthOf(items, 13);
		});

		it('should rate limit db requests', async function () {
			// Slow up our loop time. We always run one sleep because we scan both
			// `lastAccessed` and `dateModified`
			Zotero.Sync.Storage.Cache._dbScanSleepPeriod = 3000;

			// Get the current time
			let startTime = Date.now();
			let items = await Zotero.Sync.Storage.Cache
				._getExpiredItemsForLibrary(userLibraryID);
			let totalTime = Date.now() - startTime;

			assert.lengthOf(items, 0);
			assert.isAtLeast(totalTime, 3000);
		});
	});
});
