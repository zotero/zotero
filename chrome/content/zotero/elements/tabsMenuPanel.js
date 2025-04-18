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

{
	// The panel CE is defined lazily. Create one now to get
	// panel defined, allowing us to inherit from it.
	if (!customElements.get("panel")) {
		delete document.createXULElement("panel");
	}
	const XULPanelElement = customElements.get("panel");
	class TabsMenuPanel extends XULPanelElement {
		content = MozXULElement.parseXULToFragment(`
		<vbox id="zotero-tabs-menu-wrapper" class="focus-states-target">
			<html:input id="zotero-tabs-menu-filter"
				tabindex="0"
				role="combobox"
				aria-expanded="true"
				aria-owns="zotero-tabs-menu-list"
				aria-controls="zotero-tabs-menu-list"
				data-l10n-id="zotero-tabs-menu-filter"
			/>
			<vbox id="zotero-tabs-menu-list"
				role="listbox"
				tooltip="html-tooltip"></vbox>
		</vbox>
		`);
		
		_filterText = "";

		_selectedIndex = null;

		_wrapper;

		_tabsList;

		_filterInput;

		get visible() {
			return ["showing", "open"].includes(this.state);
		}

		get tabsList() {
			return this._tabsList;
		}

		init() {
			this._wrapper = this.querySelector("#zotero-tabs-menu-wrapper");
			this._tabsList = this.querySelector("#zotero-tabs-menu-list");
			this._filterInput = this.querySelector("#zotero-tabs-menu-filter");

			this.addEventListener("popupshowing", this._handleShowing);
			this.addEventListener("popupshown", this._handleShown);
			this.addEventListener("popuphiding", this._handleHiding);
			this.addEventListener("keydown", this._handleKeydown);
		}

		destroy() {
			this.removeEventListener("popupshowing", this._handleShowing);
			this.removeEventListener("popupshown", this._handleShown);
			this.removeEventListener("popuphiding", this._handleHiding);
			this.removeEventListener("keydown", this._handleKeydown);
		}

		render() {}

		show(elem) {
			this.openPopup(elem, "after_start", -20, -2, false, false);
		}

		// From XULElementBase
		connectedCallback() {
			super.connectedCallback();
			let content = this.content;
			if (content) {
				content = document.importNode(content, true);
				this.append(content);
			}

			MozXULElement.insertFTLIfNeeded("branding/brand.ftl");
			MozXULElement.insertFTLIfNeeded("zotero.ftl");
			if (document.l10n && this.shadowRoot) {
				document.l10n.connectRoot(this.shadowRoot);
			}

			window.addEventListener("unload", this._handleWindowUnload);

			this.initialized = true;
			this.init();
		}

		// From XULElementBase
		disconnectedCallback() {
			super.disconnectedCallback();
			this.replaceChildren();
			this.destroy();
			window.removeEventListener("unload", this._handleWindowUnload);
			this.initialized = false;
		}

		/**
		 * Create the list of opened tabs in tabs menu.
		 */
		refreshList() {
			if (!this.visible) {
				return;
			}
			this._selectedIndex = null;

			// Empty existing nodes
			this._tabsList.replaceChildren();
			let selectedIndex = null;
			let index = 0;
			let validTabs = Zotero_Tabs._tabs.filter(
				(tab) => {
					// Skip tabs whose title wasn't added yet
					return !!tab.title
					// Filter tabs that do not match the filter
					&& tab.title.toLowerCase().includes(this._filterText);
				}
			);
			let tabsCount = validTabs.length;

			// If no tabs are open, show an empty row with a message
			if (tabsCount === 0) {
				let row = document.createElement('div');
				row.id = "zotero-tabs-menu-row-empty";
				row.classList.add("row");
				row.dataset.l10nId = "tabs-menu-row-empty";
				row.role = "option";

				let tabName = document.createElement('div');
				tabName.classList.add("zotero-tabs-menu-entry");
				tabName.setAttribute('tabindex', "-1");
				tabName.dataset.l10nId = "tabs-menu-row-empty-label";
				row.appendChild(tabName);

				this._tabsList.appendChild(row);

				this._filterInput.setAttribute("aria-activedescendant", row.id);
				return;
			}

			let selectedTabID = Zotero_Tabs.selectedID;
			for (let tab of validTabs) {
				// Top-level entry of the opened tabs array
				let row = document.createElement('div');
				row.classList = "row";
				row.id = `zotero-tabs-menu-row-${tab.id}`;
				row.dataset.tabId = tab.id;
				row.setAttribute("index", index);
				row.setAttribute("draggable", true);
				row.setAttribute("role", "option");
				row.dataset.l10nId = "tabs-menu-row";
				row.dataset.l10nArgs = JSON.stringify({
					title: tab.title,
					index: index + 1,
					total: tabsCount,
					isFirst: index === 0,
					isLast: index === tabsCount - 1,
				});

				// Title of the tab
				let tabName = document.createElement('div');
				tabName.setAttribute('flex', '1');
				tabName.setAttribute('class', 'zotero-tabs-menu-entry title');
				tabName.setAttribute('tabindex', "-1");
				tabName.setAttribute('aria-label', tab.title);
				tabName.setAttribute('title', tab.title);

				// Cross button to close a tab
				let closeButton = document.createElement('div');
				closeButton.className = "zotero-tabs-menu-entry close";
				let closeIcon = document.createElement('span');
				closeIcon.setAttribute('class', 'icon icon-css icon-x-8 icon-16');
				closeButton.setAttribute('role', 'button');
				closeButton.dataset.l10nId = 'zotero-tabs-menu-close-button';
				closeButton.appendChild(closeIcon);
				closeButton.addEventListener("click", this._handleCloseClick);

				// Library tab has no close button
				if (tab.id == "zotero-pane") {
					closeButton.hidden = true;
				}

				closeButton.setAttribute('tabindex', "-1");

				// Item type icon
				let span = document.createElement("span");
				span.className = "icon icon-css tab-icon";
				if (tab.id == 'zotero-pane') {
					// Determine which icon from the collection view rows to use (same as in _update())
					let index = ZoteroPane.collectionsView?.selection?.focused;
					if (typeof index !== 'undefined' && ZoteroPane.collectionsView.getRow(index)) {
						let iconName = ZoteroPane.collectionsView.getIconName(index);
						span.classList.add(`icon-${iconName}`);
					}
				}
				else {
					span.classList.add("icon-item-type");
					let item = Zotero.Items.get(tab.data.itemID);
					let dataTypeLabel = item.getItemTypeIconName(true);
					span.setAttribute("data-item-type", dataTypeLabel);
				}

				tabName.appendChild(span);
				// Actual label with bolded substrings matching the filter
				let tabLabel = this.createLabel(tab.title, this._filterText);
				tabName.appendChild(tabLabel);

				// Selected tab is bold
				if (tab.id == selectedTabID) {
					selectedIndex = index;
				}
				tabName.addEventListener("click", this._handleTitleClick);

				row.appendChild(tabName);
				row.appendChild(closeButton);
		
				row.addEventListener("dragstart", this._handleRowDragStart);
				row.addEventListener('dragover', this._handleRowDragOver);
				row.addEventListener('drop', this._handleRowDrop);
				row.addEventListener('dragend', this._handleRowDragEnd);
				this._tabsList.appendChild(row);

				index++;
			}

			if (selectedIndex !== null) {
				this._selectRow(selectedIndex);
			}
			else {
				this.moveSelection("first");
			}
		}

		/**
		 * @param {string} title - Tab's title
		 * @returns {HTMLLabelElement}  <description> with bold substrings of title matching this._filter
		 */
		createLabel(title) {
			let desc = document.createElement('label');
			let regex = new RegExp(`(${Zotero.Utilities.quotemeta(this._filterText)})`, 'gi');
			let matches = title.matchAll(regex);
	
			let lastIndex = 0;
	
			for (let match of matches) {
				if (match.index > lastIndex) {
					// Add preceding text
					desc.appendChild(document.createTextNode(title.substring(lastIndex, match.index)));
				}
				// Add matched text wrapped in <b>
				
				if (match[0]) {
					let b = document.createElement('b');
					b.textContent = match[0];
					desc.appendChild(b);
				}
				lastIndex = match.index + match[0].length;
			}
	
			if (lastIndex < title.length) {
				// Add remaining text
				desc.appendChild(document.createTextNode(title.substring(lastIndex)));
			}
			return desc;
		}

		/**
		 * Move selection to the tab row in the given direction
		 * @param {"next" | "prev" | "first" | "last"} type - Direction to move focus
		 * @returns {void}
		 */
		moveSelection(type = "next") {
			let index = this._selectedIndex;
			if (index === undefined) {
				index = 0;
			}
			let focusTarget;
			let tabsCount = this._tabsList.querySelectorAll("[index]").length;
			switch (type) {
				case "first":
					index = 0;
					break;
				case "last":
					index = tabsCount - 1;
					break;
				case "next":
					index++;
					if (index >= tabsCount) {
						index = 0;
					}
					break;
				case "prev":
					index--;
					if (index < 0) {
						index = tabsCount - 1;
					}
					break;
				default:
					throw new Error("Invalid focus type");
			}
			focusTarget = this._findClosestAvailableFocusTarget(index, type);
			if (!focusTarget) {
				return;
			}
			this._selectRow(parseInt(focusTarget.getAttribute("index")));
		}

		_findClosestAvailableFocusTarget(index, direction) {
			let target = this._wrapper.querySelector(`[index="${index}"]`);
			if (!target) {
				return null;
			}
			let getNextElem = () => {
				if (direction == "next") {
					return target.nextElementSibling;
				}
				return target.previousElementSibling;
			};

			while (target && target.hasAttribute("index") && target.hidden) {
				target = getNextElem();
			}
			return target;
		}

		_selectRow(index) {
			if (this._selectedIndex === index) {
				return;
			}
			this._selectedIndex = index;
			let prevRow = this._tabsList.querySelector(".selected");
			if (prevRow) {
				prevRow.classList.remove("selected");
				prevRow.querySelector(".close").setAttribute("tabindex", "-1");
			}
			let row = this._tabsList.querySelector(`[index="${index}"]`);
			if (row) {
				row.classList.add("selected");
				row.querySelector(".close").setAttribute("tabindex", "0");
				this._filterInput.setAttribute("aria-activedescendant", row.id);
			}
			this._focusInput();
		}


		_focusInput() {
			if (document.activeElement == this._filterInput) {
				return;
			}
			this._filterInput.focus();
		}

		// From XULElementBase
		_handleWindowUnload = () => {
			this.disconnectedCallback();
		};

		_handleShowing = (event) => {
			if (event.originalTarget !== this) return;

			this.refreshList();

			// Make sure that if the menu is very long, there is a small
			// gap left between the top/bottom of the menu and the edge of the screen
			let valuesAreWithinMargin = (valueOne, valueTwo, margin) => {
				return Math.abs(valueOne - valueTwo) <= margin;
			};
			let panelRect = this.getBoundingClientRect();
			const gapBeforeScreenEdge = 25;
			let absoluteTabsMenuTop = window.screenY - panelRect.height + panelRect.bottom;
			let absoluteTabsMenuBottom = window.screenY + panelRect.height + panelRect.top;

			// On windows, getBoundingClientRect does not give us correct top and bottom values
			// until popupshown, so instead use the anchor's position
			if (Zotero.isWin) {
				let anchor = document.getElementById("zotero-tb-tabs-menu");
				let anchorRect = anchor.getBoundingClientRect();
				absoluteTabsMenuTop = window.screenY - panelRect.height + anchorRect.top;
				absoluteTabsMenuBottom = window.screenY + panelRect.height + anchorRect.bottom;
			}
			// screen.availTop is not always right on Linux, so ignore it
			let availableTop = Zotero.isLinux ? 0 : screen.availTop;

			// Check if the end of the tabs menu is close to the edge of the screen
			let atTopScreenEdge = valuesAreWithinMargin(absoluteTabsMenuTop, availableTop, gapBeforeScreenEdge);
			let atBottomScreenEdge = valuesAreWithinMargin(absoluteTabsMenuBottom, screen.availHeight + availableTop, gapBeforeScreenEdge);

			let gap;
			// Limit max height of the menu to leave the specified gap till the screen's edge.
			// Due to screen.availTop behavior on linux, the menu can go outside of what is supposed
			// to be the available screen area, so special treatment for those edge cases.
			if (atTopScreenEdge || (Zotero.isLinux && absoluteTabsMenuTop < 0)) {
				gap = gapBeforeScreenEdge - (absoluteTabsMenuTop - availableTop);
			}
			if (atBottomScreenEdge || (Zotero.isLinux && absoluteTabsMenuBottom > screen.availHeight)) {
				gap = gapBeforeScreenEdge - (screen.availHeight + availableTop - absoluteTabsMenuBottom);
			}
			if (gap) {
				this.style.maxHeight = `${panelRect.height - gap}px`;
			}
			// Try to scroll selected tab into the center
			let selectedTab = this._tabsList.querySelector(".selected");
			if (selectedTab) {
				selectedTab.scrollIntoView({ block: 'center' });
			}

			this._filterInput.addEventListener("input", this._handleFilterInput);
			this._filterInput.addEventListener("blur", this._handleFilterBlur);
		};
		
		_handleShown = () => {
			this._focusInput();
		};

		_handleHiding = (event) => {
			if (event.originalTarget !== this) return;

			// Empty out the filter input field
			this._filterInput.value = "";
			this._filterText = "";
			this.style.removeProperty('max-height');

			this._filterInput.removeEventListener("input", this._handleFilterInput);
			this._filterInput.removeEventListener("blur", this._handleFilterBlur);
		};

		/**
		 * Keyboard navigation within the tabs menu
		 * - Tab/Shift-Tab moves focus from the input field across tab titles and close buttons
		 * - Enter from the input field focuses the first tab
		 * - Enter on a toolbarbutton clicks it
		 * - ArrowUp/ArrowDown on a toolbarbutton moves focus to the next/previous toolbarbutton of the
		 *   same type (e.g. arrowDown from title focuses the next title)
		 * - ArrowUp from the first tab or ArrowDown from the last tab focuses the filter field
		 * - ArrowDown from the filter field focuses the first tab
		 * - ArrowUp from the filter field focuses the last tab
		 * - Home/PageUp focuses the filter field
		 * - End/PageDown focues the last tab title
		 * - CMD-f will focus the input field
		 */
		_handleKeydown = (event) => {
			if (["Home", "PageUp"].includes(event.key)) {
				event.preventDefault();
				this.moveSelection("first");
			}
			else if (["End", "PageDown"].includes(event.key)) {
				event.preventDefault();
				this.moveSelection("last");
			}
			else if (["ArrowUp", "ArrowDown"].includes(event.key)) {
				event.preventDefault();
				if (event.key == "ArrowDown") {
					this.moveSelection("next");
				}
				else {
					this.moveSelection("prev");
				}
			}
			else if (event.key === "Enter") {
				event.preventDefault();
				if (event.target.classList.contains("zotero-tabs-menu-entry")) {
					event.target.click();
					return;
				}
				this._tabsList.querySelector(".selected > .title")?.click();
			}
			else if (event.key == "f" && (Zotero.isMac ? event.metaKey : event.ctrlKey)) {
				this.moveSelection("first");
				event.preventDefault();
				event.stopPropagation();
			}
		};

		/**
		 * Record the value of the filter
		 */
		_handleFilterInput = () => {
			let currentText = this._filterInput.value.toLowerCase();
			if (this._filterText == currentText) {
				return;
			}
			this._filterText = currentText;
			this.refreshList();
		};

		_handleFilterBlur = (event) => {
			setTimeout(() => {
				let currentTarget = document.activeElement;
				if (currentTarget.classList.contains("close") || currentTarget.classList.contains("title")) {
					return;
				}
				// If not title or close button, prevent the blur
				event.preventDefault();
				event.stopPropagation();
				this._focusInput();
			});
		};

		_handleConfirm() {
			let selectedTab = this._tabsList.querySelector(".selected");
			if (selectedTab) {
				selectedTab.click();
			}
		}

		_handleTitleClick = (event) => {
			let tabID = event.target.closest(".row").dataset.tabId;
			this.hidePopup();
			Zotero_Tabs.select(tabID);
		};

		_handleCloseClick = (event) => {
			let row = event.target.closest(".row");
			let tabID = row.dataset.tabId;
			if (!tabID) {
				return;
			}
			Zotero_Tabs.close(tabID);
			this._focusInput();
		};

		_handleRowDragStart = (event) => {
			let row = event.target.closest(".row");
			let tabID = row.dataset.tabId;
			// No drag-drop on the cross button or the library tab
			if (tabID == 'zotero-pane' || event.target.classList.contains("close")) {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			// Prevent drag-drop if the filter is active
			if (this._filterText) {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			event.dataTransfer.setData('zotero/tab', tabID);
			setTimeout(() => {
				// row.classList.remove("hover");
				row.setAttribute("id", "zotero-tabs-menu-dragged");
			});
		};

		_handleRowDragOver = (event) => {
			let row = event.target.closest(".row");
			let rowTabId = row.dataset.tabId;
			event.preventDefault();
			let tabId = event.dataTransfer.getData("zotero/tab");
			if (!tabId || rowTabId == "zotero-pane") {
				return false;
			}
			if (row.getAttribute("id") == "zotero-tabs-menu-dragged") {
				return true;
			}
			let placeholder = document.getElementById("zotero-tabs-menu-dragged");
			if (row.previousSibling?.id == placeholder.id) {
				// If the placeholder exists before the row, swap the placeholder and the row
				row.parentNode.insertBefore(row, placeholder);
				placeholder.setAttribute("index", parseInt(row.getAttribute("index")) + 1);
			}
			else {
				// Insert placeholder before the row
				row.parentNode.insertBefore(placeholder, row);
				placeholder.setAttribute("index", parseInt(row.getAttribute("index")));
			}
			return false;
		};

		_handleRowDrop = (event) => {
			let row = event.target.closest(".row");
			let tabId = event.dataTransfer.getData("zotero/tab");
			let rowIndex = parseInt(row.getAttribute("index"));
			if (rowIndex == 0) return;
			Zotero_Tabs.move(tabId, rowIndex);
		};

		_handleRowDragEnd = (_event) => {
			// If this.move() wasn't called, just re-render the menu
			if (document.getElementById("zotero-tabs-menu-dragged")) {
				this.refreshList();
			}
			this._focusInput();
		};
	}

	customElements.define("tabs-menu-panel", TabsMenuPanel, { extends: "panel" });
}
