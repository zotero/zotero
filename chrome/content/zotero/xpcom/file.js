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

Zotero.File = new function(){
	this.getExtension = getExtension;
	this.getClosestDirectory = getClosestDirectory;
	this.getSample = getSample;
	this.getContents = getContents;
	this.getContentsFromURL = getContentsFromURL;
	this.putContents = putContents;
	this.getValidFileName = getValidFileName;
	this.copyToUnique = this.copyToUnique;
	this.getCharsetFromFile = getCharsetFromFile;
	this.addCharsetListener = addCharsetListener;
	
	
	function getExtension(file){
		var pos = file.leafName.lastIndexOf('.');
		return pos==-1 ? '' : file.leafName.substr(pos+1);
	}
	
	
	/*
	 * Traverses up the filesystem from a file until it finds an existing
	 *  directory, or false if it hits the root
	 */
	function getClosestDirectory(file) {
		var dir = file.parent;
		
		while (dir && !dir.exists()) {
			var dir = dir.parent;
		}
		
		if (dir && dir.exists()) {
			return dir;
		}
		return false;
	}
	
	
	/*
	 * Get the first 128 bytes of the file as a string (multibyte-safe)
	 */
	function getSample(file){
		var fis = Components.classes["@mozilla.org/network/file-input-stream;1"].
			createInstance(Components.interfaces.nsIFileInputStream);
		fis.init(file, 0x01, 0664, 0);
		
		const replacementChar
			= Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER;
		var is = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
			.createInstance(Components.interfaces.nsIConverterInputStream);
		is.init(fis, "UTF-8", 128, replacementChar);
		var str = {};
		var numChars = is.readString(128, str);
		is.close();
		
		return str.value;
	}
	
	
	/**
	 * Get contents of a binary file
	 */
	this.getBinaryContents = function(file) {
		var iStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
					 .createInstance(Components.interfaces.nsIFileInputStream);
		iStream.init(file, 0x01, 0664, 0);
		var bStream = Components.classes["@mozilla.org/binaryinputstream;1"]
					 .createInstance(Components.interfaces.nsIBinaryInputStream);
		bStream.setInputStream(iStream);
		var string = bStream.readBytes(file.fileSize);
		iStream.close();
		return string;
	}
	
	
	function getContents(file, charset, maxLength){
		var fis = Components.classes["@mozilla.org/network/file-input-stream;1"].
			createInstance(Components.interfaces.nsIFileInputStream);
		fis.init(file, 0x01, 0664, 0);
		
		if (charset){
			charset = Zotero.CharacterSets.getName(charset);
		}
		
		if (!charset){
			charset = "UTF-8";
		}
		
		const replacementChar
			= Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER;
		var is = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
			.createInstance(Components.interfaces.nsIConverterInputStream);
		is.init(fis, charset, 4096, replacementChar);
		var chars = 4096;
		
		var contents = [], str = {};
		while (is.readString(4096, str) != 0) {
			if (maxLength) {
				chars += 4096;
				if (chars >= maxLength) {
					Zotero.debug('Stopping at ' + (chars - 4096)
						+ ' characters in File.getContents()');
					break;
				}
			}
			
			contents.push(str.value);
		}
		
		is.close();
		
		return contents.join('');
	}
	
	
	
	/**
	 * Return the contents of a file as a byte array
	 */
	this.getBinaryContents = function (bfile) {
		var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		istream.init(bfile, -1, -1, false);
		var bstream = Components.classes["@mozilla.org/binaryinputstream;1"]
			.createInstance(Components.interfaces.nsIBinaryInputStream);
		bstream.setInputStream(istream);
		return bstream.readBytes(bstream.available());
	}
	
	
	/*
	 * Return the contents of a URL as a string
	 *
	 * Runs synchronously, so should only be run on local (e.g. chrome) URLs
	 */
	function getContentsFromURL(url) {
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
		xmlhttp.open('GET', url, false);
		xmlhttp.send(null);
		return xmlhttp.responseText;
	}
	
	
	/*
	 * Write string to a file, overwriting existing file if necessary
	 */
	function putContents(file, str) {
		if (file.exists()) {
			file.remove(null);
		}
		var fos = Components.classes["@mozilla.org/network/file-output-stream;1"].
				createInstance(Components.interfaces.nsIFileOutputStream);
		fos.init(file, 0x02 | 0x08 | 0x20, 0664, 0);  // write, create, truncate
		
		var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
						   .createInstance(Components.interfaces.nsIConverterOutputStream);
		os.init(fos, "UTF-8", 4096, "?".charCodeAt(0));
		os.writeString(str);
		os.close();
		
		fos.close();
	}
	
	
	function copyToUnique(file, newFile) {
		newFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
		var newName = newFile.leafName;
		newFile.remove(null);
		
		// Copy file to unique name
		file.copyTo(newFile.parent, newName);
		return file;
	}
	
	
	/**
	 * Copies all files from dir into newDir
	 */
	this.copyDirectory = function (dir, newDir) {
		if (!dir.exists()) {
			throw ("Directory doesn't exist in Zotero.File.copyDirectory()");
		}
		var otherFiles = dir.directoryEntries;
		while (otherFiles.hasMoreElements()) {
			var file = otherFiles.getNext();
			file.QueryInterface(Components.interfaces.nsIFile);
			file.copyTo(newDir, null);
		}
	}
	
	
	this.createDirectoryIfMissing = function (dir) {
		if (!dir.exists() || !dir.isDirectory()) {
			if (dir.exists() && !dir.isDirectory()) {
				dir.remove(null);
			}
			dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
		}
	}
	
	
	/**
	 * Strip potentially invalid characters
	 *
	 * See http://en.wikipedia.org/wiki/Filename#Reserved_characters_and_words
	 *
	 * @param	{String}	fileName
	 * @param	{Boolean}	[skipXML=false]		Don't strip characters invalid in XML
	 */
	function getValidFileName(fileName, skipXML) {
		// TODO: use space instead, and figure out what's doing extra
		// URL encode when saving attachments that trigger this
		fileName = fileName.replace(/[\/\\\?%\*:|"<>]/g, '');
		// Replace newlines (which shouldn't be in the string in the first place) with spaces
		fileName = fileName.replace(/\n/g, ' ');
		if (!skipXML) {
			// Strip characters not valid in XML, since they won't sync and they're probably unwanted
			fileName = fileName.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/g, '');
		}
		// Don't allow blank filename
		if (!fileName) {
			fileName = '_';
		}
		return fileName;
	}
	
	
	/*
	 * Not implemented, but it'd sure be great if it were
	 */
	function getCharsetFromByteArray(arr) {
		
	}
	
	
	/*
	 * An extraordinarily inelegant way of getting the character set of a
	 * text file using a hidden browser
	 *
	 * I'm quite sure there's a better way
	 *
	 * Note: This is for text files -- don't run on other files
	 *
	 * 'callback' is the function to pass the charset (and, if provided, 'args')
	 * to after detection is complete
	 */
	function getCharsetFromFile(file, mimeType, callback, args){
		if (!file || !file.exists()){
			callback(false, args);
			return;
		}
		
		if (mimeType.substr(0, 5) != 'text/' ||
				!Zotero.MIME.hasInternalHandler(mimeType, this.getExtension(file))) {
			callback(false, args);
			return;
		}
		
		var browser = Zotero.Browser.createHiddenBrowser();
		
		var url = Components.classes["@mozilla.org/network/protocol;1?name=file"]
				.getService(Components.interfaces.nsIFileProtocolHandler)
				.getURLSpecFromFile(file);
		
		this.addCharsetListener(browser, function (charset, args) {
			callback(charset, args);
			Zotero.Browser.deleteHiddenBrowser(browser);
		}, args);
		
		browser.loadURI(url);
	}
	
	
	/*
	 * Attach a load listener to a browser object to perform charset detection
	 *
	 * We make sure the universal character set detector is set to the
	 * universal_charset_detector (temporarily changing it if not--shhhh)
	 *
	 * 'callback' is the function to pass the charset (and, if provided, 'args')
	 * to after detection is complete
	 */
	function addCharsetListener(browser, callback, args){
		var prefService = Components.classes["@mozilla.org/preferences-service;1"]
							.getService(Components.interfaces.nsIPrefBranch);
		var oldPref = prefService.getCharPref('intl.charset.detector');
		var newPref = 'universal_charset_detector';
		//Zotero.debug("Default character detector is " + (oldPref ? oldPref : '(none)'));
		
		if (oldPref != newPref){
			//Zotero.debug('Setting character detector to universal_charset_detector');
			prefService.setCharPref('intl.charset.detector', 'universal_charset_detector');
		}
		
		var onpageshow = function(){
			// ignore spurious about:blank loads
			if(browser.contentDocument.location.href == "about:blank") return;

			browser.removeEventListener("pageshow", onpageshow, false);
			
			var charset = browser.contentDocument.characterSet;
			Zotero.debug("Detected character set '" + charset + "'");
			
			//Zotero.debug('Resetting character detector to ' + (oldPref ? oldPref : '(none)'));
			prefService.setCharPref('intl.charset.detector', oldPref);
			
			callback(charset, args);
		};
		
		browser.addEventListener("pageshow", onpageshow, false);
	}
}
