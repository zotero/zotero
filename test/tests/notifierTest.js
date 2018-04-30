"use strict";

describe("Zotero.Notifier", function () {
	describe("#trigger()", function () {
		it("should trigger add events before modify events", function* () {
			var deferred = Zotero.Promise.defer();
			var events = [];
			var observer = {
				notify: (action, type, ids) => {
					events.push(action);
					if (events.length == 2) {
						deferred.resolve();
					}
				}
			};
			var id = Zotero.Notifier.registerObserver(observer, null, 'test_trigger');
			
			yield Zotero.DB.executeTransaction(function* () {
				var item = new Zotero.Item('book');
				item.setField('title', 'A');
				yield item.save();
				item.setField('title', 'B');
				yield item.save();
				
				Zotero.Notifier.queue('unknown', 'item', item.id);
			});
			
			assert.isTrue(deferred.promise.isResolved());
			assert.lengthOf(events, 3);
			assert.equal(events[0], 'add');
			assert.equal(events[1], 'modify');
			assert.equal(events[2], 'unknown');
			
			Zotero.Notifier.unregisterObserver(id);
		});
		
		it("should add events to passed queue", function* () {
			var collection = yield createDataObject('collection');
			
			var deferred = Zotero.Promise.defer();
			var observer = {
				notify: () => deferred.resolve()
			};
			var id = Zotero.Notifier.registerObserver(observer, null, 'test_trigger');
			
			var queue = new Zotero.Notifier.Queue;
			var item = createUnsavedDataObject('item');
			item.setCollections([collection.id]);
			yield item.saveTx({
				notifierQueue: queue
			});
			assert.isTrue(deferred.promise.isPending());
			assert.equal(queue.size, 2);
			yield Zotero.Notifier.commit(queue);
			assert.isTrue(deferred.promise.isResolved());
			
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
			assert.isTrue(promise2.isRejected());
		});
	});
});
