/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
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


const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
	ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
});

function _getActor(element) {
	try {
		let global = element.browsingContext?.currentWindowGlobal;
		return global ? global.getActor("ZoteroEmbeddedPluginPage") : null;
	}
	catch {
		return null;
	}
}


/**
 * A message channel between chrome and an embedded plugin page. The page may load
 * out-of-process, so the plugin gets this messenger instead of a live DOM handle.
 * @namespace
 */
const PluginPageChannel = {

	/**
	 * A no-op channel shaped like `create`, for a page with no channel or that
	 * failed to load. Defined here so it can't drift from `create`'s shape.
	 * @returns {{ messenger: object, dispose: function }}
	 */
	empty() {
		return { messenger: null, dispose: () => {} };
	},

	/**
	 * Create a channel for one embedded page (call once the page has loaded, so
	 * the actor is bound to the plugin's own document).
	 * @param {object} options
	 * @param {Element} options.element - The iframe or browser hosting the page
	 * @param {string} options.pluginID - The owning plugin's ID
	 * @param {Function} [options.onHostMessage] - Chrome-side handler for the raw
	 * message payload, for pages the plugin sandbox doesn't hook (e.g. a pref pane)
	 * @returns {{ messenger: object, dispose: function }} - `messenger` is the
	 * plain object handed to the plugin; `dispose` tears the channel down
	 */
	create({ element, pluginID, onHostMessage = null }) {
		let listeners = new Map();
		let disposed = false;

		// Deliver a page message to the chrome side: raw onHostMessage first, then
		// the plugin's sandbox-marshalled listeners
		let deliver = (data) => {
			if (onHostMessage) {
				try {
					onHostMessage(data);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			for (let wrapped of listeners.values()) {
				try {
					wrapped(data);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
		};
		_getActor(element)?.addListener(deliver);

		let isAlive = () => {
			if (disposed) {
				return false;
			}
			try {
				return !Cu.isDeadWrapper(element)
					&& element.isConnected
					&& !!element.browsingContext?.currentWindowGlobal;
			}
			catch {
				return false;
			}
		};

		let sendMessage = (data) => {
			let actor = disposed ? null : _getActor(element);
			if (!actor) {
				return false;
			}
			try {
				actor.send(data);
				return true;
			}
			catch (e) {
				Zotero.logError(e);
				return false;
			}
		};

		let addMessageListener = (fn) => {
			if (typeof fn !== "function" || listeners.has(fn)) {
				return;
			}
			// Wrap so message payloads are marshalled into the plugin scope
			listeners.set(fn, lazy.ScopeVariables.fromScope(fn, pluginID));
		};

		let removeMessageListener = (fn) => {
			listeners.delete(fn);
		};

		let dispose = () => {
			if (disposed) {
				return;
			}
			_getActor(element)?.removeListener(deliver);
			disposed = true;
			listeners.clear();
		};

		// The plain messenger object handed to the caller
		let messenger = {
			sendMessage,
			addMessageListener,
			removeMessageListener,
			isAlive,
		};

		return { messenger, dispose };
	},
};


export { PluginPageChannel };
