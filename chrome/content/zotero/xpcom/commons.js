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
	this.createBucket = createBucket;
	this.syncBucketList = syncBucketList;
	this.removeBucket = removeBucket;
	this._createAuthenticatedRequest = _createAuthenticatedRequest;
	this._createUnauthenticatedRequest = _createUnauthenticatedRequest;

	this.uri = 'http://www.archive.org/';
	this.apiUrl = 'http://s3.us.archive.org';

	this.__defineGetter__('buckets', function () {
		if(!Zotero.Prefs.get("commons.enabled")) {
			return false;
		}

		var accessKey = Zotero.Prefs.get("commons.accessKey");
		var secretKey = Zotero.Prefs.get("commons.secretKey");
		var buckets = [];
		var bucketNames = Zotero.Prefs.get("commons.buckets").split(',');
		for(var i = 0, len = bucketNames.length; i < len; i++) {
			if(bucketNames[i]) {
				buckets.push(new Zotero.Commons.Bucket(bucketNames[i], accessKey, secretKey));
			}
		}
		return buckets;
	});

	function createBucket(bucketName) {
		var accessKey = Zotero.Prefs.get("commons.accessKey");
		var secretKey = Zotero.Prefs.get("commons.secretKey");

		var req = this._createAuthenticatedRequest(
			"PUT", "/" + bucketName, {}, accessKey, secretKey
		);

		req.onreadystatechange = function() {
			if(req.readyState == 4) {
				if(req.status < 400) {
					// add bucketName to preference if isn't already there
					var prefBucketNames = Zotero.Prefs.get("commons.buckets").split(',');
					if(!Zotero.inArray(bucketName, prefBucketNames)) {
						prefBucketNames.push(bucketName);
						prefBucketNames.sort();
						Zotero.Prefs.set("commons.buckets", prefBucketNames.join(','));
						Zotero.Notifier.trigger('add', 'bucket', true);
					}
				}
				else if(req.status == 403) {
					alert("Bucket creation failed: authentication failed.");
				}
				else if(req.status == 409) {
					alert("Bucket creation failed: bucket name already taken.");
				}
				else if(req.status == 503) {
					alert("Bucket creation failed: server unavailable.");
				}
				else {
					alert("Bucket creation failed: server error " + req.status);
				}
			}
		}

		req.send(null);
	}

	function syncBucketList() {
		var accessKey = Zotero.Prefs.get("commons.accessKey");
		var secretKey = Zotero.Prefs.get("commons.secretKey");

		// get list of buckets from IA
		var req = this._createAuthenticatedRequest(
			"GET", "/", {}, accessKey, secretKey
		);

		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				if(req.status < 400) {
					var zu = new Zotero.Utilities;
					var prompt = Components.classes["@mozilla.org/network/default-prompt;1"]
						.getService(Components.interfaces.nsIPrompt);

					var prefChanged = false;
					var prefBuckets = Zotero.Prefs.get("commons.buckets");
					var prefBucketNames = (prefBuckets) ? prefBuckets.split(',').sort() : [];
					var newPrefBucketNames = [];
					var iaBucketNames = [];
					var buckets = req.responseXML.getElementsByTagName("Bucket");
					for(var i = 0, len = buckets.length; i < len; i++) {
						var bucketName = buckets[i].getElementsByTagName('Name')[0].textContent;
						iaBucketNames.push(bucketName);
						if(Zotero.inArray(bucketName, prefBucketNames)) {
							newPrefBucketNames.push(bucketName);
						}
					}
					iaBucketNames.sort();

					// newPrefBucketNames currently contains intersection
					// of prefBucketNames and iaBucketNames
					var askToAddBuckets = zu.arrayDiff(iaBucketNames, newPrefBucketNames);
					var askToRemoveBuckets = zu.arrayDiff(prefBucketNames, newPrefBucketNames);

					// prompt user about adding buckets
					for(var i = 0, len = askToAddBuckets.length; i < len; i++) {
						var result = prompt.confirm("", "'" + askToAddBuckets[i] + "' is associated with "
							+ "your IA account, but is not in the Zotero list of buckets\n\n"
							+ "Add bucket '" + askToAddBuckets[i] + "'?");
						if (result) {
							newPrefBucketNames.push(askToAddBuckets[i]);
							prefChanged = true;
						}
					}

					// prompt user about removing buckets
					for(var i = 0, len = askToRemoveBuckets.length; i < len; i++) {
						var result = prompt.confirm("", "'" + askToRemoveBuckets[i] + "' is in your "
							+ "Zotero list of buckets, but is not associated with your IA account\n\n"
							+ "Remove bucket '" + askToRemoveBuckets[i] + "'?");
						if (result) {
							prefChanged = true;
						}
						else {
							newPrefBucketNames.push(askToRemoveBuckets[i]);
						}
					}

					newPrefBucketNames.sort();
					Zotero.Prefs.set("commons.buckets", newPrefBucketNames.join(','));

					// refresh left pane if local bucket list changed
					if(prefChanged) {
						Zotero.Notifier.trigger('add', 'bucket', true);
					}

					// give user feedback if no difference between lists
					// (don't leave user wondering if nothing happened)
					if(askToAddBuckets.length == 0 && askToRemoveBuckets.length == 0) {
						alert("No differences between local bucket list and IA bucket list found.");
					}
				}
				else if(req.status == 503) {
					alert("Bucket list sync failed: server unavailable.");
				}
				else {
					alert("Bucket list sync failed: server error " + req.status);
				}
			}
		}

		req.send(null);
	}

	// remove bucketName from preference, and refresh left pane in Zotero
	function removeBucket(bucketName) {
		var prefBucketNames = Zotero.Prefs.get("commons.buckets").split(',');
		var newPrefBucketNames = [];
		for(var i = 0, len = prefBucketNames.length; i < len; i++) {
			if(bucketName != prefBucketNames[i]) {
				newPrefBucketNames.push(prefBucketNames[i]);
			}
		}
		newPrefBucketNames.sort();
		Zotero.Prefs.set("commons.buckets", newPrefBucketNames.join(','));
		Zotero.Notifier.trigger('add', 'bucket', true);
	}

	function _createAuthenticatedRequest(method, resource, headers, accessKey, secretKey) {
		var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
			.createInstance(Components.interfaces.nsIXMLHttpRequest);
		req.open(method, Zotero.Commons.apiUrl + resource, true);

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

		return req;
	}

	function _createUnauthenticatedRequest(method, resource, headers) {
		var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
			.createInstance(Components.interfaces.nsIXMLHttpRequest);
		req.open(method, Zotero.Commons.apiUrl + resource, true);

		for(var header in headers) {
			req.setRequestHeader(header, headers[header]);
		}

		return req;
	}
}


// accessKey and secretKey are passed to allow easy implementation
// of using multiple accounts
Zotero.Commons.Bucket = function(name, accessKey, secretKey) {
	this.name = name;
	this._accessKey = accessKey;
	this._secretKey = secretKey;
	this._items = null;
	this._requestingItems = false;
}


Zotero.Commons.Bucket.prototype.RDF_TRANSLATOR = {
	'label': 'Zotero RDF',
	'target': 'rdf',
	'translatorID': '14763d24-8ba0-45df-8f52-b8d1108e7ac9',
	'displayOptions': {
		'exportFileData': true,
		'exportNotes': true
	}
};


Zotero.Commons.Bucket.prototype.__defineGetter__('uri', function () {
	return 'http://www.archive.org/details/' + this.name;
});

Zotero.Commons.Bucket.prototype.getKeyUrl = function(name, key) {
	return 'http://' + name + '.s3.us.archive.org/' + key;

}

Zotero.Commons.Bucket.prototype.relationPredicate = "owl:sameAs";

// return an array of items currently stored in this bucket
Zotero.Commons.Bucket.prototype.getItems = function() {
	/*if(this._items) {
		return this._items;
	}

	// avoid multiple requests to IA
	if(this._requestingItems) {
		return [];
	}

	this._requestingItems = true;

	// get a list of keys associated with this bucket
	var req = Zotero.Commons._createUnauthenticatedRequest("GET", '/' + this.name + '/', {});
	//req.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;

	var self = this;
	req.onreadystatechange = function() {
		if (req.readyState == 4) {	
			if(req.status < 400) {
				// TODO this is completely wrong and needs to change
				// Need to figure out IA/Zotero interaction first
				self._items = [];
				var contents = req.responseXML.getElementsByTagName("Contents");
				for(var i = 0, len = contents.length; i < len; i++) {
					var keyParts = contents[i].getElementsByTagName('Key')[0].textContent.split('.');
					if(keyParts.length == 2 && keyParts[1] == 'zip') {
						var key = keyParts[0];
						var item = Zotero.Items.getByLibraryAndKey(null, key);
						if(item) {
							self._items.push(item);
						}
					}
				}
				Zotero.Notifier.trigger('refresh', 'bucket', 'all');
			}
			else {
				alert("Request to get the keys of bucket " + self.name + " failed.");
			}
			self._requestingItems = false;
		}
	};

	req.send(null);
	*/
	return [];
}


// upload zipped Zotero RDF output of items to this bucket
Zotero.Commons.Bucket.prototype.uploadItems = function(ids) {
	var items = Zotero.Items.get(ids);
	if (!items) {
		return;
	}

	var tmpDir = Zotero.getTempDirectory();

	// export individual items through the Zotero RDF translation
	for(var i = 0, len = items.length; i < len; i++) {
		var item = items[i];
		if(item.isRegularItem()) {
			// generate file location for the export output
			var rdfExportPath = Components.classes["@mozilla.org/file/local;1"]
				.createInstance(Components.interfaces.nsILocalFile);
			rdfExportPath.initWithFile(tmpDir);
			rdfExportPath.append(item.key);

			// initialize and run the translator for this item
			var translation = new Zotero.Translate("export");
			translation.setItems([item]);
			translation.setTranslator(this.RDF_TRANSLATOR.translatorID);
			translation.setDisplayOptions(this.RDF_TRANSLATOR.displayOptions);
			translation.setHandler("done", this._translateCallback);
			translation.setLocation(rdfExportPath);

			// add some data to translator needed by _translateCallback
			translation._bucketData = {bucket: this, items: [item]};

			translation.translate(); // synchronous
		}
	}
}


// Zips the output of the translation and then calls _putKey
// Called after a translation is done.
Zotero.Commons.Bucket.prototype._translateCallback = function(translation, successful) {
	if(!successful) {
		alert("Commons.TranslatorManager: tranlation failed for " + translation);
	}

	var data = translation._bucketData;

	try {
		var dir = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		dir.initWithPath(translation.path);

		// create zip file	
		var zipFile = Zotero.getTempDirectory();
		zipFile.append(dir.leafName + '.zip');

		var zw = Components.classes["@mozilla.org/zipwriter;1"]
			.createInstance(Components.interfaces.nsIZipWriter);
		zw.open(zipFile, 0x04 | 0x08 | 0x20); // open rw, create, truncate

		data.bucket._zipDirectory(data.bucket, dir, dir, zw);

		data.uploadFile = zipFile;
		data.mimetype = "application/zip";
		// add observer so _putKey is called on zip completion
		var observer = new Zotero.Commons.ZipWriterObserver(zw, data.bucket._putKey, data);
		zw.processQueue(observer, null);
	}
	catch (e) {
		alert("Commons: Upload failed: " + e);
	}
}

// Does the put call to IA, puting data.uploadFile into the bucket
Zotero.Commons.Bucket.prototype._putKey = function(data) {
	var self = data.bucket;
	var key = data.uploadFile.leafName;
	var method = "PUT";
	var resource = '/' + self.name + '/' + key;
	var content = self._readFileContents(data.uploadFile);

	var headers = {
		"Content-Type": data.mimeType,
		"Content-Length": content.length,
		"x-amz-meta-creator": "Zotero Commons"
	};

	var req = Zotero.Commons._createAuthenticatedRequest(
		method, resource, headers, self._accessKey, self._secretKey
	);

	req.onreadystatechange = function() {
		if (req.readyState == 4) {
			if(req.status < 400) {
				for(var i = 0, len = data.items.length; i < len; i++) {
					var url1 = Zotero.URI.getItemURI(data.items[i]);
					var predicate = self.relationPredicate;
					var url2 = self.getKeyUrl(self.name, key);

					if (Zotero.Relations.getByURIs(url1, predicate, url2).length
							|| Zotero.Relations.getByURIs(url2, predicate, url1).length) {
						Zotero.debug(url1 + " and " + url2 + " are already linked");
						continue;
					}
					Zotero.Relations.add(null, url1, predicate, url2);
				}
				Zotero.debug("Commons: " + key + " was uploaded successfully.");
			}
			else if(req.status == 403) {
				alert("Failed to upload " + key + " to IA: authentication failed.");
			}
			else if(req.status == 503) {
				alert("Failed to upload " + key + " to IA: server unavailable.");
			}
			else {
				alert("Failed to upload " + key + " to IA.");
			}
		}
	};

	req.sendAsBinary(content);
}

// return the content of an input nsiFile
Zotero.Commons.Bucket.prototype._readFileContents = function(bfile) {
	var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
		.createInstance(Components.interfaces.nsIFileInputStream);
	istream.init(bfile, -1, -1, false);
	var bstream = Components.classes["@mozilla.org/binaryinputstream;1"]
		.createInstance(Components.interfaces.nsIBinaryInputStream);
	bstream.setInputStream(istream);
	return bstream.readBytes(bstream.available());
}

// Recursively add files and directories to zipWriter
Zotero.Commons.Bucket.prototype._zipDirectory = function(self, rootDir, dir, zipWriter) {
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
		
		if(file.isDirectory()) {
			self._zipDirectory(self, rootDir, file, zipWriter);
			continue;
		}
	}
}



// Implements nsIRequestObserver
Zotero.Commons.ZipWriterObserver = function (zipWriter, callback, callbackData) {
	this._zipWriter = zipWriter;
	this._callback = callback;
	this._callbackData = callbackData;
}

Zotero.Commons.ZipWriterObserver.prototype = {
	onStartRequest: function () {},

	onStopRequest: function(req, context, status) {
		this._zipWriter.close();
		this._callback(this._callbackData);
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

