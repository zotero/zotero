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
	
	it('should import a MODS file', function* () {
		var modsFile = OS.Path.join(getTestDataDirectory().path, "mods.xml");
		
		var promise = waitForItemEvent('add');
		yield win.Zotero_File_Interface.importFile(Zotero.File.pathToFile(modsFile));
		var ids = yield promise;
		assert.lengthOf(ids, 1);
		
		var item = Zotero.Items.get(ids[0]);
		assert.equal(item.itemTypeID, Zotero.ItemTypes.getID('journalArticle'));
		assert.equal(item.getField('title'), "Test");
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
		it("should copy HTML and text citations to the clipboard", function* () {
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
			str = getDataForFlavor('text/unicode');
			assert.equal(str, '(A, 2016; B, 2016)');
		});
		
		it("should copy HTML and text bibliography to the clipboard", function* () {
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
			str = getDataForFlavor('text/unicode');
			assert.equal(str, 'A. (2016).\nB. (2016).\n');
		});
		
		//
		// "Copy as HTML" mode
		//
		it("should copy HTML and HTML source citations to the clipboard", function* () {
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
			str = getDataForFlavor('text/unicode');
			assert.equal(str, '(<i>A</i>, 2016; <i>B</i>, 2016)');
		});
		
		it("should copy HTML and HTML source bibliography to the clipboard", function* () {
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
			str = getDataForFlavor('text/unicode');
			assert.include(str, 'line-height');
			assert.include(str, '<i>A</i>');
			assert.include(str, '<i>B</i>');
		});
	});
});