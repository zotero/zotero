"use strict";

describe("Zotero.Sync.Storage.Mode.WebDAV", function () {
	//
	// Setup
	//
	Components.utils.import("resource://zotero-unit/httpd.js");
	
	var davScheme = "http";
	var davPort = 16214;
	var davBasePath = "/webdav/";
	var davHostPath = `localhost:${davPort}${davBasePath}`;
	var davUsername = "user";
	var davPassword = "password";
	var davURL = `${davScheme}://${davHostPath}`;
	
	var win, controller, server, requestCount;
	var responses = {};
	
	function setResponse(response) {
		setHTTPResponse(server, davURL, response, responses, davUsername, davPassword);
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
	
	function generateLastSyncID() {
		return "" + Zotero.Utilities.randomString(controller._lastSyncIDLength);
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
	
	beforeEach(function* () {
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		
		Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		server = sinon.fakeServer.create();
		server.autoRespond = true;
		
		this.httpd = new HttpServer();
		this.httpd.start(davPort);
		
		yield Zotero.Users.setCurrentUserID(1);
		yield Zotero.Users.setCurrentUsername("testuser");
		
		Zotero.Sync.Storage.Local.setModeForLibrary(Zotero.Libraries.userLibraryID, 'webdav');
		controller = new Zotero.Sync.Storage.Mode.WebDAV;
		controller.ERROR_DELAY_INTERVALS = [1];
		controller.ERROR_DELAY_MAX = [5];
		Zotero.Prefs.set("sync.storage.scheme", davScheme);
		Zotero.Prefs.set("sync.storage.url", davHostPath);
		Zotero.Prefs.set("sync.storage.username", davUsername);
		controller.password = davPassword;
		
		// Set download-on-sync by default
		Zotero.Sync.Storage.Local.downloadOnSync(
			Zotero.Libraries.userLibraryID, true
		);
	})
	
	var setup = Zotero.Promise.coroutine(function* (options = {}) {
		var engine = new Zotero.Sync.Storage.Engine({
			libraryID: options.libraryID || Zotero.Libraries.userLibraryID,
			controller,
			stopOnError: true
		});
		
		if (!controller.verified) {
			setResponse({
				method: "OPTIONS",
				url: "zotero/",
				headers: {
					DAV: 1
				},
				status: 200
			})
			setResponse({
				method: "PROPFIND",
				url: "zotero/",
				status: 207
			})
			setResponse({
				method: "PUT",
				url: "zotero/zotero-test-file.prop",
				status: 201
			})
			setResponse({
				method: "GET",
				url: "zotero/zotero-test-file.prop",
				status: 200
			})
			setResponse({
				method: "DELETE",
				url: "zotero/zotero-test-file.prop",
				status: 200
			})
			yield controller.checkServer();
			
			yield controller.cacheCredentials();
		}
		
		resetRequestCount();
		
		return engine;
	})
	
	afterEach(function* () {
		var defer = new Zotero.Promise.defer();
		this.httpd.stop(() => defer.resolve());
		yield defer.promise;
	})
	
	after(function* () {
		Zotero.HTTP.mock = null;
		if (win) {
			win.close();
		}
	})
	
	
	//
	// Tests
	//
	describe("Syncing", function () {
		beforeEach(function* () {
			win = yield loadZoteroPane();
		})
		
		afterEach(function () {
			win.close();
		})
		
		it("should skip downloads if not marked as needed", function* () {
			var engine = yield setup();
			
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
		
		it("should ignore a remotely missing file", function* () {
			var engine = yield setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			yield library.saveTx();
			library.storageDownloadNeeded = true;
			
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:test.txt';
			item.attachmentSyncState = "to_download";
			yield item.saveTx();
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 404
			});
			var result = yield engine.start();
			
			assertRequestCount(1);
			
			assert.isFalse(result.localChanges);
			assert.isFalse(result.remoteChanges);
			assert.isFalse(result.syncRequired);
			
			assert.isFalse(library.storageDownloadNeeded);
			assert.equal(library.storageVersion, library.libraryVersion);
		})
		
		it("should handle a remotely failing .prop file", function* () {
			var engine = yield setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			yield library.saveTx();
			library.storageDownloadNeeded = true;
			
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:test.txt';
			item.attachmentSyncState = "to_download";
			yield item.saveTx();
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 500
			});
			
			// TODO: In stopOnError mode, the promise is rejected.
			// This should probably test with stopOnError mode turned off instead.
			var e = yield getPromiseError(engine.start());
			assert.include(
				e.message,
				Zotero.getString('sync.storage.error.webdav.requestError', [500, "GET"])
			);
			
			assert.isAbove(
				server.requests.filter(r => r.responseHeaders["Fake-Server-Match"]).length - requestCount,
				1
			);
			
			assert.isTrue(library.storageDownloadNeeded);
			assert.equal(library.storageVersion, 0);
		})
		
		it("should handle a remotely failing .zip file", function* () {
			var engine = yield setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			yield library.saveTx();
			library.storageDownloadNeeded = true;
			
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:test.txt';
			item.attachmentSyncState = "to_download";
			yield item.saveTx();
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 200,
				text: '<properties version="1">'
					+ '<mtime>1234567890</mtime>'
					+ '<hash>8286300a280f64a4b5cfaac547c21d32</hash>'
					+ '</properties>'
			});
			this.httpd.registerPathHandler(
				`${davBasePath}zotero/${item.key}.zip`,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 500, null);
					}
				}
			);
			// TODO: In stopOnError mode, the promise is rejected.
			// This should probably test with stopOnError mode turned off instead.
			var e = yield getPromiseError(engine.start());
			assert.include(
				e.message,
				Zotero.getString('sync.storage.error.webdav.requestError', [500, "GET"])
			);
			
			assert.isTrue(library.storageDownloadNeeded);
			assert.equal(library.storageVersion, 0);
		})
		
		
		it("should download a missing file", function* () {
			var engine = yield setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			yield library.saveTx();
			library.storageDownloadNeeded = true;
			
			var fileName = "test.txt";
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:' + fileName;
			// TODO: Test binary data
			var text = Zotero.Utilities.randomString();
			item.attachmentSyncState = "to_download";
			yield item.saveTx();
			
			// Create ZIP file containing above text file
			var tmpPath = Zotero.getTempDirectory().path;
			var tmpID = "webdav_download_" + Zotero.Utilities.randomString();
			var zipDirPath = OS.Path.join(tmpPath, tmpID);
			var zipPath = OS.Path.join(tmpPath, tmpID + ".zip");
			yield OS.File.makeDir(zipDirPath);
			yield Zotero.File.putContentsAsync(OS.Path.join(zipDirPath, fileName), text);
			yield Zotero.File.zipDirectory(zipDirPath, zipPath);
			yield OS.File.removeDir(zipDirPath);
			yield Zotero.Promise.delay(1000);
			var zipContents = yield Zotero.File.getBinaryContentsAsync(zipPath);
			
			var mtime = "1441252524905";
			var md5 = yield Zotero.Utilities.Internal.md5Async(zipPath);
			
			yield OS.File.remove(zipPath);
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 200,
				text: '<properties version="1">'
					+ `<mtime>${mtime}</mtime>`
					+ `<hash>${md5}</hash>`
					+ '</properties>'
			});
			this.httpd.registerPathHandler(
				`${davBasePath}zotero/${item.key}.zip`,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, "OK");
						response.write(zipContents);
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
			var engine = yield setup();
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({ file });
			item.synced = true;
			yield item.saveTx();
			var mtime = yield item.attachmentModificationTime;
			var hash = yield item.attachmentHash;
			var path = item.getFilePath();
			var filename = 'test.png';
			var size = (yield OS.File.stat(path)).size;
			var contentType = 'image/png';
			var fileContents = yield Zotero.File.getContentsAsync(path);
			
			var deferreds = [];
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 404
			});
			// https://github.com/cjohansen/Sinon.JS/issues/607
			let fixSinonBug = ";charset=utf-8";
			server.respond(function (req) {
				if (req.username != davUsername) return;
				if (req.password != davPassword) return;
				
				if (req.method == "PUT" && req.url == `${davURL}zotero/${item.key}.zip`) {
					assert.equal(req.requestHeaders["Content-Type"], "application/zip" + fixSinonBug);
					
					let deferred = Zotero.Promise.defer();
					deferreds.push(deferred);
					var reader = new FileReader();
					reader.addEventListener("loadend", Zotero.Promise.coroutine(function* () {
						try {
							let tmpZipPath = OS.Path.join(
								Zotero.getTempDirectory().path,
								Zotero.Utilities.randomString() + '.zip'
							);
							let file = yield OS.File.open(tmpZipPath, {
								create: true
							});
							var contents = new Uint8Array(reader.result);
							yield file.write(contents);
							yield file.close();
							
							// Make sure ZIP file contains the necessary entries
							var zr = Components.classes["@mozilla.org/libjar/zip-reader;1"]
								.createInstance(Components.interfaces.nsIZipReader);
							zr.open(Zotero.File.pathToFile(tmpZipPath));
							zr.test(null);
							var entries = zr.findEntries('*');
							var entryNames = [];
							while (entries.hasMore()) {
								entryNames.push(entries.getNext());
							}
							assert.equal(entryNames.length, 1);
							assert.sameMembers(entryNames, [filename]);
							assert.equal(zr.getEntry(filename).realSize, size);
							
							yield OS.File.remove(tmpZipPath);
							
							deferred.resolve();
						}
						catch (e) {
							deferred.reject(e);
						}
					}));
					reader.readAsArrayBuffer(req.requestBody);
					
					req.respond(201, { "Fake-Server-Match": 1 }, "");
				}
				else if (req.method == "PUT" && req.url == `${davURL}zotero/${item.key}.prop`) {
					var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
						.createInstance(Components.interfaces.nsIDOMParser);
					var doc = parser.parseFromString(req.requestBody, "text/xml");
					assert.equal(
						doc.documentElement.getElementsByTagName('mtime')[0].textContent, mtime
					);
					assert.equal(
						doc.documentElement.getElementsByTagName('hash')[0].textContent, hash
					);
					
					req.respond(204, { "Fake-Server-Match": 1 }, "");
				}
			});
			
			var result = yield engine.start();
			
			yield Zotero.Promise.all(deferreds.map(d => d.promise));
			
			assertRequestCount(3);
			
			assert.isTrue(result.localChanges);
			assert.isTrue(result.remoteChanges);
			assert.isTrue(result.syncRequired);
			
			// Check local objects
			assert.equal(item.attachmentSyncedModificationTime, mtime);
			assert.equal(item.attachmentSyncedHash, hash);
			assert.isFalse(item.synced);
		})
		
		it("should upload an updated file", function* () {
			var engine = yield setup();
			
			var file = getTestDataDirectory();
			file.append('test.txt');
			var item = yield Zotero.Attachments.importFromFile({ file });
			item.synced = true;
			yield item.saveTx();
			
			var syncedModTime = Date.now() - 10000;
			var syncedHash = "3a2f092dd62178eb8bbfda42e07e64da";
			
			item.attachmentSyncedModificationTime = syncedModTime;
			item.attachmentSyncedHash = syncedHash;
			yield item.saveTx({ skipAll: true });
			
			var mtime = yield item.attachmentModificationTime;
			var hash = yield item.attachmentHash;
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				text: '<properties version="1">'
					+ `<mtime>${syncedModTime}</mtime>`
					+ `<hash>${syncedHash}</hash>`
					+ '</properties>'
			});
			setResponse({
				method: "DELETE",
				url: `zotero/${item.key}.prop`,
				status: 204
			});
			setResponse({
				method: "PUT",
				url: `zotero/${item.key}.zip`,
				status: 204
			});
			setResponse({
				method: "PUT",
				url: `zotero/${item.key}.prop`,
				status: 204
			});
			
			var result = yield engine.start();
			assertRequestCount(4);
			
			assert.isTrue(result.localChanges);
			assert.isTrue(result.remoteChanges);
			assert.isTrue(result.syncRequired);
			assert.isFalse(result.fileSyncRequired);
			
			// Check local objects
			assert.equal(item.attachmentSyncedModificationTime, mtime);
			assert.equal(item.attachmentSyncedHash, hash);
			assert.isFalse(item.synced);
		})
		
		it("should skip upload that already exists on the server", function* () {
			var engine = yield setup();
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({ file });
			item.synced = true;
			yield item.saveTx();
			var mtime = yield item.attachmentModificationTime;
			var hash = yield item.attachmentHash;
			var path = item.getFilePath();
			var filename = 'test.png';
			var size = (yield OS.File.stat(path)).size;
			var contentType = 'image/png';
			var fileContents = yield Zotero.File.getContentsAsync(path);
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 200,
				text: '<properties version="1">'
					+ `<mtime>${mtime}</mtime>`
					+ `<hash>${hash}</hash>`
					+ '</properties>'
			});
			
			var result = yield engine.start();
			
			assertRequestCount(1);
			
			assert.isFalse(result.localChanges);
			assert.isFalse(result.remoteChanges);
			assert.isFalse(result.syncRequired);
			
			// Check local object
			assert.equal(item.attachmentSyncedModificationTime, mtime);
			assert.equal(item.attachmentSyncedHash, hash);
			assert.isFalse(item.synced);
		})
		
		it("should mark item as in conflict if mod time and hash on storage server don't match synced values", function* () {
			var engine = yield setup();
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({ file });
			item.synced = true;
			yield item.saveTx();
			var mtime = yield item.attachmentModificationTime;
			var hash = yield item.attachmentHash;
			var path = item.getFilePath();
			var filename = 'test.png';
			var size = (yield OS.File.stat(path)).size;
			var contentType = 'image/png';
			var fileContents = yield Zotero.File.getContentsAsync(path);
			
			var newModTime = mtime + 5000;
			var newHash = "4f69f43d8ac8788190b13ff7f4a0a915";
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 200,
				text: '<properties version="1">'
					+ `<mtime>${newModTime}</mtime>`
					+ `<hash>${newHash}</hash>`
					+ '</properties>'
			});
			
			var result = yield engine.start();
			
			assertRequestCount(1);
			
			assert.isFalse(result.localChanges);
			assert.isFalse(result.remoteChanges);
			assert.isFalse(result.syncRequired);
			assert.isTrue(result.fileSyncRequired);
			
			// Check local object
			//
			// Item should be marked as in conflict
			assert.equal(item.attachmentSyncState, Zotero.Sync.Storage.Local.SYNC_STATE_IN_CONFLICT);
			// Synced mod time should have been changed, because that's what's shown in the
			// conflict dialog
			assert.equal(item.attachmentSyncedModificationTime, newModTime);
			assert.isTrue(item.synced);
		})
	});
	
	describe("Verify Server", function () {
		it("should show an error for a connection error", function* () {
			Zotero.HTTP.mock = null;
			Zotero.Prefs.set("sync.storage.url", "127.0.0.1:9999");
			
			// Begin install procedure
			var win = yield loadPrefPane('sync');
			var button = win.document.getElementById('storage-verify');
			
			var spy = sinon.spy(win.Zotero_Preferences.Sync, "verifyStorageServer");
			var promise1 = waitForDialog(function (dialog) {
				assert.include(
					dialog.document.documentElement.textContent,
					Zotero.getString('sync.storage.error.serverCouldNotBeReached', '127.0.0.1')
				);
			});
			button.click();
			yield promise1;
			
			var promise2 = spy.returnValues[0];
			spy.restore();
			yield promise2;
			
			win.close();
		});
		
		it("should show an error for a 403", function* () {
			Zotero.HTTP.mock = null;
			this.httpd.registerPathHandler(
				`${davBasePath}zotero/`,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 403, null);
					}
				}
			);
			
			// Use httpd.js instead of sinon so we get a real nsIURL with a channel
			Zotero.Prefs.set("sync.storage.url", davHostPath);
			
			// Begin install procedure
			var win = yield loadPrefPane('sync');
			var button = win.document.getElementById('storage-verify');
			
			var spy = sinon.spy(win.Zotero_Preferences.Sync, "verifyStorageServer");
			var promise1 = waitForDialog(function (dialog) {
				assert.include(
					dialog.document.documentElement.textContent,
					Zotero.getString('sync.storage.error.webdav.permissionDenied', davBasePath + 'zotero/')
				);
			});
			button.click();
			yield promise1;
			
			var promise2 = spy.returnValues[0];
			spy.restore();
			yield promise2;
			
			win.close();
		});
		
		
		it("should show an error for a 404 for the parent directory", function* () {
				// Use httpd.js instead of sinon so we get a real nsIURL with a channel
			Zotero.HTTP.mock = null;
			Zotero.Prefs.set("sync.storage.url", davHostPath);
			
			this.httpd.registerPathHandler(
				`${davBasePath}zotero/`,
				{
					handle: function (request, response) {
						// Force Basic Auth
						if (!request.hasHeader('Authorization')) {
							response.setStatusLine(null, 401, null);
							response.setHeader('WWW-Authenticate', 'Basic realm="WebDAV"', false);
							return;
						}
						response.setHeader('DAV', '1', false);
						response.setStatusLine(null, 404, "Not Found");
					}
				}
			);
			this.httpd.registerPathHandler(
				`${davBasePath}`,
				{
					handle: function (request, response) {
						response.setHeader('DAV', '1', false);
						if (request.method == 'PROPFIND') {
							response.setStatusLine(null, 404, null);
						}
						/*else {
							response.setStatusLine(null, 207, null);
						}*/
					}
				}
			);
			
			// Begin verify procedure
			var win = yield loadPrefPane('sync');
			var button = win.document.getElementById('storage-verify');
			
			var spy = sinon.spy(win.Zotero_Preferences.Sync, "verifyStorageServer");
			var promise1 = waitForDialog(function (dialog) {
				assert.include(
					dialog.document.documentElement.textContent,
					Zotero.getString('sync.storage.error.doesNotExist', davURL)
				);
			});
			button.click();
			yield promise1;
			
			var promise2 = spy.returnValues[0];
			spy.restore();
			yield promise2;
			
			win.close();
		});
		
		
		it("should show an error for a 200 for a nonexistent file", async function () {
			Zotero.HTTP.mock = null;
			this.httpd.registerPathHandler(
				`${davBasePath}zotero/`,
				{
					handle: function (request, response) {
						// Force Basic Auth
						if (!request.hasHeader('Authorization')) {
							response.setStatusLine(null, 401, null);
							response.setHeader('WWW-Authenticate', 'Basic realm="WebDAV"', false);
							return;
						}
						
						response.setHeader('DAV', '1', false);
						if (request.method == 'PROPFIND') {
							response.setStatusLine(null, 207, null);
						}
						else {
							response.setStatusLine(null, 200, null);
						}
					}
				}
			);
			this.httpd.registerPathHandler(
				`${davBasePath}zotero/nonexistent.prop`,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, null);
					}
				}
			);
			
			// Use httpd.js instead of sinon so we get a real nsIURL with a channel
			Zotero.Prefs.set("sync.storage.url", davHostPath);
			
			// Begin install procedure
			var win = await loadPrefPane('sync');
			var button = win.document.getElementById('storage-verify');
			
			var spy = sinon.spy(win.Zotero_Preferences.Sync, "verifyStorageServer");
			var promise1 = waitForDialog(function (dialog) {
				assert.include(
					dialog.document.documentElement.textContent,
					Zotero.getString('sync.storage.error.webdav.nonexistentFileNotMissing', davBasePath + 'zotero/')
				);
			});
			button.click();
			await promise1;
			
			var promise2 = spy.returnValues[0];
			spy.restore();
			await promise2;
			
			win.close();
		});
	});
	
	describe("#purgeDeletedStorageFiles()", function () {
		beforeEach(function () {
			resetRequestCount();
		})
		
		it("should delete files on storage server that were deleted locally", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = yield Zotero.Attachments.importFromFile({ file });
			item.synced = true;
			yield item.saveTx();
			yield item.eraseTx();
			
			assert.lengthOf((yield Zotero.Sync.Storage.Local.getDeletedFiles(libraryID)), 1);
			
			setResponse({
				method: "DELETE",
				url: `zotero/${item.key}.prop`,
				status: 204
			});
			setResponse({
				method: "DELETE",
				url: `zotero/${item.key}.zip`,
				status: 204
			});
			var results = yield controller.purgeDeletedStorageFiles(libraryID);
			assertRequestCount(2);
			
			assert.lengthOf(results.deleted, 2);
			assert.sameMembers(results.deleted, [`${item.key}.prop`, `${item.key}.zip`]);
			assert.lengthOf(results.missing, 0);
			assert.lengthOf(results.error, 0);
			
			// Storage delete log should be empty
			assert.lengthOf((yield Zotero.Sync.Storage.Local.getDeletedFiles(libraryID)), 0);
		})
	})
	
	describe("#purgeOrphanedStorageFiles()", function () {
		beforeEach(function () {
			resetRequestCount();
			Zotero.Prefs.clear('lastWebDAVOrphanPurge');
		})
		
		it("should delete orphaned files more than a week older than the last sync time", function* () {
			var library = Zotero.Libraries.userLibrary;
			library.updateLastSyncTime();
			yield library.saveTx();
			
			// Create one item
			var item1 = yield createDataObject('item');
			var item1Key = item1.key;
			// Add another item to sync queue
			var item2Key = Zotero.DataObjectUtilities.generateKey();
			yield Zotero.Sync.Data.Local.addObjectsToSyncQueue('item', library.id, [item2Key]);
			
			const daysBeforeSyncTime = 7;
			
			var beforeTime = new Date(Date.now() - (daysBeforeSyncTime * 86400 * 1000 + 1)).toUTCString();
			var currentTime = new Date(Date.now() - 3600000).toUTCString();
			
			setResponse({
				method: "PROPFIND",
				url: `zotero/`,
				status: 207,
				headers: {
					"Content-Type": 'text/xml; charset="utf-8"'
				},
				text: '<?xml version="1.0" encoding="utf-8"?>'
					+ '<D:multistatus xmlns:D="DAV:" xmlns:ns0="DAV:">'
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/lastsync.txt</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/lastsync</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/AAAAAAAA.zip</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/AAAAAAAA.prop</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/BBBBBBBB.zip</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${currentTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/BBBBBBBB.prop</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${currentTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						
						// Item that exists
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/${item1Key}.zip</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/${item1Key}.prop</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						
						// Item in sync queue
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/${item2Key}.zip</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/${item2Key}.prop</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
					+ '</D:multistatus>'
			});
			setResponse({
				method: "DELETE",
				url: 'zotero/AAAAAAAA.prop',
				status: 204
			});
			setResponse({
				method: "DELETE",
				url: 'zotero/AAAAAAAA.zip',
				status: 204
			});
			setResponse({
				method: "DELETE",
				url: 'zotero/lastsync.txt',
				status: 204
			});
			setResponse({
				method: "DELETE",
				url: 'zotero/lastsync',
				status: 204
			});
			
			var results = yield controller.purgeOrphanedStorageFiles();
			assertRequestCount(5);
			
			assert.sameMembers(results.deleted, ['lastsync.txt', 'lastsync', 'AAAAAAAA.prop', 'AAAAAAAA.zip']);
			assert.lengthOf(results.missing, 0);
			assert.lengthOf(results.error, 0);
		})
		
		it("shouldn't purge if purged recently", function* () {
			Zotero.Prefs.set("lastWebDAVOrphanPurge", Math.round(new Date().getTime() / 1000) - 3600);
			yield assert.eventually.equal(controller.purgeOrphanedStorageFiles(), false);
			assertRequestCount(0);
		});
		
		
		it("should handle unnormalized Unicode characters", function* () {
			var library = Zotero.Libraries.userLibrary;
			library.updateLastSyncTime();
			yield library.saveTx();
			
			const daysBeforeSyncTime = 7;
			
			var beforeTime = new Date(Date.now() - (daysBeforeSyncTime * 86400 * 1000 + 1)).toUTCString();
			var currentTime = new Date(Date.now() - 3600000).toUTCString();
			
			var strC = '\u1E9B\u0323';
			var encodedStrC = encodeURIComponent(strC);
			var strD = '\u1E9B\u0323'.normalize('NFD');
			var encodedStrD = encodeURIComponent(strD);
			
			setResponse({
				method: "PROPFIND",
				url: `${encodedStrC}/zotero/`,
				status: 207,
				headers: {
					"Content-Type": 'text/xml; charset="utf-8"'
				},
				text: '<?xml version="1.0" encoding="utf-8"?>'
					+ '<D:multistatus xmlns:D="DAV:" xmlns:ns0="DAV:">'
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}${encodedStrD}/zotero/</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}${encodedStrD}/zotero/lastsync</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}${encodedStrD}/zotero/AAAAAAAA.zip</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}${encodedStrD}/zotero/AAAAAAAA.prop</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
					+ '</D:multistatus>'
			});
			
			Zotero.Prefs.set("sync.storage.url", davHostPath + strC + "/");
			yield controller.purgeOrphanedStorageFiles();
		})
	})
})
