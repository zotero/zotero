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

/* eslint-disable array-element-newline */

Zotero.FileHandlers = {
	async open(item, params) {
		let { location, openInWindow = false } = params || {};
		
		let path = await item.getFilePathAsync();
		if (!path) {
			Zotero.warn(`File not found: ${item.attachmentPath}`);
			return false;
		}
		
		Zotero.debug('Opening ' + path);
		
		let readerType = item.attachmentReaderType;
		
		// Not a file that we/external readers handle with page number support -
		// just open it with the system handler
		if (!readerType) {
			Zotero.debug('No associated reader type -- launching default application');
			Zotero.launchFile(path);
			return true;
		}
		
		let handler = Zotero.Prefs.get(`fileHandler.${readerType}`);
		if (!handler) {
			Zotero.debug('No external handler for ' + readerType + ' -- opening in Zotero');
			await Zotero.Reader.open(item.id, location, {
				openInWindow,
				allowDuplicate: openInWindow
			});
			return true;
		}

		let systemHandler = this._getSystemHandler(item.attachmentContentType);

		if (handler === 'system') {
			handler = systemHandler;
			Zotero.debug(`System handler is ${handler}`);
		}
		else {
			Zotero.debug(`Custom handler is ${handler}`);
		}
		
		let handlers;
		if (this._mockHandlers) {
			handlers = this._mockHandlers[readerType];
		}
		else if (Zotero.isMac) {
			handlers = this._handlersMac[readerType];
		}
		else if (Zotero.isWin) {
			handlers = this._handlersWin[readerType];
		}
		else if (Zotero.isLinux) {
			handlers = this._handlersLinux[readerType];
		}
		
		let page = location?.pageIndex ?? undefined;
		// Add 1 to page index for external readers
		if (page !== undefined && parseInt(page) == page) {
			page = parseInt(page) + 1;
		}
		
		// If there are handlers for this platform and this reader type...
		if (handlers) {
			// First try to open with the custom handler
			if (handler) {
				try {
					for (let [i, { name, open }] of handlers.entries()) {
						if (name.test(handler)) {
							Zotero.debug('Opening with handler ' + i);
							await open(handler, { filePath: path, location, page });
							return true;
						}
					}
				}
				catch (e) {
					Zotero.logError(e);
				}
			}

			// If we get here, we don't have special handling for the custom
			// handler that the user has set. If we have a location, we really
			// want to open with something we know how to pass a page number to,
			// so we'll see if we know how to do that for the system handler.
			if (location) {
				try {
					if (systemHandler && handler !== systemHandler) {
						Zotero.debug(`Custom handler did not match -- falling back to system handler ${systemHandler}`);
						handler = systemHandler;
						for (let [i, { name, open }] of handlers.entries()) {
							if (name.test(handler)) {
								Zotero.debug('Opening with handler ' + i);
								await open(handler, { filePath: path, location, page });
								return true;
							}
						}
					}
				}
				catch (e) {
					Zotero.logError(e);
				}

				// And lastly, the fallback handler for this platform/reader type,
				// if we have one
				let fallback = handlers.find(h => h.fallback);
				if (fallback) {
					try {
						Zotero.debug('Opening with fallback');
						await fallback.open(null, { filePath: path, location, page });
						return true;
					}
					catch (e) {
						// Don't log error if fallback fails
						// Just move on and try system handler
					}
				}
			}
		}
		
		Zotero.debug("Opening handler without page number");
		
		handler = handler || systemHandler;
		if (handler) {
			if (Zotero.isMac) {
				Zotero.Utilities.Internal.Environment.clearMozillaVariables();
				try {
					await Zotero.Utilities.Internal.exec('/usr/bin/open', ['-a', handler, path]);
					return true;
				}
				catch (e) {
					Zotero.logError(e);
				}
				finally {
					Zotero.Utilities.Internal.Environment.restoreMozillaVariables();
				}
			}
			
			try {
				if (await IOUtils.exists(handler)) {
					Zotero.debug(`Opening with handler ${handler}`);
					Zotero.launchFileWithApplication(path, handler);
					return true;
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
			Zotero.logError(`${handler} not found`);
		}
		
		Zotero.debug('Launching file normally');
		Zotero.launchFile(path);
		return true;
	},

	_handlersMac: {
		pdf: [
			{
				name: /Preview/,
				fallback: true,
				async open(appPath, { filePath, page }) {
					await Zotero.Utilities.Internal.exec('/usr/bin/open', ['-a', "Preview", filePath]);
					if (page !== undefined) {
						// Go to page using AppleScript
						let args = [
							'-e', 'tell app "Preview" to activate',
							'-e', 'tell app "System Events" to keystroke "g" using {option down, command down}',
							'-e', `tell app "System Events" to keystroke "${page}"`,
							'-e', 'tell app "System Events" to keystroke return'
						];
						await Zotero.Utilities.Internal.exec('/usr/bin/osascript', args);
					}
				},
			},
			{
				name: /Adobe Acrobat/,
				async open(appPath, { filePath, page }) {
					await Zotero.Utilities.Internal.exec('/usr/bin/open', ['-a', appPath, filePath]);
					if (page !== undefined) {
						// Go to page using AppleScript
						let args = [
							'-e', `tell app "${appPath}" to activate`,
							'-e', 'tell app "System Events" to keystroke "n" using {command down, shift down}',
							'-e', `tell app "System Events" to keystroke "${page}"`,
							'-e', 'tell app "System Events" to keystroke return'
						];
						await Zotero.Utilities.Internal.exec('/usr/bin/osascript', args);
					}
				}
			},
			{
				name: /Skim/,
				async open(appPath, { filePath, page }) {
					// Escape double-quotes in path
					var quoteRE = /"/g;
					filePath = filePath.replace(quoteRE, '\\"');
					let args = [
						'-e', `tell app "${appPath}" to activate`,
						'-e', `tell app "${appPath}" to open "${filePath}"`
					];
					if (page !== undefined) {
						let filename = PathUtils.filename(filePath)
							.replace(quoteRE, '\\"');
						args.push('-e', `tell document "${filename}" of application "${appPath}" to go to page ${page}`);
					}
					await Zotero.Utilities.Internal.exec('/usr/bin/osascript', args);
				}
			},
			{
				name: /PDF Expert/,
				async open(appPath, { filePath, page }) {
					await Zotero.Utilities.Internal.exec('/usr/bin/open', ['-a', appPath, filePath]);
					// Go to page using AppleScript (same as Preview)
					let args = [
						'-e', `tell app "${appPath}" to activate`
					];
					if (page !== undefined) {
						args.push(
							'-e', 'tell app "System Events" to keystroke "g" using {option down, command down}',
							'-e', `tell app "System Events" to keystroke "${page}"`,
							'-e', 'tell app "System Events" to keystroke return'
						);
					}
					await Zotero.Utilities.Internal.exec('/usr/bin/osascript', args);
				}
			},
		],
		epub: [
			{
				name: /Calibre/i,
				async open(appPath, { filePath, location }) {
					if (!appPath.endsWith('ebook-viewer.app')) {
						appPath += '/Contents/ebook-viewer.app';
					}
					let args = ['-a', appPath, filePath];
					if (location?.position?.value) {
						args.push('--args', '--open-at=' + location.position.value);
					}
					await Zotero.Utilities.Internal.exec('/usr/bin/open', args);
				}
			},
		]
	},

	_handlersWin: {
		pdf: [
			{
				name: new RegExp(''), // Match any handler
				async open(appPath, { filePath, page }) {
					let args = [filePath];
					if (page !== undefined) {
						// Include flags to open the PDF on a given page in various apps
						//
						// Adobe Acrobat: http://partners.adobe.com/public/developer/en/acrobat/PDFOpenParameters.pdf
						// PDF-XChange: http://help.tracker-software.com/eu/default.aspx?pageid=PDFXView25:command_line_options
						args.unshift('/A', 'page=' + page);
					}
					await Zotero.FileHandlers._checkAndExecWithoutBlocking(appPath, args);
				}
			}
		],
		epub: [
			{
				name: /Calibre/i,
				async open(appPath, { filePath, location }) {
					if (appPath.toLowerCase().endsWith('calibre.exe')) {
						appPath = appPath.slice(0, -11) + 'ebook-viewer.exe';
					}
					let args = [filePath];
					if (location?.position?.value) {
						args.push('--open-at=' + location.position.value);
					}
					await Zotero.FileHandlers._checkAndExecWithoutBlocking(appPath, args);
				}
			}
		]
	},

	_handlersLinux: {
		pdf: [
			{
				name: /evince|okular/i,
				fallback: true,
				async open(appPath, { filePath, page }) {
					if (appPath) {
						switch (appPath.toLowerCase()) {
							case 'okular':
								appPath = '/usr/bin/okular';
								break;

							// It's "Document Viewer" on stock Ubuntu
							case 'document viewer':
							case 'evince':
								appPath = '/usr/bin/evince';
								break;
						}
					}
					else if (await IOUtils.exists('/usr/bin/okular')) {
						appPath = '/usr/bin/okular';
					}
					else if (await IOUtils.exists('/usr/bin/evince')) {
						appPath = '/usr/bin/evince';
					}
					else {
						throw new Error('No PDF reader found');
					}

					// TODO: Try to get default from mimeapps.list, etc., in case system default is okular
					// or evince somewhere other than /usr/bin

					let args = [filePath];
					if (page !== undefined) {
						args.unshift('-p', page);
					}
					await Zotero.FileHandlers._checkAndExecWithoutBlocking(appPath, args);
				}
			}
		],
		epub: [
			{
				name: /calibre/i,
				async open(appPath, { filePath, location }) {
					if (appPath.toLowerCase().endsWith('calibre')) {
						appPath = appPath.slice(0, -7) + 'ebook-viewer';
					}
					let args = [filePath];
					if (location?.position?.value) {
						args.push('--open-at=' + location.position.value);
					}
					await Zotero.FileHandlers._checkAndExecWithoutBlocking(appPath, args);
				}
			}
		]
	},

	_getSystemHandler(mimeType) {
		if (Zotero.isWin) {
			return this._getSystemHandlerWin(mimeType);
		}
		else {
			return this._getSystemHandlerPOSIX(mimeType);
		}
	},
	
	_getSystemHandlerWin(mimeType) {
		// Based on getPDFReader() in ZotFile (GPL)
		// https://github.com/jlegewie/zotfile/blob/a6c9e02e17b60cbc1f9bb4062486548d9ef583e3/chrome/content/zotfile/utils.js

		var wrk = Components.classes["@mozilla.org/windows-registry-key;1"]
			.createInstance(Components.interfaces.nsIWindowsRegKey);
		// Get handler
		var extension = Zotero.MIME.getPrimaryExtension(mimeType);
		var tryKeys = [
			{
				root: wrk.ROOT_KEY_CURRENT_USER,
				path: `Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.${extension}\\UserChoice`,
				value: 'Progid'
			},
			{
				root: wrk.ROOT_KEY_CLASSES_ROOT,
				path: `.${extension}`,
				value: ''
			}
		];
		var progId;
		for (let key of tryKeys) {
			try {
				wrk.open(key.root, key.path, wrk.ACCESS_READ);
				progId = wrk.readStringValue(key.value);
				if (progId) {
					break;
				}
			}
			catch (e) {}
		}

		if (!progId) {
			wrk.close();
			return false;
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
		for (let key of tryKeys) {
			try {
				wrk.open(
					wrk.ROOT_KEY_CLASSES_ROOT,
					key,
					wrk.ACCESS_READ
				);
				success = true;
				break;
			}
			catch (e) {}
		}

		if (!success) {
			wrk.close();
			return false;
		}

		try {
			var command = wrk.readStringValue('').match(/^(?:".+?"|[^"]\S+)/);
		}
		catch (e) {}

		wrk.close();

		if (!command) return false;
		return command[0].replace(/"/g, '');
	},
	
	_getSystemHandlerPOSIX(mimeType) {
		var handlerService = Cc["@mozilla.org/uriloader/handler-service;1"]
			.getService(Ci.nsIHandlerService);
		var handlers = handlerService.enumerate();
		var handler;
		while (handlers.hasMoreElements()) {
			let handlerInfo = handlers.getNext().QueryInterface(Ci.nsIHandlerInfo);
			if (handlerInfo.type == mimeType) {
				handler = handlerInfo;
				break;
			}
		}
		if (!handler) {
			// We can't get the name of the system default handler unless we add an entry
			Zotero.debug("Default handler not found -- adding default entry");
			let mimeService = Components.classes["@mozilla.org/mime;1"]
				.getService(Components.interfaces.nsIMIMEService);
			let mimeInfo = mimeService.getFromTypeAndExtension(mimeType, "");
			mimeInfo.preferredAction = 4;
			mimeInfo.alwaysAskBeforeHandling = false;
			handlerService.store(mimeInfo);

			// And once we do that, we can get the name (but not the path, unfortunately)
			let handlers = handlerService.enumerate();
			while (handlers.hasMoreElements()) {
				let handlerInfo = handlers.getNext().QueryInterface(Ci.nsIHandlerInfo);
				if (handlerInfo.type == mimeType) {
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

	/**
	 * Check that a command exists and is executable, and run without waiting
	 * for it to finish
	 */
	async _checkAndExecWithoutBlocking(command, args) {
		// Run the same checks that exec() runs so that we reject if the
		// executable doesn't exist or isn't actually executable
		if (!await OS.File.exists(command)) {
			throw new Error(`${command} not found`);
		}
		if (!Zotero.File.pathToFile(command).isExecutable()) {
			throw new Error(`${command} is not an executable`);
		}
		
		Zotero.Utilities.Internal.Environment.clearMozillaVariables();
		
		// Do not await
		var promise = Zotero.Utilities.Internal.exec(command, args);
		
		promise.finally(() => Zotero.Utilities.Internal.Environment.restoreMozillaVariables());
	},
};

Zotero.OpenPDF = {
	openToPage: async function (pathOrItem, page, annotationKey) {
		Zotero.warn('Zotero.OpenPDF.openToPage() is deprecated -- use Zotero.FileHandlers.open()');
		if (typeof pathOrItem === 'string') {
			throw new Error('Zotero.OpenPDF.openToPage() requires an item -- update your code!');
		}
		
		await Zotero.FileHandlers.open(pathOrItem, {
			location: {
				annotationID: annotationKey,
				pageIndex: page,
			}
		});
	}
};
