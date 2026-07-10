describe("Zotero.Search", function () {
	describe("#name", function () {
		it("should fail if empty", async function () {
			var s = new Zotero.Search();
			assert.throws(() => s.name = '');
		});
	});
	
	describe("#addCondition()", function () {
		it("should convert old-style 'collection' condition value", async function () {
			var col = await createDataObject('collection');
			var item = await createDataObject('item', { collections: [col.id] });
			
			var s = new Zotero.Search();
			s.libraryID = item.libraryID;
			s.name = "Test";
			s.addCondition('collection', 'is', '0_' + col.key);
			var matches = await s.search();
			assert.sameMembers(matches, [item.id]);
		});
	});

	// This is for Zotero.Search._loadConditions()
	describe("Loading", function () {
		it("should convert old-style 'collection' condition value", async function () {
			var col = await createDataObject('collection');
			var item = await createDataObject('item', { collections: [col.id] });
			
			var s = new Zotero.Search();
			s.libraryID = item.libraryID;
			s.name = "Test";
			s.addCondition('collection', 'is', col.key);
			await s.saveTx();
			await Zotero.DB.queryAsync(
				"UPDATE savedSearchConditions SET value=? WHERE savedSearchID=? AND condition=?",
				["0_" + col.key, s.id, 'collection']
			);
			await s.reload(['conditions'], true);
			var matches = await s.search();
			assert.sameMembers(matches, [item.id]);
		});

		it("should migrate a stored `childNote` condition to `note` at the item level", async function () {
			var text = 'zloadcn' + Zotero.Utilities.randomString();
			var item = await createDataObject('item', { title: 'zloadcnitem' });
			var note = new Zotero.Item('note');
			note.libraryID = item.libraryID;
			note.parentID = item.id;
			note.setNote('<p>' + text + '</p>');
			await note.saveTx();

			// Save a 'note' search with no result level, then rewrite the stored condition to the
			// obsolete childNote to stand in for a legacy saved search
			var s = new Zotero.Search();
			s.libraryID = item.libraryID;
			s.name = "Test";
			s.addCondition('note', 'contains', text);
			await s.saveTx();
			await Zotero.DB.queryAsync(
				"UPDATE savedSearchConditions SET condition=? WHERE savedSearchID=? AND condition=?",
				['childNote', s.id, 'note']
			);
			await s.reload(['conditions'], true);

			var conds = Object.values(s.getConditions());
			assert.include(conds.map(c => c.condition), 'note');
			assert.notInclude(conds.map(c => c.condition), 'childNote');
			// An item result level is seeded so the note rolls up to its parent, as childNote did
			var resultLevel = conds.find(c => c.condition == 'resultLevel');
			assert.ok(resultLevel);
			assert.equal(resultLevel.operator, 'item');
			assert.sameMembers(s.toJSON().conditions.map(c => c.condition), ['note', 'resultLevel']);
			assert.sameMembers(await s.search(), [item.id]);

			await item.eraseTx();
			await s.eraseTx();
		});
	});


	describe("#save()", function () {
		it("should fail without a name", async function () {
			var s = new Zotero.Search;
			s.addCondition('title', 'is', 'test');
			var e = await getPromiseError(s.saveTx());
			assert.ok(e);
			assert.equal(e.constructor.name, Error.prototype.constructor.name); // TEMP: Error mismatch
			assert.equal(e.message, "Name not provided for saved search");
		});
		
		it("should save a new search", async function () {
			// Save search
			var s = new Zotero.Search;
			s.name = "Test";
			s.addCondition('title', 'is', 'test');
			var id = await s.saveTx();
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
		});
		
		it("should add a condition to an existing search", async function () {
			// Save search
			var s = new Zotero.Search;
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.name = "Test";
			s.addCondition('title', 'is', 'test');
			var id = await s.saveTx();
			assert.typeOf(id, 'number');
			
			// Add condition
			s = await Zotero.Searches.getAsync(id);
			s.addCondition('title', 'contains', 'foo');
			var saved = await s.saveTx();
			assert.isTrue(saved);
			
			// Check saved search
			s = await Zotero.Searches.getAsync(id);
			var conditions = s.getConditions();
			assert.lengthOf(Object.keys(conditions), 2);
		});
		
		it("should remove a condition from an existing search", async function () {
			// Save search
			var s = new Zotero.Search;
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.name = "Test";
			s.addCondition('title', 'is', 'test');
			s.addCondition('title', 'contains', 'foo');
			var id = await s.saveTx();
			assert.typeOf(id, 'number');
			
			// Remove condition
			s = await Zotero.Searches.getAsync(id);
			s.removeCondition(0);
			var saved = await s.saveTx();
			assert.isTrue(saved);
			
			// Check saved search
			s = await Zotero.Searches.getAsync(id);
			var conditions = s.getConditions();
			assert.lengthOf(Object.keys(conditions), 1);
			assert.property(conditions, "0");
			assert.propertyVal(conditions[0], 'value', 'foo')
		});
	});

	describe("#combineConditions()", function () {
		function pred(sql, params = []) {
			return { sql, params };
		}

		it("should AND predicates in 'all' mode", function () {
			var r = Zotero.Search.combineConditions([pred('A'), pred('B')]);
			assert.equal(r.sql, 'A AND B');
		});

		it("should OR and parenthesize predicates in 'any' mode", function () {
			var r = Zotero.Search.combineConditions([
				{ marker: 'joinMode', operator: 'any' }, pred('A'), pred('B')
			]);
			assert.equal(r.sql, '(A OR B)');
		});

		it("should combine a nested group", function () {
			var r = Zotero.Search.combineConditions([
				pred('A'),
				{ marker: 'groupStart' },
				{ marker: 'joinMode', operator: 'any' },
				pred('B'),
				pred('C'),
				{ marker: 'groupEnd' }
			]);
			assert.equal(r.sql, 'A AND (B OR C)');
		});

		it("should collect params in order", function () {
			var r = Zotero.Search.combineConditions([pred('A=?', [1]), pred('B=?', [2])]);
			assert.equal(r.sql, 'A=? AND B=?');
			assert.deepEqual(r.params, [1, 2]);
		});

	});

	describe("#mapPredicate()", function () {
		var c = (sql, from, to, neg) => Zotero.Search.mapPredicate(sql, from, to, neg);

		it("should leave a predicate unchanged when the result level is 'any'", function () {
			assert.equal(c('X', 'item', 'any'), 'X');
			assert.equal(c('X', 'any', 'any'), 'X');
		});

		it("should not roll up a negated level-agnostic condition", function () {
			assert.equal(c('X', 'any', 'item', true), 'X');
		});

		it("should match nothing for unrelated branches (note vs annotation)", function () {
			assert.equal(c('X', 'note', 'annotation'), '0');
		});

		it("should leave a multi-level field unchanged at a level it matches at", function () {
			// e.g., title exists on both items and attachments, so at either result level the
			// predicate is used as-is (the result-level FROM filters to the right rows)
			assert.equal(c('X', ['item', 'attachment'], 'item'), 'X');
			assert.equal(c('X', ['item', 'attachment'], 'attachment'), 'X');
			assert.equal(c('X', ['item', 'attachment'], 'any'), 'X');
		});

	});

	describe("#search()", function () {
		var userLibraryID;
		var fooItem;
		var foobarItem;
		var bazItem;
		var importedURLItem;
		var linkedFileItem;
		var linkedURLItem;
		var fooItemGroup;
		var foobarItemGroup;
		var bazItemGroup;

		before(async function () {
			await resetDB({
				thisArg: this,
				skipBundledFiles: true
			});
			
			fooItem = await importFileAttachment("search/foo.html");
			foobarItem = await importFileAttachment("search/foobar.html");
			bazItem = await importFileAttachment("search/baz.pdf");
			userLibraryID = fooItem.libraryID;
			let testPDF = getTestDataDirectory();
			testPDF.append('test.pdf');
			importedURLItem = await Zotero.Attachments.importSnapshotFromFile({
				file: testPDF,
				libraryID: userLibraryID,
				title: 'imported-url-pdf',
				url: 'http://example.com/imported-url.pdf',
				contentType: 'application/pdf',
				singleFile: true
			});
			linkedFileItem = await Zotero.Attachments.linkFromFile({
				file: OS.Path.join(getTestDataDirectory().path, 'test.pdf'),
				title: 'linked-file-pdf'
			});
			linkedURLItem = await Zotero.Attachments.linkFromURL({
				url: 'http://example.com/linked-url.pdf',
				title: 'linked-url',
				contentType: 'application/pdf'
			});
			
			let group = await getGroup();
			fooItemGroup = await importFileAttachment("search/foo.html", { libraryID: group.libraryID });
			foobarItemGroup = await importFileAttachment("search/foobar.html", { libraryID: group.libraryID });
			bazItemGroup = await importFileAttachment("search/baz.pdf", { libraryID: group.libraryID });
		});

		after(function* () {
			yield fooItem.eraseTx();
			yield foobarItem.eraseTx();
			yield bazItem.eraseTx();
			yield importedURLItem.eraseTx();
			yield linkedFileItem.eraseTx();
			yield linkedURLItem.eraseTx();
			yield fooItemGroup.eraseTx();
			yield foobarItemGroup.eraseTx();
			yield bazItemGroup.eraseTx();
		});
		
		describe("Conditions", function () {
			describe("Nested condition groups", function () {
				it("should match A AND (B OR C)", async function () {
					var ab = await createDataObject('item', { title: 'zgrpA', tags: [{ tag: 'zgrpB' }] });
					var ac = await createDataObject('item', { title: 'zgrpA', tags: [{ tag: 'zgrpC' }] });
					await createDataObject('item', { title: 'zgrpA' });
					await createDataObject('item', { tags: [{ tag: 'zgrpB' }] });

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'all');
					s.addCondition('title', 'contains', 'zgrpA');
					s.addCondition('groupStart', 'true', '');
					s.addCondition('joinMode', 'any');
					s.addCondition('tag', 'is', 'zgrpB');
					s.addCondition('tag', 'is', 'zgrpC');
					s.addCondition('groupEnd', 'true', '');
					assert.sameMembers(await s.search(), [ab.id, ac.id]);
				});

				it("should match A OR (B AND C)", async function () {
					var a = await createDataObject('item', { title: 'zg2A' });
					var bc = await createDataObject('item', { title: 'zg2B', tags: [{ tag: 'zg2C' }] });
					await createDataObject('item', { title: 'zg2B' });

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('title', 'contains', 'zg2A');
					s.addCondition('groupStart', 'true', '');
					s.addCondition('joinMode', 'all');
					s.addCondition('title', 'contains', 'zg2B');
					s.addCondition('tag', 'is', 'zg2C');
					s.addCondition('groupEnd', 'true', '');
					assert.sameMembers(await s.search(), [a.id, bc.id]);
				});

				it("should match nested groups A AND (B OR (C AND D))", async function () {
					var ab = await createDataObject('item', { title: 'zg3A', tags: [{ tag: 'zg3B' }] });
					var acd = await createDataObject('item', { title: 'zg3A zg3C', tags: [{ tag: 'zg3D' }] });
					await createDataObject('item', { title: 'zg3A zg3C' });

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'all');
					s.addCondition('title', 'contains', 'zg3A');
					s.addCondition('groupStart', 'true', '');
					s.addCondition('joinMode', 'any');
					s.addCondition('tag', 'is', 'zg3B');
					s.addCondition('groupStart', 'true', '');
					s.addCondition('joinMode', 'all');
					s.addCondition('title', 'contains', 'zg3C');
					s.addCondition('tag', 'is', 'zg3D');
					s.addCondition('groupEnd', 'true', '');
					s.addCondition('groupEnd', 'true', '');
					assert.sameMembers(await s.search(), [ab.id, acd.id]);
				});

			});

			describe("Cross-level scope", function () {
				it("should match a top-level item by a condition on a descendant annotation", async function () {
					var text = 'zscopematch' + Zotero.Utilities.randomString();

					// Author Smith, with a matching annotation on a child PDF -- should match
					var item = await createDataObject('item', {
						creators: [{ lastName: 'Zscopesmith', creatorType: 'author' }]
					});
					var attachment = await importPDFAttachment(item);
					var annotation = await createAnnotation('highlight', attachment);
					annotation.annotationText = text;
					await annotation.saveTx();

					// Author Smith, but no matching annotation -- shouldn't match
					var noAnnotation = await createDataObject('item', {
						creators: [{ lastName: 'Zscopesmith', creatorType: 'author' }]
					});

					// Matching annotation, but a different author -- shouldn't match
					var other = await createDataObject('item', {
						creators: [{ lastName: 'Zscopejones', creatorType: 'author' }]
					});
					var otherAttachment = await importPDFAttachment(other);
					var otherAnnotation = await createAnnotation('highlight', otherAttachment);
					otherAnnotation.annotationText = text;
					await otherAnnotation.saveTx();

					// creator is Smith AND (has an annotation whose text matches)
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('creator', 'contains', 'Zscopesmith');
					s.addCondition('groupStart', 'true', '');
					s.addCondition('resultLevel', 'annotation');
					s.addCondition('annotationText', 'contains', text);
					s.addCondition('groupEnd', 'true', '');
					assert.sameMembers(await s.search(), [item.id]);

					await item.eraseTx();
					await noAnnotation.eraseTx();
					await other.eraseTx();
				});

				it("should match an annotation by its top-level item's title", async function () {
					// Title exists on both items and attachments, so targeting annotations must
					// reach the top-level item's title, not just the parent attachment's
					var title = 'zanntitle' + Zotero.Utilities.randomString();
					var item = await createDataObject('item', { title });
					var attachment = await importPDFAttachment(item);
					var annotation = await createAnnotation('highlight', attachment);

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'annotation');
					s.addCondition('title', 'contains', title);
					assert.sameMembers(await s.search(), [annotation.id]);

					await item.eraseTx();
				});

				it("should match an annotation by its parent attachment's title", async function () {
					// The other half of the union: an attachment's own title still matches
					var title = 'zatttitle' + Zotero.Utilities.randomString();
					var item = await createDataObject('item');
					var attachment = await importPDFAttachment(item);
					attachment.setField('title', title);
					await attachment.saveTx();
					var annotation = await createAnnotation('highlight', attachment);

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'annotation');
					s.addCondition('title', 'contains', title);
					assert.sameMembers(await s.search(), [annotation.id]);

					await item.eraseTx();
				});

				it("should match annotations by type and color", async function () {
					var item = await createDataObject('item');
					var attachment = await importPDFAttachment(item);

					var highlight = await createAnnotation('highlight', attachment);
					highlight.annotationColor = '#ff6666';
					await highlight.saveTx();

					var note = await createAnnotation('note', attachment);
					note.annotationColor = '#5fb236';
					await note.saveTx();

					// Type 'is' returns only the matching annotation
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('annotationType', 'is',
						Zotero.Annotations.ANNOTATION_TYPE_HIGHLIGHT.toString());
					assert.sameMembers(await s.search(), [highlight.id]);

					// Color 'is' returns only the matching annotation
					s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('annotationColor', 'is', '#5fb236');
					assert.sameMembers(await s.search(), [note.id]);

					// 'isNot' returns the other annotation -- not the parent item, the
					// attachment, or every item in the library
					s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('annotationType', 'isNot',
						Zotero.Annotations.ANNOTATION_TYPE_NOTE.toString());
					var matches = await s.search();
					assert.include(matches, highlight.id);
					assert.notInclude(matches, note.id);
					assert.notInclude(matches, item.id);
					assert.notInclude(matches, attachment.id);

					await item.eraseTx();
				});

				it("should return descendant annotations as results with a top-level condition", async function () {
					var text = 'zresult' + Zotero.Utilities.randomString();

					// Smith item with two matching and one non-matching annotation
					var item = await createDataObject('item', {
						creators: [{ lastName: 'Zresultsmith', creatorType: 'author' }]
					});
					var attachment = await importPDFAttachment(item);
					var match1 = await createAnnotation('highlight', attachment);
					match1.annotationText = text;
					await match1.saveTx();
					var match2 = await createAnnotation('highlight', attachment);
					match2.annotationText = text;
					await match2.saveTx();
					await createAnnotation('highlight', attachment); // random text -- no match

					// Different author with a matching annotation -- shouldn't match
					var other = await createDataObject('item', {
						creators: [{ lastName: 'Zresultjones', creatorType: 'author' }]
					});
					var otherAttachment = await importPDFAttachment(other);
					var otherAnnotation = await createAnnotation('highlight', otherAttachment);
					otherAnnotation.annotationText = text;
					await otherAnnotation.saveTx();

					// Result level annotations: the matching annotations on Smith's items
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'annotation');
					s.addCondition('creator', 'contains', 'Zresultsmith');
					s.addCondition('annotationText', 'contains', text);
					assert.sameMembers(await s.search(), [match1.id, match2.id]);

					await item.eraseTx();
					await other.eraseTx();
				});

				it("should match annotations for a negated annotation condition at the annotation result level", async function () {
					// At the annotation result level, a negated annotation condition matches
					// the annotations that lack the value
					var text = 'zneg' + Zotero.Utilities.randomString();
					var item = await createDataObject('item');
					var attachment = await importPDFAttachment(item);
					var withText = await createAnnotation('highlight', attachment);
					withText.annotationText = text;
					await withText.saveTx();
					var withoutText = await createAnnotation('highlight', attachment);
					withoutText.annotationText = 'zsomethingelse';
					await withoutText.saveTx();

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'annotation');
					s.addCondition('annotationText', 'doesNotContain', text);
					assert.sameMembers(await s.search(), [withoutText.id]);

					await item.eraseTx();
				});

				it("should match an item in a collection by a child attachment's content", async function () {
					// Collection (item-level) and Attachment Content (rolls up from the
					// attachment) both resolve at the top-level item and intersect there
					var collection = await createDataObject('collection');
					// In the collection, with a child attachment whose content matches
					var match = await createDataObject('item', { collections: [collection.id] });
					await importFileAttachment("search/foobar.html", { parentID: match.id });
					// In the collection, but no matching attachment content
					var noContent = await createDataObject('item', { collections: [collection.id] });
					// Has the matching content, but isn't in the collection
					var notInCollection = await createDataObject('item');
					await importFileAttachment("search/foobar.html", { parentID: notInCollection.id });

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'item');
					s.addCondition('collection', 'is', collection.key);
					s.addCondition('fulltextContent', 'contains', 'foo bar');
					assert.sameMembers(await s.search(), [match.id]);

					await match.eraseTx();
					await noContent.eraseTx();
					await notInCollection.eraseTx();
				});

				it("should return a collection's matching descendants at a descendant result level", async function () {
					// Collection (item-level) maps down to the annotation result level, so
					// a matching annotation under a collection item is returned even though the
					// top-level item doesn't itself match the annotation condition
					var text = 'zcoll' + Zotero.Utilities.randomString();
					var collection = await createDataObject('collection');
					var item = await createDataObject('item', { collections: [collection.id] });
					var attachment = await importPDFAttachment(item);
					var match = await createAnnotation('highlight', attachment);
					match.annotationText = text;
					await match.saveTx();
					// A matching annotation, but its item isn't in the collection
					var other = await createDataObject('item');
					var otherAttachment = await importPDFAttachment(other);
					var otherAnnotation = await createAnnotation('highlight', otherAttachment);
					otherAnnotation.annotationText = text;
					await otherAnnotation.saveTx();

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'annotation');
					s.addCondition('collection', 'is', collection.key);
					s.addCondition('annotationText', 'contains', text);
					assert.sameMembers(await s.search(), [match.id]);

					await item.eraseTx();
					await other.eraseTx();
				});

				it("should match an itemData field at the item or attachment level it lives at", async function () {
					// title (like url/accessDate) exists on both top-level items and
					// attachments, so it matches the right thing at each result level without
					// rolling an attachment title up to its parent (or a parent title down)
					var itemTitle = 'zti' + Zotero.Utilities.randomString();
					var attTitle = 'zta' + Zotero.Utilities.randomString();
					var item = await createDataObject('item', { title: itemTitle });
					var attachment = await importPDFAttachment(item);
					attachment.setField('title', attTitle);
					await attachment.saveTx();

					let search = (level, value) => {
						var s = new Zotero.Search();
						s.libraryID = userLibraryID;
						s.addCondition('resultLevel', level);
						s.addCondition('title', 'contains', value);
						return s.search();
					};

					// Attachment result level matches the attachment's own title, not its parent's
					assert.sameMembers(await search('attachment', attTitle), [attachment.id]);
					assert.sameMembers(await search('attachment', itemTitle), []);
					// Item result level matches the item's own title, and an attachment title
					// does not roll up to the item (option C: no rollup)
					assert.sameMembers(await search('item', itemTitle), [item.id]);
					assert.sameMembers(await search('item', attTitle), []);

					await item.eraseTx();
				});

				it("should map a bare descendant condition to the result level (no group)", async function () {
					var text = 'zbarecorr' + Zotero.Utilities.randomString();
					var item = await createDataObject('item', { title: 'zbarecorritem' });
					var attachment = await importPDFAttachment(item);
					var annotation = await createAnnotation('highlight', attachment);
					annotation.annotationText = text;
					await annotation.saveTx();

					// Result level item + a plain annotation condition (no group) rolls up
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'item');
					s.addCondition('annotationText', 'contains', text);
					assert.sameMembers(await s.search(), [item.id]);

					await item.eraseTx();
				});

				it("should match an item by its tag and a descendant annotation's comment", async function () {
					// A cross-level search combining levels: a top-level item that itself has a
					// given tag AND has a descendant annotation whose comment contains a word, returned
					// at the item result level. The tag (level-agnostic) and the annotation
					// comment (annotation level) both resolve at the item and intersect there.
					var tag = 'ztag' + Zotero.Utilities.randomString();
					var word = 'zword' + Zotero.Utilities.randomString();

					// Tagged, with a descendant annotation whose comment contains the word
					var item = await createDataObject('item', { tags: [{ tag }] });
					var attachment = await importPDFAttachment(item);
					await createAnnotation('highlight', attachment, { comment: 'foo ' + word + ' bar' });

					// Tagged, but no matching annotation comment
					var tagOnly = await createDataObject('item', { tags: [{ tag }] });
					await importPDFAttachment(tagOnly);

					// Has the matching annotation comment, but not the tag
					var annotationOnly = await createDataObject('item');
					var annAttachment = await importPDFAttachment(annotationOnly);
					await createAnnotation('highlight', annAttachment, { comment: 'foo ' + word + ' bar' });

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'item');
					s.addCondition('tag', 'is', tag);
					s.addCondition('annotationComment', 'contains', word);
					assert.sameMembers(await s.search(), [item.id]);

					await item.eraseTx();
					await tagOnly.eraseTx();
					await annotationOnly.eraseTx();
				});

				it("should map a bare full-text condition to the result level (no group)", async function () {
					// A top-level full-text condition matches the item that owns the matching
					// attachment, materializing and mapping to the result level
					var item = await createDataObject('item', { title: 'zbareft' });
					await importFileAttachment("search/foobar.html", { parentID: item.id });

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'item');
					s.addCondition('fulltextContent', 'contains', 'foo bar');
					// The standalone foobarItem also matches and is itself a top-level item, so it's
					// returned alongside the child attachment's parent
					assert.sameMembers(await s.search(), [item.id, foobarItem.id]);

					await item.eraseTx();
				});

				it("should return a standalone attachment whose annotation matches, at the item result level", async function () {
					// A standalone (top-level) attachment is itself a top-level item, so its annotation
					// maps up to the attachment's own id and the attachment is returned
					var word = 'zsa' + Zotero.Utilities.randomString();
					var standalone = await importPDFAttachment(); // top-level PDF, no parent
					await createAnnotation('highlight', standalone, { comment: 'x ' + word + ' y' });
					
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'item');
					s.addCondition('annotationComment', 'contains', word);
					assert.sameMembers(await s.search(), [standalone.id]);
					
					await standalone.eraseTx();
				});
				
				it("should return a standalone attachment whose annotation has a tag, in a search for top-level items", async function () {
					// Same as above, but for a level-agnostic condition (tag), which rolls up
					// separately from a fixed-level one like annotationComment
					var tag = 'zsat' + Zotero.Utilities.randomString();
					var standalone = await importPDFAttachment(); // top-level PDF, no parent
					var annotation = await createAnnotation('highlight', standalone);
					annotation.addTag(tag);
					await annotation.saveTx();
					
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'item');
					s.addCondition('tag', 'is', tag);
					assert.sameMembers(await s.search(), [standalone.id]);
					
					await standalone.eraseTx();
				});
				

				it("should bind a same-entity group below a non-item result level", async function () {
					// Result level attachment + a group scoped to annotation: find attachments
					// that have a single annotation matching all of the group's conditions.
					// Exercises mapping where the parent level is 'attachment', not 'item'.
					var text = 'zsame' + Zotero.Utilities.randomString();
					var comment = 'zsamec' + Zotero.Utilities.randomString();
					var item = await createDataObject('item', { title: 'zsameitem' });

					// One annotation matches both text and comment -> this attachment matches
					var attachmentBoth = await importPDFAttachment(item);
					var both = await createAnnotation('highlight', attachmentBoth, { comment });
					both.annotationText = text;
					await both.saveTx();

					// Two separate annotations, one matching each -> shouldn't match
					var attachmentSplit = await importPDFAttachment(item);
					var hasText = await createAnnotation('highlight', attachmentSplit);
					hasText.annotationText = text;
					await hasText.saveTx();
					await createAnnotation('highlight', attachmentSplit, { comment });

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'attachment'); // result level = attachments
					s.addCondition('groupStart', 'true', '');
					s.addCondition('resultLevel', 'annotation'); // the same annotation
					s.addCondition('annotationText', 'contains', text);
					s.addCondition('annotationComment', 'contains', comment);
					s.addCondition('groupEnd', 'true', '');
					assert.sameMembers(await s.search(), [attachmentBoth.id]);

					await item.eraseTx();
				});

				it("should roll a tag on a descendant up to the result item", async function () {
					var tag = 'zroll' + Zotero.Utilities.randomString();
					// Tagged child attachment (the item itself is untagged)
					var viaChild = await createDataObject('item', { title: 'zrollchild' });
					var attachment = await importPDFAttachment(viaChild);
					attachment.addTag(tag);
					await attachment.saveTx();
					// Tagged directly
					var viaSelf = await createDataObject('item', { title: 'zrollself', tags: [{ tag }] });
					// Untagged
					var untagged = await createDataObject('item', { title: 'zrollmiss' });

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'item');
					s.addCondition('tag', 'is', tag);
					// The child's tag rolls up to its item; the directly tagged item matches too
					assert.sameMembers(await s.search(), [viaChild.id, viaSelf.id]);

					await viaChild.eraseTx();
					await viaSelf.eraseTx();
					await untagged.eraseTx();
				});

				it("should not propagate a tag down to descendant result items", async function () {
					var tag = 'zdown' + Zotero.Utilities.randomString();
					// The item is tagged, but its attachment is not
					var item = await createDataObject('item', { title: 'zdownitem', tags: [{ tag }] });
					await importPDFAttachment(item);

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'attachment');
					s.addCondition('tag', 'is', tag);
					// Rollup is up-only: a parent's tag must not match its child attachment
					assert.lengthOf(await s.search(), 0);

					await item.eraseTx();
				});

				it("should not error when a condition can't reach the result level", async function () {
					// A note can't be (or be under) an attachment, so this is empty -- but it
					// must not throw a SQL param error: the dead predicate drops to the constant
					// '0', and its bound value param must be dropped with it
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'attachment');
					s.addCondition('joinMode', 'any');
					s.addCondition('note', 'contains', 'zsqltest');
					assert.lengthOf(await s.search(), 0);

					// Same in 'all' mode
					var s2 = new Zotero.Search();
					s2.libraryID = userLibraryID;
					s2.addCondition('resultLevel', 'attachment');
					s2.addCondition('note', 'contains', 'zsqltest');
					assert.lengthOf(await s2.search(), 0);
				});

				it("should project to all descendant annotations when there's no annotation condition", async function () {
					// Result level annotations with only a top-level condition -> every
					// annotation under matching items
					var item = await createDataObject('item', {
						creators: [{ lastName: 'Zprojsmith', creatorType: 'author' }]
					});
					var attachment = await importPDFAttachment(item);
					var a1 = await createAnnotation('highlight', attachment);
					var a2 = await createAnnotation('highlight', attachment);

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'annotation');
					s.addCondition('creator', 'contains', 'Zprojsmith');
					assert.sameMembers(await s.search(), [a1.id, a2.id]);

					await item.eraseTx();
				});
			});

			describe("collection", function () {
				it("should find item in collection", async function () {
					var col = await createDataObject('collection');
					var item = await createDataObject('item', { collections: [col.id] });
					
					var s = new Zotero.Search();
					s.libraryID = item.libraryID;
					s.addCondition('collection', 'is', col.key);
					var matches = await s.search();
					assert.sameMembers(matches, [item.id]);
				});
				
				it("should find items not in collection", async function () {
					var col = await createDataObject('collection');
					var item = await createDataObject('item', { collections: [col.id] });
					
					var s = new Zotero.Search();
					s.libraryID = item.libraryID;
					s.addCondition('collection', 'isNot', col.key);
					var matches = await s.search();
					assert.notInclude(matches, item.id);
				});
				
				it("shouldn't find item in collection with no items", async function () {
					var col = await createDataObject('collection');
					var item = await createDataObject('item');
					
					var s = new Zotero.Search();
					s.libraryID = item.libraryID;
					s.addCondition('collection', 'is', col.key);
					var matches = await s.search();
					assert.lengthOf(matches, 0);
				});
				
				it("should find item in subcollection in recursive mode", async function () {
					var col1 = await createDataObject('collection');
					var col2 = await createDataObject('collection', { parentID: col1.id });
					var item = await createDataObject('item', { collections: [col2.id] });
					
					var s = new Zotero.Search();
					s.libraryID = item.libraryID;
					s.addCondition('collection', 'is', col1.key);
					s.addCondition('recursive', 'true');
					var matches = await s.search();
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

				it("should have same result after the same search conditions is removed and added", async function () {
					var itemOne = await createDataObject('item', { title: "One" });
					var itemTwo = await createDataObject('item', { title: "Two" });

					var s = new Zotero.Search();
					s.libraryID = itemOne.libraryID;
					s.addCondition("joinMode", "any");
					// Match both collections
					s.addCondition('title', 'contains', 'One');
					s.addCondition('title', 'contains', 'Two');
					var matches = await s.search();
					assert.sameMembers(matches, [itemOne.id, itemTwo.id]);

					// Remove the first condition and add it again
					s.removeCondition(1);
					s.addCondition('title', 'contains', 'One');
					matches = await s.search();
					// Result should be the same
					assert.sameMembers(matches, [itemOne.id, itemTwo.id]);
					
					await itemOne.eraseTx();
					await itemTwo.eraseTx();
				});
			});
			
			describe("tag", function () {
				it("should match annotation with tag", async function () {
					var attachment = await importPDFAttachment();
					var annotation = await createAnnotation('highlight', attachment);
					var tag = Zotero.Utilities.randomString();
					annotation.addTag(tag);
					await annotation.saveTx();
					
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('tag', 'is', tag);
					var matches = await s.search();
					assert.sameMembers(matches, [annotation.id]);
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
				it("should search by attachment file type", async function () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('fileTypeID', 'is', Zotero.FileTypes.getID('webpage'));
					let matches = await s.search();
					assert.sameMembers(matches, [fooItem.id, foobarItem.id]);
				});
			});

			describe("attachmentStorageType", function () {
				it("should find stored files", async function () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('attachmentStorageType', 'is', 'storedFile');
					let matches = await s.search();
					assert.includeMembers(matches, [
						fooItem.id,
						foobarItem.id,
						bazItem.id,
						importedURLItem.id
					]);
					assert.notInclude(matches, linkedFileItem.id);
					assert.notInclude(matches, linkedURLItem.id);
				});

				it("should find linked files", async function () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('attachmentStorageType', 'is', 'linkedFile');
					let matches = await s.search();
					assert.include(matches, linkedFileItem.id);
					assert.notInclude(matches, bazItem.id);
					assert.notInclude(matches, linkedURLItem.id);
				});

				it("should find web links", async function () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('attachmentStorageType', 'is', 'webLink');
					let matches = await s.search();
					assert.include(matches, linkedURLItem.id);
					assert.notInclude(matches, bazItem.id);
					assert.notInclude(matches, linkedFileItem.id);
				});
			});
			
			describe("lastRead", function () {
				it("should roll a child attachment's last-read date up to its top-level item", async function () {
					var item = await createDataObject('item', { title: 'zlastread' });
					var attachment = await importPDFAttachment(item);
					attachment.attachmentLastRead = Math.round(Date.now() / 1000);
					await attachment.saveTx();

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('resultLevel', 'item');
					s.addCondition('lastRead', 'isInTheLast', '1 days');
					assert.sameMembers(await s.search(), [item.id]);

					await item.eraseTx();
				});
			});

			describe("fulltextContent", function () {
				it("should find text in HTML files", async function () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('fulltextContent', 'contains', 'foo bar');
					var matches = await s.search();
					assert.sameMembers(matches, [foobarItem.id]);
				});
				
				it("should work in subsearch", async function () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('fulltextContent', 'contains', 'foo bar');
					
					var s2 = new Zotero.Search();
					s2.setScope(s);
					s2.addCondition('title', 'contains', 'foobar');
					var matches = await s2.search();
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
				
				it("should find matching items with joinMode=ANY and non-matching other condition", async function () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent', 'contains', 'foo');
					s.addCondition('fulltextContent', 'contains', 'bar');
					s.addCondition('title', 'contains', 'nomatch');
					var matches = await s.search();
					assert.sameMembers(matches, [fooItem.id, foobarItem.id]);
				});
				
				it("should find matching items in regexp mode with joinMode=ANY with matching other condition", async function () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent/regexp', 'contains', 'foo.+bar');
					s.addCondition('title', 'is', fooItem.getField('title'));
					var matches = await s.search();
					assert.sameMembers(matches, [fooItem.id, foobarItem.id]);
				});
				
				it("should find matching item in regexp mode with joinMode=ANY and non-matching other condition", async function () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent/regexp', 'contains', 'foo.+bar');
					s.addCondition('title', 'contains', 'nomatch');
					var matches = await s.search();
					assert.sameMembers(matches, [foobarItem.id]);
				});
				
				it("should find item matching other condition in regexp mode when joinMode=ANY", async function () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent/regexp', 'contains', 'nomatch');
					s.addCondition('title', 'is', foobarItem.getField('title'));
					var matches = await s.search();
					assert.sameMembers(matches, [foobarItem.id]);
				});
				
				it("should find matching item in regexp mode with joinMode=ANY and recursive mode flag", async function () {
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextContent/regexp', 'contains', 'foo.+bar');
					s.addCondition('recursive', 'true');
					var matches = await s.search();
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

				// fulltextContent inside a group must combine with its siblings under the
				// group's own join mode, not the search's top-level mode (it used to be
				// applied as a global post-filter keyed on the top-level join mode)
				it("should obey the group join mode for a grouped fulltextContent", async function () {
					// OR: (title is foo.html OR full-text "foo bar") matches the title item and the text item
					var orSearch = new Zotero.Search();
					orSearch.libraryID = userLibraryID;
					orSearch.addCondition('groupStart', 'true', '');
					orSearch.addCondition('joinMode', 'any');
					orSearch.addCondition('title', 'is', fooItem.getField('title'));
					orSearch.addCondition('fulltextContent', 'contains', 'foo bar');
					orSearch.addCondition('groupEnd', 'true', '');
					assert.sameMembers(await orSearch.search(), [fooItem.id, foobarItem.id]);

					// AND: title is foo.html OR (title is foobar.html AND full-text "nomatchphrase").
					// The group's full-text doesn't match, so only fooItem (the OR branch) matches.
					var andSearch = new Zotero.Search();
					andSearch.libraryID = userLibraryID;
					andSearch.addCondition('joinMode', 'any');
					andSearch.addCondition('title', 'is', fooItem.getField('title'));
					andSearch.addCondition('groupStart', 'true', '');
					andSearch.addCondition('joinMode', 'all');
					andSearch.addCondition('title', 'is', foobarItem.getField('title'));
					andSearch.addCondition('fulltextContent', 'contains', 'nomatchphrase');
					andSearch.addCondition('groupEnd', 'true', '');
					assert.sameMembers(await andSearch.search(), [fooItem.id]);
				});

				it("should compose a grouped fulltextContent in doesNotContain and regexp modes", async function () {
					// doesNotContain: (full-text doesNotContain "foo" AND title is baz.pdf) -> bazItem
					var neg = new Zotero.Search();
					neg.libraryID = userLibraryID;
					neg.addCondition('groupStart', 'true', '');
					neg.addCondition('joinMode', 'all');
					neg.addCondition('fulltextContent', 'doesNotContain', 'foo');
					neg.addCondition('title', 'is', bazItem.getField('title'));
					neg.addCondition('groupEnd', 'true', '');
					assert.sameMembers(await neg.search(), [bazItem.id]);

					// regexp: (title is foo.html OR full-text regexp "foo.+bar") -> both
					var re = new Zotero.Search();
					re.libraryID = userLibraryID;
					re.addCondition('groupStart', 'true', '');
					re.addCondition('joinMode', 'any');
					re.addCondition('title', 'is', fooItem.getField('title'));
					re.addCondition('fulltextContent/regexp', 'contains', 'foo.+bar');
					re.addCondition('groupEnd', 'true', '');
					assert.sameMembers(await re.search(), [fooItem.id, foobarItem.id]);
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
					assert.sameMembers(matches, [annotation.id]);
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
					assert.sameMembers(matches, [annotation.id]);
				});
			});
			
			describe("fulltextWord", function () {
				it("should return matches with full-text conditions", async function () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('fulltextWord', 'contains', 'foo');
					let matches = await s.search();
					assert.lengthOf(matches, 2);
					assert.sameMembers(matches, [fooItem.id, foobarItem.id]);
				});
		
				it("should not return non-matches with full-text conditions", async function () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('fulltextWord', 'contains', 'nomatch');
					let matches = await s.search();
					assert.lengthOf(matches, 0);
				});
		
				it("should return matches for full-text conditions in ALL mode", async function () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'all');
					s.addCondition('fulltextWord', 'contains', 'foo');
					s.addCondition('fulltextWord', 'contains', 'bar');
					let matches = await s.search();
					assert.deepEqual(matches, [foobarItem.id]);
				});
		
				it("should not return non-matches for full-text conditions in ALL mode", async function () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'all');
					s.addCondition('fulltextWord', 'contains', 'mjktkiuewf');
					s.addCondition('fulltextWord', 'contains', 'zijajkvudk');
					let matches = await s.search();
					assert.lengthOf(matches, 0);
				});
		
				it("should return a match that satisfies only one of two full-text condition in ANY mode", async function () {
					let s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('fulltextWord', 'contains', 'bar');
					s.addCondition('fulltextWord', 'contains', 'nomatch');
					let matches = await s.search();
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

				it("should include a match's parents and children", async function () {
					var itemTitle = 'zincp' + Zotero.Utilities.randomString();
					var attTitle = 'zinca' + Zotero.Utilities.randomString();
					var item = await createDataObject('item', { title: itemTitle });
					var attachment = await importPDFAttachment(item);
					attachment.setField('title', attTitle);
					await attachment.saveTx();

					let run = (value) => {
						var s = new Zotero.Search();
						s.libraryID = userLibraryID;
						s.addCondition('title', 'is', value);
						s.addCondition('includeParentsAndChildren', 'true');
						return s.search();
					};
					// Matching the parent pulls in its child, and matching the child its parent
					assert.sameMembers(await run(itemTitle), [item.id, attachment.id]);
					assert.sameMembers(await run(attTitle), [item.id, attachment.id]);

					await item.eraseTx();
				});
			});

			describe("noChildren", function () {
				it("should keep only top-level items", async function () {
					var title = 'znochild' + Zotero.Utilities.randomString();
					var item = await createDataObject('item', { title });
					var attachment = await importPDFAttachment(item);
					attachment.setField('title', title);
					await attachment.saveTx();

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('title', 'contains', title);
					s.addCondition('noChildren', 'true');
					// The child attachment matches the title too, but noChildren excludes it
					assert.sameMembers(await s.search(), [item.id]);

					await item.eraseTx();
				});
			});
			
			describe("key", function () {
				it("should allow more than max bound parameters", async function () {
					let s = new Zotero.Search();
					let max = Zotero.DB.MAX_BOUND_PARAMETERS + 100;
					for (let i = 0; i < max; i++) {
						s.addCondition('key', 'is', Zotero.DataObjectUtilities.generateKey());
					}
					await s.search();
				});
			});

			describe("anyField", function () {
				it("should expand an 'any field' within its own group", async function () {
					// (anyField contains "znestfoo" OR title contains "zzznomatch") -> the
					// item matches via Any Field. If the Any Field expansion leaked to the
					// top level (ANDed) instead of staying in this OR-group, the
					// non-matching title would exclude it.
					var item = await createDataObject('item', { title: "znestfoo" });

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('groupStart', 'true', '');
					s.addCondition('joinMode', 'any');
					s.addCondition('anyField', 'contains', "znestfoo");
					s.addCondition('title', 'contains', "zzznomatch");
					s.addCondition('groupEnd', 'true', '');
					var matches = await s.search();
					assert.includeMembers(matches, [item.id]);

					await item.eraseTx();
				});
				it("should return matches for multiple 'any field' conditions with joinMode=any", async function () {
					var itemOne = await createDataObject('item', { title: "one" });
					var itemTwo = await createDataObject('item', { title: "two" });
					
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('anyField', 'contains', "one");
					s.addCondition('anyField', 'contains', "two");
					var matches = await s.search();
					assert.sameMembers(matches, [itemOne.id, itemTwo.id]);
				});
				it("should return matches for 'any field' and title condition with joinMode=any", async function () {
					var itemOne = await createDataObject('item', { title: "three" });
					var itemTwo = await createDataObject('item', { title: "four" });
					
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('joinMode', 'any');
					s.addCondition('anyField', 'contains', "three");
					s.addCondition('title', 'contains', "four");
					var matches = await s.search();
					assert.sameMembers(matches, [itemOne.id, itemTwo.id]);
				});
				it("should return matches for a single 'any field' condition", async function () {
					var itemOne = await createDataObject('item', { title: "five" });
					var itemTwo = await createDataObject('item');
					
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('anyField', 'contains', itemOne.getDisplayTitle());
					var matches = await s.search();
					assert.sameMembers(matches, [itemOne.id]);
				});
				it("should return matches for two 'any field' condition with joinMode=all", async function () {
					var itemOne = await createDataObject('item', { title: "six-seven" });
					var itemTwo = await createDataObject('item', { title: "seven-six" });

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('anyField', 'contains', "six");
					s.addCondition('anyField', 'contains', "seven");
					s.addCondition('joinMode', 'all');
					var matches = await s.search();
					assert.sameMembers(matches, [itemOne.id, itemTwo.id]);
				});
				it("should return matches for annotation text", async function () {
					var attachment = await importPDFAttachment();
					var annotation = await createAnnotation('highlight', attachment);
					var str = annotation.annotationText.substr(0, 7);

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('anyField', 'contains', str);
					var matches = await s.search();
					assert.include(matches, annotation.id);
				});
				it("should return matches for annotation comment", async function () {
					var attachment = await importPDFAttachment();
					var annotation = await createAnnotation('note', attachment);
					var str = annotation.annotationComment.substr(0, 7);

					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('anyField', 'contains', str);
					var matches = await s.search();
					assert.include(matches, annotation.id);
				});
			});
			describe("titleCreatorYear", function () {
				it("should match title, creator, and year but not other fields", async function () {
					var word = 'ztcy' + Zotero.Utilities.randomString();
					// Matches via title
					var byTitle = await createDataObject('item', { title: 'a ' + word + ' b' });
					// Matches via creator
					var byCreator = await createDataObject('item', {
						creators: [{ creatorType: 'author', lastName: word, firstName: 'X' }]
					});
					// Has the word only in a field outside the title/creator/year set
					var byOther = await createDataObject('item');
					byOther.setField('abstractNote', 'a ' + word + ' b');
					await byOther.saveTx();
					
					var s = new Zotero.Search();
					s.libraryID = userLibraryID;
					s.addCondition('titleCreatorYear', 'contains', word);
					assert.sameMembers(await s.search(), [byTitle.id, byCreator.id]);
					
					await Zotero.Items.erase([byTitle.id, byCreator.id, byOther.id]);
				});
			});
			
			
			describe("savedSearch", function () {
				it("should return items in the saved search", async function () {
					var search = await createDataObject('search');
					var itemTitle = search.getConditions()[0].value;
					var item = await createDataObject('item', { title: itemTitle })
					
					var s = new Zotero.Search;
					s.libraryID = Zotero.Libraries.userLibraryID;
					s.addCondition('savedSearch', 'is', search.key);
					var matches = await s.search();
					assert.deepEqual(matches, [item.id]);
				});
				
				it("should return items not in the saved search for isNot operator", async function () {
					var search = await createDataObject('search');
					var itemTitle = search.getConditions()[0].value;
					var item = await createDataObject('item', { title: itemTitle })
					
					var s = new Zotero.Search;
					s.libraryID = Zotero.Libraries.userLibraryID;
					s.addCondition('savedSearch', 'isNot', search.key);
					var matches = await s.search();
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
				it("shouldn't include items in My Publications", async function () {
					var item1 = await createDataObject('item');
					var item2 = await createDataObject('item', { inPublications: true });
					
					var s = new Zotero.Search;
					s.libraryID = Zotero.Libraries.userLibraryID;
					s.addCondition('unfiled', 'true');
					var matches = await s.search();
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
					it("should match annotation for tag search", async function () {
						var attachment = await importPDFAttachment();
						var annotation = await createAnnotation('highlight', attachment);
						var tag = Zotero.Utilities.randomString();
						annotation.addTag(tag);
						await annotation.saveTx();
						
						var s = new Zotero.Search();
						s.libraryID = userLibraryID;
						s.addCondition('quicksearch-fields', 'contains', tag);
						var matches = await s.search();
						assert.sameMembers(matches, [annotation.id]);
					});

					it("should match annotation of top-level attachment within scope", async function () {
						// Create collection with an attachment
						var collection = await createDataObject('collection');
						var attachment = await importPDFAttachment();
						attachment.addToCollection(collection.id);
						await attachment.saveTx();

						// Add annotation with a tag to that attachment
						var annotation = await createAnnotation('highlight', attachment);
						var tag = Zotero.Utilities.randomString();
						annotation.addTag(tag);
						await annotation.saveTx();

						// Search within the scope of that collection by tag
						var scope = new Zotero.Search();
						scope.libraryID = userLibraryID;
						scope.addCondition('noChildren', 'true');
						scope.addCondition('collectionID', 'is', collection.id);

						var s = new Zotero.Search();
						s.libraryID = userLibraryID;
						s.addCondition('quicksearch-fields', 'contains', tag);
						s.setScope(scope, true);

						// Expect child annotation to be found
						var matches = await s.search();
						assert.sameMembers(matches, [annotation.id]);
					});

					it("should match annotation of a child attachment of an item within scope", async function () {
						// Create collection with a top-level item and an attachment
						var collection = await createDataObject('collection');
						var item = await createDataObject('item');
						var attachment = await importPDFAttachment(item);
						item.addToCollection(collection.id);
						await item.saveTx();

						// Add annotation with a tag to the attachment
						var annotation = await createAnnotation('highlight', attachment);
						var tag = Zotero.Utilities.randomString();
						annotation.addTag(tag);
						await annotation.saveTx();

						// Search within the scope of that collection by tag
						var scope = new Zotero.Search();
						scope.libraryID = userLibraryID;
						scope.addCondition('noChildren', 'true');
						scope.addCondition('collectionID', 'is', collection.id);

						var s = new Zotero.Search();
						s.libraryID = userLibraryID;
						s.addCondition('quicksearch-fields', 'contains', tag);
						s.setScope(scope, true);

						// Expect child annotation to be found
						var matches = await s.search();
						assert.sameMembers(matches, [annotation.id]);
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
						assert.sameMembers(matches, [annotation.id]);
					});
					
					it("should not include items outside of scope during phrase search", async function () {
						var col = await createDataObject('collection');
						fooItem.addToCollection(col.id);
						await fooItem.saveTx();
	
						// Quicksearch from a collection
						let collectionScope = new Zotero.Search();
						collectionScope.libraryID = userLibraryID;
						collectionScope.addCondition('noChildren', 'true');
						collectionScope.addCondition('collectionID', 'is', col.id);
						
						var s = new Zotero.Search();
						s.libraryID = userLibraryID;
						// Phrase search
						s.addCondition('quicksearch-everything', 'contains', '"foo"');
						s.setScope(collectionScope, true);
						var matches = await s.search();
						// Only the item from the collection is returned
						assert.equal(matches.length, 1);
						assert.equal(matches[0], fooItem.id);
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
		it("should output all data", async function () {
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
		it("should migrate a `childNote` condition to `note` at the item level", async function () {
			var text = 'zjsoncn' + Zotero.Utilities.randomString();
			var item = await createDataObject('item', { title: 'zjsoncnitem' });
			var note = new Zotero.Item('note');
			note.libraryID = item.libraryID;
			note.parentID = item.id;
			note.setNote('<p>' + text + '</p>');
			await note.saveTx();

			var s = new Zotero.Search();
			s.libraryID = item.libraryID;
			s.fromJSON({
				name: 'Test',
				conditions: [{ condition: 'childNote', operator: 'contains', value: text }]
			});

			var conds = Object.values(s.getConditions());
			assert.include(conds.map(c => c.condition), 'note');
			assert.notInclude(conds.map(c => c.condition), 'childNote');
			var resultLevel = conds.find(c => c.condition == 'resultLevel');
			assert.ok(resultLevel);
			assert.equal(resultLevel.operator, 'item');
			assert.sameMembers(await s.search(), [item.id]);

			await item.eraseTx();
		});

		it("should update all data", async function () {
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
