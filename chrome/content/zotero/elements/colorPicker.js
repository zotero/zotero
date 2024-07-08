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
	class ColorPicker extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<vbox>
				<html:button class="button">
					<html:span class="button-tile"/>
				</html:button>

				<panel class="panel">
					<html:div class="grid"/>
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
					'#FF6666',
					'#FF8C19',
					'#999999',
					'#5FB236',
					'#009980',
					'#2EA8E5',
					'#576DD9',
					'#A28AE5',
					'#A6507B'
				];
			}
		}

		set colors(colors) {
			this.setAttribute('colors', colors.join(','));
		}
		
		get colorLabels() {
			if (this.hasAttribute('color-labels')) {
				return this.getAttribute('color-labels').split(',').map((label) => {
					let localized;
					try {
						localized = Zotero.getString(label);
					}
					catch (e) {}
					if (!localized || localized == label) {
						return label;
					}
					else {
						return localized;
					}
				});
			}
			else {
				if (this.hasAttribute('colors')) {
					Zotero.debug('WARNING: <color-picker> CE: Set color-labels when setting colors');
				}
				return [
					'general.red',
					'general.orange',
					'general.gray',
					'general.green',
					'general.teal',
					'general.blue',
					'general.purple',
					'general.violet',
					'general.maroon'
				].map(label => Zotero.getString(label));
			}
		}

		set colorLabels(colorLabels) {
			this.setAttribute('color-labels', colorLabels.join(','));
		}

		get cols() {
			return this.getAttribute('cols') || 3;
		}

		set cols(cols) {
			this.setAttribute('cols', cols);
		}
		
		get rows() {
			return Math.ceil(this.colors.length / this.cols);
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
			let button = this.querySelector('.button');

			button.addEventListener('keydown', (event) => {
				if (event.key == ' ' || event.key == 'Enter' || event.key == 'ArrowDown') {
					event.preventDefault();
					this.openPopup(true);
				}
			});

			button.addEventListener('click', () => {
				this.openPopup(false);
			});
		}
		
		openPopup(focus = false) {
			this.buildGrid();

			let button = this.querySelector('.button');
			let panel = this.querySelector('.panel');
			let grid = this.querySelector('.grid');
			grid.style.gridTemplateColumns = `repeat(${this.cols}, ${this.tileWidth}px)`;
			grid.style.gridAutoRows = `${this.tileHeight}px`;

			if (focus) {
				panel.addEventListener('popupshown', () => {
					grid.querySelector('.grid-tile').focus();
				}, { once: true });
			}
			panel.openPopup(button, 'after_start', 0, 0, false, false);
		}
		
		buildGrid() {
			let grid = this.querySelector('.grid');
			grid.innerHTML = '';
			let colors = this.colors;
			let colorLabels = this.colorLabels;
			colors.forEach((color, i) => {
				let tile = document.createElement('button');
				tile.setAttribute('aria-label', colorLabels[i]);
				tile.classList.add('grid-tile');
				// Disable our custom button styling on Windows
				tile.classList.add('btn');
				tile.style.background = color;
				
				tile.addEventListener('click', () => {
					this.color = color;
					this.querySelector('.panel').hidePopup();
				});
				tile.addEventListener('keydown', (event) => {
					switch (event.key) {
						case Zotero.arrowPreviousKey:
							(tile.previousElementSibling || tile.parentElement.lastElementChild).focus();
							break;
						case Zotero.arrowNextKey:
							(tile.nextElementSibling || tile.parentElement.firstElementChild).focus();
							break;
						case 'ArrowUp': {
							let upIndex = (Array.from(tile.parentElement.children).indexOf(tile) - this.cols)
								% (this.rows * this.cols);
							if (upIndex < 0) {
								upIndex += this.rows * this.cols;
							}
							tile.parentElement.children[upIndex].focus();
							break;
						}
						case 'ArrowDown': {
							let downIndex = (Array.from(tile.parentElement.children).indexOf(tile) + this.cols)
								% (this.rows * this.cols);
							tile.parentElement.children[downIndex].focus();
							break;
						}
					}
				});
				
				grid.append(tile);
			});
		}

		static get observedAttributes() {
			return ['color', 'colors', 'cols', 'tileWidth', 'tileHeight'];
		}

		attributeChangedCallback(attrName, oldVal, newVal) {
			if (attrName == 'color') {
				this.querySelector('.button-tile').style.backgroundColor = newVal;
			}
			else if (attrName == 'disabled') {
				this.querySelector('.button').disabled = !!newVal;
			}
		}
	}

	customElements.define("color-picker", ColorPicker);
}
