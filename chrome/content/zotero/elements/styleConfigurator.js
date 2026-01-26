/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2022 Corporation for Digital Scholarship
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

{
	class StyleSelector extends XULElementBase {
		ready = new Promise((resolve) => {
			this._readyResolve = resolve;
		});
		
		content = MozXULElement.parseXULToFragment(`
			<div id="style-selector"
				xmlns="http://www.w3.org/1999/xhtml"
				xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
			>
				<div class="style-list-container">
					<xul:richlistbox id="style-list" tabindex="0" />
					<div class="placeholder">
						<span data-l10n-id="general-loading" />
					</div>
				</div>
			</div>
		`);

		set value(val) {
			if (!this.values.includes(val)) {
				try {
					let style = Zotero.Styles.get(val);
					// Check for remapped style id
					if (style) {
						val = style.styleID;
					}
					else {
						return;
					}
				}
				catch (e) {
					return;
				}
			}
			let styleList = this.querySelector('#style-list');
			styleList.value = val;
			this._scrollToSelected();
		}

		get value() {
			return this.querySelector('#style-list').value;
		}

		get values() {
			return Array.from(this.querySelectorAll('#style-list richlistitem')).map(elem => elem.value);
		}

		async init() {
			const styleListEl = this.querySelector('#style-list');
			const placeholderEl = this.querySelector('.placeholder');
			await Zotero.Styles.init();

			Zotero.Styles.getVisible().forEach((so) => {
				const value = so.styleID;
				// Add acronyms to APA and ASA to avoid confusion
				// https://forums.zotero.org/discussion/comment/357135/#Comment_357135
				const label = so.title
					.replace(/^American Psychological Association/, "American Psychological Association (APA)")
					.replace(/^American Sociological Association/, "American Sociological Association (ASA)");
				
				let richlistitem = document.createXULElement('richlistitem');
				let labelEL = document.createXULElement("label");
				labelEL.setAttribute("value", label);
				labelEL.setAttribute("tooltiptext", label);
				richlistitem.appendChild(labelEL);
				richlistitem.value = value;
				styleListEl.append(richlistitem);
			});
			this.value = this.getAttribute('value');
			styleListEl.addEventListener("select", () => {
				const event = document.createEvent("Events");
				event.initEvent("select", true, true);
				this.dispatchEvent(event);
			});
			
			placeholderEl.style.display = 'none';
			this._readyResolve();
		}

		_scrollToSelected() {
			let list = this.querySelector('#style-list');
			let containerRect = list.getBoundingClientRect();
			let rowRect = list.selectedItem.getBoundingClientRect();
			let topDistance = rowRect.top - containerRect.top;
			let bottomDistance = containerRect.bottom - rowRect.bottom;
			let toScroll = (topDistance - bottomDistance) / 2;
			list.scrollTo({ top: list.scrollTop + toScroll });
		}
	}

	class LocaleSelector extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<div id="locale-selector"
				xmlns="http://www.w3.org/1999/xhtml"
				xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
			>
				<div>
					<xul:menulist id="locale-list" tabindex="0" native="true">
						<xul:menupopup />
					</xul:menulist>
				</div>
			</div>
		`);

		get value() {
			if (this.localeListEl.disabled) return undefined;
			return this.localeListEl.value;
		}

		set value(val) {
			try {
				// eslint-disable-next-line no-new
				new Intl.Locale(val);
			}
			catch (e) {
				Zotero.logError(e);
				val = '';
			}
			
			this._value = val;
			const styleData = this._style ? Zotero.Styles.get(this._style) : null;
			this.localeListEl.value = styleData && styleData.locale || this._value;
		}

		get style() {
			return this._style;
		}

		set style(style) {
			this._style = style;
			const styleData = style ? Zotero.Styles.get(style) : null;
			this.localeListEl.disabled = !style || !!styleData.locale;
			this.localeListEl.value = styleData && styleData.locale || this._value || this.fallbackLocale;
		}

		connectedCallback() {
			super.connectedCallback();
			this.localeListEl = this.querySelector('#locale-list');
			this.localePopupEl = this.querySelector('#locale-list > menupopup');
		}

		async init() {
			this._style = this.getAttribute('style');
			this._value = this.getAttribute('value');

			await Zotero.Styles.init();
			this.fallbackLocale = Zotero.Styles?.primaryDialects[Zotero.locale] || Zotero.locale;

			const menuLocales = Zotero.Utilities.deepCopy(Zotero.Styles.locales);
			const menuLocalesKeys = Object.keys(menuLocales).sort();

			// Make sure that client locale is always available as a choice
			if (this.fallbackLocale && !(this.fallbackLocale in menuLocales)) {
				menuLocales[this.fallbackLocale] = this.fallbackLocale;
				menuLocalesKeys.unshift(this.fallbackLocale);
			}

			menuLocalesKeys.forEach((key) => {
				const label = menuLocales[key];
				
				let menuitem = document.createXULElement('menuitem');
				menuitem.value = key;
				menuitem.label = label;
				this.localePopupEl.append(menuitem);
			});

			this.value = this._value;
			this.style = this._style;

			this.localeListEl.addEventListener("command", (_event) => {
				this._value = this.localeListEl.value;
				const event = document.createEvent("Events");
				event.initEvent("select", true, true);
				this.dispatchEvent(event);
			});
		}
	}

	class StyleConfigurator extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<div class="style-configurator"
				xmlns="http://www.w3.org/1999/xhtml"
				xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
			>
				<div class="style-list-container">
					<label for="style-selector" data-l10n-id="bibliography-style-label" />
					<div class="style-selector-wrapper"/>
					<label id="manage-styles" tabindex="0" role="link" class="text-link" data-l10n-id="bibliography-manageStyles-label"></label>
				</div>
				<div class="locale-selector-wrapper">
					<label for="locale-selector" class="locale-selector-label" data-l10n-id="bibliography-locale-label" />
				</div>
				<div class="display-as-wrapper">
					<label for="style-selector" data-l10n-id="bibliography-displayAs-label" />
					<xul:radiogroup id="display-as">
						<xul:radio value="footnotes" data-l10n-id="integration-prefs-footnotes" selected="true" />
						<xul:radio value="endnotes" data-l10n-id="integration-prefs-endnotes" />
					</xul:radiogroup>
				</div>
			</div>
		`);

		set style(val) {
			this.querySelector('#style-selector').value = val;
			this.handleStyleChanged(val);
		}

		get style() {
			return this.querySelector('#style-selector').value;
		}

		get styles() {
			return this.querySelector('#style-selector').values;
		}

		set locale(val) {
			this.querySelector('#locale-selector').value = val;
		}

		get locale() {
			return this.querySelector('#locale-selector').value;
		}

		set displayAs(val) {
			this.querySelector('#display-as').value = val;
		}

		get displayAs() {
			return this.querySelector('#display-as').value;
		}

		connectedCallback() {
			super.connectedCallback();
			MozXULElement.insertFTLIfNeeded("integration.ftl");
		}

		async init() {
			let styleSelector = document.createXULElement('style-selector');
			styleSelector.id = 'style-selector';
			// value needs to be initialized before the style-selector CE connects
			styleSelector.setAttribute('value', this.getAttribute('style') || Zotero.Prefs.get('export.lastStyle'));
			this.querySelector('.style-selector-wrapper').append(styleSelector);

			let localeSelector = document.createXULElement('locale-selector');
			localeSelector.id = 'locale-selector';
			// As above - initialize values first to avoid race conditions in LocaleSelector#init()
			localeSelector.setAttribute('value', this.getAttribute('locale') || Zotero.Prefs.get('export.lastLocale') || '');
			localeSelector.setAttribute('style', this.getAttribute('style') || Zotero.Prefs.get('export.lastStyle') || '');
			this.querySelector('.locale-selector-wrapper').append(localeSelector);
			
			await Zotero.Styles.init();
			styleSelector.addEventListener('select', (_event) => {
				this.handleStyleChanged(_event.target.value);

				const event = new CustomEvent("select", {
					detail: {
						type: "style",
					},
					bubbles: true,
					cancelable: true
				});
				this.dispatchEvent(event,);
			});

			localeSelector.addEventListener('select', (_event) => {
				const event = new CustomEvent("select", {
					detail: {
						type: "locale",
					},
					bubbles: true,
					cancelable: true
				});
				this.dispatchEvent(event);
			});

			this.querySelector('#display-as').addEventListener('select', (_event) => {
				const event = new CustomEvent("select", {
					detail: {
						type: "displayAs",
					},
					bubbles: true,
					cancelable: true
				});
				this.dispatchEvent(event);
			});

			this.querySelector('#manage-styles').addEventListener('click', (_e) => {
				const event = new CustomEvent("manage-styles");
				this.dispatchEvent(event);
			});
			// Click manage-styles link on space or enter. Otherwise, Enter would submit the dialog
			// and space would do nothing.
			this.querySelector('#manage-styles').addEventListener('keypress', (event) => {
				if (event.key == 'Enter' || event.key == ' ') {
					event.preventDefault();
					event.target.click();
				}
			});
		}
		
		toggleNoteTypePicker(style) {
			const styleData = style ? Zotero.Styles.get(style) : null;
			const isNoteStyle = (styleData || {}).class === 'note';
			const noMultipleNotes = this.hasAttribute('no-multi-notes');
			this.querySelector('.display-as-wrapper').style.display
				= (isNoteStyle && !noMultipleNotes) ? '' : 'none';
		}
		
		toggleAttribute(name, force) {
			super.toggleAttribute(name, force);
			this.toggleNoteTypePicker(this.querySelector('#locale-selector').style);
		}

		handleStyleChanged(style) {
			this.querySelector('#locale-selector').style = style;
			this.toggleNoteTypePicker(style);
		}
	}

	customElements.define('locale-selector', LocaleSelector);
	customElements.define('style-selector', StyleSelector);
	customElements.define('style-configurator', StyleConfigurator);
}
