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

Zotero.Sync.Storage.Mode.ZFS = function (options) {
	this.options = options;
	this.apiClient = options.apiClient;
	
	this._s3Backoff = 1;
	this._s3ConsecutiveFailures = 0;
	this._maxS3Backoff = 60;
	this._maxS3ConsecutiveFailures = options.maxS3ConsecutiveFailures !== undefined
		? options.maxS3ConsecutiveFailures : 5;
};
Zotero.Sync.Storage.Mode.ZFS.prototype = {
	mode: "zfs",
	name: "ZFS",
	verified: true,
	
	
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
		
		var path = item.getFilePath();
		if (!path) {
			Zotero.debug(`Cannot download file for attachment ${item.libraryKey} with no path`);
			return new Zotero.Sync.Storage.Result;
		}
		
		var destPath = OS.Path.join(Zotero.getTempDirectory().path, item.key + '.tmp');
		
		// saveURI() below appears not to create empty files for Content-Length: 0,
		// so we create one here just in case, which also lets us check file access
		try {
			let file = yield OS.File.open(destPath, {
				truncate: true
			});
			file.close();
		}
		catch (e) {
			Zotero.File.checkFileAccessError(e, destPath, 'create');
		}
		
		var deferred = Zotero.Promise.defer();
		var requestData = {item};
		
		var listener = new Zotero.Sync.Storage.StreamListener(
			{
				onStart: function (req) {
					if (request.isFinished()) {
						Zotero.debug("Download request " + request.name
							+ " stopped before download started -- closing channel");
						req.cancel(Components.results.NS_BINDING_ABORTED);
						deferred.resolve(new Zotero.Sync.Storage.Result);
					}
				},
				onChannelRedirect: Zotero.Promise.coroutine(function* (oldChannel, newChannel, flags) {
					// These will be used in processDownload() if the download succeeds
					oldChannel.QueryInterface(Components.interfaces.nsIHttpChannel);
					
					Zotero.debug("CHANNEL HERE FOR " + item.libraryKey + " WITH " + oldChannel.status);
					Zotero.debug(oldChannel.URI.spec);
					Zotero.debug(newChannel.URI.spec);
					
					var header;
					try {
						header = "Zotero-File-Modification-Time";
						requestData.mtime = parseInt(oldChannel.getResponseHeader(header));
						header = "Zotero-File-MD5";
						requestData.md5 = oldChannel.getResponseHeader(header);
						header = "Zotero-File-Compressed";
						requestData.compressed = oldChannel.getResponseHeader(header) == 'Yes';
					}
					catch (e) {
						deferred.reject(new Error(`${header} header not set in file request for ${item.libraryKey}`));
						return false;
					}
					
					if (!(yield OS.File.exists(path))) {
						return true;
					}
					
					var updateHash = false;
					var fileModTime = yield item.attachmentModificationTime;
					if (requestData.mtime == fileModTime) {
						Zotero.debug("File mod time matches remote file -- skipping download of "
							+ item.libraryKey);
					}
					// If not compressed, check hash, in case only timestamp changed
					else if (!requestData.compressed && (yield item.attachmentHash) == requestData.md5) {
						Zotero.debug("File hash matches remote file -- skipping download of "
							+ item.libraryKey);
						updateHash = true;
					}
					else {
						return true;
					}
					
					// Update local metadata and stop request, skipping file download
					yield OS.File.setDates(path, null, new Date(requestData.mtime));
					item.attachmentSyncedModificationTime = requestData.mtime;
					if (updateHash) {
						item.attachmentSyncedHash = requestData.md5;
					}
					item.attachmentSyncState = "in_sync";
					yield item.saveTx({ skipAll: true });
					
					deferred.resolve(new Zotero.Sync.Storage.Result({
						localChanges: true
					}));
					
					return false;
				}),
				onProgress: function (req, progress, progressMax) {
					request.onProgress(progress, progressMax);
				},
				onStop: function (req, status, res) {
					request.setChannel(false);
					
					if (status != 200) {
						if (status == 404) {
							Zotero.debug("Remote file not found for item " + item.libraryKey);
							deferred.resolve(new Zotero.Sync.Storage.Result);
							return;
						}
						
						// Check for SSL certificate error
						if (status == 0) {
							try {
								Zotero.HTTP.checkSecurity(req);
							}
							catch (e) {
								deferred.reject(e);
								return;
							}
						}
						
						// If S3 connection is interrupted, delay and retry, or bail if too many
						// consecutive failures
						if (status == 0 || status == 500 || status == 503) {
							if (++this._s3ConsecutiveFailures < this._maxS3ConsecutiveFailures) {
								let libraryKey = item.libraryKey;
								let msg = "S3 returned 0 for " + libraryKey + " -- retrying download"
								Components.utils.reportError(msg);
								Zotero.debug(msg, 1);
								if (this._s3Backoff < this._maxS3Backoff) {
									this._s3Backoff *= 2;
								}
								Zotero.debug("Delaying " + libraryKey + " download for "
									+ this._s3Backoff + " seconds", 2);
								Zotero.Promise.delay(this._s3Backoff * 1000)
								.then(function () {
									deferred.resolve(this.downloadFile(request));
								}.bind(this));
								return;
							}
							
							Zotero.debug(this._s3ConsecutiveFailures
								+ " consecutive S3 failures -- aborting", 1);
							this._s3ConsecutiveFailures = 0;
						}
						
						var msg = "Unexpected status code " + status + " for GET " + uri;
						Zotero.debug(msg, 1);
						Components.utils.reportError(msg);
						// Output saved content, in case an error was captured
						try {
							let sample = Zotero.File.getContents(destPath, null, 4096);
							if (sample) {
								Zotero.debug(sample, 1);
							}
						}
						catch (e) {
							Zotero.debug(e, 1);
						}
						deferred.reject(new Error(Zotero.Sync.Storage.defaultError));
						return;
					}
					
					// Don't try to process if the request has been cancelled
					if (request.isFinished()) {
						Zotero.debug("Download request " + request.name
							+ " is no longer running after file download", 2);
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
				}.bind(this),
				onCancel: function (req, status) {
					Zotero.debug("Request cancelled");
					if (deferred.promise.isPending()) {
						deferred.resolve(new Zotero.Sync.Storage.Result);
					}
				}
			}
		);
		
		var params = this._getRequestParams(item.libraryID, `items/${item.key}/file`);
		var uri = this.apiClient.buildRequestURI(params);
		var headers = this.apiClient.getHeaders();
		
		Zotero.debug('Saving ' + uri);
		const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
		var wbp = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
			.createInstance(nsIWBP);
		wbp.persistFlags = nsIWBP.PERSIST_FLAGS_BYPASS_CACHE;
		wbp.progressListener = listener;
		Zotero.Utilities.Internal.saveURI(wbp, uri, destPath, headers);
		
		return deferred.promise;
	}),
	
	
	uploadFile: Zotero.Promise.coroutine(function* (request) {
		var item = Zotero.Sync.Storage.Utilities.getItemFromRequest(request);
		var multipleFiles = yield Zotero.Attachments.hasMultipleFiles(item);
		
		// If we got a quota error for this library, skip upload for all multi-file attachments
		// and for single-file attachments that are bigger than the remaining space. This is cleared
		// in storageEngine for manual syncs.
		var remaining = Zotero.Sync.Storage.Local.storageRemainingForLibrary.get(item.libraryID);
		if (remaining !== undefined) {
			let skip = false;
			if (multipleFiles) {
				Zotero.debug("Skipping multi-file upload after quota error");
				skip = true;
			}
			else {
				let size;
				try {
					// API rounds megabytes to 1 decimal place
					size = ((yield OS.File.stat(item.getFilePath())).size / 1024 / 1024).toFixed(1);
				}
				catch (e) {
					Zotero.logError(e);
				}
				if (size >= remaining) {
					Zotero.debug(`Skipping file upload after quota error (${size} >= ${remaining})`);
					skip = true;
				}
			}
			if (skip) {
				throw yield this._getQuotaError(item);
			}
		}
		
		if (multipleFiles) {
			let created = yield Zotero.Sync.Storage.Utilities.createUploadFile(request);
			if (!created) {
				return new Zotero.Sync.Storage.Result;
			}
		}
		return this._processUploadFile(request);
	}),
	
	
	/**
	 * Remove all synced files from the server
	 */
	purgeDeletedStorageFiles: Zotero.Promise.coroutine(function* (libraryID) {
		if (libraryID != Zotero.Libraries.userLibraryID) return;
		
		var sql = "SELECT value FROM settings WHERE setting=? AND key=?";
		var values = yield Zotero.DB.columnQueryAsync(sql, ['storage', 'zfsPurge']);
		if (!values.length) {
			return false;
		}
		
		Zotero.debug("Unlinking synced files on ZFS");
		
		var params = this._getRequestParams(libraryID, "removestoragefiles");
		var uri = this.apiClient.buildRequestURI(params);
		
		yield Zotero.HTTP.request("POST", uri, "");
		
		var sql = "DELETE FROM settings WHERE setting=? AND key=?";
		yield Zotero.DB.queryAsync(sql, ['storage', 'zfsPurge']);
	}),
	
	
	//
	// Private methods
	//
	_getRequestParams: function (libraryID, target) {
		var library = Zotero.Libraries.get(libraryID);
		return {
			libraryType: library.libraryType,
			libraryTypeID: library.libraryTypeID,
			target
		};
	},
	
	
	/**
	 * Get authorization from API for uploading file
	 *
	 * @param {Zotero.Item} item
	 * @return {Object|String} - Object with upload params or 'exists'
	 */
	_getFileUploadParameters: Zotero.Promise.coroutine(function* (item) {
		var funcName = "Zotero.Sync.Storage.ZFS._getFileUploadParameters()";
		
		var path = item.getFilePath();
		var filename = OS.Path.basename(path);
		var zip = yield Zotero.Attachments.hasMultipleFiles(item);
		if (zip) {
			var uploadPath = OS.Path.join(Zotero.getTempDirectory().path, item.key + '.zip');
		}
		else {
			var uploadPath = path;
		}
		
		var params = this._getRequestParams(item.libraryID, `items/${item.key}/file`);
		var uri = this.apiClient.buildRequestURI(params);
		
		// TODO: One-step uploads
		/*var headers = {
			"Content-Type": "application/json"
		};
		var storedHash = yield Zotero.Sync.Storage.Local.getSyncedHash(item.id);
		//var storedModTime = yield Zotero.Sync.Storage.getSyncedModificationTime(item.id);
		if (storedHash) {
			headers["If-Match"] = storedHash;
		}
		else {
			headers["If-None-Match"] = "*";
		}
		var mtime = yield item.attachmentModificationTime;
		var hash = Zotero.Utilities.Internal.md5(file);
		var json = {
			md5: hash,
			mtime,
			filename,
			size: file.fileSize
		};
		if (zip) {
			json.zip = true;
		}
		
		try {
			var req = yield this.apiClient.makeRequest(
				"POST", uri, { body: JSON.stringify(json), headers, debug: true }
			);
		}*/
		
		var headers = {
			"Content-Type": "application/x-www-form-urlencoded"
		};
		var storedHash = item.attachmentSyncedHash;
		//var storedModTime = yield Zotero.Sync.Storage.getSyncedModificationTime(item.id);
		if (storedHash) {
			headers["If-Match"] = storedHash;
		}
		else {
			headers["If-None-Match"] = "*";
		}
		
		// Build POST body
		var params = {
			mtime: yield item.attachmentModificationTime,
			md5: yield item.attachmentHash,
			filename,
			filesize: (yield OS.File.stat(uploadPath)).size
		};
		if (zip) {
			params.zipMD5 = yield Zotero.Utilities.Internal.md5Async(uploadPath);
			params.zipFilename = OS.Path.basename(uploadPath);
		}
		var body = [];
		for (let i in params) {
			body.push(i + "=" + encodeURIComponent(params[i]));
		}
		body = body.join('&');
		
		var req;
		while (true) {
			try {
				req = yield this.apiClient.makeRequest(
					"POST",
					uri,
					{
						body,
						headers,
						// This should include all errors in _handleUploadAuthorizationFailure()
						successCodes: [200, 201, 204, 403, 404, 412, 413],
						debug: true
					}
				);
			}
			catch (e) {
				if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
					let msg = "Unexpected status code " + e.status + " in " + funcName
						 + " (" + item.libraryKey + ")";
					Zotero.logError(msg);
					Zotero.debug(e.xmlhttp.getAllResponseHeaders());
					throw new Error(Zotero.Sync.Storage.defaultError);
				}
				throw e;
			}
			
			let result = yield this._handleUploadAuthorizationFailure(req, item);
			if (result instanceof Zotero.Sync.Storage.Result) {
				return result;
			}
			// If remote attachment exists but has no hash (which can happen for an old (pre-4.0?)
			// attachment with just an mtime, or after a storage purge), send again with If-None-Match
			else if (result == "ERROR_412_WITHOUT_VERSION") {
				if (headers["If-None-Match"]) {
					throw new Error("412 returned for request with If-None-Match");
				}
				delete headers["If-Match"];
				headers["If-None-Match"] = "*";
				storedHash = null;
				Zotero.debug("Retrying with If-None-Match");
			}
			else {
				break;
			}
		}
		
		try {
			var json = JSON.parse(req.responseText);
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.debug(req.responseText, 1);
		}
		if (!json) {
			 throw new Error("Invalid response retrieving file upload parameters");
		}
		
		if (!json.uploadKey && !json.exists) {
			throw new Error("Invalid response retrieving file upload parameters");
		}
		
		if (json.exists) {
			let version = req.getResponseHeader('Last-Modified-Version');
			if (!version) {
				throw new Error("Last-Modified-Version not provided");
			}
			json.version = version;
		}
		
		// TEMP
		//
		// Passed through to _updateItemFileInfo()
		json.mtime = params.mtime;
		json.md5 = params.md5;
		if (storedHash) {
			json.storedHash = storedHash;
		}
		
		return json;
	}),
	
	
	/**
	 * Handle known errors from upload authorization request
	 *
	 * These must be included in successCodes in _getFileUploadParameters()
	 */
	_handleUploadAuthorizationFailure: Zotero.Promise.coroutine(function* (req, item) {
		//
		// These must be included in successCodes above.
		// TODO: 429?
		if (req.status == 403) {
			let groupID = Zotero.Groups.getGroupIDFromLibraryID(item.libraryID);
			let e = new Zotero.Error(
				"File editing denied for group",
				"ZFS_FILE_EDITING_DENIED",
				{
					groupID: groupID
				}
			);
			throw e;
		}
		// This shouldn't happen, but if it does, mark item for upload and restart sync
		else if (req.status == 404) {
			Zotero.logError(`Item ${item.libraryID}/${item.key} not found in upload authorization `
				+ 'request -- marking for upload');
			yield Zotero.Sync.Data.Local.markObjectAsUnsynced(item);
			return new Zotero.Sync.Storage.Result({
				syncRequired: true
			});
		}
		else if (req.status == 412) {
			let version = req.getResponseHeader('Last-Modified-Version');
			if (!version) {
				return "ERROR_412_WITHOUT_VERSION";
			}
			if (version > item.version) {
				return new Zotero.Sync.Storage.Result({
					syncRequired: true
				});
			}
			
			// Get updated item metadata
			let library = Zotero.Libraries.get(item.libraryID);
			let json = yield this.apiClient.downloadObjects(
				library.libraryType,
				library.libraryTypeID,
				'item',
				[item.key]
			)[0];
			if (!Array.isArray(json)) {
				Zotero.logError(json);
				throw new Error(Zotero.Sync.Storage.defaultError);
			}
			if (json.length > 1) {
				throw new Error("More than one result for item lookup");
			}
			
			yield Zotero.Sync.Data.Local.saveCacheObjects('item', item.libraryID, json);
			json = json[0];
			
			if (json.data.version > item.version) {
				return new Zotero.Sync.Storage.Result({
					syncRequired: true
				});
			}
			
			let fileHash = yield item.attachmentHash;
			let fileModTime = yield item.attachmentModificationTime;
			
			Zotero.debug("MD5");
			Zotero.debug(json.data.md5);
			Zotero.debug(fileHash);
			
			if (json.data.md5 == fileHash) {
				item.attachmentSyncedModificationTime = fileModTime;
				item.attachmentSyncedHash = fileHash;
				item.attachmentSyncState = "in_sync";
				yield item.saveTx({ skipAll: true });
				
				return new Zotero.Sync.Storage.Result;
			}
			
			item.attachmentSyncState = "in_conflict";
			yield item.saveTx({ skipAll: true });
			
			return new Zotero.Sync.Storage.Result({
				fileSyncRequired: true
			});
		}
		else if (req.status == 413) {
			let retry = req.getResponseHeader('Retry-After');
			if (retry) {
				let minutes = Math.round(retry / 60);
				throw new Zotero.Error(
					Zotero.getString('sync.storage.error.zfs.tooManyQueuedUploads', minutes),
					"ZFS_UPLOAD_QUEUE_LIMIT"
				);
			}
			
			// Store the remaining space so that we can skip files bigger than that until the next
			// manual sync
			let usage = req.getResponseHeader('Zotero-Storage-Usage');
			let quota = req.getResponseHeader('Zotero-Storage-Quota');
			Zotero.Sync.Storage.Local.storageRemainingForLibrary.set(item.libraryID, quota - usage);
			
			throw yield this._getQuotaError(item);
		}
	}),
	
	/**
	 * Given parameters from authorization, upload file to S3
	 */
	_uploadFile: Zotero.Promise.coroutine(function* (request, item, params) {
		if (request.isFinished()) {
			Zotero.debug("Upload request " + request.name + " is no longer running after getting "
				+ "upload parameters");
			return new Zotero.Sync.Storage.Result;
		}
		
		var file = yield this._getUploadFile(item);
		
		Components.utils.importGlobalProperties(["File"]);
		file = File.createFromFileName ? File.createFromFileName(file.path) : new File(file);
		// File.createFromFileName() returns a Promise in Fx54+
		if (file.then) {
			file = yield file;
		}
		
		var blob = new Blob([params.prefix, file, params.suffix]);
		
		try {
			var req = yield Zotero.HTTP.request(
				"POST",
				params.url,
				{
					headers: {
						"Content-Type": params.contentType
					},
					body: blob,
					requestObserver: function (req) {
						request.setChannel(req.channel);
						req.upload.addEventListener("progress", function (event) {
							if (event.lengthComputable) {
								request.onProgress(event.loaded, event.total);
							}
						});
					},
					debug: true,
					successCodes: [201],
					timeout: 0
				}
			);
		}
		catch (e) {
			// Certificate error
			if (e instanceof Zotero.Error) {
				throw e;
			}
			
			// For timeouts and failures from S3, which happen intermittently,
			// wait a little and try again
			let timeoutMessage = "Your socket connection to the server was not read from or "
				+ "written to within the timeout period.";
			if (e.status == 0
					|| (e.status == 400 && e.xmlhttp.responseText.indexOf(timeoutMessage) != -1)) {
				if (this._s3ConsecutiveFailures >= this._maxS3ConsecutiveFailures) {
					Zotero.debug(this._s3ConsecutiveFailures
						+ " consecutive S3 failures -- aborting", 1);
					this._s3ConsecutiveFailures = 0;
					let e = Zotero.getString('sync.storage.error.zfs.restart', Zotero.appName);
					throw new Error(e);
				}
				else {
					let msg = "S3 returned " + e.status + " (" + item.libraryKey + ") "
						+ "-- retrying upload"
					Zotero.logError(msg);
					Zotero.debug(e.xmlhttp.responseText, 1);
					if (this._s3Backoff < this._maxS3Backoff) {
						this._s3Backoff *= 2;
					}
					this._s3ConsecutiveFailures++;
					Zotero.debug("Delaying " + item.libraryKey + " upload for "
						+ this._s3Backoff + " seconds", 2);
					yield Zotero.Promise.delay(this._s3Backoff * 1000);
					return this._uploadFile(request, item, params);
				}
			}
			else if (e.status == 500) {
				// TODO: localize
				throw new Error("File upload failed. Please try again.");
			}
			else {
				Zotero.logError(`Unexpected file upload status ${e.status} (${item.libraryKey})`);
				Zotero.debug(e, 1);
				Components.utils.reportError(e.xmlhttp.responseText);
				throw new Error(Zotero.Sync.Storage.defaultError);
			}
			
			// TODO: Detect cancel?
			//onUploadCancel(httpRequest, status, data)
			//deferred.resolve(false);
		}
		
		request.setChannel(false);
		return this._onUploadComplete(req, request, item, params);
	}),
	
	
	/**
	 * Post-upload file registration with API
	 */
	_onUploadComplete: Zotero.Promise.coroutine(function* (req, request, item, params) {
		var uploadKey = params.uploadKey;
		
		Zotero.debug("Upload of attachment " + item.key + " finished with status code " + req.status);
		Zotero.debug(req.responseText);
		
		// Decrease backoff delay on successful upload
		if (this._s3Backoff > 1) {
			this._s3Backoff /= 2;
		}
		// And reset consecutive failures
		this._s3ConsecutiveFailures = 0;
		
		var requestParams = this._getRequestParams(item.libraryID, `items/${item.key}/file`);
		var uri = this.apiClient.buildRequestURI(requestParams);
		var headers = {
			"Content-Type": "application/x-www-form-urlencoded"
		};
		if (params.storedHash) {
			headers["If-Match"] = params.storedHash;
		}
		else {
			headers["If-None-Match"] = "*";
		}
		var body = "upload=" + uploadKey;
		
		// Register upload on server
		try {
			req = yield this.apiClient.makeRequest(
				"POST",
				uri,
				{
					body,
					headers,
					successCodes: [204],
					requestObserver: function (xmlhttp) {
						request.setChannel(xmlhttp.channel);
					},
					debug: true
				}
			);
		}
		catch (e) {
			if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
				let msg = `Unexpected file registration status ${e.status} (${item.libraryKey})`;
				Zotero.logError(msg);
				Zotero.logError(e.xmlhttp.responseText);
				Zotero.debug(e.xmlhttp.getAllResponseHeaders());
				throw new Error(Zotero.Sync.Storage.defaultError);
			}
			throw e;
		}
		
		var version = req.getResponseHeader('Last-Modified-Version');
		if (!version) {
			throw new Error("Last-Modified-Version not provided");
		}
		params.version = version;
		
		yield this._updateItemFileInfo(item, params);
		
		return new Zotero.Sync.Storage.Result({
			localChanges: true,
			remoteChanges: true
		});
	}),
	
	
	/**
	 * Update the local attachment item with the mtime and hash of the uploaded file and the
	 * library version returned by the upload request, and save a modified version of the item
	 * to the sync cache
	 */
	_updateItemFileInfo: Zotero.Promise.coroutine(function* (item, params) {
		// Mark as in-sync
		yield Zotero.DB.executeTransaction(function* () {
				// Store file mod time and hash
			item.attachmentSyncedModificationTime = params.mtime;
			item.attachmentSyncedHash = params.md5;
			item.attachmentSyncState = "in_sync";
			yield item.save({ skipAll: true });
			
			// Update sync cache with new file metadata and version from server
			var json = yield Zotero.Sync.Data.Local.getCacheObject(
				'item', item.libraryID, item.key, item.version
			);
			if (json) {
				json.version = params.version;
				json.data.version = params.version;
				json.data.mtime = params.mtime;
				json.data.md5 = params.md5;
				yield Zotero.Sync.Data.Local.saveCacheObject('item', item.libraryID, json);
			}
			// Update item with new version from server
			yield Zotero.Items.updateVersion([item.id], params.version);
			
			// TODO: Can filename, contentType, and charset change the attachment item?
		});
		
		try {
			if (yield Zotero.Attachments.hasMultipleFiles(item)) {
				var file = Zotero.getTempDirectory();
				file.append(item.key + '.zip');
				yield OS.File.remove(file.path);
			}
		}
		catch (e) {
			Components.utils.reportError(e);
		}
	}),
	
	
	_onUploadCancel: Zotero.Promise.coroutine(function* (httpRequest, status, data) {
		var request = data.request;
		var item = data.item;
		
		Zotero.debug("Upload of attachment " + item.key + " cancelled with status code " + status);
		
		try {
			if (yield Zotero.Attachments.hasMultipleFiles(item)) {
				var file = Zotero.getTempDirectory();
				file.append(item.key + '.zip');
				file.remove(false);
			}
		}
		catch (e) {
			Components.utils.reportError(e);
		}
	}),
	
	
	_getUploadFile: Zotero.Promise.coroutine(function* (item) {
		if (yield Zotero.Attachments.hasMultipleFiles(item)) {
			var file = Zotero.getTempDirectory();
			var filename = item.key + '.zip';
			file.append(filename);
		}
		else {
			var file = item.getFile();
		}
		return file;
	}),
	
	
	/**
	 * Get attachment item metadata on storage server
	 *
	 * @param {Zotero.Item} item
	 * @param {Zotero.Sync.Storage.Request} request
	 * @return {Promise<Object>|false} - Promise for object with 'hash', 'filename', 'mtime',
	 *                                   'compressed', or false if item not found
	 */
	_getStorageFileInfo: Zotero.Promise.coroutine(function* (item, request) {
		var funcName = "Zotero.Sync.Storage.ZFS._getStorageFileInfo()";
		
		var params = this._getRequestParams(item.libraryID, `items/${item.key}/file`);
		var uri = this.apiClient.buildRequestURI(params);
		
		try {
			let req = yield this.apiClient.makeRequest(
				"GET",
				uri,
				{
					successCodes: [200, 404],
					requestObserver: function (xmlhttp) {
						request.setChannel(xmlhttp.channel);
					}
				}
			);
			if (req.status == 404) {
				return new Zotero.Sync.Storage.Result;
			}
			
			let info = {};
			info.hash = req.getResponseHeader('ETag');
			if (!info.hash) {
				let msg = `Hash not found in info response in ${funcName} (${item.libraryKey})`;
				Zotero.debug(msg, 1);
				Zotero.debug(req.status);
				Zotero.debug(req.responseText);
				Components.utils.reportError(msg);
				try {
					Zotero.debug(req.getAllResponseHeaders());
				}
				catch (e) {
					Zotero.debug("Response headers unavailable");
				}
				let e = Zotero.getString('sync.storage.error.zfs.restart', Zotero.appName);
				throw new Error(e);
			}
			info.filename = req.getResponseHeader('X-Zotero-Filename');
			let mtime = req.getResponseHeader('X-Zotero-Modification-Time');
			info.mtime = parseInt(mtime);
			info.compressed = req.getResponseHeader('X-Zotero-Compressed') == 'Yes';
			Zotero.debug(info);
			
			return info;
		}
		catch (e) {
			if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
				if (e.xmlhttp.status == 0) {
					var msg = "Request cancelled getting storage file info";
				}
				else {
					var msg = "Unexpected status code " + e.xmlhttp.status
						+ " getting storage file info for item " + item.libraryKey;
				}
				Zotero.debug(msg, 1);
				Zotero.debug(e.xmlhttp.responseText);
				Components.utils.reportError(msg);
				throw new Error(Zotero.Sync.Storage.defaultError);
			}
			
			throw e;
		}
	}),
	
	
	/**
	 * Upload the file to the server
	 *
	 * @param {Zotero.Sync.Storage.Request} request
	 * @return {Promise}
	 */
	_processUploadFile: Zotero.Promise.coroutine(function* (request) {
		/*
		updateSizeMultiplier(
			(100 - Zotero.Sync.Storage.compressionTracker.ratio) / 100
		);
		*/
		
		var item = Zotero.Sync.Storage.Utilities.getItemFromRequest(request);
		
		
		/*var info = yield this._getStorageFileInfo(item, request);
		
		if (request.isFinished()) {
			Zotero.debug("Upload request '" + request.name
				+ "' is no longer running after getting file info");
			return false;
		}
		
		// Check for conflict
		if (item.attachmentSyncState
				!= Zotero.Sync.Storage.Local.SYNC_STATE_FORCE_UPLOAD) {
			if (info) {
				// Local file time
				var fmtime = yield item.attachmentModificationTime;
				// Remote mod time
				var mtime = info.mtime;
				
				var useLocal = false;
				var same = !(yield Zotero.Sync.Storage.checkFileModTime(item, fmtime, mtime));
				
				// Ignore maxed-out 32-bit ints, from brief problem after switch to 32-bit servers
				if (!same && mtime == 2147483647) {
					Zotero.debug("Remote mod time is invalid -- uploading local file version");
					useLocal = true;
				}
				
				if (same) {
					yield Zotero.DB.executeTransaction(function* () {
						yield Zotero.Sync.Storage.setSyncedModificationTime(item.id, fmtime);
						yield Zotero.Sync.Storage.setSyncState(
							item.id, Zotero.Sync.Storage.Local.SYNC_STATE_IN_SYNC
						);
					});
					return {
						localChanges: true,
						remoteChanges: false
					};
				}
				
				let smtime = yield Zotero.Sync.Storage.getSyncedModificationTime(item.id);
				if (!useLocal && smtime != mtime) {
					Zotero.debug("Conflict -- last synced file mod time "
						+ "does not match time on storage server"
						+ " (" + smtime + " != " + mtime + ")");
					return {
						localChanges: false,
						remoteChanges: false,
						conflict: {
							local: { modTime: fmtime },
							remote: { modTime: mtime }
						}
					};
				}
			}
			else {
				Zotero.debug("Remote file not found for item " + item.libraryKey);
			}
		}*/
		
		var result = yield this._getFileUploadParameters(item);
		if (result.exists) {
			yield this._updateItemFileInfo(item, result);
			return new Zotero.Sync.Storage.Result({
				localChanges: true,
				remoteChanges: true
			});
		}
		else if (result instanceof Zotero.Sync.Storage.Result) {
			return result;
		}
		return this._uploadFile(request, item, result);
	}),
	
	
	_getQuotaError: async function (item) {
		var text, buttonText = null, buttonCallback;
		var libraryType = item.library.libraryType;
		
		// Group file
		if (libraryType == 'group') {
			let group = Zotero.Groups.getByLibraryID(item.libraryID);
			text = Zotero.getString('sync.storage.error.zfs.groupQuotaReached1', group.name) + "\n\n"
					+ Zotero.getString('sync.storage.error.zfs.groupQuotaReached2');
		}
		// Personal file
		else {
			text = Zotero.getString('sync.storage.error.zfs.personalQuotaReached1') + "\n\n"
					+ Zotero.getString('sync.storage.error.zfs.personalQuotaReached2');
			buttonText = Zotero.getString('sync.storage.openAccountSettings');
			buttonCallback = function () {
				let url = "https://www.zotero.org/settings/storage";
				let win = Services.wm.getMostRecentWindow("navigator:browser");
				win.ZoteroPane.loadURI(url, { metaKey: true, ctrlKey: true, shiftKey: true });
			}
		}
		
		var filename = item.attachmentFilename;
		var fileSize = (await OS.File.stat(item.getFilePath())).size;
		
		text += "\n\n" + filename + " (" + Math.round(fileSize / 1024) + " KB)";
		
		var e = new Zotero.Error(
			text,
			"ZFS_OVER_QUOTA",
			{
				dialogButtonText: buttonText,
				dialogButtonCallback: buttonCallback
			}
		);
		e.errorType = 'warning';
		return e;
	}
}
