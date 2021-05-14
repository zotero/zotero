"use strict";

describe("Zotero.Sync.EventListeners", function () {
	describe("ChangeListener", function () {
		it("should add items to sync delete log", async function () {
			var item = await createDataObject('item');
			await item.eraseTx();
			assert.ok(
				await Zotero.Sync.Data.Local.getDateDeleted('item', item.libraryID, item.key)
			);
		});
		
		it("shouldn't add items with `skipDeleteLog: true`", async function () {
			var item = await createDataObject('item');
			await item.eraseTx({
				skipDeleteLog: true
			});
			assert.isFalse(
				await Zotero.Sync.Data.Local.getDateDeleted('item', item.libraryID, item.key)
			);
		});
		
		// Technically skipped in Zotero.DataObject._finalizeErase(), which sets skipDeleteLog
		// based on the result of Sync.Data.Local.isSyncItem()
		it("shouldn't add non-syncing items to sync delete log", async function () {
			var attachment = await importFileAttachment('test.pdf');
			var annotation = await createAnnotation('image', attachment, { isExternal: true });
			await annotation.eraseTx();
			assert.isFalse(
				await Zotero.Sync.Data.Local.getDateDeleted(
					'item', attachment.libraryID, annotation.key
				)
			);
		});
	});
	
	describe("AutoSyncListener", function () {
		var originalTimeout;
		
		before(function () {
			originalTimeout = Zotero.Sync.EventListeners.AutoSyncListener._editTimeout;
			assert.ok(originalTimeout);
			// Set timeout to 1ms
			Zotero.Sync.EventListeners.AutoSyncListener._editTimeout = 0.001;
		});
		
		beforeEach(function () {
			Zotero.Prefs.set('sync.autoSync', true);
		});
		
		
		after(function () {
			Zotero.Sync.EventListeners.AutoSyncListener._editTimeout = originalTimeout;
			Zotero.Prefs.set('sync.autoSync', false);
			Zotero.Prefs.clear('sync.librariesToSkip');
		});
		
		
		it("should sync only changed library", function* () {
			var mock = sinon.mock(Zotero.Sync.Runner);
			var expectation = mock.expects("setSyncTimeout").once();
			
			var group = yield createGroup();
			yield createDataObject('item', { libraryID: group.libraryID });
			
			yield Zotero.Promise.delay(10);
			mock.verify();
			assert.sameMembers(expectation.getCall(0).args[2].libraries, [group.libraryID]);
		});
		
		
		it("shouldn't sync skipped library", function* () {
			var mock = sinon.mock(Zotero.Sync.Runner);
			var expectation = mock.expects("setSyncTimeout").never();
			
			var group = yield createGroup();
			Zotero.Prefs.set('sync.librariesToSkip', JSON.stringify(["G" + group.groupID]));
			yield createDataObject('item', { libraryID: group.libraryID });
			
			yield Zotero.Promise.delay(10);
			mock.verify();
		});
		
		it("should auto-sync after settings change", async function () {
			Zotero.Prefs.set('sync.autoSync', false);
			var attachment = await importFileAttachment('test.pdf');
			Zotero.Prefs.set('sync.autoSync', true);
			
			var mock = sinon.mock(Zotero.Sync.Runner);
			var expectation = mock.expects("setSyncTimeout").once();
			
			// Create setting (e.g., lastPageIndex_u_ABCD2345)
			await attachment.setAttachmentLastPageIndex(1);
			
			await Zotero.Promise.delay(10);
			mock.verify();
			assert.sameMembers(expectation.getCall(0).args[2].libraries, [Zotero.Libraries.userLibraryID]);
		});
		
		it("should auto-sync after item deletion", async function () {
			Zotero.Prefs.set('sync.autoSync', false);
			var item = await createDataObject('item');
			Zotero.Prefs.set('sync.autoSync', true);
			
			var mock = sinon.mock(Zotero.Sync.Runner);
			var expectation = mock.expects("setSyncTimeout").once();
			
			await item.eraseTx();
			
			await Zotero.Promise.delay(10);
			mock.verify();
			assert.sameMembers(expectation.getCall(0).args[2].libraries, [Zotero.Libraries.userLibraryID]);
		});
		
		it("should auto-sync after attachment reindex", async function () {
			Zotero.Prefs.set('sync.autoSync', false);
			var attachment = await importFileAttachment('test.pdf');
			Zotero.Prefs.set('sync.autoSync', true);
			
			var mock = sinon.mock(Zotero.Sync.Runner);
			var expectation = mock.expects("setSyncTimeout").once();
			
			await Zotero.Fulltext.indexItems(attachment.id);
			
			await Zotero.Promise.delay(10);
			mock.verify();
			assert.sameMembers(
				expectation.getCall(0).args[2].fullTextLibraries,
				[Zotero.Libraries.userLibraryID]
			);
		});
	});
});
