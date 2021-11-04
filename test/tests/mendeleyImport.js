/* global setHTTPResponse:false, sinon: false, Zotero_Import_Mendeley: false */

describe('Zotero_Import_Mendeley', function () {
	var server, importer;

	before(async () => {
		Components.utils.import('chrome://zotero/content/import/mendeley/mendeleyImport.js');
		importer = new Zotero_Import_Mendeley();
		importer.mendeleyCode = 'CODE';
	});

	beforeEach(async () => {
		Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		server = sinon.fakeServer.create();
		server.autoRespond = true;
		setHTTPResponse(server, 'https://www.zotero.org/', {
			method: 'POST',
			url: `utils/mendeley/oauth`,
			status: 200,
			headers: {},
			json: {
				access_token: 'ACCESS_TOKEN', // eslint-disable-line camelcase
				token_type: 'bearer', // eslint-disable-line camelcase
				expires_in: 3600, // eslint-disable-line camelcase
				refresh_token: 'REFRESH_TOKEN', // eslint-disable-line camelcase
				msso: null,
				scope: 'all'
			}
		});

		setHTTPResponse(server, 'https://api.mendeley.com/', {
			method: 'GET',
			url: `folders?limit=500`,
			status: 200,
			headers: {},
			json: JSON.parse(
				await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/folders-simple.json')
			)
		});

		setHTTPResponse(server, 'https://api.mendeley.com/', {
			method: 'GET',
			url: `annotations?limit=200`,
			status: 200,
			headers: {},
			json: []
		});

		setHTTPResponse(server, 'https://api.mendeley.com/', {
			method: 'GET',
			url: `documents?view=all&limit=500`,
			status: 200,
			headers: {},
			json: JSON.parse(
				await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/items-simple.json')
			)
		});

		setHTTPResponse(server, 'https://api.mendeley.com/', {
			method: 'GET',
			url: `profiles/v2/me?`,
			status: 200,
			headers: {},
			json: JSON.parse(
				await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/user.json')
			)
		});

		setHTTPResponse(server, 'https://api.mendeley.com/', {
			method: 'GET',
			url: `groups/v2?type=all&limit=500`,
			status: 200,
			headers: {},
			json: []
		});
	});

	afterEach(() => {
		Zotero.HTTP.mock = null;
	});

	describe('#import', () => {
		it("should import items & collections", async () => {
			
			await importer.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: null,
				linkFiles: false,
			});

			const journal = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', '7fea3cb3-f97d-3f16-8fad-f59caaa71688'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			const report = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', '07a74c26-28d1-4d9f-a60d-3f3bc5ef76ef'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			assert.equal(journal.getField('title'), 'Foo Bar');
			assert.equal(journal.itemTypeID, Zotero.ItemTypes.getID('journalArticle'));
			assert.equal(report.getField('title'), 'Sample Report');
			assert.equal(report.itemTypeID, Zotero.ItemTypes.getID('report'));

			// test identifiers
			assert.equal(journal.getField('DOI'), '10.1111');
			assert.include(journal.getField('extra'), 'PMID: 11111111');
			assert.include(journal.getField('extra'), 'arXiv: 1111.2222');
			
			const parentCollection = await Zotero.Collections.getAsync(
				journal.getCollections().pop()
			);

			assert.equal(parentCollection.name, 'folder1');
		});

		it("should update previously imported item", async () => {
			const importer = new Zotero_Import_Mendeley();
			importer.mendeleyCode = 'CODE';
			await importer.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: null,
				linkFiles: false,
			});

			const report = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', '07a74c26-28d1-4d9f-a60d-3f3bc5ef76ef'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			assert.equal(report.getField('title'), 'Sample Report');
			assert.equal(report.getField('year'), '2002');
			assert.equal(report.itemTypeID, Zotero.ItemTypes.getID('report'));
			assert.lengthOf(report.getTags(), 0);

			setHTTPResponse(server, 'https://api.mendeley.com/', {
				method: 'GET',
				url: `documents?view=all&limit=500`,
				status: 200,
				headers: {},
				json: JSON.parse(
					await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/items-updated.json')
				)
			});

			await importer.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: null,
				linkFiles: false,
			});
			
			assert.equal(report.getField('title'), 'Report updated to Journal Article');
			assert.equal(report.itemTypeID, Zotero.ItemTypes.getID('journalArticle'));
			assert.equal(report.getField('year'), '2002');
			assert.sameMembers(report.getTags().map(t => t.tag), ['\u2605']);
		});
	});
});
