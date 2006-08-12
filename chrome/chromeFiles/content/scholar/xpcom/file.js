Scholar.File = new function(){
	this.getExtension = getExtension;
	this.isExternalTextExtension = isExternalTextExtension;
	this.getSample = getSample;
	this.sniffForMIMEType = sniffForMIMEType;
	this.sniffForBinary = sniffForBinary;
	this.getMIMETypeFromFile = getMIMETypeFromFile;
	this.hasInternalHandler = hasInternalHandler;
	
	// Magic numbers
	var _snifferEntries = [
		["%PDF-", "application/pdf"],
		["%!PS-Adobe-", 'application/postscript'],
		["%! PS-Adobe-", 'application/postscript'],
		["From", 'text/plain'],
		[">From", 'text/plain'],
		["#!", 'text/plain'],
		["<?xml", 'text/xml']
	];
	
	// MIME types handled natively by Gecko
	// DEBUG: There's definitely a better way of getting these
	var _nativeMIMETypes = {
		'text/html': true,
		'image/jpeg': true,
		'image/gif': true,
		'text/xml': true,
		'text/plain': true,
		'application/x-javascript': true
	};
	
	// Extensions of text files (generally XML) to force to be external
	var _externalTextExtensions = {
		'graffle': true
	};
	
	
	function getExtension(file){
		var pos = file.leafName.lastIndexOf('.');
		return pos==-1 ? '' : file.leafName.substr(pos+1);
	}
	
	
	/*
	 * Check if file extension should be forced to open externally
	 */
	function isExternalTextExtension(ext){
		return typeof _externalTextExtensions['ext'] != 'undefined';
	}
	
	
	/*
	 * Get the first 128 bytes of the file as a string (multibyte-safe)
	 */
	function getSample(file){
		var fis = Components.classes["@mozilla.org/network/file-input-stream;1"].
			createInstance(Components.interfaces.nsIFileInputStream);
		fis.init(file, false, false, false);
		
		const replacementChar
			= Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER;
		var is = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
			.createInstance(Components.interfaces.nsIConverterInputStream);
		is.init(fis, "UTF-8", 128, replacementChar);
		var str = {};
		var numChars = is.readString(512, str);
		is.close();
		
		return str.value;
	}
	
	/*
	 * Searches file for magic numbers
	 */
	function sniffForMIMEType(file){
		var str = this.getSample(file);
		
		for (var i in _snifferEntries){
			if (str.indexOf(_snifferEntries[i][0])==0){
				return _snifferEntries[i][1];
			}
		}
		
		return false;
	}
	
	
	/*
	 * Searches file for embedded nulls
	 */
	function sniffForBinary(file){
		var str = this.getSample(file);
		
		for (var i=0; i<str.length; i++){
			if (!_isTextCharacter(str.charAt(i))){
				return 'application/octet-stream';
			}
		}
		return 'text/plain';
	}
	
	
	/*
	 * Try to determine the MIME type of the file, trying a few different
	 * techniques
	 */
	function getMIMETypeFromFile(file){
		var mimeType = this.sniffForMIMEType(file);
		if (mimeType){
			Scholar.debug('Detected MIME type ' + mimeType);
			return mimeType;
		}
		
		try {
			var mimeType = Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"]
				.getService(Components.interfaces.nsIMIMEService).getTypeFromFile(file);
			Scholar.debug('Got MIME type ' + mimeType + ' from extension');
			return mimeType;
		}
		catch (e){
			var mimeType = this.sniffForBinary(file);
			Scholar.debug('Cannot determine MIME type -- settling for ' + mimeType);
			return mimeType;
		}
	}
	
	
	/*
	 * Determine if file can be handled internally (natively or with plugins)
	 * or if it needs to be passed off to an external helper app
	 *
	 * Note: it certainly seems there should be a more native way of doing this
	 * without replicating all the Mozilla functionality
	 */
	function hasInternalHandler(file){
		var mimeType = this.getMIMETypeFromFile(file);
		
		if (mimeType=='text/plain'){
			if (this.isExternalTextExtension(this.getExtension(file))){
				Scholar.debug('text/plain file has extension that should be handled externally');
				return false;
			}
			return true;
		}
		
		if (_nativeMIMETypes[mimeType]){
			Scholar.debug('MIME type ' + mimeType + ' can be handled natively');
			return true;
		}
		
		// Is there a better way to get to navigator?
		var types = Components.classes["@mozilla.org/appshell/appShellService;1"]
				.getService(Components.interfaces.nsIAppShellService)
				.hiddenDOMWindow.navigator.mimeTypes;
		
		for (var i in types){
			if (types[i].type==mimeType){
				Scholar.debug('MIME type ' + mimeType + ' can be handled by plugins');
				return true;
			}
		}
		
		Scholar.debug('MIME type ' + mimeType + ' cannot be handled natively');
		return false;
	}
	
	
	/*
	 * Detect whether a character is text
	 * 
	 * Based on RFC 2046 Section 4.1.2. Treat any char 0-31
	 * except the 9-13 range (\t, \n, \v, \f, \r) and char 27 (used by
     * encodings like Shift_JIS) as non-text
	 *
	 * This is the logic used by the Mozilla sniffer.
	 */
	function _isTextCharacter(chr){
		var chr = chr.charCodeAt(0);
		return chr > 31 || (9 <= chr && chr <=13 ) || chr == 27;
	}
}
