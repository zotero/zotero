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

export class ItemPaneSectionElementBase extends XULElementBase {
	get item() {
		return this._item;
	}

	set item(item) {
		this._item = item;
		if (this._handleItemChange) this._handleItemChange();
	}

	get editable() {
		return this._editable;
	}

	set editable(editable) {
		this._editable = editable;
		this.toggleAttribute('readonly', !editable);
	}

	get tabID() {
		return this._tabID;
	}

	set tabID(tabID) {
		this._tabID = tabID;
	}

	get tabType() {
		return this._tabType;
	}

	set tabType(tabType) {
		this._tabType = tabType;
		this.setAttribute('tabType', tabType);
	}

	get collectionTreeRows() {
		return this._collectionTreeRows;
	}

	set collectionTreeRows(collectionTreeRows) {
		this._collectionTreeRows = collectionTreeRows;
	}

	_syncRenderPending = false;

	_asyncRenderPending = false;

	/** Controlled by parent element */
	skipRender = false;

	get open() {
		return this._section?.open || false;
	}

	set open(val) {
		if (this._section) {
			this._section.open = val;
		}
	}

	get collapsible() {
		return this._section.collapsible;
	}

	set collapsible(val) {
		this._section.collapsible = !!val;
	}

	connectedCallback() {
		super.connectedCallback();
		if (!this.render && !this.asyncRender) {
			Zotero.warn("Pane section must have method render or asyncRender.");
		}
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		if (this._section) {
			this._section.removeEventListener("toggle", this._handleSectionToggle);
			this._section = null;
		}
		this._resetRenderedFlags();
	}

	initCollapsibleSection() {
		this._section = this.querySelector('collapsible-section');
		if (this._section) {
			this._section.addEventListener("toggle", this._handleSectionToggle);
		}
	}

	_handleSectionToggle = async (event) => {
		if (event.target !== this._section || !this._section.open) {
			return;
		}
		await this._forceRenderAll();
	};

	get _renderDependencies() {
		return [this._tabID, this._item?.id];
	}

	/**
	 * @param {"sync" | "async"} [type]
	 * @returns {boolean}
	 */
	_isAlreadyRendered(type = "sync") {
		let key = `_${type}RenderDependencies`;
		let pendingKey = `_${type}RenderPending`;
		let itemIDKey = `_${type}RenderItemID`;

		let oldDependencies = this[key];
		let newDependencies = this._renderDependencies;

		let isPending = this[pendingKey];
		let isRendered = Zotero.Utilities.arrayEquals(oldDependencies, newDependencies);
		if (this.skipRender) {
			if (!isRendered) {
				this[pendingKey] = true;
			}
			// Skip render
			return true;
		}

		if (!isPending && isRendered) {
			return true;
		}
		this[key] = newDependencies;
		this[pendingKey] = false;
		this[itemIDKey] = this.item?.id;
		return false;
	}

	_resetRenderedFlags() {
		// Clear cached flags to allow re-rendering
		delete this._syncRenderDependencies;
		delete this._syncRenderItemID;
		delete this._asyncRenderDependencies;
		delete this._asyncRenderItemID;
	}

	async _forceRenderAll() {
		this._resetRenderedFlags();
		if (this.hidden || this.skipRender) {
			this._syncRenderPending = true;
			this._asyncRenderPending = true;
			return;
		}
		if (this.render) this.render();
		if (this.asyncRender) await this.asyncRender();
	}
}
