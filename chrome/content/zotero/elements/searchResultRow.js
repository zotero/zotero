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
	// A best-match search result card: one fulltext chunk of an attachment
	// (see Zotero.Embeddings.getMatchingChunks()), presented like an
	// annotation-row -- where the chunk sits in the document as the head,
	// its text as the quote. The two share their styling (see
	// scss/elements/_annotationRow.scss).
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

		_chunk = null;

		get chunk() {
			return this._chunk;
		}

		set chunk(chunk) {
			this._chunk = chunk;
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
			if (!this.initialized || !this._chunk) return;

			// The chunk's outline path says where in the document it came
			// from; a chunk from a document without an outline falls back to
			// a generic label
			if (this._chunk.outlinePath) {
				this._path.removeAttribute('data-l10n-id');
				this._path.textContent = this._chunk.outlinePath;
			}
			else {
				document.l10n.setAttributes(this._path, 'search-result-row-fulltext');
			}
			// Which piece of a split section this is, so a match reads as
			// coming from the middle or the end of its section
			let parts = this._chunk.sectionParts;
			this._part.hidden = !(parts > 1);
			if (parts > 1) {
				this._part.textContent = `${this._chunk.sectionPart}/${parts}`;
			}
			// The page the chunk's section starts on, labeled the way
			// annotation rows label theirs
			this._location.hidden = !this._chunk.pageLabel;
			if (this._chunk.pageLabel) {
				this._location.textContent
					= Zotero.getString('pdfReader.page') + ' ' + this._chunk.pageLabel;
			}

			this._quote.textContent = this._chunk.text || '';

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
				this._chunk.outlinePath,
				this._location.hidden ? '' : this._location.textContent,
				this._chunk.text
			].filter(Boolean).join('. '));
		}

		_toggleExpanded() {
			let expanded = this.classList.toggle('expanded');
			document.l10n.setAttributes(this._showMore,
				expanded ? 'search-result-row-show-less' : 'search-result-row-show-more');
		}
	}

	customElements.define('search-result-row', SearchResultRow);
}
