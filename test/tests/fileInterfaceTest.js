describe("Zotero_File_Interface", function() {
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

    it('should import a file into a collection', function* () {
        this.timeout(10000);
        let testFile = getTestDataDirectory();
        testFile.append("allTypesAndFields.js");
        yield win.Zotero_File_Interface.importFile(testFile);

        let importedCollection = yield Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID).filter(x => x.name == 'allTypesAndFields');
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
        assert.deepEqual(savedItems, trueItems, "saved items match inputs")
    });
    
	it('should import an item and snapshot from Zotero RDF', function* () {
		var tmpDir = yield getTempDirectory();
		var rdfFile = OS.Path.join(tmpDir, 'test.rdf');
		yield OS.File.copy(OS.Path.join(getTestDataDirectory().path, 'book_and_snapshot.rdf'), rdfFile);
		yield OS.File.makeDir(OS.Path.join(tmpDir, 'files'));
		yield OS.File.makeDir(OS.Path.join(tmpDir, 'files', 2));
		yield OS.File.copy(
			OS.Path.join(getTestDataDirectory().path, 'test.html'),
			OS.Path.join(tmpDir, 'files', 2, 'test.html')
		);
		
		var promise = waitForItemEvent('add');
		Zotero.debug(yield Zotero.File.getContentsAsync(rdfFile));
		yield win.Zotero_File_Interface.importFile(Zotero.File.pathToFile(rdfFile))
		var ids = yield promise;
		assert.lengthOf(ids, 1);
		
		// Check book
		var item = Zotero.Items.get(ids[0]);
		assert.equal(item.itemTypeID, Zotero.ItemTypes.getID('book'));
		
		// Check attachment
		var ids = item.getAttachments();
		assert.lengthOf(ids, 1);
		var attachment = Zotero.Items.get(ids[0]);
		assert.equal(attachment.attachmentCharset, 'utf-8');
		
		// Check indexing
		var matches = yield Zotero.Fulltext.findTextInItems([attachment.id], 'test');
		assert.lengthOf(matches, 1);
		assert.propertyVal(matches[0], 'id', attachment.id);
	});
});