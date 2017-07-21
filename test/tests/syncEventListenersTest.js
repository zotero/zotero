"use strict";

describe("Zotero.Sync.EventListeners", function () {
	describe("AutoSyncListener", function () {
		var originalTimeout;
		
		before(function () {
			originalTimeout = Zotero.Sync.EventListeners.AutoSyncListener._editTimeout;
			assert.ok(originalTimeout);
			// Set timeout to 1ms
			Zotero.Sync.EventListeners.AutoSyncListener._editTimeout = 0.001;
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
	});
});
