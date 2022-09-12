/* global setHTTPResponse:false, sinon: false, Zotero_Import_Mendeley: false, HttpServer: false */

describe('Zotero_Import_Mendeley', function () {
	var server, importer, httpd, httpdURL;

	before(async () => {
		Components.utils.import('chrome://zotero/content/import/mendeley/mendeleyImport.js');
		importer = new Zotero_Import_Mendeley();
		importer.mendeleyCode = 'CODE';

		// real http server is used to deliver an empty pdf so that annotations can be processed during import
		Components.utils.import("resource://zotero-unit/httpd.js");
		const port = 16213;
		httpd = new HttpServer();
		httpdURL = `http://127.0.0.1:${port}`;
		httpd.start(port);
		httpd.registerFile(
			'/file1.pdf',
			Zotero.File.pathToFile(OS.Path.join(getTestDataDirectory().path, 'empty.pdf'))
		);
	});

	after(async () => {
		await new Zotero.Promise(resolve => httpd.stop(resolve));
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
			json: JSON.parse(
				await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/annotations.json')
			)
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
			json: JSON.parse(
				await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/groups.json')
			)
		});

		setHTTPResponse(server, 'https://api.mendeley.com/', {
			method: 'GET',
			url: `files/19fb5e5b-1a39-4851-b513-d48441a670e1?`,
			status: 200, // ideally would be 303 but mock http doesn't like it
			headers: {
				Location: `${httpdURL}/file1.pdf`
			},
			text: ''
		});
		
		setHTTPResponse(server, 'https://api.mendeley.com/', {
			method: 'GET',
			url: `annotations?group_id=ec66aee6-455c-300c-b601-ba4d6a34a95e&limit=200`,
			status: 200,
			json: JSON.parse(
				await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/group-annotations.json')
			)
		});
		
		setHTTPResponse(server, 'https://api.mendeley.com/', {
			method: 'GET',
			url: `annotations?group_id=cc697d28-054c-37d2-afa3-74fa4cf8a727&limit=200`,
			status: 200,
			json: []
		});

		setHTTPResponse(server, 'https://api.mendeley.com/', {
			method: 'GET',
			url: `annotations?group_id=6a15e9d6-c7e6-3716-8834-7a67d6f5f91f&limit=200`,
			status: 200,
			json: []
		});
	});

	afterEach(() => {
		Zotero.HTTP.mock = null;
	});

	describe('#import', () => {
		it("should import collections, items, attachments & annotations", async () => {
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

			const withpdf = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', 'c54b0c6f-c4ce-4706-8742-bc7d032df862'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			const pdf = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:fileHash', 'cc22c6611277df346ff8dc7386ba3880b2bafa15'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			assert.equal(journal.getField('title'), 'Foo Bar');
			assert.equal(journal.itemTypeID, Zotero.ItemTypes.getID('journalArticle'));
			assert.equal(report.getField('title'), 'Sample Report');
			assert.equal(report.itemTypeID, Zotero.ItemTypes.getID('report'));
			assert.equal(withpdf.getField('title'), 'Item with PDF');
			assert.equal(withpdf.itemTypeID, Zotero.ItemTypes.getID('journalArticle'));
			
			// creators
			const creators = journal.getCreators();
			assert.lengthOf(creators, 2);
			assert.sameMembers(creators.map(c => c.firstName), ["Tom", "Lorem"]);
			assert.sameMembers(creators.map(c => c.lastName), ["Najdek", "Ipsum"]);

			// identifiers
			assert.equal(journal.getField('DOI'), '10.1111');
			assert.sameMembers(journal.getField('extra').split('\n'), ['PMID: 11111111', 'arXiv: 1111.2222']);

			// attachment & annotations
			assert.lengthOf(withpdf.getAttachments(), 1);
			assert.equal(pdf.parentID, withpdf.id);

			const yellowHighlight = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:annotationUUID', '339d0202-d99f-48a2-aa0d-9b0c5631af26'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();
			const redHighlight = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:annotationUUID', '885615a7-170e-4613-af80-0227ea76ae55'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();
			const blueNote = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:annotationUUID', 'bfbdb972-171d-4b21-8ae6-f156ac9a2b41'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();
			const greenNote = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:annotationUUID', '734743eb-2be3-49ef-b1ac-3f1e84fea2f2'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();
			const orangeNote = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:annotationUUID', 'c436932f-b14b-4580-a649-4587a5cdc2c3'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();
			const purpleGroupNote = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:annotationUUID', '656fd591-451a-4bb0-8d5f-30c36c135fc9'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			assert.equal(blueNote.annotationComment, 'blue note 2');
			assert.equal(greenNote.annotationComment, 'green note');
			assert.equal(orangeNote.annotationComment, 'orange note1');
			assert.equal(purpleGroupNote.annotationComment, 'note by me');
			
			// map yellow	rgb(255, 245, 173) -> #ffd400'
			assert.equal(yellowHighlight.annotationColor, '#ffd400');
			// map red:		rgb(255, 181, 182) -> #ff6666
			assert.equal(redHighlight.annotationColor, '#ff6666');
			// map blue:	rgb(186, 226, 255) -> '#2ea8e5'
			assert.equal(blueNote.annotationColor, '#2ea8e5');
			// map purple:	rgb(211, 194, 255) -> '#a28ae5'
			assert.equal(purpleGroupNote.annotationColor, '#a28ae5');
			// map green:	rgb(220, 255, 176) -> #5fb236
			assert.equal(greenNote.annotationColor, '#5fb236');
			// preserve other colors rgb(255, 222, 180) stays as #ffdeb4
			assert.equal(orangeNote.annotationColor, '#ffdeb4');

			// group annotations by others and mismatched annotations are not included
			const annotations = await pdf.getAnnotations();
			assert.equal(annotations.length, 6);
			assert.isFalse(annotations.some(a => a.annotationComment === 'note by other'));
			assert.isFalse(annotations.some(a => a.annotationComment === 'mismatched note'));

			// collection
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
