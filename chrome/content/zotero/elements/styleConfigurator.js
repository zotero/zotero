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

/* global XULElementBase: false */

{
	Services.scriptloader.loadSubScript("chrome://zotero/content/elements/base.js", this);

	class StyleSelector extends XULElementBase {
		get stylesheets() {
			return [
				'chrome://global/skin/global.css',
				'chrome://zotero/skin/elements/style-configurator.css'
			];
		}

		content = MozXULElement.parseXULToFragment(`
			<div id="style-selector"
				xmlns="http://www.w3.org/1999/xhtml"
				xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
			>
				<div>
					<xul:richlistbox id="style-list" tabindex="0" />
				</div>
			</div>
		`);

		set value(val) {
			this.shadowRoot.getElementById('style-list').value = val;
		}

		get value() {
			return this.shadowRoot.getElementById('style-list').value;
		}

		async init() {
			await Zotero.Styles.init();
			const styleListEl = this.shadowRoot.getElementById('style-list');

			Zotero.Styles.getVisible().forEach((so) => {
				const value = so.styleID;
				// Add acronyms to APA and ASA to avoid confusion
				// https://forums.zotero.org/discussion/comment/357135/#Comment_357135
				const label = so.title
					.replace(/^American Psychological Association/, "American Psychological Association (APA)")
					.replace(/^American Sociological Association/, "American Sociological Association (ASA)");
				
				styleListEl.appendChild(MozXULElement.parseXULToFragment(`
					<richlistitem value="${value}">${label}</richlistitem>
				`));
			});
			this.value = this.getAttribute('value');
			this.shadowRoot.getElementById('style-list').addEventListener("select", () => {
				const event = document.createEvent("Events");
				event.initEvent("select", true, true);
				this.dispatchEvent(event);
			});
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

		get stylesheets() {
			return [
				'chrome://global/skin/global.css',
				'chrome://zotero/skin/elements/style-configurator.css'
			];
		}

		get value() {
			return this.localeListEl.value;
		}

		set value(val) {
			this._value = val;
			const styleData = this._style ? Zotero.Styles.get(this._style) : null;
			this.localeListEl.value = styleData && styleData.locale || this._value;
		}

		get style() {
			return this.style;
		}

		set style(style) {
			this._style = style;
			const styleData = style ? Zotero.Styles.get(style) : null;
			this.localeListEl.disabled = !style || !!styleData.locale;
			this.localeListEl.value = styleData && styleData.locale || this._value || this.fallbackLocale;
		}

		connectedCallback() {
			super.connectedCallback();
			this.localeListEl = this.shadowRoot.getElementById('locale-list');
			this.localePopupEl = this.shadowRoot.querySelector('#locale-list > menupopup');
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
				
				this.localePopupEl.appendChild(MozXULElement.parseXULToFragment(`
					<menuitem value="${key}" label="${label}"/>
				`));
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
			<div id="style-configurator"
				xmlns="http://www.w3.org/1999/xhtml"
				xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
			>
				<label for="style-selector" data-l10n-id="bibliography-style-label" />
				<div id="style-selector-wrapper">
					<xul:style-selector id="style-selector" value="${this.getAttribute('style') || Zotero.Prefs.get('export.lastStyle') || ''}" />
				</div>
				<div id="locale-selector-wrapper">
					<label for="locale-selector" class="file-input-label" data-l10n-id="bibliography-locale-label" />
					<xul:locale-selector
						id="locale-selector"
						value="${this.getAttribute('locale') || Zotero.Prefs.get('export.lastLocale') || ''}"
						style="${this.getAttribute('style') || Zotero.Prefs.get('export.lastStyle') || ''}"
					/>
				</div>
				<div id="display-as-wrapper">
					<xul:radiogroup id="display-as">
						<xul:radio value="footnotes" data-l10n-id="integration-prefs-footnotes" selected="true" />
						<xul:radio value="endnotes" data-l10n-id="integration-prefs-endnotes" />
					</xul:radiogroup>
				</div>
			</div>
		`);

		get stylesheets() {
			return [
				'chrome://global/skin/global.css',
				'chrome://zotero/skin/elements/style-configurator.css'
			];
		}

		set style(val) {
			this.shadowRoot.getElementById('style-selector').value = val;
			this.handleStyleChanged(val);
		}

		get style() {
			return this.shadowRoot.getElementById('style-selector').value;
		}

		set locale(val) {
			this.shadowRoot.getElementById('locale-selector').value = val;
		}

		get locale() {
			return this.shadowRoot.getElementById('locale-selector').value;
		}

		set displayAs(val) {
			this.shadowRoot.getElementById('display-as').value = val;
		}

		get displayAs() {
			return this.shadowRoot.getElementById('display-as').value;
		}

		async init() {
			this.shadowRoot.getElementById('style-configurator').style.display = 'none';
			await Zotero.Styles.init();
			this.shadowRoot.getElementById('style-configurator').style.display = '';
			this.shadowRoot.getElementById('style-selector').addEventListener('select', (_event) => {
				this.handleStyleChanged(_event.target.value);

				const event = document.createEvent("Events");
				event.initEvent("select", true, true);
				this.dispatchEvent(event);
			});

			this.shadowRoot.getElementById('locale-selector').addEventListener('select', (_event) => {
				const event = document.createEvent("Events");
				event.initEvent("select", true, true);
				this.dispatchEvent(event);
			});

			this.shadowRoot.getElementById('display-as').addEventListener('select', (_event) => {
				const event = document.createEvent("Events");
				event.initEvent("select", true, true);
				this.dispatchEvent(event);
			});
		}

		handleStyleChanged(style) {
			this.shadowRoot.getElementById('locale-selector').style = style;
			const styleData = style ? Zotero.Styles.get(style) : null;
			const isNoteStyle = (styleData || {}).class === 'note';
			this.shadowRoot.getElementById('display-as-wrapper').style.display = isNoteStyle ? '' : 'none';
		}
	}

	customElements.define('locale-selector', LocaleSelector);
	customElements.define('style-selector', StyleSelector);
	customElements.define('style-configurator', StyleConfigurator);
}
