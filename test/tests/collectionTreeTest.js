"use strict";

describe("Zotero.CollectionTree", function() {
	var win, zp, cv, userLibraryID;
	
	before(function* () {
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
		cv = zp.collectionsView;
		userLibraryID = Zotero.Libraries.userLibraryID;
	});
	beforeEach(function () {
		// TODO: Add a selectCollection() function and select a collection instead?
		return selectLibrary(win);
	})
	after(function () {
		win.close();
	});
	
	describe("#refresh()", function () {
		it("should show Duplicate Items and Unfiled Items by default and shouldn't show Retracted Items", function* () {
			Zotero.Prefs.clear('duplicateLibraries');
			Zotero.Prefs.clear('unfiledLibraries');
			Zotero.Prefs.clear('retractedLibraries');
			yield cv.refresh();
			assert.ok(cv.getRowIndexByID("D" + userLibraryID));
			assert.ok(cv.getRowIndexByID("U" + userLibraryID));
			assert.isFalse(cv.getRowIndexByID("R" + userLibraryID));
		});
		
		it("shouldn't show virtual collections if hidden", function* () {
			Zotero.Prefs.set('duplicateLibraries', `{"${userLibraryID}": false}`);
			Zotero.Prefs.set('unfiledLibraries', `{"${userLibraryID}": false}`);
			Zotero.Prefs.set('retractedLibraries', `{"${userLibraryID}": false}`);
			yield cv.refresh();
			assert.isFalse(cv.getRowIndexByID("D" + userLibraryID));
			assert.isFalse(cv.getRowIndexByID("U" + userLibraryID));
			assert.isFalse(cv.getRowIndexByID("R" + userLibraryID));
		});
		
		it("should maintain open state of group", function* () {
			var group1 = yield createGroup();
			var group2 = yield createGroup();
			var group1Row = cv.getRowIndexByID(group1.treeViewID);
			var group2Row = cv.getRowIndexByID(group2.treeViewID);
			
			// Open group 1 and close group 2
			if (!cv.isContainerOpen(group1Row)) {
				yield cv.toggleOpenState(group1Row);
			}
			if (cv.isContainerOpen(group2Row)) {
				yield cv.toggleOpenState(group2Row);
			}
			
			cv._saveOpenStates();
			// #_saveOpenStates is debounced
			yield Zotero.Promise.delay(500);
			
			group1Row = cv.getRowIndexByID(group1.treeViewID);
			group2Row = cv.getRowIndexByID(group2.treeViewID);
			
			yield cv.refresh();
			
			// Group rows shouldn't have changed
			assert.equal(cv.getRowIndexByID(group1.treeViewID), group1Row);
			assert.equal(cv.getRowIndexByID(group2.treeViewID), group2Row);
			// Group open states shouldn't have changed
			assert.isTrue(cv.isContainerOpen(group1Row));
			assert.isFalse(cv.isContainerOpen(group2Row));
		});
		
		it("should update associated item tree view", function* () {
			var collection = yield createDataObject('collection');
			var item = yield createDataObject('item', { collections: [collection.id] });
			yield cv.reload();
			yield cv.selectCollection(collection.id);
			yield cv.selectItem(item.id);
		});
	});
	
	describe("collapse/expand", function () {
		it("should close and open My Library repeatedly", function* () {
			yield cv.selectLibrary(userLibraryID);
			var row = cv.selection.focused;
			
			cv.collapseLibrary(userLibraryID);
			assert.equal(cv.selection.focused, row);
			assert.isFalse(cv.isContainerOpen(row));
			
			yield cv.expandLibrary(userLibraryID);
			assert.equal(cv.selection.focused, row);
			assert.ok(cv.isContainerOpen(row));
			
			cv.collapseLibrary(userLibraryID);
			assert.equal(cv.selection.focused, row);
			assert.isFalse(cv.isContainerOpen(row));
			
			yield cv.expandLibrary(userLibraryID);
			assert.equal(cv.selection.focused, row);
			assert.ok(cv.isContainerOpen(row));
		})
	})
	
	describe("#expandLibrary()", function () {
		var libraryRow, col1, col2, col3;
		
		before(function* () {
			yield cv.selectLibrary(userLibraryID);
			libraryRow = cv.selection.focused;
		});
		
		beforeEach(function* () {
			// My Library
			//   - A
			//     - B
			//       - C
			col1 = yield createDataObject('collection');
			col2 = yield createDataObject('collection', { parentID: col1.id });
			col3 = yield createDataObject('collection', { parentID: col2.id });
		});
		
		it("should open a library and respect stored container state", function* () {
			// Collapse B
			yield cv.toggleOpenState(cv.getRowIndexByID(col2.treeViewID));
			cv._saveOpenStates();
			// #_saveOpenStates is debounced
			yield Zotero.Promise.delay(500);
			
			// Close and reopen library
			yield cv.toggleOpenState(libraryRow);
			yield cv.expandLibrary(userLibraryID);

			assert.isTrue(cv.isContainerOpen(libraryRow));
			assert.isTrue(cv.isContainerOpen(cv.getRowIndexByID(col1.treeViewID)));
			assert.isFalse(cv.isContainerOpen(cv.getRowIndexByID(col2.treeViewID)));
		});
		
		it("should open a library and all subcollections in recursive mode", function* () {
			yield cv.toggleOpenState(cv.getRowIndexByID(col2.treeViewID));
			cv._saveOpenStates();
			// #_saveOpenStates is debounced
			yield Zotero.Promise.delay(500);
			
			// Close and reopen library
			yield cv.toggleOpenState(libraryRow);
			yield cv.expandLibrary(userLibraryID, true);

			assert.isTrue(cv.isContainerOpen(cv.getRowIndexByID(col1.treeViewID)));
			assert.isTrue(cv.isContainerOpen(cv.getRowIndexByID(col2.treeViewID)));
		});
		
		it("should open a group and show top-level collections", function* () {
			var group = yield createGroup();
			var libraryID = group.libraryID;
			var col1 = yield createDataObject('collection', { libraryID });
			var col2 = yield createDataObject('collection', { libraryID });
			var col3 = yield createDataObject('collection', { libraryID });
			var col4 = yield createDataObject('collection', { libraryID, parentID: col1.id });
			var col5 = yield createDataObject('collection', { libraryID, parentID: col4.id });
			
			// Close everything
			yield Zotero.Promise.all([col4, col1, group]
				.map(o => cv.toggleOpenState(cv.getRowIndexByID(o.treeViewID), false)));
			
			yield cv.expandLibrary(libraryID);
			
			assert.isNumber(cv.getRowIndexByID(col1.treeViewID));
			assert.isNumber(cv.getRowIndexByID(col2.treeViewID));
			assert.isNumber(cv.getRowIndexByID(col3.treeViewID));
			assert.isFalse(cv.getRowIndexByID(col4.treeViewID));
			assert.isFalse(cv.getRowIndexByID(col5.treeViewID));
		});
	});
	
	describe("#expandToCollection()", function () {
		it("should expand a collection to a subcollection", function* () {
			var collection1 = yield createDataObject('collection');
			var collection2 = createUnsavedDataObject('collection');
			collection2.parentID = collection1.id;
			yield collection2.saveTx({
				skipSelect: true
			});
			var row = cv.getRowIndexByID("C" + collection1.id);
			assert.isFalse(cv.isContainerOpen(row));
			
			yield cv.expandToCollection(collection2.id);
			cv.forceUpdate();
			
			// Make sure parent row position hasn't changed
			assert.equal(cv.getRowIndexByID("C" + collection1.id), row);
			// Parent should have been opened
			assert.isTrue(cv.isContainerOpen(row));
		})
	})
	
	describe("#selectByID()", function () {
		it("should select the trash", function* () {
			yield cv.selectByID("T1");
			var row = cv.selection.focused;
			var treeRow = cv.getRow(row);
			assert.ok(treeRow.isTrash());
			assert.equal(treeRow.ref.libraryID, userLibraryID);
		})
	})
	
	describe("#selectWait()", function () {
		it("shouldn't hang if row is already selected", function* () {
			var row = cv.getRowIndexByID("T" + userLibraryID);
			yield cv.selectWait(row);
			yield Zotero.Promise.delay(50);
			yield cv.selectWait(row);
		})
	})
	
	describe("#notify()", function () {
		it("should select a new collection", function* () {
			// Create collection
			var collection = new Zotero.Collection;
			collection.name = "Select new collection";
			var id = yield collection.saveTx();
			
			// New collection should be selected
			var selected = cv.getSelectedCollection(true);
			assert.equal(selected, id);
		});
		
		it("shouldn't select a new collection if skipNotifier is passed", function* () {
			// Create collection with skipNotifier flag
			var collection = new Zotero.Collection;
			collection.name = "No select on skipNotifier";
			var id = yield collection.saveTx({
				skipNotifier: true
			});
			
			// Library should still be selected
			assert.equal(cv.getSelectedLibraryID(), userLibraryID);
		});
		
		it("shouldn't select a new collection if skipSelect is passed", function* () {
			// Create collection with skipSelect flag
			var collection = new Zotero.Collection;
			collection.name = "No select on skipSelect";
			var id = yield collection.saveTx({
				skipSelect: true
			});
			
			// Library should still be selected
			assert.equal(cv.getSelectedLibraryID(), userLibraryID);
		});
		
		it("shouldn't select a modified collection", function* () {
			// Create collection
			var collection = new Zotero.Collection;
			collection.name = "No select on modify";
			var id = yield collection.saveTx();
			
			yield selectLibrary(win);
			
			collection.name = "No select on modify 2";
			yield collection.saveTx();
			
			// Modified collection should not be selected
			assert.equal(cv.getSelectedLibraryID(), userLibraryID);
		});
		
		it("should maintain selection on a selected modified collection", function* () {
			// Create collection
			var collection = new Zotero.Collection;
			collection.name = "Reselect on modify";
			var id = yield collection.saveTx();
			
			var selected = cv.getSelectedCollection(true);
			assert.equal(selected, id);
			
			collection.name = "Reselect on modify 2";
			yield collection.saveTx();
			
			// Modified collection should still be selected
			selected = cv.getSelectedCollection(true);
			assert.equal(selected, id);
		});
		
		describe(".deleted selection", function () {
			for (let objectType of ['collection', 'search']) {
				it(`should select next row when ${objectType} is moved to trash`, async function () {
					var ran = Zotero.Utilities.randomString();
					var o1 = await createDataObject(objectType, { name: ran + "AAA" });
					var o2 = await createDataObject(objectType, { name: ran + "BBB" });
					var o3 = await createDataObject(objectType, { name: ran + "CCC" });
					
					await cv.selectByID(o2.treeViewID);
					
					o2.deleted = true;
					await o2.saveTx();
					
					assert.equal(zp.getCollectionTreeRow().ref.id, o3.id);
				});
				
				it(`should maintain selection on ${objectType} when row above is moved to trash`, async function () {
					var ran = Zotero.Utilities.randomString();
					var o1 = await createDataObject(objectType, { name: ran + "AAA" });
					var o2 = await createDataObject(objectType, { name: ran + "BBB" });
					var o3 = await createDataObject(objectType, { name: ran + "CCC" });
					
					assert.equal(zp.getCollectionTreeRow().ref.id, o3.id);
					
					o1.deleted = true;
					await o1.saveTx();
					
					assert.equal(zp.getCollectionTreeRow().ref.id, o3.id);
				});
				
				it(`should maintain selection on trash when ${objectType} is restored`, async function () {
					var o = await createDataObject(objectType, { deleted: true });
					
					await cv.selectByID("T1");
					
					o.deleted = false;
					await o.saveTx();
					
					assert.isTrue(zp.getCollectionTreeRow().isTrash());
					
					// Row should have been added back
					assert.isAbove(cv.getRowIndexByID(o.treeViewID), 0);
				});
			}
		});
		
		for (let objectType of ['collection', 'search']) {
			it(`should select next row when ${objectType} is erased`, async function () {
				var ran = Zotero.Utilities.randomString();
				var o1 = await createDataObject(objectType, { name: ran + "AAA" });
				var o2 = await createDataObject(objectType, { name: ran + "BBB" });
				var o3 = await createDataObject(objectType, { name: ran + "CCC" });
				
				await cv.selectByID(o2.treeViewID);
				
				await o2.eraseTx();
				
				assert.equal(zp.getCollectionTreeRow().ref.id, o3.id);
			});
		}
		
		it("should update the editability of the current view", function* () {
			var group = yield createGroup({
				editable: false,
				filesEditable: false
			});
			yield cv.selectLibrary(group.libraryID);
			yield waitForItemsLoad(win);
			
			assert.isFalse(zp.getCollectionTreeRow().editable);
			var cmd = win.document.getElementById('cmd_zotero_newStandaloneNote');
			assert.isTrue(cmd.getAttribute('disabled') == 'true');
			
			group.editable = true;
			yield group.saveTx();
			
			assert.isTrue(zp.getCollectionTreeRow().editable);
			assert.isFalse(cmd.getAttribute('disabled') == 'true');
		});
		
		it("should re-sort a modified collection", function* () {
			var prefix = Zotero.Utilities.randomString() + " ";
			var collectionA = yield createDataObject('collection', { name: prefix + "A" });
			var collectionB = yield createDataObject('collection', { name: prefix + "B" });
			
			var aRow = cv.getRowIndexByID("C" + collectionA.id);
			var aRowOriginal = aRow;
			var bRow = cv.getRowIndexByID("C" + collectionB.id);
			assert.equal(bRow, aRow + 1);
			
			collectionA.name = prefix + "C";
			yield collectionA.saveTx();
			
			var aRow = cv.getRowIndexByID("C" + collectionA.id);
			var bRow = cv.getRowIndexByID("C" + collectionB.id);
			assert.equal(bRow, aRowOriginal);
			assert.equal(aRow, bRow + 1);
		})
		
		it("should re-sort a modified search", function* () {
			var prefix = Zotero.Utilities.randomString() + " ";
			var searchA = yield createDataObject('search', { name: prefix + "A" });
			var searchB = yield createDataObject('search', { name: prefix + "B" });
			
			var aRow = cv.getRowIndexByID("S" + searchA.id);
			var aRowOriginal = aRow;
			var bRow = cv.getRowIndexByID("S" + searchB.id);
			assert.equal(bRow, aRow + 1);
			
			searchA.name = prefix + "C";
			yield searchA.saveTx();
			
			var aRow = cv.getRowIndexByID("S" + searchA.id);
			var bRow = cv.getRowIndexByID("S" + searchB.id);
			assert.equal(bRow, aRowOriginal);
			assert.equal(aRow, bRow + 1);
		})
		
		
		it("should add collection after parent's subcollection and before non-sibling", function* () {
			var c0 = yield createDataObject('collection', { name: "Test" });
			var rootRow = cv.getRowIndexByID(c0.treeViewID);
			
			var c1 = yield createDataObject('collection', { name: "1", parentID: c0.id });
			var c2 = yield createDataObject('collection', { name: "2", parentID: c0.id });
			var c3 = yield createDataObject('collection', { name: "3", parentID: c1.id });
			var c4 = yield createDataObject('collection', { name: "4", parentID: c3.id });
			var c5 = yield createDataObject('collection', { name: "5", parentID: c1.id });
			
			assert.equal(cv.getRowIndexByID(c1.treeViewID), rootRow + 1);
			
			assert.isAbove(cv.getRowIndexByID(c1.treeViewID), cv.getRowIndexByID(c0.treeViewID));
			assert.isAbove(cv.getRowIndexByID(c2.treeViewID), cv.getRowIndexByID(c0.treeViewID));
			
			assert.isAbove(cv.getRowIndexByID(c3.treeViewID), cv.getRowIndexByID(c1.treeViewID));
			assert.isAbove(cv.getRowIndexByID(c5.treeViewID), cv.getRowIndexByID(c1.treeViewID));
			assert.isBelow(cv.getRowIndexByID(c5.treeViewID), cv.getRowIndexByID(c2.treeViewID));
			
			assert.equal(cv.getRowIndexByID(c4.treeViewID), cv.getRowIndexByID(c3.treeViewID) + 1);
		});
		
		
		it("should add multiple collections", function* () {
			var col1, col2;
			yield Zotero.DB.executeTransaction(async function () {
				col1 = createUnsavedDataObject('collection');
				col2 = createUnsavedDataObject('collection');
				await col1.save();
				await col2.save();
			});
			
			var aRow = cv.getRowIndexByID("C" + col1.id);
			var bRow = cv.getRowIndexByID("C" + col2.id);
			assert.isAbove(aRow, 0);
			assert.isAbove(bRow, 0);
			// skipSelect is implied for multiple collections, so library should still be selected
			assert.equal(cv.selection.focused, 0);
		});
		
		
		it("shouldn't refresh the items list when a collection is modified", function* () {
			var collection = yield createDataObject('collection');
			yield waitForItemsLoad(win);
			var itemsView = zp.itemsView;
			
			collection.name = "New Name";
			yield collection.saveTx();
			
			yield waitForItemsLoad(win);
			assert.equal(zp.itemsView, itemsView);
		})
		
		it("should add a saved search after collections", function* () {
			var collection = new Zotero.Collection;
			collection.name = "Test";
			var collectionID = yield collection.saveTx();
			
			var search = new Zotero.Search;
			search.name = "A Test Search";
			search.addCondition('title', 'contains', 'test');
			var searchID = yield search.saveTx();
			
			var collectionRow = cv._rowMap["C" + collectionID];
			var searchRow = cv._rowMap["S" + searchID];
			var duplicatesRow = cv._rowMap["D" + userLibraryID];
			var unfiledRow = cv._rowMap["U" + userLibraryID];
			
			assert.isAbove(searchRow, collectionRow);
			// If there's a duplicates row or an unfiled row, add before those.
			// Otherwise, add before the trash
			if (duplicatesRow !== undefined) {
				assert.isBelow(searchRow, duplicatesRow);
			}
			else if (unfiledRow !== undefined) {
				assert.isBelow(searchRow, unfiledRow);
			}
			else {
				var trashRow = cv._rowMap["T" + userLibraryID];
				assert.isBelow(searchRow, trashRow);
			}
		})
		
		it("shouldn't select a new group", function* () {
			var group = yield createGroup();
			// Library should still be selected
			assert.equal(cv.getSelectedLibraryID(), userLibraryID);
		})
		
		it("should remove a group and all children", function* () {
			// Make sure Group Libraries separator and header exist already,
			// since otherwise they'll interfere with the count
			yield getGroup();
			
			var originalRowCount = cv._rows.length;
			
			var group = yield createGroup();
			yield createDataObject('collection', { libraryID: group.libraryID });
			var c = yield createDataObject('collection', { libraryID: group.libraryID });
			yield createDataObject('collection', { libraryID: group.libraryID, parentID: c.id });
			yield createDataObject('collection', { libraryID: group.libraryID });
			yield createDataObject('collection', { libraryID: group.libraryID });
			
			// Group, collections, Duplicates, Unfiled, and trash
			assert.equal(cv._rows.length, originalRowCount + 9);
			
			// Select group
			yield cv.selectLibrary(group.libraryID);
			yield waitForItemsLoad(win);
			
			var spy = sinon.spy(cv, "refresh");
			try {
				yield group.eraseTx();
				
				assert.equal(cv._rows.length, originalRowCount);
				// Make sure the tree wasn't refreshed
				sinon.assert.notCalled(spy);
			}
			finally {
				spy.restore();
			}
		})
		
		it("should select a new feed", function* () {
			var feed = yield createFeed();
			// Feed should be selected
			assert.equal(cv.getSelectedLibraryID(), feed.id);
		});
		
		it("shouldn't select a new feed with skipSelect: true", function* () {
			var feed = yield createFeed({
				saveOptions: {
					skipSelect: true
				}
			});
			// Library should still be selected
			assert.equal(cv.getSelectedLibraryID(), userLibraryID);
		});
		
		it("should remove deleted feed", function* () {
			var feed = yield createFeed();
			yield cv.selectLibrary(feed.libraryID);
			waitForDialog();
			var id = feed.treeViewID;
			let promise = waitForCollectionTree(win);
			yield win.ZoteroPane.deleteSelectedCollection();
			yield promise;
			assert.isFalse(cv.getRowIndexByID(id))
		})
		
		it("should not reload tree upon feed update", async function () {
			var feed = await createFeed();
			await cv.selectLibrary(Zotero.Libraries.userLibraryID);
			try {
				var reloadSpy = sinon.spy(cv, 'reload');
				// A set of notifier calls  when a feed update is running
				Zotero.debug(feed.id, 2);
				await Zotero.Notifier.trigger('statusChanged', 'feed', feed.id);
				await Zotero.Notifier.trigger('modify', 'feed', feed.id);
				await Zotero.Notifier.trigger('unreadCountUpdated', 'feed', feed.id);
				await Zotero.Notifier.trigger('statusChanged', 'feed', feed.id);
				assert.isFalse(reloadSpy.called);
			} finally {
				reloadSpy.restore();
			}
		});
	});
	
	describe("#selectItem()", function () {
		it("should switch to library root if item isn't in collection", async function () {
			var item = await createDataObject('item');
			var collection = await createDataObject('collection');
			Zotero.debug(zp.itemsView._rows);
			await cv.selectItem(item.id);
			await waitForItemsLoad(win);
			assert.equal(cv.selection.focused, 0);
			assert.sameMembers(zp.itemsView.getSelectedItems(), [item]);
		});
	});
	
	describe("#selectItems()", function () {
		it("should switch to library root if at least one item isn't in the current collection", async function () {
			var collection = await createDataObject('collection');
			var item1 = await createDataObject('item', { collections: [collection.id] });
			var item2 = await createDataObject('item');
			await cv.selectItems([item1.id, item2.id]);
			await waitForItemsLoad(win);
			assert.equal(cv.selection.focused, 0);
			assert.sameMembers(zp.itemsView.getSelectedItems(true), [item1.id, item2.id]);
		});
	});
	
	describe("#onDrop()", function () {
		/**
		 * Simulate a drag and drop
		 *
		 * @param {String} type - 'item' or 'collection'
		 * @param {String|Object} targetRow - Tree row id (e.g., "L123"), or { row, orient }
		 * @param {Integer[]} collectionIDs
		 * @param {Promise} [promise] - If a promise is provided, it will be waited for and its
		 *     value returned after the drag. Otherwise, an 'add' event will be waited for, and
		 *     an object with 'ids' and 'extraData' will be returned.
		 */
		var onDrop = Zotero.Promise.coroutine(function* (objectType, targetRow, ids, promise, action = 'copy') {
			if (typeof targetRow == 'string') {
				var row = cv.getRowIndexByID(targetRow);
				var orient = 0;
			}
			else {
				var { row, orient } = targetRow;
			}
			
			Zotero.DragDrop.currentDragSource = objectType == "item" && zp.itemsView.collectionTreeRow;
			
			if (!promise) {
				promise = waitForNotifierEvent("add", objectType);
			}
			yield cv.onDrop({
				persist: () => 0,
				target: {ownerDocument: {defaultView: win}},
				dataTransfer: {
					dropEffect: action,
					effectAllowed: action,
					types: {
						contains: function (type) {
							return type == `zotero/${objectType}`;
						}
					},
					getData: function (type) {
						if (type == `zotero/${objectType}`) {
							return ids.join(",");
						}
					}
				}
			}, row);
			
			// Add observer to wait for add
			var result = yield promise;
			Zotero.DragDrop.currentDragSource = null;
			return result;
		});
		
		
		var canDrop = Zotero.Promise.coroutine(function* (type, targetRowID, ids) {
			var row = cv.getRowIndexByID(targetRowID);
			
			var dt = {
				dropEffect: 'copy',
				effectAllowed: 'copy',
				types: {
					contains: function (type) {
						return type == `zotero/${type}`;
					}
				},
				getData: function (type) {
					if (type == `zotero/${type}`) {
						return ids.join(",");
					}
				}
			};
			var canDrop = cv.canDropCheck(row, 0, dt);
			if (canDrop) {
				canDrop = yield cv.canDropCheckAsync(row, 0, dt);
			}
			return canDrop;
		});
		
		describe("with items", function () {
			it("should add an item to a collection", function* () {
				var collection = yield createDataObject('collection', false, { skipSelect: true });
				var item = yield createDataObject('item', false, { skipSelect: true });
				
				// Add observer to wait for collection add
				var deferred = Zotero.Promise.defer();
				var observerID = Zotero.Notifier.registerObserver({
					notify: function (event, type, ids, extraData) {
						if (type == 'collection-item' && event == 'add'
								&& ids[0] == collection.id + "-" + item.id) {
							setTimeout(function () {
								deferred.resolve();
							});
						}
					}
				}, 'collection-item', 'test');
				
				yield onDrop('item', 'C' + collection.id, [item.id], deferred.promise);
				
				Zotero.Notifier.unregisterObserver(observerID);
				
				yield cv.selectCollection(collection.id);
				yield waitForItemsLoad(win);
				
				var itemsView = win.ZoteroPane.itemsView;
				assert.equal(itemsView.rowCount, 1);
				var treeRow = itemsView.getRow(0);
				assert.equal(treeRow.ref.id, item.id);
			})
			
			it("should move an item from one collection to another", function* () {
				var collection1 = yield createDataObject('collection');
				yield waitForItemsLoad(win);
				var collection2 = yield createDataObject('collection', false, { skipSelect: true });
				var item = yield createDataObject('item', { collections: [collection1.id] });
				
				// Add observer to wait for collection add
				var deferred = Zotero.Promise.defer();
				var observerID = Zotero.Notifier.registerObserver({
					notify: function (event, type, ids, extraData) {
						if (type == 'collection-item' && event == 'add'
								&& ids[0] == collection2.id + "-" + item.id) {
							setTimeout(function () {
								deferred.resolve();
							});
						}
					}
				}, 'collection-item', 'test');
				
				let promise = zp.itemsView.waitForSelect();
				yield onDrop('item', 'C' + collection2.id, [item.id], deferred.promise, 'move');
				yield promise;
				
				Zotero.Notifier.unregisterObserver(observerID);
				
				// Source collection should be empty
				assert.equal(zp.itemsView.rowCount, 0);
				
				yield cv.selectCollection(collection2.id);
				yield waitForItemsLoad(win);
				
				// Target collection should have item
				assert.equal(zp.itemsView.rowCount, 1);
				var treeRow = zp.itemsView.getRow(0);
				assert.equal(treeRow.ref.id, item.id);
			});
			
			describe("My Publications", function () {
				function getItemModifyPromise(item) {
					// Add observer to wait for item modification
					return new Zotero.Promise((resolve) => {
						var observerID = Zotero.Notifier.registerObserver({
							notify: function (event, type, ids, extraData) {
								if (type == 'item' && event == 'modify' && ids[0] == item.id) {
									setTimeout(resolve);
									Zotero.Notifier.unregisterObserver(observerID);
								}
							}
						}, 'item', 'test');
					});
				}
				
				function acceptItemsWithoutFiles(win) {
					var doc = win.document;
					doc.getElementById('confirm-authorship-checkbox').checked = true;
					var wizard = doc.getElementById('publications-dialog-wizard');
					if (!doc.getElementById('include-files').disabled) {
						throw new Error("Include Files checkbox isn't disabled");
					}
					wizard.getButton('next').click();
				}
				
				function acceptItemsWithFiles(win) {
					var doc = win.document;
					doc.getElementById('include-files').checked = true;
					doc.getElementById('confirm-authorship-checkbox').checked = true;
					var wizard = doc.getElementById('publications-dialog-wizard');
					if (doc.getElementById('include-files').disabled) {
						throw new Error("Include Files checkbox shouldn't be disabled");
					}
					wizard.getButton('next').click();
					wizard.getButton('next').click();
				}
				
				it("should add an item to My Publications", async function () {
					// Remove other items in My Publications
					var s = new Zotero.Search();
					s.addCondition('libraryID', 'is', Zotero.Libraries.userLibraryID);
					s.addCondition('publications', 'true');
					var ids = await s.search();
					await Zotero.Items.erase(ids);
					
					var item = await createDataObject('item', false, { skipSelect: true });
					var libraryID = item.libraryID;
					
					var itemModifyPromise = getItemModifyPromise(item);
					var winPromise = waitForWindow('chrome://zotero/content/publicationsDialog.xhtml')
					var dropPromise = onDrop('item', 'P' + libraryID, [item.id], itemModifyPromise);
					acceptItemsWithoutFiles(await winPromise);
					await dropPromise;
					
					// Select publications and check for item
					await cv.selectByID("P" + libraryID);
					await waitForItemsLoad(win);
					var itemsView = win.ZoteroPane.itemsView
					assert.equal(itemsView.rowCount, 1);
					var treeRow = itemsView.getRow(0);
					assert.equal(treeRow.ref.id, item.id);
				});
				
				it("should add an item with a file attachment to My Publications", async function () {
					var item = await createDataObject('item', false, { skipSelect: true });
					var attachment = await importFileAttachment('test.png', { parentItemID: item.id });
					var libraryID = item.libraryID;
					
					var itemModifyPromise = getItemModifyPromise(item);
					var winPromise = waitForWindow('chrome://zotero/content/publicationsDialog.xhtml')
					var dropPromise = onDrop('item', 'P' + libraryID, [item.id], itemModifyPromise);
					acceptItemsWithFiles(await winPromise);
					await dropPromise;
					
					assert.isTrue(item.inPublications);
					// File attachment should be in My Publications
					assert.isTrue(attachment.inPublications);
				});
				
				it("should add an item with a linked URL attachment to My Publications", async function () {
					var item = await createDataObject('item', false, { skipSelect: true });
					var attachment = await Zotero.Attachments.linkFromURL({
						parentItemID: item.id,
						title: 'Test',
						url: 'http://127.0.0.1/',
						contentType: 'text/html'
					});
					var libraryID = item.libraryID;
					
					var itemModifyPromise = getItemModifyPromise(item);
					var winPromise = waitForWindow('chrome://zotero/content/publicationsDialog.xhtml')
					var dropPromise = onDrop('item', 'P' + libraryID, [item.id], itemModifyPromise);
					acceptItemsWithoutFiles(await winPromise);
					await dropPromise;
					
					assert.isTrue(item.inPublications);
					// Link attachment should be in My Publications
					assert.isTrue(attachment.inPublications);
				});
				
				it("shouldn't add linked file attachment to My Publications", async function () {
					var item = await createDataObject('item', false, { skipSelect: true });
					var attachment = await Zotero.Attachments.linkFromFile({
						parentItemID: item.id,
						title: 'Test',
						file: OS.Path.join(getTestDataDirectory().path, 'test.png'),
						contentType: 'image/png'
					});
					var libraryID = item.libraryID;
					
					var itemModifyPromise = getItemModifyPromise(item);
					var winPromise = waitForWindow('chrome://zotero/content/publicationsDialog.xhtml')
					var dropPromise = onDrop('item', 'P' + libraryID, [item.id], itemModifyPromise);
					acceptItemsWithoutFiles(await winPromise);
					await dropPromise;
					
					assert.isTrue(item.inPublications);
					// Linked URL attachment shouldn't be in My Publications
					assert.isFalse(attachment.inPublications);
				});
			});
			
			it("should copy an item with a PDF attachment containing annotations to a group", async function () {
				await Zotero.Users.setCurrentUserID(1);
				await Zotero.Users.setName(1, 'Name');
				
				var group = await createGroup();
				
				var item = await createDataObject('item', false, { skipSelect: true });
				var file = getTestDataDirectory();
				file.append('test.pdf');
				var attachment = await Zotero.Attachments.importFromFile({
					file,
					parentItemID: item.id
				});
				var annotation = await createAnnotation('highlight', attachment);
				
				var ids = (await onDrop('item', 'L' + group.libraryID, [item.id])).ids;
				
				await cv.selectLibrary(group.libraryID);
				await waitForItemsLoad(win);
				
				// Check parent
				var itemsView = win.ZoteroPane.itemsView;
				assert.equal(itemsView.rowCount, 1);
				var treeRow = itemsView.getRow(0);
				assert.equal(treeRow.ref.libraryID, group.libraryID);
				assert.equal(treeRow.ref.id, ids[0]);
				// New item should link back to original
				var linked = await item.getLinkedItem(group.libraryID);
				assert.equal(linked.id, treeRow.ref.id);
				
				// Check attachment
				assert.isTrue(itemsView.isContainer(0));
				itemsView.toggleOpenState(0);
				assert.equal(itemsView.rowCount, 2);
				treeRow = itemsView.getRow(1);
				assert.equal(treeRow.ref.id, ids[1]);
				// New attachment should link back to original
				linked = await attachment.getLinkedItem(group.libraryID);
				assert.equal(linked.id, treeRow.ref.id);
				
				// Check annotation
				var groupAttachment = Zotero.Items.get(treeRow.ref.id);
				var annotations = groupAttachment.getAnnotations();
				assert.lengthOf(annotations, 1);
				
				return group.eraseTx();
			});
			
			it("should copy a group item with a PDF attachment containing annotations to the personal library", async function () {
				await Zotero.Users.setCurrentUserID(1);
				await Zotero.Users.setName(1, 'Name 1');
				await Zotero.Users.setName(12345, 'Name 2');
				
				var group = await createGroup();
				await cv.selectLibrary(group.libraryID);
				
				var groupItem = await createDataObject('item', { libraryID: group.libraryID });
				var file = getTestDataDirectory();
				file.append('test.pdf');
				var attachment = await Zotero.Attachments.importFromFile({
					file,
					parentItemID: groupItem.id
				});
				var annotation = await createAnnotation('highlight', attachment);
				await annotation.saveTx();
				
				var ids = (await onDrop('item', 'L1', [groupItem.id])).ids;
				var newItem = Zotero.Items.get(ids[0]);
				
				// Check annotation
				var newAttachment = Zotero.Items.get(newItem.getAttachments())[0];
				var annotations = newAttachment.getAnnotations();
				assert.lengthOf(annotations, 1);
				
				return group.eraseTx();
			});
			
			it("should copy a standalone attachment to a group", async function () {
				await Zotero.Users.setCurrentUserID(1);
				await Zotero.Users.setName(1, 'Name 1');
				await Zotero.Users.setName(12345, 'Name 2');
				
				var group = await createGroup();
				
				var item = await importPDFAttachment();
				
				var ids = (await onDrop('item', 'L' + group.libraryID, [item.id])).ids;
				var newItem = Zotero.Items.get(ids[0]);
				
				assert.equal(newItem.libraryID, group.libraryID);
				assert.isTrue(newItem.isPDFAttachment());
				
				return group.eraseTx();
			});
			
			it("should not copy an item or its attachment to a group twice", function* () {
				var group = yield getGroup();
				
				var itemTitle = Zotero.Utilities.randomString();
				var item = yield createDataObject('item', false, { skipSelect: true });
				var file = getTestDataDirectory();
				file.append('test.png');
				var attachment = yield Zotero.Attachments.importFromFile({
					file: file,
					parentItemID: item.id
				});
				var attachmentTitle = Zotero.Utilities.randomString();
				attachment.setField('title', attachmentTitle);
				yield attachment.saveTx();
				
				yield onDrop('item', 'L' + group.libraryID, [item.id]);
				assert.isFalse(yield canDrop('item', 'L' + group.libraryID, [item.id]));
			})
			
			it("should copy an item from a read-only group to an editable group", async function () {
				var group1 = await createGroup();
				var item = await createDataObject('item', { libraryID: group1.libraryID });
				group1.editable = false;
				await group1.saveTx();
				var group2 = await createGroup();
				
				await cv.selectLibrary(group1.libraryID);
				await waitForItemsLoad(win);
				
				await onDrop('item', 'L' + group2.libraryID, [item.id]);
				
				assert.isFalse(await item.getLinkedItem(group2.libraryID));
				// New collection should link back to original
				assert.ok(await item.getLinkedItem(group2.libraryID, true));
				
				await group1.eraseTx();
				await group2.eraseTx();
			});
			
			it("should ignore a linked, trashed item when re-dragging an item to a group", async function () {
				var group = await getGroup();
				var collection = await createDataObject('collection', { libraryID: group.libraryID });
				
				var item = await createDataObject('item', false, { skipSelect: true });
				await onDrop('item', 'L' + group.libraryID, [item.id]);
				
				var droppedItem = await item.getLinkedItem(group.libraryID);
				droppedItem.setCollections([collection.id]);
				droppedItem.deleted = true;
				await droppedItem.saveTx();
				
				await onDrop('item', 'L' + group.libraryID, [item.id]);
				
				var linkedItem = await item.getLinkedItem(group.libraryID);
				assert.notEqual(linkedItem, droppedItem);
				
				assert.isTrue(droppedItem.deleted);
			})
		})
		
		
		describe("with collections", function () {
			it("should make a subcollection top-level", function* () {
				var collection1 = yield createDataObject('collection', { name: "A" }, { skipSelect: true });
				var collection2 = yield createDataObject('collection', { name: "C" }, { skipSelect: true });
				var collection3 = yield createDataObject('collection', { name: "D" }, { skipSelect: true });
				var collection4 = yield createDataObject('collection', { name: "B", parentKey: collection2.key });
				
				var colIndex1 = cv.getRowIndexByID('C' + collection1.id);
				var colIndex2 = cv.getRowIndexByID('C' + collection2.id);
				var colIndex3 = cv.getRowIndexByID('C' + collection3.id);
				var colIndex4 = cv.getRowIndexByID('C' + collection4.id);
				
				// Add observer to wait for collection add
				var deferred = Zotero.Promise.defer();
				var observerID = Zotero.Notifier.registerObserver({
					notify: function (event, type, ids, extraData) {
						if (type == 'collection' && event == 'modify' && ids[0] == collection4.id) {
							setTimeout(function () {
								deferred.resolve();
							}, 50);
						}
					}
				}, 'collection', 'test');
				
				yield onDrop(
					'collection',
					{
						row: 0,
						orient: 1
					},
					[collection4.id],
					deferred.promise
				);
				
				Zotero.Notifier.unregisterObserver(observerID);
				
				var newColIndex1 = cv.getRowIndexByID('C' + collection1.id);
				var newColIndex2 = cv.getRowIndexByID('C' + collection2.id);
				var newColIndex3 = cv.getRowIndexByID('C' + collection3.id);
				var newColIndex4 = cv.getRowIndexByID('C' + collection4.id);
				
				assert.equal(newColIndex1, colIndex1);
				assert.isBelow(newColIndex4, newColIndex2);
				assert.isBelow(newColIndex2, newColIndex3);
				assert.equal(cv.getRow(newColIndex4).level, cv.getRow(newColIndex1).level);
			})
			                                                                                         
			it("should move a subcollection and its subcollection down under another collection", function* () {
				var collectionA = yield createDataObject('collection', { name: "A" }, { skipSelect: true });
				var collectionB = yield createDataObject('collection', { name: "B", parentKey: collectionA.key });
				var collectionC = yield createDataObject('collection', { name: "C", parentKey: collectionB.key });
				var collectionD = yield createDataObject('collection', { name: "D" }, { skipSelect: true });
				var collectionE = yield createDataObject('collection', { name: "E" }, { skipSelect: true });
				var collectionF = yield createDataObject('collection', { name: "F" }, { skipSelect: true });
				var collectionG = yield createDataObject('collection', { name: "G", parentKey: collectionD.key });
				var collectionH = yield createDataObject('collection', { name: "H", parentKey: collectionG.key });
				
				var colIndexA = cv.getRowIndexByID('C' + collectionA.id);
				var colIndexB = cv.getRowIndexByID('C' + collectionB.id);
				var colIndexC = cv.getRowIndexByID('C' + collectionC.id);
				var colIndexD = cv.getRowIndexByID('C' + collectionD.id);
				var colIndexE = cv.getRowIndexByID('C' + collectionE.id);
				var colIndexF = cv.getRowIndexByID('C' + collectionF.id);
				var colIndexG = cv.getRowIndexByID('C' + collectionG.id);
				var colIndexH = cv.getRowIndexByID('C' + collectionH.id);
				
				yield cv.selectCollection(collectionG.id);                                                 
				
				// Add observer to wait for collection add
				var deferred = Zotero.Promise.defer();                                                                          
				var observerID = Zotero.Notifier.registerObserver({
					notify: function (event, type, ids, extraData) {
						if (type == 'collection' && event == 'modify' && ids[0] == collectionG.id) {
							setTimeout(function () {
								deferred.resolve();
							}, 50);
						}
					}
				}, 'collection', 'test');
				
				yield onDrop(
					'collection',
					{
						row: colIndexE,
						orient: 0
					},
					[collectionG.id],
					deferred.promise
				);
				
				Zotero.Notifier.unregisterObserver(observerID);
				
				var newColIndexA = cv.getRowIndexByID('C' + collectionA.id);
				var newColIndexB = cv.getRowIndexByID('C' + collectionB.id);
				var newColIndexC = cv.getRowIndexByID('C' + collectionC.id);
				var newColIndexD = cv.getRowIndexByID('C' + collectionD.id);
				var newColIndexE = cv.getRowIndexByID('C' + collectionE.id);
				var newColIndexF = cv.getRowIndexByID('C' + collectionF.id);
				var newColIndexG = cv.getRowIndexByID('C' + collectionG.id);
				var newColIndexH = cv.getRowIndexByID('C' + collectionH.id);
				
				assert.isFalse(cv.isContainerOpen(newColIndexD));
				assert.isTrue(cv.isContainerEmpty(newColIndexD));
				assert.isTrue(cv.isContainerOpen(newColIndexE));
				assert.isFalse(cv.isContainerEmpty(newColIndexE));
				assert.equal(newColIndexE, newColIndexG - 1);
				assert.equal(newColIndexG, newColIndexH - 1);
				
				// TODO: Check deeper subcollection open states
			})
				
			it("should move a subcollection and its subcollection up under another collection", function* () {
				var collectionA = yield createDataObject('collection', { name: "A" }, { skipSelect: true });
				var collectionB = yield createDataObject('collection', { name: "B", parentKey: collectionA.key });
				var collectionC = yield createDataObject('collection', { name: "C", parentKey: collectionB.key });
				var collectionD = yield createDataObject('collection', { name: "D" }, { skipSelect: true });
				var collectionE = yield createDataObject('collection', { name: "E" }, { skipSelect: true });
				var collectionF = yield createDataObject('collection', { name: "F" }, { skipSelect: true });
				var collectionG = yield createDataObject('collection', { name: "G", parentKey: collectionE.key });
				var collectionH = yield createDataObject('collection', { name: "H", parentKey: collectionG.key });
				
				var colIndexA = cv.getRowIndexByID('C' + collectionA.id);
				var colIndexB = cv.getRowIndexByID('C' + collectionB.id);
				var colIndexC = cv.getRowIndexByID('C' + collectionC.id);
				var colIndexD = cv.getRowIndexByID('C' + collectionD.id);
				var colIndexE = cv.getRowIndexByID('C' + collectionE.id);
				var colIndexF = cv.getRowIndexByID('C' + collectionF.id);
				var colIndexG = cv.getRowIndexByID('C' + collectionG.id);
				var colIndexH = cv.getRowIndexByID('C' + collectionH.id);
				
				yield cv.selectCollection(collectionG.id);
				
				// Add observer to wait for collection add
				var deferred = Zotero.Promise.defer();
				var observerID = Zotero.Notifier.registerObserver({
					notify: function (event, type, ids, extraData) {
						if (type == 'collection' && event == 'modify' && ids[0] == collectionG.id) {
							setTimeout(function () {
								deferred.resolve();
							}, 50);
						}
					}
				}, 'collection', 'test');
				
				yield onDrop(
					'collection',
					{
						row: colIndexD,
						orient: 0
					},
					[collectionG.id],
					deferred.promise
				);
				
				Zotero.Notifier.unregisterObserver(observerID);
				
				var newColIndexA = cv.getRowIndexByID('C' + collectionA.id);
				var newColIndexB = cv.getRowIndexByID('C' + collectionB.id);
				var newColIndexC = cv.getRowIndexByID('C' + collectionC.id);
				var newColIndexD = cv.getRowIndexByID('C' + collectionD.id);
				var newColIndexE = cv.getRowIndexByID('C' + collectionE.id);
				var newColIndexF = cv.getRowIndexByID('C' + collectionF.id);
				var newColIndexG = cv.getRowIndexByID('C' + collectionG.id);
				var newColIndexH = cv.getRowIndexByID('C' + collectionH.id);
				
				assert.isFalse(cv.isContainerOpen(newColIndexE));
				assert.isTrue(cv.isContainerEmpty(newColIndexE));
				assert.isTrue(cv.isContainerOpen(newColIndexD));
				assert.isFalse(cv.isContainerEmpty(newColIndexD));
				assert.equal(newColIndexD, newColIndexG - 1);
				assert.equal(newColIndexG, newColIndexH - 1);
				
				// TODO: Check deeper subcollection open states
			})
			
			it("should copy a collection and its subcollection to another library", async function () {
				var group = await createGroup();
				
				var collectionA = await createDataObject('collection', { name: "A" }, { skipSelect: true });
				var collectionB = await createDataObject('collection', { name: "B", parentKey: collectionA.key });
				var itemA = await createDataObject('item', { collections: [collectionA.key] }, { skipSelect: true });
				var itemB = await createDataObject('item', { collections: [collectionB.key] }, { skipSelect: true });
				
				await cv.selectCollection(collectionA.id);
				
				// Add observer to wait for collection add
				var deferred = Zotero.Promise.defer();
				var observerID = Zotero.Notifier.registerObserver({
					notify: function (event, type, ids, extraData) {
						if (type == 'collection' && event == 'modify' && ids.includes(collectionB.id)) {
							setTimeout(function () {
								deferred.resolve();
							}, 50);
						}
					}
				}, 'collection', 'test');
				
				await onDrop(
					'collection',
					'L' + group.libraryID,
					[collectionA.id],
					deferred.promise
				);
				
				Zotero.Notifier.unregisterObserver(observerID);
				
				var pred = Zotero.Relations.linkedObjectPredicate;
				var newCollectionA = await Zotero.URI.getURICollection(collectionA.getRelations()[pred][0]);
				var newCollectionB = await Zotero.URI.getURICollection(collectionB.getRelations()[pred][0]);
				var newItemA = await Zotero.URI.getURIItem(itemA.getRelations()[pred][0]);
				var newItemB = await Zotero.URI.getURIItem(itemB.getRelations()[pred][0]);
				assert.equal(newCollectionA.libraryID, group.libraryID);
				assert.equal(newCollectionB.libraryID, group.libraryID);
				assert.equal(newCollectionB.parentID, newCollectionA.id);
				assert.equal(newItemA.libraryID, group.libraryID);
				assert.equal(newItemB.libraryID, group.libraryID);
				assert.isTrue(newCollectionA.hasItem(newItemA));
				assert.isTrue(newCollectionB.hasItem(newItemB));
				assert.isFalse(newCollectionA.hasItem(newItemB));
				assert.isFalse(newCollectionB.hasItem(newItemA));
			})
			
			it("should copy a collection from a read-only group to another group", async function () {
				var group1 = await createGroup();
				var collection = await createDataObject('collection', { libraryID: group1.libraryID });
				var item = await createDataObject('item', { libraryID: group1.libraryID, collections: [collection.id] });
				group1.editable = false;
				await group1.saveTx();
				
				var group2 = await createGroup();
				
				await cv.selectCollection(collection.id);
				await waitForItemsLoad(win);
				
				await onDrop('collection', 'L' + group2.libraryID, [collection.id]);
				
				assert.isFalse(await collection.getLinkedCollection(group2.libraryID));
				// New collection should link back to original
				assert.ok(await collection.getLinkedCollection(group2.libraryID, true));
				
				assert.isFalse(await item.getLinkedItem(group2.libraryID));
				// New item should link back to original
				assert.ok(await item.getLinkedItem(group2.libraryID, true));
				
				await group1.eraseTx();
				await group2.eraseTx();
			});
		})


		describe("with feed items", function () {
			Components.utils.import("resource://zotero-unit/httpd.js");
			
			const httpdPort = 16214;
			var httpd;
			
			before(async function () {
				httpd = new HttpServer();
				httpd.start(httpdPort);
			});
			
			after(async function () {
				await new Promise(resolve => httpd.stop(resolve));
			});
			
			it("should add a translated feed item retrieved from a URL", function* () {
				// Serve the feed entry webpage via localhost
				const urlPath = "/journalArticle-single.html";
				const url = `http://localhost:${httpdPort}` + urlPath;
				httpd.registerFile(
					urlPath,
					Zotero.File.pathToFile(OS.Path.join(
						getTestDataDirectory().path, 'metadata', 'journalArticle-single.html'
					))
				);
				
				var feed = yield createFeed();
				var collection = yield createDataObject('collection', false, { skipSelect: true });
				var feedItem = yield createDataObject('feedItem', {libraryID: feed.libraryID}, { skipSelect: true });
				feedItem.setField('url', url);
				yield feedItem.saveTx();
				var translateFn = sinon.spy(feedItem, 'translate');
				
				// Add observer to wait for collection add
				var deferred = Zotero.Promise.defer();
				var itemIds;

				var ids = (yield onDrop('item', 'C' + collection.id, [feedItem.id])).ids;
				
				// Check that the translated item was the one that was created after drag
				var item;
				yield translateFn.returnValues[0].then(function(i) {
					item = i;
					assert.equal(item.id, ids[0]);
				});
				
				yield cv.selectCollection(collection.id);
				yield waitForItemsLoad(win);
				
				var itemsView = win.ZoteroPane.itemsView;
				assert.equal(itemsView.rowCount, 1);
				var treeRow = itemsView.getRow(0);
				assert.equal(treeRow.ref.id, item.id);
			})
		})
	})

	describe("Feeds pseudo-library", function () {
		beforeEach(async function () {
			for (let feed of Zotero.Feeds.getAll()) {
				await feed.eraseTx();
			}
		});
		
		it("should contain feed items from all feeds", async function () {
			let feed1 = await createFeed();
			let feed2 = await createFeed();
			let feedItem1 = await createDataObject('feedItem', { libraryID: feed1.libraryID }, { skipSelect: true });
			let feedItem2 = await createDataObject('feedItem', { libraryID: feed2.libraryID }, { skipSelect: true });
			await cv.selectFeeds();
			await waitForItemsLoad(win);
			
			let itemsView = zp.itemsView;
			assert.equal(itemsView.rowCount, 2);
			assert.equal(itemsView.getRow(0).ref.id, feedItem2.id);
			assert.equal(itemsView.getRow(1).ref.id, feedItem1.id);
		});

		it("should be filterable", async function () {
			let feed1 = await createFeed();
			let feed2 = await createFeed();
			let feedItem1 = await createDataObject('feedItem', { libraryID: feed1.libraryID, setTitle: true }, { skipSelect: true });
			let feedItem2 = await createDataObject('feedItem', { libraryID: feed2.libraryID, setTitle: true }, { skipSelect: true });
			await cv.selectFeeds();
			await waitForItemsLoad(win);

			var quickSearch = win.document.getElementById('zotero-tb-search-textbox');
			quickSearch.value = feedItem1.getField('title');
			quickSearch.doCommand();

			let itemsView = zp.itemsView;
			await itemsView._refreshPromise;
			assert.equal(itemsView.rowCount, 1);
			assert.equal(itemsView.getRow(0).ref.id, feedItem1.id);
		});

		it("should be bold if any feed items are unread", async function () {
			let feed1 = await createFeed();
			let feed2 = await createFeed();
			let feedItem1 = await createDataObject('feedItem', { libraryID: feed1.libraryID, setTitle: true }, { skipSelect: true });
			let feedItem2 = await createDataObject('feedItem', { libraryID: feed2.libraryID, setTitle: true }, { skipSelect: true });
			
			await feedItem1.toggleRead(true);
			
			// Unread count is automatically updated on feed refresh, but we need to do it manually here
			await feed1.updateUnreadCount();
			await feed2.updateUnreadCount();
			
			assert.equal(cv.getRow(cv.getRowIndexByID('F1')).ref.unreadCount, 1);
			assert.lengthOf(win.document.querySelectorAll('#zotero-collections-tree .row.unread'), 2);
		});
	});

	describe("#setFilter()", function () {
		var collection1, collection2, collection3, collection4, collection5, collection6, collection7, collection8;
		var search1, search2, feed1, feed2;
		var allRows = [];
		let keyboardClick = (key) => {
			return new KeyboardEvent('keydown', {
				key: key,
				code: key,
				bubbles: true,
			});
		};
		before(async function () {
			// Delete all previously added collections, feeds, searches
			for (let col of Zotero.Collections.getByLibrary(userLibraryID)) {
				await col.eraseTx();
			}
			await clearFeeds();
			for (let s of Zotero.Searches.getByLibrary(userLibraryID)) {
				await s.eraseTx();
			}
			// Display the collection search bar
			win.document.getElementById("zotero-tb-collections-search").click();
			// Do not hide the search panel on blur
			win.document.getElementById("zotero-collections-search").removeEventListener('blur', zp.hideCollectionSearch);

			feed1 = await createFeed({ name: "feed_1 " });
			feed2 = await createFeed({ name: "feed_2" });
			
			collection1 = await createDataObject('collection', { name: "collection_level_one", libraryID: userLibraryID });
			collection2 = await createDataObject('collection', { name: "collection_level_two_1", parentID: collection1.id, libraryID: userLibraryID });
			collection3 = await createDataObject('collection', { name: "collection_level_two_2", parentID: collection1.id, libraryID: userLibraryID });
			collection4 = await createDataObject('collection', { name: "collection_level_three_1", parentID: collection2.id, libraryID: userLibraryID });
			collection5 = await createDataObject('collection', { name: "collection_level_three_11", parentID: collection2.id, libraryID: userLibraryID });
			collection6 = await createDataObject('collection', { name: "collection_level_one_1", libraryID: userLibraryID });
			collection7 = await createDataObject('collection', { name: "collection_level_two_21", parentID: collection6.id, libraryID: userLibraryID });
			collection8 = await createDataObject('collection', { name: "collection_level_two_22", parentID: collection6.id, libraryID: userLibraryID });
			search1 = await createDataObject('search', { name: "search_1", libraryID: userLibraryID });
			search2 = await createDataObject('search', { name: "search_2", libraryID: userLibraryID });
			allRows = [feed1, feed2, collection1, collection2, collection3, collection4, collection5, collection6, collection7, collection8, search1, search2];
		});

		beforeEach(async function () {
			// Empty filter and let it settle
			await cv.setFilter("");
		});

		after(async function () {
			await cv.setFilter("");
		});

		for (let type of ['collection', 'search', 'feed']) {
			// eslint-disable-next-line no-loop-func
			it(`should show only ${type} matching the filter`, async function () {
				await cv.setFilter(type);
				let displayedRowNames = cv._rows.filter(row => row.type == type).map(row => row.getName());
				let expectedRowNames = allRows.filter(row => row.name.includes(type)).map(row => row.name);
				assert.sameMembers(displayedRowNames, expectedRowNames);
			});
		}

		it('should show non-passing entries whose children pass the filter', async function () {
			await cv.setFilter("three");
			let displayedRowNames = cv._rows.filter(row => row.type == "collection").map(row => row.ref.name);
			let expectedNames = [
				"collection_level_one",
				"collection_level_two_1",
				"collection_level_three_1",
				"collection_level_three_11"
			];
			assert.sameMembers(displayedRowNames, expectedNames);
		});

		it('should be able to expand to see non-passing subcollections', async function () {
			await cv.setFilter("collection_level_one_1");
			// After filtering, only the matching collection is displayed
			let displayedRowNames = cv._rows.filter(row => row.type == "collection").map(row => row.ref.name);
			let expectedNames = [
				"collection_level_one_1"
			];
			assert.sameMembers(displayedRowNames, expectedNames);

			await cv.expandLibrary(userLibraryID, true);
			// But it can be expanded to reveal subcollections even if they don't match
			displayedRowNames = cv._rows.filter(row => row.type == "collection").map(row => row.ref.name);
			expectedNames = [
				"collection_level_one_1",
				"collection_level_two_21",
				"collection_level_two_22",
			];
			assert.sameMembers(displayedRowNames, expectedNames);
		});

		it('should not move focus from selected collection during filtering', async function () {
			await cv.selectByID("C" + collection5.id);
			await cv.setFilter("three");
			let focusedRow = cv.getRow(cv.selection.focused);
			assert.equal(focusedRow.id, "C" + collection5.id);
			await cv.setFilter("two");
			focusedRow = cv.getRow(cv.selection.focused);
			assert.equal(focusedRow.id, "C" + collection5.id);
		});

		it('should collapse collections collapsed before filtering', async function () {
			// Collapse top level collections 1 and 6
			for (let c of [collection1, collection6]) {
				let index = cv.getRowIndexByID("C" + c.id);
				let row = cv.getRow(index);
				if (row.isOpen) {
					await cv.toggleOpenState(index);
				}
			}
			
			await cv.setFilter(collection5.name);

			// Collection 1 and 2 have a matching child, so they are opened
			let colOneRow = cv.getRow(cv.getRowIndexByID("C" + collection1.id));
			assert.isTrue(colOneRow.isOpen);
			let colTwoRow = cv.getRow(cv.getRowIndexByID("C" + collection2.id));
			assert.isTrue(colTwoRow.isOpen);
			// Collection 6 has no matches, it is filtered out
			let colSixRowIndex = cv.getRowIndexByID("C" + collection6.id);
			assert.isFalse(colSixRowIndex);

			// Empty the filter
			await cv.setFilter("");

			// Collection 1 and 6 should remain collapsed as before filtering
			colOneRow = cv.getRow(cv.getRowIndexByID("C" + collection1.id));
			assert.isFalse(colOneRow.isOpen);
			let colSixRow = cv.getRow(cv.getRowIndexByID("C" + collection6.id));
			assert.isFalse(colSixRow.isOpen);
		});

		for (let type of ['collection', 'search']) {
			// eslint-disable-next-line no-loop-func
			it(`should hide ${type} if it's renamed to not match the filter`, async function () {
				let objectToSelect = type == 'collection' ? collection1 : search1;
				await cv.setFilter(objectToSelect.name);
				let originalName = objectToSelect.name;
				objectToSelect.name += "_updated";
				await objectToSelect.saveTx();
				let displayedRowNames = cv._rows.map(row => row.getName());
				assert.include(displayedRowNames, objectToSelect.name);

				objectToSelect.name = "not_matching_filter";
				await objectToSelect.saveTx();
				displayedRowNames = cv._rows.map(row => row.getName());
				assert.notInclude(displayedRowNames, objectToSelect.name);

				objectToSelect.name = originalName;
				await objectToSelect.saveTx();
			});
		}

		for (let type of ['collection', 'search']) {
			// eslint-disable-next-line no-loop-func
			it(`should only add ${type} if its name matches the filter`, async function () {
				await cv.setFilter(type);
				let newCollection = await createDataObject(type, { name: `new_${type}`, libraryID: userLibraryID });

				let displayedRowNames = cv._rows.map(row => row.ref.name);
				assert.include(displayedRowNames, newCollection.name);

				newCollection = await createDataObject(type, { name: `not_passing_${type.substring(1)}`, libraryID: userLibraryID });

				displayedRowNames = cv._rows.map(row => row.ref.name);
				assert.notInclude(displayedRowNames, newCollection.name);
			});
		}

		it(`should focus selected collection on Enter if it matches filter`, async function () {
			await cv.selectByID(`C${collection3.id}`);
			win.document.getElementById("zotero-collections-search").value = "_2";
			await cv.setFilter("_2");
			win.document.getElementById("zotero-collections-search").dispatchEvent(keyboardClick("Enter"));
			assert.equal(cv.getSelectedCollection(true), collection3.id);
			assert.equal(win.document.activeElement.id, 'collection-tree');
		});

		it(`should focus first matching collection on Enter if selected collection does not match filter`, async function () {
			await cv.selectByID(`C${collection2.id}`);
			win.document.getElementById("zotero-collections-search").focus();
			win.document.getElementById("zotero-collections-search").value = "_2";
			await cv.setFilter("_2");
			win.document.getElementById("zotero-collections-search").dispatchEvent(keyboardClick("Enter"));
			// Wait for the selection to go through
			await Zotero.Promise.delay(100);
			assert.equal(cv.getSelectedCollection(true), collection3.id);
			assert.equal(win.document.activeElement.id, 'collection-tree');
		});

		it(`should not move focus from collection filter on Enter if no rows pass the filter`, async function () {
			await cv.selectByID(`C${collection3.id}`);
			win.document.getElementById("zotero-collections-search").focus();
			win.document.getElementById("zotero-collections-search").value = "Not matching anything";
			await cv.setFilter("Not matching anything");
			win.document.getElementById("zotero-collections-search").dispatchEvent(keyboardClick("Enter"));
			assert.equal(win.document.activeElement.id, 'zotero-collections-search');
		});

		it(`should skip context rows on arrow up/down`, async function () {
			await cv.selectByID(`C${collection2.id}`);
			await cv.setFilter("_2");
			await cv.focusFirstMatchingRow();
			// Skip collection6 that does not match on the way up and down
			for (let col of [collection3, collection7, collection8]) {
				assert.equal(cv.getSelectedCollection(true), col.id);
				await cv.focusNextMatchingRow(cv.selection.focused);
			}
			await cv.selectByID(`C${collection8.id}`);
			for (let col of [collection8, collection7, collection3]) {
				assert.equal(cv.getSelectedCollection(true), col.id);
				await cv.focusNextMatchingRow(cv.selection.focused, true);
			}
		});

		it(`should clear filter on Escape from collectionTree`, async function () {
			await cv.selectByID(`C${collection2.id}`);
			let colTree = win.document.getElementById('collection-tree');
			await cv.setFilter("_2");
			cv.focusFirstMatchingRow();
			colTree.dispatchEvent(keyboardClick("Escape"));
			assert.equal(cv._filter, "");
			assert.equal(cv.getSelectedCollection(true), collection2.id);
		});
	});
})
