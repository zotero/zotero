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
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.	See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero.	If not, see <http://www.gnu.org/licenses/>.
	
	***** END LICENSE BLOCK *****
*/

'use strict';

const React = require('react');
const PropTypes = require('prop-types');
const cx = require('classnames');
const WindowedList = require('./windowed-list');
const Draggable = require('./draggable');
const { CSSIcon, getCSSIcon } = require('components/icons');
const { Zotero_Tooltip } = require('./tooltip');

const TYPING_TIMEOUT = 1000;
const MINIMUM_ROW_HEIGHT = 20; // px
const RESIZER_WIDTH = 5; // px
const COLUMN_MIN_WIDTH = 20;
const COLUMN_PADDING = 16; // N.B. MUST BE INLINE WITH CSS!!!

const noop = () => 0;

/**
 * Somewhat corresponds to nsITreeSelection
 * https://udn.realityripple.com/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsITreeSelection
 *
 * @property pivot {Number} The selection "pivot". This is the first item the user selected as part of
 * 		a ranged select (i.e. shift-select).
 * @property focused {Number} The currently selected/focused item.
 * @property count {Number} The number of selected items
 * @property selected {Set} The set of currently selected items
 * @property selectEventsSuppressed {Boolean} Controls whether select events are triggered on selection change.
 */
class TreeSelection {
	/**
	 * @param tree {VirtualizedTable} The tree where selection occurs. Will be used to issue
	 * updates.
	 */
	constructor(tree) {
		this._tree = tree;
		Object.assign(this, {
			pivot: 0,
			focused: 0,
			selected: new Set([]),
			_selectEventsSuppressed: false
		});
	}

	/**
	 * Returns whether the given index is selected.
	 * @param index {Number} The index is 0-clamped.
	 * @returns {boolean}
	 */
	isSelected(index) {
		index = Math.max(0, index);
		return this.selected.has(index);
	}

	/**
	 * Determines if the given index is the beginning of a selection block.
	 * @param {number} index - The index to check.
	 * @returns {boolean} - True if the index is the beginning of a selection block, false otherwise.
	 */
	isFirstRowOfSelectionBlock(index) {
		return this.isSelected(index) && !this.selected.has(index - 1);
	}
	
	/**
	 * Checks if the given index is the end of a selection block.
	 * @param {number} index - The index to check.
	 * @returns {boolean} - True if the index is the end of a selection block, false otherwise.
	 */
	isLastRowOfSelectionBlock(index) {
		return this.isSelected(index) && !this.selected.has(index + 1);
	}

	/**
	 * Toggles an item's selection state, updates focused item to index.
	 * @param index {Number} The index is 0-clamped.
	 * @param shouldDebounce {Boolean} Whether the update to the tree should be debounced
	 */
	toggleSelect(index, shouldDebounce) {
		if (!this._tree.props.isSelectable(index)) return;
		index = Math.max(0, index);
		if (this.selected.has(index)) {
			this.selected.delete(index);
		}
		else {
			this.selected.add(index);
		}

		if (this.selectEventsSuppressed) return;

		let previousFocused = this.focused;
		this.pivot = index;
		this.focused = index;
		if (this._tree.invalidate) {
			this._tree.invalidateRow(index);
			// might extend, truncate, merge or split a selection block
			// so need to invalidate next and previous rows as well
			this._tree.invalidateRow(index - 1);
			this._tree.invalidateRow(index + 1);
			this._tree.invalidateRow(previousFocused);
		}
		this._updateTree(shouldDebounce);
	}

	clearSelection() {
		this.selected = new Set();
		this.pivot = 0;
		if (this.selectEventsSuppressed) return;
		
		if (this._tree.invalidate) {
			this._tree.invalidate();
		}
		this._updateTree();
	}

	/**
	 * Selects an item, updates focused item to index.
	 * @param index {Number} The index is 0-clamped.
	 * @param shouldDebounce {Boolean} Whether the update to the tree should be debounced
	 * @returns {boolean} False if nothing to select and select handlers won't be called
	 */
	select(index, shouldDebounce) {
		if (!this._tree.props.isSelectable(index)) return;
		index = Math.max(0, index);
		if (this.selected.size == 1 && this.isSelected(index)) {
			return false;
		}

		let toInvalidate = new Set(this.selected);
		toInvalidate.add(index);
		toInvalidate.add(this.focused);
		this.selected = new Set([index]);
		this.focused = index;
		this.pivot = index;

		if (this.selectEventsSuppressed) return true;

		this._tree.scrollToRow(index);
		this._updateTree(shouldDebounce);
		if (this._tree.invalidate) {
			toInvalidate.forEach(this._tree.invalidateRow.bind(this._tree));
		}
		return true;
	}

	_rangedSelect(from, to, augment, isSelectAll) {
		from = Math.max(0, from);
		to = Math.max(0, to);
		if (!augment) {
			this.selected = new Set();
		}
		for (let i = from; i <= to; i++) {
			if (this._tree.props.isSelectable(i, isSelectAll)) {
				this.selected.add(i);
			}
		}
	}

	rangedSelect(from, to, augment, isSelectAll) {
		this._rangedSelect(from, to, augment, isSelectAll);

		if (this.selectEventsSuppressed) return;

		if (this._tree.invalidate) {
			if (augment) {
				this._tree.invalidateRange(from, to);
			}
			else {
				this._tree.invalidate();
			}
		}
		this._updateTree();
	}

	/**
	 * Performs a shift-select from current pivot to provided index. Updates focused item to index.
	 * @param index {Number} The index is 0-clamped.
	 * @param augment {Boolean} Adds to existing selection if true
	 * @param shouldDebounce {Boolean} Whether the update to the tree should be debounced
	 */
	shiftSelect(index, augment, shouldDebounce) {
		if (!this._tree.props.isSelectable(index)) return;
		
		index = Math.max(0, index);
		let from = Math.min(index, this.pivot);
		let to = Math.max(index, this.pivot);
		let oldFocused = this.focused;
		this.focused = index;
		let oldSelected = this.selected;
		if (augment) {
			oldSelected = new Set(oldSelected);
		}
		this._rangedSelect(from, to, augment);

		if (this.selectEventsSuppressed) return;

		let oldEdges = new Set();
		for (let oldIndex of oldSelected) {
			if (!oldSelected.has(oldIndex + 1) || !oldSelected.has(oldIndex - 1)) {
				oldEdges.add(oldIndex);
			}
		}

		if (this._tree.invalidate) {
			for (let index of this.selected) {
				if (oldSelected.has(index)) {
					oldSelected.delete(index);
					
					// ensure old and new selection block edges are invalidated
					if (oldEdges.has(index) || !this.selected.has(index - 1) || !this.selected.has(index + 1)) {
						this._tree.invalidateRow(index);
					}

					// skip invalidation for already selected rows, except for edges (above)
					continue;
				}
				this._tree.invalidateRow(index);
			}
			for (let index of oldSelected) {
				this._tree.invalidateRow(index);
			}
			this._tree.invalidateRow(oldFocused);
		}
		this._updateTree(shouldDebounce);
	}

	/**
	 * Calls the onSelectionChange prop on the tree
	 * @param shouldDebounce {Boolean} Whether the update to the tree should be debounced
	 * @private
	 */
	_updateTree(shouldDebounce) {
		if (!this.selectEventsSuppressed && this._tree.props.onSelectionChange) {
			this._tree.props.onSelectionChange(this, shouldDebounce);
			this._tree._setAriaAciveDescendant();
		}
	}

	get count() {
		return this.selected.size;
	}

	get selectEventsSuppressed() {
		return this._selectEventsSuppressed;
	}

	set selectEventsSuppressed(val) {
		this._selectEventsSuppressed = val;
		if (!val) {
			this._updateTree();
			if (this._tree.invalidate) {
				this._tree.invalidate();
			}
		}
	}
}

// Something to return on selection query before tree initialization
let TreeSelectionStub = {};
for (const key of Object.getOwnPropertyNames(TreeSelection.prototype)) {
	TreeSelectionStub[key] = () => 0;
}
TreeSelectionStub = Object.assign(TreeSelectionStub, {
	pivot: 0,
	focused: 0,
	count: 0,
	selected: new Set([]),
	selectEventsSuppressed: false
});

/**
 * A virtualized-table, inspired by https://github.com/bvaughn/react-virtualized
 *
 * Uses a custom windowed-list for fast item rendering and
 * CSS style injection for fast column resizing
 *
 * Exposes the windowed-list to the object creator via a ref
 * and also includes a bunch of helper methods for invalidating
 * rows, scrolling, etc.
 *
 * Any updates to actual rows being drawn have to be told about
 * to the windowed-list instance. More fundamental changes like the number and
 * type of columns, window resizes, etc, have to be told about to the
 * VirtualizedTable instance via forceUpdate()
 *
 * Selection is controlled via the .selection property, which is an
 * instance of TableSelection. Selection changes perform their own row invalidation
 * on the windowed-list.
 */
class VirtualizedTable extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			resizing: null
		};
		this._typingString = "";
		this._jsWindowID = `virtualized-table-list-${Zotero.Utilities.randomString(5)}`;
		this._containerWidth = props.containerWidth || window.innerWidth;
		
		this._columns = new Columns(this);
		
		this._renderedTextHeight = this._getRenderedTextHeight();
		this._rowHeight = this._getRowHeight();
		this.selection = new TreeSelection(this);

		// Due to how the Draggable element works dragging (for column dragging and for resizing)
		// is not handled via React events but via native ones attached on `document`
		// Since React attaches its event handlers on `document` as well
		// there is no way to prevent bubbling. Thus we have to do custom
		// handling to prevent header resorting when "mouseup" event is issued
		// after dragging actions
		this.isHeaderMouseUp = true;
		
		this._isMouseDrag = false;

		this.preventScrollKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", " "]);
		if (!Zotero.isMac) {
			['PageUp', 'PageDown'].forEach(key => this.preventScrollKeys.add(key));
		}
		
		this.onSelection = oncePerAnimationFrame(this._onSelection);
	}

	static defaultProps = {
		label: '',
		role: 'grid',
		linesPerRow: 1,

		showHeader: false,
		// Array of column objects like the ones in itemTreeColumns.js
		columns: [],
		onColumnSort: noop,
		onColumnPickerMenu: noop,
		getColumnPrefs: () => ({}),
		storeColumnPrefs: noop,
		staticColumns: false,
		alternatingRowColors: Zotero.isMac ? ['-moz-OddTreeRow', '-moz-EvenTreeRow'] : null,

		// Render with display: none
		hide: false,

		multiSelect: false,

		onSelectionChange: noop,

		// The below are for arrow-key navigation
		isSelectable: () => true,
		getParentIndex: noop,
		isContainer: noop,
		isContainerEmpty: noop,
		isContainerOpen: noop,
		toggleOpenState: noop,

		// If you want to perform custom key handling it should be in this function
		// if it returns false then virtualized-table's own key handler won't run
		onKeyDown: () => true,
		onKeyUp: noop,

		onDragOver: noop,
		onDrop: noop,

		// Enter, double-clicking
		onActivate: noop(),

		onItemContextMenu: noop(),
	};

	static propTypes = {
		id: PropTypes.string.isRequired,

		getRowCount: PropTypes.func.isRequired,
		
		renderItem: PropTypes.func,
		// Row height specified as lines of text per row. Defaults to 1
		linesPerRow: PropTypes.number,
		// Do not adjust for Zotero-defined font scaling
		disableFontSizeScaling: PropTypes.bool,
		// An array of two elements for alternating row colors
		alternatingRowColors: PropTypes.array,
		// For screen-readers
		label: PropTypes.string,
		role: PropTypes.string,

		showHeader: PropTypes.bool,
		// Array of column objects like the ones in itemTreeColumns.js
		columns: PropTypes.array,
		onColumnPickerMenu: PropTypes.func,
		onColumnSort: PropTypes.func,
		getColumnPrefs: PropTypes.func,
		storeColumnPrefs: PropTypes.func,
		getDefaultColumnOrder: PropTypes.func,
		// Makes columns unmovable, unsortable, etc
		staticColumns: PropTypes.bool,
		// Used for initial column widths calculation
		containerWidth: PropTypes.number,
		firstColumnExtraWidth: PropTypes.number,

		// Internal windowed-list ref
		treeboxRef: PropTypes.func,

		// Render with display: none
		hide: PropTypes.bool,

		multiSelect: PropTypes.bool,

		onSelectionChange: PropTypes.func,

		// The below are for arrow-key navigation
		isSelectable: PropTypes.func,
		getParentIndex: PropTypes.func,
		isContainer: PropTypes.func,
		isContainerEmpty: PropTypes.func,
		isContainerOpen: PropTypes.func,
		toggleOpenState: PropTypes.func,
		
		// A function with signature (index:Number) => result:String which will be used
		// for find-as-you-type navigation. Find-as-you-type is disabled if prop is undefined.
		getRowString: PropTypes.func,

		// If you want to perform custom key handling it should be in this function
		// if it returns false then virtualized-table's own key handler won't run
		onKeyDown: PropTypes.func,
		onKeyUp: PropTypes.func,

		onDragOver: PropTypes.func,
		onDrop: PropTypes.func,

		// Enter, double-clicking
		onActivate: PropTypes.func,
		
		onFocus: PropTypes.func,

		onItemContextMenu: PropTypes.func,
	};

	// ------------------------ Selection Methods ------------------------- //
		
	_preventKeyboardScrolling = (e) => {
		if (this.preventScrollKeys.has(e.key)) {
			e.preventDefault();
			e.stopPropagation();
			if (e.nativeEvent) {
				if (e.nativeEvent.preventDefault) {
					e.nativeEvent.preventDefault();
				}
				if (e.nativeEvent.stopPropagation) {
					e.nativeEvent.stopPropagation();
				}
			}
		}
	}
	
	/**
	 * Ensure the tree scrolls when dragging over top and bottom parts of it
	 */
	_onDragOver = (e) => {
		let tree = e.currentTarget;
		if (tree.id != this.props.id) return;
		let { y, height } = tree.getBoundingClientRect();
		let yBott = y + height;
		let threshold = this._rowHeight / 3;
		let scrollHeight = this._rowHeight * 3;
		if (e.clientY - y <= threshold) {
			// Already at top
			if (tree.scrollTop === 0) return;
			let scrollTo = Math.max(tree.scrollTop - scrollHeight, 0);
			tree.scrollTop = scrollTo;
		}
		else if (yBott - e.clientY <= threshold) {
			// Already at bottom
			if (tree.scrollTop === tree.scrollHeight - tree.clientHeight) return;
			let scrollTo = Math.min(
				tree.scrollTop + scrollHeight,
				tree.scrollHeight - tree.clientHeight
			);
			tree.scrollTop = scrollTo;
		}
		this.props.onDragOver && this.props.onDragOver(e)
	}

	/**
	 * Handles page up/down jumps
	 *
	 * @param {Integer} direction - -1 for up, 1 for down
	 * @param {Boolean} selectTo
	 */
	_onJumpSelect(direction, selectTo, toggleSelection) {
		if (direction == 1) {
			const lastVisible = this._jsWindow.getLastVisibleRow();
			if (this.selection.focused != lastVisible) {
				return this.onSelection(lastVisible, selectTo, toggleSelection);
			}
		}
		else {
			const firstVisible = this._jsWindow.getFirstVisibleRow();
			if (this.selection.focused != firstVisible) {
				return this.onSelection(firstVisible, selectTo, toggleSelection);
			}
		}
		const height = document.getElementById(this._jsWindowID).clientHeight;
		const numRows = Math.floor(height / this._rowHeight);
		let destination = this.selection.focused + (direction * numRows);
		const rowCount = this.props.getRowCount();
		destination = Math.min(destination, rowCount - 1);
		destination = Math.max(0, destination);
		return this.onSelection(destination, selectTo, toggleSelection);
	}

	/**
	 * Handles key down events in the tree's container.
	 *
	 * @param {Event} e
	 */
	_onKeyDown = (e) => {
		if (this.props.onKeyDown && this.props.onKeyDown(e) === false) return;

		this._preventKeyboardScrolling(e);

		if (e.altKey) return;
		
		const shiftSelect = e.shiftKey;
		const moveFocused = Zotero.isMac ? e.metaKey : e.ctrlKey;
		const toggleSelection = shiftSelect && moveFocused;
		const rowCount = this.props.getRowCount();

		switch (e.key) {
		case "ArrowUp":
			let prevSelect = this.selection.focused - 1;
			while (prevSelect > 0 && !this.props.isSelectable(prevSelect)) {
				prevSelect--;
			}
			prevSelect = Math.max(0, prevSelect);
			this.onSelection(prevSelect, shiftSelect, toggleSelection, moveFocused, e.repeat);
			break;

		case "ArrowDown":
			let nextSelect = this.selection.focused + 1;
			while (nextSelect < rowCount && !this.props.isSelectable(nextSelect)) {
				nextSelect++;
			}
			nextSelect = Math.min(nextSelect, rowCount - 1);
			this.onSelection(nextSelect, shiftSelect, toggleSelection, moveFocused, e.repeat);
			break;

		case "Home":
			this.onSelection(0, shiftSelect, toggleSelection, moveFocused);
			break;

		case "End":
			this.onSelection(rowCount - 1, shiftSelect, toggleSelection, moveFocused);
			break;
			
		case "PageUp":
			if (!Zotero.isMac) {
				this._onJumpSelect(-1, shiftSelect, toggleSelection, e.repeat);
			}
			else {
				this._jsWindow.scrollTo(this._jsWindow.scrollOffset - this._jsWindow.getWindowHeight() + this._rowHeight);
			}
			break;
			
		case "PageDown":
			if (!Zotero.isMac) {
				this._onJumpSelect(1, shiftSelect, toggleSelection, e.repeat);
			}
			else {
				this._jsWindow.scrollTo(this._jsWindow.scrollOffset + this._jsWindow.getWindowHeight() - this._rowHeight);
			}
			break;
			
		// Select All
		case "a":
			if (this.props.multiSelect
					&& !e.shiftKey
					&& (Zotero.isMac ? (e.metaKey && !e.ctrlKey) : e.ctrlKey)) {
				this.selection.rangedSelect(0, this.props.getRowCount()-1, false, true);
			}
			break;
			
		case " ":
			if (this._typingString.length <= 0) {
				this.onSelection(this.selection.focused, false, true);
				return;
			}
			break;
		
		case "Enter":
			this._activateNode(e);
			return;
		}
		
		if (e.key == 'ContextMenu' || (e.key == 'F10' && e.shiftKey)) {
			let selectedElem = document.querySelector(`#${this._jsWindowID} [aria-selected=true]`);
			let boundingRect = selectedElem.getBoundingClientRect();
			this.props.onItemContextMenu(
				e,
				window.screenX + boundingRect.left + 50,
				window.screenY + boundingRect.bottom
			);
			return;
		}

		if (this.props.getRowString && !(e.ctrlKey || e.metaKey) && e.key.length == 1) {
			this._handleTyping(e.key);
		}
		
		if (shiftSelect || moveFocused) return;
		
		switch (e.key) {
		case Zotero.arrowPreviousKey:
			const parentIndex = this.props.getParentIndex(this.selection.focused);
			if (this.props.isContainer(this.selection.focused)
					&& !this.props.isContainerEmpty(this.selection.focused)
					&& this.props.isContainerOpen(this.selection.focused)) {
				this.props.toggleOpenState(this.selection.focused);
			}
			else if (parentIndex != -1) {
				this.onSelection(parentIndex);
			}
			break;

		case Zotero.arrowNextKey:
			if (this.props.isContainer(this.selection.focused)
					&& !this.props.isContainerEmpty(this.selection.focused)) {
				if (!this.props.isContainerOpen(this.selection.focused)) {
					this.props.toggleOpenState(this.selection.focused);
				}
				else {
					this.onSelection(this.selection.focused + 1);
				}
			}
			break;
		}
	}
	
	_handleTyping = (char) => {
		char = char.toLowerCase();
		this._typingString += char;
		let allSameChar = true;
		for (let i = this._typingString.length - 1; i >= 0; i--) {
			if (char != this._typingString[i]) {
				allSameChar = false;
				break;
			}
		}
		const rowCount = this.props.getRowCount();
		if (allSameChar) {
			for (let i = this.selection.focused + 1, checked = 0; checked < rowCount; i++, checked++) {
				i %= rowCount;
				let rowString = this.props.getRowString(i);
				if (rowString.toLowerCase().indexOf(char) == 0) {
					if (i != this.selection.focused) {
						this.scrollToRow(i);
						this.onSelection(i);
					}
					break;
				}
			}
		}
		else {
			// Stop at the row before the selection's focus
			// but don't set a negative stop point, or we'll loop infinitely
			let stopRow = Math.max(this.selection.focused - 1, 0);
			for (let i = (this.selection.focused) % rowCount; i != stopRow; i = (i + 1) % rowCount) {
				let rowString = this.props.getRowString(i);
				if (rowString.toLowerCase().indexOf(this._typingString) == 0) {
					if (i != this.selection.focused) {
						this.scrollToRow(i);
						this.onSelection(i);
					}
					break;
				}
			}
		}
		clearTimeout(this._typingTimeout);
		this._typingTimeout = setTimeout(() => {
			this._typingString = "";
		}, TYPING_TIMEOUT);
	}
	
	_onDragStart = () => {
		this._isMouseDrag = true;
	}
	
	_onDragEnd = async () => {
		// macOS force-click sometimes causes a second mouseup event to be fired some time later
		// causing a collection change on dragend, so we add a delay here. It shouldn't cause any issues
		// because isMouseDrag is only used in mouseup handler to exactly prevent from accidentally switching
		// selection after dragend.
		if (Zotero.isMac) {
			await Zotero.Promise.delay(500);
		}
		this._isMouseDrag = false;
	}
	
	_handleMouseDown = async (e, index) => {
		const modifierClick = e.shiftKey || e.ctrlKey || e.metaKey;
		// All modifier clicks handled in mouseUp per mozilla itemtree convention
		if (!modifierClick && !this.selection.isSelected(index)) {
			this._onSelection(index, false, false);
		}
		this.focus();
	}

	_handleContextMenu = async (e, index) => {
		if (!this.selection.isSelected(index)) {
			this._onSelection(index, false, false);
		}
		this.props.onItemContextMenu(e, e.screenX, e.screenY);
		this.focus();
	}
	
	_handleMouseUp = async (e, index) => {
		const shiftSelect = e.shiftKey;
		const augment = e.ctrlKey || e.metaKey;
		if (this._isMouseDrag || e.button != 0) {
			// other mouse buttons are ignored
			this._isMouseDrag = false;
			return;
		}
		this._onSelection(index, shiftSelect, augment);
		this.focus();
	}

	_activateNode = (event, indices) => {
		indices = indices || Array.from(this.selection.selected);
		if (!indices.length) return;
		
		if (this.props.onActivate) {
			this.props.onActivate(event, indices);
		}
	}

	/**
	 * Scroll the row into view. Delegates to windowed-list
	 *
	 * @param index {Number}
	 */
	scrollToRow(index) {
		this._jsWindow && this._jsWindow.scrollToRow(index);
	}

	/**
	 * Updates the selection object
	 *
	 * @param {Number} index
	 *        The index of the item in a full DFS traversal (ignoring collapsed
	 *        nodes). Ignored if `item` is undefined.
	 * @param {Boolean} shiftSelect
	 * 		  If true will select from focused up to index (does not update pivot)
	 * @param {Boolean} toggleSelection
	 * 		  If true will add to selection
	 * @param {Boolean} moveFocused
	 * 		  Will move focus without adding anything to the selection
	 */
	_onSelection = (index, shiftSelect, toggleSelection, moveFocused, shouldDebounce) => {
		if (this.selection.selectEventsSuppressed) return;
		
		if (!this.props.multiSelect && (shiftSelect || toggleSelection || moveFocused)) {
			return;
		}
		else if (shiftSelect) {
			this.selection.shiftSelect(index, toggleSelection, shouldDebounce);
		}
		else if (toggleSelection) {
			this.selection.toggleSelect(index, shouldDebounce);
		}
		else if (moveFocused) {
			let previousFocused = this.selection.focused;
			this.selection.focused = index;
			this.selection.pivot = index;
			this.invalidateRow(previousFocused);
			this.invalidateRow(index);
			this.selection._updateTree(shouldDebounce);
		}
		// Normal selection
		else if (!toggleSelection) {
			if (index > 0 && !this.props.isSelectable(index)) {
				return;
			}
			this.selection.select(index, shouldDebounce);
		}
		// If index is not selectable and this is not normal selection we return
		else if (!this.props.isSelectable(index)) {
			return;
		}
		// None of the previous conditions were satisfied, so nothing changes
		else {
			return;
		}

		this.scrollToRow(index);
	}
	
	// ------------------------ Column Methods ------------------------- //

	_handleResizerDragStart = (index, event) => {
		if (event.button !== 0) return false;
		event.stopPropagation();
		this.isHeaderMouseUp = false;
		const result = this._getResizeColumns(index);
		// No resizable columns on the left/right
		if (!result) return false;
		
		this.setState({ resizing: index });
		
		let onResizeData = {};
		const columns = this._getVisibleColumns();
		for (let i = 0; i < columns.length; i++) {
			let elem = event.target.parentNode.parentNode.children[i];
			onResizeData[columns[i].dataKey] = elem.getBoundingClientRect().width;
		}
		this._columns.onResize(onResizeData);
		this._isMouseDrag = true;
	}

	_handleResizerDrag = (event) => {
		event.stopPropagation();
		const result = this._getResizeColumns();
		if (!result) return;
		const [aColumn, bColumn, resizingColumn] = result;
		const a = document.querySelector(`#${this.props.id} .virtualized-table-header .cell.${aColumn.dataKey}`);
		const b = document.querySelector(`#${this.props.id} .virtualized-table-header .cell.${bColumn.dataKey}`);
		const resizing = document.querySelector(`#${this.props.id} .virtualized-table-header .cell.${resizingColumn.dataKey}`);
		const aRect = a.getBoundingClientRect();
		const bRect = b.getBoundingClientRect();
		const resizingRect = resizing.getBoundingClientRect();
		let offset = aRect.left;
		if (aColumn.dataKey != resizingColumn.dataKey && !Zotero.rtl) {
			offset += resizingRect.width;
		}
		const widthSum = aRect.width + bRect.width;
		const aSpacingOffset = (aColumn.minWidth ? aColumn.minWidth : COLUMN_MIN_WIDTH) + (aColumn.noPadding ? 0 : COLUMN_PADDING);
		const bSpacingOffset = (bColumn.minWidth ? bColumn.minWidth : COLUMN_MIN_WIDTH) + (bColumn.noPadding ? 0 : COLUMN_PADDING);
		const aColumnWidth = Math.min(widthSum - bSpacingOffset, Math.max(aSpacingOffset, event.clientX - (RESIZER_WIDTH / 2) - offset));
		const bColumnWidth = widthSum - aColumnWidth;
		let onResizeData = {};
		onResizeData[aColumn.dataKey] = aColumnWidth;
		onResizeData[bColumn.dataKey] = bColumnWidth;
		this._columns.onResize(onResizeData);
	}
	
	/**
	 * Get all columns including hidden ones
	 */
	_getColumns() {
		return this._columns.getAsArray();
	}
	
	_getVisibleColumns() {
		return this._getColumns().filter(col => !col.hidden);
	}
	
	_getResizeColumns(index) {
		index = typeof index != "undefined" ? index : this.state.resizing;
		let resizingColumn, aColumn, bColumn;
		const columns = this._getVisibleColumns().sort((a, b) => a.ordinal - b.ordinal);
		aColumn = resizingColumn = columns[index - 1];
		bColumn = columns[index];
		if (aColumn.fixedWidth) {
			for (let i = index - 2; i >= 0; i--) {
				aColumn = columns[i];
				if (!aColumn.fixedWidth) break;
			}
			if (aColumn.fixedWidth) {
				// All previous columns are fixed width
				return;
			}
		}
		if (bColumn.fixedWidth) {
			for (let i = index + 1; i < columns.length; i++) {
				bColumn = columns[i];
				if (!bColumn.fixedWidth) break;
			}
			if (bColumn.fixedWidth) {
				// All following columns are fixed width
				return;
			}
		}
		if (Zotero.rtl) {
			return [bColumn, aColumn, resizingColumn];
		}
		return [aColumn, bColumn, resizingColumn];
	}

	/**
	 * Toggle [title] attribute on cells when text is truncated
	 * so that a tooltip gets displayed on hover.
	 * @param event
	 */
	_handleMouseOver = (event) => {
		// On scroll, mouse position does not change, so _handleMouseMove does not fire
		// to close the fake tooltip. Make sure it is closed here.
		Zotero_Tooltip.stop();
		let elem = event.target;
		if (!elem.classList.contains('cell') || elem.classList.contains('cell-icon')) return;
		let textElem = elem.querySelector('.label, .cell-text');
		// .label is used in the header, .cell-text on primary cells,
		// otherwise the .cell element if its immediate child is a text node
		// should be used.
		if (!textElem) {
			if (!elem.childNodes.length || elem.childNodes[0].nodeType != window.Node.TEXT_NODE) return;
			textElem = elem;
		}
		// We need to set the [title] attribute on the .label element in the header
		if (textElem.classList.contains('label')) elem = textElem;
		if (textElem.offsetWidth < textElem.scrollWidth) {
			elem.setAttribute('title', textElem.textContent);
		}
		else {
			elem.removeAttribute('title');
		}
	}

	/**
	 * Manually handle tooltip setting for table cells with overflowing values.
	 * Temporary, after
	 * https://github.com/zotero/zotero/commit/8e2790e2d2a1d8b15efbf84935f0a80d58db4e44.
	 * @param event
	 */
	_handleMouseMove = (event) => {
		let tgt = event.target;
		// Mouse left the previous cell - close the tooltip
		if (!tgt.classList.contains("row")
			|| event.clientX < parseInt(tgt.dataset.mouseLeft)
			|| event.clientX > parseInt(tgt.dataset.mouseRight)) {
			delete tgt.dataset.mouseLeft;
			delete tgt.dataset.mouseRight;
			Zotero_Tooltip.stop();
		}

		if (!tgt.classList.contains("row")) return;
		let cells = tgt.querySelectorAll(".cell");
		let targetCell;
		// Find the cell the mouse is over
		for (let cell of cells) {
			let rect = cell.getBoundingClientRect();
			if (event.clientX >= rect.left && event.clientX <= rect.right) {
				targetCell = cell;
				tgt.dataset.mouseLeft = rect.left;
				tgt.dataset.mouseRight = rect.right;
				break;
			}
		}
		if (!targetCell) return;
		// Primary cell will .cell-text child node
		let textCell = targetCell.querySelector(".cell-text") || targetCell;
		// If the cell has overflowing content, display the fake tooltip
		if (textCell.offsetWidth < textCell.scrollWidth) {
			Zotero_Tooltip.stop();
			Zotero_Tooltip.start(textCell.textContent);
		}
	};

	/**
	 * Remove manually added fake tooltip from _handleMouseMove when the
	 * mouse leaves the row completely.
	 */
	_handleMouseLeave = (_) => {
		Zotero_Tooltip.stop();
		let lastRow = document.querySelector("[mouseLeft][mouseRight]");
		if (lastRow) {
			delete lastRow.dataset.mouseLeft;
			delete lastRow.dataset.mouseRight;
		}
	};

	_handleResizerDragStop = (event) => {
		event.stopPropagation();
		const result = this._getResizeColumns();
		if (!result) return;
		let resizeData = {};
		for (const column of result) {
			const elem = document.querySelector(`#${this.props.id} .virtualized-table-header .cell.${column.dataKey}`)
			resizeData[column.dataKey] = elem.getBoundingClientRect().width;
		}
		this._columns.onResize(resizeData, true);
		this.setState({ resizing: null });
	}
		
	_handleColumnDragStart = (index, event) => {
		if (event.button !== 0) return false;
		// Remember for sorting
		this._headerMouseDownIndex = index;
		this.setState({ draggingColumn: index });
		this._isMouseDrag = true;
	}

	_handleColumnDragStop = (event, cancelled) => {
		if (!cancelled && typeof this.state.draggingColumn == "number") {
			const { index } = this._findColumnDragPosition(event.clientX);
			// If inserting before the column that was being dragged
			// there is nothing to do
			if (this.state.draggingColumn != index) {
				const visibleColumns = this._getVisibleColumns();
				const dragColumn = this._getColumns().findIndex(
					col => col == visibleColumns[this.state.draggingColumn]);
				// Insert as final column (before end of list)
				let insertBeforeColumn = this._getColumns().length;
				// index == visibleColumns.length if dragged to the end of the view to be ordered
				// as the final column
				if (index < visibleColumns.length) {
					insertBeforeColumn = this._getColumns().findIndex(col => col == visibleColumns[index]);
				}
				this._columns.setOrder(dragColumn, insertBeforeColumn);
			}
		}
		this.setState({ draggingColumn: null, dragColumnX: null });
	}

	_handleColumnDrag = (event) => {
		const { offsetX } = this._findColumnDragPosition(event.clientX);
		this.isHeaderMouseUp = false;
		this.setState({ dragColumnX: offsetX });
	}

	_handleHeaderMouseUp = (event, dataKey, index) => {
		if (!this.isHeaderMouseUp || event.button !== 0) {
			this.isHeaderMouseUp = true;
			return;
		}
		// The mousedown event occurred on a different column so we shouldn't sort
		if (this._headerMouseDownIndex != index) return;
		this._columns.toggleSort(this._getColumns().findIndex(column => column.dataKey == dataKey));
	}

	_findColumnDragPosition(x) {
		const headerRect = document.querySelector(`#${this.props.id} .virtualized-table-header`).getBoundingClientRect();
		
		let coords = Array.from(document.querySelectorAll(`#${this.props.id} .virtualized-table-header .resizer`))
			.map((elem) => {
				const rect = elem.getBoundingClientRect();
				// accounting for resizer offset
				return rect.x + rect.width/2;
			});
		// Adding leftmost position, since there's no left resizer
		coords.splice(0, 0, headerRect.x);
		// and the rightmost position for the same reason
		coords.push(headerRect.x + headerRect.width);
		
		let index = 0;
		let closestVal = Math.abs(coords[index] - x);
		for (let i = 1; i < coords.length; i++) {
			let distance = Math.abs(coords[i] - x);
			if (distance < closestVal) {
				closestVal = distance;
				index = i;
			}
		}
		return {index, offsetX: coords[index] - headerRect.x};
	}

	componentDidMount() {
		this._jsWindow = new WindowedList(this._getWindowedListOptions());
		this._jsWindow.initialize();
		this._jsWindow.render();
		this._updateWidth();
		this.props.treeboxRef && this.props.treeboxRef(this._jsWindow);
	
		this._setXulTooltip();

		window.addEventListener("resize", () => {
			this._debouncedRerender();
		});
	}
	
	componentWillUnmount() {
		this._jsWindow.destroy();
	}
	
	componentDidUpdate(prevProps) {
		if (this.props.id !== prevProps.id) {
			this._columns = new Columns(this);
			this.forceUpdate();
		}
	}

	/**
	 * Make HTML [title] attribute display a tooltip. Without this
	 * HTML [title] attribute when embedded in a XUL window does not
	 * trigger a tooltip to be displayed
	 * @private
	 */
	_setXulTooltip() {
		// Make sure container xul element has a tooltip set
		let xulElem = this._topDiv;
		while (xulElem && xulElem.namespaceURI !== "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul") {
			xulElem = xulElem.parentElement;
		}
		if (!xulElem) return;
		if (xulElem.getAttribute('tooltip') != 'html-tooltip') {
			xulElem.setAttribute('tooltip', 'html-tooltip');
		}
		if (document.querySelector('tooltip#html-tooltip')) return;
		let tooltip = document.createXULElement('tooltip');
		tooltip.id = 'html-tooltip';
		tooltip.addEventListener('popupshowing', function(e) {
			let tooltipTitleNode = tooltip.triggerNode?.closest('div *[title], iframe *[title], browser *[title]');
			if (tooltipTitleNode) {
				this.setAttribute('label', tooltipTitleNode.getAttribute('title'));
				return;
			}
			e.preventDefault();
		});

		let popupset = document.querySelector('popupset');
		if (!popupset) {
			popupset = document.createXULElement('popupset');
			document.documentElement.appendChild(popupset);
		}
		popupset.appendChild(tooltip);
	}
	
	_getWindowedListOptions() {
		return {
			getItemCount: this.props.getRowCount,
			itemHeight: this._rowHeight,
			renderItem: this._renderItem,
			targetElement: document.getElementById(this._jsWindowID),
		};
	}
	
	_renderItem = (index, oldElem = null) => {
		let node = this.props.renderItem(index, this.selection, oldElem, this._getColumns());
		if (!node.dataset.eventHandlersAttached) {
			node.dataset.eventHandlersAttached = true;
			node.addEventListener('dragstart', e => this._onDragStart(e, index), { passive: true });
			node.addEventListener('dragend', e => this._onDragEnd(e, index), { passive: true });
			node.addEventListener('mousedown', e => this._handleMouseDown(e, index), { passive: true });
			node.addEventListener('contextmenu', e => this._handleContextMenu(e, index), { passive: true });
			node.addEventListener('mouseup', e => this._handleMouseUp(e, index), { passive: true });
			node.addEventListener('dblclick', e => this._activateNode(e, [index]), { passive: true });
		}
		node.style.height = this._rowHeight + 'px';
		node.id = this.props.id + "-row-" + index;
		node.classList.toggle('odd', index % 2 == 1);
		node.classList.toggle('even', index % 2 == 0);
		if (!node.hasAttribute('role')) {
			node.setAttribute('role', 'row');
		}
		if (this.selection.isSelected(index)) {
			node.setAttribute('aria-selected', true);
		}
		else {
			node.removeAttribute('aria-selected');
		}
		return node;
	}

	_renderHeaderCells = () => {
		return this._getVisibleColumns().map((column, index) => {
			let columnName = formatColumnName(column);
			let label = columnName;
			// Allow custom icons to be used in column headers
			if (column.iconPath) {
				column.iconLabel = <span
					className="icon icon-bg"
					style={{backgroundImage: `url("${column.iconPath}")`}}>
				</span>;
			}
			if (column.iconLabel) {
				label = column.iconLabel;
			}
			if (column.htmlLabel) {
				if (React.isValidElement(column.htmlLabel)) {
					label = column.htmlLabel;
				} else if (typeof column.htmlLabel === "string") {
					label = <span dangerouslySetInnerHTML={{ __html: column.htmlLabel }} />;
				}
			}
			let resizer = (<Draggable
				onDragStart={this._handleResizerDragStart.bind(this, index)}
				onDrag={this._handleResizerDrag}
				onDragStop={this._handleResizerDragStop}
				className={`resizer ${column.dataKey}`}
				key={column.label + '-resizer'}>
				<div/>
			</Draggable>);
			if (index == 0) {
				resizer = "";
			}
			let sortIndicator = "";
			if (!column.iconLabel && column.sortDirection) {
				sortIndicator = <CSSIcon name="sort-indicator" className={"icon-8 sort-indicator " + (column.sortDirection === 1 ? "ascending" : "descending")} />;
			}
			const className = cx("cell", column.className, { 'first-column': index === 0, dragging: this.state.draggingColumn == index },
				{ "cell-icon": !!column.iconLabel });
			return (<Draggable
				onDragStart={this._handleColumnDragStart.bind(this, index)}
				onDrag={this._handleColumnDrag}
				onDragStop={this._handleColumnDragStop}
				className={className}
				delay={500}
				key={columnName + '-draggable'}>
				<div
					key={columnName}
					onMouseUp={e => this._handleHeaderMouseUp(e, column.dataKey, index)}>
					{resizer}
					<span
						key={columnName + '-label'}
						className={`label ${column.dataKey}`}
						title={column.iconLabel ? columnName : ""}>
						{label}
					</span>
					{sortIndicator}
				</div>
			</Draggable>);
		});
	}
		
	render() {
		let header = "";
		let columnDragMarker = "";
		if (this.props.columns.length && this.props.showHeader) {
			const headerCells = this._renderHeaderCells();
			const headerClassName = cx("virtualized-table-header", { "static-columns": this.props.staticColumns });
			header = (<div
				className={headerClassName}
				onContextMenu={this.props.onColumnPickerMenu}>
				{headerCells}
			</div>);
			if (typeof this.state.dragColumnX == 'number') {
				columnDragMarker = <div className="column-drag-marker" style={{ left: this.state.dragColumnX }} />;
			}
		}
		let props = {
			onKeyDown: this._onKeyDown,
			onKeyUp: e => this.props.onKeyUp && this.props.onKeyUp(e),
			onDragOver: this._onDragOver,
			onDrop: e => this.props.onDrop && this.props.onDrop(e),
			onFocus: e => this.props.onFocus && this.props.onFocus(e),
			onMouseOver: e => this._handleMouseOver(e),
			onMouseMove: e => this._handleMouseMove(e),
			onMouseLeave: e => this._handleMouseLeave(e),
			className: cx(["virtualized-table", {
				resizing: this.state.resizing,
				'multi-select': this.props.multiSelect
			}]),
			id: this.props.id,
			ref: ref => this._topDiv = ref,
			tabIndex: 0,
			role: this.props.role,
			// XUL's chromedir attribute doesn't work with CSS :dir selectors,
			// so we'll manually propagate the locale's script direction to the
			// table.
			dir: Zotero.Locale.defaultScriptDirection(Zotero.locale),
		};
		if (this.props.hide) {
			props.style = { display: "none" };
		}
		if (this.props.label) {
			props['aria-label'] = this.props.label;
		}
		if (this.props.columns.length && this.props.showHeader) {
			props['aria-multiselectable'] = this.props.multiSelect;
			props['aria-colcount'] = this._getVisibleColumns().length;
		}
		if (this.props.role == 'treegrid') {
			props['aria-readonly'] = true;
		}
		let jsWindowProps = {
			id: this._jsWindowID,
			className: "virtualized-table-body",
			onFocus: (e) => {
				if (e.target.id == this._jsWindowID) {
					// Focus should always remain on the list itself.
					this._topDiv.focus();
				}
			},
			tabIndex: -1,
		};
		return (
			<div {...props}>
				{columnDragMarker}
				{header}
				<div {...jsWindowProps} />
			</div>
		);
	}

	/**
	 * Invalidates the underlying windowed-list
	 */
	invalidate() {
		if (!this._jsWindow) return;
		this._jsWindow.invalidate();
		this._updateWidth();
	}

	/**
	 * Rerenders/renders the underlying windowed-list. Use for container size changes
	 * to render missing items and update widths
	 */
	rerender = () => {
		if (!this._jsWindow) return;
		this._jsWindow.render();
		this._updateWidth();
	}
	
	updateFontSize = () => {
		if (this.props.disableFontSizeScaling) {
			Zotero.warn("Attempting to update font size on a VirtualizedTable with a font scaling "
				+ "disabled. Change the prop instead.");
			return;
		}
		this._rowHeight = this._getRowHeight();
		
		if (!this._jsWindow) return;
		this._jsWindow.update(this._getWindowedListOptions());
		this._jsWindow.invalidate();
	};

	/**
	 * @param customRowHeights an array of tuples specifying row index and row height: e.g. [[1, 10], [5, 10]]
	 */
	updateCustomRowHeights = (customRowHeights=[]) => {
		return this._jsWindow.update({customRowHeights});
	};
	
	_getRowHeight() {
		let rowHeight = this.props.linesPerRow * this._renderedTextHeight;
		if (!this.props.disableFontSizeScaling) {
			rowHeight *= Zotero.Prefs.get('fontSize');
		}
		rowHeight += Zotero.Prefs.get('uiDensity') === 'comfortable' ? 10 : 4;

		// @TODO: Check row height across platforms and remove commented code below
		// padding
		// This is weird, but Firefox trees always had different amount of padding on
		// different OSes
		// if (Zotero.isMac) {
		// 	rowHeight *= 1.4;
		// }
		// else if (Zotero.isWin) {
		// 	rowHeight *= 1.2;
		// }
		// else {
		// 	rowHeight *= 1.1;
		// }
		rowHeight = Math.round(Math.max(MINIMUM_ROW_HEIGHT, rowHeight));
		return rowHeight;
	}

	_getRenderedTextHeight() {
		let div = document.createElement('div');
		div.style.visibility = "hidden";
		div.style.lineHeight = "1.3333333333333333";
		div.textContent = "Zotero";
		document.documentElement.appendChild(div);
		let height = window.getComputedStyle(div).height;
		document.documentElement.removeChild(div);
		return parseFloat(height.split('px')[0]);
	}
	
	_debouncedRerender = Zotero.Utilities.debounce(this.rerender, 200);
	
	_updateWidth() {
		if (!this.props.showHeader) return;
		const jsWindow = document.querySelector(`#${this._jsWindowID} .windowed-list`);
		if (!jsWindow) return;
		const header = document.querySelector(`#${this.props.id} .virtualized-table-header`);
		const scrollbarWidth = jsWindow.parentElement.getBoundingClientRect().width - jsWindow.parentElement.clientWidth;

		header.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
	}

	/**
	 * Rerender a row in the underlying windowed-list
	 * @param index
	 */
	invalidateRow(index) {
		if (!this._jsWindow) return;
		this._jsWindow.rerenderItem(index);
	}

	/**
	 * Rerender a row range in the underlying windowed-list
	 * @param startIndex
	 * @param endIndex
	 */
	invalidateRange(startIndex, endIndex) {
		if (!this._jsWindow) return;
		for (; startIndex <= endIndex; startIndex++) {
			this._jsWindow.rerenderItem(startIndex);
		}
	}

	/**
	 * When performing custom event handling on rendered rows this allows to ensure that the
	 * focus returns to the virtualized table for kb selection and other event handling
	 */
	focus() {
		setTimeout(() => this._topDiv.focus());
	}
	
	
	rowIsVisible(row) {
		if (!this._jsWindow) return false;
		return row >= this._jsWindow.getFirstVisibleRow()
			&& row <= this._jsWindow.getLastVisibleRow();
	}

	async _resetColumns() {
		this.invalidate();
		this._columns = new Columns(this);
		await new Promise((resolve) => {this.forceUpdate(resolve)});
	}
	
	// Set aria-activedescendant on table container
	_setAriaAciveDescendant() {
		if (!this.selection.focused) return;
		let selected = this._jsWindow?.getElementByIndex(this.selection.focused);
		if (selected) {
			selected.closest(".virtualized-table").setAttribute("aria-activedescendant", selected.id);
		}
	}
}

/**
 * Create a function that calls the given function `fn` only once per animation
 * frame.
 *
 * @param {Function} fn
 * @returns {Function}
 */
function oncePerAnimationFrame(fn) {
	let animationId = null;
	let argsToPass = null;
	return function(...args) {
		argsToPass = args;
		if (animationId !== null) {
			return;
		}

		let debouncedFn = () => {
			fn.call(this, ...argsToPass);
			animationId = null;
			argsToPass = null;
		};

		if (typeof requestAnimationFrame == 'undefined') {
			animationId = setTimeout(debouncedFn, 20);
		} else {
			animationId = requestAnimationFrame(debouncedFn);
		}
	};
}

var Columns = class {
	constructor(virtualizedTable) {
		this._virtualizedTable = virtualizedTable;

		this._styleKey = virtualizedTable.props.id;

		this._initializeStyleMap();

		let columnsSettings = this._getPrefs();

		let columns = this._columns = [];
		for (let column of virtualizedTable.props.columns) {
			// Fixed width columns can sometimes somehow obtain a width property
			// this fixes it for users that may have run into the bug
			if (column.fixedWidth && typeof columnsSettings[column.dataKey] == "object") {
				delete columnsSettings[column.dataKey].width;;
			}
			column = Object.assign({}, column, columnsSettings[column.dataKey]);
			column.className = cx(column.className, column.dataKey, column.dataKey + this._cssSuffix,
				{ 'fixed-width': column.fixedWidth });
			if (column.type) {
				column.className += ` cell-${column.type}`;
			}
			if (column.fixedWidth) {
				column.originalWidth = column.width;
			}
			if (column.staticWidth) {
				column.originalMinWidth = column.minWidth || 20;
			}
			columns.push(column);
		}
		// Sort columns by their `ordinal` field
		columns.sort((a, b) => a.ordinal - b.ordinal);
		// And then reset `ordinal` fields since there might be duplicates
		// if new columns got added recently
		columns.forEach((column, index) => column.ordinal = index);

		// Setting column widths
		const visibleColumns =
			columns.reduce((accumulator, column) => accumulator += column.hidden ? 0 : 1, 0);
		const containerWidth = this._virtualizedTable._containerWidth;
		let columnWidths = {};
		for (let i = 0; i < columns.length; i++) {
			let column = columns[i];

			if (!column.hidden) {
				if (column.width) {
					columnWidths[column.dataKey] = column.width;
				}
				else {
					column.flex = column.flex || 1;
					columnWidths[column.dataKey] = column.width = containerWidth / visibleColumns * (column.flex || 1);
				}
			}
			// Serializing back column settings for storage
			columnsSettings[column.dataKey] = this._getColumnPrefsToPersist(column);
		}
		// Storing back persist settings to account for legacy upgrades
		this._storePrefs(columnsSettings);

		this._adjustColumnWidths();
		// Set column width CSS rules
		this.onResize(columnWidths);
		// Whew, all this just to get a list of columns
	}

	_initializeStyleMap() {
		const stylesheetClass = this._styleKey + "-style";
		this._cssSuffix = '-' + this._styleKey;
		this._stylesheet = document.querySelector(`.${stylesheetClass}`);
		if (this._stylesheet) {
			this._columnStyleMap = {};
			for (let i = 0; i < this._stylesheet.sheet.cssRules.length; i++) {
				const cssText = this._stylesheet.sheet.cssRules[i].cssText;
				const dataKey = cssText.slice(1, cssText.indexOf('-'));
				this._columnStyleMap[dataKey] = i;
			}
			for (let i = 0; i < this._virtualizedTable.props.columns.length; i++) {
				let column = this._virtualizedTable.props.columns[i];
				if (column.dataKey in this._columnStyleMap) continue;
				const ruleIndex = Object.keys(this._columnStyleMap).length;
				this._stylesheet.sheet.insertRule(`.${column.dataKey + this._cssSuffix} {flex-basis: 100px}`, ruleIndex);
				this._columnStyleMap[column.dataKey] = ruleIndex;
			}
		} else {
			this._stylesheet = document.createElement('style');
			this._stylesheet.className = stylesheetClass;
			document.children[0].appendChild(this._stylesheet);
			this._columnStyleMap = {};
			for (let i = 0; i < this._virtualizedTable.props.columns.length; i++) {
				let column = this._virtualizedTable.props.columns[i];
				this._stylesheet.sheet.insertRule(`.${column.dataKey + this._cssSuffix} {flex-basis: 100px}`, i);
				this._columnStyleMap[column.dataKey] = i;
			}
		}
	}

	_getColumnPrefsToPersist(column) {
		let persistKeys = new Set(column.zoteroPersist); 
		if (!persistKeys) persistKeys = new Set();
		// Always persist
		['ordinal', 'hidden', 'sortDirection'].forEach(k => persistKeys.add(k));
		let persistSettings = {};
		for (const key in column) {
			if (persistKeys.has(key) || key == 'dataKey') {
				persistSettings[key] = column[key];
			}
		}
		return persistSettings;
	}

	_updateVirtualizedTable() {
		this._virtualizedTable.forceUpdate(() => {
			this._virtualizedTable._jsWindow.invalidate();
		});
	}

	_getPrefs() {
		return this._virtualizedTable.props.getColumnPrefs();
	}
	
	_storePrefs(prefs) {
		this._virtualizedTable.props.storeColumnPrefs(prefs);
	}

	_adjustColumnWidths = () => {
		if (!this._virtualizedTable.props.firstColumnExtraWidth) {
			return;
		}

		const extraWidth = this._virtualizedTable.props.firstColumnExtraWidth;
		this._columns.filter(c => !c.hidden).forEach((column, index) => {
			const isFirstColumn = index === 0;
			if (column.fixedWidth) {
				column.width = isFirstColumn ? parseInt(column.originalWidth) + extraWidth : column.originalWidth;
			}
			if (column.staticWidth) {
				column.minWidth = isFirstColumn ? (column.originalMinWidth ?? 20) + extraWidth : column.originalMinWidth;
				column.width = isFirstColumn ? Math.max(parseInt(column.width) ?? 0, column.minWidth) : column.width;
			}
		});
	};

	/**
	 * Programatically sets the injected CSS width rules for each column.
	 * This is necessary for performance reasons
	 *
	 * @param columnWidths {Object} dictionary of columnId: width (px)
	 */
	onResize = (columnWidths, storePrefs=false) => {
		if (storePrefs) {
			var prefs = this._getPrefs();
		}

		for (let [dataKey, width] of Object.entries(columnWidths)) {
			if (typeof dataKey == "number") {
				dataKey = this._columns[dataKey].dataKey;
			}
			const column = this._columns.find(column => column.dataKey == dataKey);
			const styleIndex = this._columnStyleMap[dataKey];
			if (storePrefs && !column.fixedWidth) {
				column.width = width;
				prefs[dataKey] = this._getColumnPrefsToPersist(column);
			}
			if (column.fixedWidth) {
				width = column.width;
			}
			if (column.fixedWidth && column.width || column.staticWidth) {
				this._stylesheet.sheet.cssRules[styleIndex].style.setProperty('flex', `0 0`, `important`);
				this._stylesheet.sheet.cssRules[styleIndex].style.setProperty('max-width', `${width}px`, 'important');
				this._stylesheet.sheet.cssRules[styleIndex].style.setProperty('min-width', `${width}px`, 'important');
			} else {
				width = (width - COLUMN_PADDING);
				Zotero.debug(`Columns ${dataKey} width ${width}`);
				this._stylesheet.sheet.cssRules[styleIndex].style.setProperty('flex-basis', `${width}px`);
			}
		}
		if (storePrefs) {
			this._storePrefs(prefs);
		}
	}

	setOrder = (index, insertBefore) => {
		const column = this._columns[index];
		if (column.ordinal == insertBefore) return;
		column.ordinal = insertBefore;
		this._columns.sort((a, b) => {
			// newly inserted column goes before the existing column with same `ordinal` value
			if (a.ordinal == b.ordinal) return a == column ? -1 : 1;
			return a.ordinal - b.ordinal;
		});

		this._adjustColumnWidths();
		this.onResize(Object.fromEntries(this._columns.map(c => [c.dataKey, c.width])));

		let prefs = this._getPrefs();
		// reassign columns their ordinal values and set the prefs
		this._columns.forEach((column, index) => {
			prefs[column.dataKey] = prefs[column.dataKey] || {};
			prefs[column.dataKey].ordinal = column.ordinal = index;
		});
		this._storePrefs(prefs);
		this._updateVirtualizedTable();
	}
	
	restoreDefaultOrder = () => {
		let prefs = this._getPrefs();
		if (this._virtualizedTable.props.getDefaultColumnOrder) {
			let defaultOrder = this._virtualizedTable.props.getDefaultColumnOrder();
			for (const column of this._columns) {
				column.ordinal = defaultOrder[column.dataKey];
				prefs[column.dataKey].ordinal = defaultOrder[column.dataKey];
			}
		}
		else {
			for (const column of this._columns) {
				column.ordinal = this._virtualizedTable.props.columns.findIndex(
					col => col.dataKey == column.dataKey);
				prefs[column.dataKey].ordinal = column.ordinal;
			}
		}
		this._columns.sort((a, b) => a.ordinal - b.ordinal);
		this._adjustColumnWidths();
		this.onResize(Object.fromEntries(this._columns.map(c => [c.dataKey, c.width])));
		this._storePrefs(prefs);
		this._updateVirtualizedTable();
	}

	toggleHidden(index) {
		const column = this._columns[index];
		column.hidden = !column.hidden;

		let prefs = this._getPrefs();
		if (prefs[column.dataKey]) {
			prefs[column.dataKey].hidden = column.hidden;
		}
		this._adjustColumnWidths();
		this.onResize(Object.fromEntries(this._columns.map(c => [c.dataKey, c.width])));
		this._storePrefs(prefs);
		this._updateVirtualizedTable();
	}
	
	toggleSort(sortIndex) {
		if (!this._virtualizedTable.props.onColumnSort) return;
		
		var sortedColumn;
		this._columns.forEach((column, index) => {
			if (index != sortIndex) {
				delete column.sortDirection;
			}
			else {
				sortedColumn = column;
				if (column.sortDirection) {
					column.sortDirection *= -1;
				}
				else {
					column.sortDirection = column.sortReverse ? -1 : 1;
				}
			}
		});
		this._virtualizedTable.props.onColumnSort(sortIndex, sortedColumn.sortDirection);
		this._virtualizedTable.forceUpdate();
	}

	getAsArray() {
		return this._columns;
	}
};

function renderCell(index, data, column, dir = null) {
	column = column || { columnName: "" };
	let span = document.createElement('span');
	span.className = `cell ${column.className}`;
	span.textContent = data;
	if (dir) span.dir = dir;
	return span;
}

function renderCheckboxCell(index, data, column, dir = null) {
	let span = document.createElement('span');
	span.className = `cell checkbox ${column.className}`;
	if (dir) span.dir = dir;
	span.setAttribute('role', 'checkbox');
	span.setAttribute('aria-checked', data);
	if (data) {
		span.appendChild(getCSSIcon('IconTick'));
	}
	return span;
}

function makeRowRenderer(getRowData) {
	return function (index, selection, oldDiv, columns) {
		let div;
		if (oldDiv) {
			div = oldDiv;
			div.innerHTML = "";
		}
		else {
			div = document.createElement('div');
			div.className = "row";
		}

		div.classList.toggle('selected', selection.isSelected(index));
		div.classList.toggle('focused', selection.focused == index);
		const rowData = getRowData(index);
		let ariaLabel = "";
		
		if (columns.length) {
			for (let column of columns) {
				if (column.hidden) continue;

				if (column.type === 'checkbox') {
					div.appendChild(renderCheckboxCell(index, rowData[column.dataKey], column));
				}
				else {
					div.appendChild(renderCell(index, rowData[column.dataKey], column));
				}
				let columnName = column.label;
				if (column.label in Zotero.Intl.strings) {
					columnName = Zotero.getString(column.label);
				}
				ariaLabel += `${columnName}: ${rowData[column.dataKey]} `;
			}
		}
		else {
			div.appendChild(renderCell(index, rowData));
		}

		div.setAttribute("aria-label", ariaLabel);
		return div;
	};
}

function formatColumnName(column) {
	if (column.label in Zotero.Intl.strings) {
		return Zotero.getString(column.label);
	}
	else if (/^[^\s]+\w\.\w[^\s]+$/.test(column.label)) {
		try {
			let labelString = Zotero.getString(column.label);
			if (labelString !== column.label) {
				return labelString;
			}
		}
		catch (e) {
			// ignore missing string
		}
	}
	return column.label;
}

module.exports = VirtualizedTable;
module.exports.TreeSelection = TreeSelection;
module.exports.TreeSelectionStub = TreeSelectionStub;
module.exports.renderCell = renderCell;
module.exports.renderCheckboxCell = renderCheckboxCell;
module.exports.makeRowRenderer = makeRowRenderer;
module.exports.formatColumnName = formatColumnName;
