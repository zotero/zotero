/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/


if (!Zotero.Sync.Storage.Mode) {
	Zotero.Sync.Storage.Mode = {};
}

Zotero.Sync.Storage.Mode.WebDAV = function (options) {
	this.options = options;
	
	this.VerificationError = function (error, uri) {
		this.message = `WebDAV verification error (${error})`;
		this.error = error;
		this.uri = uri;
	}
	this.VerificationError.prototype = Object.create(Error.prototype);
}
Zotero.Sync.Storage.Mode.WebDAV.prototype = {
	mode: "webdav",
	name: "WebDAV",
	
	ERROR_DELAY_INTERVALS: [2500],
	ERROR_DELAY_MAX: 3000,
	
	get verified() {
		return Zotero.Prefs.get("sync.storage.verified");
	},
	set verified(val) {
		Zotero.Prefs.set("sync.storage.verified", !!val)
	},
	
	_initialized: false,
	_parentURI: null,
	_rootURI: null,	
	_cachedCredentials: false,
	
	_loginManagerHost: 'chrome://zotero',
	_loginManagerRealm: 'Zotero Storage Server',
	
	
	get defaultError() {
		return Zotero.getString('sync.storage.error.webdav.default');
	},
	
	get defaultErrorRestart() {
		return Zotero.getString('sync.storage.error.webdav.defaultRestart', Zotero.appName);
	},
	
	get username() {
		return Zotero.Prefs.get('sync.storage.username');
	},
	
	get password() {
		var username = this.username;
		
		if (!username) {
			Zotero.debug('Username not set before getting Zotero.Sync.Storage.WebDAV.password');
			return '';
		}
		
		Zotero.debug('Getting WebDAV password');
		var loginManager = Components.classes["@mozilla.org/login-manager;1"]
								.getService(Components.interfaces.nsILoginManager);
		
		var logins = loginManager.findLogins({}, this._loginManagerHost, null, this._loginManagerRealm);
		// Find user from returned array of nsILoginInfo objects
		for (var i = 0; i < logins.length; i++) {
			if (logins[i].username == username) {
				return logins[i].password;
			}
		}
		
		// Pre-4.0.28.5 format, broken for findLogins and removeLogin in Fx41
		logins = loginManager.findLogins({}, "chrome://zotero", "", null);
		for (var i = 0; i < logins.length; i++) {
			if (logins[i].username == username
					&& logins[i].formSubmitURL == "Zotero Storage Server") {
				return logins[i].password;
			}
		}
		
		return '';
	},
	
	set password(password) {
		var username = this.username;
		if (!username) {
			Zotero.debug('WebDAV username not set before setting password');
			return;
		}
		
		if (password == this.password) {
			Zotero.debug("WebDAV password hasn't changed");
			return;
		}
		
		_cachedCredentials = false;
		
		var loginManager = Components.classes["@mozilla.org/login-manager;1"]
								.getService(Components.interfaces.nsILoginManager);
		var logins = loginManager.findLogins({}, this._loginManagerHost, null, this._loginManagerRealm);
		for (var i = 0; i < logins.length; i++) {
			Zotero.debug('Clearing WebDAV passwords');
			if (logins[i].httpRealm == this._loginManagerRealm) {
				loginManager.removeLogin(logins[i]);
			}
			break;
		}
		
		// Pre-4.0.28.5 format, broken for findLogins and removeLogin in Fx41
		logins = loginManager.findLogins({}, this._loginManagerHost, "", null);
		for (var i = 0; i < logins.length; i++) {
			Zotero.debug('Clearing old WebDAV passwords');
			if (logins[i].formSubmitURL == "Zotero Storage Server") {
				try {
					loginManager.removeLogin(logins[i]);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			break;
		}
		
		if (password) {
			Zotero.debug('Setting WebDAV password');
			var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1",
				Components.interfaces.nsILoginInfo, "init");
			var loginInfo = new nsLoginInfo(this._loginManagerHost, null,
				this._loginManagerRealm, username, password, "", "");
			loginManager.addLogin(loginInfo);
		}
	},
	
	get rootURI() {
		if (!this._rootURI) {
			this._init();
		}
		return this._rootURI.clone();
	},
	
	get parentURI() {
		if (!this._parentURI) {
			this._init();
		}
		return this._parentURI.clone();
	},
	
	_init: function () {
		this._rootURI = false;
		this._parentURI = false;
		
		var scheme = Zotero.Prefs.get('sync.storage.scheme');
		switch (scheme) {
			case 'http':
			case 'https':
				break;
			
			default:
				throw new Error("Invalid WebDAV scheme '" + scheme + "'");
		}
		
		var url = Zotero.Prefs.get('sync.storage.url');
		if (!url) {
			throw new this.VerificationError("NO_URL");
		}
		
		var username = this.username;
		var password = this.password;
		if (!username) {
			throw new this.VerificationError("NO_USERNAME");
		}
		if (!password) {
			throw new this.VerificationError("NO_PASSWORD");
		}
		
		url = scheme + '://'
			+ encodeURIComponent(username) + ':' + encodeURIComponent(password) + '@'
			+ url
			+ (url.endsWith('/') ? '' : '/');
		
		var io = Services.io;
		this._parentURI = io.newURI(url, null, null);
		this._rootURI = io.newURI(url + "zotero/", null, null);
	},
	
	
	cacheCredentials: Zotero.Promise.coroutine(function* () {
		if (this._cachedCredentials) {
			Zotero.debug("WebDAV credentials are already cached");
			return;
		}
		
		Zotero.debug("Caching WebDAV credentials");
		
		try {
			var req = yield Zotero.HTTP.request(
				"OPTIONS",
				this.rootURI,
				{
					errorDelayIntervals: this.ERROR_DELAY_INTERVALS,
					errorDelayMax: this.ERROR_DELAY_MAX,
				}
			);
			
			Zotero.debug("WebDAV credentials cached");
			this._cachedCredentials = true;
		}
		catch (e) {
			if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
				let msg = "HTTP " + e.status + " error from WebDAV server "
					+ "for OPTIONS request";
				Zotero.logError(msg);
				throw new Error(this.defaultErrorRestart);
			}
			throw e;
		}
	}),
	
	
	clearCachedCredentials: function() {
		this._rootURI = this._parentURI = undefined;
		this._cachedCredentials = false;
	},
	
	
	/**
	 * Begin download process for individual file
	 *
	 * @param {Zotero.Sync.Storage.Request} request
	 * @return {Promise<Zotero.Sync.Storage.Result>}
	 */
	downloadFile: Zotero.Promise.coroutine(function* (request) {
		var item = Zotero.Sync.Storage.Utilities.getItemFromRequest(request);
		if (!item) {
			throw new Error("Item '" + request.name + "' not found");
		}
		
		// Skip download if local file exists and matches mod time
		var path = item.getFilePath();
		if (!path) {
			Zotero.debug(`Cannot download file for attachment ${item.libraryKey} with no path`);
			return new Zotero.Sync.Storage.Result;
		}
		
		// Retrieve modification time from server
		var metadata = yield this._getStorageFileMetadata(item, request);
		
		if (!request.isRunning()) {
			Zotero.debug("Download request '" + request.name
				+ "' is no longer running after getting mod time");
			return new Zotero.Sync.Storage.Result;
		}
		
		if (!metadata) {
			Zotero.debug("Remote file not found for item " + item.libraryKey);
			return new Zotero.Sync.Storage.Result;
		}
		
		var fileModTime = yield item.attachmentModificationTime;
		if (metadata.mtime == fileModTime) {
			Zotero.debug("File mod time matches remote file -- skipping download of "
				+ item.libraryKey);
			
			var updateItem = item.attachmentSyncState != 1
			item.attachmentSyncedModificationTime = metadata.mtime;
			item.attachmentSyncState = "in_sync";
			yield item.saveTx({ skipAll: true });
			// DEBUG: Necessary?
			if (updateItem) {
				yield item.updateSynced(false);
			}
			
			return new Zotero.Sync.Storage.Result({
				localChanges: true, // ?
			});
		}
		
		var uri = this._getItemURI(item);
		
		var destPath = OS.Path.join(Zotero.getTempDirectory().path, item.key + '.tmp');
		yield Zotero.File.removeIfExists(destPath);
		
		var deferred = Zotero.Promise.defer();
		var requestData = {
			item,
			mtime: metadata.mtime,
			md5: metadata.md5,
			compressed: true
		};
		
		var listener = new Zotero.Sync.Storage.StreamListener(
			{
				onStart: function (req) {
					if (request.isFinished()) {
						Zotero.debug("Download request " + request.name
							+ " stopped before download started -- closing channel");
						req.cancel(0x804b0002); // NS_BINDING_ABORTED
						deferred.resolve(new Zotero.Sync.Storage.Result);
					}
				},
				onProgress: function (a, b, c) {
					request.onProgress(a, b, c)
				},
				onStop: Zotero.Promise.coroutine(function* (req, status, res) {
					request.setChannel(false);
					
					if (status == 404) {
						let msg = "Remote ZIP file not found for item " + item.libraryKey;
						Zotero.debug(msg, 2);
						Components.utils.reportError(msg);
						
						// Delete the orphaned prop file
						try {
							yield this._deleteStorageFiles([item.key + ".prop"]);
						}
						catch (e) {
							Zotero.logError(e);
						}
						
						deferred.resolve(new Zotero.Sync.Storage.Result);
						return;
					}
					else if (status != 200) {
						try {
							this._throwFriendlyError("GET", dispURL, status);
						}
						catch (e) {
							deferred.reject(e);
						}
						return;
					}
					
					// Don't try to process if the request has been cancelled
					if (request.isFinished()) {
						Zotero.debug("Download request " + request.name
							+ " is no longer running after file download");
						deferred.resolve(new Zotero.Sync.Storage.Result);
						return;
					}
					
					Zotero.debug("Finished download of " + destPath);
					
					try {
						deferred.resolve(
							Zotero.Sync.Storage.Local.processDownload(requestData)
						);
					}
					catch (e) {
						deferred.reject(e);
					}
				}.bind(this)),
				onCancel: function (req, status) {
					Zotero.debug("Request cancelled");
					if (deferred.promise.isPending()) {
						deferred.resolve(new Zotero.Sync.Storage.Result);
					}
				}
			}
		);
		
		// Don't display password in console
		var dispURL = Zotero.HTTP.getDisplayURI(uri).spec;
		Zotero.debug('Saving ' + dispURL);
		const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
		var wbp = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
			.createInstance(nsIWBP);
		wbp.persistFlags = nsIWBP.PERSIST_FLAGS_BYPASS_CACHE;
		wbp.progressListener = listener;
		Zotero.Utilities.Internal.saveURI(wbp, uri, destPath);
		
		return deferred.promise;
	}),
	
	
	uploadFile: Zotero.Promise.coroutine(function* (request) {
		var item = Zotero.Sync.Storage.Utilities.getItemFromRequest(request);
		var params = {
			mtime: yield item.attachmentModificationTime,
			md5: yield item.attachmentHash
		};
		
		var metadata = yield this._getStorageFileMetadata(item, request);
		
		if (!request.isRunning()) {
			Zotero.debug("Upload request '" + request.name
				+ "' is no longer running after getting metadata");
			return new Zotero.Sync.Storage.Result;
		}
		
		// Check if file already exists on WebDAV server
		if (item.attachmentSyncState
				!= Zotero.Sync.Storage.Local.SYNC_STATE_FORCE_UPLOAD) {
			if (metadata.mtime) {
				// Local file time
				let fmtime = yield item.attachmentModificationTime;
				// Remote prop time
				let mtime = metadata.mtime;
				
				var changed = Zotero.Sync.Storage.Local.checkFileModTime(item, fmtime, mtime);
				if (!changed) {
					// Remote hash
					let hash = metadata.md5;
					if (hash) {
						// Local file hash
						let fhash = yield item.attachmentHash;
						if (fhash != hash) {
							changed = true;
						}
					}
					
					// If WebDAV server already has file, update synced properties
					if (!changed) {
						item.attachmentSyncedModificationTime = fmtime;
						if (hash) {
							item.attachmentSyncedHash = hash;
						}
						item.attachmentSyncState = "in_sync";
						yield item.saveTx({ skipAll: true });
						// skipAll doesn't mark as unsynced, so do that separately
						yield item.updateSynced(false);
						return new Zotero.Sync.Storage.Result;
					}
				}
				
				// Check for conflict between synced values and values on WebDAV server. This
				// should almost never happen, but it's possible if a client uploaded to WebDAV
				// but failed before updating the API (or the local properties if this computer),
				// or if the file was changed identically on two computers at the same time, such
				// that the post-upload API update on computer B happened after the pre-upload API
				// check on computer A. (In the case of a failure, there's no guarantee that the
				// API would ever be updated with the correct values, so we can't just wait for
				// the API to change.) If a conflict is found, we flag the item as in conflict
				// and require another file sync, which will trigger conflict resolution.
				let smtime = item.attachmentSyncedModificationTime;
				if (smtime != mtime) {
					let shash = item.attachmentSyncedHash;
					if (shash && metadata.md5 && shash == metadata.md5) {
						Zotero.debug("Last synced mod time for item " + item.libraryKey
							+ " doesn't match time on storage server but hash does -- ignoring");
						return new Zotero.Sync.Storage.Result;
					}
					
					Zotero.logError("Conflict -- last synced file mod time for item "
						+ item.libraryKey + " does not match time on storage server"
						+ " (" + smtime + " != " + mtime + ")");
					
					// Conflict resolution uses the synced mtime as the remote value, so set
					// that to the WebDAV value, since that's the one in conflict.
					item.attachmentSyncedModificationTime = mtime;
					item.attachmentSyncState = "in_conflict";
					yield item.saveTx({ skipAll: true });
					
					return new Zotero.Sync.Storage.Result({
						fileSyncRequired: true
					});
				}
			}
			else {
				Zotero.debug("Remote file not found for item " + item.id);
			}
		}
		
		var created = yield Zotero.Sync.Storage.Utilities.createUploadFile(request);
		if (!created) {
			return new Zotero.Sync.Storage.Result;
		}
		
		/*
		updateSizeMultiplier(
			(100 - Zotero.Sync.Storage.compressionTracker.ratio) / 100
		);
		*/
		
		// Delete .prop file before uploading new .zip
		if (metadata) {
			var propURI = this._getItemPropertyURI(item);
			try {
				yield Zotero.HTTP.request(
					"DELETE",
					propURI,
					{
						successCodes: [200, 204, 404],
						requestObserver: xmlhttp => request.setChannel(xmlhttp.channel),
						errorDelayIntervals: this.ERROR_DELAY_INTERVALS,
						errorDelayMax: this.ERROR_DELAY_MAX,
						debug: true
					}
				);
			}
			catch (e) {
				if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
					this._throwFriendlyError("DELETE", Zotero.HTTP.getDisplayURI(propURI).spec, e.status);
				}
				throw e;
			}
		}
		
		var file = Zotero.getTempDirectory();
		file.append(item.key + '.zip');
		Components.utils.importGlobalProperties(["File"]);
		file = File.createFromFileName ? File.createFromFileName(file.path) : new File(file);
		// File.createFromFileName() returns a Promise in Fx54+
		if (file.then) {
			file = yield file;
		}
		
		var uri = this._getItemURI(item);
		
		try {
			var req = yield Zotero.HTTP.request(
				"PUT",
				uri,
				{
					headers: {
						"Content-Type": "application/zip"
					},
					body: file,
					requestObserver: function (req) {
						request.setChannel(req.channel);
						req.upload.addEventListener("progress", function (event) {
							if (event.lengthComputable) {
								request.onProgress(event.loaded, event.total);
							}
						});
					},
					errorDelayIntervals: this.ERROR_DELAY_INTERVALS,
					errorDelayMax: this.ERROR_DELAY_MAX,
					timeout: 0,
					debug: true
				}
			);
		}
		catch (e) {
			if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
				if (e.status == 507) {
					throw new Error(
						Zotero.getString('sync.storage.error.webdav.insufficientSpace')
					);
				}
				
				this._throwFriendlyError("PUT", Zotero.HTTP.getDisplayURI(uri).spec, e.status);
			}
			throw e;
			
			// TODO: Detect cancel?
			//onUploadCancel(httpRequest, status, data)
			//deferred.resolve(false);
		}
		
		request.setChannel(false);
		return this._onUploadComplete(req, request, item, params);
	}),
	
	
	/**
	 * @return {Promise}
	 * @throws {Zotero.Sync.Storage.Mode.WebDAV.VerificationError|Error}
	 */
	checkServer: Zotero.Promise.coroutine(function* (options = {}) {
		// Clear URIs
		this._init();
		
		var parentURI = this.parentURI;
		var uri = this.rootURI;
		
		var xmlstr = "<propfind xmlns='DAV:'><prop>"
			// IIS 5.1 requires at least one property in PROPFIND
			+ "<getcontentlength/>"
			+ "</prop></propfind>";
		
		var channel;
		var requestObserver = function (req) {
			if (options.onRequest) {
				options.onRequest(req);
			}
		}
		
		// Test whether URL is WebDAV-enabled
		var req = yield Zotero.HTTP.request(
			"OPTIONS",
			uri,
			{
				successCodes: [200, 404],
				requestObserver: function (req) {
					if (req.channel) {
						channel = req.channel;
					}
					if (options.onRequest) {
						options.onRequest(req);
					}
				},
				errorDelayMax: 0,
				debug: true
			}
		);
		
		Zotero.debug(req.getAllResponseHeaders());
		
		var dav = req.getResponseHeader("DAV");
		if (dav == null) {
			throw new this.VerificationError("NOT_DAV", uri);
		}
		
		var headers = { Depth: 0 };
		var contentTypeXML = { "Content-Type": "text/xml; charset=utf-8" };
		
		// Get the Authorization header used in case we need to do a request
		// on the parent below
		if (channel) {
			var channelAuthorization = Zotero.HTTP.getChannelAuthorization(channel);
			channel = null;
		}
		
		// Test whether Zotero directory exists
		req = yield Zotero.HTTP.request("PROPFIND", uri, {
			body: xmlstr,
			headers: Object.assign({}, headers, contentTypeXML),
			successCodes: [207, 404],
			requestObserver,
			errorDelayMax: 0,
			debug: true
		});
		
		if (req.status == 207) {
			// Test if missing files return 404s
			let missingFileURI = uri.mutate().setSpec(uri.spec + "nonexistent.prop").finalize();
			try {
				req = yield Zotero.HTTP.request(
					"GET",
					missingFileURI,
					{
						successCodes: [404],
						responseType: 'text',
						requestObserver,
						errorDelayMax: 0,
						debug: true
					}
				)
			}
			catch (e) {
				if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
					if (e.status >= 200 && e.status < 300) {
						throw new this.VerificationError("NONEXISTENT_FILE_NOT_MISSING", uri);
					}
				}
				throw e;
			}
			
			// Test if Zotero directory is writable
			let testFileURI = uri.mutate().setSpec(uri.spec + "zotero-test-file.prop").finalize();
			req = yield Zotero.HTTP.request("PUT", testFileURI, {
				body: " ",
				successCodes: [200, 201, 204],
				requestObserver,
				errorDelayMax: 0,
				debug: true
			});
			
			req = yield Zotero.HTTP.request(
				"GET",
				testFileURI,
				{
					successCodes: [200, 404],
					responseType: 'text',
					requestObserver,
					errorDelayMax: 0,
					debug: true
				}
			);
			
			if (req.status == 200) {
				// Delete test file
				yield Zotero.HTTP.request(
					"DELETE",
					testFileURI,
					{
						successCodes: [200, 204],
						requestObserver,
						errorDelayMax: 0,
						debug: true
					}
				);
			}
			// This can happen with cloud storage services backed by S3 or other eventually
			// consistent data stores.
			//
			// This can also be from IIS 6+, which is configured not to serve .prop files.
			// http://support.microsoft.com/kb/326965
			else if (req.status == 404) {
				throw new this.VerificationError("FILE_MISSING_AFTER_UPLOAD", uri);
			}
		}
		else if (req.status == 404) {
			// Include Authorization header from /zotero request,
			// since Firefox probably won't apply it to the parent request
			if (channelAuthorization) {
				headers.Authorization = channelAuthorization;
			}
			
			// Zotero directory wasn't found, so see if at least
			// the parent directory exists
			req = yield Zotero.HTTP.request("PROPFIND", parentURI, {
				headers: Object.assign({}, headers, contentTypeXML),
				body: xmlstr,
				requestObserver,
				successCodes: [207, 404],
				errorDelayMax: 0
			});
			
			if (req.status == 207) {
				throw new this.VerificationError("ZOTERO_DIR_NOT_FOUND", uri);
			}
			else if (req.status == 404) {
				throw new this.VerificationError("PARENT_DIR_NOT_FOUND", uri);
			}
		}
		
		this.verified = true;
		Zotero.debug(this.name + " file sync is successfully set up");
	}),
	
	
	/**
	 * Handles the result of WebDAV verification, displaying an alert if necessary.
	 *
	 * @return bool True if the verification eventually succeeded, false otherwise
	 */
	handleVerificationError: Zotero.Promise.coroutine(function* (err, window, skipSuccessMessage) {
		var promptService =
			Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
				createInstance(Components.interfaces.nsIPromptService);
		
		var errorTitle, errorMsg;
		
		if (err instanceof Zotero.HTTP.UnexpectedStatusException) {
			switch (err.status) {
			case 0:
				errorMsg = Zotero.getString('sync.storage.error.serverCouldNotBeReached', err.url.host);
				break;
				
			case 401:
				errorTitle = Zotero.getString('general.permissionDenied');
				errorMsg = Zotero.getString('sync.storage.error.webdav.invalidLogin') + "\n\n"
					+ Zotero.getString('sync.storage.error.checkFileSyncSettings');
				break;
			
			case 403:
				errorTitle = Zotero.getString('general.permissionDenied');
				errorMsg = Zotero.getString('sync.storage.error.webdav.permissionDenied', err.channel.URI.pathQueryRef)
					+ "\n\n" + Zotero.getString('sync.storage.error.checkFileSyncSettings');
				break;
			
			case 500:
				errorTitle = Zotero.getString('sync.storage.error.webdav.serverConfig.title');
				errorMsg = Zotero.getString('sync.storage.error.webdav.serverConfig')
					+ "\n\n" + Zotero.getString('sync.storage.error.checkFileSyncSettings');
				break;
			
			default:
				errorMsg = Zotero.getString('general.unknownErrorOccurred') + "\n\n"
					+ Zotero.getString('sync.storage.error.checkFileSyncSettings') + "\n\n"
					+ "HTTP " + err.status;
				break;
			}
		}
		else if (err instanceof this.VerificationError) {
			let spec;
			if (err.uri) {
				spec = err.uri.scheme + '://' + err.uri.hostPort + err.uri.pathQueryRef;
			}
			switch (err.error) {
				case "NO_URL":
					errorMsg = Zotero.getString('sync.storage.error.webdav.enterURL');
					break;
				
				case "NO_USERNAME":
					errorMsg = Zotero.getString('sync.error.usernameNotSet');
					break;
				
				case "NO_PASSWORD":
					errorMsg = Zotero.getString('sync.error.enterPassword');
					break;
				
				case "NOT_DAV":
					errorMsg = Zotero.getString('sync.storage.error.webdav.invalidURL', spec);
					break;
				
				case "PARENT_DIR_NOT_FOUND":
					errorTitle = Zotero.getString('sync.storage.error.directoryNotFound');
					var parentSpec = spec.replace(/zotero\/$/, "");
					errorMsg = Zotero.getString('sync.storage.error.doesNotExist', parentSpec);
					break;
				
				case "ZOTERO_DIR_NOT_FOUND":
					var create = promptService.confirmEx(
						window,
						Zotero.getString('sync.storage.error.directoryNotFound'),
						Zotero.getString('sync.storage.error.doesNotExist', spec) + "\n\n"
							+ Zotero.getString('sync.storage.error.createNow'),
						promptService.BUTTON_POS_0
							* promptService.BUTTON_TITLE_IS_STRING
						+ promptService.BUTTON_POS_1
							* promptService.BUTTON_TITLE_CANCEL,
						Zotero.getString('general.create'),
						null, null, null, {}
					);
					
					if (create != 0) {
						return;
					}
					
					try {
						yield this._createServerDirectory();
					}
					catch (e) {
						if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
							if (e.status == 403) {
								errorTitle = Zotero.getString('general.permissionDenied');
								let rootURI = this.rootURI;
								let rootSpec = rootURI.scheme + '://' + rootURI.hostPort + rootURI.pathQueryRef
								errorMsg = Zotero.getString('sync.storage.error.permissionDeniedAtAddress')
									+ "\n\n" + rootSpec + "\n\n"
									+ Zotero.getString('sync.storage.error.checkFileSyncSettings');
								break;
							}
						}
						errorMsg = e;
						break;
					}
					
					try {
						yield this.checkServer();
						return true;
					}
					catch (e) {
						return this.handleVerificationError(e, window, skipSuccessMessage);
					}
					break;
				
				case "FILE_MISSING_AFTER_UPLOAD":
					errorTitle = Zotero.getString("general.warning");
					errorMsg = Zotero.getString('sync.storage.error.webdav.fileMissingAfterUpload');
					Zotero.Prefs.set("sync.storage.verified", true);
					break;
				
				case "NONEXISTENT_FILE_NOT_MISSING":
					errorTitle = Zotero.getString('sync.storage.error.webdav.serverConfig.title');
					errorMsg = Zotero.getString('sync.storage.error.webdav.nonexistentFileNotMissing');
					break;
				
				default:
					errorMsg = Zotero.getString('general.unknownErrorOccurred') + "\n\n"
						Zotero.getString('sync.storage.error.checkFileSyncSettings');
					break;
			}
		}
		
		var e;
		if (errorMsg) {
			e = {
				message: errorMsg,
				// Prevent Report Errors button for known errors
				dialogButtonText: null
			};
			Zotero.logError(errorMsg);
		}
		else {
			e = err;
			Zotero.logError(err);
		}
		
		if (!skipSuccessMessage) {
			if (!errorTitle) {
				errorTitle = Zotero.getString("general.error");
			}
			Zotero.Utilities.Internal.errorPrompt(errorTitle, e);
		}
		return false;
	}),
	
	
	/**
	 * Remove files on storage server that were deleted locally
	 *
	 * @param {Integer} libraryID
	 */
	purgeDeletedStorageFiles: Zotero.Promise.coroutine(function* (libraryID) {
		var d = new Date();
		
		Zotero.debug("Purging deleted storage files");
		var files = yield Zotero.Sync.Storage.Local.getDeletedFiles(libraryID);
		if (!files.length) {
			Zotero.debug("No files to delete remotely");
			return false;
		}
		
		// Add .zip extension
		var files = files.map(file => file + ".zip");
		
		var results = yield this._deleteStorageFiles(files)
		
		// Remove deleted and nonexistent files from storage delete log
		var toPurge = Zotero.Utilities.arrayUnique(
			results.deleted.concat(results.missing)
			// Strip file extension so we just have keys
			.map(val => val.replace(/\.(prop|zip)$/, ""))
		);
		if (toPurge.length > 0) {
			yield Zotero.Utilities.Internal.forEachChunkAsync(
				toPurge,
				Zotero.DB.MAX_BOUND_PARAMETERS - 1,
				function (chunk) {
					return Zotero.DB.executeTransaction(function* () {
						var sql = "DELETE FROM storageDeleteLog WHERE libraryID=? AND key IN ("
							+ chunk.map(() => '?').join() + ")";
						return Zotero.DB.queryAsync(sql, [libraryID].concat(chunk));
					});
				}
			);
		}
		
		Zotero.debug(`Purged deleted storage files in ${new Date() - d} ms`);
		Zotero.debug(results);
		
		return results;
	}),
	
	
	/**
	 * Delete orphaned storage files older than a week before last sync time
	 */
	purgeOrphanedStorageFiles: Zotero.Promise.coroutine(function* () {
		var d = new Date();
		const libraryID = Zotero.Libraries.userLibraryID;
		const library = Zotero.Libraries.get(libraryID);
		const daysBeforeSyncTime = 7;
		
		// If recently purged, skip
		var lastPurge = Zotero.Prefs.get('lastWebDAVOrphanPurge');
		if (lastPurge) {
			try {
				let purgeAfter = lastPurge + (daysBeforeSyncTime * 24 * 60 * 60);
				if (new Date() < new Date(purgeAfter * 1000)) {
					return false;
				}
			}
			catch (e) {
				Zotero.Prefs.clear('lastWebDAVOrphanPurge');
			}
		}
		
		Zotero.debug("Purging orphaned storage files");
		
		var uri = this.rootURI;
		var path = uri.pathQueryRef;
		
		var contentTypeXML = { "Content-Type": "text/xml; charset=utf-8" };
		var xmlstr = "<propfind xmlns='DAV:'><prop>"
			+ "<getlastmodified/>"
			+ "</prop></propfind>";
		
		var lastSyncDate = library.lastSync;
		if (!lastSyncDate) {
			Zotero.debug(`No last sync date for library ${libraryID} -- not purging orphaned files`);
			return false;
		}
		
		var req = yield Zotero.HTTP.request(
			"PROPFIND",
			uri,
			{
				body: xmlstr,
				headers: Object.assign({ Depth: 1 }, contentTypeXML),
				successCodes: [207],
				errorDelayIntervals: this.ERROR_DELAY_INTERVALS,
				errorDelayMax: this.ERROR_DELAY_MAX,
				debug: true
			}
		);
		
		var responseNode = req.responseXML.documentElement;
		responseNode.xpath = function (path) {
			return Zotero.Utilities.xpath(this, path, { D: 'DAV:' });
		};
		
		var syncQueueKeys = new Set(
			yield Zotero.Sync.Data.Local.getObjectsFromSyncQueue('item', libraryID)
		);
		var deleteFiles = [];
		var trailingSlash = !!path.match(/\/$/);
		for (let response of responseNode.xpath("D:response")) {
			var href = Zotero.Utilities.xpathText(
				response, "D:href", { D: 'DAV:' }
			) || "";
			Zotero.debug("Checking response entry " + href);
			
			// Strip trailing slash if there isn't one on the root path
			if (!trailingSlash) {
				href = href.replace(/\/$/, "");
			}
			
			// Absolute
			if (href.match(/^https?:\/\//)) {
				let ios = Components.classes["@mozilla.org/network/io-service;1"]
					.getService(Components.interfaces.nsIIOService);
				href = ios.newURI(href, null, null).pathQueryRef;
			}
			
			let decodedHref = decodeURIComponent(href).normalize();
			let decodedPath = decodeURIComponent(path).normalize();
			
			// Skip root URI
			if (decodedHref == decodedPath
					// Some Apache servers respond with a "/zotero" href
					// even for a "/zotero/" request
					|| (trailingSlash && decodedHref + '/' == decodedPath)) {
				continue;
			}
			
			if (!decodedHref.startsWith(decodedPath)) {
				throw new Error(`DAV:href '${href}' does not begin with path '${path}'`);
			}
			
			var matches = href.match(/[^\/]+$/);
			if (!matches) {
				throw new Error(`Unexpected href '${href}'`);
			}
			var file = matches[0];
			
			if (file.startsWith('.')) {
				Zotero.debug("Skipping hidden file " + file);
				continue;
			}
			
			var isLastSyncFile = file == 'lastsync.txt' || file == 'lastsync';
			if (!isLastSyncFile) {
				if (!file.endsWith('.zip') && !file.endsWith('.prop')) {
					Zotero.debug("Skipping file " + file);
					continue;
				}
				
				let key = file.replace(/\.(zip|prop)$/, '');
				let item = yield Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
				if (item) {
					Zotero.debug("Skipping existing file " + file);
					continue;
				}
				
				if (syncQueueKeys.has(key)) {
					Zotero.debug(`Skipping file for item ${key} in sync queue`);
					continue;
				}
			}
			
			Zotero.debug("Checking orphaned file " + file);
			
			// TODO: Parse HTTP date properly
			Zotero.debug(response.innerHTML);
			var lastModified = Zotero.Utilities.xpathText(
				response, ".//D:getlastmodified", { D: 'DAV:' }
			);
			lastModified = Zotero.Date.strToISO(lastModified);
			lastModified = Zotero.Date.sqlToDate(lastModified, true);
			
			// Delete files older than a week before last sync time
			var days = (lastSyncDate - lastModified) / 1000 / 60 / 60 / 24;
			
			if (days > daysBeforeSyncTime) {
				deleteFiles.push(file);
			}
		}
		
		var results = yield this._deleteStorageFiles(deleteFiles);
		Zotero.Prefs.set("lastWebDAVOrphanPurge", Math.round(new Date().getTime() / 1000));
		
		Zotero.debug(`Purged orphaned storage files in ${new Date() - d} ms`);
		Zotero.debug(results);
		
		return results;
	}),
	
	
	//
	// Private methods
	//
	/**
	 * Get mod time and hash of file on storage server
	 *
	 * @param {Zotero.Item} item
	 * @param {Zotero.Sync.Storage.Request} request
	 * @return {Object} - Object with 'mtime' and 'md5'
	 */
	_getStorageFileMetadata: Zotero.Promise.coroutine(function* (item, request) {
		var uri = this._getItemPropertyURI(item);
		
		try {
			var req = yield Zotero.HTTP.request(
				"GET",
				uri,
				{
					successCodes: [200, 300, 404],
					responseType: 'text',
					requestObserver: xmlhttp => request.setChannel(xmlhttp.channel),
					noCache: true,
					errorDelayIntervals: this.ERROR_DELAY_INTERVALS,
					errorDelayMax: this.ERROR_DELAY_MAX,
					debug: true
				}
			);
		}
		catch (e) {
			if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
				this._throwFriendlyError("GET", Zotero.HTTP.getDisplayURI(uri).spec, e.status);
			}
			throw e;
		}
		
		// mod_speling can return 300s for 404s with base name matches
		if (req.status == 404 || req.status == 300) {
			return false;
		}
		
		// No metadata set
		if (!req.responseText) {
			return false;
		}
		
		var seconds = false;
		var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
			.createInstance(Components.interfaces.nsIDOMParser);
		try {
			var xml = parser.parseFromString(req.responseText, "text/xml");
		}
		catch (e) {
			Zotero.logError(e);
		}
		
		var mtime = false;
		var md5 = false;
		
		if (xml) {
			try {
				var mtime = xml.getElementsByTagName('mtime')[0].textContent;
			}
			catch (e) {}
			try {
				var md5 = xml.getElementsByTagName('hash')[0].textContent;
			}
			catch (e) {}
		}
		
		// TEMP: Accept old non-XML prop files with just mtimes in seconds
		if (!mtime) {
			mtime = req.responseText;
			seconds = true;
		}
		
		var invalid = false;
		
		// Unix timestamps need to be converted to ms-based timestamps
		if (seconds) {
			if (mtime.match(/^[0-9]{1,10}$/)) {
				Zotero.debug("Converting Unix timestamp '" + mtime + "' to milliseconds");
				mtime = mtime * 1000;
			}
			else {
				invalid = true;
			}
		}
		else if (!mtime.match(/^[0-9]{1,13}$/)) {
			invalid = true;
		}
		
		// Delete invalid .prop files
		if (invalid) {
			let msg = "Invalid mod date '" + Zotero.Utilities.ellipsize(mtime, 20)
				+ "' for item " + item.libraryKey;
			Zotero.logError(msg);
			yield this._deleteStorageFiles([item.key + ".prop"]).catch(function (e) {
				Zotero.logError(e);
			});
			throw new Error(Zotero.Sync.Storage.Mode.WebDAV.defaultError);
		}
		
		return {
			mtime: parseInt(mtime),
			md5
		};
	}),
	
	
	/**
	 * Set mod time and hash of file on storage server
	 *
	 * @param	{Zotero.Item}	item
	 */
	_setStorageFileMetadata: Zotero.Promise.coroutine(function* (item) {
		var uri = this._getItemPropertyURI(item);
		
		var mtime = yield item.attachmentModificationTime;
		var md5 = yield item.attachmentHash;
		
		var xmlstr = '<properties version="1">'
			+ '<mtime>' + mtime + '</mtime>'
			+ '<hash>' + md5 + '</hash>'
			+ '</properties>';
		
		try {
			yield Zotero.HTTP.request(
				"PUT",
				uri,
				{
					headers: {
						"Content-Type": "text/xml"
					},
					body: xmlstr,
					successCodes: [200, 201, 204],
					errorDelayIntervals: this.ERROR_DELAY_INTERVALS,
					errorDelayMax: this.ERROR_DELAY_MAX,
					debug: true
				}
			)
		}
		catch (e) {
			if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
				this._throwFriendlyError("PUT", Zotero.HTTP.getDisplayURI(uri).spec, e.status);
			}
			throw e;
		}
	}),
	
	
	_onUploadComplete: Zotero.Promise.coroutine(function* (req, request, item, params) {
		Zotero.debug("Upload of attachment " + item.key + " finished with status code " + req.status);
		Zotero.debug(req.responseText);
		
		// Update .prop file on WebDAV server
		yield this._setStorageFileMetadata(item);
		
		item.attachmentSyncedModificationTime = params.mtime;
		item.attachmentSyncedHash = params.md5;
		item.attachmentSyncState = "in_sync";
		yield item.saveTx({ skipAll: true });
		// skipAll doesn't mark as unsynced, so do that separately
		yield item.updateSynced(false);
		
		try {
			yield OS.File.remove(
				OS.Path.join(Zotero.getTempDirectory().path, item.key + '.zip')
			);
		}
		catch (e) {
			Zotero.logError(e);
		}
		
		return new Zotero.Sync.Storage.Result({
			localChanges: true,
			remoteChanges: true,
			syncRequired: true
		});
	}),
	
	
	_onUploadCancel: function (httpRequest, status, data) {
		var request = data.request;
		var item = data.item;
		
		Zotero.debug("Upload of attachment " + item.key + " cancelled with status code " + status);
		
		try {
			var file = Zotero.getTempDirectory();
			file.append(item.key + '.zip');
			file.remove(false);
		}
		catch (e) {
			Components.utils.reportError(e);
		}
	},
	
	
	/**
	 * Create a Zotero directory on the storage server
	 */
	_createServerDirectory: function () {
		return Zotero.HTTP.request(
			"MKCOL",
			this.rootURI,
			{
				successCodes: [201],
				errorDelayIntervals: this.ERROR_DELAY_INTERVALS,
				errorDelayMax: this.ERROR_DELAY_MAX,
			}
		);
	},
	
	
	/**
	 * Get the storage URI for an item
	 *
	 * @inner
	 * @param	{Zotero.Item}
	 * @return	{nsIURI}					URI of file on storage server
	 */
	_getItemURI: function (item) {
		return this.rootURI.mutate().setSpec(this.rootURI.spec + item.key + '.zip').finalize();
	},
	
	
	/**
	 * Get the storage property file URI for an item
	 *
	 * @inner
	 * @param	{Zotero.Item}
	 * @return	{nsIURI}					URI of property file on storage server
	 */
	_getItemPropertyURI: function (item) {
		return this.rootURI.mutate().setSpec(this.rootURI.spec + item.key + '.prop').finalize();
	},
	
	
	/**
	 * Get the storage property file URI corresponding to a given item storage URI
	 *
	 * @param	{nsIURI}			Item storage URI
	 * @return	{nsIURI|FALSE}	Property file URI, or FALSE if not an item storage URI
	 */
	_getPropertyURIFromItemURI: function (uri) {
		if (!uri.spec.match(/\.zip$/)) {
			return false;
		}
		return uri.mutate().setFilePath(uri.filePath.replace(/\.zip$/, '.prop')).finalize();
	},
	
	
	/**
	 * @inner
	 * @param {String[]} files - Filenames of files to delete
	 * @return {Object} - Object with properties 'deleted', 'missing', and 'error', each
	 *     each containing filenames
	 */
	_deleteStorageFiles: Zotero.Promise.coroutine(function* (files) {
		var results = {
			deleted: new Set(),
			missing: new Set(),
			error: new Set()
		};
		
		if (files.length == 0) {
			return results;
		}
		
		// Delete .prop files first
		files.sort(function (a, b) {
			if (a.endsWith('.zip') && b.endsWith('.prop')) return 1;
			if (b.endsWith('.zip') && a.endsWith('.prop')) return 1;
			return 0;
		});
		
		let deleteURI = this.rootURI.clone();
		// This should never happen, but let's be safe
		if (!deleteURI.spec.match(/\/$/)) {
			throw new Error("Root URI does not end in slash");
		}
		
		var funcs = [];
		for (let i = 0 ; i < files.length; i++) {
			let fileName = files[i];
			funcs.push(Zotero.Promise.coroutine(function* () {
				var deleteURI = this.rootURI.mutate().setSpec(this.rootURI.spec + fileName).finalize();
				try {
					var req = yield Zotero.HTTP.request(
						"DELETE",
						deleteURI,
						{
							successCodes: [200, 204, 404],
							errorDelayIntervals: this.ERROR_DELAY_INTERVALS,
							errorDelayMax: this.ERROR_DELAY_MAX,
						}
					);
				}
				catch (e) {
					results.error.add(fileName);
					throw e;
				}
				
				switch (req.status) {
					case 204:
					// IIS 5.1 and Sakai return 200
					case 200:
						results.deleted.add(fileName);
						break;
					
					case 404:
						results.missing.add(fileName);
						break;
				}
				
				// If an item file URI, get the property URI
				var deletePropURI = this._getPropertyURIFromItemURI(deleteURI);
				// Only nsIURL has fileName
				deletePropURI.QueryInterface(Ci.nsIURL);
				
				// If we already deleted the prop file, skip it
				if (!deletePropURI || results.deleted.has(deletePropURI.fileName)) {
					return;
				}
				
				fileName = deletePropURI.fileName;
				
				// Delete property file
				var req = yield Zotero.HTTP.request(
					"DELETE",
					deletePropURI,
					{
						successCodes: [200, 204, 404],
						errorDelayIntervals: this.ERROR_DELAY_INTERVALS,
						errorDelayMax: this.ERROR_DELAY_MAX,
					}
				);
				switch (req.status) {
					case 204:
					// IIS 5.1 and Sakai return 200
					case 200:
						results.deleted.add(fileName);
						break;
					
					case 404:
						results.missing.add(fileName);
						break;
				}
			}.bind(this)));
		}
		
		Components.utils.import("resource://zotero/concurrentCaller.js");
		var caller = new ConcurrentCaller({
			numConcurrent: 4,
			stopOnError: true,
			logger: msg => Zotero.debug(msg),
			onError: e => Zotero.logError(e)
		});
		yield caller.start(funcs);
		
		// Convert sets back to arrays
		for (let i in results) {
			results[i] = Array.from(results[i]);
		}
		return results;
	}),
	
	
	_throwFriendlyError: function (method, url, status) {
		throw new Error(
			Zotero.getString('sync.storage.error.webdav.requestError', [status, method])
			+ "\n\n"
			+ Zotero.getString('sync.storage.error.webdav.checkSettingsOrContactAdmin')
			+ "\n\n"
			+ Zotero.getString('sync.storage.error.webdav.url', url)
		);
	}
}
