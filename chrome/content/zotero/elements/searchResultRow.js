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
	// How close to the window's edge the selection popup may sit, and how far
	// its pointer stays from its own corners
	const POPUP_MARGIN = 8;
	const POINTER_INSET = 16;

	// A best-match search result card: one passage of an item's text that the
	// query matched (see Zotero.BestMatch.Session#getPreviews()) -- where the
	// passage sits in the document as the head, the passage itself as the
	// quote with the query's words marked in it, presented like an
	// annotation-row (the two share their styling, see
	// scss/elements/_annotationRow.scss).
	//
	// The whole passage is quoted, not the line the tree shows: the card is
	// where a match is read rather than scanned. A quote too tall for the
	// card is clamped, with a toggle to see the rest.
	class SearchResultRow extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="head">
				<html:div class="title">
					<html:span class="path"/>
				</html:div>
				<html:div class="location"/>
			</html:div>
			<html:div class="body">
				<html:div class="quote"/>
				<html:button class="show-more" data-l10n-id="search-result-row-show-more" hidden="true"/>
			</html:div>
			<panel class="selection-popup" type="arrow" noautofocus="true" animate="false">
				<html:div class="popup-body">
					<html:div class="colors"/>
					<html:div class="tool-toggle">
						<html:button class="highlight" data-mode="highlight"/>
						<html:button class="underline" data-mode="underline"/>
					</html:div>
					<tags-box class="tags-editor" hidden="true"/>
				</html:div>
			</panel>
		`);

		_result = null;

		// The attachment the passage is from, for annotating it
		itemID = null;

		// Whether to mark the line of the passage the tree quotes -- its
		// snippet -- where the passage is shown in place of that row
		highlightSnippet = false;

		// Offsets into the passage of the text selected when the popup opened
		_selection = null;

		get result() {
			return this._result;
		}

		set result(result) {
			this._result = result;
			this.render();
		}

		init() {
			this._path = this.querySelector('.path');
			this._location = this.querySelector('.location');
			this._quote = this.querySelector('.quote');
			this._showMore = this.querySelector('.show-more');
			this._popup = this.querySelector('.selection-popup');
			this._showMore.addEventListener('click', (event) => {
				// The card's activation (open the attachment) shouldn't fire
				// for the toggle
				event.stopPropagation();
				this._toggleExpanded();
			});
			// Double-click, or Enter on the focused card, opens the attachment
			// at the passage
			this.addEventListener('dblclick', this._handleActivate);
			this.addEventListener('keydown', (event) => {
				if (event.key == 'Enter') {
					this._handleActivate(event);
				}
			});
			this._initSelectionPopup();
			this._quote.addEventListener('mouseup', this._handleQuoteMouseUp);
			this.render();
		}

		destroy() {
			this._quote?.removeEventListener('mouseup', this._handleQuoteMouseUp);
			document.removeEventListener('selectionchange', this._handleSelectionChange);
			document.removeEventListener('scroll', this._handleScroll, true);
		}

		// The popup over a selection, as the reader's: the annotation colors,
		// and the choice between a highlight and an underline, which is the
		// reader's own setting
		_initSelectionPopup() {
			let colors = this._popup.querySelector('.colors');
			for (let [l10nID, color] of Zotero.Annotations.COLORS) {
				let button = document.createElement('button');
				button.className = 'color-button';
				button.style.setProperty('--color', color);
				document.l10n.formatValue(l10nID).then(name => button.title = name);
				button.addEventListener('click', () => this._createAnnotation(color));
				colors.append(button);
			}
			for (let button of this._popup.querySelectorAll('.tool-toggle button')) {
				button.title = Zotero.getString(`pdfReader.${button.dataset.mode}Text`);
				button.addEventListener('click', () => {
					Zotero.Prefs.set('reader.textSelectionAnnotationMode', button.dataset.mode);
					this._updateToolToggle();
				});
			}
			this._tagsBox = this._popup.querySelector('.tags-editor');
			// A press on the popup's buttons must leave the selection alone,
			// which a mousedown would otherwise collapse; the tag field is
			// let through so that it can take focus
			this._popup.addEventListener('mousedown', (event) => {
				if (!event.target.closest('editable-text')) {
					event.preventDefault();
				}
			}, true);
			// The popup grows with the tags added; keep it where the caret is
			new ResizeObserver(() => {
				if (this._popup.state == 'open' && this._anchor) {
					let { width, height } = this._popup.getBoundingClientRect();
					this._popupSize = { width, height };
					let { x, y } = this._getPopupPosition();
					this._popup.moveTo(x, y);
				}
			}).observe(this._popup.querySelector('.popup-body'));
			this._popup.addEventListener('popupshowing', () => {
				this._updateToolToggle();
				// The tags come once the annotation exists
				this._annotated = false;
				this._tagsBox.item = null;
				this._tagsBox.hidden = true;
			});
			// The popup's size is known once shown: place it by it, and
			// remember it for the next time
			this._popup.addEventListener('popupshown', () => {
				let { width, height } = this._popup.getBoundingClientRect();
				this._popupSize = { width, height };
				let { x, y } = this._getPopupPosition();
				this._popup.moveTo(x, y);
			});
			this._popup.addEventListener('popuphidden', () => {
				document.removeEventListener('selectionchange', this._handleSelectionChange);
				document.removeEventListener('scroll', this._handleScroll, true);
				// A selection that was annotated has served its purpose
				if (this._annotated) {
					window.getSelection().removeAllRanges();
				}
				if (this._annotations?.length > 1) {
					this._copyTags(this._annotations).catch(e => Zotero.logError(e));
				}
				this._annotations = null;
				this._selection = null;
				this._annotated = false;
			});
		}

		// Give the selection's other annotations the tags the first ended up
		// with, a tag still being typed included
		async _copyTags([first, ...rest]) {
			await this._tagsBox.blurOpenField();
			let tags = first.getTags();
			await Zotero.DB.executeTransaction(async () => {
				for (let item of rest) {
					item.setTags(tags);
					await item.save();
				}
			});
		}

		// Where the popup goes for the caret it points at: centered on it
		// where the window allows, on the preferred side of it, or the other
		// where that has no room. The pointer is set to aim at the caret.
		_getPopupPosition() {
			let { rect, below } = this._anchor;
			let { width, height } = this._popupSize ?? { width: 206, height: 150 };
			let caretX = rect.left + rect.width / 2;
			if (below && rect.bottom + height > window.innerHeight) {
				below = false;
			}
			else if (!below && rect.top - height < 0) {
				below = true;
			}
			let left = Math.min(Math.max(caretX - width / 2, POPUP_MARGIN), window.innerWidth - width - POPUP_MARGIN);
			let top = below ? rect.bottom : rect.top - height;
			this._popup.classList.toggle('pointer-top', below);
			this._popup.classList.toggle('pointer-bottom', !below);
			let pointerX = Math.min(Math.max(caretX - left, POINTER_INSET), width - POINTER_INSET);
			this._popup.querySelector('.popup-body').style.setProperty('--pointer-x', `${pointerX}px`);
			return { x: window.mozInnerScreenX + left, y: window.mozInnerScreenY + top };
		}

		// The editor of the annotations' tags, as the reader's tags popup
		// shows it: open, with a field to type into, its + button adding
		// more. Edits save to the first annotation as they're made, and
		// reach the others when the popup closes.
		_showTagsEditor(items) {
			this._annotations = items;
			let box = this._tagsBox;
			box.editable = true;
			box.item = items[0];
			box.hidden = false;
			box.render();
			box.open = true;
			box.collapsible = false;
			box.querySelector('.head')?.removeAttribute('tabindex');
			box.newTag();
		}

		_updateToolToggle() {
			let mode = Zotero.Prefs.get('reader.textSelectionAnnotationMode') || 'highlight';
			for (let button of this._popup.querySelectorAll('.tool-toggle button')) {
				button.classList.toggle('active', button.dataset.mode == mode);
			}
		}

		// Offer to annotate the passage once a selection of its text is made,
		// where the passage knows where it sits in the document and the
		// attachment is one that can be annotated this way -- a PDF, until
		// EPUBs and snapshots are. Selecting is fine regardless, to copy.
		// The popup points at the end the selection was finished at, below
		// it for a forward selection and above for a backward one, as in the
		// reader.
		_handleQuoteMouseUp = () => {
			let offsets = this._getSelectedOffsets();
			if (!offsets || !this._result?.anchor || !Zotero.Items.get(this.itemID)?.isPDFAttachment()) {
				return;
			}
			this._selection = offsets;
			let selection = window.getSelection();
			let forward = selection.direction != 'backward';
			this._selectionRange = selection.getRangeAt(0).cloneRange();
			let caret = this._selectionRange.cloneRange();
			caret.collapse(!forward);
			this._anchor = { rect: caret.getBoundingClientRect(), below: forward };
			document.addEventListener('selectionchange', this._handleSelectionChange);
			// Scroll events don't bubble, so they're caught on the way down
			document.addEventListener('scroll', this._handleScroll, true);
			let { x, y } = this._getPopupPosition();
			this._popup.openPopupAtScreen(x, y, false);
		};

		// Scrolling moves the text the popup points at out from under it
		_handleScroll = () => {
			this._popup.hidePopup();
		};

		// The popup goes with the selection it was opened for, until the
		// annotation is made: from then on only a click outside closes it,
		// since the card redraws under it and takes the selection with it.
		// Focusing the tag field collapses the selection without meaning to
		// leave it, so that case puts the selection back instead.
		_handleSelectionChange = () => {
			if (this._annotated || this._getSelectedOffsets()) {
				return;
			}
			if (this._popup.contains(document.activeElement)) {
				let selection = window.getSelection();
				selection.removeAllRanges();
				selection.addRange(this._selectionRange);
				return;
			}
			this._popup.hidePopup();
		};

		// The selected part of the passage as offsets into its text, or null
		// when nothing within the quote is selected
		_getSelectedOffsets() {
			let selection = window.getSelection();
			if (!selection?.rangeCount || selection.isCollapsed) {
				return null;
			}
			let range = selection.getRangeAt(0);
			if (!this._quote.contains(range.startContainer) || !this._quote.contains(range.endContainer)) {
				return null;
			}
			// The quote holds the passage's text and nothing else, so the
			// length of the text before an endpoint is its offset
			let before = document.createRange();
			before.setStart(this._quote, 0);
			before.setEnd(range.startContainer, range.startOffset);
			let start = before.toString().length;
			before.setEnd(range.endContainer, range.endOffset);
			let end = before.toString().length;
			return start < end ? { start, end } : null;
		}

		// Make the annotation, and stay open to tag it
		async _createAnnotation(color) {
			if (this._annotated) {
				return;
			}
			let { start, end } = this._selection;
			let type = Zotero.Prefs.get('reader.textSelectionAnnotationMode') || 'highlight';
			let result = await Zotero.Annotations.createFromSelection(
				this.itemID, this._result.anchor, start, end, { type, color }
			);
			if (this._popup.state != 'open') {
				return;
			}
			if (!result.ok) {
				Zotero.debug(`Couldn't annotate the selected passage text: ${result.reason}`);
				this._popup.hidePopup();
				return;
			}
			this._annotated = true;
			this._showTagsEditor(result.items);
		}

		render() {
			if (!this.initialized || !this._result) return;

			// Where the passage sits: the headings it falls under, or the
			// generic fulltext label for a passage from a document with no
			// outline to read
			if (this._result.outlinePath) {
				this._path.removeAttribute('data-l10n-id');
				this._path.textContent = this._result.outlinePath;
			}
			else {
				document.l10n.setAttributes(this._path, 'search-result-row-fulltext');
			}
			// The page the chunk's section starts on, labeled the way
			// annotation rows label theirs
			this._location.hidden = !this._result.pageLabel;
			if (this._result.pageLabel) {
				this._location.textContent
					= Zotero.getString('pdfReader.page') + ' ' + this._result.pageLabel;
			}

			this._renderQuote();

			// Offer "Show More" only when the quote is actually clamped,
			// which is only measurable once the card has a layout
			this.classList.remove('expanded');
			this._showMore.hidden = true;
			requestAnimationFrame(() => {
				this._showMore.hidden
					= this._quote.scrollHeight <= this._quote.clientHeight;
			});

			// A11y - make focusable and describe the card
			this.setAttribute('tabindex', 0);
			this.setAttribute('aria-label', [
				this._result.outlinePath,
				this._location.hidden ? '' : this._location.textContent,
				this._result.text
			].filter(Boolean).join('. '));
		}

		// The passage's text, with the query's matches and the annotations
		// over it marked, and its snippet wrapped too when asked to mark it
		_renderQuote() {
			let text = this._result.text || '';
			let snippet = this.highlightSnippet ? this._result.snippet : null;
			this._quote.replaceChildren();
			if (!snippet) {
				this._appendMarked(this._quote, text, 0, text.length);
				return;
			}
			let marked = document.createElement('span');
			marked.className = 'snippet';
			this._appendMarked(this._quote, text, 0, snippet.start);
			this._appendMarked(marked, text, snippet.start, snippet.end);
			this._quote.append(marked);
			this._appendMarked(this._quote, text, snippet.end, text.length);
		}

		// Append text[start, end) to a node, cut where a match or an
		// annotation starts or ends, each piece wrapped in a span per layer
		// over it: matches as before, annotations carrying their color
		_appendMarked(node, text, start, end) {
			let layers = [
				...(this._result.ranges || []).map(([from, to]) => ({ from, to })),
				...(this._result.annotations || []).flatMap(annotation => annotation.ranges
					.map(({ start: from, end: to }) => ({ from, to, annotation }))),
			];
			let cuts = new Set([start, end]);
			for (let { from, to } of layers) {
				if (from > start && from < end) cuts.add(from);
				if (to > start && to < end) cuts.add(to);
			}
			let points = [...cuts].sort((a, b) => a - b);
			for (let i = 0; i + 1 < points.length; i++) {
				let [from, to] = [points[i], points[i + 1]];
				let piece = document.createTextNode(text.slice(from, to));
				for (let layer of layers) {
					if (layer.from > from || layer.to < to) {
						continue;
					}
					let span = document.createElement('span');
					if (layer.annotation) {
						span.className = `annotation ${layer.annotation.type}`;
						span.style.setProperty('--annotation-color', layer.annotation.color);
						span.dataset.annotationKey = layer.annotation.key;
						if (layer.annotation.comment) {
							span.title = layer.annotation.comment;
						}
					}
					else {
						span.className = 'match';
					}
					span.append(piece);
					piece = span;
				}
				node.append(piece);
			}
		}

		// Open the card's attachment at its passage -- not from the Show More
		// toggle or the selection popup
		_handleActivate = (event) => {
			if (event.target.closest('.show-more, panel') || !this.itemID
					|| typeof ZoteroPane == 'undefined') {
				return;
			}
			ZoteroPane.viewSearchMatch(this.itemID, this._result, event)
				.catch(e => Zotero.logError(e));
		};

		// Show the attachment's annotations over the passage as they are
		// now, from the chunk Zotero.SDT.readAnchors() reads for it. Left
		// alone when nothing drawn changed, as when only a tag did.
		setAnnotations(read) {
			if (!this._result || !read) {
				return;
			}
			let drawn = ({ text, annotations }) => JSON.stringify([text,
				annotations?.map(({ key, type, color, ranges }) => [key, type, color, ranges])]);
			if (drawn(read) == drawn(this._result)) {
				return;
			}
			this._result.text = read.text;
			this._result.annotations = read.annotations;
			this.render();
		}

		_toggleExpanded() {
			let expanded = this.classList.toggle('expanded');
			document.l10n.setAttributes(this._showMore,
				expanded ? 'search-result-row-show-less' : 'search-result-row-show-more');
		}
	}

	customElements.define('search-result-row', SearchResultRow);
}
