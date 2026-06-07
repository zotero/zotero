/* global assert, buildDummyTranslator, createDataObject, createUnsavedDataObject, describe, getTestDataUrl, it, sinon */

function makeSearchTranslatorProvider(jsonItems) {
	let json = JSON.stringify(jsonItems).replace(/['\\]/g, "\\$&");
	let translator = buildDummyTranslator(
		'search',
		"function detectSearch(search) { return 'journalArticle'; }\n"
			+ "function doSearch(search) {\n"
			+ "	var data = JSON.parse('" + json + "');\n"
			+ "	var items;\n"
			+ "	if (Array.isArray(data)) {\n"
			+ "		items = data;\n"
			+ "	}\n"
			+ "	else if (data && (data.itemType || data.DOI || data.title || data.creators)) {\n"
			+ "		items = [data];\n"
			+ "	}\n"
			+ "	else {\n"
			+ "		items = data[search.DOI] || [];\n"
			+ "	}\n"
			+ "	if (!Array.isArray(items)) {\n"
			+ "		items = [items];\n"
			+ "	}\n"
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

		it("should clean DOI URL input before searching", async function () {
			let provider = makeSearchTranslatorProvider({
				[doi]: {
					itemType: 'journalArticle',
					DOI: doi,
					title: 'Translated Title'
				}
			});

			let itemJSON = await Zotero.ItemMetadataUpdater.lookupItemJSONByDOI(
				' https://doi.org/' + doi + ' ',
				{ translatorProvider: provider }
			);

			assert.equal(itemJSON.title, 'Translated Title');
			assert.equal(itemJSON.DOI, doi);
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
				abstractNote: 'Full translated abstract.\nSecond sentence.',
				accessDate: '2026-06-05T00:00:00Z',
				creators: [{ firstName: 'Translated', lastName: 'Author', creatorType: 'author' }],
				tags: ['automatic'],
				collections: ['ignored'],
				relations: { dc: ['ignored'] },
				seeAlso: ['ignored']
			});

			assert.isNull(diff.itemType);
			assert.sameMembers(diff.fields.map(change => change.field), ['publicationTitle', 'abstractNote']);
			assert.notInclude(diff.fields.map(change => change.field), 'accessDate');
			assert.equal(
				diff.fields.find(change => change.field == 'publicationTitle').newValue,
				'Translated Journal'
			);
			assert.equal(
				diff.fields.find(change => change.field == 'abstractNote').newValue,
				'Full translated abstract.\nSecond sentence.'
			);
			assert.sameMembers(diff.skipped.map(change => change.field), ['DOI', 'title', 'creators']);
			assert.isNull(diff.creators);
		});

		it("should map abstract metadata to the Zotero abstractNote field", function () {
			let item = createUnsavedDataObject('item', {
				itemType: 'journalArticle'
			});

			let diff = Zotero.ItemMetadataUpdater.getFieldDiff(item, {
				itemType: 'journalArticle',
				abstract: 'Full abstract text from metadata.'
			});

			assert.sameMembers(diff.fields.map(change => change.field), ['abstractNote']);
			assert.equal(diff.fields[0].newValue, 'Full abstract text from metadata.');
		});

		it("should include non-empty fields and creators when overwriting", function () {
			let item = createUnsavedDataObject('item', {
				itemType: 'journalArticle',
				title: 'Existing Title',
				creators: [{ firstName: 'Existing', lastName: 'Author', creatorType: 'author' }]
			});
			item.setField('DOI', doi);
			item.setField('abstractNote', 'Existing abstract.');

			let diff = Zotero.ItemMetadataUpdater.getFieldDiff(item, {
				itemType: 'book',
				DOI: doi,
				title: 'Translated Title',
				abstractNote: 'Translated abstract.',
				publicationTitle: 'Translated Journal',
				accessDate: '2026-06-05T00:00:00Z',
				creators: [{ firstName: 'Translated', lastName: 'Author', creatorType: 'author' }],
				tags: ['automatic'],
				collections: ['ignored'],
				relations: { dc: ['ignored'] }
			}, { overwrite: true });

			assert.equal(diff.itemType.currentValue, 'journalArticle');
			assert.equal(diff.itemType.newValue, 'book');
			assert.sameMembers(diff.fields.map(change => change.field), ['title', 'abstractNote', 'publicationTitle']);
			assert.notInclude(diff.fields.map(change => change.field), 'accessDate');
			assert.sameMembers(diff.skipped.map(change => change.field), ['DOI']);
			assert.equal(diff.creators.newValue[0].firstName, 'Translated');
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
				abstractNote: 'Full translated abstract text.',
				accessDate: '2026-06-05T00:00:00Z',
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
			assert.sameMembers(result.updatedFields, ['publicationTitle', 'abstractNote', 'libraryCatalog', 'creators']);
			assert.sameMembers(result.skippedFields, ['DOI', 'title']);
			assert.notInclude(result.updatedFields, 'accessDate');
			assert.equal(item.getField('title'), 'Existing Title');
			assert.equal(item.getField('publicationTitle'), 'Translated Journal');
			assert.equal(item.getField('abstractNote'), 'Full translated abstract text.');
			assert.equal(item.getField('libraryCatalog'), 'Dummy Translator');
			assert.equal(item.getCreatorsJSON()[0].lastName, 'Doe');
			assert.isTrue(item.hasTag('keep'));
			assert.sameMembers(item.getCollections(), [collection.id]);
		});

		it("should not overwrite an existing abstract note", async function () {
			let item = createUnsavedDataObject('item', {
				itemType: 'journalArticle'
			});
			item.setField('DOI', doi);
			item.setField('abstractNote', 'Keep existing abstract.');
			await item.saveTx();

			let provider = makeSearchTranslatorProvider({
				itemType: 'journalArticle',
				DOI: doi,
				title: 'Translated Title',
				abstractNote: 'Translated abstract should not overwrite this field.'
			});

			let result = await Zotero.ItemMetadataUpdater.updateItemFromDOI(
				item,
				{ translatorProvider: provider }
			);

			assert.isTrue(result.success, result.error);
			assert.notInclude(result.updatedFields, 'abstractNote');
			assert.include(result.skippedFields, 'abstractNote');
			assert.equal(item.getField('abstractNote'), 'Keep existing abstract.');
		});

		it("should overwrite existing metadata when requested", async function () {
			let item = createUnsavedDataObject('item', {
				itemType: 'journalArticle',
				title: 'Existing Title',
				creators: [{ firstName: 'Existing', lastName: 'Author', creatorType: 'author' }]
			});
			item.setField('DOI', doi);
			item.setField('abstractNote', 'Existing abstract.');
			item.setField('accessDate', '2020-01-01T00:00:00Z');
			await item.saveTx();

			let provider = makeSearchTranslatorProvider({
				itemType: 'journalArticle',
				DOI: doi,
				title: 'Translated Title',
				publicationTitle: 'Translated Journal',
				abstractNote: 'Translated abstract.',
				accessDate: '2026-06-05T00:00:00Z',
				creators: [{ firstName: 'Translated', lastName: 'Author', creatorType: 'author' }]
			});

			let result = await Zotero.ItemMetadataUpdater.updateItemFromDOI(
				item,
				{
					translatorProvider: provider,
					overwrite: true
				}
			);

			assert.isTrue(result.success);
			assert.sameMembers(result.updatedFields, ['title', 'publicationTitle', 'abstractNote', 'libraryCatalog', 'creators']);
			assert.sameMembers(result.skippedFields, ['DOI']);
			assert.notInclude(result.updatedFields, 'accessDate');
			assert.equal(item.getField('title'), 'Translated Title');
			assert.equal(item.getField('publicationTitle'), 'Translated Journal');
			assert.equal(item.getField('abstractNote'), 'Translated abstract.');
			assert.equal(item.getField('accessDate'), '2020-01-01 00:00:00');
			assert.equal(item.getCreatorsJSON()[0].firstName, 'Translated');
		});

		it("should change a journal article to a conference paper when overwriting", async function () {
			let item = await createDataObject('item', { itemType: 'journalArticle' });
			item.setField('DOI', '10.1109/CVPR.2016.90');
			await item.saveTx();

			let provider = makeSearchTranslatorProvider({
				itemType: 'conferencePaper',
				DOI: '10.1109/CVPR.2016.90',
				title: 'Deep Residual Learning for Image Recognition',
				proceedingsTitle: '2016 IEEE Conference on Computer Vision and Pattern Recognition (CVPR)',
				conferenceName: '2016 IEEE Conference on Computer Vision and Pattern Recognition',
				publisher: 'IEEE',
				place: 'Las Vegas, NV, USA',
				date: '2016-06',
				pages: '770-778',
				creators: [
					{ firstName: 'Kaiming', lastName: 'He', creatorType: 'author' },
					{ firstName: 'Xiangyu', lastName: 'Zhang', creatorType: 'author' }
				]
			});

			let result = await Zotero.ItemMetadataUpdater.updateItemFromDOI(
				item,
				{
					translatorProvider: provider,
					overwrite: true
				}
			);

			assert.isTrue(result.success);
			assert.include(result.updatedFields, 'itemType');
			assert.includeMembers(result.updatedFields, [
				'title',
				'proceedingsTitle',
				'conferenceName',
				'publisher',
				'place',
				'date',
				'pages',
				'creators'
			]);
			assert.equal(item.itemType, 'conferencePaper');
			assert.equal(
				item.getField('proceedingsTitle'),
				'2016 IEEE Conference on Computer Vision and Pattern Recognition (CVPR)'
			);
			assert.equal(item.getField('conferenceName'), '2016 IEEE Conference on Computer Vision and Pattern Recognition');
			assert.equal(item.getField('publisher'), 'IEEE');
			assert.equal(item.getField('pages'), '770-778');
		});

		it("should keep the existing item type when filling empty fields", async function () {
			let item = await createDataObject('item', { itemType: 'journalArticle' });
			item.setField('DOI', '10.1109/CVPR.2016.90');
			await item.saveTx();

			let provider = makeSearchTranslatorProvider({
				itemType: 'conferencePaper',
				DOI: '10.1109/CVPR.2016.90',
				title: 'Deep Residual Learning for Image Recognition',
				proceedingsTitle: '2016 IEEE Conference on Computer Vision and Pattern Recognition (CVPR)'
			});

			let result = await Zotero.ItemMetadataUpdater.updateItemFromDOI(
				item,
				{ translatorProvider: provider }
			);

			assert.isTrue(result.success);
			assert.notInclude(result.updatedFields, 'itemType');
			assert.equal(item.itemType, 'journalArticle');
		});

		it("should replace a truncated search abstract with a longer web abstract", async function () {
			let item = createUnsavedDataObject('item', {
				itemType: 'journalArticle'
			});
			item.setField('DOI', doi);
			await item.saveTx();

			let provider = makeSearchTranslatorProvider({
				itemType: 'journalArticle',
				DOI: doi,
				title: 'Translated Title',
				abstractNote: '...truncated abstract...',
				url: getTestDataUrl('test.html')
			});
			let webItemLookup = async (url) => {
				assert.equal(url, getTestDataUrl('test.html'));
				return {
					itemType: 'journalArticle',
					abstractNote: 'Full abstract text from the publisher page.'
				};
			};

			let result = await Zotero.ItemMetadataUpdater.updateItemFromDOI(
				item,
				{
					translatorProvider: provider,
					webItemLookup
				}
			);

			assert.isTrue(result.success);
			assert.include(result.updatedFields, 'abstractNote');
			assert.equal(item.getField('abstractNote'), 'Full abstract text from the publisher page.');
		});

		it("should overwrite an existing truncated abstract with a longer web abstract", async function () {
			let item = createUnsavedDataObject('item', {
				itemType: 'journalArticle'
			});
			item.setField('DOI', doi);
			item.setField('abstractNote', '...existing truncated abstract...');
			await item.saveTx();

			let provider = makeSearchTranslatorProvider({
				itemType: 'journalArticle',
				DOI: doi,
				title: 'Translated Title',
				abstractNote: '...truncated abstract from DOI search...',
				url: getTestDataUrl('test.html')
			});
			let webItemLookup = async (url) => {
				assert.equal(url, getTestDataUrl('test.html'));
				return {
					itemType: 'journalArticle',
					abstractNote: 'Full abstract text from the publisher page with all final sentences included.'
				};
			};

			let result = await Zotero.ItemMetadataUpdater.updateItemFromDOI(
				item,
				{
					translatorProvider: provider,
					webItemLookup,
					overwrite: true
				}
			);

			assert.isTrue(result.success, result.error);
			assert.include(result.updatedFields, 'abstractNote');
			assert.equal(
				item.getField('abstractNote'),
				'Full abstract text from the publisher page with all final sentences included.'
			);
		});

		it("should resolve an Elsevier Linking Hub URL to ScienceDirect for the abstract", async function () {
			let item = createUnsavedDataObject('item', {
				itemType: 'journalArticle'
			});
			item.setField('DOI', '10.1016/j.ipm.2024.103996');
			await item.saveTx();

			let provider = makeSearchTranslatorProvider({
				itemType: 'journalArticle',
				DOI: '10.1016/j.ipm.2024.103996',
				title: 'Basis is also explanation',
				url: 'https://linkinghub.elsevier.com/retrieve/pii/S0306457324003558'
			});
			let requestedURLs = [];
			let webItemLookup = async (url) => {
				requestedURLs.push(url);
				if (url == 'https://www.sciencedirect.com/science/article/pii/S0306457324003558') {
					return {
						itemType: 'journalArticle',
						abstractNote: 'Full abstract text from the ScienceDirect article page.'
					};
				}
				return null;
			};

			let result = await Zotero.ItemMetadataUpdater.updateItemFromDOI(
				item,
				{
					translatorProvider: provider,
					webItemLookup
				}
			);

			assert.isTrue(result.success);
			assert.equal(
				requestedURLs[0],
				'https://www.sciencedirect.com/science/article/pii/S0306457324003558'
			);
			assert.include(result.updatedFields, 'abstractNote');
			assert.equal(
				item.getField('abstractNote'),
				'Full abstract text from the ScienceDirect article page.'
			);
		});

		it("should return an error for an item without a DOI", async function () {
			let item = await createDataObject('item', { itemType: 'journalArticle' });

			let result = await Zotero.ItemMetadataUpdater.updateItemFromDOI(item);

			assert.isFalse(result.success);
			assert.match(result.error, /DOI/);
			assert.isEmpty(result.updatedFields);
		});
	});

	describe("#updateItemsFromDOI()", function () {
		it("should classify mixed batch results and preserve existing creators", async function () {
			let updateDOI = '10.1111/update';
			let unchangedDOI = '10.1111/unchanged';
			let missingDOI = '10.1111/missing';
			let provider = makeSearchTranslatorProvider({
				[updateDOI]: {
					itemType: 'journalArticle',
					DOI: updateDOI,
					title: 'Translated Title',
					publicationTitle: 'Translated Journal',
					abstractNote: 'Full translated abstract text.',
					creators: [{ firstName: 'Jane', lastName: 'Doe', creatorType: 'author' }]
				},
				[unchangedDOI]: {
					itemType: 'journalArticle',
					DOI: unchangedDOI,
					title: 'Translated Existing Title',
					publicationTitle: 'Translated Existing Journal',
					abstractNote: 'Translated existing abstract.',
					creators: [{ firstName: 'Jane', lastName: 'Doe', creatorType: 'author' }]
				},
				[missingDOI]: []
			});

			let itemToUpdate = await createDataObject('item', { itemType: 'journalArticle' });
			itemToUpdate.setField('DOI', updateDOI);
			await itemToUpdate.saveTx();

			let unchangedItem = createUnsavedDataObject('item', {
				itemType: 'journalArticle',
				title: 'Keep Existing Title',
				creators: [{ firstName: 'Keep', lastName: 'Me', creatorType: 'author' }]
			});
			unchangedItem.setField('DOI', unchangedDOI);
			unchangedItem.setField('publicationTitle', 'Keep Existing Journal');
			unchangedItem.setField('abstractNote', 'Keep Existing Abstract');
			unchangedItem.setField('libraryCatalog', 'Dummy Translator');
			await unchangedItem.saveTx();

			let itemWithoutDOI = await createDataObject('item', { itemType: 'journalArticle' });
			let itemWithoutMetadata = await createDataObject('item', { itemType: 'journalArticle' });
			itemWithoutMetadata.setField('DOI', missingDOI);
			await itemWithoutMetadata.saveTx();
			let note = await createDataObject('item', { itemType: 'note' });
			let nonEditableItem = await createDataObject('item', { itemType: 'journalArticle' });
			nonEditableItem.setField('DOI', updateDOI);
			await nonEditableItem.saveTx();

			let originalIsEditable = Zotero.Items.isEditable;
			let isEditableStub = sinon.stub(Zotero.Items, 'isEditable')
				.callsFake(item => item != nonEditableItem && originalIsEditable.call(Zotero.Items, item));
			let progressEvents = [];
			let result;
			try {
				result = await Zotero.ItemMetadataUpdater.updateItemsFromDOI(
					[itemToUpdate, unchangedItem, itemWithoutDOI, itemWithoutMetadata, note, nonEditableItem],
					{
						translatorProvider: provider,
						onProgress: event => progressEvents.push(event)
					}
				);
			}
			finally {
				isEditableStub.restore();
			}

			assert.isTrue(result.success);
			assert.equal(result.total, 6);
			assert.equal(result.updated, 1);
			assert.equal(result.unchanged, 1);
			assert.equal(result.skipped, 3);
			assert.equal(result.failed, 1);
			assert.deepEqual(result.results.map(row => row.status), [
				'updated',
				'unchanged',
				'skipped',
				'failed',
				'skipped',
				'skipped'
			]);
			assert.equal(result.results[2].reason, 'noDOI');
			assert.match(result.results[3].error, /No metadata found/);
			assert.equal(result.results[4].reason, 'notRegular');
			assert.equal(result.results[5].reason, 'notEditable');
			assert.sameMembers(result.results[0].updatedFields, ['title', 'publicationTitle', 'abstractNote', 'libraryCatalog', 'creators']);
			assert.sameMembers(result.results[1].skippedFields, ['DOI', 'title', 'publicationTitle', 'abstractNote', 'libraryCatalog', 'creators']);
			assert.equal(unchangedItem.numCreators(), 1);
			assert.equal(unchangedItem.getCreatorsJSON()[0].lastName, 'Me');
			assert.equal(unchangedItem.getField('abstractNote'), 'Keep Existing Abstract');
			assert.deepEqual(progressEvents.map(event => event.status), [
				'processing',
				'updated',
				'processing',
				'unchanged',
				'processing',
				'skipped',
				'processing',
				'failed',
				'processing',
				'skipped',
				'processing',
				'skipped'
			]);
			assert.deepEqual(progressEvents.map(event => event.index), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
		});

		it("should stop before the next item when cancelled", async function () {
			let firstDOI = '10.1111/cancel-first';
			let secondDOI = '10.1111/cancel-second';
			let provider = makeSearchTranslatorProvider({
				[firstDOI]: {
					itemType: 'journalArticle',
					DOI: firstDOI,
					title: 'First Translated Title'
				},
				[secondDOI]: {
					itemType: 'journalArticle',
					DOI: secondDOI,
					title: 'Second Translated Title'
				}
			});

			let firstItem = await createDataObject('item', { itemType: 'journalArticle' });
			firstItem.setField('DOI', firstDOI);
			await firstItem.saveTx();
			let secondItem = await createDataObject('item', { itemType: 'journalArticle' });
			secondItem.setField('DOI', secondDOI);
			await secondItem.saveTx();

			let processed = 0;
			let progressEvents = [];
			let result = await Zotero.ItemMetadataUpdater.updateItemsFromDOI(
				[firstItem, secondItem],
				{
					translatorProvider: provider,
					onProgress: (event) => {
						progressEvents.push(event);
						if (event.result) {
							processed++;
						}
					},
					shouldCancel: () => processed > 0
				}
			);

			assert.isFalse(result.success);
			assert.isTrue(result.cancelled);
			assert.equal(result.total, 2);
			assert.equal(result.updated, 1);
			assert.lengthOf(result.results, 1);
			assert.deepEqual(progressEvents.map(event => event.status), ['processing', 'updated']);
			assert.equal(secondItem.getField('title'), '');
		});
	});
});
