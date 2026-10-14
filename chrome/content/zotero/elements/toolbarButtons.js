/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://digitalscholar.org

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
	const CUSTOM_BUTTON_CLASS = "zotero-custom-button";

	// Free space to keep when expanding collapsed buttons, to avoid oscillation
	const EXPAND_BUFFER = 24;

	/**
	 * Base class for the toolbar containers of Zotero.ButtonManager buttons.
	 */
	class ToolbarButtonsBase extends XULElementBase {
		_notifierID = null;

		_resizeObserver = null;

		_options = [];

		_overflowButton = null;

		_visibleCount = 0;

		get target() {
			let target = this.getAttribute("target");
			if (!target) {
				throw new Error("Missing required target attribute");
			}
			return target;
		}

		get _notifyTypes() {
			return ["custom-button"];
		}

		init() {
			this._notifierID = Zotero.Notifier.registerObserver(this, this._notifyTypes, "toolbarButtons");
			this._resizeObserver = new ResizeObserver(() => this._onSpacerResize());
			this._observeSpacers();
			this.render();
		}

		destroy() {
			if (this._notifierID) {
				Zotero.Notifier.unregisterObserver(this._notifierID);
				this._notifierID = null;
			}
			this._resizeObserver?.disconnect();
			this._resizeObserver = null;
		}

		notify(action, type) {
			if (type !== "custom-button") {
				return;
			}
			this.render();
		}

		render() {
			this._options = this._getOptions();
			this.replaceChildren();
			for (let option of this._options) {
				this.append(this._buildButton(option));
			}
			this._overflowButton = this._buildOverflowButton();
			this._overflowButton.hidden = true;
			this.append(this._overflowButton);
			this._visibleCount = this._options.length;
			this._updateOverflow();
		}

		_getOptions() {
			return Zotero.ButtonManager.getButtonOptions(this.target);
		}

		/**
		 * Get the elements whose combined width is the toolbar's free space
		 * @abstract
		 * @returns {Element[]}
		 */
		_getSpacers() {
			throw new Error("ToolbarButtonsBase subclass must implement _getSpacers()");
		}

		/**
		 * Get the context object passed to button hooks
		 * @abstract
		 * @returns {object}
		 */
		_getContext() {
			throw new Error("ToolbarButtonsBase subclass must implement _getContext()");
		}

		_observeSpacers() {
			for (let spacer of this._getSpacers()) {
				this._resizeObserver.observe(spacer);
			}
		}

		_onSpacerResize() {
			this._updateOverflow();
		}

		_buildButton(option) {
			let doc = this.ownerDocument;
			let button = doc.createXULElement("toolbarbutton");
			button.className = `zotero-tb-button ${CUSTOM_BUTTON_CLASS}`;
			button.classList.add(option.buttonID);
			button.setAttribute("tabindex", "-1");
			button.dataset.l10nId = option.l10nID;
			if (option.icon || option.darkIcon) {
				button.style.setProperty("--custom-button-icon-light",
					`url(${option.icon || option.darkIcon})`);
				button.style.setProperty("--custom-button-icon-dark",
					`url(${option.darkIcon || option.icon})`);
			}
			if (option._menuTarget) {
				button.setAttribute("type", "menu");
				button.setAttribute("wantdropmarker", "true");
				let popup = doc.createXULElement("menupopup");
				popup.addEventListener("popupshowing", (event) => {
					if (event.target !== event.currentTarget) {
						return;
					}
					Zotero.ButtonManager.updateButtonPopup(popup, option, {
						event,
						getContext: () => this._getContext(),
					});
				});
				button.appendChild(popup);
			}
			else {
				button.addEventListener("command", () => {
					option.onCommand(this._getContext());
				});
			}
			return button;
		}

		_buildOverflowButton() {
			let doc = this.ownerDocument;
			let button = doc.createXULElement("toolbarbutton");
			button.className = "zotero-tb-button zotero-custom-button-overflow";
			button.setAttribute("tabindex", "-1");
			button.setAttribute("type", "menu");
			button.dataset.l10nId = "custom-buttons-overflow";
			let popup = doc.createXULElement("menupopup");
			popup.addEventListener("popupshowing", (event) => {
				if (event.target !== event.currentTarget) {
					return;
				}
				Zotero.ButtonManager.updateOverflowPopup(
					popup,
					this._options.slice(this._visibleCount),
					{ getContext: () => this._getContext() }
				);
			});
			button.appendChild(popup);
			return button;
		}

		/**
		 * Collapse buttons that don't fit into the overflow dropdown, or expand them when there's space
		 */
		_updateOverflow() {
			if (!this.initialized) {
				return;
			}
			let buttons = Array.from(this.children);
			let overflowButton = buttons.pop();
			if (!buttons.length) {
				return;
			}
			let spacers = this._getSpacers();
			// Skip when the surrounding box isn't visible
			if (!spacers.length || !this.parentElement.getBoundingClientRect().width) {
				return;
			}
			let slack = () => spacers.reduce(
				(sum, spacer) => sum + spacer.getBoundingClientRect().width, 0);

			// Collapse until the toolbar is no longer full. One at a time: freed
			// space can be absorbed by the surroundings (e.g. squeezed tabs)
			while (this._visibleCount > 0 && slack() < 1) {
				this._visibleCount--;
				buttons[this._visibleCount].hidden = true;
				overflowButton.hidden = false;
			}

			// Expand while a button (measured via the same-sized overflow button)
			// plus the buffer fits. The last one swaps with the overflow button
			let buttonWidth = () => overflowButton.getBoundingClientRect().width;
			while (this._visibleCount < buttons.length
					&& slack() >= EXPAND_BUFFER
						+ (this._visibleCount < buttons.length - 1 ? buttonWidth() : 0)) {
				buttons[this._visibleCount].hidden = false;
				this._visibleCount++;
			}
			if (this._visibleCount === buttons.length) {
				overflowButton.hidden = true;
			}
		}
	}

	/**
	 * Custom buttons in the main window items toolbar, before the search box.
	 * Free space is measured via the <spacer> siblings in the toolbar
	 */
	class LibraryToolbarButtons extends ToolbarButtonsBase {
		_getSpacers() {
			if (!this.parentElement) {
				return [];
			}
			return Array.from(this.parentElement.querySelectorAll(":scope > spacer"));
		}

		_getContext() {
			return {
				tabType: "library",
				tabSubType: undefined,
				tabID: "zotero-pane",
				itemIDs: this.documentGlobal.ZoteroPane.getSelectedItems(true),
			};
		}
	}

	/**
	 * Custom buttons in the title bar, shown for every tab.
	 * Free space is measured via the flex spacer in the tab bar (tabBar.jsx)
	 */
	class TitlebarButtons extends ToolbarButtonsBase {
		_tabBar = null;

		async init() {
			this._tabBar = this.ownerDocument.getElementById("tab-bar-container");
			this._tabBar?.addEventListener("mouseleave", this._handleTabBarMouseLeave);
			let i = 0;
			while (i < 50 && this.initialized && this._tabBar && !this._getSpacers().length) {
				await Zotero.Promise.delay(100);
				i++;
			}
			// Disconnected while waiting
			if (!this.initialized) {
				return;
			}
			super.init();
		}

		destroy() {
			super.destroy();
			this._tabBar?.removeEventListener("mouseleave", this._handleTabBarMouseLeave);
			this._tabBar = null;
		}

		_handleTabBarMouseLeave = () => {
			this._updateOverflow();
		};

		_getTabInfo() {
			let Zotero_Tabs = this.documentGlobal.Zotero_Tabs;
			let info = Zotero_Tabs.getTabInfo();
			let { tabContentType } = Zotero_Tabs.parseTabType(info.type);
			return Object.assign(info, { tabContentType });
		}

		_getContext() {
			let { id, subType, data, tabContentType } = this._getTabInfo();
			let context = {
				tabType: tabContentType,
				tabSubType: subType,
				tabID: id,
			};
			if (tabContentType === "library") {
				context.itemIDs = this.documentGlobal.ZoteroPane.getSelectedItems(true);
			}
			else {
				context.itemIDs = data?.itemID ? [data.itemID] : [];
			}
			return context;
		}

		_getSpacers() {
			if (!this._tabBar) {
				return [];
			}
			return Array.from(this._tabBar.querySelectorAll(".tabs-wrapper > .tabs > .flex-spacer"));
		}

		_onSpacerResize() {
			// Tab widths are locked while the pointer is over the tab bar (see
			// tabBar.jsx) -- defer the update to the mouseleave handler
			if (this._tabBar?.matches(":hover")) {
				return;
			}
			this._updateOverflow();
		}
	}

	customElements.define("library-toolbar-buttons", LibraryToolbarButtons);
	customElements.define("titlebar-buttons", TitlebarButtons);
}
