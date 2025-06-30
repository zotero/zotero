/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2024 Corporation for Digital Scholarship
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

ChromeUtils.defineESModuleGetters(globalThis, {
	Zotero: "chrome://zotero/content/zotero.mjs",
});

export class BlockingObserver {
	shouldBlock;
	
	_observerAdded = false;
	_ids = new Set();
	
	/**
	 * @param {(uri: nsIURI) => boolean} shouldBlock
	 */
	constructor({ shouldBlock }) {
		this.shouldBlock = shouldBlock;
	}

	register(browser) {
		let id = browser.browserId;
		if (id === 0) {
			throw new Error('BlockingObserver: Browser is not initialized');
		}
		this._ids.add(id);
		if (!this._observerAdded) {
			Services.obs.addObserver(this, 'http-on-modify-request');
			Zotero.debug('BlockingObserver: Added observer');
			this._observerAdded = true;
		}
	}

	unregister(browser) {
		let id = browser.browserId;
		if (id === 0) {
			throw new Error('BlockingObserver: Browser is not initialized');
		}
		this._ids.delete(id);
		if (this._observerAdded && !this._ids.size) {
			Services.obs.removeObserver(this, 'http-on-modify-request');
			Zotero.debug('BlockingObserver: Removed observer');
			this._observerAdded = false;
		}
	}
	
	dispose() {
		if (this._observerAdded) {
			this._ids.clear();
			Services.obs.removeObserver(this, 'http-on-modify-request');
			Zotero.debug('BlockingObserver: Removed observer');
			this._observerAdded = false;
		}
	}

	observe(subject) {
		let channel = subject.QueryInterface(Ci.nsIHttpChannel);
		let id = channel.browserId;
		if (id === 0) {
			return;
		}
		if (this._ids.has(id) && this.shouldBlock(channel.URI)) {
			channel.cancel(Cr.NS_BINDING_ABORTED);
		}
	}
}
