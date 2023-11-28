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

// Fix missing property bug that breaks arrow key navigation between <tab>s
{
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

	if (Zotero.isMac) {
		// Monkey-patch the toolbarbutton CE so it shows a native menu popup
		let MozToolbarbuttonPrototype = customElements.get('toolbarbutton').prototype;
		if (MozToolbarbuttonPrototype) {
			let originalRender = MozToolbarbuttonPrototype.render;
			MozToolbarbuttonPrototype.render = function () {
				originalRender.apply(this);
				if (!this._zoteroMouseDownListenerAdded) {
					this.addEventListener('mousedown', (event) => {
						if (!event.defaultPrevented
								&& !this.disabled
								&& this.getAttribute('nonnativepopup') != 'true'
								&& Zotero.Utilities.Internal.showNativeElementPopup(this)) {
							event.preventDefault();
						}
					});
					this._zoteroMouseDownListenerAdded = true;
				}
			};
		}
	}
}
