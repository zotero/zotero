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
const { injectIntl } = require('react-intl');
const { IconDownChevron, getDOMElement } = require('components/icons');

const RESIZER_WIDTH = 5; // px

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
			_focused: 0,
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
	 * Toggles an item's selection state, updates focused item to index.
	 * @param index {Number} The index is 0-clamped.
	 * @param shouldDebounce {Boolean} Whether the update to the tree should be debounced
	 */
	toggleSelect(index, shouldDebounce) {
		index = Math.max(0, index);
		if (this.selected.has(index)) {
			this.selected.delete(index);
		}
		else {
			this.selected.add(index);
		}

		if (this.selectEventsSuppressed) return;

		if (this._tree.invalidate) {
			this._tree.invalidateRow(index);
		}
		this.pivot = index;
		this._focused = index;
		this._updateTree(shouldDebounce);
	}

	clearSelection() {
		this.selected = new Set();
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
		index = Math.max(0, index);
		if (this.selected.size == 1 && this._focused == index && this.pivot == index) {
			return false;
		}

		let toInvalidate = Array.from(this.selected);
		toInvalidate.push(index);
		this.selected = new Set([index]);
		this._focused = index;
		this.pivot = index;

		if (this.selectEventsSuppressed) return true;

		this._tree.scrollToRow(index);
		this._updateTree(shouldDebounce);
		if (this._tree.invalidate) {
			toInvalidate.forEach(this._tree.invalidateRow.bind(this._tree));
		}
		return true;
	}

	_rangedSelect(from, to, augment) {
		from = Math.max(0, from);
		to = Math.max(0, to);
		if (!augment) {
			this.selected = new Set();
		}
		for (let i = from; i <= to; i++) {
			this.selected.add(i);
		}
	}

	rangedSelect(from, to, augment) {
		this._rangedSelect(from, to, augment);

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
	 * @param shouldDebounce {Boolean} Whether the update to the tree should be debounced
	 */
	shiftSelect(index, shouldDebounce) {
		index = Math.max(0, index);
		let from = Math.min(index, this.pivot);
		let to = Math.max(index, this.pivot);
		this._focused = index;
		let oldSelected = this.selected;
		this._rangedSelect(from, to);

		if (this.selectEventsSuppressed) return;

		if (this._tree.invalidate) {
			for (let index of this.selected) {
				if (oldSelected.has(index)) {
					oldSelected.delete(index);
					continue;
				}
				this._tree.invalidateRow(index);
			}
			for (let index of oldSelected) {
				this._tree.invalidateRow(index);
			}
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
		}
	}

	get count() {
		return this.selected.size;
	}

	get focused() {
		return this._focused;
	}

	set focused(index) {
		index = Math.max(0, index);
		let oldValue = this._focused;
		this._focused = index;

		if (this.selectEventsSuppressed) return;

		this._updateTree();
		if (this._tree.invalidate) {
			this._tree.invalidateRow(oldValue);
			this._tree.invalidateRow(index);
		}
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
		this._jsWindowID = `virtualized-table-list-${Zotero.Utilities.randomString(5)}`;
		this._containerWidth = props.containerWidth || window.innerWidth;
		
		this._columns = new Columns(this);
		
		this._rowHeight = props.rowHeight;
		if (!this._rowHeight) {
			this._rowHeight = 20; // px
			this._rowHeight *= Zotero.Prefs.get('fontSize');
			if (Zotero.isMac && this._rowHeight > 20) {
				this._rowHeight -= 2;
			}
		}
			
		this.selection = new TreeSelection(this);
		

		// Due to how the Draggable element works dragging (for column dragging and for resizing)
		// is not handled via React events but via native ones attached on `document`
		// Since React attaches its event handlers on `document` as well
		// there is no way to prevent bubbling. Thus we have to do custom
		// handling to prevent header resorting when "mouseup" event is issued
		// after dragging actions
		this.isHeaderMouseUp = true;
		
		this._isMouseDrag = false;
		
		this.onSelection = oncePerAnimationFrame(this._onSelection);
	}

	static defaultProps = {
		label: '',

		showHeader: false,
		// Array of column objects like the ones in itemTreeColumns.js
		columns: [],
		onColumnSort: noop,
		onColumnPickerMenu: noop,
		getColumnPrefs: () => ({}),
		storeColumnPrefs: noop,
		staticColumns: false,

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
		rowHeight: PropTypes.number,
		// An array of two elements for alternating row colors
		alternatingRowColors: PropTypes.array,
		// For screen-readers
		label: PropTypes.string,

		showHeader: PropTypes.bool,
		// Array of column objects like the ones in itemTreeColumns.js
		columns: PropTypes.array,
		onColumnPickerMenu: PropTypes.func,
		onColumnSort: PropTypes.func,
		getColumnPrefs: PropTypes.func,
		storeColumnPrefs: PropTypes.func,
		// Makes columns unmovable, unsortable, etc
		staticColumns: PropTypes.bool,
		// Used for initial column widths calculation
		containerWidth: PropTypes.number,

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

		// If you want to perform custom key handling it should be in this function
		// if it returns false then virtualized-table's own key handler won't run
		onKeyDown: PropTypes.func,

		onDragOver: PropTypes.func,
		onDrop: PropTypes.func,

		// Enter, double-clicking
		onActivate: PropTypes.func,

		onItemContextMenu: PropTypes.func,
	};

	// ------------------------ Selection Methods ------------------------- //
		
	_preventArrowKeyScrolling = (e) => {
		switch (e.key) {
			case "ArrowUp":
			case "ArrowDown":
			case "ArrowLeft":
			case "ArrowRight":
			case "PageUp":
			case "PageDown":
			case "Home":
			case "End":
			case " ":
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
	 *
	 * @param e
	 * @private
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
	 * @private
	 */
	_onJumpSelect(direction, selectTo) {
		if (direction == 1) {
			const lastVisible = this._jsWindow.getLastVisibleRow();
			if (this.selection.focused != lastVisible) {
				return this.onSelection(lastVisible, selectTo);
			}
		}
		else {
			const firstVisible = this._jsWindow.getFirstVisibleRow();
			if (this.selection.focused != firstVisible) {
				return this.onSelection(firstVisible, selectTo);
			}
		}
		const height = document.getElementById(this._jsWindowID).clientHeight;
		const numRows = Math.floor(height / this._rowHeight);
		let destination = this.selection.focused + (direction * numRows);
		const rowCount = this.props.getRowCount();
		destination = Math.min(destination, rowCount - 1);
		destination = Math.max(0, destination);
		return this.onSelection(destination, selectTo);
	}

	/**
	 * Handles key down events in the tree's container.
	 *
	 * @param {Event} e
	 */
	_onKeyDown = (e) => {
		if (this.props.onKeyDown && this.props.onKeyDown(e) === false) return;

		this._preventArrowKeyScrolling(e);

		if (e.altKey) return;
		
		const shiftSelect = e.shiftKey;
		const movePivot = e.ctrlKey || e.metaKey;
		const rowCount = this.props.getRowCount();

		switch (e.key) {
		case "ArrowUp":
			let prevSelect = this.selection.focused - 1;
			while (prevSelect > 0 && !this.props.isSelectable(prevSelect)) {
				prevSelect--;
			}
			prevSelect = Math.max(0, prevSelect);
			this.onSelection(prevSelect, shiftSelect, false, movePivot, e.repeat);
			break;

		case "ArrowDown":
			let nextSelect = this.selection.focused + 1;
			while (nextSelect < rowCount && !this.props.isSelectable(nextSelect)) {
				nextSelect++;
			}
			nextSelect = Math.min(nextSelect, rowCount - 1);
			this.onSelection(nextSelect, shiftSelect, false, movePivot, e.repeat);
			break;

		case "Home":
			this.onSelection(0, shiftSelect, false, movePivot);
			break;

		case "End":
			this.onSelection(rowCount - 1, shiftSelect, false, movePivot);
			break;
			
		case "PageUp":
			this._onJumpSelect(-1, shiftSelect, e.repeat);
			break;
			
		case "PageDown":
			this._onJumpSelect(1, shiftSelect, e.repeat);
			break;

		case "a":
			// i.e. if CTRL/CMD pressed down
			if (movePivot) this.selection.rangedSelect(0, this.props.getRowCount()-1);
			break;
			
		case " ":
			this.onSelection(this.selection.focused, false, true);
			break;
		}
		
		
		if (shiftSelect || movePivot) return;
		
		switch (e.key) {
		case "ArrowLeft":
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

		case "ArrowRight":
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

		case "Enter":
			this._activateNode(e);
			break;
		}
	}
	
	_onDragStart = () => {
		this._isMouseDrag = true;
	}
	
	_onDragEnd = () => {
		this._isMouseDrag = false;
	}
	
	_handleMouseDown = async (e, index) => {
		const modifierClick = e.shiftKey || e.ctrlKey || e.metaKey;
		if (e.button == 2) {
			if (!modifierClick && !this.selection.isSelected(index)) {
				this._onSelection(index, false, false);
			}
			if (this.props.onItemContextMenu) {
				this.props.onItemContextMenu(e);
			}
		}
		// All modifier clicks handled in mouseUp per mozilla itemtree convention
		if (!modifierClick && !this.selection.isSelected(index)) {
			this._onSelection(index, false, false);
		}
	}
	
	_handleMouseUp = async (e, index) => {
		const shiftSelect = e.shiftKey;
		const toggleSelection = e.ctrlKey || e.metaKey;
		if (this._isMouseDrag || e.button != 0) {
			// other mouse buttons are ignored
			this._isMouseDrag = false;
			return;
		}
		this._onSelection(index, shiftSelect, toggleSelection);
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
	 * @param index
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
	 *
	 * @param {Boolean} shiftSelect
	 * 		  If true will select from focused up to index (does not update pivot)
	 *
	 * @param {Boolean} toggleSelection
	 * 		  If true will add to selection
	 *
	 * @param {Boolean} movePivot
	 * 		  Will move pivot without adding anything to the selection
	 */
	_onSelection = (index, shiftSelect, toggleSelection, movePivot, shouldDebounce) => {
		if (this.selection.selectEventsSuppressed) return;
		
		if (movePivot) {
			this.selection.focused = index;
			this.selection.pivot = index;
		}
		// Normal selection
		else if (!shiftSelect && !toggleSelection) {
			if (index > 0 && !this.props.isSelectable(index)) {
				return;
			}
			this.selection.select(index, shouldDebounce);
		}
		// Range selection
		else if (shiftSelect && this.props.multiSelect) {
			this.selection.shiftSelect(index, shouldDebounce);
		}
		// If index is not selectable and this is not normal selection we return
		else if (!this.props.isSelectable(index)) {
			return;
		}
		// Additive selection
		else if (this.props.multiSelect) {
			this.selection.toggleSelect(index, shouldDebounce);
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
		const columns = this._getColumns().filter(col => !col.hidden);
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
		const [aColumn, bColumn] = result;
		const a = document.querySelector(`#${this.props.id} .virtualized-table-header .cell.${aColumn.dataKey}`);
		const b = document.querySelector(`#${this.props.id} .virtualized-table-header .cell.${bColumn.dataKey}`);
		const aRect = a.getBoundingClientRect();
		const bRect = b.getBoundingClientRect();
		const offset = aRect.x;
		const widthSum = aRect.width + bRect.width;
		// Column min-width: 20px;
		const aColumnWidth = Math.min(widthSum - 20, Math.max(20, event.clientX - (RESIZER_WIDTH / 2) - offset));
		const bColumnWidth = widthSum - aColumnWidth;
		let onResizeData = {};
		onResizeData[aColumn.dataKey] = aColumnWidth;
		onResizeData[bColumn.dataKey] = bColumnWidth;
		this._columns.onResize(onResizeData);
	}
	
	_getColumns() {
		return this._columns.getAsArray();
	}
	
	_getResizeColumns(index) {
		index = typeof index != "undefined" ? index : this.state.resizing;
		const columns = this._getColumns().filter(col => !col.hidden).sort((a, b) => a.ordinal - b.ordinal);
		let aColumn = columns[index - 1];
		let bColumn = columns[index];
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
			return [bColumn, aColumn];
		}
		return [aColumn, bColumn];
	}

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
		this.setState({ draggingColumn: index });
		this._isMouseDrag = true;
	}

	_handleColumnDragStop = (event, cancelled) => {
		if (!cancelled && typeof this.state.draggingColumn == "number") {
			const { index } = this._findColumnDragPosition(event.clientX);
			// If inserting before the column that was being dragged
			// there is nothing to do
			if (this.state.draggingColumn != index) {
				const visibleColumns = this._getColumns().filter(col => !col.hidden);
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
	
	_handleHeaderMouseUp = (event, dataKey) => {
		if (!this.isHeaderMouseUp || event.button !== 0) {
			this.isHeaderMouseUp = true;
			return;
		}
		this._columns.toggleSort(
			this._getColumns().findIndex(column => column.dataKey == dataKey));
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
	
		this._setAlternatingRows();

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
		}
	}
	
	_setAlternatingRows() {
		if (this.props.alternatingRowColors) {
			this._jsWindow.innerElem.style.background = `
				repeating-linear-gradient(
				  0deg,
				  ${this.props.alternatingRowColors[0]},
				  ${this.props.alternatingRowColors[0]} ${this._rowHeight}px,
				  ${this.props.alternatingRowColors[1]} ${this._rowHeight}px,
				  ${this.props.alternatingRowColors[1]} ${this._rowHeight * 2}px
				)
			`;
		}
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
			node.addEventListener('mouseup', e => this._handleMouseUp(e, index), { passive: true });
			node.addEventListener('dblclick', e => this._activateNode(e, [index]), { passive: true });
		}
		node.style.height = this._rowHeight + 'px';
		node.id = this.props.id + "-row-" + index;
		node.setAttribute('role', 'row');
		return node;
	}

	_renderHeaderCells = () => {
		return this._getColumns().filter(col => !col.hidden).map((column, index) => {
			if (column.hidden) return "";
			let columnName = column.label;
			if (column.label in Zotero.Intl.strings) {
				columnName = this.props.intl.formatMessage({ id: column.label });
			}
			let label = columnName;
			if (column.iconLabel) {
				label = column.iconLabel;
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
				if (!Zotero.isNode && Zotero.isLinux) {
					sortIndicator = <span className={"sort-indicator " + (column.sortDirection === 1 ? "ascending" : "descending")}/>;
				} else {
					sortIndicator = <IconDownChevron className={"sort-indicator " + (column.sortDirection === 1 ? "ascending" : "descending")}/>;
				}
			}
			const className = cx("cell", column.className, { dragging: this.state.draggingColumn == index },
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
					onMouseUp={e => this._handleHeaderMouseUp(e, column.dataKey)}>
					{resizer}
					<span
						key={columnName + '-label'}
						className={`label ${column.dataKey}`}>
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
			onDragOver: this._onDragOver,
			onDrop: e => this.props.onDrop && this.props.onDrop(e),
			className: cx(["virtualized-table", { resizing: this.state.resizing }]),
			id: this.props.id,
			ref: ref => this._topDiv = ref,
			tabIndex: 0,
			role: "table",
		};
		if (this.props.hide) {
			props.style = { display: "none" };
		}
		if (this.props.label) {
			props.label = this.props.label;
		}
		if (this.selection.count > 0) {
			const elem = this._jsWindow && this._jsWindow.getElementByIndex(this.selection.focused);
			if (elem) {
				props['aria-activedescendant'] = elem.id;
			}
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
		if (typeof this.props.rowHeight == 'number') {
			Zotero.debug("Attempting to update virtualized-table font size with a prop-specified rowHeight."
				+ "You should change the prop on the React component instead");
		}
		this._rowHeight = 20; // px
		this._rowHeight *= Zotero.Prefs.get('fontSize');
		if (Zotero.isMac && this._rowHeight > 20) {
			this._rowHeight -= 2;
		}

		if (!this._jsWindow) return;
		this._jsWindow.update(this._getWindowedListOptions());
		this._setAlternatingRows();
		this._jsWindow.invalidate();
	}
	
	_debouncedRerender = Zotero.Utilities.debounce(this.rerender, 200);
	
	_updateWidth() {
		if (!this.props.showHeader) return;
		const jsWindow = document.querySelector(`#${this._jsWindowID} .windowed-list`);
		if (!jsWindow) return;
		const tree = document.querySelector(`#${this.props.id}`);
		const header = document.querySelector(`#${this.props.id} .virtualized-table-header`);
		const scrollbarWidth = Math.max(0,
			tree.getBoundingClientRect().width - jsWindow.getBoundingClientRect().width);
		header.style.width = `calc(100% - ${scrollbarWidth}px)`;
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
			column = Object.assign({}, column, columnsSettings[column.dataKey]);
			column.className = cx(column.className, column.dataKey, column.dataKey + this._cssSuffix,
				{ 'fixed-width': column.fixedWidth });
			if (column.type) {
				column.className += ` cell-${column.type}`;
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
					columnWidths[column.dataKey] = column.width = containerWidth / visibleColumns * (column.flex || 1);
				}
			}
			// Serializing back column settings for storage
			columnsSettings[column.dataKey] = this._getColumnPrefsToPersist(column);
		}
		// Storing back persist settings to account for legacy upgrades
		this._storePrefs(columnsSettings);

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
			this._stylesheet = document.createElementNS("http://www.w3.org/1999/xhtml", 'style');
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
		if (!column.zoteroPersist) return {};
		let persistSettings = {};
		const persistKeys = column.zoteroPersist;
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

	/**
	 * Programatically sets the injected CSS width rules for each column.
	 * This is necessary for performance reasons
	 *
	 * @param columnWidths - dictionary of columnId: width (px)
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
			if (storePrefs) {
				prefs[dataKey] = prefs[dataKey] || {};
				prefs[dataKey].width = width;
			}
			if (column.fixedWidth && column.width) {
				this._stylesheet.sheet.cssRules[styleIndex].style.setProperty('flex', `0 0`, `important`);
				this._stylesheet.sheet.cssRules[styleIndex].style.setProperty('max-width', `${column.width}px`, 'important');
				this._stylesheet.sheet.cssRules[styleIndex].style.setProperty('min-width', `${column.width}px`, 'important');
			} else {
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
		let prefs = this._getPrefs();
		// reassign columns their ordinal values and set the prefs
		this._columns.forEach((column, index) => {
			prefs[column.dataKey] = prefs[column.dataKey] || {};
			prefs[column.dataKey].ordinal = column.ordinal = index;
		});
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
					column.sortDirection = 1;
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

function renderCell(index, data, column) {
	let span = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
	span.className = `cell ${column.className}`;
	span.innerText = data;
	return span;
}

function renderCheckboxCell(index, data, column) {
	let span = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
	span.className = `cell checkbox ${column.className}`;
	span.setAttribute('role', 'checkbox');
	span.setAttribute('aria-checked', data);
	if (data) {
		span.appendChild(getDOMElement('IconTick'));
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
			div = document.createElementNS("http://www.w3.org/1999/xhtml", 'div');
			div.className = "row";
		}

		div.classList.toggle('selected', selection.isSelected(index));
		const rowData = getRowData(index);
		
		for (let column of columns) {
			if (column.hidden) continue;

			if (column.type === 'checkbox') {
				div.appendChild(renderCheckboxCell(index, rowData[column.dataKey], column));
			}
			else {
				div.appendChild(renderCell(index, rowData[column.dataKey], column));
			}
		}

		return div;
	};
}

module.exports = injectIntl(VirtualizedTable, { forwardRef: true });
module.exports.TreeSelection = TreeSelection;
module.exports.TreeSelectionStub = TreeSelectionStub;
module.exports.renderCell = renderCell;
module.exports.renderCheckboxCell = renderCheckboxCell;
module.exports.makeRowRenderer = makeRowRenderer;
