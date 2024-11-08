/* global setHTTPResponse:false, sinon: false, Zotero_Import_Mendeley: false, HttpServer: false, createAnnotation: false */

describe('Zotero_Import_Mendeley', function () {
	var server, httpd, httpdURL, importers;

	const getImporter = () => {
		const importer = new Zotero_Import_Mendeley();
		importer.mendeleyAuth = { kind: 'direct', tokens: { accessToken: 'access_token', refreshToken: 'refresh_token' } };
		importer.skipNotebooks = true;
		importers.push(importer);
		return importer;
	};

	before(async () => {
		Components.utils.import('chrome://zotero/content/import/mendeley/mendeleyImport.js');

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
		importers = [];
		Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		server = sinon.fakeServer.create({
			unsafeHeadersEnabled: false
		});
		server.autoRespond = true;
		setHTTPResponse(server, 'https://api.mendeley.com/', {
			method: 'POST',
			url: `oauth/token`,
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

	afterEach(async () => {
		await Promise.all(
			importers
				.map(importer => ([
					Zotero.Items.erase(Array.from(new Set(importer.newItems)).map(i => i.id)),
					Zotero.Collections.erase(Array.from(new Set(importer.newCollections)).map(c => c.id))
				]))
				.reduce((prev, a) => ([...prev, ...a]), []) // .flat() in >= FF62
		);
		Zotero.HTTP.mock = null;
	});

	describe('#import', () => {
		it("should import collections, items, attachments & annotations", async () => {
			const importer = getImporter();
			await importer.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: null,
				linkFiles: false,
			});

			const journal = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', 'b5f57b1a-f083-486c-aec7-5d5edd366dd2'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			const report = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', '616ec6d1-8d23-4414-8b6e-7bb129677577'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			const withpdf = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', '3630a4bf-d97e-46c4-8611-61ec50f840c6'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			const pdf = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:fileHash', 'cc22c6611277df346ff8dc7386ba3880b2bafa15'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			const withTags = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', '4308d8ec-e8ea-43fb-9d38-4e6628f7c10a'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			
			assert.equal(journal.getRelations()['mendeleyDB:remoteDocumentUUID'], '7fea3cb3-f97d-3f16-8fad-f59caaa71688');
			assert.equal(journal.getField('title'), 'Foo Bar');
			assert.equal(journal.itemTypeID, Zotero.ItemTypes.getID('journalArticle'));
			assert.equal(report.getRelations()['mendeleyDB:remoteDocumentUUID'], '07a74c26-28d1-4d9f-a60d-3f3bc5ef76ef');
			assert.equal(report.getField('title'), 'Sample Report');
			assert.equal(report.itemTypeID, Zotero.ItemTypes.getID('report'));
			assert.equal(withpdf.getRelations()['mendeleyDB:remoteDocumentUUID'], 'c54b0c6f-c4ce-4706-8742-bc7d032df862');
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

			// tags
			assert.equal(withTags.getTags().length, 4);
			assert.sameMembers(
				withTags.getTags().filter(t => t.type === 1).map(t => t.tag),
				['keyword1', 'keyword2']
			);
			assert.sameMembers(
				withTags.getTags().filter(t => !t.type).map(t => t.tag),
				['tag1', 'tag2']
			);

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

		it("should update previously imported item, based on config", async () => {
			const importer1 = getImporter();
			await importer1.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: null,
				linkFiles: false,
			});

			const report = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', '616ec6d1-8d23-4414-8b6e-7bb129677577'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			
			assert.equal(report.getField('title'), 'Sample Report');
			assert.equal(report.getField('year'), '2002');
			assert.equal(report.getField('dateAdded'), '2021-11-04 11:53:10');
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

			const importer2 = getImporter();
			importer2.newItemsOnly = false;
			await importer2.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: null,
				linkFiles: false,
			});
			
			assert.equal(report.getField('title'), 'Report updated to Journal Article');
			assert.equal(report.itemTypeID, Zotero.ItemTypes.getID('journalArticle'));
			assert.equal(report.getField('year'), '2002');
			assert.sameMembers(report.getTags().map(t => t.tag), ['\u2605']);
			// dateAdded shouldn't change on an updated item. See #2881
			assert.equal(report.getField('dateAdded'), '2021-11-04 11:53:10');
		});

		it("shouldn't update previously imported item, based on config", async () => {
			const importer1 = getImporter();
			await importer1.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: null,
				linkFiles: false,
			});

			const report = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', '616ec6d1-8d23-4414-8b6e-7bb129677577'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			const noNewItemHere = await Zotero.Relations.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', '86e56a00-5ae5-4fe8-a977-9298a03b16d6');


			assert.equal(report.getField('title'), 'Sample Report');
			assert.equal(report.getField('year'), '2002');
			assert.equal(report.itemTypeID, Zotero.ItemTypes.getID('report'));
			assert.lengthOf(report.getTags(), 0);
			assert.lengthOf(noNewItemHere, 0);

			setHTTPResponse(server, 'https://api.mendeley.com/', {
				method: 'GET',
				url: `documents?view=all&limit=500`,
				status: 200,
				headers: {},
				json: JSON.parse(
					await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/items-updated.json')
				)
			});

			const importer2 = getImporter();
			importer2.newItemsOnly = true;
			await importer2.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: null,
				linkFiles: false,
			});

			assert.equal(report.getField('title'), 'Sample Report');
			assert.equal(report.itemTypeID, Zotero.ItemTypes.getID('report'));
			assert.equal(report.getField('year'), '2002');
			assert.lengthOf(report.getTags(), 0);

			const newItem = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', '86e56a00-5ae5-4fe8-a977-9298a03b16d6'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			assert.equal(newItem.getField('title'), 'Completely new item');
		});

		it("should correct IDs if available on subsequent import", async () => {
			setHTTPResponse(server, 'https://api.mendeley.com/', {
				method: 'GET',
				url: `documents?view=all&limit=500`,
				status: 200,
				headers: {},
				json: JSON.parse(
					await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/items-simple-no-desktop-id.json')
				)
			});
			const importer = getImporter();
			importer.newItemsOnly = true;
			await importer.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: null,
				linkFiles: false,
			});

			const report = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:remoteDocumentUUID', '07a74c26-28d1-4d9f-a60d-3f3bc5ef76ef'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			assert.equal(report.getField('title'), 'Sample Report');
			assert.equal(report.getRelations()['mendeleyDB:documentUUID'], '07a74c26-28d1-4d9f-a60d-3f3bc5ef76ef');

			setHTTPResponse(server, 'https://api.mendeley.com/', {
				method: 'GET',
				url: `documents?view=all&limit=500`,
				status: 200,
				headers: {},
				json: JSON.parse(
					await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/items-simple.json')
				)
			});

			await importer.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: null,
				linkFiles: false,
			});

			assert.equal(report.getField('title'), 'Sample Report');
			assert.equal(report.getRelations()['mendeleyDB:documentUUID'], '616ec6d1-8d23-4414-8b6e-7bb129677577');
		});

		it("should only correct IDs and not add new items if \"relinkOnly\" is configured", async () => {
			setHTTPResponse(server, 'https://api.mendeley.com/', {
				method: 'GET',
				url: `documents?view=all&limit=500`,
				status: 200,
				headers: {},
				json: JSON.parse(
					await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/items-simple-no-desktop-id.json')
				)
			});
			const importer1 = getImporter();
			await importer1.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: null,
				linkFiles: false,
			});

			const report = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:remoteDocumentUUID', '07a74c26-28d1-4d9f-a60d-3f3bc5ef76ef'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			assert.equal(report.getField('title'), 'Sample Report');
			assert.equal(report.getRelations()['mendeleyDB:documentUUID'], '07a74c26-28d1-4d9f-a60d-3f3bc5ef76ef');
			
			setHTTPResponse(server, 'https://api.mendeley.com/', {
				method: 'GET',
				url: `documents?view=all&limit=500`,
				status: 200,
				headers: {},
				json: JSON.parse(
					await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/items-updated.json')
				)
			});

			const importer2 = getImporter();
			importer2.relinkOnly = true;
			await importer2.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: null,
				linkFiles: false,
			});

			assert.equal(report.getField('title'), 'Sample Report');
			assert.equal(report.getRelations()['mendeleyDB:documentUUID'], '616ec6d1-8d23-4414-8b6e-7bb129677577');

			const noNewItemHere = await Zotero.Relations.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', '86e56a00-5ae5-4fe8-a977-9298a03b16d6');
			assert.lengthOf(noNewItemHere, 0);
		});

		it("should handle empty creators and tags", async () => {
			setHTTPResponse(server, 'https://api.mendeley.com/', {
				method: 'GET',
				url: `documents?view=all&limit=500`,
				status: 200,
				headers: {},
				json: JSON.parse(
					await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/items-bad-data.json')
				)
			});

			const importer = getImporter();
			await importer.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				collections: null,
				linkFiles: false,
			});
			
			const journalNoAuthors = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', '9c03fca4-ee5b-435e-abdd-fb6d7d11cd02'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();
			
			assert.equal(journalNoAuthors.getField('title'), 'This one has no authors');
			assert.equal(journalNoAuthors.getCreators().length, 0);

			const journalEmptyAuthors = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', 'fd86e48e-1931-4282-b72d-78c535b0398c'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			assert.equal(journalEmptyAuthors.getField('title'), 'This one has empty authors');
			assert.equal(journalEmptyAuthors.getCreators().length, 0);

			const journalEmptyTags = (await Zotero.Relations
				.getByPredicateAndObject('item', 'mendeleyDB:documentUUID', 'c7ec2737-044a-493b-9d94-d7f67be68765'))
				.filter(item => item.libraryID == Zotero.Libraries.userLibraryID && !item.deleted)
				.shift();

			assert.equal(journalEmptyTags.getField('title'), 'This one has empty tags and keywords');
			assert.equal(journalEmptyTags.getTags().length, 0);
		});

		it('should translate a notebook content into Zotero note content', async () => {
			let item = await createDataObject('item');
			item.itemType = 'journalArticle';
			item.title = 'Journal Article';
			await item.saveTx();
			
			let attachment = await importFileAttachment('test.pdf', { parentID: item.id });
			await attachment.saveTx();

			var annotation = await createAnnotation('highlight', attachment);
			annotation.annotationText = 'Highlight text';
			annotation.annotationComment = 'Highlight comment';
			annotation.annotationPageLabel = '57';
			annotation.addRelation('mendeleyDB:annotationUUID', '84f12446-3b49-4052-bbdc-832d28e1e072');
			await annotation.saveTx();

			let mendeleyNotebook = JSON.parse(
				await Zotero.File.getContentsFromURLAsync('resource://zotero-unit-tests/data/mendeleyMock/notebook.json')
			);
			const importer = getImporter();
			const noteContent = await importer._translateNotebookToNoteContent(Zotero.Libraries.userLibraryID, mendeleyNotebook);

			assert.match(
				noteContent,
				/^<h1>TEST<\/h1>\n<p><span class="highlight" data-annotation="((?:(?:%[0-9A-F]{2}|[^<>'" %])+))">“Highlight text”<\/span> <span class="citation" data-citation="((?:(?:%[0-9A-F]{2}|[^<>'" %])+))">\(<span class="citation-item">, p. 57<\/span>\)<\/span> Highlight comment<\/p>\n<p>Lorem Ipsum<\/p>$/i
			);
 
			await annotation.eraseTx();
			await attachment.eraseTx();
			await item.eraseTx();
		});
	});
});
