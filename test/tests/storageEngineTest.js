"use strict";

describe("Zotero.Sync.Storage.Engine", function () {
	Components.utils.import("resource://zotero-unit/httpd.js");
	
	var win;
	var apiKey = Zotero.Utilities.randomString(24);
	var port = 16213;
	var baseURL = `http://localhost:${port}/`;
	var server;
	
	var responses = {};
	
	var setup = Zotero.Promise.coroutine(function* (options = {}) {
		server = sinon.fakeServer.create();
		server.autoRespond = true;
		
		Components.utils.import("resource://zotero/concurrentCaller.js");
		var caller = new ConcurrentCaller(1);
		caller.setLogger(msg => Zotero.debug(msg));
		caller.stopOnError = true;
		
		Components.utils.import("resource://zotero/config.js");
		var client = new Zotero.Sync.APIClient({
			baseURL,
			apiVersion: options.apiVersion || ZOTERO_CONFIG.API_VERSION,
			apiKey,
			caller,
			background: options.background || true
		});
		
		var engine = new Zotero.Sync.Storage.Engine({
			apiClient: client,
			libraryID: options.libraryID || Zotero.Libraries.userLibraryID,
			stopOnError: true
		});
		
		return { engine, client, caller };
	});
	
	function setResponse(response) {
		setHTTPResponse(server, baseURL, response, responses);
	}
	
	function parseQueryString(str) {
		var queryStringParams = str.split('&');
		var params = {};
		for (let param of queryStringParams) {
			let [ key, val ] = param.split('=');
			params[key] = decodeURIComponent(val);
		}
		return params;
	}
	
	function assertAPIKey(request) {
		assert.equal(request.requestHeaders["Zotero-API-Key"], apiKey);
	}
	
	//
	// Tests
	//
	before(function* () {
	})
	beforeEach(function* () {
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		win = yield loadZoteroPane();
		
		Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		
		this.httpd = new HttpServer();
		this.httpd.start(port);
		
		yield Zotero.Users.setCurrentUserID(1);
		yield Zotero.Users.setCurrentUsername("testuser");
		
		// Set download-on-sync by default
		Zotero.Sync.Storage.Local.downloadOnSync(
			Zotero.Libraries.userLibraryID, true
		);
	})
	afterEach(function* () {
		var defer = new Zotero.Promise.defer();
		this.httpd.stop(() => defer.resolve());
		yield defer.promise;
		win.close();
	})
	after(function* () {
		this.timeout(60000);
		//yield resetDB();
		win.close();
	})
	
	
	describe("ZFS", function () {
		describe("Syncing", function () {
			it("should skip downloads if no last storage sync time", function* () {
				var { engine, client, caller } = yield setup();
				
				setResponse({
					method: "GET",
					url: "users/1/laststoragesync",
					status: 404
				});
				var result = yield engine.start();
				
				assert.isFalse(result.localChanges);
				assert.isFalse(result.remoteChanges);
				assert.isFalse(result.syncRequired);
				
				// Check last sync time
				assert.isFalse(Zotero.Libraries.userLibrary.lastStorageSync);
			})
			
			it("should skip downloads if unchanged last storage sync time", function* () {
				var { engine, client, caller } = yield setup();
				
				var newStorageSyncTime = Math.round(new Date().getTime() / 1000);
				var library = Zotero.Libraries.userLibrary;
				library.lastStorageSync = newStorageSyncTime;
				yield library.saveTx();
				setResponse({
					method: "GET",
					url: "users/1/laststoragesync",
					status: 200,
					text: "" + newStorageSyncTime
				});
				var result = yield engine.start();
				
				assert.isFalse(result.localChanges);
				assert.isFalse(result.remoteChanges);
				assert.isFalse(result.syncRequired);
				
				// Check last sync time
				assert.equal(library.lastStorageSync, newStorageSyncTime);
			})
			
			it("should ignore a remotely missing file", function* () {
				var { engine, client, caller } = yield setup();
				
				var item = new Zotero.Item("attachment");
				item.attachmentLinkMode = 'imported_file';
				item.attachmentPath = 'storage:test.txt';
				yield item.saveTx();
				yield Zotero.Sync.Storage.Local.setSyncState(
					item.id, Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD
				);
				
				var newStorageSyncTime = Math.round(new Date().getTime() / 1000);
				setResponse({
					method: "GET",
					url: "users/1/laststoragesync",
					status: 200,
					text: "" + newStorageSyncTime
				});
				this.httpd.registerPathHandler(
					`/users/1/items/${item.key}/file`,
					{
						handle: function (request, response) {
							response.setStatusLine(null, 404, null);
						}
					}
				);
				var result = yield engine.start();
				
				assert.isFalse(result.localChanges);
				assert.isFalse(result.remoteChanges);
				assert.isFalse(result.syncRequired);
				
				// Check last sync time
				assert.equal(Zotero.Libraries.userLibrary.lastStorageSync, newStorageSyncTime);
			})
			
			it("should handle a remotely failing file", function* () {
				var { engine, client, caller } = yield setup();
				
				var item = new Zotero.Item("attachment");
				item.attachmentLinkMode = 'imported_file';
				item.attachmentPath = 'storage:test.txt';
				yield item.saveTx();
				yield Zotero.Sync.Storage.Local.setSyncState(
					item.id, Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD
				);
				
				var newStorageSyncTime = Math.round(new Date().getTime() / 1000);
				setResponse({
					method: "GET",
					url: "users/1/laststoragesync",
					status: 200,
					text: "" + newStorageSyncTime
				});
				this.httpd.registerPathHandler(
					`/users/1/items/${item.key}/file`,
					{
						handle: function (request, response) {
							response.setStatusLine(null, 500, null);
						}
					}
				);
				// TODO: In stopOnError mode, this the promise is rejected.
				// This should probably test with stopOnError mode turned off instead.
				var e = yield getPromiseError(engine.start());
				assert.equal(e.message, Zotero.Sync.Storage.defaultError);
			})
			
			it("should download a missing file", function* () {
				var { engine, client, caller } = yield setup();
				
				var item = new Zotero.Item("attachment");
				item.attachmentLinkMode = 'imported_file';
				item.attachmentPath = 'storage:test.txt';
				// TODO: Test binary data
				var text = Zotero.Utilities.randomString();
				yield item.saveTx();
				yield Zotero.Sync.Storage.Local.setSyncState(
					item.id, Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD
				);
				
				var mtime = "1441252524905";
				var md5 = Zotero.Utilities.Internal.md5(text)
				
				var newStorageSyncTime = Math.round(new Date().getTime() / 1000);
				setResponse({
					method: "GET",
					url: "users/1/laststoragesync",
					status: 200,
					text: "" + newStorageSyncTime
				});
				var s3Path = `pretend-s3/${item.key}`;
				this.httpd.registerPathHandler(
					`/users/1/items/${item.key}/file`,
					{
						handle: function (request, response) {
							if (!request.hasHeader('Zotero-API-Key')) {
								response.setStatusLine(null, 403, "Forbidden");
								return;
							}
							var key = request.getHeader('Zotero-API-Key');
							if (key != apiKey) {
								response.setStatusLine(null, 403, "Invalid key");
								return;
							}
							response.setStatusLine(null, 302, "Found");
							response.setHeader("Zotero-File-Modification-Time", mtime, false);
							response.setHeader("Zotero-File-MD5", md5, false);
							response.setHeader("Zotero-File-Compressed", "No", false);
							response.setHeader("Location", baseURL + s3Path, false);
						}
					}
				);
				this.httpd.registerPathHandler(
					"/" + s3Path,
					{
						handle: function (request, response) {
							response.setStatusLine(null, 200, "OK");
							response.write(text);
						}
					}
				);
				var result = yield engine.start();
				
				assert.isTrue(result.localChanges);
				assert.isFalse(result.remoteChanges);
				assert.isFalse(result.syncRequired);
				
				// Check last sync time
				assert.equal(Zotero.Libraries.userLibrary.lastStorageSync, newStorageSyncTime);
				var contents = yield Zotero.File.getContentsAsync(yield item.getFilePathAsync());
				assert.equal(contents, text);
			})
			
			it("should upload new files", function* () {
				var { engine, client, caller } = yield setup();
				
				// Single file
				var file1 = getTestDataDirectory();
				file1.append('test.png');
				var item1 = yield Zotero.Attachments.importFromFile({ file: file1 });
				var mtime1 = yield item1.attachmentModificationTime;
				var hash1 = yield item1.attachmentHash;
				var path1 = item1.getFilePath();
				var filename1 = 'test.png';
				var size1 = (yield OS.File.stat(path1)).size;
				var contentType1 = 'image/png';
				var prefix1 = Zotero.Utilities.randomString();
				var suffix1 = Zotero.Utilities.randomString();
				var uploadKey1 = Zotero.Utilities.randomString(32, 'abcdef0123456789');
				
				// HTML file with auxiliary image
				var file2 = OS.Path.join(getTestDataDirectory().path, 'snapshot', 'index.html');
				var parentItem = yield createDataObject('item');
				var item2 = yield Zotero.Attachments.importSnapshotFromFile({
					file: file2,
					url: 'http://example.com/',
					parentItemID: parentItem.id,
					title: 'Test',
					contentType: 'text/html',
					charset: 'utf-8'
				});
				var mtime2 = yield item2.attachmentModificationTime;
				var hash2 = yield item2.attachmentHash;
				var path2 = item2.getFilePath();
				var filename2 = 'index.html';
				var size2 = (yield OS.File.stat(path2)).size;
				var contentType2 = 'text/html';
				var charset2 = 'utf-8';
				var prefix2 = Zotero.Utilities.randomString();
				var suffix2 = Zotero.Utilities.randomString();
				var uploadKey2 = Zotero.Utilities.randomString(32, 'abcdef0123456789');
				
				var deferreds = [];
				
				setResponse({
					method: "GET",
					url: "users/1/laststoragesync",
					status: 404
				});
				// https://github.com/cjohansen/Sinon.JS/issues/607
				let fixSinonBug = ";charset=utf-8";
				server.respond(function (req) {
					// Get upload authorization for single file
					if (req.method == "POST"
							&& req.url == `${baseURL}users/1/items/${item1.key}/file`
							&& req.requestBody.indexOf('upload=') == -1) {
						assertAPIKey(req);
						assert.equal(req.requestHeaders["If-None-Match"], "*");
						assert.equal(
							req.requestHeaders["Content-Type"],
							"application/x-www-form-urlencoded" + fixSinonBug
						);
						
						let parts = req.requestBody.split('&');
						let params = {};
						for (let part of parts) {
							let [key, val] = part.split('=');
							params[key] = decodeURIComponent(val);
						}
						assert.equal(params.md5, hash1);
						assert.equal(params.mtime, mtime1);
						assert.equal(params.filename, filename1);
						assert.equal(params.filesize, size1);
						assert.equal(params.contentType, contentType1);
						
						req.respond(
							200,
							{
								"Content-Type": "application/json"
							},
							JSON.stringify({
								url: baseURL + "pretend-s3/1",
								contentType: contentType1,
								prefix: prefix1,
								suffix: suffix1,
								uploadKey: uploadKey1
							})
						);
					}
					// Get upload authorization for multi-file zip
					else if (req.method == "POST"
							&& req.url == `${baseURL}users/1/items/${item2.key}/file`
							&& req.requestBody.indexOf('upload=') == -1) {
						assertAPIKey(req);
						assert.equal(req.requestHeaders["If-None-Match"], "*");
						assert.equal(
							req.requestHeaders["Content-Type"],
							"application/x-www-form-urlencoded" + fixSinonBug
						);
						
						// Verify ZIP hash
						let tmpZipPath = OS.Path.join(
							Zotero.getTempDirectory().path,
							item2.key + '.zip'
						);
						deferreds.push({
							promise: Zotero.Utilities.Internal.md5Async(tmpZipPath)
								.then(function (md5) {
									assert.equal(params.zipMD5, md5);
								})
						});
						
						let parts = req.requestBody.split('&');
						let params = {};
						for (let part of parts) {
							let [key, val] = part.split('=');
							params[key] = decodeURIComponent(val);
						}
						Zotero.debug(params);
						assert.equal(params.md5, hash2);
						assert.notEqual(params.zipMD5, hash2);
						assert.equal(params.mtime, mtime2);
						assert.equal(params.filename, filename2);
						assert.equal(params.zipFilename, item2.key + ".zip");
						assert.isTrue(parseInt(params.filesize) == params.filesize);
						assert.equal(params.contentType, contentType2);
						assert.equal(params.charset, charset2);
						
						req.respond(
							200,
							{
								"Content-Type": "application/json"
							},
							JSON.stringify({
								url: baseURL + "pretend-s3/2",
								contentType: 'application/zip',
								prefix: prefix2,
								suffix: suffix2,
								uploadKey: uploadKey2
							})
						);
					}
					// Upload single file to S3
					else if (req.method == "POST" && req.url == baseURL + "pretend-s3/1") {
						assert.equal(req.requestHeaders["Content-Type"], contentType1 + fixSinonBug);
						assert.equal(req.requestBody.size, (new Blob([prefix1, File(file1), suffix1]).size));
						req.respond(201, {}, "");
					}
					// Upload multi-file ZIP to S3
					else if (req.method == "POST" && req.url == baseURL + "pretend-s3/2") {
						assert.equal(req.requestHeaders["Content-Type"], "application/zip" + fixSinonBug);
						
						// Verify uploaded ZIP file
						let tmpZipPath = OS.Path.join(
							Zotero.getTempDirectory().path,
							Zotero.Utilities.randomString() + '.zip'
						);
						
						let deferred = Zotero.Promise.defer();
						deferreds.push(deferred);
						var reader = new FileReader();
						reader.addEventListener("loadend", Zotero.Promise.coroutine(function* () {
							try {
								
								let file = yield OS.File.open(tmpZipPath, {
									create: true
								});
								
								var contents = new Uint8Array(reader.result);
								contents = contents.slice(prefix2.length, suffix2.length * -1);
								yield file.write(contents);
								yield file.close();
								
								var zr = Components.classes["@mozilla.org/libjar/zip-reader;1"]
									.createInstance(Components.interfaces.nsIZipReader);
								zr.open(Zotero.File.pathToFile(tmpZipPath));
								zr.test(null);
								var entries = zr.findEntries('*');
								var entryNames = [];
								while (entries.hasMore()) {
									entryNames.push(entries.getNext());
								}
								assert.equal(entryNames.length, 2);
								assert.sameMembers(entryNames, ['index.html', 'img.gif']);
								assert.equal(zr.getEntry('index.html').realSize, size2);
								assert.equal(zr.getEntry('img.gif').realSize, 42);
								
								deferred.resolve();
							}
							catch (e) {
								deferred.reject(e);
							}
						}));
						reader.readAsArrayBuffer(req.requestBody);
						
						req.respond(201, {}, "");
					}
					// Register single-file upload
					else if (req.method == "POST"
							&& req.url == `${baseURL}users/1/items/${item1.key}/file`
							&& req.requestBody.indexOf('upload=') != -1) {
						assertAPIKey(req);
						assert.equal(req.requestHeaders["If-None-Match"], "*");
						assert.equal(
							req.requestHeaders["Content-Type"],
							"application/x-www-form-urlencoded" + fixSinonBug
						);
						
						let parts = req.requestBody.split('&');
						let params = {};
						for (let part of parts) {
							let [key, val] = part.split('=');
							params[key] = decodeURIComponent(val);
						}
						assert.equal(params.upload, uploadKey1);
						
						req.respond(
							204,
							{
								"Last-Modified-Version": 10
							},
							""
						);
					}
					// Register multi-file upload
					else if (req.method == "POST"
							&& req.url == `${baseURL}users/1/items/${item2.key}/file`
							&& req.requestBody.indexOf('upload=') != -1) {
						assertAPIKey(req);
						assert.equal(req.requestHeaders["If-None-Match"], "*");
						assert.equal(
							req.requestHeaders["Content-Type"],
							"application/x-www-form-urlencoded" + fixSinonBug
						);
						
						let parts = req.requestBody.split('&');
						let params = {};
						for (let part of parts) {
							let [key, val] = part.split('=');
							params[key] = decodeURIComponent(val);
						}
						assert.equal(params.upload, uploadKey2);
						
						req.respond(
							204,
							{
								"Last-Modified-Version": 15
							},
							""
						);
					}
				})
				var newStorageSyncTime = Math.round(new Date().getTime() / 1000);
				setResponse({
					method: "POST",
					url: "users/1/laststoragesync",
					status: 200,
					text: "" + newStorageSyncTime
				});
				
				// TODO: One-step uploads
				/*// https://github.com/cjohansen/Sinon.JS/issues/607
				let fixSinonBug = ";charset=utf-8";
				server.respond(function (req) {
					if (req.method == "POST" && req.url == `${baseURL}users/1/items/${item.key}/file`) {
						assert.equal(req.requestHeaders["If-None-Match"], "*");
						assert.equal(
							req.requestHeaders["Content-Type"],
							"application/json" + fixSinonBug
						);
						
						let params = JSON.parse(req.requestBody);
						assert.equal(params.md5, hash);
						assert.equal(params.mtime, mtime);
						assert.equal(params.filename, filename);
						assert.equal(params.size, size);
						assert.equal(params.contentType, contentType);
						
						req.respond(
							200,
							{
								"Content-Type": "application/json"
							},
							JSON.stringify({
								url: baseURL + "pretend-s3",
								headers: {
									"Content-Type": contentType,
									"Content-MD5": hash,
									//"Content-Length": params.size, process but don't return
									//"x-amz-meta-"
								},
								uploadKey
							})
						);
					}
					else if (req.method == "PUT" && req.url == baseURL + "pretend-s3") {
						assert.equal(req.requestHeaders["Content-Type"], contentType + fixSinonBug);
						assert.instanceOf(req.requestBody, File);
						req.respond(201, {}, "");
					}
				})*/
				var result = yield engine.start();
				
				yield Zotero.Promise.all(deferreds.map(d => d.promise));
				
				assert.isTrue(result.localChanges);
				assert.isTrue(result.remoteChanges);
				assert.isFalse(result.syncRequired);
				
				// Check local objects
				assert.equal((yield Zotero.Sync.Storage.Local.getSyncedModificationTime(item1.id)), mtime1);
				assert.equal((yield Zotero.Sync.Storage.Local.getSyncedHash(item1.id)), hash1);
				assert.equal(item1.version, 10);
				assert.equal((yield Zotero.Sync.Storage.Local.getSyncedModificationTime(item2.id)), mtime2);
				assert.equal((yield Zotero.Sync.Storage.Local.getSyncedHash(item2.id)), hash2);
				assert.equal(item2.version, 15);
				
				// Check last sync time
				assert.equal(Zotero.Libraries.userLibrary.lastStorageSync, newStorageSyncTime);
			})
			
			it("should update local info for file that already exists on the server", function* () {
				var { engine, client, caller } = yield setup();
				
				var file = getTestDataDirectory();
				file.append('test.png');
				var item = yield Zotero.Attachments.importFromFile({ file: file });
				item.version = 5;
				yield item.saveTx();
				var json = yield item.toJSON();
				yield Zotero.Sync.Data.Local.saveCacheObject('item', item.libraryID, json);
				
				var mtime = yield item.attachmentModificationTime;
				var hash = yield item.attachmentHash;
				var path = item.getFilePath();
				var filename = 'test.png';
				var size = (yield OS.File.stat(path)).size;
				var contentType = 'image/png';
				
				var newVersion = 10;
				setResponse({
					method: "POST",
					url: "users/1/laststoragesync",
					status: 200,
					text: "" + (Math.round(new Date().getTime() / 1000) - 50000)
				});
				// https://github.com/cjohansen/Sinon.JS/issues/607
				let fixSinonBug = ";charset=utf-8";
				server.respond(function (req) {
					// Get upload authorization for single file
					if (req.method == "POST"
							&& req.url == `${baseURL}users/1/items/${item.key}/file`
							&& req.requestBody.indexOf('upload=') == -1) {
						assertAPIKey(req);
						assert.equal(req.requestHeaders["If-None-Match"], "*");
						assert.equal(
							req.requestHeaders["Content-Type"],
							"application/x-www-form-urlencoded" + fixSinonBug
						);
						
						req.respond(
							200,
							{
								"Content-Type": "application/json",
								"Last-Modified-Version": newVersion
							},
							JSON.stringify({
								exists: 1,
							})
						);
					}
				})
				var newStorageSyncTime = Math.round(new Date().getTime() / 1000);
				setResponse({
					method: "POST",
					url: "users/1/laststoragesync",
					status: 200,
					text: "" + newStorageSyncTime
				});
				
				// TODO: One-step uploads
				var result = yield engine.start();
				
				assert.isTrue(result.localChanges);
				assert.isTrue(result.remoteChanges);
				assert.isFalse(result.syncRequired);
				
				// Check local objects
				assert.equal((yield Zotero.Sync.Storage.Local.getSyncedModificationTime(item.id)), mtime);
				assert.equal((yield Zotero.Sync.Storage.Local.getSyncedHash(item.id)), hash);
				assert.equal(item.version, newVersion);
				
				// Check last sync time
				assert.equal(Zotero.Libraries.userLibrary.lastStorageSync, newStorageSyncTime);
			})
		})
		
		describe("#_processUploadFile()", function () {
			it("should handle 412 with matching version and hash matching local file", function* () {
				var { engine, client, caller } = yield setup();
				var zfs = new Zotero.Sync.Storage.ZFS_Module({
					apiClient: client
				})
				
				var filePath = OS.Path.join(getTestDataDirectory().path, 'test.png');
				var item = yield Zotero.Attachments.importFromFile({ file: filePath });
				item.version = 5;
				item.synced = true;
				yield item.saveTx();
				
				var itemJSON = yield item.toResponseJSON();
				
				// Set saved hash to a different value, which should be overwritten
				//
				// We're also testing cases where a hash isn't set for a file (e.g., if the
				// storage directory was transferred, the mtime doesn't match, but the file was
				// never downloaded), but there's no difference in behavior
				var dbHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
				yield Zotero.DB.executeTransaction(function* () {
					yield Zotero.Sync.Storage.Local.setSyncedHash(item.id, dbHash)
				});
				
				server.respond(function (req) {
					if (req.method == "POST"
							&& req.url == `${baseURL}users/1/items/${item.key}/file`
							&& req.requestBody.indexOf('upload=') == -1
							&& req.requestHeaders["If-Match"] == dbHash) {
						req.respond(
							412,
							{
								"Content-Type": "application/json",
								"Last-Modified-Version": 5
							},
							"ETag does not match current version of file"
						);
					}
				})
				setResponse({
					method: "GET",
					url: `users/1/items?format=json&itemKey=${item.key}&includeTrashed=1`,
					status: 200,
					text: JSON.stringify([itemJSON])
				});
				
				var result = yield zfs._processUploadFile({
					name: item.libraryKey
				});
				yield assert.eventually.equal(
					Zotero.Sync.Storage.Local.getSyncedHash(item.id), itemJSON.data.md5
				);
				assert.isFalse(result.localChanges);
				assert.isFalse(result.remoteChanges);
				assert.isFalse(result.syncRequired);
				assert.isFalse(result.fileSyncRequired);
			})
			
			it("should handle 412 with matching version and hash not matching local file", function* () {
				var { engine, client, caller } = yield setup();
				var zfs = new Zotero.Sync.Storage.ZFS_Module({
					apiClient: client
				})
				
				var filePath = OS.Path.join(getTestDataDirectory().path, 'test.png');
				var item = yield Zotero.Attachments.importFromFile({ file: filePath });
				item.version = 5;
				item.synced = true;
				yield item.saveTx();
				
				var fileHash = yield item.attachmentHash;
				var itemJSON = yield item.toResponseJSON();
				itemJSON.data.md5 = 'aaaaaaaaaaaaaaaaaaaaaaaa'
				
				server.respond(function (req) {
					if (req.method == "POST"
							&& req.url == `${baseURL}users/1/items/${item.key}/file`
							&& req.requestBody.indexOf('upload=') == -1
							&& req.requestHeaders["If-None-Match"] == "*") {
						req.respond(
							412,
							{
								"Content-Type": "application/json",
								"Last-Modified-Version": 5
							},
							"If-None-Match: * set but file exists"
						);
					}
				})
				setResponse({
					method: "GET",
					url: `users/1/items?format=json&itemKey=${item.key}&includeTrashed=1`,
					status: 200,
					text: JSON.stringify([itemJSON])
				});
				
				var result = yield zfs._processUploadFile({
					name: item.libraryKey
				});
				yield assert.eventually.isNull(Zotero.Sync.Storage.Local.getSyncedHash(item.id));
				yield assert.eventually.equal(
					Zotero.Sync.Storage.Local.getSyncState(item.id),
					Zotero.Sync.Storage.SYNC_STATE_IN_CONFLICT
				);
				assert.isFalse(result.localChanges);
				assert.isFalse(result.remoteChanges);
				assert.isFalse(result.syncRequired);
				assert.isTrue(result.fileSyncRequired);
			})
			
			it("should handle 412 with greater version", function* () {
				var { engine, client, caller } = yield setup();
				var zfs = new Zotero.Sync.Storage.ZFS_Module({
					apiClient: client
				})
				
				var file = getTestDataDirectory();
				file.append('test.png');
				var item = yield Zotero.Attachments.importFromFile({ file });
				item.version = 5;
				item.synced = true;
				yield item.saveTx();
				
				server.respond(function (req) {
					if (req.method == "POST"
							&& req.url == `${baseURL}users/1/items/${item.key}/file`
							&& req.requestBody.indexOf('upload=') == -1
							&& req.requestHeaders["If-None-Match"] == "*") {
						req.respond(
							412,
							{
								"Content-Type": "application/json",
								"Last-Modified-Version": 10
							},
							"If-None-Match: * set but file exists"
						);
					}
				})
				
				var result = yield zfs._processUploadFile({
					name: item.libraryKey
				});
				assert.equal(item.version, 5);
				assert.equal(item.synced, true);
				assert.isFalse(result.localChanges);
				assert.isFalse(result.remoteChanges);
				assert.isTrue(result.syncRequired);
			})
		})
	})
})
