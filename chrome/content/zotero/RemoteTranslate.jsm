/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2023 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org
    
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

var EXPORTED_SYMBOLS = ["RemoteTranslate"];

const { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

ChromeUtils.registerWindowActor("Translation", {
	parent: {
		moduleURI: "chrome://zotero/content/actors/TranslationParent.jsm"
	},
	child: {
		moduleURI: "chrome://zotero/content/actors/TranslationChild.jsm"
	}
});

XPCOMUtils.defineLazyModuleGetters(this, {
	Zotero: "chrome://zotero/content/include.jsm",
	TranslationManager: "chrome://zotero/content/actors/TranslationParent.jsm",
});

class RemoteTranslate {
	_browser = null;

	_id = Zotero.Utilities.randomString();
	
	_translator = null;
	
	_doneHandlers = [];
	
	_wasSuccess = false;
	
	constructor() {
		TranslationManager.add(this._id);
		TranslationManager.setHandler(this._id, 'done', success => this._wasSuccess = success);
	}

	/**
	 * @param {Browser} browser
	 * @return {Promise<void>}
	 */
	async setBrowser(browser) {
		this._browser = browser;
		let actor = this._browser.browsingContext.currentWindowGlobal.getActor("Translation");
		await actor.sendAsyncMessage("initTranslation", {
			schemaJSON: Zotero.File.getResource('resource://zotero/schema/global/schema.json'),
			dateFormatsJSON: Zotero.File.getResource('resource://zotero/schema/dateFormats.json'),
		});
	}
	
	/**
	 * Set a handler on the proxied Zotero.Translate instance.
	 * The handler function is passed this RemoteTranslate as its first argument.
	 *
	 * Supports all Zotero.Translate handlers in addition to newTestDetectionFailed, which can be called from
	 * {@link newTest} if detection fails to confirm the creation of an expected-fail test.
	 *
	 * @param {String} name
	 * @param {Function} handler
	 */
	setHandler(name, handler) {
		// 'done' is triggered from translate()
		if (name == 'done') {
			this._doneHandlers.push(handler);
		}
		else {
			TranslationManager.setHandler(this._id, name, (...args) => handler(this, ...args));
		}
	}

	/**
	 * Clear the handlers for the given type on the proxied Zotero.Translate instance.
	 *
	 * @param {String} name
	 */
	clearHandlers(name) {
		// 'done' is triggered from translate()
		if (name == 'done') {
			this._doneHandlers = [];
		}
		else {
			TranslationManager.clearHandlers(this._id, name);
		}
	}
	
	/**
	 * @param {Zotero.Translators} translatorProvider
	 */
	setTranslatorProvider(translatorProvider) {
		TranslationManager.setTranslatorProvider(this._id, translatorProvider);
	}
	
	/**
	 * Set the translator used by #detect(), #translate(), #runTest(), and #newTest().
	 *
	 * @param {Zotero.Translator} translator
	 */
	setTranslator(translator) {
		this._translator = translator;
	}
	
	/**
	 * Run detection on the browser's current page. Sets the translator that will be used by #translate().
	 *
	 * @return {Promise<Object[] | null>} Resolves to detected translator array (null on error)
	 */
	async detect() {
		let actor = this._browser.browsingContext.currentWindowGlobal.getActor("Translation");
		this._translator = await actor.sendQuery("detect", { translator: this._translator, id: this._id });
		return this._translator;
	}
	
	/**
	 * Run translation on the browser's current page.
	 *
	 * @param {Number | false} [options.libraryID] false to disable saving
	 * @param {Number[]} [options.collections]
	 * @return {Promise<Object[] | null>} Resolves to returned items (null on error)
	 */
	async translate(options = {}) {
		let actor = this._browser.browsingContext.currentWindowGlobal.getActor("Translation");
		let items = null;
		try {
			items = await actor.sendQuery("translate", { translator: this._translator, id: this._id });
			if (options.libraryID !== false) {
				let itemSaver = new Zotero.Translate.ItemSaver({
					libraryID: options.libraryID,
					collections: options.collections,
					attachmentMode: Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD,
					forceTagType: 1,
					referrer: this._browser.currentURI.spec,
					// proxy: unimplemented in the client
				});
				
				// Call itemDone on each completed item
				let itemsDoneCallback = (jsonItems, dbItems) => {
					for (let i = 0; i < jsonItems.length; i++) {
						let jsonItem = jsonItems[i];
						let dbItem = dbItems[i];
						TranslationManager.runHandler(this._id, 'itemDone', dbItem, jsonItem);
					}
				};
				await itemSaver.saveItems(items, () => {}, itemsDoneCallback);
			}
			
			// And call done (saved in #setHandler() above) at the end
			// The Zotero.Translate instance running in the content process has already tried to call done by now,
			// but we prevented it from reaching the caller. Now that we've run ItemSaver#saveItems() on this side,
			// we can pass it through.
			this._callDoneHandlers(this._wasSuccess);
		}
		catch (e) {
			this._callDoneHandlers(false);
			throw e;
		}
		return items;
	}
	
	/**
	 * Run a test on the browser's current page.
	 *
	 * @param {Object} test Test object
	 * @return {Promise<{ test: Object, status: String, message: String } | null>} Null on error
	 */
	runTest(test) {
		let actor = this._browser.browsingContext.currentWindowGlobal.getActor("Translation");
		return actor.sendQuery("runTest", { translator: this._translator, test, id: this._id });
	}

	/**
	 * Create a test on the browser's current page.
	 *
	 * @return {Promise<Object | null>} Resolves to the created test object (null on error)
	 */
	newTest() {
		let actor = this._browser.browsingContext.currentWindowGlobal.getActor("Translation");
		return actor.sendQuery("newTest", { translator: this._translator, id: this._id });
	}

	/**
	 * Must be called to avoid memory leaks.
	 */
	dispose() {
		if (this._id) {
			TranslationManager.remove(this._id);
			this._id = null;
		}
	}
	
	_callDoneHandlers(wasSuccess) {
		for (let doneHandler of this._doneHandlers) {
			try {
				doneHandler(this, wasSuccess);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
	}
}
