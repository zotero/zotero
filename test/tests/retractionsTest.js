describe("Retractions", function() {
	var userLibraryID;
	var win;
	var zp;
	var server;
	var checkQueueItemsStub;
	var retractedDOI = '10.1016/S0140-6736(97)11096-0';
	
	before(async function () {
		userLibraryID = Zotero.Libraries.userLibraryID;
		win = await loadZoteroPane();
		zp = win.ZoteroPane;
		
		// Remove debouncing on checkQueuedItems()
		checkQueueItemsStub = sinon.stub(Zotero.Retractions, 'checkQueuedItems').callsFake(() => {
			return Zotero.Retractions._checkQueuedItemsInternal();
		});
	});
	
	beforeEach(async function () {
		var ids = await Zotero.DB.columnQueryAsync("SELECT itemID FROM retractedItems");
		if (ids.length) {
			await Zotero.Items.erase(ids);
		}
	});
	
	afterEach(async function () {
		win.document.getElementById('retracted-items-close').click();
		checkQueueItemsStub.resetHistory();
	});
	
	after(async function () {
		win.close();
		checkQueueItemsStub.restore();
		
		var ids = await Zotero.DB.columnQueryAsync("SELECT itemID FROM retractedItems");
		if (ids.length) {
			await Zotero.Items.erase(ids);
		}
	});
	
	async function createRetractedItem(options = {}) {
		var o = {
			itemType: 'journalArticle'
		};
		Object.assign(o, options);
		var item = createUnsavedDataObject('item', o);
		item.setField('DOI', retractedDOI);
		if (Zotero.DB.inTransaction) {
			await item.save();
		}
		else {
			await item.saveTx();
		}
		
		while (!checkQueueItemsStub.called) {
			await Zotero.Promise.delay(50);
		}
		await checkQueueItemsStub.returnValues[0];
		checkQueueItemsStub.resetHistory();
		
		return item;
	}
	
	function bannerShown() {
		var container = win.document.getElementById('retracted-items-container');
		if (container.getAttribute('collapsed') == 'true') {
			return false;
		}
		if (!container.hasAttribute('collapsed')) {
			return true;
		}
		throw new Error("'collapsed' attribute not found");
	}
	
	
	describe("#getRetractionsFromJSON()", function () {
		it("should identify object with retracted DOI", async function () {
			var spy = sinon.spy(Zotero.HTTP, 'request');
			var json = [
				{
					
				},
				{
					DOI: retractedDOI
				},
				{
					DOI: '10.1234/abcd'
				}
			];
			
			var indexes = await Zotero.Retractions.getRetractionsFromJSON(json);
			assert.sameMembers(indexes, [1]);
			assert.equal(spy.callCount, 1);
			
			indexes = await Zotero.Retractions.getRetractionsFromJSON(json);
			assert.sameMembers(indexes, [1]);
			// Result should've been cached, so we should have it without another API request
			assert.equal(spy.callCount, 1);
			
			spy.restore();
		});
	});
	
	
	describe("Notification Banner", function () {
		it("should show banner when retracted item is added", async function () {
			var banner = win.document.getElementById('retracted-items-container');
			assert.isFalse(bannerShown());
			
			await createRetractedItem();
			
			assert.isTrue(bannerShown());
		});
		
		it("shouldn't show banner when item in trash is added", async function () {
			var item = await createRetractedItem({ deleted: true });
			
			assert.isFalse(bannerShown());
			
			win.document.getElementById('retracted-items-link').click();
			
			while (zp.collectionsView.selectedTreeRow.id != 'L1') {
				await Zotero.Promise.delay(10);
			}
			await waitForItemsLoad(win);
			
			var item = await zp.getSelectedItems()[0];
			assert.equal(item, item);
		});
	});
	
	describe("virtual collection", function () {
		it("should show/hide Retracted Items collection when a retracted item is found/erased", async function () {
			// Create item
			var item = await createRetractedItem();
			assert.ok(zp.collectionsView.getRowIndexByID("R" + userLibraryID));
			
			// Erase item
			var promise = waitForItemEvent('refresh');
			await item.eraseTx();
			await promise;
			assert.isFalse(zp.collectionsView.getRowIndexByID("R" + userLibraryID));
		});
		
		it("should unhide Retracted Items collection when retracted item is found", async function () {
			await createRetractedItem();
			
			// Hide collection
			await zp.setVirtual(userLibraryID, 'retracted', false);
			
			// Add another retracted item, which should unhide it
			await createRetractedItem();
			assert.ok(zp.collectionsView.getRowIndexByID("R" + userLibraryID));
		});
		
		it("should hide Retracted Items collection when last retracted item is moved to trash", async function () {
			var rowID = "R" + userLibraryID;
			
			// Create item
			var item = await createRetractedItem();
			assert.ok(zp.collectionsView.getRowIndexByID(rowID));
			
			// Select Retracted Items collection
			await zp.collectionsView.selectByID(rowID);
			await waitForItemsLoad(win);
			
			// Erase item
			item.deleted = true;
			await item.saveTx();
			await Zotero.Promise.delay(50);
			// Retracted Items should be gone
			assert.isFalse(zp.collectionsView.getRowIndexByID(rowID));
			// And My Library should be selected
			assert.equal(zp.collectionsView.selectedTreeRow.id, "L" + userLibraryID);
		});
		
		it("should show Retracted Items collection when retracted item is restored from trash", async function () {
			// Create trashed item
			var item = await createRetractedItem({ deleted: true });
			await Zotero.Promise.delay(50);
			assert.isFalse(zp.collectionsView.getRowIndexByID("R" + userLibraryID));
			
			// Restore item
			item.deleted = false;
			await item.saveTx();
			await Zotero.Promise.delay(50);
			assert.ok(zp.collectionsView.getRowIndexByID("R" + userLibraryID));
		});
	});
	
	describe("retractions.enabled", function () {
		beforeEach(function () {
			Zotero.Prefs.clear('retractions.enabled');
		});
		
		it("should hide virtual collection and banner when false", async function () {
			var item = await createRetractedItem();
			await Zotero.Promise.delay(50);
			var itemRetractionBox = win.document.getElementById('retraction-box');
			assert.isFalse(itemRetractionBox.hidden);
			
			var spies = [
				sinon.spy(Zotero.Retractions, '_removeAllEntries'),
				sinon.spy(Zotero.Retractions, 'getData')
			];
			Zotero.Prefs.set('retractions.enabled', false);
			
			while (!spies[0].called || !spies[1].called) {
				await Zotero.Promise.delay(50);
			}
			await spies[0].returnValues[0];
			await spies[1].returnValues[0]
			spies.forEach(spy => spy.restore());
			
			assert.isFalse(Zotero.Retractions.isRetracted(item));
			assert.isFalse(zp.collectionsView.getRowIndexByID("R" + userLibraryID));
			assert.isFalse(bannerShown());
			
			assert.isTrue(itemRetractionBox.hidden);
			
			await item.eraseTx();
		});
	});
});