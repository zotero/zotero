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
	/**
	 * Extends MozButton to provide a split menubutton with a clickable left side and a dropmarker that opens a menu.
	 */
	class SplitMenuButton extends customElements.get('button') {
		constructor() {
			super();

			// Just in case, make sure this button does NOT appear as a standard <button type="menu">
			// We don't want the entire button to open the menu and we don't want the standard dropmarker
			this.removeAttribute('type');
			
			// For easier CSS targeting
			this.classList.add('split-menu-button');

			// Pointer events don't reach the button's children, so check mousedown positions manually and open
			// the popup if over the end side of the button
			this.addEventListener('mousedown', (event) => {
				let rect = this.querySelector('[anonid="dropmarker-box"]').getBoundingClientRect();
				if ((!Zotero.rtl && event.clientX >= rect.left || Zotero.rtl && event.clientX <= rect.right)
						&& Zotero.Utilities.Internal.showNativeElementPopup(this)) {
					event.preventDefault();
				}
			});
			
			this.addEventListener('keydown', (event) => {
				if (event.key == 'ArrowDown' && Zotero.Utilities.Internal.showNativeElementPopup(this)) {
					event.preventDefault();
				}
			});
		}

		connectedCallback() {
			if (this.delayConnectedCallback() || this._hasConnected) {
				return;
			}
			super.connectedCallback();

			this.querySelector('[anonid="button-box"]').after(this.constructor.dropmarkerFragment);
		}

		static get dropmarkerFragment() {
			// Zotero.hiDPI[Suffix] may not have been initialized yet, so calculate it ourselves
			let hiDPISuffix = window.devicePixelRatio > 1 ? '@2x' : '';
			let frag = document.importNode(
				MozXULElement.parseXULToFragment(`
					<vbox>
						<box anonid="dropmarker-separator"/>
					</vbox>
					<hbox align="center" anonid="dropmarker-box">
						<image src="chrome://zotero/skin/searchbar-dropmarker${hiDPISuffix}.png" width="7" height="4" class="split-menu-button-dropmarker"/>
					</hbox>
				`),
				true
			);
			Object.defineProperty(this, "dropmarkerFragment", { value: frag });
			return frag;
		}

		_handleClick() {
			super._handleClick();
			let popup = this.querySelector(':scope > menupopup');
			if (!this.disabled && (!popup || popup.state == 'closed')) {
				this.doCommand();
			}
		}
	}

	customElements.define("split-menu-button", SplitMenuButton, {
		extends: "button",
	});
}
