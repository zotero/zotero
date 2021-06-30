/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2021 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://digitalscholar.org

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

"use strict";

// eslint-disable-next-line camelcase, no-unused-vars
var Zotero_Dictionary_Manager = new function () {
	const HTML_NS = 'http://www.w3.org/1999/xhtml';
	
	var installed;
	var updateMap;
	
	this.init = async function () {
		document.title = Zotero.getString('spellCheck.dictionaryManager.title');
		
		installed = new Set(Zotero.Dictionaries.dictionaries.map(d => d.id));
		var installedLocales = new Set(Zotero.Dictionaries.dictionaries.map(d => d.locale));
		var availableDictionaries = await Zotero.Dictionaries.fetchDictionariesList();
		var availableUpdates = await Zotero.Dictionaries.getAvailableUpdates(availableDictionaries);
		updateMap = new Map(availableUpdates.map(x => [x.old.id, { id: x.new.id, version: x.new.version }]));
		
		var { InlineSpellChecker } = ChromeUtils.import("resource://gre/modules/InlineSpellChecker.jsm", {});
		var isc = new InlineSpellChecker();
		
		// Start with installed dictionaries
		var list = [];
		for (let d of Zotero.Dictionaries.dictionaries) {
			let name = Zotero.Dictionaries.getBestDictionaryName(d.locale, isc);
			list.push(Object.assign({}, d, { name }));
		}
		// Add remote dictionaries not in the list
		for (let d of availableDictionaries) {
			if (!installed.has(d.id) && !installedLocales.has(d.locale)) {
				list.push(d);
			}
		}
		var positionMap = new Map(availableDictionaries.map((d, i) => [d.locale, i + 1]));
		list.sort((a, b) => {
			// If both locales are in original list, use the original sort order
			let posA = positionMap.get(a.locale);
			let posB = positionMap.get(b.locale);
			if (posA && posB) {
				return posA - posB;
			}
			// Otherwise compare the locale codes
			return Zotero.localeCompare(a.locale, b.locale);
		});
		
		// Build list
		var listbox = document.getElementById('dictionaries');
		for (let d of list) {
			let name = d.name;
			let li = document.createElement('richlistitem');
			let div = document.createElementNS(HTML_NS, 'div');
			
			let checkbox = document.createElementNS(HTML_NS, 'input');
			checkbox.type = 'checkbox';
			checkbox.id = d.locale;
			// Store properties on element
			// .id will be the current id for installed dictionaries and otherwise the remote id
			checkbox.dataset.dictId = d.id;
			checkbox.dataset.dictLocale = d.locale;
			checkbox.dataset.dictName = d.name;
			checkbox.dataset.dictVersion = d.version;
			// en-US is always checked and disabled
			checkbox.checked = d.locale == 'en-US' || installed.has(d.id);
			if (d.locale == 'en-US') {
				checkbox.disabled = true;
			}
			checkbox.setAttribute('tabindex', -1);
			
			let label = document.createElementNS(HTML_NS, 'label');
			label.setAttribute('for', d.locale);
			// Add " (update available)"
			if (updateMap.has(d.id)) {
				name = Zotero.getString('spellCheck.dictionaryManager.updateAvailable', name);
			}
			label.textContent = name;
			// Don't toggle checkbox for single-click on label
			label.onclick = (event) => {
				if (event.detail == 1) {
					event.preventDefault();
				}
			};
			
			div.appendChild(checkbox);
			div.appendChild(label);
			li.appendChild(div);
			listbox.appendChild(li);
		}
		listbox.selectedIndex = 0;
	};
	
	this.handleAccept = async function () {
		// Download selected dictionaries if updated or not currently installed
		var elems = document.querySelectorAll('input[type=checkbox]');
		var toRemove = [];
		var toDownload = [];
		for (let elem of elems) {
			if (elem.dataset.dictLocale == 'en-US') {
				continue;
			}
			
			let id = elem.dataset.dictId;
			if (!elem.checked) {
				if (installed.has(id)) {
					toRemove.push(id);
				}
				continue;
			}
			
			if (updateMap.has(id)) {
				// If id is changing, delete the old one first
				toRemove.push(id);
				toDownload.push({
					id: updateMap.get(id).id,
					name: elem.dataset.dictName,
					version: updateMap.get(id).version
				});
			}
			else if (!installed.has(id)) {
				toDownload.push({
					id,
					name: elem.dataset.dictName,
					version: elem.dataset.dictVersion
				});
			}
		}
		if (toRemove.length) {
			for (let id of toRemove) {
				await Zotero.Dictionaries.remove(id);
			}
		}
		if (toDownload.length) {
			for (let { id, name, version } of toDownload) {
				_updateStatus(Zotero.getString('general.downloading.quoted', name));
				try {
					await Zotero.Dictionaries.install(id, version);
				}
				catch (e) {
					Zotero.logError(e);
					Zotero.alert(
						null,
						Zotero.getString('general.error'),
						Zotero.getString('spellCheck.dictionaryManager.error.unableToInstall', name)
							+ "\n\n" + (e.message ? (e.message + "\n\n" + e.stack) : e)
					);
					return;
				}
				finally {
					_updateStatus();
				}
			}
		}
		window.close();
	};
	
	function _updateStatus(msg) {
		var elem = document.getElementById('status');
		elem.textContent = msg
			// Use non-breaking space to maintain height when empty
			|| '\xA0';
	}
};

window.addEventListener('keypress', function (event) {
	// Toggle checkbox on spacebar
	if (event.key == ' ') {
		if (event.target.localName == 'richlistbox') {
			let elem = event.target.selectedItem.querySelector('input[type=checkbox]');
			if (!elem.disabled) {
				elem.checked = !elem.checked;
			}
		}
	}
	
	if (event.key == 'Enter') {
		document.querySelector('button[dlgtype="accept"]').click();
	}
});
