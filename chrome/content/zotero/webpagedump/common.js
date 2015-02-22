/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is ScrapBook.
 *
 * The Initial Developer of the Original Code is Gomita.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Bernhard Pollak <pollak@dbai.tuwien.ac.at> (WebPageDump Fork)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU Affero General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
// --------------------------------------------------------------------------------
// "WebPageDump" Firefox Extension
// --------------------------------------------------------------------------------
// - File: "common.js" -
// - Description:
//   provides common functions (file, preferences, windows, error,...)
//
// --------------------------------------------------------------------------------
var gBrowserWindow = null;
var gExceptLocation = "about:blank";
var gCallback = "";
var gTimeOutID = 0;
var gTimedOut = false;
var gWaitForPaint = false;

var MODE_SIMULATE = false;
var WPD_DEFAULTWIDTH = 1024;
var WPD_DEFAULTHEIGHT = 768;

var WPD_MAXUIERRORCOUNT = 8;

// maximum character length for a valid file name (excluding extension)
var WPD_MAX_FILENAME_LENGTH = 100;

/*function wpdGetTopBrowserWindow()
{
  var winMed = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                         .getService(Components.interfaces.nsIWindowMediator);
  var winList = winMed.getZOrderDOMWindowEnumerator("navigator:browser", true);
  if (!winList.hasMoreElements())
    return top.getBrowser().contentWindow; // fallback

  return winList.getNext().getBrowser().contentWindow;
}*/



/* [14:55:15] paolinho:     var browserWin = windowMediator.getMostRecentWindow("navigator:browser");
    const mainTabBox = browserWin.getBrowser().mTabBox;
    const topWindow = browserWin.getBrowser().browsers[mainTabBox.selectedIndex].contentWindow;
[14:55:50]
         var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
*/

function wpdGetTopBrowserWindow() {
	var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService();
	var windowManagerInterface = windowManager.QueryInterface(Components.interfaces.nsIWindowMediator);
	var topWindowOfType = windowManagerInterface.getMostRecentWindow("navigator:browser");

	if (topWindowOfType) {
		return topWindowOfType;
	}
	return null;
}


function wpdWindowLoaded() {
	try {
		// this will be called multiple times if the page contains more than one document (frames, flash,...)
		//var browser=this.document.getElementById("content");
		Zotero.debug("[wpdWindowLoaded] ... ");
		var browser = this.top.getBrowser();
		// each time we have to check if the page is fully loaded...
		if (!(browser.webProgress.isLoadingDocument || browser.contentDocument.location == gExceptLocation)) {
			Zotero.debug("[wpdWindowLoaded] window finally loaded");
			gBrowserWindow.clearTimeout(gTimeOutID);
			gBrowserWindow.removeEventListener("load", wpdWindowLoaded, true);
			//dump("[wpdWindowLoaded] calling "+gCallback+"\n");
			if (gWaitForPaint) {
				wpdCommon.sizeWindow(WPD_DEFAULTWIDTH - 1, WPD_DEFAULTHEIGHT); // this is for the strange empty lines bug
				wpdCommon.sizeWindow(WPD_DEFAULTWIDTH, WPD_DEFAULTHEIGHT);
			}
			var w = 0;
			if (gWaitForPaint) w = 5000; // wait for painting
			gBrowserWindow.setTimeout(gCallback, w);
		}
	} catch (ex) {
		Zotero.debug("[wpdWindowLoaded] EXCEPTION: " + ex);
	}
}

function wpdTimeOut() {
	Zotero.debug("[wpdTimeOut] timeout triggered!");
	gTimedOut = true;
	gBrowserWindow.clearTimeout(gTimeOutID);
	gBrowserWindow.removeEventListener("load", wpdWindowLoaded, true);
	gBrowserWindow.setTimeout(gCallback, 0);
}

function wpdIsTimedOut() {
	return gTimedOut;
}

function wpdLoadURL(aURI, aCallback) {
	try {
		gTimedOut = false;
		Zotero.debug("[wpdLoadURL] aURI: " + aURI);
		if (aURI == "") return;
		gBrowserWindow = wpdGetTopBrowserWindow();
		gBrowserWindow.loadURI(aURI);
		gCallback = aCallback;
		// 30 seconds maximum for loading the page
		gTimeOutID = gBrowserWindow.setTimeout(wpdTimeOut, 60000);
		gBrowserWindow.addEventListener("load", wpdWindowLoaded, true);
	} catch (ex) {
		Zotero.debug("[wpdLoadURL] EXCEPTION: " + ex);
	}
}

var wpdCommon = {

	errList: "",
	errCount: 0,
	downloading: false,
	downloaded: false,

	allowed_entities:
		"&quot;&amp;&apos;&lt;&gt;&nbsp;&iexcl;&cent;&pound;&curren;&yen;&brvbar;" +
		"&sect;&uml;&copy;&ordf;&laquo;&not;&shy;&reg;&macr;&deg;&plusmn;" +
		"&sup2;&sup3;&acute;&micro;&para;&middot;&cedil;&sup1;&ordm;&raquo;" +
		"&frac14;&frac12;&frac34;&iquest;&Agrave;&Aacute;&Acirc;&Atilde;&Auml;" +
		"&Aring;&AElig;&Ccedil;&Egrave;&Eacute;&Ecirc;&Euml;&Igrave;&Iacute;" +
		"&Icirc;&Iuml;&ETH;&Ntilde;&Ograve;&Oacute;&Ocirc;&Otilde;&Ouml;" +
		"&times;&Oslash;&Ugrave;&Uacute;&Ucirc;&Uuml;&Yacute;&THORN;&szlig;" +
		"&agrave;&aacute;&acirc;&atilde;&auml;&aring;&aelig;&ccedil;&egrave;" +
		"&eacute;&ecirc;&euml;&igrave;&iacute;&icirc;&iuml;&eth;&ntilde;&ograve;" +
		"&oacute;&ocirc;&otilde;&ouml;&divide;&oslash;&ugrave;&uacute;&ucirc;&uuml;" +
		"&yacute;&thorn;&yuml;&OElig;&oelig;&Scaron;&scaron;&Yuml;&fnof;&circ;" +
		"&tilde;&Alpha;&Beta;&Gamma;&Delta;&Epsilon;&Zeta;&Eta;&Theta;&Iota;&Kappa;" +
		"&Lambda;&Mu;&Nu;&Xi;&Omicron;&Pi;&Rho;&Sigma;&Tau;&Upsilon;&Phi;&Chi;&Psi;" +
		"&Omega;&alpha;&beta;&gamma;&delta;&epsilon;&zeta;&eta;&theta;&iota;&kappa;" +
		"&lambda;&mu;&nu;&xi;&omicron;&pi;&rho;&sigmaf;&sigma;&tau;&upsilon;&phi;" +
		"&chi;&psi;&omega;&thetasym;&upsih;&phi;&piv;&ensp;&emsp;&thinsp;&zwnj;" +
		"&zwj;&lrm;&rlm;&ndash;&mdash;&lsquo;&rsquo;&sbquo;&ldquo;&rdquo;&bdquo;" +
		"&dagger;&Dagger;&bull;&hellip;&permil;&prime;&Prime;&lsaquo;&rsaquo;" +
		"&oline;&frasl;&euro;&image;&weierp;&real;&trade;&alefsym;&larr;&uarr;" +
		"&rarr;&darr;&harr;&crarr;&lArr;&uArr;&rArr;&dArr;&hArr;&forall;" +
		"&part;&exist;&empty;&nabla;&isin;&notin;&ni;&prod;&sum;&minus;&lowast;&radic;" +
		"&prop;&infin;&ang;&or;&cap;&cup;&int;&there4;&sim;&cong;&asymp;&ne;&equiv;" +
		"&le;&ge;&sub;&sup;&nsub;&sube;&supe;&oplus;&otimes;&perp;&sdot;&lceil;" +
		"&rceil;&lfloor;&rfloor;&lang;&rang;&loz;&spades;&clubs;&hearts;&diams;",



	trim: function (aString) {
		try {
			return (aString.replace(/\s+$/, "").replace(/^\s+/, ""));
		} catch (ex) {
			return aString;
		}
	},


	// checks the CRLFs at the beginning - if there are CRLFs present
	// one additional CRLF will be added at the beginning
	checkCRLF: function (aNode) {
		try {
			var before = false;
			var after = false;
			if (aNode.parentNode.firstChild == aNode) before = true;
			if (!before && !after) {
				throw new Error("return");
			}
			// why <BR>? Because the <BR> Tag ist not present in text DOM nodes...
			var aString = aNode.nodeValue;
			if (aString.search(/\n/) == -1) throw new Error("return");
			aString = (aString.replace(/\r\n/g, "<br>").replace(/\n/g, "<br>"));
			var a = aString.split("<br>");
			var s = 0;
			var e = 0;


			if (before) {
				for (var i = 0; i < a.length; i++) {
					if (this.trim(a[i]) != "") {
						break;
					} else {
						s++;
						break; //we only need to now if there are any
					}
				}
			}

			aString = a.join("\r\n");
			if (s > 0) aString = "\r\n" + aString;
			return aString;

		} catch (ex) {
			return aNode.nodeValue;
		}
	},

	unicodeToEntity: function (text, charset) {

		function convertEntity(letter) {
			try {
				var l = gEntityConverter.ConvertToEntity(letter, entityVersion);
				// is the entity allowed?
				if (entities.indexOf(l) >= 0) {
					return l;
				} else if ((l != letter)) {
					return "&#" + letter.charCodeAt(0) + ";";
				}
			} catch (ex) {}
			// now we check if the letter is valid inside the destination charset
			// (if the result is a ? it is not valid - except letter=?)
			try {
				var s = gUnicodeConverter.ConvertFromUnicode(letter);
				if ((charset != "UTF-8") && (s == "?")) {
					return "&#" + letter.charCodeAt(0) + ";";
				}
			} catch (ex) {}
			return letter;
		}

		if (!gUnicodeConverter) {
			try {
				var gUnicodeConverter = Components.classes['@mozilla.org/intl/scriptableunicodeconverter'].getService(Components.interfaces.nsIScriptableUnicodeConverter);
				gUnicodeConverter.charset = charset;
			} catch (ex) {
				Zotero.debug("gUnicodeConverter EXCEPTION:" + ex);
			}
		}

		if (!gEntityConverter) {
			try {
				var gEntityConverter = Components.classes["@mozilla.org/intl/entityconverter;1"].createInstance(Components.interfaces.nsIEntityConverter);
			} catch (e) {
				Zotero.debug("gEntityConverter EXCEPTION:" + ex);
			}
		}

		// Firefox - Source Code Snippet:
		// const unsigned long entityNone = 0;
		// const unsigned long html40Latin1 = 1;
		// const unsigned long html40Symbols = 2;
		// const unsigned long html40Special = 4;  // excludes ", &, <, >
		// const unsigned long transliterate = 8;
		// const unsigned long mathml20 = 16;
		// const unsigned long html32 = html40Latin1;
		// const unsigned long html40 = html40Latin1+html40Symbols+html40Special;
		// const unsigned long entityW3C = html40+mathml20;
		const entityVersion = Components.interfaces.nsIEntityConverter.html40;
		// convert to entities (
		// replace other chars > 0x7f via nsIEntityConverter/convertEntity
		var entities = this.allowed_entities;
		text = text.replace(/[^\0-\u007f]/g, convertEntity);
		return text;
	},


	playSound: function () {
		try {
			var sound = Components.classes["@mozilla.org/sound;1"].createInstance(Components.interfaces.nsISound);
			sound.playSystemSound("ringin.wav");
		} catch (ex) {}
	},

	// return the current focused window
	getFocusedWindow: function () {
		var win = document.commandDispatcher.focusedWindow;
		if (!win || win == window || win instanceof Components.interfaces.nsIDOMChromeWindow) win = window._content;
		return win;
	},

	sizeWindow: function (w, h) {
		try {
			var window = this.getFocusedWindow();
			window.moveTo(0, 0);
			if ((w == 0) || (w > screen.availWidth)) w = screen.availWidth;
			if ((h == 0) || (w > screen.availHeight)) h = screen.availHeight;
			window.resizeTo(w, h);
			window.focus();
		} catch (ex) {}
	},

	// add a line to the error list (displays a maximum of 15 errors)
	addError: function (errorMsg, errorObj) {
		if (errorMsg) Zotero.debug(errorMsg);
		if (errorObj) Zotero.debug(errorObj);
		/*
		if (this.errCount < WPD_MAXUIERRORCOUNT) {
			if (this.errList.indexOf(aError) > -1) return; // is the same
			this.errList = this.errList + aError + "\n";
		} else if (this.errCount == WPD_MAXUIERRORCOUNT) {
			this.errList = this.errList + '...';
		}
		this.errCount++;
		*/
	},

	saveWebPage: function (aDestFile) {
		Zotero.debug("[saveWebPage] " + aDestFile);
		var nsIWBP = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Components.interfaces.nsIWebBrowserPersist);
		var doc = window.content.document;
		var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		file.initWithPath(aDestFile);
		var dataPath = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		dataPath.initWithPath(this.getFilePath(aDestFile));
		nsIWBP.saveDocument(doc, file, dataPath, null, 0, 0);
	},

	// returns num as string of length i filled up with 0s
	addLeftZeros: function (num, i) {
		var s = "" + num;
		var r = "";
		for (var f = 0; f < i - s.length; f++) r = r + "0";
		return r + s;
	},

	// split the filename in filename and extension
	splitFileName: function (aFileName) {
		var pos = aFileName.lastIndexOf(".");
		var ret = [];
		if (pos != -1) {
			ret[0] = aFileName.substring(0, pos);
			ret[1] = aFileName.substring(pos + 1, aFileName.length);
		} else {
			ret[0] = aFileName;
			ret[1] = "";
		}
		return ret;
	},

	// replace illegal characters
	// and shorten long file names
	getValidFileName: function (aFileName) {
		aFileName = Zotero.File.getValidFileName(aFileName);
		return Zotero.File.truncateFileName(aFileName, WPD_MAX_FILENAME_LENGTH);
	},

	getURL: function () {
		return top.window._content.document.location.href;
	},

	// remove get variables from an URL
	removeGETFromURL: function (aURL) {
		var pos;
		aURL = ((pos = aURL.indexOf("?")) != -1) ? aURL.substring(0, pos) : aURL;
		aURL = ((pos = aURL.indexOf("#")) != -1) ? aURL.substring(0, pos) : aURL;
		return aURL;
	},

	// extract filename from URL
	getFileName: function (aURL) {
		var pos;
		aURL = this.removeGETFromURL(aURL);
		aURL = ((pos = aURL.lastIndexOf("/")) != -1) ? aURL.substring(++pos) : aURL;
		return aURL;
	},

	filePathToURI: function (filePath) {
		var obj_File = Components.classes["@mozilla.org/file/local;1"].getService(Components.interfaces.nsILocalFile);
		obj_File.initWithPath(filePath);
		var obj_FPH = Components.classes["@mozilla.org/network/protocol;1?name=file"].getService(Components.interfaces.nsIFileProtocolHandler);
		return obj_FPH.getURLSpecFromFile(obj_File);
	},

	URLToFilePath: function (aURL) {
		var obj_FPH = Components.classes["@mozilla.org/network/protocol;1?name=file"].getService(Components.interfaces.nsIFileProtocolHandler);
		try {
			return obj_FPH.getFileFromURLSpec(aURL).path;
		} catch (ex) {
			return aURL;
		}
	},

	// right part of filepath/filename
	getFileLeafName: function (filePath) {
		var obj_File = Components.classes["@mozilla.org/file/local;1"].getService(Components.interfaces.nsILocalFile);
		obj_File.initWithPath(filePath);
		return obj_File.leafName;
	},

	getFilePath: function (filePath) {
		var obj_File = Components.classes["@mozilla.org/file/local;1"].getService(Components.interfaces.nsILocalFile);
		obj_File.initWithPath(filePath);
		var pos; // Added by Dan S. for Zotero
		return ((pos = filePath.lastIndexOf(obj_File.leafName)) != -1) ? filePath.substring(0, pos) : filePath;
	},

	appendFilePath: function (filePath, appendPath) {
		var obj_File = Components.classes["@mozilla.org/file/local;1"].getService(Components.interfaces.nsILocalFile);
		obj_File.initWithPath(filePath);
		obj_File.appendRelativePath(appendPath);
		return obj_File.path;
	},

	pathExists: function (filePath) {
		var obj_File = Components.classes["@mozilla.org/file/local;1"].getService(Components.interfaces.nsILocalFile);
		try {
			obj_File.initWithPath(filePath);
			return obj_File.exists();
		} catch (ex) {
			return false;
		}
	},

	// add the HTML Tag Stuff to aNode and embedd the aNode.innerHTML between the tags
	nodeToHTMLString: function (aNode) {
		if (aNode == null) return "";
		var tag = "<" + aNode.nodeName.toLowerCase();
		for (var i = 0; i < aNode.attributes.length; i++) {
			tag += ' ' + aNode.attributes[i].name + '="' + aNode.attributes[i].value + '"';
		}
		tag += ">\n";
		return tag + aNode.innerHTML + "</" + aNode.nodeName.toLowerCase() + ">\n";
	},

	ConvertFromUnicode16: function (aString, charset) {
		if (!aString) return "";
		try {
			var UNICODE = Components.classes['@mozilla.org/intl/scriptableunicodeconverter'].getService(Components.interfaces.nsIScriptableUnicodeConverter);
			UNICODE.charset = charset;
			aString = UNICODE.ConvertFromUnicode(aString);
			aString = aString + UNICODE.Finish();
		} catch (ex) {
			//this.addError("[wpdCommon.convertStringToCharset]:\n -> charset: "+charset+"\n -> "+ex);
		}
		return aString;
	},

	ConvertToUnicode16: function (aString, charset) {
		if (!aString) return "";
		try {
			var UNICODE = Components.classes['@mozilla.org/intl/scriptableunicodeconverter'].getService(Components.interfaces.nsIScriptableUnicodeConverter);
			UNICODE.charset = charset;
			aString = UNICODE.ConvertToUnicode(aString);
		} catch (ex) {
			//this.addError("[wpdCommon.convertStringToCharset]:\n -> charset: "+charset+"\n -> "+ex);
		}
		return aString;
	},

	// convert the doctype to an HTML doctype String
	doctypeToHTMLString: function (aDoctype) {
		if (!aDoctype) return "";
		var ret = "<!DOCTYPE " + aDoctype.name;
		if (aDoctype.publicId) ret += ' PUBLIC "' + aDoctype.publicId + '"';
		if (aDoctype.systemId) ret += ' "' + aDoctype.systemId + '"';
		ret += ">\n";
		return ret;
	},

	addCommentTag: function (targetNode, aComment) {
		targetNode.appendChild(document.createTextNode("\n"));
		targetNode.appendChild(document.createComment(aComment));
		targetNode.appendChild(document.createTextNode("\n"));
	},


	removeNodeFromParent: function (aNode) {
		// Added by Dan S. for Zotero
		var document = aNode.ownerDocument;

		var newNode = document.createTextNode("");
		aNode.parentNode.replaceChild(newNode, aNode);
		aNode = newNode;
		return aNode;
	},

	// convert URL String to Object
	// for easier URL handling
	convertURLToObject: function (aURLString) {
		var aURL = Components.classes['@mozilla.org/network/standard-url;1'].createInstance(Components.interfaces.nsIURL);
		aURL.spec = aURLString;
		return aURL;
	},

	// resolves the relative URL (aRelURL) with the base URL (aBaseURL)
	resolveURL: function (aBaseURL, aRelURL) {
		try {
			var aBaseURLObj = this.convertURLToObject(aBaseURL);
			return aBaseURLObj.resolve(aRelURL);
		} catch (ex) {
			this.addError("[wpdCommon.resolveURL]:\n -> aBaseURL: " + aBaseURL + "\n -> aRelURL: " + aRelURL, ex);
		}
		return "";
	},

	getHostName: function (aURL) {
		try {
			var aURLObj = Components.classes['@mozilla.org/network/standard-url;1'].createInstance(Components.interfaces.nsIURI);
			aURLObj.spec = aURL
			return aURLObj.asciiHost;
		} catch (ex) {
			this.addError("[wpdCommon.getHostName]:\n -> aURL: " + aURL, ex);
		}
		return "";
	},

	convertUrlToASCII: function (aURL) {
		try {
			var aURLObj = Components.classes['@mozilla.org/network/standard-url;1'].createInstance(Components.interfaces.nsIURI);
			aURLObj.spec = aURL
			return aURLObj.asciiSpec;
		} catch (ex) {
			this.addError("[wpdCommon.getHostName]:\n -> aURL: " + aURL, ex);
		}
		return "";
	},

	createDir: function (str_Dir) {
		var obj_File = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		obj_File.initWithPath(str_Dir);
		if (!obj_File.exists()) obj_File.create(obj_File.DIRECTORY_TYPE, 0700);
	},

	readDir: function (str_Dir) {
		var obj_File = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		obj_File.initWithPath(str_Dir);
		if (obj_File.exists()) return obj_File.directoryEntries;
		return [];
	},

	fileSize: function (str_Filename) {
		var obj_File = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		obj_File.initWithPath(str_Filename);
		return obj_File.fileSize;
	},

	// read the file (str_Filename) to a String Buffer (str_Buffer)
	readFile: function (str_Filename, removeComments, text) {
		try {
			var obj_File = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			obj_File.initWithPath(str_Filename);
			if (!obj_File.exists()) {
				this.addError("[wpdCommon.readFile]:\n -> str_Filename: " + str_Filename + "\n -> file not found!");
				return "";
			}

			var obj_Transport = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);

			obj_Transport.init(obj_File, 0x01, 004, 0);

			var sis = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
			sis.init(obj_Transport);
			var output = sis.read(sis.available());
			if (text) output = output.replace(/\r/g, "");
			if (text && removeComments) {
				output = output.replace(/^\/\/.*/g, "");
				output = output.replace(/\n\/\/.*/g, "");
				output = output.replace(/\n\n+/g, "\n");
			}
			if (text) output = output.split(/\n/g);
			return output;
		} catch (ex) {
			this.addError("[wpdCommon.readFile]:\n -> str_Filename: " + str_Filename, ex);
		}
		return "";
	},

	// write the String Buffer (str_Buffer) to a file (str_Filename)
	writeFile: function (str_Buffer, str_Filename) {
		if (MODE_SIMULATE) return true;
		try {
			var obj_File = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			obj_File.initWithPath(str_Filename);
			if (!obj_File.exists()) obj_File.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);

			var obj_Transport = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);

			/* Open flags
      #define PR_RDONLY       0x01 - Open for reading only.
			#define PR_WRONLY       0x02 - Open for writing only.
			#define PR_RDWR         0x04 - Open for reading and writing.
			#define PR_CREATE_FILE  0x08 - If the file does not exist, the file is created. If the file exists, this flag has no effect.
			#define PR_APPEND       0x10 - The file pointer is set to the end of the file prior to each write.
			#define PR_TRUNCATE     0x20 - If the file exists, its length is truncated to 0.
			#define PR_SYNC         0x40 - If set, each write will wait for both the file data and file status to be physically updated.
			#define PR_EXCL         0x80 - With PR_CREATE_FILE, if the file does not exist, the file is created. If the file already exists, no action and NULL is returned.

			File modes
	      'mode' is currently only applicable on UNIX platforms.
	      The 'mode' argument may be ignored by PR_Open on other platforms.
		  00400   Read by owner.
		  00200   Write by owner.
		  00100   Execute (search if a directory) by owner.
		  00040   Read by group.
		  00020   Write by group.
		  00010   Execute by group.
		  00004   Read by others.
		  00002   Write by others
		  00001   Execute by others.
	    */
			obj_Transport.init(obj_File, 0x20 | 0x04 | 0x08, 064, 0);
			obj_Transport.write(str_Buffer, str_Buffer.length);
			obj_Transport.flush();
			obj_Transport.close();
			return true;
		} catch (ex) {
			this.addError("[wpdCommon.writeFile]:\n -> str_Filename: " + str_Filename, ex);
		}
		return false;
	},


	copyFile: function (sourcefile, destfile) {

		var destdir = this.getFilePath(destfile);
		destfile = this.getFileLeafName(destfile);
		var aFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		if (!aFile) return false;

		var aDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		if (!aDir) return false;

		aFile.initWithPath(sourcefile);

		aDir.initWithPath(destdir);

		aFile.copyTo(aDir, destfile);
		return true; // Added by Dan S. for Zotero
	},

	// download aSourceURL to aTargetFilename
	// (works also on local files...)
	downloadFile: function (aSourceURL, aTargetFilename) {
		if (MODE_SIMULATE) return true;
		try {
			//new obj_URI object
			var obj_URI = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService).newURI(aSourceURL, null, null);

			//new file object
			var obj_TargetFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			//set file with path
			// NOTE: This function has a known bug on the macintosh and other OSes
			// which do not represent file locations as paths. If you do use this
			// function, be very aware of this problem!
			obj_TargetFile.initWithPath(aTargetFilename);

			//new persistence object
			var obj_Persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Components.interfaces.nsIWebBrowserPersist);

			// set flags
			const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
			var flags = nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES | nsIWBP.PERSIST_FLAGS_FROM_CACHE;
			//nsIWBP.PERSIST_FLAGS_BYPASS_CACHE;
			obj_Persist.persistFlags = flags;

			// has the url the same filetype like the file extension?
			//save file to target
			Zotero.Utilities.Internal.saveURI(wbp, obj_URI, obj_TargetFile);

			return true;

		} catch (ex) {
			aSourceURL = this.removeGETFromURL(aSourceURL);
			this.addError("[wpdCommon.downloadFile]:\n -> aSourceURL: " + aSourceURL.substring(aSourceURL.length - 60) + "\n -> aTargetFilename: " + aTargetFilename, ex);
		}
		return false;
	},

	// get the integer preferences
	getIntPrefs: function (branch) {
		var mPrefSvc = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
		return mPrefSvc.getIntPref(branch);
	},

	// set the integer preferences
	setIntPrefs: function (branch, value) {
		var mPrefSvc = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
		return mPrefSvc.setIntPref(branch, value);
	},

	// get the integer preferences
	getStrPrefs: function (branch) {
		var mPrefSvc = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
		return mPrefSvc.getCharPref(branch);
	},

	// set the string preferences
	setStrPrefs: function (branch, value) {
		var mPrefSvc = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
		return mPrefSvc.setCharPref(branch, value);
	},

	// get the string preferences
	getStrPrefsEx: function (branch) {
		var mPrefSvc = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		return mPrefSvc.getComplexValue(branch, Components.interfaces.nsISupportsString).data;
	},

	// set the string preferences
	setStrPrefsEx: function (branch, value) {
		var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
		str.data = value;
		var mPrefSvc = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
		return mPrefSvc.setComplexValue(branch, Components.interfaces.nsISupportsString, str);
	},


	// Get the preferences branch ("browser.download." for normal 'save' mode)...
	setBoolPrefs: function (branch, value) {
		var mPrefSvc = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
		return mPrefSvc.setBoolPref(branch, value);
	}

};