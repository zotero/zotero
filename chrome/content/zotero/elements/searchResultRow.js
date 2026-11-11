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
	// The blocks shown as a placeholder, their text kept but not displayed
	const PLACEHOLDER_BLOCKS = ['table', 'image'];

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
					<html:div class="selection-tools">
						<html:div class="colors"/>
						<html:div class="tool-toggle">
							<html:button class="highlight" data-mode="highlight"/>
							<html:button class="underline" data-mode="underline"/>
						</html:div>
					</html:div>
					<html:div class="annotation-editor" hidden="true">
						<html:div class="head">
							<image class="icon"/>
							<html:div class="title"/>
						</html:div>
						<editable-text class="comment" multiline="true"/>
					</html:div>
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

		// The popup, as the reader's two: over a selection, the annotation
		// colors and the choice between a highlight and an underline, which
		// is the reader's own setting; over an existing annotation, its
		// page, comment and tags
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
			this._tools = this._popup.querySelector('.selection-tools');
			this._editor = this._popup.querySelector('.annotation-editor');
			this._comment = this._popup.querySelector('.comment');
			this._comment.placeholder = Zotero.getString('pdfReader.addComment');
			this._comment.addEventListener('change', () => {
				this._saveComment().catch(e => Zotero.logError(e));
			});
			// A press on the popup's buttons must leave the selection alone,
			// which a mousedown would otherwise collapse; the text fields are
			// let through so that they can take focus
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
				// Over a selection, the tools to make an annotation with;
				// over an existing annotation, that annotation's editors
				let annotation = this._opening;
				this._opening = null;
				this._popup.classList.toggle('annotation', !!annotation);
				this._tools.hidden = !!annotation;
				this._editor.hidden = !annotation;
				if (annotation) {
					this._showAnnotationEditor(annotation);
				}
				else {
					this._updateToolToggle();
				}
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
				if (this._annotation) {
					let box = this._tagsBox;
					this._tagsBox = null;
					this._finishEdits(this._annotation, box)
						.catch(e => Zotero.logError(e))
						// Not box.remove(): tags-box's remove() takes a tag
						.finally(() => this._editor.removeChild(box));
				}
				this._annotation = null;
				this._selection = null;
			});
		}

		// Keep what the fields hold when the popup closes, a tag still being
		// typed included
		async _finishEdits(item, tagsBox) {
			await tagsBox.blurOpenField();
			await this._saveComment(item);
		}

		// Save the comment field to the annotation it edits, when changed
		async _saveComment(item = this._annotation) {
			if (!item || this._comment.readOnly) {
				return;
			}
			let comment = this._comment.value.trim();
			if (comment == (item.annotationComment || '')) {
				return;
			}
			item.annotationComment = comment;
			await item.saveTx({ skipSelect: true });
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

		// The annotation as the reader's popup shows it: its type and page
		// in the head, its comment, and its tags as the reader's tags popup
		// shows them -- open, the + button adding more. Edits save as
		// they're made.
		_showAnnotationEditor(item) {
			this._annotation = item;
			let editable = item.isEditable();
			let head = this._editor.querySelector('.head');
			head.style.setProperty('--annotation-color', item.annotationColor);
			head.querySelector('.icon').src
				= `chrome://zotero/skin/16/universal/annotate-${item.annotationType}.svg`;
			head.querySelector('.title').textContent
				= Zotero.getString('pdfReader.page') + ' ' + (item.annotationPageLabel || '-');
			this._comment.readOnly = !editable;
			this._comment.value = item.annotationComment || '';
			// The tags editor lives only while the popup shows an annotation,
			// as each one watches the notifier
			let box = document.createXULElement('tags-box');
			box.className = 'tags-editor';
			this._editor.append(box);
			this._tagsBox = box;
			box.editable = editable;
			box.item = item;
			box.render();
			box.open = true;
			box.collapsible = false;
			box.querySelector('.head')?.removeAttribute('tabindex');
		}

		_updateToolToggle() {
			let mode = Zotero.Prefs.get('reader.textSelectionAnnotationMode') || 'highlight';
			for (let button of this._popup.querySelectorAll('.tool-toggle button')) {
				button.classList.toggle('active', button.dataset.mode == mode);
			}
		}

		// Offer to annotate the passage once a selection of its text is made,
		// where the passage's structure is known and the attachment is one
		// that can be annotated this way -- a PDF, until EPUBs and snapshots
		// are. Selecting is fine regardless, to copy. A click on an
		// annotation drawn over the passage opens it instead, to see and
		// edit its comment and tags.
		// The popup points at the end the selection was finished at, below
		// it for a forward selection and above for a backward one, as in the
		// reader; at an annotation, below it.
		_handleQuoteMouseUp = (event) => {
			let offsets = this._getSelectedOffsets();
			if (!offsets) {
				let span = event.target.closest?.('.annotation');
				let annotation = span && this._getAnnotation(span.dataset.annotationKey);
				if (annotation) {
					this._opening = annotation;
					this._openPopup({ rect: span.getBoundingClientRect(), below: true });
				}
				return;
			}
			// Only a passage of known structure can be annotated, in an
			// attachment the reader annotates
			let item = Zotero.Items.get(this.itemID);
			if (!this._result?.segments?.length
					|| !(item?.isPDFAttachment() || item?.isEPUBAttachment() || item?.isSnapshotAttachment())) {
				return;
			}
			this._selection = offsets;
			let selection = window.getSelection();
			let forward = selection.direction != 'backward';
			this._selectionRange = selection.getRangeAt(0).cloneRange();
			let caret = this._selectionRange.cloneRange();
			caret.collapse(!forward);
			document.addEventListener('selectionchange', this._handleSelectionChange);
			this._openPopup({ rect: caret.getBoundingClientRect(), below: forward });
		};

		// The attachment's annotation drawn with the key, as an item
		_getAnnotation(key) {
			let libraryID = Zotero.Items.get(this.itemID)?.libraryID;
			return libraryID ? Zotero.Items.getByLibraryAndKey(libraryID, key) || null : null;
		}

		_openPopup(anchor) {
			this._anchor = anchor;
			// Scroll events don't bubble, so they're caught on the way down
			document.addEventListener('scroll', this._handleScroll, true);
			let { x, y } = this._getPopupPosition();
			this._popup.openPopupAtScreen(x, y, false);
		}

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
			if (this._getSelectedOffsets()) {
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

		// The selection as content ranges in the document's structure: the
		// part of each displayed segment it covers, between points in the
		// segment's text node. The text of a placeholder is in the quote but
		// not shown, so a selection over it selects nothing of it
		_getSelectedRanges({ start, end }) {
			let point = (segment, offset) => [...segment.ref, segment.offset + offset - segment.start];
			return (this._result.segments || [])
				.filter(segment => Math.max(start, segment.start) < Math.min(end, segment.end)
					&& !segment.blocks.some(block => PLACEHOLDER_BLOCKS.includes(block.type)))
				.map(segment => [point(segment, Math.max(start, segment.start)), point(segment, Math.min(end, segment.end))]);
		}

		// Make the annotation and close, as the reader does; a click on the
		// annotation then opens it for its comment and tags
		async _createAnnotation(color) {
			if (this._creating) {
				return;
			}
			this._creating = true;
			try {
				let type = Zotero.Prefs.get('reader.textSelectionAnnotationMode') || 'highlight';
				let ranges = this._getSelectedRanges(this._selection);
				let result = ranges.length
					? await Zotero.Annotations.createFromRanges(this.itemID, ranges, { type, color })
					: { ok: false, reason: 'nothing selected' };
				if (!result.ok) {
					Zotero.debug(`Couldn't annotate the selected passage text: ${result.reason}`);
				}
				else {
					// The selection has served its purpose
					window.getSelection().removeAllRanges();
				}
			}
			finally {
				this._creating = false;
				this._popup.hidePopup();
			}
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
			// which is only measurable once the card has a layout, and
			// collapsed: a card shown in full stays so across a redraw, so
			// it's measured collapsed within the frame and never shows
			// otherwise
			let expanded = this.classList.contains('expanded');
			if (!expanded) {
				this._setExpanded(false);
				this._showMore.hidden = true;
			}
			requestAnimationFrame(() => {
				this.classList.remove('expanded');
				this._showMore.hidden
					= this._quote.scrollHeight <= this._quote.clientHeight;
				this._setExpanded(expanded && !this._showMore.hidden);
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
		// over it marked, and its snippet wrapped too when asked to mark it.
		// Shown as the document's blocks where the passage's structure is
		// known, as running text otherwise.
		_renderQuote() {
			let text = this._result.text || '';
			let segments = this._result.segments;
			this._quote.replaceChildren();
			this._quote.classList.toggle('structured', !!segments?.length);
			this._annotationLayers = segments?.length ? this._getAnnotationLayers(segments) : [];
			if (segments?.length) {
				this._renderBlocks(text, segments);
			}
			else {
				this._appendMarked(this._quote, text, 0, text.length);
			}
		}

		// The annotations' content ranges as offsets into the passage's
		// text: each lies on a text node, and the segment showing that
		// part of the node places it
		_getAnnotationLayers(segments) {
			let layers = [];
			for (let annotation of this._result.annotations || []) {
				for (let [from, to] of annotation.ranges || []) {
					let ref = from.slice(0, -1).join('.');
					for (let segment of segments) {
						if (segment.ref.join('.') != ref) {
							continue;
						}
						let start = Math.max(from.at(-1), segment.offset);
						let end = Math.min(to.at(-1), segment.offset + segment.end - segment.start);
						if (start < end) {
							layers.push({ from: segment.start + start - segment.offset,
								to: segment.start + end - segment.offset, annotation });
						}
					}
				}
			}
			return layers;
		}

		// Simple rendering of segments of structured-text
		_renderBlocks(text, segments) {
			let open = [];
			let cursor = 0;
			let innermost = () => open.at(-1)?.element ?? this._quote;
			for (let segment of segments) {
				let chain = segment.blocks;
				let placeholder = chain.findIndex(block => PLACEHOLDER_BLOCKS.includes(block.type));
				if (placeholder >= 0) {
					chain = chain.slice(0, placeholder + 1);
				}
				let shared = 0;
				while (shared < open.length && shared < chain.length
						&& open[shared].key == chain[shared].ref.join('.')) {
					shared++;
				}
				open.length = shared;
				if (segment.start > cursor) {
					this._appendMarked(innermost(), text, cursor, segment.start);
				}
				for (let block of chain.slice(shared)) {
					let element = this._createBlockElement(block);
					innermost().append(element);
					open.push({ key: block.ref.join('.'), element });
				}
				let target = innermost();
				if (placeholder >= 0) {
					target = document.createElement('span');
					target.className = 'hidden-text';
					innermost().append(target);
				}
				this._appendMarked(this._styled(target, segment.style), text, segment.start, segment.end);
				cursor = segment.end;
			}
			if (cursor < text.length) {
				this._appendMarked(this._quote, text, cursor, text.length);
			}
		}

		// An element for a block, after the reader's rendering of the same
		// structure; math is shown as text, marked for what it is, a table
		// or an image as a placeholder
		_createBlockElement(block) {
			let tags = {
				paragraph: 'p',
				heading: 'h4',
				blockquote: 'blockquote',
				list: block.ordered ? 'ol' : 'ul',
				listitem: 'li',
				table: 'figure',
				caption: 'figcaption',
				note: 'aside',
				preformatted: 'pre',
				math: 'div',
				image: 'figure',
			};
			let element = document.createElement(tags[block.type] || 'div');
			element.className = `block ${block.type}`;
			element.dataset.ref = block.ref.join('.');
			if (block.type == 'list' && block.ordered && block.startIndex > 1) {
				element.start = block.startIndex;
			}
			return element;
		}

		// Where a segment's text goes for its inline style: wrappers inside
		// the given node, innermost last, as the reader nests them
		_styled(node, style) {
			if (!style) {
				return node;
			}
			for (let [flag, tag] of [['bold', 'strong'], ['italic', 'em'], ['sup', 'sup'], ['sub', 'sub'], ['monospace', 'code']]) {
				if (style[flag]) {
					let wrapper = document.createElement(tag);
					node.append(wrapper);
					node = wrapper;
				}
			}
			return node;
		}

		// Append text[start, end) to a node, cut where a match, an annotation
		// or the snippet starts or ends, each piece wrapped in a span per
		// layer over it: matches and the snippet as such, annotations
		// carrying their color
		_appendMarked(node, text, start, end) {
			let layers = [
				...(this._result.ranges || []).map(([from, to]) => ({ from, to, className: 'match' })),
				...(this._annotationLayers || []),
			];
			let snippet = this.highlightSnippet ? this._result.snippet : null;
			if (snippet) {
				layers.push({ from: snippet.start, to: snippet.end, className: 'snippet' });
			}
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
						span.className = layer.className;
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
			this._result.segments = read.segments;
			this.render();
		}

		_toggleExpanded() {
			this._setExpanded(!this.classList.contains('expanded'));
		}

		_setExpanded(expanded) {
			this.classList.toggle('expanded', expanded);
			document.l10n.setAttributes(this._showMore,
				expanded ? 'search-result-row-show-less' : 'search-result-row-show-more');
		}
	}

	customElements.define('search-result-row', SearchResultRow);
}
