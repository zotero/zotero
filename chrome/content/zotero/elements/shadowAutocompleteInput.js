/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2022 Corporation for Digital Scholarship
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

"use strict";

{
	// The autocomplete-input CE is defined lazily. Create one now to get
	// autocomplete-input defined, allowing us to inherit from it.
	if (!customElements.get("autocomplete-input")) {
		delete document.createXULElement("autocomplete-input");
	}

	/**
	 * Extend AutocompleteInput to work around issues with shadow DOM
	 */
	class ShadowAutocompleteInput extends customElements.get('autocomplete-input') {
		// Fix document.activeElement checks that don't work in a shadow DOM context
		get focused() {
			// document.activeElement by itself doesn't traverse shadow DOMs; see
			// https://www.abeautifulsite.net/posts/finding-the-active-element-in-a-shadow-root/
			function activeElement(root) {
				let activeHere = root.activeElement;

				if (activeHere?.shadowRoot) {
					return activeElement(activeHere.shadowRoot);
				}
				else {
					return activeHere;
				}
			}

			return this === activeElement(document);
		}

		// Look for `autocompletepopup` popup id inside the current shadow root.
		// `autocomplete-input` itself can create an autocomplete popup inside the top DOM,
		// but it appears behind the tagsBox popup, because the z order of popups messes up
		get popup() {
			let rootNode = this.getRootNode();
			if (rootNode && rootNode instanceof ShadowRoot) {
				let id = this.getAttribute('autocompletepopup');
				let popup = rootNode.getElementById(id);
				if (popup) {
					return popup;
				}
			}
			return super.popup;
		}
	}

	customElements.define("shadow-autocomplete-input", ShadowAutocompleteInput, {
		extends: "input",
	});
}
