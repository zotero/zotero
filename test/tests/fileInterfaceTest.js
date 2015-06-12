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
            let savedItem = yield childItems[i].toJSON();
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
});