/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/

Zotero.MIME = new function(){
	this.isTextType = isTextType;
	this.isExternalTextExtension = isExternalTextExtension;
	this.sniffForMIMEType = sniffForMIMEType;
	this.sniffForBinary = sniffForBinary;
	this.getMIMETypeFromData = getMIMETypeFromData;
	this.getMIMETypeFromFile = getMIMETypeFromFile;
	this.hasNativeHandler = hasNativeHandler;
	this.hasInternalHandler = hasInternalHandler;
	this.fileHasInternalHandler = fileHasInternalHandler;
	
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
	
	var _textTypes = {
		'application/xhtml+xml': true,
		'application/xml': true,
		'application/x-javascript': true
	};
	
	// MIME types handled natively by Gecko
	// DEBUG: There's definitely a better way of getting these
	var _nativeMIMETypes = {
		'text/html': true,
		'text/css': true,
		'image/jpeg': true,
		'image/gif': true,
		'text/xml': true,
		'application/xhtml+xml': true,
		'application/xml': true,
		'text/plain': true,
		'application/x-javascript': true
	};
	
	// Extensions of text files (generally XML) to force to be external
	var _externalTextExtensions = {
		'graffle': true
	};
	
	
	
	function isTextType(mimeType) {
		return mimeType.substr(0, 5) == 'text/' || _textTypes[mimeType];
	}
	
	
	/*
	 * Check if file extension should be forced to open externally
	 */
	function isExternalTextExtension(ext){
		return typeof _externalTextExtensions['ext'] != 'undefined';
	}
	
	
	/*
	 * Searches string for magic numbers
	 */
	function sniffForMIMEType(str){
		for (var i in _snifferEntries){
			if (str.indexOf(_snifferEntries[i][0])==0){
				return _snifferEntries[i][1];
			}
		}
		
		return false;
	}
	
	
	/*
	 * Searches string for embedded nulls
	 *
	 * Returns 'application/octet-stream' or 'text/plain'
	 */
	function sniffForBinary(str){
		for (var i=0; i<str.length; i++){
			if (!_isTextCharacter(str.charAt(i))){
				return 'application/octet-stream';
			}
		}
		return 'text/plain';
	}
	
	
	/*
	 * Try to determine the MIME type of a string, using a few different
	 * techniques
	 *
	 * ext is an optional file extension hint if data sniffing is unsuccessful
	 */
	function getMIMETypeFromData(str, ext){
		var mimeType = sniffForMIMEType(str);
		if (mimeType){
			Zotero.debug('Detected MIME type ' + mimeType);
			return mimeType;
		}
		
		try {
			if (ext) {
				var mimeType = Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"]
					.getService(Components.interfaces.nsIMIMEService).getTypeFromExtension(ext);
				Zotero.debug('Got MIME type ' + mimeType + ' from extension');
				return mimeType;
			}
		}
		catch (e) {}
		
		var mimeType = sniffForBinary(str);
		Zotero.debug('Cannot determine MIME type from magic number or extension -- settling for ' + mimeType);
		return mimeType;
	}
	
	
	/*
	 * Try to determine the MIME type of the file, using a few different
	 * techniques
	 */
	function getMIMETypeFromFile(file){
		var str = Zotero.File.getSample(file);
		var ext = Zotero.File.getExtension(file);
		
		return getMIMETypeFromData(str, ext);
	}
	
	
	/*
	 * Determine if a MIME type can be handled natively
	 * or if it needs to be passed off to a plugin or external helper app
	 *
	 * ext is an optional extension hint (only needed for text/plain files
	 * that should be forced to open externally)
	 *
	 * Note: it certainly seems there should be a more native way of doing this
	 * without replicating all the Mozilla functionality
	 *
	 * Note: nsIMIMEInfo provides a hasDefaultHandler() method, but it doesn't
	 * do what we need
	 */
	function hasNativeHandler(mimeType, ext) {
		if (mimeType=='text/plain'){
			if (isExternalTextExtension(ext)){
				Zotero.debug('text/plain file has extension that should be handled externally');
				return false;
			}
			return true;
		}
		
		if (_nativeMIMETypes[mimeType]){
			Zotero.debug('MIME type ' + mimeType + ' can be handled natively');
			return true;
		}
		
		return null;
	}
	
	
	/*
	 * Determine if a MIME type can be handled internally
	 * or if it needs to be passed off to an external helper app
	 *
	 * Similar to hasNativeHandler() but also includes plugins
	 */
	function hasInternalHandler(mimeType, ext) {
		var isNative = hasNativeHandler(mimeType, ext);
		if (isNative !== null) {
			return isNative;
		}
		
		// Is there a better way to get to navigator?
		var types = Components.classes["@mozilla.org/appshell/appShellService;1"]
				.getService(Components.interfaces.nsIAppShellService)
				.hiddenDOMWindow.navigator.mimeTypes;
		
		for (var i in types){
			if (types[i].type==mimeType){
				Zotero.debug('MIME type ' + mimeType + ' can be handled by plugins');
				return true;
			}
		}
		
		Zotero.debug('MIME type ' + mimeType + ' cannot be handled natively');
		return false;
	}
	
	
	function fileHasInternalHandler(file){
		var mimeType = getMIMETypeFromFile(file);
		var ext = Zotero.File.getExtension(file);
		return hasInternalHandler(mimeType, ext);
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
