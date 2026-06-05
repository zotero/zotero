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


window.PluginWindow = {

	/**
	 * Initialize the plugin chrome window.
	 *
	 * @param {string} [windowId] - Unique window identifier provided by
	 *     the plugin.  When set, the predefined menubar menus are wired
	 *     to Zotero.MenuManager with targets of the form
	 *     "pluginWindow/<windowId>/menubar/{file,edit,view,window,help}".
	 *     Menus that have registered items are shown automatically.
	 * @param {string} [pluginID] - Plugin ID owning this window. When set,
	 *     the window will close automatically on plugin shutdown.
	 */
	init(windowId, pluginID) {
		let browser = document.getElementById("plugin-browser");

		// Keep the chrome window title in sync with the
		// inner browser's document.title
		browser.addEventListener("DOMTitleChanged", () => {
			document.title = browser.contentDocument?.title || "";
		}, true);

		// Wire predefined menubar popups to MenuManager
		if (windowId) {
			this._setupMenus(windowId);
		}

		if (pluginID) {
			this._setupPluginShutdownClose(pluginID);
		}
	},

	_setupPluginShutdownClose(pluginID) {
		if (this._pluginShutdownObserver) {
			return;
		}

		this._pluginShutdownObserver = {
			shutdown: ({ id }) => {
				if (id === pluginID) {
					window.close();
				}
			}
		};
		Zotero.Plugins.addObserver(this._pluginShutdownObserver);

		window.addEventListener("unload", () => {
			if (!this._pluginShutdownObserver) {
				return;
			}
			Zotero.Plugins.removeObserver(this._pluginShutdownObserver);
			this._pluginShutdownObserver = null;
		}, { once: true });
	},

	_setupMenus(windowId) {
		let menubar = document.getElementById("main-menubar");

		// Menu IDs follow the pattern "menu-{type}"
		for (let menu of menubar.querySelectorAll("menu[id^='menu-']")) {
			let type = menu.id.split("-")[1];
			let target = `pluginWindow/${windowId}/menubar/${type}`;
			let popup = menu.querySelector("menupopup");
			if (!popup) continue;

			popup.addEventListener("popupshowing", (event) => {
				if (event.target !== event.currentTarget) return;
				Zotero.MenuManager.updateMenuPopup(popup, target, { event });
			});

			// Show the menu only if items are registered for this target
			if (Zotero.MenuManager.hasMenus(target)) {
				menu.hidden = false;
			}
		}
	},
};
