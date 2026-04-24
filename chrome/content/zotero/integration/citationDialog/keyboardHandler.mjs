/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
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

import { Zotero } from "chrome://zotero/content/zotero.mjs";

// Keyboard handler for citationDialog
export class CitationDialogKeyboardHandler {
	constructor({ doc }) {
		this.doc = doc;
		this._multiselectStart = null;
	}

	get listLayout() {
		return this.doc.ownerGlobal.listLayout;
	}

	_id(id) {
		return this.doc.getElementById(id);
	}

	// main keydown listener that will call more specific handlers
	// until the event is handled
	handleKeydown(event) {
		let handled = this._handleTopLevelKeydown(event);
		if (!handled) {
			handled = this._handleKeyboardNavigation(event);
		}
	}

	// capturing keydown listener to handle keypresses regardless of if they are handled by
	// lower-level components
	captureKeydown(event) {
		let cmdOrCtrl = Zotero.isMac ? event.metaKey : event.ctrlKey;
		// Cmd/Ctrl-Enter will always accept the dialog regardless of the target (unless within a panel)
		if (event.key == "Enter" && cmdOrCtrl && !event.target.closest("panel")) {
			this.doc.dispatchEvent(new CustomEvent("dialog-accepted"));
			event.stopPropagation();
			event.preventDefault();
			return;
		}
		// arrowUp from the top-most row of the itemTree will focus suggested items or bubble-input
		let noModifiers = !['ctrlKey', 'metaKey', 'shiftKey', 'altKey'].some(key => event[key]);
		if (this._id("zotero-items-tree").contains(event.target) && event.key == "ArrowUp" && noModifiers) {
			let focusedRow = this._id("zotero-items-tree").querySelector(".row.focused");
			if (!focusedRow) return;
			// fetch index from the row's id (e.g. item-tree-citationDialog-row-0)
			let rowIndex = focusedRow.id.split("-")[4];
			if (rowIndex !== "0") return;
			// if there are suggested items, focus them
			if (this._id("library-other-items").querySelector(".item:not([disabled])")) {
				let current = this.doc.querySelector(".selected.current");
				if (current) {
					current.focus();
				}
				else {
					this._navigateGroup({ group: this._id("library-other-items"), current: null, forward: true, shouldSelect: true, shouldFocus: true, multiSelect: false });
				}
			}
			// otherwise, focus bubble-input
			else {
				this._id("bubble-input").focus();
			}
			event.stopPropagation();
			event.preventDefault();
		}
		// arrowUp from the top-most selectable row of the list-mode table will refocus bubble-input
		if (this._id("citationDialog-list-table")?.contains(event.target) && event.key == "ArrowUp" && noModifiers) {
			let table = this.listLayout?._table;
			let focused = table.selection.focused;
			// Check if focused row is the first selectable (item) row
			let rows = this.listLayout._listRows;
			let firstSelectable = rows.findIndex(r => r.isSelectable);
			if (focused <= firstSelectable) {
				table.selection.clearSelection();
				this._id("bubble-input").refocusInput();
				event.stopPropagation();
				event.preventDefault();
			}
		}
	}

	_handleTopLevelKeydown(event) {
		let handled = false;
		let tgt = event.target;
		// Space/Enter will click on keyboard-clickable components.
		// On macOS, focused buttons are only clickable with Space (not Enter),
		// and on Windows they are clickable with both.
		let isKeyboardClickable = tgt.classList.contains("keyboard-clickable") || (Zotero.isWin && tgt.localName == "button");
		if (["Enter", " "].includes(event.key) && isKeyboardClickable) {
			tgt.click();
			handled = true;
		}
		// Unhandled Enter in a panel will close it
		else if (event.key == "Enter" && tgt.closest("panel")) {
			handled = true;
			tgt.closest("panel").hidePopup();
		}
		// Unhandled Enter will accept the existing dialog's state
		else if (event.key == "Enter" && !tgt.closest("panel")) {
			handled = true;
			this.doc.dispatchEvent(new CustomEvent("dialog-accepted"));
		}
		// Unhandled Escape will close the dialog
		else if (event.key == "Escape") {
			handled = true;
			this.doc.dispatchEvent(new CustomEvent("dialog-cancelled"));
		}
		else if (event.key == "f" && (Zotero.isMac ? event.metaKey : event.ctrlKey)) {
			handled = true;
			this._id("bubble-input").focus();
		}
		if (handled) {
			event.preventDefault();
			event.stopPropagation();
		}
		return handled;
	}

	_handleKeyboardNavigation(event) {
		let handled = false;
		let noModifiers = !['ctrlKey', 'metaKey', 'shiftKey', 'altKey'].some(key => event[key]);
		let onlyShiftModifierPossible = !['ctrlKey', 'metaKey', 'altKey'].some(key => event[key]);
		if (event.key == "Tab") {
			handled = this._tabToGroup({ forward: !event.shiftKey });
		}
		// arrow down from bubble input in library mode will focus the current item, if any
		// or navigate into the suggested items group. If the suggested items are empty, focus items table below
		else if (!this._id("library-layout").hidden && event.key == "ArrowDown" && this._id("bubble-input").contains(event.target) && noModifiers) {
			let group = this.doc.querySelector("#library-layout [data-arrow-nav]");
			let current = group.querySelector(".selected.current[tabindex]");
			if (current) {
				current.focus();
			}
			else if (group.querySelector(".item:not([disabled])")) {
				this._navigateGroup({ group, current: null, forward: true, shouldSelect: true, shouldFocus: true, multiSelect: false });
			}
			else if (this._id("zotero-items-tree").querySelector(".row")) {
				this._id("zotero-items-tree").querySelector("[tabindex]").focus();
			}
			handled = true;
		}
		// arrow down from suggested items in library mode will focus items table
		else if (!this._id("library-layout").hidden && event.key == "ArrowDown" && event.target.closest(".itemsContainer") && noModifiers && this._id("zotero-items-tree").querySelector(".row")) {
			this._id("zotero-items-tree").querySelector("[tabindex]").focus();
		}
		// arrow up/down from bubble-input in list mode will move selection in the items list
		else if (!this._id("list-layout").hidden && (event.key == "ArrowDown" || event.key == "ArrowUp") && this._id("bubble-input").contains(event.target) && onlyShiftModifierPossible) {
			let forward = event.key == "ArrowDown";
			let multiSelect = event.shiftKey;
			this._navigateListSelection(forward, multiSelect);
			handled = true;
		}
		// arrowUp from the first item will refocus bubbleInput
		else if (event.key == "ArrowUp" && this._shouldRefocusBubbleInputOnArrowUp() && noModifiers) {
			this._id("bubble-input").refocusInput();
			this.listLayout._table.selection.clearSelection();
			handled = true;
		}
		// handle focus and selection movement within bubble-input and item groups
		else if (event.key.includes("Arrow") && onlyShiftModifierPossible) {
			let arrowDirection = event.target.closest("[data-arrow-nav]")?.getAttribute("data-arrow-nav");
			if (!arrowDirection) return false;
			let multiSelect = !!event.target.closest("[data-multiselectable='true']") && event.shiftKey;
			let current = this.doc.activeElement;
			let group = current.closest("[data-arrow-nav]");
			if (arrowDirection == "horizontal") {
				if (!(event.key === Zotero.arrowNextKey || event.key === Zotero.arrowPreviousKey)) return false;
				// selections only happens with items
				let shouldSelect = event.target.closest(".itemsContainer");
				handled = this._navigateGroup({ group, current, forward: event.key == Zotero.arrowNextKey, shouldSelect, shouldFocus: true, multiSelect });
			}
			if (arrowDirection == "vertical") {
				if (!(event.key == "ArrowUp" || event.key === "ArrowDown")) return false;
				handled = this._navigateGroup({ group, current, forward: event.key === "ArrowDown", shouldSelect: true, shouldFocus: true, multiSelect });
			}
		}
		if (handled) {
			event.stopPropagation();
			event.preventDefault();
		}
		return handled;
	}

	// tab/shift-tab between the main components
	_tabToGroup({ forward = true, startingTabIndex = null }) {
		let currentTabIndex = startingTabIndex;
		if (currentTabIndex === null) {
			let active = this.doc.activeElement;
			let tabindexNode = active.closest("[data-tabindex]");
			if (!tabindexNode) return false;
			currentTabIndex = parseInt(tabindexNode.dataset.tabindex);
		}
		let tabIndexedNodes = [...this.doc.querySelectorAll("[data-tabindex]")];
		// filter out invisible, not focusable, or disabled nodes
		tabIndexedNodes = tabIndexedNodes.filter(node => (node.getAttribute("tabindex") || node.querySelector("[tabindex]")) && !node.disabled && node.getBoundingClientRect().width);
		tabIndexedNodes = tabIndexedNodes.sort((a, b) => {
			if (a.dataset.tabindex == b.dataset.tabindex) {
				// make sure that if there's a "current" node, it will have priority
				let aSelected = a.classList.contains("current") ? -1 : 0;
				let bSelected = b.classList.contains("current") ? -1 : 0;
				return aSelected - bSelected;
			}
			return parseInt(a.dataset.tabindex) - parseInt(b.dataset.tabindex);
		});

		// When going backwards, reverse the array after sorting
		if (!forward) {
			tabIndexedNodes.reverse();
		}

		let nodeToFocus;
		for (let node of tabIndexedNodes) {
			let tabIndex = parseInt(node.dataset.tabindex);
			if ((forward && tabIndex > currentTabIndex) || (!forward && tabIndex < currentTabIndex)) {
				nodeToFocus = node;
				break;
			}
		}
		// If no node was found, wrap around to the first/last node
		if (!nodeToFocus && startingTabIndex === null) {
			nodeToFocus = tabIndexedNodes[0];
		}

		// if node to focus is a part of arrow-navigation group (e.g., suggested items)
		// and we are not re-focusing a previously selected item,
		// navigate into that group to also have the item marked as selected.
		if (nodeToFocus.dataset.arrowNavEnabled && !nodeToFocus.classList.contains("current")) {
			let group = nodeToFocus.closest("[data-arrow-nav]");
			this._navigateGroup({ group, current: null, forward: true, shouldSelect: true, shouldFocus: true, multiSelect: false });
		}
		else if (nodeToFocus.getAttribute("tabindex")) {
			nodeToFocus.focus();
			if (nodeToFocus.id === "citationDialog-list-table") {
				this._ensureListSelection();
			}
		}
		else {
			nodeToFocus.querySelector("[tabindex]:not([hidden])")?.focus();
		}
		return nodeToFocus;
	}


	// Navigate the group by moving selection or focus between nodes in a group
	_navigateGroup({ group, current, forward, multiSelect, shouldFocus, shouldSelect }) {
		// navigable nodes have to be marked with data-arrow-nav-enabled
		let allFocusableWithinGroup = [...group.querySelectorAll("[tabindex][data-arrow-nav-enabled]:not([hidden]):not([disabled])")];
		let nextFocusableIndex = 0;
		for (let i = 0; i < allFocusableWithinGroup.length; i++) {
			if (allFocusableWithinGroup[i] == current) {
				nextFocusableIndex = forward ? (i + 1) : (i - 1);
				break;
			}
		}
		if (nextFocusableIndex < 0 || nextFocusableIndex >= allFocusableWithinGroup.length) return false;
		let nextNode = allFocusableWithinGroup[nextFocusableIndex];
		// multiselect only allowed within the same group: no overlap between selected and opened items
		// mainly to avoid questionable handling of multi-selected collapsed deck of item cards in library mode
		if (multiSelect && current && current.parentNode !== nextNode.parentNode) return current;

		if (shouldFocus) {
			nextNode.focus();
		}
		if (!shouldSelect) return nextNode;
		
		current?.classList.remove("current");
		nextNode.classList.add("current");
		
		if (multiSelect) {
			// on arrow keypress while holding shift, move focus and also perform multiselect
			if (this._multiselectStart === null || !this.doc.contains(this._multiselectStart)) {
				this._multiselectStart = current || nextNode;
			}
			this._selectItems(this._multiselectStart, nextNode);
		}
		else {
			// on arrow keypress without shift, clear multiselect starting point
			this._multiselectStart = null;
			this._selectItems(nextNode);
		}
		
		return nextNode;
	}

	// When focus enters the list-mode table with no selection, select the
	// first item so the user has a starting point for arrow navigation.
	_ensureListSelection() {
		let layout = this.listLayout;
		if (!layout?._table || layout._table.selection.count > 0) return;
		let firstItem = layout._listRows.findIndex(r => r.canBeAdded);
		if (firstItem >= 0) {
			layout._table.selection.select(firstItem);
		}
	}

	// Navigate VT selection up/down while focus stays on bubble-input.
	// ArrowUp past the first selectable row clears selection.
	_navigateListSelection(forward, multiSelect) {
		let table = this.listLayout?._table;
		if (!table) return;
		let selection = table.selection;
		let rows = this.listLayout._listRows;
		let rowCount = rows.length;

		// Find the next selectable index from a given position
		let findSelectable = (from, fwd) => {
			let i = from;
			while (i >= 0 && i < rowCount) {
				if (rows[i]?.canBeAdded) return i;
				i += fwd ? 1 : -1;
			}
			return -1;
		};

		let focused = selection.focused;
		// Nothing selected yet -- select the first selectable row on ArrowDown
		if (selection.count === 0 || focused < 0) {
			if (!forward) return;
			let first = findSelectable(0, true);
			if (first >= 0) {
				selection.select(first);
				table.scrollToRow(first);
			}
			return;
		}

		let next = findSelectable(focused + (forward ? 1 : -1), forward);
		// ArrowUp past the first selectable row -- clear selection
		if (next < 0 && !forward) {
			selection.clearSelection();
			table.scrollToRow(0);
			return;
		}
		if (next < 0) return;

		if (multiSelect) {
			selection.shiftSelect(next);
		}
		else {
			selection.select(next);
		}
		table.scrollToRow(next);
	}

	_shouldRefocusBubbleInputOnArrowUp() {
		if (!this._id("library-layout").hidden) {
			return this._id("library-other-items").contains(this.doc.activeElement);
		}
		if (!this._id("list-layout").hidden) {
			// In list mode, focus stays on bubble-input; arrowUp from the
			// first selected row clears selection (handled in navigateSelection).
			return false;
		}
		return false;
	}

	_selectItems(startNode, endNode) {
		this.doc.dispatchEvent(new CustomEvent("select-items", {
			bubbles: true,
			detail: {
				startNode, endNode
			}
		}));
	}
}
