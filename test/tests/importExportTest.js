describe("Import/Export", function () {
	describe("Zotero RDF", function () {
		var namespaces = {
			rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
			dc: 'http://purl.org/dc/elements/1.1/'
		};
		
		it("should export related items", async function () {
			// Create related items
			var item1 = new Zotero.Item('book');
			item1.setField('title', 'A');
			item1.setField('ISBN', 1421402831);
			await item1.saveTx();
			var item2 = new Zotero.Item('webpage');
			item2.setField('title', 'B');
			item2.setField('url', 'http://example.com');
			await item2.saveTx();
			item1.addRelatedItem(item2);
			item2.addRelatedItem(item1);
			await item1.saveTx();
			await item2.saveTx();
			
			var note1 = await createDataObject('item', { itemType: 'note', parentID: item1.id, note: 'C' });
			var note2 = await createDataObject('item', { itemType: 'note', parentID: item1.id, note: 'D' });
			note1.addRelatedItem(note2);
			note2.addRelatedItem(note1);
			await note1.saveTx();
			await note2.saveTx();
			
			// Export
			var file = OS.Path.join(await getTempDirectory(), 'export.rdf');
			var translator = Zotero.Translators.get('14763d24-8ba0-45df-8f52-b8d1108e7ac9');
			var displayOptions = {
				exportNotes: true
			};
			var translation = new Zotero.Translate.Export();
			translation.setItems([item1, item2]);
			translation.setLocation(Zotero.File.pathToFile(file));
			translation.setTranslator(translator);
			translation.setDisplayOptions(displayOptions);
			await translation.translate();
			
			// Parse exported file and look for dc:relation elements
			var dp = new DOMParser();
			var doc = dp.parseFromString(Zotero.File.getContents(file), 'text/xml');
			var item1Node = doc.querySelector(`Book`);
			var item2Node = doc.querySelector(`Document`);
			var note1Node = doc.querySelector(`Memo[*|about="#item_${note1.id}"]`);
			var note2Node = doc.querySelector(`Memo[*|about="#item_${note2.id}"]`);
			assert.equal(
				Zotero.Utilities.xpath(item1Node, './dc:relation', namespaces)[0]
					.getAttributeNS(namespaces.rdf, 'resource'),
				'http://example.com'
			);
			assert.equal(
				Zotero.Utilities.xpath(item2Node, './dc:relation', namespaces)[0]
					.getAttributeNS(namespaces.rdf, 'resource'),
				'urn:isbn:1-4214-0283-1'
			);
			assert.equal(
				Zotero.Utilities.xpath(note1Node, './dc:relation', namespaces)[0]
					.getAttributeNS(namespaces.rdf, 'resource'),
				'#item_' + note2.id
			);
			assert.equal(
				Zotero.Utilities.xpath(note2Node, './dc:relation', namespaces)[0]
					.getAttributeNS(namespaces.rdf, 'resource'),
				'#item_' + note1.id
			);
		});
		
		// Not currently supported
		it.skip("should import related items", async function () {
			var libraryID = Zotero.Libraries.userLibraryID;
			var file = OS.Path.join(getTestDataDirectory().path, 'zotero_rdf.xml');
			translation = new Zotero.Translate.Import();
			translation.setLocation(Zotero.File.pathToFile(file));
			let translators = await translation.getTranslators();
			translation.setTranslator(translators[0]);
			var newItems = await translation.translate({ libraryID });
			assert.lengthOf(newItems, 2); // DEBUG: why aren't child items returned here?
			// Parent item
			assert.lengthOf(newItems[0].relatedItems, 1);
			assert.lengthOf(newItems[1].relatedItems, 1);
			assert.sameMembers(newItems[0].relatedItems, [newItems[1]]);
			assert.sameMembers(newItems[1].relatedItems, [newItems[0]]);
			
			var notes = newItems[0].getNotes();
			assert.lengthOf(notes, 2);
			var newNote1 = Zotero.Items.get(notes[0]);
			var newNote2 = Zotero.Items.get(notes[1]);
			assert.lengthOf(newNote1.relatedItems, 1);
			assert.lengthOf(newNote2.relatedItems, 1);
			assert.sameMembers(newNote1.relatedItems, [newNote2]);
			assert.sameMembers(newNote2.relatedItems, [newNote1]);
		});
		
		describe("standalone attachments", function () {
			var rdf = `<rdf:RDF
 xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
 xmlns:z="http://www.zotero.org/namespaces/export#"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:link="http://purl.org/rss/1.0/modules/link/"
 xmlns:bib="http://purl.org/net/biblio#"
 xmlns:foaf="http://xmlns.com/foaf/0.1/"
 xmlns:prism="http://prismstandard.org/namespaces/1.2/basic/">
    <z:Attachment rdf:about="#item_1234">
        <z:itemType>attachment</z:itemType>
        <rdf:resource rdf:resource="files/1234/test1.pdf"/>
        <dc:identifier>
            <dcterms:URI>
                <rdf:value>https://example.com</rdf:value>
            </dcterms:URI>
        </dc:identifier>
        <dcterms:dateSubmitted>2022-07-22 06:36:31</dcterms:dateSubmitted>
        <dc:title>Test 1</dc:title>
        <z:linkMode>1</z:linkMode>
        <link:type>application/pdf</link:type>
    </z:Attachment>
	<z:Attachment rdf:about="#item_2345">
        <z:itemType>attachment</z:itemType>
        <rdf:resource rdf:resource="files/2345/test2.pdf"/>
        <dc:title>Test 2</dc:title>
        <link:type>application/pdf</link:type>
    </z:Attachment>
</rdf:RDF>
`;
			async function doImport(libraryID) {
				var tempDir = await getTempDirectory();
				var file = OS.Path.join(tempDir, 'export.rdf');
				await Zotero.File.putContentsAsync(file, rdf);
				var folder1 = OS.Path.join(tempDir, 'files', '1234');
				var folder2 = OS.Path.join(tempDir, 'files', '2345');
				await OS.File.makeDir(folder1, { from: tempDir });
				await OS.File.makeDir(folder2, { from: tempDir });
				await OS.File.copy(
					OS.Path.join(OS.Path.join(getTestDataDirectory().path, 'test.pdf')),
					OS.Path.join(folder1, 'test1.pdf')
				);
				await OS.File.copy(
					OS.Path.join(OS.Path.join(getTestDataDirectory().path, 'test.pdf')),
					OS.Path.join(folder2, 'test2.pdf')
				);
				
				var translation = new Zotero.Translate.Import();
				translation.setLocation(Zotero.File.pathToFile(file));
				let translators = await translation.getTranslators();
				translation.setTranslator(translators[0]);
				var newItems = await translation.translate({ libraryID });
				
				var newItem1 = newItems.filter(x => x.getField('title') == 'Test 1')[0];
				assert.equal(newItem1.itemType, 'attachment');
				assert.ok(await newItem1.getFilePathAsync());
				
				var newItem2 = newItems.filter(x => x.getField('title') == 'Test 2')[0];
				assert.equal(newItem2.itemType, 'attachment');
				assert.ok(await newItem1.getFilePathAsync());
				
				return [newItem1, newItem2];
			}
			
			it("should import into My Library", async function () {
				var libraryID = Zotero.Libraries.userLibraryID;
				var [newItem1, newItem2] = await doImport(libraryID);
				assert.equal(newItem1.libraryID, libraryID);
				assert.equal(newItem2.libraryID, libraryID);
			});
			
			it("should import into group library", async function () {
				var libraryID = (await getGroup()).libraryID;
				var [newItem1, newItem2] = await doImport(libraryID);
				assert.equal(newItem1.libraryID, libraryID);
				assert.equal(newItem2.libraryID, libraryID);
			});
		});
	});
});