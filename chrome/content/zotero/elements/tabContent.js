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
	class TabContent extends XULElementBase {
		content = MozXULElement.parseXULToFragment("");

		get tabID() {
			return this.getAttribute("id");
		}

		set tabID(id) {
			this.setAttribute("id", id);
		}

		get tabData() {
			return Zotero_Tabs._getTab(this.tabID);
		}

		/**
		 * @returns {number | null}
		 * @description The width of the sidebar in pixels.
		 */
		get sidePaneWidth() {
			let state = ZoteroContextPane.getSidePaneState(this.tabData.type);
			if (state) {
				return state.width || 0;
			}
			return null;
		}

		set sidePaneWidth(width) {
			ZoteroContextPane.updateLayout({ sidePaneWidth: width });
		}

		async init() {
		}

		async destroy() {
		}

		/**
		 * Notify the tab content that the tab has been selected or deselected.
		 * Triggered by the Zotero_Tabs when a tab is selected or deselected.
		 * @param {boolean} selected - Whether this tab is currently selected.
		 */
		onTabSelectionChanged(selected) {
			this.dispatchEvent(new CustomEvent("tab-selection-change", {
				detail: {
					selected
				}
			}));
		}

		/**
		 * Notify the tab content that the bottom placeholder height has changed.
		 * @param {number} height - The new height in pixels.
		 */
		setBottomPlaceholderHeight(height) {
			this.dispatchEvent(new CustomEvent("tab-bottom-placeholder-resize", {
				detail: {
					height,
				}
			}));
		}

		/**
		 * Notify the tab content that the context pane has been toggled.
		 * @param {boolean} open - Whether the context pane is open or not.
		 */
		setContextPaneOpen(open) {
			this.dispatchEvent(new CustomEvent("tab-context-pane-toggle", {
				detail: {
					open,
				}
			}));
		}

		/**
		 * Notify the tab content that it has received focus.
		 * Used by the context pane to move focus.
		 */
		setFocus() {
			this.dispatchEvent(new CustomEvent("tab-focus", {
				detail: {
					tabID: this.tabID
				}
			}));
		}
	}

	customElements.define("tab-content", TabContent);
};
