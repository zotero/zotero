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
		get scrollParentSelector() {
			return this.getAttribute('scroll-parent') || '.zotero-view-item';
		}
		
		set scrollParentSelector(selector) {
			this.setAttribute('scroll-parent', selector);
		}
		
		get scrollParent() {
			return this.closest(this.scrollParentSelector);
		}
		
		get box() {
			return this.querySelector(':scope > :not(.replacement)');
		}
		
		init() {
			let replacement = document.createElement('div');
			replacement.classList.add('replacement');
			replacement.hidden = true;
			this._replacement = replacement;
			this.append(replacement);
			
			this._intersectionObserver = new IntersectionObserver(this._handleIntersection, { threshold: 1 });
			this._resizeObserver = new ResizeObserver(this._handleResize);

			// Attach the observers now, and reattach them if the child is added/replaced
			this._attachObservers();
			new MutationObserver(() => this._attachObservers())
				.observe(this, { childList: true });

			// An element with position: fixed will eat wheel events, so dispatch them
			// to the parent manually
			this.addEventListener('wheel', (event) => {
				this.parentElement.dispatchEvent(new WheelEvent('wheel', event));
			});
		}
		
		_attachObservers() {
			this._intersectionObserver.disconnect();
			this._resizeObserver.disconnect();
			
			this._intersectionObserver.observe(this._replacement);
			if (this.box) {
				this._intersectionObserver.observe(this.box);
				this._resizeObserver.observe(this.box);
			}
			if (this.scrollParent) {
				this._resizeObserver.observe(this.scrollParent);
			}
			this._handleResize();
		}

		_handleIntersection = (entries) => {
			let scrollParent = this.scrollParent;
			let box = this.box;

			for (let { target, intersectionRatio } of entries) {
				// Only pay attention to the replacement when stuck and the box when not stuck
				if (target !== (this.classList.contains('stuck') ? this._replacement : this.box)) {
					continue;
				}

				let stuck = scrollParent && box
					&& box.getBoundingClientRect().top <= scrollParent.getBoundingClientRect().top
					&& intersectionRatio < 1;
				this._setStuck(stuck);
			}
		};

		_handleResize = () => {
			this.classList.toggle('long',
				this.box && this.scrollParent && this.box.offsetHeight > this.scrollParent.offsetHeight);
		};

		_handleScroll = (event) => {
			if (event && (event.target !== this.scrollParent || !this.classList.contains('stuck'))) {
				this.box.style.removeProperty('--full-height');
				this.box.style.removeProperty('--scroll-distance');
				event.target.removeEventListener('scroll', this._handleScroll);
				return;
			}
			let scrollDistance = this.scrollParent.scrollTop - this._replacement.offsetTop;
			this.box.style.setProperty('--full-height', this._replacement.style.height);
			this.box.style.setProperty('--scroll-distance', scrollDistance + 'px');
			this.box.style.setProperty('--scrollbar-width', this.scrollParent.offsetWidth - this.scrollParent.clientWidth + 'px');
		};

		_setStuck(stuck) {
			this.classList.toggle('stuck', stuck);
			this._replacement.hidden = !stuck;
			if (stuck) {
				this._replacement.style.height = `${this.box.offsetHeight || this.box.getBoundingClientRect().height}px`;
				this.scrollParent.addEventListener('scroll', this._handleScroll);
				this._handleScroll();
			}
		}
	}

	customElements.define("sticky", Sticky);
}
