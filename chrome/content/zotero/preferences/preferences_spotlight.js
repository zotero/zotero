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

Zotero_Preferences.Spotlight = {
	init: function () {
		let section = document.getElementById('zotero-prefpane-advanced-spotlight');
		if (!section) {
			return;
		}
		if (!Zotero.isMac || !Zotero.Spotlight.available) {
			section.hidden = true;
			return;
		}
		section.hidden = false;

		this._buildLibraryList();
		this._wireResultAction();
		this._updateEnabledUI();

		document.getElementById('spotlight-enable').addEventListener(
			'synctopreference', () => this._updateEnabledUI()
		);
		for (let id of ['spotlight-title-template', 'spotlight-description-template', 'spotlight-index-fulltext']) {
			document.getElementById(id).addEventListener(
				'synctopreference', () => this._updateStatus()
			);
		}
	},

	_wireResultAction: function () {
		let menulist = document.getElementById('spotlight-result-action');
		if (!menulist) {
			return;
		}
		menulist.value = Zotero.Prefs.get('spotlight.openOnConfirm') ? 'true' : 'false';
		menulist.addEventListener('command', () => {
			Zotero.Prefs.set('spotlight.openOnConfirm', menulist.value === 'true');
		});
	},

	_updateEnabledUI: async function () {
		let enabled = !!Zotero.Prefs.get('spotlight.enabled');
		let owner = enabled ? await Zotero.Spotlight.getForeignOwner() : null;

		let ownerNotice = document.getElementById('spotlight-owner-notice');
		ownerNotice.hidden = !owner;
		if (owner) {
			document.l10n.setAttributes(
				document.getElementById('spotlight-owner-text'),
				'preferences-spotlight-owner-other',
				{ path: owner.dataDir }
			);
		}

		let showControls = enabled && !owner;
		for (let id of [
			'spotlight-controls',
			'spotlight-libraries-group',
			'spotlight-privacy-group',
			'spotlight-format-group',
			'spotlight-rebuild'
		]) {
			let el = document.getElementById(id);
			if (el) {
				el.hidden = !showControls;
			}
		}
		if (showControls) {
			this._updateStatus();
		}
		else {
			document.getElementById('spotlight-status').hidden = true;
		}
	},

	_updateStatus: function () {
		let status = document.getElementById('spotlight-status');
		if (!status) {
			return;
		}
		if (Zotero.Spotlight.needsReindex()) {
			document.l10n.setAttributes(status, 'preferences-spotlight-reindex-notice');
			status.hidden = false;
		}
		else {
			status.removeAttribute('data-l10n-id');
			status.textContent = '';
			status.hidden = true;
		}
	},

	takeOwnership: async function () {
		let button = document.getElementById('spotlight-take-ownership');
		if (button) {
			button.disabled = true;
		}
		try {
			await Zotero.Spotlight.takeOwnership();
		}
		catch (e) {
			Zotero.logError(e);
		}
		finally {
			if (button) {
				button.disabled = false;
			}
			// Refresh in place so the full controls replace the take-over button.
			await this._updateEnabledUI();
		}
	},

	_excludedLibraries: function () {
		try {
			let raw = Zotero.Prefs.get('spotlight.excludedLibraries');
			let arr = raw ? JSON.parse(raw) : [];
			return Array.isArray(arr) ? arr.map(Number) : [];
		}
		catch {
			return [];
		}
	},

	_buildLibraryList: function () {
		let container = document.getElementById('spotlight-libraries');
		container.textContent = '';

		let excluded = this._excludedLibraries();
		let libraries = Zotero.Libraries.getAll()
			.filter(library => library.libraryType === 'user' || library.libraryType === 'group');

		for (let library of libraries) {
			let checkbox = document.createXULElement('checkbox');
			checkbox.setAttribute('native', 'true');
			checkbox.setAttribute('label', library.name);
			checkbox.checked = !excluded.includes(library.libraryID);
			checkbox.addEventListener('command', () => {
				this._setLibraryIncluded(library.libraryID, checkbox.checked);
			});
			container.appendChild(checkbox);
		}
	},

	_setLibraryIncluded: function (libraryID, included) {
		let excluded = new Set(this._excludedLibraries());
		if (included) {
			excluded.delete(libraryID);
		}
		else {
			excluded.add(libraryID);
		}
		Zotero.Prefs.set('spotlight.excludedLibraries', JSON.stringify([...excluded]));
		this._updateStatus();
	},

	rebuild: async function () {
		let button = document.getElementById('spotlight-rebuild');
		button.disabled = true;
		button.removeAttribute('data-l10n-id');
		button.label = Zotero.getString('general.processing');
		try {
			await Zotero.Spotlight.rebuild();
		}
		catch (e) {
			Zotero.logError(e);
		}
		finally {
			document.l10n.setAttributes(button, 'preferences-spotlight-rebuild');
			button.disabled = false;
			this._updateStatus();
		}
	}
};
