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

// Handle the logic of opening popups and saving/discarding edits to the citation items
export class CitationDialogPopupsHandler {
	constructor({ doc }) {
		this.doc = doc;

		this.item = null;
		this.citationItem = null;
		this.discardItemDetailsEdits = false;
		this.itemDetailsWhenOpened = {};
		this.itemDetailsTimeOpened = null;

		this.setUpListeners();
	}

	setUpListeners() {
		this.doc.addEventListener("popupshown", (event) => {
			// make sure overlay doesn't appear on tooltips and etc.
			if (event.target.tagName !== "xul:panel") return;
			// if focus is not in the panel tab into it
			if (!event.target.contains(this.doc.activeElement)) {
				Services.focus.moveFocus(this.doc.defaultView, event.target, Services.focus.MOVEFOCUS_FORWARD, 0);
			}
		});
		// Update bubbles in citation dialog as one makes edits
		this._getNode("#itemDetails").addEventListener("input", this.handleItemDetailsChange.bind(this));

		this._getNode("#itemDetails").addEventListener("popupshown", this.handleItemDetailsShown.bind(this));
		this._getNode("#itemDetails").addEventListener("popuphidden", this.handleItemDetailsClosure.bind(this));
		this._getNode("#itemDetails").addEventListener("popuphiding", this.handleItemDetailsClosing.bind(this));

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
			Zotero.Utilities.Internal.showInLibrary(this.item);
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
		// record initial properties when popup is opened to be able to discard edits on Escape
		this.itemDetailsWhenOpened = {
			label: citationItem.label,
			locator: citationItem.locator,
			prefix: citationItem.prefix,
			suffix: citationItem.suffix,
			suppressAuthor: citationItem["suppress-author"]
		};

		let bubble = this._getNode(`[dialogReferenceID='${dialogReferenceID}']`);
		let bubbleRect = bubble.getBoundingClientRect();
		let popup = this._getNode("#itemDetails");
		popup.openPopup(bubble, "after_start", 0, 4, false, false, null);
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
		this._getNode("#itemDetails .show").hidden = !this.item.id;

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
		this.itemDetailsTimeOpened = (new Date()).getTime();
	}

	// do not close the popup within 300ms of opening to account for potential double clicking
	// on the bubble to open the popup
	handleItemDetailsClosing(event) {
		if ((new Date()).getTime() - this.itemDetailsTimeOpened < 300) {
			event.preventDefault();
			// return focus to the locator
			this.doc.defaultView.setTimeout(() => {
				this._getNode("#locator").focus();
			}, 10);
		}
	}

	handleItemDetailsShown(event) {
		event.stopPropagation();
		this._getNode("#locator").focus();
	}

	// When item details popup is closed, sync it's data to citationItems
	handleItemDetailsClosure() {
		let bubble = this._getNode(`[dialogReferenceID='${this.dialogReferenceID}']`);
		if (!bubble) return;
		bubble.classList.remove("showingDetails");
		// Restore properties to what they were when popup opened
		if (this.discardItemDetailsEdits) {
			this.discardItemDetailsEdits = false;
			this.citationItem.label = this.itemDetailsWhenOpened.label;
			this.citationItem.locator = this.itemDetailsWhenOpened.locator;
			this.citationItem.prefix = this.itemDetailsWhenOpened.prefix;
			this.citationItem.suffix = this.itemDetailsWhenOpened.suffix;
			this.citationItem["suppress-author"] = this.itemDetailsWhenOpened.suppressAuthor;
			this.itemDetailsWhenOpened = {};
			this.notifyCitationDialogOfChange();
		}
	}

	captureItemDetailsKeyDown(event) {
		if (event.key == "Escape") {
			this.discardItemDetailsEdits = true;
			event.stopPropagation();
			event.preventDefault();
		}
	}

	handleItemDetailsKeypress(event) {
		// Enter on a an input will save changes and hide the popup
		if (event.key == "Enter" && ["input"].includes(event.target.tagName) && !event.target.getAttribute("type")) {
			this._getNode("#itemDetails").hidePopup();
		}
	}

	// Update item details and notify citation dialog about changes
	handleItemDetailsChange() {
		this.citationItem.label = this._getNode("#locator").value ? this._getNode("#label").value : null;
		this.citationItem.locator = this._getNode("#locator").value;
		this.citationItem.prefix = this._getNode("#prefix").value;
		this.citationItem.suffix = this._getNode("#suffix").value;
		this.citationItem["suppress-author"] = this._getNode("#suppress-author").checked;
		this.notifyCitationDialogOfChange();
	}

	// Tell citation dialog that the item has been updated to refresh the bubble
	notifyCitationDialogOfChange() {
		let event = new CustomEvent("item-details-updated", {
			bubbles: true,
			detail: {
				dialogReferenceID: this.dialogReferenceID
			}
		});
		this.doc.dispatchEvent(event);
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
			Zotero.Utilities.Internal.showInLibrary(item);
			return false;
		}
		// Checked "Do not warn about this item"
		if (disableWarningCheckbox.value) {
			Zotero.Retractions.disableCitationWarningsForItem(item);
		}
		return true;
	}

	_getNode(selector) {
		return this.doc.querySelector(selector);
	}
}
