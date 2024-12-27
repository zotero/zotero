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
		<vbox id="zotero-tabs-menu-wrapper">
			<html:input id="zotero-tabs-menu-filter" 
				tabindex="0"
				data-l10n-id="zotero-tabs-menu-filter"
			/>
			<vbox id="zotero-tabs-menu-list" tooltip="html-tooltip"></vbox>
		</vbox>`);
		
		_filterText = "";

		_focusedIndex = 0;

		_ignoreMouseover = false;

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

			this._filterInput.addEventListener("input", this._handleFilterInput);
			this._filterInput.addEventListener("focus", this._handleFilterFocus);
		}

		destroy() {
			this.removeEventListener("popupshowing", this._handleShowing);
			this.removeEventListener("popupshown", this._handleShown);
			this.removeEventListener("popuphiding", this._handleHiding);
			this.removeEventListener("keydown", this._handleKeydown);

			this._filterInput.removeEventListener("input", this._handleFilterInput);
			this._filterInput.removeEventListener("focus", this._handleFilterFocus);
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
			// Empty existing nodes
			this._tabsList.replaceChildren();
			this._focusedIndex = 0;
			let index = 1;
			let _tabs = this._handleGetTabs();
			let selectedTabID = this._handleGetSelectedID();
			for (let [rowIndex, tab] of _tabs.entries()) {
				// Skip tabs whose title wasn't added yet
				if (tab.title == "") {
					continue;
				}
				// Filter tabs that do not match the filter
				if (!tab.title.toLowerCase().includes(this._filterText)) {
					continue;
				}
				// Top-level entry of the opened tabs array
				let row = document.createElement('div');
				row.classList = "row";
				row.setAttribute("index", rowIndex);
				row.setAttribute("draggable", true);

				// Title of the tab
				let tabName = document.createElement('div');
				tabName.setAttribute('flex', '1');
				tabName.setAttribute('class', 'zotero-tabs-menu-entry title');
				tabName.setAttribute('tabindex', `${index++}`);
				tabName.setAttribute('aria-label', tab.title);
				tabName.setAttribute('title', tab.title);

				// Cross button to close a tab
				let closeButton = document.createElement('div');
				closeButton.className = "zotero-tabs-menu-entry close";
				let closeIcon = document.createElement('span');
				closeIcon.setAttribute('class', 'icon icon-css icon-x-8 icon-16');
				closeButton.setAttribute('data-l10n-id', 'zotero-tabs-menu-close-button');
				closeButton.appendChild(closeIcon);
				closeButton.addEventListener("click", () => {
					// Keep the focus on the cross at the same spot
					if (this._focusedIndex == this._tabsList.childElementCount * 2) {
						this._focusedIndex = Math.max(this._focusedIndex - 2, 0);
					}
					this._handleCloseTab(tab.id);
				});

				// Library tab has no close button
				if (tab.id == "zotero-pane") {
					closeButton.hidden = true;
				}

				closeButton.setAttribute('tabindex', `${index++}`);

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
					tabName.classList.add('selected');
				}
				// Onclick, go to selected tab + close popup
				tabName.addEventListener("click", () => {
					this.hidePopup();
					this._handleSelectTab(tab.id);
				});

				row.appendChild(tabName);
				row.appendChild(closeButton);
		
				row.addEventListener("dragstart", (e) => {
					// No drag-drop on the cross button or the library tab
					if (tab.id == 'zotero-pane' || e.target.classList.contains("close")) {
						e.preventDefault();
						e.stopPropagation();
						return;
					}
					e.dataTransfer.setData('zotero/tab', tab.id);
					setTimeout(() => {
						row.classList.remove("hover");
						row.setAttribute("id", "zotero-tabs-menu-dragged");
					});
				});
				

				row.addEventListener('dragover', (e) => {
					e.preventDefault();
					let tabId = e.dataTransfer.getData("zotero/tab");
					if (!tabId || tab.id == "zotero-pane") {
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
				});

				row.addEventListener('drop', (e) => {
					let tabId = e.dataTransfer.getData("zotero/tab");
					let rowIndex = parseInt(row.getAttribute("index"));
					if (rowIndex == 0) return;
					this._handleMoveTab(tabId, rowIndex);
				});

				row.addEventListener('dragend', (_) => {
					// If this.move() wasn't called, just re-render the menu
					if (document.getElementById("zotero-tabs-menu-dragged")) {
						this.refreshList();
					}
				});
				this._tabsList.appendChild(row);
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
		 * Focus on the element in the tabs menu with [tabindex=tabIndex] if given
		 * or [tabindex=this._focusedIndex] otherwise
		 */
		focusEntry(tabIndex = null) {
			tabIndex = tabIndex !== null ? tabIndex : this._focusedIndex;
			if (tabIndex === null) {
				return;
			}
			var nextTab = this._wrapper.querySelector(`[tabindex="${tabIndex}"]`);
			if (!nextTab) {
				return;
			}
			this._ignoreMouseover = true;
			this._focusedIndex = tabIndex;
			let hovered = this._tabsList.querySelector(".hover");
			if (hovered) {
				hovered.classList.remove("hover");
			}
			nextTab.focus();
			// For some reason (likely a mozilla bug),
			// a mouseover event fires at the location where the drag event started after the drop.
			// To not mark the wrong entry as hovered, ignore mouseover events for a bit after the focus change
			setTimeout(() => {
				this._ignoreMouseover = false;
			}, 250);
		}

		// From XULElementBase
		_handleWindowUnload = () => {
			this.disconnectedCallback();
		};

		_handleGetTabs() {
			return Zotero_Tabs._tabs;
		}

		_handleGetSelectedID() {
			return Zotero_Tabs.selectedID;
		}

		_handleSelectTab(tabID) {
			Zotero_Tabs.select(tabID);
		}

		_handleMoveTab(tabID, index) {
			Zotero_Tabs.move(tabID, index);
		}

		_handleCloseTab(tabID) {
			Zotero_Tabs.close(tabID);
		}

		_handleShowing = () => {
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
		};
		
		_handleShown = () => {
			this.focusEntry(0);
		};

		_handleHiding = (event) => {
			if (event.originalTarget !== this) return;

			// Empty out the filter input field
			this._filterInput.value = "";
			this._filterText = "";
			this.style.removeProperty('max-height');
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
			let tabindex = this._focusedIndex;
			if (event.key == "Tab") {
				event.preventDefault();
				let isShift = event.shiftKey;
				let moveTabIndex = () => tabindex++;
				if (isShift) {
					moveTabIndex = () => tabindex--;
				}
				moveTabIndex();
				let candidate = this._wrapper.querySelector(`[tabindex="${tabindex}"]`);
				// If the candidate is hidden (e.g. close button of library tab), skip it
				if (candidate && candidate.hidden) {
					moveTabIndex();
				}
				this.focusEntry(tabindex);
			}
			else if (["Home", "PageUp"].includes(event.key)) {
				event.preventDefault();
				this.focusEntry(0);
			}
			else if (["End", "PageDown"].includes(event.key)) {
				event.preventDefault();
				this.focusEntry(this._tabsList.childElementCount * 2 - 1);
			}
			else if (["ArrowUp", "ArrowDown"].includes(event.key)) {
				event.preventDefault();
				let isFirstRow = tabindex <= 2 && tabindex > 0;
				// Step over 1 index to jump over close button, unless we move
				// from the filter field
				let step = tabindex == 0 ? 1 : 2;
				if (event.key == "ArrowDown") {
					tabindex += step;
				}
				else {
					tabindex -= step;
				}
				// If the candidate is a disabled element (e.g. close button of the library tab),
				// move focus to the element before it
				let candidate = this._wrapper.querySelector(`[tabindex="${tabindex}"]`);
				if (candidate && candidate.disabled) {
					tabindex--;
				}
				if (tabindex <= 0) {
					// ArrowUp from the first tab or the first close button focuses the filter field.
					// ArrowUp from the filter field focuses the last tab
					if (isFirstRow) {
						tabindex = 0;
					}
					else {
						tabindex = this._tabsList.childElementCount * 2 - 1;
					}
				}
				// ArrowDown from the bottom focuses the filter field
				if (tabindex > this._tabsList.childElementCount * 2) {
					tabindex = 0;
				}
				this.focusEntry(tabindex);
			}
			else if (["Enter", " "].includes(event.key)) {
				event.preventDefault();
				if (event.target.id == "zotero-tabs-menu-filter") {
					this.focusEntry(1);
					return;
				}
				event.target.click();
			}
			else if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
				event.preventDefault();
				event.stopPropagation();
			}
			else if (event.key == "f" && (Zotero.isMac ? event.metaKey : event.ctrlKey)) {
				this.focusEntry(0);
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

		_handleFilterFocus = () => {
			this._focusedIndex = 0;
		};
	}

	customElements.define("tabs-menu-panel", TabsMenuPanel, { extends: "panel" });
}
