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

		_tabID = null;

		get tabID() {
			return this._tabID;
		}

		set tabID(id) {
			this._tabID = id;
		}

		get tabData() {
			return Zotero_Tabs._getTab(this._tabID);
		}

		/**
		 * @returns {number | null}
		 * @description The width of the sidebar in pixels.
		 * If the content does not have a sidebar, this will be null.
		 */
		get sidePaneWidth() {
			return this.getAttribute("sidePaneWidth");
		}

		set sidePaneWidth(width) {
			this._sidePaneWidth = width;
		}

		get hasSidePane() {
			return this.hasAttribute("sidePaneWidth");
		}

		async init() {
			
		}

		async destroy() {
		}

		setSidePaneWidth(width) {
			this.setAttribute("sidePaneWidth", width);
			this.dispatchEvent(new CustomEvent("side-pane-resize", {
				detail: {
					width,
				}
			}));
		}

		setBottomPlaceholderHeight(height) {
			this.dispatchEvent(new CustomEvent("bottom-placeholder-resize", {
				detail: {
					height,
				}
			}));
		}

		setFocus() {
			this.dispatchEvent(new CustomEvent("set-focus"));
		}
	}

	customElements.define("tab-content", TabContent);
};
