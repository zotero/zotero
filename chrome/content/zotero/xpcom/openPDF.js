/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2018 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     https://zotero.org
    
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

Zotero.OpenPDF = {
	openToPage: async function (path, page) {
		var handler = Zotero.Prefs.get("fileHandler.pdf");
		var opened = false;
		if (Zotero.isMac) {
			if (handler.includes('Preview')) {
				this._openWithPreview(path, page);
			}
			else if (handler.includes('Skim')) {
				this._openWithSkim(path, page);
			}
			else if (handler.includes('PDF Expert')) {
				this._openWithPDFExpert(path, page);
			}
			else {
				// Try to detect default app
				handler = this._getPDFHandlerName();
				Zotero.debug(`Handler is ${handler}`);
				if (handler && handler == 'Skim') {
					this._openWithSkim(path, page);
				}
				else if (handler && handler == 'PDF Expert') {
					this._openWithPDFExpert(path, page);
				}
				// Fall back to Preview
				else {
					this._openWithPreview(path, page);
				}
			}
			opened = true;
		}
		else if (Zotero.isWin) {
			handler = handler || this._getPDFHandlerWindows();
			// Include flags to open the PDF on a given page in various apps
			//
			// Adobe Acrobat: http://partners.adobe.com/public/developer/en/acrobat/PDFOpenParameters.pdf
			// PDF-XChange: http://help.tracker-software.com/eu/default.aspx?pageid=PDFXView25:command_line_options
			let args = ['/A', 'page=' + page, path];
			Zotero.Utilities.Internal.exec(handler, args);
			opened = true;
		}
		else if (Zotero.isLinux) {
			if (handler.includes('evince') || handler.includes('okular')) {
				this._openWithEvinceOrOkular(handler, path, page);
				opened = true;
			}
			else {
				let handler = await this._getPDFHandlerLinux();
				if (handler.includes('evince') || handler.includes('okular')) {
					this._openWithEvinceOrOkular(handler, path, page);
					opened = true;
				}
				// Fall back to okular and then evince if unknown handler
				else if (await OS.File.exists('/usr/bin/okular')) {
					this._openWithEvinceOrOkular('/usr/bin/okular', path, page);
					opened = true;
				}
				else if (await OS.File.exists('/usr/bin/evince')) {
					this._openWithEvinceOrOkular('/usr/bin/evince', path, page);
					opened = true;
				}
				else {
					Zotero.debug("No handler found");
				}
			}
		}
		return opened;
	},
	
	_getPDFHandlerName: function () {
		var handlerService = Cc["@mozilla.org/uriloader/handler-service;1"]
			.getService(Ci.nsIHandlerService);
		var handlers = handlerService.enumerate();
		var handler;
		while (handlers.hasMoreElements()) {
			let handlerInfo = handlers.getNext().QueryInterface(Ci.nsIHandlerInfo);
			if (handlerInfo.type == 'application/pdf') {
				handler = handlerInfo;
				break;
			}
		}
		if (!handler) {
			// We can't get the name of the system default handler unless we add an entry
			Zotero.debug("Default handler not found -- adding default entry");
			let mimeService = Components.classes["@mozilla.org/mime;1"]
				.getService(Components.interfaces.nsIMIMEService);
			let mimeInfo = mimeService.getFromTypeAndExtension("application/pdf", "");
			mimeInfo.preferredAction = 4;
			mimeInfo.alwaysAskBeforeHandling = false;
			handlerService.store(mimeInfo);
			
			// And once we do that, we can get the name (but not the path, unfortunately)
			let handlers = handlerService.enumerate();
			while (handlers.hasMoreElements()) {
				let handlerInfo = handlers.getNext().QueryInterface(Ci.nsIHandlerInfo);
				if (handlerInfo.type == 'application/pdf') {
					handler = handlerInfo;
					break;
				}
			}
		}
		if (handler) {
			Zotero.debug(`Default handler is ${handler.defaultDescription}`);
			return handler.defaultDescription;
		}
		return false;
	},
	
	//
	// Mac
	//
	_openWithPreview: async function (filePath, page) {
		await Zotero.Utilities.Internal.exec('/usr/bin/open', ['-a', 'Preview', filePath]);
		// Go to page using AppleScript
		let args = [
			'-e', 'tell app "Preview" to activate',
			'-e', 'tell app "System Events" to keystroke "g" using {option down, command down}',
			'-e', `tell app "System Events" to keystroke "${page}"`,
			'-e', 'tell app "System Events" to keystroke return'
		];
		await Zotero.Utilities.Internal.exec('/usr/bin/osascript', args);
	},
	
	_openWithSkim: async function (filePath, page) {
		// Escape double-quotes in path
		var quoteRE = /"/g;
		filePath = filePath.replace(quoteRE, '\\"');
		let filename = OS.Path.basename(filePath).replace(quoteRE, '\\"');
		let args = [
			'-e', 'tell app "Skim" to activate',
			'-e', `tell app "Skim" to open "${filePath}"`
		];
		args.push('-e', `tell document "${filename}" of application "Skim" to go to page ${page}`);
		await Zotero.Utilities.Internal.exec('/usr/bin/osascript', args);
	},
	
	_openWithPDFExpert: async function (filePath, page) {
		await Zotero.Utilities.Internal.exec('/usr/bin/open', ['-a', 'PDF Expert', filePath]);
		// Go to page using AppleScript (same as Preview)
		let args = [
			'-e', 'tell app "PDF Expert" to activate',
			'-e', 'tell app "System Events" to keystroke "g" using {option down, command down}',
			'-e', `tell app "System Events" to keystroke "${page}"`,
			'-e', 'tell app "System Events" to keystroke return'
		];
		await Zotero.Utilities.Internal.exec('/usr/bin/osascript', args);
	},
	
	//
	// Windows
	//
	/**
	 * Get path to default pdf reader application on windows
	 * @return {string} Path to default pdf reader application
	 *
	 * From getPDFReader() in ZotFile (GPL)
	 * https://github.com/jlegewie/zotfile/blob/master/chrome/content/zotfile/utils.js
	 */
	_getPDFHandlerWindows: function () {
		var wrk = Components.classes["@mozilla.org/windows-registry-key;1"]
			.createInstance(Components.interfaces.nsIWindowsRegKey);
		// Get handler for PDFs
		var tryKeys = [
			{
				root: wrk.ROOT_KEY_CURRENT_USER,
				path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.pdf\\UserChoice',
				value: 'Progid'
			},
			{
				root: wrk.ROOT_KEY_CLASSES_ROOT,
				path: '.pdf',
				value: ''
			}
		];
		var progId;
		for (let i = 0; !progId && i < tryKeys.length; i++) {
			try {
				wrk.open(
					tryKeys[i].root,
					tryKeys[i].path,
					wrk.ACCESS_READ
				);
				progId = wrk.readStringValue(tryKeys[i].value);
			}
			catch (e) {}
		}
		
		if (!progId) {
			wrk.close();
			return;
		}
		
		// Get version specific handler, if it exists
		try {
			wrk.open(
				wrk.ROOT_KEY_CLASSES_ROOT,
				progId + '\\CurVer',
				wrk.ACCESS_READ
			);
			progId = wrk.readStringValue('') || progId;
		}
		catch (e) {}
		
		// Get command
		var success = false;
		tryKeys = [
			progId + '\\shell\\Read\\command',
			progId + '\\shell\\Open\\command'
		];
		for (let i = 0; !success && i < tryKeys.length; i++) {
			try {
				wrk.open(
					wrk.ROOT_KEY_CLASSES_ROOT,
					tryKeys[i],
					wrk.ACCESS_READ
				);
				success = true;
			}
			catch (e) {}
		}
		
		if (!success) {
			wrk.close();
			return;
		}
		
		var command = wrk.readStringValue('').match(/^(?:".+?"|[^"]\S+)/);
		
		wrk.close();
		
		if (!command) return;
		return command[0].replace(/"/g, '');
	},
	
	//
	// Linux
	//
	_getPDFHandlerLinux: async function () {
		var name = this._getPDFHandlerName();
		switch (name.toLowerCase()) {
		case 'okular':
			return `/usr/bin/${name}`;
		
		// It's "Document Viewer" on stock Ubuntu
		case 'document viewer':
		case 'evince':
			return `/usr/bin/evince`;
		}
		
		// TODO: Try to get default from mimeapps.list, etc., in case system default is okular
		// or evince somewhere other than /usr/bin
		var homeDir = OS.Constants.Path.homeDir;
		
		return false;
		
	},
	
	_openWithEvinceOrOkular: function (appPath, filePath, page) {
		var args = ['-p', page, filePath];
		Zotero.Utilities.Internal.exec(appPath, args);
	}
}
