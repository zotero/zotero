"use strict";

describe("Local API Server", function () {
	let apiRoot;
	let serverID;

	let collection;
	let subcollection;
	let collectionItem1;
	let collectionItem2;
	let collectionItem3;
	let subcollectionItem;
	let subcollectionAttachment;
	let subcollectionAnnotation;
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

	// API key used by write tests; set up in the Write requests before() hook.
	let writeAPIKey;

	function apiRequest(method, endpoint, options = {}) {
		let { body, headers, skipAPIKey, skipServerID, ...rest } = options;
		let requestHeaders = {
			'Zotero-Allowed-Request': '1',
			...(headers || {})
		};
		if (!skipAPIKey && writeAPIKey
				&& !requestHeaders['Zotero-API-Key']
				&& !endpoint.includes('key=')) {
			requestHeaders['Zotero-API-Key'] = writeAPIKey;
		}
		if (!skipServerID && serverID && !requestHeaders['Zotero-Server-ID']) {
			requestHeaders['Zotero-Server-ID'] = serverID;
		}
		let requestBody = body;
		if (body !== undefined && typeof body !== 'string'
				&& !(body instanceof ArrayBuffer)
				&& !ArrayBuffer.isView(body)) {
			requestBody = JSON.stringify(body);
			if (!requestHeaders['Content-Type']) {
				requestHeaders['Content-Type'] = 'application/json';
			}
		}
		return Zotero.HTTP.request(method, apiRoot + endpoint, {
			headers: requestHeaders,
			body: requestBody,
			responseType: 'json',
			...rest
		});
	}

	function apiPost(endpoint, options = {}) {
		return apiRequest('POST', endpoint, options);
	}

	function apiPut(endpoint, options = {}) {
		return apiRequest('PUT', endpoint, options);
	}

	function apiPatch(endpoint, options = {}) {
		return apiRequest('PATCH', endpoint, options);
	}

	function apiDelete(endpoint, options = {}) {
		return apiRequest('DELETE', endpoint, options);
	}

	// Counter so each test generates a fresh write token (server caches them for 12h)
	let writeTokenCounter = 0;
	function newWriteToken() {
		writeTokenCounter++;
		return ('writeToken' + writeTokenCounter + 'x'.repeat(32))
			.substring(0, 32);
	}

	function authorizePost(body, { responseType = 'json', successCodes } = {}) {
		let options = {
			headers: {
				'Zotero-Allowed-Request': '1',
				'Content-Type': 'application/json',
				'Zotero-Server-ID': serverID,
			},
			body: typeof body === 'string' ? body : JSON.stringify(body),
			responseType
		};
		if (successCodes) {
			options.successCodes = successCodes;
		}
		return Zotero.HTTP.request('POST', apiRoot + '/local/authorize', options);
	}

	// Stub the dialog and obtain a remembered API key directly via the endpoint
	async function setupRememberedAPIKey(appName = 'Test Suite') {
		let stub = sinon.stub(Zotero.Server.LocalAPI, '_promptForAuthorization')
			.resolves({ allow: true, remember: true });
		try {
			let { response } = await authorizePost({ appName });
			return response.key;
		}
		finally {
			stub.restore();
		}
	}

	before(async function () {
		apiRoot = 'http://127.0.0.1:' + Zotero.Server.port + '/api';

		// Pref pinned in runtests.sh so it survives resets
		serverID = Zotero.Prefs.get('httpServer.localAPI.serverID');

		await resetDB({
			thisArg: this
		});

		collection = await createDataObject('collection', { setTitle: true });
		subcollection = await createDataObject('collection', { setTitle: true, parentID: collection.id });
		collectionItem1 = await createDataObject('item', {
			setTitle: true,
			collections: [collection.id],
			itemType: 'bookSection',
			tags: ['another tag'],
		});
		collectionItem1.setCreators([{ firstName: 'A', lastName: 'Person', creatorType: 'author' }]);
		collectionItem1.saveTx();
		collectionItem2 = await createDataObject('item', {
			setTitle: true,
			collections: [collection.id],
			tags: ['some tag'],
		});
		collectionItem2.setCreators([{ firstName: 'A', lastName: 'Zerson', creatorType: 'author' }]);
		collectionItem2.saveTx();
		collectionItem3 = await createDataObject('item', {
			setTitle: true,
			collections: [collection.id],
			itemType: 'journalArticle',
			tags: ['another tag', 'a third tag'],
		});
		collectionItem3.setCreators([{ firstName: 'B', lastName: 'XYZ', creatorType: 'author' }]);
		collectionItem3.saveTx();
		subcollectionItem = await createDataObject('item', {
			setTitle: true,
			collections: [subcollection.id],
		});
		subcollectionAttachment = await importPDFAttachment(subcollectionItem);
		subcollectionAnnotation = await createAnnotation('highlight', subcollectionAttachment);
		allItems = [collectionItem1, collectionItem2, collectionItem3, subcollectionItem, subcollectionAttachment, subcollectionAnnotation];
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
	
	describe("Zotero-Server-ID", function () {
		it("should return the server ID in a response header", async function () {
			let xhr = await apiGet('/users/0/items');
			assert.equal(xhr.getResponseHeader('Zotero-Server-ID'), serverID);
		});

		it("should accept a read with a matching server ID", async function () {
			let xhr = await apiGet('/users/0/items', {
				headers: {
					'Zotero-Allowed-Request': '1',
					'Zotero-Server-ID': serverID,
				}
			});
			assert.equal(xhr.status, 200);
		});

		it("should accept a read with no server ID", async function () {
			// apiGet() doesn't send the header
			let xhr = await apiGet('/users/0/items');
			assert.equal(xhr.status, 200);
		});

		it("should reject a read with a mismatched server ID with 412", async function () {
			let xhr = await apiGet('/users/0/items', {
				headers: {
					'Zotero-Allowed-Request': '1',
					'Zotero-Server-ID': 'wrongServerID',
				},
				responseType: 'text',
				successCodes: [412]
			});
			assert.equal(xhr.status, 412);
			// The rejection still carries the real server ID, so a client with a
			// stale ID can recover
			assert.equal(xhr.getResponseHeader('Zotero-Server-ID'), serverID);
		});

		it("should require a server ID on writes with 428", async function () {
			let xhr = await apiPost('/users/0/items', {
				body: [],
				skipServerID: true,
				skipAPIKey: true,
				responseType: 'text',
				successCodes: [428]
			});
			assert.equal(xhr.status, 428);
		});

		it("should reject a write with a mismatched server ID with 412", async function () {
			let xhr = await apiPost('/users/0/items', {
				body: [],
				headers: { 'Zotero-Server-ID': 'wrongServerID' },
				skipAPIKey: true,
				responseType: 'text',
				successCodes: [412]
			});
			assert.equal(xhr.status, 412);
		});

		it("should validate the server ID before the API key on writes", async function () {
			// A valid server ID but no API key passes the server-ID check and
			// then fails authentication with 401
			let xhr = await apiPost('/users/0/items', {
				body: [],
				skipAPIKey: true,
				responseType: 'text',
				successCodes: [401]
			});
			assert.equal(xhr.status, 401);
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
			assert.equal(col.meta.numItems, 3);

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

			describe("/items", function () {
				it("should not include annotations", async function () {
					let { response } = await apiGet(`/users/0/collections/${subcollection.key}/items`);
					assert.isArray(response);
					assert.sameMembers(response.map(item => item.key), [subcollectionItem.key, subcollectionAttachment.key]);
				});
			});
		});
	});

	describe("<userOrGroupPrefix>/items", function () {
		it("should return all items", async function () {
			let { response } = await apiGet('/users/0/items');
			assert.isArray(response);
			assert.lengthOf(response, allItems.length);
		});

		describe("/top", function () {
			it("should return top-level items", async function () {
				let { response } = await apiGet('/users/0/items/top');
				assert.isArray(response);
				assert.sameMembers(response.map(item => item.key), [collectionItem1.key, collectionItem2.key, collectionItem3.key, subcollectionItem.key]);
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

			it("should return full-text data from /fulltext", async function () {
				let { response } = await apiGet(`/users/0/items/${subcollectionAttachment.key}/fulltext`);
				assert.deepEqual(response, {
					content: 'Zotero [zoh-TAIR-oh] is a free, easy-to-use tool to help you collect, organize, cite, and share your research sources.',
					indexedPages: 1,
					totalPages: 1,
				});
			});

			it("should return a 404 from /fulltext when attachment has no full-text content", async function () {
				let tempAttachment = await importFileAttachment('empty.pdf');
				let { response } = await apiGet(`/users/0/items/${tempAttachment.key}/fulltext`, {
					successCodes: [404],
					responseType: 'text'
				});
				assert.equal(response, 'Not found');
				await tempAttachment.eraseTx();
			});
		});
		
		describe("?itemType", function () {
			it("should filter by item type", async function () {
				let { response } = await apiGet('/users/0/items?itemType=book');
				assert.lengthOf(response, 2);
				assert.isTrue(response.every(item => item.data.itemType == 'book'));
			});
			
			it("should match annotations", async function () {
				let { response } = await apiGet('/users/0/items?itemType=annotation');
				assert.lengthOf(response, 1);
				assert.equal(response[0].key, subcollectionAnnotation.key);
				assert.equal(response[0].data.annotationComment, subcollectionAnnotation.annotationComment);
			});
			
			it("should be able to be negated", async function () {
				let { response } = await apiGet('/users/0/items?itemType=-book');
				assert.lengthOf(response, 3);
				assert.isTrue(response.every(item => item.data.itemType != 'book'));
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
				assert.lengthOf(response, 4);
			});

			it("should be able to be combined with ?itemType", async function () {
				let { response } = await apiGet('/users/0/items?itemType=book&tag=some tag');
				assert.lengthOf(response, 1);
			});
			
			it("should support OR combinations", async function () {
				let { response } = await apiGet('/users/0/items?tag=some tag || another tag');
				assert.lengthOf(response, 3);
			});
			
			it("should support OR and NOT combinations", async function () {
				let { response } = await apiGet('/users/0/items?tag=some tag || another tag&tag=-a third tag');
				assert.lengthOf(response, 2);
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
				
				it("should not accumulate citations on subsequent calls", async function () {
					let { response: r1 } = await apiGet('/users/0/items?include=citation');
					// Be sure generating a bibliography in the middle *also* doesn't affect the state
					await apiGet('/users/0/items?include=bib');
					let { response: r2 } = await apiGet('/users/0/items?include=citation');
					assert.equal(r1[0].citation, r2[0].citation);
				});
				
				describe("&style", function () {
					for (let [styleID, type] of [['cell', 'name'], ['https://www.zotero.org/styles/cell', 'URL']]) {
						it(`should install the given citation style by ${type} if not yet installed`, async function () {
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
					}
				});
			});
		});
		
		describe("?since", function () {
			it("should filter the results", async function () {
				let version = Zotero.Libraries.userLibrary.clientVersion;
				
				let { response: response1 } = await apiGet('/users/0/items?since=' + version);
				assert.isEmpty(response1);

				let { response: response2 } = await apiGet('/users/0/items?since=0');
				assert.lengthOf(response2, allItems.length);

				let tempItem = await createDataObject('item');
				let { response: response3 } = await apiGet('/users/0/items?since=' + version);
				assert.lengthOf(response3, 1);
				assert.equal(response3[0].key, tempItem.key);
				assert.equal(response3[0].version, tempItem.clientVersion);
				assert.equal(tempItem.clientVersion, version + 1);
				
				await tempItem.eraseTx();

				let { response: response4 } = await apiGet('/users/0/items?since=' + version);
				assert.lengthOf(response4, 0);
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
			assert.lengthOf(response, 3);
			assert.sameMembers(response.map(tag => tag.tag), ['some tag', 'another tag', 'a third tag']);
			assert.equal(response.find(tag => tag.tag === 'some tag').meta.numItems, 1);
		});
	});

	describe("<userOrGroupPrefix>/fulltext?since=", function () {
		it("should return items with full-text content", async function () {
			let { response } = await apiGet('/users/0/fulltext?since=0');
			assert.deepEqual(Object.entries(response), [[subcollectionAttachment.key, subcollectionAttachment.version]]);
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

	// ===================================================================
	// Write request tests
	// ===================================================================

	describe("Write requests", function () {
		before(async function () {
			Zotero.Server.LocalAPI._resetAuthorizeRateLimit();
			writeAPIKey = await setupRememberedAPIKey();
		});

		// Reset the local/authorize rate limit between tests so a long sequence of
		// stubbed prompts can run without tripping the per-minute 429 throttle.
		beforeEach(function () {
			Zotero.Server.LocalAPI._resetAuthorizeRateLimit();
		});

		describe("POST /api/local/authorize", function () {
			it("should return a key on allow", async function () {
				let stub = sinon.stub(Zotero.Server.LocalAPI, '_promptForAuthorization')
					.resolves({ allow: true, remember: false });
				try {
					let { response, status } = await authorizePost({ appName: 'AllowApp' });
					assert.equal(status, 200);
					assert.isString(response.key);
					assert.lengthOf(response.key, 32);
					assert.isFalse(response.remember);
				}
				finally {
					stub.restore();
				}
			});

			it("should mark a key as remembered when Always Allow is chosen", async function () {
				let stub = sinon.stub(Zotero.Server.LocalAPI, '_promptForAuthorization')
					.resolves({ allow: true, remember: true });
				try {
					let { response } = await authorizePost({ appName: 'RememberApp' });
					assert.isTrue(response.remember);
				}
				finally {
					stub.restore();
				}
			});

			it("should return 403 on deny", async function () {
				let stub = sinon.stub(Zotero.Server.LocalAPI, '_promptForAuthorization')
					.resolves({ allow: false, remember: false });
				try {
					let { response, status } = await authorizePost(
						{ appName: 'DeniedApp' }, { successCodes: [403] });
					assert.equal(status, 403);
					assert.isTrue(response.denied);
				}
				finally {
					stub.restore();
				}
			});

			it("should require appName", async function () {
				let { status } = await authorizePost(
					{}, { responseType: 'text', successCodes: [400] });
				assert.equal(status, 400);
			});

			it("should pass appName into the prompt", async function () {
				let captured;
				let stub = sinon.stub(Zotero.Server.LocalAPI, '_promptForAuthorization')
					.callsFake(async (appName) => {
						captured = appName;
						return { allow: false };
					});
				try {
					await authorizePost(
						{ appName: 'MyTestApp 1.0' }, { responseType: 'text', successCodes: [403] });
				}
				finally {
					stub.restore();
				}
				assert.equal(captured, 'MyTestApp 1.0');
			});

			it("should rate-limit after 5 confirmation-requiring requests in a minute", async function () {
				let stub = sinon.stub(Zotero.Server.LocalAPI, '_promptForAuthorization')
					.resolves({ allow: false, remember: false });
				try {
					for (let i = 0; i < 5; i++) {
						await authorizePost(
							{ appName: 'Throttle ' + i }, { responseType: 'text', successCodes: [403] });
					}
					let xhr = await authorizePost(
						{ appName: 'Throttle 6' }, { responseType: 'text', successCodes: [429] });
					assert.equal(xhr.status, 429);
					let retryAfter = parseInt(xhr.getResponseHeader('Retry-After'));
					assert.isAbove(retryAfter, 0);
					assert.isAtMost(retryAfter, 60);
				}
				finally {
					stub.restore();
				}
			});

			it("should not count rejected (pre-prompt) requests against the rate limit", async function () {
				// 5 bad-appName requests fail before the prompt and don't consume slots
				for (let i = 0; i < 5; i++) {
					await authorizePost(
						{}, { responseType: 'text', successCodes: [400] });
				}
				// A subsequent valid request still goes through
				let stub = sinon.stub(Zotero.Server.LocalAPI, '_promptForAuthorization')
					.resolves({ allow: false, remember: false });
				try {
					let { status } = await authorizePost(
						{ appName: 'AfterBadReqs' }, { successCodes: [403] });
					assert.equal(status, 403);
				}
				finally {
					stub.restore();
				}
			});
		});

		describe("Authorization management", function () {
			it("should report a count of remembered authorizations", async function () {
				let before = await Zotero.Server.LocalAPI.getAuthorizationCount();
				await setupRememberedAPIKey('CountedApp');
				let after = await Zotero.Server.LocalAPI.getAuthorizationCount();
				assert.equal(after, before + 1);
			});

			it("should drop every stored key when cleared", async function () {
				await setupRememberedAPIKey('ToClearApp');
				assert.isAbove(await Zotero.Server.LocalAPI.getAuthorizationCount(), 0);
				await Zotero.Server.LocalAPI.clearAuthorizations();
				assert.equal(await Zotero.Server.LocalAPI.getAuthorizationCount(), 0);

				// Previously-issued keys must no longer authenticate writes
				let { status } = await apiPost('/users/0/items', {
					body: [{ itemType: 'book' }],
					headers: {
						'Zotero-Write-Token': newWriteToken(),
						'Zotero-API-Key': writeAPIKey,
					},
					skipAPIKey: true,
					successCodes: [401],
					responseType: 'text'
				});
				assert.equal(status, 401);

				// Restore the suite-wide key so later tests still work
				writeAPIKey = await setupRememberedAPIKey('Test Suite');
			});
		});

		describe("Authentication", function () {
			it("should reject write requests with no API key (401)", async function () {
				let { status } = await apiPost('/users/0/items', {
					body: [{ itemType: 'book' }],
					headers: { 'Zotero-Write-Token': newWriteToken() },
					skipAPIKey: true,
					successCodes: [401],
					responseType: 'text'
				});
				assert.equal(status, 401);
			});

			it("should reject write requests with an unknown API key (401)", async function () {
				let { status } = await apiPost('/users/0/items', {
					body: [{ itemType: 'book' }],
					headers: {
						'Zotero-Write-Token': newWriteToken(),
						'Zotero-API-Key': 'not-a-real-key-at-all',
					},
					skipAPIKey: true,
					successCodes: [401],
					responseType: 'text'
				});
				assert.equal(status, 401);
			});

			it("should accept the API key via ?key= query parameter", async function () {
				let { status, response } = await apiPost(
					`/users/0/items?key=${encodeURIComponent(writeAPIKey)}`,
					{
						body: [{ itemType: 'book', title: 'QueryKey Item' }],
						headers: { 'Zotero-Write-Token': newWriteToken() },
						skipAPIKey: true,
					}
				);
				assert.equal(status, 200);
				let key = response.successful['0'].key;
				let item = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, key);
				if (item) await item.eraseTx();
			});

			it("should accept the API key via Authorization: Bearer header", async function () {
				let { status, response } = await apiPost(
					`/users/0/items`,
					{
						body: [{ itemType: 'book', title: 'BearerKey Item' }],
						headers: {
							'Zotero-Write-Token': newWriteToken(),
							'Authorization': `Bearer ${writeAPIKey}`,
						},
						skipAPIKey: true,
					}
				);
				assert.equal(status, 200);
				let key = response.successful['0'].key;
				let item = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, key);
				if (item) await item.eraseTx();
			});

			it("should consume a single-use API key after one write", async function () {
				let oneShot;
				let stub = sinon.stub(Zotero.Server.LocalAPI, '_promptForAuthorization')
					.resolves({ allow: true, remember: false });
				try {
					let { response } = await authorizePost({ appName: 'OneShotApp' });
					oneShot = response.key;
				}
				finally {
					stub.restore();
				}

				let { status, response } = await apiPost('/users/0/items', {
					body: [{ itemType: 'book' }],
					headers: {
						'Zotero-Write-Token': newWriteToken(),
						'Zotero-API-Key': oneShot,
					},
					skipAPIKey: true,
				});
				assert.equal(status, 200);
				let key = response.successful['0'].key;
				let item = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, key);
				if (item) await item.eraseTx();

				// Second use must be rejected
				let { status: status2 } = await apiPost('/users/0/items', {
					body: [{ itemType: 'book' }],
					headers: {
						'Zotero-Write-Token': newWriteToken(),
						'Zotero-API-Key': oneShot,
					},
					skipAPIKey: true,
					successCodes: [401],
					responseType: 'text'
				});
				assert.equal(status2, 401);
			});

			it("should allow remembered keys to be reused", async function () {
				// Use the suite key twice -- it's marked remember:true
				let first = await apiPost('/users/0/items', {
					body: [{ itemType: 'book' }],
					headers: { 'Zotero-Write-Token': newWriteToken() }
				});
				let second = await apiPost('/users/0/items', {
					body: [{ itemType: 'book' }],
					headers: { 'Zotero-Write-Token': newWriteToken() }
				});
				assert.equal(first.status, 200);
				assert.equal(second.status, 200);
				for (let resp of [first, second]) {
					let key = resp.response.successful['0'].key;
					let item = await Zotero.Items.getByLibraryAndKeyAsync(
						Zotero.Libraries.userLibraryID, key);
					if (item) await item.eraseTx();
				}
			});

			it("should not require API key for GET requests", async function () {
				let { status } = await apiGet('/users/0/items');
				assert.equal(status, 200);
			});

			it("should persist remembered keys to <profileDir>/localAPIKeys.json", async function () {
				let path = PathUtils.join(Zotero.Profile.dir, 'localAPIKeys.json');
				assert.isTrue(await IOUtils.exists(path));
				let text = await IOUtils.readUTF8(path);
				let json = JSON.parse(text);
				assert.isArray(json.keys);
				assert.isTrue(json.keys.some(k => k.key === writeAPIKey && k.remember));
			});
		});

		describe("POST <userOrGroupPrefix>/items", function () {
			it("should create a single item", async function () {
				let { response } = await apiPost('/users/0/items', {
					body: [{
						itemType: 'book',
						title: 'New Book From API',
					}],
					headers: { 'Zotero-Write-Token': newWriteToken() }
				});
				assert.isObject(response);
				assert.isObject(response.successful);
				assert.isObject(response.success);
				assert.isObject(response.unchanged);
				assert.isObject(response.failed);
				assert.isEmpty(Object.keys(response.failed));
				assert.lengthOf(Object.keys(response.successful), 1);
				let entry = response.successful['0'];
				assert.equal(entry.data.itemType, 'book');
				assert.equal(entry.data.title, 'New Book From API');
				assert.match(entry.key, /^[23456789ABCDEFGHIJKLMNPQRSTUVWXYZ]{8}$/);
				assert.equal(response.success['0'], entry.key);
				// Top-level version and data.version report the same (local) version
				assert.equal(entry.version, entry.data.version);
				// Cleanup
				let item = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, entry.key);
				if (item) await item.eraseTx();
			});

			it("should create multiple items in one request", async function () {
				let { response } = await apiPost('/users/0/items', {
					body: [
						{ itemType: 'book', title: 'Book A' },
						{ itemType: 'journalArticle', title: 'Article B' }
					],
					headers: { 'Zotero-Write-Token': newWriteToken() }
				});
				assert.lengthOf(Object.keys(response.successful), 2);
				assert.equal(response.successful['0'].data.title, 'Book A');
				assert.equal(response.successful['1'].data.itemType, 'journalArticle');
				// Cleanup
				for (let i of ['0', '1']) {
					let key = response.successful[i].key;
					let item = await Zotero.Items.getByLibraryAndKeyAsync(
						Zotero.Libraries.userLibraryID, key);
					if (item) await item.eraseTx();
				}
			});

			it("should report failed items in 'failed'", async function () {
				let { response } = await apiPost('/users/0/items', {
					body: [
						{ itemType: 'book', title: 'Valid Book' },
						{ itemType: 'noSuchType', title: 'Invalid' },
					],
					headers: { 'Zotero-Write-Token': newWriteToken() }
				});
				assert.lengthOf(Object.keys(response.successful), 1);
				assert.lengthOf(Object.keys(response.failed), 1);
				let failure = response.failed['1'];
				assert.equal(failure.code, 400);
				assert.include(failure.message.toLowerCase(), 'itemtype');
				// Cleanup
				let key = response.successful['0'].key;
				let item = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, key);
				if (item) await item.eraseTx();
			});

			it("should reject non-array body", async function () {
				let { status } = await apiPost('/users/0/items', {
					body: { itemType: 'book' },
					headers: { 'Zotero-Write-Token': newWriteToken() },
					successCodes: [400],
					responseType: 'text'
				});
				assert.equal(status, 400);
			});

			it("should reject batches over 50 items with 413", async function () {
				let body = [];
				for (let i = 0; i < 51; i++) {
					body.push({ itemType: 'book', title: 'Book ' + i });
				}
				let { status } = await apiPost('/users/0/items', {
					body,
					headers: { 'Zotero-Write-Token': newWriteToken() },
					successCodes: [413],
					responseType: 'text'
				});
				assert.equal(status, 413);
			});

			it("should reject duplicate write tokens with 412", async function () {
				let token = newWriteToken();
				await apiPost('/users/0/items', {
					body: [{ itemType: 'book', title: 'First with token' }],
					headers: { 'Zotero-Write-Token': token }
				});
				let { status } = await apiPost('/users/0/items', {
					body: [{ itemType: 'book', title: 'Second with token' }],
					headers: { 'Zotero-Write-Token': token },
					successCodes: [412],
					responseType: 'text'
				});
				assert.equal(status, 412);
			});

			it("should accept write tokens of 5-32 chars", async function () {
				let { status } = await apiPost('/users/0/items', {
					body: [{ itemType: 'book', title: 'Short token' }],
					headers: { 'Zotero-Write-Token': 'short' }
				});
				assert.equal(status, 200);
			});

			it("should reject write tokens shorter than 5 chars with 400", async function () {
				let { status } = await apiPost('/users/0/items', {
					body: [{ itemType: 'book' }],
					headers: { 'Zotero-Write-Token': 'abcd' },
					successCodes: [400],
					responseType: 'text'
				});
				assert.equal(status, 400);
			});

			it("should update an existing item with key+version", async function () {
				let item = await createDataObject('item', { itemType: 'book', setTitle: true });
				let { response } = await apiPost('/users/0/items', {
					body: [{
						key: item.key,
						version: item.clientVersion,
						itemType: 'book',
						title: 'Updated Title',
					}],
					headers: { 'Zotero-Write-Token': newWriteToken() }
				});
				assert.lengthOf(Object.keys(response.successful), 1);
				assert.equal(response.successful['0'].data.title, 'Updated Title');
				let reloaded = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, item.key);
				assert.equal(reloaded.getField('title'), 'Updated Title');
				await item.eraseTx();
			});

			it("should fail an object with stale version", async function () {
				let item = await createDataObject('item', { itemType: 'book', setTitle: true });
				let { response } = await apiPost('/users/0/items', {
					body: [{
						key: item.key,
						version: item.clientVersion - 5,
						itemType: 'book',
						title: 'Stale Update',
					}],
					headers: { 'Zotero-Write-Token': newWriteToken() }
				});
				assert.lengthOf(Object.keys(response.failed), 1);
				assert.equal(response.failed['0'].code, 412);
				await item.eraseTx();
			});

			it("should return 412 on stale If-Unmodified-Since-Version", async function () {
				let staleVersion = Zotero.Libraries.userLibrary.clientVersion;
				// Bump the library by creating a sentinel item
				let sentinel = await createDataObject('item');
				let { status } = await apiPost('/users/0/items', {
					body: [{ itemType: 'book' }],
					headers: {
						'Zotero-Write-Token': newWriteToken(),
						'If-Unmodified-Since-Version': String(staleVersion)
					},
					successCodes: [412],
					responseType: 'text'
				});
				assert.equal(status, 412);
				await sentinel.eraseTx();
			});

			it("should include Last-Modified-Version response header", async function () {
				let xhr = await apiPost('/users/0/items', {
					body: [{ itemType: 'book' }],
					headers: { 'Zotero-Write-Token': newWriteToken() }
				});
				let header = xhr.getResponseHeader('Last-Modified-Version');
				assert.isNotEmpty(header);
				assert.equal(
					parseInt(header),
					Zotero.Libraries.userLibrary.clientVersion);
				let key = xhr.response.successful['0'].key;
				let item = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, key);
				if (item) await item.eraseTx();
			});
		});

		describe("PUT <userOrGroupPrefix>/items/<key>", function () {
			it("should fully replace an item's fields", async function () {
				let item = await createDataObject('item', {
					itemType: 'book',
					setTitle: true,
				});
				item.setField('publisher', 'Original Pub');
				await item.saveTx();

				let { status } = await apiPut(`/users/0/items/${item.key}`, {
					body: {
						key: item.key,
						version: item.clientVersion,
						itemType: 'book',
						title: 'New Title After PUT',
					},
					successCodes: [204]
				});
				assert.equal(status, 204);

				let reloaded = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, item.key);
				assert.equal(reloaded.getField('title'), 'New Title After PUT');
				// PUT should clear unspecified fields
				assert.equal(reloaded.getField('publisher'), '');
				await item.eraseTx();
			});

			it("should reject without version or If-Unmodified-Since-Version", async function () {
				let item = await createDataObject('item');
				let { status } = await apiPut(`/users/0/items/${item.key}`, {
					body: { itemType: 'book', title: 'x' },
					successCodes: [428],
					responseType: 'text'
				});
				assert.equal(status, 428);
				await item.eraseTx();
			});

			it("should return 412 on stale version", async function () {
				let item = await createDataObject('item');
				let { status } = await apiPut(`/users/0/items/${item.key}`, {
					body: {
						itemType: 'book',
						title: 'x',
						version: item.clientVersion - 1,
					},
					successCodes: [412],
					responseType: 'text'
				});
				assert.equal(status, 412);
				await item.eraseTx();
			});

			it("should reject invalid key with 400", async function () {
				let { status } = await apiPut('/users/0/items/badkey!!', {
					body: { itemType: 'book' },
					successCodes: [400],
					responseType: 'text'
				});
				assert.equal(status, 400);
			});
		});

		describe("PATCH <userOrGroupPrefix>/items/<key>", function () {
			it("should leave unspecified fields untouched", async function () {
				let item = await createDataObject('item', {
					itemType: 'book',
					setTitle: true,
				});
				item.setField('publisher', 'Keep Me');
				await item.saveTx();
				let savedTitle = item.getField('title');

				let { status } = await apiPatch(`/users/0/items/${item.key}`, {
					body: {
						publisher: 'New Publisher',
						version: item.clientVersion,
					},
					successCodes: [204]
				});
				assert.equal(status, 204);

				let reloaded = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, item.key);
				assert.equal(reloaded.getField('title'), savedTitle);
				assert.equal(reloaded.getField('publisher'), 'New Publisher');
				await item.eraseTx();
			});

			it("should clear a field when explicitly set to ''", async function () {
				let item = await createDataObject('item', { itemType: 'book' });
				item.setField('publisher', 'Will Be Cleared');
				await item.saveTx();
				let { status } = await apiPatch(`/users/0/items/${item.key}`, {
					body: { publisher: '', version: item.clientVersion },
					successCodes: [204]
				});
				assert.equal(status, 204);
				let reloaded = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, item.key);
				assert.equal(reloaded.getField('publisher'), '');
				await item.eraseTx();
			});

			it("should accept If-Unmodified-Since-Version against the object version even after the library version advances", async function () {
				let itemA = await createDataObject('item', { itemType: 'book' });
				let versionA = itemA.clientVersion;
				// Another write advances the library version past itemA's version
				let itemB = await createDataObject('item', { itemType: 'book' });
				assert.isAbove(itemB.clientVersion, versionA);

				// itemA itself is unchanged, so a write with its version must succeed
				let { status } = await apiPatch(`/users/0/items/${itemA.key}`, {
					body: { publisher: 'Updated' },
					headers: { 'If-Unmodified-Since-Version': String(versionA) },
					successCodes: [204]
				});
				assert.equal(status, 204);
				let reloaded = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, itemA.key);
				assert.equal(reloaded.getField('publisher'), 'Updated');
				await itemA.eraseTx();
				await itemB.eraseTx();
			});
		});

		describe("DELETE <userOrGroupPrefix>/items/<key>", function () {
			it("should delete a single item", async function () {
				let item = await createDataObject('item');
				let { status } = await apiDelete(`/users/0/items/${item.key}`, {
					headers: {
						'If-Unmodified-Since-Version': String(item.clientVersion),
					},
					successCodes: [204]
				});
				assert.equal(status, 204);
				let reloaded = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, item.key);
				assert.isFalse(!!reloaded);
			});

			it("should require If-Unmodified-Since-Version (428)", async function () {
				let item = await createDataObject('item');
				let { status } = await apiDelete(`/users/0/items/${item.key}`, {
					successCodes: [428],
					responseType: 'text'
				});
				assert.equal(status, 428);
				await item.eraseTx();
			});

			it("should return 412 on stale If-Unmodified-Since-Version", async function () {
				let item = await createDataObject('item');
				let { status } = await apiDelete(`/users/0/items/${item.key}`, {
					headers: {
						'If-Unmodified-Since-Version': String(item.clientVersion - 1),
					},
					successCodes: [412],
					responseType: 'text'
				});
				assert.equal(status, 412);
				await item.eraseTx();
			});

			it("should return 404 for unknown key", async function () {
				let { status } = await apiDelete('/users/0/items/ABCDEFGH', {
					headers: { 'If-Unmodified-Since-Version': '999' },
					successCodes: [404],
					responseType: 'text'
				});
				assert.equal(status, 404);
			});
		});

		describe("DELETE <userOrGroupPrefix>/items?itemKey=", function () {
			it("should delete multiple items", async function () {
				let item1 = await createDataObject('item');
				let item2 = await createDataObject('item');
				let { status } = await apiDelete(
					`/users/0/items?itemKey=${item1.key},${item2.key}`,
					{
						headers: {
							'If-Unmodified-Since-Version':
								String(Zotero.Libraries.userLibrary.clientVersion),
						},
						successCodes: [204]
					}
				);
				assert.equal(status, 204);
				assert.isFalse(!!(await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, item1.key)));
				assert.isFalse(!!(await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, item2.key)));
			});

			it("should ignore unknown keys mixed in", async function () {
				let item = await createDataObject('item');
				let { status } = await apiDelete(
					`/users/0/items?itemKey=${item.key},ZZZZZZZZ`,
					{
						headers: {
							'If-Unmodified-Since-Version':
								String(Zotero.Libraries.userLibrary.clientVersion),
						},
						successCodes: [204]
					}
				);
				assert.equal(status, 204);
			});

			it("should reject batches over 50 keys with 413", async function () {
				let keys = [];
				for (let i = 0; i < 51; i++) {
					keys.push("AAAAAAA" + (i % 9 + 1));
				}
				let { status } = await apiDelete(
					'/users/0/items?itemKey=' + keys.join(','),
					{
						headers: {
							'If-Unmodified-Since-Version':
								String(Zotero.Libraries.userLibrary.clientVersion),
						},
						successCodes: [413],
						responseType: 'text'
					}
				);
				assert.equal(status, 413);
			});
		});

		describe("POST <userOrGroupPrefix>/collections", function () {
			it("should create a collection", async function () {
				let { response } = await apiPost('/users/0/collections', {
					body: [{ name: 'New Test Collection' }],
					headers: { 'Zotero-Write-Token': newWriteToken() }
				});
				assert.lengthOf(Object.keys(response.successful), 1);
				let key = response.successful['0'].key;
				let col = Zotero.Collections.getByLibraryAndKey(
					Zotero.Libraries.userLibraryID, key);
				assert.equal(col.name, 'New Test Collection');
				await col.eraseTx();
			});

			it("should set parentCollection when provided", async function () {
				let parent = await createDataObject('collection');
				let { response } = await apiPost('/users/0/collections', {
					body: [{ name: 'Child', parentCollection: parent.key }],
					headers: { 'Zotero-Write-Token': newWriteToken() }
				});
				let key = response.successful['0'].key;
				let child = Zotero.Collections.getByLibraryAndKey(
					Zotero.Libraries.userLibraryID, key);
				assert.equal(child.parentKey, parent.key);
				await child.eraseTx();
				await parent.eraseTx();
			});
		});

		describe("PUT/PATCH/DELETE <userOrGroupPrefix>/collections/<key>", function () {
			it("should update a collection via PUT", async function () {
				let col = await createDataObject('collection', { name: 'Before' });
				let { status } = await apiPut(`/users/0/collections/${col.key}`, {
					body: {
						version: col.clientVersion,
						name: 'After PUT',
					},
					successCodes: [204]
				});
				assert.equal(status, 204);
				let reloaded = Zotero.Collections.getByLibraryAndKey(
					Zotero.Libraries.userLibraryID, col.key);
				assert.equal(reloaded.name, 'After PUT');
				await col.eraseTx();
			});

			it("should patch a collection's name", async function () {
				let col = await createDataObject('collection', { name: 'Before' });
				let { status } = await apiPatch(`/users/0/collections/${col.key}`, {
					body: { name: 'After PATCH', version: col.clientVersion },
					successCodes: [204]
				});
				assert.equal(status, 204);
				let reloaded = Zotero.Collections.getByLibraryAndKey(
					Zotero.Libraries.userLibraryID, col.key);
				assert.equal(reloaded.name, 'After PATCH');
				await col.eraseTx();
			});

			it("should delete a collection", async function () {
				let col = await createDataObject('collection');
				let { status } = await apiDelete(`/users/0/collections/${col.key}`, {
					headers: {
						'If-Unmodified-Since-Version': String(col.clientVersion),
					},
					successCodes: [204]
				});
				assert.equal(status, 204);
				let reloaded = Zotero.Collections.getByLibraryAndKey(
					Zotero.Libraries.userLibraryID, col.key);
				assert.isFalse(!!reloaded);
			});
		});

		describe("POST/PUT/DELETE <userOrGroupPrefix>/searches", function () {
			it("should create a saved search", async function () {
				let { response } = await apiPost('/users/0/searches', {
					body: [{
						name: 'My Saved Search',
						conditions: [
							{ condition: 'title', operator: 'contains', value: 'foo' }
						]
					}],
					headers: { 'Zotero-Write-Token': newWriteToken() }
				});
				assert.lengthOf(Object.keys(response.successful), 1);
				let key = response.successful['0'].key;
				let search = Zotero.Searches.getByLibraryAndKey(
					Zotero.Libraries.userLibraryID, key);
				assert.equal(search.name, 'My Saved Search');
				await search.eraseTx();
			});

			it("should delete a search", async function () {
				let search = await createDataObject('search', { name: 'To Delete' });
				let { status } = await apiDelete(`/users/0/searches/${search.key}`, {
					headers: {
						'If-Unmodified-Since-Version': String(search.clientVersion),
					},
					successCodes: [204]
				});
				assert.equal(status, 204);
				let reloaded = Zotero.Searches.getByLibraryAndKey(
					Zotero.Libraries.userLibraryID, search.key);
				assert.isFalse(!!reloaded);
			});
		});

		describe("DELETE <userOrGroupPrefix>/tags", function () {
			it("should remove tags from the library", async function () {
				let item = await createDataObject('item');
				item.setTags(['tagToDelete', 'tagToKeep']);
				await item.saveTx();
				assert.isAtLeast(Zotero.Tags.getID('tagToDelete'), 1);

				let { status } = await apiDelete('/users/0/tags?tag=tagToDelete', {
					headers: {
						'If-Unmodified-Since-Version':
							String(Zotero.Libraries.userLibrary.clientVersion),
					},
					successCodes: [204]
				});
				assert.equal(status, 204);
				let reloaded = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, item.key);
				assert.notInclude(reloaded.getTags().map(t => t.tag), 'tagToDelete');
				assert.include(reloaded.getTags().map(t => t.tag), 'tagToKeep');
				await item.eraseTx();
			});

			it("should split tag names on ||", async function () {
				let item = await createDataObject('item');
				item.setTags(['multi1', 'multi2', 'keep']);
				await item.saveTx();
				let { status } = await apiDelete('/users/0/tags?tag=multi1||multi2', {
					headers: {
						'If-Unmodified-Since-Version':
							String(Zotero.Libraries.userLibrary.clientVersion),
					},
					successCodes: [204]
				});
				assert.equal(status, 204);
				let reloaded = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, item.key);
				let tags = reloaded.getTags().map(t => t.tag);
				assert.notInclude(tags, 'multi1');
				assert.notInclude(tags, 'multi2');
				assert.include(tags, 'keep');
				await item.eraseTx();
			});

			it("should require If-Unmodified-Since-Version", async function () {
				let { status } = await apiDelete('/users/0/tags?tag=anything', {
					successCodes: [428],
					responseType: 'text'
				});
				assert.equal(status, 428);
			});
		});

		describe("PUT <userOrGroupPrefix>/items/<key>/fulltext", function () {
			let parent;
			let attachment;

			beforeEach(async function () {
				parent = await createDataObject('item');
				attachment = await importPDFAttachment(parent);
			});

			afterEach(async function () {
				if (attachment) await attachment.eraseTx();
				if (parent) await parent.eraseTx();
			});

			it("should set fulltext content for an attachment", async function () {
				let beforeVersion = Zotero.Libraries.userLibrary.clientVersion;
				let xhr = await apiPut(
					`/users/0/items/${attachment.key}/fulltext`,
					{
						body: {
							content: 'Hello, fulltext.',
							indexedPages: 1,
							totalPages: 1,
						}
					}
				);
				assert.equal(xhr.status, 204);
				let lastModified = parseInt(xhr.getResponseHeader('Last-Modified-Version'));
				assert.isAbove(lastModified, beforeVersion);

				let { response } = await apiGet(`/users/0/items/${attachment.key}/fulltext`);
				assert.equal(response.content, 'Hello, fulltext.');
				assert.equal(response.indexedPages, 1);
				assert.equal(response.totalPages, 1);
			});

			it("should accept char-based stats", async function () {
				let { status } = await apiPut(
					`/users/0/items/${attachment.key}/fulltext`,
					{
						body: {
							content: 'Char-counted content.',
							indexedChars: 21,
							totalChars: 21,
						}
					}
				);
				assert.equal(status, 204);
				let { response } = await apiGet(`/users/0/items/${attachment.key}/fulltext`);
				assert.equal(response.content, 'Char-counted content.');
				assert.equal(response.indexedChars, 21);
				assert.equal(response.totalChars, 21);
			});

			it("should reject a body without 'content'", async function () {
				let { status } = await apiPut(
					`/users/0/items/${attachment.key}/fulltext`,
					{
						body: { indexedPages: 1, totalPages: 1 },
						successCodes: [400],
						responseType: 'text'
					}
				);
				assert.equal(status, 400);
			});

			it("should reject non-integer stats", async function () {
				let { status } = await apiPut(
					`/users/0/items/${attachment.key}/fulltext`,
					{
						body: { content: 'x', indexedPages: '1' },
						successCodes: [400],
						responseType: 'text'
					}
				);
				assert.equal(status, 400);
			});

			it("should return 404 for unknown item key", async function () {
				let { status } = await apiPut(
					`/users/0/items/AAAAAAAA/fulltext`,
					{
						body: { content: 'x' },
						successCodes: [404],
						responseType: 'text'
					}
				);
				assert.equal(status, 404);
			});

			it("should reject a non-attachment item", async function () {
				let regularItem = await createDataObject('item');
				try {
					let { status } = await apiPut(
						`/users/0/items/${regularItem.key}/fulltext`,
						{
							body: { content: 'x' },
							successCodes: [404],
							responseType: 'text'
						}
					);
					assert.equal(status, 404);
				}
				finally {
					await regularItem.eraseTx();
				}
			});
		});

		describe("POST <userOrGroupPrefix>/fulltext", function () {
			let parent;
			let a1;
			let a2;

			beforeEach(async function () {
				parent = await createDataObject('item');
				a1 = await importPDFAttachment(parent);
				a2 = await importPDFAttachment(parent);
			});

			afterEach(async function () {
				for (let item of [a1, a2, parent]) {
					if (item) await item.eraseTx();
				}
			});

			function iusvHeader() {
				return { 'If-Unmodified-Since-Version': String(Zotero.Libraries.userLibrary.clientVersion) };
			}

			it("should write multiple items and return a write report", async function () {
				let { status, response } = await apiPost('/users/0/fulltext', {
					headers: iusvHeader(),
					body: [
						{ key: a1.key, content: 'one', indexedPages: 1, totalPages: 1 },
						{ key: a2.key, content: 'two', indexedPages: 1, totalPages: 1 },
					]
				});
				assert.equal(status, 200);
				assert.deepEqual(response.successful['0'], { key: a1.key });
				assert.deepEqual(response.successful['1'], { key: a2.key });
				assert.equal(response.success['0'], a1.key);
				assert.equal(response.success['1'], a2.key);
				assert.isEmpty(Object.keys(response.failed));

				let { response: r1 } = await apiGet(`/users/0/items/${a1.key}/fulltext`);
				assert.equal(r1.content, 'one');
				let { response: r2 } = await apiGet(`/users/0/items/${a2.key}/fulltext`);
				assert.equal(r2.content, 'two');
			});

			it("should report per-item failures while applying the rest", async function () {
				let regularItem = await createDataObject('item');
				try {
					let { status, response } = await apiPost('/users/0/fulltext', {
						headers: iusvHeader(),
						body: [
							{ key: a1.key, content: 'ok' },
							{ key: 'AAAAAAAA', content: 'missing' },
							{ key: regularItem.key, content: 'not-attach' },
						]
					});
					assert.equal(status, 200);
					assert.property(response.successful, '0');
					assert.notProperty(response.successful, '1');
					assert.notProperty(response.successful, '2');
					assert.equal(response.failed['1'].code, 404);
					assert.equal(response.failed['2'].code, 404);
				}
				finally {
					await regularItem.eraseTx();
				}
			});

			it("should require If-Unmodified-Since-Version (428)", async function () {
				let { status } = await apiPost('/users/0/fulltext', {
					body: [{ key: a1.key, content: 'x' }],
					successCodes: [428],
					responseType: 'text'
				});
				assert.equal(status, 428);
			});

			it("should reject non-array body with 400", async function () {
				let { status } = await apiPost('/users/0/fulltext', {
					headers: iusvHeader(),
					body: { key: a1.key, content: 'x' },
					successCodes: [400],
					responseType: 'text'
				});
				assert.equal(status, 400);
			});

			it("should reject batches over 10 with 413", async function () {
				let big = [];
				for (let i = 0; i < 11; i++) {
					big.push({ key: a1.key, content: 'x' });
				}
				let { status } = await apiPost('/users/0/fulltext', {
					headers: iusvHeader(),
					body: big,
					successCodes: [413],
					responseType: 'text'
				});
				assert.equal(status, 413);
			});

			it("should reject an entry missing 'key'", async function () {
				let { status, response } = await apiPost('/users/0/fulltext', {
					headers: iusvHeader(),
					body: [{ content: 'x' }]
				});
				assert.equal(status, 200);
				assert.equal(response.failed['0'].code, 400);
			});
		});

		describe("File uploads", function () {
			let attachment;

			beforeEach(async function () {
				let parent = await createDataObject('item');
				attachment = await Zotero.Attachments.importFromFile({
					file: OS.Path.join(getTestDataDirectory().path, 'test.pdf'),
					parentItemID: parent.id,
				});
			});

			afterEach(async function () {
				if (attachment) {
					let parent = Zotero.Items.get(attachment.parentItemID);
					await attachment.eraseTx();
					if (parent) await parent.eraseTx();
				}
			});

			it("should return {exists:1} when MD5 matches local file", async function () {
				let path = await attachment.getFilePathAsync();
				let md5 = await Zotero.Utilities.Internal.md5Async(path);
				let stat = await IOUtils.stat(path);

				let { response } = await apiPost(
					`/users/0/items/${attachment.key}/file`,
					{
						body: `md5=${md5}&filename=${encodeURIComponent(attachment.attachmentFilename)}&filesize=${stat.size}&mtime=${stat.lastModified}`,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'If-None-Match': '*',
						}
					}
				);
				assert.equal(response.exists, 1);
			});

			it("should authorize a new upload when MD5 differs", async function () {
				let newMD5 = 'a'.repeat(32);
				let { response } = await apiPost(
					`/users/0/items/${attachment.key}/file`,
					{
						body: `md5=${newMD5}&filename=newfile.pdf&filesize=10&mtime=${Date.now()}`,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'If-None-Match': '*',
						}
					}
				);
				assert.isString(response.url);
				assert.isString(response.uploadKey);
				assert.include(response.url, '/api/local/uploads/');
				assert.property(response, 'prefix');
				assert.property(response, 'suffix');
			});

			it("should return params object when params=1 is in the body", async function () {
				let { response } = await apiPost(
					`/users/0/items/${attachment.key}/file`,
					{
						body: `md5=${'b'.repeat(32)}&filename=x.pdf&filesize=10&mtime=${Date.now()}&params=1`,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'If-None-Match': '*',
						}
					}
				);
				assert.isObject(response.params);
				assert.isString(response.uploadKey);
			});

			it("should reject mtime in seconds with 400", async function () {
				let { status } = await apiPost(
					`/users/0/items/${attachment.key}/file`,
					{
						body: `md5=${'c'.repeat(32)}&filename=x.pdf&filesize=10&mtime=1000`,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'If-None-Match': '*',
						},
						successCodes: [400],
						responseType: 'text'
					}
				);
				assert.equal(status, 400);
			});

			it("should require If-Match or If-None-Match with 428", async function () {
				let { status } = await apiPost(
					`/users/0/items/${attachment.key}/file`,
					{
						body: `md5=${'d'.repeat(32)}&filename=x.pdf&filesize=10&mtime=${Date.now()}`,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
						},
						successCodes: [428],
						responseType: 'text'
					}
				);
				assert.equal(status, 428);
			});

			it("should reject bad MD5 with 400", async function () {
				let { status } = await apiPost(
					`/users/0/items/${attachment.key}/file`,
					{
						body: `md5=not-a-real-md5&filename=x.pdf&filesize=10&mtime=${Date.now()}`,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'If-None-Match': '*',
						},
						successCodes: [400],
						responseType: 'text'
					}
				);
				assert.equal(status, 400);
			});

			it("should reject a filename containing path separators with 400", async function () {
				for (let filename of ['../escape.txt', 'sub/escape.txt', '..\\escape.txt', '..']) {
					let { status } = await apiPost(
						`/users/0/items/${attachment.key}/file`,
						{
							body: `md5=${'a'.repeat(32)}&filename=${encodeURIComponent(filename)}`
								+ `&filesize=10&mtime=${Date.now()}`,
							headers: {
								'Content-Type': 'application/x-www-form-urlencoded',
								'If-None-Match': '*',
							},
							successCodes: [400],
							responseType: 'text'
						}
					);
					assert.equal(status, 400, `expected 400 for filename '${filename}'`);
				}
			});

			it("should perform a full upload + register flow", async function () {
				// Generate new file content with a known MD5
				let content = "Local API upload test content " + Date.now();
				let encoder = new TextEncoder();
				let bytes = encoder.encode(content);
				// Compute the MD5 we will claim
				let tmpDir = Zotero.getTempDirectory().path;
				let tmpPath = PathUtils.join(tmpDir, 'localapi-upload-test.bin');
				await IOUtils.write(tmpPath, bytes);
				let md5 = await Zotero.Utilities.Internal.md5Async(tmpPath);
				await IOUtils.remove(tmpPath);

				let mtime = Date.now();

				// Phase 1: authorize
				let { response: authResp } = await apiPost(
					`/users/0/items/${attachment.key}/file`,
					{
						body: `md5=${md5}&filename=uploaded.bin&filesize=${bytes.length}&mtime=${mtime}`,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'If-None-Match': '*',
						}
					}
				);
				assert.isString(authResp.uploadKey);
				let uploadKey = authResp.uploadKey;

				// Phase 2: upload bytes to local receiver
				let uploadXhr = await Zotero.HTTP.request(
					'POST', authResp.url,
					{
						headers: {
							'Zotero-Allowed-Request': '1',
							'Content-Type': 'application/octet-stream',
							'Zotero-Server-ID': serverID,
						},
						body: content,
						successCodes: [201],
						responseType: 'text'
					}
				);
				assert.equal(uploadXhr.status, 201);

				// Phase 3: register
				let { status } = await apiPost(
					`/users/0/items/${attachment.key}/file`,
					{
						body: `upload=${uploadKey}`,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'If-None-Match': '*',
						},
						successCodes: [204]
					}
				);
				assert.equal(status, 204);

				// Verify attachment metadata was updated
				let reloaded = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, attachment.key);
				assert.equal(reloaded.attachmentSyncedHash, md5);
				assert.equal(reloaded.attachmentSyncedModificationTime, mtime);
				assert.equal(reloaded.attachmentFilename, 'uploaded.bin');
			});

			// Exercises the params=1 multipart upload form: each returned param as a form
			// field, then the file bytes in a final `file` field. Uses real binary content
			// to confirm it survives the multipart path.
			it("should perform a params=1 multipart upload + register flow", async function () {
				// Binary content spanning the byte range, ending in a newline byte to
				// confirm the multipart parser doesn't trim/corrupt the file body
				let raw = [0x25, 0x50, 0x44, 0x46, 0x00, 0x7f, 0x80, 0xff, 0xd0, 0x0a];
				let bytes = Uint8Array.from(raw);
				let tmpDir = Zotero.getTempDirectory().path;
				let tmpPath = PathUtils.join(tmpDir, 'localapi-mp-upload-test.bin');
				await IOUtils.write(tmpPath, bytes);
				let md5 = await Zotero.Utilities.Internal.md5Async(tmpPath);
				await IOUtils.remove(tmpPath);

				let mtime = Date.now();

				// Phase 1: authorize with params=1 in the form body
				let { response: authResp } = await apiPost(
					`/users/0/items/${attachment.key}/file`,
					{
						body: `md5=${md5}&filename=uploaded.bin&filesize=${bytes.length}`
							+ `&mtime=${mtime}&params=1`,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'If-None-Match': '*',
						}
					}
				);
				assert.isObject(authResp.params);
				assert.isString(authResp.uploadKey);

				// Phase 2: upload as multipart/form-data via FormData, with the returned
				// params first, then the file part
				let formData = new FormData();
				for (let [key, val] of Object.entries(authResp.params)) {
					formData.append(key, val);
				}
				formData.append('file', new Blob([bytes]), 'uploaded.bin');

				let uploadXhr = await Zotero.HTTP.request('POST', authResp.url, {
					headers: {
						'Zotero-Allowed-Request': '1',
						'Content-Type': 'multipart/form-data',
						'Zotero-Server-ID': serverID,
					},
					body: formData,
					successCodes: [201],
					responseType: 'text'
				});
				assert.equal(uploadXhr.status, 201);

				// Phase 3: register
				let { status } = await apiPost(
					`/users/0/items/${attachment.key}/file`,
					{
						body: `upload=${authResp.uploadKey}`,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'If-None-Match': '*',
						},
						successCodes: [204]
					}
				);
				assert.equal(status, 204);

				let reloaded = await Zotero.Items.getByLibraryAndKeyAsync(
					Zotero.Libraries.userLibraryID, attachment.key);
				assert.equal(reloaded.attachmentSyncedHash, md5);
				assert.equal(reloaded.attachmentFilename, 'uploaded.bin');
				// The stored file's bytes must match exactly
				let storedPath = await reloaded.getFilePathAsync();
				let stored = await IOUtils.read(storedPath);
				assert.deepEqual(Array.from(stored), raw);
			});

			it("should reject registration without prior upload", async function () {
				// Authorize but never upload, then try to register
				let { response: authResp } = await apiPost(
					`/users/0/items/${attachment.key}/file`,
					{
						body: `md5=${'e'.repeat(32)}&filename=x.bin&filesize=5&mtime=${Date.now()}`,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'If-None-Match': '*',
						}
					}
				);
				let { status } = await apiPost(
					`/users/0/items/${attachment.key}/file`,
					{
						body: `upload=${authResp.uploadKey}`,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'If-None-Match': '*',
						},
						successCodes: [400],
						responseType: 'text'
					}
				);
				assert.equal(status, 400);
			});

			it("should reject upload-receiver with mismatched MD5", async function () {
				// Authorize with one MD5, then upload different content
				let claimedMD5 = 'a'.repeat(32);
				let { response: authResp } = await apiPost(
					`/users/0/items/${attachment.key}/file`,
					{
						body: `md5=${claimedMD5}&filename=mm.bin&filesize=10&mtime=${Date.now()}`,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							'If-None-Match': '*',
						}
					}
				);
				let { status } = await Zotero.HTTP.request(
					'POST', authResp.url,
					{
						headers: {
							'Zotero-Allowed-Request': '1',
							'Content-Type': 'application/octet-stream',
							'Zotero-Server-ID': serverID,
						},
						body: 'wrong content',
						successCodes: [400],
						responseType: 'text'
					}
				);
				assert.equal(status, 400);
			});

			it("should return 404 when upload key is unknown", async function () {
				let { status } = await Zotero.HTTP.request(
					'POST', apiRoot + '/local/uploads/badkey999',
					{
						headers: {
							'Zotero-Allowed-Request': '1',
							'Content-Type': 'application/octet-stream',
							'Zotero-Server-ID': serverID,
						},
						body: 'whatever',
						successCodes: [404],
						responseType: 'text'
					}
				);
				assert.equal(status, 404);
			});

			it("should reject PATCH partial upload with 405", async function () {
				let { status } = await apiPatch(
					`/users/0/items/${attachment.key}/file?algorithm=xdelta&upload=foo`,
					{
						headers: {
							'Content-Type': 'application/octet-stream',
						},
						body: 'diff',
						successCodes: [405],
						responseType: 'text'
					}
				);
				assert.equal(status, 405);
			});
		});

		describe("Method restrictions", function () {
			it("should reject POST to /items/top with 400 or 405", async function () {
				let { status } = await apiPost('/users/0/items/top', {
					body: [{ itemType: 'book' }],
					headers: { 'Zotero-Write-Token': newWriteToken() },
					successCodes: [400, 405],
					responseType: 'text'
				});
				assert.oneOf(status, [400, 405]);
			});

			it("should reject DELETE to /items/trash with 400 or 405", async function () {
				let { status } = await apiDelete(
					'/users/0/items/trash?itemKey=ABCDEFGH',
					{
						headers: { 'If-Unmodified-Since-Version': '0' },
						successCodes: [400, 405],
						responseType: 'text'
					}
				);
				assert.oneOf(status, [400, 405]);
			});
		});
	});
});
