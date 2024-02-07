/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009-2023 Center for History and New Media
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

(() => {
if (Zotero.isMac) {
	return;
}

const WAIT_ALT_KEY = 100;

let menuBar;
let isMenuActive = false;
let accessKeysHidden = false;
let altPressTime = 0;

if (document.readyState === "complete") {
	init();
}
else {
	document.addEventListener('DOMContentLoaded', init);
}

function init(event) {
	if (event.target !== document) return;
	setAccessKeysHidden(true);

	menuBar = document.querySelector("#main-menubar");

	// Submenu accessKey is not loaded until popupshowing event
	menuBar.addEventListener("popupshowing", () => {
		if (accessKeysHidden) {
			setAccessKeysHidden(true);
		}
	});

	window.addEventListener("keyup", (e) => {
		if (e.key === "Alt") {
			altPressTime = new Date().getTime();
		}
	});

	observeMenuActive(menuBar);
}

async function setAccessKeysHidden(hidden = false) {
	accessKeysHidden = hidden;
	if (!hidden) {
		document.querySelectorAll('label[cachedAccessKey]').forEach((label) => {
			label.accessKey = label.getAttribute("cachedAccessKey");
		});
		return;
	}
	document.querySelectorAll('*[accesskey]').forEach((e) => {
		const label = e.querySelector("label");
		if (!label?.accessKey) {
			return;
		}
		label.setAttribute('cachedAccessKey', label.accessKey);
		label.accessKey = "";
	});
}

function observeMenuActive() {
	let observer = new MutationObserver(async () => {
		if (menuBar.querySelector(":scope > menu[_moz-menuactive]")) {
			isMenuActive = true;
			// When alt key is pressed, show access key
			if (accessKeysHidden && (new Date().getTime() - altPressTime < WAIT_ALT_KEY)) {
				setAccessKeysHidden(false);
			}
		}
		else {
			isMenuActive = false;
			tryHideAccessKeys();
		}
	});
	menuBar.querySelectorAll(":scope > menu").forEach((menu) => {
		observer.observe(menu, { attributes: true, attributeFilter: ["_moz-menuactive"] });
	});
	window.addEventListener("unload", () => {
		observer.disconnect();
	});
}

async function tryHideAccessKeys() {
	await Zotero.Promise.delay(WAIT_ALT_KEY);
	if (isMenuActive || accessKeysHidden) {
		return;
	}
	setAccessKeysHidden(true);
}
})();
