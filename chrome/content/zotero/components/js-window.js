/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2019 Corporation for Digital Scholarship
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

const requiredOptions = ['getItemCount', 'itemHeight', 'renderItem', 'targetElement'];

/**
 * A windowed list for performant display of an essentially infinite number of items
 * Inspired by https://github.com/bvaughn/react-window
 *
 * The main principle here is to display a div with a height set to itemHeight * getItemCount()
 * and only render rows visible in the scrollbox area, unloading them and rendering new ones
 * as needed.
 *
 * This was created after the measured performance of react-window was not satisfactory
 * for a 100% fluid experience, especially once rows with multiple cells that needed
 * responsive resizing were introduced
 *
 * The class requires careful handholding to achieve good performance. Read method documentation!
 */
module.exports = class {
	/**
	 * @param options (required):
	 * 	- getItemCount {Function} a function that returns the number of items currently on display
	 * 	- renderItem {Function} a function that returns a DOM element for an individual row to display
	 * 	- itemHeight {Integer}
	 * 	- targetElement {DOMElement} a container DOM element for the js-window
	 */
	constructor(options) {
		for (let option of requiredOptions) {
			if (!options.hasOwnProperty(option)) {
				throw new Error('Attempted to initialize js-window without a required option: ' + option);
			}
		}
		
		this.scrollDirection = 0;
		this.scrollOffset = 0;
		this.overscanCount = 6;
		this._lastItemCount = null;
		
		Object.assign(this, options);
		this._renderedRows = new Map();
	}

	/**
	 * Call once to add the js-window DOM element to the container
	 */
	initialize() {
		const { targetElement } = this;
		this.innerElem = document.createElementNS("http://www.w3.org/1999/xhtml", 'div');
		this.innerElem.className = "js-window";

		targetElement.appendChild(this.innerElem);
		targetElement.addEventListener('scroll', this._handleScroll);
		
		this.update();
	}

	/**
	 * Call to remove the js-window from the container
	 */
	destroy() {
		if (this.innerElem) {
			this.targetElement.removeEventListener('scroll', this._handleScroll);
			this.targetElement.removeChild(this.innerElem);
		}
	}

	/**
	 * Rerender an individual item. A no-op if the item is not in view
	 * @param index {Integer}
	 */
	rerenderItem(index) {
		if (!this._renderedRows.has(index)) return;
		let oldElem = this._renderedRows.get(index);
		let elem = this.renderItem(index, oldElem);
		elem.style.top = this._getItemPosition(index) + "px";
		elem.style.position = "absolute";
		if (elem == oldElem) return;
		this.innerElem.replaceChild(elem, this._renderedRows.get(index));
		this._renderedRows.set(index, elem);
	}

	/**
	 * Rerender items within the scrollbox. Call sparingly
	 */
	invalidate() {
		// Removes any items out of view and adds the ones not in view
		this.render();
		// Rerender the rest
		for (let index of Array.from(this._renderedRows.keys())) {
			this.rerenderItem(index);
		}
	}

	/**
	 * Render all items within the scrollbox and remove those no longer visible
	 */
	render() {
		const {
			renderItem,
			innerElem,
		} = this;

		const [startIndex, stopIndex] = this._getRangeToRender();

		if (stopIndex - startIndex > 0) {
			for (let index = startIndex; index < stopIndex; index++) {
				if (this._renderedRows.has(index)) continue;
				let elem = renderItem(index);
				elem.style.top = this._getItemPosition(index) + "px";
				elem.style.position = "absolute";
				innerElem.appendChild(elem);
				this._renderedRows.set(index, elem);
			}
		}
		for (let [index, elem] of this._renderedRows.entries()) {
			if (index < startIndex || index >= stopIndex) {
				elem.remove();
				this._renderedRows.delete(index);
			}
		}
	}

	/**
	 * Use to update constructor params
	 * @param options (see constructor())
	 */
	update(options = {}) {
		Object.assign(this, options);
		const { itemHeight, targetElement, innerElem } = this;
		const itemCount = this._getItemCount();
		innerElem.style.position = 'relative';
		innerElem.style.height = `${itemHeight * itemCount}px`;

		this.scrollDirection = 0;
		this.scrollOffset = targetElement.scrollTop;
	}

	/**
	 * Scroll the top of the scrollbox to a specified location
	 * @param scrollOffset {Integer} offset for the top of the tree
	 */
	scrollTo(scrollOffset) {
		scrollOffset = Math.max(0, scrollOffset);
		this.scrollOffset = scrollOffset;
		this.targetElement.scrollTop = scrollOffset;
		this.render();
	}

	/**
	 * Scroll the scrollbox to a specified item. No-op if already in view
	 * @param index
	 */
	scrollToRow(index) {
		const { itemHeight, scrollOffset } = this;
		const itemCount = this._getItemCount();
		const height = this.getWindowHeight();

		index = Math.max(0, Math.min(index, itemCount - 1));
		let startPosition = this._getItemPosition(index);
		let endPosition = startPosition + itemHeight;
		if (startPosition < scrollOffset) {
			this.scrollTo(startPosition);
		}
		else if (endPosition > scrollOffset + height) {
			this.scrollTo(Math.min(endPosition - height, (itemCount * itemHeight) - height));
		}
	}
	
	getFirstVisibleRow() {
		return Math.ceil(this.scrollOffset / this.itemHeight);
	}
	
	getLastVisibleRow() {
		const height = this.getWindowHeight();
		return Math.max(1, Math.floor((this.scrollOffset + height + 1) / this.itemHeight)) - 1;
	}
	
	getWindowHeight() {
		return this.targetElement.getBoundingClientRect().height;
	}
	
	getIndexByMouseEventPosition = (yOffset) => {
		return Math.min(this._getItemCount()-1, Math.floor((yOffset - this.innerElem.getBoundingClientRect().top) / this.itemHeight));
	}
	
	getElementByIndex = index => this._renderedRows.get(index);

	/**
	 * @returns {Integer} - the number of fully visible items in the scrollbox
	 */
	getPageLength() {
		const height = this.getWindowHeight();
		return Math.ceil(height / this.itemHeight);
	}

	_getItemPosition = (index) => {
		return (this.itemHeight * index);
	};
	
	_getRangeToRender() {
		const { itemHeight, overscanCount, scrollDirection, scrollOffset } = this;
		const itemCount = this._getItemCount();
		const height =  this.getWindowHeight();

		if (itemCount === 0) {
			return [0, 0, 0, 0];
		}

		const startIndex = Math.floor(scrollOffset / itemHeight);
		const stopIndex = Math.ceil((scrollOffset + height) / itemHeight + 1);

		// Overscan by one item in each direction so that tab/focus works.
		// If there isn't at least one extra item, tab loops back around.
		const overscanBackward =
			!scrollDirection || scrollDirection === -1
				? Math.max(1, overscanCount)
				: 1;
		const overscanForward =
			!scrollDirection || scrollDirection === 1
				? Math.max(1, overscanCount)
				: 1;

		return [
			Math.max(0, startIndex - overscanBackward),
			Math.max(0, Math.min(itemCount, stopIndex + overscanForward)),
			startIndex,
			stopIndex,
		];
	}
	
	_getItemCount() {
		const itemCount = this.getItemCount();
		if (this._lastItemCount != itemCount) {
			this._lastItemCount = itemCount;
			this.update();
			this.invalidate();
		}
		return this._lastItemCount;
	}
	
	_handleScroll = (event) => {
		const { scrollOffset: prevScrollOffset } = this;
		const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
		
		if (prevScrollOffset === scrollTop) {
			// Scroll position may have been updated by cDM/cDU,
			// In which case we don't need to trigger another render,
			// And we don't want to update anything.
			return;
		}

		// Prevent macOS elastic scrolling from causing visual shaking when scrolling past bounds.
		const scrollOffset = Math.max(
			0,
			Math.min(scrollTop, scrollHeight - clientHeight)
		);

		this.scrollDirection = prevScrollOffset < scrollOffset ? 1 : -1;
		this.scrollOffset = scrollOffset;
		this._resetScrollDirection();
		this.render();
	};

	_resetScrollDirection = Zotero.Utilities.debounce(() => this.scrollDirection = 0, 150);
};
