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
	 * 	- targetElement {DOMElement} a container DOM element for the windowed-list
	 * 	- customRowHeights {Array|optional} a sorted array of tuples [itemIndex, rowHeight]
	 */
	constructor(options) {
		this.getItemCount = () => 0;
		this.renderItem = () => 0;
		this.itemHeight = 0;
		this.targetElement = null;
		this.customRowHeights = [];
		for (let option of requiredOptions) {
			if (!options.hasOwnProperty(option)) {
				throw new Error('Attempted to initialize windowed-list without a required option: ' + option);
			}
		}
		
		this.scrollDirection = 0;
		this.scrollOffset = 0;
		this.overscanCount = 2;
		this._lastItemCount = null;
		this._rowOffsets = [[0, 0]];
		
		Object.assign(this, options);
		this._renderedRows = new Map();
	}

	/**
	 * Call once to add the windowed-list DOM element to the container
	 */
	initialize() {
		const { targetElement } = this;
		this.innerElem = document.createElement('div');
		this.innerElem.className = "windowed-list";

		targetElement.appendChild(this.innerElem);
		targetElement.addEventListener('scroll', this._handleScroll);

		this.update();
	}

	/**
	 * Call to remove the windowed-list from the container
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
		let oldRenderedRows = new Set(this._renderedRows.keys());
		this.render();
		// Rerender the rest
		for (let index of Array.from(this._renderedRows.keys())) {
			// Rerender only old rows, new ones got a fresh render in this.render() call
			if (!oldRenderedRows.has(index)) continue;
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

		for (let index = startIndex; index < stopIndex; index++) {
			if (this._renderedRows.has(index)) continue;
			let elem = renderItem(index);
			elem.style.top = this._getItemPosition(index) + "px";
			elem.style.position = "absolute";
			innerElem.appendChild(elem);
			this._renderedRows.set(index, elem);
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
		const [offsetIdx, offset] = this._rowOffsets.at(-1);
		const listHeight = offset + (itemCount - offsetIdx) * this.itemHeight;
		innerElem.style.position = 'relative';
		innerElem.style.height = `${listHeight}px`;
		
		// Recalculate custom row height offsets
		this._rowOffsets = [[0, 0]];
		let previousRowOffset = 0;
		let previousRowIndex = 0;
		for (let [index, rowHeight] of this.customRowHeights) {
			// Previous custom row offset + normal rows up to this custom row + this custom row
			const offset = previousRowOffset + ((index - previousRowIndex) * itemHeight) + rowHeight;
			this._rowOffsets.push([index + 1, offset]);
			previousRowIndex = index + 1;
			previousRowOffset = offset;
		}

		this.scrollDirection = 0;
		this.scrollOffset = targetElement.scrollTop;
	}
	
	getWindowHeight() {
		return this.targetElement.getBoundingClientRect().height;
	}

	getElementByIndex = index => this._renderedRows.get(index);

	/**
	 * Scroll the top of the scrollbox to a specified location
	 * @param scrollOffset {Integer} offset for the top of the tree
	 */
	scrollTo(scrollOffset) {
		const [offsetIdx, offset] = this._rowOffsets.at(-1);
		const listHeight = offset + (this._getItemCount() - offsetIdx) * this.itemHeight;
		const maxOffset = Math.max(0, listHeight - this.getWindowHeight());
		scrollOffset = Math.min(Math.max(0, scrollOffset), maxOffset);
		this.scrollOffset = scrollOffset;
		this.targetElement.scrollTop = scrollOffset;
		this.render();
	}

	/**
	 * Scroll the scrollbox to a specified item. No-op if already in view
	 * @param index
	 */
	scrollToRow(index) {
		const { scrollOffset } = this;
		const itemCount = this._getItemCount();
		const height = this.getWindowHeight();

		index = Math.max(0, Math.min(index, itemCount - 1));
		let startPosition = this._getItemPosition(index);
		let endPosition = this._getItemPosition(index + 1);
		if (startPosition < scrollOffset) {
			this.scrollTo(startPosition);
		}
		else if (endPosition > scrollOffset + height) {
			this.scrollTo(endPosition - height - 1);
		}
	}
	
	getFirstVisibleRow() {
		const idx = this._binarySearchOffsets(this._rowOffsets, this.scrollOffset, true);
		const [offsetIdx, offset] = this._rowOffsets[idx];
		return offsetIdx + Math.floor((this.scrollOffset - offset) / this.itemHeight);
	}
	
	getLastVisibleRow() {
		const height = this.getWindowHeight();
		const idx = this._binarySearchOffsets(this._rowOffsets, this.scrollOffset + height + 1, true);
		const [offsetIdx, offset] = this._rowOffsets[idx];
		return Math.max(1, offsetIdx + Math.ceil(((this.scrollOffset + height + 1) - offset) / this.itemHeight)) - 1;
	}
	
	_getItemPosition = (index) => {
		const idx = this._binarySearchOffsets(this._rowOffsets, index);
		const [offsetIdx, offset] = this._rowOffsets[idx];
		return offset + (this.itemHeight * (index - offsetIdx));
	};
	
	_getRangeToRender() {
		const { overscanCount, scrollDirection } = this;
		const itemCount = this._getItemCount();

		if (itemCount === 0) {
			return [0, 0, 0, 0];
		}

		const startIndex = this.getFirstVisibleRow();
		const stopIndex = this.getLastVisibleRow();

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
	
	_binarySearchOffsets(array, searchValue, lookupByOffset=false) {
		if (array.length === 0) return -1;
		const idx = lookupByOffset ? 1 : 0;
		const searchIdx = Math.floor(array.length / 2.0);
		const inspectValue = array[searchIdx][idx];
		if (searchValue === inspectValue) {
			return searchIdx;
		}
		else if (array.length === 1) {
			return (searchValue > inspectValue) ? searchIdx : -1;
		}
		else if (searchValue > inspectValue) {
			return (searchIdx + 1) + this._binarySearchOffsets(array.slice(searchIdx + 1), searchValue, lookupByOffset);
		}
		else {
			return this._binarySearchOffsets(array.slice(0, searchIdx), searchValue, lookupByOffset);
		}
	}

	_resetScrollDirection = Zotero.Utilities.debounce(() => this.scrollDirection = 0, 150);
};
