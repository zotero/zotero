/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
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
	class Sticky extends XULElementBase {
		get scrollParent() {
			return this._scrollParent;
		}
		
		set scrollParent(scrollParent) {
			if (scrollParent === this._scrollParent) {
				return;
			}
			
			if (this._scrollParent) {
				this._scrollParent.removeEventListener('scroll', this._handleScroll);
			}
			this._scrollParent = scrollParent;
			if (scrollParent) {
				scrollParent.addEventListener('scroll', this._handleScroll);
				this._resizeObserver.disconnect();
				this._resizeObserver.observe(scrollParent);
				this._handleScroll();
			}
		}
		
		get box() {
			return this.querySelector(':scope > :not(.replacement)');
		}
		
		get stuck() {
			return this.classList.contains('stuck');
		}
		
		set stuck(stuck) {
			stuck = !!stuck;
			if (this.stuck === stuck) return;

			if (stuck) {
				let height = `${this._getBoxHeight()}px`;
				this.classList.add('stuck');
				this._replacement.hidden = false;
				this._replacement.style.height = height;
				this.box.style.setProperty('--full-height', height);
			}
			else {
				this.classList.remove('stuck');
				this._replacement.hidden = true;
				this._replacement.style.height = '';
				this.box.style.removeProperty('--full-height');
			}
		}
		
		init() {
			let replacement = document.createElement('div');
			replacement.classList.add('replacement');
			replacement.hidden = true;
			this._replacement = replacement;
			this.append(replacement);
			
			this._resizeObserver = new ResizeObserver(() => {
				this.style.setProperty('--scroll-parent-height', this.scrollParent.clientHeight + 'px');
			});

			// An element with position: fixed will eat wheel events, so dispatch them
			// to the parent manually
			this.addEventListener('wheel', (event) => {
				this.parentElement.dispatchEvent(new WheelEvent('wheel', event));
			});
		}
		
		destroy() {
			if (this._scrollParent) {
				this._scrollParent.removeEventListener('scroll', this._handleScroll);
			}
			this._resizeObserver.disconnect();
		}

		invalidate() {
			let height = this._getBoxHeight();
			this._replacement.style.height = height + 'px';
			this.box.style.setProperty('--full-height', height + 'px');
			this._handleScroll();
		}
		
		_handleScroll = (event) => {
			let scrollParent = this._scrollParent;
			let box = this.box;
			let replacement = this._replacement;

			if (event && event.target !== this.scrollParent) {
				box.style.removeProperty('--full-height');
				box.style.removeProperty('--scroll-top');
				event.target.removeEventListener('scroll', this._handleScroll);
				return;
			}
			
			if (!scrollParent || !box) {
				this.stuck = false;
				return;
			}
			
			let basis = replacement.hidden ? box : replacement;
			let basisRect = basis.getBoundingClientRect();
			let scrollParentRect = scrollParent.getBoundingClientRect();
			this.stuck = basisRect.top <= scrollParentRect.top;
			box.style.setProperty('--scroll-top', (scrollParent.scrollTop - replacement.offsetTop) + 'px');
			box.style.setProperty('--scrollbar-width', scrollParent.offsetWidth - scrollParent.clientWidth + 'px');
		};

		/**
		 * Simulate the height of the box at the specified scrollTop.
		 *
		 * @param {number} scrollTop
		 * @returns {number} Height of the box at that position
		 */
		getBoxHeightAtPosition(scrollTop) {
			if (!this.box || !this.scrollParent) {
				return 0;
			}
			
			// Save properties
			let oldStuck = this.classList.contains('stuck');
			let oldScrollTop = this.box.style.getPropertyValue('--scroll-top');
			let oldFullHeight = this.box.style.getPropertyValue('--full-height');
			
			// Set properties to simulated values
			this.classList.toggle('stuck', true);
			this.box.style.setProperty('--scroll-top', (scrollTop - this._replacement.offsetTop) + 'px');
			this.box.style.setProperty('--scrollbar-width', this.scrollParent.offsetWidth - this.scrollParent.clientWidth + 'px');
			this.box.style.setProperty('--full-height', this._replacement.style.height);
			
			// Force reflow
			// eslint-disable-next-line no-void
			void getComputedStyle(this.box).height;
			
			let height = this.box.clientHeight;
			
			// Restore properties
			this.classList.toggle('stuck', oldStuck);
			this.box.style.setProperty('--scroll-top', oldScrollTop);
			this.box.style.setProperty('--full-height', oldFullHeight);
			
			return height;
		}

		_getBoxHeight() {
			// Save properties
			let oldStuck = this.classList.contains('stuck');
			let oldScrollTop = this.box.style.getPropertyValue('--scroll-top');

			// Set properties to simulated values
			this.classList.toggle('stuck', false);
			this.box.style.setProperty('--scroll-top', '0px');

			// Force reflow
			// eslint-disable-next-line no-void
			void getComputedStyle(this.box).height;
			let height = this.box.clientHeight;
			
			// Restore properties
			this.classList.toggle('stuck', oldStuck);
			this.box.style.setProperty('--scroll-top', oldScrollTop);
			
			return height;
		}
	}

	customElements.define("sticky", Sticky);
}
