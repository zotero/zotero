"use strict";

describe("Local API Server", function () {
	let apiRoot;
	
	let collection;
	let subcollection;
	let collectionItem1;
	let collectionItem2;
	let subcollectionItem;
	let subcollectionAttachment;
	let allItems;
	
	function apiGet(endpoint, options = {}) {
		return Zotero.HTTP.request('GET', apiRoot + endpoint, {
			headers: {
				'Zotero-Allowed-Request': '1'
			},
			responseType: 'json',
			...options
		});
	}

	before(async function () {
		Zotero.Prefs.set('httpServer.enabled', true);
		apiRoot = 'http://127.0.0.1:' + Zotero.Prefs.get('httpServer.port') + '/api';

		await resetDB({
			thisArg: this
		});

		collection = await createDataObject('collection', { setTitle: true });
		subcollection = await createDataObject('collection', { setTitle: true, parentID: collection.id });
		collectionItem1 = await createDataObject('item', { setTitle: true, collections: [collection.id], itemType: 'bookSection' });
		collectionItem1.setCreators([{ firstName: 'A', lastName: 'Person', creatorType: 'author' }]);
		collectionItem1.saveTx();
		collectionItem2 = await createDataObject('item', { setTitle: true, collections: [collection.id], tags: ['some tag'] });
		collectionItem2.setCreators([{ firstName: 'A', lastName: 'Zerson', creatorType: 'author' }]);
		collectionItem2.saveTx();
		subcollectionItem = await createDataObject('item', { setTitle: true, collections: [subcollection.id] });
		subcollectionAttachment = await importPDFAttachment(subcollectionItem);
		allItems = [collectionItem1, collectionItem2, subcollectionItem, subcollectionAttachment];
	});

	describe("/", function () {
		it("should return a Zotero-API-Version response header", async function () {
			let xhr = await Zotero.HTTP.request('GET', apiRoot + '/', {
				headers: {
					'Zotero-Allowed-Request': '1'
				}
			});
			assert.equal(xhr.getResponseHeader('Zotero-API-Version'), ZOTERO_CONFIG.API_VERSION);
		});

		it("should allow an old Zotero-API-Version request header", async function () {
			let xhr = await Zotero.HTTP.request('GET', apiRoot + '/', {
				headers: {
					'Zotero-Allowed-Request': '1',
					'Zotero-API-Version': '2',
				}
			});
			assert.isNotEmpty(xhr.getResponseHeader('Zotero-API-Version'));
		});
	});
	
	describe("<userOrGroupPrefix>/collections", function () {
		it("should return all collections", async function () {
			let { response } = await apiGet('/users/0/collections');
			assert.isArray(response);
			assert.lengthOf(response, 2);
			
			let col = response.find(c => c.key == collection.key);
			let subcol = response.find(c => c.key == subcollection.key);
			
			assert.equal(col.data.name, collection.name);
			assert.equal(col.meta.numCollections, 1);
			assert.equal(col.meta.numItems, 2);

			assert.equal(subcol.data.name, subcollection.name);
			assert.equal(subcol.meta.numCollections, 0);
			assert.equal(subcol.meta.numItems, 1);
		});
		
		describe("/top", function () {
			it("should return top-level collections", async function () {
				let { response } = await apiGet('/users/0/collections/top');
				assert.isArray(response);
				assert.lengthOf(response, 1);

				let col = response.find(c => c.key == collection.key);
				assert.ok(col);
			});
		});
		
		describe("/<key>", function () {
			it("should return a collection with parent information", async function () {
				let { response } = await apiGet(`/users/0/collections/${subcollection.key}`);
				assert.isNotArray(response);
				assert.equal(response.data.name, subcollection.name);
				assert.equal(response.data.parentCollection, collection.key);
				assert.include(response.links.up.href, collection.key);
			});
		});
	});

	describe("<userOrGroupPrefix>/items", function () {
		it("should return all items", async function () {
			let { response } = await apiGet('/users/0/items');
			assert.isArray(response);
			assert.lengthOf(response, 4);
		});

		describe("/top", function () {
			it("should return top-level items", async function () {
				let { response } = await apiGet('/users/0/items/top');
				assert.isArray(response);
				assert.sameMembers(response.map(item => item.key), [collectionItem1.key, collectionItem2.key, subcollectionItem.key]);
			});
		});

		describe("/:itemID/children", function () {
			it("should return the children and not return the parent", async function () {
				let { response } = await apiGet(`/users/0/items/${subcollectionItem.key}/children`);
				assert.lengthOf(response, 1);
			});
		});

		describe("Child attachment items", function () {
			it("should have 'up' and 'enclosure' links", async function () {
				let { response } = await apiGet(`/users/0/items/${subcollectionAttachment.key}`);
				assert.isTrue(response.links.up.href.includes('/api/'));
				assert.isTrue(response.links.enclosure.href.startsWith('file:'));
			});

			it("should return file URL from /file/view/url", async function () {
				let { response } = await apiGet(`/users/0/items/${subcollectionAttachment.key}/file/view/url`, { responseType: 'text' });
				assert.isTrue(response.startsWith('file:'));
			});

			// followRedirects: false not working?
			it.skip("should redirect to file URL from /file/view", async function () {
				let request = await apiGet(`/users/0/items/${subcollectionAttachment.key}/file/view`,
					{ responseType: 'text', followRedirects: false });
				assert.isTrue(request.getResponseHeader('Location').startsWith('file:'));
			});
		});
		
		describe("?itemType", function () {
			it("should filter by item type", async function () {
				let { response } = await apiGet('/users/0/items?itemType=book');
				assert.lengthOf(response, 2);
				assert.isTrue(response.every(item => item.data.itemType == 'book'));
			});
			
			it("should be able to be negated", async function () {
				let { response } = await apiGet('/users/0/items?itemType=-book');
				assert.lengthOf(response, 2);
				assert.isTrue(response.every(item => item.data.itemType == 'bookSection' || item.data.itemType == 'attachment'));
			});

			it("should support OR combinations", async function () {
				let { response } = await apiGet('/users/0/items?itemType=book || bookSection');
				assert.lengthOf(response, 3);
			});
		});

		describe("?tag", function () {
			it("should filter by tag", async function () {
				let { response } = await apiGet('/users/0/items?tag=some tag');
				assert.lengthOf(response, 1);
			});

			it("should be able to be negated", async function () {
				let { response } = await apiGet('/users/0/items?tag=-some tag');
				assert.lengthOf(response, 3);
			});

			it("should be able to be combined with ?itemType", async function () {
				let { response } = await apiGet('/users/0/items?itemType=book&tag=some tag');
				assert.lengthOf(response, 1);
			});
		});

		describe("?format", function () {
			describe("=ris", function () {
				it("should output RIS", async function () {
					let { response } = await apiGet('/users/0/items?format=ris', { responseType: 'text' });
					assert.isTrue(response.startsWith('TY'));
				});
			});

			describe("=bib", function () {
				it("should output a bibliography", async function () {
					let { response } = await apiGet('/users/0/items?format=bib', { responseType: 'text' });
					assert.isTrue(response.startsWith('<div class="csl-bib-body"'));
				});
			});

			describe("=keys", function () {
				it("should output a plain-text list of keys", async function () {
					let { response } = await apiGet('/users/0/items?format=keys', { responseType: 'text' });
					for (let item of allItems) {
						assert.isTrue(response.includes(item.key));
					}
				});
			});

			describe("=versions", function () {
				it("should output a JSON object mapping keys to versions", async function () {
					let { response } = await apiGet('/users/0/items?format=versions');
					assert.propertyVal(response, collectionItem1.key, collectionItem1.version);
				});
			});
		});

		describe("?include", function () {
			it("should exclude data when empty", async function () {
				let { response } = await apiGet(`/users/0/items/${collectionItem1.key}?include=`);
				assert.notProperty(response, 'data');
			});

			describe("=citation", function () {
				it("should output citations", async function () {
					let { response } = await apiGet('/users/0/items?include=citation');
					assert.isTrue(response[0].citation.startsWith('<ol>'));
				});
				
				describe("&style", function () {
					it("should use the given citation style, even if not yet installed", async function () {
						let styleID = 'http://www.zotero.org/styles/cell';
						if (Zotero.Styles.get(styleID)) {
							await Zotero.Styles.get(styleID).remove();
						}

						let styleString = await Zotero.File.getContentsAsync(
							Zotero.File.pathToFile(OS.Path.join(getTestDataDirectory().path, 'cell.csl')));
						
						let stub = sinon.stub(Zotero.Styles, 'install');
						stub.callsFake(() => stub.wrappedMethod({ string: styleString }, 'cell.csl', true));

						let { response } = await apiGet(`/users/0/items/${collectionItem1.key}?include=citation&style=${encodeURIComponent(styleID)}`);
						assert.isTrue(stub.called);
						assert.equal(response.citation, '(Person)');
						
						stub.restore();
					});
				});
			});
		});
		
		describe("?since", function () {
			it("should filter the results", async function () {
				let { response: response1 } = await apiGet('/users/0/items?since=' + Zotero.Libraries.userLibrary.libraryVersion);
				assert.isEmpty(response1);

				let { response: response2 } = await apiGet('/users/0/items?since=-1');
				assert.lengthOf(response2, allItems.length);
			});
		});

		describe("?q", function () {
			it("should filter the results", async function () {
				let { response } = await apiGet('/users/0/items?q=Person');
				assert.lengthOf(response, 1);
			});
		});

		describe("?sort", function () {
			it("should sort by creator", async function () {
				let { response } = await apiGet('/users/0/items?sort=creator&direction=desc');
				assert.isBelow(response.findIndex(item => item.key == collectionItem2.key), response.findIndex(item => item.key == collectionItem1.key));
			});
		});
	});

	describe("<userOrGroupPrefix>/tags", function () {
		it("should return all tags in the library", async function () {
			let { response } = await apiGet('/users/0/tags');
			assert.lengthOf(response, 1);
			assert.equal(response[0].tag, 'some tag');
			assert.equal(response[0].meta.numItems, 1);
		});
	});
	
	describe("/groups/<groupID>", function () {
		it("should return 404 for unknown group", async function () {
			let { response } = await apiGet(
				'/groups/99999999999',
				{
					successCodes: [404],
					responseType: 'text'
				}
			);
			assert.equal(response, "Not found");
		});
	});
});
