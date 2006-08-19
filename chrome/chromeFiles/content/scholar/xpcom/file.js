Scholar.File = new function(){
	this.getExtension = getExtension;
	this.getSample = getSample;
	
	
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
	
	
	function getCharsetFromFile(file){
		var browser = Scholar.Browser.createHiddenBrowser();
		var url = Components.classes["@mozilla.org/network/protocol;1?name=file"]
				.getService(Components.interfaces.nsIFileProtocolHandler)
				.getURLSpecFromFile(file);
				
		var prefService = Components.classes["@mozilla.org/preferences-service;1"]
							.getService(Components.interfaces.nsIPrefBranch);
		var oldPref = prefService.getCharPref('intl.charset.detector');
		
		browser.addEventListener("load", function(){
			var charset = browser.contentDocument.characterSet;
			Scholar.debug('Resetting character detector to ' + oldPref);
			prefService.setCharPref('intl.charset.detector', oldPref);
			Scholar.Browser.deleteHiddenBrowser(browser);
			
		}, true);
		
		var newPref = 'universal_charset_detector';
		if (oldPref!=newPref){
			Scholar.debug('Setting character detector to universal_charset_detector');
			prefService.setCharPref('intl.charset.detector', 'universal_charset_detector'); // universal_charset_detector
		}
		
		browser.loadURI(url, Components.interfaces.nsIWebNavigation.LOAD_FLAGS_BYPASS_HISTORY);
	}
}
