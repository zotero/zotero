"use strict";

describe("Zotero.Notifier", function () {
	describe("#trigger()", function () {
		it("should trigger add events before modify events", async function () {
			var events = [];
			var observer = {
				notify: (action, type, ids) => {
					events.push(action);
				}
			};
			var id = Zotero.Notifier.registerObserver(observer, null, 'test_trigger');
			
			await Zotero.DB.executeTransaction(async function () {
				var item = new Zotero.Item('book');
				item.setField('title', 'A');
				await item.save();
				item.setField('title', 'B');
				await item.save();
				
				Zotero.Notifier.queue('unknown', 'item', item.id);
			});
			
			assert.lengthOf(events, 3);
			assert.equal(events[0], 'add');
			assert.equal(events[1], 'modify');
			assert.equal(events[2], 'unknown');
			
			Zotero.Notifier.unregisterObserver(id);
		});
		
		it("should add events to passed queue", async function () {
			var collection = await createDataObject('collection');
			
			var didNotify = false;
			var observer = {
				notify: () => didNotify = true
			};
			var id = Zotero.Notifier.registerObserver(observer, null, 'test_trigger');
			
			var queue = new Zotero.Notifier.Queue;
			var item = createUnsavedDataObject('item');
			item.setCollections([collection.id]);
			await item.saveTx({
				notifierQueue: queue
			});
			assert.isFalse(didNotify);
			assert.equal(queue.size, 2);
			await Zotero.Notifier.commit(queue);
			assert.isTrue(didNotify);
			
			Zotero.Notifier.unregisterObserver(id);
		});
	});
	
	describe("#queue", function () {
		it("should handle notification after DB timeout from another transaction", async function () {
			var promise1 = Zotero.DB.executeTransaction(async function () {
				var item = createUnsavedDataObject('item');
				await item.save();
				
				await Zotero.Promise.delay(2000);
				
				Zotero.Notifier.queue('refresh', 'item', item.id);
			}.bind(this));
			
			var promise2 = Zotero.DB.executeTransaction(async function () {
				var item = createUnsavedDataObject('item');
				await item.save();
			}.bind(this), { waitTimeout: 1000 });
			
			await promise1;
			assert.ok(await getPromiseError(promise2));
		});
	});
	
	describe("Queue", function () {
		describe("#commit()", function () {
			it("should add options from queue to extraData", async function () {
				var called = false;
				var data;
				
				var notifierID = Zotero.Notifier.registerObserver({
					notify: (event, type, ids, extraData) => {
						called = true;
						data = extraData;
					}
				});
				
				var notifierQueue = new Zotero.Notifier.Queue({
					skipAutoSync: true
				});
				
				var item = createUnsavedDataObject('item');
				await item.saveTx({
					notifierQueue
				});
				
				assert.isFalse(called);
				
				await Zotero.Notifier.commit(notifierQueue);
				
				assert.isTrue(called);
				assert.propertyVal(data, 'skipAutoSync', true);
				
				Zotero.Notifier.unregisterObserver(notifierID);
			});
		});
	});
});
