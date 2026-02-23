"use strict";

describe("Zotero.Sync.Storage.Mode.WebDAV", function () {
	//
	// Setup
	//
	const davScheme = "http";
	const davBasePath = "/webdav/";
	const davUsername = "user";
	const davPassword = "password";
	
	var win, controller, httpd, davHostPath, davURL;
	var requestCount = 0;
	var registeredPaths = new Set();
	// Map of path -> { method -> handler }
	var pathHandlers = {};
	
	/**
	 * Check Basic Auth credentials from request
	 */
	function checkBasicAuth(request) {
		if (!request.hasHeader('Authorization')) {
			return false;
		}
		let auth = request.getHeader('Authorization');
		let expected = 'Basic ' + btoa(davUsername + ':' + davPassword);
		return auth == expected;
	}
	
	/**
	 * Send 401 response requiring Basic Auth
	 */
	function send401(response) {
		response.setStatusLine(null, 401, "Unauthorized");
		response.setHeader('WWW-Authenticate', 'Basic realm="WebDAV"', false);
	}
	
	/**
	 * Register an httpd handler for a given method/path with optional auth
	 */
	function setResponse(options) {
		let { method, url, status = 200, text = "", headers = {}, handler } = options;
		let path = `${davBasePath}${url}`;
		
		// Store the handler info for this method
		if (!pathHandlers[path]) {
			pathHandlers[path] = {};
		}
		if (pathHandlers[path][method]) {
			throw new Error(`Handler for ${method} ${path} already registered`);
		}
		pathHandlers[path][method] = { status, text, headers, handler };
		
		// Only register the path handler once -- additional methods on the same path
		// reuse the existing handler, which dispatches by method
		if (registeredPaths.has(path)) {
			return;
		}
		registeredPaths.add(path);
		
		httpd.registerPathHandler(path, {
			handle: function (request, response) {
				// Always handle OPTIONS with auth (for checkServer calls)
				if (request.method == 'OPTIONS') {
					if (!checkBasicAuth(request)) {
						send401(response);
						return;
					}
					response.setHeader('DAV', '1', false);
					response.setStatusLine(null, 200, "OK");
					return;
				}

				// Handle PROPFIND with auth (for cacheCredentials() calls) unless a
				// custom handler is registered
				if (request.method == 'PROPFIND' && !pathHandlers[path]?.PROPFIND) {
					if (!checkBasicAuth(request)) {
						send401(response);
						return;
					}
					response.setHeader('Content-Type', 'text/xml; charset="utf-8"', false);
					response.setStatusLine(null, 207, "Multi-Status");
					response.write('<?xml version="1.0" encoding="utf-8"?>'
						+ '<D:multistatus xmlns:D="DAV:">'
						+ '<D:response>'
						+ `<D:href>${path}</D:href>`
						+ '<D:propstat>'
						+ '<D:prop><D:getcontentlength/></D:prop>'
						+ '<D:status>HTTP/1.1 200 OK</D:status>'
						+ '</D:propstat>'
						+ '</D:response>'
						+ '</D:multistatus>');
					return;
				}

				let methodHandlers = pathHandlers[path];
				let methodHandler = methodHandlers && methodHandlers[request.method];
				
				if (!methodHandler) {
					// No handler for this method -- return 405
					response.setStatusLine(null, 405, "Method Not Allowed");
					return;
				}
				
				// If Authorization not present, send 401 to trigger retry
				if (!checkBasicAuth(request)) {
					send401(response);
					return;
				}
				
				requestCount++;
				
				// Custom handler takes precedence
				if (methodHandler.handler) {
					methodHandler.handler(request, response);
					return;
				}
				
				// Set status
				response.setStatusLine(null, methodHandler.status, null);
				
				// Set headers
				for (let [key, value] of Object.entries(methodHandler.headers)) {
					response.setHeader(key, String(value), false);
				}
				
				// Write body
				if (methodHandler.text) {
					response.write(methodHandler.text);
				}
			}
		});
	}
	
	function resetRequestCount() {
		requestCount = 0;
	}
	
	function assertRequestCount(count) {
		assert.equal(requestCount, count);
	}
	
	/**
	 * Unregister all handlers registered via setResponse
	 */
	function clearRegisteredPaths() {
		for (let path of registeredPaths) {
			try {
				httpd.registerPathHandler(path, null);
			}
			catch (e) {
				// Ignore errors from unregistering paths that weren't registered
			}
		}
		registeredPaths = new Set();
		pathHandlers = {};
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
	
	beforeEach(async function () {
		await resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		
		var port;
		({ httpd, port } = await startHTTPServer());
		davHostPath = `localhost:${port}${davBasePath}`;
		davURL = `${davScheme}://${davHostPath}`;
		
		await Zotero.Users.setCurrentUserID(1);
		await Zotero.Users.setCurrentUsername("testuser");
		
		Zotero.Sync.Storage.Local.setModeForLibrary(Zotero.Libraries.userLibraryID, 'webdav');
		controller = new Zotero.Sync.Storage.Mode.WebDAV;
		controller.ERROR_DELAY_INTERVALS = [1];
		controller.ERROR_DELAY_MAX = [5];
		Zotero.Prefs.set("sync.storage.scheme", davScheme);
		Zotero.Prefs.set("sync.storage.url", davHostPath);
		Zotero.Prefs.set("sync.storage.username", davUsername);
		await controller.setPassword(davPassword);
		
		// Set download-on-sync by default
		Zotero.Sync.Storage.Local.downloadOnSync(
			Zotero.Libraries.userLibraryID, true
		);
	})
	
	var setup = async function (options = {}) {
		var engine = new Zotero.Sync.Storage.Engine({
			libraryID: options.libraryID || Zotero.Libraries.userLibraryID,
			controller,
			stopOnError: true
		});
		
		if (!controller.verified) {
			// Register handlers for server verification
			setResponse({
				method: "PROPFIND",
				url: "zotero/",
				status: 207
			});
			setResponse({
				method: "PUT",
				url: "zotero/zotero-test-file.prop",
				status: 201
			});
			setResponse({
				method: "GET",
				url: "zotero/zotero-test-file.prop",
				status: 200
			});
			setResponse({
				method: "DELETE",
				url: "zotero/zotero-test-file.prop",
				status: 200
			});
			await controller.checkServer();
			
			await controller.cacheCredentials();
		}
		
		resetRequestCount();
		
		return engine;
	}
	
	afterEach(async function () {
		clearRegisteredPaths();
		await new Promise(request => httpd.stop(request));
	})
	
	after(function () {
		if (win) {
			win.close();
		}
	})
	
	
	//
	// Tests
	//
	describe("Syncing", function () {
		it("should skip downloads if not marked as needed", async function () {
			var engine = await setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			await library.saveTx();
			
			var result = await engine.start();
			
			assertRequestCount(0);
			
			assert.isFalse(result.localChanges);
			assert.isFalse(result.remoteChanges);
			assert.isFalse(result.syncRequired);
			
			assert.equal(library.storageVersion, library.libraryVersion);
		})
		
		it("should ignore a remotely missing file", async function () {
			var engine = await setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			await library.saveTx();
			library.storageDownloadNeeded = true;
			
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:test.txt';
			item.attachmentSyncState = "to_download";
			await item.saveTx();
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 404
			});
			var result = await engine.start();
			
			assertRequestCount(1);
			
			assert.isFalse(result.localChanges);
			assert.isFalse(result.remoteChanges);
			assert.isFalse(result.syncRequired);
			
			assert.isFalse(library.storageDownloadNeeded);
			assert.equal(library.storageVersion, library.libraryVersion);
			assert.equal(
				item.attachmentSyncState,
				Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC
			);
		})
		
		it("should handle a remotely failing .prop file", async function () {
			var engine = await setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			await library.saveTx();
			library.storageDownloadNeeded = true;
			
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:test.txt';
			item.attachmentSyncState = "to_download";
			await item.saveTx();
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 500
			});
			
			// TODO: In stopOnError mode, the promise is rejected.
			// This should probably test with stopOnError mode turned off instead.
			var e = await getPromiseError(engine.start());
			assert.include(
				e.message,
				Zotero.getString('sync.storage.error.webdav.requestError', [500, "GET"])
			);
			
			assert.isAbove(requestCount, 1);
			
			assert.isTrue(library.storageDownloadNeeded);
			assert.equal(library.storageVersion, 0);
		})
		
		it("should handle a remotely failing .zip file", async function () {
			var engine = await setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			await library.saveTx();
			library.storageDownloadNeeded = true;
			
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:test.txt';
			item.attachmentSyncState = "to_download";
			await item.saveTx();
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 200,
				text: '<properties version="1">'
					+ '<mtime>1234567890</mtime>'
					+ '<hash>8286300a280f64a4b5cfaac547c21d32</hash>'
					+ '</properties>'
			});
			httpd.registerPathHandler(
				`${davBasePath}zotero/${item.key}.zip`,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 500, null);
					}
				}
			);
			// TODO: In stopOnError mode, the promise is rejected.
			// This should probably test with stopOnError mode turned off instead.
			var e = await getPromiseError(engine.start());
			assert.include(
				e.message,
				Zotero.getString('sync.storage.error.webdav.requestError', [500, "GET"])
			);
			
			assert.isTrue(library.storageDownloadNeeded);
			assert.equal(library.storageVersion, 0);
		})
		
		
		it("should download a missing file", async function () {
			var engine = await setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			await library.saveTx();
			library.storageDownloadNeeded = true;
			
			var fileName = "test.txt";
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:' + fileName;
			// TODO: Test binary data
			var text = Zotero.Utilities.randomString();
			item.attachmentSyncState = "to_download";
			await item.saveTx();
			
			// Create ZIP file containing above text file
			var tmpPath = Zotero.getTempDirectory().path;
			var tmpID = "webdav_download_" + Zotero.Utilities.randomString();
			var zipDirPath = OS.Path.join(tmpPath, tmpID);
			var zipPath = OS.Path.join(tmpPath, tmpID + ".zip");
			await OS.File.makeDir(zipDirPath);
			await Zotero.File.putContentsAsync(OS.Path.join(zipDirPath, fileName), text);
			await Zotero.File.zipDirectory(zipDirPath, zipPath);
			await OS.File.removeDir(zipDirPath);
			await Zotero.Promise.delay(1000);
			var zipContents = await Zotero.File.getBinaryContentsAsync(zipPath);
			
			var mtime = "1441252524905";
			var md5 = await Zotero.Utilities.Internal.md5Async(zipPath);
			
			await OS.File.remove(zipPath);
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 200,
				text: '<properties version="1">'
					+ `<mtime>${mtime}</mtime>`
					+ `<hash>${md5}</hash>`
					+ '</properties>'
			});
			httpd.registerPathHandler(
				`${davBasePath}zotero/${item.key}.zip`,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, "OK");
						response.write(zipContents);
					}
				}
			);
			
			var result = await engine.start();
			
			assert.isTrue(result.localChanges);
			assert.isFalse(result.remoteChanges);
			assert.isFalse(result.syncRequired);
			
			var contents = await Zotero.File.getContentsAsync(await item.getFilePathAsync());
			assert.equal(contents, text);
			
			assert.isFalse(library.storageDownloadNeeded);
			assert.equal(library.storageVersion, library.libraryVersion);
		})
		
		it("should upload new files", async function () {
			var engine = await setup();
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = await Zotero.Attachments.importFromFile({ file });
			item.synced = true;
			await item.saveTx();
			var mtime = await item.attachmentModificationTime;
			var hash = await item.attachmentHash;
			var path = item.getFilePath();
			var filename = 'test.png';
			var size = ((await OS.File.stat(path))).size;
			var contentType = 'image/png';
			var fileContents = await Zotero.File.getContentsAsync(path);
			
			var zipVerifyDeferred = Zotero.Promise.defer();
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 404
			});
			
			// Handler for PUT .zip
			httpd.registerPathHandler(
				`${davBasePath}zotero/${item.key}.zip`,
				{
					handle: function (request, response) {
						if (request.method !== 'PUT') return;
						if (!checkBasicAuth(request)) {
							send401(response);
							return;
						}
						requestCount++;
						
						// Read request body and verify it's a valid ZIP
						let start = async () => {
							try {
								let bodyStream = request.bodyInputStream;
								let bis = Cc["@mozilla.org/binaryinputstream;1"]
									.createInstance(Ci.nsIBinaryInputStream);
								bis.setInputStream(bodyStream);
								let bytes = bis.readByteArray(bis.available());
								bis.close();
								
								let tmpZipPath = OS.Path.join(
									Zotero.getTempDirectory().path,
									Zotero.Utilities.randomString() + '.zip'
								);
								await IOUtils.write(tmpZipPath, new Uint8Array(bytes));
								
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
								
								await OS.File.remove(tmpZipPath);
								
								zipVerifyDeferred.resolve();
							}
							catch (e) {
								zipVerifyDeferred.reject(e);
							}
						};
						start();
						
						response.setStatusLine(null, 201, null);
					}
				}
			);
			
			// Handler for PUT .prop
			setResponse({
				method: "PUT",
				url: `zotero/${item.key}.prop`,
				handler: function (request, response) {
					// Read and verify request body
					let bodyStream = request.bodyInputStream;
					let sis = Cc["@mozilla.org/scriptableinputstream;1"]
						.createInstance(Ci.nsIScriptableInputStream);
					sis.init(bodyStream);
					let body = sis.read(sis.available());
					sis.close();
					
					var parser = new DOMParser();
					var doc = parser.parseFromString(body, "text/xml");
					assert.equal(
						doc.documentElement.getElementsByTagName('mtime')[0].textContent, mtime
					);
					assert.equal(
						doc.documentElement.getElementsByTagName('hash')[0].textContent, hash
					);
					
					response.setStatusLine(null, 204, null);
				}
			});
			
			var result = await engine.start();
			
			await zipVerifyDeferred.promise;
			
			assertRequestCount(3);
			
			assert.isTrue(result.localChanges);
			assert.isTrue(result.remoteChanges);
			assert.isTrue(result.syncRequired);
			
			// Check local objects
			assert.equal(item.attachmentSyncedModificationTime, mtime);
			assert.equal(item.attachmentSyncedHash, hash);
			assert.isFalse(item.synced);
		})
		
		it("should upload an updated file", async function () {
			var engine = await setup();
			
			var file = getTestDataDirectory();
			file.append('test.txt');
			var item = await Zotero.Attachments.importFromFile({ file });
			item.synced = true;
			await item.saveTx();
			
			var syncedModTime = Date.now() - 10000;
			var syncedHash = "3a2f092dd62178eb8bbfda42e07e64da";
			
			item.attachmentSyncedModificationTime = syncedModTime;
			item.attachmentSyncedHash = syncedHash;
			await item.saveTx({ skipAll: true });
			
			var mtime = await item.attachmentModificationTime;
			var hash = await item.attachmentHash;
			
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
			
			var result = await engine.start();
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
		
		it("should skip upload that already exists on the server", async function () {
			var engine = await setup();
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = await Zotero.Attachments.importFromFile({ file });
			item.synced = true;
			await item.saveTx();
			var mtime = await item.attachmentModificationTime;
			var hash = await item.attachmentHash;
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 200,
				text: '<properties version="1">'
					+ `<mtime>${mtime}</mtime>`
					+ `<hash>${hash}</hash>`
					+ '</properties>'
			});
			
			var result = await engine.start();
			
			assertRequestCount(1);
			
			assert.isTrue(result.localChanges);
			assert.isFalse(result.remoteChanges);
			assert.isTrue(result.syncRequired);
			
			// Check local object
			assert.equal(item.attachmentSyncedModificationTime, mtime);
			assert.equal(item.attachmentSyncedHash, hash);
			assert.isFalse(item.synced);
		});
		
		it("should skip upload and update mtimes if synced mtime doesn't match WebDAV mtime but file hash does", async function () {
			var engine = await setup();
			
			var file = OS.Path.join(getTestDataDirectory().path, 'test.png');
			var item = await Zotero.Attachments.importFromFile({ file });
			await item.saveTx();
			var fmtime = await item.attachmentModificationTime;
			var hash = await item.attachmentHash;
			
			var mtime = 123456789000;
			var mtime2 = 123456799000;
			item.attachmentSyncedModificationTime = mtime;
			item.attachmentSyncedHash = hash;
			item.attachmentSyncState = 'to_upload';
			item.synced = true;
			await item.saveTx();
			
			setResponse({
				method: "GET",
				url: `zotero/${item.key}.prop`,
				status: 200,
				text: '<properties version="1">'
					+ `<mtime>${mtime2}</mtime>`
					+ `<hash>${hash}</hash>`
					+ '</properties>'
			});
			setResponse({
				method: "PUT",
				url: `zotero/${item.key}.prop`,
				status: 204
			});
			
			var result = await engine.start();
			
			assertRequestCount(2);
			
			assert.isTrue(result.localChanges);
			assert.isFalse(result.remoteChanges);
			assert.isTrue(result.syncRequired);
			
			// Check local object
			assert.equal(item.attachmentSyncedModificationTime, fmtime);
			assert.equal(item.attachmentSyncedHash, hash);
			assert.isFalse(item.synced);
		});
		
		
		// As a security measure, Nextcloud sets a regular cookie and two SameSite cookies and
		// throws a 503 if the regular cookie gets returned without the SameSite cookies.
		// As of Fx60 (Zotero 5.0.78), which added SameSite support, SameSite cookies don't get
		// returned properly (because we don't have a load context?), triggering the 503. To avoid
		// this, we just don't store or send any cookies for WebDAV requests.
		//
		// https://forums.zotero.org/discussion/80429/sync-error-in-5-0-80
		it("shouldn't send cookies", async function () {
			// Skip initial verification for this test
			controller.verified = true;
			var engine = await setup();
			
			var library = Zotero.Libraries.userLibrary;
			library.libraryVersion = 5;
			await library.saveTx();
			library.storageDownloadNeeded = true;
			
			var fileName = "test.txt";
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:' + fileName;
			var text = Zotero.Utilities.randomString();
			item.attachmentSyncState = "to_download";
			await item.saveTx();
			
			// Create ZIP file containing above text file
			var tmpPath = Zotero.getTempDirectory().path;
			var tmpID = "webdav_download_" + Zotero.Utilities.randomString();
			var zipDirPath = OS.Path.join(tmpPath, tmpID);
			var zipPath = OS.Path.join(tmpPath, tmpID + ".zip");
			await OS.File.makeDir(zipDirPath);
			await Zotero.File.putContentsAsync(OS.Path.join(zipDirPath, fileName), text);
			await Zotero.File.zipDirectory(zipDirPath, zipPath);
			await OS.File.removeDir(zipDirPath);
			var zipContents = await Zotero.File.getBinaryContentsAsync(zipPath);
			
			var mtime = "1441252524905";
			var md5 = await Zotero.Utilities.Internal.md5Async(zipPath);
			
			await OS.File.remove(zipPath);
			
			// PROPFIND request to cache credentials
			httpd.registerPathHandler(
				`${davBasePath}zotero/`,
				{
					handle: function (request, response) {
						if (request.method == 'PROPFIND') {
							// Force Basic Auth
							if (!request.hasHeader('Authorization')) {
								response.setStatusLine(null, 401, null);
								response.setHeader('WWW-Authenticate', 'Basic realm="WebDAV"', false);
								return;
							}
							// Cookie shouldn't be passed
							if (request.hasHeader('Cookie')) {
								response.setStatusLine(null, 400, null);
								return;
							}
							response.setHeader('Set-Cookie', 'foo=bar', false);
							response.setHeader('Content-Type', 'text/xml; charset="utf-8"', false);
							response.setStatusLine(null, 207, "Multi-Status");
							response.write('<?xml version="1.0" encoding="utf-8"?>'
								+ '<D:multistatus xmlns:D="DAV:">'
								+ '<D:response>'
								+ `<D:href>${davBasePath}zotero/</D:href>`
								+ '<D:propstat>'
								+ '<D:prop><D:getcontentlength/></D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
								+ '</D:propstat>'
								+ '</D:response>'
								+ '</D:multistatus>');
						}
					}
				}
			);
			httpd.registerPathHandler(
				`${davBasePath}zotero/${item.key}.prop`,
				{
					handle: function (request, response) {
						if (request.method != 'GET') {
							response.setStatusLine(null, 400, "Bad Request");
							return;
						}
						// Should already include Authorization
						if (!request.hasHeader('Authorization')) {
							response.setStatusLine(null, 400, "");
							return;
						}
						// Cookie shouldn't be passed
						if (request.hasHeader('Cookie')) {
							response.setStatusLine(null, 400, null);
							return;
						}
						// Set a cookie
						response.setHeader('Set-Cookie', 'foo=bar', false);
						response.setStatusLine(null, 200, "OK");
						response.write('<properties version="1">'
							+ `<mtime>${mtime}</mtime>`
							+ `<hash>${md5}</hash>`
							+ '</properties>');
					}
				}
			);
			httpd.registerPathHandler(
				`${davBasePath}zotero/${item.key}.zip`,
				{
					handle: function (request, response) {
						// Make sure the cookie isn't returned
						if (request.hasHeader('Cookie')) {
							response.setStatusLine(null, 503, "Service Unavailable");
							return;
						}
						// In case nsIWebBrowserPersist doesn't use the cached Authorization
						if (!request.hasHeader('Authorization')) {
							response.setStatusLine(null, 401, null);
							response.setHeader('Set-Cookie', 'foo=bar', false);
							response.setHeader('WWW-Authenticate', 'Basic realm="WebDAV"', false);
							return;
						}
						response.setStatusLine(null, 200, "OK");
						response.write(zipContents);
					}
				}
			);
			
			await engine.start();
			
			assert.equal(library.storageVersion, library.libraryVersion);
		});
		
		
		it("should mark item as in conflict if mod time and hash on storage server don't match synced values", async function () {
			var engine = await setup();
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = await Zotero.Attachments.importFromFile({ file });
			item.synced = true;
			await item.saveTx();
			var mtime = await item.attachmentModificationTime;
			var hash = await item.attachmentHash;
			var path = item.getFilePath();
			var filename = 'test.png';
			var size = ((await OS.File.stat(path))).size;
			var contentType = 'image/png';
			var fileContents = await Zotero.File.getContentsAsync(path);
			
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
			
			var result = await engine.start();
			
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
		it("should show an error for a connection error", async function () {
			Zotero.Prefs.set("sync.storage.url", "127.0.0.1:9999");
			
			// Begin install procedure
			var win = await loadPrefPane('sync');
			var button = win.document.getElementById('storage-verify');
			
			var spy = sinon.spy(win.Zotero_Preferences.Sync, "verifyStorageServer");
			var promise1 = waitForDialog(function (dialog) {
				assert.include(
					dialog.document.documentElement.textContent,
					Zotero.getString('sync.storage.error.serverCouldNotBeReached', '127.0.0.1')
				);
			});
			button.click();
			await promise1;
			
			var promise2 = spy.returnValues[0];
			spy.restore();
			await promise2;
			
			win.close();
		});
		
		it("should show an error for a non-DAV URL", async function () {
			Zotero.Prefs.set("sync.storage.url", davHostPath);
			
			httpd.registerPathHandler(
				`${davBasePath}zotero/`,
				{
					handle: function (request, response) {
						// Force Basic Auth
						if (!request.hasHeader('Authorization')) {
							response.setStatusLine(null, 401, null);
							response.setHeader('WWW-Authenticate', 'Basic realm="WebDAV"', false);
							return;
						}
						response.setStatusLine(null, 200, "OK");
						response.write("<html><body><p>This is a non-DAV URL.</p></body></html>");
					}
				}
			);
			
			// Begin install procedure
			var win = await loadPrefPane('sync');
			var button = win.document.getElementById('storage-verify');
			
			var spy = sinon.spy(win.Zotero_Preferences.Sync, "verifyStorageServer");
			var promise1 = waitForDialog(function (dialog) {
				assert.include(
					dialog.document.documentElement.textContent,
					Zotero.getString(
						'sync.storage.error.webdav.invalidURL',
						davScheme + '://' + davHostPath + 'zotero/'
					)
				);
			});
			button.click();
			await promise1;
			
			var promise2 = spy.returnValues[0];
			spy.restore();
			await promise2;
			
			win.close();
		});
		
		it("should show an error for a 403", async function () {
			httpd.registerPathHandler(
				`${davBasePath}zotero/`,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 403, null);
					}
				}
			);
			
			Zotero.Prefs.set("sync.storage.url", davHostPath);
			
			// Begin install procedure
			var win = await loadPrefPane('sync');
			var button = win.document.getElementById('storage-verify');
			
			var spy = sinon.spy(win.Zotero_Preferences.Sync, "verifyStorageServer");
			var promise1 = waitForDialog(function (dialog) {
				assert.include(
					dialog.document.documentElement.textContent,
					Zotero.getString('sync.storage.error.webdav.permissionDenied', davBasePath + 'zotero/')
				);
			});
			button.click();
			await promise1;
			
			var promise2 = spy.returnValues[0];
			spy.restore();
			await promise2;
			
			win.close();
		});
		
		
		it("should show an error for a 404 for the parent directory", async function () {
			Zotero.Prefs.set("sync.storage.url", davHostPath);
			
			httpd.registerPathHandler(
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
			httpd.registerPathHandler(
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
			var win = await loadPrefPane('sync');
			var button = win.document.getElementById('storage-verify');
			
			var spy = sinon.spy(win.Zotero_Preferences.Sync, "verifyStorageServer");
			var promise1 = waitForDialog(function (dialog) {
				assert.include(
					dialog.document.documentElement.textContent,
					Zotero.getString('sync.storage.error.doesNotExist', davURL)
				);
			});
			button.click();
			await promise1;
			
			var promise2 = spy.returnValues[0];
			spy.restore();
			await promise2;
			
			win.close();
		});
		
		
		it("should show an error for a 200 for a nonexistent file", async function () {
			httpd.registerPathHandler(
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
			httpd.registerPathHandler(
				`${davBasePath}zotero/nonexistent.prop`,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, null);
					}
				}
			);
			
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

		it("should succeed when OPTIONS uses Basic auth but server requires Digest for other methods", async function () {
			// Test that checkServer works with Digest auth end-to-end:
			// 1. OPTIONS uses Basic auth
			// 2. PROPFIND triggers Digest 401, Firefox negotiates, we cache params
			// 3. Subsequent GET/PUT/DELETE use our computed Digest auth headers
			//    with correct method/URI hashes that the server validates
			let digestNonce = 'test' + Zotero.Utilities.randomString(16);
			let digestRealm = 'WebDAV-Digest';
			let md5 = Zotero.Utilities.Internal.md5;

			function sendDigest401(response) {
				response.setStatusLine(null, 401, "Unauthorized");
				response.setHeader(
					'WWW-Authenticate',
					`Digest realm="${digestRealm}", nonce="${digestNonce}", qop="auth"`,
					false
				);
			}

			// Parse a Digest Authorization header into its parameters
			function parseDigestAuth(header) {
				if (!header || !header.startsWith('Digest ')) return null;
				let params = {};
				let regex = /(\w+)=(?:"([^"]*)"|([\w]+))/g;
				let match;
				while ((match = regex.exec(header)) !== null) {
					params[match[1]] = match[2] !== undefined ? match[2] : match[3];
				}
				return params;
			}

			// Validate Digest auth by recomputing the expected response hash
			function validateDigestAuth(request, response) {
				if (!request.hasHeader('Authorization')) {
					sendDigest401(response);
					return false;
				}
				let auth = request.getHeader('Authorization');
				let params = parseDigestAuth(auth);
				if (!params || !params.response) {
					sendDigest401(response);
					return false;
				}

				// Recompute the expected response
				let ha1 = md5(`${params.username}:${params.realm}:${davPassword}`);
				let ha2 = md5(`${request.method}:${params.uri}`);
				let expected;
				if (params.qop) {
					expected = md5(
						`${ha1}:${params.nonce}:${params.nc}:${params.cnonce}:${params.qop}:${ha2}`
					);
				}
				else {
					expected = md5(`${ha1}:${params.nonce}:${ha2}`);
				}

				if (params.response !== expected) {
					sendDigest401(response);
					return false;
				}
				return true;
			}

			// Track which methods used computed Digest auth (as opposed to
			// Firefox's internal 401 negotiation). A request that arrives
			// with a valid Digest auth on the first try (without us sending
			// a 401 first) used our computed auth.
			let computedDigestMethods = [];

			httpd.registerPathHandler(
				`${davBasePath}zotero/`,
				{
					handle: function (request, response) {
						if (request.method == 'OPTIONS') {
							if (!checkBasicAuth(request)) {
								send401(response);
								return;
							}
							response.setHeader('DAV', '1', false);
							response.setStatusLine(null, 200, "OK");
							return;
						}
						if (!validateDigestAuth(request, response)) return;

						// If we got here without sending a 401, this request
						// used our computed auth
						computedDigestMethods.push('PROPFIND');

						if (request.method == 'PROPFIND') {
							response.setHeader('Content-Type', 'text/xml; charset="utf-8"', false);
							response.setStatusLine(null, 207, "Multi-Status");
							response.write('<?xml version="1.0" encoding="utf-8"?>'
								+ '<D:multistatus xmlns:D="DAV:">'
								+ '<D:response>'
								+ `<D:href>${davBasePath}zotero/</D:href>`
								+ '<D:propstat>'
								+ '<D:prop><D:getcontentlength/></D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
								+ '</D:propstat>'
								+ '</D:response>'
								+ '</D:multistatus>');
							return;
						}
						response.setStatusLine(null, 200, "OK");
					}
				}
			);
			httpd.registerPathHandler(
				`${davBasePath}zotero/nonexistent.prop`,
				{
					handle: function (request, response) {
						if (!validateDigestAuth(request, response)) return;
						computedDigestMethods.push(request.method);
						response.setStatusLine(null, 404, "Not Found");
					}
				}
			);
			httpd.registerPathHandler(
				`${davBasePath}zotero/zotero-test-file.prop`,
				{
					handle: function (request, response) {
						if (!validateDigestAuth(request, response)) return;
						computedDigestMethods.push(request.method);
						if (request.method == 'PUT') {
							response.setStatusLine(null, 201, "Created");
						}
						else if (request.method == 'GET') {
							response.setStatusLine(null, 200, "OK");
						}
						else if (request.method == 'DELETE') {
							response.setStatusLine(null, 204, "No Content");
						}
					}
				}
			);

			Zotero.Prefs.set("sync.storage.url", davHostPath);

			await controller.checkServer();
			assert.isTrue(controller.verified);

			// The PROPFIND is handled by Firefox's 401 negotiation, but
			// subsequent requests should use our computed Digest auth.
			// Verify that GET, PUT, GET, DELETE all used computed auth.
			assert.includeMembers(
				computedDigestMethods,
				['GET', 'PUT', 'GET', 'DELETE'],
				"Subsequent requests should use computed Digest auth"
			);
		});
	});

	describe("#purgeDeletedStorageFiles()", function () {
		beforeEach(function () {
			resetRequestCount();
		})
		
		it("should delete files on storage server that were deleted locally", async function () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var file = getTestDataDirectory();
			file.append('test.png');
			var item = await Zotero.Attachments.importFromFile({ file });
			item.synced = true;
			await item.saveTx();
			await item.eraseTx();
			
			assert.lengthOf(((await Zotero.Sync.Storage.Local.getDeletedFiles(libraryID))), 1);
			
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
			var results = await controller.purgeDeletedStorageFiles(libraryID);
			assertRequestCount(2);
			
			assert.lengthOf(results.deleted, 2);
			assert.sameMembers(results.deleted, [`${item.key}.prop`, `${item.key}.zip`]);
			assert.lengthOf(results.missing, 0);
			assert.lengthOf(results.error, 0);
			
			// Storage delete log should be empty
			assert.lengthOf(((await Zotero.Sync.Storage.Local.getDeletedFiles(libraryID))), 0);
		})
	})
	
	describe("#purgeOrphanedStorageFiles()", function () {
		beforeEach(function () {
			resetRequestCount();
			Zotero.Prefs.clear('lastWebDAVOrphanPurge');
		})
		
		it("should delete orphaned files more than a week older than the last sync time", async function () {
			var library = Zotero.Libraries.userLibrary;
			library.updateLastSyncTime();
			await library.saveTx();
			
			// Create one item
			var item1 = await createDataObject('item');
			var item1Key = item1.key;
			// Add another item to sync queue
			var item2Key = Zotero.DataObjectUtilities.generateKey();
			await Zotero.Sync.Data.Local.addObjectsToSyncQueue('item', library.id, [item2Key]);
			
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
						
						// Orphaned files to delete
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
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/BBBBBBBB.prop</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${beforeTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						
						// Orphaned files that aren't old enough to delete
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/CCCCCCCC.zip</D:href>`
							+ '<D:propstat>'
								+ '<D:prop>'
								+ `<lp1:getlastmodified>${currentTime}</lp1:getlastmodified>`
								+ '</D:prop>'
								+ '<D:status>HTTP/1.1 200 OK</D:status>'
							+ '</D:propstat>'
						+ '</D:response>'
						+ '<D:response xmlns:lp1="DAV:" xmlns:lp2="http://apache.org/dav/props/">'
							+ `<D:href>${davBasePath}zotero/CCCCCCCC.prop</D:href>`
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
				url: 'zotero/BBBBBBBB.prop',
				status: 204
			});
			setResponse({
				method: "DELETE",
				url: 'zotero/BBBBBBBB.zip',
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
			
			var results = await controller.purgeOrphanedStorageFiles();
			assertRequestCount(8);
			
			assert.sameMembers(
				results.deleted,
				[
					'lastsync.txt',
					'lastsync',
					'AAAAAAAA.prop',
					'AAAAAAAA.zip',
					'BBBBBBBB.prop',
					'BBBBBBBB.zip'
				]
			);
			assert.lengthOf(results.missing, 0);
			assert.lengthOf(results.error, 0);
		})
		
		it("shouldn't purge if purged recently", async function () {
			Zotero.Prefs.set("lastWebDAVOrphanPurge", Math.round(new Date().getTime() / 1000) - 3600);
			assert.equal(await controller.purgeOrphanedStorageFiles(), false);
			assertRequestCount(0);
		});
		
		
		it("should handle unnormalized Unicode characters", async function () {
			var library = Zotero.Libraries.userLibrary;
			library.updateLastSyncTime();
			await library.saveTx();
			
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
			await controller.purgeOrphanedStorageFiles();
		})
	})
})
