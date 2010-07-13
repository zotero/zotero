/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

//TODO localize
Zotero.Commons = new function() {
	this.uri = 'http://www.archive.org/';
	this.apiUrl = 'http://s3.us.archive.org';
	this.postCreateBucketDelay = 2000;
	
	this.__defineGetter__('enabled', function () {
		return Zotero.Prefs.get("commons.enabled");
	});
	
	this.__defineGetter__('userIdentifier', function () {
		return Zotero.Prefs.get("commons.accessKey");
	});
	
	this.__defineGetter__('accessKey', function () {
		return Zotero.Prefs.get("commons.accessKey");
	});
	
	this.__defineGetter__('secretKey', function () {
		return Zotero.Prefs.get("commons.secretKey");
	});
	
	this.RDF_TRANSLATOR = {
		'label': 'Zotero RDF',
		'target': 'rdf',
		'translatorID': '14763d24-8ba0-45df-8f52-b8d1108e7ac9',
		'displayOptions': {
			'exportFileData': true,
			'exportNotes': true
		}
	};
	
	this.RDF_IMPORT_TRANSLATOR = {
		'translatorID': '5e3ad958-ac79-463d-812b-a86a9235c28f',
	}
	
	this.ERROR_BUCKET_EXISTS = 1;
	
	this.refreshNeeded = true;
	
	var _buckets = {};
	var _bucketsLoading = false;
	var _bucketsLoaded = false;
	var _requestingItems = false;
	
	
	this.getBuckets = function (callback) {
		if (!this.enabled) {
			return _buckets;
		}
		
		var accessKey = this.accessKey;
		var secretKey = this.secretKey;
		
		if (_bucketsLoaded) {
			return _buckets;
		}
		
		if (_bucketsLoading) {
			Zotero.debug("Already loading buckets");
			return _buckets;
		}
		
		_bucketsLoading = true;
		
		var syncCallback = function (req) {
			// Error
			if (req.status != 200) {
				Zotero.debug(req.status);
				Zotero.debug(req.responseText);
				
				if (req.status == 503) {
					alert("Unable to retrieve bucket list from the Internet Archive: server unavailable.");
				}
				else {
					alert("Unable to retrieve bucket list from the Internet Archive: server error " + req.status);
				}
				
				_bucketsLoading = false;
				
				return;
			}
			
			Zotero.debug(req.responseText);
			
			var currentBuckets = [];
			var IABuckets = [];
			
			for (var name in _buckets) {
				currentBuckets.push(name);
			}
			currentBuckets.sort();
			
			Zotero.debug('==========');
			Zotero.debug("CURRENT BUCKETS");
			Zotero.debug(currentBuckets);
			
			
			var buckets = req.responseXML.getElementsByTagName("Bucket");
			for (var i=0, len=buckets.length; i<len; i++) {
				var bucketName = buckets[i].getElementsByTagName('Name')[0].textContent;
				IABuckets.push(bucketName);
			}
			IABuckets.sort();
			
			Zotero.debug("IA BUCKETS");
			Zotero.debug(IABuckets);
			
			var addBuckets = Zotero.Utilities.prototype.arrayDiff(IABuckets, currentBuckets);
			var removeBuckets = Zotero.Utilities.prototype.arrayDiff(currentBuckets, IABuckets);
			
			Zotero.debug("ADD");
			Zotero.debug(addBuckets);
			Zotero.debug("REMOVE");
			Zotero.debug(removeBuckets);
			
			for each(var name in removeBuckets) {
				delete _buckets[name];
			}
			
			var ids = [];
			var refresh = false;
			for each(var name in addBuckets) {
				refresh = true;
				var bucket = new Zotero.Commons.Bucket(name);
				_buckets[name] = bucket;
				ids.push(bucket.id);
			}
			
			_bucketsLoading = false;
			_bucketsLoaded = true;
			
			// refresh left pane if local bucket list changed
			if (refresh) {
				Zotero.Notifier.trigger('add', 'bucket', ids);
			}
			
			if (callback) {
				callback();
			}
		};
		
		var req = this.createAuthenticatedRequest(
			"GET", "/", {}, accessKey, secretKey, syncCallback, null, false, true
		);
		
		return _buckets;
	};
	
	
	// outdated
	this.createBucket = function (item, onBucketQueued, onBucketCreated, waitForCreation) {
		var headers = {
			"x-archive-auto-make-bucket":"1",
			"x-archive-meta01-collection":"zoterocommons",
			"x-archive-meta02-collection":"scholarworkspaces",
			"x-archive-meta-sponsor":"Andrew W. Mellon Foundation",
			"x-archive-meta01-language":"eng"
		};
		
		var itemTitle = item.getDisplayTitle();
		if (itemTitle) {
			headers["x-archive-meta-title"] = itemTitle;
		}
		
		var itemLanguage = item.getField('language');
		// TODO: use proper language code?
		if (itemLanguage) {
			headers["x-archive-meta01-language"] = itemLanguage;
		}
		
		var itemType = Zotero.ItemTypes.getName(item.itemTypeID);
		switch (itemType) {
			case 'artwork':
			case 'map':
				headers["x-archive-meta-mediatype"] = "image";
				break;
			
			case 'radioBroadcast':
			case 'audioRecording':
				headers["x-archive-meta-mediatype"] = "audio";
				break;
			
			case 'tvBroadcast':
			case 'videoRecording':
				headers["x-archive-meta-mediatype"] = "movies";
				break;
			
			default:
				headers["x-archive-meta-mediatype"] = "texts";
		}
		
		var requestCallback = function (req, id, tries) {
			Zotero.debug(req.status);
			
			if (req.status == 201) {
				var bucket = new Zotero.Commons.Bucket(id);
				
				if (waitForCreation) {
					Zotero.debug('Waiting for bucket creation');
					
					setTimeout(function () {
						var tries = 15;
						bucket.exists(function (found) {
							if (found == 1) {
								onBucketCreated(bucket);
							}
							else if (!found) {
								alert("Commons: Bucket " + bucket.name + " not found after creation");
							}
							else {
								alert("Commons: Error checking for bucket " + bucket.name + " after creation");
							}
						}, tries);
					}, Zotero.Commons.postCreateBucketDelay);
					
					if (onBucketQueued) {
						onBucketQueued();
					}
				}
				else {
					if (onBucketQueued) {
						onBucketQueued();
					}
					if (onBucketCreated) {
						onBucketCreated(bucket);
					}
				}
			}
			else {
				Zotero.debug(req.responseText);
				
				// DEBUG: What is this for?
				if (req.status == 409) {
					tries++;
					// Max tries
					if (tries > 3) {
						alert("Upload failed");
						return;
					}
					
					id = Zotero.Commons.getNewBucketName();
					Zotero.Commons.createAuthenticatedRequest(
						"PUT", "/" + id, headers, this.accessKey, this.secretKey,
						function (req) {
							requestCallback(req, id, tries);
						}
					);
					
				}
				else {
					Zotero.debug(req.status);
					Zotero.debug(req.responseText);
					
					alert("Upload failed");
				}
			}
		};
		
		var id = Zotero.Commons.getNewBucketName();
		Zotero.Commons.createAuthenticatedRequest(
			"PUT", "/" + id, headers, this.accessKey, this.secretKey,
			function (req) {
				requestCallback(req, id, 1);
			}
		);
	}
	
	
	this.createAuthenticatedRequest = function (method, resource, headers, accessKey, secretKey, callback, data, sendAsBinary, noCache) {
		var url = Zotero.Commons.apiUrl + resource;
		
		Zotero.debug("Commons HTTP " + method + ": " + url);
		
		var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
			.createInstance(Components.interfaces.nsIXMLHttpRequest);
		req.open(method, url, true);

		var d = new Date();
		headers["Date"] = d.toUTCString();

		var signatureData = method + '\n' +
			((headers['Content-MD5']) ? headers['Content-MD5'] : '') + '\n' +
			((headers['Content-Type']) ? headers['Content-Type'] : '') + '\n' +
			((headers['Date']) ? headers['Date'] : '') + '\n';

		// add x-amz- headers in alphabetic order
		var amz = [];
		for(header in headers) {
			if(header.indexOf("x-amz-") == 0) {
				amz.push(header + ":" + headers[header] + '\n');
			}
		}
		signatureData += amz.sort().join('');

		signatureData += resource;
		var signature = Zotero.Commons.SHA1.b64_hmac_sha1(secretKey, signatureData) + '=';
		headers["Authorization"] = "AWS " + accessKey + ":" + signature;
		//headers["Authorization"] = "LOW " + accessKey + ":" + secretKey;

		for(var header in headers) {
			req.setRequestHeader(header, headers[header]);
		}
		
		if (noCache) {
			req.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
		}
		
		if (data) {
			if (sendAsBinary) {
				req.sendAsBinary(data);
			}
			else {
				req.send(data);
			}
		}
		else {
			req.send(null);
		}
		
		
		if (callback) {
			req.onreadystatechange = function() {
				if (req.readyState == 4) {
					callback(req);
				}
			};
		}
	}
	
	
	this.createUnauthenticatedRequest = function (method, resource, headers) {
		var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
			.createInstance(Components.interfaces.nsIXMLHttpRequest);
		req.open(method, Zotero.Commons.apiUrl + resource, false);

		for(var header in headers) {
			req.setRequestHeader(header, headers[header]);
		}

		return req;
	}
	
	
	// Recursively add files and directories to zipWriter
	this.zipDirectory = function (rootDir, dir, zipWriter) {
		dir = dir.directoryEntries;
		while(dir.hasMoreElements()) {
			var file = dir.getNext();
			file.QueryInterface(Components.interfaces.nsILocalFile);
	
			var fileName = file.getRelativeDescriptor(rootDir);
			if(fileName.indexOf('.') == 0) {
				Zotero.debug('Skipping file ' + fileName);
				continue;
			}
	
			// addEntryFile works for both files and directories
			zipWriter.addEntryFile(
				fileName,
				Components.interfaces.nsIZipWriter.COMPRESSION_DEFAULT,
				file,
				true
			);
			
			if (file.isDirectory()) {
				Zotero.Commons.zipDirectory(rootDir, file, zipWriter);
				continue;
			}
		}
	}
	
	
	this.debug = function (message, level) {
		Zotero.debug("Commons: " + message, level);
	}
}


Zotero.Commons.Bucket = function (name) {
	this.id = Zotero.ID.getBigInt(); // assign a random ID to the bucket for this session
	this.name = name;
	this.accessKey = Zotero.Prefs.get("commons.accessKey");
	this.secretKey = Zotero.Prefs.get("commons.secretKey");
	this._items = null;
	this._requestingItems = false;
	this._needRefresh = false;
	
	this._items = {};
	this._itemsLoading = false;
	this._itemsLoaded = false;
	
	this._metadataLoading = false;
	this._itemDataLoaded = false;
	this._itemDataLoading = false;
}


Zotero.Commons.Bucket.prototype.__defineGetter__('uri', function () {
	return 'http://www.archive.org/details/' + encodeURIComponent(this.name);
});

Zotero.Commons.Bucket.prototype.__defineGetter__('downloadURI', function () {
	return 'http://www.archive.org/download/' + encodeURIComponent(this.name);
});

Zotero.Commons.Bucket.prototype.__defineGetter__('metadataURI', function () {
	return this.downloadURI + '/' + encodeURIComponent(this.name) + '_meta.xml';
});

Zotero.Commons.Bucket.prototype.__defineGetter__('apiPath', function() {
	return '/' + encodeURIComponent(this.name);
});

Zotero.Commons.Bucket.prototype.__defineGetter__('apiURI', function() {
	return Zotero.Commons.apiUrl + this.apiPath;
});


Zotero.Commons.Bucket.prototype.relationPredicate = "owl:sameAs";


Zotero.Commons.Bucket.prototype.exists = function (callback, maxTries, tries) {
	if (!tries) {
		tries = 0;
	}
	
	var self = this;
	
	Zotero.Utilities.HTTP.doHead(this.uri, function (xmlhttp) {
		switch (xmlhttp.status) {
			case 200:
				callback(1);
				return;
			
			case 404:
			case 503: // IA returns this for missing buckets
				tries++;
				
				if (tries >= maxTries) {
					callback(0);
					return;
				}
				
				var delay = Zotero.Commons.postCreateBucketDelay * tries;
				var seconds = delay / 1000;
				Zotero.debug("Bucket " + self.name + " doesn't yet exist -- retrying in " + seconds + " seconds");
				
				setTimeout(function () {
					self.exists(callback, maxTries, tries);
				}, delay);
				return;
				
			default:
				Zotero.debug(xmlhttp.status);
				Zotero.debug(xmlhttp.responseText);
				callback(-1);
				return;
		}
	});
}


Zotero.Commons.Bucket.prototype.getItems = function (callback) {
	if (this._itemsLoaded || this._itemsLoading) {
		return this._getCachedItems();
	}
	
	this._itemsLoading = true;
	
	var method = "GET";
	var uri = this.downloadURI + "/" + this.name + "_files.xml";
	
	var self = this;
	var progressWin = null;
	var progressWinIcon = 'chrome://zotero/skin/treeitem-attachment-pdf.png';
	
	var req = Zotero.Utilities.HTTP.doGet(uri, function (xmlhttp) {
		if (xmlhttp.status != 200) {
			Zotero.debug(xmlhttp.status);
			Zotero.debug(xmlhttp.responseText);
			alert("Error loading data from the Internet Archive");
			self._itemsLoading = false;
			return;
		}
		
		Zotero.debug(xmlhttp.responseText);
		
		try {
			// Strip XML declaration and convert to E4X
			var xml = new XML(xmlhttp.responseText.replace(/<\?xml.*\?>/, ''));
		}
		catch (e) {
			alert("Invalid response retrieving file upload parameters");
			return;
		}
		
		var zipsXML = xml.file.(@source == 'original').(format == 'Zotero ZIP Item');
		
		Zotero.debug(zipsXML);
		
		var zips = [];
		
		// Generate a list of extracted PDFs with OCRed equivalents
		var ocrOriginals = {};
		var ocrPDFXML = xml.file.(@source == 'derivative').(format == 'Additional Text PDF').@name;
		for each(var pdf in ocrPDFXML) {
			var fn = pdf.toString().replace(/_text\.pdf$/, '.pdf');
			ocrOriginals[fn] = true;
		}
		
		for each(var zipXML in zipsXML) {
			var key = zipXML.@name.toString();
			var title = zipXML.title.toString();
			
			var childrenXML = xml.file.(typeof zipsource != 'undefined').(zipsource == key).(format != 'Zotero RDF');
			var children = [];
			for each(var childXML in childrenXML) {
				var childKey = childXML.@name.toString();
				children.push({
					key: childKey,
					title: childXML.title.toString(),
					ocr: ocrOriginals[childKey] ? true : false
				});
			}
			
/*
			// See if we already have this item
			if (self._items[key]) {
				continue;
			}
*/
			zips.push({
				key: key,
				title: title,
				children: children
			});
		}
		
		self._itemsLoading = false;
		self._itemsLoaded = true;
		
		Zotero.debug(zips);
		
		Zotero.Notifier.trigger('refresh', 'bucket', self.id);
		
		// Get RDF for new items, pulling off a stack
		var process = function (zips) {
			if (!zips.length) {
				Zotero.debug("Commons: No more ZIPs to process");
				
				if (callback) {
					callback();
				}
				
				return;
			}
			
			let zip = zips.shift();
			
			// See if we already have this item
			if (self._items[zip.key]) {
				process(zips);
				return;
			}
			
			var rdfURI = self.downloadURI + '/'
				// Strip characters IA strips
				+ zip.key.replace(/[^-A-Za-z0-9_.]/g, '-').replace(/-+/g, '-');
			rdfURI = rdfURI.replace(/\.zip$/, "_zotero.rdf");
			
			Zotero.Utilities.HTTP.doGet(rdfURI, function (xmlhttp) {
				// If RDF not available, skip item
				if (xmlhttp.status != 200) {
					Zotero.debug("RDF not found at " + xmlhttp.channel.originalURI.spec);
					process(zips);
					return;
				}
				
				if (!xmlhttp.responseText) {
					Zotero.debug("RDF file is empty at " + xmlhttp.channel.originalURI.spec);
					process(zips);
					return;
				}
				
				Zotero.debug(xmlhttp.responseText);
				
				var translate = new Zotero.Translate("import");
				translate.setString(xmlhttp.responseText);
				translate.getTranslators()
				translate.setTranslator(Zotero.Commons.RDF_IMPORT_TRANSLATOR.translatorID);
				translate.setHandler("itemDone", function (translation, item) {
					var typeID = Zotero.ItemTypes.getID(item.itemType);
					var newItem = new Zotero.Item(typeID);
					newItem.id = Zotero.ID.getBigInt();
					
					// Add item data to virtual item
					for (var field in item) {
						// Skip empty fields
						if (!item[field]) {
							continue;
						}
						var fieldID = Zotero.ItemFields.getID(field);
						if (!fieldID) {
							continue;
						}
						
						try {
							newItem.setField(fieldID, item[field]);
						}
						catch (e) {
							Zotero.debug(e);
						}
					}
					
					// Add creators to virtual item
					for (var i=0; i<item.creators.length; i++) {
						try {
							var creator = new Zotero.Creator;
							creator.setFields(item.creators[i]);
							newItem.setCreator(i, creator, item.creators[i].creatorType);
						}
						catch (e) {
							Zotero.debug(e);
						}
					}
					
					self._items[zip.key] = newItem;
					
					Zotero.Notifier.trigger('refresh', 'bucket', self.id);
					
					// If item exists locally, check for OCRed attachments
					var localItem = self.getLocalItem(newItem);
					if (localItem) {
						for each(var child in zip.children) {
							if (!child.ocr) {
								continue;
							}
							
							var iaFileName = child.key.replace(/\.pdf$/, '_text.pdf');
							var iaFileURI = self.downloadURI + '/' + iaFileName;
							
							var rels = Zotero.Relations.getByURIs(null, self.relationPredicate, iaFileURI);
							if (rels.length) {
								Zotero.debug("Commons: " + IAFileName + " has already been downloaded -- skipping");
								continue;
							}
							
							Zotero.debug("Downloading OCRed PDF " + iaFileName);
							
							var title = Zotero.localeJoin([child.title, '(OCR)']);
							var baseName = child.key;
							
							if (!progressWin) {
								progressWin = new Zotero.ProgressWindow();
								progressWin.changeHeadline("Downloading OCRed PDFs"); // TODO: localize
							}
							progressWin.addLines([child.title], [progressWinIcon]);
							progressWin.show();
							progressWin.startCloseTimer(8000);
							
							var newAttachment = Zotero.Attachments.importFromURL(
								iaFileURI, localItem.id, title, baseName, null, 'application/pdf'
							);
							if (!(newAttachment instanceof Zotero.Item)) {
								throw (newAttachment + " is not a Zotero.Item in Zotero.Commons.Bucket.getItems()");
							}
							
							// Add a relation linking the new attachment to the IA file
							var uri = Zotero.URI.getItemURI(newAttachment);
							Zotero.Relations.add(null, uri, self.relationPredicate, iaFileURI);
						}
					}
					
					process(zips);
				});
				translate.translate(false, false);
			});
		}
		
		process(zips);
	});
	
	// Browser offline
	if (!req) {
		this._itemsLoading = false;
	}
	
	// List isn't yet available
	return this._getCachedItems();
}


Zotero.Commons.Bucket.prototype.refreshItems = function (callback) {
	if (this._itemsLoading) {
		Zotero.debug("Items already loading in Zotero.Commons.Bucket.refreshItems()", 2);
		if (callback) {
			callback()
		}
		return;
	}
	
	Zotero.debug("Loading items for bucket '" + this.name + "'");
	this._itemsLoaded = false;
	this.getItems(callback);
}


Zotero.Commons.Bucket.prototype.uploadItems = function (ids) {
	var items = Zotero.Items.get(ids);
	if (!items) {
		Zotero.debug("No items to upload");
		return;
	}
	
	var itemsToUpload = false;
	for (var i=0, len=items.length; i<len; i++) {
		if (items[i].isRegularItem()) {
			itemsToUpload = true;
			break;
		}
	}
	
	var pr = Components.classes["@mozilla.org/network/default-prompt;1"]
				.getService(Components.interfaces.nsIPrompt);
	
	if (!itemsToUpload) {
		Zotero.debug("No regular items to upload");
		pr.alert("", "Only items with bibliographic metadata can be added to the Zotero Commons.");
		return;
	}
	
	var buttonFlags = (pr.BUTTON_POS_0) * (pr.BUTTON_TITLE_IS_STRING)
						+ (pr.BUTTON_POS_1) * (pr.BUTTON_TITLE_CANCEL);
	var index = pr.confirmEx(
		"Zotero Commons Upload",
		"By uploading items to Zotero Commons you agree to the terms of use at zotero.org and archive.org. "
			+ "Please make sure metadata for your item(s) is set properly."
			+ "\n\n "
			+ "Continue to upload items to the Internet Archive?",
		buttonFlags,
		"Upload",
		null, null, null, {}
	);
	
	// if user chooses 'cancel', exit
	if (index != 0) return;
	
	var progressWin = new Zotero.ProgressWindow();
	var tmpDir = Zotero.getTempDirectory();
	var self = this;
	
	// Upload items one at a time, pulling items off a stack
	var process = function (items) {
		if (!items.length) {
			Zotero.debug("Commons: No more items to upload");
			return;
		}
		
		let item = items.shift();
		
		// Skip notes and attachments
		if (!item.isRegularItem()) {
			process(items);
			return;
		}
		
		// TODO: check relations table to see if this item already has a bucket
		
		// TODO: localize
		progressWin.changeHeadline("Uploading Items to IA");
		progressWin.addLines([item.getField('title')], [item.getImageSrc()]);
		progressWin.show();
		
		self.uploadItem(
			item,
			function () {
				Zotero.debug(items.length);
				if (items.length) {
					// Process next item
					process(items);
				}
				else {
					progressWin.startCloseTimer(5000);
				}
			}
		);
	}
	
	process(items);
}


/**
 * Export item and attachments to RDF and files and upload to IA
 */
Zotero.Commons.Bucket.prototype.uploadItem = function (item, callback) {
	var key = item.key;
	
	var outputDir = Zotero.getTempDirectory();
	outputDir.append(key);
	
	var bucket = this;
	
	var translation = new Zotero.Translate("export");
	translation.setItems([item]);
	translation.setTranslator(Zotero.Commons.RDF_TRANSLATOR.translatorID);
	translation.setDisplayOptions(Zotero.Commons.RDF_TRANSLATOR.displayOptions);
	translation.setHandler("done", 	function (translation, success) {
		if (!success) {
			alert("Commons: Translation failed for " + translation);
			return;
		}
		
		try {
			// Rename RDF file
			var rdfFile = outputDir.clone();
			rdfFile.append(key + ".rdf");
			rdfFile.moveTo(null, "zotero.rdf");
			
			// Then create ZIP file from item
			var zipFile = Zotero.getTempDirectory();
			zipFile.append(item.getField('title') + '-' + key + '.zip');
			
			var zw = Components.classes["@mozilla.org/zipwriter;1"]
				.createInstance(Components.interfaces.nsIZipWriter);
			zw.open(zipFile, 0x04 | 0x08 | 0x20); // open rw, create, truncate
			
			Zotero.Commons.zipDirectory(outputDir, outputDir, zw);
			
			// Upload file after zipping
			var observer = new Zotero.Commons.ZipWriterObserver(zw, function () {
				bucket.putFile(zipFile, "application/zip", function (uri) {
					// Link item to new bucket
					var url1 = Zotero.URI.getItemURI(item);
					var predicate = bucket.relationPredicate;
					var url2 = bucket.getItemURI(item);
					
					// TEMP?
					if (Zotero.Relations.getByURIs(url1, predicate, url2).length == 0) {
						Zotero.Relations.add(null, url1, predicate, url2);
					}
					
					if (callback) {
						callback();
					}
				});
			});
			zw.processQueue(observer, null);
		}
		catch (e) {
			alert("Zotero Commons upload failed:\n\n" + e);
		}
	});
	translation.setLocation(outputDir);
	translation.translate(); // synchronous
}


/**
 * Delete selected items from IA
 */
Zotero.Commons.Bucket.prototype.deleteItems = function (ids) {
	var ids = Zotero.flattenArguments(ids);
	
	// Get the ZIP filenames from the ids
	var keysToDelete = [];
	for each(var id in ids) {
		var key = this._getIAKeyByItemID(id);
		if (key) {
			keysToDelete.push(key);
		}
	}
	
	if (!keysToDelete.length) {
		Zotero.debug("No items to delete");
		return;
	}
	
	var method = "DELETE";
	// Delete extracted files as well
	var headers = {
		"x-archive-cascade-delete":"1"
	};
	
	var resource = '/' + this.name;
	var bucket = this;
	
	for each(let key in keysToDelete) {
		let path = resource + '/' + encodeURIComponent(key);
		
		Zotero.Commons.createAuthenticatedRequest(
			method, path, headers, this.accessKey, this.secretKey, function (req) {
				if (req.status == 204) {
					Zotero.debug('---=---------');
					if (!bucket._items[key]) {
						Zotero.debug('NO ITEM!');
						Zotero.debug(key);
						Zotero.debug(bucket._items);
					}
					
					
					// Delete any relations linked to the IA item
					var uri = bucket.getItemURI(bucket._items[key]);
					var relations = Zotero.Relations.getByURIs(
						null, bucket.relationPredicate, uri
					);
					if (relations) {
						Zotero.DB.beginTransaction();
						for each(var relation in relations) {
							Zotero.Relations.erase(relation.id);
						}
						Zotero.DB.commitTransaction();
					}
					
					delete bucket._items[key];
					
					Zotero.debug("Commons: " + path + " was deleted successfully.");
					Zotero.Notifier.trigger('refresh', 'bucket', bucket.id);
				}
				else {
					Zotero.debug(req.status);
					Zotero.debug(req.responseText);
					
					if (req.status == 403) {
						alert("Failed to delete " + path + " at IA: authentication failed.");
					}
					else if (req.status == 503) {
						alert("Failed to delete " + path + " at IA: server unavailable.");
					}
					else {
						alert("Failed to delete " + path + " at IA.");
						Zotero.debug("Commons: delete failed with status code: " + req.status);
					}
				}
			});
	}
}


// UNUSED
Zotero.Commons.Bucket.prototype.updateMetadata = function(action, item, callback) {
	Zotero.debug("Updating bucket metadata");
	
	var method = "PUT";
	
	var headers = {
		"x-archive-ignore-preexisting-bucket":"1",
		"x-archive-meta01-collection":"zoterocommons",
		"x-archive-meta02-collection":"scholarworkspaces",
		"x-archive-meta-mediatype":"texts",
		"x-archive-meta-sponsor":"Andrew W. Mellon Foundation"
	};

	var meta = null;
	var resource = encodeURI('http://archive.org/download/' + this.name + '/' + this.name + '_meta.xml');
	
	var self = this;
	
	// get previous metadata. multiple language support difficult via IA s3.
	Zotero.Utilities.HTTP.doGet(resource, function (xmlhttp) {
		if (xmlhttp.status == 404 || (xmlhttp.status == 200 && !xmlhttp.responseXML)) {
			Zotero.Commons.error("Error updating bucket metadata");
			return;
		}
		
		if (itemTitle) {
			headers["x-archive-meta-title"] = itemTitle;
		}
		
		// recreate headers of languages already specified in metadata	  
 		var languages = xmlhttp.responseXML.getElementsByTagName("metadata")[0].getElementsByTagName("language");
		var itemLanguage = item.getField('language');
		
		for (var i = 0, len = languages.length; i < len; i++) {
			meta = "x-archive-meta0"+(i+1)+"-language";
			headers[meta] = languages[i].textContent;
		}
		
		Zotero.debug(headers);
		resource = "/" + this.name;
		
		var updateCallback = function (req) {
			Zotero.debug('========');
			Zotero.debug("UPDATE");
			Zotero.debug(req.status);
			if(req.status < 202) {
				Zotero.debug("Commons: " + resource + " metadata updated successfully.");
				
				if (callback) {
					callback();
				}
			}
			else {
				Zotero.debug(req.status);
				Zotero.debug(req.responseText);
				
				if (req.status == 403) {
					alert("Failed to change " + key + " metadata: authentication failed.");
				}
				else if (req.status == 503) {
					alert("Failed to change " + key + " metadata: server unavailable.");
				}
				else {
					alert("Failed to change " + key + " metadata. Status code: " + req.status);
				}
			}
		};
		
		Zotero.Commons.createAuthenticatedRequest(
			method, resource, headers, self.accessKey, self.secretKey, updateCallback
		);
	});
}


Zotero.Commons.Bucket.prototype.putFile = function (file, mimeType, callback) {
	var fileName = file.leafName;
	var fileNameHyphened = fileName.replace(/ /g,'-');
	var method = "PUT";
	var resource = this.apiPath + '/' + encodeURIComponent(fileNameHyphened);
	var content = Zotero.File.getBinaryContents(file);
	var headers = {};
	var self = this;
	
	var putCallback = function (req) {
		Zotero.debug(req.responseText);
		
		// Success
		if (req.status == 201) {
			Zotero.debug("Commons: " + fileNameHyphened + " was uploaded successfully.");
			
			if (callback) {
				callback(req.channel.URI.spec);
			}
			return;
		}
		
		// Error
		Zotero.debug(req.status);
		Zotero.debug(req.responseText);
		
		if (req.status == 404) {
			alert("Failed to upload " + fileName + " to IA: bucket not found");
		}
		else if (req.status == 403) {
			alert("Failed to upload " + fileName + " to IA: authentication failed.");
		}
		else if (req.status == 503) {
			alert("Failed to upload " + fileName + " to IA: server unavailable.");
		}
		else {
			alert("Failed to upload " + fileName + " to IA. status is " + req.status);
		}
	};
	
	Zotero.Commons.createAuthenticatedRequest(
		method, resource, headers, this.accessKey, this.secretKey, putCallback, content, true
	);
}


Zotero.Commons.Bucket.prototype.getItemURI = function (item) {
	return this.uri + '#' + encodeURIComponent(item.getField('title'));
}


Zotero.Commons.Bucket.prototype.getLocalItem = function (item) {
	var uri = this.getItemURI(item);
	var rels = Zotero.Relations.getByURIs(null, this.relationPredicate, uri);
	
	if (rels.length > 1) {
		throw ("Commons: More than one local item linked to remote item " + uri);
	}
	
	var item = Zotero.URI.getURIItem(rels[0].subject);
	if (!item) {
		Zotero.debug("Linked local item not found for URI " + this.uri, 2);
		return false;
	}
	
	return item;
}


Zotero.Commons.Bucket.prototype._getCachedItems = function () {
	var items = [];
	for each(var item in this._items) {
		items.push(item);
	}
	return items;
}


Zotero.Commons.Bucket.prototype._getIAKeyByItemID = function (id) {
	for (var key in this._items) {
		if (this._items[key].id == id) {
			return key;
		}
	}
	return false;
}



// Implements nsIRequestObserver
Zotero.Commons.ZipWriterObserver = function (zipWriter, callback) {
	this._zipWriter = zipWriter;
	this._callback = callback;
}

Zotero.Commons.ZipWriterObserver.prototype = {
	onStartRequest: function () {},

	onStopRequest: function(req, context, status) {
		this._zipWriter.close();
		this._callback();
	}
}



/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */
Zotero.Commons.SHA1 = new function() {

	// added by Ben Parr to expose function for Zotero
	this.hex_sha1 = hex_sha1;
	this.b64_sha1 = b64_sha1;
	this.str_sha1 = str_sha1;
	this.hex_hmac_sha1 = hex_hmac_sha1;
	this.b64_hmac_sha1 = b64_hmac_sha1;
	this.str_hmac_sha1 = str_hmac_sha1;
	

	/*
	 * Configurable variables. You may need to tweak these to be compatible with
	 * the server-side, but the defaults work in most cases.
	 */
	var hexcase = 0; /* hex output format. 0 - lowercase; 1 - uppercase */
	var b64pad = ""; /* base-64 pad character. "=" for strict RFC compliance */
	var chrsz = 8; /* bits per input character. 8 - ASCII; 16 - Unicode */

	/*
	 * These are the functions you'll usually want to call
	 * They take string arguments and return either hex or base-64 encoded strings
	 */
	function hex_sha1(s){return binb2hex(core_sha1(str2binb(s),s.length * chrsz));}
	function b64_sha1(s){return binb2b64(core_sha1(str2binb(s),s.length * chrsz));}
	function str_sha1(s){return binb2str(core_sha1(str2binb(s),s.length * chrsz));}
	function hex_hmac_sha1(key, data){ return binb2hex(core_hmac_sha1(key, data));}
	function b64_hmac_sha1(key, data){ return binb2b64(core_hmac_sha1(key, data));}
	function str_hmac_sha1(key, data){ return binb2str(core_hmac_sha1(key, data));}

	/*
	 * Perform a simple self-test to see if the VM is working
	 */
	function sha1_vm_test()
	{
		return hex_sha1("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
	}

	/*
	 * Calculate the SHA-1 of an array of big-endian words, and a bit length
	 */
	function core_sha1(x, len)
	{
		/* append padding */
		x[len >> 5] |= 0x80 << (24 - len % 32);
		x[((len + 64 >> 9) << 4) + 15] = len;

		var w = Array(80);
		var a = 1732584193;
		var b = -271733879;
		var c = -1732584194;
		var d = 271733878;
		var e = -1009589776;

		for(var i = 0; i < x.length; i += 16)
		{
		var olda = a;
		var oldb = b;
		var oldc = c;
		var oldd = d;
		var olde = e;

		for(var j = 0; j < 80; j++)
		{
			if(j < 16) w[j] = x[i + j];
			else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
			var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
				safe_add(safe_add(e, w[j]), sha1_kt(j)));
			e = d;
			d = c;
			c = rol(b, 30);
			b = a;
			a = t;
		}

		a = safe_add(a, olda);
		b = safe_add(b, oldb);
		c = safe_add(c, oldc);
		d = safe_add(d, oldd);
		e = safe_add(e, olde);
		}
		return Array(a, b, c, d, e);

	}

	/*
	 * Perform the appropriate triplet combination function for the current
	 * iteration
	 */
	function sha1_ft(t, b, c, d)
	{
		if(t < 20) return (b & c) | ((~b) & d);
		if(t < 40) return b ^ c ^ d;
		if(t < 60) return (b & c) | (b & d) | (c & d);
		return b ^ c ^ d;
	}

	/*
	 * Determine the appropriate additive constant for the current iteration
	 */
	function sha1_kt(t)
	{
		return (t < 20) ? 1518500249 : (t < 40) ? 1859775393 :
			(t < 60) ? -1894007588 : -899497514;
	}

	/*
	 * Calculate the HMAC-SHA1 of a key and some data
	 */
	function core_hmac_sha1(key, data)
	{
		var bkey = str2binb(key);
		if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);

		var ipad = Array(16), opad = Array(16);
		for(var i = 0; i < 16; i++)
		{
		ipad[i] = bkey[i] ^ 0x36363636;
		opad[i] = bkey[i] ^ 0x5C5C5C5C;
		}

		var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
		return core_sha1(opad.concat(hash), 512 + 160);
	}

	/*
	 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
	 * to work around bugs in some JS interpreters.
	 */
	function safe_add(x, y)
	{
		var lsw = (x & 0xFFFF) + (y & 0xFFFF);
		var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
		return (msw << 16) | (lsw & 0xFFFF);
	}

	/*
	 * Bitwise rotate a 32-bit number to the left.
	 */
	function rol(num, cnt)
	{
		return (num << cnt) | (num >>> (32 - cnt));
	}

	/*
	 * Convert an 8-bit or 16-bit string to an array of big-endian words
	 * In 8-bit function, characters >255 have their hi-byte silently ignored.
	 */
	function str2binb(str)
	{
		var bin = Array();
		var mask = (1 << chrsz) - 1;
		for(var i = 0; i < str.length * chrsz; i += chrsz)
		bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
		return bin;
	}

	/*
	 * Convert an array of big-endian words to a string
	 */
	function binb2str(bin)
	{
		var str = "";
		var mask = (1 << chrsz) - 1;
		for(var i = 0; i < bin.length * 32; i += chrsz)
		str += String.fromCharCode((bin[i>>5] >>> (32 - chrsz - i%32)) & mask);
		return str;
	}

	/*
	 * Convert an array of big-endian words to a hex string.
	 */
	function binb2hex(binarray)
	{
		var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
		var str = "";
		for(var i = 0; i < binarray.length * 4; i++)
		{
		str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
			hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8)) & 0xF);
		}
		return str;
	}

	/*
	 * Convert an array of big-endian words to a base-64 string
	 */
	function binb2b64(binarray)
	{
		var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
		var str = "";
		for(var i = 0; i < binarray.length * 4; i += 3)
		{
		var triplet = (((binarray[i >> 2] >> 8 * (3 - i %4)) & 0xFF) << 16)
			| (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
			| ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
		for(var j = 0; j < 4; j++)
		{
			if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
			else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
		}
		}
		return str;
	}
}

