/*
	Copyright © 2026 Rebojar

	This file is part of Zotero.
	Zotero is free software: you can redistribute it and/or modify it under the
	terms of the GNU Affero General Public License as published by the Free
	Software Foundation, either version 3 of the License, or (at your option)
	any later version.

	Zotero is distributed in the hope that it will be useful, but WITHOUT ANY
	WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
	FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for
	more details. You should have received a copy of the license along with
	Zotero. If not, see <https://www.gnu.org/licenses/>.
*/

"use strict";

var ZoteroWindowControls = {
	init() {
		if (!Zotero.isWin || this._bar) return;
		this._bar = document.getElementById('titlebar')
			|| document.getElementById('reader-menubar');
		if (!this._bar) return;
		this._popups = new Set();
		this._listeners = [];
		this._pointerInside = false;
		this._menuActive = false;
		this._bar.classList.add('window-menu-bar');
		for (let item of document.querySelectorAll('.window-controls-menuitem')) {
			item.hidden = false;
		}
		for (let id of ['cmd_toggleFullScreen', 'cmd_toggleMenuBarAutoHide', 'key_toggleFullScreen']) {
			document.getElementById(id).removeAttribute('disabled');
		}
		for (let type of [
			'mouseenter',
			'mouseleave',
			'focusin',
			'focusout',
			'DOMMenuBarActive',
			'DOMMenuBarInactive',
			'contextmenu'
		]) {
			this._listen(this._bar, type);
		}
		for (let type of ['popupshowing', 'popuphidden']) {
			this._listen(document, type, true);
		}
		this._listen(window, 'keydown', true);
		this._listen(window, 'fullscreen');
		this._listen(window, 'unload');
		this._prefObserver = Zotero.Prefs.registerObserver(
			'ui.autoHideMenuBar', () => this._updateAutoHide()
		);
		this._updateAutoHide();
	},

	toggleFullScreen(event) {
		if (!Zotero.isWin || event?.sourceEvent?.repeat) return;
		window.fullScreen = !window.fullScreen;
		this._updateChecks();
	},

	toggleMenuBarAutoHide() {
		Zotero.Prefs.set('ui.autoHideMenuBar', !this._autoHide);
	},

	_listen(target, type, capture = false) {
		target.addEventListener(type, this, capture);
		this._listeners.push([target, type, capture]);
	},

	handleEvent(event) {
		switch (event.type) {
			case 'mouseenter':
				this._pointerInside = true;
				this._reveal();
				break;
			case 'mouseleave':
				this._pointerInside = false;
				this._scheduleHide();
				break;
			case 'focusin':
				this._reveal();
				break;
			case 'focusout':
				this._scheduleHide();
				break;
			case 'DOMMenuBarActive':
				this._menuActive = true;
				this._reveal();
				break;
			case 'DOMMenuBarInactive':
				this._menuActive = false;
				this._scheduleHide();
				break;
			case 'popupshowing':
				if (this._bar.contains(event.target)
						|| event.target.id == 'window-controls-context-menu') {
					this._popups.add(event.target);
					this._reveal();
					this._updateChecks();
				}
				break;
			case 'popuphidden':
				this._popups.delete(event.target);
				this._scheduleHide();
				break;
			case 'contextmenu':
				// Keep popup-specific menus and native window-icon controls intact.
				if (event.target.closest('menupopup, .titlebar-icon, .titlebar-button')) return;
				event.preventDefault();
				event.stopPropagation();
				this._reveal();
				document.getElementById('window-controls-context-menu')
					.openPopupAtScreen(event.screenX, event.screenY, true);
				break;
			case 'keydown':
				if (event.ctrlKey || event.altKey && event.key != 'Alt'
						|| event.metaKey || event.shiftKey) return;
				if (event.key == 'Alt' || event.key == 'F10') {
					// Let Gecko activate the menu after making it visible.
					this._reveal();
					this._scheduleHide();
				}
				else if (event.key == 'F5' && event.repeat) {
					event.preventDefault();
					event.stopImmediatePropagation();
				}
				break;
			case 'fullscreen':
				this._updateChecks();
				break;
			case 'unload':
				this.destroy();
				break;
		}
	},

	_updateAutoHide() {
		this._autoHide = !!Zotero.Prefs.get('ui.autoHideMenuBar');
		this._bar.toggleAttribute('autohide', this._autoHide);
		this._reveal();
		this._updateChecks();
		this._scheduleHide();
	},

	_updateChecks() {
		document.getElementById('cmd_toggleFullScreen')
			.setAttribute('checked', String(window.fullScreen));
		document.getElementById('cmd_toggleMenuBarAutoHide')
			.setAttribute('checked', String(this._autoHide));
	},

	_reveal() {
		clearTimeout(this._hideTimer);
		this._bar.setAttribute('revealed', 'true');
	},

	_scheduleHide() {
		clearTimeout(this._hideTimer);
		if (!this._autoHide) return;
		this._hideTimer = setTimeout(() => {
			if (!this._pointerInside && !this._menuActive && !this._popups.size
					&& !this._bar.contains(document.activeElement)) {
				this._bar.removeAttribute('revealed');
			}
		}, 400);
	},

	destroy() {
		if (!this._bar) return;
		clearTimeout(this._hideTimer);
		Zotero.Prefs.unregisterObserver(this._prefObserver);
		for (let [target, type, capture] of this._listeners) {
			target.removeEventListener(type, this, capture);
		}
		this._listeners = [];
		this._popups.clear();
		this._bar.classList.remove('window-menu-bar');
		this._bar.removeAttribute('autohide');
		this._bar.removeAttribute('revealed');
		this._bar = null;
	}
};

document.addEventListener('DOMContentLoaded', (event) => {
	if (event.target == document) {
		ZoteroWindowControls.init();
	}
}, { once: true });
