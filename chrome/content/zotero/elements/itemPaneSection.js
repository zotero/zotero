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
	
	get collectionTreeRow() {
		return this._collectionTreeRow;
	}
	
	set collectionTreeRow(collectionTreeRow) {
		this._collectionTreeRow = collectionTreeRow;
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
		if (this.hidden || this.skipRender) {
			this._syncRenderPending = true;
			this._asyncRenderPending = true;
			return;
		}
		this._resetRenderedFlags();
		if (this.render) this.render();
		if (this.asyncRender) await this.asyncRender();
	}
}

{
	class ItemPaneCustomSection extends ItemPaneSectionElementBase {
		_hooks = {};

		_sectionButtons = {};

		_refreshDisabled = true;

		get content() {
			let extraButtons = Object.keys(this._sectionButtons).join(",");
			let content = `
				<collapsible-section custom="true" data-pane="${this.paneID}" extra-buttons="${extraButtons}">
					<html:div data-type="body">
						${this.bodyXHTML || ""}
					</html:div>
				</collapsible-section>
				<html:style class="custom-style"></html:style>
			`;
			return MozXULElement.parseXULToFragment(content);
		}

		get paneID() {
			return this._paneID;
		}

		set paneID(paneID) {
			this._paneID = paneID;
			if (this.initialized) {
				this._section.dataset.pane = paneID;
				this.dataset.pane = paneID;
			}
		}

		get bodyXHTML() {
			return this._bodyXHTML;
		}

		/**
		 * @param {string} bodyXHTML
		 */
		set bodyXHTML(bodyXHTML) {
			this._bodyXHTML = bodyXHTML;
			if (this.initialized) {
				this._body.replaceChildren(
					document.importNode(MozXULElement.parseXULToFragment(bodyXHTML), true)
				);
			}
		}

		init() {
			this._section = this.querySelector("collapsible-section");
			this._body = this._section.querySelector('[data-type="body"]');
			this._style = this.querySelector(".custom-style");

			if (this.paneID) this.dataset.pane = this.paneID;
			if (this._label) this._section.label = this._label;
			this.updateSectionIcon();

			this._sectionListeners = [];

			let styles = [];
			for (let type of Object.keys(this._sectionButtons)) {
				let { icon, darkIcon, l10nID, onClick } = this._sectionButtons[type];
				if (!darkIcon) {
					darkIcon = icon;
				}
				let listener = (event) => {
					let props = this._assembleProps(
						this._getHookProps(),
						{ event },
					);
					onClick(props);
				};
				this._section.addEventListener(type, listener);
				this._sectionListeners.push({ type, listener });
				let button = this._section.querySelector(`.${type}`);
				button.dataset.l10nId = l10nID;
				button.style = `--custom-button-icon-light: url('${icon}'); --custom-button-icon-dark: url('${darkIcon}');`;
			}

			this._style.textContent = styles.join("\n");

			this._section.addEventListener("toggle", this._handleToggle);
			this._sectionListeners.push({ type: "toggle", listener: this._handleToggle });

			this._handleInit();

			// Disable refresh until data is load
			this._refreshDisabled = false;
		}

		destroy() {
			this._sectionListeners.forEach(data => this._section?.removeEventListener(data.type, data.listener));

			this._handleDestroy();
			this._hooks = null;
		}

		setL10nID(l10nId) {
			this._section.dataset.l10nId = l10nId;
		}

		setL10nArgs(l10nArgs) {
			this._section.dataset.l10nArgs = l10nArgs;
		}

		registerSectionIcon(options) {
			let { icon, darkIcon } = options;
			if (!darkIcon) {
				darkIcon = icon;
			}
			this._lightIcon = icon;
			this._darkIcon = darkIcon;
			if (this.initialized) {
				this.updateSectionIcon();
			}
		}

		updateSectionIcon() {
			this.style = `--custom-section-icon-light: url('${this._lightIcon}'); --custom-section-icon-dark: url('${this._darkIcon}')`;
		}

		registerSectionButton(options) {
			let { type, icon, darkIcon, l10nID, onClick } = options;
			if (!darkIcon) {
				darkIcon = icon;
			}
			if (this.initialized) {
				Zotero.warn(`ItemPaneCustomSection section button cannot be registered after initialization`);
				return;
			}
			this._sectionButtons[type.replace(/[^a-zA-Z0-9-_]/g, "-")] = {
				icon, darkIcon, l10nID, onClick
			};
		}

		/**
		 * @param {{ type: "render" | "asyncRender" | "itemChange" | "init" | "destroy" | "toggle" }} options
		 */
		registerHook(options) {
			let { type, callback } = options;
			if (!callback) return;
			this._hooks[type] = callback;
		}
		
		_getBasicHookProps() {
			return {
				paneID: this.paneID,
				doc: document,
				body: this._body,
			};
		}

		_getUIHookProps() {
			return {
				item: this.item,
				tabType: this.tabType,
				editable: this.editable,
				setL10nArgs: l10nArgs => this.setL10nArgs(l10nArgs),
				setEnabled: enabled => this.hidden = !enabled,
				setSectionSummary: summary => this._section.summary = summary,
				setSectionButtonStatus: (type, options) => {
					let { disabled, hidden } = options;
					let button = this._section.querySelector(`.${type}`);
					if (!button) return;
					if (typeof disabled !== "undefined") button.disabled = disabled;
					if (typeof hidden !== "undefined") button.hidden = hidden;
				}
			};
		}

		_getHookProps() {
			return Object.assign({}, this._getBasicHookProps(), this._getUIHookProps());
		}

		_assembleProps(...props) {
			return Object.freeze(Object.assign({}, ...props));
		}

		_handleInit() {
			if (!this._hooks.init) return;
			let props = this._assembleProps(
				this._getHookProps(),
				{ refresh: async () => this._handleRefresh() },
			);
			this._hooks.init(props);
		}

		_handleDestroy() {
			if (!this._hooks.destroy) return;
			let props = this._assembleProps(this._getBasicHookProps());
			this._hooks.destroy(props);
		}

		render() {
			if (!this._hooks.render) return false;
			if (!this.initialized || this._isAlreadyRendered()) return false;
			return this._hooks.render(this._assembleProps(this._getHookProps()));
		}

		async asyncRender() {
			if (!this._hooks.asyncRender) return false;
			if (!this.initialized || this._isAlreadyRendered("async")) return false;
			return this._hooks.asyncRender(this._assembleProps(this._getHookProps()));
		}

		async _handleRefresh() {
			if (!this.initialized) return;
			await this._forceRenderAll();
		}

		_handleToggle = (event) => {
			if (!this._hooks.toggle) return;
			let props = this._assembleProps(
				this._getHookProps(),
				{ event },
			);
			this._hooks.toggle(props);
		};

		_handleItemChange() {
			if (!this._hooks.itemChange) return;
			let props = this._assembleProps(this._getHookProps());
			this._hooks.itemChange(props);
		}
	}

	customElements.define("item-pane-custom-section", ItemPaneCustomSection);
}
