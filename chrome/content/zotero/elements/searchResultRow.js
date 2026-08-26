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
					<html:span class="part"/>
				</html:div>
				<html:div class="location"/>
			</html:div>
			<html:div class="body">
				<html:div class="quote"/>
				<html:button class="show-more" data-l10n-id="search-result-row-show-more" hidden="true"/>
			</html:div>
		`);

		_result = null;

		get result() {
			return this._result;
		}

		set result(result) {
			this._result = result;
			this.render();
		}

		init() {
			this._path = this.querySelector('.path');
			this._part = this.querySelector('.part');
			this._location = this.querySelector('.location');
			this._quote = this.querySelector('.quote');
			this._showMore = this.querySelector('.show-more');
			this._showMore.addEventListener('click', (event) => {
				// The card's activation (open the attachment) shouldn't fire
				// for the toggle
				event.stopPropagation();
				this._toggleExpanded();
			});
			this.render();
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
			// Which piece of a split section this is, so a match reads as
			// coming from the middle or the end of its section
			let parts = this._result.sectionParts;
			this._part.hidden = !(parts > 1);
			if (parts > 1) {
				this._part.textContent = `${this._result.sectionPart}/${parts}`;
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

		// The passage's text, with any matched ranges wrapped for highlighting
		_renderQuote() {
			let text = this._result.text || '';
			let ranges = this._result.ranges || [];
			if (!ranges.length) {
				this._quote.textContent = text;
				return;
			}
			this._quote.replaceChildren();
			let position = 0;
			for (let [start, end] of ranges) {
				if (start > position) {
					this._quote.append(text.slice(position, start));
				}
				let match = document.createElement('span');
				match.className = 'match';
				match.textContent = text.slice(start, end);
				this._quote.append(match);
				position = end;
			}
			if (position < text.length) {
				this._quote.append(text.slice(position));
			}
		}

		_toggleExpanded() {
			let expanded = this.classList.toggle('expanded');
			document.l10n.setAttributes(this._showMore,
				expanded ? 'search-result-row-show-less' : 'search-result-row-show-more');
		}
	}

	customElements.define('search-result-row', SearchResultRow);
}
