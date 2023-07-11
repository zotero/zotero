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
			this._body.addEventListener('keydown', this._onBodyKeydown.bind(this), { capture: true });
			this._body.addEventListener('click', this._onBodyClick.bind(this));
			this._body.addEventListener('dragenter', event => event.preventDefault());
			this._body.addEventListener('dragover', (event) => {
				event.preventDefault();
				if (event.target === this._body) {
					const { lastBubble: lastBeforeDrop } = this._getLastBubbleBeforePoint(event.clientX, event.clientY);
					const lastBubble = this._body.querySelector('.bubble:last-of-type');
					if (lastBubble !== lastBeforeDrop) return;
					// Only drop to final position if dragging after all bubbles, not in-between
					this._dragOver?.classList.remove('drop-after', 'drop-before');
					this._dragOver = event.target;
					lastBubble.classList.add('drop-after');
				}
			});
			this._body.addEventListener('dragleave', (event) => {
				this._dragOver?.classList.remove('drop-after', 'drop-before');
				this._dragOver = null;
			});
			this._body.addEventListener('drop', (event) => {
				event.preventDefault();
				event.stopPropagation();
				if (!this._dragBubble || !this._dragOver && this._dragBubble != this._dragOver) return;
				
				this._dragBubble.remove();
				if (this._dragOver === this._body) {
					this._body.querySelector('.bubble:last-of-type').after(this._dragBubble);
				}
				else {
					this._dragOver.before(this._dragBubble);
				}
				this._dragOver?.classList.remove('drop-after', 'drop-before');

				// // Find old position in list
				// var oldPosition = this._getBubbleIndex(this._dragBubble);
				//
				// // Move bubble
				// var range = document.createRange();
				// // Prevent dragging out of qfe
				// if (event.target === qfe) {
				// 	range.setStartAfter(qfe.childNodes[qfe.childNodes.length-1]);
				// }
				// else {
				// 	range.setStartAfter(event.target);
				// }
				// dragging.parentNode.removeChild(dragging);
				// var bubble = _insertBubble(JSON.parse(dragging.dataset.citationItem), range);
				// this._dragBubble = null;
				//
				// // If moved out of order, turn off "Keep Sources Sorted"
				// if(io.sortable && keepSorted && keepSorted.hasAttribute("checked") && oldPosition !== -1 &&
				// 		oldPosition != _getBubbleIndex(bubble)) {
				// 	keepSorted.removeAttribute("checked");
				// }
				//
				// yield _previewAndSort();
				// _moveCursorToEnd();
			});
			this._appendInput();
			
			this._dragBubble = null;
			this._dragOver = null;
		}
		
		_onBodyClick(event) {
			if (event.target !== this._body) {
				return;
			}
			let clickX = event.clientX;
			let clickY = event.clientY;
			let { lastBubble, startOfTheLine } = this._getLastBubbleBeforePoint(clickX, clickY);
			// If click happened right before another input, focus that input
			// instead of adding another one. There may be a br node on the way, so we have to check
			// more than just the next node.
			if (lastBubble) {
				let nextNode = lastBubble.nextElementSibling;
				while (nextNode && !nextNode.classList.contains("bubble")) {
					if (this._isInput(nextNode)) {
						nextNode.focus();
						return;
					}
					nextNode = nextNode.nextElementSibling;
				}
			}
			let newInput = this._createInputElem();
			if (lastBubble !== null) {
				lastBubble.after(newInput);
				if (startOfTheLine) {
					let lineBreak = document.createElement("br");
					lastBubble.after(lineBreak);
				}
			}
			else {
				this._body.prepend(newInput);
			}
			newInput.focus();
		}
		
		_onBodyKeydown(event) {
			const focused = document.activeElement;
			if (this._isInput(focused) && event.key == "Enter") {
				this.convertInputToBubble();
			}
			else if (["ArrowLeft", "ArrowRight"].includes(event.key) && !event.shiftKey) {
				// On arrow left from the beginning of the input, move to previous bubble
				if (event.key === "ArrowLeft" && (!this._isInput(focused) || focused.selectionStart === 0)) {
					this._moveFocusBack(focused);
					event.preventDefault();
				}
				// On arrow right from the end of the input, move to next bubble
				else if (event.key === "ArrowRight" && (!this._isInput(focused) || focused.selectionStart === focused.value.length)) {
					this._moveFocusForward(focused);
					event.preventDefault();
				}
			}
			else if (this._isInput(focused) && ["Backspace", "Delete"].includes(event.key)
				&& (focused.selectionStart + focused.selectionEnd) === 0) {
				event.preventDefault();
				// Backspace/Delete from the beginning of an input will delete the previous bubble.
				// If there are two inputs next to each other as a result, they are merged
				if (this.previousElementSibling) {
					this.previousElementSibling.remove();
					this._combineNeighboringInputs();
				}
			}
		}
		
		convertInputToBubble(text) {
			const input = this.getLastInput();
			text = text || input.value;
			const bubble = this._createBubble(text);
			input.before(bubble);
			input.value = "";
			return bubble;
		}
		
		_createBubble(str) {
			let bubble = document.createElement("div");
			bubble.setAttribute("draggable", "true");
			bubble.setAttribute("role", "button");
			bubble.setAttribute("tabindex", "0");
			bubble.setAttribute("aria-describedby", "bubble-description");
			bubble.setAttribute("aria-haspopup", true);
			bubble.className = "bubble";
			// VoiceOver works better without it
			if (!Zotero.isMac) {
				bubble.setAttribute("aria-label", str);
			}
			// bubble.addEventListener("click", _onBubbleClick);
			bubble.addEventListener("dragstart", (event) => {
				this._dragBubble = event.currentTarget;
				event.dataTransfer.setData("text/plain", '<span id="zotero-drag"/>');
				event.stopPropagation();
			});
			bubble.addEventListener("dragover", (event) => {
				this._dragOver?.classList.remove('drop-after', 'drop-before');
				this._dragOver = bubble;
				bubble.classList.add('drop-before');
			});
			// bubble.addEventListener("dragend", onBubbleDragEnd);
			// bubble.addEventListener("keypress", onBubblePress);
			// bubble.addEventListener("mousedown", (_) => {
			// 	_bubbleMouseDown = true;
			// });
			// bubble.addEventListener("mouseup", (_) => {
			// 	_bubbleMouseDown = false;
			// });
			// bubble.dataset.citationItem = JSON.stringify(citationItem);
			let text = document.createElement("span");
			text.textContent = str;
			text.className = "text";
			bubble.append(text);
			
			let cross = document.createElement("div");
			cross.className = "cross";
			cross.addEventListener("click", () => {
				bubble.remove();
			});
			cross.addEventListener("keydown", (e) => {
				if (e.target === cross && e.key === "Enter") {
					bubble.remove();
				}
			});
			bubble.append(cross);
			
			return bubble;
		}
		
		_isInput(node) {
			if (!node) return false;
			return node.tagName === "input";
		}
		
		// Determine if the input is empty
		_isInputEmpty(input) {
			if (!input) {
				return true;
			}
			return input.value.length == 0;
		}
		
		getLastInput() {
			return this.getCurrentInput() || this._lastFocusedInput;
		}
		
		getCurrentInput() {
			if (this._isInput(document.activeElement)) {
				return document.activeElement;
			}
			return false;
		}

		// Create input in the end of the editor and focus it
		_appendInput() {
			let newInput = this._createInputElem();
			this._body.appendChild(newInput);
			setTimeout(() => newInput.focus());
			return newInput;
		}
		
		isEmpty() {
			return this._body.childElementCount == 1 && this._isInput(this._body.firstChild);
		}

		// If this input field was counted as previously focused,
		// it will be cleared. Call before removing the field
		_clearLastFocused(input) {
			if (input == this._lastFocusedInput) {
				this._lastFocusedInput = null;
			}
		}
		
		_getContentWidth(input) {
			let span = document.createElement("span");
			span.classList = "input";
			span.innerText = input.value;
			this._body.appendChild(span);
			let spanWidth = span.getBoundingClientRect().width;
			span.remove();
			return spanWidth + 2;
		}

		_createInputElem() {
			let input = document.createElement('input');
			input.setAttribute("aria-describedby", "input-description");
			input.addEventListener("input", (_) => {
				// _resetSearchTimer();
				// Expand/shrink the input field to match the width of content
				let width = this._getContentWidth(input);
				input.style.width = width + 'px';
			});
			// input.addEventListener("keypress", onInputPress);
			input.addEventListener("keypress", e => this._onInputKeypress(input, e));
			// input.addEventListener("paste", _onPaste, false);
			input.addEventListener("focus", (_) => {
				// // If the input used for the last search run is refocused,
				// // just make sure the reference panel is opened if it has items.
				// if (this._lastFocusedInput == input && referenceBox.childElementCount > 0) {
				// 	_openReferencePanel();
				// 	return;
				// }
				// // Otherwise, run the search if the input is non-empty.
				// if (!isInputEmpty(input)) {
				// 	_resetSearchTimer();
				// }
				// else {
				// 	_updateItemList({ citedItems: [] });
				// }
				this._lastFocusedInput = input;
			});
			// // Delete empty input on blur unless it's the last input
			input.addEventListener("blur", (_) => {
				// Timeout to know where the focus landed after
				setTimeout(() => {
					const inputFocused = this._isInput(document.activeElement);
					if (this._isInputEmpty(input) && inputFocused) {
						// // Resizing window right before drag-drop reordering starts, will interrupt the
						// // drag event. To avoid it, hide the input immediately and delete it after delay.
						// if (_bubbleMouseDown) {
						// 	input.style.display = "none";
						// 	setTimeout(() => {
						// 		input.remove();
						// 	}, 500);
						// 	clearLastFocused(input);
						// }
						// else
						if (document.activeElement !== input && !this.isEmpty()) {
							// If no dragging, delete it if focus has moved elsewhere.
							// If focus remained, the entire dialog lost focus, so do nothing
							// If this is the last, non-removable, input - do not remove it as well.
							input.remove();
							this._clearLastFocused(input);
						}
					}
				});
				// If there was a br added before input so that it doesn't appear on the previous line,
				// remove it
				if (input.previousElementSibling?.tagName == "br") {
					input.previousElementSibling.remove();
				}
			});
			return input;
		}
		
		_onInputKeypress(input, event) {
			if (event.target === input && event.key == "Enter") {
				this.convertInputToBubble();
			}
			else if (["ArrowLeft", "ArrowRight"].includes(event.key) && !event.shiftKey) {
				// On arrow left from the beginning of the input, move to previous bubble
				if (event.key === "ArrowLeft" && input.selectionStart === 0) {
					this._moveFocusBack(input);
					event.preventDefault();
				}
				// On arrow right from the end of the input, move to next bubble
				else if (event.key === "ArrowRight" && input.selectionStart === input.value.length) {
					this._moveFocusForward(input);
					event.preventDefault();
				}
			}
			else if (["Backspace", "Delete"].includes(event.key)
				&& (input.selectionStart + input.selectionEnd) === 0) {
				event.preventDefault();
				// Backspace/Delete from the beginning of an input will delete the previous bubble.
				// If there are two inputs next to each other as a result, they are merged
				if (this.previousElementSibling) {
					this.previousElementSibling.remove();
					this._combineNeighboringInputs();
				}
			}
		}

		_moveFocusForward(node) {
			if (node.nextElementSibling?.focus) {
				node.nextElementSibling.focus();
				return true;
			}
			return false;
		}

		_moveFocusBack(node) {
			// Skip line break if it's before the node
			if (node.previousElementSibling?.tagName == "br") {
				node = node.previousElementSibling;
			}
			if (node.previousElementSibling?.focus) {
				node.previousElementSibling.focus();
				return true;
			}
			return false;
		}

		// If a bubble is removed between two inputs we need to combine them
		_combineNeighboringInputs() {
			let node = this._body.firstChild;
			while (node && node.nextElementSibling) {
				if (this._isInput(node)
					&& this._isInput(node.nextElementSibling)) {
					let secondInputValue = node.nextElementSibling.value;
					node.value += ` ${secondInputValue}`;
					node.dispatchEvent(new Event('input', { bubbles: true }));
					// Make sure focus is not lost when two inputs are combined
					if (node.nextElementSibling == document.activeElement) {
						node.focus();
					}
					node.nextElementSibling.remove();
				}
				node = node.nextElementSibling;
			}
		}

		_getBubbleIndex(bubble) {
			return this.body.querySelectorAll('.bubble').indexOf(bubble);
		}

		/**
		 * Find the last bubble (lastBubble) before a given coordinate and indicate if there are no bubbles
		 * to the left of the x-coordinate (startOfTheLine). If there is no last bubble, null is returned.
		 * startOfTheLine indicates if a <br> should be added so that a new input placed after lastBubble
		 * does not land on the previous line.
		 * Outputs for a sample of coordinates (with #3 having startOfTheLine=true):
		 *  NULL    #1      #2          #3
		 *  ↓        ↓       ↓           ↓
		 * [ bubble_1 bubble_2 bubble_3
		 * 	  bubble_4, bubble_5          ]
		 *   ↑       ↑      ↑       ↑
		 *  #3      #4     #5      #5
		 * @param {Int} x - X coordinate
		 * @param {Int} y - Y coordinate
		 * @returns {lastBubble: Node, startOfTheLine: Bool}
		 */
		_getLastBubbleBeforePoint(x, y) {
			let bubbles = this._body.querySelectorAll('.bubble');
			let lastBubble = null;
			let startOfTheLine = false;
			for (let i = 0; i < bubbles.length; i++) {
				let rect = bubbles[i].getBoundingClientRect();
				// If within the vertical range of a bubble
				if (y >= rect.top && y <= rect.bottom) {
					// If the click is to the right of a bubble, it becomes a candidate
					if (x > rect.right) {
						lastBubble = i;
					}
					// Otherwise, stop and return the last bubble we saw if any
					else {
						if (i == 0) {
							lastBubble = null;
						}
						else {
							// Indicate there is no bubble before this one
							startOfTheLine = lastBubble === null;
							lastBubble = Math.max(i - 1, 0);
						}
						break;
					}
				}
			}
			if (lastBubble !== null) {
				lastBubble = bubbles[lastBubble];
			}
			return { lastBubble: lastBubble, startOfTheLine: startOfTheLine };
		}
	}

	customElements.define('bubble-input', BubbleInput);
}