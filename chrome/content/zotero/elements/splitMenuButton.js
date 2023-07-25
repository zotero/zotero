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
	 * A split menubutton with a clickable left side and a dropmarker that opens a menu.
	 */
	class SplitMenuButton extends HTMLButtonElement {
		_image = null;
		_label = null;
		
		constructor() {
			super();
			
			this.classList.add('split-menu-button');

			// Pointer events don't reach the button's children, so check mousedown positions manually and open
			// the popup if over the end side of the button
			this.addEventListener('mousedown', (event) => {
				if (this._isEventInDropmarkerBox(event)) {
					Zotero.Utilities.Internal.showNativeElementPopup(this);
				}
			});
			
			this.addEventListener('keydown', (event) => {
				if (event.key == 'ArrowDown' && Zotero.Utilities.Internal.showNativeElementPopup(this)) {
					event.preventDefault();
				}
			});
		}

		connectedCallback() {
			this.append(this.constructor.contentFragment);
			
			// Prevent DOM-attached mouse handlers from running in the dropmarker area
			for (const eventType of ['mousedown', 'mouseup', 'click']) {
				const handler = this.getAttribute('on' + eventType);
				if (!handler) {
					continue;
				}
				this['on' + eventType] = null;
				this.addEventListener(eventType, (event) => {
					if (!this._isEventInDropmarkerBox(event)) {
						eval(handler).bind(this);
					}
				});
			}
		}

		get image() {
			return this.querySelector('[anonid="button-image"]').src;
		}

		set image(value) {
			this.querySelector('[anonid="button-image"]').src = value;
		}

		get label() {
			return this.querySelector('[anonid="button-text"]').textContent;
		}

		set label(value) {
			this.querySelector('[anonid="button-text"]').textContent = value;
		}
		
		static get contentFragment() {
			// Zotero.hiDPI[Suffix] may not have been initialized yet, so calculate it ourselves
			let hiDPISuffix = window.devicePixelRatio > 1 ? '@2x' : '';
			let frag = document.importNode(
				MozXULElement.parseXULToFragment(`
					<html:div anonid="button-image-and-text-box">
						<image anonid="button-image"/>
						<html:span anonid="button-text"/>
					</html:div>
					<html:div anonid="dropmarker-separator"/>
					<html:div anonid="dropmarker-box">
						<image src="chrome://zotero/skin/searchbar-dropmarker${hiDPISuffix}.png" width="7" height="4" class="split-menu-button-dropmarker"/>
					</html:div>
				`),
				true
			);
			Object.defineProperty(this, "dropmarkerFragment", { value: frag });
			return frag;
		}
		
		_isEventInDropmarkerBox(event) {
			let rect = this.querySelector('[anonid="dropmarker-box"]').getBoundingClientRect();
			return !Zotero.rtl && event.clientX >= rect.left || Zotero.rtl && event.clientX <= rect.right
		}
	}

	customElements.define("split-menu-button", SplitMenuButton, {
		extends: "button",
	});
}
