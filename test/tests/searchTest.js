describe("Zotero.Search", function() {
	describe("#name", function () {
		it("should fail if empty", async function () {
			var s = new Zotero.Search();
			assert.throws(() => s.name = '');
		});
	});
	
	describe("#addCondition()", function () {
		it("should convert old-style 'collection' condition value", function* () {
			var col = yield createDataObject('collection');
			var item = yield createDataObject('item', { collections: [col.id] });
			
			var s = new Zotero.Search();
			s.libraryID = item.libraryID;
			s.name = "Test";
			s.addCondition('collection', 'is', '0_' + col.key);
			var matches = yield s.search();
			assert.sameMembers(matches, [item.id]);
		});
	});
	
	// This is for Zotero.Search._loadConditions()
	describe("Loading", function () {
		it("should convert old-style 'collection' condition value", function* () {
			var col = yield createDataObject('collection');
			var item = yield createDataObject('item', { collections: [col.id] });
			
			var s = new Zotero.Search();
			s.libraryID = item.libraryID;
			s.name = "Test";
			s.addCondition('collection', 'is', col.key);
			yield s.saveTx();
			yield Zotero.DB.queryAsync(
				"UPDATE savedSearchConditions SET value=? WHERE savedSearchID=? AND condition=?",
				["0_" + col.key, s.id, 'collection']
			);
			yield s.reload(['conditions'], true);
			var matches = yield s.search();
			assert.sameMembers(matches, [item.id]);
		});
	});
	
	
	describe("#save()", function () {
		it("should fail without a name", function* () {
			var s = new Zotero.Search;
			s.addCondition('title', 'is', 'test');
			var e = yield getPromiseError(s.saveTx());
			assert.ok(e);
			assert.equal(e.constructor.name, Error.prototype.constructor.name); // TEMP: Error mismatch
			assert.equal(e.message, "Name not provided for saved search");
		});
		
		it("should save a new search", function* () {
			// Save search
			var s = new Zotero.Search;
			s.name = "Test";
			s.addCondition('title', 'is', 'test');
			var id = yield s.saveTx();
			assert.typeOf(id, 'number');
			
			// Check saved search
			s = Zotero.Searches.get(id);
			assert.ok(s);
			assert.instanceOf(s, Zotero.Search);
			assert.equal(s.libraryID, Zotero.Libraries.userLibraryID);
			assert.equal(s.name, "Test");
			var conditions = s.getConditions();
			assert.lengthOf(Object.keys(conditions), 1);
			assert.property(conditions, "0");
			var condition = conditions[0];
			assert.propertyVal(condition, 'condition', 'title')
			assert.propertyVal(condition, 'operator', 'is')
			assert.propertyVal(condition, 'value', 'test')
			assert.propertyVal(condition, 'required', false)
		});
		
		it("should add a condition to an existing search", function* () {
			// Save search
			var s = new Zotero.Search;
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.name = "Test";
			s.addCondition('title', 'is', 'test');
			var id = yield s.saveTx();
			assert.typeOf(id, 'number');
			
			// Add condition
			s = yield Zotero.Searches.getAsync(id);
			s.addCondition('title', 'contains', 'foo');
			var saved = yield s.saveTx();
			assert.isTrue(saved);
			
			// Check saved search
			s = yield Zotero.Searches.getAsync(id);
			var conditions = s.getConditions();
			assert.lengthOf(Object.keys(conditions), 2);
		});
		
		it("should remove a condition from an existing search", function* () {
			// Save search
			var s = new Zotero.Search;
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.name = "Test";
			s.addCondition('title', 'is', 'test');
			s.addCondition('title', 'contains', 'foo');
			var id = yield s.saveTx();
			assert.typeOf(id, 'number');
			
			// Remove condition
			s = yield Zotero.Searches.getAsync(id);
			s.removeCondition(0);
			var saved = yield s.saveTx();
			assert.isTrue(saved);
			
			// Check saved search
			s = yield Zotero.Searches.getAsync(id);
			var conditions = s.getConditions();
			assert.lengthOf(Object.keys(conditions), 1);
			assert.property(conditions, "0");
			assert.propertyVal(conditions[0], 'value', 'foo')
		});
	});

	describe("#search()", function () {
		var win;
		var userLibraryID;
		var fooItem;
		var foobarItem;
		var bazItem;
		var fooItemGroup;
		var foobarItemGroup;
		var bazItemGroup;

		before(async function () {
			await resetDB({
				thisArg: this,
				skipBundledFiles: true
			});
			
			// Hidden browser, which requires a browser window, needed for charset detection
			// (until we figure out a better way)
			win = await loadBrowserWindow();
			fooItem = await importFileAttachment("search/foo.html");
			foobarItem = await importFileAttachment("search/foobar.html");
			bazItem = await importFileAttachment("search/baz.pdf");
			userLibraryID = fooItem.libraryID;
			
			let group = await getGroup();
			fooItemGroup = await importFileAttachment("search/foo.html", { libraryID: group.libraryID });
			foobarItemGroup = await importFileAttachment("search/foobar.html", { libraryID: group.libraryID });
			bazItemGroup = await importFileAttachment("search/baz.pdf", { libraryID: group.libraryID });
		});

		after(function* () {
			if (win) {
				win.close();
			}
			yield fooItem.eraseTx();
			yield foobarItem.eraseTx();
			yield bazItem.eraseTx();
			yield fooItemGroup.eraseTx();
			yield foobarItemGroup.eraseTx();
			yield bazItemGroup.eraseTx();
		});
		
		describe("Conditions", function () {
			describe("title", function () {
				// TEMP
				it("shouldn't match parent attachments with annotations for 'title' 'does not contain' condition", async function () {
					var attachment = await importPDFAttachment();
					var title = "Attachment Title";
					attachment.setField('title', title);
					await attachment.saveTx();
					await createAnnotation('highlight', attachment);
					
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('title', 'doesNotContain', title);
					var matches = await s.search();
					assert.notInclude(matches, attachment.id);
				});
			});
			
			describe("collection", function () {
				it("should find item in collection", function* () {
					var col = yield createDataObject('collection');
					var item = yield createDataObject('item', { collections: [col.id] });
					
					var s = new Zotero.Search();
					s.libraryID = item.libraryID;
					s.addCondition('collection', 'is', col.key);
					var matches = yield s.search();
					assert.sameMembers(matches, [item.id]);
				});
				
				it("should find items not in collection", function* () {
					var col = yield createDataObject('collection');
					var item = yield createDataObject('item', { collections: [col.id] });
					
					var s = new Zotero.Search();
					s.libraryID = item.libraryID;
					s.addCondition('collection', 'isNot', col.key);
					var matches = yield s.search();
					assert.notInclude(matches, item.id);
				});
				
				it("shouldn't find item in collection with no items", function* () {
					var col = yield createDataObject('collection');
					var item = yield createDataObject('item');
					
					var s = new Zotero.Search();
					s.libraryID = item.libraryID;
					s.addCondition('collection', 'is', col.key);
					var matches = yield s.search();
					assert.lengthOf(matches, 0);
				});
				
				it("should find item in subcollection in recursive mode", function* () {
					var col1 = yield createDataObject('collection');
					var col2 = yield createDataObject('collection', { parentID: col1.id });
					var item = yield createDataObject('item', { collections: [col2.id] });
					
					var s = new Zotero.Search();
					s.libraryID = item.libraryID;
					s.addCondition('collection', 'is', col1.key);
					s.addCondition('recursive', 'true');
					var matches = yield s.search();
					assert.sameMembers(matches, [item.id]);
				});
				
				it("should return no results for a collection that doesn't exist in recursive mode", async function () {
					var item = await createDataObject('item');
					
					var s = new Zotero.Search();
					s.libraryID = item.libraryID;
					s.name = "Test";
					s.addCondition('collection', 'is', Zotero.DataObjectUtilities.generateKey());
					s.addCondition('recursive', 'true');
					var matches = await s.search();
					assert.lengthOf(matches, 0);
				});
			});
			
			describe("tag", function () {
				// TEMP
				it("should match parent attachments for annotation tags", async function () {
					var attachment = await importPDFAttachment();
					var annotation = await createAnnotation('highlight', attachment);
					var tag = Zotero.Utilities.randomString();
					annotation.addTag(tag);
					await annotation.saveTx();
					
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('tag', 'is', tag);
					var matches = await s.search();
					assert.sameMembers(matches, [attachment.id]);
				});
				
				// TEMP
				it("shouldn't match parent attachments with annotations for 'tag' 'is not' condition", async function () {
					var attachment = await importPDFAttachment();
					await createAnnotation('highlight', attachment);
					var tag = Zotero.Utilities.randomString();
					attachment.addTag(tag);
					await attachment.saveTx();
					
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('tag', 'isNot', tag);
					var matches = await s.search();
					assert.notInclude(matches, attachment.id);
				});
			});
			
			describe("dateAdded", function () {
				it("should handle 'today'", async function () {
					var item = await createDataObject('item');
					
					var s = new Zotero.Search();
					s.libraryID = item.libraryID;
					s.name = "Test";
					s.addCondition('dateAdded', 'is', 'today');
					var matches = await s.search();
					assert.includeMembers(matches, [item.id]);
					
					// Make sure 'yesterday' doesn't match
					s = new Zotero.Search();
					s.libraryID = item.libraryID;
					s.name = "Test";
					s.addCondition('dateAdded', 'is', 'yesterday');
					matches = await s.search();
					assert.lengthOf(matches, 0);
				});
			});
			
			describe("fileTypeID", function () {
				it("should search by attachment file type", function* () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('fileTypeID', 'is', Zotero.FileTypes.getID('webpage'));
					let matches = yield s.search();
					assert.sameMembers(matches, [fooItem.id, foobarItem.id]);
				});
			});
			
			describe("fulltextContent", function () {
				it("should find text in HTML files", function* () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('fulltextContent', 'contains', 'foo bar');
					var matches = yield s.search();
					assert.sameMembers(matches, [foobarItem.id]);
				});
				
				it("should work in subsearch", function* () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('fulltextContent', 'contains', 'foo bar');
					
					var s2 = new Zotero.Search();
					s2.setScope(s);
					s2.addCondition('title', 'contains', 'foobar');
					var matches = yield s2.search();
					assert.sameMembers(matches, [foobarItem.id]);
				});
				
				it("should find matching items with joinMode=ANY with no other conditions", async function () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent', 'contains', 'foo');
					s.addCondition('fulltextContent', 'contains', 'bar');
					var matches = await s.search();
					assert.sameMembers(matches, [fooItem.id, foobarItem.id]);
				});
				
				it("should find matching items with joinMode=ANY and non-matching other condition", function* () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent', 'contains', 'foo');
					s.addCondition('fulltextContent', 'contains', 'bar');
					s.addCondition('title', 'contains', 'nomatch');
					var matches = yield s.search();
					assert.sameMembers(matches, [fooItem.id, foobarItem.id]);
				});
				
				it("should find matching items in regexp mode with joinMode=ANY with matching other condition", function* () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent/regexp', 'contains', 'foo.+bar');
					s.addCondition('title', 'is', fooItem.getField('title'));
					var matches = yield s.search();
					assert.sameMembers(matches, [fooItem.id, foobarItem.id]);
				});
				
				it("should find matching item in regexp mode with joinMode=ANY and non-matching other condition", function* () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent/regexp', 'contains', 'foo.+bar');
					s.addCondition('title', 'contains', 'nomatch');
					var matches = yield s.search();
					assert.sameMembers(matches, [foobarItem.id]);
				});
				
				it("should find item matching other condition in regexp mode when joinMode=ANY", function* () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent/regexp', 'contains', 'nomatch');
					s.addCondition('title', 'is', foobarItem.getField('title'));
					var matches = yield s.search();
					assert.sameMembers(matches, [foobarItem.id]);
				});
				
				it("should find matching item in regexp mode with joinMode=ANY and recursive mode flag", function* () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent/regexp', 'contains', 'foo.+bar');
					s.addCondition('recursive', 'true');
					var matches = yield s.search();
					assert.sameMembers(matches, [foobarItem.id]);
				});
				
				it("should find items that don't contain a single word with joinMode=ANY", async function () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent', 'doesNotContain', 'foo');
					var matches = await s.search();
					assert.notIncludeMembers(matches, [fooItem.id, foobarItem.id]);
				});
				
				it("should find items that don't contain a phrase with joinMode=ANY", async function () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent', 'doesNotContain', 'foo bar');
					var matches = await s.search();
					assert.notIncludeMembers(matches, [foobarItem.id]);
				});
				
				it("should find items that don't contain a regexp pattern with joinMode=ANY", async function () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent/regexp', 'doesNotContain', 'foo.+bar');
					var matches = await s.search();
					assert.notIncludeMembers(matches, [foobarItem.id]);
					assert.includeMembers(matches, [fooItem.id, bazItem.id]);
				});
			});
			
			describe("annotationText", function () {
				it("should return matches for annotation text", async function () {
					var attachment = await importPDFAttachment();
					var annotation = await createAnnotation('highlight', attachment);
					var str = annotation.annotationText.substr(0, 7);
					
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('annotationText', 'contains', str);
					var matches = await s.search();
					// TEMP: Match parent attachment
					assert.sameMembers(matches, [attachment.id]);
				});
			});
			
			describe("annotationComment", function () {
				it("should return matches for annotation comment", async function () {
					var attachment = await importPDFAttachment();
					var annotation = await createAnnotation('note', attachment);
					var str = annotation.annotationComment.substr(0, 7);
					
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('annotationComment', 'contains', str);
					var matches = await s.search();
					// TEMP: Match parent attachment
					assert.sameMembers(matches, [attachment.id]);
				});
			});
			
			describe("fulltextWord", function () {
				it("should return matches with full-text conditions", function* () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('fulltextWord', 'contains', 'foo');
					let matches = yield s.search();
					assert.lengthOf(matches, 2);
					assert.sameMembers(matches, [fooItem.id, foobarItem.id]);
				});
		
				it("should not return non-matches with full-text conditions", function* () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('fulltextWord', 'contains', 'nomatch');
					let matches = yield s.search();
					assert.lengthOf(matches, 0);
				});
		
				it("should return matches for full-text conditions in ALL mode", function* () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'all');
					s.addCondition('fulltextWord', 'contains', 'foo');
					s.addCondition('fulltextWord', 'contains', 'bar');
					let matches = yield s.search();
					assert.deepEqual(matches, [foobarItem.id]);
				});
		
				it("should not return non-matches for full-text conditions in ALL mode", function* () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'all');
					s.addCondition('fulltextWord', 'contains', 'mjktkiuewf');
					s.addCondition('fulltextWord', 'contains', 'zijajkvudk');
					let matches = yield s.search();
					assert.lengthOf(matches, 0);
				});
		
				it("should return a match that satisfies only one of two full-text condition in ANY mode", function* () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextWord', 'contains', 'bar');
					s.addCondition('fulltextWord', 'contains', 'nomatch');
					let matches = yield s.search();
					assert.deepEqual(matches, [foobarItem.id]);
				});
			});
			
			describe("includeParentsAndChildren", function () {
				it("should handle ANY search with no-op condition", async function () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.name = "Test";
					s.addCondition('joinMode', 'any');
					s.addCondition('savedSearch', 'is', Zotero.Utilities.randomString());
					s.addCondition('includeParentsAndChildren', 'true');
					var matches = await s.search();
					assert.lengthOf(matches, 0);
				});
				
				it("should handle ANY search with two no-op conditions", async function () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.name = "Test";
					s.addCondition('joinMode', 'any');
					s.addCondition('savedSearch', 'is', Zotero.Utilities.randomString());
					s.addCondition('savedSearch', 'is', Zotero.Utilities.randomString());
					s.addCondition('includeParentsAndChildren', 'true');
					var matches = await s.search();
					assert.lengthOf(matches, 0);
				});
			});
			
			describe("key", function () {
				it("should allow more than max bound parameters", function* () {
					let s = new Zotero.Search();
					let max = Zotero.DB.MAX_BOUND_PARAMETERS + 100;
					for (let i = 0; i < max; i++) {
						s.addCondition('key', 'is', Zotero.DataObjectUtilities.generateKey());
					}
					yield s.search();
				});
			});
			
			describe("savedSearch", function () {
				it("should return items in the saved search", function* () {
					var search = yield createDataObject('search');
					var itemTitle = search.getConditions()[0].value;
					var item = yield createDataObject('item', { title: itemTitle })
					
					var s = new Zotero.Search;
					s.libraryID = Zotero.Libraries.userLibraryID;
					s.addCondition('savedSearch', 'is', search.key);
					var matches = yield s.search();
					assert.deepEqual(matches, [item.id]);
				});
				
				it("should return items not in the saved search for isNot operator", function* () {
					var search = yield createDataObject('search');
					var itemTitle = search.getConditions()[0].value;
					var item = yield createDataObject('item', { title: itemTitle })
					
					var s = new Zotero.Search;
					s.libraryID = Zotero.Libraries.userLibraryID;
					s.addCondition('savedSearch', 'isNot', search.key);
					var matches = yield s.search();
					assert.notInclude(matches, item.id);
				});
				
				it("should return no results for a search that doesn't exist", async function () {
					var item = await createDataObject('item');
					
					var s = new Zotero.Search();
					s.libraryID = item.libraryID;
					s.name = "Test";
					s.addCondition('savedSearch', 'is', Zotero.DataObjectUtilities.generateKey());
					var matches = await s.search();
					assert.lengthOf(matches, 0);
				});
			});
			
			describe("unfiled", function () {
				it("shouldn't include items in My Publications", function* () {
					var item1 = yield createDataObject('item');
					var item2 = yield createDataObject('item', { inPublications: true });
					
					var s = new Zotero.Search;
					s.libraryID = Zotero.Libraries.userLibraryID;
					s.addCondition('unfiled', 'true');
					var matches = yield s.search();
					assert.include(matches, item1.id);
					assert.notInclude(matches, item2.id);
				});
				it("should include items belonging only to trashed collections", async function () {
					var collection = await createDataObject('collection');
					var item = await createDataObject('item', { collections: [collection.id] });
					
					var s = new Zotero.Search;
					s.libraryID = Zotero.Libraries.userLibraryID;
					s.addCondition('unfiled', 'true');

					// item belonging to a non-trashed collection is not unfiled
					var matches = await s.search();
					assert.notInclude(matches, item.id);

					collection.deleted = true;
					await collection.saveTx();

					// item that only belongs to a trashed collection is unfiled
					matches = await s.search();
					assert.include(matches, item.id);
				});
			});
			
			describe("Quick search", function () {
				describe("All Fields & Tags", function () {
					it("should match parent attachment for annotation tag", async function () {
						var attachment = await importPDFAttachment();
						var annotation = await createAnnotation('highlight', attachment);
						var tag = Zotero.Utilities.randomString();
						annotation.addTag(tag);
						await annotation.saveTx();
						
						var s = new Zotero.Search();
						s.libraryID = userLibraryID;
						s.addCondition('quicksearch-fields', 'contains', tag);
						var matches = await s.search();
						// TEMP: Match parent attachment
						assert.sameMembers(matches, [attachment.id]);
					});
				})
				
				describe("Everything", function () {
					it("should match parent attachment for annotation comment", async function () {
						var attachment = await importPDFAttachment();
						var annotation = await createAnnotation('highlight', attachment);
						var comment = annotation.annotationComment;
						
						var s = new Zotero.Search();
						s.libraryID = userLibraryID;
						s.addCondition('quicksearch-everything', 'contains', comment);
						var matches = await s.search();
						// TEMP: Match parent attachment
						assert.sameMembers(matches, [attachment.id]);
					});
				});
			});
			
			describe("deleted", function () {
				describe("if not present", function () {
					it("should not match regular items in trash with annotated child attachments", async function () {
						var item = await createDataObject('item');
						item.deleted = true;
						await item.saveTx();
						var attachment = await importPDFAttachment(item);
						await createAnnotation('highlight', attachment);
						
						var s = new Zotero.Search();
						s.libraryID = userLibraryID;
						var matches = await s.search();
						assert.notInclude(matches, attachment.id);
					});
					
					it("should not match regular items with annotated child attachments in trash", async function () {
						var item = await createDataObject('item');
						var attachment = await importPDFAttachment(item);
						attachment.deleted = true;
						await attachment.saveTx();
						await createAnnotation('highlight', attachment);
						
						var s = new Zotero.Search();
						s.libraryID = userLibraryID;
						var matches = await s.search();
						assert.notInclude(matches, attachment.id);
					});
				});
			});
		});
	});
	
	describe("#deleted", function () {
		it("should set trash status", async function () {
			var search = await createDataObject('search');
			assert.isFalse(search.deleted);
			search.deleted = true;
			await search.saveTx();
			assert.isTrue(search.deleted);
			search.deleted = false;
			await search.saveTx();
			assert.isFalse(search.deleted);
		});
		it("should permanently delete", async function () {
			var search = await createDataObject('search');
			assert.isFalse(search.deleted);
			await search.eraseTx();
			search = await Zotero.Searches.getAsync(search.id);
			assert.isFalse(search);
		});
	});
	
	describe("#toJSON()", function () {
		it("should output all data", function* () {
			let s = new Zotero.Search();
			s.name = "Test";
			s.addCondition('joinMode', 'any');
			s.addCondition('fulltextContent/regexp', 'contains', 's.+');
			let json = s.toJSON();
			assert.equal(json.name, "Test");
			
			assert.lengthOf(json.conditions, 2);
			
			assert.equal(json.conditions[0].condition, 'joinMode');
			assert.equal(json.conditions[0].operator, 'any');
			// TODO: Change to 'is' + 'any'?
			assert.strictEqual(json.conditions[0].value, '');
			assert.notProperty(json.conditions[0], 'id');
			assert.notProperty(json.conditions[0], 'required');
			assert.notProperty(json.conditions[0], 'mode');
			
			assert.equal(json.conditions[1].condition, 'fulltextContent/regexp');
			assert.equal(json.conditions[1].operator, 'contains');
			assert.equal(json.conditions[1].value, 's.+');
			assert.notProperty(json.conditions[1], 'mode');
		});
	});
	
	describe("#fromJSON()", function () {
		it("should update all data", function* () {
			let s = new Zotero.Search();
			s.name = "Test";
			s.addCondition('joinMode', 'any');
			s.addCondition('title', 'isNot', 'foo');
			let json = s.toJSON();
			json.name = "Test 2";
			json.conditions = [
				{
					condition: 'title',
					operator: 'contains',
					value: 'foo'
				},
				{
					condition: 'year',
					operator: 'is',
					value: '2016'
				}
			];
			s.fromJSON(json);
			assert.equal(s.name, "Test 2");
			var conditions = s.getConditions();
			assert.lengthOf(Object.keys(conditions), 2);
			assert.equal(conditions["0"].condition, 'title');
			assert.equal(conditions["0"].operator, 'contains');
			assert.equal(conditions["0"].value, 'foo');
			assert.equal(conditions["1"].condition, 'year');
			assert.equal(conditions["1"].operator, 'is');
			assert.equal(conditions["1"].value, '2016');
		});
		
		it("should ignore unknown property in non-strict mode", function () {
			var json = {
				name: "Search",
				conditions: [
					{
						condition: 'title',
						operator: 'contains',
						value: 'foo'
					}
				],
				foo: "Bar"
			};
			var s = new Zotero.Search();
			s.fromJSON(json);
		});
		
		it("should throw on unknown property in strict mode", function () {
			var json = {
				name: "Search",
				conditions: [
					{
						condition: 'title',
						operator: 'contains',
						value: 'foo'
					}
				],
				foo: "Bar"
			};
			var s = new Zotero.Search();
			var f = () => {
				s.fromJSON(json, { strict: true });
			};
			assert.throws(f, /^Unknown search property/);
		});
	});
});
