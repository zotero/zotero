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


Zotero.Sync.Storage.ZFS = (function () {
	var _rootURI;
	var _userURI;
	var _headers = {
		"Zotero-API-Version" : ZOTERO_CONFIG.API_VERSION
	};
	var _cachedCredentials = false;
	var _s3Backoff = 1;
	var _s3ConsecutiveFailures = 0;
	var _maxS3Backoff = 60;
	var _maxS3ConsecutiveFailures = 5;
	
	/**
	 * Get file metadata on storage server
	 *
	 * @param	{Zotero.Item}	item
	 * @param	{Function}		callback		Callback f(item, etag)
	 */
	function getStorageFileInfo(item, request) {
		var funcName = "Zotero.Sync.Storage.ZFS.getStorageFileInfo()";
		
		return Zotero.HTTP.promise("GET", getItemInfoURI(item),
			{
				successCodes: [200, 404],
				headers: _headers,
				requestObserver: function (xmlhttp) {
					request.setChannel(xmlhttp.channel);
				}
			})
			.then(function (req) {
				if (req.status == 404) {
					return false;
				}
				
				var info = {};
				info.hash = req.getResponseHeader('ETag');
				if (!info.hash) {
					var msg = "Hash not found in info response in " + funcName
								+ " (" + Zotero.Items.getLibraryKeyHash(item) + ")";
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
					var msg = Zotero.getString('sync.storage.error.zfs.restart', Zotero.appName);
					throw msg;
				}
				info.filename = req.getResponseHeader('X-Zotero-Filename');
				var mtime = req.getResponseHeader('X-Zotero-Modification-Time');
				info.mtime = parseInt(mtime);
				info.compressed = req.getResponseHeader('X-Zotero-Compressed') == 'Yes';
				Zotero.debug(info);
				
				return info;
			})
			.catch(function (e) {
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
			});
	}
	
	
	/**
	 * Upload the file to the server
	 *
	 * @param	{Object}		Object with 'request' property
	 * @return	{void}
	 */
	function processUploadFile(data) {
		/*
		updateSizeMultiplier(
			(100 - Zotero.Sync.Storage.compressionTracker.ratio) / 100
		);
		*/
		
		var request = data.request;
		var item = Zotero.Sync.Storage.getItemFromRequestName(request.name);
		return getStorageFileInfo(item, request)
			.then(function (info) {
				if (request.isFinished()) {
					Zotero.debug("Upload request '" + request.name
						+ "' is no longer running after getting file info");
					return false;
				}
				
				// Check for conflict
				if (Zotero.Sync.Storage.getSyncState(item.id)
						!= Zotero.Sync.Storage.SYNC_STATE_FORCE_UPLOAD) {
					if (info) {
						// Remote mod time
						var mtime = info.mtime;
						// Local file time
						var fmtime = item.attachmentModificationTime;
						
						var same = false;
						var useLocal = false;
						if (fmtime == mtime) {
							same = true;
							Zotero.debug("File mod time matches remote file -- skipping upload");
						}
						// Allow floored timestamps for filesystems that don't support
						// millisecond precision (e.g., HFS+)
						else if (Math.floor(mtime / 1000) * 1000 == fmtime || Math.floor(fmtime / 1000) * 1000 == mtime) {
							same = true;
							Zotero.debug("File mod times are within one-second precision (" + fmtime + " ≅ " + mtime + ") "
								+ "-- skipping upload");
						}
						// Allow timestamp to be exactly one hour off to get around
						// time zone issues -- there may be a proper way to fix this
						else if (Math.abs(fmtime - mtime) == 3600000
								// And check with one-second precision as well
								|| Math.abs(fmtime - Math.floor(mtime / 1000) * 1000) == 3600000
								|| Math.abs(Math.floor(fmtime / 1000) * 1000 - mtime) == 3600000) {
							same = true;
							Zotero.debug("File mod time (" + fmtime + ") is exactly one hour off remote file (" + mtime + ") "
								+ "-- assuming time zone issue and skipping upload");
						}
						// Ignore maxed-out 32-bit ints, from brief problem after switch to 32-bit servers
						else if (mtime == 2147483647) {
							Zotero.debug("Remote mod time is invalid -- uploading local file version");
							useLocal = true;
						}
						
						if (same) {
							Zotero.debug(Zotero.Sync.Storage.getSyncedModificationTime(item.id));
							
							Zotero.DB.beginTransaction();
							var syncState = Zotero.Sync.Storage.getSyncState(item.id);
							//Zotero.Sync.Storage.setSyncedModificationTime(item.id, fmtime, true);
							Zotero.Sync.Storage.setSyncedModificationTime(item.id, fmtime);
							Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_IN_SYNC);
							Zotero.DB.commitTransaction();
							return {
								localChanges: true,
								remoteChanges: false
							};
						}
						
						var smtime = Zotero.Sync.Storage.getSyncedModificationTime(item.id);
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
						Zotero.debug("Remote file not found for item " + item.libraryID + "/" + item.key);
					}
				}
				
				return getFileUploadParameters(
					item,
					function (item, target, uploadKey, params) {
						return postFile(request, item, target, uploadKey, params);
					},
					function () {
						updateItemFileInfo(item);
						return {
							localChanges: true,
							remoteChanges: false
						};
					}
				);
			});
	}
	
	
	/**
	 * Get mod time of file on storage server
	 *
	 * @param	{Zotero.Item}					item
	 * @param	{Function}		uploadCallback					Callback f(request, item, target, params)
	 * @param	{Function}		existsCallback					Callback f() to call when file already exists
	 *																on server and uploading isn't necessary
	 */
	function getFileUploadParameters(item, uploadCallback, existsCallback) {
		var funcName = "Zotero.Sync.Storage.ZFS.getFileUploadParameters()";
		
		var uri = getItemURI(item);
		
		if (Zotero.Attachments.getNumFiles(item) > 1) {
			var file = Zotero.getTempDirectory();
			var filename = item.key + '.zip';
			file.append(filename);
			uri.spec = uri.spec;
			var zip = true;
		}
		else {
			var file = item.getFile();
			var filename = file.leafName;
			var zip = false;
		}
		
		var mtime = item.attachmentModificationTime;
		var hash = Zotero.Utilities.Internal.md5(file);
		
		var body = "md5=" + hash + "&filename=" + encodeURIComponent(filename)
					+ "&filesize=" + file.fileSize + "&mtime=" + mtime;
		if (zip) {
			body += "&zip=1";
		}
		
		return Zotero.HTTP.promise("POST", uri, { body: body, headers: _headers, debug: true })
			.then(function (req) {
				if (!req.responseXML) {
					throw new Error("Invalid response retrieving file upload parameters");
				}
				
				var rootTag = req.responseXML.documentElement.tagName;
				
				if (rootTag != 'upload' && rootTag != 'exists') {
					throw new Error("Invalid response retrieving file upload parameters");
				}
				
				// File was already available, so uploading isn't required
				if (rootTag == 'exists') {
					return existsCallback();
				}
				
				var url = req.responseXML.getElementsByTagName('url')[0].textContent;
				var uploadKey = req.responseXML.getElementsByTagName('key')[0].textContent;
				var params = {}, p = '';
				var paramNodes = req.responseXML.getElementsByTagName('params')[0].childNodes;
				for (var i = 0; i < paramNodes.length; i++) {
					params[paramNodes[i].tagName] = paramNodes[i].textContent;
				}
				return uploadCallback(item, url, uploadKey, params);
			})
			.fail(function (e) {
				if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
					if (e.status == 413) {
						var retry = e.xmlhttp.getResponseHeader('Retry-After');
						if (retry) {
							var minutes = Math.round(retry / 60);
							var e = new Zotero.Error(
								Zotero.getString('sync.storage.error.zfs.tooManyQueuedUploads', minutes),
								"ZFS_UPLOAD_QUEUE_LIMIT"
							);
							throw e;
						}
						
						var text, buttonText = null, buttonCallback;
						
						// Group file
						if (item.libraryID) {
							var group = Zotero.Groups.getByLibraryID(item.libraryID);
							text = Zotero.getString('sync.storage.error.zfs.groupQuotaReached1', group.name) + "\n\n"
									+ Zotero.getString('sync.storage.error.zfs.groupQuotaReached2');
						}
						// Personal file
						else {
							text = Zotero.getString('sync.storage.error.zfs.personalQuotaReached1') + "\n\n"
									+ Zotero.getString('sync.storage.error.zfs.personalQuotaReached2');
							buttonText = Zotero.getString('sync.storage.openAccountSettings');
							buttonCallback = function () {
								var url = "https://www.zotero.org/settings/storage";
								
								var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
											.getService(Components.interfaces.nsIWindowMediator);
								var win = wm.getMostRecentWindow("navigator:browser");
								win.ZoteroPane.loadURI(url);
							}
						}
						
						text += "\n\n" + filename + " (" + Math.round(file.fileSize / 1024) + "KB)";
						
						var e = new Zotero.Error(
							Zotero.getString('sync.storage.error.zfs.fileWouldExceedQuota', filename),
							"ZFS_OVER_QUOTA",
							{
								dialogText: text,
								dialogButtonText: buttonText,
								dialogButtonCallback: buttonCallback
							}
						);
						e.errorMode = 'warning';
						Zotero.debug(e, 2);
						Components.utils.reportError(e);
						throw e;
					}
					else if (e.status == 403) {
						var groupID = Zotero.Groups.getGroupIDFromLibraryID(item.libraryID);
						var e = new Zotero.Error(
							"File editing denied for group",
							"ZFS_FILE_EDITING_DENIED",
							{
								groupID: groupID
							}
						);
						throw e;
					}
					else if (e.status == 404) {
						Components.utils.reportError("Unexpected status code 404 in " + funcName
									 + " (" + Zotero.Items.getLibraryKeyHash(item) + ")");
						if (Zotero.Prefs.get('sync.debugNoAutoResetClient')) {
							Components.utils.reportError("Skipping automatic client reset due to debug pref");
							return;
						}
						if (!Zotero.Sync.Server.canAutoResetClient) {
							Components.utils.reportError("Client has already been auto-reset -- manual sync required");
							return;
						}
						Zotero.Sync.Server.resetClient();
						Zotero.Sync.Server.canAutoResetClient = false;
						throw new Error(Zotero.Sync.Storage.defaultError);
					}
					
					var msg = "Unexpected status code " + e.status + " in " + funcName
								 + " (" + Zotero.Items.getLibraryKeyHash(item) + ")";
					Zotero.debug(msg, 1);
					Zotero.debug(e.xmlhttp.getAllResponseHeaders());
					Components.utils.reportError(msg);
					throw new Error(Zotero.Sync.Storage.defaultError);
				}
				
				throw e;
			});
	}
	
	
	function postFile(request, item, url, uploadKey, params) {
		if (request.isFinished()) {
			Zotero.debug("Upload request " + request.name + " is no longer running after getting upload parameters");
			return false;
		}
		
		var file = getUploadFile(item);
		
		// TODO: make sure this doesn't appear in file
		var boundary = "---------------------------" + Math.random().toString().substr(2);
		
		var mis = Components.classes["@mozilla.org/io/multiplex-input-stream;1"]
					.createInstance(Components.interfaces.nsIMultiplexInputStream);
		
		// Add parameters
		for (var key in params) {
			var storage = Components.classes["@mozilla.org/storagestream;1"]
							.createInstance(Components.interfaces.nsIStorageStream);
			storage.init(4096, 4294967295, null); // PR_UINT32_MAX
			var out = storage.getOutputStream(0);
			
			var conv = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
							.createInstance(Components.interfaces.nsIConverterOutputStream);
			conv.init(out, null, 4096, "?");
			
			var str = "--" + boundary + '\r\nContent-Disposition: form-data; name="' + key + '"'
						+ '\r\n\r\n' + params[key] + '\r\n';
			conv.writeString(str);
			conv.close();
			
			var instr = storage.newInputStream(0);
			mis.appendStream(instr);
		}
		
		// Add file
		var sis = Components.classes["@mozilla.org/io/string-input-stream;1"]
					.createInstance(Components.interfaces.nsIStringInputStream);
		var str = "--" + boundary + '\r\nContent-Disposition: form-data; name="file"\r\n\r\n';
		sis.setData(str, -1);
		mis.appendStream(sis);
		
		var fis = Components.classes["@mozilla.org/network/file-input-stream;1"]
					.createInstance(Components.interfaces.nsIFileInputStream);
		fis.init(file, 0x01, 0, Components.interfaces.nsIFileInputStream.CLOSE_ON_EOF
			| Components.interfaces.nsIFileInputStream.REOPEN_ON_REWIND);
		
		var bis = Components.classes["@mozilla.org/network/buffered-input-stream;1"]
					.createInstance(Components.interfaces.nsIBufferedInputStream)
		bis.init(fis, 64 * 1024);
		mis.appendStream(bis);
		
		// End request
		var sis = Components.classes["@mozilla.org/io/string-input-stream;1"]
					.createInstance(Components.interfaces.nsIStringInputStream);
		var str = "\r\n--" + boundary + "--";
		sis.setData(str, -1);
		mis.appendStream(sis);
		
		
	/*	var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].
		createInstance(Components.interfaces.nsIConverterInputStream);
		cstream.init(mis, "UTF-8", 0, 0); // you can use another encoding here if you wish
		
		let (str = {}) {
			cstream.readString(-1, str); // read the whole file and put it in str.value
			data = str.value;
		}
		cstream.close(); // this closes fstream
		alert(data);
	*/	
		
		var ios = Components.classes["@mozilla.org/network/io-service;1"].
					getService(Components.interfaces.nsIIOService);
		var uri = ios.newURI(url, null, null);
		var channel = ios.newChannelFromURI(uri);
		
		channel.QueryInterface(Components.interfaces.nsIUploadChannel);
		channel.setUploadStream(mis, "multipart/form-data", -1);
		channel.QueryInterface(Components.interfaces.nsIHttpChannel);
		channel.requestMethod = 'POST';
		channel.allowPipelining = false;
		channel.setRequestHeader('Keep-Alive', '', false);
		channel.setRequestHeader('Connection', '', false);
		channel.setRequestHeader("Content-Type", "multipart/form-data; boundary=" + boundary, false);
		//channel.setRequestHeader('Date', date, false);
		
		request.setChannel(channel);
		
		var deferred = Q.defer();
		
		var listener = new Zotero.Sync.Storage.StreamListener(
			{
				onProgress: function (a, b, c) {
					request.onProgress(a, b, c);
				},
				onStop: function (httpRequest, status, response, data) {
					data.request.setChannel(false);
					
					// For timeouts and failures from S3, which happen intermittently,
					// wait a little and try again
					let timeoutMessage = "Your socket connection to the server was not read from or "
						+ "written to within the timeout period.";
					if (status == 0 || (status == 400 && response.indexOf(timeoutMessage) != -1)) {
						if (_s3ConsecutiveFailures >= _maxS3ConsecutiveFailures) {
							Zotero.debug(_s3ConsecutiveFailures
								+ " consecutive S3 failures -- aborting", 1);
							_s3ConsecutiveFailures = 0;
						}
						else {
							let libraryKey = Zotero.Items.getLibraryKeyHash(item);
							let msg = "S3 returned " + status
								+ " (" + libraryKey + ") -- retrying upload"
							Components.utils.reportError(msg);
							Zotero.debug(msg, 1);
							Zotero.debug(response, 1);
							if (_s3Backoff < _maxS3Backoff) {
								_s3Backoff *= 2;
							}
							_s3ConsecutiveFailures++;
							Zotero.debug("Delaying " + libraryKey + " upload for "
								+ _s3Backoff + " seconds", 2);
							Q.delay(_s3Backoff * 1000)
							.then(function () {
								deferred.resolve(postFile(request, item, url, uploadKey, params));
							});
							return;
						}
					}
					
					deferred.resolve(onUploadComplete(httpRequest, status, response, data));
				},
				onCancel: function (httpRequest, status, data) {
					onUploadCancel(httpRequest, status, data)
					deferred.resolve(false);
				},
				request: request,
				item: item,
				uploadKey: uploadKey,
				streams: [mis]
			}
		);
		channel.notificationCallbacks = listener;
		
		var dispURI = uri.clone();
		if (dispURI.password) {
			dispURI.password = '********';
		}
		Zotero.debug("HTTP POST of " + file.leafName + " to " + dispURI.spec);
		
		channel.asyncOpen(listener, null);
		
		return deferred.promise;
	}
	
	
	function onUploadComplete(httpRequest, status, response, data) {
		return Q.try(function () {
			var request = data.request;
			var item = data.item;
			var uploadKey = data.uploadKey;
			
			Zotero.debug("Upload of attachment " + item.key
				+ " finished with status code " + status);
			
			Zotero.debug(response);
			
			switch (status) {
				case 201:
					// Decrease backoff delay on successful upload
					if (_s3Backoff > 1) {
						_s3Backoff /= 2;
					}
					// And reset consecutive failures
					_s3ConsecutiveFailures = 0;
					break;
				
				case 500:
					throw new Error("File upload failed. Please try again.");
				
				default:
					var msg = "Unexpected file upload status " + status
						+ " in Zotero.Sync.Storage.ZFS.onUploadComplete()"
						+ " (" + Zotero.Items.getLibraryKeyHash(item) + ")";
					Zotero.debug(msg, 1);
					Components.utils.reportError(msg);
					Components.utils.reportError(response);
					throw new Error(Zotero.Sync.Storage.defaultError);
			}
			
			var uri = getItemURI(item);
			var body = "update=" + uploadKey + "&mtime=" + item.attachmentModificationTime;
			
			// Register upload on server
			return Zotero.HTTP.promise("POST", uri, { body: body, headers: _headers, successCodes: [204] })
				.then(function (req) {
					updateItemFileInfo(item);
					return {
						localChanges: true,
						remoteChanges: true
					};
				})
				.fail(function (e) {
					var msg = "Unexpected file registration status " + e.status
						+ " (" + Zotero.Items.getLibraryKeyHash(item) + ")";
					Zotero.debug(msg, 1);
					Zotero.debug(e.xmlhttp.responseText);
					Zotero.debug(e.xmlhttp.getAllResponseHeaders());
					Components.utils.reportError(msg);
					Components.utils.reportError(e.xmlhttp.responseText);
					throw new Error(Zotero.Sync.Storage.defaultError);
				});
		});
	}
	
	
	function updateItemFileInfo(item) {
		// Mark as changed locally
		Zotero.DB.beginTransaction();
		Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_IN_SYNC);
		
		// Store file mod time
		var mtime = item.attachmentModificationTime;
		Zotero.Sync.Storage.setSyncedModificationTime(item.id, mtime, true);
		
		// Store file hash of individual files
		if (Zotero.Attachments.getNumFiles(item) == 1) {
			var hash = item.attachmentHash;
			Zotero.Sync.Storage.setSyncedHash(item.id, hash);
		}
		
		Zotero.DB.commitTransaction();
		
		try {
			if (Zotero.Attachments.getNumFiles(item) > 1) {
				var file = Zotero.getTempDirectory();
				file.append(item.key + '.zip');
				file.remove(false);
			}
		}
		catch (e) {
			Components.utils.reportError(e);
		}
	}
	
	
	function onUploadCancel(httpRequest, status, data) {
		var request = data.request;
		var item = data.item;
		
		Zotero.debug("Upload of attachment " + item.key + " cancelled with status code " + status);
		
		try {
			if (Zotero.Attachments.getNumFiles(item) > 1) {
				var file = Zotero.getTempDirectory();
				file.append(item.key + '.zip');
				file.remove(false);
			}
		}
		catch (e) {
			Components.utils.reportError(e);
		}
	}
	
	
	/**
	 * Get the storage URI for an item
	 *
	 * @inner
	 * @param	{Zotero.Item}
	 * @return	{nsIURI}					URI of file on storage server
	 */
	function getItemURI(item) {
		var uri = Zotero.Sync.Storage.ZFS.rootURI;
		// Be sure to mirror parameter changes to getItemInfoURI() below
		uri.spec += Zotero.URI.getItemPath(item) + '/file?auth=1&iskey=1&version=1';
		return uri;
	}
	
	
	/**
	 * Get the storage info URI for an item
	 *
	 * @inner
	 * @param	{Zotero.Item}
	 * @return	{nsIURI}					URI of file on storage server with info flag
	 */
	function getItemInfoURI(item) {
		var uri = Zotero.Sync.Storage.ZFS.rootURI;
		uri.spec += Zotero.URI.getItemPath(item) + '/file?auth=1&iskey=1&version=1&info=1';
		return uri;
	}
	
	
	function getUploadFile(item) {
		if (Zotero.Attachments.getNumFiles(item) > 1) {
			var file = Zotero.getTempDirectory();
			var filename = item.key + '.zip';
			file.append(filename);
		}
		else {
			var file = item.getFile();
		}
		return file;
	}
	
	
	//
	// Public methods (called via Zotero.Sync.Storage.ZFS)
	//
	var obj = new Zotero.Sync.Storage.Mode;
	obj.name = "ZFS";
	
	Object.defineProperty(obj, "includeUserFiles", {
		get: function () {
			return Zotero.Prefs.get("sync.storage.enabled") && Zotero.Prefs.get("sync.storage.protocol") == 'zotero';
		}
	});
	
	Object.defineProperty(obj, "includeGroupFiles", {
		get: function () {
			return Zotero.Prefs.get("sync.storage.groups.enabled");
		}
	});
	
	obj._verified = true;
	
	Object.defineProperty(obj, "rootURI", {
		get: function () {
			if (!_rootURI) {
				this._init();
			}
			return _rootURI.clone();
		}
	});
	
	Object.defineProperty(obj, "userURI", {
		get: function () {
			if (!_userURI) {
				this._init();
			}
			return _userURI.clone();
		}
	});
	
	
	obj._init = function () {
		_rootURI = false;
		_userURI = false;
		
		var url = ZOTERO_CONFIG.API_URL;
		var username = Zotero.Sync.Server.username;
		var password = Zotero.Sync.Server.password;
		
		var ios = Components.classes["@mozilla.org/network/io-service;1"].
					getService(Components.interfaces.nsIIOService);
		var uri = ios.newURI(url, null, null);
		uri.username = encodeURIComponent(username);
		uri.password = encodeURIComponent(password);
		_rootURI = uri;
		
		uri = uri.clone();
		uri.spec += 'users/' + Zotero.userID + '/';
		_userURI = uri;
	};
	
	obj.clearCachedCredentials = function() {
		_rootURI = _userURI = undefined;
		_cachedCredentials = false;
	};
	
	/**
	 * Begin download process for individual file
	 *
	 * @param	{Zotero.Sync.Storage.Request}	[request]
	 */
	obj._downloadFile = function (request) {
		var item = Zotero.Sync.Storage.getItemFromRequestName(request.name);
		if (!item) {
			throw new Error("Item '" + request.name + "' not found");
		}
		
		var self = this;
		
		// Retrieve file info from server to store locally afterwards
		return getStorageFileInfo(item, request)
			.then(function (info) {
				if (!request.isRunning()) {
					Zotero.debug("Download request '" + request.name
						+ "' is no longer running after getting remote file info");
					return false;
				}
				
				var file = item.getFile();
				
				if (!info) {
					Zotero.debug("Remote file not found for item " + item.libraryID + "/" + item.key);
					// Reset sync state if a remotely missing file exists locally.
					// I'm not sure how this can happen, but otherwise it results in
					// a file marked as TO_DOWNLOAD never being uploaded.
					if (file && file.exists()) {
						Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD);
						return {
							localChanges: true
						};
					}
					return false;
				}
				
				var syncModTime = info.mtime;
				var syncHash = info.hash;
				
				// Skip download if local file exists and matches mod time
				if (file && file.exists()) {
					if (syncModTime == file.lastModifiedTime) {
						Zotero.debug("File mod time matches remote file -- skipping download");
						
						Zotero.DB.beginTransaction();
						var syncState = Zotero.Sync.Storage.getSyncState(item.id);
						//var updateItem = syncState != 1;
						var updateItem = false;
						Zotero.Sync.Storage.setSyncedModificationTime(item.id, syncModTime, updateItem);
						Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_IN_SYNC);
						Zotero.DB.commitTransaction();
						return {
							localChanges: true,
							remoteChanges: false
						};
					}
					// If not compressed, check hash, in case only timestamp changed
					else if (!info.compressed && item.attachmentHash == syncHash) {
						Zotero.debug("File hash matches remote file -- skipping download");
						
						Zotero.DB.beginTransaction();
						var syncState = Zotero.Sync.Storage.getSyncState(item.id);
						//var updateItem = syncState != 1;
						var updateItem = false;
						if (!info.compressed) {
							Zotero.Sync.Storage.setSyncedHash(item.id, syncHash, false);
						}
						Zotero.Sync.Storage.setSyncedModificationTime(item.id, syncModTime, updateItem);
						Zotero.Sync.Storage.setSyncState(item.id, Zotero.Sync.Storage.SYNC_STATE_IN_SYNC);
						Zotero.DB.commitTransaction();
						return {
							localChanges: true,
							remoteChanges: false
						};
					}
				}
				
				var destFile = Zotero.getTempDirectory();
				if (info.compressed) {
					destFile.append(item.key + '.zip.tmp');
				}
				else {
					destFile.append(item.key + '.tmp');
				}
				
				if (destFile.exists()) {
					try {
						destFile.remove(false);
					}
					catch (e) {
						Zotero.File.checkFileAccessError(e, destFile, 'delete');
					}
				}
				
				// saveURI() below appears not to create empty files for Content-Length: 0,
				// so we create one here just in case
				try {
					destFile.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
				}
				catch (e) {
					Zotero.File.checkFileAccessError(e, destFile, 'create');
				}
				
				var deferred = Q.defer();
				
				var listener = new Zotero.Sync.Storage.StreamListener(
					{
						onStart: function (request, data) {
							if (data.request.isFinished()) {
								Zotero.debug("Download request " + data.request.name
									+ " stopped before download started -- closing channel");
								request.cancel(0x804b0002); // NS_BINDING_ABORTED
								deferred.resolve(false);
							}
						},
						onProgress: function (a, b, c) {
							request.onProgress(a, b, c)
						},
						onStop: function (request, status, response, data) {
							data.request.setChannel(false);
							
							if (status != 200) {
								if (status == 404) {
									deferred.resolve(false);
									return;
								}
								
								if (status == 0) {
									if (_s3ConsecutiveFailures >= _maxS3ConsecutiveFailures) {
										Zotero.debug(_s3ConsecutiveFailures
											+ " consecutive S3 failures -- aborting", 1);
										_s3ConsecutiveFailures = 0;
									}
									else {
										let libraryKey = Zotero.Items.getLibraryKeyHash(item);
										let msg = "S3 returned " + status
											+ " (" + libraryKey + ") -- retrying download"
										Components.utils.reportError(msg);
										Zotero.debug(msg, 1);
										if (_s3Backoff < _maxS3Backoff) {
											_s3Backoff *= 2;
										}
										_s3ConsecutiveFailures++;
										Zotero.debug("Delaying " + libraryKey + " download for "
											+ _s3Backoff + " seconds", 2);
										Q.delay(_s3Backoff * 1000)
										.then(function () {
											deferred.resolve(self._downloadFile(data.request));
										});
										return;
									}
								}
								
								var msg = "Unexpected status code " + status
									+ " for request " + data.request.name
									+ " in Zotero.Sync.Storage.ZFS.downloadFile()";
								Zotero.debug(msg, 1);
								Components.utils.reportError(msg);
								// Ignore files not found in S3
								try {
									Zotero.debug(Zotero.File.getContents(destFile, null, 4096), 1);
								}
								catch (e) {
									Zotero.debug(e, 1);
								}
								deferred.reject(Zotero.Sync.Storage.defaultError);
								return;
							}
							
							// Don't try to process if the request has been cancelled
							if (data.request.isFinished()) {
								Zotero.debug("Download request " + data.request.name
									+ " is no longer running after file download", 2);
								deferred.resolve(false);
								return;
							}
							
							Zotero.debug("Finished download of " + destFile.path);
							
							try {
								deferred.resolve(Zotero.Sync.Storage.processDownload(data));
							}
							catch (e) {
								deferred.reject(e);
							}
						},
						onCancel: function (request, status, data) {
							Zotero.debug("Request cancelled");
							deferred.resolve(false);
						},
						request: request,
						item: item,
						compressed: info.compressed,
						syncModTime: syncModTime,
						syncHash: syncHash
					}
				);
				
				var uri = getItemURI(item);
				
				// Don't display password in console
				var disp = uri.clone();
				if (disp.password) {
					disp.password = "********";
				}
				Zotero.debug('Saving ' + disp.spec + ' with saveURI()');
				const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
				var wbp = Components
					.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
					.createInstance(nsIWBP);
				wbp.persistFlags = nsIWBP.PERSIST_FLAGS_BYPASS_CACHE;
				wbp.progressListener = listener;
				Zotero.Utilities.Internal.saveURI(wbp, uri, destFile);
				
				return deferred.promise;
			});
	};
	
	
	obj._uploadFile = function (request) {
		var item = Zotero.Sync.Storage.getItemFromRequestName(request.name);
		if (Zotero.Attachments.getNumFiles(item) > 1) {
			var deferred = Q.defer();
			var created = Zotero.Sync.Storage.createUploadFile(
				request,
				function (data) {
					if (!data) {
						deferred.resolve(false);
						return;
					}
					deferred.resolve(processUploadFile(data));
				}
			);
			if (!created) {
				return Q(false);
			}
			return deferred.promise;
		}
		else {
			return processUploadFile({ request: request });
		}
	};
	
	
	/**
	 * @return {Promise} A promise for the last sync time
	 */
	obj._getLastSyncTime = function (libraryID) {
		var lastSyncURI = this._getLastSyncURI(libraryID);
		
		var self = this;
		return Q.fcall(function () {
			// Cache the credentials at the root
			return self._cacheCredentials();
		})
		.then(function () {
			return Zotero.HTTP.promise("GET", lastSyncURI,
				{ headers: _headers, successCodes: [200, 404], debug: true });
		})
		.then(function (req) {
			// Not yet synced
			if (req.status == 404) {
				Zotero.debug("No last sync time for library " + libraryID);
				return null;
			}
			
			var ts = req.responseText;
			var date = new Date(ts * 1000);
			Zotero.debug("Last successful ZFS sync for library "
				+ libraryID + " was " + date);
			return ts;
		})
		.fail(function (e) {
			if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
				if (e.status == 401 || e.status == 403) {
					Zotero.debug("Clearing ZFS authentication credentials", 2);
					_cachedCredentials = false;
				}
				
				return Q.reject(e);
			}
			// TODO: handle browser offline exception
			else {
				throw e;
			}
		});
	};
	
	
	obj._setLastSyncTime = function (libraryID, localLastSyncTime) {
		if (localLastSyncTime) {
			var sql = "REPLACE INTO version VALUES (?, ?)";
			Zotero.DB.query(
				sql, ['storage_zfs_' + libraryID, { int: localLastSyncTime }]
			);
			return;
		}
		
		var lastSyncURI = this._getLastSyncURI(libraryID);
		
		return Zotero.HTTP.promise("POST", lastSyncURI, { headers: _headers, successCodes: [200, 404], debug: true })
			.then(function (req) {
				// Not yet synced
				//
				// TODO: Don't call this at all if no files uploaded
				if (req.status == 404) {
					return;
				}
				
				var ts = req.responseText;
				
				var sql = "REPLACE INTO version VALUES (?, ?)";
				Zotero.DB.query(
					sql, ['storage_zfs_' + libraryID, { int: ts }]
				);
			})
			.fail(function (e) {
				var msg = "Unexpected status code " + e.xmlhttp.status
					+ " setting last file sync time";
				Zotero.debug(msg, 1);
				Components.utils.reportError(msg);
				throw new Error(Zotero.Sync.Storage.defaultError);
			});
	};
	
	
	obj._getLastSyncURI = function (libraryID) {
		if (libraryID === 0) {
			var lastSyncURI = this.userURI;
		}
		else if (libraryID) {
			var ios = Components.classes["@mozilla.org/network/io-service;1"].
			getService(Components.interfaces.nsIIOService);
			var uri = ios.newURI(Zotero.URI.getLibraryURI(libraryID), null, null);
			var path = uri.path;
			// We don't want the user URI, but it already has the right domain
			// and credentials, so just start with that and replace the path
			var lastSyncURI = this.userURI;
			lastSyncURI.path = path + "/";
		}
		else {
			throw new Error("libraryID not specified");
		}
		lastSyncURI.spec += "laststoragesync";
		return lastSyncURI;
	}
	
	
	obj._cacheCredentials = function () {
		if (_cachedCredentials) {
			Zotero.debug("ZFS credentials are already cached");
			return Q();
		}
		
		var uri = this.rootURI;
		// TODO: move to root uri
		uri.spec += "?auth=1";
		
		return Zotero.HTTP.promise("GET", uri, { headers: _headers }).
			then(function (req) {
				Zotero.debug("Credentials are cached");
				_cachedCredentials = true;
			})
			.catch(function (e) {
				if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
					if (e.status == 401) {
						var msg = "File sync login failed\n\n"
							+ "Check your username and password in the Sync "
							+ "pane of the Zotero preferences.";
						throw (msg);
					}
					
					var msg = "Unexpected status code " + e.status + " "
						+ "caching ZFS credentials";
					Zotero.debug(msg, 1);
					throw (msg);
				}
				else {
					throw (e);
				}
			});
	};
	
	
	/**
	 * Remove all synced files from the server
	 */
	obj._purgeDeletedStorageFiles = function () {
		return Q.fcall(function () {
			// Cache the credentials at the root
			return this._cacheCredentials();
		}.bind(this))
		then(function () {
			// If we don't have a user id we've never synced and don't need to bother
			if (!Zotero.userID) {
				return false;
			}
			
			var sql = "SELECT value FROM settings WHERE setting=? AND key=?";
			var values = Zotero.DB.columnQuery(sql, ['storage', 'zfsPurge']);
			if (!values) {
				return false;
			}
			
			// TODO: promisify
			
			Zotero.debug("Unlinking synced files on ZFS");
			
			var uri = this.userURI;
			uri.spec += "removestoragefiles?";
			// Unused
			for each(var value in values) {
				switch (value) {
					case 'user':
						uri.spec += "user=1&";
						break;
					
					case 'group':
						uri.spec += "group=1&";
						break;
					
					default:
						throw "Invalid zfsPurge value '" + value
							+ "' in ZFS purgeDeletedStorageFiles()";
				}
			}
			uri.spec = uri.spec.substr(0, uri.spec.length - 1);
			
			return Zotero.HTTP.promise("POST", uri, "")
			.then(function (req) {
				var sql = "DELETE FROM settings WHERE setting=? AND key=?";
				Zotero.DB.query(sql, ['storage', 'zfsPurge']);
			});
		}.bind(this));
	};
	
	return obj;
}());
