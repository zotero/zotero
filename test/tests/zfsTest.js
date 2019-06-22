"use strict";

describe("Zotero.Sync.Storage.Mode.ZFS", function () {
	//
	// Setup
	//
	Components.utils.import("resource://zotero-unit/httpd.js");
	
	var apiKey = Zotero.Utilities.randomString(24);
	var port = 16213;
	var baseURL = `http://localhost:${port}/`;
	
	var win, server, requestCount;
	var responses = {};
	
	function setResponse(response) {
		setHTTPResponse(server, baseURL, response, responses);
	}
	
	function resetRequestCount() {
		requestCount = server.requests.filter(r => r.responseHeaders["Fake-Server-Match"]).length;
	}
	
	function assertRequestCount(count) {
		assert.equal(
			server.requests.filter(r => r.responseHeaders["Fake-Server-Match"]).length - requestCount,
			count
		);
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
	beforeEach(function* () {
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		win = yield loadZoteroPane();
		
		Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		server = sinon.fakeServer.create();
		server.autoRespond = true;
		
		this.httpd = new HttpServer();
		this.httpd.start(port);
		
		yield Zotero.Users.setCurrentUserID(1);
		yield Zotero.Users.setCurrentUsername("testuser");
		
		Zotero.Sync.Storage.Local.setModeForLibrary(Zotero.Libraries.userLibraryID, 'zfs');
		
		// Set download-on-sync by default
		Zotero.Sync.Storage.Local.downloadOnSync(
			Zotero.Libraries.userLibraryID, true
		);
		
		resetRequestCount();
	})
	
	var setup = Zotero.Promise.coroutine(function* (options = {}) {
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
			libraryID: options.libraryID || Zotero.Libraries.userLibraryID,
			controller: new Zotero.Sync.Storage.Mode.ZFS({
				apiClient: client,
				maxS3ConsecutiveFailures: 2
			}),
			stopOnError: true
		});
		
		return { engine, client, caller };
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
	
	
	describe("Syncing", function () {
		it("should skip downloads if not marked as needed", function* () {
			var { engine, client, caller } = yield setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			yield library.saveTx();
			
			var result = yield engine.start();
			
			assertRequestCount(0);
			
			assert.isFalse(result.localChanges);
			assert.isFalse(result.remoteChanges);
			assert.isFalse(result.syncRequired);
			
			assert.equal(library.storageVersion, library.libraryVersion);
		})
		
		it("should ignore download for a remotely missing file", function* () {
			var { engine, client, caller } = yield setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			yield library.saveTx();
			library.storageDownloadNeeded = true;
			
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:test.txt';
			item.attachmentSyncState = "to_download";
			yield item.saveTx();
			
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
			
			assert.isFalse(library.storageDownloadNeeded);
			assert.equal(library.storageVersion, library.libraryVersion);
		})
		
		it("shouldn't update storageVersion if stopped", function* () {
			var { engine, client, caller } = yield setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			yield library.saveTx();
			library.storageDownloadNeeded = true;
			
			var items = [];
			for (let i = 0; i < 5; i++) {
				let item = new Zotero.Item("attachment");
				item.attachmentLinkMode = 'imported_file';
				item.attachmentPath = 'storage:test.txt';
				item.attachmentSyncState = "to_download";
				yield item.saveTx();
				items.push(item);
			}
			
			var call = 0;
			var stub = sinon.stub(engine.controller, 'downloadFile').callsFake(function () {
				call++;
				if (call == 1) {
					engine.stop();
				}
				return new Zotero.Sync.Storage.Result;
			});
			
			var result = yield engine.start();
			
			stub.restore();
			
			assert.equal(library.storageVersion, 0);
		});
		
		it("should handle a remotely failing file", function* () {
			var { engine, client, caller } = yield setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			yield library.saveTx();
			library.storageDownloadNeeded = true;
			
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:test.txt';
			item.attachmentSyncState = "to_download";
			yield item.saveTx();
			
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
			
			assert.isTrue(library.storageDownloadNeeded);
			assert.equal(library.storageVersion, 0);
		})
		
		it("should download a missing file", function* () {
			var { engine, client, caller } = yield setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			yield library.saveTx();
			library.storageDownloadNeeded = true;
			
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:test.txt';
			// TODO: Test binary data
			var text = Zotero.Utilities.randomString();
			item.attachmentSyncState = "to_download";
			yield item.saveTx();
			
			var mtime = "1441252524905";
			var md5 = Zotero.Utilities.Internal.md5(text)
			
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
			
			var contents = yield Zotero.File.getContentsAsync(yield item.getFilePathAsync());
			assert.equal(contents, text);
			
			assert.isFalse(library.storageDownloadNeeded);
			assert.equal(library.storageVersion, library.libraryVersion);
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
			
			let file1Blob = File.createFromFileName ? File.createFromFileName(file1.path) : new File(file1);
			if (file1Blob.then) {
				file1Blob = yield file1Blob;
			}
			
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
					assert.equal(
						req.requestBody.size,
						(new Blob(
							[
								prefix1,
								file1Blob,
								suffix1
							]
						).size)
					);
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
			assert.equal(item1.attachmentSyncedModificationTime, mtime1);
			assert.equal(item1.attachmentSyncedHash, hash1);
			assert.equal(item1.version, 10);
			assert.equal(item2.attachmentSyncedModificationTime, mtime2);
			assert.equal(item2.attachmentSyncedHash, hash2);
			assert.equal(item2.version, 15);
		})
		
		it("should update local info for remotely updated file that matches local file", function* () {
			var { engine, client, caller } = yield setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			yield library.saveTx();
			library.storageDownloadNeeded = true;
			
			var file = getTestDataDirectory();
			file.append('test.txt');
			var item = yield Zotero.Attachments.importFromFile({ file });
			item.version = 5;
			item.attachmentSyncState = "to_download";
			yield item.saveTx();
			var path = yield item.getFilePathAsync();
			yield OS.File.setDates(path, null, new Date() - 100000);
			
			var json = item.toJSON();
			yield Zotero.Sync.Data.Local.saveCacheObject('item', item.libraryID, json);
			
			var mtime = (Math.floor(new Date().getTime() / 1000) * 1000) + "";
			var md5 = Zotero.Utilities.Internal.md5(file)
			
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
			var result = yield engine.start();
			
			assert.equal(item.attachmentSyncedModificationTime, mtime);
			yield assert.eventually.equal(item.attachmentModificationTime, mtime);
			assert.isTrue(result.localChanges);
			assert.isFalse(result.remoteChanges);
			assert.isFalse(result.syncRequired);
		})
		
		it("should update local info for file that already exists on the server", function* () {
			var { engine, client, caller } = yield setup();
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({ file: file });
			item.version = 5;
			yield item.saveTx();
			var json = item.toJSON();
			yield Zotero.Sync.Data.Local.saveCacheObject('item', item.libraryID, json);
			
			var mtime = yield item.attachmentModificationTime;
			var hash = yield item.attachmentHash;
			var path = item.getFilePath();
			var filename = 'test.png';
			var size = (yield OS.File.stat(path)).size;
			var contentType = 'image/png';
			
			var newVersion = 10;
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
			
			// TODO: One-step uploads
			var result = yield engine.start();
			
			assert.isTrue(result.localChanges);
			assert.isTrue(result.remoteChanges);
			assert.isFalse(result.syncRequired);
			
			// Check local objects
			assert.equal(item.attachmentSyncedModificationTime, mtime);
			assert.equal(item.attachmentSyncedHash, hash);
			assert.equal(item.version, newVersion);
		})
		
		
		it("should retry with If-None-Match on 412 with missing remote hash", function* () {
			var { engine, client, caller } = yield setup();
			var zfs = new Zotero.Sync.Storage.Mode.ZFS({
				apiClient: client
			})
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({ file });
			item.version = 5;
			item.synced = true;
			item.attachmentSyncedModificationTime = Date.now();
			item.attachmentSyncedHash = 'bd4c33e03798a7e8bc0b46f8bda74fac'
			yield item.saveTx();
			
			var contentType = 'image/png';
			var prefix = Zotero.Utilities.randomString();
			var suffix = Zotero.Utilities.randomString();
			var uploadKey = Zotero.Utilities.randomString(32, 'abcdef0123456789');
			
			var called = 0;
			// https://github.com/cjohansen/Sinon.JS/issues/607
			let fixSinonBug = ";charset=utf-8";
			server.respond(function (req) {
				// Try with If-Match
				if (req.method == "POST"
						&& req.url == `${baseURL}users/1/items/${item.key}/file`
						&& !req.requestBody.includes('upload=')
						&& req.requestHeaders["If-Match"] == item.attachmentSyncedHash) {
					called++;
					req.respond(
						412,
						{
							"Content-Type": "application/json"
						},
						"If-Match set but file does not exist"
					);
				}
				// Retry with If-None-Match
				else if (req.method == "POST"
						&& req.url == `${baseURL}users/1/items/${item.key}/file`
						&& !req.requestBody.includes('upload=')
						&& req.requestHeaders["If-None-Match"] == "*") {
					assert.equal(called++, 1);
					req.respond(
						200,
						{
							"Content-Type": "application/json"
						},
						JSON.stringify({
							url: baseURL + "pretend-s3/1",
							contentType: contentType,
							prefix: prefix,
							suffix: suffix,
							uploadKey: uploadKey
						})
					);
				}
				// Upload file to S3
				else if (req.method == "POST" && req.url == baseURL + "pretend-s3/1") {
					assert.equal(called++, 2);
					req.respond(201, {}, "");
				}
				// Use If-None-Match when registering upload
				else if (req.method == "POST"
						&& req.url == `${baseURL}users/1/items/${item.key}/file`
						&& req.requestBody.includes('upload=')) {
					assert.equal(called++, 3);
					assert.equal(req.requestHeaders["If-None-Match"], "*");
					req.respond(
						204,
						{
							"Last-Modified-Version": 10
						},
						""
					);
				}
			});
			
			var result = yield engine.start();
			assert.equal(called, 4);
		});
	})
	
	
	describe("#_processUploadFile()", function () {
		it("should handle 404 from upload authorization request", function* () {
			var { engine, client, caller } = yield setup();
			var zfs = new Zotero.Sync.Storage.Mode.ZFS({
				apiClient: client
			})
			
			var filePath = OS.Path.join(getTestDataDirectory().path, 'test.png');
			var item = yield Zotero.Attachments.importFromFile({ file: filePath });
			item.version = 5;
			item.synced = true;
			yield item.saveTx();
			
			var itemJSON = item.toResponseJSON();
			itemJSON.data.mtime = yield item.attachmentModificationTime;
			itemJSON.data.md5 = yield item.attachmentHash;
			
			server.respond(function (req) {
				if (req.method == "POST"
						&& req.url == `${baseURL}users/1/items/${item.key}/file`
						&& !req.requestBody.includes('upload=')) {
					req.respond(
						404,
						{
							"Last-Modified-Version": 5
						},
						"Not Found"
					);
				}
			})
			
			var result = yield zfs._processUploadFile({
				name: item.libraryKey
			});
			assert.isTrue(result.syncRequired);
		});
		
		it("should handle 412 with matching version and hash matching local file", function* () {
			var { engine, client, caller } = yield setup();
			var zfs = new Zotero.Sync.Storage.Mode.ZFS({
				apiClient: client
			})
			
			var filePath = OS.Path.join(getTestDataDirectory().path, 'test.png');
			var item = yield Zotero.Attachments.importFromFile({ file: filePath });
			item.version = 5;
			item.synced = true;
			yield item.saveTx();
			
			var itemJSON = item.toResponseJSON();
			itemJSON.data.mtime = yield item.attachmentModificationTime;
			itemJSON.data.md5 = yield item.attachmentHash;
			
			// Set saved hash to a different value, which should be overwritten
			//
			// We're also testing cases where a hash isn't set for a file (e.g., if the
			// storage directory was transferred, the mtime doesn't match, but the file was
			// never downloaded), but there's no difference in behavior
			var dbHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
			item.attachmentSyncedHash = dbHash;
			yield item.saveTx({ skipAll: true });
			
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
			assert.equal(item.attachmentSyncedHash, (yield item.attachmentHash));
			assert.isFalse(result.localChanges);
			assert.isFalse(result.remoteChanges);
			assert.isFalse(result.syncRequired);
			assert.isFalse(result.fileSyncRequired);
		})
		
		it("should handle 412 with matching version and hash not matching local file", function* () {
			var { engine, client, caller } = yield setup();
			var zfs = new Zotero.Sync.Storage.Mode.ZFS({
				apiClient: client
			})
			
			var filePath = OS.Path.join(getTestDataDirectory().path, 'test.png');
			var item = yield Zotero.Attachments.importFromFile({ file: filePath });
			item.version = 5;
			item.synced = true;
			yield item.saveTx();
			
			var fileHash = yield item.attachmentHash;
			var itemJSON = item.toResponseJSON();
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
			assert.isNull(item.attachmentSyncedHash);
			assert.equal(item.attachmentSyncState, Zotero.Sync.Storage.Local.SYNC_STATE_IN_CONFLICT);
			assert.isFalse(result.localChanges);
			assert.isFalse(result.remoteChanges);
			assert.isFalse(result.syncRequired);
			assert.isTrue(result.fileSyncRequired);
		})
		
		it("should handle 412 with greater version", function* () {
			var { engine, client, caller } = yield setup();
			var zfs = new Zotero.Sync.Storage.Mode.ZFS({
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
		});
		
		
		it("should handle 413 on quota limit", function* () {
			var { engine, client, caller } = yield setup();
			var zfs = new Zotero.Sync.Storage.Mode.ZFS({
				apiClient: client
			})
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({ file });
			item.version = 5;
			item.synced = true;
			yield item.saveTx();
			
			var responses = 0;
			server.respond(function (req) {
				if (req.method == "POST"
						&& req.url == `${baseURL}users/1/items/${item.key}/file`
						&& req.requestBody.indexOf('upload=') == -1
						&& req.requestHeaders["If-None-Match"] == "*") {
					responses++;
					req.respond(
						413,
						{
							"Content-Type": "application/json",
							"Last-Modified-Version": 10,
							"Zotero-Storage-Usage": "300",
							"Zotero-Storage-Quota": "300"
						},
						"File would exceed quota (299.7 + 0.5 &gt; 300)"
					);
				}
			})
			
			var e = yield getPromiseError(zfs._processUploadFile({
				name: item.libraryKey
			}));
			assert.ok(e);
			assert.equal(e.errorType, 'warning');
			assert.include(e.message, 'test.png');
			assert.equal(e.dialogButtonText, Zotero.getString('sync.storage.openAccountSettings'));
			assert.equal(responses, 1);
			
			// Try again
			var e = yield getPromiseError(zfs.uploadFile({
				name: item.libraryKey
			}));
			assert.ok(e);
			assert.equal(e.errorType, 'warning');
			assert.include(e.message, 'test.png');
			assert.equal(e.dialogButtonText, Zotero.getString('sync.storage.openAccountSettings'));
			// Shouldn't have been another request. A manual sync resets the flag, but we're not
			// testing that here.
			assert.equal(responses, 1);
		})
	})
})
