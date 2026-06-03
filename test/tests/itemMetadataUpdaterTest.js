/* global assert, buildDummyTranslator, createDataObject, createUnsavedDataObject, describe, it */

function makeSearchTranslatorProvider(jsonItems) {
	if (!Array.isArray(jsonItems)) {
		jsonItems = [jsonItems];
	}

	let json = JSON.stringify(jsonItems).replace(/['\\]/g, "\\$&");
	let translator = buildDummyTranslator(
		'search',
		"function detectSearch(search) { return 'journalArticle'; }\n"
			+ "function doSearch(search) {\n"
			+ "	var items = JSON.parse('" + json + "');\n"
			+ "	for (var i = 0; i < items.length; i++) {\n"
			+ "		var item = new Zotero.Item(items[i].itemType || 'journalArticle');\n"
			+ "		for (var field in items[i]) { item[field] = items[i][field]; }\n"
			+ "		item.complete();\n"
			+ "	}\n"
			+ "}\n"
	);

	return Zotero.Translators.makeTranslatorProvider({
		get: function (translatorID) {
			return translatorID == translator.translatorID ? translator : false;
		},

		getAllForType: async function (type) {
			return type == 'search' ? [translator] : [];
		}
	});
}

describe("Zotero.ItemMetadataUpdater", function () {
	const doi = '10.1111/test';

	describe("#lookupItemJSONByDOI()", function () {
		it("should return unsaved item JSON from a DOI search translator", async function () {
			let provider = makeSearchTranslatorProvider({
				itemType: 'journalArticle',
				DOI: doi,
				title: 'Translated Title'
			});

			let itemJSON = await Zotero.ItemMetadataUpdater.lookupItemJSONByDOI(
				doi,
				{ translatorProvider: provider }
			);

			assert.equal(itemJSON.title, 'Translated Title');
			assert.equal(itemJSON.DOI, doi);
			assert.isUndefined(itemJSON.id);
		});
	});

	describe("#getFieldDiff()", function () {
		it("should fill only empty fields and skip non-empty fields", function () {
			let item = createUnsavedDataObject('item', {
				itemType: 'journalArticle',
				title: 'Existing Title',
				creators: [{ firstName: 'Existing', lastName: 'Author', creatorType: 'author' }]
			});
			item.setField('DOI', doi);

			let diff = Zotero.ItemMetadataUpdater.getFieldDiff(item, {
				itemType: 'book',
				DOI: doi,
				title: 'Translated Title',
				publicationTitle: 'Translated Journal',
				creators: [{ firstName: 'Translated', lastName: 'Author', creatorType: 'author' }],
				tags: ['automatic'],
				collections: ['ignored'],
				relations: { dc: ['ignored'] },
				seeAlso: ['ignored']
			});

			assert.sameMembers(diff.fields.map(change => change.field), ['publicationTitle']);
			assert.equal(diff.fields[0].newValue, 'Translated Journal');
			assert.sameMembers(diff.skipped.map(change => change.field), ['DOI', 'title', 'creators']);
			assert.isNull(diff.creators);
		});
	});

	describe("#updateItemFromDOI()", function () {
		it("should update empty metadata and preserve existing user data", async function () {
			let collection = await createDataObject('collection');
			let item = createUnsavedDataObject('item', {
				itemType: 'journalArticle',
				title: 'Existing Title',
				collections: [collection.id],
				tags: ['keep']
			});
			item.setField('DOI', doi);
			await item.saveTx();

			let provider = makeSearchTranslatorProvider({
				itemType: 'journalArticle',
				DOI: doi,
				title: 'Translated Title',
				publicationTitle: 'Translated Journal',
				creators: [{ firstName: 'Jane', lastName: 'Doe', creatorType: 'author' }],
				tags: ['automatic'],
				collections: ['ignored'],
				relations: { dc: ['ignored'] },
				seeAlso: ['ignored']
			});

			let result = await Zotero.ItemMetadataUpdater.updateItemFromDOI(
				item,
				{ translatorProvider: provider }
			);

			assert.isTrue(result.success);
			assert.sameMembers(result.updatedFields, ['publicationTitle', 'libraryCatalog', 'creators']);
			assert.sameMembers(result.skippedFields, ['DOI', 'title']);
			assert.equal(item.getField('title'), 'Existing Title');
			assert.equal(item.getField('publicationTitle'), 'Translated Journal');
			assert.equal(item.getField('libraryCatalog'), 'Dummy Translator');
			assert.equal(item.getCreatorsJSON()[0].lastName, 'Doe');
			assert.isTrue(item.hasTag('keep'));
			assert.sameMembers(item.getCollections(), [collection.id]);
		});

		it("should return an error for an item without a DOI", async function () {
			let item = await createDataObject('item', { itemType: 'journalArticle' });

			let result = await Zotero.ItemMetadataUpdater.updateItemFromDOI(item);

			assert.isFalse(result.success);
			assert.match(result.error, /DOI/);
			assert.isEmpty(result.updatedFields);
		});
	});
});
