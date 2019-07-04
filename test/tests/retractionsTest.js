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
	
	
	describe("#updateFromServer()", function () {
		var server;
		var baseURL;
		
		before(function () {
			Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
			baseURL = ZOTERO_CONFIG.API_URL + 'retractions/';
		});
		
		beforeEach(function () {
			server = sinon.fakeServer.create();
			server.autoRespond = true;
		});
		
		after(async function () {
			Zotero.HTTP.mock = null;
			// Restore the real list from the server. We could just mock it as part of the suite.
			await Zotero.Retractions.updateFromServer();
		});
		
		/*it("shouldn't show banner or virtual collection for already flagged items on list update", async function () {
			await Zotero.Retractions.updateFromServer();
		});*/
		
		it("should remove retraction flag from items that no longer match prefix list", async function () {
			var doi = '10.1234/abcde';
			var hash = Zotero.Utilities.Internal.sha1(doi);
			var prefix = hash.substr(0, 5);
			var lines = [
				Zotero.Retractions.TYPE_DOI + prefix + ' 12345\n',
				Zotero.Retractions.TYPE_DOI + 'aaaaa 23456\n'
			];
			
			var listCount = 0;
			var searchCount = 0;
			server.respond(function (req) {
				if (req.method == 'GET' && req.url == baseURL + 'list') {
					listCount++;
					if (listCount == 1) {
						req.respond(
							200,
							{
								'Content-Type': 'text/plain',
								'ETag': 'abcdefg'
							},
							lines.join('')
						);
					}
					else if (listCount == 2) {
						req.respond(
							200,
							{
								'Content-Type': 'text/plain',
								'ETag': 'bcdefgh'
							},
							lines[1]
						);
					}
				}
				else if (req.method == 'POST' && req.url == baseURL + 'search') {
					searchCount++;
					if (searchCount == 1) {
						req.respond(
							200,
							{
								'Content-Type': 'application/json'
							},
							JSON.stringify([
								{
									doi: hash,
									retractionDOI: '10.1234/bcdef',
									date: '2019-01-02'
								}
							])
						);
					}
				}
			});
			
			await Zotero.Retractions.updateFromServer();
			
			// Create item with DOI from list
			var promise = waitForItemEvent('refresh');
			var item = createUnsavedDataObject('item', { itemType: 'journalArticle' });
			item.setField('DOI', doi);
			await item.saveTx();
			await promise;
			
			assert.isTrue(Zotero.Retractions.isRetracted(item));
			
			// Make a second request, with the entry removed
			promise = waitForItemEvent('refresh');
			await Zotero.Retractions.updateFromServer();
			await promise;
			
			assert.isFalse(Zotero.Retractions.isRetracted(item));
		});
	});
	
	
	describe("#shouldShowCitationWarning()", function () {
		it("should return false if citation warning is hidden", async function () {
			var item = await createRetractedItem();
			assert.isTrue(Zotero.Retractions.shouldShowCitationWarning(item));
			await Zotero.Retractions.disableCitationWarningsForItem(item);
			assert.isFalse(Zotero.Retractions.shouldShowCitationWarning(item));
		});
		
		it("should return false if retraction is hidden", async function () {
			var item = await createRetractedItem();
			assert.isTrue(Zotero.Retractions.shouldShowCitationWarning(item));
			await Zotero.Retractions.hideRetraction(item);
			assert.isFalse(Zotero.Retractions.shouldShowCitationWarning(item));
		});
	});
	
	
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
		
		it("should hide Retracted Items collection when last retracted item is marked as hidden", async function () {
			var rowID = "R" + userLibraryID;
			
			// Create item
			var item = await createRetractedItem();
			assert.ok(zp.collectionsView.getRowIndexByID(rowID));
			
			// Select Retracted Items collection
			await zp.collectionsView.selectByID(rowID);
			await waitForItemsLoad(win);
			
			await Zotero.Retractions.hideRetraction(item);
			
			await Zotero.Promise.delay(50);
			// Retracted Items should be gone
			assert.isFalse(zp.collectionsView.getRowIndexByID(rowID));
			// And My Library should be selected
			assert.equal(zp.collectionsView.selectedTreeRow.id, "L" + userLibraryID);
		});
		
		it("shouldn't hide Retracted Items collection when last retracted item is marked to not show a citation warning", async function () {
			var rowID = "R" + userLibraryID;
			
			// Create item
			var item = await createRetractedItem();
			assert.ok(zp.collectionsView.getRowIndexByID(rowID));
			
			// Select Retracted Items collection
			await zp.collectionsView.selectByID(rowID);
			await waitForItemsLoad(win);
			
			await Zotero.Retractions.disableCitationWarningsForItem(item);
			
			await Zotero.Promise.delay(50);
			// Should still be showing
			assert.ok(zp.collectionsView.getRowIndexByID("R" + userLibraryID));
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
				sinon.spy(Zotero.Retractions, 'isRetracted')
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