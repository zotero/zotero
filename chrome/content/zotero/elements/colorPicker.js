/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2020 Corporation for Digital Scholarship
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
	var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

	Services.scriptloader.loadSubScript("chrome://zotero/content/elements/base.js", this);

	class ColorPicker extends XULElementBase {
		stylesheets = ['chrome://global/skin/', 'chrome://zotero-platform/content/colorPicker.css'];

		content = MozXULElement.parseXULToFragment(`
			<vbox>
				<html:button id="button">
					<html:span id="button-tile"/>
				</html:button>

				<panel id="panel">
					<html:div id="grid"/>
				</panel>
			</vbox>
		`);

		get color() {
			return this.getAttribute('color') || '#000000';
		}

		set color(color) {
			this.setAttribute('color', color);
		}

		get colors() {
			if (this.hasAttribute('colors')) {
				return this.getAttribute('colors').split(',');
			}
			else {
				return [
					'#FF6666', '#FF8C19', '#999999',
					'#5FB236', '#009980', '#2EA8E5',
					'#576DD9', '#A28AE5', '#A6507B'
				];
			}
		}

		set colors(colors) {
			this.setAttribute('colors', colors.join(','));
		}

		get cols() {
			return this.getAttribute('cols') || 3;
		}

		set cols(cols) {
			this.setAttribute('cols', cols);
		}

		get tileWidth() {
			return this.getAttribute('tileWidth') || 24;
		}

		set tileWidth(width) {
			this.setAttribute('tileWidth', width);
		}

		get tileHeight() {
			return this.getAttribute('tileHeight') || 24;
		}

		set tileHeight(height) {
			this.setAttribute('tileHeight', height);
		}

		get disabled() {
			return this.hasAttribute('disabled');
		}

		set disabled(disabled) {
			this.toggleAttribute(disabled, !!disabled);
		}

		init() {
			let button = this.shadowRoot.getElementById('button');
			let panel = this.shadowRoot.getElementById('panel');
			let grid = this.shadowRoot.getElementById('grid');

			button.addEventListener('click', () => {
				grid.style.gridTemplateColumns = `repeat(${this.cols}, ${this.tileWidth}px)`;
				grid.style.gridAutoRows = `${this.tileHeight}px`;
				panel.openPopup(button, 'after_start', 0, 0, false, false);
			});
		}

		static get observedAttributes() {
			return ['color', 'colors', 'cols', 'tileWidth', 'tileHeight'];
		}

		attributeChangedCallback(attrName, oldVal, newVal) {
			if (attrName == 'color') {
				this.shadowRoot.getElementById('button-tile').style.backgroundColor = newVal;
			}
			else if (attrName == 'colors') {
				let grid = this.shadowRoot.getElementById('grid');
				grid.innerHTML = '';
				for (let color of newVal.split(',')) {
					let tile = document.createElement('div');
					tile.classList.add('grid-tile');
					tile.style.backgroundColor = color;
					tile.addEventListener('click', () => {
						this.color = color;
						this.shadowRoot.getElementById('panel').hidePopup();
					});
					grid.append(tile);
				}
			}
			else if (attrName == 'disabled') {
				this.shadowRoot.getElementById('button').disabled = !!newVal;
			}
		}
	}

	customElements.define("color-picker", ColorPicker);
}
