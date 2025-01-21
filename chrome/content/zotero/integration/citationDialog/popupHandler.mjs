/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
					http://zotero.org
	
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

var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");

// Handle the logic of opening popups and saving/discarding edits to the citaiton items
export class CitationDialogPopupsHandler {
	constructor({ doc }) {
		this.doc = doc;

		this.item = null;
		this.citationItem = null;
		this.discardItemDetailsEdits = false;

		this.setupListeners();
	}

	setupListeners() {
		// Display overlay when a panel appears
		this.doc.addEventListener("popuphidden", (event) => {
			if (event.target.tagName !== "xul:panel") return;
			this._getNode(".overlay").hidden = true;
		});
		this.doc.addEventListener("popupshown", (event) => {
			// make sure overlay doesn't appear on tooltips and etc.
			if (event.target.tagName !== "xul:panel") return;
			this._getNode(".overlay").hidden = false;
			// focus specified target
			let potentialFocusTarget = event.target.getAttribute("focus-target-id");
			if (potentialFocusTarget) {
				this.doc.getElementById(potentialFocusTarget).focus();
			}
			// if there was no focus target, just tab into the panel
			if (!event.target.contains(this.doc.activeElement)) {
				Services.focus.moveFocus(this.doc.defaultView, event.target, Services.focus.MOVEFOCUS_FORWARD, 0);
			}
		});
		// just to make sure we never end up with a stuck overlay if something goes wrong with popups
		this._getNode(".overlay").addEventListener("mousedown", () => {
			this._getNode(".overlay").hidden = true;
		});

		this._getNode("#itemDetails").addEventListener("popuphidden", this.handleItemDetailsClosure.bind(this));
		// Item details Remove btn
		this._getNode("#itemDetails .remove").addEventListener("click", (_) => {
			let event = new CustomEvent("delete-item", {
				bubbles: true,
				detail: {
					dialogReferenceID: this.dialogReferenceID
				}
			});
			this.doc.dispatchEvent(event);
			this.discardItemDetailsEdits = true;
			this._getNode("#itemDetails").hidePopup();
		});
		// Item details Show in Library btn
		this._getNode("#itemDetails .show").addEventListener("click", (_) => {
			this.discardItemDetailsEdits = true;
			this._getNode("#itemDetails").hidePopup();
			Zotero.Utilities.Internal.showInLibrary(this.item.id);
		});
		this._getNode("#itemDetails .done").addEventListener("click", (_) => {
			this._getNode("#itemDetails").hidePopup();
		});
		

		// Capture the keydown on the document to be able to handle Escape
		// when a popup is opened to discard edits
		this.doc.addEventListener("keydown", (event) => {
			if (this._getNode("#itemDetails").state !== "open") return;
			this.captureItemDetailsKeyDown(event);
		}, true);
		// Handle remaining keypress events with a usual bubbling listener
		this._getNode("#itemDetails").addEventListener("keypress", this.handleItemDetailsKeypress.bind(this));
	}

	openItemDetails(dialogReferenceID, item, citationItem, itemDescription) {
		this.item = item;
		this.citationItem = citationItem;
		this.dialogReferenceID = dialogReferenceID;

		let bubble = this._getNode(`[dialogReferenceID='${dialogReferenceID}']`);
		let bubbleRect = bubble.getBoundingClientRect();
		let popup = this._getNode("#itemDetails");
		popup.openPopup(bubble, "after_start", bubble.clientWidth / 2, 0, false, false, null);
		// popup should be cenetered on the bubble
		popup.style.left = `${Math.max(10, bubbleRect.left + (bubbleRect.width / 2) - (popup.offsetWidth / 2))}px`;
		popup.style.top = `${bubbleRect.bottom + 10}px`;

		// add locator labels if they don't exist yet
		if (this._getNode("#label").childElementCount == 0) {
			let locators = Zotero.Cite.labels;
			for (var locator of locators) {
				let locatorLabel = Zotero.Cite.getLocatorString(locator);
				var option = this.doc.createElement("option");
				option.value = locator;
				option.label = locatorLabel;
				this._getNode("#label").appendChild(option);
			}
		}

		// Add header and fill inputs with their values
		let description = itemDescription;
		this._getNode("#itemDetails").querySelector(".description")?.remove();
		this._getNode("#itemTitle").textContent = this.item.getDisplayTitle();
		this._getNode("#itemTitle").after(description);
		let dataTypeLabel = this.item.getItemTypeIconName(true);
		this._getNode("#itemDetails").querySelector(".icon").setAttribute("data-item-type", dataTypeLabel);

		this._getNode("#label").value = this.citationItem.label || "page";
		this._getNode("#locator").value = this.citationItem.locator || "";
		this._getNode("#prefix").value = this.citationItem.prefix || "";
		this._getNode("#suffix").value = this.citationItem.suffix || "";
		this._getNode("#suppress-author").checked = !!this.citationItem["suppress-author"];
		bubble.classList.add("showingDetails");
	}

	// When item details popup is closed, sync it's data to citationItems
	handleItemDetailsClosure() {
		let bubble = this._getNode(`[dialogReferenceID='${this.dialogReferenceID}']`);
		if (!bubble) return;
		bubble.classList.remove("showingDetails");
		if (this.discardItemDetailsEdits) {
			this.discardItemDetailsEdits = false;
			return;
		}
		this.citationItem.label = this._getNode("#locator").value ? this._getNode("#label").value : null;
		this.citationItem.locator = this._getNode("#locator").value;
		this.citationItem.prefix = this._getNode("#prefix").value;
		this.citationItem.suffix = this._getNode("#suffix").value;
		this.citationItem["suppress-author"] = this._getNode("#suppress-author").checked;
	}

	captureItemDetailsKeyDown(event) {
		if (event.key == "Escape") {
			this.discardItemDetailsEdits = true;
			event.stopPropagation();
			event.preventDefault();
		}
	}

	handleItemDetailsKeypress(event) {
		// Enter on a an input will save changes, hide the popup and refocus last input
		if (event.key == "Enter" && ["input"].includes(event.target.tagName) && !event.target.getAttribute("type")) {
			this._getNode("#itemDetails").setAttribute("refocus-input", true);
			this._getNode("#itemDetails").hidePopup();
		}
	}

	showRetractedWarning(item) {
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
			+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
		var disableWarningCheckbox = { value: false };
		var result = ps.confirmEx(null,
			Zotero.getString('general.warning'),
			Zotero.getString('retraction.citeWarning.text1') + '\n\n'
				+ Zotero.getString('retraction.citeWarning.text2'),
			buttonFlags,
			Zotero.getString('general.continue'),
			null,
			Zotero.getString('pane.items.showItemInLibrary'),
			Zotero.getString('retraction.citationWarning.dontWarn'), disableWarningCheckbox);
		// Cancel
		if (result == 1) {
			return false;
		}
		// Show in library
		if (result == 2) {
			Zotero.Utilities.Internal.showInLibrary(item.id);
			return false;
		}
		// Checked "Do not warn about this item"
		if (disableWarningCheckbox.value) {
			Zotero.Retractions.disableCitationWarningsForItem(item);
		}
		return true;
	}

	async showDuplicateItemWarning() {
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
		
		let [title, message] = await this.doc.l10n.formatValues([
			"integration-citationDialog-duplicates-warning-title",
			"integration-citationDialog-duplicates-warning-message"
		]);
		let result = ps.confirmEx(
			null,
			title,
			message,
			buttonFlags,
			Zotero.getString('general.continue'),
			"", "", "", {}
		);
		// Cancel
		if (result == 1) return false;
		return true;
	}


	_getNode(selector) {
		return this.doc.querySelector(selector);
	}
}
