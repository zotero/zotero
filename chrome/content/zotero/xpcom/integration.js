"use strict";
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
    
    ***** END LICENSE BLOCK *****
*/

const DATA_VERSION = 3;

// Specifies that citations should only be updated if changed
const FORCE_CITATIONS_FALSE = 0;
// Specifies that citations should only be updated if formattedText has changed from what is encoded
// in the field code
const FORCE_CITATIONS_REGENERATE = 1;
// Specifies that citations should be reset regardless of whether formattedText has changed
const FORCE_CITATIONS_RESET_TEXT = 2;

// These must match the constants in corresponding word plugins 
const DIALOG_ICON_STOP = 0;
const DIALOG_ICON_WARNING = 1;
const DIALOG_ICON_CAUTION = 2;

const DIALOG_BUTTONS_OK = 0;
const DIALOG_BUTTONS_OK_CANCEL = 1;
const DIALOG_BUTTONS_YES_NO = 2;
const DIALOG_BUTTONS_YES_NO_CANCEL = 3;

const NOTE_FOOTNOTE = 1;
const NOTE_ENDNOTE = 2;

const INTEGRATION_TYPE_ITEM = 1;
const INTEGRATION_TYPE_BIBLIOGRAPHY = 2;
const INTEGRATION_TYPE_TEMP = 3;

const DELAY_CITATIONS_PROMPT_TIMEOUT = 15/*seconds*/;

const DELAYED_CITATION_RTF_STYLING = "\\uldash";
const DELAYED_CITATION_RTF_STYLING_CLEAR = "\\ulclear";

const DELAYED_CITATION_HTML_STYLING = "<div class='delayed-zotero-citation-updates'>"
const DELAYED_CITATION_HTML_STYLING_END = "</div>"

const EXPORTED_DOCUMENT_MARKER = "ZOTERO_TRANSFER_DOCUMENT";

const NOTE_CITATION_PLACEHOLDER_LINK = 'https://www.zotero.org/?';

const TEMPLATE_VERSIONS = {
	MacWord16: 2,
	WinWord: 1,
	OpenOffice: 1
};

const MENDELEY_URI_RE = /^http:\/\/www\.mendeley\.com\/documents\/\?uuid=(.*)/;

const PLUGIN_PATHS = {
	LibreOffice: 'chrome://zotero-libreoffice-integration-components/content/zoteroLibreOfficeIntegration.mjs',
	WinWord: 'chrome://zotero-winword-integration/content/zoteroWinWordIntegration.mjs',
	MacWord: 'chrome://zotero-macword-integration/content/zoteroMacWordIntegration.mjs'
};


Zotero.Integration = new function() {
	Components.utils.import("resource://gre/modules/Services.jsm");
	Components.utils.import("resource://gre/modules/AddonManager.jsm");
	
	this.currentWindow = false;
	this.sessions = {};
	var upgradeTemplateNotNowTime = 0;

	/**
	 * Initialize LibreOffice, Word for Mac and Word for Windows plugin components.
	 */
	this.init = function () {
		if (Zotero.test) return;
		let entryPoints = [PLUGIN_PATHS.LibreOffice];
		if (Zotero.isMac) {
			entryPoints.push(PLUGIN_PATHS.MacWord);
		}
		else if (Zotero.isWindows) {
			entryPoints.push(PLUGIN_PATHS.WinWord);
		}
		for (let entryPoint of entryPoints) {
			try {
				const { init } = ChromeUtils.importESModule(entryPoint);
				init();
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
	}
	
	/**
	 * Begin listening for integration commands on the given pipe
	 * @param {String} pipe The path to the pipe
	 * @param {Function} callback The callback to call on pipe read
	 */
	this.initPipe = function (pipe, callback) {
		Zotero.IPC.Pipe.initPipeListener(pipe, function(string) {
			if(string != "") {
				if (typeof callback == 'function') callback(string);
				// exec command if possible
				var parts = string.match(/^([^ \n]*) ([^ \n]*) (\/[^\n\\]*\/)(?: ([^ \n]*))?\n?$/);
				if(parts) {
					var agent = parts[1].toString();
					var cmd = parts[2].toString();
					var document = parts[3].toString();
					var templateVersion = parts[4] ? parseInt(parts[4].toString()) : 0;
					Zotero.Integration.execCommand(agent, cmd, document, templateVersion);
				} else {
					Components.utils.reportError("Zotero: Invalid integration input received: "+string);
				}
			}
		});
	}
	
	/**
	 * Deletes a defunct pipe on OS X
	 */
	this.deletePipe = function(pipe) {
		try {
			if(pipe.exists()) {
				pipe.remove(false);
			}
			return true;
		} catch (e) {
			// if pipe can't be deleted, log an error
			Zotero.debug("Error removing old integration pipe "+pipe.path, 1);
			Zotero.logError(e);
			Components.utils.reportError(
				"Zotero word processor integration initialization failed. "
					+ "See http://forums.zotero.org/discussion/12054/#Item_10 "
					+ "for instructions on correcting this problem."
			);
			
			// can attempt to delete on OS X
			try {
				let promptService = Services.prompt;
				var deletePipe = promptService.confirm(null, Zotero.getString("integration.error.title"), Zotero.getString("integration.error.deletePipe"));
				if(!deletePipe) return false;
				let escapedFifoFile = pipe.path.replace("'", "'\\''");
				Zotero.Utilities.Internal.executeAppleScript("do shell script \"rmdir '"+escapedFifoFile+"'; rm -f '"+escapedFifoFile+"'\" with administrator privileges", true);
				if(pipe.exists()) return false;
			} catch(e) {
				Zotero.logError(e);
				return false;
			}
		}
	}

	/**
	 * @param {String} agent Agent string provided by the integration plugin
	 * @param {Integer} templateVersion Plugin reported template version
	 * @returns {Boolean} true if integration operation should be cancelled
	 */
	this.warnOutdatedTemplate = function (agent, templateVersion) {
		const expectedTemplateVersion = TEMPLATE_VERSIONS[agent];
		if (typeof expectedTemplateVersion == 'undefined' || templateVersion >= expectedTemplateVersion) return false;
		const daysToIgnore = 30;
		const now = Math.floor(Date.now() / 1000);
		const updateTemplateDelayedOn = Zotero.Prefs.get('integration.updateTemplateDelayedOn');
		if (updateTemplateDelayedOn + (daysToIgnore * 86400) > now || upgradeTemplateNotNowTime + 86400 > now) {
			return false;
		}
		Zotero.debug(`Integration: ${agent} command invoked with outdated template.`);
		
		var ps = Services.prompt;
		var title = Zotero.getString('general.warning');
		var client = agent == "OpenOffice" ? "LibreOffice" : "Microsoft Word";
		var message = Zotero.getString('integration.upgradeTemplate', [Zotero.appName, client]);
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING);
		var checkbox = {};
		var index = ps.confirmEx(
			null,
			title,
			message,
			buttonFlags,
			Zotero.getString('general.openPreferences'),
			Zotero.getString('general.notNow'),
			null,
			Zotero.getString(
				'general.dontShowAgainFor',
				daysToIgnore,
				daysToIgnore
			),
			checkbox
		);

		if (index == 0) {
			Zotero.Utilities.Internal.openPreferences('zotero-prefpane-cite', {
				scrollTo: '#wordProcessors'
			});
			return true;
		}

		upgradeTemplateNotNowTime = now;
		if (checkbox.value) {
			Zotero.Prefs.set('integration.upgradeTemplateDelayedOn', now);
		}
		return false;
	};
	
	this.resetSessionStyles = Zotero.Promise.coroutine(function* (){
		for (let sessionID in Zotero.Integration.sessions) {
			let session = Zotero.Integration.sessions[sessionID];
			yield session.setData(session.data, true);
		}
	});
	
	this.getApplication = function (agent, command, docId) {
		if (agent == 'http') {
			return new Zotero.HTTPIntegrationClient.Application();
		}
		// Try to load the appropriate Zotero component; otherwise display an error
		try {
			// Replace MacWord2016 and MacWord16 with just MacWord.
			agent = agent.startsWith('MacWord') ? 'MacWord' : agent;
			var entryPoint = PLUGIN_PATHS[agent];
			Zotero.debug("Integration: Instantiating "+agent+" plugin handler for command "+command+(docId ? " with doc "+docId : ""));
			const { Application } = ChromeUtils.importESModule(entryPoint);
			return new Application();
		}
		catch (e) {
			throw new Zotero.Exception.Alert("integration.error.notInstalled",
				[], "integration.error.title");
		}
	};
	
	/**
	 * Executes an integration command, first checking to make sure that versions are compatible
	 */
	this.execCommand = async function(agent, command, docId, templateVersion=0) {
		var document, session, documentImported;
		Zotero.debug(`Integration: ${agent}-${command}${docId ? `:'${docId}'` : ''} invoked`)
		if (Zotero.Integration.warnOutdatedTemplate(agent, templateVersion)) return;

		if (Zotero.Integration.currentDoc) {
			Zotero.Utilities.Internal.activate();
			if(Zotero.Integration.currentWindow && !Zotero.Integration.currentWindow.closed) {
				Zotero.Integration.currentWindow.focus();
			}
			Zotero.debug("Integration: Request already in progress; not executing "+agent+" "+command);
			return;
		}
		Zotero.Integration.currentDoc = true;

		var startTime = (new Date()).getTime();

		// Try to execute the command; otherwise display an error in alert service or word processor
		// (depending on what is possible)
		try {
			// Word for windows throws RPC_E_CANTCALLOUT_ININPUTSYNCCALL if we invoke an OLE call in the
			// current event loop (which.. who would have guessed would be the case?)
			await Zotero.Promise.delay();
			var application = Zotero.Integration.getApplication(agent, command, docId);
			
			var documentPromise = (application.getDocument && docId ? application.getDocument(docId) : application.getActiveDocument());
			if (!documentPromise.then) {
				Zotero.debug('Synchronous integration plugin functions are deprecated -- ' +
					'update to asynchronous methods');
				application = Zotero.Integration.LegacyPluginWrapper(application);
				documentPromise = new Zotero.Promise(resolve =>
					resolve(Zotero.Integration.LegacyPluginWrapper.wrapDocument(documentPromise)));
			}
			Zotero.Integration.currentDoc = document = await documentPromise;
			
			[session, documentImported] = await Zotero.Integration.getSession(application, document, agent, command == 'addNote');
			Zotero.Integration.currentSession = session;
			// TODO: figure this out
			// Zotero.Notifier.trigger('delete', 'collection', 'document');
			if (!documentImported) {
				await (new Zotero.Integration.Interface(application, document, session))[command]();
			}
			await document.setDocumentData(session.data.serialize());
		}
		catch (e) {
			if (!(e instanceof Zotero.Exception.UserCancelled)) {
				await Zotero.Integration._handleCommandError(document, session, e);
			}
			else {
				if (session) {
					// If user cancels we should still write the currently assigned session ID
					try {
						await document.setDocumentData(session.data.serialize());
						// And any citations marked for processing (like retraction warning ignore flag changes)
						if (Object.keys(session.processIndices).length) {
							session.updateDocument(FORCE_CITATIONS_FALSE, false, false);
						}
					// Since user cancelled we can ignore if processor fails here.
					} catch(e) {}
				}
			}
		}
		finally {
			var diff = ((new Date()).getTime() - startTime)/1000;
			Zotero.debug(`Integration: ${agent}-${command}${docId ? `:'${docId}'` : ''} complete in ${diff}s`)
		
			if (Zotero.Integration.currentWindow && !Zotero.Integration.currentWindow.closed) {
				var oldWindow = Zotero.Integration.currentWindow;
				oldWindow.close();
				await Zotero.Promise.delay(50);
			}

			if (Zotero.Integration.currentSession && Zotero.Integration.currentSession.progressBar) {
				Zotero.Integration.currentSession.progressBar.hide();
				await Zotero.Promise.delay(50);
			}
			
			if (document) {
				try {
					await document.cleanup();
					if (!Zotero.Integration.currentSession._dontActivateDocument) {
						await document.activate();
					}
					
					// Call complete function if one exists
					if (document.complete) {
						await document.complete();
					}
				} catch(e) {
					Zotero.logError(e);
				}
			}
			
			// This technically shouldn't be necessary since we call document.activate(),
			// but http integration plugins may not have OS level access to windows to be
			// able to activate themselves. E.g. Google Docs on Safari.
			if (Zotero.isMac && agent == 'http') {
				Zotero.Utilities.Internal.sendToBack();
			}
			
			Zotero.Integration.currentDoc = Zotero.Integration.currentWindow = false;
		}
	};
	
	this._handleCommandError = async function (document, session, e) {
		try {
			const supportURL = "https://www.zotero.org/support/kb/debugging_broken_documents";
			var displayError;
			if (e instanceof Zotero.Exception.Alert) {
				displayError = e.message;
			}
			else {
				if (e.toString().indexOf("ExceptionAlreadyDisplayed") === -1) {
					displayError = Zotero.getString("integration.error.generic")
						+ "\n\n" + Zotero.getString("integration.error.viewTroubleshootingInfo");
				}
				else {
					return;
				}
				if (e.stack) {
					Zotero.debug(e.stack);
				}
			}
			
			if (Zotero.Integration.currentSession && Zotero.Integration.currentSession.progressBar) {
				Zotero.Promise.delay(5).then(() =>
					Zotero.Integration.currentSession.progressBar.hide());
			}
			
			
			// display alerts in the document processor
			if (document) {
				try {
					await document.activate();
					if (e instanceof Zotero.Exception.Alert) {
						await document.displayAlert(displayError, DIALOG_ICON_STOP, DIALOG_BUTTONS_OK);
					} else {
						let index = await document.displayAlert(displayError, DIALOG_ICON_STOP, DIALOG_BUTTONS_YES_NO);
						if (index == 1) {
							Zotero.launchURL(supportURL);
						}
					}
					return;
				}
				catch (e) {
					Zotero.debug("Integration: An error occurred while trying to display an alert. Falling back to Zotero");
					Zotero.logError(e);
				}
			}
			
			Zotero.Utilities.Internal.activate();
			let ps = Services.prompt;
			if (e instanceof Zotero.Exception.Alert) {
				ps.alert(null, Zotero.getString('integration.error.title'), displayError);
			}
			else {
				let index = ps.confirm(null, Zotero.getString('integration.error.title'), displayError);
				if (index == 1) {
					Zotero.launchURL(supportURL);
				}
			}
			
			// CiteprocRsDriverError available only if citeproc-rs is enabled
			try {
				// If the driver panicked we cannot reuse it
				if (e instanceof Zotero.CiteprocRs.CiteprocRsDriverError) {
					session.style.free(true);
					delete Zotero.Integration.sessions[session.id];
				}
			} catch (e) {}
		}
		finally {
			Zotero.logError(e);
		}
	};
	
	/**
	 * Displays a dialog in a modal-like fashion without hanging the thread 
	 * @param {String} url The chrome:// URI of the window
	 * @param {String} [options] Options to pass to the window
	 * @param {String} [io] Data to pass to the window
	 * @return {Promise} Promise resolved when the window is closed
	 */
	this.displayDialog = async function displayDialog(url, options, io) {
		Zotero.debug(`Integration: Displaying dialog ${url}`);
		await Zotero.Integration.currentDoc.cleanup();
		Zotero.Integration.currentSession && await Zotero.Integration.currentSession.progressBar.hide(true);
		
		var allOptions = 'chrome,centerscreen';
		// without this, Firefox gets raised with our windows under Compiz
		if(Zotero.isLinux) allOptions += ',dialog=no';
		if(options) allOptions += ','+options;
		
		var window = Zotero.openWindow(null, url, '', allOptions, (io ? io : null));
		Zotero.Integration.currentWindow = window;
		Zotero.Utilities.Internal.activate(window);
		
		var deferred = Zotero.Promise.defer();
		var listener = function() {
			if(window.location.toString() === "about:blank") return;
			
			if(window.newWindow) {
				window = window.newWindow;
				Zotero.Integration.currentWindow = window;
				window.addEventListener("unload", listener, false);
				return;
			}
			
			Zotero.Integration.currentWindow = false;
			deferred.resolve();
		}
		window.addEventListener("unload", listener, false);

		await deferred.promise;
		// We do not want to redisplay the progress bar if this window close
		// was the final close of the integration command
		await Zotero.Promise.delay(10);
		if (Zotero.Integration.currentDoc && Zotero.Integration.currentSession
				&& Zotero.Integration.currentSession.progressBar) {
			Zotero.Integration.currentSession.progressBar.show();
		}
	};
	
	/**
	 * Gets a session for a given doc.
	 * Either loads a cached session if doc communicated since restart or creates a new one
	 * @return {Zotero.Integration.Session} Promise
	 */
	this.getSession = async function (app, doc, agent, isNote) {
		let documentImported = false;
		try {
			var progressBar = new Zotero.Integration.Progress(4, isNote, Zotero.isMac && agent != 'http');
			progressBar.show();
			
			var dataString = await doc.getDocumentData(),
				data, session;
			
			try {
				data = new Zotero.Integration.DocumentData(dataString);
			} catch(e) {
				data = new Zotero.Integration.DocumentData();
			}
			
			if (dataString != EXPORTED_DOCUMENT_MARKER && data.prefs.fieldType) {
				if (data.dataVersion < DATA_VERSION) {
					if (data.dataVersion == 1
							&& data.prefs.fieldType == "Field"
							&& app.primaryFieldType == "ReferenceMark") {
						// Converted OOo docs use ReferenceMarks, not fields
						data.prefs.fieldType = "ReferenceMark";
					}
					
					var warning = await doc.displayAlert(Zotero.getString("integration.upgradeWarning", [Zotero.clientName, '5.0']),
						DIALOG_ICON_WARNING, DIALOG_BUTTONS_OK_CANCEL);
					if (!warning) {
						throw new Zotero.Exception.UserCancelled("document upgrade");
					}
				// Don't throw for version 4(JSON) during the transition from 4.0 to 5.0
				} else if ((data.dataVersion > DATA_VERSION) && data.dataVersion != 4) {
					throw new Zotero.Exception.Alert("integration.error.newerDocumentVersion",
							[data.zoteroVersion, Zotero.version], "integration.error.title");
				}
				
				if (data.prefs.fieldType !== app.primaryFieldType
						&& data.prefs.fieldType !== app.secondaryFieldType) {
					throw new Zotero.Exception.Alert("integration.error.fieldTypeMismatch",
							[], "integration.error.title");
				}

				session = Zotero.Integration.sessions[data.sessionID];
			}
			// Make sure we don't maintain the session if agent changes (i.e. LO -> Word)
			// and display wrong field types in doc preferences.
			if (!session || session.agent != agent) {
				session = new Zotero.Integration.Session(doc, app);
				session.reload = true;
			}
			session.agent = agent;
			session._doc = doc;
			session.progressBar = progressBar;
			session._fields = null;
			session.ignoreEmptyBibliography = true;
			session.progressCallback = null;
			session._removeCodeFields = {};
			session._deleteFields = {};
			session._bibliographyFields = [];
			session._shouldMerge = false;

			if (dataString == EXPORTED_DOCUMENT_MARKER) {
				Zotero.Integration.currentSession = session;
				data = await session.importDocument();
				documentImported = true;
				// We're slightly abusing the system here, but importing a document should cancel
				// any other operation the user was trying to perform since the document will change
				// significantly
			} else {
				try {
					await session.setData(data);
				} catch(e) {
					// make sure style is defined
					if (e instanceof Zotero.Exception.Alert && e.name === "integration.error.invalidStyle") {
						if (data.style.styleID) {
							let trustedSource =
								/^https?:\/\/(www\.)?(zotero\.org|citationstyles\.org)/.test(data.style.styleID);
							let errorString = Zotero.getString("integration.error.styleMissing", data.style.styleID);
							if (trustedSource ||
								await doc.displayAlert(errorString, DIALOG_ICON_WARNING, DIALOG_BUTTONS_YES_NO)) {

								let installed = false;
								try {
									let { styleTitle, styleID } = await Zotero.Styles.install(
										{url: data.style.styleID}, data.style.styleID, true
									);
									data.style.styleID = styleID;
									installed = true;
								}
								catch (e) {
									await doc.displayAlert(
										Zotero.getString(
											'integration.error.styleNotFound', data.style.styleID
										),
										DIALOG_ICON_WARNING,
										DIALOG_BUTTONS_OK
									);
								}
								if (installed) {
									await session.setData(data, true);
								} else {
									await session.setDocPrefs();
								}
							} else {
								await session.setDocPrefs();
							}
						} else {
							await session.setDocPrefs();
						}
					} else {
						throw e;
					}
				}
			}
		} catch (e) {
			progressBar.hide(true);
			throw e;
		}
		if (session.progressBar) {
			progressBar.reset();
			progressBar.segments = session.progressBar.segments;
		}
		return [session, documentImported];
	};
	
}

Zotero.Integration.confirmExportDocument = function() {
	const documentationURL = "https://www.zotero.org/support/kb/moving_documents_between_word_processors";
	
	var ps = Services.prompt;
	var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
		+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
		+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_IS_STRING);
	var result = ps.confirmEx(null,
		Zotero.getString('integration.exportDocument.title'),
		Zotero.getString('integration.exportDocument.description1')
			+ "\n\n"
			+ Zotero.getString('integration.exportDocument.description2'),
		buttonFlags,
		Zotero.getString('general.continue'),
		null,
		Zotero.getString('general.moreInformation'), null, {});
	if (result == 0) {
		return true;
	}
	else if (result == 2) {
		Zotero.launchURL(documentationURL);
	}
	return false;
}

/**
 * An exception thrown when a document contains an item that no longer exists in the current document.
 */
Zotero.Integration.MissingItemException = function(item) {this.item = item;};
Zotero.Integration.MissingItemException.prototype = {
	"name":"MissingItemException",
	"message":`An item in this document is missing from your Zotero library.}`,
	"toString":function() { return this.message + `\n ${JSON.stringify(this.item)}` }
};

Zotero.Integration.NO_ACTION = 0;
Zotero.Integration.UPDATE = 1;
Zotero.Integration.DELETE = 2;
Zotero.Integration.REMOVE_CODE = 3;

/**
 * All methods for interacting with a document
 * @constructor
 */
Zotero.Integration.Interface = function(app, doc, session) {
	this._app = app;
	this._doc = doc;
	this._session = session;
}

/**
 * Adds a citation to the current document.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.addCitation = async function () {
	await this._session.init(false, false);
	
	let citations = await this._session.cite(null);
	if (this._session.data.prefs.delayCitationUpdates) {
		for (let citation of citations) {
			await this._session.writeDelayedCitation(citation._field, citation);
		}
	}
	else {
		return this._session.updateDocument(FORCE_CITATIONS_FALSE, false, false);
	}
};

/**
 * Edits the citation at the cursor position.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.editCitation = Zotero.Promise.coroutine(function* () {
	yield this._session.init(true, false);
	var docField = yield this._doc.cursorInField(this._session.data.prefs['fieldType']);
	if(!docField) {
		throw new Zotero.Exception.Alert("integration.error.notInCitation", [],
			"integration.error.title");
	}
	return this.addEditCitation(docField);
});

/**
 * Edits the citation at the cursor position if one exists, or else adds a new one.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.addEditCitation = async function (docField) {
	await this._session.init(false, false);
	docField = docField || await this._doc.cursorInField(this._session.data.prefs['fieldType']);

	let citations = await this._session.cite(docField);
	if (this._session.data.prefs.delayCitationUpdates) {
		for (let citation of citations) {
			await this._session.writeDelayedCitation(citation._field, citation);
		}
	} else {
		return this._session.updateDocument(FORCE_CITATIONS_FALSE, false, false);
	}
};

/**
 * Adds a note to the current document.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.addNote = async function () {
	await this._session.init(false, false);

	if ((!await this._doc.canInsertField(this._session.data.prefs['fieldType']))) {
		throw new Zotero.Exception.Alert("integration.error.cannotInsertHere", [],
			"integration.error.title");
	}

	let citations = await this._session.cite(null, true);
	if (this._session.data.prefs.delayCitationUpdates) {
		for (let citation of citations) {
			await this._session.writeDelayedCitation(citation._field, citation);
		}
	}
	else {
		return this._session.updateDocument(FORCE_CITATIONS_FALSE, false, false);
	}
};

/**
 * Adds a bibliography to the current document.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.addBibliography = Zotero.Promise.coroutine(function* () {
	var me = this;
	yield this._session.init(true, false);
	// Make sure we can have a bibliography
	if(!me._session.data.style.hasBibliography) {
		throw new Zotero.Exception.Alert("integration.error.noBibliography", [],
			"integration.error.title");
	}
	
	let field = new Zotero.Integration.BibliographyField(yield this._session.addField());
	var citationsMode = FORCE_CITATIONS_FALSE;
	yield field.clearCode();
	if(this._session.data.prefs.delayCitationUpdates) {
		// Refreshes citeproc state before proceeding
		this._session.reload = true;
		citationsMode = FORCE_CITATIONS_REGENERATE;
	}
	yield this._session.updateFromDocument(citationsMode);
	yield this._session.updateDocument(citationsMode, true, false);
})

/**
 * Edits bibliography metadata.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.editBibliography = Zotero.Promise.coroutine(function*() {
	// Make sure we have a bibliography
	yield this._session.init(true, false);
	var fields = yield this._session.getFields();
	
	var bibliographyField;
	for (let i = fields.length-1; i >= 0; i--) {
		let field = yield Zotero.Integration.Field.loadExisting(fields[i]);
		if (field.type == INTEGRATION_TYPE_BIBLIOGRAPHY) {
			bibliographyField = field;
			break;
		}
	}
	
	if(!bibliographyField) {
		throw new Zotero.Exception.Alert("integration.error.mustInsertBibliography",
			[], "integration.error.title");
	}
	let bibliography = new Zotero.Integration.Bibliography(bibliographyField, yield bibliographyField.unserialize());
	var citationsMode = FORCE_CITATIONS_FALSE;
	if(this._session.data.prefs.delayCitationUpdates) {
		// Refreshes citeproc state before proceeding
		this._session.reload = true;
		citationsMode = FORCE_CITATIONS_REGENERATE;
	}
	yield this._session.updateFromDocument(citationsMode);
	yield this._session.editBibliography(bibliography);
	yield this._session.updateDocument(citationsMode, true, false);
});


Zotero.Integration.Interface.prototype.addEditBibliography = Zotero.Promise.coroutine(function *() {
	// Check if we have a bibliography
	yield this._session.init(true, false);
	
	if (!this._session.data.style.hasBibliography) {
		throw new Zotero.Exception.Alert("integration.error.noBibliography", [],
			"integration.error.title");
	}
	
	var fields = yield this._session.getFields();
	
	var bibliographyField;
	for (let i = fields.length-1; i >= 0; i--) {
		let field = yield Zotero.Integration.Field.loadExisting(fields[i]);
		if (field.type == INTEGRATION_TYPE_BIBLIOGRAPHY) {
			bibliographyField = field;
			break;
		}
	}
	
	var newBibliography = !bibliographyField;
	if (!bibliographyField) {
		bibliographyField = new Zotero.Integration.BibliographyField(yield this._session.addField());
		yield bibliographyField.clearCode();
	}
	
	let bibliography = new Zotero.Integration.Bibliography(bibliographyField, yield bibliographyField.unserialize());
	var citationsMode = FORCE_CITATIONS_FALSE;
	if(this._session.data.prefs.delayCitationUpdates) {
		// Refreshes citeproc state before proceeding
		this._session.reload = true;
		citationsMode = FORCE_CITATIONS_REGENERATE;
	}
	yield this._session.updateFromDocument(citationsMode);
	if (!newBibliography) yield this._session.editBibliography(bibliography);
	yield this._session.updateDocument(citationsMode, true, false);
});

/**
 * Updates the citation data for all citations and bibliography entries.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.refresh = async function() {
	await this._session.init(true, false);
	this._session._shouldMerge = true;
	
	this._session.reload = this._session.reload || this._session.data.prefs.delayCitationUpdates;
	await this._session.updateFromDocument(FORCE_CITATIONS_REGENERATE);
	await this._session.updateDocument(FORCE_CITATIONS_REGENERATE, true, false);
}

/**
 * Deletes field codes.
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.removeCodes = Zotero.Promise.coroutine(function* () {
	yield this._session.init(true, false)
	let fields = yield this._session.getFields()
	var result = yield this._doc.displayAlert(Zotero.getString("integration.removeCodesWarning"),
				DIALOG_ICON_WARNING, DIALOG_BUTTONS_OK_CANCEL);
	if (result) {
		for(var i=fields.length-1; i>=0; i--) {
			yield fields[i].removeCode();
		}
	}
})

/**
 * Displays a dialog to set document preferences (style, footnotes/endnotes, etc.)
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.setDocPrefs = Zotero.Promise.coroutine(function* () {
	var oldData;
	let haveSession = yield this._session.init(false, true);
	
	if(!haveSession) {
		// This is a brand new document; don't try to get fields
		oldData = yield this._session.setDocPrefs(true);
	} else {
		// Can get fields while dialog is open
		oldData = yield Zotero.Promise.all([
			this._session.getFields(),
			this._session.setDocPrefs(true)
		]).spread(function (fields, setDocPrefs) {
			// Only return value from setDocPrefs
			return setDocPrefs;
		});
	}
	
	// If oldData is null, then there was no document data, so we don't need to update
	// fields
	if (!oldData) return false;

	// Perform noteType or fieldType conversion
	let fields = yield this._session.getFields();
	
	var convertBibliographies = oldData.prefs.fieldType != this._session.data.prefs.fieldType;
	var convertItems = convertBibliographies
		|| oldData.prefs.noteType != this._session.data.prefs.noteType;
	var fieldsToConvert = new Array();
	var fieldNoteTypes = new Array();
	for (var i=0, n=fields.length; i<n; i++) {
		let field = yield Zotero.Integration.Field.loadExisting(fields[i]);
		
		if (convertItems && field.type === INTEGRATION_TYPE_ITEM) {
			var citation = yield field.unserialize();
			if (!citation.properties.dontUpdate) {
				fieldsToConvert.push(fields[i]);
				fieldNoteTypes.push(this._session.data.prefs.noteType);
			}
		} else if(convertBibliographies
				&& field.type === INTEGRATION_TYPE_BIBLIOGRAPHY) {
			fieldsToConvert.push(fields[i]);
			fieldNoteTypes.push(0);
		}
	}
	
	if(fieldsToConvert.length) {
		// Pass to conversion function
		yield this._doc.convert(fieldsToConvert,
			this._session.data.prefs.fieldType, fieldNoteTypes,
			fieldNoteTypes.length);
	}
	
	// Refresh field info
	this._session._fields = null;
	this._session.ignoreEmptyBibliography = true;

	if (this._session.data.prefs.delayCitationUpdates && !fieldsToConvert.length) return;
	
	yield this._session.updateFromDocument(FORCE_CITATIONS_RESET_TEXT);
	return this._session.updateDocument(FORCE_CITATIONS_RESET_TEXT, true, true);
});

/**
 * Exports the citations in the document to a format importable in other word processors
 * @return {Promise}
 */
Zotero.Integration.Interface.prototype.exportDocument = async function () {
	await this._session.init(true, false);
	if (Zotero.Integration.confirmExportDocument()) {
		await this._session.exportDocument();
	}
}

/**
 * An exceedingly simple nsISimpleEnumerator implementation
 */
Zotero.Integration.JSEnumerator = function(objArray) {
	this.objArray = objArray;
}
Zotero.Integration.JSEnumerator.prototype.hasMoreElements = function() {
	return this.objArray.length;
}
Zotero.Integration.JSEnumerator.prototype.getNext = function() {
	return this.objArray.shift();
}

/**
 * Keeps track of all session-specific variables
 */
Zotero.Integration.Session = function(doc, app) {
	this.embeddedItems = {};
	this.embeddedZoteroItems = {};
	this.embeddedItemsByURI = {};
	this.citationsByIndex = {};
	this.resetRequest(doc);
	this.primaryFieldType = app.primaryFieldType;
	this.secondaryFieldType = app.secondaryFieldType;
	this.outputFormat = app.outputFormat || 'rtf';
	this._dontActivateDocument = false;
	this._sessionUpToDate = false;
	this._app = app;

	this._fields = null;
	this.ignoreEmptyBibliography = true;

	// Callback called while retrieving fields with the percentage complete.
	this.progressCallback = null;

	this._removeCodeFields = {};
	this._deleteFields = {};
	this._bibliographyFields = [];

	this.sessionID = Zotero.randomString();
	Zotero.Integration.sessions[this.sessionID] = this;
}

/**
 * Checks that it is appropriate to add fields to the current document at the current
 * position, then adds one.
 */
Zotero.Integration.Session.prototype.addField = async function(note, fieldIndex=-1) {
	// Get citation types if necessary
	if (!await this._doc.canInsertField(this.data.prefs['fieldType'])) {
		return Zotero.Promise.reject(new Zotero.Exception.Alert("integration.error.cannotInsertHere",
		[], "integration.error.title"));
	}
	
	var field = await this._doc.cursorInField(this.data.prefs['fieldType']);
	if (field) {
		if (!await this.displayAlert(Zotero.getString("integration.replace"),
				DIALOG_ICON_STOP,
				DIALOG_BUTTONS_OK_CANCEL)) {
			return Zotero.Promise.reject(new Zotero.Exception.UserCancelled("inserting citation"));
		}
	}
	
	if (!field) {
		field = await this._doc.insertField(this.data.prefs['fieldType'],
			(note ? this.data.prefs["noteType"] : 0));
		// Older doc plugins do not initialize the field code to anything meaningful
		// so we ensure it here manually
		field.setCode('TEMP');
	}
	// If fields already retrieved, further this.getFields() calls will returned the cached version
	// So add this field to the cache
	if (this._fields) {
		if (fieldIndex == -1) {
			this._fields.push(field);
		}
		else {
			this._fields.splice(fieldIndex, 0, field);
		}
	}
	
	return field;
}

/**
 * Gets all fields for a document
 * @return {Promise} Promise resolved with field list.
 */
Zotero.Integration.Session.prototype.getFields = new function() {
	var deferred;
	return async function(force=false) {
		// If we already have fields, just return them
		if(!force && this._fields != undefined) {
			return this._fields;
		}
		
		if (deferred) {
			return deferred.promise;
		}
		deferred = Zotero.Promise.defer();
		var promise = deferred.promise;
		
		// Otherwise, start getting fields
		var timer = new Zotero.Integration.Timer();
		timer.start();
		this.progressBar.start();
		try {
			var fields = this._fields = Array.from(await this._doc.getFields(this.data.prefs['fieldType']));
			
			var retrieveTime = timer.stop();
			this.progressBar.finishSegment();
			Zotero.debug("Integration: Retrieved " + fields.length + " fields in " +
				retrieveTime + "; " + fields.length/retrieveTime + " fields/second");
			deferred.resolve(fields);
		} catch(e) {
			deferred.reject(e);
		}
			
		deferred = null;
		return promise;
	}
}

/**
 * Updates Zotero.Integration.Session citations from the session document
 */
Zotero.Integration.Session.prototype.updateFromDocument = Zotero.Promise.coroutine(function* (forceCitations) {
	yield this.getFields();
	this.resetRequest(this._doc);
	
	this._removeCodeFields = {};
	this._deleteFields = {};
	this._bibliographyFields = [];
	
	var timer = new Zotero.Integration.Timer();
	timer.start();
	this.progressBar.start();
	if (forceCitations) {
		this.regenAll = true;
		// See Session.restoreProcessorState() for a comment
		if (!Zotero.Prefs.get('cite.useCiteprocRs')) {
			this.reload = true;
		}
	}
	yield this._processFields();
	try {
		yield this.handleRetractedItems();
	}
	catch (e) {
		Zotero.debug('Retracted item handling failed', 2);
		Zotero.logError(e);
	}
	this.regenAll = false;

	var updateTime = timer.stop();
	this.progressBar.finishSegment();
	Zotero.debug("Integration: Updated session data for " + this._fields.length + " fields in "
		+ updateTime + "; " + this._fields.length/updateTime + " fields/second");
	
	if (this.reload) {
		this.restoreProcessorState();
		delete this.reload;
	}
	this._sessionUpToDate = true;
});

/**
 * Keep processing fields until all have been processed
 */
Zotero.Integration.Session.prototype._processFields = async function () {
	if (!this._fields) {
		throw new Error("_processFields called without fetching fields first");
	}

	let adjacentCitations = [];
	for (var i = 0; i < this._fields.length; i++) {
		let field = await Zotero.Integration.Field.loadExisting(this._fields[i]);
		if (field.type === INTEGRATION_TYPE_ITEM) {
			var noteIndex = await field.getNoteIndex(),
				data = await field.unserialize(),
				citation = new Zotero.Integration.Citation(field, data, noteIndex);

			if (this._shouldMerge && typeof field.isAdjacentToNextField === 'function' && await field.isAdjacentToNextField()) {
				adjacentCitations.push(citation);
				this._deleteFields[i] = true;
				continue;
			}
			await this.addCitation(i, noteIndex, citation, adjacentCitations);
			if (adjacentCitations.length) {
				adjacentCitations = [];
			}
		} else if (field.type === INTEGRATION_TYPE_BIBLIOGRAPHY) {
			if (this.ignoreEmptyBibliography && (await field.getText()).trim() === "") {
				this._removeCodeFields[i] = true;
			} else {
				field.index = i;
				this._bibliographyFields.push(field);
			}
		}
	}
	if (this._bibliographyFields.length) {
		var data = await this._bibliographyFields[0].unserialize()
		this.bibliography = new Zotero.Integration.Bibliography(this._bibliographyFields[0], data);
		await this.bibliography.loadItemData();
	} else {
		delete this.bibliography;
	}
	// TODO: figure this out
	// Zotero.Notifier.trigger('add', 'collection', 'document');
};

/**
 * Updates bibliographies and fields within a document
 * @param {Boolean} forceCitations Whether to regenerate all citations
 * @param {Boolean} forceBibliography Whether to regenerate all bibliography entries
 * @param {Boolean} [ignoreCitationChanges] Whether to ignore changes to citations that have been 
 *	   modified since they were created, instead of showing a warning
 * @return {Promise} A promise resolved when the document is updated
 */
Zotero.Integration.Session.prototype.updateDocument = Zotero.Promise.coroutine(function* (forceCitations, forceBibliography,
		ignoreCitationChanges) {
	this.timer = new Zotero.Integration.Timer();
	this.timer.start();
	
	this.progressBar.start();
	yield this._updateCitations();
	this.progressBar.finishSegment();
	this.progressBar.start();
	yield this._updateDocument(forceCitations, forceBibliography, ignoreCitationChanges)
	this.progressBar.finishSegment();

	var diff = this.timer.stop();
	this.timer = null;
	Zotero.debug(`Integration: updateDocument complete in ${diff}s`)
	// If the update takes longer than 5s suggest delaying citation updates
	if (diff > DELAY_CITATIONS_PROMPT_TIMEOUT && !this.data.prefs.dontAskDelayCitationUpdates && !this.data.prefs.delayCitationUpdates) {
		yield this._doc.activate();
		
		var interfaceType = 'tab';
		if (['MacWord2008', 'OpenOffice'].includes(this.agent)) {
			interfaceType = 'toolbar';
		}
		
		var result = yield this.displayAlert(
				Zotero.getString('integration.delayCitationUpdates.alert.text1')
					+ "\n\n"
					+ Zotero.getString(`integration.delayCitationUpdates.alert.text2.${interfaceType}`)
					+ "\n\n"
					+ Zotero.getString('integration.delayCitationUpdates.alert.text3'),
				DIALOG_ICON_WARNING,
				DIALOG_BUTTONS_YES_NO_CANCEL
		);
		if (result == 2) {
			this.data.prefs.delayCitationUpdates = true;
		}
		if (result) {
			this.data.prefs.dontAskDelayCitationUpdates = true;
			// yield this.setDocPrefs(true);
		}
	}
});

/**
 * Helper function to update bibliographys and fields within a document
 * @param {Boolean} forceCitations Whether to regenerate all citations
 * @param {Boolean} forceBibliography Whether to regenerate all bibliography entries
 * @param {Boolean} [ignoreCitationChanges] Whether to ignore changes to citations that have been 
 *	modified since they were created, instead of showing a warning
 */
Zotero.Integration.Session.prototype._updateDocument = async function(forceCitations, forceBibliography,
		ignoreCitationChanges) {
	if(this.progressCallback) {
		var nFieldUpdates = Object.keys(this.processIndices).length;
		if(this.bibliographyHasChanged || forceBibliography) {
			nFieldUpdates += this._bibliographyFields.length*5;
		}
	}
	
	// We will be updating the document in reverse order below.
	//
	// While technically we should live in a pure heavenly place
	// where field update order wouldn't matter and integration
	// plugins would know how to update any field without breaking other
	// field access, in practice this doesn't actually work.
	// It doesn't work at least with MacWord, because (un)fortunately
	// it allows nested field codes, and creating an automatic index
	// on author names produces exactly the sorts of nested field codes
	// in styles like full footnote chicago. Upon text update on such citation
	// Zotero removes the automatically added index fields, effectively changing
	// the order of appearance of all following fields, and since
	// fields are hard-tied to their index in the document for MacWord subsequent
	// field updates start failing.
	//
	// There's also an unfortunate side-effect to this to the end user, which
	// is maybe not entirely a big deal:
	// When refreshing the document, and there is a need to prompt for multiple
	// modified citations, these prompts will appear in reverse-document order too.
	// Although at least for macword you don't get to interact with the document
	// while a prompt is being displayed, so the order of these prompts is to a large
	// degree a minor issue.
	var indicesToUpdate = Object.keys(this.processIndices);
	
	// Add bibliography indices to the above indices
	if (this.bibliography	 				// if bibliography exists
			&& Object.keys(this.citationsByIndex).length // and doc has citations
			&& (this.bibliographyHasChanged	// and bibliography changed
			|| forceBibliography)) {					// or if we should generate regardless of
														// changes
		for (let field of this._bibliographyFields) {
			indicesToUpdate.push(field.index);
		}
	}
	
	// Descending order sort
	indicesToUpdate = indicesToUpdate.sort((a, b) => b - a);
	
	var nUpdated=0;
	for(var i of indicesToUpdate) {
		if(this.progressCallback && nUpdated % 10 == 0) {
			try {
				this.progressCallback(75+(nUpdated/nFieldUpdates)*25);
			} catch(e) {
				Zotero.logError(e);
			}
		}
		// Jump to next event loop step for UI updates
		await Zotero.Promise.delay();
		
		var citation = this.citationsByIndex[i];
		if (citation) {
			let citationField = citation._field;
			
			var isRich = false;
			if (!citation.properties.dontUpdate) {
				var formattedCitation = citation.properties.custom
					? citation.properties.custom : citation.text;
				var plainCitation = citation.properties.plainCitation && await citationField.getText();
				var plaintextChanged = citation.properties.plainCitation 
						&& plainCitation !== citation.properties.plainCitation;
									
				if (!ignoreCitationChanges && plaintextChanged) {
					// Citation manually modified; ask user if they want to save changes
					Zotero.debug("[_updateDocument] Attempting to update manually modified citation.\n"
						+ "Original: " + citation.properties.plainCitation + "\n"
						+ "Current:  " + plainCitation
					);
					await citationField.select();
					var result = await this.displayAlert(
						Zotero.getString("integration.citationChanged")+"\n\n"
							+ Zotero.getString("integration.citationChanged.description")+"\n\n"
							+ Zotero.getString("integration.citationChanged.original", citation.properties.plainCitation)+"\n"
							+ Zotero.getString("integration.citationChanged.modified", plainCitation)+"\n", 
						DIALOG_ICON_CAUTION, DIALOG_BUTTONS_YES_NO);
					if (result) {
						citation.properties.dontUpdate = true;
						// Sigh. This hurts. setCode in LO forces a text reset. If the formattedText is rtf
						// it is reinserted, however that breaks what properties.dontUpdate should do
						if (this.primaryFieldType == "ReferenceMark"
							&& citation.properties.formattedCitation.includes('\\')) {
							citation.properties.formattedCitation = citation.properties.plainCitation;
						}
					}
				}
				
				// Update citation text:
				// If we're looking to reset the text even if it matches previous text (i.e. style change)
				if (forceCitations == FORCE_CITATIONS_RESET_TEXT
						// Or metadata has changed thus changing the formatted citation
						|| ((formattedCitation && citation.properties.formattedCitation !== formattedCitation
						// Or plaintext has changed and user does not want to keep the change
						|| plaintextChanged) && !citation.properties.dontUpdate)) {

					
					// Word will preserve previous text styling, so we need to force remove it
					// for citations that were inserted with delay styling
					var wasDelayed = citation.properties.formattedCitation
						&& citation.properties.formattedCitation.includes(DELAYED_CITATION_RTF_STYLING);
					if (this.outputFormat == 'rtf' && wasDelayed) {
						isRich = await citationField.setText(`${DELAYED_CITATION_RTF_STYLING_CLEAR}{${formattedCitation}}`);
					} else {
						isRich = await citationField.setText(formattedCitation);
					}
					
					citation.properties.formattedCitation = formattedCitation;
					citation.properties.plainCitation = await citationField.getText();
				}
			}
			
			var serializedCitation = citation.serialize();
			if (serializedCitation != citation.properties.field) {
				await citationField.setCode(serializedCitation);
			}
			nUpdated++;
		}
		else {
			let bibliographyField;
			for (let f of this._bibliographyFields) {
				if (f.index == i) {
					bibliographyField = f;
					break;
				}
			}
			if (!bibliographyField) {
				throw new Error(`Attempting to update field ${i} which does not exist`);
			}
			
			if (forceBibliography || this.bibliographyDataHasChanged) {
				let code = this.bibliography.serialize();
				await bibliographyField.setCode(code);
			}
			
			// get bibliography and format as RTF
			var bib = this.bibliography.getCiteprocBibliography(this.style);
			
			var bibliographyText = "";
			if (bib) {
				if (this.outputFormat == 'rtf') {
					bibliographyText = bib[0].bibstart+bib[1].join("\\\r\n")+"\\\r\n"+bib[0].bibend;
				} else {
					bibliographyText = bib[0].bibstart+bib[1].join("")+bib[0].bibend;
				}
				
				// Only set the bibliography style once so that customizations
				// to Bibliography style in word processors are maintained
				if(!this.data.style.bibliographyStyleHasBeenSet) {
					var bibStyle = Zotero.Cite.getBibliographyFormatParameters(bib);
					
					// set bibliography style
					await this._doc.setBibliographyStyle(bibStyle.firstLineIndent, bibStyle.indent,
						bibStyle.lineSpacing, bibStyle.entrySpacing, bibStyle.tabStops, bibStyle.tabStops.length);
					
					// set bibliographyStyleHasBeenSet parameter to prevent further changes	
					this.data.style.bibliographyStyleHasBeenSet = true;
				}
			}
			
			// set bibliography text
			if(this.progressCallback) {
				try {
					this.progressCallback(75+(nUpdated/nFieldUpdates)*25);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			// Jump to next event loop step for UI updates
			await Zotero.Promise.delay();
			
			if (bibliographyText) {
				await bibliographyField.setText(bibliographyText);
			}
			else {
				await bibliographyField.setText("{Bibliography}");
			}
			nUpdated += 5;
		}
	}
	
	// Do these operations in reverse in case plug-ins care about order
	var removeCodeFields = Object.keys(this._removeCodeFields).sort((a, b) => b - a);
	for (let fieldIndex of removeCodeFields) {
		await this._fields[fieldIndex].removeCode();
	}
	
	var deleteFields = Object.keys(this._deleteFields).sort((a, b) => b - a);
	for (let fieldIndex of deleteFields) {
		this._fields[fieldIndex].delete();
	}
	this.processIndices = {}
}

/**
 * Insert a citation at cursor location or edit the existing one,
 * display the citation dialog and perform any field/text inserts after
 * the dialog edits are accepted
 */
Zotero.Integration.Session.prototype.cite = async function (field, addNote=false) {
	var newField;
	var citation;
	
	if (field) {
		field = await Zotero.Integration.Field.loadExisting(field);

		if (field.type != INTEGRATION_TYPE_ITEM) {
			throw new Zotero.Exception.Alert("integration.error.notInCitation");
		}
		citation = new Zotero.Integration.Citation(field, await field.unserialize(), await field.getNoteIndex());
	} else {
		newField = true;
		field = new Zotero.Integration.CitationField(await this.addField(true));
		citation = new Zotero.Integration.Citation(field);
	}
	
	await citation.prepareForEditing();

	// -------------------
	// Preparing data to pass into CitationEditInterface
	
	var fieldIndexPromise, citationsByItemIDPromise;
	if (!this.data.prefs.delayCitationUpdates
		|| !Object.keys(this.citationsByItemID).length
		|| this._sessionUpToDate) {
		fieldIndexPromise = this.getFields().then(async function (fields) {
			for (var i = 0, n = fields.length; i < n; i++) {
				if (await fields[i].equals(field._field)) {
					// This is needed, because LibreOffice integration plugin caches the field code instead of asking
					// the document every time when calling #getCode().
					field = new Zotero.Integration.CitationField(fields[i]);
					return i;
				}
			}
			return -1;
		});
		citationsByItemIDPromise = this.updateFromDocument(FORCE_CITATIONS_FALSE).then(function() {
			return this.citationsByItemID;
		}.bind(this));
	}
	else {
		fieldIndexPromise = Zotero.Promise.resolve(-1);
		citationsByItemIDPromise = Zotero.Promise.resolve(this.citationsByItemID);
	}

	var previewFn = async function (citation) {
		let idx = await fieldIndexPromise;
		await citationsByItemIDPromise;

		var [citations, fieldToCitationIdxMapping, citationToFieldIdxMapping] = this.getCiteprocLists();
		for (var prevIdx = idx-1; prevIdx >= 0; prevIdx--) {
			if (prevIdx in fieldToCitationIdxMapping) break;
		}
		let sliceIdx = fieldToCitationIdxMapping[prevIdx]+1;
		if (sliceIdx == NaN) {
			sliceIdx = 0;
		}
		let citationsPre = citations.slice(0, sliceIdx);
		let citationsPost = citations.slice(sliceIdx);
		let citationID = citation.citationID;
		try {
			var result = this.style.previewCitationCluster(citation, citationsPre, citationsPost, "rtf");
		} catch(e) {
			throw e;
		} finally {
			// CSL.previewCitationCluster() sets citationID, which means that we do not mark it
			// as a new citation in Session.addCitation() if the ID is still present
			citation.citationID = citationID;
		}
		return result;
	}.bind(this);
		
	var io = new Zotero.Integration.CitationEditInterface(
		citation, this.style.opt.sort_citations,
		fieldIndexPromise, citationsByItemIDPromise, previewFn
	);
	Zotero.debug(`Editing citation:`);
	Zotero.debug(JSON.stringify(citation.toJSON()));

	var mode = (!Zotero.isMac && Zotero.Prefs.get('integration.keepAddCitationDialogRaised')
		? 'popup' : 'alwaysRaised')+',resizable=false';
	if (addNote) {
		Zotero.Integration.displayDialog('chrome://zotero/content/integration/insertNoteDialog.xhtml',
			mode, io);
	}
	else if (Zotero.Prefs.get("integration.useClassicAddCitationDialog")) {
		Zotero.Integration.displayDialog('chrome://zotero/content/integration/addCitationDialog.xhtml',
			'alwaysRaised,resizable', io);
	}
	else {
		Zotero.Integration.displayDialog('chrome://zotero/content/integration/quickFormat.xhtml',
			mode, io);
	}

	// -------------------
	// io.promise resolves when the citation dialog is closed
	this.progressCallback = await io.promise;
	
	if (!io.citation.citationItems.length) {
		// Try to delete new field on cancel
		if (newField) {
			try {
				await field.delete();
			} catch(e) {}
		}
		throw new Zotero.Exception.UserCancelled("inserting citation");
	}

	var fieldIndex = await fieldIndexPromise;
	// Make sure session is updated
	await citationsByItemIDPromise;
	
	let citations = await this._insertCitingResult(fieldIndex, field, io.citation);
	if (!this.data.prefs.delayCitationUpdates) {
		if (citations.length != 1) {
			// We need to refetch fields because we've inserted multiple.
			// This is not super optimal, but you're inserting 2+ citations at the time,
			// so that sets it off
			var fields = await this.getFields(true);
		}
		// And resync citations with ones in the doc
		await this.updateFromDocument(FORCE_CITATIONS_FALSE);
	}
	for (let citation of citations) {
		if (fields) {
			citation._field = new Zotero.Integration.CitationField(fields[citation._fieldIndex]);
		}
		await this.addCitation(citation._fieldIndex, await citation._field.getNoteIndex(), citation);
	}
	return citations;
};

/**
 * Inserts a citing result, where a citing result is either multiple Items or a Note item.
 * Notes may contain Items in them, which means that
 * a single citing result insert can produce multiple Citations.
 *
 * Returns an array of Citation objects which correspond to inserted citations. At least 1 Citation
 * is always returned.
 *
 * @param fieldIndex
 * @param field
 * @param citation
 * @returns {Promise<[]>}
 * @private
 */
Zotero.Integration.Session.prototype._insertCitingResult = async function (fieldIndex, field, citation) {
	await citation.loadItemData();
	
	let firstItem = Zotero.Cite.getItem(citation.citationItems[0].id);
	if (firstItem && firstItem.isNote()) {
		return this._insertNoteIntoDocument(fieldIndex, field, firstItem);
	}
	else {
		return [await this._insertItemsIntoDocument(fieldIndex++, field, citation)];
	}
};

/**
 * Splits out cited items from the note text and converts them to placeholder links.
 *
 * Returns the modified note text and an array of citation objects and their corresponding
 * placeholder IDs
 * @param item {Zotero.Item}
 */
Zotero.Integration.Session.prototype._processNote = async function (item) {
	let text = await Zotero.Notes.getExportableNote(item);
	let parser = new DOMParser();
	let doc = parser.parseFromString(text, "text/html");
	let citationsElems = doc.querySelectorAll('.citation[data-citation]');
	let citations = [];
	let placeholderIDs = [];
	for (let citationElem of citationsElems) {
		try {
			// Add the citation code object to citations array
			let citation = JSON.parse(decodeURIComponent(citationElem.dataset.citation));
			delete citation.properties;
			citations.push(citation);
			let placeholderID = Zotero.Utilities.randomString(6);
			// Add the placeholder we'll be using for the link to placeholder array
			placeholderIDs.push(placeholderID);
			let placeholderURL = NOTE_CITATION_PLACEHOLDER_LINK + placeholderID;
			// Split out the citation element and replace with a placeholder link
			let startIndex = text.indexOf(citationElem.outerHTML);
			let endIndex = startIndex + citationElem.outerHTML.length;
			text = text.slice(0, startIndex)
				+ `<a href="${placeholderURL}">${citationElem.textContent}</a>`
				+ text.slice(endIndex);
		}
		catch (e) {
			e.message = `Failed to parse a citation from a note: ${decodeURIComponent(citationElem.dataset.citation)}`;
			Zotero.debug(e, 1);
			Zotero.logError(e);
		}
	}
	// Encode unicode chars
	let value = '';
	for (let char of text) {
		let code = char.codePointAt(0);
		value += code > 127 ? '&#' + code + ';' : char;
	}
	text = value;
	
	if (!text.startsWith('<html>')) {
		text = `<html><body>${text}</body></html>`;
	}
	return [text, citations, placeholderIDs];
};

Zotero.Integration.Session.prototype._insertNoteIntoDocument = async function (fieldIndex, field, noteItem) {
	let [text, citations, placeholderIDs] = await this._processNote(noteItem);
	await field.delete();
	await this._doc.insertText(text);
	if (!citations.length) return [];
	
	// Do these in reverse order to ensure we don't get messy document edits
	placeholderIDs.reverse();
	citations.reverse();
	let fields = await this._doc.convertPlaceholdersToFields(placeholderIDs, this.data.prefs.noteType, this.data.prefs.fieldType);
	
	let insertedCitations = await Promise.all(fields.map(async (field, index) => {
		let citation = new Zotero.Integration.Citation(new Zotero.Integration.CitationField(field, 'TEMP'),
			citations[index]);
		citation._fieldIndex = fieldIndex + fields.length - 1 - index;
		return citation;
	}));
	return insertedCitations;
};

Zotero.Integration.Session.prototype._insertItemsIntoDocument = async function (fieldIndex, field, citation) {
	if (!field) {
		field = new Zotero.Integration.CitationField(await this.addField(true, fieldIndex));
	}
	citation._field = field;
	citation._fieldIndex = fieldIndex;
	return citation;
};

/**
 * Citation editing functions and propertiesaccessible to quickFormat.js and addCitationDialog.js
 */
Zotero.Integration.CitationEditInterface = function(items, sortable, fieldIndexPromise,
		citationsByItemIDPromise, previewFn){
	this.citation = items;
	this.sortable = sortable;
	this.previewFn = previewFn;
	this._fieldIndexPromise = fieldIndexPromise;
	this._citationsByItemIDPromise = citationsByItemIDPromise;
	
	// Not available in quickFormat.js if this unspecified
	this.wrappedJSObject = this;

	this._acceptDeferred = Zotero.Promise.defer();
	this.promise = this._acceptDeferred.promise;
}

Zotero.Integration.CitationEditInterface.prototype = {
	/**
	 * Execute a callback with a preview of the given citation
	 * @return {Promise} A promise resolved with the previewed citation string
	 */
	preview: function() {
		return this.previewFn(this.citation);
	},
	
	/**
	 * Sort the citationItems within citation (depends on this.citation.properties.unsorted)
	 * @return {Promise} A promise resolved with the previewed citation string
	 */
	sort: function() {
		return this.preview();
	},
	
	/**
	 * Accept changes to the citation
	 * @param {Function} [progressCallback] A callback to be run when progress has changed.
	 *     Receives a number from 0 to 100 indicating current status.
	 */
	accept: function(progressCallback) {
		if (!this._acceptDeferred.promise.isFulfilled()) {
			this._acceptDeferred.resolve(progressCallback);
		}
	},
	
	/**
	 * Get a list of items used in the current document
	 * @return {Promise} A promise resolved by the items
	 */
	getItems: async function () {
		var fieldIndex = await this._fieldIndexPromise;
		var citationsByItemID = await this._citationsByItemIDPromise;
		var ids = Object.keys(citationsByItemID).filter(itemID => {
			return citationsByItemID[itemID]
				&& citationsByItemID[itemID].length
				// Exclude the present item
				&& (citationsByItemID[itemID].length > 1
					|| citationsByItemID[itemID][0].properties.zoteroIndex !== fieldIndex);
		});
		
		// Sort all previously cited items at top, and all items cited later at bottom
		ids.sort(function(a, b) {
			var indexA = citationsByItemID[a][0].properties.zoteroIndex,
				indexB = citationsByItemID[b][0].properties.zoteroIndex;
			
			if (indexA >= fieldIndex){
				if(indexB < fieldIndex) return 1;
				return indexA - indexB;
			}
			
			if (indexB > fieldIndex) return -1;
			return indexB - indexA;
		});
		
		return Zotero.Cite.getItem(ids);
	},
}

/**
 * Resets per-request variables in the CitationSet
 */
Zotero.Integration.Session.prototype.resetRequest = function(doc) {
	this.uriMap = new Zotero.Integration.URIMap(this);
	
	this.bibliographyHasChanged = false;
	this.bibliographyDataHasChanged = false;

	// When processing citations this list will be checked for citations that are new to the document
	// (i.e. copied from somewhere else) and marked as newIndices to be processed with citeproc if
	// not present
	this.oldCitations = new Set();
	for (let i in this.citationsByIndex) {
		// But ignore indices from this.newIndices. If any are present it means that the last
		// call to this.updateFromDocument() was never followed up with this.updateDocument()
		// i.e. the operation was user cancelled
		if (i in this.newIndices) continue;
		this.oldCitations.add(this.citationsByIndex[i].citationID);
	}
	
	// After adding fields to the session
	// citations that are new to the document will be marked
	// as new,  so that they are correctly loaded into and processed with citeproc
	this.newIndices = {};
	// Citations that are not new to the session but where the item metadata
	// has changed will be marked in updateIndices
	this.updateIndices = {};
	// Citations that require updating in the document will be marked in
	// processIndices
	
	this.processIndices = {};
	this.citationsByItemID = {};
	this.citationsByIndex = {};
	this.documentCitationIDs = {};
	
	this._doc = doc;
}

/**
 * Prepares session data and displays docPrefs dialog if needed
 * @param require {Boolean} Whether an error should be thrown if no preferences or fields
 *     exist (otherwise, the set doc prefs dialog is shown)
 * @param dontRunSetDocPrefs {Boolean} Whether to show the Document Preferences window if no preferences exist
 * @return {Promise{Boolean}} true if session ready to, false if preferences dialog needs to be displayed first
 */
Zotero.Integration.Session.prototype.init = Zotero.Promise.coroutine(function *(require, dontRunSetDocPrefs) {
	var data = this.data;
	var haveFields = false;
	
	let fieldTypes = [this._app.primaryFieldType, this._app.secondaryFieldType];
	if (data.prefs.fieldType) {
		fieldTypes = [data.prefs.fieldType];
	}
	
	// If prefs not present
	if (require) {
		// check to see if fields already exist
		for (let fieldType of fieldTypes) {
			var fields = yield this._doc.getFields(fieldType);
			if (fields.length) {
				haveFields = true;
				break;
			}
		}
	}
		
	if (require && !haveFields) {
		// If required but no fields throw an error
		return Zotero.Promise.reject(new Zotero.Exception.Alert(
			"integration.error.mustInsertCitation",
			[], "integration.error.title"));
	}
	if (!data.prefs.fieldType) {
		// Unless explicitly disabled
		if (dontRunSetDocPrefs) return false;

		// Show the doc prefs dialogue
		yield this.setDocPrefs();
	}
	
	return true;
});

Zotero.Integration.Session.prototype.displayAlert = async function() {
	if (this.timer) {
		this.timer.pause();
	}
	var result = await this._doc.displayAlert.apply(this._doc, arguments);
	if (this.timer) {
		this.timer.resume();
	}
	return result;
}

/**
 * Changes the Session style and data
 * @param data {Zotero.Integration.DocumentData}
 * @param resetStyle {Boolean} Whether to force the style to be reset
 *     regardless of whether it has changed. This is desirable if the
 *     automaticJournalAbbreviations or locale has changed.
 */
Zotero.Integration.Session.prototype.setData = async function (data, resetStyle) {
	var oldStyle = (this.data && this.data.style ? this.data.style : false);
	this.data = data;
	this.data.sessionID = this.sessionID;
	if (data.style.styleID && (!oldStyle || oldStyle.styleID != data.style.styleID || resetStyle)) {
		try {
			await Zotero.Styles.init();
			var getStyle = Zotero.Styles.get(data.style.styleID);
			data.style.hasBibliography = getStyle.hasBibliography;
			if (this.style && this.style.free) {
				this.style.free();
			}
			this.style = getStyle.getCiteProc(data.style.locale, this.outputFormat, data.prefs.automaticJournalAbbreviations);
			this.styleClass = getStyle.class;
			// We're changing the citeproc instance, so we'll have to reinsert all citations into the registry
			this.reload = true;
			this.styleID = data.style.styleID;
		} catch (e) {
			Zotero.logError(e);
			throw new Zotero.Exception.Alert("integration.error.invalidStyle");
		}
		
		return true;
	} else if (oldStyle) {
		data.style = oldStyle;
	}
	return false;
};

/**
 * Displays a dialog to set document preferences
 * @return {Promise} A promise resolved with old document data, if there was any or null,
 *    if there wasn't, or rejected with Zotero.Exception.UserCancelled if the dialog was
 *    cancelled.
 */
Zotero.Integration.Session.prototype.setDocPrefs = async function (showImportExport=false) {
	var io = new function() { this.wrappedJSObject = this; };
	io.primaryFieldType = this.primaryFieldType;
	io.secondaryFieldType = this.secondaryFieldType;
	io.showImportExport = false;
	
	if (this.data) {
		io.style = this.data.style.styleID;
		io.locale = this.data.style.locale;
		io.supportedNotes = this._app.supportedNotes;
		io.useEndnotes = this.data.prefs.noteType == 0 ? 0 : this.data.prefs.noteType-1;
		io.fieldType = this.data.prefs.fieldType;
		io.delayCitationUpdates = this.data.prefs.delayCitationUpdates;
		io.dontAskDelayCitationUpdates = this.data.prefs.dontAskDelayCitationUpdates;
		io.automaticJournalAbbreviations = this.data.prefs.automaticJournalAbbreviations;
		io.requireStoreReferences = !Zotero.Utilities.isEmpty(this.embeddedItems);
		io.showImportExport = showImportExport && this.data.prefs.fieldType && this._app.supportsImportExport;
	}
	
	// Make sure styles are initialized for new docs
	await Zotero.Styles.init();
	await Zotero.Integration.displayDialog('chrome://zotero/content/integration/integrationDocPrefs.xhtml', '', io);

	if (io.exportDocument) {
		return this.exportDocument();
	}
	
	if (!io.style || !io.fieldType) {
		this._dontActivateDocument = io.dontActivateDocument;
		throw new Zotero.Exception.UserCancelled("document preferences window");
	}
	
	// set data
	var oldData = this.data;
	var data = new Zotero.Integration.DocumentData();
	data.dataVersion = oldData.dataVersion;
	data.sessionID = oldData.sessionID;
	data.style.styleID = io.style;
	data.style.locale = io.locale;
	data.style.bibliographyStyleHasBeenSet = false;
	data.prefs = oldData ? Object.assign({}, oldData.prefs) : {};
	data.prefs.fieldType = io.fieldType;
	data.prefs.automaticJournalAbbreviations = io.automaticJournalAbbreviations;
	data.prefs.delayCitationUpdates = io.delayCitationUpdates
	
	var forceStyleReset = oldData
		&& (
			oldData.prefs.automaticJournalAbbreviations != data.prefs.automaticJournalAbbreviations
			|| oldData.style.locale != io.locale
		);
	await this.setData(data, forceStyleReset);

	// need to do this after setting the data so that we know if it's a note style
	this.data.prefs.noteType = this.style && this.styleClass == "note" ? io.useEndnotes+1 : 0;
	
	if (!oldData || oldData.style.styleID != data.style.styleID
			|| oldData.prefs.noteType != data.prefs.noteType
			|| oldData.prefs.fieldType != data.prefs.fieldType
			|| (!data.prefs.delayCitationUpdates && oldData.prefs.delayCitationUpdates != data.prefs.delayCitationUpdates)
			|| oldData.prefs.automaticJournalAbbreviations != data.prefs.automaticJournalAbbreviations) {
		// This will cause us to regenerate all citations
		this.regenAll = true;
		this.reload = true;
	}
	
	return oldData || null;
}

Zotero.Integration.Session.prototype.exportDocument = async function() {
	Zotero.debug("Integration: Exporting the document");
	var timer = new Zotero.Integration.Timer();
	timer.start();
	try {
		this.data.style.bibliographyStyleHasBeenSet = false;
		await this._doc.setDocumentData(this.data.serialize());
		await this._doc.exportDocument(this.data.prefs.fieldType,
			Zotero.getString('integration.importInstructions'));
	} finally {
		Zotero.debug(`Integration: Export finished in ${timer.stop()}`);
	}
}


Zotero.Integration.Session.prototype.importDocument = async function() {
	const documentationURL = "https://www.zotero.org/support/kb/moving_documents_between_word_processors";
	
	var ps = Services.prompt;

	if (!this._app.supportsImportExport) {
		// Technically you will only reach this part in the code if getDocumentData returns
		// ZOTERO_TRANSFER_DOCUMENT, which is only viable for Word.
		// Let's add a parameter this changes later.
		ps.alert(null, Zotero.getString('integration.importDocument.title'),
			Zotero.getString('integration.importDocument.notAvailable', "Word"));
		return;
	}

	var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
		+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
		+ (ps.BUTTON_POS_2) * (ps.BUTTON_TITLE_IS_STRING);
	var result = ps.confirmEx(null,
		Zotero.getString('integration.importDocument.title'),
		Zotero.getString('integration.importDocument.description', [Zotero.clientName, this._app.processorName]),
		buttonFlags,
		Zotero.getString('integration.importDocument.button'),
		null,
		Zotero.getString('general.moreInformation'), null, {});
	if (result == 1) {
		throw new Zotero.Exception.UserCancelled("the document import");
	}
	if (result == 2) {
		Zotero.launchURL(documentationURL);
		throw new Zotero.Exception.UserCancelled("the document import");
	}
	Zotero.debug("Integration: Importing the document");
	var timer = new Zotero.Integration.Timer();
	timer.start();
	try {
		var importSuccessful = await this._doc.importDocument(this._app.primaryFieldType);
		if (!importSuccessful) {
			Zotero.debug("Integration: No importable data found in the document");
			return this.displayAlert("No importable data found", DIALOG_ICON_WARNING, DIALOG_BUTTONS_OK);
		}
		var data = new Zotero.Integration.DocumentData(await this._doc.getDocumentData());
		data.prefs.fieldType = this._app.primaryFieldType;
		await this.setData(data, true);
		await this.getFields(true);
		await this.updateFromDocument(FORCE_CITATIONS_RESET_TEXT);
		// Make sure we ignore the dont update flags since we do not know what the original text was
		for (let index in this.citationsByIndex) {
			delete this.citationsByIndex[index].properties.dontUpdate;
		}
		await this.updateDocument(FORCE_CITATIONS_RESET_TEXT, true, true);
	} finally {
		Zotero.debug(`Integration: Import finished in ${timer.stop()}`);
	}
	return data;
}

/**
 * Adds a citation to the arrays representing the document
 */
Zotero.Integration.Session.prototype.addCitation = async function (index, noteIndex, citation, adjacentCitations=[]) {
	index = parseInt(index, 10);
	
	if (adjacentCitations.length) {
		Zotero.debug(`Merging adjacent citations ${adjacentCitations.map(c => c.citationID)} to citation ${citation.citationID}`);
		for (let adjacentCitation of adjacentCitations) {
			citation.mergeCitation(adjacentCitation);
		}
		this.updateIndices[index] = true;
	}
	
	var action = await citation.loadItemData();
	
	if (action == Zotero.Integration.REMOVE_CODE) {
		// Mark for removal and return
		this._removeCodeFields[index] = true;
		return;
	} else if (action == Zotero.Integration.DELETE) {
		// Mark for deletion and return
		this._deleteFields[index] = true;
		return;
	} else if (action == Zotero.Integration.UPDATE) {
		this.updateIndices[index] = true;
	}
	// All new fields will initially be marked for deletion because they contain no
	// citationItems
	delete this._deleteFields[index];

	citation.properties.zoteroIndex = index;
	citation.properties.noteIndex = noteIndex;
	this.citationsByIndex[index] = citation;
	
	// add to citationsByItemID and citationsByIndex
	for (var i=0; i<citation.citationItems.length; i++) {
		var citationItem = citation.citationItems[i];
		if (!this.citationsByItemID[citationItem.id]) {
			this.citationsByItemID[citationItem.id] = [citation];
			this.bibliographyHasChanged = true;
		} else {
			var byItemID = this.citationsByItemID[citationItem.id];
			if (byItemID[byItemID.length-1].properties.zoteroIndex < index) {
				// if index is greater than the last index, add to end
				byItemID.push(citation);
			} else {
				// otherwise, splice in at appropriate location
				for (var j=0; byItemID[j].properties.zoteroIndex < index && j<byItemID.length-1; j++) {}
				byItemID.splice(j++, 0, citation);
			}
		}
	}
	
	// We need a new ID if there's another citation with the same citation ID in this document
	var duplicateIndex = this.documentCitationIDs[citation.citationID];
	var needNewID = !citation.citationID || duplicateIndex != undefined;
	if (needNewID) {
		if (duplicateIndex != undefined && duplicateIndex != index) {
			// If this is a duplicate, we need to mark both citations as "new"
			// since we do not know which one was the "original" one
			// and either one may need to be updated
			this.newIndices[duplicateIndex] = true;
		}
		Zotero.debug("Integration: "+citation.citationID+" ("+index+") needs new citationID");
		citation.citationID = Zotero.Utilities.randomString();
		this.newIndices[index] = true;
	}
	// Deal with citations that are copied into the document from somewhere else
	// and have not been added to the processor yet
	if (!this.oldCitations.has(citation.citationID)) {
		this.newIndices[index] = true;
	}
	if (this.regenAll && !this.newIndices[index]) {
		this.updateIndices[index] = true;
	}
	Zotero.debug("Integration: Adding citationID "+citation.citationID);
	this.documentCitationIDs[citation.citationID] = index;
};

Zotero.Integration.Session.prototype.getCiteprocLists = function() {
	var citations = [];
	var fieldToCitationIdxMapping = {};
	var citationToFieldIdxMapping = {};
	var i = 0;
	// This relies on the order of citationsByIndex keys being stable and sorted in ascending order
	// Which it seems to currently be true for every modern JS engine, so we're probably fine
	for (let idx in this.citationsByIndex) {
		if (idx in this.newIndices) {
			continue;
		}
		citations.push([this.citationsByIndex[idx].citationID, this.citationsByIndex[idx].properties.noteIndex]);
		fieldToCitationIdxMapping[i] = parseInt(idx);
		citationToFieldIdxMapping[idx] = i++;
	}
	return [citations, fieldToCitationIdxMapping, citationToFieldIdxMapping];
}

/**
 * Updates the list of citations to be serialized to the document
 */
Zotero.Integration.Session.prototype._updateCitations = async function () {
	if (Zotero.Prefs.get('cite.useCiteprocRs')) {
		return this._updateCitationsCiteprocRs();
	}
	Zotero.debug("Integration: Indices of new citations");
	Zotero.debug(Object.keys(this.newIndices));
	Zotero.debug("Integration: Indices of updated citations");
	Zotero.debug(Object.keys(this.updateIndices));
	
	let citations, fieldToCitationIdxMapping, citationToFieldIdxMapping;
	for (let indexList of [this.newIndices, this.updateIndices]) {
		for (let index in indexList) {
			if (indexList == this.newIndices) {
				delete this.newIndices[index];
				delete this.updateIndices[index];
				[citations, fieldToCitationIdxMapping, citationToFieldIdxMapping] =
					this.getCiteprocLists()
			}
		
			// Jump to next event loop step for UI updates
			await Zotero.Promise.delay();
			index = parseInt(index);
			
			var citation = this.citationsByIndex[index];
			if (!citation) continue;
			citation = citation.toJSON();

			let citationsPre = citations.slice(0, citationToFieldIdxMapping[index]);
			var citationsPost = citations.slice(citationToFieldIdxMapping[index]+1);
			
			Zotero.debug("Integration: style.processCitationCluster("+citation.toSource()+", "+citationsPre.toSource()+", "+citationsPost.toSource());
			let [info, newCitations] = this.style.processCitationCluster(citation, citationsPre, citationsPost);
			
			this.bibliographyHasChanged |= info.bibchange;
			
			for (let citationInfo of newCitations) {
				let idx = fieldToCitationIdxMapping[citationInfo[0]], text = citationInfo[1];
				this.processIndices[idx] = true;
				this.citationsByIndex[idx].text = text;
			}
		}
		[citations, fieldToCitationIdxMapping, citationToFieldIdxMapping] =
			this.getCiteprocLists();
	}
}


/**
 * Updates the list of citations to be serialized to the document with citeproc-rs
 */
Zotero.Integration.Session.prototype._updateCitationsCiteprocRs = async function () {
	Zotero.debug("Integration: Indices of new citations");
	Zotero.debug(Object.keys(this.newIndices));
	Zotero.debug("Integration: Indices of updated citations");
	Zotero.debug(Object.keys(this.updateIndices));

	for (let indexList of [this.newIndices, this.updateIndices]) {
		for (let index in indexList) {
			if (indexList == this.newIndices) {
				delete this.newIndices[index];
				delete this.updateIndices[index];
			}

			var citation = this.citationsByIndex[index];
			citation = citation.toJSON();

			Zotero.debug(`Integration: citeprocRs.insertCluster(${citation.toSource()})`);
			this.style.insertCluster(citation);
		}
	}
	
	let citationIDToIndex = {};
	for (const key in this.citationsByIndex) {
		citationIDToIndex[this.citationsByIndex[key].citationID] = key;
	}

	const citations = this.getCiteprocLists()[0];
	Zotero.debug("Integration: citeprocRs.setClusterOrder()");
	this.style.setClusterOrder(citations);
	Zotero.debug("Integration: citeprocRs.getBatchedUpdates()");
	const updateSummary = this.style.getBatchedUpdates();
	Zotero.debug("Integration: got UpdateSummary from citeprocRs");
	for (const [citationID, text] of updateSummary.clusters) {
		const index = citationIDToIndex[citationID];
		this.citationsByIndex[index].text = text;
		this.processIndices[index] = true;
	}

	this.bibliographyHasChanged |= updateSummary.bibliography
		&& Object.keys(updateSummary.bibliography.updatedEntries).length;
}

/**
 * Restores processor state from document, without requesting citation updates
 */
Zotero.Integration.Session.prototype.restoreProcessorState = function() {
	if (this._bibliographyFields.length && !this.bibliography) {
		throw new Error ("Attempting to restore processor state without loading bibliography");
	}
	let uncited = [];
	if (this.bibliography) {
		uncited = Array.from(this.bibliography.uncitedItemIDs.values());
	}
	
	var citations = [];
	for(var i in this.citationsByIndex) {
		if(this.citationsByIndex[i] && !this.newIndices[i]) {
			citations.push(this.citationsByIndex[i]);
		}
	}
	if (!Zotero.Prefs.get('cite.useCiteprocRs')) {
		// Due to a bug in citeproc-js there are disambiguation issues after changing items in Zotero library
		// and rebuilding the processor state, so we reinitialize the processor altogether
		let style = Zotero.Styles.get(this.data.style.styleID);
		this.style = style.getCiteProc(this.data.style.locale, this.outputFormat, this.data.prefs.automaticJournalAbbreviations);
	}
	this.style.rebuildProcessorState(citations, this.outputFormat, uncited);
}


Zotero.Integration.Session.prototype.writeDelayedCitation = Zotero.Promise.coroutine(function* (field, citation) {
	try {
		var text = citation.properties.custom || this.style.previewCitationCluster(citation, [], [], this.outputFormat);
	}
	catch (e) {
		throw e;
	}
	if (this.outputFormat == 'rtf') {
		text = `${DELAYED_CITATION_RTF_STYLING}{${text}}`;
	}
	else {
		text = `${DELAYED_CITATION_HTML_STYLING}${text}${DELAYED_CITATION_HTML_STYLING_END}`;
	}
	
	// Make sure we'll prompt for manually edited citations
	if (!citation.properties.dontUpdate) {
		yield field.setText(text);
		
		citation.properties.formattedCitation = text;
		citation.properties.plainCitation = yield field._field.getText();
	}
	
	yield field.setCode(citation.serialize());
	
	// Update citationsByItemID for later cited item display
	for (var i=0; i<citation.citationItems.length; i++) {
		var citationItem = citation.citationItems[i];
		if (!this.citationsByItemID[citationItem.id]) {
			this.citationsByItemID[citationItem.id] = [citation];
		} else {
			this.citationsByItemID[citationItem.id].push(citation);
		}
	}
	
	// Update bibliography with a static string
	// Note: fields._fields will only contain items upon first delayed insert
	// after a full update
	if (this._sessionUpToDate) {
		var fields = yield this.getFields();
		for (let i = fields.length - 1; i >= 0; i--) {
			let field = yield Zotero.Integration.Field.loadExisting(fields[i]);
			if (field.type == INTEGRATION_TYPE_BIBLIOGRAPHY) {
				var interfaceType = 'tab';
				if (['MacWord2008', 'OpenOffice'].includes(this.agent)) {
					interfaceType = 'toolbar';
				}
			
				yield field.setText(Zotero.getString(`integration.delayCitationUpdates.bibliography.${interfaceType}`), false);
				break;
			}
		}
	}
	this._sessionUpToDate = false;
});


Zotero.Integration.Session.prototype.getItems = function() {
	return Zotero.Cite.getItem(Object.keys(this.citationsByItemID));
}

Zotero.Integration.Session.prototype.handleRetractedItems = async function () {
	const dealWithRetracted = (citedItem, inLibrary) => {
		let dontPromptAgain = this.promptForRetraction(citedItem, inLibrary);
		if (dontPromptAgain) {
			if (citedItem.id) {
				Zotero.Retractions.disableCitationWarningsForItem(citedItem);
			}
			let itemID = citedItem.id || citedItem.cslItemID;
			for (let citation of this.citationsByItemID[itemID]) {
				for (let item of citation.citationItems) {
					if (item.id == itemID || item.cslItemID == itemID) {
						item.ignoreRetraction = true;
						this.processIndices[this.documentCitationIDs[citation.citationID]] = true;
					}
				}
			}
		}
	};
	let zoteroItems = this.getItems();
	let embeddedZoteroItems = [];
	for (let zoteroItem of zoteroItems) {
		let itemID = zoteroItem.id || zoteroItem.cslItemID;
		let citation = this.citationsByItemID[itemID][0];
		let citationItem = citation.citationItems.find(i => i.id == itemID);
		if (!citationItem.ignoreRetraction) {
			if (zoteroItem.cslItemID) {
				embeddedZoteroItems.push(zoteroItem);
			}
			else if (Zotero.Retractions.shouldShowCitationWarning(zoteroItem)) {
				dealWithRetracted(zoteroItem, true);
			}
		}
	}
	var retractedIndices = await Promise.race([Zotero.Retractions.getRetractionsFromJSON(
		embeddedZoteroItems.map(item => item.toJSON())
	), Zotero.Promise.delay(1000).then(() => [])]);
	for (let index of retractedIndices) {
		dealWithRetracted(embeddedZoteroItems[index]);
	}
};

Zotero.Integration.Session.prototype.promptForRetraction = function (citedItem, inLibrary) {
	let ps = Services.prompt;
	let buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_OK);
	// Cannot use citedItem.firstCreator since embedded items do not have that
	let creator = citedItem.getCreator(0);
	let year = citedItem.getField('year');
	let itemString = (creator ? creator.lastName + ", " : "")
		+ (year ? year + ", " : "")
		+ citedItem.getDisplayTitle();
	let promptText = Zotero.getString('retraction.citationWarning')
		+ "\n\n"
		+ itemString;
	if (inLibrary) {
		promptText += "\n\n" + Zotero.getString('retraction.citeWarning.text2');
	}
	let checkbox = { value: false };
	ps.confirmEx(null,
		Zotero.getString('general.warning'),
		promptText,
		buttonFlags,
		null, null, null,
		Zotero.getString('retraction.citationWarning.dontWarn'), checkbox);
	
	return checkbox.value;
}


/**
 * Edits integration bibliography
 * @param {Zotero.Integration.Bibliography} bibliography
 */
Zotero.Integration.Session.prototype.editBibliography = async function (bibliography) {
	if (!Object.keys(this.citationsByIndex).length) {
		throw new Error('Integration.Session.editBibliography: called without loaded citations');	
	}
	// Update citeproc with citations in the doc
	await this._updateCitations();
	await bibliography.loadItemData();
	await bibliography.getCiteprocBibliography(this.style);
	
	var bibliographyEditor = new Zotero.Integration.BibliographyEditInterface(bibliography, this.citationsByItemID, this.style);
	
	await Zotero.Integration.displayDialog('chrome://zotero/content/integration/editBibliographyDialog.xhtml', 'resizable', bibliographyEditor);
	if (bibliographyEditor.cancelled) throw new Zotero.Exception.UserCancelled("bibliography editing");
	
	this.bibliographyDataHasChanged = this.bibliographyHasChanged = true;
	this.bibliography = bibliographyEditor.bibliography;
};

/**
 * @class Interface for bibliography editor to alter document bibliography
 * @constructor
 * Creates a new bibliography editor interface
 * @param bibliography {Zotero.Integration.Bibliography}
 */
Zotero.Integration.BibliographyEditInterface = function(bibliography, citationsByItemID, citeproc) {
	this.bibliography = bibliography;
	this.citeproc = citeproc;
	this.wrappedJSObject = this;
	this._citationsByItemID = citationsByItemID;
	this._update();
}


Zotero.Integration.BibliographyEditInterface.prototype._update = function () {
	this.bib = this.bibliography.getCiteprocBibliography(this.citeproc);
};

/**
 * Reverts the text of an individual bibliography entry
 */
Zotero.Integration.BibliographyEditInterface.prototype.revert = function(itemID) {
	delete this.bibliography.customEntryText[itemID];
	return this._update();
}

/**
 * Reverts bibliography to condition in which no edits have been made
 */
Zotero.Integration.BibliographyEditInterface.prototype.revertAll = function () {
	this.bibliography.customEntryText = {};
	this.bibliography.uncitedItemIDs.clear();
	this.bibliography.omittedItemIDs.clear();
	return this._update();
};

/**
 * Reverts bibliography to condition before BibliographyEditInterface was opened
 */
Zotero.Integration.BibliographyEditInterface.prototype.cancel = function() { 
	this.cancelled = true;
};

/**
 * Checks whether a given reference is cited within the main document text
 */
Zotero.Integration.BibliographyEditInterface.prototype.isCited = function(item) {
	return this._citationsByItemID[item];
}

/**
 * Checks whether an item ID is cited in the bibliography being edited
 */
Zotero.Integration.BibliographyEditInterface.prototype.isEdited = function(itemID) {
	return itemID in this.bibliography.customEntryText;
}

/**
 * Checks whether any citations in the bibliography have been edited
 */
Zotero.Integration.BibliographyEditInterface.prototype.isAnyEdited = function() {
	return Object.keys(this.bibliography.customEntryText).length ||
		this.bibliography.uncitedItemIDs.size ||
		this.bibliography.omittedItemIDs.size;
}

/**
 * Adds an item to the bibliography
 */
Zotero.Integration.BibliographyEditInterface.prototype.add = function(itemID) {
	if (this.bibliography.omittedItemIDs.has(`${itemID}`)) {
		this.bibliography.omittedItemIDs.delete(`${itemID}`);
	} else {
		this.bibliography.uncitedItemIDs.add(`${itemID}`);
	}
	return this._update();
}

/**
 * Removes an item from the bibliography being edited
 */
Zotero.Integration.BibliographyEditInterface.prototype.remove = function(itemID) {
	if (this.bibliography.uncitedItemIDs.has(`${itemID}`)) {
		this.bibliography.uncitedItemIDs.delete(`${itemID}`);
	} else {
		this.bibliography.omittedItemIDs.add(`${itemID}`);
	}
	return this._update();
}

/**
 * Sets custom bibliography text for a given item
 */
Zotero.Integration.BibliographyEditInterface.prototype.setCustomText = function(itemID, text) {
	this.bibliography.customEntryText[itemID] = text;
	return this._update();
}

/**
 * A class for parsing and passing around document-specific data
 */
Zotero.Integration.DocumentData = function(string) {
	this.style = {};
	this.prefs = {};
	this.sessionID = null;
	if (string) {
		this.unserialize(string);
	}
}

/**
 * Serializes document-specific data as JSON
 */
Zotero.Integration.DocumentData.prototype.serialize = function() {
	// If we've retrieved data with version 4 (JSON), serialize back to JSON
	if (this.dataVersion == 4) {
		// Filter style properties
		let style = {};
		for (let prop of ['styleID', 'locale', 'hasBibliography', 'bibliographyStyleHasBeenSet']) {
			style[prop] = this.style[prop];
		}
		return JSON.stringify({
			style,
			prefs: this.prefs,
			sessionID: this.sessionID,
			zoteroVersion: Zotero.version,
			dataVersion: 4
		});
	}
	// Otherwise default to XML for now
	var prefs = "";
	for (var pref in this.prefs) {
		if (!this.prefs[pref]) continue;
		prefs += `<pref name="${Zotero.Utilities.htmlSpecialChars(pref)}" `+
			`value="${Zotero.Utilities.htmlSpecialChars(this.prefs[pref].toString())}"/>`;
	}
	
	return '<data data-version="'+Zotero.Utilities.htmlSpecialChars(`${DATA_VERSION}`)+'" '+
		'zotero-version="'+Zotero.Utilities.htmlSpecialChars(Zotero.version)+'">'+
			'<session id="'+Zotero.Utilities.htmlSpecialChars(this.sessionID)+'"/>'+
		'<style id="'+Zotero.Utilities.htmlSpecialChars(this.style.styleID)+'" '+
			(this.style.locale ? 'locale="' + Zotero.Utilities.htmlSpecialChars(this.style.locale) + '" ': '') +
			'hasBibliography="'+(this.style.hasBibliography ? "1" : "0")+'" '+
			'bibliographyStyleHasBeenSet="'+(this.style.bibliographyStyleHasBeenSet ? "1" : "0")+'"/>'+
		(prefs ? '<prefs>'+prefs+'</prefs>' : '<prefs/>')+'</data>';
};

/**
 * Unserializes document-specific XML
 */
Zotero.Integration.DocumentData.prototype.unserializeXML = function(xmlData) {
	var parser = new DOMParser(),
		doc = parser.parseFromString(xmlData, "application/xml");
	
	this.sessionID = Zotero.Utilities.xpathText(doc, '/data/session[1]/@id');
	this.style = {"styleID":Zotero.Utilities.xpathText(doc, '/data/style[1]/@id'),
		"locale":Zotero.Utilities.xpathText(doc, '/data/style[1]/@locale'),
		"hasBibliography":(Zotero.Utilities.xpathText(doc, '/data/style[1]/@hasBibliography') == 1),
		"bibliographyStyleHasBeenSet":(Zotero.Utilities.xpathText(doc, '/data/style[1]/@bibliographyStyleHasBeenSet') == 1)};
	this.prefs = {};
	for (let pref of Zotero.Utilities.xpath(doc, '/data/prefs[1]/pref')) {
		var name = pref.getAttribute("name");
		var value = pref.getAttribute("value");
		if(value === "true") {
			value = true;
		} else if(value === "false") {
			value = false;
		}
		
		this.prefs[name] = value;
	}
	
	this.prefs.noteType = parseInt(this.prefs.noteType) || 0;
	if (this.prefs["automaticJournalAbbreviations"] === undefined) this.prefs["automaticJournalAbbreviations"] = false;
	this.zoteroVersion = doc.documentElement.getAttribute("zotero-version");
	if (!this.zoteroVersion) this.zoteroVersion = "2.0";
	this.dataVersion = doc.documentElement.getAttribute("data-version");
	if (!this.dataVersion) this.dataVersion = 2;
};

/**
 * Unserializes document-specific data, either as XML or as the string form used previously
 */
Zotero.Integration.DocumentData.prototype.unserialize = function(input) {
	try {
		return Object.assign(this, JSON.parse(input))
	} catch (e) {
		if (!(e instanceof SyntaxError)) {
			throw e;
		}
	}
	if (input[0] == "<") {
		this.unserializeXML(input);
	} else {
		const splitRe = /(^|[^:]):(?!:)/;
		
		var splitOutput = input.split(splitRe);
		var prefParameters = [];
		for(var i=0; i<splitOutput.length; i+=2) {
			prefParameters.push((splitOutput[i]+(splitOutput[i+1] ? splitOutput[i+1] : "")).replace("::", ":", "g"));
		}
		
		this.sessionID = prefParameters[0];
		this.style = {"styleID":prefParameters[1], 
			"hasBibliography":(prefParameters[3] == "1" || prefParameters[3] == "True"),
			"bibliographyStyleHasBeenSet":false};
		this.prefs = {"fieldType":((prefParameters[5] == "1" || prefParameters[5] == "True") ? "Bookmark" : "Field")};
		if(prefParameters[2] == "note") {
			if(prefParameters[4] == "1" || prefParameters[4] == "True") {
				this.prefs.noteType = NOTE_ENDNOTE;
			} else {
				this.prefs.noteType = NOTE_FOOTNOTE;
			}
		} else {
			this.prefs.noteType = 0;
		}
		
		this.zoteroVersion = "2.0b6 or earlier";
		this.dataVersion = 1;
	}
}

/**
 * Handles mapping of item IDs to URIs
 */
Zotero.Integration.URIMap = function(session) {
	this.itemIDURIs = {};
	this.session = session;
}

/**
 * Adds a given mapping to the URI map
 */
Zotero.Integration.URIMap.prototype.add = function(id, uris) {
	this.itemIDURIs[id] = uris;
}

/**
 * Gets URIs for a given item ID, and adds to map
 */
Zotero.Integration.URIMap.prototype.getURIsForItemID = function(id) {
	if(typeof id === "string" && id.indexOf("/") !== -1) {
		return Zotero.Cite.getItem(id).cslURIs;
	}
	
	if(!this.itemIDURIs[id]) {
		this.itemIDURIs[id] = [Zotero.URI.getItemURI(Zotero.Items.get(id))];
	}
	
	return this.itemIDURIs[id];
}

/**
 * Gets Zotero item for a given set of URIs
 */
Zotero.Integration.URIMap.prototype.getZoteroItemForURIs = async function (uris) {
	var zoteroItem = false;
	var needUpdate = false;
	var embeddedItem = false;;
	
	for(var i=0, n=uris.length; i<n; i++) {
		var uri = uris[i];
		
		// First try embedded URI
		if(this.session.embeddedItemsByURI[uri]) {
			embeddedItem = this.session.embeddedItemsByURI[uri];
		}
		
		// Next try getting URI directly
		try {
			var replacer = await Zotero.URI.getURIItem(uri);
			if (replacer && !replacer.deleted) {
				zoteroItem = replacer;
				break;
			}
		} catch(e) {}
		
		// Try merged item mapping
		var replacer = await Zotero.Relations.getByPredicateAndObject(
			'item', Zotero.Relations.replacedItemPredicate, uri
		);
		if (replacer.length && !replacer[0].deleted) {
			zoteroItem = replacer[0];
			break;
		}
		
		// Check if it's a mendeley URI and if we have imported the item
		let m = MENDELEY_URI_RE.exec(uri);
		if (m) {
			replacer = await Zotero.Relations.getByPredicateAndObject(
				'item', 'mendeleyDB:documentUUID', m[1]
			);
			if (replacer.length) {
				if (!replacer[0].deleted) {
					zoteroItem = replacer[0];
					break;
				}
			}
			// If not blocked by user having pressed skip in this session,
			// or user having checked the checkbox to not be prompted about this,
			// or user having imported their library with the new version of importer
			else if (!(this.session.dontPromptForMendeley
				|| Zotero.Prefs.get('integration.dontPromptMendeleyImport')
				|| await Zotero.DB.valueQueryAsync("SELECT value FROM settings WHERE setting='mendeleyImport' AND key='version'")
			)) {
				// Prompt user to (re)import their mendeley database which might make us recognize
				// these items
				let checkbox = {};
				let result = Zotero.Prompt.confirm({
					title: Zotero.getString('integration.mendeleyImport.title'),
					text: Zotero.getString('integration.mendeleyImport.description', [Zotero.appName]),
					button0: Zotero.getString('integration.mendeleyImport.openImporter'),
					button1: Zotero.getString('general.skip'),
					checkLabel: Zotero.getString('general.dontAskAgain'),
					checkbox
				});
				if (result === 0) {
					setTimeout(
						() => Zotero.getMainWindow().Zotero_File_Interface.showImportWizard(
							{
								pageID: 'page-mendeley-online-intro',
								relinkOnly: true
							}
						)
					);
					throw new Zotero.Exception.UserCancelled("Importing mendeley citations");
				}
				else {
					this.session.dontPromptForMendeley = true;
				}
				if (checkbox.value) {
					Zotero.Prefs.set('integration.dontPromptMendeleyImport', true);
				}
			}
		};
		
	}
	
	if (zoteroItem) {
		// make sure URI is up to date (in case user just began syncing)
		var newURI = Zotero.URI.getItemURI(zoteroItem);
		if (!uris.includes(newURI)) {
			uris.push(newURI);
			needUpdate = true;
		}
		// cache uris
		this.add(zoteroItem.id, uris)
	}
	else if (embeddedItem) {
		return [embeddedItem, false];
	}
	
	return [zoteroItem, needUpdate];
};

Zotero.Integration.Field = class {
	constructor(field, rawCode) {
		if (field instanceof Zotero.Integration.Field) {
			throw new Error("Trying to instantiate Integration.Field with Integration.Field, not doc field");
		}
		for (let func of Zotero.Integration.Field.INTERFACE) {
			if (!(func in this) && (func in field)) {
				this[func] = field[func].bind(field);
			}
		}
		this._field = field;
		this._code = rawCode;
		this.type = INTEGRATION_TYPE_TEMP;
	}
	
	async setCode(code) {
		// Boo. Inconsistent order.
		if (this.type == INTEGRATION_TYPE_ITEM) {
			await this._field.setCode(`ITEM CSL_CITATION ${code}`);
		} else if (this.type == INTEGRATION_TYPE_BIBLIOGRAPHY) {
			await this._field.setCode(`BIBL ${code} CSL_BIBLIOGRAPHY`);
		} else {
			await this._field.setCode(`TEMP`);
		}
		this._code = code;
	}

	getCode() {
		if (!this._code) {
			this._code = this._field.getCode();
		}
		let start = this._code.indexOf('{');
		if (start == -1) {
			return '{}';
		}
		return this._code.substring(start, this._code.lastIndexOf('}')+1);
	}

	async clearCode() {
		return await this.setCode('{}');
	}
	
	async getText() {
		if (this._text) {
			return this._text;
		}
		this._text = await this._field.getText();
		return this._text;
	}
		
	async setText(text) {
		this._text = null;
		var isRich = false;
		// If RTF wrap with RTF tags
		if (Zotero.Integration.currentSession.outputFormat == "rtf" && text.includes("\\")) {
			if (text.substr(0,5) != "{\\rtf") {
				text = "{\\rtf "+text+"}";
			}
			isRich = true;
		}
		await this._field.setText(text, isRich);
		return isRich;
	}
};
Zotero.Integration.Field.INTERFACE = ['delete', 'removeCode', 'select', 'setText',
	'getText', 'setCode', 'getCode', 'equals', 'getNoteIndex', 'isAdjacentToNextField'];

/**
 * Load existing field in document and return correct instance of field type
 * @param docField
 * @param rawCode
 * @param idx
 * @returns {Zotero.Integration.Field|Zotero.Integration.CitationField|Zotero.Integration.BibliographyField}
 */
Zotero.Integration.Field.loadExisting = async function(docField) {
	var field;
	// Already loaded
	if (docField instanceof Zotero.Integration.Field) return docField;
	let rawCode = await docField.getCode();
	
	// ITEM/CITATION CSL_ITEM {json: 'data'} 
	for (let type of ["ITEM", "CITATION"]) {
		if (rawCode.substr(0, type.length) === type) {
			field = new Zotero.Integration.CitationField(docField, rawCode);
		}
	}
	// BIBL {json: 'data'} CSL_BIBLIOGRAPHY
	if (rawCode.substr(0, 4) === "BIBL") {
		field = new Zotero.Integration.BibliographyField(docField, rawCode);
	}
	
	if (!field) {
		field = new Zotero.Integration.Field(docField, rawCode);
	}
	
	return field;
};

/**
 * Adds a citation based on a serialized Word field
 */
Zotero.Integration._oldCitationLocatorMap = {
	p:"page",
	g:"paragraph",
	l:"line"
};


Zotero.Integration.CitationField = class extends Zotero.Integration.Field {
	constructor(field, rawCode) {
		super(field, rawCode);
		this.type = INTEGRATION_TYPE_ITEM;
	}
	
	/**
	 * Don't be fooled, this should be as simple as JSON.parse().
	 * The schema for the code is defined @ https://raw.githubusercontent.com/citation-style-language/schema/master/csl-citation.json
	 *
	 * However, over the years and different versions of Zotero there's been changes to the schema,
	 * incorrect serialization, etc. Therefore this function is cruft-full and we can't get rid of it.
	 *
	 * @returns {{citationItems: Object[], properties: Object}}
	 */
	async unserialize() {
		function unserialize(code) {
			try {
				return JSON.parse(code);
			} catch(e) {
				// fix for corrupted fields (corrupted by 2.1b1)
				return JSON.parse(code.replace(/{{((?:\s*,?"unsorted":(?:true|false)|\s*,?"custom":"(?:(?:\\")?[^"]*\s*)*")*)}}/, "{$1}"));
			}
		}
		
		function upgradeCruft(citation, code) {
			// fix for uppercase citation codes
			if(citation.CITATIONITEMS) {
				citation.citationItems = [];
				for (var i=0; i<citation.CITATIONITEMS.length; i++) {
					for (var j in citation.CITATIONITEMS[i]) {
						switch (j) {
							case 'ITEMID':
								var field = 'itemID';
								break;

							// 'position', 'custom'
							default:
								var field = j.toLowerCase();
						}
						if (!citation.citationItems[i]) {
							citation.citationItems[i] = {};
						}
						citation.citationItems[i][field] = citation.CITATIONITEMS[i][j];
					}
				}
			}

			if(!citation.properties) citation.properties = {};

			for (let citationItem of citation.citationItems) {
				// for upgrade from Zotero 2.0 or earlier
				if(citationItem.locatorType) {
					citationItem.label = citationItem.locatorType;
					delete citationItem.locatorType;
				} else if(citationItem.suppressAuthor) {
					citationItem["suppress-author"] = citationItem["suppressAuthor"];
					delete citationItem.suppressAuthor;
				}

				// fix for improper upgrade from Zotero 2.1 in <2.1.5
				if(parseInt(citationItem.label) == citationItem.label) {
					const locatorTypeTerms = ["page", "book", "chapter", "column", "figure", "folio",
						"issue", "line", "note", "opus", "paragraph", "part", "section", "sub verbo",
						"volume", "verse"];
					citationItem.label = locatorTypeTerms[parseInt(citationItem.label)];
				}

				// for update from Zotero 2.1 or earlier
				if (citationItem.uri) {
					if (Array.isArray(citationItem.uris)) {
						citationItems.uris = citationItem.uris.concat(citationItem.uri);
					}
					else {
						citationItem.uris = citationItem.uri;
					}
					delete citationItem.uri;
				}
			}

			// for upgrade from Zotero 2.0 or earlier
			if(citation.sort) {
				citation.properties.unsorted = !citation.sort;
				delete citation.sort;
			}
			if(citation.custom) {
				citation.properties.custom = citation.custom;
				delete citation.custom;
			}

			citation.properties.field = code;	
			return citation;
		}
		
		function unserializePreZotero1_0(code) {
			var underscoreIndex = code.indexOf("_");
			var itemIDs = code.substr(0, underscoreIndex).split("|");

			var lastIndex = code.lastIndexOf("_");
			if(lastIndex != underscoreIndex+1) {
				var locatorString = code.substr(underscoreIndex+1, lastIndex-underscoreIndex-1);
				var locators = locatorString.split("|");
			}

			var citationItems = new Array();
			for(var i=0; i<itemIDs.length; i++) {
				var citationItem = {id:itemIDs[i]};
				if(locators) {
					citationItem.locator = locators[i].substr(1);
					citationItem.label = Zotero.Integration._oldCitationLocatorMap[locators[i][0]];
				}
				citationItems.push(citationItem);
			}

			return {"citationItems":citationItems, properties:{}};
		}


		let code = this.getCode();
		try {
			if (code[0] == '{') {		// JSON field
				return upgradeCruft(unserialize(code), code);
			} else {				// ye olde style field
				return unserializePreZotero1_0(code);
			}
		} catch (e) {
			return this.resolveCorrupt(code);
		}
	}
	
	async clearCode() {
		await this.setCode(JSON.stringify({citationItems: [], properties: {}}));
	}
		
	async resolveCorrupt(code) {
		Zotero.debug(`Integration: handling corrupt citation field ${code}`);
		var msg = Zotero.getString("integration.corruptField")+'\n\n'+
				  Zotero.getString('integration.corruptField.description');
		await this.select();
		Zotero.Integration.currentDoc.activate();
		var result = await Zotero.Integration.currentSession.displayAlert(msg, DIALOG_ICON_CAUTION, DIALOG_BUTTONS_YES_NO_CANCEL);
		if (result == 0) { // Cancel
			throw new Zotero.Exception.UserCancelled("corrupt citation resolution");
		} else if (result == 1) {		// No
			return false;
		} else { // Yes
			// Clear current code and subsequent addEditCitation dialog will be the reselection
			await this.clearCode();
			return this.unserialize();
		}
	}
};


Zotero.Integration.BibliographyField = class extends Zotero.Integration.Field {
	constructor(field, rawCode) {
		super(field, rawCode);
		this.type = INTEGRATION_TYPE_BIBLIOGRAPHY;
	};
	
	async unserialize() {
		var code = this.getCode();
		try {
			return JSON.parse(code);
		} catch(e) {
			return this.resolveCorrupt(code);
		}
	}
	async resolveCorrupt(code) {
		Zotero.debug(`Integration: handling corrupt bibliography field ${code}`);
		var msg = Zotero.getString("integration.corruptBibliography")+'\n\n'+
				  Zotero.getString('integration.corruptBibliography.description');
		var result = await Zotero.Integration.currentSession.displayAlert(msg, DIALOG_ICON_CAUTION, DIALOG_BUTTONS_OK_CANCEL);
		if (result == 0) {
			throw new Zotero.Exception.UserCancelled("corrupt bibliography resolution");
		} else {
			await this.clearCode();
			return this.unserialize();
		}
	}
};

Zotero.Integration.Citation = class {
	static refreshEmbeddedData(itemData) {
		if (itemData.shortTitle) {
			itemData['title-short'] = itemData.shortTitle;
			delete itemData.shortTitle;
		}
		return itemData;
	}

	constructor(citationField, data, noteIndex) {
		data = Object.assign({ citationItems: [], properties: {} }, data)
		this.citationID = data.citationID;
		this.citationItems = data.citationItems;
		this.properties = data.properties;
		this.properties.noteIndex = noteIndex;

		this._field = citationField;
	}

	/**
	 * Merge citation items and remove duplicates, unless the items have different
	 * @param citation {Citation}
	 */
	mergeCitation(citation) {
		let items = this.citationItems.concat(citation.citationItems);
		let addedItems = new Set();
		this.citationItems = []
		for (let item of items) {
			if (addedItems.has(item.id)) {
				continue;
			}
			addedItems.add(item.id);
			this.citationItems.push(item);
		}
	}

	/**
	 * Load citation item data
	 * @param {Boolean} [promptToReselect=true] - will throw a MissingItemException if false
	 * @returns {Promise{Number}}
	 * 	- Zotero.Integration.NO_ACTION
	 * 	- Zotero.Integration.UPDATE
	 * 	- Zotero.Integration.REMOVE_CODE
	 * 	- Zotero.Integration.DELETE
	 */
	async loadItemData(promptToReselect=true) {
		let items = [];
		var needUpdate = false;
		
		if (!this.citationItems.length) {
			return Zotero.Integration.DELETE;
		}
		for (var i=0, n=this.citationItems.length; i<n; i++) {
			var citationItem = this.citationItems[i];
			
			// get Zotero item
			var zoteroItem = false;
			if ('uri' in citationItem && !('uris' in citationItem)) {
				citationItem.uris = [citationItem.uri];
			}
			if (citationItem.uris) {
				let itemNeedsUpdate;
				[zoteroItem, itemNeedsUpdate] = await Zotero.Integration.currentSession.uriMap.getZoteroItemForURIs(citationItem.uris);
				needUpdate = needUpdate || itemNeedsUpdate;
				
				// Unfortunately, people do weird things with their documents. One weird thing people
				// apparently like to do (http://forums.zotero.org/discussion/22262/) is to copy and
				// paste citations from other documents created with earlier versions of Zotero into
				// their documents and then not refresh the document. Usually, this isn't a problem. If
				// document is edited by the same user, it will work without incident. If the first
				// citation of a given item doesn't contain itemData, the user will get a
				// MissingItemException. However, it may also happen that the first citation contains
				// itemData, but later citations don't, because the user inserted the item properly and
				// then copied and pasted the same citation from another document. We check for that
				// possibility here.
				if (zoteroItem.cslItemData && !citationItem.itemData) {
					citationItem.itemData = zoteroItem.cslItemData;
					needUpdate = true;
				}
			} else {
				if (citationItem.key && citationItem.libraryID) {
					// DEBUG: why no library id?
					zoteroItem = Zotero.Items.getByLibraryAndKey(citationItem.libraryID, citationItem.key);
				} else if (citationItem.itemID) {
					zoteroItem = Zotero.Items.get(citationItem.itemID);
				} else if (citationItem.id) {
					zoteroItem = Zotero.Items.get(citationItem.id);
				}
				if (zoteroItem) needUpdate = true;
			}
			
			// Item no longer in library
			if (!zoteroItem) {
				// Use embedded item
				if (citationItem.itemData) {
					Zotero.debug(`Item ${JSON.stringify(citationItem.uris)} not in library. Using embedded data`);
					citationItem.itemData = Zotero.Integration.Citation.refreshEmbeddedData(citationItem.itemData);
					// add new embedded item
					var itemData = Zotero.Utilities.deepCopy(citationItem.itemData);
					
					// assign a random string as an item ID
					var anonymousID = Zotero.randomString();
					var globalID = itemData.id = citationItem.id = Zotero.Integration.currentSession.data.sessionID+"/"+anonymousID;
					Zotero.Integration.currentSession.embeddedItems[anonymousID] = itemData;
					
					// assign a Zotero item
					var surrogateItem = Zotero.Integration.currentSession.embeddedZoteroItems[anonymousID] = new Zotero.Item();
					Zotero.Utilities.itemFromCSLJSON(surrogateItem, itemData);
					surrogateItem.cslItemID = globalID;
					surrogateItem.cslURIs = citationItem.uris;
					surrogateItem.cslItemData = itemData;
					
					for(var j=0, m=citationItem.uris.length; j<m; j++) {
						Zotero.Integration.currentSession.embeddedItemsByURI[citationItem.uris[j]] = surrogateItem;
					}
				} else if (promptToReselect) {
					zoteroItem = await this.handleMissingItem(i);
					if (zoteroItem) needUpdate = true;
					else return Zotero.Integration.REMOVE_CODE;
				} else {
					// throw a MissingItemException
					throw (new Zotero.Integration.MissingItemException(this, this.citationItems[i]));
				}
			}
			
			if (zoteroItem) {
				if (zoteroItem.cslItemID) {
					citationItem.id = zoteroItem.cslItemID;
				}
				else {
					citationItem.id = zoteroItem.id;
					items.push(zoteroItem);
				}
			}
		}
		
		// Items may be in libraries that haven't been loaded, and retrieveItem() is synchronous, so load
		// all data (as required by toJSON(), which is used by itemToExportFormat(), which is used by
		// itemToCSLJSON()) now
		if (items.length) {
			await Zotero.Items.loadDataTypes(items);
		}
		return needUpdate ? Zotero.Integration.UPDATE : Zotero.Integration.NO_ACTION;
	}
		
	async handleMissingItem(idx) {
		// Ask user what to do with this item
		if (this.citationItems.length == 1) {
			var msg = Zotero.getString("integration.missingItem.single");
		} else {
			var msg = Zotero.getString("integration.missingItem.multiple", (idx).toString());
		}
		msg += '\n\n'+Zotero.getString('integration.missingItem.description');
		await this._field.select();
		await Zotero.Integration.currentDoc.activate();
		var result = await Zotero.Integration.currentSession.displayAlert(msg,
			DIALOG_ICON_WARNING, DIALOG_BUTTONS_YES_NO_CANCEL);
		if (result == 0) {			// Cancel
			throw new Zotero.Exception.UserCancelled("document update");
		} else if(result == 1) {	// No
			return false;
		}
		
		// Yes - prompt to reselect
		var io = new function() { this.wrappedJSObject = this; };
		
		io.addBorder = Zotero.isWin;
		io.singleSelection = true;
		io.itemTreeID = "handle-missing-item-select-item-dialog";
		
		await Zotero.Integration.displayDialog('chrome://zotero/content/selectItemsDialog.xhtml', 'resizable', io);
			
		if (io.dataOut && io.dataOut.length) {
			return Zotero.Items.get(io.dataOut[0]);
		}
	}

	async prepareForEditing() {
		// Check for modified field text or dontUpdate flag
		if (this.properties.dontUpdate
				|| (this.properties.plainCitation
					&& await this._field.getText() !== this.properties.plainCitation)) {
			await Zotero.Integration.currentDoc.activate();
			var fieldText = await this._field.getText();
			Zotero.debug("[addEditCitation] Attempting to update manually modified citation.\n"
				+ "citaion.properties.dontUpdate: " + this.properties.dontUpdate + "\n"
				+ "Original: " + this.properties.plainCitation + "\n"
				+ "Current:  " + fieldText
			);
			if (!await Zotero.Integration.currentDoc.displayAlert(
					Zotero.getString("integration.citationChanged.edit")+"\n\n"
					+ Zotero.getString("integration.citationChanged.original", this.properties.plainCitation)+"\n"
					+ Zotero.getString("integration.citationChanged.modified", fieldText)+"\n",
					DIALOG_ICON_WARNING, DIALOG_BUTTONS_OK_CANCEL)) {
				throw new Zotero.Exception.UserCancelled("editing citation");
			}
		}
		
		// make sure it's going to get updated
		delete this.properties["formattedCitation"];
		delete this.properties["plainCitation"];
		delete this.properties["dontUpdate"];
		
		// Load items to be displayed in edit dialog
		await this.loadItemData();
	}
	
	toJSON() {
		const saveProperties = ["custom", "unsorted", "formattedCitation", "plainCitation", "dontUpdate", "noteIndex"];
		const saveCitationItemKeys = ["locator", "label", "suppress-author", "author-only", "prefix",
			"suffix", "ignoreRetraction"];
		
		var citation = {};
		
		citation.citationID = this.citationID;
		
		citation.properties = {};
		for (let key of saveProperties) {
			if (key in this.properties) citation.properties[key] = this.properties[key];
		}
		
		citation.citationItems = new Array(this.citationItems.length);
		for (let i=0; i < this.citationItems.length; i++) {
			var citationItem = this.citationItems[i],
				serializeCitationItem = {};
			
			// add URI and itemData
			var slashIndex;
			if (typeof citationItem.id === "string" && (slashIndex = citationItem.id.indexOf("/")) !== -1) {
				// this is an embedded item
				serializeCitationItem.id = citationItem.id;
				serializeCitationItem.uris = citationItem.uris;
				
				// always store itemData, since we have no way to get it back otherwise
				serializeCitationItem.itemData = citationItem.itemData;
			} else {
				serializeCitationItem.id = citationItem.id;
				serializeCitationItem.uris = Zotero.Integration.currentSession.uriMap.getURIsForItemID(citationItem.id);
			
				serializeCitationItem.itemData = Zotero.Integration.currentSession.style.sys.retrieveItem(citationItem.id);
			}
			
			for (let key of saveCitationItemKeys) {
				if (key in citationItem) serializeCitationItem[key] = citationItem[key];
			}
			
			citation.citationItems[i] = serializeCitationItem;
		}
		citation.schema = "https://github.com/citation-style-language/schema/raw/master/csl-citation.json";
		
		return citation;
	}

	/**
	 * Serializes the citation into CSL code representation
	 * @returns {string}
	 */
	serialize() {
		return JSON.stringify(this.toJSON());
	}
};

Zotero.Integration.Bibliography = class {
	constructor(bibliographyField, data) {
		this._field = bibliographyField;
		this.data = data;
		
		this.uncitedItemIDs = new Set();
		this.omittedItemIDs = new Set();
		this.customEntryText = {};
		this.dataLoaded = false;
	}
	
	loadItemData() {
		return Zotero.Promise.coroutine(function* () {
			// set uncited
			var needUpdate = false;
			if (this.data.uncited) {
				if (this.data.uncited[0]) {
					// new style array of arrays with URIs
					let zoteroItem, itemNeedsUpdate;
					for (let uris of this.data.uncited) {
						[zoteroItem, itemNeedsUpdate] = yield Zotero.Integration.currentSession.uriMap.getZoteroItemForURIs(uris);
						var id = zoteroItem.cslItemID ? zoteroItem.cslItemID : zoteroItem.id;
						if(zoteroItem && !Zotero.Integration.currentSession.citationsByItemID[id]) {
							this.uncitedItemIDs.add(`${id}`);
						} else {
							needUpdate = true;
						}
						needUpdate |= itemNeedsUpdate;
					}
				} else {
					for(var itemID in this.data.uncited) {
						// if not yet in item set, add to item set
						// DEBUG: why no libraryID?
						var zoteroItem = Zotero.Items.getByLibraryAndKey(0, itemID);
						if (!zoteroItem) zoteroItem = Zotero.Items.get(itemID);
						if (zoteroItem) this.uncitedItemIDs.add(`${id}`);
					}
					needUpdate = true;
				}
			}
			
			// set custom bibliography entries
			if(this.data.custom) {
				if(this.data.custom[0]) {
					// new style array of arrays with URIs
					var zoteroItem, itemNeedsUpdate;
					for (let custom of this.data.custom) {
						[zoteroItem, itemNeedsUpdate] = yield Zotero.Integration.currentSession.uriMap.getZoteroItemForURIs(custom[0]);
						if (!zoteroItem) continue;
						if (needUpdate) needUpdate = true;
						
						var id = zoteroItem.cslItemID ? zoteroItem.cslItemID : zoteroItem.id;
						if (Zotero.Integration.currentSession.citationsByItemID[id] || id in this.uncitedItemIDs) {
							this.customEntryText[id] = custom[1];
						}
					}
				} else {
					// old style hash
					for(var itemID in this.data.custom) {
						var zoteroItem = Zotero.Items.getByLibraryAndKey(0, itemID);
						if (!zoteroItem) zoteroItem = Zotero.Items.get(itemID);
						if (!zoteroItem) continue;
						
						if(Zotero.Integration.currentSession.citationsByItemID[zoteroItem.id] || zoteroItem.id in this.uncitedItemIDs) {
							this.customEntryText[zoteroItem.id] = this.data.custom[itemID];
						}
					}
					needUpdate = true;
				}
			}
			
			// set entries to be omitted from bibliography
			if (this.data.omitted) {
				let zoteroItem, itemNeedsUpdate;
				for (let uris of this.data.omitted) {
					[zoteroItem, itemNeedsUpdate] = yield Zotero.Integration.currentSession.uriMap.getZoteroItemForURIs(uris);
					var id = zoteroItem.cslItemID ? zoteroItem.cslItemID : zoteroItem.id;
					if (zoteroItem && Zotero.Integration.currentSession.citationsByItemID[id]) {
						this.omittedItemIDs.add(`${id}`);
					} else {
						needUpdate = true;
					}
					needUpdate |= itemNeedsUpdate;
				}
			}
			this.dataLoaded = true;
			return needUpdate;	
		}).apply(this, arguments);
	}

	getCiteprocBibliography(citeproc) {
		if (Zotero.Utilities.isEmpty(Zotero.Integration.currentSession.citationsByItemID)) {
			throw new Error("Attempting to generate bibliography without having updated processor items");
		};
		if (!this.dataLoaded) {
			throw new Error("Attempting to generate bibliography without having loaded item data");
		}

		Zotero.debug(`Integration: style.updateUncitedItems ${Array.from(this.uncitedItemIDs.values()).toSource()}`);
		citeproc.updateUncitedItems(Array.from(this.uncitedItemIDs.values()));
		let bibliography = citeproc.makeBibliography();
		Zotero.Cite.removeFromBibliography(bibliography, this.omittedItemIDs);
	
		for (let i in bibliography[0].entry_ids) {
			if (bibliography[0].entry_ids[i].length != 1) continue;
			let itemID = bibliography[0].entry_ids[i][0];
			if (itemID in this.customEntryText) {
				bibliography[1][i] = this.customEntryText[itemID];
			}
		}
		return bibliography;
	}
	
	serialize() {
		if (!this.dataLoaded) {
			throw new Error("Attempting to generate bibliography without having loaded item data");
		}
		var bibliography = {
			uncited: [],
			omitted: [],
			custom: []
		};
		
		// add uncited if there is anything
		for (let itemID of this.uncitedItemIDs.values()) {
			bibliography.uncited.push(Zotero.Integration.currentSession.uriMap.getURIsForItemID(itemID));
		}
		for (let itemID of this.omittedItemIDs.values()) {
			bibliography.omitted.push(Zotero.Integration.currentSession.uriMap.getURIsForItemID(itemID));
		}
		
		bibliography.custom = Object.keys(this.customEntryText)
			.map(id => [Zotero.Integration.currentSession.uriMap.getURIsForItemID(id), this.customEntryText[id]]);
		
		
		return JSON.stringify(bibliography);
	}
}

// perhaps not the best place for a timer
Zotero.Integration.Timer = class {
	start() {
		this.startTime = (new Date()).getTime();
	}
	
	stop() {
		this.resume();
		this.finalTime = ((new Date()).getTime() - this.startTime)
		return this.finalTime/1000;
	}
	
	pause() {
		this.pauseTime = (new Date()).getTime();
	}
	
	getSplit() {
		var pauseTime = 0;
		if (this.pauseTime) {
			var pauseTime = (new Date()).getTime() - this.pauseTime;
		}
		return ((new Date()).getTime() - this.startTime - pauseTime);
	}
	
	resume() {
		if (this.pauseTime) {
			this.startTime += ((new Date()).getTime() - this.pauseTime);
			this.pauseTime;
		}
	}
}

Zotero.Integration.Progress = class {
	/**
	 * @param {Number} segmentCount
	 * @param {Boolean} dontDisplay
	 *		On macOS closing an application window switches focus to the topmost window of the same application
	 *		instead of the previous window of any application. Since the progress window is opened and closed
	 *		between showing other integration windows, macOS will switch focus to the main Zotero window (and
	 *		move the word processor window to the background). Thus we avoid showing the progress window on macOS
	 *		except for http agents (i.e. google docs), where even opening the citation dialog may potentially take
	 *		a long time and having no indication of progress is worse than bringing the Zotero window to the front
	 */
	constructor(segmentCount=4, isNote=false, dontDisplay=false) {
		this.segments = Array.from({length: segmentCount}, () => undefined);
		this.timer = new Zotero.Integration.Timer();
		this.segmentIdx = 0;
		this.dontDisplay = dontDisplay;
		this.isNote = isNote;
	}
	
	update() {
		if (!this.onProgress) return;
		var currentSegment = this.segments[this.segmentIdx];
		if (!currentSegment) return;
		var total = this.segments.reduce((acc, val) => acc+val, 0);
		var startProgress = 100*this.segments.slice(0, this.segmentIdx).reduce((acc, val) => acc+val, 0)/total;
		var maxProgress = 100.0*currentSegment/total;
		var split = this.timer.getSplit();
		var curProgress = startProgress + maxProgress*Math.min(1, split/currentSegment);
		this.onProgress(curProgress);
		setTimeout(this.update.bind(this), 100);
	}
	
	start() {
		this.timer.start();
	}
	pause() {this.timer.pause();}
	resume() {this.timer.resume();}
	finishSegment() {
		this.timer.stop();
		this.segments[this.segmentIdx++] = this.timer.finalTime;
	}
	reset() {
		this.segmentIdx = 0;
	}
	show() {
		if (this.dontDisplay) return;
		var options = 'chrome,centerscreen';
		// without this, Firefox gets raised with our windows under Compiz
		if (Zotero.isLinux) options += ',dialog=no';
		if (Zotero.isMac) options += ',resizable=false';
		
		var io = {onLoad: function(onProgress) {
			this.onProgress = onProgress;
			this.update();
		}.bind(this)};
		io.wrappedJSObject = io;
		io.isNote = this.isNote;
		this.window = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
			.getService(Components.interfaces.nsIWindowWatcher)
			.openWindow(null, 'chrome://zotero/content/integration/progressBar.xhtml', '', options, io);
		Zotero.Utilities.Internal.activate(this.window);
	}
	async hide(fast=false) {
		if (this.dontDisplay || !this.window) return;
		if (!fast) {
			this.onProgress && this.onProgress(100);
			this.onProgress = null;
			await Zotero.Promise.delay(300);
		}
		this.window.close();
	}
}

Zotero.Integration.LegacyPluginWrapper = function(application) {
	return {
		getDocument:
			async function() {
				return Zotero.Integration.LegacyPluginWrapper.wrapDocument(
					application.getDocument.apply(application, arguments))
			},
		getActiveDocument:
			async function() {
				return Zotero.Integration.LegacyPluginWrapper.wrapDocument(
					application.getActiveDocument.apply(application, arguments))
			},
		primaryFieldType: application.primaryFieldType,
		secondaryFieldType: application.secondaryFieldType,
		outputFormat: 'rtf',
		supportedNotes: ['footnotes', 'endnotes'],
		processorName: ''
	}
}
Zotero.Integration.LegacyPluginWrapper.wrapField = function (field) {
	var wrapped = {rawField: field};
	var fns = ['getNoteIndex', 'setCode', 'getCode', 'setText',
		'getText', 'removeCode', 'delete', 'select'];
	for (let fn of fns) {
		wrapped[fn] = async function() {
			return field[fn].apply(field, arguments);
		}
	}
	wrapped.equals = async function(other) {
		return field.equals(other.rawField);
	}
	return wrapped;
}
Zotero.Integration.LegacyPluginWrapper.wrapDocument = function wrapDocument(doc) {
	var wrapped = {};
	var fns = ['complete', 'cleanup', 'setBibliographyStyle', 'setDocumentData',
		'getDocumentData', 'canInsertField', 'activate', 'displayAlert'];
	for (let fn of fns) {
		wrapped[fn] = async function() {
			return doc[fn].apply(doc, arguments);
		}
	}
	// Should return an async array
	wrapped.getFields = async function(fieldType, progressCallback) {
		if ('getFieldsAsync' in doc) {
			var deferred = Zotero.Promise.defer();
			var promise = deferred.promise;
			
			var me = this;
			doc.getFieldsAsync(fieldType,
			{"observe":function(subject, topic, data) {
				if(topic === "fields-available") {
					if(progressCallback) {
						try {
							progressCallback(75);
						} catch(e) {
							Zotero.logError(e);
						};
					}
					
					try {
						// Add fields to fields array
						var fieldsEnumerator = subject.QueryInterface(Components.interfaces.nsISimpleEnumerator);
						var fields = [];
						while (fieldsEnumerator.hasMoreElements()) {
							let field = fieldsEnumerator.getNext();
							try {
								fields.push(Zotero.Integration.LegacyPluginWrapper.wrapField(
									field.QueryInterface(Components.interfaces.zoteroIntegrationField)));
							} catch (e) {
								fields.push(Zotero.Integration.LegacyPluginWrapper.wrapField(field));
							}
						}
					} catch(e) {
						deferred.reject(e);
						deferred = null;
						return;
					}
					
					deferred.resolve(fields);
					deferred = null;
				} else if(topic === "fields-progress") {
					if(progressCallback) {
						try {
							progressCallback((data ? parseInt(data, 10)*(3/4) : null));
						} catch(e) {
							Zotero.logError(e);
						};
					}
				} else if(topic === "fields-error") {
					deferred.reject(data);
					deferred = null;
				}
			}, QueryInterface:ChromeUtils.generateQI([Components.interfaces.nsIObserver])});
			return promise;
		} else {
			var result = doc.getFields.apply(doc, arguments);
			var fields = [];
			if (result.hasMoreElements) {
				while (result.hasMoreElements()) {
					fields.push(Zotero.Integration.LegacyPluginWrapper.wrapField(result.getNext()));
					await Zotero.Promise.delay();
				}
			} else {
				fields = result;
			}
			return fields;
		}
	}
	wrapped.insertField = async function() {
		return Zotero.Integration.LegacyPluginWrapper.wrapField(doc.insertField.apply(doc, arguments));
	}
	wrapped.cursorInField = async function() {
		var result = doc.cursorInField.apply(doc, arguments);
		return !result ? result : Zotero.Integration.LegacyPluginWrapper.wrapField(result);
	}
	// Should take an arrayOfFields instead of an enumerator
	wrapped.convert = async function(arrayOfFields) {
		arguments[0] = new Zotero.Integration.JSEnumerator(arrayOfFields.map(f => f.rawField));
		return doc.convert.apply(doc, arguments);
	}
	return wrapped;
}
