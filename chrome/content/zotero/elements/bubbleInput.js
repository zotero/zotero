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

"use strict";

{
	class BubbleInput extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div xmlns:html="http://www.w3.org/1999/xhtml" flex="1" spellcheck="false" class="bubble-input body" role="application">
			</html:div>
		`);

		init() {
			this._body = this.querySelector('.bubble-input.body');
			this._body.addEventListener('click', this._onBodyClick.bind(this));
			this._lastFocusedInput = null;

			Utils.init(this);
			DragDropHandler.init(this);
		}

		focus() {
			this.refocusInput();
		}

		/**
		 * Synchronize bubbles with the given citation data. Add bubbles for citation items that
		 * are not present, remove bubbles whose citation items were removed, rearrange bubbles
		 * if the items were moved, update bubble text if locator/prefix/suffix was changed.
		 * Make sure that there is an input for user to type in before and after every bubble.
		 * @param {Object[]} combinedItems - array of objects { zoteroItem, citationItem, dialogReferenceID, selected }.
		 * zoteroItem - Zotero.Item, citationItem - object from io.citation.citationItems
		 * dialogReferenceID - String ID of this citation entry, selected - Boolean indicator if bubble should be highlighted
		 */
		refresh(combinedItems) {
			// Remove bubbles of items that are no longer in the citations
			for (let bubble of this.getAllBubbles()) {
				let bubbleDialogReferenceID = bubble.getAttribute("dialogReferenceID");
				let itemExistsForBubble = combinedItems.find(({ dialogReferenceID }) => dialogReferenceID == bubbleDialogReferenceID);
				if (!itemExistsForBubble) {
					bubble.remove();
				}
			}
			// Ensure each item in the citation has a bubble in the right position
			for (let [index, { dialogReferenceID, bubbleString }] of Object.entries(combinedItems)) {
				let allBubbles = this.getAllBubbles();
				let bubbleNode = allBubbles.find(candidate => candidate.getAttribute("dialogReferenceID") == dialogReferenceID);
				// Create bubble if it does not exist and append to the input
				if (!bubbleNode) {
					bubbleNode = this._createBubble(bubbleString, dialogReferenceID);
					this._body.append(bubbleNode);
					allBubbles = this.getAllBubbles();
				}
				// Update bubble string
				if (bubbleNode.querySelector(".text").textContent !== bubbleString) {
					bubbleNode.querySelector(".text").textContent = bubbleString;
				}
				// Move bubble if it's index does not correspond to the position of the item
				let expectedIndex = allBubbles.indexOf(bubbleNode);
				if (expectedIndex != index) {
					let referenceNode = allBubbles[index];
					this._body.insertBefore(bubbleNode, referenceNode);
				}
			}
			// Make sure there is an input following every bubble
			for (let bubble of this.getAllBubbles()) {
				let nextNode = bubble.nextElementSibling;
				if (!nextNode || !Utils.isInput(nextNode)) {
					let input = this._createInputElem();
					bubble.after(input);
				}
			}
			// Highlight bubbles selected in the library view
			for (let bubble of this.getAllBubbles()) {
				let bubbleDialogReferenceID = bubble.getAttribute("dialogReferenceID");
				let itemObj = combinedItems.find(({ dialogReferenceID }) => dialogReferenceID == bubbleDialogReferenceID);
				if (itemObj) {
					bubble.classList.toggle("has-item-selected", !!itemObj.selected);
				}
			}
			// Prepend first input
			if (!this._body.firstChild || !Utils.isInput(this._body.firstChild)) {
				let input = this._createInputElem();
				this._body.prepend(input);
			}
			// Make sure that all inputs occupy the right width
			for (let input of [...this.querySelectorAll(".input")]) {
				let requiredWidth = Utils.getContentWidth(input);
				input.style.width = `${requiredWidth}px`;
			}
			// Add placeholder and a special aria-description to the first input when there are no bubbles
			let isOnlyInput = this.getAllBubbles().length == 0;
			this._body.firstChild.classList.toggle("full-width", isOnlyInput);
			if (isOnlyInput) {
				document.l10n.setAttributes(this._body.firstChild, "integration-citationDialog-single-input");
			}
			// otherwise, add a regular aria descriptions and placeholders to all inputs
			else {
				for (let input of [...this.querySelectorAll(".input")]) {
					document.l10n.setAttributes(input, "integration-citationDialog-input");
				}
			}
			// If any two inputs end up next to each other (e.g. after bubble is deleted),
			// have them merged
			Utils.combineNeighboringInputs(this._body.firstChild);
			// if bubble input is scrollable, scroll to the bottom
			if (this._body.scrollHeight > this._body.clientHeight) {
				this._body.scrollTop = this._body.scrollHeight;
			}
		}

		/**
		 * Return the focus to an input. Try to focus on the previously active input first.
		 * Otherwise, focus the last non-empty input in the editor.
		 * If all inputs are empty, focus the last one.
		 */
		refocusInput() {
			let input = this.getCurrentInput();
			let allInputs = [...this._body.querySelectorAll('.input')];
			if (!input) {
				input = allInputs.find(inp => inp.value.length);
			}
			if (!input) {
				input = allInputs[allInputs.length - 1];
			}
			input.focus();
			input.setSelectionRange(input.value.length, input.value.length);
			return input;
		}
		
		/**
		 * Get the input that the user interacted with last. If an input is focused, return that.
		 * Otherwise, return last focused input, if it is still part of the bubbleInput.
		 */
		getCurrentInput() {
			if (Utils.isInput(document.activeElement)) {
				return document.activeElement;
			}
			if (this._lastFocusedInput && this.contains(this._lastFocusedInput)) {
				return this._lastFocusedInput;
			}
			return false;
		}

		/**
		 * Get the index that a bubble inserted after current input would have.
		 * Used by CitationDialog to know at which index to save the newly added item.
		 */
		getFutureBubbleIndex() {
			let input = this.getCurrentInput();
			if (!input) return -1;
			input.classList.add("future-bubble");
			let allElements = [...this._body.querySelectorAll(".bubble,.future-bubble")];
			let index = allElements.findIndex(node => node == input);
			input.classList.remove("future-bubble");
			return index;
		}

		/**
		 * Shortcut to get all existing bubbles as an array
		 */
		getAllBubbles() {
			return [...this.querySelectorAll(".bubble")];
		}
		
		/**
		 * On click of the body, find the last bubble before the click and
		 * focus input following that bubble. If no such bubble was found, focus
		 * the very first input.
		 */
		_onBodyClick(event) {
			if (event.target !== this._body) {
				return;
			}
			let { clientX, clientY } = event;
			let lastBubble = Utils.getLastBubbleBeforePoint(clientX, clientY);
			if (lastBubble) {
				lastBubble.nextSibling.focus();
			}
			else {
				this._body.firstChild.focus();
			}
		}
		
		/**
		 * Create a bubble node representing item present in the citation
		 * @param {String} content - textual content of the bubble
		 * Contains Item's title/author/locator/prefix/suffix/etc.
		 * @param {String} dialogReferenceID - ID used by citationDialog to relate bubbles to cited items
		 * @returns {Node} - bubble node
		 */
		_createBubble(content, dialogReferenceID) {
			let bubble = document.createElement("div");
			bubble.setAttribute("draggable", "true");
			bubble.setAttribute("role", "button");
			bubble.setAttribute("tabindex", "0");
			bubble.setAttribute("data-l10n-id", "integration-citationDialog-aria-bubble");
			bubble.setAttribute("aria-haspopup", true);
			bubble.setAttribute("dialogReferenceID", dialogReferenceID);
			bubble.setAttribute("data-arrow-nav-enabled", true);
			bubble.className = "bubble";
			// VoiceOver works better without it
			if (!Zotero.isMac) {
				bubble.setAttribute("aria-label", content);
			}
			// On click, tell citationDialog to display the details popup
			bubble.addEventListener("click", () => Utils.notifyDialog("show-details-popup", { dialogReferenceID: bubble.getAttribute("dialogReferenceID") }));
			bubble.addEventListener("keydown", this._onBubbleKeydown.bind(this));
			let text = document.createElement("span");
			text.textContent = content;
			text.className = "text";
			bubble.append(text);
			
			// Add a dropmarker to indicate that the bubble is clickable
			let dropmarker = document.createElement("span");
			dropmarker.className = "icon icon-css icon-chevron-6 icon-8 dropmarker";
			bubble.append(dropmarker);
			
			return bubble;
		}

		/**
		 * Handle keypresses on a bubble.
		 */
		_onBubbleKeydown(event) {
			let bubble = event.target;
			if (["ArrowLeft", "ArrowRight"].includes(event.key) && event.shiftKey) {
				// On Shift-Left/Right swap focused bubble with it's neighbor
				event.preventDefault();
				event.stopPropagation();
				let nextBubble = Utils.findNextClass("bubble", bubble, event.key == Zotero.arrowNextKey);
				if (nextBubble) {
					let nextBubbleIndex = [...this._body.querySelectorAll(".bubble")].findIndex(bubble => bubble == nextBubble);
					Utils.notifyDialog('move-item', { dialogReferenceID: bubble.getAttribute("dialogReferenceID"), index: nextBubbleIndex });
				}
				
				bubble.focus();
			}
			else if (["Backspace", "Delete"].includes(event.key)) {
				event.preventDefault();
				// On backspace or delete, shift focus to previous or next bubble if possible,
				// otherwise, refocus input after the bubble is deleted
				let previousBubble = Utils.findNextClass("bubble", bubble, false);
				let nextBubble = Utils.findNextClass("bubble", bubble, true);
				if (previousBubble) {
					previousBubble.focus();
				}
				else if (nextBubble) {
					nextBubble.focus();
				}
				else {
					this.refocusInput();
				}
				this._deleteBubble(bubble);
			}
			else if (Utils.isKeypressPrintable(event) && event.key !== " ") {
				event.preventDefault();
				let input = this.refocusInput();
				// Typing when you are focused on the bubble will re-focus the last input
				input.value += event.key;
				input.dispatchEvent(new Event('input', { bubbles: true }));
			}
			// Space or arrowDown on a bubble open item details popup
			if (event.key == " " || event.key == "ArrowDown") {
				Utils.notifyDialog("show-details-popup", { dialogReferenceID: bubble.getAttribute("dialogReferenceID") });
				event.preventDefault();
				event.stopPropagation();
			}
			// Home - focus the first input
			if (event.key == "Home") {
				this._body.firstChild.focus();
			}
			// End - focus the last input
			if (event.key == "End") {
				this._body.lastChild.focus();
			}
		}
		
		// Citation dialog will record that the item is removed and the bubble will be gone after refresh()
		_deleteBubble(bubble) {
			Utils.notifyDialog('delete-item', { dialogReferenceID: bubble.getAttribute("dialogReferenceID") });
		}

		/**
		 * Create input element placed on each side of a bubble to accept user input.
		*/
		_createInputElem() {
			let input = document.createElement('input');
			// tabindex for keyboard handling
			input.setAttribute("tabindex", 0);
			// hide windows appearance from _input.scss
			input.setAttribute("no-windows-native", true);
			input.setAttribute("data-arrow-nav-enabled", true);
			input.className = "input empty";
			input.setAttribute("data-l10n-id", "integration-citationDialog-input");
			input.addEventListener("input", (_) => {
				// .full-width class is used on first input to fully display placeholder
				// in that case, resizing does not happen
				if (!input.classList.contains("full-width")) {
					// Expand/shrink the input field to match the width of content
					input.style.width = Utils.getContentWidth(input) + 'px';
				}
				input.classList.toggle("empty", input.value.length == 0);
				Utils.notifyDialog("handle-input", { query: input.value, eventType: "input" });
			});
			input.addEventListener("keydown", e => this._onInputKeydown(input, e));
			input.addEventListener("focus", (_) => {
				// When input is re-focused, tell citationDialog that search can be rerun
				// without debounce
				Utils.notifyDialog("handle-input", { query: input.value, eventType: "focus" });
			});
			input.addEventListener("blur", async (event) => {
				// record this input as last focused if it's not empty OR if the focus left bubbleInput altogether
				if (!Utils.isInputEmpty(input) || !this.contains(event.relatedTarget)) {
					this._lastFocusedInput = input;
				}
			});
			return input;
		}
		
		/**
		 * Handle keypresses on inputs created in _createInputElem()
		 */
		_onInputKeydown(input, event) {
			// Do not allow focus handler to interfere on arrow key navigation within the input
			if ((event.key == Zotero.arrowPreviousKey && input.selectionStart !== 0)
				|| (event.key == Zotero.arrowNextKey && input.selectionEnd !== input.value.length)) {
				event.stopPropagation();
			}

			// Enter on an input can have multiple outcomes, they are handled in citationDialog
			if (event.key == "Enter" && !event.shiftKey) {
				Utils.notifyDialog("input-enter", { input });
				event.stopPropagation();
			}
			if (["Backspace", "Delete"].includes(event.key)
				&& (input.selectionStart + input.selectionEnd) === 0) {
				event.preventDefault();
				// Backspace/Delete from the beginning of an input will delete the previous bubble.
				// If there are two inputs next to each other as a result, they are merged
				if (input.previousElementSibling) {
					this._deleteBubble(input.previousElementSibling);
				}
			}
			// Home from the beginning of an input - focus the first input
			if (event.key == "Home" && Utils.isCursorAtInputStart(input)) {
				this._body.firstChild.focus();
			}
			// End from the end of an input - focus the last input
			if (event.key == "End" && Utils.isCursorAtInputEnd(input)) {
				this._body.lastChild.focus();
			}
		}
	}

	// Singleton handling drag-drop behavior of bubbles
	const DragDropHandler = {
		init(bubbleInput) {
			this.bubbleInput = bubbleInput;
			this.dragBubble = null;
			this.dragOver = null;
			this.doc = bubbleInput.ownerDocument;

			bubbleInput.addEventListener("dragstart", this.handleDragStart.bind(this));
			bubbleInput.addEventListener("dragenter", this.handleDragEnter.bind(this));
			bubbleInput.addEventListener("dragover", this.handleDragOver.bind(this));
			bubbleInput.addEventListener("drop", this.handleDrop.bind(this));
			this.doc.addEventListener("dragend", this.handleDragEnd.bind(this));
		},

		handleDragStart(event) {
			this.dragBubble = event.target;
			event.dataTransfer.setData("text/plain", '<span id="zotero-drag"/>');
			event.stopPropagation();
		},

		handleDragEnter(event) {
			event.preventDefault();
		},

		handleDragOver(event) {
			event.preventDefault();
			// Find the last bubble before current mouse position
			let lastBeforeDrop = Utils.getLastBubbleBeforePoint(event.clientX, event.clientY);
			// If no bubble, mouse may be at the very start of the input so use the first bubble
			if (!lastBeforeDrop) {
				lastBeforeDrop = this.bubbleInput.getAllBubbles()[0];
			}
			// There may be no bubbles at all
			if (!lastBeforeDrop) return;

			this.dragOver?.classList.remove('drop-after', 'drop-before');
			this.dragOver = lastBeforeDrop;

			// Add indicator after or before the hovered bubble depending on mouse position
			let bubbleRect = lastBeforeDrop.getBoundingClientRect();
			let midpoint = (bubbleRect.right + bubbleRect.left) / 2;

			if (event.clientX > midpoint) {
				this.dragOver.classList.add('drop-after');
			}
			else {
				this.dragOver.classList.add('drop-before');
			}
		},

		handleDrop(event) {
			event.preventDefault();
			event.stopPropagation();
			let itemIDs = event.dataTransfer.getData("zotero/item");
			// Handle drag-drop of items from the citationDialog into bubble-input to add them
			if (itemIDs) {
				itemIDs = itemIDs.split(",");
				console.log(itemIDs);
				let newIndex = 0;
				if (this.dragOver) {
					newIndex = [...this.bubbleInput.querySelectorAll(".bubble")].findIndex(node => this.dragOver == node);
					if (this.dragOver.classList.contains("drop-after")) {
						newIndex++;
					}
				}
				Utils.notifyDialog('add-dragged-item', { itemIDs, index: newIndex });
				setTimeout(() => {
					this.handleDragEnd();
				});
				return;
			}
			if (!this.dragBubble || !this.dragOver) return;
			
			if (this.dragOver.classList.contains("drop-after")) {
				this.dragOver.after(this.dragBubble);
			}
			else {
				this.dragOver.before(this.dragBubble);
			}
			this.dragOver.classList.remove('drop-after', 'drop-before');

			// Tell citationDialog.js where the bubble moved
			let newIndex = [...this.bubbleInput.querySelectorAll(".bubble")].findIndex(node => node == this.dragBubble);
			Utils.notifyDialog('move-item', { dialogReferenceID: this.dragBubble.getAttribute("dialogReferenceID"), index: newIndex });
		},

		handleDragEnd(_) {
			this.bubbleInput.querySelector(".drop-after,.drop-before")?.classList.remove('drop-after', 'drop-before');
			this.dragBubble = null;
			this.dragOver = null;
		},
	};

	const Utils = {
		init(bubbleInput) {
			this.bubbleInput = bubbleInput;
		},

		isInput(node) {
			if (!node) return false;
			return node.tagName === "input";
		},

		isInputEmpty(input) {
			if (!input) {
				return true;
			}
			return input.value.length == 0;
		},

		isCursorAtInputStart(input) {
			return Zotero.rtl ? input.selectionStart == input.value.length : input.selectionStart == 0;
		},
	
		isCursorAtInputEnd(input) {
			return Zotero.rtl ? input.selectionStart == 0 : input.selectionStart == input.value.length;
		},

		findNextClass(className, startNode, isForward) {
			let node = startNode;
			do {
				node = isForward ? node.nextElementSibling : node.previousElementSibling;
			} while (node && !(node.classList.contains(className)));

			if (node == startNode) return false;

			return node;
		},

		/**
		 * Find the last bubble (lastBubble) before a given coordinate.
		 * If there is no last bubble, null is returned.
		 * Outputs for a sample of coordinates:
		 *  NULL    #1      #2          #3
		 *  ↓        ↓       ↓           ↓
		 * [ bubble_1 bubble_2 bubble_3
		 * 	  bubble_4, bubble_5          ]
		 *   ↑       ↑      ↑       ↑
		 *  #3      #4     #5      #5
		 * @param {Int} x - X coordinate
		 * @param {Int} y - Y coordinate
		 * @returns {Node} lastBubble
		 */
		getLastBubbleBeforePoint(x, y) {
			let bubbles = this.bubbleInput.querySelectorAll('.bubble');
			let lastBubble = null;
			let verticalBubbleMargin = parseInt(getComputedStyle(this.bubbleInput).getPropertyValue("--bubble-vertical-margin")) || 0;
			let isClickAfterBubble = (clickX, bubbleRect) => {
				return Zotero.rtl ? clickX <= bubbleRect.right : clickX >= bubbleRect.left;
			};
			for (let i = 0; i < bubbles.length; i++) {
				let rect = bubbles[i].getBoundingClientRect();
				// If within the vertical range of a bubble
				if (y >= (rect.top - verticalBubbleMargin) && y <= (rect.bottom + verticalBubbleMargin)) {
					// If the click is to the right of a bubble, it becomes a candidate
					if (isClickAfterBubble(x, rect)) {
						lastBubble = i;
					}
					// Otherwise, stop and return the last bubble we saw if any
					else {
						if (i == 0) {
							lastBubble = null;
						}
						else {
							lastBubble = Math.max(i - 1, 0);
						}
						break;
					}
				}
			}
			if (lastBubble !== null) {
				lastBubble = bubbles[lastBubble];
			}
			return lastBubble;
		},

		notifyDialog(eventType, data = {}) {
			let event = new CustomEvent(eventType, {
				bubbles: true,
				detail: data
			});
			this.bubbleInput.dispatchEvent(event);
		},
		// Determine if keypress event is on a printable character.
		/* eslint-disable array-element-newline */
		isKeypressPrintable(event) {
			if (event.ctrlKey || event.metaKey || event.altKey) return false;
			// If it's a single character, for latin locales it has to be printable
			if (event.key.length === 1) {
				return true;
			}
			// Otherwise, check against a list of common control keys
			let nonPrintableKeys = [
				'Enter', 'Escape', 'Backspace', 'Tab',
				'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
				'Home', 'End', 'PageUp', 'PageDown',
				'Delete', 'Insert',
				'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
				'Control', 'Meta', 'Alt', 'Shift', 'CapsLock'
			];
			/* eslint-enable array-element-newline */
		
			return !nonPrintableKeys.includes(event.key);
		},

		getContentWidth(input) {
			let span = document.createElement("span");
			span.classList = "input";
			span.innerText = input.value;
			this.bubbleInput._body.appendChild(span);
			let spanWidth = span.getBoundingClientRect().width;
			span.remove();
			return spanWidth;
		},

		// If a bubble is removed between two inputs we need to combine them
		combineNeighboringInputs(startingNode) {
			let node = startingNode;
			let initiallyFocusedInputValue = this.isInput(document.activeElement) ? document.activeElement.value : "";
			while (node && node.nextElementSibling) {
				if (this.isInput(node) && this.isInput(node.nextElementSibling)) {
					// Place the string in the input that has focus (if either of them does)
					// to avoid triggering search rerun due to focus change
					let combinedValue = `${node.value}${node.value.length ? ' ' : ''}${node.nextElementSibling.value}`;
					let remainingInput = node;
					let inputToDelete = node.nextElementSibling;
					if (document.activeElement == node.nextElementSibling) {
						remainingInput = node.nextElementSibling;
						inputToDelete = node;
					}
					remainingInput.value = combinedValue;
					inputToDelete.remove();
					// Ensure the width of the combined input is correct
					remainingInput.style.width = Utils.getContentWidth(node) + 'px';
				}
				node = node.nextElementSibling;
			}
			// Rerun the search in the end if the focused input has a different value than before
			if (this.isInput(document.activeElement) && document.activeElement.value !== initiallyFocusedInputValue) {
				this.notifyDialog("handle-input", { query: document.activeElement.value, eventType: "focus" });
			}
		}
	};

	customElements.define('bubble-input', BubbleInput);
}
