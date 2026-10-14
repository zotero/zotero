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

	// Only expand collapsed buttons when this much free space would remain,
	// to avoid oscillation between collapsing and expanding
	const EXPAND_BUFFER = 24;

	class ToolbarButtons extends XULElementBase {
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

		init() {
			this._notifierID = Zotero.Notifier.registerObserver(this, ["custom-button"], "toolbarButtons");
			this._resizeObserver = new ResizeObserver(() => this._updateOverflow());
			for (let spacer of this._getSpacers()) {
				this._resizeObserver.observe(spacer);
			}
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
			this._options = Zotero.ButtonManager.getButtonOptions(this.target, { tabType: "library" });
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
				items: this.documentGlobal.ZoteroPane.getSelectedItems(),
			};
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
				button.addEventListener("command", (event) => {
					option.onCommand(
						event,
						Zotero.ButtonManager.wrapButtonContext(button, () => this._getContext())
					);
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
		 * Collapse buttons that don't fit into the overflow dropdown, or expand
		 * them again when there's enough space.
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

			// Collapse buttons until the toolbar is no longer full
			while (this._visibleCount > 0 && slack() < 1) {
				this._visibleCount--;
				buttons[this._visibleCount].hidden = true;
				overflowButton.hidden = false;
			}

			// Expand collapsed buttons while there's comfortably enough space
			while (this._visibleCount < buttons.length && slack() >= EXPAND_BUFFER) {
				buttons[this._visibleCount].hidden = false;
				this._visibleCount++;
				if (this._visibleCount === buttons.length) {
					overflowButton.hidden = true;
				}
				if (slack() < EXPAND_BUFFER) {
					// Not enough room for this one -- put it back
					this._visibleCount--;
					buttons[this._visibleCount].hidden = true;
					overflowButton.hidden = false;
					break;
				}
			}
		}
	}

	customElements.define("toolbar-buttons", ToolbarButtons);
}
