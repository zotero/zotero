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
				<spacer flex="1"/>
				<toolbarbutton class="button zotero-clicky zotero-clicky-options" tabindex="0"/>
			</html:div>
			<html:div class="body">
				<html:img/>
				<html:div class="quote"/>
			</html:div>
			<html:div class="tags keyboard-clickable" tabindex="0"/>
		`);

		_annotation = null;

		static get observedAttributes() {
			return ['annotation-id'];
		}

		attributeChangedCallback(name, oldValue, newValue) {
			switch (name) {
				case 'annotation-id':
					this._annotation = Zotero.Items.get(newValue);
					break;
			}
			this.render();
		}

		get annotation() {
			return this._annotation;
		}

		get isEditable() {
			return this._annotation.isEditable() && !this._annotation.annotationIsExternal;
		}

		set annotation(annotation) {
			this._annotation = annotation;
			this.setAttribute('annotation-id', annotation.id);
		}

		destroy() {
			this.removeEventListener('keydown', this._handleKeyDown);
			this._tags.removeEventListener('click', this._handleTagsClick);
			this._options.removeEventListener('click', this._openMenu);
			this._comment.removeEventListener('click', this._makeCommentEditable);
			this._img.removeEventListener('error', this._handleImageError);
			this._deleteEditor();
		}

		init() {
			this._head = this.querySelector('.head');
			this._title = this.querySelector('.title');
			this._body = this.querySelector('.body');
			this._tags = this.querySelector('.tags');
			this._options = this.querySelector('.head toolbarbutton');
			this._img = this.querySelector('img');
			this._quote = this.querySelector('.quote');
			this._commentInEditor = null;

			// <html:div> placed directly in content string will strip all
			// html tags when .innerHTML is set. But a node created dynamically won't.
			this._comment = document.createElement('div');
			this._comment.className = "comment keyboard-clickable";
			this._comment.setAttribute('role', 'button');
			this._quote.after(this._comment);

			this.addEventListener('keydown', this._handleKeyDown.bind(this));
			this._tags.addEventListener('click', this._handleTagsClick.bind(this));
			this._options.addEventListener('click', this._openMenu.bind(this));
			this._comment.addEventListener('click', this._makeCommentEditable.bind(this));
			// show a placeholder text if the image could not be loaded for some reason (e.g. file is not there)
			this._img.addEventListener('error', this._handleImageError);
			
			this.render();
		}

		_handleTagsClick() {
			if (!this.isEditable) return;
			let { x, y, height } = this.getBoundingClientRect();
			Zotero.Annotations.insertAnnotationsTagsPopup(this, this._annotation, x, y + height);
		}

		_handleImageError() {
			let placeholder = document.createElement('div');
			placeholder.classList.add('comment');
			document.l10n.setAttributes(placeholder, 'annotation-image-not-available');
			this._body.replaceChildren(placeholder);
		}

		// To edit comment, replace the comment div with the simpleEditor.html iframe
		_makeCommentEditable() {
			if (!this.isEditable) return;

			let editorFrameWrapper = document.createElement('div');
			editorFrameWrapper.className = "comment editable";
			this._editorFrame = document.createElement('iframe');
			this._editorFrame.setAttribute('src', 'chrome://zotero/content/integration/simpleEditor.html');
			this._editorFrame.setAttribute('type', 'content');
			this._editorFrame.setAttribute('tight', 'true');
			this._editorFrame.setAttribute('toolbar-below-editor', 'true');
			this._editorFrame.setAttribute('actions', 'bold,italic,underline,subscript,superscript,removeformat');
			let actionBarHeight = 20;
			this._editorFrame.style.height = (this._comment.getBoundingClientRect().height + actionBarHeight) + 'px';

			// Hide the comment div and insert the editor frame
			editorFrameWrapper.appendChild(this._editorFrame);
			this._comment.after(editorFrameWrapper);
			this._comment.classList.add('hidden');

			this._editorFrame.addEventListener('input', this._handleEditorInput);
			this._editorFrame.addEventListener('focusout', this._handleEditorFocusOut);
			this._editorFrame.addEventListener('keydown', this._handleEditorKeyDown);
			this._editorFrame.contentWindow.addEventListener('load', this._handleEditorIframeLoaded, { once: true });
		}

		// Adjust the height of the frame as the user types to match
		// the height of the content
		_handleEditorInput = () => {
			let height = this._editorFrame.contentWindow.editor.getTotalHeight();
			this._editorFrame.style.height = height + 'px';
			this._commentInEditor = this._editorFrame.contentWindow.editor.getContent();
		};

		_handleEditorFocusOut = async () => {
			if (this._commentInEditor === null) return;
			let content = this._commentFromHTML();
			// Wait a moment to see if the focus remains in the editor
			await Zotero.Promise.delay(10);
			if (this._editorFrame.contentDocument && this._editorFrame.contentDocument.hasFocus()) return;
			// Place updated content into the comment div, so it appears faster
			this._comment.innerHTML = content || Zotero.getString('pdfReader.addComment');
			this._comment.classList.remove('hidden');
			this._deleteEditor();

			this._annotation.annotationComment = content || null;
			this._annotation.saveTx();
		};

		// <br> -> \n, &nbsp; -> ' ', <div></div> -> \n
		_commentFromHTML = () => {
			let content = this._commentInEditor.replace(/<br>/g, '\n');
			content = content.replace(/&nbsp;/g, ' ');
			content = content.replace(/<div>/g, '').replace(/<\/?div>/g, '\n');
			return content.trim();
		};

		_commentToHTML = () => {
			let content = this._annotation.annotationComment;
			if (!content) return "";
			content = content.replace(/\n/g, '<br/>');
			return content;
		};

		// Ctrl/Cmd+Enter in the editor will save current changes
		// Escape will cancel the edits
		_handleEditorKeyDown = (event) => {
			if (event.key == "Enter" && (event.metaKey && !event.ctrlKey)) {
				this._editorFrame.blur();
			}
			else if (event.key == "Escape") {
				this._comment.classList.remove('hidden');
				this._deleteEditor();
				this._comment.focus({ focusVisible: true });
				event.stopPropagation();
			}
		};

		// Set the content of the editor to the current comment and adjust
		// the height of the editor frame to match the content
		_handleEditorIframeLoaded = async () => {
			let editor = this._editorFrame.contentWindow.editor;
			editor.setContent(this._commentToHTML());
			editor.focusContent();
			this._commentInEditor = this._annotation.annotationComment || "";
			let height = editor.getTotalHeight();
			this._editorFrame.style.height = height + 'px';
		};
		
		_deleteEditor() {
			if (!this._editorFrame) return;
			this._commentInEditor = null;
			this._editorFrame.parentElement.remove();
			this._editorFrame.removeEventListener('input', this._handleEditorInput);
			this._editorFrame.removeEventListener('focusout', this._handleEditorFocusOut);
			this._editorFrame.removeEventListener('keydown', this._handleEditorKeyDown);
		}

		// Keyboard navigation
		// ArrowUp/Down navigate between annotations
		// Tab/Shift+Tab will move focus through the currently focused annotation
		_handleKeyDown(event) {
			if (event.target.tagName == "annotation-row" && event.key == "Tab" && event.shiftKey) {
				let firstAnnotation = this.parentNode.querySelector("annotation-row");
				Services.focus.moveFocus(window, firstAnnotation, Services.focus.MOVEFOCUS_BACKWARD, 0);
				event.preventDefault();
			}
			if (event.target.classList.contains("tags") && event.key == "Tab" && !event.shiftKey) {
				let lastTags = this.parentNode.querySelector("annotation-row:last-child .tags");
				Services.focus.moveFocus(window, lastTags, Services.focus.MOVEFOCUS_FORWARD, 0);
				event.preventDefault();
			}
			else if (event.target.tagName == "annotation-row" && ["ArrowUp", "ArrowDown"].includes(event.key)) {
				let annotationRows = [...this.parentNode.querySelectorAll("annotation-row")];
				let currentRowIndex = annotationRows.indexOf(event.target);
				let nextRowIndex = currentRowIndex + (event.key == "ArrowDown" ? 1 : -1);
				annotationRows[nextRowIndex]?.focus();
				event.preventDefault();
			}
		}

		// Generate and open the menu with annotation color options
		_openMenu() {
			if (!this.isEditable) return;

			let colors = [
				{ color: "#ffd400", label: Zotero.getString('general.yellow') },
				{ color: "#ff6666", label: Zotero.getString('general.red') },
				{ color: "#5fb236", label: Zotero.getString('general.green') },
				{ color: "#2ea8e5", label: Zotero.getString('general.blue') },
				{ color: "#a28ae5", label: Zotero.getString('general.purple') },
				{ color: "#e56eee", label: Zotero.getString('general.magenta') },
				{ color: "#f19837", label: Zotero.getString('general.orange') },
				{ color: "#aaaaaa", label: Zotero.getString('general.gray') }
			];
			
			let optionsPopup = document.createXULElement('panel');
			let vboxWrapper = document.createXULElement('vbox');
			vboxWrapper.classList.add('annotations-options-popup');
			optionsPopup.appendChild(vboxWrapper);
			
			// Create color menu options
			for (let [index, colorOption] of colors.entries()) {
				let hbox = document.createXULElement('hbox');
				hbox.className = "menu-option color keyboard-clickable";
				hbox.setAttribute('tabindex', 0);
				hbox.setAttribute('index', index);
				hbox.setAttribute('role', 'button');
				hbox.setAttribute('aria-label', colorOption.label);
				
				// Create color swatch span
				let colorSwatch = document.createElement('span');
				colorSwatch.classList.add('color-swatch');
				colorSwatch.style.backgroundColor = colorOption.color;
				
				// Create label for the color
				let colorLabel = document.createXULElement('label');
				colorLabel.textContent = colorOption.label;
				colorLabel.classList.add('color-label');
				
				// Add elements to hbox
				hbox.appendChild(colorSwatch);
				hbox.appendChild(colorLabel);
				vboxWrapper.appendChild(hbox);

				hbox.addEventListener('click', () => {
					this._annotation.annotationColor = colorOption.color;
					this._annotation.saveTx();
					optionsPopup.hidePopup();
				});
			}

			let separator = document.createXULElement('menuseparator');
			let deleteOption = document.createXULElement('hbox');
			deleteOption.className = "menu-option delete keyboard-clickable";
			deleteOption.setAttribute('tabindex', 0);
			deleteOption.setAttribute('index', colors.length);

			// Add delete menu option
			let deleteLabel = document.createXULElement('label');
			deleteLabel.textContent = Zotero.getString('general.delete');
			deleteLabel.classList.add('delete-label');
			deleteOption.appendChild(deleteLabel);
			deleteOption.addEventListener('click', () => {
				this._annotation.eraseTx();
				optionsPopup.hidePopup();
			});
			vboxWrapper.appendChild(separator);
			vboxWrapper.appendChild(deleteOption);
			
			this.append(optionsPopup);

			// Focus the first option when the popup is shown
			optionsPopup.addEventListener('popupshown', () => {
				optionsPopup.querySelector(".menu-option").focus();
			});

			// When the popup is closed, it is deleted
			optionsPopup.addEventListener('popuphidden', (event) => {
				if (event.target === optionsPopup) {
					optionsPopup.remove();
				}
			});

			// ArrowUp/Down will navigate between menu options
			optionsPopup.addEventListener('keydown', (event) => {
				if (["ArrowUp", "ArrowDown"].includes(event.key)) {
					let currentIndex = parseInt(event.target.getAttribute('index'));
					let nextIndex = event.key == "ArrowDown" ? (currentIndex + 1) : (currentIndex - 1);
					optionsPopup.querySelector(`.menu-option[index="${nextIndex}"]`)?.focus();
				}
			});

			// Open popup by the bottom left corner of the button
			let { x, y, height } = this._options.getBoundingClientRect();
			optionsPopup.openPopup(null, 'before_start', x, y + height, true);
		}
		

		render() {
			if (!this.initialized) return;

			this._title.textContent = Zotero.getString('pdfReader.page') + ' '
				+ (this._annotation.annotationPageLabel || '-');
			// Begin by hiding all elements, relevant ones will be un-hidden lower
			this._img.hidden = true;
			this._quote.hidden = true;
			this._comment.hidden = true;
			this._tags.hidden = true;
			
			if (this.isEditable) {
				document.l10n.setAttributes(this._options, 'annotation-change-color');
			}
			else {
				document.l10n.setAttributes(this._options, 'annotation-not-editable-' + (this.annotation.annotationIsExternal ? 'external' : 'other-user'));
			}
			this._options.disabled = !this.isEditable;

			let type = this._annotation.annotationType;
			if (type == 'image') {
				type = 'area';
			}
			this.querySelector('.icon').src = 'chrome://zotero/skin/16/universal/annotate-' + type + '.svg';
			
			if (['image', 'ink'].includes(this._annotation.annotationType)) {
				this._img.hidden = false;
				let imagePath = Zotero.Annotations.getCacheImagePath(this._annotation);
				if (imagePath) {
					this._img.src = Zotero.File.pathToFileURI(imagePath);
					this._img.draggable = false;
				}
			}
			
			// Strip all html tags from comment and text for now until the algorithm for safe
			// rendering of relevant html tags is carried over from the reader
			let parserUtils = Cc["@mozilla.org/parserutils;1"].getService(Ci.nsIParserUtils);

			if (this._annotation.annotationText) {
				let plainQuote = parserUtils.convertToPlainText(this._annotation.annotationText, Ci.nsIDocumentEncoder.OutputRaw, 0);
				this._quote.textContent = plainQuote;
				this._quote.hidden = false;
			}
			
			// let plainComment = parserUtils.convertToPlainText(this._annotation.annotationComment, Ci.nsIDocumentEncoder.OutputRaw, 0) || "Add comment";
			if (this._annotation.annotationComment) {
				this._comment.hidden = false;
				this._comment.innerHTML = this._commentToHTML();
			}
			else if (this.isEditable) {
				this._comment.hidden = false;
				this._comment.innerHTML = Zotero.getString('pdfReader.addComment');
			}
			this._comment.setAttribute('aria-description', Zotero.getString('pdfReader.annotationComment'));

			let tags = this._annotation.getTags();
			if (tags.length) {
				this._tags.hidden = false;
				this._tags.textContent = tags.map(tag => tag.tag).sort(Zotero.localeCompare).join(Zotero.getString('punctuation.comma') + ' ');
			}
			else if (this.isEditable) {
				this._tags.hidden = false;
				this._tags.textContent = Zotero.getString('pdfReader.addTags');
			}
			this._tags.setAttribute('aria-description', Zotero.getString('pdfReader.manageTags'));
			
			
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
