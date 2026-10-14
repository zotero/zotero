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

"use strict";

{
	const { ItemPaneSectionElementBase } = ChromeUtils.importESModule(
		"chrome://zotero/content/elements/itemPaneSectionElementBase.mjs",
		{ global: "current" }
	);
	const { loadEmbeddedPluginPage } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/embeddedPage.mjs");

	class ItemPaneCustomSection extends ItemPaneSectionElementBase {
		_hooks = {};

		_sectionButtons = {};

		_pluginID = null;

		_pageMessenger = null;

		_pageChannelDispose = null;

		_refreshDisabled = true;

		// Cache section l10n ID and args for reconnecting
		_sectionL10nId = null;

		_sectionL10nArgs = null;

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

		get pluginID() {
			return this._pluginID;
		}

		set pluginID(pluginID) {
			this._pluginID = pluginID;
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

		get src() {
			return this._src;
		}

		set src(src) {
			this._src = src;
		}

		get fullHeight() {
			return this.hasAttribute("data-full-height");
		}

		set fullHeight(val) {
			this.toggleAttribute("data-full-height", !!val);
		}

		init() {
			this._section = this.querySelector("collapsible-section");
			this._body = this._section.querySelector('[data-type="body"]');
			this._style = this.querySelector(".custom-style");

			if (this.paneID) this.dataset.pane = this.paneID;
			if (this._label) this._section.label = this._label;
			this.updateSectionIcon();

			if (this._sectionL10nId !== null) this.setL10nID(this._sectionL10nId);
			if (this._sectionL10nArgs !== null) this.setL10nArgs(this._sectionL10nArgs);

			this._sectionListeners = [];

			let styles = [];
			for (let type of Object.keys(this._sectionButtons)) {
				let { icon, darkIcon, l10nID, onClick } = this._sectionButtons[type];
				if (!darkIcon) {
					darkIcon = icon;
				}
				let listener = (event) => {
					if (!this._hooksReady) return;
					// `event` is deprecated and stripped for unprivileged plugins by ItemPaneManager
					let props = this._assembleProps(
						this._getHookProps(),
						{ buttonType: type, event },
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

			if (this._src) {
				// Hooks fire once the page has loaded (_initEmbeddedBrowser)
				this._initEmbeddedBrowser().catch(e => Zotero.logError(e));
			}
			else {
				this._handleInit();
			}

			// Disable refresh until data is load
			this._refreshDisabled = false;
		}

		async _initEmbeddedBrowser() {
			this._body.replaceChildren();
			let { element, messenger, dispose } = await loadEmbeddedPluginPage(this._body, this._src, {
				className: "plugin-section-browser",
				pluginID: this._pluginID,
				autoResize: { height: true },
				channel: true,
				tracePath: "Zotero.ItemPaneManager.registerSection.page",
			});
			this._embeddedBrowser = element;
			this._pageMessenger = messenger;
			this._pageChannelDispose = dispose;

			this._embeddedLoaded = true;
			this._handleInit();
			// Replay an item change that happened while the page was loading
			if (this.item) {
				this._handleItemChange();
			}
			await this._forceRenderAll();
		}

		// Embedded sections must not fire hooks before the page has loaded
		get _hooksReady() {
			return !this._src || !!this._embeddedLoaded;
		}

		destroy() {
			this._sectionListeners.forEach(data => this._section?.removeEventListener(data.type, data.listener));
			this._sectionListeners = [];

			this._handleDestroy();
			this._pageChannelDispose?.();
		}

		setL10nID(l10nId) {
			this._section.dataset.l10nId = l10nId;
			this._sectionL10nId = l10nId;
		}

		setL10nArgs(l10nArgs) {
			this._section.dataset.l10nArgs = l10nArgs;
			this._sectionL10nArgs = l10nArgs;
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
			if (this._src) {
				return {
					paneID: this.paneID,
					page: this._pageMessenger,
				};
			}
			return {
				paneID: this.paneID,
				doc: document,
				body: this._body,
			};
		}

		_getUIHookProps() {
			return {
				itemID: this.item?.id,
				// @deprecated Privileged plugins only; the manager strips it for everyone else
				item: this.item,
				tabType: this.tabType,
				editable: this.editable,
				setL10nArgs: l10nArgs => this.setL10nArgs(l10nArgs),
				setEnabled: enabled => this.hidden = !enabled,
				setFullHeight: fullHeight => this.fullHeight = fullHeight,
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
			// If the embedded page never loaded, the init hook never fired
			if (!this._hooks.destroy || !this._hooksReady) return;
			let props = this._assembleProps(this._getBasicHookProps());
			this._hooks.destroy(props);
		}

		render() {
			if (!this._hooks.render || !this._hooksReady) return false;
			if (!this.initialized || this._isAlreadyRendered()) return false;
			return this._hooks.render(this._assembleProps(this._getHookProps()));
		}

		async asyncRender() {
			if (!this._hooks.asyncRender || !this._hooksReady) return false;
			if (!this.initialized || this._isAlreadyRendered("async")) return false;
			return this._hooks.asyncRender(this._assembleProps(this._getHookProps()));
		}

		async _handleRefresh() {
			if (!this.initialized) return;
			await this._forceRenderAll();
		}

		_handleToggle = (event) => {
			if (!this._hooks.toggle || !this._hooksReady) return;
			let props = this._assembleProps(
				this._getHookProps(),
				{ open: this._section.open, event },
			);
			this._hooks.toggle(props);
		};

		_handleItemChange() {
			if (!this._hooks.itemChange || !this._hooksReady) return;
			let props = this._assembleProps(this._getHookProps());
			this._hooks.itemChange(props);
		}
	}

	customElements.define("item-pane-custom-section", ItemPaneCustomSection);
}
