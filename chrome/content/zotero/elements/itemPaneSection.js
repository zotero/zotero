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


class ItemPaneSectionElementBase extends XULElementBase {
	connectedCallback() {
		super.connectedCallback();
		if (!this.render) {
			Zotero.warn("Pane section must have method render().");
		}
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		if (this._section) {
			this._section.removeEventListener("toggle", this._handleSectionToggle);
			this._section = null;
		}
	}

	initCollapsibleSection() {
		this._section = this.querySelector('collapsible-section');
		if (this._section) {
			this._section.addEventListener("toggle", this._handleSectionToggle);
		}
	}

	/**
	 * @returns {boolean} if false, data change will not be saved
	 */
	_handleDataChange(_type, _value) {
		return true;
	}

	_handleSectionToggle = async (event) => {
		if (event.target !== this._section || !this._section.open) {
			return;
		}
		if (this.render) await this.render(true);
		if (this.secondaryRender) await this.secondaryRender(true);
	};

	/**
	 * @param {"primary" | "secondary"} [type]
	 * @returns {boolean}
	 */
	_isAlreadyRendered(type = "primary") {
		let key = `_${type}RenderItemID`;
		let cachedFlag = this[key];
		if (cachedFlag && this.item?.id == cachedFlag) {
			return true;
		}
		this._lastRenderItemID = this.item.id;
		return false;
	}
}
