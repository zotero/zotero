"use strict";

describe("Zotero.DataObjects", function () {
	var types = ['collection', 'item', 'search'];
	
	describe("#get()", function () {
		it("should return false for nonexistent objects", function* () {
			assert.isFalse(Zotero.Items.get(3464363));
		});
	});
	
	describe("#getAsync()", function () {
		// TEMP: Currently just a warning
		it.skip("show throw if passed an invalid id", function* () {
			var e = yield getPromiseError(Zotero.Items.getAsync("[Object]"));
			assert.ok(e);
			assert.include(e.message, '(string)');
		});
	});
	
	describe("#getLibraryAndKeyFromID()", function () {
		it("should return a libraryID and key within a transaction", function* () {
			for (let type of types) {
				let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
				yield Zotero.DB.executeTransaction(async function () {
					let obj = createUnsavedDataObject(type);
					await obj.save();
					
					var {libraryID, key} = objectsClass.getLibraryAndKeyFromID(obj.id);
					assert.equal(libraryID, Zotero.Libraries.userLibraryID);
					assert.ok(key);
					assert.typeOf(key, 'string');
					assert.equal(key, obj.key);
					
					await obj.erase();
				});
			}
		});
		
		it("should return false after a save failure", function* () {
			for (let type of types) {
				let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
				var obj;
				try {
					yield Zotero.DB.executeTransaction(async function () {
						obj = createUnsavedDataObject(type);
						await obj.save();
						throw 'Aborting transaction -- ignore';
					});
				}
				catch (e) {
					if (typeof e != 'string' || !e.startsWith('Aborting transaction')) throw e;
				}
				
				// The registered identifiers should be reset in a rollback handler
				var libraryKey = objectsClass.getLibraryAndKeyFromID(obj.id);
				assert.isFalse(libraryKey);
			}
		});
	})
	
	describe("#exists()", function () {
		it("should return false after object is deleted", function* () {
			for (let type of types) {
				let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
				let obj = yield createDataObject(type);
				let id = obj.id;
				yield obj.eraseTx();
				assert.isFalse(objectsClass.exists(id), type + " does not exist");
			}
		})
	})
	
	
	describe("#sortByLevel()", function () {
		it("should return collections sorted from top-level to deepest", async function () {
			// - A
			//   - B
			//     - C
			//   - D
			// - E
			//   - F
			//     - G
			//       - H
			//     - I
			//
			// Leave out B and G
			//
			// Order should be {A, E}, {D, F}, {C, I}, {H} (internal order is undefined)
			
			var check = function (arr) {
				assert.sameMembers(arr.slice(0, 2), [c1, c5]);
				assert.sameMembers(arr.slice(2, 4), [c4, c6]);
				assert.sameMembers(arr.slice(4, 6), [c3, c9]);
				assert.equal(arr[6], c8);
			};
			
			var c1 = await createDataObject('collection', { "name": "A" });
			var c2 = await createDataObject('collection', { "name": "B", parentID: c1.id });
			var c3 = await createDataObject('collection', { "name": "C", parentID: c2.id });
			var c4 = await createDataObject('collection', { "name": "D", parentID: c1.id });
			var c5 = await createDataObject('collection', { "name": "E" });
			var c6 = await createDataObject('collection', { "name": "F", parentID: c5.id });
			var c7 = await createDataObject('collection', { "name": "G", parentID: c6.id });
			var c8 = await createDataObject('collection', { "name": "H", parentID: c7.id });
			var c9 = await createDataObject('collection', { "name": "I", parentID: c6.id });
			
			var arr = Zotero.Collections.sortByLevel([c1, c3, c4, c5, c6, c8, c9]);
			//Zotero.debug(arr.map(id => Zotero.Collections.get(id).name));
			check(arr);
			
			// Check reverse order
			arr = Zotero.Collections.sortByLevel([c1, c3, c4, c5, c6, c8, c9].reverse());
			//Zotero.debug(arr.map(id => Zotero.Collections.get(id).name));
			check(arr);
		});
	});
	
	
	describe("#sortByParent", function () {
		it("should return items sorted hierarchically", async function () {
			// - A
			//   - B
			//     - C
			//   - D
			// - E
			//   - F
			//     - G
			//       - H
			//     - I
			//
			// Leave out B and G
			//
			// Order should be top-down, with child items included immediately after their parents.
			// The order of items at the same level is undefined.
			
			function check(arr) {
				var str = arr.map(o => title(o)).join('');
				var possibilities = [
					'ACDEFH',
					'ACDEFH',
					
					'ADCEFH',
					'ADCEFH',
					
					'EFHACD',
					'EFHADC',
					
					'EFHACD',
					'EFHADC',
				];
				assert.oneOf(str, possibilities);
			}
			
			function title(o) {
				return o.getDisplayTitle() || o.getTags()[0].tag;
			}
			
			var a = await createDataObject('item', { title: "A" });
			var b = await createDataObject('item', { note: "B", itemType: 'note', parentID: a.id });
			var c = await createEmbeddedImage(b, { tags: [{ tag: 'C' }] });
			var d = await importPDFAttachment(a, { title: 'D' });
			var e = await createDataObject('item', { title: "E" });
			var f = await importPDFAttachment(e, { title: 'F' });
			var g = await createAnnotation('image', f, { tags: [{ tag: 'G' }] });
			var h = await createAnnotation('highlight', f, { tags: [{ tag: 'H' }] });
			
			var arr = Zotero.Items.sortByParent([a, c, d, e, f, h]);
			Zotero.debug(arr.map(o => title(o)));
			check(arr);
			
			// Reverse order
			arr = Zotero.Items.sortByParent([a, c, d, e, f, h].reverse());
			Zotero.debug(arr.map(o => title(o)));
			check(arr);
			
			// Top-level first
			arr = Zotero.Items.sortByParent([a, e, c, d, f, h]);
			Zotero.debug(arr.map(o => title(o)));
			check(arr);
			
			// Child first
			arr = Zotero.Items.sortByParent([c, h, d, f, a, e]);
			Zotero.debug(arr.map(o => title(o)));
			check(arr);
			
			// Random
			arr = Zotero.Items.sortByParent([e, d, h, c, a, f]);
			Zotero.debug(arr.map(o => title(o)));
			check(arr);
		});
	});
	
	
	describe("#_setIdentifier", function () {
		it("should not allow an id change", function* () {
			var item = yield createDataObject('item');
			try {
				item.id = item.id + 1;
			}
			catch (e) {
				assert.equal(e.message, "ID cannot be changed");
				return;
			}
			assert.fail("ID change allowed");
		})
		
		it("should not allow a key change", function* () {
			var item = yield createDataObject('item');
			try {
				item.key = Zotero.DataObjectUtilities.generateKey();
			}
			catch (e) {
				assert.equal(e.message, "Key cannot be changed");
				return;
			}
			assert.fail("Key change allowed");
		})
		
		it("should not allow key to be set if id is set", function* () {
			var item = createUnsavedDataObject('item');
			item.id = Zotero.Utilities.rand(100000, 1000000);
			try {
				item.libraryID = Zotero.Libraries.userLibraryID;
				item.key = Zotero.DataObjectUtilities.generateKey();
			}
			catch (e) {
				assert.equal(e.message, "Cannot set key if id is already set");
				return;
			}
			assert.fail("ID change allowed");
		})
		
		it("should not allow id to be set if key is set", function* () {
			var item = createUnsavedDataObject('item');
			item.libraryID = Zotero.Libraries.userLibraryID;
			item.key = Zotero.DataObjectUtilities.generateKey();
			try {
				item.id = Zotero.Utilities.rand(100000, 1000000);
			}
			catch (e) {
				assert.equal(e.message, "Cannot set id if key is already set");
				return;
			}
			assert.fail("Key change allowed");
		})
		
		it("should not allow key to be set if library isn't set", function* () {
			var item = createUnsavedDataObject('item');
			try {
				item.key = Zotero.DataObjectUtilities.generateKey();
			}
			catch (e) {
				assert.equal(e.message, "libraryID must be set before key");
				return;
			}
			assert.fail("libraryID change allowed");
		})
	})
})
