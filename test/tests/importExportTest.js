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
	});
});