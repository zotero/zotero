/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2022 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
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

'use strict';

Services.scriptloader.loadSubScript("resource://zotero/require.js", this);

Services.scriptloader.loadSubScript("chrome://global/content/customElements.js", this);
Services.scriptloader.loadSubScript("chrome://zotero/content/elements/base.js", this);

// Load our custom elements
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/attachmentBox.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/guidancePanel.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/itemBox.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/mergeGroup.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/menulistItemTypes.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/noteEditor.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/notesBox.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/quickSearchTextbox.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/relatedBox.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/shadowAutocompleteInput.js', this);
Services.scriptloader.loadSubScript("chrome://zotero/content/elements/splitMenuButton.js", this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/tagsBox.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/textLink.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/zoteroSearch.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/paneHeader.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/editableText.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/itemPaneSidenav.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/abstractBox.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/collapsibleSection.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/attachmentsBox.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/attachmentRow.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/annotationRow.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/contextNotesList.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/noteRow.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/librariesCollectionsBox.js', this);

{
	// Fix missing property bug that breaks arrow key navigation between <tab>s
	let MozTabPrototype = customElements.get('tab').prototype;
	if (!MozTabPrototype.hasOwnProperty('container')) {
		Object.defineProperty(MozTabPrototype, 'container', {
			get: function () {
				if (this.parentElement && this.parentElement.localName == 'tabs') {
					return this.parentElement;
				}
				else {
					return null;
				}
			}
		});
	}

	// Add MacOS menupopup fade animation to menupopups
	if (Zotero.isMac) {
		let MozMenuPopupPrototype = customElements.get("menupopup").prototype;

		// Initialize the menupopup when it's first opened
		let originalEnsureInitialized = MozMenuPopupPrototype.ensureInitialized;
		MozMenuPopupPrototype.ensureInitialized = function () {
			if (!this._zoteroInitialized) {
				this._zoteroInitialized = true;

				// Following the implementation from https://searchfox.org/mozilla-esr102/source/toolkit/content/widgets/menupopup.js
				let haveCheckableChild = this.querySelector(
					":scope > menuitem:not([hidden]):is([type=checkbox],[type=radio])"
				);
				this.toggleAttribute("needsgutter", haveCheckableChild);

				/**
				 * Add fade animation to the popup
				 * animate="false" will disable the animation
				 * animate="false-once" will disable the animation once, which we use for the
				 *   command event, so that the popup doesn't flicker when the user clicks
				 * animate="open" when the menu is open
				 * animate="cancel" when is menu is hiding
				 */
				if (this.getAttribute("animate") !== "false") {
					this.setAttribute("animate", "open");
				}

				this.addEventListener("popupshowing", (e) => {
					if (this !== e.target) {
						return;
					}
					// Following the implementation from https://searchfox.org/mozilla-esr102/source/toolkit/content/widgets/menupopup.js
					let haveCheckableChild = this.querySelector(
						":scope > menuitem:not([hidden]):is([type=checkbox],[type=radio],[selected],[checked])"
					);
					this.toggleAttribute("needsgutter", haveCheckableChild);
					// Update animate attribute when the popup is shown
					if (this.getAttribute("animate") === "false") {
						return;
					}
					this.setAttribute("animate", "open");
				});
				
				// Update animate attribute when the popup is hiding and trigger the fade out animation
				this.addEventListener("popuphiding", (e) => {
					if (
						this !== e.target
						// Don't animate the popup if it's a submenu
						|| this.parentElement?.parentElement?.localName === "menupopup"
						// open="true" and aria-hidden="true" means it's a native menupopup
						|| (this.getAttribute("open", "true") && this.getAttribute("aria-hidden", "true"))
						|| !this.getAttribute("animate")
						|| ["false", "false-once"].includes(this.getAttribute("animate"))) {
						return;
					}
					e.preventDefault();
					e.stopPropagation();
					this.setAttribute("animate", "cancel");
					// Make the timeout slightly longer than the animation duration (180ms) in _menupopup.scss
					setTimeout(() => {
						this.removeAttribute("animate");
						this.hidePopup();
					}, 200);
				});

				// This event is triggered after clicking the menu and before popuphiding
				// where we control whether the fade out animation should run
				this.addEventListener("command", () => {
					if (this.getAttribute("animate") === "false") {
						return;
					}
					// Disable the fading animation when the popup is closed by clicking
					this.setAttribute("animate", "false-once");
				});
			}
			originalEnsureInitialized.apply(this);
		};
	}
}
