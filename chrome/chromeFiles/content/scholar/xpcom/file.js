Zotero.File = new function(){
	this.getExtension = getExtension;
	this.getSample = getSample;
	this.getContents = getContents;
	this.getCharsetFromFile = getCharsetFromFile;
	this.addCharsetListener = addCharsetListener;
	
	
	function getExtension(file){
		var pos = file.leafName.lastIndexOf('.');
		return pos==-1 ? '' : file.leafName.substr(pos+1);
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
	
	
	function getContents(file, charset){
		var fis = Components.classes["@mozilla.org/network/file-input-stream;1"].
			createInstance(Components.interfaces.nsIFileInputStream);
		fis.init(file, false, false, false);
		
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
		is.init(fis, charset, 1024, replacementChar);
		
		var contents = [], str = {};
		while (is.readString(4096, str) != 0) {
			contents.push(str.value);
		}
		
		is.close();
		
		return contents.join();
	}
	
	
	/*
	 * Not implemented, but it'd sure be great if it were
	 */
	function getCharsetFromString(str){
		
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
			return false;
		}
		
		if (mimeType.substr(0, 5)!='text/' ||
			!Zotero.MIME.hasInternalHandler(mimeType, this.getExtension(file))){
			return false;
		}
		
		var browser = Zotero.Browser.createHiddenBrowser();
		
		var url = Components.classes["@mozilla.org/network/protocol;1?name=file"]
				.getService(Components.interfaces.nsIFileProtocolHandler)
				.getURLSpecFromFile(file);
		
		this.addCharsetListener(browser, callback, args);
		
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
		
		browser.addEventListener("pageshow", function(){
			var charset = browser.contentDocument.characterSet;
			Zotero.debug("Detected character set '" + charset + "'");
			
			//Zotero.debug('Resetting character detector to ' + (oldPref ? oldPref : '(none)'));
			prefService.setCharPref('intl.charset.detector', oldPref);
			
			callback(charset, args);
			
			Zotero.Browser.deleteHiddenBrowser(browser);
		}, false);
	}
}
