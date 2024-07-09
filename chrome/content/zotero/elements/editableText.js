/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2020 Corporation for Digital Scholarship
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
	class EditableText extends XULElementBase {
		_input;
		
		_textDirection = null;
		
		_ignoredWindowInactiveBlur = false;
		
		static observedAttributes = [
			'multiline',
			'readonly',
			'placeholder',
			'aria-label',
			'aria-labelledby',
			'value',
			'nowrap',
			'autocomplete',
			'min-lines',
			'max-lines'
		];
		
		static get _textMeasurementSpan() {
			// Create our hidden span in the hiddenDOMWindow, because any calls to
			// getBoundingClientRect(), offsetWidth, scrollWidth, etc. on an element
			// in this document from sizeToContent() will, bizarrely, cause things
			// in the metadata table to overlap
			// TODO: Revisit after next Fx platform upgrade
			let doc = Services.appShell.hiddenDOMWindow.document;
			let span = doc.createElement('span');
			span.style.position = 'absolute';
			span.style.visibility = 'hidden';
			span.style.whiteSpace = 'pre';
			doc.documentElement.append(span);

			window.addEventListener('unload', () => {
				span.remove();
			});

			// Replace the getter with a value
			Object.defineProperty(this, '_textMeasurementSpan', {
				value: span
			});
			return span;
		}
		
		get noWrap() {
			return this.hasAttribute('nowrap');
		}
		
		set noWrap(noWrap) {
			this.toggleAttribute('nowrap', noWrap);
		}

		get minLines() {
			return this.getAttribute('min-lines') || 0;
		}

		get maxLines() {
			return this.getAttribute('max-lines') || 0;
		}
		

		get multiline() {
			return this.hasAttribute('multiline');
		}
		
		set multiline(multiline) {
			this.toggleAttribute('multiline', multiline);
		}
		
		get readOnly() {
			return this.hasAttribute('readonly');
		}
		
		set readOnly(readOnly) {
			this.toggleAttribute('readonly', readOnly);
		}

		get placeholder() {
			return this.getAttribute('placeholder') || '';
		}
		
		set placeholder(placeholder) {
			this.setAttribute('placeholder', placeholder || '');
		}
		
		get ariaLabel() {
			return this.getAttribute('aria-label') || '';
		}

		get ariaLabelledBy() {
			return this.getAttribute('aria-labelledby') || '';
		}
		
		set ariaLabel(ariaLabel) {
			this.setAttribute('aria-label', ariaLabel);
		}
		
		get value() {
			return this.getAttribute('value') || '';
		}
		
		set value(value) {
			this.setAttribute('value', value || '');
			this.resetTextDirection();
		}
		
		get initialValue() {
			return this._input?.dataset.initialValue ?? '';
		}
		
		set initialValue(initialValue) {
			this._input.dataset.initialValue = initialValue ?? '';
		}
		
		get autocomplete() {
			let val = this.getAttribute('autocomplete');
			try {
				let props = JSON.parse(val);
				if (typeof props === 'object') {
					return props;
				}
			}
			catch (e) {
				// Ignore
			}
			return null;
		}
		
		set autocomplete(val) {
			if (val) {
				this.setAttribute('autocomplete', JSON.stringify(val));
			}
			else {
				this.removeAttribute('autocomplete');
			}
		}
		
		get ref() {
			return this._input;
		}

		resetTextDirection() {
			this._textDirection = null;
			if (this._input) {
				this._input.dir = null;
			}
		}
		
		sizeToContent = () => {
			let span = this.constructor._textMeasurementSpan;
			let { font, paddingLeft, paddingRight, borderLeftWidth, borderRightWidth } = getComputedStyle(this._input);
			span.style.font = font;
			span.textContent = this.value || this.placeholder;
			this.style.maxWidth = `calc(${span.getBoundingClientRect().width}px + ${paddingLeft} + ${paddingRight} + ${borderLeftWidth} + ${borderRightWidth})`;
		};
		
		attributeChangedCallback() {
			this.render();
		}

		init() {
			this.render();
		}

		render() {
			let autocompleteParams = this.autocomplete;
			let autocompleteEnabled = !this.multiline && !!autocompleteParams;
			if (!this._input
					|| (this._input.hasAttribute('autocomplete')) !== autocompleteEnabled
					|| this._input.tagName !== (this.noWrap ? 'input' : 'textarea')) {
				let input;
				let inputTagName = this.noWrap ? 'input' : 'textarea';
				if (autocompleteEnabled) {
					input = document.createElement(inputTagName, { is: `autocomplete-${inputTagName}` });
				}
				else {
					input = document.createElement(inputTagName);
				}
				input.rows = 1;
				input.classList.add('input');
				input.toggleAttribute("no-windows-native", true);
				input.addEventListener('input', this._handleInput);
				input.addEventListener('change', this._handleChange);
				input.addEventListener('focus', this._handleFocus);
				input.addEventListener('blur', this._handleBlur);
				input.addEventListener('keydown', this._handleKeyDown);
				input.addEventListener('mousedown', this._handleMouseDown);
				input.addEventListener('dragover', this._handleDragOver);
				input.addEventListener('drop', this._handleDrop);
				if (autocompleteEnabled) {
					// Even through this may run multiple times on editable-text, the listener
					// is added only once because we pass the reference to the same exact function.
					this.addEventListener('keydown', this._captureAutocompleteKeydown, true);
				}
				else {
					this.removeEventListener('keydown', this._captureAutocompleteKeydown, true);
				}
				
				let focused = this.focused;
				let selectionStart = this._input?.selectionStart;
				let selectionEnd = this._input?.selectionEnd;
				let selectionDirection = this._input?.selectionDirection;
				
				if (focused) {
					input.dataset.initialValue = this._input?.dataset.initialValue;
				}
				if (this._input) {
					this._input.replaceWith(input);
				}
				else {
					this.append(input);
				}
				this._input = input;
				
				if (focused) {
					this._input.focus();
				}
				if (selectionStart !== undefined && selectionEnd !== undefined) {
					this._input.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
				}
			}
			this._input.readOnly = this.readOnly;
			this._input.placeholder = this.placeholder;

			if (this._input.tagName == "textarea") {
				// Reset to initial state
				this.style.removeProperty("--min-visible-lines");
				this.style.removeProperty("--max-visible-lines");
				// Set how tall the textarea can/must be
				if (this.minLines > 0) {
					this.style.setProperty("--min-visible-lines", this.minLines);
				}
				if (this.maxLines > 0) {
					this.style.setProperty("--max-visible-lines", this.maxLines);
				}
				
				// Calculate line-height in ems so we don't need to recalculate if font-size changes
				// TODO: Revisit once we can use the css 'lh' unit (fx >=120)
				let { lineHeight, fontSize } = getComputedStyle(this._input);
				let lineHeightRelative = parseFloat(lineHeight) / parseFloat(fontSize);
				if (isNaN(lineHeightRelative)) {
					this.style.setProperty('--line-height', '2ex');
				}
				else {
					this.style.setProperty('--line-height', lineHeightRelative + 'em');
				}
			}

			if (this.ariaLabel.length) {
				this._input.setAttribute('aria-label', this.ariaLabel);
			}
			if (this.ariaLabelledBy.length) {
				this._input.setAttribute('aria-labelledby', this.ariaLabelledBy);
			}
			this._input.value = this.value;
			
			// The actual input node can disappear if the component is moved
			if (this.childElementCount == 0) {
				this.replaceChildren(this._input);
			}

			if (autocompleteEnabled) {
				this._input.setAttribute('autocomplete', 'on');
				this._input.setAttribute('autocompletepopup', autocompleteParams.popup || '');
				this._input.setAttribute('autocompletesearch', autocompleteParams.search || '');
				delete autocompleteParams.popup;
				delete autocompleteParams.search;
				Object.assign(this._input, autocompleteParams);
			}

			// Set text direction automatically if user has enabled bidi utilities
			if ((!this._input.dir || this._input.dir === 'auto') && Zotero.Prefs.get('bidi.browser.ui', true)) {
				if (!this._textDirection) {
					this._textDirection = window.windowUtils.getDirectionFromText(this._input.value) === Ci.nsIDOMWindowUtils.DIRECTION_RTL
						? 'rtl'
						: 'ltr';
				}
				this._input.dir = this._textDirection;
			}
		}
		
		_handleInput = () => {
			if (!this.multiline) {
				this._input.value = this._input.value.replace(/\n/g, ' ');
			}
			this.setAttribute('value', this._input.value);
		};
		
		_handleChange = (event) => {
			if (Services.focus.activeWindow !== window) {
				event.stopPropagation();
			}
			this.setAttribute('value', this._input.value);
		};
		
		_handleFocus = () => {
			// If the last blur was ignored because it was caused by the window becoming inactive,
			// ignore this focus event as well
			if (this._ignoredWindowInactiveBlur) {
				this._ignoredWindowInactiveBlur = false;
				return;
			}

			this.dispatchEvent(new CustomEvent('focus'));
			this.classList.add("focused");
			// Select all text if focused via keyboard
			if (!this.getAttribute("mousedown")) {
				this._input.setSelectionRange(0, this._input.value.length, "backward");
			}
			if (!('initialValue' in this._input.dataset)) {
				this._input.dataset.initialValue = this._input.value;
			}
		};
		
		_handleBlur = () => {
			// Ignore this blur if it was caused by the window becoming inactive (see above)
			if (Services.focus.activeWindow !== window) {
				this._ignoredWindowInactiveBlur = true;
				return;
			}
			this.dispatchEvent(new Event('blur'));
			this._resetStateAfterBlur();
		};
		
		_resetStateAfterBlur() {
			this._ignoredWindowInactiveBlur = false;
			this.classList.remove('focused');
			this._input.scrollLeft = 0;
			this._input.setSelectionRange(0, 0);
			this.removeAttribute('mousedown');
			delete this._input.dataset.initialValue;
		}

		_handleKeyDown = (event) => {
			if (event.key === 'Enter') {
				if (this.multiline === event.shiftKey) {
					event.preventDefault();
					this._input.blur();
				}
				// Do not let out shift-enter event on multiline, since it should never do
				// anything but add a linebreak to textarea
				if (this.multiline && !event.shiftKey) {
					event.stopPropagation();
				}
			}
			else if (event.key === 'Escape') {
				let initialValue = this._input.dataset.initialValue ?? '';
				this.setAttribute('value', initialValue);
				this._input.value = initialValue;
				this._input.blur();
			}
		};

		_captureAutocompleteKeydown = (event) => {
			// On Enter or Escape, mozilla stops propagation of the event which may interfere with out handling
			// of the focus. E.g. the event should be allowed to reach itemDetails from itemBox so that focus
			// can be moved to the itemTree or the reader.
			// https://searchfox.org/mozilla-central/source/toolkit/content/widgets/autocomplete-input.js#564
			// To avoid it, capture Enter and Escape keydown events and handle them without stopping propagation.
			if (this._input.autocomplete !== "on" || !["Enter", "Escape"].includes(event.key)) return;
			event.preventDefault();
			if (event.key == "Enter") {
				this._input.handleEnter();
			}
			else if (event.key == "Escape") {
				this._input.mController.handleEscape();
			}
		};
		
		_handleMouseDown = (event) => {
			this.setAttribute("mousedown", true);
			// Prevent a right-click from focusing the input when unfocused
			if (event.button === 2 && document.activeElement !== this._input) {
				event.preventDefault();
			}
		};
		
		_handleDragOver = (event) => {
			// If the input is not focused, override the default drop behavior
			if ((document.activeElement !== this._input || Services.focus.activeWindow !== window)
					&& !this.readOnly
					&& event.dataTransfer.getData('text/plain')) {
				event.preventDefault();
				event.dataTransfer.dropEffect = 'copy';
			}
		};
		
		_handleDrop = (event) => {
			// If the input is not focused, replace its entire value with the dropped text
			// Otherwise, the normal drop effect takes place and the text is inserted at the cursor
			if ((document.activeElement !== this._input || Services.focus.activeWindow !== window)
					&& !this.readOnly
					&& event.dataTransfer.getData('text/plain')) {
				event.preventDefault();
				document.activeElement?.blur();
				// Wait a tick to work around an apparent Firefox bug where the cursor stays inside the old
				// input even though the new input becomes visually focused
				setTimeout(() => {
					this.focus();
					this._input.value = event.dataTransfer.getData('text/plain');
					this._handleInput();
				});
			}
		};

		focus(options) {
			// If the window isn't active, the focus event won't fire yet,
			// so store the initial value now
			if (this._input && Services.focus.activeWindow !== window && !('initialValue' in this._input.dataset)) {
				this._input.dataset.initialValue = this._input.value;
			}
			this._input?.focus(options);
		}
		
		blur() {
			this._input?.blur();
			
			// This is a programmatic blur, so reset our state even if the
			// window is inactive
			this._resetStateAfterBlur();
		}
		
		get focused() {
			return this._input && document.activeElement === this._input;
		}
	}
	customElements.define("editable-text", EditableText);
	
	document.addEventListener('contextmenu', (event) => {
		if (event.defaultPrevented
				|| !event.target.closest('editable-text')
				|| document.activeElement && event.target.contains(document.activeElement)) {
			return;
		}
		
		event.preventDefault();
		
		let editableText = event.target.closest('editable-text');
		let menupopup = document.getElementById('zotero-editable-text-menu');
		if (!menupopup) {
			menupopup = document.createXULElement('menupopup');
			menupopup.id = 'zotero-editable-text-menu';
			
			let popupset = document.querySelector('popupset');
			if (!popupset) {
				popupset = document.createXULElement('popupset');
				document.documentElement.append(popupset);
			}
			popupset.append(menupopup);
		}

		menupopup.addEventListener('popupshowing', () => {
			Zotero.Utilities.Internal.updateEditContextMenu(menupopup, editableText);
		}, { once: true });
		menupopup.openPopupAtScreen(event.screenX + 1, event.screenY + 1, true);
	});
}
