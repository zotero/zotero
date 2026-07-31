/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2026 Corporation for Digital Scholarship
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
	// Enough of the library's tags or creators to scroll through without holding
	// the list open on a one-letter prefix
	const MAX_LOOKUP_VALUES = 100;

	// The element scripts load on first use of their tag, so create one to get
	// search-textbox defined before extending it
	document.createXULElement("search-textbox");

	/**
	 * A search box that shows the parts of a search query (see
	 * Zotero.SearchQuery) as they're typed: the field, operator, and value of
	 * each condition are colored, and everything else reads as plain text.
	 *
	 * An <input> can't render styled text, so the colored copy is a layer
	 * behind it, drawn from the same tokens the parser produces and kept in
	 * step with the input's own scrolling. The input's text is transparent, so
	 * what's on screen is the layer, and everything the input does otherwise --
	 * selection, IME, accessibility -- is untouched.
	 */
	class QueryTextbox extends customElements.get("search-textbox") {
		connectedCallback() {
			if (this.delayConnectedCallback() || this.connected) {
				return;
			}
			super.connectedCallback();

			const stylesheet = document.createElement("link");
			stylesheet.rel = "stylesheet";
			stylesheet.href = "chrome://zotero/skin/query-textbox.css";
			this.shadowRoot.prepend(stylesheet);

			this._highlightLayer = document.createElement("div");
			this._highlightLayer.className = "query-highlight";
			this._highlightLayer.setAttribute("aria-hidden", "true");
			this.inputField.before(this._highlightLayer);

			// The layer is positioned over the input rather than laid out with
			// it, so it has to follow the input's box
			this._resizeObserver = new ResizeObserver(() => this._syncGeometry());
			this._resizeObserver.observe(this.inputField);

			this.inputField.addEventListener("input", () => {
				this.updateHighlighting();
				this.updateCompletions();
			});
			this.inputField.addEventListener("scroll", () => this._syncScroll());
			// The caret moving is as much a reason to offer something else as
			// the text changing
			this.inputField.addEventListener("keyup", (event) => {
				if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
					this.updateCompletions();
				}
			});
			this.inputField.addEventListener("click", () => this.updateCompletions());
			this.inputField.addEventListener("blur", () => this.hideCompletions());
			// Before the base class's own Enter and Escape handling, which the
			// list takes over while it's open
			this.addEventListener("keydown", event => this._handleCompletionKey(event), true);
			// Rendering mid-composition would replace the text being composed
			this.inputField.addEventListener("compositionstart", () => {
				this._composing = true;
			});
			this.inputField.addEventListener("compositionend", () => {
				this._composing = false;
				this.updateHighlighting();
				this.updateCompletions();
			});
			this.updateHighlighting();
		}

		set value(val) {
			super.value = val;
			// Setting the value doesn't fire input
			this.updateHighlighting();
			this.hideCompletions();
		}

		get value() {
			return this.inputField.value;
		}

		/**
		 * Offsets where a condition was recognized and the user undid it, so
		 * it reads as text from there on (see Zotero.SearchQuery.tokenize())
		 *
		 * @type {Set}
		 */
		get literalAt() {
			return new Set(this._literalMarkers ? this._literalMarkers.keys() : []);
		}

		/**
		 * Stop treating the condition at an offset as one, as an undo of the
		 * recognition
		 *
		 * @param {Number} offset
		 */
		readAsText(offset) {
			let field = (this._tokens || []).find(
				token => token.type === 'field' && token.start === offset);
			if (!field) {
				return;
			}
			if (!this._literalMarkers) {
				this._literalMarkers = new Map();
			}
			this._literalMarkers.set(offset, field.name);
			this.updateHighlighting();
			this.doCommand();
		}

		// A marker holds an absolute offset, so editing the text moves or
		// invalidates it: shift markers past the changed region, and drop any
		// whose offset no longer starts the field name that was undone
		_adjustLiteralMarkers(value) {
			let old = this._lastValue || '';
			if (value === old) {
				return;
			}
			this._lastValue = value;
			if (!this._literalMarkers || !this._literalMarkers.size) {
				return;
			}
			let max = Math.min(old.length, value.length);
			let prefix = 0;
			while (prefix < max && old[prefix] === value[prefix]) {
				prefix++;
			}
			let suffix = 0;
			while (suffix < max - prefix
					&& old[old.length - 1 - suffix] === value[value.length - 1 - suffix]) {
				suffix++;
			}
			let fields = new Map();
			for (let token of Zotero.SearchQuery.tokenize(value)) {
				if (token.type === 'field') {
					fields.set(token.start, token.name);
				}
			}
			let markers = new Map();
			for (let [offset, name] of this._literalMarkers) {
				if (offset >= old.length - suffix) {
					offset += value.length - old.length;
				}
				if (fields.get(offset) === name) {
					markers.set(offset, name);
				}
			}
			this._literalMarkers = markers;
		}

		/**
		 * The condition the caret is in, for undoing its recognition
		 *
		 * @return {Object|null} - A token, with `start` the offset to pass to
		 *     readAsText()
		 */
		getConditionAtCaret() {
			let caret = this.inputField.selectionStart;
			let start = null;
			for (let token of this._tokens || []) {
				if (token.type === 'field') {
					start = token;
				}
				else if (token.type !== 'operator' && token.type !== 'value') {
					start = null;
				}
				if (start && caret >= start.start && caret <= token.end) {
					return start;
				}
			}
			return null;
		}

		/**
		 * Redraw the layer from the current value
		 */
		updateHighlighting() {
			if (!this._highlightLayer || this._composing) {
				return;
			}
			let value = this.inputField.value;
			this._adjustLiteralMarkers(value);
			this._tokens = value
				? Zotero.SearchQuery.tokenize(value, { literalAt: this.literalAt })
				: [];
			// Recognized conditions are what the coloring is for, so a query
			// without any leaves the input to draw its own text
			let hasCondition = this._tokens.some(token => token.type === 'field');
			this.toggleAttribute("highlighted", hasCondition);
			this._syncGeometry();
			this._highlightLayer.replaceChildren();
			if (hasCondition) {
				for (let token of this._tokens) {
					let span = document.createElement("span");
					span.className = "query-token-" + token.type;
					span.textContent = value.slice(token.start, token.end);
					this._highlightLayer.append(span);
				}
			}
			this._syncScroll();
		}

		/**
		 * Show completions for what's being typed at the caret, or hide the
		 * list if there's nothing to offer (see
		 * Zotero.SearchQuery.getCompletions())
		 */
		async updateCompletions() {
			if (this._composing) {
				return;
			}
			let value = this.inputField.value;
			let completions = value
				? Zotero.SearchQuery.getCompletions(value, this.inputField.selectionStart)
				: null;
			// A query that changes while a lookup is in flight makes its results
			// obsolete
			let generation = this._completionGeneration = (this._completionGeneration || 0) + 1;
			if (completions && completions.lookup) {
				completions = {
					...completions,
					completions: await this._lookupValues(completions)
				};
				if (generation !== this._completionGeneration) {
					return;
				}
			}
			if (!completions || !completions.completions.length) {
				this.hideCompletions();
				return;
			}
			this._completions = completions;
			// The getter builds the list along with the popup that holds it
			let popup = this._completionPopup;
			let list = this._completionList;
			list.replaceChildren();
			for (let completion of completions.completions) {
				let row = document.createXULElement("richlistitem");
				let label = document.createElement("span");
				label.className = "completion-label";
				if (completion.color) {
					let swatch = document.createElement("span");
					swatch.className = "completion-swatch";
					swatch.style.backgroundColor = completion.color;
					label.append(swatch);
					label.classList.add("colored");
				}
				label.append(completion.label);
				row.append(label);
				// The description explains what a name maps to ("by:" is the
				// Creator condition), so a name that already says it doesn't
				// need it: "attachment tag:" is self-evidently about tags
				if (completion.description && !completion.label.replace(/:$/, '').toLowerCase()
						.includes(completion.description.toLowerCase())) {
					let description = document.createElement("span");
					description.className = "completion-description";
					description.textContent = completion.description;
					row.append(description);
				}
				row.completion = completion;
				list.append(row);
			}
			// Nothing is selected until the user moves into the list, so Enter
			// runs the search it would have run
			list.clearSelection();
			if (popup.state === "closed") {
				popup.openPopup(this.inputField, "after_start");
			}
		}

		// Values a condition takes that come from the library, from the same
		// search the Advanced Search fields use
		_lookupValues({ lookup, prefix }) {
			let params = { ...lookup };
			// Values from every library the search covers
			let libraryIDs = Zotero.getActiveZoteroPane()?.getSelectedLibraryIDs() || [];
			if (libraryIDs.length) {
				params.libraryIDs = libraryIDs;
			}
			// A tag with an assigned color shows it
			let colors = new Map();
			if (lookup.fieldName === 'tag') {
				for (let id of libraryIDs.length ? libraryIDs : [Zotero.Libraries.userLibraryID]) {
					for (let [name, data] of Zotero.Tags.getColors(id)) {
						if (!colors.has(name)) {
							colors.set(name, data.color);
						}
					}
				}
			}
			let search = Cc["@mozilla.org/autocomplete/search;1?name=zotero"]
				.createInstance(Ci.nsIAutoCompleteSearch);
			return new Promise((resolve) => {
				search.startSearch(prefix, JSON.stringify(params), null, {
					onSearchResult: (_, result) => {
						// Results arrive in batches as the query runs
						if (result.searchResult === Ci.nsIAutoCompleteResult.RESULT_SUCCESS_ONGOING
								|| result.searchResult
									=== Ci.nsIAutoCompleteResult.RESULT_NOMATCH_ONGOING) {
							return;
						}
						let values = [];
						for (let i = 0; i < result.matchCount && i < MAX_LOOKUP_VALUES; i++) {
							values.push(result.getValueAt(i));
						}
						resolve(values.map(value => ({
							text: Zotero.SearchQuery.formatValue(value),
							label: value,
							color: colors.get(value)
						})));
					}
				});
			});
		}

		hideCompletions() {
			// Results from a lookup still in flight would reopen the list
			this._completionGeneration = (this._completionGeneration || 0) + 1;
			if (this._popup && this._popup.state !== "closed") {
				this._popup.hidePopup();
			}
		}

		get _completionPopup() {
			if (!this._popup) {
				this._popup = document.createXULElement("panel");
				this._popup.className = "query-completions";
				this._popup.setAttribute("noautofocus", "true");
				this._popup.setAttribute("ignorekeys", "true");
				this._popup.setAttribute("consumeoutsideclicks", "never");
				this._completionList = document.createXULElement("richlistbox");
				// On mousedown rather than click: focus never leaves the
				// input, and the blur that clicking would cause won't close
				// the list before the click can land
				this._completionList.addEventListener("mousedown", (event) => {
					let row = event.button === 0 && event.target.closest("richlistitem");
					if (row) {
						event.preventDefault();
						this._acceptCompletion(row);
					}
				});
				this._popup.append(this._completionList);
				// A popup in a shadow root gets none of the window's styles, so
				// it goes in the document alongside the other popups
				let popupset = document.querySelector("popupset");
				(popupset || document.documentElement).append(this._popup);
			}
			return this._popup;
		}

		// Replace what's being typed with the given or selected completion,
		// leaving the caret after it so the next part can be typed or
		// completed in turn
		_acceptCompletion(row) {
			row = row || this._completionList.selectedItem || this._completionList.firstChild;
			if (!row || !this._completions) {
				return false;
			}
			let { type, start, end } = this._completions;
			let value = this.inputField.value;
			this.inputField.value = value.slice(0, start) + row.completion.text + value.slice(end);
			let caret = start + row.completion.text.length;
			this.inputField.setSelectionRange(caret, caret);
			this.hideCompletions();
			// Search and redraw as though it had been typed, and offer what
			// comes next -- the values of the condition just completed
			this.inputField.dispatchEvent(new Event("input", { bubbles: true }));
			// A completed value finishes the clause: there's nothing to offer
			// next, so don't reopen the list with the value itself
			if (type === 'value') {
				this.hideCompletions();
			}
			return true;
		}

		_handleCompletionKey(event) {
			if (!this._popup || this._popup.state === "closed" || event.altKey) {
				return;
			}
			let list = this._completionList;
			switch (event.key) {
				case "ArrowDown":
				case "ArrowUp": {
					let rows = list.itemCount;
					let index = list.selectedIndex;
					list.selectedIndex = event.key === "ArrowDown"
						? (index + 1) % rows
						: (index <= 0 ? rows - 1 : index - 1);
					// Moving the selection with the list unfocused doesn't
					// scroll it into view
					list.ensureIndexIsVisible(list.selectedIndex);
					break;
				}
				case "Enter":
					// Only once the user has moved into the list -- otherwise
					// Enter is the search it has always been, with the list
					// out of its way
					if (list.selectedIndex === -1 || !this._acceptCompletion()) {
						this.hideCompletions();
						return;
					}
					break;
				case "Tab":
					if (!this._acceptCompletion()) {
						return;
					}
					break;
				case "Escape":
					this.hideCompletions();
					break;
				default:
					return;
			}
			event.preventDefault();
			event.stopPropagation();
		}

		disconnectedCallback() {
			super.disconnectedCallback();
			this._resizeObserver?.disconnect();
			this._popup?.remove();
		}

		_syncScroll() {
			if (this._highlightLayer) {
				this._highlightLayer.scrollLeft = this.inputField.scrollLeft;
			}
		}

		// Match the input's box and text metrics, so the two render in the
		// same place
		_syncGeometry() {
			if (!this._highlightLayer) {
				return;
			}
			let input = this.inputField;
			let style = window.getComputedStyle(input);
			let layer = this._highlightLayer.style;
			layer.left = input.offsetLeft + "px";
			layer.top = input.offsetTop + "px";
			layer.width = input.offsetWidth + "px";
			layer.height = input.offsetHeight + "px";
			for (let property of ['paddingInlineStart', 'paddingInlineEnd', 'paddingTop',
					'paddingBottom', 'font', 'letterSpacing', 'textIndent']) {
				layer[property] = style[property];
			}
			this._syncScroll();
		}
	}

	customElements.define("query-textbox", QueryTextbox);
}
