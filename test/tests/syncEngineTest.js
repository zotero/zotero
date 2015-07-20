"use strict";

describe("Zotero.Sync.Data.Engine", function () {
	var apiKey = Zotero.Utilities.randomString(24);
	var baseURL = "http://local.zotero/";
	var engine, server, client, caller, stub, spy;
	
	var responses = {};
	
	var setup = Zotero.Promise.coroutine(function* (options) {
		options = options || {};
		
		server = sinon.fakeServer.create();
		server.autoRespond = true;
		
		Components.utils.import("resource://zotero/concurrent-caller.js");
		var caller = new ConcurrentCaller(1);
		caller.setLogger(msg => Zotero.debug(msg));
		caller.stopOnError = true;
		caller.onError = function (e) {
			Zotero.logError(e);
			if (options.onError) {
				options.onError(e);
			}
			if (e.fatal) {
				caller.stop();
				throw e;
			}
		};
		
		var client = new Zotero.Sync.APIClient({
			baseURL: baseURL,
			apiVersion: options.apiVersion || ZOTERO_CONFIG.API_VERSION,
			apiKey: apiKey,
			concurrentCaller: caller,
			background: options.background || true
		});
		
		var engine = new Zotero.Sync.Data.Engine({
			apiClient: client,
			libraryID: options.libraryID || Zotero.Libraries.userLibraryID
		});
		
		return { engine, client, caller };
	});
	
	function setResponse(response) {
		setHTTPResponse(server, baseURL, response, responses);
	}
	
	function makeCollectionJSON(options) {
		return {
			key: options.key,
			version: options.version,
			data: {
				key: options.key,
				version: options.version,
				name: options.name
			}
		};
	}
	
	function makeSearchJSON(options) {
		return {
			key: options.key,
			version: options.version,
			data: {
				key: options.key,
				version: options.version,
				name: options.name,
				conditions: options.conditions ? options.conditions : [
					{
						condition: 'title',
						operator: 'contains',
						value: 'test'
					}
				]
			}
		};
	}
	
	function makeItemJSON(options) {
		var json = {
			key: options.key,
			version: options.version,
			data: {
				key: options.key,
				version: options.version,
				itemType: options.itemType || 'book',
				title: options.title || options.name
			}
		};
		Object.assign(json.data, options);
		delete json.data.name;
		return json;
	}
	
	// Allow functions to be called programmatically
	var makeJSONFunctions = {
		collection: makeCollectionJSON,
		search: makeSearchJSON,
		item: makeItemJSON
	};
	
	//
	// Tests
	//
	beforeEach(function* () {
		this.timeout(60000);
		yield resetDB({
			skipBundledFiles: true
		});
		
		Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		
		yield Zotero.Users.setCurrentUserID(1);
		yield Zotero.Users.setCurrentUsername("testuser");
	})
	after(function* () {
		this.timeout(60000);
		yield resetDB();
	})
	
	describe("Syncing", function () {
		it("should perform a sync for a new library", function* () {
			({ engine, client, caller } = yield setup());
			
			server.respond(function (req) {
				if (req.method == "POST" && req.url == baseURL + "users/1/items") {
					let ifUnmodifiedSince = req.requestHeaders["If-Unmodified-Since-Version"];
					if (ifUnmodifiedSince == 0) {
						req.respond(412, {}, "Library has been modified since specified version");
						return;
					}
					
					if (ifUnmodifiedSince == 3) {
						let json = JSON.parse(req.requestBody);
						req.respond(
							200,
							{
								"Content-Type": "application/json",
								"Last-Modified-Version": 3
							},
							JSON.stringify({
								success: {
									"0": json[0].key,
									"1": json[1].key
								},
								unchanged: {},
								failed: {}
							})
						);
						return;
					}
				}
			})
			
			var headers = {
				"Last-Modified-Version": 3
			};
			setResponse({
				method: "GET",
				url: "users/1/settings",
				status: 200,
				headers: headers,
				json: {
					tagColors: {
						value: [
							{
								name: "A",
								color: "#CC66CC"
							}
						],
						version: 2
					}
				}
			});
			setResponse({
				method: "GET",
				url: "users/1/collections?format=versions",
				status: 200,
				headers: headers,
				json: {
					"AAAAAAAA": 1
				}
			});
			setResponse({
				method: "GET",
				url: "users/1/searches?format=versions",
				status: 200,
				headers: headers,
				json: {
					"AAAAAAAA": 2
				}
			});
			setResponse({
				method: "GET",
				url: "users/1/items?format=versions&includeTrashed=1",
				status: 200,
				headers: headers,
				json: {
					"AAAAAAAA": 3
				}
			});
			setResponse({
				method: "GET",
				url: "users/1/collections?format=json&collectionKey=AAAAAAAA",
				status: 200,
				headers: headers,
				json: [
					makeCollectionJSON({
						key: "AAAAAAAA",
						version: 1,
						name: "A"
					})
				]
			});
			setResponse({
				method: "GET",
				url: "users/1/searches?format=json&searchKey=AAAAAAAA",
				status: 200,
				headers: headers,
				json: [
					makeSearchJSON({
						key: "AAAAAAAA",
						version: 2,
						name: "A"
					})
				]
			});
			setResponse({
				method: "GET",
				url: "users/1/items?format=json&itemKey=AAAAAAAA&includeTrashed=1",
				status: 200,
				headers: headers,
				json: [
					makeItemJSON({
						key: "AAAAAAAA",
						version: 3,
						itemType: "book",
						title: "A"
					})
				]
			});
			setResponse({
				method: "GET",
				url: "users/1/deleted?since=0",
				status: 200,
				headers: headers,
				json: {}
			});
			yield engine.start();
			
			var userLibraryID = Zotero.Libraries.userLibraryID;
			
			// Check local library version
			assert.equal(Zotero.Libraries.getVersion(userLibraryID), 3);
			
			// Make sure local objects exist
			var setting = yield Zotero.SyncedSettings.get(userLibraryID, "tagColors");
			assert.lengthOf(setting, 1);
			assert.equal(setting[0].name, 'A');
			var settingMetadata = yield Zotero.SyncedSettings.getMetadata(userLibraryID, "tagColors");
			assert.equal(settingMetadata.version, 2);
			assert.isTrue(settingMetadata.synced);
			
			var obj = yield Zotero.Collections.getByLibraryAndKeyAsync(userLibraryID, "AAAAAAAA");
			assert.equal(obj.name, 'A');
			assert.equal(obj.version, 1);
			assert.isTrue(obj.synced);
			
			obj = yield Zotero.Searches.getByLibraryAndKeyAsync(userLibraryID, "AAAAAAAA");
			assert.equal(obj.name, 'A');
			assert.equal(obj.version, 2);
			assert.isTrue(obj.synced);
			
			obj = yield Zotero.Items.getByLibraryAndKeyAsync(userLibraryID, "AAAAAAAA");
			assert.equal(obj.getField('title'), 'A');
			assert.equal(obj.version, 3);
			assert.isTrue(obj.synced);
		})
		
		it("should make only one request if in sync", function* () {
			yield Zotero.Libraries.setVersion(Zotero.Libraries.userLibraryID, 5);
			({ engine, client, caller } = yield setup());
			
			server.respond(function (req) {
				if (req.method == "GET" && req.url == baseURL + "users/1/settings?since=5") {
					let since = req.requestHeaders["If-Modified-Since-Version"];
					if (since == 5) {
						req.respond(304);
						return;
					}
				}
			});
			yield engine.start();
		})
	})
	
	describe("#_startDownload()", function () {
		it("shouldn't redownload objects already in the cache", function* () {
			var userLibraryID = Zotero.Libraries.userLibraryID;
			//yield Zotero.Libraries.setVersion(userLibraryID, 5);
			({ engine, client, caller } = yield setup());
			
			var objects = {};
			for (let type of Zotero.DataObjectUtilities.getTypes()) {
				let obj = objects[type] = createUnsavedDataObject(type);
				obj.version = 5;
				obj.synced = true;
				yield obj.saveTx({ skipSyncedUpdate: true });
				
				yield Zotero.Sync.Data.Local.saveCacheObjects(
					type,
					userLibraryID,
					[
						{
							key: obj.key,
							version: obj.version,
							data: (yield obj.toJSON())
						}
					]
				);
			}
			
			var json;
			var headers = {
				"Last-Modified-Version": 5
			};
			setResponse({
				method: "GET",
				url: "users/1/settings",
				status: 200,
				headers: headers,
				json: {}
			});
			json = {};
			json[objects.collection.key] = 5;
			setResponse({
				method: "GET",
				url: "users/1/collections?format=versions",
				status: 200,
				headers: headers,
				json: json
			});
			json = {};
			json[objects.search.key] = 5;
			setResponse({
				method: "GET",
				url: "users/1/searches?format=versions",
				status: 200,
				headers: headers,
				json: json
			});
			json = {};
			json[objects.item.key] = 5;
			setResponse({
				method: "GET",
				url: "users/1/items?format=versions&includeTrashed=1",
				status: 200,
				headers: headers,
				json: json
			});
			setResponse({
				method: "GET",
				url: "users/1/deleted?since=0",
				status: 200,
				headers: headers,
				json: {}
			});
			
			yield engine._startDownload();
		})
		
		it("should apply remote deletions", function* () {
			var userLibraryID = Zotero.Libraries.userLibraryID;
			yield Zotero.Libraries.setVersion(userLibraryID, 5);
			({ engine, client, caller } = yield setup());
			
			// Create objects and mark them as synced
			yield Zotero.SyncedSettings.set(
				userLibraryID, 'tagColors', [{name: 'A', color: '#CC66CC'}], 1, true
			);
			var collection = createUnsavedDataObject('collection');
			collection.synced = true;
			var collectionID = yield collection.saveTx({ skipSyncedUpdate: true });
			var collectionKey = collection.key;
			var search = createUnsavedDataObject('search');
			search.synced = true;
			var searchID = yield search.saveTx({ skipSyncedUpdate: true });
			var searchKey = search.key;
			var item = createUnsavedDataObject('item');
			item.synced = true;
			var itemID = yield item.saveTx({ skipSyncedUpdate: true });
			var itemKey = item.key;
			
			var headers = {
				"Last-Modified-Version": 6
			};
			setResponse({
				method: "GET",
				url: "users/1/settings?since=5",
				status: 200,
				headers: headers,
				json: {}
			});
			setResponse({
				method: "GET",
				url: "users/1/collections?format=versions&since=5",
				status: 200,
				headers: headers,
				json: {}
			});
			setResponse({
				method: "GET",
				url: "users/1/searches?format=versions&since=5",
				status: 200,
				headers: headers,
				json: {}
			});
			setResponse({
				method: "GET",
				url: "users/1/items?format=versions&since=5&includeTrashed=1",
				status: 200,
				headers: headers,
				json: {}
			});
			setResponse({
				method: "GET",
				url: "users/1/deleted?since=5",
				status: 200,
				headers: headers,
				json: {
					settings: ['tagColors'],
					collections: [collection.key],
					searches: [search.key],
					items: [item.key]
				}
			});
			yield engine._startDownload();
			
			// Make sure objects were deleted
			assert.isFalse(yield Zotero.SyncedSettings.get(userLibraryID, 'tagColors'));
			assert.isFalse(Zotero.Collections.exists(collectionID));
			assert.isFalse(Zotero.Searches.exists(searchID));
			assert.isFalse(Zotero.Items.exists(itemID));
			
			// Make sure objects weren't added to sync delete log
			assert.isFalse(yield Zotero.Sync.Data.Local._objectInDeleteLog(
				'setting', userLibraryID, 'tagColors'
			));
			assert.isFalse(yield Zotero.Sync.Data.Local._objectInDeleteLog(
				'collection', userLibraryID, collectionKey
			));
			assert.isFalse(yield Zotero.Sync.Data.Local._objectInDeleteLog(
				'search', userLibraryID, searchKey
			));
			assert.isFalse(yield Zotero.Sync.Data.Local._objectInDeleteLog(
				'item', userLibraryID, itemKey
			));
		})
		
		it("should ignore remote deletions for non-item objects if local objects changed", function* () {
			var userLibraryID = Zotero.Libraries.userLibraryID;
			yield Zotero.Libraries.setVersion(userLibraryID, 5);
			({ engine, client, caller } = yield setup());
			
			// Create objects marked as unsynced
			yield Zotero.SyncedSettings.set(
				userLibraryID, 'tagColors', [{name: 'A', color: '#CC66CC'}]
			);
			var collection = createUnsavedDataObject('collection');
			var collectionID = yield collection.saveTx();
			var collectionKey = collection.key;
			var search = createUnsavedDataObject('search');
			var searchID = yield search.saveTx();
			var searchKey = search.key;
			
			var headers = {
				"Last-Modified-Version": 6
			};
			setResponse({
				method: "GET",
				url: "users/1/settings?since=5",
				status: 200,
				headers: headers,
				json: {}
			});
			setResponse({
				method: "GET",
				url: "users/1/collections?format=versions&since=5",
				status: 200,
				headers: headers,
				json: {}
			});
			setResponse({
				method: "GET",
				url: "users/1/searches?format=versions&since=5",
				status: 200,
				headers: headers,
				json: {}
			});
			setResponse({
				method: "GET",
				url: "users/1/items?format=versions&since=5&includeTrashed=1",
				status: 200,
				headers: headers,
				json: {}
			});
			setResponse({
				method: "GET",
				url: "users/1/deleted?since=5",
				status: 200,
				headers: headers,
				json: {
					settings: ['tagColors'],
					collections: [collection.key],
					searches: [search.key],
					items: []
				}
			});
			yield engine._startDownload();
			
			// Make sure objects weren't deleted
			assert.ok(yield Zotero.SyncedSettings.get(userLibraryID, 'tagColors'));
			assert.ok(Zotero.Collections.exists(collectionID));
			assert.ok(Zotero.Searches.exists(searchID));
		})
	})
	
	describe("#_upgradeCheck()", function () {
		it("should upgrade a library last synced with the classic sync architecture", function* () {
			var userLibraryID = Zotero.Libraries.userLibraryID;
			({ engine, client, caller } = yield setup());
			
			yield Zotero.Items.erase([1, 2], { skipDeleteLog: true });
			var types = Zotero.DataObjectUtilities.getTypes();
			var objects = {};
			
			// Create objects added before the last classic sync time,
			// which should end up marked as synced
			for (let type of types) {
				objects[type] = [yield createDataObject(type)];
			}
			
			var time1 = "2015-05-01 01:23:45";
			yield Zotero.DB.queryAsync("UPDATE collections SET clientDateModified=?", time1);
			yield Zotero.DB.queryAsync("UPDATE savedSearches SET clientDateModified=?", time1);
			yield Zotero.DB.queryAsync("UPDATE items SET clientDateModified=?", time1);
			
			// Create objects added after the last sync time, which should be ignored and
			// therefore end up marked as unsynced
			for (let type of types) {
				objects[type].push(yield createDataObject(type));
			}
			
			var objectJSON = {};
			for (let type of types) {
				objectJSON[type] = [];
			}
			
			// Create JSON for objects created remotely after the last sync time,
			// which should be ignored
			objectJSON.collection.push(makeCollectionJSON({
				key: Zotero.DataObjectUtilities.generateKey(),
				version: 20,
				name: Zotero.Utilities.randomString()
			}));
			objectJSON.search.push(makeSearchJSON({
				key: Zotero.DataObjectUtilities.generateKey(),
				version: 20,
				name: Zotero.Utilities.randomString()
			}));
			objectJSON.item.push(makeItemJSON({
				key: Zotero.DataObjectUtilities.generateKey(),
				version: 20,
				itemType: "book",
				title: Zotero.Utilities.randomString()
			}));
			
			var lastSyncTime = Zotero.Date.toUnixTimestamp(
				Zotero.Date.sqlToDate("2015-05-02 00:00:00", true)
			);
			yield Zotero.DB.queryAsync(
				"INSERT INTO version VALUES ('lastlocalsync', ?1), ('lastremotesync', ?1)",
				lastSyncTime
			);
			
			var headers = {
				"Last-Modified-Version": 20
			}
			for (let type of types) {
				var suffix = type == 'item' ? '&includeTrashed=1' : '';
				
				var json = {};
				json[objects[type][0].key] = 10;
				json[objectJSON[type][0].key] = objectJSON[type][0].version;
				setResponse({
					method: "GET",
					url: "users/1/" + Zotero.DataObjectUtilities.getObjectTypePlural(type)
						+ "?format=versions" + suffix,
					status: 200,
					headers: headers,
					json: json
				});
				json = {};
				json[objectJSON[type][0].key] = objectJSON[type][0].version;
				setResponse({
					method: "GET",
					url: "users/1/" + Zotero.DataObjectUtilities.getObjectTypePlural(type)
						+ "?format=versions&sincetime=" + lastSyncTime + suffix,
					status: 200,
					headers: headers,
					json: json
				});
			}
			var versionResults = yield engine._upgradeCheck();
			
			// Objects 1 should be marked as synced, with versions from the server
			// Objects 2 should be marked as unsynced
			for (let type of types) {
				var synced = yield Zotero.Sync.Data.Local.getSynced(userLibraryID, type);
				assert.deepEqual(synced, [objects[type][0].key]);
				assert.equal(objects[type][0].version, 10);
				var unsynced = yield Zotero.Sync.Data.Local.getUnsynced(userLibraryID, type);
				assert.deepEqual(unsynced, [objects[type][1].id]);
				
				assert.equal(versionResults[type].libraryVersion, headers["Last-Modified-Version"]);
				assert.property(versionResults[type].versions, objectJSON[type][0].key);
			}
			
			assert.equal(Zotero.Libraries.getVersion(userLibraryID), -1);
		})
	})
	
	describe("#_fullSync()", function () {
		it("should download missing/updated local objects and flag remotely missing local objects for upload", function* () {
			var userLibraryID = Zotero.Libraries.userLibraryID;
			({ engine, client, caller } = yield setup());
			
			yield Zotero.Items.erase([1, 2], { skipDeleteLog: true });
			var types = Zotero.DataObjectUtilities.getTypes();
			var objects = {};
			var objectJSON = {};
			for (let type of types) {
				objectJSON[type] = [];
			}
			
			for (let type of types) {
				// Create objects with outdated versions, which should be updated
				let obj = createUnsavedDataObject(type);
				obj.synced = true;
				obj.version = 5;
				yield obj.saveTx();
				objects[type] = [obj];
				
				objectJSON[type].push(makeJSONFunctions[type]({
					key: obj.key,
					version: 20,
					name: Zotero.Utilities.randomString()
				}));
				
				// Create JSON for objects that exist remotely and not locally,
				// which should be downloaded
				objectJSON[type].push(makeJSONFunctions[type]({
					key: Zotero.DataObjectUtilities.generateKey(),
					version: 20,
					name: Zotero.Utilities.randomString()
				}));
				
				// Create objects marked as synced that don't exist remotely,
				// which should be flagged for upload
				obj = createUnsavedDataObject(type);
				obj.synced = true;
				obj.version = 10;
				yield obj.saveTx();
				objects[type].push(obj);
			}
			
			var headers = {
				"Last-Modified-Version": 20
			}
			setResponse({
				method: "GET",
				url: "users/1/settings",
				status: 200,
				headers: headers,
				json: {
					tagColors: {
						value: [
							{
								name: "A",
								color: "#CC66CC"
							}
						],
						version: 2
					}
				}
			});
			for (let type of types) {
				var suffix = type == 'item' ? '&includeTrashed=1' : '';
				
				var json = {};
				json[objectJSON[type][0].key] = objectJSON[type][0].version;
				json[objectJSON[type][1].key] = objectJSON[type][1].version;
				setResponse({
					method: "GET",
					url: "users/1/" + Zotero.DataObjectUtilities.getObjectTypePlural(type)
						+ "?format=versions" + suffix,
					status: 200,
					headers: headers,
					json: json
				});
				
				setResponse({
					method: "GET",
					url: "users/1/" + Zotero.DataObjectUtilities.getObjectTypePlural(type)
						+ "?format=json"
						+ "&" + type + "Key=" + objectJSON[type][0].key + "%2C" + objectJSON[type][1].key
						+ suffix,
					status: 200,
					headers: headers,
					json: objectJSON[type]
				});
			}
			yield engine._fullSync();
			
			// Check settings
			var setting = yield Zotero.SyncedSettings.get(userLibraryID, "tagColors");
			assert.lengthOf(setting, 1);
			assert.equal(setting[0].name, 'A');
			var settingMetadata = yield Zotero.SyncedSettings.getMetadata(userLibraryID, "tagColors");
			assert.equal(settingMetadata.version, 2);
			assert.isTrue(settingMetadata.synced);
			
			// Check objects
			for (let type of types) {
				// Objects 1 should be updated with version from server
				assert.equal(objects[type][0].version, 20);
				assert.isTrue(objects[type][0].synced);
				
				// JSON objects 1 should be created locally with version from server
				let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
				let obj = objectsClass.getByLibraryAndKey(userLibraryID, objectJSON[type][0].key);
				assert.equal(obj.version, 20);
				assert.isTrue(obj.synced);
				
				// JSON objects 2 should be marked as unsynced, with their version reset to 0
				assert.equal(objects[type][1].version, 0);
				assert.isFalse(objects[type][1].synced);
			}
		})
	})
})
