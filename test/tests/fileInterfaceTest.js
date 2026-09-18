describe("Zotero_File_Interface", function () {
    let win;
    before(function* () {
        win = yield loadZoteroPane();
        yield OS.File.copy(OS.Path.join(getTestDataDirectory().path, "Test Import Translator.js"),
                           OS.Path.join(Zotero.getTranslatorsDirectory().path, "Test Import Translator.js"));
        yield Zotero.Translators.reinit();
    });
    after(function () {
        win.close();
    });

    it('should import all types and fields into a new collection', async function () {
        this.timeout(10000);
        let testFile = getTestDataDirectory();
        testFile.append("allTypesAndFields.js");
        await win.Zotero_File_Interface.importFile({
        	file: testFile
        });

        let importedCollection = Zotero.Collections.getByLibrary(
			Zotero.Libraries.userLibraryID
		).filter(x => x.name == 'allTypesAndFields');
        assert.equal(importedCollection.length, 1);
        let childItems = importedCollection[0].getChildItems();
        let savedItems = {};
        for (let i=0; i<childItems.length; i++) {
            let savedItem = childItems[i].toJSON();
            delete savedItem.dateAdded;
            delete savedItem.dateModified;
            delete savedItem.key;
            delete savedItem.collections;
            savedItems[Zotero.ItemTypes.getName(childItems[i].itemTypeID)] = savedItem;
        }
        let trueItems = loadSampleData('itemJSON');
        for (let itemType in trueItems) {
            let trueItem = trueItems[itemType];
            delete trueItem.dateAdded;
            delete trueItem.dateModified;
            delete trueItem.key;
            delete trueItem.collections;
        }
        assert.deepEqual(savedItems, trueItems, "saved items match inputs");
    });
    
    
    it("should import RIS into selected collection", async function () {
		var collection = await createDataObject('collection');
		await select(win, collection);
		
        var testFile = OS.Path.join(getTestDataDirectory().path, 'book_and_child_note.ris');
        await win.Zotero_File_Interface.importFile({
				file: testFile,
				createNewCollection: false
        });
        
        var items = collection.getChildItems();
        assert.lengthOf(items, 1);
        var childNotes = items[0].getNotes();
        assert.lengthOf(childNotes, 1);
        assert.equal(Zotero.Items.get(childNotes[0]).getNote(), '<p>Child</p>');
    });
    
    
	it('should import an item and snapshot from Zotero RDF', async function () {
		var tmpDir = await getTempDirectory();
		var rdfFile = OS.Path.join(tmpDir, 'test.rdf');
		await OS.File.copy(OS.Path.join(getTestDataDirectory().path, 'book_and_snapshot.rdf'), rdfFile);
		await OS.File.makeDir(OS.Path.join(tmpDir, 'files'));
		await OS.File.makeDir(OS.Path.join(tmpDir, 'files', '2'));
		await OS.File.copy(
			OS.Path.join(getTestDataDirectory().path, 'test.html'),
			OS.Path.join(tmpDir, 'files', '2', 'test.html')
		);
		
		var promise = waitForItemEvent('add');
		await win.Zotero_File_Interface.importFile({
			file: rdfFile
		});
		var ids = await promise;
		// Notifications are batched
		assert.lengthOf(ids, 2);
		
		// Check book
		var item = Zotero.Items.get(ids[0]);
		assert.equal(item.itemTypeID, Zotero.ItemTypes.getID('book'));
		
		// Check attachment
		var ids = item.getAttachments();
		assert.lengthOf(ids, 1);
		var attachment = Zotero.Items.get(ids[0]);
		assert.equal(attachment.attachmentCharset, 'utf-8');
		
		// Check indexing
		var matches = await Zotero.Fulltext.findTextInItems([attachment.id], 'test');
		assert.lengthOf(matches, 1);
		assert.propertyVal(matches[0], 'id', attachment.id);
	});
	
	it("should import a single top-level collection without creating another collection", async function () {
		var collection = await createDataObject('collection', { name: 'Exported' });
		var subcollection = await createDataObject(
			'collection', { name: 'Sub', parentID: collection.id }
		);
		var item = await createDataObject(
			'item', { title: 'Collection', collections: [collection.id] }
		);
		var sharedItem = await createDataObject(
			'item', { title: 'Both', collections: [collection.id, subcollection.id] }
		);
		
		var file = OS.Path.join(await getTempDirectory(), 'exported.rdf');
		var translation = new Zotero.Translate.Export();
		translation.setCollection(collection);
		translation.setLocation(Zotero.File.pathToFile(file));
		translation.setTranslator('14763d24-8ba0-45df-8f52-b8d1108e7ac9');
		await translation.translate();
		
		await win.Zotero_File_Interface.importFile({ file });
		
		// The imported collection is at the top level, rather than inside a collection named
		// after the file
		var collections = Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID);
		assert.isEmpty(collections.filter(c => c.name == 'exported'));
		var imported = collections.filter(c => c.name == collection.name && c.id != collection.id);
		assert.lengthOf(imported, 1);
		
		var titles = c => c.getChildItems().map(i => i.getField('title'));
		assert.sameMembers(
			titles(imported[0]), [item.getField('title'), sharedItem.getField('title')]
		);
		
		var importedSubcollections = imported[0].getChildCollections();
		assert.lengthOf(importedSubcollections, 1);
		assert.equal(importedSubcollections[0].name, subcollection.name);
		assert.sameMembers(titles(importedSubcollections[0]), [sharedItem.getField('title')]);
	});
	
	it("should keep items outside a single imported collection out of it", async function () {
		var group = await createGroup({ name: 'Import' + Zotero.Utilities.randomString() });
		var libraryID = group.libraryID;
		var collection = await createDataObject(
			'collection', { name: 'Collection', libraryID }
		);
		var collectionItem = await createDataObject(
			'item', { title: 'InCollection', libraryID, collections: [collection.id] }
		);
		var unfiledItem = await createDataObject('item', { title: 'Unfiled', libraryID });
		
		var file = OS.Path.join(await getTempDirectory(), 'library-export.rdf');
		var translation = new Zotero.Translate.Export();
		translation.setLibraryID(libraryID);
		translation.setLocation(Zotero.File.pathToFile(file));
		translation.setTranslator('14763d24-8ba0-45df-8f52-b8d1108e7ac9');
		await translation.translate();
		
		await win.Zotero_File_Interface.importFile({ file });
		
		// The unfiled item doesn't belong to the imported collection, so the collection created
		// for the import is kept to hold it
		var importCollections = Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID)
			.filter(c => c.name == 'library-export');
		assert.lengthOf(importCollections, 1);
		var titles = c => c.getChildItems().map(i => i.getField('title'));
		assert.sameMembers(titles(importCollections[0]), [unfiledItem.getField('title')]);
		
		var imported = importCollections[0].getChildCollections();
		assert.lengthOf(imported, 1);
		assert.equal(imported[0].name, collection.name);
		assert.sameMembers(titles(imported[0]), [collectionItem.getField('title')]);
	});
	
	it("should import multiple exported collections below the collection created for the import", async function () {
		var collection1 = await createDataObject('collection', { name: 'First' });
		var subcollection = await createDataObject(
			'collection', { name: 'Sub', parentID: collection1.id }
		);
		var collection2 = await createDataObject('collection', { name: 'Second' });
		var item1 = await createDataObject(
			'item', { title: 'InFirst', collections: [collection1.id] }
		);
		var subItem = await createDataObject(
			'item', { title: 'InSub', collections: [subcollection.id] }
		);
		var item2 = await createDataObject(
			'item', { title: 'InSecond', collections: [collection2.id] }
		);
		
		var file = OS.Path.join(await getTempDirectory(), 'multiple.rdf');
		var translation = new Zotero.Translate.Export();
		translation.setCollections([collection1, collection2]);
		translation.setLocation(Zotero.File.pathToFile(file));
		translation.setTranslator('14763d24-8ba0-45df-8f52-b8d1108e7ac9');
		await translation.translate();
		
		await win.Zotero_File_Interface.importFile({ file });
		
		// Neither collection can stand in for the collection created for the import, so both are
		// imported below it
		var importCollections = Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID)
			.filter(c => c.name == 'multiple');
		assert.lengthOf(importCollections, 1);
		assert.isEmpty(importCollections[0].getChildItems());
		
		var titles = c => c.getChildItems().map(i => i.getField('title'));
		var imported = importCollections[0].getChildCollections();
		assert.sameMembers(imported.map(c => c.name), [collection1.name, collection2.name]);
		
		var importedFirst = imported.find(c => c.name == collection1.name);
		assert.sameMembers(titles(importedFirst), [item1.getField('title')]);
		var importedSubcollections = importedFirst.getChildCollections();
		assert.lengthOf(importedSubcollections, 1);
		assert.equal(importedSubcollections[0].name, subcollection.name);
		assert.sameMembers(titles(importedSubcollections[0]), [subItem.getField('title')]);
		
		var importedSecond = imported.find(c => c.name == collection2.name);
		assert.sameMembers(titles(importedSecond), [item2.getField('title')]);
	});
	
	it('should import a MODS file', async function () {
		var modsFile = OS.Path.join(getTestDataDirectory().path, "mods.xml");
		
		var promise = waitForItemEvent('add');
		await win.Zotero_File_Interface.importFile({
			file: modsFile
		});
		var ids = await promise;
		assert.lengthOf(ids, 1);
		
		var item = Zotero.Items.get(ids[0]);
		assert.equal(item.itemTypeID, Zotero.ItemTypes.getID('journalArticle'));
		assert.equal(item.getField('title'), "Test");
	});
	
	
	describe("#importFromClipboard()", function () {
		it("should import BibTeX from the clipboard", async function () {
			var str = "@article{last_test_nodate,\n	title = {Test},\n	author = {Last, First},\n}";
			Zotero.Utilities.Internal.copyTextToClipboard(str);
			var promise = waitForItemEvent('add');
			await win.Zotero_File_Interface.importFromClipboard();
			var ids = await promise;
			assert.lengthOf(ids, 1);
			
			var item = Zotero.Items.get(ids[0]);
			assert.equal(item.itemTypeID, Zotero.ItemTypes.getID('journalArticle'));
			assert.equal(item.getField('title'), "Test");
			var creator = item.getCreators()[0];
			assert.propertyVal(creator, 'firstName', "First")
			assert.propertyVal(creator, 'lastName', "Last")
		});
	});
	
	
	describe("#copyItemsToClipboard()", function () {
		var clipboardService, item1, item2;
		
		before(function* () {
			yield Zotero.Styles.init();
			
			clipboardService = Components.classes["@mozilla.org/widget/clipboard;1"]
				.getService(Components.interfaces.nsIClipboard);
			
			item1 = createUnsavedDataObject('item', { title: "A" });
			item1.setField('date', '2016');
			yield item1.saveTx();
			item2 = createUnsavedDataObject('item', { title: "B" });
			item2.setField('date', '2016');
			yield item2.saveTx();
		});
		
		function getDataForFlavor(flavor) {
			var transferable = Components.classes["@mozilla.org/widget/transferable;1"]
				.createInstance(Components.interfaces.nsITransferable);
			transferable.init(null);
			transferable.addDataFlavor(flavor);
			clipboardService.getData(transferable, Components.interfaces.nsIClipboard.kGlobalClipboard);
			var str = {};
			transferable.getTransferData(flavor, str, {})
			return str.value.QueryInterface(Components.interfaces.nsISupportsString).data;
		}
		
		//
		// Non-"Copy as HTML" mode
		//
		it("should copy HTML and text citations to the clipboard", async function () {
			win.Zotero_File_Interface.copyItemsToClipboard(
				[item1, item2],
				'http://www.zotero.org/styles/apa',
				'en-US',
				false,
				true
			);
			
			// HTML
			var str = getDataForFlavor('text/html');
			assert.equal(str, '(<i>A</i>, 2016; <i>B</i>, 2016)');
			
			// Plain text
			str = getDataForFlavor('text/plain');
			assert.equal(str, '(A, 2016; B, 2016)');
		});
		
		it("should copy HTML and text bibliography to the clipboard", async function () {
			win.Zotero_File_Interface.copyItemsToClipboard(
				[item1, item2],
				'http://www.zotero.org/styles/apa',
				'en-US'
			);
			
			var str = getDataForFlavor('text/html');
			assert.include(str, 'line-height');
			assert.include(str, '<i>A</i>');
			assert.include(str, '<i>B</i>');
			
			// Plain text
			str = getDataForFlavor('text/plain');
			assert.equal(str, 'A. (2016).\nB. (2016).\n');
		});
		
		//
		// "Copy as HTML" mode
		//
		it("should copy HTML and HTML source citations to the clipboard", async function () {
			win.Zotero_File_Interface.copyItemsToClipboard(
				[item1, item2],
				'http://www.zotero.org/styles/apa',
				'en-US',
				true,
				true
			);
			
			var str = getDataForFlavor('text/html');
			assert.equal(str, '(<i>A</i>, 2016; <i>B</i>, 2016)');
			
			// Plain text
			str = getDataForFlavor('text/plain');
			assert.equal(str, '(<i>A</i>, 2016; <i>B</i>, 2016)');
		});
		
		it("should copy HTML and HTML source bibliography to the clipboard", async function () {
			win.Zotero_File_Interface.copyItemsToClipboard(
				[item1, item2],
				'http://www.zotero.org/styles/apa',
				'en-US',
				true
			);
			
			var str = getDataForFlavor('text/html');
			assert.include(str, 'line-height');
			assert.include(str, '<i>A</i>');
			assert.include(str, '<i>B</i>');
			
			// Plain text
			str = getDataForFlavor('text/plain');
			assert.include(str, 'line-height');
			assert.include(str, '<i>A</i>');
			assert.include(str, '<i>B</i>');
		});
	});

	describe('Citavi annotations', () => {
		it('should import Citavi', async () => {
			var testFile = OS.Path.join(getTestDataDirectory().path, 'citavi-test-project.ctv6');
			
			const promise = waitForItemEvent('add');
			await win.Zotero_File_Interface.importFile({
				file: testFile,
				createNewCollection: false
			});
			
			const itemIDs = await promise;
			const importedItem = await Zotero.Items.getAsync(itemIDs[0]);
			assert.equal(importedItem.getField('title'), 'Bitcoin: A Peer-to-Peer Electronic Cash System');
			const importedPDF = await Zotero.Items.getAsync(importedItem.getAttachments()[0]);
			const annotations = importedPDF.getAnnotations();
			assert.lengthOf(annotations, 5);

			const annotation1 = annotations.find(a => a.annotationText === 'peer-to-peer');
			const annotation2 = annotations.find(a => a.annotationText === 'CPU power is controlled by nodes that are not cooperating to attack the network, they\'ll generate the longest chain and outpace attackers.');
			const annotation3 = annotations.find(a => a.annotationText === 'double-spending');
			const annotation4 = annotations.find(a => a.annotationText === 'This is a comment');
			const annotation5 = annotations.find(a => a.annotationText === 'This is a green highlight on page 3');

			assert.deepEqual(
				JSON.parse(annotation1.annotationPosition),
				{ pageIndex: 0, rects: [[230.202, 578.879, 275.478, 585.817], [230.202, 578.879, 275.478, 585.817]] }
			);

			// Note: The third rect not only wraps the first two rects, but also includes extra text,
			// which makes the current annotation text essentially incorrect
			assert.deepEqual(
				JSON.parse(annotation2.annotationPosition),
				{ pageIndex: 0, rects: [[228.335, 475.341, 461.756, 482.179], [146.3, 463.841, 437.511, 470.679], [146.3, 463.841, 461.756, 482.179]] },
			);

			assert.deepEqual(
				JSON.parse(annotation3.annotationPosition),
				{ pageIndex: 0, rects: [[254.515, 532.841, 316.462, 539.679], [254.515, 532.841, 316.462, 539.679]] },
			);

			assert.deepEqual(
				JSON.parse(annotation4.annotationPosition),
				{ pageIndex: 0, rects: [[146.3, 429.341, 199.495, 436.179], [146.3, 429.341, 199.495, 436.179]] }
			);

			assert.deepEqual(
				JSON.parse(annotation5.annotationPosition),
				{ pageIndex: 2, rects: [[133.3, 330.924, 185.269, 340.294], [133.3, 330.924, 185.269, 340.294]] }
			);

			assert.equal(annotation1.annotationSortIndex, '00000|000103|00206');
			assert.equal(annotation2.annotationSortIndex, '00000|000706|00309');
			assert.equal(annotation3.annotationSortIndex, '00000|000390|00252');
			assert.equal(annotation4.annotationSortIndex, '00000|000981|00355');
			assert.equal(annotation5.annotationSortIndex, '00002|001638|00451');

			assert.deepEqual(annotation1.getTags(), [{ tag: 'red' }]);
			assert.deepEqual(annotation2.getTags(), [{ tag: 'blue' }]);
			assert.deepEqual(annotation3.getTags(), []);
			assert.deepEqual(annotation4.getTags(), [{ tag: 'comment' }]);
			assert.deepEqual(annotation5.getTags(), []);

			assert.equal(annotation1.annotationPageLabel, '1');
			assert.equal(annotation2.annotationPageLabel, '1');
			assert.equal(annotation3.annotationPageLabel, '1');
			assert.equal(annotation4.annotationPageLabel, '1');
			assert.equal(annotation5.annotationPageLabel, '3');
		});
	});
});
