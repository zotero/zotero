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
    
	
	Utilities based in part on code taken from Piggy Bank 2.1.1 (BSD-licensed)
	
    ***** END LICENSE BLOCK *****
*/

/**
 * @class Utility functions not made available to translators
 */
Zotero.Utilities.Internal = {
	 /*
	 * Adapted from http://developer.mozilla.org/en/docs/nsICryptoHash
	 *
	 * @param	{String|nsIFile}	strOrFile
	 * @param	{Boolean}			[base64=false]	Return as base-64-encoded string rather than hex string
	 * @return	{String}
	 */
	"md5":function(strOrFile, base64) {
		if (typeof strOrFile == 'string') {
			var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
				createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
			converter.charset = "UTF-8";
			var result = {};
			var data = converter.convertToByteArray(strOrFile, result);
			var ch = Components.classes["@mozilla.org/security/hash;1"]
				.createInstance(Components.interfaces.nsICryptoHash);
			ch.init(ch.MD5);
			ch.update(data, data.length);
		}
		else if (strOrFile instanceof Components.interfaces.nsIFile) {
			// Otherwise throws (NS_ERROR_NOT_AVAILABLE) [nsICryptoHash.updateFromStream]
			if (!strOrFile.fileSize) {
				// MD5 for empty string
				return "d41d8cd98f00b204e9800998ecf8427e";
			}
			
			var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
							.createInstance(Components.interfaces.nsIFileInputStream);
			// open for reading
			istream.init(strOrFile, 0x01, 0444, 0);
			var ch = Components.classes["@mozilla.org/security/hash;1"]
						   .createInstance(Components.interfaces.nsICryptoHash);
			// we want to use the MD5 algorithm
			ch.init(ch.MD5);
			// this tells updateFromStream to read the entire file
			const PR_UINT32_MAX = 0xffffffff;
			ch.updateFromStream(istream, PR_UINT32_MAX);
		}
		
		// pass false here to get binary data back
		var hash = ch.finish(base64);
		
		if (istream) {
			istream.close();
		}
		
		if (base64) {
			return hash;
		}
		
		/*
		// This created 36-character hashes
		
		// return the two-digit hexadecimal code for a byte
		function toHexString(charCode) {
			return ("0" + charCode.toString(16)).slice(-2);
		}
		
		// convert the binary hash data to a hex string.
		return [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
		*/
		
		// From http://rcrowley.org/2007/11/15/md5-in-xulrunner-or-firefox-extensions/
		var ascii = [];
		var ii = hash.length;
		for (var i = 0; i < ii; ++i) {
			var c = hash.charCodeAt(i);
			var ones = c % 16;
			var tens = c >> 4;
			ascii.push(String.fromCharCode(tens + (tens > 9 ? 87 : 48)) + String.fromCharCode(ones + (ones > 9 ? 87 : 48)));
		}
		return ascii.join('');
	},
	
	
	/**
	 * Unicode normalization
	 */
	"normalize":function(str) {
		var normalizer = Components.classes["@mozilla.org/intl/unicodenormalizer;1"]
							.getService(Components.interfaces.nsIUnicodeNormalizer);
		var obj = {};
		str = normalizer.NormalizeUnicodeNFC(str, obj);
		return obj.value;
	},
	
	
	/**
	 * Display a prompt from an error with custom buttons and a callback
	 */
	"errorPrompt":function(title, e) {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
		var message, buttonText, buttonCallback;
		
		if (e.data) {
			if (e.data.dialogText) {
				message = e.data.dialogText;
			}
			if (typeof e.data.dialogButtonText != 'undefined') {
				buttonText = e.data.dialogButtonText;
				buttonCallback = e.data.dialogButtonCallback;
			}
		}
		if (!message) {
			if (e.message) {
				message = e.message;
			}
			else {
				message = e;
			}
		}
		
		if (typeof buttonText == 'undefined') {
			buttonText = Zotero.getString('errorReport.reportError');
			buttonCallback = function () {
				win.ZoteroPane.reportErrors();
			}
		}
		// If secondary button is explicitly null, just use an alert
		else if (buttonText === null) {
			ps.alert(null, title, message);
			return;
		}
		
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_OK
							+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
		var index = ps.confirmEx(
			null,
			title,
			message,
			buttonFlags,
			"",
			buttonText,
			"", null, {}
		);
		
		if (index == 1) {
			setTimeout(function () { buttonCallback(); }, 1);
		}
	}
}

/**
 *  Base64 encode / decode
 *  From http://www.webtoolkit.info/
 */
Zotero.Utilities.Internal.Base64 = {
	 // private property
	 _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
	 
	 // public method for encoding
	 encode : function (input) {
		 var output = "";
		 var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
		 var i = 0;
		 
		 input = this._utf8_encode(input);
		 
		 while (i < input.length) {
			 
			 chr1 = input.charCodeAt(i++);
			 chr2 = input.charCodeAt(i++);
			 chr3 = input.charCodeAt(i++);
			 
			 enc1 = chr1 >> 2;
			 enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
			 enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
			 enc4 = chr3 & 63;
			 
			 if (isNaN(chr2)) {
				 enc3 = enc4 = 64;
			 } else if (isNaN(chr3)) {
				 enc4 = 64;
			 }
			 
			 output = output +
			 this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
			 this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
			 
		 }
		 
		 return output;
	 },
	 
	 // public method for decoding
	 decode : function (input) {
		 var output = "";
		 var chr1, chr2, chr3;
		 var enc1, enc2, enc3, enc4;
		 var i = 0;
		 
		 input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
		 
		 while (i < input.length) {
			 
			 enc1 = this._keyStr.indexOf(input.charAt(i++));
			 enc2 = this._keyStr.indexOf(input.charAt(i++));
			 enc3 = this._keyStr.indexOf(input.charAt(i++));
			 enc4 = this._keyStr.indexOf(input.charAt(i++));
			 
			 chr1 = (enc1 << 2) | (enc2 >> 4);
			 chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			 chr3 = ((enc3 & 3) << 6) | enc4;
			 
			 output = output + String.fromCharCode(chr1);
			 
			 if (enc3 != 64) {
				 output = output + String.fromCharCode(chr2);
			 }
			 if (enc4 != 64) {
				 output = output + String.fromCharCode(chr3);
			 }
			 
		 }
		 
		 output = this._utf8_decode(output);
		 
		 return output;
		 
	 },
	 
	 // private method for UTF-8 encoding
	 _utf8_encode : function (string) {
		 string = string.replace(/\r\n/g,"\n");
		 var utftext = "";
		 
		 for (var n = 0; n < string.length; n++) {
			 
			 var c = string.charCodeAt(n);
			 
			 if (c < 128) {
				 utftext += String.fromCharCode(c);
			 }
			 else if((c > 127) && (c < 2048)) {
				 utftext += String.fromCharCode((c >> 6) | 192);
				 utftext += String.fromCharCode((c & 63) | 128);
			 }
			 else {
				 utftext += String.fromCharCode((c >> 12) | 224);
				 utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				 utftext += String.fromCharCode((c & 63) | 128);
			 }
			 
		 }
		 
		 return utftext;
	 },
	 
	 // private method for UTF-8 decoding
	 _utf8_decode : function (utftext) {
		 var string = "";
		 var i = 0;
		 var c = c1 = c2 = 0;
		 
		 while ( i < utftext.length ) {
			 
			 c = utftext.charCodeAt(i);
			 
			 if (c < 128) {
				 string += String.fromCharCode(c);
				 i++;
			 }
			 else if((c > 191) && (c < 224)) {
				 c2 = utftext.charCodeAt(i+1);
				 string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
				 i += 2;
			 }
			 else {
				 c2 = utftext.charCodeAt(i+1);
				 c3 = utftext.charCodeAt(i+2);
				 string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
				 i += 3;
			 }
			 
		 }
		 
		 return string;
	 }
 }