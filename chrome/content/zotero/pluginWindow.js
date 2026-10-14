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
	 * @param {string} [name] - Name for this kind of window, unique within the plugin; the <name> in
	 *     "pluginWindow/<name>/menubar/{file,edit,view,window,help}" and "pluginWindow/<name>/context"
	 * @param {string} [pluginID] - Plugin ID owning this window. When set, the window closes
	 *     on plugin shutdown and Zotero.WindowController lists it as the plugin's own
	 */
	init(name, pluginID) {
		let browser = document.getElementById("plugin-browser");

		browser.docShell.windowDraggingAllowed = true;

		let rawArgs = window.arguments && window.arguments[0];
		let args = rawArgs && (rawArgs.wrappedJSObject || rawArgs) || {};
		let notitle = !!args.notitle;
		if (notitle) {
			let bar = document.getElementById("titlebar");
			if (bar) bar.hidden = true;
		}

		// Keep the chrome window title in sync with the
		// inner browser's document.title
		browser.addEventListener("DOMTitleChanged", () => {
			document.title = browser.contentDocument?.title || "";
		}, true);

		if (name) {
			if (!notitle) {
				this._setupMenus(name, pluginID);
			}
			this._setupContextMenu(name, pluginID);
		}

		if (pluginID) {
			// Read by plugins/window.mjs to keep other plugins from seeing this window
			document.documentElement.setAttribute("data-plugin-id", pluginID);
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

	_setupMenus(name, pluginID) {
		let menubar = document.getElementById("main-menubar");

		// Menu IDs follow the pattern "menu-{type}"
		for (let menu of menubar.querySelectorAll("menu[id^='menu-']")) {
			let type = menu.id.split("-")[1];
			let target = `pluginWindow/${name}/menubar/${type}`;
			let popup = menu.querySelector("menupopup");
			if (!popup) continue;

			popup.addEventListener("popupshowing", (event) => {
				if (event.target !== event.currentTarget) return;
				Zotero.MenuManager.updateMenuPopup(popup, target, { event, pluginID });
			});

			// Show the menu only if items are registered for this target
			if (Zotero.MenuManager.hasMenus(target, pluginID)) {
				menu.hidden = false;
			}
		}
	},

	_setupContextMenu(name, pluginID) {
		let popup = document.getElementById("pluginContentContextMenu");
		if (!popup) return;
		let target = `pluginWindow/${name}/context`;

		popup.addEventListener("popupshowing", (event) => {
			if (event.target !== event.currentTarget) return;
			Zotero.MenuManager.updateMenuPopup(popup, target, { event, pluginID });
		});
	},
};
