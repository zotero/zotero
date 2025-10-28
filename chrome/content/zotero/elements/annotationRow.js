/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2023 Corporation for Digital Scholarship
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
	class AnnotationRow extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="head">
				<image class="icon"/>
				<html:div class="title"/>
				<html:div class="action"/>
			</html:div>
			<html:div class="body"/>
			<html:div class="tags"/>
		`);

		_annotation = null;

		static get observedAttributes() {
			return ['annotation-id', 'action'];
		}

		attributeChangedCallback(name, oldValue, newValue) {
			switch (name) {
				case 'annotation-id':
					this._annotation = Zotero.Items.get(newValue);
					break;
				case 'action':
					this.action = newValue;
					break;
			}
			this.render();
		}

		get annotation() {
			return this._annotation;
		}

		set annotation(annotation) {
			this._annotation = annotation;
			this.setAttribute('annotation-id', annotation.id);
		}

		get action() {
			return this._action;
		}

		set action(val) {
			if (!val) {
				this._action = null;
			}
			if (val !== "plus") {
				throw new Error("Invalid button value: " + val);
			}
			this._action = val;
		}

		init() {
			this._head = this.querySelector('.head');
			this._title = this.querySelector('.title');
			this._body = this.querySelector('.body');
			this._tags = this.querySelector('.tags');
			this.render();
		}

		render() {
			if (!this.initialized || !this._annotation) return;

			this._title.textContent = Zotero.getString('pdfReader.page') + ' '
				+ (this._annotation.annotationPageLabel || '-');
			
			let type = this._annotation.annotationType;
			if (type == 'image') {
				type = 'area';
			}
			this.querySelector('.icon').src = 'chrome://zotero/skin/16/universal/annotate-' + type + '.svg';
			this.querySelector('.action').replaceChildren();
			if (this.action) {
				let icon = document.createXULElement('toolbarbutton');
				icon.classList.add('zotero-clicky');
				icon.classList.add('zotero-clicky-' + this.action);
				icon.setAttribute('action', this.action);
				this.querySelector('.action').append(icon);
			}
			this._body.replaceChildren();
			
			if (['image', 'ink'].includes(this._annotation.annotationType)) {
				let imagePath = Zotero.Annotations.getCacheImagePath(this._annotation);
				if (imagePath) {
					let img = document.createElement('img');
					img.src = Zotero.File.pathToFileURI(imagePath);
					img.draggable = false;
					this._body.append(img);
					// if the image could not be loaded for some reason (e.g. file is not there),
					// show a placeholder text
					img.addEventListener('error', () => {
						let placeholder = document.createElement('div');
						placeholder.classList.add('comment');
						document.l10n.setAttributes(placeholder, 'annotation-image-not-available');
						this._body.replaceChildren(placeholder);
					});
				}
			}
			
			// Strip all html tags from comment and text for now until the algorithm for safe
			// rendering of relevant html tags is carried over from the reader
			let parserUtils = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);

			if (this._annotation.annotationText) {
				let text = document.createElement('div');
				text.classList.add('quote');
				let plainQuote = parserUtils.convertToPlainText(this._annotation.annotationText, Ci.nsIDocumentEncoder.OutputRaw, 0);
				text.textContent = plainQuote;
				this._body.append(text);
			}
			
			if (this._annotation.annotationComment) {
				let comment = document.createElement('div');
				comment.classList.add('comment');
				let plainComment = parserUtils.convertToPlainText(this._annotation.annotationComment, Ci.nsIDocumentEncoder.OutputRaw, 0);
				comment.textContent = plainComment;
				this._body.append(comment);
			}
			
			let tags = this._annotation.getTags();
			this._tags.hidden = !tags.length;
			this._tags.textContent = tags.map(tag => tag.tag).sort(Zotero.localeCompare).join(Zotero.getString('punctuation.comma') + ' ');
			
			this.style.setProperty('--annotation-color', this._annotation.annotationColor);
			// A11y - make focusable + add screen reader's labels
			this.setAttribute("tabindex", 0);
			let annotationTypeStr = Zotero.getString(`pdfReader.${this.annotation.annotationType}Annotation`);
			let a11yLabel = this._annotation.annotationText ? `${Zotero.getString('pdfReader.annotationText')}: ${this._annotation.annotationText}.` : annotationTypeStr;
			let ariaComment = this._annotation.annotationComment ? `${Zotero.getString('pdfReader.annotationComment')}: ${this._annotation.annotationComment}.` : '';
			let ariaTags = tags.length ? `${Zotero.getString('itemFields.tags')}: ${tags.map(tag => tag.tag).join(', ')}.` : '';
			let a11yDescription = `${ariaComment} ${ariaTags}`;
			this.setAttribute("aria-label", a11yLabel);
			this.setAttribute("aria-description", a11yDescription);
		}
	}

	customElements.define('annotation-row', AnnotationRow);
}
