describe("Support Functions for Unit Testing", function() {
	describe("resetDB", function() {
		it("should restore the DB to factory settings", function() {
			this.timeout(10000);
			var quickstart = Zotero.Items.erase(1);
			assert.equal(Zotero.Items.get(1), false);
			return resetDB().then(function() {
				assert.equal(Zotero.Items.get(1).getField("url"), "http://zotero.org/support/quick_start_guide");
			});
		});
	});
	describe("loadSampleData", function() {
		it("should load data from file", function() {
			let data = loadSampleData('journalArticle');
			assert.isObject(data, 'loaded data object');
			assert.isNotNull(data);
			assert.isAbove(Object.keys(data).length, 0, 'data object is not empty');
		});
	});
	describe("populateDBWithSampleData", function() {
		it("should populate database with data", function() {
			let data = loadSampleData('journalArticle');
			populateDBWithSampleData(data);
			
			let skipFields = ['id', 'itemType', 'creators']; // Special comparisons
			
			for (let itemName in data) {
				let item = data[itemName];
				assert.isAbove(item.id, 0, 'assigned new item ID');
				
				let zItem = Zotero.Items.get(item.id);
				assert.ok(zItem, 'inserted item into database');
				
				// Compare item type
				assert.equal(item.itemType, Zotero.ItemTypes.getName(zItem.itemTypeID), 'inserted item has the same item type');
				
				// Compare simple properties
				for (let prop in item) {
					if (skipFields.indexOf(prop) != -1) continue;
					
					// Using base-mapped fields
					assert.equal(item[prop], zItem.getField(prop, false, true), 'inserted item property has the same value as sample data');
				}
				
				if (item.creators) {
					// Compare creators
					for (let i=0; i<item.creators.length; i++) {
						let creator = item.creators[i];
						let zCreator = zItem.getCreator(i);
						assert.ok(zCreator, 'creator was added to item');
						assert.equal(creator.firstName, zCreator.ref.firstName, 'first names match');
						assert.equal(creator.lastName, zCreator.ref.lastName, 'last names match');
						assert.equal(creator.creatorType, Zotero.CreatorTypes.getName(zCreator.creatorTypeID), 'creator types match');
					}
				}
			}
		});
	});
	describe("generateAllTypesAndFieldsData", function() {
		it("should generate all types and fields data", function() {
			let data = generateAllTypesAndFieldsData();
			assert.isObject(data, 'created data object');
			assert.isNotNull(data);
			assert.isAbove(Object.keys(data).length, 0, 'data object is not empty');
		});
		it("all types and fields sample data should be up to date", function() {
			assert.deepEqual(loadSampleData('allTypesAndFields'), generateAllTypesAndFieldsData());
		});
	});
});